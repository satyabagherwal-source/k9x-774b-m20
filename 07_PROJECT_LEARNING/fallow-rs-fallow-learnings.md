# Forensic Learning Record (Deep Inspection): fallow-rs/fallow

> **Canonical Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:13:50.239Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 4963 stars

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

### Core Architecture Module: `action/scripts/verify-installed.mjs`
```
#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const VERIFY_CHILD_ARG = "--verify-child";
const VERIFY_TIMEOUT_MS = 60_000;
const TERMINATE_GRACE_MS = 1_000;
const HARD_EXIT_GRACE_MS = 1_000;
const TIMEOUT_EXIT_CODE = 124;
const SIGNAL_EXIT_CODES = new Map([
  ["SIGINT", 130],
  ["SIGTERM", 143],
]);

const cleanMessage = (value) => String(value).replace(/[\r\n]+/g, " ");

const runVerification = async () => {
  const require = createRequire(import.meta.url);
  const { verifyInstalled, SKIP_ENV } = require(process.env.ACTION_VERIFY_SCRIPT);
  const result = await verifyInstalled({ resolveFrom: process.env.FALLOW_VERIFY_RESOLVE_FROM });

  if (result.skipped) {
    console.log(
      `::warning::Binary verification skipped because ${SKIP_ENV} is set. Only use this when deliberately replacing the published binary.`,
    );
    return 0;
  }
  if (!result.ok) {
    const where = result.binary ? ` ${result.binary}` : "";
    console.error(
      `::error::fallow binary verification failed${where} (${result.code}): ${cleanMessage(result.message)}`,
    );
    return 1;
  }

  console.log(
    `Verified Ed25519 signatures and SHA-256 digests on fallow binaries (package ${result.package}@${result.version})`,
  );
  return 0;
};

const configuredTimeoutMs = () => {
  if (process.env.NODE_ENV !== "test") return VERIFY_TIMEOUT_MS;

  const override = Number(process.env.FALLOW_ACTION_VERIFY_TIMEOUT_MS);
  if (Number.isSafeInteger(override) && override > 0) return Math.min(override, VERIFY_TIMEOUT_MS);
  return VERIFY_TIMEOUT_MS;
};

const superviseVerification = async () => {
  const entryPath = fileURLToPath(import.meta.url);
  const timeoutMs = configuredTimeoutMs();
  const child = spawn(process.execPath, [entryPath, VERIFY_CHILD_ARG], {
    env: process.env,
    stdio: ["ignore", "inherit", "inherit"],
  });
  let forceTimer;
  let hardExitTimer;
  let forwardedSignal;
  let timedOut = false;
  let resolveHardExit;
  const hardExit = new Promise((resolve) => {
    resolveHardExit = resolve;
  });

  const terminate = (signal, exitCode) => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill(signal);
    if (forceTimer) return;
    forceTimer = setTimeout(() => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGKILL");
      hardExitTimer = setTimeout(() => {
        child.unref();
        resolveHardExit([exitCode, null]);
      }, HARD_EXIT_GRACE_MS);
    }, TERMINATE_GRACE_MS);
  };

  const signalHandlers = new Map();
  for (const signal of SIGNAL_EXIT_CODES.keys()) {
    const handler = () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      forwardedSignal ??= signal;
      terminate(signal, SIGNAL_EXIT_CODES.get(forwardedSignal) ?? 1);
    };
    signalHandlers.set(signal, handler);
    process.on(signal, handler);
  }

  const timeout = setTimeout(() => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    timedOut = true;
    console.error(
      `::error::fallow binary verification timed out after ${timeoutMs}ms; the verifier process was terminated`,
    );
    terminate("SIGTERM", TIMEOUT_EXIT_CODE);
  }, timeoutMs);

  try {
    const [code, signal] = await Promise.race([once(child, "exit"), hardExit]);
    if (timedOut) return TIMEOUT_EXIT_CODE;
    if (forwardedSignal) return SIGNAL_EXIT_CODES.get(forwardedSignal) ?? 1;
    if (signal) {
      console.error(
        `::error::fallow binary verification stopped unexpectedly (${cleanMessage(signal)})`,
      );
      return 1;
    }
    return code ?? 1;
  } catch (error) {
    console.error(
      `::error::fallow binary verification failed to start (internal-error): ${cleanMessage(error.message)}`,
    );
    return 1;
  } finally {
    clearTimeout(timeout);
    if (forceTimer) clearTimeout(forceTimer);
    if (hardExitTimer) clearTimeout(hardExitTimer);
    for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
  }
};

const main = async () => {
  if (process.argv[2] === VERIFY_CHILD_ARG) return runVerification();
  return superviseVerification();
};

try {
  process.exitCode = await main();
} catch (error) {
  console.error(
    `::error::fallow binary verification failed (internal-error): ${cleanMessage(error.message)}`,
  );
  process.exitCode = 1;
}

```

### Core Architecture Module: `apps/review-electron/e2e/app.e2e.ts`
```
import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { ensureReviewStarted } from "./review";

const appDir = resolve(__dirname, "..");
const worktreeRoot = resolve(appDir, "..", "..");

let app: ElectronApplication | undefined;
let temporaryReviewRoot: string | undefined;

test.afterEach(async () => {
  try {
    await app?.close();
    app = undefined;
  } finally {
    if (temporaryReviewRoot !== undefined) {
      rmSync(temporaryReviewRoot, { recursive: true, force: true });
      temporaryReviewRoot = undefined;
    }
  }
});

const resolveFallowBin = (): string => {
  const explicit = process.env["FALLOW_BIN"]?.trim();
  if (explicit) {
    return explicit;
  }

  for (const profile of ["release", "debug"] as const) {
    const candidate = resolve(worktreeRoot, "target", profile, "fallow");
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return "fallow";
};

const createReviewRoot = (dirty = false): string => {
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), "fallow-review-e2e-"));
  temporaryReviewRoot = temporaryRoot;
  const reviewRoot = resolve(temporaryRoot, "project");
  cpSync(resolve(appDir, "fixtures", "sample-app"), reviewRoot, { recursive: true });

  const git = (args: string[]): void => {
    execFileSync("git", args, { cwd: reviewRoot, stdio: "ignore" });
  };
  git(["init", "-b", "main"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Fallow E2E"]);
  git(["add", "."]);
  git(["commit", "-m", "baseline"]);

  if (dirty) {
    appendFileSync(resolve(reviewRoot, "src", "App.tsx"), "\nexport const e2eDiffMarker = true;\n");
  }
  return reviewRoot;
};

const launch = async (reviewRoot?: string): Promise<ElectronApplication> =>
  electron.launch({
    args: [resolve(appDir, "out", "main", "index.js")],
    cwd: worktreeRoot,
    env: {
      ...process.env,
      FALLOW_BIN: resolveFallowBin(),
      ...(reviewRoot === undefined ? {} : { FALLOW_REVIEW_ROOT: reviewRoot }),
    } as Record<string, string>,
  });

const launchLoadedReview = async (reviewRoot = createReviewRoot()): Promise<Page> => {
  app = await launch(reviewRoot);
  const win = await app.firstWindow();
  await ensureReviewStarted(win);
  await expect(win.getByTestId("review-loaded")).toBeVisible({ timeout: 150_000 });
  return win;
};

test("boots and renders the review shell", async () => {
  app = await launch(createReviewRoot());
  const win = await app.firstWindow();
  await expect(win.getByRole("heading", { name: "Fallow Review" })).toBeVisible();
  await ensureReviewStarted(win);
  await expect(win.getByTestId("mode-live")).toBeVisible();
});

test("loads a grounded walkthrough from the real engine", async () => {
  // `fallow review` runs on a real fixture project; wait for the focus headline to render.
  await launchLoadedReview();
});

test("opens a file diff from the walkthrough", async () => {
  const reviewRoot = createReviewRoot(true);
  const win = await launchLoadedReview(reviewRoot);
  await win.getByRole("button", { name: "open App.tsx" }).click();
  await expect(win.getByText(/@@/).first()).toBeVisible({ timeout: 20_000 });
});

test("shows a diff failure when the checkout disappears after review loading", async () => {
  const reviewRoot = createReviewRoot(true);
  const win = await launchLoadedReview(reviewRoot);
  await expect(win.getByTestId("diff-scroll")).toBeVisible();
  rmSync(resolve(reviewRoot, ".git"), { recursive: true, force: true });
  await win.getByRole("button", { name: "open App.tsx" }).click();
  await expect(win.getByText("couldn't load the diff")).toBeVisible();
  await expect(win.getByText("no changes to review", { exact: true })).toBeHidden();
});

test("inspector bridge pushes a grounded card to the UI", async () => {
  const win = await launchLoadedReview();

  // Simulate the in-page picker posting a selection to the localhost bridge.
  const res = await fetch("http://127.0.0.1:7787/fallow-select", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      file: "src/App.tsx",
      line: 1,
      component: "App",
    }),
  });
  expect(res.ok).toBe(true);

  const inspector = win.getByTestId("inspector-card");
  await expect(inspector).toBeVisible({ timeout: 30_000 });
  await expect(inspector).toContainText("src/App.tsx:1");
});

```

### Core Architecture Module: `apps/review-electron/e2e/review.ts`
```
import type { Locator, Page } from "@playwright/test";

const REVIEW_START_TIMEOUT = 30_000;
const REVIEW_TRANSITION_TIMEOUT = 5_000;

type ReviewStartupState = "idle" | "running" | "loaded" | "error";

interface ReviewStartupOptions {
  allowError?: boolean;
}

const waitForVisible = async (
  locator: Locator,
  state: ReviewStartupState,
  timeout: number,
): Promise<ReviewStartupState> => {
  await locator.waitFor({ state: "visible", timeout });
  return state;
};

const waitForReviewState = async (
  page: Page,
  includeIdle: boolean,
  timeout: number,
): Promise<ReviewStartupState> => {
  const states: Array<Promise<ReviewStartupState>> = [
    waitForVisible(page.getByText(/running fallow review/), "running", timeout),
    waitForVisible(page.getByTestId("review-loaded"), "loaded", timeout),
    waitForVisible(page.getByTestId("review-error"), "error", timeout),
  ];

  if (includeIdle) {
    states.push(waitForVisible(page.getByRole("button", { name: "Load review" }), "idle", timeout));
  }

  return Promise.race(states);
};

const assertAcceptedState = (state: ReviewStartupState, allowError: boolean): void => {
  if (state === "error" && !allowError) {
    throw new Error("Review failed during startup");
  }
};

/** Starts a review only when startup has not already begun. */
export const ensureReviewStarted = async (
  page: Page,
  options: ReviewStartupOptions = {},
): Promise<void> => {
  const allowError = options.allowError ?? false;
  const state = await waitForReviewState(page, true, REVIEW_START_TIMEOUT);
  if (state !== "idle") {
    assertAcceptedState(state, allowError);
    return;
  }

  const loadReview = page.getByRole("button", { name: "Load review" });
  try {
    await loadReview.click({ timeout: REVIEW_TRANSITION_TIMEOUT });
  } catch (error: unknown) {
    let transitionedState: ReviewStartupState;
    try {
      transitionedState = await waitForReviewState(page, false, REVIEW_TRANSITION_TIMEOUT);
    } catch {
      throw error;
    }
    assertAcceptedState(transitionedState, allowError);
  }
};

```

### Core Architecture Module: `apps/review-electron/e2e/shots.e2e.ts`
```
import { test, _electron as electron, type ElectronApplication } from "@playwright/test";
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensureReviewStarted } from "./review";

const appDir = resolve(__dirname, "..");
const worktreeRoot = resolve(appDir, "..", "..");
const shots = process.env["FALLOW_REVIEW_SHOTS_DIR"] ?? "/tmp/fallow-review-qa";

const resolveFallowBin = (): string => {
  const explicit = process.env["FALLOW_BIN"]?.trim();
  if (explicit) {
    return explicit;
  }

  for (const profile of ["release", "debug"] as const) {
    const candidate = resolve(worktreeRoot, "target", profile, "fallow");
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return "fallow";
};

const safe = async (fn: () => Promise<void>): Promise<void> => {
  try {
    await fn();
  } catch {
    /* capture-only: skip a screen if it isn't reachable in this run */
  }
};

// Capture-only (no assertions): walks each screen, writes PNGs for design QA.
// Run with: npx playwright test shots.e2e.ts
test("capture screens for design QA", async () => {
  const app: ElectronApplication = await electron.launch({
    args: [resolve(appDir, "out", "main", "index.js")],
    cwd: worktreeRoot,
    env: {
      ...process.env,
      FALLOW_BIN: resolveFallowBin(),
    } as Record<string, string>,
  });
  const win = await app.firstWindow();

  await ensureReviewStarted(win);
  await safe(async () => {
    // The real review takes a beat; capture the loading state before it resolves.
    await win.getByText(/running fallow review/).waitFor({ timeout: 3000 });
    await win.screenshot({ path: `${shots}/11-loading.png` });
  });
  await win.getByTestId("review-loaded").waitFor({ timeout: 150_000 });
  await win.screenshot({ path: `${shots}/01-walkthrough.png` });

  await safe(async () => {
    // The default diff shows all files; scroll to expose a file-to-file boundary.
    await win.getByTestId("diff-scroll").evaluate((el) => {
      el.scrollTop = 2300;
    });
    await win.waitForTimeout(150);
    await win.screenshot({ path: `${shots}/16-diff-all.png` });
  });

  await safe(async () => {
    // Keyboard-focus a file row to QA the focus-visible ring. Press Tab first so
    // the browser is in keyboard modality (otherwise :focus-visible won't match).
    await win.keyboard.press("Tab");
    await win.getByTestId("file-open").first().focus();
    await win.waitForTimeout(150);
    await win.screenshot({ path: `${shots}/10-focus.png` });
  });

  await safe(async () => {
    // Expand the cleared panel to QA the aligned count list.
    await win.getByTestId("cleared-toggle").click({ timeout: 10_000 });
    await win.waitForTimeout(150);
    await win.screenshot({ path: `${shots}/12-cleared.png` });
    await win.getByTestId("cleared-toggle").click({ timeout: 10_000 });
  });

  await safe(async () => {
    // Collapse the second stage group to QA the collapsed state.
    await win.getByTestId("stage-toggle").nth(1).click({ timeout: 10_000 });
    await win.waitForTimeout(150);
    await win.screenshot({ path: `${shots}/15-collapsed.png` });
    await win.getByTestId("stage-toggle").nth(1).click({ timeout: 10_000 });
  });

  await safe(async () => {
    // Simulate the in-page picker posting a selection to the localhost bridge.
    await fetch("http://127.0.0.1:7787/fallow-select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file: "apps/review-electron/src/main/index.ts",
        line: 1,
        component: "main",
      }),
    });
    await win.getByTestId("inspector-card").waitFor({ timeout: 30_000 });
    await win.screenshot({ path: `${shots}/07-inspector.png` });
  });

  await safe(async () => {
    // Capture the screenshot + annotate surface (drawing toolbar over a capture).
    await win.getByTestId("mode-shot").click({ timeout: 10_000 });
    await win.getByTestId("shot-capture").click({ timeout: 10_000 });
    await win.getByRole("button", { name: "send to agent" }).waitFor({ timeout: 20_000 });
    await win.screenshot({ path: `${shots}/08-annotate.png` });
  });

  await safe(async () => {
    // Scroll a high fan-in hub (accented metric) into view to QA the grading.
    await win
      .getByTestId("file-open")
      .filter({ hasText: "walkthrough.ts" })
      .first()
      .scrollIntoViewIfNeeded();
    await win.waitForTimeout(200);
    await win.screenshot({ path: `${shots}/06-files-scrolled.png` });
  });

  await safe(async () => {
    await win.getByTestId("file-open").first().click();
    await win.getByText(/@@|no textual diff/).waitFor({ timeout: 20_000 });
    await win.screenshot({ path: `${shots}/02-diff.png` });
  });
  await safe(async () => {
    // A heavily-rewritten file gives a mixed diff (deletions + context + adds).
    await win.getByTestId("file-open").filter({ hasText: "DiffView.tsx" }).first().click();
    await win.getByText(/@@/).first().waitFor({ timeout: 20_000 });
    await win.screenshot({ path: `${shots}/09-diff-mixed.png` });
  });
  await safe(async () => {
    await win.getByTestId("mode-shot").click({ timeout: 10_000 });
    await win.screenshot({ path: `${shots}/03-screenshot-mode.png` });
  });
  await safe(async () => {
    // Drive a capture against an unreachable URL to QA the cleaned error message.
    await win.getByTestId("shot-url").fill("http://localhost:1");
    await win.getByTestId("shot-capture").click({ timeout: 10_000 });
    await win
      .locator('[data-testid="shot-overlay"][data-phase="error"]')
      .waitFor({ timeout: 20_000 });
    await win.screenshot({ path: `${shots}/14-shot-error.png` });
  });
  await safe(async () => {
    await win.getByTestId("mode-live").click({ timeout: 10_000 });
    // Let the live webview settle into its loaded (or overlay) state.
    await win.waitForTimeout(1500);
    await win.screenshot({ path: `${shots}/04-live.png` });
  });
  await safe(async () => {
    // Drive the live surface to its unreachable-server error state.
    await win.getByTestId("live-url").fill("http://localhost:1");
    await win.getByTestId("live-go").click({ timeout: 10_000 });
    await win
      .locator('[data-testid="live-overlay"][data-conn="failed"]')
      .waitFor({ timeout: 15_000 });
    await win.screenshot({ path: `${shots}/05-live-error.png` });
  });

  await app.close();
});

// Separate launch with a bad engine path so `fallow review` fails: QA the error.
test("capture the review error state", async () => {
  const app: ElectronApplication = await electron.launch({
    args: [resolve(appDir, "out", "main", "index.js")],
    cwd: worktreeRoot,
    env: { ...process.env, FALLOW_BIN: "/nonexistent/fallow-bin" } as Record<string, string>,
  });
  const win = await app.firstWindow();
  await safe(async () => {
    await ensureReviewStarted(win, { allowError: true });
    await win.getByTestId("review-error").waitFor({ timeout: 30_000 });
    await win.screenshot({ path: `${shots}/13-review-error.png` });
  });
  await app.close();
});

// Fixture-backed: point FALLOW_BIN at a stub that emits the with-decisions
// brief, so the (otherwise all-additions) review renders the decision surface.
test("capture the decision surface", async () => {
  const fixture = resolve(appDir, "fixtures", "sample-review-with-decisions.json");
  const stub = "/tmp/fallow-review-stub.sh";
  writeFileSync(stub, `#!/bin/sh\ncat ${JSON.stringify(fixture)}\n`);
  chmodSync(stub, 0o755);
  const app: ElectronApplication = await electron.launch({
    args: [resolve(appDir, "out", "main", "index.js")],
    cwd: worktreeRoot,
    env: { ...process.env, FALLOW_BIN: stub } as Record<string, string>,
  });
  const win = await app.firstWindow();
  await safe(async () => {
    await ensureReviewStarted(win);
    await win.getByTestId("review-loaded").waitFor({ timeout: 60_000 });
    await win.screenshot({ path: `${shots}/17-decisions.png` });
  });
  await app.cl
```

### Core Architecture Module: `apps/review-electron/electron.vite.config.ts`
```
import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  // React Compiler (auto-memoization, as codiff does) + Tailwind v4 + `@` alias.
  renderer: {
    resolve: { alias: { "@": resolve(__dirname, "src/renderer/src") } },
    plugins: [react({ babel: { plugins: ["babel-plugin-react-compiler"] } }), tailwindcss()],
  },
});

```

### Core Architecture Module: `apps/review-electron/fixtures/sample-app/src/App.tsx`
```
import { useState } from "react";
import { Header } from "./components/Header";
import { Card } from "./components/Card";
import { Button } from "./components/Button";

export const App = () => {
  const [count, setCount] = useState(0);
  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <Header title="Sample app under review" />
      <Card title="Counter">
        <p>Count: {count}</p>
        <Button label="Increment" onClick={() => setCount((c) => c + 1)} />
        <Button label="Reset" variant="secondary" onClick={() => setCount(0)} />
      </Card>
    </main>
  );
};

```

### Core Architecture Module: `apps/review-electron/fixtures/sample-app/src/components/Button.tsx`
```
type ButtonProps = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
};

export const Button = ({ label, onClick, variant = "primary" }: ButtonProps) => {
  const bg = variant === "primary" ? "#3b5bdb" : "#868e96";
  return (
    <button
      onClick={onClick}
      style={{
        background: bg,
        color: "white",
        border: "none",
        borderRadius: 6,
        padding: "8px 14px",
        marginRight: 8,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2954** (2026-09-29): **Formatter and linter targets are treated as entry points, hiding unused files**
  *Symptoms*: ### What happened?  Fallow treats formatting and linting targets as entry points in both `package.json` scripts and GitHub Actions `run` steps. Using `oxfmt` means the tool is used, but does not mean the files it formats are used by the application.  This also reproduces with oxlint 1.69.0 and ESLint 9.39.1; oxfmt is used below as the minimal example.  ### Reproduction  [Reproduction repository](https://github.com/azu/fallow-issues/blob/main/repros/script-file-entries/README.md): run `pnpm install --frozen-lockfile` and `pnpm repro:script-file-entries` from the repository root.  Tested with Fallow 3.30.0 and oxfmt 0.51.0.  ```jsonc // package.json {   "name": "repro",   "private": true,   "type": "module",   "main": "src/index.ts",   "scripts": { "fmt": "oxfmt --check \"**/*.ts\"" },   "devDependencies": { "oxfmt": "0.51.0" } } ```  ```ts // src/index.ts export {}; ```  ```ts // src/dead.ts export const dead = 1; ```  Install dependencies, then run `fallow dead-code --no-cache`:  - With the `fmt` script: `No issues found` (exit 0). - Without the `fmt` script: `src/dead.ts` is unused (exit 1).  The formatter never needs to run. An explicit path (`oxfmt --check src/dead.ts`) also reproduces the problem.  GitHub Actions also reproduces this independently: remove the `fmt` script and add a workflow step with `run: npx oxfmt --check "**/*.ts"`. Fallow still stops reporting `src/dead.ts` as unused.  ### Expected behavior  Keep recognizing `oxfmt` as a used dependency and tracking i

- **Issue #2952** (2026-09-28): **Workspace dependency used only through a package.json imports alias is reported as unused**
  *Symptoms*: ### What happened?  When a package imports a workspace package only through a package.json `imports` (`#...`) alias, the import resolves correctly and the imported export is treated as used, but the workspace package itself is reported as an unused dependency.  ### Possible cause  In [`try_package_imports_fallback` in v3.30.0](https://github.com/fallow-rs/fallow/blob/v3.30.0/crates/graph/src/resolve/fallbacks.rs#L475-L504), external targets become `NpmPackage`, while internal targets become `InternalPackageModule` using the importing manifest's name. This appears to lose the target workspace package identity needed to credit the dependency.  ### Additional context  We import every workspace package through an `imports` alias (`"#acme/log/*": "@acme/lib-log/*"`) so that application code does not depend on package names. In our monorepo this reports 99 workspace dependencies as unused. The workaround is to list each package in `ignoreDependencies`, which only accepts exact names.  We are also requesting glob support in `ignoreDependencies` in #2953 to reduce the maintenance cost of this workaround. That is a separate configuration enhancement; this issue asks for the used workspace dependency to be recognized without an ignore.  Related: #56 (support for package.json `imports` aliases; resolution itself works in this reproduction).  ### Reproduction  Create the following files in a new directory:  ```text package.json   { "name": "root", "private": true }  pnpm-workspace.yaml  

- **Issue #2942** (2026-09-29): **Overzealous duplicate code detection**
  *Symptoms*: ### What happened?  React component with multiple sub components that have the same event handlers are incorrectly detected as duplicate code.  ### Reproduction  A React component with the following code:  ``` typescript export default function HexOffsetView({   offset,   datasource,   mouseCallback, }: HexOffsetViewProps): JSX.Element {   return (     <div className="he-column-sticky" data-testid="hex-offset-view">       <table className="he-table he-table-sticky" data-testid="hex-offset-table">         <thead           className="he-table-header"           onMouseOver={(e: MouseEvent) => mouseCallback("Over", (e.target as Element).id)}           onMouseLeave={(e: MouseEvent) => mouseCallback("Leave", (e.target as Element).id)}         >           <OffsetHeader />         </thead>         <tbody           data-testid="hex-offset-body"           onMouseOver={(e: MouseEvent) => mouseCallback("Over", (e.target as Element).id)}           onMouseLeave={(e: MouseEvent) => mouseCallback("Leave", (e.target as Element).id)}         >           <OffsetValues offset={offset} datasource={datasource} />         </tbody>       </table>     </div>   ); } ```  The onMouseOver/onMouseLeave blocks are detected as duplicate code, when they are not.  ### Expected behavior  These lines of code should not be detected as duplicate.  ### Fallow version   3.29.0  ### Operating system  Windows  ### Configuration  ```toml  ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report!  The two `onMouseOver`/`onMouseLeave` pairs are identical token for token, so a token-based clone detector reports them when the thresholds allow it. With the default settings (`minTokens` 50, `minLines` 5) this snippet gives no finding: each pair is 48 tokens.  Do you use lower thresholds or `--mode semantic`? Can you share your config?  To keep these lines as they are, add `// fallow-ignore-next-line code-duplication` above the element, or raise `duplicates.minTokens`. 
  > I should have added that I'm using fallow from VSCode.  However, now that I've taken a better look at what Fallow is detecting (there are actually three instances of duplication) and it's making sense to me now.  fallow is correct and the settings work as I would expect.  I initially thought there was no way to de-dup the code, but there is and all is good now.  You can close this and attribute to user error.
  > Ah thanks for checking @BarryNolte 👍 

- **Issue #2896** (2026-09-25): **fallow crashes (SIGABRT) parsing a Dockerfile line with an escaped quote immediately followed by non-ASCII text**
  *Symptoms*: ### What happened?  `fallow` panics and exits with `SIGABRT` when a `Dockerfile` (any `Dockerfile*`-named file it recognizes) contains a line where a `\'` (backslash + single quote, 2 bytes) is immediately followed by a multi-byte UTF-8 character. This is a common shape for shell-heredoc SQL seed scripts embedded in a Dockerfile, e.g. `INSERT INTO ... VALUES (\'非ASCII文字列\', ...)`.  ### Reproduction  When the following is executed,  ```bash mkdir /tmp/fallow-bug && cd /tmp/fallow-bug printf "      \\'あいうえお\\',\n" > Dockerfile npx fallow@3.28.0 dead-code ```  I got this:  ```bash thread 'main' (1966796) panicked at crates/core/src/discover/infrastructure.rs:181:47: end byte index 4 is not a char boundary; it is inside 'あ' (bytes 2..5 of string) note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace fallow binary terminated by signal SIGABRT ```  ### Expected behavior  _No response_  ### Fallow version  3.28.0  ### Operating system  macOS  ### Configuration  ```toml  ```
  **Post-Mortem & Fix Analysis**:
  > Fixed in v3.29.0: `npm install fallow@3.29.0` or `cargo install fallow-cli@3.29.0`.  Fallow no longer panics on your reproduction (`\'あいうえお\'` in a `Dockerfile`). It cut a short line at the length of the `RUN`, `CMD` or `ENTRYPOINT` keyword, and that cut fell inside a multi-byte character. Such a line now counts as an ordinary line, so `fallow dead-code` completes.  Thanks for the exact reproduction and the stack trace. 

- **Issue #2847** (2026-09-24): **Nuxt: @nuxt/content components report as unused files with autoImports on**
  *Symptoms*: ## Problem  With `autoImports` on, `fallow dead-code` reports the global components of `@nuxt/content` as unused files.  `@nuxt/content` registers each `components/content/` directory as a directory of global components. Markdown content renders these components, for example `::alert` renders `components/content/Alert.vue`. No template tag or import in a script names them. Fallow does not read Markdown, so it cannot see this usage.  On `nuxt/ui` (commit `032a152`), with `autoImports` on:  - `fallow@3.28.0` reports no file under `docs/app/components/content/`. - The current `main` reports 388 files under `docs/app/components/content/` as unused.  With `autoImports` off, both versions give the same result.  ## Cause  Before the change that reads the surface keys from the config object, a `routeRules` key such as `'/pro/components'` in `docs/nuxt.config.ts` matched the `components` key pattern. That match kept the component entry patterns of the `docs` workspace. Now fallow reads only the top-level keys, so the patterns go away with `autoImports` on. The `components/content/` files had no other credit.  ## Expected  When `@nuxt/content` is registered, the `components/content/` files of the project and of each local layer are entry points, with `autoImports` on and off.  Nuxt also registers `components/global/` and `*.global.vue` files as global components. A string reference, such as `resolveComponent('Name')` or `<component is="Name">`, can render them. Fallow does not resolve 
  **Post-Mortem & Fix Analysis**:
  > Released in v3.29.0.

- **Issue #2782** (2026-09-23): **GitHub annotations show unused exports as warnings despite error configuration**
  *Symptoms*: ### What happened?  I configured unused exports as errors:  ```json {   "rules": {     "unused-exports": "error"   } } ```  Fallow correctly fails the audit, but the GitHub annotation labels the unused export as a warning. The summary reports an error, while the finding appears as a warning.  I encountered this with Fallow 3.16.0 in GitHub Actions.  I can put together a PR for this if you're interested in fixing it, but wanted to start with this issue.  ### Reproduction  Create these files:  ```ts // index.ts import { used } from "./helpers"; console.log(used); ```  ```ts // helpers.ts export const used = 1; export const unused = 2; ```  Use this `.fallowrc.json`:  ```json {   "entry": ["index.ts"],   "rules": {     "unused-exports": "error"   } } ```  Run:  ```sh fallow dead-code --format github-annotations ```  The unused export produces a `::warning` annotation even though the command fails.  ### Expected behavior  GitHub annotations should respect the configured severity, including per-file overrides. An unused export configured as an error should produce an `::error` annotation.  The renderer's [`push_each` helper](https://github.com/fallow-rs/fallow/blob/v3.16.0/crates/cli/src/report/github_annotations.rs#L184) appears to hardcode the warning level.  ### Fallow version  3.16.0  ### Operating system  macOS  ### Configuration  ```toml {   "entry": ["index.ts"],   "rules": {     "unused-exports": "error"   } } ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. Fixed in #2814: each dead-code finding now carries its rule severity, so GitHub annotations, SARIF and CodeClimate follow `error` and `warn`, including `overrides[].rules`. It ships in the next release. The CRAP and complexity side from #2783 follows in a separate change.
  > Released in v3.29.0 (`npm install fallow@3.29.0`). Error annotations now also come before warnings, so the `max-annotations` cap keeps them on a large run. Thanks for the report and the offer of a PR. 

- **Issue #2757** (2026-09-24): **The Module Federation reader misses common option shapes and stays silent**
  *Symptoms*: I checked every reference below against main at `c3197ecf8cd63e1a3ea094d88f36d5c0ca9b88ba` on 2026-09-22. Re-check before you start.  Found while landing #2750. Each item below reproduces in a webpack project that declares `@module-federation/enhanced` and exposes `./src/Button.tsx`. The inline object literal is the control, and it credits the exposed file.  ### 1. Options that an import holds stay unread and record nothing  `read_plugin_call` resolves the first argument through `resolve_object_expression` (`crates/core/src/plugins/module_federation.rs:359`). That resolver reads an object literal or a top-level binding of the same file (`crates/core/src/plugins/config_parser.rs:1366`). Options from another file resolve to nothing, and the reader returns without a diagnostic.  Minimal input:  ```js // webpack.config.js const { ModuleFederationPlugin } = require('@module-federation/enhanced'); const mfConfig = require('./mf.config'); module.exports = { plugins: [new ModuleFederationPlugin(mfConfig)] }; ```  The run reports `src/Button.tsx` as `unused-file`, and no plugin diagnostic names the config. The tracked fixtures and the `cra/*` and `unit-test/*` examples of the upstream project use this shape.  Wanted: follow a relative import or require of a config file in the same project. Record `plugin-config-unreadable` when the target cannot be read.  ### 2. A spread options object stays unread and records nothing  The resolver returns the object literal, and `declares_federation_
  **Post-Mortem & Fix Analysis**:
  > Released in v3.29.0.

- **Issue #2753** (2026-09-24): **Bundler config readers miss entries and report a used package as unused**
  *Symptoms*: I checked every reference below against main at `c3197ecf8cd63e1a3ea094d88f36d5c0ca9b88ba` on 2026-09-22. Re-check before you start.  Found while landing #2745. Every item below reproduces in a small project that declares the bundler as a dependency.  ### 1. An `entry` that names a directory or an absolute path matches no file  `module_request` treats a value without `./` and without a source extension as a package request (`crates/core/src/plugins/mod.rs:343`). `normalize_entry_pattern` then strips only a leading `./` (`crates/core/src/plugins/mod.rs:326`). A directory name becomes a dependency reference, and a project-absolute path becomes a pattern that matches nothing.  Minimal input, with `lib/index.ts` and `src/absolute.ts` present:  ```js module.exports = { entry: 'lib' };            // lib/index.ts is reported unused module.exports = { entry: '/src/absolute.ts' }; // src/absolute.ts is reported unused ```  `entry: './lib/index.ts'` credits the file.  Wanted: resolve a directory value through its index file. Read a leading `/` as project-root-relative, as the other config path readers do.  ### 2. Nothing reads a webpack config in a subdirectory  The webpack config patterns are `webpack.config.{ts,js,mjs,cjs}` and `webpack.*.config.{ts,js,mjs,cjs}` (`crates/core/src/plugins/webpack.rs:16`). A common name such as `config/webpack.client.js` matches neither pattern, which leaves its entries, loaders and aliases unread.  Minimal input: move a webpack config to `config/webpa
  **Post-Mortem & Fix Analysis**:
  > Released in v3.29.0.

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

### Incident Patch 1: `056cb57c` (2026-09-30)
**Commit Message**: fix(security): apply overrides rules to security candidates (#3058)

Closes #2985. Per-path `overrides[].rules` entries for `security-sink` and `security-client-server-leak` now apply to security candidates. An `off` override drops the candidate for that path, and an `error` override makes the run fail. `configured_severities` and `effective_severities` in the security output stay top-level values.

**File**: `CHANGELOG.md` (modified, +19/-0)
```diff
@@ -23,6 +23,25 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   The GitHub Action and the GitLab template already failed such a job, so
   their result does not change. Thanks @TiagoGranelli for the report (#2984).
 
+- **`overrides[].rules` apply to security candidates.** A per-path
+  `security-sink` or `security-client-server-leak` entry had no effect on
+  `fallow security`. Now each candidate takes the severity of its rule for its
+  own path, with the same `overrides` matching as dead-code findings. An
+  override matches the file that the candidate is anchored on: the sink site,
+  or the `"use client"` file for a client-server leak (#2985).
+  - `off` removes the candidates in matching files. This also applies when
+    `fallow security` raises the top-level `off` to `warn`.
+  - `error` makes `fallow security` exit 1 when a candidate in a matching
+    file stays.
+  - The advisory gate now fails on a candidate only when the rule of that
+    candidate is `error`. Before, an `error` on one security rule failed the
+    run also for candidates of the other rule.
+  - The editor diagnostics and the Security lens of `fallow viz` use the
+    same result.
+  - The JSON `config.rules` block of `fallow security` still reports the
+    top-level `configured` and `effective` severities. An override can drop
+    candidates or fail the run also when `effective` is `warn`.
+
 ## [3.31.0] - 2026-09-30
 
 ### Added
```

**File**: `crates/cli/src/security.rs` (modified, +48/-26)
```diff
@@ -20,8 +20,8 @@ use std::time::Instant;
 
 use fallow_config::{OutputFormat, ProductionAnalysis, Severity};
 use fallow_engine::dead_code::{
-    derive_security_severity, enable_security_rules, security_catalogue_title,
-    security_finding_id as canonical_security_finding_id,
+    derive_security_severity, enable_security_rules, resolve_security_finding_severity,
+    security_catalogue_title, security_finding_id as canonical_security_finding_id,
     security_rule_id as canonical_security_rule_id,
 };
 pub use fallow_output::{
@@ -218,13 +218,14 @@ pub fn run_blind_spots(opts: &SecurityOptions<'_>) -> ExitCode {
     }
 }
 
-/// Run `fallow security`. Always exits 0 unless the user explicitly raised the
-/// `security-client-server-leak` rule to `error` AND findings exist (the rule
-/// defaults to `off` and the command forces it to `warn`, so the common case is
-/// advisory). Unsupported output formats exit 2.
+/// Run `fallow security`. Exits 0 unless `--fail-on-issues` is set and
+/// findings exist, or a finding's security rule resolves to `error` for its
+/// path (top-level `rules` or a matching `overrides` entry). The rules default
+/// to `off` and the command raises them to `warn`, so the common case is
+/// advisory. Unsupported output formats exit 2.
 pub fn run(opts: &SecurityOptions<'_>) -> ExitCode {
     let started = Instant::now();
-    let (mut output, effective_severities) = match build_security_command_output(opts, started) {
+    let (mut output, advisory) = match build_security_command_output(opts, started) {
         Ok(output) => output,
         Err(code) => return code,
     };
@@ -248,7 +249,7 @@ pub fn run(opts: &SecurityOptions<'_>) -> ExitCode {
     if !rendered.is_empty() || !matches!(opts.output, OutputFormat::GithubAnnotations) {
         outln!("{rendered}");
     }
-    security_exit_code(opts, &output, effective_severities)
+    security_exit_code(opts, &output, advisory)
 }
 
 /// Benchmark hook for the production security analysis and JSON rendering
@@ -471,7 +472,7 @@ pub fn benchmark_security_blind_spots_json(
 fn build_security_command_output(
     opts: &SecurityOptions<'_>,
     started: Instant,
-) -> Result<(SecurityOutput, SecurityRuleSeverities), ExitCode> {
+) -> Result<(SecurityOutput, SecurityAdvisoryRules), ExitCode> {
     validate_security_output(opts.output)?;
 
     let mut config = load_config_for_analysis(
@@ -535,8 +536,32 @@ fn build_security_command_output(
         workspace_diagnostics,
     });
     let mut output = output;
-    output.gate_outcomes = security_gate_outcomes(opts, &output, effective_severities);
-    Ok((output, effective_severities))
+    let advisory = security_advisory_rules(&config, &output);
+    output.gate_outcomes = security_gate_outcomes(opts, &output, advisory);
+    Ok((output, advisory))
+}
+
+/// The rule severities that decide the security advisory gate.
+#[derive(Clone, Copy)]
+struct SecurityAdvisoryRules {
+    /// A security rule is `error` at the top level or in an override.
+    can_error: bool,
+    /// A reported finding resolves to `error` for its own path.
+    has_error_finding: bool,
+}
+
+fn security_advisory_rules(
+    config: &fallow_config::ResolvedConfig,
+    output: &SecurityOutput,
+) -> SecurityAdvisoryRules {
+    let can_error = fallow_engine::dead_code::security_rules_can_error(config);
+    SecurityAdvisoryRules {
+        can_error,
+        has_error_finding: can_error
+            && output.security_findings.iter().any(|finding| {
+                resolve_security_finding_severity(config, finding) == Severity::Error
+            }),
+    }
 }
 
 #[derive(Clone, Copy)]
@@ -921,22 +946,22 @@ fn render_security_github(opts: &SecurityOptions<'_>, output: &SecurityOutput) -
 fn security_gate_outcomes(
     opts: &SecurityOptions<'_>,
     output: &SecurityOutput,
-    effective_severities: SecurityRuleSeverities,
+    advisory: SecurityAdvisoryRules,
 ) -> Option<fallow_output::GateOutcomes> {
     crate
```

**File**: `crates/cli/tests/integration/main.rs` (modified, +1/-0)
```diff
@@ -77,6 +77,7 @@ mod schema_conformance;
 mod schema_tests;
 mod scope_path_tests;
 mod security_gate_tests;
+mod security_override_tests;
 mod security_workflow_tests;
 mod signal_tests;
 mod snapshot_tests;
```

**File**: `crates/cli/tests/integration/security_override_tests.rs` (added, +231/-0)
```diff
@@ -0,0 +1,231 @@
+//! Per-path `overrides[].rules` for the security rules (issue #2985): an `off`
+//! override drops the security candidates in matching files, an `error`
+//! override makes `fallow security` exit 1, and files outside the override
+//! glob keep the top-level severity. The tests cover `security-sink` and
+//! `security-client-server-leak`. A leak override matches the `"use client"`
+//! file, not the server module on the trace.
+
+#![allow(
+    clippy::unwrap_used,
+    clippy::expect_used,
+    reason = "tests use unwrap/expect to keep fixture setup concise"
+)]
+
+use crate::common::fallow_bin;
+use std::path::Path;
+use std::process::{Command, Stdio};
+
+const SINK_SOURCE: &str = "export function run(code) {\n  return eval(code);\n}\n";
+
+/// Write a project with one `eval` sink in `src/generated/client.js` and one in
+/// `src/handwritten.js`, plus a `.fallowrc.json` with `overrides`.
+fn write_project(root: &Path, overrides: &str) {
+    std::fs::create_dir_all(root.join("src/generated")).expect("src dir");
+    std::fs::write(
+        root.join("package.json"),
+        r#"{ "name": "security-override-fixture", "private": true, "type": "module", "main": "src/index.js" }"#,
+    )
+    .expect("package");
+    std::fs::write(root.join("src/generated/client.js"), SINK_SOURCE).expect("client");
+    std::fs::write(root.join("src/handwritten.js"), SINK_SOURCE).expect("handwritten");
+    std::fs::write(
+        root.join("src/index.js"),
+        "import { run } from \"./generated/client.js\";\nimport { run as runLocal } from \"./handwritten.js\";\nexport const result = run(\"1 + 1\") + runLocal(\"2\");\n",
+    )
+    .expect("index");
+    std::fs::write(
+        root.join(".fallowrc.json"),
+        format!(r#"{{ "overrides": {overrides} }}"#),
+    )
+    .expect("config");
+}
+
+/// Run `fallow security --format json` and return `(exit_code, sink paths)`.
+fn run_security(root: &Path) -> (i32, Vec<String>) {
+    let out = Command::new(fallow_bin())
+        .args(["security", "--format", "json", "--quiet", "--no-cache"])
+        .arg("--root")
+        .arg(root)
+        .env("RUST_LOG", "")
+        .env("NO_COLOR", "1")
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .output()
+        .expect("run fallow security");
+    let json: serde_json::Value =
+        serde_json::from_slice(&out.stdout).expect("security output should be valid JSON");
+    let mut paths: Vec<String> = json["security_findings"]
+        .as_array()
+        .expect("security_findings array")
+        .iter()
+        .filter(|finding| finding["kind"] == "tainted-sink")
+        .map(|finding| finding["path"].as_str().expect("path").replace('\\', "/"))
+        .collect();
+    paths.sort();
+    (out.status.code().unwrap_or(-1), paths)
+}
+
+#[test]
+fn security_override_off_drops_findings_in_matching_files() {
+    let dir = tempfile::tempdir().expect("tempdir");
+    write_project(
+        dir.path(),
+        r#"[{ "files": ["src/generated/**"], "rules": { "security-sink": "off" } }]"#,
+    );
+
+    let (code, paths) = run_security(dir.path());
+
+    assert_eq!(code, 0);
+    assert_eq!(paths, vec!["src/handwritten.js".to_owned()]);
+}
+
+#[test]
+fn security_override_error_fails_the_run_while_top_level_is_warn() {
+    let dir = tempfile::tempdir().expect("tempdir");
+    write_project(
+        dir.path(),
+        r#"[{ "files": ["src/generated/**"], "rules": { "security-sink": "error" } }]"#,
+    );
+
+    let (code, paths) = run_security(dir.path());
+
+    assert_eq!(code, 1);
+    assert_eq!(
+        paths,
+        vec![
+            "src/generated/client.js".to_owned(),
+            "src/handwritten.js".to_owned()
+        ]
+    );
+}
+
+#[test]
+fn security_override_does_not_change_files_outside_its_glob() {
+    let dir = tempfile::tempdir().expect("tempdir");
+    write_project(
+        dir.path(),
+        r#"[{ "files": ["src/vendor/**"], "rules": { "security-sink": 
```

**File**: `crates/core/src/analyze/mod.rs` (modified, +2/-0)
```diff
@@ -2309,6 +2309,8 @@ fn populate_security_findings(
         populate_tainted_sink_findings(ctx, results);
     }
 
+    fallow_security::retain_enabled_security_findings(&mut results.security_findings, ctx.config);
+
     if !results.security_findings.is_empty() {
         annotate_security_findings(ctx, results);
     }
```

---

### Incident Patch 2: `773d4393` (2026-09-30)
**Commit Message**: fix(dupes): fail on clone groups with --fail-on-issues and --ci (#3057)

Closes #2984. `fallow dupes --fail-on-issues`, `fallow dupes --ci` and `fallow --only dupes --fail-on-issues` now exit 1 when clone groups remain after baseline and suppression filtering. The new `duplication-findings` gate outcome publishes the verdict. Without these flags, dupes still has no default exit rule.

**File**: `CHANGELOG.md` (modified, +16/-0)
```diff
@@ -7,6 +7,22 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+
+- **`fallow dupes --fail-on-issues` and `--ci` exit 1 when clone groups are
+  found.** Before, `dupes` accepted both flags and still exited 0, and so did
+  `fallow --only dupes --fail-on-issues`. Only `--threshold` failed the run.
+  Now these runs exit 1 when at least one clone group remains after the
+  baseline and suppression filters. The JSON envelope reports the verdict as
+  the new `gate_outcomes` entry `duplication-findings`, with the number of
+  clone groups in `observed`. Without one of these flags, `dupes` does not
+  change. `--threshold` and `--fail-on-stale-baseline` also do not change.
+  Migration: a CI job that runs `fallow dupes --ci` now fails when the
+  project has clone groups. To keep a job that only reports, use
+  `--format sarif --quiet` in place of `--ci`, or gate with `--threshold`.
+  The GitHub Action and the GitLab template already failed such a job, so
+  their result does not change. Thanks @TiagoGranelli for the report (#2984).
+
 ## [3.31.0] - 2026-09-30
 
 ### Added
```

**File**: `action/scripts/analyze.sh` (modified, +10/-7)
```diff
@@ -1495,15 +1495,18 @@ classify_gate() {
       if gate_is_owned "$gate" && [ "$enforced" = "true" ] \
         && ! combined_gate_needs_fail_on_issues "$gate"; then
         record_gate_failure "$gate"
-      elif [ "$gate" = "error-severity-findings" ] || [ "$gate" = "health-findings" ] || [ "$gate" = "audit-verdict" ]; then
-        # All three are default exit rules, governed by fail-on-issues rather
-        # than by an input of their own, and every envelope carries them.
+      elif [ "$gate" = "error-severity-findings" ] || [ "$gate" = "health-findings" ] || [ "$gate" = "audit-verdict" ] || [ "$gate" = "duplication-findings" ]; then
+        # These four gates are governed by fail-on-issues rather than by an
+        # input of their own. `error-severity-findings`, `health-findings`
+        # and `audit-verdict` are default exit rules, so every envelope
+        # carries them. `duplication-findings` is not a default rule: only
+        # `--fail-on-issues` or `--ci` in `args:` arms it.
         # `error-severity-findings` and `health-findings` are the CLI's own
         # findings rules, which the action's count gate deliberately does not
-        # follow; `audit-verdict` is already applied by the count gate below,
-        # and an audit job with fail-on-issues: false is a deliberate reporting
-        # configuration. All three are reported in the outputs and never in
-        # the log.
+        # follow. The count gate below already applies `audit-verdict` and
+        # already counts clone groups for `duplication-findings`. An audit job
+        # with fail-on-issues: false is a deliberate reporting configuration.
+        # All four are reported in the outputs and never in the log.
         :
       elif gate_is_owned "$gate" && [ "$enforced" = "true" ]; then
         # Only the combined `duplication-threshold` entry reaches this branch:
```

**File**: `action/tests/run.sh` (modified, +1/-0)
```diff
@@ -4573,6 +4573,7 @@ for default_case in \
   'dead-code|{"error-severity-findings":{"status":"fail","enforced":true}}||error-severity-findings' \
   'health|{"health-findings":{"status":"fail","enforced":true}}|"summary":{"functions_above_threshold":2}|health-findings' \
   'dead-code|{"error-severity-findings":{"status":"fail","enforced":false},"health-findings":{"status":"fail","enforced":false}}||error-severity-findings,health-findings' \
+  'dupes|{"duplication-findings":{"status":"fail","enforced":true,"observed":1.0,"threshold":0.0}}|"stats":{"clone_groups":1}|duplication-findings' \
   ; do
   IFS='|' read -r default_command default_gates default_extra default_failed <<< "$default_case"
   run_gate_analyze "$(gate_envelope "$default_gates" "$default_extra")" \
```

**File**: `ci/gitlab-ci.yml` (modified, +12/-9)
```diff
@@ -1366,15 +1366,18 @@ variables:
             if gate_is_owned "$gate" && [ "$enforced" = "true" ] \
               && ! combined_gate_needs_fail_on_issues "$gate"; then
               record_gate_failure "$gate"
-            elif [ "$gate" = "error-severity-findings" ] || [ "$gate" = "health-findings" ] || [ "$gate" = "audit-verdict" ]; then
-              # All three are default exit rules, governed by
-              # FALLOW_FAIL_ON_ISSUES rather than by a variable of their own,
-              # and every envelope carries them. The two findings rules are the
-              # CLI's, which the count gate deliberately does not follow; the
-              # audit verdict is already applied by the count gate below, and an
-              # audit pipeline with FALLOW_FAIL_ON_ISSUES false is a deliberate
-              # reporting configuration. All three reach dotenv and never the
-              # log.
+            elif [ "$gate" = "error-severity-findings" ] || [ "$gate" = "health-findings" ] || [ "$gate" = "audit-verdict" ] || [ "$gate" = "duplication-findings" ]; then
+              # These four gates are governed by FALLOW_FAIL_ON_ISSUES rather
+              # than by a variable of their own. error-severity-findings,
+              # health-findings and audit-verdict are default exit rules, so
+              # every envelope carries them. duplication-findings is not a
+              # default rule: only --fail-on-issues or --ci in FALLOW_ARGS arms it.
+              # The two findings rules are the CLI's, which the count gate
+              # deliberately does not follow. The count gate below already
+              # applies the audit verdict and already counts clone groups for
+              # duplication-findings. An audit pipeline with
+              # FALLOW_FAIL_ON_ISSUES false is a deliberate reporting
+              # configuration. All four reach dotenv and never the log.
               :
             elif gate_is_owned "$gate" && [ "$enforced" = "true" ]; then
               # Only the combined duplication-threshold entry reaches this
```

**File**: `ci/tests/run.sh` (modified, +1/-0)
```diff
@@ -2124,6 +2124,7 @@ for DEFAULT_CASE in \
   '{"error-severity-findings":{"status":"fail","enforced":true}}|error-severity-findings' \
   '{"health-findings":{"status":"fail","enforced":true}}|health-findings' \
   '{"error-severity-findings":{"status":"fail","enforced":false},"health-findings":{"status":"fail","enforced":false}}|error-severity-findings,health-findings' \
+  '{"duplication-findings":{"status":"fail","enforced":true,"observed":1.0,"threshold":0.0}}|duplication-findings' \
   ; do
   IFS='|' read -r DEFAULT_GATES DEFAULT_FAILED <<< "$DEFAULT_CASE"
   ENVELOPE=$(gitlab_gate_envelope "$DEFAULT_GATES")
```

---

### Incident Patch 3: `3d2081f0` (2026-09-30)
**Commit Message**: fix(benchmarks): fail when no project is benchmarked (#3056)

bench.mjs and bench-circular.mjs exited with status 0 when no fixtures
were present or when --projects matched no project. The run then looked
like a pass, but it measured nothing. Both scripts now print an error and
exit with status 1 when no project runs.

**File**: `benchmarks/bench-circular.mjs` (modified, +4/-0)
```diff
@@ -365,6 +365,10 @@ if (runRealWorld) {
   }
 }
 
+if (results.length === 0) {
+  console.error("No project was benchmarked. Generate or download the fixtures first.");
+  process.exit(1);
+}
 if (results.length > 0) {
   console.log("\n=== Summary ===\n");
   const summaryRows = results.map((r) => {
```

**File**: `benchmarks/bench.mjs` (modified, +4/-0)
```diff
@@ -406,6 +406,10 @@ if (runRealWorld) {
     }
   }
 }
+if (results.length === 0) {
+  console.error("No project was benchmarked. Generate or download the fixtures first.");
+  process.exit(1);
+}
 if (results.length > 0) {
   console.log("\n=== Summary ===\n");
   console.table(
```

---

### Incident Patch 4: `19d78207` (2026-09-30)
**Commit Message**: fix(benchmarks): read complete madge output and build without a timeout (#3054)

bench-circular.mjs showed "?" as the madge cycle count on the large and
xlarge synthetic fixtures. madge calls process.exit before a pipe drains,
so piped stdout stopped at 64 KiB and the JSON did not parse. Each tool
now writes stdout to a temporary regular file. /usr/bin/time still wraps
only the tool, so the timing and RSS values do not change.

bench.mjs and bench-circular.mjs stopped the release build after five
minutes. A cold build takes longer, and the script then printed only the
cargo lock message. The build now has no timeout and shows cargo output
directly. A failure names the cause: a spawn error, a signal, or the exit
status.

**File**: `benchmarks/bench-circular.mjs` (modified, +41/-19)
```diff
@@ -1,6 +1,15 @@
 #!/usr/bin/env node
 import { spawnSync } from "node:child_process";
-import { existsSync, readdirSync, statSync, readFileSync, rmSync } from "node:fs";
+import {
+  closeSync,
+  existsSync,
+  mkdtempSync,
+  openSync,
+  readdirSync,
+  readFileSync,
+  rmSync,
+  statSync,
+} from "node:fs";
 import { join, resolve, dirname } from "node:path";
 import { fileURLToPath } from "node:url";
 import os from "node:os";
@@ -15,13 +24,19 @@ const RUNS = parseInt(args.find((a) => a.startsWith("--runs="))?.split("=")[1] ?
 const WARMUP = parseInt(args.find((a) => a.startsWith("--warmup="))?.split("=")[1] ?? "2");
 
 console.log("Building fallow (release)...");
+// No timeout: a cold release build can take many minutes. Cargo writes its
+// progress and errors straight to the terminal.
 const buildResult = spawnSync("cargo", ["build", "--release"], {
   cwd: rootDir,
-  stdio: "pipe",
-  timeout: 300000,
+  stdio: ["ignore", "inherit", "inherit"],
 });
-if (buildResult.status !== 0) {
-  console.error("Build failed:", buildResult.stderr?.toString());
+if (buildResult.error || buildResult.status !== 0) {
+  const reason = buildResult.error
+    ? buildResult.error.message
+    : buildResult.signal
+      ? `cargo was stopped by ${buildResult.signal}`
+      : `cargo exited with status ${buildResult.status}`;
+  console.error(`Build failed: ${reason}`);
   process.exit(1);
 }
 const fallowBin = join(rootDir, "target", "release", "fallow");
@@ -86,21 +101,34 @@ function countSourceFiles(dir) {
   return count;
 }
 
+const stdoutDir = mkdtempSync(join(os.tmpdir(), "fallow-bench-circular-"));
+process.on("exit", () => rmSync(stdoutDir, { recursive: true, force: true }));
+
 function timeRunWithMemory(cmd, cmdArgs, cwd) {
   const isLinux = process.platform === "linux";
   const timeBin = "/usr/bin/time";
   const timeArgs = isLinux ? ["-v", cmd, ...cmdArgs] : ["-l", cmd, ...cmdArgs];
 
+  // Send stdout to a regular file, not a pipe. madge calls process.exit before
+  // a pipe drains, so piped output stops at 64 KiB and the JSON is incomplete.
+  const stdoutPath = join(stdoutDir, "stdout");
+  const stdoutFd = openSync(stdoutPath, "w");
   const start = performance.now();
-  const result = spawnSync(timeBin, timeArgs, {
-    cwd,
-    stdio: "pipe",
-    timeout: 600000,
-    maxBuffer: 50 * 1024 * 1024,
-    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
-  });
+  let result;
+  try {
+    result = spawnSync(timeBin, timeArgs, {
+      cwd,
+      stdio: ["pipe", stdoutFd, "pipe"],
+      timeout: 600000,
+      maxBuffer: 50 * 1024 * 1024,
+      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
+    });
+  } finally {
+    closeSync(stdoutFd);
+  }
   const elapsed = performance.now() - start;
   const stderr = result.stderr?.toString() ?? "";
+  const stdout = readFileSync(stdoutPath, "utf8");
 
   let peakRssBytes = 0;
   if (isLinux) {
@@ -111,13 +139,7 @@ function timeRunWithMemory(cmd, cmdArgs, cwd) {
     if (match) peakRssBytes = parseInt(match[1]);
   }
 
-  return {
-    elapsed,
-    status: result.status,
-    stdout: result.stdout?.toString() ?? "",
-    stderr,
-    peakRssBytes,
-  };
+  return { elapsed, status: result.status, stdout, stderr, peakRssBytes };
 }
 
 function parseFallowCycles(stdout) {
```

**File**: `benchmarks/bench.mjs` (modified, +10/-4)
```diff
@@ -24,13 +24,19 @@ const projectFilter = projectsArg
   : null;
 
 console.log("Building fallow (release)...");
+// No timeout: a cold release build can take many minutes. Cargo writes its
+// progress and errors straight to the terminal.
 const buildResult = spawnSync("cargo", ["build", "--release"], {
   cwd: rootDir,
-  stdio: "pipe",
-  timeout: 300000,
+  stdio: ["ignore", "inherit", "inherit"],
 });
-if (buildResult.status !== 0) {
-  console.error("Build failed:", buildResult.stderr?.toString());
+if (buildResult.error || buildResult.status !== 0) {
+  const reason = buildResult.error
+    ? buildResult.error.message
+    : buildResult.signal
+      ? `cargo was stopped by ${buildResult.signal}`
+      : `cargo exited with status ${buildResult.status}`;
+  console.error(`Build failed: ${reason}`);
   process.exit(1);
 }
 const fallowBin = join(rootDir, "target", "release", "fallow");
```

---

### Incident Patch 5: `08c83d57` (2026-09-30)
**Commit Message**: fix(vscode): override brace-expansion to 5.0.12 (#3049)

The VS Code Extension CI job failed on `pnpm audit --prod`. Three new
advisories mark brace-expansion 5.0.9 as vulnerable: GHSA-qhr7-859c-m2p7,
GHSA-6j4f-fj2g-mc7p and GHSA-q2hr-2g5m-vwhr. The package comes in through
vscode-languageclient and minimatch. No release of vscode-languageclient
changes this path, so the override moves to the patched 5.0.12.

Version 5.0.12 is older than the minimum release age. The release-age
exclude for 5.0.9 is not necessary now, so this change removes it.

**File**: `editors/vscode/pnpm-lock.yaml` (modified, +5/-5)
```diff
@@ -5,7 +5,7 @@ settings:
   excludeLinksFromLockfile: false
 
 overrides:
-  brace-expansion@5: 5.0.9
+  brace-expansion@5: 5.0.12
 
 importers:
 
@@ -1074,8 +1074,8 @@ packages:
   brace-expansion@2.1.4:
     resolution: {integrity: sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==}
 
-  brace-expansion@5.0.9:
-    resolution: {integrity: sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==}
+  brace-expansion@5.0.12:
+    resolution: {integrity: sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==}
     engines: {node: 20 || >=22}
 
   braces@3.0.3:
@@ -3521,7 +3521,7 @@ snapshots:
     dependencies:
       balanced-match: 1.0.2
 
-  brace-expansion@5.0.9:
+  brace-expansion@5.0.12:
     dependencies:
       balanced-match: 4.0.4
 
@@ -4255,7 +4255,7 @@ snapshots:
 
   minimatch@10.2.6:
     dependencies:
-      brace-expansion: 5.0.9
+      brace-expansion: 5.0.12
 
   minimatch@9.0.9:
     dependencies:
```

**File**: `editors/vscode/pnpm-workspace.yaml` (modified, +1/-3)
```diff
@@ -1,11 +1,9 @@
 allowBuilds:
   '@vscode/vsce-sign': false
   keytar: false
-minimumReleaseAgeExclude:
-  - brace-expansion@5.0.9
 
 overrides:
-  "brace-expansion@5": 5.0.9
+  "brace-expansion@5": 5.0.12
 
 supportedArchitectures:
   os:
```

---

### Incident Patch 6: `70537e15` (2026-09-30)
**Commit Message**: fix(deps): update vulnerable packages in app and benchmark lockfiles (#3051)

* fix(deps): update vulnerable packages in app and benchmark lockfiles

npm audit --omit=dev reported high findings in two lockfiles.

apps/review-electron:
- nanoid 3.3.14 to 3.3.19
- postcss 8.5.15 to 8.5.28
- undici 7.28.0 to 7.30.0 (and 6.27.0 to 6.29.0 under node-gyp)

benchmarks:
- brace-expansion 5.0.7 to 5.0.12
- nanoid 3.3.16 to 3.3.19
- postcss 8.5.21 to 8.5.28

Each patched version is in the range that the parent package declares.
Thus a lockfile update is sufficient, and no overrides entry is necessary.

* ci: audit the review app and benchmark lockfiles weekly

No job audits the production dependencies of apps/review-electron and
benchmarks, and Dependabot alerts are off for this repository. A weekly
npm audit --omit=dev run reports new advisories for these lockfiles.

**File**: `.github/workflows/npm-audit.yml` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+name: npm Audit
+
+# Audits the production dependencies of the npm lockfiles that no other job
+# audits. Dependabot alerts are off for this repository, so the weekly
+# schedule is the signal for new advisories.
+
+on:
+  schedule:
+    - cron: '0 6 * * 1'
+  workflow_dispatch:
+
+permissions: {}
+
+jobs:
+  audit:
+    name: Audit ${{ matrix.directory }}
+    runs-on: ubuntu-latest
+    timeout-minutes: 5
+    permissions:
+      contents: read
+    strategy:
+      fail-fast: false
+      matrix:
+        directory: [apps/review-electron, benchmarks]
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+        with:
+          persist-credentials: false
+
+      - name: npm audit
+        run: npm audit --omit=dev --package-lock-only
+        working-directory: ${{ matrix.directory }}
```

**File**: `apps/review-electron/package-lock.json` (modified, +13/-13)
```diff
@@ -8097,9 +8097,9 @@
       "license": "MIT"
     },
     "node_modules/nanoid": {
-      "version": "3.3.14",
-      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.14.tgz",
-      "integrity": "sha512-U9kYi5bpVMEI31yC8iw4bJJp0avcHXA0W8/wNfLfnvJYzihQo2ZRPYPvpAAd570HAcCBjCTN7vnr+v4StKl1IQ==",
+      "version": "3.3.19",
+      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.19.tgz",
+      "integrity": "sha512-Y2tUNy4ouw6tq5oDSKeQYGOyhkUBhNOcGV/02KC+6kd9eDGqdZd++mjMiIDilrBYvjEnCYvVtsuHCuP+okSfug==",
       "funding": [
         {
           "type": "github",
@@ -8173,9 +8173,9 @@
       }
     },
     "node_modules/node-gyp/node_modules/undici": {
-      "version": "6.27.0",
-      "resolved": "https://registry.npmjs.org/undici/-/undici-6.27.0.tgz",
-      "integrity": "sha512-YmfV3YnEDzXRC5lZ2jWtWWHKGUm1zIt8AhesR1tens+HTNv+YZlN/dp6G727LOvMJ8xjP9Be7Y2Sdr96LDm+pg==",
+      "version": "6.29.0",
+      "resolved": "https://registry.npmjs.org/undici/-/undici-6.29.0.tgz",
+      "integrity": "sha512-R+RODBqp6i2pPflGdq+xIOUkl+RNfGgHwoinecKu/JCuf2uO06cOKoDbI2P7Dn6KcswdKwrczbU6IYJ6K8X+wg==",
       "dev": true,
       "license": "MIT",
       "engines": {
@@ -8535,9 +8535,9 @@
       }
     },
     "node_modules/postcss": {
-      "version": "8.5.15",
-      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.15.tgz",
-      "integrity": "sha512-FfR8sjd4em2T6fb3I2MwAJU7HWVMr9zba+enmQeeWFfCbm+UOC/0X4DS8XtpUTMwWMGbjKYP7xjfNekzyGmB3A==",
+      "version": "8.5.28",
+      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.28.tgz",
+      "integrity": "sha512-RRuzqDtt5Y9h3quz5hWhK+TPnsmVs6WwSU6LkJMeY4HstUEDuYTG8UJSdawMRzmzAtV+KEoG8N3Qg2qLy5vM/A==",
       "funding": [
         {
           "type": "opencollective",
@@ -8554,7 +8554,7 @@
       ],
       "license": "MIT",
       "dependencies": {
-        "nanoid": "^3.3.12",
+        "nanoid": "^3.3.18",
         "picocolors": "^1.1.1",
         "source-map-js": "^1.2.1"
       },
@@ -9528,9 +9528,9 @@
       }
     },
     "node_modules/undici": {
-      "version": "7.28.0",
-      "resolved": "https://registry.npmjs.org/undici/-/undici-7.28.0.tgz",
-      "integrity": "sha512-cRZYrTDwWznlnRiPjggAGxZXanty6M8RV1ff8Wm4LWXBp7/IG8v5DnOm74DtUBp9OONpK75YlPnIjQqX0dBDtA==",
+      "version": "7.30.0",
+      "resolved": "https://registry.npmjs.org/undici/-/undici-7.30.0.tgz",
+      "integrity": "sha512-dkrQXeHSaoamnItlYbmzG0wFYrM0ZwDxCIg0A7aKjTyyhh9svRzCNFEzV+Vm05/yehjCzjDZ31KXfGEjYSztDQ==",
       "license": "MIT",
       "optional": true,
       "engines": {
```

**File**: `benchmarks/package-lock.json` (modified, +11/-11)
```diff
@@ -1081,15 +1081,15 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "5.0.7",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.7.tgz",
-      "integrity": "sha512-7oFy703dxfY3/NLxC1fh2SUCQ0H9rmAY+5EpDVfXjUTTs+HEwR2nYaqLv+GWcTsumwxPfiz6CzCNkwXwBUwqCA==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^4.0.2"
       },
       "engines": {
-        "node": "18 || 20 || >=22"
+        "node": "20 || >=22"
       }
     },
     "node_modules/buffer": {
@@ -2410,9 +2410,9 @@
       "license": "MIT"
     },
     "node_modules/nanoid": {
-      "version": "3.3.16",
-      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.16.tgz",
-      "integrity": "sha512-bzlKTyNJ7+LdGIIwy8ijFpIqEQIvafahV7eYykJ8Cvh42EdJeODoJ6gUJXpQJvej1BddH8OqTXZNE/KfbWAu8Q==",
+      "version": "3.3.19",
+      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.19.tgz",
+      "integrity": "sha512-Y2tUNy4ouw6tq5oDSKeQYGOyhkUBhNOcGV/02KC+6kd9eDGqdZd++mjMiIDilrBYvjEnCYvVtsuHCuP+okSfug==",
       "funding": [
         {
           "type": "github",
@@ -2648,9 +2648,9 @@
       }
     },
     "node_modules/postcss": {
-      "version": "8.5.21",
-      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.21.tgz",
-      "integrity": "sha512-v4sDNP3fdNiWMfabO7OwOQdOX8TiQSztKyT1Wj0w+j7LDallJThJRBBBmzVGyYj0crMh7jlV4zepPkiNu9UwDQ==",
+      "version": "8.5.28",
+      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.28.tgz",
+      "integrity": "sha512-RRuzqDtt5Y9h3quz5hWhK+TPnsmVs6WwSU6LkJMeY4HstUEDuYTG8UJSdawMRzmzAtV+KEoG8N3Qg2qLy5vM/A==",
       "funding": [
         {
           "type": "opencollective",
@@ -2667,7 +2667,7 @@
       ],
       "license": "MIT",
       "dependencies": {
-        "nanoid": "^3.3.16",
+        "nanoid": "^3.3.18",
         "picocolors": "^1.1.1",
         "source-map-js": "^1.2.1"
       },
```

---

### Incident Patch 7: `064525fa` (2026-09-30)
**Commit Message**: fix(coverage): retry a cloud read that a signal interrupts (#3048)

On Linux, a socket read that has a receive timeout fails with EINTR when a signal arrives, or when the process stops and continues. The cloud transport classified it as a network that cannot reach the cloud and gave no retry. An interrupted attempt now gets one more attempt, as a timeout does.

**File**: `CHANGELOG.md` (modified, +4/-1)
```diff
@@ -33,7 +33,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   now sends `Accept-Encoding: gzip` and decodes a gzip answer. The cloud
   compresses its answers, so a runtime-context answer is about 10 times
   smaller on the network. A read that gets HTTP 502, 503 or 504, or that
-  passes the timeout of 45 s, is sent one more time. An error message now
+  passes the timeout of 45 s, is sent one more time. A read that a signal
+  interrupts is also sent one more time, for example after Ctrl-Z and `fg`
+  on Linux. Before, it failed as a network that cannot reach the cloud. An
+  error message now
   names the cause: a timeout, a cloud outage or a network that cannot reach
   the cloud. The reads also send `x-fallow-agent-source` when an allowlisted
   coding agent runs the command.
```

**File**: `crates/cli/src/coverage/cloud_transport.rs` (modified, +89/-15)
```diff
@@ -10,9 +10,10 @@
 //!   The `ureq` `gzip` feature is not used, because it changes the behavior of
 //!   every other `ureq` client in the build.
 //! - One retry on HTTP 502, 503 and 504, with the delay from
-//!   [`crate::api::retry_delay_for_status`], and one retry on a timeout. A
-//!   cold cloud read can pass the gateway timeout one time and succeed on the
-//!   next call. Each call here is a read, so a second attempt is safe.
+//!   [`crate::api::retry_delay_for_status`], and one retry on a timeout or
+//!   on a socket call that a signal interrupted (EINTR). A cold cloud read
+//!   can pass the gateway timeout one time and succeed on the next call. Each
+//!   call here is a read, so a second attempt is safe.
 //! - The `x-fallow-agent-source` attribution header, sent only with a value
 //!   from the cloud allowlist.
 //! - Error messages that name the cause: a timeout, a cloud outage (5xx) or a
@@ -189,7 +190,11 @@ fn run_attempts(
                     attempt,
                 )));
             }
-            Err(AttemptError::Failed(err)) => return Err(err),
+            Err(AttemptError::Interrupted(_)) if attempt < MAX_ATTEMPTS => {
+                attempt += 1;
+                continue;
+            }
+            Err(AttemptError::Failed(err) | AttemptError::Interrupted(err)) => return Err(err),
         };
         if is_retryable_status(status) && attempt < MAX_ATTEMPTS {
             let delay =
@@ -233,6 +238,10 @@ type RawResponse = (u16, Option<String>, Vec<u8>, bool);
 enum AttemptError {
     /// The attempt passed the total timeout. It gets one more attempt.
     Timeout,
+    /// A signal, or a stop and continue of the process, interrupted a socket
+    /// call (EINTR). The partial answer is lost. The error gets one more
+    /// attempt and is the result when the last attempt is interrupted.
+    Interrupted(CloudError),
     /// Any other transport error. It gets no more attempts.
     Failed(CloudError),
 }
@@ -309,21 +318,25 @@ fn decode_body(bytes: &[u8], gzip: bool, operation: &str) -> Result<String, Clou
     Ok(decoded)
 }
 
-/// Classify a transport error as a timeout or as a network that cannot reach
-/// the cloud.
+/// Classify a transport error as a timeout, an interrupted call or a network
+/// that cannot reach the cloud.
 fn transport_error(err: &ureq::Error, operation: &str) -> AttemptError {
-    let is_timeout = match err {
-        ureq::Error::Timeout(_) => true,
-        ureq::Error::Io(io) => io.kind() == std::io::ErrorKind::TimedOut,
-        _ => false,
+    let io_kind = match err {
+        ureq::Error::Timeout(_) => return AttemptError::Timeout,
+        ureq::Error::Io(io) => Some(io.kind()),
+        _ => None,
     };
-    if is_timeout {
+    if io_kind == Some(std::io::ErrorKind::TimedOut) {
         return AttemptError::Timeout;
     }
-    AttemptError::Failed(CloudError::Network(unreachable_message(
+    let network = CloudError::Network(unreachable_message(
         operation,
         &sanitize_network_error(&err.to_string()),
-    )))
+    ));
+    if io_kind == Some(std::io::ErrorKind::Interrupted) {
+        return AttemptError::Interrupted(network);
+    }
+    AttemptError::Failed(network)
 }
 
 /// Message for a read that passed the total timeout on each attempt.
@@ -470,25 +483,86 @@ mod tests {
         assert!(matches!(outcome, Err(CloudError::Network(message)) if message == "refused"));
     }
 
+    #[test]
+    fn an_interrupted_read_gets_one_more_attempt() {
+        let mut attempts = 0;
+        let outcome = run_attempts("runtime-context", fast_timing(), || {
+            attempts += 1;
+            if attempts == 1 {
+                Err(AttemptError::Interrupted(CloudError::Network(
+                    "interrupted".to_owned(),
+                )))
+            } else {
+                Ok(ok_answer())
+            }
+        });
+        assert_eq!(attempts, 2);
+        assert!(matches!(outcome, Ok(CloudOutcome::Success(_))));
+    }
+

```

---

### Incident Patch 8: `b2333398` (2026-09-29)
**Commit Message**: fix(cli): use the singular noun for one owned hotspot (#3044)

The hotspot ownership summary now prints "1 hotspot depends" instead of "all 1 hotspots depend" when only one hotspot has ownership data.

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -429,7 +429,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   production" and "2 dev dependencies in production". For a count of one,
   the status line, the React context line of `fallow health` and the runtime
   coverage findings now print "1 issue", "1 prop", "1 hook" and "1
-  invocation".
+  invocation". When only one hotspot has ownership data, the ownership
+  summary prints "1 hotspot depends" instead of "all 1 hotspots depend".
 - **The programmatic combined runner reports the same health duplication as
   `fallow health`.** `run_combined` gave health the duplication report of the
   run and recomputed its stats from all parsed files. Files that
```

**File**: `crates/cli/src/report/human/health_hotspots.rs` (modified, +28/-1)
```diff
@@ -38,7 +38,9 @@ fn render_ownership_summary(report: &fallow_output::HealthReport) -> Option<Stri
 
     let mut segments: Vec<String> = Vec::new();
     if bus1_count > 0 {
-        let label = if bus1_count == total {
+        let label = if total == 1 {
+            "1 hotspot depends on a single recent contributor".to_owned()
+        } else if bus1_count == total {
             format!("all {total} hotspots depend on a single recent contributor")
         } else {
             format!("{bus1_count}/{total} hotspots depend on a single recent contributor")
@@ -434,4 +436,29 @@ mod tests {
         assert!(text.contains("1 file excluded (< 3 commits)"));
         assert!(text.contains("No CODEOWNERS file discovered"));
     }
+
+    #[test]
+    fn ownership_summary_uses_singular_for_one_owned_hotspot() {
+        let root = PathBuf::from("/repo");
+        let mut owned = hotspot(root.join("src/api.ts"), 75.0, ChurnTrend::Accelerating);
+        owned.ownership = Some(ownership(
+            "alice@example.com",
+            0.91,
+            1,
+            None,
+            OwnershipState::Unowned,
+        ));
+        let unowned = hotspot(root.join("src/db.ts"), 40.0, ChurnTrend::Stable);
+        let report = HealthReport {
+            hotspots: vec![HotspotFinding::from(owned), HotspotFinding::from(unowned)],
+            ..HealthReport::default()
+        };
+
+        let summary = plain(&[render_ownership_summary(&report).expect("summary line")]);
+
+        assert!(
+            summary.contains("1 hotspot depends on a single recent contributor"),
+            "{summary}"
+        );
+    }
 }
```

---

### Incident Patch 9: `216709fa` (2026-09-29)
**Commit Message**: fix: render the Socket README badge on GitHub

Socket's badge endpoint returns a Cloudflare challenge to GitHub's image proxy. Use a static shields.io badge that links to the Socket report.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@
   <a href="https://github.com/fallow-rs/fallow/actions/workflows/ci.yml"><img src="https://github.com/fallow-rs/fallow/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
   <a href="https://github.com/fallow-rs/fallow/actions/workflows/coverage.yml"><img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/fallow-rs/fallow/badges/coverage.json" alt="Coverage"></a>
   <a href="https://app.codspeed.io/fallow-rs/fallow?utm_source=badge"><img src="https://img.shields.io/endpoint?url=https://codspeed.io/badge.json" alt="CodSpeed"></a>
-  <a href="https://socket.dev/npm/package/fallow"><img src="https://socket.dev/api/badge/npm/package/fallow" alt="Socket"></a>
+  <a href="https://socket.dev/npm/package/fallow"><img src="https://img.shields.io/badge/socket-report-6e56cf" alt="Socket"></a>
   <a href="https://github.com/fallow-rs/fallow/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
 </p>
 
```

---

### Incident Patch 10: `731e313b` (2026-09-29)
**Commit Message**: fix(scripts): select the root package and resolve every selection form (#3004)

Package selections reach the root package where the package manager includes it (yarn berry foreach -A, pnpm -w, --include-workspace-root in pnpm and npm, a selection by the root name). Every selection form seeds runtime scripts in the selected packages, and the type-aware entry path gets the same package entry points as the analysis. A package that gets a runtime seed no longer falls back to its default src/index.ts entry.

**File**: `.agents/skills/fallow/references/gotchas.md` (modified, +1/-1)
```diff
@@ -430,7 +430,7 @@ A file that a command names in a `package.json` script, a CI file (GitHub Action
 
 Formatters, linters, and checkers are the exception. They read their file arguments but do not run them, so `eslint src/a.ts`, `prettier --check "**/*.ts"`, `oxlint src/`, `biome check`, `stylelint`, `textlint`, and similar tools make no entry points. This applies to the common package-manager and wrapper forms (`npx`, `pnpm exec`, `pnpm --filter web exec`, `pnpm -r exec`, `yarn run`, `cross-env`, `dotenv -e .env --`, `varlock run --`), and to a call of a script that runs the tool (`npm run lint -- src/a.ts`, `npm run lint src/a.ts`, `yarn lint src/a.ts`). The tool stays a used dependency, its `--config` file stays tracked, and a module that it loads through a flag (`eslint -f ./fmt.js`, `prettier --plugin=./plugin.mjs`) stays reachable.
 
-A command in a workspace package that the command selects resolves its file arguments against the directory of that package. `yarn workspace web node scripts/a.ts`, `pnpm --filter web exec tsx scripts/a.ts`, `npm exec -w web -- tsx scripts/a.ts`, and a call of a script of that package (`npm run -w web gen -- scripts/a.ts`) make `scripts/a.ts` of the `web` package an entry point. A pnpm filter can be a name, a name glob (`'@acme/*'`), a directory (`./packages/*`, `{packages/web}`), or an exclusion (`'!web'`). A selection of several packages resolves the file in each package where the file exists. This includes every package: `pnpm -r exec tsx scripts/a.ts`, `yarn workspaces foreach -A exec tsx scripts/a.ts` (narrowed by `--include` and `--exclude`), `yarn workspaces run gen scripts/a.ts`, and `npm --workspaces run gen -- scripts/a.ts`. The root package is not a workspace package, so these forms do not select it. From a workspace package, `npm --workspaces` selects only that package, as npm does. A script call in the directory of a workspace package (`pnpm -C packages/web run gen scripts/a.ts`, `npm --prefix packages/web run gen -- scripts/a.ts`, `yarn --cwd packages/web gen scripts/a.ts`) runs the script of that package with the forwarded arguments. The formatter and linter rule above still applies in each selected package.
+A command in a workspace package that the command selects resolves its file arguments against the directory of that package. `yarn workspace web node scripts/a.ts`, `pnpm --filter web exec tsx scripts/a.ts`, `npm exec -w web -- tsx scripts/a.ts`, and a call of a script of that package (`npm run -w web gen -- scripts/a.ts`) make `scripts/a.ts` of the `web` package an entry point. A pnpm filter can be a name, a name glob (`'@acme/*'`), a directory (`./packages/*`, `{packages/web}`), or an exclusion (`'!web'`). A selection of several packages resolves the file in each package where the file exists. This includes every package: `pnpm -r exec tsx scripts/a.ts`, `yarn workspaces foreach -A exec tsx scripts/a.ts` (narrowed by `--include` and `--exclude`), `yarn workspaces run gen scripts/a.ts`, and `npm --workspaces run gen -- scripts/a.ts`. `yarn workspaces foreach -A` also runs in the root package, as yarn berry does, and its `--include` and `--exclude` match a workspace name or directory (`.` is the root). `pnpm -w` also selects the root package. `--include-workspace-root` adds the root package: in pnpm to `-r` and to a filter that only excludes packages (`--filter '!web'`), and in npm to every workspace selection (`-w web`, `--workspaces`). Without it, `pnpm -r`, `yarn workspaces run`, and `npm --workspaces` leave out the root package. From a workspace package, `npm --workspaces` selects only that package. A `start` script that calls a script in selected packages (`pnpm -r run serve`, `pnpm -C packages/web run serve`) makes that script a runtime script of each package. A script call in the directory of a workspace package (`pnpm -C packages/web run gen scripts/a.ts`, `npm --prefix packages/web run gen -- scripts/a.ts`, `yarn --cwd packages/web gen scripts/a.ts`) runs the 
```

**File**: `.claude/skills/fallow/references/gotchas.md` (modified, +1/-1)
```diff
@@ -430,7 +430,7 @@ A file that a command names in a `package.json` script, a CI file (GitHub Action
 
 Formatters, linters, and checkers are the exception. They read their file arguments but do not run them, so `eslint src/a.ts`, `prettier --check "**/*.ts"`, `oxlint src/`, `biome check`, `stylelint`, `textlint`, and similar tools make no entry points. This applies to the common package-manager and wrapper forms (`npx`, `pnpm exec`, `pnpm --filter web exec`, `pnpm -r exec`, `yarn run`, `cross-env`, `dotenv -e .env --`, `varlock run --`), and to a call of a script that runs the tool (`npm run lint -- src/a.ts`, `npm run lint src/a.ts`, `yarn lint src/a.ts`). The tool stays a used dependency, its `--config` file stays tracked, and a module that it loads through a flag (`eslint -f ./fmt.js`, `prettier --plugin=./plugin.mjs`) stays reachable.
 
-A command in a workspace package that the command selects resolves its file arguments against the directory of that package. `yarn workspace web node scripts/a.ts`, `pnpm --filter web exec tsx scripts/a.ts`, `npm exec -w web -- tsx scripts/a.ts`, and a call of a script of that package (`npm run -w web gen -- scripts/a.ts`) make `scripts/a.ts` of the `web` package an entry point. A pnpm filter can be a name, a name glob (`'@acme/*'`), a directory (`./packages/*`, `{packages/web}`), or an exclusion (`'!web'`). A selection of several packages resolves the file in each package where the file exists. This includes every package: `pnpm -r exec tsx scripts/a.ts`, `yarn workspaces foreach -A exec tsx scripts/a.ts` (narrowed by `--include` and `--exclude`), `yarn workspaces run gen scripts/a.ts`, and `npm --workspaces run gen -- scripts/a.ts`. The root package is not a workspace package, so these forms do not select it. From a workspace package, `npm --workspaces` selects only that package, as npm does. A script call in the directory of a workspace package (`pnpm -C packages/web run gen scripts/a.ts`, `npm --prefix packages/web run gen -- scripts/a.ts`, `yarn --cwd packages/web gen scripts/a.ts`) runs the script of that package with the forwarded arguments. The formatter and linter rule above still applies in each selected package.
+A command in a workspace package that the command selects resolves its file arguments against the directory of that package. `yarn workspace web node scripts/a.ts`, `pnpm --filter web exec tsx scripts/a.ts`, `npm exec -w web -- tsx scripts/a.ts`, and a call of a script of that package (`npm run -w web gen -- scripts/a.ts`) make `scripts/a.ts` of the `web` package an entry point. A pnpm filter can be a name, a name glob (`'@acme/*'`), a directory (`./packages/*`, `{packages/web}`), or an exclusion (`'!web'`). A selection of several packages resolves the file in each package where the file exists. This includes every package: `pnpm -r exec tsx scripts/a.ts`, `yarn workspaces foreach -A exec tsx scripts/a.ts` (narrowed by `--include` and `--exclude`), `yarn workspaces run gen scripts/a.ts`, and `npm --workspaces run gen -- scripts/a.ts`. `yarn workspaces foreach -A` also runs in the root package, as yarn berry does, and its `--include` and `--exclude` match a workspace name or directory (`.` is the root). `pnpm -w` also selects the root package. `--include-workspace-root` adds the root package: in pnpm to `-r` and to a filter that only excludes packages (`--filter '!web'`), and in npm to every workspace selection (`-w web`, `--workspaces`). Without it, `pnpm -r`, `yarn workspaces run`, and `npm --workspaces` leave out the root package. From a workspace package, `npm --workspaces` selects only that package. A `start` script that calls a script in selected packages (`pnpm -r run serve`, `pnpm -C packages/web run serve`) makes that script a runtime script of each package. A script call in the directory of a workspace package (`pnpm -C packages/web run gen scripts/a.ts`, `npm --prefix packages/web run gen -- scripts/a.ts`, `yarn --cwd packages/web gen scripts/a.ts`) runs the 
```

**File**: `CHANGELOG.md` (modified, +27/-0)
```diff
@@ -625,6 +625,33 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   scripts/a.ts`, `npm --prefix`, `yarn --cwd`) now resolves its file
   arguments against that directory. `yarn node <file>` runs the file, also
   after `yarn --cwd <dir>` and `yarn workspace <name>`.
+- **Package selections also reach the root package, and every selection
+  form marks runtime scripts.** These gaps remained after the fix for
+  #2954:
+  - `yarn workspaces foreach -A` runs in the root workspace too, so
+    `yarn workspaces foreach -A exec node scripts/a.ts` now makes the root
+    `scripts/a.ts` an entry point. `--include` and `--exclude` match the
+    workspace name or its directory (`.` is the root), as in yarn.
+  - `pnpm -w` (`--workspace-root`), a pnpm filter with the name or
+    directory of the root package, and `yarn workspace` with the name of
+    the root package (yarn berry) also run in the root package. An npm workspace name or
+    directory does not select the root, as in npm. `--include-workspace-root`
+    adds the root package: in pnpm to `-r` and to a filter that only
+    excludes packages (`--filter '!web'`), and in npm to every workspace
+    selection (`-w web`, `--workspaces`), also with the short form `-iwr`.
+    Without it, `pnpm -r`,
+    `npm --workspaces` and `yarn workspaces run` leave out the root
+    package.
+  - A `start` script that calls a script in other packages with
+    `pnpm -r run serve`, `pnpm -C packages/web run serve`,
+    `npm --prefix packages/web run serve`, `yarn --cwd packages/web serve` or
+    `yarn workspaces foreach -A run serve` now makes `serve` a runtime script
+    of each selected package. Before, only a selection by name did this.
+    Such a package no longer falls back to its default entry
+    (`src/index.ts`), the same as with a selection by name, so an unused
+    default entry there can now show as an unused file.
+  - The type-aware refinement used entry points that ignored package
+    selections. It now gets the same package entry points as the analysis.
 - **npm config flags that take a value no longer forward the value (#2954).**
   `npm run gen --tag next src/a.ts` forwards only `src/a.ts` to the script.
   Before, Fallow knew only a few of these flags, so a value such as the one
```

**File**: `crates/cli/src/architecture_boundaries.rs` (modified, +0/-1)
```diff
@@ -1661,7 +1661,6 @@ fn core_backend_fallow_core_calls_are_explicitly_allowlisted() {
         "fallow_core::discover::discover_files_config_candidates_and_diagnostics",
         // Entry-point discovery has one implementation, in fallow-core.
         "fallow_core::discover::discover_entry_points",
-        "fallow_core::discover::discover_workspace_entry_points",
         "fallow_core::discover::discover_plugin_entry_points",
         // Discovery vocabulary lives with the walk that consumes it.
         "fallow_core::discover::ALLOWED_HIDDEN_DIRS",
```

**File**: `crates/core/benches/entry_point_discovery.rs` (modified, +20/-21)
```diff
@@ -18,7 +18,7 @@
     reason = "the external Criterion macro owns the benchmark lifecycle"
 )]
 
-use std::path::{Path, PathBuf};
+use std::path::Path;
 
 use criterion::{Criterion, criterion_group, criterion_main};
 use tempfile::TempDir;
@@ -42,7 +42,7 @@ struct MonorepoFixture {
     _temp_dir: TempDir,
     config: fallow_config::ResolvedConfig,
     files: Vec<fallow_core::discover::DiscoveredFile>,
-    workspace_roots: Vec<PathBuf>,
+    workspaces: Vec<fallow_config::WorkspaceInfo>,
 }
 
 fn write_file(path: &Path, source: &str) {
@@ -69,7 +69,7 @@ fn create_monorepo_fixture(package_count: usize) -> MonorepoFixture {
     write_file(&root.join("src/server.ts"), "export const serve = 1;\n");
     write_file(&root.join("scripts/build.mjs"), "export const build = 1;\n");
 
-    let mut workspace_roots = Vec::with_capacity(package_count);
+    let mut workspaces = Vec::with_capacity(package_count);
     for index in 0..package_count {
         let pkg_dir = root.join(format!("packages/pkg-{index}"));
         write_file(
@@ -93,7 +93,11 @@ fn create_monorepo_fixture(package_count: usize) -> MonorepoFixture {
                 &format!("export const unit{file} = {file};\n"),
             );
         }
-        workspace_roots.push(pkg_dir);
+        workspaces.push(fallow_config::WorkspaceInfo {
+            root: pkg_dir,
+            name: format!("@bench/pkg-{index}"),
+            is_internal_dependency: false,
+        });
     }
 
     let config = helpers::make_config(root, true);
@@ -102,32 +106,27 @@ fn create_monorepo_fixture(package_count: usize) -> MonorepoFixture {
         _temp_dir: temp_dir,
         config,
         files,
-        workspace_roots,
+        workspaces,
     }
 }
 
 /// Root-package discovery: manual entry globs, root `package.json` fields, and
 /// the nested `package.json` scan under the conventional monorepo directories.
 fn root_discovery(fixture: &MonorepoFixture) -> usize {
-    fallow_core::discover::discover_entry_points(&fixture.config, &fixture.files).len()
+    fallow_core::discover::discover_entry_points(&fixture.config, &fixture.files, &[]).len()
 }
 
-/// Per-workspace discovery over every package the fixture declares. The
-/// pipeline fans these across rayon workers; the benchmark runs them serially
-/// so the measurement reflects the work, not the machine's core count.
+/// Discovery over the root package and every workspace package the fixture
+/// declares: the package.json loads, the workspace map and runtime script
+/// seeds, and the per-package entries that the pipeline fans across rayon
+/// workers.
 fn workspace_discovery(fixture: &MonorepoFixture) -> usize {
-    fixture
-        .workspace_roots
-        .iter()
-        .map(|ws_root| {
-            fallow_core::discover::discover_workspace_entry_points(
-                ws_root,
-                &fixture.config,
-                &fixture.files,
-            )
-            .len()
-        })
-        .sum()
+    fallow_core::discover::discover_entry_points(
+        &fixture.config,
+        &fixture.files,
+        &fixture.workspaces,
+    )
+    .len()
 }
 
 fn entry_point_discovery_root(c: &mut Criterion) {
```

#### Recent Merged Pull Requests:
- **PR #3059** (2026-09-30): test(drift): count equal audit identities in the I4 oracle (@BartWaardenburg)
- **PR #3058** (2026-09-30): fix(security): apply overrides rules to security candidates (@BartWaardenburg)
- **PR #3057** (2026-09-30): fix(dupes): fail on clone groups with --fail-on-issues and --ci (@BartWaardenburg)
- **PR #3056** (2026-09-30): fix(benchmarks): fail when no project is benchmarked (@BartWaardenburg)
- **PR #3055** (2026-09-30): chore: explain a cancelled run of a merge commit (@BartWaardenburg)
- **PR #3054** (2026-09-30): fix(benchmarks): read complete madge output and build without a timeout (@BartWaardenburg)
- **PR #3053** (2026-09-30): chore: wait for the GitHub Actions runs of a merged commit (@BartWaardenburg)
- **PR #3052** (2026-09-30): test(coverage): classify cloud read timeouts without a socket (@BartWaardenburg)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
