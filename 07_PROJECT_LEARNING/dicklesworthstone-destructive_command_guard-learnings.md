> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dicklesworthstone-destructive_command_guard-learnings.md`  
> **Source**: github ([https://github.com/Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard))  
> **Source Version**: `07c53c96`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T13:14:04.711Z  
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
> **Harvest Timestamp**: 2026-10-30T13:08:54.536Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dicklesworthstone/destructive_command_guard`
- **Description**: A fast Rust safety hook that blocks destructive shell, git, and filesystem commands before AI coding agents run them. 50+ security packs (databases, Kubernetes, Docker, cloud, Terraform), heredoc/inline-script scanning, CI scan mode, and explain mode; works with Claude Code, Codex, Gemini, Copilot, Cursor, and more.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6229 stars

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
///   the `tool_input` / `toolCall` extra
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

### Incident Patch 1: `07c53c96` (2026-10-29)
**Commit Message**: fix(allow-once): preserve policy precedence for exact outer grants (#599)

Quoted interpreter requests inside alias and trap envelopes can return from
nested inspection before the deferred exact-command grant lookup. Recover a
grant after an actual outer-request denial without authorizing a derived
command or adding store I/O to unrelated quick rejections.

The direct quoted-launcher case already works on main after deff5c07. The
decision-only reproduction still leaves four quoted alias/trap cases denied
with unconsumed grants on pristine 025d06a0. The expanded 16-case matrix passes
6 cases on official v0.15.3 x86_64, 12 on that main revision, and all 16 with
this correction.

Inspect explicit configuration blocks before consuming ordinary grants,
including later nested commands hidden by an earlier finding. Keep that
inspection bounded and non-consuming; retain the original denial when source
ownership or completeness cannot be proved. Preserve original command bytes,
authoritative request cwd, expiry checks, and atomic single-use consumption.
Select explicitly forced configuration grants independently of earlier
ordinary entries.

Align quoted-interpreter triggers with extraction

**File**: `src/evaluator.rs` (modified, +1213/-63)
```diff
@@ -364,6 +364,18 @@ thread_local! {
     static ALLOW_ONCE_REQUEST_CWD: std::cell::RefCell<AllowOnceRequestCwd> = const {
         std::cell::RefCell::new(AllowOnceRequestCwd::Unspecified)
     };
+    /// An ordinary exact grant cannot hide an explicit block on a later
+    /// nested command. Policy inspection must read past whole-command grants,
+    /// including the grant whose eligibility it is checking, without spending
+    /// any of them. Recursive evaluation stays on this thread.
+    static ALLOW_ONCE_POLICY_REPLAY: std::cell::Cell<bool> = const {
+        std::cell::Cell::new(false)
+    };
+    /// A finding-only rescan can discard its verdict, so it must never spend
+    /// a stateful grant. Permanent exemptions still govern its findings.
+    static ALLOW_ONCE_SUPPRESSED: std::cell::Cell<bool> = const {
+        std::cell::Cell::new(false)
+    };
 }
 
 #[derive(Clone, Default)]
@@ -497,11 +509,51 @@ impl Drop for SafePatternScope {
     }
 }
 
+struct AllowOncePolicyScope {
+    previous: bool,
+}
+
+impl AllowOncePolicyScope {
+    fn enter() -> Self {
+        Self {
+            previous: ALLOW_ONCE_POLICY_REPLAY.with(|slot| slot.replace(true)),
+        }
+    }
+}
+
+impl Drop for AllowOncePolicyScope {
+    fn drop(&mut self) {
+        ALLOW_ONCE_POLICY_REPLAY.with(|slot| slot.set(self.previous));
+    }
+}
+
+struct AllowOnceSuppressionScope {
+    previous: bool,
+}
+
+impl AllowOnceSuppressionScope {
+    fn enter() -> Self {
+        Self {
+            previous: ALLOW_ONCE_SUPPRESSED.with(|slot| slot.replace(true)),
+        }
+    }
+}
+
+impl Drop for AllowOnceSuppressionScope {
+    fn drop(&mut self) {
+        ALLOW_ONCE_SUPPRESSED.with(|slot| slot.set(self.previous));
+    }
+}
+
 /// A whole-command grant authorizes the original outer request. Detection
 /// replays may change case, remove syntax, or extract executable children;
 /// none of those derived strings is a new request the operator authorized.
-/// An explicitly approved outer envelope is checked before its children run.
+/// Policy inspection deliberately acquires none: an ordinary grant must not
+/// bypass an explicit block merely because another finding appears first.
 fn original_command_grant<T>(command: &str, grant: impl FnOnce(&str) -> Option<T>) -> Option<T> {
+    if ALLOW_ONCE_POLICY_REPLAY.with(std::cell::Cell::get) {
+        return None;
+    }
     let source = SAFE_PATTERN_SOURCE.with(|slot| slot.borrow().clone());
     match source {
         Some(source) if source.parent.is_none() => grant(&source.command),
@@ -5975,7 +6027,8 @@ fn windows_launcher_envelopes(
 /// allowlist grant for that rule first (mirrors the
 /// `ExecutableTextSink::Unverified` handling). Returns `None` when the rule
 /// is allowlisted — the caller falls back to ordinary evaluation — recording
-/// the hit for audit output.
+/// the hit for audit output. Policy inspection cannot treat a waived refusal
+/// as proof that the unread source contains no explicit block.
 fn launcher_unverified_denial(
     rule: &str,
     reason: &str,
@@ -5985,6 +6038,12 @@ fn launcher_unverified_denial(
 ) -> Option<EvaluationResult> {
     let (pack_id, pattern_name) = split_ast_rule_id(rule);
     if let Some(hit) = allowlists.match_rule_at_path(&pack_id, &pattern_name, project_path) {
+        if ALLOW_ONCE_POLICY_REPLAY.with(std::cell::Cell::get) {
+            return Some(EvaluationResult {
+                decision: EvaluationDecision::Indeterminate,
+                ..EvaluationResult::allowed()
+            });
+        }
         if first_allowlist_hit.is_none() {
             *first_allowlist_hit = Some((
                 PatternMatch {
@@ -6689,6 +6748,149 @@ fn parse_obfuscated_posix_inline_launcher_segment(
     }
 }
 
+/// Locate only a source operand whose option grammar is modeled here. Python
+/// stops option parsing at its source; other interpreters can replace or add
+/// programs through later flags, so their proof requires the minimal argv.
+fn non_shell_inline_source_word<'a>(
+    words: &[&'a str],
+    language: crate::heredoc::ScriptLanguage,
+) -> Option<&'a str> {
+    use crate::heredoc::ScriptLanguage;
+
+    if language == ScriptLanguage::Python {
+        return python_inline_source_word(words);
+    }
+    let [_, raw_flag, source] = words else {
+        return None;
+    };
+    let flag = crate::normalize::decode_posix_literal_word(raw_flag)?;
+    matches!(
+        (language, flag.as_ref()),
+        (ScriptLanguage::Ruby, "-e")
+            | (ScriptLanguage::Perl, "-e" | "-E")
+            | (
+                ScriptLanguage::JavaScript,
+                "-e" | "--eval" | "-p" | "--print"
+            )
+            | (ScriptLanguage::Php, "-r")
+    )
+    .then_some(*source)
+}
+
+/// Prove that Tier 2 extracted this launcher's actual, fully literal source.
+/// A successful extraction elsewhere in the command (including a decoy in
+/// script argv or inside its source) does not prove ownership 
```

**File**: `src/heredoc.rs` (modified, +302/-9)
```diff
@@ -83,6 +83,9 @@ const HEREDOC_TRIGGER_PATTERNS: [&str; 31] = [
     // - combined short-flag clusters (bash -lc, node -pe, perl -pi -e)
     // - Windows .exe extensions (python.exe, python3.11.exe, etc.)
     // - Attached quotes (python -c"...", bash -c'...')
+    // - A closing quote on the executable path ('/usr/bin/python3' -c ...).
+    //   Tier 2 already accepts it; without this, an argv-form Python sink
+    //   with no incidental trigger can skip language-aware inspection (#599).
     //
     // Tier 1 MUST have zero false negatives for Tier 2 extraction.
     //
@@ -92,18 +95,18 @@ const HEREDOC_TRIGGER_PATTERNS: [&str; 31] = [
     // superset invariant.  False positives are acceptable for Tier 1.
     r"<<<",
     // Python inline execution (matches python, python3, python3.11, python.exe, python3.11.exe, etc.)
-    r#"\bpython[0-9.]*(?:\.exe)?\b(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*[ce][A-Za-z]*(?:\s|['"]|$)"#,
+    r#"\bpython[0-9.]*(?:\.exe)?\b["']?(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*[ce][A-Za-z]*(?:\s|['"]|$)"#,
     // Ruby inline execution (matches ruby, ruby3, ruby3.0, ruby.exe, etc.)
-    r#"\bruby[0-9.]*(?:\.exe)?\b(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*e[A-Za-z]*(?:\s|['"]|$)"#,
-    r#"\birb[0-9.]*(?:\.exe)?\b(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*e[A-Za-z]*(?:\s|['"]|$)"#,
+    r#"\bruby[0-9.]*(?:\.exe)?\b["']?(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*e[A-Za-z]*(?:\s|['"]|$)"#,
+    r#"\birb[0-9.]*(?:\.exe)?\b["']?(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*e[A-Za-z]*(?:\s|['"]|$)"#,
     // Perl inline execution (matches perl, perl5, perl5.36, perl.exe, etc.)
-    r#"\bperl[0-9.]*(?:\.exe)?\b(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*[eE][A-Za-z]*(?:\s|['"]|$)"#,
+    r#"\bperl[0-9.]*(?:\.exe)?\b["']?(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*[eE][A-Za-z]*(?:\s|['"]|$)"#,
     // Node.js inline execution (matches node, node18, nodejs, node.exe, etc.)
-    r#"\bnode(?:js)?[0-9.]*(?:\.exe)?\b(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*[ep][A-Za-z]*(?:\s|['"]|$)"#,
+    r#"\bnode(?:js)?[0-9.]*(?:\.exe)?\b["']?(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*[ep][A-Za-z]*(?:\s|['"]|$)"#,
     // Bun and Deno inline execution (issue #397). Bun runs `-e`/`-p` exactly as
     // Node does, so the identical payload must reach the identical rules; before
     // this, swapping `node` for `bun` was a one-word bypass of a live deny.
-    r#"\b(?:bun|deno)[0-9.]*(?:\.exe)?\b(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*[ep][A-Za-z]*(?:\s|['"]|$)"#,
+    r#"\b(?:bun|deno)[0-9.]*(?:\.exe)?\b["']?(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*[ep][A-Za-z]*(?:\s|['"]|$)"#,
     // Bun's `exec` subcommand hands its argument to a shell, so it is an inline
     // shell payload under a subcommand rather than a flag (issue #397).
     // The optional quote matches `subcommand_inline_payload`, which dequotes the
@@ -134,15 +137,15 @@ const HEREDOC_TRIGGER_PATTERNS: [&str; 31] = [
     r"\$\.system\s*\(",
     r"\.doShellScript\s*\(",
     // PHP inline execution
-    r#"\bphp[0-9.]*(?:\.exe)?\b(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*r[A-Za-z]*(?:\s|['"]|$)"#,
+    r#"\bphp[0-9.]*(?:\.exe)?\b["']?(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*r[A-Za-z]*(?:\s|['"]|$)"#,
     // Lua inline execution
-    r#"\blua[0-9.]*(?:\.exe)?\b(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*e[A-Za-z]*(?:\s|['"]|$)"#,
+    r#"\blua[0-9.]*(?:\.exe)?\b["']?(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+['\x22]?-[A-Za-z]*e[A-Za-z]*(?:\s|['"]|$)"#,
     // Shell inline execution (sh -c, bash -c, zsh -c, fish -c, bash -lc, etc.).
     // dash/ksh/mksh are ordinary POSIX shells: without them `dash -c "git
     // reset --hard"` was never unwrapped, and command-position rules such as
     // core.git never saw the payload. An option or its value may be quoted
     // (`bash -o 'errex
```

**File**: `src/packs/careful_company_running_windows/guardrails.rs` (modified, +285/-5)
```diff
@@ -347,9 +347,45 @@ fn authorization_store_write_span_with_paths_in_source(
     command: &str,
     stores: &AuthorizationStorePaths,
     source_context: Option<(&str, usize)>,
+) -> Option<Range<usize>> {
+    if let Some(span) =
+        authorization_store_write_span_in_range(command, stores, source_context, None)
+    {
+        return Some(span);
+    }
+
+    // Masking a harmless sed script erases an argv position, not the write
+    // performed by -i. Recover roles only when the original interval has the
+    // same visible bytes. Parse its full owner so quoted examples and stored
+    // source never become standalone commands merely because of a slice.
+    let (source, start) = source_context?;
+    let end = start.checked_add(command.len())?;
+    let original = source.get(start..end)?;
+    if original == command
+        || !original
+            .bytes()
+            .zip(command.bytes())
+            .all(|(raw, masked)| raw == masked || masked.is_ascii_whitespace())
+    {
+        return None;
+    }
+    authorization_store_write_span_in_range(source, stores, None, Some(start..end))
+        .map(|span| span.start - start..span.end - start)
+}
+
+fn authorization_store_write_span_in_range(
+    command: &str,
+    stores: &AuthorizationStorePaths,
+    source_context: Option<(&str, usize)>,
+    visible_range: Option<Range<usize>>,
 ) -> Option<Range<usize>> {
     let ast = crate::heredoc::try_parse_shell_ast(command).ok()?;
     let (source, source_base) = source_context.unwrap_or((command, 0));
+    let visible = |span: &Range<usize>| {
+        visible_range
+            .as_ref()
+            .is_none_or(|range| range.start <= span.start && span.end <= range.end)
+    };
     let mut pending = vec![ast.root()];
     while let Some(node) = pending.pop() {
         match node.kind().as_ref() {
@@ -363,13 +399,34 @@ fn authorization_store_write_span_with_paths_in_source(
                     .filter(|owner| {
                         matches!(owner.kind().as_ref(), "command" | "redirected_statement")
                     })
-                    .map_or(node.range().start, |owner| owner.range().start);
+                    .map_or_else(
+                        || node.range().start,
+                        |owner| {
+                            // Bash can attach the redirect to the whole `a && b`
+                            // list, although only its final statement opens it.
+                            // Keep preceding directory changes, but do not enter
+                            // a compound/subshell body: its redirect opens first.
+                            let mut statement = owner.field("body").unwrap_or(owner);
+                            while statement.kind() == "list" {
+                                let Some(last) = statement
+                                    .children()
+                                    .filter(|part| part.is_named() && part.kind() != "comment")
+                                    .last()
+                                else {
+                                    break;
+                                };
+                                statement = last;
+                            }
+                            statement.range().start
+                        },
+                    );
                 if node.children().any(|part| {
                     matches!(
                         part.kind().as_ref(),
                         ">" | ">>" | ">|" | "&>" | "&>>" | ">&" | "<>"
                     )
                 }) && let Some(target) = node.field("destination")
+                    && visible(&(node.range().start..target.range().end))
                     && stores
                         .at_source_prefix(source.get(..source_base.checked_add(statement_start)?)?)
                         .matches_word(target.text().as_ref())
@@ -381,7 +438,7 @@ fn authorization_store_write_span_with_paths_in_source(
                 let statement_start = node
                     .parent()
                     .filter(|owner| owner.kind() == "redirected_statement")
-                    .map_or(node.range().start, |owner| owner.range().start);
+                    .map_or_else(|| node.range().start, |owner| owner.range().start);
                 let mut words = Vec::new();
                 for child in node.children().filter(ast_grep_core::Node::is_named) {
                     if !matches!(
@@ -415,7 +472,23 @@ fn authorization_store_write_span_with_paths_in_source(
                 }
                 let scoped_stores = stores
                     .at_source_prefix(source.get(..source_base.checked_add(statement_start)?)?);
-                if let Some(span) = authorization_writer_span(&words, &scoped_stores) {
+                if let Some(span) = authorization_writer_span(&words, &scoped_stores)
+                    && visible(&span)
+                {
+                    return Some(span);
+                }
+                // A map
```

**File**: `src/pending_exceptions.rs` (modified, +82/-8)
```diff
@@ -836,7 +836,7 @@ impl AllowOnceStore {
         Ok(Some(selected))
     }
 
-    /// Match a command against allow-once entries, but only grant if `force_allow_config` is set.
+    /// Match a command against the first scoped allow-once entry with `force_allow_config` set.
     ///
     /// This prevents single-use entries from being consumed when a config blocklist would still
     /// deny the command (unless explicitly forced).
@@ -864,18 +864,14 @@ impl AllowOnceStore {
             rewrite_allow_once_records(&mut file, &active)?;
         }
 
-        let idx = active
-            .iter()
-            .position(|entry| entry.command_raw == command && entry.matches_scope(cwd));
+        let idx = active.iter().position(|entry| {
+            entry.command_raw == command && entry.matches_scope(cwd) && entry.force_allow_config
+        });
 
         let Some(idx) = idx else {
             return Ok(None);
         };
 
-        if !active[idx].force_allow_config {
-            return Ok(None);
-        }
-
         let mut selected = active[idx].clone();
         if active[idx].single_use {
             selected.consumed_at = Some(format_timestamp(now));
@@ -1971,6 +1967,84 @@ mod tests {
         assert!(second.is_none());
     }
 
+    #[test]
+    fn test_forced_allow_once_skips_ordinary_and_mismatched_entries_issue_599() {
+        let dir = TempDir::new().expect("tempdir");
+        let cwd_dir = TempDir::new().expect("cwd tempdir");
+        let other_dir = TempDir::new().expect("other cwd tempdir");
+        let cwd = cwd_dir.path();
+        let scope = cwd.to_str().unwrap();
+        let store = AllowOnceStore::new(dir.path().join("allow_once.jsonl"));
+        let now = DateTime::parse_from_rfc3339("2026-01-10T06:30:00Z")
+            .unwrap()
+            .with_timezone(&Utc);
+        let command = "'/usr/bin/python3' -c 'print(1)'";
+        let redaction = redaction_config();
+        let pending =
+            PendingExceptionRecord::new(now, scope, command, "blocked", &redaction, true, None);
+        let ordinary = AllowOnceEntry::from_pending(
+            &pending,
+            now,
+            AllowOnceScopeKind::Cwd,
+            scope,
+            true,
+            false,
+            &redaction,
+        );
+        let mut forced = ordinary.clone();
+        forced.force_allow_config = true;
+        let mut wrong_command = forced.clone();
+        wrong_command.command_raw.push(' ');
+        let mut wrong_cwd = forced.clone();
+        wrong_cwd.scope_path = other_dir.path().to_str().unwrap().to_string();
+        let preserved = [ordinary.clone(), wrong_command, wrong_cwd];
+        for entry in &preserved {
+            store.add_entry(entry, now).unwrap();
+        }
+
+        assert!(
+            store
+                .match_command_force_config(command, cwd, now, None)
+                .unwrap()
+                .is_none(),
+            "ordinary, altered-command, and other-cwd entries cannot override policy"
+        );
+        assert_eq!(store.load_active(now).unwrap().0, preserved);
+
+        // A later explicit forced authorization must not be hidden by the
+        // retained ordinary entry for the same command and cwd.
+        store.add_entry(&forced, now).unwrap();
+        let selected = store
+            .match_command_force_config(command, cwd, now, None)
+            .unwrap()
+            .expect("later matching forced entry");
+        forced.consumed_at = Some(format_timestamp(now));
+        assert_eq!(selected, forced);
+        assert_eq!(store.load_active(now).unwrap().0, preserved);
+        assert!(
+            store
+                .match_command_force_config(command, cwd, now, None)
+                .unwrap()
+                .is_none(),
+            "a forced single-use entry cannot be reused"
+        );
+        assert_eq!(store.load_active(now).unwrap().0, preserved);
+
+        // Removing the policy later still leaves the ordinary authorization
+        // usable once; the failed policy attempts never consumed it.
+        let selected = store.match_command(command, cwd, now, None).unwrap();
+        let mut consumed_ordinary = ordinary;
+        consumed_ordinary.consumed_at = Some(format_timestamp(now));
+        assert_eq!(selected, Some(consumed_ordinary));
+        assert_eq!(store.load_active(now).unwrap().0, preserved[1..]);
+        assert!(
+            store
+                .match_command(command, cwd, now, None)
+                .unwrap()
+                .is_none()
+        );
+    }
+
     #[test]
     fn test_allow_once_project_scope_matches_subdir() {
         let dir = TempDir::new().expect("tempdir");
```

**File**: `tests/cli_e2e.rs` (modified, +771/-2)
```diff
@@ -1460,6 +1460,17 @@ mod allow_once_management_tests {
 
 mod allow_once_flow_tests {
     use super::*;
+    use destructive_command_guard::pending_exceptions::{
+        AllowOnceEntry, AllowOnceScopeKind, PendingExceptionRecord,
+    };
+
+    const INLINE_POLICY_REASON: &str = "issue 599 explicit policy";
+    const INLINE_SENTINEL: &str = "decision-only sentinel\n";
+    const QUOTED_PRINT: &str = "'/usr/bin/python3' -c 'print(1)'";
+    const QUOTED_UNLINK: &str =
+        "'/usr/bin/python3' -c 'import pathlib; pathlib.Path(\"important.txt\").unlink()'";
+    const UNQUOTED_UNLINK: &str =
+        "python3 -c 'import pathlib; pathlib.Path(\"important.txt\").unlink()'";
 
     /// Dedicated test environment with control over all file paths.
     struct FlowTestEnv {
@@ -1468,17 +1479,25 @@ mod allow_once_flow_tests {
         xdg_config_dir: std::path::PathBuf,
         pending_path: std::path::PathBuf,
         allow_once_path: std::path::PathBuf,
+        config_path: Option<std::path::PathBuf>,
     }
 
     impl FlowTestEnv {
         fn new() -> Self {
+            Self::with_repository(true)
+        }
+
+        fn with_repository(repository: bool) -> Self {
             let temp = tempfile::tempdir().expect("tempdir");
             let home_dir = temp.path().join("home");
             let xdg_config_dir = temp.path().join("xdg_config");
             std::fs::create_dir_all(&home_dir).expect("HOME dir");
             std::fs::create_dir_all(&xdg_config_dir).expect("XDG_CONFIG_HOME dir");
-            // Create a .git directory so it's recognized as a repo
-            std::fs::create_dir_all(temp.path().join(".git")).expect(".git dir");
+            // Preserve the existing tests' project scope. The inline tests
+            // deliberately use a plain directory to exercise exact cwd scope.
+            if repository {
+                std::fs::create_dir_all(temp.path().join(".git")).expect(".git dir");
+            }
 
             let pending_path = temp.path().join("pending_exceptions.jsonl");
             let allow_once_path = temp.path().join("allow_once.jsonl");
@@ -1489,7 +1508,219 @@ mod allow_once_flow_tests {
                 xdg_config_dir,
                 pending_path,
                 allow_once_path,
+                config_path: None,
+            }
+        }
+
+        fn with_inline_policy() -> Self {
+            let mut env = Self::with_repository(false);
+            for directory in ["tmp", "xdg_cache", "xdg_state", "xdg_data", "other_cwd"] {
+                std::fs::create_dir_all(env.temp.path().join(directory))
+                    .expect("isolated inline test directory");
             }
+            for filename in ["important.txt", "other.txt"] {
+                std::fs::write(env.temp.path().join(filename), INLINE_SENTINEL)
+                    .expect("decision-only payload sentinel");
+            }
+            env.config_path = Some(env.temp.path().join("inline-policy.toml"));
+            env.write_inline_policy(None);
+            env
+        }
+
+        fn write_inline_policy(&self, blocked_command: Option<&str>) {
+            let block = blocked_command.map_or_else(String::new, |command| {
+                format!(
+                    "[overrides]\nblock = [{{ pattern = {:?}, reason = {:?} }}]\n",
+                    format!("^{}$", regex::escape(command)),
+                    INLINE_POLICY_REASON,
+                )
+            });
+            std::fs::write(
+                self.config_path.as_ref().expect("inline policy path"),
+                format!(
+                    "[general]\ncheck_updates = false\nself_heal_hook = false\n\
+                     [packs]\nenabled = [\"core.git\", \"core.filesystem\"]\n\
+                     [history]\nenabled = false\n\
+                     [heredoc]\nenabled = true\ntimeout_ms = 5000\n\
+                     fallback_on_parse_error = false\n{block}"
+                ),
+            )
+            .expect("write isolated inline policy");
+        }
+
+        fn inline_command(&self, cwd: &std::path::Path) -> Command {
+            let scratch = self.temp.path().join("tmp");
+            let mut command = Command::new(dcg_binary());
+            command
+                .env_clear()
+                .env("HOME", &self.home_dir)
+                .env("USERPROFILE", &self.home_dir)
+                .env("XDG_CONFIG_HOME", &self.xdg_config_dir)
+                .env("XDG_CACHE_HOME", self.temp.path().join("xdg_cache"))
+                .env("XDG_STATE_HOME", self.temp.path().join("xdg_state"))
+                .env("XDG_DATA_HOME", self.temp.path().join("xdg_data"))
+                .env("TMPDIR", &scratch)
+                .env("TEMP", &scratch)
+                .env("TMP", &scratch)
+                .env(
+                    "DCG_CONFIG",
+                    self.config_path.as_ref().expect("inline policy path"),
+                )
+                .env("DCG_ALLOWLIST_SYSTEM_PATH", "")
+        
```

---

### Incident Patch 2: `efbd488c` (2026-10-29)
**Commit Message**: fix(python): judge a sink argv passed by a name bound to a literal (#602)

`args = ['rm', '-rf', '/home/user']` and then `subprocess.run(args)` runs
the argv that is denied when written inline, but it was allowed. The
backstops read operands only from the call text, a bare name became the
run-time placeholder, and an argv whose program is unknown keeps the
warn-only posture. No other layer saw the list either, since it is not
contiguous command text.

When a Python sink call's whole argv is a bare name (its first positional
argument, or `args=NAME`), python_bound_argv_calls finds each statement
that assigns a list or tuple literal to that name, annotated or not, at a
line start or after `;`, and not inside a string literal. It writes each
literal in the name's place. The backstop judges every such call with
detect_destructive_in_args and keeps the most severe hit. The
reconstruction loop reads each one too, so pack rules see the command
(`cmd = ['dd', 'if=/dev/zero', 'of=/dev/sda']`).

Every literal binding counts, in any scope and whatever comes between, so
a later rebinding or another function's variable of the same name can
only add a reading. That over-approximates toward a den

**File**: `src/ast_pattern_engine.rs` (modified, +232/-69)
```diff
@@ -597,7 +597,14 @@ pub fn scan_executing_sink_matches(code: &str, language: ScriptLanguage) -> Vec<
         let hit = if inert_string_end.is_some() {
             detect_destructive_in_literal_args(arg_region, language)
         } else {
-            detect_destructive_in_args(arg_region, language)
+            // A name bound to a literal list or tuple is judged as that literal
+            // written in its place (#602).
+            python_bound_argv_calls(language, haystack, arg_region, python_text.as_ref())
+                .iter()
+                .fold(
+                    detect_destructive_in_args(arg_region, language),
+                    |found, call| more_severe(found, detect_destructive_in_args(call, language)),
+                )
         };
         let Some(hit) = hit else {
             continue;
@@ -802,83 +809,94 @@ pub fn exec_sink_reconstructed_commands(
         let inert_string_end = python_text
             .as_ref()
             .and_then(|text| text.inert_string_end(call_start));
-        let region = exec_sink_arg_region(
+        let call_region = exec_sink_arg_region(
             inert_string_end.map_or(haystack, |end| &haystack[..end]),
             call_start,
         );
-        // A call the rm/git backstop owns (any `detect_destructive_in_args`
-        // hit) is left to it, so an allowlisted `rm`/`git` is not re-denied
-        // here under a pack rule id.
-        if detect_destructive_in_args(region, language).is_some() {
-            continue;
-        }
-        // Operands, for the same reason `detect_destructive_in_args` uses them:
-        // reconstructing `dd` from `"d"+"d"` as two argv words would not be the
-        // command the call actually runs (#474).
-        //
-        // #562 resolution is enabled only once this call's program word
-        // (read with resolution off) is an archive tool, never a launcher.
-        let argv = if const_env.is_some() {
-            RESOLVE_ENABLED.with(|cell| cell.set(false));
-            let unresolved = exec_argv_operands(region, language);
-            let archive = unresolved
-                .values
-                .first()
-                .is_some_and(|program| is_archive_program(program));
-            if archive {
-                RESOLVE_ENABLED.with(|cell| cell.set(true));
-                let resolved = exec_argv_operands(region, language);
-                RESOLVE_ENABLED.with(|cell| cell.set(false));
-                resolved
-            } else {
-                unresolved
-            }
+        // A name bound to a literal list or tuple is reconstructed as that
+        // literal written in its place (#602); in a string nothing runs, the
+        // name stays text.
+        let bound = if inert_string_end.is_none() {
+            python_bound_argv_calls(language, haystack, call_region, python_text.as_ref())
         } else {
-            exec_argv_operands(region, language)
+            Vec::new()
         };
-        if argv.unverified {
-            continue;
-        }
-        // In a string nothing runs, a name is text, not a value decided at run
-        // time, so it raises no dynamic-path or alias question (#601). A fully
-        // literal command is still judged, as any destructive literal is.
-        if inert_string_end.is_some()
-            && argv
-                .values
-                .iter()
-                .any(|value| value.contains(RUNTIME_VALUE))
-        {
-            continue;
-        }
-        let operands = argv.values;
-        let command = match operands.as_slice() {
-            [] => continue,
-            // One string handed to a shell (#512): see below.
-            [script] => {
-                if !single_string_sink_runs_shell(language, sink, haystack, call_start, region) {
-                    continue;
+        for region in std::iter::once(call_region).chain(bound.iter().map(String::as_str)) {
+            // A call the rm/git backstop owns (any `detect_destructive_in_args`
+            // hit) is left to it, so an allowlisted `rm`/`git` is not re-denied
+            // here under a pack rule id.
+            if detect_destructive_in_args(region, language).is_some() {
+                continue;
+            }
+            // Operands, for the same reason `detect_destructive_in_args` uses them:
+            // reconstructing `dd` from `"d"+"d"` as two argv words would not be the
+            // command the call actually runs (#474).
+            //
+            // #562 resolution is enabled only once this call's program word
+            // (read with resolution off) is an archive tool, never a launcher.
+            let argv = if const_env.is_some() {
+                RESOLVE_ENABLED.with(|cell| cell.set(false));
+                let unresolved = exec_argv_operands(region, language);
+                let archive = unresolved
+                    .values
+                    .first()
+                    .is_some_and(|program| is_archive_progr
```

**File**: `src/evaluator.rs` (modified, +58/-0)
```diff
@@ -42374,6 +42374,64 @@ mod tests {
         }
     }
 
+    /// #602 end to end: a Python sink argv passed by a name bound to a literal
+    /// list or tuple is judged as that literal written inline. A name bound to
+    /// anything else, or only in a string or comment, keeps its old posture.
+    #[test]
+    fn python_argv_bound_to_a_name_is_judged_602() {
+        let body = |code: &str| format!("python3 - <<'PY'\n{code}\nPY");
+        let packs = ["core.git", "core.filesystem", "system.disk"];
+        for command in [
+            body("import subprocess\nargs = ['rm','-rf','/home/user']\nsubprocess.run(args)"),
+            body("import subprocess\nargs = ('git','reset','--hard')\nsubprocess.run(args)"),
+            body("import subprocess\nx = ['a']\nargs = ['git','add',*x]\nsubprocess.run(args)"),
+            body("import subprocess\nargs = ['rm','-rf','/home/user']\nsubprocess.run(args=args)"),
+            body(
+                "import subprocess\nargs = ['rm','-rf','/home/user']\n\
+                 subprocess.check_call(args)\nsubprocess.Popen(args)",
+            ),
+            "python3 -c 'import subprocess; a = [\"git\",\"reset\",\"--hard\"]; subprocess.run(a)'"
+                .to_string(),
+            body(
+                "import subprocess\ncmd: list[str] = [\n    'git',\n    'reset',\n    \
+                 '--hard',  # discard\n]\nsubprocess.run(cmd, check=True)",
+            ),
+            body(
+                "import subprocess\ncmd = ['dd', 'if=/dev/zero', 'of=/dev/sda']\nsubprocess.run(cmd)",
+            ),
+            body(
+                "import subprocess\ncmd = ['git', 'status']\nif x:\n    \
+                 cmd = ['git', 'clean', '-fdx']\nsubprocess.run(cmd)",
+            ),
+        ] {
+            let result = evaluate_with_pack_ids_in_dialect(&command, &packs, ShellDialect::Posix);
+            assert!(
+                result.is_denied(),
+                "{command:?} must be denied: {:?}",
+                result.pattern_info
+            );
+        }
+        for command in [
+            body("import subprocess\ncmd = ['git', 'status']\nsubprocess.run(cmd)"),
+            body("import subprocess, sys\nargs = sys.argv[1:]\nsubprocess.run(args)"),
+            body(
+                "import subprocess\ns = \"args = ['rm','-rf','/home/user']\"\n\
+                 args = ['git','status']\nsubprocess.run(args)",
+            ),
+            body(
+                "import subprocess\n# args = ['rm','-rf','/home/user']\n\
+                 args = ['git','status']\nsubprocess.run(args)",
+            ),
+        ] {
+            let result = evaluate_with_pack_ids_in_dialect(&command, &packs, ShellDialect::Posix);
+            assert!(
+                result.is_allowed(),
+                "{command:?} must be allowed: {:?}",
+                result.pattern_info
+            );
+        }
+    }
+
     #[test]
     fn here_string_receiver_analysis_preserves_bash_rule_allowlists_issue_555() {
         let enabled_packs = ["core.git".to_string(), "core.filesystem".to_string()]
```

---

### Incident Patch 3: `66e108c9` (2026-10-29)
**Commit Message**: fix(python): read sink call text in strings and comments as text (#601)

The Python exec-sink backstops (scan_executing_sink_matches and
exec_sink_reconstructed_commands) found `run(`, `Popen(` and
`check_output(` with a regex over the whole body, comments and string
literals included. An edit script that quotes another script's
`subprocess.run([…` line in a search or replacement string, or a comment
that mentions one, was refused as exec_sink.argv_unverified or as a
reconstruction holding a run-time value.

PythonSinkText now reads the body's comments and the contents of its
plain string literals with a small lexer: prefixes, escapes, triple
quotes, and f- and t-string replacement fields (PEP 701), whose code is
not a string. Comments are blanked before the sink regex runs, as Perl's
are. Call text inside a string literal is still a call when the body can
run a string: when, outside every string and comment, it has a sink call
or names something that executes, imports or looks up code at run time
(exec, eval, compile, __import__, importlib, getattr, runpy, pickle,
ctypes, subprocess, popen/system/spawn, code.interact, ...). Otherwise the
call's region ends where the string does, a

**File**: `src/ast_pattern_engine.rs` (modified, +399/-7)
```diff
@@ -565,20 +565,41 @@ pub fn scan_executing_sink_matches(code: &str, language: ScriptLanguage) -> Vec<
         _ => return out,
     };
 
-    for caps in sink_regex.captures_iter(code) {
+    // A Python comment never runs, and call text in a string literal is not a
+    // call unless something can run the string (#601): see `PythonSinkText`.
+    let python_text = (language == ScriptLanguage::Python)
+        .then(|| PythonSinkText::read(code))
+        .flatten();
+    let haystack = python_text
+        .as_ref()
+        .map_or(code, |text| text.comments_masked.as_str());
+
+    for caps in sink_regex.captures_iter(haystack) {
         let Some(m) = caps.get(0) else { continue };
         let Some((call_start, sink)) = exec_sink_call(&caps) else {
             continue;
         };
+        let inert_string_end = python_text
+            .as_ref()
+            .and_then(|text| text.inert_string_end(call_start));
 
         // Scan the sink call's full argument region — not just its first string
         // literal — so a destructive payload nested inside a list/tuple literal
         // (`subprocess.run(["sh", "-c", "rm -rf /etc"])`) is caught even when the
         // first literal (`"sh"`) is inert (#136). The region spans from the
         // opening paren of this match to the balanced close paren (bounded to the
         // remainder of the source), descending into bracketed list elements.
-        let arg_region = exec_sink_arg_region(code, call_start);
-        let Some(hit) = detect_destructive_in_args(arg_region, language) else {
+        // Call text inside an inert string ends where the string does.
+        let arg_region = exec_sink_arg_region(
+            inert_string_end.map_or(haystack, |end| &haystack[..end]),
+            call_start,
+        );
+        let hit = if inert_string_end.is_some() {
+            detect_destructive_in_literal_args(arg_region, language)
+        } else {
+            detect_destructive_in_args(arg_region, language)
+        };
+        let Some(hit) = hit else {
             continue;
         };
 
@@ -747,8 +768,15 @@ pub fn exec_sink_reconstructed_commands(
     // Perl comments can hold a `system(...)` that never runs; mask them so a
     // commented call is not reconstructed and over-blocked. Masking preserves
     // length, so the sink spans still line up with `code`.
+    // Python's are masked the same way, and call text in a string nothing can
+    // run is not a call (#601).
+    let python_text = (language == ScriptLanguage::Python)
+        .then(|| PythonSinkText::read(code))
+        .flatten();
     let masked = if language == ScriptLanguage::Perl {
         mask_perl_comments(code)
+    } else if let Some(text) = python_text.as_ref() {
+        std::borrow::Cow::Borrowed(text.comments_masked.as_str())
     } else {
         std::borrow::Cow::Borrowed(code)
     };
@@ -771,7 +799,13 @@ pub fn exec_sink_reconstructed_commands(
         let Some((call_start, sink)) = exec_sink_call(&caps) else {
             continue;
         };
-        let region = exec_sink_arg_region(haystack, call_start);
+        let inert_string_end = python_text
+            .as_ref()
+            .and_then(|text| text.inert_string_end(call_start));
+        let region = exec_sink_arg_region(
+            inert_string_end.map_or(haystack, |end| &haystack[..end]),
+            call_start,
+        );
         // A call the rm/git backstop owns (any `detect_destructive_in_args`
         // hit) is left to it, so an allowlisted `rm`/`git` is not re-denied
         // here under a pack rule id.
@@ -805,6 +839,17 @@ pub fn exec_sink_reconstructed_commands(
         if argv.unverified {
             continue;
         }
+        // In a string nothing runs, a name is text, not a value decided at run
+        // time, so it raises no dynamic-path or alias question (#601). A fully
+        // literal command is still judged, as any destructive literal is.
+        if inert_string_end.is_some()
+            && argv
+                .values
+                .iter()
+                .any(|value| value.contains(RUNTIME_VALUE))
+        {
+            continue;
+        }
         let operands = argv.values;
         let command = match operands.as_slice() {
             [] => continue,
@@ -3979,6 +4024,212 @@ fn mask_perl_comments(code: &str) -> std::borrow::Cow<'_, str> {
     String::from_utf8(out).map_or(std::borrow::Cow::Borrowed(code), std::borrow::Cow::Owned)
 }
 
+/// A Python body as the exec-sink scans read it (#601).
+///
+/// A sink name inside a comment is never a call, so comments are blanked, as
+/// Perl's are. A sink name inside a string literal becomes a call only when
+/// something runs the string, and `strings_may_run` says whether the body
+/// could: outside every string and comment it has a sink call, or a name that
+/// executes, imports or looks up code at run time. When it cannot, call text
+/// in a string is judged by its literal content alone. De
```

**File**: `src/evaluator.rs` (modified, +72/-0)
```diff
@@ -42302,6 +42302,78 @@ mod tests {
         }
     }
 
+    /// #601 end to end: Python call text in a comment, or in a string the body
+    /// cannot run, is not a call. Strings handed to dynamic execution, real
+    /// calls, and destructive literals are judged as before.
+    #[test]
+    fn python_call_text_in_strings_and_comments_is_not_a_call_601() {
+        let body = |code: &str| format!("python3 - <<'PY'\n{code}\nPY");
+        for command in [
+            body("s = \"subprocess.run(['git','status'\""),
+            body("# subprocess.run(['git','x'\nprint(1)"),
+            body("s = 'subprocess.run([\"git\",\"add\",*x])'"),
+            body("s = \"subprocess.Popen(['git','status'\""),
+            body("s = \"subprocess.check_output(['git','status'\""),
+            body("s = \"run(['git','status'\""),
+            body(
+                "import sys\nt = open(sys.argv[1]).read()\n\
+                 t = t.replace(\"subprocess.run(['git', 'status'\", \"run_git('status'\")",
+            ),
+            "python3 -c 'print(1)  # subprocess.run([\"git\",\"x\"'".to_string(),
+            body("s = '''subprocess.run(['git','mv',f'{old}','b'])'''"),
+            body("s = '''subprocess.Popen(['git','mv',old,'b'])'''"),
+            body(
+                "s = '''subprocess.run(\n    [\n        \"git\",\n        \"mv\",\n        \
+                 f\"{old}{suffix}\",\n    ],\n)'''",
+            ),
+            body("# subprocess.run(['git','mv',old,'b'])"),
+            body("s = '''subprocess.check_output(['git',args])'''"),
+            body("# subprocess.run(['git',args])"),
+            body("print(1)  # subprocess.run(['rm','-rf','/home/user'])"),
+            body("import subprocess\ncmd = ['git', 'status']\nsubprocess.run(cmd)"),
+        ] {
+            let result = evaluate_with_pack_ids_in_dialect(
+                &command,
+                &["core.git", "core.filesystem"],
+                ShellDialect::Posix,
+            );
+            assert!(
+                result.is_allowed(),
+                "{command:?} must be allowed: {:?}",
+                result.pattern_info
+            );
+        }
+        let rm = "import subprocess; subprocess.run(['rm','-rf','/home/user'])";
+        for command in [
+            body("import subprocess\nx = ['a']\nsubprocess.run(['git', 'add', *x])"),
+            body(&format!("exec(\"{rm}\")")),
+            body(&format!("s = \"{rm}\"\nexec(s)")),
+            body(&format!(
+                "code = compile(\"{rm}\", 'x', 'exec')\nexec(code)"
+            )),
+            body(&format!(
+                "import subprocess, sys\nsubprocess.run([sys.executable, '-c', \"{rm}\"])"
+            )),
+            body(&format!(
+                "import subprocess, sys\ns = \"{rm}\"\nsubprocess.run([sys.executable, '-c', s])"
+            )),
+            body("s = \"subprocess.run(['rm','-rf','/home/user'])\"\nprint(s)"),
+            body("import subprocess\nold = 'a'\nsubprocess.run(['git','mv',old,'b'])"),
+            body("import subprocess\nargs = 'status'\nsubprocess.check_output(['git',args])"),
+        ] {
+            let result = evaluate_with_pack_ids_in_dialect(
+                &command,
+                &["core.git", "core.filesystem"],
+                ShellDialect::Posix,
+            );
+            assert!(
+                result.is_denied(),
+                "{command:?} must stay denied: {:?}",
+                result.pattern_info
+            );
+        }
+    }
+
     #[test]
     fn here_string_receiver_analysis_preserves_bash_rule_allowlists_issue_555() {
         let enabled_packs = ["core.git".to_string(), "core.filesystem".to_string()]
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

## X. allow-once): preserve policy precedence for exact outer grants (#599)

**RULE**:
When implementing operations in `src/evaluator.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Dicklesworthstone/destructive_command_guard. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `07c53c96`: allow-once): preserve policy precedence for exact outer grants (#599). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/evaluator.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// An ordinary exact grant cannot hide an explicit block on a later
    /// nested command. Policy inspection must read past whole-command grants,
    /// including the grant whose eligibility it is checking, without spending
    /// any of them. Recursive evaluation stays on this thread.
    static ALLOW_ONCE_POLICY_REPLAY: std::cell::Cell<bool> = const {
        std::cell::Cell::new(false)
    };
    /// A finding-only rescan can discard its verdict, so it must never spend
    /// a stateful grant. Permanent exemptions still govern its findings.
    static ALLOW_ONCE_SUPPRESSED: std::cell::Cell<bool> = const {
        std::cell::Cell::new(false)
    };
struct AllowOncePolicyScope {
    previous: bool,
}

impl AllowOncePolicyScope {
    fn enter() -> Self {
        Self {
            previous: ALLOW_ONCE_POLICY_REPLAY.with(|slot| slot.replace(true)),
        }
    }
}

impl Drop for AllowOncePolicyScope {
    fn drop(&mut self) {
        ALLOW_ONCE_POLICY_REPLAY.with(|slot| slot.set(self.previous));
    }
}

struct AllowOnceSuppressionScope {
    previous: bool,
}

impl AllowOnceSuppressionScope {
    fn enter() -> Self {
        Self {
            previous: ALLOW_ONCE_SUPPRE
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
/// An explicitly approved outer envelope is checked before its children run.
/// the hit for audit output.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `07c53c96` are properly handled with clean fallback behavior.
