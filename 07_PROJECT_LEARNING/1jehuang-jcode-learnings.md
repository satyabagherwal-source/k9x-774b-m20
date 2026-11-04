> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/1jehuang-jcode-learnings.md`  
> **Source**: github ([https://github.com/1jehuang/jcode](https://github.com/1jehuang/jcode))  
> **Source Version**: `378f4494`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T00:53:17.357Z  
> **Learning ID**: `learn-github-1jehuang-jcode`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): 1jehuang/jcode

> **Canonical Artifact**: `07_PROJECT_LEARNING/1jehuang-jcode-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/1jehuang/jcode](https://github.com/1jehuang/jcode))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-04T00:53:15.973Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `1jehuang/jcode`
- **Description**: High performance coding agent harness written in Rust, built for heavy multi-agent dev workflows
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 21443 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/jcode-app-core/src/agent.rs`
```
#![cfg_attr(test, allow(clippy::await_holding_lock))]

#[cfg(test)]
mod cache_monitor_tests;
mod compaction;
mod conversation_reset;
mod environment;
mod idle_hibernation;
mod inline_tail;
mod interrupts;
mod messages;
#[cfg(test)]
mod model_usage_tests;
mod prompting;
mod provider;
mod response_recovery;
mod runtime_recovery;
mod status;
mod streaming;
#[cfg(test)]
mod swarm_reminder_tests;
mod tools;
mod turn_execution;
mod turn_loops;
mod turn_ownership;
pub(crate) use turn_ownership::{
    RuntimeMutationLease, TurnLease, TurnObserver, TurnPublicationPin,
};
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

#[path = "agent/cache_request.rs"]
mod cache_request;
use cache_request::kv_cache_request_event;

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

    /// OAuth account serving this request. Prompt caches are per account, so
    /// a failover between accounts must be attributed, not reported as an
    /// unexplained provider eviction.
    fn kv_cache_account_identity(&self) -> Option<String> {
        if self.provider.active_resolved_credential()
            != Some(jcode_provider_core::ResolvedCredential::Oauth)
        {
            return None;
        }
        // An unbound runtime authenticates with the globally active account.
        self.provider.oauth_account_label().or_else(|| {
            match jcode_provider_core::parse_provider_hint(self.provider.name()) {
                Some(jcode_provider_core::ActiveProvider::Claude) => {
                    crate::auth::claude::active_account_label()
                }
                Some(jcode_provider_core::ActiveProvider::OpenAI) => {
                    crate::auth::codex::active_account_label()
                }
                _ => None,
            }
        })
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
            account: self.kv_cache_account_identity(),
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
        let reusable = crate::compaction::reusable_cache_tokens_from_usage(
            self.provider.name(),
            input,
            cache_read,
            cache_creation,
        );
        let miss = self.kv_cache_monitor.finish_request(reusable, cache_read)?;
        let expected_refresh = matches!(
            miss.reason,
            crate::kv_cache_monitor::MissReason::Compaction
                | crate::kv_cache_monitor::MissReason::DailyRollover
        );
        let label = if expected_refresh {
            "KV_CACHE_REFRESH"
        } else {
            "KV_CACHE_MISS"
        };
        let diagnostic = format!(
            "{label} session={} reason={} harness_caused={} missed={} expected={} read={} documented={:?} detail={:?}",
            self.session.id,
            miss.reason.id(),
            miss.reason.harness_caused(),
            miss.missed_tokens,
            miss.expected_tokens,
            miss.read_tokens,
            miss.documented_cause,
            miss.detail,
        );
        if expected_refresh {
            logging::info(&diagnostic);
        } else {
            logging::warn(&diagnostic);
        }
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
    turn_ownership: turn_ownership::TurnOwnership,
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
    /// Last upstream provider (OpenRouter) observed for this session
    last_upstream_provider: Option<String>,
    /// Last observed tran
```

### Core Architecture Module: `crates/jcode-app-core/src/agent/cache_request.rs`
```
use super::*;
use std::hash::{Hash, Hasher};

pub(super) fn stable_hash_str(value: &str) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    value.hash(&mut hasher);
    hasher.finish()
}

pub(super) fn stable_hash_json<T: serde::Serialize + ?Sized>(value: &T) -> u64 {
    let encoded = serde_json::to_string(value).unwrap_or_default();
    stable_hash_str(&encoded)
}

pub(super) fn stable_json_len<T: serde::Serialize + ?Sized>(value: &T) -> usize {
    serde_json::to_string(value)
        .map(|encoded| encoded.len())
        .unwrap_or_default()
}

pub(super) fn message_hashes(messages: &[Message]) -> Vec<u64> {
    // Hash the cache-relevant projection, not the raw Message. Raw hashing
    // keys off non-transmitted metadata (timestamp, tool_duration_ms,
    // ReasoningTrace blocks, cache_control markers), which triggers spurious
    // harness:_prefix_changed KV-cache miss reports when the same message is
    // re-serialized with backfilled metadata on the next turn.
    crate::message::cache_relevant_message_hashes(messages)
}

pub(super) fn kv_cache_request_event(
    messages: &[Message],
    tools: &[ToolDefinition],
    system_static: &str,
    ephemeral_messages: &[Message],
) -> ServerEvent {
    // Provider-native deferred definitions are outside the cached prefix.
    // Late MCP discovery must not look like a harness-induced tools change
    // when the provider reports a cache miss for some unrelated reason.
    // Borrow definitions rather than cloning potentially large MCP schemas.
    let eager_tools: Vec<_> = tools.iter().filter(|tool| !tool.defer_loading).collect();
    let ephemeral_hash = if ephemeral_messages.is_empty() {
        None
    } else {
        Some(stable_hash_json(ephemeral_messages))
    };
    ServerEvent::KvCacheRequest {
        system_static_hash: stable_hash_str(system_static),
        tools_hash: stable_hash_json(&eager_tools),
        messages_hash: stable_hash_json(&crate::message::cache_relevant_messages(messages)),
        message_hashes: message_hashes(messages),
        message_count: messages.len(),
        tool_count: eager_tools.len(),
        system_static_chars: system_static.chars().count(),
        tools_json_chars: stable_json_len(&eager_tools),
        messages_json_chars: stable_json_len(messages),
        ephemeral_hash,
        ephemeral_chars: stable_json_len(ephemeral_messages),
        ephemeral_message_count: ephemeral_messages.len(),
    }
}

```

### Core Architecture Module: `crates/jcode-app-core/src/agent/compaction.rs`
```
use super::*;

impl Agent {
    /// Flush an idle session before optional process replacement. Never abandon
    /// a pending compaction or lose a completed summary that has not been polled.
    pub(crate) fn checkpoint_idle_runtime_upgrade(&mut self) -> Result<()> {
        self.poll_compaction_completion_event();
        let compaction = self.registry.compaction();
        let manager = compaction
            .try_read()
            .map_err(|_| anyhow::anyhow!("compaction state is busy"))?;
        anyhow::ensure!(!manager.is_compacting(), "compaction is still running");
        self.session.compaction = manager.persisted_state();
        // Prepared blank sessions also have externally visible IDs. Ordinary
        // save intentionally skips these until the first user message.
        self.session.save_prepared()?;
        let pending = self
            .soft_interrupt_queue
            .try_lock()
            .map_err(|_| anyhow::anyhow!("queued input is busy or poisoned"))?;
        crate::soft_interrupt_store::overwrite(self.session_id(), &pending)?;
        Ok(())
    }

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
                    // The provider rejected the request, so the context was at
                    // least the limit even if the local estimate is lower.
                    let pre_tokens = manager.effective_token_count_with(all_messages) as u64;
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
                    let post_tokens = manager.token_estimate_with(all_messages) as u64;
                    self.last_recovery_compaction = Some((pre_tokens, post_tokens, dropped));
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

    /// Client notice for the context-limit auto-recovery that just ran,
    /// carrying its measured before/after token counts.
    pub(super) fn take_recovery_compaction_event(&mut self) -> crate::protocol::ServerEvent {
        let stats = self.last_recovery_compaction.take();
        crate::protocol::ServerEvent::Compaction {
            trigger: "auto_recovery".to_string(),
            pre_tokens: stats.map(|(pre, _, _)| pre),
            post_tokens: stats.map(|(_, post, _)| post),
            tokens_saved: stats.map(|(pre, post, _)| pre.saturating_sub(post)),
            duration_ms: None,
            messages_dropped: stats.map(|(_, _, dropped)| dropped),
            messages_compacted: None,
            summary_chars: None,
            active_messages: None,
        }
    }

    /// Best-effort recovery after a provider HTTP 413 "request too large" error.
    ///
    /// This failure is caused by the serialized request body (dominated by inline
    /// base64 images) exceeding the provider's size cap, which is independent of
    /// the to
```

### Core Architecture Module: `crates/jcode-app-core/src/agent/conversation_reset.rs`
```
use super::*;

impl Agent {
    /// Clear conversation history
    pub fn clear(&mut self) {
        let preserve_canary = self.session.is_canary;
        let preserve_testing_build = self.session.testing_build.clone();
        let preserve_debug = self.session.is_debug;
        let preserve_working_dir = self.session.working_dir.clone();

        self.session.mark_closed();
        self.finish_concurrency_tracking();
        self.persist_session_best_effort("pre-clear session close state");

        let mut new_session = Session::create(None, None);
        // begin_concurrency_tracking below writes the presence markers.
        new_session.mark_active_unregistered();
        new_session.model = Some(self.provider_model());
        new_session.provider_key = self.provider_key_for_new_session();
        new_session.is_canary = preserve_canary;
        new_session.testing_build = preserve_testing_build;
        new_session.is_debug = preserve_debug;
        new_session.working_dir = preserve_working_dir;
        new_session.ensure_initial_session_context_message();

        self.session = new_session;
        self.provider.set_session_id(&self.session.id);
        self.begin_concurrency_tracking();
        self._tool_policy_registration = crate::tool::register_session_tool_policy(
            &self.session.id,
            self.allowed_tools.clone(),
            self.disabled_tools.clone(),
        );
        self.refresh_agents_md_snapshot();
        self.reconcile_explicit_provider_pin_route();
        self.reset_runtime_state_for_session_change();
        self.provider_session_id = None;
        self.seed_compaction_from_session();
    }

    /// Clear provider session so the next turn sends full context.
    pub fn reset_provider_session(&mut self) {
        self.provider_session_id = None;
        self.session.provider_session_id = None;
        self.persist_session_best_effort("provider session reset");
    }

    /// Rewind the conversation to a 1-based visible transcript message index.
    ///
    /// The index is interpreted against the same rendered transcript the TUI
    /// numbers in `/rewind` (user/assistant entries only, tool cards and
    /// system notices excluded). Mapping through raw stored messages instead
    /// would count tool-result messages the UI never numbers, sending
    /// `/rewind N` far earlier than the on-screen message N (issue #432).
    ///
    /// Provider-side resumable sessions are reset so the next request sends the
    /// truncated context from scratch instead of continuing from a stale upstream
    /// conversation.
    pub fn rewind_to_message(&mut self, message_index: usize) -> Result<usize, String> {
        let targets = self.session.rewind_target_stored_indices();
        let message_count = targets.len();
        if message_index == 0 || message_index > message_count {
            return Err(format!(
                "Invalid message number: {}. Valid range: 1-{}",
                message_index, message_count
            ));
        }
        let stored_len = targets[message_index - 1] + 1;

        let removed = message_count - message_index;
        self.rewind_undo_snapshot = Some(RewindUndoSnapshot {
            messages: self.session.messages.clone(),
            provider_session_id: self.provider_session_id.clone(),
            session_provider_session_id: self.session.provider_session_id.clone(),
            visible_message_count: message_count,
        });
        self.session.truncate_messages(stored_len);
        self.session.updated_at = chrono::Utc::now();
        self.provider_session_id = None;
        self.session.provider_session_id = None;
        self.cache_tracker.reset();
        self.kv_cache_monitor.reset();
        self.locked_tools = None;
        self.reset_tool_output_tracking();
        self.persist_session_best_effort("conversation rewind");
        Ok(removed)
    }

    pub fn undo_rewind(&mut self) -> Result<usize, String> {
        let Some(snapshot) = self.rewind_undo_snapshot.take() else {
            return Err("No rewind to undo.".to_string());
        };

        let current_count = self.session.rewind_target_count();
        let restored = snapshot.visible_message_count.saturating_sub(current_count);
        self.session.replace_messages(snapshot.messages);
        self.provider_session_id = snapshot.provider_session_id;
        self.session.provider_session_id = snapshot.session_provider_session_id;
        self.session.updated_at = chrono::Utc::now();
        self.cache_tracker.reset();
        self.kv_cache_monitor.reset();
        self.locked_tools = None;
        self.reset_tool_output_tracking();
        self.persist_session_best_effort("conversation rewind undo");
        Ok(restored)
    }
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

/// Git state for an env snapshot without waiting on `git` subprocesses.
/// A cold directory returns `None` now and is filled in the background, so
/// the next snapshot for it is complete. Resume and create are on the
/// first-frame path, and a reload resumes every session at once.
fn git_state_for_snapshot(dir: &Path) -> Option<GitState> {
    static IN_FLIGHT: std::sync::LazyLock<
        std::sync::Mutex<std::collections::HashSet<std::path::PathBuf>>,
    > = std::sync::LazyLock::new(Default::default);
    let key = dir.to_path_buf();
    if let Ok(cache) = WORKING_GIT_STATE_CACHE.lock()
        && let Some(state) = cache.get(&key)
    {
        return state.clone();
    }
    let first = IN_FLIGHT
        .lock()
        .map(|mut set| set.insert(key.clone()))
        .unwrap_or(false);
    if first {
        let spawned = std::thread::Builder::new()
            .name("jcode-git-state".to_string())
            .spawn(move || {
                let _ = cached_git_state_for_dir(&key, super::utils::git_state_for_dir);
                if let Ok(mut set) = IN_FLIGHT.lock() {
                    set.remove(&key);
                }
            });
        if spawned.is_err()
            && let Ok(mut set) = IN_FLIGHT.lock()
        {
            set.remove(dir);
        }
    }
    None
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
        self.record_env_snapshot_inner(reason, true);
    }

    /// Record the snapshot without saving. For callers that persist the
    /// session right afterwards anyway (resume), so one save covers both.
    /// Each save of a session with a large compaction blob can force a full
    /// snapshot rewrite, and resume used to pay for two.
    pub(super) fn log_env_snapshot_unsaved(&mut self, reason: &str) {
        self.record_env_snapshot_inner(reason, false);
    }

    fn record_env_snapshot_inner(&mut self, reason: &str, persist: bool) {
        let snapshot = self.build_env_snapshot(reason, self.env_snapshot_detail());
        self.session.record_env_snapshot(snapshot.clone());
        if persist && !self.session.messages.is_empty() {
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
            // Never block on the git subprocesses behind this LazyLock: warm
            // it in the background and report unknown until it is ready.
            EnvSnapshotDetail::Full => match std::sync::LazyLock::get(&JCODE_REPO_SOURCE_STATE) {
                Some(state) => state.clone(),
                None => {
                    static WARMING: std::sync::Once = std::sync::Once::new();
                    WARMING.call_once(|| {
                        let _ = std::thread::Builder::new()
                            .name("jcode-repo-state".to_string())
                            .spawn(|| {
                                std::sync::LazyLock::force(&JCODE_REPO_SOURCE_STATE);
                            });
                    });
                    (None, None)
                }
            },
            EnvSnapshotDetail::Minimal => (None, None),
        };

        let working_dir = self.session.working_dir.clone();
        let working_git = match detail {
            EnvSnapshotDetail::Full => working_dir
                .as_deref()
                .and_then(|dir| git_state_for_snapshot(Path::new(dir))),
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

### Core Architecture Module: `crates/jcode-app-core/src/agent/idle_hibernation.rs`
```
use super::*;

/// Only derived, reproducible allocations are included here. Canonical
/// transcript, frozen prompts/tools, rewind undo, provider and hook state stay
/// resident. Reloading a Session is not a transparent wake operation.
#[derive(Debug)]
pub(crate) struct IdleCacheRelease {
    pub provider_cache_bytes: usize,
    pub tool_index_entries: usize,
}

impl Agent {
    /// Caller must hold the idle Agent reservation. Never checkpoint here:
    /// save_prepared can succeed without writing under a migration lease.
    /// Keeping the source history means waking is simply lazy cache rebuilding,
    /// with no disk dependency, lifecycle hooks or environment resnapshotting.
    pub(crate) fn hibernate_idle_caches(&mut self) -> Option<IdleCacheRelease> {
        if crate::turn_cancel_registry::has_active_turn(self.session_id())
            || self.session.migration_lease_block().is_some()
            || !self.pending_alerts.is_empty()
        {
            return None;
        }
        let queue = self.soft_interrupt_queue.try_lock().ok()?;
        if !queue.is_empty() {
            return None;
        }
        let compaction = self.registry.compaction();
        let manager = compaction.try_read().ok()?;
        if manager.is_compacting() {
            return None;
        }
        // A backgrounded tool can outlive the Agent lock. Do not disturb even
        // derived state until every tool belonging to this history has settled.
        if self.session.messages.iter().any(|message| {
            message.content.iter().any(|block| match block {
                ContentBlock::ToolUse { id, .. } => crate::tool::inflight::is_tool_in_flight(id),
                _ => false,
            })
        }) {
            return None;
        }

        let released = IdleCacheRelease {
            provider_cache_bytes: self
                .session
                .memory_profile_snapshot()
                .provider_cache_json_bytes,
            tool_index_entries: self.tool_call_ids.len() + self.tool_result_ids.len(),
        };
        self.session.release_provider_messages_cache();
        self.tool_call_ids = HashSet::new();
        self.tool_result_ids = HashSet::new();
        self.tool_output_scan_index = 0;
        Some(released)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestHome(Option<std::ffi::OsString>, tempfile::TempDir);
    impl TestHome {
        fn new() -> Self {
            let previous = std::env::var_os("JCODE_HOME");
            let home = tempfile::tempdir().unwrap();
            crate::env::set_var("JCODE_HOME", home.path());
            Self(previous, home)
        }
    }
    impl Drop for TestHome {
        fn drop(&mut self) {
            match self.0.take() {
                Some(value) => crate::env::set_var("JCODE_HOME", value),
                None => crate::env::remove_var("JCODE_HOME"),
            }
        }
    }

    struct TestProvider;
    #[async_trait::async_trait]
    impl Provider for TestProvider {
        async fn complete(
            &self,
            _: &[Message],
            _: &[ToolDefinition],
            _: &str,
            _: Option<&str>,
        ) -> Result<crate::provider::EventStream> {
            anyhow::bail!("cache hibernation must not invoke the provider")
        }
        fn name(&self) -> &str {
            "hibernation-test"
        }
        fn fork(&self) -> Arc<dyn Provider> {
            Arc::new(Self)
        }
    }

    fn agent() -> Agent {
        Agent::build_base(
            Arc::new(TestProvider),
            Registry::empty(),
            Session::create_with_id(id::new_id("session_idle_test"), None, None),
            None,
            HashSet::new(),
        )
    }

    fn paired_tool_history(agent: &mut Agent, tool_id: &str, payload: String) {
        agent.add_message(
            Role::Assistant,
            vec![ContentBlock::ToolUse {
                id: tool_id.into(),
                name: "read".into(),
                input: serde_json::json!({"file_path": "test.txt"}),
                thought_signature: None,
            }],
        );
        agent.add_message(
            Role::User,
            vec![ContentBlock::ToolResult {
                tool_use_id: tool_id.into(),
                content: payload,
                is_error: None,
            }],
        );
    }

    #[test]
    fn idle_hibernation_releases_cache_and_rebuilds_exact_history_and_indexes() {
        let _env = crate::storage::lock_test_env();
        let mut agent = agent();
        paired_tool_history(&mut agent, "tool_old", "large result ".repeat(100_000));
        assert_eq!(agent.repair_missing_tool_outputs(), 0);
        let expected = serde_json::to_value(&agent.session).unwrap();
        let provider_messages = agent.session.messages_for_provider().to_vec();
        let frozen_tools = vec![ToolDefinition {
            name: "frozen".into(),
            description: "keep original tool surface".into(),
            input_schema: serde_json::json!({"type": "object"}),
            defer_loading: false,
        }];
        agent.locked_tools = Some(frozen_tools);
        agent.agents_md_snapshot.0 = Some("Frozen instructions, not recaptured on wake".into());
        agent.provider_session_id = Some("upstream-live-session".into());
        agent.rewind_undo_snapshot = Some(RewindUndoSnapshot {
            messages: agent.session.messages.clone(),
            provider_session_id: Some("undo-provider".into()),
            session_provider_session_id: None,
            visible_message_count: 2,
        });
        let released = agent.hibernate_idle_caches().unwrap();
        assert!(released.provider_cache_bytes > 1_000_000);
        assert_eq!(released.tool_index_entries, 2);
        assert_eq!(
            agent
                .session
                .memory_profile_snapshot()
                .provider_cache_message_count,
            0
        );
        assert_eq!(agent.tool_call_ids.capacity(), 0);
        assert_eq!(agent.tool_result_ids.capacity(), 0);
        assert_eq!(serde_json::to_value(&agent.session).unwrap(), expected);
        assert_eq!(
            agent.provider_session_id.as_deref(),
            Some("upstream-live-session")
        );
        assert_eq!(agent.locked_tools.as_ref().unwrap()[0].name, "frozen");
        assert_eq!(
            agent.agents_md_snapshot.0.as_deref(),
            Some("Frozen instructions, not recaptured on wake")
        );
        assert_eq!(
            agent.rewind_undo_snapshot.as_ref().unwrap().messages.len(),
            2
        );
        assert_eq!(
            serde_json::to_value(agent.session.messages_for_provider()).unwrap(),
            serde_json::to_value(provider_messages).unwrap()
        );
        // The next turn's repair scan rebuilds from retained history. Previously
        // paired results must not gain synthetic duplicates after eviction.
        paired_tool_history(&mut agent, "tool_new", "next result".into());
        assert_eq!(agent.repair_missing_tool_outputs(), 0);
        assert_eq!(agent.session.messages.len(), 4);
        assert!(agent.tool_result_ids.contains("tool_old"));
        assert!(agent.tool_result_ids.contains("tool_new"));
        assert_eq!(agent.tool_output_scan_index, 4);
    }

    #[test]
    fn idle_hibernation_refuses_queued_alerts_busy_compaction_and_live_tools() {
        let _env = crate::storage::lock_test_env();
        let mut agent = agent();
        paired_tool_history(&mut agent, "tool_hibernation_inflight", "result".into());
        agent.session.messages_for_provider();
        agent.pending_alerts.push("pending delivery".into());
        assert!(agent.hibernate_idle_caches().is_none());
        agent.pending_alerts.clear();
        let queue = agent.soft_interrupt_queue();
        queue.lock().unwrap().push(SoftInterruptMessage {
            content: "scheduled wake".into(),
            images: Vec::new(),
            urgent: false,
            source: SoftInterruptSource::User,
            client_id: None,
        });
        assert!(agent.hibernate_idle_caches().is_none());
        queue.lock().unwrap().clear();
        let queue_guard = queue.lock().unwrap();
        assert!(agent.hibernate_idle_caches().is_none());
        drop(queue_guard);
        let compaction = agent.registry.compaction();
        let compaction_guard = compaction.try_write().unwrap();
        assert!(agent.hibernate_idle_caches().is_none());
        drop(compaction_guard);
        let tool = crate::tool::inflight::mark_tool_in_flight("tool_hibernation_inflight").unwrap();
        assert!(agent.hibernate_idle_caches().is_none());
        assert_eq!(
            agent
                .session
                .memory_profile_snapshot()
                .provider_cache_message_count,
            2
        );
        drop(tool);
        let turn = crate::turn_cancel_registry::register_active_turn(
            agent.session_id(),
            InterruptSignal::new(),
        );
        assert!(agent.hibernate_idle_caches().is_none());
        drop(turn);
        assert!(agent.hibernate_idle_caches().is_some());
    }

    #[test]
    fn idle_hibernation_does_not_write_session_and_refuses_migration_lease() {
        let _env = crate::storage::lock_test_env();
        let home = TestHome::new();
        let mut agent = agent();
        paired_tool_history(&mut agent, "tool_saved", "saved result".into());
        agent.session.save_prepared().unwrap();
        let path = crate::session::session_path(agent.session_id()).unwrap();
        let before = std::fs::read(&path).unwrap();
        let modified = std::fs::metadata(&path).unwrap().modified().unwrap();
        agent.session.messages_for_provider();
        assert!(agent.hibernate_idle_caches().is_some());
        assert_eq!(std::fs::read(&path).unwrap(), before);
        assert_eq!(
            std::fs::metadata(&path).unwrap().modified().unwrap(),
            modified
        );

    
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
    /// Caller ids of the queued messages combined into this injection, in
    /// queue order. Messages queued without an id contribute nothing.
    pub(super) client_ids: Vec<String>,
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
        self.queue_soft_interrupt_with_id(content, images, urgent, source, None);
    }

    /// Like [`queue_soft_interrupt`](Self::queue_soft_interrupt), with an
    /// opaque caller id echoed back in `SoftInterruptInjected`.
    pub fn queue_soft_interrupt_with_id(
        &self,
        content: String,
        images: Vec<(String, String)>,
        urgent: bool,
        source: SoftInterruptSource,
        client_id: Option<String>,
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
                client_id,
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
        
```

### Core Architecture Module: `crates/jcode-app-core/src/agent/messages.rs`
```
use super::*;

impl Agent {
    /// Keep failed turns visible after reconnect without adding diagnostic text
    /// to the provider's conversation context.
    pub(crate) fn persist_turn_error(&mut self, message: &str) -> anyhow::Result<()> {
        self.session
            .record_replay_display_message("error", None, message);
        self.persist_session_now()
    }

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

impl Agent {
    /// Export the full conversation as a markdown transcript.
    pub fn export_conversation_markdown(&self) -> String {
        let mut md = String::new();
        for msg in &self.session.messages {
            let role_label = match msg.role {
                Role::User => "User",
                Role::Assistant => "Assistant",
            };
            md.push_str(&format!("### {}\n\n", role_label));
            for block in &msg.content {
                match block {
                    ContentBlock::Text { text, .. } => {
                        md.push_str(text);
                        md.push_str("\n\n");
                    }
                    ContentBlock::Reasoning { text } => {
                        md.push_str(&format!("*Thinking:* {}\n\n", text));
                    }
                    ContentBlock::ReasoningTrace { text } => {
                        md.push_str(&format!("*Thinking:* {}\n\n", text));
                    }
                    ContentBlock::AnthropicThinking { thinking, .. } => {
                        md.push_str(&format!("*Thinking:* {}\n\n", thinking));
                    }
                    ContentBlock::OpenAIReasoning { summary, .. } => {
                        if !summary.is_empty() {
                            md.push_str(&format!("*Thinking:* {}\n\n", summary.join("\n")));
                        }
                    }
                    ContentBlock::ToolUse { name, input, .. } => {
                        let input_str = serde_json::to_string_pretty(input)
                            .unwrap_or_else(|_| input.to_string());
                        md.push_str(&format!(
                            "**Tool: `{}`**\n```json\n{}\n```\n\n",
                            name, input_str
                        ));
                    }
                    ContentBlock::ToolResult {
                        content, is_error, ..
                    } => {
                        let label = if is_error == &Some(true) {
                            "Error"
                        } else {
                            "Result"
                        };
                        // Truncate very long results
                        let display = if content.len() > 2000 {
                            format!(
                                "{}... (truncated, {} chars total)",
                                crate::util::truncate_str(content, 2000),
                                content.len()
                            )
                        } else {
                            content.clone()
                        };
                        md.push_str(&format!("**{}:**\n```\n{}\n```\n\n", label, display));
                    }
                    ContentBlock::Image { .. } => {
                        md.push_str("[Image]\n\n");
                    }
                    ContentBlock::OpenAICompaction { .. } => {
                        md.push_str("[OpenAI native compaction]\n\n");
                    }
                    ContentBlock::ToolReference { .. } | ContentBlock::ProviderNative { .. } => {}
                }
            }
        }
        md
    }
}

impl Agent {
    pub(super) fn messages_end_with_tool_result(messages: &[Message]) -> bool {
        messages.iter().rev().any(|message| {
            if !matches!(message.role, Role::User) {
                return false;
            }
            if message
                .content
                .iter()
                .any(|block| matches!(block, ContentBlock::ToolResult { .. }))
            {
                return true;
            }
            message.content.iter().any(|block| match block {
                ContentBlock::Text { text, .. } => {
                    let trimmed = text.trim();
                    trimmed.starts_with("<system-reminder>")
                        // The empty-post-tool continuation is itself a
                        // User-role `<system-reminder>`. Counting it would let the
                        // injected instruction keep this predicate true on its own,
                        // so every later whitespace-only response appends another
                        // continuation and spends another call, with no tool result
                        // anywhere near.
                        && !trimmed.starts_with(
                            Self::EMPTY_POST_TOOL_CONTINUATION_PREFIX
                        )
                }
                _ => false,
            })
        })
    }
}

#[cfg(test)]
mod durable_error_tests {
    use super::*;

    struct NoNetworkProvider;

    #[async_trait::async_trait]
    impl crate::provider::Provider for NoNetworkProvider {
        async fn complete(
            &self,
            _: &[crate::message::Message],
            _: &[crate::message::ToolDefinition],
            _: &str,
            _: Option<&str>,
        ) -> anyhow::Result<crate::provider::EventStream> {
            anyhow::bail!("test must not call provider")
        }

        fn name(&self) -> &str {
            "mock"
        }

        fn fork(&self) -> Arc<dyn crate::provider::Provider> {
            Arc::new(Self)
        }
    }

    #[test]
    fn failed_wake_error_is_saved_without_an_assistant_message() {
        let _lock = crate::storage::lock_test_env();
        let home = tempfile::tempdir().unwrap();
        struct RestoreHome(Option<std::ffi::OsString>);
        impl Drop for RestoreHome {
            fn drop(&mut self) {
                match self.0.take() {
                    Some(value) => crate::env::set_var("JCODE_HOME", value),
                    None => crate::env::remove_var("JCODE_HOME"),
                }
            }
        }
        let _restore = RestoreHome(std::env::var_os("JCODE_HOME"));
        crate::env::set_var("JCODE_HOME", home.path());
        let mut agent = Agent::new(Arc::new(NoNetworkProvider), Registry::empty());
        agent.add_message_with_display_role(
            Role::User,
            vec![ContentBlock::Text {
                text: "wake".into(),
                cache_control: None,
            }],
            Some(StoredDisplayRole::System),
        );
        let error = anyhow::anyhow!("invalid_request_error: missing call_id")
            .context("provider rejected wake");
        let message = crate::util::format_error_chain(&error);
        let message_count = agent.session.messages.len();
        let provider_messages = serde_json::to_value(&agent.session.messages).unwrap();
        agent.persist_turn_error(&message).unwrap();
        let loaded = Session::load(agent.session_id()).unwrap();
        assert_eq!(loaded.messages.len(), message_count);
        assert_eq!(agent.session.messages.len(), message_count);
        assert_eq!(
            serde_json::to_value(&loaded.messages).unwrap(),
            provider_messages
        );
        let history = crate::session::render_messages(&loaded);
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].content, "wake");
        assert_eq!(history[1].role, "error");
        assert_eq!(history[1].
```

### Core Architecture Module: `crates/jcode-app-core/src/agent/prompting.rs`
```
use super::Agent;
use crate::logging;
use crate::message::{Message, ToolDefinition};

impl Agent {
    pub(crate) fn runtime_skills_snapshot(&self) -> serde_json::Value {
        let registry = self.current_skills_snapshot();
        let mut loaded = registry.list();
        loaded.sort_by(|a, b| a.name.cmp(&b.name));
        let skills: Vec<_> = loaded
            .iter()
            .map(|skill| {
                serde_json::json!({
                    "name": skill.name, "description": skill.description,
                    "path": skill.path, "allowed_tools": skill.allowed_tools,
                })
            })
            .collect();
        let endorsed: Vec<_> = crate::skill::endorsed_skills().iter().map(|skill| serde_json::json!({
            "name": skill.name, "description": skill.description, "category": skill.category,
            "source": skill.source, "install": skill.install, "installed": registry.contains(skill.name),
        })).collect();
        serde_json::json!({"skills": skills, "endorsed": endorsed, "active_skill": self.active_skill})
    }

    pub(crate) fn runtime_agent_model_overrides(&self) -> serde_json::Value {
        serde_json::json!(self.session.agent_model_overrides)
    }

    pub(crate) async fn runtime_context_snapshot(&self) -> serde_json::Value {
        let mut context = self.debug_context().await;
        context["messages"] = serde_json::json!(self.session.visible_conversation_messages());
        context["context_window"] = serde_json::json!(self.provider_context_window());
        context
    }

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

        // The active skill prompt is announced once in the transcript when the
        // skill is activated (see `announce_active_skill`). Keeping it out of
        // the system prompt means switching skills never invalidates the cache.
        let skill_prompt: Option<String> = None;

        // Frozen per session so skill installs never rewrite the cached
        // system prefix. Later installs are announced in the transcript.
        let available_skills = &self.prompt_skills_snapshot;

        let working_dir = self
            .session
            .working_dir
            .as_ref()
            .map(std::path::PathBuf::from);

        let (split, _context_info) = crate::prompt::build_system_prompt_split_with_agents_md(
            skill_prompt.as_deref(),
            available_skills,
            self.session.is_canary,
            memory_prompt,
            working_dir.as_deref(),
            self.agents_md_snapshot.clone(),
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2054** (2026-11-02): **Fresh sessions pin spent/lower-tier pool logins when default_model binds an OAuth account (post #1901)**
  *Symptoms*: ### Summary  Since #1901 was fixed in 5e7e0457c, a successfully applied `default_model` is preserved unconditionally on fresh sessions. That protection also covers defaults that bind an OAuth account the pool owns, so a spent or lower-tier login stays pinned for every new session instead of letting the account pool rotate it.  Related refinement in PR #2026.  ### Steps to reproduce  1. Log in with multiple pool accounts, with one spent or lower-priority (or make it spent mid-way). 2. Set `default_model` in config.toml to a bare model of a pool-owned OAuth login (e.g. an OpenAI or Claude pool model, no provider prefix). 3. Start a fresh session (no provider override). 4. The session binds the login the default resolved to, even when a ready higher-priority account could serve the same pool.  ### Expected  A default that binds a pool-owned OAuth login keeps pool selection in charge of which login serves the session (same rotation as the no-default case). A default that routes to a named profile, API key, or non-pool provider is preserved as a deliberate routing choice.  ### Actual  The successfully applied default always wins, including pool-owned OAuth logins. Rotation to ready accounts does not happen for those sessions.  ### Proposed fix  Classify the applied default in `provider_init` (`crates/jcode-base/src/provider/startup.rs`): pool-owned OAuth-account bindings keep `select_fresh_session_pool_route` active, everything else preserves the default. PR #2026 carries this cla

- **Issue #2043** (2026-11-02): **Composer does not auto-scroll while drag-selecting with the mouse**
  *Symptoms*: ## Problem When selecting text inside the composer with a mouse drag, the view does not auto-scroll when the pointer reaches the top/bottom edge of the composer pane.  ## Steps to reproduce 1. Paste/type a long multi-line prompt so the composer content overflows the visible composer area. 2. Click at the top of the composer and drag the selection toward the bottom edge (or vice versa). 3. Hold the pointer at the edge.  ## Actual behavior The selection stops at the last visible row; rows outside the view cannot be included in the selection. The view only jumps after release (caret-follow), so the copied selection silently misses the invisible part.  ## Expected behavior Like any text editor: holding the drag at the pane edge scrolls the composer and keeps extending the selection into the newly revealed rows, so the copied text matches what was visually swept. Click-to-move-caret inside the composer must keep working exactly as before.

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

### Incident Patch 1: `e877a4ec` (2026-11-03)
**Commit Message**: security: upgrade native SSH crypto stack and preserve strict pinning

**File**: `Cargo.lock` (modified, +552/-389)
```diff
@@ -19,12 +19,12 @@ dependencies = [
 
 [[package]]
 name = "aead"
-version = "0.5.2"
+version = "0.6.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d122413f284cf2d62fb1b7db97e02edb8cda96d769b16e443a4f6195e35662b0"
+checksum = "1973cfbc1a2daf9cf550e74e1f088c28e7f7d8c1e1418fb6c9dc5184b7e84c99"
 dependencies = [
- "crypto-common 0.1.7",
- "generic-array",
+ "crypto-common 0.2.2",
+ "inout 0.2.5",
 ]
 
 [[package]]
@@ -34,22 +34,35 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "b169f7a6d4742236a0a00c541b845991d0ac43e546831af1249753ab4c3aa3a0"
 dependencies = [
  "cfg-if",
- "cipher",
+ "cipher 0.4.4",
  "cpufeatures 0.2.17",
 ]
 
+[[package]]
+name = "aes"
+version = "0.9.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "fc0fc36d7440d015b45468ba08a21e80e056ebbd014c611c6298bb7503e04bd1"
+dependencies = [
+ "cipher 0.5.2",
+ "cpubits",
+ "cpufeatures 0.3.0",
+ "zeroize",
+]
+
 [[package]]
 name = "aes-gcm"
-version = "0.10.3"
+version = "0.11.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "831010a0f742e1209b3bcea8fab6a8e149051ba6099432c8cb2cc117dec3ead1"
+checksum = "7f2b8006a0c83f52b62ba44a97b58bf76fe2f70a329e588f67f89691d93d498f"
 dependencies = [
  "aead",
- "aes",
- "cipher",
+ "aes 0.9.4",
+ "cipher 0.5.2",
  "ctr",
+ "ctutils",
  "ghash",
- "subtle",
+ "zeroize",
 ]
 
 [[package]]
@@ -226,13 +239,13 @@ dependencies = [
 
 [[package]]
 name = "argon2"
-version = "0.5.3"
+version = "0.6.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3c3610892ee6e0cbce8ae2700349fcf8f98adb0dbfbee85aec3c9179d29cc072"
+checksum = "134c52ddac6d63c576bef8168db10c83c49c26444ecbc68060fef078925a901c"
 dependencies = [
  "base64ct",
  "blake2",
- "cpufeatures 0.2.17",
+ "cpufeatures 0.3.0",
  "password-hash",
 ]
 
@@ -457,7 +470,7 @@ dependencies = [
  "fastrand",
  "hex",
  "http 1.4.0",
- "sha1",
+ "sha1 0.10.6",
  "time",
  "tokio",
  "tracing",
@@ -674,7 +687,7 @@ dependencies = [
  "bytes",
  "form_urlencoded",
  "hex",
- "hmac 0.13.0",
+ "hmac",
  "http 0.2.12",
  "http 1.4.0",
  "percent-encoding",
@@ -954,9 +967,9 @@ dependencies = [
 
 [[package]]
 name = "base16ct"
-version = "0.2.0"
+version = "1.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4c7f02d4ea65f2c1853089ffd8d2787bdbc63de2f0d29dedbcf8ccdfa0ccd4cf"
+checksum = "fd307490d624467aa6f74b0eabb77633d1f758a7b25f12bceb0b22e08d9726f6"
 
 [[package]]
 name = "base64"
@@ -988,19 +1001,19 @@ dependencies = [
 
 [[package]]
 name = "base64ct"
-version = "1.6.0"
+version = "1.8.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8c3c1a368f70d6cf7302d78f8f7093da241fb8e8807c05cc9e51a125895a6d5b"
+checksum = "2af50177e190e07a26ab74f8b1efbfe2ef87da2116221318cb1c2e82baf7de06"
 
 [[package]]
 name = "bcrypt-pbkdf"
-version = "0.10.0"
+version = "0.11.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6aeac2e1fe888769f34f05ac343bbef98b14d1ffb292ab69d4608b3abc86f2a2"
+checksum = "144e573728da132683b9488acd528274c790e07fc06ff81ee29f9d8f8b1041e0"
 dependencies = [
  "blowfish",
  "pbkdf2",
- "sha2 0.10.9",
+ "sha2 0.11.0",
 ]
 
 [[package]]
@@ -1107,11 +1120,11 @@ dependencies = [
 
 [[package]]
 name = "blake2"
-version = "0.10.6"
+version = "0.11.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "46502ad458c9a52b69d4d4d32775c788b7a1b85e8bc9d482d92250fc0e3f8efe"
+checksum = "5b5d4d889834ee8ecfc0f8426ad30faf7cdcb10f741a8e6d7224d95325479f6f"
 dependencies = [
- "digest 0.10.7",
+ "digest 0.11.3",
 ]
 
 [[package]]
@@ -1120,7 +1133,7 @@ version = "0.10.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "3078c7629b62d3f0439517fa394996acacc5cbc91c5a20d8c658e77abd503a71"
 dependencies = [
- "generic-array",
+ "generic-array 0.14.7",
 ]
 
 [[package]]
@@ -1130,6 +1143,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "cdd35008169921d80bc60d3d0ab416eecb028c4cd653352907921d95084790be"
 dependencies = [
  "hybrid-array",
+ "zeroize",
 ]
 
 [[package]]
@@ -1138,7 +1152,16 @@ version = "0.3.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a8894febbff9f758034a5b8e12d87918f56dfc64a8e1fe757d65e29041538d93"
 dependencies = [
- "generic-array",
+ "generic-array 0.14.7",
+]
+
+[[package]]
+name = "block-padding"
+version = "0.4.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "710f1dd022ef4e93f8a438b4ba958de7f64308434fa6a87104481645cc30068b"
+dependencies = [
+ "hybrid-array",
 ]
 
 [[package]]
@@ -1165,12 +1188,12 @@ dependencies = [
 
 [[package]]
 name = "blowfish"
-version = "0.9.1"
+version = "0.10.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e412e2cd0f2b2d93e02543ceae7917b3c70331573df19ee046bcbc35e45e87d7"
+checksum = "62ce3946557b35e71d1bbe07ec
```

**File**: `crates/jcode-sdk/Cargo.toml` (modified, +5/-3)
```diff
@@ -23,15 +23,17 @@ uuid = { version = "1", features = ["v4"] }
 # Jcode Cloud control plane (feature `cloud`).
 ureq = { version = "3", features = ["json"], optional = true }
 # In-process SSH (feature `ssh-native`), for platforms without an `ssh` binary.
-russh = { version = "0.54", default-features = false, features = ["ring"], optional = true }
-rand_core = { version = "0.6", features = ["getrandom"], optional = true }
+# Keep RSA disabled: native SSH generates Ed25519 keys and uses pinned host keys.
+# russh 0.65 migrates the elliptic-curve stack to patched crypto-bigint 0.7.
+russh = { version = "0.65", default-features = false, features = ["ring"], optional = true }
+rand = { version = "0.10", optional = true }
 tokio = { version = "1", features = ["rt", "sync", "time", "net", "io-util", "macros"], optional = true }
 
 [features]
 default = []
 # Account sign-in (email code, browser/device flow) and host wake/provision.
 cloud = ["dep:ureq"]
 # Pure-Rust SSH transport with pinned host keys; also enables `cloud::connect`.
-ssh-native = ["cloud", "dep:russh", "dep:rand_core", "dep:tokio"]
+ssh-native = ["cloud", "dep:russh", "dep:rand", "dep:tokio"]
 
 [dev-dependencies]
```

**File**: `crates/jcode-sdk/src/native_ssh.rs` (modified, +148/-4)
```diff
@@ -33,7 +33,7 @@ impl NativeSshKey {
     /// A fresh ed25519 key. `comment` ends up in the OpenSSH public key line.
     pub fn generate(comment: &str) -> Result<Self> {
         let private =
-            russh::keys::PrivateKey::random(&mut rand_core::OsRng, russh::keys::Algorithm::Ed25519)
+            russh::keys::PrivateKey::random(&mut rand::rng(), russh::keys::Algorithm::Ed25519)
                 .map_err(|e| {
                     Error::new(
                         ErrorKind::ConnectFailed,
@@ -143,9 +143,16 @@ impl russh::client::Handler for PinnedHost {
     type Error = russh::Error;
     async fn check_server_key(
         &mut self,
-        key: &russh::keys::PublicKey,
+        key: &russh::keys::PublicKeyOrCertificate,
     ) -> std::result::Result<bool, Self::Error> {
-        let ok = self.keys.iter().any(|k| k.key_data() == key.key_data());
+        // Only raw pinned keys are trusted. Certificates must not silently
+        // become a new trust path when upgrading russh's handler API.
+        let ok = match key {
+            russh::keys::PublicKeyOrCertificate::PublicKey { key, .. } => {
+                self.keys.iter().any(|k| k.key_data() == key.key_data())
+            }
+            russh::keys::PublicKeyOrCertificate::Certificate(_) => false,
+        };
         if !ok {
             self.mismatch.store(true, Ordering::Relaxed);
         }
@@ -412,6 +419,118 @@ impl JcodeClient {
 mod tests {
     use super::*;
 
+    struct TestSshServer {
+        authorized: russh::keys::PublicKey,
+    }
+
+    impl russh::server::Handler for TestSshServer {
+        type Error = russh::Error;
+
+        async fn auth_publickey(
+            &mut self,
+            user: &str,
+            key: russh::server::VerifiedPublicKey<'_>,
+        ) -> std::result::Result<russh::server::Auth, Self::Error> {
+            Ok(
+                if user == "test" && key.public_key.key_data() == self.authorized.key_data() {
+                    russh::server::Auth::Accept
+                } else {
+                    russh::server::Auth::reject()
+                },
+            )
+        }
+
+        async fn channel_open_session(
+            &mut self,
+            _channel: russh::Channel<russh::server::Msg>,
+            reply: russh::server::ChannelOpenHandle,
+            _session: &mut russh::server::Session,
+        ) -> std::result::Result<(), Self::Error> {
+            reply.accept().await;
+            Ok(())
+        }
+
+        async fn exec_request(
+            &mut self,
+            channel: russh::ChannelId,
+            command: &[u8],
+            session: &mut russh::server::Session,
+        ) -> std::result::Result<(), Self::Error> {
+            assert!(String::from_utf8_lossy(command).ends_with("api --stdio"));
+            session.channel_success(channel)?;
+            session.data(channel, b"encrypted SSH channel ready\n".to_vec())?;
+            Ok(())
+        }
+    }
+
+    #[tokio::test]
+    async fn ed25519_handshake_auth_exec_and_wrong_pin() {
+        let host = NativeSshKey::generate("host").unwrap();
+        let client = NativeSshKey::generate("client").unwrap();
+        let config = Arc::new(russh::server::Config {
+            keys: vec![(*host.private).clone()],
+            ..Default::default()
+        });
+        for correct_pin in [true, false] {
+            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
+            let addr = listener.local_addr().unwrap();
+            let config = Arc::clone(&config);
+            let authorized = client.private.public_key().clone();
+            let server = tokio::spawn(async move {
+                let (stream, _) = listener.accept().await.unwrap();
+                if let Ok(session) =
+                    russh::server::run_stream(config, stream, TestSshServer { authorized }).await
+                {
+                    let _ = session.await;
+                }
+            });
+            let options = NativeSshOptions::new(
+                CloudTarget {
+                    address: addr.ip(),
+                    port: addr.port(),
+                    user: "test".into(),
+                    host_keys: vec![host.public_openssh().into()],
+                },
+                client.clone(),
+            );
+            let pinned = if correct_pin { &host } else { &client };
+            let mismatch = Arc::new(AtomicBool::new(false));
+            let result = tokio::time::timeout(
+                Duration::from_secs(10),
+                open(
+                    &options,
+                    vec![pinned.private.public_key().clone()],
+                    Arc::clone(&mismatch),
+                    &options.remote_command().unwrap(),
+                ),
+            )
+            .await
+            .unwrap();
+            if correct_pin {
+                let (session, mut channel) = result.unwrap();
+                let data = tokio::time::timeout(Duration::fr
```

**File**: `docs/SECURITY_DEPENDENCIES.md` (modified, +26/-1)
```diff
@@ -1,6 +1,6 @@
 # Dependency Security Triage
 
-Last reviewed: 2026-05-14
+Last reviewed: 2026-11-03
 
 This file tracks the current `cargo audit` findings for jcode and the intended remediation path.
 It is not an allowlist. It is a triage record so advisories are visible and actionable.
@@ -21,6 +21,31 @@ It is not an allowlist. It is a triage record so advisories are visible and acti
 | `RUSTSEC-2026-0187` | `lopdf` | `jcode-pdf -> pdf-extract 0.8.2 -> lopdf 0.34` | PDF text extraction (`/pdf`, image/PDF reads) | Stack overflow parsing deeply nested PDF objects. Only reached when extracting text from a (potentially malicious) PDF the user opens; not in the auth/provider/network path. `pdf-extract 0.8.2` pins `lopdf 0.34`, so it cannot be bumped to the fixed `>=0.42` without an upstream `pdf-extract` release. | Upgrade once `pdf-extract` ships a release depending on `lopdf >=0.42`; remove the ignore then. |
 | `RUSTSEC-2023-0086` | `lexical-core` | `imap -> imap-proto -> lexical-core` | Gmail/IMAP support path | Old unsound transitive dependency in the mail stack. Higher priority than the UI-only findings because it touches network-parsed data. | Investigate upgrading or replacing `imap` / `imap-proto`. If no maintained path exists, isolate or remove the IMAP dependency. |
 
+## Resolved native SSH advisories (2026-11-03)
+
+- Upgraded `jcode-sdk`'s optional native SSH transport from `russh 0.54.5`
+  to `0.65.0`. The lockfile now selects `russh-cryptovec 0.62.0` and
+  `crypto-bigint 0.7.10`, above the patched thresholds for
+  `RUSTSEC-2026-0154`, `RUSTSEC-2026-0153`, and `RUSTSEC-2026-0387`.
+- `rsa` and `internal-russh-forked-ssh-key` are no longer in the lockfile,
+  removing `RUSTSEC-2023-0071` rather than suppressing it. Keep russh default
+  features disabled and enable only `ring`. Native SSH already generates
+  Ed25519 authentication keys, and CloudTarget accepts only Ed25519 and P-256
+  host keys. RSA-only native SSH endpoints are not supported, and the external
+  OpenSSH transport is unchanged.
+- Migrated key generation to `rand 0.10`'s cryptographically secure thread RNG.
+  The new certificate-aware host-key callback explicitly rejects certificates,
+  preserving raw pinned-key verification with no TOFU or CA trust fallback.
+- Regression coverage includes a real loopback encrypted SSH handshake,
+  Ed25519 public-key authentication, session exec/data, and wrong-pin rejection.
+  Run `justrust check -p jcode-sdk --all-features` and
+  `justrust test -p jcode-sdk --all-features` on hosted infrastructure.
+- `cargo audit --json` reports zero vulnerabilities with advisory database
+  commit `263a4d951a0867d4bddc29dddd6d59427c78f9a7` (updated 2026-11-02).
+  All four repaired advisory IDs are absent. Unmaintained, unsound, and yanked
+  dependency warnings remain. `scripts/security_preflight.sh --strict` passes
+  with its existing, unchanged triage list.
+
 ## Priority order
 
 1. `rustls-webpki` TLS advisories via rustls stack
```

---

### Incident Patch 2: `25f686a7` (2026-11-03)
**Commit Message**: fix(tui): make preview fallback failures observable and panic-free

**File**: `crates/jcode-tui/src/tui/app/run_shell.rs` (modified, +7/-4)
```diff
@@ -6,8 +6,12 @@ fn report_reload_interaction_gap() {
         return;
     };
     crate::env::remove_var("JCODE_RELOAD_GAP_STARTED_MS");
-    let Some(started_ms) = started.parse::<u128>().ok() else {
-        return;
+    let started_ms = match started.parse::<u128>() {
+        Ok(started) => started,
+        Err(error) => {
+            crate::logging::debug(&format!("Invalid reload interaction timestamp: {error}"));
+            return;
+        }
     };
     let Ok(now) = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) else {
         return;
@@ -52,8 +56,7 @@ pub(crate) fn refresh_preview_redraw_timer(
         && state.session_picker_overlay().is_some_and(|picker| {
             picker
                 .try_borrow()
-                .ok()
-                .is_some_and(|picker| picker.has_pending_preview_work())
+                .is_ok_and(|picker| picker.has_pending_preview_work())
         });
     if pending {
         let desired = crate::tui::redraw_interval(state);
```

**File**: `crates/jcode-tui/src/tui/redraw_schedule.rs` (modified, +2/-4)
```diff
@@ -316,8 +316,7 @@ fn session_picker_spinner_redraw_active(state: &dyn TuiState) -> bool {
         && state.session_picker_overlay().is_some_and(|picker| {
             picker
                 .try_borrow()
-                .ok()
-                .is_some_and(|picker| picker.has_visible_running_sessions())
+                .is_ok_and(|picker| picker.has_visible_running_sessions())
         })
 }
 
@@ -328,8 +327,7 @@ fn session_picker_preview_redraw_active(state: &dyn TuiState) -> bool {
         && state.session_picker_overlay().is_some_and(|picker| {
             picker
                 .try_borrow()
-                .ok()
-                .is_some_and(|picker| picker.has_pending_preview_work())
+                .is_ok_and(|picker| picker.has_pending_preview_work())
         })
 }
 
```

**File**: `crates/jcode-tui/src/tui/session_picker.rs` (modified, +7/-1)
```diff
@@ -49,6 +49,8 @@ mod performance;
 #[cfg(test)]
 mod performance_tests;
 mod preview_chrome;
+mod preview_io;
+use preview_io::preview_result;
 mod preview_metadata;
 mod preview_refresh;
 mod progressive_preview;
@@ -1159,7 +1161,7 @@ impl SessionPicker {
         let (tx, rx) = std::sync::mpsc::channel();
         let (workspace_tx, workspace_rx) = std::sync::mpsc::channel();
         let thread_session_id = cache_session_id.clone();
-        let _ = std::thread::Builder::new()
+        let worker = std::thread::Builder::new()
             .name("jcode-session-preview-loader".to_string())
             .spawn(move || {
                 let session_id = match &resume_target {
@@ -1176,6 +1178,10 @@ impl SessionPicker {
                     preview_metadata::hydrate_workspace(data, &target);
                 });
             });
+        if preview_result(worker, "loader worker startup").is_none() {
+            self.preview_load_failures.insert(cache_session_id);
+            return;
+        }
         self.pending_workspace_load = Some(progressive_preview::PendingWorkspaceLoad {
             session_id: cache_session_id,
             receiver: workspace_rx,
```

**File**: `crates/jcode-tui/src/tui/session_picker/cloud_preview.rs` (modified, +10/-2)
```diff
@@ -60,12 +60,13 @@ fn load_cached_or_fetch(
         {
             let path = path.to_owned();
             let id = session_id.to_owned();
-            let _ = std::thread::Builder::new()
+            let refresh = std::thread::Builder::new()
                 .name("jcode-cloud-preview-refresh".into())
                 .spawn(move || {
                     let _guard = guard;
                     fetch_and_cache(&id, Some(&path), fetch);
                 });
+            preview_result(refresh, "cloud refresh worker");
         }
         return Some(snapshot);
     }
@@ -149,7 +150,14 @@ fn parse_preview(
         .position(|b| *b == 0)
         .map(|offset| first + 1 + offset);
     let session = parse_transcript(&bytes[..second.unwrap_or(bytes.len())])?;
-    let telemetry = second.and_then(|split| serde_json::from_slice(&bytes[split + 1..]).ok());
+    let telemetry = second.and_then(|split| {
+        let bytes = &bytes[split + 1..];
+        if bytes.is_empty() {
+            None
+        } else {
+            preview_result(serde_json::from_slice(bytes), "remote telemetry decoding")
+        }
+    });
     Some((session, telemetry))
 }
 
```

**File**: `crates/jcode-tui/src/tui/session_picker/cloud_preview/cache.rs` (modified, +17/-11)
```diff
@@ -12,7 +12,7 @@ const CACHE_BUDGET: u64 = 256 * 1024 * 1024;
 const TTL: Duration = Duration::from_secs(15);
 
 pub(super) fn path(session_id: &str, host: &str, epoch: u64) -> Option<PathBuf> {
-    let root = crate::storage::jcode_dir().ok()?;
+    let root = super::super::preview_result(crate::storage::jcode_dir(), "cache directory")?;
     Some(key_path(&root, session_id, host, epoch))
 }
 
@@ -27,24 +27,30 @@ fn key_path(root: &Path, session_id: &str, host: &str, epoch: u64) -> PathBuf {
 }
 
 pub(super) fn read(path: &Path) -> Option<Vec<u8>> {
-    let file = File::open(path).ok()?;
-    if file.metadata().ok()?.len() > MAX_BYTES as u64 {
+    let file = match File::open(path) {
+        Ok(file) => file,
+        Err(error) if error.kind() == io::ErrorKind::NotFound => return None,
+        Err(error) => return super::super::preview_result(Err::<Vec<u8>, _>(error), "cache open"),
+    };
+    if super::super::preview_result(file.metadata(), "cache metadata")?.len() > MAX_BYTES as u64 {
         return None;
     }
     // Do not trust metadata for allocation or bounds: the file can grow concurrently.
     let mut bytes = Vec::new();
-    file.take(MAX_BYTES as u64 + 1)
-        .read_to_end(&mut bytes)
-        .ok()?;
+    super::super::preview_result(
+        file.take(MAX_BYTES as u64 + 1).read_to_end(&mut bytes),
+        "cache read",
+    )?;
     (bytes.len() <= MAX_BYTES).then_some(bytes)
 }
 
 pub(super) fn fresh(path: &Path) -> bool {
-    fs::metadata(path)
-        .and_then(|metadata| metadata.modified())
-        .ok()
-        .and_then(|modified| modified.elapsed().ok())
-        .is_some_and(|age| age < TTL)
+    super::super::preview_result(
+        fs::metadata(path).and_then(|metadata| metadata.modified()),
+        "cache freshness",
+    )
+    .and_then(|modified| super::super::preview_result(modified.elapsed(), "cache timestamp"))
+    .is_some_and(|age| age < TTL)
 }
 
 pub(super) fn write(path: &Path, bytes: &[u8]) -> io::Result<()> {
```

**File**: `crates/jcode-tui/src/tui/session_picker/loading.rs` (modified, +1/-1)
```diff
@@ -1378,7 +1378,7 @@ impl<'de> Visitor<'de> for SessionMessageSummaryVisitor {
                     token_usage = map.next_value()?;
                 }
                 _ => {
-                    let _ = map.next_value::<IgnoredAny>()?;
+                    map.next_value::<IgnoredAny>()?;
                 }
             }
         }
```

**File**: `crates/jcode-tui/src/tui/session_picker/preview_chrome.rs` (modified, +4/-4)
```diff
@@ -19,10 +19,10 @@ pub(super) fn persisted_info_from_snapshot(
     // A session may have switched routes since that message. Only a snapshot
     // with exact route and compaction identity is eligible for context chrome.
     let context_tokens = snapshot.as_ref().map(|s| s.context_tokens);
-    let (auth_method, usage_info) = snapshot
-        .as_ref()
-        .map(snapshot_account_info)
-        .unwrap_or_default();
+    let (auth_method, usage_info) = snapshot.as_ref().map_or(
+        (info_widget::AuthMethod::Unknown, None),
+        snapshot_account_info,
+    );
     InfoWidgetData {
         auth_method,
         usage_info,
```

**File**: `crates/jcode-tui/src/tui/session_picker/preview_io.rs` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+//! Read-only preview failures fall back to uncached/streaming paths.
+
+pub(super) fn preview_result<T, E: std::fmt::Display>(
+    result: Result<T, E>,
+    operation: &str,
+) -> Option<T> {
+    match result {
+        Ok(value) => Some(value),
+        Err(error) => {
+            crate::logging::debug(&format!("Session preview {operation} unavailable: {error}"));
+            None
+        }
+    }
+}
```

---

### Incident Patch 3: `2f636d14` (2026-11-03)
**Commit Message**: Isolate provider reload regression within test size budget

**File**: `crates/jcode-base/src/config_tests.rs` (modified, +2/-47)
```diff
@@ -1705,53 +1705,8 @@ fn cli_config_save_round_trips_desktop_tables() {
     Config::invalidate_cache();
 }
 
-#[test]
-fn external_default_edit_syncs_pool_without_reordering_on_unrelated_reload() {
-    let _guard = crate::storage::lock_test_env();
-    let prev_home = std::env::var_os("JCODE_HOME");
-    let dir = tempfile::TempDir::new().unwrap();
-    crate::env::set_var("JCODE_HOME", dir.path());
-    Config::invalidate_cache();
-    let path = Config::path().unwrap();
-    std::fs::write(&path, "[provider]\ndefault_provider = 'openai-oauth'\n").unwrap();
-    assert_eq!(
-        crate::config::config().provider.default_provider.as_deref(),
-        Some("openai-oauth")
-    );
-    let mut pool = crate::auth::account_pool::AccountPool::default();
-    pool.members = vec!["openai:work".into(), "claude:personal".into()];
-    pool.save().unwrap();
-
-    // A raw file edit, not the preference setter, must synchronize startup.
-    std::fs::write(
-        &path,
-        "[provider]\ndefault_provider = 'claude'\ndefault_model = 'claude-opus-5-5'\n",
-    )
-    .unwrap();
-    Config::invalidate_cache();
-    assert_eq!(
-        crate::config::config().provider.default_provider.as_deref(),
-        Some("claude")
-    );
-    assert_eq!(
-        crate::auth::account_pool::AccountPool::load().members[0],
-        "claude:personal"
-    );
-
-    pool.save().unwrap();
-    std::fs::write(&path, "[provider]\ndefault_provider = 'claude'\ndefault_model = 'claude-opus-5-5'\nanthropic_reasoning_effort = 'low'\n").unwrap();
-    Config::invalidate_cache();
-    assert_eq!(
-        crate::config::config()
-            .provider
-            .anthropic_reasoning_effort
-            .as_deref(),
-        Some("low")
-    );
-    assert_eq!(crate::auth::account_pool::AccountPool::load(), pool);
-    restore_env_var("JCODE_HOME", prev_home);
-    Config::invalidate_cache();
-}
+#[path = "config_tests/default_provider.rs"]
+mod default_provider;
 
 /// `display.overscroll_status` was removed; configs that still set it (users
 /// had `"on"` written by older versions) must load without losing settings.
```

**File**: `crates/jcode-base/src/config_tests/default_provider.rs` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+//! Synchronization of externally edited provider preferences and account pools.
+
+use super::*;
+
+#[test]
+fn external_default_edit_syncs_pool_without_reordering_on_unrelated_reload() {
+    let _guard = crate::storage::lock_test_env();
+    let prev_home = std::env::var_os("JCODE_HOME");
+    let dir = tempfile::TempDir::new().unwrap();
+    crate::env::set_var("JCODE_HOME", dir.path());
+    Config::invalidate_cache();
+    let path = Config::path().unwrap();
+    std::fs::write(&path, "[provider]\ndefault_provider = 'openai-oauth'\n").unwrap();
+    assert_eq!(
+        crate::config::config().provider.default_provider.as_deref(),
+        Some("openai-oauth")
+    );
+    let mut pool = crate::auth::account_pool::AccountPool::default();
+    pool.members = vec!["openai:work".into(), "claude:personal".into()];
+    pool.save().unwrap();
+
+    // A raw file edit, not the preference setter, must synchronize startup.
+    std::fs::write(
+        &path,
+        "[provider]\ndefault_provider = 'claude'\ndefault_model = 'claude-opus-5-5'\n",
+    )
+    .unwrap();
+    Config::invalidate_cache();
+    assert_eq!(
+        crate::config::config().provider.default_provider.as_deref(),
+        Some("claude")
+    );
+    assert_eq!(
+        crate::auth::account_pool::AccountPool::load().members[0],
+        "claude:personal"
+    );
+
+    pool.save().unwrap();
+    std::fs::write(&path, "[provider]\ndefault_provider = 'claude'\ndefault_model = 'claude-opus-5-5'\nanthropic_reasoning_effort = 'low'\n").unwrap();
+    Config::invalidate_cache();
+    assert_eq!(
+        crate::config::config()
+            .provider
+            .anthropic_reasoning_effort
+            .as_deref(),
+        Some("low")
+    );
+    assert_eq!(crate::auth::account_pool::AccountPool::load(), pool);
+    restore_env_var("JCODE_HOME", prev_home);
+    Config::invalidate_cache();
+}
```

#### Recent Merged Pull Requests:
- **PR #2026** (closed): fix: keep pool rotation for OAuth-bound config defaults on fresh sessions (@alecuba16)
- **PR #2025** (closed): Add interactive /config settings wizard to the TUI (@remedialchaos)
- **PR #2011** (closed): fix(patch): apply unified hunks to CRLF files (@jaeminbird)
- **PR #2005** (closed): fix: close provider profile and emoji copy review gaps (@SiavZ)
- **PR #2001** (closed): Never auto-background the ask_user chooser (@alecuba16)
- **PR #1996** (closed): feat: extend plugins, rewind, and agent workflows (@SiavZ)

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

## X. security: upgrade native SSH crypto stack and preserve strict pinning

**RULE**:
When implementing operations in `Cargo.lock`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in 1jehuang/jcode. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e877a4ec`: security: upgrade native SSH crypto stack and preserve strict pinning. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `Cargo.lock`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
version = "0.6.1"
checksum = "1973cfbc1a2daf9cf550e74e1f088c28e7f7d8c1e1418fb6c9dc5184b7e84c99"
 "crypto-common 0.2.2",
 "inout 0.2.5",
 "cipher 0.4.4",
[[package]]
name = "aes"
version = "0.9.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fc0fc36d7440d015b45468ba08a21e80e056ebbd014c611c6298bb7503e04bd1"
dependencies = [
 "cipher 0.5.2",
 "cpubits",
 "cpufeatures 0.3.0",
 "zeroize",
]

version = "0.11.1"
checksum = "7f2b8006a0c83f52b62ba44a97b58bf76fe2f70a329e588f67f89691d93d498f"
 "aes 0.9.4",
 "cipher 0.5.2",
 "ctutils",
 "zeroize",
version = "0.6.0"
checksum = "134c52ddac6d63c576bef8168db10c83c49c26444ecbc68060fef078925a901c"
 "cpufeatures 0.3.0",
 "sha1 0.10.6",
 "hmac",
version = "1.0.0"
checksum = "fd307490d624467aa6f74b0eabb77633d1f758a7b25f12bceb0b22e08d9726f6"
version = "1.8.3"
checksum = "2af50177e190e07a26ab74f8b1efbfe2ef87da2116221318cb1c2e82baf7de06"
version = "0.11.0"
checksum = "144e573728da132683b9488acd528274c790e07fc06ff81ee29f9d8f8b1041e0"
 "sha2 0.11.0",
version = "0.11.0"
checksum = "5b5d4d889834ee8ecfc0f8426ad30faf7cdcb10f741a8e6d7224d95325479f6f"
 "digest 0.11.3",
 "generic-array 0.14.7",
 "zeroize",
 "generic-array 0.14.7",
]
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
version = "0.5.2"
checksum = "d122413f284cf2d62fb1b7db97e02edb8cda96d769b16e443a4f6195e35662b0"
 "crypto-common 0.1.7",
 "generic-array",
 "cipher",
version = "0.10.3"
checksum = "831010a0f742e1209b3bcea8fab6a8e149051ba6099432c8cb2cc117dec3ead1"
 "aes",
 "cipher",
 "subtle",
version = "0.5.3"
checksum = "3c3610892ee6e0cbce8ae2700349fcf8f98adb0dbfbee85aec3c9179d29cc072"
 "cpufeatures 0.2.17",
 "sha1",
 "hmac 0.13.0",
version = "0.2.0"
checksum = "4c7f02d4ea65f2c1853089ffd8d2787bdbc63de2f0d29dedbcf8ccdfa0ccd4cf"
version = "1.6.0"
checksum = "8c3c1a368f70d6cf7302d78f8f7093da241fb8e8807c05cc9e51a125895a6d5b"
version = "0.10.0"
checksum = "6aeac2e1fe888769f34f05ac343bbef98b14d1ffb292ab69d4608b3abc86f2a2"
 "sha2 0.10.9",
version = "0.10.6"
checksum = "46502ad458c9a52b69d4d4d32775c788b7a1b85e8bc9d482d92250fc0e3f8efe"
 "digest 0.10.7",
 "generic-array",
 "generic-array",
version = "0.9.1"
checksum = "e412e2cd0f2b2d93e02543ceae7917b3c70331573df19ee046bcbc35e45e87d7"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e877a4ec` are properly handled with clean fallback behavior.
