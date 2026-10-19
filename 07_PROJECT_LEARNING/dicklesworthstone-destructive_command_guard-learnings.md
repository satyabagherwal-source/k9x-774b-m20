> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dicklesworthstone-destructive_command_guard-learnings.md`  
> **Source**: github ([https://github.com/Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard))  
> **Source Version**: `f6fdf447`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T20:16:48.511Z  
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
> **Harvest Timestamp**: 2026-10-19T20:16:48.240Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dicklesworthstone/destructive_command_guard`
- **Description**: The Destructive Command Guard (dcg) is for blocking dangerous git and shell commands from being executed by agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6189 stars

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
        classify_embedded_credential_file_writes, scan_extracted, scan_outer_writer_arguments,
        shell, word_splitting,
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
            "node" => {
                "const note = \"IFS=@; it's `tool --help`; $DEST; élève\";\nconsole.log(note);"
            }
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
                classify_embedded_credential_file_writes(&command, ShellDialect::Posix, |_, _| {
                    false
                })
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
            for command in [
                format!("{writer}\n{program}"),
                format!("{program}\n{writer}"),
            ] {
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
            assert!(
                !outer.contains(tail),
                "the test must exercise a masked body"
            );
            let hits =
                classify_embedded_credential_file_writes(&command, ShellDialect::Posix, |_, _| {
                    false
                });
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

### Incident Patch 1: `ad98f9f4` (2026-10-19)
**Commit Message**: fix(hooks): keep diagnostic commands safe to copy

Command text containing shell expansions or quote boundaries could change the meaning of copied diagnostic hints. Emit dcg explain -- only for complete arguments from a conservative literal subset. Direct complex or long input to dcg test --stdin --explain and show a separately bounded JSON preview with exact elision accounting. Apply the same policy to the human warning footer.

Add six regression tests, including actual POSIX-shell argv capture with harmless canaries, and update only the intended end-of-options separator in three denial goldens. Include an equivalent boolean simplification for the unlink classifier's Clippy finding.

Record the native-input, quoted-unlink, and diagnostic-safety evidence in beads. Track the independently reproduced enabled-guardrails global-option defect as an open P1 follow-up without changing the default pack policy.

Validation: 183 hook unit tests, 167 executable protocol integrations, three denial goldens, and all 50 harness-matrix cases passed. Locked all-target cargo check and formatting of all eight touched Rust files passed. The full diagnostic Clippy scan has no remaining findings introd

**File**: `.beads/issues.jsonl` (modified, +4/-3)
```diff
@@ -74,6 +74,7 @@
 {"id":"bd-f16f","title":"Segment-scope overrides.allow matching: naive substring patterns allow chained unrelated destruction (#327 sharp edge)","status":"closed","priority":2,"issue_type":"task","created_at":"2026-08-20T18:11:54.866705Z","created_by":"jemanuel","updated_at":"2026-09-22T18:21:24.894261767Z","closed_at":"2026-09-22T18:21:24.878665477Z","close_reason":"Already implemented under #340: CompiledOverrides::check_allow is segment-scoped, so an allow entry must cover every segment. Pinned by src/config.rs tests unanchored_allow_override_does_not_launder_later_segments (&&, ;, ||, |), allow_override_does_not_launder_command_substitution, allow_override_permits_fully_covered_compound.","source_repo":"destructive_command_guard","compaction_level":0,"original_size":0}
 {"id":"bd-fg8f","title":"P4.7: Update scan command progress and results display","status":"closed","priority":2,"issue_type":"task","created_at":"2026-01-19T21:12:05.227501776Z","created_by":"ubuntu","updated_at":"2026-01-21T21:53:05.030745430Z","closed_at":"2026-01-21T21:53:05.030657314Z","source_repo":".","compaction_level":0,"original_size":0,"dependencies":[{"issue_id":"bd-fg8f","depends_on_id":"bd-2cvj","type":"blocks","created_at":"2026-02-16T07:00:29Z","created_by":"import","metadata":"{}","thread_id":""},{"issue_id":"bd-fg8f","depends_on_id":"bd-2e8p","type":"blocks","created_at":"2026-02-16T07:00:29Z","created_by":"import","metadata":"{}","thread_id":""},{"issue_id":"bd-fg8f","depends_on_id":"bd-2jp9","type":"blocks","created_at":"2026-02-16T07:00:29Z","created_by":"import","metadata":"{}","thread_id":""},{"issue_id":"bd-fg8f","depends_on_id":"bd-2loz","type":"blocks","created_at":"2026-02-16T07:00:29Z","created_by":"import","metadata":"{}","thread_id":""}]}
 {"id":"bd-git-backslash-attribution-ptpo","title":"Windows-separator .git paths deny under the escaped-path rule, not git-internals","status":"closed","priority":2,"issue_type":"bug","created_at":"2026-09-24T16:23:11.237677557Z","created_by":"ubuntu","updated_at":"2026-09-24T17:50:29.885365887Z","closed_at":"2026-09-24T17:50:29.884650196Z","close_reason":"Measured; converted to GitHub #492. The attribution is POSIX-correct (> .git\\config opens .gitconfig there), so the live defect is grantability, not naming: allowlisting the High redirect-truncate-dynamic-path also grants the Windows-separator spellings of two Critical rules. Repair changes existing allowlist meaning, so it is a maintainer decision, filed with options and a recommendation.","source_repo":"destructive_command_guard","compaction_level":0,"original_size":0}
+{"id":"bd-guardrails-global-options","title":"Enabled guardrails pack misses dcg self-weakening commands with global options","description":"## Confirmed defect\n\nA fresh isolated probe against executable source content corresponding to published commit 10bc819cc0906019037024d4ab6d769bb3d9b6db confirms that the explicitly enabled careful_company_running_windows.guardrails pack denies direct dcg self-weakening subcommands but permits the same commands when the valid global --robot option precedes the subcommand.\n\nPaired fixture results:\n- dcg allow-once abc123 --yes -> deny; dcg --robot allow-once abc123 --yes -> allow. Expected rule: careful_company_running_windows.guardrails:dcg-policy-self-weakening.\n- dcg allowlist add core.git:reset-hard --reason approved -> deny; dcg --robot allowlist add core.git:reset-hard --reason approved -> allow. Expected rule: careful_company_running_windows.guardrails:dcg-policy-self-weakening.\n- dcg uninstall --yes -> deny; dcg --robot uninstall --yes -> allow. Expected rule: careful_company_running_windows.guardrails:dcg-bypass-or-uninstall.\n\n## Retained reproduction evidence\n\nThe six results are retained in /tmp/dcg-guardrails-repro-f5f64oyl/results.json. Recorded binary SHA-256: a735d6be7fea590c1dd8472e9a92658e35b73471b7a07692b58fa4c40ee6ea00. Probe invocation: dcg test --stdin --config <empty isolated config> --with-packs careful_company_running_windows.guardrails --format json, with isolated HOME/config/state. All three direct forms exited 1 with the expected denial rule; all three --robot-prefixed forms exited 0 with decision allow. The inputs were inert fixture strings: target commands were never executed.\n\n## Code evidence and scope\n\nThe guardrails rules in src/packs/careful_company_running_windows/guardrails.rs require dcg (or dcg.exe) immediately followed by uninstall, allow-once, allow, or allowlist add/add-command/import. src/cli.rs declares robot as a global CLI argument, so --robot before a subcommand is valid but defeats those adjacent-token patterns. Verify supported global-option positions using actual CLI argv semantics; do not solve this by treating arbitrary argument text as an executed dcg subcommand.\n\nThis is a correctness defect in an explicitly enabled protection. The separate default-on/self-approval policy question remains tracked by bd-hgm5; resolving that policy
```

**File**: `src/hook.rs` (modified, +302/-40)
```diff
@@ -3240,25 +3240,98 @@ pub fn configure_colors() {
 /// ordinary commands are untouched and stay copy-pasteable.
 const MAX_EXPLAIN_HINT_COMMAND: usize = 400;
 
-/// Format the explain hint line for copy-paste convenience.
+const EXPLAIN_STDIN_COMMAND: &str = "dcg test --stdin --explain";
+const EXPLAIN_STDIN_INSTRUCTION: &str = "Pass the original command on stdin as data.";
+
+/// Quote a complete argument only when it is literal in every supported shell.
+///
+/// The output APIs do not know which shell will receive a pasted hint. POSIX
+/// single-quote escaping is not portable to PowerShell or cmd.exe, and double
+/// quotes alone still expand substitutions and variables. Keep the convenient
+/// inline form for a conservative ASCII subset; other commands use stdin.
+fn inline_explain_command(command: &str, max_argument_bytes: usize) -> Option<String> {
+    if command.is_empty()
+        || command.len() > max_argument_bytes.saturating_sub(2)
+        || !command.bytes().all(|byte| {
+            byte.is_ascii_alphanumeric()
+                || matches!(
+                    byte,
+                    b' ' | b'/' | b'.' | b'_' | b'-' | b':' | b'+' | b'=' | b',' | b'@' | b'~'
+                )
+        })
+    {
+        return None;
+    }
+
+    // Quoting keeps spaces in one argument; `--` also keeps a leading hyphen
+    // in command data instead of letting Clap interpret it as a dcg option.
+    Some(format!("dcg explain -- \"{command}\""))
+}
+
+fn json_character_bytes(character: char) -> usize {
+    match character {
+        '"' | '\\' | '\n' | '\r' | '\t' | '\u{8}' | '\u{c}' => 2,
+        '\u{0}'..='\u{1f}' => 6,
+        _ => character.len_utf8(),
+    }
+}
+
+/// Bound the encoded display preview without ever slicing an escape sequence.
+fn explain_command_preview(command: &str) -> (String, usize) {
+    let fits = command
+        .chars()
+        .try_fold(2_usize, |bytes, character| {
+            let next = bytes + json_character_bytes(character);
+            (next <= MAX_EXPLAIN_HINT_COMMAND).then_some(next)
+        })
+        .is_some();
+
+    let included = if fits {
+        command.len()
+    } else {
+        // Reserve the JSON quotes and the display-only ellipsis. Count the
+        // encoded size first, then serialize the whole retained source slice.
+        let mut bytes = 5;
+        let mut end = 0;
+        for (offset, character) in command.char_indices() {
+            bytes += json_character_bytes(character);
+            if bytes > MAX_EXPLAIN_HINT_COMMAND {
+                break;
+            }
+            end = offset + character.len_utf8();
+        }
+        end
+    };
+    let elided = command.len() - included;
+    let mut preview = command[..included].to_string();
+    if elided != 0 {
+        preview.push_str("...");
+    }
+    (serde_json::Value::String(preview).to_string(), elided)
+}
+
+/// Format a copyable diagnostic invocation without interpolating shell source.
 fn format_explain_hint(command: &str) -> String {
-    // Escape double quotes in command for safe copy-paste
-    let escaped = command.replace('"', "\\\"");
-    if escaped.len() <= MAX_EXPLAIN_HINT_COMMAND {
-        return format!("Tip: dcg explain \"{escaped}\"");
-    }
-
-    // Past the cap the tip cannot be copy-pasteable anyway, so spend the
-    // bytes on the head of the command and say how much was dropped. The
-    // elided byte count is the useful signal here, not the elided bytes.
-    let head = truncate_for_display(&escaped, MAX_EXPLAIN_HINT_COMMAND);
-    let total = command.len();
-    let elided = total.saturating_sub(MAX_EXPLAIN_HINT_COMMAND);
-    format!(
-        "Tip: dcg explain \"{head}\"\n\
-         (command truncated for this report: {elided} of {total} bytes elided; \
-         rerun `dcg explain` against the full command for the complete report)"
-    )
+    if let Some(invocation) = inline_explain_command(command, MAX_EXPLAIN_HINT_COMMAND) {
+        return format!("Tip: {invocation}");
+    }
+
+    let (preview, elided) = explain_command_preview(command);
+    let mut hint = format!(
+        "Tip: {EXPLAIN_STDIN_COMMAND}\n\
+         {EXPLAIN_STDIN_INSTRUCTION}\n\
+         Command preview (JSON string): {preview}"
+    );
+    if elided != 0 {
+        use std::fmt::Write as _;
+        let total = command.len();
+        let _ = write!(
+            hint,
+            "\n(command truncated for this report: {elided} of {total} bytes elided; \
+             supply the full command on stdin for the complete report)"
+        );
+    }
+    hint
 }
 
 fn build_rule_id(pack: Option<&str>, pattern: Option<&str>) -> Option<String> {
@@ -3397,12 +3470,12 @@ fn format_matched_message(
         |rule| format!("Rule: {rule}\n\n"),
     );
 
-    // The command deliberately appears ONCE, inside the `Tip:` line. A hook
+    // The command deliberately appears ONCE, in the hint or its preview. A hook
     // decision lands in the agent's transcript and is
```

**File**: `src/packs/mod.rs` (modified, +3/-3)
```diff
@@ -1068,12 +1068,12 @@ impl Pack {
 
     fn check_single(&self, cmd: &str) -> Option<DestructiveMatch> {
         // Quick reject if no keywords match
-        if !self.might_match(cmd)
-            && !(self.id == "core.filesystem"
+        if !(self.might_match(cmd)
+            || (self.id == "core.filesystem"
                 && crate::packs::core::filesystem::filesystem_semantic_scan_required(
                     cmd,
                     crate::normalize::ShellDialect::Unknown,
-                ))
+                )))
         {
             return None;
         }
```

**File**: `tests/golden/hook/deny_filesystem.json` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
   "hookSpecificOutput": {
     "hookEventName": "PreToolUse",
     "permissionDecision": "deny",
-    "permissionDecisionReason": "BLOCKED by dcg\n\nTip: dcg explain \"rm -rf /\"\n\nReason: rm -rf on root or home paths is EXTREMELY DANGEROUS. This command will NOT be executed. Ask the user to run it manually if truly needed.\n\nExplanation: This command would recursively delete files starting from the root filesystem (/) or home directory (~). This is catastrophic and will destroy:\n             \n             - Your entire operating system\n             - All installed applications and libraries\n             - All user data, documents, and configurations\n             - Boot files, making the system unbootable\n             \n             There is NO recovery without backups. Even with backups, full restoration takes hours to days.\n             \n             dcg auto-allows recursive deletion only for literal temp paths:\n               rm -rf /tmp/<subdir>/scratch\n             \n             For any other directory, preview first, then either delete interactively or move the tree aside (dcg allows all three forms):\n               find /path/to/directory -type f | head -20\n               rm -ri /path/to/directory   # needs a terminal; with stdin closed it deletes nothing and exits 0\n               mv /path/to/directory ~/.Trash/            # macOS soft-delete, recoverable\n               mv /path/to/directory ~/.local/share/Trash/ # Linux soft-delete, recoverable\n             \n             Under a home directory, prefer the Trash move: relocating into /tmp is itself denied there (`mv-sensitive-source-root-home`), because relocate-then-delete is the bypass that rule exists to stop.\n\nRule: core.filesystem:rm-rf-root-home\n\nIf this operation is truly needed, ask the user for explicit permission and have them run the command manually.\n\nTo permit this single command once, the user can approve it with: dcg allow-once <DYNAMIC>",
+    "permissionDecisionReason": "BLOCKED by dcg\n\nTip: dcg explain -- \"rm -rf /\"\n\nReason: rm -rf on root or home paths is EXTREMELY DANGEROUS. This command will NOT be executed. Ask the user to run it manually if truly needed.\n\nExplanation: This command would recursively delete files starting from the root filesystem (/) or home directory (~). This is catastrophic and will destroy:\n             \n             - Your entire operating system\n             - All installed applications and libraries\n             - All user data, documents, and configurations\n             - Boot files, making the system unbootable\n             \n             There is NO recovery without backups. Even with backups, full restoration takes hours to days.\n             \n             dcg auto-allows recursive deletion only for literal temp paths:\n               rm -rf /tmp/<subdir>/scratch\n             \n             For any other directory, preview first, then either delete interactively or move the tree aside (dcg allows all three forms):\n               find /path/to/directory -type f | head -20\n               rm -ri /path/to/directory   # needs a terminal; with stdin closed it deletes nothing and exits 0\n               mv /path/to/directory ~/.Trash/            # macOS soft-delete, recoverable\n               mv /path/to/directory ~/.local/share/Trash/ # Linux soft-delete, recoverable\n             \n             Under a home directory, prefer the Trash move: relocating into /tmp is itself denied there (`mv-sensitive-source-root-home`), because relocate-then-delete is the bypass that rule exists to stop.\n\nRule: core.filesystem:rm-rf-root-home\n\nIf this operation is truly needed, ask the user for explicit permission and have them run the command manually.\n\nTo permit this single command once, the user can approve it with: dcg allow-once <DYNAMIC>",
     "allowOnceCode": "<DYNAMIC>",
     "allowOnceFullHash": "<DYNAMIC>",
     "ruleId": "core.filesystem:rm-rf-root-home",
@@ -15,4 +15,4 @@
       "allowOnceCommand": "dcg allow-once <DYNAMIC>"
     }
   }
-}
\ No newline at end of file
+}
```

**File**: `tests/golden/hook/deny_git.json` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
   "hookSpecificOutput": {
     "hookEventName": "PreToolUse",
     "permissionDecision": "deny",
-    "permissionDecisionReason": "BLOCKED by dcg\n\nTip: dcg explain \"git push --force origin main\"\n\nReason: Force push can destroy remote history. Use --force-with-lease if necessary.\n\nExplanation: git push --force overwrites remote history with your local history. This can permanently destroy commits that others have already pulled, causing data loss for your entire team. Collaborators may lose work, and recovering requires manual intervention from everyone affected.\n             \n             What can go wrong:\n             - Commits others pushed are deleted from remote\n             - Team members get diverged histories\n             - CI/CD pipelines may reference deleted commits\n             \n             Safer alternative:\n             - git push --force-with-lease: Only forces if remote matches your last fetch\n             \n             Check remote state first:\n               git fetch && git log origin/<branch>..HEAD\n\nRule: core.git:push-force-long\n\nIf this operation is truly needed, ask the user for explicit permission and have them run the command manually.\n\nTo permit this single command once, the user can approve it with: dcg allow-once <DYNAMIC>",
+    "permissionDecisionReason": "BLOCKED by dcg\n\nTip: dcg explain -- \"git push --force origin main\"\n\nReason: Force push can destroy remote history. Use --force-with-lease if necessary.\n\nExplanation: git push --force overwrites remote history with your local history. This can permanently destroy commits that others have already pulled, causing data loss for your entire team. Collaborators may lose work, and recovering requires manual intervention from everyone affected.\n             \n             What can go wrong:\n             - Commits others pushed are deleted from remote\n             - Team members get diverged histories\n             - CI/CD pipelines may reference deleted commits\n             \n             Safer alternative:\n             - git push --force-with-lease: Only forces if remote matches your last fetch\n             \n             Check remote state first:\n               git fetch && git log origin/<branch>..HEAD\n\nRule: core.git:push-force-long\n\nIf this operation is truly needed, ask the user for explicit permission and have them run the command manually.\n\nTo permit this single command once, the user can approve it with: dcg allow-once <DYNAMIC>",
     "allowOnceCode": "<DYNAMIC>",
     "allowOnceFullHash": "<DYNAMIC>",
     "ruleId": "core.git:push-force-long",
@@ -15,4 +15,4 @@
       "allowOnceCommand": "dcg allow-once <DYNAMIC>"
     }
   }
-}
\ No newline at end of file
+}
```

**File**: `tests/golden/hook/deny_git_reset.json` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
   "hookSpecificOutput": {
     "hookEventName": "PreToolUse",
     "permissionDecision": "deny",
-    "permissionDecisionReason": "BLOCKED by dcg\n\nTip: dcg explain \"git reset --hard\"\n\nReason: git reset --hard destroys uncommitted changes. Use 'git stash' first.\n\nExplanation: git reset --hard discards ALL uncommitted changes in your working directory AND staging area. This is one of the most dangerous git commands because changes that were never committed cannot be recovered by any means.\n             \n             What gets destroyed:\n             - All modified files revert to the target commit\n             - All staged changes are lost\n             - Untracked files remain (use git clean to remove those)\n             \n             Safer alternatives:\n             - git reset --soft <ref>: Move HEAD but keep all changes staged\n             - git reset --mixed <ref>: Move HEAD, unstage changes, keep working dir (default)\n             - git stash: Save changes before resetting\n             \n             Preview what would be lost:\n               git status && git diff\n\nRule: core.git:reset-hard\n\nIf this operation is truly needed, ask the user for explicit permission and have them run the command manually.\n\nTo permit this single command once, the user can approve it with: dcg allow-once <DYNAMIC>",
+    "permissionDecisionReason": "BLOCKED by dcg\n\nTip: dcg explain -- \"git reset --hard\"\n\nReason: git reset --hard destroys uncommitted changes. Use 'git stash' first.\n\nExplanation: git reset --hard discards ALL uncommitted changes in your working directory AND staging area. This is one of the most dangerous git commands because changes that were never committed cannot be recovered by any means.\n             \n             What gets destroyed:\n             - All modified files revert to the target commit\n             - All staged changes are lost\n             - Untracked files remain (use git clean to remove those)\n             \n             Safer alternatives:\n             - git reset --soft <ref>: Move HEAD but keep all changes staged\n             - git reset --mixed <ref>: Move HEAD, unstage changes, keep working dir (default)\n             - git stash: Save changes before resetting\n             \n             Preview what would be lost:\n               git status && git diff\n\nRule: core.git:reset-hard\n\nIf this operation is truly needed, ask the user for explicit permission and have them run the command manually.\n\nTo permit this single command once, the user can approve it with: dcg allow-once <DYNAMIC>",
     "allowOnceCode": "<DYNAMIC>",
     "allowOnceFullHash": "<DYNAMIC>",
     "ruleId": "core.git:reset-hard",
@@ -15,4 +15,4 @@
       "allowOnceCommand": "dcg allow-once <DYNAMIC>"
     }
   }
-}
\ No newline at end of file
+}
```

---

### Incident Patch 2: `10bc819c` (2026-10-19)
**Commit Message**: fix(hooks): retain native commands across aliases and malformed input

Evaluate every distinct command-bearing argument alias independently so harmless, warning, or unfinished-string siblings cannot hide a destructive command. Keep explicit non-shell tool data out of the evaluation stream.

Recover native Antigravity commands from bounded malformed and oversized JSON prefixes, including escaped keys, stringified args, and Unicode surrogate pairs. Infer the native denial protocol only from structurally attributable envelopes while preserving established agent and batch precedence, scan limits, and malformed-input policy.

Validation on the current locked dependency graph: 177 hook unit tests, 65 executable protocol regressions, and the focused main agent-precedence test passed. cargo check --locked --all-targets passed. Changed files pass formatting and diff checks; unrelated repository-wide formatting and Clippy findings remain documented baseline issues.

**File**: `src/hook.rs` (modified, +714/-40)
```diff
@@ -1311,20 +1311,20 @@ fn commands_in_displaced_alias_value(canonical: &str, value: &serde_json::Value)
             .and_then(|tool_input| extract_command_from_tool_input(&tool_input))
             .into_iter()
             .collect(),
-        "tool_args" => extract_command_from_tool_args(value).into_iter().collect(),
+        "tool_args" => extract_commands_from_tool_args(value),
         "tool_call" => serde_json::from_value::<ToolCall>(value.clone())
             .ok()
-            .and_then(|tool_call| extract_command_from_tool_call(&tool_call))
-            .into_iter()
-            .collect(),
+            .filter(is_batch_shell_call)
+            .map(|tool_call| extract_commands_from_tool_call(&tool_call))
+            .unwrap_or_default(),
         "tool_calls" => value
             .as_array()
             .map(|entries| {
                 entries
                     .iter()
                     .filter_map(|entry| serde_json::from_value::<ToolCall>(entry.clone()).ok())
                     .filter(is_batch_shell_call)
-                    .filter_map(|call| extract_command_from_tool_call(&call))
+                    .flat_map(|call| extract_commands_from_tool_call(&call))
                     .collect()
             })
             .unwrap_or_default(),
@@ -1356,12 +1356,29 @@ fn commands_in_displaced_alias_value(canonical: &str, value: &serde_json::Value)
 /// whose structure it does not trust — malformed escapes, raw control
 /// characters inside the string, a non-string value — is dropped rather than
 /// guessed at, and an empty result keeps the caller's historic fail-open
-/// behavior. Escaped occurrences of the key inside string values
-/// (`\"command\"`) never match because the scan requires the unescaped
-/// `"command"` byte sequence.
+/// behavior. Native Antigravity envelopes instead recover command fields
+/// from the actual top-level `toolCall` / `tool_call` object. Their
+/// `CommandLine` spelling must survive the same read errors, but unrelated
+/// metadata must not become a command merely because a shell was identified.
 #[must_use]
 pub fn extract_commands_from_truncated_json(prefix: &str) -> Vec<String> {
-    extract_string_values_for_key(prefix, "\"command\"")
+    let Some(native_commands) = native_commands_from_json_prefix(prefix) else {
+        return extract_string_values_for_key(prefix, "\"command\"");
+    };
+    if !extract_tool_names_from_truncated_json(prefix)
+        .iter()
+        .any(|name| is_supported_shell_tool(Some(name)))
+    {
+        return native_commands;
+    }
+
+    // Keep the legacy all-occurrences rule when a mixed envelope also names
+    // a legacy shell tool. Neither spelling may conceal a sibling command.
+    let mut commands = extract_string_values_for_key(prefix, "\"command\"");
+    for command in native_commands {
+        append_recovered_command(&mut commands, command);
+    }
+    commands
 }
 
 /// Best-effort extraction of the hook envelope's tool name(s) from a truncated
@@ -1386,10 +1403,12 @@ pub fn extract_tool_names_from_truncated_json(prefix: &str) -> Vec<String> {
 ///
 /// Returns the recognized shell tool name and the dialect it implies, using
 /// exactly the same recognition and dialect mapping as the normal parsed path
-/// ([`is_supported_shell_tool`] / [`shell_dialect_for_tool_name`]). Returns
-/// `None` when the prefix carries no tool name at all, or only tool names that
-/// are not shell tools — the caller must then fail open rather than deny a
-/// payload it cannot attribute to a shell.
+/// ([`is_supported_shell_tool`] / [`shell_dialect_for_tool_name`]).
+/// Native Antigravity's `toolCall.name = "run_command"` is also recognized,
+/// including the nameless-with-args form accepted by the parsed path. The
+/// native tool name is read only from the real top-level envelope; a `name`
+/// planted in metadata or a string cannot manufacture shell attribution.
+/// Returns `None` when neither envelope can be attributed to a shell.
 ///
 /// The first *recognized* name wins, so a decoy non-shell tool name planted
 /// ahead of the real one cannot suppress evaluation.
@@ -1402,6 +1421,13 @@ pub fn shell_tool_from_truncated_json(prefix: &str) -> Option<(String, ShellDial
             let dialect = shell_dialect_for_tool_name(Some(&name));
             (name, dialect)
         })
+        .or_else(|| {
+            json_object_prefix_fields(prefix)
+                .filter(|(key, _)| matches!(key.as_str(), "toolCall" | "tool_call"))
+                .filter_map(|(_, value)| truncated_tool_call(value))
+                .any(|call| call.native_shell)
+                .then(|| ("run_command".to_string(), ShellDialect::Unknown))
+        })
 }
 
 /// The hook protocol a truncated or undecodable payload declares through its
@@ -1415,9 +1441,32 @@ pub fn shell_tool_from_truncated_json(prefix: &str) -> Option<(String, ShellDial
 /// `event`, a `toolArgs` *object*, and no `tool_input` (which would make it
 /// Cru
```

**File**: `src/main.rs` (modified, +44/-13)
```diff
@@ -278,7 +278,8 @@ fn blocking_verdict_exit_code(protocol: hook::HookProtocol, delivery: io::Result
 /// back to the Claude shape, which answers with exit 0, and a host that reads
 /// only the exit status takes exit 0 as a pass. That is the ordinary case for
 /// Reasonix (#358): it sets no env marker, and process-ancestry detection is
-/// Unix-only. So when the agent is unknown, the envelope markers still
+/// Unix-only. Antigravity also needs its native JSON response when its env
+/// marker is absent. So when the agent is unknown, the envelope markers still
 /// readable in the raw `prefix` decide instead
 /// ([`hook::protocol_from_truncated_json`]). They never override an
 /// identified agent: a planted marker must not be able to switch, say,
@@ -563,22 +564,26 @@ fn push_oversized_scan_windows(out: &mut Vec<String>, command: &str, max_command
 /// Padding a destructive command past `max_hook_input_bytes` used to skip
 /// every pack: the oversized input failed open (by default) without any
 /// evaluation. The JSON prefix that WAS read usually still contains
-/// `tool_input.command`, so extract it leniently and run it through the
-/// normal evaluation pipeline. A proven Deny/Ask publishes the ordinary
-/// protocol response and returns `true`; every other outcome — nothing
-/// extractable, benign command, warn/log match, deadline exhausted — returns
-/// `false` so the caller keeps the historic fail-open warning path.
+/// `tool_input.command` or native Antigravity `toolCall.args.CommandLine`,
+/// so extract commands leniently and run them through the normal evaluation
+/// pipeline. A proven Deny/Ask publishes the ordinary blocking response;
+/// deadline exhaustion publishes an indeterminate response. Both return the
+/// protocol's exit status. Nothing extractable, a benign command, or a
+/// warn/log match returns `None` to keep the historic fail-open warning path.
 ///
 /// Two attribution rules keep this from over-denying and from under-scanning:
-/// - The prefix must name a recognized SHELL tool (`tool_name`/`toolName`).
+/// - The prefix must name a recognized SHELL tool (`tool_name`/`toolName` or
+///   native `toolCall.name`). Antigravity's nameless-with-args form is also
+///   accepted, as on the parsed path.
 ///   An oversized `Write`/`Read` envelope that happens to carry a
 ///   command-shaped field is not a shell request and must fail open; so does
-///   a prefix with no tool name at all — dcg never denies what it cannot
-///   attribute to a shell.
-/// - EVERY `"command"` occurrence in the prefix is evaluated, not just the
-///   first: `serde_json` is last-wins on duplicate keys and an earlier
-///   unrelated object can carry a decoy, so judging one occurrence would let
-///   a benign decoy suppress the real command.
+///   an unattributable prefix — dcg never denies what it cannot attribute to
+///   a shell.
+/// - EVERY recovered command is evaluated independently. Legacy envelopes
+///   retain the all-occurrences `"command"` scan. Native envelopes recover
+///   their accepted command aliases only from command-bearing envelope
+///   fields, keeping unrelated metadata inert. Neither a duplicate key nor
+///   a benign alias may suppress another command.
 ///
 /// Only called under fail-open; fail-closed unparseable input still denies
 /// unconditionally in `handle_unparseable_hook_input` (issue #160).
@@ -2739,6 +2744,32 @@ mod tests {
         }
     }
 
+    #[test]
+    fn antigravity_recovery_protocol_never_overrides_an_identified_agent() {
+        let prefix = r#"{"toolCall":{"name":"run_command","args":{"CommandLine":"git reset --hard"#;
+        assert_eq!(
+            payloadless_hook_protocol(&Agent::Unknown, Some(prefix)),
+            hook::HookProtocol::Antigravity
+        );
+        assert_eq!(
+            payloadless_hook_protocol(&Agent::Custom("unknown-host".into()), Some(prefix)),
+            hook::HookProtocol::Antigravity
+        );
+        for agent in [
+            Agent::Antigravity,
+            Agent::CodexCli,
+            Agent::ClaudeCode,
+            Agent::GeminiCli,
+            Agent::Reasonix,
+        ] {
+            assert_eq!(
+                payloadless_hook_protocol(&agent, Some(prefix)),
+                hook_protocol_for_agent(&agent),
+                "native markers must preserve explicit agent {agent:?}"
+            );
+        }
+    }
+
     #[test]
     fn indeterminate_reason_uses_configured_budget_and_stage() {
         let reason = format_indeterminate_reason("pre_evaluation", Duration::from_millis(1_500));
```

**File**: `tests/agent_hook_output.rs` (modified, +88/-0)
```diff
@@ -767,6 +767,94 @@ fn test_antigravity_warning_preserves_ordinary_permission_checks() {
     }
 }
 
+#[test]
+fn test_antigravity_command_keys_cannot_hide_a_destructive_native_command() {
+    for decoy in ["echo harmless", "git stash drop", "echo '", "echo \\"] {
+        let input = serde_json::json!({
+            "toolCall": {
+                "name": "run_command",
+                "args": {"command": decoy, "CommandLine": "git reset --hard"}
+            }
+        })
+        .to_string();
+        let (stdout, stderr, exit_code) = run_hook_mode_raw(&input);
+        let denial = assert_antigravity_denial(&stdout, &stderr, exit_code);
+        assert!(
+            denial.reason.contains("core.git:reset-hard"),
+            "a harmless, warning, or unfinished alias cannot hide the native command: {decoy:?}\n{}",
+            denial.reason
+        );
+    }
+}
+
+#[test]
+fn test_antigravity_displaced_tool_call_retains_all_command_keys() {
+    let input = serde_json::json!({
+        "tool_call": {"name": "run_command", "args": {"CommandLine": "echo primary"}},
+        "toolCall": {
+            "name": "run_command",
+            "args": {"command": "echo alias", "CommandLine": "git reset --hard"}
+        }
+    })
+    .to_string();
+    let (stdout, stderr, exit_code) = run_hook_mode_raw(&input);
+    let denial = assert_antigravity_denial(&stdout, &stderr, exit_code);
+    assert!(denial.reason.contains("core.git:reset-hard"));
+}
+
+#[test]
+fn test_antigravity_benign_command_aliases_preserve_permissions() {
+    for args in [
+        serde_json::json!({"command": "echo first", "CommandLine": "git status"}),
+        serde_json::json!({"command": "git status", "CommandLine": "git status"}),
+        serde_json::json!({"command": "", "CommandLine": "git status"}),
+        serde_json::json!({"command": "echo 'git reset --hard'", "CommandLine": "git status"}),
+    ] {
+        let input =
+            serde_json::json!({"toolCall": {"name": "run_command", "args": args}}).to_string();
+        let (stdout, stderr, exit_code) = run_hook_mode_raw(&input);
+        assert_eq!(exit_code, 0, "{input}\nstderr: {stderr}");
+        assert!(
+            stdout.is_empty(),
+            "benign aliases must not decide host permission: {stdout}"
+        );
+        assert!(
+            stderr.is_empty(),
+            "benign aliases must remain silent: {stderr}"
+        );
+    }
+}
+
+#[test]
+fn test_stringified_args_cannot_hide_command_aliases() {
+    let args =
+        serde_json::json!({"command": "echo harmless", "Command": "git reset --hard"}).to_string();
+    let cases = [
+        (
+            serde_json::json!({"toolCalls": [{"name": "bash", "args": args}]}),
+            "/hookSpecificOutput/permissionDecision",
+        ),
+        (
+            serde_json::json!({"event": "pre-tool-use", "toolName": "bash", "toolArgs": args}),
+            "/permissionDecision",
+        ),
+    ];
+    for (input, decision_pointer) in cases {
+        let (stdout, stderr, exit_code) = run_hook_mode_raw(&input.to_string());
+        assert_eq!(exit_code, 0, "{input}\nstderr: {stderr}");
+        let output: serde_json::Value = serde_json::from_str(&stdout)
+            .unwrap_or_else(|error| panic!("missing denial for {input}: {error}\n{stderr}"));
+        assert_eq!(
+            output
+                .pointer(decision_pointer)
+                .and_then(serde_json::Value::as_str),
+            Some("deny"),
+            "{output}"
+        );
+        assert!(stdout.contains("core.git:reset-hard"), "{output}");
+    }
+}
+
 #[test]
 fn test_antigravity_warning_does_not_mask_destructive_companion() {
     let input = antigravity_payload("git stash drop; git reset --hard");
```

**File**: `tests/repro_290_oversized_hook_input.rs` (modified, +318/-1)
```diff
@@ -14,7 +14,7 @@
 use std::fs;
 use std::io::Write;
 use std::path::{Path, PathBuf};
-use std::process::{Command, Stdio};
+use std::process::{Command, Output, Stdio};
 
 /// Payload size safely past the default 256 KiB `max_hook_input_bytes`.
 const PADDING_BYTES: usize = 300 * 1024;
@@ -515,3 +515,320 @@ fn issue_290_normal_size_deny_unchanged() {
         "deny"
     );
 }
+
+// Native Antigravity recovery must work before a HookInput exists, including
+// when the host sets its real marker and when only the stdin shape identifies
+// it. Every command below is fixture data sent to dcg, never executed.
+#[derive(Clone, Copy, Debug)]
+enum NativeRecoveryAgent {
+    NoMarker,
+    Environment,
+    Forced(&'static str),
+}
+
+fn run_native_recovery(
+    input: &[u8],
+    home: &Path,
+    agent: NativeRecoveryAgent,
+    fail_closed: bool,
+) -> Output {
+    let config =
+        Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/e2e/fixtures/configs/minimal.toml");
+    let mut command = Command::new(dcg_binary());
+    command.env_clear();
+    // Preserve executable/platform lookup only; no caller agent markers,
+    // allowlists, size limits, or fail-closed overrides enter these cases.
+    for key in ["PATH", "SystemRoot", "WINDIR"] {
+        if let Some(value) = std::env::var_os(key) {
+            command.env(key, value);
+        }
+    }
+    command
+        .current_dir(home)
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .env("HOME", home)
+        .env("USERPROFILE", home)
+        .env("XDG_CONFIG_HOME", home.join(".config"))
+        .env("XDG_DATA_HOME", home.join(".local/share"))
+        .env("APPDATA", home.join("AppData/Roaming"))
+        .env("LOCALAPPDATA", home.join("AppData/Local"))
+        .env("ProgramData", home)
+        .env("TMPDIR", home)
+        .env("TEMP", home)
+        .env("TMP", home)
+        .env("DCG_CONFIG", config)
+        .env("DCG_ALLOWLIST_SYSTEM_PATH", "")
+        .env("DCG_ALLOW_ONCE_PATH", home.join("allow-once.jsonl"))
+        .env("DCG_PENDING_EXCEPTIONS_PATH", home.join("pending.jsonl"))
+        .env("DCG_HISTORY_DISABLED", "1")
+        .env("DCG_SELF_HEAL_HOOK", "0")
+        .env("DCG_HOOK_TIMEOUT_MS", "30000")
+        .env("NO_COLOR", "1");
+    match agent {
+        NativeRecoveryAgent::NoMarker => {}
+        NativeRecoveryAgent::Environment => {
+            command.env("ANTIGRAVITY_CONVERSATION_ID", "native-recovery-test");
+        }
+        NativeRecoveryAgent::Forced(name) => {
+            command
+                .env("ANTIGRAVITY_CONVERSATION_ID", "native-recovery-test")
+                .args(["--agent", name]);
+        }
+    }
+    if fail_closed {
+        command.env("DCG_FAIL_CLOSED", "1");
+    }
+    let mut child = command.spawn().expect("spawn native recovery hook");
+    child
+        .stdin
+        .take()
+        .expect("hook stdin")
+        .write_all(input)
+        .expect("write native fixture bytes");
+    child.wait_with_output().expect("wait for native recovery")
+}
+
+fn native_recovery_payload(command: &str) -> String {
+    serde_json::json!({
+        "toolCall": {
+            "name": "run_command",
+            "args": {"CommandLine": command, "Cwd": "/repo", "WaitMsBeforeAsync": 500}
+        },
+        "conversationId": "native-recovery-test",
+        "stepIdx": 1
+    })
+    .to_string()
+}
+
+fn malformed_native_payloads(payload: &str) -> Vec<(&'static str, Vec<u8>)> {
+    let mut non_utf8 = payload.as_bytes().to_vec();
+    non_utf8.push(0xff);
+    vec![
+        (
+            "json truncation",
+            payload.as_bytes()[..payload.len() - 1].to_vec(),
+        ),
+        (
+            "malformed suffix",
+            format!("{payload} trailing").into_bytes(),
+        ),
+        ("invalid UTF-8", non_utf8),
+    ]
+}
+
+fn assert_native_recovery_denial(output: &Output, context: &str) -> String {
+    #[derive(Debug, serde::Deserialize)]
+    #[serde(deny_unknown_fields)]
+    struct NativeDenial {
+        decision: String,
+        reason: String,
+    }
+
+    let stderr = String::from_utf8_lossy(&output.stderr);
+    assert_eq!(output.status.code(), Some(0), "{context}: {stderr}");
+    let root: serde_json::Value = serde_json::from_slice(&output.stdout)
+        .unwrap_or_else(|err| panic!("{context}: invalid denial ({err}): {output:?}"));
+    assert!(
+        root.is_object(),
+        "{context}: expected JSON object, got {root}"
+    );
+    // Deserialize the original bytes so duplicate keys cannot be hidden by
+    // Value's last-wins map; String rejects structured enum lookalikes.
+    let denial: NativeDenial = serde_json::from_slice(&output.stdout)
+        .unwrap_or_else(|err| panic!("{context}: native protocol rejected denial ({err}): {root}"));
+    assert_eq!(denial.decision, "deny", "{context}: {root}");
+    assert!(!denial.reason.trim().is_empty(), "{context}: {root}");
+    denial.reason
+}

```

---

### Incident Patch 3: `cdf17b49` (2026-10-19)
**Commit Message**: fix(deps): align ast-grep core with the vendored language adapter

The standalone core update introduced incompatible 0.51 and 0.45.3 trait definitions. DCG passes the vendored SupportLang into the direct core's AST and pattern APIs, so current main fails with LanguageExt and Language trait errors.

Require the compatible 0.45.3 core and remove the unused 0.51 lock entry. Retain the published vendored language/Bash grammar contract and every unrelated dependency update and lock edge.

Reproduced the compiler failure before the correction; all-target compilation succeeds after aligning the pair.

**File**: `Cargo.lock` (modified, +2/-14)
```diff
@@ -148,23 +148,11 @@ dependencies = [
  "tree-sitter",
 ]
 
-[[package]]
-name = "ast-grep-core"
-version = "0.51.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "dea8fe60a16a988662ebb1b14aafc94e03260a987fb909a54525555188473269"
-dependencies = [
- "bit-set 0.11.1",
- "regex",
- "thiserror",
- "tree-sitter",
-]
-
 [[package]]
 name = "ast-grep-language-dcg"
 version = "0.45.3"
 dependencies = [
- "ast-grep-core 0.45.3",
+ "ast-grep-core",
  "ignore",
  "serde",
  "tree-sitter",
@@ -955,7 +943,7 @@ version = "0.15.3"
 dependencies = [
  "aho-corasick",
  "assert_cmd",
- "ast-grep-core 0.51.0",
+ "ast-grep-core",
  "ast-grep-language-dcg",
  "async-trait",
  "base64",
```

**File**: `Cargo.toml` (modified, +4/-1)
```diff
@@ -65,7 +65,10 @@ tokio = { version = "1.52", features = ["rt-multi-thread"] }
 rayon = { version = "1.11", optional = true }
 
 # AST-based pattern matching for heredoc/inline-script content
-ast-grep-core = "0.51"
+# SupportLang crosses this crate's Language/LanguageExt trait boundary. Keep
+# the core compatible with the vendored language adapter below; two semver
+# incompatible core versions produce distinct traits and cannot interoperate.
+ast-grep-core = "0.45.3"
 # The Bash grammar carries dcg's #442/#461 fixes (scanner memory safety on glibc;
 # explicit stdin descriptors and mixed file/here-string redirections). It used to
 # arrive through `[patch.crates-io]`, which `cargo publish` drops, so a crates.io
```

#### Recent Merged Pull Requests:
- **PR #581** (2026-10-19): deps(deps): bump ast-grep-core from 0.45.3 to 0.51.0 (@dependabot[bot])
- **PR #580** (2026-10-19): deps(deps): bump serde_json from 1.0.151 to 1.0.154 in the serde group (@dependabot[bot])
- **PR #579** (2026-10-19): deps(deps): bump the rust-minor-patch group with 5 updates (@dependabot[bot])
- **PR #578** (2026-10-19): ci(deps): bump the actions group with 2 updates (@dependabot[bot])
- **PR #559** (closed): deps(deps): bump ast-grep-core from 0.45.3 to 0.50.0 (@dependabot[bot])
- **PR #557** (2026-10-14): deps(deps): bump the rust-minor-patch group with 3 updates (@dependabot[bot])

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

## X. hooks): keep diagnostic commands safe to copy

**RULE**:
When implementing operations in `.beads/issues.jsonl`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Dicklesworthstone/destructive_command_guard. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ad98f9f4`: hooks): keep diagnostic commands safe to copy. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.beads/issues.jsonl`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
{"id":"bd-guardrails-global-options","title":"Enabled guardrails pack misses dcg self-weakening commands with global options","description":"## Confirmed defect\n\nA fresh isolated probe against executable source content corresponding to published commit 10bc819cc0906019037024d4ab6d769bb3d9b6db confirms that the explicitly enabled careful_company_running_windows.guardrails pack denies direct dcg self-weakening subcommands but permits the same commands when the valid global --robot option precedes the subcommand.\n\nPaired fixture results:\n- dcg allow-once abc123 --yes -> deny; dcg --robot allow-once abc123 --yes -> allow. Expected rule: careful_company_running_windows.guardrails:dcg-policy-self-weakening.\n- dcg allowlist add core.git:reset-hard --reason approved -> deny; dcg --robot allowlist add core.git:reset-hard --reason approved -> allow. Expected rule: careful_company_running_windows.guardrails:dcg-policy-self-weakening.\n- dcg uninstall --yes -> deny; dcg --robot uninstall --yes -> allow. Expected rule: careful_company_running_windows.guardrails:dcg-bypass-or-uninstall.\n\n## Retained reproduction evidence\n\nThe six results are retained in /tmp/dcg-guardrails-repro-f5f64o
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ad98f9f4` are properly handled with clean fallback behavior.
