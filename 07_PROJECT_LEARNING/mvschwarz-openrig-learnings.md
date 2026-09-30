# Forensic Learning Record (Deep Inspection): mvschwarz/openrig

> **Canonical Artifact**: `07_PROJECT_LEARNING/mvschwarz-openrig-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mvschwarz/openrig](https://github.com/mvschwarz/openrig))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:16:27.237Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mvschwarz/openrig`
- **Description**: Multi-agent harness that runs Claude Code and Codex together as one system
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2891 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `demo/scripts/check-demo-health.ts`
```
import {
  getCurrentRigSummary,
  listRigNodes,
  parseArgs,
  isAgentRuntime,
} from "./common.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rig = String(args["rig"] ?? args["rig-id"] ?? "demo-rig");
  const json = args["json"] === true;

  const rigSummary = getCurrentRigSummary(rig);
  const nodes = listRigNodes(rig);

  const summary = {
    rig,
    rigId: rigSummary?.rigId ?? null,
    status: rigSummary?.status ?? null,
    exists: Boolean(rigSummary),
    nodeCount: nodes.length,
    agentCount: nodes.filter((node) => isAgentRuntime(node.runtime)).length,
    startupReady: nodes.filter((node) => node.startupStatus === "ready").map((node) => node.logicalId),
    startupPending: nodes.filter((node) => node.startupStatus !== "ready").map((node) => ({
      logicalId: node.logicalId,
      startupStatus: node.startupStatus,
      restoreOutcome: node.restoreOutcome,
      latestError: node.latestError ?? null,
    })),
    resumeMetadata: nodes
      .filter((node) => isAgentRuntime(node.runtime))
      .map((node) => ({
        logicalId: node.logicalId,
        runtime: node.runtime,
        resumeType: node.resumeType ?? null,
        hasResumeToken: Boolean(node.resumeToken),
      })),
  };

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Demo health: ${rig}`);
    if (summary.rigId) {
      console.log(`- rigId: ${summary.rigId}`);
    }
    if (summary.status) {
      console.log(`- status: ${summary.status}`);
    }
    console.log(`- exists: ${summary.exists ? "yes" : "no"}`);
    console.log(`- nodes: ${summary.nodeCount}`);
    console.log(`- ready: ${summary.startupReady.length}`);
    if (summary.startupPending.length > 0) {
      console.log("- pending/failed:");
      for (const item of summary.startupPending) {
        console.log(
          `  ${item.logicalId}: startup=${item.startupStatus ?? "n/a"} restore=${item.restoreOutcome ?? "n/a"}`
        );
        if (item.latestError) {
          console.log(`    error: ${item.latestError}`);
        }
      }
    }
    console.log("- resume metadata:");
    for (const item of summary.resumeMetadata) {
      console.log(
        `  ${item.logicalId} [${item.runtime}] type=${item.resumeType ?? "none"} token=${item.hasResumeToken ? "yes" : "no"}`
      );
    }
  }

  if (!summary.exists || summary.nodeCount === 0) {
    process.exitCode = 1;
  }
}

await main();

```

### Core Architecture Module: `demo/scripts/common.ts`
```
import fs from "node:fs";
import nodePath from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  filterNodesForRigId,
  selectCurrentRigSummary,
} from "../../packages/daemon/src/domain/demo-rig-selector.js";

export interface DemoRigSummary {
  rigId: string;
  name: string;
  nodeCount?: number;
  status?: string;
}

export interface DemoNodeEntry {
  rigId: string;
  rigName: string;
  logicalId: string;
  canonicalSessionName: string | null;
  nodeKind: string;
  runtime: string | null;
  sessionStatus: string | null;
  startupStatus: string | null;
  restoreOutcome: string | null;
  resumeType?: string | null;
  resumeToken?: string | null;
  latestError?: string | null;
  cwd?: string | null;
}

export function repoRoot(): string {
  return nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), "../..");
}

export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    i++;
  }
  return result;
}

export function runCommand(command: string, args: string[], cwd = repoRoot()): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function runRig(args: string[]): string {
  return runCommand("rig", args);
}

export function runRigJson<T>(args: string[]): T {
  const output = runRig(args);
  return JSON.parse(output) as T;
}

export function runTmux(args: string[], cwd = repoRoot()): string {
  return runCommand("tmux", args, cwd);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function listRigSummaries(): DemoRigSummary[] {
  return runRigJson<DemoRigSummary[]>(["ps", "--json"]);
}

export function getCurrentRigSummary(rigNameOrId: string): DemoRigSummary | null {
  const summaries = listRigSummaries();
  const byId = summaries.find((summary) => summary.rigId === rigNameOrId);
  if (byId) {
    return byId;
  }
  return selectCurrentRigSummary(summaries, rigNameOrId);
}

export function listRigNodes(rigNameOrId: string): DemoNodeEntry[] {
  const summary = getCurrentRigSummary(rigNameOrId);
  if (!summary) {
    return [];
  }
  return filterNodesForRigId(
    runRigJson<DemoNodeEntry[]>(["ps", "--nodes", "--json"]),
    summary.rigId
  );
}

export function resolveNodeCwd(cwdValue: string | null | undefined): string {
  if (!cwdValue || cwdValue === ".") return repoRoot();
  if (nodePath.isAbsolute(cwdValue)) return cwdValue;
  return nodePath.resolve(repoRoot(), cwdValue);
}

export function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function writeJson(outputPath: string, data: unknown): void {
  fs.mkdirSync(nodePath.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export function isAgentRuntime(runtime: string | null): boolean {
  return runtime === "claude-code" || runtime === "codex";
}

```

### Core Architecture Module: `demo/scripts/resume-probe-lib.ts`
```
import {
  assessNativeResumeProbe,
  buildNativeResumeCommand,
  isProbeShellReady,
} from "../../packages/daemon/src/domain/native-resume-probe.js";
import type { DemoNodeEntry } from "./common.js";
import {
  resolveNodeCwd,
  runTmux,
  sanitizeName,
  sleep,
} from "./common.js";

export interface ProbeOptions {
  pollMs?: number;
  maxWaitMs?: number;
}

export interface ProbeResult {
  logicalId: string;
  runtime: string | null;
  sessionName: string | null;
  resumeType: string | null;
  resumeToken: string | null;
  command: string | null;
  status: "resumed" | "failed" | "inconclusive";
  code: string;
  detail: string;
  paneCommand: string | null;
  paneExcerpt: string;
}

export async function probeNodeResume(
  node: DemoNodeEntry,
  opts: ProbeOptions = {}
): Promise<ProbeResult> {
  const command = buildNativeResumeCommand(
    node.runtime,
    node.resumeToken ?? null,
    node.canonicalSessionName ?? undefined
  );

  if (!command) {
    return {
      logicalId: node.logicalId,
      runtime: node.runtime,
      sessionName: node.canonicalSessionName,
      resumeType: node.resumeType ?? null,
      resumeToken: node.resumeToken ?? null,
      command: null,
      status: "failed",
      code: "missing_resume_metadata",
      detail: "No native resume command could be built from the stored metadata.",
      paneCommand: null,
      paneExcerpt: "",
    };
  }

  const pollMs = opts.pollMs ?? 500;
  const maxWaitMs = opts.maxWaitMs ?? 6_000;
  const attempts = Math.max(1, Math.floor(maxWaitMs / pollMs));
  const sessionName = `rig-probe-${sanitizeName(node.logicalId)}-${Date.now().toString(36)}`;

  try {
    runTmux(["new-session", "-d", "-s", sessionName, "-c", resolveNodeCwd(node.cwd ?? ".")]);
    await waitForProbeShellReady(sessionName, pollMs);
    runTmux(["send-keys", "-t", sessionName, "-l", command]);
    runTmux(["send-keys", "-t", sessionName, "Enter"]);

    let lastPaneCommand = "";
    let lastPaneContent = "";
    let lastResult = assessNativeResumeProbe({
      runtime: node.runtime,
      paneCommand: "",
      paneContent: "",
    });

    for (let attempt = 0; attempt < attempts; attempt++) {
      lastPaneCommand = runTmux(["display-message", "-p", "-t", sessionName, "#{pane_current_command}"]);
      lastPaneContent = runTmux(["capture-pane", "-t", sessionName, "-p", "-S", "-80"]);
      lastResult = assessNativeResumeProbe({
        runtime: node.runtime,
        paneCommand: lastPaneCommand,
        paneContent: lastPaneContent,
      });

      if (lastResult.status !== "inconclusive") {
        break;
      }

      if (attempt < attempts - 1) {
        await sleep(pollMs);
      }
    }

    return {
      logicalId: node.logicalId,
      runtime: node.runtime,
      sessionName: node.canonicalSessionName,
      resumeType: node.resumeType ?? null,
      resumeToken: node.resumeToken ?? null,
      command,
      status: lastResult.status,
      code: lastResult.code,
      detail: lastResult.detail,
      paneCommand: lastPaneCommand || null,
      paneExcerpt: trimPaneExcerpt(lastPaneContent),
    };
  } finally {
    try {
      runTmux(["kill-session", "-t", sessionName]);
    } catch {
      // Best-effort cleanup.
    }
  }
}

function trimPaneExcerpt(content: string): string {
  const lines = content.split("\n").slice(-20);
  return lines.join("\n").trim();
}

async function waitForProbeShellReady(sessionName: string, pollMs: number): Promise<void> {
  const attempts = Math.max(4, Math.floor(4_000 / Math.max(pollMs, 100)));

  for (let attempt = 0; attempt < attempts; attempt++) {
    const paneCommand = runTmux(["display-message", "-p", "-t", sessionName, "#{pane_current_command}"]);
    const paneContent = runTmux(["capture-pane", "-t", sessionName, "-p", "-S", "-20"]);

    if (isProbeShellReady({ paneCommand, paneContent })) {
      return;
    }

    if (attempt < attempts - 1) {
      await sleep(pollMs);
    }
  }

  await sleep(250);
}

```

### Core Architecture Module: `demo/scripts/seed-resume-baseline.ts`
```
import { execFileSync } from "node:child_process";
import {
  listRigNodes,
  parseArgs,
  writeJson,
  isAgentRuntime,
  sleep,
} from "./common.js";
import { probeNodeResume } from "./resume-probe-lib.js";

interface SeedRoundResult {
  round: number;
  sentTo: string[];
  probe: Awaited<ReturnType<typeof probeNodeResume>>[];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rig = String(args["rig"] ?? args["rig-id"] ?? "demo-rig");
  const maxRounds = Number(args["max-rounds"] ?? "6");
  const waitMs = Number(args["wait-ms"] ?? "8000");
  const json = args["json"] === true;
  const output = typeof args["output"] === "string" ? String(args["output"]) : null;

  const allNodes = listRigNodes(rig).filter((node) => isAgentRuntime(node.runtime));
  if (allNodes.length === 0) {
    console.error(`No agent nodes found for rig '${rig}'.`);
    process.exitCode = 1;
    return;
  }

  const verified = new Set<string>();
  const rounds: SeedRoundResult[] = [];

  for (let round = 1; round <= maxRounds; round++) {
    const targets = allNodes.filter((node) => !verified.has(node.logicalId));
    if (targets.length === 0) break;

    for (const node of targets) {
      sendWarmup(node.canonicalSessionName, buildWarmupPrompt(node.logicalId, round));
    }

    await sleep(waitMs);

    const probe = [];
    for (const node of targets) {
      const result = await probeNodeResume(node);
      probe.push(result);
      if (result.status === "resumed") {
        verified.add(node.logicalId);
      }
    }

    rounds.push({
      round,
      sentTo: targets.map((node) => node.logicalId),
      probe,
    });
  }

  const finalNodes = listRigNodes(rig).filter((node) => isAgentRuntime(node.runtime));
  const summary = {
    rig,
    ok: verified.size === finalNodes.length,
    verified: [...verified].sort(),
    unverified: finalNodes
      .map((node) => node.logicalId)
      .filter((logicalId) => !verified.has(logicalId)),
    rounds,
  };

  if (output) {
    writeJson(output, summary);
  }

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Resume baseline seeding: ${rig}`);
    console.log(`Verified: ${summary.verified.length}/${finalNodes.length}`);
    for (const round of rounds) {
      console.log(`- Round ${round.round}: ${round.sentTo.join(", ")}`);
      for (const result of round.probe) {
        console.log(`  ${result.logicalId}: ${result.status} (${result.code})`);
      }
    }
    if (summary.unverified.length > 0) {
      console.log(`Unverified after seeding: ${summary.unverified.join(", ")}`);
    }
  }

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

function sendWarmup(sessionName: string | null, text: string): void {
  if (!sessionName) {
    throw new Error("Cannot seed a node without a canonical session name.");
  }

  execFileSync(
    "rig",
    ["send", sessionName, text, "--verify", "--force", "--json"],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
  );
}

function buildWarmupPrompt(logicalId: string, round: number): string {
  if (round === 1) {
    return `Baseline warmup 1/6 for ${logicalId}. Reply in exactly one line: ACK ${logicalId} 1`;
  }
  if (round === 2) {
    return `Baseline warmup 2/6 for ${logicalId}. Reply in exactly one line: ACK ${logicalId} 2`;
  }
  if (round === 3) {
    return `Baseline warmup 3/6 for ${logicalId}. In one short sentence, state your role in this demo rig.`;
  }
  if (round === 4) {
    return `Baseline warmup 4/6 for ${logicalId}. In one short sentence, state the repository you are operating in.`;
  }
  return `Baseline warmup ${round}/6 for ${logicalId}. Reply in exactly one line: ACK ${logicalId} ${round}`;
}

await main();

```

### Core Architecture Module: `demo/scripts/verify-native-resume.ts`
```
import { listRigNodes, parseArgs, writeJson, isAgentRuntime } from "./common.js";
import { probeNodeResume } from "./resume-probe-lib.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rig = String(args["rig"] ?? args["rig-id"] ?? "demo-rig");
  const logicalIdFilter = typeof args["logical-id"] === "string" ? String(args["logical-id"]) : null;
  const json = args["json"] === true;
  const output = typeof args["output"] === "string" ? String(args["output"]) : null;

  const nodes = listRigNodes(rig)
    .filter((node) => isAgentRuntime(node.runtime))
    .filter((node) => !logicalIdFilter || node.logicalId === logicalIdFilter);

  if (nodes.length === 0) {
    console.error(`No agent nodes found for rig '${rig}'.`);
    process.exitCode = 1;
    return;
  }

  const results = [];
  for (const node of nodes) {
    results.push(await probeNodeResume(node));
  }

  const summary = {
    rig,
    ok: results.every((result) => result.status === "resumed"),
    results,
  };

  if (output) {
    writeJson(output, summary);
  }

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Native resume probe: ${rig}`);
    for (const result of results) {
      console.log(
        `- ${result.logicalId} [${result.runtime}] ${result.status}: ${result.detail}`
      );
      if (result.command) {
        console.log(`  command: ${result.command}`);
      }
      if (result.paneCommand) {
        console.log(`  pane: ${result.paneCommand}`);
      }
    }
  }

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

await main();

```

### Core Architecture Module: `packages/cli/scripts/check-abi.mjs`
```
#!/usr/bin/env node

// Postinstall native-SQLite check for @openrig/cli.
// OpenRig supports Node.js 22 and 24. better-sqlite3 13 requires Node 22 or
// newer; on Node 20 it installs and loads, then crashes (SIGSEGV) the first
// time a database is opened. This check refuses unsupported majors BEFORE any
// native code runs, then proves the binding can actually open a database.
// The open runs in a child process so a native crash is reported, not silent.

const SUPPORTED_MAJORS = [22, 24];

const box = (lines) =>
  [
    "",
    "  ╔══════════════════════════════════════════════════════════════╗",
    ...lines.map((line) => `  ║  ${line.padEnd(60)}║`),
    "  ╚══════════════════════════════════════════════════════════════╝",
    "",
  ].join("\n");

const FIX_INSTALL = "Fix:  nvm install 22 && npm install -g @openrig/cli";

/**
 * @param {{
 *   nodeVersion: string,
 *   loadNativeAddon: () => void,
 *   openNativeDatabase?: () => { ok: true } | { ok: false, detail: string },
 * }} deps
 * @returns {{ ok: true, warning?: string } | { ok: false, message: string }}
 */
export function checkAbi({ nodeVersion, loadNativeAddon, openNativeDatabase }) {
  // Phase 1: version-range check. Runs before any native code is loaded.
  const match = nodeVersion.match(/^v?(\d+)/);
  const major = match ? parseInt(match[1], 10) : 0;

  if (major < SUPPORTED_MAJORS[0]) {
    return {
      ok: false,
      message: box([
        "@openrig/cli requires Node.js 22 or 24 (LTS).",
        `Current: ${nodeVersion}`,
        "",
        "Node 20 is no longer supported: the SQLite binding",
        "(better-sqlite3 13) crashes when it opens a database there.",
        "",
        FIX_INSTALL,
      ]),
    };
  }

  if (major % 2 !== 0) {
    return {
      ok: false,
      message: box([
        "@openrig/cli does not support odd-numbered Node releases.",
        `Current: ${nodeVersion}`,
        "",
        "Supported: Node.js 22 and 24 (LTS).",
        "",
        FIX_INSTALL,
      ]),
    };
  }

  // Even majors above the supported range are untested, not refused.
  const warning = SUPPORTED_MAJORS.includes(major)
    ? undefined
    : box([
        `Node ${major} is untested with @openrig/cli.`,
        `Current: ${nodeVersion}`,
        "",
        "Supported: Node.js 22 and 24 (LTS). The SQLite check below",
        "passed, but other behavior on this Node is unverified.",
      ]);

  // Phase 2: load the native addon (ABI / packaging / permission problems).
  try {
    loadNativeAddon();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const isAbiMismatch = detail.includes("NODE_MODULE_VERSION");

    return {
      ok: false,
      message:
        box(
          isAbiMismatch
            ? [
                "better-sqlite3 native binary does not match this Node.",
                `Current: ${nodeVersion}`,
                "",
                "Fix:  npm rebuild better-sqlite3",
                " or:  nvm install 22 && npm install -g @openrig/cli",
              ]
            : [
                "better-sqlite3 native addon failed to load.",
                `Current: ${nodeVersion}`,
                "",
                "Fix:  npm rebuild better-sqlite3",
                "If that fails, reinstall with a supported Node version:",
                "      nvm install 22 && npm install -g @openrig/cli",
              ],
        ) + `  Detail: ${detail}\n`,
    };
  }

  // Phase 3: open an in-memory database. Loading alone does not prove the
  // binding works (Node 20 + better-sqlite3 13 loads, then segfaults here).
  if (openNativeDatabase) {
    const opened = openNativeDatabase();
    if (!opened.ok) {
      return {
        ok: false,
        message:
          box([
            "better-sqlite3 loaded but could not open a database.",
            `Current: ${nodeVersion}`,
            "",
            "Fix:  npm rebuild better-sqlite3",
            "If that fails, reinstall with Node 22 or 24:",
            "      nvm install 22 && npm install -g @openrig/cli",
          ]) + `  Detail: ${opened.detail}\n`,
      };
    }
  }

  return warning ? { ok: true, warning } : { ok: true };
}

/**
 * Open an in-memory database in a child process, so a native crash
 * (e.g. SIGSEGV) is observed as a signal instead of killing this script.
 * @param {string} addonPath absolute path resolved from this package
 */
export function openInChildProcess(addonPath, spawnSync) {
  const probe =
    `const Database = require(${JSON.stringify(addonPath)});` +
    `const db = new Database(":memory:");` +
    `db.prepare("select sqlite_version() as v").get();` +
    `db.close();`;
  const result = spawnSync(process.execPath, ["-e", probe], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (result.error) return { ok: false, detail: result.error.message };
  if (result.signal) return { ok: false, detail: `database open was killed by ${result.signal}` };
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim().split("\n").slice(-3).join(" ");
    return { ok: false, detail: `database open exited ${result.status}${stderr ? `: ${stderr}` : ""}` };
  }
  return { ok: true };
}

// --- Run when executed as postinstall script ---
const isMain =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1].endsWith("check-abi.mjs"));

if (isMain) {
  const { createRequire } = await import("node:module");
  const { spawnSync } = await import("node:child_process");
  const require = createRequire(import.meta.url);

  const result = checkAbi({
    nodeVersion: process.version,
    loadNativeAddon: () => require("better-sqlite3"),
    openNativeDatabase: () => openInChildProcess(require.resolve("better-sqlite3"), spawnSync),
  });

  if (!result.ok) {
    console.error(result.message);
    process.exitCode = 1;
  } else if (result.warning) {
    console.error(result.warning);
  }
}

```

### Core Architecture Module: `packages/cli/src/ask-wake.ts`
```
import { execFile } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface WakeRunResult {
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
}

/** Runs a headless one-shot command with a bounded timeout. Injectable for tests. */
export type WakeRunner = (cmd: string, args: string[], opts: { timeoutMs: number }) => Promise<WakeRunResult>;

export interface WakeDeps {
  runner: WakeRunner;
  /** Locate the session file for a size advisory (pin 5). Optional. */
  fileLocator?: (token: string) => { path: string; sizeBytes: number } | null;
}

export interface WakeArgs {
  question: string;
  token: string;
  runtime: "claude" | "codex";
  timeoutMs?: number;
}

export interface WakeOutcome {
  ran: boolean;
  answer?: string;
  timedOut?: boolean;
  /** true when the wake process exited non-zero (bad token / missing binary /
   *  auth fail) — an honest failure, NOT a successful empty answer. */
  failed?: boolean;
  code?: number;
  message?: string;
  advisory?: string;
}

/** Default bounded wake timeout — long enough for a real recall, short enough
 *  that a hang surfaces instead of blocking forever (founder datapoint: ~minutes
 *  on a 635 MB session file). */
export const DEFAULT_WAKE_TIMEOUT_MS = 180_000;
const WAKE_LARGE_FILE_BYTES = 200 * 1024 * 1024; // 200 MB
/** The wake prompt is no-preamble by default — raw answers, not essays (pin 5). */
const NO_PREAMBLE = "Answer directly and concisely, with no preamble. Question: ";

/**
 * Build the HEADLESS one-shot resume command. `claude -p --resume <token>`
 * prints the answer and EXITS — the wake target is the session FILE, so the
 * process goes back to cold with no lingering process (pin 2/3, mini-PRD A).
 * codex uses `codex exec resume` (adapter-honest; session-file size lags the host).
 */
export function buildWakeCommand(runtime: "claude" | "codex", token: string, question: string): { cmd: string; args: string[] } {
  const prompt = `${NO_PREAMBLE}${question}`;
  if (runtime === "codex") {
    return { cmd: "codex", args: ["exec", "resume", token, prompt] };
  }
  return { cmd: "claude", args: ["-p", "--resume", token, prompt] };
}

/** Default runner: execFile with a hard timeout. Resolving means the child
 *  exited (back-to-cold) — we never retain a handle. */
export const defaultWakeRunner: WakeRunner = (cmd, args, opts) =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout: opts.timeoutMs, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      const e = err as (NodeJS.ErrnoException & { killed?: boolean; signal?: string }) | null;
      const timedOut = !!(e && e.killed && e.signal === "SIGTERM");
      resolve({
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        code: e ? (typeof e.code === "number" ? e.code : null) : 0,
        timedOut,
      });
    });
  });

/** Default file locator for the size advisory: scan ~/.claude/projects/<cwd>/<token>.jsonl. */
export function defaultWakeFileLocator(token: string): { path: string; sizeBytes: number } | null {
  const root = join(homedir(), ".claude", "projects");
  if (!existsSync(root)) return null;
  try {
    for (const d of readdirSync(root, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const p = join(root, d.name, `${token}.jsonl`);
      if (existsSync(p)) return { path: p, sizeBytes: statSync(p).size };
    }
  } catch {
    /* best-effort advisory only */
  }
  return null;
}

/**
 * L3 — wake a session by its resume token, ask one (possibly batched) question,
 * capture the snapshot answer, and let the process go back to cold. EXECUTES —
 * the only level with runtime cost/side effects; it runs ONLY when explicitly
 * invoked (never an implicit escalation from a failed L1/L2 search). Bounded
 * timeout + large-file advisory — never a silent hang.
 */
export async function runWake(deps: WakeDeps, args: WakeArgs): Promise<WakeOutcome> {
  const timeoutMs = args.timeoutMs ?? DEFAULT_WAKE_TIMEOUT_MS;

  let advisory: string | undefined;
  const located = deps.fileLocator?.(args.token);
  if (located && located.sizeBytes > WAKE_LARGE_FILE_BYTES) {
    advisory = `Session file is large (${(located.sizeBytes / 1024 / 1024).toFixed(0)} MB); waking may take minutes — a large session file lags the host. If it hangs, retry with a longer timeout or a background wake.`;
  }

  const { cmd, args: cmdArgs } = buildWakeCommand(args.runtime, args.token, args.question);
  const res = await deps.runner(cmd, cmdArgs, { timeoutMs });

  if (res.timedOut) {
    return {
      ran: true,
      timedOut: true,
      advisory,
      message: `Wake did not return within ${Math.round(timeoutMs / 1000)}s. The session may be large or slow — retry with a longer --wake-timeout or a background wake. This is a bounded timeout, not a silent hang.`,
    };
  }

  // A non-zero exit is a FAILURE, not a successful empty answer — surface it
  // honestly (same doctrine as L1/L2 honest-degraded). Only exit 0 is an answer.
  if (res.code !== 0) {
    const detail = res.stderr.trim();
    return {
      ran: true,
      failed: true,
      code: res.code ?? undefined,
      advisory,
      message: `Wake failed (exit ${res.code ?? "unknown"})${detail ? `: ${detail}` : ""}. The token may be invalid/expired, the runtime binary missing, or auth required.`,
    };
  }

  return { ran: true, answer: res.stdout.trim(), advisory };
}

```

### Core Architecture Module: `packages/cli/src/bin-wrapper.ts`
```
#!/usr/bin/env node

import path from "node:path";
import { existsSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REEXEC_GUARD_ENV = "OPENRIG_BIN_REEXEC";

export function resolveBinEntry(invokedPath = process.argv[1], moduleUrl = import.meta.url): string {
  const wrapperPath = invokedPath ? realpathSync(invokedPath) : realpathSync(fileURLToPath(moduleUrl));
  const packageRoot = path.resolve(path.dirname(wrapperPath), "..");
  return path.join(packageRoot, "dist", "index.js");
}

export function isDirectRun(argv1 = process.argv[1], moduleUrl = import.meta.url): boolean {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

export function resolveNodeReexecBinary(
  currentExecPath = process.execPath,
  invokedPath = process.argv[1],
  env: NodeJS.ProcessEnv = process.env,
  exists: (candidate: string) => boolean = existsSync,
  realpath: (candidate: string) => string = realpathSync,
): string | null {
  if (!invokedPath) return null;
  if (env[REEXEC_GUARD_ENV] === "1") return null;

  try {
    const binDir = realpath(path.dirname(invokedPath));
    const siblingNode = path.join(binDir, process.platform === "win32" ? "node.exe" : "node");
    if (!exists(siblingNode)) return null;

    const normalizedSiblingNode = realpath(siblingNode);
    const normalizedCurrentExec = realpath(currentExecPath);
    if (normalizedSiblingNode === normalizedCurrentExec) return null;

    return normalizedSiblingNode;
  } catch {
    return null;
  }
}

function maybeReexecWithSiblingNode(argv = process.argv): void {
  const preferredNode = resolveNodeReexecBinary(process.execPath, argv[1], process.env);
  if (!preferredNode) return;

  const scriptPath = argv[1] ? realpathSync(argv[1]) : fileURLToPath(import.meta.url);
  // An alias is not runtime authority. Keep a working interpreter; only switch
  // when the installed native dependency actually loads under the alternative.
  if (canLoadInstalledNative(process.execPath, scriptPath)) return;
  if (!canLoadInstalledNative(preferredNode, scriptPath)) return;
  const result = spawnSync(preferredNode, [scriptPath, ...argv.slice(2)], {
    stdio: "inherit",
    env: {
      ...process.env,
      [REEXEC_GUARD_ENV]: "1",
    },
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 0);
}

export function canLoadInstalledNative(node: string, wrapper: string): boolean {
  const probe = spawnSync(node, ["--input-type=module", "-e",
    "import {createRequire} from 'node:module'; const require=createRequire(process.argv[1]); const D=require('better-sqlite3'); new D(':memory:').close();",
    wrapper,
  ], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "pipe"] });
  return probe.status === 0;
}

export async function run(argv = process.argv): Promise<void> {
  const normalizedArgv = [...argv];
  if (normalizedArgv[1]) {
    normalizedArgv[1] = realpathSync(normalizedArgv[1]);
  }

  const entryUrl = pathToFileURL(resolveBinEntry(normalizedArgv[1], import.meta.url)).href;
  const mod = await import(entryUrl) as {
    createProgram: () => import("commander").Command;
    runProgram: (program: import("commander").Command, argv: string[]) => Promise<number>;
    runFrontDoor?: (argv: readonly string[]) => Promise<boolean>;
  };
  // Slice 17: the PUBLIC bin is the real front door — bare `rig` in a TTY
  // opens the TUI here, not only under a direct `node dist/index.js` run
  // (guard finding 1: importing the entry makes its isDirectRun false).
  // Feature-detected so the wrapper still runs an older sibling entry.
  const owned = mod.runFrontDoor ? await mod.runFrontDoor(normalizedArgv) : false;
  if (owned) return;
  // Slice 15: run through the shared error path so `--json` failures emit a JSON
  // error object with a nonzero exit instead of plain Commander text.
  await mod.runProgram(mod.createProgram(), normalizedArgv);
}

if (isDirectRun()) {
  maybeReexecWithSiblingNode(process.argv);
  await run(process.argv);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #159** (2026-09-29): **Codex skill projection skips missing .agents skills as no_op when matching .claude skills exist**
  *Symptoms*: ### OpenRig version  0.6.1 (d83bbebe)  ### OS, Node and tmux versions  macOS 26.0, Node 22.23.3 (daemon), tmux 3.7c; Claude Code 2.1.284, codex-cli 0.159.0  ### Harnesses involved  Codex  ### What you ran and what happened  ```shell Setup: fresh 0.6.1 install; the kernel rig has a Claude seat (advisor.lead) and Codex seats (operator.agent, queue.worker) sharing one workspace cwd.  Observed: <workspace>/.claude/skills was populated, but <workspace>/.agents (Codex skills) did not exist at all. The Codex seats started without their role skills. `rig skill audit` / loadout checks reported no projection errors.  Cause (as far as we traced it): the 0.6.1 instantiator passes claudeConflictTargetPath into projection planning even for the Codex runtime. When identical Claude skill files already exist, the missing Codex targets are classified no_op and are never written.  Workaround: `rig package install <pkg> --runtime codex --target <workspace>` wrote the 23 skills; Codex's skill list then showed all 23 enabled with zero errors.  Expected: Codex projection should check Codex target paths (.agents/skills), not Claude's. ```  ### Instance state that might matter  Fresh clean reinstall of 0.6.1. Workspace shared by the Claude and Codex seats of the kernel rig.  ### Checks  - [x] I searched existing issues and Discussions for this. - [x] I am on the latest published version, or I said which version above.
  **Post-Mortem & Fix Analysis**:
  > Thanks for tracing this to the cause. You were right: in a shared Claude/Codex workspace, the planner checked Codex skills against the Claude target, so an identical Claude skill made the missing Codex copy look like a no-op. #162, which resolves Codex skill conflicts against `.agents/skills/<id>/SKILL.md` and adds a regression test, is merged and closed this issue. It will ship in 0.6.2. Until then, your `rig package install … --runtime codex` workaround is the right stopgap.  — dev-planner@v-openrig-build, on behalf of @mvschwarz 

- **Issue #12** (2026-09-29): **rig up fails readiness on containerized / older-tmux hosts — tab field-separator collision**
  *Symptoms*: # [Bug] `rig up` fails readiness on containerized / older-tmux hosts — tab field-separator collision  ## Summary  On hosts running `tmux 3.3a` (the version shipped by Debian 12 / bookworm, Ubuntu 22.04, and many common Linux container base images), `rig up <spec>` fails every node with:  ``` Readiness timeout after 30s — harness did not become interactive: tmux session not responsive ```  even though the tmux sessions are clearly alive and the agent harness (Claude Code / Codex) is running inside them. Root cause: `tmux 3.3a` substitutes `TAB` bytes (`0x09`) with `_` (underscore) in `-F` format output, which breaks the adapter's tab-delimited parser.  ## Environment where reproduced  - **Host OS**: Linux (arm64), container base `node:22-bookworm` (Debian 12) - **tmux version in container**: `tmux 3.3a` (Debian package) - **OpenRig**: `@openrig/cli` (latest, installed via `npm i -g`) - **Rig spec**: `research-team` (builtin) - **Node**: 22.x  Not observed on macOS hosts with Homebrew tmux 3.4+.  ## Reproduction  In any Debian 12 / Ubuntu 22.04 container or VM:  ```bash apt-get install -y tmux          # pulls 3.3a npm install -g @openrig/cli @anthropic-ai/claude-code tmux -V                           # tmux 3.3a rig daemon start rig up research-team --cwd /tmp # all nodes fail: "tmux session not responsive" ```  Confirm the tab-substitution behaviour directly:  ```bash tmux new-session -d -s demo tmux list-sessions -F "A<TAB>B" | od -An -tx1 | head -1 # Observed: 41 5f 42 0a  
  **Post-Mortem & Fix Analysis**:
  > Thanks for the precise root cause; it was right. Current state on `main`: the session and pane format strings now use `|` as the field separator, so the readiness path no longer trips on tmux 3.3a's tab substitution. One leftover: the window listing format still uses tabs (`WINDOW_FORMAT` in `adapters/tmux.ts` and the matching `split("\t")`), so `list-windows` parsing can still misread on 3.3a. That's a small contained change, marked good-first-issue; if you'd like to finish it, say so here. Otherwise it's on our list.  — dev50-planner@v-openrig-build, on behalf of @mvschwarz 

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

### Incident Patch 1: `5b344e05` (2026-09-30)
**Commit Message**: fix(claude): preserve unset native config selection (#225)

Co-authored-by: dev-driver <dev-driver@openrig-build>

**File**: `packages/daemon/src/domain/claude-managed-launch.ts` (modified, +7/-4)
```diff
@@ -49,8 +49,11 @@ export class ClaudeManagedLaunch {
     // Relative/empty PATH entries are interpreted at the intended seat cwd,
     // including for /usr/bin/env shebangs inside the selected executable.
     const search = PATH.split(path.delimiter).map(p => path.resolve(cwd, p));
-    const env: Record<string, string> = { PATH: search.join(path.delimiter), HOME,
-      CLAUDE_CONFIG_DIR: path.resolve(cwd, CLAUDE_CONFIG_DIR ?? path.join(HOME, ".claude")) };
+    const configDir = path.resolve(cwd, CLAUDE_CONFIG_DIR ?? path.join(HOME, ".claude"));
+    const env: Record<string, string> = { PATH: search.join(path.delimiter), HOME };
+    // Session storage needs a directory, but exporting the default changes
+    // Claude's global config selection. Preserve an unset native selection.
+    if (CLAUDE_CONFIG_DIR !== undefined) env.CLAUDE_CONFIG_DIR = configDir;
     if (claudeClassicRendererEnvPrefix(this.rendererEnv)) env.CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN = "1";
     let executable: string | undefined;
     for (const dir of search) {
@@ -64,7 +67,7 @@ export class ClaudeManagedLaunch {
       const s = statSync(file);
       return [realpathSync(file), s.dev, s.ino, s.mode, s.size, s.mtimeMs, s.ctimeMs];
     };
-    return Object.freeze({ env: Object.freeze(env), executable,
+    return Object.freeze({ env: Object.freeze(env), configDir, executable,
       fileIdentity: Object.freeze(identity(executable)), cwdIdentity: Object.freeze(identity(cwd).slice(0, 3)) });
   }
 
@@ -108,7 +111,7 @@ export class ClaudeManagedLaunch {
       ...(generation ? { OPENRIG_OCCUPANT_GENERATION: generation } : {}) };
     const assignments = Object.entries({ ...context.env, ...identity }).map(([key, value]) => shellQuote(`${key}=${value}`));
     const forwarded = inherited.filter(key => !(key in identity)).map(key => `"${key}=\${${key}-}"`);
-    return Object.freeze({ assertCurrent, configDir: context.env.CLAUDE_CONFIG_DIR!, command: (args: readonly string[]) => {
+    return Object.freeze({ assertCurrent, configDir: context.configDir, command: (args: readonly string[]) => {
       assertCurrent();
       return `cd ${shellQuote(cwd)} && /usr/bin/env -i ${[...assignments, ...forwarded, shellQuote(context.executable), ...args.map(shellQuote)].join(" ")}`;
     } });
```

**File**: `packages/daemon/test/s03-bound-launch.test.ts` (modified, +61/-6)
```diff
@@ -11,10 +11,11 @@ import { TmuxAdapter } from "../src/adapters/tmux.js";
 import { seatLifecycleService } from "../src/routes/seat.js";
 import type { NodeBinding } from "../src/domain/runtime-adapter.js";
 
-// Never run a provider, shell, tmux or startup. OS confinement also denies them.
+// No provider, tmux or startup. Config-selection cases execute only a private
+// fake Claude through the generated shell command; other child calls are mocked.
 vi.mock("node:child_process", () => ({ execFile: vi.fn() }));
-// sandbox-exec deliberately denies execute eligibility too. Only that access
-// check is simulated; path resolution/stat/replacement use private real files.
+// Simulate eligibility for inert fixtures; path resolution/stat/replacement use
+// private real files. Config-selection cases additionally execute their fake.
 vi.mock("node:fs", async importOriginal => {
   const fs = await importOriginal<typeof import("node:fs")>();
   return { ...fs, accessSync: (file: string) => { if (!(fs.statSync(file).mode & 0o111)) throw Error("not executable"); } };
@@ -65,6 +66,58 @@ function fixture() {
 const input = { seatRef: "owner@rig", mode: "auto", actor: "operator", reason: "deliberate choice" };
 
 describe("S03 production managed capability selection", () => {
+  it.each([
+    ["unset", undefined], ["relative", "./config"],
+    ["absolute", "/inert/explicit-config"], ["empty", ""],
+  ])("preserves %s config selection in help and the executed launch", async (_label, selected) => {
+    const f = fixture();
+    if (selected === undefined) delete f.env.CLAUDE_CONFIG_DIR;
+    else f.env.CLAUDE_CONFIG_DIR = selected;
+    const helpReceipt = path.join(f.cwd, "help-env.json");
+    // Observe the actual child environment, using only synthetic credentials.
+    writeFileSync(f.executable, `#!${process.execPath}\n
+const fs = require('node:fs');
+const keys = ['CLAUDE_CONFIG_DIR', 'HOME', 'ANTHROPIC_API_KEY', 'OPENRIG_HOME',
+  'OPENRIG_NODE_ID', 'OPENRIG_RUNTIME', 'OPENRIG_SESSION_NAME', 'OPENRIG_OCCUPANT_GENERATION'];
+const env = Object.fromEntries(keys.filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
+if (process.argv.includes('--help')) {
+  fs.writeFileSync(${JSON.stringify(helpReceipt)}, JSON.stringify(env));
+  console.log(${JSON.stringify(help)});
+} else console.log(JSON.stringify({ env, args: process.argv.slice(2), cwd: process.cwd() }));
+`);
+    const native = await vi.importActual<typeof import("node:child_process")>("node:child_process");
+    vi.mocked(execFile).mockImplementation(native.execFile);
+    const prepared = await f.managed.prepare({ nodeId: "node", session: "seat", pane: "%1" }, "auto");
+    const configDir = path.resolve(f.cwd, selected ?? path.join(f.env.HOME!, ".claude"));
+    expect(prepared.configDir).toBe(configDir);
+    const args = ["--permission-mode", "auto", "--name", "seat's literal name"];
+    const command = prepared.command(args);
+    expect(command).not.toContain(f.env.ANTHROPIC_API_KEY);
+    const stdout = await new Promise<string>((resolve, reject) => {
+      native.execFile("/bin/sh", ["-c", command], { encoding: "utf8", timeout: 3000,
+        env: { ...f.env, CLAUDE_CONFIG_DIR: "/inert/not-the-managed-selection", OPENRIG_NODE_ID: "not-the-target" } },
+      (error, out) => error ? reject(error) : resolve(out));
+    });
+    const launched = JSON.parse(stdout);
+    const queried = JSON.parse(readFileSync(helpReceipt, "utf8"));
+    for (const env of [queried, launched.env]) {
+      if (selected === undefined) expect.soft(env).not.toHaveProperty("CLAUDE_CONFIG_DIR");
+      else expect(env.CLAUDE_CONFIG_DIR).toBe(configDir);
+    }
+    if (selected === undefined) expect.soft(command).not.toContain("CLAUDE_CONFIG_DIR=");
+    expect(queried).not.toHaveProperty("ANTHROPIC_API_KEY");
+    expect(launched).toMatchObject({ cwd: f.cwd, args, env: {
+      HOME: f.env.HOME, ANTHROPIC_API_KEY: f.env.ANTHROPIC_API_KEY, OPENRIG_HOME: f.env.OPENRIG_H
```

---

### Incident Patch 2: `b43498d7` (2026-09-30)
**Commit Message**: docs(contributing): ask security and integration PRs for practical scenarios (#224)

Adds a 'Before a security or integration PR' section to CONTRIBUTING.md, a
security question block to the PR template, and a trust-model bullet to
SECURITY.md's scope notes. Additive only; existing scope text is unchanged.

Co-authored-by: v-openrig-build <v-openrig-build@users.noreply.github.com>

**File**: `.github/PULL_REQUEST_TEMPLATE.md` (modified, +4/-0)
```diff
@@ -12,6 +12,10 @@
 
 <!-- Design choices, edge cases you did not cover, places a reviewer should look hardest. Empty is a fine answer. -->
 
+## If this is security-related
+
+<!-- Exploitable? Report it privately first (SECURITY.md). Otherwise: how does this go wrong for someone using OpenRig as designed (your own machine or a trusted private network), with evidence? Who causes it, and how do they reach the install? What does the change cost everyone else? See CONTRIBUTING.md. -->
+
 - [ ] One concern per PR; no version bump; no `CHANGELOG.md` edit
 - [ ] Tests added or updated where the change is testable
 - [ ] I listed the checks I ran, their results, and any checks I could not run
```

**File**: `CONTRIBUTING.md` (modified, +21/-0)
```diff
@@ -17,6 +17,27 @@ change in with the least friction on both sides.
 - **Questions:** use [Discussions › Q&A](https://github.com/mvschwarz/openrig/discussions/categories/q-a),
   not an issue.
 
+## Before a security or integration PR
+
+OpenRig connects your coding agents to each other: shared context, messaging, coordination and long-running seats.
+It's designed for your own machine or a trusted private network, for you and people you trust, not for the open
+internet. It doesn't try to act for you in the outside world; your agents already have tools for that.
+
+**Security-related PRs.** If you've found something exploitable, report it privately first (see
+[SECURITY.md](SECURITY.md)) rather than in a public PR. For hardening changes, tell us in the PR description:
+
+- the scenario: how this goes wrong for someone using OpenRig as it's designed to be used, and the evidence you have
+- who or what causes it, and how they reach the install
+- what the change costs everyone else: a refusal, an extra step, a new setting
+
+We look at the finding and the fix separately. We may agree with a finding and fix it differently, or decide the fix
+costs more than it protects. If the answers are missing we'll ask once, and close the PR with thanks if they don't
+come.
+
+**Integrations with other tools or projects.** Open an issue or an Ideas Discussion and wait for a maintainer's yes on
+scope before you build it; an issue on its own isn't a yes. Often the best home for an integration is your own
+repository, and we're happy to link to it.
+
 ## Setting up
 
 Node `^22 || ^24` and a working `tmux` are required. Then:
```

**File**: `SECURITY.md` (modified, +4/-0)
```diff
@@ -39,6 +39,10 @@ could do. A proof of concept is welcome; a working exploit against a third party
 
 ## Scope notes
 
+- OpenRig is designed for your own machine or a trusted private network, for you and people you trust, not for the
+  open internet. We assess reports by their practical impact on a user in that setup. Exposing an install to the open
+  internet isn't a supported deployment. OpenRig's own gateway integrations with outside services, such as Slack, and
+  anything that lets an untrusted party reach the daemon or an agent are in scope.
 - OpenRig assumes the machine and the accounts it runs under are trusted by their owner. Reports
   that require a hostile local user with the same account are still welcome but are unlikely to be
   treated as high severity.
```

---

### Incident Patch 3: `8b5e9488` (2026-09-30)
**Commit Message**: chore(release): prepare 0.6.3 regression repair notes (#223)

Co-authored-by: dev-qa <dev-qa@openrig-build>

**File**: `CHANGELOG.md` (modified, +28/-0)
```diff
@@ -8,6 +8,34 @@ deprecations, and behavioral changes. Breaking changes are called out explicitly
 
 ---
 
+## [0.6.3]
+
+- Recognize running managed Claude Code seats behind OpenRig's shell wrappers
+  using pane lineage, foreground process and native session identity checks.
+  This repairs the 0.6.2 messaging refusal reported by
+  [@dmelo](https://github.com/dmelo) in
+  [#197](https://github.com/mvschwarz/openrig/issues/197)
+  ([#220](https://github.com/mvschwarz/openrig/pull/220)).
+- Clean up unusable snapshot helpers when their ownership is proven, instead
+  of accumulating them on repeated attempts. Thanks to
+  [@z4cc](https://github.com/z4cc) for
+  [#188](https://github.com/mvschwarz/openrig/issues/188)
+  ([#189](https://github.com/mvschwarz/openrig/pull/189)).
+- Keep archived duplicate rigs out of seat-reference resolution and preserve
+  another live seat's session and queue work when removing a stale node.
+  Thanks to [@Farkinell](https://github.com/Farkinell) for
+  [#174](https://github.com/mvschwarz/openrig/issues/174)
+  ([#181](https://github.com/mvschwarz/openrig/pull/181)).
+
+- Protect proof media from artifact writes: reject binary artifact bodies and
+  require an explicit `--replace` to overwrite an existing Markdown artifact
+  ([#177](https://github.com/mvschwarz/openrig/pull/177)). Repository script tests
+  also run serially to prevent interference from shared build outputs
+  ([#221](https://github.com/mvschwarz/openrig/pull/221)).
+
+See [0.6.3 release notes](docs/releases/v0.6.3.md) for the verification limits.
+Source regression coverage does not establish installed Claude/Fedora delivery.
+
 ## [0.6.2]
 
 - Start with two Claude Code agents, two Codex agents, or a Claude owner and
```

**File**: `docs/releases/v0.6.3.md` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+# OpenRig 0.6.3 — Managed Claude messaging repair
+
+This patch repairs a 0.6.2 regression that refused messages to running Claude
+Code seats launched with an explicit permission mode. It also fixes snapshot
+helper cleanup and interference from archived rigs with duplicate names.
+
+## Managed Claude seats can receive messages
+
+OpenRig's managed launch can leave a shell wrapper in front of Claude Code.
+The delivery check previously treated that wrapper as a bare shell and refused
+`rig send`, even though Claude was running beneath it.
+
+The check now recognizes a stable, foreground Claude process descended from the
+bound pane, with the expected native session identity. A bare shell alone still
+does not qualify. Fork arguments that identify the parent rather than the
+current occupant remain insufficient evidence.
+
+Thanks to [@dmelo](https://github.com/dmelo) for the detailed
+[#197 report](https://github.com/mvschwarz/openrig/issues/197), addressed by
+[#220](https://github.com/mvschwarz/openrig/pull/220).
+
+## Snapshot helpers and archived rigs
+
+- Clean up a newly created snapshot helper when its input target cannot be
+  established and its ownership can still be proven. This prevents unusable
+  `rigged-refresh-*` helpers accumulating on repeated attempts. If ownership
+  cannot be established, preserve the session and report the limitation.
+  Thanks to [@z4cc](https://github.com/z4cc) for
+  [#188](https://github.com/mvschwarz/openrig/issues/188), addressed by
+  [#189](https://github.com/mvschwarz/openrig/pull/189).
+- Exclude archived rigs from seat-reference resolution, prefer unarchived
+  delivery targets, and preserve another live seat's session and queue work
+  when removing a stale duplicate node. Removal reports whose session it kept.
+  Thanks to [@Farkinell](https://github.com/Farkinell) for
+  [#174](https://github.com/mvschwarz/openrig/issues/174), addressed by
+  [#181](https://github.com/mvschwarz/openrig/pull/181).
+
+## Proof media and repository checks
+
+`rig proof add` rejects binary files supplied as artifact text, requires a
+Markdown artifact name, and requires `--replace` before overwriting an existing
+artifact. Attach screenshots and other binary evidence with `--media`. This
+prevents a proof write from replacing media with a Markdown body
+([#177](https://github.com/mvschwarz/openrig/pull/177)).
+
+Repository script tests now run serially because packaging tests rebuild daemon
+output that other tests import. This removes the reproduced shared-output race
+without weakening those tests
+([#221](https://github.com/mvschwarz/openrig/pull/221)).
+
+## Upgrade and verification scope
+
+Node.js 22 and 24 remain supported. This patch changes no dependencies, engine
+requirements or database migrations. Use the
+[existing upgrade procedure](../../skills/_canonical/core/openrig-upgrade/SKILL.md).
+
+The fixes have source reviews and focused regression coverage. The Claude
+process checks use synthetic process metadata; an installed Claude/Fedora send
+has not been demonstrated by that evidence. These checks do not establish
+native receipt, automatic recovery, or protection against a process exiting
+between verification and input. Final package and publication verification
+remain separate from this source preparation.
```

**File**: `package-lock.json` (modified, +5/-5)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "openrig",
-  "version": "0.6.2",
+  "version": "0.6.3",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "openrig",
-      "version": "0.6.2",
+      "version": "0.6.3",
       "license": "Apache-2.0",
       "workspaces": [
         "packages/daemon",
@@ -7013,7 +7013,7 @@
     },
     "packages/cli": {
       "name": "@openrig/cli",
-      "version": "0.6.2",
+      "version": "0.6.3",
       "hasInstallScript": true,
       "license": "Apache-2.0",
       "dependencies": {
@@ -7047,7 +7047,7 @@
     },
     "packages/daemon": {
       "name": "@openrig/daemon",
-      "version": "0.6.2",
+      "version": "0.6.3",
       "license": "Apache-2.0",
       "dependencies": {
         "@hono/node-server": "^1.13.0",
@@ -7088,7 +7088,7 @@
     },
     "packages/ui": {
       "name": "@openrig/ui",
-      "version": "0.6.2",
+      "version": "0.6.3",
       "license": "Apache-2.0",
       "dependencies": {
         "@fontsource-variable/jetbrains-mono": "^5.2.8",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "openrig",
-  "version": "0.6.2",
+  "version": "0.6.3",
   "private": true,
   "license": "Apache-2.0",
   "type": "module",
```

**File**: `packages/cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@openrig/cli",
-  "version": "0.6.2",
+  "version": "0.6.3",
   "type": "module",
   "description": "Local control plane for multi-agent coding topologies",
   "keywords": [
```

---

### Incident Patch 4: `4dc4047c` (2026-09-30)
**Commit Message**: fix(ci): serialize script tests sharing build outputs (#221)

Co-authored-by: dev-qa <dev-qa@openrig-build>

**File**: `package.json` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
   "scripts": {
     "build": "npm run build --workspaces",
     "test": "npm run test:repo && npm run test:workspaces",
-    "test:repo": "npm run build -w packages/daemon && node --test scripts/*.test.mjs && node scripts/check-docs-guard.mjs && node scripts/mirror-skills.mjs --check && node scripts/generate-context-packs.mjs --check",
+    "test:repo": "npm run build -w packages/daemon && node --test --test-concurrency=1 scripts/*.test.mjs && node scripts/check-docs-guard.mjs && node scripts/mirror-skills.mjs --check && node scripts/generate-context-packs.mjs --check",
     "test:workspaces": "npm run test -w packages/daemon -w packages/cli -w packages/tui",
     "test:ui": "npm run test -w packages/ui",
     "typecheck:prep": "npm run build -w packages/daemon",
```

**File**: `scripts/check-internal-leak-guard.test.mjs` (modified, +2/-1)
```diff
@@ -247,7 +247,8 @@ test("Plain B keeps guard enforcement out of root test:repo while fixture tests
   const pkg = JSON.parse(readFileSync("package.json", "utf8"));
   const command = pkg.scripts["test:repo"];
 
-  assert.match(command, /node --test scripts\/\*\.test\.mjs/);
+  // Packaging tests rebuild daemon/dist while other script tests import it.
+  assert.match(command, /node --test --test-concurrency=1 scripts\/\*\.test\.mjs/);
   assert.doesNotMatch(command, /node scripts\/check-internal-leak-guard\.mjs/);
 });
 
```

---

### Incident Patch 5: `700af77a` (2026-09-30)
**Commit Message**: fix(cli): protect proof media from artifact writes (#177)

**File**: `packages/cli/src/commands/proof.ts` (modified, +43/-4)
```diff
@@ -35,6 +35,11 @@ export const C1_VERDICTS = ["CLEAR", "BLOCKING", "CONCERNING", "PASS", "NOT-CLEA
 
 /** Video extensions for the C8 UX advisory (screencast evidence). */
 const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"]);
+const BINARY_EXTENSIONS = new Set([
+  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".pdf",
+  ".mp3", ".wav", ".ogg", ".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv",
+  ".zip", ".gz", ".7z", ".exe",
+]);
 
 export interface C1Header {
   slice: string;
@@ -183,7 +188,8 @@ checkboxes do not accept an item under the selected proof policy.
     .option("--slice-id <dot-id>", "C1 slice dot-ID (defaults to the slice frontmatter id)")
     .option("--file <path>", "Artifact body from a file (mutually exclusive with --body)")
     .option("--body <text>", "Artifact body inline (mutually exclusive with --file)")
-    .option("--name <filename>", "Artifact filename in proof/ (defaults to the --file basename, else <artifact-type>-<verdict>-<UTC>.md)")
+    .option("--name <filename>", "Markdown artifact filename in proof/ (defaults to the --file stem plus .md, else <artifact-type>-<verdict>-<UTC>.md)")
+    .option("--replace", "Explicitly replace an existing Markdown artifact")
     .option("--evidences <refs>", "D2 attestation: comma-separated proof-contract item refs this artifact covers (item text or 1-based index)")
     .option("--self-check <text>", "D2 attestation: the agent's assertion that it LOOKED at the evidence and confirmed it shows the claim")
     .option("--media <refs>", "Corrective §3.4: comma-separated media refs (relative to the slice proof/ dir) this drop stands behind — appended to the artifact body as markdown refs so the composer curates them into delivered.items[].proof")
@@ -198,6 +204,7 @@ checkboxes do not accept an item under the selected proof policy.
       file?: string;
       body?: string;
       name?: string;
+      replace?: boolean;
       evidences?: string;
       selfCheck?: string;
       media?: string;
@@ -228,7 +235,23 @@ checkboxes do not accept an item under the selected proof policy.
               action: "Point --file at the evidence file, or use --body.",
             });
           }
-          body = fs.readFileSync(opts.file, "utf8");
+          const input = fs.readFileSync(opts.file);
+          if (BINARY_EXTENSIONS.has(path.extname(opts.file).toLowerCase()) || input.includes(0)) {
+            throw new ScopeCliError({
+              fact: `--file ${opts.file} is binary, not an artifact body.`,
+              consequence: "The artifact was NOT dropped and the source file was not changed.",
+              action: "Attach screenshots and other binary evidence with --media instead.",
+            });
+          }
+          try {
+            body = new TextDecoder("utf-8", { fatal: true }).decode(input);
+          } catch {
+            throw new ScopeCliError({
+              fact: `--file ${opts.file} is not valid UTF-8 text.`,
+              consequence: "The artifact was NOT dropped and the source file was not changed.",
+              action: "Use a UTF-8 text file for --file, or attach binary evidence with --media.",
+            });
+          }
         } else if (opts.body) {
           body = opts.body;
         }
@@ -402,7 +425,7 @@ checkboxes do not accept an item under the selected proof policy.
         // Write the artifact: YAML frontmatter + body into proof/.
         const proofDir = path.join(slice.absPath, "proof");
         const defaultName = `${opts.artifactType}-${opts.verdict}-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
-        const fileName = opts.name ?? (opts.file ? path.basename(opts.file) : defaultName);
+        const fileName = opts.name ?? (opts.file ? `${path.parse(opts.file).name}.md` : defaultName);
         // rev1-r2 BLOCKING fix (a7dedd93 review): --name is a FILENAME, never
         // a path. Reject separators / dot-dot / absolute shapes BEFORE any
         // fi
```

**File**: `packages/cli/test/proof.test.ts` (modified, +46/-0)
```diff
@@ -145,6 +145,52 @@ describe("rig proof add (fs-level, temp workspace)", () => {
     expect(process.exitCode).toBeUndefined();
   });
 
+  it("rejects a screenshot passed as --file without changing its bytes", async () => {
+    const proofDir = path.join(sliceDir, "proof");
+    fs.mkdirSync(proofDir);
+    const screenshot = path.join(proofDir, "shot.png");
+    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
+    fs.writeFileSync(screenshot, bytes);
+    await run([
+      "add", "19-signal-layer", "--mission", "release-x",
+      "--artifact-type", "qa", "--verdict", "CLEAR",
+      "--candidate-sha", "abc1234", "--money-evidence", "m",
+      "--file", screenshot,
+    ]);
+    expect(process.exitCode).toBe(1);
+    expect(fs.readFileSync(screenshot)).toEqual(bytes);
+    expect(fs.readdirSync(proofDir)).toEqual(["shot.png"]);
+    expect(errs.join("\n")).toContain("--media");
+
+    process.exitCode = undefined;
+    await run(baseArgs(["--name", "shot.png"]));
+    expect(process.exitCode).toBe(1);
+    expect(fs.readFileSync(screenshot)).toEqual(bytes);
+  });
+
+  it("uses a Markdown name for a text file and requires --replace to overwrite it", async () => {
+    const source = path.join(workRoot, "notes.txt");
+    fs.writeFileSync(source, "first proof");
+    const fromFile = [
+      "add", "19-signal-layer", "--mission", "release-x",
+      "--artifact-type", "qa", "--verdict", "CLEAR",
+      "--candidate-sha", "abc1234", "--money-evidence", "m",
+      "--file", source,
+    ];
+    await run(fromFile);
+    const target = path.join(sliceDir, "proof", "notes.md");
+    expect(process.exitCode).toBeUndefined();
+    expect(fs.readFileSync(target, "utf8")).toContain("first proof");
+    fs.writeFileSync(source, "revised proof");
+    await run(fromFile);
+    expect(process.exitCode).toBe(1);
+    expect(fs.readFileSync(target, "utf8")).not.toContain("revised proof");
+    process.exitCode = undefined;
+    await run([...fromFile, "--replace"]);
+    expect(process.exitCode).toBeUndefined();
+    expect(fs.readFileSync(target, "utf8")).toContain("revised proof");
+  });
+
   it("out-of-set verdict is rejected naming the allowed values; nothing written; exit 1", async () => {
     await run([
       "add", "19-signal-layer", "--mission", "release-x",
```

---

### Incident Patch 6: `3b1b335d` (2026-09-30)
**Commit Message**: fix(daemon): rig remove never kills another rig's live seat; seat refs skip archived rigs (#174) (#181)

* fix(daemon): rig remove never kills another rig's live seat; seat refs skip archived rigs (#174)

An archived duplicate of a live rig shares its name and its seats'
canonical session names.

- `rig remove <archived-rigId> <node>` killed the tmux session by name,
  so it could end the live rig's seat. Removal now asks whether another
  node owns that session name, using the handover's live-ownership check,
  now shared as session-owner.ts. If another node owns it, removal
  leaves the session running, doesn't block on or reroute the queue
  work addressed to it, and reports the owner as `sessionKeptFor`. The
  node itself is still removed.
- Seat refs (`member@rig`) for seat launch, stop, model and handover
  resolved rigs by name including archived ones, so they failed with
  "matched multiple nodes". They now resolve unarchived rigs only, as
  default reads do since migration 042. Other findRigsByName callers
  are unchanged.

* fix(daemon): archived rigs don't claim a live seat's session or input target (#174)

Review follow-up. Archiving a rig keeps its bindings, so the arc

**File**: `packages/cli/src/commands/remove.ts` (modified, +3/-0)
```diff
@@ -51,6 +51,9 @@ export function removeCommand(depsOverride?: StatusDeps): Command {
       }
 
       console.log(`Removed node ${res.data["logicalId"]} from rig ${res.data["rigId"]} (${res.data["sessionsKilled"]} session killed)`);
+      if (typeof res.data["sessionKeptFor"] === "string") {
+        console.log(`Session kept: owned by ${res.data["sessionKeptFor"]}`);
+      }
     });
 
   return cmd;
```

**File**: `packages/cli/src/commands/shrink.ts` (modified, +6/-1)
```diff
@@ -19,6 +19,7 @@ type ShrinkResponse = {
     nodeId: string;
     status: "removed" | "failed";
     sessionsKilled: number;
+    sessionKeptFor?: string;
     error?: string;
   }>;
   error?: string;
@@ -74,7 +75,8 @@ export function shrinkCommand(depsOverride?: StatusDeps): Command {
         for (const node of res.data.nodes ?? []) {
           const icon = node.status === "removed" ? "OK" : "FAIL";
           const error = node.error ? ` — ${node.error}` : "";
-          console.log(`  [${icon}] ${node.logicalId}${error}`);
+          const kept = node.sessionKeptFor ? ` (session kept: owned by ${node.sessionKeptFor})` : "";
+          console.log(`  [${icon}] ${node.logicalId}${kept}${error}`);
         }
         process.exitCode = 1;
         return;
@@ -83,6 +85,9 @@ export function shrinkCommand(depsOverride?: StatusDeps): Command {
       console.log(
         `Removed pod ${res.data.namespace} from rig ${res.data.rigId} (${res.data.removedLogicalIds?.length ?? 0} node(s), ${res.data.sessionsKilled} session killed)`
       );
+      for (const node of res.data.nodes ?? []) {
+        if (node.sessionKeptFor) console.log(`  ${node.logicalId}: session kept, owned by ${node.sessionKeptFor}`);
+      }
     });
 
   return cmd;
```

**File**: `packages/cli/test/remove-kept-session-output.test.ts` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+// #174: when removal keeps a session that belongs to another rig's live seat, the human output of
+// `rig remove` and `rig shrink` says so (JSON already carries `sessionKeptFor`).
+import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
+import http from "node:http";
+import { Command } from "commander";
+import { DaemonClient } from "../src/client.js";
+import { STATE_FILE, type DaemonState } from "../src/daemon-lifecycle.js";
+import { removeCommand } from "../src/commands/remove.js";
+import { shrinkCommand } from "../src/commands/shrink.js";
+import type { StatusDeps } from "../src/commands/status.js";
+
+const RESPONSES: Record<string, unknown> = {
+  "DELETE /api/rigs/rig-1/nodes/lead.planner": {
+    ok: true, rigId: "rig-1", nodeId: "node-9", logicalId: "lead.planner",
+    sessionsKilled: 0, sessionKeptFor: "lead.planner@live-rig", reroutedQitemIds: [],
+  },
+  "DELETE /api/rigs/rig-1/nodes/dev.impl": {
+    ok: true, rigId: "rig-1", nodeId: "node-1", logicalId: "dev.impl", sessionsKilled: 1, reroutedQitemIds: [],
+  },
+  "DELETE /api/rigs/rig-1/pods/kept": {
+    ok: true, status: "ok", rigId: "rig-1", podId: "pod-9", namespace: "kept",
+    removedLogicalIds: ["kept.lead"], sessionsKilled: 0, reroutedQitemIds: [],
+    nodes: [{ logicalId: "kept.lead", nodeId: "node-9", status: "removed", sessionsKilled: 0, sessionKeptFor: "kept.lead@live-rig" }],
+  },
+};
+
+describe("#174 remove/shrink human output names a kept session", () => {
+  let server: http.Server;
+  let port: number;
+
+  beforeAll(async () => {
+    server = http.createServer((req, res) => {
+      const body = RESPONSES[`${req.method} ${req.url}`];
+      res.writeHead(body ? 200 : 404, { "Content-Type": "application/json" });
+      res.end(JSON.stringify(body ?? { error: "not found" }));
+    });
+    await new Promise<void>((resolve) => { server.listen(0, "127.0.0.1", resolve); });
+    port = (server.address() as { port: number }).port;
+  });
+  afterAll(() => { server.close(); });
+
+  function deps(): StatusDeps {
+    return {
+      lifecycleDeps: {
+        spawn: vi.fn(() => ({ pid: 1, unref: vi.fn() }) as never),
+        fetch: vi.fn(async () => ({ ok: true })),
+        kill: vi.fn(() => true),
+        readFile: vi.fn((p: string) => p === STATE_FILE
+          ? JSON.stringify({ pid: 123, port, db: "test.sqlite", startedAt: "2026-09-30T00:00:00Z" } as DaemonState)
+          : null),
+        writeFile: vi.fn(),
+        removeFile: vi.fn(),
+        exists: vi.fn((p: string) => p === STATE_FILE),
+        mkdirp: vi.fn(),
+        openForAppend: vi.fn(() => 3),
+        isProcessAlive: vi.fn(() => true),
+      },
+      clientFactory: () => new DaemonClient(`http://127.0.0.1:${port}`),
+    };
+  }
+
+  async function run(command: Command, args: string[]): Promise<{ output: string; exitCode: number | undefined }> {
+    const logs: string[] = [];
+    const log = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { logs.push(a.join(" ")); });
+    const err = vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { logs.push(a.join(" ")); });
+    process.exitCode = undefined;
+    const program = new Command();
+    program.exitOverride();
+    program.addCommand(command);
+    try {
+      await program.parseAsync(["node", "rig", ...args]);
+      return { output: logs.join("\n"), exitCode: process.exitCode };
+    } finally {
+      log.mockRestore();
+      err.mockRestore();
+      process.exitCode = undefined;
+    }
+  }
+
+  it("remove says the session was kept and for whom", async () => {
+    const { output, exitCode } = await run(removeCommand(deps()), ["remove", "rig-1", "lead.planner"]);
+    expect(exitCode).toBeUndefined();
+    expect(output).toContain("Removed node lead.planner from rig rig-1 (0 session killed)");
+    expect(output).toContain("Session kept: owned by lead.planner@live-rig");
+  });
+
+  it("control: remove prints no kept line when it kill
```

**File**: `packages/daemon/src/domain/rig-lifecycle-service.ts` (modified, +17/-3)
```diff
@@ -5,6 +5,7 @@ import type { DiscoveryRepository } from "./discovery-repository.js";
 import type { EventBus } from "./event-bus.js";
 import type { TmuxAdapter } from "../adapters/tmux.js";
 import type { QueueRepository } from "./queue-repository.js";
+import { findOtherSessionOwner } from "./session-owner.js";
 
 type ClaimedSessionRow = {
   session_id: string;
@@ -63,6 +64,8 @@ export type RemoveNodeResult =
       nodeId: string;
       logicalId: string;
       sessionsKilled: number;
+      /** #174: the session name belonged to another node's seat (logical id @ rig), so it was kept. */
+      sessionKeptFor?: string;
       fallbackDestination?: string;
       reroutedQitemIds: string[];
     }
@@ -384,8 +387,15 @@ export class RigLifecycleService {
       if (invalidFallback) return invalidFallback;
     }
 
+    // #174: a session name can be reused by another rig's live seat (for example an archived duplicate
+    // of a live rig). When another unarchived node owns the name, that session and the queue work
+    // addressed to it are the other seat's: removal neither kills it nor routes its work. Owners in
+    // archived rigs don't count, since archiving keeps their stale bindings.
+    const sessionOwner = node.latest_session_name
+      ? findOtherSessionOwner(this.db, node.latest_session_name, node.node_id, { ignoreArchived: true })
+      : null;
     const activeQitemIds = this.activeQitemIdsForSessionNames(
-      node.latest_session_name ? [node.latest_session_name] : [],
+      node.latest_session_name && !sessionOwner ? [node.latest_session_name] : [],
     );
     if (activeQitemIds.length > 0 && fallbackDestination === undefined) {
       return {
@@ -407,9 +417,10 @@ export class RigLifecycleService {
     }
 
     const preserveDetachedClaimedSession = node.latest_session_origin === "claimed" && node.latest_session_status === "detached";
+    const keepSession = preserveDetachedClaimedSession || sessionOwner !== null;
 
     let sessionsKilled = 0;
-    if (node.latest_session_name && !preserveDetachedClaimedSession) {
+    if (node.latest_session_name && !keepSession) {
       const kill = await this.tmuxAdapter?.killSession(node.latest_session_name);
       if (kill && !kill.ok && kill.code !== "session_not_found") {
         return {
@@ -426,7 +437,7 @@ export class RigLifecycleService {
     const persisted: Array<{ type: "session.detached" | "node.removed"; seq: number; createdAt: string }> = [];
     let rosterEvent: ReturnType<EventBus["persistWithinTransaction"]> | null = null;
     const tx = this.db.transaction(() => {
-      if (node.latest_session_name && !preserveDetachedClaimedSession) {
+      if (node.latest_session_name && !keepSession) {
         const detached = this.eventBus.persistWithinTransaction({
           type: "session.detached",
           rigId,
@@ -480,6 +491,7 @@ export class RigLifecycleService {
       nodeId: node.node_id,
       logicalId: node.logical_id,
       sessionsKilled,
+      ...(sessionOwner ? { sessionKeptFor: `${sessionOwner.logical_id}@${sessionOwner.rig_name}` } : {}),
       ...(fallbackDestination !== undefined ? { fallbackDestination } : {}),
       reroutedQitemIds: activeQitemIds,
     };
@@ -549,6 +561,7 @@ export class RigLifecycleService {
       logicalId: string;
       status: "removed" | "failed";
       sessionsKilled: number;
+      sessionKeptFor?: string;
       error?: string;
     }> = [];
     for (const node of nodes) {
@@ -613,6 +626,7 @@ export class RigLifecycleService {
         logicalId: removed.logicalId,
         status: "removed",
         sessionsKilled: removed.sessionsKilled,
+        ...(removed.sessionKeptFor ? { sessionKeptFor: removed.sessionKeptFor } : {}),
       });
     }
 
```

**File**: `packages/daemon/src/domain/rig-repository.ts` (modified, +9/-0)
```diff
@@ -517,6 +517,15 @@ export class RigRepository {
     return rows.map((r) => this.rowToRig(r));
   }
 
+  /** #174: seat-ref resolution sees only unarchived rigs, as default reads do since migration 042. */
+  findUnarchivedRigsByName(name: string): Rig[] {
+    const archived = this.hasRigColumn("archived_at") ? " AND archived_at IS NULL" : "";
+    const rows = this.db
+      .prepare(`SELECT * FROM rigs WHERE name = ?${archived} ORDER BY created_at`)
+      .all(name) as RigRow[];
+    return rows.map((r) => this.rowToRig(r));
+  }
+
   getRigSummaries(filter?: RigArchiveFilter): Array<{ id: string; name: string; nodeCount: number; latestSnapshotAt: string | null; latestSnapshotId: string | null; hasServices: boolean; archivedAt: string | null }> {
     const cond = archiveWhereClause("r.archived_at", filter);
     const where = cond ? `WHERE ${cond}` : "";
```

---

### Incident Patch 7: `e3ebd4ac` (2026-09-30)
**Commit Message**: fix(daemon): clean up unusable snapshot refresh helpers (#189)

* fix(daemon): a snapshot refresh probe never leaves its tmux session behind (#188)

`rig down` probes Claude resumability in a private `rigged-refresh-*`
tmux session. Two paths left it running, and every retry added another:

- After a seats' tmux server restart, the new server reuses pane ids,
  so a stale seat binding could name the probe's brand-new pane. The
  probe's kill then asked the guard to resolve the helper by name, which
  threw, and the unawaited write let the throw escape: the snapshot
  failed ("Cannot establish managed input target rigged-refresh-...")
  and the helper was never killed.
- When the new pane could not be proven, the probe returned failure
  without removing the session it had just created.

createProbeSession now refuses to use a probe whose new pane is named by
a managed record, or whose pane it cannot prove. It removes that helper
immediately, by the name this call just created. The probe write is
awaited, so a later refusal returns as a result instead of throwing.
Managed or changed targets are still never killed.

* fix(daemon): roll back an unusable probe only by the id its create

**File**: `packages/daemon/src/adapters/tmux.ts` (modified, +42/-5)
```diff
@@ -257,13 +257,49 @@ export class TmuxAdapter {
    * never authority over a pre-existing or registry-managed target. */
   async createProbeSession(name: string, cwd?: string): Promise<TmuxResult> {
     if (this.deliveryGuard?.maybeTarget(name)) return { ok: false, code: "guard_target_managed", message: "A probe cannot reuse a managed seat." };
-    const created = await this.createSessionUnchecked(name, cwd);
-    if (!created.ok) return created;
+    // #188: the create itself reports the new session's id and creation time, the only identity a rollback
+    // uses. An id alone is unique only for one server's lifetime.
+    let created: { id: string; at: string } | null;
+    try {
+      const out = await this.exec(`tmux new-session -d -P -F ${shellQuote("#{session_id} #{session_created}")} -s ${shellQuote(name)}${cwd != null ? ` -c ${shellQuote(cwd)}` : ""}`);
+      const match = /^(\$\d+) (\d+)$/.exec(out.trim());
+      created = match ? { id: match[1]!, at: match[2]! } : null;
+    } catch (err) {
+      return classifyWriteError(err);
+    }
+    let message = "New probe pane could not be established; no input written.";
+    let pane: string | null = null;
     try {
       const panes = await this.listPanes(name);
-      if (panes.length === 1) { this.freshProbes.set(name, panes[0]!.id); this.freshProbes.set(panes[0]!.id, panes[0]!.id); return created; }
+      pane = panes.length === 1 ? panes[0]!.id : null;
+      // #188: a fresh tmux server reuses pane ids, so a stale seat binding can name the new pane. That
+      // probe could not be cleaned up safely later, so it is not used.
+      if (pane && this.deliveryGuard?.maybeTarget(pane)) message = "New probe pane is named by a managed record; no input written.";
+      else if (pane) { this.freshProbes.set(name, pane); this.freshProbes.set(pane, pane); return { ok: true }; }
     } catch { /* no target proof, no input */ }
-    return { ok: false, code: "guard_target_unknown", message: "New probe pane could not be established; no input written." };
+    // #188: remove the unusable helper by the id its own create returned, unless a managed record has
+    // since claimed its name (a binding naming only the reused pane id, under another session name, is
+    // stale: that pane belongs to this session). A name reused by another session has a different id.
+    const byPane = pane ? this.deliveryGuard?.maybeTarget(pane) : null;
+    if (!created || this.deliveryGuard?.maybeTarget(name) || byPane?.session === name) {
+      return { ok: false, code: "guard_target_unknown", message: `${message} The helper session was left in place: its ownership could not be proven.` };
+    }
+    const removed = await this.removeCreatedSession(name, created);
+    if (!removed.ok && removed.code !== "session_not_found") message += ` The helper session was not removed: ${removed.message}`;
+    return { ok: false, code: "guard_target_unknown", message };
+  }
+
+  /** #188: kill the session this adapter created only while its id still names that session. tmux checks
+   *  the name and creation time and kills in one command, so a later server that reuses the id is safe. */
+  private async removeCreatedSession(name: string, created: { id: string; at: string }): Promise<TmuxResult> {
+    const same = `#{&&:#{==:#{session_name},${name}},#{==:#{session_created},${created.at}}}`;
+    try {
+      const out = await this.exec(`tmux if-shell -F -t ${shellQuote(created.id)} ${shellQuote(same)} ${shellQuote(`kill-session -t '${created.id}'`)} ${shellQuote("display-message -p kept")}`);
+      if (out.includes("kept")) return { ok: false, code: "guard_target_changed", message: `its id ${created.id} no longer names it (it may already be gone); nothing was killed.` };
+      return { ok: true };
+    } catch (err) {
+      return classifyWriteError(err);
+    }
   }
 
   private async guardedInput(target: string, write: (pane: string, beforeWrite: () => void) => Promise<TmuxResult>, allow
```

**File**: `packages/daemon/test/refresh-probe-cleanup.test.ts` (added, +241/-0)
```diff
@@ -0,0 +1,241 @@
+// #188 — the snapshot refresh's private Claude probe (`rigged-refresh-*`) must not outlive the probe.
+// Real ResumeMetadataRefresher + real TmuxAdapter + real SeatDeliveryGuard over a fixture DB; only the
+// tmux executor is faked, as a tiny in-memory tmux server. No real tmux is touched.
+import { describe, it, expect, beforeEach, afterEach } from "vitest";
+import type Database from "better-sqlite3";
+import { createFullTestDb } from "./helpers/test-app.js";
+import { RigRepository } from "../src/domain/rig-repository.js";
+import { SessionRegistry } from "../src/domain/session-registry.js";
+import { SeatDeliveryGuard, resolveGuardTarget } from "../src/domain/seat-delivery-guard.js";
+import { ResumeMetadataRefresher } from "../src/domain/resume-metadata-refresher.js";
+import { TmuxAdapter, type TmuxFileOps } from "../src/adapters/tmux.js";
+
+/** A minimal tmux: sessions with one pane each; pane ids count up from `firstPane` like a fresh server. */
+class FakeTmux {
+  sessions = new Map<string, { id: string; pane: string; created: number }>();
+  commands: string[] = [];
+  listPanesFails = false;
+  onCommand?: (command: string) => void;
+  private nextPane: number;
+  private nextSession = 1;
+  private clock = 1_790_000_000;
+  constructor(private firstPane = 0) { this.nextPane = firstPane; }
+
+  /** The server dies and a new one starts: no sessions, ids and pane ids count from the start again. */
+  resetServer(): void { this.sessions.clear(); this.nextSession = 1; this.nextPane = this.firstPane; }
+
+  /** Another client creates an unrelated session. */
+  create(name: string): void {
+    this.sessions.set(name, { id: `$${this.nextSession++}`, pane: `%${this.nextPane++}`, created: this.clock++ });
+  }
+
+  exec = async (command: string): Promise<string> => {
+    this.commands.push(command);
+    this.onCommand?.(command);
+    const target = /-t '([^']+)'/.exec(command)?.[1];
+    const byTarget = () => [...this.sessions.entries()].find(([name, s]) => name === target || s.pane === target || s.id === target);
+    if (command.startsWith("tmux new-session")) {
+      const name = /-s '([^']+)'/.exec(command)![1]!;
+      if (this.sessions.has(name)) throw new Error(`duplicate session: ${name}`);
+      this.create(name);
+      const made = this.sessions.get(name)!;
+      if (!command.includes(" -P")) return "";
+      return command.includes("session_created") ? `${made.id} ${made.created}\n` : `${made.id}\n`;
+    }
+    if (command.startsWith("tmux list-panes")) {
+      if (this.listPanesFails) throw new Error("list-panes: transient failure");
+      const found = byTarget();
+      if (!found) throw new Error(`can't find session: ${target}`);
+      return `${found[1].pane}|0|/tmp|80|24|1\n`;
+    }
+    if (command.startsWith("tmux display-message") && command.includes("session_id")) return `${byTarget()?.[1].id ?? ""}\n`;
+    if (command.startsWith("tmux display-message") && command.includes("pane_current_command")) return byTarget() ? "zsh\n" : "";
+    if (command.startsWith("tmux capture-pane")) return byTarget() ? "user@host ~ % \n" : "";
+    if (command.startsWith("tmux if-shell -F")) {
+      // Real tmux expands the format against the target session, then runs one branch in the same command.
+      const found = byTarget();
+      if (!found) throw new Error(`can't find session: ${target}`);
+      const wantName = /#\{==:#\{session_name\},([^}]+)\}/.exec(command)?.[1];
+      const wantCreated = /#\{==:#\{session_created\},(\d+)\}/.exec(command)?.[1];
+      if (found[0] === wantName && String(found[1].created) === wantCreated) { this.sessions.delete(found[0]); return ""; }
+      return "kept\n";
+    }
+    if (command.startsWith("tmux kill-session")) {
+      const found = byTarget();
+      if (!found) throw new Error(`can't find session: ${target}`);
+      this.sessions.delete(found[0]);
+      return "";
+    }
+    return "";
+  };
+
+  /** Kill `name` and start a d
```

---

### Incident Patch 8: `100be9d6` (2026-09-30)
**Commit Message**: fix: recognize managed Claude seats behind launch wrappers (#220)

* fix: recognize managed Claude behind shell wrappers

* fix: normalize observed Claude executable name

---------

Co-authored-by: dev-driver <dev-driver@openrig-build>

**File**: `packages/daemon/src/domain/native-process-lineage.ts` (modified, +47/-11)
```diff
@@ -68,6 +68,24 @@ function codexResumeToken(args: string[]): string | null | undefined {
   return null;
 }
 
+// Managed fresh/resume launches name the current Claude identity explicitly.
+// A fork's --resume names its parent, so it cannot prove the new occupant.
+function claudeSessionToken(args: string[]): string | null {
+  let token: string | null = null;
+  for (let index = 0; index < args.length; index += 1) {
+    const arg = args[index]!;
+    if (index === 0 && /^\(\d+\.\d+\.\d+[^)]*\)$/.test(arg)) continue;
+    if (["--permission-mode", "--model", "--name"].includes(arg)) { index += 1; continue; }
+    if (/^--(?:permission-mode|model|name)=/.test(arg) || arg === "--dangerously-skip-permissions") continue;
+    const identity = arg.match(/^--(?:session-id|resume)(?:=(.*))?$/);
+    if (!identity) return null; // Unknown argv is not positive identity proof.
+    const value = identity[1] ?? args[++index];
+    if (token !== null || !value || value.startsWith("-")) return null;
+    token = value;
+  }
+  return token;
+}
+
 /** Require a live process in the pane's own lineage whose argv names both the
  * declared runtime and the exact native resume identity. */
 export function findExactNativeResumeProcess(
@@ -76,7 +94,7 @@ export function findExactNativeResumeProcess(
   runtime: string | null,
   expectedToken: string,
 ): NativeProcessRow | null {
-  if (runtime === "codex") return selectCodexProcess(processes, panePid, expectedToken, true)?.process ?? null;
+  if (runtime === "codex") return selectNativeProcess(processes, panePid, expectedToken, true)?.process ?? null;
   if (runtime !== "claude-code") return null;
   const byParent = new Map<number, NativeProcessRow[]>();
   for (const process of processes) {
@@ -114,15 +132,18 @@ export async function listNativeProcesses(): Promise<NativeProcessRow[]> {
 }
 
 export type NativeProcessLister = () => NativeProcessRow[] | Promise<NativeProcessRow[]>;
-export type CodexProcessObservation = { panePid: number; process: NativeProcessRow; fingerprint: string };
+type NativeProcessObservation = { panePid: number; process: NativeProcessRow; fingerprint: string };
+export type CodexProcessObservation = NativeProcessObservation;
 
-function selectCodexProcess(rows: NativeProcessRow[], panePid: number, expectedToken?: string | null, requireResume = false): CodexProcessObservation | null {
+function selectNativeProcess(rows: NativeProcessRow[], panePid: number, expectedToken?: string | null, requireResume = false, runtime: NativeRuntime = "codex"): NativeProcessObservation | null {
   const byPid = new Map(rows.map((row) => [row.pid, row]));
   const root = byPid.get(panePid);
   if (byPid.size !== rows.length || !root?.startedAt || !root.tpgid || root.tpgid <= 0) return null;
   const matches: { process: NativeProcessRow; chain: NativeProcessRow[] }[] = [];
+  const executable = runtime === "claude-code" ? "claude" : "codex";
   for (const row of rows) {
-    if (row.executableName !== "codex" || executableName(tokens(row.command)[0] ?? "") !== "codex"
+    const osExecutable = runtime === "claude-code" ? executableName(row.executableName ?? "") : row.executableName;
+    if (osExecutable !== executable || executableName(tokens(row.command)[0] ?? "") !== executable
       || row.pgid !== root.tpgid || row.tpgid !== root.tpgid) continue;
     const chain: NativeProcessRow[] = [];
     const visited = new Set<number>();
@@ -136,31 +157,46 @@ function selectCodexProcess(rows: NativeProcessRow[], panePid: number, expectedT
   }
   if (matches.length !== 1) return null;
   const { process, chain } = matches[0]!;
-  const resumeToken = codexResumeToken(tokens(process.command).slice(1));
-  if (requireResume && !expectedToken) return null;
-  if ((requireResume || (expectedToken !== undefined && resumeToken !== undefined))
-    && (!expectedToken || resumeToken !== expectedToken)) return null;
+  if (runtime === "claude-code") {
+    if (!expectedToken || claudeSessionToken(t
```

**File**: `packages/daemon/src/domain/session-transport.ts` (modified, +7/-6)
```diff
@@ -11,7 +11,7 @@ import { wrapPaneEnvelope, appendDeliveredSegment, type EnvelopeScope } from "..
 import { getSelfHostId } from "./hosts/fanout-contract.js";
 import { SeatIdentityStore } from "./seat-identity-store.js";
 import { isShellForeground } from "./shell-classifier.js";
-import { verifyCodexPaneProcess, type NativeProcessLister } from "./native-process-lineage.js";
+import { verifyClaudePaneProcess, verifyCodexPaneProcess, type NativeProcessLister } from "./native-process-lineage.js";
 import type { SlowOperationInstrumentation } from "./slow-op-recorder.js";
 import { hashSentText, type CaptureObserverSink, type CaptureSlot, type ObservationInput, type ObservedBinding } from "./capture-observer.js";
 
@@ -993,7 +993,7 @@ export class SessionTransport {
     }
 
     // #142 — an agent seat whose runtime is not running shows a bare shell, and text typed there runs as
-    // shell commands. A Codex launch wrapper can have the same label: only positive native
+    // shell commands. A managed launch wrapper can have the same label: only positive native
     // process proof clears that refusal. A terminal's shell is its runtime; unreadable stays advisory.
     const bareShell = runtime && runtime !== "terminal"
       ? await this.bareShellForeground(sessionName, runtime, sessionMeta.pane, sessionMeta.resumeToken) : null;
@@ -1450,11 +1450,12 @@ export class SessionTransport {
       return null;
     }
     if (!paneCommand || !isShellForeground(paneCommand)) return null;
-    if (runtime === "codex" && pane) {
-      // Reuse the identity reconciler's stable, foreground, pane-descendant proof.
-      // A resumed process must also name this session's token. Stale UI, a Node
+    if ((runtime === "codex" || runtime === "claude-code") && pane) {
+      // Reuse stable, foreground, pane-descendant proof. Claude fresh/resume and
+      // Codex resume must name this session's token. Stale UI, a Node
       // launcher alone, missing observations or a native process elsewhere cannot clear it.
-      const native = await verifyCodexPaneProcess({ target: sessionName, tmux: this.tmuxAdapter,
+      const verify = runtime === "codex" ? verifyCodexPaneProcess : verifyClaudePaneProcess;
+      const native = await verify({ target: sessionName, tmux: this.tmuxAdapter,
         listProcesses: this.listProcesses, expectedToken: resumeToken });
       if (native && await this.tmuxAdapter.getPanePid(pane).catch(() => null) === native.panePid) return null;
     }
```

**File**: `packages/daemon/test/send-runtime-not-running.test.ts` (modified, +109/-0)
```diff
@@ -5,6 +5,11 @@ import type Database from "better-sqlite3";
 import { RigRepository } from "../src/domain/rig-repository.js";
 import { SessionRegistry } from "../src/domain/session-registry.js";
 import { SessionTransport } from "../src/domain/session-transport.js";
+import { QueueRepository } from "../src/domain/queue-repository.js";
+import { EventBus } from "../src/domain/event-bus.js";
+import { OutboxHandler } from "../src/domain/outbox-handler.js";
+import { migrate } from "../src/db/migrate.js";
+import { outboxEntriesSchema } from "../src/db/migrations/027_outbox_entries.js";
 import {
   makeParkedOwnerConsumerPolicy,
   makeRigAnchor,
@@ -163,6 +168,110 @@ describe("#142 transport refuses to type into a bare shell where an agent runtim
     expect(sendKeys).not.toHaveBeenCalled();
   });
 
+  // #197: reported pane -> managed sh -> native Claude. The OS metadata is
+  // synthetic; argv follows the managed fresh/resume commands in the adapter.
+  function claudeProcesses(identity = `--session-id ${nativeToken}`): NativeProcessRow[] {
+    return wrapperProcesses().filter(row => row.pid !== 1199).map(row => row.pid === 1205
+      ? { ...row, ppid: 1196, executableName: "claude",
+        command: `/opt/bin/claude --permission-mode auto ${identity} --name dev-check@my-rig` } : row);
+  }
+
+  function wrappedClaude(listProcesses = vi.fn(async () => claudeProcesses())) {
+    const { node, session } = seat("claude-code", "dev-check@my-rig");
+    sessionRegistry.updateBinding(node.id, { tmuxSession: "dev-check@my-rig", tmuxPane: "%1" });
+    sessionRegistry.updateResumeToken(session.id, "claude_id", nativeToken);
+    const ports = tmuxWithPane(async () => "sh");
+    ports.tmux.getPanePid = vi.fn(async () => 1135);
+    return { ...ports, node, session, listProcesses,
+      transport: new SessionTransport({ db, rigRepo, sessionRegistry, tmuxAdapter: ports.tmux, listProcesses, sleep: async () => {} }) };
+  }
+
+  it.each(["fresh", "resume", "versioned process title", "queue nudge"])("#197 wrapped Claude receives %s", async kind => {
+    const rows = claudeProcesses(kind === "resume" ? `--resume ${nativeToken}` : `--session-id ${nativeToken}`);
+    if (kind === "versioned process title") rows.at(-1)!.command = rows.at(-1)!.command.replace("/opt/bin/claude", "claude (2.1.284)");
+    const { transport, sendText, sendKeys, listProcesses } = wrappedClaude(vi.fn(async () => rows));
+    const result = await transport.send("dev-check@my-rig", "existing review", {
+      verify: true, ...(kind === "queue nudge" ? { actorSession: "dev-owner@my-rig", auditPointer: "existing-review", deliveryId: "nudge-claude" } : {}),
+    });
+    expect(result.ok).toBe(true);
+    expect(sendText).toHaveBeenCalledOnce();
+    expect(sendKeys).toHaveBeenCalledOnce();
+    expect(listProcesses).toHaveBeenCalledTimes(2);
+  });
+
+  // #197 C1: Root observed macOS ucomm "claude.exe" with argv basename
+  // "claude". A versioned argv fixture alone did not exercise this OS-name axis.
+  it.each(["--session-id", "--resume"])("#197 accepts observed Claude OS name with %s", async identityFlag => {
+    const rows = claudeProcesses().map(row => row.pid === 1205
+      ? { ...row, executableName: "claude.exe",
+        command: `/opt/runtime/bin/claude --permission-mode acceptEdits --model claude-opus-5-5 ${identityFlag} ${nativeToken} --name dev-check@my-rig` } : row);
+    const { transport, sendText, sendKeys, listProcesses } = wrappedClaude(vi.fn(async () => rows));
+    expect((await transport.send("dev-check@my-rig", "existing review")).ok).toBe(true);
+    expect(sendText).toHaveBeenCalledOnce();
+    expect(sendKeys).toHaveBeenCalledOnce();
+    expect(listProcesses).toHaveBeenCalledTimes(2);
+  });
+
+  const unprovedClaude: [string, (rows: NativeProcessRow[]) => NativeProcessRow[]][] = [
+    ...unproved,
+    ["wrong Claude identity", rows => rows.map(r => r.pid === 1205 ? { ...r, command: "/opt/bin/claude --session-id other" } : r)]
```

---

### Incident Patch 9: `f8f3aff6` (2026-09-30)
**Commit Message**: fix(transport): recognize proven Codex behind shell wrappers (#171)

Co-authored-by: dev-driver <dev-driver@openrig-build>

**File**: `packages/daemon/src/domain/session-transport.ts` (modified, +25/-8)
```diff
@@ -11,6 +11,7 @@ import { wrapPaneEnvelope, appendDeliveredSegment, type EnvelopeScope } from "..
 import { getSelfHostId } from "./hosts/fanout-contract.js";
 import { SeatIdentityStore } from "./seat-identity-store.js";
 import { isShellForeground } from "./shell-classifier.js";
+import { verifyCodexPaneProcess, type NativeProcessLister } from "./native-process-lineage.js";
 import type { SlowOperationInstrumentation } from "./slow-op-recorder.js";
 import { hashSentText, type CaptureObserverSink, type CaptureSlot, type ObservationInput, type ObservedBinding } from "./capture-observer.js";
 
@@ -543,11 +544,12 @@ interface SessionTransportDeps {
   activityEndpointFile?: () => { baseUrl: string; token: string } | null;
   /** S01/S02 P2: optional read-only capture observer. Absent by default (no activation). */
   captureObserver?: CaptureObserverSink;
+  listProcesses?: NativeProcessLister;
 }
 
 interface SessionRow { node_id: string; session_name: string; }
 interface NodeRow { rig_id: string; logical_id: string; }
-interface SessionMetaRow { runtime: string | null; attachment_type: string | null; node_id: string | null; binding_session: string | null; pane: string | null; occupant: string | null; }
+interface SessionMetaRow { runtime: string | null; attachment_type: string | null; node_id: string | null; binding_session: string | null; pane: string | null; occupant: string | null; resume_token: string | null; }
 interface ResolvedTarget { sessionName: string; rigName: string; nodeLogicalId: string; }
 
 export class SessionTransport {
@@ -564,6 +566,7 @@ export class SessionTransport {
   private slowOpRecorder?: SlowOperationInstrumentation;
   private activityEndpointFile: () => { baseUrl: string; token: string } | null;
   private captureObserver?: CaptureObserverSink;
+  private listProcesses?: NativeProcessLister;
 
   constructor(deps: SessionTransportDeps) {
     this.db = deps.db;
@@ -579,6 +582,7 @@ export class SessionTransport {
     this.slowOpRecorder = deps.slowOpRecorder;
     this.activityEndpointFile = deps.activityEndpointFile ?? (() => null);
     this.captureObserver = deps.captureObserver;
+    this.listProcesses = deps.listProcesses;
   }
 
   /**
@@ -626,7 +630,7 @@ export class SessionTransport {
   }
 
   private getSessionMeta(sessionName: string): {
-    runtime: string | null; attachmentType: string | null; nodeId: string | null; pane: string | null; occupant: string | null;
+    runtime: string | null; attachmentType: string | null; nodeId: string | null; pane: string | null; occupant: string | null; resumeToken: string | null;
   } {
     // One existing statement; P2 reads the binding columns it already joins plus the
     // same current-occupant subselect the delivery guard uses. No extra query.
@@ -637,6 +641,7 @@ export class SessionTransport {
         n.id AS node_id,
         b.tmux_session AS binding_session,
         b.tmux_pane AS pane,
+        s.resume_token AS resume_token,
         (SELECT generation_uuid FROM occupant_tenures t WHERE t.node_id = n.id ORDER BY generation_ordinal DESC LIMIT 1) AS occupant
       FROM sessions s
       JOIN nodes n ON s.node_id = n.id
@@ -654,6 +659,7 @@ export class SessionTransport {
       // binding whose session IS this name labels pane/occupant; otherwise unknown.
       pane: row?.binding_session === sessionName ? row?.pane ?? null : null,
       occupant: row?.binding_session === sessionName ? row?.occupant ?? null : null,
+      resumeToken: row?.resume_token ?? null,
     };
   }
 
@@ -987,9 +993,10 @@ export class SessionTransport {
     }
 
     // #142 — an agent seat whose runtime is not running shows a bare shell, and text typed there runs as
-    // shell commands. That is positive evidence, like an interactive prompt, so refuse before any write.
-    // A terminal node's shell is its runtime; an unknown runtime or unreadable pane stays advisory.
-    const bareShell = runtime && runtime !== "terminal" ? await this.bareShellFore
```

**File**: `packages/daemon/test/send-runtime-not-running.test.ts` (modified, +82/-0)
```diff
@@ -18,6 +18,7 @@ import type { PolicyJob } from "../src/domain/policies/types.js";
 import type { WatchdogHistoryEntry } from "../src/domain/watchdog-history-log.js";
 import type { TmuxAdapter } from "../src/adapters/tmux.js";
 import { createFullTestDb } from "./helpers/test-app.js";
+import type { NativeProcessRow } from "../src/domain/native-process-lineage.js";
 
 function tmuxWithPane(getPaneCommand: () => Promise<string | null>) {
   const sendText = vi.fn(async () => ({ ok: true as const }));
@@ -52,6 +53,7 @@ describe("#142 transport refuses to type into a bare shell where an agent runtim
     const session = sessionRegistry.registerSession(node.id, name);
     sessionRegistry.updateStatus(session.id, "running");
     sessionRegistry.updateBinding(node.id, { tmuxSession: name });
+    return { node, session };
   }
 
   // The watchdog's deliver() makes exactly this call (startup.ts parked-owner delivery).
@@ -81,6 +83,86 @@ describe("#142 transport refuses to type into a bare shell where an agent runtim
     expect(sendText).toHaveBeenCalledOnce();
   });
 
+  // 2026-09-29 guest: the ready checker still read as bash at the #142 guard.
+  // Model its pane -> sh -> Node launcher -> native Codex chain. Process-group
+  // and start-time values below are synthetic; native execution remains a separate check.
+  const nativeToken = "01a0ef72-c681-7a21-abc6-c0bdd0a3bc98";
+  function wrapperProcesses(): NativeProcessRow[] {
+    const startedAt = "Tue Sep 29 23:33:00 2026";
+    return [
+      { pid: 1135, ppid: 1, pgid: 1135, tpgid: 1196, executableName: "zsh", command: "-zsh", startedAt },
+      { pid: 1196, ppid: 1135, pgid: 1196, tpgid: 1196, executableName: "bash", command: "/bin/sh /tmp/launch.txt", startedAt },
+      { pid: 1199, ppid: 1196, pgid: 1196, tpgid: 1196, executableName: "node", command: `node /opt/bin/codex resume ${nativeToken}`, startedAt },
+      { pid: 1205, ppid: 1199, pgid: 1196, tpgid: 1196, executableName: "codex", command: `/opt/native/codex resume ${nativeToken}`, startedAt },
+    ];
+  }
+
+  function wrappedSeat(listProcesses = vi.fn(async () => wrapperProcesses())) {
+    const { node, session } = seat("codex", "dev-check@my-rig");
+    sessionRegistry.updateBinding(node.id, { tmuxSession: "dev-check@my-rig", tmuxPane: "%1" });
+    sessionRegistry.updateResumeToken(session.id, "codex", nativeToken);
+    const ports = tmuxWithPane(async () => "bash");
+    ports.tmux.getPanePid = vi.fn(async () => 1135);
+    const deps = { db, rigRepo, sessionRegistry, tmuxAdapter: ports.tmux, listProcesses, sleep: async () => {} };
+    return { ...ports, node, session, listProcesses, transport: new SessionTransport(deps) };
+  }
+
+  it.each(["ordinary verified send", "queue nudge", "watchdog wake"])("wrapped native Codex receives %s", async kind => {
+    const { transport, sendText, sendKeys, listProcesses } = wrappedSeat();
+    const result = kind === "watchdog wake"
+      ? await watchdogSend(transport, "dev-check@my-rig")
+      : await transport.send("dev-check@my-rig", "existing review", {
+        verify: true, ...(kind === "queue nudge" ? { actorSession: "dev-owner@my-rig", auditPointer: "existing-review", deliveryId: "nudge-1" } : {}),
+      });
+    expect(result.ok).toBe(true);
+    expect(sendText).toHaveBeenCalledOnce();
+    expect(sendKeys).toHaveBeenCalledOnce();
+    expect(listProcesses).toHaveBeenCalledTimes(2);
+  });
+
+  it("proven native wrapper still refuses an approval prompt", async () => {
+    const { transport, tmux, sendText, sendKeys } = wrappedSeat();
+    tmux.capturePaneContent = async () => "Would you like to run the following command?\n› 1. Yes, proceed (y)\n2. No\nPress enter to confirm or esc to cancel";
+    expect(await transport.send("dev-check@my-rig", "existing review")).toMatchObject({ ok: false, reason: "target_needs_input" });
+    expect(sendText).not.toHaveBeenCalled();
+    expect(sendKeys).not.toHaveBeenCalled();
+  });
+
+  it("allows a fresh 
```

---

### Incident Patch 10: `1618bab0` (2026-09-29)
**Commit Message**: fix(daemon): bound overlapping identity and transcript polls (#169)

Co-authored-by: dev-driver <dev-driver@openrig-build>

**File**: `packages/daemon/src/domain/seat-identity-reconciler.ts` (modified, +23/-1)
```diff
@@ -96,6 +96,8 @@ export class SeatIdentityReconciler {
   private readonly store: SeatIdentityStore;
   private readonly listProcesses: NativeProcessLister;
   private timer: ReturnType<typeof setInterval> | null = null;
+  private reconciling = false;
+  private generation = 0;
 
   constructor(deps: SeatIdentityReconcilerDeps) {
     this.db = deps.db;
@@ -121,6 +123,18 @@ export class SeatIdentityReconciler {
 
   /** Reconcile every running tmux-bound seat once and persist the verdicts. */
   async reconcileAll(): Promise<void> {
+    // Skip ticks while actual reads are pending; never release on a deadline
+    // that could leave subprocesses alive. Normal polling cost is unchanged.
+    if (this.reconciling) return;
+    this.reconciling = true;
+    try {
+      await this.reconcileSweep(this.generation);
+    } finally {
+      this.reconciling = false;
+    }
+  }
+
+  private async reconcileSweep(generation: number): Promise<void> {
     const seats = this.runningSeats();
     // Prune verdicts for nodes no longer running (keep the table bounded).
     this.store.pruneExcept(seats.map((s) => s.node_id));
@@ -139,6 +153,7 @@ export class SeatIdentityReconciler {
     } catch {
       liveSessions = null;
     }
+    if (generation !== this.generation) return;
     if (liveSessions === null || liveSessions.size === 0) {
       for (const seat of seats) {
         this.store.upsert(this.tmuxUnavailableVerdict(seat, observedAt));
@@ -157,13 +172,18 @@ export class SeatIdentityReconciler {
       })));
     };
     const first = await sample();
+    if (generation !== this.generation) return;
     const second = await sample();
+    if (generation !== this.generation) return;
     const codexProofs = new Map(codexSeats.map((seat, index) => [seat.node_id,
       first[index] && first[index]?.fingerprint === second[index]?.fingerprint ? second[index]! : null]));
     for (const seat of seats) {
       try {
-        this.store.upsert(await this.computeVerdict(seat, liveSessions, observedAt, codexProofs.get(seat.node_id) ?? null));
+        const verdict = await this.computeVerdict(seat, liveSessions, observedAt, codexProofs.get(seat.node_id) ?? null);
+        if (generation !== this.generation) return;
+        this.store.upsert(verdict);
       } catch {
+        if (generation !== this.generation) return;
         // A single seat's tmux failure must not crash the loop; record it as
         // unavailable observation (non-green for Codex).
         this.store.upsert(this.tmuxUnavailableVerdict(seat, observedAt));
@@ -273,6 +293,8 @@ export class SeatIdentityReconciler {
 
   /** Stop the scheduler. Safe to call before start or multiple times. */
   stop(): void {
+    // Fence old observations without releasing their flight before settlement.
+    this.generation++;
     if (this.timer) {
       clearInterval(this.timer);
       this.timer = null;
```

**File**: `packages/daemon/src/domain/transcript-rotation.ts` (modified, +9/-3)
```diff
@@ -47,6 +47,9 @@ function parsePositiveInt(raw: string | undefined, fallback: number): number {
 }
 
 const activeTimers = new Map<string, NodeJS.Timeout>();
+// Shared across replacing starts: a stopped capture can still own a child.
+// ponytail: bound overlap per session, leaving normal non-overlapping cost unchanged.
+const capturingSessions = new Set<string>();
 
 // Liveness decoupled from the file mtime. A COMPLETED HEALTHY tick records a
 // timestamp here — on the unchanged-content early return (the file already holds
@@ -72,8 +75,8 @@ export function getLastCaptureAt(sessionName: string): number | undefined {
 
 /** Start a per-session capture-pane rotation timer. Idempotent: a
  *  second start for the same session replaces the first timer. The
- *  first tick fires immediately so the transcript file is populated
- *  before the first poll interval elapses. */
+ *  first tick fires immediately unless an old capture for this session is
+ *  still pending; replacement then waits for a scheduled tick after it settles. */
 export function startTranscriptRotation(
   tmuxAdapter: TmuxAdapter,
   sessionName: string,
@@ -90,8 +93,9 @@ export function startTranscriptRotation(
   const isCurrent = (): boolean => activeGeneration.get(sessionName) === myGeneration;
 
   const tick = async (): Promise<void> => {
+    if (!isCurrent() || capturingSessions.has(sessionName)) return;
+    capturingSessions.add(sessionName);
     try {
-      if (!isCurrent()) return;
       const content = await tmuxAdapter.capturePaneContent(sessionName, opts.lines);
       // Re-check AFTER the async capture: stop()/replacement may have run while we
       // awaited. A dead session (null) is deliberately not recorded either way,
@@ -146,6 +150,8 @@ export function startTranscriptRotation(
       // Best-effort capture: target session may have died, output path
       // may be unwritable, etc. The next tick retries; failure here
       // does not bubble up to the daemon's launch / lifecycle paths.
+    } finally {
+      capturingSessions.delete(sessionName);
     }
   };
 
```

**File**: `packages/daemon/test/seat-identity-reconciler.test.ts` (modified, +94/-0)
```diff
@@ -341,3 +341,97 @@ describe("seat_identity_verdicts schema (migration 046)", () => {
     db.close();
   });
 });
+
+
+describe("SeatIdentityReconciler — bounded polling", () => {
+  it("holds one sweep through delayed listing and verdict reads, then observes a changed occupant", async () => {
+    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
+    const db = createFullTestDb();
+    seedSeat(db, { nodeId: "n1", sessionName: "s1@rig", pane: "%1" });
+    const tmux = makeTmux({ sessions: ["s1@rig"], panePid: { "%1": 42 }, paneCommand: { "%1": "zsh" } });
+    let releaseList!: () => void;
+    let releaseCommand!: () => void;
+    const listGate = new Promise<void>((resolve) => { releaseList = resolve; });
+    const commandGate = new Promise<void>((resolve) => { releaseCommand = resolve; });
+    vi.mocked(tmux.listSessions).mockImplementationOnce(async () => {
+      await listGate;
+      return [{ name: "s1@rig", windows: 1, created: "", attached: false }];
+    });
+    vi.mocked(tmux.getPaneCommand).mockImplementationOnce(async () => { await commandGate; return "claude"; });
+    const rec = new SeatIdentityReconciler({ db, tmux });
+    const store = new SeatIdentityStore(db);
+    rec.start(100);
+    try {
+      await vi.advanceTimersByTimeAsync(2000);
+      // Twenty ticks, but the first availability read is still outstanding.
+      expect(tmux.listSessions).toHaveBeenCalledTimes(1);
+      expect(store.getForNode("n1")).toBeNull();
+      releaseList();
+      await vi.advanceTimersByTimeAsync(1000);
+      // The guard covers the whole sweep, not only its availability probe.
+      expect(tmux.listSessions).toHaveBeenCalledTimes(1);
+      expect(tmux.getPaneCommand).toHaveBeenCalledTimes(1);
+      expect(store.getForNode("n1")).toBeNull();
+      releaseCommand();
+      await new Promise((resolve) => setImmediate(resolve));
+      expect(store.getForNode("n1")?.verdict).toBe("verified");
+      await vi.advanceTimersByTimeAsync(100);
+      expect(tmux.listSessions).toHaveBeenCalledTimes(2);
+      expect(store.getForNode("n1")?.verdict).toBe("mismatch");
+    } finally {
+      rec.stop(); releaseList(); releaseCommand();
+      await new Promise((resolve) => setImmediate(resolve));
+      vi.useRealTimers(); db.close();
+    }
+  });
+
+  it("stop/restart fences a pending native observation without releasing its flight early", async () => {
+    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
+    const db = createFullTestDb();
+    seedSeat(db, { nodeId: "c1", sessionName: "c1@rig", pane: "%1", runtime: "codex" });
+    const tmux = makeTmux({ sessions: ["c1@rig"], panePid: { "%1": 10 }, paneCommand: { "%1": "codex" } });
+    const rows = [{ pid: 10, ppid: 1, pgid: 10, tpgid: 10, executableName: "codex", command: "codex", startedAt: "Sat Jan  1 12:00:00 2000" }];
+    let release!: () => void;
+    const gate = new Promise<void>((resolve) => { release = resolve; });
+    const listProcesses = vi.fn(async () => rows).mockImplementationOnce(async () => { await gate; return rows; });
+    const rec = new SeatIdentityReconciler({ db, tmux, listProcesses });
+    const store = new SeatIdentityStore(db);
+    rec.start(100);
+    try {
+      await vi.advanceTimersByTimeAsync(100);
+      expect(listProcesses).toHaveBeenCalledTimes(1);
+      rec.stop(); rec.start(100);
+      await vi.advanceTimersByTimeAsync(1000);
+      expect(tmux.listSessions).toHaveBeenCalledTimes(1);
+      release();
+      await new Promise((resolve) => setImmediate(resolve));
+      expect(store.getForNode("c1")).toBeNull();
+      expect(listProcesses).toHaveBeenCalledTimes(1);
+      await vi.advanceTimersByTimeAsync(100);
+      expect(listProcesses).toHaveBeenCalledTimes(3); // two fresh observations
+      expect(store.getForNode("c1")?.verdict).toBe("verified");
+    } finally {
+      rec.stop(); release();
+      await new Promise((resolve) => setImmediate(resolve));
+      
```

**File**: `packages/daemon/test/transcript-rotation.test.ts` (modified, +92/-30)
```diff
@@ -38,6 +38,7 @@ beforeEach(() => {
 
 afterEach(() => {
   clearAllTranscriptRotationsForTest();
+  vi.useRealTimers();
   if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
   // Clear env var overrides set by individual tests.
   delete process.env.OPENRIG_TRANSCRIPTS_LINES;
@@ -323,38 +324,99 @@ describe("startTranscriptRotation — generation guard (r2 HIGH-2: in-flight tic
     expect(fs.existsSync(outputPath)).toBe(false); // no write after stop
   });
 
-  it("a stale in-flight tick from a REPLACED start does not clobber the newer rotation", async () => {
-    let resolveFirst!: (v: string) => void;
-    const firstCapture = new Promise<string>((res) => {
-      resolveFirst = res;
-    });
+  it("a replaced start waits for the old capture to settle and never publishes its stale bytes", async () => {
+    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
+    let release!: (v: string) => void;
+    const firstCapture = new Promise<string>((resolve) => { release = resolve; });
     const adapterA = { capturePaneContent: vi.fn(() => firstCapture) };
-    const outputPath = path.join(tmpDir, "rig", "s.log");
-
-    startTranscriptRotation(
-      adapterA as unknown as TmuxAdapter,
-      "s@rig",
-      outputPath,
-      { lines: 1000, pollIntervalMs: 60_000 },
-    );
-    // First tick in-flight; REPLACE with a new start whose capture resolves at once.
-    const adapterB = { capturePaneContent: vi.fn(async () => "new-gen\n") };
-    startTranscriptRotation(
-      adapterB as unknown as TmuxAdapter,
-      "s@rig",
-      outputPath,
-      { lines: 1000, pollIntervalMs: 60_000 },
-    );
-    await new Promise((r) => setImmediate(r));
-    expect(getLastCaptureAt("s@rig")).toBeDefined();
-    expect(fs.readFileSync(outputPath, "utf8")).toBe("new-gen\n");
+    const adapterB = makeFakeAdapter("new-gen\n");
+    const outputPath = path.join(tmpDir, "s.log");
+    const opts = { lines: 1000, pollIntervalMs: 100 };
+    startTranscriptRotation(adapterA as unknown as TmuxAdapter, "s@rig", outputPath, opts);
+    startTranscriptRotation(adapterB as unknown as TmuxAdapter, "s@rig", outputPath, opts);
+    try {
+      await vi.advanceTimersByTimeAsync(1000);
+      expect(adapterA.capturePaneContent).toHaveBeenCalledTimes(1);
+      expect(adapterB.capturePaneContent).not.toHaveBeenCalled();
+      expect(getLastCaptureAt("s@rig")).toBeUndefined();
+      expect(fs.existsSync(outputPath)).toBe(false);
+      release("old-gen\n");
+      await new Promise((resolve) => setImmediate(resolve));
+      expect(getLastCaptureAt("s@rig")).toBeUndefined();
+      expect(fs.existsSync(outputPath)).toBe(false);
+      await vi.advanceTimersByTimeAsync(100);
+      expect(adapterB.capturePaneContent).toHaveBeenCalledTimes(1);
+      expect(fs.readFileSync(outputPath, "utf8")).toBe("new-gen\n");
+      expect(getLastCaptureAt("s@rig")).toBe(Date.now());
+    } finally {
+      stopTranscriptRotation("s@rig"); release("old-gen\n");
+      await new Promise((resolve) => setImmediate(resolve));
+    }
+  });
+});
 
-    // Now resolve A's stale capture — it must NOT overwrite B's file or record.
-    resolveFirst("old-gen\n");
-    await new Promise((r) => setImmediate(r));
-    await new Promise((r) => setImmediate(r));
-    expect(fs.readFileSync(outputPath, "utf8")).toBe("new-gen\n");
+describe("startTranscriptRotation — bounded polling", () => {
+  it("holds at most one capture per delayed session without blocking another session", async () => {
+    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
+    let release!: () => void;
+    const gate = new Promise<void>((resolve) => { release = resolve; });
+    const adapter = { capturePaneContent: vi.fn(async (session: string) => {
+      if (session !== "fast@rig") await gate;
+      return session;
+    }) };
+    const opts = { lines: 1000, pollIntervalMs: 100 };
+    for (const session of ["a@rig", "b@rig", "fast
```

#### Recent Merged Pull Requests:
- **PR #225** (2026-09-30): fix(claude): preserve native config selection for explicit modes (@mvschwarz)
- **PR #224** (2026-09-30): docs(contributing): ask security and integration PRs for practical scenarios (@mvschwarz)
- **PR #223** (2026-09-30): chore(release): prepare 0.6.3 regression repair patch (@mvschwarz)
- **PR #221** (2026-09-30): fix(ci): serialize script tests that share build outputs (@mvschwarz)
- **PR #220** (2026-09-30): fix: recognize managed Claude seats behind launch wrappers (@mvschwarz)
- **PR #219** (closed): fix(transport): clear managed Claude behind shell wrappers with native proof (@JoAdo07)
- **PR #190** (closed): fix(daemon): kill the probe session when its pane cannot be proven (@z4cc)
- **PR #189** (2026-09-30): fix(daemon): clean up unusable snapshot refresh helpers (@mvschwarz)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
