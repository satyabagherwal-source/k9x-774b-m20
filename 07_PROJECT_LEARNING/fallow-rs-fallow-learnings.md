> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source**: github ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Source Version**: `9c6fc8a2`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T12:45:30.078Z  
> **Learning ID**: `learn-github-fallow-rs-fallow`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): fallow-rs/fallow

> **Canonical Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T12:45:29.288Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5241 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/hooks/pre-bash-guard.py`
```
#!/usr/bin/env python3
"""Pre-Bash guard for fallow agent sessions.

Detection works on a quote-aware token walk rather than raw-string regex, so a
command that only *mentions* `fallow`/`git commit` as data (a heredoc, an echo,
a test fixture) is never flagged, while chained or env-prefixed real invocations
(`cargo fmt && git commit`, `A=1 git commit`, `cat x | fallow`) still are.
"""
import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

# Shell tokens that separate one command from the next.
SEPARATORS = {";", "&&", "||", "|", "&", "|&"}
# Cargo subcommands whose `--workspace` output floods context when unredirected.
CARGO_NOISY = {"build", "test", "clippy", "doc"}
# Commands that, in the final pipeline position, bound what reaches the terminal.
BOUNDING_PAGERS = {"tail", "head", "less", "more", "wc", "grep", "rg"}
# npm-style wrappers that fetch and run a *different* fallow binary.
WRAPPERS = {"npx", "bunx"}
ENV_ASSIGN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    if payload.get("tool_name") != "Bash":
        return 0

    command = str(payload.get("tool_input", {}).get("command", "") or "")
    if not command:
        return 0

    if "SKIP_FALLOW_AGENT_GUARD=1" in command:
        return 0

    cwd = Path(str(payload.get("cwd") or os.getcwd())).resolve()
    repo = find_repo_root(cwd)
    if repo is None:
        return 0

    commands = command_positions(command)
    if commands is None:
        return 0

    if uses_foreign_fallow(commands):
        deny(
            "Use `cargo run --bin fallow --` (builds if needed) or `./target/debug/fallow` "
            "inside this checkout instead of an installed `fallow`. "
            "Set `SKIP_FALLOW_AGENT_GUARD=1` only when you intentionally need a different binary."
        )
        return 0

    if uses_unbounded_workspace_cargo(command, commands):
        deny(
            "Redirect full workspace cargo output to a log and return only the tail, for example "
            "`cargo test --workspace --lib --bins --tests --examples "
            "> /tmp/fallow-test.log 2>&1; tail -80 /tmp/fallow-test.log`."
        )
        return 0

    if commits_via_git(commands):
        staged = git_lines(repo, ["diff", "--cached", "--name-only"])
        if needs_vscode_dist(repo, staged):
            deny(
                "VS Code extension runtime files are staged without the tracked dist bundle. "
                "Run `pnpm --dir editors/vscode run build`, "
                "`pnpm --dir editors/vscode run check:contracts`, and "
                "`pnpm --dir editors/vscode run lint`, then stage the generated dist files. "
                "Set `SKIP_FALLOW_AGENT_GUARD=1` only if this commit is intentionally source-only."
            )

    return 0


def find_repo_root(cwd: Path) -> Path | None:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=cwd,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None

    root = Path(out).resolve()
    # Gate on a committed sentinel so the guard activates on every clone/CI, not
    # only machines that carry the gitignored, codex-local root AGENTS.md.
    if (root / "crates" / "cli" / "AGENTS.md").is_file():
        return root
    return None


def command_positions(command: str) -> list[list[str]] | None:
    """Split a command line into the argv of each pipeline/list segment.

    shlex is quote-aware, so `echo "a && fallow b"` yields a single data token
    and never a command-position `fallow`. Returns None when the line cannot be
    tokenized (an unbalanced quote means we should not guess).
    """
    try:
        tokens = shlex.split(command, posix=True)
    except ValueError:
        return None

    segments: list[list[str]] = []
    current: list[str] = []
    for token in tokens:
        if token in SEPARATORS:
            if current:
                segments.append(current)
                current = []
        else:
            current.append(token)
    if current:
        segments.append(current)

    return [argv for argv in (strip_env(seg) for seg in segments) if argv]


def strip_env(segment: list[str]) -> list[str]:
    index = 0
    while index < len(segment) and ENV_ASSIGN.match(segment[index]):
        index += 1
    return segment[index:]


def uses_foreign_fallow(commands: list[list[str]]) -> bool:
    for argv in commands:
        name = Path(argv[0]).name
        if name == "fallow" and not is_local_target(argv[0]):
            return True
        if name in WRAPPERS and len(argv) >= 2 and argv[1] == "fallow":
            return True
    return False


def is_local_target(executable: str) -> bool:
    normalized = executable.replace("\\", "/")
    return (
        normalized.startswith("./target/")
        or normalized.startswith("target/")
        or "/target/" in normalized
    )


def uses_unbounded_workspace_cargo(command: str, commands: list[list[str]]) -> bool:
    cargo = next(
        (
            argv
            for argv in commands
            if Path(argv[0]).name == "cargo"
            and len(argv) >= 2
            and argv[1] in CARGO_NOISY
            and "--workspace" in argv
        ),
        None,
    )
    if cargo is None:
        return False
    return not output_is_bounded(command, commands)


def output_is_bounded(command: str, commands: list[list[str]]) -> bool:
    # A redirect (`> log`, `2>&1`) keeps output off the terminal entirely.
    if ">" in command:
        return True
    # A trailing pager (`| tail -80`) keeps only a slice in context. `tee` does
    # not count: it passes everything through to stdout.
    last = commands[-1]
    return Path(last[0]).name in BOUNDING_PAGERS


def commits_via_git(commands: list[list[str]]) -> bool:
    return any(
        Path(argv[0]).name == "git" and len(argv) >= 2 and argv[1] == "commit"
        for argv in commands
    )


def git_lines(repo: Path, args: list[str]) -> list[str]:
    try:
        out = subprocess.check_output(["git", *args], cwd=repo, text=True, stderr=subprocess.DEVNULL)
    except (OSError, subprocess.CalledProcessError):
        return []
    return [line.strip() for line in out.splitlines() if line.strip()]


def needs_vscode_dist(repo: Path, paths: list[str]) -> bool:
    runtime = [
        path
        for path in paths
        if path.startswith("editors/vscode/src/")
        and path.endswith((".ts", ".tsx"))
        and not path.startswith("editors/vscode/src/generated/")
        and "/test/" not in path
        and not path.endswith(".test.ts")
    ]
    if not runtime:
        return False

    tracked_dist = set(
        git_lines(
            repo,
            [
                "ls-files",
                "editors/vscode/dist/extension.js",
                "editors/vscode/dist/extension.js.map",
            ],
        )
    )
    if not tracked_dist:
        return False

    return not tracked_dist.intersection(paths)


def deny(reason: str) -> None:
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `assets/demo-project/src/utils/format.ts`
```
export const formatDate = (date: Date): string => date.toISOString();

export const formatCurrency = (amount: number): string => `$${amount.toFixed(2)}`;

export const formatPercentage = (value: number): string => `${(value * 100).toFixed(1)}%`;

```

### Core Architecture Module: `assets/demo-project/src/utils/validate.ts`
```
export const validateEmail = (email: string): boolean => email.includes('@');

export const validatePhone = (phone: string): boolean => /^\d{10}$/.test(phone);

```

### Core Architecture Module: `crates/api/src/mutation/companion/runtime/child-hooks.mjs`
```
// Generated from tools/mutation-runner/src/runtime/child-hooks.mjs. Do not edit.
import { installFallowMutation } from "./global.mjs";

/**
 * Installs the runtime for one test file process and its test hooks. The
 * process loads one test file, so each module-scope hit belongs to this
 * file. The active mutant is set before the test file imports a source file.
 *
 * `report(row, context)` gets `{ hits, static_hits, overlap }` for each
 * finished test, with the argument of the `afterEach` hook. `overlap` is true
 * when tests ran at the same time (for example concurrent tests). The hits
 * then cannot name their test, so the adapter gives each test of the file
 * the hits of the file.
 */
export const installChildHooks = ({ active, beforeEach, afterEach, report }) => {
  const mutation = installFallowMutation();
  mutation.startFile();
  mutation.setActive(active);
  let running = 0;
  let overlap = false;

  beforeEach(() => {
    running += 1;
    overlap ||= running > 1;
    mutation.startTest();
  });

  // A rest parameter keeps the function length at 0. Bun reads a hook with a
  // parameter as a hook that waits for a `done` callback.
  afterEach((...args) => {
    running = Math.max(0, running - 1);
    const { hits, staticHits } = mutation.finishTest();
    report({ hits, static_hits: staticHits, overlap }, args[0]);
  });
};

```

### Core Architecture Module: `crates/api/src/mutation/companion/runtime/overlay-hook.mjs`
```
// Generated from tools/mutation-runner/src/runtime/overlay-hook.mjs. Do not edit.
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

import { realPath } from "./child.mjs";

/**
 * Serves the instrumented file of each overlay entry in place of its source
 * file. `onLoad(entry)` runs for each served file.
 *
 * A synchronous hook runs in this thread for `import` and `require`. It keeps
 * the format of the original file, so Node strips the types of a TypeScript
 * file as it does without the overlay.
 */
export const registerOverlayHook = (overlay, onLoad = () => {}) => {
  const overlayEntry = (url) => {
    if (!url.startsWith("file:")) return undefined;
    return overlay.get(realPath(fileURLToPath(url)));
  };
  registerHooks({
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      const entry = overlayEntry(url);
      if (entry === undefined) return result;
      onLoad(entry);
      return { ...result, source: readFileSync(entry.target, "utf8"), shortCircuit: true };
    },
  });
};

```

### Core Architecture Module: `crates/benchmarks/benches/component_engine.rs`
```
#![expect(
    clippy::unwrap_used,
    clippy::expect_used,
    reason = "benches use unwrap and expect to keep fixture setup concise"
)]
#![allow(
    clippy::significant_drop_tightening,
    reason = "the external Criterion macro owns the benchmark lifecycle"
)]

use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

use criterion::{BatchSize, Criterion, criterion_group, criterion_main};
use fallow_config::{
    DuplicatesConfig, EffectKind, EmailMode, FallowConfig, RulePackDef, RulePackRule,
    RulePackRuleKind, RulesConfig, Severity,
};
use fallow_engine::{
    guard::build_guard_report,
    health::{
        HealthCoverageInputs, HealthExecutionOptions, HealthGateOptions, HealthSort,
        HealthThresholdOverrides, run_ungrouped_health_with_session,
    },
    project_analysis::ProjectAnalysisArtifactOptions,
    session::AnalysisSession,
    trace_chain::trace_symbol_chain_with_session,
};
use fallow_output::{
    CoverageSource, HealthReport, SuppressionInventoryOutputInput,
    build_suppression_inventory_output, serialize_suppression_inventory_json_output,
};
use fallow_types::output_format::OutputFormat;
use fallow_types::trace_chain::{SymbolChainQuery, TraceDirections};
use tempfile::TempDir;

#[path = "support/threads.rs"]
mod threads;

use threads::bench_threads;

const FILE_COUNT: usize = 32;
const WARM_FILE_COUNT: usize = 256;
const CHURN_EVENTS_PER_FILE: usize = 4;
const SECONDS_PER_DAY: u64 = 86_400;
const COVERAGE_GAP_RUNTIME_FILE_COUNT: usize = 256;
const COVERAGE_GAP_COVERED_FILE_COUNT: usize = COVERAGE_GAP_RUNTIME_FILE_COUNT / 2;
const WARM_CSS_FILE_COUNT: usize = 96;
const CSS_REFERENCE_PATTERNS_PER_CONSUMER: usize = 4;
const WARM_CSS_CONSUMER_FILE_COUNT: usize =
    WARM_CSS_FILE_COUNT / CSS_REFERENCE_PATTERNS_PER_CONSUMER;
const WARM_CSS_TOKENS_PER_FILE: usize = 32;
const CSS_DEEP_THEME_FILE_COUNT: usize = 16;
const CSS_DEEP_COLORS_PER_FILE: usize = 12;
const CSS_DEEP_CVA_FILE_COUNT: usize = 32;
const GUARD_FILE_COUNT: usize = 32;
const GUARD_RULE_COUNT: usize = 8;
const TRACE_CALLER_COUNT: usize = 128;
const SUPPRESSION_FILE_COUNT: usize = 128;
const SUPPRESSIONS_PER_FILE: usize = 4;
const ISTANBUL_CRAP_FILE_COUNT: usize = 128;
const ISTANBUL_FUNCTIONS_PER_FILE: usize = 2;
const ISTANBUL_MATCHED_FUNCTION_COUNT: usize =
    ISTANBUL_CRAP_FILE_COUNT * ISTANBUL_FUNCTIONS_PER_FILE;
const ISTANBUL_CRAP_FINDING_COUNT: usize = ISTANBUL_CRAP_FILE_COUNT;
const ISTANBUL_FALLBACK_DECL_LINE: u32 = 11;
const ISTANBUL_FALLBACK_BODY_LINE: u32 = 12;
const ISTANBUL_FALLBACK_PRODUCER_LINE: u32 = 14;

struct EngineFixture {
    _temp_dir: TempDir,
    root: PathBuf,
}

struct WarmEngineFixture {
    fixture: EngineFixture,
    session: AnalysisSession,
    config_path: Option<PathBuf>,
}

struct HotspotOwnershipFixture {
    fixture: WarmEngineFixture,
    churn_file: PathBuf,
}

struct IstanbulCrapFixture {
    fixture: WarmEngineFixture,
    _coverage_temp_dir: TempDir,
    coverage_path: PathBuf,
}

struct CssDeepEngineFixture {
    fixture: WarmEngineFixture,
    changed_files: Vec<PathBuf>,
}

struct GuardFixture {
    _temp_dir: TempDir,
    config: fallow_config::ResolvedConfig,
    files: Vec<String>,
}

/// Loads a default session whose file walk uses the benchmark thread count.
fn load_session(root: &Path) -> AnalysisSession {
    AnalysisSession::load_default_with_config(root, |config| config.threads = bench_threads())
}

fn write_file(root: &Path, path: &str, source: impl AsRef<str>) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().expect("fixture file has parent")).unwrap();
    fs::write(path, source.as_ref()).unwrap();
}

fn create_engine_fixture() -> EngineFixture {
    create_engine_fixture_with_file_count(FILE_COUNT)
}

fn create_engine_fixture_with_file_count(file_count: usize) -> EngineFixture {
    let temp_dir = TempDir::new().unwrap();
    let root = temp_dir.path().to_path_buf();
    write_file(
        &root,
        "package.json",
        r#"{"name":"bench-engine","private":true,"type":"module","main":"src/index.ts","dependencies":{}}"#,
    );

    let mut imports = String::new();
    let mut uses = String::new();
    for index in 0..file_count {
        write_file(
            &root,
            &format!("src/module-{index}.ts"),
            format!(
                r"
export const live{index} = {index};
export const unused{index} = live{index} + 1;
export function compute{index}(input: number): number {{
  let value = input;
  value += live{index};
  value += {index};
  return value;
}}
"
            ),
        );
        if index % 2 == 0 {
            writeln!(
                &mut imports,
                "import {{ live{index} }} from './module-{index}';"
            )
            .unwrap();
            writeln!(&mut uses, "console.log(live{index});").unwrap();
        }
    }
    write_file(&root, "src/index.ts", format!("{imports}\n{uses}\n"));
    write_file(
        &root,
        "src/styles.css",
        ":root { --color-accent: #06c; }\n.button { color: var(--color-accent); padding: 0.5rem 1rem; }\n",
    );

    EngineFixture {
        _temp_dir: temp_dir,
        root,
    }
}

fn create_guard_fixture() -> GuardFixture {
    let temp_dir = TempDir::new().unwrap();
    let root = temp_dir.path().to_path_buf();
    let mut rules = Vec::with_capacity(GUARD_RULE_COUNT);
    for rule_index in 0..GUARD_RULE_COUNT {
        rules.push(RulePackRule {
            id: format!("team-{rule_index}-network"),
            kind: RulePackRuleKind::BannedEffect,
            callees: Vec::new(),
            specifiers: Vec::new(),
            effects: vec![EffectKind::Network],
            exports: Vec::new(),
            allowed_files: Vec::new(),
            proof_kinds: Vec::new(),
            ignore_type_only: false,
            files: vec![format!("src/team-{rule_index}/**")],
            exclude: vec![format!("src/team-{rule_index}/generated/**")],
            zones: Vec::new(),
            message: None,
            severity: None,
        });
    }
    let mut config = FallowConfig {
        rules: RulesConfig {
            policy_violation: Severity::Warn,
            ..RulesConfig::default()
        },
        ..FallowConfig::default()
    }
    .resolve(
        root.clone(),
        OutputFormat::Json,
        bench_threads(),
        true,
        true,
        None,
    );
    config.rule_packs = vec![RulePackDef {
        schema: None,
        version: 1,
        name: "guard-benchmark".to_string(),
        description: None,
        rules,
    }];

    let mut files = Vec::with_capacity(GUARD_FILE_COUNT);
    for file_index in 0..GUARD_FILE_COUNT {
        let file = format!(
            "src/team-{}/feature-{file_index}.ts",
            file_index % GUARD_RULE_COUNT
        );
        write_file(&root, &file, "export const enabled = true;\n");
        files.push(file);
    }

    GuardFixture {
        _temp_dir: temp_dir,
        config,
        files,
    }
}

fn create_trace_engine_fixture() -> WarmEngineFixture {
    let temp_dir = TempDir::new().unwrap();
    let root = temp_dir.path().to_path_buf();
    write_file(
        &root,
        "package.json",
        r#"{"name":"bench-trace","private":true,"type":"module","main":"src/index.ts","dependencies":{}}"#,
    );
    write_file(
        &root,
        "src/leaf.ts",
        "export function leaf(value: number): number { return value + 1; }\n",
    );
    write_file(
        &root,
        "src/shared.ts",
        "import { leaf } from './leaf';\nexport function target(value: number): number { return leaf(value); }\n",
    );

    let mut entry_imports = String::new();
    let mut entry_uses = String::from("console.log(");
    for index in 0..TRACE_CALLER_COUNT {
        write_file(
            &root,
            &format!("src/consumer-{index}.ts"),
            format!(
                "import {{ target }} from './shared';\nexport function consumer{index}(): number {{ return target({index}); }}\n"
            ),
        );
        writeln!(
            &mut entry_imports,
            "import {{ consumer{index} }} from './consumer-{index}';"
        )
        .unwrap();
        if index > 0 {
            entry_uses.push_str(", ");
        }
        write!(&mut entry_uses, "consumer{index}()").unwrap();
    }
    entry_uses.push_str(");\n");
    write_file(
        &root,
        "src/index.ts",
        format!("{entry_imports}\n{entry_uses}"),
    );

    let fixture = EngineFixture {
        _temp_dir: temp_dir,
        root,
    };
    let session = load_session(&fixture.root);
    WarmEngineFixture {
        fixture,
        session,
        config_path: None,
    }
}

fn create_suppression_inventory_fixture() -> WarmEngineFixture {
    let temp_dir = TempDir::new().unwrap();
    let root = temp_dir.path().to_path_buf();
    write_file(
        &root,
        "package.json",
        r#"{"name":"bench-suppressions","private":true,"type":"module","main":"src/index.ts","dependencies":{}}"#,
    );
    write_file(&root, "src/index.ts", "export const entry = true;\n");

    for file_index in 0..SUPPRESSION_FILE_COUNT {
        let mut source = String::new();
        for marker_index in 0..SUPPRESSIONS_PER_FILE {
            writeln!(
                &mut source,
                "// fallow-ignore-next-line unused-export -- benchmark migration\nexport const unused_{file_index}_{marker_index} = {marker_index};"
            )
            .unwrap();
        }
        write_file(&root, &format!("src/legacy/module-{file_index}.ts"), source);
    }

    let fixture = EngineFixture {
        _temp_dir: temp_dir,
        root,
    };
    let session = load_session(&fixture.root);
    session
        .analyze_dead_code_with_artifacts(false, false)
        .expect("suppression inventory warm-up succeeds");
    WarmEngineFixture {
        fixture,
        session,
        config_path: None,
    }
}

fn suppression_inventory_json(fixture: &WarmEngineFixture) -> serde_json::Value 
```

### Core Architecture Module: `crates/cli/src/agent_install/hooks.rs`
```
//! Hooks step: the commit and push gate, delegated to the
//! `hooks install --target agent` engine so both entry points stay
//! byte-identical.

use super::{Ctx, Harness, Mode, Reason, Scope, Step, StepReport, StepStatus};
use crate::setup_hooks::{
    AgentsBlockReport, AgentsOutcome, GateReport, HookAgentArg, ScriptOutcome, SettingsOutcome,
    SetupHooksOptions, execute_agent_hooks,
};

pub fn install(ctx: &Ctx, harnesses: &[Harness]) -> Vec<StepReport> {
    harnesses.iter().flat_map(|h| run(ctx, *h)).collect()
}

pub fn uninstall(ctx: &Ctx, harnesses: &[Harness]) -> Vec<StepReport> {
    harnesses.iter().flat_map(|h| run(ctx, *h)).collect()
}

fn run(ctx: &Ctx, harness: Harness) -> Vec<StepReport> {
    let agent = match harness {
        Harness::Claude => HookAgentArg::Claude,
        Harness::Codex => HookAgentArg::Codex,
        Harness::Cursor => {
            return vec![
                StepReport::new(Some(harness), Step::Hooks, StepStatus::Skipped, ctx.scope())
                    .reason(Reason::UnsupportedHarness)
                    .detail("Cursor's beforeShellExecution hook uses a different contract; Cursor still reads AGENTS.md"),
            ];
        }
    };
    let opts = SetupHooksOptions {
        root: &ctx.root,
        agent: Some(agent),
        dry_run: ctx.dry_run,
        force: ctx.force,
        user: ctx.user,
        home: ctx.home.as_deref(),
        gitignore_claude: ctx.gitignore_claude,
        uninstall: ctx.mode == Mode::Uninstall,
    };
    let report = match execute_agent_hooks(&opts, ctx.mode) {
        Ok(Some(report)) => report,
        Ok(None) => return Vec::new(),
        Err(message) => {
            return vec![StepReport::failed(
                Some(harness),
                Step::Hooks,
                ctx.scope(),
                message,
            )];
        }
    };

    let mut steps: Vec<StepReport> = Vec::new();
    if let Some(claude) = report.claude {
        steps.extend(gate_steps(ctx, harness, &claude, "PreToolUse gate handler"));
    }
    if let Some(codex) = report.codex {
        steps.extend(gate_steps(
            ctx,
            harness,
            &codex.gate,
            "PreToolUse gate handler; Codex runs it after you trust it in /hooks",
        ));
        if let Some(block) = &codex.agents_block {
            steps.push(routing_block_step(ctx, harness, block));
        }
    }
    steps
}

/// Rows for one script-backed gate: the hook config handler and the script.
fn gate_steps(
    ctx: &Ctx,
    harness: Harness,
    gate: &GateReport,
    handler_detail: &str,
) -> Vec<StepReport> {
    let settings_status = match (&gate.settings_outcome, ctx.mode) {
        (SettingsOutcome::Created | SettingsOutcome::Updated { .. }, Mode::Install) => {
            StepStatus::Written
        }
        (SettingsOutcome::Updated { .. }, Mode::Uninstall) => StepStatus::Removed,
        (SettingsOutcome::Created, Mode::Uninstall) => StepStatus::Unchanged,
        (SettingsOutcome::Unchanged { .. } | SettingsOutcome::NotPresent, _) => {
            StepStatus::Unchanged
        }
    };
    let handler = StepReport::new(Some(harness), Step::Hooks, settings_status, ctx.scope())
        .path(ctx, &gate.settings_path)
        .detail(handler_detail);
    let (script_status, reason) = match gate.script_outcome {
        ScriptOutcome::Created | ScriptOutcome::Updated => (StepStatus::Written, None),
        ScriptOutcome::Removed => (StepStatus::Removed, None),
        ScriptOutcome::Unchanged | ScriptOutcome::NotPresent => (StepStatus::Unchanged, None),
        ScriptOutcome::UserEditedPreserved => (StepStatus::Refused, Some(Reason::UserEdited)),
    };
    let mut script = StepReport::new(Some(harness), Step::Hooks, script_status, ctx.scope())
        .path(ctx, &gate.script_path)
        .detail("gate script");
    if matches!(gate.script_outcome, ScriptOutcome::UserEditedPreserved) {
        script.detail = Some("no fallow marker; pass --force to replace it".to_string());
    }
    script.reason = reason;
    vec![handler, script]
}

fn routing_block_step(ctx: &Ctx, harness: Harness, block: &AgentsBlockReport) -> StepReport {
    let (status, reason) = match block.outcome {
        AgentsOutcome::Inserted | AgentsOutcome::Replaced => (StepStatus::Written, None),
        AgentsOutcome::Removed => (StepStatus::Removed, None),
        AgentsOutcome::Unchanged | AgentsOutcome::NotPresent => (StepStatus::Unchanged, None),
        AgentsOutcome::MalformedPreserved => {
            (StepStatus::Refused, Some(Reason::ManagedBlockMalformed))
        }
    };
    let detail = match block.outcome {
        AgentsOutcome::MalformedPreserved => {
            "fallow markers are out of order; repair AGENTS.md by hand".to_string()
        }
        _ => "routing block".to_string(),
    };
    let mut step = StepReport::new(Some(harness), Step::Hooks, status, Scope::Shared)
        .path(ctx, &block.path)
        .detail(detail);
    step.reason = reason;
    step
}

```

### Core Architecture Module: `crates/cli/src/cli_hooks.rs`
```
use std::path::Path;
use std::process::ExitCode;

use crate::error::emit_error;
use crate::init;
use crate::setup_hooks;

#[derive(clap::ValueEnum, Clone, Copy, Debug, PartialEq, Eq)]
pub enum HooksTargetArg {
    /// Shell-level Git pre-commit hook under .git/hooks/ or .husky/.
    Git,
    /// Agent-level Claude Code / Codex gate.
    Agent,
}

#[derive(clap::Subcommand)]
pub enum HooksCli {
    /// Show installed hook state for Git, Claude, and Codex surfaces.
    Status,

    /// Install a fallow-managed hook.
    Install {
        /// Hook surface to install.
        #[arg(long, value_enum)]
        target: HooksTargetArg,

        /// Fallback base branch/ref for Git pre-commit hooks when no upstream is set.
        #[arg(long)]
        branch: Option<String>,

        /// Target a specific agent surface when --target agent is used.
        #[arg(long, value_enum)]
        agent: Option<setup_hooks::HookAgentArg>,

        /// Print what would be written without touching the filesystem.
        #[arg(long)]
        dry_run: bool,

        /// Overwrite an existing managed or user-edited hook.
        #[arg(long)]
        force: bool,

        /// Write agent hooks to the user's home directory instead of the project root.
        #[arg(long)]
        user: bool,

        /// Append `.claude/` to the project's `.gitignore` for Claude agent hooks.
        #[arg(long)]
        gitignore_claude: bool,

        /// For `--target git`: run `fallow baselines prune` before the audit
        /// and stage the pruned baseline files. The hook skips the prune when
        /// the working tree has unstaged or untracked changes and for a commit
        /// with paths. A failed prune never blocks the commit. The prune analyzes the whole project, so it adds
        /// the time of a full run to each commit.
        #[arg(long)]
        prune_baselines: bool,
    },

    /// Remove a fallow-managed hook.
    Uninstall {
        /// Hook surface to remove.
        #[arg(long, value_enum)]
        target: HooksTargetArg,

        /// Target a specific agent surface when --target agent is used.
        #[arg(long, value_enum)]
        agent: Option<setup_hooks::HookAgentArg>,

        /// Print what would be removed without touching the filesystem.
        #[arg(long)]
        dry_run: bool,

        /// Remove a user-edited hook script or Git hook instead of preserving it.
        #[arg(long)]
        force: bool,

        /// Remove agent hooks from the user's home directory instead of the project root.
        #[arg(long)]
        user: bool,
    },
}

pub fn run_hooks_command(
    root: &Path,
    subcommand: HooksCli,
    output: fallow_config::OutputFormat,
    json_style: crate::json_style::JsonStyle,
) -> ExitCode {
    match subcommand {
        HooksCli::Status => setup_hooks::run_hooks_status(root, output, json_style),
        install @ HooksCli::Install { .. } => run_hooks_install(root, install, output),
        uninstall @ HooksCli::Uninstall { .. } => run_hooks_uninstall(root, &uninstall, output),
    }
}

/// Handle `fallow hooks install` for both the git and agent targets.
fn run_hooks_install(
    root: &Path,
    install: HooksCli,
    output: fallow_config::OutputFormat,
) -> ExitCode {
    let HooksCli::Install {
        target,
        branch,
        agent,
        dry_run,
        force,
        user,
        gitignore_claude,
        prune_baselines,
    } = install
    else {
        unreachable!("hooks install handler only handles install commands");
    };

    match target {
        HooksTargetArg::Git => {
            if agent.is_some() || user || gitignore_claude {
                return emit_error(
                    "--agent, --user, and --gitignore-claude are only valid with `fallow hooks install --target agent`",
                    2,
                    output,
                );
            }
            init::run_git_hooks_install(&init::GitHooksInstallOptions {
                root,
                branch: branch.as_deref(),
                dry_run,
                force,
                prune_baselines,
            })
        }
        HooksTargetArg::Agent => {
            if branch.is_some() || prune_baselines {
                return emit_error(
                    "--branch and --prune-baselines are only valid with `fallow hooks install --target git`",
                    2,
                    output,
                );
            }
            setup_hooks::run_setup_hooks_with_label(
                &setup_hooks::SetupHooksOptions {
                    root,
                    agent,
                    dry_run,
                    force,
                    user,
                    home: None,
                    gitignore_claude,
                    uninstall: false,
                },
                "fallow hooks install --target agent",
            )
        }
    }
}

/// Handle `fallow hooks uninstall` for both the git and agent targets.
fn run_hooks_uninstall(
    root: &Path,
    uninstall: &HooksCli,
    output: fallow_config::OutputFormat,
) -> ExitCode {
    let HooksCli::Uninstall {
        target,
        agent,
        dry_run,
        force,
        user,
    } = *uninstall
    else {
        unreachable!("hooks uninstall handler only handles uninstall commands");
    };

    match target {
        HooksTargetArg::Git => {
            if agent.is_some() || user {
                return emit_error(
                    "--agent and --user are only valid with `fallow hooks uninstall --target agent`",
                    2,
                    output,
                );
            }
            init::run_git_hooks_uninstall(&init::GitHooksUninstallOptions {
                root,
                dry_run,
                force,
            })
        }
        HooksTargetArg::Agent => setup_hooks::run_setup_hooks_with_label(
            &setup_hooks::SetupHooksOptions {
                root,
                agent,
                dry_run,
                force,
                user,
                home: None,
                gitignore_claude: false,
                uninstall: true,
            },
            "fallow hooks uninstall --target agent",
        ),
    }
}

```

### Core Architecture Module: `crates/cli/src/path_util.rs`
```
//! Re-export of cross-platform path classification helpers.

pub use fallow_types::path_util::{
    is_absolute_path_any_platform, looks_like_windows_absolute_path,
};

```

### Core Architecture Module: `crates/cli/src/setup_hooks.rs`
```
//! `fallow setup-hooks`: generate or remove the Claude Code and Codex
//! PreToolUse gate files for this repo. For Codex it also maintains a routing
//! block in `AGENTS.md`.
//!
//! Both harnesses run the same gate script. Claude Code reads the handler from
//! `.claude/settings.json`, and Codex reads it from `.codex/hooks.json`.
//!
//! The gate intercepts the agent's Bash tool when the command is `git commit`
//! or `git push`, runs `fallow audit --format json --quiet --explain`, and
//! blocks only on `verdict: "fail"`. The audit JSON is written to stderr so
//! the agent can read `_meta.docs` links and `actions`, fix the findings,
//! and retry.
//!
//! `fallow setup-hooks` itself is deprecated (removed in the next major);
//! the engine stays because `fallow hooks install --target agent` and
//! `fallow agent install` run through it. For the *git pre-commit* hook
//! scaffolder, see `fallow hooks install --target git`. The two targets write
//! to different surfaces: Git hooks write into `.git/hooks/` or `.husky/`, and
//! agent hooks write into `.claude/` / `AGENTS.md`.

use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use serde::Serialize;

/// Agent target for generated hook artifacts.
#[derive(Clone, Copy, Debug, PartialEq, Eq, clap::ValueEnum)]
pub enum HookAgentArg {
    /// Claude Code: project-level `.claude/settings.json` + hook script.
    Claude,
    /// Codex: `.codex/hooks.json` PreToolUse gate + hook script, plus a
    /// routing block in `AGENTS.md`.
    Codex,
}

/// CLI options for `fallow setup-hooks`.
pub struct SetupHooksOptions<'a> {
    pub root: &'a Path,
    pub agent: Option<HookAgentArg>,
    pub dry_run: bool,
    pub force: bool,
    pub user: bool,
    /// Home directory for `--user` targets; `None` reads `$HOME`.
    pub home: Option<&'a Path>,
    pub gitignore_claude: bool,
    pub uninstall: bool,
}

impl SetupHooksOptions<'_> {
    /// Base directory for harness files: the home directory under `--user`,
    /// otherwise the project root.
    fn scope_base(&self) -> Result<PathBuf, String> {
        if !self.user {
            return Ok(self.root.to_path_buf());
        }
        // A unit test that falls back to `$HOME` writes into the real home
        // directory of the developer.
        #[cfg(test)]
        assert!(
            self.home.is_some(),
            "user scope in a unit test: pass an explicit home"
        );
        self.home
            .map(Path::to_path_buf)
            .or_else(home_dir)
            .ok_or_else(|| {
                "Cannot resolve user home directory; unset --user or set $HOME.".to_string()
            })
    }
}

/// Template content of `.claude/hooks/fallow-gate.sh`. Contains the
/// `@@FALLOW_INSTALLER_VERSION@@` placeholder; use [`rendered_gate_script`] to
/// obtain the install-ready bytes.
pub const FALLOW_GATE_SCRIPT: &str = include_str!("setup_hooks/fallow-gate.sh");

/// Marker substituted at install time by [`rendered_gate_script`]. Follows the
/// autotools `@@NAME@@` convention: grep-friendly, bash-safe, unambiguously
/// "already rendered" when read in an installed script.
const INSTALLER_VERSION_PLACEHOLDER: &str = "@@FALLOW_INSTALLER_VERSION@@";

/// Render the gate script with install-time substitutions applied. Stamps the
/// fallow version that invoked `setup-hooks` into a header comment for
/// forensics; the enforced `FALLOW_GATE_MIN_VERSION` default stays hand-bumped
/// by maintainers when a correctness-affecting filtering fix lands, and is
/// intentionally NOT substituted here.
#[must_use]
pub fn rendered_gate_script() -> String {
    FALLOW_GATE_SCRIPT.replace(INSTALLER_VERSION_PLACEHOLDER, env!("CARGO_PKG_VERSION"))
}

/// Static content of `.claude/settings.json` when no prior file exists.
pub const CLAUDE_SETTINGS_DEFAULT: &str = include_str!("setup_hooks/settings.json");

/// Managed-block start marker for the AGENTS.md routing block.
pub const AGENTS_BLOCK_START: &str = "<!-- fallow:setup-hooks:start -->";
/// Managed-block end marker for the AGENTS.md routing block.
pub const AGENTS_BLOCK_END: &str = "<!-- fallow:setup-hooks:end -->";

/// Prose body of the managed block that `fallow setup-hooks` maintains in
/// `AGENTS.md`. The block routes agents to fallow; the PreToolUse hooks do
/// the enforcement. The `start` and `end` markers bracket the full body (this
/// prose plus the task-to-command matrix appended by `agents_block_body`) so
/// re-runs replace it in place rather than appending duplicates.
pub const AGENTS_BLOCK_BODY: &str = "## Fallow checks

Use fallow for code-quality, cleanup, and setup tasks in this repository. Fallow checks the changed code before each `git commit` and `git push`. In Claude Code and Codex, a PreToolUse hook from `fallow agent install` runs this check and blocks the command when the verdict is `fail`. Other agents run the check themselves: `fallow audit --format json --quiet --explain --gate-marker agent`. If the verdict is `fail`, fix the reported findings before you try again. A JSON runtime error such as `{ \"error\": true, ... }` does not block.

Audit defaults to `gate=new-only`: only findings introduced by the current changeset affect the verdict. Inherited findings on touched files are reported under `attribution` and annotated with `introduced: false`, but do not block the commit. Set `[audit] gate = \"all\"` in `fallow.toml` to gate every finding in changed files.

For non-skill agents, treat the task map below as the local onboarding source: run the listed fallow command before destructive edits, before commits, and before pull request handoff.
";

/// Full managed-block body: the gate prose plus the agent task-to-command
/// matrix, rendered from the single `crate::task_matrix::TASK_MATRIX` slice so
/// it stays in sync with the `init --agents` template, the schema manifest,
/// and the generated SKILL.md section. The matrix refreshes on every reinstall
/// because `upsert_managed_block` replaces the whole block wholesale.
fn agents_block_body() -> String {
    format!(
        "{AGENTS_BLOCK_BODY}\n## Fallow task map\n\n{}",
        crate::task_matrix::render_task_matrix_markdown()
    )
}

/// Marker embedded in generated hook scripts so uninstall (and upgrades)
/// can recognize a previously-generated file and remove it without `--force`.
const HOOK_SCRIPT_MARKER: &str = "# Generated by fallow setup-hooks.";
/// The gate script and `fallow audit` resolve paths from the cwd, and a Claude
/// session can work in a package directory below the install root. The handler
/// walks up to the nearest directory that holds the gate script and runs it
/// there. The walk stops at the first `.git` entry, so a nested worktree does
/// not reach the gate of the checkout around it. When no script is found, the
/// handler runs the script under `$CLAUDE_PROJECT_DIR` from the cwd, which was
/// the only behavior before.
const PROJECT_FALLOW_HANDLER_COMMAND: &str = "d=\"$(pwd)\"; until [ -f \"$d/.claude/hooks/fallow-gate.sh\" ] || [ -e \"$d/.git\" ] || [ \"$d\" = / ]; do d=\"$(dirname \"$d\")\"; done; if [ -f \"$d/.claude/hooks/fallow-gate.sh\" ]; then cd \"$d\" && exec ./.claude/hooks/fallow-gate.sh; fi; exec \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/fallow-gate.sh";
const USER_FALLOW_HANDLER_COMMAND: &str = "\"$HOME\"/.claude/hooks/fallow-gate.sh";
const FALLOW_GATE_POSIX_SUFFIX: &str = "/.claude/hooks/fallow-gate.sh";
const FALLOW_GATE_WINDOWS_SUFFIX: &str = "\\.claude\\hooks\\fallow-gate.sh";
const CLAUDE_HOOK_MATCHER: &str = "Bash";

/// Codex runs hook commands from the session cwd and sets no project-dir
/// variable. The project handler walks up to the nearest directory that holds
/// the gate script, which is the install root: the gate script and `fallow
/// audit` both resolve paths from the cwd. The install root is not always the
/// git root (`--root packages/app`), and Codex does not block on exit 127, so
/// a handler that cannot find the script would let every commit through. The
/// walk stops at the first `.git` entry, the same as the Claude handler.
const CODEX_PROJECT_HANDLER_COMMAND: &str = "d=\"$(pwd)\"; until [ -f \"$d/.codex/hooks/fallow-gate.sh\" ] || [ -e \"$d/.git\" ] || [ \"$d\" = / ]; do d=\"$(dirname \"$d\")\"; done; if [ -f \"$d/.codex/hooks/fallow-gate.sh\" ]; then cd \"$d\" && exec ./.codex/hooks/fallow-gate.sh; fi; exit 0";
/// The user-scope script lives in `$HOME`, so there is no marker to walk up
/// to. `--show-cdup` prints the relative path up to the git root (empty at the
/// root, and empty outside a git repository, where the handler stays in the cwd).
const CODEX_USER_HANDLER_COMMAND: &str =
    "cd \"./$(git rev-parse --show-cdup 2>/dev/null)\" && \"$HOME\"/.codex/hooks/fallow-gate.sh";
const CODEX_GATE_POSIX_SUFFIX: &str = "/.codex/hooks/fallow-gate.sh";
const CODEX_GATE_WINDOWS_SUFFIX: &str = "\\.codex\\hooks\\fallow-gate.sh";
/// Codex matchers are regular expressions; anchor so only the Bash tool runs
/// the gate.
const CODEX_HOOK_MATCHER: &str = "^Bash$";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Mode {
    Install,
    Uninstall,
}

impl Mode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Install => "install",
            Self::Uninstall => "uninstall",
        }
    }
}

/// Entry point for the `fallow setup-hooks` subcommand.
pub fn run_setup_hooks(opts: &SetupHooksOptions<'_>) -> ExitCode {
    run_setup_hooks_with_label(opts, "fallow setup-hooks")
}

/// Entry point used by the `fallow hooks ... --target agent` namespace while
/// reusing the same installation engine and summary renderer.
pub fn run_setup_hooks_with_label(opts: &SetupHooksOptions<'_>, command_label: &str) -> ExitCode {
    let mode = if opts.uninstall {
        Mode::Uninstall
    } else {
        Mode::Install
    };

    let plan = match Plan::resolve(opts, mode) {
        Ok(plan) => plan,
        Err(msg)
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3840** (2026-10-23): **Class inside ::view-transition-*(...) reported as unused export in SCSS Modules**
  *Symptoms*: ### What happened?  fallow reports classes used in view transitions as unused in SCSS modules.  ### Reproduction  1. Create an SCSS modules file with a view transition class 2. Import the SCSS modules file in a JS file and use it  ```scss //app.module.scss .foo {   view-transition-name: demo; }  ::view-transition-new(.demo) {   animation-duration: 200ms; } ```  ```js // app.js import css from './app.module.scss'  console.log(css.foo); ```  fallow reports `.demo` as unused but it's actually used.  ``` ● Unused exports (1)   app.module.scss     :5 demo ```  ### Expected behavior  fallow should not report it as unused export  ### Fallow version  3.35.0  ### Operating system  Windows  ### Configuration  ```toml  ```
  **Post-Mortem & Fix Analysis**:
  > Fixed in v3.36.0 (`npm install fallow@3.36.0`). The class scan now skips the argument of `::view-transition-new(.demo)` and the other `::view-transition-*()` pseudo-elements, so `demo` is no longer reported as an unused export.  Thanks for reporting this together with #3839. 

- **Issue #3839** (2026-10-23): **Function/mixin call reported as unused export in SCSS Modules**
  *Symptoms*: ### What happened?  fallow reports namespaced function calls like `math.div()` / `utils.bar()` and mixin calls like `@include utils.baz()` as unused exports in `*.module.scss` files.  ### Reproduction  1. Create an SCSS file with a function / mixin 2. Create an SCSS module file that imports and uses them 3. import the SCSS module file and use it in your app   ```scss // utils.scss @function bar() {   @return red; }  @mixin baz {   border: 1px solid red; } ```  ```scss // app.module.scsss @use './utils'; @use 'sass:math';  .foo {   height: math.div(100px, 10);   background: utils.bar();    @include utils.baz(); } ```  ```js // app.js import css from './app.module.scss'  console.log(css.foo); ```  fallow reports the function / mixin calls as unused:  ``` ● Unused exports (3)   app.module.scss (3)     :6 div     :7 bar     :9 baz ```  ### Expected behavior  fallow shouldn't recognize them as CSS classes and not report them as unused.  ### Fallow version  3.35.0  ### Operating system  Windows  ### Configuration  ```toml  ```
  **Post-Mortem & Fix Analysis**:
  > Released in v3.36.0 (`npm install fallow@3.36.0`).  In SCSS Modules, a namespaced call such as `math.div(100px, 10)` or `utils.bar()`, and a namespaced mixin such as `@include utils.baz`, no longer give a false `unused-export`. In `.module.sass` files the `+utils.baz` shorthand is skipped too. A compound selector such as `button.primary` still exports `primary`.  Thanks for the report. 

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

### Incident Patch 1: `38469b53` (2026-10-23)
**Commit Message**: chore(security): drop the stale GHSA-vfj7-8cjw-p6xm osv-scanner ignore (#3845)

The advisory no longer matches a package in editors/vscode/pnpm-lock.yaml, so the osv-scanner ignores check failed on main. Remove the entry and regenerate the VEX document.

**File**: `.vex/openvex.json` (modified, +0/-13)
```diff
@@ -18,19 +18,6 @@
       "justification": "vulnerable_code_not_in_execute_path",
       "impact_statement": "Development dependency, not in the bundled extension; the parent package range blocks the patched version. Source: editors/vscode/osv-scanner.toml"
     },
-    {
-      "vulnerability": {
-        "name": "GHSA-vfj7-8cjw-p6xm"
-      },
-      "products": [
-        {
-          "@id": "pkg:github/fallow-rs/fallow"
-        }
-      ],
-      "status": "not_affected",
-      "justification": "vulnerable_code_not_in_execute_path",
-      "impact_statement": "Development dependency, not in the bundled extension; the parent package range blocks the patched version. Source: editors/vscode/osv-scanner.toml"
-    },
     {
       "vulnerability": {
         "name": "RUSTSEC-2024-0436"
```

**File**: `editors/vscode/osv-scanner.toml` (modified, +0/-5)
```diff
@@ -1,11 +1,6 @@
 # These packages are development and build tools. The bundled extension
 # ships only vscode-languageclient and vscode-languageserver-protocol.
 
-[[IgnoredVulns]]
-id = "GHSA-vfj7-8cjw-p6xm"
-ignoreUntil = 2027-01-15T00:00:00Z
-reason = "Development dependency, not in the bundled extension; the parent package range blocks the patched version."
-
 [[IgnoredVulns]]
 id = "GHSA-73rr-hh4g-fpgx"
 ignoreUntil = 2027-01-15T00:00:00Z
```

---

### Incident Patch 2: `abb52e1f` (2026-10-23)
**Commit Message**: fix(scripts): credit the npm alias that installs a script binary (#3846)

* fix(scripts): credit the npm alias that installs a script binary

A dependency such as @typescript/native: npm:typescript@~7.0.2 provides
the binaries of typescript. A tsc script resolved to typescript only, so
the alias was reported as unused.

After script analysis, credit each npm alias whose aliased package a
script uses. A plain declaration of the aliased package keeps priority,
so a side-by-side alias such as typescript-5: npm:typescript@5 stays
reportable.

Fixes #3844

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* fix(scripts): check the plain declaration per manifest for npm alias credit

The check that blocks credit for an npm alias used the dependency names of all manifests. A plain typescript in one workspace therefore blocked the credit for an alias of typescript in another workspace, and that alias stayed reported as unused.

Compare the alias target with the dependency names of the manifest that declares the alias. Add a workspace fixture with a plain typescript in one workspace and an alias in another.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* docs(changelog): move the n

**File**: `changelog.d/fix-npm-alias-dependency-binaries.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+### Fixed
+
+- **A script binary now credits the npm alias that installs it.** A
+  dependency such as `"@typescript/native": "npm:typescript@~7.0.2"` provides
+  the binaries of `typescript`, so a `tsc` script no longer reports the alias
+  as unused. When the same manifest also declares the aliased package under
+  its own name, that declaration provides the binary, and an alias that
+  nothing else uses is still reported. A plain declaration in another
+  workspace does not change the result. Thanks @waldoluisribeiro for the
+  report. (Closes [#3844](https://github.com/fallow-rs/fallow/issues/3844))
```

**File**: `crates/config/src/workspace/package_json.rs` (modified, +73/-1)
```diff
@@ -414,6 +414,33 @@ impl PackageJson {
         .find_map(|deps| deps.get(name))
         .and_then(|spec| workspace_alias_name(spec))
     }
+
+    /// Every dependency that the manifest installs under an npm alias, as
+    /// `(alias, aliased package)` pairs.
+    ///
+    /// `"@typescript/native": "npm:typescript@~7.0.2"` installs the package
+    /// `typescript` in `node_modules/@typescript/native`, so the alias
+    /// provides the binaries of `typescript`.
+    #[must_use]
+    pub fn npm_aliases(&self) -> Vec<(String, String)> {
+        let mut aliases: Vec<(String, String)> = [
+            &self.dependencies,
+            &self.dev_dependencies,
+            &self.optional_dependencies,
+            &self.peer_dependencies,
+        ]
+        .into_iter()
+        .flatten()
+        .flat_map(|deps| deps.iter())
+        .filter_map(|(name, spec)| {
+            let target = npm_alias_name(spec)?;
+            (target != name).then(|| (name.clone(), target.to_string()))
+        })
+        .collect();
+        aliases.sort_unstable();
+        aliases.dedup();
+        aliases
+    }
 }
 
 /// The package name in a `workspace:<name>@<range>` dependency spec.
@@ -424,7 +451,23 @@ fn workspace_alias_name(spec: &str) -> Option<&str> {
     } else {
         rest.find('@')?
     };
-    let name = &rest[..separator];
+    valid_package_name(&rest[..separator])
+}
+
+/// The package name in an `npm:<name>@<range>` or `npm:<name>` dependency
+/// spec.
+fn npm_alias_name(spec: &str) -> Option<&str> {
+    let rest = spec.trim().strip_prefix("npm:")?;
+    let separator = if let Some(scoped) = rest.strip_prefix('@') {
+        scoped.find('@').map_or(rest.len(), |at| at + 1)
+    } else {
+        rest.find('@').unwrap_or(rest.len())
+    };
+    valid_package_name(&rest[..separator])
+}
+
+/// `name` when it has the shape of a package name: `name` or `@scope/name`.
+fn valid_package_name(name: &str) -> Option<&str> {
     let is_package_name = !name.is_empty()
         && !name.starts_with('.')
         && match name.strip_prefix('@') {
@@ -1037,6 +1080,35 @@ mod tests {
         assert!(pkg.exports_subdirectories().is_empty());
     }
 
+    #[test]
+    fn npm_aliases_read_the_aliased_package_name() {
+        let pkg: PackageJson = serde_json::from_str(
+            r#"{
+                "dependencies": {"plain": "npm:left-pad@^1.3.0", "range": "^1.0.0"},
+                "devDependencies": {
+                    "@typescript/native": "npm:typescript@~7.0.2",
+                    "typescript": "npm:@typescript/typescript6@^6.0.2",
+                    "bare": "npm:eslint",
+                    "same": "npm:same@1.0.0",
+                    "path": "npm:./local",
+                    "bad-scope": "npm:@scope@1.0.0",
+                    "workspace": "workspace:@scope/core@*"
+                }
+            }"#,
+        )
+        .unwrap();
+        assert_eq!(
+            pkg.npm_aliases(),
+            [
+                ("@typescript/native", "typescript"),
+                ("bare", "eslint"),
+                ("plain", "left-pad"),
+                ("typescript", "@typescript/typescript6"),
+            ]
+            .map(|(alias, target)| (alias.to_string(), target.to_string()))
+        );
+    }
+
     #[test]
     fn workspace_alias_target_reads_the_aliased_package_name() {
         let pkg: PackageJson = serde_json::from_str(
```

**File**: `crates/core/src/lib.rs` (modified, +9/-22)
```diff
@@ -2261,7 +2261,11 @@ fn analyze_all_scripts(
     workspace_pkgs: &[LoadedWorkspacePackage],
     plugin_result: &mut plugins::AggregatedPluginResult,
 ) {
-    let all_dep_names = collect_all_dependency_names(root_pkg, workspace_pkgs);
+    let manifests: Vec<&PackageJson> = root_pkg
+        .into_iter()
+        .chain(workspace_pkgs.iter().map(|(_, ws_pkg)| ws_pkg))
+        .collect();
+    let all_dep_names = scripts::all_dependency_names(&manifests);
     let all_dep_set: FxHashSet<String> = all_dep_names.iter().cloned().collect();
     let workspace_packages =
         discover::collect_workspace_packages(&config.root, root_pkg, workspace_pkgs);
@@ -2291,12 +2295,12 @@ fn analyze_all_scripts(
         },
         plugin_result,
     );
+    scripts::credit_npm_aliases(&mut plugin_result.script_used_packages, &manifests);
     plugin_result.dependency_binaries =
         scripts::DependencyBinaries::new(config.root.clone(), bin_map, all_dep_set);
-    plugin_result.dev_dependency_names = root_pkg
-        .into_iter()
-        .chain(workspace_pkgs.iter().map(|(_, ws_pkg)| ws_pkg))
-        .flat_map(PackageJson::dev_dependency_names)
+    plugin_result.dev_dependency_names = manifests
+        .iter()
+        .flat_map(|pkg| pkg.dev_dependency_names())
         .collect();
 
     plugin_result
@@ -2309,23 +2313,6 @@ fn analyze_all_scripts(
         .or_insert(EntryPointRole::Test);
 }
 
-/// Gather sorted, deduped dependency names across the root and workspace packages.
-fn collect_all_dependency_names(
-    root_pkg: Option<&PackageJson>,
-    workspace_pkgs: &[LoadedWorkspacePackage],
-) -> Vec<String> {
-    let mut all_dep_names: Vec<String> = Vec::new();
-    if let Some(pkg) = root_pkg {
-        all_dep_names.extend(pkg.all_dependency_names());
-    }
-    for (_, ws_pkg) in workspace_pkgs {
-        all_dep_names.extend(ws_pkg.all_dependency_names());
-    }
-    all_dep_names.sort_unstable();
-    all_dep_names.dedup();
-    all_dep_names
-}
-
 /// The binaries, dependencies, and workspace packages that script analysis
 /// resolves commands against.
 struct ScriptDependencyContext<'a> {
```

**File**: `crates/core/src/scripts/mod.rs` (modified, +2/-2)
```diff
@@ -39,8 +39,8 @@ use command_wrappers::{command_wrapper_child_index, skip_command_wrappers};
 pub use config_tasks::config_task_scripts;
 use file_target_tools::file_target_tool;
 pub use resolve::{
-    DependencyBinaries, build_bin_to_package_map, project_bin_map, resolve_binary_to_packages,
-    resolve_known_dependency_binary,
+    DependencyBinaries, all_dependency_names, build_bin_to_package_map, credit_npm_aliases,
+    project_bin_map, resolve_binary_to_packages, resolve_known_dependency_binary,
 };
 pub use shell::command_substitutions;
 pub use workspace_selection::WorkspacePackages;
```

**File**: `crates/core/src/scripts/resolve.rs` (modified, +91/-0)
```diff
@@ -186,6 +186,52 @@ pub fn resolve_binary_to_packages(
     candidates.iter().map(|pkg| (*pkg).to_string()).collect()
 }
 
+/// Gather sorted, deduped dependency names across the root and workspace
+/// manifests.
+#[must_use]
+pub fn all_dependency_names(manifests: &[&fallow_config::PackageJson]) -> Vec<String> {
+    let mut names: Vec<String> = manifests
+        .iter()
+        .flat_map(|pkg| pkg.all_dependency_names())
+        .collect();
+    names.sort_unstable();
+    names.dedup();
+    names
+}
+
+/// Credit each npm alias whose aliased package `used` already holds.
+///
+/// A script binary resolves to the package that ships it, for example `tsc`
+/// to `typescript`. A project that installs that package as
+/// `"@typescript/native": "npm:typescript@7"` declares only the alias, so the
+/// alias is the dependency in use.
+///
+/// When the manifest that declares the alias also declares the aliased
+/// package under its own name, and that name is not itself an alias, the
+/// plain declaration provides the binary and the alias gets no credit. This
+/// keeps a side-by-side alias such as `"typescript-5": "npm:typescript@5"`
+/// reportable. A plain declaration in another workspace does not block the
+/// credit, because that workspace does not install the binary for the alias.
+pub fn credit_npm_aliases(used: &mut FxHashSet<String>, manifests: &[&fallow_config::PackageJson]) {
+    let mut credited: Vec<String> = Vec::new();
+    for pkg in manifests {
+        let aliases = pkg.npm_aliases();
+        if aliases.is_empty() {
+            continue;
+        }
+        let declared: FxHashSet<String> = pkg.all_dependency_names().into_iter().collect();
+        let is_alias = |name: &str| aliases.iter().any(|(alias, _)| alias == name);
+        credited.extend(
+            aliases
+                .iter()
+                .filter(|(_, target)| used.contains(target))
+                .filter(|(_, target)| !declared.contains(target) || is_alias(target))
+                .map(|(alias, _)| alias.clone()),
+        );
+    }
+    used.extend(credited);
+}
+
 /// Resolve a binary only when it is known to belong to a declared dependency.
 #[must_use]
 pub fn resolve_known_dependency_binary(
@@ -485,6 +531,51 @@ mod tests {
         assert_eq!(pkg, None);
     }
 
+    fn credit(used: &[&str], dev_dependencies: &str) -> FxHashSet<String> {
+        let pkg = workspace_package(&format!(r#"{{"devDependencies": {dev_dependencies}}}"#));
+        let mut used = declared(used);
+        credit_npm_aliases(&mut used, &[&pkg]);
+        used
+    }
+
+    #[test]
+    fn npm_alias_is_credited_when_another_manifest_declares_the_target_plainly() {
+        let root = workspace_package(r#"{"devDependencies": {"typescript": "^5.0.0"}}"#);
+        let ws = workspace_package(
+            r#"{"devDependencies": {"@typescript/native": "npm:typescript@~7.0.2"}}"#,
+        );
+        let mut used = declared(&["typescript"]);
+        credit_npm_aliases(&mut used, &[&root, &ws]);
+        assert_eq!(used, declared(&["typescript", "@typescript/native"]));
+    }
+
+    #[test]
+    fn npm_alias_of_a_used_package_is_credited() {
+        let used = credit(
+            &["typescript"],
+            r#"{"@typescript/native": "npm:typescript@~7.0.2", "idle": "npm:left-pad@1"}"#,
+        );
+        assert_eq!(used, declared(&["typescript", "@typescript/native"]));
+    }
+
+    #[test]
+    fn npm_alias_is_credited_when_the_target_name_is_another_alias() {
+        let used = credit(
+            &["typescript"],
+            r#"{"@typescript/native": "npm:typescript@7", "typescript": "npm:@typescript/typescript6@6"}"#,
+        );
+        assert!(used.contains("@typescript/native"));
+    }
+
+    #[test]
+    fn npm_alias_is_not_credited_when_the_target_is_declared_plainly() {
+        let used = credit(
+            &["typescript"],
+            r#"{"typescript": "^7.0.2", "typescript-5": "npm:typescript@5"}"#,
+        );
+        assert_eq!(used, declared(&["typescript"]));
+    }
+
     #[test]
     fn jest_identity_without_symlink() {
         let pkg = resolve_binary_to_packages("jest", Path::new("/nonexistent"), &empty_map());
```

**File**: `crates/core/tests/integration_test.rs` (modified, +2/-0)
```diff
@@ -676,6 +676,8 @@ mod namespace_class_static_member;
 mod namespace_spy_call_member;
 #[path = "integration_test/node_modules_bin_path.rs"]
 mod node_modules_bin_path;
+#[path = "integration_test/npm_alias_dependency_binaries.rs"]
+mod npm_alias_dependency_binaries;
 #[path = "integration_test/osls_plugin.rs"]
 mod osls_plugin;
 #[path = "integration_test/pkg_utils_plugin.rs"]
```

**File**: `crates/core/tests/integration_test/npm_alias_dependency_binaries.rs` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+//! A dependency installed under an npm alias, such as
+//! `"@typescript/native": "npm:typescript@~7.0.2"`, provides the binaries of
+//! the aliased package. A script that runs such a binary credits the alias.
+//! An alias that no script or import uses is still reported, and so is an
+//! alias next to a plain declaration of the same package, because the plain
+//! declaration provides the binary.
+
+use super::common::{create_config, fixture_path};
+
+#[cfg_attr(miri, ignore)]
+#[test]
+fn script_binary_credits_the_npm_alias_that_installs_it() {
+    let root = fixture_path("npm-alias-dependency-binaries");
+    let config = create_config(root);
+    let results = fallow_core::analyze(&config).expect("analysis should succeed");
+
+    let unused: Vec<&str> = results
+        .unused_dev_dependencies
+        .iter()
+        .map(|finding| finding.dep.package_name.as_str())
+        .collect();
+    assert_eq!(
+        unused,
+        ["vite-6", "idle-alias"],
+        "a script binary credits the npm alias of the package that provides it"
+    );
+}
+
+#[cfg_attr(miri, ignore)]
+#[test]
+fn plain_declaration_in_another_workspace_keeps_the_alias_credit() {
+    let root = fixture_path("npm-alias-workspace-binaries");
+    let config = create_config(root);
+    let results = fallow_core::analyze(&config).expect("analysis should succeed");
+
+    let unused: Vec<&str> = results
+        .unused_dev_dependencies
+        .iter()
+        .map(|finding| finding.dep.package_name.as_str())
+        .collect();
+    assert!(
+        !unused.contains(&"@typescript/native"),
+        "a plain declaration in another workspace must not block the alias credit, got {unused:?}"
+    );
+}
```

**File**: `tests/fixtures/npm-alias-dependency-binaries/package.json` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+{
+  "name": "npm-alias-dependency-binaries",
+  "private": true,
+  "type": "module",
+  "main": "src/index.ts",
+  "scripts": {
+    "types": "tsc --noEmit",
+    "lint": "eslint .",
+    "build": "vite build"
+  },
+  "devDependencies": {
+    "@typescript/native": "npm:typescript@~7.0.2",
+    "linter": "npm:eslint@^9.0.0",
+    "vite": "^7.0.0",
+    "vite-6": "npm:vite@^6.0.0",
+    "idle-alias": "npm:left-pad@^1.3.0"
+  }
+}
```

---

### Incident Patch 3: `c030eb19` (2026-10-24)
**Commit Message**: fix(hooks): audit only the pushed worktree when a push cannot send the session branch (#3857)

A strict push from a linked worktree of the session repository also
audited the session tree, because linked worktrees share refs. Untracked
build output in the session thus blocked every push from a clean
worktree.

The gate now audits only the worktree when git shows that the push cannot
send the session branch. gate_push_spares_session accepts the push only
when all of these hold:

- The options are only -u, -q, --set-upstream, --force-with-lease and
  --force-if-includes.
- Each refspec source has a name, and git rev-parse --symbolic-full-name
  in the worktree gives the ref of the worktree HEAD for it. That ref is
  not the session branch. A commit name gives no ref, so it fails.
- A push without a refspec needs push.default unset or simple, current,
  upstream or nothing, and no remote push or mirror setting.

Any other result and any git error keep the session audit. The function
runs in a subshell, so an error under set -u also keeps it. The strict
push form also accepts --force-if-includes.

The differential test skips a reviewed list of narrowed commands, and a
separate test che

**File**: `.agents/skills/fallow/references/patterns.md` (modified, +1/-1)
```diff
@@ -784,7 +784,7 @@ Prefer `fallow hooks install --target agent` to install this file. The script is
 Behavior you can rely on:
 - The handler walks up from the session directory to the nearest directory that holds `.claude/hooks/fallow-gate.sh` and runs the audit there, so a session in a package directory audits the install root. The walk stops at the first `.git` entry. When it finds no script, the handler runs the script under `$CLAUDE_PROJECT_DIR` from the session directory.
 - The hook process can start in a directory that is not the session directory, for example in the main checkout when the session works in a nested git worktree. The script reads the session directory from the `cwd` field of the hook input and finds the audit root from it with the same walk. When the walk finds no script, for example with the user-scope script in `$HOME`, the audit root is the directory of the hook process when it is in the git work tree of the session. Else it is the git top level of the session directory, or the session directory outside a git repository. The audit root is never `$HOME`. The script compares physical paths, so a symlink does not change the walk. When the hook input has no usable `cwd`, the audit runs in the directory of the hook process.
-- A `git commit` or `git push` can name another work tree. The script audits only that target when the command has the strict form `[cd <dir> &&] git [-C <dir>]... commit|push [<option or name>]...` and git reports another work tree for the target (`git rev-parse --show-toplevel --absolute-git-dir` gives a different top level and a different git directory than for the session directory). For a push, the common git directory must differ too: linked worktrees share refs, so a push from another linked worktree of the session repository audits the session tree and the target. A target in the same work tree keeps the session audit, because `git commit` commits the whole index. Each word in the strict form must be inert: a `-C` directory resolves physically as in git, a `cd` directory starts with `/`, `./` or `../`, a double-quoted word holds no `$`, backquote or backslash, and only a short list of options such as `-m`, `--amend`, `-S` and `-u` is allowed. Any other command audits the session tree as before, plus each directory that it names in another work tree. The gate blocks when one audit fails.
+- A `git commit` or `git push` can name another work tree. The script audits only that target when the command has the strict form `[cd <dir> &&] git [-C <dir>]... commit|push [<option or name>]...` and git reports another work tree for the target (`git rev-parse --show-toplevel --absolute-git-dir` gives a different top level and a different git directory than for the session directory). For a push, the common git directory must differ too: linked worktrees share refs, so a push from another linked worktree of the session repository audits the session tree and the target. The one exception is a push that cannot send the session branch: the options are only `-u`, `-q`, `--set-upstream`, `--force-with-lease` and `--force-if-includes`, `git rev-parse --symbolic-full-name` gives the checked-out branch of the target for each refspec source, that branch is not the session branch, and a push without a refspec has `push.default` unset or `simple`, `current`, `upstream` or `nothing` and no remote `push` or `mirror` setting. That push audits only the target. A git error during this check keeps the session audit. A target in the same work tree keeps the session audit, because `git commit` commits the whole index. Each word in the strict form must be inert: a `-C` directory resolves physically as in git, a `cd` directory starts with `/`, `./` or `../`, a double-quoted word holds no `$`, backquote or backslash, and only a short list of options such as `-m`, `--amend`, `-S` and `-u` is allowed. Any other command audits the session tree as before, plus each directory that it names in another work tree. The gate blocks when one audit fails.
 - Runs only when the intercepted command is a `git commit` or `git push`, including invocations that pass git-level options before the subcommand (`git -c user.name=x commit`, `git --no-pager commit`, `git -C dir push`, `git --git-dir=/x push`); anything else exits 0. Set `FALLOW_GATE_DEBUG=1` to log skipped commands to stderr.
 - Resolves `fallow` from PATH first, then `npx --no-install fallow` as a fallback. Skips with a stderr notice if neither is available or if `jq` is missing.
 - Enforces a version floor via `FALLOW_GATE_MIN_VERSION`. The installed gate script holds the default floor (currently `2.85.0`). Fallow maintainers raise that default by hand; `fallow hooks install` does not set it to the installed version. Binaries below the floor are blocked with an upgrade hint. Set the env var to the empty string to disable the check.
```

**File**: `.claude/skills/fallow/references/patterns.md` (modified, +1/-1)
```diff
@@ -784,7 +784,7 @@ Prefer `fallow hooks install --target agent` to install this file. The script is
 Behavior you can rely on:
 - The handler walks up from the session directory to the nearest directory that holds `.claude/hooks/fallow-gate.sh` and runs the audit there, so a session in a package directory audits the install root. The walk stops at the first `.git` entry. When it finds no script, the handler runs the script under `$CLAUDE_PROJECT_DIR` from the session directory.
 - The hook process can start in a directory that is not the session directory, for example in the main checkout when the session works in a nested git worktree. The script reads the session directory from the `cwd` field of the hook input and finds the audit root from it with the same walk. When the walk finds no script, for example with the user-scope script in `$HOME`, the audit root is the directory of the hook process when it is in the git work tree of the session. Else it is the git top level of the session directory, or the session directory outside a git repository. The audit root is never `$HOME`. The script compares physical paths, so a symlink does not change the walk. When the hook input has no usable `cwd`, the audit runs in the directory of the hook process.
-- A `git commit` or `git push` can name another work tree. The script audits only that target when the command has the strict form `[cd <dir> &&] git [-C <dir>]... commit|push [<option or name>]...` and git reports another work tree for the target (`git rev-parse --show-toplevel --absolute-git-dir` gives a different top level and a different git directory than for the session directory). For a push, the common git directory must differ too: linked worktrees share refs, so a push from another linked worktree of the session repository audits the session tree and the target. A target in the same work tree keeps the session audit, because `git commit` commits the whole index. Each word in the strict form must be inert: a `-C` directory resolves physically as in git, a `cd` directory starts with `/`, `./` or `../`, a double-quoted word holds no `$`, backquote or backslash, and only a short list of options such as `-m`, `--amend`, `-S` and `-u` is allowed. Any other command audits the session tree as before, plus each directory that it names in another work tree. The gate blocks when one audit fails.
+- A `git commit` or `git push` can name another work tree. The script audits only that target when the command has the strict form `[cd <dir> &&] git [-C <dir>]... commit|push [<option or name>]...` and git reports another work tree for the target (`git rev-parse --show-toplevel --absolute-git-dir` gives a different top level and a different git directory than for the session directory). For a push, the common git directory must differ too: linked worktrees share refs, so a push from another linked worktree of the session repository audits the session tree and the target. The one exception is a push that cannot send the session branch: the options are only `-u`, `-q`, `--set-upstream`, `--force-with-lease` and `--force-if-includes`, `git rev-parse --symbolic-full-name` gives the checked-out branch of the target for each refspec source, that branch is not the session branch, and a push without a refspec has `push.default` unset or `simple`, `current`, `upstream` or `nothing` and no remote `push` or `mirror` setting. That push audits only the target. A git error during this check keeps the session audit. A target in the same work tree keeps the session audit, because `git commit` commits the whole index. Each word in the strict form must be inert: a `-C` directory resolves physically as in git, a `cd` directory starts with `/`, `./` or `../`, a double-quoted word holds no `$`, backquote or backslash, and only a short list of options such as `-m`, `--amend`, `-S` and `-u` is allowed. Any other command audits the session tree as before, plus each directory that it names in another work tree. The gate blocks when one audit fails.
 - Runs only when the intercepted command is a `git commit` or `git push`, including invocations that pass git-level options before the subcommand (`git -c user.name=x commit`, `git --no-pager commit`, `git -C dir push`, `git --git-dir=/x push`); anything else exits 0. Set `FALLOW_GATE_DEBUG=1` to log skipped commands to stderr.
 - Resolves `fallow` from PATH first, then `npx --no-install fallow` as a fallback. Skips with a stderr notice if neither is available or if `jq` is missing.
 - Enforces a version floor via `FALLOW_GATE_MIN_VERSION`. The installed gate script holds the default floor (currently `2.85.0`). Fallow maintainers raise that default by hand; `fallow hooks install` does not set it to the installed version. Binaries below the floor are blocked with an upgrade hint. Set the env var to the empty string to disable the check.
```

**File**: `changelog.d/fix-gate-worktree-push.md` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+### Fixed
+
+- **The agent gate audits only the worktree for a push that cannot send the
+  session branch.** A strict `git push` from a linked worktree of the session
+  repository also audited the session tree, because linked worktrees share
+  refs. Untracked build output in the session thus blocked every push from a
+  clean worktree. The gate now audits only the worktree when git shows that
+  the push cannot send the session branch: the options are only `-u`, `-q`,
+  `--set-upstream`, `--force-with-lease` and `--force-if-includes`, each
+  refspec source is the checked-out branch of the worktree and not the
+  session branch, and a push without a refspec has `push.default` unset or
+  `simple`, `current`, `upstream` or `nothing` and no remote `push` or
+  `mirror` setting. Any other push from a linked worktree, and any git error
+  during the check, keeps the session audit. The strict push form now also
+  accepts `--force-if-includes`. Run `fallow agent install` again to update an
+  installed gate.
```

**File**: `crates/cli/src/setup_hooks/fallow-gate.sh` (modified, +101/-8)
```diff
@@ -316,12 +316,87 @@ gate_git_identity() {
 }
 SESSION_IDENTITY="$(gate_git_identity "$BASE_DIR" || true)"
 
+# Returns 0 only when the strict push in STRICT_ARGS, run in the linked
+# worktree $1, cannot send the branch of the session. All of these must hold:
+# - The options are only -u, -q, --set-upstream, --force-with-lease and
+#   --force-if-includes.
+# - The words after the options are [<repository>] [<refspec>...]. The source
+#   of each refspec (without a leading + and before the first :) is not empty.
+#   For each source, git rev-parse --symbolic-full-name in $1 gives the same
+#   ref as for HEAD in $1, and that ref is not the session branch. A commit
+#   name, `feat~0` or `@{-1}` gives no ref, so it fails.
+# - A push without a refspec needs push.default (read in $1) unset or one of
+#   simple, current, upstream and nothing, and no remote with a push or mirror
+#   setting.
+# Every other result and every git error return 1. The function runs in a
+# subshell, so an error under set -u also returns 1 and the session is
+# audited.
+gate_push_spares_session() (
+  local target="$1" word src ref head session_ref push_default rc
+  local positionals=0 refspecs=0
+  if ! head="$(git -C "$target" rev-parse --symbolic-full-name HEAD 2>/dev/null)"; then
+    return 1
+  fi
+  [ -n "$head" ] || return 1
+  # Exit 1 means a detached HEAD: no session branch, so no ref can match it.
+  if session_ref="$(git -C "$BASE_DIR" symbolic-ref -q HEAD 2>/dev/null)"; then
+    :
+  else
+    rc=$?
+    [ "$rc" -eq 1 ] || return 1
+    session_ref=""
+  fi
+  [ "$head" != "$session_ref" ] || return 1
+  for word in ${STRICT_ARGS[@]+"${STRICT_ARGS[@]}"}; do
+    case "$word" in
+      -u | -q | --set-upstream | --force-with-lease | --force-if-includes) continue ;;
+      -*) return 1 ;;
+    esac
+    positionals=$((positionals + 1))
+    # The first word is the repository.
+    [ "$positionals" -gt 1 ] || continue
+    refspecs=$((refspecs + 1))
+    src="${word#+}"
+    src="${src%%:*}"
+    case "$src" in
+      '' | -*) return 1 ;;
+    esac
+    if ! ref="$(git -C "$target" rev-parse --symbolic-full-name "$src" 2>/dev/null)"; then
+      return 1
+    fi
+    [ -n "$ref" ] && [ "$ref" = "$head" ] && [ "$ref" != "$session_ref" ] || return 1
+  done
+  if [ "$refspecs" -eq 0 ]; then
+    # Exit 1 means that push.default is not set.
+    if push_default="$(git -C "$target" config --get push.default 2>/dev/null)"; then
+      :
+    else
+      rc=$?
+      [ "$rc" -eq 1 ] || return 1
+      push_default=""
+    fi
+    case "$push_default" in
+      '' | simple | current | upstream | nothing) ;;
+      *) return 1 ;;
+    esac
+    # Exit 1 means that no remote has a push or mirror setting.
+    if git -C "$target" config --get-regexp '^remote\..*\.(push|mirror)$' >/dev/null 2>&1; then
+      return 1
+    else
+      rc=$?
+      [ "$rc" -eq 1 ] || return 1
+    fi
+  fi
+  return 0
+)
+
 # Returns 0 when git reports another work tree for a directory than for the
 # session directory: both the top level and the git directory differ. With
 # `push` as the second argument, the common git directory must differ too,
 # because linked worktrees share refs: a push from one of them can send the
-# branch or tags of the session. A directory in the same work tree, or a git
-# error, returns 1.
+# branch or tags of the session. The one exception is a push that
+# gate_push_spares_session accepts. A directory in the same work tree, or a
+# git error, returns 1.
 gate_other_work_tree() {
   local identity top git_dir common session_top session_git_dir session_common rest
   [ -n "$SESSION_IDENTITY" ] || return 1
@@ -336,7 +411,7 @@ gate_other_work_tree() {
   session_common="${rest#*"$GATE_NL"}"
   [ "$top" != "$session_top" ] && [ "$git_dir" != "$session_git_dir" ] || return 1
   if [ "${2:-}" = push ] && [ "$common" = "$session_common" ]; then
-    return 1
+    gate_push_spares_session "$1" || return 1
   fi
   return 0
 }
@@ -354,7 +429,8 @@ gate_other_work_tree() {
 # gate_inert_option are allowed; a quoted word is allowed only as the value of
 # `-m` or `--message`. Nothing else is allowed: no other operator, expansion,
 # redirection, environment prefix or git option such as `-c`. Each directory
-# must exist. Returns 1 for any other command.
+# must exist. For a push, the words after the subcommand follow, one on each
+# line. Returns 1 for any other command.
 gate_allowlisted_target() {
   local cmd="$1" rest dir="$BASE_DIR" subcommand word
   # The letters are listed, not given as a range, so that no locale can make
@@ -363,7 +439,7 @@ gate_allowlisted_target() {
   local sq_dir=$'\'[^\'\n]*\'' dq_dir=$'"[^"$`\\\\\n]*"'
   local sq_arg="'[^']*'" dq_arg='"[^"$`\\]*"'
   local blank=$'[ \t]' sp re word_re dir_re arg_re
-  local -a words=()
+  local -a words=() args=()
   sp="$blank+"
   dir_re="($plain|$sq_dir|$dq_dir)"
   arg_re="($plain|$sq_arg|$dq_arg)"
@@ -401,8 +477,12 @@ gate_allowlisted_target() {
         
```

**File**: `crates/cli/src/setup_hooks_gate_tests.rs` (modified, +351/-2)
```diff
@@ -1450,7 +1450,7 @@ fn gate_resolves_the_strict_target_physically() {
         ),
         (
             "push with names",
-            "git -C ../../wt-c push -u --force-with-lease origin HEAD:main".to_owned(),
+            "git -C ../../wt-c push -u --force origin HEAD:main".to_owned(),
             vec![a, c],
         ),
         (
@@ -1559,6 +1559,306 @@ fn gate_resolves_git_c_physically_through_a_symlink() {
     assert_cases(&trees, &cases);
 }
 
+/// Two linked worktrees on their own branches: the session works in `a` on
+/// `feat-a` with untracked build output, and `b` holds `feat-b`.
+fn branch_worktrees() -> TwoWorktrees {
+    let trees = two_worktrees();
+    git(&trees.a, &["switch", "-q", "-c", "feat-a"]);
+    git(&trees.b, &["switch", "-q", "-c", "feat-b"]);
+    std::fs::write(trees.a.join("build-output.js"), "export const x = 1;\n").unwrap();
+    trees
+}
+
+/// The full path of the host git.
+fn host_git() -> PathBuf {
+    std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default())
+        .map(|dir| dir.join("git"))
+        .find(|path| path.is_file())
+        .expect("git on PATH")
+}
+
+/// Runs a strict push from worktree `b` with a session in `a/src`.
+/// `fail` names a word: each git call with that word fails with exit 128.
+fn run_linked_push(trees: &TwoWorktrees, command: &str, fail: &str) -> GateRun {
+    use std::os::unix::fs::PermissionsExt;
+
+    let session = trees.a.join("src");
+    std::fs::create_dir_all(&session).unwrap();
+    let wrapper_dir = trees.root.join("git-wrapper");
+    std::fs::create_dir_all(&wrapper_dir).unwrap();
+    for (name, body) in [
+        (
+            "git",
+            format!(
+                "#!/bin/sh\ncase \" $* \" in *\"$GIT_STUB_FAIL\"*) exit 128 ;; esac\nexec '{}' \"$@\"\n",
+                host_git().display()
+            ),
+        ),
+        ("fallow", STUB_FALLOW.to_owned()),
+    ] {
+        let path = wrapper_dir.join(name);
+        std::fs::write(&path, body).unwrap();
+        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
+    }
+    let path = format!(
+        "{}:{}",
+        wrapper_dir.display(),
+        std::env::var("PATH").unwrap_or_default()
+    );
+    run_gate_with_env(
+        &trees.gate,
+        &trees.main,
+        &trees.root.join("home"),
+        &command_payload(&session, command),
+        &[("PATH", path.as_str()), ("GIT_STUB_FAIL", fail)],
+    )
+}
+
+/// A config key and value to set before a case runs.
+type ConfigSetting<'a> = Option<(&'a str, &'a str)>;
+
+/// A word that no git call of the gate holds.
+const NO_FAILURE: &str = " no-such-word ";
+
+/// Sets a value in the shared config of the repository of `trees`.
+fn set_config(trees: &TwoWorktrees, key: &str, value: &str) {
+    git(&trees.main, &["config", key, value]);
+}
+
+/// A strict push from a linked worktree that cannot send the session branch
+/// audits only that worktree, also with untracked build output in the
+/// session tree.
+#[test]
+fn gate_audits_only_the_worktree_for_a_push_of_its_own_branch() {
+    if skip_without_tools() {
+        return;
+    }
+    let cases: &[(&str, &str, ConfigSetting)] = &[
+        ("branch", "git -C '../../wt b' push origin feat-b", None),
+        ("-u", "git -C '../../wt b' push -u origin feat-b", None),
+        (
+            "--set-upstream -q",
+            "git -C '../../wt b' push --set-upstream -q origin feat-b",
+            None,
+        ),
+        ("HEAD", "git -C '../../wt b' push origin HEAD", None),
+        (
+            "HEAD to the branch",
+            "git -C '../../wt b' push origin HEAD:refs/heads/feat-b",
+            None,
+        ),
+        (
+            "--force-with-lease",
+            "git -C '../../wt b' push --force-with-lease origin feat-b",
+            None,
+        ),
+        (
+            "--force-with-lease --force-if-includes",
+            "git -C '../../wt b' push --force-with-lease --force-if-includes origin +feat-b",
+            None,
+        ),
+        (
+            "no refspec, push.default simple",
+            "git -C '../../wt b' push",
+            Some(("push.default", "simple")),
+        ),
+        (
+            "no refspec, push.default unset",
+            "git -C '../../wt b' push origin",
+            None,
+        ),
+        ("cd", "cd '../../wt b' && git push origin feat-b", None),
+    ];
+    for (case, command, config) in cases {
+        let trees = branch_worktrees();
+        if let Some((key, value)) = config {
+            set_config(&trees, key, value);
+        }
+        let run = run_linked_push(&trees, command, NO_FAILURE);
+        assert_eq!(
+            run.output.status.code(),
+            Some(0),
+            "{case}: stderr={}",
+            String::from_utf8_lossy(&run.output.stderr)
+        );
+        assert_eq!(
+            run.audit_dirs,
+            [trees.b.as_path()],
+            "{case}: {command:?} must audit only the w
```

**File**: `npm/fallow/skills/fallow/references/patterns.md` (modified, +1/-1)
```diff
@@ -784,7 +784,7 @@ Prefer `fallow hooks install --target agent` to install this file. The script is
 Behavior you can rely on:
 - The handler walks up from the session directory to the nearest directory that holds `.claude/hooks/fallow-gate.sh` and runs the audit there, so a session in a package directory audits the install root. The walk stops at the first `.git` entry. When it finds no script, the handler runs the script under `$CLAUDE_PROJECT_DIR` from the session directory.
 - The hook process can start in a directory that is not the session directory, for example in the main checkout when the session works in a nested git worktree. The script reads the session directory from the `cwd` field of the hook input and finds the audit root from it with the same walk. When the walk finds no script, for example with the user-scope script in `$HOME`, the audit root is the directory of the hook process when it is in the git work tree of the session. Else it is the git top level of the session directory, or the session directory outside a git repository. The audit root is never `$HOME`. The script compares physical paths, so a symlink does not change the walk. When the hook input has no usable `cwd`, the audit runs in the directory of the hook process.
-- A `git commit` or `git push` can name another work tree. The script audits only that target when the command has the strict form `[cd <dir> &&] git [-C <dir>]... commit|push [<option or name>]...` and git reports another work tree for the target (`git rev-parse --show-toplevel --absolute-git-dir` gives a different top level and a different git directory than for the session directory). For a push, the common git directory must differ too: linked worktrees share refs, so a push from another linked worktree of the session repository audits the session tree and the target. A target in the same work tree keeps the session audit, because `git commit` commits the whole index. Each word in the strict form must be inert: a `-C` directory resolves physically as in git, a `cd` directory starts with `/`, `./` or `../`, a double-quoted word holds no `$`, backquote or backslash, and only a short list of options such as `-m`, `--amend`, `-S` and `-u` is allowed. Any other command audits the session tree as before, plus each directory that it names in another work tree. The gate blocks when one audit fails.
+- A `git commit` or `git push` can name another work tree. The script audits only that target when the command has the strict form `[cd <dir> &&] git [-C <dir>]... commit|push [<option or name>]...` and git reports another work tree for the target (`git rev-parse --show-toplevel --absolute-git-dir` gives a different top level and a different git directory than for the session directory). For a push, the common git directory must differ too: linked worktrees share refs, so a push from another linked worktree of the session repository audits the session tree and the target. The one exception is a push that cannot send the session branch: the options are only `-u`, `-q`, `--set-upstream`, `--force-with-lease` and `--force-if-includes`, `git rev-parse --symbolic-full-name` gives the checked-out branch of the target for each refspec source, that branch is not the session branch, and a push without a refspec has `push.default` unset or `simple`, `current`, `upstream` or `nothing` and no remote `push` or `mirror` setting. That push audits only the target. A git error during this check keeps the session audit. A target in the same work tree keeps the session audit, because `git commit` commits the whole index. Each word in the strict form must be inert: a `-C` directory resolves physically as in git, a `cd` directory starts with `/`, `./` or `../`, a double-quoted word holds no `$`, backquote or backslash, and only a short list of options such as `-m`, `--amend`, `-S` and `-u` is allowed. Any other command audits the session tree as before, plus each directory that it names in another work tree. The gate blocks when one audit fails.
 - Runs only when the intercepted command is a `git commit` or `git push`, including invocations that pass git-level options before the subcommand (`git -c user.name=x commit`, `git --no-pager commit`, `git -C dir push`, `git --git-dir=/x push`); anything else exits 0. Set `FALLOW_GATE_DEBUG=1` to log skipped commands to stderr.
 - Resolves `fallow` from PATH first, then `npx --no-install fallow` as a fallback. Skips with a stderr notice if neither is available or if `jq` is missing.
 - Enforces a version floor via `FALLOW_GATE_MIN_VERSION`. The installed gate script holds the default floor (currently `2.85.0`). Fallow maintainers raise that default by hand; `fallow hooks install` does not set it to the installed version. Binaries below the floor are blocked with an upgrade hint. Set the env var to the empty string to disable the check.
```

#### Recent Merged Pull Requests:
- **PR #3866** (2026-10-25): chore: sync napi, Docker pins and the schema baseline to v3.36.0 (@BartWaardenburg)
- **PR #3864** (2026-10-25): chore(deps-dev): bump fast-uri from 3.1.8 to 3.1.9 in the npm_and_yarn group across 1 directory (@dependabot[bot])
- **PR #3863** (2026-10-25): chore(deps): bump the npm_and_yarn group across 1 directory with 2 updates (@dependabot[bot])
- **PR #3862** (2026-10-24): fix(release): read platform package names from workspace paths (@BartWaardenburg)
- **PR #3861** (2026-10-24): chore: release v3.36.0 (@BartWaardenburg)
- **PR #3860** (2026-10-24): fix(codeowners): keep an escaped space in a CODEOWNERS pattern (@BartWaardenburg)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
