> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dicklesworthstone-destructive_command_guard-learnings.md`  
> **Source**: github ([https://github.com/Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard))  
> **Source Version**: `e4e06296`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T11:09:23.325Z  
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
> **Harvest Timestamp**: 2026-10-31T11:09:23.189Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dicklesworthstone/destructive_command_guard`
- **Description**: A fast Rust safety hook that blocks destructive shell, git, and filesystem commands before AI coding agents run them. 50+ security packs (databases, Kubernetes, Docker, cloud, Terraform), heredoc/inline-script scanning, CI scan mode, and explain mode; works with Claude Code, Codex, Gemini, Copilot, Cursor, and more.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6232 stars

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

### Incident Patch 1: `4850e2da` (2026-10-30)
**Commit Message**: fix(core): preserve shell field and execution boundaries in indirect writes

Resolve provable zero-field and multi-field scalar expansions, including
empty concatenations, without reparsing expanded argv as shell syntax.
Keep assignment prefixes out of operands and prove writer-specific option
boundaries before retaining opaque quoted source arguments.

Give expanded fields distinct analysis identities and map findings back
to original source spans, preserving every protected rule family when a
scalar contains several destinations. Inspect mandatory loop conditions
and live grouped or assignment-only heredocs with correct mutation order.

Extend strict Git path producers for quiet queries, path-format ordering,
HEAD, index, config.worktree and config.lock. Preserve normalization at
the query boundary and reject unquoted field assumptions contradicted by
explicit root, hooksPath or IFS/glob inputs. No shell expression is run.

Extend the real-CLI regression target to 13 tests with blocked writes,
safe controls, linked worktrees, relocated hooks and allowlist cases.

Validation:
- 180/180 executable native-subsystem cases passed using byte-verified
  production source and repository-

**File**: `src/packs/core/credential_files/shell.rs` (modified, +26/-3)
```diff
@@ -3325,11 +3325,22 @@ fn skip_wrapper(name: &str, args: &[&Word]) -> Option<usize> {
 const MAX_WRAPPER_DEPTH: usize = 16;
 
 /// Drop reserved words, leading assignments, and wrapper commands.
-fn strip_prefixes<'a>(mut words: &'a [&'a Word]) -> Option<&'a [&'a Word]> {
+fn strip_prefixes<'a>(words: &'a [&'a Word]) -> Option<&'a [&'a Word]> {
+    strip_prefixes_in_view(words, true)
+}
+
+/// Expanded argv has already lost syntactic assignment/reserved-word roles.
+/// A value such as `x=y` or `if` is an executable name, not new shell syntax.
+fn strip_prefixes_in_view<'a>(
+    mut words: &'a [&'a Word],
+    source_syntax: bool,
+) -> Option<&'a [&'a Word]> {
     for _ in 0..MAX_WRAPPER_DEPTH {
         let first = *words.first()?;
         let text = first.as_string();
-        if crate::context::is_shell_command_prefix_reserved_word(&text) || is_env_assignment(&text)
+        if source_syntax
+            && (crate::context::is_shell_command_prefix_reserved_word(&text)
+                || is_env_assignment(&text))
         {
             words = &words[1..];
             continue;
@@ -3346,6 +3357,14 @@ fn strip_prefixes<'a>(mut words: &'a [&'a Word]) -> Option<&'a [&'a Word]> {
 }
 
 fn classify_simple_command(tokens: &[Token]) -> Option<CredentialFileWrite> {
+    classify_command_in_view(tokens, true)
+}
+
+fn classify_expanded_command(tokens: &[Token]) -> Option<CredentialFileWrite> {
+    classify_command_in_view(tokens, false)
+}
+
+fn classify_command_in_view(tokens: &[Token], source_syntax: bool) -> Option<CredentialFileWrite> {
     let mut words: Vec<&Word> = Vec::new();
     for token in tokens {
         match token {
@@ -3366,7 +3385,11 @@ fn classify_simple_command(tokens: &[Token]) -> Option<CredentialFileWrite> {
             Token::Separator => {}
         }
     }
-    let argv = strip_prefixes(&words)?;
+    let argv = if source_syntax {
+        strip_prefixes(&words)
+    } else {
+        strip_prefixes_in_view(&words, false)
+    }?;
     let (argv0, args) = argv.split_first()?;
     let kind = writer_kind(&executable_name(argv0)?)?;
     match kind {
```

**File**: `src/packs/core/credential_files/shell/indirection.rs` (modified, +238/-54)
```diff
@@ -5,7 +5,7 @@
 //! reparses expanded data as shell syntax. Unknown values lose their proof.
 
 use super::super::word_splitting;
-use super::{CredentialFileWrite, Token, Word, classify_simple_command, git_redirect_write};
+use super::{CredentialFileWrite, Token, Word, classify_expanded_command, git_redirect_write};
 use crate::normalize::ShellDialect;
 use ast_grep_core::{AstGrep, Node, tree_sitter::StrDoc};
 use ast_grep_language::SupportLang;
@@ -132,6 +132,11 @@ impl Value {
         let Some(ifs) = state.ifs.as_deref() else {
             return false;
         };
+        if let Self::Git { path, .. } = self
+            && !path.one_unquoted_field(ifs)
+        {
+            return false;
+        }
         let Some(word) = self.word(0..0) else {
             return false;
         };
@@ -156,6 +161,77 @@ fn path_prefix(prefix: &str) -> bool {
     )
 }
 
+fn scalar_name(raw: &str) -> Option<&str> {
+    let name = raw
+        .strip_prefix("${")
+        .and_then(|value| value.strip_suffix('}'))
+        .or_else(|| raw.strip_prefix('$'))?;
+    word_splitting::identifier(name).then_some(name)
+}
+
+/// Only a complete scalar read can be split independently of neighboring
+/// literal/quoted pieces. Expanded bytes stay data, including quotes and `$`.
+fn scalar_fields(raw: &str, state: &State, range: Range<usize>) -> Option<Vec<Word>> {
+    if state.attributes_unknown {
+        return None;
+    }
+    let value = state.values.get(scalar_name(raw)?)?.literal()?;
+    word_splitting::fields(value, state.ifs.as_deref()?)
+        .ok()?
+        .into_iter()
+        .map(|field| Value::Literal(field.to_owned()).word(range.clone()))
+        .collect()
+}
+
+fn quoted_scalar_field(raw: &str) -> bool {
+    raw.strip_prefix('"')
+        .and_then(|value| value.strip_suffix('"'))
+        .and_then(scalar_name)
+        .is_some()
+}
+
+fn source_command<'a>(
+    node: &Node<'a, StrDoc<SupportLang>>,
+) -> Option<Node<'a, StrDoc<SupportLang>>> {
+    if node.kind() == "command" {
+        Some(node.clone())
+    } else {
+        node.field("body").filter(|body| body.kind() == "command")
+    }
+}
+
+/// Quoted opaque scalar operands after the writer's own `--` cannot inject
+/// options or alter operand count. Wrapper separators do not establish this
+/// boundary for the wrapped writer, and unknown unquoted fields never qualify.
+fn argv_ownership_proven(tokens: &[Token], unknown: &[(Range<usize>, bool)]) -> bool {
+    if unknown.is_empty() {
+        return true;
+    }
+    let words: Vec<_> = tokens
+        .iter()
+        .filter_map(|token| match token {
+            Token::Word(word) => Some(word),
+            _ => None,
+        })
+        .collect();
+    let Some(argv) = super::strip_prefixes_in_view(&words, false) else {
+        return false;
+    };
+    let mut operands = false;
+    let mut accepted = 0;
+    for word in argv.iter().skip(1) {
+        if let Some((_, single)) = unknown.iter().find(|(range, _)| *range == word.range) {
+            if !operands || !single {
+                return false;
+            }
+            accepted += 1;
+        } else if word.is_all_literal() && word.as_string() == "--" {
+            operands = true;
+        }
+    }
+    accepted == unknown.len()
+}
+
 #[derive(Clone)]
 struct State {
     values: HashMap<String, Value>,
@@ -225,6 +301,7 @@ impl State {
 struct Decoded {
     value: Value,
     expanded: bool,
+    present: bool,
 }
 
 /// Decode a single scalar, retaining quoted data and expansion-time origins.
@@ -240,14 +317,18 @@ fn decode(raw: &str, state: &State, assignment: bool) -> Option<Decoded> {
     let mut quote = None;
     let mut index = 0;
     let mut expanded = false;
+    let mut quoted = false;
     while index < raw.len() {
         let ch = raw[index..].chars().next()?;
         let here = index;
         index += ch.len_utf8();
         match (quote, ch) {
             (Some('\''), '\'') | (Some('"'), '"') => quote = None,
             (Some('\''), _) => chunk.push(ch),
-            (None, '\'' | '"') => quote = Some(ch),
+            (None, '\'' | '"') => {
+                quote = Some(ch);
+                quoted = true;
+            }
             (_, '\\') => {
                 let next = raw[index..].chars().next()?;
                 index += next.len_utf8();
@@ -279,6 +360,7 @@ fn decode(raw: &str, state: &State, assignment: bool) -> Option<Decoded> {
                         return None;
                     }
                     index = end;
+                    quoted = true;
                     Value::Literal(word.as_string())
                 } else {
                     if state.attributes_unknown {
@@ -314,7 +396,11 @@ fn decode(raw: &str, state: &State, assignment: bool) -> Option<Decoded> {
                         })
                     })?
                 };
-                if !assignment && quote.is_none() && !next.one_unquoted_field(state) {
+                if !assignment
+    
```

**File**: `src/packs/core/credential_files/shell/indirection/git_paths.rs` (modified, +260/-34)
```diff
@@ -16,7 +16,7 @@ const MAX_PATH_COMPONENTS: usize = 64;
 enum GitPathKind {
     Directory,
     Hooks,
-    Config,
+    File(&'static str),
 }
 
 #[derive(Debug, Clone, PartialEq, Eq)]
@@ -26,13 +26,23 @@ pub(super) struct GitPath {
     /// use: appending `name` to `/a/..` makes `/a/..name`, not `/name`.
     /// Its normalized components never escape the symbolic root.
     tail: String,
+    /// Git may remove a trailing slash or dot component while formatting its
+    /// output. Do not join another component onto an uncertain query boundary.
+    /// Once literal text has been appended, its exact boundary is known.
+    requires_separator: bool,
+    /// Literal path inputs which may appear in Git's output. They are shape
+    /// evidence only: the policy alias must never stand in for these bytes
+    /// when deciding whether an unquoted expansion is one shell field.
+    output_inputs: Vec<String>,
 }
 
 impl GitPath {
     fn new(kind: GitPathKind) -> Self {
         Self {
             kind,
             tail: String::new(),
+            requires_separator: true,
+            output_inputs: Vec::new(),
         }
     }
 
@@ -42,8 +52,8 @@ impl GitPath {
         if suffix.is_empty() {
             return Some(self.clone());
         }
-        if self.tail.is_empty() && !suffix.starts_with('/')
-            || self.kind == GitPathKind::Config
+        if self.requires_separator && !suffix.starts_with('/')
+            || matches!(self.kind, GitPathKind::File(_))
             || self.tail.len().saturating_add(suffix.len()) > MAX_PATH_BYTES
             || suffix.contains('\0')
         {
@@ -54,23 +64,60 @@ impl GitPath {
         Some(Self {
             kind: self.kind,
             tail,
+            requires_separator: false,
+            output_inputs: self.output_inputs.clone(),
         })
     }
 
+    pub(super) fn one_unquoted_field(&self, ifs: &str) -> bool {
+        // Keep the scanner's denial-only interpretation of an otherwise
+        // unspecified Git environment. A custom non-whitespace separator
+        // cannot be checked against an opaque root, and observed root text
+        // must not be hidden by the semantic `.git` spelling.
+        if !ifs.chars().all(|ch| matches!(ch, ' ' | '\t' | '\n')) {
+            return false;
+        }
+        let splits_or_globs = |text: &str| {
+            text.chars()
+                .any(|ch| ifs.contains(ch) || matches!(ch, '*' | '?' | '[' | '('))
+        };
+        !splits_or_globs(&self.tail)
+            && self
+                .output_inputs
+                .iter()
+                .all(|input| !input.is_empty() && !splits_or_globs(input))
+    }
+
+    fn query_boundary(mut self) -> Self {
+        self.requires_separator = self
+            .tail
+            .rsplit('/')
+            .next()
+            .is_none_or(|component| matches!(component, "" | "." | ".."));
+        let components = normalized_components(&self.tail)
+            .expect("GitPath construction checks the symbolic root");
+        self.tail = if components.is_empty() {
+            String::new()
+        } else {
+            format!("/{}", components.join("/"))
+        };
+        self
+    }
+
     /// An alias for the existing protected-path table. A bare directory gets
     /// a trailing slash so the table recognizes its directory anchor as well.
     pub(super) fn policy_path(&self) -> String {
         let base = match self.kind {
-            GitPathKind::Directory => ".git",
-            GitPathKind::Hooks => ".git/hooks",
-            GitPathKind::Config => ".git/config",
+            GitPathKind::Directory => ".git".to_owned(),
+            GitPathKind::Hooks => ".git/hooks".to_owned(),
+            GitPathKind::File(name) => format!(".git/{name}"),
         };
         let tail = normalized_components(&self.tail)
             .expect("GitPath construction checks the symbolic root")
             .join("/");
         if tail.is_empty() {
-            if self.kind == GitPathKind::Config {
-                base.to_owned()
+            if matches!(self.kind, GitPathKind::File(_)) {
+                base
             } else {
                 format!("{base}/")
             }
@@ -112,46 +159,78 @@ pub(super) fn resolve_query(source: &str) -> Option<GitPath> {
         return None;
     }
     let mut index = 1;
+    let mut output_inputs = Vec::new();
+    let mut hooks_path = None;
     while argv.get(index)?.as_str() != "rev-parse" {
         let option = argv.get(index)?.as_str();
         match option {
-            "-C" | "-c" | "--git-dir" | "--work-tree" => {
-                argv.get(index + 1)?;
+            "-C" | "--git-dir" | "--work-tree" => {
+                let input = argv.get(index + 1)?;
+                // `git -C ''` explicitly leaves the current directory alone.
+                if option != "-C" || !input.is_empty() {
+                    output_inputs.push(input.clone());
+                }
+                index +=
```

**File**: `src/packs/core/credential_files/word_splitting.rs` (modified, +1/-1)
```diff
@@ -328,7 +328,7 @@ fn argv_needs_field_analysis(node: Node<'_, StrDoc<SupportLang>>) -> bool {
 /// POSIX distinguishes IFS whitespace from other separators. Empty fields
 /// before/interior to non-whitespace separators survive; a final separator
 /// terminates the preceding field rather than inventing a final argument.
-fn fields<'a>(value: &'a str, ifs: &str) -> Result<Vec<&'a str>, ()> {
+pub(super) fn fields<'a>(value: &'a str, ifs: &str) -> Result<Vec<&'a str>, ()> {
     if value.len() > MAX_VALUE_BYTES
         || ifs.len() > MAX_VALUE_BYTES
         || !ifs.is_ascii()
```

**File**: `tests/repro_609_613_indirect_destinations.rs` (modified, +69/-0)
```diff
@@ -209,6 +209,8 @@ fn reported_scalar_destinations_have_their_literal_rule_identity() {
         "f=/etc/sudoers; result=$(tee -a \"$f\")",
         "f=/etc/sudoers; export result=$(tee -a \"$f\")",
         "if true; then f=/etc/sudoers; tee -a \"$f\"; fi",
+        "f=/etc/sudoers; while tee \"$f\"; do break; done",
+        "f=/etc/sudoers; until tee \"$f\"; do break; done",
     ] {
         fixture.deny(source, CREDENTIAL);
     }
@@ -269,6 +271,8 @@ fn scalar_values_are_snapshots_and_child_scopes_do_not_replace_them() {
         "f=/tmp/out; read f; tee -a \"$f\"",
         "f=/etc/sudoers; printf -- '%n' f; tee -a \"$f\"",
         r#"f=/etc/sudoers; printf '%s' "$((f=0))" "$(tee "$f")""#,
+        r#"f=/etc/sudoers; for x in "$((f=0))" "$(tee "$f")"; do :; done"#,
+        r#"f=/etc/sudoers; case "$((f=0))$(tee "$f")" in *) :;; esac"#,
     ] {
         fixture.allow(source);
     }
@@ -289,6 +293,8 @@ fn quoted_data_reads_and_benign_scalar_destinations_keep_their_behavior() {
         "f=/etc/sudoers; cat \"$f\"",
         "f=/etc/sudoers; chmod 600 \"$f\"",
         "f=/etc/sudoers; cp \"$f\" /tmp/backup",
+        "f=/tmp/out; while tee \"$f\"; do break; done",
+        "f=/tmp/out; until tee \"$f\"; do break; done",
         "option='--target-directory=/tmp'; cp /etc/sudoers \"$option\"",
         "f='$(git rev-parse --git-dir)/config'; printf '%s' \"$f\"",
         "printf '%s' 'f=/etc/sudoers; tee -a $f'",
@@ -305,6 +311,7 @@ fn unresolved_option_fields_do_not_turn_protected_sources_into_destinations() {
         "f=/etc/sudoers; options='--target-directory /tmp'; cp $options \"$f\"",
         "f=~/.ssh/authorized_keys; options='-t /tmp'; install $options \"$f\"",
         "options='-t /tmp'; d=$(git rev-parse --git-dir); cp $options \"$d/config\"",
+        "f=/etc/sudoers; sudo -- cp \"$unknown\" \"$f\"",
     ] {
         fixture.allow(source);
     }
@@ -313,6 +320,41 @@ fn unresolved_option_fields_do_not_turn_protected_sources_into_destinations() {
         "f=/etc/sudoers; options='-t /tmp'; cp $options source >> \"$f\"",
         CREDENTIAL,
     );
+    // After the writer's own option terminator, quoted unknown scalars keep
+    // one operand each and cannot change a later proved destination's role.
+    for source in [
+        "f=/etc/sudoers; cp -- \"$unknown_source\" \"$f\"",
+        "f=/etc/sudoers; tee -- \"$unknown\" \"$f\"",
+        "f=/etc/sudoers; sudo -- cp -- \"$unknown_source\" \"$f\"",
+    ] {
+        fixture.deny(source, CREDENTIAL);
+    }
+}
+
+#[test]
+fn complete_scalar_fields_keep_splitting_and_command_name_semantics() {
+    let fixture = Fixture::new();
+    for source in [
+        "f=/etc/sudoers; empty=; tee $empty \"$f\"",
+        "f=/etc/sudoers; empty=; tee ${empty} \"$f\"",
+        "empty=; f=/etc/sudoers; tee $empty\"$f\"",
+        "empty=; f=/etc/sudoers; tee $empty${empty} \"$f\"",
+        "files='/tmp/out /etc/sudoers'; tee $files",
+        "options='-t /etc'; cp $options sudoers",
+        "v='a b'; f=/etc/sudoers; X=$v tee \"$f\"",
+    ] {
+        fixture.deny(source, CREDENTIAL);
+    }
+    for source in [
+        "files='/tmp/out /etc/sudoers'; tee \"$files\"",
+        "empty=; f=/tmp/out; tee \"$empty\" \"$f\"",
+        "runner='x=y'; f=/etc/sudoers; $runner tee \"$f\"",
+        "runner='x=y'; f=/etc/sudoers; \"$runner\" tee \"$f\"",
+        "runner=if; f=/etc/sudoers; $runner tee \"$f\"",
+        "runner='!'; f=/etc/sudoers; $runner tee \"$f\"",
+    ] {
+        fixture.allow(source);
+    }
 }
 
 #[test]
@@ -324,6 +366,8 @@ fn heredoc_data_and_process_substitution_arguments_preserve_execution_boundaries
         "f=/etc/sudoers; tee /tmp/out <<DATA\n$f\nDATA",
         "f=/tmp/out; tee \"$f\" <<'DATA'\n/etc/sudoers\nDATA",
         "f=/etc/sudoers; cat <<'DATA'\n$(tee -a \"$f\")\nDATA",
+        "f=/etc/sudoers; { :; } <<'DATA'\n$(tee -a \"$f\")\nDATA",
+        "f=/etc/sudoers; { f=/tmp/out; cat <<'INNER' | tee \"$f\"\ndata\nINNER\n} <<'OUTER'\ndata\nOUTER",
         "f=/etc/sudoers; tee /tmp/out <(printf '%s' \"$f\")",
     ] {
         fixture.allow(source);
@@ -332,6 +376,8 @@ fn heredoc_data_and_process_substitution_arguments_preserve_execution_boundaries
         "f=/etc/sudoers; tee -a \"$f\" <<'DATA'\nordinary input\nDATA",
         "f=/etc/sudoers; cat <<DATA\n$(tee -a \"$f\")\nDATA",
         "f=/etc/sudoers; cat <<'DATA' | tee -a \"$f\"\nordinary input\nDATA",
+        "f=/etc/sudoers; { :; } <<DATA\n$(tee -a \"$f\")\nDATA",
+        "f=/etc/sudoers; unused=x <<DATA\n$(tee -a \"$f\")\nDATA",
     ] {
         fixture.deny(source, CREDENTIAL);
     }
@@ -343,17 +389,25 @@ fn git_admin_queries_and_bound_values_reach_native_writer_rules() {
     for source in [
         "cp source .git/config",
         "cp source \"$(git rev-parse --git-dir)/config\"",
+        "cp source \"$(git rev-parse --quiet --git-dir)/config\"",
+        "cp source \"$(git rev-parse --git-dir --path-format=absolute)/config\"",
         "cp so
```

---

### Incident Patch 2: `e4e06296` (2026-10-30)
**Commit Message**: fix(core): retain protected destinations across shell scopes

Preserve assignment context when checking literal shell scripts, including
-c, -lc, -cl and heredoc bodies, while retaining existing leaf-command
checks and allowlist handling. Merge case and conditional execution paths
conservatively and invalidate command identity after hash -p rebinding.

Keep Git query results tied to the caller's working directory after -C,
preserving proven absolute and administered paths without treating benign
relative destinations as protected.

Restrict POSIX heredoc masking to launcher discovery and proven stdin-data
receivers. Continue checking live substitutions and executable receivers,
so protected writers retain their credential-file rule identities.

Expand the real-CLI regressions to 17 tests covering both reports, shell
scope, worktrees, relocated hooks, traversal, safe controls, rule IDs and
allowlist precedence. Production analysis never executes shell expressions.

Validation: all 17 CLI tests passed; both reports were reproduced on
efc1092e through dcg test and the batch hook. All 82 supplementary candidate
observations passed, including 14 under default evaluation budgets.
All-tar

**File**: `src/evaluator.rs` (modified, +60/-13)
```diff
@@ -6089,13 +6089,21 @@ fn evaluate_windows_launcher_envelopes(
     // a Windows shell launcher. A quoted body that is a proven non-shell
     // interpreter's program (`python3 - <<'PY'`) is not shell syntax either:
     // its own language's analysis and the raw rescan judge it (#560).
-    // Expanding heredocs and executing targets stay visible, preserving the
-    // fail-closed path for real substitutions.
+    // Substitution output supplied as contained stdin data is not an outer
+    // executable name either. Only this launcher view hides those bodies;
+    // the original source still reaches live command-substitution analysis.
+    // Executing or ambiguous receivers retain the fail-closed launcher path.
     let data_view;
+    let stdin_view;
     let launcher_source = match outer_dialect {
         ShellDialect::Posix | ShellDialect::Unknown => {
             data_view = crate::heredoc::mask_non_expanding_data_heredocs(command);
-            crate::heredoc::mask_inert_interpreter_stdin(data_view.as_ref())
+            stdin_view = if outer_dialect == ShellDialect::Posix {
+                crate::heredoc::mask_launcher_stdin_data(data_view.as_ref())
+            } else {
+                Cow::Borrowed(data_view.as_ref())
+            };
+            crate::heredoc::mask_inert_interpreter_stdin(stdin_view.as_ref())
         }
         ShellDialect::PowerShell | ShellDialect::Cmd => std::borrow::Cow::Borrowed(command),
     };
@@ -27906,6 +27914,17 @@ fn proven_bash_redirect_offsets(source: &str) -> Vec<usize> {
 fn literal_bash_source_range(
     command: &str,
     content: &crate::heredoc::ExtractedContent,
+) -> Option<Range<usize>> {
+    literal_bash_source_range_with_flags(command, content, &["-c"])
+}
+
+/// Share exact source and receiver ownership without widening the flags that
+/// can establish an exemption. Additional flags are used only for the
+/// complete-source destination check, which can add protected-write findings.
+fn literal_bash_source_range_with_flags(
+    command: &str,
+    content: &crate::heredoc::ExtractedContent,
+    inline_flags: &[&str],
 ) -> Option<Range<usize>> {
     if command.len() > crate::heredoc::MAX_SUBSTITUTION_SOURCE_BYTES
         || !matches!(
@@ -28028,7 +28047,7 @@ fn literal_bash_source_range(
             let shell_script = bash
                 && !nonlocal
                 && literal_posix_shell_program(program_name.as_ref())
-                && operand_text.as_ref() == "-c";
+                && inline_flags.contains(&operand_text.as_ref());
             let ssh_script = ssh_inline
                 && matches!(program_name.as_ref(), "ssh" | "/bin/ssh" | "/usr/bin/ssh")
                 && literal_ssh_destination(operand_text.as_ref());
@@ -34630,12 +34649,20 @@ fn evaluate_heredoc(
             let inner_ordered_packs = carrier_first_packs
                 .as_deref()
                 .unwrap_or(context.ordered_packs);
-            let contextual_redirects =
-                if per_command_pass && literal_bash_source_range(command, &content).is_some() {
-                    proven_bash_redirect_offsets(&content.content)
-                } else {
-                    Vec::new()
-                };
+            let literal_shell_source =
+                per_command_pass && literal_bash_source_range(command, &content).is_some();
+            let contextual_redirects = if literal_shell_source {
+                proven_bash_redirect_offsets(&content.content)
+            } else {
+                Vec::new()
+            };
+            let destination_source_context = per_command_pass
+                && crate::packs::core::credential_files::shell_destination_context_required(
+                    &content.content,
+                )
+                && (literal_shell_source
+                    || literal_bash_source_range_with_flags(command, &content, &["-lc", "-cl"])
+                        .is_some());
             let evaluate_source = |source: &str| {
                 evaluate_command_with_pack_order_deadline_at_path_inner(
                     source,
@@ -34654,7 +34681,7 @@ fn evaluate_heredoc(
                 )
             };
             let mut complete_source_result = None;
-            let inner_commands = if per_command_pass {
+            let mut inner_commands = if per_command_pass {
                 crate::heredoc::extract_shell_commands(&content.content)
             } else {
                 // Without a keyword or trigger the per-command pass has
@@ -34681,7 +34708,23 @@ fn evaluate_heredoc(
                     line_number: 1,
                 }]
             };
-            for inner in inner_commands {
+            if destination_source_context {
+                // `f=/etc/sudoers; tee "$f"` requires both statements. Keep
+                // the existing per-command checks as well: they reach bodies
+                // of functions and other constructs the outer walk may not
+                // evaluate. Only proven
```

**File**: `src/heredoc.rs` (modified, +217/-0)
```diff
@@ -11717,6 +11717,190 @@ pub fn mask_non_expanding_data_heredocs(command: &str) -> std::borrow::Cow<'_, s
     mask_non_executing_heredocs_with_policy(command, true)
 }
 
+/// The output of a substitution inside stdin data is not an outer-shell
+/// executable name. This view is only for launcher discovery: callers must
+/// still inspect the original source's live substitutions independently.
+pub(crate) fn mask_launcher_stdin_data(command: &str) -> Cow<'_, str> {
+    if !command.contains("<<") || command.len() > MAX_SUBSTITUTION_SOURCE_BYTES {
+        return Cow::Borrowed(command);
+    }
+    let Some(heredocs) = active_heredocs(command) else {
+        return Cow::Borrowed(command);
+    };
+    let discarded = discarded_heredoc_operators(command);
+    let bodies: Vec<_> = heredocs
+        .iter()
+        .filter_map(|heredoc| match heredoc.body {
+            ActiveHeredocBody::Heredoc {
+                body_start,
+                body_end,
+                ..
+            } => Some(body_start..body_end),
+            ActiveHeredocBody::HereString => None,
+        })
+        .collect();
+    let mut output_executed = None;
+    let masked: Vec<_> = heredocs
+        .iter()
+        .filter_map(|heredoc| {
+            let ActiveHeredocBody::Heredoc {
+                body_start,
+                body_end,
+                ..
+            } = heredoc.body
+            else {
+                return None;
+            };
+            if discarded.contains(&heredoc.operator_start) {
+                return Some(body_start..body_end);
+            }
+            if heredoc.output != Some(HeredocOutput::Contained)
+                || heredoc.live_spans.is_none()
+                || stdin_is_the_program(command, heredoc.operator_start)
+            {
+                return None;
+            }
+            let target = extract_heredoc_target_command(command, heredoc.operator_start)?;
+            let data_sink = is_non_executing_heredoc_command(&target)
+                || is_noop_stdin_discarding_command(&target)
+                || is_structured_stdin_data_sink(command, heredoc.operator_start);
+            (data_sink
+                && !stdin_data_sink_may_be_overridden(command, heredoc.operator_start, &target)
+                && !*output_executed
+                    .get_or_insert_with(|| written_file_is_executed(command, &bodies)))
+            .then_some(body_start..body_end)
+        })
+        .collect();
+    if masked.is_empty() {
+        Cow::Borrowed(command)
+    } else {
+        Cow::Owned(blank_ranges(command, &masked))
+    }
+}
+
+/// Only simple literal assignments and no-op groups establish that no command
+/// reads this descriptor. A group containing `bash`, `read`, a substitution,
+/// or an unknown command can consume and execute the body and never qualifies.
+fn discarded_heredoc_operators(command: &str) -> Vec<usize> {
+    const MAX_PROOF_NODES: usize = 4096;
+    let Ok(ast) = try_parse_shell_ast(command) else {
+        return Vec::new();
+    };
+    if ast.root().get_inner_node().has_error() {
+        return Vec::new();
+    }
+    let nodes: Vec<_> = ast.root().dfs().take(MAX_PROOF_NODES + 1).collect();
+    if nodes.len() > MAX_PROOF_NODES {
+        return Vec::new();
+    }
+    let assignment_attributes_known = !nodes.iter().any(|node| match node.kind().as_ref() {
+        "declaration_command" | "function_definition" => true,
+        "command_name" => {
+            let text = node.text();
+            crate::normalize::decode_posix_literal_word(text.as_ref()).is_none_or(|name| {
+                matches!(
+                    name.as_ref(),
+                    "eval"
+                        | "."
+                        | "source"
+                        | "trap"
+                        | "declare"
+                        | "typeset"
+                        | "local"
+                        | "readonly"
+                        | "export"
+                        | "builtin"
+                        | "command"
+                        | "alias"
+                        | "unalias"
+                        | "enable"
+                )
+            })
+        }
+        _ => false,
+    });
+    let mut discarded = Vec::new();
+    let mut pending = vec![ast.root()];
+    while let Some(node) = pending.pop() {
+        if node.kind().as_ref() != "heredoc_redirect" {
+            if node.kind().as_ref() != "heredoc_body" {
+                pending.extend(node.children());
+            }
+            continue;
+        }
+        let Some(owner) = node.parent() else {
+            continue;
+        };
+        let Some(body) = owner.field("body") else {
+            continue;
+        };
+        if owner.kind().as_ref() != "redirected_statement"
+            || owner
+                .children()
+                .filter(ast_grep_core::Node::is_named)
+                .any(|child| child.range() != body.range() && child.range() != node.range())

```

**File**: `src/packs/core/credential_files.rs` (modified, +8/-3)
```diff
@@ -33,6 +33,13 @@ pub(crate) fn may_name_protected_path(command: &str) -> bool {
     shell::may_name_protected_path(command) || word_splitting::candidate(command)
 }
 
+/// An extracted shell body can establish a destination in an earlier command.
+/// Its individual commands cannot retain that evidence. This is a candidate
+/// gate for an additional complete-source evaluation, never a path exemption.
+pub(crate) fn shell_destination_context_required(command: &str) -> bool {
+    word_splitting::candidate(command) || shell::indirection::candidate(command)
+}
+
 /// Scalar/IFS assignments and expansions belong to the outer shell, not to a quoted
 /// Python/Node program supplied on stdin (#560). Reuse the existing ownership
 /// proof instead of letting source text establish shell state or exhaust the
@@ -43,9 +50,7 @@ pub(crate) fn may_name_protected_path(command: &str) -> bool {
 /// `embedded::scan_command` below must always receive the original command.
 /// Do not apply a POSIX-only proof when the caller's dialect is unknown.
 fn scan_outer_writer_arguments(command: &str, dialect: ShellDialect) -> Vec<CredentialFileWrite> {
-    let outer = if dialect == ShellDialect::Posix
-        && (word_splitting::candidate(command) || shell::indirection::candidate(command))
-    {
+    let outer = if dialect == ShellDialect::Posix && shell_destination_context_required(command) {
         crate::heredoc::mask_inert_interpreter_stdin(command)
     } else {
         std::borrow::Cow::Borrowed(command)
```

**File**: `src/packs/core/credential_files/shell/indirection.rs` (modified, +173/-36)
```diff
@@ -232,6 +232,24 @@ fn argv_ownership_proven(tokens: &[Token], unknown: &[(Range<usize>, bool)]) ->
     accepted == unknown.len()
 }
 
+/// Bash's `hash -p` can give a familiar command an unrelated implementation.
+/// Listing the cache leaves scalar values and producer identities unchanged.
+fn hash_may_rebind(args: &[&Word]) -> bool {
+    for word in args {
+        if !word.is_all_literal() {
+            return true;
+        }
+        let text = word.as_string();
+        if text == "-" || !text.starts_with('-') || text.starts_with("--") {
+            return false;
+        }
+        if text[1..].contains('p') {
+            return true;
+        }
+    }
+    false
+}
+
 #[derive(Clone)]
 struct State {
     values: HashMap<String, Value>,
@@ -298,6 +316,14 @@ impl State {
     }
 }
 
+fn merge_path(paths: &mut Option<State>, next: State) {
+    if let Some(paths) = paths {
+        paths.intersect(&next);
+    } else {
+        *paths = Some(next);
+    }
+}
+
 struct Decoded {
     value: Value,
     expanded: bool,
@@ -672,22 +698,7 @@ impl Scanner<'_> {
                 state.attributes_unknown |= iteration.attributes_unknown;
                 state.commands_unknown |= iteration.commands_unknown;
             }
-            "case_statement" => {
-                if let Some(value) = node.field("value") {
-                    if has_expansion_effect(value.clone()) {
-                        state.forget();
-                    }
-                    self.nested(value, state, depth + 1);
-                }
-                for branch in node.children().filter(|child| child.kind() == "case_item") {
-                    let mut local = state.clone();
-                    local.forget();
-                    self.children(branch, &mut local, depth + 1);
-                    state.attributes_unknown |= local.attributes_unknown;
-                    state.commands_unknown |= local.commands_unknown;
-                }
-                state.forget();
-            }
+            "case_statement" => self.case_statement(node, state, depth),
             "test_command" => {
                 if has_expansion_effect(node.clone()) {
                     state.forget();
@@ -754,33 +765,157 @@ impl Scanner<'_> {
         state: &mut State,
         depth: usize,
     ) {
-        let mut alternative = None;
-        let mut merged: Option<State> = None;
+        let (mut finished, mut remaining) = self.conditional_clause(node.clone(), state, depth);
+        let mut exhaustive = false;
+        for alternative in node
+            .children()
+            .filter(|child| matches!(child.kind().as_ref(), "elif_clause" | "else_clause"))
+        {
+            if alternative.kind() == "elif_clause" {
+                let (branch, skipped) = self.conditional_clause(alternative, &remaining, depth + 1);
+                finished.intersect(&branch);
+                remaining = skipped;
+            } else {
+                self.children(alternative, &mut remaining, depth + 1);
+                finished.intersect(&remaining);
+                exhaustive = true;
+            }
+        }
+        // An explicit else consumes the final false path. Retaining a
+        // fictitious skipped path would lose assignments made by every arm.
+        if !exhaustive {
+            finished.intersect(&remaining);
+        }
+        *state = finished;
+    }
+
+    fn conditional_clause(
+        &mut self,
+        node: Node<'_, StrDoc<SupportLang>>,
+        incoming: &State,
+        depth: usize,
+    ) -> (State, State) {
+        if depth > MAX_DEPTH || self.visited >= MAX_NODES {
+            let mut unknown = incoming.clone();
+            unknown.forget();
+            return (unknown.clone(), unknown);
+        }
+        self.visited += 1;
+        let mut conditions = Vec::new();
+        let mut body = Vec::new();
+        let mut in_body = false;
         for child in node.children() {
             if child.kind() == "then" {
-                alternative = Some(state.clone());
-            } else if child.is_named() {
-                if matches!(child.kind().as_ref(), "elif_clause" | "else_clause") {
-                    let mut branch = alternative.clone().unwrap_or_else(|| state.clone());
-                    self.walk(child, &mut branch, depth + 1);
-                    merged
-                        .get_or_insert_with(|| state.clone())
-                        .intersect(&branch);
-                    if let Some(alternative) = &mut alternative {
-                        alternative.intersect(&branch);
+                in_body = true;
+            } else if child.is_named()
+                && !matches!(child.kind().as_ref(), "elif_clause" | "else_clause")
+            {
+                if in_body {
+                    body.push(child);
+                } else {
+                    conditions.push(child);
+                }
+            }
+        }
+        let mut success = incoming.clone();
+    
```

**File**: `src/packs/core/credential_files/shell/indirection/git_paths.rs` (modified, +118/-7)
```diff
@@ -19,6 +19,13 @@ enum GitPathKind {
     File(&'static str),
 }
 
+#[derive(Clone, Copy, PartialEq, Eq)]
+enum PathFormat {
+    Default,
+    Absolute,
+    Relative,
+}
+
 #[derive(Debug, Clone, PartialEq, Eq)]
 pub(super) struct GitPath {
     kind: GitPathKind,
@@ -161,6 +168,8 @@ pub(super) fn resolve_query(source: &str) -> Option<GitPath> {
     let mut index = 1;
     let mut output_inputs = Vec::new();
     let mut hooks_path = None;
+    let mut git_dir = None;
+    let mut changes_directory = false;
     while argv.get(index)?.as_str() != "rev-parse" {
         let option = argv.get(index)?.as_str();
         match option {
@@ -170,6 +179,11 @@ pub(super) fn resolve_query(source: &str) -> Option<GitPath> {
                 if option != "-C" || !input.is_empty() {
                     output_inputs.push(input.clone());
                 }
+                if option == "-C" {
+                    changes_directory |= !unchanged_directory(input);
+                } else if option == "--git-dir" {
+                    git_dir = Some(input.as_str());
+                }
                 index += 2;
             }
             "-c" => {
@@ -182,30 +196,46 @@ pub(super) fn resolve_query(source: &str) -> Option<GitPath> {
             }
             "--bare" | "--no-pager" | "--no-optional-locks" => index += 1,
             _ => {
-                output_inputs.push(attached_global_option(option)?.to_owned());
+                let input = attached_global_option(option)?;
+                output_inputs.push(input.to_owned());
+                if option.starts_with("--git-dir=") {
+                    git_dir = Some(input);
+                }
                 index += 1;
             }
         }
     }
     index += 1;
     let mut path = None;
-    let mut reformats_paths = false;
+    let mut format = PathFormat::Default;
     while let Some(argument) = argv.get(index) {
         match argument.as_str() {
             // These options do not print anything, and rev-parse accepts them
             // before or after the one path query. A format option only affects
             // later queries; either spelling retains the same path origin.
-            "--path-format=absolute" | "--path-format=relative" => reformats_paths = true,
+            "--path-format=absolute" => format = PathFormat::Absolute,
+            "--path-format=relative" => format = PathFormat::Relative,
             "--quiet" | "-q" => {}
             "--git-dir" | "--absolute-git-dir" | "--git-common-dir" if path.is_none() => {
+                // A relative result is interpreted by the caller's shell,
+                // which did not follow Git's -C options. Only retain an
+                // absolute result or an explicit literal .git spelling.
+                if changes_directory && !caller_anchored_directory(argument, format, git_dir) {
+                    return None;
+                }
                 path = Some(GitPath::new(GitPathKind::Directory));
             }
             "--git-path" if path.is_none() => {
                 index += 1;
                 let operand = argv.get(index)?;
                 let queried = administered_path(operand)?;
+                if changes_directory
+                    && !caller_anchored_path(&queried, format, git_dir, hooks_path.as_deref())
+                {
+                    return None;
+                }
                 output_inputs.push(operand.clone());
-                path = Some(if reformats_paths {
+                path = Some(if format != PathFormat::Default {
                     queried.query_boundary()
                 } else {
                     queried
@@ -226,6 +256,47 @@ pub(super) fn resolve_query(source: &str) -> Option<GitPath> {
     })
 }
 
+fn caller_anchored_directory(query: &str, format: PathFormat, git_dir: Option<&str>) -> bool {
+    format == PathFormat::Absolute
+        || query == "--absolute-git-dir"
+        || query == "--git-dir"
+            && format == PathFormat::Default
+            && git_dir.is_some_and(|root| root.starts_with('/') || contains_git_component(root))
+}
+
+fn caller_anchored_path(
+    path: &GitPath,
+    format: PathFormat,
+    git_dir: Option<&str>,
+    hooks_path: Option<&str>,
+) -> bool {
+    if format != PathFormat::Default {
+        return format == PathFormat::Absolute;
+    }
+    match path.kind {
+        GitPathKind::Hooks => hooks_path.is_some_and(|root| root.starts_with('/')),
+        GitPathKind::Directory | GitPathKind::File("HEAD" | "config.worktree" | "config.lock") => {
+            git_dir.is_some_and(|root| root.starts_with('/'))
+        }
+        // GIT_INDEX_FILE and GIT_COMMON_DIR can supply relative paths even
+        // when --git-dir is explicitly absolute. The latter also owns config.
+        GitPathKind::File(_) => false,
+    }
+}
+
+fn unchanged_directory(path: &str) -> bool {
+    // Do not cancel pairs such as `-C subdir -C ..`: a symlink can make the
+    // second directory diff
```

**File**: `tests/repro_609_613_indirect_destinations.rs` (modified, +177/-6)
```diff
@@ -88,7 +88,14 @@ impl Fixture {
         command
     }
 
-    fn assert(&self, source: &str, expected: &str, rule: Option<&str>, granted: bool) {
+    fn assert(
+        &self,
+        source: &str,
+        expected: &str,
+        rule: Option<&str>,
+        granted: bool,
+        require_span: bool,
+    ) {
         for hook in [false, true] {
             let mut command = self.command();
             let input = if hook {
@@ -131,7 +138,7 @@ impl Fixture {
             );
             if let Some(rule) = rule {
                 assert_eq!(json["rule_id"], rule, "{source:?}, hook={hook}: {json}");
-                if !hook {
+                if !hook && (require_span || !json["matched_span"].is_null()) {
                     let span = json["matched_span"]
                         .as_array()
                         .expect("native destination finding has an original-source span");
@@ -160,11 +167,11 @@ impl Fixture {
     }
 
     fn deny(&self, source: &str, rule: &str) {
-        self.assert(source, "deny", Some(rule), false);
+        self.assert(source, "deny", Some(rule), false, true);
     }
 
     fn allow(&self, source: &str) {
-        self.assert(source, "allow", None, false);
+        self.assert(source, "allow", None, false, false);
     }
 
     fn git(&self, cwd: &Path, arguments: &[&str]) -> String {
@@ -278,6 +285,117 @@ fn scalar_values_are_snapshots_and_child_scopes_do_not_replace_them() {
     }
 }
 
+#[test]
+fn case_patterns_and_fallthrough_preserve_only_agreed_bindings() {
+    let fixture = Fixture::new();
+    for source in [
+        "f=/etc/sudoers; case x in x) tee \"$f\";; esac",
+        "f=/etc/sudoers; case \"$mode\" in first|second) tee \"$f\";; *) :;; esac",
+        "f=/etc/sudoers; case x in \"$(tee \"$f\")\") :;; esac",
+        "case x in x) f=/etc/sudoers; tee \"$f\";; esac",
+        "f=/etc/sudoers; case \"$mode\" in first) : ;& second) tee \"$f\";; esac",
+        "f=/etc/sudoers; case \"$mode\" in first) : ;;& *) tee \"$f\";; esac",
+        "f=/etc/sudoers; case x in x) f=/tmp/out & wait; tee \"$f\";; esac",
+    ] {
+        fixture.deny(source, CREDENTIAL);
+    }
+    for source in [
+        "f=/tmp/out; case x in x) tee \"$f\";; esac",
+        "f=/etc/sudoers; case x in x) f=/tmp/out; tee \"$f\";; esac",
+        "f=/tmp/out; case x in x) f=/etc/sudoers & wait; tee \"$f\";; esac",
+        r#"f=/etc/sudoers; case x in "$((f=0))") :;; *) tee "$f";; esac"#,
+        r#"f=/etc/sudoers; case x in "$((f=0))$(tee "$f")") :;; esac"#,
+        "f=/etc/sudoers; case x in x) f=/tmp/out ;& y) tee \"$f\";; esac",
+        "f=/etc/sudoers; case x in x) f=/tmp/out ;;& *) tee \"$f\";; esac",
+    ] {
+        fixture.allow(source);
+    }
+}
+
+#[test]
+fn conditional_joins_preserve_exhaustive_and_success_path_proofs() {
+    let fixture = Fixture::new();
+    for source in [
+        "if test \"$mode\"; then f=/etc/sudoers; else f=/etc/sudoers; fi; tee \"$f\"",
+        "if test \"$mode\"; then f=/etc/sudoers; elif test \"$other\"; then f=/etc/sudoers; else f=/etc/sudoers; fi; tee \"$f\"",
+        "if test \"$mode\" && f=/etc/sudoers; then tee \"$f\"; fi",
+    ] {
+        fixture.deny(source, CREDENTIAL);
+    }
+    for source in [
+        "f=/etc/sudoers; if test \"$mode\"; then f=/tmp/one; else f=/tmp/two; fi; tee \"$f\"",
+        "if test \"$mode\"; then f=/etc/sudoers; else f=/tmp/out; fi; tee \"$f\"",
+        "f=/tmp/out; if test \"$mode\"; then f=/etc/sudoers; fi; tee \"$f\"",
+        "f=/tmp/out; if test \"$mode\" && f=/etc/sudoers; then f=/tmp/out; else f=/tmp/out; fi; tee \"$f\"",
+    ] {
+        fixture.allow(source);
+    }
+}
+
+#[test]
+fn command_cache_rebinding_cannot_supply_false_writer_or_git_proofs() {
+    let fixture = Fixture::new();
+    for source in [
+        "hash -p /usr/bin/printf git; cp source \"$(git rev-parse --git-dir)\"",
+        "option=-p; hash \"$option\" /usr/bin/printf git; cp source \"$(git rev-parse --git-dir)\"",
+        "f=/etc/sudoers; hash -p /usr/bin/printf tee; tee \"$f\"",
+        "hash -p /usr/bin/printf tee; f=/etc/sudoers; tee \"$f\"",
+    ] {
+        fixture.allow(source);
+    }
+    for operation in [
+        "hash",
+        "hash -t git",
+        "hash -l",
+        "hash --help",
+        "hash -- -p",
+    ] {
+        fixture.deny(
+            &format!("f=/etc/sudoers; {operation}; tee \"$f\""),
+            CREDENTIAL,
+        );
+    }
+    fixture.deny(
+        "option=-t; f=/etc/sudoers; hash \"$option\" git; tee \"$f\"",
+        CREDENTIAL,
+    );
+}
+
+#[test]
+fn complete_literal_shell_bodies_keep_their_own_scalar_context() {
+    let fixture = Fixture::new();
+    for source in [
+        r#"bash -c 'f=/etc/sudoers; tee "$f"'"#,
+        r#"bash -lc 'f=/etc/sudoers; tee "$f"'"#,
+        r#"bash -cl 'f=/etc/sudoers; tee "$f"'"#,
+        "sh <<'SH'\nf=/etc/sudoers\ntee \"$f\"\nSH",
+    ] {
+        fixture.deny(source, CREDENTIAL);
+    }
+    for source in [
+        r#
```

---

### Incident Patch 3: `12036e96` (2026-10-30)
**Commit Message**: fix(core): resolve indirect protected writer destinations

Track bounded same-command scalar values and recognized Git rev-parse path
origins before shell segmentation discards their context. Feed typed words
to the existing native destination policy, preserving credential, Git-write,
and append/truncate redirect rule identities and ordinary allowlist handling.

Keep Git-directory, common-directory, config, and relocated-hook origins
symbolic so linked worktrees and core.hooksPath do not depend on a literal
.git directory or executing a query. Reject ambiguous producers, root-crossing
traversal, unresolved argv ownership, and quote/continuation splicing.

Respect assignment snapshots, child/background scopes, boolean-list paths,
mutation barriers, nested substitutions, and heredoc execution boundaries.
Retain original source spans when an expanded option is longer than its
source expression. Bound source, state, tokens, and materialized arguments.

Add real dcg test and hook --batch regressions for both reports, safe computed
paths, worktrees, relocated hooks, rule grants, and a no-execution sentinel.
Run the new target in the existing credential-policy verification workflow.

Pre-

**File**: `.github/workflows/credential-policy-verification.yml` (modified, +5/-0)
```diff
@@ -12,6 +12,7 @@ on:
       - src/heredoc.rs
       - tests/credential_file_embedded_e2e.rs
       - tests/credential_file_transfer_e2e.rs
+      - tests/repro_609_613_indirect_destinations.rs
       - tests/repro_440_eval_sink_in_data_heredoc.rs
       - tests/regression_heredoc_masking.rs
       - Cargo.toml
@@ -53,6 +54,10 @@ jobs:
         with:
           shared-key: credential-php-perl-verification
           cache-on-failure: true
+      - name: Indirect destination CLI and hook regressions
+        run: |
+          set -euo pipefail
+          cargo test --locked --test repro_609_613_indirect_destinations -- --test-threads=1 2>&1 | tee target/credential-policy-verification/indirect-destinations.log
       - name: Protected-file unit regressions
         run: |
           set -euo pipefail
```

**File**: `src/packs/core/credential_files.rs` (modified, +14/-8)
```diff
@@ -33,7 +33,7 @@ pub(crate) fn may_name_protected_path(command: &str) -> bool {
     shell::may_name_protected_path(command) || word_splitting::candidate(command)
 }
 
-/// IFS assignments and expansions belong to the outer shell, not to a quoted
+/// Scalar/IFS assignments and expansions belong to the outer shell, not to a quoted
 /// Python/Node program supplied on stdin (#560). Reuse the existing ownership
 /// proof instead of letting source text establish shell state or exhaust the
 /// shell event budget. It rejects unquoted bodies and ambiguous receivers.
@@ -43,18 +43,24 @@ pub(crate) fn may_name_protected_path(command: &str) -> bool {
 /// `embedded::scan_command` below must always receive the original command.
 /// Do not apply a POSIX-only proof when the caller's dialect is unknown.
 fn scan_outer_writer_arguments(command: &str, dialect: ShellDialect) -> Vec<CredentialFileWrite> {
-    if dialect != ShellDialect::Posix || !word_splitting::candidate(command) {
-        return word_splitting::scan(command, dialect);
-    }
-    let outer = crate::heredoc::mask_inert_interpreter_stdin(command);
-    word_splitting::scan(outer.as_ref(), dialect)
+    let outer = if dialect == ShellDialect::Posix
+        && (word_splitting::candidate(command) || shell::indirection::candidate(command))
+    {
+        crate::heredoc::mask_inert_interpreter_stdin(command)
+    } else {
+        std::borrow::Cow::Borrowed(command)
+    };
+    let mut hits = word_splitting::scan(outer.as_ref(), dialect);
+    hits.extend(shell::indirection::scan(outer.as_ref(), dialect));
+    hits
 }
 
 /// Inspect executable source before shell segmentation or masking removes it.
 /// Shell syntax uses the separate [`classify_credential_file_write`] above;
 /// inline scripts, heredocs, and here-strings use their proven interpreter.
-/// The IFS view retains preceding assignments until each writer's arguments
-/// have been split, then delegates every destination to the same path policy.
+/// The shell views retain preceding scalar assignments and recognized Git
+/// origins, including IFS-dependent argv, and delegate destination evidence
+/// to the same native path policy before source segmentation discards it.
 /// Apply explicit language/content exemptions to each decoded program, not
 /// to another program or shell writer in the same command.
 /// Retain all rule families, including coincident spans from a single rename.
```

**File**: `src/packs/core/credential_files/shell.rs` (modified, +2/-1)
```diff
@@ -28,6 +28,7 @@ use crate::normalize::{ShellDialect, is_env_assignment};
 use crate::packs::PatternSuggestion;
 use std::ops::Range;
 
+pub(super) mod indirection;
 mod windows_shells;
 
 /// Rule name under `core.filesystem`. The pattern entry in
@@ -1274,7 +1275,7 @@ enum WriteMode {
     Append,
 }
 
-#[derive(Debug)]
+#[derive(Debug, Clone)]
 enum Token {
     Word(Word),
     /// An output redirect with a file target.
```

**File**: `src/packs/core/credential_files/shell/indirection.rs` (added, +1009/-0)
```diff
@@ -0,0 +1,1009 @@
+//! Positive destination evidence from same-command scalars and Git queries.
+//!
+//! This view only adds findings to the native path policy. It never grants a
+//! safe-path exemption, executes shell source, reads Git configuration, or
+//! reparses expanded data as shell syntax. Unknown values lose their proof.
+
+use super::super::word_splitting;
+use super::{CredentialFileWrite, Token, Word, classify_simple_command, git_redirect_write};
+use crate::normalize::ShellDialect;
+use ast_grep_core::{AstGrep, Node, tree_sitter::StrDoc};
+use ast_grep_language::SupportLang;
+use std::collections::HashMap;
+use std::ops::Range;
+
+mod git_paths;
+
+const MAX_BYTES: usize = 64 * 1024;
+const MAX_VALUE_BYTES: usize = 16 * 1024;
+const MAX_BINDINGS: usize = 64;
+const MAX_NODES: usize = 4096;
+const MAX_DEPTH: usize = 32;
+const MAX_TOKENS: usize = 128;
+const MAX_MATERIALIZED_BYTES: usize = 64 * 1024;
+
+/// Provenance is separate from bytes. In particular, the literal value
+/// `'$(git rev-parse --git-dir)'` can never acquire a Git origin on expansion.
+#[derive(Clone, Debug, PartialEq, Eq)]
+enum Value {
+    Literal(String),
+    Home {
+        prefix: String,
+        root: String,
+        tail: String,
+    },
+    Git {
+        prefix: String,
+        path: git_paths::GitPath,
+    },
+}
+
+impl Value {
+    fn append(self, next: Self) -> Option<Self> {
+        match (self, next) {
+            (Self::Literal(mut before), Self::Literal(after)) => {
+                before.push_str(&after);
+                (before.len() <= MAX_VALUE_BYTES).then_some(Self::Literal(before))
+            }
+            (
+                Self::Home {
+                    prefix,
+                    root,
+                    mut tail,
+                },
+                Self::Literal(after),
+            ) => {
+                if tail.is_empty() && !after.is_empty() && !after.starts_with('/') {
+                    return None;
+                }
+                tail.push_str(&after);
+                (prefix.len() + root.len() + tail.len() <= MAX_VALUE_BYTES).then_some(Self::Home {
+                    prefix,
+                    root,
+                    tail,
+                })
+            }
+            (Self::Git { prefix, path }, Self::Literal(after)) => Some(Self::Git {
+                prefix,
+                path: path.append_literal(&after)?,
+            }),
+            (Self::Literal(before), Self::Home { prefix, root, tail }) => Some(Self::Home {
+                prefix: before + &prefix,
+                root,
+                tail,
+            }),
+            (Self::Literal(before), Self::Git { prefix, path }) => Some(Self::Git {
+                prefix: before + &prefix,
+                path,
+            }),
+            // Two independently expanded roots do not prove a path.
+            _ => None,
+        }
+    }
+
+    fn word(&self, range: Range<usize>) -> Option<Word> {
+        let (text, literal) = match self {
+            Self::Literal(value) => {
+                let text: Vec<char> = value.chars().collect();
+                let literal = vec![true; text.len()];
+                (text, literal)
+            }
+            Self::Home { prefix, root, tail } => {
+                if !path_prefix(prefix) {
+                    return None;
+                }
+                let (home, end) = super::read_word(root, 0);
+                if end != root.len() {
+                    return None;
+                }
+                let mut text: Vec<char> = prefix.chars().collect();
+                let mut literal = vec![true; text.len()];
+                text.extend(home.text);
+                literal.extend(home.literal);
+                text.extend(tail.chars());
+                literal.resize(text.len(), true);
+                (text, literal)
+            }
+            Self::Git { prefix, path } => {
+                if !path_prefix(prefix) {
+                    return None;
+                }
+                let text: Vec<char> = (prefix.clone() + &path.policy_path()).chars().collect();
+                let literal = vec![true; text.len()];
+                (text, literal)
+            }
+        };
+        (text.len() <= MAX_VALUE_BYTES).then_some(Word {
+            text,
+            literal,
+            range,
+            glued_paren: false,
+        })
+    }
+
+    fn literal(&self) -> Option<&str> {
+        match self {
+            Self::Literal(value) => Some(value),
+            Self::Home { .. } | Self::Git { .. } => None,
+        }
+    }
+
+    fn one_unquoted_field(&self, state: &State) -> bool {
+        let Some(ifs) = state.ifs.as_deref() else {
+            return false;
+        };
+        let Some(word) = self.word(0..0) else {
+            return false;
+        };
+        // Default splitting is a possible reading of a fresh shell. This is
+        // positive denial evidence only, never a claim that an unknown caller
+     
```

**File**: `src/packs/core/credential_files/shell/indirection/git_paths.rs` (added, +416/-0)
```diff
@@ -0,0 +1,416 @@
+//! Symbolic destinations returned by a single, statically identified Git query.
+//!
+//! No repository lookup is needed: a worktree's administrative directory and
+//! a relocated hooks directory keep their policy identity wherever Git stores
+//! them. The policy spelling below is a semantic alias, never a claim that the
+//! query actually printed `.git`.
+
+use super::super::read_word;
+
+const MAX_QUERY_BYTES: usize = 8 * 1024;
+const MAX_QUERY_WORDS: usize = 64;
+const MAX_PATH_BYTES: usize = 16 * 1024;
+const MAX_PATH_COMPONENTS: usize = 64;
+
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+enum GitPathKind {
+    Directory,
+    Hooks,
+    Config,
+}
+
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub(super) struct GitPath {
+    kind: GitPathKind,
+    /// Decoded suffix below the symbolic root. Keep its exact characters until
+    /// use: appending `name` to `/a/..` makes `/a/..name`, not `/name`.
+    /// Its normalized components never escape the symbolic root.
+    tail: String,
+}
+
+impl GitPath {
+    fn new(kind: GitPathKind) -> Self {
+        Self {
+            kind,
+            tail: String::new(),
+        }
+    }
+
+    /// Append decoded literal path text. The caller retains expansion/quoting
+    /// provenance and must never pass an unresolved expansion here.
+    pub(super) fn append_literal(&self, suffix: &str) -> Option<Self> {
+        if suffix.is_empty() {
+            return Some(self.clone());
+        }
+        if self.tail.is_empty() && !suffix.starts_with('/')
+            || self.kind == GitPathKind::Config
+            || self.tail.len().saturating_add(suffix.len()) > MAX_PATH_BYTES
+            || suffix.contains('\0')
+        {
+            return None;
+        }
+        let tail = format!("{}{suffix}", self.tail);
+        normalized_components(&tail)?;
+        Some(Self {
+            kind: self.kind,
+            tail,
+        })
+    }
+
+    /// An alias for the existing protected-path table. A bare directory gets
+    /// a trailing slash so the table recognizes its directory anchor as well.
+    pub(super) fn policy_path(&self) -> String {
+        let base = match self.kind {
+            GitPathKind::Directory => ".git",
+            GitPathKind::Hooks => ".git/hooks",
+            GitPathKind::Config => ".git/config",
+        };
+        let tail = normalized_components(&self.tail)
+            .expect("GitPath construction checks the symbolic root")
+            .join("/");
+        if tail.is_empty() {
+            if self.kind == GitPathKind::Config {
+                base.to_owned()
+            } else {
+                format!("{base}/")
+            }
+        } else {
+            format!("{base}/{tail}")
+        }
+    }
+}
+
+fn normalized_components(tail: &str) -> Option<Vec<&str>> {
+    let mut components = Vec::new();
+    for component in tail.split('/') {
+        match component {
+            "" | "." => {}
+            ".." => {
+                // A linked worktree's git-dir need not be the common
+                // directory. Crossing either symbolic base loses the proof;
+                // do not pretend it is a top-level `.git` folder.
+                components.pop()?;
+            }
+            other => {
+                components.push(other);
+                if components.len() > MAX_PATH_COMPONENTS {
+                    return None;
+                }
+            }
+        }
+    }
+    Some(components)
+}
+
+/// Recognize the complete BODY of `$(...)` or backquotes, never source which
+/// merely contains a Git command. Multiple outputs, redirections, operators,
+/// dynamic argv and unbalanced quotes cannot supply a single-path proof.
+pub(super) fn resolve_query(source: &str) -> Option<GitPath> {
+    let argv = literal_argv(source)?;
+    let executable = argv.first()?.rsplit('/').next()?;
+    if !matches!(executable, "git" | "git.exe") {
+        return None;
+    }
+    let mut index = 1;
+    while argv.get(index)?.as_str() != "rev-parse" {
+        let option = argv.get(index)?.as_str();
+        match option {
+            "-C" | "-c" | "--git-dir" | "--work-tree" => {
+                argv.get(index + 1)?;
+                index += 2;
+            }
+            "--bare" | "--no-pager" | "--no-optional-locks" => index += 1,
+            _ if attached_global_option(option) => index += 1,
+            _ => return None,
+        }
+    }
+    index += 1;
+    while argv.get(index).is_some_and(|argument| {
+        matches!(
+            argument.as_str(),
+            "--path-format=absolute" | "--path-format=relative"
+        )
+    }) {
+        index += 1;
+    }
+    match &argv[index..] {
+        [query]
+            if matches!(
+                query.as_str(),
+                "--git-dir" | "--absolute-git-dir" | "--git-common-dir"
+            ) =>
+        {
+            Some(GitPath::new(GitPathKind::Directory))
+        }
+        [query, path] if query == "--git-path" => ad
```

**File**: `src/packs/core/credential_files/word_splitting.rs` (modified, +9/-9)
```diff
@@ -90,7 +90,7 @@ impl State {
     }
 }
 
-fn maintained_variable(name: &str) -> bool {
+pub(super) fn maintained_variable(name: &str) -> bool {
     name.starts_with("BASH_")
         || matches!(
             name,
@@ -110,14 +110,14 @@ fn maintained_variable(name: &str) -> bool {
         )
 }
 
-fn identifier(name: &str) -> bool {
+pub(super) fn identifier(name: &str) -> bool {
     !name.is_empty()
         && name.bytes().enumerate().all(|(index, byte)| {
             byte.is_ascii_alphabetic() || byte == b'_' || index > 0 && byte.is_ascii_digit()
         })
 }
 
-fn assignment(raw: &str) -> Option<(&str, bool, &str)> {
+pub(super) fn assignment(raw: &str) -> Option<(&str, bool, &str)> {
     let (left, rhs) = raw.split_once('=')?;
     let name = left.strip_suffix('+').unwrap_or(left);
     identifier(name).then_some((name, left != name, rhs))
@@ -772,7 +772,7 @@ fn classify(argv: &[String], span: Range<usize>) -> Result<Vec<CredentialFileWri
 /// modifiers do not make a count assignment harmless. Backslash escapes do
 /// not protect a source `%`: `\%n` still performs the assignment, whereas
 /// `\045n` only prints percent/n and must not be re-parsed as a conversion.
-fn printf_format_may_assign(format: &str) -> bool {
+pub(super) fn printf_format_may_assign(format: &str) -> bool {
     let bytes = format.as_bytes();
     let mut index = 0;
     while index < bytes.len() {
@@ -845,7 +845,7 @@ fn printf_may_assign(words: &[String], state: &State) -> bool {
     false
 }
 
-fn mutates_shell(name: &str) -> bool {
+pub(super) fn mutates_shell(name: &str) -> bool {
     matches!(
         name,
         "read"
@@ -876,7 +876,7 @@ fn mutates_shell(name: &str) -> bool {
     )
 }
 
-fn special_builtin(name: &str) -> bool {
+pub(super) fn special_builtin(name: &str) -> bool {
     matches!(
         name,
         ":" | "."
@@ -899,7 +899,7 @@ fn special_builtin(name: &str) -> bool {
 /// The async terminator belongs to the whole statement, not to each
 /// assignment inside it. Ask the syntax tree so line continuations before
 /// `&`, and the distinct `&&` and `&>` operators, keep their shell meaning.
-fn has_async_terminator(node: &Node<'_, StrDoc<SupportLang>>) -> bool {
+pub(super) fn has_async_terminator(node: &Node<'_, StrDoc<SupportLang>>) -> bool {
     node.get_inner_node()
         .next_sibling()
         .is_some_and(|sibling| sibling.kind() == "&")
@@ -911,7 +911,7 @@ fn has_async_terminator(node: &Node<'_, StrDoc<SupportLang>>) -> bool {
 /// literal value. Keep quoted/escaped braces and commas as data. This bounded
 /// lexical check never enumerates alternatives (which can grow exponentially)
 /// and deliberately treats malformed range candidates as uncertain too.
-fn declaration_may_expand_braces(raw: &str) -> bool {
+pub(super) fn declaration_may_expand_braces(raw: &str) -> bool {
     let mut quote = None;
     let mut braces = Vec::new();
     let mut previous_dot = false;
@@ -979,7 +979,7 @@ pub(super) fn scan(command: &str, dialect: ShellDialect) -> Vec<CredentialFileWr
 /// it before reading words, and for each byte of that source the offset of the
 /// same byte in `command`, with one more entry for the end. `None` when
 /// nothing was removed.
-fn join_line_continuations(command: &str) -> Option<(String, Vec<usize>)> {
+pub(super) fn join_line_continuations(command: &str) -> Option<(String, Vec<usize>)> {
     if !command.contains("\\\n") {
         return None;
     }
```

**File**: `tests/repro_609_613_indirect_destinations.rs` (added, +566/-0)
```diff
@@ -0,0 +1,566 @@
+//! #609 / #613: shell indirection must not conceal protected destinations.
+//!
+//! Every source string is data sent to the real CLI and batch hook. The only
+//! commands executed by the fixture are Git repository/worktree setup and
+//! read-only queries used to establish the linked-worktree controls.
+
+use std::io::Write;
+use std::path::{Path, PathBuf};
+use std::process::{Command, Stdio};
+
+const CREDENTIAL: &str = "core.filesystem:credential-file-write";
+const GIT_WRITE: &str = "core.filesystem:git-internals-write";
+const GIT_APPEND: &str = "core.filesystem:redirect-append-git-internals-relative";
+const GIT_TRUNCATE: &str = "core.filesystem:redirect-truncate-git-internals-relative";
+const GRANT_REASON: &str = "isolated indirect-destination rule grant";
+
+struct Fixture {
+    directory: tempfile::TempDir,
+    home: PathBuf,
+    config: PathBuf,
+    cwd: PathBuf,
+    executable_dir: PathBuf,
+}
+
+impl Fixture {
+    fn new() -> Self {
+        let directory = tempfile::tempdir().expect("isolated regression directory");
+        let home = directory.path().join("home");
+        let cwd = directory.path().join("cwd");
+        let executable_dir = directory.path().join("executables");
+        for path in [&home, &cwd, &executable_dir] {
+            std::fs::create_dir(path).expect("isolated directory");
+        }
+        let config = directory.path().join("config.toml");
+        std::fs::write(&config, "[history]\nenabled = false\n").expect("isolated config");
+        Self {
+            directory,
+            home,
+            config,
+            cwd,
+            executable_dir,
+        }
+    }
+
+    fn grant(&self, rule: &str) {
+        let contents = format!("[[allow]]\nrule = \"{rule}\"\nreason = \"{GRANT_REASON}\"\n");
+        for relative in ["config/dcg", ".config/dcg", "appdata/dcg"] {
+            let directory = self.home.join(relative);
+            std::fs::create_dir_all(&directory).expect("allowlist directory");
+            std::fs::write(directory.join("allowlist.toml"), &contents)
+                .expect("isolated single-rule grant");
+        }
+    }
+
+    fn command(&self) -> Command {
+        let mut command = Command::new(env!("CARGO_BIN_EXE_dcg"));
+        command
+            .env_clear()
+            // A static proof must not require Git, a shell, or another
+            // producer executable to be installed on the classifier's PATH.
+            .env("PATH", &self.executable_dir)
+            .env("HOME", &self.home)
+            .env("USERPROFILE", &self.home)
+            .env("XDG_CONFIG_HOME", self.home.join("config"))
+            .env("XDG_DATA_HOME", self.home.join("data"))
+            .env("XDG_CACHE_HOME", self.home.join("cache"))
+            .env("APPDATA", self.home.join("appdata"))
+            .env("LOCALAPPDATA", self.home.join("localappdata"))
+            .env("TEMP", self.directory.path())
+            .env("TMP", self.directory.path())
+            .env("TMPDIR", self.directory.path())
+            .env("DCG_CONFIG", &self.config)
+            .env("DCG_ALLOWLIST_SYSTEM_PATH", "")
+            .env(
+                "DCG_PENDING_EXCEPTIONS_PATH",
+                self.directory.path().join("pending.jsonl"),
+            )
+            .env("DCG_SELF_HEAL_HOOK", "0")
+            .env("DCG_NO_SELF_HEAL", "1")
+            .env("DCG_HISTORY_DISABLED", "1")
+            // Semantic verdicts, not a change to the production budgets.
+            .env("DCG_HOOK_TIMEOUT_MS", "5000")
+            .env("DCG_AST_TIMEOUT_MS", "5000")
+            .current_dir(&self.cwd)
+            .stdin(Stdio::piped())
+            .stdout(Stdio::piped())
+            .stderr(Stdio::piped());
+        command
+    }
+
+    fn assert(&self, source: &str, expected: &str, rule: Option<&str>, granted: bool) {
+        for hook in [false, true] {
+            let mut command = self.command();
+            let input = if hook {
+                command.args(["hook", "--batch"]);
+                serde_json::json!({
+                    "hook_event_name": "PreToolUse",
+                    "tool_name": "Bash",
+                    "tool_input": { "command": source },
+                })
+                .to_string()
+                    + "\n"
+            } else {
+                command.args(["test", "--stdin", "--dialect", "posix", "--format", "json"]);
+                source.to_owned()
+            };
+            let mut child = command
+                .spawn()
+                .expect("spawn the classifier, never the source");
+            child
+                .stdin
+                .take()
+                .expect("classifier stdin")
+                .write_all(input.as_bytes())
+                .expect("write classifier input");
+            let output = child.wait_with_output().expect("classifier response");
+            let stderr = String::from_utf8_lossy(&output.stderr);
+            let stdout = String::from_utf8_loss
```

#### Recent Merged Pull Requests:
- **PR #596** (2026-10-27): deps(deps): bump smallvec from 1.16.3 to 1.16.4 in the rust-minor-patch group (@dependabot[bot])
- **PR #595** (2026-10-26): deps(deps): bump ast-grep-core from 0.45.3 to 0.51.0 (@dependabot[bot])
- **PR #594** (2026-10-26): deps(deps): bump the rust-minor-patch group with 3 updates (@dependabot[bot])
- **PR #581** (2026-10-19): deps(deps): bump ast-grep-core from 0.45.3 to 0.51.0 (@dependabot[bot])
- **PR #580** (2026-10-19): deps(deps): bump serde_json from 1.0.151 to 1.0.154 in the serde group (@dependabot[bot])
- **PR #579** (2026-10-19): deps(deps): bump the rust-minor-patch group with 5 updates (@dependabot[bot])

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

## X. core): preserve shell field and execution boundaries in indirect writes

**RULE**:
When implementing operations in `src/packs/core/credential_files/shell.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Dicklesworthstone/destructive_command_guard. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4850e2da`: core): preserve shell field and execution boundaries in indirect writes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/packs/core/credential_files/shell.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
fn strip_prefixes<'a>(words: &'a [&'a Word]) -> Option<&'a [&'a Word]> {
    strip_prefixes_in_view(words, true)
}

/// Expanded argv has already lost syntactic assignment/reserved-word roles.
/// A value such as `x=y` or `if` is an executable name, not new shell syntax.
fn strip_prefixes_in_view<'a>(
    mut words: &'a [&'a Word],
    source_syntax: bool,
) -> Option<&'a [&'a Word]> {
        if source_syntax
            && (crate::context::is_shell_command_prefix_reserved_word(&text)
                || is_env_assignment(&text))
    classify_command_in_view(tokens, true)
}

fn classify_expanded_command(tokens: &[Token]) -> Option<CredentialFileWrite> {
    classify_command_in_view(tokens, false)
}

fn classify_command_in_view(tokens: &[Token], source_syntax: bool) -> Option<CredentialFileWrite> {
    let argv = if source_syntax {
        strip_prefixes(&words)
    } else {
        strip_prefixes_in_view(&words, false)
    }?;
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
fn strip_prefixes<'a>(mut words: &'a [&'a Word]) -> Option<&'a [&'a Word]> {
        if crate::context::is_shell_command_prefix_reserved_word(&text) || is_env_assignment(&text)
    let argv = strip_prefixes(&words)?;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4850e2da` are properly handled with clean fallback behavior.
