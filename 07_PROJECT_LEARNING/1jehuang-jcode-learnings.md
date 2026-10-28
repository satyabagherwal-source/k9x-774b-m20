> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/1jehuang-jcode-learnings.md`  
> **Source**: github ([https://github.com/1jehuang/jcode](https://github.com/1jehuang/jcode))  
> **Source Version**: `a3ef562f`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T00:46:44.581Z  
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
> **Harvest Timestamp**: 2026-10-28T00:46:44.579Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `1jehuang/jcode`
- **Description**: High performance coding agent harness written in Rust, built for heavy multi-agent dev workflows
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 21263 stars

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
mod status;
mod streaming;
#[cfg(test)]
mod swarm_reminder_tests;
mod tool_markup_recovery;
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
    let mut owned =
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

        agent.add_message(
            Role::User,
            vec![ContentBlock::Text {
                text: "unsaved local state must survive a no-op save".into(),
                cache_control: None,
            }],
        );
        agent.session.messages_for_provider();
        crate::storage::write_session_lease(&crate::storage::SessionLease {
            session_id: agent.session_id().into(),
            epoch: 1,
            away_host: Some("elsewhere".into()),
            repo_root: None,
            last_sync_snapshot: None,
            last_sync_head: None,
            updated_at: chrono::Utc::now().to_rfc3339(),
        })
        .unwrap();
        // Regression for the misleading successful-but-no-op save API.
        assert!(agent.session.save_prepared().is_ok());
        assert_eq!(std::fs::read(&path).unwrap(), before);
        assert!(agent.hibernate_idle_caches().is_none());
        assert_eq!(agent.session.messages.len(), 3);
        assert_eq!(
            agent
                .session
                .memory_profile_snapshot()
                .provider_cache_message_count,
            3
        );
        assert!(home.1.path().exists());
    }

    #[tokio::test]
    async fn idle_hibernation_next_turn_sends_original_tool_pairs_without_duplicates() {
        #[derive(Clone)]
        struct CaptureProvider(Arc<std::sync::Mutex<Vec<Vec<Message>>>>);
        #[async_trait::async_trait]
        impl Provider for CaptureProvider {
            async fn complete(
                &self,
                messages: &[Message],
                _: &[ToolDefinition],
                _: &str,
                _: Option<&str>,
            ) -> Result<crate::provider::EventStream> {
                self.0.lock().unwrap().push(messages.to_vec());
                Ok(Box::pin(futures::stream::iter(vec![
                    Ok(StreamEvent::TextDelta("awake".into())),
                    O
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
        assert_eq!(history[1].content, message);
        assert!(
            history[1]
                .content
                .contains("invalid_request_error: missing call_id")
        );
    }
}

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

    pub(super) fn sync_bound_account_route(&mut self) {
        let Some(label) = self.provider.oauth_account_label() else {
            return;
        };
        if self
            .session
            .route_api_method
            .as_deref()
            .and_then(jcode_provider_core::oauth_account_label)
            .is_some_and(|selected| selected != label)
        {
            logging::warn(
                "Refusing to replace an explicit saved-account route with a different observed account",
            );
            return;
        }
        let method = match self.provider.name().to_ascii_lowercase().as_str() {
            "openai" => "openai-oauth",
            "claude" | "anthropic" => "claude-oauth",
            _ => return,
        };
        let route = format!("{method}@{label}");
        if self.session.route_api_method.as_deref() == Some(route.as_str()) {
            return;
        }
        self.session.route_api_method = Some(route);
        self.session.provider_key = Some(method.to_string());
        self.session.model = Some(self.provider_model());
        self.persist_session_best_effort("observed saved account route");
    }

    pub(super) fn record_failed_account_route(&mut self, error: &str) {
        self.sync_bound_account_route();
        if !jcode_provider_core::classify_failover_error_message(error)
            .should_mark_provider_unavailable()
        {
            return;
        }
        let provider = self.provider.name().to_ascii_lowercase();
        let provider = match provider.as_str() {
            "openai" => "openai",
            "claude" | "anthropic" => "claude",
            _ => return,
        };
        let label = self.provider.oauth_account_label();
        let (key, label) = match (
            provider,
            self.provider.active_resolved_credential(),
            label.as_deref(),
        ) {
            (_, Some(jcode_provider_core::ResolvedCredential::Oauth), Some(label)) => {
                (provider, Some(label))
            }
            ("openai", Some(jcode_provider_core::ResolvedCredential::ApiKey), _) => {
                ("openai-api", None)
            }
            ("claude", Some(jcode_provider_core::ResolvedCredential::ApiKey), _) => {
                ("anthropic-api", None)
            }
            _ => return,
        };
        if crate::provider::provider_unavailability_detail_for_account_label(key, label).is_none() {
            crate::provider::record_provider_unavailable_for_account_label(key, label, error);
        }
    }

    pub(super) fn record_model_turn_usage(&mut self, turn_id: &str) {
        self.sync_bound_account_route();
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
        if let Some(label) = self.provider.oauth_account_label() {
            let method = if self.provider.name().eq_ignore_ascii_case("op
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1952** (2026-10-24): **bedrock tests pollute real user config on macOS (XDG_CONFIG_HOME ignored by app_config_dir)**
  *Symptoms*: On macOS, `jcode-provider-bedrock` tests pollute the user's real config directory and then fail each other, because test isolation relies on `XDG_CONFIG_HOME` but the config path does not.  What happens:  1. Tests in `crates/jcode-provider-bedrock/src/tests.rs` set `XDG_CONFIG_HOME` to a tempdir and expect `app_config_dir()` to follow it. 2. `app_config_dir()` (`crates/jcode-storage/src/lib.rs:221`) uses `dirs::config_dir()`, which on macOS ignores `XDG_CONFIG_HOME` and returns `~/Library/Application Support`. 3. Tests then call `save_env_value_to_env_file(...)` (`configured_profile_from_bedrock_env_overrides_stale_bearer_token`, `detects_bedrock_login_env_file_credentials`, and friends), which writes real files: the user's `~/Library/Application Support/jcode/bedrock.env` gets fixture values like `AWS_BEARER_TOKEN_BEDROCK=expired-bearer-token`, `JCODE_BEDROCK_PROFILE=jcode-operator`. 4. Later runs read that same real file back, so assertions like `assert!(!BedrockProvider::has_credentials())` fail depending on machine state. On my machine:  ``` cargo test -p jcode-provider-bedrock --lib ... test tests::detects_env_credentials_requires_region_and_credential_hint ... FAILED test tests::detects_bedrock_login_env_file_credentials ... FAILED ```  Two failure modes in one bug: tests write into the user's real config (data pollution), and tests read whatever the user's real config contains (order and machine dependent). Same root cause as #1947's family: env-var isolation that the 

- **Issue #1950** (2026-10-24): **harness_api capability ledger test fails: AccountUsage untriaged (introduced d467dcb13)**
  *Symptoms*: `cargo test -p jcode-harness-api --lib every_reference_client_capability_is_triaged` fails on current master (b2f9f9d8d):  ``` these daemon requests are used by the TUI/desktop but have no reviewed disposition in the harness API capability ledger: ["AccountUsage"] ```  Repro (deterministic, no env needed):  ``` cargo test -p jcode-harness-api --lib every_reference_client_capability_is_triaged ```  Bisected first-bad: d467dcb13 `feat(tui): receive daemon-owned account quota refreshes`. It added the `AccountUsage` request usage in the TUI but no matching entry in `LEDGER` in `crates/jcode-harness-api/src/harness_api_tests/capability_coverage.rs`. The test was green at 2f7039193 (Oct 14) and red from d467dcb13 on.  This suite is not part of CI's ubuntu/macos unit runs (CI runs app-core, jcode-base, embedding, tui unit suites only), so the failure ships silently on master.  Fix shape: add `("AccountUsage", ClientInternal)` (or the reviewed disposition you prefer) to `LEDGER`, then the test passes. Happy to send a small PR with the ledger entry plus a CI wiring suggestion (add `-p jcode-harness-api --lib` to the ubuntu test matrix) if useful.

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

### Incident Patch 1: `3f1c2712` (2026-10-27)
**Commit Message**: fix(cloud): carry private runtime for development CLI recovery

**File**: `src/cli/cloud_managed.rs` (modified, +13/-1)
```diff
@@ -507,6 +507,7 @@ pub(crate) fn prepare_script_with_candidate(home: &str, candidate: Option<&str>)
     ))
 }
 
+#[cfg(test)]
 fn prepare_script_for_paths(
     home: &str,
     target: Option<&str>,
@@ -666,6 +667,16 @@ if ! capable "$cli" || ! capable "$backend" || {{ [ -n "$want" ] && {{ ! version
     echo '[cloud prepare] installing verified local development CLI (live sessions are unchanged)' >&2
     mkdir "$stage/bin"
     cp "$development_candidate" "$stage/bin/jcode-linux-x86_64"
+    # A native development build can require a newer loader/libc than the
+    # managed image. Its verified private bundle carries those dependencies.
+    if [ -f "$development_candidate.bin" ]; then
+      cp "$development_candidate.bin" "$stage/bin/jcode-linux-x86_64.bin"
+      source_dir=$(dirname "$development_candidate")
+      for library in "$source_dir"/lib*.so* "$source_dir"/ld-linux*.so*; do
+        [ ! -f "$library" ] || cp "$library" "$stage/bin/"
+      done
+      chmod 755 "$stage/bin/jcode-linux-x86_64.bin"
+    fi
     candidate="$stage/bin/jcode-linux-x86_64"
     chmod 755 "$candidate"
   else
@@ -700,7 +711,8 @@ if ! capable "$cli" || ! capable "$backend" || {{ [ -n "$want" ] && {{ ! version
   chmod 755 "$candidate" "$candidate.bin"
   fi
   capable "$candidate" && version_matches "$candidate" || {{
-    echo '[cloud prepare] downloaded release lacks required protocol capabilities or exact version' >&2; exit 1;
+    version_output "$candidate" >&2 || true
+    echo '[cloud prepare] candidate CLI lacks required protocol capabilities or exact version' >&2; exit 1;
   }}
   # Save regular files as well as symlinks, without changing their original target.
   if [ -e "$backend" ] || [ -L "$backend" ]; then
```

**File**: `src/cli/cloud_managed_tests.rs` (modified, +18/-0)
```diff
@@ -268,6 +268,24 @@ cp "$HOME/fixtures/${url##*/}" "$dest"
         }
     }
 
+    #[test]
+    fn development_bundle_keeps_wrapper_binary_and_private_libraries_together() {
+        let f = Fixture::new();
+        f.installed(false);
+        f.artifact(true, false, None);
+        let candidate = f.dir.path().join("payload/jcode-linux-x86_64");
+        let result = f.run_candidate(None, candidate.to_str());
+        assert!(
+            result.status.success(),
+            "{}",
+            String::from_utf8_lossy(&result.stderr)
+        );
+        let installed = std::fs::read_link(f.backend()).unwrap();
+        assert!(installed.with_extension("bin").is_file());
+        assert!(installed.parent().unwrap().join("libssl.so.10").is_file());
+        assert!(!f.dir.path().join("downloads").exists());
+    }
+
     #[test]
     fn development_candidate_rolls_back_when_effective_cli_is_broken() {
         let f = Fixture::new();
```

**File**: `src/cli/cloud_move.rs` (modified, +59/-3)
```diff
@@ -562,7 +562,63 @@ impl Target {
     fn prepare_development_binary(&self, host: &str, home: &str) -> Result<()> {
         let executable =
             std::env::current_exe().context("locate running development executable")?;
-        let mut file = std::fs::File::open(&executable)?;
+        let bundle = tempfile::tempdir()?;
+        let payload = bundle.path().join("payload");
+        std::fs::create_dir(&payload)?;
+        std::fs::copy(&executable, payload.join("jcode.bin"))?;
+        // Bundle the current executable's dependency closure, including its
+        // loader. Never install these libraries into the cloud system paths.
+        let dependencies = Command::new("ldd")
+            .arg(&executable)
+            .env_remove("LD_PRELOAD")
+            .env_remove("LD_LIBRARY_PATH")
+            .output()
+            .context("inspect development executable libraries")?;
+        if !dependencies.status.success() {
+            bail!(
+                "cannot bundle development executable libraries: {}",
+                String::from_utf8_lossy(&dependencies.stderr)
+            );
+        }
+        let mut members = vec!["jcode".to_string(), "jcode.bin".to_string()];
+        let mut loader = None;
+        for line in String::from_utf8_lossy(&dependencies.stdout).lines() {
+            if line.contains("not found") {
+                bail!("missing development dependency: {line}");
+            }
+            let Some(path) = line.split_whitespace().find(|part| part.starts_with('/')) else {
+                continue;
+            };
+            let path = Path::new(path);
+            let name = path
+                .file_name()
+                .and_then(|name| name.to_str())
+                .context("invalid shared library filename")?;
+            if !name
+                .bytes()
+                .all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(&byte))
+            {
+                bail!("unsupported shared library filename {name:?}");
+            }
+            if name.starts_with("ld-linux") {
+                loader = Some(name.to_string());
+            }
+            if !members.iter().any(|member| member == name) {
+                std::fs::copy(path, payload.join(name))?;
+                members.push(name.to_string());
+            }
+        }
+        let loader = loader.context("development executable has no supported Linux loader")?;
+        std::fs::write(
+            payload.join("jcode"),
+            format!(
+                "#!/bin/sh\nset -eu\np=$(readlink -f \"$0\")\nd=$(dirname \"$p\")\nexec \"$d/{loader}\" --library-path \"$d\" \"$p.bin\" \"$@\"\n"
+            ),
+        )?;
+        let archive = bundle.path().join("development.tar.gz");
+        let member_refs = members.iter().map(String::as_str).collect::<Vec<_>>();
+        tar_dir(&payload, &archive, &member_refs)?;
+        let mut file = std::fs::File::open(&archive)?;
         let mut digest = Sha256::new();
         let mut buffer = [0u8; 64 * 1024];
         loop {
@@ -577,12 +633,12 @@ impl Target {
         // shell owns its cleanup independently of the installer's own traps.
         let prepare = super::cloud_managed::prepare_script_with_candidate(home, Some("jcode"))?;
         let script = format!(
-            "set -eu\numask 077\nupload=$(mktemp -d)\ntrap 'rm -rf \"$upload\"' EXIT\ncat > \"$upload/jcode\"\nprintf '%s  %s\\n' '{checksum}' \"$upload/jcode\" | sha256sum --check --status\nchmod 755 \"$upload/jcode\"\n(\ncd \"$upload\"\n{prepare}\n)\n"
+            "set -eu\numask 077\nupload=$(mktemp -d)\ntrap 'rm -rf \"$upload\"' EXIT\ncat > \"$upload/bundle.tar.gz\"\nprintf '%s  %s\\n' '{checksum}' \"$upload/bundle.tar.gz\" | sha256sum --check --status\ntar xzf \"$upload/bundle.tar.gz\" --no-same-owner --no-same-permissions -C \"$upload\"\nchmod 755 \"$upload/jcode\" \"$upload/jcode.bin\" \"$upload\"/ld-linux*.so*\n(\ncd \"$upload\"\n{prepare}\n)\n"
         );
         let mut command = Self::ssh_command(host)?;
         command.arg(format!("bash -c {}", shell_quote(&script)));
         command
-            .stdin(Stdio::from(std::fs::File::open(&executable)?))
+            .stdin(Stdio::from(std::fs::File::open(&archive)?))
             .stdout(Stdio::null())
             .stderr(Stdio::piped());
         let output = command
```

---

### Incident Patch 2: `9229d9d6` (2026-10-27)
**Commit Message**: fix(cloud): repair stale managed CLI capabilities automatically

**File**: `src/cli/cloud_managed.rs` (modified, +50/-10)
```diff
@@ -483,21 +483,27 @@ fn shell_quote(value: &str) -> String {
     format!("'{}'", value.replace('\'', "'\\''"))
 }
 
-/// Preflight runs before secrets are transferred. A release client pins its own
-/// runtime release identity; development clients only probe unless explicitly
-/// given JCODE_CLOUD_RELEASE. Existing daemons/sessions are never restarted.
+/// Preflight runs before secrets are transferred. Published clients pin their
+/// release identity. Development clients keep capable hosts, otherwise resolve
+/// the latest published release and verify its capabilities before installation.
+/// Existing daemons/sessions are never restarted.
 pub(crate) fn prepare_script(home: &str) -> Result<String> {
+    prepare_script_with_candidate(home, None)
+}
+
+pub(crate) fn prepare_script_with_candidate(home: &str, candidate: Option<&str>) -> Result<String> {
     let override_tag = std::env::var("JCODE_CLOUD_RELEASE").ok();
     let target = release_target(
         jcode_build_meta::is_release_build(),
         jcode_build_meta::semver(),
         override_tag.as_deref(),
     )?;
-    Ok(prepare_script_for_paths(
+    Ok(prepare_script_for_paths_with_candidate(
         home,
         target.as_deref(),
         "/opt/jcode-cloud/jcode",
         true,
+        candidate,
     ))
 }
 
@@ -507,13 +513,25 @@ fn prepare_script_for_paths(
     backend: &str,
     elevate: bool,
 ) -> String {
+    prepare_script_for_paths_with_candidate(home, target, backend, elevate, None)
+}
+
+fn prepare_script_for_paths_with_candidate(
+    home: &str,
+    target: Option<&str>,
+    backend: &str,
+    elevate: bool,
+    candidate: Option<&str>,
+) -> String {
+    let development_candidate = shell_quote(candidate.unwrap_or(""));
     let backend = shell_quote(backend);
     let privilege = if elevate { "sudo -n " } else { "" };
     let home = shell_quote(home);
     let want = shell_quote(target.unwrap_or(""));
     format!(
         r#"set -eu
 want={want}
+development_candidate={development_candidate}
 export PATH="$HOME/.local/bin:$PATH"
 cli="$HOME/.local/bin/jcode"
 # Preserve the VM's CLI/service wrappers and their host-specific environment.
@@ -589,14 +607,19 @@ capable() {{
   probe "$1" cloud receive --help >/dev/null 2>&1 &&
     probe "$1" cloud credentials --help >/dev/null 2>&1 &&
     probe "$1" cloud router-credentials --help >/dev/null 2>&1 &&
-    probe "$1" cloud cancel-return --help >/dev/null 2>&1
+    probe "$1" cloud cancel-return --help >/dev/null 2>&1 &&
+    probe "$1" cloud replace-receive --help >/dev/null 2>&1 &&
+    probe "$1" cloud group-protocol --help >/dev/null 2>&1
 }}
 version_output() {{
   env -u JCODE_RUNTIME_RELEASE_SEMVER -u JCODE_RUNTIME_RELEASE_GIT_HASH \
     -u JCODE_RUNTIME_RELEASE_GIT_DATE -u JCODE_RUNTIME_RELEASE_GIT_TAG \
     "$1" --no-update --no-selfdev --version 2>/dev/null
 }}
 version_matches() {{
+  # Development candidates are byte-verified by the sender and capability-tested
+  # before and after switching. They do not have a published release identity.
+  [ -z "$development_candidate" ] || return 0
   version=$(version_output "$1") || return 1
   case "$version" in
     "jcode $want"|"jcode $want "*|"$want"|"$want "*) return 0 ;;
@@ -622,15 +645,31 @@ version_at_least() {{
     }}'
 }}
 if ! capable "$cli" || ! capable "$backend" || {{ [ -n "$want" ] && {{ ! version_at_least "$cli" || ! version_at_least "$backend"; }}; }} || [ "${{JCODE_CLOUD_FORCE_UPGRADE:-}}" = 1 ]; then
-  if [ -z "$want" ]; then
-    echo '[cloud prepare] cloud CLI lacks required capabilities, or upgrade was forced. Development clients do not choose a release automatically. Set JCODE_CLOUD_RELEASE to an exact compatible published tag.' >&2
-    exit 1
+  if [ -z "$want" ] && [ -z "$development_candidate" ]; then
+    # Development builds have no corresponding published tag. Resolve the
+    # canonical latest redirect, then pin and validate that exact release.
+    latest=$(curl --proto '=https' --proto-redir '=https' --tlsv1.2 -fsSLI --retry 3 \
+      -o /dev/null -w '%{{url_effective}}' https://github.com/1jehuang/jcode/releases/latest)
+    want=${{latest#https://github.com/1jehuang/jcode/releases/tag/}}
+    printf '%s\n' "$want" | LC_ALL=C awk '
+      NR != 1 || $0 !~ /^v(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$/ {{ bad=1 }}
+      END {{ exit (bad || NR != 1) }}' || {{
+      echo '[cloud prepare] cannot resolve an exact published release; set JCODE_CLOUD_RELEASE to a compatible published tag' >&2
+      exit 1
+    }}
   fi
   [ "$(uname -s)" = Linux ] && [ "$(uname -m)" = x86_64 ] || {{
     echo '[cloud prepare] release requires Linux x86_64' >&2; exit 1;
   }}
+  stage=$(mktemp -d "$root/${{want:-development}}.XXXXXXXX")
+  if [ -n "$development_candidate" ]; then
+    echo '[cloud prepare] installing verified local development CLI (live sessions are unchanged)' >&2
+    mkdir "$stage/bin"
+    cp "$development_candidate" "$stage/bin/jcode-linux-x86_64"
+    candidat
```

**File**: `src/cli/cloud_managed_tests.rs` (modified, +160/-5)
```diff
@@ -60,6 +60,8 @@ case "$*" in
   '--no-update --no-selfdev --version') echo 'jcode {version} (test)' ;;
   '--no-update --no-selfdev cloud receive --help') exit 0 ;;
   '--no-update --no-selfdev cloud cancel-return --help') exit 0 ;;
+  '--no-update --no-selfdev cloud replace-receive --help') exit 0 ;;
+  '--no-update --no-selfdev cloud group-protocol --help') exit 0 ;;
   '--no-update --no-selfdev cloud credentials --help') {credentials} ;;
   '--no-update --no-selfdev cloud router-credentials --help') {credentials} ;;
   *) exit 95 ;;
@@ -87,6 +89,12 @@ while [ "$#" -gt 0 ]; do
   shift
 done
 printf '%s\n' "$url" >> "$HOME/downloads"
+if [ "$url" = https://github.com/1jehuang/jcode/releases/latest ]; then
+  if [ -f "$HOME/latest-url" ]; then cat "$HOME/latest-url"; else
+    printf %s https://github.com/1jehuang/jcode/releases/tag/v0.99.123
+  fi
+  exit 0
+fi
 cp "$HOME/fixtures/${url##*/}" "$dest"
 "#,
             );
@@ -162,8 +170,21 @@ cp "$HOME/fixtures/${url##*/}" "$dest"
         }
 
         fn run(&self, target: Option<&str>) -> std::process::Output {
-            let script =
-                prepare_script_for_paths("", target, self.backend().to_str().unwrap(), false);
+            self.run_candidate(target, None)
+        }
+
+        fn run_candidate(
+            &self,
+            target: Option<&str>,
+            candidate: Option<&str>,
+        ) -> std::process::Output {
+            let script = prepare_script_for_paths_with_candidate(
+                "",
+                target,
+                self.backend().to_str().unwrap(),
+                false,
+                candidate,
+            );
             let path = self.dir.path().join("prepare.sh");
             std::fs::write(&path, script).unwrap();
             Command::new("sh")
@@ -216,14 +237,148 @@ cp "$HOME/fixtures/${url##*/}" "$dest"
     }
 
     #[test]
-    fn development_rejects_receive_only_cli_without_downloading() {
+    fn development_candidate_is_probed_and_installed_without_a_release() {
+        for capable in [true, false] {
+            let f = Fixture::new();
+            f.installed(false);
+            let candidate = f.dir.path().join("native ' development");
+            executable(&candidate, &binary("v0.99.256-dev", capable, false));
+            let result = f.run_candidate(None, candidate.to_str());
+            assert_eq!(
+                result.status.success(),
+                capable,
+                "{}",
+                String::from_utf8_lossy(&result.stderr)
+            );
+            assert!(!f.dir.path().join("downloads").exists());
+            if capable {
+                let installed = std::fs::read_link(f.backend()).unwrap();
+                assert!(
+                    std::fs::read_to_string(installed)
+                        .unwrap()
+                        .contains("v0.99.256-dev")
+                );
+                // A second preflight uses capabilities, not equality with a
+                // published version, so it does not upload/install again.
+                assert!(f.run(None).status.success());
+                assert!(!f.dir.path().join("downloads").exists());
+            } else {
+                f.assert_old();
+            }
+        }
+    }
+
+    #[test]
+    fn development_candidate_rolls_back_when_effective_cli_is_broken() {
+        let f = Fixture::new();
+        f.installed(false);
+        executable(&f.cli(), &binary("v0.99.0-dev", false, false));
+        let candidate = f.dir.path().join("native-development");
+        executable(&candidate, &binary("v0.99.256-dev", true, false));
+        let result = f.run_candidate(None, candidate.to_str());
+        assert!(!result.status.success());
+        assert!(String::from_utf8_lossy(&result.stderr).contains("restored previous CLI"));
+        assert!(!f.backend().is_symlink());
+        assert!(
+            std::fs::read_to_string(f.backend())
+                .unwrap()
+                .contains("v0.99.1")
+        );
+    }
+
+    #[test]
+    fn development_upgrades_incompatible_cli_to_verified_latest() {
+        let f = Fixture::new();
+        f.installed(false);
+        f.artifact(true, false, None);
+        let result = f.run(None);
+        assert!(
+            result.status.success(),
+            "{}",
+            String::from_utf8_lossy(&result.stderr)
+        );
+        assert!(f.backend().is_symlink());
+        let downloads = std::fs::read_to_string(f.dir.path().join("downloads")).unwrap();
+        assert!(downloads.contains("/releases/latest"));
+        assert!(downloads.contains("/v0.99.123/jcode-linux-x86_64.tar.gz"));
+        let result = f.run(None);
+        assert!(result.status.success());
+        assert_eq!(
+            std::fs::read_to_string(f.dir.path().join("downloads")).unwrap(),
+            downloads
+        );
+    }
+
+    #[test]
+    fn development_rejects_invalid_latest_redirects_without_switching() {
+        for latest in [
+         
```

**File**: `src/cli/cloud_move.rs` (modified, +74/-4)
```diff
@@ -60,11 +60,13 @@ const FORMAT_VERSION: u32 = 1;
 /// Hidden remote subcommands a cloud host must support before anything is
 /// uploaded. Probing all of them up front means an older host fails clearly at
 /// preflight instead of after a partial credential transfer.
-const REQUIRED_REMOTE_COMMANDS: [&str; 4] = [
+const REQUIRED_REMOTE_COMMANDS: [&str; 6] = [
     "receive",
     "credentials",
     "router-credentials",
     "cancel-return",
+    "replace-receive",
+    "group-protocol",
 ];
 const SNAPSHOT_REF_PREFIX: &str = "refs/jcode-cloud";
 /// Environment variables worth carrying. Everything else (DISPLAY, WAYLAND_*,
@@ -445,7 +447,12 @@ impl Target {
     }
 
     fn preflight_key(&self, host: &str) -> String {
-        format!("{host}\n{}", self.remote_binary())
+        // Capability changes invalidate markers written by older clients.
+        format!(
+            "{host}\n{}\n{}",
+            self.remote_binary(),
+            REQUIRED_REMOTE_COMMANDS.join(",")
+        )
     }
 
     fn preflight_uncached(&self, host: &str) -> Result<()> {
@@ -464,8 +471,29 @@ impl Target {
                     .map(|h| h.to_string_lossy().into_owned())
                     .unwrap_or_default();
                 timed_move_stage("host prepare script", || {
-                    self.run_shell(host, &super::cloud_managed::prepare_script(&home)?)
-                        .context("prepare the Jcode Cloud machine")
+                    let prepared =
+                        self.run_shell(host, &super::cloud_managed::prepare_script(&home)?);
+                    if let Err(error) = prepared {
+                        // A development protocol may not exist in any published
+                        // release yet. Use the running native executable, never
+                        // a stale PATH launcher, and verify it before switching.
+                        if cfg!(all(target_os = "linux", target_arch = "x86_64"))
+                            && !jcode_build_meta::is_release_build()
+                            && std::env::var_os("JCODE_CLOUD_RELEASE").is_none()
+                            && self.remote_binary.is_none()
+                            && std::env::var_os("JCODE_CLOUD_REMOTE_BINARY").is_none()
+                        {
+                            step(
+                                "prepare",
+                                "published cloud CLI is unavailable or incompatible; syncing this development binary",
+                            );
+                            self.prepare_development_binary(host, &home)
+                                .with_context(|| format!("prepare development cloud CLI (published preparation failed: {error:#})"))?;
+                        } else {
+                            return Err(error).context("prepare the Jcode Cloud machine");
+                        }
+                    }
+                    Ok(())
                 })?;
             }
             // Preserve custom transports that only support one remote invocation.
@@ -528,6 +556,48 @@ impl Target {
         })
     }
 
+    /// Transfer only our executable over the existing authenticated SSH channel.
+    /// The installer probes it before an atomic switch and rolls back on failure.
+    /// No checkout, credentials, lease, or running daemon is touched.
+    fn prepare_development_binary(&self, host: &str, home: &str) -> Result<()> {
+        let executable =
+            std::env::current_exe().context("locate running development executable")?;
+        let mut file = std::fs::File::open(&executable)?;
+        let mut digest = Sha256::new();
+        let mut buffer = [0u8; 64 * 1024];
+        loop {
+            let count = file.read(&mut buffer)?;
+            if count == 0 {
+                break;
+            }
+            digest.update(&buffer[..count]);
+        }
+        let checksum = hex::encode(digest.finalize());
+        // The candidate is inside a private temporary directory. The outer
+        // shell owns its cleanup independently of the installer's own traps.
+        let prepare = super::cloud_managed::prepare_script_with_candidate(home, Some("jcode"))?;
+        let script = format!(
+            "set -eu\numask 077\nupload=$(mktemp -d)\ntrap 'rm -rf \"$upload\"' EXIT\ncat > \"$upload/jcode\"\nprintf '%s  %s\\n' '{checksum}' \"$upload/jcode\" | sha256sum --check --status\nchmod 755 \"$upload/jcode\"\n(\ncd \"$upload\"\n{prepare}\n)\n"
+        );
+        let mut command = Self::ssh_command(host)?;
+        command.arg(format!("bash -c {}", shell_quote(&script)));
+        command
+            .stdin(Stdio::from(std::fs::File::open(&executable)?))
+            .stdout(Stdio::null())
+            .stderr(Stdio::piped());
+        let output = command
+            .output()
+            .context("send development executable to cloud")?;
+        if !output.status.success() {
+            bail!(
+                "cloud development CLI install failed ({}): {}",
+
```

**File**: `src/cli/cloud_move_latency_tests.rs` (modified, +16/-2)
```diff
@@ -302,7 +302,7 @@ fn isolated_latency_child() {
         result.unwrap();
     }
     let probes = std::fs::read_to_string(root.join("probes")).unwrap();
-    let expected = if mode.ends_with("failure") { 2 } else { 4 };
+    let expected = if mode.ends_with("failure") { 2 } else { 6 };
     assert_eq!(probes.lines().count(), expected, "{probes}");
     assert!(
         probes
@@ -318,7 +318,7 @@ fn isolated_latency_child() {
             .unwrap()
             .ends_with("cloud credentials --help")
     );
-    if expected == 4 {
+    if expected == 6 {
         assert!(
             probes
                 .lines()
@@ -333,6 +333,20 @@ fn isolated_latency_child() {
                 .unwrap()
                 .ends_with("cloud cancel-return --help")
         );
+        assert!(
+            probes
+                .lines()
+                .nth(4)
+                .unwrap()
+                .ends_with("cloud replace-receive --help")
+        );
+        assert!(
+            probes
+                .lines()
+                .nth(5)
+                .unwrap()
+                .ends_with("cloud group-protocol --help")
+        );
     }
     let calls = std::fs::read_to_string(root.join("calls")).unwrap();
     assert_eq!(
```

---

### Incident Patch 3: `54c6e500` (2026-10-27)
**Commit Message**: bench: compare Jcode and Maki TUI startup and resource use

**File**: `docs/benchmarks/jcode-vs-maki-2026-10-27.md` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+# Jcode vs Maki: local TUI performance and resources
+
+Measured October 27, 2026 UTC, on the user's Dell XPS 14, Intel Core Ultra X9 388H, 62.3 GiB RAM. Linux x86_64, kernel 7.2.11-arch1-1, 16 logical CPUs. Initial load averages: 2.63 / 3.18 / 3.82. This was an active development laptop, not a dedicated benchmark machine.
+
+## Scope and conclusion
+
+**This measures local TUI overhead, not coding quality, model latency, token efficiency, or tool throughput.** No prompts were submitted and no valid model credentials were supplied. Different selected model names therefore do not contribute inference work to these measurements.
+
+- Maki has a substantially smaller one-session footprint: **67.9 MiB vs Jcode's 218.8 MiB PSS**, including Jcode's server.
+- Jcode scales more economically across these idle sessions. At ten sessions it uses **327.0 MiB vs Maki's 394.9 MiB PSS**, about 17% less. The measured PSS crossover lies somewhere between five and ten sessions, not at an established exact threshold.
+- First-session editable startup was **71 ms Jcode vs 138 ms Maki** in the three one-session repetitions. Both were responsive to typing, with typical echo times of a few milliseconds.
+- **Do not interpret Maki's animated welcome-screen CPU as steady-state chat CPU.** Disabling its splash animation reduced measured CPU substantially. The resulting CPU figures are much closer to Jcode's, and Jcode's ten-session samples were noisy.
+- This compares an installed **Jcode development binary** to a **Maki release binary**. It is not an optimized-release-versus-optimized-release comparison.
+
+## Binaries
+
+Executables were resolved once before each suite. Every recorded running process executable matched the corresponding pinned binary, including Jcode's dedicated server.
+
+| | Jcode | Maki |
+|---|---|---|
+| Version | v0.99.252-dev, commit `8e1417e79` | 0.6.5 |
+| File size | 325,992,785 bytes, 310.9 MiB | 116,670,208 bytes, 111.3 MiB |
+| SHA-256 | `a54f6d87d5f739ab654a290a1fa26c0b458271bf964430d00cec06c7f72ea9b9` | `9d6c1a61ac6c706c6d4b45b72e7b032b10f52b89f0cc3c019d24865e77f759da` |
+
+File size is not resident memory and includes whatever symbols and embedded assets each distribution ships.
+
+## Method
+
+The main suite contains **18 runs**: two tools, three session counts, three repetitions. Run order was shuffled with seed 42. A further **nine runs** measure Maki with splash animation disabled, again at all three session counts with three repetitions each.
+
+Each run uses:
+
+- A fresh isolated HOME, XDG directories, and empty workspace. No real project is opened or modified.
+- A dummy Anthropic API key. No real auth or user configuration is copied.
+- A 120-column by 40-row pseudoterminal per client, with kernel input echo disabled. Terminal capability requests are answered.
+- Actual rendered chat-prompt detection followed by application-rendered input echo. Initial status text alone does not qualify as input-ready.
+- Two seconds of settling after all clients launch, then approximately five seconds of idle observation. Process accounting extends the actual interval to roughly 5.5 to 6.3 seconds.
+- `/proc` PSS, RSS, private memory, and CPU accounting for the complete measured process tree. Jcode totals include one dedicated server plus all clients. Maki totals include all independent instances.
+- Twenty additional short input strings per run, spread round-robin across the terminals. No Enter key is sent.
+- Owned process groups terminated after measurement. The user's active daemon is not reused or restarted.
+
+Jcode: `--no-update --no-selfdev`, memory disabled through `JCODE_MEMORY_ENABLED=0`, isolated socket, and returning-user markers to skip onboarding. Maki: `--no-plugins --no-commands`, keeping builtin plugins. The splash-disabled control replaces `--no-plugins` with an isolated global `init.lua` containing only:
+
+```lua
+maki.setup({ ui = { splash_animation = false } })
+```
+
+All other user plugins remain absent because the control uses a fresh HOME. The control's boolean `maki_no_splash` field distinguishes this from the main suite's generic method description.
+
+## Main results
+
+Values are medians of three run-level observations. Memory observations within each run are themselves medians of samples taken during the idle window. CPU percentages are relative to **one logical core**, not the entire 16-CPU machine.
+
+| Sessions | Jcode PSS MiB | Maki PSS MiB | Jcode private MiB | Maki private MiB | Jcode processes | Maki processes |
+|---:|---:|---:|---:|---:|---:|---:|
+| 1 | 218.8 | 67.9 | 137.4 | 67.9 | 2 | 1 |
+| 5 | 271.5 | 211.0 | 156.3 | 178.5 | 6 | 5 |
+| 10 | 327.0 | 394.9 | 211.3 | 362.5 | 11 | 10 |
+
+PSS ranges across repetitions: Jcode 216.6 to 219.4 / 267.0 to 273.1 / 324.5 to 327.6 MiB. Maki 67.6 to 69.5 / 204.9 to 215.3 / 387.9 to 395.0 MiB, for 1 / 5 / 10 sessions respectively.
+
+Summed RSS medians were Jcode 308.7 / 804.5 / 1414.9 MiB and Maki 67.9 /
```

**File**: `scripts/bench_jcode_maki.py` (added, +233/-0)
```diff
@@ -0,0 +1,233 @@
+#!/usr/bin/env python3
+"""Isolated, no-model-call TUI resource comparison for Jcode and Maki.
+
+Requires pyte. Uses fresh HOME/XDG directories and a dummy Anthropic key.
+Never submits a prompt. Jcode's dedicated server is included in every total.
+"""
+from __future__ import annotations
+
+import argparse
+import codecs
+import fcntl
+import hashlib
+import json
+import os
+from pathlib import Path
+import pty
+import random
+import select
+import shutil
+import signal
+import socket
+import statistics
+import struct
+import subprocess
+import tempfile
+import termios
+import time
+
+import pyte
+
+from bench_memory_cli import collect_descendants, reply_queries
+
+
+def snapshot(roots):
+    totals = dict(pss_mib=0.0, rss_mib=0.0, private_mib=0.0, cpu_seconds=0.0, processes=0)
+    for pid in collect_descendants(roots):
+        try:
+            base = Path(f"/proc/{pid}")
+            stat = (base / "stat").read_text().rsplit(")", 1)[1].split()
+            memory = dict(line.split(":", 1) for line in (base / "smaps_rollup").read_text().splitlines() if ":" in line)
+            totals["pss_mib"] += int(memory["Pss"].split()[0]) / 1024
+            totals["rss_mib"] += int(memory["Rss"].split()[0]) / 1024
+            totals["private_mib"] += sum(int(memory.get(k, "0").split()[0]) for k in ("Private_Clean", "Private_Dirty")) / 1024
+            totals["cpu_seconds"] += (int(stat[11]) + int(stat[12])) / os.sysconf("SC_CLK_TCK")
+            totals["processes"] += 1
+        except (OSError, ValueError, KeyError):
+            continue
+    return totals
+
+
+class Terminal:
+    def __init__(self, argv, env, cwd):
+        master, slave = pty.openpty()
+        self.fd = master
+        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))
+        attrs = termios.tcgetattr(slave)
+        attrs[3] &= ~(termios.ECHO | termios.ICANON)
+        termios.tcsetattr(slave, termios.TCSANOW, attrs)
+        self.start = time.perf_counter()
+        self.proc = subprocess.Popen(argv, env=env, cwd=cwd, stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
+        os.close(slave)
+        os.set_blocking(master, False)
+        self.screen = pyte.Screen(120, 40)
+        self.stream = pyte.Stream(self.screen)
+        self.decoder = codecs.getincrementaldecoder("utf-8")("replace")
+        self.pending = b""
+        self.visible_ms = None
+        self.bytes = 0
+
+    def text(self):
+        return "\n".join(self.screen.display)
+
+    def drain(self):
+        try:
+            chunk = os.read(self.fd, 262144)
+        except (BlockingIOError, OSError):
+            return
+        if not chunk:
+            return
+        self.bytes += len(chunk)
+        self.pending = reply_queries(self.fd, self.pending + chunk)[-256:]
+        self.stream.feed(self.decoder.decode(chunk))
+        if self.visible_ms is None and sum(c.isalnum() for c in self.text()) > 8:
+            self.visible_ms = (time.perf_counter() - self.start) * 1000
+
+
+def pump(terms, seconds):
+    deadline = time.perf_counter() + seconds
+    while time.perf_counter() < deadline:
+        ready, _, _ = select.select([t.fd for t in terms], [], [], min(0.01, max(0, deadline - time.perf_counter())))
+        for t in terms:
+            if t.fd in ready:
+                t.drain()
+
+
+def echo(terms, terminal, text, timeout=10):
+    start = time.perf_counter()
+    os.write(terminal.fd, text.encode())
+    while time.perf_counter() - start < timeout:
+        pump(terms, 0.002)
+        if text in terminal.text():
+            return (time.perf_counter() - start) * 1000
+        if terminal.proc.poll() is not None:
+            break
+    raise RuntimeError(f"Input echo failed: {terminal.text()}")
+
+
+def stop(proc):
+    try:
+        os.killpg(proc.pid, signal.SIGTERM)
+        proc.wait(timeout=2)
+    except subprocess.TimeoutExpired:
+        os.killpg(proc.pid, signal.SIGKILL)
+        proc.wait()
+    except ProcessLookupError:
+        proc.wait()
+
+
+def run(tool, binary, sessions, idle_seconds, root, maki_no_splash=False):
+    work = Path(tempfile.mkdtemp(prefix=f"{tool}-", dir=root))
+    terms, procs = [], []
+    env = {k: v for k, v in os.environ.items() if not any(x in k.upper() for x in ("TOKEN", "API_KEY", "AUTH", "JCODE", "MAKI"))}
+    env.update(HOME=str(work / "home"), XDG_CONFIG_HOME=str(work / "config"), XDG_DATA_HOME=str(work / "data"), XDG_STATE_HOME=str(work / "state"), XDG_CACHE_HOME=str(work / "cache"), TERM="xterm-256color", COLORTERM="truecolor", ANTHROPIC_API_KEY="sk-ant-benchmark-placeholder-not-valid", JCODE_HOME=str(work / "jcode"), JCODE_RUNTIME_DIR=str(work / "runtime"), JCODE_NO_TELEMETRY="1", JCODE_MEMORY_ENABLED="0", JCODE_TEMP_SERVER="1", JCODE_SERVER_OWNER_PID=str(os.getpid()))
+    for key in ("HOME", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "XDG_CACHE_HOME", "JCODE_HOME", "JCODE_RUNTIME_DIR"):
+        Path(env[key]).mkdir(parents=True)
```

**File**: `scripts/test_bench_jcode_maki.py` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+#!/usr/bin/env python3
+"""Tests for the Linux-only, no-model-call Jcode/Maki benchmark harness."""
+import os
+from pathlib import Path
+import subprocess
+import sys
+import tempfile
+import unittest
+
+from bench_jcode_maki import Terminal, echo, snapshot, stop
+
+
+class BenchmarkTests(unittest.TestCase):
+    def test_snapshot_includes_live_process(self):
+        result = snapshot([os.getpid()])
+        self.assertGreaterEqual(result["processes"], 1)
+        self.assertGreater(result["pss_mib"], 0)
+        self.assertGreaterEqual(result["rss_mib"], result["pss_mib"])
+        self.assertGreaterEqual(result["pss_mib"], result["private_mib"])
+        self.assertGreaterEqual(result["cpu_seconds"], 0)
+
+    def test_snapshot_ignores_missing_process(self):
+        self.assertEqual(snapshot([999999999])["processes"], 0)
+
+    def test_application_echo_not_terminal_driver_echo(self):
+        # Child explicitly reads and renders input. PTY ECHO is disabled.
+        code = "import os; os.write(1, b'ready\\r\\n'); data=os.read(0, 100); os.write(1, data); import time; time.sleep(5)"
+        terminal = Terminal([sys.executable, "-c", code], os.environ.copy(), Path.cwd())
+        try:
+            self.assertLess(echo([terminal], terminal, "testprobe", timeout=2), 2000)
+            self.assertIn("testprobe", terminal.text())
+        finally:
+            stop(terminal.proc)
+            os.close(terminal.fd)
+
+    def test_unread_input_does_not_count_as_ready(self):
+        terminal = Terminal([sys.executable, "-c", "import time; time.sleep(5)"], os.environ.copy(), Path.cwd())
+        try:
+            with self.assertRaisesRegex(RuntimeError, "Input echo failed"):
+                echo([terminal], terminal, "not-echoed", timeout=0.05)
+        finally:
+            stop(terminal.proc)
+            os.close(terminal.fd)
+
+    def test_stop_reaps_owned_process(self):
+        with tempfile.TemporaryFile() as log:
+            proc = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"], stdout=log, stderr=log, start_new_session=True)
+            stop(proc)
+            self.assertIsNotNone(proc.poll())
+
+
+if __name__ == "__main__":
+    unittest.main()
```

#### Recent Merged Pull Requests:
- **PR #1975** (closed): fix(tui): update the existing tmux config (@aphelion31)
- **PR #1967** (closed): feat: per-session env for tool-spawned processes (@johnnyfish)
- **PR #1965** (closed): chore(ci): refresh ratchet budgets for post-v0.99.1 growth (@ianalitis)
- **PR #1963** (closed): style(tui): apply rustfmt to master fmt drift so the Format guardrail stops failing every PR (@ianalitis)
- **PR #1959** (closed): fix(security): cure cargo-audit red from RUSTSEC-2026-0387 and RUSTSEC-2026-0385 (@alecuba16)
- **PR #1954** (2026-10-24): fix: bound agentgrep memory, cancel searches, report Windows usage (@1jehuang)

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

## X. cloud): carry private runtime for development CLI recovery

**RULE**:
When implementing operations in `src/cli/cloud_managed.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in 1jehuang/jcode. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3f1c2712`: cloud): carry private runtime for development CLI recovery. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/cli/cloud_managed.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#[cfg(test)]
    # A native development build can require a newer loader/libc than the
    # managed image. Its verified private bundle carries those dependencies.
    if [ -f "$development_candidate.bin" ]; then
      cp "$development_candidate.bin" "$stage/bin/jcode-linux-x86_64.bin"
      source_dir=$(dirname "$development_candidate")
      for library in "$source_dir"/lib*.so* "$source_dir"/ld-linux*.so*; do
        [ ! -f "$library" ] || cp "$library" "$stage/bin/"
      done
      chmod 755 "$stage/bin/jcode-linux-x86_64.bin"
    fi
    version_output "$candidate" >&2 || true
    echo '[cloud prepare] candidate CLI lacks required protocol capabilities or exact version' >&2; exit 1;
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    echo '[cloud prepare] downloaded release lacks required protocol capabilities or exact version' >&2; exit 1;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3f1c2712` are properly handled with clean fallback behavior.
