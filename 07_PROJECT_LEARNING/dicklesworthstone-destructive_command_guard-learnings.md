# Forensic Learning Record (Deep Inspection): Dicklesworthstone/destructive_command_guard

> **Canonical Artifact**: `07_PROJECT_LEARNING/dicklesworthstone-destructive_command_guard-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:37:36.947Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dicklesworthstone/destructive_command_guard`
- **Description**: The Destructive Command Guard (dcg) is for blocking dangerous git and shell commands from being executed by agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6071 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/codex_deny.rs`
```
//! Benchmarks for protocol-specific deny path formatting.
//!
//! Run with: `cargo bench --bench codex_deny`

use std::hint::black_box;

use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use destructive_command_guard::hook::{
    AllowOnceInfo, HookInput, HookProtocol, extract_command_with_protocol, write_denial_to,
};
use destructive_command_guard::packs::{REGISTRY, Severity};
use destructive_command_guard::{
    Config, EvaluationDecision, LayeredAllowlist, evaluate_command_with_pack_order,
};

const COMMAND: &str = "git reset --hard HEAD~1";

struct HookBenchInputs {
    enabled_keywords: Vec<&'static str>,
    ordered_packs: Vec<String>,
    keyword_index: Option<destructive_command_guard::packs::EnabledKeywordIndex>,
    compiled_overrides: destructive_command_guard::config::CompiledOverrides,
    heredoc_settings: destructive_command_guard::config::HeredocSettings,
}

struct BenchState {
    inputs: HookBenchInputs,
    allowlists: LayeredAllowlist,
    allow_once: AllowOnceInfo,
    codex_payload: String,
    claude_payload: String,
}

#[derive(Default)]
struct OutputBuffers {
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

impl OutputBuffers {
    fn clear(&mut self) {
        self.stdout.clear();
        self.stderr.clear();
    }
}

impl BenchState {
    fn new() -> Self {
        let mut config = Config::default();
        config.heredoc.enabled = Some(false);

        let enabled_packs = config.enabled_pack_ids();
        let ordered_packs = REGISTRY.expand_enabled_ordered(&enabled_packs);
        let inputs = HookBenchInputs {
            enabled_keywords: REGISTRY.collect_enabled_keywords(&enabled_packs),
            keyword_index: REGISTRY.build_enabled_keyword_index(&ordered_packs),
            ordered_packs,
            compiled_overrides: config.overrides.compile(),
            heredoc_settings: config.heredoc_settings(),
        };

        Self {
            inputs,
            allowlists: LayeredAllowlist::default(),
            allow_once: AllowOnceInfo {
                code: "abc123".to_string(),
                full_hash: "sha256:abc123def456".to_string(),
            },
            codex_payload: serde_json::json!({
                "tool_name": "Bash",
                "turn_id": "turn-bench",
                "tool_input": { "command": COMMAND }
            })
            .to_string(),
            claude_payload: serde_json::json!({
                "tool_name": "Bash",
                "tool_input": { "command": COMMAND }
            })
            .to_string(),
        }
    }
}

fn run_deny_path(payload: &str, state: &BenchState, buffers: &mut OutputBuffers) -> (usize, usize) {
    buffers.clear();

    let input: HookInput = serde_json::from_str(black_box(payload)).expect("valid hook payload");
    let (command, protocol) =
        extract_command_with_protocol(&input).expect("payload contains a shell command");
    debug_assert!(matches!(
        protocol,
        HookProtocol::Codex | HookProtocol::ClaudeCompatible
    ));

    let result = evaluate_command_with_pack_order(
        black_box(command.as_str()),
        black_box(state.inputs.enabled_keywords.as_slice()),
        black_box(state.inputs.ordered_packs.as_slice()),
        black_box(state.inputs.keyword_index.as_ref()),
        black_box(&state.inputs.compiled_overrides),
        black_box(&state.allowlists),
        black_box(&state.inputs.heredoc_settings),
    );
    debug_assert_eq!(result.decision, EvaluationDecision::Deny);

    let info = result
        .pattern_info
        .as_ref()
        .expect("deny includes pattern info");
    debug_assert_eq!(info.severity, Some(Severity::Critical));

    write_denial_to(
        &mut buffers.stdout,
        &mut buffers.stderr,
        protocol,
        command.as_str(),
        info.reason.as_str(),
        info.pack_id.as_deref(),
        info.pattern_name.as_deref(),
        info.explanation.as_deref(),
        Some(&state.allow_once),
        info.matched_span.as_ref(),
        info.severity,
        None,
        info.suggestions,
        None,
    );

    (buffers.stdout.len(), buffers.stderr.len())
}

fn bench_protocol_deny_path(c: &mut Criterion) {
    let state = BenchState::new();
    let mut group = c.benchmark_group("hook_deny_path");

    for (name, payload) in [
        ("codex_deny", state.codex_payload.as_str()),
        ("claude_deny", state.claude_payload.as_str()),
    ] {
        group.bench_with_input(
            BenchmarkId::from_parameter(name),
            payload,
            |b: &mut criterion::Bencher<'_>, payload: &str| {
                let mut buffers = OutputBuffers::default();
                b.iter(|| black_box(run_deny_path(black_box(payload), &state, &mut buffers)));
            },
        );
    }

    group.finish();
}

criterion_group!(benches, bench_protocol_deny_path);
criterion_main!(benches);

```

### Core Architecture Module: `benches/heredoc_perf.rs`
```
//! Performance benchmarks for dcg hot paths.
//!
//! Run with: `cargo bench --bench heredoc_perf`
//!
//! Performance budgets are defined in `src/perf.rs`. Key thresholds:
//!
//! | Operation              | Target   | Warning  | Panic     |
//! |------------------------|----------|----------|-----------|
//! | Quick reject           | < 1μs    | < 5μs    | > 50μs    |
//! | Fast path (safe cmd)   | < 75μs   | < 150μs  | > 500μs   |
//! | Pattern match          | < 100μs  | < 250μs  | > 1ms     |
//! | Heredoc trigger        | < 5μs    | < 10μs   | > 100μs   |
//! | Heredoc extraction     | < 200μs  | < 500μs  | > 2ms     |
//! | Language detection     | < 20μs   | < 50μs   | > 200μs   |
//! | Full heredoc pipeline  | < 5ms    | < 15ms   | > 50ms    |
//!
//! See `destructive_command_guard::perf` for the canonical budget definitions.

use std::fmt::Write as _;

use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use destructive_command_guard::packs::{REGISTRY, pack_aware_quick_reject};
use destructive_command_guard::{
    Config, ExtractionLimits, ScriptLanguage, check_triggers, evaluate_command_with_pack_order,
    extract_content, extract_shell_commands, matched_triggers,
};
use std::hint::black_box;

// =============================================================================
// Benchmark Fixtures
// =============================================================================

/// Simple command without any heredoc markers.
const SIMPLE_COMMAND: &str = "git status --short";

/// Command with inline Python script.
const INLINE_PYTHON: &str = r#"python3 -c "import os; os.system('rm -rf /')" "#;

/// Command with heredoc marker.
const HEREDOC_BASH: &str = r#"bash << 'EOF'
rm -rf /
echo "done"
EOF"#;

/// Command with multiline heredoc (medium size).
fn medium_heredoc() -> String {
    let mut content = String::from("python3 << 'SCRIPT'\n");
    for i in 0..50 {
        let _ = writeln!(content, "print('line {i}')");
    }
    content.push_str("import os\nos.system('rm -rf /')\n");
    content.push_str("SCRIPT\n");
    content
}

/// Command with large heredoc (stress test).
fn large_heredoc() -> String {
    let mut content = String::from("bash << 'BIGSCRIPT'\n");
    for i in 0..500 {
        let _ = writeln!(content, "echo 'Processing item {i}'");
    }
    content.push_str("rm -rf /\n");
    content.push_str("BIGSCRIPT\n");
    content
}

/// Long command without heredoc markers (worst case for trigger check).
fn long_command_no_heredoc() -> String {
    format!("git commit -m '{}'", "x".repeat(5000))
}

/// Heredoc content for language detection benchmarks.
const PYTHON_CONTENT: &str = r"
import os
import sys

def dangerous():
    os.system('rm -rf /')

if __name__ == '__main__':
    dangerous()
";

const BASH_CONTENT: &str = r"
#!/bin/bash
set -e

rm -rf /
echo 'done'
";

const JAVASCRIPT_CONTENT: &str = r"
const { exec } = require('child_process');
exec('rm -rf /', (err) => {
    if (err) console.error(err);
});
";

// =============================================================================
// Tier 1: Trigger Check Benchmarks
// =============================================================================

fn bench_tier1_triggers(c: &mut Criterion) {
    let mut group = c.benchmark_group("tier1_triggers");

    // Budget: < 10μs
    let cases = [
        ("simple_cmd", SIMPLE_COMMAND),
        ("inline_python", INLINE_PYTHON),
        ("heredoc_bash", HEREDOC_BASH),
    ];

    for (name, cmd) in cases {
        group.bench_with_input(
            BenchmarkId::new("check_triggers", name),
            cmd,
            |b: &mut criterion::Bencher<'_>, cmd: &str| {
                b.iter(|| check_triggers(black_box(cmd)));
            },
        );
    }

    // Long command (worst case)
    let long_cmd = long_command_no_heredoc();
    group.bench_with_input(
        BenchmarkId::new("check_triggers", "long_no_heredoc"),
        &long_cmd,
        |b: &mut criterion::Bencher<'_>, cmd: &String| {
            b.iter(|| check_triggers(black_box(cmd)));
        },
    );

    // Detailed trigger matching
    for (name, cmd) in cases {
        group.bench_with_input(
            BenchmarkId::new("matched_triggers", name),
            cmd,
            |b: &mut criterion::Bencher<'_>, cmd: &str| {
                b.iter(|| matched_triggers(black_box(cmd)));
            },
        );
    }

    group.finish();
}

// =============================================================================
// Core Pipeline: pack-aware quick reject + pack evaluation
// =============================================================================

fn build_hook_inputs(config: &Config) -> HookBenchInputs {
    let enabled_packs = config.enabled_pack_ids();
    let enabled_keywords = REGISTRY.collect_enabled_keywords(&enabled_packs);
    let ordered_packs = REGISTRY.expand_enabled_ordered(&enabled_packs);
    let keyword_index = REGISTRY.build_enabled_keyword_index(&ordered_packs);
    let compiled_overrides = config.overrides.compile();
    let heredoc_settings = config.heredoc_settings();

    HookBenchInputs {
        enabled_keywords,
        ordered_packs,
        keyword_index,
        compiled_overrides,
        heredoc_settings,
    }
}

struct HookBenchInputs {
    enabled_keywords: Vec<&'static str>,
    ordered_packs: Vec<String>,
    keyword_index: Option<destructive_command_guard::packs::EnabledKeywordIndex>,
    compiled_overrides: destructive_command_guard::config::CompiledOverrides,
    heredoc_settings: destructive_command_guard::config::HeredocSettings,
}

fn bench_pack_aware_quick_reject(c: &mut Criterion) {
    let mut group = c.benchmark_group("pack_aware_quick_reject");

    let mut core_only = Config::default();
    core_only.heredoc.enabled = Some(false);
    let core_inputs = build_hook_inputs(&core_only);

    let mut worst_case = Config::default();
    worst_case.heredoc.enabled = Some(false);
    worst_case.packs.enabled = vec![
        "database".to_string(),
        "containers".to_string(),
        "kubernetes".to_string(),
        "cloud".to_string(),
        "infrastructure".to_string(),
        "system".to_string(),
        "strict_git".to_string(),
        "package_managers".to_string(),
        "cicd".to_string(),
    ];
    let worst_inputs = build_hook_inputs(&worst_case);

    let cases = [
        ("no_match", SIMPLE_COMMAND),
        ("match_git", "git status --short"),
    ];

    for (name, cmd) in cases {
        group.bench_with_input(
            BenchmarkId::new("core_only", name),
            cmd,
            |b: &mut criterion::Bencher<'_>, cmd: &str| {
                b.iter(|| {
                    black_box(pack_aware_quick_reject(
                        black_box(cmd),
                        black_box(core_inputs.enabled_keywords.as_slice()),
                    ))
                });
            },
        );
    }

    for (name, cmd) in cases {
        group.bench_with_input(
            BenchmarkId::new("worst_case", name),
            cmd,
            |b: &mut criterion::Bencher<'_>, cmd: &str| {
                b.iter(|| {
                    black_box(pack_aware_quick_reject(
                        black_box(cmd),
                        black_box(worst_inputs.enabled_keywords.as_slice()),
                    ))
                });
            },
        );
    }

    group.finish();
}

#[allow(clippy::too_many_lines)]
fn bench_core_pipeline(c: &mut Criterion) {
    let mut group = c.benchmark_group("core_pipeline");

    // Keep allowlists empty for deterministic, IO-free benchmarks.
    let allowlists = destructive_command_guard::LayeredAllowlist::default();

    let mut core_only = Config::default();
    core_only.heredoc.enabled = Some(false);
    let core_inputs = build_hook_inputs(&core_only);

    let mut docker_enabled = Config::default();
    docker_enabled.heredoc.enabled = Some(false);
    docker_enabled
        .packs
        .enabled
        .push("containers.dock
```

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

### Core Architecture Module: `benches/regex_automata_comparison.rs`
```
//! Benchmark comparing regex crate vs regex-automata for dcg patterns.
//!
//! This is part of task ksk.8.1: Feasibility + prototype for regex-automata.
//!
//! Run with: cargo bench --bench `regex_automata_comparison`

use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};
use regex::Regex;
use regex_automata::{Input, meta::Regex as MetaRegex};
use std::hint::black_box;
use std::time::Duration;

/// Representative patterns from dcg packs (from most common to least common)
const TEST_PATTERNS: &[(&str, &str)] = &[
    // Simple patterns (linear engine in current impl)
    ("git-reset-hard", r"git\s+(?:\S+\s+)*reset\s+--hard"),
    ("git-clean-force", r"git\s+(?:\S+\s+)*clean\s+-[a-zA-Z]*f"),
    ("git-push-force", r"git\s+(?:\S+\s+)*push\s+.*--force"),
    (
        "rm-rf",
        r"rm\s+-[a-zA-Z]*r[a-zA-Z]*f|rm\s+-[a-zA-Z]*f[a-zA-Z]*r",
    ),
    (
        "docker-prune",
        r"docker\s+(?:system|volume|image|container)\s+prune",
    ),
    ("kubectl-delete", r"kubectl\s+delete\s+(?:namespace|ns)\s+"),
    ("drop-table", r"(?i)DROP\s+TABLE\s+"),
    ("truncate", r"(?i)TRUNCATE\s+(?:TABLE\s+)?"),
];

/// Test commands (mix of matching and non-matching)
const TEST_COMMANDS: &[&str] = &[
    // Matching commands
    "git reset --hard HEAD~5",
    "git clean -fd",
    "git push origin main --force",
    "rm -rf /var/log/old",
    "docker system prune -af",
    "kubectl delete namespace production",
    "DROP TABLE users;",
    "TRUNCATE TABLE sessions;",
    // Non-matching commands (should be fast-rejected)
    "git status",
    "git log --oneline",
    "ls -la",
    "cat /etc/passwd",
    "echo hello world",
    "docker ps",
    "kubectl get pods",
    "SELECT * FROM users;",
];

/// Benchmark regex compilation time
fn bench_compilation(c: &mut Criterion) {
    let mut group = c.benchmark_group("compilation");
    group.measurement_time(Duration::from_secs(5));

    for (name, pattern) in TEST_PATTERNS {
        group.bench_with_input(BenchmarkId::new("regex", name), pattern, |b, pat| {
            b.iter(|| Regex::new(black_box(pat)).unwrap());
        });

        group.bench_with_input(
            BenchmarkId::new("regex-automata", name),
            pattern,
            |b, pat| {
                b.iter(|| MetaRegex::new(black_box(pat)).unwrap());
            },
        );
    }

    group.finish();
}

/// Benchmark single pattern matching
fn bench_single_match(c: &mut Criterion) {
    let mut group = c.benchmark_group("single_match");
    group.measurement_time(Duration::from_secs(5));

    // Pre-compile all patterns
    let regex_patterns: Vec<_> = TEST_PATTERNS
        .iter()
        .map(|(name, pat)| (*name, Regex::new(pat).unwrap()))
        .collect();

    let automata_patterns: Vec<_> = TEST_PATTERNS
        .iter()
        .map(|(name, pat)| (*name, MetaRegex::new(pat).unwrap()))
        .collect();

    // Benchmark matching against all test commands
    for (name, regex) in &regex_patterns {
        group.throughput(Throughput::Elements(TEST_COMMANDS.len() as u64));
        group.bench_with_input(BenchmarkId::new("regex", name), &regex, |b, re| {
            b.iter(|| {
                for cmd in TEST_COMMANDS {
                    black_box(re.is_match(black_box(cmd)));
                }
            });
        });
    }

    for (name, automata) in &automata_patterns {
        group.throughput(Throughput::Elements(TEST_COMMANDS.len() as u64));
        group.bench_with_input(
            BenchmarkId::new("regex-automata", name),
            &automata,
            |b, re| {
                b.iter(|| {
                    for cmd in TEST_COMMANDS {
                        black_box(re.is_match(black_box(cmd)));
                    }
                });
            },
        );
    }

    group.finish();
}

/// Benchmark matching with capture (find vs `is_match`)
fn bench_find_match(c: &mut Criterion) {
    let mut group = c.benchmark_group("find_match");
    group.measurement_time(Duration::from_secs(5));

    let pattern = r"git\s+(?:\S+\s+)*reset\s+--hard";
    let command = "git reset --hard HEAD~5";

    let regex = Regex::new(pattern).unwrap();
    let automata = MetaRegex::new(pattern).unwrap();

    group.bench_function("regex_is_match", |b| {
        b.iter(|| black_box(regex.is_match(black_box(command))));
    });

    group.bench_function("regex_find", |b| {
        b.iter(|| black_box(regex.find(black_box(command))));
    });

    group.bench_function("automata_is_match", |b| {
        b.iter(|| black_box(automata.is_match(black_box(command))));
    });

    group.bench_function("automata_find", |b| {
        b.iter(|| {
            let input = Input::new(black_box(command));
            black_box(automata.find(input))
        });
    });

    group.finish();
}

/// Benchmark multi-pattern matching (simulating pack evaluation)
fn bench_multi_pattern(c: &mut Criterion) {
    let mut group = c.benchmark_group("multi_pattern");
    group.measurement_time(Duration::from_secs(5));

    // Compile all patterns
    let regex_set: Vec<_> = TEST_PATTERNS
        .iter()
        .map(|(_, pat)| Regex::new(pat).unwrap())
        .collect();

    let automata_set: Vec<_> = TEST_PATTERNS
        .iter()
        .map(|(_, pat)| MetaRegex::new(pat).unwrap())
        .collect();

    // Also test with a combined pattern using alternation
    let combined_pattern = TEST_PATTERNS
        .iter()
        .map(|(_, pat)| format!("({pat})"))
        .collect::<Vec<_>>()
        .join("|");

    let regex_combined = Regex::new(&combined_pattern).unwrap();
    let automata_combined = MetaRegex::new(&combined_pattern).unwrap();

    let matching_cmd = "git reset --hard HEAD";
    let non_matching_cmd = "git status";

    // Sequential scan (current dcg approach)
    group.bench_function("regex_sequential_match", |b| {
        b.iter(|| {
            for re in &regex_set {
                if re.is_match(black_box(matching_cmd)) {
                    return black_box(true);
                }
            }
            black_box(false)
        });
    });

    group.bench_function("automata_sequential_match", |b| {
        b.iter(|| {
            for re in &automata_set {
                if re.is_match(black_box(matching_cmd)) {
                    return black_box(true);
                }
            }
            black_box(false)
        });
    });

    // Combined pattern (single regex with alternation)
    group.bench_function("regex_combined_match", |b| {
        b.iter(|| black_box(regex_combined.is_match(black_box(matching_cmd))));
    });

    group.bench_function("automata_combined_match", |b| {
        b.iter(|| black_box(automata_combined.is_match(black_box(matching_cmd))));
    });

    // Non-matching command (tests fast rejection)
    group.bench_function("regex_sequential_nomatch", |b| {
        b.iter(|| {
            for re in &regex_set {
                if re.is_match(black_box(non_matching_cmd)) {
                    return black_box(true);
                }
            }
            black_box(false)
        });
    });

    group.bench_function("automata_sequential_nomatch", |b| {
        b.iter(|| {
            for re in &automata_set {
                if re.is_match(black_box(non_matching_cmd)) {
                    return black_box(true);
                }
            }
            black_box(false)
        });
    });

    group.finish();
}

/// Benchmark worst-case patterns (`ReDoS` resistance)
fn bench_worst_case(c: &mut Criterion) {
    let mut group = c.benchmark_group("worst_case");
    group.measurement_time(Duration::from_secs(3));

    // Patterns that could cause exponential backtracking
    let evil_patterns = &[
        ("nested_quantifier", r"(a+)+$"),
        ("alternation", r"(a|a)+"),
        ("catastrophic", r"(a*)*b"),
    ];

    // Input designed to trigger worst-case
    let evil_input = "a".repeat(25) + "!"; // 25 'a's followed by non-matching char

    for (name,
```

### Core Architecture Module: `fuzz/fuzz_targets/ast_matcher_fuzz.rs`
```
//! Fuzz target for AST matcher parsing and destructive-pattern matching.
//!
//! The first byte selects a script language and the remaining UTF-8 bytes are
//! parsed as embedded script content. Parser errors and timeouts are expected
//! to fail open through `has_blocking_match` rather than panic or deny.

#![no_main]

use destructive_command_guard::{AstMatcher, MatchError, ScriptLanguage};
use libfuzzer_sys::fuzz_target;
use std::sync::LazyLock;
use std::time::Duration;

const MAX_CODE_BYTES: usize = 8 * 1024;

static MATCHER: LazyLock<AstMatcher> =
    LazyLock::new(|| AstMatcher::new().with_timeout(Duration::from_millis(10)));
static ZERO_TIMEOUT_MATCHER: LazyLock<AstMatcher> =
    LazyLock::new(|| AstMatcher::new().with_timeout(Duration::ZERO));

fuzz_target!(|data: &[u8]| {
    if data.len() < 2 || data.len() > MAX_CODE_BYTES {
        return;
    }

    let language = language_from_selector(data[0]);
    let Ok(code) = std::str::from_utf8(&data[1..]) else {
        return;
    };
    let code = code.strip_prefix('\n').unwrap_or(code);

    exercise_matcher(code, language);
});

fn language_from_selector(selector: u8) -> ScriptLanguage {
    match selector {
        b'b' | b'B' | b's' | b'S' => ScriptLanguage::Bash,
        b'g' | b'G' => ScriptLanguage::Go,
        b'h' | b'H' => ScriptLanguage::Php,
        b'j' | b'J' => ScriptLanguage::JavaScript,
        b'p' | b'P' => ScriptLanguage::Python,
        b'r' | b'R' => ScriptLanguage::Ruby,
        b'l' | b'L' => ScriptLanguage::Perl,
        b't' | b'T' => ScriptLanguage::TypeScript,
        b'u' | b'U' => ScriptLanguage::Unknown,
        _ => match selector % 9 {
            0 => ScriptLanguage::Bash,
            1 => ScriptLanguage::Python,
            2 => ScriptLanguage::JavaScript,
            3 => ScriptLanguage::TypeScript,
            4 => ScriptLanguage::Ruby,
            5 => ScriptLanguage::Perl,
            6 => ScriptLanguage::Php,
            7 => ScriptLanguage::Go,
            _ => ScriptLanguage::Unknown,
        },
    }
}

fn exercise_matcher(code: &str, language: ScriptLanguage) {
    match MATCHER.find_matches(code, language) {
        Ok(matches) => {
            for matched in matches {
                assert!(!matched.rule_id.is_empty());
                assert!(!matched.reason.is_empty());
                assert!(matched.start <= matched.end);
                assert!(matched.end <= code.len());
                assert!(code.is_char_boundary(matched.start));
                assert!(code.is_char_boundary(matched.end));
                assert!(matched.line_number >= 1);
                assert!(!matched.severity.label().is_empty());
            }
        }
        Err(error) => {
            assert_expected_fail_open_error(error);
            let _ = MATCHER.has_blocking_match(code, language);
        }
    }

    assert!(
        MATCHER
            .has_blocking_match(code, ScriptLanguage::Unknown)
            .is_none()
    );

    if let Err(MatchError::Timeout { .. }) = ZERO_TIMEOUT_MATCHER.find_matches(code, language) {
        assert!(
            ZERO_TIMEOUT_MATCHER
                .has_blocking_match(code, language)
                .is_none()
        );
    }
}

fn assert_expected_fail_open_error(error: MatchError) {
    match error {
        MatchError::UnsupportedLanguage(_)
        | MatchError::ParseError { .. }
        | MatchError::Timeout { .. }
        | MatchError::PatternError { .. } => {}
    }
}

```

### Core Architecture Module: `fuzz/fuzz_targets/fuzz_context.rs`
```
//! Fuzz target for the context classifier (shell tokenizer).
//!
//! This fuzzes `classify_command` which parses shell syntax to identify
//! which parts are executed vs data. It tests for:
//! - Panics from malformed shell syntax
//! - Incorrect span bounds (out of range)
//! - Infinite loops in tokenizer

#![no_main]

use libfuzzer_sys::fuzz_target;

use destructive_command_guard::context::classify_command;

fuzz_target!(|data: &[u8]| {
    // Try to interpret as UTF-8
    if let Ok(command) = std::str::from_utf8(data) {
        // Skip extremely large inputs to avoid timeout
        if command.len() > 10_000 {
            return;
        }

        // Classify the command - this should never panic
        let spans = classify_command(command);

        // Validate invariants: all spans should be within bounds
        for span in spans.spans() {
            assert!(
                span.byte_range.start <= command.len(),
                "Span start {} exceeds command length {}",
                span.byte_range.start,
                command.len()
            );
            assert!(
                span.byte_range.end <= command.len(),
                "Span end {} exceeds command length {}",
                span.byte_range.end,
                command.len()
            );
            assert!(
                span.byte_range.start <= span.byte_range.end,
                "Span start {} > end {}",
                span.byte_range.start,
                span.byte_range.end
            );
        }
    }
});

```

### Core Architecture Module: `fuzz/fuzz_targets/fuzz_evaluate.rs`
```
//! Fuzz target for the main evaluator entry point.
//!
//! This fuzzes `evaluate_command` with arbitrary command strings to find:
//! - Panics from unexpected input
//! - Regex catastrophic backtracking
//! - Memory issues from adversarial input

#![no_main]

use libfuzzer_sys::fuzz_target;

use destructive_command_guard::LayeredAllowlist;
use destructive_command_guard::config::CompiledOverrides;
use destructive_command_guard::config::Config;
use destructive_command_guard::evaluator::evaluate_command;
use std::sync::LazyLock;

static EMPTY_ALLOWLISTS: LazyLock<LayeredAllowlist> = LazyLock::new(LayeredAllowlist::default);
static DEFAULT_CONFIG_AND_OVERRIDES: LazyLock<(Config, CompiledOverrides)> = LazyLock::new(|| {
    let config = Config::default();
    let compiled_overrides = config.overrides.compile();
    (config, compiled_overrides)
});

fuzz_target!(|data: &[u8]| {
    // Try to interpret the bytes as UTF-8
    if let Ok(command) = std::str::from_utf8(data) {
        // Skip extremely large inputs to avoid timeout (not a real bug)
        if command.len() > 10_000 {
            return;
        }

        // Use default config for consistent behavior (cached for fuzzing throughput).
        let (config, compiled_overrides) = &*DEFAULT_CONFIG_AND_OVERRIDES;
        let allowlists = &EMPTY_ALLOWLISTS;

        // Test with various keyword combinations
        let all_keywords = &[
            "git",
            "rm",
            "docker",
            "kubectl",
            "psql",
            "mysql",
            "mongosh",
            "redis-cli",
        ];

        // Evaluate - this should never panic
        let _ = evaluate_command(
            command,
            config,
            all_keywords,
            compiled_overrides,
            allowlists,
        );

        // Also test with empty keywords (triggers different code paths)
        let _ = evaluate_command(command, config, &[], compiled_overrides, allowlists);
    }
});

```

### Core Architecture Module: `fuzz/fuzz_targets/fuzz_heredoc_extract.rs`
```
//! Fuzz target for heredoc Tier 2 content extraction.
//!
//! This fuzzes `heredoc::extract_content` and validates:
//! - No panics for arbitrary UTF-8 input
//! - Extracted content is bounded by configured limits
//! - Tier 1 trigger is a superset of Tier 2 extraction (no false negatives)

#![no_main]

use destructive_command_guard::heredoc::{
    ExtractionLimits, ExtractionResult, TriggerResult, check_triggers, extract_content,
};
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    if let Ok(command) = std::str::from_utf8(data) {
        // Skip extremely large inputs to avoid timeouts (not a real bug).
        if command.len() > 10_000 {
            return;
        }

        let limits = ExtractionLimits {
            max_body_bytes: 10_000,
            max_body_lines: 1_000,
            max_heredocs: 5,
            timeout_ms: 20,
        };

        let result = extract_content(command, &limits);

        if let ExtractionResult::Extracted(contents) = result {
            // Tier 1 must be a superset: if Tier 2 extracted, Tier 1 must have triggered.
            assert_eq!(
                check_triggers(command),
                TriggerResult::Triggered,
                "Tier 2 extracted content but Tier 1 did not trigger for: {:?}",
                command
            );

            assert!(
                contents.len() <= limits.max_heredocs,
                "Extracted {} heredocs > max_heredocs {} for: {:?}",
                contents.len(),
                limits.max_heredocs,
                command
            );

            for item in contents {
                assert!(
                    item.content.len() <= limits.max_body_bytes,
                    "Extracted content exceeds max_body_bytes ({} > {})",
                    item.content.len(),
                    limits.max_body_bytes
                );

                let line_count = item.content.lines().count();
                assert!(
                    line_count <= limits.max_body_lines,
                    "Extracted content exceeds max_body_lines ({} > {})",
                    line_count,
                    limits.max_body_lines
                );

                assert!(
                    item.byte_range.start <= command.len(),
                    "byte_range.start {} exceeds command length {}",
                    item.byte_range.start,
                    command.len()
                );
                assert!(
                    item.byte_range.end <= command.len(),
                    "byte_range.end {} exceeds command length {}",
                    item.byte_range.end,
                    command.len()
                );
                assert!(
                    item.byte_range.start <= item.byte_range.end,
                    "byte_range.start {} > end {}",
                    item.byte_range.start,
                    item.byte_range.end
                );
                assert!(
                    command.is_char_boundary(item.byte_range.start),
                    "byte_range.start {} is not a char boundary",
                    item.byte_range.start
                );
                assert!(
                    command.is_char_boundary(item.byte_range.end),
                    "byte_range.end {} is not a char boundary",
                    item.byte_range.end
                );
            }
        }
    }
});

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

### Incident Patch 1: `6ba4a768` (2026-09-29)
**Commit Message**: fix(install): distro-built cosign (v3.1.3+dirty) skipped sigstore verification (GH #505)

cosign_version_is_patched (install.sh) and Test-DcgPatchedCosignVersion
(install.ps1) required a closing quote right after the patch number, so
any gitVersion with a suffix failed to parse and was reported as a cosign
missing the CVE-2026-22703 fixes. Arch's cosign 3.1.3 reports
`v3.1.3+dirty`, so verification was silently skipped there.

Both installers now parse the reported version as SemVer: optional `v`,
MAJOR.MINOR.PATCH, optional pre-release, optional build metadata. Build
metadata is ignored, as SemVer precedence requires. A pre-release still
precedes its release, so `v3.0.4-rc.1`, `v3.0.4-dirty` and git-describe
builds at the floor stay rejected; one counts only when its core version
is strictly above the floor. Anything unparseable is still rejected. When
`cosign version --json` gives no gitVersion, the plain-text `GitVersion:`
line is read instead, and the skip warning now shows what cosign reported.
install.ps1 also runs the version probes with ErrorActionPreference
Continue, so native stderr cannot abort it under Windows PowerShell 5.1.

Tests: bats and Pester-style cases for buil

**File**: `install.ps1` (modified, +56/-13)
```diff
@@ -1436,26 +1436,54 @@ function Invoke-DcgMinisignVerification {
   Write-Ok "Signature verified (minisign key $minisignKeyId)"
 }
 
-function Test-DcgPatchedCosignVersion {
-  # CVE-2026-22703 is repaired in 2.6.2 and 3.0.4. Reject unknown/development
-  # version strings rather than trusting a potentially vulnerable verifier.
-  param([string]$VersionJson)
+function Get-DcgCosignReportedVersion {
+  # The version string cosign reports: `gitVersion` from `cosign version
+  # --json`, or the `GitVersion:` line of the plain-text output. $null when
+  # neither is present.
+  param([string]$VersionOutput)
 
-  if ($VersionJson -notmatch '"gitVersion"\s*:\s*"v([0-9]+)\.([0-9]+)\.([0-9]+)"') {
+  if ($VersionOutput -match '"gitVersion"\s*:\s*"([^"]*)"') {
+    return $Matches[1]
+  }
+  if ($VersionOutput -match '(?m)^\s*GitVersion:\s*(\S+)\s*$') {
+    return $Matches[1]
+  }
+  return $null
+}
+
+function Test-DcgPatchedCosignVersion {
+  # CVE-2026-22703 is repaired in 2.6.2 and 3.0.4. The reported version is
+  # read as SemVer: optional `v`, MAJOR.MINOR.PATCH, optional `-pre.release`,
+  # optional `+build`. Build metadata does not affect precedence (distro
+  # builds report e.g. `v3.1.3+dirty`, GH #505) and is ignored. A pre-release
+  # precedes its release, so it counts only when its core version is strictly
+  # above the floor. Unknown/development strings are rejected rather than
+  # trusting a potentially vulnerable verifier.
+  param([string]$VersionOutput)
+
+  $reported = Get-DcgCosignReportedVersion -VersionOutput $VersionOutput
+  if (-not $reported) { return $false }
+  if ($reported -cnotmatch '^v?([0-9]{1,9})\.([0-9]{1,9})\.([0-9]{1,9})(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$') {
     return $false
   }
   $major = [int]$Matches[1]
   $minor = [int]$Matches[2]
   $patch = [int]$Matches[3]
+  $isPrerelease = [bool]$Matches[4]
 
   if ($major -gt 3) { return $true }
   if ($major -eq 3) {
-    return (($minor -gt 0) -or (($minor -eq 0) -and ($patch -ge 4)))
-  }
-  if ($major -eq 2) {
-    return (($minor -gt 6) -or (($minor -eq 6) -and ($patch -ge 2)))
+    $floorMinor = 0
+    $floorPatch = 4
+  } elseif ($major -eq 2) {
+    $floorMinor = 6
+    $floorPatch = 2
+  } else {
+    return $false
   }
-  return $false
+  if ($minor -ne $floorMinor) { return ($minor -gt $floorMinor) }
+  if ($isPrerelease) { return ($patch -gt $floorPatch) }
+  return ($patch -ge $floorPatch)
 }
 
 function Invoke-DcgSigstoreVerification {
@@ -1486,9 +1514,24 @@ function Invoke-DcgSigstoreVerification {
     return
   }
 
-  $versionJson = (& $cosign.Source version --json 2>&1 | Out-String)
-  if (($LASTEXITCODE -ne 0) -or (-not (Test-DcgPatchedCosignVersion -VersionJson $versionJson))) {
-    Write-Warn "cosign is missing required bundle-verification security fixes (need >=2.6.2 or >=3.0.4); skipping signature verification (checksum already verified)"
+  # Native stderr must not become a terminating error under Windows
+  # PowerShell 5.1; the exit code and the parsed version decide.
+  $savedErrorActionPreference = $ErrorActionPreference
+  try {
+    $ErrorActionPreference = "Continue"
+    $versionOutput = (& $cosign.Source version --json 2>&1 | Out-String)
+    if (($LASTEXITCODE -ne 0) -or (-not (Get-DcgCosignReportedVersion -VersionOutput $versionOutput))) {
+      # Builds without usable JSON still print a `GitVersion:` line.
+      $versionOutput = (& $cosign.Source version 2>&1 | Out-String)
+      if ($LASTEXITCODE -ne 0) { $versionOutput = "" }
+    }
+  } finally {
+    $ErrorActionPreference = $savedErrorActionPreference
+  }
+  if (-not (Test-DcgPatchedCosignVersion -VersionOutput $versionOutput)) {
+    $reportedVersion = Get-DcgCosignReportedVersion -VersionOutput $versionOutput
+    if (-not $reportedVersion) { $reportedVersion = "unknown" }
+    Write-Warn "cosign reports version '$reportedVersion', which is not a release known to carry the CVE-2026-22703 bundle-verification fixes (need >=2.6.2 or >=3.0.4); skippi
```

**File**: `install.sh` (modified, +56/-20)
```diff
@@ -1410,35 +1410,69 @@ verify_minisign_signature() {
   return 0
 }
 
+# Print the version string a cosign binary reports: `gitVersion` from
+# `cosign version --json`, or the `GitVersion:` line of the plain-text output
+# for builds whose JSON is missing or unusable. Prints nothing when neither
+# is present.
+cosign_reported_version() {
+  local cosign_bin="$1"
+  local output=""
+  local reported=""
+
+  output=$("$cosign_bin" version --json 2>/dev/null) || output=""
+  reported=$(printf '%s\n' "$output" |
+    sed -nE 's/.*"gitVersion"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/p' |
+    head -n 1) || true
+  if [ -z "$reported" ]; then
+    output=$("$cosign_bin" version 2>&1) || return 0
+    reported=$(printf '%s\n' "$output" |
+      sed -nE 's/^[[:space:]]*GitVersion:[[:space:]]*([^[:space:]]+)[[:space:]]*$/\1/p' |
+      head -n 1) || true
+  fi
+  printf '%s' "$reported"
+}
+
 # Return success only for cosign releases that contain the repaired bundle
 # verification logic from CVE-2026-22703 (>=2.6.2 or >=3.0.4).
+#
+# The version is read as SemVer: an optional `v`, MAJOR.MINOR.PATCH, an
+# optional `-pre.release`, and optional `+build` metadata. Build metadata has
+# no bearing on precedence (distro builds report e.g. `v3.1.3+dirty`, GH #505),
+# so it is ignored. A pre-release precedes its release, so `v3.0.4-rc.1` is
+# not patched; a pre-release (including git-describe `-N-gSHA` and `-dirty`
+# suffixes) counts only when its core version is strictly above the floor.
+# Anything that does not parse is rejected rather than trusted.
 cosign_version_is_patched() {
   local cosign_bin="$1"
-  local version_json=""
-  local version=""
-  local major=""
-  local minor=""
-  local patch=""
-
-  version_json=$("$cosign_bin" version --json 2>/dev/null) || return 1
-  version=$(printf '%s\n' "$version_json" |
-    sed -nE 's/.*"gitVersion"[[:space:]]*:[[:space:]]*"v([0-9]+)\.([0-9]+)\.([0-9]+)".*/\1.\2.\3/p' |
-    head -n 1)
-  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || return 1
-  IFS=. read -r major minor patch <<< "$version"
+  local reported=""
+  local semver_re='^v?([0-9]{1,9})\.([0-9]{1,9})\.([0-9]{1,9})(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'
+  local major=0
+  local minor=0
+  local patch=0
+  local prerelease=""
+  local floor_minor=0
+  local floor_patch=0
+
+  reported=$(cosign_reported_version "$cosign_bin")
+  [[ "$reported" =~ $semver_re ]] || return 1
+  major=$((10#${BASH_REMATCH[1]}))
+  minor=$((10#${BASH_REMATCH[2]}))
+  patch=$((10#${BASH_REMATCH[3]}))
+  prerelease="${BASH_REMATCH[4]}"
 
   if (( major > 3 )); then
     return 0
   fi
-  if (( major == 3 )); then
-    (( minor > 0 || (minor == 0 && patch >= 4) ))
-    return
-  fi
-  if (( major == 2 )); then
-    (( minor > 6 || (minor == 6 && patch >= 2) ))
+  case "$major" in
+    3) floor_minor=0; floor_patch=4 ;;
+    2) floor_minor=6; floor_patch=2 ;;
+    *) return 1 ;;
+  esac
+  if [ -n "$prerelease" ]; then
+    (( minor > floor_minor || (minor == floor_minor && patch > floor_patch) ))
     return
   fi
-  return 1
+  (( minor > floor_minor || (minor == floor_minor && patch >= floor_patch) ))
 }
 
 # Verify Sigstore/cosign bundle for a file (best-effort).
@@ -1469,7 +1503,9 @@ verify_sigstore_bundle() {
   fi
 
   if ! cosign_version_is_patched "$cosign_bin"; then
-    warn "cosign is missing required bundle-verification security fixes (need >=2.6.2 or >=3.0.4); skipping signature verification (checksum already verified)"
+    local reported_version=""
+    reported_version=$(cosign_reported_version "$cosign_bin")
+    warn "cosign reports version '${reported_version:-unknown}', which is not a release known to carry the CVE-2026-22703 bundle-verification fixes (need >=2.6.2 or >=3.0.4); skipping signature verification (checksum already verified)"
     return 0
   fi
 
```

**File**: `tests/install/install_test.bats` (modified, +97/-14)
```diff
@@ -320,27 +320,110 @@ printf '{"gitVersion":"%s"}\n' "$MOCK_COSIGN_VERSION"
 MOCKEOF
     chmod +x "$mock_cosign"
 
-    export MOCK_COSIGN_VERSION="v2.6.1"
+    # version|expected status (0 = patched)
+    local cases=(
+        "v2.6.1|1"
+        "v2.6.2|0"
+        "v3.0.3|1"
+        "v3.0.4|0"
+        "v3.1.2|0"
+        "v3.0.4-rc.1|1"
+        "v2.6.2-rc.1|1"
+        "devel|1"
+        "v3.1.3+dirty|0"
+        "v3.0.4+dirty|0"
+        "v3.0.3+dirty|1"
+        "3.1.3|0"
+        "v3.1.3-dirty|0"
+        "v3.0.4-dirty|1"
+        "v3.0.4-3-gabc1234|1"
+        "v3.1.0-rc.1+build.5|0"
+        "v2.6.10|0"
+        "v2.08.0|0"
+        "v4.0.0-rc.1|0"
+        "v1.13.9|1"
+        "v3.1|1"
+        "v3.1.3 junk|1"
+        "|1"
+    )
+    local entry version expected
+    for entry in "${cases[@]}"; do
+        version="${entry%|*}"
+        expected="${entry##*|}"
+        export MOCK_COSIGN_VERSION="$version"
+        run cosign_version_is_patched "$mock_cosign"
+        if [ "$expected" -eq 0 ]; then
+            [ "$status" -eq 0 ] || { echo "expected '$version' to count as patched"; return 1; }
+        else
+            [ "$status" -ne 0 ] || { echo "expected '$version' to be rejected"; return 1; }
+        fi
+    done
+}
+
+@test "cosign_version_is_patched: reads pretty JSON and the plain-text GitVersion line (GH #505)" {
+    local mock_cosign="$TEST_TMPDIR/bin/cosign"
+    cat > "$mock_cosign" << 'MOCKEOF'
+#!/bin/bash
+if [ "${2:-}" = "--json" ]; then
+  [ "$MOCK_COSIGN_JSON" = 0 ] && exit 1
+  printf '{\n  "gitVersion": "%s",\n  "gitTreeState": "dirty"\n}\n' "$MOCK_COSIGN_VERSION"
+  exit 0
+fi
+printf '  ______\nGitVersion:    %s\nGitCommit:     11926fa\n' "$MOCK_COSIGN_VERSION"
+MOCKEOF
+    chmod +x "$mock_cosign"
+
+    export MOCK_COSIGN_VERSION="v3.1.3+dirty"
+    export MOCK_COSIGN_JSON=1
     run cosign_version_is_patched "$mock_cosign"
-    [ "$status" -ne 0 ]
-    MOCK_COSIGN_VERSION="v2.6.2"
+    [ "$status" -eq 0 ]
+    MOCK_COSIGN_JSON=0
     run cosign_version_is_patched "$mock_cosign"
     [ "$status" -eq 0 ]
-    MOCK_COSIGN_VERSION="v3.0.3"
+    MOCK_COSIGN_VERSION="v3.0.3+dirty"
     run cosign_version_is_patched "$mock_cosign"
     [ "$status" -ne 0 ]
-    MOCK_COSIGN_VERSION="v3.0.4"
-    run cosign_version_is_patched "$mock_cosign"
+}
+
+@test "verify_sigstore_bundle: a distro cosign build verifies instead of being skipped (GH #505)" {
+    TMP="$TEST_TMPDIR/sigstore-work"
+    mkdir -p "$TMP"
+    local artifact="$TMP/dcg.tar.xz"
+    local bundle="$TEST_TMPDIR/release.sigstore.json"
+    printf 'artifact' > "$artifact"
+    printf '{}' > "$bundle"
+    export COSIGN_ARGS_FILE="$TMP/cosign.args"
+    cat > "$TEST_TMPDIR/bin/cosign" << 'MOCKEOF'
+#!/bin/bash
+if [ "${1:-}" = "version" ]; then
+  printf '{"gitVersion":"%s"}\n' "$MOCK_COSIGN_VERSION"
+  exit 0
+fi
+if [ "${1:-}" = "verify-blob" ] && [ "${2:-}" = "--help" ]; then
+  printf '%s\n' 'Usage: cosign verify-blob --bundle FILE --key FILE'
+  exit 0
+fi
+printf '%s\n' "$@" > "$COSIGN_ARGS_FILE"
+case " $* " in
+  *" --key "*) exit 0 ;;
+  *) exit 1 ;;
+esac
+MOCKEOF
+    chmod +x "$TEST_TMPDIR/bin/cosign"
+    SIGSTORE_BUNDLE_URL="file://$bundle"
+
+    export MOCK_COSIGN_VERSION="v3.1.3+dirty"
+    run verify_sigstore_bundle "$artifact" "https://example.invalid/dcg.tar.xz"
     [ "$status" -eq 0 ]
-    MOCK_COSIGN_VERSION="v3.1.2"
-    run cosign_version_is_patched "$mock_cosign"
+    [[ "$output" == *"cosign local release key"* ]]
+    grep -Fxq -- "--key" "$COSIGN_ARGS_FILE"
+
+    rm -f "$COSIGN_ARGS_FILE"
+    MOCK_COSIGN_VERSION="v3.0.3+dirty"
+    run verify_sigstore_bundle "$artifact" "https://example.invalid/dcg.tar.xz"
     [ "$status" -eq 0 ]
-    MOCK_COSIGN_VERSION="v3.0.4-rc.1"
-    run cosign_version_is_patched "$mock_cosign"
-    [ "$status" -ne 0 ]
-    MOCK_COSIGN_VERSION="devel"
-    run cosign_version_is_patched "$mock_cosign"
-    [ "$status" -ne 0 ]
+    [[ "$output" == *"cosign reports version 'v3.0.3+di
```

**File**: `tests/installer/checksum_test.ps1` (modified, +89/-14)
```diff
@@ -131,20 +131,38 @@ try {
         "uses the retired key only for v0.6.7"
 
     Write-Host "Test 11: patched cosign version floors reject vulnerable builds"
-    Check (-not (Test-DcgPatchedCosignVersion -VersionJson '{"gitVersion":"v2.6.1"}')) `
-        "rejects cosign 2.6.1"
-    Check (Test-DcgPatchedCosignVersion -VersionJson '{"gitVersion":"v2.6.2"}') `
-        "accepts cosign 2.6.2"
-    Check (-not (Test-DcgPatchedCosignVersion -VersionJson '{"gitVersion":"v3.0.3"}')) `
-        "rejects cosign 3.0.3"
-    Check (Test-DcgPatchedCosignVersion -VersionJson '{"gitVersion":"v3.0.4"}') `
-        "accepts cosign 3.0.4"
-    Check (Test-DcgPatchedCosignVersion -VersionJson '{"gitVersion":"v3.1.2"}') `
-        "accepts newer cosign 3.x"
-    Check (-not (Test-DcgPatchedCosignVersion -VersionJson '{"gitVersion":"v3.0.4-rc.1"}')) `
-        "rejects prerelease builds at the patched floor"
-    Check (-not (Test-DcgPatchedCosignVersion -VersionJson '{"gitVersion":"devel"}')) `
-        "rejects unknown development builds"
+    $cosignCases = @(
+        @('v2.6.1', $false, 'rejects cosign 2.6.1'),
+        @('v2.6.2', $true, 'accepts cosign 2.6.2'),
+        @('v3.0.3', $false, 'rejects cosign 3.0.3'),
+        @('v3.0.4', $true, 'accepts cosign 3.0.4'),
+        @('v3.1.2', $true, 'accepts newer cosign 3.x'),
+        @('v3.0.4-rc.1', $false, 'rejects prerelease builds at the patched floor'),
+        @('v2.6.2-rc.1', $false, 'rejects a 2.x prerelease at the patched floor'),
+        @('devel', $false, 'rejects unknown development builds'),
+        @('v3.1.3+dirty', $true, 'accepts distro build metadata above the floor (GH #505)'),
+        @('v3.0.4+dirty', $true, 'build metadata does not lower the floor release'),
+        @('v3.0.3+dirty', $false, 'build metadata does not raise a vulnerable release'),
+        @('3.1.3', $true, 'accepts a version without the v prefix'),
+        @('v3.1.3-dirty', $true, 'accepts a git-describe dirty suffix above the floor'),
+        @('v3.0.4-dirty', $false, 'rejects a dirty suffix at the floor'),
+        @('v3.0.4-3-gabc1234', $false, 'rejects git-describe builds at the floor'),
+        @('v3.1.0-rc.1+build.5', $true, 'accepts a prerelease whose core is above the floor'),
+        @('v2.6.10', $true, 'compares numerically, not lexically'),
+        @('v4.0.0-rc.1', $true, 'accepts a future major prerelease'),
+        @('v1.13.9', $false, 'rejects cosign 1.x'),
+        @('v3.1', $false, 'rejects a truncated version'),
+        @('v3.1.3 junk', $false, 'rejects trailing junk')
+    )
+    foreach ($case in $cosignCases) {
+        $json = '{"gitVersion":"' + $case[0] + '"}'
+        Check ((Test-DcgPatchedCosignVersion -VersionOutput $json) -eq $case[1]) "$($case[2]) [$($case[0])]"
+    }
+    $prettyJson = "{`n  ""gitVersion"": ""v3.1.3+dirty"",`n  ""gitTreeState"": ""dirty""`n}"
+    Check (Test-DcgPatchedCosignVersion -VersionOutput $prettyJson) "reads pretty-printed JSON"
+    $textOutput = "  ______   ______.   _______.`nGitVersion:    v3.1.3+dirty`nGitCommit:     11926fa`n"
+    Check (Test-DcgPatchedCosignVersion -VersionOutput $textOutput) "reads the plain-text GitVersion line"
+    Check (-not (Test-DcgPatchedCosignVersion -VersionOutput "")) "rejects empty output"
 
     Write-Host "Test 12: a present invalid minisign signature is always fatal"
     Set-MinisignApplicationMock -Directory $mockBin -ExitCode 1 | Out-Null
@@ -165,6 +183,63 @@ try {
             -SignatureSource $signature -TempDirectory $tmp -Require
     } catch { $shimThrew = $true }
     Check $shimThrew "function shim cannot satisfy -RequireMinisign"
+
+    Write-Host "Test 14: a distro cosign build is used for bundle verification (GH #505)"
+    if ($env:OS -eq 'Windows_NT') {
+        Write-Host "  skip: the mock cosign is a POSIX shell script"
+    } else {
+        $env:PATH = $savedPath
+        $cosignBin = Join-Path $tmp "cosign-bin"
+        New-Item -ItemType Directory -Path $cosignBin | Out-Nul
```

---

### Incident Patch 2: `38de715e` (2026-09-29)
**Commit Message**: fix(omp): a command whose cwd does not exist got no verdict (GH #504)

The generated OMP bridge spawned dcg in the command's cwd. When that
directory was missing, Bun's posix_spawn threw ENOENT naming the dcg
binary, and the catch logged it and returned with no verdict, no audit
record, and no regard for DCG_UNVERIFIED_DECISION=deny.

The bridge now starts dcg from the nearest existing ancestor of the
command's cwd (dcg's own directory as a last resort), so the same project
config, allowlists and Git branch apply, and passes the real cwd as a
hidden `--command-cwd=` argument. `dcg test` judges directory-scoped
allowlist entries against that reported cwd and, as the hook does for an
unusable payload cwd (#387), leaves them inapplicable when it is not an
existing absolute directory, so a grant for the ancestor is never
borrowed. Robot history records the reported cwd.

A spawn failure now reads the transition table's spawn-throw row, logs an
infrastructure diagnostic that names the binary and both directories, and
blocks when DCG_UNVERIFIED_DECISION=deny; the same posture applies to the
other verdict-less infrastructure outcomes (unexpected exit, signal).
Without it the #346 fail-ope

**File**: `README.md` (modified, +1/-0)
```diff
@@ -901,6 +901,7 @@ an oversized extracted command as proof that execution is safe.
 | Extracted command exceeds `max_command_bytes` | Explicit indeterminate result | Review-capable clients receive `ask` (`unverified_decision = "deny"` turns this into a deny); other clients block |
 | Absolute evaluation deadline expires | Explicit indeterminate result | Review-capable clients receive `ask` (`unverified_decision = "deny"` turns this into a deny); other clients block |
 | Heredoc extraction/parse/AST failure | Run the bounded fallback scanner | `fallback_on_parse_error = false` or `fallback_on_timeout = false` blocks |
+| Oh My Pi bridge gets no verdict (dcg cannot start, crashes, or is killed) | Allow with a visible `infrastructure failure` diagnostic | `DCG_UNVERIFIED_DECISION=deny` in OMP's environment blocks; the config-file setting cannot apply because dcg never read it |
 
 **Configurable Strictness**:
 
```

**File**: `src/cli.rs` (modified, +227/-24)
```diff
@@ -568,6 +568,14 @@ pub enum Command {
         /// replacement for `dcg test --format json`.
         #[arg(long, hide = true)]
         omp_bridge_output: bool,
+
+        /// The working directory the host reported for the command, when the
+        /// generated OMP bridge had to start dcg somewhere else because that
+        /// directory does not exist (#504). Directory-scoped allowlist entries
+        /// are judged against this path, never against dcg's own cwd. Internal
+        /// to the OMP bridge protocol.
+        #[arg(long, hide = true, value_name = "PATH", requires = "omp_bridge_output")]
+        command_cwd: Option<std::path::PathBuf>,
     },
 
     /// Generate a sample configuration file
@@ -2555,6 +2563,7 @@ pub fn run_command(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
             force,
             dialect,
             omp_bridge_output,
+            command_cwd,
         }) => {
             // Robot mode forces JSON output
             let robot_mode = robot_mode_enabled(cli.robot);
@@ -2622,6 +2631,7 @@ pub fn run_command(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
                     force,
                     dialect,
                     omp_bridge_output,
+                    command_cwd.as_deref(),
                 );
                 // Exit with code 1 if command would be blocked (for CI/robot mode scripting)
                 if was_blocked {
@@ -5054,6 +5064,7 @@ fn test_command(
     force: bool,
     dialect: DialectArg,
     omp_bridge_output: bool,
+    command_cwd: Option<&std::path::Path>,
 ) -> bool {
     use std::time::{Duration, Instant};
 
@@ -5167,8 +5178,19 @@ fn test_command(
         REGISTRY.build_enabled_keyword_index(&ordered_packs)
     };
 
-    // Use shared evaluator for consistent behavior with hook mode
-    let project_path = std::env::current_dir().ok();
+    // Use shared evaluator for consistent behavior with hook mode.
+    //
+    // A host-reported command cwd (the OMP bridge, #504) is the directory the
+    // command runs in; dcg's own cwd is only where it could be started. As in
+    // hook mode (#387), a reported cwd that is not an absolute directory
+    // leaves directory-scoped allowlist entries inapplicable rather than
+    // judging them against an unrelated directory.
+    let project_path = match command_cwd {
+        Some(reported) => Some(reported)
+            .filter(|path| path.is_absolute() && path.is_dir())
+            .map(std::path::Path::to_path_buf),
+        None => std::env::current_dir().ok(),
+    };
     let start = Instant::now();
     let evaluate = |command: &str, allowlists: &crate::allowlist::LayeredAllowlist| {
         evaluate_command_with_pack_order_deadline_at_path_in_dialect(
@@ -5222,7 +5244,9 @@ fn test_command(
     // drop wait by the same remaining deadline that governs the robot reply.
     let _robot_history_writer =
         if should_record_robot_history(robot_mode, effective_config.history.enabled) {
-            let working_dir = project_path.as_ref().map_or_else(
+            // Record where the command was going to run, even when that
+            // directory does not exist and so cannot scope anything.
+            let working_dir = command_cwd.or(project_path.as_deref()).map_or_else(
                 || "<unknown>".to_string(),
                 |path| path.to_string_lossy().into_owned(),
             );
@@ -15582,7 +15606,10 @@ fn project_omp_extension_path() -> std::io::Result<std::path::PathBuf> {
 /// dcg's robot-mode evaluator. The command is sent on stdin and dcg is spawned
 /// directly (never through a shell). A deny-like JSON verdict or exit 1 is a
 /// safety block; status-only infrastructure failures fail open with a visible
-/// diagnostic, consistent with dcg's other generated integration bridges. A
+/// diagnostic, consistent with dcg's other generated integration bridges,
+/// unless `DCG_UNVERIFIED_DECISION=deny` asks for a block. A cwd that does not
+/// exist 
```

**File**: `tests/repro_504_omp_bridge_missing_cwd.rs` (added, +453/-0)
```diff
@@ -0,0 +1,453 @@
+//! #504: the OMP bridge produced no verdict when the tool call's cwd did not
+//! exist.
+//!
+//! The generated bridge spawned dcg *in* the command's cwd. When that directory
+//! was missing, Bun's `posix_spawn` threw ENOENT naming the dcg binary, the
+//! bridge logged it and returned with no verdict, and a configured
+//! `DCG_UNVERIFIED_DECISION=deny` was never consulted.
+//!
+//! These tests drive the bridge the way OMP does: `dcg install --omp` writes the
+//! extension into a scratch HOME, Bun imports it, and its `tool_call` handler is
+//! called with the real `Bun.spawn` and the real dcg binary. Only the four OMP
+//! helper imports are stubbed. Without Bun the bridge tests SKIP; the CLI half
+//! of the contract (`--command-cwd`) is checked directly either way.
+
+use std::fs;
+use std::path::{Path, PathBuf};
+use std::process::{Command, Stdio};
+
+use serde_json::{Value, json};
+
+const RESET: &str = "git reset --hard";
+const RESET_RULE: &str = "core.git:reset-hard";
+
+fn dcg_binary() -> PathBuf {
+    PathBuf::from(env!("CARGO_BIN_EXE_dcg"))
+}
+
+/// A scratch HOME plus a project directory holding a directory-scoped grant.
+struct Fixture {
+    _temp: tempfile::TempDir,
+    root: PathBuf,
+    home: PathBuf,
+    xdg_config: PathBuf,
+    project: PathBuf,
+}
+
+impl Fixture {
+    fn new() -> Self {
+        let temp = tempfile::tempdir().expect("temp dir");
+        // macOS temp dirs sit under a symlinked /var; compare real paths.
+        let root = temp.path().canonicalize().expect("canonical temp root");
+        let home = root.join("home");
+        let xdg_config = home.join(".config");
+        let project = root.join("project");
+        for dir in [&home, &project, &xdg_config.join("dcg")] {
+            fs::create_dir_all(dir).expect("create fixture dir");
+        }
+        // Granted for the project directory itself and nothing below it. A
+        // command whose cwd is a missing child of the project must not borrow
+        // this grant just because dcg had to be started in the project.
+        let scope = project.to_string_lossy();
+        fs::write(
+            xdg_config.join("dcg").join("allowlist.toml"),
+            format!(
+                "[[allow]]\nrule = \"{RESET_RULE}\"\nreason = \"repro 504\"\nadded_by = \"test\"\n\
+                 added_at = \"2026-01-01T00:00:00Z\"\npaths = ['{scope}']\n"
+            ),
+        )
+        .expect("write allowlist");
+        Self {
+            _temp: temp,
+            root,
+            home,
+            xdg_config,
+            project,
+        }
+    }
+
+    /// Environment for every dcg and Bun child: the scratch HOME, no ambient
+    /// `DCG_*` from the operator, and no hook self-repair.
+    fn apply_env(&self, command: &mut Command) {
+        for (key, _) in std::env::vars_os() {
+            if key.to_string_lossy().starts_with("DCG_") {
+                command.env_remove(key);
+            }
+        }
+        // An operator's OMP profile would redirect where the extension lands.
+        for key in [
+            "OMP_PROFILE",
+            "PI_PROFILE",
+            "PI_CONFIG_DIR",
+            "PI_CODING_AGENT_DIR",
+            "PI_NO_PTY",
+        ] {
+            command.env_remove(key);
+        }
+        command
+            .env("HOME", &self.home)
+            .env("USERPROFILE", &self.home)
+            .env("XDG_CONFIG_HOME", &self.xdg_config)
+            .env("DCG_SELF_HEAL_HOOK", "0")
+            .env("NO_COLOR", "1");
+    }
+
+    /// Run the private OMP robot protocol directly, from `process_cwd`.
+    fn run_bridge_protocol(&self, process_cwd: &Path, extra: &[&str]) -> std::process::Output {
+        let mut command = Command::new(dcg_binary());
+        self.apply_env(&mut command);
+        command
+            .args([
+                "--robot",
+                "test",
+                "--stdin",
+                "--agent",
+                "omp",
+                "--di
```

---

### Incident Patch 3: `036428ec` (2026-09-29)
**Commit Message**: fix(heredoc): Windows wrappers and here-strings behind a redirect still hid the payload (review of 6c3a7e6, GH #498)

Seventh review, through release builds of v0.14.4, cbf14e4 and 6c3a7e6
on the real Claude hook. Each row below was allowed on all three:

- `powershell 2>&1 -EncodedCommand <b64>`, `cmd 2>nul /c "…"` and
  `cmd >nul /c …`. 6c3a7e6 made the tier-1 set and the POSIX inline
  patterns read the redirect-blanked view, so tier 1 now triggered on
  these, but the Windows extractor (cmd /c, iex, Start-Process,
  -EncodedCommand) still matched only the raw command. It now reads both
  views, takes payload text from the command by range, and reads a payload
  both views find once. (`pwsh 2>$null -EncodedCommand …` was denied only
  by the dynamic-redirect rule on `$null`, not by reading the payload.)
- `sh <<<x -c '…'`: a here-string is a redirect, and bash runs the `-c`
  string after it; the view left `<<<word` alone.
- A redirect target holding `$(…)`, backquotes or `${…}` with blanks
  (`sh 2>$(mktemp -u) -c '…'`) ended at the `(` or the blank, so the rest
  of the target stayed between the shell and `-c`.

Tests: windows_wrappers_and_here_strings_behind_redirects_are_jud

**File**: `CHANGELOG.md` (modified, +4/-1)
```diff
@@ -222,7 +222,10 @@ Work on `main` after the v0.14.4 tag. Nothing here is in a published binary yet.
   string right after it, so the payload ran unjudged (since before v0.14.4;
   `python3 2>/dev/null -c '…'` too). The same `&>`, `>|` and `{fd}>`
   redirects, `wat$'c'h`, and a process substitution inside a word
-  (`--x=<(watch '…')`) still hid a command-string runner's payload.
+  (`--x=<(watch '…')`) still hid a command-string runner's payload. So did
+  a here-string before `-c` (`sh <<<x -c '…'`), and a redirect between a
+  Windows wrapper and its flag (`powershell 2>&1 -EncodedCommand …`,
+  `cmd 2>nul /c …`).
 
 - **A pipeline of thousands of stages, or a run of unclosed `[`, held the hook
   past its deadline.** tree-sitter-bash parses one long pipeline in
```

**File**: `src/heredoc.rs` (modified, +98/-14)
```diff
@@ -567,9 +567,12 @@ pub fn matched_triggers(command: &str) -> Vec<usize> {
 /// A redirect word starts a word (or follows one directly, operator first):
 /// optional descriptor digits or `{name}`, then `>`, `<`, `>>`, `<>`, `>|`,
 /// `>&`, `<&`, `&>` or `&>>`, then its target, glued or after blanks
-/// (`2> /dev/null`, `2>& 1`). A heredoc (`<<`), a process substitution (`<(`)
-/// and a word without a target are left alone. Text inside quotes is never
-/// taken for a redirect, so a quoted payload reads the same in both. Length
+/// (`2> /dev/null`, `2>& 1`). A here-string (`<<<word`) is a redirect too
+/// (`sh <<<x -c '<cmd>'` runs `<cmd>`); a heredoc (`<<`), a process
+/// substitution (`<(`) and a word without a target are left alone. A target's
+/// `$(…)`, `${…}` and backquoted parts belong to it (`2>$(mktemp) -c`). Text
+/// inside quotes is never taken for a redirect, so a quoted payload reads the
+/// same in both. Length
 /// preserving (every blanked byte becomes a space, so the view stays UTF-8
 /// and every range in it is the same range in `command`); linear.
 fn blank_local_redirects(command: &str) -> Option<String> {
@@ -644,7 +647,7 @@ fn local_redirect_word_end(bytes: &[u8], start: usize) -> Option<usize> {
         }
     }
     let rest = &bytes[index..];
-    let operator = if rest.starts_with(b"&>>") {
+    let operator = if rest.starts_with(b"&>>") || rest.starts_with(b"<<<") {
         3
     } else if rest.starts_with(b"&>")
         || rest.starts_with(b">>")
@@ -660,7 +663,7 @@ fn local_redirect_word_end(bytes: &[u8], start: usize) -> Option<usize> {
         return None;
     };
     if matches!(rest.get(operator), Some(b'(' | b'<')) {
-        // `<(…)`/`>(…)`, `<<`, `<<<`, `>>(…)`: not a plain redirect.
+        // `<(…)`/`>(…)`, `<<`, `<<<<`, `>>(…)`: not a plain redirect.
         return None;
     }
     index += operator;
@@ -674,6 +677,13 @@ fn local_redirect_word_end(bytes: &[u8], start: usize) -> Option<usize> {
             b'\\' => (index + 2).min(len),
             b'\'' => memchr(b'\'', &bytes[index + 1..]).map_or(len, |at| index + 2 + at),
             b'"' => skip_double_quoted(bytes, index + 1),
+            b'`' => memchr(b'`', &bytes[index + 1..]).map_or(len, |at| index + 2 + at),
+            b'$' if bytes.get(index + 1) == Some(&b'(') => {
+                crate::normalize::consume_shell_paren_construct(bytes, index + 2, len)
+            }
+            b'$' if bytes.get(index + 1) == Some(&b'{') => {
+                memchr(b'}', &bytes[index + 2..]).map_or(len, |at| index + 3 + at)
+            }
             _ => index + 1,
         };
     }
@@ -2100,8 +2110,18 @@ fn extract_windows_inline_scripts(
         return;
     }
 
+    // Each pattern also reads the redirect view (`pwsh 2>$null -enc …`,
+    // `cmd 2>nul /c …`; see `blank_local_redirects`). The view is length
+    // preserving, so payload text is taken from `command` by range and a
+    // payload both readings find is read once.
+    let redirect_view = blank_local_redirects(command);
+    let views: Vec<&str> = std::iter::once(command)
+        .chain(redirect_view.as_deref())
+        .collect();
+    let text = |m: regex::Match<'_>| command.get(m.start()..m.end()).unwrap_or("");
+
     // cmd /c | /k  (double-quoted, single-quoted, or unquoted rest-of-line)
-    for cap in CMD_INLINE_SCRIPT.captures_iter(command) {
+    for cap in windows_view_captures(&CMD_INLINE_SCRIPT, &views, &[1, 2, 3]) {
         if record_timeout_if_needed(start_time, timeout, limits.timeout_ms, skip_reasons) {
             return;
         }
@@ -2111,7 +2131,7 @@ fn extract_windows_inline_scripts(
                 extracted,
                 skip_reasons,
                 limits,
-                m.as_str(),
+                text(m),
                 full.start()..full.end(),
                 Some(m.start()..m.end()),
                 "cmd",
@@ -2122,7 +2142,7 @@ fn extract_windows_inline_scripts(
     }
 
     // iex / Invoke-Expr
```

**File**: `tests/repro_498_warn_masks_later_deny.rs` (modified, +30/-0)
```diff
@@ -702,3 +702,33 @@ fn shell_command_strings_behind_redirects_and_options_are_judged() {
         assert!(!lab.claude_hook_denies(command), "{command:?}");
     }
 }
+
+/// Seventh review: the Windows wrappers did not read the redirect view the
+/// sixth review added for `sh -c`, so `powershell 2>&1 -EncodedCommand …`
+/// and `cmd 2>nul /c …` still hid their payloads; a here-string
+/// (`sh <<<x -c …`) was not taken for a redirect either.
+#[test]
+fn windows_wrappers_and_here_strings_behind_redirects_are_judged() {
+    let lab = Lab::new(DEFAULTS);
+    // "git reset --hard" and "Get-Date" as base64 UTF-16LE.
+    let reset = "ZwBpAHQAIAByAGUAcwBlAHQAIAAtAC0AaABhAHIAZAA=";
+    let date = "RwBlAHQALQBEAGEAdABlAA==";
+    for command in [
+        format!("powershell 2>&1 -EncodedCommand {reset}"),
+        "cmd 2>nul /c \"git reset --hard\"".to_string(),
+        "cmd >nul /c git reset --hard".to_string(),
+        "sh <<<x -c 'git reset --hard'".to_string(),
+        "bash <<<'a b' -c 'git reset --hard'".to_string(),
+    ] {
+        assert!(lab.claude_hook_denies(&command), "{command:?}");
+    }
+    for command in [
+        format!("powershell 2>&1 -EncodedCommand {date}"),
+        "cmd 2>nul /c \"dir\"".to_string(),
+        "cmd /c dir 2>nul".to_string(),
+        "sh <<<x -c 'ls'".to_string(),
+        "cat <<<'sh 2>/dev/null -c git reset --hard'".to_string(),
+    ] {
+        assert!(!lab.claude_hook_denies(&command), "{command:?}");
+    }
+}
```

---

### Incident Patch 4: `6c3a7e6b` (2026-09-29)
**Commit Message**: fix(heredoc): shell command strings behind redirects and options, and runner payloads behind &>, >|, {fd}> and mid-word process substitution, ran unjudged (review of 74fa8a6/cbf14e4, GH #498)

Sixth review, through release builds of cbf14e4 on the real Claude hook.
Every row below was allowed on cbf14e4:

- A redirect before or after a shell's `-c`, or an option between `-c`
  and the command string: `sh 2>/dev/null -c '…'`, `sh 2>&1 -c '…'`,
  `bash &>/dev/null -c '…'`, `zsh >|f -c '…'`, `dash {fd}>f -c '…'`,
  `busybox sh 2>/dev/null -c '…'`, `sh>/dev/null -c '…'`,
  `sh -c 2>/dev/null '…'`, `sh -c -- '…'`, `sh -c - '…'`,
  `bash -c -e '…'`, `bash -c -o errexit '…'`, `bash +e -c '…'`, and the
  `$CMD` forms. The inline-script patterns expected options before `-c` and
  the quoted string right after it; the shell removes a redirect wherever it
  stands and takes its first operand as the command string (bash, dash, zsh
  and busybox sh checked). This gap predates v0.14.4, and
  `python3 2>/dev/null -c '…'` had it too.

  The tier-1 set and the tier-2 inline patterns now also read a view of
  the command whose unquoted redirect words are blank-filled (length
  preserving, quoted tex

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -215,6 +215,15 @@ Work on `main` after the v0.14.4 tag. Nothing here is in a published binary yet.
 
 ### Fixed
 
+- **A redirect or an option around a shell's `-c` hid the command string.**
+  `sh 2>/dev/null -c '…'`, `bash &>log -c '…'`, `sh -c 2>/dev/null '…'`,
+  `sh -c -- '…'`, `bash -c -e '…'` and `bash +e -c '…'` all run `…`, but the
+  inline-script reader expected the options before `-c` and the command
+  string right after it, so the payload ran unjudged (since before v0.14.4;
+  `python3 2>/dev/null -c '…'` too). The same `&>`, `>|` and `{fd}>`
+  redirects, `wat$'c'h`, and a process substitution inside a word
+  (`--x=<(watch '…')`) still hid a command-string runner's payload.
+
 - **A pipeline of thousands of stages, or a run of unclosed `[`, held the hook
   past its deadline.** tree-sitter-bash parses one long pipeline in
   superlinear time, so `x | env | … | env -S 'ls'` (60 KB) answered `ask`
```

**File**: `src/heredoc.rs` (modified, +482/-42)
```diff
@@ -49,6 +49,16 @@ use std::sync::LazyLock;
 use std::time::{Duration, Instant};
 use tracing::{debug, instrument, trace, warn};
 
+/// Options a POSIX shell accepts after `-c` and before the command string:
+/// `bash -c -e '<cmd>'`, `sh -c -- '<cmd>'`, `sh -c - '<cmd>'`,
+/// `bash -c -o errexit '<cmd>'`, `bash -c +e '<cmd>'`. The first operand is
+/// the command string, not the first word after the flag.
+macro_rules! shell_option_after_c_re {
+    () => {
+        r"(?:[-+][oO]\s+[A-Za-z_]+|[-+][A-Za-z]+|--?)"
+    };
+}
+
 /// Tier 1 trigger patterns for heredoc and inline script detection.
 ///
 /// These patterns are designed for maximum recall (zero false negatives).
@@ -127,7 +137,7 @@ const HEREDOC_TRIGGER_PATTERNS: [&str; 30] = [
     // dash/ksh/mksh are ordinary POSIX shells: without them `dash -c "git
     // reset --hard"` was never unwrapped, and command-position rules such as
     // core.git never saw the payload.
-    r#"\b(?:sh|bash|zsh|fish|dash|ksh[0-9]*|mksh)(?:\.exe)?\b(?:\s+(?:--\S+|-[A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+-[A-Za-z]*c[A-Za-z]*(?:\s|['"]|$)"#,
+    r#"\b(?:sh|bash|zsh|fish|dash|ksh[0-9]*|mksh)(?:\.exe)?\b(?:\s+(?:--\S+|[-+][A-Za-z]+(?:[:.=]\S*)?)(?:\s+(?:[0-9]\S*|\S*[:/\\]\S*|[A-Za-z][A-Za-z0-9_]*))?)*\s+-[A-Za-z]*c[A-Za-z]*(?:\s|['"]|$)"#,
     // PowerShell inline execution (powershell -Command '...', pwsh -c "...",
     // and Windows full-path forms like
     //   "C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe" -Command '...'
@@ -515,6 +525,7 @@ pub fn check_triggers(command: &str) -> TriggerResult {
     if contains_active_heredoc_operator(command)
         || HEREDOC_TRIGGERS.is_match(command)
         || names_a_runner_through_quoting(command)
+        || blank_local_redirects(command).is_some_and(|view| HEREDOC_TRIGGERS.is_match(&view))
     {
         debug!("tier1_trigger: heredoc/inline script indicator detected");
         TriggerResult::Triggered
@@ -530,37 +541,180 @@ pub fn check_triggers(command: &str) -> TriggerResult {
 #[must_use]
 pub fn matched_triggers(command: &str) -> Vec<usize> {
     let mut matches: Vec<usize> = HEREDOC_TRIGGERS.matches(command).into_iter().collect();
+    if let Some(view) = blank_local_redirects(command) {
+        for index in &HEREDOC_TRIGGERS.matches(&view) {
+            if !matches.contains(&index) {
+                matches.push(index);
+            }
+        }
+        matches.sort_unstable();
+    }
     if contains_active_heredoc_operator(command) || names_a_runner_through_quoting(command) {
         matches.push(MANUAL_HEREDOC_TRIGGER_INDEX);
     }
     matches
 }
 
+/// `command` with each unquoted local redirect word blank-filled, or `None`
+/// when it has none. The shell removes a redirect from the argv wherever it
+/// stands, so `sh 2>/dev/null -c '<cmd>'`, `sh -c 2>/dev/null '<cmd>'` and
+/// `python3 &>log -c '<cmd>'` run `<cmd>`, while the inline-interpreter
+/// patterns expect options and the flag to follow one another. They also
+/// read this view (sixth review of GH #498); repeating a redirect fragment in
+/// each pattern instead made the tier-1 set, which every hook call compiles,
+/// about a millisecond slower to build.
+///
+/// A redirect word starts a word (or follows one directly, operator first):
+/// optional descriptor digits or `{name}`, then `>`, `<`, `>>`, `<>`, `>|`,
+/// `>&`, `<&`, `&>` or `&>>`, then its target, glued or after blanks
+/// (`2> /dev/null`, `2>& 1`). A heredoc (`<<`), a process substitution (`<(`)
+/// and a word without a target are left alone. Text inside quotes is never
+/// taken for a redirect, so a quoted payload reads the same in both. Length
+/// preserving (every blanked byte becomes a space, so the view stays UTF-8
+/// and every range in it is the same range in `command`); linear.
+fn blank_local_redirects(command: &str) -> Option<String> {
+    let bytes = command.as_bytes();
+    memchr::memchr2(b'<', b'>', bytes)?;
```

**File**: `src/normalize.rs` (modified, +1/-1)
```diff
@@ -1574,7 +1574,7 @@ pub fn consume_word_token(bytes: &[u8], mut i: usize, len: usize) -> usize {
     i
 }
 
-fn consume_shell_paren_construct(bytes: &[u8], mut i: usize, len: usize) -> usize {
+pub(crate) fn consume_shell_paren_construct(bytes: &[u8], mut i: usize, len: usize) -> usize {
     let mut depth = 1usize;
 
     while i < len {
```

**File**: `tests/repro_498_warn_masks_later_deny.rs` (modified, +75/-0)
```diff
@@ -627,3 +627,78 @@ fn a_pipeline_of_thousands_of_stages_answers_fast() {
     assert!(!lab.claude_hook_denies(&format!("x {}| sh -c ls", "| cat ".repeat(50))));
     assert!(!lab.claude_hook_denies(&format!("x {}| sh -c ls", "; cat ".repeat(3000))));
 }
+
+/// Sixth review: a redirect or an option around a shell's `-c` hid the
+/// command string from the inline-script reader, which expected the options
+/// before `-c` and the quoted string right after it. The shell removes a
+/// redirect wherever it stands and takes its first operand as the command
+/// string, so each of these runs `git reset --hard` (bash, dash, zsh and
+/// busybox sh checked). The same redirects (`&>`, `>|`, `{fd}>`), an ANSI-C
+/// quoted name (`wat$'c'h`), a quoted name whose plain spelling also stands
+/// elsewhere (`echo watch; w\atch …`) and a process substitution inside a
+/// word (`--x=<(…)`, which bash expands there too) also still hid a
+/// command-string runner's payload.
+#[test]
+fn shell_command_strings_behind_redirects_and_options_are_judged() {
+    let lab = Lab::new(DEFAULTS);
+    for command in [
+        "sh 2>/dev/null -c 'git reset --hard'",
+        "sh 2>&1 -c 'git reset --hard'",
+        "sh >/dev/null 2>&1 -c 'git reset --hard'",
+        "sh 2> /dev/null -c \"git reset --hard\"",
+        "bash &>/dev/null -c 'git reset --hard'",
+        "zsh >|/tmp/o -c 'git reset --hard'",
+        "dash {fd}>/dev/null -c 'git reset --hard'",
+        "busybox sh 2>/dev/null -c 'git reset --hard'",
+        "sudo ksh 2>/dev/null -c 'git reset --hard'",
+        "sh -c 2>/dev/null 'git reset --hard'",
+        "sh -c -- 'git reset --hard'",
+        "sh -c - 'git reset --hard'",
+        "sh -c -e \"git reset --hard\"",
+        "bash -c -o errexit 'git reset --hard'",
+        "bash -c 2>&1 -- 'git reset --hard'",
+        "bash +e -c 'git reset --hard'",
+        "bash -c +e 'git reset --hard'",
+        "sh 2>/dev/null -c $CMD",
+        "sh -c -- $CMD",
+        "python3 2>/dev/null -c 'import shutil; shutil.rmtree(\"/etc\")'",
+        "watch &>/dev/null 'git reset --hard'",
+        "watch &>>/tmp/log 'git reset --hard'",
+        "watch >|/tmp/o 'git reset --hard'",
+        ">|/tmp/o watch 'git reset --hard'",
+        "{fd}>/dev/null watch 'git reset --hard'",
+        "watch {fd}>/dev/null 'git reset --hard'",
+        "su &>/dev/null -c 'git reset --hard'",
+        "su -c &>/dev/null 'git reset --hard'",
+        "ssh host &>/dev/null 'git reset --hard'",
+        "ssh host >|/tmp/o 'git reset --hard'",
+        "wat$'c'h 'git reset --hard'",
+        "s$'s'h host 'git reset --hard'",
+        "echo watch; w\\atch 'git reset --hard'",
+        "echo watch; wat$'c'h 'git reset --hard'",
+        "cat --x=<(watch 'git reset --hard')",
+        "cat a<(ssh host 'git reset --hard')",
+        "diff --from-file=<(cat <(watch 'git reset --hard')) b",
+    ] {
+        assert!(lab.claude_hook_denies(command), "{command:?}");
+    }
+    for command in [
+        "sh 2>/dev/null -c 'ls -la'",
+        "bash -c -- 'echo hi'",
+        "sh -c -e 'git status'",
+        "sh 2>/dev/null -c \"git status\"",
+        "bash -lc 'cargo build' 2>&1 | tail",
+        "bash -c 'git status' >/dev/null 2>&1",
+        "python3 2>/dev/null -c 'print(1)'",
+        "echo 'sh 2>/dev/null -c git reset --hard'",
+        "git commit -m 'sh -c -- git reset --hard is bad'",
+        "watch &>/dev/null 'ls'",
+        "watch >|/tmp/o 'uptime'",
+        "ssh host &>/dev/null 'git status'",
+        "wat$'c'h 'df -h'",
+        "diff --from-file=<(sort a) b<(sort c)",
+        "echo \"--x=<(watch 'git reset --hard')\"",
+    ] {
+        assert!(!lab.claude_hook_denies(command), "{command:?}");
+    }
+}
```

---

### Incident Patch 5: `cbf14e49` (2026-09-29)
**Commit Message**: fix(hook): thousand-stage pipelines and runs of unclosed brackets held the hook past its deadline (review of 2bd9167/aac4abe, GH #498)

Two slow paths the fourth review left open, measured on release builds
(CPU time, 60 KB commands):

- `x | env | … | env -S 'ls'`, `x | cat | … | sh -c ls`: ~2.5 s at 6,000
  stages and ~6.5–9 s at 10,000, answered `ask` after the 1 s hook deadline
  had long passed. tree-sitter-bash parses one long pipeline in superlinear
  time (a single parse was ~0.7 s even in an optimized build). A pipeline of
  more than 1,024 stages (counted by the tokenizer, per pipeline) is no longer
  handed to the parser: its consumers are unverified and fail closed at once
  (`heredoc.shell:analysis-bounds`, ~50 ms), and the command-substitution
  reader refuses it the same way. Below the bound nothing changes.
- `echo x > /tmp/[[:[[:…`, `[[[…`: 0.25–0.5 s. The git token expansion
  check rescanned the rest of the word for a `]`/`}` at every `[`/`{`, and
  the PowerShell `[scriptblock]` search rescanned the command at every
  unclosed `[` (and copied the text up to a shared `]` at every `[` before
  it). Both are one pass now with unchanged answers; the same commands ta

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -215,6 +215,14 @@ Work on `main` after the v0.14.4 tag. Nothing here is in a published binary yet.
 
 ### Fixed
 
+- **A pipeline of thousands of stages, or a run of unclosed `[`, held the hook
+  past its deadline.** tree-sitter-bash parses one long pipeline in
+  superlinear time, so `x | env | … | env -S 'ls'` (60 KB) answered `ask`
+  after 6–9 s; a pipeline of more than 1,024 stages is no longer parsed and
+  fails closed at once (`heredoc.shell:analysis-bounds`). The git expansion
+  check and the PowerShell `[scriptblock]` search rescanned the rest of the
+  command at every `[`/`{`; both are one pass now.
+
 - **The PowerShell profile check warned "Hook missing" although the hook was
   installed** (#503). A profile keeps the check block from whichever
   `install.ps1` last ran, and `dcg update` replaces only the binary, so an old
```

**File**: `src/evaluator.rs` (modified, +75/-18)
```diff
@@ -9472,6 +9472,16 @@ fn collect_posix_pipeline_executable_sinks(command: &str, sinks: &mut Vec<Execut
     if !command.as_bytes().contains(&b'|') {
         return;
     }
+    if crate::heredoc::longest_pipeline_stages(command) > crate::heredoc::MAX_PARSED_PIPELINE_STAGES
+    {
+        // Not parsed (see `MAX_PARSED_PIPELINE_STAGES`), so its consumers are
+        // unverified: fail closed rather than let a long pipeline hide one.
+        sinks.push(ExecutableTextSink::Unverified {
+            rule: SINK_ANALYSIS_BOUNDS_RULE,
+            reason: "POSIX pipeline has too many stages to verify its consumers",
+        });
+        return;
+    }
     let ast = AstGrep::new(command, SupportLang::Bash);
     if ast_contains_error(ast.root()) {
         return;
@@ -9996,26 +10006,33 @@ fn find_powershell_code_marker(command: &str, marker: &str, start: usize) -> Opt
 }
 
 fn find_powershell_scriptblock_type_literal(command: &str, start: usize) -> Option<(usize, usize)> {
-    let mut search_start = start;
-    while search_start < command.len() {
-        let type_start = find_powershell_code_marker(command, "[", search_start)?;
-        let Some(relative_close) = command.get(type_start + 1..)?.find(']') else {
-            search_start = type_start + 1;
-            continue;
-        };
-        let type_end = type_start + relative_close + 2;
-        let normalized: String = command[type_start + 1..type_end - 1]
-            .chars()
-            .filter(|character| !character.is_whitespace())
-            .collect();
-        if normalized.eq_ignore_ascii_case("scriptblock")
-            || normalized.eq_ignore_ascii_case("system.management.automation.scriptblock")
-        {
-            return Some((type_start, type_end));
+    // One pass: each `[` is paired with the first `]` after it, which is
+    // shared by every `[` before that `]`, so it is found once; and a `[`
+    // with another `[` before its `]` holds a `[` in its name and is skipped
+    // without copying it. A run of unclosed `[` (`[[[…`, 60 KB) otherwise
+    // rescanned the rest of the command at each one.
+    let mut type_start = find_powershell_code_marker(command, "[", start)?;
+    let mut close: Option<usize> = None;
+    loop {
+        if close.is_none_or(|close| close <= type_start) {
+            // No `]` after this `[` means none after any later one either.
+            close = Some(type_start + 1 + command.get(type_start + 1..)?.find(']')?);
+        }
+        let close_at = close?;
+        let following = find_powershell_code_marker(command, "[", type_start + 1);
+        if following.is_none_or(|next| next > close_at) {
+            let normalized: String = command[type_start + 1..close_at]
+                .chars()
+                .filter(|character| !character.is_whitespace())
+                .collect();
+            if normalized.eq_ignore_ascii_case("scriptblock")
+                || normalized.eq_ignore_ascii_case("system.management.automation.scriptblock")
+            {
+                return Some((type_start, close_at + 1));
+            }
         }
-        search_start = type_start + 1;
+        type_start = following?;
     }
-    None
 }
 
 fn find_powershell_scriptblock_create(command: &str, start: usize) -> Option<(usize, usize)> {
@@ -43894,4 +43911,44 @@ mod tests {
             assert!(denied(outer), "a real outer redirect must stay denied");
         }
     }
+
+    /// Fifth review: the `[scriptblock]` type-literal search rescanned the rest
+    /// of the command at every unclosed `[`, and copied the text up to a
+    /// shared `]` at every `[` before it; both are one pass now.
+    #[test]
+    fn scriptblock_type_literal_search_is_linear_and_keeps_its_answers() {
+        for (command, expected) in [
+            ("[scriptblock]::Create('x')", Some((0, 13))),
+            ("[ScriptBlock ]::Create('x')", Some((0, 14))),
+            ("[[scriptblock]", Some((1, 14))),
+            ("[a[scriptblock]", Some((
```

**File**: `src/heredoc.rs` (modified, +64/-1)
```diff
@@ -6848,6 +6848,44 @@ pub struct PosixCommandSubstitutionParseError;
 /// input is refused for its size rather than its syntax.
 pub(crate) const MAX_SUBSTITUTION_SOURCE_BYTES: usize = 256 * 1024;
 
+/// Stages one pipeline may have before a command is not handed to the bash
+/// parser. tree-sitter-bash parses a single long pipeline in superlinear
+/// time: `x | cat | … | sh -c ls` with 6,000 stages held one parse ~0.7 s in
+/// an optimized build and the shipped hook 2.5–9 s, past its own deadline.
+/// No real command comes near this; past it the reading is refused.
+pub(crate) const MAX_PARSED_PIPELINE_STAGES: usize = 1024;
+
+/// Stages in the command's longest pipeline, by the tokenizer: `|` (and
+/// `|&`) joins two stages; any other separator (`;`, `&&`, `||`, `&`, a
+/// newline, a parenthesis) starts a new pipeline. Linear.
+pub(crate) fn longest_pipeline_stages(command: &str) -> usize {
+    if !command.contains('|') {
+        return 1;
+    }
+    let tokens = crate::normalize::tokenize_for_normalization(command);
+    let mut longest = 1usize;
+    let mut stages = 1usize;
+    let mut previous_pipe_end = None;
+    for token in &tokens {
+        if token.kind != crate::normalize::NormalizeTokenKind::Separator {
+            continue;
+        }
+        match token.text(command) {
+            Some("|") => {
+                stages += 1;
+                longest = longest.max(stages);
+                previous_pipe_end = Some(token.byte_range.end);
+                continue;
+            }
+            // `|&` arrives as `|` then `&`.
+            Some("&") if previous_pipe_end == Some(token.byte_range.start) => {}
+            _ => stages = 1,
+        }
+        previous_pipe_end = None;
+    }
+    longest
+}
+
 pub fn extract_posix_command_substitutions(
     content: &str,
 ) -> Result<Vec<PosixCommandSubstitution>, PosixCommandSubstitutionParseError> {
@@ -6858,7 +6896,9 @@ pub fn extract_posix_command_substitutions(
     if content.trim().is_empty() || (!content.contains("$(") && !content.contains('`')) {
         return Ok(Vec::new());
     }
-    if content.len() > MAX_SUBSTITUTION_SOURCE_BYTES {
+    if content.len() > MAX_SUBSTITUTION_SOURCE_BYTES
+        || longest_pipeline_stages(content) > MAX_PARSED_PIPELINE_STAGES
+    {
         return Err(PosixCommandSubstitutionParseError);
     }
 
@@ -11426,4 +11466,27 @@ EOF";
             }
         }
     }
+
+    /// Fifth review: stages of the longest pipeline, the bound that keeps a
+    /// many-thousand-stage pipeline away from the bash parser.
+    #[test]
+    fn longest_pipeline_stages_counts_one_pipeline_at_a_time() {
+        for (command, stages) in [
+            ("ls", 1),
+            ("a | b", 2),
+            ("a | b | c; d | e", 3),
+            ("a | b && c | d | e | f", 4),
+            ("a |& b |& c", 3),
+            ("a || b || c", 1),
+            ("a & b | c", 2),
+            ("echo 'a|b|c|d' | wc", 2),
+            ("a | b\nc | d", 2),
+        ] {
+            assert_eq!(longest_pipeline_stages(command), stages, "{command:?}");
+        }
+        assert_eq!(
+            longest_pipeline_stages(&format!("x{}", " | cat".repeat(5000))),
+            5001
+        );
+    }
 }
```

**File**: `src/packs/core/git.rs` (modified, +101/-15)
```diff
@@ -1315,11 +1315,19 @@ struct VisibleAliasDefinition {
 /// POSIX-family shells expand a brace group only when it closes in the same
 /// word and contains a `,` alternative or a `..` sequence — `{}` (xargs's
 /// conventional replacement token) and `{word}` are literal text.
-fn posix_brace_remainder_may_expand(remainder: &str) -> bool {
-    remainder.find('}').is_some_and(|close| {
-        let inner = &remainder[..close];
-        inner.contains(',') || inner.contains("..")
-    })
+/// For a `{` whose text starts at `from`: the first `}` after it (or
+/// `usize::MAX`), and the last position before that `}` where a `,` or a
+/// whole `..` starts. A `{` at `index < close` has a `,`/`..` between it and
+/// its `}` (so the brace may expand) exactly when that position is after it,
+/// so every `{` sharing the `}` reuses one scan instead of rescanning the
+/// rest of the word (`{{{…`, 20,000 of them, was quadratic).
+fn posix_brace_region(raw: &str, from: usize) -> (usize, Option<usize>) {
+    let Some(inner_len) = raw.get(from..).and_then(|rest| rest.find('}')) else {
+        return (usize::MAX, None);
+    };
+    let inner = &raw[from..from + inner_len];
+    let last = inner.rfind(',').max(inner.rfind("..")).map(|at| from + at);
+    (from + inner_len, last)
 }
 
 fn git_token_has_active_expansion(raw: &str, dialect: ShellDialect) -> bool {
@@ -1328,6 +1336,11 @@ fn git_token_has_active_expansion(raw: &str, dialect: ShellDialect) -> bool {
             let mut chars = raw.char_indices().peekable();
             let mut single = false;
             let mut double = false;
+            // The lookahead for a bracket's `]` and a brace's `}` is computed
+            // once, not per `[`/`{`: a word of 20,000 unclosed `[` rescanned
+            // its remainder at each one.
+            let last_bracket_close = raw.rfind(']');
+            let mut brace_region: Option<(usize, Option<usize>)> = None;
             while let Some((index, ch)) = chars.next() {
                 match ch {
                     '\\' if !single => {
@@ -1347,15 +1360,22 @@ fn git_token_has_active_expansion(raw: &str, dialect: ShellDialect) -> bool {
                     // can glob-expand into a different executable. Brace
                     // groups additionally need a `,`/`..` inside — `{}` and
                     // `{word}` are literal.
-                    '[' if !single && !double && raw[index + ch.len_utf8()..].contains(']') => {
-                        return true;
-                    }
-                    '{' if !single
+                    '[' if !single
                         && !double
-                        && posix_brace_remainder_may_expand(&raw[index + ch.len_utf8()..]) =>
+                        && last_bracket_close.is_some_and(|at| at > index) =>
                     {
                         return true;
                     }
+                    '{' if !single && !double => {
+                        let (close, last_expanding) = match brace_region {
+                            Some(region) if index < region.0 => region,
+                            _ => posix_brace_region(raw, index + 1),
+                        };
+                        brace_region = Some((close, last_expanding));
+                        if last_expanding.is_some_and(|at| at > index) {
+                            return true;
+                        }
+                    }
                     '<' | '>' if !single && matches!(chars.peek(), Some((_, '('))) => return true,
                     _ => {}
                 }
@@ -1412,6 +1432,9 @@ fn git_token_expansion_may_split(raw: &str, dialect: ShellDialect) -> bool {
             let mut chars = raw.char_indices().peekable();
             let mut single = false;
             let mut double = false;
+            // Linear lookahead, as in `git_token_has_active_expansion`.
+            let last_bracket_close = raw.rfind(']');
+            let mut brace_region: Option<(usize, Option<usize
```

**File**: `tests/repro_498_warn_masks_later_deny.rs` (modified, +22/-0)
```diff
@@ -605,3 +605,25 @@ fn command_string_runners_behind_fd_duplications_names_quoting_and_substitutions
     assert!(lab.claude_hook_denies(&many));
     assert!(!lab.claude_hook_denies(&format!("cat {}", "<(ls) ".repeat(70))));
 }
+
+/// Fifth review: a pipeline of thousands of stages went to the bash parser,
+/// which reads one long pipeline in superlinear time, so the hook answered
+/// `ask` after its deadline, seconds late (`x | env | … | env -S 'ls'`,
+/// 60 KB: ~9 s). Past `MAX_PARSED_PIPELINE_STAGES` it is not parsed and its
+/// unverified consumers fail closed at once; below it nothing changes.
+#[test]
+fn a_pipeline_of_thousands_of_stages_answers_fast() {
+    let lab = Lab::new(DEFAULTS);
+    let long = format!("x {}| sh -c ls", "| cat ".repeat(3000));
+    let started = std::time::Instant::now();
+    assert!(lab.claude_hook_denies(&long));
+    assert!(
+        started.elapsed() < std::time::Duration::from_secs(3),
+        "{:?}",
+        started.elapsed()
+    );
+    let substitution = format!("echo $(true) {}| sh -c ls", "| cat ".repeat(3000));
+    assert!(lab.claude_hook_denies(&substitution));
+    assert!(!lab.claude_hook_denies(&format!("x {}| sh -c ls", "| cat ".repeat(50))));
+    assert!(!lab.claude_hook_denies(&format!("x {}| sh -c ls", "; cat ".repeat(3000))));
+}
```

---

### Incident Patch 6: `74fa8a6e` (2026-09-29)
**Commit Message**: fix(hook): command-string runners behind 2>&1, function names, redirects, quoting and process substitution ran unjudged (review of 2bd9167, GH #498)

Fifth review of the command-string runner extraction, through release
builds of 90f3ba6 and aac4abe on the real Claude hook. Every row below was
allowed on aac4abe (and on 90f3ba6):

- `2>&1 watch '…'`, `>&2 su -c '…'`, `<&0 watch '…'`. The tokenizer ends a
  word at `&`, so `2>&1` arrives as `2>`, a `&` separator and `1`: the `&`
  read as a background separator and `1` as the command, which made the
  runner an argument. A `&` glued to a redirect operator is now the
  redirect's, and `2>&1`/`>&-` no longer take the next word as a target.
- `function f { watch '…'; }` and `coproc NAME { su -c '…'; }` read the
  name as the command, so the body's first word was an argument.
- A redirect before the payload ended the runner's words, although the local
  shell removes it wherever it stands: `watch 2>/dev/null '…'`,
  `su 2>/dev/null -c '…'`, `env >/dev/null -S'…'`, `parallel 2>/dev/null
  ::: '…'`, `ssh host 2>/dev/null '…'` and `ssh 2>/dev/null host '…'`.
  Redirects are now skipped wherever they stand; a trailing one still
  leaves a s

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -107,6 +107,14 @@ Work on `main` after the v0.14.4 tag. Nothing here is in a published binary yet.
   with no comma hid the slash-spanning list inside it
   (`tee /tmp/{{a/,b}}/../../etc/sudoers`), and the brace scan was quadratic
   in unclosed `{`; both fixed.
+  A fifth review found the runner still missed behind `2>&1` (read as a
+  background `&` and a command `1`), inside `function f { …; }` and
+  `coproc NAME { …; }` bodies, behind a redirect before its payload
+  (`watch 2>/dev/null '…'`, `ssh host 2>/dev/null '…'`), under a quoted or
+  escaped name (`\watch`, `w\atch`, `'su'`, `\ssh`), inside a process
+  substitution (`cat <(watch '…')`), and behind `chrt`, `busybox`,
+  `eatmydata`, `fakeroot`, `cgexec`, `flatpak-spawn`, `pkexec` and `run0`
+  (which also let `eatmydata git reset --hard` through). All now deny.
 
 - **The filesystem-sink fallback could not express a call in receiver position**
   (#468), so `require('fs').rmSync('/home/user', {recursive: true})` was
```

**File**: `src/heredoc.rs` (modified, +315/-125)
```diff
@@ -182,15 +182,19 @@ const HEREDOC_TRIGGER_PATTERNS: [&str; 30] = [
     // so Tier 2 only needs to run when quoting or expansion is present).
     // `[\s;|&(/]` before `ssh` keeps `ssh-keygen`/`ssh-add`/`autossh` from
     // triggering while still matching path-qualified `/usr/bin/ssh`.
-    r#"(?i)(?:^|[\s;|&(/])ssh(?:\.exe)?\s[^\n;|&]*['"$]"#,
+    //
+    // A quoted or escaped name (`\ssh`, `'ssh'`) is the same program, and a
+    // descriptor duplication (`2>&1`) does not end the segment.
+    r#"(?i)(?:^|[\s;|&(/\\'"])ssh(?:\.exe)?['"]?\s(?:[^\n;|&]|[<>]&)*['"$]"#,
     // `watch '<cmd>'`, `parallel ::: '<cmd>'` / `parallel '<cmd>' ::: …`,
     // `env -S'<cmd>'`, `su -c '<cmd>'` and the other runners in
     // `COMMAND_STRING_RUNNERS` hand a command STRING to a shell (or, for
     // `env -S`, split it into argv), so they are inline-script wrappers like
     // `sh -c`. Superset of `command_string_runner_payloads`, which validates;
     // as for ssh, only a quote or `$` makes the payload invisible to raw
     // matching.
-    r#"(?:^|[\s;|&(/])(?:watch|parallel|env|su|sg|runuser|script|nix-shell|npx|entr|flock|hyperfine)\s[^\n;|&]*['"$]"#,
+    // A name split by quoting (`w\atch`) is `names_a_runner_through_quoting`.
+    r#"(?:^|[\s;|&(/\\'"])(?:watch|parallel|env|su|sg|runuser|script|nix-shell|npx|entr|flock|hyperfine)['"]?\s(?:[^\n;|&]|[<>]&)*['"$]"#,
 ];
 
 const MANUAL_HEREDOC_TRIGGER_INDEX: usize = HEREDOC_TRIGGER_PATTERNS.len();
@@ -508,7 +512,10 @@ pub enum TriggerResult {
 #[must_use]
 #[instrument(skip(command), fields(cmd_len = command.len()))]
 pub fn check_triggers(command: &str) -> TriggerResult {
-    if contains_active_heredoc_operator(command) || HEREDOC_TRIGGERS.is_match(command) {
+    if contains_active_heredoc_operator(command)
+        || HEREDOC_TRIGGERS.is_match(command)
+        || names_a_runner_through_quoting(command)
+    {
         debug!("tier1_trigger: heredoc/inline script indicator detected");
         TriggerResult::Triggered
     } else {
@@ -523,12 +530,39 @@ pub fn check_triggers(command: &str) -> TriggerResult {
 #[must_use]
 pub fn matched_triggers(command: &str) -> Vec<usize> {
     let mut matches: Vec<usize> = HEREDOC_TRIGGERS.matches(command).into_iter().collect();
-    if contains_active_heredoc_operator(command) {
+    if contains_active_heredoc_operator(command) || names_a_runner_through_quoting(command) {
         matches.push(MANUAL_HEREDOC_TRIGGER_INDEX);
     }
     matches
 }
 
+/// Whether quoting inside a word hides a command-string runner's or `ssh`'s
+/// name from the trigger patterns: `w\atch '<cmd>'` and `s'sh' h '<cmd>'`
+/// run `watch` and `ssh`, but no pattern sees the name. Superset of what
+/// Tier 2 validates; linear.
+fn names_a_runner_through_quoting(command: &str) -> bool {
+    if !command
+        .bytes()
+        .any(|byte| matches!(byte, b'\\' | b'\'' | b'"'))
+    {
+        return false;
+    }
+    let hidden: Vec<&str> = COMMAND_STRING_RUNNERS
+        .iter()
+        .copied()
+        .chain(["ssh"])
+        .filter(|name| !command.contains(name))
+        .collect();
+    if hidden.is_empty() {
+        return false;
+    }
+    let unquoted: String = command
+        .chars()
+        .filter(|ch| !matches!(ch, '\\' | '\'' | '"'))
+        .collect();
+    hidden.iter().any(|name| unquoted.contains(name))
+}
+
 // ============================================================================
 // Tier 2: Content Extraction
 // ============================================================================
@@ -3630,37 +3664,49 @@ fn extract_ssh_inline_scripts(
     if record_timeout_if_needed(start_time, timeout, limits.timeout_ms, skip_reasons) {
         return;
     }
-    if !command.contains("ssh") && !command.contains("SSH") {
+    if !may_name_a_command(command, &["ssh", "SSH"]) {
         return;
     }
 
-    let tokens = crate::normalize::tokenize_for_normalization(command);
-    for index in 0..tokens.len() {
-        if r
```

**File**: `src/packs/core/git.rs` (modified, +6/-0)
```diff
@@ -4695,6 +4695,12 @@ pub(crate) fn unmodeled_exec_wrapper(basename: &str, next: Option<&str>) -> bool
             | "systemd-inhibit"
             | "script"
             | "gdb"
+            | "eatmydata"
+            | "fakeroot"
+            | "cgexec"
+            | "flatpak-spawn"
+            | "pkexec"
+            | "run0"
             // The remote command `ssh` runs is judged like a local one
             // (#326); unquoted it was never extracted, and git there was
             // never in executable position.
```

**File**: `tests/repro_498_warn_masks_later_deny.rs` (modified, +78/-0)
```diff
@@ -527,3 +527,81 @@ fn many_command_string_runners_answer_fast_and_fail_closed() {
         started.elapsed()
     );
 }
+
+/// Fifth review of the command-string runners (2bd9167). Each positive row
+/// was allowed through the hook on 2bd9167 (and on 90f3ba6):
+///
+/// - `2>&1`, `>&2` and `<&0` carry their target, but were taken to consume
+///   the next word, so the runner behind them was read as a file name;
+/// - `function NAME { … }` and `coproc NAME { … }` read NAME as the command,
+///   so the body's first word was an argument;
+/// - a redirect before the payload ended the runner's words (`watch
+///   2>/dev/null '<cmd>'`, `ssh host 2>/dev/null '<cmd>'`), although the
+///   local shell removes it wherever it stands;
+/// - a quoted or escaped runner name (`\watch`, `w\atch`, `'su'`, `\ssh`)
+///   was not recognized, and the substring prefilter never saw `w\atch`;
+/// - a process substitution (`cat <(watch '<cmd>')`) is one word to the
+///   tokenizer, so the runner inside it was never at a command position;
+/// - `chrt`, `busybox`, `eatmydata`, `fakeroot`, `cgexec`, `flatpak-spawn`,
+///   `pkexec` and `run0` run their arguments but were not known wrappers
+///   (`eatmydata git reset --hard` itself was allowed).
+#[test]
+fn command_string_runners_behind_fd_duplications_names_quoting_and_substitutions_are_judged() {
+    let lab = Lab::new(DEFAULTS);
+    for command in [
+        "2>&1 watch 'git reset --hard'",
+        ">&2 su -c 'rm -rf ./build'",
+        "<&0 watch 'git reset --hard'",
+        "FOO=1 2>&1 watch 'git reset --hard'",
+        "function f { watch 'git reset --hard'; }; f",
+        "function f { parallel ::: 'rm -rf ./build'; }; f",
+        "coproc NAME { su -c 'git reset --hard'; }",
+        "watch 2>/dev/null 'git reset --hard'",
+        "watch > /dev/null 'rm -rf ./build'",
+        "su 2>/dev/null -c 'git reset --hard'",
+        "env >/dev/null -S'git reset --hard'",
+        "parallel 2>/dev/null ::: 'git reset --hard'",
+        "ssh host 2>/dev/null 'git reset --hard'",
+        "ssh 2>/dev/null host 'rm -rf ./build'",
+        "\\watch 'git reset --hard'",
+        "w\\atch 'git reset --hard'",
+        "'su' -c 'git reset --hard'",
+        "\"parallel\" ::: 'rm -rf ./build'",
+        "\\ssh host 'git reset --hard'",
+        "'ssh' host 'rm -rf ./build'",
+        "cat <(watch 'git reset --hard')",
+        "diff <(true) <(ssh host 'git reset --hard')",
+        "echo >(su -c 'rm -rf ./build')",
+        "cat <(cat <(env -S'git reset --hard'))",
+        "chrt -f 1 watch 'git reset --hard'",
+        "busybox watch 'git reset --hard'",
+        "fakeroot su -c 'rm -rf ./build'",
+        "cgexec -g cpu:x watch 'git reset --hard'",
+        "eatmydata git reset --hard",
+        "flatpak-spawn --host git reset --hard",
+    ] {
+        assert!(lab.claude_hook_denies(command), "{command:?}");
+    }
+    for command in [
+        "2>&1 watch 'df -h'",
+        "function f { watch 'ls'; }; f",
+        "echo function watch 'git reset --hard'",
+        "coproc NAME { su -c 'ls'; }",
+        "watch 2>/dev/null 'git status'",
+        "ssh host 'git status' 2>&1",
+        "ssh h \"ls 2>/dev/null\" 2>&1",
+        "ssh host ls /tmp 2>/dev/null",
+        "\\watch 'ls'",
+        "cat <(ls) <(watch -n1 'date')",
+        "diff <(sort a) <(sort b)",
+        "eatmydata git status",
+        "chrt -f 1 watch 'uptime'",
+    ] {
+        assert!(!lab.claude_hook_denies(command), "{command:?}");
+    }
+    // Past the bound on process substitution bodies the reading is partial
+    // and the bounded fallback judges the whole command.
+    let many = format!("cat {}<(watch 'git reset --hard')", "<(ls) ".repeat(70));
+    assert!(lab.claude_hook_denies(&many));
+    assert!(!lab.claude_hook_denies(&format!("cat {}", "<(ls) ".repeat(70))));
+}
```

---

### Incident Patch 7: `aac4abed` (2026-09-28)
**Commit Message**: fix(core.filesystem): slash-spanning brace lists inside literal braces, and a quadratic scan (review of df1e779, GH #502)

Fourth review of the brace expander df1e779 added to the #502 root reader.

- `tee /tmp/{{a/,b}}/../../etc/sudoers` was allowed. A brace pair without a
  top-level comma is literal to the shell, but the lists inside it still
  expand (`{{a/,b}}` is `{a/}` and `{b}`, so one word is
  `/tmp/{b}/../../etc/sudoers`). slash_brace_list skipped such a pair whole.

- It also restarted its scan at every unclosed `{`, quadratic in them:
  `echo x > /tmp/{{{…` (30,000) held the hook ~2.7 s and `{,{,…` ~6.3 s
  before the deadline turned it into an ask (90f3ba6: ~0.2 s). Braces are now
  paired with one stack pass and each comma charged to its innermost list,
  so the scan is linear; and nesting deeper than the 64-word cap stops as too
  many words instead of recursing 20,000 frames and copying the word at each.

Test: slash_brace_lists_are_found_in_linear_time_inside_literal_braces
(unit: the bypass, both pathological shapes under 2 s in a debug build, and
exactly 64 words still expanding).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -97,6 +97,16 @@ Work on `main` after the v0.14.4 tag. Nothing here is in a published binary yet.
   `docker exec`, `uv run`, `direnv exec`, …) and after an unknown
   `watch`/`xargs`/`parallel` option (`parallel --retries 3 git …`) now put git
   in executable position, as `rm -rf` in the same place always was.
+  A fourth review found the runner missed behind a reserved word, a leading
+  redirect or a wrapper's own value (`{ watch '…'; }`, `then su -c '…'`,
+  `sudo -u bob watch '…'`, `timeout 5s watch '…'`); words the runner joins
+  read with their local quotes (`watch 'git reset' --hard`,
+  `ssh host 'git reset' --hard`, `env -S'git reset' --hard`); and
+  `watch -tn 1 '…'`, `hyperfine --prepare='…'`, `entr -s -r '…'`,
+  `sg wheel '…'` and `ssh host -- '…'` misparsed. All now deny. A brace pair
+  with no comma hid the slash-spanning list inside it
+  (`tee /tmp/{{a/,b}}/../../etc/sudoers`), and the brace scan was quadratic
+  in unclosed `{`; both fixed.
 
 - **The filesystem-sink fallback could not express a call in receiver position**
   (#468), so `require('fs').rmSync('/home/user', {recursive: true})` was
```

**File**: `src/packs/core/credential_files/shell.rs` (modified, +102/-35)
```diff
@@ -2498,6 +2498,10 @@ fn unread_spelling() -> Spelling {
 /// program; a list within one component is left to the reader, which matches
 /// it as a pattern.
 fn slash_brace_alternatives(word: &Word, limit: usize) -> BraceAlternatives {
+    slash_brace_alternatives_at(word, limit, 0)
+}
+
+fn slash_brace_alternatives_at(word: &Word, limit: usize, depth: usize) -> BraceAlternatives {
     let Some((open, close, commas)) = slash_brace_list(word) else {
         return BraceAlternatives::NoList;
     };
@@ -2519,8 +2523,18 @@ fn slash_brace_alternatives(word: &Word, limit: usize) -> BraceAlternatives {
             range: word.range.clone(),
             glued_paren: word.glued_paren,
         };
-        // Each alternative has one list fewer, so this ends.
-        match slash_brace_alternatives(&alternative, limit.saturating_sub(words.len())) {
+        // Each alternative has one list fewer, so this ends; and every list
+        // adds at least one word, so nesting deeper than the word cap is too
+        // many words before it is expanded (`{{{…{a/,b},c}…,c}` 20,000 deep
+        // otherwise recursed 20,000 frames, copying the word at each).
+        if depth >= MAX_BRACE_ALTERNATIVES {
+            return BraceAlternatives::TooMany;
+        }
+        match slash_brace_alternatives_at(
+            &alternative,
+            limit.saturating_sub(words.len()),
+            depth + 1,
+        ) {
             BraceAlternatives::Words(expanded) => words.extend(expanded),
             BraceAlternatives::TooMany => return BraceAlternatives::TooMany,
             BraceAlternatives::NoList => words.push(alternative),
@@ -2544,44 +2558,49 @@ enum BraceAlternatives {
 
 /// The first unquoted brace list with a top-level comma whose text contains
 /// a `/`: its `{`, its `}`, and its top-level commas.
+///
+/// One pass: braces are paired with a stack and each comma is charged to the
+/// innermost open list, so a word of unclosed or deeply nested braces
+/// (`{{{…`, `{,{,{,…`) costs linear time, not a rescan per `{`. A list
+/// without a top-level comma is literal to the shell, but lists inside it
+/// still expand (`{{a/,b}}`), so they are candidates too.
 fn slash_brace_list(word: &Word) -> Option<(usize, usize, Vec<usize>)> {
     let brace = |index: usize, ch: char| !word.literal[index] && word.text[index] == ch;
-    let mut index = 0usize;
-    while index < word.text.len() {
-        if !brace(index, '{') {
-            index += 1;
-            continue;
-        }
-        let open = index;
-        let mut depth = 0usize;
-        let mut commas = Vec::new();
-        let mut close = None;
-        for (at, ch) in word.text.iter().enumerate().skip(open) {
-            if brace(at, '{') {
-                depth += 1;
-            } else if brace(at, '}') {
-                depth -= 1;
-                if depth == 0 {
-                    close = Some(at);
-                    break;
-                }
-            } else if depth == 1 && *ch == ',' {
-                // `,` is a bare literal character, so a quoted comma is
-                // counted too; that only adds alternatives.
-                commas.push(at);
+    let len = word.text.len();
+    let mut close_of: Vec<Option<usize>> = vec![None; len];
+    let mut comma_owner: Vec<Option<usize>> = vec![None; len];
+    let mut has_comma = vec![false; len];
+    let mut slashes_before = Vec::with_capacity(len + 1);
+    slashes_before.push(0usize);
+    let mut open_lists: Vec<usize> = Vec::new();
+    for (at, ch) in word.text.iter().enumerate() {
+        slashes_before.push(slashes_before[at] + usize::from(*ch == '/'));
+        if brace(at, '{') {
+            open_lists.push(at);
+        } else if brace(at, '}') {
+            if let Some(open) = open_lists.pop() {
+                close_of[open] = Some(at);
+            }
+        } else if *ch == ',' {
+            // `,` is a bare literal character, so a quoted comma is counted
+            // too; th
```

---

### Incident Patch 8: `2bd91673` (2026-09-28)
**Commit Message**: fix(hook): command-string runners behind keywords, wrapper values and joined words still ran unjudged (review of 7273b28, GH #498)

Fourth review of the command-string runner extraction added in 7273b28,
against release builds of 90f3ba6 and a50a406 through the real Claude hook.
Every row below was allowed on a50a406 (and on 90f3ba6):

- Command position. A runner was only read when it was first in its
  segment or right behind a short list of wrappers, with nothing but
  options, digits or assignments in between. So a reserved word, a leading
  redirect, or a wrapper's own value hid it:
    { watch 'git reset --hard'; }      if true; then watch '…'; fi
    for i in 1; do su -c '…'; done     ! watch '…'
    2>/dev/null watch '…'              sudo -u bob watch '…'
    sudo -u bob su -c '…'              timeout 5s watch '…'
    taskset -c 0 watch '…'             strace -f parallel ::: '…'
  command_word_positions now marks, in one linear pass, the command word of
  each segment (after assignments, redirects and reserved words) and every
  later word behind a command that runs its arguments (the known wrappers
  plus git.rs's unmodeled_exec_wrapper list). `echo watch 'x'` stays data.


**File**: `src/heredoc.rs` (modified, +349/-107)
```diff
@@ -185,7 +185,7 @@ const HEREDOC_TRIGGER_PATTERNS: [&str; 30] = [
     r#"(?i)(?:^|[\s;|&(/])ssh(?:\.exe)?\s[^\n;|&]*['"$]"#,
     // `watch '<cmd>'`, `parallel ::: '<cmd>'` / `parallel '<cmd>' ::: …`,
     // `env -S'<cmd>'`, `su -c '<cmd>'` and the other runners in
-    // `command_string_runner_at` hand a command STRING to a shell (or, for
+    // `COMMAND_STRING_RUNNERS` hand a command STRING to a shell (or, for
     // `env -S`, split it into argv), so they are inline-script wrappers like
     // `sh -c`. Superset of `command_string_runner_payloads`, which validates;
     // as for ssh, only a quote or `$` makes the payload invisible to raw
@@ -2379,11 +2379,80 @@ fn word_token_starts_local_redirect(text: &str) -> bool {
 struct SshRemotePayload {
     /// Payload text: for a single payload word, one layer of matching
     /// surrounding quotes removed; for multiple words, the raw span from the
-    /// first payload byte to the last (per-word quoting left intact, exactly
-    /// as the remote shell will see it after the local shell's one decode).
+    /// first payload byte to the last, per-word quoting intact (see `joined`
+    /// for the line the program actually hands on).
     content: Range<usize>,
     /// Full `ssh … <payload>` span, for span attribution.
     full: Range<usize>,
+    /// The content is several argv words that the program joins with spaces
+    /// before a shell parses the result (`ssh`, `watch`, a `parallel`
+    /// template, `env -S` plus its trailing words). The local shell removes
+    /// each word's quoting first, so `ssh h 'git reset' --hard` runs
+    /// `git reset --hard` remotely while the raw span still reads as one
+    /// quoted word; see [`joined_payload_words`].
+    joined: bool,
+}
+
+/// A multi-word payload as the program that joins its argv hands it on: each
+/// word with one round of shell quoting removed, joined with spaces. `None`
+/// when that is the raw text already, or when the span is not a plain run of
+/// words.
+fn joined_payload_words(raw: &str) -> Option<String> {
+    let tokens = crate::normalize::tokenize_for_normalization(raw);
+    let mut out = String::with_capacity(raw.len());
+    for token in &tokens {
+        if token.kind != crate::normalize::NormalizeTokenKind::Word {
+            return None;
+        }
+        let text = token.text(raw)?;
+        if !out.is_empty() {
+            out.push(' ');
+        }
+        out.push_str(&crate::normalize::decode_posix_syntax_token(text));
+    }
+    (out != raw).then_some(out)
+}
+
+/// Push a runner or `ssh` payload for re-evaluation: the raw span, and for a
+/// joined multi-word payload also the joined command line (which is not a
+/// substring of the command, so it carries no content range). `false` when
+/// the extraction limit stopped it.
+fn push_joined_payload(
+    command: &str,
+    payload: SshRemotePayload,
+    limits: &ExtractionLimits,
+    extracted: &mut Vec<ExtractedContent>,
+    skip_reasons: &mut Vec<SkipReason>,
+    target: &str,
+) -> bool {
+    let Some(content) = command.get(payload.content.clone()) else {
+        return true;
+    };
+    if !push_windows_inner(
+        extracted,
+        skip_reasons,
+        limits,
+        content,
+        payload.full.clone(),
+        Some(payload.content.clone()),
+        target,
+    ) {
+        return false;
+    }
+    if payload.joined
+        && let Some(joined) = joined_payload_words(content)
+    {
+        return push_windows_inner(
+            extracted,
+            skip_reasons,
+            limits,
+            &joined,
+            payload.full,
+            None,
+            target,
+        );
+    }
+    true
 }
 
 /// ssh short options that consume a value (OpenSSH `getopt` string; the value
@@ -3590,18 +3659,7 @@ fn extract_ssh_inline_scripts(
         let Some(payload) = ssh_remote_payload(command, &tokens, index) else {
             continue;
         };
-        let Some(content) = command.get(pa
```

**File**: `src/normalize.rs` (modified, +1/-1)
```diff
@@ -1813,7 +1813,7 @@ enum PosixQuote {
     Double,
 }
 
-fn decode_posix_syntax_token(token: &str) -> Cow<'_, str> {
+pub(crate) fn decode_posix_syntax_token(token: &str) -> Cow<'_, str> {
     if !token
         .as_bytes()
         .iter()
```

**File**: `src/packs/core/git.rs` (modified, +1/-1)
```diff
@@ -4652,7 +4652,7 @@ fn exec_wrapper_payloads<'a>(
 /// this does not model: when one of those words may be git, git may run.
 /// Pure wrappers take any later word; subcommand runners only behind their
 /// run subcommand.
-fn unmodeled_exec_wrapper(basename: &str, next: Option<&str>) -> bool {
+pub(crate) fn unmodeled_exec_wrapper(basename: &str, next: Option<&str>) -> bool {
     matches!(
         basename,
         "sudo"
```

**File**: `tests/repro_498_warn_masks_later_deny.rs` (modified, +85/-0)
```diff
@@ -442,3 +442,88 @@ fn git_behind_quoted_unmodeled_and_split_string_wrappers_is_judged() {
         assert!(!lab.claude_hook_denies(command), "{command:?}");
     }
 }
+
+/// Fourth review of the command-string runners (7273b28). Each positive row
+/// was allowed through the hook on 7273b28:
+///
+/// - the runner was only recognized first in its segment or right behind a
+///   known wrapper, so a reserved word (`{`, `then`, `do`, `!`), a leading
+///   redirect, or a wrapper's own value (`sudo -u bob`, `timeout 5s`,
+///   `taskset -c 0`, `strace -f`) hid it;
+/// - several words that the runner joins with spaces (`watch`, `ssh`, a
+///   `parallel` template, `env -S` plus trailing words) were re-read with
+///   their local quoting intact, so `'git reset' --hard` stayed one word;
+/// - `watch -tn 1` (value option ending a cluster), `hyperfine
+///   --prepare=<cmd>`/`-p<cmd>`, `entr -s -r <cmd>`/`-sr`, `sg group <cmd>`
+///   without `-c`, and `ssh host -- <cmd>` were misparsed.
+#[test]
+fn command_string_runners_behind_keywords_values_and_joined_words_are_judged() {
+    let lab = Lab::new(DEFAULTS);
+    for command in [
+        "watch -tn 1 'git reset --hard'",
+        "watch -cn 2 'rm -rf ./build'",
+        "watch 'git reset' --hard",
+        "ssh host 'git reset' --hard",
+        "ssh host -- 'git reset --hard'",
+        "ssh host -t 'rm -rf ./build'",
+        "env -S'git reset' --hard",
+        "parallel 'git reset' --hard ::: a",
+        "hyperfine --prepare='git reset --hard' true",
+        "hyperfine -p'git reset --hard' true",
+        "hyperfine --setup='rm -rf ./build' true",
+        "ls | entr -s -r 'git reset --hard'",
+        "ls | entr -sr 'rm -rf ./build'",
+        "sg wheel 'git reset --hard'",
+        "sg - wheel 'rm -rf ./build'",
+        "sudo -u bob watch 'git reset --hard'",
+        "sudo -u bob su -c 'git reset --hard'",
+        "timeout 5s watch 'git reset --hard'",
+        "taskset -c 0 watch 'rm -rf ./build'",
+        "strace -f parallel ::: 'git reset --hard'",
+        "{ watch 'git reset --hard'; }",
+        "if true; then watch 'git reset --hard'; fi",
+        "for i in 1; do su -c 'rm -rf ./build'; done",
+        "! watch 'git reset --hard'",
+        "2>/dev/null watch 'git reset --hard'",
+        "2> /dev/null watch 'git reset --hard'",
+    ] {
+        assert!(lab.claude_hook_denies(command), "{command:?}");
+    }
+    for command in [
+        "watch -tn 1 'git status'",
+        "watch 'git log' --oneline",
+        "ssh host 'git status'",
+        "ssh host -- 'git log' -1",
+        "hyperfine --prepare='sync' 'cargo build'",
+        "hyperfine --export-json out.json 'ls'",
+        "ls | entr -s -r 'make test'",
+        "sg wheel 'ls -la'",
+        "sudo -u bob watch 'df -h'",
+        "timeout 5s watch 'ls'",
+        "{ watch 'ls'; }",
+        "echo watch 'rm -rf ./build'",
+        "man watch",
+        "docker exec c ls",
+        "uv run pytest",
+        "direnv exec . make",
+    ] {
+        assert!(!lab.claude_hook_denies(command), "{command:?}");
+    }
+}
+
+/// Commands that are nothing but runners are read to a bounded depth: past
+/// it the reading is incomplete and the bounded fallback judges the whole
+/// command, so the hook answers fast and the later payload is not dropped.
+#[test]
+fn many_command_string_runners_answer_fast_and_fail_closed() {
+    let lab = Lab::new(DEFAULTS);
+    // `x ; watch ; watch ; … ; watch 'git reset --hard'`
+    let long = format!("x {}'git reset --hard'", "; watch ".repeat(500));
+    let started = std::time::Instant::now();
+    assert!(lab.claude_hook_denies(&long));
+    assert!(
+        started.elapsed() < std::time::Duration::from_secs(5),
+        "{:?}",
+        started.elapsed()
+    );
+}
```

---

### Incident Patch 9: `7273b28e` (2026-09-28)
**Commit Message**: fix(hook): commands handed over as a string, and git behind unmodeled wrappers, ran unjudged (review of 2f1a59f, GH #498)

Third review of the exec-wrapper change in 2f1a59f, through the real Claude
hook. All of these were allowed on 2f1a59f:

- A command passed as ONE quoted string. `watch` joins its operands and runs
  them with `sh -c`; `parallel` runs its template, or with none each `:::`
  argument, through a shell; `env -S` splits one word into the command; and
  `su`/`sg`/`runuser`/`script`/`flock -c`, `nix-shell --run`, `npx -c`,
  `entr -s` and `hyperfine` all take a command string. Quoted, that string
  was argv data to every rule, so `watch 'rm -rf ./build'`,
  `watch -n 1 'git reset --hard'`, `parallel ::: 'git reset --hard'`,
  `env -S'git reset --hard'` and `su -lc 'rm -rf ./build'` were allowed
  while the unquoted spellings denied (rm and git alike; pre-existing).
  extract_command_string_runner_scripts extracts each payload for
  re-evaluation exactly as the ssh remote command is (#326), gated by a new
  Tier-1 trigger; the runner must be in command position, so
  `echo watch 'rm -rf x'` stays data.

- git behind a wrapper whose options dcg does not model: `doas`,


**File**: `CHANGELOG.md` (modified, +26/-0)
```diff
@@ -71,6 +71,32 @@ Work on `main` after the v0.14.4 tag. Nothing here is in a published binary yet.
   `` `printf /`etc/sudoers `` — judged by the file it can reach; and a
   Windows profile mounted by WSL, Git Bash or Cygwin (`/mnt/c/Users/<u>`,
   `/c/Users/<u>`, `/cygdrive/c/Users/<u>`).
+  A third review found a bracket expression opening with `]` (`/e[]t]c`) and
+  a brace list spanning a `/` (`tee -a /{tmp/x,etc/sudoers}`) still allowed,
+  and two ways to stall the hook for over a minute: a long run of rewritable
+  components (`/*/*/…`, `/$x/$x/…`, 5,000 deep) and a source glob of many
+  `*?` pairs (`cp ./*?*?… ~/.config/gcloud/`), whose matcher was exponential.
+  Brace lists across a `/` are now expanded, glob matching is linear, and a
+  rewritable path past 64 components fails closed.
+
+- **`rm $'-rf' /` was allowed** while `rm '-rf' /` denied: Bash ANSI-C
+  (`$'…'`) and locale (`$"…"`) quoting in an `rm` option read as the `$-`
+  parameter, so `rm $'-rf' /`, `rm $'-\x72f' /` and `rm -$'\x72'f ./build`
+  matched no rule. Both quotings are decoded there now, and an overlong octal
+  escape keeps its low byte as bash and zsh do (`$'\562'` is `r`, not an
+  error that left the word undecoded).
+
+- **A command handed over as a string ran unjudged.** `watch 'rm -rf ./b'`,
+  `watch -n 1 'git reset --hard'`, `parallel ::: 'git reset --hard'`,
+  `env -S'git reset --hard'`, `su -c '…'`, `sg`/`runuser`/`script`/`flock -c`,
+  `nix-shell --run`, `npx -c`, `entr -s` and `hyperfine '…'` hand their
+  command to a shell, but quoted it was argv data to every rule. Those
+  payloads are now extracted and re-evaluated like `sh -c`'s. For git, the
+  unquoted forms behind wrappers whose options dcg does not model (`doas`,
+  `sudo --user=…`, `chronic`, `strace`, `flock`, `taskset`, `ssh host …`,
+  `docker exec`, `uv run`, `direnv exec`, …) and after an unknown
+  `watch`/`xargs`/`parallel` option (`parallel --retries 3 git …`) now put git
+  in executable position, as `rm -rf` in the same place always was.
 
 - **The filesystem-sink fallback could not express a call in receiver position**
   (#468), so `require('fs').rmSync('/home/user', {recursive: true})` was
```

**File**: `src/heredoc.rs` (modified, +417/-1)
```diff
@@ -63,7 +63,7 @@ use tracing::{debug, instrument, trace, warn};
 /// quote-aware scanner so we can suppress obvious false positives inside quoted
 /// literals (commit messages, search patterns, etc.) without introducing false
 /// negatives for real shell syntax (including `$()`/backtick substitutions).
-const HEREDOC_TRIGGER_PATTERNS: [&str; 29] = [
+const HEREDOC_TRIGGER_PATTERNS: [&str; 30] = [
     // Inline interpreter execution. These patterns intentionally allow:
     // - interleaved flags (python -I -c, bash --norc -c)
     // - combined short-flag clusters (bash -lc, node -pe, perl -pi -e)
@@ -183,6 +183,14 @@ const HEREDOC_TRIGGER_PATTERNS: [&str; 29] = [
     // `[\s;|&(/]` before `ssh` keeps `ssh-keygen`/`ssh-add`/`autossh` from
     // triggering while still matching path-qualified `/usr/bin/ssh`.
     r#"(?i)(?:^|[\s;|&(/])ssh(?:\.exe)?\s[^\n;|&]*['"$]"#,
+    // `watch '<cmd>'`, `parallel ::: '<cmd>'` / `parallel '<cmd>' ::: …`,
+    // `env -S'<cmd>'`, `su -c '<cmd>'` and the other runners in
+    // `command_string_runner_at` hand a command STRING to a shell (or, for
+    // `env -S`, split it into argv), so they are inline-script wrappers like
+    // `sh -c`. Superset of `command_string_runner_payloads`, which validates;
+    // as for ssh, only a quote or `$` makes the payload invisible to raw
+    // matching.
+    r#"(?:^|[\s;|&(/])(?:watch|parallel|env|su|sg|runuser|script|nix-shell|npx|entr|flock|hyperfine)\s[^\n;|&]*['"$]"#,
 ];
 
 const MANUAL_HEREDOC_TRIGGER_INDEX: usize = HEREDOC_TRIGGER_PATTERNS.len();
@@ -1561,6 +1569,26 @@ fn extract_content_with_scan_view(
         };
     }
 
+    // `watch '<cmd>'`, `parallel ::: '<cmd>'`, `env -S'<cmd>'`
+    extract_command_string_runner_scripts(
+        scan_view,
+        limits,
+        start_time,
+        timeout,
+        &mut extracted,
+        &mut skip_reasons,
+    );
+    if record_timeout_if_needed(start_time, timeout, limits.timeout_ms, &mut skip_reasons) {
+        return if extracted.is_empty() {
+            ExtractionResult::Skipped(skip_reasons)
+        } else {
+            ExtractionResult::Partial {
+                extracted,
+                skipped: skip_reasons,
+            }
+        };
+    }
+
     // Extract here-strings (<<<)
     extract_herestrings(
         command,
@@ -3579,6 +3607,394 @@ fn extract_ssh_inline_scripts(
     }
 }
 
+/// Extract the command strings `watch`, `parallel` and `env -S` run.
+///
+/// `watch` joins its operands and runs them with `sh -c` (unless `-x`),
+/// `parallel` runs its command template (or, with none, each `:::` argument)
+/// through a shell, and `env -S` splits one word into the command it runs.
+/// Quoted, those commands were argv data to every rule: `watch 'rm -rf ./b'`,
+/// `parallel ::: 'git reset --hard'` and `env -S'git reset --hard'` were
+/// allowed while the unquoted spellings denied. Each payload is re-evaluated
+/// as a shell command, as the `ssh` remote command is.
+fn extract_command_string_runner_scripts(
+    command: &str,
+    limits: &ExtractionLimits,
+    start_time: Instant,
+    timeout: Duration,
+    extracted: &mut Vec<ExtractedContent>,
+    skip_reasons: &mut Vec<SkipReason>,
+) {
+    if record_timeout_if_needed(start_time, timeout, limits.timeout_ms, skip_reasons) {
+        return;
+    }
+    if !COMMAND_STRING_RUNNERS
+        .iter()
+        .any(|name| command.contains(name))
+    {
+        return;
+    }
+    let tokens = crate::normalize::tokenize_for_normalization(command);
+    for index in 0..tokens.len() {
+        if record_timeout_if_needed(start_time, timeout, limits.timeout_ms, skip_reasons) {
+            return;
+        }
+        let Some(name) = command_string_runner_at(command, &tokens, index) else {
+            continue;
+        };
+        for payload in command_string_runner_payloads(command, &tokens, index, name) {
+            let Some(content) = command.get(payload.content.clone()) else {
+                continue;
+  
```

**File**: `src/packs/core/git.rs` (modified, +225/-46)
```diff
@@ -4438,7 +4438,7 @@ fn command_executes_git_in_dialect_at(command: &str, dialect: ShellDialect, dept
             return true;
         }
         if payloads
-            .into_iter()
+            .iter()
             .any(|payload| command_executes_git_in_dialect_at(payload, dialect, depth + 1))
         {
             return true;
@@ -4465,9 +4465,15 @@ fn command_executes_git_in_dialect_at(command: &str, dialect: ShellDialect, dept
 /// never in executable position: `watch git reset --hard`,
 /// `echo a | xargs git reset --hard` and `find . -exec git reset --hard \;`
 /// were allowed while `rm -rf` behind the same wrappers denied (the
-/// filesystem rules are not position-gated). Returns the text from each
-/// wrapped command word to the end of the segment; the caller recurses, which
-/// handles `xargs sudo git …` and nested wrappers.
+/// filesystem rules are not position-gated). Returns each command the
+/// wrapper can run; the caller recurses, which handles `xargs sudo git …` and
+/// nested wrappers.
+///
+/// An option this does not know may take a value, so the word after that
+/// value is tried as the command too: `parallel --retries 3 git …` was read as
+/// running `3`. (A command these run from one quoted string, `watch 'git …'`
+/// or `parallel ::: 'git …'`, is extracted and re-evaluated whole by
+/// `heredoc::extract_command_string_runner_scripts`.)
 fn exec_wrapper_payloads<'a>(
     command: &'a str,
     tokens: &[crate::normalize::NormalizeToken],
@@ -4486,8 +4492,8 @@ fn exec_wrapper_payloads<'a>(
             .get(index)
             .and_then(|(_, start)| command.get(*start..))
     };
-    // Options whose value is the next word.
-    let value_options: &[&str] = match name {
+    // (options whose value is the next word, options known to take none)
+    let (value_options, flag_options): (&[&str], &[&str]) = match name {
         "find" | "gfind" => {
             return words
                 .iter()
@@ -4496,55 +4502,214 @@ fn exec_wrapper_payloads<'a>(
                 .filter_map(|(index, _)| from(index + 1))
                 .collect();
         }
-        "xargs" | "gxargs" => &[
-            "-a",
-            "-d",
-            "-E",
-            "-I",
-            "-L",
-            "-n",
-            "-P",
-            "-s",
-            "--arg-file",
-            "--delimiter",
-            "--max-args",
-            "--max-procs",
-            "--max-chars",
-            "--max-lines",
-            "--process-slot-var",
-        ],
-        "watch" => &["-n", "--interval", "-q", "--equexit"],
-        "parallel" => &[
-            "-a",
-            "-C",
-            "-j",
-            "-L",
-            "-N",
-            "-S",
-            "--arg-file",
-            "--colsep",
-            "--delay",
-            "--jobs",
-            "--joblog",
-            "--max-args",
-            "--results",
-            "--sshlogin",
-            "--timeout",
-        ],
+        "xargs" | "gxargs" => (
+            &[
+                "-a",
+                "-d",
+                "-E",
+                "-I",
+                "-J",
+                "-L",
+                "-n",
+                "-P",
+                "-R",
+                "-s",
+                "-S",
+                "--arg-file",
+                "--delimiter",
+                "--max-args",
+                "--max-procs",
+                "--max-chars",
+                "--max-lines",
+                "--process-slot-var",
+            ],
+            &[
+                "-0",
+                "-e",
+                "-i",
+                "-l",
+                "-o",
+                "-p",
+                "-r",
+                "-t",
+                "-x",
+                "--null",
+                "--eof",
+                "--replace",
+                "--open-tty",
+                "--interactive",
+                "--no-run-if-empty",
+                "--show-limits",
+                "--verbose",
+           
```

**File**: `tests/repro_498_warn_masks_later_deny.rs` (modified, +68/-0)
```diff
@@ -374,3 +374,71 @@ fn git_behind_an_exec_wrapper_is_judged_like_rm_behind_one() {
         assert!(!lab.claude_hook_denies(command), "{command:?}");
     }
 }
+
+/// Third review of #498. `watch` and `parallel` hand their command words to a
+/// shell, so the quoted forms run the command exactly as the unquoted ones do
+/// (they hid `rm -rf` as well as git); an option the wrapper table did not
+/// know was read as the command (`parallel --retries 3 git …` ran `3`);
+/// `env -S` carries the command in one word; and `sudo --user=…`, `doas`,
+/// `chronic`, `strace` and similar wrappers whose options are not modeled
+/// never put git in executable position. The git rows were allowed through
+/// the hook while `rm -rf` behind the same unquoted wrapper denied.
+#[test]
+fn git_behind_quoted_unmodeled_and_split_string_wrappers_is_judged() {
+    let lab = Lab::new(DEFAULTS);
+    for command in [
+        "watch 'git reset --hard'",
+        "watch -n 1 'git reset --hard'",
+        "parallel ::: 'git reset --hard'",
+        "parallel 'git reset --hard {}' ::: a",
+        "parallel --retries 3 git reset --hard ::: a",
+        "parallel --env FOO git reset --hard ::: a",
+        "env -S'git reset --hard'",
+        "env --split-string='git reset --hard'",
+        "env -u FOO -S 'git reset --hard'",
+        "sudo --user=bob git reset --hard",
+        "doas git reset --hard",
+        "doas -u root git reset --hard",
+        "chronic git reset --hard",
+        "strace -f git reset --hard",
+        "flock /tmp/lock git reset --hard",
+        "taskset -c 0 git reset --hard",
+        "uv run git reset --hard",
+        "direnv exec . git reset --hard",
+        // The quoted runners hid rm the same way.
+        "watch 'rm -rf ./build'",
+        "watch -n 1 \"rm -rf ./build\"",
+        "parallel ::: 'rm -rf ./build'",
+        "sudo watch 'rm -rf ./build'",
+        "env FOO=1 watch 'rm -rf ./build'",
+        // Other command-string runners, and remote/container runners.
+        "su -c 'git reset --hard'",
+        "su -lc 'rm -rf ./build'",
+        "sg wheel -c 'rm -rf ./build'",
+        "script -qc 'git reset --hard' /dev/null",
+        "nix-shell --run 'rm -rf ./build'",
+        "hyperfine 'git reset --hard'",
+        "ls | entr -s 'git reset --hard'",
+        "ssh host git reset --hard",
+        "docker exec app git reset --hard",
+        "script -q /dev/null git reset --hard",
+    ] {
+        assert!(lab.claude_hook_denies(command), "{command:?}");
+    }
+    for command in [
+        "watch 'git status'",
+        "parallel ::: 'git status'",
+        "parallel echo ::: git reset --hard",
+        "xargs echo git reset --hard",
+        "env -S'git status'",
+        "doas git pull",
+        "uv pip install gitpython",
+        "echo watch 'rm -rf ./build'",
+        "watch -n 5 'ls -la'",
+        "su -c 'git status'",
+        "ssh git@github.com",
+        "hyperfine --warmup 3 'sleep 0.1'",
+    ] {
+        assert!(!lab.claude_hook_denies(command), "{command:?}");
+    }
+}
```

---

### Incident Patch 10: `df1e779a` (2026-09-28)
**Commit Message**: fix(core.filesystem): bracket, slash-spanning brace and pathological root spellings (review of 90f3ba6, GH #502)

Third adversarial review of the #502 root reader, against a release build of
90f3ba6 through the real Claude hook.

- `/e[]t]c/sudoers` was allowed. A `]` right after `[`, `[!` or `[^` is a
  member of the bracket expression, not its close, so `[]t]` is one
  character; the reader closed at the first `]` and read `/e?t…c`, which
  cannot be `/etc`. bracket_expression_end also skips `[:class:]` whole.

- `tee -a /{tmp/x,etc/sudoers}` (and `cp ./x /{tmp/y,home/luna/.netrc}`)
  was allowed: the reader works one `/`-separated component at a time and a
  brace list spanning a `/` is not one component. Such lists are now expanded
  into the words the shell passes (at most 64, past which the word fails
  closed); lists within a component are still matched as patterns.

- Two inputs held the hook for over a minute. The root reader keeps a reading
  per root and length at every position, so `/*/*/…` or `/$x/$x/…` 5,000
  deep cost roughly cubic time (400 deep: 200 ms; 5,000: >60 s). A
  rewritable spelling past 64 components now fails closed without being
  read. And glob_matche

**File**: `src/packs/core/credential_files/shell.rs` (modified, +198/-11)
```diff
@@ -1850,9 +1850,7 @@ impl RootPart {
                     '?' => PatternChar::Any,
                     // A bracket expression matches one character; unclosed,
                     // the shell reads `[` literally, which `*` also covers.
-                    '[' => match (index + 1..chars.len())
-                        .find(|&close| !literal[close] && chars[close] == ']')
-                    {
+                    '[' => match bracket_expression_end(chars, literal, index) {
                         Some(close) => {
                             index = close;
                             PatternChar::Any
@@ -1958,6 +1956,37 @@ impl RootPart {
     }
 }
 
+/// Where the bracket expression opening at `open` closes.
+///
+/// A `]` right after `[`, `[!` or `[^` is a member, not the close, and a
+/// `[:class:]` inside is skipped whole: `/e[]t]c` is `/etc` (bracket `]t`),
+/// and taking its first `]` as the close read it as `/e?t…c`, which cannot be
+/// `/etc`.
+fn bracket_expression_end(chars: &[char], literal: &[bool], open: usize) -> Option<usize> {
+    let mut at = open + 1;
+    if chars.get(at).is_some_and(|ch| matches!(ch, '!' | '^')) {
+        at += 1;
+    }
+    if chars.get(at) == Some(&']') {
+        at += 1;
+    }
+    while at < chars.len() {
+        if chars[at] == '['
+            && let Some(kind @ (':' | '.' | '=')) = chars.get(at + 1).copied()
+            && let Some(end) = (at + 2..chars.len().saturating_sub(1))
+                .find(|&end| chars[end] == kind && chars[end + 1] == ']')
+        {
+            at = end + 2;
+            continue;
+        }
+        if chars[at] == ']' && !literal[at] {
+            return Some(at);
+        }
+        at += 1;
+    }
+    None
+}
+
 /// The non-empty, non-`.` components of an absolute word — the same parts
 /// [`skip_parts`] counts.
 fn root_parts(word: &Word) -> Vec<RootPart> {
@@ -2422,6 +2451,140 @@ fn mentions_runtime_home(command: &str) -> bool {
 /// a rewritten root region can become (see [`rooted_prefixes`]), and none
 /// when it cannot name a protected location.
 fn resolve_all(word: &Word) -> Vec<Spelling> {
+    // The root reader keeps one reading per root and length at every
+    // position, so a long run of rewritable components (`/*/*/*/…`,
+    // `/$x/$x/…`) costs far more than linear time; 5,000 of them held the
+    // hook for over a minute. Real paths are nowhere near this deep, so a
+    // rewritable spelling past the cap is not read and fails closed.
+    if word.text.iter().filter(|ch| **ch == '/').count() > MAX_REWRITTEN_PATH_PARTS
+        && !word.is_all_literal()
+    {
+        return vec![unread_spelling()];
+    }
+    match slash_brace_alternatives(word, MAX_BRACE_ALTERNATIVES) {
+        BraceAlternatives::Words(alternatives) => {
+            alternatives.iter().flat_map(resolve_one).collect()
+        }
+        BraceAlternatives::TooMany => vec![unread_spelling()],
+        BraceAlternatives::NoList => resolve_one(word),
+    }
+}
+
+/// Components a spelling the shell rewrites may have before it is not read.
+const MAX_REWRITTEN_PATH_PARTS: usize = 64;
+
+/// Words a slash-spanning brace list is expanded into before it is not read.
+const MAX_BRACE_ALTERNATIVES: usize = 64;
+
+/// A spelling too costly to read: the word can become some protected file,
+/// which is what an unread one has to be taken to name.
+fn unread_spelling() -> Spelling {
+    Spelling {
+        root: Root::Home,
+        comps: Vec::new(),
+        partial: Some(String::new()),
+        escaped: false,
+        rebased_at_anchor: false,
+        speculative: true,
+    }
+}
+
+/// Expand a brace list whose alternatives contain a `/`.
+///
+/// The root reader works one `/`-separated component at a time, and a brace
+/// list that spans a separator is not a component:
+/// `tee -a /{tmp/x,etc/sudoers}` read as the parts `{tmp` and `etc`… and was
+/// allowed. Such a list is expanded here, into the words the shell hands the
+/// program;
```

**File**: `tests/credential_file_write_e2e.rs` (modified, +51/-0)
```diff
@@ -521,3 +521,54 @@ fn rewritten_and_unknown_base_roots_are_guarded_through_the_hook() {
         assert_eq!(verdict(command, home), Verdict::Allow, "{command}");
     }
 }
+
+/// Third review of #502. A bracket expression whose first member is `]`
+/// (`/e[]t]c` is `/etc`) and a brace list whose alternatives span a `/`
+/// (`/{tmp/x,etc/sudoers}` expands to two words) were allowed; a long run of
+/// rewritable components (`/*/*/…`, `/$x/$x/…`) and a source glob of many
+/// `*?` pairs held the hook for over a minute. The slow ones must answer
+/// within the hook's own budget, and fail closed rather than time out.
+#[test]
+fn bracket_brace_and_pathological_roots_are_guarded_in_bounded_time() {
+    let home = fixture_home();
+    let home = home.path();
+    let deep_stars = format!("echo x >> /{}sudoers", "*/".repeat(5000));
+    let deep_expansions = format!("echo x >> /{}sudoers", "$x/".repeat(5000));
+    let star_pairs = format!("cp ./{} ~/.config/gcloud/", "*?".repeat(40));
+    for command in [
+        "echo x >> /e[]t]c/sudoers",
+        "echo x >> /e[!]x]c/sudoers",
+        "echo x >> /[[:lower:]]tc/sudoers",
+        "echo x | tee -a /{etc/sudoers,tmp/x}",
+        "echo x | tee -a /{tmp/x,etc/sudoers}",
+        "cp ./x /{tmp/y,home/luna/.netrc}",
+        "echo x | tee -a /{tmp/x,{var/y,etc/sudoers}}",
+        deep_stars.as_str(),
+        deep_expansions.as_str(),
+    ] {
+        let started = std::time::Instant::now();
+        assert_ne!(verdict(command, home), Verdict::Allow, "{command:.80}");
+        assert!(
+            started.elapsed() < std::time::Duration::from_secs(5),
+            "{command:.80} took {:?}",
+            started.elapsed()
+        );
+    }
+    // No gcloud file name is 40 characters long, so this may be allowed; it
+    // must only be decided quickly.
+    let started = std::time::Instant::now();
+    let _ = verdict(&star_pairs, home);
+    assert!(
+        started.elapsed() < std::time::Duration::from_secs(5),
+        "a glob of 40 `*?` pairs took {:?}",
+        started.elapsed()
+    );
+    for command in [
+        "echo x | tee -a /{tmp/x,var/tmp/y}",
+        "echo x > /tmp/{a,b}/c.txt",
+        "echo x >> /e[]x]c/notes.txt",
+        "cp ./*.txt /tmp/out/",
+    ] {
+        assert_eq!(verdict(command, home), Verdict::Allow, "{command}");
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #507** (2026-09-28): deps(deps): bump the rust-minor-patch group with 2 updates (@dependabot[bot])
- **PR #506** (2026-09-28): ci(deps): bump the actions group with 2 updates (@dependabot[bot])
- **PR #463** (2026-09-21): deps(deps): bump the rust-minor-patch group with 3 updates (@dependabot[bot])
- **PR #462** (2026-09-21): ci(deps): bump the actions group with 4 updates (@dependabot[bot])
- **PR #436** (closed): fix: harden argument-data safe exemptions tracked in #435 (@Dicklesworthstone)
- **PR #415** (closed): deps(deps): bump smallvec from 1.16.0 to 1.16.1 in the rust-minor-patch group across 1 directory (@dependabot[bot])
- **PR #414** (closed): deps(deps): bump dirs from 6.0.0 to 7.0.0 (@dependabot[bot])
- **PR #413** (closed): deps(deps): bump the rust-minor-patch group with 4 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
