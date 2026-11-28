# Domain G — Architecture Intelligence: Architecture Intelligence: dicklesworthstone-destructive_command_guard-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "dicklesworthstone-destructive_command_guard-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T02:41:31.961Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dicklesworthstone-destructive_command_guard-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dicklesworthstone-destructive_command_guard-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T02:41:31.961Z`  
> **Learning ID**: `LEARN-EVO-dicklesworthstone-destructive_command_guard-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), F (Design Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 60%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from dicklesworthstone-destructive_command_guard-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dicklesworthstone-destructive_command_guard-learnings.md`  
> **Source**: github ([https://github.com/Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard))  
> **Source Version**: `990d02a5`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T02:41:13.633Z  
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
> **Harvest Timestamp**: 2026-11-28T02:41:13.426Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dicklesworthstone/destructive_command_guard`
- **Description**: A fast Rust safety hook that blocks destructive shell, git, and filesystem commands before AI coding agents run them. 50+ security packs (databases, Kubernetes, Docker, cloud, Terraform), heredoc/inline-script scanning, CI scan mode, and explain mode; works with Claude Code, Codex, Gemini, Copilot, Cursor, and more.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6382 stars

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
    /// A structural limit or unresolved value prevented a complete analysis.
    /// Retrying with a longer timeout cannot help.
    AnalysisIncomplete {
        language: ScriptLanguage,
        /// Stable operation name used in incomplete-analysis diagnostics.
        stage: &'static str,
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
            Self::AnalysisIncomplete {
                language, detail, ..
            } => {
                write!(f, "AST analysis incomplete for {language:?}: {detail}")
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
    /
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

pub(crate) use embedded::{
    MAX_BYTES as MAX_PROTECTED_SOURCE_BYTES, SourceScanError, scan_extracted, source_scan_required,
};
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
pub(crate) const MAX_BYTES: usize = 256 * 1024;
const MAX_DEPTH: usize = 128;
const MAX_NODES: usize = 40_000;
// A small source can repeatedly double a bound string. Bound folded values
// separately from input bytes so path construction cannot amplify it without
// limit. This is an analysis bound, not a query of the host filesystem.
const MAX_STATIC_PATH_BYTES: usize = 4096;

/// A grammar error can use parse-error fallback. A valid program whose
/// writes we could not inspect must remain unverified.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum SourceScanError {
    Syntax(&'static str),
    Incomplete(&'static str),
}

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
) -> Result<Vec<CredentialFileWrite>, SourceScanError> {
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
    ResolvedPath, SourceScanError, SupportLang, Syntax, record_write,
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

pub(super) fn scan(code: &str) -> Result<Vec<CredentialFileWrite>, SourceScanError> {
    if code.len() > MAX_BYTES {
        return Err(SourceScanError::Incomplete(
            "protected-write Go source exceeds the byte limit",
        ));
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
) -> Result<(), SourceScanError> {
    if depth > MAX_DEPTH || *remaining == 0 || state.values.len() > 1024 {
        return Err(SourceScanError::Incomplete(
            "protected-write Go source exceeds the traversal limit",
        ));
    }
    *remaining -= 1;
    let kind = node.kind();
    if kind == "ERROR" {
        return Err(SourceScanError::Syntax(
            "protected-write Go source contains a syntax error",
        ));
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
) -> Result<(), SourceScanError> {
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
    let target = |index:
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
    OpenFlags, ResolvedPath, SourceScanError, Value, combine_open_flags, concatenate_text,
    record_write, resolved_path,
};
use SourceScanError::{Incomplete, Syntax};
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
fn charge(work: &Cell<usize>) -> Result<(), SourceScanError> {
    let left = work
        .get()
        .checked_sub(1)
        .ok_or(Incomplete("protected-write Perl exceeds the work limit"))?;
    work.set(left);
    Ok(())
}

pub(super) fn scan(code: &str) -> Result<Vec<CredentialFileWrite>, SourceScanError> {
    if code.len() > MAX_BYTES {
        return Err(Incomplete(
            "protected-write Perl source exceeds the byte limit",
        ));
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
            return Err(Incomplete(
                "protected-write Perl source exceeds the binding limit",
            ));
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

### Incident Patch 1: `c4ca6898` (2026-11-27)
**Commit Message**: fix(install): recover ownerless install locks

The mkdir lock treated a lock as stale only when its pid file named a dead
process. A lock with an empty or missing pid file blocked every later run
forever. That happens when `echo $$ > pid` fails on a full disk or spent /tmp
quota, or when a run is killed between mkdir and the write. hz2's nightly
`acfs update` failed xf for 3+ days on a 0-byte pid file from 11-23
("Another installer is running").

- A pid that can't be written releases the lock and stops the run, as ee's
  installer already does.
- An existing lock with no recorded pid is stale once it is more than 10
  minutes old. The age guard keeps a run that has just made its lock dir
  safe.
- A lock held by a live process still blocks.

Verified by extracting the lock block and running 6 cases on macOS (BSD
find/touch) and Linux (GNU): fresh, live owner, dead owner, fresh ownerless,
old ownerless, and old with no pid file. The previous block fails both old
ownerless cases.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `install.sh` (modified, +20/-13)
```diff
@@ -1831,20 +1831,27 @@ install_binary() {
 # Cross-platform locking using mkdir (atomic on all POSIX systems including macOS)
 LOCK_DIR="${LOCK_FILE}.d"
 LOCKED=0
-if mkdir "$LOCK_DIR" 2>/dev/null; then
+# Take the lock and record our pid. A pid that cannot be written (full disk or
+# spent quota) would leave an ownerless lock that blocks every later run, so
+# release it and stop instead.
+take_install_lock() {
+  mkdir "$LOCK_DIR" 2>/dev/null || return 1
   LOCKED=1
-  echo $$ > "$LOCK_DIR/pid"
-else
-  # Check if existing lock is stale (process no longer running)
-  if [ -f "$LOCK_DIR/pid" ]; then
-    OLD_PID=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")
-    if [ -n "$OLD_PID" ] && ! kill -0 "$OLD_PID" 2>/dev/null; then
-      rm -rf "$LOCK_DIR"
-      if mkdir "$LOCK_DIR" 2>/dev/null; then
-        LOCKED=1
-        echo $$ > "$LOCK_DIR/pid"
-      fi
-    fi
+  if ! echo $$ > "$LOCK_DIR/pid" 2>/dev/null; then
+    rm -rf "$LOCK_DIR" 2>/dev/null || true
+    LOCKED=0
+    err "Could not write pid file to $LOCK_DIR (disk full or read-only?)"
+    exit 1
+  fi
+}
+if ! take_install_lock; then
+  # The existing lock is stale if its process is gone, or if it never recorded
+  # a pid (an interrupted or disk-full run) and is more than 10 minutes old.
+  OLD_PID=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")
+  if { [ -n "$OLD_PID" ] && ! kill -0 "$OLD_PID" 2>/dev/null; } \
+    || { [ -z "$OLD_PID" ] && [ -n "$(find "$LOCK_DIR" -maxdepth 0 -mmin +10 2>/dev/null)" ]; }; then
+    rm -rf "$LOCK_DIR"
+    take_install_lock || true
   fi
   if [ "$LOCKED" -eq 0 ]; then
     err "Another installer is running (lock $LOCK_DIR)"
```

---

### Incident Patch 2: `c7ba093f` (2026-11-27)
**Commit Message**: fix(install): write agy hooks as a cmd.exe-runnable path with no shell key (#677) [skip ci]

`dcg install --agy` reused Claude Code's hook object. On Windows that is
`"command": "& '<path>\dcg.exe'"` with `"shell": "powershell"`. agy's
hooks documentation lists only `type`, `command` and `timeout` on a
handler, and both Windows reports show agy running `command` through
cmd.exe and ignoring `shell`. cmd.exe rejects PowerShell's call operator
("& was unexpected at this time."), and since the matcher became
run_command (#652) every shell call in agy failed on Windows.

agy now gets its own handler: the absolute dcg path with no `shell` key.
On Windows the path is written bare (the form two users confirmed works in
agy), or in double quotes when it contains whitespace or one of
& | < > ( ) ^ , ; =. A path with %, " or a control character is refused
with an error instead of being written as a hook cmd.exe would expand or
cannot run. Other platforms keep the POSIX-quoted path. Claude Code's
Windows hook keeps its documented PowerShell form.

Re-running `dcg install --agy` repairs an existing broken entry without
--force: the desired handler differs, `shell` is a dcg-owned key and is
dro

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1229,7 +1229,7 @@ preserves existing hook wiring.
 - **Cursor IDE:** Hooks are configured through `~/.cursor/hooks.json` plus a generated bridge (`dcg-pre-shell.ps1` on Windows). The installer inserts dcg first in `beforeShellExecution`, collapses duplicate dcg entries, and preserves coexisting Cursor hooks. The bridge blocks a command it cannot verify: a payload it cannot read, or a dcg that ran but gave no verdict (killed, timed out, non-zero exit, no answer). Set `DCG_BRIDGE_CRASH_DECISION=allow` to let those through instead; only a dcg that cannot be started at all is allowed, with a notice on stderr. Cursor also runs the `PreToolUse` hooks in `~/.claude/settings.json` for its `Shell` tool, and dcg judges those payloads too.
 - **Hermes Agent:** [NousResearch's Hermes Agent](https://github.com/NousResearch/hermes-agent) declares shell hooks in its `config.yaml` under `hooks.pre_tool_call`. Hermes resolves its data root from `HERMES_HOME` when set, else `%LOCALAPPDATA%\hermes` on native Windows and `~/.hermes` on Linux/macOS — both installers write the hook to that resolved path (`install.ps1` never writes to `%USERPROFILE%\.hermes` unless `HERMES_HOME` points there, since native Windows Hermes would never read it). The installer merges a single `matcher: "terminal"` entry that invokes dcg directly — no wrapper script — because Hermes' input JSON (`hook_event_name: "pre_tool_call"`, `tool_name: "terminal"`, `tool_input.command`) deserializes straight into dcg's existing `HookInput`. Hermes [explicitly documents](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/hooks.md) that "non-zero exit codes... never abort the agent loop", so dcg switches to Hermes' JSON block protocol on output: `{"decision":"block","reason":...}` (plus the alternate `{"action":"block","message":...}` form for cross-version compatibility). The installer also sets `hooks_auto_accept: true` if not already set; Hermes silently drops un-allowlisted hooks in non-TTY runs (gateway/cron) without it. `unconfigure_hermes` in `uninstall.sh` removes only the dcg-owned entry and leaves `hooks_auto_accept` alone (other Hermes hooks may rely on it).
 - **Grok (xAI):** [Grok Build / Grok CLI](https://x.ai/news/grok-build-cli) auto-discovers every `*.json` under `~/.grok/hooks/`. `dcg install --grok` writes a self-contained `~/.grok/hooks/dcg.json` with a `PreToolUse` / `matcher: "Bash"` entry — Grok internally aliases Claude-style `"Bash"` to its own `run_terminal_cmd` tool, so a single rule covers every shell command. dcg detects Grok at runtime from the camelCase wire shape (`hookEventName: "pre_tool_use"`, `toolName: "run_terminal_cmd"`) or from the `GROK_SESSION_ID` / `GROK_HOOK_EVENT` / `GROK_WORKSPACE_ROOT` environment variables, and switches its output to Grok's JSON contract: `{"decision":"deny","reason":...}` (note `"deny"`, not Hermes' `"block"`). Grok also reads `~/.claude/settings.json` when its Claude compatibility hooks are enabled, as documented in its [hook locations](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/10-hooks.md#hook-locations). That compatibility location does **not** follow `CLAUDE_CONFIG_DIR`: DCG checks Grok's default compatibility file separately, and a hook installed only in a relocated Claude directory does not protect Grok. Use `dcg install --grok` for that setup. Add `--project` to write `<repo>/.grok/hooks/dcg.json` for a per-repo install (Grok requires `/hooks-trust` the first time it opens a repo with hooks).
-- **Antigravity CLI (`agy`):** [Google Antigravity's `agy` CLI](https://antigravity.google) ships a Claude-Code-compatible hooks system. `dcg install --agy` merges a `PreToolUse` / `matcher: "Bash"` entry into `~/.gemini/config/hooks.json` (the canonical path; `agy` migrates the legacy `~/.gemini/antigravity-cli/hooks.json` here and symlinks the old path to it). `agy` runs the hook before its `run_command` shell tool; dcg detects `agy` at runtime from the distinctive nested `toolCall` envelope (`{"toolCall":{"name":"run_command","args":{"CommandLine":"…"}},"conversationId":…,"stepIdx":…}`) — the shell command is read from `toolCall.args.CommandLine` — or from the `ANTIGRAVITY_CONVERSATION_ID` environment variable / `agy` parent-process name. dcg follows `agy`'s [PreToolUse output contract](https://antigravity.google/docs/hooks): denials contain only `{"decision":"deny","reason":…}` on stdout with exit code 0. Antigravity CLI 1.4.0's strict `protojson` parser rejects extra fields such as `systemMessage`, `ruleId`, and `remediation` ([#573](https://github.com/Dicklesworthstone/destructive_command_guard/issues/573)); the explanation remains in `reason`. Warnings go to stderr with empty stdout and exit code 0, so dcg supplies no permission decision and leaves ordinary permission checks to `agy`. Add `--project` to write `<repo>/.gemini/config/hooks.json` for a per-repo install. Restart `agy` (start a new session) af
```

**File**: `src/cli.rs` (modified, +195/-8)
```diff
@@ -340,7 +340,7 @@ pub enum Command {
 
         /// Install the dcg PreToolUse hook for the Antigravity CLI (`agy`) at
         /// `~/.gemini/config/hooks.json` (user-level) or
-        /// `<repo>/.gemini/config/hooks.json` (with `--project`). `agy` reads
+        /// `<repo>/.agents/hooks.json` (with `--project`). `agy` reads
         /// Claude-Code-compatible `PreToolUse` hooks from this file and aborts
         /// its `run_command` shell tool when dcg returns a block decision.
         #[arg(
@@ -13731,22 +13731,26 @@ fn claude_dcg_hook_for_executable(
     }
 }
 
-fn hook_command_for_executable(executable: &std::path::Path) -> std::io::Result<String> {
+fn absolute_utf8_hook_program(executable: &std::path::Path) -> std::io::Result<&str> {
     if !executable.is_absolute() {
         return Err(std::io::Error::other(format!(
             "dcg hook executable path is not absolute: {}",
             executable.display()
         )));
     }
-    let executable = executable.to_str().ok_or_else(|| {
+    executable.to_str().ok_or_else(|| {
         std::io::Error::new(
             std::io::ErrorKind::InvalidData,
             format!(
                 "dcg hook executable path is not valid UTF-8: {}",
                 executable.display()
             ),
         )
-    })?;
+    })
+}
+
+fn hook_command_for_executable(executable: &std::path::Path) -> std::io::Result<String> {
+    let executable = absolute_utf8_hook_program(executable)?;
 
     #[cfg(windows)]
     {
@@ -13765,7 +13769,70 @@ fn claude_dcg_hook() -> std::io::Result<serde_json::Value> {
 }
 
 fn antigravity_dcg_hook() -> std::io::Result<serde_json::Value> {
-    claude_dcg_hook_for_executable(&current_dcg_executable()?)
+    antigravity_dcg_hook_for_executable(&current_dcg_executable()?)
+}
+
+/// The handler dcg writes into agy's `hooks.json`.
+///
+/// agy documents only `type`, `command` and `timeout` on a handler. On
+/// Windows it runs `command` through cmd.exe and ignores the `shell` key that
+/// Claude Code's Windows hook carries, so the PowerShell call-operator form
+/// `& '…'` failed with "& was unexpected at this time." and broke every
+/// `run_command` call (#677). Write the absolute path, quoted for cmd.exe on
+/// Windows and for a POSIX shell elsewhere, and no `shell` key.
+fn antigravity_dcg_hook_for_executable(
+    executable: &std::path::Path,
+) -> std::io::Result<serde_json::Value> {
+    antigravity_dcg_hook_for_program(absolute_utf8_hook_program(executable)?, cfg!(windows))
+}
+
+/// The platform is a parameter so the Windows shape is tested on every host.
+fn antigravity_dcg_hook_for_program(
+    program: &str,
+    windows: bool,
+) -> std::io::Result<serde_json::Value> {
+    let command = if windows {
+        cmd_quote_hook_program(program)?
+    } else {
+        posix_quote_hook_program(program)
+    };
+    Ok(serde_json::json!({
+        "type": "command",
+        "command": command
+    }))
+}
+
+/// Quote an absolute Windows program path for a cmd.exe command line.
+///
+/// A path without spaces or cmd.exe metacharacters is written bare, the form
+/// confirmed to work in agy on Windows. Any other path is wrapped in double
+/// quotes, inside which cmd.exe reads `&|<>()^,;=` and spaces literally.
+/// cmd.exe expands `%NAME%` even inside quotes and a path cannot contain `"`
+/// or a control character, so those are refused rather than written as a
+/// hook that runs something else or nothing.
+fn cmd_quote_hook_program(program: &str) -> std::io::Result<String> {
+    if program
+        .chars()
+        .any(|character| matches!(character, '%' | '"') || character.is_control())
+    {
+        return Err(std::io::Error::new(
+            std::io::ErrorKind::InvalidInput,
+            format!(
+                "dcg hook executable path contains %, \" or a control character, \
+                 which cmd.exe cannot run as written: {program}"
+            ),
+        ));
+    }
+    if program.chars().any(|character| {
+        character.is_whitespace()
+            || matches!(
+                character,
+                '&' | '|' | '<' | '>' | '(' | ')' | '^' | ',' | ';' | '='
+            )
+    }) {
+        return Ok(format!("\"{program}\""));
+    }
+    Ok(program.to_string())
 }
 
 fn quoted_hook_program(command: &str) -> Option<String> {
@@ -14736,7 +14803,7 @@ fn install_grok_hook(force: bool, project: bool) -> Result<(), Box<dyn std::erro
 /// legacy `Bash` matcher entry written by older releases). When dcg returns a block decision
 /// (stdout `{"decision":"block",...}`), `agy` aborts its `run_command` tool.
 ///
-/// With `--project`, writes to `<repo>/.gemini/config/hooks.json` instead.
+/// With `--project`, writes to `<repo>/.agents/hooks.json` instead.
 ///
 /// Returns `Err` if the file cannot be read/written or, for project installs,
 /// if the current directory is not inside a git repository.
@@ -14808,13 +14875,21 @@ fn antigravity_hooks_path() -> std::path::PathBuf {
 }
 
 /
```

---

### Incident Patch 3: `6ab4d758` (2026-11-27)
**Commit Message**: fix(filesystem): review rimraf like rm -rf, also through npx, pnpm, yarn and bun (#675) [skip ci]

The trash operand checks (91fd5e73) treat trash, trash-put, gio trash,
moves into the Trash and rimraf alike: deny an empty, dynamic, cwd, home,
root or broad operand and allow any other literal path. That fits the
Trash routes, which are recoverable. rimraf is not: it removes its
targets recursively and permanently, which is `rm -rf`, and `rimraf dist`
or `rimraf a b` was allowed where `rm -rf dist` is denied.

rimraf now gets rm -rf's policy. A new core.filesystem rule,
rimraf-general (High), denies rimraf of any operand outside a literal temp
directory (/tmp, /var/tmp, their /private forms, a literal Windows user
temp path), using the same temp-path helpers as rm-rf-general: a real
component below the temp root, no `..`, a glob only in the last
component. An operand that could select the worktree, home or a root keeps
the more specific trash-unsafe-target. Options and a bare `rimraf` or
`rimraf --help` are not operands. The Trash utilities keep only the target
checks, and the denial suggests them.

rimraf is nearly always started by a package runner, so the argv
classifier now read

**File**: `docs/packs/core.md` (modified, +1/-0)
```diff
@@ -268,6 +268,7 @@ These patterns match potentially destructive commands:
 | `mv-sensitive-source-root-home` | mv touching a sensitive system or home path is the cross-segment recursive-force-delete bypass. EXTREMELY DANGEROUS. | critical |
 | `mv-dynamic-path` | mv with a shell-expanded or escaped path cannot be verified before execution. | high |
 | `trash-unsafe-target` | This disposal command could remove a worktree or a protected directory. Name a specific literal path, e.g. `trash /tmp/my-task/out`. | high |
+| `rimraf-general` | rimraf deletes recursively and permanently, like rm -rf, and requires human approval outside a temp directory. | high |
 | `credential-file-write` | writing a credential, private-key, login-shell startup, or system authentication file (`~/.ssh/*`, `~/.aws/credentials`, `~/.netrc`, `~/.git-credentials`, `~/.npmrc`, `~/.pypirc`, `~/.docker/config.json`, `~/.kube/config`, `~/.gnupg/*`, `~/.config/gh/hosts.yml`, the token stores of cargo, gem, Vault, Terraform, gcloud, Azure, s3cmd/boto, pass and hub, `~/.pgpass`, `~/.my.cnf`, the shell rc files and `~/.bashrc.d`/`~/.zshrc.d`, `/etc/sudoers*`, `/etc/passwd`, `/etc/shadow`, `/etc/group`, `/etc/ssh/*`) with `>`, `>>`, `tee`, `cp`/`mv`/`install`/`ln`, `dd of=`, or `sed -i` — or, from PowerShell or Cmd, `Add-Content`, `Set-Content`, `Clear-Content`, `Out-File`, `Tee-Object`, `New-Item`, `Copy-Item`, `Move-Item`, `copy`, or `move` — installs persistent access or replaces the trust this machine runs on, whether or not the file exists yet. Reads and `chmod`/`chown` are unaffected; appending to `~/.ssh/known_hosts` stays allowed. | critical |
 | `git-internals-write` | writing inside a `.git` directory with `tee`, `sponge`, `cp`/`mv`/`install`, `sed -i`, `perl -i`, `dd of=`, or an embedded-code sink rewrites repository state: `.git/config` carries remotes, `insteadOf` rewrites and credential helpers, `.git/hooks/*` run on ordinary git commands, and refs and objects are the history itself. Reads are unaffected, and `.gitignore`, `.gitattributes`, `.gitmodules` and `.github/` are not this rule. | critical |
 | `redirect-truncate-root-home` | shell truncating redirect (including arbitrary numeric, named, and PowerShell all-stream forms) to an existing sensitive system or home path destroys the previous file contents. A currently absent literal target under the home directory with an existing parent is allowed (creation, not truncation — the same thing `>>` would do); existing files, dynamic paths, symlinks, missing parents, system paths, and .git internals stay blocked. | critical |
```

**File**: `src/evaluator.rs` (modified, +2/-2)
```diff
@@ -31229,11 +31229,11 @@ fn evaluate_packs_with_allowlists_at_depth(
                     original_command,
                     project_path,
                 ) {
-                    Ok(Some(span)) => {
+                    Ok(Some((span, rule))) => {
                         if let Some(result) = evaluate_named_pack_rule_with_span(
                             pack_id,
                             pack,
-                            crate::packs::core::filesystem::TRASH_TARGET_RULE,
+                            rule,
                             allowlists,
                             project_path,
                             &mut first_allowlist_hit,
```

**File**: `src/packs/core/filesystem.rs` (modified, +300/-41)
```diff
@@ -33,6 +33,25 @@ const RM_RF_ROOT_HOME_SUGGESTIONS: &[PatternSuggestion] = &[
     ),
 ];
 
+/// Suggestions for `rimraf` outside a temp directory (#675). The Trash
+/// utilities are recoverable and dcg checks their targets.
+const RIMRAF_GENERAL_SUGGESTIONS: &[PatternSuggestion] = &[
+    PatternSuggestion::with_platform(
+        "trash-put ./build",
+        "Move the reviewed directory to the trash instead (recoverable; requires trash-cli)",
+        Platform::Linux,
+    ),
+    PatternSuggestion::with_platform(
+        "mv ./build ~/.Trash/",
+        "Move the reviewed directory to the Finder trash instead (recoverable)",
+        Platform::MacOS,
+    ),
+    PatternSuggestion::new(
+        "rimraf /tmp/task/out",
+        "rimraf of a literal path under a temp directory is allowed",
+    ),
+];
+
 /// Suggestions for general `rm -rf` pattern.
 const RM_RF_GENERAL_SUGGESTIONS: &[PatternSuggestion] = &[
     PatternSuggestion::new(
@@ -375,6 +394,27 @@ use std::ops::Range;
 use std::path::Path;
 
 pub(crate) const TRASH_TARGET_RULE: &str = "trash-unsafe-target";
+/// rimraf of a target outside a literal temp directory. rimraf removes
+/// recursively and permanently, exactly what `rm-rf-general` reviews, while
+/// the Trash utilities are recoverable and only need their target checks.
+pub(crate) const RIMRAF_GENERAL_RULE: &str = "rimraf-general";
+
+/// Programs a wrapper (`sudo`, `env`, `timeout`, …) may start that this
+/// check reads: the disposal utilities and the package runners.
+const TRASH_CHILD_PROGRAMS: &[&str] = &[
+    "trash",
+    "trash-put",
+    "rimraf",
+    "gio",
+    "mv",
+    "npx",
+    "pnpx",
+    "bunx",
+    "npm",
+    "pnpm",
+    "yarn",
+    "bun",
+];
 
 /// A candidate gate only. Removing quotes here can select inert text; the
 /// command parser below must prove the executable and each operand's role.
@@ -405,10 +445,13 @@ fn may_name_trash(command: &str) -> bool {
 /// Inspect original shell syntax. The Bash grammar gives us the executable
 /// and its raw argument fields, including empty quoted words and substitutions.
 /// Comments, redirection targets and quoted command examples are not argv.
+///
+/// Returns the span of the first disposal command that needs review and the
+/// rule that names why: [`TRASH_TARGET_RULE`] or [`RIMRAF_GENERAL_RULE`].
 pub(crate) fn unsafe_trash_span(
     command: &str,
     cwd: Option<&Path>,
-) -> Result<Option<Range<usize>>, ()> {
+) -> Result<Option<(Range<usize>, &'static str)>, ()> {
     use ast_grep_core::AstGrep;
     use ast_grep_language::SupportLang;
 
@@ -436,68 +479,181 @@ pub(crate) fn unsafe_trash_span(
         let words: Vec<&str> = std::iter::once(raw_name)
             .chain(args.filter_map(|arg| source.get(arg.range())))
             .collect();
-        if unsafe_trash_argv(&words, cwd) {
-            return Ok(Some(invocation.range()));
+        if let Some(rule) = unsafe_trash_argv(&words, cwd) {
+            return Ok(Some((invocation.range(), rule)));
         }
     }
     Ok(None)
 }
 
-fn unsafe_trash_argv(words: &[&str], cwd: Option<&Path>) -> bool {
-    use super::trash_target::{unsafe_rimraf_glob_operand, unsafe_trash_operand};
+fn unsafe_trash_argv(words: &[&str], cwd: Option<&Path>) -> Option<&'static str> {
+    use super::trash_target::unsafe_trash_operand;
     use crate::normalize::decode_posix_literal_word;
 
-    let Some((&name, args)) = words.split_first() else {
-        return false;
-    };
-    let Some(name) = decode_posix_literal_word(name) else {
-        return false;
-    };
-    match name.rsplit('/').next() {
-        Some("trash" | "trash-put") => args.iter().any(|word| unsafe_trash_operand(word, cwd)),
-        Some("rimraf") => {
-            let glob = args
-                .iter()
-                .map(|word| decode_posix_literal_word(word))
-                .take_while(|word| word.as_deref() != Some("--"))
-                .any(|word| matches!(word.as_deref(), Some("--glob" | "-g")));
-            args.iter().any(|word| {
-                if glob {
-                    unsafe_rimraf_glob_operand(word, cwd)
-                } else {
-                    unsafe_trash_operand(word, cwd)
-                }
+    let (&name, args) = words.split_first()?;
+    let name = decode_posix_literal_word(name)?;
+    let program = name.rsplit('/').next().unwrap_or_default();
+    match program {
+        "trash" | "trash-put" => args
+            .iter()
+            .any(|word| unsafe_trash_operand(word, cwd))
+            .then_some(TRASH_TARGET_RULE),
+        "rimraf" => rimraf_argv_rule(args, cwd),
+        "gio" => args
+            .split_first()
+            .is_some_and(|(operation, operands)| {
+                decode_posix_literal_word(operation).as_deref() == Some("trash")
+                    && operands.iter().any(|word| unsafe_trash_operand(word, cwd))
             })
-        }
-        Some("gio") => args.split_first().is_some_and(|(operation, operands)| {
-  
```

**File**: `src/packs/core/trash_target.rs` (modified, +26/-0)
```diff
@@ -18,6 +18,32 @@ pub(super) fn unsafe_rimraf_glob_operand(raw: &str, cwd: Option<&Path>) -> bool
     unsafe_operand_in(raw, cwd, crate::config::home_dir().as_deref(), true)
 }
 
+/// rimraf deletes recursively and permanently, so it earns `rm -rf`'s temp
+/// exemption and nothing wider (#675): a literal path below `/tmp`,
+/// `/var/tmp` or their macOS `/private` forms (or a literal Windows user temp
+/// subpath), with a real component under the temp root and no `..`. A simple
+/// glob in the last component is accepted, as it is for `rm -rf /tmp/x/*`.
+pub(super) fn rimraf_operand_is_literal_temp(raw: &str) -> bool {
+    use super::filesystem::{
+        LITERAL_TEMP_PREFIXES, has_dotdot_segment, temp_path_suffix_has_real_component,
+        windows_literal_user_temp_subpath,
+    };
+
+    let Some((path, _)) = decode_target(raw) else {
+        return false;
+    };
+    if path.contains(['\0', '\\']) {
+        return false;
+    }
+    LITERAL_TEMP_PREFIXES
+        .iter()
+        .find_map(|prefix| path.strip_prefix(prefix))
+        .is_some_and(|suffix| {
+            temp_path_suffix_has_real_component(suffix) && !has_dotdot_segment(suffix)
+        })
+        || windows_literal_user_temp_subpath(&path)
+}
+
 fn unsafe_operand_in(
     raw: &str,
     cwd: Option<&Path>,
```

**File**: `src/packs/mod.rs` (modified, +9/-4)
```diff
@@ -852,10 +852,15 @@ impl Pack {
     /// Returns the matched pattern's reason, name, severity, and explanation if found.
     #[must_use]
     pub fn matches_destructive(&self, cmd: &str) -> Option<DestructiveMatch> {
-        if self.id == "core.filesystem"
-            && !matches!(core::filesystem::unsafe_trash_span(cmd, None), Ok(None))
-        {
-            return self.destructive_match_by_name(core::filesystem::TRASH_TARGET_RULE, cmd);
+        if self.id == "core.filesystem" {
+            match core::filesystem::unsafe_trash_span(cmd, None) {
+                Ok(None) => {}
+                Ok(Some((_, rule))) => return self.destructive_match_by_name(rule, cmd),
+                Err(()) => {
+                    return self
+                        .destructive_match_by_name(core::filesystem::TRASH_TARGET_RULE, cmd);
+                }
+            }
         }
         if self.id == "careful_company_running_windows.guardrails"
             && crate::packs::careful_company_running_windows::guardrails::authorization_store_write_span(
```

**File**: `src/suggestions.rs` (modified, +22/-0)
```diff
@@ -1020,6 +1020,27 @@ fn register_core_filesystem_suggestions(m: &mut HashMap<&'static str, Vec<Sugges
         ],
     );
 
+    // rimraf is a permanent recursive delete (#675); the Trash keeps it
+    // recoverable, and a literal temp path is allowed as for `rm -rf`.
+    m.insert(
+        "core.filesystem:rimraf-general",
+        vec![
+            Suggestion::new(
+                SuggestionKind::PreviewFirst,
+                "List what rimraf would remove before asking for approval",
+            )
+            .with_command("ls -la ./build"),
+            Suggestion::new(
+                SuggestionKind::SaferAlternative,
+                "Move the reviewed directory to the Trash instead, for example `trash-put ./build` on Linux (trash-cli) or `mv ./build ~/.Trash/` on macOS",
+            ),
+            Suggestion::new(
+                SuggestionKind::SaferAlternative,
+                "Keep disposable output under a literal temp path, where `rimraf /tmp/task/out` is allowed",
+            ),
+        ],
+    );
+
     // The command word is assembled at runtime. Do not guess a platform or
     // repeat the unverified delete; make the executable and target reviewable.
     m.insert(
@@ -2420,6 +2441,7 @@ mod tests {
             "core.filesystem:rm-bare-glob",
             "core.filesystem:rm-bare-glob-root",
             "core.filesystem:trash-unsafe-target",
+            "core.filesystem:rimraf-general",
             "core.filesystem:find-delete-root-home",
             "core.filesystem:find-delete-general",
             "core.filesystem:unlink-root-home",
```

**File**: `tests/test_command.rs` (modified, +41/-1)
```diff
@@ -158,7 +158,7 @@ fn trash_operand_decisions_agree_with_the_hook() {
         ("trash /tmp/pr-prov/render", "allow"),
         ("trash-put ./build .env ../sibling/build", "allow"),
         ("gio trash -- 'build outputs'", "allow"),
-        ("rimraf a b", "allow"),
+        ("rimraf a b", "deny"),
         ("mv ./build ~/.Trash/", "allow"),
         ("gio info .", "allow"),
         ("trash-put '$OUT'", "allow"),
@@ -169,6 +169,46 @@ fn trash_operand_decisions_agree_with_the_hook() {
     }
 }
 
+/// #675: rimraf deletes permanently, so outside a literal temp directory it
+/// is reviewed like `rm -rf`, also when npx, npm exec, pnpm, yarn or bun
+/// starts it. Candidates are passed as arguments or JSON data; none runs.
+#[test]
+fn rimraf_decisions_agree_with_the_hook_675() {
+    for (command, expected) in [
+        ("rimraf dist", "deny"),
+        ("npx rimraf dist", "deny"),
+        ("npx --yes rimraf@5 ./build", "deny"),
+        ("npm exec -- rimraf node_modules", "deny"),
+        ("pnpm dlx rimraf dist", "deny"),
+        ("yarn rimraf dist", "deny"),
+        ("bunx rimraf dist", "deny"),
+        ("npx rimraf .", "deny"),
+        (r#"npx rimraf "$OUT""#, "deny"),
+        ("rimraf /tmp/task/out", "allow"),
+        ("npx rimraf /tmp/task/out", "allow"),
+        ("npm install -D rimraf", "allow"),
+        ("echo npx rimraf dist", "allow"),
+        ("trash-put ./build", "allow"),
+    ] {
+        assert_trash_decision(command, expected, None);
+    }
+    // Inside a shell -c script or a script heredoc the same argv is judged.
+    for command in [
+        "bash -c 'npx rimraf dist'",
+        "sh <<'EOF'\nnpx rimraf dist\nEOF",
+    ] {
+        let test = run_dcg_isolated(
+            &["test", "--dialect", "posix", "--format", "json", command],
+            None,
+        );
+        let verdict = parse_json(&test);
+        assert_eq!(
+            verdict["decision"], "deny",
+            "dcg test: {command}: {verdict}"
+        );
+    }
+}
+
 #[cfg(unix)]
 #[test]
 fn trash_absolute_target_uses_the_reported_working_directory() {
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


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. install): recover ownerless install locks

**RULE**:
When implementing operations in `install.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Dicklesworthstone/destructive_command_guard. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c4ca6898`: install): recover ownerless install locks. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `install.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# Take the lock and record our pid. A pid that cannot be written (full disk or
# spent quota) would leave an ownerless lock that blocks every later run, so
# release it and stop instead.
take_install_lock() {
  mkdir "$LOCK_DIR" 2>/dev/null || return 1
  if ! echo $$ > "$LOCK_DIR/pid" 2>/dev/null; then
    rm -rf "$LOCK_DIR" 2>/dev/null || true
    LOCKED=0
    err "Could not write pid file to $LOCK_DIR (disk full or read-only?)"
    exit 1
  fi
}
if ! take_install_lock; then
  # The existing lock is stale if its process is gone, or if it never recorded
  # a pid (an interrupted or disk-full run) and is more than 10 minutes old.
  OLD_PID=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")
  if { [ -n "$OLD_PID" ] && ! kill -0 "$OLD_PID" 2>/dev/null; } \
    || { [ -z "$OLD_PID" ] && [ -n "$(find "$LOCK_DIR" -maxdepth 0 -mmin +10 2>/dev/null)" ]; }; then
    rm -rf "$LOCK_DIR"
    take_install_lock || true
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
if mkdir "$LOCK_DIR" 2>/dev/null; then
  echo $$ > "$LOCK_DIR/pid"
else
  # Check if existing lock is stale (process no longer running)
  if [ -f "$LOCK_DIR/pid" ]; then
    OLD_PID=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")
    if [ -n "$OLD_PID" ] && ! kill -0 "$OLD_PID" 2>/dev/null; then
      rm -rf "$LOCK_DIR"
      if mkdir "$LOCK_DIR" 2>/dev/null; then
        LOCKED=1
        echo $$ > "$LOCK_DIR/pid"
      fi
    fi
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c4ca6898` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
