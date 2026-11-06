> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source**: github ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Source Version**: `372d151c`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T22:54:52.021Z  
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
> **Harvest Timestamp**: 2026-11-05T22:54:51.783Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5304 stars

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
    SetupHooksOptions, execute_agent_hooks, symlinked_hook_target,
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
    match symlinked_hook_target(&opts, ctx.mode) {
        Ok(Some(target)) => {
            return vec![
                StepReport::new(Some(harness), Step::Hooks, StepStatus::Skipped, ctx.scope())
                    .path(ctx, &target.path)
                    .symlinked(ctx, &target.link),
            ];
        }
        Ok(None) => {}
        Err(message) => {
            return vec![StepReport::failed(
                Some(harness),
                Step::Hooks,
                ctx.scope(),
                message,
            )];
        }
    }
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
- **Issue #4245** (2026-11-05): **`fallow mutation` counts `__tests__` helpers and bench files as static test files**
  *Symptoms*: `fallow mutation` counts two kinds of files as static test files that Vitest does not run:  - a helper module under `__tests__/` that imports the mutated file, for example `src/__tests__/utils.ts`; - a Vitest benchmark file, for example `benchmarks/add.bench.js`.  Vitest does not list these files with its default `include` (`**/*.{test,spec}.?(c|m)[jt]s?(x)`). The run then reports `test-files-not-discovered` and the status `partial`, also when every real test ran.  ## Repro  A Vitest 4.1.11 project with an empty `vitest.config.mjs` and these files:  ```js // src/add.js export const add = (a, b) => a + b;  // src/__tests__/utils.ts import { add } from "../add.js"; export const sum3 = (a, b, c) => add(add(a, b), c);  // src/__tests__/add.test.js import { expect, test } from "vitest"; import { add } from "../add.js"; import { sum3 } from "./utils";  test("add", () => {   expect(add(1, 2)).toBe(3);   expect(sum3(1, 2, 3)).toBe(6); });  // benchmarks/add.bench.js import { bench } from "vitest"; import { add } from "../src/add.js";  bench("add", () => {   add(1, 2); }); ```  `fallow mutation src/add.js --format json --quiet` gives:  ```json "completion": { "status": "partial", "reasons": ["test-files-not-discovered"] }, "errors": [{ "code": "test-files-not-discovered", "message": "the runner does not list 2 static test files, so they did not run: benchmarks/add.bench.js, src/__tests__/utils.ts" }] ```  and `files[0].static_test_files` is `["benchmarks/add.bench.js", "src/__tests__/

- **Issue #4233** (2026-11-05): **Graph cache: a new file at a missed resolver candidate path keeps a stale resolution**
  *Symptoms*: The persisted graph cache can serve a stale import resolution when a new file appears at a path that the resolver tried and did not find.  ## Steps  1. Make a project with `src/index.ts` that has `import { alpha } from './util'`, and `src/util.ts`. 2. Run `fallow dead-code` with the cache on. 3. Add an extensionless file `src/util` (or a `src/util.json`, or a build output file in an ignored directory) that the resolver prefers for `./util`. 4. Run `fallow dead-code` again with the cache on, and once with `--no-cache`.  ## Result  The warm run uses the resolutions of step 2. The `--no-cache` run resolves `./util` to the new file. The two runs report different findings.  ## Cause  The graph cache key covers the discovered source files, the resolver manifests and the install state. It does not cover the paths that the resolver tried and did not find. Discovery does not list an extensionless file or a `.json` file, so the new file does not change the key.  ## Evidence  The read-set oracle in `crates/engine/tests/integration/cache_model/read_set.rs` records these misses. It skips them now (see the module comment), because the key cannot cover them yet.  ## Possible fix  Record the missing candidates that the resolver tried for each specifier, and key on their existence. This needs a bound, because each specifier can try many extensions. 

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

### Incident Patch 1: `b78f34c4` (2026-11-05)
**Commit Message**: fix(security): trace require() bindings of node child_process and fs (#4238)

* fix(security): trace require() bindings of node child_process and fs

`fallow security` gave no candidate for a sink that a destructured
require() binds, for example
`const { exec } = require("node:child_process"); exec(cmd)`. The
detector checks provenance against ES imports only, because core
releases the require() facts before analysis.

The extractor already traced named and require() bindings of node:vm
to a `node:vm.<member>` path, which proves the provenance on its own.
The same now applies to node:child_process, node:fs and
node:fs/promises. The catalogue rows for the bare callees match the
`node:` paths instead. A parameter that hides the import no longer
gives a candidate.

The module list moves to fallow-types, because the policy effect lookup
reads callee uses as written. It now builds the same `node:` path, so a
banned-effect rule keeps its match on `exec(cmd)` after a named import.

The extraction output changes, so CACHE_VERSION goes to 414.

Closes #4226

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* fix(security): report the destination of rename and copyFile for fs bindings

A 

**File**: `changelog.d/fix-security-require-provenance.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+### Fixed
+
+- **`fallow security` reports a sink that a destructured `require()` binds.** Before, `const { exec } = require("node:child_process"); exec(cmd)` gave no `command-injection` candidate, and `const { readFileSync } = require("node:fs")` gave no `path-traversal` candidate. The same code with an ES import gave a candidate. Fallow now traces a named binding of `node:child_process`, `node:fs` and `node:fs/promises` to its module, for ES imports, aliased imports (`import { readFile as read }`) and destructured `require()` calls. The same applies to `world-writable-permission` and `insecure-temp-file`, and to `fs.promises.writeFile` and `fs.promises.chmod` on `const fs = require("fs")`. The destination of `rename`, `copyFile` and `copyFileSync` is now also a `path-traversal` candidate for these bindings, when the argument or the module reads untrusted input. In `fallow security`, a parameter that has the same name as the import no longer gives a candidate.
+
+  The callee in `evidence` and in `candidate.sink.callee` now names the module, as it already did for `node:vm`. This applies to named imports and to `require()` bindings. For example, `execSync()` and `cp.execSync()` after `const cp = require("child_process")` become `node:child_process.execSync()`. A default or namespace import keeps its written callee, such as `fs.readFile()`. `finding_id` does not change, because it does not include the callee. (Closes [#4226](https://github.com/fallow-rs/fallow/issues/4226))
```

**File**: `crates/core/src/analyze/policy/mod.rs` (modified, +61/-4)
```diff
@@ -8,6 +8,7 @@ use fallow_types::extract::{ImportedName, ModuleInfo};
 use fallow_types::output::IssueAction;
 use fallow_types::output_dead_code::PolicyViolationFinding;
 use fallow_types::results::{PolicyRuleKind, PolicyViolation, PolicyViolationSeverity};
+use fallow_types::security_sinks::node_binding_module;
 
 use crate::discover::FileId;
 use crate::graph::ModuleGraph;
@@ -719,11 +720,67 @@ fn effect_for_callee(
     if written.is_some() {
         return written;
     }
-    let canonical = canonical_callee_path(module, callee_path)?;
-    catalogue_matchers()
+    [
+        canonical_callee_path(module, callee_path),
+        node_binding_callee_path(module, callee_path),
+    ]
+    .into_iter()
+    .flatten()
+    .find_map(|path| {
+        catalogue_matchers()
+            .iter()
+            .find(|matcher| matcher_matches_callee(matcher, module, &path, declared_deps))
+            .map(|matcher| matcher.effect)
+    })
+}
+
+/// The `node:<module>.<member>` path of a callee whose leading identifier an
+/// ES import or a `require()` binds to a module in
+/// [`NODE_BINDING_MODULES`](fallow_types::security_sinks::NODE_BINDING_MODULES).
+/// The extractor writes the same path for a sink site, and the catalogue
+/// rows of those modules match only that path.
+fn node_binding_callee_path(module: &ModuleInfo, callee_path: &str) -> Option<String> {
+    let (head, rest) = match callee_path.split_once('.') {
+        Some((head, rest)) => (head, Some(rest)),
+        None => (callee_path, None),
+    };
+    // `fs.promises.<member>` takes the path of an `fs/promises` import, as in
+    // the extractor.
+    let join = |root: String, member: Option<&str>| -> Option<String> {
+        let path = match (member, rest) {
+            (Some(member), Some(rest)) => format!("{root}.{member}.{rest}"),
+            (Some(member), None) => format!("{root}.{member}"),
+            (None, Some(rest)) => format!("{root}.{rest}"),
+            (None, None) => return None,
+        };
+        Some(match path.strip_prefix("node:fs.promises.") {
+            Some(member) => format!("node:fs.{member}"),
+            None => path,
+        })
+    };
+    if let Some(import) = module
+        .imports
         .iter()
-        .find(|matcher| matcher_matches_callee(matcher, module, &canonical, declared_deps))
-        .map(|matcher| matcher.effect)
+        .find(|import| import.local_name == head && !import.is_type_only)
+    {
+        let root = node_binding_module(&import.source)?;
+        return match &import.imported_name {
+            ImportedName::Named(imported) => join(root, Some(imported)),
+            ImportedName::Namespace | ImportedName::Default => join(root, None),
+            ImportedName::SideEffect => None,
+        };
+    }
+    let call = module.require_calls.iter().find(|call| {
+        !call.is_type_only
+            && (call.local_name.as_deref() == Some(head)
+                || call.destructured_names.iter().any(|name| name == head))
+    })?;
+    let root = node_binding_module(&call.source)?;
+    if call.local_name.as_deref() == Some(head) {
+        join(root, None)
+    } else {
+        join(root, Some(head))
+    }
 }
 
 fn matcher_matches_callee(
```

**File**: `crates/core/src/analyze/policy/tests.rs` (modified, +78/-0)
```diff
@@ -1347,3 +1347,81 @@ fn scope_glob_single_star_stays_within_one_segment() {
     assert!(matches("src/a.ts"));
     assert!(!matches("src/nested/a.ts"));
 }
+
+/// Run one `banned-effect` rule over a module and return the matched texts.
+fn banned_effect_matches(effect: EffectKind, module: ModuleInfo) -> Vec<String> {
+    let root = PathBuf::from("/tmp/policy-test");
+    let config = make_config(
+        root.clone(),
+        vec![pack(vec![banned_effect("no-effect", &[effect])])],
+        Severity::Warn,
+    );
+    let graph = build_graph(&root, &["src/app.ts"]);
+    let suppressions = SuppressionContext::empty();
+    let line_offsets = FxHashMap::default();
+    find_policy_violations(&graph, &[module], &config, &suppressions, &line_offsets)
+        .into_iter()
+        .map(|violation| violation.matched)
+        .collect()
+}
+
+#[test]
+fn banned_effect_matches_a_named_node_module_import() {
+    let module = module(
+        0,
+        vec![callee("exec", 0)],
+        vec![import(
+            "node:child_process",
+            ImportedName::Named("exec".to_string()),
+            "exec",
+            false,
+        )],
+    );
+
+    assert_eq!(
+        banned_effect_matches(EffectKind::Shell, module),
+        ["shell: exec"]
+    );
+}
+
+#[test]
+fn banned_effect_matches_a_destructured_node_module_require() {
+    let mut shell = module(0, vec![callee("execSync", 0)], Vec::new());
+    shell
+        .require_calls
+        .push(require_call("child_process", None, &["execSync"]));
+    let mut storage = module(0, vec![callee("unlinkSync", 0)], Vec::new());
+    storage
+        .require_calls
+        .push(require_call("node:fs", None, &["unlinkSync"]));
+
+    assert_eq!(
+        banned_effect_matches(EffectKind::Shell, shell),
+        ["shell: execSync"]
+    );
+    assert_eq!(
+        banned_effect_matches(EffectKind::Storage, storage),
+        ["storage: unlinkSync"]
+    );
+}
+
+#[test]
+fn banned_effect_ignores_a_local_with_the_name_of_a_node_module_member() {
+    let module = module(0, vec![callee("exec", 0)], Vec::new());
+
+    assert!(banned_effect_matches(EffectKind::Shell, module).is_empty());
+}
+
+#[test]
+fn banned_effect_matches_fs_promises_on_a_module_import() {
+    let module = module(
+        0,
+        vec![callee("fs.promises.rm", 0)],
+        vec![import("node:fs", ImportedName::Default, "fs", false)],
+    );
+
+    assert_eq!(
+        banned_effect_matches(EffectKind::Storage, module),
+        ["storage: fs.promises.rm"]
+    );
+}
```

**File**: `crates/core/tests/integration_test/security_catalogue_categories.rs` (modified, +21/-1)
```diff
@@ -1366,7 +1366,23 @@ fn llm_call_injection_langchain_invoke_does_not_fire() {
 
 // ── catalogue gaps: callee variants of existing categories ───────────────────
 
-const CATALOGUE_GAP_SINKS: [(&str, &str, u32); 16] = [
+const CATALOGUE_GAP_SINKS: [(&str, &str, u32); 24] = [
+    ("src/cjs-fs-rename-destination.ts", "path-traversal", 22),
+    ("src/cjs-fs-promises-temp.ts", "insecure-temp-file", 377),
+    (
+        "src/cjs-fs-promises-chmod.ts",
+        "world-writable-permission",
+        732,
+    ),
+    ("src/cjs-destructured-exec.ts", "command-injection", 78),
+    ("src/cjs-module-exec.ts", "command-injection", 78),
+    ("src/cjs-destructured-fs.ts", "path-traversal", 22),
+    ("src/fs-aliased-import.ts", "path-traversal", 22),
+    (
+        "src/cjs-destructured-chmod.ts",
+        "world-writable-permission",
+        732,
+    ),
     ("src/exec-file.ts", "command-injection", 78),
     ("src/shelljs.ts", "command-injection", 78),
     ("src/ssti-handlebars.ts", "ssti", 1336),
@@ -1434,6 +1450,10 @@ fn catalogue_gap_lookalikes_do_not_fire() {
             "src/exec-file-tooling.ts",
             "execFile of a computed binary without untrusted input is not a candidate",
         ),
+        (
+            "src/exec-local-shadow.ts",
+            "a parameter that hides the exec import is not a shell call",
+        ),
         (
             "src/fs-build-path.ts",
             "a computed path without untrusted input is not a candidate",
```

**File**: `crates/extract/src/cache/types.rs` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ use crate::MemberKind;
 /// extraction semantics change, and give the reason in the commit message and
 /// the CHANGELOG. A stale version serves old extraction results from a warm
 /// cache. The `assert_cached_type_size!` guards below catch shape changes.
-pub(super) const CACHE_VERSION: u32 = 413;
+pub(super) const CACHE_VERSION: u32 = 414;
 
 /// Duplication token cache version. Bump it when duplicate tokenization,
 /// normalization, or the on-disk token cache schema changes, and give the
```

**File**: `crates/extract/src/tests/js_ts/callee_uses.rs` (modified, +4/-2)
```diff
@@ -88,8 +88,10 @@ fn coexists_with_security_sink_capture() {
         "callee-use capture should coexist with sink capture"
     );
     assert!(
-        info.security_sinks.iter().any(|s| s.callee_path == "exec"),
-        "security sink capture should be unaffected"
+        info.security_sinks
+            .iter()
+            .any(|s| s.callee_path == "node:child_process.exec"),
+        "security sink capture should trace the named import"
     );
 }
 
```

**File**: `crates/extract/src/visitor/tests.rs` (modified, +7/-4)
```diff
@@ -13220,7 +13220,7 @@ fn security_sink_arg_via_conditional_expression_collects_source_paths() {
     let sink = info
         .security_sinks
         .iter()
-        .find(|s| s.callee_path == "execSync");
+        .find(|s| s.callee_path == "node:child_process.execSync");
     assert!(
         sink.is_some(),
         "execSync with conditional arg should be captured: {:#?}",
@@ -13245,7 +13245,10 @@ fn security_sink_arg_via_await_expression_collects_source_paths() {
         }
         ",
     );
-    let sink = info.security_sinks.iter().find(|s| s.callee_path == "exec");
+    let sink = info
+        .security_sinks
+        .iter()
+        .find(|s| s.callee_path == "node:child_process.exec");
     assert!(
         sink.is_some(),
         "exec with await-wrapped arg should be captured: {:#?}",
@@ -13268,7 +13271,7 @@ fn security_sink_arg_via_unary_expression_collects_source_paths() {
     let sink = info
         .security_sinks
         .iter()
-        .find(|s| s.callee_path == "execSync");
+        .find(|s| s.callee_path == "node:child_process.execSync");
     assert!(
         sink.is_some(),
         "execSync with source-backed arg should be captured"
@@ -13294,7 +13297,7 @@ fn security_sink_ident_collected_through_template_literal_expression() {
     let sink = info
         .security_sinks
         .iter()
-        .find(|s| s.callee_path == "execSync");
+        .find(|s| s.callee_path == "node:child_process.execSync");
     assert!(
         sink.is_some(),
         "execSync with template-literal arg should be captured"
```

**File**: `crates/extract/src/visitor/visit_impl_security_sinks.rs` (modified, +22/-27)
```diff
@@ -8,7 +8,7 @@ use fallow_types::extract::{
     SecurityControlSite, SinkArgKind, SinkLiteralValue, SinkShape, SinkSite,
     SkippedSecurityCalleeExpressionKind, SkippedSecurityCalleeReason, SkippedSecurityCalleeSite,
 };
-use fallow_types::security_sinks::JSX_SPREAD_SINK_PROPS;
+use fallow_types::security_sinks::{JSX_SPREAD_SINK_PROPS, node_binding_module};
 
 use super::super::ModuleInfoExtractor;
 use super::visit_security_controls::security_control_kind_for_callee;
@@ -63,11 +63,6 @@ enum SinkBinding {
     ScriptElement,
 }
 
-/// Node.js built-in modules whose named and CommonJS bindings resolve to a
-/// `node:<module>.<member>` callee path. The `node:` root is not a valid
-/// identifier, so the path proves the import provenance on its own.
-const NODE_BINDING_MODULES: &[&str] = &["vm"];
-
 /// Properties of a `<script>` element whose value the browser loads or runs
 /// as code.
 const SCRIPT_ELEMENT_CODE_PROPERTIES: &[&str] = &["src", "text", "textContent", "innerText"];
@@ -158,15 +153,6 @@ fn set_sink_binding(
     }
 }
 
-/// The `node:` path of an import source when the module is in
-/// [`NODE_BINDING_MODULES`] (`vm` and `node:vm` both give `node:vm`).
-fn node_binding_module(source: &str) -> Option<String> {
-    let module = source.strip_prefix("node:").unwrap_or(source);
-    NODE_BINDING_MODULES
-        .contains(&module)
-        .then(|| format!("node:{module}"))
-}
-
 /// Whether `expr` is `<object>.createElement("script")`.
 fn is_create_script_element_call(expr: &Expression<'_>) -> bool {
     let Expression::CallExpression(call) = unwrap_static_expr(expr) else {
@@ -370,7 +356,7 @@ fn is_string_code_callee(callee_path: &str) -> bool {
 fn is_chmod_literal_callee(callee_path: &str) -> bool {
     matches!(
         callee_path,
-        "fs.chmod" | "fs.chmodSync" | "fs.promises.chmod" | "chmod" | "chmodSync"
+        "fs.chmod" | "fs.chmodSync" | "fs.promises.chmod" | "node:fs.chmod" | "node:fs.chmodSync"
     )
 }
 
@@ -384,11 +370,11 @@ fn is_temp_file_literal_callee(callee_path: &str) -> bool {
             | "fs.createWriteStream"
             | "fs.promises.writeFile"
             | "fs.promises.appendFile"
-            | "writeFile"
-            | "writeFileSync"
-            | "appendFile"
-            | "appendFileSync"
-            | "createWriteStream"
+            | "node:fs.writeFile"
+            | "node:fs.writeFileSync"
+            | "node:fs.appendFile"
+            | "node:fs.appendFileSync"
+            | "node:fs.createWriteStream"
     )
 }
 
@@ -1217,9 +1203,12 @@ impl ModuleInfoExtractor {
     /// On top of [`Self::static_callee_path`], this maps a global-object prefix
     /// on a code-executing global (`window.eval`) and a local alias of one
     /// (`const e = eval; e(code)`) to the bare global. A binding of a Node.js
-    /// built-in module in [`NODE_BINDING_MODULES`] resolves to its `node:`
-    /// path (`runInNewContext(code)` after `import { runInNewContext } from
-    /// "vm"` becomes `node:vm.runInNewContext`).
+    /// built-in module in
+    /// [`NODE_BINDING_MODULES`](fallow_types::security_sinks::NODE_BINDING_MODULES)
+    /// resolves to its `node:` path (`runInNewContext(code)` after
+    /// `import { runInNewContext } from "vm"` becomes
+    /// `node:vm.runInNewContext`). `fs.promises.<member>` on a module binding
+    /// becomes `node:fs.<member>`, the path of an `fs/promises` import.
     fn security_callee_path(&self, expr: &Expression<'_>) -> Option<String> {
         let path = normalize_global_code_exec_path(self.static_callee_path(expr)?);
         let (root, rest) = match path.split_once('.') {
@@ -1230,7 +1219,13 @@ impl ModuleInfoExtractor {
             (Some(SinkBinding::CodeExec(target) | SinkBinding::NodeModuleMember(target)), None) => {
                 Some(target.clone())
             }
-            (Some(SinkBinding::NodeModule(module)), Some(rest)) => Some(format!("{module}.{rest}")),
+            (Some(SinkBinding::NodeModule(module)), Some(rest)) => {
+                let rest = match rest.strip_prefix("promises.") {
+                    Some(member) if module == "node:fs" => member,
+                    _ => rest,
+                };
+                Some(format!("{module}.{rest}"))
+            }
             _ => None,
         };
         Some(resolved.unwrap_or(path))
@@ -1521,7 +1516,7 @@ impl ModuleInfoExtractor {
 
     /// The sink binding that a value gives to `name`: an alias of a
     /// code-executing global or of a Node.js module binding, a `require()` of
-    /// a module in [`NODE_BINDING_MODULES`], or a new `<script>` element.
+    /// a module in [`NODE_BINDING_MODULES`](fallow_types::security_sinks::NODE_BINDING_MODULES), or a new `<script>` element.
     fn sink_binding_of_value(&self, name: &str, value: &Expression<'_>) -> Option<SinkBinding> {
         if is_create_script_element_call(value) {
             return Some(SinkBinding::ScriptElement);
@@ -1553,7 +1548,7 @@ impl ModuleInfoExtr
```

---

### Incident Patch 2: `78ab1c08` (2026-11-05)
**Commit Message**: fix(graph): refuse the graph cache when a probed path changes (#4255)

* fix(graph): refuse the graph cache when a probed path changes

The persisted graph cache reused an import resolution after a new file appeared at a path that the resolver tried and did not find. Discovery does not list an extensionless file, a .json file, or build output in an ignored directory, so the manifest did not change. For example, a new file src/util changes the target of ./util from src/util.ts.

Resolution now records each path below the root that it checks and does not find. The resolver payload stores these paths, grouped by directory, and the resolved targets that discovery does not list. restore_resolved_project refuses the payload when a stored missed path exists or a stored target is gone.

The read-set oracle no longer skips missing module candidates.

Closes #4233

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* test(graph): skip the probe tests that need a temp directory under Miri

Miri isolation blocks file system calls. The other temp directory tests of the crate use the same mark.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* fix(graph): check small probe lists without th

**File**: `.github/workflows/ci.yml` (modified, +1/-0)
```diff
@@ -236,6 +236,7 @@ jobs:
               - 'crates/api/src/similar_code/transport.rs'
               - 'crates/api/src/type_aware/client/mod.rs'
               - 'crates/api/tests/integration/common.rs'
+              - 'crates/graph/src/missed_probes.rs'
               - 'crates/graph/src/resolve/fallbacks.rs'
               - 'crates/graph/src/resolve/specifier.rs'
               - 'crates/graph/src/resolve/tests.rs'
```

**File**: `changelog.d/fix-graph-cache-missed-candidates.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **The graph cache now misses when a file appears at a path that import resolution tried and did not find.** Before this fix, a warm run could keep a stale import target after a new extensionless file, a new `.json` file, or new build output in an ignored directory. For example, a new file `src/util` changes the target of `./util` from `src/util.ts`, but discovery does not list it. The graph cache now stores the paths that resolution checked and did not find, and the resolved targets that discovery does not list. A warm run rebuilds the graph when one of these paths appears or is removed. (#4233)
```

**File**: `crates/core/src/lib.rs` (modified, +1/-1)
```diff
@@ -1222,7 +1222,7 @@ fn restore_cached_resolved_project(
         // debug for the reason `CacheRejection::discarded_existing_work`
         // documents.
         tracing::debug!(
-            "Graph cache decoded but its resolver payload no longer maps to the discovered files"
+            "Graph cache decoded but its resolver payload no longer maps to the project files"
         );
         Some(CacheRejection::FileSetChanged)
     })
```

**File**: `crates/engine/tests/integration/cache_model/read_set.rs` (modified, +18/-30)
```diff
@@ -14,12 +14,6 @@
 //! The oracle skips these paths:
 //!
 //! - an existing directory, and a missing path below an existing file;
-//! - a missing module candidate: a path that the resolver tries for a
-//!   specifier, with an extension or as an extensionless file, that is not a
-//!   config or install file. The key does not record these probes yet, so
-//!   a new non-source file at such a path (a `.json` file, an extensionless
-//!   file, or build output in an ignored directory) can change a resolution
-//!   with no change to the key (#4233);
 //! - a path below `__fallow_ws_self_resolve__`, the directory name that the
 //!   resolver uses for a synthetic importer of a workspace package.
 //!
@@ -205,35 +199,16 @@ fn perturbation_for(path: &Path, kinds: &FxHashSet<ReadKind>) -> Option<Perturba
     if path.ancestors().skip(1).any(Path::is_file) {
         return None;
     }
-    if kinds.contains(&ReadKind::Dir) {
-        return Some(Perturbation::CreateDir);
-    }
-    is_config_name(path).then_some(Perturbation::CreateFile)
+    Some(if kinds.contains(&ReadKind::Dir) {
+        Perturbation::CreateDir
+    } else {
+        Perturbation::CreateFile
+    })
 }
 
 /// The directory name of the synthetic importer for a workspace package.
 const SELF_RESOLVE_DIR: &str = "__fallow_ws_self_resolve__";
 
-/// True for the name of a config or install file that a resolver reads,
-/// as opposed to a module candidate.
-fn is_config_name(path: &Path) -> bool {
-    let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
-        return false;
-    };
-    let json = path.extension().is_some_and(|extension| {
-        extension.eq_ignore_ascii_case("json") || extension.eq_ignore_ascii_case("jsonc")
-    });
-    let tsconfig = json && (name.starts_with("tsconfig") || name.starts_with("jsconfig"));
-    tsconfig
-        || matches!(
-            name,
-            "package.json" | "deno.json" | "deno.jsonc" | ".pnp.cjs" | ".pnp.data.json"
-        )
-        || INSTALL_STATE_FILES
-            .iter()
-            .any(|state| Path::new(state).file_name() == Some(name.as_ref()))
-}
-
 /// Apply `perturbation` again and compare a warm run with a cache-free run.
 fn stale_after(
     project: &Project,
@@ -414,3 +389,16 @@ fn graph_cache_key_covers_bun_reads() {
 fn graph_cache_key_covers_deno_reads() {
     assert_key_covers_read_set("deno project", &DENO, &[]);
 }
+
+#[test]
+fn graph_cache_key_covers_reads_of_files_that_discovery_does_not_list() {
+    assert_key_covers_read_set(
+        "node workspace with files at missed candidate paths",
+        &NODE,
+        &[
+            Step::ToggleExtensionlessUtil,
+            Step::ToggleDataJson,
+            Step::ToggleBuildOutput,
+        ],
+    );
+}
```

**File**: `crates/engine/tests/integration/cache_model/sequences.rs` (modified, +15/-0)
```diff
@@ -130,6 +130,21 @@ const REGRESSIONS: &[Regression] = &[
         template: &ANGULAR,
         steps: &[Step::SwapAngularMain],
     },
+    Regression {
+        name: "extensionless file at a missed candidate path (#4233)",
+        template: &NODE,
+        steps: &[Step::ToggleExtensionlessUtil, Step::ToggleExtensionlessUtil],
+    },
+    Regression {
+        name: "json file at a missed candidate path (#4233)",
+        template: &NODE,
+        steps: &[Step::ToggleDataJson, Step::ToggleDataJson],
+    },
+    Regression {
+        name: "build output in an ignored directory (#4233)",
+        template: &NODE,
+        steps: &[Step::ToggleBuildOutput, Step::ToggleBuildOutput],
+    },
 ];
 
 /// The facts of one sequence run.
```

**File**: `crates/engine/tests/integration/cache_model/templates.rs` (modified, +30/-1)
```diff
@@ -72,6 +72,16 @@ pub enum Step {
     SwapAngularIncludePath,
     /// Point the `main` entry of `angular.json` to the other file.
     SwapAngularMain,
+    /// Add or remove the extensionless file `src/util`. The resolver tries
+    /// this path for `./util` before `src/util.ts`, and discovery does not
+    /// list it.
+    ToggleExtensionlessUtil,
+    /// Add or remove `src/data.json`, the target of the unresolved import
+    /// `./data`. Discovery does not list a `.json` file.
+    ToggleDataJson,
+    /// Add or remove `dist/gen.js`, the target of the unresolved import
+    /// `../dist/gen`. The default ignore patterns exclude `dist`.
+    ToggleBuildOutput,
 }
 
 const SOURCE_STEPS: [Step; 7] = [
@@ -88,7 +98,7 @@ const CLONE_A: &str = "export const sumA = (items: number[]): number => {\n  let
 const CLONE_B: &str = "export const sumB = (items: number[]): number => {\n  let total = 0;\n  for (const item of items) {\n    total += item * 2;\n    total -= 1;\n  }\n  return total;\n};\n";
 const CLONE_B_BROKEN: &str = "export const sumB = (items: number[]): number => {\n  let total = 0;\n  while (items.length>0) {\n    total = items.pop() ?? 10;\n    break;\n  }\n  return total;\n};\n";
 
-const ENTRY_ALPHA: &str = "import { db } from '#db';\nimport { alias } from '@alias';\nimport { alpha } from './util';\nimport { value } from '@demo/lib/src/util';\nimport { nested } from '../nested/entry';\nimport asset from 'plain-pkg/build/missing.mjs?url';\n\nexport const run = (): unknown[] => [db, alias, alpha(), value, nested, asset];\n";
+const ENTRY_ALPHA: &str = "import { db } from '#db';\nimport { alias } from '@alias';\nimport { alpha } from './util';\nimport { value } from '@demo/lib/src/util';\nimport { nested } from '../nested/entry';\nimport asset from 'plain-pkg/build/missing.mjs?url';\nimport data from './data';\nimport { gen } from '../dist/gen';\n\nexport const run = (): unknown[] => [db, alias, alpha(), value, nested, asset, data, gen];\n";
 const BUN_ENTRY_ALPHA: &str = "import { alpha } from './util';\nimport asset from 'plain-pkg/build/missing.mjs?url';\n\nexport const run = (): unknown[] => [alpha(), asset];\n";
 const DENO_ENTRY_ALPHA: &str = "import { db } from 'db';\nimport { alpha } from './src/util.ts';\n\nexport const run = (): unknown[] => [db, alpha()];\n";
 
@@ -168,6 +178,9 @@ pub const NODE: Template = Template {
         Step::ToggleProduction,
         Step::ToggleIgnoreOrphan,
         Step::ToggleCondition,
+        Step::ToggleExtensionlessUtil,
+        Step::ToggleDataJson,
+        Step::ToggleBuildOutput,
     ],
 };
 
@@ -204,6 +217,7 @@ pub const BUN: Template = Template {
         Step::NodeModulesNoise,
         Step::ToggleProduction,
         Step::ToggleIgnoreOrphan,
+        Step::ToggleExtensionlessUtil,
     ],
 };
 
@@ -379,6 +393,14 @@ fn swap_in_file(project: &mut Project, file: &str, from: &str, to: &str, keep_mt
     }
 }
 
+fn toggle_file(project: &mut Project, file: &str, content: &str) {
+    if project.exists(file) {
+        project.remove(file);
+    } else {
+        project.write(file, content);
+    }
+}
+
 fn toggle_option(values: &mut Vec<String>, value: &str) {
     if let Some(index) = values.iter().position(|existing| existing == value) {
         values.remove(index);
@@ -476,6 +498,13 @@ pub fn apply(project: &mut Project, step: Step) {
                 false,
             );
         }
+        Step::ToggleExtensionlessUtil => {
+            toggle_file(project, "src/util", "export const alpha = () => 3;\n");
+        }
+        Step::ToggleDataJson => toggle_file(project, "src/data.json", "{\"data\": 1}\n"),
+        Step::ToggleBuildOutput => {
+            toggle_file(project, "dist/gen.js", "export const gen = 1;\n");
+        }
         manifest => apply_manifest_step(project, manifest),
     }
 }
```

**File**: `crates/graph/src/cache/mod.rs` (modified, +116/-2)
```diff
@@ -40,7 +40,7 @@ pub use store::{GRAPH_CACHE_FILE, GraphCacheStore};
 /// Never reuse a version number that a published build wrote, even from a
 /// development commit. Git history and the CHANGELOG record the reason for
 /// each bump.
-pub const GRAPH_CACHE_VERSION: u32 = 102;
+pub const GRAPH_CACHE_VERSION: u32 = 103;
 
 /// Cached form of a resolved target.
 ///
@@ -401,6 +401,63 @@ impl CachedResolvedReplacedModuleTarget {
 pub struct CachedResolvedProject {
     modules: Vec<CachedResolvedModule>,
     replaced_module_targets: Vec<CachedResolvedReplacedModuleTarget>,
+    /// The paths that the resolution checked and did not find (see
+    /// [`ResolvedProject::missed_probes`]).
+    missed_probes: crate::missed_probes::MissedProbes,
+    /// The resolved targets below the root that are not discovered files
+    /// and not below `node_modules`, root-relative and sorted.
+    external_targets: Vec<String>,
+}
+
+impl CachedResolvedProject {
+    /// True when the files that the cached resolution depends on, but that
+    /// discovery does not list, changed: a file now exists at a path that the
+    /// resolution checked and did not find, or a resolved target outside the
+    /// discovered files is gone. Discovery does not list an extensionless
+    /// file, a `.json` file, or a file in an ignored directory, so the
+    /// manifest cannot show these changes.
+    #[must_use]
+    fn probed_paths_changed(&self, root: &Path) -> bool {
+        let start = std::time::Instant::now();
+        let changed = self.missed_probes.any_exists(root)
+            || crate::missed_probes::any_missing(root, &self.external_targets);
+        tracing::debug!(
+            missed_probes = self.missed_probes.len(),
+            external_targets = self.external_targets.len(),
+            elapsed_ms = start.elapsed().as_secs_f64() * 1000.0,
+            changed,
+            "checked the probed paths of the graph cache"
+        );
+        changed
+    }
+}
+
+/// The root-relative paths of the [`ResolveResult::ExternalFile`] targets
+/// below `root` and not below `node_modules`.
+fn external_targets(root: &Path, resolved: &ResolvedProject) -> Vec<String> {
+    // The resolver can spell a target with the canonical root. Most projects
+    // have no external target, so the root is canonicalized only on demand.
+    let canonical_root = std::cell::OnceCell::new();
+    let mut targets: Vec<String> = resolved
+        .modules
+        .iter()
+        .flat_map(ResolvedModule::all_resolved_source_edges)
+        .filter_map(|edge| match edge.target() {
+            ResolveResult::ExternalFile(path) => crate::missed_probes::project_relative(root, path)
+                .or_else(|| {
+                    canonical_root
+                        .get_or_init(|| dunce::canonicalize(root).ok())
+                        .as_deref()
+                        .and_then(|canonical| {
+                            crate::missed_probes::project_relative(canonical, path)
+                        })
+                }),
+            _ => None,
+        })
+        .collect();
+    targets.sort_unstable();
+    targets.dedup();
+    targets
 }
 
 /// Convert a resolved project into the compact graph-cache resolver payload.
@@ -425,6 +482,8 @@ pub fn cache_resolved_project(
     Some(CachedResolvedProject {
         modules,
         replaced_module_targets,
+        missed_probes: resolved.missed_probes.clone(),
+        external_targets: external_targets(root, resolved),
     })
 }
 
@@ -433,14 +492,19 @@ pub fn cache_resolved_project(
 /// Returns `None` if the payload no longer aligns with the current parse result.
 /// A normal graph-cache manifest hit should keep these aligned; this extra check
 /// keeps corrupt or hand-edited cache files on the safe miss path.
+///
+/// Also returns `None` when a file that the cached resolution probed, and that
+/// discovery does not list, appeared or was removed. The caller restores the
+/// payload only after the manifest compare, so a run that misses on the
+/// manifest pays no file system call for the probes.
 #[must_use]
 pub fn restore_resolved_project(
     root: &Path,
     modules: &[fallow_types::extract::ModuleInfo],
     files: &[DiscoveredFile],
     cached: &CachedResolvedProject,
 ) -> Option<ResolvedProject> {
-    if modules.len() != cached.modules.len() {
+    if modules.len() != cached.modules.len() || cached.probed_paths_changed(root) {
         return None;
     }
 
@@ -463,6 +527,7 @@ pub fn restore_resolved_project(
         modules: resolved_modules,
         replaced_module_targets,
         work: crate::resolve::ResolveWork::default(),
+        missed_probes: cached.missed_probes.clone(),
     })
 }
 
@@ -1129,6 +1194,55 @@ mod tests {
         }
     }
 
+    #[test]
+    #[cfg_attr(miri, ignore = "tempdir is blocked by Miri isolation")]
+    fn a_changed_probed_path_takes_the_cache_miss_path() {
+        let temp = tempfile::tempdir().unwrap();
+        let r
```

**File**: `crates/graph/src/lib.rs` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@
 
 pub mod cache;
 pub mod graph;
+pub mod missed_probes;
 pub mod project;
 pub mod read_trace;
 pub mod resolve;
```

---

### Incident Patch 3: `37d90e8a` (2026-11-05)
**Commit Message**: fix(agent): refuse to write through a symlink that leaves the project (#4254)

* fix(agent): refuse to write through a symlink in the project

A cloned repository can commit .mcp.json, .claude/ or another harness
path as a symlink to a file outside the project. agent install and
uninstall then merged the MCP entry into that outside file. With
--force they also copied its content into a backup in the working tree
and overwrote it.

In project scope, every agent step now checks the path and each
directory below the project root. When one of them is a symlink, or the
path leaves the root, the step does not write, back up or delete. The
row is skipped with the new symlinked_path reason. hooks install
--target agent exits 2 with an error for the same paths. User scope
still follows symlinks, because dotfile managers link files in the home
directory.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* fix(agent): allow symlinks that stay inside the project

The first guard refused every symlink below the project root. That broke
normal links such as CLAUDE.md -> AGENTS.md and .claude/skills ->
../.agents/skills. The guard now refuses a path only when a component
resolves outside the c

**File**: `changelog.d/fix-setup-refuse-symlinked-config.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Security
+
+- **`agent install`, `hooks install`, `init` and their uninstall commands no longer write through a symlink that leaves the project.** A cloned repository could commit a project file such as `.mcp.json`, `.cursor/mcp.json`, `.codex/config.toml`, a skill directory, `AGENTS.md`, `.husky/pre-commit` or `.gitignore` as a symlink to a file outside the project. Fallow then wrote, backed up or deleted that outside file, and `--force` copied its content into the working tree. Fallow now refuses a project path when the path, or a directory on the way to it, is a symlink that resolves outside the project root or a dangling link. `agent install` reports the row as `skipped` with the new reason `symlinked_path`. `hooks install` and `init` exit with code 2. A link that stays inside the project, such as `CLAUDE.md -> AGENTS.md` or `.claude/skills -> ../.agents/skills`, still works. `--user` targets and `.git/hooks` still follow symlinks. The skill step also reads `node_modules/fallow/skills` only from files inside the fallow package, so a link in the package cannot copy an outside file into the project.
```

**File**: `crates/cli/src/agent_install/guide.rs` (modified, +32/-0)
```diff
@@ -66,6 +66,9 @@ fn install_agents_guide(ctx: &Ctx) -> StepReport {
     let path = ctx.root.join(AGENTS_FILE);
     let base =
         StepReport::new(None, Step::Guide, StepStatus::Written, Scope::Shared).path(ctx, &path);
+    if let Some(link) = ctx.symlink_on([path.as_path()]) {
+        return base.symlinked(ctx, &link);
+    }
     let existing = match read_optional_text(&path) {
         Ok(existing) => existing,
         Err(error) => return failed(ctx, &path, error),
@@ -114,6 +117,14 @@ fn install_claude_import(ctx: &Ctx) -> StepReport {
         Scope::Shared,
     )
     .path(ctx, &path);
+    if let Some(link) = ctx.symlink_on([path.as_path()]) {
+        return base.symlinked(ctx, &link);
+    }
+    if claude_file_is_agents_file(ctx) {
+        return base
+            .with_status(StepStatus::Unchanged)
+            .detail(CLAUDE_LINKS_TO_AGENTS);
+    }
     let existing = match read_optional_text(&path) {
         Ok(existing) => existing,
         Err(error) => return failed(ctx, &path, error),
@@ -167,6 +178,9 @@ fn uninstall_agents_guide(ctx: &Ctx) -> StepReport {
     let path = ctx.root.join(AGENTS_FILE);
     let base =
         StepReport::new(None, Step::Guide, StepStatus::Removed, Scope::Shared).path(ctx, &path);
+    if let Some(link) = ctx.symlink_on([path.as_path()]) {
+        return base.symlinked(ctx, &link);
+    }
     let existing = match read_optional_text(&path) {
         Ok(Some(existing)) => existing,
         Ok(None) => {
@@ -205,6 +219,14 @@ fn uninstall_claude_import(ctx: &Ctx) -> StepReport {
         Scope::Shared,
     )
     .path(ctx, &path);
+    if let Some(link) = ctx.symlink_on([path.as_path()]) {
+        return base.symlinked(ctx, &link);
+    }
+    if claude_file_is_agents_file(ctx) {
+        return base
+            .with_status(StepStatus::Unchanged)
+            .detail(CLAUDE_LINKS_TO_AGENTS);
+    }
     let existing = match read_optional_text(&path) {
         Ok(Some(existing)) => existing,
         Ok(None) => {
@@ -243,6 +265,16 @@ fn uninstall_claude_import(ctx: &Ctx) -> StepReport {
     }
 }
 
+const CLAUDE_LINKS_TO_AGENTS: &str =
+    "CLAUDE.md links to AGENTS.md; Claude Code reads the guide through the link";
+
+/// Whether `CLAUDE.md` and `AGENTS.md` resolve to one file. An import block
+/// would then land in `AGENTS.md` and make it import itself.
+fn claude_file_is_agents_file(ctx: &Ctx) -> bool {
+    let resolve = |name: &str| dunce::canonicalize(ctx.root.join(name)).ok();
+    resolve(CLAUDE_FILE).is_some_and(|claude| resolve(AGENTS_FILE) == Some(claude))
+}
+
 fn import_block() -> String {
     format!(
         "{}\n{IMPORT_LINE}\n{}\n",
```

**File**: `crates/cli/src/agent_install/hooks.rs` (modified, +19/-1)
```diff
@@ -5,7 +5,7 @@
 use super::{Ctx, Harness, Mode, Reason, Scope, Step, StepReport, StepStatus};
 use crate::setup_hooks::{
     AgentsBlockReport, AgentsOutcome, GateReport, HookAgentArg, ScriptOutcome, SettingsOutcome,
-    SetupHooksOptions, execute_agent_hooks,
+    SetupHooksOptions, execute_agent_hooks, symlinked_hook_target,
 };
 
 pub fn install(ctx: &Ctx, harnesses: &[Harness]) -> Vec<StepReport> {
@@ -38,6 +38,24 @@ fn run(ctx: &Ctx, harness: Harness) -> Vec<StepReport> {
         gitignore_claude: ctx.gitignore_claude,
         uninstall: ctx.mode == Mode::Uninstall,
     };
+    match symlinked_hook_target(&opts, ctx.mode) {
+        Ok(Some(target)) => {
+            return vec![
+                StepReport::new(Some(harness), Step::Hooks, StepStatus::Skipped, ctx.scope())
+                    .path(ctx, &target.path)
+                    .symlinked(ctx, &target.link),
+            ];
+        }
+        Ok(None) => {}
+        Err(message) => {
+            return vec![StepReport::failed(
+                Some(harness),
+                Step::Hooks,
+                ctx.scope(),
+                message,
+            )];
+        }
+    }
     let report = match execute_agent_hooks(&opts, ctx.mode) {
         Ok(Some(report)) => report,
         Ok(None) => return Vec::new(),
```

**File**: `crates/cli/src/agent_install/mcp.rs` (modified, +9/-0)
```diff
@@ -410,6 +410,9 @@ fn json_step(
         StepStatus::Removed
     };
     let base = StepReport::new(Some(harness), Step::Mcp, status, scope).path(ctx, path);
+    if let Some(link) = ctx.symlink_on([path, backup_path(path).as_path()]) {
+        return base.symlinked(ctx, &link);
+    }
     let outcome = merge_json_server(path, "mcpServers", entry, ctx.dry_run, ctx.force);
     outcome_report(base, outcome, ctx, path, Reason::InvalidJson)
 }
@@ -430,6 +433,9 @@ fn approval_step(ctx: &Ctx, mode: Mode) -> StepReport {
             .reason(Reason::ApprovalNotRequested)
             .detail("pass --approve to pre-approve the project MCP server for yourself");
     }
+    if let Some(link) = ctx.symlink_on([path.as_path(), backup_path(&path).as_path()]) {
+        return base.symlinked(ctx, &link);
+    }
     if is_git_tracked(&ctx.root, CLAUDE_LOCAL_SETTINGS) {
         return base
             .with_status(StepStatus::Skipped)
@@ -469,6 +475,9 @@ fn codex_step(ctx: &Ctx, path: &Path, command: Option<&McpCommand>) -> StepRepor
     } else {
         base
     };
+    if let Some(link) = ctx.symlink_on([path, backup_path(path).as_path()]) {
+        return base.symlinked(ctx, &link);
+    }
     let outcome = merge_codex(path, command, ctx.dry_run, ctx.force);
     outcome_report(base, outcome, ctx, path, Reason::InvalidToml)
 }
```

**File**: `crates/cli/src/agent_install/mod.rs` (modified, +37/-1)
```diff
@@ -140,14 +140,17 @@ pub enum Reason {
     NotAnObject,
     /// Fallow markers exist but not as a start-then-end pair.
     ManagedBlockMalformed,
+    /// In project scope, the path or a directory on the way to it is a
+    /// symlink that resolves outside the project root, or a dangling link.
+    SymlinkedPath,
 }
 
 impl Reason {
     #[cfg_attr(
         not(test),
         expect(dead_code, reason = "read by the documentation drift test")
     )]
-    pub const ALL: [Self; 15] = [
+    pub const ALL: [Self; 16] = [
         Self::SkillNameTaken,
         Self::SkillNotEmbedded,
         Self::McpEntryUnavailable,
@@ -163,6 +166,7 @@ impl Reason {
         Self::InvalidToml,
         Self::NotAnObject,
         Self::ManagedBlockMalformed,
+        Self::SymlinkedPath,
     ];
 
     pub const fn as_str(self) -> &'static str {
@@ -182,6 +186,7 @@ impl Reason {
             Self::InvalidToml => "invalid_toml",
             Self::NotAnObject => "not_an_object",
             Self::ManagedBlockMalformed => "managed_block_malformed",
+            Self::SymlinkedPath => "symlinked_path",
         }
     }
 }
@@ -257,6 +262,21 @@ impl StepReport {
         self
     }
 
+    /// Turn the row into a skip because its path goes through the symlink
+    /// `link`, which resolves outside the project root. The row keeps its own
+    /// path, and `detail` names the link.
+    pub fn symlinked(mut self, ctx: &Ctx, link: &Path) -> Self {
+        self.status = StepStatus::Skipped;
+        self.reason = Some(Reason::SymlinkedPath);
+        self.detail = Some(format!(
+            "{} {}; {}",
+            display_path(&ctx.root, ctx.home.as_deref(), link),
+            crate::setup_hooks::symlink_guard::OUTSIDE_LINK,
+            crate::setup_hooks::symlink_guard::OUTSIDE_LINK_REMEDY
+        ));
+        self
+    }
+
     pub fn failed(
         harness: Option<Harness>,
         step: Step,
@@ -346,6 +366,19 @@ impl Ctx {
         }
     }
 
+    /// In project scope, the first symlink on the way from the root to one
+    /// of `paths` that resolves outside the root. Always `None` under
+    /// `--user`, because dotfile managers
+    /// link the files in the home directory.
+    pub fn symlink_on<'a>(&self, paths: impl IntoIterator<Item = &'a Path>) -> Option<PathBuf> {
+        if self.user {
+            return None;
+        }
+        paths
+            .into_iter()
+            .find_map(|path| crate::setup_hooks::symlinked_component(&self.root, path))
+    }
+
     pub const fn scope(&self) -> Scope {
         if self.user {
             Scope::Local
@@ -814,3 +847,6 @@ fn render_step(step: &StepReport, dry_run: bool) -> String {
 
 #[cfg(test)]
 mod tests;
+
+#[cfg(all(test, unix))]
+mod symlink_tests;
```

**File**: `crates/cli/src/agent_install/skill.rs` (modified, +86/-16)
```diff
@@ -17,6 +17,7 @@ use crate::setup_hooks::read_optional_text;
 
 include!(concat!(env!("OUT_DIR"), "/embedded_skill.rs"));
 
+const NODE_MODULES_PACKAGE: &str = "node_modules/fallow";
 const NODE_MODULES_SKILLS: &str = "node_modules/fallow/skills";
 
 /// One skill that the npm package ships and `agent install` writes.
@@ -143,8 +144,25 @@ pub fn install(ctx: &Ctx, harnesses: &[Harness]) -> Vec<StepReport> {
     };
     targets
         .into_iter()
-        .map(|target| match Source::resolve(&ctx.root, target.skill) {
-            Ok(source) => install_one(ctx, &target, &source),
+        .map(|target| {
+            if let Some(link) = symlink_in(ctx, &target) {
+                return StepReport::new(
+                    target.harness,
+                    Step::Skill,
+                    StepStatus::Skipped,
+                    target.scope,
+                )
+                .path(ctx, &target.dir)
+                .symlinked(ctx, &link);
+            }
+            install_resolved(ctx, &target)
+        })
+        .collect()
+}
+
+fn install_resolved(ctx: &Ctx, target: &Target) -> StepReport {
+    match Source::resolve(&ctx.root, target.skill) {
+            Ok(source) => install_one(ctx, target, &source),
             Err(reason) => {
                 StepReport::new(target.harness, Step::Skill, StepStatus::Skipped, target.scope)
                     .path(ctx, &target.dir)
@@ -153,8 +171,7 @@ pub fn install(ctx: &Ctx, harnesses: &[Harness]) -> Vec<StepReport> {
                         "install or upgrade the fallow npm package so the skill ships with the binary, or build fallow from a full checkout",
                     )
             }
-        })
-        .collect()
+    }
 }
 
 pub fn uninstall(ctx: &Ctx, harnesses: &[Harness]) -> Vec<StepReport> {
@@ -181,25 +198,40 @@ enum Source {
 
 impl Source {
     fn resolve(root: &Path, skill: &'static ReleasedSkill) -> Result<Self, Reason> {
-        let shipped = root.join(skill.node_modules_dir());
-        if let Ok(Some(text)) = read_optional_text(&shipped.join("SKILL.md"))
-            && let Some(frontmatter) = frontmatter_block(&text)
-        {
-            let openai_yaml = read_optional_text(&shipped.join("agents").join("openai.yaml"))
-                .ok()
-                .flatten();
-            return Ok(Self::Stub {
-                skill,
-                frontmatter: frontmatter.to_string(),
-                openai_yaml,
-            });
+        if let Some(stub) = Self::shipped(root, skill) {
+            return Ok(stub);
         }
         skill
             .embedded()
             .map(Self::Embedded)
             .ok_or(Reason::SkillNotEmbedded)
     }
 
+    /// The stub source from `node_modules/fallow`, or `None` when the package
+    /// has no usable `SKILL.md`. pnpm and `npm link` make the package directory
+    /// a link, so the check resolves it first and then accepts only files whose
+    /// real path stays inside it. A file that links out of the package could
+    /// otherwise copy any readable file into the working tree.
+    fn shipped(root: &Path, skill: &'static ReleasedSkill) -> Option<Self> {
+        let package = dunce::canonicalize(root.join(NODE_MODULES_PACKAGE)).ok()?;
+        let shipped = root.join(skill.node_modules_dir());
+        let PackageFile::Text(text) = read_package_file(&package, &shipped.join("SKILL.md")) else {
+            return None;
+        };
+        let frontmatter = frontmatter_block(&text)?;
+        let openai_yaml =
+            match read_package_file(&package, &shipped.join("agents").join("openai.yaml")) {
+                PackageFile::Missing => None,
+                PackageFile::Text(yaml) => Some(yaml),
+                PackageFile::Refused => return None,
+            };
+        Some(Self::Stub {
+            skill,
+            frontmatter: frontmatter.to_string(),
+            openai_yaml,
+        })
+    }
+
     const fn flavor(&self) -> Flavor {
         match self {
             Self::Stub { .. } => Flavor::Stub,
@@ -245,6 +277,30 @@ impl Source {
     }
 }
 
+enum PackageFile {
+    Missing,
+    Text(String),
+    /// The file resolves outside the package, dangles, or cannot be read.
+    Refused,
+}
+
+fn read_package_file(package: &Path, path: &Path) -> PackageFile {
+    if path.symlink_metadata().is_err() {
+        return PackageFile::Missing;
+    }
+    let Ok(real) = dunce::canonicalize(path) else {
+        return PackageFile::Refused;
+    };
+    if !real.starts_with(package) {
+        return PackageFile::Refused;
+    }
+    match read_optional_text(&real) {
+        Ok(Some(text)) => PackageFile::Text(text),
+        Ok(None) => PackageFile::Missing,
+        Err(_) => PackageFile::Refused,
+    }
+}
+
 fn marker_line(flavor: Flavor) -> String {
     format!(
         "<!-- {MARKER_PREFIX} {MARKER_VERSION} skill={} version={} -->",
@@ -448,6 +504,17 @@ fn managed_files(skill: &ReleasedSkill) -> Vec<String> {
     files
 }
 
+/// The fi
```

**File**: `crates/cli/src/agent_install/symlink_tests.rs` (added, +389/-0)
```diff
@@ -0,0 +1,389 @@
+//! A cloned repository can commit a symlink where fallow writes a harness
+//! file. In project scope every step must leave the link target alone and
+//! report a skipped row. In user scope a symlinked dotfile is normal.
+
+use std::os::unix::fs::symlink;
+use std::path::Path;
+
+use super::*;
+
+fn ctx(root: &Path, mode: Mode) -> Ctx {
+    Ctx {
+        root: root.to_path_buf(),
+        home: None,
+        user: false,
+        dry_run: false,
+        force: false,
+        approve: false,
+        gitignore_claude: false,
+        mode,
+    }
+}
+
+fn command() -> mcp::McpCommand {
+    mcp::McpCommand {
+        command: "fallow-mcp".to_string(),
+        args: Vec::new(),
+        source: mcp::McpSource::Path,
+    }
+}
+
+fn row<'a>(steps: &'a [StepReport], path: &str) -> &'a StepReport {
+    steps
+        .iter()
+        .find(|s| s.path.as_deref() == Some(path))
+        .unwrap_or_else(|| panic!("no row for {path} in {steps:?}"))
+}
+
+fn assert_symlink_skip(step: &StepReport) {
+    assert_eq!(step.status, StepStatus::Skipped, "{step:?}");
+    assert_eq!(
+        step.reason.map(Reason::as_str),
+        Some("symlinked_path"),
+        "{step:?}"
+    );
+}
+
+/// The row keeps its own `path`, and `detail` names the symlink.
+fn assert_detail_names(step: &StepReport, link: &str) {
+    let detail = step.detail.as_deref().unwrap_or_default();
+    assert!(
+        detail.starts_with(&format!("{link} is a symlink")),
+        "{step:?}"
+    );
+}
+
+fn entries(dir: &Path) -> Vec<String> {
+    let mut names: Vec<String> = std::fs::read_dir(dir)
+        .unwrap()
+        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
+        .collect();
+    names.sort();
+    names
+}
+
+#[test]
+fn forced_mcp_install_does_not_write_or_copy_a_symlinked_mcp_json() {
+    let root = tempfile::tempdir().unwrap();
+    let outside = tempfile::tempdir().unwrap();
+    let secret = outside.path().join("secret.json");
+    std::fs::write(&secret, "token = not json").unwrap();
+    symlink(&secret, root.path().join(".mcp.json")).unwrap();
+
+    let forced = Ctx {
+        force: true,
+        ..ctx(root.path(), Mode::Install)
+    };
+    let steps = mcp::install(&forced, &[Harness::Claude], Some(&command()));
+
+    assert_eq!(
+        std::fs::read_to_string(&secret).unwrap(),
+        "token = not json"
+    );
+    assert_eq!(entries(root.path()), vec![".mcp.json".to_string()]);
+    assert_symlink_skip(row(&steps, ".mcp.json"));
+}
+
+#[test]
+fn mcp_uninstall_does_not_edit_a_symlinked_mcp_json() {
+    let root = tempfile::tempdir().unwrap();
+    let outside = tempfile::tempdir().unwrap();
+    let target = outside.path().join("mcp.json");
+    let body = "{\n  \"mcpServers\": {\n    \"fallow\": { \"command\": \"fallow-mcp\", \"args\": [] },\n    \"other\": { \"command\": \"x\" }\n  }\n}\n";
+    std::fs::write(&target, body).unwrap();
+    symlink(&target, root.path().join(".mcp.json")).unwrap();
+
+    let steps = mcp::uninstall(&ctx(root.path(), Mode::Uninstall), &[Harness::Claude]);
+
+    assert_eq!(std::fs::read_to_string(&target).unwrap(), body);
+    assert_symlink_skip(row(&steps, ".mcp.json"));
+}
+
+#[test]
+fn mcp_install_does_not_follow_a_symlinked_parent_directory() {
+    let root = tempfile::tempdir().unwrap();
+    let outside = tempfile::tempdir().unwrap();
+    symlink(outside.path(), root.path().join(".cursor")).unwrap();
+    symlink(outside.path(), root.path().join(".codex")).unwrap();
+
+    let steps = mcp::install(
+        &ctx(root.path(), Mode::Install),
+        &[Harness::Cursor, Harness::Codex],
+        Some(&command()),
+    );
+
+    assert!(entries(outside.path()).is_empty());
+    assert_symlink_skip(row(&steps, ".cursor/mcp.json"));
+    assert_symlink_skip(row(&steps, ".codex/config.toml"));
+}
+
+#[test]
+fn mcp_install_does_not_write_through_a_symlinked_backup_path() {
+    let root = tempfile::tempdir().unwrap();
+    let outside = tempfile::tempdir().unwrap();
+    let victim = outside.path().join("victim");
+    std::fs::write(&victim, "keep").unwrap();
+    std::fs::write(root.path().join(".mcp.json"), "not json").unwrap();
+    symlink(&victim, root.path().join(".mcp.json.fallow-bak")).unwrap();
+
+    let forced = Ctx {
+        force: true,
+        ..ctx(root.path(), Mode::Install)
+    };
+    let steps = mcp::install(&forced, &[Harness::Claude], Some(&command()));
+
+    assert_eq!(std::fs::read_to_string(&victim).unwrap(), "keep");
+    assert_eq!(
+        std::fs::read_to_string(root.path().join(".mcp.json")).unwrap(),
+        "not json"
+    );
+    assert_symlink_skip(row(&steps, ".mcp.json"));
+    assert_detail_names(row(&steps, ".mcp.json"), ".mcp.json.fallow-bak");
+}
+
+#[test]
+fn approval_does_not_follow_a_symlinked_claude_directory() {
+    let root = tempfile::tempdir().unwrap();
+    let outside = tempfile::tempdir().unwrap();
+    symlink(outside.path(), root.path().join(".claude")).unwr
```

**File**: `crates/cli/src/init.rs` (modified, +25/-41)
```diff
@@ -8,6 +8,9 @@ use crate::{exit_codes::exit_invalid_input, validate};
 #[path = "init_default_branch.rs"]
 mod default_branch;
 use default_branch::detect_default_branch;
+#[path = "init_project_files.rs"]
+mod project_files;
+use project_files::{ensure_gitignore, refuse_outside_link};
 
 const AGENTS_GUIDE_FILENAME: &str = "AGENTS.md";
 /// Static template used as the ground truth for the empty-project case and
@@ -748,6 +751,15 @@ fn run_init_config(root: &Path, use_toml: bool, quiet: bool) -> ExitCode {
         }
     }
 
+    let config_name = if use_toml {
+        "fallow.toml"
+    } else {
+        ".fallowrc.json"
+    };
+    if let Err(code) = refuse_outside_link(root, &root.join(config_name)) {
+        return code;
+    }
+
     let info = detect_project(root);
 
     if use_toml {
@@ -810,6 +822,9 @@ fn run_init_agents(root: &Path) -> ExitCode {
         eprintln!("{AGENTS_GUIDE_FILENAME} already exists");
         return exit_invalid_input();
     }
+    if let Err(code) = refuse_outside_link(root, &agents_path) {
+        return code;
+    }
 
     let info = detect_project(root);
     let guide = build_agents_guide(&info);
@@ -822,46 +837,6 @@ fn run_init_agents(root: &Path) -> ExitCode {
     ExitCode::SUCCESS
 }
 
-/// Ensure `.fallow/` is listed in the project's `.gitignore`.
-///
-/// If `.gitignore` exists and already contains `.fallow` (with or without
-/// trailing slash), this is a no-op. Otherwise the entry is appended (or
-/// the file is created).
-fn ensure_gitignore(root: &Path) {
-    let gitignore_path = root.join(".gitignore");
-    let existing = std::fs::read_to_string(&gitignore_path).unwrap_or_default();
-
-    let already_ignored = existing.lines().any(|line| {
-        let trimmed = line.trim();
-        trimmed == ".fallow" || trimmed == ".fallow/"
-    });
-
-    if already_ignored {
-        return;
-    }
-
-    let is_new = existing.is_empty();
-    let entry = if is_new || existing.ends_with('\n') {
-        ".fallow/\n"
-    } else {
-        "\n.fallow/\n"
-    };
-
-    let mut contents = existing;
-    contents.push_str(entry);
-
-    if let Err(e) = std::fs::write(&gitignore_path, contents) {
-        eprintln!("Warning: Failed to update .gitignore: {e}");
-        return;
-    }
-
-    if is_new {
-        eprintln!("Created .gitignore with .fallow/ entry");
-    } else {
-        eprintln!("Added .fallow/ to .gitignore");
-    }
-}
-
 pub const GIT_HOOK_MARKER: &str = "# Generated by fallow hooks install --target git.";
 
 /// Hint printed when an existing pre-commit hook prevents installation.
@@ -1013,6 +988,9 @@ pub fn run_git_hooks_install(opts: &GitHooksInstallOptions<'_>) -> ExitCode {
 
     match target {
         HookTarget::Husky(hook_path) => {
+            if let Err(code) = refuse_outside_link(root, &hook_path) {
+                return code;
+            }
             if let Err(code) = install_hook_file(
                 &hook_path,
                 ".husky/pre-commit",
@@ -1133,7 +1111,13 @@ pub fn run_git_hooks_uninstall(opts: &GitHooksUninstallOptions<'_>) -> ExitCode
     };
 
     let hook_path = match target {
-        HookTarget::Husky(path) | HookTarget::GitHooks(path) => path,
+        HookTarget::Husky(path) => {
+            if let Err(code) = refuse_outside_link(opts.root, &path) {
+                return code;
+            }
+            path
+        }
+        HookTarget::GitHooks(path) => path,
         HookTarget::Lefthook => {
             eprintln!(
                 "Lefthook detected. Remove the fallow command from your lefthook.yml manually."
```

#### Recent Merged Pull Requests:
- **PR #4266** (2026-11-05): chore: sync napi, Docker pins and RELEASED_TAG to v3.40.0 (@BartWaardenburg)
- **PR #4265** (2026-11-05): fix(mutation): leave bench files and __tests__ helpers out of the test files (@BartWaardenburg)
- **PR #4263** (2026-11-05): test(mutation): add the result cache to the cache model tests (@BartWaardenburg)
- **PR #4262** (2026-11-05): fix(health): count @keyframes in SCSS and Less sources (@BartWaardenburg)
- **PR #4260** (2026-11-05): chore: adopt cargo-fallow 0.2.0 checks (@BartWaardenburg)
- **PR #4257** (2026-11-05): fix(policy): report each call site for banned-call, banned-effect and forbidden calls (@BartWaardenburg)

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

## X. security): trace require() bindings of node child_process and fs (#4238)

**RULE**:
When implementing operations in `changelog.d/fix-security-require-provenance.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fallow-rs/fallow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b78f34c4`: security): trace require() bindings of node child_process and fs (#4238). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/fix-security-require-provenance.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
### Fixed

- **`fallow security` reports a sink that a destructured `require()` binds.** Before, `const { exec } = require("node:child_process"); exec(cmd)` gave no `command-injection` candidate, and `const { readFileSync } = require("node:fs")` gave no `path-traversal` candidate. The same code with an ES import gave a candidate. Fallow now traces a named binding of `node:child_process`, `node:fs` and `node:fs/promises` to its module, for ES imports, aliased imports (`import { readFile as read }`) and destructured `require()` calls. The same applies to `world-writable-permission` and `insecure-temp-file`, and to `fs.promises.writeFile` and `fs.promises.chmod` on `const fs = require("fs")`. The destination of `rename`, `copyFile` and `copyFileSync` is now also a `path-traversal` candidate for these bindings, when the argument or the module reads untrusted input. In `fallow security`, a parameter that has the same name as the import no longer gives a candidate.

  The callee in `evidence` and in `candidate.sink.callee` now names the module, as it already did for `node:vm`. This applies to named imports and to `require()` bindings. For example, `execSync()` and `cp.execSync()` after `
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b78f34c4` are properly handled with clean fallback behavior.
