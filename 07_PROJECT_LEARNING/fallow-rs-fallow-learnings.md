> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source**: github ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Source Version**: `c9d7861d`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T19:35:36.973Z  
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
> **Harvest Timestamp**: 2026-10-22T19:35:35.728Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5215 stars

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
- **Issue #3696** (2026-10-20): **setup-hooks gate skips the audit when git options contain quoted values with spaces**
  *Symptoms*: ### What happened?  The fallow-gate.sh script that fallow setup-hooks generates (installer 3.33.1) splits the command on spaces without respecting quotes (set -- $segment). If a git-level option has a quoted value that contains a space, the leftover words are read as the subcommand. The command is then classified as "not a commit/push", and the audit is silently skipped.  Repro (calling is_git_write_command directly):  ``` git commit -m x                               → audited git -c "user.name=Jane Doe" commit -m update  → skipped git -C "/tmp/my project" push                 → skipped ```  Impact: any commit or push with a quoted `-c/-C/--git-dir` value containing a space gets past the gate. This is a regression gap in the [#2106](https://github.com/fallow-rs/fallow/issues/2106) tokenizer change.  Suggested fix: split the command in a quote-aware way that never evaluates it, for example a small parser, or `jq/xargs -n1`-style splitting. Alternatively, when splitting is ambiguous (quotes appear before the subcommand), treat the command as a commit/push and audit or block it instead of skipping it, matching the gate's intent.  ### Reproduction  1. Create a bad change 2. commit with extra options and spaces: `git -c "user.name=Jane Doe" commit -m update` 3. the audit won't be called  ### Expected behavior  1. Create a bad change 2. commit with extra options and spaces: `git -c "user.name=Jane Doe" commit -m update` 3. the audit **will** be run and the commit blocked  ### Fall

- **Issue #3532** (2026-10-16): **Performance regression in 3.33.1: plugin detection scans node_modules in pnpm workspaces**
  *Symptoms*: ### What happened?   After upgrading from 3.33.0 to 3.33.1, `fallow audit` in a pnpm monorepo went from ~34 s to   ~170 s. Bisected by release; 3.33.0 and earlier are fine:    | version | total | system time | user time |   |---|---|---|---|   | 3.31.0 | 32 s | 4.3 s | 2.1 s |   | 3.32.0 | 34 s | 4.4 s | 2.5 s |   | 3.33.0 | 34 s | 4.6 s | 2.6 s |   | 3.33.1 | 169 s | 96.7 s | 9.0 s |    (The fast runs include a one-time cache rebuild after switching versions. Same machine, repo,   config and command for all four.)    `--performance` on 3.33.1 puts almost all of it in plugin detection:        discover files:       47.2ms  (2199 files)       workspaces:           13.1ms  (46 workspaces)       plugin detection: 164653.5ms  (+45.7ms plugin globs under entry points)       parse/extract:     14855.0ms  (2199 modules, 2199 cached, 0 parsed)       build graph:          11.9ms       analyze:              39.8ms       TOTAL:            164805.6ms      TOTAL:            164805.6ms  The time is kernel time. `fs_usage -w -f filesys fallow` during plugin detection shows a recursive directory walk (open → fstatfs64 → getdirentries64 → close per directory) through dependency internals under `node_modules/.pnpm`, reached through the `node_modules` symlinks of the workspace packages, for example:      open  …/.pnpm/@voidzero-dev+vite-plus-core@1.1.0_…/node_modules/@voidzero-dev/vite-plus-core/dist/vite/node/chunks     open  …/.pnpm/eslint@10.12.0_…/node_modules/eslint/lib/rules/utils/unicode 

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

### Incident Patch 1: `c642c586` (2026-10-22)
**Commit Message**: fix(extract): stop deeply nested brackets from aborting the run (#3790)

The Oxc parser recurses once per nesting level and has no depth limit. A
file with a few thousand nested brackets overflowed the stack, and the
stack overflow aborted the whole process. OSS-Fuzz found this in the
fuzz_extract and fuzz_extract_cache targets. `fallow dupes` and
`fallow health` aborted on the same files.

`fallow_extract::exceeds_nesting_limit` scans the bracket depth before a
parse. Past 1024 levels, extraction returns a failed parse with no facts,
so the run continues and the parse warning names the file. The
duplication tokenizer, similar-code extraction, inventory and search
visibility skip the file.

The scan ignores brackets in strings, comments and template text. A
string or regex literal that does not end on its line is scanned again
as code, and a regex body raises only the peak depth, so a misread
literal cannot hide real nesting. The deepest file in a scan of 134k
real package files nests 87 levels.

CACHE_VERSION and DUPES_CACHE_VERSION change: a file between the cap and
the old overflow depth parsed before and is now a failed parse, so a
warm cache must not serve its old facts or tok

**File**: `changelog.d/fix-deep-nesting-stack-overflow.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **A file with deeply nested brackets no longer aborts the run.** A source with thousands of nested `(`, `[`, `{` or template substitutions overflowed the parser stack, and the stack overflow killed the whole `fallow` process. Fallow now measures the nesting before it parses a file. A file past the limit shows as a file that failed to parse, `fallow dupes` finds no clones in it, and the analysis of the other files continues. Brackets inside strings, comments and template text do not count. The extraction and duplication cache versions change, so the first run after the upgrade parses every file again. OSS-Fuzz found this.
```

**File**: `crates/engine/src/duplication_detector/tokenize/mod.rs` (modified, +10/-0)
```diff
@@ -67,6 +67,16 @@ fn tokenize_file_inner(
 
     let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
 
+    if fallow_extract::exceeds_nesting_limit(source) {
+        return FileTokens {
+            tokens: Vec::new(),
+            function_spans: Vec::new(),
+            atomic_invocation_spans: Vec::new(),
+            literal_argument_spans: Vec::new(),
+            source: source.to_string(),
+            line_count: source.lines().count().max(1),
+        };
+    }
     if is_sfc_file(path) {
         return tokenize_sfc(source, strip_types, skip_imports);
     }
```

**File**: `crates/engine/src/duplication_detector/tokenize/tests/edge_cases.rs` (modified, +7/-0)
```diff
@@ -511,3 +511,10 @@ export async function fetchAndProcess(url, options = {}) {
     assert!(has_spread, "Should have spread operator");
     assert!(has_nullish, "Should have nullish coalescing operator");
 }
+
+#[test]
+fn deeply_nested_source_yields_no_tokens_instead_of_overflowing() {
+    let depth = 20_000;
+    let code = format!("const x = {}1{};", "(".repeat(depth), ")".repeat(depth));
+    assert!(tokenize(&code).is_empty());
+}
```

**File**: `crates/engine/src/search_visibility.rs` (modified, +6/-0)
```diff
@@ -437,6 +437,9 @@ fn forwarded_import_bindings(path: &Path, source: &str) -> FxHashSet<String> {
     let Ok(source_type) = oxc_span::SourceType::from_path(path) else {
         return FxHashSet::default();
     };
+    if fallow_extract::exceeds_nesting_limit(source) {
+        return FxHashSet::default();
+    }
     let allocator = oxc_allocator::Allocator::default();
     let parsed = oxc_parser::Parser::new(&allocator, source, source_type).parse();
     if parsed.fatal_error {
@@ -764,6 +767,9 @@ impl TopLevelStatement {
 /// The top-level statements of a script. A script that does not parse has
 /// none.
 fn top_level_statements(source: &str, source_type: oxc_span::SourceType) -> Vec<TopLevelStatement> {
+    if fallow_extract::exceeds_nesting_limit(source) {
+        return Vec::new();
+    }
     let allocator = oxc_allocator::Allocator::default();
     let parsed = oxc_parser::Parser::new(&allocator, source, source_type).parse();
     if parsed.fatal_error {
```

**File**: `crates/extract/src/cache/types.rs` (modified, +2/-2)
```diff
@@ -10,12 +10,12 @@ use crate::MemberKind;
 /// extraction semantics change, and give the reason in the commit message and
 /// the CHANGELOG. A stale version serves old extraction results from a warm
 /// cache. The `assert_cached_type_size!` guards below catch shape changes.
-pub(super) const CACHE_VERSION: u32 = 371;
+pub(super) const CACHE_VERSION: u32 = 372;
 
 /// Duplication token cache version. Bump it when duplicate tokenization,
 /// normalization, or the on-disk token cache schema changes, and give the
 /// reason in the commit message and the CHANGELOG.
-pub const DUPES_CACHE_VERSION: u32 = 16;
+pub const DUPES_CACHE_VERSION: u32 = 17;
 
 /// Default maximum cache size (256 MB). Overridable per-project via
 /// `cache.maxSizeMb` in the config file or `FALLOW_CACHE_MAX_SIZE` env var.
```

**File**: `crates/extract/src/inventory.rs` (modified, +3/-0)
```diff
@@ -506,6 +506,9 @@ fn walk_one_parse(
     source_type: SourceType,
     line_offsets: &[u32],
 ) -> (Vec<InventoryEntry>, FxHashMap<String, InventoryComplexity>) {
+    if crate::exceeds_nesting_limit(source) {
+        return (Vec::new(), FxHashMap::default());
+    }
     let allocator = Allocator::default();
     let parser_return = Parser::new(&allocator, source, source_type).parse();
 
```

**File**: `crates/extract/src/lib.rs` (modified, +3/-0)
```diff
@@ -40,8 +40,10 @@ mod jsdoc_attach;
 mod jsdoc_deprecated;
 pub mod mdx;
 mod module_info;
+mod nesting;
 pub mod og_image;
 mod parse;
+mod parse_degradation;
 pub mod sfc;
 pub mod sfc_css;
 mod sfc_props;
@@ -104,6 +106,7 @@ pub use css_in_js::{
 pub use css_metrics::{compute_css_analytics, parse_css_color_rgb};
 pub use glimmer::{is_glimmer_file, strip_glimmer_templates};
 pub use mdx::{extract_mdx_statements, extract_mdx_statements_mapped};
+pub use nesting::{MAX_NESTING_DEPTH, exceeds_nesting_limit};
 pub use sfc::{
     SourceRegion, extract_sfc_scripts, extract_sfc_styles, extract_sfc_template_regions,
     is_sfc_file, sfc_merged_script_source,
```

**File**: `crates/extract/src/nesting.rs` (added, +360/-0)
```diff
@@ -0,0 +1,360 @@
+//! Nesting-depth guard that runs before the Oxc parser sees a source.
+//!
+//! The Oxc parser and the AST visitors recurse once per nesting level and
+//! have no depth limit (oxc-project/oxc#21953, oxc-project/oxc#24375). A
+//! file with a few thousand nested brackets overflows the stack, and because
+//! a stack overflow aborts the process, one such file kills the whole run.
+//! Extraction therefore measures the bracket nesting first and does not parse
+//! a file past [`MAX_NESTING_DEPTH`].
+//!
+//! The scan is a lexer approximation. Brackets in strings, comments and
+//! template text do not count. A string or regex literal that does not end on
+//! its line is not a literal, so the scan reads it again as code: a stray
+//! quote in JSX text or a division read as a regex cannot hide brackets. A
+//! regex body keeps its unclosed openers open, so a division that looks like
+//! a regex cannot hide brackets either. It does not need to be
+//! exact, because real code stays far below the cap. Nesting without brackets
+//! (TypeScript generics, JSX elements, long member or call chains) is not
+//! bounded here.
+
+use fallow_types::discover::FileId;
+use fallow_types::extract::ModuleInfo;
+
+use crate::visitor::ModuleInfoExtractor;
+
+/// Bracket nesting depth past which a file is not parsed.
+///
+/// A release build on a 16 MiB worker stack overflows at about 6000 levels for
+/// the most expensive shape (nested object literals), and at about half that
+/// on the 8 MiB main thread that parses small projects. Real code stays far
+/// below this cap.
+pub const MAX_NESTING_DEPTH: u32 = 1024;
+
+/// The module of a file whose nesting would overflow the parser stack, or
+/// `None` when the file is safe to parse. The module is a failed parse with no
+/// facts, so the file shows up as degraded instead of aborting the run.
+pub fn too_deep_module(file_id: FileId, source: &str, content_hash: u64) -> Option<ModuleInfo> {
+    let source = crate::strip_bom(source);
+    if !exceeds_nesting_limit(source) {
+        return None;
+    }
+    let mut info = ModuleInfoExtractor::new().into_module_info(
+        file_id,
+        content_hash,
+        crate::suppress::ParsedSuppressions::default(),
+    );
+    info.parse_error_count = 1;
+    info.parse_panicked = true;
+    info.line_offsets = fallow_types::extract::compute_line_offsets(source);
+    Some(info)
+}
+
+/// Returns `true` when the bracket nesting of `source` exceeds
+/// [`MAX_NESTING_DEPTH`]. Every caller that hands user source to the Oxc
+/// parser checks this first.
+#[must_use]
+pub fn exceeds_nesting_limit(source: &str) -> bool {
+    max_depth(source, MAX_NESTING_DEPTH) > MAX_NESTING_DEPTH
+}
+
+/// Maximum bracket nesting depth of `source`. The scan stops as soon as the
+/// depth passes `limit`, so the result is at most `limit + 1`.
+fn max_depth(source: &str, limit: u32) -> u32 {
+    let mut scanner = Scanner {
+        bytes: source.as_bytes(),
+        pos: 0,
+        depth: 0,
+        max_depth: 0,
+        limit,
+        templates: Vec::new(),
+        regex_allowed: true,
+    };
+    scanner.scan();
+    scanner.max_depth
+}
+
+struct Scanner<'a> {
+    bytes: &'a [u8],
+    pos: usize,
+    depth: u32,
+    max_depth: u32,
+    limit: u32,
+    /// Depth of each open `${` substitution, innermost last. The `}` that
+    /// brings the depth back to this value resumes the template text.
+    templates: Vec<u32>,
+    /// Whether a `/` at this point starts a regex literal instead of a
+    /// division, judged from the previous significant byte.
+    regex_allowed: bool,
+}
+
+impl Scanner<'_> {
+    fn scan(&mut self) {
+        while let Some(&byte) = self.bytes.get(self.pos) {
+            if self.max_depth > self.limit {
+                return;
+            }
+            self.pos += 1;
+            match byte {
+                b'(' | b'[' | b'{' => {
+                    self.open();
+                    self.regex_allowed = true;
+                }
+                b'}' if self.templates.last() == Some(&self.depth) => {
+                    self.templates.pop();
+                    self.depth -= 1;
+                    self.skip_template_text();
+                }
+                b')' | b']' | b'}' => {
+                    self.depth = self.depth.saturating_sub(1);
+                    self.regex_allowed = byte == b'}';
+                }
+                b'\'' | b'"' => {
+                    self.skip_string(byte);
+                    self.regex_allowed = false;
+                }
+                b'`' => self.skip_template_text(),
+                b'/' => self.skip_slash(),
+                b' ' | b'\t' | b'\n' | b'\r' => {}
+                _ => self.regex_allowed = starts_expression(byte),
+            }
+        }
+    }
+
+    fn open(&mut self) {
+        self.depth += 1;
+        self.max_depth = self.max_depth.max(self.depth);
+    }
+
+    /// Skips a comment, a regex literal, or a divis
```

---

### Incident Patch 2: `606d18d6` (2026-10-22)
**Commit Message**: fix(lsp,mcp): run analysis on threads with the worker stack (#3806)

The language server ran analysis on 2 MiB Tokio blocking threads and the default Rayon pool, and run_decision_surface did not call install. A deeply nested file overflowed those stacks and aborted the process. The language server now builds the global Rayon pool and its Tokio threads with the 16 MiB analysis worker stack, run_decision_surface runs both analysis passes inside install, and the MCP Tokio threads get the same stack size. fallow_api exports WORKER_STACK_SIZE and configure_global_analysis_pool(threads), which the CLI also uses.

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -1423,6 +1423,7 @@ dependencies = [
  "ls-types",
  "mimalloc",
  "proptest",
+ "rayon",
  "rustc-hash",
  "serde",
  "serde_json",
```

**File**: `changelog.d/fix-analysis-thread-stack.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **The language server and the MCP `decision_surface` tool no longer abort on nesting that the CLI survives.** Both ran analysis on threads with a 2 MiB stack, so a deeply nested file overflowed that stack and stopped the process. The language server now gives its analysis threads the 16 MiB stack of the CLI workers. Its Tokio runtime uses two worker threads, because analysis runs on the blocking threads and the Rayon pool. `decision_surface` and `run_decision_surface` now parse on the analysis worker pool, as the other tools do. Their thread count now follows the `threads` option.
```

**File**: `crates/api/src/lib.rs` (modified, +20/-0)
```diff
@@ -126,6 +126,12 @@ pub use fallow_engine::change_scope::{
 };
 /// Engine-owned per-workspace Git baseline state used by analysis surfaces.
 pub use fallow_engine::package_baselines::{PackageBaselineError, PackageChangeScope};
+/// Stack size for threads that run analysis.
+///
+/// A process that runs analysis outside
+/// [`ProgrammaticAnalysisContext::install`], such as the LSP server, gives its
+/// own threads this stack size.
+pub use fallow_engine::thread_pool::WORKER_STACK_SIZE;
 /// Parsed modules that a long-lived process keeps across analysis calls.
 ///
 /// A process that runs many calls on the same project, such as the MCP
@@ -1237,6 +1243,20 @@ pub struct ComplexityRunOptions<'a> {
     pub coverage_inputs: ComplexityCoverageInputs<'a>,
 }
 
+/// Build the process-global Rayon pool with the [`WORKER_STACK_SIZE`] stack
+/// and `threads` workers. Zero threads selects the Rayon default count, which
+/// honors `RAYON_NUM_THREADS`.
+///
+/// A process that runs analysis outside
+/// [`ProgrammaticAnalysisContext::install`] calls this once at startup, before
+/// any parallel work. Returns `false` when the global pool already exists or
+/// when a worker thread cannot start. Rayon then keeps its default pool.
+pub fn configure_global_analysis_pool(threads: usize) -> bool {
+    fallow_engine::thread_pool::worker_pool_builder(threads)
+        .build_global()
+        .is_ok()
+}
+
 /// Derive effective health section flags for API consumers.
 #[must_use]
 pub fn derive_health_sections(options: &HealthSectionOptions) -> DerivedHealthSections {
```

**File**: `crates/api/src/runtime/decision_surface.rs` (modified, +105/-2)
```diff
@@ -46,7 +46,9 @@ pub fn run_decision_surface(
         });
     }
 
-    let head = run_decision_analysis(&resolved, Some(&changed_files), None)?;
+    // The caller can be a 2 MiB Tokio blocking thread. Parse on the worker
+    // stack of the analysis pool instead.
+    let head = resolved.install(|| run_decision_analysis(&resolved, Some(&changed_files), None))?;
     let manifests = changed_manifests(&resolved.root, &changed_files);
     let base = compute_base_decision_snapshot(
         options,
@@ -290,7 +292,7 @@ fn compute_base_decision_snapshot(
         ..options.analysis.clone()
     };
     let resolved = resolve_programmatic_analysis_context(&base_analysis)?;
-    let base = run_decision_analysis(&resolved, None, Some(head_config))?;
+    let base = resolved.install(|| run_decision_analysis(&resolved, None, Some(head_config)))?;
     let mut snapshot = snapshot_from_decision_analysis(&base);
     snapshot.manifests = base_manifests;
     Ok(snapshot)
@@ -461,3 +463,104 @@ fn export_line_resolver(
             .map_or(0, |(_, line)| *line)
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use std::path::Path;
+    use std::process::Command;
+
+    use crate::{AnalysisOptions, DecisionSurfaceOptions};
+
+    const STACK_PROBE_ENV: &str = "FALLOW_DECISION_SURFACE_STACK_PROBE_CHILD";
+    const STACK_PROBE_TEST: &str =
+        "runtime::decision_surface::tests::decision_surface_parses_on_the_worker_stack";
+    /// Deep enough to overflow a 2 MiB thread in a release build and to fit
+    /// the 16 MiB worker stack in a debug build. An assignment chain has no
+    /// brackets, so the pre-parse bracket guard does not stop it.
+    const ASSIGNMENT_CHAIN_DEPTH: usize = 4_000;
+
+    // A stack overflow aborts the process, so the probe re-runs this test
+    // binary as a child without RUST_MIN_STACK (pinned to 16 MiB in
+    // .cargo/config.toml). The child test thread then has the 2 MiB default
+    // stack of an MCP blocking thread.
+    #[test]
+    fn decision_surface_parses_on_the_worker_stack() {
+        if std::env::var_os(STACK_PROBE_ENV).is_some() {
+            run_stack_probe_child();
+            return;
+        }
+
+        let current_exe = std::env::current_exe().expect("current test binary should be known");
+        let output = Command::new(current_exe)
+            .arg("--exact")
+            .arg(STACK_PROBE_TEST)
+            .arg("--nocapture")
+            .env(STACK_PROBE_ENV, "1")
+            .env_remove("RUST_MIN_STACK")
+            .output()
+            .expect("stack probe child should start");
+
+        assert!(
+            output.status.success(),
+            "stack probe child failed with status {:?}\nstdout:\n{}\nstderr:\n{}",
+            output.status.code(),
+            String::from_utf8_lossy(&output.stdout),
+            String::from_utf8_lossy(&output.stderr)
+        );
+    }
+
+    fn run_stack_probe_child() {
+        let project = tempfile::tempdir().expect("temp dir");
+        let root = project.path();
+        std::fs::write(root.join("index.ts"), "export const used = 1;\n").expect("write entry");
+        git(root, &["init", "-b", "main"]);
+        git(root, &["add", "."]);
+        commit(root, "initial");
+        git(root, &["checkout", "-b", "feature"]);
+        let deep = format!(
+            "export let a = 0;\n{}1;\n",
+            "a=".repeat(ASSIGNMENT_CHAIN_DEPTH)
+        );
+        std::fs::write(root.join("deep.ts"), deep).expect("write deep file");
+        git(root, &["add", "."]);
+        commit(root, "deep");
+
+        let options = DecisionSurfaceOptions {
+            analysis: AnalysisOptions {
+                root: Some(root.to_path_buf()),
+                threads: Some(1),
+                no_cache: true,
+                ..AnalysisOptions::default()
+            },
+            base: Some("main".to_owned()),
+            max_decisions: None,
+        };
+        super::super::run_decision_surface(&options).expect("decision surface should run");
+    }
+
+    fn commit(root: &Path, message: &str) {
+        git(
+            root,
+            &[
+                "-c",
+                "user.email=test@example.com",
+                "-c",
+                "user.name=Test",
+                "-c",
+                "commit.gpgsign=false",
+                "commit",
+                "-m",
+                message,
+            ],
+        );
+    }
+
+    fn git(root: &Path, args: &[&str]) {
+        let status = fallow_engine::changed_files::clear_ambient_git_env(&mut Command::new("git"))
+            .args(args)
+            .current_dir(root)
+            .status()
+            .expect("git command");
+        assert!(status.success(), "git {args:?} failed");
+    }
+}
```

**File**: `crates/cli/src/rayon_pool.rs` (modified, +1/-3)
```diff
@@ -1,11 +1,9 @@
-use fallow_engine::thread_pool::worker_pool_builder;
-
 #[allow(
     dead_code,
     reason = "used by the CLI binary; the library build uses per-call pools"
 )]
 pub fn configure_global_pool(threads: usize) {
-    let _ = worker_pool_builder(threads).build_global();
+    let _ = fallow_api::configure_global_analysis_pool(threads);
 }
 
 #[cfg(test)]
```

**File**: `crates/engine/src/thread_pool.rs` (modified, +4/-2)
```diff
@@ -4,8 +4,10 @@
 ///
 /// Recursive AST extraction and analysis overflow the default Rayon worker
 /// stack on deeply nested sources, so every pool that runs analysis work must
-/// be built with this size. The CLI global pool and the programmatic per-call
-/// pools share this builder so embedders cannot drift.
+/// be built with this size. The CLI and LSP global pools and the programmatic
+/// per-call pools share this builder so embedders cannot drift. A thread that
+/// runs analysis outside these pools, such as a Tokio blocking thread in a
+/// server, needs this size too.
 pub const WORKER_STACK_SIZE: usize = 16 * 1024 * 1024;
 
 /// Rayon pool builder preconfigured with the analysis worker stack size.
```

**File**: `crates/lsp/Cargo.toml` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ mimalloc = { workspace = true }
 
 [dev-dependencies]
 proptest = { workspace = true }
+# The runtime stack probe drives the global Rayon pool that analysis uses.
+rayon = { workspace = true }
 tempfile = { workspace = true }
 # `io-util` (duplex pipes, BufReader, AsyncRead/WriteExt) is test-only: the
 # `Server::serve` integration test drives the LSP over framed duplex streams.
```

**File**: `crates/lsp/src/lib.rs` (modified, +2/-4)
```diff
@@ -23,6 +23,7 @@ mod path_utils;
 mod position;
 mod protocol;
 mod publish;
+mod runtime;
 mod schedule;
 mod server_capabilities;
 mod session_store;
@@ -1476,10 +1477,7 @@ pub fn run_stdio_server() -> std::process::ExitCode {
         return std::process::ExitCode::SUCCESS;
     }
 
-    let runtime = match tokio::runtime::Builder::new_multi_thread()
-        .enable_all()
-        .build()
-    {
+    let runtime = match runtime::build_server_runtime() {
         Ok(runtime) => runtime,
         Err(error) => {
             #[expect(
```

---

### Incident Patch 3: `b694b00e` (2026-10-22)
**Commit Message**: fix(extract): stop class credit through a nested non-instance shadow (#3800)

* fix(extract): stop class credit through a nested non-instance shadow

`binding_target_names` is module-flat. A module instance
`const service = new Service()` gave credit to `Service.m` for
`service.m`, `service['m']` and `const { m } = service` inside a
function that declares its own `service`. Fallow then missed an unused
member.

Each nested scope now records the names it declares that provably hold
no class instance: an object literal of functions and primitives, a
primitive or function value, or a parameter typed by a primitive,
function or type literal type. A read through such a root keeps its raw
access but does not resolve through the flat class bindings. A class
binding under the same root clears the record, so a class instance that
the nested scope declares keeps its credit.

Loop variables, catch parameters, untyped parameters and named type
annotations give no proof and keep the old credit.

CACHE_VERSION goes to 372 because the extraction output changes.

Fixes #3798

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* chore: bump cache versions above the base branch

Signed-off-by: Bart

**File**: `changelog.d/fix-shadowed-class-binding-credit.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **`unused-class-members` no longer credits a class through a local shadow.** Without `--type-aware`, a module instance `const service = new Service()` gave credit to `Service.m` for `service.m`, `service['m']`, `const { m } = service` and `({ m }: typeof service)` inside a function that declares its own `service`. Fallow then missed an unused member. Fallow now ignores this credit when the nested `service` provably holds no class instance: an object literal of functions and primitives, a primitive or function value, or a parameter whose type annotation is a primitive, literal or function type. A type literal or a named type gives no proof, because a class instance can satisfy it. A class instance that the nested scope declares keeps its credit.
```

**File**: `crates/core/tests/integration_test/member_detection.rs` (modified, +37/-0)
```diff
@@ -74,6 +74,43 @@ fn parameter_and_assignment_destructures_credit_class_members() {
     );
 }
 
+/// A nested binding that provably holds no class instance shadows the module
+/// instance of the same name. A read through the shadow gives no credit to the
+/// class. A class instance that is declared in the nested scope keeps its
+/// credit, and so does a parameter typed by a type literal, because a class
+/// instance satisfies that type.
+#[test]
+fn nested_non_instance_shadow_gives_no_class_member_credit() {
+    let config = create_config(fixture_path("shadowed-class-binding-members"));
+    let results = fallow_core::analyze(&config).expect("analysis should succeed");
+    let mut unused: Vec<(&str, &str)> = results
+        .unused_class_members
+        .iter()
+        .map(|item| {
+            (
+                item.member.parent_name.as_str(),
+                item.member.member_name.as_str(),
+            )
+        })
+        .collect();
+    unused.sort_unstable();
+    assert_eq!(
+        unused,
+        [
+            ("Service", "shadowBeforeVar"),
+            ("Service", "shadowBlock"),
+            ("Service", "shadowComputed"),
+            ("Service", "shadowDestructure"),
+            ("Service", "shadowInner"),
+            ("Service", "shadowLocal"),
+            ("Service", "shadowTypeof"),
+            ("Service", "toFixed"),
+            ("Service", "toLowerCase"),
+            ("Service", "toUpperCase")
+        ]
+    );
+}
+
 #[test]
 fn type_guard_subject_member_access_credits_only_its_predicate_class() {
     let project = tempfile::tempdir().expect("create project");
```

**File**: `crates/extract/src/cache/types.rs` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ use crate::MemberKind;
 /// extraction semantics change, and give the reason in the commit message and
 /// the CHANGELOG. A stale version serves old extraction results from a warm
 /// cache. The `assert_cached_type_size!` guards below catch shape changes.
-pub(super) const CACHE_VERSION: u32 = 373;
+pub(super) const CACHE_VERSION: u32 = 374;
 
 /// Duplication token cache version. Bump it when duplicate tokenization,
 /// normalization, or the on-disk token cache schema changes, and give the
```

**File**: `crates/extract/src/visitor/mod.rs` (modified, +19/-30)
```diff
@@ -989,6 +989,14 @@ pub(crate) struct ModuleInfoExtractor {
     loop_object_property_values: Vec<FxHashMap<String, FxHashMap<String, Vec<String>>>>,
     package_resolution_function_args: FxHashMap<String, usize>,
     nested_declaration_stack: Vec<FxHashSet<String>>,
+    /// Per `nested_declaration_stack` frame: the names declared there that
+    /// provably hold no class instance, such as `const service = { m() {} }` or
+    /// a parameter `service: number`.
+    scoped_non_instance_bindings: Vec<FxHashSet<String>>,
+    /// Indices into `member_accesses` whose receiver root is one of those
+    /// shadows. `resolve_bound_member_accesses` does not resolve them through
+    /// the module-flat class bindings.
+    shadowed_member_access_indices: FxHashSet<usize>,
     class_type_param_constraints: Vec<FxHashMap<String, Option<TypePropertyTarget>>>,
     pending_playwright_factory_calls: Vec<PendingPlaywrightFactory>,
     pending_playwright_factory_aliases: Vec<(String, String)>,
@@ -1762,30 +1770,6 @@ impl ModuleInfoExtractor {
         self.semantic_facts.extend(whole_object_facts);
     }
 
-    fn insert_class_binding_target(&mut self, binding: String, target: String) {
-        self.walk_order_class_bindings
-            .insert(binding.clone(), target.clone());
-        let target = BindingTarget::Class(target);
-        self.binding_target_names
-            .entry(binding)
-            .and_modify(|existing| {
-                if *existing != target {
-                    *existing = BindingTarget::Ambiguous;
-                }
-            })
-            .or_insert(target);
-    }
-
-    fn insert_class_binding_target_if_absent(&mut self, binding: String, target: String) {
-        if !self.binding_target_names.contains_key(&binding) {
-            self.walk_order_class_bindings
-                .insert(binding.clone(), target.clone());
-        }
-        self.binding_target_names
-            .entry(binding)
-            .or_insert(BindingTarget::Class(target));
-    }
-
     fn direct_object_binding_targets(&self, object: &str) -> Option<(&FxHashSet<String>, u64)> {
         let root = object.split_once('.').map_or(object, |(root, _)| root);
         for index in (0..self.scoped_direct_object_binding_targets.len()).rev() {
@@ -1894,7 +1878,9 @@ impl ModuleInfoExtractor {
             };
             prefix = parent;
         }
-        if let Some(class) = self.walk_order_class_bindings.get(object) {
+        if let Some(class) = self.walk_order_class_bindings.get(object)
+            && !self.class_binding_root_is_shadowed(object)
+        {
             self.walk_order_member_accesses.push((
                 Some(object.to_string()),
                 class.clone(),
@@ -2013,10 +1999,7 @@ impl ModuleInfoExtractor {
             {
                 let object = self.qualify_this_scope(&object_name);
                 if !self.record_walk_order_member_access(&object, current.property.name.as_str()) {
-                    self.member_accesses.push(MemberAccess {
-                        object,
-                        member: current.property.name.to_string(),
-                    });
+                    self.push_receiver_member_access(object, current.property.name.to_string());
                 }
             }
             match &current.object {
@@ -3254,6 +3237,9 @@ impl ModuleInfoExtractor {
     }
 
     fn resolve_bound_object_name(&self, object: &str) -> Option<BindingTarget> {
+        if self.class_binding_root_is_shadowed(object) {
+            return None;
+        }
         if let Some(target_name) = self.binding_target_names.get(object) {
             return Some(target_name.clone());
         }
@@ -3384,7 +3370,10 @@ impl ModuleInfoExtractor {
         let mut additional_accesses = Vec::new();
         let mut additional_facts = Vec::new();
         let mut additional_typed_property_facts = Vec::new();
-        for access in &self.member_accesses {
+        for (index, access) in self.member_accesses.iter().enumerate() {
+            if self.shadowed_member_access_indices.contains(&index) {
+                continue;
+            }
             let Some(target) = self.resolve_bound_object_name(&access.object) else {
                 continue;
             };
```

**File**: `crates/extract/src/visitor/visit_impl.rs` (modified, +5/-8)
```diff
@@ -1790,6 +1790,7 @@ impl ModuleInfoExtractor {
                 for declarator in nested_scope_declarators(var) {
                     self.record_nested_declaration_names(declarator.id.get_binding_identifiers());
                 }
+                self.record_non_instance_declarators(var);
             }
             Declaration::ClassDeclaration(class) => {
                 if let Some(id) = class.id.as_ref() {
@@ -2503,10 +2504,7 @@ impl<'a> ModuleInfoExtractor {
         {
             let object = self.qualify_this_scope(object_name);
             if !self.record_walk_order_member_access(&object, member) {
-                self.member_accesses.push(MemberAccess {
-                    object,
-                    member: member.to_string(),
-                });
+                self.push_receiver_member_access(object, member.to_string());
             }
         }
     }
@@ -3886,6 +3884,7 @@ impl<'a> Visit<'a> for ModuleInfoExtractor {
         self.preseed_direct_object_binding_scope_roots(&stmt.body);
         if self.namespace_depth == 0 {
             self.nested_declaration_stack.push(FxHashSet::default());
+            self.scoped_non_instance_bindings.push(FxHashSet::default());
             self.scoped_namespace_binding_names
                 .push(FxHashSet::default());
             self.scoped_array_binding_element_types
@@ -3910,6 +3909,7 @@ impl<'a> Visit<'a> for ModuleInfoExtractor {
         }
         if self.namespace_depth == 0 {
             self.nested_declaration_stack.pop();
+            self.scoped_non_instance_bindings.pop();
             self.scoped_namespace_binding_names.pop();
             self.scoped_array_binding_element_types.pop();
             self.sanitizer_binding_stack.pop();
@@ -5198,10 +5198,7 @@ impl<'a> Visit<'a> for ModuleInfoExtractor {
             if let Expression::StringLiteral(lit) = &expr.expression
                 && !shadowed
             {
-                self.member_accesses.push(MemberAccess {
-                    object: obj.name.to_string(),
-                    member: lit.value.to_string(),
-                });
+                self.push_receiver_member_access(obj.name.to_string(), lit.value.to_string());
                 self.mark_structured_namespace_reference(obj);
             } else if !shadowed {
                 self.record_whole_object_identifier_use(obj.name.as_str());
```

**File**: `crates/extract/src/visitor/visit_impl_scope_bindings.rs` (modified, +177/-0)
```diff
@@ -47,6 +47,79 @@ impl<'a> Visit<'a> for FunctionVarRootCollector {
     fn visit_ts_global_declaration(&mut self, _declaration: &TSGlobalDeclaration<'a>) {}
 }
 
+/// Whether a nested binding initialized with `expr` provably holds no class
+/// instance: a primitive, a function, or an array or object literal built
+/// only from such values. A type assertion can name a class, so it gives no
+/// proof.
+fn expression_holds_no_instance(expr: &Expression<'_>) -> bool {
+    match expr {
+        Expression::ParenthesizedExpression(paren) => {
+            expression_holds_no_instance(&paren.expression)
+        }
+        Expression::StringLiteral(_)
+        | Expression::NumericLiteral(_)
+        | Expression::BooleanLiteral(_)
+        | Expression::NullLiteral(_)
+        | Expression::BigIntLiteral(_)
+        | Expression::RegExpLiteral(_)
+        | Expression::TemplateLiteral(_)
+        | Expression::FunctionExpression(_)
+        | Expression::ArrowFunctionExpression(_)
+        | Expression::ClassExpression(_) => true,
+        Expression::ArrayExpression(array) => array.elements.iter().all(|element| {
+            element
+                .as_expression()
+                .is_some_and(expression_holds_no_instance)
+        }),
+        Expression::ObjectExpression(object) => {
+            object.properties.iter().all(|property| match property {
+                ObjectPropertyKind::ObjectProperty(property) => {
+                    expression_holds_no_instance(&property.value)
+                }
+                ObjectPropertyKind::SpreadProperty(_) => false,
+            })
+        }
+        _ => false,
+    }
+}
+
+/// Whether a binding annotated with `ty` provably holds no class instance: a
+/// primitive, a literal or function type, or an array or union built only from
+/// such types. TypeScript types are structural, so a class instance satisfies
+/// a named type or a type literal with matching members. Neither gives proof.
+fn type_holds_no_instance(ty: &TSType<'_>) -> bool {
+    match ty {
+        TSType::TSStringKeyword(_)
+        | TSType::TSNumberKeyword(_)
+        | TSType::TSBooleanKeyword(_)
+        | TSType::TSBigIntKeyword(_)
+        | TSType::TSSymbolKeyword(_)
+        | TSType::TSNullKeyword(_)
+        | TSType::TSUndefinedKeyword(_)
+        | TSType::TSVoidKeyword(_)
+        | TSType::TSNeverKeyword(_)
+        | TSType::TSLiteralType(_)
+        | TSType::TSTemplateLiteralType(_)
+        | TSType::TSFunctionType(_) => true,
+        TSType::TSParenthesizedType(paren) => type_holds_no_instance(&paren.type_annotation),
+        TSType::TSArrayType(array) => type_holds_no_instance(&array.element_type),
+        TSType::TSUnionType(union) => union.types.iter().all(type_holds_no_instance),
+        _ => false,
+    }
+}
+
+/// Whether a nested declarator binds a value that provably holds no class
+/// instance, through its type annotation or its initializer.
+fn declarator_holds_no_instance(declarator: &VariableDeclarator<'_>) -> bool {
+    if let Some(annotation) = declarator.type_annotation.as_deref() {
+        return type_holds_no_instance(&annotation.type_annotation);
+    }
+    declarator
+        .init
+        .as_ref()
+        .is_some_and(expression_holds_no_instance)
+}
+
 impl ModuleInfoExtractor {
     pub(super) fn is_module_scope(&self) -> bool {
         self.block_depth == 0 && self.function_depth == 0 && self.namespace_depth == 0
@@ -56,6 +129,101 @@ impl ModuleInfoExtractor {
         self.namespace_depth == 0
     }
 
+    /// Whether the root of `object` names a nested binding that provably holds
+    /// no class instance. `binding_target_names` is module-flat, so a read of
+    /// such a shadow must not resolve through the class binding of the same
+    /// name in an outer or sibling scope.
+    pub(in crate::visitor) fn class_binding_root_is_shadowed(&self, object: &str) -> bool {
+        let root = object.split_once('.').map_or(object, |(root, _)| root);
+        self.nested_declaration_stack
+            .iter()
+            .rposition(|scope| scope.contains(root))
+            .and_then(|index| self.scoped_non_instance_bindings.get(index))
+            .is_some_and(|scope| scope.contains(root))
+    }
+
+    /// Record the nested declarators of `var` that provably hold no class
+    /// instance. Call it together with `record_nested_declaration_names`.
+    pub(super) fn record_non_instance_declarators(&mut self, var: &VariableDeclaration<'_>) {
+        if self.namespace_depth > 0 {
+            return;
+        }
+        let Some(scope) = self.scoped_non_instance_bindings.last_mut() else {
+            return;
+        };
+        for declarator in &var.declarations {
+            if let BindingPattern::BindingIdentifier(id) = &declarator.id
+                && declarator_holds_no_instance(declarator)
+            {
+                scope.insert(id.name.to_string());
+            }
+        }
+    }
+
+    /// A class binding under
```

**File**: `tests/fixtures/shadowed-class-binding-members/package.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "name": "shadowed-class-binding-members",
+  "main": "src/index.ts"
+}
```

**File**: `tests/fixtures/shadowed-class-binding-members/src/index.ts` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+import { Service } from './service';
+
+const service = new Service();
+service.keptModule();
+
+export function unshadowed(): void {
+  service.keptUnshadowed();
+}
+
+export function localShadow(): void {
+  const service = { shadowLocal(): void {} };
+  service.shadowLocal();
+}
+
+export function computedShadow(): void {
+  const service = { shadowComputed(): void {} };
+  service['shadowComputed']();
+}
+
+export function typeofShadow(): void {
+  const service = { shadowTypeof(): void {} };
+  const read = ({ shadowTypeof }: typeof service): void => shadowTypeof();
+  read(service);
+}
+
+export function sibling(): void {
+  service.keptSibling();
+}
+
+export function paramShadow(service: string): string {
+  return service.toUpperCase();
+}
+
+export const arrowParamShadow = (service: number): string => service.toFixed();
+
+export function destructureShadow(): void {
+  const service = { shadowDestructure(): void {} };
+  const { shadowDestructure } = service;
+  shadowDestructure();
+}
+
+export function paramDestructureShadow(service: string): string {
+  const { toLowerCase } = service;
+  return toLowerCase.call(service);
+}
+
+// A type literal gives no proof: a `Service` instance satisfies it.
+export function structuralParam(service: { keptStructural(): void }): void {
+  service.keptStructural();
+}
+structuralParam(new Service());
+
+export function structuralParamDestructure(service: { keptStructuralDestructure(): void }): void {
+  const { keptStructuralDestructure } = service;
+  keptStructuralDestructure();
+}
+structuralParamDestructure(new Service());
+
+// `var` hoists, so the read before the declaration uses the local binding.
+export function readBeforeVar(): void {
+  service.shadowBeforeVar();
+  var service = { other: 1 };
+  void service;
+}
+
+export function closureThenSiblingShadow(): () => void {
+  const read = (): void => service.keptClosure();
+  {
+    const service = { other: 1 };
+    void service;
+  }
+  return read;
+}
+
+export function annotatedInstance(): void {
+  const service: Service = new Service();
+  service.keptAnnotated();
+}
+
+export function blockShadow(flag: boolean): void {
+  if (flag) {
+    const service = { shadowBlock(): void {} };
+    service.shadowBlock();
+  }
+}
+
+export function nestedClassBinding(): void {
+  const service = new Service();
+  service.keptNested();
+  const { keptNestedDestructure } = service;
+  keptNestedDestructure();
+}
+
+export function outer(): void {
+  const service = new Service();
+  function inner(): void {
+    const service = { shadowInner(): void {} };
+    service.shadowInner();
+  }
+  inner();
+  service.keptOuter();
+}
```

#### Recent Merged Pull Requests:
- **PR #3810** (2026-10-22): test(graph): require the package entry resolver to keep its canonical index (@BartWaardenburg)
- **PR #3808** (2026-10-22): perf(extract): cap recorded member chain names at 64 links (@BartWaardenburg)
- **PR #3806** (2026-10-22): fix(lsp,mcp): run analysis on threads with the worker stack (@BartWaardenburg)
- **PR #3805** (2026-10-22): chore(release): ship LICENSE and a full README in every platform npm package (@BartWaardenburg)
- **PR #3804** (2026-10-22): perf(graph): build the canonical package entry index one time per package (@BartWaardenburg)
- **PR #3803** (2026-10-22): fix(extract): credit class members read by destructures of imported instances and class fields (@BartWaardenburg)

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

## X. extract): stop deeply nested brackets from aborting the run (#3790)

**RULE**:
When implementing operations in `changelog.d/fix-deep-nesting-stack-overflow.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fallow-rs/fallow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c642c586`: extract): stop deeply nested brackets from aborting the run (#3790). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/fix-deep-nesting-stack-overflow.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
### Fixed

- **A file with deeply nested brackets no longer aborts the run.** A source with thousands of nested `(`, `[`, `{` or template substitutions overflowed the parser stack, and the stack overflow killed the whole `fallow` process. Fallow now measures the nesting before it parses a file. A file past the limit shows as a file that failed to parse, `fallow dupes` finds no clones in it, and the analysis of the other files continues. Brackets inside strings, comments and template text do not count. The extraction and duplication cache versions change, so the first run after the upgrade parses every file again. OSS-Fuzz found this.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c642c586` are properly handled with clean fallback behavior.
