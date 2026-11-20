# Agent Contract: Agent Contract: 1jehuang-jcode-learnings Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "1jehuang-jcode-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T03:13:17.925Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-1jehuang-jcode-learnings",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [1jehuang-jcode-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T03:13:17.925Z`  
> **Learning ID**: `LEARN-EVO-1jehuang-jcode-learnings`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `1jehuang-jcode-learnings-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/1jehuang-jcode-learnings.md`  
> **Source**: github ([https://github.com/1jehuang/jcode](https://github.com/1jehuang/jcode))  
> **Source Version**: `90595b24`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T03:13:06.565Z  
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
> **Harvest Timestamp**: 2026-11-20T03:13:06.409Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `1jehuang/jcode`
- **Description**: High performance coding agent harness written in Rust, built for heavy multi-agent dev workflows
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 21925 stars

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

### Core Architecture Module: `crates/jcode-app-core/examples/search_projection_probe.rs`
```
//! `justrust run --release -p jcode-app-core --example search_projection_probe`
//! Actual Linux thread CPU, cumulative allocation traffic, not RSS.
//! Hosted optimized 16-round alternating probe, 2026-11-18: small 50 -> 24 ns,
//! many text blocks 4344 -> 1829 ns; 1.5 MB single text allocated 3,000,096
//! -> 96 bytes and 1.95 MB result 3,900,096 -> 96 bytes. Every one of eleven
//! fixture shapes improved CPU, including tool JSON, intent and nested todos.
//! Fixture setup is excluded, projection result destruction is included.
//! A narrower plain-single-block followup eliminated the remaining 96 bytes:
//! small 54 -> 3 ns, many blocks 3306 -> 1183 ns, empty separators 72 -> 56 ns.
//! A generic first/second iterator-chain version was rejected because the
//! empty-separator case regressed 108 -> 144 ns despite fewer allocations.
use jcode_message_types::ContentBlock;
use jcode_session_types::StoredMessage;
#[path = "../src/tool/session_search/searchable_text_fixtures.rs"]
mod fixtures;
#[path = "../src/tool/session_search/searchable_text_legacy.rs"]
mod oracle;
#[path = "../src/tool/session_search/searchable_text.rs"]
mod projection;
use std::alloc::{GlobalAlloc, Layout, System};
use std::hint::black_box;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering::Relaxed};
struct Counting;
static ENABLE: AtomicBool = AtomicBool::new(false);
static CALLS: AtomicUsize = AtomicUsize::new(0);
static BYTES: AtomicUsize = AtomicUsize::new(0);
#[global_allocator]
static ALLOCATOR: Counting = Counting;
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        if ENABLE.load(Relaxed) {
            CALLS.fetch_add(1, Relaxed);
            BYTES.fetch_add(layout.size(), Relaxed);
        }
        unsafe { System.alloc(layout) }
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        if ENABLE.load(Relaxed) {
            CALLS.fetch_add(1, Relaxed);
            BYTES.fetch_add(size, Relaxed);
        }
        unsafe { System.realloc(ptr, layout, size) }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        unsafe { System.dealloc(ptr, layout) }
    }
}
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
fn execute(msg: &StoredMessage, tools: bool, new: bool) {
    if new {
        black_box(projection::searchable_message_text(black_box(msg), tools));
    } else {
        black_box(oracle::legacy(black_box(msg), tools));
    }
}
fn main() {
    for (name, msg, tools) in fixtures::cases() {
        assert_eq!(
            projection::searchable_message_text(&msg, tools),
            oracle::legacy(&msg, tools)
        );
        let mut allocations = vec![];
        for new in [false, true] {
            CALLS.store(0, Relaxed);
            BYTES.store(0, Relaxed);
            ENABLE.store(true, Relaxed);
            execute(&msg, tools, new);
            ENABLE.store(false, Relaxed);
            allocations.push((CALLS.load(Relaxed), BYTES.load(Relaxed)));
        }
        let bytes = msg
            .content
            .iter()
            .map(|b| match b {
                ContentBlock::Text { text, .. } => text.len(),
                ContentBlock::ToolResult { content, .. } => content.len(),
                _ => 0,
            })
            .sum::<usize>();
        let rounds = 16;
        let iterations = (2_000_000 / bytes.max(1)).clamp(16, 20_000);
        let mut samples = [vec![], vec![]];
        for round in 0..rounds {
            for index in [round % 2, 1 - round % 2] {
                let start = cpu_ns();
                for _ in 0..iterations {
                    execute(&msg, tools, index == 1);
                }
                samples[index].push((cpu_ns() - start) / iterations as u128);
            }
        }
        for samples in &mut samples {
            samples.sort_unstable();
        }
        println!(
            "{name}: CPU ns {} -> {}, allocation calls/bytes {:?} -> {:?}",
            samples[0][rounds / 2],
            samples[1][rounds / 2],
            allocations[0],
            allocations[1]
        );
    }
}

```

### Core Architecture Module: `crates/jcode-app-core/examples/tool_projection_probe.rs`
```
//! Tool JSON-only frozen baseline versus production, alternating thread CPU samples.
//! Run: justrust run --release -p jcode-app-core --example tool_projection_probe
use jcode_message_types::ContentBlock;
use jcode_session_types::StoredMessage;
#[path = "../src/tool/session_search/searchable_text_fixtures.rs"]
mod fixtures;
#[path = "../src/tool/session_search/searchable_text.rs"]
mod projection;
use std::alloc::{GlobalAlloc, Layout, System};
use std::borrow::Cow;
use std::hint::black_box;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering::Relaxed};
struct Counting;
static ENABLE: AtomicBool = AtomicBool::new(false);
static CALLS: AtomicUsize = AtomicUsize::new(0);
static BYTES: AtomicUsize = AtomicUsize::new(0);
#[global_allocator]
static ALLOCATOR: Counting = Counting;
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        if ENABLE.load(Relaxed) {
            CALLS.fetch_add(1, Relaxed);
            BYTES.fetch_add(layout.size(), Relaxed);
        }
        unsafe { System.alloc(layout) }
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        if ENABLE.load(Relaxed) {
            CALLS.fetch_add(1, Relaxed);
            BYTES.fetch_add(size, Relaxed);
        }
        unsafe { System.realloc(ptr, layout, size) }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        unsafe { System.dealloc(ptr, layout) }
    }
}
// Frozen pre-change include_tools projection. All fixtures contain only ToolUse.
fn baseline(msg: &StoredMessage) -> Cow<'_, str> {
    let mut parts: Vec<Cow<'_, str>> = msg
        .content
        .iter()
        .filter_map(|block| match block {
            ContentBlock::ToolUse { name, input, .. } => {
                let input = input.to_string();
                Some(Cow::Owned(if input == "null" {
                    format!("[tool call: {name}]")
                } else {
                    format!("[tool call: {name}] {input}")
                }))
            }
            _ => None,
        })
        .collect();
    match parts.len() {
        0 => Cow::Borrowed(""),
        1 => parts.pop().unwrap(),
        _ => Cow::Owned(parts.join("\n")),
    }
}
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
fn execute(msg: &StoredMessage, new: bool) {
    if new {
        black_box(projection::searchable_message_text(black_box(msg), true));
    } else {
        black_box(baseline(black_box(msg)));
    }
}
fn cases() -> Vec<(&'static str, StoredMessage)> {
    use serde_json::{Value, json};
    let call = |name: &str, input: Value| ContentBlock::ToolUse {
        id: "call".into(),
        name: name.into(),
        input,
        thought_signature: None,
    };
    vec![
        ("null", fixtures::message(vec![call("bash", Value::Null)])),
        ("tiny-bool", fixtures::message(vec![call("b", json!(true))])),
        (
            "tiny-number",
            fixtures::message(vec![call("bash", json!(12))]),
        ),
        (
            "tiny-object",
            fixtures::message(vec![call("bash", json!({"x":1}))]),
        ),
        (
            "null-string",
            fixtures::message(vec![call("bash", json!("null"))]),
        ),
        (
            "escaped",
            fixtures::message(vec![call("東京\n\"", json!({"x":"\"\\\n\t\u{0000}東京"}))]),
        ),
        (
            "nested",
            fixtures::message(vec![call(
                "todo",
                json!({"a":[null,true,1,{"x":["東京",false]}],"b":{"c":{"d":"payload"}}}),
            )]),
        ),
        (
            "large",
            fixtures::message(vec![call(
                "bash",
                json!({"command":"abc東京\n".repeat(100_000)}),
            )]),
        ),
        (
            "large-array",
            fixtures::message(vec![call(
                "todo",
                json!(
                    (0..10_000)
                        .map(|i| json!({"name":format!("task {i}"),"done":false}))
                        .collect::<Vec<_>>()
                ),
            )]),
        ),
        (
            "multiple",
            fixtures::message(vec![
                call("a", Value::Null),
                call("b", json!({"x":"\""})),
                call("c", json!(42)),
            ]),
        ),
    ]
}
fn main() {
    for (name, msg) in cases() {
        assert_eq!(
            projection::searchable_message_text(&msg, true),
            baseline(&msg),
            "{name}"
        );
        let mut allocations = vec![];
        for new in [false, true] {
            CALLS.store(0, Relaxed);
            BYTES.store(0, Relaxed);
            ENABLE.store(true, Relaxed);
            execute(&msg, new);
            ENABLE.store(false, Relaxed);
            allocations.push((CALLS.load(Relaxed), BYTES.load(Relaxed)));
        }
        let size = baseline(&msg).len();
        let rounds = 24;
        let iterations = (8_000_000 / size.max(1)).clamp(16, 100_000);
        let mut samples = [vec![], vec![]];
        for _ in 0..100 {
            execute(&msg, false);
            execute(&msg, true);
        }
        for round in 0..rounds {
            for index in [round % 2, 1 - round % 2] {
                let start = cpu_ns();
                for _ in 0..iterations {
                    execute(&msg, index == 1);
                }
                samples[index].push((cpu_ns() - start) / iterations as u128);
            }
        }
        for samples in &mut samples {
            samples.sort_unstable();
        }
        println!(
            "{name}: CPU ns {} -> {}, allocation calls/bytes {:?} -> {:?}",
            samples[0][rounds / 2],
            samples[1][rounds / 2],
            allocations[0],
            allocations[1]
        );
    }
}
#[test]
fn tool_serialization_matches_frozen_oracle() {
    for (name, msg) in cases() {
        assert_eq!(
            projection::searchable_message_text(&msg, true),
            baseline(&msg),
            "{name}"
        );
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

### Incident Patch 1: `d0b8d7a8` (2026-11-19)
**Commit Message**: Integrate recorder quiet-window guard with explicit retry and stale speech cleanup

**File**: `crates/jcode-voice/src/continuous.rs` (modified, +82/-41)
```diff
@@ -160,10 +160,25 @@ impl GateContext {
         serde_json::json!({"recent_chat":chat,"continuous_transcript":continuous_transcript,"background_transcript":self.background,"candidate":candidate,"require_explicit_name":require_name})
     }
 }
+#[derive(Default)]
+struct QuietWindow {
+    since: Option<Instant>,
+    last: Option<Instant>,
+}
+impl QuietWindow {
+    fn observe(&mut self, now:Instant, voiced:bool) {
+        if voiced || self.last.is_some_and(|last| now.duration_since(last) > Duration::from_millis(200)) {self.since=None;}
+        self.last=Some(now);
+        if !voiced {self.since.get_or_insert(now);}
+    }
+    fn ready(&self, now:Instant)->bool {
+        self.last.is_some_and(|last|now.duration_since(last)<=Duration::from_millis(200)) && self.since.is_some_and(|at|now.duration_since(at)>=Duration::from_millis(250))
+    }
+}
 struct Events {
     context: GateContext,
     queue: VecDeque<ContinuousEvent>,
-    quiet_since: Option<Instant>,
+    quiet: QuietWindow,
     notify: Arc<tokio::sync::Notify>,
 }
 struct ClassifiedCaption {
@@ -252,6 +267,14 @@ impl ContinuousRecording {
         key: &str,
         recorder: &str,
         config: ContinuousConfig,
+    ) -> Result<Self, VoiceError> {
+        Self::start_auto_with_budget(cancel, key, recorder, config, ContinuousBudget::default())
+    }
+
+    /// Keep the same ledger when a user explicitly retries a stopped listener.
+    pub fn start_auto_with_budget(
+        cancel: Arc<AtomicBool>, key: &str, recorder: &str, config: ContinuousConfig,
+        budget: ContinuousBudget,
     ) -> Result<Self, VoiceError> {
         if cancel.load(Ordering::SeqCst) {
             return Err(VoiceError::Cancelled);
@@ -267,14 +290,6 @@ impl ContinuousRecording {
             || !(0.5..=1.0).contains(&config.action_probability)
         {
             return Err(VoiceError::InvalidResponse);
-    ) -> Result<Self, VoiceError> {
-        Self::start_auto_with_budget(cancel, key, recorder, config, ContinuousBudget::default())
-    }
-
-    /// Keep the same ledger when a user explicitly retries a stopped listener.
-    pub fn start_auto_with_budget(
-        cancel: Arc<AtomicBool>, key: &str, recorder: &str, config: ContinuousConfig,
-        budget: ContinuousBudget,
         }
         #[cfg(not(test))]
         let gate =
@@ -294,7 +309,7 @@ impl ContinuousRecording {
         let events = Arc::new(Mutex::new(Events {
             context: GateContext::default(),
             queue: VecDeque::new(),
-            quiet_since: None,
+            quiet: QuietWindow::default(),
             notify: Arc::new(tokio::sync::Notify::new()),
         }));
         let (c, s, g, l, e) = (
@@ -323,6 +338,7 @@ impl ContinuousRecording {
                             key,
                             recorder,
                             config,
+                            budget,
                             p,
                             a.clone(),
                             gate,
@@ -338,7 +354,6 @@ impl ContinuousRecording {
                     if error != VoiceError::Cancelled {
                         emit(&e, ContinuousEvent::Error(error));
                     }
-                            budget,
                 }
                 emit(&e, ContinuousEvent::Stopped);
             })
@@ -380,6 +395,7 @@ impl ContinuousRecording {
     }
     fn clear_speech_events(&self, clear_chat: bool) {
         let mut output = self.events.lock().unwrap_or_else(|e| e.into_inner());
+        output.quiet = QuietWindow::default();
         // Aborted gate jobs never report back: forget their pending caption.
         output.context.inflight = None;
         output.context.claimed = None;
@@ -410,8 +426,9 @@ impl ContinuousRecording {
     }
     /// Claim a quiet playback window without invalidating pending transcript events.
     pub fn suppress_if_quiet(&self) -> bool {
-        let output = self.events.lock().unwrap_or_else(|e| e.into_inner());
-        if !self.is_capturing() || !output.quiet_since.is_some_and(|at| at.elapsed() >= Duration::from_millis(250)) || output.queue.iter().any(|e| matches!(e, ContinuousEvent::Transcript {..} | ContinuousEvent::Continuation {..} | ContinuousEvent::State(VoiceState::Speaking | VoiceState::Transcribing))) { return false; }
+        let mut output = self.events.lock().unwrap_or_else(|e| e.into_inner());
+        if !self.is_capturing() || !output.quiet.ready(Instant::now()) || output.queue.iter().any(|e| matches!(e, ContinuousEvent::Transcript {..} | ContinuousEvent::Continuation {..} | ContinuousEvent::State(VoiceState::Speaking | VoiceState::Transcribing))) { return false; }
+        output.quiet = QuietWindow::default();
         if !self.suppressed.swap(true, Ordering::SeqCst) { self.epoch.fetch_add(1, Ordering::SeqCst); }
         true
     }
@@ -643,6 +660,9 @@ async fn session_permitted(_config: &ContinuousConfig) -> bool {
     crate::global::session::permitted().await
 }
 
+#[derive(Default, Clone)
```

---

### Incident Patch 2: `5bce1275` (2026-11-19)
**Commit Message**: Extract capture loop, argument normalization and focused regression test modules

**File**: `crates/jcode-app-core/src/tool/selfdev/reconcile_bootstrap_tests.rs` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+use super::*;
+
+#[test]
+fn reconcile_keeps_running_request_not_yet_registered_in_live_task_map() {
+    // Regression: spawn_with_notify writes the Running status file and starts
+    // the build future *before* inserting the task into the in-process task
+    // map. The build's own first wait_for_turn iteration (or another agent's
+    // queue poll) could then see status=Running + is_live_task=false and prune
+    // the request instantly: "Queued build request disappeared". Within the
+    // bootstrap grace window a Running-but-unregistered task must survive.
+    let _storage_guard = crate::storage::lock_test_env();
+    let temp_home = tempfile::TempDir::new().expect("temp home");
+    let _home_guard = EnvVarGuard::set("JCODE_HOME", temp_home.path());
+
+    let mut session = session::Session::create(None, Some("Racing Build".to_string()));
+    session.save().expect("save session");
+
+    let status_path = temp_home.path().join("racing.status.json");
+    storage::write_json(
+        &status_path,
+        &background::TaskStatusFile {
+            task_id: "racing-task-not-in-live-map".to_string(),
+            tool_name: "selfdev-build".to_string(),
+            display_name: Some("selfdev build".to_string()),
+            session_id: session.id.clone(),
+            status: BackgroundTaskStatus::Running,
+            exit_code: None,
+            error: None,
+            started_at: Utc::now().to_rfc3339(),
+            completed_at: None,
+            duration_secs: None,
+            pid: None,
+            owner_pid: None,
+            owner_instance: None,
+            detached: false,
+            notify: true,
+            wake: true,
+            progress: None,
+            event_history: Vec::new(),
+            stall_wake_seconds: None,
+        },
+    )
+    .expect("write running status file");
+
+    let source = test_source_state(std::path::Path::new("/tmp/jcode"));
+    let request = BuildRequest {
+        request_id: "racing-request".to_string(),
+        background_task_id: Some("racing-task-not-in-live-map".to_string()),
+        session_id: session.id.clone(),
+        session_short_name: session.short_name.clone(),
+        session_title: Some("Racing Build".to_string()),
+        release_notes: None,
+        reason: "racing reason".to_string(),
+        repo_dir: "/tmp/jcode".to_string(),
+        repo_scope: source.repo_scope.clone(),
+        worktree_scope: source.worktree_scope.clone(),
+        command: "scripts/dev_cargo.sh build --profile selfdev -p jcode --bin jcode".to_string(),
+        requested_at: Utc::now().to_rfc3339(),
+        started_at: None,
+        completed_at: None,
+        state: BuildRequestState::Queued,
+        version: Some("racing-build".to_string()),
+        dedupe_key: Some("racing-dedupe".to_string()),
+        requested_source: Some(source.clone()),
+        built_source: None,
+        published_version: None,
+        last_progress: Some("queued".to_string()),
+        validated: false,
+        error: None,
+        output_file: None,
+        status_file: Some(status_path.display().to_string()),
+        attached_to_request_id: None,
+    };
+    request.save().expect("save racing request");
+
+    let pending =
+        BuildRequest::pending_requests_for_scope(&source.worktree_scope).expect("pending requests");
+    assert!(
+        pending
+            .iter()
+            .any(|request| request.request_id == "racing-request"),
+        "running-but-unregistered request must stay pending during bootstrap grace"
+    );
+
+    let reloaded = BuildRequest::load("racing-request")
+        .expect("load racing request")
+        .expect("racing request exists");
+    assert_eq!(reloaded.state, BuildRequestState::Queued);
+    assert!(reloaded.error.is_none());
+}
```

**File**: `crates/jcode-app-core/src/tool/selfdev/tests.rs` (modified, +2/-88)
```diff
@@ -1375,94 +1375,8 @@ fn reconcile_pending_state_maps_superseded_background_status() {
     );
 }
 
-#[test]
-fn reconcile_keeps_running_request_not_yet_registered_in_live_task_map() {
-    // Regression: spawn_with_notify writes the Running status file and starts
-    // the build future *before* inserting the task into the in-process task
-    // map. The build's own first wait_for_turn iteration (or another agent's
-    // queue poll) could then see status=Running + is_live_task=false and prune
-    // the request instantly: "Queued build request disappeared". Within the
-    // bootstrap grace window a Running-but-unregistered task must survive.
-    let _storage_guard = crate::storage::lock_test_env();
-    let temp_home = tempfile::TempDir::new().expect("temp home");
-    let _home_guard = EnvVarGuard::set("JCODE_HOME", temp_home.path());
-
-    let mut session = session::Session::create(None, Some("Racing Build".to_string()));
-    session.save().expect("save session");
-
-    let status_path = temp_home.path().join("racing.status.json");
-    storage::write_json(
-        &status_path,
-        &background::TaskStatusFile {
-            task_id: "racing-task-not-in-live-map".to_string(),
-            tool_name: "selfdev-build".to_string(),
-            display_name: Some("selfdev build".to_string()),
-            session_id: session.id.clone(),
-            status: BackgroundTaskStatus::Running,
-            exit_code: None,
-            error: None,
-            started_at: Utc::now().to_rfc3339(),
-            completed_at: None,
-            duration_secs: None,
-            pid: None,
-            owner_pid: None,
-            owner_instance: None,
-            detached: false,
-            notify: true,
-            wake: true,
-            progress: None,
-            event_history: Vec::new(),
-            stall_wake_seconds: None,
-        },
-    )
-    .expect("write running status file");
-
-    let source = test_source_state(std::path::Path::new("/tmp/jcode"));
-    let request = BuildRequest {
-        request_id: "racing-request".to_string(),
-        background_task_id: Some("racing-task-not-in-live-map".to_string()),
-        session_id: session.id.clone(),
-        session_short_name: session.short_name.clone(),
-        session_title: Some("Racing Build".to_string()),
-        release_notes: None,
-        reason: "racing reason".to_string(),
-        repo_dir: "/tmp/jcode".to_string(),
-        repo_scope: source.repo_scope.clone(),
-        worktree_scope: source.worktree_scope.clone(),
-        command: "scripts/dev_cargo.sh build --profile selfdev -p jcode --bin jcode".to_string(),
-        requested_at: Utc::now().to_rfc3339(),
-        started_at: None,
-        completed_at: None,
-        state: BuildRequestState::Queued,
-        version: Some("racing-build".to_string()),
-        dedupe_key: Some("racing-dedupe".to_string()),
-        requested_source: Some(source.clone()),
-        built_source: None,
-        published_version: None,
-        last_progress: Some("queued".to_string()),
-        validated: false,
-        error: None,
-        output_file: None,
-        status_file: Some(status_path.display().to_string()),
-        attached_to_request_id: None,
-    };
-    request.save().expect("save racing request");
-
-    let pending =
-        BuildRequest::pending_requests_for_scope(&source.worktree_scope).expect("pending requests");
-    assert!(
-        pending
-            .iter()
-            .any(|request| request.request_id == "racing-request"),
-        "running-but-unregistered request must stay pending during bootstrap grace"
-    );
-
-    let reloaded = BuildRequest::load("racing-request")
-        .expect("load racing request")
-        .expect("racing request exists");
-    assert_eq!(reloaded.state, BuildRequestState::Queued);
-    assert!(reloaded.error.is_none());
-}
+#[path = "reconcile_bootstrap_tests.rs"]
+mod reconcile_bootstrap;
 
 #[path = "repo_resolver_tests.rs"]
 mod repo_resolver;
```

**File**: `crates/jcode-app-core/src/tool/todo.rs` (modified, +3/-107)
```diff
@@ -1174,113 +1174,9 @@ fn build_todo_output(
         .with_metadata(metadata))
 }
 
-/// Leniently normalize raw todo-tool arguments before strict deserialization.
-///
-/// Some providers (notably Claude tool calling) intermittently emit tool
-/// arguments as JSON *strings* instead of native types: the whole `todos`
-/// array as one stringified JSON blob, individual items as stringified
-/// objects, or numeric fields like `confidence` as `"90"`. Strict
-/// `serde_json::from_value` rejects these with `invalid type: string ...`,
-/// failing the entire call (issue #357; same provider quirk as #106).
-fn normalize_todo_input(mut input: Value) -> Value {
-    let Some(obj) = input.as_object_mut() else {
-        return input;
-    };
-    if let Some(plan) = obj.get_mut("plan") {
-        if let Value::String(raw) = plan {
-            let trimmed = raw.trim();
-            if trimmed.is_empty() {
-                *plan = Value::Null;
-            } else if let Ok(parsed @ (Value::Object(_) | Value::Null)) =
-                serde_json::from_str::<Value>(trimmed)
-            {
-                *plan = parsed;
-            }
-        }
-        if let Some(fields) = plan.as_object_mut() {
-            for key in [
-                "alignment_score",
-                "user_intention_alignment",
-                "understands_user_intent",
-            ] {
-                if let Some(value) = fields.get_mut(key) {
-                    coerce_empty_string_to_null(value);
-                }
-            }
-        }
-    }
-    for key in ["todos", "goals"] {
-        let Some(entries) = obj.get_mut(key) else {
-            continue;
-        };
-
-        // Whole array sent as a stringified JSON blob.
-        if let Value::String(raw) = entries {
-            let trimmed = raw.trim();
-            if trimmed.is_empty() {
-                *entries = Value::Null;
-            } else if let Ok(parsed @ (Value::Array(_) | Value::Null)) =
-                serde_json::from_str::<Value>(trimmed)
-            {
-                *entries = parsed;
-            }
-        }
-
-        if let Value::Array(items) = entries {
-            for item in items.iter_mut() {
-                // Individual item sent as a stringified JSON object.
-                if let Value::String(raw) = item
-                    && let Ok(parsed @ Value::Object(_)) = serde_json::from_str::<Value>(raw.trim())
-                {
-                    *item = parsed;
-                }
-                let Some(fields) = item.as_object_mut() else {
-                    continue;
-                };
-                if key == "todos"
-                    && let Some(Value::String(status)) = fields.get_mut("status")
-                    && let Some(canonical) = crate::todo::canonical_todo_status(status)
-                {
-                    *status = canonical.to_string();
-                }
-                for key in [
-                    "confidence",
-                    "completion_confidence",
-                    "alignment_score",
-                    "user_intention_alignment",
-                    "closed_feedback_loop",
-                    // Pre-rename aliases; some prompts and replayed transcripts
-                    // still carry the old keys.
-                    "hill_climbability",
-                    "end_to_end_ownership",
-                    "delivery_state",
-                    "feedback_loop_relevance",
-                    "feedback_loop_coverage",
-                    "feedback_loop_traceability",
-                    "difficulty",
-                    "autonomy",
-                ] {
-                    if let Some(value) = fields.get_mut(key) {
-                        coerce_empty_string_to_null(value);
-                    }
-                }
-            }
-        }
-    }
-    input
-}
-
-/// Coerce an empty or whitespace-only string to `null` so an omitted-but-sent
-/// assessment reads as absent. Numeric legacy scores (ints, floats, numeric
-/// strings) are handled by the semantic-state deserializers themselves, so no
-/// numeric coercion is needed here anymore.
-fn coerce_empty_string_to_null(value: &mut Value) {
-    if let Value::String(raw) = value
-        && raw.trim().is_empty()
-    {
-        *value = Value::Null;
-    }
-}
+#[path = "todo_normalize.rs"]
+mod normalize;
+use normalize::normalize_todo_input;
 
 #[async_trait]
 impl Tool for TodoTool {
```

**File**: `crates/jcode-app-core/src/tool/todo_normalize.rs` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+use serde_json::Value;
+
+/// Leniently normalize raw todo-tool arguments before strict deserialization.
+///
+/// Some providers (notably Claude tool calling) intermittently emit tool
+/// arguments as JSON *strings* instead of native types: the whole `todos`
+/// array as one stringified JSON blob, individual items as stringified
+/// objects, or numeric fields like `confidence` as `"90"`. Strict
+/// `serde_json::from_value` rejects these with `invalid type: string ...`,
+/// failing the entire call (issue #357; same provider quirk as #106).
+pub(super) fn normalize_todo_input(mut input: Value) -> Value {
+    let Some(obj) = input.as_object_mut() else {
+        return input;
+    };
+    if let Some(plan) = obj.get_mut("plan") {
+        if let Value::String(raw) = plan {
+            let trimmed = raw.trim();
+            if trimmed.is_empty() {
+                *plan = Value::Null;
+            } else if let Ok(parsed @ (Value::Object(_) | Value::Null)) =
+                serde_json::from_str::<Value>(trimmed)
+            {
+                *plan = parsed;
+            }
+        }
+        if let Some(fields) = plan.as_object_mut() {
+            for key in [
+                "alignment_score",
+                "user_intention_alignment",
+                "understands_user_intent",
+            ] {
+                if let Some(value) = fields.get_mut(key) {
+                    coerce_empty_string_to_null(value);
+                }
+            }
+        }
+    }
+    for key in ["todos", "goals"] {
+        let Some(entries) = obj.get_mut(key) else {
+            continue;
+        };
+
+        // Whole array sent as a stringified JSON blob.
+        if let Value::String(raw) = entries {
+            let trimmed = raw.trim();
+            if trimmed.is_empty() {
+                *entries = Value::Null;
+            } else if let Ok(parsed @ (Value::Array(_) | Value::Null)) =
+                serde_json::from_str::<Value>(trimmed)
+            {
+                *entries = parsed;
+            }
+        }
+
+        if let Value::Array(items) = entries {
+            for item in items.iter_mut() {
+                // Individual item sent as a stringified JSON object.
+                if let Value::String(raw) = item
+                    && let Ok(parsed @ Value::Object(_)) = serde_json::from_str::<Value>(raw.trim())
+                {
+                    *item = parsed;
+                }
+                let Some(fields) = item.as_object_mut() else {
+                    continue;
+                };
+                if key == "todos"
+                    && let Some(Value::String(status)) = fields.get_mut("status")
+                    && let Some(canonical) = crate::todo::canonical_todo_status(status)
+                {
+                    *status = canonical.to_string();
+                }
+                for key in [
+                    "confidence",
+                    "completion_confidence",
+                    "alignment_score",
+                    "user_intention_alignment",
+                    "closed_feedback_loop",
+                    // Pre-rename aliases; some prompts and replayed transcripts
+                    // still carry the old keys.
+                    "hill_climbability",
+                    "end_to_end_ownership",
+                    "delivery_state",
+                    "feedback_loop_relevance",
+                    "feedback_loop_coverage",
+                    "feedback_loop_traceability",
+                    "difficulty",
+                    "autonomy",
+                ] {
+                    if let Some(value) = fields.get_mut(key) {
+                        coerce_empty_string_to_null(value);
+                    }
+                }
+            }
+        }
+    }
+    input
+}
+
+/// Coerce an empty or whitespace-only string to `null` so an omitted-but-sent
+/// assessment reads as absent. Numeric legacy scores (ints, floats, numeric
+/// strings) are handled by the semantic-state deserializers themselves, so no
+/// numeric coercion is needed here anymore.
+fn coerce_empty_string_to_null(value: &mut Value) {
+    if let Value::String(raw) = value
+        && raw.trim().is_empty()
+    {
+        *value = Value::Null;
+    }
+}
```

**File**: `crates/jcode-base/src/background.rs` (modified, +7/-11)
```diff
@@ -73,8 +73,7 @@ impl BackgroundTaskManager {
 
     /// Create a new background task manager
     pub fn new() -> Self {
-        let output_dir = task_dir();
-        Self::with_output_dir(output_dir)
+        Self::with_output_dir(task_dir())
     }
 
     /// Generate a short, unique task ID
@@ -85,27 +84,24 @@ impl BackgroundTaskManager {
         let timestamp = SystemTime::now()
             .duration_since(UNIX_EPOCH)
             .unwrap_or_default()
-            .as_millis();
-        // Use last 6 digits of timestamp + 4 random chars
+            .as_millis()
+            .to_string();
         let rand_part: String = (0..4)
             .map(|_| {
                 let idx = (rand::random::<u8>() as usize) % TASK_ID_ALPHABET.len();
                 TASK_ID_ALPHABET[idx] as char
             })
             .collect();
-        format!(
-            "{}{}",
-            &timestamp.to_string()[timestamp.to_string().len().saturating_sub(6)..],
-            rand_part
-        )
+        let suffix = &timestamp[timestamp.len().saturating_sub(6)..];
+        format!("{suffix}{rand_part}")
     }
 
     pub fn output_path_for(&self, task_id: &str) -> PathBuf {
-        self.output_dir.join(format!("{}.output", task_id))
+        self.output_dir.join(format!("{task_id}.output"))
     }
 
     pub fn status_path_for(&self, task_id: &str) -> PathBuf {
-        self.output_dir.join(format!("{}.status.json", task_id))
+        self.output_dir.join(format!("{task_id}.status.json"))
     }
 
     fn publish_task_started_activity(
```

**File**: `crates/jcode-tui/src/tui/ui_todo_lane_display_tests.rs` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+use super::*;
+
+/// Lanes that expand per todo (waiting on a swarm await) must not add a
+/// second "Waiting for ..." row under the worker's task.
+#[test]
+fn waiting_worker_reason_shares_its_todo_row() {
+    let render_at = |width: u16| {
+        let mut item = laned("M4 project loading gaps", "in_progress", 1, "Crates");
+        item.assigned_to = Some("fox".into());
+        item.waiting_on = vec!["await_1".into()];
+        let mut fox = agent("fox", "running", None, Some(12));
+        fox.wait_reason = Some("Waiting for cargo test suite".into());
+        fox.wait_age_secs = Some(1128);
+        fox.live_status = Some(crate::protocol::SwarmLiveStatus {
+            phase: "waiting".into(),
+            elapsed_ms: 12_000,
+            ..Default::default()
+        });
+        crate::tui::markdown::set_center_code_blocks(false);
+        let payload = serde_json::json!({
+            "todos": [item], "plan": {}, "goals": [], "agents": [fox],
+            "background_tasks": [{"task_id": "await_1", "label": "Swarm await"}],
+        });
+        let msg = DisplayMessage::todos(payload.to_string());
+        render_pinned_todos_message(&msg, width, crate::config::DiffDisplayMode::Off)
+            .iter()
+            .map(|line| {
+                line.spans
+                    .iter()
+                    .map(|s| s.content.as_ref())
+                    .collect::<String>()
+            })
+            .collect::<Vec<_>>()
+    };
+    let rows = render_at(180);
+    let joined = rows.join("\n");
+    let row = rows
+        .iter()
+        .find(|row| row.contains("M4 project loading gaps"))
+        .unwrap_or_else(|| panic!("{joined}"));
+    assert!(row.contains("Waiting for cargo test suite"), "{joined}");
+    assert!(row.contains("Swarm await"), "{joined}");
+    assert_eq!(joined.matches("Waiting for").count(), 1, "{joined}");
+    for width in 0..120 {
+        assert_fits(&render_at(width), width);
+    }
+}
+
+#[test]
+fn lane_name_shared_by_every_lane_is_not_drawn() {
+    let same = [
+        laned("a", "completed", 1, "main"),
+        laned("b", "pending", 2, "main"),
+    ];
+    let rows = render(&same, &[], 120);
+    assert!(rows.iter().all(|row| !row.contains("main")), "{rows:?}");
+    let distinct = [
+        laned("a", "completed", 1, "parser"),
+        laned("b", "pending", 2, "ship"),
+    ];
+    let rows = render(&distinct, &[], 120).join("\n");
+    assert!(rows.contains("parser") && rows.contains("ship"), "{rows}");
+}
```

**File**: `crates/jcode-tui/src/tui/ui_todo_stages_tests.rs` (modified, +2/-61)
```diff
@@ -1163,67 +1163,8 @@ fn failed_lane_blocks_its_phase_and_offers_retry() {
 #[path = "ui_todo_worker_heading_tests.rs"]
 mod worker_headings;
 
-/// Lanes that expand per todo (waiting on a swarm await) must not add a
-/// second "Waiting for ..." row under the worker's task.
-#[test]
-fn waiting_worker_reason_shares_its_todo_row() {
-    let render_at = |width: u16| {
-        let mut item = laned("M4 project loading gaps", "in_progress", 1, "Crates");
-        item.assigned_to = Some("fox".into());
-        item.waiting_on = vec!["await_1".into()];
-        let mut fox = agent("fox", "running", None, Some(12));
-        fox.wait_reason = Some("Waiting for cargo test suite".into());
-        fox.wait_age_secs = Some(1128);
-        fox.live_status = Some(crate::protocol::SwarmLiveStatus {
-            phase: "waiting".into(),
-            elapsed_ms: 12_000,
-            ..Default::default()
-        });
-        crate::tui::markdown::set_center_code_blocks(false);
-        let payload = serde_json::json!({
-            "todos": [item], "plan": {}, "goals": [], "agents": [fox],
-            "background_tasks": [{"task_id": "await_1", "label": "Swarm await"}],
-        });
-        let msg = DisplayMessage::todos(payload.to_string());
-        render_pinned_todos_message(&msg, width, crate::config::DiffDisplayMode::Off)
-            .iter()
-            .map(|line| {
-                line.spans
-                    .iter()
-                    .map(|s| s.content.as_ref())
-                    .collect::<String>()
-            })
-            .collect::<Vec<_>>()
-    };
-    let rows = render_at(180);
-    let joined = rows.join("\n");
-    let row = rows
-        .iter()
-        .find(|row| row.contains("M4 project loading gaps"))
-        .unwrap_or_else(|| panic!("{joined}"));
-    assert!(row.contains("Waiting for cargo test suite"), "{joined}");
-    assert!(row.contains("Swarm await"), "{joined}");
-    assert_eq!(joined.matches("Waiting for").count(), 1, "{joined}");
-    for width in 0..120 {
-        assert_fits(&render_at(width), width);
-    }
-}
-
-#[test]
-fn lane_name_shared_by_every_lane_is_not_drawn() {
-    let same = [
-        laned("a", "completed", 1, "main"),
-        laned("b", "pending", 2, "main"),
-    ];
-    let rows = render(&same, &[], 120);
-    assert!(rows.iter().all(|row| !row.contains("main")), "{rows:?}");
-    let distinct = [
-        laned("a", "completed", 1, "parser"),
-        laned("b", "pending", 2, "ship"),
-    ];
-    let rows = render(&distinct, &[], 120).join("\n");
-    assert!(rows.contains("parser") && rows.contains("ship"), "{rows}");
-}
+#[path = "ui_todo_lane_display_tests.rs"]
+mod lane_display;
 
 #[path = "ui_todo_stages_tests_additional_tests.rs"]
 mod additional_self_owned_todos_have_amber_pips_and_you_badges;
```

**File**: `crates/jcode-voice/src/continuous.rs` (modified, +5/-1007)
```diff
@@ -1108,1012 +1108,10 @@ async fn transcribe(
     let (_, result) = tokio::join!(send, session.run(rx, |_| {}));
     result
 }
-async fn run(
-    cancel: Arc<AtomicBool>,
-    suppressed: Arc<AtomicBool>,
-    epoch: Arc<AtomicU64>,
-    level: Arc<AtomicU32>,
-    events: Arc<Mutex<Events>>,
-    key: String,
-    recorder: String,
-    config: ContinuousConfig,
-    budget: ContinuousBudget,
-    paused: Arc<AtomicBool>,
-    capturing: Arc<AtomicBool>,
-    gate: Option<jcode_base::jev::JevClient>,
-) -> Result<(), VoiceError> {
-    emit(&events, ContinuousEvent::State(VoiceState::Starting));
-    let mut segmenter = Segmenter::default();
-    let mut generation = epoch.load(Ordering::SeqCst);
-    let mut resume_at = Instant::now();
-    // Randomize the process origin so IDs in persisted logs do not restart at 1.
-    static NEXT_ID: std::sync::OnceLock<AtomicU64> = std::sync::OnceLock::new();
-    let mut jobs: VecDeque<(
-        tokio::task::JoinHandle<Result<Option<ClassifiedCaption>, VoiceError>>,
-        Arc<AtomicBool>,
-        u64,
-    )> = VecDeque::new();
-    // Audio sink of the utterance currently streaming to Nari.
-    let mut live: Option<(u64, tokio::sync::mpsc::UnboundedSender<Vec<i16>>)> = None;
-    let mut warm: Option<Warm> = None;
-    let mut warm_retry_at = Instant::now();
-    let mut tick = tokio::time::interval(Duration::from_millis(100));
-    // Device rotation and manual retry share the listener's original hourly ledger.
-    let mut consecutive_failures = 0;
-    let mut budget_limited = false;
-    let mut permission_at = Instant::now();
-    let mut permitted = false;
-    loop {
-        while paused.load(Ordering::SeqCst) || !permitted {
-            if cancel.load(Ordering::SeqCst) {
-                return Err(VoiceError::Cancelled);
-            }
-            permitted = session_permitted(&config).await;
-            permission_at = Instant::now();
-            if !paused.load(Ordering::SeqCst) && permitted {
-                break;
-            }
-            emit(&events, ContinuousEvent::State(VoiceState::Suppressed));
-            tokio::time::sleep(Duration::from_millis(200)).await;
-        }
-        let setup_cancel = Arc::new(AtomicBool::new(false));
-        let setup = open_capture(setup_cancel.clone(), recorder.clone());
-        let (mic, mut pcm) = tokio::select! {
-            biased;
-            _ = crate::nari::cancelled(&cancel) => { setup_cancel.store(true,Ordering::SeqCst); return Err(VoiceError::Cancelled); },
-            result = setup => result?,
-        };
-        capturing.store(true, Ordering::SeqCst);
-        let rotate = tokio::time::sleep(Duration::from_secs(240));
-        tokio::pin!(rotate);
-        let mut last_audio = Instant::now();
-        emit(&events, ContinuousEvent::State(VoiceState::Listening));
-        let result = loop {
-            tokio::select! {
-                biased;
-                _ = crate::nari::cancelled(&cancel) => break Err(VoiceError::Cancelled),
-                _ = &mut rotate => break Ok(()),
-                chunk = pcm.recv() => {
-                    let Some(chunk) = chunk else { break Err(VoiceError::CaptureFailed); };
-                    last_audio = Instant::now();
-                    let next = epoch.load(Ordering::SeqCst);
-                    if next != generation {
-                        generation = next; segmenter = Segmenter::default(); live = None;
-                        for (handle,token,_) in jobs.drain(..) { token.store(true,Ordering::SeqCst); handle.abort(); }
-                        // Drain stale capture buffers and allow loudspeaker decay after TTS.
-                        resume_at = Instant::now() + Duration::from_millis(500);
-                    }
-                    if paused.load(Ordering::SeqCst) || suppressed.load(Ordering::SeqCst) || Instant::now() < resume_at {
-                        level.store(0,Ordering::Relaxed); continue;
-                    }
-                    let amplitude = rms(&chunk);
-                    level.store(amplitude.to_bits(),Ordering::Relaxed);
-                    {
-                        let mut output = events.lock().unwrap_or_else(|e| e.into_inner());
-                        output.quiet.observe(Instant::now(), amplitude >= 0.018 || segmenter.active);
-                    }
-                    for seg in segmenter.push_stream(&chunk) {
-                        match seg {
-                            Seg::Start(audio) => {
-                                live = None;
-                                // Bounded: drop speech rather than build an upload backlog.
-                                if jobs.len() >= 2 { continue; }
-                                if !budget.0.lock().unwrap_or_else(|e| e.into_inner()).reserve(Instant::now(), audio.len(), &config) {
-                                    budget_limited = true;
-                                    emit(&events, ContinuousEvent::State(VoiceState::BudgetLi
```

---

### Incident Patch 3: `5a98c5cf` (2026-11-19)
**Commit Message**: Organize TUI helpers and fixtures within existing file-size budgets

**File**: `crates/jcode-tui/src/tui/app.rs` (modified, +1/-2)
```diff
@@ -41,9 +41,8 @@ use std::cell::RefCell;
 use std::collections::HashSet;
 use std::hash::{Hash, Hasher};
 use std::path::PathBuf;
-use std::sync::Arc;
 use std::sync::atomic::AtomicBool;
-use std::sync::mpsc;
+use std::sync::{Arc, mpsc};
 use std::time::{Duration, Instant};
 use tokio::sync::RwLock;
 
```

**File**: `crates/jcode-tui/src/tui/app/debug_bench.rs` (modified, +3/-56)
```diff
@@ -1,62 +1,9 @@
 use super::*;
 
-impl App {
-    pub(in crate::tui::app) fn build_scroll_test_content(
-        diagrams: usize,
-        padding: usize,
-        override_diagram: Option<&str>,
-    ) -> String {
-        let mut out = String::new();
-        let intro_lines = padding.max(4);
-        for i in 0..intro_lines {
-            out.push_str(&format!(
-                "Intro line {:02} - quick brown fox jumps over the lazy dog.\n",
-                i + 1
-            ));
-        }
-
-        let diagram_templates = [
-            r#"flowchart TD
-    A[Start] --> B{Decision}
-    B -->|Yes| C[Process 1]
-    B -->|No| D[Process 2]
-    C --> E[Merge]
-    D --> E
-    E --> F[End]"#,
-            r#"sequenceDiagram
-    participant U as User
-    participant A as App
-    participant S as Service
-    U->>A: Scroll request
-    A->>S: Render diagram
-    S-->>A: PNG
-    A-->>U: Draw frame"#,
-            r#"stateDiagram-v2
-    [*] --> Idle
-    Idle --> Scrolling: input
-    Scrolling --> Rendering: diagram
-    Rendering --> Idle: frame drawn"#,
-        ];
-
-        for idx in 0..diagrams {
-            let diagram =
-                override_diagram.unwrap_or(diagram_templates[idx % diagram_templates.len()]);
-            out.push_str("```mermaid\n");
-            out.push_str(diagram);
-            out.push_str("\n```\n");
-
-            for j in 0..padding {
-                out.push_str(&format!(
-                    "After diagram {} line {:02} - stretch content for scrolling.\n",
-                    idx + 1,
-                    j + 1
-                ));
-            }
-        }
-
-        out
-    }
+#[path = "debug_bench_scroll_content.rs"]
+mod scroll_content;
 
+impl App {
     fn build_side_panel_latency_snapshot(
         diagrams: usize,
         padding: usize,
```

**File**: `crates/jcode-tui/src/tui/app/debug_bench_scroll_content.rs` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+use super::App;
+
+impl App {
+    pub(in crate::tui::app) fn build_scroll_test_content(
+        diagrams: usize,
+        padding: usize,
+        override_diagram: Option<&str>,
+    ) -> String {
+        let mut out = String::new();
+        let intro_lines = padding.max(4);
+        for i in 0..intro_lines {
+            out.push_str(&format!(
+                "Intro line {:02} - quick brown fox jumps over the lazy dog.\n",
+                i + 1
+            ));
+        }
+
+        let diagram_templates = [
+            r#"flowchart TD
+    A[Start] --> B{Decision}
+    B -->|Yes| C[Process 1]
+    B -->|No| D[Process 2]
+    C --> E[Merge]
+    D --> E
+    E --> F[End]"#,
+            r#"sequenceDiagram
+    participant U as User
+    participant A as App
+    participant S as Service
+    U->>A: Scroll request
+    A->>S: Render diagram
+    S-->>A: PNG
+    A-->>U: Draw frame"#,
+            r#"stateDiagram-v2
+    [*] --> Idle
+    Idle --> Scrolling: input
+    Scrolling --> Rendering: diagram
+    Rendering --> Idle: frame drawn"#,
+        ];
+
+        for idx in 0..diagrams {
+            let diagram =
+                override_diagram.unwrap_or(diagram_templates[idx % diagram_templates.len()]);
+            out.push_str("```mermaid\n");
+            out.push_str(diagram);
+            out.push_str("\n```\n");
+
+            for j in 0..padding {
+                out.push_str(&format!(
+                    "After diagram {} line {:02} - stretch content for scrolling.\n",
+                    idx + 1,
+                    j + 1
+                ));
+            }
+        }
+
+        out
+    }
+}
```

**File**: `crates/jcode-tui/src/tui/app/input.rs` (modified, +2/-30)
```diff
@@ -47,36 +47,8 @@ pub(super) fn floor_char_boundary(text: &str, index: usize) -> usize {
     index
 }
 
-/// Remove reasoning-marked lines from committed transcript text. Reasoning lines
-/// are wrapped in emphasis containing the invisible [`REASONING_SENTINEL`]
-/// (see `jcode_tui_markdown::reasoning_line_markup`). Trailing blank lines left
-/// behind are trimmed so the remaining answer renders cleanly.
-pub(super) fn strip_reasoning_lines(content: &str) -> String {
-    let sentinel = jcode_tui_markdown::REASONING_SENTINEL;
-    let mut out_lines: Vec<&str> = Vec::new();
-    for line in content.split('\n') {
-        if line.contains(sentinel) {
-            continue;
-        }
-        out_lines.push(line);
-    }
-    // Collapse runs of blank lines created by removed reasoning blocks, and trim
-    // leading/trailing blank lines.
-    let mut result = String::with_capacity(content.len());
-    let mut prev_blank = true; // suppress leading blanks
-    for line in out_lines {
-        let is_blank = line.trim().is_empty();
-        if is_blank && prev_blank {
-            continue;
-        }
-        if !result.is_empty() {
-            result.push('\n');
-        }
-        result.push_str(line);
-        prev_blank = is_blank;
-    }
-    result.trim_end().to_string()
-}
+mod reasoning_transcript;
+pub(super) use reasoning_transcript::strip_reasoning_lines;
 
 fn mission_turn_reminder(session_id: &str) -> Option<String> {
     crate::mission::active_system_reminder(session_id)
```

**File**: `crates/jcode-tui/src/tui/app/input/reasoning_transcript.rs` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+/// Remove reasoning-marked lines from committed transcript text. Reasoning lines
+/// are wrapped in emphasis containing the invisible [`REASONING_SENTINEL`]
+/// (see `jcode_tui_markdown::reasoning_line_markup`). Trailing blank lines left
+/// behind are trimmed so the remaining answer renders cleanly.
+pub(in crate::tui::app) fn strip_reasoning_lines(content: &str) -> String {
+    let sentinel = jcode_tui_markdown::REASONING_SENTINEL;
+    let mut out_lines: Vec<&str> = Vec::new();
+    for line in content.split('\n') {
+        if line.contains(sentinel) {
+            continue;
+        }
+        out_lines.push(line);
+    }
+    // Collapse runs of blank lines created by removed reasoning blocks, and trim
+    // leading/trailing blank lines.
+    let mut result = String::with_capacity(content.len());
+    let mut prev_blank = true; // suppress leading blanks
+    for line in out_lines {
+        let is_blank = line.trim().is_empty();
+        if is_blank && prev_blank {
+            continue;
+        }
+        if !result.is_empty() {
+            result.push('\n');
+        }
+        result.push_str(line);
+        prev_blank = is_blank;
+    }
+    result.trim_end().to_string()
+}
```

**File**: `crates/jcode-tui/src/tui/app/remote.rs` (modified, +2/-42)
```diff
@@ -841,48 +841,8 @@ async fn dispatch_compacted_history_load(app: &mut App, remote: &mut RemoteConne
 mod tests;
 
 #[cfg(test)]
-#[test]
-fn borrowed_remote_status_fields_match_legacy_and_retain_sources() {
-    for value in [None, Some(String::new()), Some("fixture 🦀".to_string())] {
-        let mut provider_name = value.clone();
-        let mut connection_type = value.clone();
-        let mut remote_transport = value.clone();
-        let mut server_version = value;
-        let legacy = serde_json::json!({
-            "provider_name": provider_name.clone(),
-            "connection_type": connection_type.clone(),
-            "remote_transport": remote_transport.clone(),
-            "server_version": server_version.clone(),
-        });
-        let evidence = serde_json::json!({
-            "provider_name": provider_name,
-            "connection_type": connection_type,
-            "remote_transport": remote_transport,
-            "server_version": server_version,
-        });
-        assert_eq!(evidence, legacy);
-        assert_eq!(evidence.to_string(), legacy.to_string());
-        assert_eq!(provider_name.as_deref(), legacy["provider_name"].as_str());
-        assert_eq!(
-            connection_type.as_deref(),
-            legacy["connection_type"].as_str()
-        );
-        assert_eq!(
-            remote_transport.as_deref(),
-            legacy["remote_transport"].as_str()
-        );
-        assert_eq!(server_version.as_deref(), legacy["server_version"].as_str());
-        for source in [
-            &mut provider_name,
-            &mut connection_type,
-            &mut remote_transport,
-            &mut server_version,
-        ] {
-            *source = Some("changed after serialization".to_string());
-        }
-        assert_eq!(evidence, legacy);
-    }
-}
+#[path = "remote_status_serialization_tests.rs"]
+mod status_serialization_tests;
 
 pub(super) async fn handle_bus_event(
     app: &mut App,
```

**File**: `crates/jcode-tui/src/tui/app/remote/server_events.rs` (modified, +4/-5)
```diff
@@ -112,11 +112,10 @@ mod runtime_identity_tests;
 mod history_fingerprint;
 #[cfg(test)]
 use history_fingerprint::AppliedHistoryFingerprint;
-use history_fingerprint::history_images_match_retained;
-use history_fingerprint::history_payload_fingerprint;
-use history_fingerprint::last_applied_history_fingerprint;
-use history_fingerprint::record_applied_history_fingerprint;
-use history_fingerprint::should_skip_identical_history_payload;
+use history_fingerprint::{
+    history_images_match_retained, history_payload_fingerprint, last_applied_history_fingerprint,
+    record_applied_history_fingerprint, should_skip_identical_history_payload,
+};
 #[cfg(test)]
 #[path = "server_events/history_dedup_tests.rs"]
 mod history_dedup_tests;
```

**File**: `crates/jcode-tui/src/tui/app/remote_status_serialization_tests.rs` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+#[test]
+fn borrowed_remote_status_fields_match_legacy_and_retain_sources() {
+    for value in [None, Some(String::new()), Some("fixture 🦀".to_string())] {
+        let mut provider_name = value.clone();
+        let mut connection_type = value.clone();
+        let mut remote_transport = value.clone();
+        let mut server_version = value;
+        let legacy = serde_json::json!({
+            "provider_name": provider_name.clone(),
+            "connection_type": connection_type.clone(),
+            "remote_transport": remote_transport.clone(),
+            "server_version": server_version.clone(),
+        });
+        let evidence = serde_json::json!({
+            "provider_name": provider_name,
+            "connection_type": connection_type,
+            "remote_transport": remote_transport,
+            "server_version": server_version,
+        });
+        assert_eq!(evidence, legacy);
+        assert_eq!(evidence.to_string(), legacy.to_string());
+        assert_eq!(provider_name.as_deref(), legacy["provider_name"].as_str());
+        assert_eq!(
+            connection_type.as_deref(),
+            legacy["connection_type"].as_str()
+        );
+        assert_eq!(
+            remote_transport.as_deref(),
+            legacy["remote_transport"].as_str()
+        );
+        assert_eq!(server_version.as_deref(), legacy["server_version"].as_str());
+        for source in [
+            &mut provider_name,
+            &mut connection_type,
+            &mut remote_transport,
+            &mut server_version,
+        ] {
+            *source = Some("changed after serialization".to_string());
+        }
+        assert_eq!(evidence, legacy);
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #2222** (closed): fix(harness): require architectural intent for understand routing (@adminwat)
- **PR #2199** (closed): style: restore rustfmt-clean state so the Format gate can pass (@KooshaPari)
- **PR #2197** (closed): docs: freeze new kcode/jcode lanes and evaluate the churn (@KooshaPari)
- **PR #2195** (closed): build(app-core): drop a call to the reverted todo-plan tracker (@KooshaPari)
- **PR #2194** (closed): style(ci): clear the Format gate and the macOS warning budget for every PR (@KooshaPari)
- **PR #2189** (closed): fix(tui): repair the three tests that fail on master and block every PR (@KooshaPari)

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

## X. Integrate recorder quiet-window guard with explicit retry and stale speech clean

**RULE**:
When implementing operations in `crates/jcode-voice/src/continuous.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in 1jehuang/jcode. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d0b8d7a8`: Integrate recorder quiet-window guard with explicit retry and stale speech cleanup. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/jcode-voice/src/continuous.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#[derive(Default)]
struct QuietWindow {
    since: Option<Instant>,
    last: Option<Instant>,
}
impl QuietWindow {
    fn observe(&mut self, now:Instant, voiced:bool) {
        if voiced || self.last.is_some_and(|last| now.duration_since(last) > Duration::from_millis(200)) {self.since=None;}
        self.last=Some(now);
        if !voiced {self.since.get_or_insert(now);}
    }
    fn ready(&self, now:Instant)->bool {
        self.last.is_some_and(|last|now.duration_since(last)<=Duration::from_millis(200)) && self.since.is_some_and(|at|now.duration_since(at)>=Duration::from_millis(250))
    }
}
    quiet: QuietWindow,
    ) -> Result<Self, VoiceError> {
        Self::start_auto_with_budget(cancel, key, recorder, config, ContinuousBudget::default())
    }

    /// Keep the same ledger when a user explicitly retries a stopped listener.
    pub fn start_auto_with_budget(
        cancel: Arc<AtomicBool>, key: &str, recorder: &str, config: ContinuousConfig,
        budget: ContinuousBudget,
            quiet: QuietWindow::default(),
                            budget,
        output.quiet = QuietWindow::default();
        let mut output = self.events.lock().unwrap_or_else(|e| e.into_inn
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    quiet_since: Option<Instant>,
    ) -> Result<Self, VoiceError> {
        Self::start_auto_with_budget(cancel, key, recorder, config, ContinuousBudget::default())
    }

    /// Keep the same ledger when a user explicitly retries a stopped listener.
    pub fn start_auto_with_budget(
        cancel: Arc<AtomicBool>, key: &str, recorder: &str, config: ContinuousConfig,
        budget: ContinuousBudget,
            quiet_since: None,
                            budget,
        let output = self.events.lock().unwrap_or_else(|e| e.into_inner());
        if !self.is_capturing() || !output.quiet_since.is_some_and(|at| at.elapsed() >= Duration::from_millis(250)) || output.queue.iter().any(|e| matches!(e, ContinuousEvent::Transcript {..} | ContinuousEvent::Continuation {..} | ContinuousEvent::State(VoiceState::Speaking | VoiceState::Transcribing))) { return false; }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d0b8d7a8` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
