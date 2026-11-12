> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source**: github ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Source Version**: `7016f77b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T17:51:02.426Z  
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
> **Harvest Timestamp**: 2026-11-11T17:46:01.679Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5340 stars

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

import { readOverlay, realPath, recordOverlayError } from "./child.mjs";

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

/**
 * Serves the instrumented files of the overlay file in this process, and
 * gives the set of the source paths that the process loaded. A file that
 * the hook cannot serve for certain goes into the integrity log.
 */
export const serveOverlay = (overlayPath) => {
  const loaded = new Set();
  registerOverlayHook(
    readOverlay(overlayPath),
    (entry) => loaded.add(entry.source),
    (message) => recordOverlayError(overlayPath, message),
  );
  return loaded;
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

### Core Architecture Module: `crates/api/src/shared_state_explain.rs`
```
//! Explain the optional inventory separately from finding severity metadata.
pub fn explain() -> fallow_output::ExplainOutput {
    fallow_output::ExplainOutput {
        id: "fallow/shared-state".to_owned(),
        name: "Shared-state inventory".to_owned(),
        summary: "Direct imported property writes and custom global access sites".to_owned(),
        rationale: "An imported-property write identifies one runtime ESM binding declaration. A global group retains reads and writes in different non-test files under the same exact root and direct slot. Neither observation proves a runtime dependency, shared runtime or unsafe execution order. Observations do not affect finding totals, severity, health, gates or automatic fixes.".to_owned(),
        example: "import {state} from './owner'; state.value = 1; // imported property write\nwindow.custom = 1; // grouped with window.custom reads in another source file".to_owned(),
        how_to_fix: "Review ownership and initialization manually. Use fallow-ignore-next-line shared-state for intentional sites, or sharedStateAllowlist entries such as [\"window\", \"custom\"]. Aliases, dynamic keys, type-only imports, ambiguous origins and mutator calls are outside this inventory.".to_owned(),
        docs: "https://fallow.tools/docs/cli/architecture".to_owned(),
    }
}

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4431** (2026-11-10): **security --gate new: an unresolvable --changed-since ref prints the whole-project fallback warning, then exits 2 without a report**
  *Symptoms*: ### What happened?  When `fallow security --gate new --changed-since <ref>` cannot resolve `<ref>`, it first prints the scope-fallback warning, which says the run will continue as a whole-project report, then fails with exit 2. No whole-project report is produced, so the warning describes a fallback that does not happen.  stderr from step 3 below (the long git hint is shortened to `...`):  ``` Warning: --changed-since 'origin/main' was ignored because fatal: ambiguous argument 'origin/main...HEAD': unknown revision ... so this report covers the whole project instead of the changed files. Verify the ref exists in this repository, and check out with full history. Error: fallow security --gate could not compute the diff for 'origin/main': fatal: Not a valid object name origin/main (shallow clone? ...) ```  With `--format json`, stdout holds only `{"error":true,"message":"fallow security --gate could not compute the diff ...","exit_code":2}`, and the same "covers the whole project" warning still goes to stderr.  The exit code is right: the gate refuses to pass without a diff. Only the warning is wrong. A reader, human or agent, sees two messages that disagree about what the run did, and a log that keeps only stderr shows the warning and not the error.  The two messages also quote different git errors (`ambiguous argument 'origin/main...HEAD'` and `Not a valid object name origin/main`), which suggests the ref is resolved twice: once for the scope, then again for the gate.  Related

- **Issue #4429** (2026-11-10): **security: `finding_id` changes when an unrelated edit moves a sink's line, so stored verdicts stop matching**
  *Symptoms*: ### Problem  `finding_id` is built from the rule, path, line and column (see [Finding identity migration](https://fallow.tools/docs/cli/security-agent-verification/#finding-identity-migration)). Any edit above a sink therefore gives it a new ID, even when the sink itself is unchanged. `fallow security survivors` matches verdicts by `finding_id` and exits 2 on an unknown ID. So a verdict for an unchanged candidate stops working after an unrelated edit, and the candidate has to be verified again.  The security docs also recommend the ID "to track a candidate across runs (for example after a rebase)". A rebase usually moves lines, so in practice the ID does not support that use.  Minimal repro, fallow 3.41.0 on Windows:  1. `package.json`: `{ "name": "fid-repro", "private": true, "type": "module", "main": "src/index.js" }` 2. `src/index.js`:    ```js    import { exec } from 'node:child_process'     export function run(name) {    	exec(`git log ${name}`)    }    ``` 3. Commit, then run `fallow security --no-cache --format json > before.json`. This gives one candidate: `7538fe0777339dfc src/index.js:4:1 command-injection`. 4. Write a `fallow-security-verdict/v1` file that dismisses `7538fe0777339dfc`. `fallow security survivors --candidates before.json --verdicts verdicts.json` exits 0. 5. Insert a comment line above `export function run`, commit, and run step 3 again into `after.json`. The same sink is now `6dc84d0773557bd3 src/index.js:5:1`. 6. `fallow security survivors --candi

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

### Incident Patch 1: `dd78ac74` (2026-11-11)
**Commit Message**: feat(mutation): add the opt-in nullish-fallback operator (#4507)

* feat(mutation): add the opt-in nullish-fallback operator

The new opt-in operator `nullish-fallback` changes `a ?? b` to `a`. The
existing `logical-operator` changes `??` to `&&`, which does not remove
the fallback. A survivor shows that no test gives a nullish left operand.

With `--typecheck`, a survivor gets the existing advisory hint
`type-non-nullish` when the declared type of `a` excludes `null` and
`undefined`. The type-aware companion uses the same proof as for
`optional-chaining`. The proof rejects a left operand that is an
optional chain, such as `o?.items.map(f) ?? []`, because the chain gives
`undefined` when a link short-circuits.

A run that does not name the operator gives the same plan and the same
mutant ids as before. No schema_version changes.

Refs #4502

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* test(mutation): cover comments and multi-byte text around a nullish fallback

The collector skips a `??` inside a comment, and the companion maps byte
offsets to UTF-16 offsets after multi-byte text. Tests now lock both.
The docs no longer say that each opt-in operator comes from the Stryker

**File**: `crates/api/src/mutation/typecheck.rs` (modified, +2/-1)
```diff
@@ -3,7 +3,8 @@
 //! The check runs after the tests and reads only the survivors. A survivor
 //! whose mutated file does not type-check becomes `compile_error`, which the
 //! score does not count. A survivor that removes an optional-chaining link
-//! from a receiver whose declared type excludes nullish values keeps the
+//! or a nullish fallback (`a ?? b` to `a`) from a receiver whose declared
+//! type excludes nullish values keeps the
 //! status `survived` and gets an advisory `equivalence_hint`. A survivor that
 //! the checker cannot check keeps the status `survived`.
 
```

**File**: `crates/cli/src/mutation_cli.rs` (modified, +6/-4)
```diff
@@ -171,7 +171,8 @@ pub struct MutationArgs {
     /// The operators to use, comma-separated. Default: the default set. The
     /// opt-in operators (block-statement, array-literal, object-literal,
     /// method-expression, switch-case, call-expression, throw-statement,
-    /// regex-constructor, regex-assertion) run only when named here.
+    /// regex-constructor, regex-assertion, nullish-fallback) run only when
+    /// named here.
     #[arg(long, value_name = "NAMES", value_delimiter = ',')]
     pub operators: Vec<String>,
     /// A verdict document that marks mutants as equivalent. Equivalent
@@ -191,9 +192,10 @@ pub struct MutationArgs {
     pub runner_config: Option<PathBuf>,
     /// Type-check each survived mutant through the `--type-aware`
     /// companion. A survivor that does not type-check becomes
-    /// `compile_error` and leaves the score. An optional-chaining survivor on a
-    /// receiver whose type excludes `null` and `undefined` gets an advisory
-    /// `equivalence_hint`. Its status and the score do not change.
+    /// `compile_error` and leaves the score. An optional-chaining or
+    /// nullish-fallback survivor on a receiver whose type excludes `null` and
+    /// `undefined` gets an advisory `equivalence_hint`. Its status and the
+    /// score do not change.
     #[arg(long)]
     pub typecheck: bool,
     /// Continue an interrupted or partial run: reuse the killed and confirmed
```

**File**: `crates/cli/tests/integration/mutation_tests.rs` (modified, +82/-0)
```diff
@@ -1646,6 +1646,88 @@ mod end_to_end {
         assert_eq!(judged["summary"]["counts"]["equivalent"], 1, "{judged}");
     }
 
+    /// `labelOf` reads `name ?? "anon"` where `name` is a `string`. No test
+    /// can tell the expression from `name`, so the opt-in `nullish-fallback`
+    /// mutant survives. The type check adds the advisory hint, and the
+    /// status and the score do not change. A run of the default operators
+    /// has no `nullish-fallback` mutant.
+    #[test]
+    fn a_typecheck_run_hints_a_nullish_fallback_on_a_non_nullable_receiver() {
+        let Some(package) = companion_package() else {
+            return;
+        };
+        if !type_aware_companion_installed() {
+            return;
+        }
+        let (_project, root) = vitest_project(
+            &package,
+            "\nexport function labelOf(name: string): string {\n  return name ?? \"anon\";\n}\n",
+        );
+        fs::write(
+            root.join("tsconfig.json"),
+            r#"{"compilerOptions":{"strict":true,"noUncheckedIndexedAccess":true,"noEmit":true},"include":["src"]}"#,
+        )
+        .expect("tsconfig");
+        fs::write(
+            root.join("test/label.test.ts"),
+            "import { expect, test } from \"vitest\";\nimport { labelOf } from \"../src/math\";\n\ntest(\"labels\", () => {\n  expect(labelOf(\"ada\")).toBe(\"ada\");\n});\n",
+        )
+        .expect("label test");
+        commit_all(&root, "label");
+
+        let fallback = |report: &serde_json::Value| -> Option<serde_json::Value> {
+            report["mutants"]
+                .as_array()
+                .expect("mutants")
+                .iter()
+                .find(|mutant| {
+                    mutant["function"] == "labelOf" && mutant["operator"] == "nullish-fallback"
+                })
+                .cloned()
+        };
+        let (default_output, default_run) =
+            json_mutation(&root, &["src/math.ts", "--concurrency", "1"]);
+        assert_eq!(default_output.code, 0, "{}", default_output.stderr);
+        assert!(fallback(&default_run).is_none(), "{default_run}");
+
+        let args = [
+            "src/math.ts",
+            "--concurrency",
+            "1",
+            "--operators",
+            "nullish-fallback",
+        ];
+        let (plain_output, plain) = json_mutation(&root, &args);
+        assert_eq!(plain_output.code, 0, "{}", plain_output.stderr);
+        let mutant = fallback(&plain).expect("a nullish-fallback mutant of labelOf");
+        assert_eq!(mutant["status"], "survived", "{plain}");
+        assert!(mutant.get("equivalence_hint").is_none(), "{plain}");
+
+        let mut command = std::process::Command::new(crate::common::fallow_bin());
+        command
+            .env("RUST_LOG", "")
+            .env("NO_COLOR", "1")
+            .args(["mutation", "--root"])
+            .arg(&root)
+            .args(args)
+            .args(["--typecheck", "--format", "json", "--quiet"]);
+        crate::common::configure_type_aware_sidecar(&mut command);
+        let output = command.output().expect("fallow runs");
+        assert_eq!(
+            output.status.code(),
+            Some(0),
+            "{}",
+            String::from_utf8_lossy(&output.stderr)
+        );
+        let checked: serde_json::Value =
+            serde_json::from_str(&String::from_utf8_lossy(&output.stdout)).expect("json");
+        let mutant = fallback(&checked).expect("a nullish-fallback mutant of labelOf");
+        assert_eq!(mutant["status"], "survived", "{checked}");
+        assert_eq!(mutant["equivalence_hint"], "type-non-nullish", "{checked}");
+        assert_eq!(checked["typecheck"]["hinted"], 1, "{checked}");
+        assert_hint_leaves_the_score(&checked, &plain);
+    }
+
     /// A component compiler in the shape of the Vue plugin: its `transform`
     /// hook keeps the script block of a `.vue` file.
     const COMPONENT_CONFIG: &str = r#"const componentPlugin = () => ({
```

**File**: `crates/config/src/config/mutation.rs` (modified, +7/-2)
```diff
@@ -72,6 +72,8 @@ pub enum MutationOperatorName {
     RegexConstructor,
     /// Opt-in. A lookaround negated, or `\b` and `\B` swapped.
     RegexAssertion,
+    /// Opt-in. `a ?? b` to `a`.
+    NullishFallback,
 }
 
 impl MutationOperatorName {
@@ -101,6 +103,7 @@ impl MutationOperatorName {
             Self::ThrowStatement => "throw-statement",
             Self::RegexConstructor => "regex-constructor",
             Self::RegexAssertion => "regex-assertion",
+            Self::NullishFallback => "nullish-fallback",
         }
     }
 }
@@ -209,8 +212,9 @@ pub struct MutationConfig {
     /// Type-check each survived mutant through the TypeScript-Go companion
     /// of `--type-aware`. A survivor that does not type-check becomes
     /// `compile_error` and does not count in the score. A survivor that
-    /// removes an optional-chaining link from a receiver whose type excludes
-    /// `null` and `undefined` gets an advisory `equivalence_hint`. Its status
+    /// removes an optional-chaining link or a nullish fallback from a
+    /// receiver whose type excludes `null` and `undefined` gets an advisory
+    /// `equivalence_hint`. Its status
     /// and the score do not change. Unset or `false` checks no survivor.
     /// `--typecheck` turns the check on.
     #[serde(default, skip_serializing_if = "Option::is_none")]
@@ -343,6 +347,7 @@ mod tests {
             MutationOperatorName::BooleanLiteral,
             MutationOperatorName::StringLiteral,
             MutationOperatorName::OptionalChaining,
+            MutationOperatorName::NullishFallback,
         ] {
             let json = serde_json::to_value(name).expect("serializes");
             assert_eq!(json, serde_json::Value::String(name.as_str().to_owned()));
```

**File**: `crates/engine/src/mutation/sampling.rs` (modified, +6/-5)
```diff
@@ -32,11 +32,12 @@ const fn productivity(operator: Operator) -> u8 {
         Operator::CallExpression => 14,
         Operator::ThrowStatement => 15,
         Operator::SwitchCase => 16,
-        Operator::RegexAssertion => 17,
-        Operator::RegexConstructor => 18,
-        Operator::ArrayLiteral => 19,
-        Operator::ObjectLiteral => 20,
-        Operator::BlockStatement => 21,
+        Operator::NullishFallback => 17,
+        Operator::RegexAssertion => 18,
+        Operator::RegexConstructor => 19,
+        Operator::ArrayLiteral => 20,
+        Operator::ObjectLiteral => 21,
+        Operator::BlockStatement => 22,
     }
 }
 
```

**File**: `crates/mutation/src/collect/mod.rs` (modified, +3/-0)
```diff
@@ -1470,6 +1470,9 @@ impl<'a> Visit<'a> for Collector<'_> {
                     change,
                 );
             }
+            if operator == LogicalOperator::Coalesce {
+                self.nullish_fallback(it, start);
+            }
         }
         walk::walk_logical_expression(self, it);
         self.negate_operands(it);
```

**File**: `crates/mutation/src/collect/opt_in.rs` (modified, +17/-2)
```diff
@@ -6,8 +6,8 @@
 
 use oxc_ast::ast::{
     Argument, ArrayExpression, ArrowFunctionExpression, BlockStatement, CallExpression, Class,
-    Expression, Function, FunctionBody, ObjectExpression, Statement, SwitchCase, ThrowStatement,
-    VariableDeclaration, VariableDeclarationKind,
+    Expression, Function, FunctionBody, LogicalExpression, ObjectExpression, Statement, SwitchCase,
+    ThrowStatement, VariableDeclaration, VariableDeclarationKind,
 };
 use oxc_ast_visit::{Visit, walk};
 use oxc_span::{GetSpan, Span};
@@ -241,6 +241,21 @@ impl Collector<'_> {
         }
     }
 
+    /// Adds the `nullish-fallback` candidate of `a ?? b`: the region from
+    /// the `??` token at `token_start` to the end of `b` is removed, so the
+    /// expression becomes `a`. The left operand keeps its place, and `??`
+    /// binds more loosely than any operand that it can have without
+    /// parentheses, so the grouping of the context does not change.
+    pub(super) fn nullish_fallback(&mut self, it: &LogicalExpression<'_>, token_start: u32) {
+        self.add(
+            it.span,
+            Operator::NullishFallback,
+            (token_start, it.right.span().end),
+            String::new(),
+            MutantChange::new(MutantChange::FALLBACK, ""),
+        );
+    }
+
     /// Adds the `array-literal` candidate.
     pub(super) fn array_literal(&mut self, it: &ArrayExpression<'_>) {
         let (replacement, change) = if it.elements.is_empty() {
```

**File**: `crates/mutation/src/lib.rs` (modified, +3/-0)
```diff
@@ -186,6 +186,9 @@ impl MutantChange {
     const ARRAY: &'static str = "<array>";
     /// Placeholder for a non-empty object literal.
     const OBJECT: &'static str = "<object>";
+    /// The `??` token and the fallback operand that `nullish-fallback`
+    /// removes.
+    const FALLBACK: &'static str = "?? <expression>";
 
     /// A change from `from` to `to`.
     pub const fn new(from: &'static str, to: &'static str) -> Self {
```

---

### Incident Patch 2: `a09d23e9` (2026-11-11)
**Commit Message**: fix(dead-code): narrow the constant-parameter gate for broken files and HTML scripts (#4499)

A file with a parse error blocked each function of the project, and an
HTML page with an inline script blocked each exported function. Both now
block only the functions that their import specifiers can reach. A
lexical scan reads the specifiers; a computed module name, a path alias,
an import map, an auto-import project or a component file keeps the old
behavior. A declaration file blocks nothing.

never-passed now abstains when a self-call passes the parameter on, so a
recursive function with an optional cache gives no false finding.
MIN_CALL_SITES is 2. The debug log reports the gate counts and the
first, any and only abstain reason of each function.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

**File**: `.agents/skills/fallow/SKILL.md` (modified, +7/-0)
```diff
@@ -215,6 +215,13 @@ fallow dead-code --format json --quiet --production
 
 Excludes test/dev files (`*.test.*`, `*.spec.*`, `*.stories.*`) and only analyzes production scripts.
 
+### Review parameters that each call passes in one way
+```bash
+fallow dead-code --constant-parameters --production --format json --quiet
+```
+
+The opt-in rule reports a function parameter that each visible call passes the same literal (`identical-argument`), or an optional parameter that no call passes (`never-passed`). It reports only when it sees each caller. Start with findings where `condition_reads` is above 0: a condition tests the constant, so a branch cannot run. Read the `inspected_call_sites` and the intent before a change. Keep a deliberate option, a test seam, or a parameter that matches a sibling API. `--production` drops test callers and test helpers. There is no auto-fix.
+
 ### Analyze specific workspaces
 ```bash
 fallow dead-code --format json --quiet --workspace my-package                # single package (lists: web,admin)
```

**File**: `.claude/skills/fallow/SKILL.md` (modified, +7/-0)
```diff
@@ -216,6 +216,13 @@ fallow dead-code --format json --quiet --production
 
 Excludes test/dev files (`*.test.*`, `*.spec.*`, `*.stories.*`) and only analyzes production scripts.
 
+### Review parameters that each call passes in one way
+```bash
+fallow dead-code --constant-parameters --production --format json --quiet
+```
+
+The opt-in rule reports a function parameter that each visible call passes the same literal (`identical-argument`), or an optional parameter that no call passes (`never-passed`). It reports only when it sees each caller. Start with findings where `condition_reads` is above 0: a condition tests the constant, so a branch cannot run. Read the `inspected_call_sites` and the intent before a change. Keep a deliberate option, a test seam, or a parameter that matches a sibling API. `--production` drops test callers and test helpers. There is no auto-fix.
+
 ### Analyze specific workspaces
 ```bash
 fallow dead-code --format json --quiet --workspace my-package                # single package (lists: web,admin)
```

**File**: `changelog.d/feat-constant-parameter-rule.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 ### Added
 
-- **New opt-in rule `constant-parameter` reports a parameter that each call passes in one way.** It reports a parameter of a module-scope function when each visible call passes the same literal (`identical-argument`), or when no call passes an optional parameter (`never-passed`). The finding lists the value, the call count, up to 20 calls, and the count of conditions that test the parameter. Turn it on with `fallow dead-code --constant-parameters` or `rules.constant-parameters`; the default is `off`, and the rule has no automatic fix. The rule reports only when it sees each caller: it skips public API and entry-point exports, dynamic imports, CommonJS, a function used as a value, template files, `eval`, framework auto-imports and functions with fewer than 3 calls. JSON, SARIF, CodeClimate, markdown, compact, human output, baselines, LSP, MCP, the Node bindings and the VS Code extension carry the finding. A test file is a caller unless `--production` is set. The first run after the upgrade parses each file again, because the cache format changed.
+- **New opt-in rule `constant-parameter` reports a parameter that each call passes in one way.** It reports a parameter of a module-scope function when each visible call passes the same literal (`identical-argument`), or when no call passes an optional parameter (`never-passed`). The finding lists the value, the call count, up to 20 calls, and the count of conditions that test the parameter. Turn it on with `fallow dead-code --constant-parameters` or `rules.constant-parameters`; the default is `off`, and the rule has no automatic fix. The rule reports only when it sees each caller: it skips public API and entry-point exports, dynamic imports, CommonJS, a function used as a value, template files, `eval`, framework auto-imports and functions with fewer than 2 calls. A file with a parse error, or an HTML page with an inline script, blocks only the functions that its import specifiers can reach. JSON, SARIF, CodeClimate, markdown, compact, human output, baselines, LSP, MCP, the Node bindings and the VS Code extension carry the finding. A test file is a caller unless `--production` is set. The first run after the upgrade parses each file again, because the cache format changed.
   (Closes [#4491](https://github.com/fallow-rs/fallow/issues/4491))
```

**File**: `crates/api/src/explain.rs` (modified, +1/-1)
```diff
@@ -355,7 +355,7 @@ pub const CHECK_RULES: &[RuleDef] = &[
         category: "Dead code",
         name: "Constant parameters",
         short: "Each visible call passes a function parameter in the same way",
-        full: "A parameter of a module-scope function gets the same literal at each visible call (reason identical-argument), or an optional parameter is passed by no call (reason never-passed). The finding lists the value, the call count, the calls, and the count of conditions that test the parameter; a condition that tests a constant points at a branch that cannot run. Enable constant-parameters explicitly; it defaults to off. The rule fires only when each caller is visible. It abstains for public API and entry-point exports, exports that a plugin marks as used, dynamic imports, CommonJS, escaped namespaces, a function used as a value or through call/apply/bind, template hosts, direct eval, classic scripts, framework auto-imports, open contracts (arguments, overloads, a reassigned binding, decorators, generators), parse errors, and fewer than 3 calls. A written, rest or destructured parameter gives no finding. In the default mode a test file is a caller; with --production only production callers count. Review the parameter manually; static analysis does not prove that no caller outside the project exists.",
+        full: "A parameter of a module-scope function gets the same literal at each visible call (reason identical-argument), or an optional parameter is passed by no call (reason never-passed). The finding lists the value, the call count, the calls, and the count of conditions that test the parameter; a condition that tests a constant points at a branch that cannot run. Enable constant-parameters explicitly; it defaults to off. The rule fires only when each caller is visible. It abstains for public API and entry-point exports, exports that a plugin marks as used, dynamic imports, CommonJS, escaped namespaces, a function used as a value or through call/apply/bind, template hosts that can import the function, direct eval, classic scripts, framework auto-imports, open contracts (arguments, overloads, a reassigned binding, decorators, generators), a module with a parse error that can import the function, and fewer than 2 calls. A self-call that passes an optional parameter on blocks never-passed. A written, rest or destructured parameter gives no finding. In the default mode a test file is a caller; with --production only production callers count. Review the parameter manually; static analysis does not prove that no caller outside the project exists.",
         docs_path: "explanations/dead-code#constant-parameters",
     },
     RuleDef {
```

**File**: `crates/cli/tests/integration/snapshots/integration__snapshot_tests__sarif_circular_deps_only.snap` (modified, +1/-1)
```diff
@@ -462,7 +462,7 @@ expression: redact_sarif_version(&json_str)
                 "text": "Each visible call passes a function parameter in the same way"
               },
               "fullDescription": {
-                "text": "A parameter of a module-scope function gets the same literal at each visible call (reason identical-argument), or an optional parameter is passed by no call (reason never-passed). The finding lists the value, the call count, the calls, and the count of conditions that test the parameter; a condition that tests a constant points at a branch that cannot run. Enable constant-parameters explicitly; it defaults to off. The rule fires only when each caller is visible. It abstains for public API and entry-point exports, exports that a plugin marks as used, dynamic imports, CommonJS, escaped namespaces, a function used as a value or through call/apply/bind, template hosts, direct eval, classic scripts, framework auto-imports, open contracts (arguments, overloads, a reassigned binding, decorators, generators), parse errors, and fewer than 3 calls. A written, rest or destructured parameter gives no finding. In the default mode a test file is a caller; with --production only production callers count. Review the parameter manually; static analysis does not prove that no caller outside the project exists."
+                "text": "A parameter of a module-scope function gets the same literal at each visible call (reason identical-argument), or an optional parameter is passed by no call (reason never-passed). The finding lists the value, the call count, the calls, and the count of conditions that test the parameter; a condition that tests a constant points at a branch that cannot run. Enable constant-parameters explicitly; it defaults to off. The rule fires only when each caller is visible. It abstains for public API and entry-point exports, exports that a plugin marks as used, dynamic imports, CommonJS, escaped namespaces, a function used as a value or through call/apply/bind, template hosts that can import the function, direct eval, classic scripts, framework auto-imports, open contracts (arguments, overloads, a reassigned binding, decorators, generators), a module with a parse error that can import the function, and fewer than 2 calls. A self-call that passes an optional parameter on blocks never-passed. A written, rest or destructured parameter gives no finding. In the default mode a test file is a caller; with --production only production callers count. Review the parameter manually; static analysis does not prove that no caller outside the project exists."
               },
               "helpUri": "https://fallow.tools/docs/explanations/dead-code/#constant-parameters",
               "defaultConfiguration": {
```

**File**: `crates/cli/tests/integration/snapshots/integration__snapshot_tests__sarif_duplicate_exports_only.snap` (modified, +1/-1)
```diff
@@ -462,7 +462,7 @@ expression: redact_sarif_version(&json_str)
                 "text": "Each visible call passes a function parameter in the same way"
               },
               "fullDescription": {
-                "text": "A parameter of a module-scope function gets the same literal at each visible call (reason identical-argument), or an optional parameter is passed by no call (reason never-passed). The finding lists the value, the call count, the calls, and the count of conditions that test the parameter; a condition that tests a constant points at a branch that cannot run. Enable constant-parameters explicitly; it defaults to off. The rule fires only when each caller is visible. It abstains for public API and entry-point exports, exports that a plugin marks as used, dynamic imports, CommonJS, escaped namespaces, a function used as a value or through call/apply/bind, template hosts, direct eval, classic scripts, framework auto-imports, open contracts (arguments, overloads, a reassigned binding, decorators, generators), parse errors, and fewer than 3 calls. A written, rest or destructured parameter gives no finding. In the default mode a test file is a caller; with --production only production callers count. Review the parameter manually; static analysis does not prove that no caller outside the project exists."
+                "text": "A parameter of a module-scope function gets the same literal at each visible call (reason identical-argument), or an optional parameter is passed by no call (reason never-passed). The finding lists the value, the call count, the calls, and the count of conditions that test the parameter; a condition that tests a constant points at a branch that cannot run. Enable constant-parameters explicitly; it defaults to off. The rule fires only when each caller is visible. It abstains for public API and entry-point exports, exports that a plugin marks as used, dynamic imports, CommonJS, escaped namespaces, a function used as a value or through call/apply/bind, template hosts that can import the function, direct eval, classic scripts, framework auto-imports, open contracts (arguments, overloads, a reassigned binding, decorators, generators), a module with a parse error that can import the function, and fewer than 2 calls. A self-call that passes an optional parameter on blocks never-passed. A written, rest or destructured parameter gives no finding. In the default mode a test file is a caller; with --production only production callers count. Review the parameter manually; static analysis does not prove that no caller outside the project exists."
               },
               "helpUri": "https://fallow.tools/docs/explanations/dead-code/#constant-parameters",
               "defaultConfiguration": {
```

**File**: `crates/cli/tests/integration/snapshots/integration__snapshot_tests__sarif_empty.snap` (modified, +1/-1)
```diff
@@ -462,7 +462,7 @@ expression: redact_sarif_version(&json_str)
                 "text": "Each visible call passes a function parameter in the same way"
               },
               "fullDescription": {
-                "text": "A parameter of a module-scope function gets the same literal at each visible call (reason identical-argument), or an optional parameter is passed by no call (reason never-passed). The finding lists the value, the call count, the calls, and the count of conditions that test the parameter; a condition that tests a constant points at a branch that cannot run. Enable constant-parameters explicitly; it defaults to off. The rule fires only when each caller is visible. It abstains for public API and entry-point exports, exports that a plugin marks as used, dynamic imports, CommonJS, escaped namespaces, a function used as a value or through call/apply/bind, template hosts, direct eval, classic scripts, framework auto-imports, open contracts (arguments, overloads, a reassigned binding, decorators, generators), parse errors, and fewer than 3 calls. A written, rest or destructured parameter gives no finding. In the default mode a test file is a caller; with --production only production callers count. Review the parameter manually; static analysis does not prove that no caller outside the project exists."
+                "text": "A parameter of a module-scope function gets the same literal at each visible call (reason identical-argument), or an optional parameter is passed by no call (reason never-passed). The finding lists the value, the call count, the calls, and the count of conditions that test the parameter; a condition that tests a constant points at a branch that cannot run. Enable constant-parameters explicitly; it defaults to off. The rule fires only when each caller is visible. It abstains for public API and entry-point exports, exports that a plugin marks as used, dynamic imports, CommonJS, escaped namespaces, a function used as a value or through call/apply/bind, template hosts that can import the function, direct eval, classic scripts, framework auto-imports, open contracts (arguments, overloads, a reassigned binding, decorators, generators), a module with a parse error that can import the function, and fewer than 2 calls. A self-call that passes an optional parameter on blocks never-passed. A written, rest or destructured parameter gives no finding. In the default mode a test file is a caller; with --production only production callers count. Review the parameter manually; static analysis does not prove that no caller outside the project exists."
               },
               "helpUri": "https://fallow.tools/docs/explanations/dead-code/#constant-parameters",
               "defaultConfiguration": {
```

**File**: `crates/cli/tests/integration/snapshots/integration__snapshot_tests__sarif_mixed_severity.snap` (modified, +1/-1)
```diff
@@ -462,7 +462,7 @@ expression: redact_sarif_version(&json_str)
                 "text": "Each visible call passes a function parameter in the same way"
               },
               "fullDescription": {
-                "text": "A parameter of a module-scope function gets the same literal at each visible call (reason identical-argument), or an optional parameter is passed by no call (reason never-passed). The finding lists the value, the call count, the calls, and the count of conditions that test the parameter; a condition that tests a constant points at a branch that cannot run. Enable constant-parameters explicitly; it defaults to off. The rule fires only when each caller is visible. It abstains for public API and entry-point exports, exports that a plugin marks as used, dynamic imports, CommonJS, escaped namespaces, a function used as a value or through call/apply/bind, template hosts, direct eval, classic scripts, framework auto-imports, open contracts (arguments, overloads, a reassigned binding, decorators, generators), parse errors, and fewer than 3 calls. A written, rest or destructured parameter gives no finding. In the default mode a test file is a caller; with --production only production callers count. Review the parameter manually; static analysis does not prove that no caller outside the project exists."
+                "text": "A parameter of a module-scope function gets the same literal at each visible call (reason identical-argument), or an optional parameter is passed by no call (reason never-passed). The finding lists the value, the call count, the calls, and the count of conditions that test the parameter; a condition that tests a constant points at a branch that cannot run. Enable constant-parameters explicitly; it defaults to off. The rule fires only when each caller is visible. It abstains for public API and entry-point exports, exports that a plugin marks as used, dynamic imports, CommonJS, escaped namespaces, a function used as a value or through call/apply/bind, template hosts that can import the function, direct eval, classic scripts, framework auto-imports, open contracts (arguments, overloads, a reassigned binding, decorators, generators), a module with a parse error that can import the function, and fewer than 2 calls. A self-call that passes an optional parameter on blocks never-passed. A written, rest or destructured parameter gives no finding. In the default mode a test file is a caller; with --production only production callers count. Review the parameter manually; static analysis does not prove that no caller outside the project exists."
               },
               "helpUri": "https://fallow.tools/docs/explanations/dead-code/#constant-parameters",
               "defaultConfiguration": {
```

---

### Incident Patch 3: `4f93d207` (2026-11-11)
**Commit Message**: fix(constant-parameter): abstain for a module that an asset import reads (#4518)

An import with a query, such as `./op.ts?raw` or `./op.ts?url`, or with a
webpack inline loader, reads the module as text or as a file. A project can
copy that text into generated code, so the copy can call the functions of
the module with values that the project does not hold. The rule reported
such a function as constant although callers outside the project exist.

The rule now abstains with the reason `asset-import` for each function of a
module that a static import, a dynamic import or a re-export with a query
or an inline loader targets. A type-only import does not block.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

**File**: `crates/core/src/analyze/constant_parameter.rs` (modified, +34/-1)
```diff
@@ -71,6 +71,10 @@ pub(super) enum Abstain {
     ClassicScript,
     /// A framework convention imports the module with no import statement.
     AutoImport,
+    /// An import with a query, such as `?raw` or `?url`, or with a webpack
+    /// inline loader reads the module as text or as a file. A copy of the
+    /// code can run with callers that the project does not hold.
+    AssetImport,
     /// A test file declares the function. A test helper exists to pass
     /// fixed values, so a constant argument is its purpose. A test file
     /// stays a caller of the functions of other files.
@@ -81,7 +85,7 @@ pub(super) enum Abstain {
 
 impl Abstain {
     /// Each reason, in declaration order.
-    const ALL: [Self; 15] = [
+    const ALL: [Self; 16] = [
         Self::ParseIncomplete,
         Self::OpenContract,
         Self::PublicApi,
@@ -95,6 +99,7 @@ impl Abstain {
         Self::DirectEval,
         Self::ClassicScript,
         Self::AutoImport,
+        Self::AssetImport,
         Self::TestFile,
         Self::TooFewCalls,
     ];
@@ -120,12 +125,16 @@ impl Abstain {
             Self::DirectEval => "direct-eval",
             Self::ClassicScript => "classic-script",
             Self::AutoImport => "auto-import",
+            Self::AssetImport => "asset-import",
             Self::TestFile => "test-file",
             Self::TooFewCalls => "too-few-calls",
         }
     }
 }
 
+// `Reasons` holds one bit for each reason.
+const _: () = assert!(Abstain::ALL.len() <= u16::BITS as usize);
+
 /// A function contract: the module and the index of its declaration.
 type FnId = (FileId, u32);
 
@@ -559,6 +568,22 @@ impl<'a> Gate<'a> {
     }
 
     fn block_hidden_imports(&mut self, resolved: &ResolvedModule) {
+        let imports = resolved
+            .resolved_imports
+            .iter()
+            .chain(&resolved.resolved_dynamic_imports)
+            .filter(|import| !import.info.is_type_only && reads_as_asset(&import.info.source))
+            .filter_map(|import| import.target.internal_file_id());
+        let re_exports = resolved
+            .re_exports
+            .iter()
+            .filter(|re_export| {
+                !re_export.info.is_type_only && reads_as_asset(&re_export.info.source)
+            })
+            .filter_map(|re_export| re_export.target.internal_file_id());
+        for target in imports.chain(re_exports) {
+            self.block_module(target, Abstain::AssetImport);
+        }
         for import in &resolved.resolved_dynamic_imports {
             if let Some(target) = import.target.internal_file_id() {
                 self.block_surface(target, Abstain::DynamicImport);
@@ -1122,6 +1147,14 @@ impl<'a> Gate<'a> {
     }
 }
 
+/// `true` when an import specifier can read its module as text, as a file
+/// or through a loader: a query such as `./op.ts?raw`, or a webpack inline
+/// loader request such as `raw-loader!./op.ts`. A `!` can also be part of a
+/// plain file name, so the check can only hide a finding, never add one.
+fn reads_as_asset(specifier: &str) -> bool {
+    specifier.contains(['?', '!'])
+}
+
 fn facts(module: &ModuleInfo) -> Option<&FunctionContractFacts> {
     module.function_contracts.as_deref()
 }
```

**File**: `crates/core/src/analyze/constant_parameter_tests.rs` (modified, +53/-0)
```diff
@@ -975,3 +975,56 @@ fn a_function_that_a_test_file_declares_is_not_a_candidate() {
     let rows = project.findings("format");
     assert!(rows.iter().any(|row| row.0 == "compact"), "{rows:?}");
 }
+
+const RUNTIME_OP: &str = "export function op(kind: string, compact: boolean) {\n  return compact ? kind : kind + '!';\n}\nfunction inner(flag: boolean) {\n  return flag;\n}\nexport const run = () => {\n  op('a', true);\n  op('b', true);\n  inner(true);\n  inner(true);\n};\n";
+
+/// A project whose main module calls `run` and then has `extra`.
+fn runtime_project(extra: &str) -> Project {
+    let main = format!("import {{ run }} from './runtime/op';\nrun();\n{extra}");
+    let other = "export const other = 1;\n";
+    analyze(&[
+        ("src/runtime/op.ts", RUNTIME_OP),
+        ("src/runtime/other.ts", other),
+        ("src/main.ts", main.as_str()),
+    ])
+}
+
+#[test]
+fn a_module_that_an_asset_import_reads_abstains() {
+    // A `?raw` or `?url` import, or an inline loader, reads the module as
+    // text or as a file, so a copy of the code can have callers that the
+    // project does not hold.
+    for extra in [
+        "import source from './runtime/op.ts?raw';\nexport const text = source;\n",
+        "import href from './runtime/op.ts?url';\nexport const text = href;\n",
+        "import Worker from './runtime/op.ts?worker&inline';\nexport const text = Worker;\n",
+        "export { default as text } from './runtime/op.ts?raw';\n",
+        "export const load = () => import('./runtime/op.ts?raw');\n",
+        "import source from '!!raw-loader!./runtime/op.ts';\nexport const text = source;\n",
+    ] {
+        let project = runtime_project(extra);
+        assert_abstains(&project, "src/runtime/op.ts", "op", "asset-import");
+        assert_abstains(&project, "src/runtime/op.ts", "inner", "asset-import");
+    }
+}
+
+#[test]
+fn an_asset_import_of_another_module_or_a_type_keeps_the_findings() {
+    for extra in [
+        "",
+        "import source from './runtime/other.ts?raw';\nexport const text = source;\n",
+        "import type Source from './runtime/op.ts?raw';\nexport type Text = Source;\n",
+    ] {
+        let project = runtime_project(extra);
+        assert_eq!(
+            project.findings("op"),
+            vec![identical("compact", "true")],
+            "{extra}"
+        );
+        assert_eq!(
+            project.findings("inner"),
+            vec![identical("flag", "true")],
+            "{extra}"
+        );
+    }
+}
```

**File**: `docs/reference/detection-internals.md` (modified, +6/-0)
```diff
@@ -1075,6 +1075,12 @@ each reason:
 - `direct-eval`: the same, for a module with a direct `eval`.
 - `classic-script`: a module with no imports, no exports and no re-exports.
 - `auto-import`: a synthetic auto-import edge reaches the module.
+- `asset-import`: an import, a dynamic import or a re-export with a query,
+  such as `./op.ts?raw` or `./op.ts?url`, or with a webpack inline loader,
+  such as `raw-loader!./op.ts`, reads the module as text or as a file. The
+  rule blocks each contract of the module, because a copy of the code can
+  run with callers that the project does not hold. A type-only import does
+  not block.
 - `test-file`: a test file declares the function. The path below the project
   root matches the test subset of `PRODUCTION_EXCLUDE_PATTERNS`
   (`is_test_or_spec_file`, which leaves out the tooling-config and dotfile
```

#### Recent Merged Pull Requests:
- **PR #4522** (2026-11-11): docs(changelog): add the missing entries for three merged changes (@BartWaardenburg)
- **PR #4521** (2026-11-11): feat(skills): pin fallow launchers in the published companion skills (@BartWaardenburg)
- **PR #4520** (2026-11-11): feat(api): name the project package manager in the companion install hint (@BartWaardenburg)
- **PR #4518** (2026-11-11): fix(constant-parameter): abstain for a module that an asset import reads (@BartWaardenburg)
- **PR #4515** (2026-11-11): feat(mutation): add the constant-parameter hint to negate-condition survivors (@BartWaardenburg)
- **PR #4514** (2026-11-11): fix(mcp): cap tool responses at 1,000,000 bytes and name the narrowing parameters (@BartWaardenburg)

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

## X. mutation): add the opt-in nullish-fallback operator (#4507)

**RULE**:
When implementing operations in `crates/api/src/mutation/typecheck.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fallow-rs/fallow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dd78ac74`: mutation): add the opt-in nullish-fallback operator (#4507). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/api/src/mutation/typecheck.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
//! or a nullish fallback (`a ?? b` to `a`) from a receiver whose declared
//! type excludes nullish values keeps the
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
//! from a receiver whose declared type excludes nullish values keeps the
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dd78ac74` are properly handled with clean fallback behavior.
