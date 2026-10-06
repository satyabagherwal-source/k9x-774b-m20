# Forensic Learning Record (Deep Inspection): Dicklesworthstone/destructive_command_guard

> **Canonical Artifact**: `07_PROJECT_LEARNING/dicklesworthstone-destructive_command_guard-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:07:26.482Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dicklesworthstone/destructive_command_guard`
- **Description**: The Destructive Command Guard (dcg) is for blocking dangerous git and shell commands from being executed by agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6084 stars

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
use ast_grep_core::{AstGrep, Pattern};
use ast_grep_language::SupportLang;
use memchr::memchr_iter;
use regex::Regex;
use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, mpsc};
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
#[derive(Debug, Clone)]
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
    pub const fn new(
        pattern_str: String,
        rule_id: String,
        rea
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
    Ok(Some(
        entries
            .into_iter()
            .filter_map(|entry| serde_json::from_value::<ToolCall>(entry).ok())
            .collect(),
    ))
}

/// Replace every unpaired UTF-16 surrogate escape (`\uD800`–`\uDFFF` without
/// its partner) with `�` before parsing.
///
/// JavaScript strings can hold a lone surrogate, and `J
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

pub(crate) use embedded::{scan_extracted, source_scan_required};
// The two rule NAMES are deliberately not re-exported: every hit carries the
// rule it denies under, so the evaluator reads `hit.rule` instead of choosing
// one. That is what keeps `.git/` writes allowlistable separately from
// credential writes (#457); a caller reaching for a name here would be
// guessing at something the classifier already decided.
pub(crate) use shell::{
    CREDENTIAL_FILE_WRITE_SUGGESTIONS, CredentialFileWrite, GIT_INTERNALS_WRITE_SUGGESTIONS,
    classify_credential_file_write, may_name_protected_path, names_protected_file,
    names_windows_shell_writer,
};

use crate::normalize::ShellDialect;

pub(crate) fn is_credential_writer(executable: &str) -> bool {
    shell::is_credential_writer(executable) || embedded::is_interpreter(executable)
}

/// Inspect executable source before shell segmentation or masking removes it.
/// Shell syntax uses the separate [`classify_credential_file_write`] above;
/// inline scripts, heredocs, and here-strings use their proven interpreter.
/// Apply explicit language/content exemptions to each decoded program, not
/// to another program or shell writer in the same command.
/// Retain all rule families, including coincident spans from a single rename.
/// The evaluator, not the classifier, decides whether a rule is allowlisted.
pub(crate) fn classify_embedded_credential_file_writes(
    command: &str,
    dialect: ShellDialect,
    source_is_exempt: impl FnMut(&str, crate::heredoc::ScriptLanguage) -> bool,
) -> Vec<CredentialFileWrite> {
    embedded::scan_command(command, dialect, source_is_exempt)
}

#[cfg(test)]
mod source_ownership_tests {
    use super::scan_extracted;
    use crate::heredoc::{ExtractionLimits, ExtractionResult, extract_content};

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
}

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

### Core Architecture Module: `src/packs/core/credential_files/embedded/php.rs`
```
//! PHP global filesystem APIs and bounded, source-local value propagation.
//!
//! PHP uses its real grammar, including argument wrappers and `.` rather than
//! arithmetic `+`. Literal tildes never acquire runtime HOME provenance.

use super::{
    Access, AstGrep, CredentialFileWrite, MAX_BYTES, MAX_DEPTH, MAX_NODES, MAX_STATIC_PATH_BYTES,
    ResolvedPath, SupportLang, Syntax, record_write,
};
use std::collections::HashMap;

const APPEND: u8 = 1;
const UNKNOWN: u8 = 2;

#[derive(Clone, Debug)]
enum Datum {
    Text(ResolvedPath),
    Flags(u8),
    Handle(ResolvedPath, Access),
    Environment,
}

#[derive(Clone)]
struct State {
    values: HashMap<String, Datum>,
    namespaced: bool,
    getenv_home: bool,
}

impl State {
    fn new(namespaced: bool) -> Self {
        Self {
            values: HashMap::from([
                ("$_SERVER".into(), Datum::Environment),
                ("$_ENV".into(), Datum::Environment),
            ]),
            namespaced,
            getenv_home: true,
        }
    }
}

pub(super) fn has_sink_name(code: &str) -> bool {
    [
        "file_put_contents",
        "fopen",
        "fwrite",
        "fputs",
        "ftruncate",
        "copy",
        "rename",
        // Creating a name is creating the file the name resolves to (#484).
        "symlink",
        "link",
        "move_uploaded_file",
    ]
    .iter()
    .any(|word| {
        code.as_bytes()
            .windows(word.len())
            .any(|part| part.eq_ignore_ascii_case(word.as_bytes()))
    })
}

pub(super) fn scan(code: &str) -> Result<Vec<CredentialFileWrite>, &'static str> {
    if code.len() > MAX_BYTES {
        return Err("protected-write PHP source exceeds the byte limit");
    }
    // -r has no opening tag; stdin programs normally do. Keep findings in
    // original-source coordinates rather than exposing the synthetic prefix.
    let prefix = if code.trim_start().starts_with("<?") {
        ""
    } else {
        "<?php\n"
    };
    let source = format!("{prefix}{code}");
    let ast = AstGrep::new(&source, SupportLang::Php);
    let mut hits = Vec::new();
    let mut remaining = MAX_NODES;
    visit(
        ast.root(),
        &mut State::new(false),
        0,
        &mut remaining,
        &mut hits,
    )?;
    for hit in &mut hits {
        hit.span =
            hit.span.start.saturating_sub(prefix.len())..hit.span.end.saturating_sub(prefix.len());
    }
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
        return Err("protected-write PHP source exceeds the traversal limit");
    }
    *remaining -= 1;
    let kind = node.kind();
    if kind == "ERROR" {
        return Err("protected-write PHP source contains a syntax error");
    }
    if kind == "namespace_definition" {
        if let Some(body) = node.field("body") {
            let mut local = state.clone();
            local.namespaced = node.field("name").is_some();
            return visit(body, &mut local, depth + 1, remaining, hits);
        }
        state.namespaced = node.field("name").is_some();
        return Ok(());
    }
    if matches!(
        kind.as_ref(),
        "function_definition" | "method_declaration" | "anonymous_function" | "arrow_function"
    ) {
        // Named PHP functions do not inherit caller-local variables. Arrow
        // functions capture by value; ordinary closures require an explicit
        // use-list, which is deliberately left unresolved in this bounded pass.
        let mut local = if kind == "arrow_function" {
            state.clone()
        } else {
            State::new(state.namespaced)
        };
        local.getenv_home = state.getenv_home;
        for global in ["$_SERVER", "$_ENV"] {
            if !state.values.contains_key(global) {
                local.values.remove(global);
            }
        }
        if let Some(parameters) = node.field("parameters") {
            for parameter in parameters
                .dfs()
                .filter(|child| child.kind() == "variable_name")
            {
                local.values.remove(parameter.text().as_ref());
            }
        }
        if let Some(body) = node.field("body") {
            visit(body, &mut local, depth + 1, remaining, hits)?;
        }
        return Ok(());
    }
    if matches!(
        kind.as_ref(),
        "assignment_expression"
            | "augmented_assignment_expression"
            | "reference_assignment_expression"
    ) {
        if let (Some(left), Some(right)) = (node.field("left"), node.field("right")) {
            // Capture compound LHS before evaluating RHS, but inspect effects
            // before installing the assignment (including fopen in the RHS).
            let before = value(&left, state, 0);
            visit(right.clone(), state, depth + 1, remaining, hits)?;
            let after = value(&right, state, 0);
            let assigned = match kind.as_ref() {
                "assignment_expression" => after,
                "augmented_assignment_expression" => match node
                    .field("operator")
                    .as_ref()
                    .map(ast_grep_core::Node::text)
                {
                    Some(op) if op == ".=" => concatenate(before, after),
                    Some(op) if op == "|=" => combine_flags(before, after),
                    _ => None,
                },
                // Aliases can change later without a direct assignment here.
                _ => None,
            };
            invalidate(&left, state);
            if left.kind() == "variable_name" {
                if let Some(assigned) = assigned {
                    state.values.insert(left.text().into_owned(), assigned);
                }
            }
            return Ok(());
        }
    }
    if matches!(
        kind.as_ref(),
        "update_expression" | "unset_statement" | "global_declaration"
    ) {
        invalidate(&node, state);
    }
    if kind == "function_call_expression" {
        inspect_call(&node, state, hits);
        if builtin(&node, state).as_deref() == Some("putenv") {
            state.getenv_home = false;
        }
    }
    for child in node.children() {
        visit(child, state, depth + 1, remaining, hits)?;
    }
    Ok(())
}

fn invalidate(node: &Syntax<'_>, state: &mut State) {
    for variable in node.dfs().filter(|child| child.kind() == "variable_name") {
        state.values.remove(variable.text().as_ref());
    }
}

fn builtin(node: &Syntax<'_>, state: &State) -> Option<String> {
    let function = node.field("function")?;
    let text = function.text();
    let name = match function.kind().as_ref() {
        "name" if !state.namespaced => text.as_ref(),
        "qualified_name" => text.strip_prefix('\\')?,
        _ => return None,
    };
    (!name.contains('\\')).then(|| name.to_ascii_lowercase())
}

fn argument<'a>(node: &Syntax<'a>, position: usize, name: &str) -> Option<Syntax<'a>> {
    let args = super::arguments(node);
    let selected = args
        .iter()
        .find(|arg| arg.field("name").is_some_and(|key| key.text() == name))
        .or_else(|| {
            args.iter()
                .filter(|arg| arg.field("name").is_none())
                .nth(position)
        })?;
    if selected.kind() != "argument" {
        return Some(selected.clone());
    }
    // PHP's argument value is an unnamed field. The optional argument name
    // is its first named child, while the expression is the last one.
    selected
        .children()
        .filter(|child| child.is_named() && child.kind() != "comment")
        .last()
}

fn path(node: &Syntax<'_>, state: &State) -> Option<ResolvedPath> {
    match value(node, state, 0)? {
        Datum::Text(path) => Some(path),
        _ => None,
    }
}

fn plain(node: &Syntax<'_>, state: &State, depth: usize) -> Option<String> {
    match value(node, state, depth)? {
        Datum::Text((text, false)) => Some(text),
        _ => None,
    }
}

fn concatenate(left: Option<Datum>, right: Option<Datum>) -> Option<Datum> {
    let (Datum::Text(left), Datum::Text(right)) = (left?, right?) else {
        return None;
    };
    let joined = super::concatenate_text(super::path_as_text(left), super::path_as_text(right))?;
    Some(Datum::Text(super::resolved_path(joined)?))
}

fn combine_flags(left: Option<Datum>, right: Option<Datum>) -> Option<Datum> {
    match (left, right) {
        (Some(Datum::Flags(left)), Some(Datum::Flags(right))) => Some(Datum::Flags(left | right)),
        (Some(Datum::Flags(bits)), _) | (_, Some(Datum::Flags(bits))) => {
            Some(Datum::Flags(bits | UNKNOWN))
        }
        _ => None,
    }
}

fn value(node: &Syntax<'_>, state: &State, depth: usize) -> Option<Datum> {
    if depth > 24 {
        return None;
    }
    match node.kind().as_ref() {
        "variable_name" => state.values.get(node.text().as_ref()).cloned(),
        "string" => {
            let raw = node.text();
            let raw = raw.strip_prefix(['b', 'B']).unwrap_or(&raw);
            let body = raw.strip_prefix('\'')?.strip_suffix('\'')?;
            Some(Datum::Text((decode(body, false)?, false)))
        }
        "encapsed_string" => {
            let mut result = Some(Datum::Text((String::new(), false)));
            for child in node.children().filter(ast_grep_core::Node::is_named) {
                let part = match child.kind().as_ref() {
                    "string_content" | "escape_sequence" => {
                        Some(Datum::Text((decode(child.text().as_ref(), true)?, false)))
                    }
                    _ => value(&child, state, depth + 1),
                };
                result = concatenate(result, part);
            }
            result
        }
        "parenthesized_expression" | "argument" => {
        
```

### Core Architecture Module: `src/packs/core/credential_files/embedded/transfers.rs`
```
//! File transfers share the protected-write policy (#461).
//!
//! A copy reads its source and writes its destination. A rename or move also
//! removes the source name. Inspect those effects independently: a dynamic
//! source must not hide a known protected destination, and one allowlisted
//! rule must not hide the other rule on the opposite end of one operation.
//!
//! Keep exact-path APIs separate from directory-placement and whole-tree APIs.
//! Python copy/copy2/move can place the source basename inside a destination
//! directory; copytree writes the destination tree itself, not dst/basename(src).
//! The existing shell classifier supplies the path table and placement policy.
//! No candidate is executed and no directory is traversed to determine its type.
//! Links create the destination name, never remove or write their source. A
//! symbolic link can redirect an entire protected tree; a hard link cannot.

use super::{
    Access, Bindings, CredentialFileWrite, Language, ResolvedPath, ShellDialect, Syntax, Value,
    arguments, path_value, protected, python_argument, quote_policy_path, shell, value,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Operation {
    CopyFile,
    Rename,
    Copy,
    Move,
    CopyTree,
    HardLink,
    SymbolicLink,
}

pub(super) fn shutil_operation(name: &str) -> Option<Operation> {
    match name {
        "copyfile" => Some(Operation::CopyFile),
        "copy" | "copy2" => Some(Operation::Copy),
        "move" => Some(Operation::Move),
        "copytree" => Some(Operation::CopyTree),
        _ => None,
    }
}

pub(super) fn js_operation(name: &str) -> Option<Operation> {
    match name {
        "copyFile" | "copyFileSync" => Some(Operation::CopyFile),
        "rename" | "renameSync" => Some(Operation::Rename),
        "link" | "linkSync" => Some(Operation::HardLink),
        "symlink" | "symlinkSync" => Some(Operation::SymbolicLink),
        // `fs.cp` is Node's recursive copy and the twin of `shutil.copytree`,
        // which Python already covers (#484). It is a TREE write rather than a
        // placement: unlike `cp(1)`, it writes `dest` itself and never
        // `dest/basename(src)`.
        "cp" | "cpSync" => Some(Operation::CopyTree),
        _ => None,
    }
}

struct Transfer {
    operation: Operation,
    source: Option<ResolvedPath>,
    destination: Option<ResolvedPath>,
    api: String,
}

fn classify(node: &Syntax<'_>, language: Language, env: &Bindings) -> Option<Transfer> {
    if !matches!(node.kind().as_ref(), "call" | "call_expression") {
        return None;
    }
    let args = arguments(node);
    let path = |argument: &Syntax<'_>| path_value(argument, language, env);
    if language == Language::Ruby {
        let method = node.field("method")?.text().into_owned();
        let receiver = value(&node.field("receiver")?, language, env, 0)?;
        let (operation, api) = match (receiver, method.as_str()) {
            (Value::File, "rename") => (Operation::Rename, "File.rename".to_string()),
            (Value::File, "link") => (Operation::HardLink, "File.link".to_string()),
            (Value::File, "symlink") => (Operation::SymbolicLink, "File.symlink".to_string()),
            (Value::Io | Value::File, "copy_stream") => {
                (Operation::CopyFile, "IO.copy_stream".to_string())
            }
            // FileUtils is Ruby's shutil, and every verb here has a Python twin
            // this module already reads (#484). The placement/exact split is the
            // same one shutil gets: `cp`, `cp_r` and `install` put the source
            // basename INSIDE dest when dest is a directory, while `copy_file`
            // names the destination itself.
            //
            // `touch` is absent on purpose: it creates or restamps, it does not
            // truncate, so it destroys nothing. The `rm_*` family is absent for
            // the opposite reason -- it is a deletion, and the recursive-delete
            // policy in `ast_pattern_engine` already owns those spellings.
            (Value::FileUtils, method_name) => {
                let operation = match method_name {
                    "cp" | "copy" | "cp_r" | "copy_entry" | "install" => Operation::Copy,
                    "copy_file" => Operation::CopyFile,
                    "mv" | "move" => Operation::Move,
                    "ln" | "link" | "link_entry" => Operation::HardLink,
                    "ln_s" | "ln_sf" | "symlink" => Operation::SymbolicLink,
                    _ => return None,
                };
                (operation, format!("FileUtils.{method_name}"))
            }
            _ => return None,
        };
        return Some(Transfer {
            operation,
            source: path(args.first()?),
            destination: path(args.get(1)?),
            api,
        });
    }
    let function = node.field("function")?;
    match value(&function, language, env, 0)? {
        Value::Transfer(operation) if language == Language::Python => {
            // Both argument nodes must exist, but either value may be unknown.
            let source = python_argument(&args, 0, "src")?;
            let destination = python_argument(&args, 1, "dst")?;
            Some(Transfer {
                operation,
                source: path(&source),
                destination: path(&destination),
                api: function.text().into_owned(),
            })
        }
        Value::PathTransfer(source) if language == Language::Python => {
            let destination = python_argument(&args, 0, "target")?;
            Some(Transfer {
                operation: Operation::Rename,
                source: Some(source),
                destination: path(&destination),
                api: function.text().into_owned(),
            })
        }
        Value::PathLink(destination, operation) if language == Language::Python => {
            // pathlib reverses os.link/os.symlink: the receiver is the NEW
            // name, and `target` is what it refers to. Keep this distinction
            // even when the target value is dynamic or the method is aliased.
            let source = python_argument(&args, 0, "target")?;
            Some(Transfer {
                operation,
                source: path(&source),
                destination: Some(destination),
                api: function.text().into_owned(),
            })
        }
        Value::Api(api) if language == Language::Node => Some(Transfer {
            operation: js_operation(&api)?,
            source: path(args.first()?),
            destination: path(args.get(1)?),
            api: format!("fs.{api}"),
        }),
        _ => None,
    }
}

pub(super) fn scan(
    node: &Syntax<'_>,
    language: Language,
    env: &Bindings,
    hits: &mut Vec<CredentialFileWrite>,
) {
    let Some(transfer) = classify(node, language, env) else {
        return;
    };
    // Destination semantics are part of the API, not a guess based on whether
    // this machine happens to have the target directory. Exclusive/no-clobber
    // flags still permit creation; they are not append-only exemptions.
    match transfer.operation {
        Operation::CopyFile | Operation::Rename => record(
            node,
            &transfer.api,
            "creates or replaces",
            transfer.destination.as_ref(),
            hits,
        ),
        Operation::Copy | Operation::Move => record_placement(
            node,
            &transfer.api,
            transfer.source.as_ref(),
            transfer.destination.as_ref(),
            hits,
        ),
        Operation::CopyTree => record_tree(
            node,
            &transfer.api,
            "writes a tree at",
            transfer.destination.as_ref(),
            hits,
        ),
        Operation::HardLink => record(
            node,
            &transfer.api,
            "creates a hard link at",
            transfer.destination.as_ref(),
            hits,
        ),
        Operation::SymbolicLink => record_tree(
            node,
            &transfer.api,
            "creates a symbolic link at",
            transfer.destination.as_ref(),
            hits,
        ),
    }
    match transfer.operation {
        Operation::Rename => record(
            node,
            &transfer.api,
            "removes the source name of",
            transfer.source.as_ref(),
            hits,
        ),
        // shutil.move also moves directories, including a .aws/.config tree
        // whose root is not itself a protected file. Copy operations never
        // inspect this source-side mutation: they only read their sources.
        Operation::Move => record_tree(
            node,
            &transfer.api,
            "removes the source path or tree at",
            transfer.source.as_ref(),
            hits,
        ),
        Operation::CopyFile
        | Operation::Copy
        | Operation::CopyTree
        | Operation::HardLink
        | Operation::SymbolicLink => {}
    }
}

fn record(
    node: &Syntax<'_>,
    api: &str,
    effect: &str,
    path: Option<&ResolvedPath>,
    hits: &mut Vec<CredentialFileWrite>,
) {
    let Some((path, expands_home)) = path else {
        return;
    };
    let Some(rule) = protected(path, Access::Write, *expands_home) else {
        return;
    };
    record_rule(node, api, effect, path, rule, hits);
}

fn record_rule(
    node: &Syntax<'_>,
    api: &str,
    effect: &str,
    path: &str,
    rule: &'static str,
    hits: &mut Vec<CredentialFileWrite>,
) {
    if !hits.iter().any(|hit| hit.rule == rule) {
        hits.push(CredentialFileWrite {
            span: node.range(),
            rule,
            reason: format!(
                "{api} {effect} protected target {path:?}. File transfers are not append-only updates. Stage the proposed change for review or use dcg allow-once."
            ),
        });
    }
}

/// A directory-capable destination can be either an exact file or a con
```

### Core Architecture Module: `src/packs/core/credential_files/shell.rs`
```
//! Semantic classifier behind `core.filesystem:credential-file-write`.
//!
//! The rule denies any command that WRITES a credential, private-key,
//! login-shell startup, or system authentication file, whether or not the
//! file exists yet: every truncating or appending redirect spelling, `tee` and
//! `sponge`, `cp`/`mv`/`install`/`ln` onto the path or into its directory,
//! `dd of=`, and `sed -i`/`perl -i`. Reads, `chmod`/`chown`, `ssh-keygen`,
//! and appending to `~/.ssh/known_hosts` (what `ssh` itself does) are
//! untouched.
//!
//! It is a classifier rather than a regex because the answer depends on the
//! path the shell will actually hand to `open()`: quote removal, backslash
//! escapes, brace expansion, globs, `$HOME`/`~user` forms, and `..` all change
//! it. Each target word is decoded with the shell's own quoting rules into
//! text plus a per-character "literal" flag, using the whitelist introduced
//! for the #390 carve-out (ce11b48): a character is literal when it was quoted
//! or escaped, is non-ASCII, or is one of the bare characters no supported
//! shell rewrites. A spelling that is not literal to the end cannot be proven
//! harmless, so it is denied whenever its literal prefix can still complete
//! into a protected path (`~/.zshr{c..c}`, `~/.ssh/id_*`, `~/{.zshrc,x}`) and
//! ignored when it cannot (`~/notes-{a,b}.txt`).
//!
//! PowerShell and Cmd payloads are read by [`windows_shells`], which decodes
//! their words into the same [`Word`] model so every path decision below is
//! shared rather than re-implemented per dialect (#477).

use crate::normalize::{ShellDialect, is_env_assignment};
use crate::packs::PatternSuggestion;
use std::ops::Range;

mod windows_shells;

/// Rule name under `core.filesystem`. The pattern entry in
/// `filesystem::create_destructive_patterns` carries the static reason shown
/// by `dcg rules` and the generated docs; every evaluator hit carries its own
/// reason naming the writer and the file.
pub(crate) const CREDENTIAL_FILE_WRITE_NAME: &str = "credential-file-write";

/// Rule name for a write into a `.git` directory (#457).
///
/// Separate from [`CREDENTIAL_FILE_WRITE_NAME`] on purpose, and the reason is
/// allowlists rather than wording. Allowlists key on the rule name, so a
/// project that legitimately rewrites `.git/config` would otherwise have to
/// allow `credential-file-write` — and that one entry would also permit a
/// write to `~/.ssh/authorized_keys`. Repository state and private keys are
/// not the same grant and must not share a name.
pub(crate) const GIT_INTERNALS_WRITE_NAME: &str = "git-internals-write";

/// The single path component that anchors [`GIT_INTERNALS_WRITE_NAME`].
const GIT_ANCHOR: &str = ".git";

/// What [`may_name_protected_path`] looks for instead of the bare [`GIT_ANCHOR`].
const GIT_ANCHOR_NEEDLE: &str = ".git/";

/// Safer alternatives for a `.git` write, attached to the pack pattern.
///
/// Deliberately not [`CREDENTIAL_FILE_WRITE_SUGGESTIONS`]: `chmod 600` and
/// appending to `known_hosts` are meaningless here, and the useful advice is
/// the porcelain command that does the same job with git's own validation.
pub(crate) const GIT_INTERNALS_WRITE_SUGGESTIONS: &[PatternSuggestion] = &[
    PatternSuggestion::new(
        "git config <key> <value>",
        "Let git edit its own config; it validates the key and picks the right scope",
    ),
    PatternSuggestion::new(
        "git remote set-url origin <url>",
        "Change a remote through porcelain rather than by rewriting .git/config",
    ),
    PatternSuggestion::new(
        "cat .git/config",
        "Read the current content first; reads are never blocked",
    ),
    PatternSuggestion::new(
        "git config --list --show-origin",
        "Show the user which file and key you intend to change, and let them apply it",
    ),
];

/// Safer alternatives attached to the pack pattern (its reason and
/// explanation live on the `destructive_pattern!` entry in `filesystem.rs`).
pub(crate) const CREDENTIAL_FILE_WRITE_SUGGESTIONS: &[PatternSuggestion] = &[
    PatternSuggestion::new(
        "cat {path}",
        "Read the current content first; reads are never blocked",
    ),
    PatternSuggestion::new(
        "echo data > /tmp/{subdir}/proposed && cat /tmp/{subdir}/proposed",
        "Stage the proposed content in a scratch file and let the user apply it",
    ),
    PatternSuggestion::new(
        "echo data >> ~/.ssh/known_hosts",
        "Appending a host key to known_hosts is allowed (what ssh itself does)",
    ),
    PatternSuggestion::new(
        "chmod 600 {path}",
        "Tightening permissions on a credential file is allowed",
    ),
];

/// One classified write of a protected file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CredentialFileWrite {
    /// Byte range of the offending target (or `dd of=` operand) in the
    /// segment handed to [`classify_credential_file_write`].
    pub(crate) span: Range<usize>,
    /// Reason naming the writer, the file, and why it matters.
    pub(crate) reason: String,
    /// Which rule denies this write — [`CREDENTIAL_FILE_WRITE_NAME`] for
    /// everything that is a secret or a login file, and
    /// [`GIT_INTERNALS_WRITE_NAME`] for `.git/`. Carried on the hit rather
    /// than assumed by the caller so allowlists stay separable (#457).
    pub(crate) rule: &'static str,
}

/// Which rule a resolved path denies under.
///
/// The `.git` anchor is the one entry in [`ENTRIES`] that is not a credential,
/// key or login-shell file, so it is the one case that answers differently.
/// Keyed on the leading component because every spelling that reaches here has
/// already been rebased onto its anchor.
fn rule_for(comps: &[String]) -> &'static str {
    if comps
        .first()
        .is_some_and(|component| component.eq_ignore_ascii_case(GIT_ANCHOR))
    {
        GIT_INTERNALS_WRITE_NAME
    } else {
        CREDENTIAL_FILE_WRITE_NAME
    }
}

/// Classify one command segment (may contain several simple commands).
///
/// Returns the first write of a protected file, or `None` when the segment
/// contains no such write.
///
/// The payload's dialect decides how it is read, never the host's: `pwsh`
/// runs on Linux and macOS, and a `powershell` tool name resolves to
/// PowerShell wherever dcg runs (#451). Until #477 this returned `None` for
/// PowerShell and Cmd outright, so `echo x >> ~/.ssh/authorized_keys` — the
/// persistence write this rule exists for — was allowed from a PowerShell
/// tool while the same bytes denied from Bash. Declining was protecting the
/// POSIX parser below, not expressing a policy, and declining is the
/// fail-open direction. The unknown dialect reads the segment every way it
/// could be meant, because the caller could not prove which shell runs it.
pub(crate) fn classify_credential_file_write(
    segment: &str,
    dialect: ShellDialect,
) -> Option<CredentialFileWrite> {
    if !may_name_protected_path(segment) {
        return None;
    }
    let posix = || {
        tokenize(segment)
            .split(|token| matches!(token, Token::Separator))
            .find_map(classify_simple_command)
    };
    match dialect {
        ShellDialect::Posix => posix(),
        ShellDialect::PowerShell | ShellDialect::Cmd => windows_shells::classify(segment, dialect),
        ShellDialect::Unknown => posix()
            .or_else(|| windows_shells::classify(segment, ShellDialect::PowerShell))
            .or_else(|| windows_shells::classify(segment, ShellDialect::Cmd)),
    }
}

/// Whether `command` names a PowerShell or Cmd writer this classifier reads.
///
/// The pack's keyword gates know POSIX writers only, so without this an
/// `Add-Content ~/.ssh/authorized_keys` never selected core.filesystem at all
/// and the classifier behind it could not run. Gated on
/// [`may_name_protected_path`] first for the same reason the POSIX writer
/// words are: `copy` and `move` are ordinary words.
pub(crate) fn names_windows_shell_writer(command: &str) -> bool {
    may_name_protected_path(command) && windows_shells::names_writer(command)
}

/// Whether a decoded command word names one of the writers this classifier
/// understands. Used by the pack's candidate gate so an obfuscated argv0
/// (`t''ee`, `\tee`) still selects core.filesystem.
pub(crate) fn is_credential_writer(executable: &str) -> bool {
    writer_kind(executable).is_some()
}

/// Whether one operand names a file in the protected credential and
/// login-startup set (#469).
///
/// `rm /etc/shadow` and `rm ~/.ssh/authorized_keys` were allowed because the
/// `rm` rules all require a recursive flag, while `unlink`, `shred -u` and
/// `truncate -s 0` deny the same targets. The obvious repair — reusing
/// `path_is_root_home`, which the recursive rules use — is measurably wrong:
/// that predicate matches anything under `/home`, `/etc` or `/var`, so it would
/// also deny `rm /home/user/notes.txt`, i.e. the single most common operation
/// an agent performs in its own working tree. A wide net is affordable for
/// `rm -rf` and is not affordable here.
///
/// This table is the narrow predicate that case needs, and it already exists —
/// it is what `credential-file-write` decides on. What was missing was a way to
/// ask it a path-only question. So this is the same `resolve` + [`exact`] pair
/// [`judge_file_target`] uses, with the writer dropped:
///
/// - No [`Writer`], because deletion has no write mode. `append_ok` is a
///   write-mode carve-out (`~/.ssh/known_hosts` may be appended to) and says
///   nothing about deleting the file, so it is deliberately ignored.
/// - [`Exact::Parent`] is not a hit. It means "an ancestor of a protected
///   path", which for a non-recursive delete is either a directory `rm` cannot
///   remove or a bare root.
/// - An unresolved spelling — a `..` climb, or an expansion that stops the
///   literal prefix early — returns `None` rather than the write path's
///   "ca
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #396** (2026-09-16): **[False Positive] rm-rf-general does not fold a literal assignment or `$(mktemp -d)` that redirect-truncate-dynamic-path already folds**
  *Symptoms*: ### Blocked Command  D=/private/tmp/dcg-corpus-nonexistent; rm -rf "$D/work"  ### Expected Behavior  Within the same command list, dcg already resolves `$D` to its literal assignment for the redirect rule (#275, closed 2026-08-05: literal-assignment folding and `$(mktemp -d)` recognition for redirect-truncate-dynamic-path). The rm operand in the same command does not get that folding, so the same value allows as a redirect target and denies as an rm operand:  | Command text | Observed (0.14.1) | |---|---| | `D=/private/tmp/dcg-corpus-nonexistent; echo x > "$D/a.log"` | allow (folded) | | `D=/private/tmp/dcg-corpus-nonexistent; rm -rf "$D/work"` | deny, core.filesystem:rm-rf-general | | `W=$(mktemp -d); echo x > "$W/out.log"` | allow (mktemp understood) | | `W=$(mktemp -d); rm -rf "$W/work"` | deny, core.filesystem:rm-rf-general | | `rm -rf /private/tmp/dcg-corpus-nonexistent/work` | allow |  So this is not "static analysis cannot know what $D holds"; dcg knows it in the very same command for a different rule. Expected: the rm temp exemption sees the same folded value the redirect rule sees. The consequence #275's own text warned about is an incentive inversion: spelling the scratchpad literally passes, so the guard nudges agents away from `mktemp -d` toward hard-coded temp paths, and in this install's blocked.log that is 138 refusals across 72 sessions of exactly this cleanup shape.  ### Output of `dcg explain`  ```shell Decision: DENY Rule ID:    core.filesystem:rm-rf-genera
  **Post-Mortem & Fix Analysis**:
  > Fixed and released in [v0.14.4](https://github.com/Dicklesworthstone/destructive_command_guard/releases/tag/v0.14.4).
  > Detail on the approach, since your report argued the design point rather than just the symptom.  You were right that this is not "static analysis cannot know what `$D` holds" — dcg knows it in the same command for a different rule. Rather than re-deriving rm's operand semantics next to the redirect proof, the proven values are now spliced into the segment and the **real rm classifier is asked again**. Only an independent `Allow` on that resolved text lifts the denial, so traversal handling, flag parsing, the temp-root set and every other rm rule still decide the command that would actually run. The proof reuses the same `resolved_variable_values` machinery #275 uses, so the single-binding, no-reassignment, no-subshell and mutation-hazard conditions are shared rather than reimplemented.  One extra restriction worth stating: a proven value is only spliced when it is inert to substitute — no whitespace, globs or shell metacharacters. `D="/tmp/a b"` would word-split at an unquoted use site

- **Issue #395** (2026-09-16): **[False Positive] rm-rf-general denies `rm -rf -- /tmp/<dir>/…`: the end-of-options guard costs the literal temp exemption**
  *Symptoms*: ### Blocked Command  rm -rf -- /tmp/dcg-corpus-nonexistent/work  ### Expected Behavior  `rm -rf /tmp/dcg-corpus-nonexistent/work` is allowed by the core.filesystem temp safe patterns. Inserting `--`, the POSIX end-of-options marker that stops a path beginning with `-` from being read as a flag, makes the command strictly safer and is what a careful script writes; it should not fall out of the exemption. All eight rm temp safe patterns are anchored as `^rm\s+-<flags>\s+(<tmp path>\s*)+$` with no slot for `--` (rm-rf-tmp: `^rm\s+-[a-zA-Z]*[rR][a-zA-Z]*f[a-zA-Z]*\s+(?:(?:/private)?/tmp/…\S*(?:\s+|$))+$`), so the safer spelling falls through to the rm-rf-general catch-all:  | Command text | Observed (0.14.1) | |---|---| | `rm -rf /tmp/dcg-corpus-nonexistent/work` | allow | | `rm -rf /private/tmp/dcg-corpus-nonexistent/work` | allow | | `rm -rf /var/tmp/dcg-corpus-nonexistent/work` | allow | | `rm -rf -- /tmp/dcg-corpus-nonexistent/work` | deny, core.filesystem:rm-rf-general | | `rm -rf -- /private/tmp/dcg-corpus-nonexistent/work` | deny, core.filesystem:rm-rf-general | | `rm -rf -- /var/tmp/dcg-corpus-nonexistent/work` | deny, core.filesystem:rm-rf-general | | `rm -fr -- /tmp/dcg-corpus-nonexistent/work` | deny, core.filesystem:rm-rf-general | | `rm -rf -- /Users/z/x` | deny, core.filesystem:rm-rf-root-home (correct) |  Allowing an optional `(?:--\s+)?` before the operand list in the temp safe patterns widens accepted syntax only to `--` forms while keeping eligible operands rest
  **Post-Mortem & Fix Analysis**:
  > Fixed and released in [v0.14.4](https://github.com/Dicklesworthstone/destructive_command_guard/releases/tag/v0.14.4).

- **Issue #394** (2026-09-16): **[False Positive] database.mysql:truncate-table denies non-SQL file operands (`cat truncate x`)**
  *Symptoms*: ### Blocked Command  cat truncate x  ### Expected Behavior  This is a read of two files named `truncate` and `x`. There is no SQL client, no shell embedding and no `TRUNCATE TABLE` statement anywhere in the command. The rule's regex is `(?i)TRUNCATE\s+(?:TABLE\s+)?[a-zA-Z_]`, which matches the word `truncate` followed by any identifier with no SQL execution context, so plain file readers whose operands happen to be named like SQL are denied as "would delete database rows":  | Command text | Observed (0.14.1) | |---|---| | `cat truncate x` | deny, database.mysql:truncate-table | | `sort truncate b` | deny, database.mysql:truncate-table | | `wc -l truncate x` | deny, database.mysql:truncate-table | | `rg truncate x 2>&1` | allow | | `mysql -e "TRUNCATE TABLE probe"` | deny, database.mysql:truncate-table (correct) |  Expected: allow the unrelated file readers while keeping the real SQL denial. The `rg` control shows a reader can already pass, so the gap is missing SQL context on the rule rather than the keyword gate. One possible direction is to scope the rule to SQL execution contexts (a SQL client executable, `-e`/`--execute`, a heredoc or piped statement) and keep the reader/SQL differential above as regression coverage; the maintainer should choose how those contexts are recognized.  ### Output of `dcg explain`  ```shell Decision: DENY Rule ID:    database.mysql:truncate-table Span:       bytes 4..14 Matched:    truncate x full_evaluation matched keyword "database.mysql" Reg
  **Post-Mortem & Fix Analysis**:
  > Quick visibility check: I filed #394 - #400 together on September 8. I noticed the later #401 - #405 batch was triaged and released in v0.14.3. Guessing either you selected the five newest reports or selected a post-v0.14.2 batch. Really appreciate dcg and how quick and responsive you've been with updates, and just wondering if a comment will bump these back in to your triage queue. No urgency, I just wanted to ensure that the notifications arrived. All seven still appear to be relevant on 0.14.3.
  > Fixed and released in [v0.14.4](https://github.com/Dicklesworthstone/destructive_command_guard/releases/tag/v0.14.4).

- **Issue #379** (2026-09-02): **[False Positive] PowerShell `n escape is treated as unparseable POSIX backtick substitution in Codex hook (0.14.0)**
  *Symptoms*: ### Blocked Command  $a=[IO.File]::ReadAllLines('x'); [string]::Join("`n",$a[239..($a.Length-1)])  ### Expected Behavior  This command should be allowed because it performs no destructive operation.  In PowerShell, `` `n `` inside a double-quoted string is a newline escape, not command substitution. DCG allows the command when evaluated explicitly as PowerShell:  ```powershell dcg test --dialect ps '$a=[IO.File]::ReadAllLines(''x''); [string]::Join("`n",$a[239..($a.Length-1)])' ```  Replacing "`n" with "X" also makes the POSIX evaluation allow the command. This isolates the false positive to interpretation of the PowerShell backtick escape.  ### Output of `dcg explain`  ```shell ══════════════════════════════════════════════════════════════════   DCG EXPLAIN   ══════════════════════════════════════════════════════════════════    Decision: DENY   Latency:  3.2ms    ─── Command ───────────────────────────────────────────────────────   Input:      $a=[IO.File]::ReadAllLines('x'); [string]::Join("`n",$a[239..($a.Length-1)])    ─── Match ─────────────────────────────────────────────────────────   Reason:     ambiguous command substitution could not be parsed as POSIX shell syntax   Explanation: Matched a destructive pattern. No additional explanation is available yet. See pack documentation for details.    ─── Pipeline Trace ────────────────────────────────────────────────   full_evaluation    (   3.1ms) no match    ═════════════════════════════════════════════════════════════════
  **Post-Mortem & Fix Analysis**:
  > Confirmed on 0.14.0, and thank you for the dialect comparison — it isolates the problem precisely.  **Root cause.** This is dialect resolution, not the backtick lexer. Codex names its shell tool `Bash` on every platform (its hooks schema mirrors Claude Code's), and dcg maps a `Bash` label to the POSIX dialect. On native Windows, though, Codex executes the command through the user's default shell, which it resolves to PowerShell (`codex-rs/shell-command/src/shell_detect.rs`, `default_user_shell_from_path`: `cfg!(windows)` → `pwsh`, else Windows PowerShell). Evaluated as POSIX, `"`n"` opens a backquote that never closes, tree-sitter recovers with an error region that conceals substitution syntax, and the fail-closed rule fires.  **Fix (79b787c, ships in the next release).** A `Bash`-labelled payload that is classified as Codex (`turn_id` present) and evaluated by a dcg running on Windows now resolves to the PowerShell dialect — the same path `dcg test --dialect ps` takes. The mapping is 

- **Issue #353** (2026-08-27): **DSR releases omit installer-script checksums, so dcg update executes an unverified tag-pinned installer**
  *Symptoms*: ## Summary  The real macOS v0.12.5 to v0.13.3 updater replay resolved #342, but exposed a separate release-integrity gap:  ```text dcg update: downloading and verifying install.sh from v0.13.3. curl: (56) The requested URL returned error: 404 dcg update: install.sh.sha256 not published for this tag; proceeding without verification. ```  The updater downloads `install.sh` from the target tag, then requests `install.sh.sha256` from that GitHub Release. The strict DSR v0.13.3 contract publishes exactly 20 binary/checksum/signature assets and omits `install.sh`, `install.ps1`, and their checksum/signature sidecars. Compatibility behavior therefore executes the tag-pinned installer after the checksum 404. The installer later verifies the selected archive checksum and current-key minisign, but the already-executing installer script itself was authenticated only by the HTTPS/tag path.  ## Evidence  On real arm64 macOS, an official v0.12.5 binary verified at SHA256 `6dfdfd7a6c48c36de960914fb43b9b9e295153c27adc151e112f0c50ca5b863c` successfully ran:  ```text dcg update --version v0.13.3 --dest <isolated-dir> --no-configure --verify --no-gum ```  The target archive then passed its adjacent SHA256 and minisign under key `69B3955C8D2E62A8`, installed as 0.13.3, and exposed tag `v0.13.3` plus full SHA `de8e7e2dcb8eeefd79145354508a0d9fdd0ceb4e`. This issue is only about the earlier installer-script verification warning.  ## Recommended fix  - Extend the strict DSR contract to require tag-e
  **Post-Mortem & Fix Analysis**:
  > Fixed and publicly proven in v0.13.4.  DSR published an exact 26-asset release contract containing both tag-pinned installers, install.sh.sha256, install.ps1.sha256, their current-key minisign signatures, all six binary archives, archive checksum sidecars/signatures, and signed SHA256SUMS: https://github.com/Dicklesworthstone/destructive_command_guard/releases/tag/v0.13.4  Evidence: - strict DSR build: 6/6 targets, exact source v0.13.4 at e8b8f9e21cf57b6fd2c5509b148684360ca596e0 - DSR public verification: expected 26, present 26, PASSED - protocol matrix: 41 passed, 0 failed - absolute evaluator gate: 9/9 paired cases passed; worst p95 86.775 ms against the 500 ms limit - full public fleet install: 70 passed, 0 failed, 0 skipped across macOS arm64, two Linux x64 hosts, and native Windows x64 - installer_checksum_verified passed before install on every host - official v0.13.3 updater replay to v0.13.4 printed install.sh sha256 verified before executing it, then verified the archive chec

- **Issue #351** (2026-08-27): **Release v0.13.0 missing minisig files**
  *Symptoms*: I'm unable to install v0.13.0 with the '-RequireMinisig' flag (pwsh) due to the .minisig files missing from the latest release.  ```pwsh [*] Fetching minisign signature from https://github.com/Dicklesworthstone/destructive_command_guard/releases/download/v0.13.0/dcg-x86_64-pc-windows-msvc.zip.minisig [-] Required minisign signature could not be fetched from https://github.com/Dicklesworthstone/destructive_command_guard/releases/download/v0.13.0/dcg-x86_64-pc-windows-msvc.zip.minisig: Response status code does not indicate success: 404 (Not Found). ```
  **Post-Mortem & Fix Analysis**:
  > Confirmed against the live release. v0.13.0 has no `.minisig` sidecars, and the reported Windows signature URL returns 404. `-RequireMinisign` is correctly failing closed.  This is a release-assembly omission, not an installer parsing bug. I am keeping this open until all six published archives have verifiable signatures under the documented key, or a complete patch release supersedes v0.13.0. The public install path must then be rechecked with `-RequireMinisign -Verify -NoConfigure`.
  > The release fleet gate now fails unless every Unix and Windows public archive passes minisign verification under the documented key; it also requires the installer verification path and a complete probe result. The static release-gate assertion passes on main.  The existing v0.13.0 release still has no minisig sidecars, so this remains a deliberate public-path failure, not a completed fix. No advisory-side or CI-generated substitute signature was introduced. Keeping open until the release owner signs all platform archives with the long-lived DSR key (or explicitly approves a different key architecture), publishes the sidecars, and the real fleet install is green. 
  > Additional release-state finding: GitHub reports dist.yml, ci.yml, and release-automation.yml as disabled_manually. The minisign fleet requirement is present in source, but no Actions-based release path is operational while those workflows remain disabled. I have not re-enabled an explicit maintainer setting. This remains blocked on two owner decisions/actions: whether to re-enable the release workflows, and where the long-lived DSR minisign key is allowed to sign (local DSR only versus an approved CI secret/signing service). 

- **Issue #349** (2026-08-26): **fix(core.filesystem): carry pack guidance on every rm classifier denial**
  *Symptoms*: Illustration PR for #348. Merge it, adapt it, or use it as a reproduction — whichever fits.  ## What changes  The rm classifier builds its own hit and never walks `destructive_patterns`, so both call sites that consume `RmParseDecision::Deny` passed `explanation: None` and `suggestions: &[]` on to the denial. `Pack::pattern_guidance` now looks both up by the rule name the classifier already reports, and the call sites attach them. No deny/allow decision changes.  Four of the ten rule names that classifier can emit have no entry in `destructive_patterns` at all, because they have no regex — they exist only inside the classifier:      rm-recursive-general     rm-recursive-root-home     rm-recursive-unverified     powershell-remove-item-recursive  A name-keyed lookup against the pattern list alone leaves those four on the placeholder, and `rm -r ./build` is the everyday one: the most common cleanup an agent tries, denied, with the denial saying only that it was denied. Their guidance is authored beside the classifier and `pattern_guidance` falls back to it. Those rows are text and suggestions only, so adding one cannot change what the guard blocks, only what a blocked caller is told.  Guidance corrections in the same pass, each of which misleads specifically under an agent hook:  - `rm -ri` was the headline safe alternative with no caveat. With stdin closed it prompts, deletes nothing, and exits 0, so the caller reads success. The suggestion and the explanations now say so, and 
  **Post-Mortem & Fix Analysis**:
  > Thanks for this PR — it was read closely, and it made the fix better. I don't merge outside PRs (I'm responsible for anything with my name on it and don't have bandwidth to review and maintain contributions), but I do read them and independently decide whether and how to address the idea. Bug reports and PRs illustrating a fix are welcome, and this one illustrated it well.  The issue is addressed independently on main: 681e86b wires classifier denials through a by-name guidance lookup with an explicit table for the classifier-only rules, and 5996b9d regenerates the golden fixtures that had the placeholder frozen in. The secondary corrections you flagged — the `rm -ri` closed-stdin caveat, `~/.Trash` on macOS, `find -maxdepth` — are all covered, as is an inventory guard so a future classifier rule cannot ship mute. Closing per the contribution policy; the diagnosis credit is yours. 

- **Issue #348** (2026-08-26): **rm denials ship no explanation or suggestions: "No additional explanation is available yet"**
  *Symptoms*: ## Summary  Every denial decided by the `core.filesystem` rm classifier reaches the caller with no explanation and no suggestions, so the hook says:  ``` Explanation: Matched destructive pattern core.filesystem:rm-rf-general. No additional explanation is available yet. See pack documentation for details. ```  The pack does author an explanation for each of those rules, and that text is where the allowed cleanup grammar lives (`rm -ri`, the literal-`/tmp` exemption, move-aside). Dropping it is the difference between an agent that reads the answer and an agent that retries variants against the guard until something gets through.  Git denials in the same hook payload deliver their full explanation, which is what makes the gap easy to see side by side.  ## Reproduction  ``` $ printf '%s' '{"session_id":"x","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"rm -rf node_modules"},"cwd":"'"$PWD"'"}' | dcg | tail -1 | jq -r .hookSpecificOutput.remediation.explanation Matched destructive pattern core.filesystem:rm-rf-general. No additional explanation is available yet. See pack documentation for details.  $ printf '%s' '{"session_id":"x","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"git checkout -- foo.txt"},"cwd":"'"$PWD"'"}' | dcg | tail -1 | jq -r .hookSpecificOutput.remediation.explanation git checkout -- <path> discards all uncommitted changes to the specified files in your working directory. These changes are permanently lost.
  **Post-Mortem & Fix Analysis**:
  > Correction to the "Proposed fix" section above: it says two rules stay on the placeholder after the name lookup. It is four. `rm-recursive-unverified` and `powershell-remove-item-recursive` are also built by the classifier and also have no `destructive_patterns` entry, so a lookup against the pattern list alone leaves all four mute:      rm-recursive-general     rm-recursive-root-home     rm-recursive-unverified     powershell-remove-item-recursive  I have since authored guidance for all four in #349 rather than leaving them out, and added a check that reads the module back and fails when a new classifier rule constant appears without one, so the next rule cannot ship mute. The rows carry text and suggestions only, so no deny/allow decision moves. Wording is yours to overrule.  Two smaller corrections while I am here. `rm-glob-home`'s authored explanation also advertised `mv ~/Downloads/*.md ~/.local/share/Trash/`, so the macOS trash-path problem was in the pattern text as well as in t
  > Fixed on main in 681e86b (guidance wiring) and 5996b9d (golden fixtures regenerated off the frozen placeholder).  Your diagnosis was accurate on every point: the rm classifier built its own hit, and both call sites consuming `RmParseDecision::Deny` passed `explanation: None` / empty suggestions into the denial. Denials from the classifier now look up the authored explanation and safer alternatives by the rule name the classifier already reports; pattern-backed rules answer with the pattern's own text, and the four classifier-only rules (`rm-recursive-general`, `rm-recursive-root-home`, `rm-recursive-unverified`, `powershell-remove-item-recursive`) got authored guidance of their own. Tests now enforce that every rule the classifier can emit ships distinct, non-placeholder guidance naming at least one form dcg accepts, and that the rule inventory cannot drift when a new classifier rule is added.  The three secondary catches landed too: `rm -ri` is now advertised with the closed-stdin cav

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

### Incident Patch 1: `f0af822d` (2026-10-06)
**Commit Message**: fix: close shell hook and filesystem proof safety gaps

Connect Claude Code Monitor to the shell hook and migrate the installed
Bash and Bash|PowerShell matchers without losing sibling configuration.

Preserve active redirections when normalizing wrappers, and reject
missing wrapper option operands without panicking.

Invalidate permission-lifting variable proofs across unmodeled shell
mutation while retaining conservative denial-only candidates.

Keep remote, container, other-user, and explicit remote-parallel script
evaluation from using local home paths or indirect input-file contents
as evidence of safety. Retain safe temporary-path and local controls.

Add focused unit, hook, and installer regressions and update the
documented hook matcher and filesystem-evidence boundaries.

Refs #529, #531, #521, #534, #536

**File**: `README.md` (modified, +28/-9)
```diff
@@ -1292,7 +1292,7 @@ Add to `~/.claude/settings.json`:
   "hooks": {
     "PreToolUse": [
       {
-        "matcher": "Bash|PowerShell",
+        "matcher": "Bash|PowerShell|Monitor",
         "hooks": [
           {
             "type": "command",
@@ -1311,20 +1311,21 @@ non-interactive shell whose `PATH` may omit `~/.local/bin`, causing the hook to
 fail open. On native Windows, let `install.ps1` write the PowerShell-safe
 absolute invocation (`& 'C:\...\dcg.exe'` plus `"shell": "powershell"`).
 
-Claude Code exposes separate `Bash` and `PowerShell` shell tools on Windows, so
-the combined matcher is required for complete shell coverage. The native
+Claude Code exposes `Bash`, `PowerShell`, and `Monitor` tools that can execute
+shell commands. `Monitor` runs its `command` as a POSIX shell script; its
+commandless WebSocket (`ws`) mode needs no command evaluation. The native
 PowerShell installer also runs dcg through an explicitly selected PowerShell
 hook shell; this prevents Git Bash from stripping backslashes out of an
 absolute `C:\...\dcg.exe` path. Re-running the installer migrates a legacy
-dcg-only `Bash` entry while preserving unrelated Bash-only hooks.
+dcg hook while preserving unrelated hooks under their original matchers.
 
 **Important:** Restart Claude Code after adding the hook configuration.
 
-The matcher is a regex over the tool name and must cover **both** shells: on
-native Windows, Claude Code runs shell commands through a `PowerShell` tool, so
-a `Bash`-only matcher leaves every PowerShell command unguarded. `dcg install`,
-the installers, and `dcg doctor --fix` all write `Bash|PowerShell` and migrate a
-pre-existing `Bash`-only dcg entry in place (no duplicate hook is added).
+The matcher is a regex over the tool name and must cover **all three** tools:
+omitting `PowerShell` or `Monitor` leaves their commands unguarded. `dcg install`,
+the installers, `dcg doctor --fix`, and hook self-healing all write
+`Bash|PowerShell|Monitor` and migrate pre-existing `Bash` or `Bash|PowerShell`
+dcg entries without adding duplicate hooks or widening unrelated matchers.
 
 ## Codex CLI Configuration
 
@@ -3050,6 +3051,24 @@ roots, and `-u`/`--dry-run` keep their denials. This built-in proof does not add
 a configurable dynamic-path exemption, and every other redirect and command
 is still checked.
 
+**Filesystem evidence belongs to the environment running the script.** The
+new-home-file allowance uses local filesystem checks and therefore applies
+only to local scripts. An extracted SSH, container, namespace, or other-user
+script cannot use a same-named local file to establish that its redirect is
+safe ([#534](https://github.com/Dicklesworthstone/destructive_command_guard/issues/534)).
+For example, `ssh host 'echo x > ~/notes.txt'` stays denied even if the local
+`~/notes.txt` is absent. A local redirect such as
+`ssh host 'echo x' > ~/new-notes.txt` keeps the local creation checks. Append
+and proven temporary paths in the remote script remain available, subject to
+the existing credential and Git protections.
+
+The same boundary applies to files consumed by nested database or shell
+commands: remote files are unverified rather than read from the local disk.
+With the PostgreSQL pack enabled, remote `psql` startup files are unverified
+too; `-X` / `--no-psqlrc` disables those startup files so a literal SQL command
+can be evaluated directly. dcg does not connect to the other environment to
+inspect its files.
+
 **Credential and login files are never exempted by path.**
 `core.filesystem:credential-file-write` (writes to `~/.ssh/*`,
 `~/.aws/credentials`, `~/.netrc`, `~/.npmrc`, the shell rc files,
```

**File**: `SKILL.md` (modified, +1/-1)
```diff
@@ -222,7 +222,7 @@ Add to `~/.claude/settings.json`:
   "hooks": {
     "PreToolUse": [
       {
-        "matcher": "Bash|PowerShell",
+        "matcher": "Bash|PowerShell|Monitor",
         "hooks": [
           {
             "type": "command",
```

**File**: `docs/windows.md` (modified, +1/-1)
```diff
@@ -145,7 +145,7 @@ wire format is recognized on Windows. Hook *configuration* coverage:
 | Agent | Config path | Configured by |
 |-------|-------------|---------------|
 | Codex CLI | `%USERPROFILE%\.codex\hooks.json` | `install.ps1` (automatic full JSON merge, UTF-8 **no BOM**) |
-| Claude Code | `%USERPROFILE%\.claude\settings.json` | `install.ps1` (`Bash|PowerShell` matcher, PowerShell-safe absolute command, full JSON merge, UTF-8 **no BOM**) |
+| Claude Code | `%USERPROFILE%\.claude\settings.json` | `install.ps1` (`Bash\|PowerShell\|Monitor` matcher, PowerShell-safe absolute command, full JSON merge, UTF-8 **no BOM**) |
 | Gemini CLI | `%USERPROFILE%\.gemini\settings.json` | `install.ps1` (full JSON merge, UTF-8 **no BOM**) |
 | GitHub Copilot CLI | `%COPILOT_HOME%\hooks\dcg.json` or `%USERPROFILE%\.copilot\hooks\dcg.json` | `install.ps1` (automatic user-level JSON merge) when Copilot is detected, or with `-EasyMode` / `-Force`; protects every workspace |
 | Cursor IDE | `%USERPROFILE%\.cursor\hooks.json` plus `%USERPROFILE%\.cursor\hooks\dcg-pre-shell.ps1` | `install.ps1` (pure PowerShell bridge; no Python dependency) |
```

**File**: `install.ps1` (modified, +3/-3)
```diff
@@ -569,7 +569,7 @@ function Configure-CodexHook {
   Merge-AgentHookFile -HooksFile $hooksFile -DcgHook $dcgHook -Event "PreToolUse" -Matcher "Bash" -Label "Codex hooks.json"
 }
 
-# Configure Claude Code's PreToolUse hook for both native shell tools in
+# Configure Claude Code's PreToolUse hook for Bash, PowerShell, and Monitor in
 # ~/.claude/settings.json. The hook itself runs in PowerShell so an absolute
 # Windows path is not reinterpreted by Git Bash (#232).
 # Configures when ~/.claude exists or `claude` is on PATH (or always under -Force,
@@ -594,7 +594,7 @@ function Configure-ClaudeHook {
     command = "& '$escapedDcgPath'"
     shell = "powershell"
   }
-  Merge-AgentHookFile -HooksFile $settingsFile -DcgHook $dcgHook -Event "PreToolUse" -Matcher "Bash|PowerShell" -Label "Claude settings.json" -OwnedMatchers @("Bash", "Bash|PowerShell")
+  Merge-AgentHookFile -HooksFile $settingsFile -DcgHook $dcgHook -Event "PreToolUse" -Matcher "Bash|PowerShell|Monitor" -Label "Claude settings.json" -OwnedMatchers @("Bash", "Bash|PowerShell", "Bash|PowerShell|Monitor")
 }
 
 # Configure Gemini CLI's BeforeTool / run_shell_command hook in
@@ -1399,7 +1399,7 @@ function Configure-HermesHook {
 #
 #   1. The matcher is lowercase "bash|powershell". A simple matcher string is
 #      an EXACT match (with "|"/"," separating alternatives) against the tool
-#      name, so Claude's "Bash|PowerShell" would match neither shell tool.
+#      name, so Claude's "Bash|PowerShell|Monitor" would match neither shell tool.
 #   2. Only documented handler fields are emitted: type, command, timeout. In
 #      particular there is NO `shell` field (which the Claude entry uses); the
 #      command path is quoted instead — shell-form hooks run through cmd.exe on
```

**File**: `install.sh` (modified, +17/-18)
```diff
@@ -2034,12 +2034,11 @@ if not isinstance(pre_tool_use, list):
     print("invalid")
     raise SystemExit(0)
 
-# Claude Code matchers are regexes over the tool name. `Bash` alone leaves the
-# native-Windows `PowerShell` tool completely unguarded (issue #226), so the
-# canonical dcg registration covers both. A dcg hook still sitting under the
-# legacy `Bash`-only matcher must be migrated, not left beside the new entry.
-CANONICAL_MATCHER = "Bash|PowerShell"
-LEGACY_MATCHERS = ("Bash",)
+# Claude Code matchers are regexes over the tool name. Guard shell commands
+# from Bash, native-Windows PowerShell (#226), and Monitor scripts (#529).
+# Migrate both older matchers instead of leaving duplicate dcg registrations.
+CANONICAL_MATCHER = "Bash|PowerShell|Monitor"
+LEGACY_MATCHERS = ("Bash", "Bash|PowerShell")
 
 dcg_commands = []
 predecessor_present = False
@@ -2093,9 +2092,9 @@ PYEOF
     else
       # Fallback for systems without python3; the merge path below is also
       # python-backed. Only trust the exact hook path when it is already the
-      # first command hook under the canonical `Bash|PowerShell` matcher — a
-      # legacy `Bash`-only registration must fall through to the merge so the
-      # native-Windows PowerShell tool stops being unguarded (issue #226).
+      # first command hook under the canonical `Bash|PowerShell|Monitor`
+      # matcher. Both legacy matchers must fall through to the merge so
+      # PowerShell and Monitor scripts receive the same protection.
       local dcg_hook_regex
       local compact_settings
       local dcg_command_marker
@@ -2111,7 +2110,7 @@ PYEOF
       if [ "$after_first_dcg" != "$compact_settings" ] &&
          [ "${after_first_dcg#*"$dcg_command_marker"}" = "$after_first_dcg" ] &&
          printf '%s\n' "$compact_settings" |
-           grep -Eq "\"matcher\":\"Bash\\|PowerShell\",\"hooks\":\\[\\{[^}]*\"command\":\"$dcg_hook_regex\""; then
+           grep -Eq "\"matcher\":\"Bash\\|PowerShell\\|Monitor\",\"hooks\":\\[\\{[^}]*\"command\":\"$dcg_hook_regex\""; then
         CLAUDE_STATUS="already"
         AUTO_CONFIGURED=1
         return 0
@@ -2189,11 +2188,11 @@ elif not isinstance(settings['hooks']['PreToolUse'], list):
     print(f"Claude Code settings.json PreToolUse must contain a list: {settings_file}", file=sys.stderr)
     raise SystemExit(1)
 
-# Claude Code matchers are regexes over the tool name. Registering only `Bash`
-# leaves the native-Windows `PowerShell` tool unguarded (issue #226), so dcg
-# owns a single `Bash|PowerShell` entry hoisted to the front of PreToolUse.
-CANONICAL_MATCHER = "Bash|PowerShell"
-LEGACY_MATCHERS = ("Bash",)
+# Claude Code matchers are regexes over the tool name. Guard Bash, PowerShell
+# (#226), and Monitor scripts (#529) through one dcg entry hoisted to the
+# front of PreToolUse.
+CANONICAL_MATCHER = "Bash|PowerShell|Monitor"
+LEGACY_MATCHERS = ("Bash", "Bash|PowerShell")
 
 # First pass: strip dcg (and, when asked, its predecessor) out of every entry
 # dcg may previously have owned. Other hooks keep their own matcher so their
@@ -2233,8 +2232,8 @@ for entry in settings['hooks']['PreToolUse']:
         new_pre_tool_use.append(entry)
 
 # Add exactly one current dcg hook, first, so it runs before any other hook.
-# Existing dcg hooks, including stale paths, duplicates, and legacy `Bash`-only
-# registrations, were collapsed above.
+# Existing dcg hooks, including stale paths, duplicates, and both legacy
+# matcher registrations, were collapsed above.
 new_pre_tool_use.insert(0, {
     "matcher": CANONICAL_MATCHER,
     "hooks": [{"type": "command", "command": dcg_path}]
@@ -2272,7 +2271,7 @@ PYEOF
   "hooks": {
     "PreToolUse": [
       {
-        "matcher": "Bash|PowerShell",
+        "matcher": "Bash|PowerShell|Monitor",
         "hooks": [
           {
             "type": "command",
```

**File**: `src/cli.rs` (modified, +102/-68)
```diff
@@ -11018,7 +11018,7 @@ fn doctor_pretty(fix: bool, config: &Config, config_sources: &[ConfigSourceOutco
             "  Hook registered with wrong matcher: {:?}",
             hook_diag.wrong_matcher_hooks
         );
-        println!("  → dcg must match both Claude shell tools ({CLAUDE_SHELL_MATCHER})");
+        println!("  → dcg must match all Claude shell tools ({CLAUDE_SHELL_MATCHER})");
         if fix {
             println!("  Attempting to migrate the hook...");
             if install_hook(true, false).is_ok() {
@@ -13024,8 +13024,8 @@ fn collect_doctor_report(
     }
 }
 
-const CLAUDE_SHELL_MATCHER: &str = "Bash|PowerShell";
-const LEGACY_CLAUDE_SHELL_MATCHER: &str = "Bash";
+const CLAUDE_SHELL_MATCHER: &str = "Bash|PowerShell|Monitor";
+const LEGACY_CLAUDE_SHELL_MATCHERS: &[&str] = &["Bash", "Bash|PowerShell"];
 const ANTIGRAVITY_SHELL_MATCHER: &str = "Bash";
 
 fn current_dcg_executable() -> std::io::Result<std::path::PathBuf> {
@@ -13595,7 +13595,7 @@ fn install_dcg_hook_into_settings(
         settings,
         force,
         CLAUDE_SHELL_MATCHER,
-        &[LEGACY_CLAUDE_SHELL_MATCHER],
+        LEGACY_CLAUDE_SHELL_MATCHERS,
         desired_hook,
     )
 }
@@ -22567,38 +22567,51 @@ if ((Get-Command dcg -ErrorAction SilentlyContinue) -and (Test-Path "$HOME\.clau
     }
 
     #[test]
-    fn install_into_settings_migrates_legacy_bash_hook_without_widening_siblings() {
-        let mut settings = serde_json::json!({
-            "hooks": {
-                "PreToolUse": [{
-                    "matcher": LEGACY_CLAUDE_SHELL_MATCHER,
-                    "hooks": [
-                        { "type": "command", "command": "dcg" },
-                        { "type": "command", "command": "bash-only-hook" }
-                    ],
-                    "customField": "preserve"
-                }]
-            }
-        });
+    fn install_into_settings_migrates_legacy_matchers_without_widening_siblings() {
+        for legacy_matcher in LEGACY_CLAUDE_SHELL_MATCHERS {
+            let mut settings = serde_json::json!({
+                "hooks": {
+                    "PreToolUse": [{
+                        "matcher": legacy_matcher,
+                        "hooks": [
+                            { "type": "command", "command": "dcg" },
+                            { "type": "command", "command": "original-tool-hook" }
+                        ],
+                        "customField": "preserve"
+                    }]
+                }
+            });
 
-        let changed = install_dcg_hook_into_settings(&mut settings, false).expect("migration ok");
-        assert!(changed, "legacy matcher should be migrated without --force");
+            let changed =
+                install_dcg_hook_into_settings(&mut settings, false).expect("migration ok");
+            assert!(
+                changed,
+                "{legacy_matcher} should be migrated without --force"
+            );
 
-        let pre = settings["hooks"]["PreToolUse"].as_array().unwrap();
-        assert_eq!(
-            pre.iter().filter(|entry| is_dcg_hook_entry(entry)).count(),
-            1
-        );
-        assert_eq!(pre[0]["matcher"], CLAUDE_SHELL_MATCHER);
-        assert_eq!(pre[0]["hooks"][0], claude_dcg_hook().expect("desired hook"));
+            let pre = settings["hooks"]["PreToolUse"].as_array().unwrap();
+            assert_eq!(
+                pre.iter().filter(|entry| is_dcg_hook_entry(entry)).count(),
+                1
+            );
+            assert_eq!(pre[0]["matcher"], CLAUDE_SHELL_MATCHER);
+            assert_eq!(pre[0]["hooks"][0], claude_dcg_hook().expect("desired hook"));
 
-        let legacy = pre
-            .iter()
-            .find(|entry| entry["matcher"] == LEGACY_CLAUDE_SHELL_MATCHER)
-            .expect("Bash-only sibling entry must remain");
-        assert!(entry_has_hook_command(legacy, "bash-only-hook"));
-        assert_eq!(legacy["customField"], "preserve");
-        assert!(!entry_has_hook_command(legacy, "dcg"));
+            let legacy = pre
+                .iter()
+                .find(|entry| entry["matcher"] == *legacy_matcher)
+                .expect("sibling entry must retain its original matcher");
+            assert!(entry_has_hook_command(legacy, "original-tool-hook"));
+            assert_eq!(legacy["customField"], "preserve");
+            assert!(!entry_has_hook_command(legacy, "dcg"));
+
+            let installed = settings.clone();
+            assert!(!install_dcg_hook_into_settings(&mut settings, false).unwrap());
+            assert_eq!(
+                settings, installed,
+                "{legacy_matcher} migration is idempotent"
+            );
+        }
     }
 
     #[test]
@@ -22736,23 +22749,28 @@ if ((Get-Command dcg -ErrorAction SilentlyContinue) -and (Test-Path "$HOME\.clau
 
     #[test]
     fn install_into_settings_refuses_malformed_legacy_matcher_hooks() {
-        let mut settings = serde_json::json!({
-            "hooks":
```

**File**: `src/evaluator.rs` (modified, +656/-109)
```diff
@@ -6664,6 +6664,7 @@ enum ExecutableTextSink {
         source: String,
         dialect: ShellDialect,
         context: &'static str,
+        nonlocal_filesystem: bool,
     },
     /// A sink whose executable source cannot be statically verified. Each
     /// site carries a stable dotted rule id (`heredoc.<family>.<name>`) so
@@ -7018,6 +7019,7 @@ fn collect_posix_eval_sinks(command: &str, sinks: &mut Vec<ExecutableTextSink>)
                 source,
                 dialect: ShellDialect::Posix,
                 context: "POSIX eval executes an embedded shell command",
+                nonlocal_filesystem: false,
             }),
             Err(()) => {
                 // The warn downgrade is sound only when this eval idiom is the
@@ -8033,6 +8035,38 @@ fn xargs_pipeline_input_mode(args: &[String]) -> PipelineShellInputMode {
     }
 }
 
+fn parallel_option_takes_value(argument: &str) -> bool {
+    matches!(
+        argument,
+        "-a" | "--arg-file"
+            | "-j"
+            | "--jobs"
+            | "-S"
+            | "--sshlogin"
+            | "--sshloginfile"
+            | "--joblog"
+            | "--results"
+            | "--workdir"
+            | "--tmpdir"
+            | "--timeout"
+            | "--delay"
+            | "--retries"
+            | "--tagstring"
+            | "--colsep"
+            | "--env"
+            | "--halt"
+            | "--header"
+            | "--load"
+            | "--memfree"
+            | "--nice"
+            | "--block"
+            | "--recend"
+            | "--recstart"
+            | "-d"
+            | "--delimiter"
+    )
+}
+
 fn parallel_pipeline_input_mode(args: &[String]) -> PipelineShellInputMode {
     if args.is_empty() {
         return PipelineShellInputMode::ReadsStdin(
@@ -8076,35 +8110,7 @@ fn parallel_pipeline_input_mode(args: &[String]) -> PipelineShellInputMode {
             index += 1;
             continue;
         }
-        if matches!(
-            argument.as_str(),
-            "-a" | "--arg-file"
-                | "-j"
-                | "--jobs"
-                | "-S"
-                | "--sshlogin"
-                | "--sshloginfile"
-                | "--joblog"
-                | "--results"
-                | "--workdir"
-                | "--tmpdir"
-                | "--timeout"
-                | "--delay"
-                | "--retries"
-                | "--tagstring"
-                | "--colsep"
-                | "--env"
-                | "--halt"
-                | "--header"
-                | "--load"
-                | "--memfree"
-                | "--nice"
-                | "--block"
-                | "--recend"
-                | "--recstart"
-                | "-d"
-                | "--delimiter"
-        ) {
+        if parallel_option_takes_value(argument) {
             let Some(value) = args.get(index + 1) else {
                 return PipelineShellInputMode::Unverified;
             };
@@ -8660,15 +8666,17 @@ fn split_pipeline_records(
 fn push_executable_input_source(
     source: IndirectInputSource,
     kind: PipelineSourceKind,
+    nonlocal_filesystem: bool,
     sinks: &mut Vec<ExecutableTextSink>,
 ) {
-    push_executable_input_source_at(source, kind, None, sinks);
+    push_executable_input_source_at(source, kind, None, nonlocal_filesystem, sinks);
 }
 
 fn push_executable_input_source_at(
     source: IndirectInputSource,
     kind: PipelineSourceKind,
     matched_span: Option<MatchSpan>,
+    nonlocal_filesystem: bool,
     sinks: &mut Vec<ExecutableTextSink>,
 ) {
     if sinks.len() >= MAX_EXECUTABLE_TEXT_SINKS {
@@ -8693,6 +8701,7 @@ fn push_executable_input_source_at(
                         IndirectInputSource::StaticProducer(record),
                         PipelineSourceKind::PosixShell,
                         matched_span,
+                        nonlocal_filesystem,
                         sinks,
                     );
                 }
@@ -8711,6 +8720,7 @@ fn push_executable_input_source_at(
                         IndirectInputSource::StaticProducer(record),
                         PipelineSourceKind::Interpreter(language),
                         matched_span,
+                        nonlocal_filesystem,
                         sinks,
                     );
                 }
@@ -8729,6 +8739,7 @@ fn push_executable_input_source_at(
                         IndirectInputSource::StaticProducer(record),
                         PipelineSourceKind::PowerShell,
                         matched_span,
+                        nonlocal_filesystem,
                         sinks,
                     );
                 }
@@ -8747,6 +8758,7 @@ fn push_executable_input_source_at(
                         IndirectInputSource::StaticProducer(record),
                         PipelineSourceKind::Cmd,
                         matched_span,
+                        nonlocal_filesystem,
                         sinks,
                     );
     
```

**File**: `src/heredoc.rs` (modified, +25/-0)
```diff
@@ -8540,6 +8540,31 @@ pub(crate) fn data_heredoc_bodies_whose_output_may_run(command: &str) -> Vec<Ran
     found
 }
 
+/// Preserve the association between a body and its input operator. The
+/// evaluator needs the operator's owning command to distinguish a remote
+/// script from a local command that happens to follow an ssh invocation.
+pub(crate) fn heredoc_bodies_with_operators(command: &str) -> Vec<(Range<usize>, usize)> {
+    active_heredocs(command)
+        .unwrap_or_default()
+        .into_iter()
+        .filter_map(|heredoc| {
+            let body = match heredoc.body {
+                ActiveHeredocBody::Heredoc {
+                    body_start,
+                    body_end,
+                    ..
+                } => body_start..body_end,
+                ActiveHeredocBody::HereString => {
+                    let (start, end) =
+                        find_herestring_content_bounds(command, heredoc.operator_start + 3)?;
+                    start..end
+                }
+            };
+            Some((body, heredoc.operator_start))
+        })
+        .collect()
+}
+
 /// `command` with every byte inside `ranges` (other than newlines) blanked.
 fn blank_ranges(command: &str, ranges: &[Range<usize>]) -> String {
     let mut outside = command.as_bytes().to_vec();
```

---

### Incident Patch 2: `ab8e41eb` (2026-10-06)
**Commit Message**: fix(filesystem): harden bounded temporary redirect proofs (#536)

Keep the reported temporary redirect forms while requiring complete scope, mutation, and protected-path proofs. Preserve the regressions from e5ba3fc4 and keep generic rm, mv, and executable-variable resolution on its existing rules.

Bound redirect resolution to eight binding levels, 4096 expanded bytes, and 256 segments. Resolve copies at assignment time, require dominating AND-list assignments, and reject traps, shell-maintained bindings, unsupported wrappers, traversal, and protected paths even below temporary roots.

Parse explicit directory-creating mktemp substitutions as bounded literal argv. Reject newlines, unsupported options, non-temporary roots, and hidden-directory templates whose random suffix could produce a protected name. Recognize complete unrelated mktemp assignments without mistaking their options for parent-shell wrappers.

Add focused unit tests and eight isolated hook tests covering 58 commands; retain all upstream regressions and clarify the README's dynamic-path wording.

Validation: cargo fmt --check; cargo check --locked --all-targets; cargo clippy --locked --all-targets -- -D warnings; 16

**File**: `README.md` (modified, +28/-14)
```diff
@@ -3020,21 +3020,35 @@ a home directory (`~/proj/dist`) or outside the system directories
 (`/data/proj/dist`) is `rm-rf-general`. Check `dcg explain "<command>"` for the
 rule id you actually need.
 
-**Unresolved dynamic paths are never exempted by configuration.**
+**Unresolved dynamic paths are never exempted.**
 `core.filesystem:redirect-truncate-dynamic-path` deliberately supports no
-exemptions. When the runtime target cannot be proven, a glob over it would be a
-bypass, not a carve-out. An ambient `echo x > $DIR/log`
-stays denied no matter what is configured. Independently of exemption globs,
-dcg can prove a bounded set of POSIX redirect targets benign: preceding literal
-assignments, up to eight assignments derived from proven variables with literal
-suffixes, decimal `$$` text, and `mktemp` with an explicit literal `/tmp` template
-or `-p /tmp` / `--tmpdir=/tmp`. An assignment after `&&` qualifies only when an
-uninterrupted `&&` chain guarantees it ran before the use. The complete resolved
-path must still pass the benign-target check; sensitive roots, `..` traversal,
-unknown expansions, ambiguous bindings, and unsupported `mktemp` options remain
-denied. No command is executed to resolve a target. The same rule applies inside
-the supported rules: a target containing a variable, command substitution, backtick, glob, or
-`%VAR%` is not a literal, and is never matched against an exemption glob.
+target-glob setting. `echo x > $DIR/log` stays denied when `DIR` is unknown,
+regardless of the configured globs. A variable, command substitution, backtick,
+glob, or `%VAR%` is never matched against an exemption glob as if its source
+text were the resolved path.
+
+Separately, dcg's bounded POSIX analysis can prove some redirect targets benign
+without executing shell code ([#536](https://github.com/Dicklesworthstone/destructive_command_guard/issues/536)):
+
+| Proven form | Example |
+|-------------|---------|
+| A literal assignment on the redirect's `&&` success path | `true && S=/tmp/d && echo hi > "$S/x"` |
+| A known variable with a literal suffix | `S=/tmp/d; T="$S/sub"; echo hi > "$T/x"` |
+| PID digits inside a literal `/tmp/` path | `echo hi > "/tmp/d-$$.log"` |
+| A supported `mktemp` substitution with an explicit temporary root | `D=$(mktemp -d /tmp/v-XXXXXX); echo hi > "$D/p"` or `D=$(mktemp -d -p /tmp); echo hi > "$D/p"` |
+
+Existing literal assignments and bare `$(mktemp)` / `$(mktemp -d)` scratch
+idioms remain supported. The final target must pass the benign-path checks,
+including rejection of every `..` component and protected credential or `.git`
+files, even beneath `/tmp`. The additional symbolic proof requires a temporary
+root and is limited to eight binding levels, 4,096 expanded bytes, and 256
+command segments. A binding that might be skipped before a running redirect,
+a binding in a pipeline or subshell, an unknown dependency, reassignment, or a
+variable-mutating command cannot establish this proof. Unrecognized `mktemp`
+syntax, templates for hidden directories, `/etc` roots, dynamic `$TMPDIR`
+roots, and `-u`/`--dry-run` keep their denials. This built-in proof does not add
+a configurable dynamic-path exemption, and every other redirect and command
+is still checked.
 
 **Credential and login files are never exempted by path.**
 `core.filesystem:credential-file-write` (writes to `~/.ssh/*`,
```

**File**: `src/evaluator.rs` (modified, +643/-151)
```diff
@@ -22205,23 +22205,16 @@ fn filesystem_pre_rm_pattern_excluding_dynamic(name: Option<&str>) -> bool {
     filesystem_pre_rm_pattern(name) && name != Some("redirect-truncate-dynamic-path")
 }
 
-/// Maximum derived-assignment edges followed by a redirect-target proof.
-const MAX_REDIRECT_DEPENDENCIES: usize = 8;
-
-/// Statically prove that a symbolic redirect resolves to a benign literal
+/// Statically prove that a redirect target resolves to a benign literal
 /// path, so `redirect-truncate-dynamic-path` need not fail closed on it.
 ///
-/// The proof is deliberately narrow (#249, #536): targets use
-/// `$NAME`/`${NAME}` plus literal suffixes, or literal text plus decimal `$$`.
-/// Exactly one preceding top-level segment must bind each referenced name
-/// to a literal, bounded derived value, or recognized scratch path. Conditional
-/// bindings qualify only in an uninterrupted AND-list leading to the use.
-/// No preceding segment may reassign the name or
-/// start with a builtin that can mutate parent-shell variables; every trailing
-/// redirect in the segment must be a static fd duplication (`2>&1`); and the
-/// resolved path must be a tmp-family or relative path with no `..` traversal
-/// — the shapes a direct literal redirect already passes. Anything else keeps
-/// today's fail-closed denial.
+/// The original proof (#249) accepts a single literal binding with a literal
+/// suffix. The bounded extension (#536) also accepts assignment-time copies
+/// of proven variables, bindings that dominate the use through an uninterrupted
+/// `&&` chain, explicit tmp-rooted `mktemp -d`, and decimal `$$` components.
+/// These additional forms must resolve under a tmp-family root. Rebinding,
+/// unknown values, unsupported control flow, traversal, protected files, and
+/// additional non-fd redirects all retain the dynamic-path denial.
 fn statically_safe_variable_redirect(
     source: &str,
     segment_ranges: &[(usize, usize)],
@@ -22277,28 +22270,46 @@ fn statically_safe_variable_redirect(
     if !trailing_redirects_are_fd_duplications(trailing) {
         return false;
     }
-    // A PID contributes digits only, so a stand-in preserves path boundaries.
-    // Reject every other expansion and still check the complete resulting path.
-    if token.contains("$$") {
-        let resolved = token.replace("$$", "1");
-        return resolved
-            .bytes()
-            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-' | b'.' | b'/'))
-            && resolved_redirect_target_is_benign(&format!("{resolved}{outer_suffix}"));
+    if token.len().saturating_add(outer_suffix.len()) > MAX_REDIRECT_VALUE_BYTES {
+        return false;
+    }
+    if let Some(path) = literal_pid_redirect_value(token) {
+        return resolved_redirect_target_is_benign(&format!("{path}{outer_suffix}"));
     }
     let Some((name, inner_suffix)) = parse_posix_variable_with_literal_suffix(token) else {
         return false;
     };
     let suffix = format!("{inner_suffix}{outer_suffix}");
-    let Some(values) = resolved_variable_values_inner(
-        source,
-        segment_ranges,
-        segment_start,
-        name,
-        Some(MAX_REDIRECT_DEPENDENCIES),
-    ) else {
-        return false;
+    let (values, requires_tmp_root) = if let Some(values) =
+        resolved_variable_values(source, segment_ranges, segment_start, name)
+    {
+        (values, false)
+    } else {
+        if segment_ranges.len() > MAX_REDIRECT_PROOF_SEGMENTS {
+            return false;
+        }
+        let Some(prefix) = source.get(..segment_start) else {
+            return false;
+        };
+        if !redirect_proof_has_simple_scope(prefix) {
+            return false;
+        }
+        let Some(values) = resolve_variable_bindings(
+            source,
+            segment_ranges,
+            segment_start,
+            name,
+            VariableResolution::Redirect {
+                remaining_depth: MAX_REDIRECT_BINDING_DEPTH,
+            },
+        ) else {
+            return false;
+        };
+        (values, true)
     };
+    if suffix.len() > MAX_REDIRECT_VALUE_BYTES {
+        return false;
+    }
     // An unquoted target lets a glob-bearing value expand further at run
     // time (shell-dependent), which the literal benign-path check cannot
     // cover; double-quoted targets never glob.
@@ -22309,9 +22320,150 @@ fn statically_safe_variable_redirect(
     {
         return false;
     }
-    values
+    values.iter().all(|value| {
+        if value.len().saturating_add(suffix.len()) > MAX_REDIRECT_VALUE_BYTES {
+            return false;
+        }
+        let path = format!("{value}{suffix}");
+        (!requires_tmp_root || redirect_path_has_tmp_root(&path))
+            && resolved_redirect_target_is_benign(&path)
+    })
+}
+
+/// Bound both recursive assignment copies and the bytes a proof may expand.
+const MAX_REDIRECT_BINDING_DEPTH: usize = 8;
+const MAX_REDIRECT_VALUE_BYTES: us
```

**File**: `tests/repro_390_absent_home_redirect.rs` (modified, +3/-2)
```diff
@@ -121,8 +121,9 @@ fn absent_literal_home_targets_are_creation_regardless_of_vcs() {
     );
 
     // A top-level file takes the same path as a dotdir. (`$HOME/...` is not
-    // in this table: `redirect-truncate-dynamic-path` fails closed on every
-    // `$`-bearing target by design, #249, independent of this carve-out.)
+    // in this table: `redirect-truncate-dynamic-path` fails closed on an
+    // unproven ambient `$HOME`, independent of this carve-out. Bounded proofs
+    // of temporary redirect targets are a separate exemption (#249, #536).)
     assert_eq!(verdict("echo hi > ~/absent-note.md", home), Verdict::Allow);
 
     // Credential files are not "creation like any other": the carve-out
```

**File**: `tests/repro_536_tmp_redirect_resolution.rs` (added, +229/-0)
```diff
@@ -0,0 +1,229 @@
+//! #536: bounded POSIX redirect resolution admits proven temporary paths.
+//!
+//! All command strings are sent as JSON data to the real Claude Code hook;
+//! they are never executed by a shell. Positive cases cover each reported
+//! spelling, while negative controls pin the proof's control-flow, scope,
+//! mutation, and path boundaries.
+
+use std::io::Write;
+use std::process::{Command, Stdio};
+
+/// `(decision, rule id)` from an isolated invocation of the real hook.
+fn hook(command: &str) -> (String, String) {
+    let temp = tempfile::tempdir().expect("temp dir");
+    let home = temp.path().join("home");
+    std::fs::create_dir_all(&home).expect("home");
+    let config = temp.path().join("config.toml");
+    std::fs::write(&config, "[history]\nenabled = false\n").expect("config");
+    let payload = serde_json::json!({
+        "hook_event_name": "PreToolUse",
+        "tool_name": "Bash",
+        "tool_input": { "command": command },
+    })
+    .to_string();
+
+    let mut child = Command::new(env!("CARGO_BIN_EXE_dcg"))
+        .env_clear()
+        .env("HOME", &home)
+        .env("USERPROFILE", &home)
+        .env("XDG_CONFIG_HOME", home.join("config"))
+        .env("XDG_DATA_HOME", home.join("data"))
+        .env("XDG_CACHE_HOME", home.join("cache"))
+        .env("APPDATA", home.join("appdata"))
+        .env("LOCALAPPDATA", home.join("localappdata"))
+        .env("TEMP", temp.path())
+        .env("TMP", temp.path())
+        .env("DCG_CONFIG", &config)
+        .env("DCG_ALLOWLIST_SYSTEM_PATH", "")
+        .env(
+            "DCG_PENDING_EXCEPTIONS_PATH",
+            temp.path().join("pending_exceptions.jsonl"),
+        )
+        .env("DCG_SELF_HEAL_HOOK", "0")
+        .env("DCG_HOOK_TIMEOUT_MS", "5000")
+        .current_dir(temp.path())
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .spawn()
+        .expect("spawn dcg");
+    child
+        .stdin
+        .take()
+        .expect("stdin")
+        .write_all(payload.as_bytes())
+        .expect("write hook payload");
+    let out = child.wait_with_output().expect("wait for dcg");
+    assert_eq!(
+        out.status.code(),
+        Some(0),
+        "hook exit code for {command:?}: {}",
+        String::from_utf8_lossy(&out.stderr)
+    );
+    let stdout = String::from_utf8_lossy(&out.stdout);
+    if stdout.trim().is_empty() {
+        return ("allow".to_string(), String::new());
+    }
+    let parsed: serde_json::Value = serde_json::from_str(&stdout)
+        .unwrap_or_else(|error| panic!("bad hook output for {command:?} ({error}): {stdout}"));
+    let output = &parsed["hookSpecificOutput"];
+    (
+        output["permissionDecision"]
+            .as_str()
+            .expect("permissionDecision")
+            .to_string(),
+        output["ruleId"].as_str().unwrap_or_default().to_string(),
+    )
+}
+
+fn assert_denied(command: &str) {
+    let (decision, rule) = hook(command);
+    assert_eq!(decision, "deny", "must deny {command:?}: {rule}");
+    assert!(!rule.is_empty(), "denial needs a rule id: {command:?}");
+}
+
+#[test]
+fn all_eight_reported_temporary_redirects_are_allowed() {
+    for command in [
+        // A: the assignment itself is reached along the && success path.
+        r#"mkdir -p /tmp/d && S=/tmp/d && echo hi > "$S/x""#,
+        r#"true && S=/tmp/d && echo hi > "$S/x""#,
+        // B: a later variable adds a literal suffix to a proven binding.
+        r#"S=/tmp/d; T="$S/sub"; echo hi > "$T/x""#,
+        r#"S=/tmp/d && T="$S/sub" && echo hi > "$T/x""#,
+        // C: a PID contributes only digits beneath the literal /tmp prefix.
+        "echo hi > /tmp/d-$$/x",
+        r#"echo hi > "/tmp/d-$$.log""#,
+        // D: mktemp has an explicit, provably temporary root.
+        r#"D=$(mktemp -d /tmp/v-XXXXXX); echo a > "$D/p""#,
+        r#"D=$(mktemp -d -p /tmp); echo a > "$D/p""#,
+    ] {
+        let (decision, rule) = hook(command);
+        assert_eq!(decision, "allow", "must allow {command:?}: {rule}");
+    }
+}
+
+#[test]
+fn existing_literal_and_bare_mktemp_controls_stay_allowed() {
+    for command in [
+        "echo hi > /tmp/d/x",
+        r#"S=/tmp/d; echo hi > "$S/x""#,
+        r#"S=/tmp/d; echo hi > "$S"/x 2>&1"#,
+        r#"D=$(mktemp); echo a > "$D""#,
+        r#"D=$(mktemp -d); echo a > "$D/p""#,
+        r#"D="$(mktemp -d --quiet)"; echo a > "$D/p""#,
+    ] {
+        let (decision, rule) = hook(command);
+        assert_eq!(
+            decision, "allow",
+            "baseline changed for {command:?}: {rule}"
+        );
+    }
+}
+
+#[test]
+fn proven_mktemp_bindings_can_feed_derived_redirect_targets() {
+    for command in [
+        r#"D=$(mktemp -d /tmp/v-XXXXXX); T="$D/sub"; echo hi > "$T/x""#,
+        r#"D=$(mktemp -d); T="$D/sub"; echo hi > "$T/x""#,
+        r#"true && D=$(mktemp -d -p /tmp) && T="$D/sub" && echo hi > "$T/x""#,
+    ] {
+        let (decision, rule) = hook(
```

---

### Incident Patch 3: `e5ba3fc4` (2026-10-06)
**Commit Message**: fix(filesystem): prove bounded symbolic redirect targets (#536)

Resolve guaranteed assignments in uninterrupted AND-lists, up to eight
derived variable assignments, decimal PID text, and explicit /tmp mktemp
roots. Preserve sensitive-path, traversal, ambiguous-binding, mutation,
and unknown-expansion denials. Other variable-resolution consumers keep
their existing proof.

Add focused POSIX/unknown-route unit and PreToolUse hook regressions, and
clarify static resolution versus configured target exemptions in README.

Validation: check and Clippy across all targets; formatting; redirect,
binding, variable, mktemp and core filesystem unit subsets; hook,
redirection-bypass, regression, false-positive and cross-pack corpora.
Test binaries used a package-only opt-level=0/debug=0 build override to
fit workspace memory, with existing deadlines unchanged.

Fixes #536

**File**: `README.md` (modified, +13/-5)
```diff
@@ -3020,12 +3020,20 @@ a home directory (`~/proj/dist`) or outside the system directories
 (`/data/proj/dist`) is `rm-rf-general`. Check `dcg explain "<command>"` for the
 rule id you actually need.
 
-**Dynamic paths are never exempted.**
+**Unresolved dynamic paths are never exempted by configuration.**
 `core.filesystem:redirect-truncate-dynamic-path` deliberately supports no
-exemptions. It exists precisely because the runtime target cannot be proven, so
-a glob over it would be a bypass, not a carve-out. `echo x > $DIR/log` stays
-denied no matter what is configured. The same rule applies inside the supported
-rules: a target containing a variable, command substitution, backtick, glob, or
+exemptions. When the runtime target cannot be proven, a glob over it would be a
+bypass, not a carve-out. An ambient `echo x > $DIR/log`
+stays denied no matter what is configured. Independently of exemption globs,
+dcg can prove a bounded set of POSIX redirect targets benign: preceding literal
+assignments, up to eight assignments derived from proven variables with literal
+suffixes, decimal `$$` text, and `mktemp` with an explicit literal `/tmp` template
+or `-p /tmp` / `--tmpdir=/tmp`. An assignment after `&&` qualifies only when an
+uninterrupted `&&` chain guarantees it ran before the use. The complete resolved
+path must still pass the benign-target check; sensitive roots, `..` traversal,
+unknown expansions, ambiguous bindings, and unsupported `mktemp` options remain
+denied. No command is executed to resolve a target. The same rule applies inside
+the supported rules: a target containing a variable, command substitution, backtick, glob, or
 `%VAR%` is not a literal, and is never matched against an exemption glob.
 
 **Credential and login files are never exempted by path.**
```

**File**: `src/evaluator.rs` (modified, +239/-17)
```diff
@@ -22205,13 +22205,18 @@ fn filesystem_pre_rm_pattern_excluding_dynamic(name: Option<&str>) -> bool {
     filesystem_pre_rm_pattern(name) && name != Some("redirect-truncate-dynamic-path")
 }
 
-/// Statically prove that a `$VAR`-target redirect resolves to a benign literal
+/// Maximum derived-assignment edges followed by a redirect-target proof.
+const MAX_REDIRECT_DEPENDENCIES: usize = 8;
+
+/// Statically prove that a symbolic redirect resolves to a benign literal
 /// path, so `redirect-truncate-dynamic-path` need not fail closed on it.
 ///
-/// The proof is deliberately narrow (#249): the target must be exactly
-/// `$NAME`/`${NAME}` (optionally double-quoted, optionally followed by a
-/// literal path suffix); exactly one preceding top-level segment must assign
-/// `NAME=` a literal value; no preceding segment may reassign the name or
+/// The proof is deliberately narrow (#249, #536): targets use
+/// `$NAME`/`${NAME}` plus literal suffixes, or literal text plus decimal `$$`.
+/// Exactly one preceding top-level segment must bind each referenced name
+/// to a literal, bounded derived value, or recognized scratch path. Conditional
+/// bindings qualify only in an uninterrupted AND-list leading to the use.
+/// No preceding segment may reassign the name or
 /// start with a builtin that can mutate parent-shell variables; every trailing
 /// redirect in the segment must be a static fd duplication (`2>&1`); and the
 /// resolved path must be a tmp-family or relative path with no `..` traversal
@@ -22272,11 +22277,26 @@ fn statically_safe_variable_redirect(
     if !trailing_redirects_are_fd_duplications(trailing) {
         return false;
     }
+    // A PID contributes digits only, so a stand-in preserves path boundaries.
+    // Reject every other expansion and still check the complete resulting path.
+    if token.contains("$$") {
+        let resolved = token.replace("$$", "1");
+        return resolved
+            .bytes()
+            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-' | b'.' | b'/'))
+            && resolved_redirect_target_is_benign(&format!("{resolved}{outer_suffix}"));
+    }
     let Some((name, inner_suffix)) = parse_posix_variable_with_literal_suffix(token) else {
         return false;
     };
     let suffix = format!("{inner_suffix}{outer_suffix}");
-    let Some(values) = resolved_variable_values(source, segment_ranges, segment_start, name) else {
+    let Some(values) = resolved_variable_values_inner(
+        source,
+        segment_ranges,
+        segment_start,
+        name,
+        Some(MAX_REDIRECT_DEPENDENCIES),
+    ) else {
         return false;
     };
     // An unquoted target lets a glob-bearing value expand further at run
@@ -22395,6 +22415,18 @@ fn resolved_variable_values(
     segment_ranges: &[(usize, usize)],
     segment_start: usize,
     name: &str,
+) -> Option<Vec<String>> {
+    resolved_variable_values_inner(source, segment_ranges, segment_start, name, None)
+}
+
+/// Redirect-only extensions have a fixed dependency depth. Other consumers
+/// retain their existing, unconditional literal-binding proof.
+fn resolved_variable_values_inner(
+    source: &str,
+    segment_ranges: &[(usize, usize)],
+    segment_start: usize,
+    name: &str,
+    redirect_depth: Option<usize>,
 ) -> Option<Vec<String>> {
     let mut values: Option<Vec<String>> = None;
     for &(start, end) in segment_ranges {
@@ -22420,19 +22452,51 @@ fn resolved_variable_values(
         // below, where `segment_text_may_assign` refuses the proof outright —
         // which is the right answer, because an unprovable binding is exactly
         // the case the exemption must not cover.
-        let binds_in_parent = !nested && segment_binding_reaches_parent_shell(source, start, end);
+        let raw_assignment = strip_assignment_declaration(segment)
+            .strip_prefix(name)
+            .and_then(|rest| rest.strip_prefix('='));
+        let binds_in_parent = !nested
+            && (segment_binding_reaches_parent_shell(source, start, end)
+                || (redirect_depth.is_some()
+                    && raw_assignment.is_some()
+                    && conditional_assignment_reaches_redirect(source, start, end, segment_start)));
         if binds_in_parent {
-            if let Some(raw) = strip_assignment_declaration(segment)
-                .strip_prefix(name)
-                .and_then(|rest| rest.strip_prefix('='))
-            {
+            if let Some(raw) = raw_assignment {
                 if values.is_some() {
                     return None;
                 }
-                values = Some(vec![
-                    literal_assignment_value(raw)
-                        .or_else(|| mktemp_scratch_assignment_value(raw))?,
-                ]);
+                values = if let Some(value) = literal_assignment_value(raw)
+                    .or_else(|| mktemp_scratch_assignment_value(raw))
+                    .or_else(|| redirect_dept
```

**File**: `tests/repro_redirect_quoted_data.rs` (modified, +74/-0)
```diff
@@ -83,3 +83,77 @@ fn anti_bypass_operator_outside_quotes_still_blocks() {
     denied("\"git\">/dev/null reset --hard");
     denied("git>/dev/null reset --hard");
 }
+
+#[test]
+fn proven_tmp_dynamic_redirects_in_hook_mode_issue_536() {
+    use std::io::Write;
+    use std::process::{Command, Stdio};
+
+    let home = tempfile::tempdir().expect("isolated home");
+    let config = home.path().join("config.toml");
+    std::fs::write(&config, "").expect("empty config");
+    for (command, allow) in [
+        ("mkdir -p /tmp/d && S=/tmp/d && echo hi > \"$S/x\"", true),
+        ("true && S=/tmp/d && echo hi > \"$S/x\"", true),
+        ("S=/tmp/d; T=\"$S/sub\"; echo hi > \"$T/x\"", true),
+        ("S=/tmp/d && T=\"$S/sub\" && echo hi > \"$T/x\"", true),
+        ("echo hi > /tmp/d-$$/x", true),
+        ("echo hi > \"/tmp/d-$$.log\"", true),
+        ("D=$(mktemp -d /tmp/v-XXXXXX); echo a > \"$D/p\"", true),
+        ("D=$(mktemp -d -p /tmp); echo a > \"$D/p\"", true),
+        ("true && S=/etc && echo x > \"$S/passwd\"", false),
+        (
+            "S=/tmp/d; T=\"$S/../../etc\"; echo x > \"$T/passwd\"",
+            false,
+        ),
+        ("echo x > /etc/d-$$/passwd", false),
+        ("D=$(mktemp -d /etc/v-XXXXXX); echo a > \"$D/p\"", false),
+        ("D=$(mktemp -d -p /etc); echo a > \"$D/p\"", false),
+        ("false && S=/tmp/d; echo x > \"$S/passwd\"", false),
+    ] {
+        let payload = serde_json::json!({
+            "tool_name": "Bash", "tool_input": {"command": command},
+            "hook_event_name": "PreToolUse", "cwd": home.path(),
+        });
+        let mut child = Command::new(env!("CARGO_BIN_EXE_dcg"))
+            .stdin(Stdio::piped())
+            .stdout(Stdio::piped())
+            .stderr(Stdio::piped())
+            .current_dir(home.path())
+            .env("HOME", home.path())
+            .env("USERPROFILE", home.path())
+            .env("TEMP", home.path())
+            .env("TMP", home.path())
+            .env("XDG_CONFIG_HOME", home.path().join("config"))
+            .env("DCG_CONFIG", &config)
+            .env("DCG_NO_SELF_HEAL", "1")
+            .env("DCG_SELF_HEAL_HOOK", "0")
+            .env("DCG_HOOK_TIMEOUT_MS", "5000")
+            .env_remove("DCG_BYPASS")
+            .env_remove("DCG_FAIL_CLOSED")
+            .spawn()
+            .expect("spawn hook");
+        child
+            .stdin
+            .take()
+            .expect("stdin")
+            .write_all(payload.to_string().as_bytes())
+            .expect("hook JSON");
+        let output = child.wait_with_output().expect("hook output");
+        assert!(output.status.success(), "{command}: {:?}", output);
+        if allow {
+            assert!(
+                output.stdout.is_empty(),
+                "{command}: {}",
+                String::from_utf8_lossy(&output.stdout)
+            );
+        } else {
+            let value: serde_json::Value =
+                serde_json::from_slice(&output.stdout).expect("denial JSON");
+            assert_eq!(
+                value["hookSpecificOutput"]["permissionDecision"], "deny",
+                "{command}: {value}"
+            );
+        }
+    }
+}
```

---

### Incident Patch 4: `22593758` (2026-10-02)
**Commit Message**: fix(bridges): the OpenCode plugin loads on OpenCode 1.3.4+, the Cursor bridges fail closed, Cursor's Shell tool is judged (GH #516, #517, #518)

#516, OpenCode. OpenCode v1 from 1.3.4 reads a default export that has an
`id` as a plugin module and refuses it without `server()` ("must default
export an object with server()"). The plugin generated since 0.15.0
(7a23b48, #419) exported `{ id, setup }` for v2, so current OpenCode
refused the whole file at startup and every bash command ran unguarded.
8fa6aeb (fail-closed plugin) did not cause it; it inherited it. #419's
test called the named export directly and never ran a loader's own checks.

- The default export also carries `server()`, returning the same hook map
  as the named `DcgGuard` export (kept for OpenCode up to 1.3.3, which calls
  every export). OpenCode v2 decodes the default export with an Effect
  Schema that drops unknown keys; checked against effect 4.0.0-rc.112, the
  version v2 pins.
- Reproduced and verified with a real OpenCode 1.18.33 run against a fake
  OpenAI-compatible model that asks bash to delete a branch: the old plugin
  is refused and the branch is deleted; the new one loads, blocks with dcg's
  message

**File**: `CHANGELOG.md` (modified, +29/-0)
```diff
@@ -13,6 +13,35 @@ Repository: <https://github.com/Dicklesworthstone/destructive_command_guard>
 
 ## Unreleased
 
+### Agent integrations
+
+- **OpenCode: the plugin loads again (#516).** OpenCode 1.3.4 and later read
+  a default export that has an `id` as a plugin module and refuse it without
+  `server()`. The plugin generated by 0.15.0 through 0.15.2 exported
+  `{ id, setup }` for OpenCode v2, so current OpenCode (1.18.33 in the report)
+  refused the whole file at startup and ran every bash command unguarded. The
+  default export now also carries `server()`, which returns the same hook map
+  as the named `DcgGuard` export; v2 ignores the extra key. Verified against a
+  real OpenCode 1.18.33 run. **Regenerate the plugin**
+  (`dcg install --opencode --force`, or `dcg update`) and restart OpenCode;
+  `dcg doctor` reports an old plugin as outdated.
+- **Cursor: the bridge fails closed (#517).** The `beforeShellExecution`
+  bridge allowed every command it could not check. On Windows that was every
+  command: cursor-agent sends a UTF-8 BOM, Windows PowerShell 5.1 decoded it
+  with the OEM code page, the JSON parse failed, and the bridge allowed. Both
+  bridges (PowerShell and the Unix Python one) now read stdin as bytes and
+  drop a BOM, send dcg UTF-8, and ask dcg for an explicit allow, so an
+  unreadable payload or a dcg that ran without a verdict (killed, timed out,
+  non-zero exit, no answer) is denied. `DCG_BRIDGE_CRASH_DECISION=allow`
+  restores fail-open for those; a dcg that cannot be started at all is still
+  allowed, with a notice on stderr. Re-run the installer to regenerate the
+  bridge.
+- **Cursor: Claude Code hooks see `Shell` (#518).** Cursor runs the
+  `PreToolUse` hooks in `~/.claude/settings.json` and renames Claude Code's
+  `Bash` tool to `Shell`. dcg did not know the name and allowed every such
+  command; it now judges them and answers in the Claude shape Cursor reads.
+  The other supported agents' tool names were audited and needed no change.
+
 ### Command history
 
 - `dcg history analyze` on an empty history now says there is nothing to
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1136,7 +1136,7 @@ present.
 - **Codex CLI:** PreToolUse hooks via `~/.codex/hooks.json` (stable in Codex 0.125.0+; the `codex_hooks` feature is on by default). dcg detects Codex from the `turn_id` stdin field and emits the minimal documented `hookSpecificOutput` deny JSON with exit code 0; dcg-only metadata is omitted so Codex's strict parser accepts the decision. The Unix installer and `install.ps1` both merge dcg's hook into the existing hooks object, detect an already-current dcg hook exactly, leave invalid JSON or malformed hook shapes untouched, and surface the failure reason in the install summary. After installation, open Codex's `/hooks` UI once to trust the hook. `uninstall.sh` and `uninstall.ps1` remove only dcg-owned Codex hooks and preserve coexisting entries. See the [Codex integration notes](docs/codex-integration.md). Caveats: the model can still write scripts to disk to bypass hook-based blocking; and Codex's `PreToolUse` hooks [do not yet intercept every `unified_exec` shell path](docs/codex-integration.md#known-limitation-codex-unified_exec-path-windows-desktop--cli), so treat it as a guardrail rather than a complete enforcement boundary.
 - **GitHub Copilot CLI:** The installer writes a user-level hook to `${COPILOT_HOME:-~/.copilot}/hooks/dcg.json`, protecting every workspace. The generated `preToolUse` hook covers both Unix `bash` and Windows `powershell` payloads and emits Copilot's exact top-level permission-decision JSON.
 - **VS Code Copilot Chat:** Current VS Code releases load `~/.claude/settings.json` by default, so the Claude Code hook installed by dcg also protects Copilot Chat without a second bridge or duplicate hook. dcg recognizes VS Code's documented `runTerminalCommand` shell tool plus the observed compatibility names `run_in_terminal` and `runInTerminal`, reads `tool_input.command`, and returns VS Code's documented `hookSpecificOutput` deny. The newer Copilot **Agent Host** (and the Agents window built on it) sends a batched envelope instead — `{"toolCalls": [{"name": "powershell", "args": "{\"command\": …}"}]}` with JSON-encoded argument strings; dcg evaluates every shell entry in the batch independently and a single destructive entry denies the request (#252). Agent hooks are still a VS Code preview feature and can be disabled by organization policy; use **Developer: Show Agent Debug Logs** or the **GitHub Copilot Chat Hooks** output channel to confirm that the hook loaded.
-- **Cursor IDE:** Hooks are configured through `~/.cursor/hooks.json` plus a generated bridge (`dcg-pre-shell.ps1` on Windows). The installer inserts dcg first in `beforeShellExecution`, collapses duplicate dcg entries, and preserves coexisting Cursor hooks.
+- **Cursor IDE:** Hooks are configured through `~/.cursor/hooks.json` plus a generated bridge (`dcg-pre-shell.ps1` on Windows). The installer inserts dcg first in `beforeShellExecution`, collapses duplicate dcg entries, and preserves coexisting Cursor hooks. The bridge blocks a command it cannot verify: a payload it cannot read, or a dcg that ran but gave no verdict (killed, timed out, non-zero exit, no answer). Set `DCG_BRIDGE_CRASH_DECISION=allow` to let those through instead; only a dcg that cannot be started at all is allowed, with a notice on stderr. Cursor also runs the `PreToolUse` hooks in `~/.claude/settings.json` for its `Shell` tool, and dcg judges those payloads too.
 - **Hermes Agent:** [NousResearch's Hermes Agent](https://github.com/NousResearch/hermes-agent) declares shell hooks in its `config.yaml` under `hooks.pre_tool_call`. Hermes resolves its data root from `HERMES_HOME` when set, else `%LOCALAPPDATA%\hermes` on native Windows and `~/.hermes` on Linux/macOS — both installers write the hook to that resolved path (`install.ps1` never writes to `%USERPROFILE%\.hermes` unless `HERMES_HOME` points there, since native Windows Hermes would never read it). The installer merges a single `matcher: "terminal"` entry that invokes dcg directly — no wrapper script — because Hermes' input JSON (`hook_event_name: "pre_tool_call"`, `tool_name: "terminal"`, `tool_input.command`) deserializes straight into dcg's existing `HookInput`. Hermes [explicitly documents](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/hooks.md) that "non-zero exit codes... never abort the agent loop", so dcg switches to Hermes' JSON block protocol on output: `{"decision":"block","reason":...}` (plus the alternate `{"action":"block","message":...}` form for cross-version compatibility). The installer also sets `hooks_auto_accept: true` if not already set; Hermes silently drops un-allowlisted hooks in non-TTY runs (gateway/cron) without it. `unconfigure_hermes` in `uninstall.sh` removes only the dcg-owned entry and leaves `hooks_auto_accept` alone (other Hermes hooks may rely on it).
 - **Grok (xAI):** [Grok Build / Grok CLI](https://x.ai/news/grok-build-cli) auto-discovers every `*.json` under `~/.grok/hooks/`. `dcg install
```

**File**: `docs/opencode-integration.md` (modified, +20/-1)
```diff
@@ -1,6 +1,6 @@
 # OpenCode Integration
 
-> Last updated: 2026-10-01 (a dcg that gives no verdict blocks; first-party plugin, issue #318)
+> Last updated: 2026-10-01 (loads again on OpenCode 1.3.4 and later, issue #516; a dcg that gives no verdict blocks; first-party plugin, issue #318)
 
 [OpenCode](https://opencode.ai) does not expose PreToolUse-style hook config
 files the way Claude Code, Codex, or Gemini do. Its interception surface is a
@@ -48,6 +48,25 @@ The generated `dcg-guard.js`:
    broken install does not block every command. `DCG_BYPASS=1` skips the
    check, as it does in every host.
 
+## OpenCode versions
+
+One generated file serves every OpenCode plugin loader, since `dcg update`
+regenerates it long after `dcg install` ran:
+
+- **OpenCode 1.3.4 and later (v1):** a default export that carries an `id` is
+  read as a plugin module, and its `server()` returns the hook map. A default
+  export without `server()` is refused at startup ("must default export an
+  object with server()") and nothing is guarded. Plugins generated by dcg
+  0.15.0 through 0.15.2 had that shape (#516): regenerate with
+  `dcg install --opencode --force` (or `dcg update`), restart OpenCode, and
+  check its log for `failed to load plugin`.
+- **OpenCode up to 1.3.3 (v1):** every export is called as a plugin function,
+  so the named `DcgGuard` export registers the hook. These versions also log
+  an error for the default export object, which they cannot call; the guard
+  still works.
+- **OpenCode v2:** the default export's `id` and `setup(ctx)` register the
+  hook through `ctx.tool.hook("execute.before", …)`.
+
 ## Ownership and uninstall
 
 The file carries a `dcg-opencode-plugin` marker comment. The installer refuses
```

**File**: `install.ps1` (modified, +107/-15)
```diff
@@ -1049,15 +1049,32 @@ function Get-CursorBridgeContent {
   # translates Cursor's {command, cwd} payload into dcg's Bash-hook shape, pipes
   # it to dcg.exe, and maps dcg's permissionDecision back to Cursor's
   # {permission, continue, userMessage, ...} response. Pure PowerShell — no Python
-  # bridge (which is fragile on Windows). Fail-open (allow) on any error.
+  # bridge (which is fragile on Windows).
+  #
+  # Fails CLOSED (#517): a payload it cannot read, and a dcg that ran but gave
+  # no verdict (killed, timed out, non-zero exit, no or unreadable answer), are
+  # answered with deny unless DCG_BRIDGE_CRASH_DECISION=allow. Only a dcg that
+  # cannot be started at all fails open, so a broken install does not block
+  # every command. Bytes are handled explicitly: stdin is read raw and decoded
+  # as UTF-8 after dropping a BOM (cursor-agent sends one, and Windows
+  # PowerShell 5.1 decodes [Console]::In with the OEM code page, so the BOM
+  # became junk that broke the JSON), dcg gets UTF-8 on its stdin rather than
+  # $OutputEncoding (ASCII under 5.1, which turned non-ASCII into '?'), and the
+  # answer to Cursor is written as UTF-8.
   param([string]$DcgPath)
   $escaped = $DcgPath.Replace("'", "''")
   $header = "# dcg-cursor-hook: generated by dcg installer (pure PowerShell bridge; no interpreter dependency)`n`$DcgBinFallback = '$escaped'`n"
   $body = @'
 $ErrorActionPreference = 'SilentlyContinue'
 $DcgBin = $env:DCG_BIN
 if ([string]::IsNullOrEmpty($DcgBin)) { $DcgBin = $DcgBinFallback }
-function Write-CursorOut($o) { [Console]::Out.Write(($o | ConvertTo-Json -Compress)) }
+$Utf8 = New-Object System.Text.UTF8Encoding $false
+function Write-CursorOut($o) {
+  $bytes = $Utf8.GetBytes(($o | ConvertTo-Json -Compress))
+  $stdout = [Console]::OpenStandardOutput()
+  $stdout.Write($bytes, 0, $bytes.Length)
+  $stdout.Flush()
+}
 function Send-Allow {
   Write-CursorOut @{ permission = 'allow'; continue = $true; userMessage = ''; agentMessage = ''; user_message = ''; agent_message = '' }
 }
@@ -1069,23 +1086,98 @@ function Send-Deny($r) {
 function Send-Ask($r) {
   Write-CursorOut @{ permission = 'ask'; continue = $true; userMessage = $r; agentMessage = $r; user_message = $r; agent_message = $r }
 }
-try { $raw = [Console]::In.ReadToEnd() } catch { Send-Allow; exit 0 }
-if ([string]::IsNullOrWhiteSpace($raw)) { Send-Allow; exit 0 }
-try { $payload = $raw | ConvertFrom-Json } catch { Send-Allow; exit 0 }
+# No verdict is not an allow: block, unless the operator opted out with
+# DCG_BRIDGE_CRASH_DECISION=allow.
+function Send-NoVerdict($detail) {
+  $setting = [string]$env:DCG_BRIDGE_CRASH_DECISION
+  if ($setting.Trim().ToLowerInvariant() -eq 'allow') {
+    [Console]::Error.WriteLine("[dcg] Cursor bridge got no verdict ($detail); allowed because DCG_BRIDGE_CRASH_DECISION=allow")
+    Send-Allow
+    return
+  }
+  Send-Deny "Blocked by dcg: the command could not be verified ($detail). Set DCG_BRIDGE_CRASH_DECISION=allow to let commands through when dcg fails."
+}
+$bypass = [string]$env:DCG_BYPASS
+if (@('1', 'true', 'yes', 'y', 'on') -contains $bypass.Trim().ToLowerInvariant()) { Send-Allow; exit 0 }
+
+try {
+  $buffer = New-Object System.IO.MemoryStream
+  [Console]::OpenStandardInput().CopyTo($buffer)
+  $bytes = $buffer.ToArray()
+  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
+    $raw = $Utf8.GetString($bytes, 3, $bytes.Length - 3)
+  } elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
+    $raw = [System.Text.Encoding]::Unicode.GetString($bytes, 2, $bytes.Length - 2)
+  } else {
+    $raw = $Utf8.GetString($bytes)
+  }
+} catch { Send-NoVerdict 'the hook payload could not be read'; exit 0 }
+if ([string]::IsNullOrWhiteSpace($raw)) { Send-NoVerdict 'the hook payload was empty'; exit 0 }
+try { $payload = $raw | ConvertFrom-Json -ErrorAction Stop } catch { Send-NoVerdict 'the hook payload was not JSON'; exit 0 }
+if (-not ($payload -is [System.Management.Automation.PSCustomObject])) { Send-NoVerdict 'the hook payload was not a JSON object'; exit 0 }
 $command = [string]$payload.command
 if ([string]::IsNullOrEmpty($command)) { Send-Allow; exit 0 }
-if ($payload.cwd) { Set-Location -LiteralPath $payload.cwd -ErrorAction SilentlyContinue }
-$hookInput = @{ tool_name = 'Bash'; tool_input = @{ command = $command } } | ConvertTo-Json -Compress
+
+$app = Get-Command -Name $DcgBin -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
+if ($null -eq $app) {
+  # Could not start dcg at all: fail open so a broken install does not block
+  # every command, and say so.
+  [Console]::Error.WriteLine("[dcg] Cursor bridge could not run dcg at '$DcgBin'; command allowed unchecked")
+  Send-Allow
+  exit 0
+}
+
+$hookInput = @{ tool_name = 'Bash'; tool_input = @{ command = $command }; dcg_explicit_verdict = $true } | ConvertTo-Json -Compress
 $env:CURSOR_IDE = '1'
-try { $out = ($hookInput | 
```

**File**: `install.sh` (modified, +76/-26)
```diff
@@ -3266,11 +3266,45 @@ def ask(reason):
         "agent_message": reason,
     })
 
+# dcg ran but gave no verdict, or the payload could not be read: that is not an
+# allow (#517). Block, unless the operator opted out with
+# DCG_BRIDGE_CRASH_DECISION=allow.
+def no_verdict(detail):
+    if (os.environ.get("DCG_BRIDGE_CRASH_DECISION") or "").strip().lower() == "allow":
+        sys.stderr.write(
+            "[dcg] Cursor bridge got no verdict (%s); allowed because "
+            "DCG_BRIDGE_CRASH_DECISION=allow\n" % detail
+        )
+        allow()
+        return
+    deny(
+        "Blocked by dcg: the command could not be verified (%s). Set "
+        "DCG_BRIDGE_CRASH_DECISION=allow to let commands through when dcg fails."
+        % detail
+    )
+
 def main():
+    if (os.environ.get("DCG_BYPASS") or "").strip().lower() in ("1", "true", "yes", "y", "on"):
+        allow()
+        return 0
+
+    # Raw bytes, so a UTF-8 BOM (cursor-agent sends one) is dropped instead of
+    # failing the JSON parse.
     try:
-        payload = json.load(sys.stdin)
+        raw = sys.stdin.buffer.read().decode("utf-8-sig")
     except Exception:
-        allow()
+        no_verdict("the hook payload could not be read")
+        return 0
+    if not raw.strip():
+        no_verdict("the hook payload was empty")
+        return 0
+    try:
+        payload = json.loads(raw)
+    except Exception:
+        no_verdict("the hook payload was not JSON")
+        return 0
+    if not isinstance(payload, dict):
+        no_verdict("the hook payload was not a JSON object")
         return 0
 
     command = payload.get("command") or ""
@@ -3281,56 +3315,72 @@ def main():
         except Exception:
             pass
 
-    if not command:
+    if not isinstance(command, str) or not command:
         allow()
         return 0
 
     dcg_bin = os.environ.get("DCG_BIN") or DCG_BIN_FALLBACK
-    hook_input = {"tool_name": "Bash", "tool_input": {"command": command}}
+    # dcg answers an allowed command with {"dcg_verdict":"allow"} when asked,
+    # so silence means it never answered.
+    hook_input = {
+        "tool_name": "Bash",
+        "tool_input": {"command": command},
+        "dcg_explicit_verdict": True,
+    }
 
     env = os.environ.copy()
     env["CURSOR_IDE"] = "1"
 
     try:
         proc = subprocess.run(
             [dcg_bin],
-            input=json.dumps(hook_input),
-            text=True,
+            input=json.dumps(hook_input).encode("utf-8"),
             capture_output=True,
             env=env,
+            timeout=30,
         )
-    except Exception:
+    except (FileNotFoundError, PermissionError, NotADirectoryError) as err:
+        # dcg could not be started at all: fail open so a broken install does
+        # not block every command, and say so.
+        sys.stderr.write("[dcg] Cursor bridge could not run dcg: %s; command allowed unchecked\n" % err)
         allow()
         return 0
-
-    output = (proc.stdout or "").strip()
-    if not output:
-        allow()
+    except subprocess.TimeoutExpired:
+        no_verdict("dcg timed out")
         return 0
-
-    try:
-        dcg_out = json.loads(output)
-    except Exception:
-        allow()
+    except Exception as err:
+        no_verdict("dcg could not be run: %s" % err)
         return 0
 
-    decision = (
-        dcg_out.get("hookSpecificOutput", {})
-        .get("permissionDecision")
-    )
-    reason = (
-        dcg_out.get("hookSpecificOutput", {})
-        .get("permissionDecisionReason", "Blocked by dcg")
-    )
+    output = (proc.stdout or b"").decode("utf-8", "replace").strip()
+    dcg_out = None
+    if output:
+        try:
+            dcg_out = json.loads(output)
+        except Exception:
+            dcg_out = None
+    hso = dcg_out.get("hookSpecificOutput") if isinstance(dcg_out, dict) else None
+    hso = hso if isinstance(hso, dict) else {}
+    decision = hso.get("permissionDecision")
+    reason = hso.get("permissionDecisionReason") or "Blocked by dcg"
 
+    # A blocking verdict stands whatever happened to the process afterwards.
     if decision == "deny":
         deny(reason)
         return 0
     if decision == "ask":
         ask(reason)
         return 0
-
-    allow()
+    if proc.returncode != 0:
+        no_verdict("dcg exited %d" % proc.returncode)
+        return 0
+    if isinstance(dcg_out, dict) and dcg_out.get("dcg_verdict") == "allow":
+        allow()
+        return 0
+    if not output:
+        no_verdict("dcg exited 0 with nothing on stdout")
+        return 0
+    no_verdict("dcg stdout was not a verdict")
     return 0
 
 if __name__ == "__main__":
```

**File**: `scripts/e2e_harness_matrix.sh` (modified, +8/-0)
```diff
@@ -293,6 +293,14 @@ assert_case claude-code allow "$CLAUDE_ALLOW" allow '.' ''
 assert_case claude-code powershell-tool-denies-on-any-host \
   "$(jq -nc --arg c 'Remove-Item -Recurse -Force C:\\src' '{tool_name:"PowerShell",tool_input:{command:$c}}')" \
   deny '.hookSpecificOutput.permissionDecision' deny
+# Cursor runs the Claude Code hooks in ~/.claude/settings.json and renames
+# `Bash` to `Shell` (#518); it reads the Claude-shaped answer.
+assert_case cursor-claude-compat deny \
+  "$(jq -nc --arg c "$DENY_CMD" '{hook_event_name:"PreToolUse",cursor_version:"2026.09.28",conversation_id:"c",tool_name:"Shell",tool_input:{command:$c}}')" \
+  deny '.hookSpecificOutput.permissionDecision' deny
+assert_case cursor-claude-compat allow \
+  "$(jq -nc --arg c "$ALLOW_CMD" '{hook_event_name:"PreToolUse",cursor_version:"2026.09.28",conversation_id:"c",tool_name:"Shell",tool_input:{command:$c}}')" \
+  allow '.' ''
 # The agent-facing metadata contract other tools key on:
 for field in ruleId packId severity; do
   got="$(printf '%s' "$CLAUDE_DENY" | run_dcg 2>/dev/null | jq -r ".hookSpecificOutput.$field // empty")"
```

**File**: `src/agent.rs` (modified, +5/-2)
```diff
@@ -651,8 +651,11 @@ fn detect_from_environment() -> Option<DetectionResult> {
     }
 
     // OpenCode detection. dcg's generated OpenCode plugin
-    // (`dcg install --opencode`) spawns dcg with `OPENCODE=1` (#318).
-    // Presence-only, like the markers above.
+    // (`dcg install --opencode`) spawns dcg with `OPENCODE=1` (#318), and
+    // OpenCode itself now sets it for its shell-tool commands (#508,
+    // anomalyco/opencode#51975). Presence-only, like the markers above. The
+    // generic `AI_AGENT=opencode` is not consulted: OpenCode keeps an outer
+    // agent's value there, so it can name another tool.
     if std::env::var("OPENCODE").is_ok() {
         return Some(DetectionResult::new(
             Agent::OpenCode,
```

**File**: `src/cli.rs` (modified, +32/-12)
```diff
@@ -14746,14 +14746,21 @@ fn build_opencode_plugin_source(executable: &std::path::Path) -> std::io::Result
 // Guard) before execution. Remove with `uninstall.sh` or by deleting this
 // file. Docs: https://github.com/Dicklesworthstone/destructive_command_guard
 //
-// One file serves both plugin contracts (#419). OpenCode v1 loads the named
-// `DcgGuard` export and calls `tool.execute.before(input, output)`; v2 loads
-// the default export and requires `{{ id, setup(ctx) }}`, registering through
-// `ctx.tool.hook("execute.before", cb)` with a single `event` argument. An ES
-// module may carry both, and each loader reads only the shape it knows, so
-// the plugin does not depend on detecting the runtime — which matters because
+// One file serves every OpenCode plugin loader (#419, #516), because
 // `dcg update` regenerates this file and the installed OpenCode may have
-// changed major version since `dcg install` ran.
+// changed version since `dcg install` ran:
+//
+// - OpenCode v1 from 1.3.4 reads a default export that has an `id` as a
+//   plugin module and requires `server(input, options)` to return the hook
+//   map; without `server()` it rejects the whole file ("must default export an
+//   object with server()") and the bash tool runs unguarded. It then ignores
+//   the named export.
+// - OpenCode v1 up to 1.3.3 calls every export as a plugin function, so it
+//   registers the named `DcgGuard` export (and logs an error for the default
+//   object, which it cannot call).
+// - OpenCode v2 requires a default export `{{ id, setup(ctx) }}` and registers
+//   through `ctx.tool.hook("execute.before", cb)` with a single `event`
+//   argument; it drops keys it does not know, such as `server`.
 //
 // `node:child_process` rather than `Bun.spawn`: v2 migrated Bun -> Node, so
 // `Bun` is undefined there, while Bun implements the `node:` modules — so the
@@ -14841,20 +14848,25 @@ function dcgDenyReason(command) {{
   return noVerdict("dcg stdout was not a verdict");
 }}
 
-// OpenCode v1: named export, hook map, command in `output.args`.
-export const DcgGuard = async () => {{
+// OpenCode v1 hook map, command in `output.args`.
+function v1Hooks() {{
   return {{
     "tool.execute.before": async (input, output) => {{
       if (!input || input.tool !== "bash") return;
       const reason = dcgDenyReason(output?.args?.command);
       if (reason) throw new Error(reason);
     }},
   }};
-}};
+}}
+
+// OpenCode v1 up to 1.3.3: every export is called as a plugin function.
+export const DcgGuard = async () => v1Hooks();
 
-// OpenCode v2: default export with `id` + `setup`, command in `event.input`.
 export default {{
   id: "dcg-guard",
+  // OpenCode v1 from 1.3.4: `server(input, options)` returns the hook map.
+  server: async () => v1Hooks(),
+  // OpenCode v2: `setup(ctx)` registers the hook, command in `event.input`.
   async setup(ctx) {{
     await ctx.tool.hook("execute.before", async (event) => {{
       if (!event || event.tool !== "bash") return;
@@ -24191,7 +24203,8 @@ if ($errors.Count -ne 0) {
     /// #419: the generated plugin must load under BOTH OpenCode plugin
     /// contracts.
     ///
-    /// v1 reads the named `DcgGuard` export and calls
+    /// v1 up to 1.3.3 calls the named `DcgGuard` export, v1 from 1.3.4 calls
+    /// the default export's `server()` (#516), and both then call
     /// `tool.execute.before(input, output)`; v2 requires a default export
     /// `{ id, setup(ctx) }` and registers through
     /// `ctx.tool.hook("execute.before", cb)`. A v1-only file fails v2's loader
@@ -24217,6 +24230,13 @@ if ($errors.Count -ne 0) {
             source.contains("\"tool.execute.before\""),
             "v1 registers a tool.execute.before hook map"
         );
+        // #516: OpenCode v1 from 1.3.4 treats a default export with an `id`
+        // as a plugin module and rejects it without `server()`, so the v2
+        // shape alone made v1 refuse the whole file.
+        assert!(
+            source.contains("server: async () => v1Hooks()"),
+            "v1 (>= 1.3.4) needs the default export's server() to return the hook map"
+        );
 
         // v2 contract.
         assert!(
```

---

### Incident Patch 5: `bf4a6686` (2026-10-01)
**Commit Message**: fix(heredoc): a launcher quoted as prose is not run; awk printing into a shell is (GH #510, #511)

The two fixes share src/heredoc.rs, so they ship together.

#510: `mytracker comment 1 "example: bash -c 'git reset --hard' is
refused"` was denied as `core.git:reset-hard`, while `mytracker comment 1
"the rule refuses git reset --hard"` was allowed. The inline-script
patterns match a launcher anywhere in the text. That quoted word runs
nothing under either reading: as data, which is dcg's model for an unknown
program's operands, or as a shell string some program runs, whose command
word is `example:`, not `bash`.

- A launcher is now skipped only when it sits inside single or double
  quotes (not in a `$(…)` or backquote substitution) AND, inside that quoted
  text, its simple command starts with a plain word that is not a shell,
  interpreter, wrapper, command runner, build/package runner or reserved
  word.
- Kept: a launcher that opens the quoted text (`tmux new "bash -c '…'"`,
  `"bash" -c`), follows a separator in it (`"x; bash -c …"`), or follows a
  wrapper (`"sudo bash -c …"`). A program that runs its operand as a shell
  string would run those.
- Kept too when the quote walk

**File**: `src/evaluator.rs` (modified, +20/-0)
```diff
@@ -26882,6 +26882,26 @@ fn evaluate_heredoc(
         // If content is Bash, extract inner commands and feed them back to the full evaluator.
         // This ensures that `kubectl`, `docker`, etc. inside heredocs are checked against their packs.
         if content.language == crate::heredoc::ScriptLanguage::Bash {
+            // An awk program printing a computed value into a shell that runs
+            // its stdin (`print "rm " $1 | "sh"`) is the shell-level
+            // `awk '{print "rm " $1}' f | sh` inside awk, and gets that
+            // pipeline's verdict and rule (#511).
+            if content.heredoc_type.is_none()
+                && content.content == crate::heredoc::AWK_COMPUTED_PRINT_SCRIPT
+                && content.target_command.as_deref() == Some("awk")
+            {
+                if let Some(denial) = launcher_unverified_denial(
+                    PIPELINE_CONSUMER_RULE,
+                    "POSIX shell executes the text an awk program prints into it, but the \
+                     printed value is computed at run time and cannot be statically verified",
+                    context.allowlists,
+                    context.project_path,
+                    first_allowlist_hit,
+                ) {
+                    return Some(denial);
+                }
+                continue;
+            }
             // An inline `-c` script that is nothing but one expansion or
             // command substitution (`bash -c "$X"`, `sh -c "$(wget -qO- …)"`)
             // runs source dcg never sees. The keyword pre-filter below skipped
```

**File**: `src/heredoc.rs` (modified, +866/-3)
```diff
@@ -2070,6 +2070,15 @@ fn extract_inline_scripts(
                 continue;
             }
 
+            // A launcher spelled inside another command's quoted argument,
+            // behind prose, is not one the shell runs (#510).
+            if cap
+                .get(1)
+                .is_some_and(|name| inline_launcher_is_quoted_prose(command, name.start()))
+            {
+                continue;
+            }
+
             // Enforce content size limit
             if content.len() > limits.max_body_bytes {
                 // Skip but don't add to skip_reasons (would be too noisy)
@@ -2117,6 +2126,284 @@ fn extract_inline_scripts(
     }
 }
 
+/// Whether the inline launcher whose interpreter word starts at
+/// `launcher_start` is prose inside another command's quoted argument rather
+/// than a command any shell runs (#510).
+///
+/// The inline-script patterns match a launcher anywhere in the text, so
+/// `tracker comment 1 "example: bash -c 'git reset --hard' is refused"` was
+/// denied as if it ran `git reset --hard`. It does not, under either reading
+/// of that quoted word:
+///
+/// - as data (what dcg already assumes for an unknown program's operands:
+///   `tracker comment 1 "git reset --hard"` is allowed), nothing runs it;
+/// - as a shell string some program hands to `sh -c`, its command word is
+///   `example:`, and `bash` is an operand of that program, not a launcher.
+///
+/// So a launcher is dropped only when BOTH hold: it sits inside single or
+/// double quotes (not inside a `$(…)` or backquote substitution, which run
+/// whatever their quoting), and inside that quoted text the simple command
+/// it belongs to starts with a plain word that is not a shell, interpreter,
+/// wrapper, command runner or reserved word. A launcher that opens the
+/// quoted text (`tmux new "bash -c '…'"`, `"bash" -c '…'`), follows a
+/// separator inside it (`"x; bash -c '…'"`), or follows a wrapper
+/// (`"sudo bash -c '…'"`) is kept, because a program that runs its operand
+/// as a shell string would run that launcher.
+///
+/// Anything this walk cannot follow keeps the launcher: a heredoc (its body
+/// is not shell-quoted, so one apostrophe in it would flip the quote state),
+/// a comment, a `${…}` expansion, an ANSI-C `$'…'` string, or an escaped
+/// interpreter word.
+fn inline_launcher_is_quoted_prose(command: &str, launcher_start: usize) -> bool {
+    if command.contains("<<") {
+        return false;
+    }
+    let Some(quote_open) = innermost_shell_quote_at(command, launcher_start) else {
+        return false;
+    };
+    command
+        .get(quote_open + 1..launcher_start)
+        .is_some_and(quoted_launcher_prefix_is_prose)
+}
+
+/// The byte offset of the quote that opens the innermost single- or
+/// double-quoted string containing `position`, when that string is the
+/// innermost shell context there. `None` when `position` is unquoted, sits
+/// inside a `$(…)`/backquote substitution, or the text before it uses a
+/// construct this walk does not model (see [`inline_launcher_is_quoted_prose`]).
+fn innermost_shell_quote_at(command: &str, position: usize) -> Option<usize> {
+    #[derive(Clone, Copy)]
+    enum Context {
+        Single(usize),
+        Double(usize),
+        Substitution(usize),
+        Backquote,
+    }
+    let bytes = command.as_bytes();
+    if position > bytes.len() {
+        return None;
+    }
+    let mut stack: Vec<Context> = Vec::new();
+    let mut index = 0usize;
+    while index < position {
+        let byte = bytes[index];
+        let next = bytes.get(index + 1).copied();
+        match stack.last().copied() {
+            Some(Context::Single(_)) => {
+                if byte == b'\'' {
+                    stack.pop();
+                }
+                index += 1;
+            }
+            Some(Context::Double(_)) => match byte {
+                b'\\' => index += 2,
+                b'"' => {
+                    stack.pop();
+                    index += 1;
+                }
+                b'$' if next == Some(b'(') => {
+                    stack.push(Context::Substitution(1));
+                    index += 2;
+                }
+                b'$' if next == Some(b'{') => return None,
+                b'`' => {
+                    stack.push(Context::Backquote);
+                    index += 1;
+                }
+                _ => index += 1,
+            },
+            top => match byte {
+                b'\\' => index += 2,
+                b'\'' => {
+                    if index > 0 && bytes[index - 1] == b'$' {
+                        return None;
+                    }
+                    stack.push(Context::Single(index));
+                    index += 1;
+                }
+                b'"' => {
+                    stack.push(Context::Double(index));
+                    index += 1;
+                }
+                b'`' => {
+                    if matches!(top, Some(Context::Backquo
```

**File**: `tests/repro_510_quoted_launcher_prose.rs` (added, +145/-0)
```diff
@@ -0,0 +1,145 @@
+//! #510: an inline-shell launcher quoted as prose inside a non-shell command's
+//! argument was evaluated as if it ran.
+//!
+//! ```text
+//! mytracker comment 1 "example: bash -c 'git reset --hard' is refused"
+//! ```
+//!
+//! was denied as `core.git:reset-hard`, while the same argument without the
+//! `bash -c` wrapper (`mytracker comment 1 "the rule refuses git reset
+//! --hard"`) was allowed. The inline-script patterns match a launcher anywhere
+//! in the text. The quoted word runs nothing under either reading: as data
+//! (dcg's model for an unknown program's operands), or as a shell string some
+//! program hands to `sh -c`, whose command word is `example:` and not `bash`.
+//!
+//! Every case goes through the real Claude Code `PreToolUse` hook. The second
+//! half pins the live forms that must stay denied: a launcher in command
+//! position, behind a wrapper, inside a substitution (which runs whatever its
+//! quoting), opening a quoted string another program may run, or after a
+//! separator inside one.
+
+use std::io::Write;
+use std::process::{Command, Stdio};
+
+/// `(decision, rule id)` from the real hook for one Bash command.
+fn hook(command: &str) -> (String, String) {
+    let temp = tempfile::tempdir().expect("temp dir");
+    let home = temp.path().join("home");
+    std::fs::create_dir_all(&home).expect("home");
+    let payload = serde_json::json!({
+        "hook_event_name": "PreToolUse",
+        "tool_name": "Bash",
+        "tool_input": {"command": command},
+    })
+    .to_string();
+    let mut child = Command::new(env!("CARGO_BIN_EXE_dcg"))
+        .env_clear()
+        .env("HOME", &home)
+        .env("USERPROFILE", &home)
+        .env("DCG_ALLOWLIST_SYSTEM_PATH", "")
+        .env("DCG_NO_SELF_HEAL", "1")
+        .env("DCG_HOOK_TIMEOUT_MS", "5000")
+        .current_dir(temp.path())
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .spawn()
+        .expect("spawn dcg");
+    child
+        .stdin
+        .as_mut()
+        .expect("stdin")
+        .write_all(payload.as_bytes())
+        .expect("write payload");
+    let out = child.wait_with_output().expect("wait");
+    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
+    if stdout.is_empty() {
+        assert!(out.status.success(), "silent non-zero exit for {command:?}");
+        return ("allow".to_string(), String::new());
+    }
+    let parsed: serde_json::Value = serde_json::from_str(&stdout)
+        .unwrap_or_else(|e| panic!("bad hook output for {command:?} ({e}): {stdout}"));
+    let output = &parsed["hookSpecificOutput"];
+    (
+        output["permissionDecision"]
+            .as_str()
+            .unwrap_or("<missing>")
+            .to_string(),
+        output["ruleId"].as_str().unwrap_or_default().to_string(),
+    )
+}
+
+#[test]
+fn launcher_quoted_as_prose_in_a_data_argument_is_allowed() {
+    for command in [
+        // The reported shapes.
+        "mytracker comment 1 \"example: bash -c 'git reset --hard' is refused\"",
+        "br create \"test bash -c 'git reset --hard' doc\"",
+        // The other quote style around the prose, and around the payload.
+        "mytracker comment 1 'example: bash -c \"git reset --hard\" is refused'",
+        // Other launchers and payloads.
+        "mytracker comment 1 \"example: sh -c 'rm -rf /' is refused\"",
+        "mytracker note \"run: /bin/bash -c 'git clean -fdx' to wipe\"",
+        "mytracker note \"repro: python3 -c 'import shutil; shutil.rmtree(\\\"/\\\")' fails\"",
+        // Several data arguments, the launcher in a later one.
+        "mytracker comment 7 --title \"x\" --body \"the hook blocks bash -c 'git reset --hard'\"",
+    ] {
+        assert_eq!(hook(command).0, "allow", "{command}");
+    }
+}
+
+#[test]
+fn the_plain_data_control_is_unchanged() {
+    for command in [
+        "mytracker comment 1 \"the rule refuses git reset --hard\"",
+        "mytracker comment 1 \"example: python3 -c 'import os' runs code\"",
+    ] {
+        assert_eq!(hook(command).0, "allow", "{command}");
+    }
+    assert_eq!(
+        hook("git reset --hard"),
+        ("deny".to_string(), "core.git:reset-hard".to_string())
+    );
+}
+
+#[test]
+fn live_launchers_stay_denied() {
+    for command in [
+        // Command position, plain and after a separator.
+        "bash -c 'git reset --hard'",
+        "x; bash -c 'git reset --hard'",
+        "true && sh -c 'git reset --hard'",
+        // Behind wrappers.
+        "sudo bash -c 'git reset --hard'",
+        "env FOO=1 bash -c 'git reset --hard'",
+        "nice bash -c 'git reset --hard'",
+        "timeout 5 bash -c 'git reset --hard'",
+        "xargs bash -c 'git reset --hard'",
+        "docker exec c bash -c 'git reset --hard'",
+        // The interpreter word itself quoted is still the command word.
+        "\"bash\" -c 'git reset --hard'",
+        "'/bin/bash' -c 'git reset
```

**File**: `tests/repro_511_awk_print_into_shell.rs` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+//! #511: `awk 'BEGIN{print "git reset --hard" | "sh"}'` was allowed.
+//!
+//! #399 taught the extractor that `print … | "cmd"` runs `cmd`, and judged the
+//! pipe target. When the target is a shell reading its script from stdin, the
+//! PRINTED text is what runs — the same as `echo "…" | sh` — and nothing
+//! judged it. Now the printed literal (or a variable the program assigns one
+//! literal) is evaluated as a shell command, and a computed print into a shell
+//! is unverifiable code, denied under the rule the shell-level
+//! `awk '{print "rm " $1}' f | sh` already gets (`heredoc.posix:pipeline-consumer`).
+//!
+//! Every case goes through the real Claude Code `PreToolUse` hook, both
+//! directions: a pipe into something that does not run its stdin (`cat`,
+//! `sort`, `sh -c cat`, a script file) stays allowed, as does a harmless
+//! printed command.
+
+use std::io::Write;
+use std::process::{Command, Stdio};
+
+/// `(decision, rule id)` from the real hook for one Bash command.
+fn hook(command: &str) -> (String, String) {
+    let temp = tempfile::tempdir().expect("temp dir");
+    let home = temp.path().join("home");
+    std::fs::create_dir_all(&home).expect("home");
+    let payload = serde_json::json!({
+        "hook_event_name": "PreToolUse",
+        "tool_name": "Bash",
+        "tool_input": {"command": command},
+    })
+    .to_string();
+    let mut child = Command::new(env!("CARGO_BIN_EXE_dcg"))
+        .env_clear()
+        .env("HOME", &home)
+        .env("USERPROFILE", &home)
+        .env("DCG_ALLOWLIST_SYSTEM_PATH", "")
+        .env("DCG_NO_SELF_HEAL", "1")
+        .env("DCG_HOOK_TIMEOUT_MS", "5000")
+        .current_dir(temp.path())
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .spawn()
+        .expect("spawn dcg");
+    child
+        .stdin
+        .as_mut()
+        .expect("stdin")
+        .write_all(payload.as_bytes())
+        .expect("write payload");
+    let out = child.wait_with_output().expect("wait");
+    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
+    if stdout.is_empty() {
+        assert!(out.status.success(), "silent non-zero exit for {command:?}");
+        return ("allow".to_string(), String::new());
+    }
+    let parsed: serde_json::Value = serde_json::from_str(&stdout)
+        .unwrap_or_else(|e| panic!("bad hook output for {command:?} ({e}): {stdout}"));
+    let output = &parsed["hookSpecificOutput"];
+    (
+        output["permissionDecision"]
+            .as_str()
+            .unwrap_or("<missing>")
+            .to_string(),
+        output["ruleId"].as_str().unwrap_or_default().to_string(),
+    )
+}
+
+#[test]
+fn printed_literal_into_a_shell_is_judged() {
+    for command in [
+        // The reported shapes.
+        "awk 'BEGIN{print \"git reset --hard\" | \"sh\"}'",
+        "awk 'BEGIN{print \"git reset --hard\" | \"bash\"}'",
+        "awk 'BEGIN{cmd=\"git reset --hard\"; print cmd | \"sh\"}'",
+        // Other shells, paths, options that keep stdin the script, wrappers.
+        "awk 'BEGIN{print \"git reset --hard\" | \"/bin/sh\"}'",
+        "awk 'BEGIN{print \"git reset --hard\" | \"dash\"}'",
+        "awk 'BEGIN{print \"git reset --hard\" | \"bash -e\"}'",
+        "awk 'BEGIN{print \"git reset --hard\" | \"sh -s arg\"}'",
+        "awk 'BEGIN{print \"git reset --hard\" | \"sudo sh\"}'",
+        // printf with a static format, print with parentheses, commas and
+        // concatenation, and gawk's coprocess pipe.
+        "awk 'BEGIN{printf \"git reset --hard\\n\" | \"sh\"}'",
+        "awk 'BEGIN{print(\"git reset --hard\") | \"sh\"}'",
+        "awk 'BEGIN{print \"git\", \"reset\", \"--hard\" | \"sh\"}'",
+        "awk 'BEGIN{print \"git reset \" \"--hard\" | \"sh\"}'",
+        "gawk 'BEGIN{print \"git reset --hard\" |& \"sh\"}'",
+        // Other awks, a rule body, and the program in shell double quotes.
+        "mawk 'BEGIN{print \"git reset --hard\" | \"sh\"}'",
+        "awk '{print \"git reset --hard\" | \"sh\"}' input.txt",
+        "awk \"BEGIN{print \\\"git reset --hard\\\" | \\\"sh\\\"}\"",
+    ] {
+        assert_eq!(
+            hook(command),
+            ("deny".to_string(), "core.git:reset-hard".to_string()),
+            "{command}"
+        );
+    }
+}
+
+#[test]
+fn computed_print_into_a_shell_is_unverified() {
+    for command in [
+        // A field: the command comes from the input.
+        "awk '{print \"rm \" $1 | \"sh\"}' list.txt",
+        "awk '{print $0 | \"bash\"}' script.txt",
+        // A variable assigned twice, or reassignable from the command line.
+        "awk 'BEGIN{c=\"ls\"; c=c \" -la\"; print c | \"sh\"}'",
+        "awk -v cmd=ls 'BEGIN{print cmd | \"sh\"}'",
+        "awk 'BEGIN{cmd=\"ls\"; print cmd | \"sh\"}' cmd=x",
+        // A printf format with a conversion.
+        "awk 'BEGIN{printf \"%s\\n\", \"ls\" | \"sh\"}'",
+    ] {
+        assert_eq!(
+           
```

---

### Incident Patch 6: `00c11031` (2026-10-01)
**Commit Message**: fix(heredoc): judge a shell sink's single string and Perl's qx with any delimiter through the packs (GH #512)

`perl -e 'system("git reset --hard")'` was denied, but `perl -e
'system("git push --force origin main")'` and `perl -e 'system("find .
-delete")'` were allowed while the bare commands denied, and `qx{…}`,
`qx(…)` and `qx[…]` were allowed outright.

Two causes:

- A shell sink's string argument was judged only by the per-language
  catalogue, which knows `rm` and `git reset`-style payloads. The code
  assumed the raw-shell rescan would see the string as command text. That
  holds for a heredoc body but not for an inline `-e`/`-c` program, which
  is one quoted shell word. Only the argv-split form (`system("git",
  "push", "--force")`) was rebuilt and sent through the packs.
- Only `qx/…/` was read.

Changes:

- `exec_sink_reconstructed_commands` now also rebuilds a call given one
  string, when that sink certainly runs it through a shell: Perl
  `system`/`exec`, Ruby `system`/`exec`/`spawn`, Python
  `os.system`/`os.popen`/`getoutput`/`getstatusoutput` (and
  `run`/`call`/`Popen`/`check_*` only with `shell=True`), PHP
  `shell_exec`/`passthru`/`system`/`exec`/`popen`/`proc_

**File**: `src/ast_pattern_engine.rs` (modified, +351/-33)
```diff
@@ -624,9 +624,11 @@ pub struct ReconstructedCommand {
 /// evaluating THAT is the only way it reaches its pack rule. This is the #459
 /// gap generalized past `rm`.
 ///
-/// Only a multi-literal argv is reconstructed: a single-string sink argument
-/// (`execSync('dd if=… of=…')`) is contiguous command text the raw-shell rescan
-/// already sees, so re-evaluating it would add nothing.
+/// A single-string sink argument (`execSync('dd if=… of=…')`) is reconstructed
+/// too, but only for a sink that hands that string to a shell
+/// ([`single_string_sink_runs_shell`]). The raw-shell rescan sees such text in a
+/// heredoc body, never inside an inline `-e`/`-c` program, which is one quoted
+/// shell word (#512). Perl's backtick and `qx` commands are added the same way.
 #[must_use]
 pub fn exec_sink_reconstructed_commands(
     code: &str,
@@ -680,18 +682,154 @@ pub fn exec_sink_reconstructed_commands(
         // reconstructing `dd` from `"d"+"d"` as two argv words would not be the
         // command the call actually runs (#474).
         let operands = concatenated_operands(exec_argv_region(region));
-        if operands.len() < 2 {
-            continue;
-        }
+        let command = match operands.as_slice() {
+            [] => continue,
+            // One string handed to a shell (#512): see below.
+            [script] => {
+                if !single_string_sink_runs_shell(
+                    language,
+                    caps.name("sink")
+                        .or_else(|| caps.name("call"))
+                        .map_or("", |s| s.as_str()),
+                    haystack,
+                    m.start(),
+                    region,
+                ) {
+                    continue;
+                }
+                script.to_string()
+            }
+            _ => operands.join(" "),
+        };
         out.push(ReconstructedCommand {
-            command: operands.join(" "),
+            command,
             start: m.start(),
             end: m.end(),
         });
     }
+    if language == ScriptLanguage::Perl {
+        // Backticks and `qx` hand their text to the shell as well. A payload the
+        // rm/git catalogue flags (`heredoc.perl.backticks.*`, `….qx.*`) is left
+        // to it, as above, so allowlisting the reported id still allows it.
+        let backticks = PERL_BACKTICKS_LITERAL
+            .captures_iter(haystack)
+            .filter_map(|caps| {
+                let whole = caps.get(0)?;
+                let payload = caps.name("cmd")?;
+                Some((whole.start()..whole.end(), payload.as_str().to_string()))
+            });
+        for (span, payload) in backticks.chain(perl_qx_literals(haystack)) {
+            if payload.trim().is_empty() || detect_shell_payload(&payload).is_some() {
+                continue;
+            }
+            out.push(ReconstructedCommand {
+                command: payload,
+                start: span.start,
+                end: span.end,
+            });
+        }
+    }
     out
 }
 
+/// Whether an exec sink handed exactly one string runs that string through a
+/// shell, so the string is a whole command line the packs should judge (#512).
+///
+/// Only a single-string call is asked: an argv-split call is reconstructed
+/// whatever its sink. The string forms were left to the raw-shell rescan, which
+/// sees a heredoc body's text but never an inline `perl -e '…'` body, where the
+/// whole program is one quoted shell word: `perl -e 'system("find . -delete")'`
+/// and `system("git push --force origin main")` were allowed while the bare
+/// commands denied, because the per-language catalogue knows only `rm` and
+/// `git reset`-style payloads.
+///
+/// Each language answers only for sinks whose single string certainly reaches
+/// `/bin/sh` (or, without shell metacharacters, is split and run the same way):
+///
+/// - Perl `system`/`exec`; Ruby `system`/`exec`/`spawn` (not as a method of
+///   some other receiver, which would be an unrelated method);
+/// - Python `os.system`/`os.popen`/`subprocess.getoutput`/`getstatusoutput`,
+///   and `subprocess.run`/`call`/`Popen`/`check_*` only with `shell=True`
+///   (without it the string is a program NAME, not a command line);
+/// - PHP `shell_exec`/`passthru`/`system`/`exec`/`popen`/`proc_open` as plain
+///   functions (`$pdo->exec("…")` runs SQL, not a shell);
+/// - JavaScript `execSync`, `exec` on `child_process` (not `RegExp.exec` or a
+///   database handle's `exec`), and `spawn`/`execFile` family with
+///   `shell: true`.
+///
+/// Go's `exec.Command` never uses a shell, so it answers false.
+fn single_string_sink_runs_shell(
+    language: ScriptLanguage,
+    sink: &str,
+    code: &str,
+    sink_start: usize,
+    region: &str,
+) -> bool {
+    let receiver = code[..sink_start].trim_end();
+    let is_method = receiver.ends_with('.') || receiver.ends_with("->") || receiver.ends_with("::");
+    let receiver_name = || {
+        receiver
+
```

**File**: `tests/repro_512_perl_shell_sinks.rs` (added, +211/-0)
```diff
@@ -0,0 +1,211 @@
+//! #512: `perl -e` shell sinks were judged only by a per-language catalogue.
+//!
+//! `perl -e 'system("git reset --hard")'` was denied (the catalogue knows
+//! `git reset --hard`), but `system("git push --force origin main")` and
+//! `system("find . -delete")` were allowed while the bare commands denied, and
+//! `qx{…}`, `qx(…)` and `qx[…]` were allowed outright because only `qx/…/` was
+//! read. An inline program is one quoted shell word, so no other layer sees
+//! the string the sink hands to `/bin/sh`.
+//!
+//! Now a single string given to a shell sink, a backtick command and a `qx`
+//! command with any delimiter are evaluated through the packs, like the
+//! argv-split form already was. A payload the catalogue owns keeps its rule
+//! id, so an allowlist entry for that id still works. The same holds for the
+//! other languages' unambiguous shell sinks.
+//!
+//! Every case goes through the real Claude Code `PreToolUse` hook.
+
+use std::io::Write;
+use std::process::{Command, Stdio};
+
+/// `(decision, rule id)` from the real hook for one Bash command, with an
+/// optional user allowlist.
+fn hook_with_allowlist(command: &str, allowlist: Option<&str>) -> (String, String) {
+    let temp = tempfile::tempdir().expect("temp dir");
+    let home = temp.path().join("home");
+    std::fs::create_dir_all(&home).expect("home");
+    let payload = serde_json::json!({
+        "hook_event_name": "PreToolUse",
+        "tool_name": "Bash",
+        "tool_input": {"command": command},
+    })
+    .to_string();
+    let mut cmd = Command::new(env!("CARGO_BIN_EXE_dcg"));
+    cmd.env_clear()
+        .env("HOME", &home)
+        .env("USERPROFILE", &home)
+        .env("DCG_ALLOWLIST_SYSTEM_PATH", "")
+        .env("DCG_NO_SELF_HEAL", "1")
+        .env("DCG_HOOK_TIMEOUT_MS", "5000")
+        .current_dir(temp.path())
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped());
+    let xdg = temp.path().join("xdg_config");
+    std::fs::create_dir_all(xdg.join("dcg")).expect("xdg");
+    cmd.env("XDG_CONFIG_HOME", &xdg);
+    if let Some(allowlist) = allowlist {
+        std::fs::write(xdg.join("dcg/allowlist.toml"), allowlist).expect("write allowlist");
+    }
+    let mut child = cmd.spawn().expect("spawn dcg");
+    child
+        .stdin
+        .as_mut()
+        .expect("stdin")
+        .write_all(payload.as_bytes())
+        .expect("write payload");
+    let out = child.wait_with_output().expect("wait");
+    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
+    if stdout.is_empty() {
+        assert!(out.status.success(), "silent non-zero exit for {command:?}");
+        return ("allow".to_string(), String::new());
+    }
+    let parsed: serde_json::Value = serde_json::from_str(&stdout)
+        .unwrap_or_else(|e| panic!("bad hook output for {command:?} ({e}): {stdout}"));
+    let output = &parsed["hookSpecificOutput"];
+    (
+        output["permissionDecision"]
+            .as_str()
+            .unwrap_or("<missing>")
+            .to_string(),
+        output["ruleId"].as_str().unwrap_or_default().to_string(),
+    )
+}
+
+fn hook(command: &str) -> (String, String) {
+    hook_with_allowlist(command, None)
+}
+
+fn denied_as(command: &str, rule: &str) {
+    assert_eq!(
+        hook(command),
+        ("deny".to_string(), rule.to_string()),
+        "{command}"
+    );
+}
+
+#[test]
+fn perl_system_strings_reach_the_packs() {
+    // The reported rows.
+    denied_as(
+        "perl -e 'system(\"git push --force origin main\")'",
+        "core.git:push-force-long",
+    );
+    denied_as(
+        "perl -e 'system(\"find . -delete\")'",
+        "core.filesystem:find-delete-general",
+    );
+    // Parenless and exec spellings, and the program in a heredoc.
+    denied_as(
+        "perl -e 'system \"find . -delete\"'",
+        "core.filesystem:find-delete-general",
+    );
+    denied_as(
+        "perl -e 'exec(\"git push --force origin main\")'",
+        "core.git:push-force-long",
+    );
+    assert_eq!(
+        hook("perl <<'EOF'\nsystem(\"find . -delete\");\nEOF").0,
+        "deny"
+    );
+}
+
+#[test]
+fn perl_qx_with_any_delimiter_is_a_shell_sink() {
+    for command in [
+        "perl -e 'qx{git reset --hard}'",
+        "perl -e 'qx(git reset --hard)'",
+        "perl -e 'qx[git reset --hard]'",
+        "perl -e 'qx<git reset --hard>'",
+        "perl -e 'qx!git reset --hard!'",
+        "perl -e 'qx/git reset --hard/'",
+        "perl -e 'my $x = qx {git reset --hard};'",
+    ] {
+        let (decision, rule) = hook(command);
+        assert_eq!(decision, "deny", "{command}");
+        assert_eq!(rule, "heredoc.perl:qx.git_reset_hard", "{command}");
+    }
+    // A payload the catalogue does not know reaches the packs.
+    denied_as(
+        "perl -e 'print qx{find . -delete}'",
+        "core.filesystem:find-delete-general",
+    );
+    denied_as(
+        "perl -e 'print `find . 
```

---

### Incident Patch 7: `cf3f2fef` (2026-10-01)
**Commit Message**: fix(history): analyze judges nothing from no data, rows record the hostname, exit_code documented as unknown (GH #513, #514, #515)

#513: `dcg history analyze` on an empty history printed green "no coverage
gaps" and "no high bypass rates" checks and recommended disabling packs,
`core` first, from zero commands.

- With no rows in the period it now says there is nothing to analyze and how
  to enable `[history]` (or that it is enabled, naming the database, or that
  DCG_HISTORY_DISABLED turns it off), and prints no verdicts. Exit status
  stays 0, like the other `dcg history` views of an empty database. The JSON
  output gains `has_data`; every list is empty when it is false.
- A pack that never matched is no longer a recommendation. A guard pack that
  stays quiet is working, and zero denials cannot show that the tooling it
  guards is unused. Such packs are still listed, worded as expected. The
  removed recommendation's config snippet (`[packs.x] enabled = false`) was
  not valid dcg config either. `RecommendationType::DisablePack` is gone.
- The config always carries the `core` category marker while rows name the
  leaf (`core.git`), and the two were compared by equality, so `c

**File**: `CHANGELOG.md` (modified, +15/-0)
```diff
@@ -11,6 +11,21 @@ Repository: <https://github.com/Dicklesworthstone/destructive_command_guard>
 
 ---
 
+## Unreleased
+
+### Command history
+
+- `dcg history analyze` on an empty history now says there is nothing to
+  analyze and how to enable `[history]`, instead of green "no coverage gaps"
+  checks and advice to disable packs, `core` first, drawn from zero commands.
+  The JSON output gains `has_data`. With data, a pack that never matched is
+  still listed but is no longer recommended for removal: a guard pack that
+  stays quiet is working (#513).
+- History rows now record the machine's `hostname`; it was always NULL (#514).
+- The docs and `dcg history analyze --help` now state that `exit_code` is NULL
+  on every row the hook writes, because the hook runs before the command and
+  cannot know how it ended. NULL means unknown, not success (#515).
+
 ## [v0.15.2](https://github.com/Dicklesworthstone/destructive_command_guard/releases/tag/v0.15.2) -- 2026-10-01 [Release]
 
 **This is a security fix release. v0.15.1 can fail open under load: upgrade.**
```

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -992,6 +992,7 @@ dependencies = [
  "insta",
  "libc",
  "memchr",
+ "nix",
  "once_cell",
  "predicates",
  "proptest",
```

**File**: `Cargo.toml` (modified, +6/-0)
```diff
@@ -110,6 +110,12 @@ tru = "0.2.2"
 # stack and the regex renderer below already has a purpose-built highlighter.
 rich_rust = { version = "0.2.2", features = ["markdown"], optional = true }
 
+[target.'cfg(unix)'.dependencies]
+# Safe `gethostname()` for the history `hostname` column (#514). nix is already
+# compiled in through ctrlc; this only turns on its `hostname` feature, so no
+# new crate enters the graph and `#![forbid(unsafe_code)]` still holds here.
+nix = { version = "0.31", default-features = false, features = ["hostname"] }
+
 [build-dependencies]
 vergen-gix = { version = "10.0.0-beta.8", features = ["build", "cargo", "rustc"] }
 # Windows PE metadata (#303): a VERSIONINFO resource (product/company/
```

**File**: `README.md` (modified, +12/-0)
```diff
@@ -770,6 +770,18 @@ working. Directories dcg creates for the database are owner-only (`0700`).
 `dcg doctor` prints the resolved path, which rule selected it, and whether the
 hook can write there.
 
+What a row can and cannot tell you:
+
+- `hostname` is the machine that recorded the row, so databases copied off
+  several machines can be merged and still attributed.
+- `exit_code` is always NULL on rows the hook writes. dcg runs *before* the
+  command, so it never learns how the command ended. Read NULL as "unknown",
+  not as "succeeded". History records dcg's decisions (allow, deny, warn,
+  bypass); it cannot by itself show that an allowed command did damage.
+- `dcg history analyze` works from those decisions. With no recorded commands
+  it says so and makes no recommendations. A pack that never matched is listed
+  but never recommended for removal: a guard pack that stays quiet is working.
+
 ### Output Formats and `DCG_FORMAT`
 
 `--format` (and the `DCG_FORMAT` env var, which seeds the default) is
```

**File**: `docs/configuration.md` (modified, +8/-0)
```diff
@@ -367,6 +367,14 @@ The database path resolves in this order (highest priority first):
    `%LOCALAPPDATA%\dcg\history.db`
 
 `DCG_HISTORY_DISABLED=1` prevents the database from being opened at all.
+
+Each row records the decision, the rule that made it, the agent, working
+directory, session, and the recording machine's `hostname`. The `exit_code`
+column is NULL on every row the hook writes: the hook runs before the command
+executes, so the outcome is unknown to dcg, and NULL means "unknown", not
+"succeeded". `dcg history analyze` therefore reports on decisions, not
+outcomes, and with an empty history it reports that there is nothing to
+analyze instead of producing recommendations.
 Directories dcg creates for the database are `0700` on Unix. `dcg doctor`
 reports the resolved path, its source, and whether the hook can write there
 (check id `history` in `--format json`).
```

**File**: `src/cli.rs` (modified, +43/-3)
```diff
@@ -1507,6 +1507,11 @@ pub enum HistoryAction {
     },
 
     /// Analyze pack effectiveness and generate recommendations
+    ///
+    /// Works from recorded decisions (allow, deny, warn, bypass), not command
+    /// outcomes: dcg's hooks run before a command executes, so `exit_code` is
+    /// NULL (unknown) on the rows they write. With no recorded commands it
+    /// reports that there is nothing to analyze.
     #[command(name = "analyze")]
     Analyze {
         /// Time period in days (default: 30)
@@ -10344,7 +10349,9 @@ fn history_analyze(
     // Get enabled packs from config
     let config = Config::load();
     let enabled_pack_ids = config.enabled_pack_ids();
-    let enabled_packs: Vec<&str> = enabled_pack_ids.iter().map(String::as_str).collect();
+    let mut enabled_packs: Vec<&str> = enabled_pack_ids.iter().map(String::as_str).collect();
+    // A set has no order; sort so the listing is stable from run to run.
+    enabled_packs.sort_unstable();
 
     let analysis = db.analyze_pack_effectiveness(days, &enabled_packs)?;
 
@@ -10365,6 +10372,36 @@ fn history_analyze(
         analysis.total_commands.to_string().yellow()
     );
 
+    // Nothing recorded means nothing was judged. Printing the usual sections
+    // here produced green "no gaps" checks and advice to disable `core` drawn
+    // from zero commands (#513).
+    if !analysis.has_data {
+        println!(
+            "{}",
+            format!(
+                "No command history in the last {} days, so there is nothing to analyze.",
+                analysis.period_days
+            )
+            .yellow()
+        );
+        if crate::history::history_disabled_by_env() {
+            println!(
+                "History collection is turned off by {ENV_HISTORY_DISABLED} in this environment."
+            );
+        } else if config.history.enabled {
+            println!(
+                "History collection is enabled; rows appear as the hook evaluates commands \
+                 (database: {}).",
+                ResolvedHistoryPath::resolve(&config.history).path.display()
+            );
+        } else {
+            println!(
+                "History collection is off. Enable it in config.toml with:\n\n  [history]\n  enabled = true\n"
+            );
+        }
+        return Ok(());
+    }
+
     // Show recommendations (always unless specific view requested)
     if !false_positives && !gaps || recommendations_only {
         if analysis.recommendations.is_empty() {
@@ -10463,11 +10500,14 @@ fn history_analyze(
             );
         }
 
-        // Show inactive packs
+        // Show inactive packs. A guard pack that never fired is working, so
+        // this is a listing, not advice to disable anything (#513).
         if !analysis.inactive_packs.is_empty() {
             println!(
-                "\n{} Inactive packs (enabled but never triggered): {}",
+                "\n{} Enabled packs with no matches in these {} commands (expected for \
+                 guard packs; not a reason to disable them): {}",
                 "ℹ️ ".dimmed(),
+                analysis.total_commands,
                 analysis.inactive_packs.join(", ").dimmed()
             );
         }
```

**File**: `src/history/mod.rs` (modified, +70/-0)
```diff
@@ -72,6 +72,46 @@ pub const ENV_HISTORY_DISABLED: &str = "DCG_HISTORY_DISABLED";
 /// omission from unexplained data loss. Normal robot/hook output stays silent.
 pub const ENV_HISTORY_DIAGNOSTICS: &str = "DCG_HISTORY_DIAGNOSTICS";
 
+/// The machine's hostname for the history `hostname` column (#514).
+///
+/// Resolved once per process and cached: a hook process records at most a few
+/// rows, and the lookup is one syscall on Unix and one environment read on
+/// Windows, so it never spawns a process. `None` when the platform gives no
+/// usable name; a NULL column then means "unknown", as it always has.
+#[must_use]
+pub fn local_hostname() -> Option<&'static str> {
+    static HOSTNAME: std::sync::OnceLock<Option<String>> = std::sync::OnceLock::new();
+    HOSTNAME
+        .get_or_init(|| resolve_local_hostname().and_then(|raw| normalize_hostname(&raw)))
+        .as_deref()
+}
+
+#[cfg(unix)]
+fn resolve_local_hostname() -> Option<String> {
+    nix::unistd::gethostname()
+        .ok()
+        .map(|name| name.to_string_lossy().into_owned())
+}
+
+#[cfg(windows)]
+fn resolve_local_hostname() -> Option<String> {
+    // Windows sets COMPUTERNAME for every process; it is the NetBIOS name,
+    // which is what `hostname.exe` prints.
+    env::var("COMPUTERNAME").ok()
+}
+
+#[cfg(not(any(unix, windows)))]
+fn resolve_local_hostname() -> Option<String> {
+    None
+}
+
+/// Trim a raw hostname and reject one that is empty or contains control
+/// characters, so the column never holds a newline or a terminal escape.
+fn normalize_hostname(raw: &str) -> Option<String> {
+    let name = raw.trim();
+    (!name.is_empty() && !name.chars().any(char::is_control)).then(|| name.to_string())
+}
+
 fn history_diagnostic(status: &str, detail: std::fmt::Arguments<'_>) {
     if env::var(ENV_HISTORY_DIAGNOSTICS)
         .is_ok_and(|value| value == "1" || value.eq_ignore_ascii_case("true"))
@@ -438,6 +478,11 @@ impl HistoryWriter {
             entry.session_id = Some(self.session_id.clone());
         }
         if let Some(sender) = &self.sender {
+            // Every writer path used to leave this NULL, so rows from several
+            // machines could not be told apart once merged (#514).
+            if entry.hostname.is_none() {
+                entry.hostname = local_hostname().map(str::to_string);
+            }
             if let Err(e) = sender.send(HistoryMessage::Entry(Box::new(entry))) {
                 // Channel disconnected - worker thread likely crashed or shutdown
                 warn!(
@@ -1089,6 +1134,31 @@ fn redact_for_history(command: &str, mode: HistoryRedactionMode) -> String {
 mod tests {
     use super::*;
 
+    #[test]
+    fn hostname_normalization_rejects_empty_and_control_characters_514() {
+        assert_eq!(
+            normalize_hostname("  build-01 \n"),
+            Some("build-01".to_string())
+        );
+        assert_eq!(normalize_hostname(""), None);
+        assert_eq!(normalize_hostname(" \t\n"), None);
+        assert_eq!(normalize_hostname("evil\nhost"), None);
+        assert_eq!(normalize_hostname("esc\u{1b}[31m"), None);
+    }
+
+    #[test]
+    fn local_hostname_is_resolved_once_and_is_never_blank_514() {
+        let first = local_hostname();
+        if cfg!(unix) {
+            assert!(first.is_some(), "gethostname must name a Unix host");
+        }
+        if let Some(name) = first {
+            assert!(!name.is_empty() && name == name.trim());
+            // Cached: the same allocation comes back.
+            assert!(std::ptr::eq(name, local_hostname().unwrap()));
+        }
+    }
+
     #[test]
     fn idle_and_disabled_workers_have_no_flush_poll_timer() {
         let config = WorkerConfig::default();
```

**File**: `src/history/schema.rs` (modified, +110/-31)
```diff
@@ -268,13 +268,20 @@ pub struct CommandEntry {
     /// Optional session ID to group commands.
     #[serde(skip_serializing_if = "Option::is_none")]
     pub session_id: Option<String>,
-    /// Exit code if the command was executed.
+    /// Exit code of the command, when the writer knows it.
+    ///
+    /// dcg's hooks run *before* the command executes, so every row they write
+    /// leaves this `None` (SQL `NULL`): it means "unknown", never "succeeded"
+    /// (#515). Nothing in dcg fills it today; the column exists for sources that
+    /// observe the outcome.
     #[serde(skip_serializing_if = "Option::is_none")]
     pub exit_code: Option<i32>,
     /// Parent command ID for subshell tracking.
     #[serde(skip_serializing_if = "Option::is_none")]
     pub parent_command_id: Option<i64>,
-    /// Hostname for multi-machine setups.
+    /// Hostname of the machine that recorded the row, so merged databases
+    /// from several machines stay attributable. The history writer fills it
+    /// when the caller leaves it `None` (#514).
     #[serde(skip_serializing_if = "Option::is_none")]
     pub hostname: Option<String>,
     /// Allowlist layer that matched (if command was allowed by allowlist).
@@ -2479,6 +2486,23 @@ impl HistoryDb {
         )?;
         let total_commands = u64::try_from(sv_to_i64(&total_row.values()[0])).unwrap_or(0);
 
+        // With nothing recorded there is nothing to judge: every pack would be
+        // "inactive" and every gap check vacuously clean, which used to read as
+        // a green verdict recommending that `core` be disabled (#513).
+        if total_commands == 0 {
+            return Ok(PackEffectivenessAnalysis {
+                period_days,
+                analyzed_at: now,
+                total_commands,
+                has_data: false,
+                high_value_patterns: Vec::new(),
+                potentially_aggressive: Vec::new(),
+                inactive_packs: Vec::new(),
+                potential_gaps: Vec::new(),
+                recommendations: Vec::new(),
+            });
+        }
+
         // Query pattern effectiveness (denied + bypassed counts)
         let pattern_stats = self.query_pattern_effectiveness(&since_ts, &end_ts)?;
 
@@ -2487,27 +2511,35 @@ impl HistoryDb {
 
         // Find inactive packs
         let active_packs = self.query_active_packs(&since_ts, &end_ts)?;
+        // An enabled id may be a category marker: the config always carries
+        // `core`, while rows name the leaf pack (`core.git`). Comparing them by
+        // equality listed `core` as never triggered on every machine (#513).
         let inactive_packs: Vec<String> = enabled_packs
             .iter()
-            .filter(|pack| !active_packs.contains(&pack.to_string()))
+            .filter(|pack| {
+                let pack: &str = pack;
+                !active_packs.iter().any(|active| {
+                    active == pack
+                        || active
+                            .strip_prefix(pack)
+                            .is_some_and(|rest| rest.starts_with('.'))
+                })
+            })
             .map(std::string::ToString::to_string)
             .collect();
 
         // Find potential coverage gaps
         let potential_gaps = self.find_coverage_gaps(&since_ts, &end_ts)?;
 
         // Generate recommendations
-        let recommendations = Self::generate_recommendations(
-            &high_value,
-            &aggressive,
-            &inactive_packs,
-            &potential_gaps,
-        );
+        let recommendations =
+            Self::generate_recommendations(&high_value, &aggressive, &potential_gaps);
 
         Ok(PackEffectivenessAnalysis {
             period_days,
             analyzed_at: now,
             total_commands,
+            has_data: true,
             high_value_patterns: high_value,
             potentially_aggressive: aggressive,
             inactive_packs,
@@ -2713,10 +2745,14 @@ impl HistoryDb {
     }
 
     /// Generate recommendations based on analysis.
+    ///
+    /// A pack that never matched is deliberately not a recommendation: a guard
+    /// pack that stays quiet on a well-behaved machine is doing its job, and
+    /// zero denials cannot show that the tooling it guards is never used (#513).
+    /// Such packs are only listed, in [`PackEffectivenessAnalysis::inactive_packs`].
     fn generate_recommendations(
         high_value: &[PatternEffectiveness],
         aggressive: &[PatternEffectiveness],
-        inactive_packs: &[String],
         gaps: &[PotentialGap],
     ) -> Vec<PackRecommendation> {
         let mut recommendations = Vec::new();
@@ -2741,24 +2777,6 @@ impl HistoryDb {
             });
         }
 
-        // Recommend disabling inactive packs
-        for pack in inactive_packs.iter().take(3) {
-            recommendations.push(PackRecommendation {
-                recommendation_type: RecommendationType::DisablePack,
-                descrip
```

---

### Incident Patch 8: `8fa6aeb3` (2026-10-01)
**Commit Message**: fix(bridges): the OpenCode plugin and the Oh My Pi bridge block when dcg gives no verdict (review of 18be8e9)

18be8e9 makes a panicking hook answer instead of crashing, but a dcg that
is killed (OOM, SIGKILL, the bridge's own timeout) or exits without a
verdict still cannot answer, and two of the generated bridges read that
as an allow.

OpenCode: the plugin read empty stdout as allow, which is the
Claude-compatible encoding, so it could not tell an allowed command from a
dead dcg. A dcg killed by a signal (including the plugin's 10 s timeout,
which also set result.error and was taken for "dcg could not run"), one
that exited non-zero, or one that exited 0 with nothing or garbage on
stdout, let the command run.

- The plugin now sends `"dcg_explicit_verdict": true`, and dcg answers an
  allowed command (and a tool it does not judge) with
  `{"dcg_verdict":"allow"}`. The line goes through the single-answer stdout
  claim, so a request that already got a deny or ask document gets nothing
  more.
- The key is dcg-only on purpose: in Claude Code a `permissionDecision` of
  `allow` would skip the user's own permission prompt. No host sends the
  field, so every protocol keeps its own a

**File**: `CHANGELOG.md` (modified, +20/-0)
```diff
@@ -61,6 +61,26 @@ yet.
   the quoted argument it runs, which the scorer would read as data. The
   hook's reported `confidence` is omitted when the span does not address the
   command.
+- **The OpenCode plugin let a command through when dcg died.** It read
+  dcg's empty stdout as "allow", so a dcg killed by a signal (including the
+  plugin's own timeout), one that exited non-zero, or one that exited 0
+  without answering, allowed the command. The plugin now asks dcg for an
+  explicit `{"dcg_verdict":"allow"}` line and blocks when there is none, with
+  the reason in the error. A dcg that cannot be started at all still fails
+  open, and `DCG_BRIDGE_CRASH_DECISION=allow` restores fail-open for crashes.
+- **The Oh My Pi bridge let a command through when dcg crashed or was
+  killed.** A signal (including the bridge's own timeout kill) or an exit
+  status dcg never uses for a verdict now blocks, unless a deny was already
+  written or `DCG_BRIDGE_CRASH_DECISION=allow` is set. A dcg that cannot be
+  started still fails open, and `DCG_UNVERIFIED_DECISION=deny` still blocks
+  both.
+
+**OpenCode and Oh My Pi users: refresh the plugin or bridge after upgrading**
+(`dcg install --opencode --force`, `dcg install --omp --force`; `dcg update`
+does it for you when its installer detects the agent, unless you pass
+`--no-configure`). The fixes live in the
+generated files. An old file keeps working with the new dcg, without the new
+blocking.
 
 - **A heredoc with an unquoted delimiter that only stores text was judged as
   commands.** `cat <<EOF > notes.md` documenting `watch '…'`, `sh -c '…'`,
```

**File**: `README.md` (modified, +6/-3)
```diff
@@ -717,6 +717,7 @@ Environment variables override config files (highest priority):
 - `DCG_FORMAT=text|json|sarif`: default output format (command-specific — see [Output Formats](#output-formats-and-dcg_format) for which values each subcommand actually accepts; real SARIF is `dcg scan`-only)
 - `DCG_FAIL_CLOSED=1`: block (deny) on hook input that cannot be parsed, instead of the default fail-open allow (opt-in; see [Bounded Failure Policy](#bounded-failure-policy))
 - `DCG_UNVERIFIED_DECISION=deny|ask`: decision for commands dcg could not verify (evaluation timeout, or over `max_command_bytes`); `deny` suits unattended sessions where nobody can answer `ask` (see [Bounded Failure Policy](#bounded-failure-policy))
+- `DCG_BRIDGE_CRASH_DECISION=allow`: let a command through when the OpenCode plugin or the Oh My Pi bridge started dcg but got no verdict from it (dcg crashed or was killed); the default blocks (see [Bounded Failure Policy](#bounded-failure-policy))
 - `DCG_BYPASS=1`: bypass dcg entirely (escape hatch; use sparingly)
 - `DCG_CONFIG=/path/to/config.toml`: use explicit config file
 - `DCG_HEREDOC_ENABLED=true|false`: enable/disable heredoc scanning
@@ -902,7 +903,9 @@ an oversized extracted command as proof that execution is safe.
 | Extracted command exceeds `max_command_bytes` | Explicit indeterminate result | Review-capable clients receive `ask` (`unverified_decision = "deny"` turns this into a deny); other clients block |
 | Absolute evaluation deadline expires | Explicit indeterminate result | Review-capable clients receive `ask` (`unverified_decision = "deny"` turns this into a deny); other clients block |
 | Heredoc extraction/parse/AST failure | Run the bounded fallback scanner | `fallback_on_parse_error = false` or `fallback_on_timeout = false` blocks |
-| Oh My Pi bridge gets no verdict (dcg cannot start, crashes, or is killed) | Allow with a visible `infrastructure failure` diagnostic | `DCG_UNVERIFIED_DECISION=deny` in OMP's environment blocks; the config-file setting cannot apply because dcg never read it |
+| OpenCode plugin or Oh My Pi bridge: dcg cannot be started (missing or not executable) | Allow with a visible diagnostic, so a broken install does not block every command | OMP: `DCG_UNVERIFIED_DECISION=deny` in its environment blocks; the config-file setting cannot apply because dcg never read it |
+| OpenCode plugin or Oh My Pi bridge: dcg started but gave no verdict (killed by a signal or the bridge's timeout, an unexpected exit status; for OpenCode also exit 0 without its explicit allow line) | Block, with the reason and a visible diagnostic; a deny dcg wrote before dying still stands | `DCG_BRIDGE_CRASH_DECISION=allow` in the agent's environment lets such commands through; `DCG_UNVERIFIED_DECISION=deny` still blocks |
+| A panic in the hook after its configuration is loaded and before a shell command is known to be allowed | The unverified-command response for the request's protocol (ask, or deny under `unverified_decision = "deny"`) | Always blocking |
 
 **Configurable Strictness**:
 
@@ -1126,8 +1129,8 @@ present.
 - **Grok (xAI):** [Grok Build / Grok CLI](https://x.ai/news/grok-build-cli) auto-discovers every `*.json` under `~/.grok/hooks/`. `dcg install --grok` writes a self-contained `~/.grok/hooks/dcg.json` with a `PreToolUse` / `matcher: "Bash"` entry — Grok internally aliases Claude-style `"Bash"` to its own `run_terminal_cmd` tool, so a single rule covers every shell command. dcg detects Grok at runtime from the camelCase wire shape (`hookEventName: "pre_tool_use"`, `toolName: "run_terminal_cmd"`) or from the `GROK_SESSION_ID` / `GROK_HOOK_EVENT` / `GROK_WORKSPACE_ROOT` environment variables, and switches its output to Grok's JSON contract: `{"decision":"deny","reason":...}` (note `"deny"`, not Hermes' `"block"`). Grok also picks up dcg automatically through its `~/.claude/settings.json` compatibility layer, so existing Claude Code users get protection with no additional install step. Add `--project` to write `<repo>/.grok/hooks/dcg.json` for a per-repo install (Grok requires `/hooks-trust` the first time it opens a repo with hooks).
 - **Antigravity CLI (`agy`):** [Google Antigravity's `agy` CLI](https://antigravity.google) ships a Claude-Code-compatible hooks system. `dcg install --agy` merges a `PreToolUse` / `matcher: "Bash"` entry into `~/.gemini/config/hooks.json` (the canonical path; `agy` migrates the legacy `~/.gemini/antigravity-cli/hooks.json` here and symlinks the old path to it). `agy` runs the hook before its `run_command` shell tool; dcg detects `agy` at runtime from the distinctive nested `toolCall` envelope (`{"toolCall":{"name":"run_command","args":{"CommandLine":"…"}},"conversationId":…,"stepIdx":…}`) — the shell command is read from `toolCall.args.CommandLine` — or from the `ANTIGRAVITY_CONVERSATION_ID` environment variable / `agy` parent-process name. dcg switches its output to `agy`'s JSON contract: `{"decision":"block","reason":…}` with exit co
```

**File**: `docs/opencode-integration.md` (modified, +21/-13)
```diff
@@ -1,6 +1,6 @@
 # OpenCode Integration
 
-> Last updated: 2026-08-19 (first-party plugin, issue #318)
+> Last updated: 2026-10-01 (a dcg that gives no verdict blocks; first-party plugin, issue #318)
 
 [OpenCode](https://opencode.ai) does not expose PreToolUse-style hook config
 files the way Claude Code, Codex, or Gemini do. Its interception surface is a
@@ -29,16 +29,24 @@ The generated `dcg-guard.js`:
 2. Spawns the dcg binary (absolute path embedded at install time — never a
    bare `PATH` lookup, since agent-spawned processes often run with a reduced
    `PATH`) with the Claude-compatible hook envelope on stdin:
-   `{"tool_name":"Bash","tool_input":{"command":"…"}}`, and `OPENCODE=1` in
-   the environment so dcg identifies the calling agent.
-3. Interprets dcg's stdout exactly like the other harnesses: **empty stdout
-   means allow**; a `hookSpecificOutput.permissionDecision` of `"deny"` — or
-   `"ask"`, since OpenCode has no operator-review state, so review requests
-   fail closed — aborts the tool call by throwing an `Error` carrying dcg's
-   full block message (reason, rule id, allow-once code, suggestions).
-4. Fails **open** only on infrastructure errors (dcg binary missing or
-   unrunnable), with a `[dcg]` notice on OpenCode's stderr. The safety
-   *evaluation* itself keeps dcg's bounded fail-closed semantics.
+   `{"tool_name":"Bash","tool_input":{"command":"…"},"dcg_explicit_verdict":true}`,
+   and `OPENCODE=1` in the environment so dcg identifies the calling agent.
+3. Reads dcg's answer. `dcg_explicit_verdict` makes dcg answer an allowed
+   command with `{"dcg_verdict":"allow"}` instead of the silence other hosts
+   get, so silence can mean "dcg never answered". A
+   `hookSpecificOutput.permissionDecision` of `"deny"` — or `"ask"`, since
+   OpenCode has no operator-review state, so review requests fail closed —
+   aborts the tool call by throwing an `Error` carrying dcg's full block
+   message (reason, rule id, allow-once code, suggestions).
+4. **Blocks** when dcg ran but gave no verdict: it was killed by a signal
+   (including the plugin's 10-second timeout), exited non-zero, or exited 0
+   without the allow line. The error says why. A deny dcg wrote before dying
+   still stands with its own reason. Set `DCG_BRIDGE_CRASH_DECISION=allow` in
+   OpenCode's environment to let such commands through instead.
+5. Fails **open** only when dcg cannot be started at all (binary missing or
+   not executable), with a `[dcg]` notice on OpenCode's stderr, so that a
+   broken install does not block every command. `DCG_BYPASS=1` skips the
+   check, as it does in every host.
 
 ## Ownership and uninstall
 
@@ -71,8 +79,8 @@ with `BLOCKED by dcg` and the expected rule id.
 echo '{"tool_name":"Bash","tool_input":{"command":"git reset --hard"}}' | dcg
 # → denial JSON on stdout (plugin throws)
 
-echo '{"tool_name":"Bash","tool_input":{"command":"git status"}}' | dcg
-# → empty stdout, exit 0 (plugin allows)
+echo '{"tool_name":"Bash","tool_input":{"command":"git status"},"dcg_explicit_verdict":true}' | dcg
+# → {"dcg_verdict":"allow"}, exit 0 (plugin allows)
 ```
 
 ## Limitations
```

**File**: `src/cli.rs` (modified, +161/-50)
```diff
@@ -14670,15 +14670,19 @@ fn project_opencode_plugin_path() -> Result<std::path::PathBuf, Box<dyn std::err
 /// Generate the OpenCode `tool.execute.before` plugin source (#318).
 ///
 /// The legacy OpenCode v1 plugin routes every `bash` tool call through dcg's
-/// Claude-compatible hook protocol: an empty stdout means allow; a
-/// `hookSpecificOutput.permissionDecision` of `deny` (or `ask`, since
-/// OpenCode has no operator-review state) aborts the v1 tool hook by throwing.
+/// Claude-compatible hook protocol with `"dcg_explicit_verdict": true`, so an
+/// allowed command is answered with `{"dcg_verdict":"allow"}` rather than
+/// silence; a `hookSpecificOutput.permissionDecision` of `deny` (or `ask`,
+/// since OpenCode has no operator-review state) aborts the v1 tool hook by
+/// throwing.
 /// OpenCode v2 changed both its module/runtime contract and its interception
 /// APIs; dcg refuses to install or bless this v1 bridge when v2+ is detected
-/// until an authoritative veto path is verified (#419). Infrastructure
-/// failures (dcg missing/unrunnable) fail open with a stderr notice, matching
-/// the hook-envelope failure policy; the *evaluation* itself stays fail-closed
-/// inside dcg.
+/// until an authoritative veto path is verified (#419).
+///
+/// A dcg that ran but gave no verdict (killed by a signal or the plugin's
+/// timeout, a non-zero exit, or exit 0 without the allow line) blocks unless
+/// `DCG_BRIDGE_CRASH_DECISION=allow`. Only a dcg that could not be started at
+/// all (missing or not executable) fails open, with a stderr notice.
 ///
 /// The dcg binary path is embedded as a JSON string literal (valid JSON
 /// strings are valid JS string literals), NOT shell-quoted — the plugin
@@ -14718,16 +14722,38 @@ import {{ spawnSync }} from "node:child_process";
 
 const DCG_BIN = {path_literal};
 
-// Returns a deny reason, or null to allow. Infrastructure failures (dcg
-// missing, unrunnable, timed out) fail OPEN with a stderr notice, matching
-// the hook-envelope failure policy; the *evaluation* itself stays fail-closed
-// inside dcg.
+// dcg's own boolean spelling for environment flags.
+function envFlag(name) {{
+  const value = process.env[name];
+  return typeof value === "string" && ["1", "true", "yes", "y", "on"].includes(value.trim().toLowerCase());
+}}
+
+// dcg ran but gave no verdict: it was killed (a signal, or this plugin's
+// timeout), exited non-zero, or exited 0 without its explicit allow line.
+// That is not an allow. Block, unless the operator opted out with
+// DCG_BRIDGE_CRASH_DECISION=allow.
+function noVerdict(detail) {{
+  const setting = process.env.DCG_BRIDGE_CRASH_DECISION;
+  if (typeof setting === "string" && setting.trim().toLowerCase() === "allow") {{
+    console.error(`[dcg] OpenCode guard got no verdict from dcg (${{detail}}); allowed because DCG_BRIDGE_CRASH_DECISION=allow`);
+    return null;
+  }}
+  console.error(`[dcg] OpenCode guard got no verdict from dcg (${{detail}}); blocking`);
+  return `Blocked by dcg: the command could not be verified because dcg gave no verdict (${{detail}}). Set DCG_BRIDGE_CRASH_DECISION=allow to let commands through when dcg fails.`;
+}}
+
+// Returns a deny reason, or null to allow. dcg is asked for an explicit allow
+// line, so an empty stdout means it never answered. Only a dcg that could not
+// be started at all (missing or not executable) fails OPEN, with a stderr
+// notice, so that a broken install does not block every command.
 function dcgDenyReason(command) {{
   if (typeof command !== "string" || command.length === 0) return null;
+  // dcg's escape hatch exits before reading its input, so it never answers.
+  if (envFlag("DCG_BYPASS")) return null;
   let result;
   try {{
     result = spawnSync(process.env.DCG_BIN || DCG_BIN, {{
-      input: JSON.stringify({{ tool_name: "Bash", tool_input: {{ command }} }}),
+      input: JSON.stringify({{ tool_name: "Bash", tool_input: {{ command }}, dcg_explicit_verdict: true }}),
       encoding: "utf8",
       env: {{ ...process.env, OPENCODE: "1" }},
       timeout: 10000,
@@ -14736,27 +14762,43 @@ function dcgDenyReason(command) {{
     console.error(`[dcg] OpenCode guard could not run dcg: ${{err}}`);
     return null;
   }}
-  if (!result || result.error) {{
-    console.error(`[dcg] OpenCode guard could not run dcg: ${{result && result.error}}`);
+  if (!result) {{
+    console.error("[dcg] OpenCode guard could not run dcg: no result");
+    return null;
+  }}
+  // Never started: Node reports status null, Bun leaves it undefined.
+  if (result.error && result.status == null && !result.signal) {{
+    console.error(`[dcg] OpenCode guard could not run dcg: ${{result.error}}`);
     return null;
   }}
 
   const text = (result.stdout || "").trim();
-  if (!text) return null; // empty stdout = allow
-
-  let decision;
-  try {{
-    decision = JSON.parse(text);
-  }} catch {{
-    return null; // non-JSON stdout: treat as allow (matches other harnesses)
+ 
```

**File**: `src/hook.rs` (modified, +39/-0)
```diff
@@ -145,6 +145,17 @@ pub struct HookInput {
     )]
     pub tool_calls: Option<Vec<ToolCall>>,
 
+    /// Sent only by dcg's own generated OpenCode plugin: `true` asks for an
+    /// explicit allow line ([`EXPLICIT_ALLOW_VERDICT`]) instead of the
+    /// protocol's silent allow.
+    ///
+    /// With silence meaning allow, a caller cannot tell an allowed command
+    /// from a dcg that died before answering. The plugin sets this so that an
+    /// empty stdout means "no verdict" and blocks. No host sends the field, so
+    /// every hook protocol keeps its own allow encoding. Raw JSON value for
+    /// the same parse-robustness reason as `permission_mode`.
+    pub dcg_explicit_verdict: Option<serde_json::Value>,
+
     /// Command strings displaced by a *conflicting* snake_case/camelCase alias
     /// pair in the raw envelope (issue #410).
     ///
@@ -790,6 +801,24 @@ fn deliver_verdict(payload: &[u8]) -> io::Result<()> {
     handle.flush()
 }
 
+/// The explicit allow line written for a caller that sent
+/// `"dcg_explicit_verdict": true` (dcg's OpenCode plugin).
+///
+/// Deliberately not any host's allow shape: in Claude Code a
+/// `permissionDecision` of `allow` skips the user's own permission prompt, so
+/// this line uses a dcg-only key that no host acts on.
+pub const EXPLICIT_ALLOW_VERDICT: &[u8] = b"{\"dcg_verdict\":\"allow\"}\n";
+
+/// Write [`EXPLICIT_ALLOW_VERDICT`] unless a verdict document has already
+/// claimed stdout (a deny, ask, or warning was written for this request).
+///
+/// # Errors
+///
+/// The stdout write or flush failed.
+pub fn output_explicit_allow() -> io::Result<()> {
+    deliver_verdict(EXPLICIT_ALLOW_VERDICT)
+}
+
 /// Set once something has begun writing this process's single verdict
 /// document to stdout.
 static VERDICT_OUTPUT_CLAIMED: std::sync::atomic::AtomicBool =
@@ -1769,6 +1798,16 @@ pub(crate) fn is_supported_shell_tool(tool_name: Option<&str>) -> bool {
 }
 
 impl HookInput {
+    /// Whether the caller asked for an explicit allow line (see
+    /// [`Self::dcg_explicit_verdict`]). Only a JSON `true` counts.
+    #[must_use]
+    pub fn requests_explicit_verdict(&self) -> bool {
+        matches!(
+            self.dcg_explicit_verdict,
+            Some(serde_json::Value::Bool(true))
+        )
+    }
+
     /// Whether the payload declares a permission mode in which no human is
     /// guaranteed to answer a prompt (`bypassPermissions`, `dontAsk`).
     ///
```

**File**: `src/main.rs` (modified, +14/-0)
```diff
@@ -2083,9 +2083,16 @@ fn main() {
             destructive_command_guard::config::UnverifiedDecision::Deny;
     }
 
+    // dcg's OpenCode plugin asks for an explicit allow so that silence can
+    // mean "dcg died" there instead of "allowed".
+    let explicit_verdict = hook_input.requests_explicit_verdict();
+
     let Some(extracted_command) = hook::extract_command_with_context(&hook_input) else {
         // Not a shell tool call: dcg has no opinion, and that is the answer.
         set_hook_panic_policy(None);
+        if explicit_verdict {
+            let _ = hook::output_explicit_allow();
+        }
         return;
     };
     let hook::ExtractedHookCommand {
@@ -2309,6 +2316,13 @@ fn main() {
         EXIT_SUCCESS
     };
 
+    // The command proceeds (allowed, warned, or logged). A caller that asked
+    // for an explicit verdict gets one; when a document was already written
+    // (a deny or ask answered with exit 0) the stdout claim makes this a no-op.
+    if explicit_verdict && exit_code == EXIT_SUCCESS {
+        let _ = hook::output_explicit_allow();
+    }
+
     // A fail-closed exit goes through `process::exit`, which skips `Drop`:
     // flush the audit row first.
     drop(history_writer);
```

**File**: `tests/repro_419_opencode_plugin_executes.rs` (modified, +164/-1)
```diff
@@ -29,7 +29,7 @@ use std::process::Command;
 /// The driver is JavaScript because the thing under test is a JavaScript module:
 /// only a real loader proves it parses, and only a real call proves it denies.
 const DRIVER: &str = r#"
-const [pluginPath, dcgBin] = process.argv.slice(2);
+const [pluginPath, dcgBin, fakesDir] = process.argv.slice(2);
 process.env.DCG_BIN = dcgBin;
 
 const DESTRUCTIVE = "rm -rf /";
@@ -72,12 +72,48 @@ if (typeof v2 === "function") {
   check("v2 tolerates undefined event", (await threw(() => v2(undefined))) === null);
 }
 
+// dcg's escape hatch exits before reading its input, so it never answers; the
+// plugin honours it instead of reading the silence as a crash.
+process.env.DCG_BYPASS = "1";
+check("v2 honours DCG_BYPASS", (await threw(() => v2({ tool: "bash", input: { command: DESTRUCTIVE } }))) === null);
+delete process.env.DCG_BYPASS;
+
 // An unrunnable dcg is an infrastructure failure, not a verdict: fail OPEN, or a
 // broken install would block every command in the session.
 process.env.DCG_BIN = "/nonexistent/definitely-not-dcg";
 check("v2 fails open when dcg cannot run", (await threw(() => v2({ tool: "bash", input: { command: DESTRUCTIVE } }))) === null);
 check("v1 fails open when dcg cannot run", (await threw(() => v1({ tool: "bash" }, { args: { command: DESTRUCTIVE } }))) === null);
 
+// A dcg that RAN but gave no verdict is not an allow. Each fake below stands in
+// for a dcg that crashed, was killed, or lost its answer; a SAFE command must
+// still be blocked, because the plugin cannot know what dcg would have said.
+if (fakesDir) {
+  const noVerdictFakes = ["killed", "exit-nonzero", "exit-zero-silent", "exit-zero-garbage", "allow-then-killed"];
+  for (const fake of noVerdictFakes) {
+    process.env.DCG_BIN = `${fakesDir}/${fake}`;
+    const v1err = await threw(() => v1({ tool: "bash" }, { args: { command: SAFE } }));
+    const v2err = await threw(() => v2({ tool: "bash", input: { command: SAFE } }));
+    check(`v1 blocks when dcg gives no verdict (${fake})`, v1err !== null);
+    check(`v2 blocks when dcg gives no verdict (${fake})`, v2err !== null);
+    check(`the block says why (${fake})`, String(v2err?.message ?? "").includes("dcg gave no verdict"), String(v2err?.message));
+  }
+
+  // A deny written before the process died is still the answer, with its reason.
+  process.env.DCG_BIN = `${fakesDir}/deny-then-exit-nonzero`;
+  const denied = await threw(() => v2({ tool: "bash", input: { command: SAFE } }));
+  check("a deny survives a non-zero exit", String(denied?.message ?? "") === "fake deny reason", String(denied?.message));
+
+  // The operator can opt back into fail-open for crashes.
+  process.env.DCG_BRIDGE_CRASH_DECISION = " Allow ";
+  for (const fake of noVerdictFakes) {
+    process.env.DCG_BIN = `${fakesDir}/${fake}`;
+    check(`DCG_BRIDGE_CRASH_DECISION=allow lets a crash through (${fake})`, (await threw(() => v2({ tool: "bash", input: { command: SAFE } }))) === null);
+  }
+  process.env.DCG_BIN = `${fakesDir}/deny-then-exit-nonzero`;
+  check("the crash opt-out never overrides a deny", (await threw(() => v2({ tool: "bash", input: { command: SAFE } }))) !== null);
+  delete process.env.DCG_BRIDGE_CRASH_DECISION;
+}
+
 process.exit(failures === 0 ? 0 : 1);
 "#;
 
@@ -125,6 +161,131 @@ fn install_plugin(home: &Path) -> PathBuf {
     plugin
 }
 
+/// Stand-ins for a dcg that ran but gave the plugin no verdict, plus one that
+/// denied and then exited non-zero. Shell scripts, so Unix only; elsewhere the
+/// driver skips these cases.
+#[cfg(unix)]
+#[allow(clippy::unnecessary_wraps)] // the non-Unix twin returns `None`
+fn write_no_verdict_fakes(root: &Path) -> Option<PathBuf> {
+    use std::os::unix::fs::PermissionsExt as _;
+
+    const DENY: &str = r#"{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"fake deny reason"}}"#;
+    let dir = root.join("no-verdict-fakes");
+    std::fs::create_dir_all(&dir).expect("create the fakes directory");
+    for (name, body) in [
+        ("killed", "cat >/dev/null\nkill -9 $$\n".to_string()),
+        (
+            "exit-nonzero",
+            "cat >/dev/null\necho 'dcg: internal error' >&2\nexit 3\n".to_string(),
+        ),
+        ("exit-zero-silent", "cat >/dev/null\nexit 0\n".to_string()),
+        (
+            "exit-zero-garbage",
+            "cat >/dev/null\necho 'not a verdict'\n".to_string(),
+        ),
+        (
+            "allow-then-killed",
+            "cat >/dev/null\nprintf '%s\\n' '{\"dcg_verdict\":\"allow\"}'\nkill -9 $$\n"
+                .to_string(),
+        ),
+        (
+            "deny-then-exit-nonzero",
+            format!("cat >/dev/null\nprintf '%s\\n' '{DENY}'\nexit 2\n"),
+        ),
+    ] {
+        let path = dir.join(name);
+        std::fs::write(&path, format!("#!/bin/sh\n{body}")).expect("write a fake dcg");
+        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(
```

---

### Incident Patch 9: `42414a6c` (2026-10-01)
**Commit Message**: fix(confidence): score a match only where its span addresses the command; other spans keep the deny (review of 18be8e9)

18be8e9 stopped the [confidence] scorer from panicking on a span past the
end of the command, but a span that is in range and measured on another
string was still scored, against unrelated text. A probe over the
adversarial sets found 58 scored spans whose text did not match the
command being scored. Two causes:

- confidence scores the normalized command (quotes and wrappers such as
  `time` removed), while heredoc and some pack matches carry raw-command
  offsets: `cat <<EOF | "sh"` scored the bytes `sh\nr`, `time cat <<EOF |
  sh` scored ` -`;
- a match inside an unwrapped inner command carries the inner command's
  offsets.

All 58 happened to stay denied, but the downgrade was decided by whatever
text sat at those offsets.

The match preview was cut from the string the span was measured on, so
`span_addresses_command` checks a span against a command by cutting the
same offsets and comparing. When the span does not address the scored
command:

- it is moved onto it only when one form of the command ends with the
  other (normalizing stripped a leading wrapper

**File**: `CHANGELOG.md` (modified, +13/-0)
```diff
@@ -48,6 +48,19 @@ yet.
   `curl … | bash` install line) and panicked, so the command ran. A span that
   does not address the command now leaves the confidence high and the deny in
   place.
+- **`[confidence]` scored some matches against the wrong text.** A match
+  found on the raw command was scored at the same offsets of the normalized
+  command (quotes and wrappers such as `time` removed), and a match inside an
+  unwrapped inner command carried the inner command's offsets. Either way the
+  score described unrelated text and could downgrade a deny to a warning. A
+  span is now checked against the matched text first. One measured on the raw
+  command is moved onto the normalized command when normalizing only stripped
+  a leading wrapper (`time`, `sudo`), which leaves the text in the same
+  surroundings. Any other span keeps the deny: removed quotes change what the
+  surroundings look like, and the outer command presents an inner command as
+  the quoted argument it runs, which the scorer would read as data. The
+  hook's reported `confidence` is omitted when the span does not address the
+  command.
 
 - **A heredoc with an unquoted delimiter that only stores text was judged as
   commands.** `cat <<EOF > notes.md` documenting `watch '…'`, `sh -c '…'`,
```

**File**: `src/evaluator.rs` (modified, +278/-10)
```diff
@@ -27985,22 +27985,75 @@ fn configured_policy_mode(
     })
 }
 
+/// Whether `info`'s match span addresses the matched text in `command`.
+///
+/// A span is a pair of byte offsets into whatever string the rule matched,
+/// and that is not always the command being judged: a match inside an
+/// unwrapped inner command (`env -S '…'`, `watch '…'`, `bash -c '…'`), a
+/// heredoc body, or a `curl … | bash` payload carries the inner string's
+/// offsets, and a match on the raw command carries raw offsets while
+/// confidence scores the normalized form. The match preview was cut from the
+/// string the span was measured on, so the span addresses `command` exactly
+/// when the same offsets cut the same preview from it. Without a preview
+/// there is nothing to check against, and the answer is `false`.
+#[must_use]
+pub fn span_addresses_command(command: &str, info: &PatternMatch) -> bool {
+    let (Some(span), Some(preview)) = (
+        info.matched_span.as_ref(),
+        info.matched_text_preview.as_deref(),
+    ) else {
+        return false;
+    };
+    command.get(span.start..span.end).is_some() && extract_match_preview(command, span) == preview
+}
+
+/// `info`'s span, measured on `measured_on`, re-expressed in `target`'s
+/// coordinates: possible only when one string ends with the other, so that
+/// every byte of the shorter sits a fixed distance into the longer. The
+/// moved span must still cut the matched text from `target`.
+fn span_shifted_onto(target: &str, measured_on: &str, info: &PatternMatch) -> Option<MatchSpan> {
+    let span = info.matched_span?;
+    let moved = if target.len() >= measured_on.len() && target.ends_with(measured_on) {
+        let shift = target.len() - measured_on.len();
+        MatchSpan {
+            start: span.start + shift,
+            end: span.end + shift,
+        }
+    } else if measured_on.ends_with(target) {
+        let shift = measured_on.len() - target.len();
+        MatchSpan {
+            start: span.start.checked_sub(shift)?,
+            end: span.end.checked_sub(shift)?,
+        }
+    } else {
+        return None;
+    };
+    let mut moved_info = info.clone();
+    moved_info.matched_span = Some(moved);
+    span_addresses_command(target, &moved_info).then_some(moved)
+}
+
 fn apply_effective_confidence(
     config: &Config,
     command: &str,
     result: &EvaluationResult,
     mode: crate::packs::DecisionMode,
 ) -> ConfidenceResult {
-    let applies = result
+    let unchanged = ConfidenceResult {
+        mode,
+        score: None,
+        downgraded: false,
+    };
+    let Some(info) = result
         .pattern_info
         .as_ref()
-        .is_some_and(|info| matches!(info.source, MatchSource::Pack | MatchSource::HeredocAst));
-    if !applies {
-        return ConfidenceResult {
-            mode,
-            score: None,
-            downgraded: false,
-        };
+        .filter(|info| matches!(info.source, MatchSource::Pack | MatchSource::HeredocAst))
+    else {
+        return unchanged;
+    };
+    // Disabled scoring changes nothing; skip the sanitize/normalize passes.
+    if !config.confidence.enabled {
+        return unchanged;
     }
 
     let sanitized = sanitize_for_pattern_matching(command);
@@ -28014,18 +28067,49 @@ fn apply_effective_confidence(
             confidence_sanitized = Some(normalized_sanitized.as_ref());
         }
     }
+    // A downgrade reads the context around the span, so the span has to
+    // address the string being scored, and it may have been measured on the
+    // other form of the command (raw or normalized). It maps across only when
+    // one form ends with the other, as when normalizing strips a leading
+    // `time` or `sudo`: the same text then sits a fixed distance away, in the
+    // same surroundings. Any other difference moved text unevenly (removed
+    // quotes), so the old surroundings are gone, and a span from an unwrapped
+    // inner command (`env -S '…'`, `watch '…'`, a heredoc body) has no place
+    // in the outer command at all: its text appears there only inside the
+    // quoted argument that runs it, which the scorer reads as data. Such a
+    // match keeps the strict verdict.
+    let shifted;
+    let scored_result =
+        if info.matched_span.is_some() && !span_addresses_command(confidence_command, info) {
+            let other_form = if confidence_command == command {
+                normalized_command.as_ref()
+            } else {
+                command
+            };
+            let Some(span) = span_shifted_onto(confidence_command, other_form, info) else {
+                return unchanged;
+            };
+            let mut moved = result.clone();
+            if let Some(moved_info) = moved.pattern_info.as_mut() {
+                moved_info.matched_span = Some(span);
+            }
+            shifted = moved;
+            &shifted
+        } else {
+            result
+        };
     let scored = apply_confidence_s
```

**File**: `src/main.rs` (modified, +22/-14)
```diff
@@ -1653,20 +1653,28 @@ fn publish_decisive_response(
             };
             // The documented `confidence` field (#471): the scorer's view of
             // the matched span, the same score the `[confidence]` downgrade
-            // reads. Absent when the match has no span to score.
-            let confidence = info.matched_span.as_ref().map(|span| {
-                let sanitized =
-                    destructive_command_guard::context::sanitize_for_pattern_matching(&command);
-                let score = destructive_command_guard::confidence::compute_match_confidence(
-                    &destructive_command_guard::confidence::ConfidenceContext {
-                        command: &command,
-                        sanitized_command: Some(sanitized.as_ref()),
-                        match_start: span.start,
-                        match_end: span.end,
-                    },
-                );
-                (f64::from(score.value) * 100.0).round() / 100.0
-            });
+            // reads. Absent when the match has no span to score, or a span
+            // measured on another string (an unwrapped inner command), which
+            // would score unrelated text.
+            let addresses_command =
+                destructive_command_guard::evaluator::span_addresses_command(&command, info);
+            let confidence = info
+                .matched_span
+                .as_ref()
+                .filter(|_| addresses_command)
+                .map(|span| {
+                    let sanitized =
+                        destructive_command_guard::context::sanitize_for_pattern_matching(&command);
+                    let score = destructive_command_guard::confidence::compute_match_confidence(
+                        &destructive_command_guard::confidence::ConfidenceContext {
+                            command: &command,
+                            sanitized_command: Some(sanitized.as_ref()),
+                            match_start: span.start,
+                            match_end: span.end,
+                        },
+                    );
+                    (f64::from(score.value) * 100.0).round() / 100.0
+                });
             let delivery = if mode == DecisionMode::Ask {
                 hook::output_review_request_for_protocol(
                     ctx.hook_protocol,
```

---

### Incident Patch 10: `18be8e96` (2026-10-01)
**Commit Message**: fix(hook): fail closed when analysis is cut short under load, panics, or skips binary input

Under concurrent load (about 16 hook processes on a 10-core worker), 3-9%
of hook runs for commands that only the embedded-code extractor can judge
(a `watch` inline script, a heredoc run by `sed …/e` or piped to `nc`,
`find -de\lete`) exited 0 with nothing on stdout, which every host reads as
allow. Run one at a time they always denied.

Root cause: tier-2 heredoc/inline-script extraction has a 50 ms hot-path
budget. On a busy host it expired; with the default
`fallback_on_timeout = true`, evaluate_heredoc ran the bounded name-based
fallbacks, found nothing, and returned None ("no embedded code finding").
The caller's sanitizer then masked the unextracted script as quoted data,
quick-reject found no keyword, and the command was allowed.
`DCG_HEREDOC_TIMEOUT_MS=0` reproduces it deterministically.

Fixes:
- A hot-path extraction timeout now re-reads the command with the
  configured size caps and the structural budget, capped by the hook
  deadline. A complete re-read goes through the normal analysis, so the
  verdict follows the command. If even that times out, the result is
  indeterminate

**File**: `CHANGELOG.md` (modified, +36/-0)
```diff
@@ -18,6 +18,37 @@ yet.
 
 ### Fixed
 
+- **Under load, the hook allowed some destructive commands silently.** With
+  about sixteen hook processes running at once, 3-9% of requests for commands
+  that only the embedded-code extractor can judge (`watch 'git reset' --hard`,
+  a heredoc run by `sed …/e` or piped to `nc`) exited 0 with nothing on stdout,
+  which every host reads as "allow". The extractor's 50 ms budget ran out on
+  the busy machine, the bounded fallback found nothing, and the unextracted
+  script was then treated as quoted data. A timed-out extraction is now read
+  again with the time the hook has left, so the verdict depends on the
+  command and not on the load; if even that cannot finish, the answer is the
+  unverified-command response (ask, or deny under
+  `unverified_decision = "deny"`), never a silent allow. The 20 ms AST
+  matcher gets the same second reading when it times out or its worker
+  thread cannot start, and a body it still cannot read is unverified rather
+  than clean.
+- **Control characters could hide an embedded command.** A command whose
+  text looks binary (a NUL byte, or mostly control characters) skipped
+  embedded-code extraction, and the skip read as "nothing embedded":
+  `watch 'git reset' --hard` followed by a comment of control characters was
+  allowed. It is now denied under the incomplete-analysis rule, which can be
+  allowlisted after review.
+- **A panic in hook mode let the command through.** Release builds abort on
+  panic, and a crashed hook is a non-blocking error to every host. In hook
+  mode a panic now publishes the unverified-command response for the
+  request's protocol before exiting.
+- **`[confidence] enabled = true` crashed the hook on some wrapped commands.**
+  The confidence scorer sliced the command with a match span measured on the
+  unwrapped inner command (`env --split-string='rm -rf ./build'`, a
+  `curl … | bash` install line) and panicked, so the command ran. A span that
+  does not address the command now leaves the confidence high and the deny in
+  place.
+
 - **A heredoc with an unquoted delimiter that only stores text was judged as
   commands.** `cat <<EOF > notes.md` documenting `watch '…'`, `sh -c '…'`,
   `ssh host '…'` or `eval "$x"` was denied, while the same note behind
@@ -75,6 +106,11 @@ yet.
   Each inline-code flag rescanned its segment, so `c -c -c … sh -c '…'` took
   7-16 s at 60 KB; it is linear now (under 0.2 s).
 
+### Added
+
+- `DCG_LOG=<filter>` sends hook-mode tracing to stderr (for example
+  `DCG_LOG=debug`), to see which path a request took.
+
 ## [v0.15.1](https://github.com/Dicklesworthstone/destructive_command_guard/releases/tag/v0.15.1) -- 2026-09-29 [Release]
 
 Two fixes. One made the Oh My Pi bridge let a command through unjudged; the
```

**File**: `README.md` (modified, +1/-0)
```diff
@@ -706,6 +706,7 @@ Environment variables override config files (highest priority):
 - `DCG_PACKS="containers.docker,kubernetes"`: enable packs (comma-separated)
 - `DCG_DISABLE="kubernetes.helm"`: disable packs/sub-packs (comma-separated)
 - `DCG_VERBOSE=0-3`: verbosity level (0 = quiet, 3 = trace)
+- `DCG_LOG=<filter>`: hook-mode diagnostics; sends the evaluator's tracing events to stderr (`DCG_LOG=debug`, or a `tracing` filter such as `destructive_command_guard::heredoc=trace`). Unset by default.
 - `DCG_QUIET=1`: suppress non-error output
 - `DCG_COLOR=auto|always|never`: color mode
 - `DCG_NO_RICH=1`: disable rich terminal formatting and use plain rendering
```

**File**: `src/ast_matcher.rs` (modified, +39/-15)
```diff
@@ -46,17 +46,23 @@ impl DefaultPolicyMatcher {
         code: &str,
         language: ScriptLanguage,
     ) -> Result<Vec<PatternMatch>, MatchError> {
-        let protected = protected_matches(code, language);
-        let mut matches = engine::DEFAULT_MATCHER.find_matches(code, language)?;
-        match protected {
-            Ok(protected) => matches.extend(protected),
-            // A new classifier's limit must not suppress a deletion/exec
-            // denial the existing engine has already established.
-            Err(_) if matches.iter().any(|hit| hit.severity.blocks_by_default()) => {}
-            Err(error) => return Err(error),
-        }
-        matches.sort_by_key(|hit| hit.start);
-        Ok(matches)
+        let protected = protected_matches(code, language, protected_scan_budget());
+        let matches = engine::DEFAULT_MATCHER.find_matches(code, language);
+        compose_policy_matches(matches, protected)
+    }
+
+    /// [`Self::find_matches`] with one explicit time budget for both the
+    /// pattern corpus and the protected-write classifier: the second reading
+    /// the evaluator gives a body whose first one the host cut short.
+    pub fn find_matches_with_timeout(
+        &self,
+        code: &str,
+        language: ScriptLanguage,
+        timeout: Duration,
+    ) -> Result<Vec<PatternMatch>, MatchError> {
+        let protected = protected_matches(code, language, timeout);
+        let matches = engine::DEFAULT_MATCHER.find_matches_with_timeout(code, language, timeout);
+        compose_policy_matches(matches, protected)
     }
 
     /// Return the first blocking match from the composed default matcher.
@@ -69,6 +75,23 @@ impl DefaultPolicyMatcher {
     }
 }
 
+/// Merge the pattern corpus's matches with the protected-write classifier's.
+fn compose_policy_matches(
+    matches: Result<Vec<PatternMatch>, MatchError>,
+    protected: Result<Vec<PatternMatch>, MatchError>,
+) -> Result<Vec<PatternMatch>, MatchError> {
+    let mut matches = matches?;
+    match protected {
+        Ok(protected) => matches.extend(protected),
+        // A new classifier's limit must not suppress a deletion/exec
+        // denial the existing engine has already established.
+        Err(_) if matches.iter().any(|hit| hit.severity.blocks_by_default()) => {}
+        Err(error) => return Err(error),
+    }
+    matches.sort_by_key(|hit| hit.start);
+    Ok(matches)
+}
+
 /// Deletion backstop plus protected-write detection on extracted source.
 ///
 /// Retains the existing deletion backstop and adds protected writes on the SAME
@@ -79,7 +102,8 @@ impl DefaultPolicyMatcher {
 #[must_use]
 pub fn scan_filesystem_sink_fallback(code: &str, language: ScriptLanguage) -> Vec<PatternMatch> {
     let existing = engine::scan_filesystem_sink_fallback(code, language);
-    let mut matches = protected_matches(code, language).unwrap_or_default();
+    let mut matches =
+        protected_matches(code, language, protected_scan_budget()).unwrap_or_default();
     // Keep the established deletion precedence, but do not discard another
     // policy finding before the evaluator has applied per-rule allowlists.
     if let Some(existing) = existing {
@@ -107,6 +131,7 @@ fn protected_scan_budget() -> Duration {
 fn protected_matches(
     code: &str,
     language: ScriptLanguage,
+    budget: Duration,
 ) -> Result<Vec<PatternMatch>, MatchError> {
     if !credential_files::source_scan_required(code, language) {
         return Ok(Vec::new());
@@ -117,7 +142,6 @@ fn protected_matches(
             detail: "protected-write source exceeds the byte limit".into(),
         });
     }
-    let budget = protected_scan_budget();
     let started = Instant::now();
     // Do not parse another language AST unbounded on the hook thread. The
     // worker owns its input, has byte/node/depth caps, and never executes code.
@@ -129,7 +153,7 @@ fn protected_matches(
         .spawn(move || {
             let _ = sender.send(credential_files::scan_extracted(&source, language));
         })
-        .map_err(|error| MatchError::ParseError {
+        .map_err(|error| MatchError::Unavailable {
             language,
             detail: format!("could not start protected-write analysis: {error}"),
         })?;
@@ -145,7 +169,7 @@ fn protected_matches(
             });
         }
         Err(mpsc::RecvTimeoutError::Disconnected) => {
-            return Err(MatchError::ParseError {
+            return Err(MatchError::Unavailable {
                 language,
                 detail: "protected-write analysis did not complete".into(),
             });
```

**File**: `src/ast_pattern_engine.rs` (modified, +100/-6)
```diff
@@ -172,6 +172,25 @@ pub enum MatchError {
     Timeout { elapsed_ms: u64, budget_ms: u64 },
     /// Pattern compilation failed (should not happen with static patterns).
     PatternError { pattern: String, detail: String },
+    /// The matcher could not run at all: its worker thread could not be
+    /// started (thread or memory limits on a loaded host) or exited without
+    /// reporting. Like [`Self::Timeout`] this says nothing about the code, only
+    /// about the machine, so it is never evidence that the code is clean.
+    Unavailable {
+        language: ScriptLanguage,
+        detail: String,
+    },
+}
+
+impl MatchError {
+    /// Whether the failure is a property of the host (time, threads) rather
+    /// than of the code. A transient failure leaves the code unanalysed, so a
+    /// caller must retry it or treat the analysis as incomplete; it can never
+    /// stand for "no match".
+    #[must_use]
+    pub const fn is_transient(&self) -> bool {
+        matches!(self, Self::Timeout { .. } | Self::Unavailable { .. })
+    }
 }
 
 impl std::fmt::Display for MatchError {
@@ -195,6 +214,9 @@ impl std::fmt::Display for MatchError {
             Self::PatternError { pattern, detail } => {
                 write!(f, "pattern compilation error for '{pattern}': {detail}")
             }
+            Self::Unavailable { language, detail } => {
+                write!(f, "AST matching unavailable for {language:?}: {detail}")
+            }
         }
     }
 }
@@ -345,13 +367,31 @@ impl AstMatcher {
         &self,
         code: &str,
         language: ScriptLanguage,
+    ) -> Result<Vec<PatternMatch>, MatchError> {
+        self.find_matches_with_timeout(code, language, self.timeout)
+    }
+
+    /// [`Self::find_matches`] with an explicit time budget for this one call.
+    ///
+    /// The evaluator uses it to give a body whose hot-path match was cut short
+    /// by the host, not by the code, a second reading bounded by the hook
+    /// deadline instead of the 20 ms hot-path budget.
+    ///
+    /// # Errors
+    ///
+    /// The same as [`Self::find_matches`].
+    pub fn find_matches_with_timeout(
+        &self,
+        code: &str,
+        language: ScriptLanguage,
+        timeout: Duration,
     ) -> Result<Vec<PatternMatch>, MatchError> {
         let start_time = Instant::now();
-        let budget_ms = self.timeout.as_millis() as u64;
+        let budget_ms = u64::try_from(timeout.as_millis()).unwrap_or(u64::MAX);
 
         // Perl is not supported by ast-grep-language; use a conservative regex fallback.
         if language == ScriptLanguage::Perl {
-            return find_matches_perl(code, start_time, self.timeout, budget_ms);
+            return find_matches_perl(code, start_time, timeout, budget_ms);
         }
 
         // Check language support FIRST (before patterns, so we report unsupported properly)
@@ -365,7 +405,7 @@ impl AstMatcher {
             _ => return Ok(Vec::new()), // No patterns = no matches
         };
 
-        if self.timeout.is_zero() || code.len() > MAX_AST_INPUT_BYTES {
+        if timeout.is_zero() || code.len() > MAX_AST_INPUT_BYTES {
             return Err(timeout_error(start_time, budget_ms));
         }
 
@@ -374,7 +414,7 @@ impl AstMatcher {
             language,
             ast_lang,
             patterns.clone(),
-            self.timeout,
+            timeout,
             budget_ms,
         )
     }
@@ -1325,7 +1365,7 @@ fn run_ast_match_with_timeout(
             );
             let _ = tx.send(result);
         })
-        .map_err(|err| MatchError::ParseError {
+        .map_err(|err| MatchError::Unavailable {
             language,
             detail: format!("failed to start AST parser worker: {err}"),
         })?;
@@ -1338,7 +1378,7 @@ fn run_ast_match_with_timeout(
         }
         Err(mpsc::RecvTimeoutError::Disconnected) => {
             cancel.store(true, Ordering::Relaxed);
-            Err(MatchError::ParseError {
+            Err(MatchError::Unavailable {
                 language,
                 detail: "AST parser worker exited without a result".to_string(),
             })
@@ -4403,6 +4443,60 @@ mod tests {
     use super::*;
     use std::collections::HashMap;
 
+    /// A per-call budget overrides the matcher's own, in both directions: an
+    /// exhausted one reports a transient failure (never an empty match list),
+    /// and a generous one reads the body the hot-path budget could not.
+    #[test]
+    fn per_call_timeout_overrides_the_matcher_budget() {
+        let code = "import shutil\nshutil.rmtree('/home/example/project')\n";
+        let starved = AstMatcher::new().with_timeout(Duration::ZERO);
+        let err = starved
+            .find_matches(code, ScriptLanguage::Python)
+            .expect_err("a zero budget cannot report a clean body");
+        assert!(err.is_transient(), "{err:?}");
+
+        let matches = starved
+            .find_matches_with_timeout(code, ScriptLanguage::Pytho
```

**File**: `src/confidence.rs` (modified, +33/-0)
```diff
@@ -186,6 +186,16 @@ pub struct ConfidenceContext<'a> {
 pub fn compute_match_confidence(ctx: &ConfidenceContext<'_>) -> ConfidenceScore {
     let mut score = ConfidenceScore::high();
 
+    // A span that does not address this command (past its end, or off a
+    // character boundary) was measured on another string, typically the
+    // unwrapped inner command of `env -S '…'` or a `curl … | bash` payload.
+    // Slicing with it panicked, and in hook mode a panic is a crash the host
+    // lets through. It says nothing about this command, so it cannot lower
+    // the confidence of the match: the score stays high and the deny stands.
+    if ctx.command.get(ctx.match_start..ctx.match_end).is_none() {
+        return score;
+    }
+
     // Signal 1: Check if match is in a sanitized region
     if let Some(sanitized) = ctx.sanitized_command {
         if ctx.match_start < sanitized.len()
@@ -389,6 +399,29 @@ pub fn should_downgrade_to_warn(ctx: &ConfidenceContext<'_>) -> (ConfidenceScore
 mod tests {
     use super::*;
 
+    /// The confidence scorer used to slice the command with a span measured
+    /// on a different string and panic: `env --split-string='rm -rf ./build'`
+    /// under `[confidence] enabled = true` aborted the hook, which the host
+    /// treats as a pass. Such a span cannot lower confidence.
+    #[test]
+    fn a_span_outside_the_command_keeps_high_confidence_without_panicking() {
+        for (command, start, end) in [
+            ("rm -rf ./build", 9, 23),
+            ("rm -rf ./build", 23, 30),
+            ("rm -rf ./build", 5, 2),
+            // Byte 1 is inside the two-byte `é`.
+            ("é rm -rf ./build", 1, 5),
+        ] {
+            let score = compute_match_confidence(&ConfidenceContext {
+                command,
+                sanitized_command: Some(command),
+                match_start: start,
+                match_end: end,
+            });
+            assert!(!score.is_low(0.99), "{command:?} {start}..{end}: {score:?}");
+        }
+    }
+
     fn score_at(command: &str, needle: &str) -> f32 {
         let start = command.find(needle).expect("needle in command");
         compute_match_confidence(&ConfidenceContext {
```

**File**: `src/evaluator.rs` (modified, +591/-111)
```diff
@@ -26548,6 +26548,115 @@ fn record_nested_allowlist_hit(
     }
 }
 
+/// Whether an extraction stopped because it ran out of wall-clock time.
+fn extraction_timed_out(result: &ExtractionResult) -> bool {
+    match result {
+        ExtractionResult::Skipped(reasons)
+        | ExtractionResult::Partial {
+            skipped: reasons, ..
+        } => reasons
+            .iter()
+            .any(|reason| matches!(reason, SkipReason::Timeout { .. })),
+        ExtractionResult::NoContent
+        | ExtractionResult::Extracted(_)
+        | ExtractionResult::Failed(_) => false,
+    }
+}
+
+/// The configured extraction limits with only the clock relaxed: at least the
+/// structural budget (#443), but never past the hook's remaining deadline.
+///
+/// `None` when the hook deadline is already spent, so there is no time left
+/// to read the command at all.
+fn extraction_limits_past_hot_path_budget(
+    configured: &crate::heredoc::ExtractionLimits,
+    deadline: Option<&Deadline>,
+) -> Option<crate::heredoc::ExtractionLimits> {
+    let mut limits = *configured;
+    limits.timeout_ms = limits
+        .timeout_ms
+        .max(crate::heredoc::ExtractionLimits::structural_scan().timeout_ms);
+    if let Some(deadline) = deadline {
+        let remaining = deadline.remaining()?;
+        let remaining_ms = u64::try_from(remaining.as_millis()).unwrap_or(u64::MAX);
+        limits.timeout_ms = limits.timeout_ms.min(remaining_ms);
+    }
+    Some(limits)
+}
+
+/// Tier-2 extraction for [`evaluate_heredoc`], where a hot-path timeout can no
+/// longer decide the verdict.
+///
+/// The hot-path budget is 50 ms. On a loaded host — sixteen hook processes on
+/// ten cores was enough — extraction ran past it, and the fallback branch ran
+/// the bounded name-based scanners and then returned `None`, "no embedded
+/// code finding". That `None` is an allow for any command whose dangerous part
+/// only the extractor can see: once the inline script of `watch 'git reset'
+/// --hard`, or the heredoc a `sed …/e` executes, is not extracted, the
+/// sanitizer masks it as quoted data, quick-reject finds no keyword, and the
+/// hook exits 0 with nothing on stdout. The same command denied every time on
+/// an idle machine.
+///
+/// So a timeout under `fallback_on_timeout = true` (the default) now means
+/// "read it again with time to finish": the bounded fallbacks still run first
+/// for a fully skipped extraction (they are cheap and keep their rule ids),
+/// then the command is re-extracted with the configured size caps and a clock
+/// relaxed to the structural budget, capped by the hook deadline. A complete
+/// re-read goes through the normal analysis, so the verdict follows the
+/// command. If even that runs out of time, the analysis is incomplete and the
+/// answer is indeterminate (ask, or deny under `unverified_decision = deny`),
+/// never a silent allow. `fallback_on_timeout = false` keeps its strict
+/// immediate block, which the caller applies to the hot-path result.
+///
+/// `Err` carries a verdict decided here; `Ok` is the extraction to analyse.
+fn extract_heredoc_contents(
+    command: &str,
+    context: HeredocEvaluationContext<'_>,
+    first_allowlist_hit: &mut Option<(PatternMatch, AllowlistLayer, String)>,
+) -> Result<ExtractionResult, Box<EvaluationResult>> {
+    let hot = extract_content(command, &context.heredoc_settings.limits);
+    if !extraction_timed_out(&hot) || !context.heredoc_settings.fallback_on_timeout {
+        return Ok(hot);
+    }
+    tracing::debug!(
+        budget_ms = context.heredoc_settings.limits.timeout_ms,
+        "heredoc extraction exceeded its hot-path budget; re-extracting"
+    );
+
+    let run_fallbacks =
+        |first_allowlist_hit: &mut Option<(PatternMatch, AllowlistLayer, String)>| {
+            check_fallback_patterns(command, context, first_allowlist_hit)
+                .or_else(|| check_credential_write_fallback(command, context, first_allowlist_hit))
+                .or_else(|| check_exec_sink_fallback(command, context, first_allowlist_hit))
+        };
+
+    let fully_skipped = matches!(hot, ExtractionResult::Skipped(_));
+    if fully_skipped {
+        if let Some(blocked) = run_fallbacks(first_allowlist_hit) {
+            return Err(Box::new(blocked));
+        }
+    }
+
+    let retried =
+        extraction_limits_past_hot_path_budget(&context.heredoc_settings.limits, context.deadline)
+            .map(|limits| extract_content(command, &limits));
+    match retried {
+        Some(retried) if !extraction_timed_out(&retried) => Ok(retried),
+        _ => {
+            tracing::warn!(
+                "heredoc extraction did not complete within the hook deadline; \
+                 the command is unverified"
+            );
+            if !fully_skipped {
+                if let Some(blocked) = run_fallbacks(first_allowlist_hit) {
+                    return Err(Box::new(blocked));
+                }
+            }
+    
```

**File**: `src/hook.rs` (modified, +45/-0)
```diff
@@ -779,12 +779,34 @@ impl HookProtocol {
 /// [`HookProtocol::undeliverable_block_exit_code`] for blocking verdicts and
 /// ignores it for warnings, whose command was going to proceed anyway.
 fn deliver_verdict(payload: &[u8]) -> io::Result<()> {
+    if !claim_verdict_output() {
+        // The panic backstop already owns stdout and is about to exit with
+        // its own fail-closed verdict; a second document would corrupt it.
+        return Ok(());
+    }
     let stdout = io::stdout();
     let mut handle = stdout.lock();
     handle.write_all(payload)?;
     handle.flush()
 }
 
+/// Set once something has begun writing this process's single verdict
+/// document to stdout.
+static VERDICT_OUTPUT_CLAIMED: std::sync::atomic::AtomicBool =
+    std::sync::atomic::AtomicBool::new(false);
+
+/// Claim the right to write this process's verdict document to stdout.
+///
+/// Hook protocols read one JSON document. The normal publication path and the
+/// hook binary's panic backstop both claim before writing, and only the first
+/// claim succeeds, so a panic can never append a second document to (or
+/// interleave with) a verdict already on its way out. Returns `true` exactly
+/// once per process.
+#[must_use]
+pub fn claim_verdict_output() -> bool {
+    !VERDICT_OUTPUT_CLAIMED.swap(true, std::sync::atomic::Ordering::SeqCst)
+}
+
 /// A shell command extracted from a hook request together with its execution
 /// context.
 ///
@@ -3762,6 +3784,29 @@ pub fn write_indeterminate_to(
     let _ = stderr.flush();
 }
 
+/// Emit the indeterminate response from the hook binary's panic backstop.
+///
+/// Same document as [`output_indeterminate_for_protocol`], but it takes the
+/// stdout claim itself: `None` means a verdict was already being written when
+/// the panic struck, so nothing is written and the caller must fall back to
+/// the protocol's blocking exit status.
+#[cold]
+#[inline(never)]
+pub fn output_indeterminate_from_panic(
+    protocol: HookProtocol,
+    reason: &str,
+    deny: bool,
+) -> Option<io::Result<()>> {
+    if !claim_verdict_output() {
+        return None;
+    }
+    let mut verdict = Vec::new();
+    write_indeterminate_to(&mut verdict, &mut io::stderr(), protocol, reason, deny);
+    let stdout = io::stdout();
+    let mut handle = stdout.lock();
+    Some(handle.write_all(&verdict).and_then(|()| handle.flush()))
+}
+
 /// Emit a safety-evaluation indeterminate response on process stdout/stderr.
 #[cold]
 #[inline(never)]
```

**File**: `src/main.rs` (modified, +128/-0)
```diff
@@ -819,9 +819,109 @@ fn install_broken_pipe_backstop() {
             std::process::exit(EXIT_BROKEN_PIPE);
         }
         default_hook(info);
+        fail_closed_on_hook_panic();
     }));
 }
 
+/// How hook mode answers if the process panics before it has published a
+/// verdict. Armed by the hook path once it knows the protocol, and cleared once
+/// the command is known to be allowed.
+#[derive(Clone, Copy)]
+struct HookPanicPolicy {
+    protocol: hook::HookProtocol,
+    deny_unverified: bool,
+}
+
+static HOOK_PANIC_POLICY: std::sync::Mutex<Option<HookPanicPolicy>> = std::sync::Mutex::new(None);
+
+fn set_hook_panic_policy(policy: Option<HookPanicPolicy>) {
+    let mut guard = match HOOK_PANIC_POLICY.lock() {
+        Ok(guard) => guard,
+        Err(poisoned) => poisoned.into_inner(),
+    };
+    *guard = policy;
+}
+
+const HOOK_PANIC_REASON: &str = "DCG hit an internal error while evaluating this command, \
+     so the command was not verified. Review it manually; the error is on stderr.";
+
+/// Turn a panic in hook mode into a blocking verdict instead of a crash.
+///
+/// The release profile aborts on panic, and a hook killed by `SIGABRT` (or,
+/// in an unwinding build, one that exits 101) is a non-blocking hook error to
+/// every supported host: the tool call proceeds. A panic anywhere in the
+/// evaluation (the main thread, or an analysis worker thread, which under
+/// `panic = "abort"` takes the whole process with it) was therefore an allow.
+///
+/// Armed, this publishes the indeterminate verdict for the request's protocol
+/// (ask, or deny under `unverified_decision = deny`) and exits with the status
+/// that verdict needs. If a verdict was already being written when the panic
+/// struck, the document on stdout may be incomplete, so the protocol's blocking
+/// exit status carries the decision instead.
+fn fail_closed_on_hook_panic() {
+    let policy = match HOOK_PANIC_POLICY.try_lock() {
+        Ok(guard) => *guard,
+        Err(std::sync::TryLockError::Poisoned(poisoned)) => *poisoned.into_inner(),
+        // Only `set_hook_panic_policy` takes this lock, and it holds it for an
+        // assignment, so contention means a panic inside that assignment.
+        Err(std::sync::TryLockError::WouldBlock) => None,
+    };
+    let Some(policy) = policy else {
+        return;
+    };
+    let exit_code = match hook::output_indeterminate_from_panic(
+        policy.protocol,
+        HOOK_PANIC_REASON,
+        policy.deny_unverified,
+    ) {
+        Some(delivery) => blocking_verdict_exit_code(policy.protocol, delivery),
+        None => policy.protocol.undeliverable_block_exit_code(),
+    };
+    std::process::exit(exit_code);
+}
+
+/// Fault injection for the panic backstop's end-to-end tests.
+///
+/// Debug builds only (the integration tests run the debug binary); release
+/// builds compile this to nothing. `DCG_TEST_HOOK_PANIC=main` panics on the
+/// hook thread, `=worker` on a spawned analysis-style thread, both at the
+/// point a command is about to be evaluated.
+#[cfg(debug_assertions)]
+fn inject_test_hook_panic() {
+    match std::env::var("DCG_TEST_HOOK_PANIC").as_deref() {
+        Ok("main") => panic!("injected hook panic (DCG_TEST_HOOK_PANIC=main)"),
+        Ok("worker") => {
+            let _ = std::thread::spawn(|| {
+                panic!("injected hook panic (DCG_TEST_HOOK_PANIC=worker)");
+            })
+            .join();
+        }
+        _ => {}
+    }
+}
+
+#[cfg(not(debug_assertions))]
+const fn inject_test_hook_panic() {}
+
+/// Opt-in diagnostics for hook mode: `DCG_LOG=<filter>` (for example
+/// `DCG_LOG=debug`, or `DCG_LOG=destructive_command_guard::heredoc=trace`)
+/// sends the evaluator's tracing events to stderr. Unset, nothing is installed
+/// and the hot path pays nothing.
+fn init_hook_tracing() {
+    let Some(filter) = std::env::var_os("DCG_LOG") else {
+        return;
+    };
+    let Ok(filter) = tracing_subscriber::EnvFilter::try_new(filter.to_string_lossy().trim()) else {
+        emit_stderr!("[dcg] Warning: ignoring DCG_LOG: not a valid tracing filter");
+        return;
+    };
+    let _ = tracing_subscriber::fmt()
+        .with_env_filter(filter)
+        .with_writer(io::stderr)
+        .with_ansi(false)
+        .try_init();
+}
+
 fn install_history_shutdown_handler(
     handle: destructive_command_guard::history::HistoryFlushHandle,
 ) {
@@ -1847,10 +1947,18 @@ fn main() {
         return;
     }
 
+    init_hook_tracing();
+
     // Load configuration
     let config = Config::load();
     destructive_command_guard::output::install_theme_config(&config);
     let detected_agent = detect_agent();
+    // Armed with the detected agent's protocol until the payload names its own
+    // (below); a panic before then still fails closed.
+    set_hook_panic_policy(Some(HookPanicPolicy {
+        protocol: payloadless_hook_protocol(&detected_agent, None),
+        deny_unverified: config.unverified_denies(),

```

---

### Incident Patch 11: `929cce8f` (2026-10-01)
**Commit Message**: fix(heredoc): walk the parse tree without recursion; a deep list before a heredoc aborted the hook (review of 6976885)

Dialect refinement masks heredocs on every hook payload before the size
gate applies, and collect_active_heredocs and
find_visible_shell_name_override recursed once per parse-tree level. A
`&&`/`||` list, brace group or subshell nests one level per element, so a
command of about 13,500 list elements before a heredoc (108 KB) overflowed
the stack and aborted the hook with SIGABRT; a 60 KB brace nest did the
same inside the evaluated size. The agent treats an aborted hook as a
non-blocking error and runs the command. v0.15.1 failed the same way from
about 240 KB; the larger frames since 6158ee7 brought it within reach.

Both walks now use an explicit stack (same pre-order, same early exits).
Every deeply nested shape probed from 16 KB to 250 KB now gets a verdict
where v0.15.1 or 3ab9886 aborted.

Test: a_deeply_nested_list_before_a_heredoc_still_gets_a_verdict (through
the Claude hook; aborts without this change).

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -37,6 +37,13 @@ yet.
   written to a file the same command then runs (`tee x.sh <<EOF … EOF; sh
   x.sh`), which was allowed with either delimiter.
 
+- **The hook aborted on a deeply nested command.** A list of about 13,500
+  `true &&` (or deeply nested braces) before a heredoc overflowed the stack
+  while the command's dialect was being checked, before the size limit
+  applied; an aborted hook is a non-blocking error to the agent, which then
+  ran the command. v0.15.1 failed the same way on larger inputs. The heredoc
+  walks no longer recurse.
+
 - **A heredoc whose output reaches a program that runs it was judged as
   data.** `cat <<'EOF' | ssh host`, `| docker exec -i c sh`, `| sudo sh`,
   `| at now`, `| su`, `| $SHELL`, `2>&1 | sh`, `(cat <<'EOF') | sh`,
```

**File**: `src/heredoc.rs` (modified, +67/-25)
```diff
@@ -6697,30 +6697,51 @@ fn is_trusted_os_data_sink_path(lexical_target: &str, basename: &str) -> bool {
 
 #[allow(clippy::needless_pass_by_value)]
 fn find_visible_shell_name_override<D: ast_grep_core::Doc>(
-    node: ast_grep_core::Node<'_, D>,
+    root: ast_grep_core::Node<'_, D>,
     target: &str,
     overridden: &mut bool,
     parse_error: &mut bool,
 ) {
-    if *overridden || *parse_error {
-        return;
+    // An explicit stack, not recursion (see [`collect_active_heredocs`]):
+    // a list nests one level per `&&`, and this walks the whole command.
+    let mut pending = vec![root];
+    while let Some(node) = pending.pop() {
+        if *overridden || *parse_error {
+            return;
+        }
+        if shell_name_override_node(&node, target, overridden, parse_error) {
+            // Children reversed onto the stack, so they pop in order.
+            let first_child = pending.len();
+            pending.extend(node.children());
+            pending[first_child..].reverse();
+        }
     }
+}
+
+/// [`find_visible_shell_name_override`] for one node: set the flags it
+/// proves, and answer whether to descend into its children.
+fn shell_name_override_node<D: ast_grep_core::Doc>(
+    node: &ast_grep_core::Node<'_, D>,
+    target: &str,
+    overridden: &mut bool,
+    parse_error: &mut bool,
+) -> bool {
     match node.kind().as_ref() {
         "ERROR" => {
             *parse_error = true;
-            return;
+            return false;
         }
         "function_definition" => {
             let Some(name) = node.field("name") else {
                 // A function definition whose binding cannot be resolved is
                 // exactly the case where proving a later bare sink is unsafe.
                 *overridden = true;
-                return;
+                return false;
             };
             let name = name.text();
             if name.as_ref() == target || !is_static_shell_name(name.as_ref()) {
                 *overridden = true;
-                return;
+                return false;
             }
             // Keep descending into a differently named function body. A later
             // invocation can make an `eval`/`source` inside it mutate the
@@ -6731,7 +6752,7 @@ fn find_visible_shell_name_override<D: ast_grep_core::Doc>(
             let text = node.text();
             if shell_assignment_name(text.as_ref()) == Some("PATH") {
                 *overridden = true;
-                return;
+                return false;
             }
         }
         "command" => {
@@ -6740,28 +6761,26 @@ fn find_visible_shell_name_override<D: ast_grep_core::Doc>(
                 Ok(tokens) => {
                     if shell_command_may_override_name(&tokens, target) {
                         *overridden = true;
-                        return;
+                        return false;
                     }
                     // The complete simple command was resolved above. Its
                     // assignment children are temporary environment state
                     // unless the command itself is a modeled mutator; do not
                     // reclassify `PATH=/tmp printf ...` as persistent state.
-                    return;
+                    return false;
                 }
                 Err(_) => {
                     // AST-valid shell that the secondary word splitter cannot
                     // resolve must never establish a data-only proof.
                     *parse_error = true;
                     *overridden = true;
-                    return;
+                    return false;
                 }
             }
         }
         _ => {}
     }
-    for child in node.children() {
-        find_visible_shell_name_override(child, target, overridden, parse_error);
-    }
+    true
 }
 
 #[must_use]
@@ -8243,15 +8262,40 @@ fn active_single_heredoc_fallback(command: &str) -> Option<Vec<ActiveHeredoc>> {
 
 #[allow(clippy::needless_pass_by_value)]
 fn collect_active_heredocs<D: ast_grep_core::Doc>(
-    node: ast_grep_core::Node<'_, D>,
+    root: ast_grep_core::Node<'_, D>,
     heredocs: &mut Vec<ActiveHeredoc>,
     parse_error: &mut bool,
     plumbed: bool,
 ) {
+    // An explicit stack, not recursion: this runs on every hook payload
+    // before the size gate (dialect refinement masks the command first), and
+    // a list of some ten thousand `true &&` nests that deep in the parse
+    // tree. Recursing overflowed the stack and aborted the hook, which the
+    // agent treats as a non-blocking error and runs the command.
+    let mut pending = vec![root];
+    while let Some(node) = pending.pop() {
+        if collect_active_heredoc_node(&node, heredocs, parse_error, plumbed) {
+            // Children reversed onto the stack, so they pop in order.
+            let first_child = pending.len();
+            pending.extend(node.children());
+            pending[first_child..].reverse();
+        }
+    }
+}
+
+///
```

**File**: `tests/repro_498_warn_masks_later_deny.rs` (modified, +32/-0)
```diff
@@ -864,6 +864,38 @@ fn unquoted_bodies_whose_owner_uses_them_stay_whole() {
     }
 }
 
+/// Review of 6976885: dialect refinement masks heredocs before the size
+/// gate, and the heredoc collector recursed once per level of the parse
+/// tree. A list of 13,500 `true &&` before a heredoc (108 KB) overflowed the
+/// stack and aborted the hook; v0.15.1 lasted to about 240 KB. An aborted
+/// hook is a non-blocking error to the agent, which then runs the command.
+#[test]
+fn a_deeply_nested_list_before_a_heredoc_still_gets_a_verdict() {
+    let lab = Lab::new(DEFAULTS);
+    for (prefix, repeat) in [
+        ("true && ", 15_000),
+        ("true && ", 30_000),
+        ("x || ", 40_000),
+    ] {
+        let command = format!(
+            "{}cat <<EOF | sh\nwatch 'git reset --hard'\nEOF",
+            prefix.repeat(repeat)
+        );
+        let payload = serde_json::json!({
+            "hook_event_name": "PreToolUse",
+            "tool_name": "Bash",
+            "tool_input": { "command": command },
+            "cwd": lab.dir.path(),
+        });
+        let (stdout, stderr) = lab.run_with_stdin(&[], &format!("{payload}\n"));
+        assert!(
+            stdout.contains("\"ask\"") || stdout.contains("\"deny\""),
+            "{prefix:?} x {repeat}: no verdict\nstdout: {stdout}\nstderr: {}",
+            stderr.chars().take(400).collect::<String>()
+        );
+    }
+}
+
 /// Eighth review (A14): spellings that still hid a command from the rules
 /// (all allowed on v0.14.4 and v0.15.1).
 #[test]
```

---

### Incident Patch 12: `7c9a0329` (2026-10-01)
**Commit Message**: fix(heredoc): an unquoted body is contained only when its owner passes it through (review of 6976885)

6976885 decided whether an unquoted data-sink body may be masked from where
the owning command's standard output goes, but never asked what the owner
itself does with the body. Every NON_EXECUTING_HEREDOC_COMMANDS target was
treated as a pure pass-through, and the read-only pipe stages were trusted
whatever their operands. Thirteen shapes in five classes that v0.15.1
denied were masked as terminal text and allowed:

- owners that keep the body for later execution (`read` into a variable)
- owners that run it themselves (sed's execute commands, awk's system()
  and command pipes)
- owners or stages that hand it to another program (sort's compress
  program, rg's preprocessor) or to a network peer (nc, curl)
- tee, sort -o, uniq and xxd writing it to a device or descriptor path
  that a later redirect points into a pipe to a shell
- an assignment that swaps the program (PATH=, LD_PRELOAD=, a ripgrep
  config path)

The parse tree now proves containment only when the owner is a read-only
text tool whose operands keep the text inert (owner_passes_body_through,
read_only_stage_is_inert

**File**: `CHANGELOG.md` (modified, +9/-5)
```diff
@@ -21,11 +21,15 @@ yet.
 - **A heredoc with an unquoted delimiter that only stores text was judged as
   commands.** `cat <<EOF > notes.md` documenting `watch '…'`, `sh -c '…'`,
   `ssh host '…'` or `eval "$x"` was denied, while the same note behind
-  `<<'EOF'` was allowed. When the data sink's output provably stays put —
-  shown on the terminal, written to a plain file, or piped only through
-  read-only text tools (`wc`, `grep`, `sort`, `tee`, …) — only the parts the
-  shell runs while reading such a body are judged now: `$(…)`, backquotes and
-  arithmetic. Every other unquoted body is judged whole, as in v0.15.1: one
+  `<<'EOF'` was allowed. When the command reading such a body only passes it
+  on as text (`cat`, `grep`, `sort`, `tee` to plain files, …) and its output
+  provably stays put — shown on the terminal, written to a plain file, or
+  piped only through read-only text tools (`wc`, `grep`, `sort`, `tee`, …) —
+  only the parts the shell runs while reading the body are judged now:
+  `$(…)`, backquotes and arithmetic. A body read by a command that uses it
+  (`read c` then `$c`, sed's `e`, awk's `system()`, `nc`, `curl`,
+  `sort --compress-program`, `rg --pre`, `tee /dev/stderr` behind
+  `2>&1 >/dev/null | sh`) is judged whole. Every other unquoted body is judged whole, as in v0.15.1: one
   whose output goes anywhere dcg cannot follow (`>&2`, `> "$f"`, a command
   substitution, an unrecognized pipeline stage, a parse it is unsure of), and
   one whose substitutions cannot be bounded. A body is also judged when it is
```

**File**: `src/heredoc.rs` (modified, +226/-10)
```diff
@@ -8746,20 +8746,133 @@ fn stdout_redirect_parts<'r, D: ast_grep_core::Doc + 'r>(
         }
         _ => return StdoutRedirect::Elsewhere,
     };
-    let plain = !path.is_empty()
-        && !path.contains(['$', '`', '\\', '*', '?', '[', '{', '~'])
-        && !path.starts_with(['-', '&'])
-        && !path.bytes().all(|byte| byte.is_ascii_digit())
-        // A device or descriptor path (`/dev/stdout`, `/dev/fd/1`,
-        // `/proc/self/fd/1`, or one reached through `..`) is not a file.
-        && (path == "/dev/null" || !(path.contains("dev/") || path.contains("proc/")));
-    if plain {
+    if is_plain_file_path(path) {
         StdoutRedirect::File
     } else {
         StdoutRedirect::Elsewhere
     }
 }
 
+/// A literal path naming a plain file (or `/dev/null`): nothing the shell
+/// computes, no descriptor number, and no device or descriptor path
+/// (`/dev/stdout`, `/dev/fd/1`, `/proc/self/fd/1`, or one reached through
+/// `..`).
+fn is_plain_file_path(path: &str) -> bool {
+    !path.is_empty()
+        && !path.contains(['$', '`', '\\', '*', '?', '[', '{', '~'])
+        && !path.starts_with(['-', '&'])
+        && !path.bytes().all(|byte| byte.is_ascii_digit())
+        && (path == "/dev/null" || !(path.contains("dev/") || path.contains("proc/")))
+}
+
+/// Whether leading assignments leave the named program the one it names:
+/// `PATH=…`, `LD_PRELOAD=…` and their kin load other code, and
+/// `RIPGREP_CONFIG_PATH=…` or `GREP_OPTIONS=…` add options.
+fn assignments_keep_program(assignments: &[String]) -> bool {
+    assignments.iter().all(|assignment| {
+        shell_assignment_name(assignment).is_some_and(|var| {
+            !(var.starts_with("LD_")
+                || var.starts_with("DYLD_")
+                || matches!(
+                    var,
+                    "PATH"
+                        | "RIPGREP_CONFIG_PATH"
+                        | "GREP_OPTIONS"
+                        | "GCONV_PATH"
+                        | "BASH_ENV"
+                        | "ENV"
+                ))
+        })
+    })
+}
+
+/// Whether a [`READ_ONLY_PIPE_STAGES`] program run with these operands and
+/// leading assignments really only passes its input on as text, to standard
+/// output or to plain files. `sort --compress-program=sh` and `rg --pre sh`
+/// hand it to a program; `tee /dev/stderr`, `sort -o /dev/fd/3`, `uniq -
+/// /dev/stderr` and `xxd - /dev/stderr` write it to a descriptor that a
+/// redirect can point anywhere (`2>&1 >/dev/null | sh`); an assignment such
+/// as `RIPGREP_CONFIG_PATH=…` or `LD_PRELOAD=…` changes what the program does
+/// ([`assignments_keep_program`]).
+fn read_only_stage_is_inert(name: &str, operands: &[String], assignments: &[String]) -> bool {
+    if !READ_ONLY_PIPE_STAGES.contains(&name) {
+        return false;
+    }
+    if !assignments_keep_program(assignments) {
+        return false;
+    }
+    // Only these write their input anywhere but standard output: `tee` to
+    // every file operand, `sort` to its `-o` value, `uniq` and `xxd` to the
+    // file operand after their input. `rg` hands a file it searches to a
+    // `--pre` program (perhaps one named in its config file).
+    let mut options_ended = false;
+    let mut output_value_next = false;
+    let mut files = 0usize;
+    for operand in operands {
+        let word = unquoted_word(operand);
+        // A computed word may be any option or path; single quotes keep a
+        // `$` literal.
+        let single_quoted = operand.len() >= 2
+            && operand.starts_with('\'')
+            && operand.ends_with('\'')
+            && operand.matches('\'').count() == 2;
+        if is_computed_word(operand) && !single_quoted {
+            if matches!(name, "tee" | "sort" | "uniq" | "xxd" | "rg") {
+                return false;
+            }
+            continue;
+        }
+        if std::mem::take(&mut output_value_next) {
+            if !is_plain_file_path(word) {
+                return false;
+            }
+            continue;
+        }
+        if !options_ended && word == "--" {
+            options_ended = true;
+            continue;
+        }
+        if !options_ended && word.len() > 1 && word.starts_with('-') {
+            match name {
+                // GNU getopt takes any unambiguous prefix of a long option:
+                // `--co` is `--compress-program`, `--o` is `--output`.
+                "sort" if word.starts_with("--co") => return false,
+                "sort" if word.starts_with("--o") => match word.split_once('=') {
+                    Some((_, path)) if !is_plain_file_path(path) => return false,
+                    Some(_) => {}
+                    None => output_value_next = true,
+                },
+                // A short-option cluster holding `o`: the rest of the word,
+                // or the next one, is the output file.
+                "sort" if !word.starts_with("--") && word.contains('o') => {
+                    l
```

**File**: `tests/repro_498_warn_masks_later_deny.rs` (modified, +45/-0)
```diff
@@ -819,6 +819,51 @@ fn heredoc_bodies_whose_output_may_run_are_judged() {
     }
 }
 
+/// Review of 6976885: an unquoted body is masked as contained only when the
+/// command that owns it passes it through untouched. `read` kept it for a
+/// later `$c`, sed's `e`/`s///e` and awk's `system()` and `print | "sh"`
+/// ran it, `sort --compress-program` and `rg --pre` handed it to a program,
+/// `nc` and `curl` sent it away, and `tee /dev/stderr` or `tee /dev/fd/3`
+/// wrote it where `2>&1 >/dev/null | sh` pointed. Each was masked as the
+/// terminal's text and allowed, where v0.15.1 denied it.
+#[test]
+fn unquoted_bodies_whose_owner_uses_them_stay_whole() {
+    let lab = Lab::new(DEFAULTS);
+    let body = "watch 'git reset --hard'";
+    for template in [
+        "read -r c <<EOF\n{b}\nEOF\n$c",
+        "sed e <<EOF\n{b}\nEOF",
+        "sed 's/^/ /e' <<EOF\n{b}\nEOF",
+        "awk '{system($0)}' <<EOF\n{b}\nEOF",
+        "awk '{print | \"sh\"}' <<EOF\n{b}\nEOF",
+        "sort -S 1 --compress-program=sh <<EOF\n{b}\nEOF",
+        "cat <<EOF | sort -S 1 --compress-prog=sh\n{b}\nEOF",
+        "cat <<EOF | rg --pre sh '' /dev/stdin\n{b}\nEOF",
+        "nc h 4444 <<EOF\n{b}\nEOF",
+        "curl --data-binary @- http://h/run <<EOF\n{b}\nEOF",
+        "tee /dev/stderr <<EOF 2>&1 >/dev/null | sh\n{b}\nEOF",
+        "tee /dev/fd/3 <<EOF 3>&1 >/dev/null | sh\n{b}\nEOF",
+        "sort -o /dev/stderr <<EOF 2>&1 >/dev/null | sh\n{b}\nEOF",
+        "uniq - /dev/stderr <<EOF 2>&1 >/dev/null | sh\n{b}\nEOF",
+        "cat <<EOF | tee /dev/stderr 2>&1 >/dev/null | sh\n{b}\nEOF",
+        "PATH=/tmp/x cat <<EOF\n{b}\nEOF",
+    ] {
+        let command = template.replace("{b}", body);
+        assert!(lab.claude_hook_denies(&command), "{command:?}");
+    }
+    for template in [
+        "cat <<EOF > notes.md\n{b}\nEOF",
+        "LC_ALL=C sort <<EOF > sorted.txt\n{b}\nEOF",
+        "tee notes.md <<EOF >/dev/null\n{b}\nEOF",
+        "cat <<EOF | sort -o sorted.txt\n{b}\nEOF",
+        "cat <<EOF | rg -n 'reset$' | wc -l\n{b}\nEOF",
+        "cat <<EOF | tee -a log.txt notes.md\n{b}\nEOF",
+    ] {
+        let command = template.replace("{b}", body);
+        assert!(!lab.claude_hook_denies(&command), "{command:?}");
+    }
+}
+
 /// Eighth review (A14): spellings that still hid a command from the rules
 /// (all allowed on v0.14.4 and v0.15.1).
 #[test]
```

---

### Incident Patch 13: `69768858` (2026-10-01)
**Commit Message**: fix(heredoc): mask an unquoted data body only when its output stays put; judge a body whose output may run (review of 6158ee7)

6158ee7 masked the prose of every unquoted data-sink heredoc in the
expansion-aware view, keeping only its substitutions. That is only sound
while the sink's output goes nowhere that runs it. `cat <<EOF | ssh host`,
`cat <<EOF 2>&1 | sh`, `(cat <<EOF) | sh`, `cat <<EOF | su`, `| at now`,
`| $SHELL` and `| while read l; do eval "$l"; done` with a body such as
`watch 'rm -rf ~/x'` were denied by v0.15.1 and allowed after 6158ee7.

Where the output goes is now proven from the parse tree (HeredocOutput):
contained (the terminal, a plain file by redirect, or a pipe through
read-only text tools only: wc, grep, sort, tee, ...), executes (a pipe into
a shell or interpreter that reads its program from stdin, ssh with no
remote command, su, at, xargs, a wrapper such as sudo, env, timeout or
docker/kubectl exec around one, a computed program, a compound stage), or
escapes (anything else). What the tree does not show (a descriptor
duplication, a substitution, a process substitution, exec, a function, a
parse recovery, a delimiter the grammar misread) is decided from t

**File**: `CHANGELOG.md` (modified, +18/-7)
```diff
@@ -21,13 +21,24 @@ yet.
 - **A heredoc with an unquoted delimiter that only stores text was judged as
   commands.** `cat <<EOF > notes.md` documenting `watch '…'`, `sh -c '…'`,
   `ssh host '…'` or `eval "$x"` was denied, while the same note behind
-  `<<'EOF'` was allowed. Only the parts the shell runs while reading such a
-  body — `$(…)`, backquotes, and arithmetic that may be a subshell — are
-  judged now; a body whose substitutions cannot be bounded is judged whole,
-  as before. A body that a shell runs is still judged: piped or fed to one,
-  read as an awk or sed program (`awk -f - <<EOF`), and now also written to
-  a file the same command then runs (`tee x.sh <<EOF … EOF; sh x.sh`), which
-  was allowed with either delimiter.
+  `<<'EOF'` was allowed. When the data sink's output provably stays put —
+  shown on the terminal, written to a plain file, or piped only through
+  read-only text tools (`wc`, `grep`, `sort`, `tee`, …) — only the parts the
+  shell runs while reading such a body are judged now: `$(…)`, backquotes and
+  arithmetic. Every other unquoted body is judged whole, as in v0.15.1: one
+  whose output goes anywhere dcg cannot follow (`>&2`, `> "$f"`, a command
+  substitution, an unrecognized pipeline stage, a parse it is unsure of), and
+  one whose substitutions cannot be bounded. A body is also judged when it is
+  read as an awk or sed program (`awk -f - <<EOF`), and now when it is
+  written to a file the same command then runs (`tee x.sh <<EOF … EOF; sh
+  x.sh`), which was allowed with either delimiter.
+
+- **A heredoc whose output reaches a program that runs it was judged as
+  data.** `cat <<'EOF' | ssh host`, `| docker exec -i c sh`, `| sudo sh`,
+  `| at now`, `| su`, `| $SHELL`, `2>&1 | sh`, `(cat <<'EOF') | sh`,
+  `tee >(sh) <<'EOF'`, `eval "$(cat <<'EOF' …)"` and the same with an
+  unquoted delimiter were allowed on v0.15.1 whatever the body held. Such a
+  body is judged as commands now, with either delimiter.
 
 - **More spellings that hid a command.** A quoted option around a shell's
   `-c` (`bash -c -o 'errexit' '…'`, `bash '-c' '…'`); a runner named through
```

**File**: `src/evaluator.rs` (modified, +26/-0)
```diff
@@ -11391,6 +11391,7 @@ fn collect_executable_text_sinks(command: &str, dialect: ShellDialect) -> Vec<Ex
         collect_posix_eval_sinks(eval_view.as_ref(), &mut sinks);
         collect_posix_pipeline_executable_sinks(command, &mut sinks);
         collect_posix_process_substitution_sinks(command, &mut sinks);
+        collect_data_heredoc_output_sinks(command, &mut sinks);
     }
     if matches!(dialect, ShellDialect::PowerShell | ShellDialect::Unknown) {
         collect_powershell_iex_sinks(command, &mut sinks);
@@ -11406,6 +11407,31 @@ fn collect_executable_text_sinks(command: &str, dialect: ShellDialect) -> Vec<Ex
     sinks
 }
 
+/// A data-sink heredoc whose output reaches a program that may run it is
+/// that program's source: `cat <<'EOF' | ssh host`, `cat <<EOF 2>&1 | sh`,
+/// `(cat <<'EOF') | sh`, `tee >(sh) <<'EOF'`. The masked views treat such a
+/// body as data (its target only copies it), so judge each one here as a
+/// POSIX command, quoted delimiter or not. Shapes the pipeline collector
+/// already resolves are judged twice, to the same answer.
+fn collect_data_heredoc_output_sinks(command: &str, sinks: &mut Vec<ExecutableTextSink>) {
+    for body in crate::heredoc::data_heredoc_bodies_whose_output_may_run(command) {
+        let Some(source) = command.get(body) else {
+            continue;
+        };
+        let sink = ExecutableTextSink::Payload {
+            source: source.to_string(),
+            dialect: ShellDialect::Posix,
+            context: "a heredoc's output reaches a program that runs it",
+        };
+        if !sinks.contains(&sink) {
+            sinks.push(sink);
+        }
+        if sinks.len() > MAX_EXECUTABLE_TEXT_SINKS {
+            return;
+        }
+    }
+}
+
 #[allow(clippy::too_many_arguments)]
 fn evaluate_executable_text_sinks(
     command: &str,
```

**File**: `src/heredoc.rs` (modified, +1297/-37)
```diff
@@ -6101,7 +6101,8 @@ fn quoted_non_shell_heredoc_ranges(command: &str, limit: usize) -> Vec<Range<usi
     let ast = AstGrep::new(command, SupportLang::Bash);
     let mut heredocs = Vec::new();
     let mut parse_error = false;
-    collect_active_heredocs(ast.root(), &mut heredocs, &mut parse_error);
+    // Only the bodies are wanted here, not where their command's output goes.
+    collect_active_heredocs(ast.root(), &mut heredocs, &mut parse_error, true);
     if parse_error {
         return Vec::new();
     }
@@ -7619,6 +7620,20 @@ fn mask_non_executing_heredocs_with_policy(
             ActiveHeredocBody::HereString => None,
         })
         .collect();
+    // Where each command's output goes, when the parse tree did not prove
+    // it: decided once, from the text outside every body.
+    let mut unproven_output: Option<HeredocOutput> = None;
+    let mut output_of = |heredoc: &ActiveHeredoc| -> HeredocOutput {
+        heredoc.output.unwrap_or_else(|| {
+            *unproven_output.get_or_insert_with(|| {
+                if command_may_run_heredoc_output(&blank_ranges(command, &bodies)) {
+                    HeredocOutput::Executes
+                } else {
+                    HeredocOutput::Escapes
+                }
+            })
+        })
+    };
 
     let mut result = String::new();
     let mut pos = 0;
@@ -7694,8 +7709,22 @@ fn mask_non_executing_heredocs_with_policy(
         // runs while reading it stay verbatim (`None`: they cannot be bounded,
         // so the body stays whole). The full mask erases them too; its callers
         // judge substitutions from the expansion-aware view instead.
+        //
+        // The prose around those spans is only data when the target's output
+        // provably stays put: the terminal, a plain file, read-only text
+        // tools. Any other unquoted body stays whole in this view, as in
+        // v0.15.1: `cat <<EOF 2>&1 | sh`, `(cat <<EOF) | sh`, `cat <<EOF | ssh
+        // h` and `x=$(cat <<EOF …)` run or may run the text. (A body whose
+        // output reaches a program that runs it is also judged as commands,
+        // quoted or not, through [`data_heredoc_bodies_whose_output_may_run`];
+        // the views keep their masks so its quotes cannot regroup the text
+        // around it.)
         let keep_spans = if require_quoted_delimiter && !delimiter_quoted {
-            active_heredoc.live_spans.clone()
+            if output_of(&active_heredoc) == HeredocOutput::Contained {
+                active_heredoc.live_spans.clone()
+            } else {
+                None
+            }
         } else {
             Some(Vec::new())
         };
@@ -7771,6 +7800,76 @@ fn mask_non_executing_heredocs_with_policy(
     }
 }
 
+/// The bodies of data-sink heredocs (`cat`, `tee`, `grep`, … — targets the
+/// masks treat as data) whose command's output reaches a program that may
+/// run it: `cat <<'EOF' | ssh host`, `cat <<EOF 2>&1 | sh`, `(cat <<'EOF') |
+/// sh`, `tee >(sh) <<'EOF'`, `eval "$(cat <<'EOF' …)"`. The caller judges each
+/// one as commands, whatever its delimiter's quoting. Interpreter targets
+/// (`python3 - <<'EOF' | sh`) are left out: their output is not their body.
+pub(crate) fn data_heredoc_bodies_whose_output_may_run(command: &str) -> Vec<Range<usize>> {
+    if !command.contains("<<") {
+        return Vec::new();
+    }
+    let Some(heredocs) = active_heredocs(command) else {
+        return Vec::new();
+    };
+    let bodies: Vec<Range<usize>> = heredocs
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
+    let mut unproven_runs: Option<bool> = None;
+    let mut found = Vec::new();
+    for heredoc in &heredocs {
+        let ActiveHeredocBody::Heredoc {
+            body_start,
+            body_end,
+            ..
+        } = heredoc.body
+        else {
+            continue;
+        };
+        if body_start >= body_end
+            || !extract_heredoc_target_command(command, heredoc.operator_start)
+                .as_deref()
+                .is_some_and(is_non_executing_heredoc_command)
+        {
+            continue;
+        }
+        let runs = match heredoc.output {
+            Some(output) => output == HeredocOutput::Executes,
+            None => *unproven_runs.get_or_insert_with(|| {
+                command_may_run_heredoc_output(&blank_ranges(command, &bodies))
+            }),
+        };
+        if runs {
+            found.push(body_start..body_end);
+        }
+    }
+    found
+}
+
+/// `command` with every byte inside `ranges` (other than newlines) blanked.
+fn blank_ranges(command: &str, ranges: &[Range<usize>]) -> String {
+    let mut outside = command.as_bytes().to_vec();
+    for range in ranges
```

**File**: `tests/repro_498_warn_masks_later_deny.rs` (modified, +43/-0)
```diff
@@ -776,6 +776,49 @@ fn expanding_data_heredoc_bodies_judge_only_what_the_shell_runs() {
     }
 }
 
+/// Review of 6158ee7: a data sink's body is data only while the sink's
+/// output stays put. An unquoted body piped or otherwise fed to a program
+/// that runs it was masked like a contained one and allowed, where v0.15.1
+/// denied it; a quoted one was allowed by both. Both are now judged as
+/// commands. Contained output, and quoted bodies that only reach data
+/// consumers, decide as before.
+#[test]
+fn heredoc_bodies_whose_output_may_run_are_judged() {
+    let lab = Lab::new(DEFAULTS);
+    let runs = [
+        "cat <<{d} | sh\n{b}\nEOF",
+        "cat <<{d} 2>&1 | sh\n{b}\nEOF",
+        "cat <<{d} >&2 | sh\n{b}\nEOF",
+        "(cat <<{d}) | sh\n{b}\nEOF",
+        "cat <<{d} | ssh host\n{b}\nEOF",
+        "cat <<{d} | ssh host -- bash -s\n{b}\nEOF",
+        "cat <<{d} | docker exec -i c sh\n{b}\nEOF",
+        "cat <<{d} | kubectl exec -i p -- sh\n{b}\nEOF",
+        "cat <<{d} | at now\n{b}\nEOF",
+        "cat <<{d} | su\n{b}\nEOF",
+        "cat <<{d} | $SHELL\n{b}\nEOF",
+        "cat <<{d} | while read -r l; do eval \"$l\"; done\n{b}\nEOF",
+    ];
+    for delimiter in ["EOF", "'EOF'"] {
+        for body in ["watch 'git reset --hard'", "git reset --hard"] {
+            for template in runs {
+                let command = template.replace("{d}", delimiter).replace("{b}", body);
+                assert!(lab.claude_hook_denies(&command), "{command:?}");
+            }
+        }
+    }
+    for command in [
+        "cat <<EOF > notes.md\nwatch 'git reset --hard'\nEOF",
+        "cat <<EOF | wc -l\nwatch 'git reset --hard'\nEOF",
+        "cd docs && cat <<EOF > notes.md\nssh h 'git reset --hard'\nEOF",
+        "cat <<'EOF' | git commit -F -\nfix: stop running git reset --hard\nEOF",
+        "cat <<'EOF' | sudo tee /etc/motd >/dev/null\nnever run rm -rf ~/src here\nEOF",
+        "git commit -m \"$(cat <<'EOF'\nfix: document git reset --hard\nEOF\n)\"",
+    ] {
+        assert!(!lab.claude_hook_denies(command), "{command:?}");
+    }
+}
+
 /// Eighth review (A14): spellings that still hid a command from the rules
 /// (all allowed on v0.14.4 and v0.15.1).
 #[test]
```

---

### Incident Patch 14: `d4b0e442` (2026-10-01)
**Commit Message**: fix(tests): bound the project-allowlist path tests to their temp tree; fmt, clippy and a hook-stdin race (review of f1c32fe)

f1c32fe (merged as a9a9cb7) reported `cargo fmt --check` failing and two
failing library tests. Neither failure came from its change.

- project_allowlist_path_falls_back_to_cwd_outside_git and
  project_allowlist_path_uses_nearest_non_git_ancestor searched upward from
  a tempfile::tempdir() without a bound. On a remote build worker TMPDIR is
  <checkout>/.rch-tmp, so the search reached the checkout and answered
  `<checkout>/.dcg/allowlist.toml`. project_allowlist_path() now delegates
  to project_allowlist_path_within(start, max_hops); the tests pass the
  depth of their own tree, and a new test pins that the entry point still
  searches the full default depth. Runtime behaviour is unchanged.
- rustfmt: two assert! calls in f1c32fe's issue_500 test.
- clippy -D warnings (iter_on_single_items) in f1c32fe's
  exposes_keyword_absent_from test, which its message did not mention.
- e2e_real_service::bypass_env_allows_destructive_silently_for_both_protocols
  failed about one run in five: a bypassed hook exits without reading its
  input, so writing the hook JS

**File**: `src/allowlist.rs` (modified, +38/-6)
```diff
@@ -1841,14 +1841,22 @@ pub(crate) fn user_allowlist_path() -> PathBuf {
 /// directory tree. The CLI separately enforces the explicit project-policy
 /// trust requirement before any project-layer mutation.
 pub(crate) fn project_allowlist_path(start: &Path) -> PathBuf {
-    if let Some(root) =
-        crate::config::find_repo_root(start, crate::config::REPO_ROOT_SEARCH_MAX_HOPS)
-    {
+    project_allowlist_path_within(start, crate::config::REPO_ROOT_SEARCH_MAX_HOPS)
+}
+
+/// [`project_allowlist_path`] with the upward search limited to `max_hops`
+/// parents of `start` (both for the repository root and for an existing
+/// allowlist). Tests pass the depth of their temporary tree so the answer
+/// does not depend on what lies above it: a temporary directory created
+/// inside a checkout (as a remote build worker's `TMPDIR` can be) would
+/// otherwise resolve to that checkout's root.
+fn project_allowlist_path_within(start: &Path, max_hops: usize) -> PathBuf {
+    if let Some(root) = crate::config::find_repo_root(start, max_hops) {
         return root.join(".dcg").join("allowlist.toml");
     }
 
     let mut current = Some(start);
-    for _ in 0..=crate::config::REPO_ROOT_SEARCH_MAX_HOPS {
+    for _ in 0..=max_hops {
         let Some(dir) = current else {
             break;
         };
@@ -2150,11 +2158,16 @@ fn get_timestamp_string(tbl: &toml::value::Table, key: &str) -> Option<String> {
 mod tests {
     use super::*;
 
+    // These tests bound the upward search to their temporary tree: the
+    // system temporary directory can itself sit inside a Git checkout (a
+    // remote build worker points `TMPDIR` at `<checkout>/.rch-tmp`), and an
+    // unbounded search then answers with that checkout's root.
+
     #[test]
     fn project_allowlist_path_falls_back_to_cwd_outside_git() {
         let tmp = tempfile::tempdir().unwrap();
         assert_eq!(
-            project_allowlist_path(tmp.path()),
+            project_allowlist_path_within(tmp.path(), 0),
             tmp.path().join(".dcg").join("allowlist.toml")
         );
     }
@@ -2168,7 +2181,12 @@ mod tests {
         let nested = tmp.path().join("a").join("b");
         std::fs::create_dir_all(&nested).unwrap();
 
-        assert_eq!(project_allowlist_path(&nested), root_allowlist);
+        assert_eq!(project_allowlist_path_within(&nested, 2), root_allowlist);
+        // Below the bound, the nested directory governs itself.
+        assert_eq!(
+            project_allowlist_path_within(&nested, 1),
+            nested.join(".dcg").join("allowlist.toml")
+        );
     }
 
     #[test]
@@ -2178,6 +2196,20 @@ mod tests {
         let nested = tmp.path().join("a").join("b");
         std::fs::create_dir_all(&nested).unwrap();
 
+        assert_eq!(
+            project_allowlist_path_within(&nested, 2),
+            tmp.path().join(".dcg").join("allowlist.toml")
+        );
+    }
+
+    /// The production entry point searches the full default depth.
+    #[test]
+    fn project_allowlist_path_searches_the_default_depth() {
+        let tmp = tempfile::tempdir().unwrap();
+        std::fs::create_dir(tmp.path().join(".git")).unwrap();
+        let nested = tmp.path().join("a").join("b").join("c");
+        std::fs::create_dir_all(&nested).unwrap();
+
         assert_eq!(
             project_allowlist_path(&nested),
             tmp.path().join(".dcg").join("allowlist.toml")
```

**File**: `src/evaluator.rs` (modified, +2/-10)
```diff
@@ -44047,11 +44047,7 @@ mod tests {
             "wipe^fs /dev/sda",
         ] {
             assert!(
-                dialect_view_may_expose_hidden_execution(
-                    command,
-                    ShellDialect::Cmd,
-                    Some(&index)
-                ),
+                dialect_view_may_expose_hidden_execution(command, ShellDialect::Cmd, Some(&index)),
                 "{command:?} hides its command word behind a caret; the `/dev/` \
                  operand belongs to a different rule and cannot stand in for it"
             );
@@ -44061,11 +44057,7 @@ mod tests {
         // that exposes no keyword the POSIX view lacked does not replay.
         for command in ["echo he^llo", "git log --oneline -5"] {
             assert!(
-                !dialect_view_may_expose_hidden_execution(
-                    command,
-                    ShellDialect::Cmd,
-                    Some(&index)
-                ),
+                !dialect_view_may_expose_hidden_execution(command, ShellDialect::Cmd, Some(&index)),
                 "{command:?} exposes no keyword its POSIX view did not already have"
             );
         }
```

**File**: `src/packs/mod.rs` (modified, +1/-1)
```diff
@@ -5411,7 +5411,7 @@ destructive_patterns:
     /// unrelated keyword in the baseline cannot answer it.
     #[test]
     fn exposes_keyword_absent_from_is_per_keyword_not_any_keyword() {
-        let enabled: HashSet<String> = ["system.disk".to_string()].into_iter().collect();
+        let enabled: HashSet<String> = std::iter::once("system.disk".to_string()).collect();
         let ordered = REGISTRY.expand_enabled_ordered(&enabled);
         let index = REGISTRY
             .build_enabled_keyword_index(&ordered)
```

**File**: `tests/e2e_real_service.rs` (modified, +11/-3)
```diff
@@ -300,12 +300,20 @@ fn run_dcg(
     });
 
     if let Some(input) = stdin {
-        child
+        let written = child
             .stdin
             .as_mut()
             .expect("child stdin should be piped")
-            .write_all(input.as_bytes())
-            .expect("failed to write hook JSON to stdin");
+            .write_all(input.as_bytes());
+        // A bypassed hook exits without reading its input, so the write can
+        // lose the race with that exit; the run's output is what is judged.
+        if let Err(error) = written {
+            assert_eq!(
+                error.kind(),
+                std::io::ErrorKind::BrokenPipe,
+                "failed to write hook JSON to stdin: {error}"
+            );
+        }
     }
 
     let output = child.wait_with_output().expect("failed to wait for dcg");
```

---

### Incident Patch 15: `f1c32fe8` (2026-09-30)
**Commit Message**: fix(evaluator): preserve decoded destructive keywords when unrelated raw keywords exist

Preserve the existing #499/#500 repair across evaluator admission and enabled-pack keyword indexing.

Compare newly exposed decoded keywords individually against raw-view keyword identities, rather than treating the presence of any unrelated keyword in raw input as evidence that the dangerous decoded executable was already visible. Account for always-check masks, core Git keywords, overlapping Aho-Corasick pattern IDs, and whitespace keyword matching. Only a genuinely different normalized dialect enters this decoded-view comparison.

Retain regression cases for caret-decoded destructive commands beside unrelated /dev/ text and for enabling Windows packs without weakening the system.disk denial. Benign echo/Git negative controls remain present; the change must strengthen detection without converting inert data into executable commands.

Validation: remote cargo test --locked ran 4428 library cases: 4422 passed, 2 failed, 4 ignored. The failures are project_allowlist_path_falls_back_to_cwd_outside_git and project_allowlist_path_uses_nearest_non_git_ancestor; this is not a full-suite pass. cargo f

**File**: `src/evaluator.rs` (modified, +112/-14)
```diff
@@ -12673,11 +12673,23 @@ fn unknown_dialect_fanout_candidate(
 /// `docker system prune -af`. The normalized view a replay would actually match
 /// on is the authority on that, so ask it directly.
 ///
-/// Cost is bounded to commands that already carry the view's escape byte: the
-/// caller has proven a dialect-divergent byte is present, and the extra
-/// normalize runs only when that byte is this view's own escape character *and*
-/// the raw text names no keyword. A benign `echo he^llo` decodes to `echo
-/// hello`, which still names nothing, so it never reaches a replay.
+/// Cost is bounded to commands that already carry the view's escape byte in an
+/// executable position, and, beyond that, to ones whose decode actually rewrites
+/// the command relative to the POSIX view. A benign `echo he^llo` decodes to
+/// `echo hello`, which names nothing any pack protects, so it never reaches a
+/// replay; `git log --format=%H%n` decodes differently but exposes no keyword
+/// the POSIX view did not already have, so it does not either.
+///
+/// The keyword question is asked *per keyword*, against the POSIX view rather
+/// than against "does the raw text name anything at all". That weaker test
+/// suppressed the replay whenever some unrelated keyword appeared anywhere on
+/// the line — `/dev/` in `crypt^setup luksErase /dev/sdb`, or `erase`/`rd`
+/// contributed by an unrelated enabled pack and matched inside `luksErase` and
+/// `card`. It made a more dangerous spelling *less* detected than a less
+/// dangerous one, and made coverage non-monotone in the enabled-pack set, which
+/// is how the hook (which selects the wider Windows pack view for exactly these
+/// caret-shaped payloads) came to allow commands `dcg explain` denied
+/// (dcg#499, dcg#500).
 fn view_decode_exposes_pack_keyword(
     command: &str,
     view: ShellDialect,
@@ -12703,18 +12715,21 @@ fn view_decode_exposes_pack_keyword(
         return false;
     }
     let view_normalized = crate::normalize::normalize_command_in_dialect(command, view);
+    let posix_normalized =
+        crate::normalize::normalize_command_in_dialect(command, ShellDialect::Posix);
+    // A decode that leaves the command where the POSIX view already had it
+    // cannot have reconstructed an executable; that difference is the only
+    // thing that could have.
+    if view_normalized == posix_normalized {
+        return false;
+    }
     let Some(index) = keyword_index else {
         // No index to ask, so fail closed exactly like the candidate gate's
-        // keyword half does: replay whenever this view's normalized text
-        // differs from the POSIX one, because that difference is the only
-        // thing that could have reconstructed an executable.
-        return view_normalized
-            != crate::normalize::normalize_command_in_dialect(command, ShellDialect::Posix);
+        // keyword half does: the two views disagree, and only this view's
+        // decode could have made them.
+        return true;
     };
-    if index.has_any_keyword(command) {
-        return false;
-    }
-    index.has_any_keyword(view_normalized.as_ref())
+    index.exposes_keyword_absent_from(view_normalized.as_ref(), posix_normalized.as_ref())
 }
 
 /// Whether `view`'s parse of `command` exposes command segments the POSIX parse
@@ -43711,6 +43726,89 @@ mod tests {
         ));
     }
 
+    /// dcg#500: an unrelated keyword elsewhere on the line must not suppress
+    /// the replay for the keyword the escape actually hid.
+    ///
+    /// The gate used to ask "does the raw text name *any* enabled keyword",
+    /// which a device path answers for a completely different rule. That made
+    /// the more dangerous spelling the less detected one: `crypt^setup
+    /// luksErase mydev` denied while the same command against a real device
+    /// allowed, because only the latter carries `/dev/`.
+    #[test]
+    fn issue_500_unrelated_keyword_does_not_suppress_the_decode_replay() {
+        let ordered =
+            crate::packs::REGISTRY.expand_enabled_ordered(&["system.disk".to_string()].into());
+        let index = crate::packs::REGISTRY
+            .build_enabled_keyword_index(&ordered)
+            .expect("keyword index should build");
+
+        for command in [
+            "crypt^setup luksErase /dev/sdb",
+            "blkdis^card /dev/sdb",
+            "d^d if=/dev/zero of=/dev/sda",
+            "wipe^fs /dev/sda",
+        ] {
+            assert!(
+                dialect_view_may_expose_hidden_execution(
+                    command,
+                    ShellDialect::Cmd,
+                    Some(&index)
+                ),
+                "{command:?} hides its command word behind a caret; the `/dev/` \
+                 operand belongs to a different rule and cannot stand in for it"
+            );
+        }
+
+        // The cost bound the old early return existed for still holds: a decode
+        // that exposes no keyword the
```

**File**: `src/packs/mod.rs` (modified, +95/-0)
```diff
@@ -1369,6 +1369,65 @@ impl EnabledKeywordIndex {
 
         mask
     }
+
+    /// Whether `decoded` names an enabled-pack keyword that `baseline` does not.
+    ///
+    /// The unknown-dialect fan-out asks this to decide whether replaying a
+    /// command under a concrete dialect could reach a rule the POSIX view could
+    /// not (dcg#294): a cmd.exe caret or a PowerShell backtick can split an
+    /// executable word without adding a separator, so the decoded text names
+    /// something a pack protects while the POSIX text does not.
+    ///
+    /// The question has to be asked per keyword. A plain "does the baseline
+    /// name *any* keyword" test answers a different one, and answers it wrong
+    /// whenever the line carries an unrelated keyword: `/dev/` in
+    /// `crypt^setup luksErase /dev/sdb` belongs to a rule about device targets,
+    /// not to the command word the caret split, yet it made the replay look
+    /// redundant and the command was allowed while the same line without a
+    /// device path denied. The same test also made coverage *non-monotone* in
+    /// the enabled-pack set: enabling `windows.filesystem` contributes `erase`
+    /// and `rd`, which appear inside the unrelated words `luksErase` and
+    /// `card`, so turning that pack on silently un-shipped `system.disk`'s
+    /// `cryptsetup-erase` and `blkdiscard` rules for their caret spellings
+    /// (dcg#499, dcg#500).
+    ///
+    /// Pattern ids are compared rather than keyword text so the two sides use
+    /// one matcher and one notion of a match, including the overlapping
+    /// substring semantics `candidate_pack_mask` documents.
+    #[must_use]
+    pub fn exposes_keyword_absent_from(&self, decoded: &str, baseline: &str) -> bool {
+        // A pack with no keyword list is checked against every command, so it
+        // is checked against the decoded text too — and that text is exactly
+        // what it has not seen yet.
+        if self.always_check_mask != 0 {
+            return true;
+        }
+
+        if self.core_git_mask != 0
+            && crate::packs::core::git::contains_git_ascii_case_insensitive(decoded)
+            && !crate::packs::core::git::contains_git_ascii_case_insensitive(baseline)
+        {
+            return true;
+        }
+
+        if let Some(ac) = &self.keyword_matcher {
+            let baseline_hits: std::collections::BTreeSet<usize> = ac
+                .find_overlapping_iter(baseline)
+                .map(|m| m.pattern().as_usize())
+                .collect();
+            if ac
+                .find_overlapping_iter(decoded)
+                .any(|m| !baseline_hits.contains(&m.pattern().as_usize()))
+            {
+                return true;
+            }
+        }
+
+        self.whitespace_keywords.iter().any(|keyword| {
+            keyword_matches_substring(decoded, keyword)
+                && !keyword_matches_substring(baseline, keyword)
+        })
+    }
 }
 
 /// Packs the `careful_company_running_windows` preset pulls in beyond its own
@@ -5348,6 +5407,42 @@ destructive_patterns:
         assert!(!index.has_any_keyword("cd /tmp"), "cd has no pack keywords");
     }
 
+    /// dcg#499/#500: the decode gate asks a per-keyword question, so an
+    /// unrelated keyword in the baseline cannot answer it.
+    #[test]
+    fn exposes_keyword_absent_from_is_per_keyword_not_any_keyword() {
+        let enabled: HashSet<String> = ["system.disk".to_string()].into_iter().collect();
+        let ordered = REGISTRY.expand_enabled_ordered(&enabled);
+        let index = REGISTRY
+            .build_enabled_keyword_index(&ordered)
+            .expect("should build index");
+
+        // `cryptsetup` is new even though `/dev/` is on both sides; the device
+        // path belongs to a different rule and cannot stand in for the command
+        // word the caret split.
+        assert!(index.exposes_keyword_absent_from(
+            "cryptsetup luksErase /dev/sdb",
+            "crypt^setup luksErase /dev/sdb"
+        ));
+        assert!(index.exposes_keyword_absent_from(
+            "dd if=/dev/zero of=/dev/sda",
+            "d^d if=/dev/zero of=/dev/sda"
+        ));
+
+        // Same keywords on both sides: nothing new, so no replay is warranted.
+        assert!(!index.exposes_keyword_absent_from(
+            "dd if=/dev/zero of=/dev/sda",
+            "dd if=/dev/zero of=/dev/sda"
+        ));
+        assert!(!index.exposes_keyword_absent_from("echo hello", "echo he^llo"));
+
+        // Polarity is directional: dropping a keyword is not exposing one.
+        assert!(!index.exposes_keyword_absent_from(
+            "crypt^setup luksErase /dev/sdb",
+            "cryptsetup luksErase /dev/sdb"
+        ));
+    }
+
     #[test]
     fn has_any_keyword_returns_true_for_matching_command() {
         let enabled: HashSet<String> = REGISTRY
```

#### Recent Merged Pull Requests:
- **PR #535** (2026-10-05): ci(deps): bump dtolnay/rust-toolchain from 02cb101ec7c40f2c49e1d9714d64511d8e1b74de to 7e38f4b43b4db5c8dd498af069a4f6196df1d067 in the actions group (@dependabot[bot])
- **PR #507** (2026-09-28): deps(deps): bump the rust-minor-patch group with 2 updates (@dependabot[bot])
- **PR #506** (2026-09-28): ci(deps): bump the actions group with 2 updates (@dependabot[bot])
- **PR #463** (2026-09-21): deps(deps): bump the rust-minor-patch group with 3 updates (@dependabot[bot])
- **PR #462** (2026-09-21): ci(deps): bump the actions group with 4 updates (@dependabot[bot])
- **PR #436** (closed): fix: harden argument-data safe exemptions tracked in #435 (@Dicklesworthstone)
- **PR #415** (closed): deps(deps): bump smallvec from 1.16.0 to 1.16.1 in the rust-minor-patch group across 1 directory (@dependabot[bot])
- **PR #414** (closed): deps(deps): bump dirs from 6.0.0 to 7.0.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
