# Verification Protocol: Verification Protocol: Empirical Defect Shield for fallow-rs/fallow

<!-- PROVENANCE_START
{
  "source_repository": "fallow-rs/fallow",
  "source_url": "https://github.com/fallow-rs/fallow",
  "source_version": "a01bf36e",
  "license": "MIT",
  "timestamp": "2026-11-22T22:49:27.585Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-fallow-rs-fallow",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fallow-rs/fallow](https://github.com/fallow-rs/fallow) (Revision: `a01bf36e`).  
> **License**: MIT | **Timestamp**: `2026-11-22T22:49:27.585Z`  
> **Learning ID**: `learn-github-fallow-rs-fallow`


## 1. Scope & Verification Target
- **Target Repository**: `fallow-rs/fallow` (Commit: `a01bf36e`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): fallow-rs/fallow

> **Canonical Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T22:49:26.778Z  
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
- **Issue #5024** (2026-11-22): **security --gate new passes a .server import that a change adds to a transitive module**
  *Symptoms*: `fallow security --gate new` passes when a change adds a `.server` import to an existing module that a route imports. The candidate points at the route module, and the added import is only an `intermediate` hop of the trace. #4881 fixed the direct case in v3.46.0. This case comes from a comment on #4881 that arrived after the close.  ## Reproduction (fallow 3.46.0)  ```sh mkdir rr-server-only-repro && cd rr-server-only-repro && mkdir -p app/routes app/components app/utils cat > package.json <<'JSON' { "name": "rr-server-only-repro", "private": true, "type": "module",   "dependencies": { "react": "^19.0.0", "react-router": "^7.0.0" },   "devDependencies": { "@react-router/dev": "^7.0.0" } } JSON printf "import { index, type RouteConfig } from '@react-router/dev/routes'\n\nexport default [index('routes/home.tsx')] satisfies RouteConfig\n" > app/routes.ts printf "import { Outlet } from 'react-router'\n\nexport default function App() {\n\treturn <Outlet />\n}\n" > app/root.tsx printf "export function getConfig() {\n\treturn { region: 'nz' }\n}\n" > app/utils/config.server.ts printf "export function Banner() {\n\treturn <p>Banner</p>\n}\n" > app/components/banner.tsx printf "import { Banner } from '../components/banner'\n\nexport default function Home() {\n\treturn <Banner />\n}\n" > app/routes/home.tsx git init -q -b main && git add -A && git commit -qm base && git checkout -q -b change printf "import { getConfig } from '../utils/config.server'\n\nexport function Banner() {\n\tre

- **Issue #5007** (2026-11-21): **viz: --output-file writes an empty file and the map goes to fallow-viz.html**
  *Symptoms*: ## Problem  `fallow viz` accepts the global `--output-file` flag, but the flag does not set the map path. The command writes an empty file at the given path and writes the HTML map to the default `fallow-viz.html` in the project root. The exit code is 0. The flag that sets the map path is `--out`.  A user who expects `--output-file` to work like in the other commands gets an empty file and no error.  ## Reproduction (fallow 3.43.2)  ```bash mkdir -p p/src && cd p echo 'export const a = 1;' > src/index.ts echo '{"name":"p","main":"src/index.ts"}' > package.json fallow viz --no-open --output-file out.html ls -la *.html ```  Result:  ``` fallow-viz.html   (the map) out.html          (0 bytes) ```  ## Expected  One of these:  - `fallow viz` treats `--output-file` as `--out`, or - `fallow viz` rejects `--output-file` with exit 2 and names `--out`.  ## Notes  The empty file comes from the global report writer: `viz` prints no report on stdout, so the writer writes nothing to the file. 

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

### Incident Patch 1: `f614bba7` (2026-11-22)
**Commit Message**: fix(vscode): keep a verified binary through a failed upgrade and confirm a fix before saving (#5051)

* fix(vscode): keep a verified binary through a failed upgrade and confirm a fix before saving

A managed upgrade that could not replace the binary, for example because a
sibling window on Windows runs the old fallow-lsp, deleted the signature and
target marker of the old binary. The next start then removed that binary as
untrusted. The installer now moves the old sidecars aside and puts them back
when the upgrade fails.

The startup cleanup of crashed downloads removed the temp files of every other
process, also of a window whose download still ran. It now removes only the
temp files of a process that no longer runs.

Fallow: Fix saved all editors before it asked for confirmation, ignored a
failed save, and restarted the language server also after a No. The command
now saves after the confirmation, stops when a file cannot be saved, and
refreshes only after a fix run.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* fix(vscode): back up sidecars by copy and keep files of a running install

The installer now copies each old sidecar before it publishes the new one.
A process t

**File**: `changelog.d/fix-vscode-upgrade-and-fix-command.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+### Fixed
+
+- **A failed upgrade of the VS Code managed binary keeps the installed binary usable.** On Windows, a sibling window that runs the old `fallow-lsp` locks the file, so the new binary cannot replace it. The extension then deleted the signature and target marker of the old binary, and the next start removed that binary as untrusted. The extension now puts the old signature and target marker back.
+- **A second VS Code window no longer deletes the download of the first window.** Each window removes the temp files of crashed downloads when it starts. It removed the temp files of every other process, also of a window whose download still ran, and that download then failed its signature check. The extension now removes only the temp files of a process that no longer runs.
+- **`Fallow: Fix` saves and refreshes only after you confirm.** The command saved all dirty editors before it asked for confirmation, and it restarted the language server and ran a new analysis also after you answered No. The command now saves after the confirmation, applies no fix when a file cannot be saved, and refreshes only after a fix run.
```

**File**: `editors/vscode/src/commands.ts` (modified, +37/-1)
```diff
@@ -643,6 +643,23 @@ const confirmApplyFixes = async (): Promise<boolean> => {
   return confirm === "Yes";
 };
 
+/**
+ * Ask for confirmation, then save all editors. The fix reads the files on
+ * disk, so it must not run over unsaved edits.
+ */
+const confirmAndSaveForFix = async (): Promise<boolean> => {
+  if (!(await confirmApplyFixes())) {
+    return false;
+  }
+  if (await vscode.workspace.saveAll(false)) {
+    return true;
+  }
+  void vscode.window.showWarningMessage(
+    "Fallow: not all files could be saved. No fixes were applied.",
+  );
+  return false;
+};
+
 const openFixLocation = async (root: string, fix: FixAction | undefined): Promise<void> => {
   if (!fix) {
     return;
@@ -1092,17 +1109,23 @@ export const runInspectActiveSymbol = async (
   return runInspectActiveFile(context, outputChannel, symbol);
 };
 
+/**
+ * Run `fallow fix`. An apply run asks for confirmation and saves all editors
+ * first. `afterRun` runs once the CLI was started, also when it failed, since
+ * a failed apply run can have changed files before it stopped.
+ */
 export const runFix = async (
   context: vscode.ExtensionContext,
   dryRun: boolean,
+  afterRun?: () => Promise<void>,
 ): Promise<FallowFixResult | null> => {
   const root = getWorkspaceRoot();
   if (!root) {
     void vscode.window.showWarningMessage("Fallow: no workspace folder open.");
     return null;
   }
 
-  if (!dryRun && !(await confirmApplyFixes())) {
+  if (!dryRun && !(await confirmAndSaveForFix())) {
     return null;
   }
 
@@ -1141,9 +1164,22 @@ export const runFix = async (
     const message = err instanceof Error ? err.message : String(err);
     void vscode.window.showErrorMessage(`Fallow fix failed: ${message}`);
     return null;
+  } finally {
+    await afterRun?.();
   }
 };
 
+/**
+ * Apply fixes, then call `refresh` when the CLI ran. A declined confirmation
+ * or a failed save changes no file on disk, so it skips the refresh.
+ */
+export const applyFixes = async (
+  context: vscode.ExtensionContext,
+  refresh: () => Promise<void>,
+): Promise<void> => {
+  await runFix(context, false, refresh);
+};
+
 /**
  * Whether the per-session "no workspace folder" warning has already been shown
  * for the Health view. The Health view re-spawns on every reveal until it
```

**File**: `editors/vscode/src/download.ts` (modified, +101/-39)
```diff
@@ -244,16 +244,34 @@ export const httpsDownload = (url: string, dest: string, signal?: AbortSignal):
 // solely by the download path, so a match is never a valid installed binary.
 const ORPHAN_TEMP_RE = /^\..+\.(\d+)\.\d+\.tmp(?:\.sig|\.sha256|\.target)?$/;
 
+/**
+ * Whether a process with this pid runs on this host. `kill(pid, 0)` sends no
+ * signal: it fails with ESRCH for a pid that does not exist, and with EPERM for
+ * a process of another user, which still runs. Pid 0 addresses the process
+ * group, so it never names a download. The windows that share one global
+ * storage folder run on one host, so their pids are comparable.
+ */
+const isProcessRunning = (pid: number): boolean => {
+  if (pid <= 0) {
+    return false;
+  }
+  try {
+    process.kill(pid, 0);
+    return true;
+  } catch (err) {
+    return (err as NodeJS.ErrnoException).code === "EPERM";
+  }
+};
+
 /**
  * Remove temp files left behind by a download that died (SIGKILL / crash /
  * reboot) between writing the temp file and renaming it into place. The
  * try/catch cleanup in `downloadAsset` only runs when the JS runtime reaches it,
- * so a hard kill leaks the temp permanently. Skip temps tagged with the current
- * pid: those may be a live in-flight download in this same process (sweeping
- * runs outside the install lock), and a running pid is never a crash orphan.
+ * so a hard kill leaks the temp permanently. The sweep runs outside the install
+ * lock, so it spares each temp whose owner pid still runs: that temp can be a
+ * live download of this window or of a sibling window.
  */
 export const sweepOrphanTempFiles = (dir: string): void => {
-  const livePid = String(process.pid);
   let entries: string[];
   try {
     entries = fs.readdirSync(dir);
@@ -263,7 +281,7 @@ export const sweepOrphanTempFiles = (dir: string): void => {
   }
   for (const entry of entries) {
     const match = ORPHAN_TEMP_RE.exec(entry);
-    if (!match || match[1] === livePid) {
+    if (!match || isProcessRunning(Number(match[1]))) {
       continue;
     }
     try {
@@ -340,6 +358,12 @@ const isInstallLockStale = (lockPath: string): boolean => {
   }
 };
 
+/** An install in this window or a sibling window holds a live lock on this folder. */
+const isInstallInProgress = (dir: string): boolean => {
+  const lockPath = getLockPath(dir);
+  return fs.existsSync(lockPath) && !isInstallLockStale(lockPath);
+};
+
 /**
  * Run `fn` while holding the cross-process install lock. Waits for a live sibling
  * to finish, steals a stale or long-overdue lock to guarantee progress, and
@@ -398,6 +422,39 @@ const publishSidecar = (tempPath: string, finalPath: string): void => {
   fs.renameSync(tempPath, finalPath);
 };
 
+/**
+ * Copy a published sidecar before an upgrade replaces it. A copy, not a move,
+ * keeps the installed binary verifiable if the process dies before the publish.
+ */
+const backUpSidecar = (finalPath: string, backupPath: string): void => {
+  if (fs.existsSync(finalPath)) {
+    fs.copyFileSync(finalPath, backupPath);
+  }
+};
+
+const readBytes = (filePath: string): Buffer => Buffer.from(fs.readFileSync(filePath));
+
+/**
+ * Undo the publish of one sidecar after the binary failed to land. Without a
+ * backup, no sidecar existed before, so the new one describes a binary that
+ * is not there. A sibling window that installs at the same time (after a
+ * stolen lock) can have published its own sidecar since; that one stays.
+ */
+const restoreSidecar = (backupPath: string, finalPath: string, published: Buffer): void => {
+  try {
+    if (fs.existsSync(finalPath) && !readBytes(finalPath).equals(published)) {
+      return;
+    }
+    if (fs.existsSync(backupPath)) {
+      publishSidecar(backupPath, finalPath);
+    } else if (fs.existsSync(finalPath)) {
+      fs.unlinkSync(finalPath);
+    }
+  } catch {
+    // Best-effort: an untrusted leftover only triggers a fresh download.
+  }
+};
+
 /**
  * Atomically move a verified temp binary onto its final path. If the rename fails
  * because the target is locked (a sibling window's running LSP on Windows) but the
@@ -426,23 +483,27 @@ const getDigestPath = (binaryPath: string): string => `${binaryPath}${SHA256_SUF
 
 const getTargetPath = (binaryPath: string): string => `${binaryPath}${TARGET_SUFFIX}`;
 
-const purgeManagedBinary = (binaryPath: string): void => {
-  for (const candidate of [
-    binaryPath,
-    getSignaturePath(binaryPath),
-    getDigestPath(binaryPath),
-    getTargetPath(binaryPath),
-  ]) {
+const removeFiles = (paths: string[]): void => {
+  for (const candidate of paths) {
     try {
       if (fs.existsSync(candidate)) {
         fs.unlinkSync(candidate);
       }
     } catch {
-      // Best-effort cleanup.
+      // Best-effort: a leftover temp file matches ORPHAN_TEMP_RE, so the next
+      // orphan cleanup removes it.
     }
   }
 };
 
+const purgeManagedBinary = (binaryPath: string): void =>
+  removeFiles([
+    binaryPath,
+    getSignaturePath(b
```

**File**: `editors/vscode/src/extension.ts` (modified, +9/-10)
```diff
@@ -34,6 +34,7 @@ import {
   type ComplexityToggleTarget,
 } from "./complexityLens.js";
 import {
+  applyFixes,
   runAnalysis,
   runAudit,
   runFix,
@@ -864,16 +865,14 @@ export const activate = async (context: vscode.ExtensionContext): Promise<Extens
   });
 
   context.subscriptions.push(
-    vscode.commands.registerCommand("fallow.fix", async () => {
-      // Save dirty editors first so the fix works on up-to-date content
-      await vscode.workspace.saveAll(false);
-      await runFix(context, false);
-      // Restart LSP to force fresh analysis. The fix modified files on disk
-      // bypassing VS Code's editor, so did_save never fires for those files
-      await restartClient(context, outputChannel, diagnosticFilter, onAnalysisComplete);
-      // Re-run CLI analysis for tree views
-      cliAnalysisRan = await triggerCliAnalysis({ force: true });
-    }),
+    vscode.commands.registerCommand("fallow.fix", () =>
+      applyFixes(context, async () => {
+        // Restart LSP to force fresh analysis. The fix modified files on disk
+        // bypassing VS Code's editor, so did_save never fires for those files
+        await restartClient(context, outputChannel, diagnosticFilter, onAnalysisComplete);
+        cliAnalysisRan = await triggerCliAnalysis({ force: true });
+      }),
+    ),
   );
 
   context.subscriptions.push(
```

**File**: `editors/vscode/test/commands.test.ts` (modified, +115/-0)
```diff
@@ -68,6 +68,7 @@ vi.mock("vscode", () => ({
   },
   workspace: {
     workspaceFolders: undefined,
+    saveAll: vi.fn(async () => true),
     getWorkspaceFolder: vi.fn((uri: { readonly fsPath: string }) => {
       const workspace = mockWorkspace as {
         readonly workspaceFolders:
@@ -160,6 +161,7 @@ import {
   runAnalysis,
   runAudit,
   runFix,
+  applyFixes,
   runHealthAnalysis,
   resetHealthNoWorkspaceWarning,
   healthInputKey,
@@ -1149,6 +1151,119 @@ describe("runAudit type-aware compatibility", () => {
   });
 });
 
+describe("applyFixes", () => {
+  const writeFixScript = async (dir: string, logPath: string): Promise<string> => {
+    const script = join(dir, "fallow-cli.js");
+    await writeFile(
+      script,
+      [
+        "#!/usr/bin/env node",
+        'const fs = require("node:fs");',
+        `fs.appendFileSync(${JSON.stringify(logPath)}, JSON.stringify({ args: process.argv.slice(2) }) + "\\n");`,
+        "process.stdout.write(JSON.stringify({ dry_run: false, fixes: [], total_fixed: 0 }));",
+      ].join("\n"),
+      "utf8",
+    );
+    await chmod(script, 0o755);
+    return script;
+  };
+
+  const withFixWorkspace = async (body: (logPath: string) => Promise<void>): Promise<void> => {
+    const dir = await mkdtemp(join(tmpdir(), "fallow-vscode-apply-fix-"));
+    const logPath = join(dir, "spawn.log");
+    try {
+      const script = await writeFixScript(dir, logPath);
+      mockPathBinary = script;
+      mockBinaryVersions = { [script]: "3.9.2" };
+      setWorkspaceRoot(dir);
+      await body(logPath);
+    } finally {
+      setWorkspaceRoot(null);
+      await rm(dir, { recursive: true, force: true });
+    }
+  };
+
+  const spawnCount = async (logPath: string): Promise<number> =>
+    (await readFile(logPath, "utf8").catch(() => "")).split("\n").filter(Boolean).length;
+
+  beforeEach(() => {
+    mockLspPath = "";
+    mockLocalBinary = null;
+    mockPathBinary = null;
+    mockInstalledCli = null;
+    mockDownloadedCli = null;
+    mockExtensionVersion = null;
+    mockBinaryVersions = {};
+    mockAutoDownload = false;
+    resetBinarySkewToast();
+    vi.clearAllMocks();
+  });
+
+  it("saves nothing and refreshes nothing when the user declines", async () => {
+    await withFixWorkspace(async (logPath) => {
+      vi.mocked(mockWindow.showWarningMessage).mockResolvedValueOnce("No" as never);
+      const refresh = vi.fn(async () => undefined);
+
+      await applyFixes(workspaceContext, refresh);
+
+      expect(mockWorkspace.saveAll).not.toHaveBeenCalled();
+      expect(await spawnCount(logPath)).toBe(0);
+      expect(refresh).not.toHaveBeenCalled();
+    });
+  });
+
+  it("applies no fix and refreshes nothing when a file cannot be saved", async () => {
+    await withFixWorkspace(async (logPath) => {
+      vi.mocked(mockWindow.showWarningMessage).mockResolvedValueOnce("Yes" as never);
+      vi.mocked(mockWorkspace.saveAll).mockResolvedValueOnce(false);
+      const refresh = vi.fn(async () => undefined);
+
+      await applyFixes(workspaceContext, refresh);
+
+      expect(await spawnCount(logPath)).toBe(0);
+      expect(refresh).not.toHaveBeenCalled();
+      expect(mockWindow.showWarningMessage).toHaveBeenLastCalledWith(
+        "Fallow: not all files could be saved. No fixes were applied.",
+      );
+    });
+  });
+
+  it("refreshes after a fix run that failed, since it can have changed files", async () => {
+    const dir = await mkdtemp(join(tmpdir(), "fallow-vscode-apply-fix-fail-"));
+    try {
+      const script = join(dir, "fallow-cli.js");
+      await writeFile(script, "#!/usr/bin/env node\nprocess.stdout.write('not json');\n", "utf8");
+      await chmod(script, 0o755);
+      mockPathBinary = script;
+      mockBinaryVersions = { [script]: "3.9.2" };
+      setWorkspaceRoot(dir);
+      vi.mocked(mockWindow.showWarningMessage).mockResolvedValueOnce("Yes" as never);
+      const refresh = vi.fn(async () => undefined);
+
+      await applyFixes(workspaceContext, refresh);
+
+      expect(mockWindow.showErrorMessage).toHaveBeenCalledOnce();
+      expect(refresh).toHaveBeenCalledOnce();
+    } finally {
+      setWorkspaceRoot(null);
+      await rm(dir, { recursive: true, force: true });
+    }
+  });
+
+  it("saves, applies the fix, and refreshes after the user confirms", async () => {
+    await withFixWorkspace(async (logPath) => {
+      vi.mocked(mockWindow.showWarningMessage).mockResolvedValueOnce("Yes" as never);
+      const refresh = vi.fn(async () => undefined);
+
+      await applyFixes(workspaceContext, refresh);
+
+      expect(mockWorkspace.saveAll).toHaveBeenCalledWith(false);
+      expect(await spawnCount(logPath)).toBe(1);
+      expect(refresh).toHaveBeenCalledOnce();
+    });
+  });
+});
+
 describe("runFix type-aware integration", () => {
   beforeEach(() => {
     mockLspPath = "";
```

**File**: `editors/vscode/test/download-libc.test.ts` (modified, +3/-0)
```diff
@@ -32,6 +32,9 @@ vi.mock("node:fs", () => ({
   unlinkSync: (p: string) => {
     delete mockFiles[p];
   },
+  copyFileSync: (from: string, to: string) => {
+    mockFiles[to] = mockFiles[from];
+  },
   renameSync: (from: string, to: string) => {
     mockFiles[to] = mockFiles[from];
     delete mockFiles[from];
```

**File**: `editors/vscode/test/download-release-gap.test.ts` (modified, +3/-0)
```diff
@@ -29,6 +29,9 @@ vi.mock("node:fs", () => ({
   unlinkSync: (p: string) => {
     delete mockFiles[p];
   },
+  copyFileSync: (from: string, to: string) => {
+    mockFiles[to] = mockFiles[from];
+  },
   renameSync: (from: string, to: string) => {
     mockFiles[to] = mockFiles[from];
     delete mockFiles[from];
```

**File**: `editors/vscode/test/download-upgrade.test.ts` (added, +278/-0)
```diff
@@ -0,0 +1,278 @@
+import { EventEmitter } from "node:events";
+import * as path from "node:path";
+import { beforeEach, describe, expect, it, vi } from "vitest";
+
+// A rename onto a locked path fails, as on Windows when a running process
+// holds the binary open. An upgrade that cannot replace the binary must leave
+// the installed binary and its verification data intact.
+
+let files: Record<string, string | Buffer> = {};
+let lockedPaths = new Set<string>();
+// Runs when a rename onto a locked path fails, to model a sibling window.
+let onLockedRename: () => void = () => {};
+let servedSignature = "";
+
+const errno = (code: string): NodeJS.ErrnoException =>
+  Object.assign(new Error(code), { code }) as NodeJS.ErrnoException;
+
+vi.mock("node:os", async (importOriginal) => ({
+  ...(await importOriginal<typeof import("node:os")>()),
+  platform: () => "linux",
+  arch: () => "x64",
+}));
+
+vi.mock("../src/libc.js", () => ({ hostLinuxLibc: () => "gnu" }));
+
+vi.mock("node:fs", () => ({
+  existsSync: (p: string) => p in files,
+  readFileSync: (p: string) => {
+    if (p in files) return files[p];
+    throw errno("ENOENT");
+  },
+  writeFileSync: (p: string, content: string | Buffer) => {
+    files[p] = content;
+  },
+  unlinkSync: (p: string) => {
+    if (!(p in files)) throw errno("ENOENT");
+    delete files[p];
+  },
+  copyFileSync: (from: string, to: string) => {
+    files[to] = files[from];
+  },
+  renameSync: (from: string, to: string) => {
+    if (!(from in files)) throw errno("ENOENT");
+    if (lockedPaths.has(to)) {
+      onLockedRename();
+      throw errno("EPERM");
+    }
+    files[to] = files[from];
+    delete files[from];
+  },
+  chmodSync: () => {},
+  mkdirSync: () => {},
+  openSync: () => 3,
+  writeSync: () => {},
+  closeSync: () => {},
+  statSync: () => ({ mtimeMs: Date.now() }),
+  readdirSync: () => [],
+  createWriteStream: (p: string) => {
+    const chunks: Buffer[] = [];
+    const stream = new EventEmitter() as EventEmitter & {
+      write: (chunk: Buffer) => boolean;
+      end: () => void;
+      close: (cb?: () => void) => void;
+      destroy: () => void;
+    };
+    stream.write = (chunk: Buffer) => {
+      chunks.push(chunk);
+      return true;
+    };
+    stream.end = () => {
+      files[p] = Buffer.concat(chunks);
+      queueMicrotask(() => stream.emit("finish"));
+    };
+    stream.close = (cb?: () => void) => cb?.();
+    stream.destroy = () => {};
+    return stream;
+  },
+}));
+
+// The binary bytes carry their version, so the version probe reads them.
+vi.mock("node:child_process", () => ({
+  execFile: (...args: unknown[]) => {
+    const cb = args[args.length - 1] as (
+      err: Error | null,
+      result?: { stdout: string; stderr: string },
+    ) => void;
+    const bytes = files[String(args[0])]?.toString() ?? "";
+    cb(null, { stdout: `fallow ${bytes.split("@")[1] ?? "0.0.0"}\n`, stderr: "" });
+  },
+}));
+
+// A signature is valid only for the binary whose bytes it names.
+vi.mock("node:crypto", () => ({
+  createPublicKey: () => ({ type: "mock-public-key" }),
+  createHash: () => {
+    let input = "";
+    return {
+      update(data: string | Buffer) {
+        input = data.toString();
+        return this;
+      },
+      digest: () => Buffer.from(input).toString("hex").padEnd(64, "0").slice(0, 64),
+    };
+  },
+  verify: (_algorithm: null, data: Buffer, _key: unknown, signature: Buffer) =>
+    signature.toString() === `sig:${data.toString()}`,
+}));
+
+const respond = (body: Buffer) => {
+  const response = new EventEmitter() as EventEmitter & {
+    statusCode: number;
+    headers: Record<string, string>;
+    complete: boolean;
+    resume: () => void;
+    destroy: () => void;
+    pipe: (dest: { write: (c: Buffer) => boolean; end: () => void }) => void;
+  };
+  response.statusCode = 200;
+  response.headers = {};
+  response.complete = false;
+  response.resume = () => {};
+  response.destroy = () => {};
+  response.pipe = (dest) => {
+    dest.write(body);
+    dest.end();
+  };
+  queueMicrotask(() => {
+    response.emit("data", body);
+    response.complete = true;
+    response.emit("end");
+  });
+  return response;
+};
+
+const NEW_BINARY = "fallow@2.26.0";
+const ASSET = "fallow-linux-x64-gnu";
+
+vi.mock("node:https", () => ({
+  get: (url: string, _options: unknown, cb: (response: unknown) => void) => {
+    const request = new EventEmitter() as EventEmitter & {
+      setTimeout: () => void;
+      destroy: () => void;
+    };
+    request.setTimeout = () => {};
+    request.destroy = () => {};
+    queueMicrotask(() => {
+      if (url.includes("/releases/")) {
+        const release = {
+          tag_name: "v2.26.0",
+          assets: [ASSET, `${ASSET}.sig`].map((name) => ({
+            name,
+            browser_download_url: `https://example.invalid/${name}`,
+          })),
+        };
+        cb(respond(Buffer.from(JSON.stringify(release))));
+        return;
+      }
+      cb(respo
```

---

### Incident Patch 2: `d0430d37` (2026-11-22)
**Commit Message**: fix(security): fail the new gate on an import added to a transitive leak hop (#5057)

fallow security --gate new passed when a change added a .server import,
or the import of a module that reads a secret, to an existing module that
a route or a "use client" file imports. The client-server-leak candidate
points at the client boundary, and the added import is the line of an
intermediate trace hop. The gate did not check that hop.

Each non-terminal hop of a client-server-leak trace is the import of the
next module. The gate now keeps such a candidate when the line of an
intermediate hop is on an added line. The intermediate hop of a taint
trace stays a pass-through hop. The gate has no base graph, so an edit of
an import line that already existed also keeps the candidate.

No finding_id, stable_finding_id, JSON field, SARIF field or suppression
position changes.

Closes #5024

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

**File**: `changelog.d/fix-security-gate-new-transitive-hop.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+### Fixed
+
+- **`fallow security --gate new` fails when a change adds an import that makes client code reach a server-only module or a secret reader.** Before, the gate passed when a change added a `.server` import or the import of a module that reads a secret to an existing module that a route or a `"use client"` file imports. The gate now keeps a `client-server-leak` candidate when the import line of an `intermediate` trace hop is on an added line. An edit of such an import line, for example a new imported name, also keeps the candidate. The candidate still points at the client boundary. No `finding_id`, `stable_finding_id`, JSON field, SARIF field or suppression position changes. ([#5024](https://github.com/fallow-rs/fallow/issues/5024))
```

**File**: `crates/cli/src/check/filtering.rs` (modified, +18/-2)
```diff
@@ -40,8 +40,16 @@ pub use fallow_engine::diff_scope::filter_dead_code_by_diff as filter_results_by
 ///   an untouched sink the moment any env-config file is touched). The gate
 ///   keeps a `SecretSource` hop only when a secret read of the hop
 ///   (`secret_reads`, or the hop line) is on an added line, and
-/// - the `Intermediate` / `ClientBoundary` pass-through hop lines (editing an
-///   unrelated line in a transit module is not new exposure).
+/// - the `Intermediate` / `ClientBoundary` pass-through hop lines of a taint
+///   trace (editing an unrelated line in a transit module is not new exposure).
+///
+/// A `client-server-leak` trace is different: each non-terminal hop line is the
+/// import of the next module. An added import on an `Intermediate` hop joins
+/// the client cone to the secret reader or the server-only module, so the gate
+/// keeps the candidate when that hop line is on an added line (issue #5024).
+/// The gate has no base graph, so an edit of an import line that already
+/// existed also keeps the candidate. The finding keeps its anchor on the
+/// client boundary, so its `finding_id` and suppression position stay the same.
 ///
 /// It KEEPS the sink anchor on an added line (a genuinely new sink) AND an
 /// `UntrustedSource` / `ModuleSource` / `Sink` trace hop on an added line (a
@@ -84,8 +92,16 @@ pub fn retain_gate_new(
                     .any(|read| line_in_diff(&hop.path, read.line)))
     };
 
+    let leak_edge_added = |f: &fallow_types::results::SecurityFinding| -> bool {
+        f.kind == fallow_types::results::SecurityFindingKind::ClientServerLeak
+            && f.trace.iter().any(|hop| {
+                hop.role == TraceHopRole::Intermediate && line_in_diff(&hop.path, hop.line)
+            })
+    };
+
     results.security_findings.retain(|f| {
         line_in_diff(&f.path, f.line)
+            || leak_edge_added(f)
             || f.trace
                 .iter()
                 .any(|hop| taint_hop_added(&hop.path, hop.line, hop.role) || secret_read_added(hop))
```

**File**: `crates/cli/src/check/filtering_gate_tests.rs` (modified, +155/-0)
```diff
@@ -283,3 +283,158 @@ fn gate_drops_intermediate_hop_pass_through() {
 
     assert!(results.security_findings.is_empty());
 }
+
+fn transitive_leak(category: &str, terminal: TraceHop) -> SecurityFinding {
+    SecurityFinding {
+        kind: SecurityFindingKind::ClientServerLeak,
+        category: Some(category.into()),
+        cwe: None,
+        path: PathBuf::from("/project/app/routes/home.tsx"),
+        line: 1,
+        col: 9,
+        trace: vec![
+            TraceHop::new(
+                PathBuf::from("/project/app/routes/home.tsx"),
+                1,
+                9,
+                TraceHopRole::ClientBoundary,
+            ),
+            TraceHop::new(
+                PathBuf::from("/project/app/components/banner.tsx"),
+                1,
+                9,
+                TraceHopRole::Intermediate,
+            ),
+            terminal,
+        ],
+        ..sample_security_finding()
+    }
+}
+
+fn banner_diff(hunk: &str) -> crate::report::ci::diff_filter::DiffIndex {
+    build_diff(&format!(
+        "diff --git a/app/components/banner.tsx b/app/components/banner.tsx\n\
+         --- a/app/components/banner.tsx\n\
+         +++ b/app/components/banner.tsx\n\
+         {hunk}"
+    ))
+}
+
+#[test]
+fn gate_keeps_server_only_import_added_to_transitive_module() {
+    let diff = banner_diff(
+        "@@ -0,0 +1,2 @@\n\
+         +import { getConfig } from '../utils/config.server'\n\
+         +\n",
+    );
+    let mut results = AnalysisResults::default();
+    results.security_findings.push(transitive_leak(
+        "server-only-import",
+        TraceHop::new(
+            PathBuf::from("/project/app/utils/config.server.ts"),
+            1,
+            0,
+            TraceHopRole::Sink,
+        ),
+    ));
+
+    retain_gate_new(&mut results, &diff, Path::new("/project"));
+
+    assert_eq!(results.security_findings.len(), 1);
+}
+
+#[test]
+fn gate_keeps_secret_reader_import_added_to_transitive_module() {
+    let diff = banner_diff(
+        "@@ -0,0 +1,1 @@\n\
+         +import { key } from '../utils/keys'\n",
+    );
+    let mut results = AnalysisResults::default();
+    results.security_findings.push(transitive_leak(
+        "client-server-leak",
+        TraceHop {
+            path: PathBuf::from("/project/app/utils/keys.ts"),
+            line: 1,
+            col: 0,
+            role: TraceHopRole::SecretSource,
+            secret_reads: vec![TraceSecretRead {
+                name: "process.env.API_SECRET_KEY".to_owned(),
+                line: 1,
+                col: 0,
+            }],
+        },
+    ));
+
+    retain_gate_new(&mut results, &diff, Path::new("/project"));
+
+    assert_eq!(results.security_findings.len(), 1);
+}
+
+#[test]
+fn gate_drops_transitive_leak_when_another_line_of_the_transit_module_changes() {
+    let diff = banner_diff(
+        "@@ -4,1 +4,1 @@\n\
+         +\treturn <p>Banner text</p>\n",
+    );
+    let mut results = AnalysisResults::default();
+    results.security_findings.push(transitive_leak(
+        "server-only-import",
+        TraceHop::new(
+            PathBuf::from("/project/app/utils/config.server.ts"),
+            1,
+            0,
+            TraceHopRole::Sink,
+        ),
+    ));
+
+    retain_gate_new(&mut results, &diff, Path::new("/project"));
+
+    assert!(results.security_findings.is_empty());
+}
+
+#[test]
+fn gate_keeps_transitive_leak_when_an_existing_import_line_of_the_transit_module_changes() {
+    // The gate has no base graph, so an edited import line counts as added.
+    let diff = banner_diff(
+        "@@ -1,1 +1,1 @@\n\
+         +import { getConfig, getRegion } from '../utils/config.server'\n",
+    );
+    let mut results = AnalysisResults::default();
+    results.security_findings.push(transitive_leak(
+        "server-only-import",
+        TraceHop::new(
+            PathBuf::from("/project/app/utils/config.server.ts"),
+            1,
+            0,
+            TraceHopRole::Sink,
+        ),
+    ));
+
+    retain_gate_new(&mut results, &diff, Path::new("/project"));
+
+    assert_eq!(results.security_findings.len(), 1);
+}
+
+#[test]
+fn gate_keeps_transitive_leak_whose_intermediate_hop_is_outside_root() {
+    let diff = banner_diff(
+        "@@ -4,1 +4,1 @@\n\
+         +\treturn <p>Banner text</p>\n",
+    );
+    let mut finding = transitive_leak(
+        "server-only-import",
+        TraceHop::new(
+            PathBuf::from("/project/app/utils/config.server.ts"),
+            1,
+            0,
+            TraceHopRole::Sink,
+        ),
+    );
+    finding.trace[1].path = PathBuf::from("/elsewhere/shared/banner.tsx");
+    let mut results = AnalysisResults::default();
+    results.security_findings.push(finding);
+
+    retain_gate_new(&mut results, &diff, Path::new("/project"));
+
+    assert_eq!(results.security_findings.len(), 1);
+}
```

**File**: `crates/cli/tests/integration/security_env_read_location_tests.rs` (modified, +85/-0)
```diff
@@ -256,3 +256,88 @@ fn a_destructured_secret_read_in_client_code_points_at_the_key() {
     assert_eq!(finding["line"], 2);
     assert_eq!(finding["col"], 9);
 }
+
+/// A route that imports `app/components/banner.tsx`, and a change that makes
+/// the banner import `target`. The issue #5024 reproduction.
+fn transitive_import_repo(
+    target_path: &'static str,
+    target: &'static str,
+    banner_import: &'static str,
+) -> tempfile::TempDir {
+    let mut base = react_router_base(
+        "import { Banner } from '../components/banner'\n\n\
+         export default function Home() {\n\treturn <Banner />\n}\n",
+    );
+    base.push((
+        "app/components/banner.tsx",
+        "export function Banner() {\n\treturn <p>Banner</p>\n}\n",
+    ));
+    base.push((target_path, target));
+    repo(&base, &[("app/components/banner.tsx", banner_import)])
+}
+
+#[test]
+fn gate_fails_on_a_server_only_import_added_to_a_transitive_module() {
+    let dir = transitive_import_repo(
+        "app/utils/config.server.ts",
+        "export function getConfig() {\n\treturn { region: 'nz' }\n}\n",
+        "import { getConfig } from '../utils/config.server'\n\n\
+         export function Banner() {\n\treturn <p>{getConfig().region}</p>\n}\n",
+    );
+
+    let (code, json) = gate_new(dir.path());
+    assert_eq!(code, 8, "{json:#}");
+    let finding = only_finding(&json);
+    assert_eq!(finding["category"], "server-only-import");
+    assert_eq!(finding["path"], "app/routes/home.tsx");
+    assert_eq!(finding["line"], 1);
+    let hop = &finding["trace"][1];
+    assert_eq!(hop["role"], "intermediate");
+    assert_eq!(hop["path"], "app/components/banner.tsx");
+    assert_eq!(hop["line"], 1);
+}
+
+#[test]
+fn gate_fails_on_a_secret_reader_import_added_to_a_transitive_module() {
+    let dir = transitive_import_repo(
+        "app/utils/keys.ts",
+        "export const key = process.env.API_SECRET_KEY\n",
+        "import { key } from '../utils/keys'\n\n\
+         export function Banner() {\n\treturn <p>{key}</p>\n}\n",
+    );
+
+    let (code, json) = gate_new(dir.path());
+    assert_eq!(code, 8, "{json:#}");
+    let finding = only_finding(&json);
+    assert_eq!(finding["category"], "client-server-leak");
+    assert_eq!(finding["trace"][2]["role"], "secret-source");
+}
+
+#[test]
+fn gate_passes_when_a_change_leaves_an_old_transitive_import_alone() {
+    let mut base = react_router_base(
+        "import { Banner } from '../components/banner'\n\n\
+         export default function Home() {\n\treturn <Banner />\n}\n",
+    );
+    base.push((
+        "app/utils/config.server.ts",
+        "export function getConfig() {\n\treturn { region: 'nz' }\n}\n",
+    ));
+    base.push((
+        "app/components/banner.tsx",
+        "import { getConfig } from '../utils/config.server'\n\n\
+         export function Banner() {\n\treturn <p>{getConfig().region}</p>\n}\n",
+    ));
+    let dir = repo(
+        &base,
+        &[(
+            "app/components/banner.tsx",
+            "import { getConfig } from '../utils/config.server'\n\n\
+             export function Banner() {\n\treturn <p>Region {getConfig().region}</p>\n}\n",
+        )],
+    );
+
+    let (code, json) = gate_new(dir.path());
+    assert_eq!(code, 0, "{json:#}");
+    assert_eq!(json["gate"]["new_count"], 0);
+}
```

**File**: `docs/reference/detection-internals.md` (modified, +8/-0)
```diff
@@ -513,6 +513,14 @@ error by suppressing a downstream detector.
   module, or at its first server-only import. The `secret-source` trace hop
   lists every read in `secret_reads`, and `fallow security --gate new` keeps
   the finding when one of these lines is added.
+- A non-terminal hop of a `client-server-leak` trace points at the import of
+  the next hop. `fallow security --gate new` keeps the finding when the line
+  of an `intermediate` hop is on an added line, because an added import there
+  joins the client cone to the sink. The gate has no base graph, so an edit
+  of an import line that already existed also keeps the finding. The finding
+  stays on the client boundary, so its
+  `finding_id` does not change. The `intermediate` hop of a taint trace stays
+  a pass-through hop for the gate.
 - A route module is a file that the route config names, the root route, a
   file directly in a route directory, a `route.*` file, or a deeper file
   that exports a route module export and is not in a folder with a
```

---

### Incident Patch 3: `0da01aae` (2026-11-22)
**Commit Message**: fix(sidecar): lock the model cache during setup and read wildcard exports as Node does (#5059)

* fix(sidecar): lock the model cache during setup and read wildcard exports as Node does

Two similar-code setup runs on one model cache wrote the same partial,
manifest and backup files. One run removed the partial file of the other,
and that run then failed to install its artifact. Setup now holds an
exclusive file lock on the cache folder of the model revision. The second
run waits, then finds the installed model and downloads nothing. The
operating system releases the lock when a process exits, so a crashed run
leaves no stale lock.

The type-aware sidecar reads entry points from package.json when fallow
sends none. Its wildcard pattern matched each star against one path segment
on its own. A target such as `./src/*.ts` then missed `src/nested/deep.ts`,
and `./src/*/*.ts` accepted two different values. Every star now stands for
the same value, and that value can contain a slash, as in the core rule of
`wildcard_entries.rs`. A target with its first star at the package root
keeps a capture of one segment.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* fix(sidecar): escape the w

**File**: `changelog.d/fix-sidecar-wildcard-and-cache-lock.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+### Fixed
+
+- **Two `fallow similar-code setup --local` runs on one model cache no longer break each other.** Both runs wrote the same partial, manifest and backup files, so one run removed the download of the other, and that run failed. Setup now holds a lock on the cache folder of the model revision. The second run prints that it waits, then finds the installed model and downloads nothing. On a file system without file locks, setup runs without the lock, as before.
+- **The type-aware sidecar reads wildcard package exports as Node does.** When fallow sent no entry points, the sidecar read the entry points from `package.json`. A target such as `./src/*.ts` then matched only files directly in `src`, and a target with two `*` accepted two different values. Each `*` of a target now stands for the same value, and that value can contain `/`. A build output target with a `*` in its first path segment, such as `./*.js`, still matches one path segment.
```

**File**: `tools/similar-code-sidecar/src/setup.rs` (modified, +118/-1)
```diff
@@ -1,4 +1,4 @@
-use std::fs::{self, File};
+use std::fs::{self, File, TryLockError};
 use std::io::{self, Read};
 use std::path::Path;
 use std::time::Duration;
@@ -13,6 +13,7 @@ pub trait ArtifactDownloader {
     fn open(&self, url: &str) -> Result<Box<dyn Read>, String>;
 }
 
+const INSTALL_LOCK_FILE: &str = ".install.lock";
 const DNS_TIMEOUT: Duration = Duration::from_secs(15);
 const CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
 const RESPONSE_HEADER_TIMEOUT: Duration = Duration::from_secs(30);
@@ -129,6 +130,12 @@ pub fn install_with(
 
     fs::create_dir_all(&paths.directory)
         .map_err(|error| format!("failed to create the model cache: {error}"))?;
+    let _lock = lock_install(paths)?;
+    // Check again under the lock, so a setup that waited for another one
+    // reuses its result instead of a second download.
+    if artifacts == ARTIFACTS && inspect_cache(paths).ready {
+        return Ok(SetupResult { downloaded: false });
+    }
     let mut network_used = false;
     for artifact in artifacts {
         network_used |= install_artifact(paths, *artifact, downloader)?;
@@ -139,6 +146,31 @@ pub fn install_with(
     })
 }
 
+/// Hold an exclusive lock on the revision directory for one install. The
+/// partial, manifest and backup files have fixed names, so two setups on one
+/// cache must not write them at the same time. The operating system releases
+/// the lock when the process exits, so a crashed setup leaves no stale lock.
+fn lock_install(paths: &ModelPaths) -> Result<Option<File>, String> {
+    let file = File::options()
+        .create(true)
+        .truncate(false)
+        .write(true)
+        .open(paths.directory.join(INSTALL_LOCK_FILE))
+        .map_err(|error| format!("failed to open the model cache lock: {error}"))?;
+    let locked = match file.try_lock() {
+        Ok(()) => Ok(()),
+        Err(TryLockError::WouldBlock) => {
+            eprintln!("Waiting for another model setup on this cache to finish.");
+            file.lock()
+        }
+        Err(TryLockError::Error(error)) => Err(error),
+    };
+    // A file system without file locks (for example NFS without a lock
+    // daemon) reports an error here. Setup still installs each verified
+    // artifact with a rename, so it proceeds without the lock.
+    Ok(locked.is_ok().then_some(file))
+}
+
 fn install_artifact(
     paths: &ModelPaths,
     artifact: ArtifactSpec,
@@ -206,6 +238,7 @@ mod tests {
     use std::collections::BTreeMap;
     use std::io::{Cursor, Write};
     use std::net::TcpListener;
+    use std::sync::mpsc;
     use std::thread;
 
     use sha2::{Digest, Sha256};
@@ -311,6 +344,90 @@ mod tests {
         assert!(!paths.config.with_extension("download-partial").exists());
     }
 
+    /// Yields the first byte, then waits until `resume` fires or a second
+    /// passes, so a test can start a second install while this one writes.
+    struct PausedReader {
+        bytes: Vec<u8>,
+        position: usize,
+        started: Option<mpsc::Sender<()>>,
+        resume: mpsc::Receiver<()>,
+    }
+
+    impl Read for PausedReader {
+        fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
+            if self.position == 1 {
+                if let Some(started) = self.started.take() {
+                    let _ = started.send(());
+                }
+                let _ = self.resume.recv_timeout(Duration::from_secs(1));
+            }
+            let end = if self.position == 0 {
+                1
+            } else {
+                self.bytes.len()
+            };
+            let count = (end - self.position).min(buffer.len());
+            buffer[..count].copy_from_slice(&self.bytes[self.position..self.position + count]);
+            self.position += count;
+            Ok(count)
+        }
+    }
+
+    struct PausedDownloader(std::sync::Mutex<Option<PausedReader>>);
+
+    impl ArtifactDownloader for PausedDownloader {
+        fn open(&self, _url: &str) -> Result<Box<dyn Read>, String> {
+            let reader = self
+                .0
+                .lock()
+                .expect("downloader lock")
+                .take()
+                .ok_or_else(|| "the paused artifact was opened twice".to_string())?;
+            Ok(Box::new(reader))
+        }
+    }
+
+    #[test]
+    fn concurrent_setups_on_one_cache_both_succeed() {
+        let directory = tempfile::tempdir().expect("tempdir");
+        let paths = ModelPaths::from_cache_root(directory.path());
+        let bytes = b"config-bytes".to_vec();
+        let artifacts = [spec("config.json", &bytes)];
+        let (started_tx, started_rx) = mpsc::channel();
+        let (resume_tx, resume_rx) = mpsc::channel();
+        let paused = PausedDownloader(std::sync::Mutex::new(Some(PausedReader {
+            bytes: bytes.clone(),
+            position: 0,
+            started: Some(started_tx),
+            resume: resume_rx,
+        })));
+
+        let first = thread::scope(|scope|
```

**File**: `tools/type-aware-sidecar/src/project-package.mjs` (modified, +26/-0)
```diff
@@ -35,3 +35,29 @@ export const packagePathTargets = (project, packageJson) => {
   if (typeof packageName !== "string") return [];
   return projectCompilerOptions(project).paths?.[packageName] ?? [];
 };
+
+// JavaScript output suffixes of a build, as in the core rule.
+const OUTPUT_SUFFIX = /(?:\.d\.[cm]?ts|\.[cm]?js|\.jsx)$/u;
+
+/**
+ * A regular expression for the source files of a wildcard package target.
+ * Every `*` of a Node subpath pattern stands for the same substring, and that
+ * substring can contain `/`: `./src/*.ts` matches `src/nested/deep.ts`. A
+ * build output target with a `*` in its first path segment, such as `./*.js`,
+ * keeps a capture of one path segment, so it does not make every test and
+ * config file of the package an entry.
+ */
+export const wildcardPattern = (target) => {
+  const relative = target.replace(/^\.\//u, "");
+  const sourceTarget = relative
+    .replace(/^dist\//u, "src/")
+    .replace(/(?:\.d)?\.[cm]?[jt]sx?$/u, ".ts");
+  const rootOutput = relative.split("/")[0].includes("*") && OUTPUT_SUFFIX.test(relative);
+  const capture = rootOutput ? "([^/]+)" : "(.+)";
+  const escaped = sourceTarget
+    .split("*")
+    .map((part) => part.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&"))
+    .map((part, index) => (index === 0 ? part : `${index === 1 ? capture : "(?:\\1)"}${part}`))
+    .join("");
+  return new RegExp(`^${escaped}$`, "u");
+};
```

**File**: `tools/type-aware-sidecar/src/semantic.mjs` (modified, +1/-11)
```diff
@@ -6,7 +6,7 @@ import { accessorPairExists, countsAsAccessorUse } from "./accessor-direction.mj
 import { ast, createApi as createBackendApi, heritageTypeName, sync } from "./backend.mjs";
 
 import { canonicalFileIdentity, resetFileIdentityCache } from "./file-identity.mjs";
-import { packagePathTargets, projectPackage } from "./project-package.mjs";
+import { packagePathTargets, projectPackage, wildcardPattern } from "./project-package.mjs";
 import { projectResult, projectState } from "./project-state.mjs";
 import {
   declarationName,
@@ -1197,16 +1197,6 @@ const sourceCandidatesForTarget = (root, target) => {
     .map((entry) => path.resolve(root, entry));
 };
 
-const wildcardPattern = (target) => {
-  const normalized = target.replace(/^\.\//u, "").replace(/^dist\//u, "src/");
-  const sourceTarget = normalized.replace(/(?:\.d)?\.[cm]?[jt]sx?$/u, ".ts");
-  const escaped = sourceTarget
-    .split("*")
-    .map((part) => part.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&"))
-    .join("[^/]+");
-  return new RegExp(`^${escaped}$`, "u");
-};
-
 const ancestorRoots = (root, start) => {
   const normalizedRoot = path.resolve(root);
   const roots = [];
```

**File**: `tools/type-aware-sidecar/test/sidecar.test.mjs` (modified, +89/-0)
```diff
@@ -995,6 +995,95 @@ incremented.value++;
   }
 });
 
+const discoveredEntryNames = (root, exportsField, files) => {
+  write(
+    root,
+    "tsconfig.json",
+    JSON.stringify({ compilerOptions: { strict: true }, include: ["src/**/*.ts"] }),
+  );
+  write(root, "package.json", JSON.stringify({ exports: exportsField }));
+  for (const [file, name] of Object.entries(files)) {
+    write(root, file, `export interface ${name} { value: string }\n`);
+  }
+  const request = semanticRequest(root, [
+    { id: 0, operation: "api-surface", entry_points: [], private_leak_candidates: [] },
+  ]);
+  return analyzeSemanticQueries(parseRequest(request))
+    .results[0].data.entries.map((entry) => entry.exposed.exported_name)
+    .toSorted();
+};
+
+test("package wildcard entries let one capture span directories, as Node does", () => {
+  const root = makeProject();
+  try {
+    assert.deepEqual(
+      discoveredEntryNames(
+        root,
+        { "./*": "./src/*.ts" },
+        { "src/top.ts": "Top", "src/nested/deep.ts": "Deep" },
+      ),
+      ["Deep", "Top"],
+    );
+  } finally {
+    rmSync(root, { recursive: true, force: true });
+  }
+});
+
+test("package wildcard entries accept a digit right after a repeated star", () => {
+  const root = makeProject();
+  try {
+    assert.deepEqual(
+      discoveredEntryNames(
+        root,
+        { "./*": "./src/*/*2x.ts" },
+        { "src/icon/icon2x.ts": "Icon", "src/icon/other2x.ts": "Other" },
+      ),
+      ["Icon"],
+    );
+  } finally {
+    rmSync(root, { recursive: true, force: true });
+  }
+});
+
+test("package wildcard entries keep a root output target to one segment", () => {
+  const root = makeProject();
+  try {
+    write(
+      root,
+      "tsconfig.json",
+      JSON.stringify({ compilerOptions: { strict: true }, include: ["**/*.ts"] }),
+    );
+    write(root, "package.json", JSON.stringify({ exports: { "./*": "./part-*.js" } }));
+    write(root, "part-top.ts", "export interface Top { value: string }\n");
+    write(root, "part-nested/deep.ts", "export interface Deep { value: string }\n");
+    const request = semanticRequest(root, [
+      { id: 0, operation: "api-surface", entry_points: [], private_leak_candidates: [] },
+    ]);
+    const names = analyzeSemanticQueries(parseRequest(request))
+      .results[0].data.entries.map((entry) => entry.exposed.exported_name)
+      .toSorted();
+    assert.deepEqual(names, ["Top"]);
+  } finally {
+    rmSync(root, { recursive: true, force: true });
+  }
+});
+
+test("package wildcard entries give every star of a target the same capture", () => {
+  const root = makeProject();
+  try {
+    assert.deepEqual(
+      discoveredEntryNames(
+        root,
+        { "./*": "./src/*/*.ts" },
+        { "src/alpha/alpha.ts": "Same", "src/alpha/beta.ts": "Mismatched" },
+      ),
+      ["Same"],
+    );
+  } finally {
+    rmSync(root, { recursive: true, force: true });
+  }
+});
+
 test("protocol v7 maps public API leaks and project-local public-signature coupling", () => {
   const root = makeProject();
   try {
```

#### Recent Merged Pull Requests:
- **PR #5077** (2026-11-22): fix: keep route brackets in Windows JSON paths and retry a blocked run dir move (@BartWaardenburg)
- **PR #5076** (2026-11-22): fix(extract): derive the Effect Schema members that give a schema (@BartWaardenburg)
- **PR #5074** (2026-11-22): fix(fix): keep the module load of a re-export whose names all go (@BartWaardenburg)
- **PR #5072** (2026-11-22): fix(agent): keep the root and the excluded steps in follow-up commands (@BartWaardenburg)
- **PR #5071** (2026-11-22): fix(lsp): put a file suppression below the hashbang (@BartWaardenburg)
- **PR #5070** (2026-11-22): fix(config): keep an ignoreFindings pattern that sets the mode out of the unmatched note (@BartWaardenburg)

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

## X. vscode): keep a verified binary through a failed upgrade and confirm a fix befor

**RULE**:
When implementing operations in `changelog.d/fix-vscode-upgrade-and-fix-command.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fallow-rs/fallow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f614bba7`: vscode): keep a verified binary through a failed upgrade and confirm a fix before saving. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/fix-vscode-upgrade-and-fix-command.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
### Fixed

- **A failed upgrade of the VS Code managed binary keeps the installed binary usable.** On Windows, a sibling window that runs the old `fallow-lsp` locks the file, so the new binary cannot replace it. The extension then deleted the signature and target marker of the old binary, and the next start removed that binary as untrusted. The extension now puts the old signature and target marker back.
- **A second VS Code window no longer deletes the download of the first window.** Each window removes the temp files of crashed downloads when it starts. It removed the temp files of every other process, also of a window whose download still ran, and that download then failed its signature check. The extension now removes only the temp files of a process that no longer runs.
- **`Fallow: Fix` saves and refreshes only after you confirm.** The command saved all dirty editors before it asked for confirmation, and it restarted the language server and ran a new analysis also after you answered No. The command now saves after the confirmation, applies no fix when a file cannot be saved, and refreshes only after a fix run.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f614bba7` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
