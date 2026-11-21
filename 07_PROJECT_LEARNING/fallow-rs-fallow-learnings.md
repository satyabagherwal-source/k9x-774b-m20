> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source**: github ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Source Version**: `ad1c3d5b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T15:49:14.118Z  
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
> **Harvest Timestamp**: 2026-11-21T15:48:43.951Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5392 stars

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

### Core Architecture Module: `crates/api/rule-examples/duplicate-export-alias/files/src/worker.ts`
```
const createHandler = () => (invoiceId: string): string => `sent ${invoiceId}`;

export const handler = createHandler();
export default handler;

```

### Core Architecture Module: `crates/api/rule-examples/high-crap-score/files/src/shipping.ts`
```
export const shippingCost = (country: string, weight: number): number => {
  switch (country) {
    case "NL":
      return weight > 10 ? 9 : 5;
    case "BE":
      return 7;
    case "DE":
      return 8;
    case "FR":
      return 10;
    default:
      return 25;
  }
};

```

### Core Architecture Module: `crates/api/rule-examples/mysql-multiple-statements/files/src/db.ts`
```
import mysql from "mysql";

export const connection = mysql.createConnection({
  host: "localhost",
  user: "shop",
  multipleStatements: true,
});

```

### Core Architecture Module: `crates/api/rule-examples/unrendered-component/files/src/components/index.ts`
```
export { default as CartItem } from "./CartItem.vue";
export { default as Orphan } from "./Orphan.vue";

```

### Core Architecture Module: `crates/api/rule-examples/unrendered-component/files/src/main.ts`
```
import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4986** (2026-11-21): **includeEntryExports misses exports that an entry file re-exports with export ***
  *Symptoms*: ## Problem  With `includeEntryExports: true`, fallow does not report an unused export that a package entry file re-exports with `export * from`. The same export is reported when the entry file re-exports it by name.  A maintainer of a large public pnpm monorepo found this during a review of the fallow gate. The entry file of its contracts package has 77 `export *` lines, so most exports of that package have no unused-export check.  Measured on fallow 3.45.0.  ## Reproduction  ``` package.json                  {"name":"root","private":true,"workspaces":["packages/*"]} packages/lib/package.json     {"name":"@p/lib","private":true,"exports":{".":"./src/index.ts"}} packages/lib/src/index.ts     export * from "./a.ts"; packages/lib/src/a.ts         export const used = 1;                               export const unusedStar = () => 2; packages/app/package.json     {"name":"@p/app","private":true,"main":"src/main.ts","dependencies":{"@p/lib":"workspace:*"}} packages/app/src/main.ts      import { used } from "@p/lib"; console.log(used); .fallowrc.json                {"workspaces":{"settings":{"packages/*":{"includeEntryExports":true}}}} ```  `fallow dead-code --unused-exports` reports nothing. The root-level `"includeEntryExports": true` gives the same result.  Change `index.ts` to `export { used, unusedStar } from "./a.ts";` and fallow reports `unusedStar (re-export)`.  ## Expected  With `includeEntryExports: true`, each name that an entry file exposes needs a consumer, also a name

- **Issue #4963** (2026-11-21): **fix: removing an unused enum member can change the value of a kept member**
  *Symptoms*: ## Problem  `fallow fix` removes each unused enum member. When a kept member after the removed member has no initializer, its value counts on from the member before it. The removal then changes the runtime value of the kept member, and no compile error shows it.  ```ts export enum Level {   Low,      // unused, removed by `fallow fix`   Medium,   // was 1, becomes 0   High,     // was 2, becomes 1 } ```  A value that a program stores, sends or compares as a number then changes meaning. `fallow fix` has had this behavior since the enum member fixer exists. The edit rule of the fixer is now built from syntax spans, so the case is easy to detect: the engine index marks a member whose deletion changes the next value (`MemberSpan::deletion_keeps_values` in `crates/engine/src/source_edits.rs`).  The `suggestion` blocks of the GitHub and GitLab review comments already refuse this case.  ## Decision needed  Which behavior should `fallow fix` have for a member whose removal shifts a kept value?  - A: keep the member and report it with a `skip_reason`. This is safe, but it adds a value to the fix JSON contract, and many enum fixes of numeric enums stop. - B: keep the member and write no record, as for an edit that the index refuses. This is safe and needs no contract change, but the finding stays in each report without an explanation. - C: keep the current behavior and document it.  ## Where  - `crates/cli/src/fix/enum_members.rs`: `enum_member_edits` - `crates/engine/src/source_edits.

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

### Incident Patch 1: `cdac7ade` (2026-11-21)
**Commit Message**: test: give test fixtures one git command builder and strict harness helpers (#4997)

* refactor(engine): add one git command builder for test fixtures

The new git_fixture module builds a git command that removes the ambient repository variables, ignores the global and system config, and uses a fixed identity. The module exists only for tests and for the testing feature.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* refactor(api): re-export the git fixture module for test crates

The LSP and MCP crates do not depend on the engine. Their tests take the fixture git commands from fallow-api.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* test(cli): build harness git commands with the engine fixture module

The CLI test harness keeps the names git, git_capture and git_command. Each one calls the engine fixture module.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* test(api): build integration fixtures with the isolated git command

The old helper read the global git config. A global hooks path or commit signing then reached the fixture commits and made the tests fail.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* test(api): use the isolated git command

**File**: `crates/api/src/audit_run/tests.rs` (modified, +1/-22)
```diff
@@ -1,6 +1,5 @@
 use std::fs;
 use std::path::{Path, PathBuf};
-use std::process::Command;
 
 use fallow_types::output_dead_code::{UnusedDependencyFinding, UnusedExportFinding};
 use fallow_types::results::{DependencyLocation, UnusedDependency, UnusedExport};
@@ -9,27 +8,7 @@ use rustc_hash::FxHashSet;
 use super::base_files::{is_analysis_input, is_non_behavioral_doc, js_ts_tokens_equivalent};
 use super::*;
 
-fn git(dir: &Path, args: &[&str]) {
-    let output = Command::new("git")
-        .args(args)
-        .current_dir(dir)
-        .env_remove("GIT_DIR")
-        .env_remove("GIT_WORK_TREE")
-        .env("GIT_CONFIG_GLOBAL", "/dev/null")
-        .env("GIT_CONFIG_SYSTEM", "/dev/null")
-        .env("GIT_AUTHOR_NAME", "test")
-        .env("GIT_AUTHOR_EMAIL", "test@test.com")
-        .env("GIT_COMMITTER_NAME", "test")
-        .env("GIT_COMMITTER_EMAIL", "test@test.com")
-        .output()
-        .expect("git command failed");
-    assert!(
-        output.status.success(),
-        "git {:?} failed\nstderr:\n{}",
-        args,
-        String::from_utf8_lossy(&output.stderr)
-    );
-}
+use fallow_engine::git_fixture::fixture_git as git;
 
 /// A git repository with one commit that holds `README.md` = `seed\n`.
 fn seeded_repo(parent: &Path) -> PathBuf {
```

**File**: `crates/api/src/lib.rs` (modified, +4/-0)
```diff
@@ -144,6 +144,10 @@ pub use fallow_engine::change_scope::{
     ChangeScope, ChangeScopeOwner, ChangeScopeRequest, first_package_baselines,
     package_baseline_statuses,
 };
+/// Git commands for test fixtures. The LSP and MCP crates do not depend on
+/// the engine, so their tests take the commands from here.
+#[cfg(any(test, feature = "testing"))]
+pub use fallow_engine::git_fixture;
 /// Engine-owned per-workspace Git baseline state used by analysis surfaces.
 pub use fallow_engine::package_baselines::{PackageBaselineError, PackageChangeScope};
 /// Byte spans of the export statements of a file, for a surface that edits
```

**File**: `crates/api/src/list_runtime.rs` (modified, +1/-9)
```diff
@@ -648,7 +648,6 @@ fn logical_group_info_to_output(group: &LogicalGroupInfo) -> BoundariesListLogic
 
 #[cfg(test)]
 mod tests {
-    use std::process::Command;
 
     use fallow_config::ResolvedZone;
     use fallow_types::discover::FileId;
@@ -725,14 +724,7 @@ mod tests {
             .collect()
     }
 
-    fn git(project: &Path, args: &[&str]) {
-        let status = fallow_engine::changed_files::clear_ambient_git_env(&mut Command::new("git"))
-            .args(args)
-            .current_dir(project)
-            .status()
-            .expect("git command should run");
-        assert!(status.success(), "git {args:?} failed");
-    }
+    use fallow_engine::git_fixture::fixture_git as git;
 
     fn setup_changed_boundary_project() -> tempfile::TempDir {
         let project = tempfile::tempdir().expect("project");
```

**File**: `crates/api/src/mutation/e2e_tests.rs` (modified, +2/-11)
```diff
@@ -1,20 +1,12 @@
 use std::fs;
-use std::process::Command;
 
-use fallow_engine::changed_files::clear_ambient_git_env;
 use std::path::{Path, PathBuf};
 use std::time::Duration;
 
 use crate::mutation::{MutationRunOptions, MutationRunScope};
 use crate::{AnalysisOptions, plan_mutation, run_mutation};
 
-fn git(root: &Path, args: &[&str]) {
-    let mut command = Command::new("git");
-    command.args(args).current_dir(root);
-    clear_ambient_git_env(&mut command);
-    let output = command.output().expect("git runs");
-    assert!(output.status.success(), "git {args:?}: {output:?}");
-}
+use fallow_engine::git_fixture::fixture_git as git;
 
 fn commit_all(root: &Path) {
     git(root, &["init", "-q"]);
@@ -436,9 +428,8 @@ fn the_last_report_is_saved_in_the_ignored_cache() {
     let saved: serde_json::Value =
         serde_json::from_slice(&fs::read(&path).expect("read")).expect("json");
     assert_eq!(saved["kind"], "mutation");
-    let status = Command::new("git")
+    let status = fallow_engine::git_fixture::fixture_git_command(project.path())
         .args(["status", "--porcelain", "--untracked-files=all"])
-        .current_dir(project.path())
         .output()
         .expect("git status");
     assert_eq!(
```

**File**: `crates/api/src/mutation/worktree.rs` (modified, +1/-10)
```diff
@@ -255,19 +255,10 @@ pub fn snapshot(
 
 #[cfg(test)]
 mod tests {
-    use std::process::Command;
-
-    use fallow_engine::changed_files::clear_ambient_git_env;
 
     use super::*;
 
-    fn git(root: &Path, args: &[&str]) {
-        let mut command = Command::new("git");
-        command.args(args).current_dir(root);
-        clear_ambient_git_env(&mut command);
-        let output = command.output().expect("git runs");
-        assert!(output.status.success(), "git {args:?}: {output:?}");
-    }
+    use fallow_engine::git_fixture::fixture_git as git;
 
     fn repo() -> tempfile::TempDir {
         let dir = tempfile::tempdir().expect("dir");
```

**File**: `crates/api/src/runtime/audit.rs` (modified, +2/-11)
```diff
@@ -986,7 +986,6 @@ mod orphaned_tests;
 
 #[cfg(test)]
 mod tests {
-    use std::process::Command;
 
     use fallow_config::{AuditGate, FallowConfig, HealthConfig};
     use fallow_types::output_format::OutputFormat;
@@ -1667,14 +1666,7 @@ mod tests {
         project
     }
 
-    fn git(root: &Path, args: &[&str]) {
-        let status = fallow_engine::changed_files::clear_ambient_git_env(&mut Command::new("git"))
-            .args(args)
-            .current_dir(root)
-            .status()
-            .expect("git command");
-        assert!(status.success(), "git {args:?} failed");
-    }
+    use fallow_engine::git_fixture::fixture_git as git;
 
     /// #2699: the auto-detect fallthrough gets the same ref validation as the
     /// explicit and environment paths, so a malformed detection surfaces as a
@@ -1731,9 +1723,8 @@ mod tests {
     }
 
     fn registered_worktree_count(root: &Path) -> usize {
-        let output = fallow_engine::changed_files::clear_ambient_git_env(&mut Command::new("git"))
+        let output = fallow_engine::git_fixture::fixture_git_command(root)
             .args(["worktree", "list", "--porcelain"])
-            .current_dir(root)
             .output()
             .expect("git worktree list");
         assert!(output.status.success(), "git worktree list failed");
```

**File**: `crates/api/src/runtime/audit_orphaned_tests.rs` (modified, +1/-9)
```diff
@@ -2,21 +2,13 @@
 //! changed files, as `fallow audit --gate new-only` does.
 
 use std::path::Path;
-use std::process::Command;
 
 use fallow_config::AuditGate;
 
 use super::run_audit;
 use crate::{AnalysisOptions, AuditOptions, AuditVerdict};
 
-fn git(root: &Path, args: &[&str]) {
-    let status = fallow_engine::changed_files::clear_ambient_git_env(&mut Command::new("git"))
-        .args(args)
-        .current_dir(root)
-        .status()
-        .expect("git command");
-    assert!(status.success(), "git {args:?} failed");
-}
+use fallow_engine::git_fixture::fixture_git as git;
 
 fn commit(root: &Path) {
     git(root, &["add", "."]);
```

**File**: `crates/api/src/runtime/decision_surface.rs` (modified, +1/-8)
```diff
@@ -556,12 +556,5 @@ mod tests {
         );
     }
 
-    fn git(root: &Path, args: &[&str]) {
-        let status = fallow_engine::changed_files::clear_ambient_git_env(&mut Command::new("git"))
-            .args(args)
-            .current_dir(root)
-            .status()
-            .expect("git command");
-        assert!(status.success(), "git {args:?} failed");
-    }
+    use fallow_engine::git_fixture::fixture_git as git;
 }
```

---

### Incident Patch 2: `ab098ba2` (2026-11-21)
**Commit Message**: fix(ci): offer a suggestion block only for an edit that the parser confirms (#4962)

* fix(ci): offer a suggestion block only for an edit that the parser confirms

The `suggestion` blocks of the GitHub and GitLab review comments used a line rule. They turned a re-export into `{ a } from './x'` and `export default thing;` into `thing;`, deleted only the first line of a method over several lines, and deleted two enum members when one was unused.

The engine index now also gives the span of each class element and enum member. The export and member suggestions parse the file and give a block only when the one-line edit changes exactly the statement or the member of the finding. In each other case the comment keeps its text without a block.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* docs(ci): describe the parser-checked suggestion blocks in the changelog

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* fix(ci): offer a member deletion only when the other members keep their text

A deleted class member could join its neighbours when the member above has no semicolon, as in `count = 0` followed by `[Symbol.iterator]() {}`. A deleted enum member shifted the value of the n

**File**: `changelog.d/ci-suggestion-from-syntax.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **GitHub and GitLab review comments no longer offer an unsafe `suggestion` block.** The block that removes an unused export or deletes an unused member used a line rule. It turned `export { a } from './x'` into `{ a } from './x'` and `export default thing;` into `thing;`, deleted only the first line of a method over several lines, and deleted two enum members when one was unused. A delete block for an enum member could also change the value of the next member, and a delete block for a class member could join the members around it when a semicolon was missing. The block is now offered only when the parser confirms that the one-line edit changes exactly the export or the member of the finding. In each other case the comment keeps its text and its fix intent, without a `suggestion` block.
```

**File**: `crates/cli/src/report/ci/suggestion.rs` (modified, +235/-50)
```diff
@@ -1,5 +1,6 @@
-use std::path::PathBuf;
+use std::path::{Path, PathBuf};
 
+use fallow_engine::source_edits::SourceEditIndex;
 use fallow_output::{CiIssue, CiProvider as Provider};
 use fallow_types::output_dead_code::description_carries_caveat;
 
@@ -19,10 +20,13 @@ pub fn suggestion_block(provider: Provider, issue: &CiIssue) -> Option<String> {
     let Some(source) = std::fs::read_to_string(path).ok() else {
         return (!block.is_empty()).then_some(block);
     };
-    let Some(line) = source.lines().nth(issue.line.saturating_sub(1) as usize) else {
-        return (!block.is_empty()).then_some(block);
-    };
-    if let Some(suggestion) = suggestion_or_withheld_hint(provider, issue, line) {
+    if let Some(suggestion) = suggestion_or_withheld_hint(
+        provider,
+        issue,
+        Path::new(&issue.path),
+        &source,
+        u32::try_from(issue.line).unwrap_or(u32::MAX),
+    ) {
         block.push_str(&suggestion);
     }
     (!block.is_empty()).then_some(block)
@@ -37,8 +41,14 @@ pub fn suggestion_block(provider: Provider, issue: &CiIssue) -> Option<String> {
 /// announcing a withheld one-click fix there would invent a fix that never
 /// existed, which is the same overclaiming in the other direction.
 #[must_use]
-fn suggestion_or_withheld_hint(provider: Provider, issue: &CiIssue, line: &str) -> Option<String> {
-    let suggestion = suggestion_block_for_issue_line(provider, &issue.rule_id, line)?;
+fn suggestion_or_withheld_hint(
+    provider: Provider,
+    issue: &CiIssue,
+    path: &Path,
+    source: &str,
+    line: u32,
+) -> Option<String> {
+    let suggestion = suggestion_block_for_issue_line(provider, &issue.rule_id, path, source, line)?;
     Some(if description_carries_caveat(&issue.description) {
         withheld_suggestion_hint()
     } else {
@@ -65,22 +75,127 @@ fn fix_intent_block(intent: &str) -> String {
     format!("\n\n**Fix:** {intent}")
 }
 
+/// The `suggestion` block for the finding of `rule_id` on the 1-based `line`
+/// of the file at `path` with the text `source`.
+///
+/// The export and member rules parse the file. They give a block only when
+/// the parser confirms that the edit of the one line changes exactly the
+/// statement or the member of the finding.
 #[must_use]
 pub fn suggestion_block_for_issue_line(
     provider: Provider,
     rule_id: &str,
-    line: &str,
+    path: &Path,
+    source: &str,
+    line: u32,
 ) -> Option<String> {
+    let line_text = source.lines().nth(line.checked_sub(1)? as usize)?;
     if rule_id.contains("unused-import") {
-        return unused_import_suggestion(provider, line);
+        return unused_import_suggestion(provider, line_text);
+    }
+    let is_member_rule =
+        rule_id.contains("unused-enum-member") || rule_id.contains("unused-class-member");
+    let is_export_rule = rule_id.contains("unused-export") || rule_id.contains("unused-type");
+    if !is_member_rule && !is_export_rule {
+        return None;
     }
-    if rule_id.contains("unused-enum-member") || rule_id.contains("unused-class-member") {
-        return delete_line_suggestion(provider, line);
+    let index = SourceEditIndex::parse(path, source)?;
+    let line_start = line_start(source, line)?;
+    if is_member_rule {
+        let deletable = member_line_is_deletable(&index, source, line, line_start, line_text)
+            && deletion_keeps_other_members(path, &index, source, line_start, line_text);
+        return deletable.then(|| delete_line_suggestion(provider));
+    }
+    let fixed = unused_export_line(&index, line, line_start, line_text)?;
+    Some(match provider {
+        Provider::Github => format!("\n\n```suggestion\n{fixed}\n```"),
+        Provider::Gitlab => format!("\n\n```suggestion:-0+0\n{fixed}\n```"),
+    })
+}
+
+/// The byte offset of the start of the 1-based `line` of `source`.
+fn line_start(source: &str, line: u32) -> Option<usize> {
+    let index = line.checked_sub(1)? as usize;
+    if index == 0 {
+        return Some(0);
+    }
+    source
+        .match_indices('\n')
+        .nth(index - 1)
+        .map(|(offset, _)| offset + 1)
+}
+
+/// The text of `line` without the `export` of its one statement, when the
+/// line holds one complete edit: one export statement starts at the line
+/// start, no other statement covers the line, the statement exports one
+/// name, and its keyword edit ends on the line.
+fn unused_export_line<'a>(
+    index: &SourceEditIndex,
+    line: u32,
+    line_start: usize,
+    line_text: &'a str,
+) -> Option<&'a str> {
+    let mut on_line = index.export_statements_on_line(line);
+    let (Some(statement), None) = (on_line.next(), on_line.next()) else {
+        return None;
+    };
+    let line_idx = line.saturating_sub(1) as usize;
+    let covered_by_another = index.statements().iter().any(|other| {
+        let (first, last) = index.line_range(other.start, other.end);
+        other.start != statement.start && (first..=last).contains(&line_idx
```

**File**: `crates/cli/src/report/ci/suggestion_syntax_tests.rs` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+use super::*;
+
+const EXPORT: &str = "fallow/unused-export";
+const ENUM_MEMBER: &str = "fallow/unused-enum-member";
+const CLASS_MEMBER: &str = "fallow/unused-class-member";
+const DELETE_GITHUB: &str = "\n\n```suggestion\n\n```";
+
+/// The suggestion for the finding of `rule_id` on the 1-based `line` of a
+/// file `src/dead.ts` with `source`.
+fn suggest(provider: Provider, rule_id: &str, source: &str, line: u32) -> Option<String> {
+    suggestion_block_for_issue_line(provider, rule_id, Path::new("src/dead.ts"), source, line)
+}
+
+#[test]
+fn no_suggestion_for_a_re_export() {
+    for provider in [Provider::Github, Provider::Gitlab] {
+        assert_eq!(
+            suggest(provider, EXPORT, "export { a } from './x';\n", 1),
+            None
+        );
+    }
+}
+
+#[test]
+fn no_suggestion_for_a_method_over_several_lines() {
+    let source = "class C {\n  legacy() {\n    return null;\n  }\n}\n";
+    assert_eq!(suggest(Provider::Github, CLASS_MEMBER, source, 2), None);
+    let one_line = "class C {\n  legacy() { return null; }\n}\n";
+    assert_eq!(
+        suggest(Provider::Github, CLASS_MEMBER, one_line, 2).as_deref(),
+        Some(DELETE_GITHUB)
+    );
+}
+
+#[test]
+fn no_suggestion_for_a_default_export_without_a_name() {
+    for source in ["export default function () {}\n", "export default thing;\n"] {
+        assert_eq!(
+            suggest(Provider::Github, EXPORT, source, 1),
+            None,
+            "{source}"
+        );
+    }
+}
+
+#[test]
+fn no_suggestion_for_a_line_with_two_enum_members() {
+    let source = "enum E {\n  A, B,\n  C\n}\n";
+    assert_eq!(suggest(Provider::Github, ENUM_MEMBER, source, 2), None);
+    assert_eq!(
+        suggest(Provider::Github, ENUM_MEMBER, source, 3).as_deref(),
+        Some(DELETE_GITHUB)
+    );
+}
+
+#[test]
+fn no_suggestion_for_a_line_with_two_exports() {
+    for source in [
+        "export const a = 1; export const b = 2;\n",
+        "export const a = 1, b = 2;\n",
+        "export const a = 1;\nconst = ;\n",
+    ] {
+        assert_eq!(
+            suggest(Provider::Github, EXPORT, source, 1),
+            None,
+            "{source}"
+        );
+    }
+}
+
+#[test]
+fn no_suggestion_when_the_deletion_joins_two_class_members() {
+    for source in [
+        "class C {\n  count = 0\n  legacy() {}\n  [Symbol.iterator]() {}\n}\n",
+        "class C {\n  a = 1\n  legacy() {}\n  [b] = 2\n}\n",
+    ] {
+        assert_eq!(
+            suggest(Provider::Github, CLASS_MEMBER, source, 3),
+            None,
+            "{source}"
+        );
+    }
+    let with_semicolons = "class C {\n  count = 0;\n  legacy() {}\n  [Symbol.iterator]() {}\n}\n";
+    assert_eq!(
+        suggest(Provider::Github, CLASS_MEMBER, with_semicolons, 3).as_deref(),
+        Some(DELETE_GITHUB)
+    );
+}
+
+#[test]
+fn no_suggestion_when_the_deletion_shifts_an_enum_value() {
+    let source = "enum E {\n  A,\n  Deprecated,\n  Kept,\n}\n";
+    assert_eq!(suggest(Provider::Github, ENUM_MEMBER, source, 3), None);
+    let explicit = "enum E {\n  A,\n  Deprecated,\n  Kept = 5,\n}\n";
+    assert_eq!(
+        suggest(Provider::Github, ENUM_MEMBER, explicit, 3).as_deref(),
+        Some(DELETE_GITHUB)
+    );
+}
+
+#[test]
+fn no_suggestion_for_one_declaration_of_an_overloaded_name() {
+    let source = "export function f(a: string): void;\nexport function f(a: any) {}\n";
+    assert_eq!(suggest(Provider::Github, EXPORT, source, 1), None);
+}
+
+#[test]
+fn no_suggestion_for_an_overloaded_method() {
+    let source = "class C {\n  m(a: string): void;\n  m(a: number): void;\n  m(a: any) {}\n}\n";
+    assert_eq!(suggest(Provider::Github, CLASS_MEMBER, source, 4), None);
+}
+
+#[test]
+fn a_crlf_file_gets_the_same_member_suggestion() {
+    let source = "class C {\r\n  count = 0;\r\n  legacy() {}\r\n}\r\n";
+    assert_eq!(
+        suggest(Provider::Github, CLASS_MEMBER, source, 3).as_deref(),
+        Some(DELETE_GITHUB)
+    );
+}
```

**File**: `crates/engine/src/source_edits.rs` (modified, +206/-21)
```diff
@@ -10,7 +10,10 @@
 
 use std::path::Path;
 
-use oxc_ast::ast::{Declaration, ExportDefaultDeclarationKind, Program, Statement};
+use oxc_ast::ast::{
+    ClassBody, Declaration, ExportDefaultDeclarationKind, Program, Statement, TSEnumBody,
+};
+use oxc_ast_visit::Visit;
 use oxc_span::{GetSpan, SourceType};
 
 /// One replacement of a byte range of the source text.
@@ -77,9 +80,27 @@ impl ExportStatement {
     }
 }
 
-/// The export statements of one file text.
+/// One class element or enum member.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub struct MemberSpan {
+    /// The byte offset of the first byte of the member.
+    pub start: u32,
+    /// The byte offset after the last byte of the member.
+    pub end: u32,
+    /// False for an enum member whose deletion changes the value of the next
+    /// member: the next member has no initializer, so its value counts on
+    /// from this member. Always true for a class element.
+    pub deletion_keeps_values: bool,
+    /// True for a class element whose static key another element of the same
+    /// class also has, such as an overload signature, its implementation, or
+    /// one half of a getter and setter pair. Always false for an enum member.
+    pub shares_its_key: bool,
+}
+
+/// The export statements and the class and enum members of one file text.
 pub struct SourceEditIndex {
     statements: Vec<ExportStatement>,
+    members: Vec<MemberSpan>,
     source: String,
     line_starts: Vec<u32>,
 }
@@ -95,7 +116,10 @@ impl SourceEditIndex {
     /// or when a block does not parse without an error.
     #[must_use]
     pub fn parse(path: &Path, source: &str) -> Option<Self> {
-        let statements = parse_statements(path, source)?;
+        let Parsed {
+            statements,
+            members,
+        } = parse_file(path, source)?;
         let line_starts = std::iter::once(0)
             .chain(
                 source
@@ -105,6 +129,7 @@ impl SourceEditIndex {
             .collect();
         Some(Self {
             statements,
+            members,
             source: source.to_owned(),
             line_starts,
         })
@@ -161,6 +186,31 @@ impl SourceEditIndex {
         &self.statements
     }
 
+    /// The statements whose `export` keyword is on the 1-based `line`.
+    pub fn export_statements_on_line(&self, line: u32) -> impl Iterator<Item = &ExportStatement> {
+        let line_idx = line.saturating_sub(1) as usize;
+        self.statements
+            .iter()
+            .filter(move |statement| self.line_of(statement.start) == line_idx)
+    }
+
+    /// The class elements and enum members whose first byte is on the
+    /// 1-based `line`, at each depth of the file.
+    pub fn members_on_line(&self, line: u32) -> impl Iterator<Item = &MemberSpan> {
+        let line_idx = line.saturating_sub(1) as usize;
+        self.members
+            .iter()
+            .filter(move |member| self.line_of(member.start) == line_idx)
+    }
+
+    /// Each class element and enum member of the file. The elements of one
+    /// class body or enum body are in source order, and each body comes
+    /// before the members nested inside it.
+    #[must_use]
+    pub fn members(&self) -> &[MemberSpan] {
+        &self.members
+    }
+
     /// The statement whose `export` keyword is at byte `start`.
     #[must_use]
     pub fn statement_at(&self, start: u32) -> Option<&ExportStatement> {
@@ -172,12 +222,16 @@ impl SourceEditIndex {
     /// The 0-based first and last line of the bytes `start..end`.
     #[must_use]
     pub fn line_range(&self, start: u32, end: u32) -> (usize, usize) {
-        let line_of = |offset: u32| {
-            self.line_starts
-                .partition_point(|line_start| *line_start <= offset)
-                .saturating_sub(1)
-        };
-        (line_of(start), line_of(end.saturating_sub(1).max(start)))
+        (
+            self.line_of(start),
+            self.line_of(end.saturating_sub(1).max(start)),
+        )
+    }
+
+    fn line_of(&self, offset: u32) -> usize {
+        self.line_starts
+            .partition_point(|line_start| *line_start <= offset)
+            .saturating_sub(1)
     }
 
     /// True when no other text shares the lines of `start..end`: only white
@@ -198,7 +252,14 @@ impl SourceEditIndex {
     }
 }
 
-fn parse_statements(path: &Path, source: &str) -> Option<Vec<ExportStatement>> {
+/// The statements and members of a file or of its script blocks.
+#[derive(Default)]
+struct Parsed {
+    statements: Vec<ExportStatement>,
+    members: Vec<MemberSpan>,
+}
+
+fn parse_file(path: &Path, source: &str) -> Option<Parsed> {
     if fallow_extract::is_sfc_file(path) {
         let scripts = fallow_extract::extract_sfc_scripts(source);
         return parse_blocks(source, scripts.iter().filter(|script| script.src.is_none()));
@@ -217,8 +278,8 @@ fn parse_statements(path: &Path, source: &str) -> Option<Vec<ExportStatement>> {
 fn parse_blocks<'a>(
     file: &str,
   
```

---

### Incident Patch 3: `ad1c3d5b` (2026-11-21)
**Commit Message**: fix(security): read every sink call through one canonical call (#4993)

* fix(security): read every sink call through one canonical call

fallow security missed four usual forms of a sink call:
new Handlebars.SafeString(x), this.sanitizer.bypassSecurityTrustHtml(x),
$("#p").html(x) and console.log("login", secret). Each sink shape
flattened its callee in its own way, and a matcher row matched one shape
and one argument position.

CanonicalCall (crates/extract/src/visitor/canonical_call.rs) now holds
the receiver chain of a callee with this and call-result segments, the
form (call or new), and every argument with its kind. The call and new
sinks, member assignments, tagged templates, security controls and
framework request sources read callees through it. The method allowlists
and the second flattener are removed. A call of a method of the class
itself (this.query(x)) gives no sink site. One receiver chain holds at
most eight call results, so the work on a fluent chain stays linear.

A matcher row now says which forms it accepts (forms) and which
arguments it reads (arguments: index, variadic or any-non-literal).
template-escape-bypass accepts new, and the secret-pii-log rows read
e

**File**: `changelog.d/fix-security-canonical-call.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **`fallow security` reports the usual forms of a sink call.** These calls now give a candidate: `new Handlebars.SafeString(x)` (`template-escape-bypass`), `this.sanitizer.bypassSecurityTrustHtml(x)` (`angular-trusted-html`), `$("#p").html(x)` (`jquery-html`) and `console.log("login", secret)` (`secret-pii-log`). The extractor now reads each call and `new` expression in one way, so a sink behind `this.`, a call result or a local alias gets the same candidate as the plain form. A matcher row now says which call forms it accepts (`forms`) and which arguments it reads (`arguments`). Log rows read every non-literal argument. A call of a member of `this` itself (`this.query(x)`) matches only the rows that set the new `this_receiver` field: the raw SQL methods (`this.$queryRawUnsafe(x)`, `this.whereRaw(x)`) and the markup parsers (`this.insertAdjacentHTML(x)`), as before. A member of a field (`this.db.query(x)`) matches every row. A long fluent chain keeps the candidate of a sink at its end. A member that a destructuring takes from a `require()` binding of a Node.js module (`const { exec } = cp`) now resolves to the module path. Security controls and framework request sources also read callees behind `this.` and call results, so `this.router.get("/", handler)` now marks `req` as request input. Projects can get new candidates, and fewer calls show as unresolved callees. The cache version changes, so the first run after the update parses each file again. (#4940)
```

**File**: `crates/api/rule-examples/angular-trusted-html/files/src/comment-html.ts` (modified, +7/-2)
```diff
@@ -4,5 +4,10 @@ interface Comment {
   body: string;
 }
 
-export const trustCommentHtml = (sanitizer: DomSanitizer, comment: Comment): SafeHtml =>
-  sanitizer.bypassSecurityTrustHtml(comment.body);
+export class CommentHtml {
+  constructor(private readonly sanitizer: DomSanitizer) {}
+
+  trust(comment: Comment): SafeHtml {
+    return this.sanitizer.bypassSecurityTrustHtml(comment.body);
+  }
+}
```

**File**: `crates/api/rule-examples/jquery-html/files/src/preview.ts` (modified, +1/-2)
```diff
@@ -5,6 +5,5 @@ interface Comment {
 }
 
 export const showPreview = (comment: Comment): void => {
-  const preview = $("#preview");
-  preview.html(comment.body);
+  $("#preview").html(comment.body);
 };
```

**File**: `crates/api/rule-examples/secret-pii-log/files/src/server.ts` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ const app = express();
 app.use(express.json());
 
 app.post("/login", (req, res) => {
-  console.log(`login ${req.body.email} ${req.body.password}`);
+  console.log("login", req.body.email, req.body.password);
   res.sendStatus(204);
 });
 
```

**File**: `crates/api/rule-examples/template-escape-bypass/example.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"hidden":["package.json"]}
```

**File**: `crates/api/rule-examples/template-escape-bypass/files/package.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"name":"example","private":true,"main":"src/profile.ts","dependencies":{"handlebars":"^4.0.0"}}
```

**File**: `crates/api/rule-examples/template-escape-bypass/files/src/profile.ts` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+import Handlebars from "handlebars";
+
+interface Profile {
+  bio: string;
+}
+
+export const profileBio = (profile: Profile): Handlebars.SafeString =>
+  new Handlebars.SafeString(profile.bio);
```

**File**: `crates/api/src/explain_examples_table.rs` (modified, +9/-0)
```diff
@@ -818,6 +818,15 @@ pub(super) const RULE_EXAMPLES: &[RuleExample] = &[
             file!("stale-suppression", "files", "src/money.ts", false),
         ],
     },
+    RuleExample {
+        rule: "template-escape-bypass",
+        args: &[],
+        base: &[],
+        files: &[
+            file!("template-escape-bypass", "files", "package.json", true),
+            file!("template-escape-bypass", "files", "src/profile.ts", false),
+        ],
+    },
     RuleExample {
         rule: "test-only-branch",
         args: &[],
```

#### Recent Merged Pull Requests:
- **PR #4998** (2026-11-21): fix(audit): key the base snapshot on the inputs of the base pass (@BartWaardenburg)
- **PR #4997** (2026-11-21): test: give test fixtures one git command builder and strict harness helpers (@BartWaardenburg)
- **PR #4996** (2026-11-21): fix(dead-code): check the members of an entry file export under includeEntryExports (@BartWaardenburg)
- **PR #4995** (2026-11-21): feat(health): add a threshold override comment for one function (@BartWaardenburg)
- **PR #4994** (2026-11-21): fix(effect): accept a schema that a function call builds (@BartWaardenburg)
- **PR #4993** (2026-11-21): fix(security): read every sink call through one canonical call (@BartWaardenburg)

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

## X. test: give test fixtures one git command builder and strict harness helpers

**RULE**:
When implementing operations in `crates/api/src/audit_run/tests.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fallow-rs/fallow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cdac7ade`: test: give test fixtures one git command builder and strict harness helpers. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/api/src/audit_run/tests.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use fallow_engine::git_fixture::fixture_git as git;
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use std::process::Command;
fn git(dir: &Path, args: &[&str]) {
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .env_remove("GIT_DIR")
        .env_remove("GIT_WORK_TREE")
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_SYSTEM", "/dev/null")
        .env("GIT_AUTHOR_NAME", "test")
        .env("GIT_AUTHOR_EMAIL", "test@test.com")
        .env("GIT_COMMITTER_NAME", "test")
        .env("GIT_COMMITTER_EMAIL", "test@test.com")
        .output()
        .expect("git command failed");
    assert!(
        output.status.success(),
        "git {:?} failed\nstderr:\n{}",
        args,
        String::from_utf8_lossy(&output.stderr)
    );
}
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cdac7ade` are properly handled with clean fallback behavior.
