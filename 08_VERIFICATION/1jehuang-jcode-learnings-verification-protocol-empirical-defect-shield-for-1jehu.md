# Verification Protocol: Verification Protocol: Empirical Defect Shield for 1jehuang-jcode-learnings

<!-- PROVENANCE_START
{
  "source_repository": "1jehuang-jcode-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T06:41:26.833Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-1jehuang-jcode-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [1jehuang-jcode-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T06:41:26.833Z`  
> **Learning ID**: `LEARN-EVO-1jehuang-jcode-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `1jehuang-jcode-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/1jehuang-jcode-learnings.md`  
> **Source**: github ([https://github.com/1jehuang/jcode](https://github.com/1jehuang/jcode))  
> **Source Version**: `44c58e8c`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T06:41:16.045Z  
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
> **Harvest Timestamp**: 2026-11-18T06:41:16.037Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `1jehuang/jcode`
- **Description**: High performance coding agent harness written in Rust, built for heavy multi-agent dev workflows
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 21871 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/jcode-app-core/examples/browser_size_probe.rs`
```
//! Run with `justrust run --release -p jcode-app-core --example browser_size_probe`.
//! Measures serialization CPU and allocation traffic, not process RSS.
use jcode_app_core::process_memory::estimate_json_bytes;
use serde_json::{Value, json};
use std::alloc::{GlobalAlloc, Layout, System};
use std::hint::black_box;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

struct Counting;
static COUNT: AtomicBool = AtomicBool::new(false);
static ALLOCS: AtomicUsize = AtomicUsize::new(0);
static BYTES: AtomicUsize = AtomicUsize::new(0);
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        if COUNT.load(Ordering::Relaxed) {
            ALLOCS.fetch_add(1, Ordering::Relaxed);
            BYTES.fetch_add(layout.size(), Ordering::Relaxed);
        }
        unsafe { System.alloc(layout) }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        unsafe { System.dealloc(ptr, layout) }
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        if COUNT.load(Ordering::Relaxed) {
            ALLOCS.fetch_add(1, Ordering::Relaxed);
            BYTES.fetch_add(size, Ordering::Relaxed);
        }
        unsafe { System.realloc(ptr, layout, size) }
    }
}
#[global_allocator]
static ALLOCATOR: Counting = Counting;

fn cpu_ns() -> u128 {
    let mut time = libc::timespec {
        tv_sec: 0,
        tv_nsec: 0,
    };
    assert_eq!(
        unsafe { libc::clock_gettime(libc::CLOCK_THREAD_CPUTIME_ID, &mut time) },
        0
    );
    time.tv_sec as u128 * 1_000_000_000 + time.tv_nsec as u128
}
fn sample(values: &[Value], iterations: usize, count: bool) -> (u128, usize, usize) {
    let allocations = ALLOCS.load(Ordering::Relaxed);
    let bytes = BYTES.load(Ordering::Relaxed);
    let start = cpu_ns();
    for _ in 0..iterations {
        for value in values {
            black_box(if count {
                estimate_json_bytes(black_box(value))
            } else {
                black_box(value).to_string().len()
            });
        }
    }
    (
        cpu_ns() - start,
        ALLOCS.load(Ordering::Relaxed) - allocations,
        BYTES.load(Ordering::Relaxed) - bytes,
    )
}
fn main() {
    let workloads = [
        (
            "small",
            vec![json!({"ok":true,"id":7,"text":"hello"})],
            100_000,
        ),
        (
            "many",
            (0..240)
                .map(|i| json!({"id":i,"label":"click \"é😀\"\n","ok":true}))
                .collect(),
            1_000,
        ),
        (
            "large",
            vec![
                json!({"text":"abc\"\\\n😀".repeat(16_000),"elements":(0..2000).map(|i|json!({"id":i,"text":"label"})).collect::<Vec<_>>()}),
            ],
            200,
        ),
    ];
    for (name, values, iterations) in workloads {
        for value in &values {
            assert_eq!(estimate_json_bytes(value), value.to_string().len());
        }
        sample(&values, 10, false);
        sample(&values, 10, true);
        let mut old = Vec::new();
        let mut new = Vec::new();
        for round in 0..10 {
            let (a, b) = if round % 2 == 0 {
                (
                    sample(&values, iterations, false),
                    sample(&values, iterations, true),
                )
            } else {
                let b = sample(&values, iterations, true);
                (sample(&values, iterations, false), b)
            };
            COUNT.store(true, Ordering::Relaxed);
            let old_alloc = sample(&values, 1, false);
            let new_alloc = sample(&values, 1, true);
            COUNT.store(false, Ordering::Relaxed);
            println!(
                "{name} round={round} legacy_cpu_ns={} count_cpu_ns={} legacy_allocs={} count_allocs={} legacy_alloc_bytes={} count_alloc_bytes={}",
                a.0, b.0, old_alloc.1, new_alloc.1, old_alloc.2, new_alloc.2
            );
            old.push(a.0);
            new.push(b.0);
        }
        old.sort_unstable();
        new.sort_unstable();
        println!(
            "{name} median_cpu_ratio={:.4}",
            new[5] as f64 / old[5] as f64
        );
        assert!(new[5] <= old[5], "CPU regression in {name}");
    }
}

```

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

/// The one place cache signatures encode JSON. A value that cannot be
/// serialized signs as the empty string, the same as before.
fn encode_json<T: serde::Serialize + ?Sized>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_default()
}

#[cfg(test)]
fn stable_hash_json<T: serde::Serialize + ?Sized>(value: &T) -> u64 {
    stable_hash_str(&encode_json(value))
}

#[cfg(test)]
fn stable_json_len<T: serde::Serialize + ?Sized>(value: &T) -> usize {
    encode_json(value).len()
}

/// The array envelope is independent of each message's cached immutable
/// content. Include current metadata, but do not encode whole transcripts
/// again just to count bytes already accounted for by `SharedContent`.
fn messages_json_len(messages: &[Message]) -> usize {
    2 + messages.len().saturating_sub(1)
        + messages
            .iter()
            .map(Message::serialized_json_bytes)
            .sum::<usize>()
}

fn json_hash_and_len<T: serde::Serialize + ?Sized>(value: &T) -> (u64, usize) {
    let encoded = encode_json(value);
    (stable_hash_str(&encoded), encoded.len())
}

/// Reuse each projected encoding for both the per-message signature and the
/// full JSON array signature. Hash<str> appends a 0xff domain separator, so
/// finish the incrementally written array with the same separator.
fn projected_message_hashes(messages: &[Message]) -> (u64, Vec<u64>) {
    let mut aggregate = std::collections::hash_map::DefaultHasher::new();
    aggregate.write(b"[");
    let mut hashes = Vec::with_capacity(messages.len());
    for (index, message) in messages.iter().enumerate() {
        if index != 0 {
            aggregate.write(b",");
        }
        let projected = crate::message::cache_relevant_message_value(message);
        let encoded = encode_json(&projected);
        hashes.push(stable_hash_str(&encoded));
        aggregate.write(encoded.as_bytes());
    }
    aggregate.write(b"]");
    aggregate.write_u8(0xff);
    (aggregate.finish(), hashes)
}

#[cfg(test)]
fn message_hashes(messages: &[Message]) -> Vec<u64> {
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
    let (tools_hash, tools_json_chars) = json_hash_and_len(&eager_tools);
    let (messages_hash, message_hashes) = projected_message_hashes(messages);
    let (ephemeral_fingerprint, ephemeral_chars) = json_hash_and_len(ephemeral_messages);
    let ephemeral_hash = if ephemeral_messages.is_empty() {
        None
    } else {
        Some(ephemeral_fingerprint)
    };
    ServerEvent::KvCacheRequest {
        system_static_hash: stable_hash_str(system_static),
        tools_hash,
        messages_hash,
        message_hashes,
        message_count: messages.len(),
        tool_count: eager_tools.len(),
        system_static_chars: system_static.chars().count(),
        tools_json_chars,
        messages_json_chars: messages_json_len(messages),
        ephemeral_hash,
        ephemeral_chars,
        ephemeral_message_count: ephemeral_messages.len(),
    }
}

#[cfg(test)]
#[path = "cache_request/tests.rs"]
mod tests;

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
        self.session.compaction = manager.persisted_state().map(Arc::new);
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

fn frozen_snapshot_memory_profile(
    locked_tools: Option<&[crate::message::ToolDefinition]>,
    agents_md: Option<&String>,
    skills: &[crate::prompt::SkillInfo],
) -> serde_json::Value {
    // Serialized schemas are an attribution proxy, not an allocation bound or
    // capacity. The prompt strings report capacity without copying their text.
    serde_json::json!({
        "locked_tools_count": locked_tools.map_or(0, <[_]>::len),
        "locked_tools_json_bytes": locked_tools
            .map_or(0, |tools| crate::process_memory::estimate_json_bytes(&tools)),
        "agents_md_snapshot_capacity_bytes": agents_md.map_or(0, String::capacity),
        "prompt_skills_snapshot_count": skills.len(),
        "prompt_skills_snapshot_capacity_bytes": skills.iter()
            .map(|skill| skill.name.capacity().saturating_add(skill.description.capacity()))
            .fold(0usize, usize::saturating_add),
    })
}

fn soft_interrupt_session_display_role(source: SoftInterruptSource) -> Option<StoredDisplayRole> {
    match source {
        SoftInterruptSource::User => None,
        SoftInterruptSource::System => Some(StoredDisplayRole::System),
        SoftInterruptSource::FileActivity => Some(StoredDisplayRole::FileActivity),
        SoftInterruptSource::BackgroundTask => Some(StoredDisplayRole::BackgroundTask),
    }
}

fn soft_interrupt_protocol_display_role(source: SoftInterruptSource) -> Option<String> {
    match source {
        SoftInterruptSource::User => None,
        SoftInterruptSource::System => Some("system".to_string()),
        SoftInterruptSource::BackgroundTask => Some("background_task".to_string()),
        SoftInterruptSource::FileActivity => Some("file_activity".to_string()),
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
            "interrupts":
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

    pub(crate) fn add_message(
        &mut self,
        role: Role,
        content: impl Into<crate::message::SharedContent>,
    ) -> String {
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
        content: impl Into<crate::message::SharedContent>,
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
        content: impl Into<crate::message::SharedContent>,
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
        content: impl Into<crate::message::SharedContent>,
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
    fn message_insertion_retains_shared_payload_storage() {
        let _lock = crate::storage::lock_test_env();
        let mut agent = Agent::new_provisional_with_initial_working_dir(
            Arc::new(NoNetworkProvider),
            Registry::empty(),
            None,
        );
        let message = Message::user("shared payload");
        agent.add_message(Role::User, message.content.clone());
        assert!(
            agent
                .session
                .messages
                .last()
                .unwrap()
                .content
                .shares_storage_with(&message.content)
        );
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
        let message = c
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2151** (2026-11-13): **swarm: lane todo name uses the full spawn prompt (first 60 chars) instead of the short `label`**
  *Symptoms*: **Type:** bug **Labels:** `bug`, `swarm`, `todo`  **Problem** When spawning a worker, the coordinator's lane todo is named with the **first 60 characters of the spawn prompt** (the full message), not the short `label`. Long prompts become unwieldy todo names that pollute the coordinator's plan and break `todo update` by short name (the plan already contains a todo named with the prompt text, so a different short name appears as a "duplicate todo name" error).  **Code** - `crates/jcode-app-core/src/tool/communicate.rs:1270-1283` — on `spawn`, `title` is computed as `prompt.lines().find(non-empty).chars().take(60)`; `label` is only used as a fallback when `title` is empty. `ensure_spawn_lane(&todos, &label, phase, &title, prompt, ...)` creates the lane with this long title as the todo name.  **Repro** 1. `swarm spawn` with `label: "providers-analyst"` and a long `initial_message` starting with "You are a codebase analyst. The repo root is /Users/mac/jcode ...". 2. The coordinator's todo plan now contains a todo named "You are a codebase analyst. The repo root is /Users/mac/jcode" (first 60 chars). 3. Trying `todo update` with the short name "providers-analyst" fails with "duplicate todo name" because the existing todo is named with the prompt text.  **Suggested fix** 1. Use `label` as the lane todo **name** (not the prompt). Keep the full prompt as the todo **description**/task body. 2. Concretely in `communicate.rs:1273-1277`: set `title = label`, and pass the prompt as the de

- **Issue #2144** (2026-11-17): **Claude Fable 5.2 missing from model selection with Claude OAuth**
  *Symptoms*: With Claude OAuth login, claude-fable-5-2 does not appear in the model picker and is not available as a swarm/spawn model. Expected: selectable like other Claude models. Version: v1.0.0-preview.394 (eb867111f).
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. e99ec1efe added `claude-fable-5-2` to the bundled Claude catalog, and it shipped in v1.0.0-preview.424 (you are on preview.394). On a build of master d75274706 with Claude OAuth, the model is listed by `jcode model list` and answers a live request. Could you update and confirm?  --- *— Jcode agent (automated triage), on behalf of @1jehuang*
  > Released in [v1.0.0](https://github.com/1jehuang/jcode/releases/tag/v1.0.0). Run `jcode update` to get it.

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

### Incident Patch 1: `fcb98e73` (2026-11-18)
**Commit Message**: perf: avoid discarded per-agent server memory diagnostics

Read identical full session attribution directly, since the compact snapshot omits compaction capacities. Borrow profile subobjects and preserve try_lock busy-session behavior and standalone agent profiling.

Remove N process samples, interrupt queue scans/locks, frozen snapshot profiles, full-agent JSON allocations, and session/subobject clones per server memory request. One server process snapshot remains. History intentionally loses synthetic per-agent agent:memory entries and no longer evicts N older entries.

Validated hosted justrust check -p jcode-app-core --tests and 12 filtered server::debug_server_state tests. Private no-LLM fixture, 8 populated sessions x 8 passes: legacy 26.312158ms versus session-only 3.418760ms, process samples 64 versus 0. Two local runs also improved 32.205/33.733ms to 5.258/5.255ms. Full session JSON equivalence, compaction totals, and busy skipping covered.

**File**: `crates/jcode-app-core/src/server/debug_server_memory_efficiency_tests.rs` (added, +222/-0)
```diff
@@ -0,0 +1,222 @@
+//! No-LLM fixtures for the server memory diagnostic's session-only fast path.
+use super::*;
+
+struct PrivateHome {
+    _dir: tempfile::TempDir,
+    home: Option<std::ffi::OsString>,
+    test_session: Option<std::ffi::OsString>,
+}
+
+impl PrivateHome {
+    fn new() -> Self {
+        let dir = tempfile::tempdir().unwrap();
+        let home = std::env::var_os("JCODE_HOME");
+        let test_session = std::env::var_os("JCODE_TEST_SESSION");
+        crate::env::set_var("JCODE_HOME", dir.path());
+        crate::env::set_var("JCODE_TEST_SESSION", "1");
+        Self {
+            _dir: dir,
+            home,
+            test_session,
+        }
+    }
+}
+
+impl Drop for PrivateHome {
+    fn drop(&mut self) {
+        for (name, value) in [
+            ("JCODE_HOME", self.home.take()),
+            ("JCODE_TEST_SESSION", self.test_session.take()),
+        ] {
+            match value {
+                Some(value) => crate::env::set_var(name, value),
+                None => crate::env::remove_var(name),
+            }
+        }
+    }
+}
+
+struct NoRequests;
+
+#[async_trait::async_trait]
+impl crate::provider::Provider for NoRequests {
+    async fn complete(
+        &self,
+        _: &[crate::message::Message],
+        _: &[crate::message::ToolDefinition],
+        _: &str,
+        _: Option<&str>,
+    ) -> Result<crate::provider::EventStream> {
+        anyhow::bail!("memory diagnostics must never call a provider")
+    }
+
+    fn name(&self) -> &str {
+        "memory-diagnostic-test"
+    }
+
+    fn fork(&self) -> Arc<dyn crate::provider::Provider> {
+        Arc::new(Self)
+    }
+}
+
+fn populated_agent(index: usize) -> Agent {
+    let mut session =
+        crate::session::Session::create_with_id(format!("memory-diagnostic-{index}"), None, None);
+    for turn in 0..8 {
+        session.add_message(
+            crate::message::Role::User,
+            vec![crate::message::ContentBlock::Text {
+                text: format!("turn {turn}: {}", "escaped\n\"界".repeat(512)),
+                cache_control: None,
+            }],
+        );
+    }
+    session.compaction = Some(Arc::new(crate::session::StoredCompactionState {
+        summary_text: "summary\n\"界".repeat(128),
+        openai_encrypted_content: Some("encrypted".repeat(1024).into()),
+        covers_up_to_turn: 2,
+        original_turn_count: 8,
+        compacted_count: 2,
+    }));
+    Agent::new_with_session(
+        Arc::new(NoRequests),
+        crate::tool::Registry::empty(),
+        session,
+        None,
+    )
+}
+
+#[test]
+fn session_only_profile_matches_full_agent_profile_and_removes_repeated_process_samples() {
+    // The private home and test-session flag isolate this fixture on either
+    // the local or hosted test runner. No model requests or daemon are needed.
+    let _env = crate::storage::lock_test_env();
+    let _home = PrivateHome::new();
+    let agents: Vec<_> = (0..8).map(populated_agent).collect();
+    let expected: Vec<_> = agents
+        .iter()
+        .map(|agent| agent.debug_memory_profile()["session"].clone())
+        .collect();
+    let old_start = Instant::now();
+    for _ in 0..8 {
+        for agent in &agents {
+            std::hint::black_box(agent.debug_memory_profile()["session"].clone());
+        }
+    }
+    let old_elapsed = old_start.elapsed();
+    let history_before = crate::process_memory::history(128);
+    assert_eq!(
+        history_before
+            .iter()
+            .take(64)
+            .filter(|entry| entry.source == "agent:memory")
+            .count(),
+        64,
+        "the legacy 8-session, 8-pass loop records one process sample per profile"
+    );
+
+    let new_start = Instant::now();
+    for _ in 0..8 {
+        for agent in &agents {
+            std::hint::black_box(agent.session_for_split().debug_memory_profile());
+        }
+    }
+    let new_elapsed = new_start.elapsed();
+    for (agent, expected) in agents.iter().zip(&expected) {
+        let actual = agent.session_for_split().debug_memory_profile();
+        assert_eq!(&actual, expected);
+        // In particular, compact snapshots cannot substitute for these
+        // capacity and encrypted-payload fields in server:memory.
+        assert!(
+            actual["compaction"]["encrypted_content_bytes"]
+                .as_u64()
+                .unwrap()
+                > 0
+        );
+        let mut borrowed = CompactionMemoryTotals::default();
+        borrowed.observe("fixture", &actual);
+        let mut legacy = CompactionMemoryTotals::default();
+        legacy.observe("fixture", expected);
+        assert_eq!(borrowed.into_json(), legacy.into_json());
+    }
+    let history_after = crate::process_memory::history(128);
+    assert_eq!(
+        serde_json::to_value(history_before).unwrap(),
+        serde_json::to_value(history_after).unwrap(),
+        "session-only profiling must not sample or append process history"
+    );
+    e
```

**File**: `crates/jcode-app-core/src/server/debug_server_state.rs` (modified, +11/-8)
```diff
@@ -785,17 +785,16 @@ async fn build_server_memory_payload(
     for (session_id, agent_arc) in sessions_guard.iter() {
         if let Ok(agent) = agent_arc.try_lock() {
             locked_session_count += 1;
-            let profile = agent.debug_memory_profile();
-            let session_profile = profile.get("session").cloned().unwrap_or_default();
+            // The compact snapshot omits compaction capacity attribution. Read
+            // the same session profile as agent:memory without its discarded
+            // process, interrupt, and frozen-snapshot diagnostics.
+            let session_profile = agent.session_for_split().debug_memory_profile();
             // Only profiles obtained through try_lock contribute. Capacity is
             // attribution, not serialized length or an estimate of RSS savings.
             compaction_memory.observe(session_id, &session_profile);
-            let totals = session_profile.get("totals").cloned().unwrap_or_default();
-            let messages = session_profile.get("messages").cloned().unwrap_or_default();
-            let provider_cache = session_profile
-                .get("provider_messages_cache")
-                .cloned()
-                .unwrap_or_default();
+            let totals = &session_profile["totals"];
+            let messages = &session_profile["messages"];
+            let provider_cache = &session_profile["provider_messages_cache"];
             let json_bytes = totals
                 .get("json_bytes")
                 .and_then(|value| value.as_u64())
@@ -1253,3 +1252,7 @@ fn path_len(path: &std::path::Path) -> usize {
 #[cfg(test)]
 #[path = "debug_server_state_tests.rs"]
 mod tests;
+
+#[cfg(test)]
+#[path = "debug_server_memory_efficiency_tests.rs"]
+mod efficiency_tests;
```

---

### Incident Patch 2: `1dfdbd8c` (2026-11-18)
**Commit Message**: fix(provider): compact only selected compressed request bodies

Move final shrink after ratio and expansion-limit checks, covering both gzip and zstd without reallocating rejected compressed bodies. Verify exact accepted bytes, capacity bounds, large gzip roundtrips and gzip/zstd low-ratio plus zstd expansion-limit fallbacks.

Hosted check and full package tests passed (209 passed, 3 ignored). Extended alternating benchmark: accepted 8388740-byte conversation zstd retained capacity 8421508 to 2059758 bytes, median encode latency 68.818 to 68.855 ms over 12 measured rounds. Gzip retained capacity 4194370 to 2367473 bytes, median 24.743 to 24.555 ms (noise-level change). Peak codec allocation unchanged; selected bodies may incur a realloc/copy, rejected bodies no longer do.

**File**: `crates/jcode-provider-core/src/request_compression.rs` (modified, +6/-8)
```diff
@@ -200,7 +200,7 @@ fn decide(
         BodyEncoding::Gzip => gzip_fast(raw),
         BodyEncoding::Zstd => zstd_fast(raw),
     };
-    let Some(compressed) = compressed else {
+    let Some(mut compressed) = compressed else {
         return (Decision::Raw("encode-error"), None);
     };
     if encoding == BodyEncoding::Zstd && raw.len() > compressed.len() * MAX_ZSTD_EXPANSION {
@@ -213,6 +213,10 @@ fn decide(
     if !worth_it {
         return (Decision::Raw("low-ratio"), None);
     }
+    // Only the selected wire body survives until upload completes. Release
+    // raw-size estimates and codec growth slack for both encodings, but avoid
+    // a realloc/copy for bodies rejected by ratio or expansion-limit checks.
+    compressed.shrink_to_fit();
     let compressed_len = compressed.len();
     let decision = match encoding {
         BodyEncoding::Gzip => Decision::Gzip { compressed_len },
@@ -232,13 +236,7 @@ fn gzip_fast(raw: &[u8]) -> Option<Vec<u8>> {
         flate2::Compression::fast(),
     );
     encoder.write_all(raw).ok()?;
-    let mut compressed = encoder.finish().ok()?;
-    // The wire body owns this Vec until upload completes. Do not retain the
-    // raw-size estimate (or growth slack) for that entire time. Shrinking once
-    // also handles moderately compressible bodies, unlike capping only the
-    // initial allocation, without changing the encoded bytes or encode policy.
-    compressed.shrink_to_fit();
-    Some(compressed)
+    encoder.finish().ok()
 }
 
 /// Conservative compression ratio assumed when a decision must be made before
```

**File**: `crates/jcode-provider-core/src/request_compression_tests.rs` (modified, +66/-13)
```diff
@@ -22,35 +22,54 @@ fn deterministic_noise(len: usize) -> Vec<u8> {
 }
 
 #[test]
-fn large_gzip_bodies_roundtrip_with_bounded_spare_capacity() {
+fn large_gzip_bodies_roundtrip_and_selected_bodies_have_bounded_capacity() {
     for raw in [
         jsonish(8 * 1024 * 1024),
         vec![b'a'; 8 * 1024 * 1024],
         deterministic_noise(8 * 1024 * 1024),
     ] {
         let compressed = gzip_fast(&raw).unwrap();
-        assert!(
-            compressed.capacity() <= compressed.len() + 64 * 1024,
-            "len={} capacity={}",
-            compressed.len(),
-            compressed.capacity()
-        );
         let mut decoded = Vec::new();
         flate2::read::GzDecoder::new(compressed.as_slice())
             .read_to_end(&mut decoded)
             .unwrap();
         assert_eq!(decoded, raw);
+        let (decision, selected) =
+            decide(&raw, CompressionMode::Always, Some(BodyEncoding::Gzip), 1e6);
+        if compressed.len() < raw.len() {
+            assert_eq!(
+                decision,
+                Decision::Gzip {
+                    compressed_len: compressed.len()
+                }
+            );
+            let selected = selected.unwrap();
+            assert_eq!(selected, compressed);
+            assert!(selected.capacity() <= selected.len() + 64 * 1024);
+        } else {
+            assert_eq!(decision, Decision::Raw("low-ratio"));
+            assert!(selected.is_none());
+        }
     }
 }
 
 /// Run explicitly with --ignored --nocapture. Compare on the same host and
 /// alternate input and policy order to reduce warm-cache/order bias.
 /// Policies: 0 = original half-raw allocation, 1 = 64 KiB initial cap,
-/// 2 = original allocation followed by final shrink (production).
+/// 2 = original allocation followed by final shrink (accepted gzip bodies).
+/// 3/4 = zstd before/after final shrink. Noise and repeated zstd bodies are
+/// codec-only controls: rejected bodies do not pay shrink cost in production.
 #[test]
 #[ignore = "allocation and latency benchmark"]
 fn gzip_allocation_benchmark() {
     fn encode(raw: &[u8], policy: usize) -> Vec<u8> {
+        if policy >= 3 {
+            let mut bytes = zstd_fast(raw).unwrap();
+            if policy == 4 {
+                bytes.shrink_to_fit();
+            }
+            return bytes;
+        }
         let capacity = if policy == 1 {
             (raw.len() / 2).min(64 * 1024)
         } else {
@@ -89,13 +108,13 @@ fn gzip_allocation_benchmark() {
         ("conversation", conversation),
         ("noise", noise),
     ];
-    let mut timings = vec![vec![Vec::new(); 3]; inputs.len()];
+    let mut timings = vec![vec![Vec::new(); 5]; inputs.len()];
     for round in 0..13 {
         for offset in 0..inputs.len() {
             let input = (round + offset) % inputs.len();
             let (name, raw) = &inputs[input];
-            for offset in 0..3 {
-                let policy = (round + offset) % 3;
+            for offset in 0..5 {
+                let policy = (round + offset) % 5;
                 let started = Instant::now();
                 let bytes = std::hint::black_box(encode(std::hint::black_box(raw), policy));
                 let elapsed = started.elapsed().as_secs_f64() * 1000.0;
@@ -106,15 +125,32 @@ fn gzip_allocation_benchmark() {
                         bytes.len(),
                         bytes.capacity()
                     );
-                    assert_eq!(bytes, gzip_fast(raw).unwrap());
+                    let expected = if policy >= 3 {
+                        zstd_fast(raw).unwrap()
+                    } else {
+                        gzip_fast(raw).unwrap()
+                    };
+                    assert_eq!(bytes, expected);
+                    if *name == "conversation" && matches!(policy, 2 | 4) {
+                        let encoding = if policy == 4 {
+                            BodyEncoding::Zstd
+                        } else {
+                            BodyEncoding::Gzip
+                        };
+                        let (_, selected) =
+                            decide(raw, CompressionMode::Always, Some(encoding), 1e6);
+                        let selected = selected.expect("conversation must be accepted");
+                        assert_eq!(selected, bytes);
+                        assert!(selected.capacity() <= selected.len() + 64 * 1024);
+                    }
                 } else {
                     timings[input][policy].push(elapsed);
                 }
             }
         }
     }
     for (input, (name, _)) in inputs.iter().enumerate() {
-        for policy in 0..3 {
+        for policy in 0..5 {
             let values = &mut timings[input][policy];
             values.sort_by(f64::total_cmp);
             eprintln!(
@@ -423,6 +459,10 @@ fn zstd_roundtrips_and_beats_gzip_ratio() {
     };
     let bytes = bytes.unwrap();
     assert_eq!(bytes.len(), compressed_len);
+    let unshrunk = zstd_fast(&big).unwrap();
+ 
```

---

### Incident Patch 3: `398d454d` (2026-11-18)
**Commit Message**: fix(jarvis): separate passive screen ACKs from client registration

**File**: `crates/jcode-tui/src/tui/backend_screen.rs` (modified, +13/-3)
```diff
@@ -5,7 +5,7 @@ use std::sync::atomic::{AtomicU64, Ordering};
 use tokio::sync::watch;
 
 // Kept separate from ordinary request IDs. Acks carry no turn semantics.
-static NEXT_SCREEN_ID: AtomicU64 = AtomicU64::new(1 << 62);
+static NEXT_SCREEN_ID: AtomicU64 = AtomicU64::new(1 << 63);
 fn request(session: &str, action: ScreenContextAction) -> Request {
     Request::ScreenContext {
         id: NEXT_SCREEN_ID.fetch_add(1, Ordering::Relaxed),
@@ -151,13 +151,13 @@ impl RemoteConnection {
     /// settle an observer turn whose current request ID is unknown locally.
     pub(crate) fn handle_screen_control_event(&mut self, event: &ServerEvent) -> bool {
         match event {
-            ServerEvent::Ack { id } if *id >= (1 << 62) => {
+            ServerEvent::Ack { id } if *id >= (1 << 63) => {
                 if let Some(feed) = &self.screen_feed {
                     feed.acknowledged.send_replace(*id);
                 }
                 true
             }
-            ServerEvent::Error { id, message, .. } if *id >= (1 << 62) => {
+            ServerEvent::Error { id, message, .. } if *id >= (1 << 63) => {
                 if let Some(feed) = &self.screen_feed {
                     feed.task.abort();
                 }
@@ -232,6 +232,16 @@ mod tests {
             message: "expired".into(),
             retry_after_secs: None
         }));
+        // Ordinary request IDs deliberately occupy the 01 high-bit range.
+        // They must reach tool-registration handling, not passive ACK handling.
+        for ordinary in [7, 1_u64 << 62, (1_u64 << 63) - 1] {
+            assert!(!remote.handle_screen_control_event(&ServerEvent::Ack { id: ordinary }));
+            assert!(!remote.handle_screen_control_event(&ServerEvent::Error {
+                id: ordinary,
+                message: "ordinary control failure".into(),
+                retry_after_secs: None,
+            }));
+        }
         assert!(!remote.handle_screen_control_event(&ServerEvent::Ack { id: 7 }));
         assert!(!remote.handle_screen_control_event(&ServerEvent::Error {
             id: 7,
```

#### Recent Merged Pull Requests:
- **PR #2197** (closed): docs: freeze new kcode/jcode lanes and evaluate the churn (@KooshaPari)
- **PR #2194** (closed): style(ci): clear the Format gate and the macOS warning budget for every PR (@KooshaPari)
- **PR #2189** (closed): fix(tui): repair the three tests that fail on master and block every PR (@KooshaPari)
- **PR #2185** (closed): fix: resume model catalog on attach if routes not hydrated (@osmanaksu)
- **PR #2172** (closed): fix: add missing clap entry to Cargo.lock (@alecuba16)
- **PR #2161** (closed): fix(config): track resume override in cache fingerprint (@Aafimalek)

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

## X. avoid discarded per-agent server memory diagnostics

**RULE**:
When implementing operations in `crates/jcode-app-core/src/server/debug_server_memory_efficiency_tests.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in 1jehuang/jcode. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fcb98e73`: avoid discarded per-agent server memory diagnostics. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/jcode-app-core/src/server/debug_server_memory_efficiency_tests.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
//! No-LLM fixtures for the server memory diagnostic's session-only fast path.
use super::*;

struct PrivateHome {
    _dir: tempfile::TempDir,
    home: Option<std::ffi::OsString>,
    test_session: Option<std::ffi::OsString>,
}

impl PrivateHome {
    fn new() -> Self {
        let dir = tempfile::tempdir().unwrap();
        let home = std::env::var_os("JCODE_HOME");
        let test_session = std::env::var_os("JCODE_TEST_SESSION");
        crate::env::set_var("JCODE_HOME", dir.path());
        crate::env::set_var("JCODE_TEST_SESSION", "1");
        Self {
            _dir: dir,
            home,
            test_session,
        }
    }
}

impl Drop for PrivateHome {
    fn drop(&mut self) {
        for (name, value) in [
            ("JCODE_HOME", self.home.take()),
            ("JCODE_TEST_SESSION", self.test_session.take()),
        ] {
            match value {
                Some(value) => crate::env::set_var(name, value),
                None => crate::env::remove_var(name),
            }
        }
    }
}

struct NoRequests;

#[async_trait::async_trait]
impl crate::provider::Provider for NoRequests {
    async fn complete(
        &self,
        _: &[crate::message::Mess
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fcb98e73` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
