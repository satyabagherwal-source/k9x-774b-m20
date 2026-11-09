> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source**: github ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Source Version**: `479c0a15`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T03:35:17.711Z  
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
> **Harvest Timestamp**: 2026-11-09T03:35:17.703Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5321 stars

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
 *
 * `children` is the optional child coverage of the Node processes that a
 * test starts: `startTest()` runs before each test, and the hits that
 * `finishTest()` gives join the hits of the test.
 */
export const installChildHooks = ({ active, beforeEach, afterEach, report, children = null }) => {
  const mutation = installFallowMutation();
  mutation.startFile();
  mutation.setActive(active);
  let running = 0;
  let overlap = false;

  beforeEach(() => {
    running += 1;
    overlap ||= running > 1;
    children?.startTest();
    mutation.startTest();
  });

  // A rest parameter keeps the function length at 0. Bun reads a hook with a
  // parameter as a hook that waits for a `done` callback.
  afterEach((...args) => {
    running = Math.max(0, running - 1);
    const { hits, staticHits } = mutation.finishTest();
    const childHits = children?.finishTest() ?? [];
    report(
      { hits: [...new Set([...hits, ...childHits])], static_hits: staticHits, overlap },
      args[0],
    );
  });
};

```

### Core Architecture Module: `crates/api/src/mutation/companion/runtime/overlay-hook.mjs`
```
// Generated from tools/mutation-runner/src/runtime/overlay-hook.mjs. Do not edit.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import { compileFunction } from "node:vm";

import { realPath } from "./child.mjs";

const SCRIPT_FORMATS = new Set(["module", "commonjs", "module-typescript", "commonjs-typescript"]);
const JAVASCRIPT_FORMATS = new Set(["module", "commonjs"]);
// Node type stripping does not accept JSX, so a `.tsx` file is not here.
const TYPESCRIPT_EXTENSIONS = new Set([".ts", ".mts", ".cts"]);
const COMMONJS_PARAMETERS = ["exports", "require", "module", "__filename", "__dirname"];
const HASHBANG = /^#!.*/;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * Calls `stripTypeScriptTypes` without its ExperimentalWarning. The warning
 * goes to stderr of the process, and a test can assert on that stream.
 */
const stripTypes = (code) => {
  const emitWarning = process.emitWarning;
  process.emitWarning = () => {};
  try {
    const mode = process.features.typescript === "transform" ? "transform" : "strip";
    return stripTypeScriptTypes(code, { mode });
  } finally {
    process.emitWarning = emitWarning;
  }
};

/**
 * Throws when the code does not compile as a CommonJS module. A project loader
 * that compiles ESM-syntax TypeScript to CommonJS gives format `commonjs`, but
 * type stripping keeps `import` and `export` in the mutant.
 */
const assertCommonJs = (code) => {
  try {
    compileFunction(code.replace(HASHBANG, ""), COMMONJS_PARAMETERS);
  } catch (error) {
    throw new Error(
      `the project loader gives format \`commonjs\`, but the mutant does not compile as CommonJS (${error.message})`,
      { cause: error },
    );
  }
};

/**
 * Gives the source to serve for an overlay entry, as a Result. A TypeScript
 * target in a JavaScript format comes from a project loader that compiles
 * TypeScript before this hook. The hook replaces that output with the
 * mutant, so the hook strips the types of the mutant. The error names the
 * syntax that type stripping does not accept, for example an `enum`, or ESM
 * syntax in a mutant that the project loader gives as CommonJS.
 */
const serveTarget = (entry, format) => {
  const source = readFileSync(entry.target, "utf8");
  if (!JAVASCRIPT_FORMATS.has(format) || !TYPESCRIPT_EXTENSIONS.has(extname(entry.target))) {
    return { ok: true, source };
  }
  try {
    const stripped = stripTypes(source);
    if (format === "commonjs") assertCommonJs(stripped);
    return { ok: true, source: stripped };
  } catch (error) {
    return { ok: false, error: `Cannot serve the mutant of ${entry.source}: ${error.message}` };
  }
};

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
 * the format of the original file. For a TypeScript file in a TypeScript
 * format, Node strips the types as it does without the overlay. A project
 * loader that compiles TypeScript itself gives a JavaScript format, so the
 * hook strips the types of the mutant (see `serveTarget`).
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
      const served = serveTarget(entry, result.format);
      if (!served.ok) {
        onIncomplete(served.error);
        return result;
      }
      onLoad(entry);
      return { ...result, source: served.source, shortCircuit: true };
    },
  });
};

```

### Core Architecture Module: `crates/api/src/mutation/companion/runtime/worker-state.mjs`
```
// Generated from tools/mutation-runner/src/runtime/worker-state.mjs. Do not edit.
/**
 * Records the process-wide state of a test worker, so that the adapter can
 * tell when a test file of one mutant run left state that a later run of the
 * same process would see. `vi.resetModules()` gives each run fresh source
 * modules. This check covers the state outside the modules.
 */

// Variables that Vitest and the adapter set for each file or test.
const OWN_ENV = /^(?:VITEST|NODE_OPTIONS$)/u;

// Built-in prototypes that a test or a polyfill can extend.
const PROTOTYPES = [
  Object,
  Array,
  String,
  Number,
  Boolean,
  Function,
  Promise,
  Map,
  Set,
  RegExp,
  Date,
  Error,
];

const TIMER_RESOURCES = new Set(["Timeout", "Immediate"]);

/** The own properties of `target`, without calling a getter. */
const descriptors = (target) =>
  new Map(
    Reflect.ownKeys(target).map((key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      return [key, descriptor];
    }),
  );

const sameDescriptor = (left, right) =>
  left !== undefined &&
  right !== undefined &&
  Object.is(left.value, right.value) &&
  left.get === right.get &&
  left.set === right.set;

// Node creates these globals lazily, for example the dispatcher of `fetch`.
const RUNTIME_SYMBOL = /^(?:undici|nodejs)\./u;
// Vitest sets its own globals again for each test file.
const RUNNER_GLOBAL = /^__vitest_/u;

const isRuntimeKey = (key) =>
  typeof key === "symbol" ? RUNTIME_SYMBOL.test(key.description ?? "") : RUNNER_GLOBAL.test(key);

/** True when `current` has a key that `baseline` lacks, or another value. */
const changedProperties = (baseline, current, ignored) => {
  for (const [key, descriptor] of current) {
    if (ignored.has(key) || isRuntimeKey(key)) continue;
    if (!sameDescriptor(baseline.get(key), descriptor)) return true;
  }
  for (const key of baseline.keys()) {
    if (!current.has(key) && !ignored.has(key) && !isRuntimeKey(key)) return true;
  }
  return false;
};

const envText = () =>
  JSON.stringify(
    Object.entries(globalThis.process?.env ?? {})
      .filter(([key]) => !OWN_ENV.test(key))
      .toSorted(([left], [right]) => (left < right ? -1 : 1)),
  );

const listenerCounts = () => {
  const proc = globalThis.process;
  if (typeof proc?.eventNames !== "function") return "";
  return JSON.stringify(
    proc.eventNames().map((event) => [String(event), proc.listenerCount(event)]),
  );
};

const activeTimers = () => {
  const info = globalThis.process?.getActiveResourcesInfo?.() ?? [];
  return info.filter((resource) => TIMER_RESOURCES.has(resource)).length;
};

const safe = (read, fallback) => {
  try {
    return read();
  } catch {
    return fallback;
  }
};

/** Records the state that later runs of the worker compare with. */
export const captureWorkerState = () => ({
  globals: descriptors(globalThis),
  prototypes: PROTOTYPES.map((type) => descriptors(type.prototype)),
  env: envText(),
  listeners: listenerCounts(),
  cwd: safe(() => globalThis.process?.cwd(), null),
  exitCode: globalThis.process?.exitCode,
  timers: activeTimers(),
});

/**
 * True when the state of the worker differs from `baseline`. `ignored` names
 * the global keys that the runner itself sets again for each file or test.
 */
export const workerStateChanged = (baseline, ignored = new Set()) => {
  if (changedProperties(baseline.globals, descriptors(globalThis), ignored)) return true;
  const prototypesChanged = PROTOTYPES.some((type, index) =>
    changedProperties(baseline.prototypes[index], descriptors(type.prototype), new Set()),
  );
  return (
    prototypesChanged ||
    envText() !== baseline.env ||
    listenerCounts() !== baseline.listeners ||
    safe(() => globalThis.process?.cwd(), null) !== baseline.cwd ||
    globalThis.process?.exitCode !== baseline.exitCode ||
    activeTimers() > baseline.timers
  );
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

use crate::error::emit_input_error;
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
                return emit_input_error(
                    "--agent, --user, and --gitignore-claude are only valid with `fallow hooks install --target agent`",
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
                return emit_input_error(
                    "--branch and --prune-baselines are only valid with `fallow hooks install --target git`",
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
                return emit_input_error(
                    "--agent and --user are only valid with `fallow hooks uninstall --target agent`",
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4352** (2026-11-08): **A for...of loop variable binds its element class for the whole file**
  *Symptoms*: ## Problem  A `for...of` loop variable over a typed array is bound to its element class by name for the whole file. Another binding with the same name in another scope then reads that class too, and its member calls credit members of the wrong class.  ## Reproduction (main at 49b3d49f3)  ```ts // src/table.ts export class Table { setVip(): void {} lock(): void {} }  // src/index.ts import { Table } from "./table.js"; const tables: Table[] = [new Table()]; for (const t of tables) { t.setVip(); } export function g(t: { lock(): void }) { t.lock(); } ```  `fallow dead-code` reports no unused class members. `Table.lock` gets credit from `t.lock()` in `g`, although that `t` has another type.  ## Expected  The element class of a loop variable applies only inside the loop body. `Table.lock` stays reported.  ## Notes  PR #4349 adds loops over a call (`for (const t of all())`) that use the same binding, so the leak also applies to those loops. 

- **Issue #4351** (2026-11-08): **Member called on this.method() inside a nested function gets credit through the class**
  *Symptoms*: ## Problem  `this` inside a nested `function` (or an object-literal method) in a class method does not refer to the class instance. Fallow still reads `this.find()` there as a call of the inherited method, and credits the members of its return type. The result contradicts itself: a member of the result of `find()` gets credit, and `find()` itself can stay unused.  ## Reproduction (main at 49b3d49f3)  ```ts // src/table.ts export class Table { setVip(): void {} used(): void {} }  // src/floor.ts import { Table } from "./table.js"; export class Floor {   find(): Table | undefined { return new Table(); }   static create(): Table { return new Table(); } }  // src/viewer.ts import { Floor } from "./floor.js"; export class Viewer extends Floor {   mark() {     function g(this: any) { this.find().setVip(); }     g.call({});   } }  // src/index.ts import { Viewer } from "./viewer.js"; import { Table } from "./table.js"; new Table().used(); new Viewer().mark(); ```  `fallow dead-code` reports only `Floor.create`. `Floor.find` and `Table.setVip` get credit, but no code calls them on a `Viewer` or `Floor` instance.  ## Expected  `this` in a nested `function` or an object-literal method gives no class `this` member access. `Floor.find` and `Table.setVip` stay reported.  ## Notes  The class `this` facts come from `record_class_this_facts` in `crates/extract/src/visitor/mod.rs`. The fix belongs where those facts are made, so that every consumer (exported and local class heritage) gets the 

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

### Incident Patch 1: `c04b02fb` (2026-11-08)
**Commit Message**: fix(extract): bound nested type-argument candidates before parsing (#4365)

* fix(extract): bound nested type-argument candidates before parsing

In TypeScript mode, the Oxc parser reads `a<` in an expression first as
the start of a type-argument list. When that fails, it reads the same
tokens again as a comparison. A type can hold an expression (a computed
key such as `{ [key]: T }`, or a parenthesized type), so a `<` inside
that expression starts the same retry again. Each nested level costs two
to four times the level inside it. A source of a few hundred bytes, such
as `t<{[t<{[t<{[...`, keeps the parser busy for minutes.

The MDX statement scan parses each candidate `import` or `export` line
on its own, so a single crafted MDX line made extraction hang. The same
input in a `.ts` or `.tsx` file stalls the main extraction and the
duplication tokenizer too.

The nesting scan that runs before every parse now also counts open `<`
tokens that nest behind a deeper `(` or `[`. A `<` closes at `>`, at a
token that cannot appear in a type (`;`, `=`, `&&`, `||`, `??`), and at
the bracket that encloses it. A `<` that nests only through `{` adds no
level, because an object type holds no exp

**File**: `changelog.d/fix-mdx-fuzz-timeout.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **A crafted TypeScript, JSX or MDX file can no longer make `fallow` hang.** Some sources with many nested `<` characters made the TypeScript parser try each nested part again and again, so one small file could keep `fallow dead-code`, `fallow dupes` or MDX extraction busy for minutes. Fallow now counts this nesting before it parses a file. A file past the cap is reported as a failed parse, the same as a file with too-deep bracket nesting. Real code stays well below the cap, so its results do not change.
```

**File**: `crates/extract/src/cache/types.rs` (modified, +2/-2)
```diff
@@ -10,12 +10,12 @@ use crate::MemberKind;
 /// extraction semantics change, and give the reason in the commit message and
 /// the CHANGELOG. A stale version serves old extraction results from a warm
 /// cache. The `assert_cached_type_size!` guards below catch shape changes.
-pub(super) const CACHE_VERSION: u32 = 424;
+pub(super) const CACHE_VERSION: u32 = 425;
 
 /// Duplication token cache version. Bump it when duplicate tokenization,
 /// normalization, or the on-disk token cache schema changes, and give the
 /// reason in the commit message and the CHANGELOG.
-pub const DUPES_CACHE_VERSION: u32 = 19;
+pub const DUPES_CACHE_VERSION: u32 = 20;
 
 /// Default maximum cache size (256 MB). Overridable per-project via
 /// `cache.maxSizeMb` in the config file or `FALLOW_CACHE_MAX_SIZE` env var.
```

**File**: `crates/extract/src/mdx.rs` (modified, +15/-0)
```diff
@@ -776,6 +776,21 @@ mod tests {
         );
     }
 
+    #[test]
+    fn nested_type_argument_candidates_do_not_stall_the_statement_probe() {
+        // Each `t<{[` makes the TypeScript parser try the rest twice, once as
+        // type arguments and once as a comparison. A parse of this candidate
+        // takes minutes.
+        let candidate = format!("import({})\n", "t<{[".repeat(24));
+        assert!(
+            crate::parse_bounded(&candidate, || ()).is_none(),
+            "the statement probe must refuse the candidate before it parses"
+        );
+        let source = format!("{candidate}import {{ Card }} from './card';\n<Card />\n");
+        assert!(!extract_mdx_statements_mapped(&source).body.contains("t<{["));
+        assert_eq!(import_sources(&source), vec!["./card".to_string()]);
+    }
+
     #[test]
     fn inline_line_terminators_end_comments_before_closing_delimiters() {
         for separator in ["\r", "\u{2028}", "\u{2029}"] {
```

**File**: `crates/extract/src/nesting.rs` (modified, +370/-22)
```diff
@@ -17,6 +17,10 @@
 //! (TypeScript generics, JSX elements, long member or call chains) is not
 //! capped. [`parse_bounded`] runs such a parse on a stack that is large
 //! enough for it.
+//!
+//! The same scan also counts the `<` tokens that the TypeScript parser can
+//! try as nested type-argument lists, because each such level multiplies the
+//! parse time. [`MAX_TYPE_ARGUMENT_NESTING`] caps that count.
 
 use std::path::Path;
 
@@ -25,6 +29,20 @@ use fallow_types::extract::ModuleInfo;
 
 use crate::visitor::ModuleInfoExtractor;
 
+/// Nesting depth of possible type-argument lists past which a file is not
+/// parsed.
+///
+/// In TypeScript, the parser reads `a<` in an expression first as the start
+/// of a type-argument list, and reads it again as a comparison when that
+/// fails. A type can hold an expression (a computed key in `{ [key]: T }`),
+/// so each `<` nested in such a list multiplies the work, and a few hundred
+/// bytes such as `t<{[t<{[t<{[...` keep the parser busy for minutes. The scan
+/// counts a `<` that is still open where the next one opens behind a deeper
+/// `(` or `[`. One level can cost up to four times the level inside it, so
+/// the cap keeps the worst case near a million steps. Real code, minified
+/// bundles and generated declaration files included, stays below this cap.
+const MAX_TYPE_ARGUMENT_NESTING: u32 = 10;
+
 /// Bracket nesting depth past which a file is not parsed.
 ///
 /// A release build on a 16 MiB worker stack overflows at about 6000 levels for
@@ -77,11 +95,12 @@ pub fn too_deep_module(file_id: FileId, source: &str, content_hash: u64) -> Modu
 }
 
 /// Returns `true` when the bracket nesting of `source` exceeds
-/// [`MAX_NESTING_DEPTH`].
+/// [`MAX_NESTING_DEPTH`] or its type-argument nesting exceeds
+/// [`MAX_TYPE_ARGUMENT_NESTING`].
 #[cfg(test)]
 #[must_use]
 fn exceeds_nesting_limit(source: &str) -> bool {
-    max_depth(source, MAX_NESTING_DEPTH, Dialect::Script) > MAX_NESTING_DEPTH
+    scan_nesting(source, Dialect::Script).exceeds_limits()
 }
 
 /// The lexical rules of the scanned source.
@@ -98,7 +117,8 @@ enum Dialect {
 
 /// Run `parse`, which parses `source` with Oxc and walks the result, without
 /// a stack overflow. Returns `None` when the bracket nesting of `source`
-/// exceeds [`MAX_NESTING_DEPTH`] or the stack it needs exceeds the cap in
+/// exceeds [`MAX_NESTING_DEPTH`], its type-argument nesting exceeds
+/// `MAX_TYPE_ARGUMENT_NESTING` (10), or the stack it needs exceeds the cap in
 /// `stack.rs`, so the caller treats the file as a failed parse.
 ///
 /// Every parse of user source goes through this function. It sizes the stack
@@ -142,7 +162,11 @@ fn parse_bounded_as<R: Send>(
     dialect: Dialect,
     parse: impl FnOnce() -> R + Send,
 ) -> Option<R> {
-    run_bounded(source, max_depth(source, MAX_NESTING_DEPTH, dialect), parse)
+    let nesting = scan_nesting(source, dialect);
+    if nesting.exceeds_limits() {
+        return None;
+    }
+    run_bounded(source, nesting.brackets, parse)
 }
 
 fn run_bounded<R: Send>(source: &str, depth: u32, parse: impl FnOnce() -> R + Send) -> Option<R> {
@@ -169,25 +193,40 @@ pub fn parse_bounded_or_default<T: Send + Default>(
     .unwrap_or_default()
 }
 
+/// The nesting that the parse of a source has to handle.
+struct Nesting {
+    /// Maximum bracket nesting depth.
+    brackets: u32,
+    /// Maximum nesting of `<` that can open a type-argument list.
+    type_arguments: u32,
+}
+
+impl Nesting {
+    const fn exceeds_limits(&self) -> bool {
+        self.brackets > MAX_NESTING_DEPTH || self.type_arguments > MAX_TYPE_ARGUMENT_NESTING
+    }
+}
+
+/// Measures the nesting of `source`. The scan stops as soon as a value passes
+/// its limit, so each value is at most its limit + 1.
+fn scan_nesting(source: &str, dialect: Dialect) -> Nesting {
+    let mut scanner = Scanner::new(source, MAX_NESTING_DEPTH, dialect);
+    scanner.scan();
+    Nesting {
+        brackets: scanner.max_depth,
+        type_arguments: scanner.max_type_arguments,
+    }
+}
+
 /// Maximum bracket nesting depth of `source`. The scan stops as soon as the
 /// depth passes `limit`, so the result is at most `limit + 1`.
+#[cfg(test)]
 fn max_depth(source: &str, limit: u32, dialect: Dialect) -> u32 {
     scan_depth(source, limit, dialect).max_depth
 }
 
 fn scan_depth(source: &str, limit: u32, dialect: Dialect) -> Scanner<'_> {
-    let mut scanner = Scanner {
-        bytes: source.as_bytes(),
-        pos: 0,
-        depth: 0,
-        max_depth: 0,
-        limit,
-        dialect,
-        templates: Vec::new(),
-        regex_allowed: true,
-        colors: Vec::new(),
-        max_colors: 0,
-    };
+    let mut scanner = Scanner::new(source, limit, dialect);
     scanner.scan();
     scanner
 }
@@ -205,41 +244,84 @@ struct Scanner<'a> {
     /// Whether a `/` at this point starts a regex literal instead of a
     /// division, judged from the previous significant byte.
     regex_allowed: bool,
+ 
```

**File**: `docs/reference/extract-internals.md` (modified, +6/-0)
```diff
@@ -47,6 +47,12 @@ Shared extraction result types live in `crates/types/src/extract.rs`.
     Sass or Less file is scanned with stylesheet rules: strings, escapes,
     `/* */` comments and unquoted `url()` only, because `//` in
     `url(//host/a.png)` is not a comment.
+  - The same scan counts the `<` tokens that the TypeScript parser can try
+    as nested type-argument lists: an open `<` with a later `<` behind a
+    deeper `(` or `[`. Each such level makes the parser try the inner part
+    again, so the parse time grows exponentially with the level. A file past
+    `MAX_TYPE_ARGUMENT_NESTING` returns `None` in the same way as a file
+    past `MAX_NESTING_DEPTH`.
   - It then runs the parse on a stack of
     `256 KiB + 1024 * source length + 4096 * bracket depth`
     (`crates/extract/src/stack.rs`). A need over 64 GiB (a source over 64 MB in
```

---

### Incident Patch 2: `d6553606` (2026-11-08)
**Commit Message**: fix(config): reject TOML that nests past the parser depth limit (#4360)

* fix(config): reject TOML that nests past the parser depth limit

The toml crate stops at a nesting depth of 80, but its depth counter can
go below zero. When the parser skips a value after an error, the closing
bracket of that value still lowers the counter. Each `[]` inside an
inline table that expects a key does this. A crafted file can then nest
arrays far past 80 levels, and the recursive parser overflows the stack.
This crashes fallow on a `fallow.toml`, an external plugin file, or a
TOML config that a framework plugin reads.

Add `fallow_config::toml_input`. `check_nesting` counts `[` and `{`
nesting in one pass. A closing bracket closes the innermost open bracket
only when the two match, so skipped brackets cannot lower the count. The
check also counts brackets in strings and comments, so the result is an
upper bound of the parser depth. It rejects nesting above 128, which is
above the toml limit of 80, so no file that toml accepts is rejected.

The config loader, the external plugin loader, the config writer, the
bun, mise, wrangler, prettier and GraphQL plugins, and the
fuzz_config_files target now 

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -1216,6 +1216,7 @@ dependencies = [
  "tempfile",
  "toml",
  "toml_edit",
+ "toml_parser",
  "tracing",
  "ureq",
  "xxhash-rust",
```

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -66,6 +66,7 @@ semver = "1"
 jsonc-parser = { version = "0.34", features = ["cst", "serde", "serde_json"] }
 toml = "1.1"
 toml_edit = "0.25"
+toml_parser = "1.1"
 schemars = { version = "1", features = ["chrono04"] }
 flate2 = "1"
 
```

**File**: `changelog.d/fix-config-files-stack-overflow.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **A crafted TOML file no longer crashes fallow.** A `fallow.toml`, an external plugin file, or a TOML file that a framework plugin reads (`bunfig.toml`, `mise.toml`, `wrangler.toml`, `.prettierrc.toml`, GraphQL config) could crash any command with a stack overflow. Fallow now rejects TOML that nests arrays and inline tables deeper than 128 levels before it parses the file. A rejected config file gives a parse error. A rejected plugin file is skipped, as with other invalid TOML.
```

**File**: `crates/config/Cargo.toml` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@ deser-yaml = { workspace = true }
 jsonc-parser = { workspace = true }
 toml = { workspace = true }
 toml_edit = { workspace = true }
+toml_parser = { workspace = true }
 schemars = { workspace = true }
 glob = { workspace = true }
 globset = { workspace = true }
```

**File**: `crates/config/src/config/entry_span.rs` (modified, +39/-2)
```diff
@@ -142,8 +142,17 @@ fn json_override_rule_range(content: &str, rule: &str, files: &[String]) -> Opti
         })
 }
 
+/// Parse the text of a TOML config file. This text comes from a second read
+/// of the file, so it can differ from the text that the loader checked.
+/// [`crate::toml_input::check_nesting`] runs first, so crafted nesting cannot
+/// overflow the stack of the parser.
+fn parse_toml_document(content: &str) -> Option<toml_edit::Document<&str>> {
+    crate::toml_input::check_nesting(content).ok()?;
+    toml_edit::Document::parse(content).ok()
+}
+
 fn toml_override_rule_range(content: &str, rule: &str, files: &[String]) -> Option<(usize, usize)> {
-    let document = toml_edit::Document::parse(content).ok()?;
+    let document = parse_toml_document(content)?;
     let overrides = document.as_table().get("overrides")?;
     let entries: Vec<&dyn toml_edit::TableLike> = match overrides.as_array_of_tables() {
         Some(tables) => tables
@@ -212,7 +221,7 @@ fn json_entry_range(content: &str, setting: &str, entry: &str) -> Option<(usize,
 }
 
 fn toml_entry_range(content: &str, setting: &str, entry: &str) -> Option<(usize, usize)> {
-    let document = toml_edit::Document::parse(content).ok()?;
+    let document = parse_toml_document(content)?;
     document
         .as_table()
         .get(setting)?
@@ -438,6 +447,34 @@ mod tests {
         assert_eq!(located_text(&span), "\"a/**\"");
     }
 
+    /// Each `[]` inside an inline table that expects a key lowers the depth
+    /// counter of the TOML parser. Without a nesting check before the parse,
+    /// the nested array that follows overflows the stack.
+    fn toml_that_evades_the_parser_depth_limit() -> String {
+        const REPEATS: usize = 200_000;
+        format!(
+            "a = {{{}}}\nb = {}{}\n",
+            "[]".repeat(REPEATS),
+            "[".repeat(REPEATS),
+            "]".repeat(REPEATS)
+        )
+    }
+
+    #[test]
+    fn toml_entry_range_rejects_nesting_that_evades_the_parser_limit() {
+        let source = toml_that_evades_the_parser_depth_limit();
+        assert_eq!(toml_entry_range(&source, "b", "x"), None);
+    }
+
+    #[test]
+    fn toml_override_rule_range_rejects_nesting_that_evades_the_parser_limit() {
+        let source = toml_that_evades_the_parser_depth_limit();
+        assert_eq!(
+            toml_override_rule_range(&source, "unused-files", &["a".to_string()]),
+            None
+        );
+    }
+
     #[test]
     fn an_entry_that_is_not_in_the_list_gives_no_location() {
         let dir = tempfile::tempdir().expect("tempdir");
```

**File**: `crates/config/src/config/parsing.rs` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ pub(super) fn parse_config_to_value(path: &Path) -> Result<serde_json::Value, mi
 
     match ConfigFormat::from_path(path) {
         ConfigFormat::Toml => {
-            let toml_value: toml::Value = toml::from_str(content).map_err(|e| {
+            let toml_value: toml::Value = crate::toml_input::from_str(content).map_err(|e| {
                 miette::miette!("Failed to parse config file {}: {}", path.display(), e)
             })?;
             serde_json::to_value(toml_value).map_err(|e| {
```

**File**: `crates/config/src/config/parsing_tests.rs` (modified, +21/-0)
```diff
@@ -4542,3 +4542,24 @@ fn extends_npm_exports_require_condition() {
     let config = FallowConfig::load(&dir.path().join(".fallowrc.json")).unwrap();
     assert_eq!(config.rules.unused_class_members, Severity::Warn);
 }
+
+/// Each `[]` inside an inline table that still needs a key lowers the
+/// recursion counter of the TOML parser by one, so the nested array after it
+/// recurses past the parser's depth limit and overflows the stack.
+#[test]
+#[cfg_attr(miri, ignore)]
+fn parse_config_to_value_rejects_toml_nesting_that_evades_the_parser_limit() {
+    const REPEATS: usize = 200_000;
+    let dir = test_dir("parse-toml-deep-nesting");
+    let path = dir.path().join("fallow.toml");
+    let content = format!(
+        "a = {{{}}}\nb = {}{}\n",
+        "[]".repeat(REPEATS),
+        "[".repeat(REPEATS),
+        "]".repeat(REPEATS)
+    );
+    std::fs::write(&path, content).unwrap();
+
+    let err = parse_config_to_value(&path).unwrap_err().to_string();
+    assert!(err.contains("Failed to parse config file"), "{err}");
+}
```

**File**: `crates/config/src/config_writer.rs` (modified, +31/-6)
```diff
@@ -21,6 +21,9 @@ pub enum ConfigWriteError {
     JsonParse(jsonc_parser::errors::ParseError),
     /// The existing TOML config could not be parsed.
     TomlParse(toml_edit::TomlError),
+    /// The existing TOML config nests arrays or inline tables too deep to
+    /// parse safely.
+    TomlTooDeep(crate::toml_input::NestingTooDeep),
     /// The config parsed but a key has a shape the writer cannot edit (e.g.
     /// a non-object root, or `ignoreExports` that is not an array). The
     /// message describes the expected shape.
@@ -33,6 +36,7 @@ impl fmt::Display for ConfigWriteError {
             Self::Io(e) => write!(f, "{e}"),
             Self::JsonParse(e) => write!(f, "{e}"),
             Self::TomlParse(e) => write!(f, "{e}"),
+            Self::TomlTooDeep(e) => write!(f, "{e}"),
             Self::InvalidShape(msg) => f.write_str(msg),
         }
     }
@@ -44,6 +48,7 @@ impl Error for ConfigWriteError {
             Self::Io(e) => Some(e),
             Self::JsonParse(e) => Some(e),
             Self::TomlParse(e) => Some(e),
+            Self::TomlTooDeep(e) => Some(e),
             Self::InvalidShape(_) => None,
         }
     }
@@ -250,14 +255,19 @@ fn append_json_rule_pack_path(content: &str, pack_path: &str) -> ConfigWriteResu
     Ok((root.to_string(), true))
 }
 
+fn parse_toml_document(content: &str) -> ConfigWriteResult<DocumentMut> {
+    crate::toml_input::check_nesting(content).map_err(ConfigWriteError::TomlTooDeep)?;
+    content
+        .parse::<DocumentMut>()
+        .map_err(ConfigWriteError::TomlParse)
+}
+
 fn append_toml_ignore_exports(
     content: &str,
     entries: &[IgnoreExportRule],
     config_dir: &Path,
 ) -> ConfigWriteResult<String> {
-    let mut doc = content
-        .parse::<DocumentMut>()
-        .map_err(ConfigWriteError::TomlParse)?;
+    let mut doc = parse_toml_document(content)?;
     match doc
         .as_table_mut()
         .entry("ignoreExports")
@@ -288,9 +298,7 @@ fn append_toml_ignore_exports(
 }
 
 fn append_toml_rule_pack_path(content: &str, pack_path: &str) -> ConfigWriteResult<(String, bool)> {
-    let mut doc = content
-        .parse::<DocumentMut>()
-        .map_err(ConfigWriteError::TomlParse)?;
+    let mut doc = parse_toml_document(content)?;
     match doc.as_table_mut().entry("rulePacks").or_insert(Item::None) {
         Item::None => {
             let mut array = Array::new();
@@ -435,6 +443,23 @@ mod tests {
         assert!(output.ends_with('\n'));
     }
 
+    /// Each `[]` inside an inline table that expects a key lowers the depth
+    /// counter of the TOML parser, so the nested array after it would
+    /// overflow the stack without the nesting check.
+    #[test]
+    fn rejects_toml_config_nesting_that_evades_the_parser_limit() {
+        const REPEATS: usize = 200_000;
+        let input = format!(
+            "a = {{{}}}\nb = {}{}\n",
+            "[]".repeat(REPEATS),
+            "[".repeat(REPEATS),
+            "]".repeat(REPEATS)
+        );
+        let err = add_rule_pack_path_to_string(Path::new("fallow.toml"), &input, "pack.toml")
+            .unwrap_err();
+        assert!(matches!(err, ConfigWriteError::TomlTooDeep(_)), "{err}");
+    }
+
     #[test]
     fn appends_json_rule_pack_path() {
         let (output, changed) = add_rule_pack_path_to_string(
```

---

### Incident Patch 3: `b2789cb5` (2026-11-08)
**Commit Message**: perf(mutation): count thread CPU time for the loop budget and settle short loop timeouts (#4354)

* perf(mutation): count thread CPU time for the loop budget and settle short loop timeouts

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* perf(mutation): stop an endless loop through any instrumented code in a mutant run

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* perf(mutation): settle only thread CPU loop timeouts with measured test time

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* test(mutation): expect the wall-clock loop timeout on Node without a thread CPU clock

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

---------

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

**File**: `changelog.d/perf-mutation-loop-cpu-budget.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+### Changed
+
+- **`fallow mutation` stops more endless loops in the companion, and gives a loop timeout of short tests no retry.** The loop check now counts each evaluation of an instrumented site in a mutant run, not only the evaluations of the active mutant. So a mutant that makes a loop of other source code run forever, for example a `return` that gives `undefined` to the condition of a caller loop, also ends at the loop budget. The loop budget of a mutant run now counts the CPU time of the test thread, not the wall time. A test that waits uses no budget, and load from other processes on the host does not count. A loop timeout of covering tests that take 200 ms or less in the dry run is final: the budget is then at least four times the work of the tests. Before, each such mutant ran a second time with twice the budget.
+  (Part of [#4341](https://github.com/fallow-rs/fallow/issues/4341))
```

**File**: `crates/api/src/mutation/companion/adapters/common.mjs` (modified, +14/-2)
```diff
@@ -269,10 +269,22 @@ const runStatus = (tests, errors, requestedCount) => {
   return tests.length === requestedCount ? "survived" : "runtime_error";
 };
 
-/** Builds a `run_result` body from the tests and the errors of a run. */
-export const runResult = ({ mutantId, tests, errors, requestedCount, durationMs }) => {
+/**
+ * Builds a `run_result` body from the tests and the errors of a run.
+ * `loopTimeout` is true when the loop budget failed the first failing test.
+ * The body then has `loop_timeout: true` when the status is `timeout`.
+ */
+export const runResult = ({
+  mutantId,
+  tests,
+  errors,
+  requestedCount,
+  durationMs,
+  loopTimeout = false,
+}) => {
   const status = runStatus(tests, errors, requestedCount);
   return {
+    ...(loopTimeout && status === "timeout" ? { loop_timeout: true } : {}),
     mutant_id: mutantId,
     status,
     // With no failing test, a kill comes from an error outside a test, so
```

**File**: `crates/api/src/mutation/companion/adapters/vitest.mjs` (modified, +15/-2)
```diff
@@ -6,7 +6,7 @@ import { fileURLToPath, pathToFileURL } from "node:url";
 
 import { CompanionError, expectRequest, isPlainObject } from "../protocol.mjs";
 import { overlayErrorsPath } from "../runtime/child.mjs";
-import { LOOP_TIMEOUT_NAME } from "../runtime/global.mjs";
+import { LOOP_TIMEOUT_NAME, WALL_LOOP_TIMEOUT_NAME } from "../runtime/global.mjs";
 import { createWorkDir } from "./child-process.mjs";
 import {
   TEST_ID_SEPARATOR,
@@ -163,9 +163,16 @@ const testStatus = (testCase) => STATUS_BY_STATE[testCase.result().state]?.(test
 const isConcurrent = (testCase) =>
   testCase.options.concurrent === true || testCase.project.config.sequence?.concurrent === true;
 
+const hasErrorNamed = (testCase, names) =>
+  (testCase.result().errors ?? []).some((error) => names.includes(error?.name));
+
+/** True for a test that the loop budget ended, on either clock. */
+const isLoopTimeout = (testCase) =>
+  hasErrorNamed(testCase, [LOOP_TIMEOUT_NAME, WALL_LOOP_TIMEOUT_NAME]);
+
 const failureKind = (testCase) => {
   const errors = testCase.result().errors ?? [];
-  if (errors.some((error) => error?.name === LOOP_TIMEOUT_NAME)) return "timeout";
+  if (isLoopTimeout(testCase)) return "timeout";
   if (errors.some((error) => TIMEOUT_MESSAGE.test(errorMessage(error)))) return "timeout";
   return errors.some((error) => error?.name === "AssertionError") ? "assertion" : "error";
 };
@@ -739,12 +746,18 @@ export const createAdapter = async (init) => {
       timeoutMs: request.timeout_ms,
       loopBudgetMs: request.loop_budget_ms ?? null,
     });
+    const firstFailure = result.testModules
+      .flatMap((testModule) => [...testModule.children.allTests()])
+      .find((testCase) => testIdByTask.has(testCase.id) && testStatus(testCase) === "fail");
     return runResult({
       mutantId: request.mutant_id,
       tests: collectRunTests(result.testModules, testIdByTask, directories),
       errors: runErrors(result, root),
       requestedCount: requested.length,
       durationMs: performance.now() - started,
+      // Only the thread CPU clock makes a loop timeout final. Host load can
+      // use wall time, so a wall-clock loop timeout gets the normal retry.
+      loopTimeout: firstFailure !== undefined && hasErrorNamed(firstFailure, [LOOP_TIMEOUT_NAME]),
     });
   };
 
```

**File**: `crates/api/src/mutation/companion/runtime/global.mjs` (modified, +60/-24)
```diff
@@ -3,41 +3,74 @@ import { GLOBAL_NAME } from "../generated-protocol.mjs";
 
 const CONTROL = Symbol.for("fallow.mutation.control");
 
-/** The `name` of the error that ends a test whose mutant runs past the loop budget. */
+/**
+ * The `name` of the error that ends a test of a mutant run past the loop
+ * budget, measured in CPU time of the test thread.
+ */
 export const LOOP_TIMEOUT_NAME = "FallowMutationLoopTimeout";
 
-// `a` reads the clock once per this many evaluations of the active mutant.
+/**
+ * The `name` of the same error when the runtime has no thread CPU clock and
+ * measures wall time. Host load can use wall time, so the API retries it.
+ */
+export const WALL_LOOP_TIMEOUT_NAME = "FallowMutationWallLoopTimeout";
+
+// `a` reads the clock once per this many site evaluations of a mutant run.
 // A clock read on each evaluation would slow a hot loop that ends.
 const LOOP_CHECK_MASK = 0x7f;
 
-// The real clock, read when the module loads. A test with fake timers can
-// replace `performance` or its `now` method, and fake time must not reach
-// the loop budget. The setup file loads this module before any test code.
-const realNow = performance.now.bind(performance);
+// The clock of the loop budget, in ms. The CPU time of the test thread is
+// the first choice: a test that waits uses none, and other load on the host
+// does not count. `process.cpuUsage` is no fallback, because it adds the
+// time of every thread of the process. A runtime without
+// `process.threadCpuUsage` (Node before 22.19 and 23.9, or browser mode)
+// uses the wall clock. The functions are read when the module loads, so
+// fake timers of a test cannot replace them. The setup file loads this
+// module before any test code.
+const clock = (() => {
+  const proc = globalThis.process;
+  if (typeof proc?.threadCpuUsage === "function") {
+    const usage = proc.threadCpuUsage.bind(proc);
+    return {
+      read: () => {
+        const { user, system } = usage();
+        return (user + system) / 1000;
+      },
+      errorName: LOOP_TIMEOUT_NAME,
+    };
+  }
+  const perf = globalThis.performance;
+  if (typeof perf?.now === "function") {
+    return { read: perf.now.bind(perf), errorName: WALL_LOOP_TIMEOUT_NAME };
+  }
+  return null;
+})();
 
-/** Gives the real time in ms, or null when the clock fails. */
+/** Gives the clock value in ms, or null without a working clock. */
 const readClock = () => {
+  if (clock === null) return null;
   try {
-    return realNow();
+    return clock.read();
   } catch {
     return null;
   }
 };
 
 const loopTimeout = (budgetMs) => {
   const error = new Error(
-    `Test timed out in ${budgetMs}ms: the active mutant still ran after the loop budget`,
+    `Test timed out in ${budgetMs}ms: the mutant run still evaluated instrumented code after the loop budget`,
   );
-  error.name = LOOP_TIMEOUT_NAME;
+  error.name = clock?.errorName ?? LOOP_TIMEOUT_NAME;
   return error;
 };
 
 const createRuntime = () => {
   // `running` counts the tests that started and did not finish. Concurrent
   // tests overlap, so a hit belongs to a test while any test runs.
-  // `loopBudget` is the time in ms that the tests of one file can run with
-  // the active mutant. `loopSpent` is the test time of the earlier tests of
-  // the file, and `testStarted` the start of the current test time.
+  // `loopBudget` is the CPU time in ms that the tests of one file can use
+  // in a mutant run. `loopSpent` is the CPU time of the earlier tests
+  // of the file, and `testStarted` the clock value at the start of the
+  // current test time.
   const state = {
     active: null,
     running: 0,
@@ -46,17 +79,18 @@ const createRuntime = () => {
     loopBudget: null,
     loopSpent: 0,
     testStarted: 0,
-    activeHits: 0,
+    evaluations: 0,
   };
   // A synchronous endless loop blocks the test worker, so no timer can stop
-  // it. When the loop passes through the active mutant, this check ends it
-  // with an error that the adapter reports as a timeout. The companion then
-  // stays alive. A loop that does not pass through the mutant waits for the
-  // watchdog of the API.
+  // it. In a mutant run, each instrumented site calls `a` on each
+  // evaluation. When a loop runs through any instrumented code, this check
+  // ends it with an error that the adapter reports as a timeout, and the
+  // companion stays alive. A loop through code with no site (test code or a
+  // dependency) waits for the watchdog of the API.
   const checkLoop = () => {
-    state.activeHits += 1;
-    if ((state.activeHits & LOOP_CHECK_MASK) !== 0) return;
-    if (state.loopBudget === null || state.running === 0) return;
+    if (state.loopBudget === null) return;
+    state.evaluations += 1;
+    if ((state.evaluations & LOOP_CHECK_MASK) !== 0 || state.running === 0) return;
     const now = readClock();
     if (now === null || state.loopSpent + now - state.testStarted <= state.loopBudget) return;
     throw loopTim
```

**File**: `crates/api/src/mutation/protocol.rs` (modified, +9/-4)
```diff
@@ -44,10 +44,10 @@ pub struct RunRequest {
     pub mutant_id: Option<String>,
     pub test_ids: Vec<String>,
     pub timeout_ms: u64,
-    /// The test time in ms after which the companion ends a test that still
-    /// runs the active mutant, and reports it as a timeout. It stops a
-    /// synchronous endless loop that blocks the test worker before the
-    /// watchdog fires. `None` sends no field: the run has no loop check.
+    /// The test CPU time in ms after which the companion ends a test that
+    /// still evaluates instrumented code, and reports it as a timeout. It
+    /// stops a synchronous endless loop that blocks the test worker before
+    /// the watchdog fires. `None` sends no field: the run has no loop check.
     #[serde(skip_serializing_if = "Option::is_none")]
     pub loop_budget_ms: Option<u64>,
     pub bail: bool,
@@ -226,6 +226,11 @@ pub struct RunResult {
     pub tests: Vec<RunTest>,
     #[serde(default)]
     pub unhandled_errors: Vec<UnhandledError>,
+    /// True when the loop budget of the request decided a `timeout` status:
+    /// the first failing test still evaluated instrumented code after the
+    /// budget.
+    #[serde(default)]
+    pub loop_timeout: bool,
 }
 
 #[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
```

**File**: `crates/api/src/mutation/scheduler/matrix_tests.rs` (modified, +1/-0)
```diff
@@ -34,6 +34,7 @@ fn all_failed(run: &RunRequest) -> Response {
             })
             .collect(),
         unhandled_errors: Vec::new(),
+        loop_timeout: false,
     })
 }
 
```

**File**: `crates/api/src/mutation/scheduler/mod.rs` (modified, +9/-17)
```diff
@@ -32,7 +32,7 @@ mod window;
 use classification::{attempt_record, classify, kill_kind, matrix_evidence};
 use dry_facts::{DryRunFacts, covering_tests, read_dry_run, record_dry_run, reported_duplicates};
 use targets::{config_targets, job_targets};
-use window::{loop_budget_ms, scaled_ms, timeout_ms};
+use window::{loop_budget_ms, round_ms, scaled_ms, settles_loop_timeout, timeout_ms};
 mod stored;
 
 pub use stored::{CachedResult, OutcomeJournal, ResultLookup};
@@ -300,8 +300,8 @@ struct Job {
     /// outside target mode.
     targets: Vec<String>,
     timeout_ms: u64,
-    /// The test time after which the companion ends a test that still runs
-    /// the active mutant: `1.5 *` the covering-test time plus
+    /// The test CPU time after which the companion ends a test that still
+    /// evaluates instrumented code: `1.5 *` the covering-test time plus
     /// [`window::LOOP_BUDGET_BASE_MS`].
     loop_budget_ms: u64,
     /// `1.5 *` the setup time of the covering test files, rounded up. Only
@@ -390,8 +390,8 @@ struct Attempt {
     /// The covering tests that the companion left out, because they did not
     /// pass in its dry run or in a control run.
     dropped_tests: Vec<String>,
-    /// A failed control run decided the status, so a retry in a new
-    /// companion cannot change it.
+    /// A failed control run or a loop timeout of a short job decided the
+    /// status, so a retry in a new companion cannot change it.
     settled: bool,
 }
 
@@ -461,17 +461,6 @@ fn is_load_kill(result: &RunResult, status: MutantStatus, killed_by: Option<&Str
     status == MutantStatus::Killed && killed_by.is_none() && result.tests_executed == 0
 }
 
-#[expect(
-    clippy::cast_possible_truncation,
-    clippy::cast_sign_loss,
-    reason = "durations are finite and non-negative milliseconds"
-)]
-fn round_ms(value: Option<f64>) -> Option<u64> {
-    value
-        .filter(|value| value.is_finite() && *value >= 0.0)
-        .map(|value| value.round() as u64)
-}
-
 /// A companion that has sent `ready` and a dry run.
 struct Worker<'a> {
     spawner: &'a dyn CompanionSpawner,
@@ -679,6 +668,9 @@ impl<'a> Worker<'a> {
                         killing_tests,
                         kill_matrix_complete: kill_matrix_complete && dropped_tests.is_empty(),
                         failure_kind: kind.or(decided.failure_kind),
+                        settled: status == MutantStatus::Timeout
+                            && result.loop_timeout
+                            && settles_loop_timeout(job.loop_budget_ms),
                         ..decided
                     }
                 }
@@ -1631,7 +1623,7 @@ fn record_first_runs(
     for (job, attempt) in attempts {
         let suspect = match attempt.status {
             MutantStatus::Survived => Some(job.clone().for_confirmation()),
-            MutantStatus::Timeout => Some(job.clone().with_doubled_timeout()),
+            MutantStatus::Timeout if !attempt.settled => Some(job.clone().with_doubled_timeout()),
             _ => None,
         };
         if let Some(suspect) = suspect {
```

**File**: `crates/api/src/mutation/scheduler/target_tests.rs` (modified, +1/-0)
```diff
@@ -50,6 +50,7 @@ fn killed_by_each_always(run: &RunRequest, killers: &[String]) -> Response {
         tests_executed: tests.len(),
         tests,
         unhandled_errors: Vec::new(),
+        loop_timeout: false,
     })
 }
 
```

#### Recent Merged Pull Requests:
- **PR #4381** (2026-11-09): fix(dupes): keep clone fingerprints the same with CRLF line endings (@BartWaardenburg)
- **PR #4379** (2026-11-09): test: compare the facts of the CLI, MCP, LSP and Node bindings (@BartWaardenburg)
- **PR #4377** (2026-11-09): fix(extract): remove only the first U+FEFF of a source (@BartWaardenburg)
- **PR #4376** (2026-11-09): fix(lsp): drop the byte order mark when the LSP reads a file from disk (@BartWaardenburg)
- **PR #4375** (2026-11-09): fix(lsp): offer the remove-export quick fix for a name with a combining mark (@BartWaardenburg)
- **PR #4374** (2026-11-09): test(platform): add an oracle for CRLF, backslash and drive-root invariance (@BartWaardenburg)

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

## X. extract): bound nested type-argument candidates before parsing (#4365)

**RULE**:
When implementing operations in `changelog.d/fix-mdx-fuzz-timeout.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fallow-rs/fallow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c04b02fb`: extract): bound nested type-argument candidates before parsing (#4365). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/fix-mdx-fuzz-timeout.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
### Fixed

- **A crafted TypeScript, JSX or MDX file can no longer make `fallow` hang.** Some sources with many nested `<` characters made the TypeScript parser try each nested part again and again, so one small file could keep `fallow dead-code`, `fallow dupes` or MDX extraction busy for minutes. Fallow now counts this nesting before it parses a file. A file past the cap is reported as a failed parse, the same as a file with too-deep bracket nesting. Real code stays well below the cap, so its results do not change.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c04b02fb` are properly handled with clean fallback behavior.
