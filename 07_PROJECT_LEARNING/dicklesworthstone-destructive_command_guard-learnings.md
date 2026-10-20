> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dicklesworthstone-destructive_command_guard-learnings.md`  
> **Source**: github ([https://github.com/Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard))  
> **Source Version**: `39f68574`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T14:44:28.960Z  
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
> **Harvest Timestamp**: 2026-10-20T14:44:28.954Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dicklesworthstone/destructive_command_guard`
- **Description**: The Destructive Command Guard (dcg) is for blocking dangerous git and shell commands from being executed by agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6192 stars

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
- **Issue #575** (2026-10-20): **[False Positive] redirect-truncate-dynamic-path treats `>>"$X"` (no space) as a truncating redirect; `>> "$X"` is ignored as documented**
  *Symptoms*: ### Blocked Command  echo done >>"$LOG"  ### Expected Behavior  This is an append, and the redirect rule is documented to ignore appends. The [changelog entry](https://github.com/Dicklesworthstone/destructive_command_guard/blob/v0.15.0/CHANGELOG.md) that moved `>> /etc/passwd` and `>> ~/.bashrc` to their own scenario says: "Appending does not truncate, which is why the *redirect* rule ignores `>>`". The rule's own deny text also recommends "Use append (`>>`) when preserving existing content is acceptable". So `>>"$LOG"` and `>> "$LOG"` should get the same verdict, and they don't:  | Command | Observed (0.15.3) | |---|---| | `echo done >>"$LOG"` | deny, redirect-truncate-dynamic-path | | `echo done >> "$LOG"` | allow | | `echo done >>$LOG` | deny | | `echo done >> $LOG` | allow | | `echo done 2>>"$LOG"` | deny | | `echo done 2>> "$LOG"` | allow | | `echo done >>"$HOME/notes.txt"` | deny | | `echo done >> "$HOME/notes.txt"` | allow | | `echo done >>"/tmp/log"` | allow |  **Must stay blocked**, and they do, through credential-file-write in both spellings: `echo x >>~/.bashrc`, `echo x >> ~/.bashrc`, `echo x >>"$HOME/.bashrc"`, `echo x >> "$HOME/.bashrc"`.  Expected: `>>` with or without a following space is an append, and the truncate rule skips it either way.  ### Output of `dcg explain`  ```shell ══════════════════════════════════════════════════════════════════ DCG EXPLAIN ══════════════════════════════════════════════════════════════════  Decision: DENY Latency:  2.5ms  ─── 

- **Issue #574** (2026-10-20): **[False Positive] redirect-truncate-dynamic-path drops a same-command literal assignment after a grouped `printf "$(…)"`, a second prefix assignment, or an unrelated `read`/`printf -v`**
  *Symptoms*: ### Blocked Command  S=/tmp/x; { printf a "$(true)"; } > "$S/o"  ### Expected Behavior  `S` is bound to a literal temp path in the same command and nothing between the assignment and the redirect can rebind it, so `"$S/o"` resolves to `/tmp/x/o` and the write should be allowed, as its ungrouped twin is. The [0.15.0 changelog](https://github.com/Dicklesworthstone/destructive_command_guard/blob/v0.15.0/CHANGELOG.md) describes narrowing the variable-mutator list "so a plain `printf` no longer blocks an ordinary write"; these shapes still lose the binding proof. The table establishes that loss; I have not traced whether all three share one implementation cause.  **1. A plain `printf` with a substitution argument, only inside a group.**  | Command | Observed (0.15.3) | |---|---| | `S=/tmp/x; { printf a "$(true)"; } > "$S/o"` | deny | | `S=/tmp/x; printf a "$(true)" > "$S/o"` | allow (no group) | | `S=/tmp/x; { printf a; } > "$S/o"` | allow (no substitution) | | `S=/tmp/x; { echo a "$(true)"; } > "$S/o"` | allow (`echo`) | | `S=/tmp/x; { printf a $(true); } > "$S/o"` | deny (unquoted) | | ``S=/tmp/x; { printf a `true`; } > "$S/o"`` | deny (backticks) | | `S=/tmp/x; { printf a "$(true)"; } > /tmp/x/o` | allow (literal target) |  **2. A second assignment word in the same prefix.**  | Command | Observed (0.15.3) | |---|---| | `B=/tmp/b T=/tmp/t && cat a > "$B"` | deny | | `B=/tmp/b T=/tmp/t; cat a > "$B"` | deny | | `B=$(mktemp) T=$(mktemp) && cat a > "$B"` | deny | | `B=/tmp/b && T=/

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

### Incident Patch 1: `39f68574` (2026-10-20)
**Commit Message**: fix(hook,windows): interpreter source no longer activates disabled Windows packs (#569)

On Linux/macOS, with default config, the hook denied quoted
`python3 - <<'PY'` programs as
`windows.filesystem:windows-filesystem-semantic-unverified` although the
windows.* packs are off there, while `dcg test`/`dcg explain` disagreed.
Whether it denied depended on body length (the #569 generator: 28 tuple
lines allowed, 29 denied; also the 59-line edit script in #544).

Root cause, in three steps:

1. `command_has_powershell_shape` reads heredoc bodies for Windows shapes.
   In Python source a regex `r'[^\n]{0,40}(x|y)'` qualifies (the `^` after
   `(x|y)` reads as a cmd caret starting a command word), and so does the
   word `install-l` (approved verb `install`). `refine_shell_dialect` then
   widens the `Bash` label to `Unknown`. That part is deliberate: 3a8c330b
   keeps interpreter source as conservative evidence so the always-on rules
   still judge what an opaque sink could run, and cli_e2e pins it
   (`hook_mode_quoted_interpreter_source_keeps_destructive_sink_scans`).
2. `command_is_windows_shell_payload` asked the same question, so the same
   Python source also activated the windows

**File**: `src/evaluator.rs` (modified, +127/-0)
```diff
@@ -23834,6 +23834,10 @@ fn evaluate_packs_with_allowlists_at_depth(
     //
     // The rm_parse optimization for core.filesystem is handled inline.
     let mut first_allowlist_hit: Option<(PatternMatch, AllowlistLayer, String)> = None;
+    // Set when the bounded Windows filesystem pass stopped before reading
+    // every statement. Only a denial may follow it; an allow becomes the
+    // configured incomplete-analysis outcome below.
+    let mut windows_filesystem_analysis_incomplete = false;
 
     drop(preparation_phase);
     for &pack_id in &candidate_pack_ids {
@@ -24015,6 +24019,17 @@ fn evaluate_packs_with_allowlists_at_depth(
                     }
                     continue;
                 }
+                crate::packs::windows::filesystem::WindowsFilesystemSemanticDecision::Incomplete => {
+                    // The pass hit its size or statement bound before reading
+                    // every statement: no rule was verified either way. Run
+                    // this pack's patterns over the whole text (a visible
+                    // destructive spelling still denies under its own rule) and
+                    // let the end of this evaluation report the configured
+                    // incomplete-analysis outcome instead of an allow — never a
+                    // `windows-filesystem-semantic-unverified` finding the pass
+                    // did not make (#569).
+                    windows_filesystem_analysis_incomplete = true;
+                }
                 crate::packs::windows::filesystem::WindowsFilesystemSemanticDecision::NoMatch
                     if shell_dialect != ShellDialect::Unknown =>
                 {
@@ -24831,6 +24846,12 @@ fn evaluate_packs_with_allowlists_at_depth(
         return EvaluationResult::indeterminate_due_to_budget();
     }
 
+    // An unread remainder is not a clean one, and a rule-scoped allowlist hit
+    // elsewhere does not authorize what was never analyzed.
+    if windows_filesystem_analysis_incomplete {
+        return EvaluationResult::indeterminate_due_to_budget();
+    }
+
     if let Some((matched, layer, reason)) = first_allowlist_hit {
         return EvaluationResult::allowed_by_allowlist(matched, layer, reason);
     }
@@ -47426,6 +47447,112 @@ mod tests {
         }
     }
 
+    /// #569: a Windows filesystem pass that stops at its size or statement
+    /// bound reports the configured incomplete-analysis outcome
+    /// (`Indeterminate`) instead of a `windows-filesystem-semantic-unverified`
+    /// finding it never made, while a visible destructive spelling still
+    /// denies under its own rule. A caller-proven POSIX command is not judged
+    /// by the Windows pack at all, even when the pack is enabled.
+    #[test]
+    fn issue_569_windows_filesystem_bound_is_incomplete_analysis_not_a_finding() {
+        use crate::normalize::ShellDialect;
+
+        let enabled_keywords = [
+            "del",
+            "erase",
+            "rd",
+            "rmdir",
+            "format",
+            "Remove-Item",
+            "ri",
+            "rm",
+            "Clear-Content",
+            "Clear-RecycleBin",
+        ];
+        let ordered_packs = ["windows.filesystem".to_string()];
+        let keyword_index = crate::packs::REGISTRY.build_enabled_keyword_index(&ordered_packs);
+        let compiled = default_compiled_overrides();
+        let allowlists = default_allowlists();
+        let heredoc_settings = default_config().heredoc_settings();
+        let evaluate = |command: &str,
+                        dialect: ShellDialect,
+                        index: Option<&crate::packs::EnabledKeywordIndex>| {
+            evaluate_command_with_pack_order_deadline_at_path_in_dialect(
+                command,
+                &enabled_keywords,
+                &ordered_packs,
+                index,
+                &compiled,
+                &allowlists,
+                &heredoc_settings,
+                None,
+                None,
+                None,
+                dialect,
+            )
+        };
+
+        let statements = "Write-Output 'rm x'; ".repeat(140);
+        // The generator from the issue at the first failing size. Its `^`
+        // after `(x|y)` and the `ri` inside `print` are what select the pass.
+        let tuples = " ('a', 'b'), ('c', 'd'),\n".repeat(29);
+        let python = format!(
+            "python3 - <<'EOF'\nimport re\ns = 'text'\nR = [\n{tuples}]\nfor m in re.finditer(r'[^\\n]{{0,40}}(x|y)[^\\n]{{0,40}}', s):\n    print(m.group(0))\nEOF"
+        );
+
+        for index in [None, keyword_index.as_ref()] {
+            for (command, dialect) in [
+                (statements.as_str(), ShellDialect::PowerShell),
+                (statements.as_str(), ShellDialect::Unknown),
+                // Where the pack is on and the dialect is Unknown — a Windows
+                // host, which keeps interpreter source as Windows evidence.
+                (python.as
```

**File**: `src/hook.rs` (modified, +166/-4)
```diff
@@ -2854,7 +2854,9 @@ fn command_has_powershell_shape(command: &str) -> bool {
             "command" if segment_has_windows_shape(node.text().as_ref()) => return true,
             // Interpreter source retains conservative Windows evidence:
             // an opaque or aliased sink can pass these strings to a shell.
-            // Only the separately proven data bodies have been masked.
+            // Only the separately proven data bodies have been masked — and,
+            // for pack activation off Windows, the proven inert interpreter
+            // bodies (`command_is_windows_shell_payload_on_host`).
             "heredoc_body" if has_candidate(node.text().as_ref()) => return true,
             _ => {}
         }
@@ -2901,6 +2903,12 @@ pub fn refine_shell_dialect(command: &str, labeled: ShellDialect) -> ShellDialec
     // Unknown, where the fail-closed union denied the commit (issue #412).
     // Everything outside the body is still judged, so a genuinely mislabeled
     // `Remove-Item -Recurse -Force` is down-trusted exactly as before.
+    //
+    // Interpreter source keeps widening the dialect (see the `heredoc_body`
+    // arm of `command_has_powershell_shape`), so the always-on rules still
+    // judge Windows-shaped strings an opaque sink could run. It no longer
+    // activates the disabled `windows.*` packs off Windows: that is
+    // `command_is_windows_shell_payload`'s narrower question (#569).
     let visible = crate::heredoc::mask_non_expanding_data_heredocs(command);
     if command_has_powershell_shape(visible.as_ref()) {
         ShellDialect::Unknown
@@ -2909,6 +2917,67 @@ pub fn refine_shell_dialect(command: &str, labeled: ShellDialect) -> ShellDialec
     }
 }
 
+/// [`command_is_windows_shell_payload`] with the host platform made explicit,
+/// so both sides of its host-dependent interpreter-source rule are testable on
+/// every CI platform.
+///
+/// Activation asks whether the payload IS a Windows-shell payload, which is a
+/// narrower question than whether [`refine_shell_dialect`] should distrust the
+/// label. A proven, quoted non-shell interpreter body (`python3 - <<'PY'`, see
+/// [`crate::heredoc::mask_inert_interpreter_stdin`]) answers it no on a
+/// non-Windows host (#569). Its bytes are Python/JavaScript/… source, and the
+/// heredoc operator around them is itself proof that no PowerShell runs the
+/// payload: PowerShell reserves `<` and rejects the whole script at parse
+/// time, and cmd.exe does not exist there. What the source can hand to a shell
+/// is decided by its own runtime, and off Windows every implicit shell sink
+/// (`os.system`, `shell=True`, `child_process.exec`, Ruby/Perl `system`, PHP
+/// `shell_exec`) is `/bin/sh`. Counting a regex such as
+/// `r'[^\n]{0,40}(x|y)'` (the `^` after `(x|y)` reads as a cmd caret) or prose
+/// such as `install-l` as a Windows payload activated the disabled
+/// `windows.*` packs on Linux/macOS, whose PowerShell and cmd segmenters then
+/// judged the Python source and denied it as
+/// `windows-filesystem-semantic-unverified` — after a statement bound that
+/// 28 harmless lines stayed under and 29 crossed. The source itself still
+/// reaches the raw-shell pack scan, the language analysis and the widened
+/// dialect unchanged (#136, #278).
+///
+/// On a Windows host those implicit sinks run cmd.exe or PowerShell, so the
+/// body keeps its evidence (the packs are on there by default anyway). Off
+/// Windows the remaining routes are named by the text itself, and a command
+/// that names one keeps the evidence too ([`names_windows_shell_route`]): a
+/// PowerShell executable (`f("pwsh -c 'x; Clear-Content db'")` through an
+/// aliased `os.system`), or a Windows `.exe` program, whose shell sinks are
+/// cmd.exe even on a Linux host (WSL interop runs `python.exe - <<'PY'`).
+/// Unquoted delimiters, shell receivers, `-c`/script-file owners, rebound
+/// interpreter names and every other unproven case keep it on every host,
+/// because `mask_inert_interpreter_stdin` declines to mask them.
+fn command_is_windows_shell_payload_on_host(command: &str, host_is_windows: bool) -> bool {
+    let visible = crate::heredoc::mask_non_expanding_data_heredocs(command);
+    if !command_has_powershell_shape(visible.as_ref()) {
+        return false;
+    }
+    if host_is_windows || names_windows_shell_route(command) {
+        return true;
+    }
+    match crate::heredoc::mask_inert_interpreter_stdin(visible.as_ref()) {
+        std::borrow::Cow::Borrowed(_) => true,
+        std::borrow::Cow::Owned(outer) => command_has_powershell_shape(&outer),
+    }
+}
+
+/// Whether `command` names, anywhere and quoted or not, a way for interpreter
+/// source on a non-Windows host to reach a Windows shell: a PowerShell
+/// executable (`pwsh`, `powershell`, any directory or `.exe`) as a whole word,
+/// or any `.exe` program (WSL interop and Wine run them, and their implicit
+/// shell is cmd.exe). Deliberately loose: it
```

**File**: `src/main.rs` (modified, +34/-6)
```diff
@@ -567,9 +567,10 @@ fn push_oversized_scan_windows(out: &mut Vec<String>, command: &str, max_command
 /// `tool_input.command` or native Antigravity `toolCall.args.CommandLine`,
 /// so extract commands leniently and run them through the normal evaluation
 /// pipeline. A proven Deny/Ask publishes the ordinary blocking response;
-/// deadline exhaustion publishes an indeterminate response. Both return the
-/// protocol's exit status. Nothing extractable, a benign command, or a
-/// warn/log match returns `None` to keep the historic fail-open warning path.
+/// deadline exhaustion, or a window whose evaluation could not complete,
+/// publishes an indeterminate response. Both return the protocol's exit
+/// status. Nothing extractable, a benign command, or a warn/log match returns
+/// `None` to keep the historic fail-open warning path.
 ///
 /// Two attribution rules keep this from over-denying and from under-scanning:
 /// - The prefix must name a recognized SHELL tool (`tool_name`/`toolName` or
@@ -704,6 +705,16 @@ fn try_deny_unparseable_payload(
     // "nothing found", not an unknown, so a benign oversized payload keeps
     // failing open exactly as `issue_290_padded_benign_command_still_fails_open`
     // requires.
+    //
+    // A window whose own evaluation could not finish is the same unknown as an
+    // exhausted deadline: the evaluator answered Indeterminate (an incomplete
+    // regex search, a bounded analysis that stopped short — #569 turned the
+    // Windows filesystem statement bound into one — or a nested deadline). It
+    // used to fall through this loop into the fail-open `None`, including on
+    // the LAST window, where the next iteration's deadline check never ran.
+    // Keep it until the scan ends, so a later window's proven Deny still
+    // outranks it, and then publish it instead of allowing.
+    let mut pending_indeterminate: Option<ResolvedCommandOutcome> = None;
     for command in &commands {
         if deadline.is_exceeded() {
             let mut history_writer = if config.history.enabled {
@@ -739,8 +750,10 @@ fn try_deny_unparseable_payload(
         // inert unknown binary — reopening the #322 hole on the oversized path.
         let refined_dialect = hook::refine_shell_dialect(command, shell_dialect);
         let outcome = resolve_hook_command(&eval_context, command, refined_dialect, None);
-        if let ResolvedCommandOutcome::DenyFamily(resolved) = outcome {
-            if matches!(resolved.mode, DecisionMode::Deny | DecisionMode::Ask) {
+        match outcome {
+            ResolvedCommandOutcome::DenyFamily(resolved)
+                if matches!(resolved.mode, DecisionMode::Deny | DecisionMode::Ask) =>
+            {
                 let mut history_writer = if config.history.enabled {
                     let mut writer = create_history_writer(&config.history);
                     writer.limit_drop_wait_to(deadline.remaining().unwrap_or_default());
@@ -758,9 +771,24 @@ fn try_deny_unparseable_payload(
                 drop_history_writer(history_writer);
                 return Some(exit_code);
             }
+            indeterminate @ (ResolvedCommandOutcome::DeadlineExhausted { .. }
+            | ResolvedCommandOutcome::OversizedCommand { .. }) => {
+                pending_indeterminate.get_or_insert(indeterminate);
+            }
+            ResolvedCommandOutcome::DenyFamily(_) | ResolvedCommandOutcome::Allow(_) => {}
         }
     }
-    None
+    let indeterminate = pending_indeterminate?;
+    let mut history_writer = if config.history.enabled {
+        let mut writer = create_history_writer(&config.history);
+        writer.limit_drop_wait_to(deadline.remaining().unwrap_or_default());
+        Some(writer)
+    } else {
+        None
+    };
+    let exit_code = publish_decisive_response(&eval_context, indeterminate, &mut history_writer);
+    drop_history_writer(history_writer);
+    Some(exit_code)
 }
 
 /// Process-wide registry of shutdown actions.
```

**File**: `src/packs/windows/filesystem.rs` (modified, +108/-4)
```diff
@@ -45,12 +45,23 @@ const WINDOWS_FILESYSTEM_UNVERIFIED_REASON: &str = "The Windows filesystem comma
 /// `Unverified` is intentionally distinct from `NoMatch`: the former means a
 /// protected executable or destructive option can be produced only after
 /// runtime shell expansion, so the evaluator must fail closed.
+///
+/// `Incomplete` is distinct from both: the whole-command size or statement
+/// bound stopped the pass before it inspected every statement, so it found
+/// neither a protected role nor proof of its absence. That is an incomplete
+/// analysis, not evidence about any rule, and attributing it to
+/// `windows-filesystem-semantic-unverified` named a finding that did not
+/// exist (#569: 29 lines of quoted Python tuples crossed the statement bound
+/// where 28 did not). The evaluator still runs this pack's patterns, so a
+/// visible destructive spelling denies under its own rule, and otherwise
+/// returns the configured incomplete-analysis outcome (`Indeterminate`).
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 pub(crate) enum WindowsFilesystemSemanticDecision {
     NoMatch,
     Safe,
     Destructive(&'static str),
     Unverified,
+    Incomplete,
 }
 
 #[derive(Debug, Default)]
@@ -1785,6 +1796,7 @@ fn powershell_call_operator_analysis(command: &str) -> PowerShellCallOperatorAna
     let mut saw_word_in_statement = false;
     let mut saw_safe = false;
     let mut saw_unverified = false;
+    let mut saw_incomplete = false;
     let mut inert_target_spans = Vec::new();
 
     for (index, token) in tokens.iter().enumerate() {
@@ -1855,6 +1867,7 @@ fn powershell_call_operator_analysis(command: &str) -> PowerShellCallOperatorAna
                             };
                         }
                         WindowsFilesystemSemanticDecision::Unverified => saw_unverified = true,
+                        WindowsFilesystemSemanticDecision::Incomplete => saw_incomplete = true,
                         WindowsFilesystemSemanticDecision::Safe => saw_safe = true,
                         WindowsFilesystemSemanticDecision::NoMatch => {}
                     }
@@ -1866,6 +1879,8 @@ fn powershell_call_operator_analysis(command: &str) -> PowerShellCallOperatorAna
 
     let decision = if saw_unverified {
         Some(WindowsFilesystemSemanticDecision::Unverified)
+    } else if saw_incomplete {
+        Some(WindowsFilesystemSemanticDecision::Incomplete)
     } else if saw_safe {
         Some(WindowsFilesystemSemanticDecision::Safe)
     } else {
@@ -1954,6 +1969,10 @@ pub(crate) fn windows_filesystem_semantic_decision_in_dialect(
         if decisions.contains(&WindowsFilesystemSemanticDecision::Unverified) {
             return WindowsFilesystemSemanticDecision::Unverified;
         }
+        // A view that gave up cannot be cleared by a view that finished.
+        if decisions.contains(&WindowsFilesystemSemanticDecision::Incomplete) {
+            return WindowsFilesystemSemanticDecision::Incomplete;
+        }
         return if decisions.contains(&WindowsFilesystemSemanticDecision::Safe) {
             WindowsFilesystemSemanticDecision::Safe
         } else {
@@ -1963,9 +1982,11 @@ pub(crate) fn windows_filesystem_semantic_decision_in_dialect(
 
     if command.len() > MAX_WINDOWS_FILESYSTEM_SEMANTIC_BYTES {
         // Do not allocate or tokenize an attacker-controlled oversized shell
-        // program.  Callers invoke this pass only for the enabled Windows pack;
-        // failing closed is the only sound bounded result.
-        return WindowsFilesystemSemanticDecision::Unverified;
+        // program.  Callers invoke this pass only for the enabled Windows pack,
+        // and an unanalyzed program is never a clean one: the evaluator turns
+        // this into the configured incomplete-analysis outcome unless one of
+        // the pack's own patterns denies first.
+        return WindowsFilesystemSemanticDecision::Incomplete;
     }
 
     if dialect == ShellDialect::PowerShell {
@@ -2021,20 +2042,25 @@ pub(crate) fn windows_filesystem_semantic_decision_in_dialect(
 
     let segments = crate::packs::split_command_segments_in_dialect(command, dialect);
     if segments.len() > MAX_WINDOWS_FILESYSTEM_SEMANTIC_SEGMENTS {
+        // The statement bound stops the pass before any statement is read, so
+        // a protected spelling or dialect escape somewhere in the text is only
+        // a reason the analysis was needed, not a finding (#569).
         return if has_dialect_syntax || has_literal_keyword {
-            WindowsFilesystemSemanticDecision::Unverified
+            WindowsFilesystemSemanticDecision::Incomplete
         } else {
             WindowsFilesystemSemanticDecision::NoMatch
         };
     }
     let mut saw_safe = false;
     let mut saw_unverified = false;
+    let mut saw_incomplete = false;
     let call_analysis = if dialect == ShellDialect::PowerShell {
         let analysis = powershell_call_operator_analysis(command);
         if let Some(dec
```

**File**: `tests/repro_290_oversized_hook_input.rs` (modified, +61/-4)
```diff
@@ -388,10 +388,21 @@ fn issue_290_oversized_envelope_without_tool_name_is_not_denied() {
 /// Run dcg on a raw oversized payload with `windows.filesystem` enabled, so
 /// the PowerShell/cmd rules participate (they are default-off on Unix).
 fn run_hook_raw_windows(input: &str, home: &Path) -> (String, String, i32) {
+    run_hook_raw_windows_with_budget(input, home, None)
+}
+
+/// As [`run_hook_raw_windows`], with an explicit hook budget in milliseconds
+/// (`None` keeps the shipped default).
+fn run_hook_raw_windows_with_budget(
+    input: &str,
+    home: &Path,
+    budget_ms: Option<u64>,
+) -> (String, String, i32) {
     let config_path = home.join("dcg-test-config.toml");
     fs::write(&config_path, "").expect("failed to write empty config");
 
-    let mut child = Command::new(dcg_binary())
+    let mut command = Command::new(dcg_binary());
+    command
         .stdin(Stdio::piped())
         .stdout(Stdio::piped())
         .stderr(Stdio::piped())
@@ -405,9 +416,16 @@ fn run_hook_raw_windows(input: &str, home: &Path) -> (String, String, i32) {
             "DCG_PENDING_EXCEPTIONS_PATH",
             home.join("pending_exceptions.jsonl"),
         )
-        .env_remove("DCG_FAIL_CLOSED")
-        .spawn()
-        .expect("failed to spawn dcg process");
+        .env_remove("DCG_FAIL_CLOSED");
+    match budget_ms {
+        Some(ms) => {
+            command.env("DCG_HOOK_TIMEOUT_MS", ms.to_string());
+        }
+        None => {
+            command.env_remove("DCG_HOOK_TIMEOUT_MS");
+        }
+    }
+    let mut child = command.spawn().expect("failed to spawn dcg process");
 
     {
         let stdin = child.stdin.as_mut().expect("failed to get stdin");
@@ -459,6 +477,45 @@ fn issue_322_oversized_mislabeled_powershell_is_denied() {
     );
 }
 
+/// #569: the Windows filesystem pass reports a command past its statement
+/// bound as an incomplete analysis (Indeterminate) rather than an
+/// `Unverified` deny. This window scan used to publish only Deny/Ask and its
+/// own deadline check, so a window's Indeterminate fell into the fail-open
+/// branch: a spelling the pack's regexes cannot see (a cmd caret) behind more
+/// statements than the bound would have been ALLOWED once padded past the
+/// input limit. The budget is generous so the answer comes from the analysis
+/// bound, not from the clock; `echo rm` only gets the window past the keyword
+/// quick reject.
+#[test]
+fn issue_569_incomplete_window_analysis_on_an_oversized_payload_is_not_allowed() {
+    let temp = tempfile::tempdir().expect("tempdir");
+    let command = format!(
+        "echo rm & r^d /s /q C:\\src & {}{}",
+        "echo a & ".repeat(140),
+        "A".repeat(PADDING_BYTES)
+    );
+    let input = serde_json::json!({
+        "tool_name": "Bash",
+        "tool_input": { "command": command }
+    })
+    .to_string();
+    assert!(input.len() > 256 * 1024, "envelope must exceed the limit");
+
+    let (stdout, stderr, exit_code) =
+        run_hook_raw_windows_with_budget(&input, temp.path(), Some(5000));
+    assert_eq!(exit_code, 0, "hook mode exits 0\nstderr: {stderr}");
+    let json: serde_json::Value = serde_json::from_str(stdout.trim()).unwrap_or_else(|e| {
+        panic!("expected a blocking JSON verdict ({e}); stdout: {stdout:?}\nstderr: {stderr}")
+    });
+    let decision = json["hookSpecificOutput"]["permissionDecision"]
+        .as_str()
+        .unwrap_or_default();
+    assert!(
+        matches!(decision, "deny" | "ask"),
+        "an incompletely analyzed window must not fail open, got: {stdout:?}"
+    );
+}
+
 /// #322 fresh-eyes follow-up (normal size): a `Bash`-labeled PowerShell
 /// alias invocation (`rm -Recurse -Force`) is widened and denied by the
 /// windows pack. Proves the alias-widening signal end-to-end, not just at
```

**File**: `tests/repro_567_569_quoted_interpreter_source.rs` (added, +406/-0)
```diff
@@ -0,0 +1,406 @@
+//! Issues #567 and #569: the source of a quoted `python3 - <<'EOF'` heredoc
+//! judged by shell-level rules.
+//!
+//! #569: on Linux/macOS a quoted Python heredoc whose source merely looked
+//! Windows-shaped (a regex `r'[^\n]{0,40}(x|y)'`, prose such as `install-l`)
+//! widened the `Bash` label to `Unknown`, activated the disabled `windows.*`
+//! packs, and was denied as `windows.filesystem:windows-filesystem-semantic-
+//! unverified` by the hook while `dcg explain`/`dcg test` disagreed. Whether
+//! it denied depended on body length (28 lines allowed, 29 denied).
+//!
+//! #567: an external pack's separator-anchored regex matches lines of the same
+//! kind of body. External packs see exactly the view built-in packs see — the
+//! conservative raw-shell scan of interpreter source that #136's revert keeps —
+//! so the pinned property here is parity, plus every executed-shell route.
+//!
+//! Every fixture is classifier input only; nothing is executed. The hook runs
+//! on a non-Windows host here, which is the platform both reports came from.
+
+#![cfg(unix)]
+
+use std::io::Write;
+use std::process::{Command, Stdio};
+
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+enum Route {
+    /// The plain PreToolUse hook, as the reports ran it.
+    Hook,
+    /// `dcg hook --batch`, the bulk hook entry point.
+    Batch,
+    /// `dcg test --dialect posix`.
+    CliPosix,
+}
+
+const ROUTES: [Route; 3] = [Route::Hook, Route::Batch, Route::CliPosix];
+
+#[derive(Debug, Clone, PartialEq, Eq)]
+struct Verdict {
+    /// `allow`, `deny` or `indeterminate`.
+    decision: String,
+    rule: Option<String>,
+}
+
+/// The external pack from #567, verbatim.
+const AWS_PACK: &str = "schema_version: 1
+id: custom.repro
+name: Repro
+version: 1.0.0
+description: Minimal repro pack.
+keywords:
+  - aws
+
+destructive_patterns:
+  - name: aws-invocation
+    pattern: (?:^|[;&|()\\n])[ \\t]*aws\\b
+    description: Block AWS CLI invocations.
+    severity: high
+";
+
+fn classify(source: &str, external_pack: bool, route: Route) -> Verdict {
+    let temp = tempfile::tempdir().expect("isolated working directory");
+    let home = temp.path().join("home");
+    std::fs::create_dir(&home).expect("isolated home");
+    let mut command = Command::new(env!("CARGO_BIN_EXE_dcg"));
+    let hook_input = serde_json::json!({
+        "hook_event_name": "PreToolUse",
+        "tool_name": "Bash",
+        "tool_input": {"command": source},
+    })
+    .to_string();
+    let input = match route {
+        Route::Hook => {
+            command.args(["--agent", "claude-code"]);
+            hook_input
+        }
+        Route::Batch => {
+            command.args(["hook", "--batch"]);
+            hook_input
+        }
+        Route::CliPosix => {
+            command.args(["test", "--stdin", "--dialect", "posix", "--format", "json"]);
+            source.to_string()
+        }
+    };
+    command
+        .env_clear()
+        .env("HOME", &home)
+        .env("USERPROFILE", &home)
+        .env("XDG_CONFIG_HOME", home.join(".config"))
+        .env("DCG_ALLOWLIST_SYSTEM_PATH", "")
+        .env("DCG_NO_SELF_HEAL", "1")
+        .env("DCG_SELF_HEAL_HOOK", "0")
+        .env("DCG_HISTORY_DISABLED", "1")
+        // Semantic tests use the existing #412/#438 test envelopes so a slow
+        // worker cannot turn a decision into a budget verdict.
+        .env("DCG_HOOK_TIMEOUT_MS", "5000")
+        .env("DCG_AST_TIMEOUT_MS", "5000")
+        .current_dir(temp.path());
+    if external_pack {
+        let pack = temp.path().join("fp-pack.yaml");
+        std::fs::write(&pack, AWS_PACK).expect("write pack");
+        let config = temp.path().join("config.toml");
+        std::fs::write(
+            &config,
+            format!(
+                "[packs]\nenabled = [\"custom.repro\"]\ncustom_paths = [{}]\n\n[heredoc]\nenabled = true\n",
+                serde_json::to_string(&pack).expect("pack path")
+            ),
+        )
+        .expect("write config");
+        command.env("DCG_CONFIG", &config);
+    }
+    let mut child = command
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .spawn()
+        .expect("spawn classifier");
+    child
+        .stdin
+        .take()
+        .expect("piped stdin")
+        .write_all(input.as_bytes())
+        .expect("write classifier input");
+    let output = child.wait_with_output().expect("wait for classifier");
+    let stdout = String::from_utf8_lossy(&output.stdout);
+    let stderr = String::from_utf8_lossy(&output.stderr);
+    if route == Route::Hook && stdout.trim().is_empty() {
+        assert!(output.status.success(), "{source:?}: {stderr}");
+        return Verdict {
+            decision: "allow".to_string(),
+            rule: None,
+        };
+    }
+    let value: serde_json::Value = serde_json::from_str(stdout.trim()).unwrap_or_else(|error| {
+        panic!("{route:?} {source:?}: {error}; 
```

---

### Incident Patch 2: `bb4e8321` (2026-10-19)
**Commit Message**: fix(heredoc): stop optional proofs from pre-empting or cross-talking (#565)

Seven red heredoc tests on main traced to four defects plus two stale
expectations.

Incomplete interpreter literal recovery pre-empted every later layer.
exec_sink_pack_verdict (#544, 467a3be) returned
indeterminate_due_to_budget() for ANY recovery error: a Python/JS grammar
error, a node/literal limit, its own 20 ms budget, or a busy worker. That
returned straight out of evaluate_heredoc, so the packs never ran:
`python3 -c '...os.system(sys.stdin.read())' <<'PY'` lost the
core.filesystem:git-internals-write denial of the body it executes, and
the hook reported a grammar error as "could not complete safety evaluation
within 5000ms". The error is now recorded on the evaluation's
incomplete-analysis scope (the existing RegexEvaluationScope contract):
a later positive finding still denies, and every would-be allow becomes
Indeterminate at the evaluation boundary. An exhausted deadline, or a
caller with no scope to carry the record, still stops immediately.
Invalid interpreter source therefore stays Indeterminate, as the #544
CHANGELOG ("unverified or incomplete analysis cannot silently approve a
command") a

**File**: `src/ast_source_analysis.rs` (modified, +14/-5)
```diff
@@ -990,9 +990,18 @@ pub(super) fn interpreter_literal_shell_commands_with_execution_evidence(
         return Err(interpreter_literal_timeout(started, budget));
     }
     // A timed-out parser retains its permit until its source and AST are gone;
-    // subsequent requests cannot leave an unbounded number of workers running.
-    static ACTIVE: AtomicBool = AtomicBool::new(false);
-    if ACTIVE
+    // subsequent requests from the same evaluator cannot leave an unbounded
+    // number of workers running. The slot belongs to the evaluating thread,
+    // not the process: a process-wide slot made a concurrent evaluation (the
+    // MCP server, a parallel hook batch, parallel tests) report this analysis
+    // as unavailable — an Indeterminate verdict for a benign program — merely
+    // because another command was being analysed at the same moment (#565).
+    thread_local! {
+        static ACTIVE: std::sync::Arc<AtomicBool> =
+            std::sync::Arc::new(AtomicBool::new(false));
+    }
+    let active = ACTIVE.with(std::sync::Arc::clone);
+    if active
         .compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed)
         .is_err()
     {
@@ -1001,13 +1010,13 @@ pub(super) fn interpreter_literal_shell_commands_with_execution_evidence(
             detail: "interpreter literal analysis is still busy".into(),
         });
     }
-    struct Permit(&'static AtomicBool);
+    struct Permit(std::sync::Arc<AtomicBool>);
     impl Drop for Permit {
         fn drop(&mut self) {
             self.0.store(false, Ordering::Release);
         }
     }
-    let permit = Permit(&ACTIVE);
+    let permit = Permit(active);
     let _phase = crate::perf::phase(crate::perf::ProfilePhase::AstMatch);
     let source = code.to_string();
     let (sender, receiver) = mpsc::sync_channel(1);
```

**File**: `src/evaluator.rs` (modified, +149/-45)
```diff
@@ -499,8 +499,10 @@ pub struct EvaluationResult {
     pub effective_mode: Option<crate::packs::DecisionMode>,
     /// Whether evaluation skipped deeper analysis due to a deadline overrun.
     pub skipped_due_to_budget: bool,
-    /// A regex failed during this request. Positive evidence may still deny,
-    /// but a policy/confidence downgrade cannot authorize incomplete work.
+    /// A regex, or an optional embedded-source proof such as interpreter
+    /// literal recovery, failed during this request. Positive evidence may
+    /// still deny, but a policy/confidence downgrade cannot authorize
+    /// incomplete work.
     pub regex_evaluation_incomplete: bool,
     /// Whether the evaluator proved that no enabled-pack keyword was present
     /// and returned through the bounded quick-reject fast path.
@@ -14105,7 +14107,8 @@ fn evaluate_command_with_pack_order_deadline_at_path_inner(
     // A positive denial remains decisive. An exact-command grant explicitly
     // authorizes the whole request. Every other would-be allow (including a
     // warn/log result or a rule-scoped exemption) requires complete analysis.
-    // A failed regex search is not a successful proof that no rule matched.
+    // A failed regex search is not a successful proof that no rule matched,
+    // and neither is an embedded-source proof that could not finish.
     if scope.has_failed() && result.bypass_method != Some(BypassMethod::AllowOnce) {
         if result.decision != EvaluationDecision::Deny {
             result = EvaluationResult {
@@ -15153,10 +15156,17 @@ fn mask_proven_interpreter_documentation(command: &str) -> Cow<'_, str> {
     // The deadline covers extraction and both the Bash receiver proof and
     // the Python/JavaScript parse. Node/byte limits alone do not bound the
     // parser's wall time (git_safety_guard-bl1c).
-    static ACTIVE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
+    //
+    // One worker slot per evaluating thread, not per process: concurrent
+    // evaluations (the MCP server, a parallel hook batch, parallel tests)
+    // must not lose each other's proof merely by overlapping (#565).
+    thread_local! {
+        static ACTIVE: std::sync::Arc<std::sync::atomic::AtomicBool> =
+            std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
+    }
     let source = command.to_string();
     run_documentation_mask_worker(
-        &ACTIVE,
+        ACTIVE.with(std::sync::Arc::clone),
         crate::ast_matcher::protected_scan_budget(),
         move || match mask_proven_interpreter_documentation_inner(&source) {
             Cow::Owned(masked) => Some(masked),
@@ -15166,11 +15176,11 @@ fn mask_proven_interpreter_documentation(command: &str) -> Cow<'_, str> {
     .map_or(Cow::Borrowed(command), Cow::Owned)
 }
 
-/// At most one parser may outlive its optional documentation proof. The
-/// permit remains owned through timeout or panic until analysis finishes; a
-/// busy slot keeps the conservative source view instead of spawning more work.
+/// At most one parser per slot may outlive its optional documentation proof.
+/// The permit remains owned through timeout or panic until analysis finishes;
+/// a busy slot keeps the conservative source view instead of spawning more work.
 fn run_documentation_mask_worker(
-    active: &'static std::sync::atomic::AtomicBool,
+    active: std::sync::Arc<std::sync::atomic::AtomicBool>,
     budget: std::time::Duration,
     analyze: impl FnOnce() -> Option<String> + Send + 'static,
 ) -> Option<String> {
@@ -15184,7 +15194,7 @@ fn run_documentation_mask_worker(
     {
         return None;
     }
-    struct Permit(&'static std::sync::atomic::AtomicBool);
+    struct Permit(std::sync::Arc<std::sync::atomic::AtomicBool>);
     impl Drop for Permit {
         fn drop(&mut self) {
             self.0.store(false, Ordering::Release);
@@ -32276,7 +32286,27 @@ fn exec_sink_pack_verdict(
         Ok(commands) => commands,
         Err(error) => {
             tracing::debug!(%error, "interpreter literal analysis did not complete");
-            return Some(EvaluationResult::indeterminate_due_to_budget());
+            // An optional recovery that could not finish (a grammar error, a
+            // node/literal limit, its own 20 ms budget) is neither evidence
+            // about the program nor exhaustion of the hook deadline. Returning
+            // a budget Indeterminate here pre-empted every later layer — so
+            // `python3 -c '…os.system(sys.stdin.read())' <<'PY'` lost the pack
+            // denial of the body it executes — and reported a grammar error as
+            // "could not complete safety evaluation within 5000ms" (#565).
+            // Record the incomplete analysis for the request instead: a later
+            // positive finding still denies, and every would-be allow becomes
+            // Indeterminate at the evaluation boundary. Only an exhausted
+            // deadlin
```

**File**: `src/heredoc.rs` (modified, +328/-36)
```diff
@@ -47,7 +47,7 @@ use regex::RegexSet;
 use std::borrow::Cow;
 use std::ops::Range;
 use std::sync::atomic::{AtomicBool, Ordering};
-use std::sync::{LazyLock, mpsc};
+use std::sync::{Arc, LazyLock, mpsc};
 use std::time::{Duration, Instant};
 use tracing::{debug, instrument, trace, warn};
 
@@ -8522,6 +8522,11 @@ pub(crate) fn mask_inert_interpreter_stdin(command: &str) -> Cow<'_, str> {
 /// extra operands, redirects, substitutions, pipelines or continued commands.
 fn direct_interpreter_stdin_owner(command: &str, operator_start: usize) -> bool {
     let owner = plain_heredoc_command_at(command, operator_start).or_else(|| {
+        // A heredoc ending an `&&`/`||` list belongs to the list's last
+        // command; that is an AST proof, not the looser recovery below.
+        if let Some(tail) = list_tail_heredoc_command_at(command, operator_start) {
+            return Some(tail);
+        }
         // A size or parser-work failure cannot justify weaker ownership.
         if command.len() > MAX_SUBSTITUTION_SOURCE_BYTES
             || longest_pipeline_stages(command) > MAX_PARSED_PIPELINE_STAGES
@@ -8556,15 +8561,8 @@ fn direct_interpreter_stdin_owner(command: &str, operator_start: usize) -> bool
         }
         let words = shell_words::split(header).ok()?;
         let (program, arguments) = words.split_first()?;
-        let name = program.rsplit(['/', '\\']).next().unwrap_or(program);
-        if !matches!(
-            ScriptLanguage::from_command(name),
-            ScriptLanguage::Python
-                | ScriptLanguage::JavaScript
-                | ScriptLanguage::Ruby
-                | ScriptLanguage::Perl
-                | ScriptLanguage::Php
-        ) || !(arguments.is_empty() || matches!(arguments, [arg] if arg == "-"))
+        if !is_non_shell_interpreter_stdin_command(program)
+            || !(arguments.is_empty() || matches!(arguments, [arg] if arg == "-"))
         {
             return None;
         }
@@ -8579,15 +8577,13 @@ fn direct_interpreter_stdin_owner(command: &str, operator_start: usize) -> bool
     let Some((program, arguments)) = words.split_first() else {
         return false;
     };
-    let name = program.rsplit(['/', '\\']).next().unwrap_or(program);
-    matches!(
-        ScriptLanguage::from_command(name),
-        ScriptLanguage::Python
-            | ScriptLanguage::JavaScript
-            | ScriptLanguage::Ruby
-            | ScriptLanguage::Perl
-            | ScriptLanguage::Php
-    ) && (arguments.is_empty() || matches!(arguments, [arg] if arg == "-"))
+    // The receiver-name contract is `is_non_shell_interpreter_stdin_command`
+    // (#357: python/node/deno/bun/ruby/perl/php/go); this proof adds only
+    // the operand rule. Keeping a narrower private language list here
+    // silently withdrew the #357 exemption from deno/bun/go when #560 made
+    // every exemption consumer require this proof.
+    is_non_shell_interpreter_stdin_command(program)
+        && (arguments.is_empty() || matches!(arguments, [arg] if arg == "-"))
 }
 /// A quoted cat or tee body written verbatim and immediately read by a concrete
 /// interpreter. This proof supplies a language, never an allow:
@@ -8679,6 +8675,29 @@ pub(crate) fn range_is_quoted_interpreter_source(
         let Some(mut body) = inert_interpreter_stdin_body(command, heredoc) else {
             return false;
         };
+        // `<<-` strips leading tabs from every body line and from the
+        // terminator line. tree-sitter's body span starts after the first
+        // line's tabs and keeps the terminator line's tabs after the final
+        // newline; the extractor's raw span keeps the former and drops the
+        // latter. Reconcile only those two tab runs (plus the newline below).
+        // The analysed program is the extractor's tab-stripped content,
+        // which is exactly what the interpreter reads (#560).
+        let tab_stripped = command
+            .get(heredoc.operator_start..)
+            .is_some_and(|rest| rest.starts_with("<<-"));
+        if tab_stripped {
+            let Some(text) = command.get(body.clone()) else {
+                return false;
+            };
+            body.end -= text.len() - text.trim_end_matches('\t').len();
+            if range.start < body.start
+                && command
+                    .get(range.start..body.start)
+                    .is_some_and(|gap| gap.bytes().all(|byte| byte == b'\t'))
+            {
+                body.start = range.start;
+            }
+        }
         let Some(text) = command.get(body.clone()) else {
             return false;
         };
@@ -9403,6 +9422,90 @@ pub(crate) fn plain_heredoc_command_at(command: &str, operator_start: usize) ->
     None
 }
 
+/// The command owning a heredoc that ends an `&&`/`||` list.
+///
+/// tree-sitter-bash hangs a trailing heredoc on the whole list
+/// (`cd dir && python3 - <<'PY'`), although the shell gives it to the list's
+/// last simple command
```

**File**: `src/packs/regex_engine.rs` (modified, +22/-0)
```diff
@@ -58,6 +58,28 @@ impl Drop for RegexEvaluationScope {
     }
 }
 
+/// Record that an optional embedded-source proof (the interpreter literal
+/// recovery) could not complete for the active evaluation, under the same
+/// contract as a failed regex: positive evidence may still deny, but no
+/// would-be allow or downgrade can authorize the incomplete request.
+///
+/// Returns `false` when no evaluation scope is active on this thread; the
+/// caller then has nobody to carry the record and must fail closed itself.
+pub(crate) fn record_incomplete_analysis(
+    stage: &'static str,
+    error: &impl std::fmt::Display,
+) -> bool {
+    let recorded = EVALUATION_FAILURES.with(|stack| {
+        stack.borrow_mut().last_mut().is_some_and(|failed| {
+            *failed = true;
+            true
+        })
+    });
+    // Diagnostics contain no submitted command text.
+    tracing::debug!(target: "dcg_perf", stage, error = %error, recorded, "analysis incomplete");
+    recorded
+}
+
 fn record_evaluation_failure(stage: &'static str, error: &impl std::fmt::Display) {
     EVALUATION_FAILURES.with(|stack| {
         if let Some(failed) = stack.borrow_mut().last_mut() {
```

**File**: `tests/corpus/false_positives/heredoc_data.toml` (modified, +16/-2)
```diff
@@ -183,6 +183,20 @@ expected = "allow"
 # bodies. The bodies are NOT masked: the literal cases in
 # true_positives/git_destructive.toml prove they still flow through the
 # conservative raw-shell scan (#136/#278).
+#
+# Since #544 a body carrying substitution markers (`$(`, backticks, `\`) is
+# also read as Python/JavaScript source by the bounded literal recovery, and
+# "unverified or incomplete analysis cannot silently approve a command"
+# (CHANGELOG, #544). fb60af1 applied that to these exact shapes: raw Markdown
+# fed to `python3 -` and the raw #363 prose assert Indeterminate, and the
+# prose inside `print("""…""")` is the allow case. The old #357 node and #363
+# fixtures were such invalid programs. That recovery also runs under the
+# production 20 ms budget here (this harness sets no DCG_AST_TIMEOUT_MS), so
+# a fixture that triggers it is load-dependent. The two cases below therefore
+# test the same outer-shell boundary with valid, trigger-free programs; the
+# `$(…)` and backticked forms, valid and invalid, are pinned with a test
+# budget by the evaluator's `quoted_interpreter_heredoc_is_not_dynamic_branch_evidence_357`
+# and `placeholder_gt_in_quoted_interpreter_body_is_not_a_redirect_363`.
 # ============================================================================
 
 [[case]]
@@ -192,7 +206,7 @@ expected = "allow"
 
 [[case]]
 description = "quoted node heredoc body is not dynamic-branch evidence (#357)"
-command = "node - <<'JS'\ngit branch $(cat name)\nJS"
+command = "node - <<'JS'\n// git branch $name\nconsole.log(\"git branch ${name}\", 'git branch $name');\nJS"
 expected = "allow"
 
 [[case]]
@@ -212,7 +226,7 @@ expected = "allow"
 
 [[case]]
 description = "doc prose with <x> placeholders in a quoted python heredoc (#363)"
-command = "python3 - <<'PYEOF'\n- `DATA_DIR` resolves *inside each instance*: `~/.app/instances/<i>/store-data/` — sqlite `index.db` (+ `-wal`/`-shm`) plus `logs/`, `records/`, `blocks/`, `.meta/`, `.backup/`.\n- Every instance's `gw.json` is identically `{\"search\": {\"bm25\": {\"language\": \"en\"}}}` — the **local** backend. No cloud block on any instance.\n- The package DOES ship a Cloud client (`~/.app/plugins/vendor-plugin/src/core/store/client.ts`, wants `url`/`user`/`apiKey`, auth header `Bearer acct=x&api_key=y`) — but it is **dormant**. No url/user/apiKey exists in any instance `.env`, any gw config, or anywhere under `~/.app`.\nPYEOF"
+command = "python3 - <<'PYEOF'\nprint(\"\"\"- DATA_DIR resolves *inside each instance*: ~/.app/instances/<i>/store-data/ — sqlite index.db (+ -wal/-shm) plus logs/, records/, blocks/, .meta/, .backup/.\n- Every instance's gw.json is identically {\"search\": {\"bm25\": {\"language\": \"en\"}}} — the **local** backend. No cloud block on any instance.\n- The package DOES ship a Cloud client (~/.app/plugins/vendor-plugin/src/core/store/client.ts, wants url/user/apiKey, auth header Bearer acct=x&api_key=y) — but it is **dormant**. No url/user/apiKey exists in any instance .env, any gw config, or anywhere under ~/.app.\n\"\"\")\nPYEOF"
 expected = "allow"
 
 [[case]]
```

---

### Incident Patch 3: `0e40cc0f` (2026-10-20)
**Commit Message**: fix(filesystem,heredoc): keep literal-temp and mktemp proofs inside verified inline scripts (#576, #554)

#576: `sh -c 'rm -rf /tmp/probe'`, `bash -c 'rm -rf /tmp/probe'` and
`sh -c 'rm -rf /var/tmp/probe'` were denied as core.filesystem:rm-rf-root-home
while the same text is allowed at top level and through eval, sudo and ssh.
The core rm parser was never involved: the outer segment's executable is
`sh`, so the parser returned NoMatch and the fallback rm regexes matched the
script's own bytes (`rm -rf /` of `/tmp/probe`) in the outer view, where the
inline-payload quote check classifies them as live code. The script is
evaluated again as its own top-level text, where the literal-temp exemption
applies; only the outer reading lacked it. bb3a7d1 had already refined the
heredoc.bash AST rule for the same script.

An outer recursive-rm regex hit now stands down only when it lies inside a
script whose bytes reach the shell unchanged (literal_bash_source_range: a
single-quoted `-c` script of a literal POSIX shell that owns the command, a
quoted heredoc body, or a direct ssh payload) and the whole script passes the
literal_temp_rm proof bb3a7d1 uses for the AST rule: one literal rm argv,

**File**: `src/ast_matcher.rs` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ mod tempfile_provenance;
 
 pub use source_analysis::*;
 
+pub(crate) use bash_temp_policy::literal_temp_rm;
+
 use crate::heredoc::ScriptLanguage;
 use std::ops::Deref;
 use std::sync::LazyLock;
```

**File**: `src/ast_matcher/bash_temp_policy.rs` (modified, +5/-1)
```diff
@@ -18,7 +18,11 @@ fn is_recursive_rm_rule(rule: &str) -> bool {
 /// The lexical screen proves a single literal argv and bounds the destination
 /// shape. Core's existing parser must independently approve the complete command.
 /// Never borrow a custom core-rule grant for a root or traversing destination.
-fn literal_temp_rm(command: &str) -> bool {
+///
+/// The evaluator applies the same proof to the outer core rm rules when they
+/// match the text of a verified literal inline shell payload (#576), so both
+/// views of one payload share a single definition of literal temp cleanup.
+pub(crate) fn literal_temp_rm(command: &str) -> bool {
     if command.len() > MAX_LITERAL_COMMAND_BYTES {
         return false;
     }
```

**File**: `src/evaluator.rs` (modified, +341/-6)
```diff
@@ -26064,7 +26064,17 @@ fn literal_bash_source_range(
             })
             .then(|| range.clone());
     }
-    if !bash || nonlocal {
+    // `ssh destination '<script>'` hands these exact single-quoted bytes to
+    // the remote shell as its command line: the inline counterpart of the
+    // quoted `ssh destination <<'EOF'` body above (#554). The same POSIX
+    // receiver model applies, and so does the #534 boundary: the proofs that
+    // consume this range are lexical (literal /tmp bindings, `mktemp -d`
+    // folds) and the evaluation that uses them keeps the remote filesystem
+    // scope, so nothing from the caller's filesystem is borrowed. The AST
+    // walk below still requires the exact `ssh destination '<script>'` argv.
+    let ssh_inline =
+        content.heredoc_type.is_none() && content.target_command.as_deref() == Some("ssh");
+    if (!bash || nonlocal) && !ssh_inline {
         return None;
     }
     let ast = crate::heredoc::try_parse_shell_ast(command).ok()?;
@@ -26087,18 +26097,30 @@ fn literal_bash_source_range(
                 .children()
                 .filter(ast_grep_core::Node::is_named)
                 .collect();
-            let [program, flag, argument] = words.as_slice() else {
+            let [program, operand, argument] = words.as_slice() else {
                 return None;
             };
+            let program_name = program.text();
+            let operand_text = operand.text();
+            // A local POSIX shell's `-c` script, or (only for an extracted
+            // ssh payload) a direct ssh session with one literal destination
+            // and no options: options and remote argv words are outside this
+            // proof, exactly as they are for the heredoc receiver.
+            let shell_script = bash
+                && !nonlocal
+                && literal_posix_shell_program(program_name.as_ref())
+                && operand_text.as_ref() == "-c";
+            let ssh_script = ssh_inline
+                && matches!(program_name.as_ref(), "ssh" | "/bin/ssh" | "/usr/bin/ssh")
+                && literal_ssh_destination(operand_text.as_ref());
             if program.kind().as_ref() != "command_name"
-                || !literal_posix_shell_program(program.text().as_ref())
-                || flag.kind().as_ref() != "word"
-                || flag.text().as_ref() != "-c"
+                || operand.kind().as_ref() != "word"
+                || !(shell_script || ssh_script)
                 || argument.range() != node.range()
                 || crate::heredoc::stdin_data_sink_may_be_overridden(
                     command,
                     program.range().end,
-                    program.text().as_ref(),
+                    program_name.as_ref(),
                 )
             {
                 return None;
@@ -26131,6 +26153,18 @@ fn literal_posix_shell_program(program: &str) -> bool {
     matches!(name, "bash" | "sh" | "dash" | "ksh" | "zsh")
 }
 
+/// An ssh destination the local shell passes through unchanged: one plain
+/// word that cannot be an option and carries no expansion, quoting or glob.
+/// Any other spelling could add ssh options or remote argv words in front of
+/// the script, which the inline ssh ownership proof does not model.
+fn literal_ssh_destination(word: &str) -> bool {
+    !word.is_empty()
+        && !word.starts_with('-')
+        && word.bytes().all(|byte| {
+            byte.is_ascii_alphanumeric() || matches!(byte, b'@' | b'.' | b'_' | b'-' | b':')
+        })
+}
+
 /// Keep proven redirects tied to their owning embedded Bash body. These
 /// offsets stand down only the dynamic-target rule; they never hide a second
 /// redirect, a shell command, or bytes in another interpreter's source.
@@ -30149,6 +30183,101 @@ fn range_intersects_conservatively_scanned_interpreter_input(
     })
 }
 
+/// The `core.filesystem` regex rules that read recursive `rm` syntax.
+fn is_core_filesystem_recursive_rm_rule(pack_id: &str, name: Option<&str>) -> bool {
+    pack_id == "core.filesystem"
+        && matches!(
+            name,
+            Some(
+                "rm-rf-root-home"
+                    | "rm-r-f-separate-root-home"
+                    | "rm-recursive-force-root-home"
+                    | "rm-rf-general"
+                    | "rm-r-f-separate"
+                    | "rm-recursive-force-long"
+            )
+        )
+}
+
+/// Whether a recursive-`rm` regex hit lies inside a verified literal shell
+/// script that is, as a whole, one literal cleanup of `/tmp` or `/var/tmp`
+/// descendants (#576).
+///
+/// The outer command's view still contains the script's bytes, so
+/// `sh -c 'rm -rf /tmp/probe'` matched `rm-rf-root-home` on `rm -rf /`: the
+/// core rm parser, which grants the literal-temp exemption, only ever sees
+/// `sh` as this segment's executable. The script itself is evaluated again as
+/// its own top-level text, where that exemption applies, and the hit here is
+///
```

**File**: `tests/repro_534_nonlocal_filesystem.rs` (modified, +52/-0)
```diff
@@ -598,6 +598,58 @@ fn remote_denials_describe_the_other_environment() {
     );
 }
 
+/// #554: a quoted inline ssh script folds its own `mktemp -d` directory like
+/// the same script locally, in `bash -c`, and in a quoted `ssh host <<'EOF'`
+/// body. The fold is lexical, so no local file can change the remote verdict.
+#[test]
+fn inline_ssh_scripts_fold_their_own_temporary_directory_issue_554() {
+    let fixture = Fixture::new();
+    for command in [
+        "T=$(mktemp -d); echo x > $T/s",
+        "bash -c 'T=$(mktemp -d); echo x > $T/s'",
+        "ssh h <<'EOF'\nT=$(mktemp -d); echo x > $T/s\nEOF",
+        "ssh h 'T=$(mktemp -d); echo x > $T/s'",
+        "ssh h 'T=$(mktemp -d); echo x > \"$T/s\"'",
+        "ssh h 'T=$(mktemp -d -p /tmp); echo x > \"$T/s\"'",
+        "ssh h 'S=/tmp/sub; echo x > \"$S/out\"'",
+    ] {
+        fixture.allowed(command);
+    }
+    for (command, rule) in [
+        (
+            "ssh h 'T=~/x; echo x > $T/s'",
+            "core.filesystem:redirect-truncate-dynamic-path",
+        ),
+        (
+            "ssh h 'echo x > $HOME/.bashrc'",
+            "core.filesystem:credential-file-write",
+        ),
+        (
+            "ssh h 'echo x > $X/s'",
+            "core.filesystem:redirect-truncate-dynamic-path",
+        ),
+        (
+            "ssh h \"T=$(mktemp -d); echo x > $T/s\"",
+            "core.filesystem:redirect-truncate-dynamic-path",
+        ),
+    ] {
+        fixture.denied(command, rule);
+    }
+    for command in [
+        "T=$(mktemp -d); ssh h 'echo x > $T/s'",
+        "ssh h bash -c 'T=$(mktemp -d); echo x > $T/s'",
+        "ssh h 'T=$(mktemp -d /etc/v-XXXXXX); echo x > \"$T/p\"'",
+        "ssh h 'T=$(mktemp -d); echo x > \"$T/../../etc/passwd\"'",
+        "ssh h 'T=$(mktemp -d); echo x > \"$T/.git/config\"'",
+        "ssh h 'T=$(mktemp -d); T=/etc; echo x > \"$T/passwd\"'",
+        "ssh h 'T=$(mktemp -d); echo x > \"$T/s\"; echo y > ~/note'",
+        "ssh h 'T=$(mktemp -d); echo x > \"$T/s\"; git reset --hard'",
+    ] {
+        let (decision, rule, reason) = fixture.judge(command);
+        assert_eq!(decision, "deny", "{command:?}: {rule} {reason}");
+    }
+}
+
 #[test]
 fn remote_database_inputs_and_startup_files_are_unverified() {
     let fixture = Fixture::new();
```

**File**: `tests/repro_576_inline_literal_temp_cleanup.rs` (added, +141/-0)
```diff
@@ -0,0 +1,141 @@
+//! #576: a verified literal inline shell script keeps the literal-temp
+//! exemption its text gets at top level.
+//!
+//! Every command is classifier input only, sent to the real binary through
+//! both reproduction paths of the report (`dcg hook --batch` and
+//! `dcg test --stdin --dialect posix`) with the default configuration and an
+//! empty HOME. Nothing is executed.
+
+use std::io::Write;
+use std::process::{Command, Stdio};
+
+/// `(decision, rule id)` for `command` through `hook --batch` (`hook = true`)
+/// or `test --stdin --dialect posix`.
+fn verdict(command: &str, hook: bool) -> (String, String) {
+    let scratch = tempfile::tempdir().expect("isolated test state");
+    let home = scratch.path().join("home");
+    std::fs::create_dir(&home).expect("isolated home");
+    let mut child = Command::new(env!("CARGO_BIN_EXE_dcg"));
+    let input = if hook {
+        child.args(["hook", "--batch"]);
+        serde_json::json!({
+            "hook_event_name": "PreToolUse",
+            "tool_name": "Bash",
+            "tool_input": {"command": command},
+        })
+        .to_string()
+            + "\n"
+    } else {
+        child.args(["test", "--stdin", "--dialect", "posix", "--format", "json"]);
+        command.to_string()
+    };
+    let mut child = child
+        .env_clear()
+        .env("HOME", &home)
+        .env("USERPROFILE", &home)
+        .env("XDG_CONFIG_HOME", home.join(".config"))
+        .env("APPDATA", home.join(".config"))
+        .env("LOCALAPPDATA", home.join(".local"))
+        .env("TMPDIR", scratch.path())
+        .env("TEMP", scratch.path())
+        .env("TMP", scratch.path())
+        .env("DCG_ALLOWLIST_SYSTEM_PATH", "")
+        .env("DCG_NO_SELF_HEAL", "1")
+        .env("DCG_SELF_HEAL_HOOK", "0")
+        .env("DCG_HISTORY_ENABLED", "false")
+        .env("DCG_HISTORY_DISABLED", "1")
+        // Completed semantic verdicts, not assertions about host scheduling.
+        .env("DCG_HOOK_TIMEOUT_MS", "5000")
+        .env("DCG_AST_TIMEOUT_MS", "5000")
+        .current_dir(scratch.path())
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .spawn()
+        .expect("spawn the DCG classifier");
+    child
+        .stdin
+        .take()
+        .expect("piped stdin")
+        .write_all(input.as_bytes())
+        .expect("write classifier input");
+    let output = child.wait_with_output().expect("classifier exit");
+    let json: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap_or_else(|error| {
+        panic!(
+            "{command:?} hook={hook}: {error}; status={}; stdout={}; stderr={}",
+            output.status,
+            String::from_utf8_lossy(&output.stdout),
+            String::from_utf8_lossy(&output.stderr),
+        )
+    });
+    let decision = json["decision"].as_str().unwrap_or_default().to_string();
+    let rule = if hook {
+        json["rule_id"].as_str().unwrap_or_default().to_string()
+    } else {
+        format!(
+            "{}:{}",
+            json["pack_id"].as_str().unwrap_or_default(),
+            json["pattern_name"].as_str().unwrap_or_default()
+        )
+    };
+    (decision, rule)
+}
+
+fn assert_decision(command: &str, expected: &str) {
+    for hook in [true, false] {
+        let (decision, rule) = verdict(command, hook);
+        assert_eq!(decision, expected, "{command:?} hook={hook}: {rule}");
+    }
+}
+
+#[test]
+fn literal_temp_cleanup_scripts_are_allowed_like_their_top_level_text() {
+    for command in [
+        // Controls from the report, unchanged.
+        "rm -rf /tmp/probe",
+        "eval 'rm -rf /tmp/probe'",
+        "sudo rm -rf /tmp/probe",
+        "ssh host 'rm -rf /tmp/probe'",
+        // The denied rows of the report.
+        "sh -c 'rm -rf /tmp/probe'",
+        "bash -c 'rm -rf /tmp/probe'",
+        "sh -c 'rm -r /tmp/probe'",
+        "sh -c 'rm -rf /var/tmp/probe'",
+        // Other literal spellings the core rm parser exempts at top level.
+        "dash -c 'rm -fr /tmp/probe/child'",
+        "sh -c 'rm -r -f -- /tmp/probe /var/tmp/other'",
+        "bash -c 'rm --recursive --force /tmp/probe'",
+    ] {
+        assert_decision(command, "allow");
+    }
+}
+
+#[test]
+fn roots_traversal_extra_operands_and_dynamic_scripts_stay_denied() {
+    for command in [
+        "sh -c 'rm -rf /tmp'",
+        "sh -c 'rm -rf /home/user/Documents'",
+        "sh -c 'rm -rf /tmp/../home/user'",
+        "sh -c 'rm -rf -- -x /tmp/a'",
+        "sh -c 'rm -rf /tmp/a /home/user'",
+        "sh -c \"rm -rf /tmp/$X\"",
+        "sh -c 'rm -rf /tmp/$X'",
+        "sh -c 'rm -rf /tmp/*'",
+        "sh -c 'cd /; rm -rf tmp/probe'",
+        "sh -c 'rm -rf /tmp/probe; rm -rf /'",
+        "sh -c 'rm -rf /tmp/probe' && rm -rf ~",
+        "bash -c 'rm -rf /tmp/probe $(rm -rf /)'",
+        "ssh host 'rm -rf /'",
+    ] {
+        assert_decision(command, "deny");
+    }
+    // The root and home spelling
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

## X. hook,windows): interpreter source no longer activates disabled Windows packs (#5

**RULE**:
When implementing operations in `src/evaluator.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Dicklesworthstone/destructive_command_guard. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `39f68574`: hook,windows): interpreter source no longer activates disabled Windows packs (#569). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/evaluator.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    // Set when the bounded Windows filesystem pass stopped before reading
    // every statement. Only a denial may follow it; an allow becomes the
    // configured incomplete-analysis outcome below.
    let mut windows_filesystem_analysis_incomplete = false;
                crate::packs::windows::filesystem::WindowsFilesystemSemanticDecision::Incomplete => {
                    // The pass hit its size or statement bound before reading
                    // every statement: no rule was verified either way. Run
                    // this pack's patterns over the whole text (a visible
                    // destructive spelling still denies under its own rule) and
                    // let the end of this evaluation report the configured
                    // incomplete-analysis outcome instead of an allow — never a
                    // `windows-filesystem-semantic-unverified` finding the pass
                    // did not make (#569).
                    windows_filesystem_analysis_incomplete = true;
                }
    // An unread remainder is not a clean one, and a rule-scoped allowlist hit
    // elsewhere does not authorize what was never analyzed.
    if windows_fi
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `39f68574` are properly handled with clean fallback behavior.
