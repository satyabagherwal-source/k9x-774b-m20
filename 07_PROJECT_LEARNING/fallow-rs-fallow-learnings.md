> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source**: github ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Source Version**: `40e3eb97`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-29T12:26:02.209Z  
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
> **Harvest Timestamp**: 2026-10-29T12:26:00.475Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5269 stars

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
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

import { realPath } from "./child.mjs";

const SCRIPT_FORMATS = new Set(["module", "commonjs", "module-typescript", "commonjs-typescript"]);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

const indexSources = (overlay) => {
  const index = new Map();
  for (const [path, entry] of overlay) {
    const bytes = readFileSync(path);
    const key = digest(bytes);
    const matches = index.get(key) ?? [];
    matches.push({ bytes, entry });
    index.set(key, matches);
  }
  return index;
};

/**
 * Serves the instrumented file of each overlay entry in place of its source
 * file. `onLoad(entry)` runs for each served file.
 *
 * A synchronous hook runs in this thread for `import` and `require`. It keeps
 * the format of the original file, so Node strips the types of a TypeScript
 * file as it does without the overlay.
 */
export const registerOverlayHook = (overlay, onLoad, onIncomplete) => {
  let sources;
  const overlayEntry = (url, result) => {
    if (!url.startsWith("file:")) return undefined;
    const path = realPath(fileURLToPath(url));
    const direct = overlay.get(path);
    if (direct !== undefined) return direct;
    if (!SCRIPT_FORMATS.has(result.format) || result.source == null) return undefined;
    sources ??= indexSources(overlay);
    const bytes = ArrayBuffer.isView(result.source)
      ? Buffer.from(result.source.buffer, result.source.byteOffset, result.source.byteLength)
      : Buffer.from(result.source);
    const matches = (sources.get(digest(bytes)) ?? []).filter((match) => match.bytes.equals(bytes));
    if (matches.length > 1) {
      const candidates = matches.map(({ entry }) => entry.source).join(", ");
      onIncomplete(`Ambiguous copied-source execution at ${path}: matches ${candidates}`);
    }
    return matches.length === 1 ? matches[0].entry : undefined;
  };
  registerHooks({
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      const entry = overlayEntry(url, result);
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
- **Issue #3950** (2026-10-29): **mutation: temporary copies bypass the Node child-process overlay**
  *Symptoms*: A selected `node:test` case can run an unchanged temporary copy of a planned source file and produce a false survivor. The child inherits `NODE_OPTIONS`; the preload works when the child executes the original path.  Reproduced on main `ef1617dd4924c86829bef25deafeabef3743cb7f` (3.36.0), Node 22.23.3.  `src/cli.mjs`:  ```js export const value = () => { return 1; }; if (import.meta.main) {   console.log(value()); } ```  `test/runner.test.mjs`:  ```js import assert from "node:assert/strict"; import { spawnSync } from "node:child_process"; import { copyFileSync, mkdtempSync, rmSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path"; import { test } from "node:test"; import { fileURLToPath } from "node:url"; import { value } from "../src/cli.mjs";  test("the library and CLI return the same value", (t) => {   assert.equal(value(), 1);   const directory = mkdtempSync(join(tmpdir(), "copied-cli-repro-"));   t.after(() => rmSync(directory, { recursive: true, force: true }));   const original = fileURLToPath(new URL("../src/cli.mjs", import.meta.url));   const copied = join(directory, "cli.mjs");   copyFileSync(original, copied);   const child = spawnSync(process.execPath, [copied], {     encoding: "utf8", env: process.env, timeout: 10000,   });   assert.equal(child.status, 0, child.stderr);   assert.equal(child.stdout, "1\n"); }); ```  Configure `entry: ["src/cli.mjs", "test/*.test.mjs"]`, `mutation.runner: "node-test"`, and `test: "node --test test/*

- **Issue #3886** (2026-10-27): **unused-dependencies: inspect literal local shell helpers invoked by package scripts**
  *Symptoms*: Package command analysis credits direct binaries and discovers JavaScript or TypeScript helper files, but does not read an invoked shell helper's contents.  For example:  ```json { "scripts": { "build": "bash scripts/build.sh" } } ```  ```sh # scripts/build.sh report-cli --format json ```  If an installed local package declares the `report-cli` binary and the helper is its only usage, command analysis does not discover that usage. A useful regression fixture would declare an otherwise unused package as a negative control.  The [command analysis entry point](https://github.com/fallow-rs/fallow/blob/9c6fc8a2bb1e8a207441ec5f7a5d7b361a34b180/crates/core/src/scripts/mod.rs#L1383) processes supplied command strings. [Command accumulation](https://github.com/fallow-rs/fallow/blob/9c6fc8a2bb1e8a207441ec5f7a5d7b361a34b180/crates/core/src/scripts/mod.rs#L1464) collects binary and file information without reading invoked shell files. There is already separate [shell-content reading for hook directories](https://github.com/fallow-rs/fallow/blob/9c6fc8a2bb1e8a207441ec5f7a5d7b361a34b180/crates/core/src/scripts/hooks.rs#L144).  ## Requested behavior  Read statically named, project-local shell helpers without executing them, and feed supported commands into the existing binary-to-package analysis. Bound recursion and detect cycles. Respect working-directory changes or expose unresolved context rather than assuming a package is unused.  Cover `bash scripts/build.sh`, a directly invoked execut

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

### Incident Patch 1: `255f50fe` (2026-10-28)
**Commit Message**: fix(config): correct local-binding config reads after the multi-config change (#3987)

* fix(config): correct the review findings of the config local inlining

This change follows up #3981.

- Module Federation `exposes` in a webpack, rspack or rsbuild config
  array use the base directory only when all configs declare the same
  one. Before, they used the base directory of the first config, also
  when the plugin call was in a different config.
- A top-level `return config` is inlined unless a branch `return` gives
  an object after the inlining. A returned array is always inlined.
- The local pass follows `module.exports = config` to the callback of
  one top-level binding.
- The local pass inlines a returned top-level constant also when the
  callback has no locals.
- A loop binding, an array or object literal and a destructuring
  assignment that hold a binding are aliases of it. A call that gets an
  object or an array as an argument changes it, unless the callee only
  reads its arguments.
- The multi-config reader reads up to 64 configs and writes a debug
  message when an array has more.
- The stable-local filter uses a hash set.
- A new test checks that the inlined AST sta

**File**: `changelog.d/fix-webpack-function-config-local-aliases.md` (modified, +5/-4)
```diff
@@ -1,7 +1,8 @@
 ### Fixed
 
 - **`fallow dead-code` now reads a config that a function builds from local bindings.** Before, fallow reported the entries and alias targets of such a config as unused files. An example is a webpack config that exports `(env, argv) => { const common = {...}; const web = { ...common, entry: {...} }; return [bg, web]; }`. Fallow does not run the config code. The changes are:
-  - Fallow reads a local `const` or `let` binding with a literal value in the returned value of a config function. This applies to a returned identifier, an array element, a property value and an object spread such as `...common` or `...common.resolve`. When a spread and a key set the same property, the last value wins.
-  - Fallow also reads a spread of a stable top-level constant, such as `export default { ...base, test }`. These two changes apply to all plugins that read a JavaScript or TypeScript config, for example Vite, Vitest, Playwright and Electron.
-  - For webpack and rspack, fallow reads each config of an exported array, also when a function returns the array. Each config resolves its entries against its own `context`. Fallow collects the loaders, the `plugins` requires and the `externals` of all configs. For webpack, fallow also collects the aliases of all configs.
-  - Fallow does not read a binding that the config can change. This includes a write, a method such as `push`, a call such as `Object.assign`, and a change through an alias such as `const { resolve } = common`. Fallow also does not read a `var` binding, a destructured binding or the result of a call.
+  - Fallow reads a local `const` or `let` binding with a literal value in the returned value of a config function. This applies to a returned identifier, an array element, a property value and an object spread such as `...common` or `...common.resolve`. When a spread and a key set the same property, the last value wins. This also applies to a function that the file exports through a binding, such as `const config = (env) => {...}; module.exports = config;`.
+  - Fallow also reads a spread of a stable top-level constant, such as `export default { ...base, test }`, and a top-level constant that a config function returns, such as `module.exports = () => base;`. These changes apply to all plugins that read a JavaScript or TypeScript config, for example Vite, Vitest, Playwright and Electron.
+  - A top-level `return config` gives the config also when a branch `return` gives no object, such as `if (!env) return null;` or `return mergeConfig(config, overrides);`. When a branch `return` gives an object, fallow reads that object, as before. A returned array always gives the configs of the array.
+  - For webpack and rspack, fallow reads up to 64 configs of an exported array, also when a function returns the array. Each config resolves its entries against its own `context`. Module Federation `exposes` resolve against the `context` only when all configs declare the same `context`, because fallow does not know which config holds the plugin call. Fallow collects the loaders, the `plugins` requires and the `externals` of all configs. For webpack, fallow also collects the aliases of all configs.
+  - Fallow does not read a binding that the config can change. This includes a write, a method such as `push`, a call such as `Object.assign`, and a change through an alias such as `const { resolve } = common`, `({ resolve: r } = common)`, `const list = [common]` or `for (const c of [common])`. An object literal such as `const config = { mode, entry }` changes `entry` only through the `entry` key, as in `config.entry.admin = x`, not through `config.devtool = x` or `config.plugins.push(x)`. An alias keeps that key path, so `const plugins = config.plugins; plugins.push(x)` does not change `entry` either. A call to a function of the same file changes its argument only when the body of that function changes its parameter, also under the same key path. A call to an imported or unknown function, such as `addAnalyzer(config)` with `addAnalyzer` from `require`, does not count as a change, because fallow does not see what the function does. Fallow also does not read a `var` binding, a destructured binding or the result of a call.
```

**File**: `crates/core/src/plugins/config_parser.rs` (modified, +1/-3)
```diff
@@ -1206,9 +1206,7 @@ pub(crate) fn extract_from_source<T: Send>(
     fallow_extract::parse_bounded(source, || {
         let allocator = oxc_allocator::Allocator::default();
         let mut parsed = oxc_parser::Parser::new(&allocator, source, source_type).parse();
-        const_inline::inline_value_constants(&allocator, &mut parsed.program, source.len());
-        local_inline::inline_callback_locals(&allocator, &mut parsed.program, source.len());
-        extractor(&parsed.program)
+        const_inline::with_inlined_program(&allocator, &mut parsed.program, source.len(), extractor)
     })
     .flatten()
 }
```

**File**: `crates/core/src/plugins/config_parser_const_inline.rs` (modified, +130/-142)
```diff
@@ -7,13 +7,18 @@
 //! identifier in a property value or an array element with a copy of the
 //! constant's literal value, so that every walker reads it without change.
 
+use std::cell::RefCell;
+use std::rc::Rc;
+
 use oxc_allocator::{Allocator, CloneIn};
 #[allow(clippy::wildcard_imports, reason = "many AST types used")]
 use oxc_ast::ast::*;
 use oxc_ast_visit::{Visit, VisitMut, walk, walk_mut};
 use rustc_hash::{FxHashMap, FxHashSet};
 
 use super::top_level_variable_declarations;
+#[path = "config_parser_value_changes.rs"]
+mod value_changes;
 
 /// The maximum number of constants that one inlined value can pass through,
 /// as in `const A = {...}; const B = [A]; export default { x: B }`.
@@ -59,12 +64,7 @@ pub(super) fn constant_values<'a>(
     if candidates.is_empty() {
         return FxHashMap::default();
     }
-    let stable = stable_bindings(
-        program,
-        candidates.iter().map(|(name, _)| *name),
-        false,
-        true,
-    );
+    let stable = stable_values(program, candidates.iter().copied(), true);
     candidates
         .into_iter()
         .filter(|(name, _)| stable.contains(name))
@@ -397,28 +397,105 @@ pub(super) fn stable_bindings<'n>(
     allow_mutating_calls: bool,
     require_top_level: bool,
 ) -> FxHashSet<&'n str> {
+    binding_counts(program, names, require_top_level)
+        .into_iter()
+        .filter(|(_, count)| count.is_stable(allow_mutating_calls))
+        .map(|(name, _)| name)
+        .collect()
+}
+
+/// The subset of the named literal values that [`stable_bindings`] accepts
+/// with no mutating calls.
+pub(super) fn stable_values<'n, 'e, 'a: 'e>(
+    program: &Program<'_>,
+    candidates: impl IntoIterator<Item = (&'n str, &'e Expression<'a>)>,
+    require_top_level: bool,
+) -> FxHashSet<&'n str> {
+    stable_bindings(
+        program,
+        candidates.into_iter().map(|(name, _)| name),
+        false,
+        require_top_level,
+    )
+}
+
+/// The [`NameCount`] of each name, with the changes through aliases and
+/// through calls to local functions added as mutating calls.
+fn binding_counts<'n>(
+    program: &Program<'_>,
+    names: impl IntoIterator<Item = &'n str>,
+    require_top_level: bool,
+) -> FxHashMap<&'n str, NameCount> {
     let mut usage = NameUsage::new(
         names
             .into_iter()
             .filter(|name| !require_top_level || declares_top_level_const_or_let(program, name)),
     );
     if usage.counts.is_empty() {
-        return FxHashSet::default();
+        return FxHashMap::default();
     }
     usage.visit_program(program);
-    for name in changed_alias_names(program) {
-        usage.count_mutation(&name);
+    for name in changed_names(program).iter() {
+        usage.count_mutation(name);
     }
-    usage
-        .counts
-        .into_iter()
-        .filter(|(_, count)| {
-            count.bindings == 1
-                && count.writes == 0
-                && (allow_mutating_calls || count.mutating_calls == 0)
-        })
-        .map(|(name, _)| name)
-        .collect()
+    usage.counts
+}
+
+/// The identity of one parsed program: its address, its source text and its
+/// number of statements.
+type ProgramKey = (usize, usize, usize, usize);
+
+thread_local! {
+    /// The changed names of the last program that [`changed_names`] read.
+    /// [`with_inlined_program`] clears it each time the program changes.
+    static CHANGED_NAMES: RefCell<Option<(ProgramKey, Rc<FxHashSet<String>>)>> =
+        const { RefCell::new(None) };
+}
+
+fn program_key(program: &Program<'_>) -> ProgramKey {
+    (
+        std::ptr::from_ref(program) as usize,
+        program.source_text.as_ptr() as usize,
+        program.source_text.len(),
+        program.body.len(),
+    )
+}
+
+/// The names that the program changes through an alias or a local call,
+/// computed once for each state of the program. A config parse asks for each
+/// stable binding, so one analysis serves all of them.
+fn changed_names(program: &Program<'_>) -> Rc<FxHashSet<String>> {
+    let key = program_key(program);
+    if let Some(names) = CHANGED_NAMES.with_borrow(|cached| {
+        cached
+            .as_ref()
+            .filter(|(cached_key, _)| *cached_key == key)
+            .map(|(_, names)| Rc::clone(names))
+    }) {
+        return names;
+    }
+    let names = Rc::new(value_changes::changed_names(program));
+    CHANGED_NAMES.set(Some((key, Rc::clone(&names))));
+    names
+}
+
+/// Run both inline passes on `program`, then `read` it. The cache of
+/// [`changed_names`] is cleared before and after each step, because each
+/// inline pass changes the program.
+pub(super) fn with_inlined_program<'a, R>(
+    allocator: &'a Allocator,
+    program: &mut Program<'a>,
+    source_len: usize,
+    read: impl FnOnce(&Program<'a>) -> R,
+) -> R {
+    CHANGED_NAMES.set(None);
+    inline_value_constants(allocator, program, source_len);
+    CHANGED_NAMES.set(None);
+    super::local_inline::inline_c
```

**File**: `crates/core/src/plugins/config_parser_local_inline.rs` (modified, +386/-61)
```diff
@@ -15,10 +15,13 @@
 use oxc_allocator::{Allocator, CloneIn};
 #[allow(clippy::wildcard_imports, reason = "many AST types used")]
 use oxc_ast::ast::*;
-use rustc_hash::FxHashMap;
+use rustc_hash::{FxHashMap, FxHashSet};
 
-use super::const_inline::{Inliner, constant_values, literal_value, stable_bindings};
-use super::{MAX_CONFIG_BRANCH_DEPTH, MAX_CONFIG_WRAPPER_DEPTH, is_module_exports_target};
+use super::const_inline::{Inliner, constant_values, literal_value, stable_values};
+use super::{
+    MAX_CONFIG_BRANCH_DEPTH, MAX_CONFIG_WRAPPER_DEPTH, extract_object_from_expression,
+    is_module_exports_target,
+};
 
 /// The budget of the local pass, as a multiple of the source size. A config
 /// that spreads one shared local into two configs copies that local twice.
@@ -29,40 +32,46 @@ const LOCAL_BUDGET_FACTOR: usize = 2;
 ///
 /// A local qualifies when a `const` or `let` statement at the callback body's
 /// own level declares it with an object, array or string literal, and it is
-/// the only binding of its name in the program, with no writes and no mutating
-/// calls. The stable top-level constants are available too. The copied AST
+/// the only binding of its name in the program, with no writes, no mutating
+/// calls and no call that can change it. The stable top-level constants are
+/// available too. The copied AST
 /// nodes stay at or below `LOCAL_BUDGET_FACTOR` times `source_len`.
 pub(super) fn inline_callback_locals<'a>(
     allocator: &'a Allocator,
     program: &mut Program<'a>,
     source_len: usize,
 ) {
-    let mut values = callback_locals(allocator, program);
-    if values.is_empty() {
+    let Some(mut values) = callback_locals(allocator, program) else {
         return;
-    }
+    };
     for (name, value) in constant_values(allocator, program) {
         values.entry(name).or_insert(value);
     }
+    if values.is_empty() {
+        return;
+    }
     let mut inliner = Inliner::new(
         allocator,
         &values,
         source_len.saturating_mul(LOCAL_BUDGET_FACTOR),
     );
     for callback in config_callbacks(program) {
-        for value in callback.returned_values() {
-            inliner.inline_value(value);
-        }
+        callback.inline_returns(&mut inliner, &values);
     }
 }
 
 /// A copy of the literal value of each stable local of the config callbacks.
+/// Returns `None` when the program exports no config callback.
 fn callback_locals<'a>(
     allocator: &'a Allocator,
     program: &mut Program<'a>,
-) -> FxHashMap<String, Expression<'a>> {
+) -> Option<FxHashMap<String, Expression<'a>>> {
+    let callbacks = config_callbacks(program);
+    if callbacks.is_empty() {
+        return None;
+    }
     let mut candidates: Vec<(String, Expression<'a>)> = Vec::new();
-    for callback in config_callbacks(program) {
+    for callback in callbacks {
         let Callback::Body(body) = callback else {
             continue;
         };
@@ -87,19 +96,24 @@ fn callback_locals<'a>(
         }
     }
     if candidates.is_empty() {
-        return FxHashMap::default();
+        return Some(FxHashMap::default());
     }
-    let stable = stable_bindings(
+    let stable: FxHashSet<String> = stable_values(
         program,
-        candidates.iter().map(|(name, _)| name.as_str()),
+        candidates
+            .iter()
+            .map(|(name, value)| (name.as_str(), value)),
         false,
-        false,
-    );
-    let stable: Vec<String> = stable.into_iter().map(str::to_string).collect();
-    candidates
-        .into_iter()
-        .filter(|(name, _)| stable.contains(name))
-        .collect()
+    )
+    .into_iter()
+    .map(str::to_string)
+    .collect();
+    Some(
+        candidates
+            .into_iter()
+            .filter(|(name, _)| stable.contains(name))
+            .collect(),
+    )
 }
 
 /// The body of a config callback: a function body, or the expression body of
@@ -109,52 +123,72 @@ enum Callback<'p, 'a> {
     Expression(&'p mut Expression<'a>),
 }
 
-impl<'p, 'a> Callback<'p, 'a> {
-    /// The values that `find_config_object` can read as the returned config:
-    /// the expression body of an arrow, or the argument of each `return` at the
-    /// body's own level or in the bounded branch search. Returns of nested
-    /// functions belong to those functions and stay out.
+impl<'a> Callback<'_, 'a> {
+    /// Inline the values that `find_config_object` and the multi-config reader
+    /// can read as the returned config: the expression body of an arrow, or the
+    /// argument of each `return` at the body's own level or in the bounded
+    /// branch search. Returns of nested functions belong to those functions and
+    /// stay out.
     ///
     /// `find_config_object` prefers an object that a top-level `return` gives
     /// over a branch return. A top-level `return base;` gave no object before
-    /// this pass, so the search used the first branch return. To keep that
-    /// result, a returned identifier at t
```

**File**: `crates/core/src/plugins/config_parser_multi_config.rs` (modified, +25/-12)
```diff
@@ -20,7 +20,9 @@ use super::{
 };
 
 /// The maximum number of configs read from one exported array, in source order.
-const MAX_MULTI_CONFIGS: usize = 16;
+/// A build can export one config per locale or per target. The work for each
+/// config is linear in its size, and the inline budget bounds the copies.
+const MAX_MULTI_CONFIGS: usize = 64;
 
 /// The config objects of a program: the one object that `find_config_object`
 /// finds, or else each object element of an exported config array. Elements
@@ -29,16 +31,23 @@ pub fn find_config_objects<'a>(program: &'a Program<'a>) -> Vec<&'a ObjectExpres
     if let Some(object) = find_config_object(program) {
         return vec![object];
     }
-    find_default_export_array(program)
-        .map(|array| {
-            array
-                .elements
-                .iter()
-                .filter_map(|element| element.as_expression().and_then(object_expression))
-                .take(MAX_MULTI_CONFIGS)
-                .collect()
-        })
-        .unwrap_or_default()
+    let Some(array) = find_default_export_array(program) else {
+        return Vec::new();
+    };
+    let mut objects: Vec<_> = array
+        .elements
+        .iter()
+        .filter_map(|element| element.as_expression().and_then(object_expression))
+        .collect();
+    if objects.len() > MAX_MULTI_CONFIGS {
+        tracing::debug!(
+            configs = objects.len(),
+            read = MAX_MULTI_CONFIGS,
+            "config array is longer than the limit, later configs are not read"
+        );
+        objects.truncate(MAX_MULTI_CONFIGS);
+    }
+    objects
 }
 
 /// Run `read` on each config object of the source and collect the results in
@@ -261,8 +270,12 @@ mod tests {
 
     #[test]
     fn exported_array_count_is_bounded() {
+        // A build that emits one config per locale or per target can export
+        // more than 16 configs.
         let elements = vec!["{ entry: 'a' }"; 40].join(", ");
-        assert_eq!(count(&format!("module.exports = [{elements}];")), 16);
+        assert_eq!(count(&format!("module.exports = [{elements}];")), 40);
+        let elements = vec!["{ entry: 'a' }"; 100].join(", ");
+        assert_eq!(count(&format!("module.exports = [{elements}];")), 64);
     }
 
     #[test]
```

**File**: `crates/core/src/plugins/config_parser_value_changes.rs` (added, +859/-0)
```diff
@@ -0,0 +1,859 @@
+//! Find the names whose value the program changes through another name.
+//!
+//! A config can change a value through an alias: `const r = common.resolve;
+//! r.alias.a = x` changes `common`, and `const config = { entry };
+//! config.entry.admin = x` changes `entry`. This module follows each change
+//! along a key path, so `config.devtool = x` or `config.plugins.push(x)` does
+//! not change `entry`.
+//!
+//! Only a change that the file shows counts: a write, a known mutating call
+//! such as `push` or `Object.assign`, and a call to a function of the same
+//! file whose body changes its parameter. A call to an imported or unknown
+//! function does not count. A missed change can only hide an unused file, but
+//! a change that is not real reports a used file as unused.
+
+#[allow(clippy::wildcard_imports, reason = "many AST types used")]
+use oxc_ast::ast::*;
+use oxc_ast_visit::{Visit, walk};
+use oxc_syntax::scope::ScopeFlags;
+use rustc_hash::{FxHashMap, FxHashSet};
+
+use super::mutated_target;
+
+/// The keys of a member chain after its root name, in source order. `None`
+/// stands for a computed key, which can be any key.
+type Chain = Vec<Option<String>>;
+
+/// The maximum number of steps that one analysis takes: each change that it
+/// records and each alias that it follows counts as one step.
+const MAX_STEPS: usize = 200_000;
+
+/// The maximum number of aliases that one analysis collects.
+const MAX_EDGES: usize = 20_000;
+
+/// A change of the value that a name holds.
+type NamedChange = (String, Change);
+
+/// One change of a value, with the key chain under the changed name.
+#[derive(Clone, PartialEq, Eq, Hash)]
+enum Change {
+    /// A write to a member, such as `x.a.b = 1` (chain `[a, b]`).
+    Write(Chain),
+    /// A mutating call on the value at the chain, such as `x.a.push(1)`.
+    Mutation(Chain),
+}
+
+impl Change {
+    /// The same change with the first `keep` keys of its chain.
+    fn cut(self, keep: usize) -> Self {
+        match self {
+            Change::Write(mut chain) => {
+                chain.truncate(keep);
+                Change::Write(chain)
+            }
+            Change::Mutation(mut chain) => {
+                chain.truncate(keep);
+                Change::Mutation(chain)
+            }
+        }
+    }
+}
+
+/// One step of the way that an object or array literal holds a value.
+#[derive(Clone)]
+enum Hold {
+    /// A property with a static key, as `entry` in `{ entry }`.
+    Key(String),
+    /// An array element or a computed key, which can be any key.
+    Any,
+    /// A spread, as in `{ ...common }`. The copy has the same keys, but a
+    /// write to a key of the copy does not change the spread value. The list
+    /// holds the static keys that the same literal sets after the spread, as
+    /// `plugins` in `{ ...common, plugins: [] }`: the copy does not share the
+    /// value of such a key with the spread value.
+    Spread(Vec<String>),
+}
+
+/// A name that holds the value of `root`, or a part of it. A change of `name`
+/// with chain `c` is a change of the value at `prefix ++ c`. That value holds
+/// the root value under `holds`, and `part` is the member chain from the root
+/// value, as `[plugins]` in `const p = config.plugins`.
+struct Edge {
+    name: String,
+    root: String,
+    prefix: Chain,
+    holds: Vec<Hold>,
+    part: Chain,
+}
+
+impl Edge {
+    /// The change of `root` that a change of `name` makes, if any. The
+    /// result keeps the first `keep` keys of its chain.
+    fn translate(&self, change: &Change, keep: usize) -> Option<Change> {
+        let (chain, is_write) = match change {
+            Change::Write(chain) => (chain, true),
+            Change::Mutation(chain) => (chain, false),
+        };
+        let full: Chain = self.prefix.iter().chain(chain).cloned().collect();
+        let mut index = 0;
+        let mut shallow = 0;
+        for hold in &self.holds {
+            match hold {
+                Hold::Key(key) => {
+                    let found = full.get(index)?;
+                    if found.as_ref().is_some_and(|found| found != key) {
+                        return None;
+                    }
+                    index += 1;
+                }
+                Hold::Any => {
+                    full.get(index)?;
+                    index += 1;
+                }
+                Hold::Spread(overridden) => {
+                    let first = full.get(index)?;
+                    if first
+                        .as_ref()
+                        .is_some_and(|key| overridden.iter().any(|own| own == key))
+                    {
+                        return None;
+                    }
+                    shallow = 1;
+                }
+            }
+        }
+        let rest = &full[index..];
+        let needed = if is_write { 1 + shallow } else { shallow };
+        if rest.len() < needed {
+            return None;
+        }
+        let chain: C
```

**File**: `crates/core/src/plugins/webpack.rs` (modified, +503/-11)
```diff
@@ -278,9 +278,14 @@ pub(super) struct ConfigFile<'a> {
 /// Webpack and rspack name the base directory `context`, and rsbuild names it
 /// `root`. A relative entry resolves against it, not against the config file.
 /// In a multi-config export, each config resolves its entries against its own
-/// base directory. Returns the project-relative base directory of the first
-/// config, so the Module Federation reader can resolve `exposes` targets the
-/// same way.
+/// base directory.
+///
+/// Returns the project-relative base directory that all configs share, so the
+/// Module Federation reader can resolve `exposes` targets the same way. The
+/// Federation reader reads the plugin calls of the whole file and does not
+/// know which config holds a call. When the configs declare different base
+/// directories, this returns `None`, and the reader resolves `exposes`
+/// against the config directory.
 pub(super) fn apply_entries(
     result: &mut PluginResult,
     source: &str,
@@ -289,11 +294,9 @@ pub(super) fn apply_entries(
     base_key: &str,
 ) -> Option<PathBuf> {
     let ConfigFile { path, root } = config;
-    let mut first_base = None;
-    for (index, (entries, raw_base)) in
+    let mut bases = Vec::new();
+    for (entries, raw_base) in
         config_parser::extract_each_config_entries(source, path, entry_key, base_key)
-            .into_iter()
-            .enumerate()
     {
         let base = raw_base
             .and_then(|raw| config_parser::normalize_filesystem_config_path_buf(&raw, path, root));
@@ -302,11 +305,19 @@ pub(super) fn apply_entries(
                 .map(|base| normalize_context_entry(&entry, base, path, root))
                 .unwrap_or(entry)
         });
-        if index == 0 {
-            first_base = base;
-        }
+        bases.push(base);
     }
-    first_base
+    shared_base(bases)
+}
+
+/// The one base directory of all configs, or `None` when the configs declare
+/// different base directories.
+fn shared_base(bases: Vec<Option<PathBuf>>) -> Option<PathBuf> {
+    let mut bases = bases.into_iter();
+    let first = bases.next()??;
+    bases
+        .all(|base| base.as_ref() == Some(&first))
+        .then_some(first)
 }
 
 /// The project-relative package directory of a config that sits in a config
@@ -966,6 +977,487 @@ mod tests {
         assert_eq!(result.entry_patterns, vec!["app/src/B.tsx"]);
     }
 
+    /// A config whose inlined values nest much deeper than the source does.
+    /// Two top-level constants name each other at the leaf, so the first pass
+    /// stacks their copies. Two callback locals do the same and also name the
+    /// constants, so the second pass stacks copies of values that already
+    /// hold copies of the first pass.
+    fn deep_inline_source(open: &str, close: &str, depth: usize) -> String {
+        let deep = |leaf: &str| format!("{}{leaf}{}", open.repeat(depth), close.repeat(depth));
+        format!(
+            "const A = {a};\nconst B = {b};\nmodule.exports = () => {{\n\
+             const l1 = {l1};\nconst l2 = {l2};\n\
+             return {{ entry: \"./src/a.ts\", resolve: {{ alias: l1 }}, plugins: [l1, l2],\n\
+             externals: l2, module: {{ rules: [l1] }}, other: [l1, l2, A, B] }};\n}};\n",
+            a = deep("B"),
+            b = deep("A"),
+            l1 = deep("[l2, A]"),
+            l2 = deep("[l1, B]"),
+        )
+    }
+
+    /// The shape of [`deep_inline_source`] with one constant and one local
+    /// that each name themselves, which gives the deepest AST per source byte.
+    fn self_inline_source(open: &str, close: &str, depth: usize) -> String {
+        let deep = |leaf: &str| format!("{}{leaf}{}", open.repeat(depth), close.repeat(depth));
+        format!(
+            "const A = {a};\nmodule.exports = () => {{\nconst l = {l};\n\
+             return {{ entry: \"./src/a.ts\", resolve: {{ alias: l }}, plugins: [l],\n\
+             externals: l, module: {{ rules: [l] }}, other: [l, A] }};\n}};\n",
+            a = deep("A"),
+            l = deep("[l, A]"),
+        )
+    }
+
+    #[test]
+    fn deep_inlined_values_stay_within_the_parse_stack() {
+        // Each parse runs on a stack that `parse_bounded` sizes from the source
+        // length and the source bracket depth. The inline passes can make the
+        // AST deeper than the source. This test fails with a stack overflow
+        // when the walks over the inlined AST need more stack than that.
+        // A probe measured about 1.1 AST levels per source byte for the
+        // self-naming array shape, against about 0.12 levels per byte for the
+        // source alone.
+        for (open, close) in [("[", "]"), ("{a:", "}"), ("{a:[", "]}")] {
+            for source in [
+                deep_inline_source(open, close, 480),
+                self_inline_source(open, close, 480),
+            ] {
+                let result = WebpackPlugin.resolve_config(
+                    std::path::Path::new("/proje
```

---

### Incident Patch 2: `24a3e24b` (2026-10-28)
**Commit Message**: fix(config): read configs that a function builds from local bindings (#3981)

* fix(config): read configs that a function builds from local bindings

Fallow did not read a config whose exported function builds its value from
local bindings, such as a webpack config that returns
`[{ ...common, entry }, { ...common, entry }]`. The entries and the alias
targets of such a config were reported as unused files.

- A config function now resolves its body-level `const` and `let` bindings
  with literal values in the value that it returns. This includes a returned
  identifier, array elements, property values and object spreads such as
  `...common` and `...common.resolve`. The last value of a key wins.
- A spread of a stable top-level constant now resolves too, for every plugin
  that reads a JavaScript or TypeScript config.
- Webpack and rspack read each config of an exported array, also when a
  function returns the array. Each config resolves its entries against its
  own context. Webpack also collects the aliases of each config.
- A binding that the program can change is not read: a write, a mutating
  method, a call such as Object.assign or Reflect.set, or a write or a
  mutating call

**File**: `changelog.d/fix-webpack-function-config-local-aliases.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+### Fixed
+
+- **`fallow dead-code` now reads a config that a function builds from local bindings.** Before, fallow reported the entries and alias targets of such a config as unused files. An example is a webpack config that exports `(env, argv) => { const common = {...}; const web = { ...common, entry: {...} }; return [bg, web]; }`. Fallow does not run the config code. The changes are:
+  - Fallow reads a local `const` or `let` binding with a literal value in the returned value of a config function. This applies to a returned identifier, an array element, a property value and an object spread such as `...common` or `...common.resolve`. When a spread and a key set the same property, the last value wins.
+  - Fallow also reads a spread of a stable top-level constant, such as `export default { ...base, test }`. These two changes apply to all plugins that read a JavaScript or TypeScript config, for example Vite, Vitest, Playwright and Electron.
+  - For webpack and rspack, fallow reads each config of an exported array, also when a function returns the array. Each config resolves its entries against its own `context`. Fallow collects the loaders, the `plugins` requires and the `externals` of all configs. For webpack, fallow also collects the aliases of all configs.
+  - Fallow does not read a binding that the config can change. This includes a write, a method such as `push`, a call such as `Object.assign`, and a change through an alias such as `const { resolve } = common`. Fallow also does not read a `var` binding, a destructured binding or the result of a call.
```

**File**: `crates/core/src/plugins/config_parser.rs` (modified, +13/-79)
```diff
@@ -13,6 +13,15 @@ use rustc_hash::FxHashSet;
 #[path = "config_parser_const_inline.rs"]
 mod const_inline;
 use const_inline::holds_one_stable_object;
+#[path = "config_parser_local_inline.rs"]
+mod local_inline;
+#[path = "config_parser_multi_config.rs"]
+mod multi_config;
+use multi_config::find_default_export_array;
+pub(crate) use multi_config::{
+    extract_each_config_entries, extract_each_config_path_aliases,
+    extract_each_config_require_strings, extract_each_config_shallow_strings, find_config_objects,
+};
 #[path = "config_parser_vite_plugin_call.rs"]
 mod vite_plugin_call;
 pub(crate) use vite_plugin_call::extract_vite_plugin_call_option_path;
@@ -1174,6 +1183,9 @@ pub(crate) fn parent_relative_config_path(
 /// Before the extraction, a JavaScript or TypeScript program gets the literal
 /// value of each stable same-file constant in the property values and array
 /// elements that name it, so `projects: [UNIT]` reads like an inline object.
+/// An object spread of such a constant gets its properties. The values that an
+/// exported config callback returns also get the literal value of the stable
+/// locals of that callback, so `return { ...common, entry }` reads the same way.
 pub(crate) fn extract_from_source<T: Send>(
     source: &str,
     path: &Path,
@@ -1193,6 +1205,7 @@ pub(crate) fn extract_from_source<T: Send>(
         let allocator = oxc_allocator::Allocator::default();
         let mut parsed = oxc_parser::Parser::new(&allocator, source, source_type).parse();
         const_inline::inline_value_constants(&allocator, &mut parsed.program, source.len());
+        local_inline::inline_callback_locals(&allocator, &mut parsed.program, source.len());
         extractor(&parsed.program)
     })
     .flatten()
@@ -2597,85 +2610,6 @@ pub(crate) fn resolve_sibling_module(
     None
 }
 
-/// Find a default-exported array config, the `defineWorkspace([...])` /
-/// `vitest.workspace.{ts,js}` shape. Handles `export default [...]` and
-/// `export default defineWorkspace([...])` / `defineConfig([...])` (the array as
-/// the call's first argument), function configs with a static array return, and
-/// parenthesised / `as` wrappers.
-fn find_default_export_array<'a>(program: &'a Program<'a>) -> Option<&'a ArrayExpression<'a>> {
-    for stmt in &program.body {
-        if let Statement::ExportDefaultDeclaration(decl) = stmt {
-            if let ExportDefaultDeclarationKind::FunctionDeclaration(function) = &decl.declaration {
-                if function.generator {
-                    return None;
-                }
-                return function.body.as_ref().and_then(|body| returned_array(body));
-            }
-            return decl
-                .declaration
-                .as_expression()
-                .and_then(array_from_config_expression);
-        }
-    }
-    None
-}
-
-/// Read only returns belonging to this callback, never nested helper functions.
-fn returned_array<'a>(body: &'a FunctionBody<'a>) -> Option<&'a ArrayExpression<'a>> {
-    body.statements
-        .iter()
-        .find_map(|statement| match statement {
-            Statement::ReturnStatement(returned) => Some(returned),
-            _ => None,
-        })
-        .and_then(|returned| returned.argument.as_ref())
-        .and_then(array_from_expression)
-}
-
-/// A config provider invokes its callback once; returned callbacks are values.
-fn array_from_config_expression<'a>(expr: &'a Expression<'a>) -> Option<&'a ArrayExpression<'a>> {
-    match expr {
-        Expression::ArrowFunctionExpression(arrow) => match &arrow.body {
-            ArrowFunctionBody::FunctionBody(body) => returned_array(body),
-            body => body.as_expression().and_then(array_from_expression),
-        },
-        Expression::FunctionExpression(function) => {
-            if function.generator {
-                return None;
-            }
-            function.body.as_ref().and_then(|body| returned_array(body))
-        }
-        Expression::ParenthesizedExpression(paren) => {
-            array_from_config_expression(&paren.expression)
-        }
-        Expression::TSAsExpression(ts_as) => array_from_config_expression(&ts_as.expression),
-        Expression::TSSatisfiesExpression(ts_sat) => {
-            array_from_config_expression(&ts_sat.expression)
-        }
-        Expression::CallExpression(call) => call
-            .arguments
-            .first()
-            .and_then(Argument::as_expression)
-            .and_then(array_from_config_expression),
-        _ => array_from_expression(expr),
-    }
-}
-
-fn array_from_expression<'a>(expr: &'a Expression<'a>) -> Option<&'a ArrayExpression<'a>> {
-    match expr {
-        Expression::ArrayExpression(arr) => Some(arr),
-        Expression::ParenthesizedExpression(paren) => array_from_expression(&paren.expression),
-        Expression::TSAsExpression(ts_as) => array_from_expression(&ts_as.expression),
-        Expression::TSSatisfiesExpression(ts_sat) => 
```

**File**: `crates/core/src/plugins/config_parser_const_inline.rs` (modified, +507/-36)
```diff
@@ -11,23 +11,24 @@ use oxc_allocator::{Allocator, CloneIn};
 #[allow(clippy::wildcard_imports, reason = "many AST types used")]
 use oxc_ast::ast::*;
 use oxc_ast_visit::{Visit, VisitMut, walk, walk_mut};
-use oxc_span::GetSpan;
 use rustc_hash::{FxHashMap, FxHashSet};
 
 use super::top_level_variable_declarations;
 
 /// The maximum number of constants that one inlined value can pass through,
 /// as in `const A = {...}; const B = [A]; export default { x: B }`.
-const MAX_INLINE_NESTING: usize = 4;
+pub(super) const MAX_INLINE_NESTING: usize = 4;
 
 /// Replace each identifier in a property value or an array element that names
-/// a stable top-level constant with a literal value.
+/// a stable top-level constant with a literal value, and replace each object
+/// spread of such a constant with the properties of the constant.
 ///
 /// A constant qualifies when one top-level `const` or `let` is the only
 /// binding of its name, no expression writes to it, and its value is an
 /// object, array or string literal.
-/// The copied source bytes stay at or below `source_len`, so the AST grows at
-/// most to two times the size of the parsed source.
+/// The copied AST nodes stay at or below `source_len`, and each node of the
+/// parsed source spans at least one byte, so the AST grows at most to two
+/// times its parsed size.
 pub(super) fn inline_value_constants<'a>(
     allocator: &'a Allocator,
     program: &mut Program<'a>,
@@ -37,17 +38,11 @@ pub(super) fn inline_value_constants<'a>(
     if values.is_empty() {
         return;
     }
-    let mut inliner = Inliner {
-        allocator,
-        values: &values,
-        nesting: 0,
-        budget: source_len,
-    };
-    inliner.visit_program(program);
+    Inliner::new(allocator, &values, source_len).visit_program(program);
 }
 
 /// A copy of the literal value of each stable top-level constant, by name.
-fn constant_values<'a>(
+pub(super) fn constant_values<'a>(
     allocator: &'a Allocator,
     program: &Program<'a>,
 ) -> FxHashMap<String, Expression<'a>> {
@@ -64,7 +59,12 @@ fn constant_values<'a>(
     if candidates.is_empty() {
         return FxHashMap::default();
     }
-    let stable = stable_bindings(program, candidates.iter().map(|(name, _)| *name), false);
+    let stable = stable_bindings(
+        program,
+        candidates.iter().map(|(name, _)| *name),
+        false,
+        true,
+    );
     candidates
         .into_iter()
         .filter(|(name, _)| stable.contains(name))
@@ -78,7 +78,7 @@ fn constant_values<'a>(
 /// The value can hold functions and writes. A copy of one adds a binding or a
 /// write only for a name that the source already binds or writes inside it, so
 /// a later stable-binding check of the same program gives the same answer.
-fn literal_value<'e, 'a>(init: &'e Expression<'a>) -> Option<&'e Expression<'a>> {
+pub(super) fn literal_value<'e, 'a>(init: &'e Expression<'a>) -> Option<&'e Expression<'a>> {
     match init {
         Expression::ParenthesizedExpression(paren) => literal_value(&paren.expression),
         Expression::TSAsExpression(ts_as) => literal_value(&ts_as.expression),
@@ -91,14 +91,74 @@ fn literal_value<'e, 'a>(init: &'e Expression<'a>) -> Option<&'e Expression<'a>>
     }
 }
 
-struct Inliner<'a, 'v> {
+/// Copies literal values into the positions that name them. Each copy charges
+/// its number of AST nodes to `budget`, and a copy inside a copy adds one to
+/// `nesting`. A value can hold copies from an earlier pass, so its source span
+/// can be much smaller than the copy.
+pub(super) struct Inliner<'a, 'v> {
     allocator: &'a Allocator,
     values: &'v FxHashMap<String, Expression<'a>>,
     nesting: usize,
     budget: usize,
+    /// The node count of each value or object that was copied, by address.
+    /// The values do not change during a pass, so each count is computed once.
+    node_counts: FxHashMap<usize, usize>,
 }
 
-impl<'a> Inliner<'a, '_> {
+impl<'a, 'v> Inliner<'a, 'v> {
+    pub(super) fn new(
+        allocator: &'a Allocator,
+        values: &'v FxHashMap<String, Expression<'a>>,
+        budget: usize,
+    ) -> Self {
+        Self {
+            allocator,
+            values,
+            nesting: 0,
+            budget,
+            node_counts: FxHashMap::default(),
+        }
+    }
+
+    /// Charge the node count of a value to the budget. Returns `None` when
+    /// the budget is too small.
+    fn charge_value(&mut self, value: &Expression<'a>) -> Option<()> {
+        let key = std::ptr::from_ref(value) as usize;
+        let count = *self.node_counts.entry(key).or_insert_with(|| {
+            let mut counter = NodeCounter::default();
+            counter.visit_expression(value);
+            counter.count
+        });
+        self.budget = self.budget.checked_sub(count)?;
+        Some(())
+    }
+
+    /// Charge the node count of an object literal to the budget. Returns
+    /// `None` when the budget is too small.
+    fn charge_objec
```

**File**: `crates/core/src/plugins/config_parser_local_inline.rs` (added, +567/-0)
```diff
@@ -0,0 +1,567 @@
+//! Put the value of a local binding of a config callback in the values that
+//! the callback returns.
+//!
+//! A config file can export a function that builds its value in local
+//! bindings: `const common = {...}; const web = { ...common, entry }; return
+//! [web];`. The config walkers read literal objects only. This pass replaces
+//! each returned identifier, each array element and property value that names
+//! a local, and each object spread of a local with a copy of the literal value
+//! of that local. It never runs the code of the config.
+//!
+//! The pass ignores the order of the statements. A returned value that names a
+//! local declared after the `return` fails at run time, but this pass reads the
+//! value of the local.
+
+use oxc_allocator::{Allocator, CloneIn};
+#[allow(clippy::wildcard_imports, reason = "many AST types used")]
+use oxc_ast::ast::*;
+use rustc_hash::FxHashMap;
+
+use super::const_inline::{Inliner, constant_values, literal_value, stable_bindings};
+use super::{MAX_CONFIG_BRANCH_DEPTH, MAX_CONFIG_WRAPPER_DEPTH, is_module_exports_target};
+
+/// The budget of the local pass, as a multiple of the source size. A config
+/// that spreads one shared local into two configs copies that local twice.
+const LOCAL_BUDGET_FACTOR: usize = 2;
+
+/// Inline the stable locals of each exported config callback into the values
+/// that the callback returns.
+///
+/// A local qualifies when a `const` or `let` statement at the callback body's
+/// own level declares it with an object, array or string literal, and it is
+/// the only binding of its name in the program, with no writes and no mutating
+/// calls. The stable top-level constants are available too. The copied AST
+/// nodes stay at or below `LOCAL_BUDGET_FACTOR` times `source_len`.
+pub(super) fn inline_callback_locals<'a>(
+    allocator: &'a Allocator,
+    program: &mut Program<'a>,
+    source_len: usize,
+) {
+    let mut values = callback_locals(allocator, program);
+    if values.is_empty() {
+        return;
+    }
+    for (name, value) in constant_values(allocator, program) {
+        values.entry(name).or_insert(value);
+    }
+    let mut inliner = Inliner::new(
+        allocator,
+        &values,
+        source_len.saturating_mul(LOCAL_BUDGET_FACTOR),
+    );
+    for callback in config_callbacks(program) {
+        for value in callback.returned_values() {
+            inliner.inline_value(value);
+        }
+    }
+}
+
+/// A copy of the literal value of each stable local of the config callbacks.
+fn callback_locals<'a>(
+    allocator: &'a Allocator,
+    program: &mut Program<'a>,
+) -> FxHashMap<String, Expression<'a>> {
+    let mut candidates: Vec<(String, Expression<'a>)> = Vec::new();
+    for callback in config_callbacks(program) {
+        let Callback::Body(body) = callback else {
+            continue;
+        };
+        for statement in &body.statements {
+            let Statement::VariableDeclaration(decl) = statement else {
+                continue;
+            };
+            if !matches!(
+                decl.kind,
+                VariableDeclarationKind::Const | VariableDeclarationKind::Let
+            ) {
+                continue;
+            }
+            for declarator in &decl.declarations {
+                let BindingPattern::BindingIdentifier(id) = &declarator.id else {
+                    continue;
+                };
+                if let Some(value) = declarator.init.as_ref().and_then(literal_value) {
+                    candidates.push((id.name.to_string(), value.clone_in(allocator)));
+                }
+            }
+        }
+    }
+    if candidates.is_empty() {
+        return FxHashMap::default();
+    }
+    let stable = stable_bindings(
+        program,
+        candidates.iter().map(|(name, _)| name.as_str()),
+        false,
+        false,
+    );
+    let stable: Vec<String> = stable.into_iter().map(str::to_string).collect();
+    candidates
+        .into_iter()
+        .filter(|(name, _)| stable.contains(name))
+        .collect()
+}
+
+/// The body of a config callback: a function body, or the expression body of
+/// an arrow.
+enum Callback<'p, 'a> {
+    Body(&'p mut FunctionBody<'a>),
+    Expression(&'p mut Expression<'a>),
+}
+
+impl<'p, 'a> Callback<'p, 'a> {
+    /// The values that `find_config_object` can read as the returned config:
+    /// the expression body of an arrow, or the argument of each `return` at the
+    /// body's own level or in the bounded branch search. Returns of nested
+    /// functions belong to those functions and stay out.
+    ///
+    /// `find_config_object` prefers an object that a top-level `return` gives
+    /// over a branch return. A top-level `return base;` gave no object before
+    /// this pass, so the search used the first branch return. To keep that
+    /// result, a returned identifier at the top level stays when a branch
+    /// return exists.
+    fn returned_values(self) -> Ve
```

**File**: `crates/core/src/plugins/config_parser_multi_config.rs` (added, +275/-0)
```diff
@@ -0,0 +1,275 @@
+//! Read each config of a config file that exports more than one.
+//!
+//! Webpack and rspack build every config of an exported array, as in
+//! `module.exports = [configA, configB]` or a function that returns such an
+//! array. `find_config_object` keeps its contract and returns `None` for an
+//! array export, because other tools read an array export in their own way.
+//! The readers here are for the tools that build each element.
+
+use std::path::{Path, PathBuf};
+
+#[allow(clippy::wildcard_imports, reason = "many AST types used")]
+use oxc_ast::ast::*;
+use rustc_hash::FxHashSet;
+
+use super::{
+    PathScope, collect_require_sources, collect_shallow_string_values, expression_to_path,
+    extract_from_source, find_config_object, find_property, get_nested_expression,
+    get_nested_string_or_array, is_module_exports_target, object_expression,
+    path_from_config_string, resolve_alias_pairs_kinded,
+};
+
+/// The maximum number of configs read from one exported array, in source order.
+const MAX_MULTI_CONFIGS: usize = 16;
+
+/// The config objects of a program: the one object that `find_config_object`
+/// finds, or else each object element of an exported config array. Elements
+/// that are not object literals, such as `merge(a, b)` or a spread, are skipped.
+pub fn find_config_objects<'a>(program: &'a Program<'a>) -> Vec<&'a ObjectExpression<'a>> {
+    if let Some(object) = find_config_object(program) {
+        return vec![object];
+    }
+    find_default_export_array(program)
+        .map(|array| {
+            array
+                .elements
+                .iter()
+                .filter_map(|element| element.as_expression().and_then(object_expression))
+                .take(MAX_MULTI_CONFIGS)
+                .collect()
+        })
+        .unwrap_or_default()
+}
+
+/// Run `read` on each config object of the source and collect the results in
+/// source order.
+fn extract_each_config<T: Send>(
+    source: &str,
+    path: &Path,
+    read: impl Fn(&Program<'_>, &ObjectExpression<'_>) -> Vec<T> + Send + Sync,
+) -> Vec<T> {
+    extract_from_source(source, path, |program| {
+        Some(
+            find_config_objects(program)
+                .into_iter()
+                .flat_map(|object| read(program, object))
+                .collect(),
+        )
+    })
+    .unwrap_or_default()
+}
+
+/// The entries of each config, with the base directory path that the same
+/// config declares under `base_key`.
+pub fn extract_each_config_entries(
+    source: &str,
+    path: &Path,
+    entry_key: &[&str],
+    base_key: &str,
+) -> Vec<(Vec<String>, Option<PathBuf>)> {
+    extract_each_config(source, path, |program, object| {
+        let entries = get_nested_string_or_array(object, entry_key, PathScope::Program(program))
+            .unwrap_or_default();
+        let base = get_nested_expression(object, &[base_key]).and_then(expression_to_path);
+        vec![(entries, base)]
+    })
+}
+
+/// The path aliases of all configs, without duplicate pairs.
+pub fn extract_each_config_path_aliases(
+    source: &str,
+    path: &Path,
+    prop_path: &[&str],
+) -> Vec<(String, PathBuf)> {
+    let pairs = extract_each_config(source, path, |program, object| {
+        let Some(expr) = get_nested_expression(object, prop_path) else {
+            return Vec::new();
+        };
+        let mut visited = FxHashSet::default();
+        resolve_alias_pairs_kinded(program, path, expr, &mut visited, 0)
+    });
+    let mut seen = FxHashSet::default();
+    pairs
+        .into_iter()
+        .filter(|(find, replacement, _)| seen.insert((find.clone(), replacement.clone())))
+        .map(|(find, replacement, _)| (find, path_from_config_string(&replacement)))
+        .collect()
+}
+
+/// The `require('...')` sources in the `key` property of all configs.
+pub fn extract_each_config_require_strings(source: &str, path: &Path, key: &str) -> Vec<String> {
+    dedup(extract_each_config(source, path, |_, object| {
+        find_property(object, key)
+            .map(|prop| collect_require_sources(&prop.value))
+            .unwrap_or_default()
+    }))
+}
+
+/// The top-level string values of the `key` property of all configs.
+pub fn extract_each_config_shallow_strings(source: &str, path: &Path, key: &str) -> Vec<String> {
+    dedup(extract_each_config(source, path, |_, object| {
+        find_property(object, key)
+            .map(|prop| collect_shallow_string_values(&prop.value))
+            .unwrap_or_default()
+    }))
+}
+
+fn dedup(values: Vec<String>) -> Vec<String> {
+    let mut seen = FxHashSet::default();
+    values
+        .into_iter()
+        .filter(|value| seen.insert(value.clone()))
+        .collect()
+}
+
+/// Find an exported array config, the `defineWorkspace([...])` /
+/// `vitest.workspace.{ts,js}` shape and the webpack multi-config shape. Handles
+/// `export default [...]`, `module.exports = [...]` and
+/// `export default defineWorkspace([...])`
```

**File**: `crates/core/src/plugins/electron.rs` (modified, +15/-0)
```diff
@@ -574,6 +574,21 @@ mod tests {
         }
     }
 
+    #[test]
+    fn resolve_config_reads_sections_through_a_spread_of_a_local_constant() {
+        let source = r#"
+            const base = { main: { build: { lib: { entry: "src/main/app.ts" } } } };
+            const shared = { build: {} };
+            export default { ...base, preload: { ...shared } };
+        "#;
+        let result = ElectronPlugin.resolve_config(&config_path(), source, Path::new("/project"));
+        assert!(result.replace_entry_patterns);
+        assert_eq!(
+            entry_strings(&result),
+            vec!["src/main/app.ts".to_string(), PRELOAD_DEFAULT.to_string()]
+        );
+    }
+
     #[test]
     fn resolve_config_without_node_sections_keeps_static_entries() {
         let source = r#"export default { renderer: { build: { rollupOptions: { input: "src/renderer/index.html" } } } };"#;
```

**File**: `crates/core/src/plugins/playwright.rs` (modified, +10/-0)
```diff
@@ -1324,6 +1324,16 @@ mod tests {
                 "ui/live.pw.ts",
                 "outside/live.pw.ts",
             ),
+            (
+                "const shared = { testDir: './wrong', testMatch: '*.pw.ts' }; export default { ...shared, testDir: './ui' };",
+                "ui/live.pw.ts",
+                "wrong/live.pw.ts",
+            ),
+            (
+                "const shared = { testDir: './ui', testMatch: '*.pw.ts' }; export default { testDir: './wrong', ...shared };",
+                "ui/live.pw.ts",
+                "wrong/live.pw.ts",
+            ),
             (
                 "export default { testDir:'./ui', [key]:'./tests', testMatch:'*.pw.ts', projects:[{name:'chromium'}] };",
                 "tests/live.pw.ts",
```

**File**: `crates/core/src/plugins/rspack.rs` (modified, +24/-2)
```diff
@@ -55,15 +55,15 @@ define_plugin! {
         );
 
         let require_deps =
-            config_parser::extract_config_require_strings(source, config_path, "plugins");
+            config_parser::extract_each_config_require_strings(source, config_path, "plugins");
         for dep in &require_deps {
             result
                 .referenced_dependencies
                 .push(crate::resolve::extract_package_name(dep));
         }
 
         let externals =
-            config_parser::extract_config_shallow_strings(source, config_path, "externals");
+            config_parser::extract_each_config_shallow_strings(source, config_path, "externals");
         for ext in &externals {
             result
                 .referenced_dependencies
@@ -92,6 +92,28 @@ define_plugin! {
 mod tests {
     use super::*;
 
+    #[test]
+    fn resolve_config_reads_plugins_and_externals_of_each_config() {
+        let source = r#"
+            module.exports = [
+                { entry: "./src/a.js", externals: ["lodash"] },
+                { entry: "./src/b.js", plugins: [require("my-plugin")] },
+            ];
+        "#;
+        let result = RspackPlugin.resolve_config(
+            std::path::Path::new("/project/rspack.config.js"),
+            source,
+            std::path::Path::new("/project"),
+        );
+        assert_eq!(result.entry_patterns, vec!["src/a.js", "src/b.js"]);
+        for dep in ["lodash", "my-plugin"] {
+            assert!(
+                result.referenced_dependencies.contains(&dep.to_string()),
+                "{dep}"
+            );
+        }
+    }
+
     #[test]
     fn resolve_config_entry_string() {
         let source = r#"module.exports = { entry: "./src/app.tsx" };"#;
```

---

### Incident Patch 3: `a2d1a3e2` (2026-10-28)
**Commit Message**: fix(vitest): credit exports of a replacement file for a relative alias key (#3969)

* fix(vitest): credit exports of a replacement file for a relative alias key

A Vitest or Vite alias with a relative key, such as ./clock.js, swaps the original file for a stub. The resolver resolves the relative import to the original file and never applies the alias, so the stub had no consumer. With includeEntryExports, fallow reported the exports of the stub as unused.

The shared alias helper now credits every export of the replacement file when the alias key is a relative or absolute path. Aliases with a bare or a path-alias key keep the current behavior, because the resolver routes their imports to the replacement file.

Closes #3963

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* docs(changelog): limit the #3963 entry to Vitest

The top-level resolve.alias of a Vite config does not use the shared alias helper, so the credit does not apply there.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

---------

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

**File**: `changelog.d/fix-vitest-alias-replacement-exports-3963.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+### Fixed
+
+- **`fallow dead-code` no longer reports the exports of a Vitest alias replacement file that stands in for a relative import.** An entry such as `{ find: "./clock.js", replacement: "./test/stubs/clock.ts" }` swaps the original file for a stub. Fallow resolves the relative import to the original file, so the stub had no consumer. With `includeEntryExports`, fallow reported the exports of the stub as unused. Fallow now credits every export of a replacement file when the alias key is a relative or absolute path. Thanks @Smrtnyk for the report.
+  (Closes [#3963](https://github.com/fallow-rs/fallow/issues/3963))
```

**File**: `crates/core/src/plugins/test_alias.rs` (modified, +56/-0)
```diff
@@ -30,6 +30,13 @@ fn alias_target_is_source_file(normalized: &str) -> bool {
         .is_some_and(|ext| ALIAS_SOURCE_EXTENSIONS.contains(&ext))
 }
 
+/// True when an alias key is a relative or absolute file specifier, such as
+/// `./clock.js`. An import with such a specifier resolves to a file on disk, so
+/// the path-alias fallback of the resolver never routes it to the replacement.
+fn is_path_specifier(find: &str) -> bool {
+    find.starts_with("./") || find.starts_with("../") || find.starts_with('/')
+}
+
 /// Apply one alias entry to the plugin result.
 ///
 /// Path aliases feed `path_aliases`, source-file targets seed setup files, and
@@ -65,6 +72,13 @@ pub(super) fn process_test_alias(
         .path_aliases
         .push((find.to_owned(), normalized.clone()));
     if alias_target_is_source_file(&normalized) {
+        if is_path_specifier(find) {
+            // The resolver resolves a relative or absolute import to the
+            // original file and never applies the alias. The import of the
+            // original file is then the only consumer, so credit every export
+            // of the replacement file (issue #3963).
+            result.push_entry_export_credit(normalized.clone(), ["*"]);
+        }
         result.setup_files.push(root.join(&normalized));
     }
     if find_is_pkg {
@@ -148,6 +162,48 @@ mod tests {
         std::path::PathBuf::from("/project")
     }
 
+    #[test]
+    fn path_specifier_key_credits_every_replacement_export() {
+        for find in ["./clock.js", "../src/clock", "/abs/clock.js"] {
+            let mut result = PluginResult::default();
+            process_test_alias(
+                &mut result,
+                find,
+                "./test/stubs/clock.ts",
+                false,
+                &cfg(),
+                &root(),
+            );
+            assert_eq!(
+                result.entry_export_credits,
+                vec![crate::plugins::UsedExportRule::new(
+                    "test/stubs/clock.ts",
+                    ["*"]
+                )],
+                "key `{find}` must credit the replacement exports"
+            );
+        }
+    }
+
+    #[test]
+    fn bare_or_directory_alias_adds_no_entry_export_credit() {
+        let mut result = PluginResult::default();
+        process_test_alias(
+            &mut result,
+            "vscode",
+            "./mock/vscode.ts",
+            false,
+            &cfg(),
+            &root(),
+        );
+        process_test_alias(&mut result, "@", "src", false, &cfg(), &root());
+        assert!(
+            result.entry_export_credits.is_empty(),
+            "the resolver routes these imports through the alias: {:?}",
+            result.entry_export_credits
+        );
+    }
+
     #[test]
     fn package_to_package_credits_both_no_path_alias() {
         let mut result = PluginResult::default();
```

**File**: `crates/core/tests/integration_test/issue_601_vitest_test_alias.rs` (modified, +75/-0)
```diff
@@ -482,3 +482,78 @@ fn vitest_workspace_array_file_aliases_resolve() {
         "workspace-array alias-resolved module must not be unlisted, found: {unlisted:?}"
     );
 }
+
+/// Issue #3963: a `resolve.alias` entry swaps a relative import for a stub
+/// file. The resolver resolves `./clock.js` to the original file, so the stub
+/// has no graph consumer. With `includeEntryExports`, the exports of the stub
+/// must stay credited. Exports of the original file stay reportable.
+#[test]
+fn relative_alias_replacement_exports_are_used_with_include_entry_exports() {
+    let dir = tempfile::tempdir().expect("temp dir");
+    let root = dir.path();
+
+    write(
+        &root.join("package.json"),
+        r#"{
+            "name": "repro",
+            "private": true,
+            "type": "module",
+            "main": "src/index.ts",
+            "scripts": { "test": "vitest" },
+            "devDependencies": { "vitest": "4.0.0" }
+        }"#,
+    );
+    write(
+        &root.join("node_modules/vitest/package.json"),
+        r#"{ "name": "vitest", "version": "4.0.0", "bin": { "vitest": "vitest.mjs" } }"#,
+    );
+    write(
+        &root.join("vitest.config.ts"),
+        r#"
+            export default {
+                resolve: {
+                    alias: [{ find: "./clock.js", replacement: new URL("./test/stubs/clock.ts", import.meta.url).pathname }],
+                },
+            };
+        "#,
+    );
+    write(
+        &root.join("src/clock.ts"),
+        "export function now(): number { return Date.now(); }\nexport function unusedClock(): number { return 1; }\n",
+    );
+    write(
+        &root.join("src/index.ts"),
+        "import { now } from \"./clock.js\";\n\nexport function stamp(): number {\n    return now();\n}\n",
+    );
+    write(
+        &root.join("test/stubs/clock.ts"),
+        "export function now(): number { return 0; }\n",
+    );
+    write(
+        &root.join("test/index.spec.ts"),
+        "import { stamp } from \"../src/index.js\";\n\nif (stamp() !== 0) {\n    throw new Error(\"stamp\");\n}\n",
+    );
+
+    let mut config = create_config(root.to_path_buf());
+    config.include_entry_exports = true;
+    let results = fallow_core::analyze(&config).expect("analysis should succeed");
+
+    let unused: Vec<String> = results
+        .unused_exports
+        .iter()
+        .map(|e| {
+            let path = e.export.path.strip_prefix(root).unwrap_or(&e.export.path);
+            format!(
+                "{}:{}",
+                path.to_string_lossy().replace('\\', "/"),
+                e.export.export_name
+            )
+        })
+        .collect();
+
+    assert_eq!(
+        unused,
+        vec!["src/clock.ts:unusedClock".to_string()],
+        "only the unused export of the original file stays reportable"
+    );
+}
```

#### Recent Merged Pull Requests:
- **PR #3994** (2026-10-29): fix(mutation): instrument copied Node sources (@BartWaardenburg)
- **PR #3991** (2026-10-29): fix(coverage): share the served line starts cases with Fallow Cloud (@BartWaardenburg)
- **PR #3990** (2026-10-28): feat(coverage): record the line starts of each generated script at map upload (@BartWaardenburg)
- **PR #3989** (2026-10-28): fix(scripts): fail when a curated Key Flags cell misses a new seed flag (@BartWaardenburg)
- **PR #3988** (2026-10-28): docs(skills): list --max-file-lines in the health flags (@BartWaardenburg)
- **PR #3987** (2026-10-28): fix(config): correct the review findings of the config local inlining (@BartWaardenburg)

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

## X. config): correct local-binding config reads after the multi-config change (#3987

**RULE**:
When implementing operations in `changelog.d/fix-webpack-function-config-local-aliases.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fallow-rs/fallow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `255f50fe`: config): correct local-binding config reads after the multi-config change (#3987). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/fix-webpack-function-config-local-aliases.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  - Fallow reads a local `const` or `let` binding with a literal value in the returned value of a config function. This applies to a returned identifier, an array element, a property value and an object spread such as `...common` or `...common.resolve`. When a spread and a key set the same property, the last value wins. This also applies to a function that the file exports through a binding, such as `const config = (env) => {...}; module.exports = config;`.
  - Fallow also reads a spread of a stable top-level constant, such as `export default { ...base, test }`, and a top-level constant that a config function returns, such as `module.exports = () => base;`. These changes apply to all plugins that read a JavaScript or TypeScript config, for example Vite, Vitest, Playwright and Electron.
  - A top-level `return config` gives the config also when a branch `return` gives no object, such as `if (!env) return null;` or `return mergeConfig(config, overrides);`. When a branch `return` gives an object, fallow reads that object, as before. A returned array always gives the configs of the array.
  - For webpack and rspack, fallow reads up to 64 configs of an exported array, also when a functi
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
  - Fallow reads a local `const` or `let` binding with a literal value in the returned value of a config function. This applies to a returned identifier, an array element, a property value and an object spread such as `...common` or `...common.resolve`. When a spread and a key set the same property, the last value wins.
  - Fallow also reads a spread of a stable top-level constant, such as `export default { ...base, test }`. These two changes apply to all plugins that read a JavaScript or TypeScript config, for example Vite, Vitest, Playwright and Electron.
  - For webpack and rspack, fallow reads each config of an exported array, also when a function returns the array. Each config resolves its entries against its own `context`. Fallow collects the loaders, the `plugins` requires and the `externals` of all configs. For webpack, fallow also collects the aliases of all configs.
  - Fallow does not read a binding that the config can change. This includes a write, a method such as `push`, a call such as `Object.assign`, and a change through an alias such as `const { resolve } = common`. Fallow also does not read a `var` binding, a destructured binding or the result of a call.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `255f50fe` are properly handled with clean fallback behavior.
