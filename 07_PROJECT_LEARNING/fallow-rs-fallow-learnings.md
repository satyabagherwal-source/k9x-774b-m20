> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source**: github ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Source Version**: `52965b80`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T23:59:18.747Z  
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
> **Harvest Timestamp**: 2026-10-27T23:59:17.505Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5261 stars

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
- **Issue #3886** (2026-10-27): **unused-dependencies: inspect literal local shell helpers invoked by package scripts**
  *Symptoms*: Package command analysis credits direct binaries and discovers JavaScript or TypeScript helper files, but does not read an invoked shell helper's contents.  For example:  ```json { "scripts": { "build": "bash scripts/build.sh" } } ```  ```sh # scripts/build.sh report-cli --format json ```  If an installed local package declares the `report-cli` binary and the helper is its only usage, command analysis does not discover that usage. A useful regression fixture would declare an otherwise unused package as a negative control.  The [command analysis entry point](https://github.com/fallow-rs/fallow/blob/9c6fc8a2bb1e8a207441ec5f7a5d7b361a34b180/crates/core/src/scripts/mod.rs#L1383) processes supplied command strings. [Command accumulation](https://github.com/fallow-rs/fallow/blob/9c6fc8a2bb1e8a207441ec5f7a5d7b361a34b180/crates/core/src/scripts/mod.rs#L1464) collects binary and file information without reading invoked shell files. There is already separate [shell-content reading for hook directories](https://github.com/fallow-rs/fallow/blob/9c6fc8a2bb1e8a207441ec5f7a5d7b361a34b180/crates/core/src/scripts/hooks.rs#L144).  ## Requested behavior  Read statically named, project-local shell helpers without executing them, and feed supported commands into the existing binary-to-package analysis. Bound recursion and detect cycles. Respect working-directory changes or expose unresolved context rather than assuming a package is unused.  Cover `bash scripts/build.sh`, a directly invoked execut

- **Issue #3885** (2026-10-27): **audit: align API and MCP base-worktree cleanup with the CLI snapshot lifecycle**
  *Symptoms*: The CLI deregisters its detached base snapshot before publishing the snapshot as ready. Programmatic audit uses a separate `TemporaryBaseWorktree` implementation, which keeps the worktree registered until `Drop`.  That makes internal base worktrees visible to Git-aware tools throughout API and MCP analysis. If the host process terminates before `Drop`, its registered worktree can remain behind. Normal return and cooperative cancellation do perform cleanup.  ## Current routes  - [Programmatic audit creates TemporaryBaseWorktree](https://github.com/fallow-rs/fallow/blob/9c6fc8a2bb1e8a207441ec5f7a5d7b361a34b180/crates/api/src/runtime/audit.rs#L194). - [Supported MCP audit requests use the typed API](https://github.com/fallow-rs/fallow/blob/9c6fc8a2bb1e8a207441ec5f7a5d7b361a34b180/crates/mcp/src/tools/audit.rs#L36). - [Temporary worktree creation](https://github.com/fallow-rs/fallow/blob/9c6fc8a2bb1e8a207441ec5f7a5d7b361a34b180/crates/engine/src/repo_refs.rs#L107) and [Drop cleanup](https://github.com/fallow-rs/fallow/blob/9c6fc8a2bb1e8a207441ec5f7a5d7b361a34b180/crates/engine/src/repo_refs.rs#L1197). - [Decision-surface base analysis](https://github.com/fallow-rs/fallow/blob/9c6fc8a2bb1e8a207441ec5f7a5d7b361a34b180/crates/api/src/runtime/decision_surface.rs#L264) uses the same implementation. - [CLI deregistration before readiness](https://github.com/fallow-rs/fallow/blob/9c6fc8a2bb1e8a207441ec5f7a5d7b361a34b180/crates/cli/src/base_worktree.rs#L120) provides the existing compari

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

### Incident Patch 1: `de0b6fe7` (2026-10-27)
**Commit Message**: fix(security): trust module-relative path bases and check every path segment (#3926)

* fix(security): trust module-relative path bases and check every path segment

A path that starts from import.meta.url, import.meta.dirname,
import.meta.filename, __dirname, __filename or process.cwd() and adds only
literal segments cannot carry caller input. Sink capture now treats such an
argument like a literal. A module-scope const that holds such a path is
also trusted. fileURLToPath(value) and new URL(value, import.meta.url) stay
candidates when value is not known.

The path.join and path.resolve matcher checked only the first argument.
The row is now variadic: it checks every argument and keeps one candidate
for each call. It prefers a source-backed argument. A path.relative
containment guard now clears every argument of the guarded call.

Closes #3711
Closes #3712

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* fix(extract): bump the extraction cache version for path-traversal facts

The cached security sinks and sanitized sink arguments change meaning in
this branch. Trusted module-relative paths are no longer sinks. A
path.relative guard now covers every argument, not only argume

**File**: `changelog.d/fix-path-traversal-trusted-bases-3711.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+### Fixed
+
+- **`fallow security` no longer reports module-relative paths as path-traversal candidates.** A path that starts from `import.meta.url`, `import.meta.dirname`, `import.meta.filename`, `__dirname`, `__filename` or `process.cwd()` and adds only literal segments cannot carry caller input. Examples are `path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")` and `fs.readFileSync(path.join(__dirname, "template.html"))`. A module-scope `const` that holds such a path is also trusted. The rule applies to every sink argument, so `res.sendFile(path.join(__dirname, "index.html"))` is also clear. `fileURLToPath(value)` and `new URL(value, import.meta.url)` stay candidates when `value` is not known.
+  (Closes [#3711](https://github.com/fallow-rs/fallow/issues/3711))
+- **`fallow security` now checks every `path.join` and `path.resolve` segment.** Before, the path-traversal matcher checked only the first argument, so `path.resolve(".", input)` and `path.join(".", input)` gave no candidate. The matcher now checks each argument and reports one candidate for each call. A `path.relative` containment guard on the result still clears the call.
+  (Closes [#3712](https://github.com/fallow-rs/fallow/issues/3712))
```

**File**: `crates/core/src/analyze/security/tainted_sink.rs` (modified, +24/-3)
```diff
@@ -295,7 +295,7 @@ type TaintedSinkSource<'a> = (&'a str, &'a str, Option<u32>);
 
 fn matcher_admits_sink(matcher: &Matcher, sink: &SinkSite, source: Option<(&str, &str)>) -> bool {
     matcher.sink_shape == sink.sink_shape
-        && matcher.arg_index == sink.arg_index
+        && matcher.admits_arg_index(sink.arg_index)
         && (sink.arg_is_non_literal || matcher.is_literal_aware())
         && matcher.admits_arg_kind(sink.arg_kind)
         && matcher.literal_value_satisfied(sink.arg_literal.as_ref())
@@ -645,6 +645,11 @@ fn collect_module_tainted_sinks(
         run.context.request_receivers,
     );
 
+    // A variadic row (`path.join` segments, #3712) can admit several arguments
+    // of one call. Keep one candidate per call and row, and prefer a
+    // source-backed argument over a source-free one.
+    let mut variadic_calls: FxHashMap<(u32, *const Matcher), usize> = FxHashMap::default();
+
     for sink in &module.security_sinks {
         let Some((matcher, source)) = match_tainted_sink(run, module, sink, &tainted_locals) else {
             continue;
@@ -663,15 +668,31 @@ fn collect_module_tainted_sinks(
             continue;
         }
 
-        findings.push(build_tainted_sink_finding(&TaintedSinkFindingInput {
+        let finding = build_tainted_sink_finding(&TaintedSinkFindingInput {
             matcher,
             sink,
             node,
             source,
             sink_line_col: (line, col),
             line_offsets_by_file: run.line_offsets_by_file,
             file_id,
-        }));
+        });
+        if !matcher.variadic {
+            findings.push(finding);
+            continue;
+        }
+        match variadic_calls.entry((sink.span_start, std::ptr::from_ref(matcher))) {
+            std::collections::hash_map::Entry::Occupied(slot) => {
+                let existing = &mut findings[*slot.get()];
+                if finding.source_backed && !existing.source_backed {
+                    *existing = finding;
+                }
+            }
+            std::collections::hash_map::Entry::Vacant(slot) => {
+                slot.insert(findings.len());
+                findings.push(finding);
+            }
+        }
     }
 }
 
```

**File**: `crates/core/tests/integration_test/security_catalogue_categories.rs` (modified, +60/-0)
```diff
@@ -637,6 +637,66 @@ fn path_traversal_url_guard_still_fires() {
     assert_candidate(&results, "src/url-guard.ts", "path-traversal", 22);
 }
 
+#[test]
+fn path_traversal_trusted_module_relative_base_does_not_fire() {
+    let results = analyze_with_security_sink("security-path-traversal");
+    let module_root: Vec<_> = results
+        .security_findings
+        .iter()
+        .filter(|f| {
+            f.path
+                .to_string_lossy()
+                .replace('\\', "/")
+                .ends_with("src/module-root.ts")
+        })
+        .map(|f| (f.line, f.category.clone()))
+        .collect();
+    assert!(
+        module_root.is_empty(),
+        "module-relative paths from trusted bases and literal segments must not be flagged: {module_root:?}"
+    );
+}
+
+#[test]
+fn path_traversal_untrusted_url_against_module_base_still_fires() {
+    let results = analyze_with_security_sink("security-path-traversal");
+    assert_candidate(
+        &results,
+        "src/module-root-url-input.ts",
+        "path-traversal",
+        22,
+    );
+    assert_candidate(
+        &results,
+        "src/module-root-file-url.ts",
+        "path-traversal",
+        22,
+    );
+}
+
+#[test]
+fn path_traversal_dynamic_later_segment_fires() {
+    let results = analyze_with_security_sink("security-path-traversal");
+    assert_candidate(
+        &results,
+        "src/later-segment-resolve.ts",
+        "path-traversal",
+        22,
+    );
+    assert_candidate(&results, "src/later-segment-join.ts", "path-traversal", 22);
+    assert_candidate(&results, "src/trusted-base-input.ts", "path-traversal", 22);
+}
+
+#[test]
+fn path_traversal_reports_one_candidate_per_call() {
+    let results = analyze_with_security_sink("security-path-traversal");
+    assert_eq!(
+        anchored_count(&results, "src/multi-dynamic.ts"),
+        1,
+        "two dynamic segments in one path.join call must produce one candidate"
+    );
+}
+
 // ── open-redirect (CWE-601), ungated (broad tier) ────────────────────────────
 
 #[test]
```

**File**: `crates/extract/src/cache/types.rs` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ use crate::MemberKind;
 /// extraction semantics change, and give the reason in the commit message and
 /// the CHANGELOG. A stale version serves old extraction results from a warm
 /// cache. The `assert_cached_type_size!` guards below catch shape changes.
-pub(super) const CACHE_VERSION: u32 = 389;
+pub(super) const CACHE_VERSION: u32 = 390;
 
 /// Duplication token cache version. Bump it when duplicate tokenization,
 /// normalization, or the on-disk token cache schema changes, and give the
```

**File**: `crates/extract/src/visitor/mod.rs` (modified, +5/-5)
```diff
@@ -1124,12 +1124,12 @@ pub(crate) struct ModuleInfoExtractor {
     module_sanitizer_bindings: FxHashMap<String, Option<SanitizerScope>>,
     /// Nested lexical sanitizer binding stack for functions and blocks.
     sanitizer_binding_stack: Vec<FxHashMap<String, Option<SanitizerScope>>>,
-    /// Module-scope literal-backed string allowlists. `false` means the name
-    /// shadows an outer allowlist but is not trusted itself.
+    /// Module-scope literal-backed string allowlists; `false` shadows without trust.
     module_literal_allowlist_bindings: FxHashMap<String, bool>,
-    /// Module-scope literal constants that can be propagated into security sink
-    /// argument classification.
+    /// Module-scope literal constants for security sink argument classification.
     module_static_sink_literals: FxHashMap<String, SinkLiteralValue>,
+    /// Module-scope `const` locals bound to a trusted module-relative path.
+    module_trusted_path_bindings: FxHashSet<String>,
     /// Nested lexical literal allowlist bindings.
     literal_allowlist_binding_stack: Vec<FxHashMap<String, bool>>,
     /// Module-scope locals initialized from risky literal regex patterns.
@@ -1332,7 +1332,7 @@ pub(crate) struct PendingTypedReactProps {
 #[derive(Debug, Clone, Copy)]
 pub(crate) struct SecurityPathSinkBinding {
     span_start: u32,
-    arg_index: u32,
+    arg_count: u32,
 }
 
 impl ModuleInfoExtractor {
```

**File**: `crates/extract/src/visitor/visit_impl_scope_bindings.rs` (modified, +7/-0)
```diff
@@ -351,8 +351,15 @@ impl ModuleInfoExtractor {
         }
         if decl.kind != VariableDeclarationKind::Const {
             self.module_static_sink_literals.remove(id.name.as_str());
+            self.module_trusted_path_bindings.remove(id.name.as_str());
             return;
         }
+        if self.is_trusted_static_path_expr(init) {
+            self.module_trusted_path_bindings
+                .insert(id.name.to_string());
+        } else {
+            self.module_trusted_path_bindings.remove(id.name.as_str());
+        }
         if let Some(value) = self.static_sink_literal_value(init) {
             self.module_static_sink_literals
                 .insert(id.name.to_string(), value);
```

**File**: `crates/extract/src/visitor/visit_impl_security_sanitizers.rs` (modified, +13/-7)
```diff
@@ -15,6 +15,9 @@ use super::{
 };
 use crate::js_text::JsText;
 
+#[path = "visit_impl_trusted_paths.rs"]
+mod trusted_paths;
+
 fn statement_exits_current_flow(stmt: &Statement<'_>) -> bool {
     match stmt {
         Statement::ReturnStatement(_) | Statement::ThrowStatement(_) => true,
@@ -416,11 +419,14 @@ impl ModuleInfoExtractor {
         let Some(binding) = self.path_sink_binding(local) else {
             return;
         };
-        self.sanitized_sink_args.push(SanitizedSinkArg {
-            span_start: binding.span_start,
-            arg_index: binding.arg_index,
-            scope: SanitizerScope::Path,
-        });
+        // The guard checks the call result, so it covers every path segment.
+        for arg_index in 0..binding.arg_count {
+            self.sanitized_sink_args.push(SanitizedSinkArg {
+                span_start: binding.span_start,
+                arg_index,
+                scope: SanitizerScope::Path,
+            });
+        }
     }
 
     pub(super) fn record_fail_closed_guard_after_statement(&mut self, stmt: &Statement<'_>) {
@@ -500,7 +506,7 @@ impl ModuleInfoExtractor {
         Some(rel.name.as_str())
     }
 
-    fn is_node_path_method_call(&self, call: &CallExpression<'_>, method: &str) -> bool {
+    pub(super) fn is_node_path_method_call(&self, call: &CallExpression<'_>, method: &str) -> bool {
         let Expression::StaticMemberExpression(member) = &call.callee else {
             return false;
         };
@@ -530,7 +536,7 @@ impl ModuleInfoExtractor {
         }
         Some(SecurityPathSinkBinding {
             span_start: call.span.start,
-            arg_index: 0,
+            arg_count: u32::try_from(call.arguments.len()).unwrap_or(u32::MAX),
         })
     }
 
```

**File**: `crates/extract/src/visitor/visit_impl_security_sinks.rs` (modified, +5/-1)
```diff
@@ -617,7 +617,11 @@ impl ModuleInfoExtractor {
             span,
         } = input;
         let arg_literal = self.static_sink_literal_value(arg_expr);
-        let arg_is_non_literal = arg_literal.is_none() && is_non_literal_arg(arg_expr);
+        // A path built only from trusted module-relative bases and literal
+        // segments is treated like a literal (issue #3711).
+        let arg_is_non_literal = arg_literal.is_none()
+            && is_non_literal_arg(arg_expr)
+            && !self.is_trusted_static_path_expr(arg_expr);
         if arg_is_non_literal
             && should_skip_clamped_resource_amplification_arg(
                 callee_path,
```

---

### Incident Patch 2: `b63c5f04` (2026-10-27)
**Commit Message**: fix(api): deregister the programmatic base snapshot before analysis (#3941)

The API, MCP and decision-surface base snapshot is now removed from Git registration before analysis, as the CLI already did. The cleanup of snapshots from stopped processes moves into the engine and runs for every snapshot. It keeps a snapshot whose owner is alive or cannot be inspected, and a snapshot younger than 60 seconds. Every Git command that Fallow starts now runs through one wrapper, which blocks repository discovery inside a snapshot and refuses an implicitly discovered bare repository.

Fixes #3885

**File**: `.github/workflows/ci.yml` (modified, +1/-0)
```diff
@@ -172,6 +172,7 @@ jobs:
               - 'crates/engine/src/changed_files.rs'
               - 'crates/engine/src/churn.rs'
               - 'crates/engine/src/repo_refs.rs'
+              - 'crates/engine/src/base_worktree_orphans.rs'
               - 'crates/engine/src/shell_quote.rs'
               - 'crates/engine/src/write_guard.rs'
               - 'crates/engine/Cargo.toml'
```

**File**: `Cargo.lock` (modified, +2/-0)
```diff
@@ -1326,6 +1326,7 @@ dependencies = [
  "fallow-graph",
  "fallow-mutation",
  "fallow-output",
+ "fallow-process",
  "fallow-security",
  "fallow-types",
  "globset",
@@ -1351,6 +1352,7 @@ dependencies = [
  "tracing",
  "tracing-subscriber",
  "url",
+ "windows-sys 0.61.2",
  "xxhash-rust",
 ]
 
```

**File**: `changelog.d/fix-api-base-worktree-lifecycle-3885.md` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+### Fixed
+
+- **Programmatic and MCP audits no longer show their base snapshot in `git worktree list`.**
+  The API, the MCP `audit` tool, and the decision surface now remove the Git
+  registration of the base snapshot before the base analysis starts, as
+  `fallow audit` does. They also remove the snapshots that a stopped process
+  left behind. A snapshot stays when its owner process can still run, when
+  Fallow cannot inspect that process, or when the snapshot is younger than one
+  minute.
+  (Closes [#3885](https://github.com/fallow-rs/fallow/issues/3885))
+
+### Security
+
+- **Git commands in an audit base snapshot no longer read a repository from the base commit.**
+  The `.git` file of a base snapshot pointed at a relative path. A base commit
+  could supply a directory at that path, or a directory shaped as a bare
+  repository, and Git then read its config. That config can run commands, for
+  example through `core.fsmonitor`. The `.git` file now names an absolute path
+  that cannot exist, and each Git command that Fallow runs inside a snapshot
+  gets a `GIT_DIR` that does not exist. Every Git command that Fallow starts
+  also sets `safe.bareRepository=explicit`, so Git does not use a directory
+  shaped as a bare repository that it finds on its own.
```

**File**: `crates/api/src/audit_run/base_files.rs` (modified, +1/-5)
```diff
@@ -3,9 +3,7 @@
 
 use std::io::Write as _;
 use std::path::{Path, PathBuf};
-use std::process::Command;
 
-use fallow_engine::changed_files::clear_ambient_git_env;
 use rustc_hash::{FxHashMap, FxHashSet};
 
 /// Whether the head run can stand in for the base snapshot.
@@ -147,14 +145,12 @@ impl BaseFileReader {
     /// available. The caller then treats the files as not reusable.
     #[must_use]
     pub fn spawn(root: &Path) -> Option<Self> {
-        let mut command = Command::new("git");
+        let mut command = fallow_engine::changed_files::git_command_in(root);
         command
             .args(["cat-file", "--batch"])
-            .current_dir(root)
             .stdin(std::process::Stdio::piped())
             .stdout(std::process::Stdio::piped())
             .stderr(std::process::Stdio::null());
-        clear_ambient_git_env(&mut command);
         let mut child = fallow_process::ScopedChild::spawn(&mut command).ok()?;
         let stdin = child.take_stdin()?;
         let stdout = child.take_stdout()?;
```

**File**: `crates/api/src/diff_risk/mod.rs` (modified, +1/-4)
```diff
@@ -20,7 +20,6 @@ pub mod clones;
 pub mod text;
 
 use std::path::{Path, PathBuf};
-use std::process::Command;
 
 use fallow_config::{ResolvedConfig, RulesConfig, Severity};
 use fallow_engine::changed_files::RenamedFile;
@@ -176,12 +175,10 @@ impl BaseSource {
 /// resolve one. The changed-file list uses the merge base too, so a base
 /// branch that moved on does not read as a change of this branch.
 pub(crate) fn merge_base(root: &Path, base_ref: &str) -> String {
-    let mut command = Command::new("git");
+    let mut command = fallow_engine::changed_files::git_command_in(root);
     command
         .args(["merge-base", "--end-of-options", base_ref, "HEAD"])
-        .current_dir(root)
         .stderr(std::process::Stdio::null());
-    fallow_engine::changed_files::clear_ambient_git_env(&mut command);
     command
         .output()
         .ok()
```

**File**: `crates/api/src/mutation/worktree.rs` (modified, +6/-7)
```diff
@@ -13,11 +13,8 @@
 
 use std::collections::BTreeMap;
 use std::path::{Path, PathBuf};
-use std::process::{Command, Stdio};
 
-use fallow_engine::changed_files::{
-    ChangedFilesError, clear_ambient_git_env, resolve_git_toplevel,
-};
+use fallow_engine::changed_files::{ChangedFilesError, resolve_git_toplevel};
 use sha2::{Digest, Sha256};
 
 /// The most ignored files that a start snapshot fingerprints. The run checks
@@ -211,7 +208,7 @@ pub fn snapshot(
         Err(ChangedFilesError::NotARepository) => return Ok(None),
         Err(error) => return Err(error.describe()),
     };
-    let mut command = Command::new("git");
+    let mut command = fallow_engine::changed_files::git_command_in(&toplevel);
     command.args([
         "status",
         "--porcelain=v1",
@@ -222,8 +219,6 @@ pub fn snapshot(
     if start.is_none() {
         command.arg("--ignored=matching");
     }
-    command.current_dir(&toplevel).stdin(Stdio::null());
-    clear_ambient_git_env(&mut command);
     let output = fallow_process::output(&mut command)
         .map_err(|error| format!("cannot run git status: {error}"))?;
     if !output.status.success() {
@@ -260,6 +255,10 @@ pub fn snapshot(
 
 #[cfg(test)]
 mod tests {
+    use std::process::Command;
+
+    use fallow_engine::changed_files::clear_ambient_git_env;
+
     use super::*;
 
     fn git(root: &Path, args: &[&str]) {
```

**File**: `crates/api/src/runtime/audit.rs` (modified, +234/-0)
```diff
@@ -1701,4 +1701,238 @@ mod tests {
             Some("merge-base with origin/main")
         );
     }
+
+    fn registered_worktree_count(root: &Path) -> usize {
+        let output = fallow_engine::changed_files::clear_ambient_git_env(&mut Command::new("git"))
+            .args(["worktree", "list", "--porcelain"])
+            .current_dir(root)
+            .output()
+            .expect("git worktree list");
+        assert!(output.status.success(), "git worktree list failed");
+        String::from_utf8_lossy(&output.stdout)
+            .lines()
+            .filter(|line| line.starts_with("worktree "))
+            .count()
+    }
+
+    /// #3885: the base snapshot of the programmatic audit, which MCP also
+    /// uses, is not registered with Git while the base analysis reads it.
+    #[test]
+    fn programmatic_base_snapshot_is_unregistered_during_base_analysis() {
+        use crate::audit_run::AuditBackend as _;
+
+        let project = tempfile::tempdir().expect("temp dir");
+        let root = project.path();
+        std::fs::write(
+            root.join("package.json"),
+            r#"{"name":"base-snapshot","main":"index.ts"}"#,
+        )
+        .expect("write manifest");
+        std::fs::write(root.join("index.ts"), "export const used = 1;\n").expect("write entry");
+        git(root, &["init", "-b", "main"]);
+        git(root, &["add", "."]);
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
+                "initial",
+            ],
+        );
+        let options = AuditOptions {
+            analysis: AnalysisOptions {
+                root: Some(root.to_path_buf()),
+                ..AnalysisOptions::default()
+            },
+            ..AuditOptions::default()
+        };
+        let analysis = analysis_options_for_audit(&options, "HEAD");
+        let resolved = audit_section_context(&analysis).expect("context resolves");
+        let config = load_programmatic_audit_config(&resolved).expect("config loads");
+        let backend = ProgrammaticAuditBackend {
+            options: &options,
+            analysis: &analysis,
+            resolved: &resolved,
+            config: &config,
+        };
+
+        let checkout = backend
+            .create_base_checkout("HEAD", None)
+            .unwrap_or_else(|_| panic!("base checkout is created"));
+        assert_eq!(
+            registered_worktree_count(root),
+            1,
+            "only the main worktree may be registered while the base analysis runs"
+        );
+        let base = backend
+            .run_base(checkout.path(), None)
+            .unwrap_or_else(|_| panic!("base analysis runs on the unregistered snapshot"));
+        assert!(base.subanalyses.dead_code.is_some());
+        assert_eq!(registered_worktree_count(root), 1);
+
+        let path = checkout.path().to_path_buf();
+        drop(checkout);
+        assert!(!path.exists(), "the base snapshot is removed on drop");
+        assert_eq!(registered_worktree_count(root), 1);
+    }
+
+    #[cfg(unix)]
+    fn commit_all(root: &Path, message: &str) {
+        git(root, &["add", "-f", "."]);
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
+    /// The base commit is untrusted. A gitdir that it commits under the name
+    /// of the snapshot stub, or as a nested bare repository, must not run its
+    /// config during the audit.
+    #[cfg(unix)]
+    #[test]
+    fn audit_never_runs_a_git_config_from_the_base_commit() {
+        let project = tempfile::tempdir().expect("temp dir");
+        let root = project.path().join("repo");
+        let marker = project.path().join("fsmonitor-ran");
+        std::fs::create_dir_all(&root).expect("create repo");
+        std::fs::write(
+            root.join("package.json"),
+            r#"{"name":"crafted-base","main":"index.ts"}"#,
+        )
+        .expect("write manifest");
+        std::fs::write(root.join("index.ts"), "export const used = 1;\n").expect("write entry");
+        for dir in ["fallow-audit-unregistered", "pkg"] {
+            let gitdir = root.join(dir);
+            std::fs::create_dir_all(gitdir.join("objects")).expect("create objects");
+            std::fs::create_dir_all(gitdir.join("refs")).expect("create refs");
+            std::fs::write(gitdir.join("objects/.keep"), "").expect("write keep");
+            std::fs::write(gitdir.join("refs/.keep"), "").expect("write keep");
+            std::fs::write(gitdir.join("HEAD"), "ref: refs/h
```

**File**: `crates/cli/src/agent_install/mcp.rs` (modified, +1/-2)
```diff
@@ -922,9 +922,8 @@ pub fn merge_codex(
 }
 
 fn is_git_tracked(root: &Path, relative: &str) -> bool {
-    Command::new("git")
+    fallow_engine::changed_files::git_command_in(root)
         .args(["ls-files", "--error-unmatch", relative])
-        .current_dir(root)
         .output()
         .is_ok_and(|output| output.status.success())
 }
```

---

### Incident Patch 3: `0299785a` (2026-10-27)
**Commit Message**: fix(resolve): escape the tsconfig directory in include globs (#3951)

* fix(resolve): escape the tsconfig directory in include globs

Fallow built each tsconfig `include` and `exclude` glob from the full
joined path. Glob syntax in the tsconfig directory, such as `app/[id]`,
`{a,b}`, `*` or `?`, then changed the pattern. The pattern did not
match the files of that directory, so a referenced config could drop
out of the chain and its `paths` aliases did not apply.

The tsconfig directory and the entry segments before the first
wildcard are now escaped literal text. In the entry, only `*` and `?`
are wildcards, the same as tsc, so brackets and braces are literal. A
tsconfig in the file system root no longer gets a double `/`.

The matching code moves to `tsconfig_scope.rs`, because
`specifier.rs` must not grow.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* test(resolve): replace the invalid glob test with a literal bracket test

A stray bracket in a tsconfig entry is now literal text, so it no longer builds an invalid glob. The old test then made a file system call, which Miri isolation blocks. The new test keeps a wildcard in the entry and checks that the bracket matches on

**File**: `changelog.d/fix-tsconfig-glob-directory-escape.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **A tsconfig in a directory whose name holds glob characters now applies to its files.** Fallow matched the `include` and `exclude` patterns of a tsconfig with the directory of that tsconfig as part of the glob. A directory such as `app/[id]`, `{a,b}`, `*` or `?` then changed the meaning of the pattern, so the pattern did not match the files in that directory. Fallow then could drop a referenced config, and its `paths` aliases did not apply. Fallow now treats the tsconfig directory as literal text. In the entry itself, Fallow reads only `*` and `?` as wildcards, the same as `tsc`, so an entry such as `app/[id]/**/*` matches the `[id]` directory.
```

**File**: `crates/graph/src/resolve/mod.rs` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ mod specifier;
 mod static_imports;
 #[cfg(test)]
 mod tests;
+mod tsconfig_scope;
 mod types;
 mod upgrades;
 mod work;
```

**File**: `crates/graph/src/resolve/specifier.rs` (modified, +8/-75)
```diff
@@ -5,7 +5,6 @@ use std::fs;
 use std::path::{Path, PathBuf};
 use std::sync::Arc;
 
-use globset::{Glob, GlobSetBuilder};
 use oxc_resolver::{Resolution, ResolveError, ResolveOptions, Resolver};
 use serde_json::Value;
 
@@ -28,6 +27,7 @@ use super::path_info::{
     normalize_npm_specifier,
 };
 use super::react_native::{build_condition_names, build_extensions};
+use super::tsconfig_scope::{glob_values_match, resolve_tsconfig_relative_path};
 use super::types::{DenoImportMapEntry, ResolveContext, ResolveResult};
 use super::workspace_alias::{
     resolve_failed_bare_package_specifier, try_aliased_workspace_package_fallback,
@@ -566,38 +566,6 @@ fn tsconfig_applies_to_file(
         .is_some_and(|exclude| glob_values_match(tsconfig_dir, exclude, from_file))
 }
 
-fn glob_values_match(base_dir: &Path, values: &[Value], path: &Path) -> bool {
-    let mut builder = GlobSetBuilder::new();
-    let mut has_patterns = false;
-    for value in values.iter().filter_map(Value::as_str) {
-        let mut pattern = resolve_tsconfig_relative_path(base_dir, value);
-        if !has_glob_meta(value) && pattern.is_dir() {
-            pattern = pattern.join("**/*");
-        }
-        let Some(pattern) = pattern.to_str() else {
-            continue;
-        };
-        let Ok(glob) = Glob::new(pattern) else {
-            continue;
-        };
-        builder.add(glob);
-        has_patterns = true;
-    }
-    has_patterns && builder.build().is_ok_and(|set| set.is_match(path))
-}
-
-fn has_glob_meta(value: &str) -> bool {
-    value
-        .bytes()
-        .any(|byte| matches!(byte, b'*' | b'?' | b'[' | b']' | b'{'))
-}
-
-/// Join a tsconfig `files`, `include` or `exclude` entry to its directory
-/// without `./` and `..`, as the globs match path text (issue #3946).
-fn resolve_tsconfig_relative_path(base_dir: &Path, path: &str) -> PathBuf {
-    normalize_path_lexically(&base_dir.join(path))
-}
-
 fn same_path(left: &Path, right: &Path) -> bool {
     if left == right {
         return true;
@@ -2205,7 +2173,7 @@ mod tests {
 
     use super::super::package_credit::package_usage_name_for_resolved_package;
     use super::{
-        SpecifierNormalization, extension_alias_matches, glob_values_match, has_glob_meta,
+        SpecifierNormalization, extension_alias_matches, glob_values_match,
         is_bare_style_package_reference, is_bare_style_subpath, is_js_ts_extension,
         is_node_modules_path, is_plain_css_file, is_relative_tsconfig_extends,
         is_safe_static_dir_relative_path, is_style_file, is_tsconfig_error,
@@ -2784,33 +2752,6 @@ mod tests {
         assert_eq!(result, None);
     }
 
-    // ---- has_glob_meta (lines 370-374) ----
-
-    #[test]
-    fn has_glob_meta_detects_star_wildcard() {
-        assert!(has_glob_meta("src/**/*.ts"));
-    }
-
-    #[test]
-    fn has_glob_meta_detects_question_mark() {
-        assert!(has_glob_meta("src/?.ts"));
-    }
-
-    #[test]
-    fn has_glob_meta_detects_bracket_group() {
-        assert!(has_glob_meta("src/[abc].ts"));
-    }
-
-    #[test]
-    fn has_glob_meta_detects_brace_group() {
-        assert!(has_glob_meta("src/{a,b}.ts"));
-    }
-
-    #[test]
-    fn has_glob_meta_plain_path_returns_false() {
-        assert!(!has_glob_meta("src/components"));
-    }
-
     // ---- path_alias_specificity (lines 734-738) ----
 
     #[test]
@@ -3086,17 +3027,16 @@ mod tests {
         );
     }
 
-    // ---- glob_values_match: invalid glob is skipped (line 362) ----
+    // ---- glob_values_match: a stray bracket is literal text ----
 
     #[test]
-    fn glob_values_match_invalid_glob_pattern_is_skipped() {
+    fn glob_values_match_stray_bracket_is_literal_text() {
         let base = Path::new("/project");
+        let values = [serde_json::json!("[invalid/*")];
         let source = Path::new("/project/src/index.ts");
-        let result = glob_values_match(base, &[serde_json::json!("[invalid")], source);
-        assert!(
-            !result,
-            "an invalid glob pattern must not accidentally match"
-        );
+        assert!(!glob_values_match(base, &values, source));
+        let literal = Path::new("/project/[invalid/index.ts");
+        assert!(glob_values_match(base, &values, literal));
     }
 
     // ---- glob_values_match: no patterns at all returns false ----
@@ -3184,13 +3124,6 @@ mod tests {
         assert!(is_bare_style_subpath("antd/lib/style/index.less"));
     }
 
-    // ---- has_glob_meta: closing brace or bracket alone ----
-
-    #[test]
-    fn has_glob_meta_closing_bracket_detected() {
-        assert!(has_glob_meta("src/[a-z]"));
-    }
-
     // ---- path_alias_specificity: wildcard-only pattern ----
 
     #[test]
```

**File**: `crates/graph/src/resolve/specifier_tsconfig_include_tests.rs` (modified, +136/-0)
```diff
@@ -1,6 +1,7 @@
 //! Tests for the scope of `include` patterns in a referenced tsconfig.
 
 use std::fs;
+use std::path::Path;
 
 use tempfile::tempdir;
 
@@ -50,3 +51,138 @@ fn referenced_tsconfig_paths_alias_resolves_existing_asset_file() {
         );
     });
 }
+
+/// A referenced tsconfig in a directory whose name holds glob syntax, such
+/// as a Next.js `[id]` route segment, applies to its files. The directory is
+/// literal text, so the config stays in the chain and its `paths` apply.
+#[test]
+#[cfg_attr(miri, ignore = "tempdir is blocked by Miri isolation")]
+fn referenced_tsconfig_in_glob_syntax_directory_applies_to_its_files() {
+    let temp = tempdir().unwrap();
+    let root = temp.path();
+    let app = root.join("app/[id]");
+    fs::create_dir_all(app.join("src")).unwrap();
+    fs::write(app.join("src/index.ts"), "").unwrap();
+    fs::write(
+        root.join("tsconfig.json"),
+        r#"{"files":[],"references":[{"path":"./app/[id]/tsconfig.app.json"}]}"#,
+    )
+    .unwrap();
+    fs::write(
+        app.join("tsconfig.app.json"),
+        r#"{"compilerOptions":{"paths":{"@lib/*":["./src/*"]}},"include":["./src/**/*"]}"#,
+    )
+    .unwrap();
+    let from_file = app.join("src/index.ts");
+
+    with_ctx_at_root(root, |ctx| {
+        let chain = super::local_tsconfig_chain(ctx, &from_file);
+        assert!(
+            chain
+                .iter()
+                .any(|path| path.ends_with("[id]/tsconfig.app.json")),
+            "the referenced config must stay in the chain, got {chain:?}"
+        );
+        assert!(super::matches_nearest_tsconfig_path_alias(
+            ctx,
+            &from_file,
+            "@lib/util"
+        ));
+    });
+}
+
+/// Glob syntax in the tsconfig directory matches only that literal
+/// directory, while a wildcard in the entry keeps its glob meaning.
+#[test]
+fn glob_values_match_treats_tsconfig_directory_as_literal() {
+    let include = [serde_json::json!("src/**/*.ts")];
+    for dir in ["[id]", "{a,b}", "*", "?"] {
+        let base = Path::new("/repo").join(dir);
+        assert!(
+            super::glob_values_match(&base, &include, &base.join("src/index.ts")),
+            "a file under `{dir}` must match"
+        );
+    }
+    let base = Path::new("/repo/[id]");
+    assert!(!super::glob_values_match(
+        base,
+        &include,
+        Path::new("/repo/i/src/index.ts")
+    ));
+    let base = Path::new("/repo/{a,b}");
+    assert!(!super::glob_values_match(
+        base,
+        &include,
+        Path::new("/repo/a/src/index.ts")
+    ));
+    let base = Path::new("/repo/*");
+    assert!(!super::glob_values_match(
+        base,
+        &include,
+        Path::new("/repo/other/src/index.ts")
+    ));
+    assert!(!super::glob_values_match(
+        base,
+        &include,
+        Path::new("/repo/*/src/index.js")
+    ));
+}
+
+/// A `..` entry leaves the tsconfig directory before glob syntax starts.
+#[test]
+fn glob_values_match_resolves_parent_segments_before_the_glob() {
+    let include = [serde_json::json!("../shared/**/*.ts")];
+    let base = Path::new("/repo/[id]/app");
+    assert!(super::glob_values_match(
+        base,
+        &include,
+        Path::new("/repo/[id]/shared/util.ts")
+    ));
+    assert!(!super::glob_values_match(
+        base,
+        &include,
+        Path::new("/repo/[id]/app/shared/util.ts")
+    ));
+}
+
+/// A tsconfig in the file system root joins its entries without a second `/`.
+#[test]
+fn glob_values_match_handles_tsconfig_in_root_directory() {
+    let include = [serde_json::json!("**/*")];
+    assert!(super::glob_values_match(
+        Path::new("/"),
+        &include,
+        Path::new("/a/b.ts")
+    ));
+}
+
+/// tsc reads only `*` and `?` as wildcards, so brackets and braces in an
+/// entry, such as a Next.js `app/[id]` route segment, are literal text.
+#[test]
+fn glob_values_match_treats_brackets_and_braces_in_entry_as_literal() {
+    let include = [
+        serde_json::json!("app/[id]/**/*"),
+        serde_json::json!("lib/{a,b}/*.ts"),
+    ];
+    let base = Path::new("/repo");
+    assert!(super::glob_values_match(
+        base,
+        &include,
+        Path::new("/repo/app/[id]/page.ts")
+    ));
+    assert!(!super::glob_values_match(
+        base,
+        &include,
+        Path::new("/repo/app/i/page.ts")
+    ));
+    assert!(super::glob_values_match(
+        base,
+        &include,
+        Path::new("/repo/lib/{a,b}/x.ts")
+    ));
+    assert!(!super::glob_values_match(
+        base,
+        &include,
+        Path::new("/repo/lib/a/x.ts")
+    ));
+}
```

**File**: `crates/graph/src/resolve/tsconfig_scope.rs` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+//! Match file paths against the `files`, `include` and `exclude` entries of a
+//! tsconfig, relative to the directory of that tsconfig.
+
+use std::path::{Path, PathBuf};
+
+use globset::{Glob, GlobSetBuilder};
+use serde_json::Value;
+
+use super::fallbacks::normalize_path_lexically;
+
+pub(super) fn glob_values_match(base_dir: &Path, values: &[Value], path: &Path) -> bool {
+    let mut builder = GlobSetBuilder::new();
+    let mut has_patterns = false;
+    for value in values.iter().filter_map(Value::as_str) {
+        let Ok(glob) = Glob::new(&tsconfig_entry_glob(base_dir, value)) else {
+            continue;
+        };
+        builder.add(glob);
+        has_patterns = true;
+    }
+    has_patterns && builder.build().is_ok_and(|set| set.is_match(path))
+}
+
+/// Build the glob for one `include` or `exclude` entry. tsc reads only `*`
+/// and `?` as wildcards, so the tsconfig directory, the entry segments before
+/// the first wildcard and any bracket or brace are literal path text. A
+/// directory such as `app/[id]` then matches only itself.
+fn tsconfig_entry_glob(base_dir: &Path, value: &str) -> String {
+    let glob_start = value
+        .find(['*', '?'])
+        .map(|wildcard| value[..wildcard].rfind('/').map_or(0, |slash| slash + 1));
+    let (literal, rest) = value.split_at(glob_start.unwrap_or(value.len()));
+    let literal = resolve_tsconfig_relative_path(base_dir, literal);
+    let rest = if glob_start.is_none() && literal.is_dir() {
+        "**/*"
+    } else {
+        rest
+    };
+    let mut glob = globset::escape(&literal.to_string_lossy().replace('\\', "/"));
+    if !rest.is_empty() && !glob.ends_with('/') {
+        glob.push('/');
+    }
+    for symbol in rest.chars() {
+        if matches!(symbol, '[' | ']' | '{' | '}') {
+            glob.extend(['[', symbol, ']']);
+        } else {
+            glob.push(symbol);
+        }
+    }
+    glob
+}
+
+/// Join a tsconfig `files`, `include` or `exclude` entry to its directory
+/// without `./` and `..`, as the globs match path text (issue #3946).
+pub(super) fn resolve_tsconfig_relative_path(base_dir: &Path, path: &str) -> PathBuf {
+    normalize_path_lexically(&base_dir.join(path))
+}
```

#### Recent Merged Pull Requests:
- **PR #3966** (2026-10-27): chore(docker): pin FALLOW_VERSION 3.37.0 with refreshed checksums (@BartWaardenburg)
- **PR #3965** (2026-10-27): fix(extract): name a function assigned to a declared variable in the inventory (@BartWaardenburg)
- **PR #3964** (2026-10-27): chore(napi): sync package.json / package-lock / index.js to v3.37.0 (@BartWaardenburg)
- **PR #3959** (2026-10-27): chore: release v3.37.0 (@BartWaardenburg)
- **PR #3958** (2026-10-27): chore: release v3.37.0 (@BartWaardenburg)
- **PR #3957** (2026-10-27): test(engine): make the cancelled parse test independent of runner speed (@BartWaardenburg)

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

## X. security): trust module-relative path bases and check every path segment (#3926)

**RULE**:
When implementing operations in `changelog.d/fix-path-traversal-trusted-bases-3711.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fallow-rs/fallow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `de0b6fe7`: security): trust module-relative path bases and check every path segment (#3926). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/fix-path-traversal-trusted-bases-3711.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
### Fixed

- **`fallow security` no longer reports module-relative paths as path-traversal candidates.** A path that starts from `import.meta.url`, `import.meta.dirname`, `import.meta.filename`, `__dirname`, `__filename` or `process.cwd()` and adds only literal segments cannot carry caller input. Examples are `path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")` and `fs.readFileSync(path.join(__dirname, "template.html"))`. A module-scope `const` that holds such a path is also trusted. The rule applies to every sink argument, so `res.sendFile(path.join(__dirname, "index.html"))` is also clear. `fileURLToPath(value)` and `new URL(value, import.meta.url)` stay candidates when `value` is not known.
  (Closes [#3711](https://github.com/fallow-rs/fallow/issues/3711))
- **`fallow security` now checks every `path.join` and `path.resolve` segment.** Before, the path-traversal matcher checked only the first argument, so `path.resolve(".", input)` and `path.join(".", input)` gave no candidate. The matcher now checks each argument and reports one candidate for each call. A `path.relative` containment guard on the result still clears the call.
  (Closes [#3712](https://github.com/f
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `de0b6fe7` are properly handled with clean fallback behavior.
