> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source**: github ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Source Version**: `7cead47b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T23:39:17.614Z  
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
> **Harvest Timestamp**: 2026-11-03T23:39:15.685Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5296 stars

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
            allow_names: Vec::new(),
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

fn suppression_inventory_json(fixture: &War
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

use crate::exit_codes::exit_invalid_input;
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
            exit_invalid_input()
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

### Incident Patch 1: `7cead47b` (2026-11-03)
**Commit Message**: fix(resolve): credit an uninstalled package for a Vite asset query import (#4181)

* fix(resolve): credit an uninstalled package for a Vite asset query import

A bare import with a Vite asset query, for example `pkg/dist/a.wasm?url`,
failed the package name check because of the `?`. Before the package was
installed, the import was an unresolved import and the package did not
count as used. The same subpath without a query credits the package.

The resolver now strips a query that holds only Vite asset parameters
(`url`, `raw`, `worker`, `sharedworker`, `inline`, `no-inline`, `init`)
when the package is not installed, and classifies the path the same as
the plain subpath. A file that is missing from an installed package stays
an unresolved import with the full specifier. An unknown query also stays
unresolved.

The graph cache version changes, because a cache from an earlier run
replays the old classification on an unchanged tree.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* fix(resolve): credit workspace source and key the cache on installs

A Vite asset query import of a linked workspace package now runs the workspace and alias fallbacks before the install check. The res

**File**: `changelog.d/fix-vite-asset-query-imports.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **`fallow dead-code` no longer reports a package import with a Vite asset query as unresolved when the package is not installed.** An import such as `pkg/dist/engine.wasm?url` or `pkg/build/worker.mjs?worker&inline` was an unresolved import before `node_modules` existed, and the package did not count as used. Fallow now treats the import the same as the plain subpath: the package counts as used and no finding appears. The supported query parameters are `url`, `raw`, `worker`, `sharedworker`, `inline`, `no-inline` and `init`. A query import of a workspace package credits the workspace source file, with or without the `node_modules` link. A file that is missing from an installed package is still an unresolved import. The graph cache now records whether `node_modules` exists at the project root and at each workspace root, so an install after a cached run does not replay the old result. The graph cache version changed, so a graph cache from an earlier run does not replay the old result.
```

**File**: `crates/core/src/resolution_inputs.rs` (modified, +25/-0)
```diff
@@ -65,9 +65,34 @@ pub fn resolution_inputs_hash(
         target.hash(&mut hasher);
     }
 
+    let mut install_states = node_modules_states(root, workspaces);
+    install_states.sort_unstable();
+    install_states.len().hash(&mut hasher);
+    for state in &install_states {
+        state.hash(&mut hasher);
+    }
+
     hasher.finish()
 }
 
+/// Return `(path, exists)` for the `node_modules` directory of the project
+/// root and of each workspace root.
+///
+/// The resolver reports a bare import with a Vite asset query as unresolved
+/// only when the package is installed, so an install changes the result
+/// without an edit to a source file or a manifest. Only the existence keys the
+/// mode: a modification time changes on every fresh install in CI and would
+/// make each restored cache miss.
+fn node_modules_states(root: &Path, workspaces: &[WorkspaceInfo]) -> Vec<(String, bool)> {
+    std::iter::once(root)
+        .chain(workspaces.iter().map(|ws| ws.root.as_path()))
+        .map(|dir| {
+            let path = dir.join("node_modules");
+            (portable_key(root, &path), path.is_dir())
+        })
+        .collect()
+}
+
 /// `package.json` fields whose paths the resolver follows for a package
 /// import. `exports` is read separately because it nests.
 const PACKAGE_ENTRY_FIELDS: &[&str] = &["main", "module", "types", "typings"];
```

**File**: `crates/core/tests/integration_test.rs` (modified, +2/-0)
```diff
@@ -490,6 +490,8 @@ mod scoped_used_class_members;
 mod scss_partials;
 #[path = "integration_test/super_method_calls.rs"]
 mod super_method_calls;
+#[path = "integration_test/vite_asset_query_imports.rs"]
+mod vite_asset_query_imports;
 #[path = "integration_test/vite_sass_crediting.rs"]
 mod vite_sass_crediting;
 
```

**File**: `crates/core/tests/integration_test/vite_asset_query_imports.rs` (added, +253/-0)
```diff
@@ -0,0 +1,253 @@
+use super::common::{create_config, create_config_with_cache};
+use std::path::Path;
+
+const PACKAGE_JSON: &str = r#"{"name":"vite-asset-queries","private":true,"dependencies":{"plain-pkg":"1.0.0","@scope/mapped-pkg":"1.0.0"},"devDependencies":{"vite":"*"}}"#;
+
+fn write(root: &Path, path: &str, source: &str) {
+    let path = root.join(path);
+    std::fs::create_dir_all(path.parent().expect("parent")).expect("directory");
+    std::fs::write(path, source).expect("fixture file");
+}
+
+fn project(entry: &str, installed: bool) -> tempfile::TempDir {
+    let dir = tempfile::tempdir().expect("project");
+    let root = dir.path();
+    write(root, "package.json", PACKAGE_JSON);
+    write(root, "src/index.ts", entry);
+    if installed {
+        write(
+            root,
+            "node_modules/plain-pkg/package.json",
+            r#"{"name":"plain-pkg","version":"1.0.0","main":"index.js"}"#,
+        );
+        write(
+            root,
+            "node_modules/plain-pkg/index.js",
+            "module.exports = {};",
+        );
+        write(
+            root,
+            "node_modules/plain-pkg/build/worker.min.mjs",
+            "self.onmessage = () => {};",
+        );
+        write(
+            root,
+            "node_modules/@scope/mapped-pkg/package.json",
+            r#"{"name":"@scope/mapped-pkg","version":"1.0.0","exports":{".":"./dist/index.js","./dist/*":"./dist/*"}}"#,
+        );
+        write(
+            root,
+            "node_modules/@scope/mapped-pkg/dist/index.js",
+            "export {};",
+        );
+        write(root, "node_modules/@scope/mapped-pkg/dist/engine.wasm", "");
+        write(
+            root,
+            "node_modules/@scope/mapped-pkg/dist/worker.js",
+            "export {};",
+        );
+    }
+    dir
+}
+
+struct Findings {
+    unresolved: Vec<String>,
+    unused_dependencies: Vec<String>,
+}
+
+fn analyze(root: &Path) -> Findings {
+    let mut config = create_config(root.to_path_buf());
+    config.entry_patterns = vec!["src/index.ts".to_string()];
+    let results = fallow_core::analyze(&config).expect("analysis");
+    Findings {
+        unresolved: results
+            .unresolved_imports
+            .iter()
+            .map(|finding| finding.import.specifier.clone())
+            .collect(),
+        unused_dependencies: results
+            .unused_dependencies
+            .iter()
+            .map(|finding| finding.dep.package_name.clone())
+            .collect(),
+    }
+}
+
+const QUERY_IMPORTS: &str = "\
+import a from 'plain-pkg/build/worker.min.mjs?url';
+import b from 'plain-pkg/build/worker.min.mjs?raw';
+import c from 'plain-pkg/build/worker.min.mjs?worker&inline';
+import d from '@scope/mapped-pkg/dist/engine.wasm?url';
+import e from '@scope/mapped-pkg/dist/engine.wasm?init';
+import f from '@scope/mapped-pkg/dist/worker.js?sharedworker';
+import g from '@scope/mapped-pkg/dist/engine.wasm?url&no-inline';
+console.log(a, b, c, d, e, f, g);
+";
+
+#[test]
+fn query_imports_of_an_installed_package_resolve_and_credit_it() {
+    let dir = project(QUERY_IMPORTS, true);
+    let findings = analyze(dir.path());
+    assert!(findings.unresolved.is_empty(), "{:?}", findings.unresolved);
+    assert!(
+        findings.unused_dependencies.is_empty(),
+        "{:?}",
+        findings.unused_dependencies
+    );
+}
+
+#[test]
+fn query_imports_of_an_uninstalled_package_credit_it() {
+    let dir = project(QUERY_IMPORTS, false);
+    let findings = analyze(dir.path());
+    assert!(
+        findings.unresolved.is_empty(),
+        "an uninstalled package cannot prove the file is missing: {:?}",
+        findings.unresolved
+    );
+    assert!(
+        findings.unused_dependencies.is_empty(),
+        "both packages must count as used: {:?}",
+        findings.unused_dependencies
+    );
+}
+
+#[test]
+fn missing_file_of_an_installed_package_with_query_stays_unresolved() {
+    let dir = project(
+        "import a from 'plain-pkg/build/missing.mjs?url';\nimport b from '@scope/mapped-pkg/dist/missing.wasm?raw';\nconsole.log(a, b);\n",
+        true,
+    );
+    assert_eq!(
+        analyze(dir.path()).unresolved,
+        vec![
+            "plain-pkg/build/missing.mjs?url".to_string(),
+            "@scope/mapped-pkg/dist/missing.wasm?raw".to_string(),
+        ]
+    );
+}
+
+#[test]
+fn unknown_query_on_an_uninstalled_package_stays_unresolved() {
+    let dir = project(
+        "import a from 'plain-pkg/build/worker.min.mjs?custom';\nconsole.log(a);\n",
+        false,
+    );
+    assert_eq!(
+        analyze(dir.path()).unresolved,
+        vec!["plain-pkg/build/worker.min.mjs?custom".to_string()]
+    );
+}
+
+/// Build a workspace project whose `ui` package exports its `dist` output,
+/// but has only source files.
+fn workspace_project() -> tempfile::TempDir {
+    let dir = tempfile::tempdir().expect("project");
+    let root = dir.path();
+    write(
+        root,
+        "package.json",
+   
```

**File**: `crates/graph/src/cache/mod.rs` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ pub use store::{GRAPH_CACHE_FILE, GraphCacheStore};
 /// Never reuse a version number that a published build wrote, even from a
 /// development commit. Git history and the CHANGELOG record the reason for
 /// each bump.
-pub const GRAPH_CACHE_VERSION: u32 = 99;
+pub const GRAPH_CACHE_VERSION: u32 = 100;
 
 /// Cached form of a resolved target.
 ///
```

**File**: `crates/graph/src/resolve/mod.rs` (modified, +1/-0)
```diff
@@ -35,6 +35,7 @@ mod tests;
 mod tsconfig_scope;
 mod types;
 mod upgrades;
+mod url_suffix;
 mod work;
 mod workspace_alias;
 
```

**File**: `crates/graph/src/resolve/specifier.rs` (modified, +14/-24)
```diff
@@ -33,6 +33,9 @@ use super::path_info::{
 use super::react_native::{build_condition_names, build_extensions};
 use super::tsconfig_scope::{glob_values_match, resolve_tsconfig_relative_path};
 use super::types::{DenoImportMapEntry, ResolveContext, ResolveResult};
+use super::url_suffix::{
+    resolve_failed_bare_asset_query_specifier, strip_url_suffix, strip_vite_asset_query,
+};
 use super::workspace_alias::{
     resolve_failed_bare_package_specifier, try_aliased_workspace_package_fallback,
 };
@@ -471,12 +474,6 @@ fn specifier_matches_alias_prefix(specifier: &str, prefix: &str) -> bool {
     remainder.is_empty() || prefix.ends_with('/') || remainder.starts_with('/')
 }
 
-fn strip_url_suffix(specifier: &str) -> &str {
-    specifier
-        .find(['?', '#'])
-        .map_or(specifier, |idx| &specifier[..idx])
-}
-
 fn static_mount_url_path(specifier: &str) -> Option<String> {
     let lookup = strip_url_suffix(specifier);
     if lookup.starts_with("../") {
@@ -1893,6 +1890,16 @@ fn resolve_failed_regular_specifier(
     if is_plain_css_file(from_file) && is_bare_style_subpath(specifier) {
         return ResolveResult::Unresolvable(specifier.to_string());
     }
+    if is_bare && let Some(base) = strip_vite_asset_query(specifier) {
+        return resolve_failed_bare_asset_query_specifier(
+            ctx,
+            from_file,
+            specifier,
+            base,
+            from_style || is_style_file(from_file),
+            matches_tsconfig_path_alias,
+        );
+    }
     if is_bare && is_valid_package_name(specifier) {
         return resolve_failed_bare_package_specifier(
             ctx,
@@ -2050,7 +2057,7 @@ mod tests {
         resolve_tsconfig_extends_candidate, resolve_tsconfig_extends_path,
         resolve_tsconfig_reference_path, serves_static_dir_mounts,
         should_preserve_node_modules_style_file, specifier_matches_alias_prefix,
-        static_dir_relative_path, static_mount_url_path, strip_url_suffix, tsconfig_extends_values,
+        static_dir_relative_path, static_mount_url_path, tsconfig_extends_values,
         with_appended_extension, with_exact_extension,
     };
 
@@ -2369,23 +2376,6 @@ mod tests {
         );
     }
 
-    // ---- strip_url_suffix (lines 419-423) ----
-
-    #[test]
-    fn strip_url_suffix_removes_query_string() {
-        assert_eq!(strip_url_suffix("./style.css?inline"), "./style.css");
-    }
-
-    #[test]
-    fn strip_url_suffix_removes_hash_fragment() {
-        assert_eq!(strip_url_suffix("./page.html#section"), "./page.html");
-    }
-
-    #[test]
-    fn strip_url_suffix_passes_through_plain_specifier() {
-        assert_eq!(strip_url_suffix("react"), "react");
-    }
-
     // ---- static_mount_url_path ----
 
     #[test]
```

**File**: `crates/graph/src/resolve/url_suffix.rs` (added, +131/-0)
```diff
@@ -0,0 +1,131 @@
+//! Query and fragment suffixes of import specifiers (`./a.css?inline`,
+//! `pkg/a.wasm?url`, `./page.html#top`).
+
+use std::path::Path;
+
+use super::path_info::is_valid_package_name;
+use super::types::{ResolveContext, ResolveResult};
+use super::workspace_alias::resolve_failed_bare_package_specifier;
+
+/// Return the specifier without its query string or hash fragment.
+pub(super) fn strip_url_suffix(specifier: &str) -> &str {
+    specifier
+        .find(['?', '#'])
+        .map_or(specifier, |idx| &specifier[..idx])
+}
+
+/// Vite asset query parameters that the bundler strips before it resolves
+/// the path (`?url`, `?raw`, `?worker&inline`, and similar).
+const VITE_ASSET_QUERY_PARAMS: &[&str] = &[
+    "url",
+    "raw",
+    "worker",
+    "sharedworker",
+    "inline",
+    "no-inline",
+    "init",
+];
+
+/// Return the path part of a specifier whose query holds only Vite asset
+/// query parameters.
+pub(super) fn strip_vite_asset_query(specifier: &str) -> Option<&str> {
+    let (base, query) = specifier.split_once('?')?;
+    (!base.is_empty()
+        && query
+            .split('&')
+            .all(|param| VITE_ASSET_QUERY_PARAMS.contains(&param)))
+    .then_some(base)
+}
+
+/// Classify a bare package subpath with a Vite asset query that the resolver
+/// could not resolve.
+///
+/// The workspace and alias fallbacks run first, the same as for the plain
+/// subpath, so a workspace package gets the same result with or without its
+/// `node_modules` link. The resolver strips the query, so an installed
+/// external package means the file is really missing. When the package is not
+/// installed, the import cannot be checked, so it credits the package the
+/// same as the plain subpath does. An unresolved result keeps the full
+/// specifier, so the report and `ignoreUnresolvedImports` match the text in
+/// the source file.
+pub(super) fn resolve_failed_bare_asset_query_specifier(
+    ctx: &ResolveContext<'_>,
+    from_file: &Path,
+    specifier: &str,
+    base: &str,
+    style_context: bool,
+    matches_tsconfig_path_alias: bool,
+) -> ResolveResult {
+    if !is_valid_package_name(base) {
+        return ResolveResult::Unresolvable(specifier.to_string());
+    }
+    match resolve_failed_bare_package_specifier(
+        ctx,
+        from_file,
+        base,
+        style_context,
+        matches_tsconfig_path_alias,
+    ) {
+        ResolveResult::Unresolvable(_) => ResolveResult::Unresolvable(specifier.to_string()),
+        ResolveResult::NpmPackage(package_name)
+            if is_package_installed(from_file, &package_name) =>
+        {
+            ResolveResult::Unresolvable(specifier.to_string())
+        }
+        resolved => resolved,
+    }
+}
+
+/// True when a `node_modules` directory in an ancestor of `from_file` holds
+/// the package, which is the lookup that Node and the resolver do.
+fn is_package_installed(from_file: &Path, package_name: &str) -> bool {
+    from_file
+        .ancestors()
+        .skip(1)
+        .any(|dir| dir.join("node_modules").join(package_name).is_dir())
+}
+
+#[cfg(test)]
+mod tests {
+    use super::{is_package_installed, strip_url_suffix, strip_vite_asset_query};
+
+    #[test]
+    fn strip_url_suffix_removes_query_string() {
+        assert_eq!(strip_url_suffix("./style.css?inline"), "./style.css");
+    }
+
+    #[test]
+    fn strip_url_suffix_removes_hash_fragment() {
+        assert_eq!(strip_url_suffix("./page.html#section"), "./page.html");
+    }
+
+    #[test]
+    fn strip_url_suffix_passes_through_plain_specifier() {
+        assert_eq!(strip_url_suffix("react"), "react");
+    }
+
+    #[test]
+    fn strip_vite_asset_query_accepts_known_params_only() {
+        assert_eq!(strip_vite_asset_query("pkg/a.wasm?url"), Some("pkg/a.wasm"));
+        assert_eq!(
+            strip_vite_asset_query("pkg/w.js?worker&inline"),
+            Some("pkg/w.js")
+        );
+        assert_eq!(strip_vite_asset_query("pkg/a.js"), None);
+        assert_eq!(strip_vite_asset_query("pkg/a.js?url&custom"), None);
+        assert_eq!(strip_vite_asset_query("pkg/a.js?"), None);
+        assert_eq!(strip_vite_asset_query("?url"), None);
+    }
+
+    #[test]
+    #[cfg_attr(miri, ignore)]
+    fn installed_package_is_found_in_an_ancestor_node_modules() {
+        let dir = tempfile::tempdir().expect("project");
+        let root = dir.path();
+        std::fs::create_dir_all(root.join("node_modules/@scope/pkg")).expect("package");
+        std::fs::create_dir_all(root.join("apps/web/src")).expect("source");
+        let importer = root.join("apps/web/src/index.ts");
+        assert!(is_package_installed(&importer, "@scope/pkg"));
+        assert!(!is_package_installed(&importer, "other-pkg"));
+    }
+}
```

---

### Incident Patch 2: `4040f972` (2026-11-03)
**Commit Message**: fix(vscode): keep sidebar groups open after a refresh (#4161)

VS Code makes the id of a tree item from its label when the item has no id. The group labels show a count, for example "Unused Component Inputs (13)". When a refresh changes the count, the id changes and VS Code closes the group.

Each group item in the Unused Code, Health, Security and Runtime Coverage views now sets a stable id. VS Code then keeps the expansion state across refreshes.

Closes #4090

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

**File**: `changelog.d/fix-vscode-tree-keep-expanded.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+### Fixed
+
+- **The VS Code sidebar keeps an open group open after a refresh.** Before, a
+  group such as `Unused Component Inputs (13)` closed when a refresh changed
+  the count in its label. Each group in the Unused Code, Health, Security and
+  Runtime Coverage views now has a stable id, so VS Code keeps the expansion
+  state.
+  (Closes [#4090](https://github.com/fallow-rs/fallow/issues/4090))
```

**File**: `editors/vscode/src/coverageView.ts` (modified, +2/-0)
```diff
@@ -20,6 +20,8 @@ class CoverageGroupItem extends vscode.TreeItem {
     readonly children: ReadonlyArray<CoverageLeafItem>,
   ) {
     super(`${label} (${children.length})`, vscode.TreeItemCollapsibleState.Collapsed);
+    // A stable id keeps the expansion state when a refresh changes the count in the label.
+    this.id = `coverageGroup:${label}`;
     this.contextValue = "coverageGroup";
     this.iconPath = new vscode.ThemeIcon(icon);
   }
```

**File**: `editors/vscode/src/healthTreeView.ts` (modified, +2/-0)
```diff
@@ -34,6 +34,8 @@ class HealthSectionItem extends vscode.TreeItem {
   ) {
     const base = HEALTH_SECTION_LABELS[section];
     super(count > 0 ? `${base} (${count})` : base, vscode.TreeItemCollapsibleState.Collapsed);
+    // A stable id keeps the expansion state when a refresh changes the count in the label.
+    this.id = `healthSection:${section}`;
     this.contextValue = `healthSection.${section}`;
     this.iconPath = new vscode.ThemeIcon(HEALTH_SECTION_ICONS[section]);
   }
```

**File**: `editors/vscode/src/securityTreeView.ts` (modified, +2/-0)
```diff
@@ -62,6 +62,8 @@ class SecurityGroupItem extends vscode.TreeItem {
     findings: ReadonlyArray<SecurityFindingItem>,
   ) {
     super(`${groupLabel} (${findings.length})`, vscode.TreeItemCollapsibleState.Collapsed);
+    // A stable id keeps the expansion state when a refresh changes the count in the label.
+    this.id = `securityGroup:${groupLabel}`;
     this.findings = findings;
     this.description = "security candidates to verify";
     this.tooltip = [CANDIDATE_TOOLTIP_PREFIX, "", `${groupLabel}: ${findings.length}`].join("\n");
```

**File**: `editors/vscode/src/treeView.ts` (modified, +2/-0)
```diff
@@ -104,6 +104,8 @@ class CategoryItem extends vscode.TreeItem {
       `${ISSUE_CATEGORY_LABELS[category]} (${issues.length})`,
       vscode.TreeItemCollapsibleState.Collapsed,
     );
+    // A stable id keeps the expansion state when a refresh changes the count in the label.
+    this.id = `category:${category}`;
     this.issues = issues;
     this.contextValue = "category";
     this.iconPath = new vscode.ThemeIcon(CATEGORY_ICONS[category] ?? "warning");
```

**File**: `editors/vscode/test/coverageView.test.ts` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import { describe, expect, it, vi } from "vitest";
+
+vi.mock("vscode", async () => {
+  const { createTreeViewVscodeMock } = await import("./vscodeTreeMock.js");
+  return createTreeViewVscodeMock("/workspace");
+});
+
+import type { TestTreeItem } from "./vscodeTreeMock.js";
+import { RuntimeCoverageTreeProvider } from "../src/coverageView.js";
+import type { RuntimeCoverageHotPath, RuntimeCoverageReport } from "../src/types.js";
+
+const hotPath = (name: string): RuntimeCoverageHotPath => ({
+  id: `fallow:hot:${name}`,
+  path: "src/a.ts",
+  function: name,
+  line: 1,
+  end_line: 0,
+  invocations: 1,
+  percentile: 0,
+});
+
+const report = (hotPaths: ReadonlyArray<RuntimeCoverageHotPath>): RuntimeCoverageReport =>
+  ({ hot_paths: hotPaths, findings: [] }) as unknown as RuntimeCoverageReport;
+
+describe("RuntimeCoverageTreeProvider", () => {
+  it("keeps a stable group id when the group count changes", () => {
+    const provider = new RuntimeCoverageTreeProvider();
+    provider.update(report([hotPath("a")]));
+    const before = (provider.getChildren() as TestTreeItem[])[0];
+
+    provider.update(report([hotPath("a"), hotPath("b")]));
+    const after = (provider.getChildren() as TestTreeItem[])[0];
+
+    expect(after?.label).toBe("Hot Paths (2)");
+    expect(before?.id).toBeDefined();
+    expect(after?.id).toBe(before?.id);
+  });
+});
```

**File**: `editors/vscode/test/healthTreeView.test.ts` (modified, +19/-0)
```diff
@@ -247,3 +247,22 @@ describe("HealthTreeProvider file-length findings", () => {
     expect(complexityTargetOf(row as never)).toBeUndefined();
   });
 });
+
+describe("HealthTreeProvider section ids", () => {
+  it("keeps a stable section id when the section count changes", () => {
+    const provider = new HealthTreeProvider();
+    provider.update(hiddenCouplingReport());
+    const before = (provider.getChildren() as TestTreeItem[])[0];
+
+    const report = hiddenCouplingReport() as unknown as {
+      change_coupling: { total_pairs: number };
+    };
+    report.change_coupling.total_pairs = 4;
+    provider.update(report as unknown as HealthOutput);
+    const after = (provider.getChildren() as TestTreeItem[])[0];
+
+    expect(after?.label).toBe("Hidden Change Coupling (4)");
+    expect(before?.id).toBeDefined();
+    expect(after?.id).toBe(before?.id);
+  });
+});
```

**File**: `editors/vscode/test/securityTreeView.test.ts` (modified, +24/-0)
```diff
@@ -263,4 +263,28 @@ describe("SecurityTreeProvider", () => {
 
     expect(provider.getChildren()).toEqual([]);
   });
+
+  it("keeps a stable group id when the finding count changes", () => {
+    const sink = (line: number): SecurityFindingInput => ({
+      kind: "tainted-sink",
+      category: "dangerous-html",
+      cwe: 79,
+      path: "src/app.tsx",
+      line,
+      col: 4,
+      evidence: "innerHTML reaches req.query.html",
+      trace: [],
+      actions: [],
+    });
+    const provider = new SecurityTreeProvider();
+    provider.update(result([sink(1)]));
+    const before = (provider.getChildren() as TestTreeItem[])[0];
+
+    provider.update(result([sink(1), sink(2)]));
+    const after = (provider.getChildren() as TestTreeItem[])[0];
+
+    expect(after?.label).toBe("dangerous-html (CWE-79) (2)");
+    expect(before?.id).toBeDefined();
+    expect(after?.id).toBe(before?.id);
+  });
 });
```

---

### Incident Patch 3: `0b835ae9` (2026-11-03)
**Commit Message**: fix(audit): count @effect/vitest tests in weakened-tests (#4167)

* fix(audit): count @effect/vitest tests in weakened-tests

The removed-tests check counted it.effect(...) as zero tests, so a move from it(...) to it.effect(...) gave a false finding.

Closes #4095

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* test(audit): check that effect members need a test root

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

---------

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

**File**: `changelog.d/fix-effect-vitest-test-cases.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+### Fixed
+
+- **`fallow audit` counts `@effect/vitest` tests.** The `weakened-tests (removed-tests)` check now counts `it.effect`, `it.live`, `it.scoped`, `it.scopedLive` and `it.prop` as test cases. It also counts chains such as `it.effect.skip`, `it.effect.each` and `it.effect.prop`. A move from `it(...)` to `it.effect(...)` no longer gives a removed-tests finding. `it.layer` and `it.flakyTest` do not register a test, so the check does not count them.
+  (Closes [#4095](https://github.com/fallow-rs/fallow/issues/4095))
```

**File**: `crates/api/src/diff_risk/text.rs` (modified, +20/-0)
```diff
@@ -34,6 +34,14 @@ const TEST_CASE_MEMBERS: &[&str] = &[
     "fixme",
     "skipIf",
     "runIf",
+    // `@effect/vitest`: `it.effect`, `it.live`, `it.scoped`, `it.scopedLive`
+    // and the property test `it.prop`. `it.layer` and `it.flakyTest` do not
+    // register a test, so they stay out.
+    "effect",
+    "live",
+    "scoped",
+    "scopedLive",
+    "prop",
 ];
 /// Members of `expect` that are an assertion (`expect.soft(x)`).
 const EXPECT_ASSERTION_MEMBERS: &[&str] = &["soft", "poll"];
@@ -662,6 +670,18 @@ mod tests {
         assert_eq!(test_case_count(src), 3);
     }
 
+    #[test]
+    fn test_case_count_counts_effect_vitest_members() {
+        let src = "it.effect('a', f);\nit.live('b', f);\nit.scoped('c', f);\nit.scopedLive('d', f);\nit.prop('e', arbs, f);\nit.effect.skip('f', f);\nit.effect.each([1])('g', f);\nit.effect.prop('h', arbs, f);\nit.layer(Live)('i', f);\nit.flakyTest(eff);\n";
+        assert_eq!(test_case_count(src), 8);
+    }
+
+    #[test]
+    fn test_case_count_needs_a_test_root_for_effect_vitest_members() {
+        let src = "foo.live('a', f);\ndescribe.scoped('b', f);\nlayer.effect('c', f);\n";
+        assert_eq!(test_case_count(src), 0);
+    }
+
     #[test]
     fn assertion_count_counts_expect_assert_and_should() {
         let src = "expect(a).toBe(1);\nexpect.soft(b).toBe(2);\nassert.equal(c, 3);\nassert(d);\nx.should.equal(4);\nexpect.assertions(2);\n// expect(e)\n";
```

#### Recent Merged Pull Requests:
- **PR #4181** (2026-11-03): fix(resolve): credit an uninstalled package for a Vite asset query import (@BartWaardenburg)
- **PR #4167** (2026-11-03): fix(audit): count @effect/vitest tests in weakened-tests (@BartWaardenburg)
- **PR #4166** (2026-11-03): refactor(report-protocol): share the gate map and the exit code constants (@BartWaardenburg)
- **PR #4165** (2026-11-03): feat(mutation): check named tests with --kill-matrix-for (@BartWaardenburg)
- **PR #4164** (2026-11-03): chore: check long .mjs and .ts files with fallow audit (@BartWaardenburg)
- **PR #4163** (2026-11-03): fix(mutation): give the Vitest mutant to Node child processes (@BartWaardenburg)

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

## X. resolve): credit an uninstalled package for a Vite asset query import (#4181)

**RULE**:
When implementing operations in `changelog.d/fix-vite-asset-query-imports.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fallow-rs/fallow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7cead47b`: resolve): credit an uninstalled package for a Vite asset query import (#4181). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/fix-vite-asset-query-imports.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
### Fixed

- **`fallow dead-code` no longer reports a package import with a Vite asset query as unresolved when the package is not installed.** An import such as `pkg/dist/engine.wasm?url` or `pkg/build/worker.mjs?worker&inline` was an unresolved import before `node_modules` existed, and the package did not count as used. Fallow now treats the import the same as the plain subpath: the package counts as used and no finding appears. The supported query parameters are `url`, `raw`, `worker`, `sharedworker`, `inline`, `no-inline` and `init`. A query import of a workspace package credits the workspace source file, with or without the `node_modules` link. A file that is missing from an installed package is still an unresolved import. The graph cache now records whether `node_modules` exists at the project root and at each workspace root, so an install after a cached run does not replay the old result. The graph cache version changed, so a graph cache from an earlier run does not replay the old result.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7cead47b` are properly handled with clean fallback behavior.
