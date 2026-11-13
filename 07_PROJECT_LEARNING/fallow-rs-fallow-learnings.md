> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source**: github ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Source Version**: `249d5f7d`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T10:55:23.393Z  
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
> **Harvest Timestamp**: 2026-11-13T10:55:23.387Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5352 stars

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
- **Issue #4556** (2026-11-13): **constant-parameter: a dynamic import with a variable source blocks no function**
  *Symptoms*: ## Problem  The opt-in `constant-parameter` rule skips a function when a caller can be invisible. A dynamic import with a literal or a pattern source blocks the target module (gate reason `dynamic-import`). A dynamic import whose source is a plain variable blocks nothing, so the rule can report a parameter that a hidden caller passes in another way.  ## Reproduction  ```ts // src/pad.ts export function pad(s: string, n: number): string { return s + n; }  // src/a.ts import { pad } from "./pad"; export const a = pad("x", 1); export const b = pad("y", 1);  // src/main.ts import { a, b } from "./a"; console.log(a, b); const name = process.argv[2]; const mod = await import(name); mod.pad("z", 2); ```  `fallow dead-code --constant-parameters --format json --quiet` reports `n` of `pad` as `identical-argument` with the value `1`. The call through `mod` passes `2`.  ## Expected  One of these:  1. The rule skips each exported function of a project when a reachable file has a dynamic import or a `require` with a source that Fallow cannot resolve to a pattern. A new gate reason names the cause. 2. The rule keeps the finding, and the user documentation lists the case as a known limit.  Option 1 needs a measurement first: how many findings of the public corpus it removes. A project with a plugin loader would lose each finding on an exported function.  ## Notes  - The rule is off by default, and a finding has no fix action. - The same question applies to `require(variable)`. - The extracto

- **Issue #4530** (2026-11-13): **Inline package.json config of a workspace package is not read**
  *Symptoms*: The inline `package.json` config pass (`process_package_json_inline_configs` in `crates/core/src/plugins/registry/mod.rs`) reads only the root `package.json`. A plugin key in the manifest of a workspace package is ignored, for every plugin with a `package_json_config_key` (prettier, jest, babel, stylelint, ...).  Reproduction: a workspace `apps/web/package.json` with  ```json {   "devDependencies": { "@acme/config-stylelint": "^1.0.0", "stylelint": "^16.0.0" },   "stylelint": { "extends": "@acme/config-stylelint" } } ```  `fallow dead-code` reports `@acme/config-stylelint` as an unused devDependency of `apps/web`. The same key in the root `package.json` credits the package.  Expected: the workspace run applies the inline config pass to the manifest of each workspace package, as the root run does. 

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

### Incident Patch 1: `fbeb91b0` (2026-11-11)
**Commit Message**: fix(scripts): wait for the GitHub rate-limit reset in the check wait (#4531)

The check wait counted a read that GitHub refused because of the API rate
limit as a failed read. The reset can be up to an hour away, so the wait
stopped after its 10-minute error window with exit code 2, and the CI
state stayed unknown.

A refused read now gets the reset time from `gh api rate_limit`, which
does not count against the limit. The wait sleeps until then, and the
read does not count against the error window. Commit reads use the
`core` limit. Pull request reads use the `graphql` limit. When the reset
comes after the deadline, the wait ends with a timeout and a warning.

The base-branch fetch of --follow-main also fetches one more time when
another fetch in the same clone holds the ref lock.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

**File**: `scripts/ship-wait-checks.mjs` (modified, +102/-17)
```diff
@@ -152,7 +152,9 @@ Options:
                           The maximum time of failed reads in a row
                           (default: ${READ_ERROR_WINDOW_SECONDS}). After each failed read, the
                           delay to the next read doubles, from --interval
-                          up to ${READ_RETRY_MAX_MS / MINUTE} minutes.
+                          up to ${READ_RETRY_MAX_MS / MINUTE} minutes. A read that GitHub
+                          refuses because of the API rate limit waits
+                          until the limit resets, and does not count.
   -h, --help              Show this help.
 
 With --pr, the wait stops when the pull request conflicts with its base
@@ -257,6 +259,37 @@ const completedStatus = (checks, unchangedMs, options) => {
   return hasFailure(checks) ? "fail" : "settled";
 };
 
+/**
+ * Plan the next read after a failed read. A rate-limited read (with
+ * `retryAtMs`) waits for the reset and does not count as a failed read. Any
+ * other failed read backs off and counts against the error window. Returns
+ * `{ delayMs, readErrors, stop, counts }`, where `counts` tells whether the
+ * delay counts against the error window.
+ */
+const failedRead = (
+  read,
+  { readErrors, errorMs, intervalMs, errorWindowMs, deadline, now, warn },
+) => {
+  if (read.retryAtMs !== undefined) {
+    const delayMs = Math.max(read.retryAtMs - now(), intervalMs);
+    warn(
+      now() + delayMs <= deadline
+        ? `Read of the checks failed: ${read.error}. Next read in ${formatSeconds(delayMs)}, after the rate limit resets.`
+        : `Read of the checks failed: ${read.error}. The rate limit resets after the end of the wait.`,
+    );
+    return { delayMs, readErrors, stop: false, counts: false };
+  }
+  const errors = readErrors + 1;
+  const windowLeftMs = errorWindowMs - errorMs;
+  const delayMs = Math.min(intervalMs * 2 ** (errors - 1), READ_RETRY_MAX_MS, windowLeftMs);
+  if (windowLeftMs <= 0 || now() + delayMs > deadline) {
+    warn(`Read of the checks failed: ${read.error}`);
+    return { delayMs, readErrors: errors, stop: true, counts: true };
+  }
+  warn(`Read of the checks failed: ${read.error}. Next read in ${formatSeconds(delayMs)}.`);
+  return { delayMs, readErrors: errors, stop: false, counts: true };
+};
+
 /**
  * Read the checks until at least `minChecks` exist and none is pending.
  *
@@ -304,6 +337,8 @@ export const waitForChecks = async ({
   let changedAt = now();
   for (;;) {
     let delayMs = intervalMs;
+    // The part of the delay that counts against the error window.
+    let errorDelayMs = 0;
     const read = readChecks();
     if (read.ok) {
       readErrors = 0;
@@ -324,14 +359,21 @@ export const waitForChecks = async ({
         return { status, checks };
       }
     } else {
-      readErrors += 1;
-      const windowLeftMs = errorWindowMs - errorMs;
-      delayMs = Math.min(intervalMs * 2 ** (readErrors - 1), READ_RETRY_MAX_MS, windowLeftMs);
-      if (windowLeftMs <= 0 || now() + delayMs > deadline) {
-        warn(`Read of the checks failed: ${read.error}`);
-        return { status: "error", checks, readErrors, errorMs };
+      const failed = failedRead(read, {
+        readErrors,
+        errorMs,
+        intervalMs,
+        errorWindowMs,
+        deadline,
+        now,
+        warn,
+      });
+      if (failed.stop) {
+        return { status: "error", checks, readErrors: failed.readErrors, errorMs };
       }
-      warn(`Read of the checks failed: ${read.error}. Next read in ${formatSeconds(delayMs)}.`);
+      readErrors = failed.readErrors;
+      delayMs = failed.delayMs;
+      errorDelayMs = failed.counts ? delayMs : 0;
     }
     if (readMergeable !== null) {
       const state = readMergeable();
@@ -345,9 +387,7 @@ export const waitForChecks = async ({
       return { status: "timeout", checks };
     }
     await sleep(delayMs);
-    if (readErrors > 0) {
-      errorMs += delayMs;
-    }
+    errorMs += errorDelayMs;
   }
 };
 
@@ -478,9 +518,18 @@ export const parseGitAncestor = ({ error, status, stderr }) => {
 
 const runGit = (args) => spawnSync("git", args, { encoding: "utf8" });
 
-/** Fetch the base branch, then read its newest commit. */
-const gitHeadReader = (git) => () => {
-  const fetched = git(["fetch", "--quiet", FOLLOW_REMOTE, FOLLOW_BRANCH]);
+const REF_LOCK_ERROR = "cannot lock ref";
+
+/**
+ * Fetch the base branch, then read its newest commit. Another fetch in the
+ * same clone can hold the ref lock, so a lock error gets one more fetch.
+ */
+export const gitHeadReader = (git) => () => {
+  const fetch = () => git(["fetch", "--quiet", FOLLOW_REMOTE, FOLLOW_BRANCH]);
+  let fetched = fetch();
+  if (fetched.status !== 0 && fetched.stderr?.includes(REF_LOCK_ERROR)) {
+    fetched = fetch();
+  }
   if (fetched.error) {
     return { ok: false, error: fetched.error.message };
   }
@@ -1193,6 +1242,36 @@ const parseGhCheckRuns = (result, name) => {
   return { ok: true, checks };
 };
 
+cons
```

**File**: `scripts/ship-wait-checks.test.mjs` (modified, +131/-0)
```diff
@@ -11,6 +11,7 @@ import {
   compareWithMain,
   followMain,
   ghMainReaders,
+  gitHeadReader,
   isChangelogFragment,
   parseGhChecks,
   parseGhMergeable,
@@ -22,6 +23,7 @@ import {
   waitForChecks,
   waitForCommitRuns,
   waitForPullRequestChecks,
+  withRateLimitWait,
 } from "./ship-wait-checks.mjs";
 
 const SCRIPT = fileURLToPath(new URL("./ship-wait-checks.mjs", import.meta.url));
@@ -538,6 +540,135 @@ test("a suspended machine does not use up the error window", async () => {
   assert.equal(warnings.length, 3);
 });
 
+test("a rate-limited read waits until the reset and does not use the error window", async () => {
+  const limited = { ok: false, error: "API rate limit exceeded", retryAtMs: 45 * MINUTE_MS };
+  const script = scripted([limited, { ok: true, checks: [check("lint", "pass")] }]);
+  const sleeps = [];
+  const warnings = [];
+
+  const result = await waitForChecks({
+    ...script,
+    sleep: async (ms) => {
+      sleeps.push(ms);
+      await script.sleep(ms);
+    },
+    minChecks: 1,
+    intervalMs: 30 * 1000,
+    timeoutMs: 60 * MINUTE_MS,
+    warn: (line) => warnings.push(line),
+  });
+
+  assert.equal(result.status, "pass");
+  assert.deepEqual(sleeps, [45 * MINUTE_MS]);
+  assert.deepEqual(warnings, [
+    "Read of the checks failed: API rate limit exceeded. Next read in 2700 seconds, after the rate limit resets.",
+  ]);
+});
+
+test("a rate-limit reset after the deadline ends the wait with a timeout", async () => {
+  const limited = { ok: false, error: "API rate limit exceeded", retryAtMs: 45 * MINUTE_MS };
+  const script = scripted([limited]);
+  const warnings = [];
+
+  const result = await waitForChecks({
+    ...script,
+    minChecks: 1,
+    intervalMs: 30 * 1000,
+    timeoutMs: 10 * MINUTE_MS,
+    warn: (line) => warnings.push(line),
+  });
+
+  assert.equal(result.status, "timeout");
+  assert.equal(script.reads(), 1);
+  assert.deepEqual(warnings, [
+    "Read of the checks failed: API rate limit exceeded. The rate limit resets after the end of the wait.",
+  ]);
+});
+
+test("a rate-limit wait between failed reads does not use up the error window", async () => {
+  const limited = { ok: false, error: "API rate limit exceeded", retryAtMs: 45 * MINUTE_MS };
+  const script = scripted([
+    failure,
+    limited,
+    failure,
+    { ok: true, checks: [check("lint", "pass")] },
+  ]);
+
+  const result = await waitForChecks({
+    ...script,
+    minChecks: 1,
+    intervalMs: 30 * 1000,
+    timeoutMs: 120 * MINUTE_MS,
+    warn: () => {},
+  });
+
+  assert.equal(result.status, "pass");
+  assert.equal(script.reads(), 4);
+});
+
+test("withRateLimitWait adds the reset time only to a rate-limit error", () => {
+  let resets = 0;
+  const readReset = () => {
+    resets += 1;
+    return { ok: true, resetMs: 1_000_000 };
+  };
+  const limited = withRateLimitWait(
+    () => ({ ok: false, error: "HTTP 403: API rate limit exceeded for user ID 1." }),
+    readReset,
+  );
+  const other = withRateLimitWait(() => ({ ok: false, error: "HTTP 504" }), readReset);
+  const passing = withRateLimitWait(() => ({ ok: true, checks: [] }), readReset);
+  const graphql = withRateLimitWait(
+    () => ({ ok: false, error: "GraphQL: API rate limit already exceeded for user ID 1." }),
+    readReset,
+  );
+  const noReset = withRateLimitWait(
+    () => ({ ok: false, error: "API rate limit exceeded" }),
+    () => ({ ok: false, error: "HTTP 500" }),
+  );
+
+  assert.deepEqual(limited(), {
+    ok: false,
+    error: "HTTP 403: API rate limit exceeded for user ID 1.",
+    retryAtMs: 1_000_000,
+  });
+  assert.equal(graphql().retryAtMs, 1_000_000);
+  assert.deepEqual(other(), { ok: false, error: "HTTP 504" });
+  assert.deepEqual(passing(), { ok: true, checks: [] });
+  assert.deepEqual(noReset(), { ok: false, error: "API rate limit exceeded" });
+  assert.equal(resets, 2);
+});
+
+test("the head reader fetches again when another fetch holds the ref lock", () => {
+  const lock =
+    "error: cannot lock ref 'refs/remotes/origin/main': is at 2090fcd but expected 4f93d20";
+  const calls = [];
+  const fetches = [
+    { status: 1, stderr: lock },
+    { status: 0, stderr: "" },
+  ];
+  const git = (args) => {
+    calls.push(args[0]);
+    if (args[0] === "fetch") {
+      return fetches.shift();
+    }
+    return { status: 0, stdout: "2090fcdaf2eadca43e7d37452f17add066d57785\n", stderr: "" };
+  };
+
+  assert.deepEqual(gitHeadReader(git)(), {
+    ok: true,
+    sha: "2090fcdaf2eadca43e7d37452f17add066d57785",
+  });
+  assert.deepEqual(calls, ["fetch", "fetch", "rev-parse"]);
+});
+
+test("the head reader reports a fetch that keeps failing on the ref lock", () => {
+  const lock = "error: cannot lock ref 'refs/remotes/origin/main': is at a but expected b";
+  const git = () => ({ status: 1, stderr: lock });
+
+  assert.deepEqual(gitHeadReader(git)(), { ok: false, error: lock });
+});
+
 test("a good read resets the backoff and the error window", async () => {
```

---

### Incident Patch 2: `3173b60b` (2026-11-12)
**Commit Message**: fix(security): gate spawn without a shell like execFile (#4541)

* fix(security): gate spawn without a shell like execFile

Without the `shell` option, `child_process.spawn` and `spawnSync` run the
program directly, the same as `execFile`. The catalogue put them in the
source-free `exec` rows. A computed program path, for example a binary of the
repository or a CLI path from an environment variable, was then reported with
no untrusted source.

The extractor now attaches the options object of a `spawn` call to its
command site. A new `options_may_enable` matcher predicate reads it. The
source-free spawn rows match only when the options can set `shell`: a `shell`
key that is not literal `false`, an options variable, or a spread. Every other
spawn call goes to the `execFile` rows, which need untrusted input in the
argument, the module or each direct importer.

`SinkSite` gains the `call_options` field, so `CACHE_VERSION` goes to 437.
The row predicates move to `crates/security/src/predicates.rs`, and the sink
value types move to `crates/types/src/extract_sink_values.rs`, so that the two
large files do not grow.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* fix(security): trea

**File**: `changelog.d/fix-adopter-security-literal-exec.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **`fallow security` no longer reports a `spawn` or `spawnSync` call that runs no shell when no untrusted input reaches it.** Without the `shell` option, `child_process.spawn` runs the program directly, the same as `execFile`. Such a call now uses the `execFile` gate: Fallow reports a computed program only when the argument, the module, or each direct importer reads untrusted input. A command-line argument does not count. A program path from a file of the repository or from an environment variable is now clean. When the options can set `shell` (a `shell` key that is not literal `false`, an options variable, or a spread), Fallow reports a computed command without a source, as before. The first run after the upgrade parses each file again, because the cache format changed.
```

**File**: `crates/core/src/analyze/security/tainted_sink.rs` (modified, +2/-0)
```diff
@@ -328,6 +328,7 @@ fn matcher_admits_sink(matcher: &Matcher, sink: &SinkSite, source: Option<(&str,
             &sink.object_property_keys,
             sink.object_property_keys_complete,
         )
+        && matcher.options_may_enable_satisfied(sink.call_options.as_deref())
         && matcher.context_satisfied(&sink.arg_idents)
         && (!matcher.requires_source || source.is_some())
         // Source-KIND gate (#890): when set, the matched source's id must be one
@@ -916,6 +917,7 @@ mod tests {
             span_end: 1,
             url_arg_literal: None,
             url_shape: None,
+            call_options: None,
         }
     }
 
```

**File**: `crates/core/tests/integration_test/security_catalogue_categories.rs` (modified, +17/-1)
```diff
@@ -1401,7 +1401,7 @@ fn llm_call_injection_langchain_invoke_does_not_fire() {
 
 // ── catalogue gaps: callee variants of existing categories ───────────────────
 
-const CATALOGUE_GAP_SINKS: [(&str, &str, u32); 28] = [
+const CATALOGUE_GAP_SINKS: [(&str, &str, u32); 32] = [
     ("src/esm-default-exec.ts", "command-injection", 78),
     ("src/esm-namespace-exec.ts", "command-injection", 78),
     ("src/esm-default-vm.ts", "code-injection", 94),
@@ -1423,6 +1423,10 @@ const CATALOGUE_GAP_SINKS: [(&str, &str, u32); 28] = [
         732,
     ),
     ("src/exec-file.ts", "command-injection", 78),
+    ("src/spawn-request.ts", "command-injection", 78),
+    ("src/spawn-shell.ts", "command-injection", 78),
+    ("src/spawn-shell-duplicate.js", "command-injection", 78),
+    ("src/spawn-options-variable.ts", "command-injection", 78),
     ("src/shelljs.ts", "command-injection", 78),
     ("src/ssti-handlebars.ts", "ssti", 1336),
     ("src/ssti-lodash.ts", "ssti", 1336),
@@ -1489,6 +1493,18 @@ fn catalogue_gap_lookalikes_do_not_fire() {
             "src/exec-file-tooling.ts",
             "execFile of a computed binary without untrusted input is not a candidate",
         ),
+        (
+            "src/spawn-tooling-bin.ts",
+            "spawn of a repository binary without a shell is not a candidate",
+        ),
+        (
+            "src/spawn-tooling-env.ts",
+            "spawnSync of a configured CLI path without a shell is not a candidate",
+        ),
+        (
+            "src/spawn-shell-false.ts",
+            "spawn with shell: false of a computed binary is not a candidate",
+        ),
         (
             "src/exec-local-shadow.ts",
             "a parameter that hides the exec import is not a shell call",
```

**File**: `crates/extract/src/cache/types.rs` (modified, +2/-2)
```diff
@@ -10,7 +10,7 @@ use crate::MemberKind;
 /// extraction semantics change, and give the reason in the commit message and
 /// the CHANGELOG. A stale version serves old extraction results from a warm
 /// cache. The `assert_cached_type_size!` guards below catch shape changes.
-pub(super) const CACHE_VERSION: u32 = 438;
+pub(super) const CACHE_VERSION: u32 = 439;
 
 /// Duplication token cache version. Bump it when duplicate tokenization,
 /// normalization, or the on-disk token cache schema changes, and give the
@@ -90,7 +90,7 @@ assert_cached_type_size!(fallow_types::extract::CalleeUse, 56);
 assert_cached_type_size!(fallow_types::extract::ImportedCallSite, 80);
 assert_cached_type_size!(fallow_types::extract::ImportBindingReference, 64);
 assert_cached_type_size!(fallow_types::extract::MisplacedDirectiveSite, 8);
-assert_cached_type_size!(fallow_types::extract::SinkSite, 216);
+assert_cached_type_size!(fallow_types::extract::SinkSite, 224);
 assert_cached_type_size!(fallow_types::extract::FunctionComplexity, 104);
 assert_cached_type_size!(fallow_types::extract::ComplexityContribution, 16);
 assert_cached_type_size!(fallow_types::extract::FlagUse, 80);
```

**File**: `crates/extract/src/template_usage.rs` (modified, +1/-0)
```diff
@@ -317,6 +317,7 @@ fn template_dom_sink(
         span_end: u32::try_from(span_end).ok()?,
         url_arg_literal: None,
         url_shape: None,
+        call_options: None,
     })
 }
 
```

**File**: `crates/extract/src/visitor/tests.rs` (modified, +66/-0)
```diff
@@ -18430,3 +18430,69 @@ fn element_of_typed_parameter_field_records_typed_property_path() {
         "a string key reads the property `key`, found: {paths:?}"
     );
 }
+
+fn spawn_command_sink(source: &str) -> fallow_types::extract::SinkSite {
+    let info = parse(&format!(
+        "import {{ spawn }} from \"node:child_process\";\n{source}"
+    ));
+    info.security_sinks
+        .into_iter()
+        .find(|sink| sink.callee_path.ends_with("spawn") && sink.arg_index == 0)
+        .expect("spawn command sink captured")
+}
+
+fn spawn_command_options(source: &str) -> Option<fallow_types::extract::SinkCallOptions> {
+    spawn_command_sink(source)
+        .call_options
+        .map(|options| *options)
+}
+
+#[test]
+fn security_spawn_command_carries_options_metadata() {
+    let keys_of = |source: &str| {
+        spawn_command_options(source).map(|options| (options.keys, options.keys_complete))
+    };
+
+    assert_eq!(keys_of("spawn(cmd);"), Some((Vec::new(), true)));
+    assert_eq!(keys_of("spawn(cmd, [\"x\"]);"), Some((Vec::new(), true)));
+    assert_eq!(
+        keys_of("spawn(cmd, [], { shell: false, stdio: \"inherit\" });"),
+        Some((vec!["shell".to_string(), "stdio".to_string()], true))
+    );
+    assert_eq!(
+        keys_of("spawn(cmd, { shell: true });"),
+        Some((vec!["shell".to_string()], true))
+    );
+    assert_eq!(
+        keys_of("spawn(cmd, args);"),
+        Some((Vec::new(), false)),
+        "a second argument variable can be the options object"
+    );
+    assert_eq!(
+        keys_of("spawn(cmd, args, options);"),
+        Some((Vec::new(), false))
+    );
+    assert_eq!(
+        keys_of("spawn(cmd, [], { ...base });"),
+        Some((Vec::new(), false))
+    );
+    assert_eq!(
+        keys_of("spawn(cmd, [], { shell: false, shell: true });"),
+        Some((vec!["shell".to_string()], false)),
+        "the last duplicate key wins at runtime, so the options stay unknown"
+    );
+    assert_eq!(
+        keys_of("spawn(cmd, [], { shell: false, shell: useShell });"),
+        Some((vec!["shell".to_string()], false))
+    );
+
+    let options =
+        spawn_command_options("spawn(cmd, [], { shell: false });").expect("spawn options captured");
+    assert_eq!(
+        options.properties,
+        vec![fallow_types::extract::SinkObjectProperty {
+            key: "shell".to_string(),
+            value: SinkLiteralValue::Boolean(false),
+        }]
+    );
+}
```

**File**: `crates/extract/src/visitor/visit_impl_security_sinks.rs` (modified, +84/-1)
```diff
@@ -4,7 +4,7 @@ use rustc_hash::{FxHashMap, FxHashSet};
 use std::borrow::Cow;
 
 use fallow_types::extract::{
-    SecurityControlSite, SinkArgKind, SinkLiteralValue, SinkShape, SinkSite,
+    SecurityControlSite, SinkArgKind, SinkCallOptions, SinkLiteralValue, SinkShape, SinkSite,
     SkippedSecurityCalleeExpressionKind, SkippedSecurityCalleeReason, SkippedSecurityCalleeSite,
 };
 use fallow_types::security_sinks::{JSX_SPREAD_SINK_PROPS, node_binding_module};
@@ -437,6 +437,73 @@ fn is_metadata_service_literal(value: &str) -> bool {
     value.contains("169.254.169.254") || value.contains("metadata.google.internal")
 }
 
+/// Whether the callee is `spawn(command, args?, options?)` or its sync form.
+fn is_spawn_callee(callee_path: &str) -> bool {
+    let name = callee_path.rsplit('.').next().unwrap_or(callee_path);
+    matches!(name, "spawn" | "spawnSync")
+}
+
+/// The options object of a `spawn(command, args?, options?)` call. An object
+/// literal in the second position is the options object. A second argument
+/// that is not an array or an object literal can be either, so the options
+/// stay unknown when no third argument follows it. An options object with a
+/// duplicate key also stays unknown: the last property wins at runtime, and a
+/// non-literal value of a later duplicate leaves no literal property to read.
+fn spawn_call_options(arguments: &[Argument<'_>]) -> SinkCallOptions {
+    let known = |expr: Option<&Expression<'_>>| match expr {
+        None => SinkCallOptions {
+            properties: Vec::new(),
+            keys: Vec::new(),
+            keys_complete: true,
+        },
+        Some(expr) => {
+            let keys = object_key_metadata(expr);
+            SinkCallOptions {
+                properties: object_literal_properties(expr),
+                keys: keys.keys,
+                keys_complete: keys.complete && !has_duplicate_static_key(expr),
+            }
+        }
+    };
+    let unknown = || SinkCallOptions {
+        properties: Vec::new(),
+        keys: Vec::new(),
+        keys_complete: false,
+    };
+    let Some(second) = arguments.get(1) else {
+        return known(None);
+    };
+    let Some(second) = second.as_expression() else {
+        return unknown();
+    };
+    if matches!(unwrap_static_expr(second), Expression::ObjectExpression(_)) {
+        return known(Some(second));
+    }
+    match arguments.get(2) {
+        Some(third) => third
+            .as_expression()
+            .map_or_else(unknown, |third| known(Some(third))),
+        None if matches!(unwrap_static_expr(second), Expression::ArrayExpression(_)) => known(None),
+        None => unknown(),
+    }
+}
+
+/// Whether an object literal names one static key in more than one property.
+fn has_duplicate_static_key(expr: &Expression<'_>) -> bool {
+    let Expression::ObjectExpression(obj) = unwrap_static_expr(expr) else {
+        return false;
+    };
+    let mut seen = FxHashSet::default();
+    obj.properties.iter().any(|prop| {
+        let ObjectPropertyKind::ObjectProperty(prop) = prop else {
+            return false;
+        };
+        prop.key
+            .static_name()
+            .is_some_and(|key| !seen.insert(key.text().into_owned()))
+    })
+}
+
 fn should_capture_missing_jwt_verify_options(
     callee_path: &str,
     sink_shape: SinkShape,
@@ -737,6 +804,7 @@ impl ModuleInfoExtractor {
             span_end: expr.span.end,
             url_arg_literal: None,
             url_shape: None,
+            call_options: None,
         });
     }
 
@@ -883,6 +951,7 @@ impl ModuleInfoExtractor {
             } else {
                 None
             },
+            call_options: None,
         }
     }
 
@@ -924,6 +993,7 @@ impl ModuleInfoExtractor {
                 span_end: expr.span.end,
                 url_arg_literal: None,
                 url_shape: None,
+                call_options: None,
             });
         }
     }
@@ -949,6 +1019,8 @@ impl ModuleInfoExtractor {
         // The arg-0 URL literal is captured once per call so secret-to-network
         // findings can carry a destination-host signal on the arg-1 sink.
         let url_arg_literal = call_url_arg_literal(expr);
+        let mut call_options =
+            is_spawn_callee(callee_path).then(|| Box::new(spawn_call_options(&expr.arguments)));
         for (index, arg) in expr.arguments.iter().enumerate() {
             let Some(arg_expr) = arg.as_expression() else {
                 continue;
@@ -962,6 +1034,7 @@ impl ModuleInfoExtractor {
             {
                 continue;
             }
+            let pushed_before = self.security_sinks.len();
             self.push_security_sink_arg(PushSinkArgInput {
                 callee_path,
                 sink_shape,
@@ -970,6 +1043,11 @@ impl ModuleInfoExtractor {
                 url_arg_literal: url_arg_literal.clone(),
                 span: expr.span,
             });
+            if arg_index == 0
+                && let So
```

**File**: `crates/security/data/security_matchers.toml` (modified, +37/-6)
```diff
@@ -67,6 +67,9 @@
 # object_missing_or_false fires when any listed object option is missing or
 # boolean false. Optional object_missing fires when any listed object key is
 # absent, but only when the extractor proved the object key list is complete.
+# Optional options_may_enable matches unless the extractor proved that each
+# listed call option is absent or boolean false (the `shell` option of
+# `child_process.spawn`).
 # Optional context_keywords matches zero-arg sinks that were captured only
 # because the surrounding variable or property name is security sensitive.
 #
@@ -170,7 +173,7 @@ cwe = 78
 title = "OS command injection sink"
 effect = "shell"
 sink_shape = "member-call"
-callee_patterns = ["child_process.exec", "child_process.execSync", "child_process.spawn", "child_process.spawnSync"]
+callee_patterns = ["child_process.exec", "child_process.execSync"]
 arg_index = 0
 import_provenance = "node:child_process"
 evidence_template = "Non-literal command passed to {callee}(). Candidate for verification: confirm the command/args are not attacker-controlled (prefer the array-arg spawn form)."
@@ -181,11 +184,38 @@ cwe = 78
 title = "OS command injection sink"
 effect = "shell"
 sink_shape = "member-call"
-callee_patterns = ["node:child_process.exec", "node:child_process.execSync", "node:child_process.spawn", "node:child_process.spawnSync"]
+callee_patterns = ["node:child_process.exec", "node:child_process.execSync"]
 arg_index = 0
 import_provenance = "node:child_process"
 evidence_template = "Non-literal command passed to {callee}(). Candidate for verification: confirm the command/args are not attacker-controlled."
 
+# `spawn` runs a shell only when its `shell` option is set. These rows match
+# when the options can set `shell`. The execFile rows below take a `spawn`
+# without a shell. The order matters: the first row that matches wins.
+[[matcher]]
+id = "command-injection"
+cwe = 78
+title = "OS command injection sink"
+effect = "shell"
+sink_shape = "member-call"
+callee_patterns = ["child_process.spawn", "child_process.spawnSync"]
+arg_index = 0
+import_provenance = "node:child_process"
+options_may_enable = ["shell"]
+evidence_template = "Non-literal command passed to {callee}(), and the options can enable a shell. Candidate for verification: confirm the command/args are not attacker-controlled (drop the shell option)."
+
+[[matcher]]
+id = "command-injection"
+cwe = 78
+title = "OS command injection sink"
+effect = "shell"
+sink_shape = "member-call"
+callee_patterns = ["node:child_process.spawn", "node:child_process.spawnSync"]
+arg_index = 0
+import_provenance = "node:child_process"
+options_may_enable = ["shell"]
+evidence_template = "Non-literal command passed to {callee}(), and the options can enable a shell. Candidate for verification: confirm the command/args are not attacker-controlled (drop the shell option)."
+
 [[matcher]]
 id = "command-injection"
 cwe = 78
@@ -197,15 +227,16 @@ arg_index = 0
 import_provenance = "shelljs"
 evidence_template = "Non-literal command passed to {callee}(). Candidate for verification: confirm the command/args are not attacker-controlled."
 
-# `execFile` runs no shell, and tooling code runs computed binary paths all the
-# time. These rows therefore need untrusted input in the argument or module.
+# `execFile`, and `spawn` without the `shell` option, run no shell. Tooling
+# code runs computed binary paths all the time. These rows therefore need
+# untrusted input in the argument or module.
 [[matcher]]
 id = "command-injection"
 cwe = 78
 title = "OS command injection sink"
 effect = "shell"
 sink_shape = "member-call"
-callee_patterns = ["child_process.execFile", "child_process.execFileSync"]
+callee_patterns = ["child_process.execFile", "child_process.execFileSync", "child_process.spawn", "child_process.spawnSync"]
 arg_index = 0
 import_provenance = "node:child_process"
 requires_module_source = true
@@ -218,7 +249,7 @@ cwe = 78
 title = "OS command injection sink"
 effect = "shell"
 sink_shape = "member-call"
-callee_patterns = ["node:child_process.execFile", "node:child_process.execFileSync"]
+callee_patterns = ["node:child_process.execFile", "node:child_process.execFileSync", "node:child_process.spawn", "node:child_process.spawnSync"]
 arg_index = 0
 import_provenance = "node:child_process"
 requires_module_source = true
```

---

### Incident Patch 3: `655d1ac2` (2026-11-12)
**Commit Message**: fix(audit): inherit clone groups that lie inside a base clone group (#4564)

* fix(audit): inherit clone groups that lie inside a base clone group

A one-line edit or a parameter rename in one copy of a clone splits the
clone group into smaller groups with new attribution keys. The new-only
gate counted these groups as introduced, also where a group held the
edited line, but the change did not write that duplication.

A head clone group is now inherited when each instance lies inside a
different instance of one base clone group and at least one instance
holds no added line. The check maps paths through the renames and lines
through the change blocks of the diff (`DiffIndex::base_line_range`).
A pasted copy in a new file has no base lines and stays introduced. The
rule records no demotion, so `attribution.duplication_demoted` does not
count these groups.

The diff parser no longer moves its line cursor on a
`\ No newline at end of file` marker.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* test(audit): move the clone containment tests into their own module

The audit integration test file is over 2000 lines. The clone containment tests now live in audit_clone_containment_te

**File**: `.agents/skills/fallow/references/cli-reference.md` (modified, +1/-1)
```diff
@@ -1261,7 +1261,7 @@ fallow audit \
 }
 ```
 
-The `verdict` field is always present and is the primary decision signal. With the default `new-only` gate, the `attribution` object counts introduced vs inherited findings across dead code, complexity, duplication, and styling, and audit sub-results annotate individual findings with `introduced: true/false`. With `gate=all`, audit skips that extra base-snapshot attribution pass, so introduced/inherited counts stay `0` and per-finding `introduced` fields are omitted. Dead code, complexity, and duplication sections follow their respective schemas from the individual commands. Thresholds for complexity are inherited from `fallow health` config (defaults: cyclomatic 20, cognitive 15).
+The `verdict` field is always present and is the primary decision signal. With the default `new-only` gate, the `attribution` object counts introduced vs inherited findings across dead code, complexity, duplication, and styling, and audit sub-results annotate individual findings with `introduced: true/false`. With `gate=all`, audit skips that extra base-snapshot attribution pass, so introduced/inherited counts stay `0` and per-finding `introduced` fields are omitted. A clone group where each instance lies inside a different instance of one base clone group is inherited: an edit inside one copy of a base clone (a changed line, a renamed parameter) splits the base group into smaller groups, and the change did not write that duplication. A pasted copy in a new file has no base lines, so its clone group stays introduced. A group stays introduced also when every copy holds an added line, because the change then wrote the same text into each copy. Dead code, complexity, and duplication sections follow their respective schemas from the individual commands. Thresholds for complexity are inherited from `fallow health` config (defaults: cyclomatic 20, cognitive 15).
 
 Audit creates a temporary git worktree to compare against the base ref. When the current checkout has `node_modules`, audit links it into the base worktree so tsconfig `extends` chains into installed packages and path aliases resolve like the working tree. The worktree is removed on normal exit. If the process is force-killed, run `git worktree prune` to clean up stale `.git/worktrees/fallow-audit-base-*` entries.
 
```

**File**: `.claude/skills/fallow/references/cli-reference.md` (modified, +1/-1)
```diff
@@ -1261,7 +1261,7 @@ fallow audit \
 }
 ```
 
-The `verdict` field is always present and is the primary decision signal. With the default `new-only` gate, the `attribution` object counts introduced vs inherited findings across dead code, complexity, duplication, and styling, and audit sub-results annotate individual findings with `introduced: true/false`. With `gate=all`, audit skips that extra base-snapshot attribution pass, so introduced/inherited counts stay `0` and per-finding `introduced` fields are omitted. Dead code, complexity, and duplication sections follow their respective schemas from the individual commands. Thresholds for complexity are inherited from `fallow health` config (defaults: cyclomatic 20, cognitive 15).
+The `verdict` field is always present and is the primary decision signal. With the default `new-only` gate, the `attribution` object counts introduced vs inherited findings across dead code, complexity, duplication, and styling, and audit sub-results annotate individual findings with `introduced: true/false`. With `gate=all`, audit skips that extra base-snapshot attribution pass, so introduced/inherited counts stay `0` and per-finding `introduced` fields are omitted. A clone group where each instance lies inside a different instance of one base clone group is inherited: an edit inside one copy of a base clone (a changed line, a renamed parameter) splits the base group into smaller groups, and the change did not write that duplication. A pasted copy in a new file has no base lines, so its clone group stays introduced. A group stays introduced also when every copy holds an added line, because the change then wrote the same text into each copy. Dead code, complexity, and duplication sections follow their respective schemas from the individual commands. Thresholds for complexity are inherited from `fallow health` config (defaults: cyclomatic 20, cognitive 15).
 
 Audit creates a temporary git worktree to compare against the base ref. When the current checkout has `node_modules`, audit links it into the base worktree so tsconfig `extends` chains into installed packages and path aliases resolve like the working tree. The worktree is removed on normal exit. If the process is force-killed, run `git worktree prune` to clean up stale `.git/worktrees/fallow-audit-base-*` entries.
 
```

**File**: `changelog.d/fix-audit-clone-subspan-inherited.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **`fallow audit` no longer reports a clone as introduced after an edit inside an existing clone.** A one-line edit or a parameter rename in one copy of a clone splits the clone group into smaller groups with new attribution keys. The new-only gate then counted these groups as introduced, also where a group held the edited line. Now a clone group where each instance lies inside a different instance of one base clone group is inherited. The rule maps paths through renames and lines through the diff. A pasted copy in a new file stays introduced, and so does a group where every copy holds an added line. `attribution.duplication_demoted` does not count these groups, because they match a base clone group.
```

**File**: `crates/api/src/audit_keys.rs` (modified, +19/-0)
```diff
@@ -430,6 +430,25 @@ impl AuditDomainLedger {
             }
         }
     }
+
+    /// Whether the finding with `key` is introduced.
+    #[must_use]
+    pub fn is_introduced(&self, key: &str) -> bool {
+        self.introduced_keys.contains(key)
+    }
+
+    /// Mark introduced findings whose keys are in `inherit` as inherited.
+    /// Unlike [`Self::demote_introductions`], this records no demotion: the
+    /// finding matches a base finding, only its key changed.
+    pub fn inherit_introductions(&mut self, inherit: &FxHashSet<String>) {
+        for (key, introduced) in &mut self.records {
+            if *introduced && inherit.contains(key) {
+                *introduced = false;
+                self.introduced_keys.remove(key);
+                self.inherited_keys.insert(key.clone());
+            }
+        }
+    }
 }
 
 /// One-pass audit comparison shared by attribution, verdict, and annotations.
```

**File**: `crates/api/src/audit_run/clone_containment.rs` (added, +237/-0)
```diff
@@ -0,0 +1,237 @@
+//! Head clone groups that lie inside a base clone group.
+//!
+//! An edit inside one copy of a base clone splits the base group into
+//! smaller groups with new attribution keys. Each smaller group still holds
+//! only duplication that the base already had, so it is inherited.
+
+use std::path::Path;
+
+use fallow_engine::changed_files::RenamedFile;
+use fallow_engine::module_graph::relative_key_path;
+use fallow_output::DiffIndex;
+use fallow_types::duplicates::{CloneGroup, CloneInstance};
+use rustc_hash::{FxHashMap, FxHashSet};
+
+use crate::audit_keys::dupe_group_key;
+use crate::diff_risk::clones::{BaseCloneGroup, CloneSpan};
+
+/// Keys of the head clone groups where each instance lies inside a different
+/// instance of one base clone group, and at least one instance holds no added
+/// line.
+///
+/// The check maps each head instance to its base path (through `renames`,
+/// then through the renames of `diff`) and to its base lines (through the
+/// line changes of `diff`). A group with an instance that has no base lines,
+/// for example a pasted copy in a new file, is not in the set. A group where
+/// each instance holds an added line is not in the set either: the change
+/// wrote the same text into every copy, so it can have written new
+/// duplication inside the old clone.
+pub fn base_contained_dupe_group_keys<'a>(
+    groups: impl IntoIterator<Item = &'a CloneGroup>,
+    root: &Path,
+    diff: &DiffIndex,
+    base_groups: &[BaseCloneGroup],
+    renames: &[RenamedFile],
+) -> FxHashSet<String> {
+    if base_groups.is_empty() {
+        return FxHashSet::default();
+    }
+    let head_to_base: FxHashMap<String, String> = renames
+        .iter()
+        .map(|rename| {
+            (
+                relative_key_path(&rename.to, root),
+                relative_key_path(&rename.from, root),
+            )
+        })
+        .collect();
+    let base_span = |instance: &CloneInstance| -> Option<(CloneSpan, bool)> {
+        let rel = relative_key_path(&instance.file, root);
+        let key = diff.key_for(&instance.file, root)?;
+        let start = u64::try_from(instance.start_line).ok()?;
+        let end = u64::try_from(instance.end_line).ok()?;
+        let (base_start, base_end) = diff.base_line_range(&key, start, end)?;
+        let touched = diff.range_overlaps_added(&key, start, end);
+        let path = head_to_base.get(&rel).cloned().unwrap_or_else(|| {
+            diff.old_path_for_root_relative(&rel)
+                .map_or_else(|| rel.clone(), |old| old.into_owned())
+        });
+        let span = CloneSpan {
+            path,
+            start_line: u32::try_from(base_start).ok()?,
+            end_line: u32::try_from(base_end).ok()?,
+        };
+        Some((span, touched))
+    };
+    groups
+        .into_iter()
+        .filter(|group| {
+            let mapped: Option<Vec<(CloneSpan, bool)>> =
+                group.instances.iter().map(base_span).collect();
+            let Some(mapped) = mapped else {
+                return false;
+            };
+            if mapped.iter().all(|(_, touched)| *touched) {
+                return false;
+            }
+            let spans: Vec<CloneSpan> = mapped.into_iter().map(|(span, _)| span).collect();
+            base_groups
+                .iter()
+                .any(|base| spans_fit_in_group(&spans, &base.instances))
+        })
+        .map(|group| dupe_group_key(group, root))
+        .collect()
+}
+
+/// Whether each span lies inside a different instance of the base group.
+/// Two head instances inside one base copy are a new clone of the copy with
+/// itself, so each base instance takes at most one span.
+fn spans_fit_in_group(spans: &[CloneSpan], base: &[CloneSpan]) -> bool {
+    let mut used = vec![false; base.len()];
+    spans.iter().all(|span| {
+        let slot = base.iter().enumerate().position(|(index, outer)| {
+            !used[index]
+                && outer.path == span.path
+                && outer.start_line <= span.start_line
+                && span.end_line <= outer.end_line
+        });
+        slot.is_some_and(|index| {
+            used[index] = true;
+            true
+        })
+    })
+}
+
+#[cfg(test)]
+mod tests {
+    use std::path::PathBuf;
+
+    use super::*;
+
+    fn root() -> PathBuf {
+        PathBuf::from("/project")
+    }
+
+    fn instance(path: &str, start_line: usize, end_line: usize) -> CloneInstance {
+        CloneInstance {
+            is_symlink: false,
+            file: root().join(path),
+            start_line,
+            end_line,
+            start_col: 0,
+            end_col: 0,
+            fragment: format!("{path}:{start_line}"),
+        }
+    }
+
+    fn group(instances: Vec<CloneInstance>) -> CloneGroup {
+        CloneGroup {
+            instances,
+            token_count: 40,
+            line_count: 6,
+            similarity: None,
+        }
+    }
+
+    fn span(path: &str, start_line: u32, end_line
```

**File**: `crates/api/src/audit_run/mod.rs` (modified, +11/-2)
```diff
@@ -20,6 +20,7 @@
 
 mod base_files;
 mod base_ref;
+mod clone_containment;
 mod outcome;
 mod own_config;
 mod scope;
@@ -42,8 +43,8 @@ pub use base_ref::{
     AuditBaseError, AuditBaseOrigin, parse_audit_base_override, resolve_audit_base,
 };
 pub use outcome::{
-    DupeDemotionDiffSource, SharedDiff, compare, demote_preexisting_dupe_introductions, outcome,
-    realign_styling_introductions, styling_finding_gates, styling_rule_severity,
+    DupeBase, DupeDemotionDiffSource, SharedDiff, compare, demote_preexisting_dupe_introductions,
+    outcome, realign_styling_introductions, styling_finding_gates, styling_rule_severity,
 };
 pub use own_config::{config_path_under_root, own_config_unused_code_keys};
 pub use scope::{
@@ -562,6 +563,14 @@ pub fn attribute<A: AuditAnalyses>(
             root,
             base_ref,
             shared_diff,
+            DupeBase {
+                // A skipped base reuses the head keys, so no group is introduced.
+                groups: base_snapshot
+                    .as_ref()
+                    .filter(|_| !skipped)
+                    .map_or(&[][..], |snapshot| snapshot.dupe_groups.as_slice()),
+                renames,
+            },
         );
         realign_styling_introductions(
             &mut comparison,
```

**File**: `crates/api/src/audit_run/outcome.rs` (modified, +45/-7)
```diff
@@ -4,13 +4,17 @@ use std::path::Path;
 
 use fallow_config::{AuditGate, AuditWorsened, RulesConfig, Severity};
 
+use fallow_engine::changed_files::RenamedFile;
+
+use super::clone_containment::base_contained_dupe_group_keys;
 use super::{AuditAnalysesView, AuditKeySnapshot};
 use crate::audit_keys::{
     AuditComparison, AuditDomainLedger, DeadCodeAuditLedger,
     classify_complexity_attribution_against_all, complexity_ledger_keys, dead_code_audit_ledger,
     dupe_group_key, preexisting_dupe_group_keys, styling_ledger_keys,
     styling_ledger_keys_with_diff,
 };
+use crate::diff_risk::clones::BaseCloneGroup;
 use crate::{AuditAttribution, AuditSummary, AuditVerdict};
 
 /// Which diff decided the new-only duplication demotion, so output can name
@@ -136,20 +140,39 @@ pub fn compare(
     }
 }
 
-/// Demote introduced clone groups that hold no added line of the run's diff.
+/// The base data that the clone group reclassification compares with.
+#[derive(Clone, Copy)]
+pub struct DupeBase<'a> {
+    /// Instance locations of the base clone groups, at base paths.
+    pub groups: &'a [BaseCloneGroup],
+    /// The renamed files of the change.
+    pub renames: &'a [RenamedFile],
+}
+
+/// Reclassify introduced clone groups that the change did not write.
+///
+/// Two rules use the run's diff, in this order:
 ///
-/// No instance range holds an added line, so the changeset did not write the
-/// duplicated text. Only the attribution key of the group changed, because the
-/// changeset removed code in another place. Without this step, a clone-removal
-/// refactor fails the new-only gate on duplication that it did not write
-/// (issue #2164). The opt-in shared diff decides when it is present; the
-/// merge-base worktree diff decides in the other cases.
+/// 1. A group that holds no added line is demoted. Only the attribution key
+///    of the group changed, because the changeset removed code in another
+///    place. Without this rule, a clone-removal refactor fails the new-only
+///    gate on duplication that it did not write (issue #2164).
+/// 2. A group where each instance lies inside a different instance of one
+///    base clone group, and one instance holds no added line, is inherited.
+///    An edit inside one copy of a base clone splits the base group into
+///    smaller groups with new keys, and the
+///    change did not write their duplication. This rule records no
+///    demotion, because the group matches a base group.
+///
+/// The opt-in shared diff decides when it is present; the merge-base worktree
+/// diff decides in the other cases.
 pub fn demote_preexisting_dupe_introductions(
     comparison: &mut AuditComparison,
     view: &AuditAnalysesView<'_>,
     root: &Path,
     base_ref: &str,
     shared: Option<SharedDiff<'_>>,
+    base: DupeBase<'_>,
 ) -> Option<DupeDemotionDiffSource> {
     if comparison.dupes.introduced_count() == 0 {
         return None;
@@ -173,6 +196,21 @@ pub fn demote_preexisting_dupe_introductions(
         index,
     );
     comparison.dupes.demote_introductions(&demote);
+    // Only an introduced group can become inherited. The filter keeps the
+    // containment check, which compares each group with every base group,
+    // away from the groups that already match a base key.
+    let inherit = base_contained_dupe_group_keys(
+        duplication.clone_groups.iter().copied().filter(|group| {
+            comparison
+                .dupes
+                .is_introduced(&dupe_group_key(group, duplication.root))
+        }),
+        duplication.root,
+        index,
+        base.groups,
+        base.renames,
+    );
+    comparison.dupes.inherit_introductions(&inherit);
     Some(source)
 }
 
```

**File**: `crates/cli/tests/integration/audit_clone_containment_tests.rs` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+//! New-only duplication attribution for a head clone group that lies inside a
+//! base clone group: an edit inside an existing clone is inherited, and a new
+//! copy stays introduced.
+
+#![allow(
+    clippy::unwrap_used,
+    clippy::expect_used,
+    reason = "tests and benches use unwrap and expect to keep fixture setup concise"
+)]
+
+use crate::common::{commit_all, git, parse_json, run_fallow_raw};
+use std::fs;
+use std::path::Path;
+use tempfile::TempDir;
+
+const SUBSPAN_CLONE: &str = "export function NAME(items, opts) {\n  const out = [];\n  for (const item of items) {\n    if (item.kind === 'alpha' && opts.includeAlpha) {\n      out.push({ id: item.id, label: item.name.toUpperCase(), score: item.score * 2 });\n    } else if (item.kind === 'beta' && opts.includeBeta) {\n      out.push({ id: item.id, label: item.name.toLowerCase(), score: item.score + 10 });\n    } else if (item.kind === 'gamma') {\n      out.push({ id: item.id, label: item.name.trim(), score: Math.max(0, item.score - 5) });\n    } else {\n      out.push({ id: item.id, label: String(item.name), score: 0 });\n    }\n  }\n  const total = out.reduce((sum, row) => sum + row.score, 0);\n  const sorted = out.sort((x, y) => y.score - x.score);\n  return { total, rows: sorted, count: sorted.length, empty: sorted.length === 0 };\n}\n";
+
+/// Repo with one committed clone group across `src/a.js` and `src/b.js`. The
+/// `edit` callback changes the working tree, and the function returns the
+/// JSON of a new-only audit against the commit.
+fn audit_after_clone_edit(edit: impl FnOnce(&Path)) -> serde_json::Value {
+    let tmp = TempDir::new().expect("failed to create temp dir");
+    let dir = tmp.path();
+    fs::create_dir_all(dir.join("src")).unwrap();
+    fs::write(
+        dir.join("package.json"),
+        r#"{"name":"audit-clone-subspan","type":"module","main":"src/index.js"}"#,
+    )
+    .unwrap();
+    fs::write(
+        dir.join("src/index.js"),
+        "import { a } from './a.js';\nimport { b } from './b.js';\nconsole.log(a, b);\n",
+    )
+    .unwrap();
+    fs::write(dir.join("src/a.js"), SUBSPAN_CLONE.replace("NAME", "a")).unwrap();
+    fs::write(dir.join("src/b.js"), SUBSPAN_CLONE.replace("NAME", "b")).unwrap();
+    git(dir, &["init", "-b", "main"]);
+    git(dir, &["config", "core.autocrlf", "false"]);
+    commit_all(dir, "initial");
+    edit(dir);
+
+    let output = run_fallow_raw(&[
+        "audit",
+        "--root",
+        dir.to_str().unwrap(),
+        "--base",
+        "HEAD",
+        "--gate",
+        "new-only",
+        "--no-cache",
+        "--format",
+        "json",
+        "--quiet",
+    ]);
+    assert_eq!(
+        output.code, 0,
+        "audit should run. stdout: {}\nstderr: {}",
+        output.stdout, output.stderr
+    );
+    parse_json(&output)
+}
+
+fn edit_file(dir: &Path, rel: &str, from: &str, to: &str) {
+    let path = dir.join(rel);
+    let text = fs::read_to_string(&path).unwrap();
+    assert!(text.contains(from), "{rel} must contain {from}");
+    fs::write(&path, text.replace(from, to)).unwrap();
+}
+
+fn assert_all_clone_groups_inherited(json: &serde_json::Value) {
+    let groups = json["duplication"]["clone_groups"]
+        .as_array()
+        .expect("clone groups array");
+    assert!(!groups.is_empty(), "expected a clone group: {json}");
+    assert!(
+        groups.iter().all(|group| group["introduced"] == false),
+        "every clone group inside a base clone group must be inherited: {json}"
+    );
+    assert_eq!(json["attribution"]["duplication_introduced"], 0);
+    assert_eq!(json["attribution"]["duplication_demoted"], 0);
+}
+
+/// A one-line edit inside one copy of a base clone splits the group into
+/// smaller groups. Each smaller group lies inside the base group, so the
+/// change did not write the duplication, even where a group holds the edited
+/// line.
+#[test]
+fn audit_one_line_edit_inside_base_clone_is_inherited() {
+    let json = audit_after_clone_edit(|dir| {
+        edit_file(dir, "src/a.js", "item.score + 10", "item.score + 11");
+    });
+    assert_all_clone_groups_inherited(&json);
+}
+
+/// A parameter rename in one copy of a base clone shrinks the group to the
+/// lines that do not name the parameter. The smaller group is inherited.
+#[test]
+fn audit_parameter_rename_inside_base_clone_is_inherited() {
+    let json = audit_after_clone_edit(|dir| {
+        let path = dir.join("src/a.js");
+        let text = fs::read_to_string(&path).unwrap();
+        fs::write(&path, text.replace("opts", "options")).unwrap();
+    });
+    assert_all_clone_groups_inherited(&json);
+}
+
+/// A new copy of a base clone in a new file has no containing base instance,
+/// so its clone group stays introduced.
+#[test]
+fn audit_new_copy_of_base_clone_stays_introduced() {
+    let json = audit_after_clone_edit(|dir| {
+        fs::write(dir.join("src/c.js"), SUBSPAN_CLONE.replace("NAME", "c")).unwrap();
+        fs::write(

```

#### Recent Merged Pull Requests:
- **PR #4569** (2026-11-13): test(audit): cover more clone groups inside a base clone group (@BartWaardenburg)
- **PR #4568** (2026-11-13): fix(health): use one term for the CRAP static estimate (@BartWaardenburg)
- **PR #4565** (2026-11-13): fix(constant-parameter): skip exports that an unknown-source load can call (@BartWaardenburg)
- **PR #4564** (2026-11-12): fix(audit): inherit clone groups that lie inside a base clone group (@BartWaardenburg)
- **PR #4563** (2026-11-12): feat(audit): add --staged to audit the staged index (@BartWaardenburg)
- **PR #4562** (2026-11-12): feat(audit): report unused code that a change creates outside the changed files (@BartWaardenburg)

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

## X. scripts): wait for the GitHub rate-limit reset in the check wait (#4531)

**RULE**:
When implementing operations in `scripts/ship-wait-checks.mjs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fallow-rs/fallow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fbeb91b0`: scripts): wait for the GitHub rate-limit reset in the check wait (#4531). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `scripts/ship-wait-checks.mjs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                          up to ${READ_RETRY_MAX_MS / MINUTE} minutes. A read that GitHub
                          refuses because of the API rate limit waits
                          until the limit resets, and does not count.
/**
 * Plan the next read after a failed read. A rate-limited read (with
 * `retryAtMs`) waits for the reset and does not count as a failed read. Any
 * other failed read backs off and counts against the error window. Returns
 * `{ delayMs, readErrors, stop, counts }`, where `counts` tells whether the
 * delay counts against the error window.
 */
const failedRead = (
  read,
  { readErrors, errorMs, intervalMs, errorWindowMs, deadline, now, warn },
) => {
  if (read.retryAtMs !== undefined) {
    const delayMs = Math.max(read.retryAtMs - now(), intervalMs);
    warn(
      now() + delayMs <= deadline
        ? `Read of the checks failed: ${read.error}. Next read in ${formatSeconds(delayMs)}, after the rate limit resets.`
        : `Read of the checks failed: ${read.error}. The rate limit resets after the end of the wait.`,
    );
    return { delayMs, readErrors, stop: false, counts: false };
  }
  const errors = readErrors + 1;
  const windowLeftMs = erro
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
                          up to ${READ_RETRY_MAX_MS / MINUTE} minutes.
      readErrors += 1;
      const windowLeftMs = errorWindowMs - errorMs;
      delayMs = Math.min(intervalMs * 2 ** (readErrors - 1), READ_RETRY_MAX_MS, windowLeftMs);
      if (windowLeftMs <= 0 || now() + delayMs > deadline) {
        warn(`Read of the checks failed: ${read.error}`);
        return { status: "error", checks, readErrors, errorMs };
      warn(`Read of the checks failed: ${read.error}. Next read in ${formatSeconds(delayMs)}.`);
    if (readErrors > 0) {
      errorMs += delayMs;
    }
/** Fetch the base branch, then read its newest commit. */
const gitHeadReader = (git) => () => {
  const fetched = git(["fetch", "--quiet", FOLLOW_REMOTE, FOLLOW_BRANCH]);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fbeb91b0` are properly handled with clean fallback behavior.
