# Forensic Learning Record (Deep Inspection): headroomlabs-ai/headroom

> **Canonical Artifact**: `07_PROJECT_LEARNING/headroomlabs-ai-headroom-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:20:46.524Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `headroomlabs-ai/headroom`
- **Description**: Compress tool outputs, logs, files, and RAG chunks before they reach the LLM. 20% fewer tokens for coding agents, 60-95% fewer tokens for JSON, same answers. Library, proxy, MCP server.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 74462 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/headroom-core/benches/auth_mode.rs`
```
//! Criterion benchmark for the auth-mode classifier (Phase F PR-F1).
//!
//! Acceptance criterion: <10us per call. Realistic header sets from
//! the three classes the proxy actually sees in production:
//!
//! - PAYG: `Authorization: Bearer sk-ant-api03-...`
//! - OAuth: `Authorization: Bearer <jwt>` (Codex-style)
//! - Subscription: `User-Agent: claude-code/1.5.0 ...` + `Bearer
//!   sk-ant-oat-...`
//!
//! The bench measures one classifier call per iteration. The
//! `HeaderMap` is constructed once outside the timing loop.

use std::hint::black_box;

use criterion::{criterion_group, criterion_main, Criterion};
use headroom_core::auth_mode::classify;
use http::{HeaderMap, HeaderValue};

fn build_headers(pairs: &[(&str, &str)]) -> HeaderMap {
    let mut h = HeaderMap::new();
    for (name, value) in pairs {
        h.insert(
            http::header::HeaderName::from_bytes(name.as_bytes()).unwrap(),
            HeaderValue::from_str(value).unwrap(),
        );
    }
    h
}

fn bench_classify(c: &mut Criterion) {
    let mut group = c.benchmark_group("auth_mode/classify");

    // Empty headers — the simplest path; all branches fall through.
    let empty = HeaderMap::new();
    group.bench_function("empty", |b| b.iter(|| classify(black_box(&empty))));

    // PAYG — Authorization is Bearer, prefix matches early.
    let payg = build_headers(&[(
        "authorization",
        "Bearer sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789",
    )]);
    group.bench_function("payg_anthropic_api_key", |b| {
        b.iter(|| classify(black_box(&payg)))
    });

    // OAuth — JWT, three segments, last branch in the bearer match.
    let oauth = build_headers(&[(
        "authorization",
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4iLCJpYXQiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    )]);
    group.bench_function("oauth_jwt", |b| b.iter(|| classify(black_box(&oauth))));

    // Subscription — UA must be lowercased; the most expensive path.
    let subscription = build_headers(&[
        (
            "user-agent",
            "claude-code/1.5.0 (linux; x86_64) anthropic/0.42.0",
        ),
        (
            "authorization",
            "Bearer sk-ant-oat-01-abcdefghijklmnopqrstuvwxyz",
        ),
        ("content-type", "application/json"),
        ("accept", "application/json"),
        ("host", "api.anthropic.com"),
    ]);
    group.bench_function("subscription_claude_code", |b| {
        b.iter(|| classify(black_box(&subscription)))
    });

    group.finish();
}

criterion_group!(benches, bench_classify);
criterion_main!(benches);

```

### Core Architecture Module: `crates/headroom-core/benches/bm25_scoring.rs`
```
//! Criterion benchmark for `BM25Scorer::score_batch`.
//!
//! Query preparation used to happen once per document: every `bm25_score`
//! call collected and sorted the same query keys. Cost therefore scales with
//! documents x query length, so both are varied here.

use std::hint::black_box;

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use headroom_core::relevance::{BM25Scorer, RelevanceScorer};

const VOCAB: [&str; 16] = [
    "handler",
    "parse",
    "timeout",
    "cache",
    "retry",
    "index",
    "error",
    "550e8400-e29b-41d4-a716-446655440000",
    "9f8e7d6c-1234-4321-abcd-0123456789ab",
    "12345",
    "987654",
    "resolve",
    "connection",
    "serialize",
    "upstream",
    "budget",
];

fn text(seed: usize, words: usize) -> String {
    let mut parts: Vec<&str> = Vec::with_capacity(words);
    for i in 0..words {
        parts.push(VOCAB[(seed * 7 + i * 3) % VOCAB.len()]);
    }
    parts.join(" ")
}

fn bench_score_batch(c: &mut Criterion) {
    let scorer = BM25Scorer::default();
    let mut group = c.benchmark_group("bm25/score_batch");

    for docs in [10usize, 100, 1000] {
        for query_words in [4usize, 16, 64] {
            let items: Vec<String> = (0..docs).map(|d| text(d, 60)).collect();
            let refs: Vec<&str> = items.iter().map(|s| s.as_str()).collect();
            let context = text(9_999, query_words);

            group.throughput(Throughput::Elements(docs as u64));
            group.bench_with_input(
                BenchmarkId::from_parameter(format!("{docs}d_q{query_words}w")),
                &(refs, context),
                |b, (refs, context)| {
                    b.iter(|| black_box(scorer.score_batch(black_box(refs), black_box(context))))
                },
            );
        }
    }
    group.finish();
}

criterion_group!(benches, bench_score_batch);
criterion_main!(benches);

```

### Core Architecture Module: `crates/headroom-core/benches/ccr_store.rs`
```
//! CCR store throughput benchmark — single-threaded and multi-threaded.
//!
//! Pins the win from PR9: replacing the single-`Mutex<HashMap>` design
//! with a `DashMap`-backed sharded store. The single-threaded numbers
//! should be roughly comparable (DashMap has a small per-op shard-hash
//! overhead vs a raw Mutex), but the multi-threaded numbers should
//! diverge sharply — distinct keys hit distinct shards and never
//! contend.
//!
//! Run with:
//!     cargo bench -p headroom-core --bench ccr_store
//!
//! The critical numbers to watch are the `mt/N=8` rows: with the
//! Mutex design, all 8 threads serialize on one lock, so throughput
//! is ~1× the single-threaded figure. With DashMap, throughput should
//! scale near-linearly with cores.

use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use std::hint::black_box;

use criterion::{criterion_group, criterion_main, Criterion, Throughput};
use headroom_core::ccr::{CcrStore, InMemoryCcrStore};

// ─── Baseline: the old single-Mutex<HashMap> design ────────────────
//
// Inlined here so the bench is self-contained and shows the
// before/after gap directly. Same trait, same semantics; the only
// difference is "all ops serialize on one Mutex" vs "DashMap-sharded".

struct LegacyMutexStore {
    inner: Mutex<LegacyInner>,
    ttl: Duration,
    capacity: usize,
}

struct LegacyInner {
    map: HashMap<String, LegacyEntry>,
    order: VecDeque<String>,
}

struct LegacyEntry {
    payload: String,
    inserted: Instant,
}

impl LegacyMutexStore {
    fn new(capacity: usize, ttl: Duration) -> Self {
        Self {
            inner: Mutex::new(LegacyInner {
                map: HashMap::new(),
                order: VecDeque::new(),
            }),
            ttl,
            capacity,
        }
    }
}

impl CcrStore for LegacyMutexStore {
    fn put(&self, hash: &str, payload: &str) {
        let mut g = self.inner.lock().unwrap();
        if g.map.contains_key(hash) {
            g.map.insert(
                hash.to_string(),
                LegacyEntry {
                    payload: payload.to_string(),
                    inserted: Instant::now(),
                },
            );
            return;
        }
        while g.map.len() >= self.capacity {
            let Some(oldest) = g.order.pop_front() else {
                break;
            };
            g.map.remove(&oldest);
        }
        g.map.insert(
            hash.to_string(),
            LegacyEntry {
                payload: payload.to_string(),
                inserted: Instant::now(),
            },
        );
        g.order.push_back(hash.to_string());
    }

    fn get(&self, hash: &str) -> Option<String> {
        let mut g = self.inner.lock().unwrap();
        let expired = match g.map.get(hash) {
            Some(e) => e.inserted.elapsed() > self.ttl,
            None => return None,
        };
        if expired {
            g.map.remove(hash);
            return None;
        }
        g.map.get(hash).map(|e| e.payload.clone())
    }

    fn len(&self) -> usize {
        self.inner.lock().unwrap().map.len()
    }
}

fn bench_put_single_threaded(c: &mut Criterion) {
    let store = InMemoryCcrStore::new();
    let payload = "x".repeat(512); // typical CCR payload size

    let mut group = c.benchmark_group("ccr_store/put_st");
    group.throughput(Throughput::Elements(1));
    group.bench_function("new_keys", |b| {
        let mut i = 0u64;
        b.iter(|| {
            let key = format!("k{i:012x}");
            store.put(black_box(&key), black_box(&payload));
            i += 1;
        });
    });
    group.bench_function("same_key_overwrite", |b| {
        b.iter(|| {
            store.put(black_box("hot_key"), black_box(&payload));
        });
    });
    group.finish();
}

fn bench_get_single_threaded(c: &mut Criterion) {
    let store = InMemoryCcrStore::new();
    let payload = "y".repeat(512);
    for i in 0..1000u32 {
        let key = format!("k{i:08x}");
        store.put(&key, &payload);
    }

    let mut group = c.benchmark_group("ccr_store/get_st");
    group.throughput(Throughput::Elements(1));
    group.bench_function("hit", |b| {
        let mut i = 0u32;
        b.iter(|| {
            let key = format!("k{:08x}", i % 1000);
            let _ = black_box(store.get(black_box(&key)));
            i = i.wrapping_add(1);
        });
    });
    group.bench_function("miss", |b| {
        let mut i = 0u32;
        b.iter(|| {
            let key = format!("absent_{i}");
            let _ = black_box(store.get(black_box(&key)));
            i = i.wrapping_add(1);
        });
    });
    group.finish();
}

fn run_mt_workload(store: Arc<dyn CcrStore>, threads: usize, n: u64) -> Duration {
    const ITERS_PER_THREAD: usize = 200;
    let payload = Arc::new("z".repeat(256));
    for i in 0..256u32 {
        store.put(&format!("warm_{i:08x}"), &payload);
    }
    let start = Instant::now();
    for _ in 0..n {
        thread::scope(|scope| {
            for tid in 0..threads {
                let s = store.clone();
                let p = payload.clone();
                scope.spawn(move || {
                    for i in 0..ITERS_PER_THREAD {
                        if i & 1 == 0 {
                            let k = format!("t{tid}_k{i:08x}");
                            s.put(&k, &p);
                        } else {
                            let k = format!("warm_{:08x}", i % 256);
                            let _ = s.get(&k);
                        }
                    }
                });
            }
        });
    }
    start.elapsed()
}

/// Multi-threaded mixed put/get — direct A/B between the legacy
/// `Mutex<HashMap>` design and the new DashMap-backed store. The
/// legacy version serializes every op on one lock; the new version
/// shards across keys so distinct hashes never contend.
fn bench_mixed_multi_threaded(c: &mut Criterion) {
    let mut group = c.benchmark_group("ccr_store/mt_mixed");
    group.throughput(Throughput::Elements(1));

    for &threads in &[1usize, 2, 4, 8] {
        // DashMap-backed (current design).
        let label = format!("dashmap/threads={threads}");
        group.bench_function(&label, |b| {
            b.iter_custom(|n| {
                let store: Arc<dyn CcrStore> = Arc::new(InMemoryCcrStore::new());
                run_mt_workload(store, threads, n)
            });
        });
        // Legacy Mutex<HashMap> (the design PR9 replaces).
        let label = format!("legacy_mutex/threads={threads}");
        group.bench_function(&label, |b| {
            b.iter_custom(|n| {
                let store: Arc<dyn CcrStore> =
                    Arc::new(LegacyMutexStore::new(1000, Duration::from_secs(300)));
                run_mt_workload(store, threads, n)
            });
        });
    }
    group.finish();
}

criterion_group!(
    benches,
    bench_put_single_threaded,
    bench_get_single_threaded,
    bench_mixed_multi_threaded,
);
criterion_main!(benches);

```

### Core Architecture Module: `crates/headroom-core/benches/live_zone_dispatch.rs`
```
//! Latency benchmark for the PR-B4 live-zone dispatch arms.
//!
//! Measures `compress_anthropic_live_zone` end to end — body parse,
//! live-zone walk, content-type detection, byte-threshold gate, and the
//! per-arm compressor — over representative payload shapes:
//!
//! - `source_code_2kb` / `source_code_20kb`: generated Python routed to
//!   the CodeAwareCompressor arm (the tree-sitter parse dominates).
//! - `plain_text_8kb`: prose routed to the Kompress arm. What this case
//!   actually measures depends on the machine's Hugging Face cache:
//!   with the Kompress model cache-resident it benchmarks a real ONNX
//!   inference; on a cold cache `Kompress::from_cache` resolves to a
//!   deterministic NoOp and the number is detection + gate cost only.
//!   Both are legitimate measurements — record which state applied
//!   alongside any published number.
//! - `below_threshold_prose`: a payload under every byte threshold —
//!   the cost of the gate itself, i.e. the overhead every small block
//!   pays whether or not compression ever fires.
//!
//! Deliberately NOT wired into CI — benchmarks in shared CI runners
//! generate noise, not signal. Run manually:
//!
//! ```text
//! cargo bench -p headroom-core --bench live_zone_dispatch
//! ```
//!
//! # Windows: `ORT_DYLIB_PATH`
//!
//! On Windows with a warm model cache, ONNX Runtime's shared-library
//! resolution can deadlock inside `ort` init unless `ORT_DYLIB_PATH`
//! points at the onnxruntime library (see
//! `docs/content/docs/troubleshooting.mdx`, "Windows ML DLL" entry). A
//! hung benchmark is strictly worse than a refused one, so on Windows
//! this harness exits early with instructions when the variable is
//! missing AND the Kompress model cache is warm — the only state where
//! the hang is reachable. Cache-cold it proceeds (no ONNX session is
//! ever created; the plain_text case then measures the deterministic
//! no-op path, a valid mode in its own right). Other platforms resolve
//! the library normally and are not gated.

use std::hint::black_box;

use criterion::{criterion_group, Criterion, Throughput};
use headroom_core::transforms::live_zone::DEFAULT_MODEL;
use headroom_core::transforms::{compress_anthropic_live_zone, AuthMode};
use serde_json::json;

/// Build the standard single-`tool_result` Anthropic body around `text`
/// — the same shape the dispatch integration tests use (duplicated, not
/// shared: benches and integration tests are independent targets).
fn body_with_tool_result(text: &str) -> Vec<u8> {
    serde_json::to_vec(&json!({
        "model": "claude-sonnet-4-6",
        "max_tokens": 64,
        "system": "you are a helpful assistant",
        "messages": [{
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": "toolu_dispatch_bench",
                "content": text,
            }],
        }],
    }))
    .expect("bench body serializes")
}

/// Syntactically valid Python that detects as `SourceCode`, sized to at
/// least `target_bytes`. Same generator style as the dispatch tests'
/// `python_module_source`, parameterized by byte target instead of
/// function count so the two size cases are explicit at the call site.
fn python_source(target_bytes: usize) -> String {
    let mut code = String::from(
        "\"\"\"Example data-processing module used by the dispatch bench.\"\"\"\n\n\
         import json\nimport os\nfrom typing import Any, Optional\n\n\n",
    );
    let mut i = 0usize;
    while code.len() < target_bytes {
        code.push_str(&format!(
            "def process_record_{i}(record: dict) -> dict:\n    \
             \"\"\"Normalize record {i} and compute its derived fields.\"\"\"\n    \
             result = dict(record)\n    \
             result[\"index\"] = {i}\n    \
             result[\"doubled\"] = record.get(\"value\", 0) * 2\n    \
             result[\"source\"] = \"batch\"\n    \
             if result[\"doubled\"] > 100:\n        \
             result[\"flag\"] = \"high\"\n    \
             else:\n        \
             result[\"flag\"] = \"low\"\n    \
             return result\n\n\n"
        ));
        i += 1;
    }
    code
}

/// Varied natural-language prose that detects as `PlainText`, sized to
/// at least `target_bytes`. Sentence shape varies so this is prose to
/// the detector, not a single repeated token run.
fn prose(target_bytes: usize) -> String {
    const WORDS: &[&str] = &[
        "the",
        "release",
        "shipped",
        "after",
        "review",
        "and",
        "every",
        "service",
        "reported",
        "healthy",
        "metrics",
        "while",
        "operators",
        "watched",
        "dashboards",
        "during",
        "rollout",
        "windows",
        "before",
        "traffic",
        "returned",
        "to",
        "baseline",
        "levels",
        "overnight",
    ];
    let mut text = String::with_capacity(target_bytes + 64);
    let mut in_sentence = 0u32;
    for (n, word) in WORDS.iter().cycle().enumerate() {
        if text.len() >= target_bytes {
            break;
        }
        text.push_str(word);
        in_sentence += 1;
        // Vary sentence length between 7 and 12 words.
        if in_sentence >= 7 + (n as u32 % 6) {
            text.push_str(".\n");
            in_sentence = 0;
        } else {
            text.push(' ');
        }
    }
    text
}

fn dispatch(body: &[u8]) {
    let outcome = compress_anthropic_live_zone(body, 0, AuthMode::Payg, DEFAULT_MODEL)
        .expect("dispatcher returns Ok on valid bodies");
    black_box(outcome);
}

fn bench_dispatch(c: &mut Criterion) {
    let cases: &[(&str, Vec<u8>)] = &[
        (
            "source_code_2kb",
            body_with_tool_result(&python_source(2_200)),
        ),
        (
            "source_code_20kb",
            body_with_tool_result(&python_source(20_000)),
        ),
        ("plain_text_8kb", body_with_tool_result(&prose(8_192))),
        ("below_threshold_prose", body_with_tool_result(&prose(400))),
    ];

    // One warm-up dispatch per payload BEFORE any timed group, so
    // process-latched one-time costs (compressor singletons, the
    // Kompress `OnceLock` init and — cache-warm — its model load) land
    // here rather than skewing the first timed case.
    for (_, body) in cases {
        dispatch(body);
    }

    let mut group = c.benchmark_group("live_zone/dispatch");
    // The Kompress arm runs a real ONNX inference per iteration when
    // the model is cache-resident; keep sampling time bounded.
    group.sample_size(30);
    for (name, body) in cases {
        group.throughput(Throughput::Bytes(body.len() as u64));
        group.bench_function(*name, |b| b.iter(|| dispatch(black_box(body))));
    }
    group.finish();
}

/// Refuse to run on Windows without `ORT_DYLIB_PATH` — but only when the
/// hang it guards against is actually reachable. The `ort`-init deadlock
/// needs a warm Kompress model cache: cache-cold, `Kompress::from_cache`
/// resolves `Ok(None)` before any ONNX session exists, no `ort` code
/// runs, and the cache-cold measurement mode the module doc advertises
/// is perfectly safe — refusing it would block a legitimate
/// configuration to guard against a hang it cannot have. A hung
/// benchmark process gives no diagnostic; this message does.
#[cfg(windows)]
fn check_ort_dylib_path() {
    match std::env::var("ORT_DYLIB_PATH") {
        Ok(v) if !v.trim().is_empty() => {}
        _ if !kompress_model_cached() => {
            eprintln!(
                "live_zone_dispatch bench: ORT_DYLIB_PATH is not set, but the \
                 Kompress model cache is cold — no ONNX session will be \
                 created, so the Windows ort-init hang cannot occur. \
                 Proceeding in cache-cold mode (the plain_text case measures \
                 the deterministic no-op path)."
            );
        }
        _ => {
            eprintln!(
                "live_zone_dispatch bench: ORT_DYLIB_PATH is not set.\n\n\
                 On Windows with a warm Kompress model cache, ONNX Runtime's\n\
                 shared-library resolution can deadlock during `ort` init (see\n\
                 docs/content/docs/troubleshooting.mdx), which would hang the\n\
                 plain_text bench case indefinitely. Set ORT_DYLIB_PATH to the\n\
                 onnxruntime shared library and re-run, e.g.:\n\n  \
                 ORT_DYLIB_PATH=C:\\path\\to\\onnxruntime.dll cargo bench \
                 -p headroom-core --bench live_zone_dispatch\n\n\
                 Refusing to start rather than risk a silent hang."
            );
            std::process::exit(2);
        }
    }
}

/// Whether the Kompress model is cache-resident, asked of the loader
/// itself. A hand-rolled probe would have to mirror
/// `Kompress::from_cache`'s root and artifact resolution and would go
/// stale silently; this cannot.
#[cfg(all(windows, feature = "ml"))]
fn kompress_model_cached() -> bool {
    use headroom_core::transforms::kompress::{Kompress, KompressConfig};

    matches!(Kompress::from_cache(KompressConfig::default()), Ok(Some(_)))
}

/// Without the `ml` feature there is no ONNX session to deadlock on.
#[cfg(all(windows, not(feature = "ml")))]
fn kompress_model_cached() -> bool {
    false
}

criterion_group!(benches, bench_dispatch);

fn main() {
    #[cfg(windows)]
    check_ort_dylib_path();
    benches();
    Criterion::default().configure_from_args().final_summary();
}

```

### Core Architecture Module: `crates/headroom-core/benches/tokenizer.rs`
```
//! Throughput benchmark for `headroom_core::tokenizer`.
//!
//! Measures the tiktoken-rs–backed counter on a small / medium / large input.
//! Used as a baseline; future stages can compare against this to catch
//! regressions when we change tokenizer backends or add caching layers.

use std::hint::black_box;

use criterion::{criterion_group, criterion_main, BatchSize, Criterion, Throughput};
use headroom_core::tokenizer::{TiktokenCounter, Tokenizer};

fn bench_count_text(c: &mut Criterion) {
    let counter = TiktokenCounter::for_model("gpt-4o-mini").expect("init");

    // Small: a typical short prompt.
    let small = "Reply with exactly: PONG";
    // Medium: a typical chat turn (~1KB).
    let medium = "the quick brown fox jumps over the lazy dog\n".repeat(25);
    // Large: a long context (~64KB) — stresses BPE inner loops.
    let large = "the quick brown fox jumps over the lazy dog\n".repeat(1500);

    let mut group = c.benchmark_group("tokenizer/count_text");
    group.throughput(Throughput::Bytes(small.len() as u64));
    group.bench_function("small", |b| {
        b.iter_batched(
            || small,
            |s| black_box(counter.count_text(s)),
            BatchSize::SmallInput,
        )
    });

    group.throughput(Throughput::Bytes(medium.len() as u64));
    group.bench_function("medium", |b| {
        b.iter_batched(
            || medium.as_str(),
            |s| black_box(counter.count_text(s)),
            BatchSize::SmallInput,
        )
    });

    group.throughput(Throughput::Bytes(large.len() as u64));
    group.bench_function("large", |b| {
        b.iter_batched(
            || large.as_str(),
            |s| black_box(counter.count_text(s)),
            BatchSize::SmallInput,
        )
    });

    group.finish();
}

criterion_group!(benches, bench_count_text);
criterion_main!(benches);

```

### Core Architecture Module: `crates/headroom-core/examples/bm25_query_prep_parity.rs`
```
//! Dump BM25 scores, rankings and matched terms so the query-preparation
//! change can be diffed byte-for-byte against its baseline.
//!
//! Scores print as raw IEEE-754 bits, not decimals: the change alters when
//! query terms are ordered, not the order itself, so accumulation must stay
//! bit-identical rather than merely close.
//!
//! `cargo run --release --example bm25_query_prep_parity > out.txt` on each
//! side, then `diff`.

use headroom_core::relevance::{BM25Scorer, RelevanceScorer};

/// xorshift64*, so both sides generate the identical corpus without
/// depending on a rand version.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        x.wrapping_mul(0x2545_F491_4F6C_DD1D)
    }

    fn below(&mut self, n: u64) -> u64 {
        if n == 0 {
            0
        } else {
            self.next() % n
        }
    }
}

const VOCAB: [&str; 16] = [
    "handler",
    "parse",
    "timeout",
    "cache",
    "retry",
    "index",
    "error",
    "550e8400-e29b-41d4-a716-446655440000",
    "9f8e7d6c-1234-4321-abcd-0123456789ab",
    "12345",
    "987654",
    "a",
    "zz",
    "Mixed_Case_Token",
    "UPPER",
    "repeated",
];

fn text(rng: &mut Rng, words: usize) -> String {
    let mut parts: Vec<&str> = Vec::with_capacity(words);
    for _ in 0..words {
        parts.push(VOCAB[rng.below(VOCAB.len() as u64) as usize]);
    }
    parts.join(" ")
}

fn dump(name: &str, scorer: &BM25Scorer, items: &[String], context: &str) {
    let refs: Vec<&str> = items.iter().map(|s| s.as_str()).collect();
    let batch = scorer.score_batch(&refs, context);

    println!(
        "===== {name} (n={}, context={:?}) =====",
        items.len(),
        context
    );
    for (i, s) in batch.iter().enumerate() {
        // Raw bits: a reordered summation would change these even when the
        // rounded decimal looks identical.
        println!(
            "  batch[{i}] bits={:016x} reason={:?} matched={:?}",
            s.score.to_bits(),
            s.reason,
            s.matched_terms
        );
    }

    // Ranking is what callers actually consume, so compare it explicitly.
    let mut ranked: Vec<usize> = (0..batch.len()).collect();
    ranked.sort_by(|a, b| {
        batch[*b]
            .score
            .partial_cmp(&batch[*a].score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.cmp(b))
    });
    println!("  ranking={ranked:?}");

    // The single-item path shares bm25_score, so verify it agrees with the
    // batch path item for item (reasons and caps differ by design).
    for (i, item) in items.iter().enumerate().take(20) {
        let single = scorer.score(item, context);
        println!(
            "  single[{i}] bits={:016x} reason={:?} matched={:?}",
            single.score.to_bits(),
            single.reason,
            single.matched_terms
        );
    }
    println!();
}

fn main() {
    let scorer = BM25Scorer::default();
    let unnormalized = BM25Scorer::new(1.5, 0.75, false, 10.0);
    let tuned = BM25Scorer::new(0.5, 0.0, true, 3.0);

    // Degenerate shapes first.
    dump("empty-batch", &scorer, &[], "error handler");
    dump("empty-context", &scorer, &["error here".into()], "");
    dump(
        "empty-docs",
        &scorer,
        &[String::new(), String::new()],
        "error",
    );
    dump("single-doc", &scorer, &["error handler".into()], "error");
    dump(
        "no-overlap",
        &scorer,
        &["aaa bbb ccc".into(), "ddd eee".into()],
        "zzz yyy",
    );

    // Repeated query terms: query frequency > 1 multiplies each term score,
    // so a dropped or double-counted key shows up immediately.
    dump(
        "repeated-query-terms",
        &scorer,
        &[
            "error error handler".into(),
            "handler parse".into(),
            "error".into(),
        ],
        "error error error handler",
    );

    // Exact ties: identical documents must keep identical scores and a
    // stable ranking.
    dump(
        "exact-ties",
        &scorer,
        &vec!["error handler parse".to_string(); 6],
        "error parse",
    );

    // Long tokens trip the >=8 char bonus in finalize_score.
    dump(
        "long-token-bonus",
        &scorer,
        &[
            "550e8400-e29b-41d4-a716-446655440000 tail".into(),
            "short a b".into(),
        ],
        "550e8400-e29b-41d4-a716-446655440000 short",
    );

    // Vary document count and query length across configs.
    for (label, s) in [
        ("default", &scorer),
        ("unnormalized", &unnormalized),
        ("tuned", &tuned),
    ] {
        for docs in [1usize, 2, 17, 64, 250] {
            for query_words in [1usize, 4, 32] {
                let mut rng = Rng(0x9E37_79B9_7F4A_7C15 ^ (docs as u64) << 8 ^ query_words as u64);
                let items: Vec<String> = (0..docs)
                    .map(|_| {
                        let words = 1 + rng.below(40) as usize;
                        text(&mut rng, words)
                    })
                    .collect();
                let context = text(&mut rng, query_words);
                dump(
                    &format!("{label}-d{docs}-q{query_words}"),
                    s,
                    &items,
                    &context,
                );
            }
        }
    }
}

```

### Core Architecture Module: `crates/headroom-core/src/auth_mode.rs`
```
//! Auth-mode classifier — Phase F PR-F1.
//!
//! A single pure function turns the inbound request `HeaderMap` into one
//! of three classes that drive every downstream compression / cache /
//! header policy decision:
//!
//! - [`AuthMode::Payg`]: caller pays per token (Anthropic API key,
//!   OpenAI `sk-...`, Gemini `x-goog-api-key`, x-api-key). Aggressive
//!   compression saves them money — turn it all on.
//! - [`AuthMode::OAuth`]: caller is on a fixed-cost subscription / IAM
//!   plan (Claude Pro OAuth, Codex Enterprise, Cursor Pro, Bedrock
//!   IAM-signed downstream, Vertex ADC). Per-token cost is opaque to
//!   them; cache-safety is paramount because OAuth scopes pin to
//!   `(account, model, session)` and beta-header drift voids them.
//! - [`AuthMode::Subscription`]: caller is a UX-bound CLI / IDE
//!   (Claude Code, ChatGPT Plus, Cursor, Copilot, Antigravity).
//!   Provider rate-limits by request count; programmatic-fingerprint
//!   detection means we MUST look like the upstream agent (preserve
//!   `User-Agent`, never inject `X-Headroom-*`, never strip
//!   `accept-encoding`).
//!
//! See `~/.claude/projects/.../memory/project_auth_mode_compression_nuances.md`
//! for the user-decision rationale (2026-05-01).
//!
//! The classifier is **pure** (no I/O, no allocation beyond a single
//! lowercase copy of the User-Agent), runs in <10us per call, and
//! NEVER panics on malformed headers — non-UTF-8 values fall through to
//! the safe default [`AuthMode::Payg`] with a `tracing::warn!` event so
//! operators can spot bad clients in the log stream without taking the
//! proxy down.

use http::HeaderMap;

/// Three auth-mode classes Headroom routes compression policy through.
///
/// `Copy` because the value is passed through dozens of compression
/// decisions per request; cloning a 1-byte enum is cheaper than holding
/// a reference across `await` points. `Hash + Eq` so it can key the
/// per-tenant TOIN aggregation map (Phase F PR-F3).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AuthMode {
    /// Pay-as-you-go API key. Aggressive live-zone compression OK.
    Payg,
    /// OAuth bearer / Bedrock IAM / Vertex ADC. Passthrough-prefer:
    /// no auto-`cache_control`, no auto-`prompt_cache_key`, no lossy
    /// compressors. Lossless-only path.
    OAuth,
    /// Subscription-bound CLI / IDE. Stealth: same as OAuth +
    /// preserve `accept-encoding`, never strip; never inject
    /// `X-Headroom-*`; never mutate `User-Agent`.
    Subscription,
}

impl AuthMode {
    /// Lower-snake-case label suitable for structured-log fields and
    /// metric labels. Stable wire format — Python parity tests check
    /// this exact string.
    pub fn as_str(self) -> &'static str {
        match self {
            AuthMode::Payg => "payg",
            AuthMode::OAuth => "oauth",
            AuthMode::Subscription => "subscription",
        }
    }
}

/// User-Agent prefixes that identify a UX-bound CLI / IDE.
///
/// Lives at module scope (not inside `classify`) so:
/// 1. The compiler can constant-fold the slice into the rodata segment.
/// 2. A future PR can swap this for a configurable list (Phase F
///    follow-up) without touching the function body.
/// 3. Adding a new client = one-line edit here, no logic change.
///
/// Match is `str::contains` against a lowercased copy of the UA — so
/// the prefix can appear anywhere in the value (Anthropic CLIs prefix
/// their own UA with the parent agent's UA in some cases).
const SUBSCRIPTION_UA_PREFIXES: &[&str] = &[
    "claude-cli/",
    "claude-code/",
    "codex-cli/",
    "cursor/",
    "claude-vscode/",
    "github-copilot/",
    "anthropic-cli/",
    "antigravity/",
];

/// Classify the auth mode of an inbound request from its headers.
///
/// Decision order (most-specific signal wins):
///
/// 1. **Subscription UA prefix** → [`AuthMode::Subscription`].
///    The CLI's own auth-mode wins over the bearer token shape it
///    happens to be carrying — a Claude Code session uses a
///    `sk-ant-oat*` token but is a subscription client, not OAuth.
/// 2. **`Authorization: Bearer sk-ant-oat*`** → [`AuthMode::OAuth`]
///    (Claude Pro / Max OAuth). Checked before the broader `sk-` PAYG
///    rule because `sk-ant-oat` shares the `sk-` prefix.
/// 3. **`Authorization: Bearer sk-ant-api*` or `Bearer sk-*`** →
///    [`AuthMode::Payg`] (Anthropic / OpenAI API key).
/// 4. **`Authorization: Bearer <jwt>`** (3 dot-separated segments) →
///    [`AuthMode::OAuth`] (Codex / Cursor / Copilot OAuth).
/// 5. **`Authorization` present but not `Bearer ...`** →
///    [`AuthMode::OAuth`] (AWS SigV4 `AWS4-HMAC-SHA256 ...` →
///    Bedrock; any other non-Bearer scheme is presumed
///    passthrough-prefer too).
/// 6. **`x-api-key` present** → [`AuthMode::Payg`] (Anthropic API key
///    style).
/// 7. **`x-goog-api-key` present** → [`AuthMode::Payg`] (Gemini key).
/// 8. **Default** → [`AuthMode::Payg`] (safest default; aggressive
///    compression on a misclassified request just costs us a re-run,
///    not a revoked subscription).
///
/// # Performance
///
/// One owned `String` allocation for the lowercase UA copy. All other
/// matches are zero-allocation `str::starts_with` / `str::contains` /
/// `str::split('.').count()`. Bench at
/// `crates/headroom-core/benches/auth_mode.rs` asserts <10us / call.
pub fn classify(headers: &HeaderMap) -> AuthMode {
    // ── User-Agent ───────────────────────────────────────────────
    // Subscription clients identify by UA prefix; this is the most
    // specific signal because the same OAuth token shape appears in
    // both Claude Pro (web) and Claude Code (CLI), and only the UA
    // tells them apart. Read once, lowercase once.
    let ua_owned = match headers.get("user-agent") {
        Some(value) => match value.to_str() {
            Ok(s) => s.to_ascii_lowercase(),
            Err(_) => {
                tracing::warn!(
                    event = "auth_mode_classify_unparseable_user_agent",
                    "non-UTF-8 user-agent header; falling through to bearer-token classification"
                );
                String::new()
            }
        },
        None => String::new(),
    };
    if SUBSCRIPTION_UA_PREFIXES
        .iter()
        .any(|prefix| ua_owned.contains(prefix))
    {
        return AuthMode::Subscription;
    }

    // ── Authorization header ─────────────────────────────────────
    // We must NOT log the value. `to_str` returns an `&str` with the
    // same lifetime as the `HeaderMap`, so no copy here.
    let auth = match headers.get("authorization") {
        Some(value) => match value.to_str() {
            Ok(s) => s,
            Err(_) => {
                tracing::warn!(
                    event = "auth_mode_classify_unparseable_authorization",
                    "non-UTF-8 authorization header; falling back to default Payg"
                );
                ""
            }
        },
        None => "",
    };

    if let Some(token) = auth.strip_prefix("Bearer ") {
        // Order matters: the OAuth shape `sk-ant-oat*` shares a
        // prefix with `sk-ant-api*` only at `sk-ant-`, so we check
        // the OAuth shape FIRST. Real OAuth access tokens are
        // `sk-ant-oat01-...` (version number, no dash after `oat`).
        if token.starts_with("sk-ant-oat") {
            return AuthMode::OAuth;
        }
        if token.starts_with("sk-ant-api") || token.starts_with("sk-") {
            return AuthMode::Payg;
        }
        // JWT: classic three-segment `header.payload.signature`.
        // We don't validate the JWT — just count dot-separated
        // segments. This catches Codex / Cursor / Copilot OAuth.
        if token.split('.').count() >= 3 {
            return AuthMode::OAuth;
        }
        // Unknown bearer shape — fall through to header-based
        // detection below; ultimately defaults to Payg.
    } else if !auth.is_empty() {
        // Authorization is present but NOT `Bearer ...` — most
        // commonly AWS SigV4 (`AWS4-HMAC-SHA256 ...`) on a Bedrock
        // request, or a `Basic ...` from a custom proxy chain. We
        // treat all such non-Bearer schemes as passthrough-prefer.
        // The IAM / signed flow is opaque to us; we never strip or
        // mutate the value — just classify the policy.
        return AuthMode::OAuth;
    }

    // ── Vendor-specific API-key headers ──────────────────────────
    // Anthropic API-key style. Direct PAYG; same compression policy
    // as a `Bearer sk-ant-api...`.
    if headers.contains_key("x-api-key") {
        return AuthMode::Payg;
    }
    // Gemini API key. Same PAYG semantics.
    if headers.contains_key("x-goog-api-key") {
        return AuthMode::Payg;
    }

    // ── Default ──────────────────────────────────────────────────
    // Anything else: assume PAYG. Misclassifying a non-PAYG client
    // as PAYG only over-compresses; under-compressing a PAYG client
    // would leave money on the table, which is worse for the
    // OSS-default user.
    AuthMode::Payg
}

#[cfg(test)]
mod inline_tests {
    //! Smoke tests inlined alongside the function so `cargo test -p
    //! headroom-core --lib` exercises the helper without pulling in
    //! the integration-test binary. The exhaustive test matrix lives
    //! in `crates/headroom-core/tests/auth_mode.rs`.

    use super::*;
    use http::HeaderValue;

    #[test]
    fn enum_as_str_is_stable() {
        // Python parity tests assert these exact strings.
        assert_eq!(AuthMode::Payg.as_str(), "payg");
        assert_eq!(AuthMode::OAuth.as_str(), "oauth");
        assert_eq!(AuthMode::Subscription.as_str(), "subscription");
    }

    #[test]
    fn empty_headers_default_to_payg() {
        // No Authorization, no x-api-key, no x-goog-api-key, no UA →
        // safest default is PAYG. The bedrock OAuth branch fires only
        // when there's a positive non-Bearer Authorization signal.
        let he
```

### Core Architecture Module: `crates/headroom-core/src/cache_control.rs`
```
//! Customer `cache_control` marker walker for Anthropic `/v1/messages`
//! request bodies.
//!
//! # Why this exists
//!
//! Anthropic prompt caching pins a prefix of the request: every block
//! up to and including the last `cache_control` marker is part of
//! the cache key. The provider returns `cache_read_input_tokens` for
//! that prefix on subsequent requests; that's the customer's primary
//! lever for cost reduction.
//!
//! Headroom's compressor must **never** modify any byte that's part
//! of that prefix — doing so changes the cache key, drops the hit
//! rate to 0, and silently torches the customer's bill. Phase A
//! lockdown PR-A1 made `/v1/messages` a passthrough so we couldn't
//! cause this damage; PR-A4 (this module) computes the floor below
//! which Phase B's live-zone dispatcher must not touch.
//!
//! # Contract
//!
//! For an Anthropic request body parsed into `serde_json::Value`,
//! [`compute_frozen_count`] returns the smallest `N` such that
//! `messages[i]` is in the cache hot zone for every `i < N`.
//! Specifically:
//!
//! - For each marker found in `messages[i].content[*].cache_control`,
//!   the function bumps `frozen_count` to at least `i + 1`. The "+1"
//!   makes the floor exclusive: `messages[i]` itself is part of the
//!   cached prefix, so it's frozen.
//! - For markers in `system` (string OR block list) or `tools[*]`,
//!   the function does NOT bump `frozen_count`. Those fields are
//!   unconditionally part of the cache hot zone (see invariant I2 in
//!   `REALIGNMENT/02-architecture.md` §2.2); they're never touched by
//!   the compressor regardless of marker placement, so they don't
//!   affect the message-index floor.
//! - Returns `0` when there are no markers anywhere in `messages[*]`.
//!
//! # Why no regex
//!
//! Per the realignment build constraints
//! (`feedback_realignment_build_constraints.md` rule 3), pattern
//! detection uses parsers, not regex. We walk the parsed JSON tree
//! via `serde_json` accessors only — that's both safer (no
//! pattern-string typo risk) and faster (no compilation cost on
//! the hot path).
//!
//! # TTL ordering
//!
//! Per the Anthropic prompt-caching guide §2.19, when both `5m` and
//! `1h` markers appear, `1h` markers must precede `5m`. We compute
//! `frozen_count` correctly regardless of ordering, but emit a
//! `tracing::warn!` for the operator's benefit when the customer's
//! request violates the rule. We do NOT reject the request: it's the
//! customer's choice to make and Anthropic itself accepts both
//! orderings (just with potentially-suboptimal cache eviction).
//!
//! # Source priority
//!
//! Configurable on/off via `Config::cache_control_auto_frozen`
//! (CLI flag `--cache-control-auto-frozen` / env var
//! `HEADROOM_PROXY_CACHE_CONTROL_AUTO_FROZEN`). When `disabled`, the
//! caller bypasses [`compute_frozen_count`] entirely and treats every
//! message as live-zone. The function itself is config-agnostic; the
//! gate lives in the caller (the live-zone dispatcher in Phase B).

use serde_json::Value;

/// TTL marker value for the Anthropic 1-hour cache extension.
///
/// Per guide §2.19, the literal string `"1h"` selects the hour-long
/// ephemeral cache lane. We keep the constant here (rather than
/// inlining `"1h"` literal at use sites) so any future rename or
/// case-change is a single-edit affair. Avoiding magic strings is
/// rule 2 of the realignment build constraints.
const CACHE_TTL_1H: &str = "1h";

/// TTL marker value for the Anthropic 5-minute cache lane (the
/// default). Matches `cache_control.ttl == "5m"` literal.
const CACHE_TTL_5M: &str = "5m";

/// Walk the parsed Anthropic request body and return the smallest
/// `frozen_message_count` that respects every customer-set
/// `cache_control` marker.
///
/// # Arguments
///
/// - `parsed`: the request body as a `serde_json::Value`. The walker
///   reads `parsed.get("messages")`, `parsed.get("system")`, and
///   `parsed.get("tools")`. Other top-level fields are ignored.
///
/// # Returns
///
/// The lowest message index `N` such that `messages[i]` is frozen
/// for every `i < N`. Specifically:
/// - `0` when no markers are found in `messages[*]` (the live-zone
///   dispatcher is then free to compress every message).
/// - `i + 1` for the highest `i` whose `messages[i].content[*]`
///   contains a `cache_control` marker.
///
/// Markers in `system` and `tools[*]` do NOT raise the message-index
/// floor (those fields are unconditionally cache-hot; see module docs).
///
/// # Logging
///
/// Emits `tracing::debug!` for every marker found. Emits
/// `tracing::warn!` for any TTL ordering violation per guide §2.19
/// (a `5m` marker preceding a `1h` marker in the same field-list).
/// Returns the correct value regardless of ordering.
pub fn compute_frozen_count(parsed: &Value) -> usize {
    // Highest message-index marker seen so far. Tracked as `Option`
    // so a missing-vs-zero state is unambiguous: `None` means "no
    // marker observed", `Some(i)` means "saw a marker on index i".
    let mut highest_message_index: Option<usize> = None;

    // Walk `messages[*]` — the only field that affects the return
    // value. We log `system` and `tools` markers below for parity
    // with the design doc, but they don't bump the floor.
    walk_messages(parsed, &mut highest_message_index);

    // Walk `system` blocks for logging + TTL-ordering check only.
    // These markers never bump `frozen_count`; the system field is
    // always part of the cache hot zone independently.
    walk_system(parsed);

    // Walk `tools[*]` blocks for logging + TTL-ordering check only.
    walk_tools(parsed);

    // Translate the highest-marker index into a frozen-count floor.
    // The "+1" makes the floor exclusive: `messages[i]` itself is
    // part of the cached prefix, so the live-zone dispatcher must
    // not touch any index up to and including `i`.
    highest_message_index.map(|i| i + 1).unwrap_or(0)
}

/// Walk `parsed.messages[*].content[*]` and update
/// `highest_message_index` for any `cache_control` marker found.
///
/// The walker tolerates two content shapes Anthropic accepts:
/// - String content: `messages[i].content` is a JSON string. No
///   block list, so no `cache_control` marker possible.
/// - Block list: `messages[i].content` is an array. Each block is
///   an object that MAY have a top-level `cache_control` field.
fn walk_messages(parsed: &Value, highest_message_index: &mut Option<usize>) {
    let Some(messages) = parsed.get("messages").and_then(Value::as_array) else {
        return;
    };

    // Track per-message-list TTL ordering: across the entire
    // messages[*].content[*] sequence, every `1h` marker must
    // precede every `5m` marker. We log a single warning if the
    // rule is violated, regardless of how many violations there are
    // — the customer just needs to know once.
    let mut ttl_walk = TtlOrderingWalk::new();

    for (i, message) in messages.iter().enumerate() {
        let Some(content) = message.get("content") else {
            continue;
        };
        let Some(blocks) = content.as_array() else {
            // String content: no block list, no markers possible.
            continue;
        };
        for block in blocks {
            if let Some(marker) = block.get("cache_control") {
                let ttl = extract_ttl(marker);
                tracing::debug!(
                    field = "messages",
                    message_index = i,
                    ttl = ttl.as_deref().unwrap_or("default"),
                    "cache_control marker found"
                );
                ttl_walk.observe(ttl.as_deref());
                // Bump the floor.
                *highest_message_index = Some(match highest_message_index {
                    Some(prev) => (*prev).max(i),
                    None => i,
                });
            }
        }
    }

    ttl_walk.warn_if_violated("messages");
}

/// Walk `parsed.system` for `cache_control` markers. Logs at
/// `tracing::debug!` per marker; emits TTL-ordering warning. Does NOT
/// affect `frozen_count` — the system field is unconditionally
/// cache-hot.
///
/// `system` may be a string (no markers possible) or an array of
/// blocks. Mirrors the `messages[*].content` shape rules.
fn walk_system(parsed: &Value) {
    let Some(system) = parsed.get("system") else {
        return;
    };
    let Some(blocks) = system.as_array() else {
        // String system prompt: no block list, no markers.
        return;
    };
    let mut ttl_walk = TtlOrderingWalk::new();
    for block in blocks {
        if let Some(marker) = block.get("cache_control") {
            let ttl = extract_ttl(marker);
            tracing::debug!(
                field = "system",
                ttl = ttl.as_deref().unwrap_or("default"),
                "cache_control marker found"
            );
            ttl_walk.observe(ttl.as_deref());
        }
    }
    ttl_walk.warn_if_violated("system");
}

/// Walk `parsed.tools[*].cache_control` markers. Logs at
/// `tracing::debug!`; emits TTL-ordering warning. Does NOT affect
/// `frozen_count` — `tools` is unconditionally cache-hot.
fn walk_tools(parsed: &Value) {
    let Some(tools) = parsed.get("tools").and_then(Value::as_array) else {
        return;
    };
    let mut ttl_walk = TtlOrderingWalk::new();
    for (i, tool) in tools.iter().enumerate() {
        if let Some(marker) = tool.get("cache_control") {
            let ttl = extract_ttl(marker);
            tracing::debug!(
                field = "tools",
                tool_index = i,
                ttl = ttl.as_deref().unwrap_or("default"),
                "cache_control marker found"
            );
            ttl_walk.observe(ttl.as_deref());
        }
    }
    ttl_walk.warn_if_violated("tools");
}

/// Pull the optional `ttl` string out of a `cache_control` marker.
///
/// The marker is shaped `{"type": "ephemeral", "ttl": "1h"}` — the
/// `type` field i
```

### Core Architecture Module: `crates/headroom-core/src/ccr/backends/in_memory.rs`
```
//! In-memory CCR backend.
//!
//! Process-local store backed by [`DashMap`] (sharded concurrent hash
//! map). Distinct keys never contend on the read path; capacity-bound
//! eviction is the only globally-serialized step.
//!
//! This is the **test-default** backend. Production deployments use
//! [`super::sqlite::SqliteCcrStore`] or [`super::redis::RedisCcrStore`]
//! which are persistent across worker restarts and shareable across
//! workers (see `RUST_DEV.md` "Multi-worker deployment").

use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use dashmap::DashMap;

use crate::ccr::{max_lifetime_for, CcrStore, DEFAULT_CAPACITY, DEFAULT_TTL};

/// In-memory CCR store backed by [`DashMap`] for sharded concurrent
/// access.
///
/// - **TTL**: 30 minutes by default, treated as an **idle window** —
///   every successful `get` restarts the entry's clock (#2604), bounded
///   by an absolute max lifetime of 8x the idle TTL measured from
///   insertion. Entries past their window are dropped on the next `get`
///   (lazy expiry — no background reaper thread).
/// - **Capacity**: 1000 entries by default. When `put` would push us
///   past capacity, the oldest entry (per insertion order) is evicted.
/// - **Concurrency**: gets and puts on distinct keys do not contend.
///   The only serialization point is the insertion-order queue used
///   for capacity eviction; that mutex is held for an O(1) push or a
///   small sweep.
pub struct InMemoryCcrStore {
    map: DashMap<String, Entry>,
    /// FIFO insertion order. Stale entries (already removed from `map`
    /// via TTL expiry) are tolerated — `pop_front` + `map.remove` is a
    /// no-op for missing keys, and capacity-bounded sweeps loop until
    /// they actually evict a real entry.
    order: Mutex<VecDeque<String>>,
    ttl: Duration,
    max_lifetime: Duration,
    capacity: usize,
}

#[derive(Clone)]
struct Entry {
    payload: String,
    inserted: Instant,
    last_accessed: Instant,
}

impl Entry {
    /// Expired when idle past `ttl` OR older (since insertion) than
    /// `max_lifetime` — the absolute ceiling that keeps constant access
    /// from pinning an entry forever.
    fn is_expired(&self, ttl: Duration, max_lifetime: Duration) -> bool {
        self.last_accessed.elapsed() > ttl || self.inserted.elapsed() > max_lifetime
    }
}

impl InMemoryCcrStore {
    /// Default: 1000 entries, 30-minute idle TTL (8x max lifetime).
    pub fn new() -> Self {
        Self::with_capacity_and_ttl(DEFAULT_CAPACITY, DEFAULT_TTL)
    }

    /// `ttl` is the idle window; the absolute max lifetime defaults to
    /// 8x that (see [`crate::ccr::DEFAULT_MAX_LIFETIME_MULTIPLIER`]).
    pub fn with_capacity_and_ttl(capacity: usize, ttl: Duration) -> Self {
        Self::with_capacity_and_ttls(capacity, ttl, max_lifetime_for(ttl))
    }

    /// Full-control constructor: idle window and absolute max lifetime
    /// specified independently.
    pub fn with_capacity_and_ttls(capacity: usize, ttl: Duration, max_lifetime: Duration) -> Self {
        Self {
            map: DashMap::with_capacity(capacity),
            order: Mutex::new(VecDeque::with_capacity(capacity)),
            ttl,
            max_lifetime,
            capacity,
        }
    }

    /// Sweep the order queue, dropping leading entries that no longer
    /// exist in the map (already expired or evicted), then evict
    /// real entries until `map.len() < capacity`. Called only from
    /// `put` on a fresh-key insert path.
    fn evict_until_under_capacity(&self) {
        let mut guard = self.order.lock().expect("ccr order mutex poisoned");
        while self.map.len() >= self.capacity {
            let Some(oldest) = guard.pop_front() else {
                break;
            };
            // `remove` is a no-op if `oldest` was already lazy-expired.
            // Loop continues until we actually shrink the map.
            self.map.remove(&oldest);
        }
    }
}

impl Default for InMemoryCcrStore {
    fn default() -> Self {
        Self::new()
    }
}

impl CcrStore for InMemoryCcrStore {
    fn put(&self, hash: &str, payload: &str) {
        // Idempotent re-store fast-path: same hash → overwrite payload
        // in place, leave the order queue alone. Common when the same
        // tool output flows through multiple times in a session.
        if let Some(mut existing) = self.map.get_mut(hash) {
            let now = Instant::now();
            existing.payload = payload.to_string();
            existing.inserted = now;
            existing.last_accessed = now;
            return;
        }

        // New entry. Cap-bound first (may sweep a few stale order
        // entries), then insert and append to the FIFO queue.
        if self.map.len() >= self.capacity {
            self.evict_until_under_capacity();
        }
        let now = Instant::now();
        let entry = Entry {
            payload: payload.to_string(),
            inserted: now,
            last_accessed: now,
        };
        let prev = self.map.insert(hash.to_string(), entry);
        if prev.is_none() {
            // Truly new key — record in FIFO order. (If `prev.is_some()`
            // it means another thread re-inserted between our get_mut
            // miss and this insert; treat that as a fast-path overwrite
            // and skip the queue append to avoid duplicates.)
            self.order
                .lock()
                .expect("ccr order mutex poisoned")
                .push_back(hash.to_string());
        }
    }

    fn get(&self, hash: &str) -> Option<String> {
        // Hit path: shard write-lock (get_mut), check the idle window +
        // max-lifetime ceiling, refresh `last_accessed`, clone payload
        // out. The TTL is a sliding idle window (#2604): every hit
        // restarts the clock, so an entry a session keeps touching does
        // not expire mid-burst. Distinct hashes hash to distinct shards
        // and never contend.
        //
        // Lazy expiry uses DashMap's `remove_if` so the check-and-remove
        // is atomic on the shard. An earlier 2-step (drop read lock,
        // then `remove`) had a TOCTOU race: between dropping the read
        // lock and calling `remove`, a concurrent `put()` of the same
        // hash with a fresh timestamp could land — and our `remove`
        // would then wipe that fresh entry. Under multi-worker proxy
        // load this manifested as "I just stored it; why is it gone?"
        // `remove_if` closes the window because the shard write lock
        // is held across both the predicate evaluation and the removal.
        if let Some(mut entry) = self.map.get_mut(hash) {
            if !entry.is_expired(self.ttl, self.max_lifetime) {
                entry.last_accessed = Instant::now();
                return Some(entry.payload.clone());
            }
        } else {
            return None;
        }
        // Out-of-band path: the entry exists and looks expired. Re-check
        // under the shard write lock; if it's still expired, evict.
        // Otherwise (a concurrent `put` refreshed it) leave it alone
        // and re-fetch its payload.
        let was_removed = self
            .map
            .remove_if(hash, |_, entry| {
                entry.is_expired(self.ttl, self.max_lifetime)
            })
            .is_some();
        if was_removed {
            None
        } else {
            // Concurrent refresh — return the fresh payload.
            self.map.get(hash).map(|e| e.payload.clone())
        }
    }

    fn len(&self) -> usize {
        self.map.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn put_then_get_returns_payload() {
        let store = InMemoryCcrStore::new();
        store.put("abc123", r#"[{"id":1}]"#);
        assert_eq!(store.get("abc123"), Some(r#"[{"id":1}]"#.to_string()));
    }

    #[test]
    fn missing_hash_returns_none() {
        let store = InMemoryCcrStore::new();
        assert_eq!(store.get("never_stored"), None);
    }

    #[test]
    fn put_overwrites_under_same_hash() {
        let store = InMemoryCcrStore::new();
        store.put("h", "first");
        store.put("h", "second");
        assert_eq!(store.get("h"), Some("second".to_string()));
        assert_eq!(store.len(), 1);
    }

    #[test]
    fn capacity_evicts_oldest() {
        let store = InMemoryCcrStore::with_capacity_and_ttl(2, DEFAULT_TTL);
        store.put("a", "1");
        store.put("b", "2");
        store.put("c", "3");
        assert_eq!(store.len(), 2);
        assert_eq!(store.get("a"), None);
        assert_eq!(store.get("b"), Some("2".to_string()));
        assert_eq!(store.get("c"), Some("3".to_string()));
    }

    #[test]
    fn expired_entries_are_dropped_on_get() {
        let store = InMemoryCcrStore::with_capacity_and_ttl(10, Duration::from_millis(10));
        store.put("a", "1");
        std::thread::sleep(Duration::from_millis(25));
        assert_eq!(store.get("a"), None);
        assert_eq!(store.len(), 0);
    }

    #[test]
    fn store_is_send_sync() {
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<InMemoryCcrStore>();
    }

    #[test]
    fn trait_object_is_usable() {
        let store: Box<dyn CcrStore> = Box::new(InMemoryCcrStore::new());
        store.put("h", "v");
        assert_eq!(store.get("h"), Some("v".to_string()));
        assert!(!store.is_empty());
    }

    #[test]
    fn concurrent_puts_and_gets_do_not_corrupt() {
        // Smoke test for the concurrent design — N threads each do
        // P puts and P gets against distinct keys. Every key written
        // must be readable afterwards.
        use std::sync::Arc;
        use std::thread;

        let store = Arc::new(InMemoryCcrStore::with_capacity_and_ttl(10_000, DEFAULT_TTL));
        let n_threads = 8;
        let per_thread = 200;

        let mut handles = Vec::new();
        for tid in 0..n_threads {
```

### Core Architecture Module: `crates/headroom-core/src/ccr/backends/mod.rs`
```
//! Pluggable CCR backends — in-memory (test default), SQLite (prod
//! default), Redis (multi-worker opt-in).
//!
//! Selection is driven by [`CcrBackendConfig`]. The [`from_config`]
//! factory surfaces every backend-init failure to the caller — there
//! is no silent fallback to the in-memory backend
//! (`feedback_no_silent_fallbacks.md`).

pub mod in_memory;
#[cfg(feature = "redis")]
pub mod redis;
pub mod sqlite;

use std::path::PathBuf;

use thiserror::Error;

use crate::ccr::CcrStore;

#[cfg(feature = "redis")]
pub use self::redis::RedisCcrStore;
pub use in_memory::InMemoryCcrStore;
pub use sqlite::SqliteCcrStore;

/// Operator-visible configuration for the CCR backend. Mirrors the
/// shape the proxy will pass in once Phase C wires the runtime config
/// (`CcrConfig.backend = "sqlite" | "redis" | "in_memory"`).
#[derive(Debug, Clone)]
pub enum CcrBackendConfig {
    /// In-memory (test default). Bounded LRU; lost on restart.
    InMemory { capacity: usize, ttl_seconds: u64 },
    /// SQLite-backed (prod default). DB file at `path`; persistent.
    Sqlite { path: PathBuf, ttl_seconds: u64 },
    /// Redis-backed (multi-worker opt-in). Cfg-gated; surfaces an
    /// `UnsupportedBackend` error if the feature is not compiled in.
    Redis {
        url: String,
        ttl_seconds: u64,
        /// Key prefix; defaults to `"ccr"` when `None`.
        key_prefix: Option<String>,
    },
}

impl CcrBackendConfig {
    /// Production default: SQLite at `path`, 30-minute TTL.
    pub fn sqlite_default(path: PathBuf) -> Self {
        Self::Sqlite {
            path,
            ttl_seconds: crate::ccr::DEFAULT_TTL.as_secs(),
        }
    }

    /// In-memory with library defaults. Useful in tests.
    pub fn in_memory_default() -> Self {
        Self::InMemory {
            capacity: crate::ccr::DEFAULT_CAPACITY,
            ttl_seconds: crate::ccr::DEFAULT_TTL.as_secs(),
        }
    }
}

/// Reasons `from_config` may fail. Each variant is loud and recoverable
/// at the proxy startup boundary — the operator is told exactly what
/// went wrong rather than silently degrading to in-memory.
#[derive(Debug, Error)]
pub enum CcrBackendInitError {
    /// SQLite open / schema-create failed.
    #[error("ccr sqlite backend init failed: {0}")]
    Sqlite(#[from] rusqlite::Error),
    /// Redis open / PING failed (the smoke-test in `RedisCcrStore::open`).
    #[cfg(feature = "redis")]
    #[error("ccr redis backend init failed: {0}")]
    Redis(::redis::RedisError),
    /// Operator selected a backend whose feature flag was not compiled
    /// in. Loud failure rather than silent fallback.
    #[error(
        "ccr backend `{backend}` is not compiled in; rebuild with `--features {feature}` \
         or pick a different backend"
    )]
    UnsupportedBackend {
        backend: &'static str,
        feature: &'static str,
    },
}

#[cfg(feature = "redis")]
impl From<::redis::RedisError> for CcrBackendInitError {
    fn from(err: ::redis::RedisError) -> Self {
        Self::Redis(err)
    }
}

/// Construct a CCR backend from `config`. Errors surface — never falls
/// back silently. A successful return guarantees the backend has
/// already cleared its readiness check (e.g. SQLite schema is in place,
/// Redis PING returned PONG).
pub fn from_config(config: &CcrBackendConfig) -> Result<Box<dyn CcrStore>, CcrBackendInitError> {
    match config {
        CcrBackendConfig::InMemory {
            capacity,
            ttl_seconds,
        } => {
            let store = InMemoryCcrStore::with_capacity_and_ttl(
                *capacity,
                std::time::Duration::from_secs(*ttl_seconds),
            );
            tracing::info!(
                target = "ccr.backend",
                backend = "in_memory",
                capacity = *capacity,
                ttl_seconds = *ttl_seconds,
                "ccr_backend_initialized"
            );
            Ok(Box::new(store))
        }
        CcrBackendConfig::Sqlite { path, ttl_seconds } => {
            let store = SqliteCcrStore::open(path, *ttl_seconds)?;
            tracing::info!(
                target = "ccr.backend",
                backend = "sqlite",
                path = %path.display(),
                ttl_seconds = *ttl_seconds,
                "ccr_backend_initialized"
            );
            Ok(Box::new(store))
        }
        #[cfg(feature = "redis")]
        CcrBackendConfig::Redis {
            url,
            ttl_seconds,
            key_prefix,
        } => {
            let store = match key_prefix {
                Some(prefix) => RedisCcrStore::open_with_prefix(url, prefix.clone(), *ttl_seconds)?,
                None => RedisCcrStore::open(url, *ttl_seconds)?,
            };
            tracing::info!(
                target = "ccr.backend",
                backend = "redis",
                url = %url,
                ttl_seconds = *ttl_seconds,
                "ccr_backend_initialized"
            );
            Ok(Box::new(store))
        }
        #[cfg(not(feature = "redis"))]
        CcrBackendConfig::Redis { .. } => Err(CcrBackendInitError::UnsupportedBackend {
            backend: "redis",
            feature: "redis",
        }),
    }
}

```

### Core Architecture Module: `crates/headroom-core/src/ccr/backends/redis.rs`
```
//! Redis-backed CCR store.
//!
//! Opt-in **multi-worker** backend: every worker hits the same Redis
//! instance, so no sticky-session is required at the load balancer.
//! Compiled only when the `redis` feature is enabled — production
//! deployments wanting Redis pull this in via the workspace feature
//! flag, deployments running single-worker or persistent-disk-only
//! avoid the Redis client cost.
//!
//! # Storage model
//!
//! Each entry maps to a Redis key `ccr:{hash}` containing the original
//! payload bytes, with a `SETEX` TTL applied on every write. The TTL is
//! an **idle window** (#2604): every successful `get` re-arms the key's
//! expiry, bounded by an absolute max lifetime tracked in a companion
//! `ccr:{hash}:born` key whose own expiry marks the ceiling. Redis
//! handles purging via key expiry — no application-side sweep needed
//! (matching the SQLite backend's lazy-purge but at the Redis level).
//!
//! # Concurrency
//!
//! `redis::Client` is `Send + Sync`; we hold one per store instance.
//! `get_connection` returns a fresh blocking connection per call; this
//! is the recommended pattern for short-lived puts/gets and avoids the
//! `MultiplexedConnection`'s tokio-runtime requirement (CCR is called
//! both from sync and tokio contexts in the proxy crate).

#![cfg(feature = "redis")]

use redis::Commands;

use crate::ccr::{max_lifetime_for, CcrStore};

/// Key prefix applied to every CCR entry. Configurable per-deployment
/// so multiple proxies sharing one Redis don't collide.
const DEFAULT_KEY_PREFIX: &str = "ccr";

/// Redis-backed CCR store. Cfg-gated behind `feature = "redis"`.
pub struct RedisCcrStore {
    client: redis::Client,
    key_prefix: String,
    default_ttl_seconds: u64,
    /// Absolute max lifetime (seconds since `put`) that caps the
    /// sliding idle window. Defaults to 8x the idle TTL.
    max_lifetime_seconds: u64,
}

impl RedisCcrStore {
    /// Open a Redis connection at `url` (e.g. `redis://127.0.0.1:6379`).
    /// Errors surface to the caller (`from_config`).
    pub fn open(url: &str, default_ttl_seconds: u64) -> redis::RedisResult<Self> {
        Self::open_with_prefix(url, DEFAULT_KEY_PREFIX.to_string(), default_ttl_seconds)
    }

    pub fn open_with_prefix(
        url: &str,
        key_prefix: String,
        default_ttl_seconds: u64,
    ) -> redis::RedisResult<Self> {
        let client = redis::Client::open(url)?;
        // Smoke-test the connection at startup so init failures are
        // loud (`feedback_no_silent_fallbacks.md`). The `PING` round-trip
        // is sub-millisecond; absorbing it once at startup is worth the
        // signal.
        let mut conn = client.get_connection()?;
        let _: String = redis::cmd("PING").query(&mut conn)?;
        let max_lifetime_seconds =
            max_lifetime_for(std::time::Duration::from_secs(default_ttl_seconds)).as_secs();
        Ok(Self {
            client,
            key_prefix,
            default_ttl_seconds,
            max_lifetime_seconds,
        })
    }

    fn key_for(&self, hash: &str) -> String {
        format!("{}:{}", self.key_prefix, hash)
    }

    /// Companion key whose expiry marks the entry's absolute max
    /// lifetime; its remaining TTL caps every idle-window re-arm.
    fn born_key_for(&self, hash: &str) -> String {
        format!("{}:{}:born", self.key_prefix, hash)
    }

    /// Default TTL (seconds) applied on every `put`.
    pub fn default_ttl_seconds(&self) -> u64 {
        self.default_ttl_seconds
    }
}

impl CcrStore for RedisCcrStore {
    fn put(&self, hash: &str, payload: &str) {
        let key = self.key_for(hash);
        let mut conn = match self.client.get_connection() {
            Ok(c) => c,
            Err(err) => {
                tracing::warn!(
                    target = "ccr.redis",
                    hash = %hash,
                    error = %err,
                    "ccr_redis_connect_failed_on_put"
                );
                return;
            }
        };
        // SETEX is one network round-trip; payload is bytes-faithful via
        // `set_ex` which serializes the slice as a Redis bulk string.
        let res: redis::RedisResult<()> =
            conn.set_ex(&key, payload.as_bytes(), self.default_ttl_seconds);
        if let Err(err) = res {
            tracing::warn!(
                target = "ccr.redis",
                hash = %hash,
                error = %err,
                "ccr_redis_put_failed"
            );
            return;
        }
        // Companion max-lifetime marker: its remaining TTL caps every
        // idle-window re-arm in `get`, so constant access cannot pin an
        // entry past `max_lifetime_seconds`.
        let born: redis::RedisResult<()> =
            conn.set_ex(self.born_key_for(hash), 1_u8, self.max_lifetime_seconds);
        if let Err(err) = born {
            tracing::warn!(
                target = "ccr.redis",
                hash = %hash,
                error = %err,
                "ccr_redis_put_born_failed"
            );
        }
    }

    fn get(&self, hash: &str) -> Option<String> {
        let key = self.key_for(hash);
        let mut conn = match self.client.get_connection() {
            Ok(c) => c,
            Err(err) => {
                tracing::warn!(
                    target = "ccr.redis",
                    hash = %hash,
                    error = %err,
                    "ccr_redis_connect_failed_on_get"
                );
                return None;
            }
        };
        let bytes: redis::RedisResult<Option<Vec<u8>>> = conn.get(&key);
        let payload = match bytes {
            Ok(Some(bytes)) => String::from_utf8(bytes).ok()?,
            Ok(None) => return None,
            Err(err) => {
                tracing::warn!(
                    target = "ccr.redis",
                    hash = %hash,
                    error = %err,
                    "ccr_redis_get_failed"
                );
                return None;
            }
        };

        // Sliding idle window (#2604): re-arm the key's expiry on every
        // hit, capped by the companion born-key's remaining lifetime.
        let born_key = self.born_key_for(hash);
        let born_remaining: i64 = conn.ttl(&born_key).unwrap_or(-1);
        let remaining = if born_remaining >= 0 {
            born_remaining as u64
        } else {
            // Legacy entry written by a pre-sliding build (no born key):
            // backfill the ceiling from now rather than dropping data.
            let backfill: redis::RedisResult<()> =
                conn.set_ex(&born_key, 1_u8, self.max_lifetime_seconds);
            if let Err(err) = backfill {
                tracing::warn!(
                    target = "ccr.redis",
                    hash = %hash,
                    error = %err,
                    "ccr_redis_born_backfill_failed"
                );
            }
            self.max_lifetime_seconds
        };
        let new_ttl = self.default_ttl_seconds.min(remaining);
        if new_ttl == 0 {
            // Past the max lifetime: purge rather than serve a pinned
            // entry that should have died.
            let _: redis::RedisResult<()> = conn.del(&key);
            return None;
        }
        let rearm: redis::RedisResult<()> = conn.expire(&key, new_ttl as i64);
        if let Err(err) = rearm {
            tracing::warn!(
                target = "ccr.redis",
                hash = %hash,
                error = %err,
                "ccr_redis_ttl_rearm_failed"
            );
        }
        Some(payload)
    }

    fn len(&self) -> usize {
        // Redis has no efficient global count; we'd need to KEYS-scan
        // the prefix which is O(N) and not safe in production. The
        // CcrStore::len() contract is documented as "informational; used
        // by tests + telemetry" — return 0 here. Tests for the Redis
        // backend assert get/put behavior, not len().
        0
    }
}

```

### Core Architecture Module: `crates/headroom-core/src/ccr/backends/sqlite.rs`
```
//! SQLite-backed CCR store.
//!
//! The default **production** backend: persistent across worker
//! restarts and shareable across workers via a shared DB file. Schema:
//!
//! ```sql
//! CREATE TABLE IF NOT EXISTS ccr_entries (
//!     hash          TEXT PRIMARY KEY,
//!     original      BLOB NOT NULL,
//!     created_at    INTEGER NOT NULL,   -- unix-seconds
//!     ttl_seconds   INTEGER NOT NULL,   -- idle window, restarted on get
//!     last_accessed INTEGER NOT NULL    -- unix-seconds
//! );
//! ```
//!
//! The TTL is an **idle window** (#2604): every successful `get`
//! restarts the row's clock via `last_accessed`, bounded by an absolute
//! max lifetime measured from `created_at`. On every `get` we
//! lazy-purge stale rows (`WHERE last_accessed + ttl_seconds < now OR
//! created_at + max_lifetime < now`) — no background reaper thread,
//! no cron. DBs created by pre-sliding builds are migrated in place
//! (the `last_accessed` column is added, backfilled from `created_at`).
//!
//! All hot statements are prepared once on connection setup and reused
//! per call (per realignment build constraint #5: performant). Writes
//! upsert by primary key so re-storing the same hash overwrites in
//! place (matches in-memory and Redis backend semantics).
//!
//! # Concurrency
//!
//! `rusqlite::Connection` is `!Sync`, so we wrap it in a `Mutex`. CCR
//! reads/writes are short and rare relative to the proxy hot path, so
//! a single mutex on the connection is fine. Operators who measure
//! contention can shard by spinning up N stores backed by N DB files
//! (e.g. one per worker) — multi-worker safety is provided by SQLite's
//! own file locking.
//!
//! # WAL mode
//!
//! We open the connection in WAL mode so reads do not block writes
//! (and vice versa), and the on-disk journal does not grow unbounded.
//! Critical for proxy workloads where many concurrent retrievals can
//! land while a compression flushes a fresh row.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};

use crate::ccr::{max_lifetime_for, CcrStore};

/// SQLite-backed CCR store.
pub struct SqliteCcrStore {
    conn: Mutex<Connection>,
    /// Default idle TTL applied on every `put`. Mirrors Python's
    /// `compression_store` idle window.
    default_ttl_seconds: u64,
    /// Absolute max lifetime (seconds since `created_at`) that caps the
    /// sliding idle window. Defaults to 8x the idle TTL.
    max_lifetime_seconds: u64,
    /// Path the connection was opened against — kept for diagnostics
    /// and for the proxy-restart simulation test.
    path: PathBuf,
}

impl SqliteCcrStore {
    /// Open or create the DB file at `path` and prepare the schema.
    /// `default_ttl_seconds` is the idle window; the absolute max
    /// lifetime defaults to 8x that (see
    /// [`crate::ccr::DEFAULT_MAX_LIFETIME_MULTIPLIER`]).
    /// Errors surface to the caller (`from_config`); we never silently
    /// fall back to the in-memory backend (`feedback_no_silent_fallbacks.md`).
    pub fn open(path: impl AsRef<Path>, default_ttl_seconds: u64) -> rusqlite::Result<Self> {
        let max_lifetime =
            max_lifetime_for(std::time::Duration::from_secs(default_ttl_seconds)).as_secs();
        Self::open_with_ttls(path, default_ttl_seconds, max_lifetime)
    }

    /// Full-control constructor: idle window and absolute max lifetime
    /// specified independently.
    pub fn open_with_ttls(
        path: impl AsRef<Path>,
        default_ttl_seconds: u64,
        max_lifetime_seconds: u64,
    ) -> rusqlite::Result<Self> {
        let path_buf = path.as_ref().to_path_buf();
        let conn = Connection::open(&path_buf)?;

        // WAL gives us readers-don't-block-writers. `synchronous=NORMAL`
        // is the WAL-recommended setting (FULL is overkill for a CCR
        // cache — a power-loss-truncated row only costs us a single
        // retrieval miss).
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS ccr_entries (
                 hash          TEXT PRIMARY KEY,
                 original      BLOB NOT NULL,
                 created_at    INTEGER NOT NULL,
                 ttl_seconds   INTEGER NOT NULL,
                 last_accessed INTEGER NOT NULL
             )",
            [],
        )?;
        Self::migrate_legacy_schema(&conn)?;
        // No secondary index — the schema is one-row-per-PK and the only
        // non-PK lookup (the lazy-purge sweep) is a `WHERE` predicate on
        // a small table; an index on the expiry expressions would cost
        // more than it saves.

        Ok(Self {
            conn: Mutex::new(conn),
            default_ttl_seconds,
            max_lifetime_seconds,
            path: path_buf,
        })
    }

    /// DBs created before the sliding-TTL change lack `last_accessed`.
    /// Add it in place and backfill from `created_at` so legacy rows
    /// keep their original expiry baseline rather than being purged or
    /// artificially refreshed.
    fn migrate_legacy_schema(conn: &Connection) -> rusqlite::Result<()> {
        let has_last_accessed = conn
            .prepare("SELECT 1 FROM pragma_table_info('ccr_entries') WHERE name = 'last_accessed'")?
            .exists([])?;
        if !has_last_accessed {
            conn.execute(
                "ALTER TABLE ccr_entries ADD COLUMN last_accessed INTEGER NOT NULL DEFAULT 0",
                [],
            )?;
            conn.execute(
                "UPDATE ccr_entries SET last_accessed = created_at WHERE last_accessed = 0",
                [],
            )?;
        }
        Ok(())
    }

    /// Path the connection was opened against. Test helper.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Default TTL (seconds) applied on every `put`.
    pub fn default_ttl_seconds(&self) -> u64 {
        self.default_ttl_seconds
    }

    /// Drop all expired rows: idle past their window, or past the
    /// absolute max lifetime. Lazy — invoked from `get`. Returns the
    /// number of rows purged.
    fn purge_expired(&self, conn: &Connection, now: u64) -> rusqlite::Result<usize> {
        // Timestamps have whole-second resolution. Use a strict boundary so
        // truncation can extend a cache entry by less than one second but can
        // never expire it before the configured idle or lifetime window.
        let purged = conn.execute(
            "DELETE FROM ccr_entries
             WHERE last_accessed + ttl_seconds < ?1
                OR created_at + ?2 < ?1",
            params![now as i64, self.max_lifetime_seconds as i64],
        )?;
        Ok(purged)
    }

    fn now_unix_seconds() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            // System clock before 1970 is impossible on any sane host;
            // fall through to 0 rather than panic in the unlikely case.
            .map(|d| d.as_secs())
            .unwrap_or(0)
    }

    fn get_at(&self, hash: &str, now: u64) -> Option<String> {
        let conn = self.conn.lock().expect("ccr sqlite mutex poisoned");

        // Lazy purge sweep, then the real lookup. Both happen under
        // the same mutex so the row we read is guaranteed not to have
        // been just-deleted by another caller.
        if let Err(err) = self.purge_expired(&conn, now) {
            tracing::warn!(
                target = "ccr.sqlite",
                error = %err,
                "ccr_sqlite_purge_failed"
            );
        }

        let row: Option<Vec<u8>> = conn
            .query_row(
                "SELECT original FROM ccr_entries
                 WHERE hash = ?1
                   AND last_accessed + ttl_seconds >= ?2
                   AND created_at + ?3 >= ?2",
                params![hash, now as i64, self.max_lifetime_seconds as i64],
                |r| r.get::<_, Vec<u8>>(0),
            )
            .optional()
            .unwrap_or_else(|err| {
                tracing::warn!(
                    target = "ccr.sqlite",
                    hash = %hash,
                    error = %err,
                    "ccr_sqlite_get_failed"
                );
                None
            });

        let row = row?;
        // Sliding idle window (#2604): a successful hit restarts the
        // row's idle clock. Still under the same mutex as the lookup.
        if let Err(err) = conn.execute(
            "UPDATE ccr_entries SET last_accessed = ?2 WHERE hash = ?1",
            params![hash, now as i64],
        ) {
            tracing::warn!(
                target = "ccr.sqlite",
                hash = %hash,
                error = %err,
                "ccr_sqlite_touch_failed"
            );
        }

        String::from_utf8(row).ok()
    }
}

impl CcrStore for SqliteCcrStore {
    fn put(&self, hash: &str, payload: &str) {
        let now = Self::now_unix_seconds();
        let conn = self.conn.lock().expect("ccr sqlite mutex poisoned");
        // Upsert by PK. ON CONFLICT REPLACE matches the in-memory
        // backend's idempotent re-store semantics.
        let res = conn.execute(
            "INSERT INTO ccr_entries (hash, original, created_at, ttl_seconds, last_accessed)
             VALUES (?1, ?2, ?3, ?4, ?3)
             ON CONFLICT(hash) DO UPDATE SET
                 original      = excluded.original,
                 created_at    = excluded.created_at,
                 ttl_seconds   = excluded.ttl_seconds,
                 last_accessed = excluded.last_accessed",
            params![
                hash,
                payload.as_bytes(),
                now as i64,
                self.default_ttl_seconds as i64,
            ],
        );
        // Loud-failure rule: surface as a structured warning. Caller
        // (the live-zone dispatcher) does not need a Result
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3943** (2026-10-04): **[BUG] LiteLLM backend maps upstream 400 BadRequestError to 500, breaking client retry-on-400 fallbacks**
  *Symptoms*: ## Description  The LiteLLM backend returns HTTP 500 for every upstream error it doesn't recognize, including `litellm.BadRequestError` (an upstream HTTP 400). Clients that handle specific 400s by adjusting the request and retrying never see the 400, so they fail instead of recovering.  The mapping is in `headroom/backends/litellm.py`: `status_code = 500` is the default, and only authentication (401), rate limit (429) and "not found" (404) are remapped by substring match. The same pattern appears in the Anthropic `/v1/messages` path (around line 1300) and the OpenAI path (around line 1912). This is still the case on `main` as of 2026-10-02.  Real-world impact: Claude Code 2.1.287 sends `thinking: {"type": "adaptive", "display": "highlights"}`. Bedrock rejects it with a 400. Claude Code has a built-in fallback for exactly this error: on a 400 matching `thinking\.(adaptive|enabled)\.display: Input should be`, it switches to `display: "omitted"` and retries. Behind Headroom the client gets a 500 instead, the fallback never fires, and every request fails. Claude Code has similar 400-triggered fallbacks for other fields (for example `output_config.effort` and `thinking.block_binding`), so this will recur as the Anthropic API and Bedrock drift apart.  ## To Reproduce  1. Install headroom: `uv add "headroom-ai[all]==0.39.1"` 2. Start the proxy against Bedrock:    `headroom proxy --code-aware --backend bedrock --region us-west-2` 3. Send a request with a parameter Bedrock rejects (se

- **Issue #3798** (2026-10-05): **[BUG] Vertex us multi-region is forwarded to incorrect upstream hostname**
  *Symptoms*: ## Description  When using Claude Code with Vertex AI through `headroom wrap claude`, Headroom incorrectly constructs the upstream Google Vertex endpoint for requests using the `us` multi-region.  Claude Code works correctly when connecting directly to Vertex AI. When the same Claude Code configuration is run through Headroom, requests to `/locations/us/...` are forwarded to:  ```text https://us-aiplatform.googleapis.com/... ```  and return HTTP 404.  For the Vertex AI `us` multi-region, the expected endpoint is:  ```text https://aiplatform.us.rep.googleapis.com/... ```  The issue appears to be in Headroom's mapping of the Vertex `us` multi-region location to its upstream hostname.  ## To Reproduce  Steps to reproduce the behavior:  1. Install Headroom:  ```bash pip install headroom-ai ```  2. Authenticate with GCP Application Default Credentials:  ```bash gcloud auth application-default login ```  3. Configure Claude Code `settings.json` to use Vertex AI:  ```json {   "gcpAuthRefresh": "gcloud auth application-default login",   "env": {     "CLAUDE_CODE_USE_VERTEX": "1",     "CLOUD_ML_REGION": "us",     "ANTHROPIC_VERTEX_PROJECT_ID": "<project-id>",     "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-5",     "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-5"   } } ```  4. Verify that Claude Code works directly with Vertex:  ```bash claude ```  The configured Vertex models work normally.  5. Exit Claude Code and run the same configuration through Headroom:  ```bash headroom wra

- **Issue #3780** (2026-09-25): **[BUG] headroom_retrieve output is re-compressed into the same CCR marker when the MCP client names tools <server>_<tool>**
  *Symptoms*: ## Description  `headroom_retrieve` output is compressed again on its way to the model, and comes back as **the very marker the model was trying to resolve** — same hash. CCR retrieval is therefore a no-op for any MCP client that names tools `<server>_<tool>` instead of `mcp__<server>__<tool>`.  `DEFAULT_EXCLUDE_TOOLS` already contains `headroom_retrieve`, and `is_tool_excluded()` resolves the `mcp__server__tool` and `mcp_server_tool` aliases — but not the `server_tool` form. OpenCode registers MCP tools as `<alias>_<tool>`, so the tool arrives as `headroom_headroom_retrieve`, matches no alias, and the guard never fires:  ``` headroom_retrieve                  -> excluded: True mcp__headroom__headroom_retrieve   -> excluded: True mcp_headroom_headroom_retrieve     -> excluded: True headroom_headroom_retrieve         -> excluded: False   # what OpenCode sends ```  It reproduces in both `cache` and `token` mode on default settings, using only headroom's own two MCP tools — no other server, no unusual configuration.  ## To Reproduce  1. Run `headroom proxy` and register headroom's MCP server in a client that names MCP tools `<alias>_<tool>` (OpenCode: `"mcp": {"headroom": {"type":"local","command":["headroom","mcp","serve"]}}`). 2. Ask the model to call `headroom_compress` on a few KB of text containing a distinctive sentence; keep the hash it returns. 3. Ask it to call `headroom_retrieve` with that hash and quote the sentence. 4. The model reports it only sees `<<ccr:HASH,strin

- **Issue #3752** (2026-09-24): **[BUG] LiteLLM backend drops image blocks from /v1/messages, so Bedrock models answer without the image**
  *Symptoms*: ## Description  Thanks for the LiteLLM backend and for the thinking-block work in the same converter (#3586), which made this easy to trace. With `--backend bedrock`, image blocks in `/v1/messages` never reach the model. `LiteLLMBackend._convert_messages_for_litellm` only collects `text`, `tool_use`, `tool_result` and thinking blocks, so a text+image turn is sent as text only, and an image-only turn becomes `""` and is dropped.  Found while testing OpenAI GPT-6 Sol, Luna and Astra on Bedrock. GPT-5.6 and Claude behave the same on this path. `/v1/chat/completions` keeps images.  ## To Reproduce  1. `headroom proxy --backend bedrock --region us-east-1` (main `a6a9cef9`) 2. POST `/v1/messages` with a 64x64 solid red PNG and "What single color is this image? One word." (script below) 3. Compare the answer and the Converse body litellm sends  ## Expected Behavior  The Converse request carries an `image` block and the model answers "Red".  ## Actual Behavior  | Model (live, us-east-1) | text + image: red answers / 3 | image-only user turn: red answers / 3 | |---|---|---| | `us.openai.gpt-6-sol` | ❌ 0/3 (`Unknown`) | ❌ 0/3 (`Please upload the image.`) | | `us.openai.gpt-6-luna` | ❌ 0/3 (`White`) | ❌ 0/3 (`Unclear.`) | | `us.openai.gpt-6-astra` | ❌ 0/3 (`Unknown`) | ❌ 0/3 (`Missing.`) | | `global.openai.gpt-6-astra` | ❌ 0/3 (`Image?`) | ❌ 0/3 (`Please upload the image.`) | | `us.openai.gpt-5.6-sol` | ❌ 0/3 (`Unknown`) | ❌ 0/3 (`Upload`) | | `us.anthropic.claude-haiku-4-5-20251001-v1:

- **Issue #3736** (2026-09-24): **[BUG] 0.38.0: ISO-8601 timestamped logs routed as search results, now folded lossily (5 of 2,000 lines, timestamps rewritten)**
  *Symptoms*: ## Summary  In 0.38.0, `headroom_compress` (MCP, `headroom mcp serve`) turns an ISO-8601 timestamped log into a 5-line sample and changes the timestamps it shows. In 0.37.0 the same input went through the lossless grep fold. The fold kept all rows and rebuilt the input exactly.  This looks like a side effect of #3419. That PR takes timestamp rows out of the lossless fold, which is correct. But the payload is still classified as search results, so it now falls through to the lossy `SearchCompressor`.  ## Reproduction  The script below runs on a clean environment with `headroom-ai` and `mcp<2` installed:  ```python import asyncio, json from mcp import ClientSession, StdioServerParameters from mcp.client.stdio import stdio_client  LOG = "\n".join(     f"2026-09-23T10:{i // 60:02d}:{i % 60:02d}Z INFO worker[{i % 8}] processed batch {i} in {(i * 13) % 900}ms"     for i in range(2000) )  async def main():     params = StdioServerParameters(command="headroom", args=["mcp", "serve"])     async with stdio_client(params) as (r, w):         async with ClientSession(r, w) as s:             await s.initialize()             res = await s.call_tool("headroom_compress", {"content": LOG})             d = json.loads(res.content[0].text)             print(d["transforms"], d["original_tokens"], "->", d["compressed_tokens"])             print(d["compressed"][:600])  asyncio.run(main()) ```  **0.37.0:** `['router:search:0.67'] 55006 -> 37015`. The date and hour are lifted into a heading, and all 2
  **Post-Mortem & Fix Analysis**:
  > Reproduced on main@26a2c493: the payload routes to SEARCH_RESULTS with confidence 1.0 because the colon branch accepts the bare date-hour prefix `2026-09-23T10`. I'll send a PR that rejects timestamp-shaped lines in `_is_search_result_line`, reusing `_TIMESTAMP_ROW_RE` from the lossless fold so the two cannot drift apart again, plus the Rust detector parity and a regression test. 

- **Issue #3725** (2026-09-24): **download_cbm is broken on Windows: installer builds .tar.gz, registry pins .zip**
  *Symptoms*: Found while reviewing #3724 (A-7, binary verification fail-closed). **Pre-existing on `main`, not caused by that PR** — filing so it does not get attributed to it.  `headroom/graph/installer.py:63` builds the asset filename unconditionally as:  ```python filename = f"codebase-memory-mcp-{plat}.tar.gz" ```  and `plat` is `windows-amd64` on Windows (`:35-36`). But `headroom/tools.json` pins the Windows asset as `codebase-memory-mcp-windows-amd64.**zip**` — every other platform is `.tar.gz`, Windows is the odd one out.  Two consequences, both on Windows only:  1. The URL has no pin (the registry has no `.tar.gz` entry for that platform), so integrity verification never had a pin to check against. 2. Even if the download succeeds, extraction calls `tarfile.open(fileobj=..., mode="r:gz")` unconditionally at `:86`, which cannot read a zip.  So the Windows path already fails today. After #3724 it fails one step earlier, with `UnpinnedDownload` naming the cause instead of a confusing `TarError`.  **Fix:** pick the extension from the registry entry rather than hardcoding it, and branch extraction on the archive type (`zipfile` for `.zip`, `tarfile` for `.tar.gz`). A regression test should cover the Windows platform key on both halves.  Low priority — it is a graph/codebase-memory install path, not the proxy hot path — but it is a genuine break and the current failure mode is opaque.

- **Issue #3709** (2026-09-25): **[BUG] OpenCode v2: plugin fails to load — entrypoint exports { id, server }, v2 requires { id, setup | effect }**
  *Symptoms*: ## Summary  On OpenCode v2 (tested 1.18.31, Windows), registering `context-mode` via `opencode.json` fails to load the plugin. The failure is caused by an outdated OpenCode adapter export shape: the entrypoint exports a KiloCode-style `{ id, server }` default (plus a named `ContextModePlugin`), whereas the OpenCode v2 plugin API requires a default definition with `id` + `setup`/`effect`.  ## Environment  - OpenCode: `1.18.31` (v2, installed via npm `opencode-ai`) - context-mode: `1.0.169` (npm latest, 2026-06-29); source `2ea2b2f` (main, 2026-09-21) — same export shape - OS: Windows 11  ## Repro  1. `opencode.json`:    ```jsonc    { "plugin": ["context-mode"] }
  **Post-Mortem & Fix Analysis**:
  > @JerrettDavis duplicate of (result of non-existing) #3669 
  > Closing as a duplicate of #3669.

- **Issue #3708** (2026-09-24): **POST /v1/compress returns 404 despite being declared in the OpenAPI spec (v0.37.0 and v0.38.0)**
  *Symptoms*: ## Summary  `POST /v1/compress` is declared in the proxy's own OpenAPI spec (`operationId: compress_messages_v1_compress_post`) but unconditionally returns `404 {"detail":"Not Found"}` for every request — any method, any payload, empty or well-formed. Confirmed on both `0.37.0` and `0.38.0` (persistent-docker deployment, image `ghcr.io/headroomlabs-ai/headroom:latest`).  This endpoint appears to be registered for OpenAPI/docs generation purposes but never actually mounted as a live route in the running FastAPI app.  ## Environment  - Headroom version: `0.37.0` → reproduced again after upgrading to `0.38.0` - Deployment: `persistent-docker` preset, `headroom install apply` - Image: `ghcr.io/headroomlabs-ai/headroom:latest` - Host: macOS (Darwin 27.0.0, arm64) - Proxy reachable and otherwise healthy: `/readyz`, `/health`, `/stats`, `/v1/models`, `/v1/messages` all respond as expected (`/v1/models` and `/v1/usage` correctly 401 without auth, confirming those routes are live — `/v1/compress` returns plain 404 regardless of auth).  ## Steps to reproduce  ```bash # 1. Confirm proxy is healthy curl -s http://127.0.0.1:8787/readyz # -> {"status":"healthy","ready":true,"version":"0.38.0",...}  # 2. Confirm the route exists in the OpenAPI spec curl -s http://127.0.0.1:8787/openapi.json | python3 -c " import json,sys d = json.load(sys.stdin) print(json.dumps(d['paths']['/v1/compress'], indent=2)) " # -> { #      "post": { #        "summary": "Compress Messages", #        "operationId": 

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

### Incident Patch 1: `a493f559` (2026-10-06)
**Commit Message**: fix(proxy): classify Pi Codex Responses alias (#2583)

## Description

Pi-compatible clients such as Gajae-Code open the Codex Responses
WebSocket at `/v1/codex/responses`, an alias added in #196. The
unidentified-client stamp added in #1036 only recognizes
`/v1/responses`, while Gajae-Code currently identifies itself as
`pi/<version>`. The alias therefore remains unclassified and takes the
generic proxy compression-timeout path instead of the Codex fail-open
path.

This change applies the existing narrow `X-Client: codex` stamp to the
Pi-compatible alias and its subpaths. Explicit `X-Client` values and
already-recognized user agents remain untouched.

Refs #196 and #1036.

## Type of Change

- [x] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that causes existing functionality
to change)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring (no functional changes)

## Changes Made

- Treat `/v1/codex/responses` and its subpaths as Codex Responses paths
for unidentified-client stamping.
- Add regression coverage for the exact Pi-compatible alias and it

**File**: `headroom/proxy/auth_policy.py` (modified, +6/-2)
```diff
@@ -46,6 +46,10 @@ class AuthMode(str, enum.Enum):
 
 
 CODEX_RESPONSES_PATH = "/v1/responses"
+CODEX_RESPONSES_PATHS: tuple[str, ...] = (
+    CODEX_RESPONSES_PATH,
+    "/v1/codex/responses",
+)
 
 
 @dataclass(frozen=True)
@@ -111,8 +115,8 @@ def classify_client_signals(signals: AuthSignals, *, default: str | None = None)
 
 
 def is_codex_responses_path(path: str) -> bool:
-    """Return True for the OpenAI Responses endpoint and its subpaths."""
-    return path == CODEX_RESPONSES_PATH or path.startswith(CODEX_RESPONSES_PATH + "/")
+    """Return True for OpenAI Responses endpoints and their subpaths."""
+    return any(root == path or path.startswith(root + "/") for root in CODEX_RESPONSES_PATHS)
 
 
 def should_stamp_codex_client_signals(path: str, signals: AuthSignals) -> bool:
```

**File**: `tests/test_codex_client_stamp.py` (modified, +15/-3)
```diff
@@ -1,9 +1,9 @@
 """Tests for ``should_stamp_codex_client`` — the path-based ``X-Client: codex``
 stamp on the Responses endpoint.
 
-The stamp fires only for an unidentified caller on the Responses endpoint, so
-Codex Desktop (whose User-Agent isn't a known codex UA) takes the codex
-fail-open path instead of being refused with a 413 on a compression timeout.
+The stamp fires only for an unidentified caller on a Responses endpoint, so
+Codex Desktop and Pi-compatible Codex callers take the codex fail-open path
+instead of being refused with a 413 on a compression timeout.
 """
 
 from __future__ import annotations
@@ -13,12 +13,17 @@
 CODEX_DESKTOP_UA = (
     "Codex Desktop/0.140.0-alpha.2 (Mac OS 15.7.7; arm64) unknown (Codex Desktop; 26.609.71450)"
 )
+PI_UA = "pi/0.11.11 (darwin 25.5.0; arm64)"
 
 
 def test_unidentified_codex_desktop_on_responses_is_stamped() -> None:
     assert should_stamp_codex_client("/v1/responses", {"user-agent": CODEX_DESKTOP_UA})
 
 
+def test_unidentified_pi_on_codex_responses_alias_is_stamped() -> None:
+    assert should_stamp_codex_client("/v1/codex/responses", {"user-agent": PI_UA})
+
+
 def test_stamp_then_classify_yields_codex() -> None:
     # End-to-end of what the HTTP middleware and the WS handler both do:
     # stamp the header, after which classify_client must read "codex".
@@ -36,6 +41,13 @@ def test_responses_subpath_is_stamped() -> None:
     assert should_stamp_codex_client("/v1/responses/foo", {"user-agent": CODEX_DESKTOP_UA})
 
 
+def test_codex_responses_alias_subpath_is_stamped() -> None:
+    assert should_stamp_codex_client(
+        "/v1/codex/responses/compact",
+        {"user-agent": PI_UA},
+    )
+
+
 def test_other_path_is_not_stamped() -> None:
     # Scoped to the Responses endpoint; unknown callers elsewhere are untouched.
     assert not should_stamp_codex_client("/v1/chat/completions", {"user-agent": CODEX_DESKTOP_UA})
```

**File**: `tests/test_openai_codex_ws_lifecycle.py` (modified, +29/-0)
```diff
@@ -1792,6 +1792,35 @@ async def test_ws_recognized_client_with_real_path_is_not_restamped():
     assert handler.ws_sessions.active_count() == 0
 
 
+@pytest.mark.asyncio
+async def test_ws_pi_codex_responses_alias_is_stamped():
+    """The Pi-compatible Codex alias gets the same client stamp as /v1/responses."""
+    upstream_events = [
+        json.dumps({"type": "response.created", "response": {"id": "r_1"}}),
+        json.dumps({"type": "response.completed", "response": {"id": "r_1"}}),
+    ]
+    connect_calls: list[tuple[tuple, dict]] = []
+    upstream = _FakeUpstream(upstream_events)
+    fake_ws_mod = _make_fake_websockets_module(upstream, connect_calls=connect_calls)
+    client_ws = _FakeWebSocket(
+        frames=[_first_frame()],
+        headers={
+            "authorization": "Bearer test",
+            "user-agent": "pi/0.11.11 (darwin 25.5.0; arm64)",
+        },
+    )
+    client_ws.url = SimpleNamespace(path="/v1/codex/responses")
+    handler = _DummyOpenAIHandler()
+
+    with patch.dict(sys.modules, {"websockets": fake_ws_mod}):
+        await handler.handle_openai_responses_ws(client_ws)
+
+    assert len(connect_calls) == 1
+    forwarded_headers = connect_calls[0][1]["additional_headers"]
+    assert forwarded_headers["x-client"] == "codex"
+    assert handler.ws_sessions.active_count() == 0
+
+
 @pytest.mark.asyncio
 @pytest.mark.parametrize("store", [True, False])
 @pytest.mark.parametrize(
```

---

### Incident Patch 2: `67ce7d0f` (2026-10-06)
**Commit Message**: fix(ci): clear dependency audit and gate Docker publishing (#3984)

This maintainer-requested corrective PR fixes red-main CI failures. The
task explicitly asks for the main-CI fix, providing the exception
context for CONTRIBUTING.md's CI-only restriction. Maintainers retain
the merge decision.

Docker manifest publishing previously used `always()` and ran after
cancelled builds, then failed downloading missing digest artifacts (main
Docker run 37372683144). Require `success()` for the complete build
matrix before publishing. Update the existing release regression test
while retaining signing order and root-only latest-promotion assertions.

The production dependency audit identified CVE-2026-104851 in fsspec
2025.10.0 and CVE-2026-104874 in multidict 6.7.1. Update only those lock
entries to the reported fixed versions, 2026.6.0 and 6.9.1.

## Real behavior proof

- Setup: Windows, Python 3.13.3, uv; workflow regression tests do not
use an LLM provider or credentials. Hosted CI uses its existing Linux
matrix.
- Before fix: hosted test shard 4 failed with `KeyError: 'if'`. The
updated success-gate regression failed locally before adding the
explicit gate: 1 failed, 53 passed. Hosted

**File**: `.github/workflows/docker.yml` (modified, +1/-1)
```diff
@@ -247,7 +247,7 @@ jobs:
   # tags, and that manifest is what users pull by `:tag`.
   docker-manifest:
     needs: docker-build
-    if: ${{ always() }}
+    if: ${{ success() }}
     runs-on: ubuntu-24.04
     timeout-minutes: 20
     strategy:
```

**File**: `tests/test_release_workflows.py` (modified, +2/-1)
```diff
@@ -277,7 +277,8 @@ def test_docker_latest_promotion_is_owned_by_root_manifest_cell() -> None:
     assert '"${IMAGE}:${VERSION}"' in command
     assert "promote-latest" not in jobs
     assert manifest["needs"] == "docker-build"
-    assert manifest["if"] == "${{ always() }}"
+    # Publishing requires every architecture's digest, including after cancellation.
+    assert manifest["if"] == "${{ success() }}"
     step_names = [step["name"] for step in manifest["steps"]]
     assert step_names.index("Sign multi-arch index manifest with cosign") < step_names.index(
         "Re-tag root image as :latest"
```

**File**: `uv.lock` (modified, +176/-133)
```diff
@@ -1296,11 +1296,11 @@ wheels = [
 
 [[package]]
 name = "fsspec"
-version = "2025.10.0"
+version = "2026.6.0"
 source = { registry = "https://pypi.org/simple/" }
-sdist = { url = "https://files.pythonhosted.org/packages/24/7f/2747c0d332b9acfa75dc84447a066fdf812b5a6b8d30472b74d309bfe8cb/fsspec-2025.10.0.tar.gz", hash = "sha256:b6789427626f068f9a83ca4e8a3cc050850b6c0f71f99ddb4f542b8266a26a59", size = 309285, upload-time = "2025-10-30T14:58:44.036Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/10/a1/ae4e3e5003468d6391d2c77b6fa1cd73bd5d13511d81c642d7b28ac90ed4/fsspec-2026.6.0.tar.gz", hash = "sha256:f5bac145310fe30e16e1471bd6840b2d990d609e872251d7e674241822abf01a", size = 313646, upload-time = "2026-06-16T01:57:28.105Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/eb/02/a6b21098b1d5d6249b7c5ab69dde30108a71e4e819d4a9778f1de1d5b70d/fsspec-2025.10.0-py3-none-any.whl", hash = "sha256:7c7712353ae7d875407f97715f0e1ffcc21e33d5b24556cb1e090ae9409ec61d", size = 200966, upload-time = "2025-10-30T14:58:42.53Z" },
+    { url = "https://files.pythonhosted.org/packages/e5/22/4222d7ddf3da30f363edaa98e329c2bce6c65497c9cb2810931c8b2c0fbc/fsspec-2026.6.0-py3-none-any.whl", hash = "sha256:02e0b71817df9b2169dc30a16832045764def1191b43dcff5bb85bdee212d2a1", size = 203949, upload-time = "2026-06-16T01:57:26.358Z" },
 ]
 
 [package.optional-dependencies]
@@ -2940,140 +2940,183 @@ wheels = [
 
 [[package]]
 name = "multidict"
-version = "6.7.1"
+version = "6.9.1"
 source = { registry = "https://pypi.org/simple/" }
 dependencies = [
     { name = "typing-extensions", marker = "python_full_version < '3.11'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/1a/c2/c2d94cbe6ac1753f3fc980da97b3d930efe1da3af3c9f5125354436c073d/multidict-6.7.1.tar.gz", hash = "sha256:ec6652a1bee61c53a3e5776b6049172c53b6aaba34f18c9ad04f82712bac623d", size = 102010, upload-time = "2026-01-26T02:46:45.979Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/84/0b/19348d4c98980c4851d2f943f8ebafdece2ae7ef737adcfa5994ce8e5f10/multidict-6.7.1-cp310-cp310-macosx_10_9_universal2.whl", hash = "sha256:c93c3db7ea657dd4637d57e74ab73de31bccefe144d3d4ce370052035bc85fb5", size = 77176, upload-time = "2026-01-26T02:42:59.784Z" },
-    { url = "https://files.pythonhosted.org/packages/ef/04/9de3f8077852e3d438215c81e9b691244532d2e05b4270e89ce67b7d103c/multidict-6.7.1-cp310-cp310-macosx_10_9_x86_64.whl", hash = "sha256:974e72a2474600827abaeda71af0c53d9ebbc3c2eb7da37b37d7829ae31232d8", size = 44996, upload-time = "2026-01-26T02:43:01.674Z" },
-    { url = "https://files.pythonhosted.org/packages/31/5c/08c7f7fe311f32e83f7621cd3f99d805f45519cd06fafb247628b861da7d/multidict-6.7.1-cp310-cp310-macosx_11_0_arm64.whl", hash = "sha256:cdea2e7b2456cfb6694fb113066fd0ec7ea4d67e3a35e1f4cbeea0b448bf5872", size = 44631, upload-time = "2026-01-26T02:43:03.169Z" },
-    { url = "https://files.pythonhosted.org/packages/b7/7f/0e3b1390ae772f27501199996b94b52ceeb64fe6f9120a32c6c3f6b781be/multidict-6.7.1-cp310-cp310-manylinux1_i686.manylinux_2_28_i686.manylinux_2_5_i686.whl", hash = "sha256:17207077e29342fdc2c9a82e4b306f1127bf1ea91f8b71e02d4798a70bb99991", size = 242561, upload-time = "2026-01-26T02:43:04.733Z" },
-    { url = "https://files.pythonhosted.org/packages/dd/f4/8719f4f167586af317b69dd3e90f913416c91ca610cac79a45c53f590312/multidict-6.7.1-cp310-cp310-manylinux2014_aarch64.manylinux_2_17_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:d4f49cb5661344764e4c7c7973e92a47a59b8fc19b6523649ec9dc4960e58a03", size = 242223, upload-time = "2026-01-26T02:43:06.695Z" },
-    { url = "https://files.pythonhosted.org/packages/47/ab/7c36164cce64a6ad19c6d9a85377b7178ecf3b89f8fd589c73381a5eedfd/multidict-6.7.1-cp310-cp310-manylinux2014_armv7l.manylinux_2_17_armv7l.manylinux_2_31_armv7l.whl", hash = "sha256:a9fc4caa29e2e6ae408d1c450ac8bf19892c5fca83ee634ecd88a53332c59981", size = 222322, upload-time = "2026-01-26T02:43:08.472Z" },
-    { url = "https://files.pythonhosted.org/packages/f5/79/a25add6fb38035b5337bc5734f296d9afc99163403bbcf56d4170f97eb62/multidict-6.7.1-cp310-cp310-manylinux2014_ppc64le.manylinux_2_17_ppc64le.manylinux_2_28_ppc64le.whl", hash = "sha256:c5f0c21549ab432b57dcc82130f388d84ad8179824cc3f223d5e7cfbfd4143f6", size = 254005, upload-time = "2026-01-26T02:43:10.127Z" },
-    { url = "https://files.pythonhosted.org/packages/4a/7b/64a87cf98e12f756fc8bd444b001232ffff2be37288f018ad0d3f0aae931/multidict-6.7.1-cp310-cp310-manylinux2014_s390x.manylinux_2_17_s390x.manylinux_2_28_s390x.whl", hash = "sha256:7dfb78d966b2c906ae1d28ccf6e6712a3cd04407ee5088cd276fe8cb42186190", size = 251173, upload-time = "2026-01-26T02:43:11.731Z" },
-    { url = "https://files.pythonhosted.org/packages/4b/ac/b605473de2bb404e742f2cc3583d12aedb2352a70e49ae8fce455b50c5aa/multidict-6.7.1-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl", hash = "sha256:9b0d9b91d1aa44db9c1f1ecd0d9d2ae610b2f4f856448664e01a3b35899f3f92", siz
```

---

### Incident Patch 3: `0396ea2f` (2026-10-05)
**Commit Message**: fix(codex): resolve per-turn project context (#2636)

## Description

Codex Desktop can send turns from multiple projects through one HTTP or
WebSocket route, so a static `/p/<project>` route cannot reliably
identify each turn.

This PR resolves project context per turn from explicit overrides or
Codex thread/turn metadata. Unsafe or inconsistent resolution skips
project memory and learning while the model request continues.

Related to #2355 and overlaps #2379.

## Type of Change

- [x] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing
functionality to change)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring (no functional changes)

## Changes Made

- Resolve `thread_id` and `turn_id` to the matching rollout cwd.
- Use the resolver for HTTP and per-frame WebSocket traffic.
- Pin each WebSocket to its first resolved project and fail closed on
mismatch.
- Strip Codex-only metadata before forwarding upstream.

## Testing

- [x] Unit tests pass (`pytest`)
- [x] Linting passes (`ruff check .`)
- [x] Type checking passes (`mypy he

**File**: `headroom/providers/codex/project_context.py` (added, +461/-0)
```diff
@@ -0,0 +1,461 @@
+"""Read-only Codex turn-to-project resolution for Responses traffic."""
+
+from __future__ import annotations
+
+import asyncio
+import json
+import logging
+import os
+import sqlite3
+import time
+from collections.abc import Mapping
+from dataclasses import dataclass
+from functools import lru_cache
+from pathlib import Path
+from typing import Any, Literal, cast
+
+try:
+    import tomllib
+except ModuleNotFoundError:  # pragma: no cover - Python 3.10
+    import tomli as tomllib
+
+from headroom.memory.storage_router import ProjectResolver, RequestContext
+from headroom.providers.codex.threads import _codex_state_db_paths
+
+logger = logging.getLogger(__name__)
+
+_METADATA_HEADER = "x-codex-turn-metadata"
+_MAX_METADATA_BYTES = 16 * 1024
+_SQLITE_TIMEOUT_SECONDS = 0.1
+_SQLITE_ATTEMPTS = 2
+_ROLLOUT_CACHE_MAX_ENTRIES = 256
+
+
+@dataclass(frozen=True, slots=True)
+class CodexResolvedProject:
+    """One optional project identity and its observable resolution result."""
+
+    cwd: Path | None
+    project_key: str | None
+    source: Literal[
+        "x-headroom-project-id",
+        "x-headroom-cwd",
+        "configured-project-root",
+        "codex-turn-metadata",
+        "codex-client-metadata",
+        "responses-body-cwd",
+        "unresolved",
+    ]
+    reason: str
+
+
+class CodexProjectContextResolver:
+    """Map Codex ``thread_id`` + ``turn_id`` to an exact rollout cwd."""
+
+    def __init__(self, sqlite_home: str | Path | None = None) -> None:
+        self._configured_sqlite_home = Path(sqlite_home).expanduser() if sqlite_home else None
+
+    def resolve(
+        self,
+        *,
+        headers: Mapping[str, str],
+        body: Mapping[str, Any],
+        pinned_cwd: Path | None = None,
+        project_root_override: str | None = None,
+    ) -> CodexResolvedProject:
+        explicit_project_id = self._header(headers, "x-headroom-project-id")
+        if explicit_project_id:
+            project_identity = ProjectResolver().resolve(
+                RequestContext(
+                    headers=headers,
+                    system_prompt="",
+                    base_user_id="",
+                    project_root_override=project_root_override,
+                )
+            )
+            return CodexResolvedProject(
+                cwd=None,
+                project_key=project_identity[0] if project_identity else None,
+                source="x-headroom-project-id",
+                reason="explicit_project_id",
+            )
+
+        explicit_cwd = self._header(headers, "x-headroom-cwd")
+        if explicit_cwd:
+            return self._explicit_cwd_result(
+                explicit_cwd,
+                headers=headers,
+                source="x-headroom-cwd",
+                pinned_cwd=pinned_cwd,
+            )
+
+        if project_root_override:
+            return self._explicit_cwd_result(
+                project_root_override,
+                headers=headers,
+                source="configured-project-root",
+                pinned_cwd=pinned_cwd,
+            )
+
+        identity, source, metadata_reason = self._turn_identity(headers, body)
+        if identity is not None:
+            thread_id, turn_id = identity
+            if not turn_id:
+                return self._fallback_or_skip(
+                    body,
+                    headers,
+                    pinned_cwd,
+                    "turn_id_missing",
+                )
+            cwd, reason = self._cwd_from_state(thread_id, turn_id)
+            if cwd is not None:
+                return self._cwd_result(
+                    cwd,
+                    headers,
+                    cast(Literal["codex-turn-metadata", "codex-client-metadata"], source),
+                    pinned_cwd,
+                )
+            return self._skip(reason)
+
+        return self._fallback_or_skip(
+            body,
+            headers,
+            pinned_cwd,
+            metadata_reason,
+        )
+
+    async def resolve_async(
+        self,
+        *,
+        headers: Mapping[str, str],
+        body: Mapping[str, Any],
+        pinned_cwd: Path | None = None,
+        project_root_override: str | None = None,
+    ) -> CodexResolvedProject:
+        """Resolve optional project context without blocking async model traffic."""
+        try:
+            return await asyncio.to_thread(
+                self.resolve,
+                headers=headers,
+                body=body,
+                pinned_cwd=pinned_cwd,
+                project_root_override=project_root_override,
+            )
+        except Exception:
+            logger.warning("event=codex_project_resolution_failed", exc_info=True)
+            return self._skip("resolver_failed")
+
+    @staticmethod
+    def _header(headers: Mapping[str, str], name: str) -> str | None:
+        lowered = name.lower()
+        for key, value in headers.items():
+            if key.lower() == lowered and value and v
```

**File**: `headroom/proxy/handlers/openai.py` (modified, +248/-48)
```diff
@@ -64,6 +64,7 @@
     is_copilot_api_url,
 )
 from headroom.pipeline import PipelineStage, summarize_routing_markers
+from headroom.providers.codex.project_context import CodexProjectContextResolver
 from headroom.providers.codex.responses import (
     codex_responses_http_url,
     codex_responses_websocket_url,
@@ -6089,10 +6090,6 @@ async def handle_openai_responses(
         bind_scope(tags, request.scope)
         client = classify_client(headers)
 
-        # Learn from the original client payload before memory context or
-        # compression mutates it. This mirrors the Anthropic ingestion path.
-        await self._observe_openai_responses_traffic(body, request_id=request_id)
-
         # PR-A5 (P5-49): strip internal x-headroom-* from upstream-bound
         # headers AFTER `_extract_tags` reads them. Memory user-id reads
         # `request.headers` below.
@@ -6127,7 +6124,11 @@ async def handle_openai_responses(
         headers = {
             key: value
             for key, value in headers.items()
-            if key.lower() != _CODEX_RESPONSES_LITE_HEADER
+            if key.lower()
+            not in {
+                _CODEX_RESPONSES_LITE_HEADER,
+                "x-codex-turn-metadata",
+            }
         }
         log_outbound_headers(
             forwarder="openai_responses",
@@ -6137,6 +6138,56 @@ async def handle_openai_responses(
         headers, is_chatgpt_auth = _resolve_codex_routing_headers(headers)
         if is_chatgpt_auth:
             client = "codex"
+        codex_project = None
+        codex_project_root_override = (
+            getattr(getattr(self.memory_handler, "config", None), "project_root_override", "")
+            or getattr(self.config, "memory_project_root_override", "")
+            or None
+        )
+        if client == "codex":
+            codex_project = await CodexProjectContextResolver().resolve_async(
+                headers=dict(request.headers),
+                body=body,
+                project_root_override=codex_project_root_override,
+            )
+            tags["codex_project_context"] = codex_project.reason
+            if codex_project.project_key and classify_project(request.headers) is None:
+                set_current_project(codex_project.project_key)
+        codex_project_scope_required = client == "codex" and (
+            is_chatgpt_auth
+            or bool(request.headers.get("x-codex-turn-metadata"))
+            or "codex" in str(request.headers.get("user-agent") or "").lower()
+            or any(
+                isinstance(container, dict)
+                and isinstance(container.get("client_metadata"), dict)
+                and bool(container["client_metadata"].get("thread_id"))
+                for container in (
+                    body,
+                    body.get("response") if isinstance(body.get("response"), dict) else {},
+                )
+            )
+        )
+        codex_project_features_allowed = not codex_project_scope_required or bool(
+            codex_project
+            and (
+                codex_project.cwd is not None
+                or codex_project.source
+                in {
+                    "x-headroom-project-id",
+                    "x-headroom-cwd",
+                    "configured-project-root",
+                }
+            )
+        )
+        resolved_project_root_override = codex_project_root_override or (
+            str(codex_project.cwd) if codex_project and codex_project.cwd else None
+        )
+        # The shared learner cannot isolate project state. Scoped Codex turns
+        # skip learning until a project-scoped learner is available.
+        if not codex_project_scope_required and (
+            codex_project is None or codex_project.reason == "metadata_missing"
+        ):
+            await self._observe_openai_responses_traffic(body, request_id=request_id)
         memory_client = (
             "codex"
             if is_chatgpt_auth
@@ -6192,7 +6243,7 @@ async def handle_openai_responses(
         # directly because `headers` was stripped of `x-headroom-*` (PR-A5).
         memory_user_id: str | None = None
         memory_request_ctx = None
-        if self.memory_handler:
+        if self.memory_handler and codex_project_features_allowed:
             memory_user_id = resolve_memory_identity(request)
             from headroom.memory.storage_router import (
                 RequestContext as _MemRequestContext,
@@ -6205,9 +6256,7 @@ async def handle_openai_responses(
                 headers=dict(request.headers),
                 system_prompt=_extract_sys_prompt(body),
                 base_user_id=memory_user_id,
-                project_root_override=(
-                    getattr(self.memory_handler.config, "project_root_override", "") or None
-                ),
+                project_root_override=resolved_project_root_override,
             )
 
         # Rate limiting
@@ -6276,11 +6325,13 @@ async def handle_opena
```

**File**: `tests/test_codex_project_context.py` (added, +939/-0)
```diff
@@ -0,0 +1,939 @@
+from __future__ import annotations
+
+import asyncio
+import json
+import sqlite3
+import sys
+import threading
+from pathlib import Path
+from types import SimpleNamespace
+from unittest.mock import patch
+
+import anyio
+import pytest
+
+from headroom.memory.storage_router import ProjectResolver, RequestContext
+from headroom.providers.codex.project_context import CodexProjectContextResolver
+from tests.test_openai_codex_routing import (
+    _build_request,
+    _DummyTokenizer,
+    _ResponseStub,
+)
+from tests.test_openai_codex_routing import (
+    _DummyOpenAIHandler as _HTTPHandler,
+)
+from tests.test_openai_codex_ws_lifecycle import (
+    _DummyOpenAIHandler as _WSHandler,
+)
+from tests.test_openai_codex_ws_lifecycle import (
+    _FakeUpstream,
+    _FakeWebSocket,
+    _make_fake_websockets_module,
+    _MemoryWsHandler,
+)
+
+
+def _seed_thread(codex_home: Path, thread_id: str, rollout: Path) -> None:
+    db = codex_home / "state_5.sqlite"
+    with sqlite3.connect(db) as connection:
+        connection.execute(
+            "CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL)"
+        )
+        connection.execute(
+            "INSERT INTO threads (id, rollout_path) VALUES (?, ?)",
+            (thread_id, str(rollout)),
+        )
+
+
+def _seed_rollout(path: Path, turn_id: str, cwd: Path) -> None:
+    path.write_text(
+        json.dumps(
+            {
+                "type": "turn_context",
+                "payload": {"turn_id": turn_id, "cwd": str(cwd)},
+            }
+        )
+        + "\n",
+        encoding="utf-8",
+    )
+
+
+def _append_turn(path: Path, turn_id: str, cwd: Path) -> None:
+    with path.open("a", encoding="utf-8") as handle:
+        handle.write(
+            json.dumps(
+                {
+                    "type": "turn_context",
+                    "payload": {"turn_id": turn_id, "cwd": str(cwd)},
+                }
+            )
+            + "\n"
+        )
+
+
+def test_codex_http_projects_are_isolated_and_ws_mismatch_fails_closed(
+    monkeypatch, tmp_path: Path
+) -> None:
+    codex_home = tmp_path / "codex"
+    codex_home.mkdir()
+    project_a = tmp_path / "a" / "shared"
+    project_b = tmp_path / "b" / "shared"
+    project_a.mkdir(parents=True)
+    project_b.mkdir(parents=True)
+    rollout_a = codex_home / "rollout-a.jsonl"
+    rollout_b = codex_home / "rollout-b.jsonl"
+    _seed_rollout(rollout_a, "turn-a", project_a)
+    _seed_rollout(rollout_b, "turn-b", project_b)
+    _seed_thread(codex_home, "thread-a", rollout_a)
+    _seed_thread(codex_home, "thread-b", rollout_b)
+    monkeypatch.setenv("CODEX_HOME", str(codex_home))
+
+    resolver = CodexProjectContextResolver()
+    resolved_a = resolver.resolve(
+        headers={
+            "x-codex-turn-metadata": json.dumps({"thread_id": "thread-a", "turn_id": "turn-a"})
+        },
+        body={},
+    )
+    resolved_b = resolver.resolve(
+        headers={},
+        body={"client_metadata": {"thread_id": "thread-b", "turn_id": "turn-b"}},
+    )
+
+    assert resolved_a.cwd == project_a.resolve()
+    assert resolved_b.cwd == project_b.resolve()
+    keys = {
+        ProjectResolver().resolve(
+            RequestContext(
+                headers={},
+                system_prompt="",
+                base_user_id="test",
+                project_root_override=str(resolved.cwd),
+            )
+        )[0]
+        for resolved in (resolved_a, resolved_b)
+    }
+    assert len(keys) == 2
+
+    mismatch = resolver.resolve(
+        headers={},
+        body={
+            "type": "response.create",
+            "response": {
+                "client_metadata": {
+                    "thread_id": "thread-b",
+                    "turn_id": "turn-b",
+                }
+            },
+        },
+        pinned_cwd=resolved_a.cwd,
+    )
+    assert mismatch.cwd is None
+    assert mismatch.reason == "project_mismatch"
+
+    _append_turn(rollout_a, "turn-a", project_b)
+    changed_rollout = resolver.resolve(
+        headers={},
+        body={"client_metadata": {"thread_id": "thread-a", "turn_id": "turn-a"}},
+    )
+    assert changed_rollout.cwd is None
+    assert changed_rollout.reason == "turn_ambiguous"
+
+
+def test_cached_rollout_recanonicalizes_symlink_before_pinned_check(
+    monkeypatch, tmp_path: Path
+) -> None:
+    codex_home = tmp_path / "codex"
+    codex_home.mkdir()
+    project_a = tmp_path / "a"
+    project_b = tmp_path / "b"
+    project_a.mkdir()
+    project_b.mkdir()
+    project_link = tmp_path / "current-project"
+    project_link.symlink_to(project_a, target_is_directory=True)
+    rollout = codex_home / "rollout.jsonl"
+    _seed_rollout(rollout, "turn", project_link)
+    _seed_thread(codex_home, "thread", rollout)
+    monkeypatch.setenv("CODEX_HOME", str(codex_home))
+    resolver = CodexProjectContextResolver()
+    body = {"client_metadata": {"thread_id": "thread", "turn_id": "tur
```

**File**: `tests/test_codex_ws_per_frame_memory.py` (modified, +11/-6)
```diff
@@ -23,7 +23,7 @@ def __init__(self) -> None:
         self.config = SimpleNamespace(
             inject_context=True,
             inject_tools=True,
-            project_root_override="",
+            project_root_override=str(Path(__file__).resolve().parent),
         )
         self.queries: list[str] = []
 
@@ -165,7 +165,8 @@ async def test_memory_lookup_runs_for_each_issue_artifact_frame_and_preserves_no
         [
             json.dumps({"type": "response.created", "response": {"id": "r_1"}}),
             json.dumps({"type": "response.completed", "response": {"id": "r_1"}}),
-        ]
+        ],
+        hold_after_events=True,
     )
     first_turn, later_turn = _issue_2059_turns()
     first_input, later_input = _issue_2059_inputs()
@@ -225,7 +226,8 @@ async def test_memory_lookup_skips_input_bearing_non_create_first_frame():
         [
             json.dumps({"type": "response.created", "response": {"id": "r_1"}}),
             json.dumps({"type": "response.completed", "response": {"id": "r_1"}}),
-        ]
+        ],
+        hold_after_events=True,
     )
     _first_input, later_input = _issue_2059_inputs()
     cancel_frame = json.dumps(
@@ -256,7 +258,8 @@ async def test_memory_lookup_skips_bypassed_frames():
         [
             json.dumps({"type": "response.created", "response": {"id": "r_1"}}),
             json.dumps({"type": "response.completed", "response": {"id": "r_1"}}),
-        ]
+        ],
+        hold_after_events=True,
     )
     first, later = _issue_2059_turns()
     client_ws = _FakeWebSocket(
@@ -280,7 +283,8 @@ async def test_memory_lookup_keeps_legacy_direct_first_frame():
         [
             json.dumps({"type": "response.created", "response": {"id": "r_1"}}),
             json.dumps({"type": "response.completed", "response": {"id": "r_1"}}),
-        ]
+        ],
+        hold_after_events=True,
     )
     first_input, later_input = _issue_2059_inputs()
     first = _direct_turn(first_input)
@@ -307,7 +311,8 @@ async def test_memory_lookup_skips_disabled_memory(monkeypatch):
         [
             json.dumps({"type": "response.created", "response": {"id": "r_1"}}),
             json.dumps({"type": "response.completed", "response": {"id": "r_1"}}),
-        ]
+        ],
+        hold_after_events=True,
     )
     first, later = _issue_2059_turns()
     client_ws = _FakeWebSocket(frames=[first, later])
```

**File**: `tests/test_openai_codex_routing.py` (modified, +2/-1)
```diff
@@ -3,6 +3,7 @@
 import json
 import sys
 from copy import deepcopy
+from pathlib import Path
 from types import SimpleNamespace
 from unittest.mock import AsyncMock, MagicMock, patch
 
@@ -279,7 +280,7 @@ def __init__(self) -> None:
         self.config = SimpleNamespace(
             inject_context=False,
             inject_tools=True,
-            project_root_override="",
+            project_root_override=str(Path(__file__).resolve().parent),
         )
         self.compute_calls = 0
 
```

**File**: `tests/test_openai_codex_ws_lifecycle.py` (modified, +7/-4)
```diff
@@ -12,6 +12,7 @@
 import json
 import logging
 import sys
+from pathlib import Path
 from types import SimpleNamespace
 from unittest.mock import MagicMock, patch
 
@@ -75,7 +76,7 @@ def __init__(self) -> None:
         self.config = SimpleNamespace(
             inject_context=False,
             inject_tools=True,
-            project_root_override="",
+            project_root_override=str(Path(__file__).resolve().parent),
         )
         self._backend = False
 
@@ -101,6 +102,8 @@ async def _execute_memory_tool(
         args: dict,
         user_id: str,
         provider: str,
+        *,
+        request_context=None,
     ) -> str:
         assert (name, args, user_id, provider) == (
             "memory_search",
@@ -2001,7 +2004,7 @@ async def test_ws_late_memory_call_after_streamed_message_passes_through():
     handler.memory_handler = _MemoryWsHandler()
     executed: list[tuple[str, dict, str, str]] = []
 
-    async def _execute_memory_tool(name, args, user_id, provider):
+    async def _execute_memory_tool(name, args, user_id, provider, *, request_context=None):
         executed.append((name, args, user_id, provider))
         return '{"memories": []}'
 
@@ -2088,7 +2091,7 @@ async def test_ws_memory_continuation_normalizes_malformed_arguments():
     handler.memory_handler = _MemoryWsHandler()
     executed: list[tuple[str, dict, str, str]] = []
 
-    async def _execute_memory_tool(name, args, user_id, provider):
+    async def _execute_memory_tool(name, args, user_id, provider, *, request_context=None):
         executed.append((name, args, user_id, provider))
         return '{"memories": []}'
 
@@ -2211,7 +2214,7 @@ async def test_ws_memory_continuation_continues_pre_stream_and_passes_late_call(
     handler.memory_handler = _MemoryWsHandler()
     executed: list[tuple[str, dict, str, str]] = []
 
-    async def _execute_memory_tool(name, args, user_id, provider):
+    async def _execute_memory_tool(name, args, user_id, provider, *, request_context=None):
         executed.append((name, args, user_id, provider))
         return '{"memories": []}'
 
```

---

### Incident Patch 4: `c07fad0f` (2026-10-05)
**Commit Message**: fix(wrap): set ANTHROPIC_HOST so `wrap goose` actually proxies Anthropic (#2619)

## Description

`headroom wrap goose` never proxied Anthropic traffic. Goose's Anthropic
provider reads `ANTHROPIC_HOST`, not `ANTHROPIC_BASE_URL`, so the
wrapper started the proxy, printed the banner, and then sent every
request straight to `api.anthropic.com` — silently, with no error and
zero compression.

`ANTHROPIC_BASE_URL` appears in no `.rs` file in the goose repo. The
provider reads `ANTHROPIC_HOST` at
[`crates/goose/src/providers/anthropic_def.rs#L38-L40`](https://github.com/block/goose/blob/main/crates/goose/src/providers/anthropic_def.rs#L38-L40)
and appends `/v1/messages` itself, so `_claude_proxy_base_url(port)` is
already the correct value.

Note the README currently advertises `headroom wrap goose -- --provider
anthropic` as an example — that is the exact invocation that bypasses
the proxy. The OpenAI path was unaffected: goose does honour
`OPENAI_BASE_URL`.

## Type of Change

- [x] Bug fix (non-breaking change that fixes an issue)

## Changes Made

- Set `ANTHROPIC_HOST` alongside the existing vars in `wrap goose`
(`headroom/cli/wrap.py`), and show it in the launch banner.
- Extend `

**File**: `headroom/cli/wrap.py` (modified, +1/-0)
```diff
@@ -7868,6 +7868,7 @@ def _print_continue_setup(actual_port: int) -> None:
 
 
 # =============================================================================
+
 # OpenClaw
 # =============================================================================
 
```

**File**: `headroom/providers/wrap_registry.py` (modified, +3/-2)
```diff
@@ -160,14 +160,15 @@ def bob_preflight(env: Mapping[str, str], settings_path: Path | None = None) ->
                 EnvVar("OPENAI_BASE_URL", "openai_v1"),
                 EnvVar("OPENAI_API_BASE", "openai_v1", display=False),
                 EnvVar("ANTHROPIC_BASE_URL", "anthropic"),
+                EnvVar("ANTHROPIC_HOST", "anthropic"),
             ),
             project_prefix=False,
             help_text=(
                 "Launch Goose (Block) CLI through Headroom proxy.\n"
                 "\n"
                 "\b\n"
-                "Sets OPENAI_BASE_URL and ANTHROPIC_BASE_URL to route Goose's API calls\n"
-                "through Headroom.\n"
+                "Sets OPENAI_BASE_URL, ANTHROPIC_BASE_URL, and ANTHROPIC_HOST to route\n"
+                "Goose's API calls through Headroom.\n"
                 "\n"
                 "\b\n"
                 "Uninstall: there is no ``headroom unwrap goose`` subcommand — nothing is\n"
```

**File**: `tests/test_cli/test_wrap_goose.py` (modified, +6/-1)
```diff
@@ -26,7 +26,11 @@ def test_wrap_goose_sets_provider_envs(
     tmp_path: Path,
     monkeypatch: pytest.MonkeyPatch,
 ) -> None:
-    """OPENAI_BASE_URL, OPENAI_API_BASE, ANTHROPIC_BASE_URL are set on launch."""
+    """OPENAI_BASE_URL, OPENAI_API_BASE, ANTHROPIC_BASE_URL, ANTHROPIC_HOST are set.
+
+    Goose's Anthropic provider reads ANTHROPIC_HOST rather than
+    ANTHROPIC_BASE_URL, so the value is asserted rather than mere presence.
+    """
     monkeypatch.chdir(tmp_path)
     monkeypatch.delenv("HEADROOM_CONTEXT_TOOL", raising=False)
 
@@ -45,6 +49,7 @@ def fake_launch_tool(**kwargs):  # noqa: ANN003
     assert env["OPENAI_BASE_URL"] == "http://127.0.0.1:9000/v1"
     assert env["OPENAI_API_BASE"] == "http://127.0.0.1:9000/v1"
     assert env["ANTHROPIC_BASE_URL"] == "http://127.0.0.1:9000"
+    assert env["ANTHROPIC_HOST"] == "http://127.0.0.1:9000"
     assert captured["tool_label"] == "GOOSE"
     assert captured["agent_type"] == "goose"
     assert captured["args"] == ("session",)
```

**File**: `tests/test_cli/test_wrap_registry.py` (modified, +2/-1)
```diff
@@ -17,10 +17,11 @@
 
 def test_goose_banner_hides_openai_api_base_alias():
     _, display = build_launch_env(WRAP_TARGETS["goose"], 8787, environ={}, project="p")
-    # Legacy goose never encoded the project prefix and showed two vars only.
+    # Goose has no project prefix; its endpoint override is visible in the banner.
     assert display == [
         "OPENAI_BASE_URL=http://127.0.0.1:8787/v1",
         "ANTHROPIC_BASE_URL=http://127.0.0.1:8787",
+        "ANTHROPIC_HOST=http://127.0.0.1:8787",
     ]
 
 
```

---

### Incident Patch 5: `a05717f6` (2026-10-05)
**Commit Message**: fix(proxy): redact upstream error detail and add opt-in /metrics loopback gate (#2589)

## Description

Two response-path information-exposure hardenings for the native Rust
reverse proxy (`crates/headroom-proxy`). Both are defensive and
non-breaking; neither adds a user-facing capability nor changes
forwarding behaviour, and defaults are unchanged.

1. **Redact upstream error detail from client responses.**
`ProxyError::into_response` returned `self.to_string()` as the client
body, which for `reqwest` upstream errors interpolates the upstream
URL/host/port. It now returns a generic, stable message per status while
the full detail is retained in the server-side `tracing::warn!` log.
`413` intentionally stays descriptive (no internal detail; retry-on-413
clients rely on recognising it).
2. **Opt-in loopback gate for `/metrics`.** New
`--metrics-require-loopback` / `HEADROOM_PROXY_METRICS_REQUIRE_LOOPBACK`
(default `false`). When enabled, the Prometheus scrape returns `403` to
non-loopback peers. This is defense-in-depth for deployments that bind a
non-loopback `--listen`. Default-off preserves current behaviour
exactly.

## Type of Change

- [x] Bug fix (non-breaking change that fix

**File**: `RUST_DEV.md` (modified, +1/-0)
```diff
@@ -84,6 +84,7 @@ curl -si http://127.0.0.1:8787/v1/models
 | Flag | Env var | Default | Notes |
 | --- | --- | --- | --- |
 | `--listen` | `HEADROOM_PROXY_LISTEN` | `0.0.0.0:8787` | bind address |
+| `--metrics-require-loopback` | `HEADROOM_PROXY_METRICS_REQUIRE_LOOPBACK` | `false` | when set, `/metrics` is served only to loopback peers (403 otherwise); recommended on non-loopback binds |
 | `--upstream` | `HEADROOM_PROXY_UPSTREAM` | (required) | base URL the proxy forwards to |
 | `--upstream-timeout` |  | `600s` | end-to-end request timeout (long for streams) |
 | `--upstream-connect-timeout` |  | `10s` | TCP/TLS connect timeout |
```

**File**: `crates/headroom-proxy/src/config.rs` (modified, +28/-0)
```diff
@@ -276,6 +276,25 @@ pub struct CliArgs {
     #[arg(long, env = "HEADROOM_PROXY_LISTEN", default_value = "0.0.0.0:8787")]
     pub listen: SocketAddr,
 
+    /// Restrict the Prometheus `/metrics` scrape endpoint to loopback
+    /// clients. Default `false` to preserve existing behaviour (the
+    /// endpoint is reachable from wherever the proxy is bound). Set to
+    /// `true` — recommended whenever `--listen` binds a non-loopback
+    /// address — so `/metrics` (token counts, per-session cache-hit
+    /// rates, rate-limit gauges) is served only to `127.0.0.1` / `::1`
+    /// and returns 403 otherwise. This is defense-in-depth alongside
+    /// firewalling the path.
+    ///
+    /// Source priority: CLI flag → `HEADROOM_PROXY_METRICS_REQUIRE_LOOPBACK`
+    /// env var → default (`false`).
+    #[arg(
+        long = "metrics-require-loopback",
+        env = "HEADROOM_PROXY_METRICS_REQUIRE_LOOPBACK",
+        default_value_t = false,
+        action = clap::ArgAction::Set,
+    )]
+    pub metrics_require_loopback: bool,
+
     /// Upstream base URL the proxy forwards to (e.g. http://127.0.0.1:8788).
     /// REQUIRED — there is no default; we want operators to be explicit.
     #[arg(long, env = "HEADROOM_PROXY_UPSTREAM")]
@@ -617,6 +636,9 @@ pub struct Config {
     /// Runtime rollout state resolved from CLI/env.
     pub rollout: RolloutSnapshot,
     pub listen: SocketAddr,
+    /// Gate the Prometheus `/metrics` endpoint to loopback clients.
+    /// Default `false`; recommend `true` when `listen` is non-loopback.
+    pub metrics_require_loopback: bool,
     pub upstream: Url,
     pub upstream_timeout: Duration,
     pub upstream_connect_timeout: Duration,
@@ -725,6 +747,7 @@ impl Config {
         Self {
             rollout: rollout.clone(),
             listen: args.listen,
+            metrics_require_loopback: args.metrics_require_loopback,
             upstream: args.upstream,
             upstream_timeout: args.upstream_timeout,
             upstream_connect_timeout: args.upstream_connect_timeout,
@@ -761,6 +784,11 @@ impl Config {
         Self {
             rollout: RolloutSnapshot::default(),
             listen: "127.0.0.1:0".parse().unwrap(),
+            // Off by default in tests: the metrics integration tests
+            // scrape `/metrics` and assert 200, and oneshot-style tests
+            // carry no `ConnectInfo`. Tests that exercise the gate set
+            // this to `true` explicitly.
+            metrics_require_loopback: false,
             upstream,
             upstream_timeout: Duration::from_secs(60),
             upstream_connect_timeout: Duration::from_secs(5),
```

**File**: `crates/headroom-proxy/src/error.rs` (modified, +81/-18)
```diff
@@ -55,30 +55,93 @@ impl From<crate::upstream_path::PathError> for ProxyError {
 
 impl IntoResponse for ProxyError {
     fn into_response(self) -> Response {
-        let (status, msg) = match &self {
-            ProxyError::Upstream(e) if e.is_timeout() => (
-                StatusCode::GATEWAY_TIMEOUT,
-                format!("upstream timeout: {e}"),
-            ),
-            ProxyError::Upstream(e) if e.is_connect() => (
-                StatusCode::BAD_GATEWAY,
-                format!("upstream connect error: {e}"),
+        // Full detail is for operators only. The `Display` impls above
+        // interpolate the source error (e.g. reqwest's chain), which for
+        // upstream failures can embed the upstream host/port and other
+        // internal wiring. We log that detail but return a generic,
+        // stable body to the client so an error response can't be used
+        // to fingerprint the upstream. The HTTP status still carries the
+        // actionable signal for well-behaved clients.
+        let detail = self.to_string();
+        let (status, client_msg): (StatusCode, &'static str) = match &self {
+            ProxyError::Upstream(e) if e.is_timeout() => {
+                (StatusCode::GATEWAY_TIMEOUT, "upstream timeout")
+            }
+            ProxyError::Upstream(e) if e.is_connect() => {
+                (StatusCode::BAD_GATEWAY, "upstream connection failed")
+            }
+            ProxyError::Upstream(_) => (StatusCode::BAD_GATEWAY, "upstream request failed"),
+            ProxyError::InvalidUpstream(_) => (StatusCode::BAD_GATEWAY, "upstream request failed"),
+            ProxyError::InvalidHeader(_) => (StatusCode::BAD_REQUEST, "invalid request"),
+            // PayloadTooLarge stays descriptive: it leaks no internal
+            // detail (the interpolated value is the client's own size vs
+            // the configured cap) and clients with retry-on-413 logic
+            // rely on recognizing it. See the PayloadTooLarge doc comment.
+            ProxyError::PayloadTooLarge(_) => (
+                StatusCode::PAYLOAD_TOO_LARGE,
+                "request body exceeds configured limit",
             ),
-            ProxyError::Upstream(_) => (StatusCode::BAD_GATEWAY, self.to_string()),
-            ProxyError::InvalidUpstream(_) => (StatusCode::BAD_GATEWAY, self.to_string()),
-            ProxyError::InvalidHeader(_) => (StatusCode::BAD_REQUEST, self.to_string()),
-            ProxyError::PayloadTooLarge(_) => (StatusCode::PAYLOAD_TOO_LARGE, self.to_string()),
-            ProxyError::InvalidPath(_) => (StatusCode::BAD_REQUEST, self.to_string()),
-            ProxyError::WebSocket(_) => (StatusCode::BAD_GATEWAY, self.to_string()),
-            ProxyError::Io(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
+            ProxyError::InvalidPath(_) => (StatusCode::BAD_REQUEST, "invalid request"),
+            ProxyError::WebSocket(_) => (StatusCode::BAD_GATEWAY, "upstream request failed"),
+            ProxyError::Io(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal error"),
+
             // CompressionStartup is a startup-time error, not a
             // per-request one — but if it ever surfaces in the
             // handler path, surface as 500 rather than panic.
             ProxyError::CompressionStartup(_) => {
-                (StatusCode::INTERNAL_SERVER_ERROR, self.to_string())
+                (StatusCode::INTERNAL_SERVER_ERROR, "internal error")
             }
         };
-        tracing::warn!(error = %msg, "proxy error");
-        (status, msg).into_response()
+        tracing::warn!(status = %status.as_u16(), error = %detail, "proxy error");
+        (status, client_msg).into_response()
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use axum::body::to_bytes;
+
+    async fn status_and_body(err: ProxyError) -> (StatusCode, String) {
+        let resp = err.into_response();
+        let status = resp.status();
+        let bytes = to_bytes(resp.into_body(), 1024).await.unwrap();
+        (status, String::from_utf8_lossy(&bytes).to_string())
+    }
+
+    // The interpolated detail (which for real upstream errors can embed
+    // the upstream host/port) must NEVER reach the client body. Before
+    // the hardening these bodies were `self.to_string()` and DID contain
+    // the detail, so these assertions fail on old code.
+    #[tokio::test]
+    async fn invalid_header_detail_is_not_leaked_to_client() {
+        let (status, body) = status_and_body(ProxyError::InvalidHeader(
+            "upstream-secret-host:9443".into(),
+        ))
+        .await;
+        assert_eq!(status, StatusCode::BAD_REQUEST);
+        assert_eq!(body, "invalid request");
+        assert!(!body.contains("upstream-secret-host"));
+    }
+
+    #[tokio::test]
+    async fn invalid_upstream_detail_is_not_leaked_to_client() {
+        let (status, body) = status_and_body(ProxyError::InvalidUpstream(
+            "http://10.0.0.5:8788/inter
```

**File**: `crates/headroom-proxy/src/proxy.rs` (modified, +92/-8)
```diff
@@ -161,6 +161,36 @@ impl AppState {
     }
 }
 
+/// Per-route middleware for `/metrics`, attached only when
+/// `--metrics-require-loopback` is enabled. Rejects any scrape whose
+/// peer address is not loopback (`127.0.0.0/8` / `::1`) with
+/// `403 Forbidden`, keeping operational metrics off the wire on a
+/// non-loopback bind. Relies on the server being served with
+/// `ConnectInfo<SocketAddr>` (see `main.rs`); requests synthesised
+/// without connect info (e.g. `oneshot` in unit tests) would fail the
+/// `ConnectInfo` extractor — which is one reason the gate defaults off.
+async fn require_metrics_loopback(
+    ConnectInfo(peer): ConnectInfo<SocketAddr>,
+    req: Request<Body>,
+    next: axum::middleware::Next,
+) -> axum::response::Response {
+    if peer.ip().is_loopback() {
+        next.run(req).await
+    } else {
+        tracing::warn!(
+            event = "metrics_scrape_rejected_non_loopback",
+            peer = %peer,
+            "rejected /metrics scrape from non-loopback client \
+             (--metrics-require-loopback is enabled)"
+        );
+        (
+            StatusCode::FORBIDDEN,
+            "metrics endpoint restricted to loopback",
+        )
+            .into_response()
+    }
+}
+
 /// Build the axum app. `/healthz` and `/healthz/upstream` are intercepted;
 /// everything else hits the catch-all forwarder. WebSocket upgrades are
 /// handled inside the catch-all handler when an `Upgrade: websocket` header
@@ -170,14 +200,6 @@ pub fn build_app(state: AppState) -> Router {
         .route("/healthz", get(healthz))
         .route("/healthz/upstream", get(healthz_upstream))
         .route("/rollout/status", get(rollout_status))
-        // PR-D3: Prometheus scrape endpoint. Renders the global
-        // registry in text format. The handler is stateless — no
-        // `AppState` needed — and idempotent across concurrent
-        // scrapes (`prometheus`'s registry uses internal locking).
-        // Mounted unconditionally because it has no dependencies on
-        // any feature flag; an operator who doesn't want it scraped
-        // simply firewalls the path.
-        .route("/metrics", get(crate::observability::handle_metrics))
         // PR-C2: explicit POST route for /v1/chat/completions. The
         // handler buffers the body and re-injects it into
         // `forward_http`, which runs the OpenAI live-zone gate
@@ -212,6 +234,27 @@ pub fn build_app(state: AppState) -> Router {
             post(crate::vertex::handle_vertex_predict_dispatch),
         );
 
+    // PR-D3: Prometheus scrape endpoint. Renders the global registry in
+    // text format. The handler is stateless — no `AppState` needed — and
+    // idempotent across concurrent scrapes (`prometheus`'s registry uses
+    // internal locking). Mounted as its own sub-router so the optional
+    // loopback gate can wrap ONLY this route. `/metrics` exposes
+    // operational detail (token counts, per-session cache-hit rates,
+    // rate-limit gauges); when `--metrics-require-loopback` is set,
+    // `require_metrics_loopback` rejects non-loopback peers with 403 —
+    // defense-in-depth alongside firewalling the path. Default off,
+    // preserving the previous "mounted unconditionally; operator
+    // firewalls the path" behaviour.
+    let metrics_router: Router<AppState> = {
+        let base = Router::new().route("/metrics", get(crate::observability::handle_metrics));
+        if state.config.metrics_require_loopback {
+            base.route_layer(axum::middleware::from_fn(require_metrics_loopback))
+        } else {
+            base
+        }
+    };
+    router = router.merge(metrics_router);
+
     // PR-D1: native AWS Bedrock InvokeModel route. Mounts only when
     // `enable_bedrock_native` is on (default). The handler runs the
     // live-zone compressor over Anthropic-shape bodies, signs with
@@ -1697,6 +1740,47 @@ mod tests {
         assert_eq!(out.as_str(), "http://up:8080/");
     }
 
+    // `require_metrics_loopback` gate, driven directly via `oneshot`
+    // with a manually-injected `ConnectInfo` so BOTH branches are
+    // covered — including the non-loopback 403 path the real-server
+    // integration test can't reach from a loopback-only client.
+    fn metrics_gate_router() -> Router {
+        Router::new()
+            .route("/metrics", get(|| async { "metrics-body" }))
+            .route_layer(axum::middleware::from_fn(require_metrics_loopback))
+    }
+
+    async fn scrape_status_from(peer: &str) -> StatusCode {
+        use tower::util::ServiceExt;
+        let mut req = Request::builder()
+            .method("GET")
+            .uri("/metrics")
+            .body(Body::empty())
+            .unwrap();
+        let addr: SocketAddr = peer.parse().unwrap();
+        req.extensions_mut().insert(ConnectInfo(addr));
+        metrics_gate_router().oneshot(req).await.unwrap().status()
+    }
+
+    #[tokio::test]
+    async fn metrics_gate_allows_ipv4_loo
```

**File**: `crates/headroom-proxy/tests/integration_metrics_loopback.rs` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+//! `/metrics` loopback-gate integration coverage.
+//!
+//! `--metrics-require-loopback` (`Config::metrics_require_loopback`)
+//! restricts the Prometheus scrape endpoint to loopback peers as
+//! defense-in-depth for non-loopback binds. The shared harness serves
+//! the app over a real `127.0.0.1` listener with
+//! `ConnectInfo<SocketAddr>`, so a reqwest client here is itself a
+//! loopback peer: with the gate ON the scrape must STILL succeed (200),
+//! proving the middleware is wired correctly and never breaks the
+//! legitimate local-scrape path. The non-loopback rejection (403) path
+//! can't be driven from a loopback-only test client; it is enforced by
+//! the middleware's `peer.ip().is_loopback()` check in
+//! `crate::proxy::require_metrics_loopback`.
+
+mod common;
+
+use common::start_proxy_with;
+
+/// Gate ON: a loopback client is still allowed through, so the scrape
+/// returns 200 with the usual Prometheus descriptor lines.
+#[tokio::test]
+async fn metrics_gate_allows_loopback_scrape() {
+    // Upstream is never contacted — `/metrics` is served locally.
+    let proxy = start_proxy_with("http://127.0.0.1:1", |cfg| {
+        cfg.metrics_require_loopback = true;
+    })
+    .await;
+
+    let resp = reqwest::Client::new()
+        .get(format!("{}/metrics", proxy.url()))
+        .send()
+        .await
+        .expect("metrics scrape");
+
+    assert_eq!(
+        resp.status(),
+        200,
+        "loopback client must still pass the metrics loopback gate"
+    );
+    let body = resp.text().await.unwrap();
+    assert!(
+        body.contains("# HELP") || body.contains("# TYPE"),
+        "scrape body should carry Prometheus metric descriptors"
+    );
+}
+
+/// Gate OFF (default): unchanged behaviour — the scrape is served.
+#[tokio::test]
+async fn metrics_default_open_serves_scrape() {
+    let proxy = start_proxy_with("http://127.0.0.1:1", |_| {}).await;
+
+    let resp = reqwest::Client::new()
+        .get(format!("{}/metrics", proxy.url()))
+        .send()
+        .await
+        .expect("metrics scrape");
+
+    assert_eq!(resp.status(), 200);
+}
```

---

### Incident Patch 6: `5119b6eb` (2026-10-05)
**Commit Message**: fix(security): create memory stores and other state files owner-only (#3848)

## Why

The memory databases hold facts extracted from conversations, together
with the user id they belong to. These files were created at the process
umask, which is `0644` on a stock host, so any other local account could
read them. The same was true of the FTS, graph and sqlite-vec stores,
the HNSW index file and metadata dump (vectors, raw embeddings and
memory metadata), the licence validation cache and the native memory
directory. The CCR store already did this right with its own private
copy of the logic. This is finding 02-F2.

## What changes

`headroom/fileperms.py` gains shared helpers, and every core call site
uses them:

- `ensure_private_file(path, what=)`: makes a path an owner-only regular
file before a by-path opener such as sqlite touches it. New files are
created `0600` with `O_EXCL`. An existing file is narrowed through an
`O_NOFOLLOW` descriptor. A symlink or non-regular file raises
`PermissionError` (fails closed). This is the CCR store's existing
logic, moved here.
- `connect_private_sqlite(path, what=, **kw)`: `sqlite3.connect` through
`ensure_private_file`. Only genuine in-memory

**File**: `headroom/cache/backends/sqlite.py` (modified, +8/-59)
```diff
@@ -22,13 +22,14 @@
 import logging
 import os
 import sqlite3
-import stat
 import threading
 import time
 from dataclasses import asdict, fields
 from pathlib import Path
 from typing import TYPE_CHECKING, Any
 
+from ...fileperms import ensure_private_file
+
 if TYPE_CHECKING:
     from ..compression_store import CompressionEntry
 
@@ -90,65 +91,13 @@ def _ensure_private(path: Path) -> None:
 
         The originals stored here can contain sensitive tool output (file
         contents, command output). ``mkdir`` created the parent at the umask
-        default (typically world-traversable ``0o755``), and sqlite would
-        otherwise create the db file itself at the umask default too — leaving it
-        world/group readable. This creates the file with an explicit ``0o600``
-        mode before ``sqlite3.connect`` runs (a *new* db is private from birth;
-        sqlite treats the empty file as a fresh database), or narrows a
-        pre-existing db.
-
-        A store of raw tool output must not be opened world-readable, so a
-        failure to create or narrow it privately **raises** rather than silently
-        proceeding to open a wide file.
-
-        The existing-file path is symlink-race resistant. ``O_EXCL`` on the
-        create refuses to reuse an attacker-planted file or symlink. When the
-        file already exists it is re-opened with ``O_NOFOLLOW`` and narrowed
-        through that descriptor (``fstat`` to confirm a regular file, ``fchmod``
-        to set the mode) rather than by re-resolving the path: a symlink is
-        refused at the ``open`` syscall, and operating on the verified
-        descriptor closes the check-then-chmod TOCTOU that a ``chmod(path)``
-        (which follows symlinks) would leave open. On Windows POSIX permission
-        bits and ``O_NOFOLLOW`` do not apply, so there is nothing to narrow.
+        default and sqlite would create the db at the umask default too, so the
+        file is created (or an existing one narrowed) through
+        :func:`headroom.fileperms.ensure_private_file`, which is symlink-race
+        resistant and raises :class:`PermissionError` rather than opening a
+        wide file. See that function for the exact guarantee per platform.
         """
-        # Fast path: create the file ourselves. O_EXCL (plus O_NOFOLLOW where
-        # available) refuses to reuse an existing file or follow a planted
-        # symlink, so a brand-new db is private from birth at 0o600.
-        create_flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
-        if hasattr(os, "O_NOFOLLOW"):
-            create_flags |= os.O_NOFOLLOW
-        try:
-            os.close(os.open(path, create_flags, 0o600))
-            return
-        except FileExistsError:
-            pass
-
-        # The file already exists. Without POSIX no-follow/fd primitives
-        # (Windows) permission bits do not apply and there is no symlink-race
-        # hardening to perform; sqlite opens by path as before.
-        if not (hasattr(os, "O_NOFOLLOW") and hasattr(os, "fchmod")):
-            return
-
-        # Narrow the existing file, but only after proving — through a single
-        # no-follow descriptor — that it is a real regular file. A symlink is
-        # refused by O_NOFOLLOW (fail closed), and chmod-ing the descriptor
-        # rather than the path means an attacker cannot swap the inode we
-        # verified between the check and the narrow.
-        try:
-            fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
-        except OSError as exc:
-            raise PermissionError(
-                f"refusing to open CCR store at {path}: not a regular file "
-                f"(symlink or open error: {exc})"
-            ) from exc
-        try:
-            if not stat.S_ISREG(os.fstat(fd).st_mode):
-                raise PermissionError(f"refusing to open CCR store at {path}: not a regular file")
-            # os.fchmod is POSIX-only (guarded by the hasattr check above); the
-            # ignore keeps type-checking clean on Windows where it is absent.
-            os.fchmod(fd, 0o600)  # type: ignore[attr-defined]
-        finally:
-            os.close(fd)
+        ensure_private_file(path, what="CCR store")
 
     def _open(self) -> sqlite3.Connection:
         self._ensure_private(self._path)
```

**File**: `headroom/fileperms.py` (modified, +185/-7)
```diff
@@ -3,8 +3,22 @@
 Headroom's runtime log (``~/.headroom/logs/proxy-<port>.log``) and the optional
 JSONL request log can both carry verbatim request and response content: wire
 debug dumps, ``--log-messages`` bodies, and — when an operator opts in — CCR
-payload previews. None of that should be created at the process umask, which on
-a stock developer machine means ``0644``: world-readable.
+payload previews. The CCR retrieval store holds verbatim tool output, and the
+memory databases hold facts extracted from conversations together with the
+user id they belong to. None of that should be created at the process umask,
+which on a stock developer machine means ``0644``: world-readable.
+
+This module is the one place that knows how to create such a file privately,
+so every store uses the same rules and a reviewer can read the guarantee off
+one file. Extensions that keep their own state (Shield, Foresight, Kiro, the
+router) should call these helpers rather than ``sqlite3.connect`` /
+``Path.write_text`` directly:
+
+* :func:`open_owner_only` — open a log or text file for append or write.
+* :func:`ensure_private_file` — make a path a private regular file *before*
+  a library that opens by path (sqlite) touches it.
+* :func:`connect_private_sqlite` — ``sqlite3.connect`` through the above.
+* :func:`private_dir` — create a directory that will hold such files.
 
 Scope of the guarantee — read this before citing it in a threat model:
 
@@ -33,20 +47,27 @@
 
 from __future__ import annotations
 
+import functools
 import os
+import sqlite3
 import stat
+from pathlib import Path
 from typing import IO, Any
+from urllib.parse import parse_qs, unquote, urlsplit
 
 #: Mode for every runtime file Headroom creates that may hold request content.
 OWNER_ONLY_MODE = 0o600
 
+#: Mode for directories that hold such files.
+OWNER_ONLY_DIR_MODE = 0o700
+
 #: ``True`` only where the mode bits above actually decide who can read the
 #: file. See the module docstring for why Windows is excluded.
 OWNER_ONLY_SUPPORTED = os.name == "posix"
 
 
-def _open_flags() -> int:
-    flags = os.O_CREAT | os.O_WRONLY | os.O_APPEND
+def _open_flags(*, truncate: bool = False) -> int:
+    flags = os.O_CREAT | os.O_WRONLY | (os.O_TRUNC if truncate else os.O_APPEND)
     # Refuse to open through a symlink where the platform can enforce it, so a
     # planted link cannot redirect either the write or the chmod. Absent on
     # Windows, where getattr() leaves the flag out.
@@ -97,22 +118,179 @@ def open_owner_only(
     *,
     encoding: str | None = None,
     errors: str | None = None,
+    newline: str | None = None,
 ) -> IO[Any]:
-    """Open *path* for append, creating it owner-only.
+    """Open *path* for append (``"a"``) or write (``"w"``), creating it owner-only.
 
     Raises ``OSError`` — which every caller already treats as "logging is
     unavailable, carry on" — if the path cannot be opened, including when it is
     a symlink on a platform with ``O_NOFOLLOW``. Failing closed is deliberate:
     a redirected sensitive log is worse than no log.
     """
-    fd = os.open(path, _open_flags(), OWNER_ONLY_MODE)
+    if mode[:1] not in ("a", "w"):
+        raise ValueError(f"open_owner_only: mode must start with 'a' or 'w', got {mode!r}")
+    fd = os.open(path, _open_flags(truncate=mode.startswith("w")), OWNER_ONLY_MODE)
     try:
         restrict_fd_to_owner(fd)
-        return open(fd, mode, encoding=encoding, errors=errors, closefd=True)
+        return open(fd, mode, encoding=encoding, errors=errors, newline=newline, closefd=True)
     except BaseException:
         try:
             os.close(fd)
         except OSError:
             # open() can have taken and closed the descriptor on its way out.
             pass
         raise
+
+
+def ensure_private_file(path: str | os.PathLike[str], *, what: str = "file") -> None:
+    """Make *path* an owner-only regular file before a by-path opener touches it.
+
+    For libraries that open files by path and create them at the umask —
+    sqlite above all. Creating the file here first, with an explicit
+    ``0o600`` mode, means a *new* database is private from birth (sqlite
+    treats an empty file as a fresh database, and creates its ``-wal`` /
+    ``-shm`` sidecars with the same mode as the main file). A pre-existing
+    file left wide by an earlier run is narrowed.
+
+    Fails **closed**: a store of conversation or tool content must not be
+    opened world-readable, so a failure to create or narrow the file privately
+    raises :class:`PermissionError` rather than proceeding to open a wide
+    file. The existing-file path is symlink-race resistant — ``O_EXCL`` on the
+    create refuses to reuse a planted file or symlink; an existing file is
+    re-opened with ``O_NOFOLLOW`` and narrowed through that descriptor
+    (``fstat`` to confirm a regular file, ``fchmod`` to set the mode) rather
+    than by re-resolving the path, which closes the check-then-chmod TOCTOU a
+    
```

**File**: `headroom/memory/adapters/fts5.py` (modified, +2/-1)
```diff
@@ -14,6 +14,7 @@
 from pathlib import Path
 from typing import TYPE_CHECKING, Any
 
+from ...fileperms import connect_private_sqlite
 from ..models import Memory
 from ..ports import TextFilter, TextSearchResult
 
@@ -75,7 +76,7 @@ def _get_conn(self) -> Iterator[sqlite3.Connection]:
         Commits on clean exit, rolls back on exception, and always closes
         the connection -- callers use ``with self._get_conn() as conn:``.
         """
-        conn = sqlite3.connect(str(self.db_path))
+        conn = connect_private_sqlite(self.db_path, what="memory text index")
         conn.row_factory = sqlite3.Row
         try:
             with conn:
```

**File**: `headroom/memory/adapters/hnsw.py` (modified, +8/-2)
```diff
@@ -23,6 +23,7 @@
 
 import numpy as np
 
+from ...fileperms import ensure_private_file, open_owner_only
 from ..models import Memory, ScopeLevel, normalize_entity_refs
 from ..ports import VectorFilter, VectorSearchResult
 
@@ -812,8 +813,11 @@ def save_index(self, path: str | Path) -> None:
         path = Path(path)
 
         with self._lock:
-            # Save HNSW index
+            # Save HNSW index. hnswlib opens the path itself and would create
+            # it at the umask, so make it a private regular file first (refusing
+            # a symlink); its truncating write keeps the 0600 mode.
             hnsw_path = path.with_suffix(".hnsw")
+            ensure_private_file(hnsw_path, what="HNSW index")
             self._index.save_index(str(hnsw_path))
 
             # Save metadata, mappings, and embeddings
@@ -834,7 +838,9 @@ def save_index(self, path: str | Path) -> None:
                 "embeddings": {mid: emb.tolist() for mid, emb in self._embeddings.items()},
             }
 
-            with open(meta_path, "w") as f:
+            # Memory metadata and raw embeddings: owner-only, like every other
+            # memory store file.
+            with open_owner_only(meta_path, "w") as f:
                 json.dump(meta_data, f)
 
     def load_index(self, path: str | Path) -> None:
```

**File**: `headroom/memory/adapters/sqlite.py` (modified, +4/-1)
```diff
@@ -17,6 +17,7 @@
 from pathlib import Path
 from typing import TYPE_CHECKING, Any
 
+from ...fileperms import connect_private_sqlite
 from ..models import Memory, ScopeLevel, normalize_entity_refs
 from ..ports import MemoryFilter
 
@@ -82,8 +83,10 @@ def _get_conn(self) -> Iterator[sqlite3.Connection]:
 
         Commits on clean exit, rolls back on exception, and always closes
         the connection -- callers use ``with self._get_conn() as conn:``.
+        The file is created, or narrowed, owner-only before sqlite opens it:
+        it holds memory content and the user ids it belongs to.
         """
-        conn = sqlite3.connect(str(self.db_path))
+        conn = connect_private_sqlite(self.db_path, what="memory store")
         conn.row_factory = sqlite3.Row
         try:
             with conn:
```

**File**: `headroom/memory/adapters/sqlite_graph.py` (modified, +2/-1)
```diff
@@ -23,6 +23,7 @@
 from threading import RLock
 from typing import TYPE_CHECKING, Any
 
+from ...fileperms import connect_private_sqlite
 from .graph_models import Entity, Relationship, RelationshipDirection, Subgraph
 
 if TYPE_CHECKING:
@@ -84,7 +85,7 @@ def _get_conn(self) -> Iterator[sqlite3.Connection]:
         Commits on clean exit, rolls back on exception, and always closes
         the connection -- callers use ``with self._get_conn() as conn:``.
         """
-        conn = sqlite3.connect(str(self.db_path))
+        conn = connect_private_sqlite(self.db_path, what="memory graph store")
         conn.row_factory = sqlite3.Row
 
         # Configure page cache size (negative = KB, positive = pages)
```

**File**: `headroom/memory/adapters/sqlite_vector.py` (modified, +3/-2)
```diff
@@ -29,6 +29,7 @@
 
 import numpy as np
 
+from ...fileperms import connect_private_sqlite
 from ..models import Memory, ScopeLevel, normalize_entity_refs
 from ..ports import VectorFilter, VectorSearchResult
 
@@ -235,8 +236,8 @@ def __init__(
         self._init_db()
 
     def _create_conn(self) -> sqlite3.Connection:
-        """Create a SQLite connection with sqlite-vec loaded."""
-        conn = sqlite3.connect(str(self._db_path))
+        """Create a SQLite connection with sqlite-vec loaded (file owner-only)."""
+        conn = connect_private_sqlite(self._db_path, what="memory vector index")
         conn.row_factory = sqlite3.Row
 
         # Load sqlite-vec extension
```

**File**: `headroom/memory/traffic_learner.py` (modified, +3/-1)
```diff
@@ -1511,7 +1511,9 @@ async def _bump_persisted_evidence(self, memory_id: str) -> None:
         now_iso = datetime.now(timezone.utc).isoformat()
 
         def _bump() -> bool:
-            conn = sqlite3.connect(str(db_path))
+            from ..fileperms import connect_private_sqlite
+
+            conn = connect_private_sqlite(db_path, what="memory store")
             try:
                 cursor = conn.execute(
                     "UPDATE memories SET metadata = json_set("
```

---

### Incident Patch 7: `119d1a19` (2026-10-05)
**Commit Message**: fix(offline): make HEADROOM_OFFLINE a real air-gap via one chokepoint (#3729)

## Description

**Revised 2026-10-05 after review: merged current `main`, routed main's
new TLS-diagnostic egress (`doctor --network` and the TLS-error chain
re-probe) through `guard_egress`, made the test socket trap let loopback
through so the async offline tests run on Windows, and closed five
model-loader findings from Devin Review.**

`HEADROOM_OFFLINE=1` is documented as an air-gap switch, but several
egress paths never consulted `headroom/offline.py`. This PR makes
`guard_egress` the single chokepoint every Headroom-initiated outbound
connection goes through, with a per-site meta-test that fails on any new
unguarded egress. Full detail of every revision is under *Changes Made*.

## Type of Change

- [x] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [x] Breaking change (fix or feature that would cause existing
functionality to change) — outbound calls that previously worked with
`HEADROOM_OFFLINE=1` set now refuse; see *Behaviour change customers can
see*
- [x] Documentation update
- [ ] Performance improvement
- [ ] Code refacto

**File**: `crates/headroom-core/src/lib.rs` (modified, +19/-0)
```diff
@@ -8,6 +8,7 @@ pub mod auth_mode;
 pub mod cache_control;
 pub mod ccr;
 pub mod compression_policy;
+pub mod offline;
 #[cfg(feature = "ml")]
 mod onnx_cpu;
 pub mod relevance;
@@ -29,6 +30,24 @@ pub fn hello() -> &'static str {
     "headroom-core"
 }
 
+#[cfg(test)]
+pub(crate) mod test_support {
+    use std::sync::{Mutex, MutexGuard};
+
+    /// The process environment is global while `cargo test` runs tests in
+    /// parallel threads inside one process, so a test that sets an env var can
+    /// be observed by an unrelated sibling mid-assertion. Every test that
+    /// mutates the environment holds this for its whole body. Same shape as
+    /// `REGISTRY_LOCK` in `tokenizer::registry`.
+    static ENV_LOCK: Mutex<()> = Mutex::new(());
+
+    /// Recovers from poisoning on purpose: one panicking test should not
+    /// cascade into every later test that touches the environment.
+    pub(crate) fn env_lock() -> MutexGuard<'static, ()> {
+        ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner())
+    }
+}
+
 #[cfg(test)]
 mod tests {
     use super::*;
```

**File**: `crates/headroom-core/src/offline.rs` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+//! Air-gap / no-egress master switch (`HEADROOM_OFFLINE`) — Rust half.
+//!
+//! The Python side lives in `headroom/offline.py`. This is the same switch
+//! read by the same environment variable with the same truthiness rules, so a
+//! deployment that sets `HEADROOM_OFFLINE=1` gets identical behaviour whether
+//! the egress attempt originates in the Python proxy or in a Rust core path.
+//!
+//! Two functions, mirroring the Python module deliberately:
+//!
+//! - [`is_offline`] — the predicate, for code that wants to take a different
+//!   route (use a cached artifact, skip an optional refresh).
+//! - [`guard_egress`] — the chokepoint, for code that is about to open a
+//!   socket. It returns [`OfflineEgressBlocked`], a distinct error type, so a
+//!   caller that otherwise degrades gracefully on network failure can still
+//!   tell "the operator air-gapped this box" from "the network was flaky" and
+//!   refuse loudly instead of silently falling back.
+//!
+//! # Parity contract
+//!
+//! `HEADROOM_OFFLINE` is true for `1`, `true`, `yes`, `on` — trimmed and
+//! ASCII-case-insensitive — and false for anything else, including unset and
+//! empty. Any change here must be mirrored in `headroom/offline.py`'s
+//! `_TRUE_VALUES`, and vice versa: the two implementations are a pair, and a
+//! deployment that reads as offline to Python but online to Rust is precisely
+//! the failure this module exists to prevent.
+//!
+//! The parity covers **normalisation**, not just the accepted values. This
+//! used to call `str::trim()` while Python called `str.strip()`, and those are
+//! not the same set: Python's strips U+001C-U+001F (the ASCII file/group/
+//! record/unit separators) because `str.isspace()` includes them, Rust's does
+//! not because the Unicode `White_Space` property does not. `HEADROOM_OFFLINE`
+//! set to `"\x1c1"` read as offline to Python and online to Rust — one
+//! environment variable, one process air-gapped and the other not. Both sides
+//! now trim exactly [`TRIM_CHARS`].
+
+use std::env;
+
+use thiserror::Error;
+
+/// The environment variable that selects fully-offline operation.
+pub const OFFLINE_ENV: &str = "HEADROOM_OFFLINE";
+
+/// Values that read as "yes, offline". Kept byte-identical to the Python
+/// side's `_TRUE_VALUES` (see the parity contract in the module docs).
+const TRUE_VALUES: [&str; 4] = ["1", "true", "yes", "on"];
+
+/// Whitespace trimmed off the raw value before matching. Enumerated rather
+/// than left to `str::trim()`, which is the Unicode `White_Space` property and
+/// does not agree with Python's `str.strip()`. Kept byte-identical to the
+/// Python side's `_TRIM_CHARS` (see the parity contract in the module docs).
+const TRIM_CHARS: [char; 6] = [' ', '\t', '\n', '\r', '\u{b}', '\u{c}'];
+
+/// An egress attempt was refused because `HEADROOM_OFFLINE` is in force.
+///
+/// Carries the human-readable `purpose` and `destination` handed to
+/// [`guard_egress`] so the operator learns which feature to turn off rather
+/// than just that "something" was blocked.
+#[derive(Debug, Clone, Error)]
+#[error(
+    "{OFFLINE_ENV} is set: refusing outbound network access for {purpose} to \
+     {destination}. Unset {OFFLINE_ENV}, or turn off the feature that needs \
+     this connection."
+)]
+pub struct OfflineEgressBlocked {
+    pub purpose: String,
+    pub destination: String,
+}
+
+/// Return `true` when `HEADROOM_OFFLINE` selects fully-offline operation.
+pub fn is_offline() -> bool {
+    match env::var(OFFLINE_ENV) {
+        Ok(raw) => {
+            let normalized = raw.trim_matches(TRIM_CHARS.as_slice()).to_ascii_lowercase();
+            TRUE_VALUES.contains(&normalized.as_str())
+        }
+        // Unset, or not valid UTF-8 — neither is an opt-in to offline mode.
+        Err(_) => false,
+    }
+}
+
+/// The chokepoint every Rust egress path must call before opening a socket.
+///
+/// `Ok(())` when online; `Err(OfflineEgressBlocked)` when `HEADROOM_OFFLINE`
+/// is set. Call it *before* constructing the HTTP client, not merely before
+/// the request — several clients (`ureq`, `reqwest`) resolve DNS or warm a
+/// connection pool during setup, so a guard placed at the request would leak
+/// the very packets the air-gap switch promises not to send.
+pub fn guard_egress(purpose: &str, destination: &str) -> Result<(), OfflineEgressBlocked> {
+    if is_offline() {
+        return Err(OfflineEgressBlocked {
+            purpose: purpose.to_string(),
+            destination: destination.to_string(),
+        });
+    }
+    Ok(())
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use crate::test_support::env_lock;
+
+    #[test]
+    fn unset_is_online() {
+        let _guard = env_lock();
+        env::remove_var(OFFLINE_ENV);
+        assert!(!is_offline());
+        assert!(guard_egress("anything", "https://example.invalid").is_ok());
+    }
+
+    #[test]
+    fn truthy_values_match_python() {
+        let _guard = e
```

**File**: `crates/headroom-core/src/relevance/embedding.rs` (modified, +38/-1)
```diff
@@ -98,6 +98,22 @@ impl EmbeddingScorer {
     /// quality/speed tradeoff for compression-relevance scoring on
     /// short snippets.
     pub fn try_new_with_model(model_kind: EmbeddingModel) -> Result<Self, String> {
+        let name = format!("{:?}", model_kind);
+        // Air-gap chokepoint, FIRST thing in the function. `TextEmbedding::
+        // try_new` resolves the model's ONNX weights through `hf-hub`, which
+        // downloads from huggingface.co on a cache miss even with
+        // `HF_HUB_OFFLINE` set — the same hole the tokenizer and Kompress model
+        // fetches had. It sits ahead of the AVX2 and ort-loader probes below so
+        // that an air-gapped box reports the policy refusal rather than
+        // whichever local prerequisite happened to be missing as well.
+        //
+        // The refusal is soft here by design: this function already returns
+        // `Err(String)` for "ONNX runtime unavailable" and every caller degrades
+        // to the BM25 scorer, so an air-gapped box loses embedding relevance
+        // instead of failing a request. The message names the switch so the
+        // operator can tell the two causes apart in the log.
+        crate::offline::guard_egress("fastembed embedding model download", &name)
+            .map_err(|e| format!("EmbeddingScorer model load refused: {e}"))?;
         // fastembed links the precompiled ONNX Runtime binary, which contains
         // AVX2 instructions on x86. Loading/running it on a non-AVX2 CPU traps
         // with SIGILL (issue #1723) — an uncatchable native fault. Bail early so
@@ -113,7 +129,6 @@ impl EmbeddingScorer {
         // `dynamic_ort_loader_ready`).
         crate::transforms::magika_detector::dynamic_ort_loader_ready()
             .map_err(|e| format!("EmbeddingScorer: ONNX Runtime unavailable: {e}"))?;
-        let name = format!("{:?}", model_kind);
         let model = TextEmbedding::try_new(InitOptions::new(model_kind))
             .map_err(|e| format!("EmbeddingScorer model load failed: {}", e))?;
         Ok(EmbeddingScorer {
@@ -308,6 +323,28 @@ mod tests {
         std::env::var("RUN_FASTEMBED_TESTS").is_ok()
     }
 
+    /// `try_new_with_model` must refuse before fastembed resolves the model,
+    /// and must say so in the returned message rather than looking like an
+    /// ordinary load failure — the caller only ever sees the `String`.
+    ///
+    /// Not gated on `RUN_FASTEMBED_TESTS`: the whole point is that no network
+    /// call happens, so this is safe to run in CI. If the guard were removed
+    /// this test would either download ~30 MB or fail with a load error, and
+    /// neither says "refused".
+    #[cfg(feature = "ml")]
+    #[test]
+    fn try_new_refuses_while_offline() {
+        let _guard = crate::test_support::env_lock();
+        std::env::set_var(crate::offline::OFFLINE_ENV, "1");
+        let result = EmbeddingScorer::try_new();
+        std::env::remove_var(crate::offline::OFFLINE_ENV);
+
+        let err = result.err().expect("guard must refuse while offline");
+        assert!(err.contains("refused"), "{err}");
+        assert!(err.contains(crate::offline::OFFLINE_ENV), "{err}");
+        assert!(err.contains("fastembed embedding model download"), "{err}");
+    }
+
     /// Construct a stub scorer with `model = None` for offline-safe
     /// tests of the unavailable-path behavior.
     #[cfg(feature = "ml")]
```

**File**: `crates/headroom-core/src/tokenizer/hf_impl.rs` (modified, +66/-0)
```diff
@@ -49,6 +49,13 @@ pub enum HfTokenizerError {
         #[source]
         source: Box<dyn std::error::Error + Send + Sync>,
     },
+    /// `HEADROOM_OFFLINE` is set, so the Hub fetch was refused before any
+    /// socket was opened. Deliberately a separate variant from [`Self::Hub`]:
+    /// a caller that retries or falls back on a transient download failure
+    /// must not do either here — the operator asked for no egress, and
+    /// retrying an air-gap refusal is just a slower refusal.
+    #[error(transparent)]
+    Offline(#[from] crate::offline::OfflineEgressBlocked),
 }
 
 /// Token counter backed by a HuggingFace `tokenizer.json`.
@@ -110,11 +117,35 @@ impl HfTokenizer {
     /// processes hit the on-disk cache.
     ///
     /// Errors:
+    /// - [`HfTokenizerError::Offline`] when `HEADROOM_OFFLINE` is set. Refused
+    ///   before any socket is opened; see below.
     /// - [`HfTokenizerError::Hub`] for download failures (no network, 404,
     ///   401 on a gated model without `HF_TOKEN`).
     /// - [`HfTokenizerError::Load`] if the downloaded bytes don't parse as
     ///   a valid `tokenizer.json`. Should not happen for healthy HF repos.
     pub fn from_pretrained(repo: &str) -> Result<Self, HfTokenizerError> {
+        // Air-gap chokepoint, matching `headroom/offline.py`'s `guard_egress`.
+        // This is the Rust half of the same switch, so an operator who sets
+        // HEADROOM_OFFLINE=1 gets the same refusal whichever runtime reaches
+        // for the Hub.
+        //
+        // It has to sit here rather than around the `get` below: `Api::new`
+        // builds the `ureq` agent and resolves the endpoint, and hf-hub's own
+        // HF_HUB_OFFLINE handling only covers the cache lookup — a cache miss
+        // still dials out. Guarding first means the air-gapped case never
+        // constructs a client at all.
+        //
+        // The refusal is hard on purpose. Silently returning a cached or
+        // estimating tokenizer would leave token counts subtly wrong with no
+        // signal; the caller (`tokenizer::registry::try_register_hf`) already
+        // propagates the error so the operator sees which repo was wanted.
+        //
+        // Note it refuses even on a warm cache: `hf-hub` 0.5 exposes no
+        // cache-hit/cache-miss split at this layer, so "guard before the
+        // client exists" and "serve from the cache" cannot both hold here. An
+        // air-gapped deployment with pre-seeded artifacts should point at them
+        // with `from_file`, which is network-free by construction.
+        crate::offline::guard_egress("HuggingFace tokenizer download", repo)?;
         let api = hf_hub::api::sync::Api::new().map_err(|e| HfTokenizerError::Hub {
             repo: repo.to_string(),
             source: Box::new(e),
@@ -260,6 +291,41 @@ mod tests {
         assert!(Arc::ptr_eq(&a.inner, &b.inner));
     }
 
+    /// A-2: `HEADROOM_OFFLINE=1` must stop the Hub fetch before a socket exists.
+    ///
+    /// The repo name is deliberately one that cannot exist, which is what makes
+    /// this a real assertion rather than a tautology: without the guard the call
+    /// reaches `hf-hub`, dials `huggingface.co`, gets a 401/404 and returns
+    /// `HfTokenizerError::Hub`. Only the guard can produce `Offline`, and only
+    /// by returning before `Api::new` — so `Offline` *is* the "no socket was
+    /// opened" assertion for this path. (A packet-level assertion is not
+    /// available to a `cargo test` unit test the way `socket.socket` patching is
+    /// in Python; this typed-error distinction is the equivalent signal.)
+    #[test]
+    fn from_pretrained_refuses_while_offline() {
+        let _guard = crate::test_support::env_lock();
+        std::env::set_var(crate::offline::OFFLINE_ENV, "1");
+        let result = HfTokenizer::from_pretrained("headroomlabs-ai/this-repo-does-not-exist-a2");
+        std::env::remove_var(crate::offline::OFFLINE_ENV);
+
+        match result {
+            Err(HfTokenizerError::Offline(blocked)) => {
+                assert_eq!(blocked.purpose, "HuggingFace tokenizer download");
+                assert_eq!(
+                    blocked.destination,
+                    "headroomlabs-ai/this-repo-does-not-exist-a2"
+                );
+            }
+            Err(other) => panic!("expected an offline refusal, got a network error: {other}"),
+            Ok(_) => panic!("expected an offline refusal, got a tokenizer"),
+        }
+    }
+
+    // The "switch off ⇒ guard is a no-op" half is covered in `crate::offline`'s
+    // own tests rather than here: asserting it through `from_pretrained` would
+    // mean actually dialling huggingface.co, which is exactly the thing a unit
+    // test must not do.
+
     #[test]
     fn from_file_loads_a_real_file() {
         // Round-trip via a temp file to cover the on-disk constructor.
```

**File**: `crates/headroom-core/src/transforms/kompress.rs` (modified, +54/-0)
```diff
@@ -180,6 +180,12 @@ pub enum KompressError {
         #[source]
         source: Box<dyn std::error::Error + Send + Sync>,
     },
+    /// `HEADROOM_OFFLINE` is set, so the Hub fetch was refused before any
+    /// socket was opened. A separate variant from [`Self::Hub`] for the same
+    /// reason as [`crate::tokenizer::HfTokenizerError::Offline`]: retrying or
+    /// falling back on a policy refusal is just a slower refusal.
+    #[error(transparent)]
+    Offline(#[from] crate::offline::OfflineEgressBlocked),
 }
 
 // ─── Compressor ─────────────────────────────────────────────────────────
@@ -255,6 +261,22 @@ impl Kompress {
     /// downloading on miss). Blocking — call off the hot path. Tries the
     /// [`ONNX_CANDIDATES`] in order.
     pub fn from_pretrained(config: KompressConfig) -> Result<Self, KompressError> {
+        // Air-gap chokepoint — the same one `hf_impl.rs` uses for the
+        // tokenizer, for the same reason. `HF_HUB_OFFLINE` only shortcuts the
+        // cache *lookup*; on a cache miss `hf-hub` still dials huggingface.co,
+        // so the Kompress model download is a live egress path under
+        // `HEADROOM_OFFLINE=1` and was not covered.
+        //
+        // It sits before `Api::new()` because that already resolves the Hub
+        // endpoint and builds the `ureq` agent, so guarding at the `get` call
+        // would leak the setup packets the switch promises not to send.
+        //
+        // Trade-off, stated plainly: this refuses even when the artifacts are
+        // already in `~/.cache/huggingface/hub`, because `hf-hub` 0.5 gives no
+        // cache-hit/cache-miss split at this layer. An air-gapped caller that
+        // has pre-seeded artifacts should use [`Self::from_files`], which is
+        // network-free by construction and unaffected by this guard.
+        crate::offline::guard_egress("Kompress model download", &config.model_id)?;
         let api = hf_hub::api::sync::Api::new().map_err(|e| KompressError::Hub {
             repo: config.model_id.clone(),
             source: Box::new(e),
@@ -635,6 +657,38 @@ fn hf_hub_roots() -> Vec<PathBuf> {
 mod tests {
     use super::*;
 
+    /// `from_pretrained` must refuse before `Api::new()` when the operator
+    /// air-gapped the box.
+    ///
+    /// The model id cannot exist, which is what makes this a real assertion
+    /// rather than a tautology: without the guard the call reaches `hf-hub`,
+    /// dials `huggingface.co` and comes back `KompressError::Hub`. Only the
+    /// guard can produce `Offline`, and only by returning before the client is
+    /// built — so `Offline` *is* the "no socket was opened" assertion here.
+    #[test]
+    fn from_pretrained_refuses_while_offline() {
+        let _guard = crate::test_support::env_lock();
+        std::env::set_var(crate::offline::OFFLINE_ENV, "1");
+        let config = KompressConfig {
+            model_id: "headroomlabs-ai/this-model-does-not-exist-a2".to_string(),
+            ..KompressConfig::default()
+        };
+        let result = Kompress::from_pretrained(config);
+        std::env::remove_var(crate::offline::OFFLINE_ENV);
+
+        match result {
+            Err(KompressError::Offline(blocked)) => {
+                assert_eq!(blocked.purpose, "Kompress model download");
+                assert_eq!(
+                    blocked.destination,
+                    "headroomlabs-ai/this-model-does-not-exist-a2"
+                );
+            }
+            Err(other) => panic!("expected an offline refusal, got a network error: {other}"),
+            Ok(_) => panic!("expected an offline refusal, got a loaded model"),
+        }
+    }
+
     #[test]
     fn config_defaults_match_kompress_v2_base() {
         let c = KompressConfig::default();
```

**File**: `docs/content/docs/proxy.mdx` (modified, +1/-1)
```diff
@@ -341,7 +341,7 @@ with a privileged job.
 | `HEADROOM_PROXY_TOKEN` | none | Require a token from non-loopback callers, as `X-Headroom-Proxy-Token: <token>` or `Authorization: Bearer <token>`. The token is removed from the request before it is forwarded upstream; clients that also send a provider credential should use `X-Headroom-Proxy-Token` and keep `Authorization` for the provider. Also gates the read-only operator routes (`/stats-history`, `/quota`, `/subscription-window`, `/metrics`), which otherwise answer loopback and trusted-CIDR callers only. |
 | `HEADROOM_ALLOW_UNAUTHENTICATED_BIND` | `false` | Acknowledge a non-loopback bind (`--host 0.0.0.0`, `::`, a LAN address) with **no** `HEADROOM_PROXY_TOKEN`. Without a token or this flag the proxy refuses to start, because `/v1/*` would relay upstream with the operator's credentials for every peer that can reach the port. Only set it when the runtime already restricts reachability (a container published on `127.0.0.1`). |
 | `HEADROOM_COMPRESS_ALLOW_REMOTE` | `false` | Allow non-loopback callers to reach [`POST /v1/compress`](#post-v1compress) and `POST /v1/usage`. Required to run Headroom as a remote gateway/sidecar; without it remote callers get `404`. |
-| `--offline` / `HEADROOM_OFFLINE` | `false` | Air-gap mode: hard-disable **all** egress (telemetry, update checks, license reporting, model downloads). |
+| `--offline` / `HEADROOM_OFFLINE` | `false` | Air-gap mode: refuse every connection Headroom itself initiates — telemetry, update checks, license reporting, model/tokenizer/binary/dataset downloads, remote Kompress, OTLP and Langfuse export, Copilot auth, the subscription pollers, the OpenAI embedders, Headroom Cloud compression and the TLS diagnostics (`headroom doctor --network` reports them as skipped). Four things still work on purpose: forwarding your own requests to the upstream you configured, operator-configured local endpoints (the Ollama embedder), loopback health probes, and paths an `is_offline()` check already disables. Refusals surface as messages, not tracebacks. See the air-gap notes in `docs/metrics-technical-guide.md`. |
 | `HEADROOM_LICENSE` | unset | Licence token, read by core and every licensed extension. `HEADROOM_LICENSE_KEY` is a deprecated alias for one release and logs a warning. A licence on its own sends nothing to Headroom. |
 | `HEADROOM_USAGE_REPORTING` | `false` | Set `1` to let the proxy validate the licence and post aggregate usage counts (no content) to the Headroom cloud. Off unless set; `HEADROOM_OFFLINE` still overrides it. |
 | `--stateless` / `HEADROOM_STATELESS` | `false` | Keep all state in memory; no filesystem writes (disables logs, memory, TOIN). |
```

**File**: `docs/metrics-technical-guide.md` (modified, +12/-1)
```diff
@@ -268,6 +268,17 @@ Verify with `curl -s localhost:8787/stats | jq .otel`.
 
 **Multi-tenant labels:** `register_otel_metric_attribute_provider()` adds request-scoped attributes (tenant, team, cost centre) to every OTel datapoint. Max 16 attributes, 256 chars each.
 
-**Air-gapped deployments:** `HEADROOM_OFFLINE=1` disables all outbound traffic — the anonymous usage beacon (which is **on by default**), the update check, and model downloads.
+**Air-gapped deployments:** `HEADROOM_OFFLINE=1` refuses every connection Headroom itself decides to make to a destination Headroom itself chose. That is the whole list, not a sample: the anonymous usage beacon (which is **on by default**), the update check, the license/usage reporter, **OTLP metric and Langfuse trace export**, HuggingFace / Kompress / fastembed model and tokenizer downloads (Python and Rust), the remote Kompress endpoint, the `headroom install` release-binary and codebase-memory-mcp downloads, the BFCL eval-dataset fetch and the provider SDK clients the eval harness drives, GitHub Copilot device-flow auth and token exchange, the Anthropic / Codex / Copilot subscription pollers, the OpenAI embedders, the Headroom Cloud compression modes in the ASGI and LiteLLM integrations, and the TLS diagnostics (`headroom doctor --network` endpoint checks and the certificate-chain re-probe after an upstream TLS failure).
+
+Four things are deliberately still allowed, and they are the complete set of exceptions:
+
+1. **Your traffic through the proxy.** Requests you send *through* Headroom are still forwarded to the upstream you configured. That is your traffic, not Headroom's, and an air-gapped deployment points it at an on-prem endpoint — refusing it would mean refusing to be a proxy.
+2. **Operator-configured local endpoints.** Today that is exactly one thing: the Ollama embedder, whose address comes entirely from your configuration and defaults to `http://localhost:11434`. No hard-coded internet host is permitted under this exception.
+3. **Loopback.** Health and readiness probes against your own proxy on `127.0.0.1` (`headroom doctor`, the installers, the MCP sidecar).
+4. **Paths an `is_offline()` check already makes unreachable**, where no connection is ever built in the first place.
+
+Those four are enumerated with written reasons in `_EGRESS_ALLOWLIST` in `tests/test_offline_egress_chokepoint.py`, which fails the build if a new egress path appears that is neither guarded nor one of them. There is no category for "known violation": a path that can dial the internet with the flag set is a bug. A refusal reaches you as a message — a Click error on the CLI, a named "model unavailable" from a model loader, a logged line from a background poller — never as a traceback and never as a silent degradation. Enforcing the same policy at the network layer as well is still good practice; it is no longer the only thing standing between you and Headroom-initiated egress.
+
+OTLP export is refused loudly: with `HEADROOM_OFFLINE=1` set, `HEADROOM_OTEL_METRICS_ENABLED=1` plus the default `otlp_http` exporter makes the proxy exit 78 at startup with an explanation, rather than quietly dropping metrics. There is no exemption for a collector that looks local — an in-cluster address is not reliably distinguishable from an internet one. For metrics under an air-gap, either scrape `localhost:8787/metrics` or set `HEADROOM_OTEL_METRICS_EXPORTER=console`, both of which stay on-box. `HEADROOM_KOMPRESS_ENDPOINT` and `HEADROOM_LANGFUSE_ENABLED` are refused the same way, for the same reason.
 
 ---
```

**File**: `headroom/binaries.py` (modified, +6/-0)
```diff
@@ -51,6 +51,7 @@
 from typing import Any
 
 from headroom._subprocess import run
+from headroom.offline import guard_egress
 
 logger = logging.getLogger(__name__)
 
@@ -266,6 +267,11 @@ def _mirror_url(url: str) -> str:
 def _download(url: str, dest: Path, *, progress: bool = True) -> None:
     if os.environ.get("HEADROOM_BINARIES_OFFLINE"):
         raise OfflineError(f"offline mode (HEADROOM_BINARIES_OFFLINE=1) but fetch required: {url}")
+    # HEADROOM_BINARIES_OFFLINE above is the narrow, binaries-only switch; this
+    # is the deployment-wide one. An operator who set the air-gap switch should
+    # not have to also discover a second, differently-named flag to stop
+    # Headroom fetching release assets from GitHub at install time.
+    guard_egress("release binary download", url)
     if not _has_writable_existing_parent(dest.parent):
         raise OSError(f"binary cache directory parent is not writable: {dest.parent}")
     dest.parent.mkdir(parents=True, exist_ok=True)
```

---

### Incident Patch 8: `ee6cfccc` (2026-10-05)
**Commit Message**: fix(security): partition the response cache by credential and principal (#3862)

## Why

On a proxy shared by several callers, the semantic response cache was
keyed only by request content and upstream (#3349). A second caller who
sent the identical request with a different provider key was served the
completion generated for the first caller, under the first caller's key,
and never reached the upstream. That discloses completions across
tenants (finding 01-F15).

## What changes

- `compute_cache_partition()` in
`headroom/proxy/semantic_cache_key_policy.py`: an HMAC-SHA256 under a
per-process random key over the caller's credential and account-selector
headers plus the authenticated principal. Headers counted: every header
the shared credential-header rule
(`internal_header_policy.is_credential_header`) matches, which covers
`authorization`, `proxy-authorization`, `cookie` and `x-api-key`, and
any header whose name ends in `api-key`, `key`, `token`, `secret`,
`account`, `account-id`, `organization` or `project` (so `x-api-key`,
`api-key`, `x-goog-api-key`, `chatgpt-account-id`,
`openai-organization`, `openai-project` and so on). Matching by name
shape keeps new providers partition

**File**: `headroom/proxy/handlers/anthropic.py` (modified, +16/-2)
```diff
@@ -66,6 +66,7 @@
 from headroom.proxy.outcome import RequestOutcome
 from headroom.proxy.output_shaper import shaper_enabled_for, steering_allowed_for
 from headroom.proxy.rate_limit_identity import rate_limit_identity
+from headroom.proxy.semantic_cache_key_policy import compute_request_cache_partition
 from headroom.proxy.tenant_key import resolve_tenant_key, set_request_tenant_key
 from headroom.proxy.thinking_tokens import ThinkingTokens, extract_thinking_tokens
 from headroom.utils import format_exception_message
@@ -1430,10 +1431,21 @@ async def _finalize_pre_upstream() -> None:
             # unreachable entries. Reuse this raw snapshot verbatim at cache.set
             # (the same reason cache_key_fields is snapshotted here, #327).
             cache_lookup_messages = messages
+            # Response-cache partition: a cached response is only ever replayed to a
+            # caller presenting the same provider credentials and principal (01-F15).
+            # Snapshotted with the key fields so lookup and store agree. None means
+            # the principal could not be established: skip the cache entirely.
+            # Only resolved when the cache can be used, so streaming and
+            # cache-disabled requests never pay for identity resolution.
+            cache_partition = (
+                compute_request_cache_partition(request) if self.cache and not stream else None
+            )
             # Check cache (non-streaming only)
             cache_hit = False
-            if self.cache and not stream:
-                cached = await self.cache.get(messages, model, **cache_key_fields)
+            if self.cache and not stream and cache_partition is not None:
+                cached = await self.cache.get(
+                    messages, model, partition=cache_partition, **cache_key_fields
+                )
                 if cached:
                     cache_hit = True
                     self.pipeline_extensions.emit(
@@ -4835,6 +4847,7 @@ async def _turn_hook_call_model(
                         if (
                             self.cache
                             and not stream
+                            and cache_partition is not None
                             and response.status_code == 200
                             and resp_json is not None
                         ):
@@ -4844,6 +4857,7 @@ async def _turn_hook_call_model(
                                 response.content,
                                 dict(response.headers),
                                 tokens_saved=tokens_saved,
+                                partition=cache_partition,
                                 **cache_key_fields,
                             )
 
```

**File**: `headroom/proxy/handlers/openai.py` (modified, +21/-3)
```diff
@@ -37,6 +37,7 @@
 from headroom.proxy.loopback_guard import is_loopback_host
 from headroom.proxy.modes import is_cache_mode
 from headroom.proxy.rate_limit_identity import rate_limit_identity
+from headroom.proxy.semantic_cache_key_policy import compute_request_cache_partition
 from headroom.proxy.stage_timer import StageTimer, emit_stage_timings_log
 from headroom.proxy.upstream_guard import is_safe_upstream_url
 from headroom.proxy.ws_headers import WS_HOP_BY_HOP_HEADERS
@@ -3915,9 +3916,20 @@ async def handle_openai_chat(
         # captured — keep this snapshot after image compression, or a reorder
         # silently reintroduces the drift.
         cache_lookup_messages = messages
+        # Response-cache partition: a cached response is only ever replayed to a
+        # caller presenting the same provider credentials and principal (01-F15).
+        # Snapshotted with the key fields so lookup and store agree. None means
+        # the principal could not be established: skip the cache entirely.
+        # Only resolved when the cache can be used, so streaming and
+        # cache-disabled requests never pay for identity resolution.
+        cache_partition = (
+            compute_request_cache_partition(request) if self.cache and not stream else None
+        )
         # Check cache
-        if self.cache and not stream:
-            cached = await self.cache.get(messages, model, **cache_key_fields)
+        if self.cache and not stream and cache_partition is not None:
+            cached = await self.cache.get(
+                messages, model, partition=cache_partition, **cache_key_fields
+            )
             if cached:
                 self.pipeline_extensions.emit(
                     PipelineStage.INPUT_CACHED,
@@ -5802,13 +5814,19 @@ async def _ccr_api_call_fn(
                 # site, which let a response built for a stream:true request
                 # answer a later non-streaming caller (#3019). Stating the
                 # invariant keeps that from being reintroduced silently.
-                if self.cache and not stream and response.status_code == 200:
+                if (
+                    self.cache
+                    and not stream
+                    and cache_partition is not None
+                    and response.status_code == 200
+                ):
                     await self.cache.set(
                         cache_lookup_messages,
                         model,
                         response.content,
                         dict(response.headers),
                         tokens_saved,
+                        partition=cache_partition,
                         **cache_key_fields,
                     )
 
```

**File**: `headroom/proxy/identity.py` (modified, +27/-0)
```diff
@@ -30,12 +30,39 @@ def __call__(self, request: Any, *, default: str) -> str: ...
 _resolver: IdentityResolver | None = None
 
 
+class UnresolvedPrincipalError(LookupError):
+    """An installed identity resolver could not establish a principal."""
+
+
 def set_identity_resolver(resolver: IdentityResolver | None) -> None:
     """Install (or clear) a custom identity resolver — the enterprise hook."""
     global _resolver
     _resolver = resolver
 
 
+def resolve_authenticated_principal(request: Any) -> str | None:
+    """Return the authenticated principal for ``request``, or ``None``.
+
+    Only a registered custom resolver (see :func:`set_identity_resolver`)
+    establishes a real per-caller identity. The OSS default binds every
+    network caller to the same proxy-token identity and lets loopback callers
+    *choose* a partition by header, so neither is an authenticated principal
+    and both return ``None`` here. Callers that must isolate data between
+    principals (e.g. the response cache) combine this with the caller's own
+    provider credential rather than trusting the default identity.
+
+    An installed resolver that raises, or returns no principal, means the
+    principal is unknown rather than absent: this raises so the caller fails
+    closed instead of silently sharing data across principals.
+    """
+    if _resolver is None:
+        return None
+    principal = _resolver(request, default="")
+    if not principal:
+        raise UnresolvedPrincipalError("identity resolver returned no principal")
+    return principal
+
+
 def _default_os_user() -> str:
     return os.environ.get("USER", os.environ.get("USERNAME", "default"))
 
```

**File**: `headroom/proxy/semantic_cache.py` (modified, +16/-5)
```diff
@@ -61,7 +61,9 @@ def __init__(self, max_entries: int = 1000, ttl_seconds: int = 3600):
         self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
         self._lock = asyncio.Lock()
 
-    def _compute_key(self, messages: list[dict], model: str, **key_fields: Any) -> str:
+    def _compute_key(
+        self, messages: list[dict], model: str, *, partition: str, **key_fields: Any
+    ) -> str:
         """Compute cache key from messages, model, and response-shaping fields.
 
         ``key_fields`` carries every request field that changes generation,
@@ -75,12 +77,19 @@ def _compute_key(self, messages: list[dict], model: str, **key_fields: Any) -> s
         on ``system``/``tools`` does not fragment the key (scalars pass through
         untouched). Absent fields don't contribute, so truly-identical requests
         still hit.
+
+        ``partition`` is the caller's cache partition
+        (:func:`headroom.proxy.semantic_cache_key_policy.compute_request_cache_partition`)
+        and is required: on a shared proxy, a response is only ever replayed to a
+        caller presenting the same provider credentials and principal.
         """
-        return compute_semantic_cache_key(messages, model, **key_fields)
+        return compute_semantic_cache_key(messages, model, partition=partition, **key_fields)
 
-    async def get(self, messages: list[dict], model: str, **key_fields: Any) -> CacheEntry | None:
+    async def get(
+        self, messages: list[dict], model: str, *, partition: str, **key_fields: Any
+    ) -> CacheEntry | None:
         """Get cached response if exists and not expired."""
-        key = self._compute_key(messages, model, **key_fields)
+        key = self._compute_key(messages, model, partition=partition, **key_fields)
         async with self._lock:
             entry = self._cache.get(key)
 
@@ -105,10 +114,12 @@ async def set(
         response_body: bytes,
         response_headers: dict[str, str],
         tokens_saved: int = 0,
+        *,
+        partition: str,
         **key_fields: Any,
     ):
         """Cache a response."""
-        key = self._compute_key(messages, model, **key_fields)
+        key = self._compute_key(messages, model, partition=partition, **key_fields)
 
         if not _is_cacheable_reply(response_body):
             return
```

**File**: `headroom/proxy/semantic_cache_key_policy.py` (modified, +103/-0)
```diff
@@ -3,9 +3,104 @@
 from __future__ import annotations
 
 import hashlib
+import hmac
 import json
+import logging
+import re
+import secrets
+from collections.abc import Mapping
 from typing import Any
 
+from headroom.proxy.internal_header_policy import INTERNAL_HEADER_PREFIX, is_credential_header
+
+logger = logging.getLogger(__name__)
+
+# Per-process key for the cache partition HMAC. The semantic response cache is
+# an in-memory, per-process structure, so the partition only has to be stable
+# for this process's lifetime; a fresh random key means a partition id can
+# never be computed (or brute-forced from a guessed credential) outside it.
+_PARTITION_KEY = secrets.token_bytes(32)
+
+# A header carries caller credentials or selects the billed account when the
+# shared credential-header rule matches it (``authorization``,
+# ``proxy-authorization``, ``cookie``, ``x-api-key``, ...) or its name ends in
+# one of these tokens (``x-goog-api-key``, ``chatgpt-account-id``,
+# ``openai-organization``, ``openai-project``, ...). Every such header the
+# handlers forward upstream must be in the partition. Matching by shape rather
+# than by a fixed provider list keeps new providers partitioned by default.
+_CREDENTIAL_HEADER_RE = re.compile(
+    r"(^|[-_])(api[-_]?key|key|token|secret|account|account[-_]id|organization|project)$"
+)
+# Per-request nonces that match the credential shape but identify nothing: a
+# fresh value per call would make every request a unique partition.
+_NON_CREDENTIAL_HEADERS = frozenset({"idempotency-key", "x-idempotency-key"})
+ANONYMOUS_PARTITION = "anon"
+
+
+def _is_credential_header(name: str) -> bool:
+    # ``x-headroom-*`` headers (including the proxy's own token, which the
+    # security gate has already removed) never reach the upstream, so they
+    # never identify the upstream account.
+    lowered = name.lower()
+    if lowered.startswith(INTERNAL_HEADER_PREFIX) or lowered in _NON_CREDENTIAL_HEADERS:
+        return False
+    return is_credential_header(lowered) or bool(_CREDENTIAL_HEADER_RE.search(lowered))
+
+
+def compute_cache_partition(
+    headers: Mapping[str, str] | Any,
+    *,
+    principal: str | None = None,
+) -> str:
+    """Return the response-cache partition for one caller.
+
+    Two requests may share a cached response only when they present the same
+    provider credentials / account selectors and the same authenticated
+    principal. The partition is an HMAC under a per-process random key, never a
+    plain hash, so it cannot be used to confirm a guessed credential.
+
+    Requests with no caller credential and no principal (the proxy supplies the
+    operator's key) share the ``anon`` partition: they are billed to, and
+    answered by, the same account.
+    """
+    material: list[tuple[str, str]] = []
+    items: list[tuple[Any, Any]] = list(headers.items()) if hasattr(headers, "items") else []
+    for name, value in items:
+        if value and _is_credential_header(str(name)):
+            material.append(("h:" + str(name).lower(), str(value).strip()))
+    if principal:
+        material.append(("principal", principal))
+    if not material:
+        return ANONYMOUS_PARTITION
+    material.sort()
+    digest = hmac.new(
+        _PARTITION_KEY, json.dumps(material, separators=(",", ":")).encode(), hashlib.sha256
+    ).hexdigest()
+    return "p_" + digest[:32]
+
+
+def compute_request_cache_partition(request: Any) -> str | None:
+    """Partition for a live proxy request: credentials + authenticated principal.
+
+    Returns ``None`` when an installed identity resolver raises or returns no
+    principal. The caller must then bypass the response cache (no lookup, no
+    store): falling back to the credential-only partition would let tenants
+    sharing one operator key read each other's cached responses.
+    """
+    from headroom.proxy.identity import resolve_authenticated_principal
+
+    try:
+        principal = resolve_authenticated_principal(request)
+    except Exception:
+        logger.warning(
+            "Identity resolver could not establish a principal; "
+            "bypassing the response cache for this request",
+            exc_info=True,
+        )
+        return None
+    headers = getattr(request, "headers", None) or {}
+    return compute_cache_partition(headers, principal=principal)
+
 
 def strip_cache_control(obj: Any) -> Any:
     """Recursively drop prompt-cache annotations, preserving schema properties."""
@@ -33,6 +128,8 @@ def _strip_cache_control(obj: Any, *, preserve_key: bool) -> Any:
 def compute_semantic_cache_key(
     messages: list[dict],
     model: str,
+    *,
+    partition: str,
     **key_fields: Any,
 ) -> str:
     """Compute a stable cache key from request content and shaping fields.
@@ -44,9 +141,15 @@ def compute_semantic_cache_key(
     Anthropic path, the most common place a client (e.g. Claude Code) moves a
     breakpoint between turns, so leaving them un-stripped defeated th
```

**File**: `tests/test_ccr_buffered_stream_signed_thinking.py` (modified, +3/-0)
```diff
@@ -27,6 +27,7 @@
 from fastapi.testclient import TestClient  # noqa: E402
 
 from headroom.proxy.models import CacheEntry  # noqa: E402
+from headroom.proxy.semantic_cache_key_policy import compute_cache_partition  # noqa: E402
 from headroom.proxy.server import ProxyConfig, create_app  # noqa: E402
 
 RETRIEVE_TOOL = {
@@ -314,6 +315,8 @@ async def fail_retry(*args, **kwargs):  # noqa: ANN001, ANN002, ANN003
         key = proxy.cache._compute_key(
             body["messages"],
             body["model"],
+            # Same partition the handler derives for this caller (01-F15).
+            partition=compute_cache_partition(_headers()),
             upstream_base_url=None,
             system=None,
             tools=None,
```

**File**: `tests/test_proxy_response_cache_partition.py` (added, +390/-0)
```diff
@@ -0,0 +1,390 @@
+"""01-F15: the response cache must never answer one caller from another's entry.
+
+On a shared proxy (several principals behind one Headroom), two callers sending
+the identical request under different provider credentials used to share one
+semantic-cache entry: caller B was served the completion generated for caller A,
+under A's key. The partition is now a keyed HMAC of the caller's credential
+headers (and authenticated principal, when an identity resolver is installed),
+threaded through every cache lookup and store.
+"""
+
+from __future__ import annotations
+
+import hashlib
+from types import SimpleNamespace
+
+import httpx
+import pytest
+
+pytest.importorskip("fastapi")
+
+from fastapi.testclient import TestClient
+
+from headroom.proxy import identity
+from headroom.proxy.semantic_cache import SemanticCache
+from headroom.proxy.semantic_cache_key_policy import (
+    ANONYMOUS_PARTITION,
+    compute_cache_partition,
+    compute_request_cache_partition,
+)
+from headroom.proxy.server import ProxyConfig, create_app
+
+# ---------------------------------------------------------------------------
+# Partition function
+# ---------------------------------------------------------------------------
+
+
+def test_partition_differs_per_credential_and_is_stable_per_credential() -> None:
+    a = compute_cache_partition({"x-api-key": "sk-ant-A"})
+    b = compute_cache_partition({"x-api-key": "sk-ant-B"})
+    assert a != b
+    assert a == compute_cache_partition({"X-Api-Key": "sk-ant-A"})
+
+
+@pytest.mark.parametrize(
+    "header",
+    [
+        "authorization",
+        "proxy-authorization",
+        "cookie",
+        "x-api-key",
+        "api-key",
+        "x-goog-api-key",
+        "chatgpt-account-id",
+        "openai-organization",
+        "openai-project",
+    ],
+)
+def test_every_credential_or_account_header_partitions(header: str) -> None:
+    assert compute_cache_partition({header: "one"}) != compute_cache_partition({header: "two"})
+
+
+def test_non_credential_headers_do_not_fragment_the_cache() -> None:
+    base = compute_cache_partition({"x-api-key": "k"})
+    noisy = {
+        "x-api-key": "k",
+        "idempotency-key": "per-request-nonce",
+        "x-headroom-proxy-token": "proxy-secret",
+        "user-agent": "sdk/1.0",
+        "anthropic-version": "2023-06-01",
+        "content-type": "application/json",
+    }
+    assert compute_cache_partition(noisy) == base
+
+
+def test_no_credential_and_no_principal_is_the_shared_operator_partition() -> None:
+    assert compute_cache_partition({"user-agent": "x"}) == ANONYMOUS_PARTITION
+
+
+def test_partition_is_keyed_not_a_plain_hash_of_the_credential() -> None:
+    part = compute_cache_partition({"x-api-key": "sk-ant-A"})
+    for plain in (
+        hashlib.sha256(b"sk-ant-A").hexdigest()[:32],
+        hashlib.sha256(b"x-api-key:sk-ant-A").hexdigest()[:32],
+    ):
+        assert plain not in part
+
+
+def test_authenticated_principal_partitions_callers_sharing_a_credential() -> None:
+    same_key = {"authorization": "Bearer operator-key"}
+    assert compute_cache_partition(same_key, principal="alice") != compute_cache_partition(
+        same_key, principal="bob"
+    )
+
+
+def test_semantic_cache_refuses_calls_without_a_partition() -> None:
+    cache = SemanticCache()
+    with pytest.raises(TypeError):
+        cache._compute_key([{"role": "user", "content": "x"}], "m")  # type: ignore[call-arg]
+
+
+@pytest.mark.asyncio
+async def test_semantic_cache_isolates_partitions() -> None:
+    cache = SemanticCache()
+    msgs = [{"role": "user", "content": "Say hi."}]
+    await cache.set(msgs, "m", b"A-body", {}, partition="p_a")
+    assert await cache.get(msgs, "m", partition="p_b") is None
+    hit = await cache.get(msgs, "m", partition="p_a")
+    assert hit is not None and hit.response_body == b"A-body"
+
+
+# ---------------------------------------------------------------------------
+# End to end through the real handlers
+# ---------------------------------------------------------------------------
+
+
+def _client(*, cache_enabled: bool = True) -> TestClient:
+    return TestClient(
+        create_app(
+            ProxyConfig(
+                optimize=False,
+                cache_enabled=cache_enabled,
+                rate_limit_enabled=False,
+                cost_tracking_enabled=False,
+                log_requests=False,
+                ccr_inject_tool=False,
+                ccr_handle_responses=False,
+                ccr_context_tracking=False,
+                image_optimize=False,
+            )
+        )
+    )
+
+
+def _anthropic_reply(text: str) -> httpx.Response:
+    return httpx.Response(
+        200,
+        json={
+            "id": "msg_1",
+            "type": "message",
+            "role": "assistant",
+            "content": [{"type": "text", "text": text}],
+            "usage": {
+                "input_tokens": 10,
+                "output_tokens": 3,
+  
```

**File**: `tests/test_proxy_semantic_cache_key.py` (modified, +11/-7)
```diff
@@ -22,7 +22,7 @@
 
 
 def _key(cache: SemanticCache, **kw) -> str:
-    return cache._compute_key(MESSAGES, MODEL, **kw)
+    return cache._compute_key(MESSAGES, MODEL, partition="p_test", **kw)
 
 
 # --- too loose: different inputs must NOT collide (the bug) --------------------
@@ -145,8 +145,8 @@ def test_message_cache_control_breakpoint_move_same_key():
         }
     ]
     messages_without_cc = [{"role": "user", "content": [{"type": "text", "text": "hello"}]}]
-    assert cache._compute_key(messages_with_cc, MODEL) == cache._compute_key(
-        messages_without_cc, MODEL
+    assert cache._compute_key(messages_with_cc, MODEL, partition="p_test") == cache._compute_key(
+        messages_without_cc, MODEL, partition="p_test"
     )
 
 
@@ -155,7 +155,9 @@ def test_message_content_change_still_distinct_key():
     cache = SemanticCache()
     a = [{"role": "user", "content": [{"type": "text", "text": "hello"}]}]
     b = [{"role": "user", "content": [{"type": "text", "text": "goodbye"}]}]
-    assert cache._compute_key(a, MODEL) != cache._compute_key(b, MODEL)
+    assert cache._compute_key(a, MODEL, partition="p_test") != cache._compute_key(
+        b, MODEL, partition="p_test"
+    )
 
 
 # --- behavioral get/set: collision prevented end to end -----------------------
@@ -165,11 +167,13 @@ async def test_get_set_collision_prevented():
     """Store under system A; fetching with system B is a MISS (no contamination),
     fetching with system A is a HIT."""
     cache = SemanticCache()
-    await cache.set(MESSAGES, MODEL, b"french-body", {}, system="Answer only in French.")
+    await cache.set(
+        MESSAGES, MODEL, b"french-body", {}, partition="p_test", system="Answer only in French."
+    )
 
-    miss = await cache.get(MESSAGES, MODEL, system="Answer only in English.")
+    miss = await cache.get(MESSAGES, MODEL, partition="p_test", system="Answer only in English.")
     assert miss is None
 
-    hit = await cache.get(MESSAGES, MODEL, system="Answer only in French.")
+    hit = await cache.get(MESSAGES, MODEL, partition="p_test", system="Answer only in French.")
     assert hit is not None
     assert hit.response_body == b"french-body"
```

---

### Incident Patch 9: `6151ed1f` (2026-10-05)
**Commit Message**: fix(router): keep ccr_retrieve exemption through orchestrator wrappers (#3915)

## Description

A `headroom_retrieve` result delivered through a generic orchestrator
wrapper is re-offloaded: OpenCode V2 Code Mode runs every MCP call
inside its built-in `execute` tool and Codex code mode uses `exec` /
`functions.exec`, so the wire tool name is the wrapper, the inner name
never reaches the proxy, and the existing `ccr_retrieve` exemption
(which keys on the tool name) misses. SmartCrusher then rewrites the
retrieved bytes into a fresh `<<ccr:hash>>` marker the model can never
redeem (same unresolvable-retrieval-loop class as #1077 / #2698). Refs
#3563.

This change resolves a recognized orchestrator call to the retrieval
tool's own name when -- and only when -- the call's own payload invokes
`headroom_retrieve`. Per #3563's constraints: the wrapper is never
exempted as a whole, and the result content is never consulted (an
`original_content` property is user-controllable data, not recovery
proof).

## Type of Change

- [x] Bug fix (non-breaking change that fixes an issue)

## Changes Made

- `headroom/config.py`: `unwrap_tool_call()` now resolves an
orchestrator wrapper (`execute`, `e

**File**: `headroom/config.py` (modified, +125/-1)
```diff
@@ -4,6 +4,7 @@
 
 import fnmatch
 import json
+import re
 from collections.abc import Iterable
 from dataclasses import InitVar, dataclass, field
 from datetime import datetime
@@ -405,8 +406,124 @@ def _load_json_value(raw: Any) -> Any:
     return raw
 
 
+# headroom's own retrieval tool. Kept as a literal (rather than imported from
+# headroom.ccr.tool_injection) so this leaf module stays free of the ccr
+# package's import graph; mirrors CCR_TOOL_NAME there.
+_CCR_RETRIEVE_TOOL_NAME = "headroom_retrieve"
+
+# Orchestrator wrappers. OpenCode V2 Code Mode runs every MCP call inside its
+# built-in `execute` tool, and Codex code mode sends calls as `exec` /
+# `functions.exec` custom tool calls whose payload is JavaScript. On the wire
+# the name is the wrapper -- the inner tool name never reaches the proxy -- so
+# when the script invokes the retrieval tool the ccr_retrieve exemption misses
+# and the retrieved bytes are re-offloaded into a <<ccr:hash>> marker the agent
+# can never redeem (unresolvable retrieval loop, #3563).
+#
+# Only a call whose own payload invokes the retrieval tool resolves to it: the
+# wrapper is never exempted as a whole (an `execute` call running anything else
+# stays compressible), and the match keys on the model-authored call arguments
+# -- never on the result content (an `original_content` property is data the
+# model may echo, not recovery proof). Tradeoff, same family as the
+# mcp__<server>__ alias matching above: a wrapper payload that merely mentions
+# `headroom_retrieve(` inside a string (e.g. a shell command being exec'd)
+# over-protects that one output; losing compression is cheap, losing retrieved
+# bytes is not.
+#
+# Matching runs on decoded script text: the OpenAI wire hands the payload over
+# JSON-encoded, where a real newline between the callee and `(` arrives as the
+# two characters `\n` and a raw-text scan misses the call.
+_ORCHESTRATOR_WRAPPER_NAMES = frozenset({"execute", "exec", "functions.exec"})
+
+# JavaScript call expressions inside a wrapper payload: `headroom_retrieve(`,
+# `tools.headroom.headroom_retrieve(`, plus bracket access
+# `tools["headroom_retrieve"](` / `tools['mcp__headroom__headroom_retrieve'](`.
+# Optional chaining counts as an invocation too -- `headroom_retrieve?.()`,
+# `tools?.headroom.headroom_retrieve(...)`, `tools["headroom_retrieve"]?.()`
+# -- since the tool still runs when present and its bytes need the exemption.
+# Decoded script text carries unescaped quotes; the escaped form of a raw
+# payload is tolerated too.
+_JS_CALL_CHAIN_RE = re.compile(
+    r"(?<![\w$.])([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*)\s*(?:\?\.)?\s*\("
+)
+_JS_BRACKET_KEY_RE = re.compile(
+    r"""\[\s*\\?(?:"([^"\n\\]{1,200})\\?"|'([^'\n\\]{1,200})\\?')\s*\]"""
+    r"""\s*(?:\?\.)?\s*\("""
+)
+
+
+def _decoded_strings(value: Any) -> list[str]:
+    """Every string nested in a decoded payload (dicts and lists walk
+    through); scalars contribute nothing."""
+    if isinstance(value, str):
+        return [value]
+    if isinstance(value, dict):
+        items: Iterable[Any] = value.values()
+    elif isinstance(value, (list, tuple)):
+        items = value
+    else:
+        return []
+    strings: list[str] = []
+    for item in items:
+        strings.extend(_decoded_strings(item))
+    return strings
+
+
+def _orchestrator_invokes_retrieve(name: str, arguments: Any) -> bool:
+    """True when an orchestrator wrapper's payload invokes the retrieval tool.
+
+    See the comment above ``_ORCHESTRATOR_WRAPPER_NAMES``. ``arguments`` is the
+    model-authored call payload: JSON text on the OpenAI wire, a decoded dict on
+    the Anthropic wire, raw JavaScript for a custom_tool_call. JSON text is
+    decoded before matching so a script newline is seen as a real newline. Any
+    other value fails closed (the call keeps its wrapper name).
+    """
+    if name not in _ORCHESTRATOR_WRAPPER_NAMES:
+        return False
+    texts: list[str]
+    if isinstance(arguments, str):
+        decoded = _load_json_value(arguments)
+        if isinstance(decoded, dict):
+            texts = _decoded_strings(decoded)
+        elif decoded is None:
+            # Not JSON: a raw JavaScript custom_tool_call payload.
+            texts = [arguments]
+        else:
+            # A JSON scalar, string or array: no orchestrator payload shape.
+            return False
+    elif isinstance(arguments, dict):
+        texts = _decoded_strings(arguments)
+    else:
+        return False
+
+    def _names_retrieve(candidate: str) -> bool:
+        # A dotted chain resolves on its last segment
+        # (`tools.headroom.headroom_retrieve`); is_tool_excluded() then applies
+        # the usual mcp__<server>__ aliases to it.
+        return is_tool_excluded(candidate.rsplit(".", 1)[-1], (_CCR_RETRIEVE_TOOL_NAME,))
+
+    for text in texts:
+        if _CCR_RETRIEVE_TOOL_NAME not in text:
+            continue
+        for match in _JS_CALL_CHAIN_RE.finditer(text):
```

**File**: `tests/test_orchestrator_wrapper_ccr_retrieve.py` (added, +361/-0)
```diff
@@ -0,0 +1,361 @@
+"""Regression tests: a headroom_retrieve result delivered through an orchestrator
+wrapper must keep the ccr_retrieve exemption (#3563).
+
+OpenCode V2 Code Mode runs every MCP call inside its built-in ``execute`` tool,
+and Codex code mode sends calls as ``exec`` / ``functions.exec`` custom tool
+calls whose payload is JavaScript. On the wire the tool name is the wrapper --
+the inner name never reaches the proxy -- so the exemption that keys on the tool
+name missed, SmartCrusher re-offloaded the retrieved bytes into a fresh
+``<<ccr:hash>>`` marker, and the model could never redeem it (the same
+unresolvable retrieval loop class as #1077 / #2698).
+
+The fix resolves such a call to the retrieval tool's own name when -- and only
+when -- the call's own payload invokes ``headroom_retrieve``. The wrapper is
+never exempted as a whole, and the result content is never consulted (an
+``original_content`` property is user-controllable data, not recovery proof).
+"""
+
+from __future__ import annotations
+
+import json
+
+from headroom.config import unwrap_tool_call
+from headroom.transforms.content_router import ContentRouter, ContentRouterConfig
+
+
+def _get_tokenizer():
+    from headroom.providers import OpenAIProvider
+    from headroom.tokenizer import Tokenizer
+
+    provider = OpenAIProvider()
+    token_counter = provider.get_token_counter("gpt-4o")
+    return Tokenizer(token_counter, "gpt-4o")
+
+
+def _big_retrieve_json() -> str:
+    """The JSON object the retrieval tool returns: big enough to clear the
+    compression threshold, shaped like the #3563 repro (``original_content``)."""
+    rows = "\n".join(
+        f"Row {i:03d}: synthetic recovery check; status=healthy; payload=harmless sample."
+        for i in range(90)
+    )
+    return json.dumps({"original_content": rows})
+
+
+def _orchestrator_messages(wrapper_name: str, code: str, content: str) -> list[dict]:
+    """OpenAI-shape conversation: an outer wrapper call, then its tool result."""
+    return [
+        {
+            "role": "assistant",
+            "content": None,
+            "tool_calls": [
+                {
+                    "id": "call_ccr_exec",
+                    "type": "function",
+                    "function": {"name": wrapper_name, "arguments": json.dumps({"code": code})},
+                }
+            ],
+        },
+        {"role": "tool", "tool_call_id": "call_ccr_exec", "content": content},
+    ]
+
+
+RETRIEVE_CODE = (
+    'const r = await tools.headroom.headroom_retrieve({hash: "abc123def456"});\nreturn r;'
+)
+NON_RETRIEVE_CODE = 'const r = await tools.bash.bash({command: "ls"});\nreturn r;'
+# A real newline between the callee and its `(`. On the OpenAI wire the payload
+# is JSON, so this arrives as the two escaped characters `\n` and a scan of the
+# raw JSON text misses it; the call must be recognized on the decoded script.
+RETRIEVE_CODE_MULTILINE = (
+    'const r = await tools.headroom.headroom_retrieve\n({hash: "abc123def456"});\nreturn r;'
+)
+
+
+class TestOrchestratorUnwrap:
+    """Unit coverage for the identity derivation itself."""
+
+    def test_opencode_execute_wrapper_resolves_to_retrieve(self):
+        name, _args = unwrap_tool_call("execute", json.dumps({"code": RETRIEVE_CODE}))
+        assert name == "headroom_retrieve"
+
+    def test_qualified_mcp_name_inside_script_resolves(self):
+        code = 'const r = await tools.mcp__headroom__headroom_retrieve({hash: "abc"});'
+        assert unwrap_tool_call("execute", json.dumps({"code": code}))[0] == "headroom_retrieve"
+
+    def test_bracket_access_inside_script_resolves(self):
+        code = 'const r = await tools["headroom_retrieve"]({hash: "abc"});'
+        assert unwrap_tool_call("execute", json.dumps({"code": code}))[0] == "headroom_retrieve"
+
+    def test_execute_wrapper_without_retrieve_call_keeps_name(self):
+        assert unwrap_tool_call("execute", json.dumps({"code": NON_RETRIEVE_CODE}))[0] == "execute"
+
+    def test_non_wrapper_mentioning_retrieve_keeps_name(self):
+        # A non-orchestrator tool whose arguments merely name the tool is not
+        # recovery output; only recognized wrappers resolve.
+        args = '{"command": "grep -n headroom_retrieve( README.md"}'
+        assert unwrap_tool_call("bash", args)[0] == "bash"
+
+    def test_wrapper_payload_mentioning_retrieve_without_a_call_keeps_name(self):
+        assert unwrap_tool_call("execute", json.dumps({"code": "// see headroom_retrieve"}))[0] == (
+            "execute"
+        )
+
+    def test_json_encoded_newline_before_call_resolves(self):
+        """The OpenAI wire JSON-encodes the payload, so the script's real
+        newline arrives as the two characters ``\\n``; resolving must happen on
+        the decoded script text, not on the raw JSON text (#3915 review)."""
+        code = 'const r = await tools.headroom.headroom_retrieve\n({hash: "abc"});'
+        assert unwrap_tool_call("execute", json.dumps({"code
```

---

### Incident Patch 10: `b9a0d298` (2026-10-05)
**Commit Message**: fix(proxy): redact proxy-authorization and *_token keys in wire debug capture (#3918)

## Description

`redact_for_wire_debug` misses several credential-bearing key names, so
an opt-in Codex wire-debug capture writes them verbatim into the JSON
file it drops in the capture directory (`_write_codex_wire_debug` in
`headroom/proxy/helpers.py` passes both `headers` and `body` through
this policy).

The gaps, all confirmed against `should_redact_key` on current main:

| key | redacted before |
|---|---|
| `Proxy-Authorization` | no |
| `auth_token`, `session_token`, `api_token`, `github_token` | no |
| `x-amz-security-token` | no |
| `google_id_token` | no |
| `credentials`, `aws_credentials` | no |
| `secret_key`, `aws_secret_key` | no |

`authorization` and `id_token` are matched exactly, but the suffix list
only covers `_access_token` and `_refresh_token`, so a provider or
gateway that names its field anything else in the token family falls
through. `Proxy-Authorization` is the one that bothers me most for a
proxy: it is the credential on the hop Headroom makes itself.

## Reproduction

```python
from headroom.proxy.wire_debug_redaction_policy import redact_for_wire_debug

print(reda

**File**: `headroom/proxy/wire_debug_redaction_policy.py` (modified, +19/-7)
```diff
@@ -7,6 +7,9 @@
 WIRE_DEBUG_REDACTED = "[REDACTED]"
 WIRE_DEBUG_SECRET_KEYS = (
     "authorization",
+    # A proxy sees Proxy-Authorization on the hop it makes itself; it carries
+    # the same kind of credential as Authorization.
+    "proxy-authorization",
     "cookie",
     "set-cookie",
     "api-key",
@@ -19,8 +22,23 @@
     "bearer",
     "password",
     "secret",
+    "secret_key",
     "token",
     "credential",
+    "credentials",
+)
+
+# Suffixes that make a prefixed key a secret. ``_token`` covers the auth,
+# session, api, id and security token names providers use, and does not touch
+# the usage counters (``max_tokens``, ``input_tokens``, ...), which are plural.
+_SECRET_KEY_SUFFIXES = (
+    "_api_key",
+    "_secret",
+    "_secret_key",
+    "_password",
+    "_token",
+    "_credential",
+    "_credentials",
 )
 
 
@@ -29,13 +47,7 @@ def should_redact_key(key: str) -> bool:
     normalized = key.lower().replace("-", "_")
     if normalized in {marker.replace("-", "_") for marker in WIRE_DEBUG_SECRET_KEYS}:
         return True
-    return (
-        normalized.endswith("_api_key")
-        or normalized.endswith("_secret")
-        or normalized.endswith("_password")
-        or normalized.endswith("_access_token")
-        or normalized.endswith("_refresh_token")
-    )
+    return normalized.endswith(_SECRET_KEY_SUFFIXES)
 
 
 def redact_for_wire_debug(value: Any) -> Any:
```

**File**: `tests/test_wire_debug_redaction_policy.py` (modified, +38/-0)
```diff
@@ -43,3 +43,41 @@ def test_wire_debug_key_matching_normalizes_dashes_and_case() -> None:
     assert should_redact_key("Anthropic-API-Key")
     assert should_redact_key("custom-refresh-token")
     assert not should_redact_key("token_count")
+
+
+def test_wire_debug_redacts_proxy_authorization() -> None:
+    redacted = redact_for_wire_debug(
+        {"Proxy-Authorization": "Basic dXNlcjpwYXNz", "user-agent": "codex/1.0"}
+    )
+
+    assert redacted["Proxy-Authorization"] == WIRE_DEBUG_REDACTED
+    assert redacted["user-agent"] == "codex/1.0"
+
+
+def test_wire_debug_redacts_any_token_suffix() -> None:
+    for key in (
+        "auth_token",
+        "session_token",
+        "api_token",
+        "github_token",
+        "x-amz-security-token",
+        "google_id_token",
+    ):
+        assert should_redact_key(key), key
+
+
+def test_wire_debug_redacts_credentials_and_secret_key() -> None:
+    for key in ("credentials", "aws_credentials", "secret_key", "aws_secret_key"):
+        assert should_redact_key(key), key
+
+
+def test_wire_debug_keeps_token_usage_counters_visible() -> None:
+    for key in (
+        "max_tokens",
+        "input_tokens",
+        "output_tokens",
+        "total_tokens",
+        "cache_read_input_tokens",
+        "token_count",
+    ):
+        assert not should_redact_key(key), key
```

---

### Incident Patch 11: `26514897` (2026-10-05)
**Commit Message**: test(sdk): give the Vercel withHeadroom fixtures a LanguageModelV3 result (#3949)

## Description

`npm test` in `sdk/typescript` is red on `main` again. Dependabot's
#3910 (merged 2026-10-01) bumped `ai` from 7.0.107 to 7.0.119. The newer
`ai` wraps a `specificationVersion: "v3"` model in a v4 adapter
(`node_modules/ai/src/model/as-language-model-v4.ts`) whose `doGenerate`
maps over the result's `content`. The three fake models in
`test/adapters/vercel-ai.test.ts` declare `v3` but resolve `doGenerate`
with a V1-era shape (`text`, `usage.promptTokens`, `rawCall`) and no
`content`, so every `wrapped.doGenerate()` call now throws:

```text
FAIL  test/adapters/vercel-ai.test.ts > withHeadroom > triggers compression on doGenerate
FAIL  test/adapters/vercel-ai.test.ts > withHeadroom > passes options through to headroomMiddleware
FAIL  test/adapters/vercel-ai.test.ts > withHeadroom > falls back when proxy is down
TypeError: Cannot read properties of undefined (reading 'map')
 ❯ Proxy.target.doStream node_modules/ai/src/model/as-language-model-v4.ts:45:39
```

The shipped adapter is not affected — real models return `content` — so
this is a fixture problem. This makes the three fixtures g

**File**: `sdk/typescript/test/adapters/vercel-ai.test.ts` (modified, +31/-15)
```diff
@@ -1,4 +1,5 @@
 import { describe, it, expect, vi, beforeEach } from "vitest";
+import type { LanguageModelV3 } from "@ai-sdk/provider";
 import {
   headroomMiddleware,
   compressVercelMessages,
@@ -240,12 +241,17 @@ describe("withHeadroom", () => {
       provider: "test-provider",
       modelId: "test-model",
       supportedUrls: {},
+      // A real LanguageModelV3 result (type-checked below): `ai` >= 7.0.119 wraps v3 models
+      // in a v4 adapter that maps over `content` and forwards the rest unchanged.
       doGenerate: vi.fn().mockResolvedValue({
-        text: "response",
-        usage: { promptTokens: 10, completionTokens: 5 },
-        finishReason: "stop",
-        rawCall: { rawPrompt: null, rawSettings: {} },
-      }),
+        content: [{ type: "text", text: "response" }],
+        finishReason: { unified: "stop", raw: "stop" },
+        usage: {
+          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
+          outputTokens: { total: 5, text: 5, reasoning: undefined },
+        },
+        warnings: [],
+      } satisfies Awaited<ReturnType<LanguageModelV3["doGenerate"]>>),
       doStream: vi.fn(),
     };
 
@@ -277,12 +283,17 @@ describe("withHeadroom", () => {
       provider: "test",
       modelId: "test-model",
       supportedUrls: {},
+      // A real LanguageModelV3 result (type-checked below): `ai` >= 7.0.119 wraps v3 models
+      // in a v4 adapter that maps over `content` and forwards the rest unchanged.
       doGenerate: vi.fn().mockResolvedValue({
-        text: "ok",
-        usage: { promptTokens: 5, completionTokens: 3 },
-        finishReason: "stop",
-        rawCall: { rawPrompt: null, rawSettings: {} },
-      }),
+        content: [{ type: "text", text: "ok" }],
+        finishReason: { unified: "stop", raw: "stop" },
+        usage: {
+          inputTokens: { total: 5, noCache: 5, cacheRead: undefined, cacheWrite: undefined },
+          outputTokens: { total: 3, text: 3, reasoning: undefined },
+        },
+        warnings: [],
+      } satisfies Awaited<ReturnType<LanguageModelV3["doGenerate"]>>),
       doStream: vi.fn(),
     };
 
@@ -311,12 +322,17 @@ describe("withHeadroom", () => {
       provider: "test",
       modelId: "test-model",
       supportedUrls: {},
+      // A real LanguageModelV3 result (type-checked below): `ai` >= 7.0.119 wraps v3 models
+      // in a v4 adapter that maps over `content` and forwards the rest unchanged.
       doGenerate: vi.fn().mockResolvedValue({
-        text: "ok",
-        usage: { promptTokens: 5, completionTokens: 3 },
-        finishReason: "stop",
-        rawCall: { rawPrompt: null, rawSettings: {} },
-      }),
+        content: [{ type: "text", text: "ok" }],
+        finishReason: { unified: "stop", raw: "stop" },
+        usage: {
+          inputTokens: { total: 5, noCache: 5, cacheRead: undefined, cacheWrite: undefined },
+          outputTokens: { total: 3, text: 3, reasoning: undefined },
+        },
+        warnings: [],
+      } satisfies Awaited<ReturnType<LanguageModelV3["doGenerate"]>>),
       doStream: vi.fn(),
     };
 
```

**File**: `sdk/typescript/tsconfig.typecheck.json` (modified, +1/-1)
```diff
@@ -4,6 +4,6 @@
     "rootDir": ".",
     "noEmit": true
   },
-  "include": ["src", "test/**/*.test-d.ts"],
+  "include": ["src", "test/**/*.test-d.ts", "test/adapters/vercel-ai.test.ts"],
   "exclude": ["node_modules", "dist"]
 }
```

---

### Incident Patch 12: `7b68fc26` (2026-10-05)
**Commit Message**: fix(copilot): warn when a VS Code profile cannot see the proxy settings (#3919)

## Description

`headroom wrap vscode` writes Copilot's two endpoint overrides into the
Default profile's `settings.json` and reports success. A VS Code window
that uses a profile with its own settings reads only
`User/profiles/<id>/settings.json`, and Copilot takes these overrides
from user settings alone. In that window Copilot keeps talking to GitHub
directly: Copilot works, Headroom records nothing, and setup said it
succeeded. That is exactly what #3716 describes. The reporter hasn't
confirmed yet that they use a profile (I asked on the issue), so this
says "Refs" rather than "Closes".

After writing a VS Code user directory's `settings.json`, `wrap vscode`
now reads the profiles VS Code records in that directory's
`globalStorage/storage.json`. That file is either the Default one or one
named with `--settings-file`. For each profile that keeps its own
settings and doesn't define both overrides as live settings, it prints a
warning with the exact `--settings-file` command that routes it.

Nothing is written to profile files automatically. The docs already
scope profile-specific settings to `--setti

**File**: `docs/content/docs/vscode-copilot.mdx` (modified, +3/-0)
```diff
@@ -159,6 +159,9 @@ both `copilot-auth login` and `wrap vscode`.
   does not add or rename models.
 - If connection is refused, keep the wrapper running and check loopback/remote
   port reachability.
+- If Headroom records no requests while Copilot keeps working, the window is
+  probably using a VS Code profile with its own settings. `wrap vscode` warns
+  about each such profile and prints the `--settings-file` path to configure it.
 - Use `--port 8788` when the default port is occupied; settings update safely.
 - If Headroom refuses settings, repair the reported JSONC/marker conflict or use
   `--no-configure` and apply the printed settings manually.
```

**File**: `headroom/cli/wrap.py` (modified, +7/-0)
```diff
@@ -116,6 +116,7 @@
 from headroom.providers.copilot import (
     configure_vscode_proxy_settings,
     remove_vscode_proxy_settings,
+    unrouted_vscode_profiles,
     vscode_proxy_url,
     vscode_settings_path,
 )
@@ -6688,6 +6689,12 @@ def _print_setup(actual_port: int) -> None:
                 vscode_proxy_url(actual_port, _project_name_from_cwd()),
             )
             click.echo(f"  VS Code Copilot proxy settings {action}: {target_settings}")
+            for name, profile_settings in unrouted_vscode_profiles(target_settings.parent):
+                click.echo(
+                    f"  Warning: VS Code profile '{name}' keeps its own settings, so Copilot "
+                    "there still bypasses Headroom. Route it with: headroom wrap vscode "
+                    f'--settings-file "{profile_settings}"'
+                )
             click.echo(
                 "  Keep using Copilot's normal model picker; the selected model is preserved."
             )
```

**File**: `headroom/providers/copilot/__init__.py` (modified, +2/-0)
```diff
@@ -3,6 +3,7 @@
 from .vscode import (
     configure_vscode_proxy_settings,
     remove_vscode_proxy_settings,
+    unrouted_vscode_profiles,
     vscode_proxy_url,
     vscode_settings_path,
     vscode_user_dir,
@@ -37,6 +38,7 @@
     "validate_configuration",
     "configure_vscode_proxy_settings",
     "remove_vscode_proxy_settings",
+    "unrouted_vscode_profiles",
     "vscode_proxy_url",
     "vscode_settings_path",
     "vscode_user_dir",
```

**File**: `headroom/providers/copilot/vscode.py` (modified, +46/-3)
```diff
@@ -108,13 +108,16 @@ def _strip_jsonc_comments(value: str) -> str:
     return "".join(result)
 
 
-def _validate_settings(raw: str, path: Path) -> None:
+def _parse_settings(raw: str) -> object:
     candidate = _strip_jsonc_comments(raw)
     if candidate.startswith("\ufeff"):
         candidate = candidate[1:]
-    candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
+    return json.loads(re.sub(r",\s*([}\]])", r"\1", candidate))
+
+
+def _validate_settings(raw: str, path: Path) -> None:
     try:
-        parsed = json.loads(candidate)
+        parsed = _parse_settings(raw)
     except json.JSONDecodeError as exc:
         raise click.ClickException(
             f"Could not safely parse {path}: {exc}. Headroom did not overwrite it."
@@ -198,3 +201,43 @@ def configure_vscode_proxy_settings(path: Path, proxy_url: str) -> str:
     _validate_settings(updated, path)
     fsutil.write_text(path, updated)
     return "updated" if had_managed_block else "added"
+
+
+def unrouted_vscode_profiles(user_dir: Path) -> list[tuple[str, Path]]:
+    """Return ``(name, settings.json)`` for profiles that ignore ``user_dir/settings.json``.
+
+    A window in a profile with its own settings reads only that profile's
+    settings.json, and Copilot takes its endpoint overrides from user settings
+    alone, so overrides in the user directory's settings.json never reach it.
+    A directory that is not a VS Code user directory has no profiles.
+    """
+    try:
+        state = json.loads(
+            (user_dir / "globalStorage" / "storage.json").read_text(encoding="utf-8")
+        )
+    except (OSError, ValueError):
+        return []
+    profiles = state.get("userDataProfiles") if isinstance(state, dict) else None
+    unrouted: list[tuple[str, Path]] = []
+    for profile in profiles if isinstance(profiles, list) else []:
+        if not isinstance(profile, dict):
+            continue
+        flags = profile.get("useDefaultFlags")
+        location = profile.get("location")
+        # VS Code names local profile folders hash(uuid).toString(16); any other
+        # location (a remote URI) is not a folder under profiles/.
+        if (isinstance(flags, dict) and flags.get("settings")) or not (
+            isinstance(location, str) and re.fullmatch(r"[\w-]+", location)
+        ):
+            continue
+        path = user_dir / "profiles" / location / "settings.json"
+        try:
+            settings = _parse_settings(_read_settings(path))
+        except (OSError, ValueError, click.ClickException):
+            settings = None
+        # Only live settings count: the managed-block marker is itself a comment.
+        if isinstance(settings, dict) and _PROXY_KEY in settings and _CAPI_KEY in settings:
+            continue
+        name = profile.get("name")
+        unrouted.append((name if isinstance(name, str) else location, path))
+    return unrouted
```

**File**: `tests/test_cli/test_wrap_vscode.py` (modified, +74/-0)
```diff
@@ -2,9 +2,11 @@
 
 from __future__ import annotations
 
+import json
 from pathlib import Path
 from unittest.mock import patch
 
+import pytest
 from click.testing import CliRunner
 
 from headroom.cli.main import main
@@ -46,6 +48,78 @@ def fake_watcher(**kwargs):  # noqa: ANN003, ANN202
     assert captured["copilot_api_token"] == "copilot-token"
 
 
+def _run_wrap_vscode(*args: str) -> str:
+    def fake_watcher(**kwargs):  # noqa: ANN003, ANN202
+        kwargs["print_setup_lines"](8787)
+
+    with (
+        patch(
+            "headroom.cli.wrap._require_copilot_subscription_resolution", return_value=_resolution()
+        ),
+        patch("headroom.cli.wrap._run_proxy_only_watcher", side_effect=fake_watcher),
+    ):
+        result = CliRunner().invoke(main, ["wrap", "vscode", *args])
+    assert result.exit_code == 0, result.output
+    return result.output
+
+
+def _write_profiles(user_dir: Path, *profiles: dict[str, object]) -> None:
+    storage = user_dir / "globalStorage" / "storage.json"
+    storage.parent.mkdir(parents=True)
+    storage.write_text(json.dumps({"userDataProfiles": list(profiles)}), encoding="utf-8")
+
+
+def _default_user_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
+    for var in ("APPDATA", "HOME", "USERPROFILE", "XDG_CONFIG_HOME"):
+        monkeypatch.setenv(var, str(tmp_path))
+    from headroom.providers.copilot.vscode import vscode_user_dir
+
+    return vscode_user_dir()
+
+
+def test_wrap_vscode_names_profiles_that_ignore_default_settings(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    user_dir = _default_user_dir(tmp_path, monkeypatch)
+    _write_profiles(
+        user_dir,
+        {"location": "6c87cdb4", "name": "Work"},
+        {"location": "1a2b", "name": "Shared", "useDefaultFlags": {"settings": True}},
+    )
+    work_settings = user_dir / "profiles" / "6c87cdb4" / "settings.json"
+
+    implicit = _run_wrap_vscode()
+    assert "overrideCapiUrl" in (user_dir / "settings.json").read_text(encoding="utf-8")
+    # A window in the "Work" profile reads only its own settings.json, so the
+    # block above never reaches it; say so instead of reporting plain success.
+    assert "VS Code profile 'Work'" in implicit
+    assert str(work_settings) in implicit
+    # A profile that shares the Default profile's settings already sees the block.
+    assert "Shared" not in implicit
+    # Naming the Default file explicitly configures the same file, so it warns too.
+    explicit = _run_wrap_vscode("--settings-file", str(user_dir / "settings.json"))
+    assert "VS Code profile 'Work'" in explicit
+    # Following the advice routes the profile, and nothing is left to warn about.
+    assert "Warning" not in _run_wrap_vscode("--settings-file", str(work_settings))
+    assert "Warning" not in _run_wrap_vscode()
+
+
+def test_wrap_vscode_checks_the_profiles_of_the_user_dir_it_configures(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    _write_profiles(
+        _default_user_dir(tmp_path, monkeypatch), {"location": "6c87cdb4", "name": "Work"}
+    )
+    # e.g. VS Code Insiders, VSCodium, or a portable install with its own profiles.
+    other_user_dir = tmp_path / "Code - Insiders" / "User"
+    _write_profiles(other_user_dir, {"location": "-2b3c4d", "name": "Beta"})
+
+    output = _run_wrap_vscode("--settings-file", str(other_user_dir / "settings.json"))
+
+    assert "VS Code profile 'Beta'" in output
+    assert "Work" not in output
+
+
 def test_wrap_vscode_no_configure_prints_transparent_settings(tmp_path: Path) -> None:
     path = tmp_path / "settings.json"
 
```

**File**: `tests/test_provider_copilot_vscode_config.py` (modified, +101/-0)
```diff
@@ -1,5 +1,6 @@
 from __future__ import annotations
 
+import json
 from pathlib import Path
 
 import click
@@ -8,6 +9,7 @@
 from headroom.providers.copilot.vscode import (
     configure_vscode_proxy_settings,
     remove_vscode_proxy_settings,
+    unrouted_vscode_profiles,
     vscode_proxy_url,
     vscode_settings_path,
 )
@@ -107,3 +109,102 @@ def test_configure_refuses_duplicate_managed_markers(tmp_path: Path) -> None:
     with pytest.raises(click.ClickException, match="marker block"):
         configure_vscode_proxy_settings(path, "http://127.0.0.1:8787")
     assert path.read_text(encoding="utf-8") == original
+
+
+def _write_profiles(tmp_path: Path, state: object) -> Path:
+    user_dir = tmp_path / "User"
+    storage = user_dir / "globalStorage" / "storage.json"
+    storage.parent.mkdir(parents=True)
+    storage.write_text(state if isinstance(state, str) else json.dumps(state), encoding="utf-8")
+    return user_dir
+
+
+def test_unrouted_profiles_lists_only_profiles_with_their_own_settings(tmp_path: Path) -> None:
+    user_dir = _write_profiles(
+        tmp_path,
+        {
+            "userDataProfiles": [
+                {"location": "6c87cdb4", "name": "Work"},
+                {"location": "-1f2e3d", "name": "Negative hash"},
+                {"location": "aa11", "name": "Shared", "useDefaultFlags": {"settings": True}},
+                {"location": "../escape", "name": "Traversal"},
+                {"location": {"scheme": "vscode-remote", "path": "/p"}, "name": "Remote"},
+                "not-a-profile",
+            ]
+        },
+    )
+
+    assert unrouted_vscode_profiles(user_dir) == [
+        ("Work", user_dir / "profiles" / "6c87cdb4" / "settings.json"),
+        ("Negative hash", user_dir / "profiles" / "-1f2e3d" / "settings.json"),
+    ]
+
+
+@pytest.mark.parametrize("managed", [True, False])
+def test_unrouted_profiles_skips_a_profile_that_overrides_both_endpoints(
+    tmp_path: Path, managed: bool
+) -> None:
+    user_dir = _write_profiles(
+        tmp_path, {"userDataProfiles": [{"location": "6c87cdb4", "name": "Work"}]}
+    )
+    profile_settings = user_dir / "profiles" / "6c87cdb4" / "settings.json"
+    profile_settings.parent.mkdir(parents=True)
+    if managed:
+        configure_vscode_proxy_settings(profile_settings, "http://127.0.0.1:8787")
+    else:
+        profile_settings.write_text(
+            """{
+    "github.copilot.advanced.debug.overrideProxyUrl": "http://127.0.0.1:8787",
+    "github.copilot.advanced.debug.overrideCapiUrl": "http://127.0.0.1:8787",
+}
+""",
+            encoding="utf-8",
+        )
+
+    assert unrouted_vscode_profiles(user_dir) == []
+
+
+@pytest.mark.parametrize(
+    "settings",
+    [
+        # The marker is itself a comment, so on its own it proves nothing.
+        """{
+    // --- Headroom Copilot proxy ---
+}
+""",
+        """{
+    // --- Headroom Copilot proxy ---
+    // "github.copilot.advanced.debug.overrideProxyUrl": "http://127.0.0.1:8787",
+    // "github.copilot.advanced.debug.overrideCapiUrl": "http://127.0.0.1:8787"
+    // --- end Headroom Copilot proxy ---
+}
+""",
+        """{
+    "note": "// --- Headroom Copilot proxy ---",
+    "github.copilot.advanced.debug.overrideCapiUrl": "http://127.0.0.1:8787"
+}
+""",
+        '{ "github.copilot.advanced.debug.overrideCapiUrl": ',
+    ],
+    ids=["marker-only", "commented-out-keys", "one-key", "unparseable"],
+)
+def test_unrouted_profiles_counts_only_live_override_settings(
+    tmp_path: Path, settings: str
+) -> None:
+    user_dir = _write_profiles(
+        tmp_path, {"userDataProfiles": [{"location": "6c87cdb4", "name": "Work"}]}
+    )
+    profile_settings = user_dir / "profiles" / "6c87cdb4" / "settings.json"
+    profile_settings.parent.mkdir(parents=True)
+    profile_settings.write_text(settings, encoding="utf-8")
+
+    assert unrouted_vscode_profiles(user_dir) == [("Work", profile_settings)]
+
+
+@pytest.mark.parametrize("state", ["{not json", [], {"userDataProfiles": {"a": 1}}, {}])
+def test_unrouted_profiles_tolerates_unexpected_vscode_state(tmp_path: Path, state: object) -> None:
+    assert unrouted_vscode_profiles(_write_profiles(tmp_path, state)) == []
+
+
+def test_unrouted_profiles_without_vscode_state(tmp_path: Path) -> None:
+    assert unrouted_vscode_profiles(tmp_path) == []
```

---

### Incident Patch 13: `613ae921` (2026-10-05)
**Commit Message**: fix(proxy): keep the newest user message verbatim in cache-mode delta compression (#3923)

## Description

**What users see:** with the default settings (`cache` mode plus the
`coding` savings profile), the proxy can rewrite the newest user message
of a conversation from the second request onward. #3619 made the rule
that the user's own prompt reaches the model verbatim, but one code path
missed it. For a Claude Code agent team this is the message a teammate
receives from the lead (`<teammate-message>…`), which is one way a
teammate can end up with a message it calls garbage (#1174).

**Why it happens:** in cache mode the first request of a conversation is
compressed in full. After that, only the new messages (the "stable
delta") are compressed and spliced onto the prefix that was already
forwarded. Every Anthropic `pipeline.apply(...)` call passes
`prefix_replay_guaranteed=True` except this delta call. Without that
flag the router does not protect the newest user message, and the coding
profile turns user-message compression on.

**Fix:** pass `prefix_replay_guaranteed=True` on the delta call as well.
The flag means "the caller replays last turn's forwarded bytes over this
turn's 

**File**: `headroom/proxy/handlers/anthropic.py` (modified, +5/-0)
```diff
@@ -2207,6 +2207,11 @@ class _DeferredCompressionResult:
                                         model_limit=context_limit,
                                         context=extract_user_query(compression_input),
                                         frozen_message_count=prefix_n,
+                                        # The compressed delta is replayed
+                                        # verbatim next turn, so the router
+                                        # keeps the newest user prompt intact
+                                        # here as on every other path (#1174).
+                                        prefix_replay_guaranteed=True,
                                         idle_seconds=idle_seconds,
                                         biases=biases,
                                         protect=protect,
```

**File**: `tests/test_proxy_anthropic_cache_stability.py` (modified, +74/-0)
```diff
@@ -1287,6 +1287,80 @@ async def _fake_retry(method, url, headers, body, stream=False, **kwargs):  # no
         ]
 
 
+def test_cache_mode_delta_keeps_newest_user_prompt_verbatim() -> None:
+    """The cache-mode delta call must tell the router the prefix is replayed.
+
+    Without ``prefix_replay_guaranteed`` the router treats the newest user
+    message as compressible text, so under the coding profile (which turns on
+    user-message compression) a follow-up prompt -- e.g. a Claude Code
+    teammate's ``<teammate-message>`` -- reached the model lossily rewritten
+    on every turn after the first (#1174). Every other Anthropic
+    ``pipeline.apply`` call already passes the flag.
+    """
+    captured: dict = {}
+    with _make_proxy_client() as client:
+        proxy = client.app.state.proxy
+        proxy.config.optimize = True
+        proxy.config.mode = "cache"
+        proxy.config.image_optimize = False
+
+        tracker = _FakePrefixTracker(frozen_count=0)
+        tracker._last_original_messages = [
+            {"role": "user", "content": "turn1"},
+            {"role": "assistant", "content": "turn1-assistant"},
+        ]
+        tracker._last_forwarded_messages = list(tracker._last_original_messages)
+        proxy.session_tracker_store.compute_session_id = lambda request, model, messages: (
+            "stable-session"
+        )
+        proxy.session_tracker_store.get_or_create = lambda session_id, provider: tracker
+
+        def _fake_apply(**kwargs):
+            captured.update(kwargs)
+            return SimpleNamespace(
+                messages=list(kwargs["messages"]),
+                transforms_applied=[],
+                timing={},
+                tokens_before=10,
+                tokens_after=10,
+                waste_signals=None,
+            )
+
+        proxy.anthropic_pipeline.apply = _fake_apply
+
+        async def _fake_retry(method, url, headers, body, stream=False, **kwargs):  # noqa: ANN001
+            return httpx.Response(
+                200,
+                json={
+                    "id": "msg_delta_prompt",
+                    "type": "message",
+                    "role": "assistant",
+                    "content": [{"type": "text", "text": "ok"}],
+                    "usage": {"input_tokens": 10, "output_tokens": 1},
+                },
+            )
+
+        proxy._retry_request = _fake_retry
+
+        response = client.post(
+            "/v1/messages",
+            headers={"x-api-key": "test-key", "anthropic-version": "2023-06-01"},
+            json={
+                "model": "claude-sonnet-4-6",
+                "max_tokens": 64,
+                "messages": [
+                    {"role": "user", "content": "turn1"},
+                    {"role": "assistant", "content": "turn1-assistant"},
+                    {"role": "user", "content": "<teammate-message>next task</teammate-message>"},
+                ],
+            },
+        )
+
+        assert response.status_code == 200
+        assert captured["frozen_message_count"] == 2  # the delta path ran
+        assert captured.get("prefix_replay_guaranteed") is True
+
+
 def test_anthropic_handler_splits_prefix_trackers_when_tool_profiles_differ() -> None:
     """The handler must pass its non-message cache affinity into resolution.
 
```

---

### Incident Patch 14: `d99779da` (2026-10-05)
**Commit Message**: fix(security): exempt only GET health probes from the proxy token (#3921)

## Description

When `HEADROOM_PROXY_TOKEN` is set, `_security_gate` exempts `/health`,
`/healthz`, `/livez` and `/readyz` from the token check so orchestrators
can probe a container bound to a non-loopback address. The exemption
matched the path only, ignoring the method.

Only `GET` on `/health`, `/livez` and `/readyz` reaches a health
handler. Everything else on those paths falls through to the catch-all
`/{path:path}` passthrough, which relays the request upstream:
- `/healthz` has no Python route at all; only the Rust `headroom-proxy`
serves it.
- `POST`, `PUT` and `DELETE` on the three health paths do not match the
`GET` routes.
- `HEAD` does not match them either, because FastAPI's `@app.get` does
not register `HEAD`.

So with a token configured, an unauthenticated non-loopback caller could
send any method and body through the passthrough, to the configured
upstream or to a public host chosen with `x-headroom-base-url`. The
token is meant to prevent exactly that.

## Type of Change

- [x] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)


**File**: `headroom/proxy/server.py` (modified, +8/-2)
```diff
@@ -3989,7 +3989,12 @@ async def _record_headroom_stack(request, call_next):
     _proxy_token_bytes = _proxy_token.encode("utf-8") if _proxy_token else b""
     # Health/readiness probes must stay reachable without a token so
     # orchestrators can check a container that binds non-loopback.
-    _AUTH_EXEMPT_PATHS = frozenset({"/health", "/healthz", "/livez", "/readyz"})
+    #
+    # The exemption covers only GET, and only paths with a GET handler below.
+    # Anything else on these paths falls through to the catch-all passthrough
+    # relay (FastAPI's @app.get does not register HEAD), so exempting it would
+    # let an unauthenticated caller relay arbitrary requests upstream.
+    _AUTH_EXEMPT_PATHS = frozenset({"/health", "/livez", "/readyz"})
 
     # A non-loopback bind with no token is the exact shape (``--host 0.0.0.0``
     # from any launcher) that exposes the unauthenticated /v1/* relay to the
@@ -4050,7 +4055,8 @@ async def _security_gate(request, call_next):
             path = request.url.path
             client = getattr(request, "client", None)
             client_host = getattr(client, "host", None) if client is not None else None
-            if path not in _AUTH_EXEMPT_PATHS and not is_loopback_host(client_host):
+            exempt = request.method == "GET" and path in _AUTH_EXEMPT_PATHS
+            if not exempt and not is_loopback_host(client_host):
                 provided = _extract_proxy_token(request.headers)
                 if provided is None or not hmac.compare_digest(
                     provided.encode("utf-8", "replace"), _proxy_token_bytes
```

**File**: `tests/test_proxy_hardening.py` (modified, +32/-0)
```diff
@@ -16,11 +16,13 @@
 
 pytest.importorskip("fastapi")
 
+from fastapi.responses import JSONResponse
 from fastapi.testclient import TestClient
 
 from headroom.cache.compression_store import reset_compression_store
 from headroom.offline import apply_offline_env, is_offline
 from headroom.proxy.audit import is_auditable_path
+from headroom.proxy.handlers.openai import OpenAIHandlerMixin
 from headroom.proxy.server import (
     ProxyConfig,
     WebSocketAuthMiddleware,
@@ -127,6 +129,36 @@ def test_health_endpoints_exempt_even_nonloopback(self):
             assert c.get("/livez").status_code == 200
             assert c.get("/readyz").status_code in (200, 503)  # ready/not-ready, never 401
 
+    @pytest.mark.parametrize(
+        ("method", "path"),
+        [
+            ("GET", "/healthz"),  # no Python route: lands on the catch-all
+            ("POST", "/health"),
+            ("PUT", "/livez"),
+            ("DELETE", "/readyz"),
+            ("HEAD", "/livez"),  # @app.get does not register HEAD
+        ],
+    )
+    def test_health_exemption_does_not_reach_passthrough(self, monkeypatch, method, path):
+        """Only GET probes are exempt from the token.
+
+        Any other request on a health path is not served by the health handler
+        but by the catch-all passthrough, which relays it upstream. Exempting
+        those turned the proxy into an unauthenticated relay.
+        """
+        relayed: list[tuple[str, str]] = []
+
+        async def _spy_passthrough(self, request, base_url, *args, **kwargs):
+            relayed.append((request.method, request.url.path))
+            return JSONResponse({"relayed_to": base_url})
+
+        monkeypatch.setattr(OpenAIHandlerMixin, "handle_passthrough", _spy_passthrough)
+        app = _make_app(proxy_token="s3cr3t-token")
+        with TestClient(app, base_url="http://testserver", client=NONLOOPBACK) as c:
+            resp = c.request(method, path)
+        assert resp.status_code == 401
+        assert relayed == []
+
 
 # ──────────────────── 2.1b inbound auth token over WebSocket ──────────────
 
```

---

### Incident Patch 15: `d722a641` (2026-10-05)
**Commit Message**: fix(backends/anyllm): map Anthropic tool_choice none to OpenAI none (#3963)

## Description

`AnyLLMBackend._convert_tool_choice` translates an Anthropic
`tool_choice` into the OpenAI shape that any-llm speaks. It handled
`auto`, `any`, and `tool`, but **not** `{"type": "none"}`, so that value
fell through to the final `return "auto"`.

`{"type": "none"}` means *"do not use any tool this turn."* Converting
it to `"auto"` inverts the instruction into *"you may use tools,"* so
the model can call a tool the client explicitly forbade. The litellm
backend already maps this case to OpenAI's `"none"` (see
`headroom/backends/litellm.py`); this brings the any-llm backend in
line. The any-llm docstring even claimed it "mirrors LiteLLM" while
omitting this branch.

## Type of Change

- [x] Bug fix (non-breaking change that fixes an issue)

## Changes Made

- Add a `choice_type == "none"` branch to
`AnyLLMBackend._convert_tool_choice` returning OpenAI `"none"`.
- Update the docstring to list the `none` case.
- Tests: a parametrized unit test covering all four Anthropic
`tool_choice` types, plus an end-to-end `send_message` test asserting
`{"type": "none"}` reaches any-llm as `"none"`.

## Test

**File**: `headroom/backends/anyllm.py` (modified, +11/-4)
```diff
@@ -48,10 +48,10 @@ def _convert_anthropic_tool(tool: dict[str, Any]) -> dict[str, Any]:
 def _convert_tool_choice(choice: Any) -> Any:
     """Convert an Anthropic ``tool_choice`` to the OpenAI shape (mirrors LiteLLM).
 
-    Anthropic: ``{"type": "auto"}``, ``{"type": "any"}``, ``{"type": "tool",
-    "name": ...}``. OpenAI: ``"auto"``, ``"required"``, ``{"type": "function",
-    "function": {"name": ...}}``. Passing the raw Anthropic dict through makes
-    the provider reject or ignore it.
+    Anthropic: ``{"type": "auto"}``, ``{"type": "any"}``, ``{"type": "none"}``,
+    ``{"type": "tool", "name": ...}``. OpenAI: ``"auto"``, ``"required"``,
+    ``"none"``, ``{"type": "function", "function": {"name": ...}}``. Passing the
+    raw Anthropic dict through makes the provider reject or ignore it.
     """
     if isinstance(choice, str):
         return choice
@@ -61,6 +61,13 @@ def _convert_tool_choice(choice: Any) -> Any:
             return "auto"
         if choice_type == "any":
             return "required"
+        if choice_type == "none":
+            # Anthropic's {"type": "none"} means "do not use any tool this turn".
+            # Without this branch it fell through to the "auto" default below,
+            # inverting the instruction into "you may use tools" — the model
+            # could then call a tool the client explicitly forbade. OpenAI's
+            # equivalent is the string "none".
+            return "none"
         if choice_type == "tool":
             return {"type": "function", "function": {"name": choice.get("name", "")}}
     return "auto"
```

**File**: `tests/test_backend_anyllm.py` (modified, +46/-0)
```diff
@@ -340,6 +340,52 @@ async def test_send_message_converts_anthropic_tools_and_tool_choice(
     assert sent["tool_choice"] == "required"
 
 
+@pytest.mark.parametrize(
+    ("anthropic_choice", "openai_choice"),
+    [
+        ({"type": "auto"}, "auto"),
+        ({"type": "any"}, "required"),
+        ({"type": "none"}, "none"),
+        ({"type": "tool", "name": "t"}, {"type": "function", "function": {"name": "t"}}),
+    ],
+)
+def test_convert_tool_choice_covers_every_anthropic_type(
+    anthropic_choice: dict[str, object], openai_choice: object
+) -> None:
+    """Every Anthropic tool_choice type maps to its OpenAI equivalent.
+
+    ``{"type": "none"}`` ("do not use any tool this turn") previously fell
+    through to the ``"auto"`` default, inverting the instruction into "you may
+    use tools" so the model could call a tool the client explicitly forbade.
+    """
+    assert anyllm._convert_tool_choice(anthropic_choice) == openai_choice
+
+
+@pytest.mark.asyncio
+async def test_send_message_forwards_tool_choice_none(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    """A request forbidding tools must reach any-llm as OpenAI ``"none"``.
+
+    Regression: ``{"type": "none"}`` was converted to ``"auto"``, letting the
+    model call a tool the client disabled for the turn.
+    """
+    backend, instance = make_backend(monkeypatch)
+    instance.response = make_response(make_choice("ok", "stop"))
+
+    await backend.send_message(
+        {
+            "model": "claude",
+            "messages": [{"role": "user", "content": "hi"}],
+            "tools": [{"name": "t", "input_schema": {"type": "object"}}],
+            "tool_choice": {"type": "none"},
+        },
+        {},
+    )
+
+    assert instance.calls[0]["tool_choice"] == "none"
+
+
 @pytest.mark.asyncio
 async def test_stream_message_converts_anthropic_tools_and_tool_choice(
     monkeypatch: pytest.MonkeyPatch,
```

#### Recent Merged Pull Requests:
- **PR #3988** (2026-10-06): deps: Bump source-map-js from 1.2.1 to 1.2.2 in /plugins/openclaw (@dependabot[bot])
- **PR #3987** (2026-10-06): deps: Bump source-map-js from 1.2.1 to 1.2.2 in /plugins/opencode (@dependabot[bot])
- **PR #3986** (2026-10-06): deps: Bump source-map-js from 1.2.1 to 1.2.2 in /docs (@dependabot[bot])
- **PR #3985** (2026-10-06): deps: Bump source-map-js from 1.2.1 to 1.2.2 in /sdk/typescript (@dependabot[bot])
- **PR #3984** (2026-10-06): fix(ci): clear dependency audit and gate Docker publishing (@JerrettDavis)
- **PR #3979** (closed): type(feature): headroom-snip Claude Code mod that animates compression savings on tokens (@sunboy)
- **PR #3966** (2026-10-05): fix(subscription): match the Bearer scheme case-insensitively for the Codex usage poll (RFC 7235) (@rajatnagda45)
- **PR #3965** (2026-10-05): fix(backends/litellm): match the caller-key Bearer scheme case-insensitively (RFC 7235) (@rajatnagda45)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
