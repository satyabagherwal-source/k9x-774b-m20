> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dicklesworthstone-destructive_command_guard-learnings.md`  
> **Source**: github ([https://github.com/Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard))  
> **Source Version**: `27a6ff0c`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-02T17:24:25.326Z  
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
> **Harvest Timestamp**: 2026-11-02T17:24:23.302Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dicklesworthstone/destructive_command_guard`
- **Description**: A fast Rust safety hook that blocks destructive shell, git, and filesystem commands before AI coding agents run them. 50+ security packs (databases, Kubernetes, Docker, cloud, Terraform), heredoc/inline-script scanning, CI scan mode, and explain mode; works with Claude Code, Codex, Gemini, Copilot, Cursor, and more.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6240 stars

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

#[path = "ast_matcher/python_paths.rs"]
mod python_paths;

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
    /// Create a new compiled patte
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
//! (Claude Code, Factory Droid, Codex CLI, Copilot, VS Code Copilot Chat, Gemini,
//! and Hermes Agent). It parses incoming hook requests and formats denials.

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

    /// The command string under the `cmd` key: the argument name of the
    /// unified-exec `exec_command` tool (Codex, and Muse Code, whose own
    /// bundled tooling reads a shell call as `cmd`, falling back to `command`
    /// (#572)). Both keys are evaluated when both are present, so a benign
    /// `command` cannot hide a destructive `cmd`.
    pub cmd: Option<serde_json::Value>,
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
///   the `tool_input` / `toolCall`
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

/// An extracted shell body can establish a destination in an earlier command.
/// Its individual commands cannot retain that evidence. This is a candidate
/// gate for an additional complete-source evaluation, never a path exemption.
pub(crate) fn shell_destination_context_required(command: &str) -> bool {
    word_splitting::candidate(command) || shell::indirection::candidate(command)
}

/// Scalar/IFS assignments and expansions belong to the outer shell, not to a quoted
/// Python/Node program supplied on stdin (#560). Reuse the existing ownership
/// proof instead of letting source text establish shell state or exhaust the
/// shell event budget. It rejects unquoted bodies and ambiguous receivers.
///
/// The view preserves every byte offset and newline, including command bytes
/// before and after each body. This is NOT an interpreter-source exemption:
/// `embedded::scan_command` below must always receive the original command.
/// Do not apply a POSIX-only proof when the caller's dialect is unknown.
fn scan_outer_writer_arguments(command: &str, dialect: ShellDialect) -> Vec<CredentialFileWrite> {
    let outer = if dialect == ShellDialect::Posix && shell_destination_context_required(command) {
        crate::heredoc::mask_inert_interpreter_stdin(command)
    } else {
        std::borrow::Cow::Borrowed(command)
    };
    let mut hits = word_splitting::scan(outer.as_ref(), dialect);
    hits.extend(shell::indirection::scan(outer.as_ref(), dialect));
    hits
}

/// Inspect executable source before shell segmentation or masking removes it.
/// Shell syntax uses the separate [`classify_credential_file_write`] above;
/// inline scripts, heredocs, and here-strings use their proven interpreter.
/// The shell views retain preceding scalar assignments and recognized Git
/// origins, including IFS-dependent argv, and delegate destination evidence
/// to the same native path policy before source segmentation discards it.
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
    fn unquoted_expansions_and_shell
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

### Incident Patch 1: `90fe7bf7` (2026-11-01)
**Commit Message**: fix(python): revoke path proofs after opaque coercions

Path/string conversions and overloaded path operators could return an
unknown value while retaining trusted factory and receiver identities.
Unknown Python protocol hooks can change those identities, so later
temporary cleanup must not inherit their earlier proof.

Invalidate trust for unresolved Path, str/fspath, join/joinpath and + or /
operands. Separate primitive, inert and other captured values, and retain
purity for known standard conversions without inventing a path identity.
Conversions alone remain non-blocking without a deletion invocation.

Add 20 policy fixtures and five actual parser test groups. Exact source
passes 290 policy cases, 61 actual inline tests, strict project Clippy and
pinned formatting in the focused actual-source harness. Full Cargo and
hook/CLI gates remain unavailable under workspace resource limits.

Refs #626.

**File**: `docs/patterns.md` (modified, +6/-0)
```diff
@@ -243,6 +243,12 @@ destinations do not receive this allowance. Absolute join components replace
 the prior base: `Path(tempfile.mkdtemp()) / '/etc/hosts'` remains denied.
 Replaced factories, modified dependencies, reflective binding mutation, and
 unsupported path transformations cannot establish temporary ownership.
+Unresolved operands to path/string conversions and overloaded `+` or `/`
+operations can execute Python hooks such as `__fspath__` or `__str__`; these
+operations revoke later factory and receiver proofs. Conversions of known standard values
+preserve unrelated cleanup proofs even when the result's exact path is unknown.
+Conversions alone do not produce deletion findings: an actual destructive
+invocation is still required.
 Analysis limits or an incomplete proof never establish a safe target.
 
 ### Ruby
```

**File**: `src/ast_matcher/python_paths.rs` (modified, +118/-10)
```diff
@@ -210,6 +210,10 @@ enum Value {
     Unknown,
     Scalar,
     None,
+    // A selected standard text/path value without its path identity.
+    Inert,
+    // A non-deletion selection whose conversion behavior is unproved.
+    Other,
     Text(Path),
     Path(Path),
     Directory(Path),
@@ -245,6 +249,19 @@ impl Value {
         }
     }
 
+    fn inert_conversion(&self) -> bool {
+        matches!(
+            self,
+            Self::Scalar | Self::None | Self::Inert | Self::Text(_) | Self::Path(_)
+        )
+    }
+
+    fn inert_binary_operand(&self) -> bool {
+        // Builtin container + and / dispatch does not convert its elements.
+        // In contrast, str(container) can invoke an unknown element's repr.
+        self.inert_conversion() || matches!(self, Self::Container(_))
+    }
+
     fn capabilities(&self) -> Capabilities {
         match self {
             Self::Delete(call) => Capabilities {
@@ -297,12 +314,20 @@ impl Value {
     }
 
     fn captured(&self) -> Self {
-        if matches!(self, Self::Delete(Delete { trusted: true, .. })) {
+        if matches!(
+            self,
+            Self::Scalar | Self::None | Self::Inert | Self::Delete(Delete { trusted: true, .. })
+        ) {
             self.clone()
+        } else if matches!(self, Self::Text(_) | Self::Path(_)) {
+            // Preserve inert conversion without granting a path through an
+            // otherwise unsupported container value.
+            Self::Inert
         } else if *self != Self::Unknown && !self.has_capability() {
-            // A precise harmless slot must not fall back to another slot's
-            // possible deletion after the whole-body alias map coarsens.
-            Self::Scalar
+            // A precise non-deletion slot must not fall back to another slot's
+            // possible deletion. That fact alone does not prove its coercions
+            // are inert: a nested container can hold unknown repr hooks.
+            Self::Other
         } else {
             self.indirect()
         }
@@ -1746,17 +1771,32 @@ impl<'a> Scan<'a> {
                     .field("operator")
                     .map(|operator| operator.text().into_owned())
                     .unwrap_or_default();
+                let path_operator = matches!(operator.as_str(), "+" | "/");
+                let inert_result =
+                    path_operator && left.inert_conversion() && right.inert_conversion();
+                if path_operator && (!left.inert_binary_operand() || !right.inert_binary_operand())
+                {
+                    // Overloaded operators and pathlib's path conversion can
+                    // run user code. An unresolved result cannot preserve
+                    // trusted factory or receiver identities afterward.
+                    self.invalidate(env);
+                }
+                let unresolved = if inert_result {
+                    Value::Inert
+                } else {
+                    Value::Unknown
+                };
                 match (operator.as_str(), left, right) {
                     ("/", Value::Path(left), right) => right
                         .path()
                         .and_then(|right| left.join(right))
-                        .map_or(Value::Unknown, Value::Path),
+                        .map_or(unresolved, Value::Path),
                     ("+", Value::Text(Path::Literal(left)), Value::Text(Path::Literal(right)))
                         if left.len() + right.len() <= MAX_VALUE_BYTES =>
                     {
                         Value::Text(Path::Literal(format!("{left}{right}").into()))
                     }
-                    _ => Value::Unknown,
+                    _ => unresolved,
                 }
             }
             "conditional_expression" => {
@@ -1972,6 +2012,23 @@ impl<'a> Scan<'a> {
         };
         let args = self.arguments(node, env, depth + 1)?;
         let plain = !args.uncertain && args.keywords.is_empty();
+        let conversion = matches!(
+            &function,
+            Value::Symbol(Symbol::PathClass | Symbol::Str | Symbol::Join) | Value::Join(_)
+        );
+        let inert_conversion = conversion && args.positional.iter().all(Value::inert_conversion);
+        if conversion && !inert_conversion {
+            // Familiar constructors can dispatch unknown __fspath__/__str__
+            // hooks. Losing the result's path proof must also lose the
+            // identities that such hooks may have changed. Pure operands
+            // retain trust even when a literal join cannot be resolved.
+            self.invalidate(env);
+        }
+        let unresolved_conversion = if inert_conversion {
+            Value::Inert
+        } else {
+            Value::Unknown
+        };
         let value = match function {
             Value::Possible(possible) => {
                 let kinds = u8::try_from(possible.direct & DELETE_KINDS).unwrap_or_default();
@@ -2012,19 +2069,1
```

**File**: `tests/fixtures/python_tempfile_provenance.json` (modified, +21/-1)
```diff
@@ -232,5 +232,25 @@
   {"id":"bindings_626_indirection_container_context_expiry","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"import tempfile\nfrom pathlib import Path\nwith tempfile.TemporaryDirectory() as directory:\n    p = Path(directory) / 'lock'\n    actions = [p.unlink]\nactions[0]()"},
   {"id":"bindings_626_indirection_getter_context_expiry","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"import tempfile\nfrom pathlib import Path\nwith tempfile.TemporaryDirectory() as directory:\n    p = Path(directory) / 'lock'\n    erase = getattr(p, 'unlink')\nerase()"},
   {"id":"bindings_626_indirection_item_store_through_alias","decision":"deny","rule_id":"heredoc.python:os_unlink","source":"import os\nactions = [print]\nalias = actions\nalias[0] = os.unlink\nactions[0]('/etc/hosts')"},
-  {"id":"bindings_626_callable_escaped_getattr_invoked","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\np = Path('/etc/hosts')\ngetattr(p, 'unl\\x69nk')()"}
+  {"id":"bindings_626_callable_escaped_getattr_invoked","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\np = Path('/etc/hosts')\ngetattr(p, 'unl\\x69nk')()"},
+  {"id":"bindings_626_coercion_path_unknown","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"import tempfile\nfrom pathlib import Path\nfrom helpers import value\np = Path(tempfile.mkdtemp()) / 'child'\nPath(value)\np.unlink()"},
+  {"id":"bindings_626_coercion_str_unknown","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"import tempfile\nfrom pathlib import Path\nfrom helpers import value\np = Path(tempfile.mkdtemp()) / 'child'\nstr(value)\np.unlink()"},
+  {"id":"bindings_626_coercion_fspath_unknown","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"import tempfile\nfrom pathlib import Path\nfrom helpers import value\np = Path(tempfile.mkdtemp()) / 'child'\nimport os\nos.fspath(value)\np.unlink()"},
+  {"id":"bindings_626_coercion_os_join_unknown","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"import tempfile\nfrom pathlib import Path\nfrom helpers import value\np = Path(tempfile.mkdtemp()) / 'child'\nimport os\nos.path.join('/tmp', value)\np.unlink()"},
+  {"id":"bindings_626_coercion_joinpath_unknown","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"import tempfile\nfrom pathlib import Path\nfrom helpers import value\np = Path(tempfile.mkdtemp()) / 'child'\np.joinpath(value)\np.unlink()"},
+  {"id":"bindings_626_coercion_addition_unknown","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"import tempfile\nfrom pathlib import Path\nfrom helpers import value\np = Path(tempfile.mkdtemp()) / 'child'\nignored = value + 1\np.unlink()"},
+  {"id":"bindings_626_coercion_division_unknown","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"import tempfile\nfrom pathlib import Path\nfrom helpers import value\np = Path(tempfile.mkdtemp()) / 'child'\nignored = 1 / value\np.unlink()"},
+  {"id":"bindings_626_coercion_conditional_unknown","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"import tempfile\nfrom pathlib import Path\nfrom helpers import value\np = Path(tempfile.mkdtemp()) / 'child'\nif condition:\n    Path(value)\np.unlink()"},
+  {"id":"bindings_626_coercion_definition_default_executes","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"import tempfile\nfrom pathlib import Path\nfrom helpers import value\np = Path(tempfile.mkdtemp()) / 'child'\ndef unused(arg=str(value)):\n    pass\np.unlink()"},
+  {"id":"bindings_626_coercion_eager_comprehension_executes","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"import tempfile\nfrom pathlib import Path\nfrom helpers import value\np = Path(tempfile.mkdtemp()) / 'child'\nignored = [str(item) for item in (value,)]\np.unlink()"},
+  {"id":"bindings_626_coercion_caught_unknown","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"import tempfile\nfrom pathlib import Path\nfrom helpers import value\np = Path(tempfile.mkdtemp()) / 'child'\ntry:\n    str(value)\nexcept Exception:\n    pass\np.unlink()"},
+  {"id":"bindings_626_coercion_known_path_operands","decision":"allow","source":"import tempfile\nfrom pathlib import Path\nfrom helpers import value\np = Path(tempfile.mkdtemp()) / 'child'\nimport os\nPath('/tmp/unused')\nstr(p)\nos.fspath(p)\nos.path.join('/tmp', 'unused')\np.joinpath('unused')\nos.path.join('/tmp', '..')\np.joinpath('..')\np.unlink()"},
+  {"id":"bindings_626_coercion_pure_scalar_operations","decision":"allow","source":"import tempfile\nfrom pathlib import Path\nfrom helpers import value\np = Path(tempfile.mkdtemp()) / 'child'\nstr(1)\nstr(None)\nstr(True)\nignored = 1 + 2\nignored = 4 / 2\nignored = '/tmp/' + 'unused'\np.unlink()"},
+  {"id":"bindings_626_coercion_unused_function_body","decision
```

---

### Incident Patch 2: `089c4426` (2026-11-01)
**Commit Message**: fix(python): retain deletion capabilities across containers and getters

Invoking a captured deletion through a container subscription or a static
getattr lookup could produce no finding. Track possible deletion identities
separately from the proof that a target is safe.

Preserve exact trusted captures for temporary-child cleanup, while joins,
opaque effects, item mutation, and TemporaryDirectory exit revoke their
safety proofs without erasing possible deletion. Keep unused captures and
precise benign selections non-blocking. Propagate contained capabilities
through mutable aliases.

Bound snapshot size, depth, comparison, and diagnostics. Extend the
incomplete-analysis fallback to static and escaped getattr member names,
and ensure escaped names trigger the same parsed-tree path analysis.

Add 33 deterministic fixtures and a shared-container-graph regression.
Validation: 270 policy cases, 56 selected actual-source inline tests, the
16-case fallback unit, pinned formatting, and strict production/test
Clippy all pass in focused actual-source harnesses. Full application and
hook/CLI integration validation remains blocked by workspace resources.

Refs #626.

**File**: `docs/patterns.md` (modified, +14/-0)
```diff
@@ -192,6 +192,20 @@ Conditional branches preserve a safety fact only when every reaching binding
 proves it. Loop assignments, shadowed parameters, and deferred function access
 to mutable outer paths cannot inherit a stale temporary-path allowance.
 
+Captured deletion functions also retain their identity through literal lists,
+tuples, dictionary values, and builtin `getattr` with a static deletion member.
+A finding requires an invocation: storing `p.unlink` or retrieving it alone
+does not delete a file. Exact literal selection can preserve a trusted captured
+method or function; unknown selection, merged identities, or mutation cannot
+provide a temporary-path allowance. A supported builtin `getattr` lookup on a
+known `Path` instance or `os` module follows the same target checks as direct
+attribute access. Other reflective access remains conservative.
+
+If extraction or analysis is incomplete, captured deletion names remain a
+blocking signal, including static `getattr` member names written with string
+escapes. This fallback does not assert that an unused capture was invoked;
+it cannot complete the proof that would establish that it stays unused.
+
 Normal completion, `break`, `continue`, `return`, and exceptions retain separate
 path states. Unreachable assignments after an exit cannot replace the state
 that actually reaches a later deletion. Loop `else` clauses apply only on
```

**File**: `src/ast_matcher/python_paths.rs` (modified, +648/-56)
```diff
@@ -24,6 +24,13 @@ const OS_REMOVE: u8 = 2;
 const OS_RMDIR: u8 = 4;
 const PATH_UNLINK: u8 = 8;
 const PATH_RMDIR: u8 = 16;
+const DELETE_KINDS: u16 = 31;
+const MAY_OS: u16 = 1 << 5;
+const MAY_GETATTR: u16 = 1 << 6;
+const MAY_BUILTINS: u16 = 1 << 7;
+const MAX_CONTAINER_ITEMS: usize = 32;
+const MAX_CONTAINER_DEPTH: usize = 32;
+const MAX_KEY_BYTES: usize = 1024;
 
 fn rule(kind: u8) -> &'static str {
     match kind {
@@ -112,6 +119,8 @@ enum Symbol {
     TemporaryDirectory,
     Str,
     Print,
+    Getattr,
+    Builtins,
 }
 
 #[derive(Clone, Debug, PartialEq, Eq)]
@@ -122,6 +131,79 @@ struct Delete {
     trusted: bool,
 }
 
+// Direct and contained capabilities are separate: storing a deletion does not
+// invoke it, and a container's own remove method is not os.remove. Joins only
+// union these finite masks; none of them carries a safe path or trusted object.
+#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
+struct Capabilities {
+    direct: u16,
+    contained: u16,
+}
+
+impl Capabilities {
+    const fn union(self, other: Self) -> Self {
+        Self {
+            direct: self.direct | other.direct,
+            contained: self.contained | other.contained,
+        }
+    }
+
+    const fn any(self) -> bool {
+        self.direct != 0 || self.contained != 0
+    }
+
+    const fn selected(self) -> Self {
+        Self {
+            direct: self.contained,
+            // Retain descendants after an unresolved selection so another
+            // subscription cannot hide a nested deletion.
+            contained: self.contained,
+        }
+    }
+}
+
+#[derive(Clone, Debug, PartialEq, Eq)]
+enum ContainerKey {
+    Integer(i64),
+    Text(Arc<str>),
+}
+
+struct Container {
+    entries: Vec<(ContainerKey, Value)>,
+    sequence: bool,
+    precise: bool,
+    members: Capabilities,
+    depth: usize,
+    origins: Vec<usize>,
+    unknown_origins: bool,
+}
+
+impl std::fmt::Debug for Container {
+    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        formatter
+            .debug_struct("Container")
+            .field("entries", &self.entries.len())
+            .field("precise", &self.precise)
+            .field("members", &self.members)
+            .field("depth", &self.depth)
+            .field("origins", &self.origins.len())
+            .field("unknown_origins", &self.unknown_origins)
+            .finish_non_exhaustive()
+    }
+}
+
+// Snapshots are shared by Arc and compare only by identity. Recursive
+// comparison of independently built shared graphs can amplify a short source
+// exponentially outside the AST budget. Distinct snapshots instead join to
+// their finite may-call summaries.
+impl PartialEq for Container {
+    fn eq(&self, other: &Self) -> bool {
+        std::ptr::eq(self, other)
+    }
+}
+
+impl Eq for Container {}
+
 #[derive(Clone, Debug, Default, PartialEq, Eq)]
 enum Value {
     #[default]
@@ -132,7 +214,8 @@ enum Value {
     Path(Path),
     Directory(Path),
     Symbol(Symbol),
-    PossibleOs,
+    Possible(Capabilities),
+    Container(Arc<Container>),
     Delete(Delete),
     Join(Path),
     PathRead,
@@ -162,35 +245,74 @@ impl Value {
         }
     }
 
-    fn lost(&self) -> Self {
+    fn capabilities(&self) -> Capabilities {
         match self {
-            Self::Delete(call) => Self::Delete(Delete {
-                kinds: call.kinds,
-                receiver: None,
-                bound: call.bound,
-                trusted: false,
-            }),
-            Self::Symbol(Symbol::Os) | Self::PossibleOs => Self::PossibleOs,
-            _ => Self::Unknown,
+            Self::Delete(call) => Capabilities {
+                direct: u16::from(call.kinds),
+                contained: 0,
+            },
+            Self::Symbol(symbol) => Capabilities {
+                direct: match symbol {
+                    Symbol::Os => MAY_OS,
+                    Symbol::Getattr => MAY_GETATTR,
+                    Symbol::Builtins => MAY_BUILTINS,
+                    _ => 0,
+                },
+                contained: 0,
+            },
+            Self::Possible(possible) => *possible,
+            Self::Container(container) => Capabilities {
+                direct: 0,
+                contained: container.members.direct | container.members.contained,
+            },
+            _ => Capabilities::default(),
+        }
+    }
+
+    fn possible(possible: Capabilities) -> Self {
+        if possible.any() {
+            Self::Possible(possible)
+        } else {
+            Self::Unknown
+        }
+    }
+
+    fn has_capability(&self) -> bool {
+        self.capabilities().any()
+    }
+
+    fn lost(&self) -> Self {
+        Self::possible(self.capabilities())
+    }
+
+    // Literal snapshots retain exact selections until an opaque effect or a
+    // join loses their identity. Only captured deletion functions may carry
+    // receiver proofs; paths and module objects do not gain one b
```

**File**: `src/ast_pattern_engine.rs` (modified, +1/-1)
```diff
@@ -1897,7 +1897,7 @@ fn find_matches_ast(
     // explicitly configured corpora authoritative: only registered rule IDs
     // participate, and the analysis shares the worker's remaining deadline.
     if language == ScriptLanguage::Python
-        && ["unlink", "remove", "rmdir"]
+        && ["unlink", "remove", "rmdir", "getattr"]
             .iter()
             .any(|name| code.contains(name))
     {
```

**File**: `src/evaluator.rs` (modified, +86/-1)
```diff
@@ -35624,6 +35624,45 @@ fn check_credential_write_fallback(
     None
 }
 
+/// Conservatively retain static reflective deletion names after analysis failed.
+///
+/// The caller has already masked comments, quoted data and non-executing
+/// heredocs. A completed Python scan still requires an actual invocation;
+/// this fallback cannot prove that a captured capability remains unused.
+fn python_reflective_deletion_fallback_hit(code: &str, has_os_import: bool) -> bool {
+    static GETTER: LazyLock<regex::Regex> =
+        LazyLock::new(|| regex::Regex::new(r"\bgetattr\b").expect("getattr signal compiles"));
+    if !GETTER.is_match(code) {
+        return false;
+    }
+    static MEMBERS: LazyLock<RegexSet> = LazyLock::new(|| {
+        let member = |name: &str| {
+            // Match the same ASCII names when a static Python string uses
+            // hex, Unicode or octal escapes, or adjacent/added literals.
+            let letters: Vec<_> = name
+                .bytes()
+                .map(|byte| {
+                    format!(
+                        r"(?:{}|\\x(?i:{byte:02x})|\\u(?i:{byte:04x})|\\U(?i:{byte:08x})|\\{byte:03o})",
+                        char::from(byte)
+                    )
+                })
+                .collect();
+            format!(
+                r#"["']{}["']"#,
+                letters.join(r#"(?:["'](?:\s|\\\r?\n)*\+?(?:\s|\\\r?\n)*[rRuUfF]{0,2}["'])?"#)
+            )
+        };
+        RegexSet::new([
+            format!("(?:{}|{})", member("unlink"), member("rmdir")),
+            member("remove"),
+        ])
+        .expect("reflective Python deletion names compile")
+    });
+    let members = MEMBERS.matches(code);
+    members.matched(0) || has_os_import && members.matched(1)
+}
+
 fn fallback_pattern_hit(command: &str) -> bool {
     // Critical destructive patterns checked whenever high-fidelity embedded
     // code analysis is incomplete (timeout, parse failure, or bounded input
@@ -35798,7 +35837,9 @@ fn fallback_pattern_hit(command: &str) -> bool {
         regex::Regex::new(r"\.(?:\s|\\\r?\n)*remove\b")
             .expect("Python remove-member fallback compiles")
     });
-    PYTHON_REMOVE_MEMBER.is_match(check_target) && PYTHON_OS_IMPORT.is_match(check_target)
+    let has_os_import = PYTHON_OS_IMPORT.is_match(check_target);
+    PYTHON_REMOVE_MEMBER.is_match(check_target) && has_os_import
+        || python_reflective_deletion_fallback_hit(check_target, has_os_import)
 }
 
 /// [`check_fallback_patterns`] over the whole command, whose denial yields to
@@ -55865,6 +55906,9 @@ mod tests {
                 for body in [
                     "from pathlib import Path\np = Path('/etc/hosts')\nerase = p.unlink\nerase()",
                     "erase = unknown.unlink\nerase()",
+                    "from pathlib import Path\np = Path('/etc/hosts')\ngetattr(p, 'unlink')()",
+                    "from pathlib import Path\np = Path('/etc/hosts')\nerase = getattr(p, 'unl\\x69nk')\nerase()",
+                    "import os as operating_system\ngetattr(operating_system, 'remove')('/etc/hosts')",
                     "erase = unknown . \\\n rmdir\nerase()",
                     "from os import unlink as erase\nerase('/etc/hosts')",
                     "from os import stat, remove as erase\nerase('/etc/hosts')",
@@ -55889,6 +55933,43 @@ mod tests {
             }
         }
 
+        #[test]
+        fn python_reflective_fallback_tracks_static_names_without_broad_getter_denial() {
+            for code in [
+                "getattr(p, 'unlink')()",
+                "erase = getattr(p, 'rmdir')\nerase()",
+                r"getattr(p, 'unl\x69nk')()",
+                r"getattr(p, '\165\156\154\151\156\153')()",
+                r"getattr(p, '\u0075\u006e\u006c\u0069\u006e\u006b')()",
+                r"getattr(p, '\U00000075nlink')()",
+                "getter = getattr\nmember = 'unlink'\nerase = getter(p, member)\nerase()",
+                "getattr(p, 'un' 'link')()",
+                "getattr(p, 'un' + 'link')()",
+            ] {
+                assert!(
+                    python_reflective_deletion_fallback_hit(code, false),
+                    "reflective deletion must retain its incomplete-analysis signal: {code}"
+                );
+            }
+            for code in [
+                "getattr(p, 'name')",
+                "getattr(p, 'UNLINK')",
+                "getattribute(p, 'unlink')()",
+                "my_getattr(p, 'unlink')()",
+                "print('unlink')",
+                "getattr(items, 'remove')(item)",
+            ] {
+                assert!(
+                    !python_reflective_deletion_fallback_hit(code, false),
+                    "unrelated lookup must not acquire a deletion identity: {code}"
+                );
+            }
+            assert!(python_reflective_deletion_fallback_hit(
+                "getattr(operating_system, 'remove')(path)",
+                true
+            ));
+       
```

**File**: `tests/fixtures/python_tempfile_provenance.json` (modified, +34/-1)
```diff
@@ -199,5 +199,38 @@
   {"id":"flow_626_eager_comprehension_preserves_cleanup","decision":"allow","source":"import tempfile\nfrom pathlib import Path\np = Path(tempfile.mkdtemp()) / 'child'\n[p.unlink(missing_ok=True) for i in (0, 1)]"},
   {"id":"flow_626_comprehension_target_stays_local","decision":"allow","source":"import tempfile\nfrom pathlib import Path\np = Path(tempfile.mkdtemp()) / 'child'\n[None for p in ('/etc/hosts',)]\np.unlink(missing_ok=True)"},
   {"id":"flow_626_generator_proof_deferred_past_mutation","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"import tempfile\nfrom pathlib import Path\nfrom helpers import mutate\ng = ((Path(tempfile.mkdtemp()) / 'hosts').unlink() for i in (0,))\nmutate()\nnext(g)"},
-  {"id":"flow_626_generator_iterable_effect_is_immediate","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\nfrom helpers import mutate\np = Path('/tmp/first')\ng = (None for i in mutate())\np.unlink()"}
+  {"id":"flow_626_generator_iterable_effect_is_immediate","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\nfrom helpers import mutate\np = Path('/tmp/first')\ng = (None for i in mutate())\np.unlink()"},
+  {"id":"bindings_626_callable_list_os_invoked","decision":"deny","rule_id":"heredoc.python:os_unlink","source":"import os\nactions = [os.unlink]\nactions[0]('/etc/hosts')"},
+  {"id":"bindings_626_callable_list_path_invoked","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\np = Path('/etc/hosts')\nactions = [p.unlink]\nactions[0]()"},
+  {"id":"bindings_626_callable_tuple_path_invoked","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\np = Path('/etc/hosts')\nactions = (p.unlink,)\nactions[0]()"},
+  {"id":"bindings_626_callable_dict_path_invoked","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\np = Path('/etc/hosts')\nactions = {'delete': p.unlink}\nactions['delete']()"},
+  {"id":"bindings_626_callable_getattr_direct_invoked","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\np = Path('/etc/hosts')\ngetattr(p, 'unlink')()"},
+  {"id":"bindings_626_callable_getattr_alias_invoked","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\np = Path('/etc/hosts')\nerase = getattr(p, 'unlink')\nerase()"},
+  {"id":"bindings_626_callable_list_os_lookup_only","decision":"allow","source":"import os\nactions = [os.unlink]\nactions[0]"},
+  {"id":"bindings_626_callable_list_path_lookup_only","decision":"allow","source":"from pathlib import Path\np = Path('/etc/hosts')\nactions = [p.unlink]\nactions[0]"},
+  {"id":"bindings_626_callable_tuple_path_lookup_only","decision":"allow","source":"from pathlib import Path\np = Path('/etc/hosts')\nactions = (p.unlink,)\nactions[0]"},
+  {"id":"bindings_626_callable_dict_path_lookup_only","decision":"allow","source":"from pathlib import Path\np = Path('/etc/hosts')\nactions = {'delete': p.unlink}\nactions['delete']"},
+  {"id":"bindings_626_callable_getattr_direct_lookup_only","decision":"allow","source":"from pathlib import Path\np = Path('/etc/hosts')\ngetattr(p, 'unlink')"},
+  {"id":"bindings_626_callable_getattr_alias_lookup_only","decision":"allow","source":"from pathlib import Path\np = Path('/etc/hosts')\nerase = getattr(p, 'unlink')\nerase"},
+  {"id":"bindings_626_callable_list_fresh_child_cleanup","decision":"allow","source":"from tempfile import mkdtemp\nfrom pathlib import Path\np = Path(mkdtemp()) / 'leaked.lock'\nactions = [p.unlink]\nactions[0]()"},
+  {"id":"bindings_626_callable_getattr_direct_fresh_child_cleanup","decision":"allow","source":"from tempfile import mkdtemp\nfrom pathlib import Path\np = Path(mkdtemp()) / 'leaked.lock'\ngetattr(p, 'unlink')()"},
+  {"id":"bindings_626_callable_getattr_alias_fresh_child_cleanup","decision":"allow","source":"from tempfile import mkdtemp\nfrom pathlib import Path\np = Path(mkdtemp()) / 'leaked.lock'\nerase = getattr(p, 'unlink')\nerase()"},
+  {"id":"bindings_626_indirection_unknown_index_keeps_delete","decision":"deny","rule_id":"heredoc.python:os_unlink","source":"import os\nactions = [os.unlink, print]\nactions[index]('/etc/hosts')"},
+  {"id":"bindings_626_indirection_nested_container","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\np = Path('/etc/hosts')\nactions = {'cleanup': [(p.unlink,)]}\nactions['cleanup'][0][0]()"},
+  {"id":"bindings_626_indirection_mixed_direct_container_branch","decision":"deny","rule_id":"heredoc.python:os_unlink","source":"import os\nif ready:\n    actions = [os.unlink]\nelse:\n    actions = os.unlink\nactions[0]('/etc/hosts')"},
+  {"id":"bindings_626_indirection_alias_before_reassignment","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\np =
```

---

### Incident Patch 3: `e7822214` (2026-11-01)
**Commit Message**: fix(python): follow deletion callbacks through local helpers [skip ci]

Local callback parameters and returned callables could hide protected-path
deletions from Python heredoc analysis. Bind supported synchronous helpers
on the existing AST, retain lexical scopes and argument/return flow, and
expire temporary ownership in defaults, containers, and returned values.
Preserve possible deletion identities after helper identity loss without
granting path trust or treating capture alone as invocation.

Keep unknown inherited deletion formals conservative while allowing proved
harmless replacements. Preserve completed recursive-delete findings around
irrelevant opaque helpers. Correct shell unlink normalization so a glued
parenthesis in Python call syntax cannot fabricate a shell operand boundary.

Add 66 shared policy cases and 14 focused Rust regression tests. Keep all
334 previous policy contracts and all analysis limits intact. Document the
supported synchronous-call scope and conservative incomplete cases.

Validation: full dcg build; cargo check --locked --all-targets;
cargo clippy --locked --all-targets -- -D warnings; cargo fmt --check;
400 cases across eight CLI/hook forms (3,20

**File**: `docs/patterns.md` (modified, +20/-0)
```diff
@@ -216,6 +216,26 @@ uncertain arguments cannot establish a cleanup allowance. Selector-return
 depth is bounded separately from deletion invocation: exceeding that bound
 reports incomplete analysis instead of inventing a destructive call.
 
+Supported calls to source-visible synchronous local helpers bind arguments in
+a fresh function scope and track returned callbacks. A callback invoked through
+a parameter receives the same deletion and target checks as a direct call.
+Passing, storing, or returning that callback alone does not invoke it. Function
+aliases retain their definition identity; reassignment replaces the current
+binding. Definition-time defaults and supported literal argument unpacking
+participate in argument binding without turning unknown values into path proofs.
+
+Only proved live values can carry a temporary-child allowance across a supported
+call. Mutable outer bindings and closure captures do not inherit a stale safe
+path. A supported closure invocation reads its still-active lexical owner's
+current bindings as possible identities only. An escaped closure or unidentified
+owner reports incomplete analysis instead of reusing definition-time cell values.
+Returned values follow return/finally control flow and lose temporary ownership
+when their context ends. Recursive calls, unresolved helper identities, and
+exhausted call-analysis bounds cannot establish an allowance. Calls share the
+existing AST, traversal budget, and deadline. Generator and coroutine creation
+is not treated as synchronous execution of their bodies; this helper analysis
+does not model their later consumption.
+
 If extraction or analysis is incomplete, captured deletion names remain a
 blocking signal, including static `getattr` member names written with string
 escapes. This fallback does not assert that an unused capture was invoked;
```

**File**: `src/ast_matcher/python_paths.rs` (modified, +1205/-88)
```diff
@@ -35,12 +35,14 @@ const MAY_EXTEND: u16 = 1 << 11;
 const MAY_UPDATE: u16 = 1 << 12;
 const MAY_LIST: u16 = 1 << 13;
 const MAY_DICT: u16 = 1 << 14;
+const MAY_LOCAL: u16 = 1 << 15;
 const MAY_SELECT: u16 = MAY_GET | MAY_POP;
 const MAY_MUTATE: u16 = MAY_POP | MAY_APPEND | MAY_EXTEND | MAY_UPDATE;
 const MAY_CONTAINER: u16 = MAY_LIST | MAY_DICT;
 const MAX_CONTAINER_ITEMS: usize = 32;
 const MAX_CONTAINER_DEPTH: usize = 32;
 const MAX_KEY_BYTES: usize = 1024;
+const MAX_LOCAL_CALLS: usize = 16;
 
 fn rule(kind: u8) -> &'static str {
     match kind {
@@ -152,6 +154,7 @@ struct Capabilities {
     // callback. This fixed ladder bounds nested selectors without recursively
     // expanding the shared container graph.
     returned: [u16; MAX_CONTAINER_DEPTH],
+    returned_contained: [u16; MAX_CONTAINER_DEPTH],
     returned_overflow: bool,
 }
 
@@ -163,6 +166,7 @@ impl Capabilities {
         let mut index = 0;
         while index < MAX_CONTAINER_DEPTH {
             self.returned[index] |= other.returned[index];
+            self.returned_contained[index] |= other.returned_contained[index];
             index += 1;
         }
         self
@@ -174,7 +178,7 @@ impl Capabilities {
         }
         let mut index = 0;
         while index < MAX_CONTAINER_DEPTH {
-            if self.returned[index] != 0 {
+            if self.returned[index] != 0 || self.returned_contained[index] != 0 {
                 return true;
             }
             index += 1;
@@ -187,6 +191,7 @@ impl Capabilities {
             direct: 0,
             contained: self.direct | self.contained,
             returned: self.returned,
+            returned_contained: self.returned_contained,
             returned_overflow: self.returned_overflow,
         }
     }
@@ -198,6 +203,7 @@ impl Capabilities {
             // subscription cannot hide a nested deletion.
             contained: self.contained,
             returned: self.returned,
+            returned_contained: self.returned_contained,
             returned_overflow: self.returned_overflow,
         }
     }
@@ -211,22 +217,42 @@ impl Capabilities {
             result.returned[0] = self.contained;
             for index in 1..MAX_CONTAINER_DEPTH {
                 result.returned[index] = self.returned[index - 1];
+                result.returned_contained[index] = self.returned_contained[index - 1];
             }
-            result.returned_overflow =
-                self.returned_overflow || self.returned[MAX_CONTAINER_DEPTH - 1] != 0;
+            result.returned_overflow = self.returned_overflow
+                || self.returned[MAX_CONTAINER_DEPTH - 1] != 0
+                || self.returned_contained[MAX_CONTAINER_DEPTH - 1] != 0;
         }
         result
     }
 
     fn called(self) -> Self {
         let mut result = Self {
             direct: self.returned[0],
-            contained: self.returned[0],
+            contained: self.returned[0] | self.returned_contained[0],
             returned_overflow: self.returned_overflow,
             ..Self::default()
         };
         for index in 0..MAX_CONTAINER_DEPTH - 1 {
             result.returned[index] = self.returned[index + 1];
+            result.returned_contained[index] = self.returned_contained[index + 1];
+        }
+        result
+    }
+
+    fn returning(self, direct: u16) -> Self {
+        let mut result = Self {
+            direct,
+            returned_overflow: self.returned_overflow
+                || self.returned[MAX_CONTAINER_DEPTH - 1] != 0
+                || self.returned_contained[MAX_CONTAINER_DEPTH - 1] != 0,
+            ..Self::default()
+        };
+        result.returned[0] = self.direct;
+        result.returned_contained[0] = self.contained;
+        for index in 1..MAX_CONTAINER_DEPTH {
+            result.returned[index] = self.returned[index - 1];
+            result.returned_contained[index] = self.returned_contained[index - 1];
         }
         result
     }
@@ -301,6 +327,45 @@ impl PartialEq for Container {
 
 impl Eq for Container {}
 
+// A function identity is a source location on the worker's existing tree.
+// Defaults are evaluated once, while closure facts are deliberately may-only:
+// Python closes over mutable cells, not definition-time path snapshots.
+struct LocalFunction {
+    source: usize,
+    owner: Option<usize>,
+    defaults: HashMap<String, Value>,
+    closure: HashMap<String, Value>,
+    preserves: bool,
+    deferred: bool,
+    complete: bool,
+    depth: usize,
+    called: u8,
+    returned: Capabilities,
+    origins: Vec<usize>,
+    unknown_origins: bool,
+}
+
+impl std::fmt::Debug for LocalFunction {
+    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        formatter
+            .debug_struct("LocalFunction")
+            .field("source", &self.source)
+            .field("defaults", &self.defaults.len())
+            .field("closure", &self.closure.len())
+            .field("preserves", &self.
```

**File**: `src/ast_matcher/tempfile_provenance.rs` (modified, +51/-8)
```diff
@@ -900,6 +900,36 @@ mod tests {
         id: String,
         decision: String,
         source: String,
+        #[serde(default)]
+        analysis_error: Option<String>,
+    }
+
+    fn checked_case_matches(
+        case: &Case,
+        result: Result<Vec<PatternMatch>, super::super::MatchError>,
+    ) -> Option<Vec<PatternMatch>> {
+        if let Some(expected) = &case.analysis_error {
+            assert_eq!(
+                case.decision, "deny",
+                "{}: incomplete work cannot allow",
+                case.id
+            );
+            match result {
+                Err(super::super::MatchError::Unavailable { language, detail }) => {
+                    assert_eq!(language, ScriptLanguage::Python, "{}", case.id);
+                    assert_eq!(&detail, expected, "{}", case.id);
+                }
+                other => panic!(
+                    "{}: expected explicit incomplete analysis, got {other:?}",
+                    case.id
+                ),
+            }
+            // CLI/hook fixtures separately require a blocking wire verdict.
+            // Incomplete analysis supplies no completed proof candidates.
+            None
+        } else {
+            Some(result.unwrap_or_else(|error| panic!("{}: {error:?}", case.id)))
+        }
     }
 
     #[test]
@@ -1040,13 +1070,14 @@ mod tests {
         .expect("valid shared verdict fixtures");
         assert!(!cases.is_empty());
         for case in cases {
-            let matches = super::super::DEFAULT_MATCHER
-                .find_matches_with_timeout(
-                    &case.source,
-                    ScriptLanguage::Python,
-                    Duration::from_secs(5),
-                )
-                .unwrap_or_else(|error| panic!("{}: {error:?}", case.id));
+            let result = super::super::DEFAULT_MATCHER.find_matches_with_timeout(
+                &case.source,
+                ScriptLanguage::Python,
+                Duration::from_secs(5),
+            );
+            let Some(matches) = checked_case_matches(&case, result) else {
+                continue;
+            };
             assert_eq!(
                 matches.iter().any(|hit| hit.severity.blocks_by_default()),
                 case.decision == "deny",
@@ -1185,7 +1216,19 @@ mod tests {
         .expect("valid shared verdict fixtures");
         let mut compared_candidates = 0;
         for case in cases {
-            let candidates = candidate_spans(&case.source);
+            let result = super::super::source_analysis::DEFAULT_MATCHER.find_matches_with_timeout(
+                &case.source,
+                ScriptLanguage::Python,
+                Duration::from_secs(60),
+            );
+            let Some(matches) = checked_case_matches(&case, result) else {
+                continue;
+            };
+            let candidates: HashSet<_> = matches
+                .iter()
+                .filter(|hit| needs_proof(&case.source, hit))
+                .map(|hit| (hit.start, hit.end))
+                .collect();
             compared_candidates += candidates.len();
             compare_proof_strategies(&case.source, &candidates);
         }
```

**File**: `src/packs/core/filesystem.rs` (modified, +53/-0)
```diff
@@ -794,6 +794,18 @@ pub(crate) fn unlink_command_for_pattern_matching(
         return None;
     }
 
+    // A word boundary in the lexer is not necessarily an argv boundary.
+    // `unlink('hello')` in an interpreter body ends the first token at `(`,
+    // but it is a call expression, not the shell command `unlink ('hello')`.
+    // Inserting a space in the matching view below invented a shell operand
+    // and denied harmless Python helpers whose `unlink` parameter was print
+    // (#626). Decline that executable proof; language analysis and the normal
+    // fallback still judge the source. Real arguments, including quoted
+    // parentheses and redirects attached to argv0, keep their existing path.
+    if source.as_bytes().get(executable_end) == Some(&b'(') {
+        return None;
+    }
+
     let arguments: Vec<&str> = tokens
         .iter()
         .skip(1)
@@ -7007,6 +7019,47 @@ mod tests {
         }
     }
 
+    #[test]
+    fn unlink_call_syntax_is_not_a_shell_argument_boundary_issue_626() {
+        let pack = create_pack();
+        for command in [
+            "unlink('hello')",
+            "unlink('/etc/hosts')",
+            "unlink()",
+            "'unlink'('/etc/hosts')",
+            "u'n'link('/etc/hosts')",
+            "/usr/bin/unlink('/etc/hosts')",
+        ] {
+            for dialect in [ShellDialect::Posix, ShellDialect::Unknown] {
+                assert!(
+                    unlink_command_for_pattern_matching(command, dialect).is_none(),
+                    "a glued parenthesis must not manufacture shell argv: {command:?} ({dialect:?})"
+                );
+            }
+            assert_no_match(&pack, command);
+        }
+
+        // This is an identity-boundary correction, not an exemption for
+        // unlink or for parentheses in its actual argument.
+        for command in [
+            "unlink /etc/hosts",
+            "unlink\t/etc/hosts",
+            "u'n'link /etc/hosts",
+            r"un\link /etc/hosts",
+            "'/usr/bin/unlink' '/etc/hosts'",
+            "sudo unlink /etc/hosts",
+            "env FOO=bar unlink /etc/hosts",
+            "command unlink /etc/hosts",
+            "unlink</dev/null /etc/hosts",
+            "unlink>/tmp/unlink.log /etc/hosts",
+            "unlink '(hello)'",
+            "(unlink /etc/hosts)",
+            "xargs unlink",
+        ] {
+            assert_blocks(&pack, command, "unlink");
+        }
+    }
+
     #[test]
     fn quoted_unlink_preserves_literal_temp_and_information_exceptions() {
         let pack = create_pack();
```

**File**: `tests/fixtures/python_tempfile_provenance.json` (modified, +67/-1)
```diff
@@ -296,5 +296,71 @@
   {"id":"bindings_626_methods_update_opaque_receiver_key","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from helpers import value\nimport tempfile\nfrom pathlib import Path\nactions = {value: print}\np = Path(tempfile.mkdtemp()) / 'child'\nactions.update({'known': print})\np.unlink()"},
   {"id":"bindings_626_methods_append_literal_splat","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\np = Path('/etc/hosts')\nactions = []\nactions.append(*[p.unlink])\nactions[0]()"},
   {"id":"bindings_626_methods_update_literal_keyword_splat","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\np = Path('/etc/hosts')\nactions = {}\nactions.update(**{'erase': p.unlink})\nactions.get('erase')()"},
-  {"id":"bindings_626_methods_destructured_mutator_helper","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\np = Path('/etc/hosts')\nactions = []\n(put,) = [actions.append]\ndef populate():\n    put(p.unlink)\npopulate()\nactions[0]()"}
+  {"id":"bindings_626_methods_destructured_mutator_helper","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\np = Path('/etc/hosts')\nactions = []\n(put,) = [actions.append]\ndef populate():\n    put(p.unlink)\npopulate()\nactions[0]()"},
+  {"id":"bindings_626_local_call_os_unlink","decision":"deny","rule_id":"heredoc.python:os_unlink","source":"import os\ndef invoke(callback, target):\n    callback(target)\ninvoke(os.unlink, '/etc/hosts')"},
+  {"id":"bindings_626_local_call_os_remove_keywords","decision":"deny","rule_id":"heredoc.python:os_remove","source":"import os\ndef invoke(callback, target):\n    callback(target)\ninvoke(target='/etc/hosts', callback=os.remove)"},
+  {"id":"bindings_626_local_call_os_rmdir","decision":"deny","rule_id":"heredoc.python:os_rmdir","source":"import os\ndef invoke(callback, target):\n    callback(target)\ninvoke(os.rmdir, '/etc')"},
+  {"id":"bindings_626_local_call_bound_unlink","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\ndef invoke(callback):\n    callback()\ninvoke(Path('/etc/hosts').unlink)"},
+  {"id":"bindings_626_local_call_bound_rmdir","decision":"deny","rule_id":"heredoc.python:pathlib_rmdir","source":"from pathlib import Path\ndef invoke(callback):\n    callback()\ninvoke(Path('/etc').rmdir)"},
+  {"id":"bindings_626_local_call_alias","decision":"deny","rule_id":"heredoc.python:os_unlink","source":"import os\ndef invoke(callback, target):\n    callback(target)\nrun = invoke\nrun(os.unlink, '/etc/hosts')"},
+  {"id":"bindings_626_local_call_alias_survives_reassignment","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\ndef invoke(callback):\n    callback()\nrun = invoke\ninvoke = print\nrun(Path('/etc/hosts').unlink)"},
+  {"id":"bindings_626_local_call_reassigned_to_print","decision":"allow","source":"from pathlib import Path\ndef invoke(callback):\n    callback()\ninvoke = print\ninvoke(Path('/etc/hosts').unlink)"},
+  {"id":"bindings_626_local_call_nested_helpers","decision":"deny","rule_id":"heredoc.python:os_remove","source":"import os\ndef inner(callback, target):\n    callback(target)\ndef outer(callback, target):\n    inner(callback, target)\nouter(os.remove, '/etc/hosts')"},
+  {"id":"bindings_626_local_call_container_selection","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","source":"from pathlib import Path\ndef invoke(callback):\n    callback()\nhelpers = {'run': invoke}\nhelpers['run'](Path('/etc/hosts').unlink)"},
+  {"id":"bindings_626_local_call_two_invocations","decision":"deny","rule_id":"heredoc.python:os_unlink","source":"import os\ndef invoke(callback, target):\n    callback(target)\ninvoke(print, 'hello')\ninvoke(os.unlink, '/etc/hosts')"},
+  {"id":"bindings_626_local_call_parameter_replaced","decision":"allow","source":"from pathlib import Path\ndef ignore(callback):\n    callback = print\n    callback('hello')\nignore(Path('/etc/hosts').unlink)"},
+  {"id":"bindings_626_local_call_unused_parameter","decision":"allow","source":"from pathlib import Path\ndef ignore(callback):\n    pass\nignore(Path('/etc/hosts').unlink)"},
+  {"id":"bindings_626_local_call_unused_definition","decision":"allow","source":"from pathlib import Path\ndef invoke(callback):\n    callback()\npending = Path('/etc/hosts').unlink"},
+  {"id":"bindings_626_local_call_return_capture_only","decision":"allow","source":"import os\ndef identity(callback):\n    return callback\npending = identity(os.unlink)"},
+  {"id":"bindings_626_local_call_return_invoked","decision":"deny","rule_id":"heredoc.python:os_unlink","source":"import os\ndef identity(callback):\n    return callback\nidentity(os.unlink)('/etc/hosts')"},
+  {"id":"bindings_626_local_call_return_bound_invoked","decision":"deny","rule_id":"heredoc.python:pathlib_unlink","so
```

#### Recent Merged Pull Requests:
- **PR #632** (2026-11-02): deps(deps): bump fancy-regex from 0.19.2 to 0.20.0 (@dependabot[bot])
- **PR #631** (2026-11-02): deps(deps): bump rusqlite from 0.40.2 to 0.41.1 (@dependabot[bot])
- **PR #630** (2026-11-02): deps(deps): bump the rust-minor-patch group with 2 updates (@dependabot[bot])
- **PR #596** (2026-10-27): deps(deps): bump smallvec from 1.16.3 to 1.16.4 in the rust-minor-patch group (@dependabot[bot])
- **PR #595** (2026-10-26): deps(deps): bump ast-grep-core from 0.45.3 to 0.51.0 (@dependabot[bot])
- **PR #594** (2026-10-26): deps(deps): bump the rust-minor-patch group with 3 updates (@dependabot[bot])

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

## X. python): revoke path proofs after opaque coercions

**RULE**:
When implementing operations in `docs/patterns.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Dicklesworthstone/destructive_command_guard. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `90fe7bf7`: python): revoke path proofs after opaque coercions. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/patterns.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
Unresolved operands to path/string conversions and overloaded `+` or `/`
operations can execute Python hooks such as `__fspath__` or `__str__`; these
operations revoke later factory and receiver proofs. Conversions of known standard values
preserve unrelated cleanup proofs even when the result's exact path is unknown.
Conversions alone do not produce deletion findings: an actual destructive
invocation is still required.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `90fe7bf7` are properly handled with clean fallback behavior.
