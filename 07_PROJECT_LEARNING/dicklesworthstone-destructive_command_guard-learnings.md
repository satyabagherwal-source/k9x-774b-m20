> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dicklesworthstone-destructive_command_guard-learnings.md`  
> **Source**: github ([https://github.com/Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard))  
> **Source Version**: `2680518d`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T05:18:59.710Z  
> **Learning ID**: `learn-github-dicklesworthstone-destructive_command_guard`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Dicklesworthstone/destructive_command_guard

> **Canonical Artifact**: `07_PROJECT_LEARNING/dicklesworthstone-destructive_command_guard-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T05:18:59.700Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dicklesworthstone/destructive_command_guard`
- **Description**: The Destructive Command Guard (dcg) is for blocking dangerous git and shell commands from being executed by agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6186 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/hook_latency.rs`
```
//! Hook-mode latency benchmarks.
//!
//! Measures evaluate_command latency across safe, denied, and unrelated commands
//! to ensure hook mode stays under 50ms p99 for agent responsiveness.
//!
//! Run with: `cargo bench --bench hook_latency`

use std::hint::black_box;

use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use destructive_command_guard::packs::REGISTRY;
use destructive_command_guard::{Config, EvaluationDecision, LayeredAllowlist};

struct EvalContext {
    enabled_keywords: Vec<&'static str>,
    ordered_packs: Vec<String>,
    keyword_index: Option<destructive_command_guard::packs::EnabledKeywordIndex>,
    compiled_overrides: destructive_command_guard::config::CompiledOverrides,
    heredoc_settings: destructive_command_guard::config::HeredocSettings,
    allowlists: LayeredAllowlist,
}

impl EvalContext {
    fn new() -> Self {
        let mut config = Config::default();
        config.heredoc.enabled = Some(false);
        config.packs.enabled = vec![
            "core".to_string(),
            "database.postgresql".to_string(),
            "containers.docker".to_string(),
            "kubernetes".to_string(),
        ];

        let enabled_packs = config.enabled_pack_ids();
        let ordered_packs = REGISTRY.expand_enabled_ordered(&enabled_packs);
        Self {
            enabled_keywords: REGISTRY.collect_enabled_keywords(&enabled_packs),
            keyword_index: REGISTRY.build_enabled_keyword_index(&ordered_packs),
            ordered_packs,
            compiled_overrides: config.overrides.compile(),
            heredoc_settings: config.heredoc_settings(),
            allowlists: LayeredAllowlist::default(),
        }
    }

    fn evaluate(&self, command: &str) -> destructive_command_guard::EvaluationResult {
        destructive_command_guard::evaluate_command_with_pack_order(
            command,
            self.enabled_keywords.as_slice(),
            self.ordered_packs.as_slice(),
            self.keyword_index.as_ref(),
            &self.compiled_overrides,
            &self.allowlists,
            &self.heredoc_settings,
        )
    }
}

fn bench_evaluate_command(c: &mut Criterion) {
    let ctx = EvalContext::new();

    let commands: &[(&str, &str, EvaluationDecision)] = &[
        ("safe_echo", "echo hello world", EvaluationDecision::Allow),
        ("safe_ls", "ls -la /tmp", EvaluationDecision::Allow),
        ("safe_git_status", "git status", EvaluationDecision::Allow),
        (
            "safe_git_log",
            "git log --oneline -10",
            EvaluationDecision::Allow,
        ),
        (
            "denied_rm_rf",
            "rm -rf /important/data",
            EvaluationDecision::Deny,
        ),
        (
            "denied_git_force_push",
            "git push --force origin main",
            EvaluationDecision::Deny,
        ),
        (
            "denied_drop_database",
            "dropdb production",
            EvaluationDecision::Deny,
        ),
        (
            "denied_docker_system_prune",
            "docker system prune -af",
            EvaluationDecision::Deny,
        ),
        (
            "denied_kubectl_delete_ns",
            "kubectl delete namespace production",
            EvaluationDecision::Deny,
        ),
        (
            "unrelated_cargo_build",
            "cargo build --release",
            EvaluationDecision::Allow,
        ),
        (
            "unrelated_python",
            "python3 -m pytest tests/",
            EvaluationDecision::Allow,
        ),
        ("unrelated_npm", "npm run build", EvaluationDecision::Allow),
    ];

    let mut group = c.benchmark_group("evaluate_command");
    group.measurement_time(std::time::Duration::from_secs(5));

    for (name, cmd, expected_decision) in commands {
        let result = ctx.evaluate(cmd);
        assert_eq!(
            &result.decision, expected_decision,
            "pre-check failed for {name}: {cmd}"
        );

        group.bench_with_input(BenchmarkId::new("latency", name), cmd, |b, cmd| {
            b.iter(|| ctx.evaluate(black_box(cmd)));
        });
    }

    group.finish();
}

fn bench_long_command(c: &mut Criterion) {
    let ctx = EvalContext::new();

    let long_safe = format!("echo {}", "hello ".repeat(200));
    let long_denied = format!("rm -rf /tmp/dir && {}", "echo ok && ".repeat(100));

    let mut group = c.benchmark_group("long_command");
    group.measurement_time(std::time::Duration::from_secs(5));

    group.bench_function("long_safe_1200_chars", |b| {
        b.iter(|| ctx.evaluate(black_box(&long_safe)));
    });

    group.bench_function("long_denied_compound", |b| {
        b.iter(|| ctx.evaluate(black_box(&long_denied)));
    });

    group.finish();
}

fn bench_issue_555(c: &mut Criterion) {
    let mut ctx = EvalContext::new();
    ctx.heredoc_settings = Config::default().heredoc_settings();
    let mut group = c.benchmark_group("issue_555");
    for lines in [1, 40, 300] {
        let body = "print('ordinary data')\n".repeat(lines);
        for (name, command, expected) in [
            (
                "python",
                format!("python3 - <<'EOF'\n{body}EOF"),
                EvaluationDecision::Allow,
            ),
            (
                "quoted_data",
                format!("cat <<'EOF'\n{body}rm -rf /\nEOF"),
                EvaluationDecision::Allow,
            ),
            (
                "python_deny",
                format!("python3 - <<'EOF'\n{body}import shutil\nshutil.rmtree('/tmp')\nEOF"),
                EvaluationDecision::Deny,
            ),
        ] {
            assert_eq!(ctx.evaluate(&command).decision, expected, "{name}/{lines}");
            group.bench_with_input(BenchmarkId::new(name, lines), &command, |b, cmd| {
                b.iter(|| ctx.evaluate(black_box(cmd)));
            });
        }
    }
    let compound = "cd project && git status --short | head && grep -rn foo src | wc -l";
    assert_eq!(ctx.evaluate(compound).decision, EvaluationDecision::Allow);
    group.bench_function("compound", |b| b.iter(|| ctx.evaluate(black_box(compound))));
    group.finish();
}

fn bench_keyword_rejection(c: &mut Criterion) {
    let ctx = EvalContext::new();

    let no_keyword_commands = &[
        "cargo test --release",
        "python3 manage.py runserver",
        "node server.js",
        "make -j8",
        "gcc -o main main.c",
    ];

    let mut group = c.benchmark_group("keyword_rejection");
    group.measurement_time(std::time::Duration::from_secs(5));

    for cmd in no_keyword_commands {
        let result = ctx.evaluate(cmd);
        assert_eq!(result.decision, EvaluationDecision::Allow);

        group.bench_with_input(
            BenchmarkId::new("fast_reject", cmd.split_whitespace().next().unwrap()),
            cmd,
            |b, cmd| {
                b.iter(|| ctx.evaluate(black_box(cmd)));
            },
        );
    }

    group.finish();
}

fn bench_throughput(c: &mut Criterion) {
    let ctx = EvalContext::new();

    let mixed_commands = vec![
        "echo hello",
        "ls -la",
        "git status",
        "rm -rf /data",
        "git push --force origin main",
        "cargo build",
        "docker ps",
        "kubectl get pods",
        "psql -c 'SELECT 1'",
        "npm install express",
    ];

    c.bench_function("throughput_10_mixed_commands", |b| {
        b.iter(|| {
            for cmd in &mixed_commands {
                black_box(ctx.evaluate(black_box(cmd)));
            }
        });
    });
}

criterion_group!(
    benches,
    bench_evaluate_command,
    bench_long_command,
    bench_issue_555,
    bench_keyword_rejection,
    bench_throughput
);
criterion_main!(benches);

```

### Core Architecture Module: `fuzz/fuzz_targets/fuzz_hook_input.rs`
```
//! Fuzz target for hook JSON input parsing.
//!
//! This fuzzes the JSON parsing that receives input from Claude Code's hook.
//! It tests for:
//! - Panics from malformed JSON
//! - Type confusion attacks
//! - Memory issues from deeply nested structures

#![no_main]

use libfuzzer_sys::fuzz_target;

use destructive_command_guard::hook::HookInput;

fuzz_target!(|data: &[u8]| {
    // Skip extremely large inputs to avoid timeout (not a real bug)
    if data.len() > 100_000 {
        return;
    }

    // Try to interpret as UTF-8 first (JSON is UTF-8)
    if let Ok(json_str) = std::str::from_utf8(data) {
        // Try to parse as HookInput - this should never panic
        let _ = serde_json::from_str::<HookInput>(json_str);
    }

    // Also try parsing raw bytes (tests error handling)
    let _ = serde_json::from_slice::<HookInput>(data);
});

```

### Core Architecture Module: `src/ast_pattern_engine.rs`
```
//! AST-based pattern matching for heredoc and inline script content.
//!
//! This module implements Tier 3 of the heredoc detection architecture,
//! using ast-grep-core for structural pattern matching.
//!
//! # Architecture
//!
//! ```text
//! Content + Language
//!      │
//!      ▼
//! ┌─────────────────┐
//! │   AstMatcher    │ ─── Parse error ──► ERROR to bounded fallback
//! │   (ast-grep)    │ ─── Timeout ──► ERROR to bounded fallback
//! │   <5ms typical  │ ─── No match ──► EMPTY result to evaluator
//! │   20ms max      │ ─── Match ──► MATCH result to evaluator
//! └─────────────────┘
//! ```
//!
//! # Error Handling
//!
//! All errors are returned to the evaluator, which applies the configured
//! bounded-fallback or strict-block policy:
//! - Parse errors: Language syntax not recognized
//! - Timeouts: Pattern matching exceeded time budget
//! - Unknown language: No grammar available
//!
//! # Performance
//!
//! - Pattern compilation: One-time at startup
//! - Parse: <2ms for typical heredoc sizes
//! - Match: <1ms typical
//! - Hard timeout: 20ms

use crate::heredoc::ScriptLanguage;
use ast_grep_core::matcher::{Matcher, MatcherExt};
use ast_grep_core::{AstGrep, Pattern};
use ast_grep_language::SupportLang;
use memchr::memchr_iter;
use regex::Regex;
use std::borrow::Cow;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, OnceLock, mpsc};
use std::thread;
use std::time::{Duration, Instant};

/// Hard timeout for AST operations (20ms as per ADR).
///
/// Tests use a much more generous budget because the full suite runs thousands
/// of AST-heavy cases in parallel.  On a loaded CI host a worker can be
/// descheduled for hundreds of milliseconds before it parses even this tiny
/// fixture; production builds retain the strict 20ms tier-local ceiling below.
#[cfg(not(test))]
const AST_TIMEOUT_MS: u64 = 20;
#[cfg(test)]
const AST_TIMEOUT_MS: u64 = 5_000;

/// Upper bound on `DCG_AST_TIMEOUT_MS`.
///
/// Comfortably above the hook deadline, past which raising this budget buys
/// nothing, while still refusing a value that would park a worker indefinitely.
const AST_TIMEOUT_CEILING_MS: u64 = 60_000;

/// The AST-matching budget, resolved once per process.
///
/// `DCG_AST_TIMEOUT_MS` may only **raise** the compiled-in budget, never lower
/// it. The `cfg(test)` value above covers in-crate tests, but the protocol
/// suites spawn the real release binary, so they got the strict 20ms and had no
/// way to reach past it: under parallel load a worker is descheduled, the
/// embedded-code analysis reports itself incomplete, and the bounded fallback
/// answers correctly but **without a rule id** — so an assertion about *which*
/// rule fired fails while the product behaves properly (#438). A semantic test
/// should not double as a deadline test.
///
/// Only-raise is the safe direction and is deliberate: a budget an operator
/// could shrink from the environment would push the matcher into its bounded
/// fallback more often, which is precisely the `DCG_*`-in-`settings.json`
/// footgun that #245 was about. Lowering remains possible through the
/// enclosing hook and heredoc budgets, which are measured, not assumed.
fn ast_timeout() -> Duration {
    static RESOLVED_MS: LazyLock<u64> = LazyLock::new(|| {
        resolve_ast_timeout_ms(std::env::var("DCG_AST_TIMEOUT_MS").ok().as_deref())
    });
    Duration::from_millis(*RESOLVED_MS)
}

/// The budget an environment request resolves to, given the compiled-in floor.
///
/// Split out from [`ast_timeout`] because that caches its answer for the process,
/// which is right for a hot path and useless for testing the clamp.
fn resolve_ast_timeout_ms(requested: Option<&str>) -> u64 {
    requested
        .and_then(|raw| raw.trim().parse::<u64>().ok())
        .map_or(AST_TIMEOUT_MS, |ms| {
            ms.clamp(AST_TIMEOUT_MS, AST_TIMEOUT_CEILING_MS)
        })
}

/// Maximum body size the AST matcher will parse directly.
///
/// Heredoc extraction already defaults to a 1 MiB body cap; keeping the direct
/// matcher aligned prevents library callers and fuzz targets from bypassing the
/// same bounded parsing budget by invoking AST parsing on much larger inputs.
const MAX_AST_INPUT_BYTES: usize = 1024 * 1024;

/// Severity level for pattern matches.
///
/// Determines the default action taken when a pattern matches.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Severity {
    /// Always block - no allowlist override without explicit config.
    Critical,
    /// Block by default, can be allowlisted.
    High,
    /// Warn by default (log but don't block).
    Medium,
    /// Log only - informational.
    Low,
}

impl Severity {
    /// Human-readable label for this severity.
    #[must_use]
    pub const fn label(&self) -> &'static str {
        match self {
            Self::Critical => "critical",
            Self::High => "high",
            Self::Medium => "medium",
            Self::Low => "low",
        }
    }

    /// Whether this severity should block by default.
    #[must_use]
    pub const fn blocks_by_default(&self) -> bool {
        matches!(self, Self::Critical | Self::High)
    }
}

/// Result of a pattern match.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PatternMatch {
    /// Stable rule ID for allowlisting (e.g., `heredoc.python.subprocess_rm`).
    pub rule_id: String,
    /// Human-readable reason for the match.
    pub reason: String,
    /// Preview of the matched text (truncated if too long).
    pub matched_text_preview: String,
    /// Byte offset of match start in the content.
    pub start: usize,
    /// Byte offset of match end in the content.
    pub end: usize,
    /// 1-based line number where match starts.
    pub line_number: usize,
    /// Severity level of this match.
    pub severity: Severity,
    /// Optional suggestion for safe alternative.
    pub suggestion: Option<String>,
}

/// Error during AST matching (all errors are non-fatal and returned to the evaluator).
#[derive(Debug, Clone)]
pub enum MatchError {
    /// Language not supported by ast-grep.
    UnsupportedLanguage(ScriptLanguage),
    /// Failed to parse content as the specified language.
    ParseError {
        language: ScriptLanguage,
        detail: String,
    },
    /// Pattern matching exceeded timeout.
    Timeout { elapsed_ms: u64, budget_ms: u64 },
    /// Pattern compilation failed (should not happen with static patterns).
    PatternError { pattern: String, detail: String },
    /// The matcher could not run at all: its worker thread could not be
    /// started (thread or memory limits on a loaded host) or exited without
    /// reporting. Like [`Self::Timeout`] this says nothing about the code, only
    /// about the machine, so it is never evidence that the code is clean.
    Unavailable {
        language: ScriptLanguage,
        detail: String,
    },
}

impl MatchError {
    /// Whether the failure is a property of the host (time, threads) rather
    /// than of the code. A transient failure leaves the code unanalysed, so a
    /// caller must retry it or treat the analysis as incomplete; it can never
    /// stand for "no match".
    #[must_use]
    pub const fn is_transient(&self) -> bool {
        matches!(self, Self::Timeout { .. } | Self::Unavailable { .. })
    }
}

impl std::fmt::Display for MatchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnsupportedLanguage(lang) => {
                write!(f, "unsupported language for AST matching: {lang:?}")
            }
            Self::ParseError { language, detail } => {
                write!(f, "AST parse error for {language:?}: {detail}")
            }
            Self::Timeout {
                elapsed_ms,
                budget_ms,
            } => {
                write!(
                    f,
                    "AST matching timeout: {elapsed_ms}ms > {budget_ms}ms budget"
                )
            }
            Self::PatternError { pattern, detail } => {
                write!(f, "pattern compilation error for '{pattern}': {detail}")
            }
            Self::Unavailable { language, detail } => {
                write!(f, "AST matching unavailable for {language:?}: {detail}")
            }
        }
    }
}

/// A compiled AST pattern with metadata.
#[derive(Debug, Clone)]
pub struct CompiledPattern {
    /// The pattern string (for debugging/logging).
    pub pattern_str: String,
    /// Node kind that carves the real pattern out of `pattern_str`.
    ///
    /// `None` means `pattern_str` is itself a parseable fragment of the target
    /// language, which is the common case: Python, JavaScript, Ruby and PHP all
    /// accept a bare expression at the top level of a file, so
    /// `shutil.rmtree($$$)` parses straight to a call node.
    ///
    /// Go does not. Its grammar has no top-level expression statement, so
    /// `os.RemoveAll($$$)` parses to an ERROR node wrapping a `qualified_type`
    /// and some loose tokens — a tree that cannot equal a real
    /// `call_expression`, so the pattern matches nothing, anywhere, ever.
    /// `Pattern::try_new` still returns `Ok` for it and
    /// [`Pattern::has_error`](ast_grep_core::Pattern::has_error) still returns
    /// `false`, so neither the compile step nor a compile-only test can see the
    /// problem (#465).
    ///
    /// Such a language states its pattern inside the smallest enclosing
    /// construct that parses (`func f() { … }`) and names the node to extract.
    pub selector: Option<String>,
    /// Stable rule ID.
    pub rule_id: String,
    /// Human-readable reason.
    pub reason: String,
    /// Match severity.
    pub severity: Severity,
    /// Optional safe alternative suggestion.
    pub suggestion: Option<String>,
}

impl CompiledPattern {
    /// Create a new compiled pattern from a self-contained pattern fragment.
    #[must_use]

```

### Core Architecture Module: `src/history/queue_budget.rs`
```
//! Nonblocking admission accounting for history messages.
//!
//! Reservations follow the payload through the mailbox, batching and storage.
//! Releasing a reservation on receipt would bound only the channel while a
//! stalled batch could still retain payloads outside that bound. Flush requests
//! use a separate budget so entry saturation cannot prevent a completion barrier.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ReserveError {
    Full,
    Oversized,
}

#[derive(Debug)]
pub(super) struct QueueBudget {
    max_entries: usize,
    max_bytes: usize,
    entries: AtomicUsize,
    bytes: AtomicUsize,
}

impl QueueBudget {
    pub(super) const fn new(max_entries: usize, max_bytes: usize) -> Self {
        Self {
            max_entries,
            max_bytes,
            entries: AtomicUsize::new(0),
            bytes: AtomicUsize::new(0),
        }
    }

    /// Reserve capacity without waiting for the worker or storage.
    /// Concurrent attempts may conservatively reject while another reservation
    /// is being released, but can never exceed either bound.
    pub(super) fn try_reserve(self: &Arc<Self>, bytes: usize) -> Result<Reservation, ReserveError> {
        if bytes > self.max_bytes {
            return Err(ReserveError::Oversized);
        }
        // These counters protect capacity, not publication of payload data.
        // The channel publishes the payload; Relaxed ordering is sufficient
        // for atomic accounting and avoids a global ordering requirement.
        reserve_counter(&self.entries, 1, self.max_entries)?;
        if reserve_counter(&self.bytes, bytes, self.max_bytes).is_err() {
            self.entries.fetch_sub(1, Ordering::Relaxed);
            return Err(ReserveError::Full);
        }
        Ok(Reservation {
            budget: Arc::clone(self),
            bytes,
        })
    }

    #[cfg(test)]
    pub(super) fn usage(&self) -> (usize, usize) {
        (
            self.entries.load(Ordering::Relaxed),
            self.bytes.load(Ordering::Relaxed),
        )
    }
}

/// Checked atomic addition without the deprecated `fetch_update` API.
/// Recompute against the observed value after a failed or spurious CAS; a
/// competing reservation must never make a stale capacity check succeed.
fn reserve_counter(counter: &AtomicUsize, amount: usize, limit: usize) -> Result<(), ReserveError> {
    let mut used = counter.load(Ordering::Relaxed);
    loop {
        let next = used
            .checked_add(amount)
            .filter(|next| *next <= limit)
            .ok_or(ReserveError::Full)?;
        match counter.compare_exchange_weak(used, next, Ordering::Relaxed, Ordering::Relaxed) {
            Ok(_) => return Ok(()),
            Err(observed) => used = observed,
        }
    }
}

/// Not Clone: one payload owns one reservation until it is actually discarded.
#[derive(Debug)]
pub(super) struct Reservation {
    budget: Arc<QueueBudget>,
    bytes: usize,
}

impl Drop for Reservation {
    fn drop(&mut self) {
        self.budget.bytes.fetch_sub(self.bytes, Ordering::Relaxed);
        self.budget.entries.fetch_sub(1, Ordering::Relaxed);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::HistoryRedactionMode;
    use crate::history::{
        CommandEntry, HistoryDb, HistoryEnqueueOutcome, HistoryMessage, HistoryWriter,
        PendingHistoryBatch, SqliteValue, WorkerConfig, history_worker,
    };
    use std::sync::mpsc;
    use std::time::Duration;

    #[test]
    fn counter_reservation_checks_exact_limit_and_overflow_without_mutation() {
        let counter = AtomicUsize::new(usize::MAX - 1);
        assert_eq!(reserve_counter(&counter, 1, usize::MAX), Ok(()));
        assert_eq!(counter.load(Ordering::Relaxed), usize::MAX);
        assert_eq!(
            reserve_counter(&counter, 1, usize::MAX),
            Err(ReserveError::Full)
        );
        assert_eq!(counter.load(Ordering::Relaxed), usize::MAX);
        assert_eq!(reserve_counter(&counter, 0, usize::MAX), Ok(()));
        assert_eq!(
            reserve_counter(&counter, 0, usize::MAX - 1),
            Err(ReserveError::Full)
        );
        assert_eq!(counter.load(Ordering::Relaxed), usize::MAX);
    }

    #[test]
    fn entry_and_byte_limits_are_independent_and_reusable() {
        let budget = Arc::new(QueueBudget::new(2, 10));
        let first = budget.try_reserve(6).unwrap();
        assert_eq!(budget.try_reserve(5).unwrap_err(), ReserveError::Full);
        assert_eq!(
            budget.usage(),
            (1, 6),
            "failed byte admission must release its slot"
        );
        let second = budget.try_reserve(4).unwrap();
        assert_eq!(budget.usage(), (2, 10));
        assert_eq!(budget.try_reserve(0).unwrap_err(), ReserveError::Full);
        drop(first);
        assert_eq!(budget.usage(), (1, 4));
        let replacement = budget.try_reserve(6).unwrap();
        drop((second, replacement));
        assert_eq!(budget.usage(), (0, 0));
    }

    #[test]
    fn oversized_and_overflowing_reservations_do_not_change_usage() {
        let budget = Arc::new(QueueBudget::new(2, 10));
        assert_eq!(budget.try_reserve(11).unwrap_err(), ReserveError::Oversized);
        assert_eq!(budget.usage(), (0, 0));
        let enormous = Arc::new(QueueBudget::new(2, usize::MAX));
        let first = enormous.try_reserve(usize::MAX).unwrap();
        assert_eq!(enormous.try_reserve(1).unwrap_err(), ReserveError::Full);
        assert_eq!(enormous.usage(), (1, usize::MAX));
        drop(first);
        assert_eq!(enormous.usage(), (0, 0));
    }

    #[test]
    fn zero_entry_budget_rejects_without_waiting_for_a_receiver() {
        let budget = Arc::new(QueueBudget::new(0, 10));
        assert_eq!(budget.try_reserve(1).unwrap_err(), ReserveError::Full);
        assert_eq!(budget.usage(), (0, 0));
    }

    #[test]
    fn concurrent_admission_never_exceeds_capacity() {
        use std::sync::Barrier;

        let budget = Arc::new(QueueBudget::new(8, 32));
        let release = Arc::new(Barrier::new(17));
        let (sent, received) = mpsc::channel();
        let observed = std::thread::scope(|scope| {
            for _ in 0..16 {
                let budget = Arc::clone(&budget);
                let release = Arc::clone(&release);
                let sent = sent.clone();
                scope.spawn(move || {
                    let reservation = budget.try_reserve(4);
                    sent.send(reservation.is_ok()).unwrap();
                    // Hold every successful reservation until the observer
                    // checks the exact total. No scheduling deadline is used.
                    release.wait();
                    drop(reservation);
                });
            }
            drop(sent);
            let accepted = received
                .iter()
                .take(16)
                .filter(|accepted| *accepted)
                .count();
            let usage = budget.usage();
            // Release before asserting so a failing assertion cannot strand
            // scoped workers behind the barrier during panic unwinding.
            release.wait();
            (accepted, usage)
        });
        assert_eq!(observed, (8, (8, 32)));
        assert_eq!(budget.usage(), (0, 0));
    }

    /// No worker is started: queue saturation is deterministic rather than a
    /// race against the scheduler. Tests explicitly deliver or discard messages.
    fn unstarted_writer(
        entries: usize,
        bytes: usize,
        flushes: usize,
    ) -> (HistoryWriter, mpsc::Receiver<HistoryMessage>) {
        let (sender, receiver) = mpsc::channel();
        let writer = HistoryWriter {
            sender: Some(sender),
            handle: None,
            entry_budget: Some(Arc::new(QueueBudget::new(entries, bytes))),
            flush_budget: Some(Arc::new(QueueBudget::new(flushes, flushes))),
            redaction_mode: HistoryRedactionMode::None,
            session_id: "admission-test".to_string(),
            wait_for_worker_on_drop: false,
            drop_wait_deadline: None,
        };
        (writer, receiver)
    }

    #[test]
    fn dequeued_entries_keep_capacity_until_storage_finishes() {
        let (writer, receiver) = unstarted_writer(1, 4096, 2);
        let budget = Arc::clone(writer.entry_budget.as_ref().unwrap());
        assert_eq!(
            writer.try_log(CommandEntry::default()),
            HistoryEnqueueOutcome::Queued
        );
        let HistoryMessage::Entry(entry) = receiver.try_recv().unwrap() else {
            panic!("expected queued entry");
        };
        let mut batch = PendingHistoryBatch::new(4);
        batch.push(entry);
        assert_eq!(budget.usage().0, 1, "dequeue is not completion");
        assert_eq!(
            writer.try_log(CommandEntry::default()),
            HistoryEnqueueOutcome::QueueFull
        );
        let mut db = HistoryDb::open_in_memory().unwrap();
        let mut disabled = false;
        batch.flush(
            &mut db,
            None,
            &mut disabled,
            WorkerConfig::default().max_size_bytes,
        );
        assert!(!disabled);
        assert_eq!(db.count_commands().unwrap(), 1);
        assert_eq!(budget.usage(), (0, 0));
        assert_eq!(
            writer.try_log(CommandEntry::default()),
            HistoryEnqueueOutcome::Queued
        );
        drop(receiver);
        assert_eq!(
            budget.usage(),
            (0, 0),
            "receiver failure must release queued payloads"
        );
    }

    fn stage_commands(
        writer: &HistoryWriter,
        receiver: &mpsc::Receiver<HistoryMessage>,
        batch: &mut PendingHistoryBatch,
        commands: &[&str],
    ) {
        for command in commands {
            assert_eq!(
                writer.try_log(CommandEntry {
                    command: (*command).to_string(),
        
```

### Core Architecture Module: `src/hook.rs`
```
//! Hook protocol handling.
//!
//! This module handles JSON input/output for supported hook protocols
//! (Claude Code, Codex CLI, Copilot, VS Code Copilot Chat, Gemini, and Hermes
//! Agent). It parses incoming hook requests and formats denial responses.

use crate::evaluator::MatchSpan;
use crate::exit_codes::EXIT_HOOK_BLOCK;
use crate::highlight::HighlightSpan;
use crate::normalize::ShellDialect;
use crate::output::auto_theme;
use crate::output::denial::DenialBox;
use crate::output::theme::Severity as ThemeSeverity;
use crate::packs::PatternSuggestion;
use colored::Colorize;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::io::{self, IsTerminal, Read, Write};
use std::time::Duration;

/// Input structure from supported hook protocols.
///
/// Every envelope field is shape-tolerant: a value of an unexpected JSON type
/// degrades that one field instead of failing the whole parse, because a
/// failed parse fails open and allows the command unexamined. Strings are
/// read through [`deserialize_string_tolerant`], and open-ended fields are
/// kept as raw [`serde_json::Value`]s.
#[derive(Debug, Deserialize)]
pub struct HookInput {
    /// Hook event name (used by some clients, e.g. Copilot CLI: "pre-tool-use").
    #[serde(default, deserialize_with = "deserialize_string_tolerant")]
    pub event: Option<String>,

    /// Gemini hook event name (e.g., "BeforeTool").
    #[serde(
        alias = "hookEventName",
        default,
        deserialize_with = "deserialize_string_tolerant"
    )]
    pub hook_event_name: Option<String>,

    /// Cursor's native Claude-compatible envelope identifies its host with
    /// this marker. Populated best-effort by [`parse_hook_input`], outside the
    /// primary parser, so duplicate or malformed metadata cannot reject a
    /// command that was previously readable.
    #[serde(skip)]
    pub cursor_version: Option<String>,

    /// Session id (Gemini snake_case; VS Code Agent Host camelCase).
    #[serde(
        alias = "sessionId",
        default,
        deserialize_with = "deserialize_string_tolerant"
    )]
    pub session_id: Option<String>,

    /// Gemini transcript path.
    #[serde(default, deserialize_with = "deserialize_string_tolerant")]
    pub transcript_path: Option<String>,

    /// Gemini working directory.
    #[serde(default, deserialize_with = "deserialize_string_tolerant")]
    pub cwd: Option<String>,

    /// Event timestamp: an RFC 3339 string from Gemini, a number (epoch
    /// milliseconds) from GitHub Copilot CLI. Raw JSON value, like
    /// `tool_use_id`: typed as a string, every native Copilot payload failed
    /// the whole parse and so failed open, allowing the command unexamined.
    pub timestamp: Option<serde_json::Value>,

    /// The name of the tool being invoked (e.g., "Bash", "runTerminalCommand").
    #[serde(
        alias = "toolName",
        default,
        deserialize_with = "deserialize_string_tolerant"
    )]
    pub tool_name: Option<String>,

    /// Tool-specific input parameters.
    #[serde(
        alias = "toolInput",
        default,
        deserialize_with = "deserialize_tool_input_tolerant"
    )]
    pub tool_input: Option<ToolInput>,

    /// Alternate tool arguments format used by some clients.
    /// May be a JSON string (e.g. "{\"command\":\"...\"}") or an object.
    #[serde(alias = "toolArgs")]
    pub tool_args: Option<serde_json::Value>,

    /// Codex CLI active-turn identifier. Documented in
    /// `codex-rs/hooks/src/schema.rs` as "Codex extension: expose the active
    /// turn id to internal turn-scoped hooks" -- i.e. Codex's intentional
    /// divergence from Claude's public hook docs. Claude Code does NOT send
    /// this field (Claude does send `tool_use_id`, so that field can't be
    /// used to disambiguate the two otherwise-similar wire formats). When
    /// `turn_id` is present and non-blank we switch to Codex's minimal
    /// `hookSpecificOutput` deny payload because Codex's parser can reject the
    /// dcg-only fields carried by the extended Claude-compatible response.
    #[serde(
        alias = "turnId",
        default,
        deserialize_with = "deserialize_string_tolerant"
    )]
    pub turn_id: Option<String>,

    /// Tool-use identifier. Claude Code's are Anthropic tool-use ids
    /// (`toolu_…`); Codex's are OpenAI call ids (`call_…`). Kept as a raw JSON
    /// value so an unexpected type degrades to "unknown" instead of failing
    /// the whole payload parse (a parse failure fails open). No camelCase
    /// alias: Grok sends both spellings, and serde would reject the pair.
    pub tool_use_id: Option<serde_json::Value>,

    /// Claude-shaped permission mode (`default`, `acceptEdits`,
    /// `bypassPermissions`, `dontAsk`, …). Raw JSON value for the same
    /// parse-robustness reason as `tool_use_id`; no camelCase alias (Grok).
    pub permission_mode: Option<serde_json::Value>,

    /// Antigravity CLI (`agy`) tool-call envelope. Unlike Claude/Gemini/Grok,
    /// `agy` nests the tool name and arguments under a `toolCall` object:
    /// `{"toolCall": {"name": "run_command", "args": {"CommandLine": "...",
    /// "Cwd": "..."}}, "conversationId": "...", "stepIdx": 4, ...}`. The shell
    /// command lives in `toolCall.args.CommandLine`. Verified empirically by
    /// capturing the stdin `agy` passes to a `PreToolUse` hook.
    #[serde(
        alias = "toolCall",
        default,
        deserialize_with = "deserialize_tool_call_tolerant"
    )]
    pub tool_call: Option<ToolCall>,

    /// VS Code "Agent Host" batched tool-call envelope (issue #252). The
    /// newer Copilot Agent Host (and the Agents window built on it) sends
    /// `{"sessionId": "...", "cwd": "...", "toolCalls": [{"name":
    /// "powershell", "args": "{\"command\":\"...\"}"}]}` — an *array* under
    /// plural `toolCalls`, with each entry's `args` JSON-encoded as a string.
    /// Before this field existed the envelope deserialized without any
    /// recognized command and the hook silently failed open.
    ///
    /// The field is deliberately shape-tolerant: a `toolCalls` value that is
    /// not an array (or an entry that does not fit [`ToolCall`]) must degrade
    /// to `None` (or be skipped) instead of aborting the whole [`HookInput`]
    /// parse. A whole-payload parse failure fails open, which would let a
    /// malformed `toolCalls` mask a perfectly good `tool_input` command
    /// elsewhere in the same payload.
    #[serde(
        alias = "toolCalls",
        alias = "toolcalls",
        default,
        deserialize_with = "deserialize_tool_calls_tolerant"
    )]
    pub tool_calls: Option<Vec<ToolCall>>,

    /// Sent only by dcg's own generated OpenCode plugin: `true` asks for an
    /// explicit allow line ([`EXPLICIT_ALLOW_VERDICT`]) instead of the
    /// protocol's silent allow.
    ///
    /// With silence meaning allow, a caller cannot tell an allowed command
    /// from a dcg that died before answering. The plugin sets this so that an
    /// empty stdout means "no verdict" and blocks. No host sends the field, so
    /// every hook protocol keeps its own allow encoding. Raw JSON value for
    /// the same parse-robustness reason as `permission_mode`.
    pub dcg_explicit_verdict: Option<serde_json::Value>,

    /// Command strings displaced by a *conflicting* snake_case/camelCase alias
    /// pair in the raw envelope (issue #410).
    ///
    /// Never deserialized from the wire — [`parse_hook_input`] populates it
    /// after canonicalizing duplicate alias spellings. When a host sends both
    /// `tool_input` and `toolInput` (or the `tool_args` / `toolCall` /
    /// `toolCalls` equivalents) with *different* values, one spelling has to
    /// win the typed field, and picking either one silently discards a command
    /// that the host might be the one about to run. Every discarded command is
    /// recorded here and evaluated as an additional entry, so a destructive
    /// spelling cannot hide behind a benign sibling.
    #[serde(skip)]
    pub alias_conflict_commands: Vec<String>,
}

/// Tool-specific input containing the command to execute.
#[derive(Debug, Deserialize)]
pub struct ToolInput {
    /// The command string (for Bash tools).
    pub command: Option<serde_json::Value>,
}

/// Antigravity CLI (`agy`) tool-call envelope.
///
/// `agy` emits `{"name": "run_command", "args": {"CommandLine": "...",
/// "Cwd": "...", "WaitMsBeforeAsync": 500}}`. The shell command is in
/// `args.CommandLine`.
#[derive(Debug, Deserialize)]
pub struct ToolCall {
    /// The tool name (e.g. `"run_command"` for the shell tool).
    #[serde(default, deserialize_with = "deserialize_string_tolerant")]
    pub name: Option<String>,

    /// Tool arguments. For `run_command`, this carries `CommandLine`.
    pub args: Option<serde_json::Value>,
}

/// Deserialize the plural `toolCalls` field without ever failing the parse.
///
/// A typed `Option<Vec<ToolCall>>` aborts the entire [`HookInput`]
/// deserialization when the field arrives in an unexpected shape (for example
/// an object keyed by index), and an aborted parse fails open — silently
/// allowing a destructive command carried by `tool_input` in the same payload.
/// This deserializer therefore accepts:
/// - absent / `null` → `None`;
/// - a JSON array → each entry parsed individually as [`ToolCall`], with
///   entries that do not fit silently skipped (the ones that do fit are kept);
/// - any non-array shape → `None`, so the rest of the payload still parses and
///   the `tool_input` / `toolCall` extraction paths keep working.
fn deserialize_tool_calls_tolerant<'de, D>(
    deserializer: D,
) -> Result<Option<Vec<ToolCall>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let Some(value) = Option::<serde_json::Value>::deserialize(deserializer)? else {
        return Ok(None);
    };
    let serde_json::Value::Array(entries) = value else {
        return Ok(None);
    };
    Ok(Some
```

### Core Architecture Module: `src/packs/cdn/cloudflare_workers.rs`
```
//! Cloudflare Workers pack - protections for destructive Wrangler CLI operations.
//!
//! Covers destructive operations:
//! - Worker deletion (`wrangler delete`)
//! - Deployment rollback (`wrangler deployments rollback`)
//! - KV operations (namespace/key/bulk delete)
//! - R2 operations (bucket/object delete)
//! - D1 database deletion

use crate::normalize::{
    NormalizeTokenKind, ShellDialect, ShellTokenDecoder, ShellTokenRole, strip_wrapper_prefixes,
    tokenize_for_shell_dialect,
};
use crate::packs::{DestructivePattern, Pack, SafePattern};
use crate::{destructive_pattern, safe_pattern};

const MAX_WRANGLER_SEMANTIC_BYTES: usize = 64 * 1024;
const MAX_WRANGLER_SEMANTIC_TOKENS: usize = 128;
const MAX_WRANGLER_SEMANTIC_SEGMENTS: usize = 64;

pub(crate) const WRANGLER_UNVERIFIED_RULE: &str = "wrangler-semantic-unverified";
pub(crate) const WRANGLER_UNVERIFIED_REASON: &str =
    "Wrangler syntax depends on shell expansion or exceeds dcg's bounded semantic analysis.";

/// Semantic result for a Wrangler command.
///
/// The generic pack/evaluator paths map `Destructive(rule)` back to the
/// existing named regex rule so its reason, severity, and allowlist identity
/// remain authoritative. `Safe` covers only explicitly known read-only or
/// informational commands; unrecognized syntax falls back to the existing
/// regex layer through `NoMatch`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum WranglerSemanticDecision {
    NoMatch,
    Safe,
    Destructive(&'static str),
    /// Wrangler is established, but bounded semantic inspection cannot prove
    /// which operation will execute. Callers must handle this fail-closed.
    Unverified,
}

/// A shell program supplied to npm's `exec`/`npx` `-c|--call` option.
///
/// npm executes this value through a shell rather than treating it as package
/// argv.  The pack cannot safely reinterpret that shell grammar itself, so the
/// evaluator must recurse into a proven `Payload` as POSIX shell syntax.  A
/// dynamic or structurally incomplete option is deliberately fail-closed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum WranglerRunnerShellDecision {
    NoMatch,
    Payload(String),
    Unverified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WranglerCursorStop {
    Dynamic,
    Terminated,
    Invalid,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
struct WranglerTerminalFlags {
    help: Option<bool>,
    version: Option<bool>,
    dry_run: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WranglerOptionArity {
    Flag,
    Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WranglerOptionScope {
    Global,
    Kv,
    R2,
}

#[derive(Debug, Clone)]
struct WranglerWord {
    decoded: String,
    dynamic: bool,
}

impl WranglerWord {
    fn may_equal(&self, candidate: &str, dialect: ShellDialect) -> bool {
        symbolic_word_may_equal(&self.decoded, self.dynamic, dialect, candidate, false)
    }
}

struct WranglerWordCursor<'a> {
    words: &'a [WranglerWord],
    index: usize,
    terminal_flags: WranglerTerminalFlags,
}

impl<'a> WranglerWordCursor<'a> {
    fn new(words: &'a [WranglerWord], index: usize) -> Self {
        Self {
            words,
            index,
            terminal_flags: WranglerTerminalFlags::default(),
        }
    }

    fn next(
        &mut self,
        scope: WranglerOptionScope,
    ) -> Result<Option<&'a WranglerWord>, WranglerCursorStop> {
        while let Some(word) = self.words.get(self.index) {
            self.index += 1;
            let text = word.decoded.as_str();
            if text == "--" {
                return Err(WranglerCursorStop::Terminated);
            }
            if update_terminal_flags(text, &mut self.terminal_flags) {
                continue;
            }
            if let Some(arity) = wrangler_option_arity(text, scope) {
                if arity == WranglerOptionArity::Value {
                    let Some(value) = self.words.get(self.index) else {
                        return Err(WranglerCursorStop::Invalid);
                    };
                    if value.decoded == "--" {
                        return Err(WranglerCursorStop::Invalid);
                    }
                    self.index += 1;
                }
                continue;
            }
            if word.dynamic {
                return Err(WranglerCursorStop::Dynamic);
            }
            if text.starts_with('-') {
                return Err(WranglerCursorStop::Invalid);
            }
            return Ok(Some(word));
        }
        Ok(None)
    }
}

fn wrangler_option_arity(word: &str, scope: WranglerOptionScope) -> Option<WranglerOptionArity> {
    if matches!(
        word,
        "--install-skills" | "--no-install-skills" | "--verbose"
    ) || ["--install-skills=", "--verbose="]
        .iter()
        .any(|prefix| word.starts_with(prefix) && word.len() > prefix.len())
    {
        return Some(WranglerOptionArity::Flag);
    }
    if matches!(
        word,
        "-c" | "--config" | "--cwd" | "-e" | "--env" | "--env-file" | "--profile"
    ) {
        return Some(WranglerOptionArity::Value);
    }
    if ["--config=", "--cwd=", "--env=", "--env-file=", "--profile="]
        .iter()
        .any(|prefix| word.starts_with(prefix) && word.len() > prefix.len())
        || word.starts_with('-')
            && word.len() > 2
            && matches!(word.as_bytes().get(1), Some(b'c' | b'e'))
    {
        return Some(WranglerOptionArity::Flag);
    }

    if matches!(scope, WranglerOptionScope::Kv | WranglerOptionScope::R2) {
        if matches!(word, "--local" | "--remote")
            || ["--local=", "--remote="]
                .iter()
                .any(|prefix| word.starts_with(prefix) && word.len() > prefix.len())
        {
            return Some(WranglerOptionArity::Flag);
        }
        if word == "--persist-to" {
            return Some(WranglerOptionArity::Value);
        }
        if word.starts_with("--persist-to=") && word.len() > "--persist-to=".len() {
            return Some(WranglerOptionArity::Flag);
        }
    }

    if scope == WranglerOptionScope::Kv {
        if matches!(
            word,
            "--preview" | "-f" | "--force" | "-y" | "--skip-confirmation"
        ) || word.starts_with("--preview=") && word.len() > "--preview=".len()
        {
            return Some(WranglerOptionArity::Flag);
        }
        if matches!(word, "--namespace-id" | "--binding") {
            return Some(WranglerOptionArity::Value);
        }
        if ["--namespace-id=", "--binding="]
            .iter()
            .any(|prefix| word.starts_with(prefix) && word.len() > prefix.len())
        {
            return Some(WranglerOptionArity::Flag);
        }
    }

    if scope == WranglerOptionScope::R2 {
        if matches!(word, "-y" | "--force") {
            return Some(WranglerOptionArity::Flag);
        }
        if matches!(word, "-J" | "--jurisdiction") {
            return Some(WranglerOptionArity::Value);
        }
        if word.starts_with("--jurisdiction=") && word.len() > "--jurisdiction=".len()
            || word.starts_with("-J") && word.len() > 2
        {
            return Some(WranglerOptionArity::Flag);
        }
    }

    None
}

fn update_terminal_flags(word: &str, flags: &mut WranglerTerminalFlags) -> bool {
    match word {
        "-h" | "--help" | "--help=true" => flags.help = Some(true),
        "--no-help" | "--help=false" => flags.help = Some(false),
        "-v" | "--version" | "--version=true" => flags.version = Some(true),
        "--no-version" | "--version=false" => flags.version = Some(false),
        "--dry-run" | "--dry-run=true" => flags.dry_run = Some(true),
        "--no-dry-run" | "--dry-run=false" => flags.dry_run = Some(false),
        _ => return false,
    }
    true
}

fn executable_basename(word: &str) -> &str {
    let basename = word.rsplit(['/', '\\']).next().unwrap_or(word);
    [".exe", ".cmd", ".bat", ".com"]
        .iter()
        .find_map(|suffix| {
            basename.len().checked_sub(suffix.len()).and_then(|start| {
                basename
                    .get(start..)
                    .filter(|actual| actual.eq_ignore_ascii_case(suffix))
                    .and_then(|_| basename.get(..start))
            })
        })
        .unwrap_or(basename)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WranglerExecutableDecision {
    NoMatch,
    Found(usize),
    Unverified,
}

fn command_word_index(words: &[WranglerWord], dialect: ShellDialect) -> usize {
    let mut index = 0usize;
    if matches!(dialect, ShellDialect::Posix | ShellDialect::Unknown) {
        while words
            .get(index)
            .is_some_and(|word| crate::normalize::is_env_assignment(&word.decoded))
        {
            index += 1;
        }
    }

    if dialect == ShellDialect::Cmd {
        while let Some(word) = words.get(index) {
            let text = word.decoded.trim_start_matches('@');
            if text.is_empty() || text.eq_ignore_ascii_case("call") {
                index += 1;
                continue;
            }
            break;
        }
    }
    index
}

fn runner_shell_payload_from_options(
    words: &[WranglerWord],
    mut index: usize,
) -> WranglerRunnerShellDecision {
    let mut payload = None;
    while let Some(word) = words.get(index) {
        let text = word.decoded.as_str();
        if word.dynamic {
            // Expansion in the option region may become `-c`, `--call`, `--`,
            // or a positional package name and therefore changes argv roles.
            return WranglerRunnerShellDecision::Unverified;
        }
        if text == "--" {
            break;
        }
        if matches!(text, "-c" | "--call") {
            let Some(value) = words.get(index + 1) else {
                return WranglerRunnerShellDecision::Unverified;
            };
            if value.dynamic {
                return WranglerRunnerShel
```

### Core Architecture Module: `src/packs/core/credential_files.rs`
```
//! The credential-write policy, shared by shell sinks and embedded code.
//!
//! Keep the shell parser and protected-path table in one place. Embedded APIs
//! contribute a statically identified destination and effective write mode;
//! they do not introduce a second path policy or a separate allowlist rule.

mod embedded;
mod shell;
mod word_splitting;

pub(crate) use embedded::{scan_extracted, source_scan_required};
// Rule NAMES are deliberately not re-exported: every hit carries the
// rule it denies under, so the evaluator reads `hit.rule` instead of choosing
// one. That is what keeps `.git/` writes allowlistable separately from
// credential writes (#457); a caller reaching for a name here would be
// guessing at something the classifier already decided.
pub(crate) use shell::{
    CREDENTIAL_FILE_WRITE_SUGGESTIONS, CredentialFileWrite, GIT_INTERNALS_WRITE_SUGGESTIONS,
    classify_credential_file_write, classify_git_redirect_writes, names_protected_file,
    names_protected_git_internal, names_windows_shell_writer,
};

use crate::normalize::ShellDialect;

pub(crate) fn is_credential_writer(executable: &str) -> bool {
    shell::is_credential_writer(executable) || embedded::is_interpreter(executable)
}

/// Include IFS-dependent argv in pack selection even when a dynamic target
/// has no literal protected-path anchor. The classifier, not this candidate
/// gate, determines whether the command writes a protected destination.
pub(crate) fn may_name_protected_path(command: &str) -> bool {
    shell::may_name_protected_path(command) || word_splitting::candidate(command)
}

/// IFS assignments and expansions belong to the outer shell, not to a quoted
/// Python/Node program supplied on stdin (#560). Reuse the existing ownership
/// proof instead of letting source text establish shell state or exhaust the
/// shell event budget. It rejects unquoted bodies and ambiguous receivers.
///
/// The view preserves every byte offset and newline, including command bytes
/// before and after each body. This is NOT an interpreter-source exemption:
/// `embedded::scan_command` below must always receive the original command.
/// Do not apply a POSIX-only proof when the caller's dialect is unknown.
fn scan_outer_writer_arguments(command: &str, dialect: ShellDialect) -> Vec<CredentialFileWrite> {
    if dialect != ShellDialect::Posix || !word_splitting::candidate(command) {
        return word_splitting::scan(command, dialect);
    }
    let outer = crate::heredoc::mask_inert_interpreter_stdin(command);
    word_splitting::scan(outer.as_ref(), dialect)
}

/// Inspect executable source before shell segmentation or masking removes it.
/// Shell syntax uses the separate [`classify_credential_file_write`] above;
/// inline scripts, heredocs, and here-strings use their proven interpreter.
/// The IFS view retains preceding assignments until each writer's arguments
/// have been split, then delegates every destination to the same path policy.
/// Apply explicit language/content exemptions to each decoded program, not
/// to another program or shell writer in the same command.
/// Retain all rule families, including coincident spans from a single rename.
/// The evaluator, not the classifier, decides whether a rule is allowlisted.
pub(crate) fn classify_embedded_credential_file_writes(
    command: &str,
    dialect: ShellDialect,
    source_is_exempt: impl FnMut(&str, crate::heredoc::ScriptLanguage) -> bool,
) -> Vec<CredentialFileWrite> {
    let mut hits = scan_outer_writer_arguments(command, dialect);
    hits.extend(embedded::scan_command(command, dialect, source_is_exempt));
    hits
}

#[cfg(test)]
mod source_ownership_tests {
    use super::{
        classify_embedded_credential_file_writes, scan_extracted, scan_outer_writer_arguments, shell,
        word_splitting,
    };
    use crate::heredoc::{ExtractionLimits, ExtractionResult, extract_content};
    use crate::normalize::ShellDialect;

    #[test]
    fn executable_perl_heredocs_must_not_be_exempted_as_literal_print_data() {
        for source in [
            "eval <<'CODE';\nopen(FH, '>', '/etc/shadow');\nCODE",
            "print eval <<'CODE';\nopen(FH, '>', '/etc/shadow');\nCODE",
            "$program = <<'CODE';\nopen(FH, '>', '/etc/shadow');\nCODE\neval $program;",
            "print <<\"CODE\";\n${\\ do { open(FH, '>', '/etc/shadow'); '' }}\nCODE",
        ] {
            let command = format!("perl <<'PERL'\n{source}\nPERL");
            let ExtractionResult::Extracted(contents) =
                extract_content(&command, &ExtractionLimits::structural_scan())
            else {
                panic!("executable source must remain extractable: {command}");
            };
            let code = contents
                .iter()
                .find(|content| content.delimiter.as_deref() == Some("CODE"))
                .unwrap_or_else(|| panic!("executable heredoc was suppressed: {command}"));
            assert!(
                !scan_extracted(&code.content, code.language)
                    .expect("bounded Perl source")
                    .is_empty(),
                "the protected write must remain visible: {command}"
            );
        }
    }

    fn data_program(interpreter: &str, tail: &str) -> String {
        let body = match interpreter {
            "python3" => "note = \"IFS=@; it's `tool --help`; $DEST; élève\"\nprint(note)",
            "node" => "const note = \"IFS=@; it's `tool --help`; $DEST; élève\";\nconsole.log(note);",
            _ => panic!("unsupported test interpreter"),
        };
        format!("{interpreter} - <<'CODE'\n{body}\n{tail}\nCODE")
    }

    #[test]
    fn interpreter_data_does_not_establish_outer_ifs_state_560() {
        for interpreter in ["python3", "node"] {
            let command = data_program(interpreter, "");
            assert!(word_splitting::candidate(&command));
            let outer = crate::heredoc::mask_inert_interpreter_stdin(&command);
            assert_eq!(outer.len(), command.len());
            assert!(!word_splitting::candidate(outer.as_ref()));
            assert!(scan_outer_writer_arguments(&command, ShellDialect::Posix).is_empty());
            assert!(
                classify_embedded_credential_file_writes(&command, ShellDialect::Posix, |_, _| false)
                    .is_empty(),
                "literal interpreter data is not a protected write: {command}"
            );
        }
    }

    #[test]
    fn outer_ifs_writers_keep_original_spans_and_independent_rules_560() {
        let writer = "IFS=@; tee $UNRESOLVED";
        for interpreter in ["python3", "node"] {
            let program = data_program(interpreter, "");
            for command in [format!("{writer}\n{program}"), format!("{program}\n{writer}")] {
                let start = command.find("tee $UNRESOLVED").unwrap();
                let expected_span = start..start + "tee $UNRESOLVED".len();
                // Even an explicit interpreter exemption must not grant a
                // separate outer shell writer access to either policy family.
                let hits = classify_embedded_credential_file_writes(
                    &command,
                    ShellDialect::Posix,
                    |_, _| true,
                );
                for rule in [
                    shell::CREDENTIAL_FILE_WRITE_NAME,
                    shell::GIT_INTERNALS_WRITE_NAME,
                ] {
                    assert!(
                        hits.iter()
                            .any(|hit| hit.rule == rule && hit.span == expected_span),
                        "the outer writer lost its rule or original byte span: {command}: {hits:?}"
                    );
                }
            }
        }
    }

    #[test]
    fn outer_view_does_not_exempt_interpreter_protected_writes_560() {
        for (interpreter, tail, rule) in [
            (
                "python3",
                "open('/etc/shadow', 'w').write('x')",
                shell::CREDENTIAL_FILE_WRITE_NAME,
            ),
            (
                "python3",
                "open('.git/config', 'w').write('x')",
                shell::GIT_INTERNALS_WRITE_NAME,
            ),
            (
                "node",
                "require('fs').writeFileSync('/etc/shadow', 'x');",
                shell::CREDENTIAL_FILE_WRITE_NAME,
            ),
            (
                "node",
                "require('fs').writeFileSync('.git/config', 'x');",
                shell::GIT_INTERNALS_WRITE_NAME,
            ),
        ] {
            let command = data_program(interpreter, tail);
            let outer = crate::heredoc::mask_inert_interpreter_stdin(&command);
            assert!(!outer.contains(tail), "the test must exercise a masked body");
            let hits = classify_embedded_credential_file_writes(
                &command,
                ShellDialect::Posix,
                |_, _| false,
            );
            assert!(
                hits.iter()
                    .any(|hit| hit.rule == rule && command.get(hit.span.clone()).is_some()),
                "masking the outer view must not mask interpreter execution: {command}: {hits:?}"
            );
        }
    }

    #[test]
    fn unquoted_expansions_and_shell_receivers_keep_the_original_ifs_analysis_560() {
        for command in [
            "cat <<CODE\n$(IFS=@; tee $UNRESOLVED)\nCODE",
            "python3 - <<CODE\nprint('$(IFS=@; tee $UNRESOLVED)')\nCODE",
            "sh <<'CODE'\nIFS=@; tee $UNRESOLVED\nCODE",
            "python3 -c 'import os,sys; os.system(sys.stdin.read())' <<'CODE'\nIFS=@; tee $UNRESOLVED\nCODE",
        ] {
            let original = word_splitting::scan(command, ShellDialect::Posix);
            let outer = scan_outer_writer_arguments(command, ShellDialect::Posix);
            assert_eq!(
                outer, original,
                "unproved source must not gain a mask: {command}"
            );
        }
    }

    #[test]
    fn unknown_
```

### Core Architecture Module: `src/packs/core/credential_files/embedded.rs`
```
//! Structural recognition of embedded file-write APIs (#461, #466).
//! PHP uses its grammar; Perl uses a bounded, quote-aware fallback.
//!
//! Shell callers first establish that the source belongs to an interpreter.
//! The evaluator also calls `scan_extracted` directly on executable source:
//! its shell-segment view has already masked interpreter bodies. No script is
//! executed and no destination is read or opened.

use super::{CredentialFileWrite, shell};
use crate::heredoc::{
    ExtractionLimits, ExtractionResult, HeredocType, ScriptLanguage, extract_content,
};
use crate::normalize::{ShellDialect, strip_wrapper_prefixes};
use ast_grep_core::{AstGrep, Node, tree_sitter::StrDoc};
use ast_grep_language::SupportLang;
use std::collections::HashMap;
use std::ops::Range;

mod go;
mod perl;
mod php;
mod transfers;

type Syntax<'a> = Node<'a, StrDoc<SupportLang>>;

// Bound direct library calls as well as the hook. An exhausted source walk
// must report incomplete analysis, not a successful empty match set.
const MAX_BYTES: usize = 256 * 1024;
const MAX_DEPTH: usize = 128;
const MAX_NODES: usize = 40_000;
// A small source can repeatedly double a bound string. Bound folded values
// separately from input bytes so path construction cannot amplify it without
// limit. This is an analysis bound, not a query of the host filesystem.
const MAX_STATIC_PATH_BYTES: usize = 4096;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Language {
    Python,
    Ruby,
    Node,
    Php,
    Perl,
}

fn interpreter(executable: &str) -> Option<Language> {
    let name = executable.rsplit('/').next().unwrap_or(executable);
    let name = name.strip_suffix(".exe").unwrap_or(name);
    for (base, language) in [
        ("python", Language::Python),
        ("pypy", Language::Python),
        ("ruby", Language::Ruby),
        ("nodejs", Language::Node),
        ("node", Language::Node),
        ("php", Language::Php),
        ("perl", Language::Perl),
    ] {
        if name == base
            || name.strip_prefix(base).is_some_and(|suffix| {
                suffix.as_bytes().first().is_some_and(u8::is_ascii_digit)
                    && suffix.bytes().all(|b| b.is_ascii_digit() || b == b'.')
            })
        {
            return Some(language);
        }
    }
    None
}

pub(super) fn is_interpreter(executable: &str) -> bool {
    interpreter(executable).is_some()
}

/// A lexical superset of the API names that can establish a write binding.
/// Do not gate on a raw protected-path substring: constant concatenation and
/// language escapes can assemble that substring only after decoding.
pub(crate) fn source_scan_required(code: &str, language: ScriptLanguage) -> bool {
    matches!(
        language,
        ScriptLanguage::Python
            | ScriptLanguage::Ruby
            | ScriptLanguage::JavaScript
            | ScriptLanguage::TypeScript
            | ScriptLanguage::Php
            | ScriptLanguage::Perl
            | ScriptLanguage::Go
    ) && source_has_sink_name(code)
}

/// Shared by the shell and extracted-source gates. In particular, a rename
/// contains neither `open` nor `write`, but can replace either protected rule
/// family's files. Keep this a superset, not a raw destination-path check.
fn source_has_sink_name(code: &str) -> bool {
    [
        "open", "write", "Write", "append", "truncate", "File", "Path", "copy", "rename",
        "replace", "move", "link",
        // Node's `fs.cp`/`fs.cpSync`/`fs.promises.cp` spell a copy with no
        // substring any of the above catches (#484). Qualified, because the
        // analyser can only resolve the member form anyway, and a bare `cp`
        // would admit far more source for the classifier to walk.
        ".cp",
    ]
    .iter()
    .any(|word| code.contains(word))
        || php::has_sink_name(code)
        || go::has_sink_name(code)
}

/// Inspect already-extracted executable source, never shell tokens. Return
/// the first hit for EACH rule so allowing credentials cannot hide a later
/// `.git` write (or conversely). Spans are bytes in `code`.
pub(crate) fn scan_extracted(
    code: &str,
    language: ScriptLanguage,
) -> Result<Vec<CredentialFileWrite>, &'static str> {
    if !source_scan_required(code, language) {
        return Ok(Vec::new());
    }
    let (language, grammar) = match language {
        ScriptLanguage::Python => (Language::Python, SupportLang::Python),
        ScriptLanguage::Ruby => (Language::Ruby, SupportLang::Ruby),
        ScriptLanguage::JavaScript => (Language::Node, SupportLang::JavaScript),
        ScriptLanguage::TypeScript => (Language::Node, SupportLang::TypeScript),
        ScriptLanguage::Php => return php::scan(code),
        ScriptLanguage::Perl => return perl::scan(code),
        ScriptLanguage::Go => return go::scan(code),
        _ => return Ok(Vec::new()),
    };
    scan_source(code, language, grammar)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Access {
    Read,
    Append,
    Write,
}

/// Semantic effects of proven standard-library open constants, NOT native
/// numeric flag values. The latter differ between Linux, macOS and Windows;
/// interpreting the analyzed program with this host's libc would be unsound.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct OpenFlags(u8);

impl OpenFlags {
    const WRITE: u8 = 1;
    const CREATE: u8 = 2;
    const TRUNCATE: u8 = 4;
    const APPEND: u8 = 8;
    const UNKNOWN: u8 = 16;

    fn named(name: &str) -> Option<Self> {
        let effects = match name {
            "WRONLY" | "RDWR" => Self::WRITE,
            "CREAT" => Self::CREATE,
            "TRUNC" => Self::TRUNCATE,
            "APPEND" => Self::APPEND,
            "RDONLY" | "EXCL" | "NOFOLLOW" | "CLOEXEC" | "SYNC" | "DSYNC" | "RSYNC"
            | "NONBLOCK" | "NDELAY" | "NOCTTY" | "BINARY" | "TEXT" | "LARGEFILE" | "NOATIME"
            | "DIRECTORY" | "DIRECT" => 0,
            _ => return None,
        };
        Some(Self(effects))
    }

    fn prefixed(name: &str) -> Option<Self> {
        Self::named(name.strip_prefix("O_")?)
    }

    /// Keep creation/truncation effects until Ruby has ORed its `flags:`
    /// option into the mode. In particular, `w` plus APPEND still truncates.
    fn from_mode(mode: &str) -> Option<Self> {
        let access = mode_access(mode)?;
        let effects = match mode.as_bytes().first()? {
            b'w' => Self::WRITE | Self::CREATE | Self::TRUNCATE,
            b'x' => Self::WRITE | Self::CREATE,
            b'a' => Self::WRITE | Self::CREATE | Self::APPEND,
            b'r' if access == Access::Write => Self::WRITE,
            b'r' => 0,
            _ => return None,
        };
        Some(Self(effects))
    }

    fn access(self) -> Option<Access> {
        // O_APPEND controls later writes; it cannot undo O_TRUNC at open.
        if self.0 & Self::TRUNCATE != 0 {
            return Some(Access::Write);
        }
        if self.0 & (Self::WRITE | Self::CREATE) != 0 {
            return Some(if self.0 & (Self::APPEND | Self::UNKNOWN) == Self::APPEND {
                Access::Append
            } else {
                Access::Write
            });
        }
        (self.0 & Self::UNKNOWN == 0).then_some(Access::Read)
    }
}

/// Preserve known mutation bits across OR with an opaque operand, but never
/// use a partial flag expression to grant the append-only exception. Do not
/// apply this rule to AND/XOR/addition: they can clear or change known bits.
fn combine_open_flags(left: Option<Value>, right: Option<Value>) -> Option<Value> {
    match (left, right) {
        (Some(Value::Flags(left)), Some(Value::Flags(right))) => {
            Some(Value::Flags(OpenFlags(left.0 | right.0)))
        }
        (Some(Value::Flags(flags)), _) | (_, Some(Value::Flags(flags))) => {
            Some(Value::Flags(OpenFlags(flags.0 | OpenFlags::UNKNOWN)))
        }
        _ => None,
    }
}

fn flag_access(node: &Syntax<'_>, language: Language, env: &Bindings) -> Option<Access> {
    match value(node, language, env, 0)? {
        Value::Text(mode) => mode_access(&mode),
        Value::Flags(flags) => flags.access(),
        _ => None,
    }
}

/// Read/update distinction matters: `r+` writes, while plain `r` does not.
/// Append/update still uses O_APPEND. Invalid or dynamic modes are not proof
/// of append-only access; callers that are explicit writers treat them as Write.
fn mode_access(mode: &str) -> Option<Access> {
    let mode = mode.split(':').next()?;
    let first = mode.as_bytes().first()?;
    if !mode.bytes().all(|b| b"rwaxbt+s".contains(&b)) {
        return None;
    }
    match first {
        b'a' if !mode.contains(['w', 'r']) => Some(Access::Append),
        b'w' | b'x' => Some(Access::Write),
        b'r' => Some(if mode.contains('+') {
            Access::Write
        } else {
            Access::Read
        }),
        _ => None,
    }
}

#[cfg(test)]
pub(super) fn classify(segment: &str, dialect: ShellDialect) -> Option<CredentialFileWrite> {
    scan_command(segment, dialect, |_, _| false)
        .into_iter()
        .next()
}

/// Keep one finding for every affected rule until the evaluator applies its
/// allowlists. A rename can affect two rules at the very same source span.
/// Apply explicit source exemptions per decoded program, never to the entire
/// shell command: another interpreter or shell writer may still be protected.
pub(super) fn scan_command(
    segment: &str,
    dialect: ShellDialect,
    mut source_is_exempt: impl FnMut(&str, ScriptLanguage) -> bool,
) -> Vec<CredentialFileWrite> {
    let mut hits = Vec::new();
    if !matches!(dialect, ShellDialect::Posix | ShellDialect::Unknown)
        || segment.len() > MAX_BYTES
        || !source_has_sink_name(segment)
    {
        return hits;
    }
    let mut inspect_source = |code: &str, language: Language, span: Range<usize>| {
        let script_language = match language {
            Language::Python => ScriptLanguage::Python,
            Language:
```

### Core Architecture Module: `src/packs/core/credential_files/embedded/go.rs`
```
//! Go standard-library filesystem writes and bounded, source-local value
//! propagation.
//!
//! Go's write vocabulary is small and regular, which is why this pass is much
//! shorter than the PHP and Perl ones. The mode is the part that differs from
//! every other language here: it is a flag constant (`os.O_APPEND`) rather than
//! a mode string, so append-versus-truncate is decided by bit test rather than
//! by reading a `'a'`.
//!
//! What this pass deliberately does not do: resolve a path that depends on
//! anything outside the source it was handed. A parameter, a struct field, a
//! function result other than the two home lookups below — each of those ends
//! resolution and the call is left alone, exactly as the other language passes
//! leave a dynamic destination alone. The recursive-delete and exec-sink rules
//! still judge the same program under their own predicates.

use super::{
    Access, AstGrep, CredentialFileWrite, MAX_BYTES, MAX_DEPTH, MAX_NODES, MAX_STATIC_PATH_BYTES,
    ResolvedPath, SupportLang, Syntax, record_write,
};
use std::collections::HashMap;

/// `os.O_APPEND` was proven present.
const FLAG_APPEND: u8 = 1;
/// A flag that opens the file for writing was proven present.
const FLAG_WRITE: u8 = 2;
/// Part of the flag expression could not be read, so the absence of
/// `O_APPEND` is not proof of truncation and the absence of a write flag is
/// not proof of a read.
const FLAG_UNKNOWN: u8 = 4;

/// The standard packages this pass recognises, under whatever local name the
/// file imports them as.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Pkg {
    Os,
    Filepath,
    Ioutil,
}

#[derive(Clone, Debug)]
enum Datum {
    Text(ResolvedPath),
    Flags(u8),
}

#[derive(Clone)]
struct State {
    values: HashMap<String, Datum>,
    packages: HashMap<String, Pkg>,
}

impl State {
    fn new() -> Self {
        // Seeded with the conventional names rather than requiring an import
        // to have survived extraction: a truncated body can lose its import
        // block and keep the call. An `import alias "…"` below overwrites the
        // entry, so a file that really does rebind `os` is still read
        // correctly.
        Self {
            values: HashMap::new(),
            packages: HashMap::from([
                ("os".into(), Pkg::Os),
                ("filepath".into(), Pkg::Filepath),
                ("ioutil".into(), Pkg::Ioutil),
            ]),
        }
    }
}

/// The lexical gate. Go's sink names are capitalised, so none of them survive
/// the shared lowercase vocabulary in `source_has_sink_name` — `Create`,
/// `Truncate` and `Rename` contain none of its words at all.
pub(super) fn has_sink_name(code: &str) -> bool {
    [
        "WriteFile",
        "Create",
        "OpenFile",
        "Truncate",
        "Rename",
        "Link",
    ]
    .iter()
    .any(|word| code.contains(word))
}

pub(super) fn scan(code: &str) -> Result<Vec<CredentialFileWrite>, &'static str> {
    if code.len() > MAX_BYTES {
        return Err("protected-write Go source exceeds the byte limit");
    }
    let ast = AstGrep::new(code, SupportLang::Go);
    let mut hits = Vec::new();
    let mut remaining = MAX_NODES;
    visit(ast.root(), &mut State::new(), 0, &mut remaining, &mut hits)?;
    Ok(hits)
}

fn visit(
    node: Syntax<'_>,
    state: &mut State,
    depth: usize,
    remaining: &mut usize,
    hits: &mut Vec<CredentialFileWrite>,
) -> Result<(), &'static str> {
    if depth > MAX_DEPTH || *remaining == 0 || state.values.len() > 1024 {
        return Err("protected-write Go source exceeds the traversal limit");
    }
    *remaining -= 1;
    let kind = node.kind();
    if kind == "ERROR" {
        return Err("protected-write Go source contains a syntax error");
    }

    if kind == "import_spec" {
        bind_import(&node, state);
        return Ok(());
    }

    // A function body does not inherit the caller's locals. Package-level
    // declarations do reach it, and those are bound before any body is walked
    // because the source file is visited in order.
    if matches!(kind.as_ref(), "function_declaration" | "method_declaration") {
        let mut local = state.clone();
        local.values.clear();
        if let Some(body) = node.field("body") {
            visit(body, &mut local, depth + 1, remaining, hits)?;
        }
        return Ok(());
    }
    // A literal closure DOES capture, so it keeps the enclosing bindings, but
    // its own assignments must not leak back out.
    if kind == "func_literal" {
        let mut local = state.clone();
        if let Some(body) = node.field("body") {
            visit(body, &mut local, depth + 1, remaining, hits)?;
        }
        return Ok(());
    }

    if matches!(
        kind.as_ref(),
        "short_var_declaration" | "assignment_statement" | "var_spec" | "const_spec"
    ) {
        assign(&node, state, depth, remaining, hits)?;
        return Ok(());
    }

    if kind == "call_expression" {
        inspect_call(&node, state, hits);
    }

    for child in node.children() {
        visit(child, state, depth + 1, remaining, hits)?;
    }
    Ok(())
}

/// `import alias "path"` / `import "path"`.
fn bind_import(node: &Syntax<'_>, state: &mut State) {
    let Some(path) = node.field("path") else {
        return;
    };
    let literal = string_literal(&path).unwrap_or_default();
    let package = match literal.as_str() {
        "os" => Some(Pkg::Os),
        "path/filepath" | "path" => Some(Pkg::Filepath),
        "io/ioutil" => Some(Pkg::Ioutil),
        _ => None,
    };
    // The default local name is the last path element, which is what the file
    // writes when there is no alias.
    let default_name = literal.rsplit('/').next().unwrap_or(&literal).to_string();
    let name = node
        .field("name")
        .map_or(default_name, |n| n.text().into_owned());
    if name == "_" || name == "." {
        return;
    }
    match package {
        Some(package) => {
            state.packages.insert(name, package);
        }
        // An import that rebinds a name this pass seeded — `import os "fmt"` —
        // must remove the seeded meaning rather than leave it standing.
        None => {
            state.packages.remove(&name);
        }
    }
}

fn assign(
    node: &Syntax<'_>,
    state: &mut State,
    depth: usize,
    remaining: &mut usize,
    hits: &mut Vec<CredentialFileWrite>,
) -> Result<(), &'static str> {
    let names: Vec<String> = node
        .field("left")
        .or_else(|| node.field("name"))
        .map(|left| {
            if left.kind() == "expression_list" || left.kind() == "identifier_list" {
                left.children()
                    .filter(Syntax::is_named)
                    .map(|child| child.text().into_owned())
                    .collect()
            } else {
                vec![left.text().into_owned()]
            }
        })
        .unwrap_or_default();

    let rights: Vec<Syntax<'_>> = node
        .field("right")
        .or_else(|| node.field("value"))
        .map(|right| {
            if right.kind() == "expression_list" {
                right.children().filter(Syntax::is_named).collect()
            } else {
                vec![right]
            }
        })
        .unwrap_or_default();

    // The right-hand side runs first, and a sink call there is a write even
    // when its handle is never used: `f, _ := os.OpenFile(key, os.O_WRONLY, 0)`
    // has already opened the file for writing by the time `f` exists.
    for right in &rights {
        visit(right.clone(), state, depth + 1, remaining, hits)?;
    }

    // One right-hand side per name is the straightforward case.
    //
    // The other case that matters is Go's universal `value, err := call()`
    // idiom: one expression, several names, the value first. `home, _ :=
    // os.UserHomeDir()` is the ordinary way to write the shape this pass most
    // needs to follow, so the first name takes the call's value and the rest
    // are cleared. Nothing is guessed by it — a call this pass cannot value
    // binds nothing, which is why `f, _ := os.OpenFile(…)` leaves `f` unbound
    // rather than pretending the handle is a path.
    let single_multi_bind = rights.len() == 1 && names.len() > 1;
    if names.len() == rights.len() || single_multi_bind {
        for (index, name) in names.iter().enumerate() {
            let assigned = rights
                .get(if single_multi_bind { 0 } else { index })
                .filter(|_| !single_multi_bind || index == 0)
                .and_then(|right| value(right, state, 0));
            match assigned {
                Some(datum) => {
                    state.values.insert(name.clone(), datum);
                }
                None => {
                    state.values.remove(name);
                }
            }
        }
    } else {
        for name in &names {
            state.values.remove(name);
        }
    }
    Ok(())
}

/// The package and function a call names, when it is one this pass owns.
fn sink(node: &Syntax<'_>, state: &State) -> Option<(Pkg, String)> {
    let function = node.field("function")?;
    if function.kind() != "selector_expression" {
        return None;
    }
    let operand = function.field("operand")?;
    if operand.kind() != "identifier" {
        return None;
    }
    let package = *state.packages.get(operand.text().as_ref())?;
    Some((package, function.field("field")?.text().into_owned()))
}

fn arg<'a>(node: &Syntax<'a>, index: usize) -> Option<Syntax<'a>> {
    super::arguments(node).into_iter().nth(index)
}

fn inspect_call(node: &Syntax<'_>, state: &State, hits: &mut Vec<CredentialFileWrite>) {
    let Some((package, name)) = sink(node, state) else {
        return;
    };
    let target = |index: usize| arg(node, index).and_then(|a| path(&a, state));
    let mut record = |path, access| {
        record_write(hits, node.range(), &format!("Go {name}"), path, access);
    }
```

### Core Architecture Module: `src/packs/core/credential_files/embedded/perl.rs`
```
//! Bounded Perl protected-write fallback. Perl has no ast-grep grammar.
//!
//! A linear token regex separates executable words from comments and quoted
//! data. Only open/sysopen/truncate, scalar constants, concatenation and proven Fcntl
//! flags are interpreted. This is not a Perl parser or a runtime evaluator.

use super::{
    Access, Bindings, CredentialFileWrite, MAX_BYTES, MAX_DEPTH, MAX_NODES, MAX_STATIC_PATH_BYTES,
    OpenFlags, ResolvedPath, Value, combine_open_flags, concatenate_text, record_write,
    resolved_path,
};
use regex::Regex;
use std::cell::Cell;
use std::collections::{HashMap, HashSet};
use std::ops::Range;
use std::sync::LazyLock;

static TOKEN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
    r#"(?xs)\A(?:\s+|\#[^\n]*|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\$[A-Za-z_][A-Za-z_0-9]*(?:::[A-Za-z_][A-Za-z_0-9]*)*|[A-Za-z_][A-Za-z_0-9]*(?:::[A-Za-z_][A-Za-z_0-9]*)*|\.=|\|=|=>|->|\|\||&&|=~|!~|[^\s])"#
).expect("Perl token regex is valid")
});

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Kind {
    Word,
    Variable,
    Quoted(bool),
    Words,
    Opaque,
    Punctuation,
}

#[derive(Clone, Debug)]
struct Token<'a> {
    text: &'a str,
    kind: Kind,
    span: Range<usize>,
}

struct State {
    values: Bindings,
    handles: HashMap<String, (ResolvedPath, Access)>,
    imports: HashSet<String>,
    fcntl: bool,
    home: bool,
    shadowed: HashSet<String>,
    work: Cell<usize>,
}

/// Bound total token visits as well as source size and nesting. Otherwise
/// overlapping argument scans could keep a quadratic worker alive after the
/// caller's wall-clock deadline has expired.
fn charge(work: &Cell<usize>) -> Result<(), &'static str> {
    let left = work
        .get()
        .checked_sub(1)
        .ok_or("protected-write Perl exceeds the work limit")?;
    work.set(left);
    Ok(())
}

pub(super) fn scan(code: &str) -> Result<Vec<CredentialFileWrite>, &'static str> {
    if code.len() > MAX_BYTES {
        return Err("protected-write Perl source exceeds the byte limit");
    }
    let tokens = lex(code)?;
    let mut state = State {
        values: Bindings::new(),
        handles: HashMap::new(),
        imports: HashSet::new(),
        fcntl: false,
        home: true,
        shadowed: HashSet::new(),
        work: Cell::new(MAX_NODES * 8),
    };
    // Bare calls can be overridden by a declared sub, even when its body is
    // later in the source. CORE::open/sysopen remain unambiguous.
    for pair in tokens.windows(2) {
        if pair[0].text == "sub" {
            state.shadowed.insert(pair[1].text.to_string());
        }
    }
    let mut hits = Vec::new();
    let mut pending: Vec<(usize, String, Option<Value>)> = Vec::new();
    for index in 0..tokens.len() {
        while pending.last().is_some_and(|(end, _, _)| *end <= index) {
            if let Some((_, name, value)) = pending.pop() {
                state.values.remove(&name);
                state.handles.remove(&name);
                if let Some(value) = value {
                    state.values.insert(name, value);
                }
            }
        }
        if state.values.len() + state.handles.len() > 1024 || pending.len() > MAX_DEPTH {
            return Err("protected-write Perl source exceeds the binding limit");
        }
        let token = &tokens[index];
        if matches!(token.text, "use" | "require")
            && tokens
                .get(index + 1)
                .is_some_and(|next| next.text == "Fcntl")
        {
            state.fcntl = true;
            if token.text == "use" {
                let end = statement_end(&tokens, index + 2, &state.work)?;
                let options = &tokens[index + 2..end];
                if options.is_empty() {
                    state.imports.insert(":DEFAULT".into());
                }
                for option in options {
                    if matches!(option.kind, Kind::Words | Kind::Quoted(_)) {
                        state
                            .imports
                            .extend(option.text.split_whitespace().map(str::to_string));
                    }
                }
            }
        }
        if token.kind == Kind::Variable {
            if token.text == "$ENV" && tokens.get(index + 1).is_some_and(|next| next.text == "{") {
                let end = matching_end(&tokens, index + 1, &state.work)?;
                if tokens
                    .get(end + 1)
                    .is_some_and(|next| matches!(next.text, "=" | ".=" | "|="))
                {
                    state.home = false;
                }
            }
            if let Some(operator) = tokens
                .get(index + 1)
                .filter(|next| matches!(next.text, "=" | ".=" | "|=" | "+=" | "-="))
            {
                let end = statement_end(&tokens, index + 2, &state.work)?;
                let right = value(&tokens[index + 2..end], &state, 0);
                let before = state.values.get(token.text).cloned();
                let assigned = match operator.text {
                    "=" => right,
                    ".=" => before
                        .and_then(|left| right.and_then(|right| concatenate_text(left, right))),
                    "|=" => combine_open_flags(before, right),
                    _ => None,
                };
                // RHS calls see the old binding; a deferred update cannot hide
                // an open in `$p = open(..., $p)`.
                pending.push((end, token.text.to_string(), assigned));
            }
        }
        let api = token.text.strip_prefix("CORE::").unwrap_or(token.text);
        if token.kind != Kind::Word
            || !matches!(
                api,
                "open"
                    | "sysopen"
                    | "truncate"
                    | "close"
                    // Transfers (#484). `rename`, `symlink` and `link` are
                    // builtins; `copy`/`move`/`cp`/`mv` come from File::Copy,
                    // which exports them into the caller's namespace, so they
                    // are read unqualified the way the module is actually used.
                    | "rename"
                    | "symlink"
                    | "link"
                    | "copy"
                    | "move"
                    | "cp"
                    | "mv"
            )
        {
            continue;
        }
        if token.text == api && state.shadowed.contains(api) {
            continue;
        }
        if index > 0 && matches!(tokens[index - 1].text, "->" | "sub" | "&") {
            continue;
        }
        let (args, end) = call_arguments(&tokens, index + 1, &state.work)?;
        let handle = args.first().copied().and_then(handle_name);
        if api == "close" {
            if let Some(name) = handle {
                state.handles.remove(name);
            }
            continue;
        }
        let finding = if api == "open" {
            match args.as_slice() {
                [_, specification] => two_argument_open(specification, &state),
                [_, mode, path] => {
                    let access = value(mode, &state, 0).and_then(|value| match value {
                        Value::Text(mode) => mode_access(&mode),
                        _ => None,
                    });
                    access.and_then(|access| {
                        value(path, &state, 0)
                            .and_then(resolved_path)
                            .map(|path| (path, access))
                    })
                }
                _ => None,
            }
        } else if api == "truncate" && args.len() == 2 {
            if let Some((path, access)) = handle.and_then(|name| state.handles.get(name)) {
                (*access != Access::Read).then(|| (path.clone(), Access::Write))
            } else {
                value(args[0], &state, 0)
                    .and_then(resolved_path)
                    .map(|path| (path, Access::Write))
            }
        } else if api == "sysopen" && matches!(args.len(), 3 | 4) {
            let flags = value(args[2], &state, 0).and_then(|value| match value {
                Value::Flags(flags) => flags.access(),
                _ => None,
            });
            flags.and_then(|access| {
                value(args[1], &state, 0)
                    .and_then(resolved_path)
                    .map(|path| (path, access))
            })
        } else if is_transfer(api) && args.len() == 2 {
            // The destination is argument 1 in every one of them: `rename(from,
            // to)`, `symlink(target, link)`, `link(old, new)`, `copy(from, to)`
            // and `move(from, to)` (#484). The source end is judged separately
            // below, because a rename or move destroys a protected file by
            // taking its NAME away, not by writing over it.
            value(args[1], &state, 0)
                .and_then(resolved_path)
                .map(|path| (path, Access::Write))
        } else {
            None
        };
        // `symlink`, `link` and `copy` read their source and leave it in place,
        // so only a move removes one.
        let removed_source = if matches!(api, "rename" | "move" | "mv") && args.len() == 2 {
            value(args[0], &state, 0)
                .and_then(resolved_path)
                .map(|path| (path, Access::Write))
        } else {
            None
        };
        if matches!(api, "open" | "sysopen") {
            if let Some(name) = handle {
                // A filehandle target is an output, not a path-valued scalar.
                // Reopening it with an unresolved target also kills old proof.
                state.values.remove(name);
                state.handles.remove(name);
                if let Some(finding) = &finding {
                    state.handles.insert(name.to_string(), finding.clone());
                }
            }
        }
        for (path, access) in finding.into_i
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #396** (2026-09-16): **[False Positive] rm-rf-general does not fold a literal assignment or `$(mktemp -d)` that redirect-truncate-dynamic-path already folds**
  *Symptoms*: ### Blocked Command  D=/private/tmp/dcg-corpus-nonexistent; rm -rf "$D/work"  ### Expected Behavior  Within the same command list, dcg already resolves `$D` to its literal assignment for the redirect rule (#275, closed 2026-08-05: literal-assignment folding and `$(mktemp -d)` recognition for redirect-truncate-dynamic-path). The rm operand in the same command does not get that folding, so the same value allows as a redirect target and denies as an rm operand:  | Command text | Observed (0.14.1) | |---|---| | `D=/private/tmp/dcg-corpus-nonexistent; echo x > "$D/a.log"` | allow (folded) | | `D=/private/tmp/dcg-corpus-nonexistent; rm -rf "$D/work"` | deny, core.filesystem:rm-rf-general | | `W=$(mktemp -d); echo x > "$W/out.log"` | allow (mktemp understood) | | `W=$(mktemp -d); rm -rf "$W/work"` | deny, core.filesystem:rm-rf-general | | `rm -rf /private/tmp/dcg-corpus-nonexistent/work` | allow |  So this is not "static analysis cannot know what $D holds"; dcg knows it in the very same command for a different rule. Expected: the rm temp exemption sees the same folded value the redirect rule sees. The consequence #275's own text warned about is an incentive inversion: spelling the scratchpad literally passes, so the guard nudges agents away from `mktemp -d` toward hard-coded temp paths, and in this install's blocked.log that is 138 refusals across 72 sessions of exactly this cleanup shape.  ### Output of `dcg explain`  ```shell Decision: DENY Rule ID:    core.filesystem:rm-rf-genera

- **Issue #395** (2026-09-16): **[False Positive] rm-rf-general denies `rm -rf -- /tmp/<dir>/…`: the end-of-options guard costs the literal temp exemption**
  *Symptoms*: ### Blocked Command  rm -rf -- /tmp/dcg-corpus-nonexistent/work  ### Expected Behavior  `rm -rf /tmp/dcg-corpus-nonexistent/work` is allowed by the core.filesystem temp safe patterns. Inserting `--`, the POSIX end-of-options marker that stops a path beginning with `-` from being read as a flag, makes the command strictly safer and is what a careful script writes; it should not fall out of the exemption. All eight rm temp safe patterns are anchored as `^rm\s+-<flags>\s+(<tmp path>\s*)+$` with no slot for `--` (rm-rf-tmp: `^rm\s+-[a-zA-Z]*[rR][a-zA-Z]*f[a-zA-Z]*\s+(?:(?:/private)?/tmp/…\S*(?:\s+|$))+$`), so the safer spelling falls through to the rm-rf-general catch-all:  | Command text | Observed (0.14.1) | |---|---| | `rm -rf /tmp/dcg-corpus-nonexistent/work` | allow | | `rm -rf /private/tmp/dcg-corpus-nonexistent/work` | allow | | `rm -rf /var/tmp/dcg-corpus-nonexistent/work` | allow | | `rm -rf -- /tmp/dcg-corpus-nonexistent/work` | deny, core.filesystem:rm-rf-general | | `rm -rf -- /private/tmp/dcg-corpus-nonexistent/work` | deny, core.filesystem:rm-rf-general | | `rm -rf -- /var/tmp/dcg-corpus-nonexistent/work` | deny, core.filesystem:rm-rf-general | | `rm -fr -- /tmp/dcg-corpus-nonexistent/work` | deny, core.filesystem:rm-rf-general | | `rm -rf -- /Users/z/x` | deny, core.filesystem:rm-rf-root-home (correct) |  Allowing an optional `(?:--\s+)?` before the operand list in the temp safe patterns widens accepted syntax only to `--` forms while keeping eligible operands rest

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

### Incident Patch 1: `5b1d5bf3` (2026-10-15)
**Commit Message**: fix(config): preserve trusted-policy failures and restore verified #568 publication

The #568 publication workflow required a candidate patch that was absent from
the repository, after its former seven-blob verified extraction step had been
removed. Recover that useful candidate from its real immutable Git objects,
preserve the incoming nine-host process coverage, and land the runtime repair
itself so ordinary main builds consume the corrected policy behavior.

Keep the actual read/open outcome of each configuration layer. Missing optional
files remain optional, while a missing explicit file, rejected trusted source,
unreadable content, invalid UTF-8, malformed TOML, or oversized trusted content
sets a runtime-only configuration error. Preserve that failure through later
merges and compiled overrides, before allow overrides, quick paths, persistent
grants, or fail-open environment choices can authorize a command. Automatically
discovered repository policy retains its existing untrusted, monotonic scope;
its malformed text does not manufacture a global trusted-policy failure.

Use the shared CLI/config precedence loader and retain recovery/diagnostic
commands. Bare hooks keep each h

**File**: `.github/patches/config-load-568.patch` (added, +864/-0)
```diff
@@ -0,0 +1,864 @@
+diff --git a/src/config.rs b/src/config.rs
+--- a/src/config.rs
++++ b/src/config.rs
+@@ -61,50 +61,89 @@
+ /// the subsequent read and prevents a FIFO from wedging the hook before its
+ /// file type can be rejected.
+ pub(crate) fn read_config_file_bounded(path: &Path, source: ConfigSource) -> Option<String> {
++    read_config_file_result(path, source).ok()
++}
++
++/// Preserve the outcome of the actual open/read. A later filesystem restat is
++/// useful for diagnostics, but must not decide whether required policy vanished.
++#[derive(Debug)]
++enum ConfigReadFailure {
++    Missing,
++    #[cfg_attr(unix, allow(dead_code))]
++    Unsupported,
++    Rejected(String),
++    Content(String),
++}
++
++impl ConfigReadFailure {
++    fn blocks_trusted_layer(&self, source: ConfigSource, layer: ConfigFileLayer) -> bool {
++        if source == ConfigSource::AutoProject {
++            return false;
++        }
++        match self {
++            Self::Missing => layer == ConfigFileLayer::Explicit,
++            Self::Unsupported => false,
++            // A system path that failed its ownership/path trust checks is not
++            // administrator policy. Keep ignoring it, including on Windows.
++            Self::Rejected(_) => source == ConfigSource::Untrusted,
++            // Content failures occur AFTER the source's handle was validated.
++            Self::Content(_) => true,
++        }
++    }
++
++    fn detail(&self) -> &str {
++        match self {
++            Self::Missing => "the explicitly selected configuration file does not exist",
++            Self::Unsupported => "this configuration source is unsupported on this platform",
++            Self::Rejected(detail) | Self::Content(detail) => detail,
++        }
++    }
++}
++
++fn read_config_file_result(path: &Path, source: ConfigSource) -> Result<String, ConfigReadFailure> {
+     #[cfg(not(unix))]
+     if non_unix_source_is_unsupported(source) {
+         warn_and_ignore_non_unix_restricted_config(path, source);
+-        return None;
++        return Err(ConfigReadFailure::Unsupported);
+     }
+
+     let mut file = match open_config_file_for_source(path, source) {
+-        Ok(f) => f,
+-        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return None,
+-        Err(e) => {
++        Ok(file) => file,
++        Err(error) if error.kind() == io::ErrorKind::NotFound => {
++            return Err(ConfigReadFailure::Missing);
++        }
++        Err(error) => {
+             crate::emit_stderr!(
+                 "Warning: refusing to load config file '{}': {}",
+                 path.display(),
+-                e
++                error
+             );
+-            return None;
++            return Err(ConfigReadFailure::Rejected(error.to_string()));
+         }
+     };
+-
+-    // `take(MAX_CONFIG_BYTES + 1)` lets us tell "exactly cap" (allowed) from
+-    // "more than cap" (rejected) without reading unbounded bytes either way.
+-    let mut buf = String::new();
+-    if let Err(e) = file
++    let mut content = String::new();
++    if let Err(error) = file
+         .by_ref()
+         .take(MAX_CONFIG_BYTES + 1)
+-        .read_to_string(&mut buf)
++        .read_to_string(&mut content)
+     {
+         crate::emit_stderr!(
+             "Warning: Failed to read config file '{}': {}",
+             path.display(),
+-            e
+-        );
+-        return None;
+-    }
+-    if buf.len() as u64 > MAX_CONFIG_BYTES {
++            error
++        );
++        return Err(ConfigReadFailure::Content(error.to_string()));
++    }
++    if content.len() as u64 > MAX_CONFIG_BYTES {
++        let detail = format!("configuration exceeds the {MAX_CONFIG_BYTES}-byte limit");
+         crate::emit_stderr!(
+-            "Warning: refusing to load config '{}' — exceeds {}-byte cap",
++            "Warning: refusing to load config '{}': {}",
+             path.display(),
+-            MAX_CONFIG_BYTES
+-        );
+-        return None;
+-    }
+-
+-    Some(buf)
++            detail
++        );
++        return Err(ConfigReadFailure::Content(detail));
++    }
++    Ok(content)
+ }
+
+ /// Render a TOML error from an automatically discovered repository config
+@@ -2982,6 +3021,12 @@
+ #[derive(Debug, Clone, Default, Serialize, Deserialize, schemars::JsonSchema)]
+ #[serde(default)]
+ pub struct OverridesConfig {
++    /// Runtime-only failure of a required trusted config layer (#568).
++    /// Neither TOML nor an automatic project policy can manufacture or clear it.
++    #[serde(skip)]
++    #[schemars(skip)]
++    pub configuration_error: Option<String>,
++
+     /// Patterns to allow that would otherwise be blocked.
+     #[serde(default)]
+     pub allow: Vec<AllowOverride>,
+@@ -3834,6 +3879,8 @@
+ /// evaluations. It eliminates per-command regex compilation overhead.
+ #[derive(Debug, Default)]
+ pub struct CompiledOverrides {
++    /// Fatal trusted-config failure, checked before every authorization pa
```

**File**: `.github/workflows/config-load-568.yml` (modified, +18/-7)
```diff
@@ -15,7 +15,10 @@ on:
       - src/main.rs
       - src/cli.rs
       - src/evaluator.rs
+      - src/config_load_regression_tests.rs
       - tests/repro_568_config_load.rs
+      - scripts/apply_config_load_candidate.py
+      - scripts/test_apply_config_load_candidate.py
       - .github/workflows/config-load-568.yml
       - .github/patches/config-load-568.patch
 
@@ -31,10 +34,11 @@ jobs:
     runs-on: ubuntu-latest
     timeout-minutes: 45
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v7
         with:
           ref: ${{ github.sha }}
-          fetch-depth: 1
+          # The candidate tests read its real immutable source preimages.
+          fetch-depth: 0
       - name: Record exact source for review
         shell: bash
         run: |
@@ -51,16 +55,21 @@ jobs:
       - name: Apply reviewed diff on explicitly requested publication
         if: github.event_name == 'workflow_dispatch' && inputs.publish
         run: |
-          test -f .github/patches/config-load-568.patch
-          git apply --check .github/patches/config-load-568.patch
-          git apply .github/patches/config-load-568.patch
+          python3 scripts/apply_config_load_candidate.py
           git diff --check
+      - name: Candidate acquisition and refusal regressions
+        run: python3 -m unittest discover -s scripts -p test_apply_config_load_candidate.py -v
       - name: Install the repository-pinned Rust toolchain
         run: rustup show active-toolchain
       - uses: Swatinem/rust-cache@v2
       - name: Format publication candidate
         if: github.event_name == 'workflow_dispatch' && inputs.publish
-        run: cargo fmt
+        # Format only the exact paths the publisher will commit. The final
+        # whole-tree check must still reject unrelated baseline formatting.
+        run: >-
+          rustfmt --edition 2024 --config skip_children=true
+          src/config.rs src/evaluator.rs src/main.rs src/cli.rs
+          src/config_load_regression_tests.rs tests/repro_568_config_load.rs
       - name: Trusted-policy process regressions
         run: cargo test --locked --test repro_568_config_load -- --test-threads=1
       - name: Configuration and hook unit regressions
@@ -83,12 +92,14 @@ jobs:
           base=$(git rev-parse HEAD)
           remote=$(git ls-remote origin refs/heads/main | cut -f1)
           test "$base" = "$remote" || { echo 'main advanced; refusing to publish a stale candidate'; exit 1; }
+          master=$(git ls-remote origin refs/heads/master | cut -f1)
+          test "$base" = "$master" || { echo 'master differs from main; refusing an unreviewed mirror update'; exit 1; }
           git diff --check
           git config user.name 'github-actions[bot]'
           git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
           git add src/config.rs src/evaluator.rs src/main.rs src/cli.rs tests/repro_568_config_load.rs
           if test -f src/config_load_regression_tests.rs; then git add src/config_load_regression_tests.rs; fi
           git diff --cached --quiet && { echo 'No source changes to publish'; exit 1; }
           git commit -m 'fix(config): preserve trusted policy failures across evaluation and hook protocols (#568)'
-          git push origin HEAD:main
+          git push --atomic origin HEAD:refs/heads/main HEAD:refs/heads/master
           echo "Published $(git rev-parse HEAD)" >> "$GITHUB_STEP_SUMMARY"
```

**File**: `scripts/apply_config_load_candidate.py` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+#!/usr/bin/env python3
+"""Apply the immutable #568 candidate only to its reviewed source preimages.
+
+The patch recovers the candidate archive whose Git blob is
+8a8202da56093d3bb8c56303ddaee1a0706ca0af (SHA256
+88ff782aba402680dc5115acd5fa1d5a6bdbf6fe82c1dd3e282c6fbe15bcee64).
+Its original seven-blob transport is retained in commit 17982f8d. The Rust
+changes preserve the original producer's output plus the batch config-error
+protocol repair, formatted with the pinned rustfmt;
+the newer process/protocol regressions remain in the checkout, not overwritten.
+This command neither compiles code nor publishes any Git objects or refs.
+"""
+from __future__ import annotations
+
+import argparse
+import hashlib
+from pathlib import Path
+import subprocess
+import sys
+
+ROOT = Path(__file__).resolve().parents[1]
+PATCH = Path(".github/patches/config-load-568.patch")
+PATCH_SHA256 = "82a4bbd07e3a6dde87a6ba7ff33f3f65f21b535f184c493ac9b0aded0400077e"
+PREIMAGES = {
+    "src/config.rs": "44c7948ee5fdd599a087bb8544bc77689ce1a5574aff7a4c613734abb59a10dd",
+    "src/main.rs": "839736558a4b48014333134da237cc5af644460af0feb86051bd7e7b24d55731",
+    "src/evaluator.rs": "dea96cdb666685172a563a63bf9973817bf9aa0dded78c08f1c17f0fdca4955a",
+    "src/cli.rs": "9cae3d022a29fd2073b2fea1ff9513ebb06a49c5008512e7891651fa8f247e8f",
+}
+REGRESSION = Path("tests/repro_568_config_load.rs")
+REGRESSION_SHA256 = "4ee42816b1b610202c96d68f81929a0c7b5f371079fb636da1870f181bae06d4"
+NEW_UNIT_TESTS = Path("src/config_load_regression_tests.rs")
+
+
+def regular_bytes(root: Path, relative: Path) -> bytes:
+    path = root / relative
+    # Reject symlinks in the path as well as at the leaf. All candidate inputs
+    # must be the actual checkout bytes, not files reached outside the checkout.
+    if any((root / Path(*relative.parts[:i])).is_symlink()
+           for i in range(1, len(relative.parts) + 1)):
+        raise ValueError(f"candidate input must not be a symlink: {relative}")
+    if not path.is_file():
+        raise ValueError(f"missing regular candidate input: {relative}")
+    return path.read_bytes()
+
+
+def apply_candidate(root: Path, *, check: bool = False) -> None:
+    patch = regular_bytes(root, PATCH)
+    if not patch or hashlib.sha256(patch).hexdigest() != PATCH_SHA256:
+        raise ValueError("candidate patch SHA256 mismatch; refusing unreviewed payload")
+    for name, expected in PREIMAGES.items():
+        content = regular_bytes(root, Path(name))
+        actual = hashlib.sha256(content).hexdigest()
+        if actual != expected:
+            raise ValueError(f"{name}: source preimage mismatch; refusing source drift")
+    regression = regular_bytes(root, REGRESSION)
+    if hashlib.sha256(regression).hexdigest() != REGRESSION_SHA256:
+        raise ValueError("process/protocol regression preimage mismatch")
+    unit_tests = root / NEW_UNIT_TESTS
+    if unit_tests.exists() or unit_tests.is_symlink():
+        raise ValueError(f"refusing to overwrite existing unit regressions: {NEW_UNIT_TESTS}")
+    # Feed the bytes that were hashed, so a patch-path replacement between the
+    # guard and git apply cannot substitute a different candidate payload.
+    subprocess.run(["git", "apply", "--check", "--whitespace=error-all", "-"],
+                   input=patch, cwd=root, check=True, timeout=30)
+    if not check:
+        subprocess.run(["git", "apply", "--whitespace=error-all", "-"],
+                       input=patch, cwd=root, check=True, timeout=30)
+    print("Verified #568 candidate preimages" + (" (check only)." if check else "; applied five source/test paths."))
+
+
+def main() -> int:
+    parser = argparse.ArgumentParser(description=__doc__)
+    parser.add_argument("--root", type=Path, default=ROOT,
+                        help="checkout/export to validate and apply (default: repository)")
+    parser.add_argument("--check", action="store_true", help="validate without changing source")
+    args = parser.parse_args()
+    try:
+        apply_candidate(args.root.resolve(), check=args.check)
+    except (OSError, ValueError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
+        print(f"#568 candidate refused: {error}", file=sys.stderr)
+        return 1
+    return 0
+
+
+if __name__ == "__main__":
+    raise SystemExit(main())
```

**File**: `scripts/test_apply_config_load_candidate.py` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+"""Exercise the production #568 patch consumer with real Git blobs and git apply.
+
+Run: python3 -m unittest discover -s scripts -p test_apply_config_load_candidate.py -v
+No compiler, executable DCG, network, install, publication, or user config is used.
+The baseline files come from actual immutable objects in the repository history;
+this remains a producer/application test, not config-runtime acceptance.
+"""
+from __future__ import annotations
+
+import hashlib
+import os
+from pathlib import Path
+import shutil
+import subprocess
+import sys
+import tempfile
+import unittest
+
+import apply_config_load_candidate as candidate
+
+SOURCE_BLOBS = {
+    "src/config.rs": "18953a0a7eb22ac5c6e3c757113bec605017f596",
+    "src/main.rs": "7a90d3f8cd48693a3f441968bb8f28b28357dfbd",
+    "src/evaluator.rs": "d46131c2734cbf6a1ae60f8b48aec122b1f65db1",
+    "src/cli.rs": "dd003d861a725e4fbf51e37ea7eb1886474a9d6e",
+}
+
+POSTIMAGES = {
+    "src/config.rs": "720d6e408cdcd75a71007bd954e2d99c9d774aee342979559808827714fa9a6f",
+    "src/main.rs": "7357563616f1d30165cf6ff09f18b75a702770908eea997262ffaae2347c05ba",
+    "src/evaluator.rs": "0f38d575dafd611f9ef831a3cad2a26118949b4e57f1a3c4897abb997c6cb0c1",
+    "src/cli.rs": "ed9f63206037ba50d1ec2fd7059cec3063e18bf6573352b9d7c61dce3a741109",
+    "src/config_load_regression_tests.rs": "f7e097798629c7338655564f55c990ee1261a2c4de40a34aa45366cb9d9aeea8",
+}
+
+
+class CandidateApplicationTests(unittest.TestCase):
+    def setUp(self) -> None:
+        self.directory = tempfile.TemporaryDirectory(prefix="dcg-568-")
+        self.addCleanup(self.directory.cleanup)
+        self.root = Path(self.directory.name)
+        for name, oid in SOURCE_BLOBS.items():
+            data = subprocess.check_output(["git", "cat-file", "blob", oid],
+                                           cwd=candidate.ROOT, timeout=30)
+            path = self.root / name
+            path.parent.mkdir(parents=True, exist_ok=True)
+            path.write_bytes(data)
+        for name in [candidate.PATCH, candidate.REGRESSION]:
+            path = self.root / name
+            path.parent.mkdir(parents=True, exist_ok=True)
+            shutil.copyfile(candidate.ROOT / name, path)
+
+    def snapshot(self) -> dict[str, bytes]:
+        return {str(path.relative_to(self.root)): path.read_bytes()
+                for path in self.root.rglob("*") if path.is_file()}
+
+    def run_consumer(self, *args: str) -> subprocess.CompletedProcess:
+        return subprocess.run(
+            [sys.executable, str(candidate.ROOT / "scripts/apply_config_load_candidate.py"),
+             "--root", str(self.root), *args],
+            capture_output=True, text=True, check=False, timeout=30,
+            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
+        )
+
+    def assert_refused_without_changes(self, message: str) -> None:
+        before = self.snapshot()
+        result = self.run_consumer()
+        self.assertNotEqual(result.returncode, 0, result)
+        self.assertIn(message, result.stderr)
+        self.assertEqual(self.snapshot(), before)
+
+    def test_real_candidate_applies_exact_reviewed_source_and_unit_regressions(self):
+        regression = (self.root / candidate.REGRESSION).read_bytes()
+        result = self.run_consumer()
+        self.assertEqual(result.returncode, 0, result.stderr)
+        for name, expected in POSTIMAGES.items():
+            self.assertEqual(hashlib.sha256((self.root / name).read_bytes()).hexdigest(), expected, name)
+        self.assertEqual((self.root / candidate.REGRESSION).read_bytes(), regression)
+        self.assertIn(b'#[path = "config_load_regression_tests.rs"]',
+                      (self.root / "src/config.rs").read_bytes())
+
+    def test_check_only_proves_real_apply_without_changing_files(self):
+        before = self.snapshot()
+        result = self.run_consumer("--check")
+        self.assertEqual(result.returncode, 0, result.stderr)
+        self.assertEqual(self.snapshot(), before)
+
+    def test_tampered_patch_fails_before_source_modification(self):
+        with (self.root / candidate.PATCH).open("ab") as patch:
+            patch.write(b"\n# unreviewed payload\n")
+        self.assert_refused_without_changes("patch SHA256 mismatch")
+
+    def test_empty_patch_is_not_a_candidate(self):
+        (self.root / candidate.PATCH).write_bytes(b"")
+        self.assert_refused_without_changes("patch SHA256 mismatch")
+
+    def test_missing_patch_fails_before_source_modification(self):
+        (self.root / candidate.PATCH).rename(self.root / "retained-patch")
+        self.assert_refused_without_changes("missing regular candidate input")
+
+    def test_wrong_base_outside_patch_context_still_refuses(self):
+        with (self.root / "src/config.rs").open("ab") as source:
+            source.write(b"\n// useful intervening source work\n")
+        self.assert_refused_without_changes("source preimage mismatch")
+
+    def test_existi
```

**File**: `src/cli.rs` (modified, +73/-11)
```diff
@@ -2434,9 +2434,40 @@ pub fn run_command(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
     let (config, config_sources) = if needs_config_trace {
         let loaded_config = Config::load_with_report();
         (loaded_config.config, Some(loaded_config.sources))
+    } else if let Some(Command::TestCommand {
+        config: Some(path), ..
+    }) = &cli.command
+    {
+        (Config::load_with_explicit_path(path), None)
     } else {
         (Config::load(), None)
     };
+    // Diagnostics and repair-oriented config commands remain available. Other
+    // CLI operations must not report success using partially loaded policy.
+    // Explicit batch hooks have their own indexed JSONL denial contract.
+    if let Some(reason) = config.configuration_error() {
+        if !matches!(
+            &cli.command,
+            Some(
+                Command::Doctor { .. }
+                    | Command::ShowConfig { .. }
+                    | Command::Completions { .. }
+                    | Command::Hook(_)
+            )
+        ) {
+            crate::emit_stdout!(
+                "{}",
+                serde_json::json!({
+                    "schema_version": 1,
+                    "decision": "deny",
+                    "error": { "kind": "configuration_error", "message": reason },
+                    "reason": reason,
+                })
+            );
+            crate::emit_stderr!("Error: {reason}");
+            std::process::exit(crate::exit_codes::EXIT_CONFIG_ERROR);
+        }
+    }
     crate::output::install_theme_config(&config);
     let verbosity = Verbosity::from_cli(&cli);
     let explicit_omp_agent = is_explicit_omp_agent(cli.agent.as_deref());
@@ -2558,7 +2589,7 @@ pub fn run_command(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
         Some(Command::TestCommand {
             command,
             stdin,
-            config: config_path,
+            config: _,
             with_packs,
             explain,
             format,
@@ -2578,16 +2609,9 @@ pub fn run_command(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
             validate_omp_bridge_output_agent(omp_bridge_output, robot_mode, explicit_omp_agent)?;
             let effective_format = if robot_mode { TestFormat::Json } else { format };
 
-            // Load specific config file if provided, otherwise use default
-            let effective_config = if let Some(ref path) = config_path {
-                Config::load_from_file(path).unwrap_or_else(|| {
-                    eprintln!("Warning: Failed to load config from {}", path.display());
-                    config.clone()
-                })
-            } else {
-                config.clone()
-            };
-
+            // The shared loader already selected --config, preserving
+            // system policy, environment overrides and fatal load failures.
+            let effective_config = config.clone();
             let command = if stdin {
                 read_test_command_from_stdin(
                     effective_config.general.max_command_bytes(),
@@ -2900,6 +2924,13 @@ fn write_completions(shell: CompletionShell) -> Result<(), Box<dyn std::error::E
 fn run_hook_command(config: &Config, cmd: &HookCommand) -> Result<i32, Box<dyn std::error::Error>> {
     use std::io::{self, BufRead, Write};
 
+    // A broken trusted layer must deny before allowlists, external packs or
+    // policy modes can authorize a line. Preserve the batch protocol instead
+    // of emitting the generic CLI error or a host-specific hook envelope.
+    if let Some(reason) = config.configuration_error() {
+        return run_hook_configuration_error(reason);
+    }
+
     // `dcg hook` reads JSONL hook payloads from stdin and writes one result
     // line per (non-empty) input line. `--batch` is accepted for explicitness
     // but is no longer required — a single JSON object on stdin is processed as
@@ -3156,6 +3187,37 @@ fn run_hook_command(config: &Config, cmd: &HookCommand) -> Result<i32, Box<dyn s
     Ok(exit_code)
 }
 
+/// Refuse each nonblank input with the established batch JSONL/exit-1 contract.
+/// Even malformed or non-UTF-8 inputs cannot hide a missing trusted policy.
+fn run_hook_configuration_error(reason: &str) -> Result<i32, Box<dyn std::error::Error>> {
+    use std::io::{self, BufRead, Write};
+
+    let stdin = io::stdin();
+    let stdout = io::stdout();
+    let mut output = stdout.lock();
+    let mut index = 0usize;
+    for line in stdin.lock().lines() {
+        if line.as_ref().is_ok_and(|text| text.trim().is_empty()) {
+            continue;
+        }
+        let can_continue = batch_read_can_continue(&line);
+        // Keep `error` a string for existing batch clients; the additive kind
+        // lets callers distinguish a configuration failure without parsing it.
+        let verdict = serde_json::json!({
+            "index": index,
+            "decision": "deny",
+            "error_kind": "configuration_error"
```

**File**: `src/config.rs` (modified, +235/-70)
```diff
@@ -61,50 +61,89 @@ pub(crate) enum ConfigSource {
 /// the subsequent read and prevents a FIFO from wedging the hook before its
 /// file type can be rejected.
 pub(crate) fn read_config_file_bounded(path: &Path, source: ConfigSource) -> Option<String> {
+    read_config_file_result(path, source).ok()
+}
+
+/// Preserve the outcome of the actual open/read. A later filesystem restat is
+/// useful for diagnostics, but must not decide whether required policy vanished.
+#[derive(Debug)]
+enum ConfigReadFailure {
+    Missing,
+    #[cfg_attr(unix, allow(dead_code))]
+    Unsupported,
+    Rejected(String),
+    Content(String),
+}
+
+impl ConfigReadFailure {
+    fn blocks_trusted_layer(&self, source: ConfigSource, layer: ConfigFileLayer) -> bool {
+        if source == ConfigSource::AutoProject {
+            return false;
+        }
+        match self {
+            Self::Missing => layer == ConfigFileLayer::Explicit,
+            Self::Unsupported => false,
+            // A system path that failed its ownership/path trust checks is not
+            // administrator policy. Keep ignoring it, including on Windows.
+            Self::Rejected(_) => source == ConfigSource::Untrusted,
+            // Content failures occur AFTER the source's handle was validated.
+            Self::Content(_) => true,
+        }
+    }
+
+    fn detail(&self) -> &str {
+        match self {
+            Self::Missing => "the explicitly selected configuration file does not exist",
+            Self::Unsupported => "this configuration source is unsupported on this platform",
+            Self::Rejected(detail) | Self::Content(detail) => detail,
+        }
+    }
+}
+
+fn read_config_file_result(path: &Path, source: ConfigSource) -> Result<String, ConfigReadFailure> {
     #[cfg(not(unix))]
     if non_unix_source_is_unsupported(source) {
         warn_and_ignore_non_unix_restricted_config(path, source);
-        return None;
+        return Err(ConfigReadFailure::Unsupported);
     }
 
     let mut file = match open_config_file_for_source(path, source) {
-        Ok(f) => f,
-        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return None,
-        Err(e) => {
+        Ok(file) => file,
+        Err(error) if error.kind() == io::ErrorKind::NotFound => {
+            return Err(ConfigReadFailure::Missing);
+        }
+        Err(error) => {
             crate::emit_stderr!(
                 "Warning: refusing to load config file '{}': {}",
                 path.display(),
-                e
+                error
             );
-            return None;
+            return Err(ConfigReadFailure::Rejected(error.to_string()));
         }
     };
-
-    // `take(MAX_CONFIG_BYTES + 1)` lets us tell "exactly cap" (allowed) from
-    // "more than cap" (rejected) without reading unbounded bytes either way.
-    let mut buf = String::new();
-    if let Err(e) = file
+    let mut content = String::new();
+    if let Err(error) = file
         .by_ref()
         .take(MAX_CONFIG_BYTES + 1)
-        .read_to_string(&mut buf)
+        .read_to_string(&mut content)
     {
         crate::emit_stderr!(
             "Warning: Failed to read config file '{}': {}",
             path.display(),
-            e
+            error
         );
-        return None;
+        return Err(ConfigReadFailure::Content(error.to_string()));
     }
-    if buf.len() as u64 > MAX_CONFIG_BYTES {
+    if content.len() as u64 > MAX_CONFIG_BYTES {
+        let detail = format!("configuration exceeds the {MAX_CONFIG_BYTES}-byte limit");
         crate::emit_stderr!(
-            "Warning: refusing to load config '{}' — exceeds {}-byte cap",
+            "Warning: refusing to load config '{}': {}",
             path.display(),
-            MAX_CONFIG_BYTES
+            detail
         );
-        return None;
+        return Err(ConfigReadFailure::Content(detail));
     }
-
-    Some(buf)
+    Ok(content)
 }
 
 /// Render a TOML error from an automatically discovered repository config
@@ -2982,6 +3021,12 @@ pub fn take_rule_target_suppressions() -> Vec<RuleTargetSuppression> {
 #[derive(Debug, Clone, Default, Serialize, Deserialize, schemars::JsonSchema)]
 #[serde(default)]
 pub struct OverridesConfig {
+    /// Runtime-only failure of a required trusted config layer (#568).
+    /// Neither TOML nor an automatic project policy can manufacture or clear it.
+    #[serde(skip)]
+    #[schemars(skip)]
+    pub configuration_error: Option<String>,
+
     /// Patterns to allow that would otherwise be blocked.
     #[serde(default)]
     pub allow: Vec<AllowOverride>,
@@ -3834,6 +3879,8 @@ impl CompiledBlockOverride {
 /// evaluations. It eliminates per-command regex compilation overhead.
 #[derive(Debug, Default)]
 pub struct CompiledOverrides {
+    /// Fatal trusted-config failure, checked before every authorization path.
+    pub configuration_error: Option<String>,
     /// Compiled allow overrides.
     pub allow: Vec<CompiledAllowOverride>,
     /// Com
```

**File**: `src/config_load_regression_tests.rs` (added, +187/-0)
```diff
@@ -0,0 +1,187 @@
+//! Regression coverage for loss of trusted policy on config errors (#568).
+use super::*;
+use crate::allowlist::LayeredAllowlist;
+use crate::evaluator::{EvaluationDecision, evaluate_command_with_pack_order};
+
+fn load(path: &Path, source: ConfigSource, layer: ConfigFileLayer) -> Option<ConfigLayer> {
+    Config::load_layer_from_file_with_outcome(
+        path,
+        source,
+        layer,
+        if source == ConfigSource::AutoProject {
+            ConfigFileAuthority::EnforcementOnly
+        } else {
+            ConfigFileAuthority::Full
+        },
+        false,
+    )
+    .0
+}
+
+#[test]
+fn malformed_trusted_layers_retain_errors_without_diagnostic_tracing() {
+    let dir = tempfile::tempdir().unwrap();
+    let path = dir.path().join("config.toml");
+    for content in [
+        "[general",
+        "[policy.rules]\n\"core.git:reset-hard\" = \"not-a-mode\"",
+    ] {
+        fs::write(&path, content).unwrap();
+        for layer in [ConfigFileLayer::User, ConfigFileLayer::Explicit] {
+            let mut config = Config::default();
+            config.merge_layer(load(&path, ConfigSource::Untrusted, layer).unwrap());
+            let reason = config.configuration_error().unwrap();
+            assert!(reason.contains("config.toml"));
+            assert!(reason.contains("line"));
+            assert!(reason.contains("dcg doctor --strict"));
+            assert!(config.is_fail_closed());
+            assert!(config.unverified_denies());
+        }
+    }
+}
+
+#[test]
+fn missing_optional_sources_are_not_missing_explicit_sources() {
+    let dir = tempfile::tempdir().unwrap();
+    let path = dir.path().join("absent.toml");
+    assert!(load(&path, ConfigSource::Untrusted, ConfigFileLayer::User).is_none());
+    assert!(load(&path, ConfigSource::System, ConfigFileLayer::System).is_none());
+    assert!(
+        load(
+            &path,
+            ConfigSource::AutoProject,
+            ConfigFileLayer::AutomaticProject
+        )
+        .is_none()
+    );
+    let mut config = Config::default();
+    config.merge_layer(load(&path, ConfigSource::Untrusted, ConfigFileLayer::Explicit).unwrap());
+    assert!(
+        config
+            .configuration_error()
+            .unwrap()
+            .contains("does not exist")
+    );
+}
+
+#[test]
+fn trusted_read_failures_cannot_fall_back_to_defaults() {
+    let dir = tempfile::tempdir().unwrap();
+    let path = dir.path().join("config.toml");
+    for content in [vec![0xff, 0xfe], vec![b' '; MAX_CONFIG_BYTES as usize + 1]] {
+        fs::write(&path, content).unwrap();
+        let mut config = Config::default();
+        config.merge_layer(load(&path, ConfigSource::Untrusted, ConfigFileLayer::User).unwrap());
+        assert!(config.configuration_error().is_some());
+        assert!(
+            load(
+                &path,
+                ConfigSource::AutoProject,
+                ConfigFileLayer::AutomaticProject
+            )
+            .is_none()
+        );
+    }
+}
+
+#[test]
+fn system_trust_rejection_and_post_validation_content_failure_are_distinct() {
+    let rejected = ConfigReadFailure::Rejected("untrusted ownership".into());
+    assert!(!rejected.blocks_trusted_layer(ConfigSource::System, ConfigFileLayer::System));
+    assert!(rejected.blocks_trusted_layer(ConfigSource::Untrusted, ConfigFileLayer::User));
+    let unreadable = ConfigReadFailure::Content("invalid UTF-8 after trusted open".into());
+    assert!(unreadable.blocks_trusted_layer(ConfigSource::System, ConfigFileLayer::System));
+    assert!(
+        !unreadable
+            .blocks_trusted_layer(ConfigSource::AutoProject, ConfigFileLayer::AutomaticProject)
+    );
+}
+
+#[test]
+fn later_allow_policy_cannot_erase_a_required_layer_failure() {
+    let mut config = Config::default();
+    config.merge_layer(Config::failed_config_layer(
+        Path::new("admin.toml"),
+        "invalid policy",
+    ));
+    config.merge_layer(
+        toml::from_str::<ConfigLayer>(
+            "[overrides]\nallow = [\".*\"]\n[policy]\ndefault_mode = \"log\"",
+        )
+        .unwrap(),
+    );
+    let compiled = config.overrides.compile();
+    assert!(compiled.check_allow("git reset --hard"));
+    for command in ["", "git status", "printf dcg-protected", "git reset --hard"] {
+        let result = evaluate_command_with_pack_order(
+            command,
+            &[],
+            &[],
+            None,
+            &compiled,
+            &LayeredAllowlist::default(),
+            &HeredocSettings::default(),
+        );
+        assert_eq!(result.decision, EvaluationDecision::Deny, "{command}");
+        assert!(result.reason().unwrap().contains("admin.toml"));
+        assert!(!result.quick_rejected);
+    }
+}
+
+#[test]
+fn automatic_malformed_policy_is_ignored_not_promoted_to_global_failure() {
+    let dir = tempfile::tempdir().unwrap();
+    let path = dir.path().join(".dcg.toml");
+    fs::write(
+        &path,
+        
```

**File**: `src/evaluator.rs` (modified, +10/-0)
```diff
@@ -14079,6 +14079,11 @@ fn evaluate_command_with_pack_order_deadline_at_path_inner(
     nested_command_depth: usize,
     inherited_automated_stdin: bool,
 ) -> EvaluationResult {
+    // Required trusted policy must be intact before any authorization path (#568).
+    if let Some(reason) = compiled_overrides.configuration_error.as_deref() {
+        return EvaluationResult::denied_by_config(reason.to_string());
+    }
+
     let scope = crate::packs::regex_engine::RegexEvaluationScope::enter();
     let mut result = evaluate_command_in_dialect_union(
         command,
@@ -30668,6 +30673,11 @@ where
     S: LegacySafePattern,
     D: LegacyDestructivePattern,
 {
+    // Required trusted policy must be intact before any authorization path (#568).
+    if let Some(reason) = compiled_overrides.configuration_error.as_deref() {
+        return EvaluationResult::denied_by_config(reason.to_string());
+    }
+
     // Empty commands are allowed (no-op)
     if command.is_empty() {
         return EvaluationResult::allowed();
```

---

### Incident Patch 2: `450a2897` (2026-10-14)
**Commit Message**: fix(omp): honor strict unverified posture on missing verdicts and beat host timeout

Close the #564 fail-open path in the generated OMP bridge. An exit code
0 or 2 without an explicit parseable robot allow verdict is now an
infrastructure failure, not an unconditional allow. Empty, malformed and
unknown stdout always produce a diagnostic and pass through the configured
DCG_UNVERIFIED_DECISION posture. Preserve valid JSON allows, blocking
witnesses, exit-one blocks, signal/crash handling and stdout-only authority.

Fix #563: lower the child's parent timeout to 25 seconds, with 250 ms
pipe-drain grace terms bringing the observation watchdog to 25.5 seconds.
Keep 4.5 seconds of headroom under OMP's default 30-second tool_call
handler ceiling, and encode a >=4-second margin assertion.

Update the existing transition and generated-bridge regression oracles,
retain the single-cell deny-to-allow mutation witness, and add eight
mocked OMP callback replay cases for default visible failures and strict
blocks on 0/2 x empty/malformed/unknown outputs. Preserve native stdout
and stderr roles and all other outcome cells.

Validation: source-level comparison and complete 42-cell transition matrix

**File**: `src/cli.rs` (modified, +76/-22)
```diff
@@ -15516,9 +15516,11 @@ pub(crate) const OMP_EXTENSION_MARKER: &str = "dcg-omp-extension";
 ///
 /// dcg's ordinary evaluator deadline is 1 second and the broad Windows preset
 /// defaults to 3 seconds, but an operator may configure a larger deadline.
-/// Keep this pathological-hang backstop generous enough not to compete with
-/// those evaluator budgets while still bounding a wedged child at the bridge.
-pub(crate) const OMP_CHILD_EVALUATION_TIMEOUT_MS: u64 = 30_000;
+/// Keep this pathological-hang backstop generous enough for those budgets,
+/// but shorter than OMP's default 30-second tool_call handler deadline. Its
+/// own watchdog must fire first so an operator sees dcg's failure diagnostic
+/// rather than a generic host handler timeout (#563).
+pub(crate) const OMP_CHILD_EVALUATION_TIMEOUT_MS: u64 = 25_000;
 
 /// Maximum time to drain stdout/stderr after Bun reports child termination.
 ///
@@ -15533,7 +15535,8 @@ pub(crate) const OMP_CHILD_PIPE_DRAIN_GRACE_MS: u64 = 250;
 /// Bun's native child timeout normally settles first. The extra two drain
 /// windows cover signal/reap propagation plus one bounded post-exit drain; if
 /// the exit capability itself never settles, this outer watchdog still closes
-/// the local observation boundary.
+/// the local observation boundary. Total is 25_500 ms, leaving 4_500 ms for
+/// the handler to finish under OMP's default 30_000 ms ceiling.
 pub(crate) const OMP_CHILD_OBSERVATION_TIMEOUT_MS: u64 =
     OMP_CHILD_EVALUATION_TIMEOUT_MS + 2 * OMP_CHILD_PIPE_DRAIN_GRACE_MS;
 
@@ -15868,12 +15871,15 @@ const DCG_OBSERVATION_ABORTED = Symbol("dcg-child-observation-aborted");
 // that the unverified posture may still turn into a block. A dcg that started
 // and then died (a signal, or an exit status dcg never uses for a verdict)
 // without a blocking verdict is a "crash": it blocks unless
-// DCG_BRIDGE_CRASH_DECISION=allow.
+// DCG_BRIDGE_CRASH_DECISION=allow. Exit 0/2 with empty, malformed or unknown
+// stdout is UNVERIFIED, not an allow: only an explicit robot JSON allow is
+// proof of a clean decision. The infrastructure row logs the failure and
+// honors DCG_UNVERIFIED_DECISION=deny (#564).
 const DCG_CHILD_TRANSITIONS: Record<DcgChildOutcome, Record<DcgParsedVerdict, DcgBridgeAction>> = {{
   "spawn-throw": {{ empty: "infrastructure", malformed: "infrastructure", allow: "infrastructure", deny: "block", ask: "block", indeterminate: "block", unknown: "infrastructure" }},
-  "exit-0": {{ empty: "allow", malformed: "allow", allow: "allow", deny: "block", ask: "block", indeterminate: "block", unknown: "allow" }},
+  "exit-0": {{ empty: "infrastructure", malformed: "infrastructure", allow: "allow", deny: "block", ask: "block", indeterminate: "block", unknown: "infrastructure" }},
   "exit-1": {{ empty: "block", malformed: "block", allow: "block", deny: "block", ask: "block", indeterminate: "block", unknown: "block" }},
-  "exit-2": {{ empty: "allow", malformed: "allow", allow: "allow", deny: "block", ask: "block", indeterminate: "block", unknown: "allow" }},
+  "exit-2": {{ empty: "infrastructure", malformed: "infrastructure", allow: "allow", deny: "block", ask: "block", indeterminate: "block", unknown: "infrastructure" }},
   "exit-other": {{ empty: "crash", malformed: "crash", allow: "crash", deny: "block", ask: "block", indeterminate: "block", unknown: "crash" }},
   "signal": {{ empty: "crash", malformed: "crash", allow: "crash", deny: "block", ask: "block", indeterminate: "block", unknown: "crash" }},
 }};
@@ -24859,9 +24865,14 @@ if ($errors.Count -ne 0) {
                     > crate::perf::CAREFUL_COMPANY_HOOK_EVALUATION_BUDGET_MS,
                 "the bridge backstop must leave headroom above the largest shipped evaluator default"
             );
+            // OMP's default tool_call timeout is 30_000ms; reserve at least
+            // four seconds for the extension to finish after its watchdog.
+            const OMP_DEFAULT_HANDLER_TIMEOUT_MS: u64 = 30_000;
+            const REQUIRED_HANDLER_MARGIN_MS: u64 = 4_000;
             assert!(
-                OMP_CHILD_EVALUATION_TIMEOUT_MS <= 60_000,
-                "a wedged evaluator must not stall an OMP bash call for more than one minute"
+                OMP_CHILD_OBSERVATION_TIMEOUT_MS + REQUIRED_HANDLER_MARGIN_MS
+                    <= OMP_DEFAULT_HANDLER_TIMEOUT_MS,
+                "the generated guard watchdog must beat OMP's host handler timeout"
             );
         }
         assert!(source.contains(&format!(
@@ -25256,9 +25267,9 @@ if ($errors.Count -ne 0) {
         assert!(source.contains("const DCG_CHILD_TRANSITIONS:"));
         for row in [
             r#""spawn-throw": { empty: "infrastructure", malformed: "infrastructure", allow: "infrastructure", deny: "block", ask: "block", indeterminate: "block", unknown: "infrastructure" }"#,
-            r#""exit-0": { empty: "allow", malformed: "allow", allow: "allow", deny: "block", ask: "block", indeterminate: "block", unknown
```

---

### Incident Patch 3: `dec8bcb4` (2026-10-14)
**Commit Message**: fix(python): apply rmtree policy to static reflective invocations

The default receiver pattern does not match immediate invocations through
getattr, module __dict__ lookup, or rmtree.__call__. Add fourteen structural
forms covering literal member names, both quote styles, qualified getter
calls and a grouped callee. Reuse the registered recursive-deletion rule
and its outer-call target refinement rather than harvesting receiver data.

Compose these findings in the default CLI/hook matcher, deduplicate only
supplemental findings, retain source order, and apply the existing tempfile
factory/dependency proof to the combined results. Use remaining explicit
budgets and propagate incomplete supplemental analysis as an error, not an
empty success. Keep custom corpora, core path policy and #560 source views
unchanged. This does not resolve dynamic names or captured default aliases.

Add 36 shared fixtures (23 deny, 13 allow), three unit tests and two tests
in the existing hermetic CLI/hook harness. Four Python launch forms define
288 new authored CLI/hook verdict checks. All existing fixtures/tests remain.

Validation performed: official native ast-grep 0.45.3 (matching DCG's
locked core 

**File**: `src/ast_matcher.rs` (modified, +168/-4)
```diff
@@ -47,12 +47,12 @@ impl DefaultPolicyMatcher {
         language: ScriptLanguage,
     ) -> Result<Vec<PatternMatch>, MatchError> {
         let matches = source_analysis::DEFAULT_MATCHER.find_matches(code, language)?;
-        Ok(tempfile_provenance::validate(
+        complete_python_deletion_matches(
             code,
             language,
             matches,
             source_analysis::protected_scan_budget(),
-        ))
+        )
     }
 
     /// Match source with an explicit budget. The producer proof uses only the
@@ -70,12 +70,12 @@ impl DefaultPolicyMatcher {
         let started = Instant::now();
         let matches = source_analysis::DEFAULT_MATCHER
             .find_matches_with_timeout(code, language, timeout)?;
-        Ok(tempfile_provenance::validate(
+        complete_python_deletion_matches(
             code,
             language,
             matches,
             timeout.saturating_sub(started.elapsed()),
-        ))
+        )
     }
 
     /// Return the first blocking match from the complete default policy.
@@ -88,6 +88,90 @@ impl DefaultPolicyMatcher {
     }
 }
 
+// These are invocations of a statically named deletion member, not mere
+// lookups. Keep both quote spellings explicit: matching must not depend on a
+// grammar's treatment of quote tokens. Like the existing $M.rmtree pattern,
+// the receiver is deliberately not restricted to one module variable name.
+const PYTHON_REFLECTIVE_DELETE_CALLEES: [&str; 7] = [
+    "getattr($M, 'rmtree')",
+    "getattr($M, \"rmtree\")",
+    "$B.getattr($M, 'rmtree')",
+    "$B.getattr($M, \"rmtree\")",
+    "$M.__dict__['rmtree']",
+    "$M.__dict__[\"rmtree\"]",
+    "$M.rmtree.__call__",
+];
+
+static PYTHON_REFLECTIVE_DELETE_MATCHER: LazyLock<AstMatcher> = LazyLock::new(|| {
+    // Reuse the registered rule, including its target refinement, rather than
+    // harvesting a receiver's first literal ('rmtree') as the deletion path.
+    // Explicit user-created AstMatcher corpora remain unchanged.
+    let meta = source_analysis::default_patterns()
+        .remove(&ScriptLanguage::Python)
+        .and_then(|patterns| {
+            patterns
+                .into_iter()
+                .find(|meta| meta.rule_id == "heredoc.python.shutil_rmtree")
+        })
+        .expect("the default Python corpus registers its recursive-deletion rule");
+    let mut patterns = Vec::new();
+    for callee in PYTHON_REFLECTIVE_DELETE_CALLEES {
+        for pattern in [format!("{callee}($$$)"), format!("({callee})($$$)")] {
+            let mut pattern_meta = meta.clone();
+            pattern_meta.pattern_str = pattern;
+            patterns.push(pattern_meta);
+        }
+    }
+    AstMatcher::with_patterns(std::collections::HashMap::from([(
+        ScriptLanguage::Python,
+        patterns,
+    )]))
+});
+
+fn complete_python_deletion_matches(
+    code: &str,
+    language: ScriptLanguage,
+    mut matches: Vec<PatternMatch>,
+    budget: Duration,
+) -> Result<Vec<PatternMatch>, MatchError> {
+    let started = Instant::now();
+    if language == ScriptLanguage::Python
+        && code.contains("rmtree")
+        && ["getattr", "__dict__", "__call__"]
+            .iter()
+            .any(|name| code.contains(name))
+    {
+        // The ordinary AST worker supplies byte bounds, cancellation and the
+        // error contract. An incomplete extra scan is not an empty success.
+        let extra = PYTHON_REFLECTIVE_DELETE_MATCHER.find_matches_with_timeout(
+            code,
+            language,
+            budget.saturating_sub(started.elapsed()),
+        )?;
+        let mut seen: std::collections::HashSet<_> = matches
+            .iter()
+            .map(|hit| (hit.start, hit.end, hit.rule_id.clone()))
+            .collect();
+        for hit in extra {
+            if seen.insert((hit.start, hit.end, hit.rule_id.clone())) {
+                matches.push(hit);
+            }
+        }
+        // Keep the original finding's precedence on a tie. The supplemental
+        // corpus also resolves imported aliases; do not duplicate those hits.
+        matches.sort_by_key(|hit| hit.start);
+    }
+    // A reflected call gets exactly the existing descendant and factory
+    // policies. New .temp matches must not bypass factory/dependency proofs.
+    // Share the remaining budget; do not grant the proof a fresh deadline.
+    Ok(tempfile_provenance::validate(
+        code,
+        language,
+        matches,
+        budget.saturating_sub(started.elapsed()),
+    ))
+}
+
 /// Recover literal shell values only from source with execution evidence.
 ///
 /// #560 was caused by promoting every unowned string containing backticks or
@@ -299,6 +383,86 @@ fn literal_execution_name(name: &str) -> bool {
 mod literal_execution_evidence_tests {
     use super::*;
 
+    #[test]
+    fn python_reflective_rmtree_uses_the_existing_path_policy() {
+        #[derive(serde::Deserialize)]
+        struct Case {
+            id: Strin
```

**File**: `tests/fixtures/python_reflective_rmtree.json` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+[
+  {"id":"getattr_single_root","decision":"deny","source":"import shutil\ngetattr(shutil, 'rmtree')('/tmp')"},
+  {"id":"getattr_double_root","decision":"deny","source":"import shutil\ngetattr(shutil, \"rmtree\")('/tmp')"},
+  {"id":"qualified_getattr_single_root","decision":"deny","source":"import builtins, shutil\nbuiltins.getattr(shutil, 'rmtree')('/tmp')"},
+  {"id":"qualified_getattr_double_root","decision":"deny","source":"import builtins, shutil\nbuiltins.getattr(shutil, \"rmtree\")('/tmp')"},
+  {"id":"dictionary_single_root","decision":"deny","source":"import shutil\nshutil.__dict__['rmtree']('/tmp')"},
+  {"id":"dictionary_double_root","decision":"deny","source":"import shutil\nshutil.__dict__[\"rmtree\"]('/tmp')"},
+  {"id":"dunder_call_root","decision":"deny","source":"import shutil\nshutil.rmtree.__call__('/tmp')"},
+  {"id":"grouped_getattr_single_root","decision":"deny","source":"import shutil\n(getattr(shutil, 'rmtree'))('/tmp')"},
+  {"id":"grouped_getattr_double_root","decision":"deny","source":"import shutil\n(getattr(shutil, \"rmtree\"))('/tmp')"},
+  {"id":"grouped_qualified_getattr_single_root","decision":"deny","source":"import builtins, shutil\n(builtins.getattr(shutil, 'rmtree'))('/tmp')"},
+  {"id":"grouped_qualified_getattr_double_root","decision":"deny","source":"import builtins, shutil\n(builtins.getattr(shutil, \"rmtree\"))('/tmp')"},
+  {"id":"grouped_dictionary_single_root","decision":"deny","source":"import shutil\n(shutil.__dict__['rmtree'])('/tmp')"},
+  {"id":"grouped_dictionary_double_root","decision":"deny","source":"import shutil\n(shutil.__dict__[\"rmtree\"])('/tmp')"},
+  {"id":"grouped_dunder_call_root","decision":"deny","source":"import shutil\n(shutil.rmtree.__call__)('/tmp')"},
+  {"id":"getattr_single_child","decision":"allow","source":"import shutil as fs\ngetattr(fs, 'rmtree')('/tmp/build')"},
+  {"id":"getattr_double_child","decision":"allow","source":"import shutil as fs\ngetattr(fs, \"rmtree\")('/tmp/build')"},
+  {"id":"qualified_getattr_single_child","decision":"allow","source":"import builtins as b, shutil as fs\nb.getattr(fs, 'rmtree')('/tmp/build')"},
+  {"id":"qualified_getattr_double_child","decision":"allow","source":"import builtins as b, shutil as fs\nb.getattr(fs, \"rmtree\")('/tmp/build')"},
+  {"id":"dictionary_single_child","decision":"allow","source":"import shutil as fs\nfs.__dict__['rmtree']('/tmp/build')"},
+  {"id":"dictionary_double_child","decision":"allow","source":"import shutil as fs\nfs.__dict__[\"rmtree\"]('/tmp/build')"},
+  {"id":"dunder_call_child","decision":"allow","source":"import shutil as fs\nfs.rmtree.__call__('/tmp/build')"},
+  {"id":"var_tmp_root_alias","decision":"deny","source":"import shutil\ngetattr(shutil, 'rmtree')('/var//tmp/.')"},
+  {"id":"private_tmp_root_alias","decision":"deny","source":"import shutil\nshutil.__dict__['rmtree']('/private/./tmp/')"},
+  {"id":"private_var_tmp_root_alias","decision":"deny","source":"import shutil\nshutil.rmtree.__call__('/private/var/tmp/.')"},
+  {"id":"getattr_root_traversal","decision":"deny","source":"import shutil\ngetattr(shutil, 'rmtree')('/tmp/build/..')"},
+  {"id":"dictionary_sensitive_traversal","decision":"deny","source":"import shutil\nshutil.__dict__['rmtree']('/tmp/build/../../etc')"},
+  {"id":"keyword_root_callback","decision":"deny","source":"import shutil, tempfile\ngetattr(shutil, 'rmtree')(path='/tmp/', onerror=lambda *args: tempfile.mkdtemp())"},
+  {"id":"receiver_literal_cannot_exempt_root","decision":"deny","source":"import shutil\ndef receiver(value):\n    return shutil\ngetattr(receiver('/tmp/build'), 'rmtree')('/tmp')"},
+  {"id":"reflected_spoofed_factory","decision":"deny","source":"import shutil\ndef mkdtemp():\n    return '/tmp'\ngetattr(shutil, 'rmtree')(mkdtemp())"},
+  {"id":"dunder_call_genuine_factory","decision":"allow","source":"import shutil, tempfile\nshutil.rmtree.__call__(tempfile.mkdtemp())"},
+  {"id":"lookup_without_invocation","decision":"allow","source":"import shutil\ncleanup = getattr(shutil, 'rmtree')"},
+  {"id":"dictionary_without_invocation","decision":"allow","source":"import shutil\ncleanup = shutil.__dict__['rmtree']"},
+  {"id":"inert_reflected_call_text","decision":"allow","source":"print(\"getattr(shutil, 'rmtree')('/tmp')\")"},
+  {"id":"inert_reflected_call_comment","decision":"allow","source":"# shutil.rmtree.__call__('/tmp')\nprint('ready')"},
+  {"id":"safe_sibling_cannot_exempt_reflected_root","decision":"deny","source":"import shutil\nshutil.rmtree('/tmp/build')\ngetattr(shutil, 'rmtree')('/tmp')"},
+  {"id":"other_member_is_not_recursive_delete","decision":"allow","source":"import shutil\ngetattr(shutil, 'copy')('/tmp/input', '/tmp/output')"}
+]
```

**File**: `tests/repro_549_tempfile_provenance.rs` (modified, +29/-0)
```diff
@@ -93,6 +93,35 @@ fn check_cases(hook: bool) {
     }
 }
 
+fn check_reflective_cases(hook: bool) {
+    let cases: Vec<Case> = serde_json::from_str(include_str!(
+        "fixtures/python_reflective_rmtree.json"
+    ))
+    .expect("valid reflective-deletion fixtures");
+    assert!(!cases.is_empty());
+    for case in cases {
+        let quoted = format!("'{}'", case.source.replace('\'', "'\\''"));
+        for command in [
+            format!("python3 -c {quoted}"),
+            format!("python3 -I -c {quoted}"),
+            format!("python3 - <<'PY'\n{}\nPY", case.source),
+            format!("python3 -I - <<'PY'\n{}\nPY", case.source),
+        ] {
+            assert_verdict(&case, &command, hook);
+        }
+    }
+}
+
+#[test]
+fn reflective_rmtree_cli_verdicts() {
+    check_reflective_cases(false);
+}
+
+#[test]
+fn reflective_rmtree_hook_verdicts() {
+    check_reflective_cases(true);
+}
+
 #[test]
 fn tempfile_provenance_cli_verdicts() {
     check_cases(false);
```

#### Recent Merged Pull Requests:
- **PR #559** (closed): deps(deps): bump ast-grep-core from 0.45.3 to 0.50.0 (@dependabot[bot])
- **PR #557** (2026-10-14): deps(deps): bump the rust-minor-patch group with 3 updates (@dependabot[bot])
- **PR #556** (2026-10-14): ci(deps): bump dtolnay/rust-toolchain from 7e38f4b43b4db5c8dd498af069a4f6196df1d067 to e2a55d2ffb04f378e9626c28d38b36d230d1e12f in the actions group (@dependabot[bot])
- **PR #535** (2026-10-05): ci(deps): bump dtolnay/rust-toolchain from 02cb101ec7c40f2c49e1d9714d64511d8e1b74de to 7e38f4b43b4db5c8dd498af069a4f6196df1d067 in the actions group (@dependabot[bot])
- **PR #507** (2026-09-28): deps(deps): bump the rust-minor-patch group with 2 updates (@dependabot[bot])
- **PR #506** (2026-09-28): ci(deps): bump the actions group with 2 updates (@dependabot[bot])

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

## X. config): preserve trusted-policy failures and restore verified #568 publication

**RULE**:
When implementing operations in `.github/patches/config-load-568.patch`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Dicklesworthstone/destructive_command_guard. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5b1d5bf3`: config): preserve trusted-policy failures and restore verified #568 publication. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/patches/config-load-568.patch`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
diff --git a/src/config.rs b/src/config.rs
--- a/src/config.rs
@@ -61,50 +61,89 @@
 /// the subsequent read and prevents a FIFO from wedging the hook before its
 /// file type can be rejected.
 pub(crate) fn read_config_file_bounded(path: &Path, source: ConfigSource) -> Option<String> {
+    read_config_file_result(path, source).ok()
+}
+
+/// Preserve the outcome of the actual open/read. A later filesystem restat is
+/// useful for diagnostics, but must not decide whether required policy vanished.
+#[derive(Debug)]
+enum ConfigReadFailure {
+    Missing,
+    #[cfg_attr(unix, allow(dead_code))]
+    Unsupported,
+    Rejected(String),
+    Content(String),
+}
+
+impl ConfigReadFailure {
+    fn blocks_trusted_layer(&self, source: ConfigSource, layer: ConfigFileLayer) -> bool {
+        if source == ConfigSource::AutoProject {
+            return false;
+        }
+        match self {
+            Self::Missing => layer == ConfigFileLayer::Explicit,
+            Self::Unsupported => false,
+            // A system path that failed its ownership/path trust checks is not
+            // administrator policy. Keep ignoring it, including on Windows.
+            Self::Rejected(_) => s
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5b1d5bf3` are properly handled with clean fallback behavior.
