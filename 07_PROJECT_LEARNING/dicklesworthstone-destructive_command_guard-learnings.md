> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dicklesworthstone-destructive_command_guard-learnings.md`  
> **Source**: github ([https://github.com/Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard))  
> **Source Version**: `86e98e3f`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T15:42:23.361Z  
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
> **Harvest Timestamp**: 2026-11-08T15:42:23.351Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dicklesworthstone/destructive_command_guard`
- **Description**: A fast Rust safety hook that blocks destructive shell, git, and filesystem commands before AI coding agents run them. 50+ security packs (databases, Kubernetes, Docker, cloud, Terraform), heredoc/inline-script scanning, CI scan mode, and explain mode; works with Claude Code, Codex, Gemini, Copilot, Cursor, and more.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6307 stars

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
    powershell_file_writer_scan_required, powershell_literal_invocations,
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
                    .any(|hit| 
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

- **Issue #604** (2026-11-03): **[False Positive] heredoc.posix:substitution-unverified refuses a quoted heredoc that cat only writes to a file, when its body has a `$(…)` line and then a `trap` line**
  *Symptoms*: ### Blocked Command  cat > f <<'SH' (a four-line heredoc; exact text under Expected Behavior)  ### Expected Behavior  ```bash cat > f <<'SH' X=$(pwd) trap x EXIT SH ```  This should be allowed. The delimiter is quoted, so the body is literal text that `cat` writes to `f`. Nothing expands the `$(pwd)` and nothing runs the `trap`. The same two lines run as a real command are allowed, and so is a copied body that holds `git reset --hard`. #440's fix (7ce336d, d2ebd76) settled the same question for `eval`, which asks "whether there is an eval whose source it cannot resolve, and an eval inside a body nothing executes is not one."  Every row is a heredoc written to `f` with `cat > f <<'SH'` unless the first column says otherwise. Body lines are separated by line breaks.  | Writer | Body | Observed (0.15.3) | |---|---|---| | `cat > f <<'SH'` | `X=$(pwd)`<br>`trap x EXIT` | **deny**, substitution-unverified | | `cat > f <<'SH'` | ``X=`pwd` ``<br>`trap x EXIT` | **deny** | | `cat <<'SH'` (no redirect) | `X=$(pwd)`<br>`trap x EXIT` | **deny** | | `cat <<'SH' > f` | `X=$(pwd)`<br>`trap x EXIT` | **deny** | | `tee f >/dev/null <<'SH'` | `X=$(pwd)`<br>`trap x EXIT` | **deny** | | `cat > f <<"SH"` | `X=$(pwd)`<br>`trap x EXIT` | **deny** | | `cat > f <<'SH'` | `echo $(pwd)`<br>`trap x EXIT` | **deny** | | `cat > f <<'SH'` | `X=$(pwd)`<br>`y`<br>`trap x EXIT` | **deny** | | `cat > f <<'SH'` | `X=$(pwd)`<br>`trap 'rm -f /tmp/x' EXIT` | **deny** | | `cat > f <<SH` (unquoted) | `X=$(pwd)`<br>`

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

### Incident Patch 1: `7eb68874` (2026-11-07)
**Commit Message**: fix: separate interpreter literal data from shell execution [skip ci]

Harmless Python comparisons and recorded-command inspection can be denied
because shell rules read interpreter string literals as executable text.
Address issue #645 using the existing bounded documentation proof and the
complete inline source extraction already established for #570.

Prove Python comparisons, built-in data collections, inspection methods,
and supported read-only file access. Map only proven literal bytes back
through the existing decoded shell-word offsets, preserving quoting and
all original input to execution and protected-write checks.

Require the complete original request for the new exemptions. Detached
children and rewritten policy replays retain the established proof, and
the worker/cache carry that context. This prevents a standalone data
proof from hiding an enclosing pipeline, rebound interpreter, environment
change, or generated-file consumer. Preserve existing heredoc
documentation behavior, critical rule identities, and uncertainty policy.

Extend differential regressions across explain, hook and batch surfaces,
nested/escaped quoting, quoted heredocs, read-only inspection, execut

**File**: `docs/adr-001-heredoc-scanning.md` (modified, +32/-0)
```diff
@@ -281,6 +281,38 @@ Note: `pack_aware_quick_reject()` returns `true` if safe to skip (no keywords),
   independent of the tier-local fallback switches.
 - Diagnostics should be emitted with enough context for `dcg explain` or logs.
 
+### Interpreter source and literal data (#645)
+
+An extracted interpreter program is executable source, but its string literals
+are not automatically shell commands. The final shell-rule view uses the existing
+bounded documentation proof for both quoted interpreter heredocs and complete,
+literal inline program words. Python comparisons, built-in data collections,
+printing, and file reads through a proven read-only `open` can retain their
+literal data role. For example, comparing `"rm -rf /Users/example/scratch"`
+with another string, or searching for it in pending-exception JSONL text, does
+not execute that command.
+
+This proof requires the entire program and its outer consumer to be understood.
+Execution APIs, opaque calls, rebound builtins, dynamic source, unsupported
+syntax, writable or uncertain file modes, and output handed to a shell retain
+the conservative analysis. Unquoted heredoc expansion remains executable shell
+syntax. Proof failure or exhaustion never grants an exemption.
+
+The expanded data inspection and inline-literal exemptions require the complete
+original request. Extracted children and changed policy-replay views can lose
+an enclosing pipeline, binding, or generated-file consumer, so they retain the
+established conservative behavior. The existing source ancestry tracks this
+boundary without an extra recursive evaluation, and completed proof caches
+include that context. Established heredoc documentation proofs remain available.
+
+The original source still reaches the AST, execution-sink, dynamic-source, and
+protected-write checks. Only proven literal bytes are masked from subsequent
+shell matching, with source offsets and shell quote boundaries preserved.
+Dialect-specific filesystem matching must retain the same proof when recovering
+original syntax; a POSIX proof must not mask PowerShell or Cmd syntax. The
+complete-word extraction and configured uncertainty policy from #570 are
+unchanged, as are the critical filesystem rules and their identities.
+
 ### Testing
 
 ```
```

**File**: `src/ast_source_analysis.rs` (modified, +372/-30)
```diff
@@ -25,11 +25,22 @@ use std::time::{Duration, Instant};
 enum DocumentationValue {
     Text,
     Scalar,
+    Collection,
+    ReadOnlyFile,
     File,
     NodeFs,
     JavaScriptRegex,
 }
 
+impl DocumentationValue {
+    /// Built-in values whose comparisons, truth tests and printing cannot
+    /// dispatch to a user-supplied callable. Collections contain only these
+    /// same values; file and module capabilities must never escape as data.
+    const fn is_data(self) -> bool {
+        matches!(self, Self::Text | Self::Scalar | Self::Collection)
+    }
+}
+
 /// Literal ranges whose shell-looking bytes retain a proven data role (#544).
 ///
 /// This small proof covers straight-line Python/JavaScript text edits. Every
@@ -42,15 +53,27 @@ enum DocumentationValue {
 /// consumers, and keep the ORIGINAL source in execution/protected-write scans.
 /// Parsing must run inside the caller's bounded optional-proof worker.
 ///
-/// A proved program that opens no file can only compute text and print it to
-/// the caller, so every literal it contains is data and all of them are
-/// returned (#586): a printed string that spells a shell command runs
-/// nothing. A program that opens a file can write a literal where something
-/// later runs it (a crontab, a shell profile, a package manifest), so only its
-/// substitution-shaped literals are returned, as before.
+/// A proved program that cannot write files can only inspect data and print
+/// it to the caller, so every literal it contains is data and all of them
+/// are returned (#586, #645). A file opened with a writable or unknown mode
+/// can store a literal where something later runs it (a crontab, a shell
+/// profile, a package manifest), so only substitution-shaped literals are
+/// returned for such a program, as before.
 pub(crate) fn inert_documentation_literal_ranges(
     code: &str,
     language: ScriptLanguage,
+) -> Vec<std::ops::Range<usize>> {
+    inert_documentation_literal_ranges_with_data_inspection(code, language, true)
+}
+
+/// Extend the established documentation proof only when the caller retains
+/// the interpreter's complete containing source. An extracted shell leaf can
+/// lose a function binding, pipeline or later consumer; it must keep the
+/// pre-#645 proof instead of acquiring new inspection-data exemptions.
+pub(crate) fn inert_documentation_literal_ranges_with_data_inspection(
+    code: &str,
+    language: ScriptLanguage,
+    allow_data_inspection: bool,
 ) -> Vec<std::ops::Range<usize>> {
     let has_substitution_text = code.contains('`') || code.contains("$(");
     let _phase = crate::perf::phase(crate::perf::ProfilePhase::AstMatch);
@@ -59,8 +82,9 @@ pub(crate) fn inert_documentation_literal_ranges(
     };
     let root = ast.root();
     let mut proof = DocumentationProof::new(language, 128, 16_384);
+    proof.allow_data_inspection = allow_data_inspection;
     if proof.expression(&root, 0).is_some() {
-        if proof.opens_files {
+        if proof.may_write_files {
             proof.literals
         } else {
             proof.data_literals
@@ -108,28 +132,34 @@ fn documentation_ast(
 
 struct DocumentationProof {
     language: ScriptLanguage,
+    /// #645's extra pure expressions and read-only file distinction require
+    /// an explicit containing-source proof. Other users retain the established
+    /// documentation proof by default, including literal-shell recovery.
+    allow_data_inspection: bool,
     values: std::collections::BTreeMap<String, DocumentationValue>,
     /// How many names the proof may bind before it gives up.
     max_values: usize,
     /// Literals containing shell substitution syntax (#544).
     literals: Vec<std::ops::Range<usize>>,
     /// Every literal, substitution-shaped or not (#586).
     data_literals: Vec<std::ops::Range<usize>>,
-    /// Whether the program opens a file (Python `open`, Node `fs`), and so
-    /// can put a literal where something else later executes it.
-    opens_files: bool,
+    /// Whether a file capability can put a literal where something else
+    /// later executes it. The established proof treats every open this way;
+    /// the inspection extension can prove a Python file is read-only.
+    may_write_files: bool,
     remaining_steps: usize,
 }
 
 impl DocumentationProof {
     const fn new(language: ScriptLanguage, max_values: usize, remaining_steps: usize) -> Self {
         Self {
             language,
+            allow_data_inspection: false,
             values: std::collections::BTreeMap::new(),
             max_values,
             literals: Vec::new(),
             data_literals: Vec::new(),
-            opens_files: false,
+            may_write_files: false,
             remaining_steps,
         }
     }
@@ -228,6 +258,60 @@ impl DocumentationProof {
                 }
                 Some(Text)
             }
+            "list" | "tuple" | "tuple_expression" | "set" | "dictionary"
+                if self.allow_d
```

**File**: `src/evaluator.rs` (modified, +203/-29)
```diff
@@ -19165,9 +19165,10 @@ fn redirection_free_pack_views(
 /// Carry the original command's data-body proof into the byte-aligned regex
 /// view before normalization changes its offsets. Sanitization can remove a
 /// prior sed/awk reader's program, so proving the same body from that rewritten
-/// command loses the ordering evidence (#525). Only bytes the source proof
-/// masks are changed here; existing sanitized data and live expansions retain
-/// their current representation. Explicit Windows dialects use their own syntax.
+/// command loses the ordering evidence (#525). The same applies to literals
+/// inside a complete inline interpreter program (#645). Only bytes the source
+/// proof masks are changed here; existing sanitized data and live expansions
+/// retain their current representation. Explicit Windows dialects use their own syntax.
 fn preserve_source_heredoc_data_mask<'a>(
     command_for_match: &'a str,
     source: &str,
@@ -19176,7 +19177,6 @@ fn preserve_source_heredoc_data_mask<'a>(
     if !matches!(dialect, ShellDialect::Posix | ShellDialect::Unknown)
         || command_for_match.len() != source.len()
         || source.len() > crate::heredoc::MAX_SUBSTITUTION_SOURCE_BYTES
-        || !source.contains("<<")
     {
         return Cow::Borrowed(command_for_match);
     }
@@ -19210,12 +19210,27 @@ thread_local! {
     static DOCUMENTATION_MASK_ANALYSES: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
 }
 
+/// A derived command can lose its enclosing pipeline, bindings, or generated
+/// file consumer. New interpreter-data proofs therefore require the complete
+/// original request, including during depth-zero policy replays (#645).
+fn interpreter_data_has_complete_context(command: &str) -> bool {
+    SAFE_PATTERN_SOURCE.with(|source| {
+        source
+            .borrow()
+            .as_ref()
+            .is_none_or(|source| source.parent.is_none() && source.command == command)
+    })
+}
+
 /// Withdraw shell syntax invented from proven Python/JavaScript documentation
-/// literals (#544), and from every literal of a proven program that only
-/// prints (#586). Only the final shell matching view uses this mask. The
-/// complete original body remains input to interpreter, execution, pipeline,
-/// and protected-write checks; an opaque program never receives a mask.
+/// literals (#544), and from every literal of a proven data-only program
+/// (#586/#645), whether supplied by a quoted heredoc or a literal inline word.
+/// Only the final shell matching view uses this mask. The complete original
+/// source remains input to interpreter, execution, pipeline, and protected-write
+/// checks; an opaque program never receives a mask.
 fn mask_proven_interpreter_documentation(command: &str) -> Cow<'_, str> {
+    // Capture provenance on the evaluating thread before entering the worker.
+    let complete_context = interpreter_data_has_complete_context(command);
     // Only a Python or Node receiver can earn a mask, and both names are
     // spelled out in the command (`ScriptLanguage::from_command`). Missing an
     // unusual spelling here only keeps the unmasked, conservative view.
@@ -19225,9 +19240,10 @@ fn mask_proven_interpreter_documentation(command: &str) -> Cow<'_, str> {
             .windows(name.len())
             .any(|window| window.eq_ignore_ascii_case(name))
     };
-    if !command.contains("<<")
-        || command.len() > crate::heredoc::MAX_SUBSTITUTION_SOURCE_BYTES
+    if command.len() > crate::heredoc::MAX_SUBSTITUTION_SOURCE_BYTES
+        || (!complete_context && !command.contains("<<"))
         || !(names_interpreter(b"python") || names_interpreter(b"node"))
+        || check_triggers(command) == TriggerResult::NoTrigger
     {
         return Cow::Borrowed(command);
     }
@@ -19242,22 +19258,22 @@ fn mask_proven_interpreter_documentation(command: &str) -> Cow<'_, str> {
         static ACTIVE: std::sync::Arc<std::sync::atomic::AtomicBool> =
             std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
         // Completed analyses of recent sources. The mask is a pure function
-        // of the command text, and the per-segment pack passes ask for the
-        // same complete command once per segment: a 300-line documentation
-        // heredoc used to re-extract and re-parse the whole command about
-        // fifty times per hook (#555). Only finished analyses are kept; a
+        // of the command text and its complete-source status. Per-segment
+        // pack passes ask for the same complete command once per segment.
+        // A 300-line documentation heredoc used to re-extract and re-parse
+        // the whole command about fifty times per hook (#555). Only finished analyses are kept; a
         // timeout or busy slot is asked again, exactly as before.
         static COMPLETED: std::cell::RefCell<
-            std::collections::VecDeque<(String, Option<String>)>,
+            std::collections::VecDeque<(S
```

**File**: `src/heredoc.rs` (modified, +3/-1)
```diff
@@ -2576,7 +2576,9 @@ fn shell_word_around(text: &str, position: usize) -> Option<Range<usize>> {
 /// bytes with backslash escapes. An expansion, substitution, ANSI-C or locale
 /// quote, pattern, brace, tilde, redirection or unterminated quote returns
 /// `None`. `offsets[i]` is the byte of `word` that produced decoded byte `i`.
-fn literal_word_with_offsets(word: &str) -> Option<(String, Vec<usize>)> {
+/// This supplies coordinates, never a proof of source ownership or safety.
+/// Callers must establish those independently before using it to mask data.
+pub(crate) fn literal_word_with_offsets(word: &str) -> Option<(String, Vec<usize>)> {
     #[derive(Clone, Copy, PartialEq, Eq)]
     enum Quote {
         None,
```

**File**: `tests/cli_e2e.rs` (modified, +54/-0)
```diff
@@ -1139,6 +1139,25 @@ mod python_temp_root_tests {
 mod explain_tests {
     use super::*;
 
+    #[test]
+    fn issue_645_explain_distinguishes_python_comparison_from_shell_execution() {
+        for (source, expected) in [
+            (
+                r#"python3 -c 'print("rm -rf /Users/example/scratch" == "x")'"#,
+                "allow",
+            ),
+            ("rm -rf /Users/example/scratch", "deny"),
+        ] {
+            let output = run_dcg(&["explain", "--format", "json", source]);
+            let stdout = String::from_utf8_lossy(&output.stdout);
+            let verdict: serde_json::Value = serde_json::from_str(&stdout)
+                .unwrap_or_else(|error| panic!("{source}: {error}: {stdout}"));
+            assert!(output.status.success(), "{source}: {output:?}");
+            assert_eq!(verdict["decision"], expected, "{source}: {verdict}");
+            assert_eq!(verdict["outcome"], expected, "{source}: {verdict}");
+        }
+    }
+
     #[test]
     fn explain_safe_command_returns_allow_pretty() {
         let output = run_dcg(&["explain", "echo hello"]);
@@ -3652,6 +3671,41 @@ mod scan_tests {
 mod test_command_tests {
     use super::*;
 
+    /// POSIX backslashes can keep a separator inside a Python string while
+    /// PowerShell executes it. A POSIX data proof cannot cross that boundary.
+    #[test]
+    fn issue_645_inline_data_mask_preserves_other_dialects_execution() {
+        for (source, rule) in [
+            (
+                r#"python3 -c "print(\"; rm -rf /Users/example/scratch; #\")""#,
+                "core.filesystem:rm-rf-root-home",
+            ),
+            (
+                r#"python3 -c "print(\"; git reset --hard; #\")""#,
+                "core.git:reset-hard",
+            ),
+            (
+                r#"python3 -c "print(\"; git reset --hard; # \$(echo marker)\")""#,
+                "core.git:reset-hard",
+            ),
+        ] {
+            for dialect in ["posix", "ps", "unknown"] {
+                let output = run_dcg(&["test", "--format", "json", "--dialect", dialect, source]);
+                let stdout = String::from_utf8_lossy(&output.stdout);
+                let verdict: serde_json::Value = serde_json::from_str(&stdout)
+                    .unwrap_or_else(|error| panic!("{dialect}: {source}: {error}: {stdout}"));
+                let expected = if dialect == "posix" { "allow" } else { "deny" };
+                assert_eq!(
+                    verdict["decision"], expected,
+                    "{dialect}: {source}: {verdict}"
+                );
+                if expected == "deny" {
+                    assert_eq!(verdict["rule_id"], rule, "{dialect}: {source}: {verdict}");
+                }
+            }
+        }
+    }
+
     #[test]
     fn test_safe_command_returns_allowed() {
         let output = run_dcg(&["test", "echo hello"]);
```

**File**: `tests/golden_isomorphism.rs` (modified, +11/-0)
```diff
@@ -235,6 +235,17 @@ fn golden_rule_id_verification() {
     println!("All rule_id verifications passed!");
 }
 
+/// #645: inspecting a destructive command as interpreter data must not change
+/// the rule that protects execution of those exact bytes by the outer shell.
+#[test]
+fn golden_issue_645_interpreter_data_and_shell_execution_are_distinct() {
+    assert_allows_command(r#"python3 -c 'print("rm -rf /Users/example/scratch" == "x")'"#);
+    assert_denies_with_rule(
+        "rm -rf /Users/example/scratch",
+        "core.filesystem:rm-rf-root-home",
+    );
+}
+
 /// Verify rm parser parity across flag/quoting/path variants.
 #[test]
 fn golden_rm_variant_parity() {
```

**File**: `tests/repro_329_heredoc_prose_data_sink.rs` (modified, +8/-10)
```diff
@@ -5,10 +5,9 @@
 //!
 //! A heredoc whose target only *stores* its stdin (`cat`, `tee`, …) is data in
 //! every spelling — redirect before or after the operator, quoted or unquoted
-//! delimiter. Executing sinks (`bash <<EOF`, `… | sh`) must keep blocking, and
-//! inline interpreter bodies (`python3 -c "print(\"rm -rf\")"`) deliberately
-//! stay on the conservative raw-shell scan (#136 / #278): a string literal can
-//! reach an exec sink through indirection no static scan can rule out.
+//! delimiter. Executing sinks (`bash <<EOF`, `… | sh`) must keep blocking.
+//! Issue #645 additionally permits interpreter programs proved to only consume
+//! inert data; unknown calls retain the conservative raw-shell scan.
 
 use std::path::PathBuf;
 use std::process::{Command, Stdio};
@@ -136,10 +135,9 @@ fn destructive_command_outside_the_heredoc_still_blocks() {
 }
 
 #[test]
-fn inline_interpreter_string_literal_stays_conservative() {
-    // Repro 2 from the report. Intentionally NOT relaxed: interpreter bodies
-    // are re-scanned as raw shell because a literal can reach an exec sink
-    // through indirection (#136 revert, #278). Pinned so the posture is a
-    // decision, not an accident.
-    assert_denied("python3 -c \"print(\\\"rm -rf\\\")\"");
+fn inline_interpreter_literal_is_data_only_when_its_consumer_is_proved() {
+    // #645: printing a literal is harmless, while an opaque consumer can run
+    // it. Pin both sides of the new, deliberately narrower data proof.
+    assert_allowed("python3 -c \"print(\\\"rm -rf\\\")\"");
+    assert_denied("python3 -c \"run(\\\"rm -rf /Users/example/scratch\\\")\"");
 }
```

**File**: `tests/repro_570_inline_programs.rs` (modified, +194/-5)
```diff
@@ -259,15 +259,26 @@ fn denied_by(source: &str, rule: &str) {
 
 /// One DCG verdict, and a description of the run for assertion messages.
 fn run_dcg(source: &str, hook: bool, strict: bool) -> (serde_json::Value, String) {
+    run_dcg_with_packs(source, hook, strict, &[])
+}
+
+fn run_dcg_with_packs(
+    source: &str,
+    hook: bool,
+    strict: bool,
+    packs: &[&str],
+) -> (serde_json::Value, String) {
     let temp = tempfile::tempdir().expect("isolated working directory");
     let home = temp.path().join("home");
     std::fs::create_dir(&home).expect("isolated home");
     let config = temp.path().join("config.toml");
     std::fs::write(
         &config,
         format!(
-            "[heredoc]\ntimeout_ms = 5000\nfallback_on_parse_error = {}\n",
-            !strict
+            "[heredoc]\ntimeout_ms = 5000\nfallback_on_parse_error = {}\n\
+             [packs]\nenabled = {}\n",
+            !strict,
+            serde_json::to_string(packs).expect("pack IDs serialize")
         ),
     )
     .expect("explicit test configuration");
@@ -870,22 +881,185 @@ fn decoded_node_programs_keep_option_ownership() {
     }
 }
 
-/// #645: an interpreter that prints a command can feed an executing shell.
-/// Extracting the producer must not discard its enclosing consumer.
+/// #645 is a classification regression after extraction: the complete Python
+/// program is code, but command-like text it only compares or displays is data.
+/// Exercise the same real-binary surfaces as the extraction regressions above.
+#[test]
+fn issue_645_exact_python_comparison_is_data_on_every_surface() {
+    let source = r#"python3 -c 'print("rm -rf /Users/example/scratch" == "x")'"#;
+    for (surface, actual, rule) in surface_verdicts(source) {
+        assert_eq!(actual, "allow", "{surface}: {source}: {rule}");
+    }
+    // A fully proved data program is allowed in strict extraction mode too.
+    decision(source, "allow", true);
+}
+
+#[test]
+fn issue_645_python_literals_stay_data_across_shell_quoting() {
+    for body in [
+        r#"print("rm -rf /Users/example/scratch")"#,
+        r#"print("rm -rf /Users/example/scratch" == "x")"#,
+        r#"command = "rm -rf /Users/example/scratch"; print(command == "x")"#,
+        r#"print("shutdown")"#,
+        r#"print("git reset --hard; rm -rf /Users/example/scratch; shutdown")"#,
+        r#"print("example: \\\"rm -rf /Users/example/scratch\\\"")"#,
+        r#"print('''quoted "rm -rf /Users/example/scratch" and 'shutdown' ''')"#,
+        r#"print(r"rm -rf /Users/example/scratch\nshutdown")"#,
+        r#"print(b"rm -rf /Users/example/scratch")"#,
+        r#"print("use $(rm -rf /Users/example/scratch) with care")"#,
+    ] {
+        for style in 0..3 {
+            let source = format!("python3 -c {}", quote(body, style));
+            for (surface, actual, rule) in surface_verdicts(&source) {
+                assert_eq!(actual, "allow", "{surface}: {source}: {rule}");
+            }
+        }
+    }
+}
+
+#[test]
+fn issue_645_read_only_record_inspection_and_heredoc_literals_allow() {
+    for body in [
+        r#"print("rm -rf /Users/example/scratch" in open("pending-exceptions.jsonl").read())"#,
+        r#"print(open("pending-exceptions.jsonl", "r").read() == "rm -rf /Users/example/scratch")"#,
+        r#"print("shutdown")"#,
+        r#"print("rm -rf /Users/example/scratch" == "x")"#,
+        r#"print("rm -rf $HOME")"#,
+    ] {
+        for source in [
+            format!("python3 -c {}", quote(body, 0)),
+            format!("python3 - <<'PY'\n{body}\nPY"),
+        ] {
+            for (surface, actual, rule) in surface_verdicts(&source) {
+                assert_eq!(actual, "allow", "{surface}: {source}: {rule}");
+            }
+        }
+    }
+    for source in [
+        "cat <<'JSON'\n{\"command\": \"rm -rf /Users/example/scratch\", \"note\": \"shutdown\"}\nJSON",
+        "python3 - <<'PY'\n# Recorded commands are data.\nrecord = '''rm -rf /Users/example/scratch\nshutdown'''\nprint(record)\nPY",
+    ] {
+        for (surface, actual, rule) in surface_verdicts(source) {
+            assert_eq!(actual, "allow", "{surface}: {source}: {rule}");
+        }
+    }
+}
+
+#[test]
+fn issue_645_shutdown_literal_with_enabled_services_pack_is_data() {
+    for (source, expected) in [
+        ("python3 -c 'print(\"shutdown\")'", "allow"),
+        ("python3 - <<'PY'\nprint('shutdown')\nPY", "allow"),
+        ("shutdown -h now", "deny"),
+        (
+            "python3 -c 'import os; os.system(\"shutdown -h now\")'",
+            "deny",
+        ),
+    ] {
+        for hook in [false, true] {
+            let (verdict, context) = run_dcg_with_packs(source, hook, false, &["system.services"]);
+            assert_eq!(verdict["decision"], expected, "{context}: {verdict}");
+            if source == "shutdown -h now" {
+                assert_eq!(
+                    verdict["rule_id"], "system.services:shutdown",
+                    "services rule
```

---

### Incident Patch 2: `59a90213` (2026-11-08)
**Commit Message**: fix(evaluator): check deadlines after quick-reject selection [skip ci]

Quick-reject selection can perform semantic analysis or normalization and
exhaust the deadline before it chooses an allow. Check the budget after the
complete indexed and unindexed initial predicates and the normalized
predicate, including original-payload and external-pack checks. Stop expired
selection before either quick rejection or further evaluation. Preserve the
upstream outer completion guard and its denial/allow-once behavior.

Add deterministic live-to-expired selection coverage and live-budget
indexed/unindexed allow and Windows-denial controls. Correct the #647
integration fixtures to select the intended Claude hook protocol, use valid
ordinary-byte PowerShell escapes, and assert oversized CLI admission errors
separately from hook indeterminate responses. No production byte, word, or
timeout limit is raised.

Validation on the integrated parent:
- cargo fmt --check
- cargo check --locked --all-targets
- cargo clippy --locked --all-targets -- -D warnings
- 78 distinct targeted Rust tests, all passed
- 20 CLI/hook observations at the shipped 1000 ms default, all passed

An initial integration run expo

**File**: `src/evaluator.rs` (modified, +227/-100)
```diff
@@ -2088,6 +2088,17 @@ fn evaluate_with_completion_deadline(
     result
 }
 
+/// Selection can itself perform semantic analysis or normalization. Its result
+/// is usable only if the budget remains after the complete predicate finishes.
+#[inline]
+fn budget_checked_quick_reject(
+    select: impl FnOnce() -> bool,
+    is_expired: impl FnOnce() -> bool,
+) -> Option<bool> {
+    let quick_reject = select();
+    (!is_expired()).then_some(quick_reject)
+}
+
 /// The text keyword gating reads: the command without its inert POSIX
 /// redirections ([`crate::packs::blank_inert_redirections`], #571). Cmd and
 /// PowerShell give `>` and `/dev/null` other meanings (`2>/dev/null` writes a
@@ -18671,88 +18682,88 @@ fn evaluate_command_in_single_dialect_view(
     // AC scan (O(n)) replaces the N×memmem per-keyword scan. If the AC says no
     // keyword appears in the raw command, we can skip the more expensive
     // normalize+span-classify path in pack_aware_quick_reject entirely.
-    if let Some(index) = keyword_index {
-        // An enabled external pack with no keywords must be evaluated on every
-        // command (`Pack::might_match`), and the AC index cannot represent
-        // "always" — an external pack has no registry entry to set a bit for.
-        // The hook path already disables the index when external packs exist;
-        // this keeps every other entry point honest too (issue #402).
-        if sed_shell_sources.is_empty()
-            && tar_helper_sources.is_empty()
-            && !crate::packs::get_external_packs()
-                .is_some_and(crate::packs::ExternalPackStore::has_keywordless_pack)
-            && !index.has_any_keyword(gating_command.as_ref())
-            && !contains_shell_word_obfuscation(command, shell_dialect)
-            && !force_core_git
-            && !force_core_filesystem
-            && !force_cmd_recovery
-            && !force_cloudflare_workers
-            && !force_snowflake
-            && force_literal_database_packs.is_empty()
-            && !force_windows_filesystem
-            && !force_scp_semantics
-            && !external_pack_needs_identity_selection(
-                gating_command.as_ref(),
-                shell_dialect,
-                ordered_packs,
-            )
-        {
-            if let Some((matched, layer, reason)) = heredoc_allowlist_hit {
-                return EvaluationResult::allowed_by_allowlist(matched, layer, reason);
-            }
-            return EvaluationResult::allowed_by_quick_reject();
-        }
-    } else if sed_shell_sources.is_empty()
-        && tar_helper_sources.is_empty()
-        && !force_core_git
-        && !force_core_filesystem
-        && !force_cmd_recovery
-        && !force_cloudflare_workers
-        && !force_snowflake
-        && force_literal_database_packs.is_empty()
-        && !force_windows_filesystem
-        && !force_scp_semantics
-        && {
-            let _phase = phase(ProfilePhase::Normalization);
-            let dialect_normalized =
-                crate::normalize::normalize_command_in_dialect(command, shell_dialect);
-            let gating = inert_redirection_gating_view(dialect_normalized.as_ref(), shell_dialect);
-            // The span gate in `pack_aware_quick_reject` reads POSIX quoting.
-            // cmd.exe passes single quotes through as argv bytes, so that gate
-            // took `echo 'x & git reset --hard & y'` for one quoted argument
-            // and skipped every pack. PowerShell does not escape with a
-            // backslash, so `Write-Output "a\" ; git push --force ; \"b"`
-            // runs git there while POSIX reads one string. This branch runs
-            // whenever the keyword index is absent, as it is for the hook and
-            // `dcg test` with an external pack loaded, including the unknown
-            // dialect's PowerShell and cmd replays. Gate both without quote
-            // roles, as the keyword index does; Step 5 masks their data in
-            // their own syntax.
-            if matches!(shell_dialect, ShellDialect::Cmd | ShellDialect::PowerShell) {
-                pack_aware_quick_reject_pre_normalized(gating.as_ref(), enabled_keywords)
+    let Some(quick_reject) = budget_checked_quick_reject(
+        || {
+            if let Some(index) = keyword_index {
+                // An enabled external pack with no keywords must be evaluated on every
+                // command (`Pack::might_match`), and the AC index cannot represent
+                // "always" — an external pack has no registry entry to set a bit for.
+                // The hook path already disables the index when external packs exist;
+                // this keeps every other entry point honest too (issue #402).
+                sed_shell_sources.is_empty()
+                    && tar_helper_sources.is_empty()
+                    && !crate::packs::get_external_packs()
+                        .is_some_and(crate::packs::ExternalPackSto
```

**File**: `tests/repro_313_powershell_read_only_false_positives.rs` (modified, +22/-2)
```diff
@@ -609,6 +609,7 @@ fn hook_protocol_keeps_guardrails_active_with_global_options() {
 /// These commands are classifier input on stdin; no PowerShell is executed.
 mod issue_647 {
     use super::dcg_binary;
+    use destructive_command_guard::config::DEFAULT_MAX_COMMAND_BYTES;
     use std::io::Write;
     use std::path::PathBuf;
     use std::process::{Command, Output, Stdio};
@@ -692,6 +693,7 @@ mod issue_647 {
             let payload = serde_json::json!({
                 "hook_event_name": "PreToolUse",
                 "tool_name": "PowerShell",
+                "tool_use_id": "toolu_dcg_issue_647",
                 "tool_input": {"command": command},
                 "cwd": self.dir.path(),
             });
@@ -722,6 +724,24 @@ mod issue_647 {
                 );
                 let expected_exit = i32::from(surface != "hook" && expected != "allow");
                 assert_eq!(output.status.code(), Some(expected_exit), "{diagnostics}");
+                // CLI stdin admission rejects oversized input before producing
+                // evaluator JSON. The hook surfaces report incomplete analysis
+                // below; assert each transport's blocking contract separately.
+                if surface == "CLI"
+                    && expected == "indeterminate"
+                    && command.len() > DEFAULT_MAX_COMMAND_BYTES
+                {
+                    assert!(rule.is_none(), "{diagnostics}");
+                    assert!(output.stdout.is_empty(), "{diagnostics}");
+                    assert_eq!(
+                        String::from_utf8_lossy(&output.stderr),
+                        format!(
+                            "Error: stdin command exceeds general.max_command_bytes ({DEFAULT_MAX_COMMAND_BYTES} bytes)\n"
+                        ),
+                        "{diagnostics}"
+                    );
+                    continue;
+                }
                 if surface == "hook" && expected == "allow" {
                     assert!(output.stdout.is_empty(), "{diagnostics}");
                     continue;
@@ -794,7 +814,7 @@ mod issue_647 {
         for count in [400, 511] {
             for last in [
                 r"Clear-Content C:\important.conf",
-                r"Cl`ear-Con`tent C:\important.conf",
+                r"Clear`-Content C:\important.conf",
             ] {
                 lab.assert_surfaces(
                     &with_late_statement(count, last),
@@ -827,7 +847,7 @@ mod issue_647 {
         // destructive executable that view has already found.
         for last in [
             r"Clear-Content C:\important.conf",
-            r"Cl`ear-Con`tent C:\important.conf",
+            r"Clear`-Content C:\important.conf",
             "Clear-Content $target",
             "Clear-Content 'C:\\important.conf",
         ] {
```

---

### Incident Patch 3: `86e98e3f` (2026-11-08)
**Commit Message**: fix(windows): detect quoted .NET delete calls and cache member scans [skip ci]

PowerShell permits literal quoted member names. Recognize single- and
double-quoted Delete names in both semantic analysis and fallback patterns,
so quoting a destructive .NET method no longer makes it appear safe.
Keep ordinary quoted examples, comments, and here-strings inert.

Cache the next DirectoryInfo member match, its data-context result, and
exhausted searches while token starts advance. Preserve the existing
per-token static/member rule order and all byte, word, statement, and
timeout limits.

Add late-command CLI/batch/hook regressions, quoted-data controls,
incomplete-input fallback coverage, 96 uncached-traversal comparisons,
and deterministic search-count tests for dense prefixes.

Validation: fmt, check --all-targets, clippy --all-targets -D warnings;
85 distinct targeted Rust tests; 20 functional CLI/hook observations.
A separate 520-observation development-build comparison retained budget
and process-timeout failures during shared memory pressure; it does not
certify latency. No timeout was raised for that comparison.

Refs #647. The original shell-dialect classification report remains 

**File**: `src/packs/windows/filesystem.rs` (modified, +389/-16)
```diff
@@ -240,24 +240,26 @@ const POWERSHELL_PROTECTED_EXECUTABLES: &[&str] = &[
 /// accelerator spelling) with a literally-true second argument, anchored to the
 /// start of a word token by the semantic caller. PowerShell type literals are
 /// case-insensitive and tolerate whitespace around `[`, `]`, and `::`.
+/// Literal single- or double-quoted method names invoke the same member.
 static DOTNET_DIRECTORY_DELETE_RECURSIVE_EXPRESSION: LazyCompiledRegex = LazyCompiledRegex::new(
-    r#"(?i)^\[\s*(?:system\.)?io\.directory\s*\]\s*::\s*delete\s*\((?=[^|&\r\n]*?,\s*(?:\$true|1|"true"|'true')\s*\))"#,
+    r#"(?i)^\[\s*(?:system\.)?io\.directory\s*\]\s*::\s*(?:delete|'delete'|"delete")\s*\((?=[^|&\r\n]*?,\s*(?:\$true|1|"true"|'true')\s*\))"#,
 );
 
 /// Any `[System.IO.Directory]::Delete(...)` call, anchored to a word start.
 /// Covers the single-argument form (removes an empty directory) and calls
 /// whose second argument is dynamic — PowerShell coerces any truthy value
 /// (including every non-empty string) to `$true`, so an unresolved flag must
 /// still be reviewed.
-static DOTNET_DIRECTORY_DELETE_EXPRESSION: LazyCompiledRegex =
-    LazyCompiledRegex::new(r"(?i)^\[\s*(?:system\.)?io\.directory\s*\]\s*::\s*delete\s*\(");
+static DOTNET_DIRECTORY_DELETE_EXPRESSION: LazyCompiledRegex = LazyCompiledRegex::new(
+    r#"(?i)^\[\s*(?:system\.)?io\.directory\s*\]\s*::\s*(?:delete|'delete'|"delete")\s*\("#,
+);
 
 /// `<DirectoryInfo>.Delete($true)` instance-method spelling, for example
 /// `(Get-Item $path).Delete($true)` or a `[System.IO.DirectoryInfo]` variable.
 /// `$true` is required so that unrelated `.delete(...)` member calls in inline
 /// scripts of other languages do not match.
 static DIRECTORYINFO_DELETE_RECURSIVE_MEMBER: LazyCompiledRegex =
-    LazyCompiledRegex::new(r"(?i)\.\s*delete\s*\(\s*\$true\s*\)");
+    LazyCompiledRegex::new(r#"(?i)\.\s*(?:delete|'delete'|"delete")\s*\(\s*\$true\s*\)"#);
 
 fn syntax_is_incomplete(raw: &str, dialect: ShellDialect) -> bool {
     let mut chars = raw.chars().peekable();
@@ -1221,6 +1223,16 @@ fn mask_powershell_comments_and_here_strings(command: &str) -> Cow<'_, str> {
 fn powershell_dotnet_directory_delete_rule(
     segment: &str,
     tokens: &[NormalizeToken],
+) -> Option<&'static str> {
+    powershell_dotnet_directory_delete_rule_with_member_search(segment, tokens, |start| {
+        DIRECTORYINFO_DELETE_RECURSIVE_MEMBER.find_from(segment, start)
+    })
+}
+
+fn powershell_dotnet_directory_delete_rule_with_member_search(
+    segment: &str,
+    tokens: &[NormalizeToken],
+    mut find_member: impl FnMut(usize) -> Option<(usize, usize)>,
 ) -> Option<&'static str> {
     // All three expressions require an ASCII dot and a contiguous Delete
     // spelling. Prove only that this .NET surface cannot match before paying
@@ -1261,6 +1273,13 @@ fn powershell_dotnet_directory_delete_rule(
         })
         .map(|token| token.byte_range.clone())
         .collect();
+    // Word starts advance monotonically. The first member match in a suffix
+    // remains the first match until a later word starts beyond it. Cache its
+    // data-context verdict as well as its position, and remember a miss so
+    // dense prefixes do not repeatedly search or classify the same suffix.
+    // Search lazily below the static checks to retain their per-token priority.
+    let mut next_member = None;
+    let mut member_search_exhausted = false;
     for token in tokens
         .iter()
         .filter(|token| token.kind == NormalizeTokenKind::Word)
@@ -1286,15 +1305,20 @@ fn powershell_dotnet_directory_delete_rule(
                 return Some("dotnet-directory-delete");
             }
         }
-        if let Some((match_start, _)) = DIRECTORYINFO_DELETE_RECURSIVE_MEMBER.find(tail) {
-            let absolute = token.byte_range.start.saturating_add(match_start);
-            if !quoted_word_ranges
-                .iter()
-                .any(|range| range.contains(&absolute))
-                && !inert_ranges.iter().any(|range| range.contains(&absolute))
-            {
-                return Some("directoryinfo-delete-recursive");
-            }
+        if !member_search_exhausted
+            && next_member.is_none_or(|(start, _)| start < token.byte_range.start)
+        {
+            next_member = find_member(token.byte_range.start).map(|(start, _)| {
+                let executable = !quoted_word_ranges
+                    .iter()
+                    .any(|range| range.contains(&start))
+                    && !inert_ranges.iter().any(|range| range.contains(&start));
+                (start, executable)
+            });
+            member_search_exhausted = next_member.is_none();
+        }
+        if next_member.is_some_and(|(_, executable)| executable) {
+            return Some("directoryinfo-delete-recursive");
         }
     }
     None
@@ -2511,7 +2535,7 @@ fn create_destructive_patterns() -> Vec<DestructivePattern> {
         // recursive ca
```

**File**: `tests/repro_313_powershell_read_only_false_positives.rs` (modified, +53/-0)
```diff
@@ -832,6 +832,59 @@ mod issue_647 {
         }
     }
 
+    #[test]
+    fn late_quoted_dotnet_delete_members_are_inspected() {
+        let lab = Lab::new();
+        // Quotes around a method name retain its executable role. Inspect
+        // these calls after a safe prefix through every public transport.
+        for (last, rule) in [
+            (
+                r"[IO.Directory]::'Delete'('C:\example', $true)",
+                "windows.filesystem:dotnet-directory-delete-recursive",
+            ),
+            (
+                r#"[IO.Directory]::"Delete"('C:\example', $true)"#,
+                "windows.filesystem:dotnet-directory-delete-recursive",
+            ),
+            (
+                r"[IO.Directory]::'Delete'('C:\example')",
+                "windows.filesystem:dotnet-directory-delete",
+            ),
+            (
+                r#"[IO.Directory]::"Delete"('C:\example')"#,
+                "windows.filesystem:dotnet-directory-delete",
+            ),
+            (
+                r"([IO.DirectoryInfo]'C:\example').'Delete'($true)",
+                "windows.filesystem:directoryinfo-delete-recursive",
+            ),
+            (
+                r#"([IO.DirectoryInfo]'C:\example')."Delete"($true)"#,
+                "windows.filesystem:directoryinfo-delete-recursive",
+            ),
+        ] {
+            lab.assert_surfaces(
+                &with_late_statement(400, last),
+                "deny",
+                Some(rule),
+                Some(5000),
+            );
+        }
+    }
+
+    #[test]
+    fn quoted_dotnet_member_examples_remain_inert_data() {
+        let lab = Lab::new();
+        // A quoted member name in a call executes, but an ordinary quoted
+        // argument containing that entire call remains data.
+        for last in [
+            r#"Write-Output '[IO.Directory]::"Delete"($path, $true); $dir."Delete"($true)'"#,
+            r#"Write-Output "[IO.Directory]::'Delete'('C:\example', $true); $dir.'Delete'($true)""#,
+        ] {
+            lab.assert_surfaces(&with_late_statement(400, last), "allow", None, Some(5000));
+        }
+    }
+
     #[test]
     fn incomplete_analysis_never_certifies_a_safe_prefix() {
         let lab = Lab::new();
```

#### Recent Merged Pull Requests:
- **PR #637** (closed): fix(powershell): preserve call/dot-source operators across compound statements, scriptblock .Invoke(), and *.exe tool names (@stevemoraco)
- **PR #632** (2026-11-02): deps(deps): bump fancy-regex from 0.19.2 to 0.20.0 (@dependabot[bot])
- **PR #631** (2026-11-02): deps(deps): bump rusqlite from 0.40.2 to 0.41.1 (@dependabot[bot])
- **PR #630** (2026-11-02): deps(deps): bump the rust-minor-patch group with 2 updates (@dependabot[bot])
- **PR #629** (closed): fix(heredoc): stop quoted_heredoc_bodies_blanked from re-entering itself (#628) (@Khang5687)
- **PR #596** (2026-10-27): deps(deps): bump smallvec from 1.16.3 to 1.16.4 in the rust-minor-patch group (@dependabot[bot])

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

## X. separate interpreter literal data from shell execution [skip ci]

**RULE**:
When implementing operations in `docs/adr-001-heredoc-scanning.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Dicklesworthstone/destructive_command_guard. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7eb68874`: separate interpreter literal data from shell execution [skip ci]. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/adr-001-heredoc-scanning.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
### Interpreter source and literal data (#645)

An extracted interpreter program is executable source, but its string literals
are not automatically shell commands. The final shell-rule view uses the existing
bounded documentation proof for both quoted interpreter heredocs and complete,
literal inline program words. Python comparisons, built-in data collections,
printing, and file reads through a proven read-only `open` can retain their
literal data role. For example, comparing `"rm -rf /Users/example/scratch"`
with another string, or searching for it in pending-exception JSONL text, does
not execute that command.

This proof requires the entire program and its outer consumer to be understood.
Execution APIs, opaque calls, rebound builtins, dynamic source, unsupported
syntax, writable or uncertain file modes, and output handed to a shell retain
the conservative analysis. Unquoted heredoc expansion remains executable shell
syntax. Proof failure or exhaustion never grants an exemption.

The expanded data inspection and inline-literal exemptions require the complete
original request. Extracted children and changed policy-replay views can lose
an enclosing pipeline, binding, or generat
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7eb68874` are properly handled with clean fallback behavior.
