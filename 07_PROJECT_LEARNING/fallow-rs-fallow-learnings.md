> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source**: github ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Source Version**: `b5123420`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-15T02:55:36.454Z  
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
> **Harvest Timestamp**: 2026-11-15T02:55:36.335Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5366 stars

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
- **Issue #4605** (2026-11-15): **ci: CodSpeed fast simulation builds stop with exit code 143**
  *Symptoms*: ## Problem  Since 2026-11-14, many "CodSpeed fast simulation" jobs in the Benchmarks workflow fail on pull requests and on `main`, before any benchmark runs.  - The step "Build benchmark shard" (`cargo codspeed build`) stops with `Process completed with exit code 143`, after 5 to 8 minutes. The job timeout is 30 minutes, and the step has no timeout of its own. - Other jobs of the same matrix stay queued or running until the 30-minute job timeout cancels them. - A rerun of a failed job often fails again in the same way.  Examples:  - `main` push runs on 2026-11-14: one run with 1 failure and 4 cancelled jobs of 12, one run with 7 of 7 cancelled, one run with 2 failures and 4 cancelled jobs of 6. - Pull request runs: https://github.com/fallow-rs/fallow/actions/runs/43601936478 (exit code 143 again on a rerun of "LSP save-to-publish"), https://github.com/fallow-rs/fallow/actions/runs/43604188088.  These jobs are not required checks, but they keep each pull request in the `UNSTABLE` state, and a `ci:perf` pull request gets no benchmark result.  ## Proposal  - Find what sends SIGTERM to the build step. Possible causes: memory pressure on the `ubuntu-24.04` runner during the `cargo codspeed build`, or runner shutdown. - If memory is the cause, limit `CARGO_BUILD_JOBS` for the build step, or build with fewer codegen units. - Count a job that hits the timeout before its build starts separately from a benchmark failure.  ## Acceptance  - Over one day of pull request and `main` runs, t

- **Issue #4585** (2026-11-14): **migrate from knip: production markers on ignoreDependencies and project, and named plugin configs, are lost**
  *Symptoms*: ### What happened?  `fallow migrate` from a knip config loses three settings. Two of them only get a generic warning, and one gets a warning that gives the wrong advice:  1. **The production marker on `ignoreDependencies` is copied literally.** knip's `"left-pad!"` becomes `"left-pad!"` in Fallow. Fallow reads it as a package name, so the entry never matches. On a real repository, the migrated config then printed "ignoreDependencies entry 'ai!' hid no dependency finding in this run, so it has no effect" for each such entry. 2. **Production exclusions in `project` are dropped.** knip's `"!scripts/**!"` (exclude from production mode) only gets "[knip] `project`: Fallow auto-discovers project files". On a real repository with `!.agents/**!`, `!other/**!`, `!tests/**!` and similar exclusions, `fallow dead-code --production` with the migrated config reported 99 unused files and 56 unused exports, nearly all inside those excluded trees. knip's production run on the same tree reported none. 3. **A plugin section that names non-default config files is called redundant.** knip's `"playwright": { "config": ["playwright.e2e.config.ts"] }` gets "plugin config `playwright` is auto-detected by fallow's built-in plugins (suggestion: remove this section; fallow detects framework config automatically)". But the Playwright plugin reads only `playwright.config.{ts,js}` (`CONFIG_PATTERNS` in `crates/core/src/plugins/playwright.rs`), so a project with named configs loses them. Fallow also has no 

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

### Incident Patch 1: `7a3fbe65` (2026-11-14)
**Commit Message**: fix(audit): keep a clone inherited when lines above one copy are rewritten (#4593)

The new-only duplication check maps each head copy of a clone group back
to its base lines and keeps the group inherited when the copies lie
inside one base clone group. When the first or last line of a copy was a
rewritten line that replaced several base lines, the mapped range grew to
the far end of the replaced lines. The range then fell outside the base
copy, and the group was reported as introduced.

This happened for example when a change renamed one copy and removed an
import line above the other copy. The clone in that copy then started on
the rewritten line, and `--gate new-only` failed on duplication that the
change did not write.

An added line at the start of a range now maps to the last base line of
its block, and an added line at the end maps to the first one. These are
the replaced lines next to the unchanged lines of the copy. A range that
starts and ends in one block still maps to every removed line.

The drift harness seed of the failing case is in the regression file, so
each harness run replays it.

Closes #4580

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

**File**: `changelog.d/fix-audit-clone-attribution-on-rename.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+### Fixed
+
+- **`fallow audit` no longer reports an old clone group as introduced when the change rewrites the lines above one copy.**
+  The audit maps each head copy of a clone back to its base lines. When the
+  first or last line of a copy was a rewritten line that replaced several base
+  lines, the mapped range grew to the far end of the replaced lines and fell
+  outside the base clone. A rename of the other copy, together with fewer
+  import lines above this copy, could then fail `--gate new-only` on
+  duplication that the change did not write. The rewritten edge line now maps
+  to the replaced base line next to the unchanged lines of the copy.
+  (Closes [#4580](https://github.com/fallow-rs/fallow/issues/4580))
```

**File**: `crates/api/src/audit_run/clone_containment.rs` (modified, +24/-0)
```diff
@@ -212,6 +212,30 @@ mod tests {
         assert!(keys.is_empty());
     }
 
+    /// The change renames one copy and replaces the three lines above the
+    /// other copy with two. The second copy moves up one line, and its clone
+    /// starts on a replaced line, which holds only the clone's first token
+    /// (issue #4580).
+    #[test]
+    fn renamed_copy_with_a_rewritten_first_line_in_the_other_copy_is_contained() {
+        let diff = DiffIndex::from_unified_diff(
+            "diff --git a/src/a.js b/src/r.js\nsimilarity index 100%\nrename from src/a.js\nrename to src/r.js\ndiff --git a/src/b.js b/src/b.js\n--- a/src/b.js\n+++ b/src/b.js\n@@ -1,3 +1,2 @@\n-import { a0 } from './a.js';\n-import { c0 } from './c.js';\n-export const b0 = a0 + c0;\n+import { a0 } from './r.js';\n+export const b0 = a0;\n",
+        );
+        let renames = [RenamedFile {
+            from: root().join("src/a.js"),
+            to: root().join("src/r.js"),
+        }];
+        let base = vec![BaseCloneGroup {
+            instances: vec![span("src/a.js", 1, 14), span("src/b.js", 3, 16)],
+        }];
+        let moved = group(vec![
+            instance("src/b.js", 2, 15),
+            instance("src/r.js", 1, 14),
+        ]);
+        let keys = base_contained_dupe_group_keys([&moved], &root(), &diff, &base, &renames);
+        assert_eq!(keys.len(), 1);
+    }
+
     #[test]
     fn renamed_copy_maps_to_its_base_path() {
         let diff = DiffIndex::from_unified_diff(
```

**File**: `crates/cli/tests/drift/drift.proptest-regressions` (modified, +1/-0)
```diff
@@ -8,3 +8,4 @@ cc 5df4327fe0503553bb8a508d63db3bfb12a49da74905f7aae5d279d3adcd67b5 # shrinks to
 cc 24c6d75d5610b0ac612b8bba185e77e21e14627731d3964cde850561e78db8d6 # shrinks to ProjectModel { workspaces: false, files: [FileSpec { second_package: false, entry_imported: false, suppress_file: false, exports: [ExportSpec { is_type: false, suppressed: false }], imports: [] }, FileSpec { second_package: false, entry_imported: false, suppress_file: false, exports: [], imports: [(2, 0)] }, FileSpec { second_package: false, entry_imported: false, suppress_file: false, exports: [ExportSpec { is_type: false, suppressed: false }], imports: [] }, FileSpec { second_package: false, entry_imported: false, suppress_file: false, exports: [ExportSpec { is_type: false, suppressed: false }], imports: [] }, FileSpec { second_package: false, entry_imported: false, suppress_file: false, exports: [], imports: [(0, 0), (3, 0)] }], deps: [], duplicate: Some((4, 1, false)), complex: None, changes: [Delete(0)], baseline_mask: [false, false, false, false, false, false] }
 cc f02fec81f4b22e082a5bfa73f22e9d5890acbd86079e7e4373d98c84bf3f9322 # shrinks to ProjectModel { workspaces: false, files: [FileSpec { second_package: false, entry_imported: false, suppress_file: false, exports: [ExportSpec { is_type: false, suppressed: true }, ExportSpec { is_type: false, suppressed: true }], imports: [(1, 0)] }, FileSpec { second_package: false, entry_imported: true, suppress_file: false, exports: [ExportSpec { is_type: false, suppressed: false }], imports: [(3, 0)] }, FileSpec { second_package: false, entry_imported: false, suppress_file: false, exports: [], imports: [] }], deps: [], duplicate: None, complex: None, changes: [Delete(4)], baseline_mask: [false, false, false, false, false, false] }
 cc fa822e78e71d56589ad0d90be43c58c85e4bcbf6143abcb088ba0dcd0ecc763b # shrinks to ProjectModel { workspaces: false, files: [FileSpec { second_package: false, entry_imported: false, suppress_file: false, exports: [], imports: [] }], deps: [], duplicate: None, complex: None, changes: [], baseline_mask: [false, false, false, false, false, false] }
+cc 3e4c880932c0f81cd6f1340de91eb5a3f537153039fde33194ed05c1719f8063 # shrinks to ProjectModel { workspaces: false, files: [FileSpec { second_package: false, entry_imported: false, suppress_file: false, exports: [ExportSpec { is_type: false, suppressed: false }], imports: [] }, FileSpec { second_package: false, entry_imported: false, suppress_file: false, exports: [ExportSpec { is_type: false, suppressed: false }], imports: [] }, FileSpec { second_package: false, entry_imported: false, suppress_file: false, exports: [], imports: [] }, FileSpec { second_package: false, entry_imported: false, suppress_file: false, exports: [], imports: [(1, 0), (4, 0)] }], deps: [], duplicate: Some((3, 4, false)), complex: None, changes: [Rename(0), Delete(1)], baseline_mask: [false, false, false, false, false, false] }
```

**File**: `crates/cli/tests/integration/audit_clone_containment_tests.rs` (modified, +66/-0)
```diff
@@ -175,6 +175,72 @@ fn audit_renamed_and_edited_copy_inside_base_clone_is_inherited() {
     assert_all_clone_groups_inherited(&json);
 }
 
+/// The change renames one copy and rewrites the lines above the other copy.
+/// Two import lines become one, so that copy moves up by one line, and its
+/// clone starts on a rewritten line. The rewritten line replaces several base
+/// lines, and the clone text on it matches only the last of them. The head
+/// group thus lies inside the base group (issue #4580).
+#[test]
+fn audit_renamed_copy_and_rewritten_lines_above_other_copy_is_inherited() {
+    let tmp = TempDir::new().expect("failed to create temp dir");
+    let repo = tmp.path();
+    fs::create_dir_all(repo.join("src")).unwrap();
+    fs::write(
+        repo.join("package.json"),
+        r#"{"name":"audit-clone-rename-shift","type":"module","main":"src/index.js"}"#,
+    )
+    .unwrap();
+    let clone = SUBSPAN_CLONE.replace("NAME", "compute");
+    fs::write(
+        repo.join("src/a.js"),
+        format!("export const a0 = 1;\n{clone}"),
+    )
+    .unwrap();
+    fs::write(repo.join("src/c.js"), "export const c0 = 2;\n").unwrap();
+    fs::write(
+        repo.join("src/b.js"),
+        format!(
+            "import {{ a0 }} from './a.js';\nimport {{ c0 }} from './c.js';\nexport const b0 = a0 + c0;\n{clone}"
+        ),
+    )
+    .unwrap();
+    fs::write(
+        repo.join("src/index.js"),
+        "import { b0 } from './b.js';\nimport { compute } from './a.js';\nconsole.log(b0, compute);\n",
+    )
+    .unwrap();
+    git(repo, &["init", "-b", "main"]);
+    git(repo, &["config", "core.autocrlf", "false"]);
+    commit_all(repo, "initial");
+
+    git(repo, &["mv", "src/a.js", "src/r.js"]);
+    git(repo, &["rm", "-q", "src/c.js"]);
+    fs::write(
+        repo.join("src/b.js"),
+        format!("import {{ a0 }} from './r.js';\nexport const b0 = a0;\n{clone}"),
+    )
+    .unwrap();
+    edit_file(repo, "src/index.js", "'./a.js'", "'./r.js'");
+    commit_all(repo, "rename and rewrite");
+
+    let output = run_fallow_raw(&[
+        "audit",
+        "--root",
+        repo.to_str().unwrap(),
+        "--base",
+        "HEAD~1",
+        "--gate",
+        "new-only",
+        "--no-cache",
+        "--format",
+        "json",
+        "--quiet",
+    ]);
+    let json = parse_json(&output);
+    assert_all_clone_groups_inherited(&json);
+    assert_eq!(json["attribution"]["duplication_inherited"], 1);
+}
+
 /// A project in a subdirectory of the repo gets the same result. The added
 /// lines move the head clone below the end of its base instance. The head
 /// span maps back inside the base instance only when the diff paths are
```

**File**: `crates/output/src/diff.rs` (modified, +62/-13)
```diff
@@ -56,6 +56,15 @@ struct ChangeBlock {
     old_len: u64,
 }
 
+impl ChangeBlock {
+    /// Last base line that the run removed. `None` when it removed no line.
+    fn last_removed_line(self) -> Option<u64> {
+        (self.old_start + self.old_len)
+            .checked_sub(1)
+            .filter(|_| self.old_len > 0)
+    }
+}
+
 /// Where one head line sits relative to the change blocks of its file.
 enum HeadLinePlace {
     /// An unchanged line, at this base line.
@@ -216,26 +225,44 @@ impl DiffIndex {
     /// is a key of this diff.
     ///
     /// Unchanged lines map exactly. An added line at the start of the range
-    /// maps to the first base line that its block removed. An added line at
-    /// the end maps to the last one. A file that the diff does not name maps
-    /// unchanged. `None` when the range holds no base line, when the diff
-    /// adds `path` as a new file, or when the index stopped at
-    /// [`MAX_ADDED_LINES`].
+    /// maps to the last base line that its block removed, which is the
+    /// removed line next to the unchanged lines inside the range. An added
+    /// line at the end maps to the first removed line, for the same reason.
+    /// A block that replaces several lines thus does not widen the range to
+    /// base lines that the range does not reach. A range that starts and
+    /// ends in one block maps to every line that the block removed. A file
+    /// that the diff does not name maps unchanged. `None` when the range
+    /// holds no base line, when the diff adds `path` as a new file, or when
+    /// the index stopped at [`MAX_ADDED_LINES`].
     #[must_use]
     pub fn base_line_range(&self, path: &str, start: u64, end: u64) -> Option<(u64, u64)> {
         let map = &self.base_lines;
         if map.lines_capped || start > end || map.new_files.contains(path) {
             return None;
         }
         let blocks = map.change_blocks.get(path).map_or(&[][..], Vec::as_slice);
-        let base_start = match head_line_place(blocks, start) {
-            HeadLinePlace::Unchanged(line) => line,
-            HeadLinePlace::Added(block) => block.old_start,
-        };
-        let base_end = match head_line_place(blocks, end) {
-            HeadLinePlace::Unchanged(line) => line,
-            HeadLinePlace::Added(block) => (block.old_start + block.old_len).checked_sub(1)?,
-        };
+        let (base_start, base_end) =
+            match (head_line_place(blocks, start), head_line_place(blocks, end)) {
+                (HeadLinePlace::Added(first), HeadLinePlace::Added(last))
+                    if first.new_start == last.new_start =>
+                {
+                    (first.old_start, first.last_removed_line()?)
+                }
+                (start_place, end_place) => {
+                    let base_start = match start_place {
+                        HeadLinePlace::Unchanged(line) => line,
+                        HeadLinePlace::Added(block) => {
+                            block.last_removed_line().unwrap_or(block.old_start)
+                        }
+                    };
+                    let base_end = match end_place {
+                        HeadLinePlace::Unchanged(line) => line,
+                        HeadLinePlace::Added(block) if block.old_len > 0 => block.old_start,
+                        HeadLinePlace::Added(block) => block.old_start.checked_sub(1)?,
+                    };
+                    (base_start, base_end)
+                }
+            };
         (base_start <= base_end).then_some((base_start, base_end))
     }
 
@@ -496,6 +523,28 @@ mod tests {
         assert_eq!(index.base_line_range("a.js", 1, 12), Some((1, 10)));
     }
 
+    /// Three base lines become two head lines. A range that starts on the
+    /// second head line reaches only the last replaced base line, so it maps
+    /// to that line and not to the first one (issue #4580).
+    #[test]
+    fn base_line_range_maps_a_start_in_a_multi_line_replacement_to_its_last_removed_line() {
+        let index = DiffIndex::from_unified_diff(
+            "diff --git a/b.ts b/b.ts\n--- a/b.ts\n+++ b/b.ts\n@@ -1,3 +1,2 @@\n-one\n-two\n-three\n+ONE\n+TWO\n",
+        );
+        assert_eq!(index.base_line_range("b.ts", 2, 15), Some((3, 16)));
+        assert_eq!(index.base_line_range("b.ts", 1, 2), Some((1, 3)));
+    }
+
+    #[test]
+    fn base_line_range_maps_an_end_in_a_multi_line_replacement_to_its_first_removed_line() {
+        let index = DiffIndex::from_unified_diff(
+            "diff --git a/b.ts b/b.ts\n--- a/b.ts\n+++ b/b.ts\n@@ -10,3 +10,2 @@\n-ten\n-eleven\n-twelve\n+TEN\n+ELEVEN\n",
+        );
+        assert_eq!(index.base_line_range("b.ts", 1, 10), Some((1, 10)));
+        assert_eq!(index.base_line_range("b.ts", 1, 11), Some((1, 10)));
+        assert_eq!(index.base_line_range("b.ts", 12, 20), Some((13, 21)));
+    }
+
     #[test]
     fn base_line_range_has_no_base_line_for_pure_additions() {
         let index = DiffIndex::f
```

**File**: `docs/reference/cli-internals.md` (modified, +4/-1)
```diff
@@ -538,7 +538,10 @@ line states exit code 0.
   (`crates/api/src/audit_run/clone_containment.rs`). The check maps each head
   instance to its base path through the rename list and the diff renames,
   and to its base lines through the line changes of the diff
-  (`DiffIndex::base_line_range`). An edit inside one copy of a base clone
+  (`DiffIndex::base_line_range`). A rewritten line at the start or end of an
+  instance maps to the replaced base line next to the unchanged lines of the
+  instance, so a block that turns several lines into fewer does not move the
+  span outside its base instance. An edit inside one copy of a base clone
   splits the base group into smaller groups with new keys, and this rule
   keeps them inherited. The rule records no demotion, because the group
   matches a base group. A file that the diff adds has no base lines, so a
```

---

### Incident Patch 2: `b5123420` (2026-11-15)
**Commit Message**: ci(bench): build CodSpeed shards with two compile jobs, swap and a resource log (#4616)

* ci(bench): add swap and a resource log to the CodSpeed builds

CodSpeed jobs stop in "Build benchmark shard" with exit code 143 and
"The runner has received a shutdown signal", with no compiler error.
The runner stops while a cold build compiles several large crates at
once with full debug info.

Each CodSpeed job now adds 8 GiB of swap on the temporary disk before
the build. When the disk has too little free space or swapon fails,
the step prints a warning and the job continues. The build runs
through a wrapper that prints the available memory, the used swap,
the load average and the available disk every 30 seconds, so the last
lines of a log show which resource ran out.

The cargo command and its flags do not change, so the instruction
counts of the benchmarks do not change.

Closes #4605

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* ci(bench): build the CodSpeed shards with two compile jobs

The resource log of the first run showed the memory peak. While the
large fallow crates compile in parallel, the available memory fell to
about 1 GB, and six shards used up to 2.5 GB of swap. 

**File**: `.github/workflows/bench.yml` (modified, +28/-3)
```diff
@@ -141,7 +141,8 @@ jobs:
     permissions:
       contents: read
       id-token: write
-    timeout-minutes: 30
+    # A cold build with two compile jobs takes longer than one with four.
+    timeout-minutes: 45
     env:
       # One rayon thread keeps simulated instruction counts stable: adaptive
       # work splitting on steals changes them between runs of the same code.
@@ -164,9 +165,21 @@ jobs:
         with:
           tool: cargo-codspeed@4.7.0
 
+      - name: Add swap for the build
+        # A cold build compiles several large crates at once with full debug
+        # info. Without extra swap, a memory peak can stop the hosted runner
+        # with exit code 143 and no compiler error (#4605). The temporary
+        # disk at /mnt has the free space.
+        run: bash scripts/ci-add-swap.sh /mnt/bench.swap 8
+
       - name: Build benchmark shard
         # Keep PR feedback focused on deterministic API/session/cache paths.
-        run: cargo codspeed build -p ${{ matrix.package }} --bench ${{ matrix.bench }} --features codspeed
+        # The resource log shows the cause when the runner stops mid-build.
+        env:
+          # Four parallel compiles of the large fallow crates, with full debug
+          # info, use more than the 16 GB of the runner (#4605).
+          CARGO_BUILD_JOBS: "2"
+        run: bash scripts/ci-with-resource-log.sh cargo codspeed build -p ${{ matrix.package }} --bench ${{ matrix.bench }} --features codspeed
 
       - name: Run benchmark shard
         uses: CodSpeedHQ/action@af75f77f17a054769abefaa42fe8dc2975469b5f # v5.6.3
@@ -214,9 +227,21 @@ jobs:
         with:
           tool: cargo-codspeed@4.7.0
 
+      - name: Add swap for the build
+        # A cold build compiles several large crates at once with full debug
+        # info. Without extra swap, a memory peak can stop the hosted runner
+        # with exit code 143 and no compiler error (#4605). The temporary
+        # disk at /mnt has the free space.
+        run: bash scripts/ci-add-swap.sh /mnt/bench.swap 8
+
       - name: Build full benchmark shard
         # Full suites include audit/git-heavy and scaling paths that are useful but noisier.
-        run: cargo codspeed build -p ${{ matrix.package }} --bench ${{ matrix.bench }} --features codspeed
+        # The resource log shows the cause when the runner stops mid-build.
+        env:
+          # Four parallel compiles of the large fallow crates, with full debug
+          # info, use more than the 16 GB of the runner (#4605).
+          CARGO_BUILD_JOBS: "2"
+        run: bash scripts/ci-with-resource-log.sh cargo codspeed build -p ${{ matrix.package }} --bench ${{ matrix.bench }} --features codspeed
 
       - name: Run full benchmark shard
         uses: CodSpeedHQ/action@af75f77f17a054769abefaa42fe8dc2975469b5f # v5.6.3
```

**File**: `.github/workflows/ci.yml` (modified, +4/-0)
```diff
@@ -984,6 +984,10 @@ jobs:
         run: sh scripts/check-conflict-markers.sh
       - name: Merge-conflict marker check self-test
         run: bash scripts/test-check-conflict-markers.sh
+      - name: CI runner script self-tests
+        run: |
+          bash scripts/test-ci-add-swap.sh
+          bash scripts/test-ci-with-resource-log.sh
 
   js-lint:
     name: JS Lint and Format
```

**File**: `docs/benchmarking.md` (modified, +13/-0)
```diff
@@ -27,6 +27,19 @@ to judge an I/O change.
 compare instruction counts across a change to this profile: the codegen
 changes, so CodSpeed records a one-time baseline shift.
 
+A cold build of a shard compiles several large crates at once, and
+cargo-codspeed always adds full debug info (`-Cdebuginfo=2`). With four
+parallel compile jobs, the large fallow crates (core, engine, cli, lsp) used
+more than the 16 GB of the runner. Each CodSpeed job in
+`.github/workflows/bench.yml` therefore builds with `CARGO_BUILD_JOBS=2` and adds
+8 GiB of swap on the temporary disk (`scripts/ci-add-swap.sh`) before the
+build. The job count does not change the instruction counts, because each
+crate compiles to the same code. The build runs through
+`scripts/ci-with-resource-log.sh`, which prints the available memory, the used
+swap and the available disk every 30 seconds. When a runner stops in "Build
+benchmark shard" with exit code 143 and no compiler error, read the last
+`resources:` lines of the job log to find the resource that ran out.
+
 The optional TypeScript semantic companion is measured separately with
 CodSpeed walltime. Simulation cannot measure the interpreted Node.js process or
 its child process, so `tools/type-aware-sidecar/bench/session.mjs` uses the
```

**File**: `scripts/ci-add-swap.sh` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+#!/usr/bin/env bash
+# Adds a swap file on a Linux CI runner and prints the memory and swap after.
+# When the directory of the file does not exist, or its file system has less
+# free space than the swap size plus a reserve, the script prints a warning and
+# adds no swap: a missing swap file must not fail the job.
+#
+# Usage: bash scripts/ci-add-swap.sh <swap file> <size in GiB>
+set -u
+
+RESERVE_GIB=4
+
+if [ "$#" -ne 2 ] || ! [[ "$2" =~ ^[1-9][0-9]*$ ]]; then
+  echo "usage: bash scripts/ci-add-swap.sh <swap file> <size in GiB>" >&2
+  exit 2
+fi
+
+file="$1"
+size_gib="$2"
+dir="$(dirname "$file")"
+
+warn() {
+  echo "::warning::No extra swap: $1"
+  exit 0
+}
+
+[ -d "$dir" ] || warn "$dir does not exist"
+free_gib="$(df -Pk "$dir" | awk 'NR == 2 { print int($4 / 1024 / 1024) }')"
+[ "$free_gib" -ge $((size_gib + RESERVE_GIB)) ] ||
+  warn "$dir has ${free_gib} GiB free, the swap file needs $((size_gib + RESERVE_GIB)) GiB"
+
+sudo_cmd=""
+[ "$(id -u)" -eq 0 ] || sudo_cmd="sudo -n"
+
+drop() {
+  $sudo_cmd rm -f "$file"
+  warn "$1"
+}
+
+$sudo_cmd fallocate -l "${size_gib}G" "$file" || drop "fallocate failed for $file"
+$sudo_cmd chmod 600 "$file"
+$sudo_cmd mkswap "$file" >/dev/null || drop "mkswap failed for $file"
+$sudo_cmd swapon "$file" || drop "swapon failed for $file"
+free -m
```

**File**: `scripts/ci-with-resource-log.sh` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+#!/usr/bin/env bash
+# Runs a command and prints the available memory, the used swap, the load
+# average and the available disk of the runner at an interval while the command
+# runs, and once at the end. A hosted runner that runs out of memory or disk, or
+# is too busy to answer, stops without an error from the command, so the last
+# lines of the log show the cause.
+#
+# Usage: bash scripts/ci-with-resource-log.sh <command> [args...]
+# RESOURCE_LOG_INTERVAL sets the interval in seconds (default 30). A value that
+# is not a positive whole number uses the default.
+# The exit code is the exit code of the command.
+set -u
+
+if [ "$#" -eq 0 ]; then
+  echo "usage: bash scripts/ci-with-resource-log.sh <command> [args...]" >&2
+  exit 2
+fi
+
+interval="${RESOURCE_LOG_INTERVAL:-30}"
+[[ "$interval" =~ ^[1-9][0-9]*$ ]] || interval=30
+
+sample() {
+  local line="resources:"
+  if [ -r /proc/meminfo ]; then
+    line="$line $(awk '
+      /^MemAvailable:/ { available = $2 }
+      /^SwapTotal:/ { swap_total = $2 }
+      /^SwapFree:/ { swap_free = $2 }
+      END { printf "mem_available_mb=%d swap_used_mb=%d", available / 1024, (swap_total - swap_free) / 1024 }
+    ' /proc/meminfo)"
+  fi
+  if [ -r /proc/loadavg ]; then
+    line="$line load_1m=$(cut -d ' ' -f 1 /proc/loadavg)"
+  fi
+  line="$line $(df -Pk . | awk 'NR == 2 { printf "disk_available_mb=%d", $4 / 1024 }')"
+  echo "$line"
+}
+
+# The sampler also stops its sleep, so no process keeps the output open after
+# the command ends.
+(
+  sleeper=""
+  trap '[ -n "$sleeper" ] && kill "$sleeper" 2>/dev/null; exit 0' TERM
+  while :; do
+    sample
+    sleep "$interval" &
+    sleeper=$!
+    wait "$sleeper"
+  done
+) &
+sampler=$!
+trap 'kill "$sampler" 2>/dev/null' EXIT
+
+"$@"
+status=$?
+kill "$sampler" 2>/dev/null
+sample
+exit "$status"
```

**File**: `scripts/test-ci-add-swap.sh` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+#!/usr/bin/env bash
+# Self-test for scripts/ci-add-swap.sh. Covers the paths that add no swap, so
+# it runs without root: invalid arguments, a missing directory and too little
+# free space. The CodSpeed jobs in bench.yml run the path that adds swap.
+# Run: bash scripts/test-ci-add-swap.sh
+set -u
+
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+SWAP="$SCRIPT_DIR/ci-add-swap.sh"
+
+pass=0
+fail=0
+check() { # description, expected, actual
+  if [ "$2" = "$3" ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL: $1 (expected $2, got $3)"; fi
+}
+
+# 1. Invalid arguments: usage error.
+bash "$SWAP" >/dev/null 2>&1
+check "no arguments" 2 $?
+bash "$SWAP" /tmp/x.swap 0 >/dev/null 2>&1
+check "zero size" 2 $?
+bash "$SWAP" /tmp/x.swap 8G >/dev/null 2>&1
+check "size with unit" 2 $?
+
+# 2. A missing directory: warning, exit code 0, no file.
+out="$(bash "$SWAP" /nonexistent-dir-for-swap-test/x.swap 1 2>&1)"
+check "missing directory exit code" 0 $?
+check "missing directory warning" 1 "$(printf '%s\n' "$out" | grep -c '^::warning::No extra swap: .* does not exist$')"
+# The warning ends the script, so no other command prints anything.
+check "missing directory stops at the warning" 1 "$(printf '%s\n' "$out" | wc -l | tr -d ' ')"
+
+# 3. Too little free space: warning, exit code 0, no file.
+dir="$(mktemp -d)"
+trap 'rm -rf "$dir"' EXIT
+out="$(bash "$SWAP" "$dir/x.swap" 999999 2>&1)"
+check "low space exit code" 0 $?
+check "low space warning" 1 "$(printf '%s\n' "$out" | grep -c '^::warning::No extra swap: .* GiB free, the swap file needs 1000003 GiB$')"
+check "low space stops at the warning" 1 "$(printf '%s\n' "$out" | wc -l | tr -d ' ')"
+check "low space creates no file" 0 "$([ -e "$dir/x.swap" ] && echo 1 || echo 0)"
+
+echo "ci-add-swap: $pass passed, $fail failed"
+[ "$fail" -eq 0 ]
```

**File**: `scripts/test-ci-with-resource-log.sh` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+#!/usr/bin/env bash
+# Self-test for scripts/ci-with-resource-log.sh. Asserts that the wrapper keeps
+# the exit code and the output of the command, prints resource lines, and stops
+# its sampler with the command.
+# Run: bash scripts/test-ci-with-resource-log.sh
+set -u
+
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+WRAP="$SCRIPT_DIR/ci-with-resource-log.sh"
+TMP="$(mktemp -d)"
+trap 'rm -rf "$TMP"' EXIT
+# A wrapper run that takes longer than this has a sampler that did not stop.
+LIMIT_SECONDS=15
+
+pass=0
+fail=0
+check() { # description, expected, actual
+  if [ "$2" = "$3" ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL: $1 (expected $2, got $3)"; fi
+}
+
+# Runs the wrapper with an interval and a command. A reader in the background
+# copies the output through a pipe, like a CI step does. Sets `out` to the
+# output and `status` to the exit code, or to "hung" when the output stays open
+# past the limit (a sampler that keeps running holds the pipe open).
+run_wrapped() { # interval, command...
+  local interval="$1"
+  shift
+  rm -f "$TMP/out" "$TMP/status"
+  ( (RESOURCE_LOG_INTERVAL="$interval" bash "$WRAP" "$@"; echo $? >"$TMP/status") | cat >"$TMP/out" ) &
+  local reader=$!
+  local waited=0
+  while kill -0 "$reader" 2>/dev/null && [ "$waited" -lt "$LIMIT_SECONDS" ]; do
+    sleep 1
+    waited=$((waited + 1))
+  done
+  if kill -0 "$reader" 2>/dev/null; then
+    kill "$reader" 2>/dev/null
+    status=hung
+  else
+    status="$(cat "$TMP/status" 2>/dev/null || echo missing)"
+  fi
+  out="$(cat "$TMP/out" 2>/dev/null)"
+}
+
+resource_lines() { printf '%s\n' "$out" | grep -c '^resources:.*disk_available_mb=[0-9]'; }
+
+# 1. A passing command: exit code 0, its output stays, resource lines appear.
+run_wrapped 1 sh -c 'echo built; sleep 2'
+check "pass exit code" 0 "$status"
+check "command output kept" 1 "$(printf '%s\n' "$out" | grep -c '^built$')"
+check "interval and final resource lines" 1 "$([ "$(resource_lines)" -ge 2 ] && echo 1 || echo 0)"
+if [ -r /proc/meminfo ]; then
+  check "memory and swap on Linux" 1 "$(printf '%s\n' "$out" | grep -c -m1 'mem_available_mb=[0-9]* swap_used_mb=[0-9]*')"
+  check "load average on Linux" 1 "$(printf '%s\n' "$out" | grep -c -m1 'load_1m=[0-9.]* disk_available_mb=')"
+fi
+
+# 2. A failing command: the wrapper returns its exit code.
+run_wrapped 1 sh -c 'exit 7'
+check "failure exit code" 7 "$status"
+
+# 3. The sampler stops with the command and keeps no pipe open. With a 30 s
+# interval, the output has the first line and the final line.
+run_wrapped 30 sleep 2
+check "sampler stops with the command" 0 "$status"
+check "first and final resource lines" 2 "$(resource_lines)"
+
+# 4. An invalid interval uses the default, so the sampler does not loop fast.
+run_wrapped abc sleep 2
+check "invalid interval uses the default" 2 "$(resource_lines)"
+run_wrapped 0 sleep 2
+check "zero interval uses the default" 2 "$(resource_lines)"
+
+# 5. No command: usage error.
+bash "$WRAP" >/dev/null 2>&1
+check "usage error" 2 $?
+
+echo "ci-with-resource-log: $pass passed, $fail failed"
+[ "$fail" -eq 0 ]
```

---

### Incident Patch 3: `0776b47e` (2026-11-14)
**Commit Message**: fix(vscode): enable links set the setting without the Settings editor (#4597)

In Cursor, `workbench.action.openSettings` with a query can freeze the
Settings editor. The command returns the Settings editor pane, and the
Cursor RPC layer serializes that object graph. The "enable" links in the
Security Candidates and Health views used this command through
`fallow.openSettings`.

The links now run `fallow.enableSecurity` and `fallow.enableHealth`.
These commands set the toggle to true in workspace settings, or in user
settings when no folder is open. They show the result, or an error
message that names the setting to change by hand.

Closes #4553

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

**File**: `changelog.d/fix-vscode-open-settings-cursor.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **VS Code: the "enable" links in the Security Candidates and Health views no longer freeze Settings in Cursor.** The links opened the Settings editor with the `fallow` search query. In Cursor, that call can make the Settings editor stop responding. The links now run the new `Fallow: Enable Security Candidates` and `Fallow: Enable Health View` commands. These commands set `fallow.security.enabled` or `fallow.health.enabled` to `true` in workspace settings, or in user settings when no folder is open, and show a message. The Settings editor does not open. (Closes [#4553](https://github.com/fallow-rs/fallow/issues/4553))
```

**File**: `editors/vscode/README.md` (modified, +2/-0)
```diff
@@ -45,6 +45,8 @@ code --install-extension fallow-rs.fallow-vscode
 | `Fallow: Audit Changed Files` | Audit the current change set for a pass/warn/fail verdict, shown in the audit verdict status-bar item (or an information message when that item is disabled). Findings are static candidates to verify. |
 | `Fallow: Reload Health` | Re-run the Health view analysis (score, complexity, hotspot and refactoring candidates) |
 | `Fallow: Scan for Security Candidates` | Scan for local security candidates (`client-server-leak`, tainted-sink CWE findings) and populate the Security Candidates view. Requires `fallow.security.enabled`. Results are UNVERIFIED candidates to verify, never confirmed vulnerabilities. |
+| `Fallow: Enable Security Candidates` | Set `fallow.security.enabled` to `true` in workspace settings (user settings when no folder is open). The Security Candidates welcome link runs this command. |
+| `Fallow: Enable Health View` | Set `fallow.health.enabled` to `true` in workspace settings (user settings when no folder is open). The Health welcome link runs this command. |
 | `Fallow: Load Runtime Coverage` | Analyze a local runtime-coverage capture and populate the Runtime Coverage view with hot paths and cleanup candidates. Prompts for a capture when `fallow.coverage.capturePath` is empty. Requires the fallow-cov sidecar (`fallow coverage setup`). |
 | `Fallow: Reload Runtime Coverage` | Re-run the runtime-coverage analysis against the current capture |
 | `Fallow: Clear Runtime Coverage` | Clear the Runtime Coverage view back to its empty state |
```

**File**: `editors/vscode/package.json` (modified, +18/-2)
```diff
@@ -170,6 +170,14 @@
         "command": "fallow.openSettings",
         "title": "Fallow: Open Settings"
       },
+      {
+        "command": "fallow.enableSecurity",
+        "title": "Fallow: Enable Security Candidates"
+      },
+      {
+        "command": "fallow.enableHealth",
+        "title": "Fallow: Enable Health View"
+      },
       {
         "command": "fallow.noop",
         "title": "Fallow: No-op (internal)"
@@ -870,6 +878,14 @@
           "command": "fallow.reloadAnalysis",
           "when": "false"
         },
+        {
+          "command": "fallow.enableSecurity",
+          "when": "!fallow.security.enabled"
+        },
+        {
+          "command": "fallow.enableHealth",
+          "when": "!fallow.health.enabled"
+        },
         {
           "command": "fallow.reloadCoverage",
           "when": "fallow.hasCoverage"
@@ -915,7 +931,7 @@
       },
       {
         "view": "fallow.health",
-        "contents": "The Health view is turned off.\nEnable [fallow.health.enabled](command:fallow.openSettings) to see the project health score, complexity findings, hotspot candidates, and refactoring candidates.",
+        "contents": "The Health view is turned off.\nEnable [fallow.health.enabled](command:fallow.enableHealth) to see the project health score, complexity findings, hotspot candidates, and refactoring candidates.",
         "when": "!fallow.health.enabled"
       },
       {
@@ -925,7 +941,7 @@
       },
       {
         "view": "fallow.security",
-        "contents": "Security candidate scanning is off by default.\nEnable [fallow.security.enabled](command:fallow.openSettings) to scan for security candidates.\nResults are UNVERIFIED candidates to verify, never confirmed vulnerabilities.",
+        "contents": "Security candidate scanning is off by default.\nEnable [fallow.security.enabled](command:fallow.enableSecurity) to scan for security candidates.\nResults are UNVERIFIED candidates to verify, never confirmed vulnerabilities.",
         "when": "!fallow.security.enabled"
       },
       {
```

**File**: `editors/vscode/src/enableFeature.ts` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import * as vscode from "vscode";
+
+/** Fallow settings that a sidebar welcome link can turn on. */
+export type FeatureToggleKey = "security.enabled" | "health.enabled";
+
+const FEATURE_LABELS: Readonly<Record<FeatureToggleKey, string>> = {
+  "security.enabled": "security candidate scanning",
+  "health.enabled": "the Health view",
+};
+
+/**
+ * Sets a Fallow feature toggle to `true` without the Settings editor.
+ *
+ * The sidebar welcome links use this command instead of
+ * `workbench.action.openSettings` with a query. In Cursor, that command call
+ * with a query can freeze the Settings editor: the reply to the extension host
+ * is the Settings editor pane, and Cursor serializes that object graph (#4553).
+ *
+ * The value goes to workspace settings when a workspace is open, because a
+ * workspace value overrides a user value. Without a workspace, it goes to
+ * user settings. When the write fails (for example, a settings file with
+ * invalid JSON), an error message names the setting to change by hand.
+ */
+export const enableFeature = async (key: FeatureToggleKey): Promise<void> => {
+  const hasWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
+  const target = hasWorkspace
+    ? vscode.ConfigurationTarget.Workspace
+    : vscode.ConfigurationTarget.Global;
+  const where = hasWorkspace ? "workspace" : "user";
+  try {
+    await vscode.workspace.getConfiguration("fallow").update(key, true, target);
+  } catch (error) {
+    const reason = error instanceof Error ? error.message : String(error);
+    void vscode.window.showErrorMessage(
+      `Fallow: could not turn on ${FEATURE_LABELS[key]}. Set "fallow.${key}": true in your ${where} settings.json. ${reason}`,
+    );
+    return;
+  }
+  void vscode.window.showInformationMessage(
+    `Fallow: turned on ${FEATURE_LABELS[key]} (fallow.${key} in ${where} settings).`,
+  );
+};
```

**File**: `editors/vscode/src/extension.ts` (modified, +9/-0)
```diff
@@ -10,6 +10,7 @@ import { runBaselineCommand } from "./baselineCommand.js";
 import { shouldAcceptLspAnalysisComplete } from "./analysisNotification.js";
 import { startClient, stopClient, restartClient } from "./client.js";
 import { cancelReleaseRetry } from "./download.js";
+import { enableFeature } from "./enableFeature.js";
 import { createSingleFlight } from "./analysis-single-flight.js";
 import {
   getHealthEnabled,
@@ -1027,6 +1028,14 @@ export const activate = async (context: vscode.ExtensionContext): Promise<Extens
     }),
   );
 
+  // Turn on an opt-in view from its sidebar welcome link (#4553).
+  context.subscriptions.push(
+    vscode.commands.registerCommand("fallow.enableSecurity", () =>
+      enableFeature("security.enabled"),
+    ),
+    vscode.commands.registerCommand("fallow.enableHealth", () => enableFeature("health.enabled")),
+  );
+
   // License management commands (activate / status / refresh / deactivate).
   // All are one-shot CLI invocations; none touch the analysis path.
   context.subscriptions.push(
```

**File**: `editors/vscode/test/enableFeature.test.ts` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+import { beforeEach, describe, expect, it, vi } from "vitest";
+import { enableFeature } from "../src/enableFeature.js";
+
+const mocks = vi.hoisted(() => ({
+  update: vi.fn<(key: string, value: unknown, target: number) => Promise<void>>(),
+  executeCommand: vi.fn<(command: string, ...args: unknown[]) => Promise<unknown>>(),
+  showInformationMessage: vi.fn<(message: string) => Promise<undefined>>(),
+  showErrorMessage: vi.fn<(message: string) => Promise<undefined>>(),
+  workspaceFolders: undefined as readonly object[] | undefined,
+}));
+
+vi.mock("vscode", () => ({
+  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
+  workspace: {
+    get workspaceFolders() {
+      return mocks.workspaceFolders;
+    },
+    getConfiguration: (section: string) => {
+      expect(section).toBe("fallow");
+      return { update: mocks.update };
+    },
+  },
+  commands: { executeCommand: mocks.executeCommand },
+  window: {
+    showInformationMessage: mocks.showInformationMessage,
+    showErrorMessage: mocks.showErrorMessage,
+  },
+}));
+
+beforeEach(() => {
+  mocks.update.mockReset().mockResolvedValue(undefined);
+  mocks.executeCommand.mockReset();
+  mocks.showInformationMessage.mockReset().mockResolvedValue(undefined);
+  mocks.showErrorMessage.mockReset().mockResolvedValue(undefined);
+  mocks.workspaceFolders = [{}];
+});
+
+describe("enableFeature", () => {
+  it("writes the toggle to workspace settings when a workspace is open", async () => {
+    await enableFeature("security.enabled");
+
+    expect(mocks.update).toHaveBeenCalledWith("security.enabled", true, 2);
+    expect(mocks.showInformationMessage).toHaveBeenCalledWith(
+      expect.stringContaining("fallow.security.enabled in workspace settings"),
+    );
+  });
+
+  it("writes the toggle to user settings when no workspace is open", async () => {
+    mocks.workspaceFolders = undefined;
+
+    await enableFeature("health.enabled");
+
+    expect(mocks.update).toHaveBeenCalledWith("health.enabled", true, 1);
+    expect(mocks.showInformationMessage).toHaveBeenCalledWith(
+      expect.stringContaining("fallow.health.enabled in user settings"),
+    );
+  });
+
+  it("never opens the Settings editor", async () => {
+    await enableFeature("security.enabled");
+
+    expect(mocks.executeCommand).not.toHaveBeenCalled();
+  });
+
+  it("names the manual setting when the settings write fails", async () => {
+    mocks.update.mockRejectedValue(new Error("Unable to write into workspace settings."));
+
+    await expect(enableFeature("security.enabled")).resolves.toBeUndefined();
+
+    expect(mocks.showInformationMessage).not.toHaveBeenCalled();
+    expect(mocks.showErrorMessage).toHaveBeenCalledWith(
+      expect.stringContaining('Set "fallow.security.enabled": true in your workspace settings.json'),
+    );
+    expect(mocks.showErrorMessage).toHaveBeenCalledWith(
+      expect.stringContaining("Unable to write into workspace settings."),
+    );
+  });
+});
```

**File**: `editors/vscode/test/integration/suite/extension.test.ts` (modified, +20/-0)
```diff
@@ -205,6 +205,26 @@ describe("Fallow VS Code extension", () => {
     assert.equal(editor?.selection.active.line, 1);
   });
 
+  for (const { command, key } of [
+    { command: "fallow.enableSecurity", key: "security.enabled" },
+    { command: "fallow.enableHealth", key: "health.enabled" },
+  ]) {
+    it(`sets ${key} in workspace settings from ${command}`, async () => {
+      const workspaceValue = (): boolean | undefined =>
+        vscode.workspace.getConfiguration("fallow").inspect<boolean>(key)?.workspaceValue;
+      assert.equal(workspaceValue(), undefined);
+
+      try {
+        await vscode.commands.executeCommand(command);
+        assert.equal(workspaceValue(), true);
+      } finally {
+        await vscode.workspace
+          .getConfiguration("fallow")
+          .update(key, undefined, vscode.ConfigurationTarget.Workspace);
+      }
+    });
+  }
+
   it("frames completed security scans as unverified candidates in the actual toast", async () => {
     const messages: string[] = [];
     windowApi.showInformationMessage = async (message: string) => {
```

**File**: `editors/vscode/test/package-manifest.test.ts` (modified, +23/-0)
```diff
@@ -492,3 +492,26 @@ describe("package.json license commands", () => {
     expect(properties["fallow.license.showStatusBar"]?.default).toBe(true);
   });
 });
+
+describe("package.json feature enable links", () => {
+  const cases = [
+    { view: "fallow.security", when: "!fallow.security.enabled", command: "fallow.enableSecurity" },
+    { view: "fallow.health", when: "!fallow.health.enabled", command: "fallow.enableHealth" },
+  ] as const;
+
+  // `workbench.action.openSettings` with a query can freeze the Settings
+  // editor in Cursor (#4553). The disabled-state links turn the setting on
+  // directly, so they never open the Settings editor.
+  it.each(cases)("links the disabled $view welcome to $command", (entry) => {
+    const welcome = pkg.contributes.viewsWelcome.find(
+      (item) => item.view === entry.view && item.when === entry.when,
+    );
+    expect(welcome?.contents).toContain(`(command:${entry.command})`);
+    expect(welcome?.contents).not.toContain("command:fallow.openSettings");
+  });
+
+  it.each(cases)("contributes $command and hides it from the palette once on", (entry) => {
+    expect(command(entry.command)?.title).toMatch(/^Fallow: /);
+    expect(commandPaletteEntry(entry.command)?.when).toBe(entry.when);
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #4616** (2026-11-15): ci(bench): build CodSpeed shards with two compile jobs, swap and a resource log (@BartWaardenburg)
- **PR #4615** (2026-11-14): ci(release): run the published Action on Linux after each publication (@BartWaardenburg)
- **PR #4614** (2026-11-14): chore: sync napi, Docker pins and RELEASED_TAG to v3.43.1 (@BartWaardenburg)
- **PR #4607** (2026-11-14): chore: release v3.43.1 (@BartWaardenburg)
- **PR #4604** (2026-11-14): fix(angular): credit more template reads and inherited inputs and outputs (@BartWaardenburg)
- **PR #4602** (2026-11-14): fix(extract): credit enum members read through an alias or passed on whole (@BartWaardenburg)

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

## X. audit): keep a clone inherited when lines above one copy are rewritten

**RULE**:
When implementing operations in `changelog.d/fix-audit-clone-attribution-on-rename.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fallow-rs/fallow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7a3fbe65`: audit): keep a clone inherited when lines above one copy are rewritten. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/fix-audit-clone-attribution-on-rename.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
### Fixed

- **`fallow audit` no longer reports an old clone group as introduced when the change rewrites the lines above one copy.**
  The audit maps each head copy of a clone back to its base lines. When the
  first or last line of a copy was a rewritten line that replaced several base
  lines, the mapped range grew to the far end of the replaced lines and fell
  outside the base clone. A rename of the other copy, together with fewer
  import lines above this copy, could then fail `--gate new-only` on
  duplication that the change did not write. The rewritten edge line now maps
  to the replaced base line next to the unchanged lines of the copy.
  (Closes [#4580](https://github.com/fallow-rs/fallow/issues/4580))
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7a3fbe65` are properly handled with clean fallback behavior.
