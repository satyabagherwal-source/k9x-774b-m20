# Architecture Decision Record: ADR: Subsystem Boundary & Modular Decoupling in Dicklesworthstone/destructive_command_guard

<!-- PROVENANCE_START
{
  "source_repository": "Dicklesworthstone/destructive_command_guard",
  "source_url": "https://github.com/Dicklesworthstone/destructive_command_guard",
  "source_version": "4e6cb47a",
  "license": "NOASSERTION",
  "timestamp": "2026-11-24T19:00:29.559Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dicklesworthstone-destructive_command_guard",
  "canonical_classification": "architecture_decision"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard) (Revision: `4e6cb47a`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-24T19:00:29.559Z`  
> **Learning ID**: `learn-github-dicklesworthstone-destructive_command_guard`


## Status
**ACCEPTED** (Empirically verified from Dicklesworthstone/destructive_command_guard)

## Context
During deep inspection of Dicklesworthstone/destructive_command_guard, modular boundaries, performance characteristics, and concurrency constraints required explicit architectural trade-off analysis.

## Decision
# Forensic Learning Record (Deep Inspection): Dicklesworthstone/destructive_command_guard

> **Canonical Artifact**: `07_PROJECT_LEARNING/dicklesworthstone-destructive_command_guard-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T19:00:27.672Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dicklesworthstone/destructive_command_guard`
- **Description**: A fast Rust safety hook that blocks destructive shell, git, and filesystem commands before AI coding agents run them. 50+ security packs (databases, Kubernetes, Docker, cloud, Terraform), heredoc/inline-script scanning, CI scan mode, and explain mode; works with Claude Code, Codex, Gemini, Copilot, Cursor, and more.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6379 stars

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

/// Warm evaluator work for #647, including the independent byte/statement
/// limits and quoted .NET-looking data. Cold hook deadlines are measured by
/// the real-binary latency harness; this group deliberately has no deadline so
/// a timeout cannot make an expensive input look fast by skipping its work.
fn bench_issue_647(c: &mut Criterion) {
    use destructive_command_guard::normalize::ShellDialect;

    let mut config = Config::default();
    config.packs.enabled = vec!["core".to_string(), "windows.filesystem".to_string()];
    let enabled = config.enabled_pack_ids();
    let ordered = REGISTRY.expand_enabled_ordered(&enabled);
    let keywords = REGISTRY.collect_enabled_keywords(&enabled);
    let index = REGISTRY.build_enabled_keyword_index(&ordered);
    let overrides = config.overrides.compile();
    let allowlists = LayeredAllowlist::default();
    let heredoc = config.heredoc_settings();
    let evaluate = |command: &str| {
        destructive_command_guard::evaluator::evaluate_command_with_pack_order_deadline_at_path_in_dialect(
            command,
            &keywords,
            &ordered,
            index.as_ref(),
            &overrides,
            &allowlists,
            &heredoc,
            None,
            None,
            None,
            ShellDialect::PowerShell,
        )
    };

    let mut cases = Vec::new();
    for count in [300, 512, 513] {
        cases.push((
            format!("quoted_rm_{count}"),
            vec!["Write-Output 'rm x'"; count].join("; "),
            if count <= 512 {
                EvaluationDecision::Allow
            } else {
                EvaluationDecision::Indeterminate
            },
        ));
    }
    cases.push((
        "destructive_statement_512".to_string(),
        format!(
            "{}Remove-Item C:\\important -Recurse -Force",
            "Write-Output 'rm x'; ".repeat(511),
        ),
        EvaluationDecision::Deny,
    ));
    cases.push((
        "quoted_dotnet_512".to_string(),
        vec!["Write-Output '$directory.Delete($true); rm x'"; 512].join("; "),
        EvaluationDecision::Allow,
    ));
    // Many words force the intact-command prepasses to inspect the full
    // 64 KiB input; a single quoted padding word would not exercise that cost.
    let dense = format!("Write-Output {}rm", "x ".repeat((64 * 1024 - 15) / 2));
    assert_eq!(dense.len(), 64 * 1024 - 1);
    cases.push((
        "dense_words_near_byte_bound".to_string(),
        dense.clone(),
        EvaluationDecision::Allow,
    ));
    cases.push((
        "over_byte_bound".to_string(),
        format!("{dense} xx"),
        EvaluationDecision::Indeterminate,
    ));
    // The .NET necessary-literal guard rejects the dense case above cheaply.
    // Retain a guard-positive worst case: a quoted member call at the end
    // still exercises the suffix scans. Its active counterpart must deny.
    let prefix = "Write-Output ";
    for (name, tail, expected) in [
        (
            "dense_words_with_quoted_dotnet",
            "'$directory.Delete($true)'",
            EvaluationDecision::Allow,
        ),
        (
            "dense_words_with_active_dotnet",
            "; $directory.Delete($true)",
            EvaluationDecision::Deny,
        ),
    ] {
        let command = format!(
            "{prefix}{}{tail}",
            "x ".repeat((64 * 1024 - prefix.len() - tail.len()) / 2),
        );
        assert!((64 * 1024 - 1..=64 * 1024).contains(&command.len()));
        cases.push((name.to_string(), command, expected));
    }

    let mut group = c.benchmark_group("issue_647");
    group.sample_size(10);
    group.measurement_time(std::time::Duration::from_secs(3));
    for (name, command, expected) in cases {
        assert_eq!(evaluate(&command).decision, expected, "pre-check: {name}");
        group.benc
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
    PowerShellInvokedCommand, PowerShellTruncationTarget, WindowsShellParseIncomplete,
    classify_credential_file_write, classify_git_redirect_writes,
    classify_powershell_credential_writes, names_protected_file, names_protected_git_internal,
    names_windows_shell_writer, powershell_file_truncation_targets,
    powershell_file_truncation_targets_in_dialect, powershell_file_writer_scan_required,
    powershell_literal_invocations,
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
- **Issue #611** (2026-11-04): **[False Positive] heredoc.posix:pipeline-consumer: `… | perl -pe 's/x//'` denied while `… | perl -p -e 's/x//'` is allowed (bundled -e not read) (0.15.3 and main)**
  *Symptoms*: ### Blocked Command  cat /tmp/t.txt | perl -pe 's/x//'  ### Expected Behavior  `perl -pe CODE` is `perl -p -e CODE`: the program is the `-e` argument and the piped text is data. dcg already treats the split spelling that way. The bundled one, which is how these one-liners are usually written, is refused:  | Command | Observed (0.15.3) | |---|---| | `cat /tmp/t.txt \| perl -pe 's/x//'` | deny, heredoc.posix:pipeline-consumer | | `cat /tmp/t.txt \| perl -p -e 's/x//'` | allow | | `cat /tmp/t.txt \| perl -ne 'print'` | deny | | `cat /tmp/t.txt \| perl -n -e 'print'` | allow | | `cat /tmp/t.txt \| perl -lne 'print'` | deny | | `cat /tmp/t.txt \| perl -l -n -e 'print'` | allow | | `cat /tmp/t.txt \| perl -anE 'say $F[0]'` | deny | | `cat /tmp/t.txt \| perl -a -n -E 'say $F[0]'` | allow | | `cat /tmp/t.txt \| perl -le 'print 1'` | deny | | `cat /tmp/t.txt \| perl -i -pe 's/x//'` | deny | | `cat /tmp/t.txt \| ruby -ne 'puts $_'` | deny | | `cat /tmp/t.txt \| ruby -n -e 'puts $_'` | allow | | `cat /tmp/t.txt \| ruby -pe '$_.upcase!'` | deny | | `cat /tmp/t.txt \| ruby -p -e '$_.upcase!'` | allow | | `cat /tmp/t.txt \| perl -pe 's/x//' \| sort` | deny | | `cat /tmp/t.txt \| perl -p -e 's/x//' \| sort` | allow | | `perl -pe 's/x//' /tmp/t.txt` | allow | | `perl -pe 's/x//' < /tmp/t.txt` | allow |  **Must stay blocked**, and they do. Reading the cluster loses nothing, because the program is judged on its own: `cat /tmp/t.txt | perl -p -e 'system("git reset --hard")'` and `perl -pe 'syst

- **Issue #608** (2026-11-21): **[False Positive] main denies a literal interpreter binding v0.15.3 resolves: `PY=/usr/bin/python3; $PY -c "print(1)"` is inline-launcher-unverified (regression since 0.15.3)**
  *Symptoms*: ### Blocked Command  PY=/usr/bin/python3; $PY -c "print(1)"  ### Expected Behavior  This should be allowed, as it is on v0.15.3. The v0.13.6 changelog says dcg resolves "literal executable assignments before per-pack evaluation. Straight-line POSIX forms such as `d=docker; $d system prune -af` now bind the later segment to Docker". On main that still holds for `git`, `docker` and `sh`, but no longer for an interpreter followed by an inline-code flag:  | Command | v0.15.3 | main deff5c07 | |---|---|---| | `PY=/usr/bin/python3; $PY -c "print(1)"` | allow | **deny**, inline-launcher-unverified | | `PY=/usr/bin/python3; "$PY" -c "print(1)"` | allow | **deny** | | `D=/tmp/x; PY=/usr/bin/python3; $PY -c "print(1)"` | allow | **deny** | | `PL=/usr/bin/perl; $PL -e 'print 1'` | allow | **deny** | | `N=/usr/bin/node; $N -e 'console.log(1)'` | allow | **deny** | | `bash -c 'PY=/usr/bin/python3; $PY -c "x = 1"'` | allow | **deny** | | `ssh h 'PY=/usr/bin/python3; $PY -c "x = 1"'` | allow | **deny** | | `SH=/bin/sh; $SH -c 'echo hi'` | allow | allow | | `d=git; $d status` | allow | allow | | `PY=/usr/bin/python3; $PY -m json.tool /dev/null` | allow | allow | | `PY=/usr/bin/python3; $PY /tmp/script.py` | allow | allow | | `/usr/bin/python3 -c "print(1)"` | allow | allow |  The binding is in the same command, straight-line, with a literal absolute path, and the shell form of the same proof (`SH=/bin/sh; $SH -c`) still passes. The program is no longer read, either: `PY=/usr/bin/python3; $PY

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

### Incident Patch 1: `4e6cb47a` (2026-11-24)
**Commit Message**: fix(security): harden modprobe sudo folding, oversized scan bounds, binding model, cross-dialect parsing, and degraded heredoc attribution [skip ci]

Security & normalization fixes:
- Enforce exact deny-wins over {env_reset, env_keep} when MODPROBE_OPTIONS or
  POSIXLY_CORRECT crosses sudo without explicit -E / --preserve-env covering
  the variable, and whitelist known safe sudo long options (--preserve-env,
  --user, etc.) while keeping unknown long options (--list, --edit) unstripped.
- Remove the literal "modprobe" substring pre-filter in
  leading_unstripped_posixly_correct_before_modprobe so quoted/escaped argv0
  forms ('mod'probe, m\odprobe) still fold --.
- Split MODPROBE_OPTIONS on C isspace() bytes including vertical tab (\x0b).
- Split cmd_elided_argv0_has_nonempty_basename on both '\' and '/' so
  forward-slash wholly-dynamic paths (C:/Windows/System32/%TOOL%) stay inert.
- Harden oversized lexical windowing (src/main.rs): expand rebind-head
  detection across POSIX/PowerShell/Cmd/Unknown, widen UTF-8 step boundary to
  5 bytes, and fail closed when multi-window splitting may sever earlier
  assignments from later expansions.

Bead closures:
- bd-binding-model-variants

**File**: `.beads/issues.jsonl` (modified, +3/-3)
```diff
@@ -69,7 +69,7 @@
 {"id":"bd-adfq","title":"Reduce hook heredoc latency with measured deep AST optimization (#555)","description":"Investigate GitHub issue #555 against main 00a1c8b5325544568758766e45649215cb88f350. Improve sophisticated AST analysis without reducing escalation frequency, changing safety deadlines, weakening fallback, or treating unexamined input as safe.\n\n## Working checklist\n\n- [x] Read repository guidance and comprehensive improvement plans; inspect current Beads graph and issue report/comments.\n- [x] Preserve the incumbent source in a detached worktree and start an identical-toolchain shipping-profile build.\n- [x] Assign disjoint AST, instrumentation, and benchmark/regression work; keep one Beads writer.\n- [x] Add opt-in request parsing, input wait, configuration, normalization, extraction/detection, pattern, AST compile/parse/match, and history timings.\n- [x] Account separately for worker-thread timings, overlapping phases, incomplete work, and total hook time; keep wire stdout unchanged.\n- [x] Reproduce short ls, pipeline, compound command, 40/300-line executable Python heredocs, and quoted commit-message/data heredocs.\n- [x] Compare incumbent and candidate in the same invocation with alternating order, matched bypass, CPU/wall samples, and exact timed-child verdict checks (16 cases, disabled/enabled, 30 pairs, all timed verdicts pass).\n- [x] Finish writer-contended and synthetic 247,625-row history comparisons (six representative cases, 15 pairs); all timed verdicts pass, and SQLite writer contention remains visible as wall time in history flush.\n- [x] Avoid eager initialization of unrelated AST language corpora; share immutable compiled patterns instead of cloning them for each body.\n- [x] Index AST candidates by ast-grep's own node-kind information and walk each source tree once; preserve wildcard rules, all nested matches, and pattern-major order.\n- [x] Measure repeated full-input parsing/extraction; implement exact shared stdin-source facts, indexed AST traversal, and necessary-byte keyword candidate search without reducing deep analysis.\n- [x] Add differential old-versus-new AST matching tests for every supported grammar, wildcards, contextual patterns, nested/multiple matches, and large inputs.\n- [x] Add deterministic hook regressions for executable quoted/unquoted bodies, substitutions, nested interpreters, quoted data, compound commands, and ambiguous syntax (execution remains pending below).\n- [x] Add Criterion coverage for small/large extraction and the complete deep-analysis path with safe and dangerous bodies.\n- [x] Run the initial focused Rust tests (34/34 pass); preserve full initial library results (4,661 pass, two stale-fixture failures, seven skips).\n- [x] Run combined focused Rust and profiling-output regressions after upstream integration and the robot-output repair (4,670 library tests and 71 hook integration tests pass).\n- [ ] Run cargo fmt --check, cargo check --all-targets --locked, cargo clippy --all-targets --locked -- -D warnings, and feasible full Rust suites; record actual resource failures separately.\n- [ ] Run real-binary E2E protocol/security suites and absolute latency gate without relaxing deadlines or expectations.\n- [ ] Review security invariants and complete patch independently; inspect bounded cache/lifetime and worker-timeout behavior.\n- [ ] Commit meaningful implementation batches directly to main through GitHub with expected-head protection; verify remote source and CI where feasible.\n- [x] Record the first integrated-stage paired numbers, environment/build identities, limitations, remaining bottlenecks, and reporter reproduction commands in repository documentation; preserve raw output byte for byte.\n- [ ] Update completed Beads with cited evidence; inspect remaining validation bead bd-cgy0 against its exact acceptance criteria.\n- [x] Verify the already-implemented archive-extraction destination task against protected paths and safe controls through both hook and CLI (20 cases, 40 observations).\n- [x] Close archive-extraction bead with the concrete acceptance evidence.\n- [x] Preserve nested interpreter heredoc wrappers and trigger recursive analysis without requiring shell pack keywords; real hook now denies the previously allowed destructive Python body.\n- [x] Correct here-string body language routing and validate nested multiline Python, safe bodies, data consumers, ambiguous targets, and exact destructive rule identity (all 48 real-hook security controls pass integrated candidate).\n- [x] Make history capture/replacement regex compilation lazy behind the unchanged RegexSet; add differential tests including Unicode and fallback behavior.\n- [x] Implement shared exact stdin source facts to eliminate repeated whole-command provenance processing in core.filesystem; add an independent legacy differential oracle (execution remains pending).\n- [x] Finish the integrated-stage static UBS scan using the pinned official t
```

**File**: `src/evaluator.rs` (modified, +1352/-213)
```diff
@@ -12802,6 +12802,27 @@ fn powershell_pipeline_consumer_mode(
         }
         _ => {}
     }
+    // Windows Python launcher (`py` / `py.exe`), optionally preceded by a
+    // `-3` / `-3.12` / `-2` version selector argument before Python's argv.
+    if executable == "py" {
+        let forwarded = match args.first().map(String::as_str) {
+            Some(first)
+                if first.starts_with('-')
+                    && first.len() >= 2
+                    && first[1..]
+                        .bytes()
+                        .all(|b| b.is_ascii_digit() || b == b'.' || b == b'-')
+                    && first.as_bytes()[1].is_ascii_digit() =>
+            {
+                &args[1..]
+            }
+            _ => args,
+        };
+        let mode =
+            python_pipeline_input_mode("", forwarded, crate::heredoc::ScriptLanguage::Python);
+        let terminal = mode == PipelineShellInputMode::DoesNotReadStdin;
+        return Some((mode, terminal));
+    }
     let language = crate::heredoc::ScriptLanguage::from_command(&executable);
     match language {
         crate::heredoc::ScriptLanguage::Python => {
@@ -13505,6 +13526,13 @@ fn find_powershell_scriptblock_create(command: &str, start: usize) -> Option<(us
 }
 
 fn local_powershell_prefix(prefix: &str) -> &str {
+    if prefix.contains("@'") || prefix.contains("@\"") {
+        if let Ok(statements) = split_top_level_powershell_statements(prefix)
+            && let Some(last) = statements.last()
+        {
+            return last;
+        }
+    }
     prefix.rsplit([';', '\n', '|']).next().unwrap_or(prefix)
 }
 
@@ -15383,6 +15411,33 @@ fn collect_executable_text_sinks(command: &str, dialect: ShellDialect) -> Vec<Ex
     // dialects; the POSIX/Unknown pipe path is the bash-AST collector above.
     if matches!(dialect, ShellDialect::Cmd | ShellDialect::PowerShell) {
         collect_dialect_pipeline_stdin_sinks(command, dialect, &mut sinks);
+    } else if dialect == ShellDialect::Unknown
+        && command.contains('|')
+        && (command.contains("@'") || command.contains("@\""))
+    {
+        // A PowerShell here-string piped into an interpreter (`@'\n...\n'@ | python3`)
+        // looks like an unknown producer to POSIX; collect its native PowerShell
+        // pipeline payloads ahead of unverified POSIX sinks so concrete language
+        // rules win while preserving fail-closed posture.
+        let mut ps_sinks = Vec::new();
+        collect_dialect_pipeline_stdin_sinks(command, ShellDialect::PowerShell, &mut ps_sinks);
+        let has_concrete_payload = ps_sinks
+            .iter()
+            .any(|sink| matches!(sink, ExecutableTextSink::Payload { .. }));
+        if has_concrete_payload {
+            let mut ordered = Vec::with_capacity(ps_sinks.len() + sinks.len());
+            for sink in ps_sinks {
+                if matches!(sink, ExecutableTextSink::Payload { .. }) && !ordered.contains(&sink) {
+                    ordered.push(sink);
+                }
+            }
+            for sink in sinks {
+                if !ordered.contains(&sink) {
+                    ordered.push(sink);
+                }
+            }
+            return ordered;
+        }
     }
     sinks
 }
@@ -16237,7 +16292,9 @@ struct PosixExecutableAssignmentModel {
 }
 
 const MAX_POSIX_EXECUTABLE_BINDINGS: usize = 64;
-const MAX_POSIX_EXECUTABLE_SEGMENTS: usize = 128;
+const MAX_POSIX_EXECUTABLE_OVERFLOW_NAMES: usize = 512;
+const MAX_POSIX_EXECUTABLE_BRANCH_VALUES: usize = 4;
+const MAX_POSIX_EXECUTABLE_SEGMENTS: usize = 256;
 const MAX_POSIX_EXECUTABLE_FIELDS: usize = 128;
 const MAX_POSIX_EXECUTABLE_VALUE_BYTES: usize = 16 * 1024;
 const POSIX_EXECUTABLE_UNVERIFIED_RULE: &str = "heredoc.posix.executable-unverified";
@@ -16249,12 +16306,132 @@ enum ModeledPosixIfs {
     Unverified,
 }
 
-#[derive(Debug)]
+#[derive(Debug, Clone)]
 enum ModeledPosixBinding {
-    Literal(String),
+    /// One or more possible literal values (more than one only after merging
+    /// conditional `&&`/`||` branches in deny-only mode).
+    Literal(Vec<String>),
     Unverified(&'static str),
 }
 
+/// Bounded binding store: tracks up to `MAX_POSIX_EXECUTABLE_BINDINGS` (64)
+/// active variables in recency order, evicting the oldest into `overflowed`
+/// rather than blindly poisoning every later `$var` invocation
+/// (bd-binding-model-variants-fd5q).
+#[derive(Clone, Default)]
+struct ModeledPosixBindings {
+    entries: HashMap<String, ModeledPosixBinding>,
+    order: std::collections::VecDeque<String>,
+    overflowed: HashSet<String>,
+    overflow_exhausted: bool,
+}
+
+impl ModeledPosixBindings {
+    fn get(&self, name: &str) -> Option<&ModeledPosixBinding> {
+        self.entries.get(name)
+    }
+
+    fn is_overflowed(&self, name: &str) -> bool {
+        self.overflow_exhausted || self.overflowed.contains(name)
+    }
+
+    fn insert(&mut self, name: String, binding: ModeledPosixBinding) {
+        self.overflowed.re
```

**File**: `src/main.rs` (modified, +150/-24)
```diff
@@ -1595,34 +1595,98 @@ fn scan_oversized_top_level_segments(
 /// boundaries: whitespace-only, a single-line `#` comment (non-Cmd), or a plain
 /// literal `echo`/`Write-Output` with zero metacharacters, expansions,
 /// redirections, escapes, or shell-function overrides.
+fn contains_ascii_word_ci(haystack: &str, needle: &str) -> bool {
+    let h = haystack.as_bytes();
+    let n = needle.as_bytes();
+    if n.is_empty() || h.len() < n.len() {
+        return false;
+    }
+    let is_word = |b: u8| b.is_ascii_alphanumeric() || b == b'_' || b == b'-';
+    h.windows(n.len()).enumerate().any(|(idx, window)| {
+        window.eq_ignore_ascii_case(n)
+            && (idx == 0 || !is_word(h[idx - 1]))
+            && (idx + n.len() == h.len() || !is_word(h[idx + n.len()]))
+    })
+}
+
 fn command_may_rebind_inert_head(command: &str, dialect: ShellDialect) -> bool {
-    match dialect {
-        ShellDialect::Cmd => {
-            // doskey macros can rebind cmd built-ins/commands.
-            command
-                .as_bytes()
-                .windows(6)
-                .any(|w| w.eq_ignore_ascii_case(b"doskey"))
-        }
-        ShellDialect::PowerShell => {
-            let bytes = command.as_bytes();
-            bytes
+    let cmd_rebind = || {
+        command
+            .as_bytes()
+            .windows(6)
+            .any(|w| w.eq_ignore_ascii_case(b"doskey"))
+    };
+    let ps_rebind = || {
+        let bytes = command.as_bytes();
+        bytes
+            .windows(8)
+            .any(|w| w.eq_ignore_ascii_case(b"function"))
+            || bytes.windows(6).any(|w| w.eq_ignore_ascii_case(b"filter"))
+            || bytes.windows(5).any(|w| w.eq_ignore_ascii_case(b"alias"))
+            || bytes
+                .windows(8)
+                .any(|w| w.eq_ignore_ascii_case(b"set-item"))
+            || bytes
                 .windows(8)
-                .any(|w| w.eq_ignore_ascii_case(b"function"))
-                || bytes.windows(6).any(|w| w.eq_ignore_ascii_case(b"filter"))
-                || bytes.windows(5).any(|w| w.eq_ignore_ascii_case(b"alias"))
-                || bytes
-                    .windows(9)
-                    .any(|w| w.eq_ignore_ascii_case(b"function:"))
+                .any(|w| w.eq_ignore_ascii_case(b"new-item"))
+            || bytes
+                .windows(17)
+                .any(|w| w.eq_ignore_ascii_case(b"invoke-expression"))
+            || bytes
+                .windows(13)
+                .any(|w| w.eq_ignore_ascii_case(b"import-module"))
+            || contains_ascii_word_ci(command, "sal")
+            || contains_ascii_word_ci(command, "nal")
+            || contains_ascii_word_ci(command, "iex")
+            || contains_ascii_word_ci(command, "ipmo")
+    };
+    let posix_rebind = || {
+        // Any `()` catches `echo  () { ... }`, `echo\t() { ... }`, `'echo'()`,
+        // and arbitrary shell function definitions without relying on exact
+        // spacing. `eval`, `source`, `enable`, `shopt`, and dot-sourcing can
+        // likewise define functions/aliases or override builtins.
+        command.contains("()")
+            || command.contains("PATH=")
+            || contains_ascii_word_ci(command, "alias")
+            || contains_ascii_word_ci(command, "function")
+            || contains_ascii_word_ci(command, "eval")
+            || contains_ascii_word_ci(command, "source")
+            || contains_ascii_word_ci(command, "enable")
+            || contains_ascii_word_ci(command, "shopt")
+            || command.starts_with(". ")
+            || command.starts_with(".\t")
+            || command.contains("; . ")
+            || command.contains("; .\t")
+            || command.contains("\n. ")
+            || command.contains("\n.\t")
+            || command.contains("&& . ")
+            || command.contains("|| . ")
+    };
+    match dialect {
+        ShellDialect::Cmd => cmd_rebind(),
+        ShellDialect::PowerShell => ps_rebind(),
+        ShellDialect::Posix => posix_rebind(),
+        ShellDialect::Unknown => posix_rebind() || ps_rebind() || cmd_rebind(),
+    }
+}
+
+/// Whether splitting an oversized command across multiple scan windows could
+/// sever a variable assignment in an earlier window from an expansion in a
+/// later window (e.g., `d=mkfs.ext4\n# <70 KiB>\n$d /dev/sda`).
+fn oversized_windows_may_sever_binding(windows: &[String]) -> bool {
+    if windows.len() <= 1 {
+        return false;
+    }
+    let mut saw_assignment_in_earlier_window = false;
+    for window in windows {
+        if saw_assignment_in_earlier_window && window.contains(['$', '%', '!']) {
+            return true;
         }
-        ShellDialect::Posix | ShellDialect::Unknown => {
-            command.contains("alias")
-                || command.contains("function")
-                || command.contains("echo(")
-                || command.contains("echo (")
-                || command.contains("PATH=")
+        if window.contains('=
```

**File**: `src/normalize.rs` (modified, +566/-38)
```diff
@@ -169,7 +169,10 @@ pub fn strip_wrapper_prefixes(command: &str) -> NormalizedCommand<'_> {
         {
             modprobe_env.posixly_correct = true;
         }
-        if (modprobe_env.modprobe_options.is_some() || modprobe_env.posixly_correct)
+        if (modprobe_env.modprobe_options.is_some()
+            || modprobe_env.pre_sudo_modprobe_options.is_some()
+            || modprobe_env.posixly_correct
+            || modprobe_env.pre_sudo_posixly_correct)
             && let Some(folded) = fold_modprobe_env_into_command(&current, &modprobe_env)
         {
             current = folded;
@@ -201,8 +204,19 @@ pub fn strip_wrapper_prefixes(command: &str) -> NormalizedCommand<'_> {
 ///   module name rather than a dry-run flag.
 #[derive(Default)]
 struct ModprobeEnvState {
+    /// `MODPROBE_OPTIONS` unconditionally visible to `modprobe` (either set
+    /// without crossing a non-preserving `sudo`, or preserved across `sudo`
+    /// via `-E` / `--preserve-env`).
     modprobe_options: Option<String>,
+    /// `MODPROBE_OPTIONS` set before a `sudo` that does NOT explicitly
+    /// preserve it: dropped under default `env_reset`, kept under `env_keep`
+    /// / `!env_reset`. Evaluated deny-wins over `{env_reset, env_keep}`.
+    pre_sudo_modprobe_options: Option<String>,
+    /// `POSIXLY_CORRECT` unconditionally visible to `modprobe`.
     posixly_correct: bool,
+    /// `POSIXLY_CORRECT` set before a `sudo` that does NOT explicitly preserve
+    /// it. Evaluated deny-wins over `{env_reset, env_keep}`.
+    pre_sudo_posixly_correct: bool,
 }
 
 fn record_modprobe_assignment(state: &mut ModprobeEnvState, raw: &str) {
@@ -214,8 +228,17 @@ fn record_modprobe_assignment(state: &mut ModprobeEnvState, raw: &str) {
         return;
     };
     match name {
-        "MODPROBE_OPTIONS" => state.modprobe_options = Some(value.to_string()),
-        "POSIXLY_CORRECT" => state.posixly_correct = true,
+        "MODPROBE_OPTIONS" => {
+            state.modprobe_options = Some(value.to_string());
+            // An assignment after `sudo` overrides any pre-sudo value in both
+            // `env_reset` and `env_keep` worlds (or sudo rejects SETENV and
+            // does not run modprobe at all).
+            state.pre_sudo_modprobe_options = None;
+        }
+        "POSIXLY_CORRECT" => {
+            state.posixly_correct = true;
+            state.pre_sudo_posixly_correct = false;
+        }
         _ => {}
     }
 }
@@ -226,16 +249,118 @@ fn unset_modprobe_env_name(state: &mut ModprobeEnvState, raw_name: &str) {
         .decode(raw_name.trim(), ShellTokenRole::Syntax)
         .unwrap_or_else(|| Cow::Borrowed(raw_name.trim()));
     match decoded.as_ref() {
-        "MODPROBE_OPTIONS" => state.modprobe_options = None,
-        "POSIXLY_CORRECT" => state.posixly_correct = false,
+        "MODPROBE_OPTIONS" => {
+            state.modprobe_options = None;
+            state.pre_sudo_modprobe_options = None;
+        }
+        "POSIXLY_CORRECT" => {
+            state.posixly_correct = false;
+            state.pre_sudo_posixly_correct = false;
+        }
         _ => {}
     }
 }
 
+/// Whether a stripped `sudo ...` prefix explicitly preserves `var_name`
+/// (via `-E`, `--preserve-env`, or `--preserve-env=...,VAR,...`).
+fn sudo_preserves_env_var(stripped_sudo: &str, var_name: &str) -> bool {
+    const ARG_FLAGS: &[char] = &['u', 'g', 'h', 'p', 'C', 'r', 'U', 'D', 't', 'a', 'T'];
+    const ARG_LONG_OPTIONS: &[&str] = &[
+        "--user",
+        "--group",
+        "--host",
+        "--prompt",
+        "--close-from",
+        "--role",
+        "--other-user",
+        "--chdir",
+        "--type",
+        "--command-timeout",
+    ];
+    let tokens = tokenize_for_normalization(stripped_sudo);
+    let words: Vec<&str> = tokens
+        .iter()
+        .filter(|token| token.kind == NormalizeTokenKind::Word)
+        .filter_map(|token| token.text(stripped_sudo))
+        .collect();
+    let mut decoder = ShellTokenDecoder::new(ShellDialect::Posix);
+    let mut index = 1usize; // skip leading `sudo`
+    while index < words.len() {
+        let word = words[index];
+        if word == "--" {
+            break;
+        }
+        if !word.starts_with('-') || word.len() == 1 {
+            break;
+        }
+        if word.starts_with("--") {
+            let (name, value_opt) = word
+                .find('=')
+                .map_or((word, None), |eq| (&word[..eq], Some(&word[eq + 1..])));
+            if name == "--preserve-env" {
+                match value_opt {
+                    None => return true,
+                    Some(raw_list) => {
+                        let decoded = decoder
+                            .decode(raw_list, ShellTokenRole::Syntax)
+                            .unwrap_or(Cow::Borrowed(raw_list));
+                        if decoded.split(',').any(|entry| entry.trim() == var_name) {
+                            return true;
+                        }
+       
```

**File**: `src/packs/core/git.rs` (modified, +96/-11)
```diff
@@ -1683,16 +1683,76 @@ fn git_dynamic_fragments(decoded: &str, dialect: ShellDialect) -> Vec<String> {
     let chars: Vec<char> = decoded.chars().collect();
     let mut index = 0usize;
     let mut dynamic = false;
+    let mut posix_single = false;
+    let mut posix_double = false;
     while index < chars.len() {
+        if matches!(dialect, ShellDialect::Posix | ShellDialect::Unknown) {
+            let ch = chars[index];
+            if posix_single {
+                if ch == '\'' {
+                    posix_single = false;
+                } else {
+                    fragments.last_mut().expect("seeded").push(ch);
+                }
+                index += 1;
+                continue;
+            }
+            if posix_double {
+                match ch {
+                    '"' => {
+                        posix_double = false;
+                        index += 1;
+                        continue;
+                    }
+                    '\\' => {
+                        if let Some(&next) = chars.get(index + 1) {
+                            if matches!(next, '$' | '`' | '"' | '\\') {
+                                fragments.last_mut().expect("seeded").push(next);
+                            } else if next != '\n' {
+                                fragments.last_mut().expect("seeded").push('\\');
+                                fragments.last_mut().expect("seeded").push(next);
+                            }
+                            index += 2;
+                            continue;
+                        }
+                    }
+                    _ => {}
+                }
+            } else {
+                match ch {
+                    '\'' => {
+                        posix_single = true;
+                        index += 1;
+                        continue;
+                    }
+                    '"' => {
+                        posix_double = true;
+                        index += 1;
+                        continue;
+                    }
+                    '\\' => {
+                        if let Some(&next) = chars.get(index + 1) {
+                            if next != '\n' {
+                                fragments.last_mut().expect("seeded").push(next);
+                            }
+                            index += 2;
+                            continue;
+                        }
+                    }
+                    _ => {}
+                }
+            }
+        }
         let starts_dynamic = match dialect {
             ShellDialect::Posix | ShellDialect::Unknown => match chars[index] {
-                '$' | '`' | '*' | '?' => true,
+                '$' | '`' => true,
+                '*' | '?' if !posix_double => true,
                 // A `[`/`{` with no later closing delimiter in the word is
                 // literal (the test builtin / brace reserved word) and must
                 // contribute a literal fragment rather than a wildcard. Brace
                 // groups additionally need a `,`/`..` inside to expand.
-                '[' => chars[index + 1..].contains(&']'),
-                '{' => {
+                '[' if !posix_double => chars[index + 1..].contains(&']'),
+                '{' if !posix_double => {
                     let remainder = &chars[index + 1..];
                     remainder
                         .iter()
@@ -1969,7 +2029,11 @@ fn powershell_call_expression(command: &str) -> bool {
     command
         .trim_start()
         .strip_prefix('&')
-        .filter(|rest| rest.chars().next().is_some_and(char::is_whitespace))
+        .filter(|rest| {
+            rest.chars()
+                .next()
+                .is_some_and(|ch| ch.is_whitespace() || matches!(ch, '(' | '$' | '@'))
+        })
         .map(str::trim_start)
         .is_some_and(|rest| {
             rest.starts_with('(') || rest.starts_with("$(") || rest.starts_with("@(")
@@ -1999,7 +2063,11 @@ fn powershell_dynamic_call_operator(command: &str) -> bool {
     command
         .trim_start()
         .strip_prefix('&')
-        .filter(|rest| rest.chars().next().is_some_and(char::is_whitespace))
+        .filter(|rest| {
+            rest.chars()
+                .next()
+                .is_some_and(|ch| ch.is_whitespace() || matches!(ch, '(' | '$' | '@'))
+        })
         .map(str::trim_start)
         .is_some_and(|rest| {
             rest.starts_with('$') || rest.starts_with("@(") || rest.starts_with('(')
@@ -2289,7 +2357,11 @@ fn powershell_call_expression_parts(command: &str) -> Option<(&str, &str)> {
     let rest = command
         .trim_start()
         .strip_prefix('&')
-        .filter(|rest| rest.chars().next().is_some_and(char::is_whitespace))?
+        .filter(|rest| {
+            rest.chars()
+                .next()
+                .is_some_and(|ch| ch.is_whitespace() || matches!(ch, '(' | '$' | '@'))
+        })?
         .trim_start();
     let open = if rest.starts_with("$(") || res
```

**File**: `tests/repro_567_569_quoted_interpreter_source.rs` (modified, +113/-0)
```diff
@@ -473,3 +473,116 @@ fn issue_567_external_pack_still_judges_every_executed_shell_route() {
         }
     }
 }
+
+#[test]
+fn bd_oxtg_tight_heredoc_budget_reports_incomplete_analysis_not_literal_rule() {
+    let heredoc_data = "python3 - <<'EOF'\nprint('x|git reset --hard')\nEOF";
+    let exterior = "rm -rf / && python3 - <<'EOF'\nprint('x|git reset --hard')\nEOF";
+
+    let run_with_heredoc_budget = |source: &str, route: Route, heredoc_ms: &str| -> Verdict {
+        let temp = tempfile::tempdir().expect("isolated working directory");
+        let home = temp.path().join("home");
+        std::fs::create_dir(&home).expect("isolated home");
+        let mut command = Command::new(env!("CARGO_BIN_EXE_dcg"));
+        let hook_input = serde_json::json!({
+            "hook_event_name": "PreToolUse",
+            "tool_name": "Bash",
+            "tool_input": {"command": source},
+        })
+        .to_string();
+        let input = match route {
+            Route::Hook => {
+                command.args(["--agent", "claude-code"]);
+                hook_input
+            }
+            Route::Batch => {
+                command.args(["hook", "--batch"]);
+                hook_input
+            }
+            Route::CliPosix => {
+                command.args(["test", "--stdin", "--dialect", "posix", "--format", "json"]);
+                source.to_string()
+            }
+        };
+        command
+            .env_clear()
+            .env("HOME", &home)
+            .env("USERPROFILE", &home)
+            .env("XDG_CONFIG_HOME", home.join(".config"))
+            .env("DCG_ALLOWLIST_SYSTEM_PATH", "")
+            .env("DCG_NO_SELF_HEAL", "1")
+            .env("DCG_SELF_HEAL_HOOK", "0")
+            .env("DCG_HISTORY_DISABLED", "1")
+            .env("DCG_HOOK_TIMEOUT_MS", "5000")
+            .env("DCG_AST_TIMEOUT_MS", "5000")
+            .env("DCG_HEREDOC_TIMEOUT_MS", heredoc_ms)
+            .current_dir(temp.path());
+        let mut child = command
+            .stdin(Stdio::piped())
+            .stdout(Stdio::piped())
+            .stderr(Stdio::piped())
+            .spawn()
+            .expect("spawn classifier");
+        child
+            .stdin
+            .take()
+            .expect("piped stdin")
+            .write_all(input.as_bytes())
+            .expect("write input");
+        let output = child.wait_with_output().expect("wait");
+        let stdout = String::from_utf8_lossy(&output.stdout);
+        let stderr = String::from_utf8_lossy(&output.stderr);
+        if route == Route::Hook && stdout.trim().is_empty() {
+            assert!(output.status.success(), "{source:?}: {stderr}");
+            return Verdict {
+                decision: "allow".to_string(),
+                rule: None,
+            };
+        }
+        let value: serde_json::Value = serde_json::from_str(stdout.trim())
+            .unwrap_or_else(|e| panic!("{route:?}: {e}; stdout={stdout}; stderr={stderr}"));
+        if route == Route::Hook {
+            let out = &value["hookSpecificOutput"];
+            let rule = out["ruleId"].as_str().map(str::to_string);
+            let decision = match out["permissionDecision"].as_str() {
+                Some("deny") => "deny",
+                Some("ask") if rule.is_none() => "indeterminate",
+                other => panic!("unexpected hook decision {other:?}: {value}"),
+            };
+            return Verdict {
+                decision: decision.to_string(),
+                rule,
+            };
+        }
+        Verdict {
+            decision: value["decision"].as_str().unwrap_or("").to_string(),
+            rule: value["rule_id"].as_str().map(str::to_string),
+        }
+    };
+
+    for route in ROUTES {
+        // Forced hot-path heredoc timeout (0 ms) triggers bounded fallback:
+        // must report heredoc.shell:incomplete-analysis, never core.git:reset-hard.
+        let degraded = run_with_heredoc_budget(heredoc_data, route, "0");
+        assert_eq!(
+            (degraded.decision.as_str(), degraded.rule.as_deref()),
+            ("deny", Some("heredoc.shell:incomplete-analysis")),
+            "{route:?} degraded data heredoc: {degraded:?}"
+        );
+
+        // Exterior destructive command retains its real pack rule even at 0 ms.
+        let ext = run_with_heredoc_budget(exterior, route, "0");
+        assert_eq!(
+            (ext.decision.as_str(), ext.rule.as_deref()),
+            ("deny", Some("core.filesystem:rm-rf-root-home")),
+            "{route:?} exterior command: {ext:?}"
+        );
+
+        // Normal budget allows the data heredoc.
+        let normal = run_with_heredoc_budget(heredoc_data, route, "5000");
+        assert_eq!(
+            normal.decision, "allow",
+            "{route:?} normal budget: {normal:?}"
+        );
+    }
+}
```

**File**: `tests/repro_ewf3_cross_dialect_gaps.rs` (added, +254/-0)
```diff
@@ -0,0 +1,254 @@
+//! bd-ps-cross-dialect-gaps-ewf3: real-binary CLI + PreToolUse hook tests for:
+//!   (a) PowerShell call expressions (`& ('gi'+'t')`, `& ('{0}{1}' -f 'gi','t')`, `& ($c)`) in `unknown` & `powershell`
+//!   (b) `cmd` caret+percent mixes (`rm^%x% -rf /`, `r^m%x% -rf /`, `g^i%x%t reset --hard`)
+//!   (c) PowerShell here-strings piped to interpreters (`python3`, `py`, `iex`, `pwsh`) in `powershell` & `unknown`
+//!   (d) `cmd` `%VAR%` and `!VAR!` names containing whitespace
+
+use std::io::Write;
+use std::process::{Command, Stdio};
+
+fn dcg_test_verdict(command: &str, dialect: &str) -> serde_json::Value {
+    let scratch = tempfile::tempdir().expect("scratch dir");
+    let home = scratch.path().join("home");
+    std::fs::create_dir(&home).expect("home dir");
+
+    let mut child = Command::new(env!("CARGO_BIN_EXE_dcg"))
+        .args(["test", "--stdin", "--dialect", dialect, "--format", "json"])
+        .env_clear()
+        .env("HOME", &home)
+        .env("USERPROFILE", &home)
+        .env("XDG_CONFIG_HOME", home.join(".config"))
+        .env("DCG_ALLOWLIST_SYSTEM_PATH", "")
+        .env("DCG_NO_SELF_HEAL", "1")
+        .env("DCG_SELF_HEAL_HOOK", "0")
+        .env("DCG_HISTORY_DISABLED", "1")
+        .env("DCG_HOOK_TIMEOUT_MS", "5000")
+        .env("DCG_AST_TIMEOUT_MS", "5000")
+        .env("DCG_HEREDOC_TIMEOUT_MS", "5000")
+        .current_dir(scratch.path())
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .spawn()
+        .expect("spawn dcg test");
+    child
+        .stdin
+        .take()
+        .expect("stdin")
+        .write_all(command.as_bytes())
+        .expect("write command");
+    let output = child.wait_with_output().expect("wait dcg test");
+    let stdout = String::from_utf8_lossy(&output.stdout);
+    let stderr = String::from_utf8_lossy(&output.stderr);
+    serde_json::from_str(stdout.trim()).unwrap_or_else(|err| {
+        panic!("invalid JSON for {command:?} ({dialect}): {err}\nstdout={stdout}\nstderr={stderr}")
+    })
+}
+
+fn hook_decision(command: &str, tool_name: &str) -> (String, String) {
+    let scratch = tempfile::tempdir().expect("scratch dir");
+    let home = scratch.path().join("home");
+    std::fs::create_dir(&home).expect("home dir");
+    let payload = serde_json::json!({
+        "hook_event_name": "PreToolUse",
+        "tool_name": tool_name,
+        "tool_input": { "command": command }
+    })
+    .to_string();
+
+    let mut child = Command::new(env!("CARGO_BIN_EXE_dcg"))
+        .env_clear()
+        .env("HOME", &home)
+        .env("USERPROFILE", &home)
+        .env("XDG_CONFIG_HOME", home.join(".config"))
+        .env("DCG_ALLOWLIST_SYSTEM_PATH", "")
+        .env("DCG_NO_SELF_HEAL", "1")
+        .env("DCG_SELF_HEAL_HOOK", "0")
+        .env("DCG_HISTORY_DISABLED", "1")
+        .env("DCG_HOOK_TIMEOUT_MS", "5000")
+        .env("DCG_AST_TIMEOUT_MS", "5000")
+        .env("DCG_HEREDOC_TIMEOUT_MS", "5000")
+        .current_dir(scratch.path())
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .spawn()
+        .expect("spawn dcg hook");
+    child
+        .stdin
+        .take()
+        .expect("stdin")
+        .write_all(payload.as_bytes())
+        .expect("write hook payload");
+    let output = child.wait_with_output().expect("wait dcg hook");
+    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
+    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
+    if stdout.is_empty() {
+        assert!(output.status.success(), "{command:?}: {stderr}");
+        return ("allow".to_string(), stdout);
+    }
+    let value: serde_json::Value = serde_json::from_str(&stdout)
+        .unwrap_or_else(|e| panic!("invalid hook JSON for {command:?}: {e}; stdout={stdout}"));
+    let decision = value["hookSpecificOutput"]["permissionDecision"]
+        .as_str()
+        .unwrap_or("unknown")
+        .to_string();
+    (decision, stdout)
+}
+
+#[test]
+fn ewf3_powershell_call_expressions_in_unknown_and_powershell() {
+    for command in [
+        "& ('gi'+'t') reset --hard",
+        "&('gi'+'t') reset --hard",
+        "& ('{0}{1}' -f 'gi','t') reset --hard",
+        "& ([string]'gi'+'t') reset --hard",
+        "& ($c) reset --hard",
+        r#"echo "x\"; & ('gi'+'t') reset --hard"#,
+    ] {
+        for dialect in ["powershell", "unknown"] {
+            let verdict = dcg_test_verdict(command, dialect);
+            assert_eq!(
+                verdict["decision"].as_str(),
+                Some("deny"),
+                "{command:?} ({dialect}): {verdict}"
+            );
+        }
+        let (decision, stdout) = hook_decision(command, "PowerShell");
+        assert_eq!(
+            decision, "deny",
+            "PowerShell hook must deny {command:?}: {stdout}"
+        );
+        let (decision_u, stdout_u) = hook_decision(command, "shell");
+        assert
```

**File**: `tests/repro_fd5q_binding_model_variants.rs` (added, +257/-0)
```diff
@@ -0,0 +1,257 @@
+//! bd-binding-model-variants-fd5q: real-binary CLI + PreToolUse hook tests for
+//! POSIX executable binding model improvements:
+//!   (a) per-segment separator handling (`||`, `|`, `&&`, `&`)
+//!   (b) stepping over neutral commands (`echo`, `:`, `[ ]`, `[[ ]]`, `test`, `true`, `X=1 true`)
+//!   (c) `export` / `readonly` / `declare` bindings and use-site wrappers (`sudo`, `env`, `time`, `exec`, `command`, `nohup`, `nice`)
+//!   (d) unified quoted `"$VAR"` handling between `posix` and `unknown`
+//!   (e) bounded >64 assignment handling without blanket fail-closed on later unrelated vars
+
+use std::io::Write;
+use std::process::{Command, Stdio};
+
+fn dcg_test_verdict(command: &str, dialect: &str) -> serde_json::Value {
+    let scratch = tempfile::tempdir().expect("scratch dir");
+    let home = scratch.path().join("home");
+    std::fs::create_dir(&home).expect("home dir");
+
+    let mut child = Command::new(env!("CARGO_BIN_EXE_dcg"))
+        .args(["test", "--stdin", "--dialect", dialect, "--format", "json"])
+        .env_clear()
+        .env("HOME", &home)
+        .env("USERPROFILE", &home)
+        .env("XDG_CONFIG_HOME", home.join(".config"))
+        .env("DCG_ALLOWLIST_SYSTEM_PATH", "")
+        .env("DCG_NO_SELF_HEAL", "1")
+        .env("DCG_SELF_HEAL_HOOK", "0")
+        .env("DCG_HISTORY_DISABLED", "1")
+        .env("DCG_HOOK_TIMEOUT_MS", "5000")
+        .env("DCG_AST_TIMEOUT_MS", "5000")
+        .env("DCG_HEREDOC_TIMEOUT_MS", "5000")
+        .current_dir(scratch.path())
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .spawn()
+        .expect("spawn dcg test");
+    child
+        .stdin
+        .take()
+        .expect("stdin")
+        .write_all(command.as_bytes())
+        .expect("write command");
+    let output = child.wait_with_output().expect("wait dcg test");
+    let stdout = String::from_utf8_lossy(&output.stdout);
+    let stderr = String::from_utf8_lossy(&output.stderr);
+    serde_json::from_str(stdout.trim()).unwrap_or_else(|err| {
+        panic!("invalid JSON for {command:?} ({dialect}): {err}\nstdout={stdout}\nstderr={stderr}")
+    })
+}
+
+fn hook_decision(command: &str, tool_name: &str) -> (String, String) {
+    let scratch = tempfile::tempdir().expect("scratch dir");
+    let home = scratch.path().join("home");
+    std::fs::create_dir(&home).expect("home dir");
+    let payload = serde_json::json!({
+        "hook_event_name": "PreToolUse",
+        "tool_name": tool_name,
+        "tool_input": { "command": command }
+    })
+    .to_string();
+
+    let mut child = Command::new(env!("CARGO_BIN_EXE_dcg"))
+        .env_clear()
+        .env("HOME", &home)
+        .env("USERPROFILE", &home)
+        .env("XDG_CONFIG_HOME", home.join(".config"))
+        .env("DCG_ALLOWLIST_SYSTEM_PATH", "")
+        .env("DCG_NO_SELF_HEAL", "1")
+        .env("DCG_SELF_HEAL_HOOK", "0")
+        .env("DCG_HISTORY_DISABLED", "1")
+        .env("DCG_HOOK_TIMEOUT_MS", "5000")
+        .env("DCG_AST_TIMEOUT_MS", "5000")
+        .env("DCG_HEREDOC_TIMEOUT_MS", "5000")
+        .current_dir(scratch.path())
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .spawn()
+        .expect("spawn dcg hook");
+    child
+        .stdin
+        .take()
+        .expect("stdin")
+        .write_all(payload.as_bytes())
+        .expect("write hook payload");
+    let output = child.wait_with_output().expect("wait dcg hook");
+    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
+    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
+    if stdout.is_empty() {
+        assert!(output.status.success(), "{command:?}: {stderr}");
+        return ("allow".to_string(), stdout);
+    }
+    let value: serde_json::Value = serde_json::from_str(&stdout)
+        .unwrap_or_else(|e| panic!("invalid hook JSON for {command:?}: {e}; stdout={stdout}"));
+    let decision = value["hookSpecificOutput"]["permissionDecision"]
+        .as_str()
+        .unwrap_or("unknown")
+        .to_string();
+    (decision, stdout)
+}
+
+#[test]
+fn fd5q_separators_neutral_commands_declarations_and_wrappers_deny_destructive() {
+    let destructive = [
+        // (a) Per-segment separator handling (`||`, `|`, `&&`, `&`)
+        "d=mkfs.ext4; false || $d /dev/sda",
+        "false || d=git; $d reset --hard",
+        "d=mkfs.ext4; echo x | $d /dev/sda",
+        "d=mkfs.ext4; true & $d /dev/sda",
+        // (b) Stepping over neutral commands between binding and use
+        "d=mkfs.ext4; echo checking; $d /dev/sda",
+        "d=mkfs.ext4; :; $d /dev/sda",
+        "d=mkfs.ext4; [ -d /tmp ]; $d /dev/sda",
+        "d=mkfs.ext4; [[ -d /tmp ]]; $d /dev/sda",
+        "d=mkfs.ext4; test -d /tmp && $d /dev/sda",
+        "d=mkfs.ext4; true; $d /dev/sda",
+        "d=mkfs.ext4; X=1 true; $d /dev/sda",
+        // (c) export / readonly / declare bindi
```

---

### Incident Patch 2: `7a90b02a` (2026-11-24)
**Commit Message**: fix(hook): mask inert oversized data heredocs and preserve lexical window coverage [skip ci]

Closes bd-oversized-data-heredoc-window-fp-jj7f, bd-oversized-window-coverage-o36a, and bd-oversized-code-heredoc-receivers-azu4.

- Mask AST-proven inert quoted data-heredoc bodies (length-preserving, preserving newlines and all exterior bytes/headers/terminators) before dialect refinement and window slicing in try_deny_unparseable_payload, failing closed (zero masking) on unverified receivers, pipes, substitutions, overrides, unterminated/unquoted heredocs, device sinks, or >4 MiB cap.
- Advance streaming heredoc compaction past compacted bodies so interior << tokens in large source files (e.g. Rust/C++ shifts) do not exhaust the 256-operator bound while preserving exterior operator limits.
- Replace blind stride-only windowing on the oversized salvage path with dialect-aware (Cmd/PowerShell/POSIX) lexical statement-boundary windowing and quote-parity prefix restoration, keeping single commands and pipelines up to max_command_bytes whole and reporting incomplete coverage (fail-closed indeterminate) on non-inert >max_command_bytes statements, nesting overflow, cap exhaustion, and zero/tin

**File**: `.beads/issues.jsonl` (modified, +3/-3)
```diff
@@ -101,9 +101,9 @@
 {"id":"bd-migo","title":"cleanup(core.filesystem): rm regexes are unanchored at the pack layer","description":"core.filesystem's rm rules use a bare `rm\\s+...` with no argv0 anchor, so at the PACK layer they match inside a longer word: pack.check(\"charm -r -f build\") and pack.check(\"swarm -r -f nodes\") both return Some.\n\nNOT a live false positive: end to end those commands are correctly ALLOWED, because the evaluator resolves argv0 before a denial stands. This is defense-in-depth only — it bites any caller that uses Pack::check directly without the evaluator's gating.\n\nSame class as the bug found in database.bigquery during the 2026-08-10 review, where `\\brm\\b` matched `git rm old_file.txt` at the pack layer; that was fixed by anchoring each CLI regex on the executable.\n\nFIX SHAPE (mirror bigquery): prefix each rm rule with\n  (?:^|[\\s;&|(])(?:[^\\s;&|]*[/\\\\])?rm\\s+\nwhich keeps every real invocation — plain `rm`, `/bin/rm`, `./rm`, and subcommand forms `git rm` / `bq rm` (space-preceded) — while excluding `charm`/`swarm`. It is a strict narrowing, no coverage loss.\n\nRISK: core.filesystem is the always-on tier-1 pack with many rm rules (rm-rf-general, rm-rf-root-home, rm-r-f-separate, rm-recursive-*, ...). Every rule must be changed together and validated against the full corpus; a partial edit would be worse than none. Deliberately NOT bundled into bd-pwvp, which was about attribution rather than anchoring.\n\nFound 2026-08-11 while working bd-pwvp: a test asserting is_none() at the pack layer failed and exposed it.","status":"closed","priority":3,"issue_type":"task","created_at":"2026-08-11T04:06:50.572834Z","created_by":"jemanuel","updated_at":"2026-09-22T18:35:18.830766799Z","closed_at":"2026-09-22T18:35:18.828606892Z","close_reason":"Fixed in 3813c06: all six rm rules (root-home x3, general x3) prefixed with (?:^|[^A-Za-z0-9_.-]); strict narrowing. Test rm_regexes_do_not_match_inside_a_longer_word (charm/swarm/farm allowed at Pack::check; /bin/rm and chained rm still match).","source_repo":"destructive_command_guard","compaction_level":0,"original_size":0}
 {"id":"bd-modprobe-env-option-bypass-fhep","title":"modprobe MODPROBE_OPTIONS/POSIXLY_CORRECT env-option removal bypasses the stripped-prefix layer","description":"MODPROBE_OPTIONS=-r modprobe nvidia (and POSIXLY_CORRECT=1 modprobe -r nvidia -n) remove a module, but the evaluator strips a leading environment assignment as a wrapper prefix before any pack sees the command (confirmed: FOO=bar modprobe -r nvidia denies, MODPROBE_OPTIONS=-r modprobe nvidia allows). So a system.services regex cannot see the variable. A real fix must act at the env-assignment layer: when stripping a leading NAME=value, recognize option-injecting vars (MODPROBE_OPTIONS, and POSIXLY_CORRECT which stops getopt permutation) and fold their effect into the stripped command, or decline to strip them for executables whose parsing they change. Exotic; reviewer F4 medium confidence. NOTE: an earlier attempt put MODPROBE_OPTIONS/POSIXLY branches in the modprobe_removal regex; that was dead in production (pack.check saw it, the hook did not) and was reverted.","status":"open","priority":3,"issue_type":"bug","created_at":"2026-11-03T14:01:44.094415Z","created_by":"jemanuel","updated_at":"2026-11-03T14:01:44.094415Z","source_repo":"destructive_command_guard","compaction_level":0,"original_size":0}
 {"id":"bd-nxn1","title":"Fork-bomb rule exhausts its regex work limit on long one-shape bodies","description":"The core.filesystem fork-bomb rule can use up its regex work limit on a long body that holds no function definition at all. The check is then incomplete, so the command comes back `indeterminate`: a client with a review prompt asks, and any other client blocks.\n\nIts pattern, `(?<![A-Za-z0-9_:])((?>[A-Za-z0-9_:]+))\\s*\\(\\s*\\)\\s*\\{\\s*\\1\\s*\\|\\s*\\1\\s*&\\s*;?\\s*\\}\\s*;\\s*\\1`, needs fancy-regex for the back-reference, and the search is bounded at 100,000 backtracking steps.\n\nRow: a quoted `perl - <<'EOF'` heredoc whose body is 7,875 lines of `\"nope\";` (63 KB). 0.16.0 asks after about 370 ms (`phase: regex_match, incomplete: find_from`); the dcg_perf log names this pattern. At 52 KB the same body allows in about 340 ms, and `dcg explain` gives allow at both sizes. 0.15.3 asks on this body from about 40 KB, when its 1,000 ms clock runs out.\n\nWhat changed since 0.15.3:\n- The limit did not. `BACKTRACK_LIMIT` is 100,000 in both, with the same fancy-regex version.\n- The handling did (553263f1). 0.15.3 counted an exhausted search as no match, which failed open. 0.16.0 records it as incomplete analysis.\n- The pattern did (1475a05f, #555). The name group now starts at a word start and is atomic, so long programs full of calls no longer exhaust it. A long body of one repeated shape still does.\n\nFix idea: check the text first with a linear superset of the pattern on the regex crate, the same pattern without the lookbehind, the atom
```

**File**: `src/heredoc.rs` (modified, +494/-136)
```diff
@@ -8749,168 +8749,347 @@ pub(crate) fn first_heredoc_target_command(command: &str) -> Option<String> {
 /// text or arithmetic is not exempt when its complete proof exceeds them.
 #[must_use]
 pub fn oversized_heredoc_requires_analysis(command: &str) -> bool {
-    const MAX_HEREDOC_OPERATORS: usize = 256;
-    if command.len() > MAX_OVERSIZED_HEREDOC_SOURCE_BYTES {
-        return true;
+    analyze_oversized_heredocs(command).requires_analysis
+}
+
+/// Analyze an oversized command's heredocs and mask AST-proven inert quoted data bodies.
+///
+/// When the whole command is AST-proven to consist exclusively of inert data
+/// commands with complete quoted-delimiter stdin heredocs, returns a strictly
+/// length-preserving view with those proven body ranges blanked (preserving
+/// newlines and all exterior bytes, headers, terminators, and trailing commands).
+///
+/// Fails closed: if the command exceeds size/work bounds, is unterminated, or
+/// contains any unproven receiver, pipe, substitution, override, or non-data
+/// command, returns `(true, Cow::Borrowed(command))` without masking any byte
+/// (bd-oversized-data-heredoc-window-fp-jj7f, bd-oversized-code-heredoc-receivers-azu4).
+#[must_use]
+pub fn analyze_and_mask_oversized_heredocs(command: &str) -> (bool, Cow<'_, str>) {
+    let analysis = analyze_oversized_heredocs(command);
+    if analysis.requires_analysis || analysis.inert_body_ranges.is_empty() {
+        return (analysis.requires_analysis, Cow::Borrowed(command));
+    }
+    if !analysis.inert_body_ranges.iter().all(|range| {
+        range.start <= range.end
+            && range.end <= command.len()
+            && command.is_char_boundary(range.start)
+            && command.is_char_boundary(range.end)
+    }) {
+        return (true, Cow::Borrowed(command));
     }
-    let bytes = command.as_bytes();
-    let mut search = 0usize;
-    let mut operators = Vec::new();
+    let masked = blank_ranges(command, &analysis.inert_body_ranges);
+    debug_assert_eq!(masked.len(), command.len());
+    (false, Cow::Owned(masked))
+}
+
+#[derive(Debug, PartialEq, Eq)]
+struct OversizedHeredocAnalysis {
+    requires_analysis: bool,
+    inert_body_ranges: Vec<Range<usize>>,
+}
+
+const MAX_OVERSIZED_HEREDOC_OPERATORS: usize = 256;
+
+fn next_non_herestring_heredoc_operator(bytes: &[u8], mut search: usize) -> Option<usize> {
     while let Some(relative) = memchr::memmem::find(&bytes[search..], b"<<") {
         let operator = search + relative;
         search = operator + 2;
         if bytes.get(operator + 2) == Some(&b'<') || (operator > 0 && bytes[operator - 1] == b'<') {
             continue;
         }
-        if operators.len() == MAX_HEREDOC_OPERATORS {
-            return true;
-        }
-        operators.push(operator);
+        return Some(operator);
     }
-    if operators.is_empty() {
-        return false;
+    None
+}
+
+fn analyze_oversized_heredocs(command: &str) -> OversizedHeredocAnalysis {
+    if command.len() > MAX_OVERSIZED_HEREDOC_SOURCE_BYTES {
+        return OversizedHeredocAnalysis {
+            requires_analysis: true,
+            inert_body_ranges: Vec::new(),
+        };
     }
+    let bytes = command.as_bytes();
+    let Some(first_operator) = next_non_herestring_heredoc_operator(bytes, 0) else {
+        return OversizedHeredocAnalysis {
+            requires_analysis: false,
+            inert_body_ranges: Vec::new(),
+        };
+    };
     // With no elisions, the complete tree can prove that a quoted `<<` or
     // numeric arithmetic is ordinary argv data. No outer heredoc nodes alone
     // would be insufficient: `bash -c '... <<EOF ...'` is an executable carrier.
+    // Only take the uncompacted path when the raw `<<` count is also within
+    // the operator bound; a large quoted file body carrying many literal `<<`
+    // tokens (e.g. C++/Rust shifts) falls through to streaming compaction,
+    // which jumps over compacted bodies while still bounding exterior `<<`.
     if command.len() <= MAX_OVERSIZED_HEREDOC_VIEW_BYTES {
-        return !oversized_heredoc_view_is_inert(command, &[]);
+        let mut count = 1usize;
+        let mut search = first_operator + 2;
+        while count <= MAX_OVERSIZED_HEREDOC_OPERATORS {
+            let Some(next) = next_non_herestring_heredoc_operator(bytes, search) else {
+                break;
+            };
+            count += 1;
+            search = next + 2;
+        }
+        if count <= MAX_OVERSIZED_HEREDOC_OPERATORS {
+            return match proven_inert_heredoc_bodies(command, &[]) {
+                Some(inert_body_ranges) => OversizedHeredocAnalysis {
+                    requires_analysis: false,
+                    inert_body_ranges,
+                },
+                None => OversizedHeredocAnalysis {
+                    requires_analysis: true,
+                    inert_body_ranges: Vec::new(),
+                },
+            };
+        }
     }
-    let Some((view, elisio
```

**File**: `src/main.rs` (modified, +1512/-14)
```diff
@@ -667,6 +667,7 @@ const OVERSIZED_SCAN_MAX_WINDOWS: usize = 128;
 /// dropped. Windows always start and end on char boundaries. Returns whether
 /// the windows cover every byte of the command: a zero limit, exhausted window
 /// cap, or a code point wider than a window must not look like a completed scan.
+#[cfg_attr(not(test), allow(dead_code))]
 fn push_oversized_scan_windows(
     out: &mut Vec<String>,
     command: &str,
@@ -714,6 +715,1243 @@ fn push_oversized_scan_windows(
     false
 }
 
+const MAX_OVERSIZED_LEX_DEPTH: usize = 64;
+
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+enum OversizedQuoteContext {
+    Unquoted,
+    Single,
+    Double,
+    AnsiC,
+    PowerShellHereSingle,
+    PowerShellHereDouble,
+    PowerShellBlockComment,
+    LineComment,
+}
+
+impl OversizedQuoteContext {
+    const fn opening_prefix(self) -> &'static str {
+        match self {
+            Self::Unquoted => "",
+            Self::Single => "'",
+            Self::Double => "\"",
+            Self::AnsiC => "$'",
+            Self::PowerShellHereSingle => "@'\n",
+            Self::PowerShellHereDouble => "@\"\n",
+            Self::PowerShellBlockComment => "<#",
+            Self::LineComment => "#",
+        }
+    }
+}
+
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+enum OversizedLexKind {
+    Single,
+    Double,
+    AnsiC,
+    PowerShellHereSingle,
+    PowerShellHereDouble,
+    PowerShellBlockComment,
+    LineComment,
+    Paren,
+    DollarParen,
+    Backtick,
+}
+
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+struct OversizedLexFrame {
+    kind: OversizedLexKind,
+    open_offset: usize,
+}
+
+struct OversizedLexCursor<'a> {
+    source: &'a str,
+    bytes: &'a [u8],
+    dialect: ShellDialect,
+    pos: usize,
+    stack: Vec<OversizedLexFrame>,
+    at_word_start: bool,
+    at_line_start: bool,
+    powershell_literal_mode: bool,
+    last_word_start: Option<usize>,
+    depth_overflow: bool,
+}
+
+impl<'a> OversizedLexCursor<'a> {
+    fn new(source: &'a str, dialect: ShellDialect) -> Self {
+        Self {
+            source,
+            bytes: source.as_bytes(),
+            dialect,
+            pos: 0,
+            stack: Vec::new(),
+            at_word_start: true,
+            at_line_start: true,
+            powershell_literal_mode: false,
+            last_word_start: None,
+            depth_overflow: false,
+        }
+    }
+
+    fn push_frame(&mut self, kind: OversizedLexKind, open_offset: usize) {
+        if self.stack.len() >= MAX_OVERSIZED_LEX_DEPTH {
+            self.depth_overflow = true;
+            return;
+        }
+        self.stack.push(OversizedLexFrame { kind, open_offset });
+    }
+
+    fn char_width_at(&self, index: usize) -> usize {
+        self.source
+            .get(index..)
+            .and_then(|tail| tail.chars().next())
+            .map_or(1, char::len_utf8)
+    }
+
+    fn active_quote_context(&self, unclosed_opens: &[usize]) -> OversizedQuoteContext {
+        let Some(top) = self.stack.last() else {
+            return OversizedQuoteContext::Unquoted;
+        };
+        let context = match top.kind {
+            OversizedLexKind::Single => OversizedQuoteContext::Single,
+            OversizedLexKind::Double => OversizedQuoteContext::Double,
+            OversizedLexKind::AnsiC => OversizedQuoteContext::AnsiC,
+            OversizedLexKind::PowerShellHereSingle => OversizedQuoteContext::PowerShellHereSingle,
+            OversizedLexKind::PowerShellHereDouble => OversizedQuoteContext::PowerShellHereDouble,
+            OversizedLexKind::PowerShellBlockComment => {
+                OversizedQuoteContext::PowerShellBlockComment
+            }
+            OversizedLexKind::LineComment => return OversizedQuoteContext::LineComment,
+            OversizedLexKind::Paren
+            | OversizedLexKind::DollarParen
+            | OversizedLexKind::Backtick => return OversizedQuoteContext::Unquoted,
+        };
+        if unclosed_opens.contains(&top.open_offset) {
+            OversizedQuoteContext::Unquoted
+        } else {
+            context
+        }
+    }
+
+    /// Advance by one atomic lexical step (never splitting a multi-byte UTF-8
+    /// character or an escape sequence). Returns `Some((sep_start, sep_end))`
+    /// when a top-level neutral list/statement separator was just consumed
+    /// (excluding pipeline operators `|`/`|&`, which couple adjacent stages).
+    fn step(&mut self) -> Option<(usize, usize)> {
+        let len = self.bytes.len();
+        if self.pos >= len {
+            return None;
+        }
+        match self.dialect {
+            ShellDialect::Cmd => self.step_cmd(),
+            ShellDialect::PowerShell => self.step_powershell(),
+            ShellDialect::Posix | ShellDialect::Unknown => self.step_posix(),
+        }
+    }
+
+    fn step_cmd(&mut self) -> Option<(usize, usize)> {
+        let len = self.bytes.len();
+        let i = self.pos;
+        let b = self.bytes[i];
+
+        // In 
```

**File**: `tests/repro_290_oversized_hook_input.rs` (modified, +171/-0)
```diff
@@ -1145,3 +1145,174 @@ fn antigravity_recovery_preserves_real_shell_batch_precedence() {
     assert_eq!(json["hookSpecificOutput"]["permissionDecision"], "deny");
     assert!(json.get("decision").is_none(), "{json}");
 }
+
+#[test]
+fn oversized_quote_parity_does_not_hide_destructive_tails_o36a() {
+    let pad = "A".repeat(270 * 1024);
+    let mid_pad = "A".repeat(70 * 1024);
+    let tail_pad = "B".repeat(200 * 1024);
+    let envelope = |tool: &str, command: String| {
+        serde_json::json!({ "tool_name": tool, "tool_input": { "command": command } }).to_string()
+    };
+
+    // Every case below pairs a long quoted string before the real destructive
+    // command with a trailing quoted string after it, so blind windowing that
+    // started inside the first quote used to flip quote parity and read the
+    // destructive command as quoted data.
+    for (label, tool, command) in [
+        (
+            "cmd double-quote parity flip",
+            "cmd",
+            format!("echo \"{pad}\" & rd /s /q C:\\ & echo \"done\""),
+        ),
+        (
+            "cmd apostrophe + backslash-quote parity",
+            "cmd",
+            format!("echo it's \"C:\\dir\\{pad}\\\" & rd /s /q C:\\ & echo \"done\""),
+        ),
+        (
+            "cmd unclosed quote reset by newline",
+            "cmd",
+            format!("echo \"{pad}\nrd /s /q C:\\\n"),
+        ),
+        (
+            "powershell single-quote parity flip",
+            "PowerShell",
+            format!("Write-Output '{pad}'; Remove-Item -Recurse -Force C:\\; Write-Output 'done'"),
+        ),
+        (
+            "powershell double-quote trailing backslash parity",
+            "PowerShell",
+            format!(
+                "Write-Output \"C:\\dir\\{pad}\\\"; Remove-Item -Recurse -Force C:\\; Write-Output \"done\""
+            ),
+        ),
+        (
+            "powershell call operator after long prefix",
+            "PowerShell",
+            format!(
+                "Write-Output '{}'; & 'Remove-Item' -Recurse -Force C:\\; Write-Output '{tail_pad}'",
+                "A".repeat(63 * 1024)
+            ),
+        ),
+        (
+            "powershell mid-statement paren quote parity",
+            "PowerShell",
+            format!(
+                "Write-Output ('{mid_pad}' + $(Remove-Item -Recurse -Force C:\\) + '{tail_pad}')"
+            ),
+        ),
+        (
+            "powershell here-string parity",
+            "PowerShell",
+            format!("$x = @'\n{pad}\n'@; Remove-Item -Recurse -Force C:\\; Write-Output 'done'"),
+        ),
+        (
+            "posix single-quote parity flip",
+            "Bash",
+            format!("echo '{pad}'; rm -rf /; echo 'done'"),
+        ),
+        (
+            "posix mid-statement concat quote parity",
+            "Bash",
+            format!("echo '{mid_pad}'$(rm -rf /)'{tail_pad}'"),
+        ),
+        (
+            "mislabeled bash carrying powershell backslash-quote",
+            "Bash",
+            format!(
+                "Write-Output \"C:\\dir\\{pad}\\\"; Remove-Item -Recurse -Force C:\\; Write-Output \"done\""
+            ),
+        ),
+    ] {
+        assert_denied(label, &envelope(tool, command));
+    }
+}
+
+#[test]
+fn oversized_boundary_straddling_commands_and_pipelines_are_caught_o36a() {
+    let envelope = |tool: &str, command: String| {
+        serde_json::json!({ "tool_name": tool, "tool_input": { "command": command } }).to_string()
+    };
+
+    // Single commands longer than the 4 KiB window overlap (here ~8 KiB) placed
+    // directly across the 64 KiB window boundary must be evaluated whole and
+    // concretely denied rather than split across windows.
+    let prefix_60k = "p".repeat(60 * 1024);
+    let suffix_240k = "q".repeat(240 * 1024);
+    let gap_8k = " ".repeat(8 * 1024);
+    let rm_args_8k = "/tmp/a ".repeat(1_200);
+    for (label, tool, command) in [
+        (
+            "posix 8 KiB git command straddling 64 KiB",
+            "Bash",
+            format!("# {prefix_60k}\ngit{gap_8k}reset --hard\n# {suffix_240k}"),
+        ),
+        (
+            "posix 8 KiB rm command straddling 64 KiB",
+            "Bash",
+            format!("# {prefix_60k}\nrm {rm_args_8k}-rf /\n# {suffix_240k}"),
+        ),
+        (
+            "powershell 8 KiB Remove-Item straddling 64 KiB",
+            "PowerShell",
+            format!("# {prefix_60k}\nRemove-Item{gap_8k}-Recurse -Force C:\\\n# {suffix_240k}"),
+        ),
+        (
+            "cmd 8 KiB rd straddling 64 KiB",
+            "cmd",
+            format!("echo {prefix_60k} & rd{gap_8k}/s /q C:\\ & echo {suffix_240k}"),
+        ),
+        (
+            "posix pipeline straddling 64 KiB",
+            "Bash",
+            format!(
+                "# {}\necho 'rm -rf /' | sh\n# {suffix_240k}",
+                "p".repeat(64 * 1024 - 16)
+            ),
+        ),
+    ] {
+        assert_denied(label, &envelope(tool, command));
```

**File**: `tests/repro_ym0p_oversized_code_heredoc.rs` (modified, +203/-0)
```diff
@@ -444,3 +444,206 @@ fn oversized_exported_data_receiver_is_unverified_azu4() {
         assert!(!stderr.contains("fail-open"), "{stderr}");
     }
 }
+
+#[test]
+fn oversized_data_heredoc_real_repo_files_are_allowed_jj7f() {
+    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
+    let readme = fs::read_to_string(manifest_dir.join("README.md")).expect("read README.md");
+    let normalize =
+        fs::read_to_string(manifest_dir.join("src/normalize.rs")).expect("read src/normalize.rs");
+    let heredoc_rs =
+        fs::read_to_string(manifest_dir.join("src/heredoc.rs")).expect("read src/heredoc.rs");
+    let mut scripts_bundle = String::new();
+    for script in [
+        "scripts/e2e_test.sh",
+        "scripts/e2e_destructive_equivalents.sh",
+        "scripts/e2e_codex.sh",
+        "scripts/e2e_fleet_install.sh",
+        "scripts/e2e_harness_matrix.sh",
+    ] {
+        scripts_bundle.push_str(&fs::read_to_string(manifest_dir.join(script)).expect(script));
+        scripts_bundle.push('\n');
+    }
+    let synthetic_hazardous = format!(
+        "rm -rf /\ngit reset --hard\neval(x);\n`rm -rf /`\nRemove-Item -Recurse -Force C:\\\nformat C: /q /y\n🛡 UTF-8 prose\n{}",
+        "documentation line mentioning rm -rf / and git reset --hard and eval(x);\n".repeat(4_500)
+    );
+
+    // Ensure every case exceeds the 256 KiB hook input limit when wrapped in JSON.
+    let pad_to_oversized = |mut content: String| {
+        while content.len() < 270 * 1024 {
+            content.push_str("# padding line mentioning rm -rf / and git reset --hard\n");
+        }
+        content
+    };
+
+    let cases = [
+        (
+            "README.md",
+            "cat > out.md <<'DCG_FILE_EOF'",
+            pad_to_oversized(readme),
+            "DCG_FILE_EOF",
+        ),
+        (
+            "src/normalize.rs",
+            "cat > normalize.rs <<'DCG_FILE_EOF'",
+            pad_to_oversized(normalize),
+            "DCG_FILE_EOF",
+        ),
+        (
+            "src/heredoc.rs (>1000 interior <<)",
+            "cat > heredoc.rs <<'DCG_FILE_EOF'",
+            heredoc_rs,
+            "DCG_FILE_EOF",
+        ),
+        (
+            "scripts/*.sh bundle",
+            "cat <<-'DCG_FILE_EOF' > bundle.sh",
+            pad_to_oversized(scripts_bundle),
+            "\tDCG_FILE_EOF",
+        ),
+        (
+            "synthetic hazardous prose via tee",
+            "tee notes.txt <<\"DCG_FILE_EOF\"",
+            synthetic_hazardous,
+            "DCG_FILE_EOF",
+        ),
+    ];
+
+    for (label, header, content, terminator) in cases {
+        let command = format!("{header}\n{content}\n{terminator}\n");
+        let input = envelope(&command);
+        assert!(
+            input.len() > 256 * 1024,
+            "{label}: payload ({} bytes) must exceed 256 KiB",
+            input.len()
+        );
+        let home = tempfile::tempdir().expect("isolated hook home");
+        let (stdout, stderr, exit_code) = run_hook(&input, home.path());
+        assert_eq!(exit_code, 0, "{label}: hook exits 0\n{stderr}");
+        assert!(
+            stdout.trim().is_empty(),
+            "{label}: benign oversized quoted data heredoc must be allowed (fail-open), got: {stdout:?}\nstderr: {stderr}"
+        );
+        assert!(
+            stderr.contains("exceeds limit"),
+            "{label}: expected oversized warning on stderr, got: {stderr:?}"
+        );
+    }
+
+    // Multiple sequential quoted data heredocs in one command are also allowed.
+    let half = "docs mentioning rm -rf / and eval(x);\n".repeat(4_000);
+    let multi = format!(
+        "cat > a.txt <<'DCG_A'\n{half}DCG_A\ncat > b.txt <<'DCG_B'\n{half}DCG_B\necho done\n"
+    );
+    let multi_input = envelope(&multi);
+    assert!(multi_input.len() > 256 * 1024);
+    let home = tempfile::tempdir().expect("isolated hook home");
+    let (stdout, stderr, exit_code) = run_hook(&multi_input, home.path());
+    assert_eq!(exit_code, 0, "multi-heredoc: {stderr}");
+    assert!(
+        stdout.trim().is_empty(),
+        "multi-heredoc benign data write must be allowed: {stdout:?}\n{stderr}"
+    );
+}
+
+#[test]
+fn oversized_data_heredoc_planted_negatives_fail_closed_jj7f_azu4() {
+    let benign_body = body("done = 1");
+
+    // 1. Destructive command AFTER the heredoc terminator MUST be concretely denied.
+    for (label, tail, expected_rule) in [
+        (
+            "rm -rf / after terminator",
+            "rm -rf /",
+            "core.filesystem:rm-rf-root-home",
+        ),
+        (
+            "command substitution after terminator",
+            "echo $(rm -rf /)",
+            "core.filesystem:rm-rf-root-home",
+        ),
+        (
+            "git reset --hard after terminator",
+            "git reset --hard",
+            "core.git:reset-hard",
+        ),
+    ] {
+        let command = format!("cat > out.txt <<'EOF'\n{benign_body}EOF\n{tail}\n");
+        assert_concrete_rule_verdict(&command, "",
```

---

### Incident Patch 3: `daf7e865` (2026-11-24)
**Commit Message**: fix(security): close cmd dynamic argv0 windows-rule and modprobe env-option bypasses [skip ci]

Closes bd-cmd-dynamic-argv0-windows-rules-j70t and bd-modprobe-env-option-bypass-fhep.

- cmd.exe dynamic argv0 / windows rules (bd-cmd-dynamic-argv0-windows-rules-j70t):
  - Handle unquoted cmd %VAR%/!VAR! split prefixes in windows.filesystem
    (e.g. `r%x%md /s /q C:\` where `%x%` can expand to `"d "` -> `rd`),
    glued switches on dynamic/call-prefixed argv0 (`r%x%mdir/s/q`,
    `r%x%d/s/q`, `d%x%el/s/q`, `form%x%at/q`, `ca%x%ll r%x%mdir/s/q`),
    packed dynamic switches (`/%y%s/q`), and variable names containing
    path/command separators or spaces via `decode_cmd_symbolic_word` and
    `tokenize_cmd_expansion_view`.
  - Add deny-wins Cmd argv0-only `%NAME%`/`!NAME!` expansion elision in the
    evaluator (respecting cmd.exe `%` vs `^!` precedence and skipping wholly
    dynamic executables like `%LOGGER%`) so `windows.system` and `windows.misc`
    rules catch obfuscated `vssadmin`, `wbadmin`, `wmic`, `diskpart`, `cipher`,
    `bcdedit`, `fsutil`, `reg`, `net`, `sc`, `schtasks`, `wsl`, and `robocopy`
    invocations under both `--dialect cmd` and `--dialect unknown` while
    pr

**File**: `.beads/issues.jsonl` (modified, +2/-2)
```diff
@@ -75,7 +75,7 @@
 {"id":"bd-builtin-wrapper-bypass-pbxa","title":"builtin wrapper hides the executed command (builtin command git reset --hard allowed in Claude Bash)","description":"## Confirmed defect\n\n`builtin NAME ARGS` runs the shell builtin NAME (bash, ksh; zsh for its builtins). When NAME is\n`command`, `exec` or `builtin`, the command after it executes. `strip_wrapper_prefixes` strips\n`command`, `sudo`, `env`, `exec` and others, but not `builtin`, so dcg sees an unknown program\nnamed `builtin`.\n\nProbe with `dcg test --stdin --dialect D --format json`, 0.16.0 tree at 606f29f3 (inert strings only):\n\n| command | posix (Claude Bash) | unknown |\n|---|---|---|\n| `builtin command git reset --hard` | allow | deny core.git:reset-hard |\n| `builtin command mkfs.ext4 /dev/sda1` | allow | allow |\n| `command builtin command git reset --hard` | allow | deny |\n| `builtin command -p git reset --hard` | allow | deny |\n| `builtin builtin command git reset --hard` | allow | deny |\n| `command git reset --hard` (control) | deny | deny |\n| `builtin echo git reset --hard` (control) | allow | deny (FP) |\n\nThe Claude Code hook (tool `Bash`) answered ALLOW for the first row. `bash -c 'builtin command printf ...'` runs\nprintf, so the bypass is real in bash. v0.15.3 (homebrew) denied the mkfs row as system.disk:mkfs,\nso that row is a 0.16.0 regression in a default-on pack. The corpus case\ntests/corpus/bypass_attempts/wrappers.toml \"builtin command git reset is blocked\" passes only\nbecause the corpus harness evaluates under the unknown dialect.\n\n## Fix direction\n\nStrip `builtin` (and an optional `--`) as a wrapper in `strip_wrapper_prefixes`, next to\n`strip_command_wrapper`. A NAME that is not a builtin makes the shell fail without running anything,\nso stripping it anyway can only add denials.\n\n## Acceptance\n\nEvery row above denies in posix and unknown under the plain rule. `builtin echo …`, `builtin cd …`,\n`builtin command git status` stay allowed. Hook-level regression for the Claude Bash tool.\n","status":"closed","priority":1,"issue_type":"bug","created_at":"2026-11-03T01:48:51.921489Z","created_by":"jemanuel","updated_at":"2026-11-03T02:16:50.331376Z","closed_at":"2026-11-03T02:16:50.321413Z","close_reason":"Fixed in 2975ad77. builtin + zsh noglob/nocorrect/- stripped by the shared POSIX frontend model; macOS arch/xcrun/taskpolicy/sandbox-exec added to the unmodeled launcher lists (evaluator, git, heredoc); credential classifier's catch-all arm reads the first writer operand of any launcher git's unmodeled_exec_wrapper (plus watch) knows runs its operands (strace/firejail/gosu/unshare/taskset/flock/faketime/xvfb-run/nsenter/chroot/watch ... tee ~/.ssh/authorized_keys were ALLOWED, also on 0.15.3). Evidence: every bead row + sweep row denies in posix and unknown under the plain rule; tests/repro_builtin_wrapper.rs hook-level (Claude Bash) + normalize/credential unit tests 362/362; full nextest 7520 pass, rest = pre-existing #623 set + load flakes passing alone; clippy -D warnings clean. Remaining known: unknown-dialect 'builtin echo git reset --hard' still denies (pre-existing unknown conservatism; posix allows).","source_repo":"destructive_command_guard","compaction_level":0,"original_size":0}
 {"id":"bd-c0di","title":"P7.4: Update configuration.md with DCG_NO_RICH environment variable docs","status":"closed","priority":2,"issue_type":"task","created_at":"2026-01-19T21:16:22.771173546Z","created_by":"ubuntu","updated_at":"2026-04-28T07:50:19.620382Z","closed_at":"2026-04-28T07:50:19.619972Z","close_reason":"Documented DCG_NO_RICH, rich/plain output controls, robot mode, and hook stdout/stderr behavior in 9ff58b1.","source_repo":".","compaction_level":0,"original_size":0,"dependencies":[{"issue_id":"bd-c0di","depends_on_id":"bd-3jl0","type":"blocks","created_at":"2026-02-16T07:00:29Z","created_by":"import","metadata":"{}","thread_id":""}],"comments":[{"id":46,"issue_id":"bd-c0di","author":"Dicklesworthstone","text":"## Task: Update configuration.md documentation\n\n### What to Do\n\nDocument all new configuration options and environment variables related to rich output.\n\n### File: docs/configuration.md\n\nAdd new section:\n\n```markdown\n## Output Configuration\n\n### Rich Terminal Output\n\ndcg uses rich terminal formatting by default when output is a TTY.\n\n#### Environment Variables\n\n| Variable | Default | Description |\n|----------|---------|-------------|\n| `DCG_NO_RICH` | unset | Set to any value to disable rich formatting |\n| `NO_COLOR` | unset | Standard env var to disable all colors |\n| `TERM` | - | If `dumb`, uses ASCII-only output |\n| `CI` | - | If set, disables TTY detection |\n\n#### Examples\n\n```bash\n# Force plain output\nDCG_NO_RICH=1 dcg scan .\n\n# Disable colors but keep Unicode\nNO_COLOR=1 dcg doctor\n\n# Pipeline-friendly (auto-detected)\ndcg scan . | head  # Automatically uses plain output\n```\n\n### Theme Configuration\n\ndcg detects terminal theme automa
```

**File**: `src/evaluator.rs` (modified, +335/-4)
```diff
@@ -17580,12 +17580,16 @@ fn view_decode_exposes_pack_keyword(
         return view_escape_present || elided.is_some();
     };
     // The elided view is measured against cmd's own view, so it answers only
-    // for what the expansions hid.
+    // for what the expansions hid. An argv0 whose elided spelling names an
+    // enabled keyword also requires a Cmd replay even if that same keyword
+    // already appeared elsewhere in the command (e.g., in an earlier segment
+    // or a registry path such as `re%x%g delete HKLM\Software\reg\Foo`).
     (view_escape_present
         && index.exposes_keyword_absent_from(view_normalized.as_ref(), posix_normalized.as_ref()))
         || elided.is_some_and(|elided| {
             index.exposes_keyword_absent_from(&elided, view_normalized.as_ref())
         })
+        || (view == ShellDialect::Cmd && cmd_elided_argv0_matches_keyword(command, index))
 }
 
 /// The byte ranges of cmd.exe `%NAME%`, delayed `!NAME!` and batch-parameter
@@ -17689,6 +17693,190 @@ fn elide_cmd_percent_expansions(command: &str) -> Option<String> {
     })
 }
 
+fn cmd_elided_argv0_has_nonempty_basename(elided: &str) -> bool {
+    let unquoted: String = elided.chars().filter(|&ch| ch != '"').collect();
+    let trimmed = unquoted.trim_start_matches('@');
+    let after_backslash = trimmed.rsplit('\\').next().unwrap_or(trimmed).trim();
+    !after_backslash.is_empty() && after_backslash.chars().any(char::is_alphanumeric)
+}
+
+/// Elide active `%NAME%` and `!NAME!` expansions from one Cmd argv0 word.
+///
+/// Matches cmd.exe's two-phase expansion precedence: `%NAME%` expands before
+/// caret removal (so `^%x%` still expands), whereas unquoted `^!` escapes `!`
+/// into a literal exclamation mark (so `vssad^!LITERAL^!%EMPTY%min` elides
+/// only `%EMPTY%` and does not collapse into `vssadmin`).
+fn elide_cmd_argv0_word(raw: &str) -> Option<String> {
+    let bytes = raw.as_bytes();
+    let mut spans = Vec::new();
+    let mut index = 0usize;
+    let mut double = false;
+    while index < bytes.len() {
+        let byte = bytes[index];
+        if byte == b'%'
+            && let Some(end) = crate::normalize::cmd_expansion_end(bytes, index)
+        {
+            spans.push(index..end);
+            index = end;
+            continue;
+        }
+        if byte == b'!'
+            && let Some(end) = crate::normalize::cmd_expansion_end(bytes, index)
+        {
+            spans.push(index..end);
+            index = end;
+            continue;
+        }
+        match byte {
+            b'"' => {
+                double = !double;
+                index += 1;
+            }
+            b'^' if !double => {
+                if bytes.get(index + 1) == Some(&b'%')
+                    && let Some(end) = crate::normalize::cmd_expansion_end(bytes, index + 1)
+                {
+                    spans.push(index + 1..end);
+                    index = end;
+                } else {
+                    // Caret escapes the next byte (including `^!`).
+                    index = index.saturating_add(2).min(bytes.len());
+                }
+            }
+            _ => index += 1,
+        }
+    }
+    if spans.is_empty() {
+        return None;
+    }
+    let mut out = String::with_capacity(raw.len());
+    let mut copied_from = 0usize;
+    for span in spans {
+        out.push_str(&raw[copied_from..span.start]);
+        copied_from = span.end;
+    }
+    out.push_str(&raw[copied_from..]);
+    Some(out)
+}
+
+fn cmd_elided_argv0_edits_for_tokens(
+    command: &str,
+    tokens: &[crate::normalize::NormalizeToken],
+) -> Vec<(std::ops::Range<usize>, String)> {
+    let mut edits = Vec::new();
+    let mut start = 0usize;
+    for end in 0..=tokens.len() {
+        if end < tokens.len() && tokens[end].kind != NormalizeTokenKind::Separator {
+            continue;
+        }
+        let statement = &tokens[start..end];
+        start = end + 1;
+        let mut next_is_redirect_target = false;
+        for token in statement {
+            let Some(raw) = token.text(command) else {
+                break;
+            };
+            if next_is_redirect_target {
+                next_is_redirect_target = false;
+                continue;
+            }
+            if let Some(needs_target) = cmd_leading_redirect_needs_target(raw) {
+                next_is_redirect_target = needs_target;
+                continue;
+            }
+            if !raw.contains(['"', '%', '!'])
+                && raw.trim_start_matches('@').eq_ignore_ascii_case("call")
+            {
+                continue;
+            }
+            if raw.contains(['%', '!'])
+                && let Some(elided_word) = elide_cmd_argv0_word(raw)
+                && cmd_elided_argv0_has_nonempty_basename(&elided_word)
+            {
+                let is_obfuscated_call = !raw.contains('"')
+                    && elided_word
+                        .trim_start_matches('@')
+                        .eq_i
```

**File**: `src/normalize.rs` (modified, +573/-1)
```diff
@@ -95,6 +95,7 @@ pub fn strip_wrapper_prefixes(command: &str) -> NormalizedCommand<'_> {
 
     let mut current = trimmed.to_string();
     let mut stripped_wrappers = Vec::new();
+    let mut modprobe_env = ModprobeEnvState::default();
 
     // Iteratively strip wrappers until no more are found
     // Limit iterations to prevent DoS from maliciously crafted commands
@@ -114,36 +115,42 @@ pub fn strip_wrapper_prefixes(command: &str) -> NormalizedCommand<'_> {
 
         // Try stripping each wrapper type in order
         if let Some((remaining, wrapper)) = strip_sudo(&current) {
+            record_modprobe_env_wrapper(&mut modprobe_env, &wrapper);
             stripped_wrappers.push(wrapper);
             current = remaining;
             continue;
         }
 
         if let Some((remaining, wrapper)) = strip_env(&current) {
+            record_modprobe_env_wrapper(&mut modprobe_env, &wrapper);
             stripped_wrappers.push(wrapper);
             current = remaining;
             continue;
         }
 
         if let Some((remaining, wrapper)) = strip_command_wrapper(&current) {
+            record_modprobe_env_wrapper(&mut modprobe_env, &wrapper);
             stripped_wrappers.push(wrapper);
             current = remaining;
             continue;
         }
 
         if let Some((remaining, wrapper)) = strip_posix_assignment_prefix(&current) {
+            record_modprobe_env_wrapper(&mut modprobe_env, &wrapper);
             stripped_wrappers.push(wrapper);
             current = remaining;
             continue;
         }
 
         if let Some((remaining, wrapper)) = strip_execution_wrapper(&current) {
+            record_modprobe_env_wrapper(&mut modprobe_env, &wrapper);
             stripped_wrappers.push(wrapper);
             current = remaining;
             continue;
         }
 
         if let Some((remaining, wrapper)) = strip_leading_backslash(&current) {
+            record_modprobe_env_wrapper(&mut modprobe_env, &wrapper);
             stripped_wrappers.push(wrapper);
             current = remaining;
             continue;
@@ -155,7 +162,22 @@ pub fn strip_wrapper_prefixes(command: &str) -> NormalizedCommand<'_> {
         }
     }
 
-    if stripped_wrappers.is_empty() {
+    let mut modprobe_env_folded = false;
+    if !limit_reached {
+        if !modprobe_env.posixly_correct
+            && leading_unstripped_posixly_correct_before_modprobe(&current)
+        {
+            modprobe_env.posixly_correct = true;
+        }
+        if (modprobe_env.modprobe_options.is_some() || modprobe_env.posixly_correct)
+            && let Some(folded) = fold_modprobe_env_into_command(&current, &modprobe_env)
+        {
+            current = folded;
+            modprobe_env_folded = true;
+        }
+    }
+
+    if stripped_wrappers.is_empty() && !modprobe_env_folded {
         NormalizedCommand::unchanged(command)
     } else {
         NormalizedCommand {
@@ -167,6 +189,453 @@ pub fn strip_wrapper_prefixes(command: &str) -> NormalizedCommand<'_> {
     }
 }
 
+/// Environment variables stripped before `modprobe` that change how kmod
+/// parses its command line (bd-modprobe-env-option-bypass-fhep).
+///
+/// - `MODPROBE_OPTIONS`: kmod splits this on ASCII whitespace and prepends the
+///   resulting tokens before `argv[1..]`, so `MODPROBE_OPTIONS=-r modprobe x`
+///   unloads `x`.
+/// - `POSIXLY_CORRECT`: glibc `getopt_long` stops permuting options at the
+///   first non-option operand whenever this variable is present (even empty),
+///   so `POSIXLY_CORRECT=1 modprobe -r nvidia -n` treats `-n` as another
+///   module name rather than a dry-run flag.
+#[derive(Default)]
+struct ModprobeEnvState {
+    modprobe_options: Option<String>,
+    posixly_correct: bool,
+}
+
+fn record_modprobe_assignment(state: &mut ModprobeEnvState, raw: &str) {
+    let mut decoder = ShellTokenDecoder::new(ShellDialect::Posix);
+    let Some(decoded) = decoder.decode(raw, ShellTokenRole::Syntax) else {
+        return;
+    };
+    let Some((name, value)) = decoded.split_once('=') else {
+        return;
+    };
+    match name {
+        "MODPROBE_OPTIONS" => state.modprobe_options = Some(value.to_string()),
+        "POSIXLY_CORRECT" => state.posixly_correct = true,
+        _ => {}
+    }
+}
+
+fn unset_modprobe_env_name(state: &mut ModprobeEnvState, raw_name: &str) {
+    let mut decoder = ShellTokenDecoder::new(ShellDialect::Posix);
+    let decoded = decoder
+        .decode(raw_name.trim(), ShellTokenRole::Syntax)
+        .unwrap_or_else(|| Cow::Borrowed(raw_name.trim()));
+    match decoded.as_ref() {
+        "MODPROBE_OPTIONS" => state.modprobe_options = None,
+        "POSIXLY_CORRECT" => state.posixly_correct = false,
+        _ => {}
+    }
+}
+
+fn record_modprobe_env_wrapper(state: &mut ModprobeEnvState, wrapper: &StrippedWrapper) {
+    match wrapper.wrapper_type {
+        "assignment" => record_modprobe_assignment(state, &wrapper.stripped_text),
+        "env" => record_modprob
```

**File**: `src/packs/system/services.rs` (modified, +4/-4)
```diff
@@ -60,10 +60,10 @@ macro_rules! modprobe_dry_run_ahead {
 /// abbreviation of it, or a short-flag cluster holding `r` such as `-rf`),
 /// unless they ask for a dry run.
 ///
-/// `MODPROBE_OPTIONS=-r`/`POSIXLY_CORRECT` prefixes cannot be matched here:
-/// the evaluator strips a leading environment assignment as a wrapper before
-/// any pack sees the command, so the variable is gone by match time. That
-/// env-layer bypass is bd-modprobe-env-option-bypass-fhep.
+/// `MODPROBE_OPTIONS` and `POSIXLY_CORRECT` leading assignments (bare or via
+/// `env`/`sudo`) are folded into the `modprobe` command by
+/// `normalize::strip_wrapper_prefixes` before this rule runs
+/// (bd-modprobe-env-option-bypass-fhep).
 macro_rules! modprobe_removal {
     () => {
         concat!(
```

**File**: `src/packs/windows/filesystem.rs` (modified, +350/-37)
```diff
@@ -849,6 +849,170 @@ fn cmd_drive_target(decoded: &str) -> bool {
 /// word only when its prefix is exactly a protected internal command, and a
 /// switch word only when every piece is a one-letter switch or `/?`, so a
 /// path or a `/fs:NTFS`-style valued switch is never taken apart.
+fn split_cmd_packed_dynamic_switches(word: &str) -> Option<Vec<String>> {
+    if !word.starts_with('/') || !word.contains(['%', '!', '^']) {
+        return None;
+    }
+    let bytes = word.as_bytes();
+    let mut slash_positions = vec![0usize];
+    let mut index = 1usize;
+    let mut double = false;
+    while index < bytes.len() {
+        if let Some(end) = crate::normalize::cmd_expansion_end(bytes, index) {
+            index = end;
+            continue;
+        }
+        match bytes[index] {
+            b'"' => {
+                double = !double;
+                index += 1;
+            }
+            b'^' if !double => {
+                if bytes.get(index + 1) == Some(&b'%')
+                    && let Some(end) = crate::normalize::cmd_expansion_end(bytes, index + 1)
+                {
+                    index = end;
+                } else {
+                    index = index.saturating_add(2).min(bytes.len());
+                }
+            }
+            b'/' if !double => {
+                slash_positions.push(index);
+                index += 1;
+            }
+            _ => index += 1,
+        }
+    }
+    if slash_positions.len() < 2 {
+        return None;
+    }
+    let mut pieces = Vec::with_capacity(slash_positions.len());
+    for (idx, &start) in slash_positions.iter().enumerate() {
+        let end = slash_positions.get(idx + 1).copied().unwrap_or(word.len());
+        let piece = &word[start..end];
+        let is_plain_switch =
+            piece == "/?" || (piece.len() == 2 && piece.as_bytes()[1].is_ascii_alphabetic());
+        let is_dynamic_switch = piece.len() > 1 && piece.contains(['%', '!', '^']);
+        if !(is_plain_switch || is_dynamic_switch) {
+            return None;
+        }
+        pieces.push(piece.to_string());
+    }
+    Some(pieces)
+}
+
+fn cmd_first_glued_switch_slash(word: &str) -> Option<usize> {
+    let bytes = word.as_bytes();
+    let mut index = 0usize;
+    let mut double = false;
+    while index < bytes.len() {
+        if let Some(end) = crate::normalize::cmd_expansion_end(bytes, index) {
+            index = end;
+            continue;
+        }
+        match bytes[index] {
+            b'"' => {
+                double = !double;
+                index += 1;
+            }
+            b'^' if !double => {
+                if bytes.get(index + 1) == Some(&b'%')
+                    && let Some(end) = crate::normalize::cmd_expansion_end(bytes, index + 1)
+                {
+                    index = end;
+                } else {
+                    index = index.saturating_add(2).min(bytes.len());
+                }
+            }
+            b'/' if !double => return Some(index),
+            _ => index += 1,
+        }
+    }
+    None
+}
+
+fn symbolic_cmd_executable_may_split_into(word: &WindowsFilesystemWord, candidate: &str) -> bool {
+    if !word.dynamic || !word.may_split {
+        return false;
+    }
+    // An unquoted `%VAR%`/`!VAR!` in argv0 expands before whitespace
+    // splitting in cmd.exe: `set "x=d "` turns `r%x%md /s /q C:\` into
+    // `rd md /s /q C:\`. When a non-empty literal prefix before the first
+    // unquoted expansion prefixes a protected deletion command, the runtime
+    // argv0 can resolve to that command while pushing the remaining suffix
+    // into argv[1].
+    let Some(fragments) = word.cmd_fragments.as_ref() else {
+        return false;
+    };
+    let Some(first) = fragments.first() else {
+        return false;
+    };
+    if first.is_empty() {
+        return false;
+    }
+    let first_lower = first.to_ascii_lowercase();
+    candidate.to_ascii_lowercase().starts_with(&first_lower)
+}
+
+fn cmd_word_is_or_elides_to_call(word: &str) -> bool {
+    if word.contains('"') {
+        return false;
+    }
+    if !word.contains(['%', '!']) {
+        return word.trim_start_matches('@').eq_ignore_ascii_case("call");
+    }
+    let bytes = word.as_bytes();
+    let mut out = String::with_capacity(word.len());
+    let mut index = 0usize;
+    while index < bytes.len() {
+        let byte = bytes[index];
+        if matches!(byte, b'%' | b'!')
+            && let Some(end) = crate::normalize::cmd_expansion_end(bytes, index)
+        {
+            index = end;
+            continue;
+        }
+        if byte == b'^' {
+            if bytes.get(index + 1) == Some(&b'%')
+                && let Some(end) = crate::normalize::cmd_expansion_end(bytes, index + 1)
+            {
+                index = end;
+                continue;
+            }
+            if let Some(&next) = bytes.get(index + 1) {
+                out.push(next as char);
+                index += 2;
+               
```

**File**: `tests/repro_fhep_modprobe_env_bypass.rs` (added, +250/-0)
```diff
@@ -0,0 +1,250 @@
+//! bd-modprobe-env-option-bypass-fhep: `MODPROBE_OPTIONS` and
+//! `POSIXLY_CORRECT` leading env assignments (bare or through `env`/`sudo`)
+//! must be folded into `modprobe` before `system.services` evaluates the
+//! command, without breaking benign dry-run or load commands.
+//!
+//! Exercises the real compiled `dcg` binary through both `dcg test` (posix and
+//! unknown dialects, heredoc extractor on and off) and the PreToolUse hook JSON
+//! stdin protocol. No kernel operation runs: commands are only classified.
+
+use std::io::Write;
+use std::process::{Command, Stdio};
+
+const BENIGN_ALLOW_CONTROLS: &[&str] = &[
+    "FOO=bar modprobe nvidia",
+    "MODPROBE_OPTIONS=-n modprobe nvidia",
+    "MODPROBE_OPTIONS=\"-r -n\" modprobe nvidia",
+    "MODPROBE_OPTIONS=\"-n -r\" modprobe nvidia",
+    "MODPROBE_OPTIONS=--dry-run modprobe nvidia",
+    "MODPROBE_OPTIONS=\"--show -r\" modprobe nvidia",
+    "MODPROBE_OPTIONS=-n modprobe -r nvidia",
+    "MODPROBE_OPTIONS=-r modprobe -n nvidia",
+    "MODPROBE_OPTIONS=\"\" modprobe nvidia",
+    "MODPROBE_OPTIONS=-v modprobe nvidia",
+    "MODPROBE_OPTIONS=\"--config=/etc/modprobe.conf -r -n\" modprobe nvidia",
+    "MODPROBE_OPTIONS=-r MODPROBE_OPTIONS=-n modprobe nvidia",
+    "MODPROBE_OPTIONS=-r env -u MODPROBE_OPTIONS modprobe nvidia",
+    "MODPROBE_OPTIONS=-r env -i modprobe nvidia",
+    "POSIXLY_CORRECT=1 modprobe -n -r nvidia",
+    "POSIXLY_CORRECT=$(echo 1) modprobe -n -r nvidia",
+    "POSIXLY_CORRECT=1 modprobe -r -n nvidia",
+    "POSIXLY_CORRECT=1 modprobe --dry-run -r nvidia",
+    "POSIXLY_CORRECT=1 modprobe -C /etc/modprobe.conf -n -r nvidia",
+    "POSIXLY_CORRECT=1 modprobe --config=/etc/modprobe.conf -n -r nvidia",
+    "POSIXLY_CORRECT=1 modprobe --config /etc/modprobe.conf -n -r nvidia",
+    "POSIXLY_CORRECT=1 modprobe nvidia",
+    "POSIXLY_CORRECT=1 MODPROBE_OPTIONS=\"-r -n\" modprobe nvidia",
+    "POSIXLY_CORRECT=1 MODPROBE_OPTIONS=-n modprobe -r nvidia",
+    "echo ok && MODPROBE_OPTIONS=-n modprobe -r nvidia",
+    "echo ok && MODPROBE_OPTIONS=\"-r -n\" modprobe nvidia",
+    "echo ok && POSIXLY_CORRECT=1 modprobe -n -r nvidia",
+    "POSIXLY_CORRECT=1 ls -la /tmp",
+];
+
+const DESTRUCTIVE_DENY_CONTROLS: &[&str] = &[
+    "MODPROBE_OPTIONS=-r modprobe nvidia",
+    "MODPROBE_OPTIONS=--remove modprobe nvidia",
+    "MODPROBE_OPTIONS=\"--remove\" modprobe nvidia",
+    "MODPROBE_OPTIONS=\"--remove-dependencies\" modprobe nvidia",
+    "MODPROBE_OPTIONS=\"--remove-holders\" modprobe nvidia",
+    "MODPROBE_OPTIONS=\"-rv\" modprobe nvidia",
+    "MODPROBE_OPTIONS='-r' modprobe nvidia",
+    "MODPROBE_OPTIONS=\"--config=/etc/modprobe.conf -r\" modprobe nvidia",
+    "MODPROBE_OPTIONS=-C modprobe -n -r nvidia",
+    "MODPROBE_OPTIONS=\"-r --\" modprobe -n nvidia",
+    "MODPROBE_OPTIONS=-n MODPROBE_OPTIONS=-r modprobe nvidia",
+    "FOO=bar MODPROBE_OPTIONS=-r BAZ=qux modprobe nvidia",
+    "env MODPROBE_OPTIONS=-r modprobe nvidia",
+    "env -i MODPROBE_OPTIONS=-r modprobe nvidia",
+    "env -- MODPROBE_OPTIONS=-r modprobe nvidia",
+    "env -S \"MODPROBE_OPTIONS=-r modprobe nvidia\"",
+    "sudo env MODPROBE_OPTIONS=-r modprobe nvidia",
+    "sudo MODPROBE_OPTIONS=-r modprobe nvidia",
+    "sudo -u root MODPROBE_OPTIONS=-r modprobe nvidia",
+    "MODPROBE_OPTIONS=-r sudo -E modprobe nvidia",
+    "MODPROBE_OPTIONS=-r /sbin/modprobe nvidia",
+    "MODPROBE_OPTIONS=-r /usr/sbin/modprobe nvidia",
+    "MODPROBE_OPTIONS=-r \"modprobe\" nvidia",
+    "MODPROBE_OPTIONS=-r \\modprobe nvidia",
+    "POSIXLY_CORRECT=1 modprobe -r nvidia -n",
+    "POSIXLY_CORRECT=1 modprobe -r nvidia --dry-run",
+    "POSIXLY_CORRECT=1 modprobe -r nvidia --show",
+    "POSIXLY_CORRECT= modprobe -r nvidia -n",
+    "POSIXLY_CORRECT=$(echo 1) modprobe -r nvidia -n",
+    "POSIXLY_CORRECT=1 env modprobe -r nvidia -n",
+    "env POSIXLY_CORRECT=1 modprobe -r nvidia -n",
+    "POSIXLY_CORRECT=1 /usr/sbin/modprobe -r nvidia -n",
+    "POSIXLY_CORRECT=1 modprobe -C /etc/modprobe.conf -r nvidia -n",
+    "POSIXLY_CORRECT=1 modprobe --conf /etc/modprobe.conf -r nvidia -n",
+    "POSIXLY_CORRECT=1 modprobe --rem nvidia -n",
+    "POSIXLY_CORRECT=1 modprobe --remove-h nvidia -n",
+    "POSIXLY_CORRECT=1 modprobe --remove-d nvidia -n",
+    "POSIXLY_CORRECT=1 MODPROBE_OPTIONS=\"--rem\" modprobe nvidia -n",
+    "POSIXLY_CORRECT=1 MODPROBE_OPTIONS=-r modprobe nvidia -n",
+    "POSIXLY_CORRECT=1 MODPROBE_OPTIONS=\"-r nvidia\" modprobe -n",
+    "echo ok && MODPROBE_OPTIONS=-r modprobe nvidia",
+    "echo ok; POSIXLY_CORRECT=1 modprobe -r nvidia -n",
+];
+
+const NESTED_DENY_CONTROLS: &[&str] = &[
+    "ssh gpu-host MODPROBE_OPTIONS=-r modprobe nvidia",
+    "ssh gpu-host 'MODPROBE_OPTIONS=-r modprobe nvidia'",
+    "ssh gpu-host 'POSIXLY_CORRECT=1 modprobe -r nvidia -n'",
+    "bash -c 'MODPROBE_OPTIONS=-r modprobe nvidia'",
+    "bash -c 'POSIXLY_CORRECT=1 modprobe -r nvidia -n'",
+];
+
+fn dcg_test_verdict(command: &str, dialect: &str, heredoc: bool) 
```

**File**: `tests/repro_j70t_cmd_dynamic_argv0_windows.rs` (added, +281/-0)
```diff
@@ -0,0 +1,281 @@
+//! bd-cmd-dynamic-argv0-windows-rules-j70t: `%VAR%` (including always-empty
+//! `%PATH:~0,0%`) and `!VAR!` expansions inside cmd.exe program names must not
+//! skip `windows.filesystem`, `windows.system`, or `windows.misc` rules, while
+//! keeping benign cmd commands and read-only operations allowed.
+//!
+//! Exercises the real compiled `dcg` binary through both `dcg test` (`cmd` and
+//! `unknown` dialects) and the PreToolUse hook JSON stdin protocol (`cmd` and
+//! `Bash` tools). No commands execute: they are only classified.
+
+use std::io::Write;
+use std::process::{Command, Stdio};
+
+const WINDOWS_PACKS: &str = "core.git,core.filesystem,system.services,windows.filesystem,windows.system,windows.misc,windows.powershell";
+
+const DESTRUCTIVE_DENY_CONTROLS: &[&str] = &[
+    // windows.filesystem: rmdir/rd/del/format with %VAR%, !VAR!, glued switches,
+    // variable-name separators/spaces, and unquoted split prefixes
+    r"r%x%md /s /q C:\",
+    r"r%PATH:~0,0%md /s /q C:\",
+    r"r%x%mdir /s /q C:\",
+    r"rm%x%dir /s /q C:\",
+    r"r%x%d /s /q C:\",
+    r"R%x%MDIR /S /Q C:\",
+    r"r%PATH:~0, 0%mdir /s /q C:\",
+    r"r%NAME\WITH\SEP%mdir /s /q C:\",
+    r"r%NAME&WITH|PUNCT%mdir /s /q C:\",
+    r"r%x%mdir/s/q C:\",
+    r"r%x%d/s/q C:\",
+    r"d%x%el/s/q C:\",
+    r"call r%x%mdir/s/q C:\",
+    r"ca%x%ll r%x%md /s /q C:\",
+    r"ca%x%ll r%x%mdir/s/q C:\",
+    r"C:\Windows\System32\r%x%md /s /q C:\",
+    r"r!x!mdir /s /q C:\",
+    r"form%x%at C:",
+    r"form%x%at/q C:",
+    // windows.system: vssadmin + wbadmin + wmic + diskpart + cipher + bcdedit + fsutil
+    r"vssad%x%min delete shadows /all",
+    r"vssad%PATH:~0,0%min delete shadows /all",
+    r"vssad%x%min.exe delete shadows /all",
+    r"VSSAD%x%MIN DELETE SHADOWS /ALL",
+    r"C:\Windows\System32\vssad%x%min.exe delete shadows /all",
+    r"vssad!x!min delete shadows /all",
+    r"wba%x%dmin delete catalog",
+    r"wba%PATH:~0,0%dmin delete backup -keepVersions:0",
+    r"wm%x%ic shadowcopy delete",
+    r"diskp%x%art /s wipe.txt",
+    r"ciph%x%er /w:C:",
+    r"bcde%x%dit /delete {current}",
+    r"fsut%x%il file setzerodata offset=0 length=4096 C:\data.db",
+    r"fsut%x%il volume dismount C:",
+    // windows.misc: reg, net, sc, schtasks, wsl, robocopy
+    r"re%x%g delete HKLM\Software\Foo /f",
+    r"re%PATH:~0,0%g delete HKLM\Software\Foo /f",
+    r"RE%x%G.EXE DELETE HKLM\Software\Foo /f",
+    r"C:\Windows\System32\re%x%g.exe delete HKLM\Software\Foo /f",
+    r"re%x%g delete HKLM\Software\reg\Foo /f",
+    r"reg query HKLM\Foo & re%x%g delete HKLM\Bar /f",
+    r#"re"%x%"g delete HKLM\Software\Foo /f"#,
+    r"re!x!g delete HKLM\Software\Foo /f",
+    r"call re%x%g delete HKLM\Software\Foo /f",
+    r"ca%x%ll re%x%g delete HKLM\Software\Foo /f",
+    r"ca%x%ll vssad%x%min delete shadows /all",
+    r"2>nul re%x%g delete HKLM\Software\Foo /f",
+    r"ne%x%t user alice /delete",
+    r"s%x%c delete MyService",
+    r"r%x%mdir /%y%s/q C:\",
+    r"echo %undefined & re%x%g delete HKLM\Software\Foo /f & tail%",
+    r"ws%x%l --unregister Ubuntu",
+    r"roboc%x%opy C:\src D:\dst /MIR",
+    // Delayed expansion in core.git + cmd /c wrapper
+    r"gi!x!t reset --hard",
+    r#"cmd /c "r%x%md /s /q C:\""#,
+    r#"cmd /c "r%x%mdir /s /q C:\""#,
+    r#"cmd /c "vssad%x%min delete shadows /all""#,
+    r#"cmd /c "re%x%g delete HKLM\Software\Foo /f""#,
+    r#"cmd /v:on /c "re!x!g delete HKLM\Software\Foo /f""#,
+];
+
+const BENIGN_CMD_CORPUS: &[&str] = &[
+    r"echo %PATH%",
+    r"dir %USERPROFILE%",
+    r"dir /s %USERPROFILE%",
+    r"set FOO=%BAR%",
+    r"rd /?",
+    r"rmdir /?",
+    r"r%x%mdir /?",
+    r"r%x%md /?",
+    r"r%x%md C:\empty_dir",
+    r#""r%x%md" /s /q C:\"#,
+    r"vssadmin list shadows",
+    r"vssad%x%min list shadows",
+    r"vssad%x%min /?",
+    r"reg query HKLM\Software\Foo",
+    r"re%x%g query HKLM\Software\Foo",
+    r"re%x%g export HKLM\Software\Foo backup.reg",
+    r"sc query MyService",
+    r"s%x%c query MyService",
+    r"wsl --list --verbose",
+    r"ws%x%l --list --verbose",
+    r"schtasks /query /tn MyTask",
+    r"schta%x%sks /query /tn MyTask",
+    r"robocopy C:\src D:\dst /E",
+    r"roboc%x%opy C:\src D:\dst /E",
+    r"net user alice",
+    r"ne%x%t user alice",
+    r#"echo "vssad%x%min delete shadows /all""#,
+    r#"echo "r%x%mdir /s /q C:\""#,
+    r#"echo "re%x%g delete HKLM\Software\Foo /f""#,
+    r#"git commit -m "vssad%x%min delete shadows /all""#,
+    r"%LOGGER% rmmod nvidia",
+    r"vssad^!LITERAL^!%EMPTY%min delete shadows /all",
+    r"run_%ENV%.exe /s",
+    r"deploy_%ENV%.cmd /s",
+    r"echo 50% off 20%",
+];
+
+fn dcg_test_verdict(command: &str, dialect: &str) -> serde_json::Value {
+    let scratch = tempfile::tempdir().expect("scratch dir");
+    let home = scratch.path().join("home");
+    std::fs::create_dir_all(&home).expect("isolated home");
+    let config = scratch.path().join("config.toml");
+    std::fs::write(&config, "[her
```

#### Recent Merged Pull Requests:
- **PR #672** (2026-11-23): deps(deps): bump nix from 0.31.4 to 0.32.0 (@dependabot[bot])
- **PR #659** (2026-11-17): deps(deps): bump rusqlite from 0.41.1 to 0.42.0 (@dependabot[bot])
- **PR #658** (2026-11-17): deps(deps): bump the rust-minor-patch group with 3 updates (@dependabot[bot])
- **PR #657** (2026-11-17): ci(deps): bump sigstore/cosign-installer from 4.1.2 to 4.1.3 in the actions group (@dependabot[bot])
- **PR #651** (closed): ci(deps): bump sigstore/cosign-installer from 4.1.2 to 4.1.3 in the actions group (@dependabot[bot])
- **PR #650** (closed): deps(deps): bump flate2 from 1.1.10 to 1.1.11 in the rust-minor-patch group (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## Consequences
- **Positive**: Guarantees modular isolation, deterministic resource reclamation, and clean boundary encapsulation.
- **Negative / Trade-offs**: Requires explicit interface adapters and serialization overhead.
- **Compliance Mandate**: All future subsystem implementations adhering to this pattern must enforce this decision.
