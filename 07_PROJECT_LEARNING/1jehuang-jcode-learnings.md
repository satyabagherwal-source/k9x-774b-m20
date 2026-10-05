# Forensic Learning Record (Deep Inspection): 1jehuang/jcode

> **Canonical Artifact**: `07_PROJECT_LEARNING/1jehuang-jcode-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/1jehuang/jcode](https://github.com/1jehuang/jcode))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:10:38.169Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `1jehuang/jcode`
- **Description**: High performance coding agent harness written in rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 20310 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/jcode-app-core/src/agent.rs`
```
#![cfg_attr(test, allow(clippy::await_holding_lock))]

mod compaction;
mod environment;
mod inline_tail;
mod interrupts;
mod messages;
#[cfg(test)]
mod model_usage_tests;
mod prompting;
mod provider;
mod response_recovery;
mod status;
mod streaming;
mod tools;
mod turn_execution;
mod turn_loops;
mod turn_streaming_mpsc;
mod utils;

use self::streaming::{send_stream_keepalive_mpsc, stream_keepalive_ticker};
use self::tools::{
    cap_sdk_tool_content_for_history, cap_tool_output_for_history, print_tool_summary,
    tool_output_side_pane_images, tool_output_to_content_blocks,
};
use self::utils::trace_enabled;
use crate::build;
use crate::bus::{Bus, BusEvent, SubagentStatus, ToolEvent, ToolStatus};
use crate::cache_tracker::CacheTracker;
use crate::compaction::CompactionEvent;
use crate::id;
use crate::logging;
use crate::message::{
    ContentBlock, Message, Role, StreamEvent, TOOL_OUTPUT_MISSING_TEXT, ToolCall, ToolDefinition,
};
use crate::protocol::{HistoryMessage, ServerEvent};
use crate::provider::{NativeToolResult, Provider, ProviderRuntimeState};
use crate::session::{GitState, Session, SessionStatus, StoredDisplayRole, StoredMessage};
use crate::skill::SkillRegistry;
use crate::tool::{Registry, ToolContext, ToolExecutionMode};
use anyhow::Result;
use futures::StreamExt;
use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::io::{self, Write};
use std::path::PathBuf;
use std::sync::{Arc, LazyLock, Mutex as StdMutex};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;

use interrupts::{NoToolCallOutcome, PostToolInterruptOutcome};
pub use jcode_agent_runtime::{
    BackgroundToolSignal, GracefulShutdownSignal, InterruptSignal, SoftInterruptMessage,
    SoftInterruptQueue, SoftInterruptSource, StreamError,
};

const JCODE_NATIVE_TOOLS: &[&str] = &["selfdev", "desktop_selfdev", "communicate"];
static RECOVERED_TEXT_WRAPPED_TOOL_CALLS: std::sync::atomic::AtomicU64 =
    std::sync::atomic::AtomicU64::new(0);
static JCODE_REPO_SOURCE_STATE: LazyLock<(Option<String>, Option<bool>)> = LazyLock::new(|| {
    crate::build::get_repo_dir()
        .map(|repo_dir| {
            (
                build::current_git_hash(&repo_dir).ok(),
                build::is_working_tree_dirty(&repo_dir).ok(),
            )
        })
        .unwrap_or((None, None))
});
static WORKING_GIT_STATE_CACHE: LazyLock<StdMutex<HashMap<PathBuf, Option<GitState>>>> =
    LazyLock::new(|| StdMutex::new(HashMap::new()));
const STREAM_KEEPALIVE_PONG_ID: u64 = 0;

fn stable_hash_str(value: &str) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    value.hash(&mut hasher);
    hasher.finish()
}

fn stable_hash_json<T: serde::Serialize + ?Sized>(value: &T) -> u64 {
    let encoded = serde_json::to_string(value).unwrap_or_default();
    stable_hash_str(&encoded)
}

fn stable_json_len<T: serde::Serialize + ?Sized>(value: &T) -> usize {
    serde_json::to_string(value)
        .map(|encoded| encoded.len())
        .unwrap_or_default()
}

fn message_hashes(messages: &[Message]) -> Vec<u64> {
    // Hash the cache-relevant projection, not the raw Message. Raw hashing
    // keys off non-transmitted metadata (timestamp, tool_duration_ms,
    // ReasoningTrace blocks, cache_control markers), which triggers spurious
    // harness:_prefix_changed KV-cache miss reports when the same message is
    // re-serialized with backfilled metadata on the next turn.
    crate::message::cache_relevant_message_hashes(messages)
}

fn kv_cache_request_event(
    messages: &[Message],
    tools: &[ToolDefinition],
    system_static: &str,
    ephemeral_messages: &[Message],
) -> ServerEvent {
    let ephemeral_hash = if ephemeral_messages.is_empty() {
        None
    } else {
        Some(stable_hash_json(ephemeral_messages))
    };
    ServerEvent::KvCacheRequest {
        system_static_hash: stable_hash_str(system_static),
        tools_hash: stable_hash_json(tools),
        messages_hash: stable_hash_json(&crate::message::cache_relevant_messages(messages)),
        message_hashes: message_hashes(messages),
        message_count: messages.len(),
        tool_count: tools.len(),
        system_static_chars: system_static.chars().count(),
        tools_json_chars: stable_json_len(tools),
        messages_json_chars: stable_json_len(messages),
        ephemeral_hash,
        ephemeral_chars: stable_json_len(ephemeral_messages),
        ephemeral_message_count: ephemeral_messages.len(),
    }
}

impl Agent {
    /// Provider identity used for cache retention lookups. Generic OpenAI is
    /// only refined when the credential mode is explicitly pinned.
    fn kv_cache_provider_identity(&self) -> String {
        let name = self.provider.name().to_string();
        if !name.eq_ignore_ascii_case("openai") {
            return name;
        }
        match self.provider.active_explicit_credential() {
            Some(jcode_provider_core::ResolvedCredential::ApiKey) => "openai-api".into(),
            Some(jcode_provider_core::ResolvedCredential::Oauth) => "openai-oauth".into(),
            None => name,
        }
    }

    fn begin_kv_cache_monitor_request(&mut self, event: &ServerEvent, model: &str) {
        let ServerEvent::KvCacheRequest {
            system_static_hash,
            tools_hash,
            messages_hash,
            message_hashes,
            message_count,
            tool_count,
            ..
        } = event
        else {
            return;
        };
        let provider = self.kv_cache_provider_identity();
        let route = crate::kv_cache_monitor::RequestRoute {
            cache_ttl_secs: crate::provider::cache_ttl_for_provider_model(&provider, Some(model)),
            ttl_is_estimate: crate::provider::cache_ttl_is_estimate(&provider),
            provider,
            model: model.to_string(),
            upstream_provider: self.last_upstream_provider.clone(),
        };
        let signature = crate::kv_cache_monitor::RequestSignature {
            system_static_hash: *system_static_hash,
            tools_hash: *tools_hash,
            tool_count: *tool_count,
            messages_hash: *messages_hash,
            message_hashes: message_hashes.clone(),
            message_count: *message_count,
        };
        self.kv_cache_monitor.begin_request(route, signature);
    }

    /// Classify the completed request's usage. Returns the event to send when
    /// the request missed the KV cache.
    fn finish_kv_cache_monitor_request(
        &mut self,
        input: u64,
        cache_read: Option<u64>,
        cache_creation: Option<u64>,
    ) -> Option<ServerEvent> {
        let effective = self.effective_context_tokens_from_usage(input, cache_read, cache_creation);
        let miss = self
            .kv_cache_monitor
            .finish_request(effective, cache_read)?;
        logging::warn(&format!(
            "KV_CACHE_MISS session={} reason={} harness_caused={} missed={} expected={} read={} documented={:?}",
            self.session.id,
            miss.reason.id(),
            miss.reason.harness_caused(),
            miss.missed_tokens,
            miss.expected_tokens,
            miss.read_tokens,
            miss.documented_cause,
        ));
        Some(ServerEvent::KvCacheMiss {
            reason: miss.reason.id().to_string(),
            harness_caused: miss.reason.harness_caused(),
            missed_tokens: miss.missed_tokens,
            expected_tokens: miss.expected_tokens,
            read_tokens: miss.read_tokens,
            message: miss.message(),
            documented_cause: miss.documented_cause,
        })
    }
}

fn log_agent_provider_stream_lifecycle(
    level: logging::LogLevel,
    agent: &Agent,
    phase: &str,
    api_start: Instant,
    fields: Vec<(&str, String)>,
) {
    let mut owned = vec![
        ("phase".to_string(), phase.to_string()),
        ("provider".to_string(), agent.provider.name().to_string()),
        ("model".to_string(), agent.provider.model()),
        ("session_id".to_string(), agent.session.id.clone()),
        (
            "provider_session_id".to_string(),
            agent
                .provider_session_id
                .clone()
                .unwrap_or_else(|| "none".to_string()),
        ),
        (
            "connection_type".to_string(),
            agent
                .last_connection_type
                .clone()
                .unwrap_or_else(|| "unknown".to_string()),
        ),
        (
            "elapsed_ms".to_string(),
            api_start.elapsed().as_millis().to_string(),
        ),
    ];
    owned.extend(
        fields
            .into_iter()
            .map(|(key, value)| (key.to_string(), value)),
    );
    logging::event(level, "AGENT_PROVIDER_STREAM_LIFECYCLE", owned);
}

/// Token usage from the last API request
#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct TokenUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_input_tokens: Option<u64>,
    pub cache_creation_input_tokens: Option<u64>,
}

#[derive(Debug, Clone)]
struct RewindUndoSnapshot {
    messages: Vec<StoredMessage>,
    provider_session_id: Option<String>,
    session_provider_session_id: Option<String>,
    visible_message_count: usize,
}

pub struct Agent {
    provider: Arc<dyn Provider>,
    registry: Registry,
    skills: Arc<SkillRegistry>,
    session: Session,
    active_skill: Option<String>,
    allowed_tools: Option<HashSet<String>>,
    disabled_tools: HashSet<String>,
    /// Generation-scoped ownership of this Agent's global tool-policy entry.
    _tool_policy_registration: crate::tool::SessionToolPolicyRegistration,
    /// MCP top-level definition exposure policy captured when the session starts.
    mcp_tools_mode: crate::config::McpToolsMode,
    /// Provider-specific session ID for conversation resume (e.g., Claude Code CLI session)
    provider_session_id: Option<String>,
    /// Last upstream provider (OpenRouter) observed for this ses
```

### Core Architecture Module: `crates/jcode-app-core/src/agent/compaction.rs`
```
use super::*;

impl Agent {
    pub(super) fn note_compaction_applied(&mut self) {
        self.cache_tracker.reset();
        self.kv_cache_monitor.reset();
        self.locked_tools = None;
        self.provider_session_id = None;
        self.session.provider_session_id = None;
    }

    pub fn poll_compaction_completion_event(&mut self) -> Option<CompactionEvent> {
        let provider_messages = self.session.messages_for_provider();
        let compaction = self.registry.compaction();
        let event = match compaction.try_write() {
            Ok(mut manager) => {
                let event = manager.poll_compaction_event_with(&provider_messages);
                if event.is_some() {
                    self.sync_session_compaction_state_from_manager(&manager);
                }
                event
            }
            Err(_) => return None,
        };

        if event.is_some() {
            self.note_compaction_applied();
            self.persist_session_best_effort("compaction completion");
        }

        event
    }

    pub fn request_manual_compaction(&mut self) -> (String, bool) {
        if !self.provider.supports_compaction() {
            return (
                "Manual compaction is not available for this provider.".to_string(),
                false,
            );
        }

        let provider = self.provider.fork();
        let messages = self.session.messages_for_provider();
        let compaction = self.registry.compaction();

        match compaction.try_write() {
            Ok(mut manager) => {
                let stats = manager.stats_with(&messages);
                let status_msg = format!(
                    "**Context Status:**\n\
                    • Messages: {} (active), {} (total history)\n\
                    • Token usage: ~{}k (estimate ~{}k) / {}k ({:.1}%)\n\
                    • Has summary: {}\n\
                    • Compacting: {}",
                    stats.active_messages,
                    stats.total_turns,
                    stats.effective_tokens / 1000,
                    stats.token_estimate / 1000,
                    manager.token_budget() / 1000,
                    stats.context_usage * 100.0,
                    if stats.has_summary { "yes" } else { "no" },
                    if stats.is_compacting {
                        "in progress..."
                    } else {
                        "no"
                    }
                );

                match manager.force_compact_with(&messages, provider) {
                    Ok(()) => (
                        format!(
                            "{}\n\n📦 **Compacting context** (manual) — summarizing older messages in the background to stay within the context window.\n\
                            The summary will be applied automatically when ready.",
                            status_msg
                        ),
                        true,
                    ),
                    Err(reason) => (
                        format!("{status_msg}\n\n⚠ **Cannot compact:** {reason}"),
                        false,
                    ),
                }
            }
            Err(_) => (
                "⚠ Cannot access compaction manager (lock held)".to_string(),
                false,
            ),
        }
    }

    fn is_context_limit_error(error: &str) -> bool {
        let lower = error.to_lowercase();
        lower.contains("context length")
            || lower.contains("context window")
            || lower.contains("maximum context")
            || lower.contains("max context")
            || lower.contains("token limit")
            || lower.contains("too many tokens")
            || lower.contains("prompt is too long")
            || lower.contains("input is too long")
            || lower.contains("request too large")
            || lower.contains("length limit")
            || lower.contains("maximum tokens")
            || (lower.contains("exceeded") && lower.contains("tokens"))
    }

    /// Best-effort emergency recovery after a context-limit error.
    ///
    /// Performs a synchronous hard compaction and resets provider session state,
    /// allowing the caller to retry the same turn immediately.
    pub(super) fn try_auto_compact_after_context_limit(&mut self, error: &str) -> bool {
        if crate::provider::openai_request::is_openai_encrypted_content_too_large_error(error)
            && self.try_recover_oversized_openai_native_compaction()
        {
            return true;
        }
        // A provider HTTP 413 ("request too large") is a *byte-size* failure
        // driven by inline base64 images, not a token-context overflow. Token
        // accounting deliberately undercounts images, so ordinary compaction
        // would not shrink the payload and the retry would 413 again. Strip
        // oversized images first.
        if self.try_recover_after_payload_too_large(error) {
            return true;
        }
        if self.try_recover_after_image_rejection(error) {
            return true;
        }
        if !Self::is_context_limit_error(error) {
            return false;
        }
        if !self.provider.supports_compaction() {
            return false;
        }

        let context_limit = self.provider.context_window() as u64;
        let compaction = self.registry.compaction();

        let (dropped, usage_pct) = match compaction.try_write() {
            Ok(mut manager) => {
                let (dropped, usage_pct) = {
                    let all_messages = self.session.provider_messages();
                    manager.update_observed_input_tokens(context_limit);
                    let usage_pct = manager.context_usage_with(all_messages) * 100.0;
                    let dropped = match manager.hard_compact_with(all_messages) {
                        Ok(dropped) => dropped,
                        Err(reason) => {
                            logging::warn(&format!(
                                "Context-limit auto-recovery failed: hard compact failed ({})",
                                reason
                            ));
                            return false;
                        }
                    };
                    (dropped, usage_pct)
                };
                self.sync_session_compaction_state_from_manager(&manager);
                (dropped, usage_pct)
            }
            Err(_) => {
                logging::warn("Context-limit auto-recovery skipped: compaction manager lock busy");
                return false;
            }
        };

        self.cache_tracker.reset();
        self.kv_cache_monitor.reset();
        self.locked_tools = None;
        self.provider_session_id = None;
        self.session.provider_session_id = None;

        logging::warn(&format!(
            "Context limit exceeded; auto-compacted and retrying (dropped {} messages, usage was {:.1}%)",
            dropped, usage_pct
        ));
        crate::runtime_memory_log::emit_event(
            crate::runtime_memory_log::RuntimeMemoryLogEvent::new(
                "auto_compaction_applied",
                "context_limit_auto_compaction",
            )
            .with_session_id(self.session.id.clone())
            .with_detail(format!(
                "dropped_messages={dropped},usage_pct={usage_pct:.1}"
            ))
            .force_attribution(),
        );

        true
    }

    /// Best-effort recovery after a provider HTTP 413 "request too large" error.
    ///
    /// This failure is caused by the serialized request body (dominated by inline
    /// base64 images) exceeding the provider's size cap, which is independent of
    /// the token context window. We strip oversized images from the persisted
    /// transcript, oldest-first, down to a conservative byte budget and reset the
    /// provider session/cache so the caller can retry the same turn immediately.
    fn try_recover_after_payload_too_large(&mut self, error: &str) -> bool {
        if !crate::compaction::is_request_payload_too_large_error(error) {
            return false;
        }

        let stripped = self
            .session
            .strip_oversized_images(crate::compaction::PAYLOAD_IMAGE_CHAR_BUDGET);
        if stripped == 0 {
            logging::warn(
                "Request-too-large recovery skipped: no oversized inline images to strip",
            );
            return false;
        }
        self.reset_after_transcript_image_rewrite();

        logging::warn(&format!(
            "Request body exceeded provider size limit; stripped {} oversized inline image(s) and retrying",
            stripped
        ));
        crate::runtime_memory_log::emit_event(
            crate::runtime_memory_log::RuntimeMemoryLogEvent::new(
                "payload_too_large_recovered",
                "request_payload_too_large",
            )
            .with_session_id(self.session.id.clone())
            .with_detail(format!("images_stripped={stripped}"))
            .force_attribution(),
        );

        true
    }

    /// A provider rejected an inline image with a deterministic 400 (bad
    /// media type, undecodable data, a limit jcode does not model). Every
    /// retry would replay the same image, so replace stored images with text
    /// notes and retry once (#1712). The outbound clamp normally prevents
    /// this; this catches provider rules it does not know about.
    fn try_recover_after_image_rejection(&mut self, error: &str) -> bool {
        if !crate::compaction::is_image_rejection_error(error) {
            return false;
        }
        let stripped = self.session.strip_all_images();
        if stripped == 0 {
            return false;
        }
        self.reset_after_transcript_image_rewrite();
        if let Err(err) = self.session.save() {
            logging::warn(&format!(
                "Image-rejection recovery: failed to persist stripped transcript: {err}"
            ));
        }
   
```

### Core Architecture Module: `crates/jcode-app-core/src/agent/environment.rs`
```
use super::{Agent, JCODE_REPO_SOURCE_STATE, WORKING_GIT_STATE_CACHE};
use crate::logging;
use crate::session::{EnvSnapshot, GitState};
use chrono::Utc;
use std::path::Path;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum EnvSnapshotDetail {
    Minimal,
    Full,
}

pub(super) fn cached_git_state_for_dir(
    dir: &Path,
    git_state_for_dir: impl Fn(&Path) -> Option<GitState>,
) -> Option<GitState> {
    let cache_key = dir.to_path_buf();
    if let Ok(cache) = WORKING_GIT_STATE_CACHE.lock()
        && let Some(state) = cache.get(&cache_key)
    {
        return state.clone();
    }

    let state = git_state_for_dir(dir);
    if let Ok(mut cache) = WORKING_GIT_STATE_CACHE.lock() {
        cache.insert(cache_key, state.clone());
    }
    state
}

impl Agent {
    /// Set logging context for this agent's session/provider
    pub(super) fn set_log_context(&self) {
        logging::set_session(&self.session.id);
        // Log the profile this session actually talks to. `name()` is the
        // stable machine id for the provider class, which the multiplexing
        // slot reports as `OpenRouter` (a concrete runtime instance reports
        // `openrouter`); that slot also serves every direct OpenAI-compatible
        // profile, so it tagged DeepSeek sessions `prv:OpenRouter` /
        // `prv:openrouter` (issue #1286).
        logging::set_provider_info(&self.provider.display_name(), &self.provider.model());
    }

    /// Record a lightweight environment snapshot for post-mortem debugging
    pub(super) fn log_env_snapshot(&mut self, reason: &str) {
        let snapshot = self.build_env_snapshot(reason, self.env_snapshot_detail());
        self.session.record_env_snapshot(snapshot.clone());
        if !self.session.messages.is_empty() {
            self.persist_session_best_effort("environment snapshot");
        }
        if let Ok(json) = serde_json::to_string(&snapshot) {
            logging::info(&format!("ENV_SNAPSHOT {}", json));
        } else {
            logging::info("ENV_SNAPSHOT {}");
        }
    }

    pub(super) fn env_snapshot_detail(&self) -> EnvSnapshotDetail {
        if self.session.visible_conversation_message_count() == 0 {
            EnvSnapshotDetail::Minimal
        } else {
            EnvSnapshotDetail::Full
        }
    }

    pub(super) fn build_env_snapshot(
        &self,
        reason: &str,
        detail: EnvSnapshotDetail,
    ) -> EnvSnapshot {
        let (jcode_git_hash, jcode_git_dirty) = match detail {
            EnvSnapshotDetail::Full => JCODE_REPO_SOURCE_STATE.clone(),
            EnvSnapshotDetail::Minimal => (None, None),
        };

        let working_dir = self.session.working_dir.clone();
        let working_git = match detail {
            EnvSnapshotDetail::Full => working_dir.as_deref().and_then(|dir| {
                cached_git_state_for_dir(Path::new(dir), super::utils::git_state_for_dir)
            }),
            EnvSnapshotDetail::Minimal => None,
        };

        EnvSnapshot {
            captured_at: Utc::now(),
            reason: reason.to_string(),
            session_id: self.session.id.clone(),
            working_dir,
            provider: self.provider.name().to_string(),
            model: self.provider.model().to_string(),
            jcode_version: jcode_build_meta::version().to_string(),
            jcode_git_hash,
            jcode_git_dirty,
            os: std::env::consts::OS.to_string(),
            arch: std::env::consts::ARCH.to_string(),
            pid: std::process::id(),
            is_selfdev: self.session.is_self_dev(),
            is_debug: self.session.is_debug,
            is_canary: self.session.is_canary,
            testing_build: self.session.testing_build.clone(),
            working_git,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::message::{Message, ToolDefinition};
    use crate::provider::{EventStream, Provider};
    use crate::tool::Registry;
    use anyhow::Result;
    use async_trait::async_trait;
    use std::sync::Arc;

    /// A stand-in for the multiplexing OpenRouter slot: the machine-facing
    /// `name()` is the transport, while the runtime it executes is a direct
    /// OpenAI-compatible profile. A concrete runtime instance reports the
    /// lowercase `openrouter` instead; both tag the same sessions.
    struct MultiplexedSlotProvider;

    #[async_trait]
    impl Provider for MultiplexedSlotProvider {
        async fn complete(
            &self,
            _messages: &[Message],
            _tools: &[ToolDefinition],
            _system: &str,
            _resume_session_id: Option<&str>,
        ) -> Result<EventStream> {
            Err(anyhow::anyhow!(
                "the log context test never completes a call"
            ))
        }

        fn name(&self) -> &str {
            "OpenRouter"
        }

        fn display_name(&self) -> String {
            "DeepSeek".to_string()
        }

        fn fork(&self) -> Arc<dyn Provider> {
            Arc::new(MultiplexedSlotProvider)
        }
    }

    /// The log prefix must name the profile the session talks to. `name()` is
    /// the transport slot that also serves every direct OpenAI-compatible
    /// profile, so it tagged DeepSeek sessions as `prv:openrouter` (issue #1286).
    #[tokio::test]
    async fn log_context_names_the_profile_not_the_transport_slot() {
        // `Agent::new` only builds in-memory session state, so the test needs
        // no `JCODE_HOME`, and it must not set one either: the crate's tests
        // run in parallel.
        let provider: Arc<dyn Provider> = Arc::new(MultiplexedSlotProvider);
        let registry = Registry::new(provider.clone()).await;
        let agent = Agent::new(provider, registry);

        agent.set_log_context();

        let context = logging::current_context_snapshot();
        assert_eq!(
            context.provider.as_deref(),
            Some("DeepSeek"),
            "the log prefix must name the profile, not the slot"
        );
    }
}

```

### Core Architecture Module: `crates/jcode-app-core/src/agent/inline_tail.rs`
```
//! Rolling live-output tail for inline swarm workers.
//!
//! The coordinator's inline gallery/dock renders a small viewport of each
//! worker's recent activity. Streaming only the in-progress assistant text
//! had two failure modes:
//!
//! 1. Workers spend most wall-clock time inside tool calls, during which no
//!    text streams, so the viewport froze on stale prose for the duration.
//! 2. `text_content` resets on every API call, so the viewport blanked at
//!    each turn/continuation boundary.
//!
//! [`InlineTailBuffer`] fixes both: it keeps a rolling, capped buffer of
//! *committed* activity lines (finished text segments and tool markers) that
//! survives across turns, plus the current *live* streaming text segment.
//! Tool executions are interleaved as `⚙ name · summary` markers, updated in
//! place with a duration or error state on completion.

use std::collections::VecDeque;

/// Max committed lines retained (matches the gallery viewport budget).
const MAX_LINES: usize = 14;
/// Max total characters in the rendered tail (bus payload cap).
const MAX_CHARS: usize = 1400;
/// Max characters of a tool marker's input summary.
const MAX_SUMMARY_CHARS: usize = 60;

/// Rolling tail of a worker's recent activity: committed lines (text +
/// tool markers) plus the live in-progress assistant text.
#[derive(Debug, Default)]
pub(crate) struct InlineTailBuffer {
    /// Finished activity lines, oldest first, capped to [`MAX_LINES`].
    committed: VecDeque<String>,
    /// In-progress assistant text for the current stream (replaced wholesale
    /// on every delta, committed at message end, discarded on rollback).
    live: String,
    /// Whether the last committed line is an in-flight tool marker that
    /// [`Self::finish_tool`] should update in place.
    pending_tool_marker: bool,
}

impl InlineTailBuffer {
    /// Replace the live streaming text with the accumulated `text` so far.
    pub(crate) fn set_live(&mut self, text: &str) {
        self.live.clear();
        self.live.push_str(text);
    }

    /// Commit the live text into the rolling buffer (end of a message) and
    /// clear it. Empty/whitespace-only live text is discarded.
    pub(crate) fn commit_live(&mut self) {
        let live = std::mem::take(&mut self.live);
        for line in live.lines().filter(|l| !l.trim().is_empty()) {
            self.push_committed(line.to_string());
        }
    }

    /// Discard the live text (mid-stream retry rollback replays from the top).
    pub(crate) fn clear_live(&mut self) {
        self.live.clear();
    }

    /// Record a tool execution starting. Any live text is committed first so
    /// ordering in the tail matches what actually happened.
    pub(crate) fn start_tool(&mut self, name: &str, input: &serde_json::Value) {
        self.commit_live();
        let summary = tool_marker_summary(name, input);
        let marker = if summary.is_empty() {
            format!("⚙ {name}")
        } else {
            format!("⚙ {name} · {summary}")
        };
        self.push_committed(marker);
        self.pending_tool_marker = true;
    }

    /// Record the in-flight tool finishing, updating its marker in place with
    /// a duration (and error flag). If the marker was already evicted by
    /// buffer pressure, this is a no-op.
    pub(crate) fn finish_tool(&mut self, elapsed_secs: f64, is_error: bool) {
        if !self.pending_tool_marker {
            return;
        }
        self.pending_tool_marker = false;
        if let Some(last) = self.committed.back_mut() {
            let status = if is_error { " ✗" } else { "" };
            last.push_str(&format!(" ({}){status}", humanize_secs(elapsed_secs)));
        }
    }

    /// Render the tail for the bus: committed lines then live lines, bounded
    /// to the last [`MAX_LINES`] lines / [`MAX_CHARS`] chars.
    pub(crate) fn render(&self) -> String {
        let live_lines = self
            .live
            .lines()
            .filter(|l| !l.trim().is_empty())
            .collect::<Vec<_>>();
        let mut lines: Vec<&str> = self
            .committed
            .iter()
            .map(String::as_str)
            .chain(live_lines)
            .collect();
        if lines.len() > MAX_LINES {
            lines.drain(..lines.len() - MAX_LINES);
        }
        let mut tail = lines.join("\n");
        if tail.len() > MAX_CHARS {
            let start = floor_char_boundary(&tail, tail.len() - MAX_CHARS);
            tail = tail[start..].to_string();
        }
        tail
    }

    fn push_committed(&mut self, line: String) {
        // A new committed line supersedes any pending in-place marker update
        // ordering (finish_tool only touches the true last line).
        self.pending_tool_marker = false;
        self.committed.push_back(line);
        while self.committed.len() > MAX_LINES {
            self.committed.pop_front();
        }
    }
}

/// Compact one-line summary of a tool's input for the activity marker.
/// Prefers the model-provided `intent`, then well-known per-tool fields.
fn tool_marker_summary(name: &str, input: &serde_json::Value) -> String {
    let raw = jcode_message_types::ToolCall::intent_from_input(input)
        .or_else(|| {
            let field = match name {
                "bash" => "command",
                "read" | "write" => "file_path",
                "edit" | "multiedit" => "file_path",
                "replace" => "pattern",
                "agentgrep" | "websearch" => "query",
                "webfetch" => "url",
                "task" | "subagent" => "description",
                _ => return None,
            };
            input
                .get(field)
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })
        .unwrap_or_default();
    let flat = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if flat.chars().count() > MAX_SUMMARY_CHARS {
        let mut out: String = flat.chars().take(MAX_SUMMARY_CHARS - 1).collect();
        out.push('…');
        out
    } else {
        flat
    }
}

/// "3s" / "2m10s" style duration for tool markers.
fn humanize_secs(secs: f64) -> String {
    if secs < 10.0 {
        format!("{secs:.1}s")
    } else if secs < 60.0 {
        format!("{}s", secs as u64)
    } else {
        let total = secs as u64;
        format!("{}m{}s", total / 60, total % 60)
    }
}

/// Largest byte index `<= index` that is a UTF-8 char boundary in `text`.
fn floor_char_boundary(text: &str, index: usize) -> usize {
    if index >= text.len() {
        return text.len();
    }
    let mut boundary = index;
    while boundary > 0 && !text.is_char_boundary(boundary) {
        boundary -= 1;
    }
    boundary
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn live_text_renders_and_survives_commit() {
        let mut tail = InlineTailBuffer::default();
        tail.set_live("thinking about the fix\nsecond line");
        assert_eq!(tail.render(), "thinking about the fix\nsecond line");
        tail.commit_live();
        // Next stream starts blank but the previous output is retained.
        tail.set_live("");
        assert_eq!(tail.render(), "thinking about the fix\nsecond line");
    }

    #[test]
    fn tool_markers_interleave_and_complete_in_place() {
        let mut tail = InlineTailBuffer::default();
        tail.set_live("Let me check the render pipeline.");
        tail.start_tool(
            "bash",
            &serde_json::json!({"command": "cargo build --profile selfdev"}),
        );
        let mid = tail.render();
        assert!(
            mid.contains("Let me check the render pipeline."),
            "live text must commit before the marker: {mid}"
        );
        assert!(
            mid.contains("⚙ bash · cargo build --profile selfdev"),
            "{mid}"
        );

        tail.finish_tool(47.2, false);
        assert!(tail.render().contains("(47s)"), "{}", tail.render());

        tail.start_tool("edit", &serde_json::json!({"file_path": "src/ui.rs"}));
        tail.finish_tool(0.3, true);
        let done = tail.render();
        assert!(done.contains("⚙ edit · src/ui.rs (0.3s) ✗"), "{done}");
    }

    #[test]
    fn marker_prefers_intent_over_raw_input() {
        let mut tail = InlineTailBuffer::default();
        tail.start_tool(
            "bash",
            &serde_json::json!({"command": "x", "intent": "run the ui tests"}),
        );
        assert!(tail.render().contains("⚙ bash · run the ui tests"));
    }

    #[test]
    fn rollback_discards_live_but_keeps_committed() {
        let mut tail = InlineTailBuffer::default();
        tail.start_tool("read", &serde_json::json!({"file_path": "a.rs"}));
        tail.finish_tool(0.1, false);
        tail.set_live("partial output that gets replayed");
        tail.clear_live();
        let out = tail.render();
        assert!(out.contains("⚙ read"), "{out}");
        assert!(!out.contains("partial output"), "{out}");
    }

    #[test]
    fn caps_lines_and_chars_and_summary_length() {
        let mut tail = InlineTailBuffer::default();
        for i in 0..40 {
            tail.set_live(&format!("line number {i}"));
            tail.commit_live();
        }
        let out = tail.render();
        assert!(out.lines().count() <= MAX_LINES);
        assert!(out.contains("line number 39"));
        assert!(!out.contains("line number 0\n"));

        let huge = "x".repeat(5000);
        tail.set_live(&huge);
        assert!(tail.render().len() <= MAX_CHARS);

        let mut tail = InlineTailBuffer::default();
        let long_cmd = "cargo test ".repeat(30);
        tail.start_tool("bash", &serde_json::json!({ "command": long_cmd }));
        let line = tail.render();
        assert!(line.chars().count() < 80, "summary must truncate: {line}");
        assert!(line.contains('…'), "{line}");
    }

    #[test]
    fn finish_without_pending_marker_is_noop() {
        let mut tail = InlineTailBuffer::default();
        tail.se
```

### Core Architecture Module: `crates/jcode-app-core/src/agent/interrupts.rs`
```
use super::Agent;
use crate::logging;
use crate::message::{ContentBlock, Role};
use crate::protocol::ServerEvent;
use crate::session::StoredDisplayRole;
use anyhow::Result;
use jcode_agent_runtime::{
    InterruptSignal, SoftInterruptMessage, SoftInterruptQueue, SoftInterruptSource,
};
use std::sync::Arc;

fn soft_interrupt_session_display_role(source: SoftInterruptSource) -> Option<StoredDisplayRole> {
    match source {
        SoftInterruptSource::User => None,
        SoftInterruptSource::System => Some(StoredDisplayRole::System),
        SoftInterruptSource::BackgroundTask => Some(StoredDisplayRole::BackgroundTask),
    }
}

fn soft_interrupt_protocol_display_role(source: SoftInterruptSource) -> Option<String> {
    match source {
        SoftInterruptSource::User => None,
        SoftInterruptSource::System => Some("system".to_string()),
        SoftInterruptSource::BackgroundTask => Some("background_task".to_string()),
    }
}

#[derive(Debug, Clone)]
pub(super) struct InjectedSoftInterrupt {
    pub(super) content: String,
    pub(super) source: SoftInterruptSource,
}

pub(super) enum NoToolCallOutcome {
    Break,
    ContinueWithoutEvent,
    ContinueWithSoftInterrupt {
        injected: Vec<InjectedSoftInterrupt>,
        point: &'static str,
    },
}

pub(super) enum PostToolInterruptOutcome {
    NoInterrupt,
    SoftInterrupt {
        injected: Vec<InjectedSoftInterrupt>,
        point: &'static str,
    },
}

impl Agent {
    pub fn restore_persisted_soft_interrupts(&self) -> usize {
        let restored = match crate::soft_interrupt_store::take(self.session_id()) {
            Ok(items) => items,
            Err(err) => {
                logging::warn(&format!(
                    "Failed to restore persisted soft interrupts for {}: {}",
                    self.session_id(),
                    err
                ));
                return 0;
            }
        };

        if restored.is_empty() {
            return 0;
        }

        let restored_count = restored.len();
        if let Ok(mut queue) = self.soft_interrupt_queue.lock() {
            queue.extend(restored);
        } else {
            logging::warn(&format!(
                "Failed to restore persisted soft interrupts for {} because queue lock was poisoned",
                self.session_id()
            ));
            return 0;
        }

        logging::info(&format!(
            "Restored {} persisted soft interrupt(s) for session {}",
            restored_count,
            self.session_id()
        ));
        restored_count
    }

    pub fn persist_soft_interrupt_snapshot(&self) {
        let pending = match self.soft_interrupt_queue.lock() {
            Ok(queue) => queue.clone(),
            Err(_) => {
                logging::warn(&format!(
                    "Failed to snapshot soft interrupts for {} because queue lock was poisoned",
                    self.session_id()
                ));
                return;
            }
        };

        if let Err(err) = crate::soft_interrupt_store::overwrite(self.session_id(), &pending) {
            logging::warn(&format!(
                "Failed to persist {} soft interrupt(s) for {}: {}",
                pending.len(),
                self.session_id(),
                err
            ));
        }
    }

    /// Add a swarm alert to be injected into the next turn
    pub fn push_alert(&mut self, alert: String) {
        self.pending_alerts.push(alert);
    }

    /// Take all pending alerts (clears the queue)
    pub fn take_alerts(&mut self) -> Vec<String> {
        std::mem::take(&mut self.pending_alerts)
    }

    /// Queue a soft interrupt message to be injected at the next safe point.
    /// This method can be called even while the agent is processing (uses separate lock).
    pub fn queue_soft_interrupt(
        &self,
        content: String,
        images: Vec<(String, String)>,
        urgent: bool,
        source: SoftInterruptSource,
    ) {
        let content_bytes = content.len();
        let content_chars = content.chars().count();
        let image_count = images.len();
        if let Ok(mut queue) = self.soft_interrupt_queue.lock() {
            let pending_before = queue.len();
            queue.push(SoftInterruptMessage {
                content,
                images,
                urgent,
                source,
            });
            logging::info(&format!(
                "AGENT_SOFT_INTERRUPT_QUEUE_PUSH session={} source={:?} urgent={} content_bytes={} content_chars={} image_count={} pending_before={} pending_after={}",
                self.session_id(),
                source,
                urgent,
                content_bytes,
                content_chars,
                image_count,
                pending_before,
                queue.len()
            ));
        } else {
            logging::warn(&format!(
                "AGENT_SOFT_INTERRUPT_QUEUE_PUSH_FAILED session={} source={:?} urgent={} content_bytes={} content_chars={} image_count={} reason=queue_lock_poisoned",
                self.session_id(),
                source,
                urgent,
                content_bytes,
                content_chars,
                image_count
            ));
        }
    }

    /// Get a handle to the soft interrupt queue.
    /// The server can use this to queue interrupts without holding the agent lock.
    pub fn soft_interrupt_queue(&self) -> SoftInterruptQueue {
        Arc::clone(&self.soft_interrupt_queue)
    }

    /// Get a handle to the background tool signal.
    /// The server can use this to signal "move tool to background" without holding the agent lock.
    pub fn background_tool_signal(&self) -> InterruptSignal {
        self.background_tool_signal.clone()
    }

    pub fn graceful_shutdown_signal(&self) -> InterruptSignal {
        self.graceful_shutdown.clone()
    }

    pub fn request_graceful_shutdown(&self) {
        self.graceful_shutdown.fire();
    }

    pub(super) fn is_graceful_shutdown(&self) -> bool {
        self.graceful_shutdown.is_set()
    }

    /// Check if there are pending soft interrupts
    pub fn has_soft_interrupts(&self) -> bool {
        self.soft_interrupt_queue
            .lock()
            .map(|q| !q.is_empty())
            .unwrap_or(false)
    }

    /// Check if there's an urgent soft interrupt that should skip remaining tools
    pub fn has_urgent_interrupt(&self) -> bool {
        self.soft_interrupt_queue
            .lock()
            .map(|q| q.iter().any(|m| m.urgent))
            .unwrap_or(false)
    }

    /// Get count of queued soft interrupts
    pub fn soft_interrupt_count(&self) -> usize {
        self.soft_interrupt_queue
            .lock()
            .map(|q| q.len())
            .unwrap_or(0)
    }

    /// Get count of pending alerts
    pub fn pending_alert_count(&self) -> usize {
        self.pending_alerts.len()
    }

    /// Get pending alerts (for debug visibility)
    pub fn pending_alerts_preview(&self) -> Vec<String> {
        self.pending_alerts
            .iter()
            .take(10)
            .map(|s| {
                if s.len() > 100 {
                    format!("{}...", crate::util::truncate_str(s, 100))
                } else {
                    s.clone()
                }
            })
            .collect()
    }

    /// Get comprehensive debug info about agent internal state
    pub fn debug_info(&self) -> serde_json::Value {
        serde_json::json!({
            "provider": self.provider.name(),
            "model": self.provider.model(),
            "provider_session_id": self.provider_session_id,
            "last_upstream_provider": self.last_upstream_provider,
            "last_connection_type": self.last_connection_type,
            "active_skill": self.active_skill,
            "allowed_tools": self.allowed_tools,
            "disabled_tools": self.disabled_tools,
            "session": {
                "id": self.session.id,
                "is_canary": self.session.is_canary,
                "model": self.session.model,
                "working_dir": self.session.working_dir,
                "message_count": self.session.messages.len(),
            },
            "interrupts": {
                "soft_interrupt_count": self.soft_interrupt_count(),
                "has_urgent": self.has_urgent_interrupt(),
                "pending_alert_count": self.pending_alert_count(),
                "soft_interrupts": self.soft_interrupts_preview(),
                "pending_alerts": self.pending_alerts_preview(),
            },
            "cache_tracker": {
                "turn_count": self.cache_tracker.turn_count(),
                "had_violation": self.cache_tracker.had_violation(),
            },
            "features": {
                "memory_enabled": self.memory_enabled,
            },
            "token_usage": {
                "input": self.last_usage.input_tokens,
                "output": self.last_usage.output_tokens,
                "cache_read": self.last_usage.cache_read_input_tokens,
                "cache_write": self.last_usage.cache_creation_input_tokens,
            },
        })
    }

    pub fn debug_memory_profile(&self) -> serde_json::Value {
        let process = crate::process_memory::snapshot_with_source("agent:memory");
        let soft_interrupt_text_bytes: usize = self
            .soft_interrupt_queue
            .lock()
            .map(|queue| queue.iter().map(|msg| msg.content.len()).sum())
            .unwrap_or(0);
        let pending_alert_text_bytes: usize =
            self.pending_alerts.iter().map(|alert| alert.len()).sum();

        serde_json::json!({
            "process": process,
            "session": self.session.debug_memory_profile(),
            "interrupts": {
                "soft_interrupt_count": self.soft_interrupt_count(),
                "soft_interrupt_text_bytes": soft_interrupt_text_bytes,
                "pending_alert_count": self.pending_alert_
```

### Core Architecture Module: `crates/jcode-app-core/src/agent/messages.rs`
```
use super::*;

impl Agent {
    pub(crate) fn add_message(&mut self, role: Role, content: Vec<ContentBlock>) -> String {
        let id = self.session.add_message(role, content);
        let compaction = self.registry.compaction();
        if let Ok(mut manager) = compaction.try_write() {
            if let Some(message) = self.session.messages.last() {
                manager.notify_message_added_blocks(&message.content);
            } else {
                manager.notify_message_added();
            }
        }
        id
    }

    pub(crate) fn add_message_with_display_role(
        &mut self,
        role: Role,
        content: Vec<ContentBlock>,
        display_role: Option<StoredDisplayRole>,
    ) -> String {
        let id = self
            .session
            .add_message_with_display_role(role, content, display_role);
        let compaction = self.registry.compaction();
        if let Ok(mut manager) = compaction.try_write() {
            if let Some(message) = self.session.messages.last() {
                manager.notify_message_added_blocks(&message.content);
            } else {
                manager.notify_message_added();
            }
        }
        id
    }

    pub(crate) fn add_message_with_duration(
        &mut self,
        role: Role,
        content: Vec<ContentBlock>,
        duration_ms: Option<u64>,
    ) -> String {
        let id = self
            .session
            .add_message_with_duration(role, content, duration_ms);
        let compaction = self.registry.compaction();
        if let Ok(mut manager) = compaction.try_write() {
            if let Some(message) = self.session.messages.last() {
                manager.notify_message_added_blocks(&message.content);
            } else {
                manager.notify_message_added();
            }
        }
        id
    }

    pub(crate) fn add_message_ext(
        &mut self,
        role: Role,
        content: Vec<ContentBlock>,
        duration_ms: Option<u64>,
        token_usage: Option<crate::session::StoredTokenUsage>,
    ) -> String {
        let id = self
            .session
            .add_message_ext(role, content, duration_ms, token_usage);
        let compaction = self.registry.compaction();
        if let Ok(mut manager) = compaction.try_write() {
            if let Some(message) = self.session.messages.last() {
                manager.notify_message_added_blocks(&message.content);
            } else {
                manager.notify_message_added();
            }
        }
        id
    }
}

```

### Core Architecture Module: `crates/jcode-app-core/src/agent/prompting.rs`
```
use super::Agent;
use crate::logging;
use crate::message::{Message, ToolDefinition};

impl Agent {
    /// Explicitly prepare/freeze the same tool surface used by provider turns.
    /// Unlike `debug_context`, this may update the tool cache. It never calls a provider.
    pub async fn prepare_debug_context(&mut self) -> serde_json::Value {
        let prepared_tools = self.tool_definitions().await;
        let mut context = self.debug_context().await;
        context["prepared_tools"] = serde_json::json!(prepared_tools);
        context
    }

    /// Inspect the next request's static context without inference, prewarming,
    /// or locking a new tool snapshot. Pending memory is deliberately not consumed.
    pub async fn debug_context(&self) -> serde_json::Value {
        let prompt = self.build_system_prompt_split(None);
        let current_tools = self.tool_definitions_for_debug().await;
        let effective_tools = self.locked_tools.as_ref().unwrap_or(&current_tools);
        let locked_tool_names = self.locked_tools.as_ref().map(|tools| {
            tools
                .iter()
                .map(|tool| tool.name.as_str())
                .collect::<Vec<_>>()
        });
        serde_json::json!({
            "session_id": self.session.id,
            "working_dir": self.session.working_dir,
            "mode": if self.is_desktop_selfdev() { "desktop" }
                else if self.session.is_canary { "cli" } else { "regular" },
            "is_canary": self.session.is_canary,
            "system_prompt": {
                "static": prompt.static_part,
                "dynamic": prompt.dynamic_part,
                "pending_memory_included": false,
            },
            "tools_locked": self.locked_tools.is_some(),
            "locked_tool_names": locked_tool_names,
            "effective_tools": effective_tools,
            "current_tools": current_tools,
        })
    }

    pub(super) fn log_prompt_prefix_accounting(
        &self,
        split: &crate::prompt::SplitSystemPrompt,
        tools: &[ToolDefinition],
    ) {
        let system_tokens = split.estimated_tokens();
        let tool_tokens = ToolDefinition::aggregate_prompt_token_estimate(tools);
        let prefix_tokens = system_tokens + tool_tokens;
        logging::info(&format!(
            "Prompt prefix estimate: total={} tokens (system={} tools={})",
            prefix_tokens, system_tokens, tool_tokens
        ));
    }

    pub(super) fn build_memory_prompt_nonblocking_shared(
        &self,
        messages: std::sync::Arc<[Message]>,
        _memory_event_tx: Option<crate::memory::MemoryEventSink>,
    ) -> Option<crate::memory::PendingMemory> {
        if !self.memory_enabled {
            return None;
        }

        let session_id = &self.session.id;

        let fresh_user_turn = crate::message::ends_with_fresh_user_turn(&messages);
        let pending = if fresh_user_turn {
            crate::memory::take_pending_memory_for_project(
                session_id,
                self.session.working_dir.as_deref(),
            )
        } else {
            None
        };

        // Use the persistent memory-agent pipeline as the single source of truth.
        // Running both this and the legacy MemoryManager background retrieval path
        // can prepare overlapping pending prompts for the same turn, which makes
        // memory injection feel overly aggressive.
        // Relevance results are consumed only at the start of a fresh user turn.
        // Enqueuing again after every tool result runs the local embedding model
        // for each provider continuation without creating an additional injection
        // opportunity. One update per user turn keeps memory current while avoiding
        // redundant 512-token inference during tool-heavy agent loops.
        if fresh_user_turn {
            crate::memory_agent::update_context_sync_with_dir(
                session_id,
                messages,
                self.session.working_dir.clone(),
            );
        }

        pending
    }

    fn append_current_turn_system_reminder(&self, split: &mut crate::prompt::SplitSystemPrompt) {
        let Some(reminder) = self
            .current_turn_system_reminder
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        else {
            return;
        };

        if !split.dynamic_part.is_empty() {
            split.dynamic_part.push_str("\n\n");
        }
        split.dynamic_part.push_str("# System Reminder\n\n");
        split.dynamic_part.push_str(reminder);
    }

    /// Build split system prompt for better caching
    /// Returns static (cacheable) and dynamic (not cached) parts separately
    pub(super) fn build_system_prompt_split(
        &self,
        memory_prompt: Option<&str>,
    ) -> crate::prompt::SplitSystemPrompt {
        if let Some(ref override_prompt) = self.session.system_prompt {
            return crate::prompt::SplitSystemPrompt {
                static_part: override_prompt.clone(),
                dynamic_part: String::new(),
            };
        }

        let skills = self.current_skills_snapshot();
        let skill_prompt = self
            .active_skill
            .as_ref()
            .and_then(|name| skills.get(name).map(|skill| skill.get_prompt().to_string()));

        // Frozen per session so skill installs never rewrite the cached
        // system prefix. Later installs are announced in the transcript.
        let available_skills = &self.prompt_skills_snapshot;

        let working_dir = self
            .session
            .working_dir
            .as_ref()
            .map(std::path::PathBuf::from);

        let (mut split, _context_info) = crate::prompt::build_system_prompt_split_with_agents_md(
            skill_prompt.as_deref(),
            available_skills,
            self.session.is_canary,
            memory_prompt,
            working_dir.as_deref(),
            self.agents_md_snapshot.clone(),
        );

        self.append_current_turn_system_reminder(&mut split);
        crate::prompt::append_swarm_effort_directive(
            &mut split,
            self.provider.reasoning_effort().as_deref(),
        );

        split
    }

    /// Non-blocking memory prompt - takes pending result and spawns check for next turn
    #[cfg(test)]
    pub(super) fn build_memory_prompt_nonblocking(
        &self,
        messages: &[Message],
        _memory_event_tx: Option<crate::memory::MemoryEventSink>,
    ) -> Option<crate::memory::PendingMemory> {
        self.build_memory_prompt_nonblocking_shared(messages.to_vec().into(), _memory_event_tx)
    }
}

```

### Core Architecture Module: `crates/jcode-app-core/src/agent/provider.rs`
```
use super::*;

impl Agent {
    pub fn set_premium_mode(&self, mode: crate::provider::copilot::PremiumMode) {
        self.provider.set_premium_mode(mode);
    }

    pub fn premium_mode(&self) -> crate::provider::copilot::PremiumMode {
        self.provider.premium_mode()
    }

    pub fn provider_fork(&self) -> Arc<dyn Provider> {
        self.provider.fork()
    }

    pub fn provider_handle(&self) -> Arc<dyn Provider> {
        Arc::clone(&self.provider)
    }

    pub fn available_models(&self) -> Vec<&'static str> {
        self.provider.available_models()
    }

    pub fn available_models_for_switching(&self) -> Vec<String> {
        self.provider.available_models_for_switching()
    }

    pub fn available_models_display(&self) -> Vec<String> {
        self.provider.available_models_display()
    }

    pub fn model_routes(&self) -> Vec<crate::provider::ModelRoute> {
        let mut routes = self.provider.model_routes();
        crate::model_usage::enrich_routes(&mut routes);
        routes
    }

    pub(super) fn begin_model_usage_turn(&mut self, message_id: &str) {
        self.session.model_usage_turn_id = Some(format!("{}:{}", self.session.id, message_id));
    }

    pub(super) fn model_usage_turn_id(&mut self) -> String {
        if let Some(id) = &self.session.model_usage_turn_id {
            return id.clone();
        }
        // Old sessions and direct loop callers have no durable anchor yet.
        // Internal reminders and tool-result rows do not start a logical turn.
        let message_id = self
            .session
            .visible_conversation_messages()
            .into_iter()
            .rev()
            .find(|message| {
                message.role == Role::User
                    && message.content.iter().any(|block| {
                        matches!(block, ContentBlock::Text { text, .. }
                    if !text.trim().is_empty() && !text.starts_with("[System reminder:"))
                            || matches!(block, ContentBlock::Image { .. })
                    })
            })
            .map(|message| message.id.clone())
            .unwrap_or_else(|| "initial".to_string());
        self.begin_model_usage_turn(&message_id);
        self.session.model_usage_turn_id.clone().unwrap()
    }

    pub(super) fn record_model_turn_usage(&self, turn_id: &str) {
        if self.session.is_debug {
            return;
        }
        let Some(mut route) = crate::model_usage::serving_route(
            self.provider.as_ref(),
            self.session.route_api_method.as_deref(),
        ) else {
            return;
        };
        match crate::model_usage::record_turn(turn_id, &route) {
            Ok(usage) => {
                route.usage = Some(usage);
                Bus::global().publish(BusEvent::ModelUsageUpdated(route));
            }
            Err(error) => logging::warn(&format!("Could not record model turn usage: {error}")),
        }
    }

    pub fn model_catalog_snapshot(&self) -> jcode_provider_core::ModelCatalogSnapshot {
        jcode_provider_core::ModelCatalogSnapshot::new(
            Some(self.provider_name()),
            Some(self.provider_model()),
            self.available_models_display(),
            self.model_routes(),
        )
    }

    pub fn registry(&self) -> Registry {
        self.registry.clone()
    }

    pub async fn compaction_mode(&self) -> crate::config::CompactionMode {
        self.registry.compaction().read().await.mode()
    }

    pub async fn set_compaction_mode(&self, mode: crate::config::CompactionMode) -> Result<()> {
        let compaction = self.registry.compaction();
        let mut manager = compaction.write().await;
        manager.set_mode(mode);
        Ok(())
    }

    fn refresh_compaction_budget(&self) {
        let compaction = self.registry.compaction();
        match compaction.try_write() {
            Ok(mut manager) => manager.set_budget(self.provider.context_window()),
            Err(_) => crate::logging::warn(
                "Could not refresh compaction token budget after provider change: compaction manager is busy",
            ),
        }
    }

    /// The context window the server resolves for the active route.
    ///
    /// Sent to clients on `ModelChanged` so a remote panel does not have to
    /// derive it from its own inert provider, which carries no model catalog and
    /// therefore always answers the generic default.
    pub fn provider_context_window(&self) -> usize {
        self.provider.context_window()
    }

    #[cfg(test)]
    pub(crate) async fn compaction_token_budget(&self) -> usize {
        self.registry.compaction().read().await.token_budget()
    }

    pub fn provider_messages(&mut self) -> Vec<Message> {
        self.session.messages_for_provider()
    }

    pub fn set_model(&mut self, model: &str) -> Result<()> {
        self.set_model_from_provider_state_event(
            model,
            crate::provider::ProviderModelSelectionSource::User,
        )
    }

    pub fn set_route_selection(
        &mut self,
        selection: &crate::provider::RouteSelection,
    ) -> Result<()> {
        self.set_route_selection_from_provider_state_event(
            selection,
            crate::provider::ProviderModelSelectionSource::User,
        )
    }

    pub(crate) fn set_route_selection_from_auth(
        &mut self,
        selection: &crate::provider::RouteSelection,
    ) -> Result<()> {
        self.set_route_selection_from_provider_state_event(
            selection,
            crate::provider::ProviderModelSelectionSource::Auth,
        )
    }

    fn set_route_selection_from_provider_state_event(
        &mut self,
        selection: &crate::provider::RouteSelection,
        source: crate::provider::ProviderModelSelectionSource,
    ) -> Result<()> {
        self.provider.set_route_selection(selection)?;
        let resolved_model = self.provider.model();
        self.session.provider_key = Some(selection.runtime_key.stable_id());
        self.session.route_api_method = Some(selection.api_method.clone());
        self.session.model = Some(self.provider_model());
        let event = crate::provider::ProviderStateEvent::selected_model(source, resolved_model);
        self.provider_runtime_state.apply(event);
        self.refresh_compaction_budget();
        self.persist_session_best_effort("route selection");
        self.log_env_snapshot("set_route_selection");
        Ok(())
    }

    pub(crate) fn set_model_from_auth(&mut self, model: &str) -> Result<()> {
        self.set_model_from_provider_state_event(
            model,
            crate::provider::ProviderModelSelectionSource::Auth,
        )
    }

    fn set_model_from_provider_state_event(
        &mut self,
        model: &str,
        source: crate::provider::ProviderModelSelectionSource,
    ) -> Result<()> {
        crate::provider::set_model_with_auth_refresh(self.provider.as_ref(), model)?;
        let resolved_model = self.provider.model();
        self.session.provider_key =
            crate::provider::MultiProvider::session_provider_key_after_model_switch(
                model,
                self.provider.name(),
                self.session.provider_key.as_deref(),
            );
        self.session.model = Some(self.provider_model());
        let event = crate::provider::ProviderStateEvent::selected_model(source, resolved_model);
        self.provider_runtime_state.apply(event);
        self.refresh_compaction_budget();
        self.persist_session_best_effort("model selection");
        self.log_env_snapshot("set_model");
        Ok(())
    }

    pub(crate) fn provider_model_selection_generation(&self) -> u64 {
        self.provider_runtime_state.selection_generation()
    }

    pub(crate) fn user_selected_provider_model_after(&self, generation: u64) -> bool {
        self.provider_runtime_state.user_selected_after(generation)
    }

    pub fn restore_reasoning_effort_from_session(&mut self) {
        if let Some(effort) = self.session.reasoning_effort.clone() {
            if let Err(e) = self.provider.set_reasoning_effort(&effort) {
                crate::logging::error(&format!(
                    "Failed to restore session reasoning effort '{}': {}",
                    effort, e
                ));
            }
        } else {
            self.session.reasoning_effort = self.provider.reasoning_effort();
        }
        // Mirror the effort into the deadlock-free side-table so server handlers
        // (e.g. the swarm seed handler) can learn this session's effort without
        // taking the agent lock.
        crate::session_effort::record_session_effort(
            &self.session.id,
            self.session.reasoning_effort.as_deref(),
        );
    }

    pub fn set_reasoning_effort(&mut self, effort: &str) -> Result<Option<String>> {
        self.provider.set_reasoning_effort(effort)?;
        let current = self.provider.reasoning_effort();
        self.session.reasoning_effort = current.clone();
        // Keep the side-table in sync (see `restore_reasoning_effort_from_session`).
        crate::session_effort::record_session_effort(&self.session.id, current.as_deref());
        self.log_env_snapshot("set_reasoning_effort");
        self.session.save()?;
        Ok(current)
    }

    pub fn subagent_model(&self) -> Option<String> {
        self.session.subagent_model.clone()
    }

    pub fn set_subagent_model(&mut self, model: Option<String>) -> Result<()> {
        self.session.subagent_model = model;
        self.log_env_snapshot("set_subagent_model");
        self.session.save()?;
        Ok(())
    }

    pub fn session_provider_key(&self) -> Option<String> {
        self.session.provider_key.clone()
    }

    /// API method/runtime route used to select the active model (e.g.
    /// "openai-api", "claude-oauth", "openai-compatible:nvidia-nim"). Spawned
    /// swarm agents inherit this so they reconstruct the coordinator's exact
    /// aut
```

### Core Architecture Module: `crates/jcode-app-core/src/agent/response_recovery.rs`
```
use super::*;

/// A tool call that failed schema validation, kept so the correction and
/// terminal error can repeat exactly what the model did wrong.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MalformedToolCallInfo {
    /// Tool name exactly as the model sent it.
    pub(crate) name: String,
    /// The validation error that was returned to the model as the tool result.
    pub(crate) error: String,
}

impl Agent {
    fn parse_text_wrapped_tool_call(
        text: &str,
    ) -> Option<(String, String, serde_json::Value, String)> {
        let marker = "to=functions.";
        let marker_idx = text.find(marker)?;
        let after_marker = &text[marker_idx + marker.len()..];

        let mut tool_name_end = 0usize;
        for (idx, ch) in after_marker.char_indices() {
            if ch.is_ascii_alphanumeric() || ch == '_' {
                tool_name_end = idx + ch.len_utf8();
            } else {
                break;
            }
        }
        if tool_name_end == 0 {
            return None;
        }

        let tool_name = after_marker[..tool_name_end].to_string();
        let remaining = &after_marker[tool_name_end..];
        let mut fallback: Option<(String, String, serde_json::Value, String)> = None;

        for (brace_idx, ch) in remaining.char_indices() {
            if ch != '{' {
                continue;
            }
            let slice = &remaining[brace_idx..];
            let mut stream =
                serde_json::Deserializer::from_str(slice).into_iter::<serde_json::Value>();
            let parsed = match stream.next() {
                Some(Ok(value)) => value,
                Some(Err(_)) | None => continue,
            };
            let consumed = stream.byte_offset();
            if !parsed.is_object() {
                continue;
            }

            let prefix = text[..marker_idx].trim_end().to_string();
            let suffix = remaining[brace_idx + consumed..].trim().to_string();
            if suffix.is_empty() {
                return Some((prefix, tool_name.clone(), parsed, suffix));
            }
            if fallback.is_none() {
                fallback = Some((prefix, tool_name.clone(), parsed, suffix));
            }
        }

        fallback
    }

    pub(super) fn recover_text_wrapped_tool_call(
        &self,
        text_content: &mut String,
        tool_calls: &mut Vec<ToolCall>,
    ) -> bool {
        if !tool_calls.is_empty() || text_content.trim().is_empty() {
            return false;
        }

        let Some((prefix, tool_name, arguments, suffix)) =
            Self::parse_text_wrapped_tool_call(text_content)
        else {
            return false;
        };

        let mut sanitized = String::new();
        if !prefix.is_empty() {
            sanitized.push_str(&prefix);
        }
        if !suffix.is_empty() {
            if !sanitized.is_empty() {
                sanitized.push('\n');
            }
            sanitized.push_str(&suffix);
        }
        *text_content = sanitized;

        let call_id = format!("fallback_text_call_{}", id::new_id("call"));
        let recovered_total = RECOVERED_TEXT_WRAPPED_TOOL_CALLS
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed)
            + 1;
        logging::warn(&format!(
            "[agent] Recovered text-wrapped tool call for '{}' ({}, total={})",
            tool_name, call_id, recovered_total
        ));
        let intent = ToolCall::intent_from_input(&arguments);
        tool_calls.push(ToolCall {
            id: call_id,
            name: tool_name,
            input: arguments,
            intent,
            thought_signature: None,
        });

        true
    }

    pub(crate) fn should_continue_after_stop_reason(stop_reason: &str) -> bool {
        let reason = stop_reason.trim().to_ascii_lowercase();
        if reason.is_empty() {
            return false;
        }

        if matches!(reason.as_str(), "stop" | "end_turn" | "tool_use") {
            return false;
        }

        // Anthropic pauses long server-tool turns (web search) with
        // `pause_turn`; resending the conversation resumes them.
        Self::is_pause_turn_stop_reason(&reason)
            || reason.contains("incomplete")
            || reason.contains("max_output_tokens")
            || reason.contains("max_tokens")
            || reason.contains("length")
            || reason.contains("trunc")
            || reason.contains("commentary")
    }

    /// Anthropic `pause_turn`: the provider paused a long server-tool turn.
    pub(crate) fn is_pause_turn_stop_reason(stop_reason: &str) -> bool {
        stop_reason.trim().eq_ignore_ascii_case("pause_turn")
    }

    /// True when the provider's stop reason indicates a model-side
    /// guardrail/safety stop (e.g. Anthropic `refusal`), as opposed to a
    /// normal end-of-turn or truncation.
    pub(crate) fn is_guardrail_stop_reason(stop_reason: Option<&str>) -> bool {
        let Some(reason) = stop_reason else {
            return false;
        };
        let reason = reason.trim().to_ascii_lowercase();
        matches!(reason.as_str(), "refusal" | "content_filter" | "safety")
            || reason.contains("guardrail")
            || reason.contains("policy_violation")
    }

    pub(crate) const FABLE_GUARDRAIL_RECONSIDERATION_PROMPTS: [&'static str; 3] = [
        "Reassess the user's request using its full context and likely intent rather than isolated keywords. Determine whether answering would enable a concrete harmful action. If no specific safety concern applies, answer normally. Preserve the refusal only when it is genuinely warranted, and briefly identify the specific concern.",
        "Review the request again and distinguish legitimate coding, debugging, defensive, educational, or analytical work from instructions that facilitate harm. If only part of the request is unsafe, help with the safe portions and narrowly limit the rest instead of issuing a blanket refusal.",
        "Perform one final, independent policy check. Prefer a safe and useful constrained response when possible. Refuse only the specific content that creates a concrete safety risk; otherwise continue with the user's actual task. Do not weaken a refusal that remains genuinely necessary.",
    ];

    /// Try a small sequence of differently framed policy checks after Fable
    /// guardrails a response. Every prompt preserves warranted refusals, and the
    /// fixed suite size prevents an unbounded refusal/retry loop.
    pub(crate) fn maybe_reconsider_fable_guardrail(
        &mut self,
        stop_reason: Option<&str>,
        attempts: &mut u32,
    ) -> Result<bool> {
        let model = self.provider.model();
        if !Self::should_reconsider_fable_guardrail(
            &model,
            stop_reason,
            *attempts,
            Self::FABLE_GUARDRAIL_RECONSIDERATION_PROMPTS.len() as u32,
        ) {
            return Ok(false);
        }

        let prompt = Self::FABLE_GUARDRAIL_RECONSIDERATION_PROMPTS[*attempts as usize];
        *attempts += 1;
        logging::warn(&format!(
            "Fable 5 guardrail stopped the response (stop_reason={:?}); trying reconsideration prompt {}/{}",
            stop_reason,
            attempts,
            Self::FABLE_GUARDRAIL_RECONSIDERATION_PROMPTS.len(),
        ));
        self.add_message(
            Role::User,
            vec![ContentBlock::Text {
                text: prompt.to_string(),
                cache_control: None,
            }],
        );
        self.session.save()?;
        Ok(true)
    }

    pub(crate) fn should_reconsider_fable_guardrail(
        model: &str,
        stop_reason: Option<&str>,
        attempts: u32,
        max_attempts: u32,
    ) -> bool {
        Self::is_guardrail_stop_reason(stop_reason)
            && model.to_ascii_lowercase().contains("fable-5")
            && attempts < max_attempts
    }

    /// Builds the user-facing notice for a turn that ended with no visible
    /// assistant output (no text, no tool calls). Returns `None` when the turn
    /// looks normal and no notice should be surfaced.
    pub(crate) fn provider_guardrail_notice(
        stop_reason: Option<&str>,
        visible_text_empty: bool,
        had_reasoning: bool,
    ) -> Option<String> {
        let guardrail = Self::is_guardrail_stop_reason(stop_reason);
        if !guardrail && !visible_text_empty {
            return None;
        }
        let reason_label = stop_reason
            .map(str::trim)
            .filter(|r| !r.is_empty())
            .unwrap_or("unknown");
        if guardrail {
            return Some(format!(
                "Provider guardrail stopped the response (stop_reason: {}). The model declined to answer this request. Rephrasing, narrowing the request, or providing more context may help.",
                reason_label
            ));
        }
        // Empty visible output with a non-guardrail stop reason: still surface,
        // since the user otherwise sees nothing at all. Do not assert a content
        // filter here: in practice this is usually a transient upstream failure
        // (a dropped or empty stream), not a provider guardrail (issue #672).
        let reasoning_hint = if had_reasoning {
            " after producing only internal reasoning"
        } else {
            ""
        };
        Some(format!(
            "The model ended its turn without any visible output{} (stop_reason: {}). The provider returned an empty response; this is usually a transient upstream failure rather than a content filter. Retrying the request may help.",
            reasoning_hint, reason_label
        ))
    }

    /// Log-event label for an empty final turn: real guardrail stops keep the
    /// `PROVIDER_GUARDRAIL` name, transient empty responses get their own so
    /// the two are separable in logs (issue #672).
    pub(crate) fn empty_turn_log_event(stop_reason: Option<&str>) -> &'static str {
        if Self:
```

### Core Architecture Module: `crates/jcode-app-core/src/agent/status.rs`
```
use super::*;

impl Agent {
    /// Read-only source for splitting a new session before its first persistence.
    pub(crate) fn session_for_split(&self) -> &Session {
        &self.session
    }

    pub fn session_memory_profile_snapshot(
        &mut self,
    ) -> crate::session::SessionMemoryProfileSnapshot {
        self.session.memory_profile_snapshot()
    }

    pub fn message_count(&self) -> usize {
        self.session.messages.len()
    }

    /// Number of model-visible conversation messages (excludes the immutable
    /// session-context header and internal system reminders).
    pub fn visible_conversation_message_count(&self) -> usize {
        self.session.visible_conversation_message_count()
    }

    /// Role of the most recent model-visible conversation message, if any.
    ///
    /// When this is `User` and the agent is idle, the model still owes a
    /// response for that turn (e.g. the turn errored or was interrupted before
    /// the assistant replied).
    pub fn last_visible_conversation_role(&self) -> Option<Role> {
        self.session
            .visible_conversation_messages()
            .last()
            .map(|message| message.role.clone())
    }

    pub fn last_message_role(&self) -> Option<Role> {
        self.session.messages.last().map(|m| m.role.clone())
    }

    /// Get the text content of the last message (first Text block)
    pub fn last_message_text(&self) -> Option<&str> {
        self.session.messages.last().and_then(|m| {
            m.content.iter().find_map(|block| {
                if let ContentBlock::Text { text, .. } = block {
                    Some(text.as_str())
                } else {
                    None
                }
            })
        })
    }

    /// Build a transcript string for memory extraction
    /// This is a independent method so it can be called before spawning async tasks
    pub fn build_transcript_for_extraction(&self) -> String {
        let mut transcript = String::new();
        for msg in &self.session.messages {
            let role = match msg.role {
                Role::User => "User",
                Role::Assistant => "Assistant",
            };
            transcript.push_str(&format!("**{}:**\n", role));
            for block in &msg.content {
                match block {
                    ContentBlock::Text { text, .. } => {
                        transcript.push_str(text);
                        transcript.push('\n');
                    }
                    ContentBlock::ToolUse { name, .. } => {
                        transcript.push_str(&format!("[Used tool: {}]\n", name));
                    }
                    ContentBlock::ToolResult { content, .. } => {
                        let preview = if content.len() > 200 {
                            format!("{}...", crate::util::truncate_str(content, 200))
                        } else {
                            content.clone()
                        };
                        transcript.push_str(&format!("[Result: {}]\n", preview));
                    }
                    ContentBlock::Reasoning { .. }
                    | ContentBlock::ReasoningTrace { .. }
                    | ContentBlock::AnthropicThinking { .. }
                    | ContentBlock::OpenAIReasoning { .. }
                    | ContentBlock::ToolReference { .. }
                    | ContentBlock::ProviderNative { .. } => {}
                    ContentBlock::Image { .. } => {
                        transcript.push_str("[Image]\n");
                    }
                    ContentBlock::OpenAICompaction { .. } => {
                        transcript.push_str("[OpenAI native compaction]\n");
                    }
                }
            }
            transcript.push('\n');
        }
        transcript
    }

    pub fn last_assistant_text(&self) -> Option<String> {
        self.session
            .messages
            .iter()
            .rev()
            .find(|msg| msg.role == Role::Assistant)
            .map(|msg| {
                msg.content
                    .iter()
                    .filter_map(|c| {
                        if let ContentBlock::Text { text, .. } = c {
                            Some(text.clone())
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("\n")
            })
    }

    /// Latest non-empty assistant text added at or after `start_index`.
    pub fn latest_assistant_text_after(&self, start_index: usize) -> Option<String> {
        self.session
            .messages
            .iter()
            .enumerate()
            .rev()
            .find_map(|(index, message)| {
                if index < start_index || !matches!(&message.role, Role::Assistant) {
                    return None;
                }

                let text = message
                    .content
                    .iter()
                    .filter_map(|block| match block {
                        ContentBlock::Text { text, .. } => Some(text.as_str()),
                        _ => None,
                    })
                    .collect::<Vec<_>>()
                    .join("\n\n");
                let text = text.trim();
                (!text.is_empty()).then(|| text.to_string())
            })
    }

    pub fn last_upstream_provider(&self) -> Option<String> {
        self.last_upstream_provider
            .clone()
            .or_else(|| self.provider.preferred_provider())
    }

    pub fn last_connection_type(&self) -> Option<String> {
        self.last_connection_type.clone()
    }

    pub fn last_status_detail(&self) -> Option<String> {
        self.last_status_detail.clone()
    }

    pub fn provider_name(&self) -> String {
        // `display_name()` resolves the active runtime profile (e.g. NVIDIA NIM)
        // for the OpenRouter slot; for all other providers it equals `name()`.
        self.provider.display_name()
    }

    /// Reasoning effort the active provider is running with, if any.
    pub fn provider_reasoning_effort(&self) -> Option<String> {
        self.provider.reasoning_effort()
    }

    pub fn provider_model(&self) -> String {
        let model = self.provider.model();
        self.provider
            .explicit_provider_pin_for_current_model()
            .map(|pin| format!("{model}@{pin}"))
            .unwrap_or(model)
    }

    pub(super) fn provider_key_for_new_session(&self) -> Option<String> {
        if self
            .provider
            .explicit_provider_pin_for_current_model()
            .is_some()
        {
            // Provider pins are explicit OpenRouter route identity. Prefer that
            // over ambient runtime env state when a CLI-created Agent snapshots
            // a provider that was configured before the Agent existed.
            return crate::provider::MultiProvider::session_provider_key_for_model_request(
                &self.provider_model(),
                self.provider.name(),
            );
        }

        crate::session::derive_session_provider_key(self.provider.name())
    }

    pub(super) fn reconcile_explicit_provider_pin_route(&mut self) {
        if self
            .provider
            .explicit_provider_pin_for_current_model()
            .is_some()
        {
            self.session.model = Some(self.provider_model());
            self.session.provider_key = Some("openrouter".to_string());
            self.session.route_api_method = Some("openrouter".to_string());
        }
    }

    /// Get the short/friendly name for this session (e.g., "fox")
    pub fn session_short_name(&self) -> Option<&str> {
        self.session.short_name.as_deref()
    }
}

```

### Core Architecture Module: `crates/jcode-app-core/src/agent/streaming.rs`
```
use super::STREAM_KEEPALIVE_PONG_ID;
use crate::protocol::ServerEvent;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::{self, MissedTickBehavior};

fn stream_keepalive_interval() -> Duration {
    if cfg!(test) {
        Duration::from_millis(50)
    } else {
        Duration::from_secs(30)
    }
}

pub(super) fn stream_keepalive_ticker() -> time::Interval {
    let interval = stream_keepalive_interval();
    let mut ticker = time::interval_at(time::Instant::now() + interval, interval);
    ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);
    ticker
}

pub(super) fn send_stream_keepalive_mpsc(event_tx: &mpsc::UnboundedSender<ServerEvent>) {
    let _ = event_tx.send(ServerEvent::Pong {
        id: STREAM_KEEPALIVE_PONG_ID,
        native_ssh_protocol: None,
        capabilities: Vec::new(),
    });
}

```

### Core Architecture Module: `crates/jcode-app-core/src/agent/tools.rs`
```
use crate::message::{ContentBlock, ToolCall};
use crate::terminal_println as println;
use crate::tool::ToolOutput;

pub(super) const MAX_TOOL_OUTPUT_CHARS_FOR_HISTORY: usize = 512 * 1024;

pub(super) fn cap_tool_output_for_history(tool_name: &str, mut output: ToolOutput) -> ToolOutput {
    if output.output.chars().count() <= MAX_TOOL_OUTPUT_CHARS_FOR_HISTORY {
        return output;
    }

    let original_chars = output.output.chars().count();
    let kept = crate::util::truncate_str(&output.output, MAX_TOOL_OUTPUT_CHARS_FOR_HISTORY);
    output.output = format!(
        "{}\n\n[Tool output truncated by jcode: tool `{}` produced {} chars; kept first {} chars to protect the remote protocol, session history, and prompt cache. Redirect large logs to a file and read targeted sections.]",
        kept, tool_name, original_chars, MAX_TOOL_OUTPUT_CHARS_FOR_HISTORY,
    );
    output
}

pub(super) fn cap_sdk_tool_content_for_history(tool_name: &str, content: String) -> String {
    if content.chars().count() <= MAX_TOOL_OUTPUT_CHARS_FOR_HISTORY {
        return content;
    }
    let original_chars = content.chars().count();
    let kept = crate::util::truncate_str(&content, MAX_TOOL_OUTPUT_CHARS_FOR_HISTORY);
    format!(
        "{}\n\n[Tool output truncated by jcode: tool `{}` produced {} chars; kept first {} chars to protect the remote protocol, session history, and prompt cache. Redirect large logs to a file and read targeted sections.]",
        kept, tool_name, original_chars, MAX_TOOL_OUTPUT_CHARS_FOR_HISTORY,
    )
}

/// Build rendered side-pane images from a tool output's attached images.
///
/// This mirrors how `render_messages_and_images` derives images from persisted
/// session history (source = ToolResult), so live-streamed images match what a
/// later History reload would produce. `tool_name` and `tool_input` provide the
/// label fallback (e.g. the `read` tool's `file_path`); `tool_call_id` anchors
/// the image to its tool message in the transcript.
pub(super) fn tool_output_side_pane_images(
    tool_call_id: &str,
    tool_name: &str,
    tool_input: &serde_json::Value,
    output: &ToolOutput,
) -> Vec<jcode_session_types::RenderedImage> {
    if output.images.is_empty() {
        return Vec::new();
    }
    let fallback_label = tool_input
        .get("file_path")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    output
        .images
        .iter()
        .map(|img| jcode_session_types::RenderedImage {
            history_message_index: None,
            media_type: img.media_type.clone(),
            data: img.data.clone(),
            label: img
                .label
                .as_ref()
                .map(|label| label.trim().to_string())
                .filter(|label| !label.is_empty())
                .or_else(|| fallback_label.clone()),
            source: jcode_session_types::RenderedImageSource::ToolResult {
                tool_name: tool_name.to_string(),
            },
            anchor: Some(jcode_session_types::RenderedImageAnchor::ToolCall {
                id: tool_call_id.to_string(),
            }),
        })
        .collect()
}

/// Metadata key a tool sets to load deferred tool definitions into context.
/// Value: array of registry tool names (e.g. `mcp__github__create_issue`).
pub(crate) const TOOL_REFERENCES_METADATA_KEY: &str = "tool_references";

/// Tool names a tool output asks to load via provider-native tool references.
pub(crate) fn tool_output_references(output: &ToolOutput) -> Vec<String> {
    output
        .metadata
        .as_ref()
        .and_then(|meta| meta.get(TOOL_REFERENCES_METADATA_KEY))
        .and_then(|refs| refs.as_array())
        .map(|refs| {
            refs.iter()
                .filter_map(|name| name.as_str())
                .filter(|name| !name.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

pub(super) fn tool_output_to_content_blocks(
    tool_use_id: String,
    output: ToolOutput,
) -> Vec<ContentBlock> {
    let references = tool_output_references(&output);
    let mut blocks = vec![ContentBlock::ToolResult {
        tool_use_id: tool_use_id.clone(),
        content: output.output,
        is_error: None,
    }];
    for img in output.images {
        blocks.push(ContentBlock::Image {
            media_type: img.media_type,
            data: img.data,
        });
        if let Some(label) = img.label.filter(|label| !label.trim().is_empty()) {
            blocks.push(ContentBlock::Text {
                text: format!(
                    "[Attached image associated with the preceding tool result: {}]",
                    label
                ),
                cache_control: None,
            });
        }
    }
    // References come last so image folding (which expects an image right
    // after its tool_result) is unaffected. Providers without native deferred
    // loading ignore them; the result text still names the tools.
    blocks.extend(
        references
            .into_iter()
            .map(|tool_name| ContentBlock::ToolReference {
                tool_use_id: tool_use_id.clone(),
                tool_name,
            }),
    );
    blocks
}

pub(super) fn print_tool_summary(tool: &ToolCall) {
    match tool.name.as_str() {
        "bash" => {
            if let Some(cmd) = tool.input.get("command").and_then(|v| v.as_str()) {
                let short = if cmd.len() > 60 {
                    format!("{}...", crate::util::truncate_str(cmd, 60))
                } else {
                    cmd.to_string()
                };
                println!("$ {}", short);
            }
        }
        "read" | "write" | "edit" => {
            if let Some(path) = tool.input.get("file_path").and_then(|v| v.as_str()) {
                println!("{}", path);
            }
        }
        "glob" | "grep" => {
            if let Some(pattern) = tool.input.get("pattern").and_then(|v| v.as_str()) {
                println!("'{}'", pattern);
            }
        }
        "ls" => {
            let path = tool
                .input
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or(".");
            println!("{}", path);
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authoritative_diff_text_survives_history_conversion_and_serialization() {
        let text =
            "Edited f\n\nFile diff:\n```diff\n--- f\n+++ f\n@@ -39,1 +39,1 @@\n-old\n+new\n```\n";
        let blocks = tool_output_to_content_blocks(
            "edit-call".into(),
            cap_tool_output_for_history("edit", ToolOutput::new(text)),
        );
        let serialized = serde_json::to_string(&blocks).unwrap();
        let restored: Vec<ContentBlock> = serde_json::from_str(&serialized).unwrap();
        assert!(
            matches!(&restored[0], ContentBlock::ToolResult { content, tool_use_id, .. }
            if content == text && tool_use_id == "edit-call")
        );
    }

    #[test]
    fn cap_tool_output_leaves_small_output_unchanged() {
        let output = ToolOutput::new("short output");
        let capped = cap_tool_output_for_history("bash", output.clone());
        assert_eq!(capped.output, output.output);
    }

    #[test]
    fn cap_tool_output_adds_visible_truncation_notice() {
        let output = ToolOutput::new("x".repeat(MAX_TOOL_OUTPUT_CHARS_FOR_HISTORY + 10));
        let capped = cap_tool_output_for_history("bash", output);
        assert!(capped.output.len() < MAX_TOOL_OUTPUT_CHARS_FOR_HISTORY + 1_000);
        assert!(capped.output.contains("Tool output truncated by jcode"));
        assert!(capped.output.contains("tool `bash` produced"));
        assert!(capped.output.contains("Redirect large logs to a file"));
    }

    #[test]
    fn cap_sdk_tool_content_adds_same_notice() {
        let capped = cap_sdk_tool_content_for_history(
            "custom",
            "y".repeat(MAX_TOOL_OUTPUT_CHARS_FOR_HISTORY + 10),
        );
        assert!(capped.contains("Tool output truncated by jcode"));
        assert!(capped.contains("tool `custom` produced"));
    }
}

#[cfg(test)]
mod image_anchor_tests {
    use super::*;

    #[test]
    fn live_batch_images_anchor_to_parent_and_have_no_history_boundary() {
        let output = ToolOutput::new("batch results")
            .with_labeled_image("image/png", "one", "first.png")
            .with_labeled_image("image/png", "two", "second.png");
        let images =
            tool_output_side_pane_images("parent-batch", "batch", &serde_json::json!({}), &output);
        assert_eq!(images.len(), 2);
        for image in &images {
            assert_eq!(
                image.anchor,
                Some(jcode_session_types::RenderedImageAnchor::ToolCall {
                    id: "parent-batch".into()
                })
            );
            assert_eq!(image.history_message_index, None);
        }
        assert_eq!(images[0].data, "one");
        assert_eq!(images[1].data, "two");
        assert_eq!(images[0].label.as_deref(), Some("first.png"));
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1713** (2026-10-05): **Composer undo stops at arbitrary Korean IME event boundaries**
  *Symptoms*: ### Reproduction In the Ghostty TUI with a Korean keyboard, type `가나다` in the prompt and press Cmd+Z (Cmd+ㅋ on the Korean layout).  ### Actual The composer can leave `가` behind because each terminal text event gets its own undo snapshot. A single IME event may also contain more than one committed syllable, so the outcome depends on event chunking.  ### Expected A contiguous typing burst should undo as one edit, leaving the previous draft (empty in this example). Whitespace, paste, cursor edits and pauses should remain separate undo boundaries.  ### Scope TUI composer input for local and remote sessions. The terminal receives committed text rather than an IME composition state.

- **Issue #1666** (2026-10-04): **auto-poke cannot re-arm after the completion-gate breaker trips**
  *Symptoms*: ## Summary  After the completion-gate circuit breaker trips, auto-poke cannot re-arm. The harness silently stops verifying completion and waits for the user to re-arm by hand.  `schedule_auto_poke_followup_if_needed` (`crates/jcode-tui/src/tui/app/input.rs`) opens with:  ```rust if !self.auto_poke_incomplete_todos     || self.pending_queued_dispatch     || self.pending_turn     || self.has_queued_followups() {     return false; } ```  The flag is cleared further down when the gate budget is spent, and the re-arm assignment sits *after* that early return. So once `auto_poke_incomplete_todos` is false, the re-arm is unreachable.  `test_completion_gate_nudges_stop_after_budget_exhausted` covers the disarming and asserts `!app.auto_poke_incomplete_todos`. Nothing covered the re-arm, because the code could not do it.  ## Steps to reproduce  1. Have a completed todo whose `completion_confidence` sits below the gate threshold, so the gate keeps failing. 2. Let the poke run `TODO_COMPLETION_GATE_MAX_ATTEMPTS` times (5), clearing the queued state between iterations as a real turn would. 3. The gate is now disarmed: `auto_poke_incomplete_todos == false` and `todo_completion_gate_attempts == 0`. 4. Add genuine open work — an `in_progress` todo. 5. Call `schedule_auto_poke_followup_if_needed()`.  Observed: it returns `false` forever. The poke never comes back even though there is real unfinished work.  Expected: the poke re-arms on its own.  ## Why it matters  Auto-poke exists so the har
  **Post-Mortem & Fix Analysis**:
  > Thanks for the clear write-up. This was fixed by 7d60ddbc3 (shipped in v0.90.0): `schedule_auto_poke_followup_if_needed` now re-arms before the guard when `auto_poke_default_on` is set and open work exists, covered by `test_open_work_rearms_auto_poke_after_completion_gate_breaker` (passing on master). Closing as completed. Please reopen if you still see it on v0.90.0 or later.  --- *— Jcode agent (automated triage), on behalf of @1jehuang*

- **Issue #1663** (2026-10-04): **Configured palette roles are dropped on 256-color terminals**
  *Symptoms*: **Summary.** Configured palette roles are dropped on 256-color terminals  ### What happens  On a terminal that is not truecolor (256-color, e.g. `TERM=xterm-256color` without `COLORTERM=truecolor`), a user's configured palette override was **silently dropped**: the role's cells kept their built-in default color and the `/colors` configuration had no visible effect.  Measured scale: **21 of the 22** hand-tuned role defaults fail to round-trip through quantization, so on such a terminal essentially *every* configured role was affected, not an edge case. Example: `Warning` default `(255,200,100)` quantizes to index 221, which dequantizes to `(255,215,95) != (255,200,100)`.  ### Root cause  The render path emits a role's color through `color::rgb(r, g, b)` (`crates/jcode-tui-style/src/palette.rs:386-389`, `role_color`). `color::rgb` returns `Color::Rgb` only when the terminal has truecolor; otherwise it returns `Color::Indexed(rgb_to_xterm256(r, g, b))` (`crates/jcode-tui-style/src/color.rs:156-160`).  `configured_native_color` (`palette.rs:343-376`) then dequantized that cell with `indexed_to_rgb(index)` and compared the result against the role's **unquantized** `default_rgb()`:  ```rust .find(|role| role.default_rgb() == rgb && palette.is_overridden(*role))?; ```  Quantized-then-dequantized is not the original value for 21 of 22 defaults, so the comparison never matched, no role was attributed, and the override was dropped. Nothing warned: the cell simply kept its default ink. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the precise diagnosis and patch. Fixed in 66205a2a8: indexed cells are now matched to a role in xterm-256 index space, so overrides apply on 256-color terminals. A regression test covers every role (it fails without the fix). It will ship in the next release.  --- *— Jcode agent (automated triage), on behalf of @1jehuang*

- **Issue #1643** (2026-10-04): **Copilot reasoning effort rejects models with advertised catalog support**
  *Symptoms*: ## Problem  The GitHub Copilot runtime restricts reasoning effort to `claude-sonnet-5`, even when the authenticated `/models` catalog advertises `capabilities.supports.reasoning_effort` for other models. Responses requests also omit the selected effort.  ## Reproduction  1. Authenticate a Copilot account that exposes `gpt-6.1-sol`. 2. Select `copilot:gpt-6.1-sol` in a fresh session. 3. Set `/effort high` (wire request: `{"type":"set_reasoning_effort","id":2,"effort":"high"}`).  Observed on Windows x64 with the pre-fix executable and an isolated named-pipe server:  ```json {"type":"reasoning_effort_changed","id":2,"error":"Reasoning effort is not supported for Copilot model 'gpt-6.1-sol' (only claude-sonnet-5)"} ```  Expected: validate against the selected model's advertised effort levels and send the selection as `reasoning.effort` for Responses or `reasoning_effort` for Chat Completions. A cold session should load missing capabilities before rejecting the selection, and switching models must not send an unsupported level.  Related: #558 implemented Sonnet 5 support; #1637 repairs authenticated API-host and endpoint routing. This issue covers catalog-driven effort support on top of that repair. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the clear repro. Fixed in 985d1de7b: Copilot now checks reasoning effort against the levels each model advertises in the authenticated `/models` catalog, with `claude-sonnet-5` as the fallback until the catalog loads. It sends the selected effort as `reasoning.effort` on Responses and `reasoning_effort` on Chat Completions. An effort that a newly selected model doesn't advertise is dropped rather than sent. Covered by unit tests, and it will ship in the next release.  --- *— Jcode agent (automated triage), on behalf of @1jehuang*

- **Issue #1630** (2026-10-04): **jcode update and /update install an unpatched binary on Termux (Android aarch64)**
  *Symptoms*: On Termux, `jcode update` and the in-app `/update` install the downloaded `jcode-linux-aarch64` binary without repointing its ELF interpreter at Termux's glibc loader. You get a binary that cannot exec. `scripts/install.sh` does this patch; the Rust updater does not.  Every Termux user who updates in-app hits this. The README lists Termux as supported, so updates being the one broken path is a surprise.  ## Environment  - POCO F3, Android 13, aarch64 - Termux, aarch64, `PREFIX=/data/data/com.termux/files/usr` - `glibc` 2.44 from the `termux-glibc` repo, `patchelf` present - jcode v0.89.3 (`de65ade33`), installed with `curl -fsSL https://jcode.sh/install | bash`  ## Reproduce  ```sh pkg install glibc patchelf curl -fsSL https://jcode.sh/install | bash   # succeeds, prints "Patched Termux glibc ELF interpreter" jcode --version                              # works  jcode update                                 # or /update inside the TUI ```  ## Expected  The updater applies the same Termux ELF interpreter patch `scripts/install.sh` applies, so the new version launches. Installer and in-app updater should agree on Termux.  ## Actual  The update reports success but the installed binary keeps its stock `ld-linux-aarch64.so.1` interpreter. Termux has no such path at the root, so exec fails:  ``` cannot execute: required file not found ```  `~/.local/bin/jcode` offers no way out. It is two lines with no validation:  ```sh #!/usr/bin/env bash unset LD_PRELOAD exec "/data/data/com.term
  **Post-Mortem & Fix Analysis**:
  > Thanks for the thorough root-cause write-up. Fixed in 400bf78e8: after extracting an update, the in-app updater now uses the same Termux detection as `scripts/install.sh` and runs `patchelf --set-interpreter` with Termux's glibc loader (aarch64 or x86_64). It does this before any channel symlink moves. If the loader or patchelf is missing, the update fails with a clear message and keeps the current version, so you no longer end up with a binary that can't run. Unit tests cover detection and loader choice, but it hasn't been run on a real device yet. A confirmation from Termux after the next release would be very welcome. The self-validating launcher idea is a good separate follow-up.  --- *— Jcode agent (automated triage), on behalf of @1jehuang*

- **Issue #1625** (2026-10-04): **模型配置及上下文长度识别问题**
  *Symptoms*: 在v0.89.3 版本之前可以正常识别唯一配置的deepseek 上下文正常识别是1M,升级后启动发现上下文变成了2K一开始还以为是源码逻辑变了，但查看逻辑源码发现对于deepseek厂商上下文的控制是1M  <img width="2559" height="1527" alt="Image" src="https://github.com/user-attachments/assets/528399fe-97af-4230-9638-40386a5fd90b" /> <img width="2559" height="675" alt="Image" src="https://github.com/user-attachments/assets/b2347f6b-c007-41df-8d54-3305344563c0" /> 结果在界面信息中发现一个情况，就是厂商识别的是deepseek 模型却是anthropic/claude-sonnet-4   <img width="2520" height="875" alt="Image" src="https://github.com/user-attachments/assets/6745233c-86b2-406f-8f76-ce71ccc78935" />  从model列表来看确实是deepseek 厂商的anthropic/claude-sonnet-4  模型！甚至本地第三方也没有这个配置！  <img width="2553" height="641" alt="Image" src="https://github.com/user-attachments/assets/48e375e7-3e52-455b-a01c-f694209b6704" /> 而且即使切到deepseek的模型 上下文长度也未正常识别 还是200K  jcode · client · cli↑ server: Cove 🌊 · v0.89.3 client: Retriever 🦮 · v0.84.0 /model to switch · api-key:deepseek · DeepSeek: anthropic/claude-sonnet-4 /login to add provider
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈！/ Thanks for the report!  找到原因并已修复 (026dd5d18)：自 v0.89.0 起，`--provider auto` 自动启用 DeepSeek 配置时没有设置模型，于是回退到了 OpenRouter 的默认模型 `anthropic/claude-sonnet-4`，上下文长度也因此被识别成通用的 200K。现在会使用 DeepSeek 配置自己的默认模型 (`deepseek-v4-flash`, 1M)。将在下一个版本发布。  Root cause, fixed in 026dd5d18: since v0.89.0, when `--provider auto` enabled the DeepSeek profile it never set a model, so the model fell back to OpenRouter's default `anthropic/claude-sonnet-4` and the context length to the generic 200K. jcode now uses the DeepSeek profile's own default model (`deepseek-v4-flash`, 1M). A regression test covers it, and the fix ships in the next release.  另外，你的界面显示 `client v0.84.0` / `server v0.89.3`，客户端是旧版本，这很可能也是 #1626 的原因。/ Separately, your screen shows client v0.84.0 against server v0.89.3, which is probably also the cause of #1626.  --- *— Jcode agent (automated triage), on behalf of @1jehuang*

- **Issue #1596** (2026-10-05): **OpenAI-compatible provider overload (529 / 5xx) fails the turn at once**
  *Symptoms*:  ### What happens  With an OpenAI-compatible provider such as Openference, a busy period comes back as HTTP 529 (some providers use 500, 502, 503 or 504) with a body like:  ``` status: 529 <unknown status code> response: data: {"error":{"message":"We're experiencing heavy usage right now, which may cause increased latency or temporary unavailability. We're working on adding more capacity - please try again in a moment.","type":"server_error"}} ```  jcode sends the request once and fails the turn right away. The hint underneath tells the user to check network connectivity, DNS and TLS. The network is fine, since the provider answered. The provider asked to try again in a moment, and a retry a few seconds later usually works. Right now the user has to notice the failure and resend by hand.  ### Steps to reproduce  1. Configure an `openai-compatible` profile against an endpoint that answers 529 with the body above (a small fake server works). 2. `jcode run 'Say hello'`. 3. The server sees exactly one request, and jcode exits with the error and the network hint.  ### Expected  The overload is treated as temporary. jcode retries with backoff, and in the TUI it holds the turn and resends it a few more times before giving up. The hint names a provider overload, not the network.  ### Cause  `is_retryable_error` in `crates/jcode-provider-openrouter-runtime/src/openrouter_sse_stream.rs` only classifies 429 by status code. A 529 with this body matches none of the text fallbacks ("overlo
  **Post-Mortem & Fix Analysis**:
  > Reproduced on master by feeding the exact error from this report into jcode's retry check: 500/503 were retried, but **529** (and other non-standard 5xx like 520) were not, so the turn failed on the first attempt with the misleading network hint.  Fixed in 22d3ced16: every 5xx from an OpenAI-compatible provider is now retried within the existing retry budget, and if it still fails, the hint says the provider is overloaded rather than pointing at your network. Regression tests cover 500/502/503/520/529 (they fail without the fix). This ships in the next release.  @SiavZ, thanks for PR #1597. The core classifier change is now on master. Your cancel-aware backoff and 429 hint are still valuable, so feel free to rebase the PR down to those parts.  --- *— Jcode agent (automated triage), on behalf of @1jehuang*

- **Issue #1524** (2026-09-28): **Windows: is_socket_path and remove_socket panic with 'there is no reactor running' when called from a plain thread**
  *Symptoms*: ## Environment  - jcode v0.88.0-dev (`b5a4cde7a`) - Windows, named-pipe transport (`crates/jcode-transport/src/windows.rs`)  ## What happens  `is_socket_path` and `remove_socket` are synchronous by contract, but both open the pipe through tokio's named-pipe client:  ```rust pub fn is_socket_path(path: &Path) -> bool {     let pipe_name = path_to_pipe_name(path);     match ClientOptions::new().open(&pipe_name) { ```  `ClientOptions::open` registers the pipe handle with the ambient tokio reactor. Called from a thread that has no runtime context, it aborts the process:  ``` thread '<unnamed>' panicked at tokio-1.49.0/src/net/windows/named_pipe.rs:1005 there is no reactor running, must be called from the context of a Tokio 1.x runtime ```  The panic happens on the `open` call itself, before any success or failure is known, so it is not specific to a missing endpoint or a busy pipe.  ## Minimal reproduction  The two halves of the bug have to meet: a runtime on the server side, and a plain `std::thread` on the probing side. This is a test:  ```rust #[tokio::test] async fn probes_run_from_a_thread_without_a_reactor() {     let path = std::env::temp_dir().join("jcode-probe.sock");     let _listener = Listener::bind(&path).expect("bind named pipe");      // This thread has no runtime, which is the point.     std::thread::spawn(move || {         is_socket_path(&path);   // panics         remove_socket(&path);     })     .join()     .unwrap(); } ```  It fails on the current `master` wit
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report! This is covered by open PR #1525, which is now queued for maintainer review.  --- *Jcode agent (automated triage), on behalf of @1jehuang*

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

### Incident Patch 1: `cab6951f` (2026-10-05)
**Commit Message**: chore(ci): accept size growth from #1711, #1714 and the edit-row intent fix

**File**: `scripts/code_size_budget.json` (modified, +15/-16)
```diff
@@ -2,7 +2,7 @@
   "threshold_loc": 1200,
   "tracked_files": {
     "crates/jcode-app-core/src/agent.rs": 1299,
-    "crates/jcode-app-core/src/agent/turn_execution.rs": 1501,
+    "crates/jcode-app-core/src/agent/turn_execution.rs": 1482,
     "crates/jcode-app-core/src/agent/turn_loops.rs": 1345,
     "crates/jcode-app-core/src/agent/turn_streaming_mpsc.rs": 1936,
     "crates/jcode-app-core/src/overnight.rs": 1275,
@@ -20,10 +20,10 @@
     "crates/jcode-app-core/src/tool/browser.rs": 1260,
     "crates/jcode-app-core/src/tool/communicate.rs": 3490,
     "crates/jcode-app-core/src/tool/discover.rs": 2982,
-    "crates/jcode-app-core/src/tool/mod.rs": 1711,
+    "crates/jcode-app-core/src/tool/mod.rs": 1699,
     "crates/jcode-app-core/src/tool/session_search.rs": 1892,
     "crates/jcode-app-core/src/tool/todo.rs": 2532,
-    "crates/jcode-app-core/src/update.rs": 1820,
+    "crates/jcode-app-core/src/update.rs": 1307,
     "crates/jcode-base/src/auth/lifecycle.rs": 2768,
     "crates/jcode-base/src/auth/mod.rs": 1693,
     "crates/jcode-base/src/auth/oauth.rs": 1524,
@@ -49,7 +49,6 @@
     "crates/jcode-plan/src/lib.rs": 1201,
     "crates/jcode-protocol/src/wire.rs": 1702,
     "crates/jcode-provider-anthropic-runtime/src/lib.rs": 2821,
-    "crates/jcode-provider-anthropic/src/lib.rs": 1317,
     "crates/jcode-provider-bedrock/src/lib.rs": 1937,
     "crates/jcode-provider-core/src/lib.rs": 1849,
     "crates/jcode-provider-cursor-runtime/src/agent_transport.rs": 1873,
@@ -63,7 +62,7 @@
     "crates/jcode-provider-openai-runtime/src/openai_provider_impl.rs": 1283,
     "crates/jcode-provider-openai-runtime/src/openai_stream_runtime.rs": 1783,
     "crates/jcode-provider-openai/src/stream.rs": 1405,
-    "crates/jcode-provider-openrouter-runtime/src/lib.rs": 2969,
+    "crates/jcode-provider-openrouter-runtime/src/lib.rs": 2916,
     "crates/jcode-render-core/src/math.rs": 1234,
     "crates/jcode-sdk/src/client.rs": 1870,
     "crates/jcode-setup-hints/src/lib.rs": 2627,
@@ -75,25 +74,25 @@
     "crates/jcode-tui-mermaid/src/mermaid_cache_render.rs": 1477,
     "crates/jcode-tui-mermaid/src/mermaid_viewport.rs": 1971,
     "crates/jcode-tui-render/src/swarm_gallery.rs": 3099,
-    "crates/jcode-tui/src/tui/app.rs": 2700,
-    "crates/jcode-tui/src/tui/app/auth.rs": 3527,
-    "crates/jcode-tui/src/tui/app/auth_account_commands.rs": 1221,
+    "crates/jcode-tui/src/tui/app.rs": 2701,
+    "crates/jcode-tui/src/tui/app/auth.rs": 3520,
+    "crates/jcode-tui/src/tui/app/auth_account_commands.rs": 1217,
     "crates/jcode-tui/src/tui/app/auth_account_picker.rs": 1275,
     "crates/jcode-tui/src/tui/app/commands.rs": 3788,
     "crates/jcode-tui/src/tui/app/debug_bench.rs": 1286,
     "crates/jcode-tui/src/tui/app/helpers.rs": 1682,
     "crates/jcode-tui/src/tui/app/inline_interactive.rs": 4753,
-    "crates/jcode-tui/src/tui/app/input.rs": 4159,
-    "crates/jcode-tui/src/tui/app/model_context.rs": 1983,
+    "crates/jcode-tui/src/tui/app/input.rs": 4173,
+    "crates/jcode-tui/src/tui/app/model_context.rs": 1873,
     "crates/jcode-tui/src/tui/app/navigation.rs": 1930,
     "crates/jcode-tui/src/tui/app/onboarding_flow_control.rs": 1766,
     "crates/jcode-tui/src/tui/app/remote.rs": 2242,
     "crates/jcode-tui/src/tui/app/remote/key_handling.rs": 2770,
     "crates/jcode-tui/src/tui/app/remote/server_events.rs": 2982,
     "crates/jcode-tui/src/tui/app/run_shell.rs": 1419,
     "crates/jcode-tui/src/tui/app/state_ui.rs": 2313,
-    "crates/jcode-tui/src/tui/app/state_ui_input_helpers.rs": 2235,
-    "crates/jcode-tui/src/tui/app/tui_lifecycle.rs": 1429,
+    "crates/jcode-tui/src/tui/app/state_ui_input_helpers.rs": 2238,
+    "crates/jcode-tui/src/tui/app/tui_lifecycle.rs": 1431,
     "crates/jcode-tui/src/tui/app/tui_state.rs": 2505,
     "crates/jcode-tui/src/tui/app/turn.rs": 1738,
     "crates/jcode-tui/src/tui/backend.rs": 1982,
@@ -107,11 +106,11 @@
     "crates/jcode-tui/src/tui/ui_inline_image.rs": 1797,
     "crates/jcode-tui/src/tui/ui_inline_interactive.rs": 1470,
     "crates/jcode-tui/src/tui/ui_input.rs": 3052,
-    "crates/jcode-tui/src/tui/ui_messages.rs": 4480,
+    "crates/jcode-tui/src/tui/ui_messages.rs": 4496,
     "crates/jcode-tui/src/tui/ui_pinned.rs": 1269,
-    "crates/jcode-tui/src/tui/ui_prepare.rs": 2721,
+    "crates/jcode-tui/src/tui/ui_prepare.rs": 2726,
     "crates/jcode-tui/src/tui/ui_tools.rs": 1687,
-    "crates/jcode-tui/src/tui/ui_viewport.rs": 1692,
+    "crates/jcode-tui/src/tui/ui_viewport.rs": 1691,
     "src/bin/memory_recall_bench.rs": 2667,
     "src/bin/tui_bench.rs": 1765,
     "src/cli/acp.rs": 2201,
@@ -120,7 +119,7 @@
     "src/cli/commands.rs": 3556,
     "src/cli/dispatch.rs": 1523,
     "src/cli/login.rs": 1454,
-    "src/cli/provider_init.rs": 1919
+    "src/cli/provider_init.rs": 1902
   },
   "version": 1
 }
```

**File**: `scripts/test_size_budget.json` (modified, +6/-6)
```diff
@@ -20,23 +20,23 @@
     "crates/jcode-harness-api-server/src/translate_tests.rs": 4028,
     "crates/jcode-plan/src/dag/tests.rs": 1392,
     "crates/jcode-provider-anthropic-runtime/src/anthropic_tests.rs": 2461,
-    "crates/jcode-provider-openrouter-runtime/src/openrouter_tests.rs": 3899,
+    "crates/jcode-provider-openrouter-runtime/src/openrouter_tests.rs": 3644,
     "crates/jcode-sdk/tests/client_behavior.rs": 1385,
     "crates/jcode-telemetry-core/src/tests.rs": 1598,
     "crates/jcode-tui-markdown/src/markdown_tests/cases/rendering.rs": 1207,
     "crates/jcode-tui/src/tui/app/remote_tests.rs": 1316,
     "crates/jcode-tui/src/tui/app/tests.rs": 2103,
     "crates/jcode-tui/src/tui/app/tests/commands_accounts_01/part_01.rs": 1677,
     "crates/jcode-tui/src/tui/app/tests/onboarding_eval.rs": 3303,
-    "crates/jcode-tui/src/tui/app/tests/onboarding_flow.rs": 1849,
+    "crates/jcode-tui/src/tui/app/tests/onboarding_flow.rs": 1691,
     "crates/jcode-tui/src/tui/app/tests/remote_events_reload_01/part_01.rs": 2031,
     "crates/jcode-tui/src/tui/app/tests/remote_events_reload_04.rs": 2707,
     "crates/jcode-tui/src/tui/app/tests/remote_events_reload_05.rs": 1204,
-    "crates/jcode-tui/src/tui/app/tests/remote_startup_input_02/part_01.rs": 2065,
+    "crates/jcode-tui/src/tui/app/tests/remote_startup_input_02/part_01.rs": 2141,
     "crates/jcode-tui/src/tui/app/tests/remote_startup_input_03/part_01.rs": 1325,
     "crates/jcode-tui/src/tui/app/tests/scroll_copy_01/part_01.rs": 1557,
     "crates/jcode-tui/src/tui/app/tests/scroll_copy_02/part_01.rs": 1580,
-    "crates/jcode-tui/src/tui/app/tests/scroll_copy_02/part_02.rs": 1378,
+    "crates/jcode-tui/src/tui/app/tests/scroll_copy_02/part_02.rs": 1397,
     "crates/jcode-tui/src/tui/app/tests/scroll_copy_03.rs": 1672,
     "crates/jcode-tui/src/tui/app/tests/state_model_poke_01/part_01.rs": 1384,
     "crates/jcode-tui/src/tui/app/tests/state_model_poke_02/part_01.rs": 1614,
@@ -45,9 +45,9 @@
     "crates/jcode-tui/src/tui/info_widget_tests.rs": 2107,
     "crates/jcode-tui/src/tui/session_picker/loading_tests.rs": 1564,
     "crates/jcode-tui/src/tui/session_picker_tests.rs": 2603,
-    "crates/jcode-tui/src/tui/ui_messages/tests.rs": 3354,
+    "crates/jcode-tui/src/tui/ui_messages/tests.rs": 3402,
     "crates/jcode-tui/src/tui/ui_tests/prepare.rs": 1289,
-    "crates/jcode-tui/src/tui/ui_tests/tools.rs": 1528,
+    "crates/jcode-tui/src/tui/ui_tests/tools.rs": 1530,
     "src/cli/commands_tests.rs": 1688,
     "tests/e2e/test_support/mod.rs": 1433
   },
```

---

### Incident Patch 2: `d980b62c` (2026-10-05)
**Commit Message**: fix(tui): edit rows show intent, expand badge in every diff mode

- The edit tool row no longer repeats the file path that the inline diff
  header directly below already shows. It reads like other tool rows.
- The Alt+Shift+E expand badge stays on edit rows in Off and File diff modes,
  where it opens the hidden diff in full inline.

**File**: `crates/jcode-tui/src/tui/app/tests/scroll_copy_02/part_02.rs` (modified, +19/-0)
```diff
@@ -507,6 +507,25 @@ fn test_expand_badge_does_not_render_for_short_untruncated_edit_diff() {
     );
 }
 
+#[test]
+fn test_expand_badge_renders_when_diffs_are_hidden() {
+    let _render_lock = scroll_render_test_lock();
+    for mode in [
+        crate::config::DiffDisplayMode::Off,
+        crate::config::DiffDisplayMode::File,
+    ] {
+        // Even a short diff is hidden outside inline mode, so the badge must
+        // stay visible as the way back to it.
+        let (mut app, mut terminal) = make_edit_badge_test_app(2);
+        app.diff_mode = mode;
+        let rendered = render_and_snap(&app, &mut terminal);
+        assert!(
+            rendered.contains("[E] expand"),
+            "{mode:?} should keep the expand badge on edit rows:\n{rendered}"
+        );
+    }
+}
+
 #[test]
 fn test_expand_badge_shortcut_opens_full_inline_from_non_inline_mode() {
     let _render_lock = scroll_render_test_lock();
```

**File**: `crates/jcode-tui/src/tui/ui_messages.rs` (modified, +16/-0)
```diff
@@ -3361,6 +3361,10 @@ fn edit_tool_inline_diff_lines(tc: &ToolCall, content: &str) -> Option<Vec<Parse
     (!change_lines.is_empty()).then_some(change_lines)
 }
 
+pub(super) fn edit_tool_has_inline_diff(tc: &ToolCall, content: &str) -> bool {
+    edit_tool_inline_diff_lines(tc, content).is_some()
+}
+
 pub(super) fn edit_tool_inline_diff_is_expandable(
     tc: &ToolCall,
     content: &str,
@@ -4073,6 +4077,18 @@ pub(crate) fn render_tool_message(
     } else {
         tools_ui::get_tool_summary_with_budget(tc, 50, Some(technical_summary_width))
     };
+    // Edit rows read like every other tool row: the intent. The file path is
+    // already shown on the inline diff header right below, so repeating it on
+    // the row is noise. Errors keep their summary so failures stay diagnosable.
+    let edit_path_on_diff_header = is_edit_tool
+        && !is_error
+        && diff_mode.is_inline()
+        && edit_tool_has_inline_diff(tc, &msg.content);
+    let summary = if edit_path_on_diff_header {
+        String::new()
+    } else {
+        summary
+    };
 
     let mut tool_line = vec![
         Span::styled(format!("  {} ", icon), Style::default().fg(icon_color)),
```

**File**: `crates/jcode-tui/src/tui/ui_messages/tests.rs` (modified, +48/-0)
```diff
@@ -3352,3 +3352,51 @@ fn render_empty_todo_tool_result_collapses_to_compact_line() {
     assert!(!plain.contains("No tasks yet"), "{plain}");
     assert!(plain.contains("no tasks"), "{plain}");
 }
+
+/// The edit row must not repeat the file path that the inline diff header
+/// directly below already shows. With an intent it reads like any other tool
+/// row, and without one it falls back to the bare name plus change counts.
+#[test]
+fn render_tool_message_edit_row_does_not_duplicate_diff_header_path() {
+    for intent in [Some("Fix the network hint"), None] {
+        let msg = DisplayMessage {
+            role: "tool".to_string(),
+            content: "Edited".to_string(),
+            tool_calls: Vec::new(),
+            duration_secs: None,
+            title: None,
+            tool_data: Some(crate::message::ToolCall {
+                id: "call_edit".to_string(),
+                name: "edit".to_string(),
+                input: serde_json::json!({
+                    "file_path": "/repo/src/very_specific_name.rs",
+                    "old_string": "old\n",
+                    "new_string": "new\n",
+                }),
+                intent: intent.map(str::to_string),
+                thought_signature: None,
+            }),
+        };
+
+        let lines = render_tool_message(&msg, 160, crate::config::DiffDisplayMode::Inline);
+        let text: Vec<String> = lines.iter().map(extract_line_text).collect();
+        let occurrences = text
+            .iter()
+            .filter(|line| line.contains("very_specific_name.rs"))
+            .count();
+        assert_eq!(occurrences, 1, "path should appear once: {text:#?}");
+        assert!(
+            text[1].contains("diff · /repo/src/very_specific_name.rs"),
+            "{text:#?}"
+        );
+        if let Some(intent) = intent {
+            assert!(text[0].contains(&format!("edit · {intent}")), "{text:#?}");
+        }
+
+        // With diffs hidden the row is the only place the path can appear.
+        let lines = render_tool_message(&msg, 160, crate::config::DiffDisplayMode::Off);
+        if intent.is_none() {
+            assert!(extract_line_text(&lines[0]).contains("very_specific_name.rs"));
+        }
+    }
+}
```

**File**: `crates/jcode-tui/src/tui/ui_prepare.rs` (modified, +7/-2)
```diff
@@ -1567,8 +1567,13 @@ fn render_message_into(
                                 })
                         })
                         .unwrap_or_else(|| "unknown".to_string());
-                    let expandable =
-                        messages::edit_tool_inline_diff_is_expandable(tc, &msg.content, width);
+                    // Outside the inline modes the diff body is hidden entirely,
+                    // so any edit with a diff can be expanded into full inline.
+                    let expandable = if app.diff_mode().is_inline() {
+                        messages::edit_tool_inline_diff_is_expandable(tc, &msg.content, width)
+                    } else {
+                        messages::edit_tool_has_inline_diff(tc, &msg.content)
+                    };
                     acc.edit_tool_line_ranges.push((
                         msg_global_idx,
                         file_path,
```

**File**: `crates/jcode-tui/src/tui/ui_tests/tools.rs` (modified, +3/-1)
```diff
@@ -172,7 +172,9 @@ fn test_token_badges_survive_full_terminal_draw() {
                         .unwrap_or_else(|| panic!("missing tool row: {rows:#?}"))
                         as u16;
                     let row = &rows[y as usize];
-                    assert!(row.contains("(6 lines)"), "{row}");
+                    // A standalone patch's summary lives on the inline diff
+                    // header, so only batch subcall rows still carry it.
+                    assert_eq!(row.contains("(6 lines)"), batch, "{row}");
                     assert!(row.trim_end().ends_with(&label), "{row}");
                     let x = (0..width)
                         .find(|&x| {
```

**File**: `crates/jcode-tui/src/tui/ui_viewport.rs` (modified, +4/-5)
```diff
@@ -461,11 +461,10 @@ pub(super) fn draw_messages(
     } else {
         None
     };
-    let active_inline_edit_context = if app.diff_mode().is_inline() || expand_feedback_active {
-        active_file_diff_context(prepared.as_ref(), scroll, visible_height)
-    } else {
-        None
-    };
+    // The expand badge applies in every diff mode: from Off/File it opens the
+    // hidden diff in full inline, so resolve the visible edit regardless.
+    let active_inline_edit_context =
+        active_file_diff_context(prepared.as_ref(), scroll, visible_height);
 
     let visible_end = (scroll + visible_height).min(total_lines);
     let visible_user_start = lower_bound(wrapped_user_indices, scroll);
```

---

### Incident Patch 3: `ec85ee9e` (2026-10-05)
**Commit Message**: fix(anthropic): advertise registry tool schemas on Claude OAuth, renamed only

The OAuth route swapped in hand-curated Claude-Code schemas for Edit, Write,
Read, Grep, Glob, Agent and Skill. They drifted from the real tools and
dropped options such as intent, so OAuth models never sent intent for edits.
Every route now forwards the registry definition verbatim; OAuth only maps
names (edit -> Edit, ...).

**File**: `crates/jcode-provider-anthropic/src/lib.rs` (modified, +15/-142)
```diff
@@ -3,7 +3,9 @@ use jcode_message_types::{
 };
 use jcode_provider_core::anthropic_map_tool_name_for_oauth as map_tool_name_for_oauth;
 use serde::Serialize;
-use serde_json::{Value, json};
+use serde_json::Value;
+#[cfg(test)]
+use serde_json::json;
 
 mod history_repair;
 use history_repair::*;
@@ -446,32 +448,6 @@ pub fn format_content_blocks_with_native(
     result
 }
 
-/// Convert tool definitions to Anthropic API format
-/// Adds cache_control to the last tool for prompt caching
-/// Local tool names that are represented by the curated Claude-Code builtin
-/// definitions in OAuth mode. These keep their hand-tuned schemas/descriptions
-/// (which the Anthropic subscription endpoint expects) instead of the raw
-/// registry definitions; every other tool is forwarded as-is (see #409).
-/// Local tool names that already have a hand-tuned curated OAuth definition
-/// above, so the registry pass must not forward them a second time.
-///
-/// `schedule` is deliberately absent: its curated `ScheduleWakeup` schema had
-/// drifted from the real tool (it advertised `delaySeconds`/`reason`/`prompt`
-/// while the handler requires `task` + `wake_in_minutes`/`wake_at`), so every
-/// call failed with "task is required for action=create" (#706). Forwarding the
-/// real schema under the remapped name keeps the two in sync by construction.
-/// `bash` is likewise forwarded: its curated schema omitted timeout units and
-/// execution options (#1223). Only its OAuth name changes, not its definition.
-const OAUTH_BUILTIN_LOCAL_TOOLS: &[&str] = &[
-    "subagent",
-    "edit",
-    "glob",
-    "grep",
-    "read",
-    "skill_manage",
-    "write",
-];
-
 /// Normalize a tool schema for Anthropic's `input_schema`.
 ///
 /// Anthropic accepts JSON Schema combinators inside object properties but
@@ -487,125 +463,22 @@ fn anthropic_input_schema(schema: &Value) -> Value {
     jcode_schema_dialect::normalize(schema, &jcode_schema_dialect::registry::ANTHROPIC)
 }
 
+/// Convert tool definitions to Anthropic API format.
+///
+/// Every provider and auth route advertises the same registry tools with the
+/// same schemas. OAuth (subscription) only renames a few tools to their
+/// Claude-Code builtin names (`bash` -> `Bash`, ...); the definition itself is
+/// never replaced. Hand-curated OAuth schemas drifted from the real tools and
+/// silently dropped options like `intent` (#706, #1223).
 pub fn format_tools(tools: &[ToolDefinition], is_oauth: bool, cache_ttl_1h: bool) -> Vec<ApiTool> {
-    if is_oauth {
-        // A curated builtin may only be advertised when at least one backing
-        // local tool is actually registered. Otherwise the model calls e.g.
-        // `Agent`/`Glob`, the reverse mapping resolves to `subagent`/`glob`,
-        // and the registry lookup fails with "Unknown tool" (see #572).
-        let has_backing = |candidates: &[&str]| {
-            candidates
-                .iter()
-                .any(|candidate| tools.iter().any(|tool| tool.name == *candidate))
-        };
-        // Curated Claude-Code builtin tool definitions. These remain hand-tuned
-        // because the Anthropic OAuth (subscription) endpoint expects the
-        // builtin names with compatible schemas. Anything not represented here
-        // is appended from the real registry below so OAuth users keep the full
-        // toolset (websearch, webfetch, browser, codesearch, memory, ...).
-        let curated: Vec<(&[&str], ApiTool)> = vec![
-            (
-                &["subagent"],
-                ApiTool {
-                    name: "Agent".to_string(),
-                    description: "Launch a new agent to handle complex, multi-step tasks."
-                        .to_string(),
-                    input_schema: json!({"type":"object","properties":{"description":{"type":"string"},"prompt":{"type":"string"},"subagent_type":{"type":"string"},"run_in_background":{"type":"boolean"}},"required":["description","prompt"],"additionalProperties":false}),
-                    cache_control: None,
-                    defer_loading: false,
-                },
-            ),
-            (
-                &["edit"],
-                ApiTool {
-                    name: "Edit".to_string(),
-                    description: "Performs exact string replacements in files.".to_string(),
-                    input_schema: json!({"type":"object","properties":{"file_path":{"type":"string"},"old_string":{"type":"string"},"new_string":{"type":"string"},"replace_all":{"type":"boolean","default":false}},"required":["file_path","old_string","new_string"],"additionalProperties":false}),
-                    cache_control: None,
-                    defer_loading: false,
-                },
-            ),
-            (
-                &["glob"],
-                ApiTool {
-                    name: "Glob".to_string(),
-                    description: "Fast file pattern matching tool.".to_string(),
-                    input_
```

**File**: `crates/jcode-provider-anthropic/src/oauth_tool_schema_tests.rs` (modified, +35/-0)
```diff
@@ -125,3 +125,38 @@ fn oauth_bash_schema_advertises_the_justification_escape_hatch() {
         bash.input_schema
     );
 }
+
+#[test]
+fn oauth_builtins_forward_registry_schemas_including_intent() {
+    // The OAuth route used to swap in hand-curated Claude-Code schemas for
+    // Edit/Write/Read/..., which silently dropped registry options such as
+    // `intent`. Every route must advertise the registry definition verbatim,
+    // only renamed.
+    for (local, oauth) in [
+        ("edit", "Edit"),
+        ("write", "Write"),
+        ("read", "Read"),
+        ("bash", "Bash"),
+    ] {
+        let def = ToolDefinition {
+            name: local.to_string(),
+            description: format!("registry {local}"),
+            input_schema: json!({
+                "type": "object",
+                "properties": {
+                    "intent": {"type": "string"},
+                    "file_path": {"type": "string"}
+                },
+                "required": ["file_path"]
+            }),
+            defer_loading: false,
+        };
+        let api = format_tools(std::slice::from_ref(&def), false, false);
+        let oauth_tools = format_tools(std::slice::from_ref(&def), true, false);
+        assert_eq!(oauth_tools.len(), 1);
+        assert_eq!(oauth_tools[0].name, oauth);
+        assert_eq!(oauth_tools[0].description, def.description);
+        assert_eq!(oauth_tools[0].input_schema, api[0].input_schema);
+        assert!(oauth_tools[0].input_schema["properties"]["intent"].is_object());
+    }
+}
```

---

### Incident Patch 4: `0a74e5b9` (2026-10-05)
**Commit Message**: Merge pull request #1711 from SK-DEV-AI/fix/upstream-crash-detector-idle-close

fix: idle-vs-interrupted disposition in PID crash detector (extends #988)

**File**: `crates/jcode-base/src/session/crash.rs` (modified, +77/-4)
```diff
@@ -349,10 +349,25 @@ fn find_crashed_via_pid_files() -> Option<Vec<(String, String)>> {
 
         match Session::load(&session_id) {
             Ok(mut session) => {
-                session.mark_crashed(Some(format!(
-                    "Process {} exited unexpectedly (no shutdown signal captured)",
-                    pid
-                )));
+                // Idle-vs-interrupted disposition (upstream #988, extended to
+                // the PID detector): losing the process is only a crash when
+                // it interrupts unfinished work. A leftover streaming marker
+                // proves the session was mid-turn when its owner died
+                // (`StreamingGuard` clears the marker on every exit path —
+                // normal return, `?`, interrupt, panic — so only a killed
+                // process leaves one behind). No marker = idle = ordinary
+                // close, same as the disconnect path's idle rule. This stops
+                // daemon restarts stamping every owned idle session Crashed.
+                // Fail toward crash when the marker dir is unreadable: crash
+                // recovery is fail-noisy, never fail-silent.
+                if had_streaming_marker(&session_id) {
+                    session.mark_crashed(Some(format!(
+                        "Process {} exited unexpectedly (no shutdown signal captured)",
+                        pid
+                    )));
+                } else {
+                    session.mark_closed();
+                }
                 let _ = session.save();
                 let ts = session.last_active_at.unwrap_or(session.updated_at);
                 if ts <= cutoff {
@@ -378,6 +393,22 @@ fn find_crashed_via_pid_files() -> Option<Vec<(String, String)>> {
     )
 }
 
+/// True when a streaming marker file exists for this session — i.e. the
+/// session was mid-turn when its owner died. Any content counts (even a
+/// stale marker naming the dead owner): `StreamingGuard` removes the file
+/// on every orderly exit, so presence alone proves interruption. Missing
+/// marker dir or I/O error returns true (fail toward crash recovery, never
+/// silently close a session that may hold interrupted work).
+fn had_streaming_marker(session_id: &str) -> bool {
+    let Some(dir) = storage::streaming_pids_dir() else {
+        return true;
+    };
+    match std::fs::read_dir(&dir) {
+        Ok(_) => dir.join(session_id).exists(),
+        Err(_) => true,
+    }
+}
+
 /// Legacy fallback: scan the full sessions directory.
 /// Used only on the first launch after upgrading to the active_pids system.
 fn find_crashed_legacy_scan() -> Vec<(String, String)> {
@@ -664,6 +695,48 @@ mod batch_crash_tests {
         assert_eq!(info.display_names[0], "fox");
     }
 
+    #[test]
+    fn idle_dead_pid_without_streaming_marker_is_not_a_crash() {
+        // Upstream #988 extended to the PID detector: a dead owner PID with
+        // no leftover streaming marker means the session was idle — ordinary
+        // close, not crash. Daemon restarts must not stamp idle sessions.
+        let _guard = crate::storage::lock_test_env();
+        let temp = tempfile::tempdir().expect("tempdir");
+        crate::env::set_var("JCODE_HOME", temp.path());
+
+        let dir = storage::streaming_pids_dir().expect("streaming dir");
+        std::fs::create_dir_all(&dir).expect("marker dir");
+        assert!(
+            !had_streaming_marker("session_idle_1"),
+            "no marker file means idle"
+        );
+
+        crate::env::remove_var("JCODE_HOME");
+    }
+
+    #[test]
+    fn leftover_streaming_marker_means_interrupted() {
+        // A marker file left behind (StreamingGuard clears it on every
+        // orderly exit) proves the owner died mid-turn — genuine crash.
+        let _guard = crate::storage::lock_test_env();
+        let temp = tempfile::tempdir().expect("tempdir");
+        crate::env::set_var("JCODE_HOME", temp.path());
+
+        let dir = storage::streaming_pids_dir().expect("streaming dir");
+        std::fs::create_dir_all(&dir).expect("marker dir");
+        std::fs::write(dir.join("session_midturn_1"), "999999").expect("marker");
+        assert!(
+            had_streaming_marker("session_midturn_1"),
+            "leftover marker means interrupted"
+        );
+        assert!(
+            !had_streaming_marker("session_other_1"),
+            "other sessions unaffected"
+        );
+
+        crate::env::remove_var("JCODE_HOME");
+    }
+
     #[test]
     fn find_session_by_name_or_id_matches_custom_title() {
         let _guard = crate::storage::lock_test_env();
```

---

### Incident Patch 5: `8441779e` (2026-10-05)
**Commit Message**: Merge pull request #1714 from mg-mg-mg/fix/korean-undo-coalescing

Group contiguous TUI typing into one undo step

**File**: `crates/jcode-tui/src/tui/app.rs` (modified, +1/-0)
```diff
@@ -1553,6 +1553,7 @@ pub struct App {
     stashed_input: Option<(String, usize)>,
     // Undo history for in-progress input editing (Ctrl+Z)
     input_undo_stack: Vec<(String, usize)>,
+    input_typing_undo: Option<(Instant, usize)>,
     // Draft replaced by an explicit jump into prompt history (Ctrl+Up),
     // restored when Down walks back past the newest entry
     history_draft: Option<(String, usize)>,
```

**File**: `crates/jcode-tui/src/tui/app/input.rs` (modified, +16/-2)
```diff
@@ -984,6 +984,10 @@ pub(super) fn strip_osc_color_replies(input: &str, cursor: usize) -> Option<(Str
 }
 
 pub(super) fn insert_input_text(app: &mut App, text: &str) {
+    insert_input_text_with_undo(app, text, false);
+}
+
+fn insert_input_text_with_undo(app: &mut App, text: &str, typed: bool) {
     if text.is_empty() {
         return;
     }
@@ -1010,10 +1014,18 @@ pub(super) fn insert_input_text(app: &mut App, text: &str) {
     // a single separator.
     if text == " " && at_end && matches!(app.input.trim_start(), "/login " | "/model " | "/models ")
     {
+        app.input_typing_undo = None;
         return;
     }
 
-    app.remember_input_undo_state();
+    let typing = typed && !text.chars().any(char::is_whitespace);
+    let same_burst = typing
+        && app.input_typing_undo.is_some_and(|(last, end)| {
+            end == app.cursor_pos && last.elapsed() < Duration::from_secs(1)
+        });
+    if !same_burst {
+        app.remember_input_undo_state();
+    }
 
     // After a picker command is fully typed (or completed without a trailing
     // space), the next printable character starts its filter. Insert the
@@ -1040,6 +1052,8 @@ pub(super) fn insert_input_text(app: &mut App, text: &str) {
         app.cursor_pos = app.input.len();
     }
 
+    app.input_typing_undo = typing.then_some((Instant::now(), app.cursor_pos));
+
     app.reset_tab_completion();
     app.sync_model_picker_preview_from_input();
 }
@@ -1080,7 +1094,7 @@ pub(super) fn handle_text_input(app: &mut App, text: &str) -> bool {
         }
     }
 
-    insert_input_text(app, text);
+    insert_input_text_with_undo(app, text, true);
     // A key stream may still be receiving the rest of a multi-file drop. Do not
     // strip quoting from a verified non-image prefix until submission, otherwise
     // later paths make its now-unquoted spaces ambiguous.
```

**File**: `crates/jcode-tui/src/tui/app/remote/input_dispatch.rs` (modified, +1/-0)
```diff
@@ -360,6 +360,7 @@ pub(in crate::tui::app) fn finish_remote_split_launch(app: &mut App) {
 }
 
 fn set_transcript_input(app: &mut App, text: String) {
+    app.input_typing_undo = None;
     app.input = text;
     app.cursor_pos = app.input.len();
     app.reset_tab_completion();
```

**File**: `crates/jcode-tui/src/tui/app/state_ui_input_helpers.rs` (modified, +3/-0)
```diff
@@ -1726,6 +1726,7 @@ impl App {
     }
 
     pub(super) fn remember_input_undo_state(&mut self) {
+        self.input_typing_undo = None;
         let snapshot = (self.input.clone(), self.cursor_pos.min(self.input.len()));
         if self.input_undo_stack.last() == Some(&snapshot) {
             return;
@@ -1738,10 +1739,12 @@ impl App {
 
     pub(super) fn clear_input_undo_history(&mut self) {
         self.input_undo_stack.clear();
+        self.input_typing_undo = None;
         self.history_draft = None;
     }
 
     pub(super) fn undo_input_change(&mut self) {
+        self.input_typing_undo = None;
         if let Some((input, cursor_pos)) = self.input_undo_stack.pop() {
             // The composer now holds a restored draft, so the copy stashed by a
             // history jump is stale: a later Down must not resurrect it.
```

**File**: `crates/jcode-tui/src/tui/app/tests/remote_startup_input_02/part_01.rs` (modified, +82/-6)
```diff
@@ -1026,8 +1026,84 @@ fn test_handle_key_super_z_undoes_input_change() {
     app.handle_key(KeyCode::Char('z'), KeyModifiers::SUPER)
         .unwrap();
 
-    assert_eq!(app.input(), "a");
-    assert_eq!(app.cursor_pos(), 1);
+    assert_eq!(app.input(), "");
+    assert_eq!(app.cursor_pos(), 0);
+}
+
+#[test]
+fn test_korean_typing_undo_groups_contiguous_syllables() {
+    let mut app = create_test_app();
+    for syllable in ['가', '나', '다'] {
+        app.handle_key(KeyCode::Char(syllable), KeyModifiers::empty())
+            .unwrap();
+    }
+    assert_eq!(app.input(), "가나다");
+    app.handle_key(KeyCode::Char('z'), KeyModifiers::SUPER)
+        .unwrap();
+    assert_eq!(app.input(), "");
+    assert_eq!(app.cursor_pos(), 0);
+
+    input::handle_text_input(&mut app, "가");
+    input::handle_text_input(&mut app, "나다");
+    assert_eq!(app.input(), "가나다");
+    app.handle_key(KeyCode::Char('z'), KeyModifiers::SUPER)
+        .unwrap();
+    assert_eq!(app.input(), "");
+}
+
+#[test]
+fn test_typing_undo_preserves_space_and_cursor_edit_boundaries() {
+    let mut app = create_test_app();
+    for c in ['가', '나', ' ', '다'] {
+        app.handle_key(KeyCode::Char(c), KeyModifiers::empty())
+            .unwrap();
+    }
+    app.handle_key(KeyCode::Char('z'), KeyModifiers::SUPER)
+        .unwrap();
+    assert_eq!(app.input(), "가나 ");
+    app.handle_key(KeyCode::Char('z'), KeyModifiers::SUPER)
+        .unwrap();
+    assert_eq!(app.input(), "가나");
+    app.handle_key(KeyCode::Left, KeyModifiers::empty()).unwrap();
+    app.handle_key(KeyCode::Char('다'), KeyModifiers::empty())
+        .unwrap();
+    app.handle_key(KeyCode::Char('z'), KeyModifiers::SUPER)
+        .unwrap();
+    assert_eq!(app.input(), "가나");
+}
+
+#[test]
+fn test_typing_undo_does_not_merge_paste_or_later_burst() {
+    let mut app = create_test_app();
+    app.handle_key(KeyCode::Char('가'), KeyModifiers::empty())
+        .unwrap();
+    input::insert_input_text(&mut app, "붙여넣기");
+    app.handle_key(KeyCode::Char('나'), KeyModifiers::empty())
+        .unwrap();
+    app.undo_input_change();
+    assert_eq!(app.input(), "가붙여넣기");
+    app.undo_input_change();
+    assert_eq!(app.input(), "가");
+
+    app.input_typing_undo = Some((Instant::now() - Duration::from_secs(2), app.cursor_pos()));
+    app.handle_key(KeyCode::Char('다'), KeyModifiers::empty())
+        .unwrap();
+    app.undo_input_change();
+    assert_eq!(app.input(), "가");
+}
+
+#[test]
+fn test_picker_swallowed_space_starts_new_typing_undo_step() {
+    let mut app = create_test_app();
+    for c in "/model".chars() {
+        app.handle_key(KeyCode::Char(c), KeyModifiers::empty()).unwrap();
+    }
+    assert_eq!(app.input(), "/model ");
+    app.handle_key(KeyCode::Char(' '), KeyModifiers::empty()).unwrap();
+    app.handle_key(KeyCode::Char('g'), KeyModifiers::empty()).unwrap();
+    assert_eq!(app.input(), "/model g");
+    app.undo_input_change();
+    assert_eq!(app.input(), "/model ");
 }
 
 #[test]
@@ -1102,13 +1178,13 @@ fn test_handle_key_ctrl_z_undoes_typing() {
 
     app.handle_key(KeyCode::Char('z'), KeyModifiers::CONTROL)
         .unwrap();
-    assert_eq!(app.input(), "ab");
-    assert_eq!(app.cursor_pos(), 2);
+    assert_eq!(app.input(), "");
+    assert_eq!(app.cursor_pos(), 0);
 
     app.handle_key(KeyCode::Char('z'), KeyModifiers::CONTROL)
         .unwrap();
-    assert_eq!(app.input(), "a");
-    assert_eq!(app.cursor_pos(), 1);
+    assert_eq!(app.input(), "");
+    assert_eq!(app.cursor_pos(), 0);
 }
 
 #[test]
```

**File**: `crates/jcode-tui/src/tui/app/tests/remote_startup_input_04.rs` (modified, +23/-0)
```diff
@@ -41,6 +41,29 @@ fn test_handle_server_event_transcript_replace_updates_input() {
     );
 }
 
+#[test]
+fn test_transcript_replacement_starts_new_typing_undo_step() {
+    let mut app = create_test_app();
+    let rt = tokio::runtime::Runtime::new().unwrap();
+    let _guard = rt.enter();
+    let mut remote = crate::tui::backend::RemoteConnection::dummy();
+
+    for c in ['d', 'o', 'g'] {
+        app.handle_key(KeyCode::Char(c), KeyModifiers::empty()).unwrap();
+    }
+    app.handle_server_event(
+        crate::protocol::ServerEvent::Transcript {
+            text: "cat".to_string(),
+            mode: crate::protocol::TranscriptMode::Replace,
+        },
+        &mut remote,
+    );
+    app.handle_key(KeyCode::Char('s'), KeyModifiers::empty()).unwrap();
+    assert_eq!(app.input(), "cats");
+    app.undo_input_change();
+    assert_eq!(app.input(), "cat");
+}
+
 #[test]
 fn test_local_bus_dictation_completion_applies_transcript() {
     let mut app = create_test_app();
```

**File**: `crates/jcode-tui/src/tui/app/tui_lifecycle.rs` (modified, +2/-0)
```diff
@@ -691,6 +691,7 @@ impl App {
             typing_scroll_lock: false,
             stashed_input: None,
             input_undo_stack: Vec::new(),
+            input_typing_undo: None,
             history_draft: None,
             status_notice: None,
             learn_hint: None,
@@ -1151,6 +1152,7 @@ impl App {
             typing_scroll_lock: false,
             stashed_input: None,
             input_undo_stack: Vec::new(),
+            input_typing_undo: None,
             history_draft: None,
             status_notice: None,
             learn_hint: None,
```

---

### Incident Patch 6: `790d6d77` (2026-10-05)
**Commit Message**: chore(ci): shrink oversized files and fix clippy redundant_closure for Quality Guardrails

**File**: `crates/jcode-app-core/src/update.rs` (modified, +6/-617)
```diff
@@ -1190,32 +1190,8 @@ fn patch_termux_interpreter_if_needed(binary: &Path) -> Result<()> {
 }
 
 #[cfg(test)]
-mod termux_tests {
-    use super::*;
-
-    #[test]
-    fn detects_termux_like_install_sh() {
-        assert!(is_termux_env(Some("0.118"), None, false));
-        assert!(is_termux_env(None, Some(TERMUX_PREFIX), false));
-        assert!(is_termux_env(None, None, true));
-        assert!(!is_termux_env(None, Some("/usr"), false));
-        assert!(!is_termux_env(Some(""), None, false));
-    }
-
-    #[test]
-    fn picks_glibc_interpreter_per_arch() {
-        assert_eq!(
-            termux_glibc_interpreter("linux", "aarch64").as_deref(),
-            Some("/data/data/com.termux/files/usr/glibc/lib/ld-linux-aarch64.so.1")
-        );
-        assert_eq!(
-            termux_glibc_interpreter("linux", "x86_64").as_deref(),
-            Some("/data/data/com.termux/files/usr/glibc/lib/ld-linux-x86-64.so.2")
-        );
-        assert_eq!(termux_glibc_interpreter("linux", "riscv64"), None);
-        assert_eq!(termux_glibc_interpreter("macos", "aarch64"), None);
-    }
-}
+#[path = "update_termux_tests.rs"]
+mod termux_tests;
 
 pub fn check_and_maybe_update(auto_install: bool) -> UpdateCheckResult {
     use crate::bus::{Bus, BusEvent, UpdateStatus};
@@ -1323,596 +1299,9 @@ fn repair_stale_shared_server_after_no_update() {
 }
 
 #[cfg(test)]
-mod tests {
-    use super::*;
-    use jcode_update_core::parse_sha256sums;
-    use sha2::{Digest, Sha256};
-
-    #[test]
-    fn test_version_is_newer() {
-        assert!(version_is_newer("0.1.3", "0.1.2"));
-        assert!(version_is_newer("0.2.0", "0.1.9"));
-        assert!(version_is_newer("1.0.0", "0.9.9"));
-        assert!(!version_is_newer("0.1.2", "0.1.2"));
-        assert!(!version_is_newer("0.1.1", "0.1.2"));
-        assert!(!version_is_newer("0.0.9", "0.1.0"));
-    }
-
-    #[test]
-    fn test_asset_name() {
-        let name = get_asset_name();
-        assert!(name.starts_with("jcode-"));
-    }
-
-    #[test]
-    fn test_format_download_progress_bar_known_total() {
-        let rendered = format_download_progress_bar(DownloadProgress {
-            downloaded: 512,
-            total: Some(1024),
-        });
-        assert!(rendered.contains("50%"));
-        assert!(rendered.contains("512 B/1.0 KiB"));
-        assert!(rendered.contains('█'));
-        assert!(rendered.contains('░'));
-    }
-
-    #[test]
-    fn test_format_download_progress_bar_unknown_total() {
-        let rendered = format_download_progress_bar(DownloadProgress {
-            downloaded: 2 * 1024 * 1024,
-            total: None,
-        });
-        assert_eq!(rendered, "Downloading update... 2.0 MiB downloaded");
-    }
-
-    #[test]
-    fn test_parse_sha256sums_accepts_standard_and_binary_lines() {
-        let digest_a = "a".repeat(64);
-        let digest_b = "B".repeat(64);
-        let digest_b_lower = "b".repeat(64);
-        let contents = format!(
-            "# generated by release workflow\n{}  jcode-linux-x86_64.tar.gz\r\n{} *jcode-windows-x86_64.exe\n",
-            digest_a, digest_b
-        );
-        let parsed = parse_sha256sums(&contents).unwrap();
-        assert_eq!(
-            parsed.get("jcode-linux-x86_64.tar.gz").map(String::as_str),
-            Some(digest_a.as_str())
-        );
-        assert_eq!(
-            parsed.get("jcode-windows-x86_64.exe").map(String::as_str),
-            Some(digest_b_lower.as_str())
-        );
-    }
-
-    #[test]
-    fn test_verify_asset_checksum_text_accepts_matching_digest() {
-        let bytes = b"hello update";
-        let digest = format!("{:x}", Sha256::digest(bytes));
-        let contents = format!("{}  jcode-linux-x86_64.tar.gz\n", digest);
-        verify_asset_checksum_text(&contents, "jcode-linux-x86_64.tar.gz", bytes).unwrap();
-    }
-
-    #[test]
-    fn test_verify_asset_checksum_text_rejects_mismatch() {
-        let wrong = "0".repeat(64);
-        let contents = format!("{}  jcode-linux-x86_64.tar.gz\n", wrong);
-        let err = verify_asset_checksum_text(&contents, "jcode-linux-x86_64.tar.gz", b"actual")
-            .unwrap_err()
-            .to_string();
-        assert!(err.contains("Checksum mismatch"));
-    }
-
-    #[test]
-    fn test_verify_asset_checksum_text_requires_asset_entry() {
-        let digest = "1".repeat(64);
-        let contents = format!("{}  other-asset.tar.gz\n", digest);
-        let err = verify_asset_checksum_text(&contents, "jcode-linux-x86_64.tar.gz", b"actual")
-            .unwrap_err()
-            .to_string();
-        assert!(err.contains("does not list"));
-    }
-
-    #[test]
-    fn test_parse_sha256sums_rejects_invalid_digest() {
-        let err = parse_sha256sums("not-a-sha  jcode-linux-x86_64.tar.gz\n")
-            .unwrap_err()
-            .to_string();
-        assert!(err.contains("invalid SHA256 digest"));
-    }
-
-    #[test]
-    fn release_update_rejects_equal_or_older_versions_without_ancestry_probe() {
```

**File**: `crates/jcode-provider-copilot-runtime/src/lib.rs` (modified, +3/-46)
```diff
@@ -28,6 +28,9 @@ use tokio::sync::mpsc;
 use tokio_stream::wrappers::ReceiverStream;
 use uuid::Uuid;
 
+mod routing;
+use routing::*;
+
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 enum CatalogSource {
     None,
@@ -57,38 +60,6 @@ pub struct CopilotApiProvider {
     created_at: std::time::Instant,
 }
 
-/// Reasoning efforts supported by Copilot's claude-sonnet-5 route,
-/// per live `/models` capabilities (issue #558).
-const SONNET5_EFFORTS: [&str; 5] = ["low", "medium", "high", "xhigh", "max"];
-
-/// Efforts for `model`: catalog-advertised levels when known, else the
-/// claude-sonnet-5 fallback used before the catalog is available.
-fn copilot_model_efforts(
-    catalog: &std::collections::HashMap<String, Vec<String>>,
-    model: &str,
-) -> Vec<String> {
-    if let Some(levels) = catalog.get(model) {
-        return levels.clone();
-    }
-    if model == "claude-sonnet-5" {
-        SONNET5_EFFORTS.iter().map(|e| e.to_string()).collect()
-    } else {
-        Vec::new()
-    }
-}
-
-fn copilot_model_uses_responses_api(model: &str) -> bool {
-    model.trim().to_ascii_lowercase().starts_with("gpt-5.6")
-}
-
-fn copilot_api_path(uses_responses_api: bool) -> &'static str {
-    if uses_responses_api {
-        "responses"
-    } else {
-        "chat/completions"
-    }
-}
-
 impl CopilotApiProvider {
     #[cfg(test)]
     fn max_token_parameter_for_model(model: &str) -> &'static str {
@@ -951,20 +922,6 @@ impl CopilotApiProvider {
     }
 }
 
-fn is_retryable_error(error_str: &str) -> bool {
-    jcode_provider_core::is_transient_transport_error(error_str)
-        || error_str.contains("500 internal server error")
-        || error_str.contains("502 bad gateway")
-        || error_str.contains("503 service unavailable")
-        || error_str.contains("504 gateway timeout")
-        || error_str.contains("overloaded")
-        || error_str.contains("429 too many requests")
-        || error_str.contains("rate limit")
-        || error_str.contains("rate_limit")
-        || error_str.contains("stream error")
-        || error_str.contains("stream read timeout")
-}
-
 #[async_trait]
 impl Provider for CopilotApiProvider {
     async fn complete(
```

**File**: `crates/jcode-provider-openrouter-runtime/src/lib.rs` (modified, +6/-100)
```diff
@@ -51,6 +51,9 @@ use std::sync::{Arc, Mutex, OnceLock};
 use tokio::sync::{RwLock, mpsc};
 use tokio_stream::wrappers::ReceiverStream;
 
+mod request_headers;
+use request_headers::*;
+
 /// Base delay for exponential backoff (in milliseconds)
 const RETRY_BASE_DELAY_MS: u64 = 1000;
 
@@ -59,8 +62,6 @@ const DEFAULT_API_BASE: &str = "https://openrouter.ai/api/v1";
 const DEFAULT_API_KEY_NAME: &str = "OPENROUTER_API_KEY";
 const DEFAULT_ENV_FILE: &str = "openrouter.env";
 const OPENROUTER_TRANSPORT_STATE_ENV: &str = "JCODE_OPENROUTER_TRANSPORT_STATE";
-const KIMI_CODING_USER_AGENT: &str = "claude-cli/1.0.0";
-const KIMI_CODING_X_APP: &str = "cli";
 
 /// Default model (Claude Sonnet via OpenRouter)
 const DEFAULT_MODEL: &str = "anthropic/claude-sonnet-4";
@@ -391,78 +392,6 @@ impl OpenRouterTransportState {
     }
 }
 
-fn is_kimi_coding_api_base(api_base: &str) -> bool {
-    let Ok(url) = reqwest::Url::parse(api_base) else {
-        return false;
-    };
-    matches!(url.host_str(), Some("api.kimi.com"))
-        && url.path().trim_end_matches('/').starts_with("/coding")
-}
-
-fn is_coding_agent_api_base(api_base: &str) -> bool {
-    let Ok(url) = reqwest::Url::parse(api_base) else {
-        return false;
-    };
-    let host = url.host_str().unwrap_or_default();
-    let path = url.path().trim_end_matches('/');
-    is_kimi_coding_api_base(api_base)
-        || host == "coding.dashscope.aliyuncs.com"
-        || host == "coding-intl.dashscope.aliyuncs.com"
-        || (host == "api.z.ai" && path.starts_with("/api/coding/paas"))
-}
-
-fn is_kimi_model_name(model: &str) -> bool {
-    model.to_ascii_lowercase().contains("kimi")
-}
-
-fn should_send_kimi_coding_agent_headers(api_base: &str, model: Option<&str>) -> bool {
-    is_coding_agent_api_base(api_base) || model.map(is_kimi_model_name).unwrap_or(false)
-}
-
-fn apply_kimi_coding_agent_headers(
-    req: reqwest::RequestBuilder,
-    api_base: &str,
-    model: Option<&str>,
-) -> reqwest::RequestBuilder {
-    if should_send_kimi_coding_agent_headers(api_base, model) {
-        req.header("User-Agent", KIMI_CODING_USER_AGENT)
-            .header("x-app", KIMI_CODING_X_APP)
-    } else {
-        req
-    }
-}
-
-/// Hosts that require the `x-opencode-session` header (issue #1167).
-fn is_opencode_api_base(api_base: &str) -> bool {
-    let Ok(url) = reqwest::Url::parse(api_base) else {
-        return false;
-    };
-    matches!(
-        url.host_str(),
-        Some(host) if host == "opencode.ai" || host.ends_with(".opencode.ai")
-    )
-}
-
-pub(crate) fn new_conversation_id() -> String {
-    uuid::Uuid::new_v4().to_string()
-}
-
-/// OpenCode Go/Zen require a stable per-conversation `x-opencode-session`
-/// header on inference requests (rejected from 2026-09-05 without it).
-fn apply_opencode_session_header(
-    req: reqwest::RequestBuilder,
-    api_base: &str,
-    conversation_id: &str,
-) -> reqwest::RequestBuilder {
-    if is_opencode_api_base(api_base) {
-        req.header(OPENCODE_SESSION_HEADER, conversation_id)
-    } else {
-        req
-    }
-}
-
-pub(crate) const OPENCODE_SESSION_HEADER: &str = "x-opencode-session";
-
 /// Models the Grok CLI chat proxy serves to Grok Build subscribers.
 pub const GROK_BUILD_MODELS: &[&str] = &["grok-4.6", "grok-4.5", "grok-code-fast-1"];
 const GROK_BUILD_AUTH_LABEL: &str = "Grok Build subscription (Grok CLI OIDC)";
@@ -1684,7 +1613,7 @@ impl OpenRouterProvider {
         let supports_provider_features = provider_features_enabled(&api_base);
         let supports_model_catalog = model_catalog_enabled();
         let send_openrouter_headers = supports_provider_features;
-        let auth: AuthResolver = Arc::new(|| Self::resolve_auth());
+        let auth: AuthResolver = Arc::new(Self::resolve_auth);
         auth()?;
         let profile_id = std::env::var("JCODE_OPENROUTER_CACHE_NAMESPACE")
             .ok()
@@ -2983,28 +2912,5 @@ mod openrouter_input_modalities_tests;
 mod issue_1056_tests;
 
 #[cfg(test)]
-mod profile_catalog_backoff_tests {
-    use super::{MODEL_CATALOG_REFRESH_RETRY_SECS, profile_catalog_retry_delay_secs};
-
-    #[test]
-    fn healthy_profile_uses_base_retry_interval() {
-        assert_eq!(
-            profile_catalog_retry_delay_secs(0),
-            MODEL_CATALOG_REFRESH_RETRY_SECS
-        );
-    }
-
-    #[test]
-    fn repeated_failures_back_off_exponentially_and_cap() {
-        assert_eq!(
-            profile_catalog_retry_delay_secs(1),
-            MODEL_CATALOG_REFRESH_RETRY_SECS * 2
-        );
-        assert_eq!(
-            profile_catalog_retry_delay_secs(3),
-            MODEL_CATALOG_REFRESH_RETRY_SECS * 8
-        );
-        // Capped at one hour no matter how many failures accumulate.
-        assert_eq!(profile_catalog_retry_delay_secs(20), 60 * 60);
-    }
-}
+#[path = "profile_catalog_backoff_tests.rs"]
+mod profile_catalog_backoff_tests;
```

**File**: `crates/jcode-provider-openrouter-runtime/src/openrouter_tests.rs` (modified, +2/-291)
```diff
@@ -3640,294 +3640,5 @@ fn named_openai_compatible_provider_keeps_stable_name_and_profile_display_name()
     assert_eq!(Provider::display_name(&provider), "example-compat");
 }
 
-/// Issue #1167: OpenCode Go/Zen require a stable per-conversation
-/// `x-opencode-session` header; other OpenAI-compatible hosts must not get it.
-#[test]
-fn opencode_session_header_only_for_opencode_hosts() {
-    assert!(is_opencode_api_base("https://opencode.ai/zen/go/v1"));
-    assert!(is_opencode_api_base("https://opencode.ai/zen/v1"));
-    assert!(is_opencode_api_base("https://api.opencode.ai/v1"));
-    assert!(!is_opencode_api_base("https://openrouter.ai/api/v1"));
-    assert!(!is_opencode_api_base("https://api.deepseek.com/v1"));
-    assert!(!is_opencode_api_base("not a url"));
-
-    let client = reqwest::Client::new();
-    let req = apply_opencode_session_header(
-        client.post("https://opencode.ai/zen/go/v1/chat/completions"),
-        "https://opencode.ai/zen/go/v1",
-        "conv-123",
-    )
-    .build()
-    .unwrap();
-    assert_eq!(
-        req.headers()
-            .get(OPENCODE_SESSION_HEADER)
-            .and_then(|v| v.to_str().ok()),
-        Some("conv-123")
-    );
-
-    let req = apply_opencode_session_header(
-        client.post("https://openrouter.ai/api/v1/chat/completions"),
-        "https://openrouter.ai/api/v1",
-        "conv-123",
-    )
-    .build()
-    .unwrap();
-    assert!(req.headers().get(OPENCODE_SESSION_HEADER).is_none());
-}
-
-#[test]
-fn opencode_session_ids_are_uuids_and_unique() {
-    let a = new_conversation_id();
-    let b = new_conversation_id();
-    assert_ne!(a, b);
-    assert!(uuid::Uuid::parse_str(&a).is_ok());
-}
-
-/// Wire-level check for issue #1167: a real `chat/completions` request whose
-/// api_base host is `opencode.ai` carries `x-opencode-session`, and a
-/// request to another host does not. The DNS override points the hostname at
-/// a local listener, so the full stream path (including retries) is exercised.
-fn spawn_header_capturing_server() -> (std::net::SocketAddr, std::sync::mpsc::Receiver<String>) {
-    use std::io::{Read, Write};
-    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
-    let addr = listener.local_addr().expect("addr");
-    let (tx, rx) = std::sync::mpsc::channel::<String>();
-    std::thread::spawn(move || {
-        let (mut stream, _) = listener.accept().expect("accept");
-        stream
-            .set_read_timeout(Some(Duration::from_secs(5)))
-            .expect("read timeout");
-        let mut buf = vec![0u8; 65536];
-        let n = stream.read(&mut buf).unwrap_or(0);
-        let _ = tx.send(String::from_utf8_lossy(&buf[..n]).to_string());
-        let body = "data: {\"choices\":[{\"delta\":{\"content\":\"ok\"},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n";
-        let response = format!(
-            "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
-            body.len(),
-            body
-        );
-        let _ = stream.write_all(response.as_bytes());
-    });
-    (addr, rx)
-}
-
-fn captured_request_for_host(host: &str, conversation_id: &str) -> String {
-    let rt = tokio::runtime::Builder::new_current_thread()
-        .enable_all()
-        .build()
-        .expect("runtime");
-    rt.block_on(async {
-        let (addr, rx) = spawn_header_capturing_server();
-        let client = reqwest::Client::builder()
-            .resolve(host, addr)
-            .build()
-            .expect("client");
-        let api_base = format!("http://{host}:{}/zen/go/v1", addr.port());
-        let (tx, mut events) = tokio::sync::mpsc::channel::<anyhow::Result<StreamEvent>>(64);
-        super::openrouter_sse_stream::run_stream_with_retries(
-            client,
-            api_base,
-            ProviderAuth::None {
-                label: "test".to_string(),
-            },
-            false,
-            conversation_id.to_string(),
-            serde_json::json!({"model": "m", "messages": [], "stream": true}),
-            tx,
-            Arc::new(Mutex::new(None)),
-            "m".to_string(),
-        )
-        .await;
-        while events.recv().await.is_some() {}
-        rx.recv_timeout(Duration::from_secs(5))
-            .expect("server captured request")
-    })
-}
-
-#[test]
-fn opencode_session_header_is_sent_on_the_wire_only_to_opencode_hosts() {
-    let raw = captured_request_for_host("opencode.ai", "conv-wire-1167").to_ascii_lowercase();
-    assert!(
-        raw.contains("x-opencode-session: conv-wire-1167"),
-        "opencode.ai request lacked the header:\n{raw}"
-    );
-
-    let raw = captured_request_for_host("example.test", "conv-wire-1167").to_ascii_lowercase();
-    assert!(
-        !raw.contains("x-opencode-session"),
-        "non-opencode host received the header:\n{raw}"
-    );
-}
-
-#[test]
-fn configured_swarm_root_effort_covers_all_wire_formats() {
-    let unified = mak
```

**File**: `crates/jcode-provider-openrouter/src/stream.rs` (modified, +2/-635)
```diff
@@ -567,638 +567,5 @@ impl Stream for OpenRouterStream {
 }
 
 #[cfg(test)]
-mod tests {
-    use super::*;
-    use futures::StreamExt;
-
-    fn drain_text(stream: &mut OpenRouterStream) -> String {
-        let mut text = String::new();
-        while let Some(event) = stream.parse_next_event() {
-            match event {
-                StreamEvent::TextDelta(delta) => text.push_str(&delta),
-                StreamEvent::MessageEnd { .. } => break,
-                _ => {}
-            }
-        }
-        text
-    }
-
-    fn test_stream() -> OpenRouterStream {
-        OpenRouterStream::new(
-            futures::stream::empty(),
-            "test-model".to_string(),
-            Arc::new(std::sync::Mutex::new(None)),
-        )
-    }
-
-    #[test]
-    fn take_sse_event_splits_crlf_delimited_events() {
-        let mut buffer = "data: a\r\n\r\ndata: b\r\n\r\n".to_string();
-        assert_eq!(take_sse_event(&mut buffer).as_deref(), Some("data: a"));
-        assert_eq!(take_sse_event(&mut buffer).as_deref(), Some("data: b"));
-        assert_eq!(take_sse_event(&mut buffer), None);
-    }
-
-    #[test]
-    fn parse_next_event_keeps_all_content_across_crlf_batched_events() {
-        let mut stream = test_stream();
-        stream.buffer = [
-            "data: {\"choices\":[{\"delta\":{\"content\":\"hello\"}}]}",
-            "data: {\"choices\":[{\"delta\":{\"content\":\" world\"}}]}",
-            "data: {\"choices\":[{\"delta\":{\"content\":\"!\"}}]}",
-            "data: [DONE]",
-            "",
-        ]
-        .join("\r\n\r\n");
-
-        assert_eq!(drain_text(&mut stream), "hello world!");
-    }
-
-    #[test]
-    fn parse_next_event_keeps_all_data_lines_within_one_event() {
-        // Several data: lines inside one \n\n-delimited block must all be kept.
-        let mut stream = test_stream();
-        stream.buffer = concat!(
-            "data: {\"choices\":[{\"delta\":{\"content\":\"foo\"}}]}\n",
-            "data: {\"choices\":[{\"delta\":{\"content\":\"bar\"}}]}\n",
-            "data: [DONE]\n\n"
-        )
-        .to_string();
-
-        assert_eq!(drain_text(&mut stream), "foobar");
-    }
-
-    /// Issue #609: proxies that drop the event separator, split an object across
-    /// two events, or split a multi-byte character across TCP chunks must not
-    /// cause silent data loss.
-    #[test]
-    fn concatenated_json_in_one_event_keeps_both_deltas() {
-        let mut stream = test_stream();
-        stream.buffer = concat!(
-            r#"data: {"choices":[{"delta":{"content":"hello"}}]}"#,
-            r#"{"choices":[{"delta":{"content":" world"}}]}"#,
-            "\n\ndata: [DONE]\n\n"
-        )
-        .to_string();
-
-        assert_eq!(drain_text(&mut stream), "hello world");
-    }
-
-    #[test]
-    fn concatenated_json_with_embedded_data_prefix_keeps_both_deltas() {
-        let mut stream = test_stream();
-        stream.buffer = concat!(
-            r#"data: {"choices":[{"delta":{"content":"hello"}}]}"#,
-            r#"data: {"choices":[{"delta":{"content":" world"}}]}"#,
-            "\n\ndata: [DONE]\n\n"
-        )
-        .to_string();
-
-        assert_eq!(drain_text(&mut stream), "hello world");
-    }
-
-    #[test]
-    fn object_split_across_two_events_is_rejoined() {
-        let mut stream = test_stream();
-        stream.buffer = concat!(
-            r#"data: {"choices":[{"delta":{"content":"Hello "#,
-            "\n\n",
-            r#"data: world"}}]}"#,
-            "\n\ndata: [DONE]\n\n"
-        )
-        .to_string();
-
-        assert_eq!(drain_text(&mut stream), "Hello world");
-    }
-
-    #[test]
-    fn tool_call_arguments_split_across_events_are_not_truncated() {
-        // The reported symptom was `arguments must be a JSON object, got null`.
-        let mut stream = test_stream();
-        stream.buffer = concat!(
-            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"write","arguments":"{\"path\":\"a.txt\""#,
-            "\n\n",
-            r#"data: ,\"content\":\"hi\"}"}}]}}]}"#,
-            "\n\ndata: [DONE]\n\n"
-        )
-        .to_string();
-
-        let mut args = String::new();
-        while let Some(event) = stream.parse_next_event() {
-            if let StreamEvent::ToolInputDeltaFor { delta, .. } = event {
-                args.push_str(&delta);
-            }
-        }
-        let parsed: Value =
-            serde_json::from_str(&args).expect("tool arguments should be complete JSON");
-        assert_eq!(parsed["path"], "a.txt");
-        assert_eq!(parsed["content"], "hi");
-    }
-
-    #[test]
-    fn tool_call_markup_inside_structured_arguments_is_inert() {
-        // #1702: a `write` whose content contains literal XML/DSML tool-call
-        // markup must reach the tool byte-for-byte. jcode must never scan
-        // structured argument JSON for text-form tool calls.
-        let content = "before\n<invoke name=\"bash\">\n<parameter 
```

**File**: `crates/jcode-tui/src/tui/app/model_context.rs` (modified, +3/-123)
```diff
@@ -1868,126 +1868,6 @@ impl App {
     }
 }
 
-pub(super) fn is_refresh_model_list_command(trimmed: &str) -> bool {
-    trimmed == "/refresh-model-list"
-}
-
-pub(super) fn format_model_refresh_summary(
-    summary: &crate::provider::ModelCatalogRefreshSummary,
-) -> String {
-    let mut message = format!(
-        "Model List Refresh Complete\n\nModels: {} → {}  (+{} / -{})\nRoutes: {} → {}  (+{} / -{} / ~{})",
-        summary.model_count_before,
-        summary.model_count_after,
-        summary.models_added,
-        summary.models_removed,
-        summary.route_count_before,
-        summary.route_count_after,
-        summary.routes_added,
-        summary.routes_removed,
-        summary.routes_changed,
-    );
-    append_model_name_diff(&mut message, summary);
-    message
-}
-
-pub(super) fn append_model_name_diff(
-    message: &mut String,
-    summary: &crate::provider::ModelCatalogRefreshSummary,
-) {
-    if !summary.models_added_names.is_empty() {
-        message.push_str("\nAdded models: ");
-        message.push_str(&format_model_name_list(&summary.models_added_names, 12));
-    }
-    if !summary.models_removed_names.is_empty() {
-        message.push_str("\nRemoved models: ");
-        message.push_str(&format_model_name_list(&summary.models_removed_names, 12));
-    }
-}
-
-pub(super) fn format_model_name_list(models: &[String], limit: usize) -> String {
-    let shown = models
-        .iter()
-        .take(limit)
-        .map(|model| model.to_string())
-        .collect::<Vec<_>>()
-        .join(", ");
-    if models.len() > limit {
-        format!("{} … and {} more", shown, models.len() - limit)
-    } else {
-        shown
-    }
-}
-
-pub(super) fn no_models_available_message(is_remote: bool) -> String {
-    let mut lines = vec![
-        "No models are available right now.".to_string(),
-        String::new(),
-        "Next steps:".to_string(),
-        "  - Run /login to connect or refresh a provider".to_string(),
-        "  - Run /account to inspect or switch credentials".to_string(),
-        "  - If you just logged in, wait a moment and try /model again".to_string(),
-    ];
-
-    if is_remote {
-        lines.push(
-            "  - If this is a remote session, reconnect if the server model list looks stale"
-                .to_string(),
-        );
-    }
-
-    lines.join("\n")
-}
-
-pub(super) fn model_switch_failure_message(error: &str, is_remote: bool) -> String {
-    let mut lines = vec![
-        format!("Failed to switch model: {}", error),
-        String::new(),
-        "Next steps:".to_string(),
-        "  - Use /model to choose another available route".to_string(),
-        "  - Run /login to add or refresh credentials".to_string(),
-        "  - Run /account to inspect or switch accounts".to_string(),
-    ];
-
-    if is_remote {
-        lines.push(
-            "  - If this is a remote session and the list looks stale, reconnect and try again"
-                .to_string(),
-        );
-    }
-
-    lines.join("\n")
-}
-
-pub(super) fn unavailable_model_route_message(
-    model: &str,
-    provider: &str,
-    detail: &str,
-    is_remote: bool,
-) -> String {
-    let reason = if detail.trim().is_empty() {
-        "This route is not currently available.".to_string()
-    } else {
-        format!("This route is not currently available: {}", detail.trim())
-    };
-
-    let mut lines = vec![
-        format!("Cannot use {} via {} right now.", model, provider),
-        String::new(),
-        reason,
-        String::new(),
-        "Next steps:".to_string(),
-        "  - Pick another available row in /model".to_string(),
-        "  - Run /login to add or refresh credentials".to_string(),
-        "  - Run /account to inspect or switch accounts".to_string(),
-    ];
-
-    if is_remote {
-        lines.push(
-            "  - If this is a remote session, wait a moment or reconnect if the catalog looks stale"
-                .to_string(),
-        );
-    }
-
-    lines.join("\n")
-}
+#[path = "model_context_messages.rs"]
+mod messages;
+pub(super) use messages::*;
```

**File**: `crates/jcode-tui/src/tui/app/tests/onboarding_flow.rs` (modified, +1/-169)
```diff
@@ -1688,172 +1688,4 @@ fn recent_project_review_falls_back_cleanly_when_no_repo_is_known() {
     }));
 }
 
-#[test]
-fn telemetry_pill_opens_settings_page_and_commits_choice() {
-    use crate::external_auth::ExternalAuthReviewCandidate;
-    use crate::tui::app::onboarding_flow::{ImportReview, TelemetryLevel};
-
-    with_temp_jcode_home(|| {
-        let mut app = create_test_app();
-        app.onboarding_flow = None;
-        app.begin_onboarding_flow_at_login();
-        let review =
-            ImportReview::new(vec![ExternalAuthReviewCandidate::fixture("OpenAI/Codex", "Codex auth.json")])
-                .unwrap();
-        if let Some(flow) = app.onboarding_flow.as_mut() {
-            flow.phase = OnboardingPhase::Login {
-                import: Some(review),
-            };
-        }
-
-        // Right twice: Subscription -> Import less -> Telemetry settings.
-        assert!(app.handle_onboarding_continue_prompt_key(KeyCode::Right));
-        assert!(app.handle_onboarding_continue_prompt_key(KeyCode::Right));
-        assert!(app.handle_onboarding_continue_prompt_key(KeyCode::Enter));
-
-        // The page opens defaulted to "Send everything".
-        match app.onboarding_phase() {
-            Some(OnboardingPhase::Login {
-                import: Some(review),
-            }) => assert_eq!(review.telemetry, Some(TelemetryLevel::Everything)),
-            other => panic!("expected telemetry page open, got {other:?}"),
-        }
-        // The import countdown is paused while the page is open, so the screen
-        // cannot commit the import out from under the user.
-        assert!(!app.onboarding_flow.as_ref().unwrap().decision_timed_out());
-
-        // Enter commits "Send everything": usage on, content sharing on.
-        assert!(app.handle_onboarding_continue_prompt_key(KeyCode::Enter));
-        if !crate::telemetry::opt_out_forced_by_env() {
-            assert!(crate::telemetry::is_enabled());
-            assert!(crate::telemetry::content_sharing_enabled());
-        }
-        let no_telemetry_marker = std::path::Path::new(
-            &std::env::var_os("JCODE_HOME").expect("temporary JCODE_HOME"),
-        )
-        .join("no_telemetry");
-        assert!(
-            !no_telemetry_marker.exists(),
-            "Send everything must remove the persisted opt-out marker"
-        );
-        // We are back on the summary screen with the import still pending.
-        match app.onboarding_phase() {
-            Some(OnboardingPhase::Login {
-                import: Some(review),
-            }) => {
-                assert!(review.telemetry.is_none());
-                assert!(!review.choosing);
-            }
-            other => panic!("expected import summary, got {other:?}"),
-        }
-        assert!(app.onboarding_import_in_progress.is_none());
-    });
-}
-
-#[test]
-fn telemetry_page_send_nothing_disables_telemetry_and_esc_goes_back() {
-    use crate::external_auth::ExternalAuthReviewCandidate;
-    use crate::tui::app::onboarding_flow::ImportReview;
-
-    with_temp_jcode_home(|| {
-        let mut app = create_test_app();
-        app.onboarding_flow = None;
-        app.begin_onboarding_flow_at_login();
-        let review =
-            ImportReview::new(vec![ExternalAuthReviewCandidate::fixture("OpenAI/Codex", "Codex auth.json")])
-                .unwrap();
-        if let Some(flow) = app.onboarding_flow.as_mut() {
-            flow.phase = OnboardingPhase::Login {
-                import: Some(review),
-            };
-        }
-
-        // t is the direct shortcut onto the telemetry page; Esc returns without
-        // changing anything and keeps onboarding active.
-        assert!(app.handle_onboarding_continue_prompt_key(KeyCode::Char('t')));
-        assert!(app.handle_onboarding_continue_prompt_key(KeyCode::Esc));
-        assert!(matches!(
-            app.onboarding_phase(),
-            Some(OnboardingPhase::Login { import: Some(_) })
-        ));
-        if !crate::telemetry::opt_out_forced_by_env() {
-            assert!(crate::telemetry::is_enabled());
-        }
-
-        // Reopen, walk down to "Send nothing", commit.
-        assert!(app.handle_onboarding_continue_prompt_key(KeyCode::Char('t')));
-        assert!(app.handle_onboarding_continue_prompt_key(KeyCode::Down));
-        assert!(app.handle_onboarding_continue_prompt_key(KeyCode::Down));
-        // In the dependency build used by this crate, telemetry-core is not
-        // compiled with cfg(test), so the in-app opt-out event would otherwise
-        // use the real delivery path. Keep the UI preconditions above free of
-        // inherited opt-out env, then force opt-out only for the commit action:
-        // telemetry-core sees delivery blocked by env while still writing the
-        // no_telemetry marker that this test verifies after the guard drops.
-        let delivery_block = EnvRestoreGuard::set("JCODE_NO_TELEMETRY", "1");
-        assert!(app.handle_onboarding_
```

**File**: `scripts/swallowed_error_budget.json` (modified, +15/-10)
```diff
@@ -1,9 +1,9 @@
 {
-  "total": 3663,
+  "total": 3666,
   "totals_by_pattern": {
-    "dot_ok": 1399,
+    "dot_ok": 1401,
     "let_underscore": 1359,
-    "unwrap_or_default": 905
+    "unwrap_or_default": 906
   },
   "tracked_files": {
     "crates/jcode-app-core/src/agent.rs": {
@@ -597,7 +597,7 @@
       "unwrap_or_default": 1
     },
     "crates/jcode-app-core/src/update.rs": {
-      "dot_ok": 3,
+      "dot_ok": 5,
       "let_underscore": 6,
       "unwrap_or_default": 9
     },
@@ -1032,7 +1032,7 @@
       "unwrap_or_default": 0
     },
     "crates/jcode-base/src/provider/pricing.rs": {
-      "dot_ok": 2,
+      "dot_ok": 1,
       "let_underscore": 0,
       "unwrap_or_default": 0
     },
@@ -1197,7 +1197,7 @@
       "unwrap_or_default": 1
     },
     "crates/jcode-base/src/usage/api_keys.rs": {
-      "dot_ok": 5,
+      "dot_ok": 6,
       "let_underscore": 0,
       "unwrap_or_default": 0
     },
@@ -1212,7 +1212,7 @@
       "unwrap_or_default": 1
     },
     "crates/jcode-base/src/usage/model.rs": {
-      "dot_ok": 0,
+      "dot_ok": 1,
       "let_underscore": 0,
       "unwrap_or_default": 1
     },
@@ -1227,9 +1227,9 @@
       "unwrap_or_default": 0
     },
     "crates/jcode-base/src/usage/provider_fetch.rs": {
-      "dot_ok": 5,
+      "dot_ok": 4,
       "let_underscore": 0,
-      "unwrap_or_default": 5
+      "unwrap_or_default": 6
     },
     "crates/jcode-base/src/voice.rs": {
       "dot_ok": 0,
@@ -1604,7 +1604,7 @@
     "crates/jcode-provider-openrouter-runtime/src/lib.rs": {
       "dot_ok": 22,
       "let_underscore": 0,
-      "unwrap_or_default": 9
+      "unwrap_or_default": 8
     },
     "crates/jcode-provider-openrouter-runtime/src/models_catalog_parse.rs": {
       "dot_ok": 1,
@@ -1621,6 +1621,11 @@
       "let_underscore": 7,
       "unwrap_or_default": 0
     },
+    "crates/jcode-provider-openrouter-runtime/src/request_headers.rs": {
+      "dot_ok": 0,
+      "let_underscore": 0,
+      "unwrap_or_default": 1
+    },
     "crates/jcode-provider-openrouter/src/lib.rs": {
       "dot_ok": 14,
       "let_underscore": 4,
```

---

### Incident Patch 7: `73f5fdfd` (2026-10-05)
**Commit Message**: fix(pricing): keep local profiles out of the cross-provider fallback (follow-up to #1658)

Ollama, LM Studio and localhost/private-network profiles serve vendor
model ids for free, so borrowing a hosted listing's rate invented spend
(e.g. ollama gpt-oss:20b picked up ollama-cloud pricing). Cross-provider
matches are now also reported at Medium confidence instead of High.

**File**: `crates/jcode-base/src/model_pricing.rs` (modified, +133/-5)
```diff
@@ -157,6 +157,25 @@ fn normalize_model_id(model: &str) -> &str {
 /// when the catalog has no entry; never blocks on the network. Schedules a
 /// background refresh when the disk cache is missing or stale.
 pub fn lookup(jcode_provider: &str, model: &str) -> Option<ModelCost> {
+    lookup_with_provenance(jcode_provider, model).map(|(cost, _)| cost)
+}
+
+/// Where a [`lookup_with_provenance`] price came from.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub enum PricingMatch {
+    /// The provider's own models.dev table listed the model.
+    ProviderTable,
+    /// Inferred from other providers' listings of the same model id (reseller
+    /// fallback). Plausible but not authoritative for this route.
+    CrossProvider,
+}
+
+/// Like [`lookup`], but also reports whether the price came from the
+/// provider's own table or from the cross-provider reseller fallback.
+pub fn lookup_with_provenance(
+    jcode_provider: &str,
+    model: &str,
+) -> Option<(ModelCost, PricingMatch)> {
     let is_openai_compatible = jcode_provider.trim().starts_with("openai-compatible:");
     let cache = ensure_cache_fresh()?;
     let mapped_provider = models_dev_provider_id(jcode_provider);
@@ -165,14 +184,14 @@ pub fn lookup(jcode_provider: &str, model: &str) -> Option<ModelCost> {
     {
         let model = normalize_model_id(model);
         if let Some(cost) = models.get(model) {
-            return Some(*cost);
+            return Some((*cost, PricingMatch::ProviderTable));
         }
         // OpenRouter-style ids (`anthropic/claude-...`) may reach here with the
         // provider prefix still attached; retry on the bare model name.
         if let Some((_, bare)) = model.rsplit_once('/')
             && let Some(cost) = models.get(bare)
         {
-            return Some(*cost);
+            return Some((*cost, PricingMatch::ProviderTable));
         }
     }
     // Reseller/aggregator keys that models.dev does not list as a provider at
@@ -181,13 +200,64 @@ pub fn lookup(jcode_provider: &str, model: &str) -> Option<ModelCost> {
     // of assuming unpriced. A profile that *does* have a models.dev mapping
     // keeps its own table as the authority: a model missing there is left
     // unpriced rather than billed at an unrelated provider's rate. First-party
-    // providers never take this path either.
-    if is_openai_compatible && mapped_provider.is_none() {
-        return cross_provider_lookup(&cache, model);
+    // providers never take this path either, and neither do local/keyless
+    // endpoints (Ollama, LM Studio, localhost profiles): they serve vendor
+    // model ids for free, so borrowing a hosted price would invent spend.
+    if is_openai_compatible
+        && mapped_provider.is_none()
+        && !openai_compatible_profile_is_local(jcode_provider)
+    {
+        return cross_provider_lookup(&cache, model)
+            .map(|cost| (cost, PricingMatch::CrossProvider));
     }
     None
 }
 
+/// True when an `openai-compatible:<id>` profile runs locally or without an
+/// API key, so its traffic is not billed at hosted rates. Unknown ids (not a
+/// built-in profile and not a configured `[providers.<id>]`) are treated as
+/// hosted resellers.
+fn openai_compatible_profile_is_local(jcode_provider: &str) -> bool {
+    let Some(id) = jcode_provider
+        .trim()
+        .strip_prefix("openai-compatible:")
+        .map(str::trim)
+    else {
+        return false;
+    };
+    if let Some(profile) = crate::provider_catalog::openai_compatible_profile_by_id(id) {
+        return !profile.requires_api_key || api_base_is_local(profile.api_base);
+    }
+    if let Some(named) = crate::config::config().providers.get(id) {
+        return api_base_is_local(&named.base_url)
+            || named.requires_api_key == Some(false)
+            || named.auth == crate::config::NamedProviderAuth::None;
+    }
+    false
+}
+
+/// Loopback, private-network, link-local, and `.local`/`.lan` hosts.
+fn api_base_is_local(api_base: &str) -> bool {
+    let Ok(url) = url::Url::parse(api_base.trim()) else {
+        return false;
+    };
+    match url.host() {
+        Some(url::Host::Ipv4(ip)) => ip.is_loopback() || ip.is_private() || ip.is_link_local(),
+        Some(url::Host::Ipv6(ip)) => {
+            ip.is_loopback() || ip.is_unique_local() || ip.is_unicast_link_local()
+        }
+        Some(url::Host::Domain(host)) => {
+            let host = host.to_ascii_lowercase();
+            host == "localhost"
+                || host.ends_with(".localhost")
+                || host.ends_with(".local")
+                || host.ends_with(".lan")
+                || host == "host.docker.internal"
+        }
+        None => false,
+    }
+}
+
 /// Match `model` (normalized, then bare after a `vendor/` split) against
 /// every provider table in the catalog. Exact id matches win over bare-name
 /// matches; among matches the modal (most common) price wins, with the
@@ -531,6 +601,64 @@ mod tests {

```

**File**: `crates/jcode-base/src/provider/pricing.rs` (modified, +14/-3)
```diff
@@ -225,14 +225,25 @@ pub fn metered_pricing_for_source_with_tier(
     }
 
     // 3. Live models.dev catalog (disk cache; refreshes in the background).
-    let cost = crate::model_pricing::lookup(source_key, model)?;
+    let (cost, matched) = crate::model_pricing::lookup_with_provenance(source_key, model)?;
+    // A price borrowed from other providers' listings (reseller fallback) is
+    // a reasonable estimate, not the route's own published rate.
+    let (confidence, note) = match matched {
+        crate::model_pricing::PricingMatch::ProviderTable => {
+            (RouteCostConfidence::High, "models.dev pricing catalog")
+        }
+        crate::model_pricing::PricingMatch::CrossProvider => (
+            RouteCostConfidence::Medium,
+            "models.dev pricing catalog (inferred from other providers)",
+        ),
+    };
     Some(RouteCheapnessEstimate::metered(
         RouteCostSource::ModelsDevCatalog,
-        RouteCostConfidence::High,
+        confidence,
         usd_to_micros(cost.input_usd_per_mtok),
         usd_to_micros(cost.output_usd_per_mtok),
         cost.cache_read_usd_per_mtok.map(usd_to_micros),
-        Some("models.dev pricing catalog".to_string()),
+        Some(note.to_string()),
     ))
 }
 
```

---

### Incident Patch 8: `f6194cb8` (2026-10-05)
**Commit Message**: fix(usage): query Z.ai quota on the profile's region host (follow-up to #1699)

International api.z.ai keys are rejected by open.bigmodel.cn, so the
Coding Plan quota fetch silently fell back to the key probe for
non-mainland users. Derive the quota host from the profile api_base.

**File**: `crates/jcode-base/src/usage/api_keys.rs` (modified, +21/-5)
```diff
@@ -250,13 +250,12 @@ async fn fetch_compatible_profile_report(
         }
         "zai" => {
             if let Some(api_key) = configured_key(profile.api_key_env, profile.env_file) {
-                match fetch_zai_coding_plan_limits(&api_key).await {
+                let resolved = crate::provider_catalog::resolve_openai_compatible_profile(profile);
+                match fetch_zai_coding_plan_limits(&resolved.api_base, &api_key).await {
                     Ok(fetched) if !fetched.is_empty() => limits.extend(fetched),
                     _ => {
                         // Not a Coding Plan key (or quota API unavailable):
                         // fall back to the pay-as-you-go key probe below.
-                        let resolved =
-                            crate::provider_catalog::resolve_openai_compatible_profile(profile);
                         let status =
                             probe_openai_compatible_key(&resolved.api_base, &api_key).await;
                         extra_info.push(("Key status".to_string(), status));
@@ -549,13 +548,30 @@ fn kimi_fmt_num(value: f64) -> String {
     }
 }
 
+/// Quota endpoint for the region the Z.ai profile talks to. Keys are
+/// region-specific: international (`api.z.ai`) keys are rejected by the
+/// mainland Zhipu host (`open.bigmodel.cn`) and vice versa, so follow the
+/// profile's API base. Unknown hosts (custom proxies) default to `api.z.ai`.
+pub(super) fn zai_quota_url(api_base: &str) -> String {
+    let host = url::Url::parse(api_base)
+        .ok()
+        .and_then(|url| url.host_str().map(str::to_ascii_lowercase));
+    let origin = match host.as_deref() {
+        Some(host) if host == "bigmodel.cn" || host.ends_with(".bigmodel.cn") => {
+            "https://open.bigmodel.cn"
+        }
+        _ => "https://api.z.ai",
+    };
+    format!("{}/api/monitor/usage/quota/limit", origin)
+}
+
 /// Z.ai GLM Coding Plan exposes plan quota windows (5-hour, weekly, and MCP
 /// monthly) through the monitor quota endpoint. Pay-as-you-go keys are
 /// rejected, which the caller uses as the fallback signal.
-async fn fetch_zai_coding_plan_limits(api_key: &str) -> Result<Vec<UsageLimit>> {
+async fn fetch_zai_coding_plan_limits(api_base: &str, api_key: &str) -> Result<Vec<UsageLimit>> {
     let client = crate::provider::shared_http_client();
     let response = client
-        .get("https://open.bigmodel.cn/api/monitor/usage/quota/limit")
+        .get(zai_quota_url(api_base))
         .header("Authorization", format!("Bearer {}", api_key))
         .header("Accept", "application/json")
         .timeout(HTTP_TIMEOUT)
```

**File**: `crates/jcode-base/src/usage/tests.rs` (modified, +21/-0)
```diff
@@ -1128,3 +1128,24 @@ fn cursor_plan_usage_report_keeps_membership_without_usage_fields() {
     assert!(report.limits.is_empty());
     assert!(report.error.is_none());
 }
+
+#[test]
+fn zai_quota_url_follows_profile_region() {
+    assert_eq!(
+        api_keys::zai_quota_url("https://api.z.ai/api/coding/paas/v4"),
+        "https://api.z.ai/api/monitor/usage/quota/limit"
+    );
+    assert_eq!(
+        api_keys::zai_quota_url("https://open.bigmodel.cn/api/coding/paas/v4"),
+        "https://open.bigmodel.cn/api/monitor/usage/quota/limit"
+    );
+    // Custom proxies and unparsable bases default to the international host.
+    assert_eq!(
+        api_keys::zai_quota_url("https://proxy.example.com/v1"),
+        "https://api.z.ai/api/monitor/usage/quota/limit"
+    );
+    assert_eq!(
+        api_keys::zai_quota_url("not a url"),
+        "https://api.z.ai/api/monitor/usage/quota/limit"
+    );
+}
```

---

### Incident Patch 9: `22d3ced1` (2026-10-05)
**Commit Message**: fix(provider): retry every 5xx from OpenAI-compatible providers, including 529 (fixes #1596)

A 529 "heavy usage" answer (and other non-standard 5xx like 520) was not
classified as retryable, so the turn failed on the first attempt with a
hint to check the network. Every 5xx is now retried within the existing
retry budget, and a final 5xx hint points at provider overload.

**File**: `crates/jcode-provider-openrouter-runtime/src/openrouter_sse_stream.rs` (modified, +36/-1)
```diff
@@ -37,6 +37,11 @@ fn http_status_hint(status: u16, api_base: &str, model: &str) -> &'static str {
         404 if !is_local => {
             "Hint: the endpoint or model was not found. Check that the base URL includes the API version (usually /v1) and that the model exists on the provider."
         }
+        // The provider answered, so this is server-side overload or failure,
+        // not connectivity (#1596). These are retried before surfacing.
+        500..=599 if !is_local => {
+            "Hint: the provider is overloaded or having a temporary server problem, not a network problem. jcode already retried; try again shortly or switch to another provider with /model."
+        }
         _ => endpoint_hint,
     }
 }
@@ -336,7 +341,10 @@ fn is_retryable_error(error_str: &str) -> bool {
     // not depend on provider-specific body wording.
     match parsed_http_status(error_str) {
         Some(400 | 401 | 402 | 403 | 404 | 405 | 406 | 422) => return false,
-        Some(429) => return true,
+        // 429 rate limit, and every 5xx: the server answered but is overloaded
+        // or failing on its side. This includes non-standard codes such as the
+        // 529 "overloaded" some OpenAI-compatible providers send (#1596).
+        Some(429 | 500..=599) => return true,
         _ => {}
     }
 
@@ -372,6 +380,33 @@ mod tests {
         assert!(hint.contains("/v1/models"));
     }
 
+    /// #1596: an OpenAI-compatible provider answering 529 "heavy usage" (or
+    /// any other 5xx) must be retried, not fail the turn on the first try.
+    #[test]
+    fn every_5xx_status_including_529_is_retryable() {
+        let body = r#"data: {"error":{"message":"We're experiencing heavy usage right now, please try again in a moment.","type":"server_error"}}"#;
+        for status in [
+            "500 internal server error",
+            "502 bad gateway",
+            "503 service unavailable",
+            "520 <unknown status code>",
+            "529 <unknown status code>",
+        ] {
+            let err = format!(
+                "openai-compatible chat request failed\n  endpoint: https://compat.example.test/v1/chat/completions\n  model: glm-5.3\n  auth: compat_api_key\n  status: {status}\n  response: {body}"
+            )
+            .to_lowercase();
+            assert!(is_retryable_error(&err), "{status} must be retried");
+        }
+    }
+
+    #[test]
+    fn server_error_hint_points_at_provider_not_network() {
+        let hint = http_status_hint(529, "https://compat.example.test/v1", "glm-5.3");
+        assert!(hint.contains("overloaded"), "{hint}");
+        assert!(!hint.contains("check network"), "{hint}");
+    }
+
     #[test]
     fn parsed_http_status_extracts_code() {
         assert_eq!(
```

---

### Incident Patch 10: `ce9dab21` (2026-10-04)
**Commit Message**: Revert "compile_remote: keep cached access state on transient check failure to stop prompt-cache invalidation"

This reverts commit 27345e7f2f98859fa14672d4eb37ef35321f6718.

**File**: `crates/jcode-app-core/src/tool/compile_remote.rs` (modified, +3/-16)
```diff
@@ -194,23 +194,10 @@ async fn access_with(base: &str, key: &str, force: bool) -> Access {
         Ok(client) => check_access(&client, base, key).await,
         Err(_) => Access::Unknown,
     };
-    let identity = identity(base, key);
-    let mut cache = ACCESS.lock().unwrap_or_else(|e| e.into_inner());
-    // The cached state drives the tool description, which sits in the provider
-    // prompt-cache prefix of every session in this process. A transient check
-    // failure (timeout, 5xx) must not flip a known state to Unknown and back,
-    // or each flip invalidates every session's cache. Callers still receive the
-    // fresh result, so execution keeps failing closed.
-    let cached = match cache.as_ref() {
-        Some(previous) if access == Access::Unknown && previous.identity == identity => {
-            previous.access
-        }
-        _ => access,
-    };
-    *cache = Some(CachedAccess {
-        identity,
+    *ACCESS.lock().unwrap_or_else(|e| e.into_inner()) = Some(CachedAccess {
+        identity: identity(base, key),
         checked_at: Instant::now(),
-        access: cached,
+        access,
     });
     access
 }
```

**File**: `crates/jcode-app-core/src/tool/compile_remote/tests.rs` (modified, +0/-18)
```diff
@@ -482,24 +482,6 @@ async fn execute_denied_access_precedes_snapshot_and_upload_even_with_cached_rea
     assert!(!error.contains("canonicalize"));
 }
 
-#[tokio::test]
-async fn transient_check_failure_keeps_cached_description_stable() {
-    let env = Environment::new();
-    let server = Server::new(move |_| response(503, "offline")).await;
-    env.configure(&server.base);
-    *ACCESS.lock().unwrap() = Some(CachedAccess {
-        identity: identity(&server.base, KEY),
-        checked_at: Instant::now() - ACCESS_TTL - Duration::from_secs(1),
-        access: Access::NotEnabled,
-    });
-    // The live result is still Unknown, so execution fails closed...
-    assert_eq!(access_with(&server.base, KEY, false).await, Access::Unknown);
-    // ...but the published description keeps the last known state instead of
-    // flipping and invalidating every session's prompt cache.
-    assert_eq!(current_access(), Access::NotEnabled);
-    assert_eq!(server.captured().len(), 1);
-}
-
 #[tokio::test]
 async fn status_never_snapshots_and_invalid_timeout_never_contacts_service() {
     let env = Environment::new();
```

---

### Incident Patch 11: `f18ffee6` (2026-10-04)
**Commit Message**: fix(auth): keep every saved API key out of the process env (fixes #1386)

Builds on @zipadoodlez's PR #1387 (cherry-picked above), adapted to current
master:
- The Grok Build provider added after the PR now uses the call-time auth
  resolver.
- Six more secret writes were still copied into the process env and now go
  through the file-only save_named_api_key: local-endpoint login keys,
  'jcode provider add --api-key', OpenAI-compatible key migration, Azure
  (CLI and TUI) and Cursor.
- Tests that asserted the old env export now assert the opposite, plus a
  regression test for the exact report: save a key, correct the env file,
  and the corrected value wins without a restart (fails on the old code).

**File**: `crates/jcode-base/src/auth/cursor.rs` (modified, +2/-2)
```diff
@@ -298,8 +298,8 @@ pub fn load_api_key() -> Result<String> {
 pub fn save_api_key(key: &str) -> Result<()> {
     let file_path = config_file_path()?;
     crate::storage::upsert_env_file_value(&file_path, "CURSOR_API_KEY", Some(key))?;
-
-    crate::env::set_var("CURSOR_API_KEY", key);
+    // File only (#1386): `load_api_key` falls back to this file, and a process
+    // env copy would shadow later edits and leak into child processes.
     Ok(())
 }
 
```

**File**: `crates/jcode-provider-env/src/lib.rs` (modified, +29/-0)
```diff
@@ -383,6 +383,35 @@ mod tests {
         );
     }
 
+    /// The #1386 scenario end to end: a key pasted in `/login`, then corrected
+    /// by editing the env file, must take effect on the next lookup without a
+    /// restart.
+    #[test]
+    fn corrected_env_file_wins_after_a_saved_key() {
+        let temp = tempfile::tempdir().expect("tempdir");
+        let _guard = EnvGuard::new(&["JCODE_HOME", "TEST_CORRECTED_API_KEY"]);
+        jcode_core::env::set_var("JCODE_HOME", temp.path());
+
+        save_named_api_key("test-corrected.env", "TEST_CORRECTED_API_KEY", "sk-wrong")
+            .expect("save pasted key");
+        let file_path = jcode_storage::app_config_dir()
+            .expect("config dir")
+            .join("test-corrected.env");
+        jcode_storage::upsert_env_file_value(
+            &file_path,
+            "TEST_CORRECTED_API_KEY",
+            Some("sk-corrected"),
+        )
+        .expect("edit env file");
+
+        assert_eq!(
+            load_api_key_from_env_or_config("TEST_CORRECTED_API_KEY", "test-corrected.env")
+                .as_deref(),
+            Some("sk-corrected"),
+            "an edited env file must not be shadowed by the earlier save"
+        );
+    }
+
     #[test]
     fn sanitize_strips_unicode_invisible_characters() {
         // Zero-width space, BOM, NBSP, en space around the value.
```

**File**: `crates/jcode-provider-openrouter-runtime/src/lib.rs` (modified, +5/-3)
```diff
@@ -1817,9 +1817,11 @@ impl OpenRouterProvider {
             model: Arc::new(RwLock::new(model.to_string())),
             reasoning_effort: Arc::new(RwLock::new(None)),
             api_base: jcode_base::auth::grok_build::chat_proxy_base_url(),
-            auth: ProviderAuth::GrokCli {
-                label: GROK_BUILD_AUTH_LABEL.to_string(),
-            },
+            auth: Arc::new(|| {
+                Ok(ProviderAuth::GrokCli {
+                    label: GROK_BUILD_AUTH_LABEL.to_string(),
+                })
+            }),
             supports_provider_features: false,
             // The proxy's `/models` shape is not a documented catalog; keep the
             // curated list so `/model` works offline and before first request.
```

**File**: `crates/jcode-provider-openrouter-runtime/src/openrouter_tests.rs` (modified, +1/-0)
```diff
@@ -1794,6 +1794,7 @@ async fn live_openrouter_unified_reasoning_smoke() -> Result<()> {
         .unwrap_or(1024);
 
     for model in models {
+        let token = token.clone();
         let provider = OpenRouterProvider {
             auth: Arc::new(move || {
                 Ok(ProviderAuth::AuthorizationBearer {
```

**File**: `crates/jcode-tui/src/tui/app/auth.rs` (modified, +3/-3)
```diff
@@ -3396,10 +3396,10 @@ impl App {
             Some(if use_entra { "1" } else { "0" }),
         )?;
         if let Some(api_key) = api_key {
-            crate::provider_catalog::save_env_value_to_env_file(
-                azure::API_KEY_ENV,
+            crate::provider_catalog::save_named_api_key(
                 azure::ENV_FILE,
-                Some(api_key),
+                azure::API_KEY_ENV,
+                api_key,
             )?;
         }
         azure::apply_runtime_env()?;
```

**File**: `crates/jcode-tui/src/tui/app/auth_account_commands.rs` (modified, +2/-6)
```diff
@@ -900,12 +900,8 @@ fn save_openai_compat_setting(app: &mut App, setting: OpenAiCompatSetting, value
     );
     if let Some(key) = current_key
         && (old.api_key_env != new.api_key_env || old.env_file != new.env_file)
-        && crate::provider_catalog::save_env_value_to_env_file(
-            &new.api_key_env,
-            &new.env_file,
-            Some(&key),
-        )
-        .is_err()
+        && crate::provider_catalog::save_named_api_key(&new.env_file, &new.api_key_env, &key)
+            .is_err()
     {
         crate::logging::warn("Failed to migrate OpenAI-compatible API key to new source");
     }
```

**File**: `crates/jcode-tui/src/tui/app/auth_tests.rs` (modified, +9/-2)
```diff
@@ -133,10 +133,17 @@ fn tui_api_key_logout_clears_saved_key_and_process_env() -> anyhow::Result<()> {
         )
         .map(|_| resolved)?;
 
+        // Saving is file-only (#1386), so the key is readable from the env file
+        // and never copied into the process environment.
         assert_eq!(
-            std::env::var(&resolved.api_key_env).as_deref(),
-            Ok("sk-test-tui-login")
+            crate::provider_catalog::load_api_key_from_env_or_config(
+                &resolved.api_key_env,
+                &resolved.env_file,
+            )
+            .as_deref(),
+            Some("sk-test-tui-login")
         );
+        assert!(std::env::var_os(&resolved.api_key_env).is_none());
 
         App::clear_api_key_login(&resolved.api_key_env, &resolved.env_file)?;
 
```

**File**: `crates/jcode-tui/src/tui/app/tests/onboarding_flow.rs` (modified, +14/-4)
```diff
@@ -575,8 +575,10 @@ fn openrouter_key_typed_through_full_key_path_does_not_reopen_picker() {
         assert!(app.input.is_empty(), "input buffer should clear after submit");
 
         // Crucially: the key must actually be *persisted*, not just "not loop".
-        // It is written to $JCODE_HOME/config/jcode/openrouter.env and exported
-        // to OPENROUTER_API_KEY so the provider can authenticate.
+        // It is written to $JCODE_HOME/config/jcode/openrouter.env, which is
+        // where the provider resolves it from at request time. It must not be
+        // copied into the process env, where it would shadow later edits of the
+        // file and leak into child processes (#1386).
         let env_file = crate::storage::app_config_dir().unwrap().join("openrouter.env");
         let contents = std::fs::read_to_string(&env_file)
             .unwrap_or_else(|e| panic!("openrouter.env should exist at {env_file:?}: {e}"));
@@ -585,9 +587,17 @@ fn openrouter_key_typed_through_full_key_path_does_not_reopen_picker() {
             "saved env file must contain the typed key, got:\n{contents}"
         );
         assert_eq!(
-            std::env::var("OPENROUTER_API_KEY").ok().as_deref(),
+            crate::provider_catalog::load_api_key_from_env_or_config(
+                "OPENROUTER_API_KEY",
+                "openrouter.env"
+            )
+            .as_deref(),
             Some(key),
-            "key must be exported to the process env for immediate use"
+            "the saved key must be immediately resolvable for authentication"
+        );
+        assert!(
+            std::env::var_os("OPENROUTER_API_KEY").is_none(),
+            "the key must not be copied into the process env (#1386)"
         );
     });
 }
```

---

### Incident Patch 12: `5db10f47` (2026-09-22)
**Commit Message**: fix: invoke auth resolver before applying ?

Review follow-up (greptile P1s):
- (self.auth)?() applied ? to the resolver Arc instead of the
  Result; call first, then propagate at all 5 request sites.
- openrouter_tests fixtures still assigned ProviderAuth directly to
  the AuthResolver field; wrap in Arc::new(|| Ok(...)) so the test
  target compiles.
- rustfmt on touched files.

**File**: `crates/jcode-provider-openrouter-runtime/src/lib.rs` (modified, +4/-4)
```diff
@@ -2714,7 +2714,7 @@ impl OpenRouterProvider {
         fetch_models_from_api(
             self.client.clone(),
             self.api_base.clone(),
-            (self.auth)?(),
+            (self.auth)()?,
             Arc::clone(&self.models_cache),
             self.foreground_cache_namespace(),
         )
@@ -2726,7 +2726,7 @@ impl OpenRouterProvider {
         fetch_models_from_api(
             self.client.clone(),
             self.api_base.clone(),
-            (self.auth)?(),
+            (self.auth)()?,
             Arc::clone(&self.models_cache),
             self.foreground_cache_namespace(),
         )
@@ -2764,7 +2764,7 @@ impl OpenRouterProvider {
 
         // Fetch from API
         let url = format!("{}/models/{}/endpoints", self.api_base, model);
-        let response = (self.auth)?
+        let response = (self.auth)()?
             .apply(self.client.get(&url))
             .await?
             .send()
@@ -2818,7 +2818,7 @@ impl OpenRouterProvider {
             .unwrap_or(0);
 
         let url = format!("{}/models/{}/endpoints", self.api_base, model);
-        let response = (self.auth)?
+        let response = (self.auth)()?
             .apply(self.client.get(&url))
             .await?
             .send()
```

**File**: `crates/jcode-provider-openrouter-runtime/src/openrouter_provider_impl.rs` (modified, +1/-1)
```diff
@@ -262,7 +262,7 @@ impl Provider for OpenRouterProvider {
         let (tx, rx) = mpsc::channel::<Result<StreamEvent>>(100);
         let client = self.client.clone();
         let api_base = self.api_base.clone();
-        let auth = (self.auth)?();
+        let auth = (self.auth)()?;
         let send_openrouter_headers = self.send_openrouter_headers;
         let conversation_id = self.conversation_id.clone();
         let request_for_retries = request;
```

**File**: `crates/jcode-provider-openrouter-runtime/src/openrouter_tests.rs` (modified, +30/-20)
```diff
@@ -1427,10 +1427,12 @@ fn make_provider() -> OpenRouterProvider {
         model: Arc::new(RwLock::new(DEFAULT_MODEL.to_string())),
         reasoning_effort: Arc::new(RwLock::new(None)),
         api_base: DEFAULT_API_BASE.to_string(),
-        auth: ProviderAuth::AuthorizationBearer {
-            token: "test".to_string(),
-            label: DEFAULT_API_KEY_NAME.to_string(),
-        },
+        auth: Arc::new(|| {
+            Ok(ProviderAuth::AuthorizationBearer {
+                token: "test".to_string(),
+                label: DEFAULT_API_KEY_NAME.to_string(),
+            })
+        }),
         supports_provider_features: true,
         supports_model_catalog: true,
         profile_id: None,
@@ -1459,10 +1461,12 @@ fn make_custom_compatible_provider() -> OpenRouterProvider {
         model: Arc::new(RwLock::new(DEFAULT_MODEL.to_string())),
         reasoning_effort: Arc::new(RwLock::new(None)),
         api_base: "https://compat.example.test/v1".to_string(),
-        auth: ProviderAuth::AuthorizationBearer {
-            token: "test".to_string(),
-            label: "OPENAI_COMPAT_API_KEY".to_string(),
-        },
+        auth: Arc::new(|| {
+            Ok(ProviderAuth::AuthorizationBearer {
+                token: "test".to_string(),
+                label: "OPENAI_COMPAT_API_KEY".to_string(),
+            })
+        }),
         supports_provider_features: false,
         supports_model_catalog: true,
         profile_id: None,
@@ -1791,10 +1795,12 @@ async fn live_openrouter_unified_reasoning_smoke() -> Result<()> {
 
     for model in models {
         let provider = OpenRouterProvider {
-            auth: ProviderAuth::AuthorizationBearer {
-                token: token.clone(),
-                label: configured_api_key_name(),
-            },
+            auth: Arc::new(move || {
+                Ok(ProviderAuth::AuthorizationBearer {
+                    token: token.clone(),
+                    label: configured_api_key_name(),
+                })
+            }),
             model: Arc::new(RwLock::new(model.clone())),
             max_tokens: Some(max_tokens),
             ..make_provider()
@@ -1964,10 +1970,12 @@ fn openai_compatible_model_catalog_refresh_calls_models_endpoint_and_updates_dis
     let provider = OpenRouterProvider {
         api_base,
         model: Arc::new(RwLock::new("live-login-flow-model".to_string())),
-        auth: ProviderAuth::AuthorizationBearer {
-            token: "sk-live-catalog".to_string(),
-            label: "OPENAI_COMPAT_API_KEY".to_string(),
-        },
+        auth: Arc::new(|| {
+            Ok(ProviderAuth::AuthorizationBearer {
+                token: "sk-live-catalog".to_string(),
+                label: "OPENAI_COMPAT_API_KEY".to_string(),
+            })
+        }),
         supports_provider_features: false,
         supports_model_catalog: true,
         profile_id: None,
@@ -2052,10 +2060,12 @@ fn built_in_openai_compatible_static_models_drop_out_after_live_catalog() {
     );
     let provider = OpenRouterProvider {
         api_base,
-        auth: ProviderAuth::AuthorizationBearer {
-            token: "sk-live-catalog".to_string(),
-            label: "CEREBRAS_API_KEY".to_string(),
-        },
+        auth: Arc::new(|| {
+            Ok(ProviderAuth::AuthorizationBearer {
+                token: "sk-live-catalog".to_string(),
+                label: "CEREBRAS_API_KEY".to_string(),
+            })
+        }),
         supports_provider_features: false,
         supports_model_catalog: true,
         profile_id: Some("cerebras".to_string()),
```

**File**: `src/cli/provider_init.rs` (modified, +1/-2)
```diff
@@ -8,8 +8,7 @@ use crate::provider::Provider;
 use crate::provider_catalog::{
     LoginProviderDescriptor, LoginProviderTarget, OpenAiCompatibleProfile,
     apply_openai_compatible_profile_env, force_apply_openai_compatible_profile_env,
-    resolve_login_selection,
-    resolve_openai_compatible_profile,
+    resolve_login_selection, resolve_openai_compatible_profile,
 };
 use crate::tool;
 
```

---

### Incident Patch 13: `4a03475f` (2026-09-22)
**Commit Message**: fix: make env files the source of truth for API keys

Secret saves no longer write to the process environment. A shared
file-only save_named_api_key in jcode-provider-env replaces both
poisoned copies (CLI provider_init and TUI auth); save_env_value_to_env_file
keeps set_var only for non-secret config values. All secret write
paths route through the file-only helper: /login compat paste, TUI key
saves, Gemini, the jcode subscription key, and the inline
set_var(&key_name, &key).

The openrouter runtime resolves ProviderAuth through a per-instance
Arc<dyn Fn> resolver at every use instead of capturing it at
construction, so key edits take effect without a restart. Named-profile
config variants (Bearer/Header/None, inline api_key) are preserved by
resolving the captured profile inside the closure; constructor-failure
timing stays eager via auth()? at each constructor.

Raw readers of persisted keys switch to the env-then-file loader
(pricing mode detection, the ZHIPU legacy ZAI_API_KEY fallback).

Closes #1386

**File**: `crates/jcode-base/src/auth/gemini.rs` (modified, +3/-3)
```diff
@@ -86,10 +86,10 @@ pub fn save_api_key(key: &str) -> Result<()> {
     if key.is_empty() {
         anyhow::bail!("Gemini API key cannot be empty");
     }
-    crate::provider_catalog::save_env_value_to_env_file(
-        GEMINI_API_KEY_ENV_VARS[0],
+    crate::provider_catalog::save_named_api_key(
         GEMINI_API_KEY_ENV_FILE,
-        Some(key),
+        GEMINI_API_KEY_ENV_VARS[0],
+        key,
     )?;
     super::AuthStatus::invalidate_cache();
     Ok(())
```

**File**: `crates/jcode-base/src/provider/pricing.rs` (modified, +5/-4)
```diff
@@ -86,10 +86,11 @@ pub(crate) fn openai_effective_auth_mode() -> &'static str {
         Ok(creds) if !creds.refresh_token.is_empty() || creds.id_token.is_some() => "oauth",
         Ok(_) => "api-key",
         Err(_) => {
-            if std::env::var("OPENAI_API_KEY")
-                .ok()
-                .map(|v| !v.trim().is_empty())
-                .unwrap_or(false)
+            if crate::provider_catalog::load_api_key_from_env_or_config(
+                "OPENAI_API_KEY",
+                "openai.env",
+            )
+            .is_some()
             {
                 "api-key"
             } else {
```

**File**: `crates/jcode-base/src/provider_catalog.rs` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 pub use jcode_provider_env::{
     load_api_key_from_env_or_config, load_env_value_from_config_file,
     load_env_value_from_env_or_config, register_api_key_fallback_resolver,
-    save_env_value_to_env_file,
+    save_env_value_to_env_file, save_named_api_key,
 };
 pub use jcode_provider_metadata::*;
 use std::collections::{HashMap, HashSet};
```

**File**: `crates/jcode-base/src/subscription_catalog.rs` (modified, +1/-1)
```diff
@@ -414,8 +414,8 @@ pub fn persist_account_credentials(
         anyhow::bail!("refusing to persist an empty jcode account API key");
     }
 
+    provider_catalog::save_named_api_key(JCODE_ENV_FILE, JCODE_API_KEY_ENV, api_key)?;
     for (key, value) in [
-        (JCODE_API_KEY_ENV, Some(api_key)),
         (JCODE_ACCOUNT_ID_ENV, nonempty(account_id)),
         (JCODE_ACCOUNT_EMAIL_ENV, nonempty(email)),
         (JCODE_TIER_ENV, nonempty(tier)),
```

**File**: `crates/jcode-provider-env/src/lib.rs` (modified, +37/-0)
```diff
@@ -231,6 +231,24 @@ pub fn save_env_value_to_env_file(
     Ok(())
 }
 
+/// Persist a named API key to its provider env file, file-only.
+///
+/// Deliberately unlike [`save_env_value_to_env_file`]: no process env write.
+/// Env wins over file in [`load_api_key_from_env_or_config`], so a `set_var`
+/// here would shadow later file edits until restart (issue #1386).
+pub fn save_named_api_key(env_file: &str, key_name: &str, key: &str) -> anyhow::Result<()> {
+    if !is_safe_env_key_name(key_name) {
+        anyhow::bail!("Invalid API key variable name: {}", key_name);
+    }
+    if !is_safe_env_file_name(env_file) {
+        anyhow::bail!("Invalid env file name: {}", env_file);
+    }
+
+    let file_path = jcode_storage::app_config_dir()?.join(env_file);
+    jcode_storage::upsert_env_file_value(&file_path, key_name, Some(key))?;
+    Ok(())
+}
+
 #[cfg(test)]
 mod tests {
     use super::*;
@@ -346,6 +364,25 @@ mod tests {
         );
     }
 
+    #[test]
+    fn save_named_api_key_writes_file_without_poisoning_process_env() {
+        let temp = tempfile::tempdir().expect("tempdir");
+        let _guard = EnvGuard::new(&["JCODE_HOME", "TEST_NAMED_API_KEY"]);
+        jcode_core::env::set_var("JCODE_HOME", temp.path());
+
+        save_named_api_key("test-named.env", "TEST_NAMED_API_KEY", "sk-live").expect("save key");
+
+        assert_eq!(
+            load_api_key_from_env_or_config("TEST_NAMED_API_KEY", "test-named.env").as_deref(),
+            Some("sk-live"),
+            "the env file must be the source of truth"
+        );
+        assert!(
+            std::env::var_os("TEST_NAMED_API_KEY").is_none(),
+            "saving must not poison the process env"
+        );
+    }
+
     #[test]
     fn sanitize_strips_unicode_invisible_characters() {
         // Zero-width space, BOM, NBSP, en space around the value.
```

**File**: `crates/jcode-provider-openrouter-runtime/src/lib.rs` (modified, +99/-72)
```diff
@@ -940,12 +940,16 @@ pub fn maybe_schedule_standard_openrouter_catalog_refresh(context: &'static str)
     true
 }
 
+/// Per-instance credential resolver: constructed once, invoked at every use so
+/// env-file edits take effect without a process restart (issue #1386).
+type AuthResolver = Arc<dyn Fn() -> anyhow::Result<ProviderAuth> + Send + Sync>;
+
 pub struct OpenRouterProvider {
     client: Client,
     model: Arc<RwLock<String>>,
     reasoning_effort: Arc<RwLock<Option<String>>>,
     api_base: String,
-    auth: ProviderAuth,
+    auth: AuthResolver,
     supports_provider_features: bool,
     supports_model_catalog: bool,
     profile_id: Option<String>,
@@ -1411,10 +1415,12 @@ impl OpenRouterProvider {
         !self.supports_provider_features
             && self.api_base.trim_end_matches('/')
                 == jcode_base::subscription_catalog::DEFAULT_JCODE_API_BASE.trim_end_matches('/')
-            && self
-                .auth
-                .label()
-                .eq_ignore_ascii_case(jcode_base::subscription_catalog::JCODE_API_KEY_ENV)
+            && (self.auth)()
+                .map(|auth| {
+                    auth.label()
+                        .eq_ignore_ascii_case(jcode_base::subscription_catalog::JCODE_API_KEY_ENV)
+                })
+                .unwrap_or(false)
     }
 
     pub fn new_named_openai_compatible(
@@ -1430,37 +1436,44 @@ impl OpenRouterProvider {
         let api_base = normalize_api_base(&profile.base_url).ok_or_else(|| {
             anyhow::anyhow!("Provider profile '{}' has invalid base_url", profile_name)
         })?;
-        let key_env = profile
-            .api_key_env
-            .as_deref()
-            .map(str::trim)
-            .filter(|v| !v.is_empty());
-        let key_label = key_env.unwrap_or("inline api_key").to_string();
-        let key = key_env
-            .and_then(|name| load_named_profile_api_key(name, profile))
-            .or_else(|| profile.api_key.clone());
-        let auth = match profile.auth {
-            jcode_base::config::NamedProviderAuth::None => ProviderAuth::None {
-                label: "local endpoint (no auth)".to_string(),
-            },
-            jcode_base::config::NamedProviderAuth::Bearer => ProviderAuth::AuthorizationBearer {
-                token: key
-                    .ok_or_else(|| anyhow::anyhow!("{} not found in environment", key_label))?,
-                label: key_label,
-            },
-            jcode_base::config::NamedProviderAuth::Header => ProviderAuth::HeaderValue {
-                header_name: HeaderName::from_bytes(
-                    profile
-                        .auth_header
-                        .as_deref()
-                        .unwrap_or("api-key")
-                        .as_bytes(),
-                )?,
-                value: key
-                    .ok_or_else(|| anyhow::anyhow!("{} not found in environment", key_label))?,
-                label: key_label,
-            },
-        };
+        let auth_profile = profile.clone();
+        let auth: AuthResolver = Arc::new(move || {
+            let key_env = auth_profile
+                .api_key_env
+                .as_deref()
+                .map(str::trim)
+                .filter(|v| !v.is_empty());
+            let key_label = key_env.unwrap_or("inline api_key").to_string();
+            let key = key_env
+                .and_then(|name| load_named_profile_api_key(name, &auth_profile))
+                .or_else(|| auth_profile.api_key.clone());
+            Ok(match auth_profile.auth {
+                jcode_base::config::NamedProviderAuth::None => ProviderAuth::None {
+                    label: "local endpoint (no auth)".to_string(),
+                },
+                jcode_base::config::NamedProviderAuth::Bearer => {
+                    ProviderAuth::AuthorizationBearer {
+                        token: key.ok_or_else(|| {
+                            anyhow::anyhow!("{} not found in environment", key_label)
+                        })?,
+                        label: key_label,
+                    }
+                }
+                jcode_base::config::NamedProviderAuth::Header => ProviderAuth::HeaderValue {
+                    header_name: HeaderName::from_bytes(
+                        auth_profile
+                            .auth_header
+                            .as_deref()
+                            .unwrap_or("api-key")
+                            .as_bytes(),
+                    )?,
+                    value: key
+                        .ok_or_else(|| anyhow::anyhow!("{} not found in environment", key_label))?,
+                    label: key_label,
+                },
+            })
+        });
+        auth()?;
         let model = profile
             .default_model
             .clone()
@@ -1671,7 +1684,8 @@ impl OpenRouterProvider {
         let supports_provider_features = provider_features_enabled(&api_base);
         let supports_model_catalog 
```

**File**: `crates/jcode-provider-openrouter-runtime/src/openrouter_provider_impl.rs` (modified, +1/-1)
```diff
@@ -262,7 +262,7 @@ impl Provider for OpenRouterProvider {
         let (tx, rx) = mpsc::channel::<Result<StreamEvent>>(100);
         let client = self.client.clone();
         let api_base = self.api_base.clone();
-        let auth = self.auth.clone();
+        let auth = (self.auth)?();
         let send_openrouter_headers = self.send_openrouter_headers;
         let conversation_id = self.conversation_id.clone();
         let request_for_retries = request;
```

**File**: `crates/jcode-tui/src/tui/app/auth.rs` (modified, +74/-81)
```diff
@@ -2291,70 +2291,74 @@ impl App {
                     ],
                 );
 
-                let save_result: anyhow::Result<()> =
-                    if let Some(resolved) = resolved_openai_compatible.as_ref() {
-                        (|| {
-                            if resolved.requires_api_key {
-                                crate::provider_catalog::save_env_value_to_env_file(
-                                    crate::provider_catalog::OPENAI_COMPAT_LOCAL_ENABLED_ENV,
-                                    &resolved.env_file,
-                                    None,
-                                )?;
+                let save_result: anyhow::Result<()> = if let Some(resolved) =
+                    resolved_openai_compatible.as_ref()
+                {
+                    (|| {
+                        if resolved.requires_api_key {
+                            crate::provider_catalog::save_env_value_to_env_file(
+                                crate::provider_catalog::OPENAI_COMPAT_LOCAL_ENABLED_ENV,
+                                &resolved.env_file,
+                                None,
+                            )?;
+                            crate::provider_catalog::save_named_api_key(
+                                &resolved.env_file,
+                                &resolved.api_key_env,
+                                key.trim(),
+                            )
+                        } else {
+                            crate::provider_catalog::save_env_value_to_env_file(
+                                crate::provider_catalog::OPENAI_COMPAT_LOCAL_ENABLED_ENV,
+                                &resolved.env_file,
+                                Some("1"),
+                            )?;
+                            if key.trim().is_empty() {
                                 crate::provider_catalog::save_env_value_to_env_file(
                                     &resolved.api_key_env,
                                     &resolved.env_file,
-                                    Some(key.trim()),
+                                    None,
                                 )
                             } else {
-                                crate::provider_catalog::save_env_value_to_env_file(
-                                    crate::provider_catalog::OPENAI_COMPAT_LOCAL_ENABLED_ENV,
+                                crate::provider_catalog::save_named_api_key(
                                     &resolved.env_file,
-                                    Some("1"),
-                                )?;
-                                crate::provider_catalog::save_env_value_to_env_file(
                                     &resolved.api_key_env,
-                                    &resolved.env_file,
-                                    if key.trim().is_empty() {
-                                        None
-                                    } else {
-                                        Some(key.trim())
-                                    },
+                                    key.trim(),
                                 )
                             }
-                        })()
-                    } else if key_name == crate::subscription_catalog::JCODE_API_KEY_ENV {
-                        (|| {
-                            let mut content = format!("{}={}\n", key_name, key);
-                            if let Some(base) = crate::subscription_catalog::configured_api_base() {
-                                content.push_str(&format!(
-                                    "{}={}\n",
-                                    crate::subscription_catalog::JCODE_API_BASE_ENV,
-                                    base
-                                ));
-                            }
+                        }
+                    })()
+                } else if key_name == crate::subscription_catalog::JCODE_API_KEY_ENV {
+                    (|| {
+                        let mut content = format!("{}={}\n", key_name, key);
+                        if let Some(base) = crate::subscription_catalog::configured_api_base() {
+                            content.push_str(&format!(
+                                "{}={}\n",
+                                crate::subscription_catalog::JCODE_API_BASE_ENV,
+                                base
+                            ));
+                        }
 
-                            let config_dir = crate::storage::app_config_dir()?;
-                            std::fs::create_dir_all(&config_dir)?;
-                            crate::platform::set_directory_permissions_owner_only(&config_dir)?;
-
-                            let file_path = config_dir.join(&env_file);
-                            std::fs::write(&file_path, content)?;
-                            crate::platform::set_permissions_owner_only(&file_path)?;
-                            crate::env::set_var(&key_name, &key);
-                          
```

---

### Incident Patch 14: `639cd0b8` (2026-10-04)
**Commit Message**: test(openrouter): keep the zai cached-context regression on a 200K GLM model

**File**: `crates/jcode-provider-openrouter-runtime/src/openrouter_tests.rs` (modified, +3/-1)
```diff
@@ -2291,7 +2291,9 @@ fn conifer_context_fallback_yields_to_live_and_disk_catalog_without_remapping_al
 
 #[test]
 fn explicit_cached_context_window_precedes_zai_family_fallback() {
-    let model = "glm-5.3-issue-1087";
+    // GLM-5.1 keeps a 200K static guess (GLM-5.2/5.3 moved to 1M in 083df8805),
+    // so the cached 1M window conflicts with it as the regression requires.
+    let model = "glm-5.1-issue-1087";
     jcode_base::provider::populate_context_limits(HashMap::from([(model.to_string(), 1_000_000)]));
     let provider = OpenRouterProvider {
         model: Arc::new(RwLock::new(model.to_string())),
```

---

### Incident Patch 15: `026dd5d1` (2026-10-04)
**Commit Message**: fix(openrouter): use env-applied profile's default model instead of OpenRouter default (fixes #1625)

**File**: `crates/jcode-provider-openrouter-runtime/src/lib.rs` (modified, +12/-0)
```diff
@@ -1722,6 +1722,18 @@ impl OpenRouterProvider {
                     .as_ref()
                     .and_then(|profile| profile.default_model.clone())
             })
+            .or_else(|| {
+                // A built-in profile applied through env (e.g. `--provider auto`
+                // enabling a configured DeepSeek key) sets the API base, which
+                // disables autodetection above. Fall back to that profile's own
+                // default model instead of the OpenRouter default, which the
+                // direct endpoint does not serve (#1625).
+                profile_id
+                    .as_deref()
+                    .and_then(openai_compatible_profile_by_id)
+                    .map(resolve_openai_compatible_profile)
+                    .and_then(|profile| profile.default_model)
+            })
             .unwrap_or_else(|| DEFAULT_MODEL.to_string());
 
         // Parse provider routing from environment
```

**File**: `crates/jcode-provider-openrouter-runtime/src/openrouter_tests.rs` (modified, +21/-0)
```diff
@@ -2146,6 +2146,27 @@ fn direct_deepseek_profile_uses_static_1m_context_when_catalog_is_absent() {
     assert_eq!(provider.context_window(), 1_000_000);
 }
 
+/// #1625: `--provider auto` applies the configured DeepSeek profile through
+/// env (API base, key name, cache namespace) without `JCODE_OPENROUTER_MODEL`.
+/// The explicit API base disables autodetection, so the model must come from
+/// the profile itself, not the OpenRouter `anthropic/claude-sonnet-4` default.
+#[test]
+fn env_applied_builtin_profile_uses_profile_default_model_not_openrouter_default() {
+    let _lock = ENV_LOCK.lock();
+    let _clean = isolate_openrouter_autodetect_env();
+    let _base = EnvVarGuard::set("JCODE_OPENROUTER_API_BASE", "https://api.deepseek.com");
+    let _key_name = EnvVarGuard::set("JCODE_OPENROUTER_API_KEY_NAME", "DEEPSEEK_API_KEY");
+    let _env_file = EnvVarGuard::set("JCODE_OPENROUTER_ENV_FILE", "deepseek.env");
+    let _api_key = EnvVarGuard::set("DEEPSEEK_API_KEY", "test");
+    let _namespace = EnvVarGuard::set("JCODE_OPENROUTER_CACHE_NAMESPACE", "deepseek");
+    let _catalog = EnvVarGuard::set("JCODE_OPENROUTER_MODEL_CATALOG", "0");
+
+    let provider = OpenRouterProvider::new().expect("provider");
+
+    assert_eq!(provider.model(), "deepseek-v4-flash");
+    assert_eq!(provider.context_window(), 1_000_000);
+}
+
 /// DeepSeek renamed `deepseek-v4-flash` to `deepseek-flash`. Its live
 /// `/v1/models` now reports `deepseek-flash` and `deepseek-v4-pro`; both are
 /// 1M-window models. Without the renamed spelling in the static classifier the
```

#### Recent Merged Pull Requests:
- **PR #1716** (closed): feat(provider): optional Claude Code mode that runs turns through the claude CLI (@SiavZ)
- **PR #1714** (2026-10-05): Group contiguous TUI typing into one undo step (@mg-mg-mg)
- **PR #1711** (2026-10-05): fix: idle-vs-interrupted disposition in PID crash detector (extends #988) (@SK-DEV-AI)
- **PR #1710** (closed): fix: idle-vs-interrupted disposition in PID crash detector (extends #988) (@SK-DEV-AI)
- **PR #1699** (2026-10-05): feat(usage): show Kimi Code, Cursor, and Z.ai Coding Plan quota in /usage (@ghoker143)
- **PR #1696** (2026-10-04): fix(herdr): close spawned panes on clean exit, keep state reports on herdr < 0.9.2 (@ddiawara)
- **PR #1691** (2026-10-04): fix(agent): bound malformed tool call recovery and stop coercing null arguments (@SiavZ)
- **PR #1682** (2026-10-04): feat(tui): Esc with a pending follow-up prompt stops the turn and runs it (@SiavZ)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
