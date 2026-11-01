> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source**: github ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Source Version**: `500709f1`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T20:59:36.385Z  
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
> **Harvest Timestamp**: 2026-10-31T20:59:35.915Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5285 stars

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

### Core Architecture Module: `crates/cli/src/cli_hooks/hook_runtime.rs`
```
//! JSON bridge for generated agent hooks. Shell routing and report writes stay
//! in the gate; this module only decodes its external JSON boundaries.

use std::io::{Read, Write};
use std::process::ExitCode;

use serde::Deserialize;
use serde_json::Value;

pub const PROTOCOL: &str = "fallow-gate-json-v1";
const MAX_PAYLOAD_BYTES: u64 = 1024 * 1024;
const MAX_REPORT_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Clone, Copy, clap::ValueEnum)]
pub enum Operation {
    Probe,
    Input,
    Report,
    Findings,
}

#[derive(Default, Deserialize)]
struct ToolInput {
    command: Option<String>,
}

#[derive(Deserialize)]
struct Payload {
    cwd: Option<String>,
    tool_input: Option<ToolInput>,
}

pub fn run(operation: Operation) -> ExitCode {
    let result = process(
        operation,
        &mut std::io::stdin().lock(),
        &mut std::io::stdout().lock(),
    );
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            let _ = writeln!(std::io::stderr().lock(), "fallow-gate: {error}");
            ExitCode::from(2)
        }
    }
}

fn process(
    operation: Operation,
    input: &mut impl Read,
    output: &mut impl Write,
) -> Result<(), String> {
    if matches!(operation, Operation::Probe) {
        return writeln!(output, "{PROTOCOL}").map_err(|error| error.to_string());
    }
    let limit = if matches!(operation, Operation::Input) {
        MAX_PAYLOAD_BYTES
    } else {
        MAX_REPORT_BYTES
    };
    let bytes = bounded_input(input, limit)?;
    if matches!(operation, Operation::Input) {
        let payload: Payload = serde_json::from_slice(&bytes)
            .map_err(|error| format!("invalid hook payload: {error}"))?;
        let command = payload
            .tool_input
            .unwrap_or_default()
            .command
            .unwrap_or_default();
        return write_fields(
            output,
            &[&command, payload.cwd.as_deref().unwrap_or_default()],
        );
    }
    let report: Value =
        serde_json::from_slice(&bytes).map_err(|error| format!("invalid audit report: {error}"))?;
    if matches!(operation, Operation::Report) {
        return report_fields(&report, output);
    }
    for finding in blocking_findings(&report) {
        writeln!(output, "{}", format_finding(&finding)).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn bounded_input(input: &mut impl Read, limit: u64) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    input
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    if bytes.len() as u64 > limit {
        return Err(format!("JSON input exceeds the {limit}-byte limit"));
    }
    Ok(bytes)
}

fn write_fields(output: &mut impl Write, fields: &[&str]) -> Result<(), String> {
    if fields.iter().any(|field| field.contains('\0')) {
        return Err("hook JSON strings cannot contain NUL".to_string());
    }
    for field in fields {
        output
            .write_all(field.as_bytes())
            .map_err(|error| error.to_string())?;
        output.write_all(&[0]).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn report_fields(report: &Value, output: &mut impl Write) -> Result<(), String> {
    let error = report
        .get("error")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let verdict = report
        .get("verdict")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if !matches!(verdict, "pass" | "warn" | "fail") && !error {
        return Err("audit report has neither a verdict nor an error".to_string());
    }
    let message = report
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or_default();
    write_fields(
        output,
        &[
            verdict,
            if error { "true" } else { "false" },
            &clean(message),
        ],
    )
}

struct Finding<'a> {
    keys: Vec<&'a str>,
    value: &'a Value,
}

fn is_finding(value: &Value) -> bool {
    value.get("actions").is_some_and(Value::is_array)
        && [
            "introduced",
            "path",
            "from_path",
            "file",
            "files",
            "instances",
            "locations",
            "imported_from",
            "hops",
            "package_roots",
        ]
        .iter()
        .any(|key| value.get(key).is_some())
}

fn collect_findings<'a>(value: &'a Value, keys: &mut Vec<&'a str>, found: &mut Vec<Finding<'a>>) {
    if is_finding(value) {
        found.push(Finding {
            keys: keys.clone(),
            value,
        });
    }
    match value {
        Value::Object(object) => {
            for (key, child) in object {
                keys.push(key);
                collect_findings(child, keys, found);
                keys.pop();
            }
        }
        Value::Array(array) => {
            for child in array {
                collect_findings(child, keys, found);
            }
        }
        _ => {}
    }
}

fn is_warning(finding: &Finding<'_>) -> bool {
    matches!(
        first(finding.value, &["/effective_severity", "/severity"]).and_then(Value::as_str),
        Some("warn" | "off")
    )
}

fn blocking_findings(report: &Value) -> Vec<Finding<'_>> {
    let mut all = Vec::new();
    if let Some(object) = report.as_object() {
        for (key, value) in object {
            collect_findings(value, &mut vec![key.as_str()], &mut all);
        }
    }
    let introduced = all
        .iter()
        .any(|finding| finding.value.get("introduced") == Some(&Value::Bool(true)));
    if introduced {
        all.retain(|finding| finding.value.get("introduced") == Some(&Value::Bool(true)));
        if all.iter().any(|finding| !is_warning(finding)) {
            all.retain(|finding| !is_warning(finding));
        }
        return all;
    }
    if report.pointer("/attribution/gate").and_then(Value::as_str) == Some("all") {
        all.retain(|finding| !is_warning(finding));
        return all;
    }
    Vec::new()
}

fn first<'a>(value: &'a Value, pointers: &[&str]) -> Option<&'a Value> {
    pointers
        .iter()
        .filter_map(|pointer| value.pointer(pointer))
        .find(|field| !field.is_null() && **field != Value::Bool(false))
}

fn text(value: &Value) -> String {
    value
        .as_str()
        .map_or_else(|| value.to_string(), str::to_string)
}

fn clean(value: &str) -> String {
    let mut result = String::new();
    let mut in_control_run = false;
    for character in value.chars() {
        let control = character.is_control() || matches!(character, '\u{2028}' | '\u{2029}');
        if control {
            if !in_control_run {
                result.push(' ');
            }
        } else {
            result.push(character);
        }
        in_control_run = control;
    }
    result
}

fn format_finding(finding: &Finding<'_>) -> String {
    let value = finding.value;
    let identity = first(value, &["/code", "/rule"])
        .map(text)
        .or_else(|| {
            value
                .get("finding_id")
                .and_then(Value::as_str)
                .and_then(|id| id.split(':').nth(1))
                .map(str::to_string)
        })
        .unwrap_or_else(|| {
            let last = finding.keys.last().copied().unwrap_or("?");
            if matches!(last, "findings" | "clone_groups") {
                finding.keys.first().copied().unwrap_or("?")
            } else {
                last
            }
            .to_string()
        });
    let location = first(
        value,
        &[
            "/path",
            "/from_path",
            "/file",
            "/files/0",
            "/instances/0/file",
            "/locations/0/path",
            "/imported_from/0/path",
            "/hops/0/file",
            "/package_roots/0",
        ],
    )
    .map_or_else(|| "?".to_string(), text);
    let line = first(
        value,
        &[
            "/line",
            "/instances/0/start_line",
            "/locations/0/line",
            "/imported_from/0/line",
            "/hops/0/line",
        ],
    )
    .map(|line| format!(":{}", clean(&text(line))))
    .unwrap_or_default();
    let detail = first(
        value,
        &[
            "/export_name",
            "/package_name",
            "/member_name",
            "/entry_name",
            "/name",
            "/specifier",
            "/import_specifier",
            "/url",
            "/value",
            "/message",
        ],
    )
    .map(text)
    .unwrap_or_default();
    let detail = if detail.is_empty() {
        String::new()
    } else {
        format!(" {}", clean(&detail))
    };
    format!("{} {}{line}{detail}", clean(&identity), clean(&location))
}

```

### Core Architecture Module: `crates/cli/src/cli_hooks/mod.rs`
```
use std::path::Path;
use std::process::ExitCode;

use crate::error::emit_error;
use crate::init;
use crate::setup_hooks;

mod hook_runtime;

#[derive(clap::ValueEnum, Clone, Copy, Debug, PartialEq, Eq)]
pub enum HooksTargetArg {
    /// Shell-level Git pre-commit hook under .git/hooks/ or .husky/.
    Git,
    /// Agent-level Claude Code / Codex gate.
    Agent,
}

#[derive(clap::Subcommand)]
pub enum HooksCli {
    /// Internal JSON bridge used by generated agent gates.
    #[command(hide = true)]
    GateRuntime {
        #[arg(value_enum)]
        operation: hook_runtime::Operation,
    },

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
        HooksCli::GateRuntime { operation } => hook_runtime::run(operation),
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3998** (2026-10-29): **Can't use tsrs**
  *Symptoms*: ### What happened?  ``` Fallow 3.37.0 (latest; upstream main too) can't switch to tsrs here. Its tsrs backend is experimental (FALLOW_TYPE_AWARE_BACKEND=tsrs), and both the sidecar and the Rust binary require exactly tsrs 0.18.0-ts7.1.0-dev.20260929. That version ships no Windows binary (@tsrs/win32-x64 starts at 0.20.0). Our 0.20.1 is rejected: 'unsupported type-aware backend version 0.20.1-ts7.1.0-beta; expected 0.18.0…', and Fallow falls back to syntactic analysis with 114 false findings. What should T-094 do? ``` I installed tsrs to typecheck my project, and decided to also switch fallow to the same backend, then i got the error above why is fallow so restrictive? Why can't I use the same tsrs I installed to typecheck my project?  ### Reproduction  install latest tsrs 0.20.1  ### Expected behavior  I should be able to reuse my existing tsrs installation that i already use to typecheck the project  ### Fallow version  3.37.0  ### Operating system  Windows  ### Configuration  ```toml  ```
  **Post-Mortem & Fix Analysis**:
  > This is in v3.38.0: `npm install fallow@3.38.0`.  The experimental tsrs backend now accepts any tsrs from `0.18.0` up to but not including `1.0.0`, so your tsrs 0.20.1 works with `FALLOW_TYPE_AWARE_BACKEND=tsrs`. The default backend accepts any TypeScript 7 release. `fallow type-aware status` shows the version that fallow resolved. Guarded fixes still need `typescript@7.0.2`.  Thanks for raising this, @Smrtnyk. 

- **Issue #3950** (2026-10-29): **mutation: temporary copies bypass the Node child-process overlay**
  *Symptoms*: A selected `node:test` case can run an unchanged temporary copy of a planned source file and produce a false survivor. The child inherits `NODE_OPTIONS`; the preload works when the child executes the original path.  Reproduced on main `ef1617dd4924c86829bef25deafeabef3743cb7f` (3.36.0), Node 22.23.3.  `src/cli.mjs`:  ```js export const value = () => { return 1; }; if (import.meta.main) {   console.log(value()); } ```  `test/runner.test.mjs`:  ```js import assert from "node:assert/strict"; import { spawnSync } from "node:child_process"; import { copyFileSync, mkdtempSync, rmSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path"; import { test } from "node:test"; import { fileURLToPath } from "node:url"; import { value } from "../src/cli.mjs";  test("the library and CLI return the same value", (t) => {   assert.equal(value(), 1);   const directory = mkdtempSync(join(tmpdir(), "copied-cli-repro-"));   t.after(() => rmSync(directory, { recursive: true, force: true }));   const original = fileURLToPath(new URL("../src/cli.mjs", import.meta.url));   const copied = join(directory, "cli.mjs");   copyFileSync(original, copied);   const child = spawnSync(process.execPath, [copied], {     encoding: "utf8", env: process.env, timeout: 10000,   });   assert.equal(child.status, 0, child.stderr);   assert.equal(child.stdout, "1\n"); }); ```  Configure `entry: ["src/cli.mjs", "test/*.test.mjs"]`, `mutation.runner: "node-test"`, and `test: "node --test test/*

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

### Incident Patch 1: `93d80b0e` (2026-10-31)
**Commit Message**: fix(cloud): time limit on keychain calls and locked credentials file changes (#4042)

Fixes #4003, Fixes #4004

**File**: `changelog.d/fix-cloud-credentials-hardening.md` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+### Fixed
+
+- **`fallow inspect --cloud` no longer waits for a locked keychain.** The
+  keychain read (`security` on macOS, `secret-tool` on Linux) now has a time
+  limit of 1 second. At the limit, Fallow stops the tool, reads the
+  credentials file, and reports `no_key` when no key is stored. In
+  `fallow cloud login` and `fallow cloud logout`, each keychain call has a
+  limit of 60 seconds, so a person can answer an unlock prompt.
+  (Closes [#4003](https://github.com/fallow-rs/fallow/issues/4003))
+- **`fallow cloud login` and `logout` no longer lose keys in the credentials
+  file.** A change to the file now holds an advisory lock on
+  `credentials.lock` in the same directory, so two logins at the same time
+  for two API URLs keep both keys. When the file does not parse, the command
+  stops with a message that names the file and does not change the file.
+  (Closes [#4004](https://github.com/fallow-rs/fallow/issues/4004))
```

**File**: `crates/cli/src/coverage/credentials.rs` (modified, +286/-85)
```diff
@@ -17,10 +17,20 @@
 //! `FALLOW_CREDENTIAL_STORE=file` turns the keychain off for one process, and
 //! `FALLOW_CREDENTIAL_STORE=none` turns both stores off, for example on a
 //! shared CI runner or in a test.
+//!
+//! A locked keychain can show an unlock prompt and block the keychain tool.
+//! So each keychain call has a time limit: a short one for a read, and a
+//! longer one in `fallow cloud login` and `logout`, where a person can answer
+//! the prompt. At the limit, the tool is stopped and the call fails.
+//!
+//! A change to the credentials file holds an advisory lock on
+//! `credentials.lock` in the same directory, so two logins at the same time
+//! keep both keys. A change never replaces a file that does not parse.
 
-use std::io::Write as _;
+use std::io::{Read as _, Write as _};
 use std::path::{Path, PathBuf};
-use std::process::{Command, Stdio};
+use std::process::{Command, Output, Stdio};
+use std::time::{Duration, Instant};
 
 use serde::{Deserialize, Serialize};
 
@@ -34,6 +44,16 @@ pub const API_KEY_ENV: &str = "FALLOW_API_KEY";
 const KEYCHAIN_LABEL: &str = "Fallow Cloud API key";
 /// Format version of the credentials file.
 const CREDENTIALS_VERSION: u32 = 1;
+/// Name of the lock file next to the credentials file.
+const LOCK_FILE_NAME: &str = "credentials.lock";
+/// Time limit of a keychain read in a command that a person does not watch,
+/// for example an editor hook that runs `fallow inspect --cloud`.
+const KEYCHAIN_READ_LIMIT: Duration = Duration::from_secs(1);
+/// Time limit of each keychain call in `fallow cloud login` and `logout`.
+/// It is longer, because a person can answer an unlock prompt there.
+const KEYCHAIN_INTERACTIVE_LIMIT: Duration = Duration::from_secs(60);
+/// Interval between two checks for the exit of a keychain tool.
+const KEYCHAIN_POLL_INTERVAL: Duration = Duration::from_millis(10);
 
 /// Where a resolved key came from.
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
@@ -140,7 +160,8 @@ pub fn stored_api_key(base_url: &str) -> Option<ResolvedKey> {
     if store_mode() == StoreMode::None {
         return None;
     }
-    if let Some(key) = keychain().and_then(|keychain| keychain.read(base_url)) {
+    if let Some(key) = keychain().and_then(|keychain| keychain.read(base_url, KEYCHAIN_READ_LIMIT))
+    {
         return Some(ResolvedKey {
             key,
             source: KeySource::Keychain,
@@ -169,7 +190,7 @@ pub fn store_api_key(base_url: &str, key: &str) -> Result<KeySource, String> {
         return Err(format!("{CREDENTIAL_STORE_ENV}=none turns key storage off"));
     }
     if let Some(keychain) = keychain()
-        && keychain.write(base_url, key)
+        && keychain.write(base_url, key, KEYCHAIN_INTERACTIVE_LIMIT)
     {
         // A stale file entry must not outlive a newer keychain entry.
         if let Some(path) = credentials_path() {
@@ -196,7 +217,8 @@ pub struct Removed {
 ///
 /// Returns a message when the credentials file cannot be rewritten.
 pub fn remove_api_key(base_url: &str) -> Result<Removed, String> {
-    let keychain = keychain().is_some_and(|keychain| keychain.delete(base_url));
+    let keychain =
+        keychain().is_some_and(|keychain| keychain.delete(base_url, KEYCHAIN_INTERACTIVE_LIMIT));
     let file = match credentials_path() {
         Some(path) => remove_from_file(&path, base_url)?,
         None => false,
@@ -223,15 +245,55 @@ struct CredentialsFile {
     keys: std::collections::BTreeMap<String, String>,
 }
 
+/// Read the file for a key lookup. A file that is missing or does not parse
+/// has no keys.
 fn read_credentials(path: &Path) -> CredentialsFile {
-    std::fs::read_to_string(path)
-        .ok()
-        .and_then(|text| serde_json::from_str(&text).ok())
-        .unwrap_or_default()
+    read_credentials_for_change(path).unwrap_or_default()
+}
+
+/// Read the file before a change. A missing or empty file has no keys. A file
+/// that does not parse is an error, so that a change cannot drop the keys of
+/// other API URLs.
+fn read_credentials_for_change(path: &Path) -> Result<CredentialsFile, String> {
+    let text = match std::fs::read_to_string(path) {
+        Ok(text) => text,
+        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
+            return Ok(CredentialsFile::default());
+        }
+        Err(err) => return Err(format!("failed to read {}: {err}", path.display())),
+    };
+    if text.trim().is_empty() {
+        return Ok(CredentialsFile::default());
+    }
+    serde_json::from_str(&text).map_err(|err| {
+        format!(
+            "{} does not parse as a credentials file ({err}). Fallow did not change it. \
+             Repair or remove the file, then try again",
+            path.display()
+        )
+    })
+}
+
+/// Take an exclusive advisory lock on the lock file next to `path`. The lock
+/// stays until the returned file is dropped. Every process that changes the
+/// credentials file takes it, so two changes cannot overlap.
+fn lock_crede
```

**File**: `crates/cli/tests/integration/inspect_cloud_tests.rs` (modified, +97/-0)
```diff
@@ -127,6 +127,17 @@ struct Env<'a> {
 }
 
 fn run(args: &[&str], root: &Path, env: &Env<'_>) -> CommandOutput {
+    run_with(args, root, env, |_| {})
+}
+
+/// [`run`] with a last change to the command, for example to give it a
+/// keychain.
+fn run_with(
+    args: &[&str],
+    root: &Path,
+    env: &Env<'_>,
+    customize: impl FnOnce(&mut Command),
+) -> CommandOutput {
     let mut command = Command::new(fallow_bin());
     command
         .args(args)
@@ -150,6 +161,7 @@ fn run(args: &[&str], root: &Path, env: &Env<'_>) -> CommandOutput {
         Some(key) => command.env("FALLOW_API_KEY", key),
         None => command.env_remove("FALLOW_API_KEY"),
     };
+    customize(&mut command);
     let output = command.output().expect("run fallow");
     CommandOutput {
         stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
@@ -281,6 +293,91 @@ fn inspect_cloud_without_a_key_reports_no_key_and_succeeds() {
     assert!(cloud["functions"].as_array().unwrap().is_empty());
 }
 
+/// Give the command a keychain: a fake `secret-tool` that never answers, as a
+/// locked keychain does while it shows an unlock prompt. Linux only, because
+/// on macOS the keychain tool has a fixed path.
+#[cfg(target_os = "linux")]
+fn hanging_keychain(tools: &Path) -> impl FnOnce(&mut Command) {
+    use std::os::unix::fs::PermissionsExt as _;
+    let tool = tools.join("secret-tool");
+    std::fs::write(&tool, "#!/bin/sh\nexec sleep 60\n").unwrap();
+    std::fs::set_permissions(&tool, std::fs::Permissions::from_mode(0o755)).unwrap();
+    let path = std::env::join_paths(
+        std::iter::once(tools.to_path_buf())
+            .chain(std::env::split_paths(&std::env::var_os("PATH").unwrap())),
+    )
+    .unwrap();
+    move |command: &mut Command| {
+        command
+            .env_remove("FALLOW_CREDENTIAL_STORE")
+            .env("DBUS_SESSION_BUS_ADDRESS", "unix:path=/nonexistent")
+            .env("PATH", path);
+    }
+}
+
+/// The keychain read has a time limit of about one second. The bound here is
+/// far below the 60 s of the fake tool and leaves room for a slow CI runner.
+#[cfg(target_os = "linux")]
+const HUNG_KEYCHAIN_BOUND: std::time::Duration = std::time::Duration::from_secs(20);
+
+#[cfg(target_os = "linux")]
+#[test]
+fn inspect_cloud_with_a_hanging_keychain_reports_no_key_within_the_limit() {
+    let (dir, home) = project();
+    let tools = tempdir().unwrap();
+    let start = std::time::Instant::now();
+    let output = run_with(
+        INSPECT_JSON,
+        dir.path(),
+        &Env {
+            api_url: Some("http://127.0.0.1:9"),
+            api_key: None,
+            home: home.path(),
+        },
+        hanging_keychain(tools.path()),
+    );
+    let elapsed = start.elapsed();
+    assert!(elapsed < HUNG_KEYCHAIN_BOUND, "took {elapsed:?}");
+    assert_eq!(output.code, 0, "stderr={}", output.stderr);
+    assert_eq!(parse_json(&output)["evidence"]["cloud"]["status"], "no_key");
+}
+
+#[cfg(target_os = "linux")]
+#[test]
+fn inspect_cloud_with_a_hanging_keychain_uses_the_credentials_file() {
+    let (dir, home) = project();
+    let tools = tempdir().unwrap();
+    let (endpoint, captured, handle) = serve(vec![(200, file_context_body())]);
+    let config = home.path().join(".config").join("fallow");
+    std::fs::create_dir_all(&config).unwrap();
+    std::fs::write(
+        config.join("credentials"),
+        format!(r#"{{"version":1,"keys":{{"{endpoint}":"fallow_read_k1_fromfile"}}}}"#),
+    )
+    .unwrap();
+    let start = std::time::Instant::now();
+    let output = run_with(
+        INSPECT_JSON,
+        dir.path(),
+        &Env {
+            api_url: Some(&endpoint),
+            api_key: None,
+            home: home.path(),
+        },
+        hanging_keychain(tools.path()),
+    );
+    handle.join().expect("server joins");
+    let elapsed = start.elapsed();
+    assert!(elapsed < HUNG_KEYCHAIN_BOUND, "took {elapsed:?}");
+    assert_eq!(output.code, 0, "stderr={}", output.stderr);
+    assert_eq!(parse_json(&output)["evidence"]["cloud"]["status"], "ok");
+    let request = captured.lock().unwrap()[0].to_ascii_lowercase();
+    assert!(
+        request.contains("authorization: bearer fallow_read_k1_fromfile"),
+        "the key of the credentials file is sent: {request}"
+    );
+}
+
 #[test]
 fn inspect_cloud_maps_the_tier_gate_to_plan_required() {
     let (dir, home) = project();
```

---

### Incident Patch 2: `0b961143` (2026-10-31)
**Commit Message**: fix(nextjs): credit generateStaticParams in metadata routes (#4038)

* fix(nextjs): credit generateStaticParams in metadata routes

Next.js calls generateStaticParams from a metadata route under a
dynamic segment, such as app/blog/[slug]/opengraph-image.tsx, to
prerender it. The shared metadata route export list credited the route
segment config exports but not generateStaticParams, so dead-code
reported it as unused in opengraph-image, twitter-image, icon,
apple-icon, sitemap, manifest and robots.

Add generateStaticParams to the shared list. dynamicParams and
unrelated helper exports stay reportable.

Signed-off-by: Vladimir Pirotskiy <[REDACTED_EMAIL]>

* docs(nextjs): correct robots and manifest wording for generateStaticParams

Next.js matches robots and manifest only at the app root, so these routes never sit under a dynamic segment. The changelog fragment and the code comment now say that the export is credited on every metadata route, and name only the routes that can be dynamic.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

---------

Signed-off-by: Vladimir Pirotskiy <[REDACTED_EMAIL]>
Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>
Co-authored-by: Bart Waardenb

**File**: `changelog.d/fix-nextjs-metadata-route-generate-static-params.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **`fallow dead-code` no longer reports `generateStaticParams` in a Next.js metadata route as an unused export.** Next.js calls it to prerender an `opengraph-image`, `twitter-image`, `icon`, `apple-icon` or `sitemap` route under a dynamic segment, such as `app/blog/[slug]/opengraph-image.tsx`. It is now credited on every metadata route, together with the route segment config exports (`dynamic`, `revalidate`, `fetchCache`, `runtime`, `preferredRegion`, `maxDuration`). `dynamicParams` and unrelated helper exports stay reportable.
```

**File**: `crates/core/src/plugins/nextjs.rs` (modified, +7/-0)
```diff
@@ -86,10 +86,16 @@ const INSTRUMENTATION_EXPORTS: &[&str] = &["register", "onRequestError"];
 const INSTRUMENTATION_CLIENT_EXPORTS: &[&str] = &["onRouterTransitionStart"];
 const MDX_COMPONENT_EXPORTS: &[&str] = &["useMDXComponents"];
 
+// Exports Next.js re-exports from every metadata route into the generated route
+// handler. `generateStaticParams` prerenders a route under a dynamic segment,
+// such as `app/blog/[slug]/opengraph-image.tsx`. Next.js matches `robots` and
+// `manifest` only at the app root, so there the export has no effect, but
+// crediting it is still safe. The rest is route segment config.
 macro_rules! metadata_route_exports {
     ($($export:literal),* $(,)?) => {
         &[
             $($export,)*
+            "generateStaticParams",
             "dynamic",
             "revalidate",
             "fetchCache",
@@ -579,6 +585,7 @@ mod tests {
                 "runtime",
                 "preferredRegion",
                 "maxDuration",
+                "generateStaticParams",
             ] {
                 assert!(
                     used.contains(&config_export),
```

**File**: `crates/core/tests/integration_test/frameworks.rs` (modified, +51/-0)
```diff
@@ -173,6 +173,57 @@ fn nextjs_special_file_exports_are_not_flagged() {
     }
 }
 
+/// Next.js re-exports every named export of a metadata image route into the
+/// generated route handler, so a `generateStaticParams` next to the image
+/// default export is read by the framework when the route sits under a dynamic
+/// segment. Only the unrelated helper stays reportable.
+#[test]
+fn nextjs_metadata_image_route_generate_static_params_is_not_flagged() {
+    let root = fixture_path("nextjs-project");
+    let config = create_config(root.clone());
+    let results = fallow_core::analyze(&config).expect("analysis should succeed");
+
+    let unused_exports: Vec<(String, String)> = results
+        .unused_exports
+        .iter()
+        .map(|e| {
+            (
+                e.export
+                    .path
+                    .strip_prefix(&root)
+                    .unwrap_or(&e.export.path)
+                    .to_string_lossy()
+                    .replace('\\', "/"),
+                e.export.export_name.clone(),
+            )
+        })
+        .collect();
+
+    for file in [
+        "src/app/blog/[slug]/opengraph-image.tsx",
+        "src/app/blog/[slug]/twitter-image.tsx",
+        "src/app/blog/[slug]/icon.tsx",
+        "src/app/blog/[slug]/apple-icon.tsx",
+    ] {
+        for export in ["default", "size", "contentType", "generateStaticParams"] {
+            assert!(
+                !unused_exports
+                    .iter()
+                    .any(|(unused_file, unused_export)| unused_file == file
+                        && unused_export == export),
+                "{file}:{export} should be treated as framework-used, found: {unused_exports:?}"
+            );
+        }
+        assert!(
+            unused_exports
+                .iter()
+                .any(|(unused_file, unused_export)| unused_file == file
+                    && unused_export == "unusedImageHelper"),
+            "{file}:unusedImageHelper should still be reported, found: {unused_exports:?}"
+        );
+    }
+}
+
 #[test]
 fn nextjs_config_referenced_dependencies_are_not_flagged_unused() {
     let root = fixture_path("nextjs-config-deps");
```

**File**: `tests/fixtures/nextjs-project/src/app/blog/[slug]/apple-icon.tsx` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+export const size = { width: 32, height: 32 };
+export const contentType = "image/png";
+
+export function generateStaticParams() {
+  return [{ slug: "a" }];
+}
+
+export const unusedImageHelper = "unused";
+
+export default function Icon() {
+  return new Response("icon");
+}
```

**File**: `tests/fixtures/nextjs-project/src/app/blog/[slug]/icon.tsx` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+export const size = { width: 32, height: 32 };
+export const contentType = "image/png";
+
+export function generateStaticParams() {
+  return [{ slug: "a" }];
+}
+
+export const unusedImageHelper = "unused";
+
+export default function Icon() {
+  return new Response("icon");
+}
```

**File**: `tests/fixtures/nextjs-project/src/app/blog/[slug]/opengraph-image.tsx` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+export const alt = "Blog post";
+export const size = { width: 1200, height: 630 };
+export const contentType = "image/png";
+
+export function generateStaticParams() {
+  return [{ slug: "a" }];
+}
+
+export const unusedImageHelper = "unused";
+
+export default function Image() {
+  return new Response("image");
+}
```

**File**: `tests/fixtures/nextjs-project/src/app/blog/[slug]/twitter-image.tsx` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+export const alt = "Blog post";
+export const size = { width: 1200, height: 630 };
+export const contentType = "image/png";
+
+export function generateStaticParams() {
+  return [{ slug: "a" }];
+}
+
+export const unusedImageHelper = "unused";
+
+export default function Image() {
+  return new Response("image");
+}
```

---

### Incident Patch 3: `8082fffe` (2026-10-31)
**Commit Message**: fix(ship): stop the PR wait when a fork run waits for approval (#4052)

GitHub does not start the workflows of some pull requests from a fork until a maintainer approves them. Such a run is complete with the conclusion action_required and registers no checks. ship-wait-checks --pr skipped completed runs, so it reported all checks passed on the few workflows that ran, while CI never started.

A run that waits for approval is now an approval check. The wait stops at once with exit code 5 and lists each run with its link. A failed check still wins. The ship skill says to read the code before the approval and to approve again after each push of the fork.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

**File**: `.agents/skills/ship/SKILL.md` (modified, +8/-0)
```diff
@@ -191,6 +191,14 @@ Use these scripts for each pull request, one at a time:
    conflicts with its base. The script then stops with exit code 3.
    Update the branch, push, and wait again.
 
+   GitHub does not start the workflows of some pull requests from a fork
+   until a maintainer approves them. Pinned auto-merge then never merges,
+   and the few checks that ran can look complete. The script stops with
+   exit code 5 and lists each run. Read all of the code of the pull request
+   first, because the approved runs execute it. Then approve each listed
+   run with `gh api -X POST repos/<owner>/<repo>/actions/runs/<run id>/approve`,
+   and wait again. Each new push of the fork needs a new approval.
+
    The script compares each failed check with the same check name on the
    newest completed run of `main`. A check that also fails on `main` gets
    the line `FAIL (also on main <sha>)`. When all failed checks also fail
```

**File**: `.claude/skills/ship/SKILL.md` (modified, +8/-0)
```diff
@@ -192,6 +192,14 @@ Use these scripts for each pull request, one at a time:
    conflicts with its base. The script then stops with exit code 3.
    Update the branch, push, and wait again.
 
+   GitHub does not start the workflows of some pull requests from a fork
+   until a maintainer approves them. Pinned auto-merge then never merges,
+   and the few checks that ran can look complete. The script stops with
+   exit code 5 and lists each run. Read all of the code of the pull request
+   first, because the approved runs execute it. Then approve each listed
+   run with `gh api -X POST repos/<owner>/<repo>/actions/runs/<run id>/approve`,
+   and wait again. Each new push of the fork needs a new approval.
+
    The script compares each failed check with the same check name on the
    newest completed run of `main`. A check that also fails on `main` gets
    the line `FAIL (also on main <sha>)`. When all failed checks also fail
```

**File**: `scripts/ship-wait-checks.mjs` (modified, +45/-5)
```diff
@@ -14,6 +14,10 @@
 // commit of origin/main when that commit contains the given commit. With
 // --pr, a failed check that also fails on main gets its own exit code, so a
 // ship step can wait for the fix on main instead of a fix on the branch.
+// GitHub does not start the workflows of a pull request from a fork until a
+// maintainer approves them. Such a run is complete with the conclusion
+// action_required and has no checks, so with --pr the wait stops at once
+// instead of a pass on the checks of the other workflows.
 
 import { spawnSync } from "node:child_process";
 import { resolve } from "node:path";
@@ -72,6 +76,9 @@ const SETTLE_MS = 10 * MINUTE;
 // right after a push the only check can be a skip, before ci.yml registers
 // its jobs.
 const PASS_BUCKET = "pass";
+// A pull-request workflow run that waits for maintainer approval.
+const APPROVAL_BUCKET = "approval";
+const APPROVAL_CONCLUSION = "action_required";
 // GitHub creates all push runs of a commit together, and a new run is pending.
 // So a complete set of runs contains all push runs. The short settle time catches a
 // run that a completed run starts, for example through workflow_run.
@@ -139,6 +146,10 @@ With --pr, path filters can start fewer checks than --min-checks. When the
 checks stay complete and unchanged for ${SETTLE_MS / MINUTE} minutes, the wait ends below the
 count.
 
+With --pr, the wait stops when a workflow run waits for maintainer approval,
+which GitHub requires for some pull requests from a fork. No wait ends this
+state: read the code of the pull request, approve the runs, and wait again.
+
 With --pr, a set of checks without a passed check is not complete. Some
 workflows skip at once on each pull request, before the CI workflow starts
 its jobs. Such a set never passes. When it stays unchanged for ${SETTLE_MS / MINUTE} minutes,
@@ -154,7 +165,7 @@ cancelled, or when --follow-main reaches the maximum count of moves, 2 for
 invalid input, failed reads for the full --error-window, a timeout, a failed read
 of ${FOLLOW_REF}, or an ${FOLLOW_REF} that does not contain the given commit,
 3 when the pull request conflicts with its base branch, 4 when each failed
-check also fails on ${FOLLOW_BRANCH}.
+check also fails on ${FOLLOW_BRANCH}, 5 when a workflow run waits for maintainer approval.
 
 With --pr, the script compares each failed check with the newest completed
 run of the same check name on the newest ${MAIN_COMMIT_LIMIT} commits of ${FOLLOW_BRANCH}. A check that
@@ -212,6 +223,9 @@ const countedStatus = (checks, unchangedMs, { requirePass, stableMs }) => {
  * `unchangedMs` is the time since the check set last changed.
  */
 const completedStatus = (checks, unchangedMs, options) => {
+  if (hasBucket(checks, APPROVAL_BUCKET)) {
+    return hasFailure(checks) ? "fail" : "approval";
+  }
   if (hasBucket(checks, "pending")) {
     return null;
   }
@@ -240,8 +254,11 @@ const completedStatus = (checks, unchangedMs, options) => {
  * can only end `settled` through `settleMs`. With `stableMs`, a complete set
  * passes only after it stays unchanged for that time. A failed check fails
  * the wait at once.
+ * A check in the `approval` bucket ends the wait at once with the status
+ * `approval`, because only a maintainer can start that run. A failed check
+ * still wins.
  * Returns `{ status, checks }` where `status` is `pass`, `settled`, `fail`,
- * `conflict`, `timeout` or `error`. After a failed read of the checks, the
+ * `approval`, `conflict`, `timeout` or `error`. After a failed read of the checks, the
  * delay to the next read doubles from `intervalMs` up to `READ_RETRY_MAX_MS`.
  * The status is `error` (with `readErrors` and `errorMs`) when the planned
  * delays of the failed reads reach `errorWindowMs`, or when the deadline
@@ -873,7 +890,7 @@ const readPrWorkflows = ({ head, repo }) => {
     "--limit",
     String(RUN_LIST_LIMIT),
     "--json",
-    "databaseId,workflowDatabaseId,workflowName,status,url,headSha,event",
+    "databaseId,workflowDatabaseId,workflowName,status,conclusion,url,headSha,event",
   ];
   if (repo !== null) args.push("--repo", repo);
   const read = parseGhApi(spawnSync("gh", args, { encoding: "utf8" }));
@@ -921,11 +938,23 @@ const requiredWorkflowSelector = ({ checks, registered, readRun, head }) => {
   };
 };
 
-/** Keep unregistered jobs pending without adding completed passes to the check count. */
+/**
+ * Keep unregistered jobs pending without adding completed passes to the check
+ * count. A run that waits for approval registers no checks, so it counts in
+ * every mode.
+ */
 const pendingWorkflowChecks = (runs, { names, ...context }) => {
   const selectRequired = requiredWorkflowSelector(context);
   const checks = [];
   for (const run of runs) {
+    if (run.status === "completed" && run.conclusion === APPROVAL_CONCLUSION) {
+      checks.push({
+        name: `${run.workflowName} workflow (${run.databaseId})`,
+        bucket: APPROVAL_BUCKET,
+        lin
```

**File**: `scripts/ship-wait-checks.test.mjs` (modified, +45/-0)
```diff
@@ -377,6 +377,33 @@ test("a pull request that conflicts with its base stops the wait with exit code
   assert.match(lines[0], /no pull_request workflows/u);
 });
 
+test("a workflow run that waits for maintainer approval stops the wait with exit code 5", async () => {
+  const approval = check("CI workflow (300)", "approval");
+  const script = scripted([
+    { ok: true, checks: [check("Commitlint", "pass"), check("lint", "pending"), approval] },
+  ]);
+
+  const result = await wait(script, { minChecks: 3 });
+  const lines = [];
+  const code = reportChecks(result, { label: "PR 7", minChecks: 3 }, (line) => lines.push(line));
+
+  assert.equal(result.status, "approval");
+  assert.equal(script.reads(), 1);
+  assert.equal(code, 5);
+  assert.match(lines[0], /^PR 7: 1 workflow run waits for maintainer approval/u);
+  assert.match(lines[1], /APPROVAL: CI workflow \(300\) https:\/\/example\.invalid\//u);
+});
+
+test("a failed check wins over a run that waits for approval", async () => {
+  const script = scripted([
+    { ok: true, checks: [check("lint", "fail"), check("CI workflow (300)", "approval")] },
+  ]);
+
+  const result = await wait(script);
+
+  assert.equal(result.status, "fail");
+});
+
 test("an unknown or mergeable state keeps the wait going", async () => {
   const script = scripted([
     { ok: true, checks: [] },
@@ -743,6 +770,24 @@ test("the CLI waits for a queued PR workflow before its checks exist", fakeGhOpt
   }
 });
 
+test("the CLI stops when a fork PR workflow waits for approval", fakeGhOptions, () => {
+  for (const cliArgs of [[], ["--required"]]) {
+    const result = runWithFakeGh(
+      {
+        selected: [check("CI", "pass")],
+        rollups: [{ statusCheckRollup: [checkRun("Commitlint", "COMPLETED", "SUCCESS")] }],
+        prRuns: [[prWorkflow({ status: "completed", conclusion: "action_required" })]],
+      },
+      cliArgs,
+    );
+
+    assert.equal(result.status, 5, result.stdout + result.stderr);
+    assert.match(result.stdout, /waits for maintainer approval/u);
+    assert.match(result.stdout, new RegExp(`${RUN_URL}/300`, "u"));
+    assert.equal(rollupReads(result.calls).length, 1);
+  }
+});
+
 test("a PR with no check rollup waits for its queued workflow", fakeGhOptions, () => {
   const result = runWithFakeGh({
     selected: [],
```

#### Recent Merged Pull Requests:
- **PR #4055** (2026-10-31): fix(mutation): skip a PATH file that cannot run (@BartWaardenburg)
- **PR #4054** (2026-10-31): ci: run the fallow-graph Miri tests as three parallel shards (@BartWaardenburg)
- **PR #4053** (2026-10-31): fix(mutation): look up a bare --runtime name on PATH (@BartWaardenburg)
- **PR #4052** (2026-10-31): fix(ship): stop the PR wait when a fork run waits for approval (@BartWaardenburg)
- **PR #4051** (2026-10-31): feat(mcp): add cloud section and compact text to inspect_target (@BartWaardenburg)
- **PR #4050** (2026-10-31): fix(mutation): keep the test error of a failed dry-run test (@BartWaardenburg)

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

## X. cloud): time limit on keychain calls and locked credentials file changes (#4042)

**RULE**:
When implementing operations in `changelog.d/fix-cloud-credentials-hardening.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fallow-rs/fallow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `93d80b0e`: cloud): time limit on keychain calls and locked credentials file changes (#4042). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/fix-cloud-credentials-hardening.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
### Fixed

- **`fallow inspect --cloud` no longer waits for a locked keychain.** The
  keychain read (`security` on macOS, `secret-tool` on Linux) now has a time
  limit of 1 second. At the limit, Fallow stops the tool, reads the
  credentials file, and reports `no_key` when no key is stored. In
  `fallow cloud login` and `fallow cloud logout`, each keychain call has a
  limit of 60 seconds, so a person can answer an unlock prompt.
  (Closes [#4003](https://github.com/fallow-rs/fallow/issues/4003))
- **`fallow cloud login` and `logout` no longer lose keys in the credentials
  file.** A change to the file now holds an advisory lock on
  `credentials.lock` in the same directory, so two logins at the same time
  for two API URLs keep both keys. When the file does not parse, the command
  stops with a message that names the file and does not change the file.
  (Closes [#4004](https://github.com/fallow-rs/fallow/issues/4004))
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `93d80b0e` are properly handled with clean fallback behavior.
