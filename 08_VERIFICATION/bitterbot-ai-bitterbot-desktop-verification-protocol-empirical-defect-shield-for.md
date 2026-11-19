# Verification Protocol: Verification Protocol: Empirical Defect Shield for Bitterbot-AI/bitterbot-desktop

<!-- PROVENANCE_START
{
  "source_repository": "Bitterbot-AI/bitterbot-desktop",
  "source_url": "https://github.com/Bitterbot-AI/bitterbot-desktop",
  "source_version": "12f3d096",
  "license": "MIT",
  "timestamp": "2026-11-19T20:55:56.022Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-bitterbot-ai-bitterbot-desktop",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop) (Revision: `12f3d096`).  
> **License**: MIT | **Timestamp**: `2026-11-19T20:55:56.022Z`  
> **Learning ID**: `learn-github-bitterbot-ai-bitterbot-desktop`


## 1. Scope & Verification Target
- **Target Repository**: `Bitterbot-AI/bitterbot-desktop` (Commit: `12f3d096`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): Bitterbot-AI/bitterbot-desktop

> **Canonical Artifact**: `07_PROJECT_LEARNING/bitterbot-ai-bitterbot-desktop-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T20:55:55.330Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Bitterbot-AI/bitterbot-desktop`
- **Description**: Bitterbot - a mesh of agents that turns shared experience into collective capability.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2480 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/arc-agi-3/actions/close-scorecard.ts`
```
#!/usr/bin/env -S node --import=tsx
/**
 * actions/close-scorecard.ts
 *
 * Closes the current scorecard (or one passed via --card), prints the
 * returned URL, clears config.currentCardId.
 *
 * Usage:
 *   node --import=tsx actions/close-scorecard.ts [--card CARD_ID]
 */

import { parseArgs } from "node:util";
import { ArcClient } from "../src/arc-client.js";
import { readConfig, updateScorecardClose, writeConfig } from "../src/state.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { card: { type: "string", default: "" } },
    strict: false,
  });
  const cfg = readConfig();
  const cardId = values.card || cfg.currentCardId;
  if (!cardId) {
    console.error("No card_id (set --card or open one first via open-scorecard.ts).");
    process.exit(2);
  }
  const client = new ArcClient();
  const summary = await client.closeScorecard(cardId);
  updateScorecardClose(cardId, new Date().toISOString(), summary.scorecard_url);
  if (cfg.currentCardId === cardId) {
    cfg.currentCardId = undefined;
    writeConfig(cfg);
  }
  console.log(`Closed scorecard ${cardId}`);
  if (summary.scorecard_url) {
    console.log(`  URL: ${summary.scorecard_url}`);
  }
  if (summary.score !== undefined) {
    console.log(`  Score: ${summary.score}`);
  }
  console.log(`  Runs: ${summary.runs.length}`);
}

main().catch((err) => {
  console.error("close-scorecard failed:", err);
  process.exit(1);
});

```

### Core Architecture Module: `benchmarks/arc-agi-3/actions/get-scorecard.ts`
```
#!/usr/bin/env -S node --import=tsx
/**
 * actions/get-scorecard.ts
 *
 * Fetches the current scorecard's state (or one passed via --card,
 * optionally scoped to --game).
 *
 * Usage:
 *   node --import=tsx actions/get-scorecard.ts [--card CARD_ID] [--game GAME_ID]
 */

import { parseArgs } from "node:util";
import { ArcClient } from "../src/arc-client.js";
import { readConfig } from "../src/state.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      card: { type: "string", default: "" },
      game: { type: "string", default: "" },
    },
    strict: false,
  });
  const cfg = readConfig();
  const cardId = values.card || cfg.currentCardId;
  if (!cardId) {
    console.error("No card_id (set --card or open one first via open-scorecard.ts).");
    process.exit(2);
  }
  const client = new ArcClient();
  const summary = await client.getScorecard(cardId, values.game || undefined);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("get-scorecard failed:", err);
  process.exit(1);
});

```

### Core Architecture Module: `benchmarks/arc-agi-3/actions/open-scorecard.ts`
```
#!/usr/bin/env -S node --import=tsx
/**
 * actions/open-scorecard.ts
 *
 * Opens a new scorecard and stores `card_id` in config.json.
 *
 * Usage:
 *   node --import=tsx actions/open-scorecard.ts [--tags TAG[,TAG...]] [--source-url URL] [--opaque JSON]
 */

import { parseArgs } from "node:util";
import { ArcClient } from "../src/arc-client.js";
import { appendScorecard, readConfig, writeConfig } from "../src/state.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      tags: { type: "string", default: "" },
      "source-url": { type: "string", default: "" },
      opaque: { type: "string", default: "" },
    },
    strict: false,
  });
  const tags = (values.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  let opaqueObj: Record<string, unknown> | undefined;
  if (values.opaque) {
    try {
      opaqueObj = JSON.parse(values.opaque) as Record<string, unknown>;
    } catch {
      console.error("--opaque must be valid JSON");
      process.exit(2);
    }
  }
  const client = new ArcClient();
  const cardId = await client.openScorecard({
    tags,
    source_url: values["source-url"] || undefined,
    opaque: opaqueObj,
  });
  const cfg = readConfig();
  cfg.currentCardId = cardId;
  writeConfig(cfg);
  appendScorecard({
    card_id: cardId,
    opened_at: new Date().toISOString(),
    tags,
  });
  console.log(`Opened scorecard ${cardId} with tags [${tags.join(", ")}].`);
  console.log("Stored as config.currentCardId.");
}

main().catch((err) => {
  console.error("open-scorecard failed:", err);
  process.exit(1);
});

```

### Core Architecture Module: `benchmarks/arc-agi-3/src/state.ts`
```
/**
 * Filesystem state I/O for the ARC-AGI-3 agent.
 *
 * Matches the Anthropic partner-template convention:
 *   <root>/
 *     config.json          // API config + current scorecard
 *     games.json           // cached list of available games
 *     sessions.json        // active game sessions
 *     scorecards.json      // scorecard history
 *     games/<game-id>/
 *       game.json          // metadata + state
 *       frames/frame_NNNN.json
 *       frames/summary.json
 *       scripts/           // Claude-written analysis scripts
 *     notes/<topic>.md     // cross-game scratchpad (Claude's notes)
 *
 * `<root>` defaults to the package's own directory but is overridable
 * via `--root` flag or `ARC_AGENT_ROOT` env so multiple parallel runs
 * (e.g. ablation cells) don't collide on shared files.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FrameResponse, GameSummary, ScorecardSummary } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Default state root: the package directory containing actions/, helpers/, etc. */
export function defaultStateRoot(): string {
  // benchmarks/arc-agi-3/src → benchmarks/arc-agi-3
  return process.env.ARC_AGENT_ROOT ?? path.resolve(__dirname, "..");
}

export interface AgentConfig {
  apiBaseUrl: string;
  apiKey?: string;
  currentCardId?: string;
  /** Optional model spec for Claude Code SDK; informational only. */
  model?: string;
}

export interface ActiveSession {
  game_id: string;
  guid: string;
  started_at: string;
  card_id: string;
  last_state: string;
  levels_completed: number;
  actions_submitted: number;
}

const DEFAULT_CONFIG: AgentConfig = {
  apiBaseUrl: "https://three.arcprize.org",
};

/** Read JSON file or return fallback (and write fallback as a side effect). */
function readJson<T>(filepath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filepath)) {
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      fs.writeFileSync(filepath, JSON.stringify(fallback, null, 2), "utf8");
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filepath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filepath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf8");
}

// ─── config.json ────────────────────────────────────────────────

export function configPath(root: string = defaultStateRoot()): string {
  return path.join(root, "config.json");
}

export function readConfig(root: string = defaultStateRoot()): AgentConfig {
  return readJson<AgentConfig>(configPath(root), { ...DEFAULT_CONFIG });
}

export function writeConfig(cfg: AgentConfig, root: string = defaultStateRoot()): void {
  writeJson(configPath(root), cfg);
}

// ─── games.json ─────────────────────────────────────────────────

export function gamesJsonPath(root: string = defaultStateRoot()): string {
  return path.join(root, "games.json");
}

export function cacheGames(games: GameSummary[], root: string = defaultStateRoot()): void {
  writeJson(gamesJsonPath(root), { fetched_at: new Date().toISOString(), games });
}

export function readCachedGames(root: string = defaultStateRoot()): {
  fetched_at?: string;
  games: GameSummary[];
} {
  return readJson(gamesJsonPath(root), { games: [] as GameSummary[] });
}

// ─── sessions.json ──────────────────────────────────────────────

export function sessionsPath(root: string = defaultStateRoot()): string {
  return path.join(root, "sessions.json");
}

export function readSessions(root: string = defaultStateRoot()): Record<string, ActiveSession> {
  return readJson<Record<string, ActiveSession>>(sessionsPath(root), {});
}

export function upsertSession(session: ActiveSession, root: string = defaultStateRoot()): void {
  const sessions = readSessions(root);
  sessions[session.game_id] = session;
  writeJson(sessionsPath(root), sessions);
}

export function getCurrentSession(
  gameId: string,
  root: string = defaultStateRoot(),
): ActiveSession | null {
  const sessions = readSessions(root);
  return sessions[gameId] ?? null;
}

// ─── scorecards.json ────────────────────────────────────────────

export interface StoredScorecard {
  card_id: string;
  opened_at: string;
  closed_at?: string;
  tags: string[];
  scorecard_url?: string;
}

export function scorecardsPath(root: string = defaultStateRoot()): string {
  return path.join(root, "scorecards.json");
}

export function readScorecards(root: string = defaultStateRoot()): StoredScorecard[] {
  return readJson<StoredScorecard[]>(scorecardsPath(root), []);
}

export function appendScorecard(card: StoredScorecard, root: string = defaultStateRoot()): void {
  const cards = readScorecards(root);
  cards.push(card);
  writeJson(scorecardsPath(root), cards);
}

export function updateScorecardClose(
  cardId: string,
  closedAt: string,
  scorecardUrl: string | undefined,
  root: string = defaultStateRoot(),
): void {
  const cards = readScorecards(root);
  for (const c of cards) {
    if (c.card_id === cardId) {
      c.closed_at = closedAt;
      if (scorecardUrl) c.scorecard_url = scorecardUrl;
    }
  }
  writeJson(scorecardsPath(root), cards);
}

// ─── per-game state ─────────────────────────────────────────────

export function gameDir(gameId: string, root: string = defaultStateRoot()): string {
  return path.join(root, "games", gameId);
}

export function gameMetaPath(gameId: string, root: string = defaultStateRoot()): string {
  return path.join(gameDir(gameId, root), "game.json");
}

export interface GameMeta {
  game_id: string;
  title?: string;
  created_at: string;
  last_card_id?: string;
  last_guid?: string;
  win_levels?: number;
  levels_completed?: number;
  frame_count: number;
}

export function readGameMeta(gameId: string, root: string = defaultStateRoot()): GameMeta {
  return readJson<GameMeta>(gameMetaPath(gameId, root), {
    game_id: gameId,
    created_at: new Date().toISOString(),
    frame_count: 0,
  });
}

export function writeGameMeta(meta: GameMeta, root: string = defaultStateRoot()): void {
  writeJson(gameMetaPath(meta.game_id, root), meta);
}

export function framePath(
  gameId: string,
  frameIndex: number,
  root: string = defaultStateRoot(),
): string {
  const padded = String(frameIndex).padStart(4, "0");
  return path.join(gameDir(gameId, root), "frames", `frame_${padded}.json`);
}

export interface StoredFrame {
  index: number;
  timestamp: string;
  action_input: FrameResponse["action_input"];
  caption?: string;
  state: FrameResponse["state"];
  levels_completed: number;
  win_levels: number;
  available_actions: number[];
  frame: FrameResponse["frame"]; // last frame only — multi-frame trimmed for storage size
  pixel_changes_from_prev?: number;
}

export function writeFrame(
  gameId: string,
  index: number,
  stored: StoredFrame,
  root: string = defaultStateRoot(),
): void {
  writeJson(framePath(gameId, index, root), stored);
}

export function readFrame(
  gameId: string,
  index: number,
  root: string = defaultStateRoot(),
): StoredFrame | null {
  const p = framePath(gameId, index, root);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as StoredFrame;
  } catch {
    return null;
  }
}

export function listFrameFiles(gameId: string, root: string = defaultStateRoot()): string[] {
  const dir = path.join(gameDir(gameId, root), "frames");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^frame_\d+\.json$/.test(f))
    .map((f) => path.join(dir, f))
    .toSorted();
}

/**
 * Compute pixel changes between two `frame` arrays (last-frame only).
 * Returns -1 if shapes differ (resize) or either is missing.
 */
export function pixelChanges(
  prev: FrameResponse["frame"] | undefined,
  next: FrameResponse["frame"],
): number {
  if (!prev || prev.length === 0 || next.length === 0) return -1;
  const prevGrid = prev.at(-1);
  const nextGrid = next.at(-1);
  if (!prevGrid || !nextGrid) return -1;
  if (prevGrid.length !== nextGrid.length) return -1;
  let count = 0;
  for (let r = 0; r < prevGrid.length; r++) {
    const a = prevGrid[r]!;
    const b = nextGrid[r]!;
    if (a.length !== b.length) return -1;
    for (let c = 0; c < a.length; c++) {
      if (a[c] !== b[c]) count++;
    }
  }
  return count;
}

/**
 * Persist a FrameResponse into the per-game state. Returns the next
 * frame index so the caller can compose multi-step traces.
 */
export function persistFrameResponse(opts: {
  gameId: string;
  response: FrameResponse;
  caption?: string;
  prevFrame?: FrameResponse["frame"];
  root?: string;
}): { index: number; meta: GameMeta } {
  const root = opts.root ?? defaultStateRoot();
  const meta = readGameMeta(opts.gameId, root);
  const index = meta.frame_count;
  const pixelDelta = opts.prevFrame ? pixelChanges(opts.prevFrame, opts.response.frame) : -1;
  const stored: StoredFrame = {
    index,
    timestamp: new Date().toISOString(),
    action_input: opts.response.action_input,
    caption: opts.caption,
    state: opts.response.state,
    levels_completed: opts.response.levels_completed,
    win_levels: opts.response.win_levels,
    available_actions: opts.response.available_actions,
    frame: [opts.response.frame.at(-1) ?? []],
    pixel_changes_from_prev: pixelDelta >= 0 ? pixelDelta : undefined,
  };
  writeFrame(opts.gameId, index, stored, root);
  const next: GameMeta = {
    ...meta,
    game_id: opts.gameId,
    last_guid: opts.response.guid,
    win_levels: opts.response.win_levels,
    levels_completed: opts.response.levels_completed,
    frame_count: index + 1,
  };
  writeGameMeta(next, root);
  return { index, meta: next };
}

```

### Core Architecture Module: `benchmarks/collective-learning/node-worker.ts`
```
import path from "node:path";
import { z } from "zod";
import type { BitterbotConfig } from "../../src/config/config.js";
import { readJson, DeploymentSpecSchema, validateCorpus } from "./deployment-contract.js";
import { StudyNode } from "./study-node.js";
import { CONDITIONS } from "./study.js";

const [directory, specFile, conditionText, nodeText] = process.argv.slice(2);
const condition = z.enum(CONDITIONS).parse(conditionText),
  nodeId = z.enum(["a", "b"]).parse(nodeText);
if (!process.send || path.resolve(directory) !== process.env.BITTERBOT_STATE_DIR)
  throw new Error("Study worker requires isolated state and private parent IPC");
const spec = DeploymentSpecSchema.parse(await readJson(specFile));
const corpus = validateCorpus(await readJson(path.join(path.dirname(specFile), "corpus.json")));
const config = (await readJson(path.join(directory, "bitterbot.json"))) as BitterbotConfig;
const pending = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
let counter = 0;
const accounting = (operation: string, value: unknown) =>
  new Promise<void>((resolve, reject) => {
    const id = `account:${counter++}`;
    pending.set(id, { resolve, reject });
    process.send!({ type: "accounting", id, operation, value });
  });
const worker = new StudyNode({
  directory,
  node: nodeId,
  condition,
  spec,
  config,
  corpus,
  accounting: {
    reserve: (charge) => accounting("reserve", charge),
    finish: (id, row, artifact) => accounting("finish", { id, row, artifact }),
  },
});
const abort = new AbortController();
let busy = false;
process.on("message", async (raw: unknown) => {
  const message = raw as {
    type: string;
    id: string;
    method: string;
    input: Record<string, unknown>;
    error?: string;
  };
  if (message.type === "accounted") {
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task?.reject(new Error(message.error));
    else task?.resolve();
    return;
  }
  if (message.type !== "request") return;
  if (busy) {
    process.send!({ type: "response", id: message.id, error: "Worker already executing" });
    return;
  }
  busy = true;
  try {
    let result: unknown;
    if (message.method === "peers")
      result = await worker.configurePeers(
        message.input.peers as Parameters<StudyNode["configurePeers"]>[0],
        message.input.circleId as string | undefined,
      );
    else if (message.method === "join") {
      await worker.join(message.input.invite as string);
      result = { joined: true };
    } else if (message.method === "policy") {
      worker.setupPolicy(message.input.peers as Parameters<StudyNode["setupPolicy"]>[0]);
      result = { configured: true };
    } else if (message.method === "status")
      result = {
        currentHash: worker.currentHash(),
        circle: worker.meta("circle"),
        learningEndedAt: worker.meta("learning-ended-at"),
        finalRanAt: worker.meta("final-ran-at"),
        command:
          worker.db
            .prepare("SELECT hash,state,result FROM study_node_commands WHERE id=?")
            .get((message.input.commandId as string) ?? "") ?? null,
      };
    else if (message.method === "close") {
      await worker.close();
      process.send!({ type: "response", id: message.id, result: { closed: true } }, () =>
        process.exit(0),
      );
      return;
    } else
      result = await worker.commandRun(message.id, message.method, message.input, abort.signal);
    process.send!({ type: "response", id: message.id, result });
  } catch (error) {
    process.send!({ type: "response", id: message.id, error: String(error) });
  } finally {
    busy = false;
  }
});
process.on("disconnect", () => {
  abort.abort();
  setTimeout(() => process.exit(1), 1000).unref();
});
process.on("SIGTERM", () => {
  abort.abort();
  setTimeout(() => process.exit(1), 1000).unref();
});
try {
  process.send({ type: "ready", descriptor: await worker.start() });
} catch (error) {
  process.send!({ type: "failed", error: String(error) });
  process.exitCode = 1;
  await worker.close();
  process.disconnect!();
}

```

### Core Architecture Module: `benchmarks/collective-learning/worker-client.ts`
```
import { fork, type ChildProcess, type ForkOptions } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StudyLedger } from "./study-ledger.js";
import type { NodeDescriptor } from "./study-node.js";
import type { PairedObservation } from "./study.js";

export class WorkerClient {
  readonly child: ChildProcess;
  readonly ready: Promise<NodeDescriptor>;
  private requests = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  constructor(
    directory: string,
    spec: string,
    condition: string,
    node: string,
    readonly ledger: StudyLedger,
    readonly progress: (message: string) => void = () => {},
  ) {
    const log = fs.openSync(path.join(directory, "worker.log"), "a", 0o600);
    const launchOptions: ForkOptions & { windowsHide: boolean } = {
      execArgv: ["--import", "tsx"],
      windowsHide: true,
      env: {
        ...process.env,
        BITTERBOT_STATE_DIR: directory,
        BITTERBOT_CONFIG_PATH: path.join(directory, "bitterbot.json"),
        BITTERBOT_DISABLE_DISCOVERY: "1",
      },
      stdio: ["ignore", log, log, "ipc"],
    };
    this.child = fork(
      fileURLToPath(new URL("./node-worker.ts", import.meta.url)),
      [directory, spec, condition, node],
      launchOptions,
    );
    fs.closeSync(log);
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Worker ${condition}/${node} startup timed out; inspect its log`)),
        600000,
      );
      this.child.on("message", (raw: unknown) => {
        const message = raw as {
          type: string;
          id: string;
          error?: string;
          descriptor: NodeDescriptor;
          operation: string;
          value: unknown;
          result: unknown;
        };
        if (message.type === "ready") {
          clearTimeout(timer);
          resolve(message.descriptor);
        } else if (message.type === "failed") {
          clearTimeout(timer);
          reject(new Error(message.error));
        } else if (message.type === "accounting") {
          try {
            if (message.operation === "reserve") this.ledger.reserve(message.value);
            else if (message.operation === "finish") {
              const value = message.value as {
                id: string;
                row: PairedObservation;
                artifact: unknown;
              };
              this.ledger.finish(value.id, value.row, value.artifact);
              this.progress(
                `${condition}/${node}: ${value.row.phase} ${value.row.taskId} ${value.row.success === null ? "unresolved" : value.row.success ? "pass" : "fail"}`,
              );
            } else throw new Error("Unknown accounting operation");
            this.child.send({ type: "accounted", id: message.id });
          } catch (error) {
            this.child.send({ type: "accounted", id: message.id, error: String(error) });
          }
        } else if (message.type === "response") {
          const request = this.requests.get(message.id);
          this.requests.delete(message.id);
          if (message.error) request?.reject(new Error(message.error));
          else request?.resolve(message.result);
        }
      });
      this.child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      this.child.on("exit", (code, signal) => {
        clearTimeout(timer);
        const error = new Error(
          `Worker ${condition}/${node} exited (${code ?? signal}); unresolved costs and commands are retained`,
        );
        reject(error);
        for (const request of this.requests.values()) request.reject(error);
        this.requests.clear();
      });
    });
  }
  async call(
    method: string,
    input: Record<string, unknown> = {},
    id: string = randomUUID(),
  ): Promise<unknown> {
    await this.ready;
    if (!this.child.connected) throw new Error("Study worker disconnected");
    return new Promise((resolve, reject) => {
      this.requests.set(id, { resolve, reject });
      this.child.send({ type: "request", id, method, input });
    });
  }
  async close(): Promise<void> {
    if (!this.child.connected) return;
    await this.call("close").catch(() => {
      this.child.kill();
    });
  }
}

```

### Core Architecture Module: `benchmarks/learning-strategy/telecom/rediscovery-engineer.mjs`
```
import assert from "node:assert/strict";
import { createBridge } from "./bridge.mjs";
import { projectFeedback } from "./feedback.mjs";
import { PROGRAM_SCHEMA, validateProgram } from "./rediscovery-runtime.mjs";

export const ENGINEER =
  "Engineer reusable improvements to a customer-support agent. Investigate causes, distinguish interface failures from actor failures, preserve successful behavior, and verify hypotheses with available development experiments. You may design a bounded advisory program, but cannot change policy, tools, the simulator or the evaluator. Do not include case identifiers or customer-specific values in the program. No particular diagnosis or solution is supplied.";
export const CAPABILITIES =
  "A program has instructions (at most 2000 characters), delivery system or each_turn, and up to 6 checks. Total compact JSON must be <=4000 characters. Each check: unique lowercase id <=40; source customer, tools, or public; contains 1-4 literal search strings <=80 characters; take 1-3 recent matches; when always, found or missing; instruction <=500 characters. At each_turn, the host searches actor-visible customer speech, historical actor tool responses, or only the latest explicit public fact snapshot. Matching is case-insensitive literal OR. It supplies cited excerpts (up to 1200 characters each) and emits instructions according to when. Matches do not prove truth or current state. Original history remains available. With system delivery, instructions and all check instructions are placed once in the system context, without retrieval or conditions. The original baseline instructions and policy always remain. This is a declarative program, not executable source. Design any useful approach in this space; do not assume repeating advice is best.";
export const DIAGNOSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["hypotheses", "probes"],
  properties: {
    hypotheses: { type: "string" },
    probes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["case", "actions"],
        properties: {
          case: { type: "string" },
          actions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["role", "name", "argumentsJson"],
              properties: {
                role: { type: "string", enum: ["assistant", "user"] },
                name: { type: "string" },
                argumentsJson: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};
export function parseResponse(response) {
  assert.notEqual(response.stopReason, "max_tokens", "Engineer output truncated");
  return JSON.parse(
    response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n"),
  );
}
export function feedbackRow(episode, caseId) {
  const projected = projectFeedback(episode);
  const text = JSON.stringify(
    projected.timeline.map((r) => {
      if (!r.observations) return r;
      const { observations, ...rest } = r;
      return {
        ...rest,
        publicSnapshot: Object.fromEntries(observations.records.map((v) => [v.fact, v.value])),
      };
    }),
  );
  const bindings = [
    ...new Set(
      episode.transcript
        .filter((r) => r.type === "tool" && r.seat === "actor")
        .flatMap((r) =>
          Object.values(r.arguments ?? {}).filter(
            (v) => typeof v === "string" && /^(?:555-|[CLPBD]\d{4})/.test(v),
          ),
        ),
    ),
  ];
  return {
    case: caseId,
    passed: episode.verdict.passed && ["user-ended", "human-transfer"].includes(episode.reason),
    termination: projected.termination,
    actorObservedSyntheticBindings: bindings,
    traceTruncated: text.length > 6000,
    publicTrace:
      text.length <= 6000
        ? text
        : text.slice(0, 1500) + "\n[Middle omitted; absence is not evidence]\n" + text.slice(-4500),
  };
}
export function engineerPacket({ branch, round, actor, feedback, context }) {
  const rows = branch === "experience" ? feedback.map(JSON.parse) : [];
  const selected = [
    ...rows.filter((r) => !r.passed).slice(0, 2),
    ...rows.filter((r) => r.passed).slice(0, 1),
  ];
  return {
    engineer: ENGINEER,
    capabilities: CAPABILITIES,
    round,
    parentProgram: actor,
    policy: context.policy,
    agentTools: context.agentTools,
    customerTools: context.userTools,
    evidence:
      branch === "experience"
        ? {
            summaries: rows.map(
              ({ publicTrace: _trace, actorObservedSyntheticBindings: _bindings, ...r }) => r,
            ),
            traces: selected,
          }
        : "Execution history, grades, selection outcomes and diagnostic results are withheld in this feedback-ablation control. Use the policy, tool contracts and your previous design. Return no probes. Your proposals receive the same fixed number of evaluations and the same final host selection rule.",
    diagnosticContract:
      "Experience branch only: propose up to 3 experiments, each at most 6 native actions, using case aliases from the summaries. Each experiment resets a copy to that parent trial's final state, applies your chosen actions, and reports before/after binary native success plus tool outputs. Roles may be assistant or user. These are privileged development probes, not actions available to the deployed support agent; consent and role separation still apply during evaluated conversations. No initialization, private customer scenario, hidden task specification or reference solution is exposed. Known synthetic IDs observed by the actor are provided for tool arguments. Terminal handoff and unsupported tools are unavailable. Invalid probes return errors and are not retried.",
  };
}
export function diagnosisRequest(packet) {
  return {
    messages: [
      {
        role: "user",
        content:
          JSON.stringify(packet) +
          "\nForm competing explanations and choose informative diagnostic experiments. Return hypotheses and probes.",
      },
    ],
    output_config: { format: { type: "json_schema", schema: DIAGNOSIS_SCHEMA } },
    cache_control: { type: "ephemeral" },
  };
}
export function programRequest(packet, diagnosis, probes) {
  return {
    messages: [
      {
        role: "user",
        content:
          JSON.stringify({ ...packet, diagnosis, diagnosticResults: probes }) +
          "\nEngineer one reusable program using the supplied contract. Use evidence where available, preserve successful behavior and account for uncertainty. Return only the program JSON. This is your final submission for this round; no manual repair or extra generation is available.",
      },
    ],
    output_config: { format: { type: "json_schema", schema: PROGRAM_SCHEMA } },
    cache_control: { type: "ephemeral" },
  };
}
export async function diagnosticProbes(diagnosis, branch, bank) {
  if (branch !== "experience") return [{ status: "withheld-control" }];
  if (!Array.isArray(diagnosis?.probes) || diagnosis.probes.length > 3)
    return [{ error: "At most three probes are allowed" }];
  const results = [];
  for (const p of diagnosis.probes) {
    const b = createBridge();
    const actions = [];
    try {
      const source = bank.get(p.case);
      assert.ok(source, "Unknown case alias");
      assert.ok(
        Array.isArray(p.actions) && p.actions.length >= 1 && p.actions.length <= 6,
        "Probe needs 1-6 actions",
      );
      const context = await b.request({ method: "reset", index: source.index });
      for (const t of source.episode.transcript.filter((r) => r.type === "tool")) {
        const r = await b.request({
          method: "call",
          role: t.seat === "actor" ? "assistant" : "user",
          name: t.name,
          arguments: t.arguments,
        });
        assert.equal(r.content, t.content);
        assert.equal(r.error, t.error);
      }
      const before = await b.request({ method: "judge" });
      assert.equal(before.passed, source.episode.verdict.passed);
      for (const a of p.actions) {
        assert.ok(["assistant", "user"].includes(a.role), "Unsupported role");
        const tools = a.role === "assistant" ? context.agentTools : context.userTools;
        assert.ok(
          a.name !== "transfer_to_human_agents" && tools.some((t) => t.function.name === a.name),
          "Unsupported diagnostic tool",
        );
        const args = JSON.parse(a.argumentsJson);
        const result = await b.request({
          method: "call",
          role: a.role,
          name: a.name,
          arguments: args,
        });
        actions.push({
          ...a,
          ...result,
          content: result.content.slice(0, 1500),
          truncated: result.content.length > 1500,
        });
      }
      const after = await b.request({ method: "judge" });
      results.push({
        case: p.case,
        beforePassed: before.passed,
        afterPassed: after.passed,
        actions,
      });
    } catch (error) {
      results.push({ case: p.case, actions, error: error.message });
    } finally {
      b.close();
    }
  }
  return results;
}
export function parseProgram(response) {
  try {
    const program = validateProgram(parseResponse(response));
    return { valid: true, program, actor: JSON.stringify(program) };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

```

### Core Architecture Module: `benchmarks/learning-strategy/telecom/rediscovery2-engineer.mjs`
```
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  ENGINEER,
  DIAGNOSIS_SCHEMA as BASE_SCHEMA,
  diagnosisRequest as baseDiagnosisRequest,
  parseResponse,
  diagnosticProbes,
} from "./rediscovery-engineer.mjs";
import { SCHEMAS, parseProgram, compilerFeedback } from "./rediscovery2-runtime.mjs";
export { ENGINEER, parseResponse, diagnosticProbes };
export const CAPABILITIES =
  "Choose delivery in your diagnostic plan. For system delivery, return ONLY delivery and instructions (1..3500 characters); no checks/search metadata exists. It appends the instruction text once. For each_turn delivery, use instructions <=2000 characters plus up to 6 checks; each check has unique lowercase id <=40, source customer/tools/public, contains 1..4 literal search strings of 1..80 characters, take integer1..3, when always/found/missing, instruction1..500 characters. Total compact program JSON <=4000 characters. each_turn reads only actor-visible historical customer speech/tool responses and the latest explicit public snapshot. Matches do not establish current truth. The baseline and policy remain authoritative. Generated content may not contain instance identities, account IDs or phone numbers. You may revise a compiler-rejected submission once, using only mechanical feedback. There are no human repairs. Static instructions must express conditional advice as prose, not assert facts about a case.";
const digest = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

/** Private synthetic development evidence; never a real-user anonymizer. */
export function publicTrace(episode) {
  const rows = [],
    pending = [];
  const rejected = new Set(
    episode.transcript
      .filter((r) => ["grounding", "observation-failure"].includes(r.type))
      .map((r) => r.responseId),
  );
  for (const r of episode.transcript) {
    if (r.type === "public-observations")
      rows.push({ kind: "customer-publication", speech: r.speech, snapshot: r.snapshot });
    else if (r.type === "tool" && r.seat === "actor") {
      const call = pending.shift();
      assert.ok(call);
      assert.equal(call.name, r.name);
      assert.deepEqual(call.input, r.arguments);
      rows.push({
        kind: "actor-tool-result",
        callId: call.id,
        name: r.name,
        arguments: r.arguments,
        content: r.content,
        error: r.error,
      });
    } else if (r.id && r.seat === "actor") {
      rows.push({ kind: "actor-response", content: r.content });
      pending.push(...r.content.filter((b) => b.type === "tool_use"));
    } else if (
      r.id &&
      r.seat === "user" &&
      !rejected.has(r.id) &&
      r.content.some((b) => b.type === "tool_use" && b.name === "end_conversation")
    ) {
      const speech = r.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (speech && episode.publicConversation.some((t) => t.seat === "user" && t.text === speech))
        rows.push({ kind: "customer-final-speech", speech });
    }
  }
  return rows;
}
export function feedbackSummary(episode, caseId) {
  return {
    case: caseId,
    passed: episode.verdict.passed && ["user-ended", "human-transfer"].includes(episode.reason),
    termination: episode.reason,
    traceHash: digest(publicTrace(episode)),
  };
}
export function engineerPacket({
  branch,
  round,
  actor,
  feedback,
  context,
  bank,
  previousCompilerFeedback = null,
}) {
  const summaries = branch === "experience" ? feedback.map(JSON.parse) : [];
  const packet = {
    engineer: ENGINEER,
    capabilities: CAPABILITIES,
    round,
    parentProgram: actor,
    previousCompilerFeedback,
    policy: context.policy,
    agentTools: context.agentTools,
    customerTools: context.userTools,
    evidence:
      branch === "experience"
        ? {
            summaries,
            traces: [],
            omitted: [],
            note: "Complete selected actor-visible traces, retaining arguments, results and identifier associations. Synthetic data only; keep instance values out of generated programs. No private customer tools or hidden scenario. Missing traces are identified, never interpreted as absent actions.",
          }
        : "Execution histories, grades, diagnostic results and host selection are withheld. Reason from policy/tools and your own prior submission. Return no probes. Mechanical compiler feedback and the same maximum revision opportunity are available to both arms.",
    diagnosticContract:
      "Experience only: up to 3 native experiments, at most 6 actions each, on isolated copies of parent final states. Use case aliases from summaries and tool names/arguments from the provided contracts. Roles assistant or user are privileged development capabilities; normal support execution retains role separation and consent. Results include before/after binary outcome and tool outputs, not hidden assertions. Terminal handoff is unavailable. Failed probes are retained without retries. Explicitly assess which hypotheses are supported, refuted or unresolved before writing your program.",
  };
  if (branch === "experience") {
    const selected = [
      ...summaries.filter((r) => !r.passed).slice(0, 2),
      ...summaries.filter((r) => r.passed).slice(0, 1),
    ];
    for (const s of selected) {
      const e = bank.get(s.case)?.episode;
      assert.ok(e);
      assert.deepEqual(feedbackSummary(e, s.case), s);
      const row = { ...s, traceTruncated: false, timeline: publicTrace(e) };
      packet.evidence.traces.push(row);
      if (Buffer.byteLength(JSON.stringify(packet)) > 180000) {
        packet.evidence.traces.pop();
        packet.evidence.omitted.push({
          case: s.case,
          reason: "complete trace exceeds request allocation; no middle sections removed",
        });
      }
    }
    if (summaries.some((r) => !r.passed))
      assert.ok(
        packet.evidence.traces.some((r) => !r.passed),
        "No complete failed trace fits; qualify a different evidence interface",
      );
  }
  assert.ok(Buffer.byteLength(JSON.stringify(packet)) <= 185000);
  return packet;
}
export function diagnosisRequest(packet) {
  const request = baseDiagnosisRequest(packet);
  request.output_config.format.schema = {
    ...BASE_SCHEMA,
    required: [...BASE_SCHEMA.required, "delivery"],
    properties: {
      ...BASE_SCHEMA.properties,
      delivery: { type: "string", enum: ["system", "each_turn"] },
    },
  };
  return request;
}
export function programRequest(packet, diagnosis, probes, repair = null) {
  const request = {
    messages: [
      {
        role: "user",
        content:
          JSON.stringify({
            ...packet,
            diagnosis,
            diagnosticResults: probes,
            compilerRepair: repair,
          }) +
          "\nReturn assessment and program. In assessment, distinguish supported, refuted and unresolved hypotheses using actual probe outputs (or explain evidence is withheld). Do not invent results. Produce a reusable program with the chosen delivery. A rejected first submission gets at most one compiler-only revision; no human fixes or task feedback between those attempts.",
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["assessment", "program"],
          properties: { assessment: { type: "string" }, program: SCHEMAS[diagnosis.delivery] },
        },
      },
    },
    cache_control: { type: "ephemeral" },
  };
  assert.ok(SCHEMAS[diagnosis.delivery]);
  assert.ok(
    Buffer.byteLength(JSON.stringify(request)) < 299000,
    "Generation request exceeds qualified allocation",
  );
  return request;
}

export async function generateProgram(
  provider,
  packet,
  diagnosis,
  probes,
  { label, remainingUsd, signal },
) {
  const attempts = [];
  let usd = 0,
    response,
    generated,
    feedback = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    response = await provider.call(programRequest(packet, diagnosis, probes, feedback), {
      tag: `${label}:program-${attempt}`,
      maxTokens: 4096,
      localRemaining: remainingUsd - usd,
      signal,
    });
    usd += response.usd;
    generated = parseProgram(response, diagnosis.delivery);
    attempts.push({ id: response.id, generated });
    feedback = compilerFeedback(response, diagnosis.delivery);
    if (generated.valid) break;
  }
  return { attempts, response, generated, feedback, usd };
}

```

### Core Architecture Module: `benchmarks/longmemeval-v2/core.py`
```
"""Reproducible state, credential-free worker IPC and bounded API accounting."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request
import urllib.error
import uuid
import selectors
import sqlite3
import fcntl

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
PINS = json.loads((HERE / "pins.json").read_text())
def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",",":")).encode()).hexdigest()
def sha(path):
    with Path(path).open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()
def atomic(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w") as f:
        json.dump(value, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
    tmp.replace(path)
def event(path, **value):
    with Path(path).open("a") as f:
        f.write(json.dumps({"wall_time":time.time(), **value}) + "\n")
        f.flush()
        os.fsync(f.fileno())
def credentials(path):
    # Never source repository shell code or log values; only approved model keys.
    result = {}
    for line in Path(path).read_text().splitlines():
        key, sep, value = line.strip().removeprefix("export ").partition("=")
        if sep and key in {"OPENAI_API_KEY","ANTHROPIC_API_KEY","OPENROUTER_API_KEY","OPENROUTER_KEY"}:
            result[key] = value.strip().strip("'").strip('"')
    return result

class TransientAPIError(RuntimeError):
    pass

class Broker:
    def __init__(self, root, config, keys):
        self.root, self.config, self.keys = Path(root), config, keys
        self.root.mkdir(parents=True, exist_ok=True)
        self.budget_lock = (self.root/"budget.lock").open("a")
        fcntl.flock(self.budget_lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        self.ledger = self.root / "api-ledger.json"
        self.database = sqlite3.connect(self.root/"accounting.sqlite")
        self.database.execute("CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, charged REAL NOT NULL, payload TEXT NOT NULL)")
        if self.database.execute("SELECT count(*) FROM requests").fetchone()[0] == 0 and self.ledger.exists():
            for index, row in enumerate(json.loads(self.ledger.read_text())):
                row.setdefault("id","legacy-"+str(index))
                self.database.execute("INSERT INTO requests VALUES (?,?,?)",(row["id"],row.get("cost_usd",row["reserved_usd"]),json.dumps(row)))
            self.database.commit()
        self.charged = self.database.execute("SELECT COALESCE(sum(charged),0) FROM requests").fetchone()[0]
        self.stage = "initialization"
        self.case = None
        self.failed = False
    def close(self):
        self.database.close()
        self.budget_lock.close()
    @property
    def entries(self):
        return [json.loads(row[0]) for row in self.database.execute("SELECT payload FROM requests ORDER BY rowid")]
    def save_request(self, row):
        self.database.execute("INSERT INTO requests VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET charged=excluded.charged,payload=excluded.payload",
            (row["id"],row.get("cost_usd",row["reserved_usd"]),json.dumps(row)))
        self.database.commit()
    def call(self, kind, body):
        if self.failed:
            raise RuntimeError("API circuit is open after an unrecovered failure; no call dispatched")
        policy=self.config.get("retry_policy",{})
        attempts=policy.get("max_attempts",1)
        if not isinstance(attempts,int) or not 1<=attempts<=3:
            raise RuntimeError("Retry attempts must be between one and three")
        for attempt in range(1,attempts+1):
            try:
                return self._call_once(kind,body,attempt=attempt)
            except TransientAPIError:
                if attempt==attempts:
                    self.failed=True
                    raise
                time.sleep(min(30,policy.get("backoff_seconds",2)*2**(attempt-1)))
            except Exception:
                self.failed=True
                raise
    def _call_once(self, kind, body, *, attempt):
        spec = self.config["models"][kind]
        body = dict(body)
        if kind == "embedding":
            if set(body) != {"model","input"} or body["model"] != spec["model"]:
                raise RuntimeError("Unexpected embedding request")
        elif kind == "dream":
            if set(body) != {"messages"}:
                raise RuntimeError("Unexpected dream request")
            body.update(model=spec["model"], max_tokens=6144, temperature=0)
        else:
            if body.get("model") != spec["model"]:
                raise RuntimeError("Unexpected evaluator model")
        if kind == "reader" and spec.get("transport") == "openrouter":
            from protocol import openrouter_body
            body = openrouter_body(body, spec)
        raw = json.dumps(body).encode()
        output_limit = body.get("max_completion_tokens", body.get("max_tokens", 0))
        # UTF-8 bytes + message overhead is a conservative upper bound for text BPE.
        # Vision reader reservations use the endpoint context maximum instead.
        input_bound = max(len(raw) + 4096, spec.get("input_reservation_tokens", 0))
        reserve = (input_bound * spec["input_per_million"] + output_limit * spec["output_per_million"]) / 1e6
        used = self.charged
        if used + reserve > self.config["budget_usd"]:
            self.failed = True
            raise RuntimeError("API budget exhausted before request; no call dispatched")
        row = {"id":uuid.uuid4().hex,"kind":kind,"stage":self.stage,"case":self.case,
               "model":spec["model"],"request_sha256":hashlib.sha256(raw).hexdigest(),
               "reserved_usd":reserve,"status":"inflight","started_at":time.time(),"attempt":attempt}
        self.charged += reserve
        self.save_request(row)
        start = time.perf_counter()
        try:
            key = self.keys.get(spec["key_env"], os.environ.get(spec["key_env"],""))
            if not key:
                raise RuntimeError("Missing credential variable " + spec["key_env"])
            suffix = "/embeddings" if kind == "embedding" else "/chat/completions"
            req = urllib.request.Request(spec["base_url"].rstrip("/") + suffix, data=raw,
                    headers={"Content-Type":"application/json","Authorization":"Bearer "+key})
            with urllib.request.urlopen(req, timeout=spec.get("timeout",600)) as response:
                payload = json.load(response)
                row["request_id"] = response.headers.get("x-request-id")
            usage = payload.get("usage")
            if not isinstance(usage,dict) or "prompt_tokens" not in usage:
                raise RuntimeError("Endpoint omitted usage; reserved charge retained")
            if kind != "embedding" and "completion_tokens" not in usage:
                raise RuntimeError("Endpoint omitted completion usage")
            row["usage"] = usage
            row["served_model"] = payload.get("model")
            row["served_provider"] = payload.get("provider")
            row["response_id"] = payload.get("id")
            row["cost_usd"] = (usage["prompt_tokens"] * spec["input_per_million"] +
                              usage.get("completion_tokens",0) * spec["output_per_million"]) / 1e6
            if row["cost_usd"] > reserve:
                raise RuntimeError("Endpoint exceeded conservative reservation; stop run")
            row["status"] = "success"
            return payload
        except Exception as exc:
            row["status"] = "error"
            row["error"] = type(exc).__name__ # no response body or credential-bearing URL
            transient=isinstance(exc,(TimeoutError,ConnectionResetError))
            if isinstance(exc,urllib.error.HTTPError):
                row["http_status"]=exc.code
                transient=exc.code in {429,500,502,503,504,520}
            elif isinstance(exc,urllib.error.URLError):
                transient=isinstance(exc.reason,(TimeoutError,ConnectionResetError))
            row["retryable"]=transient
            error_type=TransientAPIError if transient else RuntimeError
            raise error_type("API request failed: " + type(exc).__name__) from None
        finally:
            row["seconds"] = time.perf_counter()-start
            self.charged += row.get("cost_usd",reserve)-reserve
            self.save_request(row)

def resolve_node(value):
    """Resolve the configured Node binary: a path, or a command name looked up on PATH."""
    if os.sep not in value:
        found = shutil.which(value)
        if found is None:
            raise FileNotFoundError(f"node binary {value!r} not found on PATH")
        value = found
    return Path(value).expanduser().resolve(strict=True)

class Worker:
    def __init__(self, profile, cfg, broker, now):
        self.profile, self.broker = Path(profile).resolve(), broker
        self.profile.mkdir(parents=True,exist_ok=True)
        for name in ["home","state","tmp","workspace","agent"]:
            (self.profile/name).mkdir(exist_ok=True)
        atomic(self.profile/"empty-config.json",{})
        node = resolve_node(cfg["node"])
        env = {"PATH":str(node.parent)+":/usr/bin:/bin","HOME":str(self.profile/"home"),
               "BITTERBOT_HOME":str(self.profile/"home"),"BITTERBOT_STATE_DIR":str(self.profile/"state"),
               "BITTERBOT_CONFIG_PATH":str(self.profile/"empty-config.json"),
               "BITTERBOT_OAUTH_DIR":str(self.profile/"oauth"),"TMPDIR":str(self.profile/"tmp"),
               "XDG_CONFIG_HOME":str(self.profile/"home"),"XDG_CACHE_HOME":str(self.profile/"home"),
               "TZ":"UTC","NODE_ENV":"production","BITTERBOT_LOG_LEVEL":"debug"}
        allowed = ["/usr","/lib","/lib64","/etc/ld.so.cache","/etc/ssl","/dev/urandom",
                   str(node.p
```

### Core Architecture Module: `benchmarks/longmemeval-v2/diagnostics/score_pilot.py`
```
"""Post-capacity diagnostic scoring; shares the pilot's cumulative authorized ledger."""
import sys
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE))
import json,os,time,fcntl,subprocess,uuid,traceback,argparse
from core import *
from run import make_memory_class, snapshot_hashes
import protocol

ROOT=BASE/".runtime/capacity-pilot"
OUT=ROOT/"accuracy"
DATA=BASE/".runtime/data"
UPSTREAM=Path("/tmp/bitterbot-lme-v2-upstream")
def status(value,**kwargs):atomic(OUT/"status.json",{"status":value,"wall_time":time.time(),**kwargs})
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--domain",choices=["web","enterprise"])
    args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    lock=(OUT/"run.lock").open("a");fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    pilot=json.loads((ROOT/"manifest.json").read_text())
    cfg=dict(pilot["config"]);cfg["models"]=dict(cfg["models"])
    extra=json.loads((BASE/"openrouter-run.example.json").read_text())
    for role in ("reader","judge"):cfg["models"][role]=extra["models"][role]
    cfg["budget_usd"]=json.loads((BASE/"capacity-pilot.json").read_text())["budget_usd"]
    identity={"pilot_manifest_sha256":sha(ROOT/"manifest.json"),"config":cfg,
              "evaluator_source_sha256":sha(__file__),"protocol_sha256":sha(BASE/"protocol.py"),
              "pins":PINS,"scope":"two diagnostic questions; not a full official score",
              "limitation":"Hosted reader weight revision is not attested; BF16 provider pinned."}
    if (OUT/"manifest.json").exists() and json.loads((OUT/"manifest.json").read_text())!=identity:
        raise RuntimeError("Diagnostic identity drift")
    atomic(OUT/"manifest.json",identity)
    status("preparing official screenshots")
    # Pinned release downloads and official extraction; no replacement images.
    from prepare import download
    expected={}
    for line in (DATA/"checksums.sha256").read_text().splitlines():
        value,name=line.split(maxsplit=1);expected[name.lstrip("*")]=value
    for name,value in expected.items():
        if name.startswith(("question_screenshots/","trajectory_screenshots/")):
            file=download(DATA,name,PINS["dataset"]["revision"])
            if sha(file)!=value:raise RuntimeError("Screenshot checksum mismatch")
    archives={
        "trajectory_screenshots/enterprise_screenshots_base.tar.gz":"5c4a67ae0856aa1ede9b040e7da7c7a2d0b76fdd6344ef87380bcdf9f4b6d7a3",
        "trajectory_screenshots/web_screenshots.tar.gz":"68699c6842412e09a6f89d3c05c5ae8813275918002b52d82dec43ab24dd01fb"}
    for name,value in archives.items():
        status("downloading official screenshot archives",archive=name)
        file=download(DATA,name,PINS["dataset"]["revision"])
        if sha(file)!=value:raise RuntimeError("Pinned archive checksum mismatch")
    atomic(OUT/"screenshot-hashes.json",archives)
    subprocess.run([sys.executable,str(UPSTREAM/"data/prepare_data.py"),"--data-root",str(DATA),"--mode","copy"],check=True)
    for name,value in PINS["dataset"]["sha256"].items():
        if sha(DATA/name)!=value:raise RuntimeError("Dataset hash mismatch")
    status("waiting for capacity controller to release the shared budget")
    # No concurrent spender: the capacity controller holds this lock until it stops.
    with (ROOT/"budget.lock").open("a") as guard:
        while True:
            try:fcntl.flock(guard,fcntl.LOCK_EX|fcntl.LOCK_NB);break
            except BlockingIOError:time.sleep(30)
        fcntl.flock(guard,fcntl.LOCK_UN)
    keys=credentials(REPO/".env")
    keys.update(credentials(Path("/mnt/d/Bitterbot/bitterbot-desktop/.env")))
    broker=Broker(ROOT,cfg,keys)
    try:
        h=protocol.load(UPSTREAM)
        from data.public_data import materialize_runtime_questions
        from transformers import AutoProcessor
        h.MEMORY_CONTEXT_PROCESSOR_LOCAL.processor=AutoProcessor.from_pretrained(
            "Qwen/Qwen3.5-9B",revision=PINS["reader_processor_revision"])
        histories=json.loads((DATA/"haystacks/lme_v2_medium.json").read_text())
        results=[]
        for domain,selected in pilot["selection"].items():
            if args.domain and domain!=args.domain:continue
            matches=sorted(qid for qid,history in histories.items() if history==selected["history"])
            if not matches:raise RuntimeError("No question matches selected history")
            qid=matches[0] # deterministic choice before reading any answer labels
            case=OUT/domain;case.mkdir(exist_ok=True)
            directory=ROOT/"histories"/selected["history_sha256"]
            latest=directory/"latest.json"
            if not latest.exists():
                results.append({"domain":domain,"question_id":qid,"status":"blocked","reason":"No committed history"})
                continue
            checkpoint=directory/json.loads(latest.read_text())["generation"]
            saved=json.loads((checkpoint/"checkpoint.json").read_text())
            if saved["count"]!=len(selected["history"]):
                results.append({"domain":domain,"question_id":qid,"status":"blocked",
                                "reason":"History incomplete","ingested":saved["count"],"required":len(selected["history"])})
                continue
            if saved["history"]!=selected["history"] or snapshot_hashes(checkpoint/"profile")!=saved["sha256"]:
                raise RuntimeError("Checkpoint identity/integrity mismatch")
            if (case/"failed.json").exists():raise RuntimeError("Recorded diagnostic failure; inspect before explicit retry")
            if (case/"record.json").exists():
                results.append(json.loads((case/"record.json").read_text()));continue
            status("scoring",domain=domain,question_id=qid)
            broker.case="diagnostic-"+qid;broker.failed=False
            try:
                q=materialize_runtime_questions(data_root=DATA,domain=domain,question_ids=[qid],limit=None,output_path=case/"evaluator-question.json")[0]
                if not (case/"prompt.json").exists():
                    text,image=h.get_question_components(q["question"])
                    item={"index":0,"stream_index":0,"question_item":q,"question_id":qid,
                          "query_invocation_id":uuid.uuid4().hex,"question_type":q["question_type"],
                          "category":h.category_from_question_type(q["question_type"]),"eval_function":q["eval_function"],
                          "eval_name":h.eval_name(q["eval_function"]),"question_text":text,"question_image":image,"answer_gold":q["answer"]}
                    broker.stage="diagnostic-retrieval"
                    memory=make_memory_class(h,checkpoint,OUT/"query-profiles",cfg,broker,
                                             ingestion_time(len(selected["history"])),DATA/"screenshots")
                    row=h.build_prompt_row(item,haystack_ids=selected["history"],memory=memory,
                                          system_prompt=h.get_system_prompt(domain),memory_context_max_tokens=200000)
                    atomic(case/"prompt.json",row)
                row=json.loads((case/"prompt.json").read_text())
                if not (case/"reader.json").exists():
                    broker.stage="diagnostic-reader"
                    response=broker.call("reader",protocol.wire_body(h.build_reader_request(protocol.reader_args(cfg["models"]["reader"]),row["messages"])))
                    served=response.get("provider")
                    if served and "deepinfra" not in served.lower():raise RuntimeError("Unexpected reader provider")
                    obj=protocol.objectify(response)
                    raw=h.extract_text_from_response_message(obj.choices[0].message)
                    if not raw:raise RuntimeError("Empty reader response")
                    answer=h.extract_boxed_answer(raw)
                    atomic(case/"reader.json",{"response_raw":raw,"response_parsed_boxed":answer,
                          "is_unknown":h.is_unknown(answer),"usage":h.extract_usage_dict(obj),"served_provider":served})
                row.update(json.loads((case/"reader.json").read_text()))
                broker.stage="diagnostic-evaluation"
                score,_,_=protocol.judge(h,row,broker)
                row.update(domain=domain,status="scored",score_bool=bool(score),score=1.0 if score else 0.0,
                           timestamp_utc=h.utc_now_iso(),diagnostic_only=True,reader_revision_verified=False)
                row.pop("messages",None)
                atomic(case/"record.json",row);results.append(row)
            except BaseException as exc:
                atomic(case/"failed.json",{"error":str(exc),"stage":broker.stage})
                raise
        previous=json.loads((OUT/"results.json").read_text())["results"] if (OUT/"results.json").exists() else []
        merged={r["domain"]:r for r in previous}
        merged.update({r["domain"]:r for r in results})
        results=list(merged.values())
        atomic(OUT/"results.json",{"results":results,"cumulative_pilot_usd":broker.charged,"official_score":None})
        lines=["# Diagnostic accuracy results","","This is a tiny selected sample, not an overall benchmark score.",
               "The official prompts and scoring functions were used; hosted Qwen weight revision remains unverified.",""]
        for r in results:
            lines.append(f"- {r['domain']} / {r['question_id']}: "+("correct" if r.get("score_bool") else "incorrect") if r["status"]=="scored" else f"- {r['domain']}: blocked — {r['reason']}")
            if r["status"]=="scored":lines.append("  Reader answer: "+str(r["response_parsed_boxed"]))
        (OUT/"report.md").write_text("\n".join(lines)+"\n")
        status("completed" if all(r["status"]=="scored" for r in results) else "blocked by incomplete histories",
               cumulative_pilot_usd=broker.charged,scored=sum(r["status"]=="scored" for r in results))
 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #54** (2026-06-07): **Wallet: x402 payment signing fails + send_usdc 'Unsupported network' on Base**
  *Symptoms*: ## Summary  Two wallet bugs discovered during first real-money testing of the economic layer:  ### Bug 1: x402 Payment Signing Fails (402 not resolved)  **Steps to reproduce:** 1. Fund wallet with USDC on Base 2. Enable x402 in config: `tools.wallet.x402.enabled: true` 3. Hit an x402 paywall (e.g. `https://agentsvc.io/api/v1/proxy/exchange-rates`) 4. Call `pay_for_resource` with the resource URL and amount  **Expected:** Wallet signs the USDC payment, attaches X-Payment header, receives content **Actual:** Tool returns the raw 402 response body without completing payment signing  The 402 response includes valid payment details: ```json {   "scheme": "exact",   "network": "base",    "maxAmountRequired": "1000",   "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",   "payTo": "0xC33336EB299d97aa76E61337906A677552878818" } ```  Likely cause: The x402 client library is not properly parsing the 402 response to extract payment params, or the Coinbase facilitator URL is not configured/reachable.  ### Bug 2: send_usdc fails with "Unsupported network for smart wallets: base"  **Steps to reproduce:** 1. Wallet on Base with USDC balance 2. Call `send_usdc` with a valid address and amount  **Expected:** USDC transfer completes on Base **Actual:** Error: `Failed to send USDC: Unsupported network for smart wallets: base`  Note: The wallet successfully *received* USDC on Base (from Kraken), so the address works. Only outbound sends fail.  Likely cause: Coinbase CDP SDK version issue — th

- **Issue #14** (2026-04-23): **Wallet funding via Stripe onramp is currently broken**
  *Symptoms*: Heads-up: the "Fund wallet" flow that uses the Stripe Crypto Onramp is not working in the current build. Anyone trying to top up their agent wallet through that path will hit an error when a session is requested.  ## Why  The desktop client at `src/services/hosted-onramp.ts` posts to our hosted onramp service at `onramp.bitterbot.ai`, which is expected to return a `clientSecret` + `publishableKey` that the Stripe Crypto Onramp widget in the wallet view then consumes. The hosted service lives in a separate repo (`bitterbot_funding_onramp`, a Hono app deployable to Cloudflare Workers or Railway, wrapping the Stripe Crypto Onramp API) and is not yet deployed. Every `/session` POST currently fails upstream.  ## Goal  Make agent-wallet funding as seamless and friction-free as possible. A user should be able to fund in a few clicks, without touching a Stripe dashboard or managing their own API keys.  ## Plan  The hosted onramp service is being deployed this week. It is already implemented end to end (rate-limited, network-gated for `base` and `base-sepolia`, validates wallet address format, separates test and live keys) and just needs DNS, secrets, and the healthcheck wired up on the hosting provider. ETA: a few days.  ## Workaround in the meantime  Users who need to fund now can configure their own Stripe Crypto Onramp keys. Run:  ``` pnpm bitterbot doctor-wallet ```  and follow the prompts, or edit the wallet config directly. The client in `src/services/stripe-onramp.ts` will fal
  **Post-Mortem & Fix Analysis**:
  > Deployed and live at `https://onramp.bitterbot.ai`.  **Smoke tests:** - `GET /` returns `{"ok":true,"service":"bitterbot-funding-onramp"}` - `POST /session` with `{"walletAddress":"0x...","network":"base"}` returns a valid Stripe `clientSecret` + `publishableKey` - `POST /session` with any other network is rejected with 400  **Summary of what changed:** - Onramp repo pushed to [`Bitterbot-AI/bitterbot-funding-onramp`](https://github.com/Bitterbot-AI/bitterbot-funding-onramp) - Deployed to Railway with the live Stripe Crypto Onramp keys held server-side - `onramp.bitterbot.ai` CNAME + TXT verification wired up in Cloudflare DNS, TLS cert issued - Service is now **live-only** (`network: "base"`). The previous plan for a testnet path was dropped, wallet-funding code is a maintainer-only surface so there is no contributor-testing use case to justify it - Desktop client in `src/services/hosted-onramp.ts` still targets `onramp.bitterbot.ai/session` unchanged; it will now get a successful res

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

### Incident Patch 1: `ac9552c9` (2026-11-19)
**Commit Message**: fix(security): run the deep_recall sandbox in a locked-down process and close vm escapes (#387)

* fix(security): run the deep_recall sandbox in a locked-down process and close vm escapes

The deep_recall RLM sandbox ran sub-LLM-written code in a node:vm context
inside the gateway and seeded that context with host-realm objects, so
`Error.constructor("return process")()` returned the gateway's `process`:
code execution on the host, reachable from a non-owner channel sender by
prompt injection. Reported by Aleksandr Tynianov.

- deep_recall code now runs in a separate node process: empty environment,
  Node permission model (no fs, no child processes, no workers), 512 MB heap
  cap, killed on deadline. A hang or memory blow-up in sandbox code no longer
  stalls or kills the gateway. The gateway reads a JSON store snapshot and
  never calls into sandbox code.
- Inside that process the vm realm is hardened: null-prototype global, code
  generation off, every helper defined in the realm, string-only bridge.
- Node's own host callbacks leaked host-realm errors into vm realms (stack
  formatting, dynamic import). Stack capture is pinned off and the `import`
  keyword is refused. This als

**File**: `docs/memory/deep-recall.md` (modified, +28/-0)
```diff
@@ -184,6 +184,8 @@ When `deep_recall` returns no useful answer, the failed query is registered as a
 | `recent_sessions` | The 10 most recent transcripts of this agent (dialogue only)                            | Owner senders only; others are downgraded to `current_session` |
 | `all_sessions`    | Every transcript of this agent, including `.reset.*` archives (dialogue only)           | Owner senders only; others are downgraded to `current_session` |
 
+`deep_recall` is an owner-only tool, like `code_interpreter`: a non-owner sender's turn does not get it at all, because it runs sub-LLM-written code on the gateway host (see [Sandbox isolation](#sandbox-isolation)). A non-owner turn still has `recall_range` for exact lookups in its own conversation. The scope downgrade below stays in place as a second layer.
+
 Cross-session scopes read other conversations, and tool results carry file reads and command output that the memory indexer deliberately does not index. A non-owner sender (a group member, another DM) therefore gets `current_session` whatever it asks for, and the result carries a `scopeNote` saying so. "Owner" has the same meaning as for `code_interpreter`: the sender matched the channel's owner allowlist. Subagents and inbound A2A tasks cannot call `deep_recall` at all (for subagents it is on the deny list in `agent-tools.policy.ts`, together with `recall_range` and `expand_message`).
 
 The owner flag also decides what a recall records and sees. Every search the tool issues (the smart shortcut, the somatic-marker assessment, the live `search()` API, the bootstrap snapshot's seed queries) passes `observe: senderIsOwner` and the agent `sessionKey`, so a retrieval-evidence row is written for owner recalls only and guest recalls leave no trace in the evidence ledger; the snapshot builder takes the same switch as `observeEvidence`. The same flag enables `tagSuperseded`, which ranks results the canonical ledger has superseded last and tags them with the current value; guests get untagged results.
@@ -232,3 +234,29 @@ The owner flag also decides what a recall records and sees. Every search the too
 - [Curiosity & Search](./curiosity-and-search.md) — search infrastructure deep recall builds on
 - [User Knowledge](./user-knowledge.md) — session extraction for long-term facts
 - [recall_range](../tools/recall-range.md) — the deterministic transcript reader for exact text and tool outputs
+
+## Sandbox isolation
+
+The REPL code is written by a model that reads transcripts, memory and tool output, so it is treated as hostile. Two independent layers contain it.
+
+**A separate process.** The code never runs inside the gateway. Each sandbox is its own `node` process, started with:
+
+- an empty environment (no API keys or tokens),
+- the Node permission model: no filesystem access, no child processes, no worker threads, no native addons,
+- a 512 MB heap cap.
+
+The gateway talks to it over an IPC channel that carries JSON. The only things the process can ask for are the calls sandbox code is allowed anyway (`llm_query`, `llm_query_parallel`, `search`, `loadTranscript`, `listSessions`), only while a code block is running, and at most 500 per block. A block that overruns its deadline, including one that loops forever after an `await`, gets its process killed; a block that exhausts memory only ends its own process. Either way the gateway keeps running and the call returns an error to the model.
+
+**A hardened realm inside that process.** The code runs in a `node:vm` context from which no object of the surrounding process is reachable:
+
+- The global object has a null prototype, and `eval` / `Function(string)` / WebAssembly compilation are disabled.
+- `print`, `console`, the text helpers, `store` / `get` / `has` and `FINAL` are defined inside the sandbox realm.
+- Bridged calls cross as strings only (JSON text in, JSON text out).
+- Stack traces are switched off (`.stack` is `undefined`), code containing the word `import` is refused, and `FinalizationRegistry` is not available, because the errors Node raises from those paths belong to the surrounding process.
+
+Consequences for sandbox code:
+
+- `store()` is the only state that is guaranteed to last. The sandbox process is stopped after two idle minutes and after a timeout, and the next block starts a fresh one from the stored values. Plain global variables do not survive that.
+- Stored values are kept as JSON. Functions, `Map` / `Set` and cyclic values are not carried between processes.
+
+Two limits remain. Node 22's permission model does not restrict outbound network access, so code that defeated the realm hardening could open a socket from the sandbox process; it would have the loaded context to send and nothing else. And the tool spends money on sub-LLM calls. Both are reasons it stays owner-only.
```

**File**: `docs/tools/recall-range.md` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ The tool reads the current conversation only, by default. Tool outputs carry fil
 - Subagents cannot call `recall_range`, `deep_recall` or `expand_message` at any depth.
 - Inbound A2A tasks cannot call them either (always-deny floor).
 
-The same posture applies to `deep_recall`: its `recent_sessions` and `all_sessions` scopes are owner-only, and non-owner senders are downgraded to `current_session`.
+`deep_recall` is stricter: the whole tool is owner-only, so a non-owner sender does not get it (see [Deep Recall](../memory/deep-recall.md#sandbox-isolation)).
 
 ## Hot set
 
```

**File**: `src/agents/bitterbot-tools.ts` (modified, +2/-1)
```diff
@@ -78,7 +78,8 @@ import { resolveWorkspaceRoot } from "./workspace-dir.js";
  * Tools that read or change what the agent has made of the owner's life:
  * dream insights, emotional anchors, curiosity about their knowledge. A
  * guest turn (PLAN-53 G2) gets a refusal instead. The memory_* tools filter
- * rather than refuse, and deep_recall / recall_range scope by sender.
+ * rather than refuse, and recall_range scopes by sender. deep_recall is
+ * owner-only (tool-policy.ts) and scopes by sender as a second layer.
  */
 const GUEST_REFUSED_TOOLS = new Set([
   "dream_search",
```

**File**: `src/agents/rlm/sandbox-child-source.ts` (added, +578/-0)
```diff
@@ -0,0 +1,578 @@
+/**
+ * Source of the RLM sandbox child process (see sandbox.ts for the design).
+ *
+ * This file only holds JavaScript TEXT. The gateway never evaluates it: it is
+ * piped to a separate `node` process on stdin. Two layers live in it:
+ *
+ *   - BOOTSTRAP_SOURCE runs inside the vm realm and defines every helper the
+ *     model-written code can see.
+ *   - CHILD_MAIN_SOURCE is the child's own (trusted) code: it owns the vm
+ *     context and relays the bridge over the IPC channel.
+ */
+
+import { IMPORT_REFUSAL_MESSAGE, REALM_LOCKDOWN_SOURCE } from "../vm-realm-hardening.js";
+
+/**
+ * Evaluated once per vm context. Strict mode matters: it removes
+ * `fn.caller` / `fn.arguments`, the only way sandbox code could otherwise walk
+ * from its own frame to the closure that holds the two host functions.
+ *
+ * Invariants to keep when editing this:
+ *   - `hostSync` / `hostAsync` are only ever CALLED directly. Never store them
+ *     on an object, never pass them as an argument, never return them.
+ *   - Every host call sits in a try/catch that discards the caught value (a
+ *     host-realm error, e.g. a stack overflow raised inside the host frame,
+ *     must not reach sandbox code).
+ *   - Anything received from the host is used only if it is a string.
+ *   - Intrinsics used on the bridge path are captured up front, so sandbox
+ *     code that patches a prototype only breaks its own helpers.
+ */
+export const BOOTSTRAP_SOURCE = String.raw`"use strict";
+(function (hostSync, hostAsync, liveApiNames) {
+  const G = globalThis;
+  const Err = Error;
+  const Str = String;
+  const P = Promise;
+  const apply = Reflect.apply;
+  const pResolve = Promise.resolve;
+  const pThen = Promise.prototype.then;
+  const jsonStringify = JSON.stringify;
+  const jsonParse = JSON.parse;
+  const isArray = Array.isArray;
+  const defineProperty = Object.defineProperty;
+  const objectKeys = Object.keys;
+  const storeMap = new Map();
+  const mapGet = Map.prototype.get;
+  const mapSet = Map.prototype.set;
+  const mapHas = Map.prototype.has;
+  const mapClear = Map.prototype.clear;
+  const mapForEach = Map.prototype.forEach;
+
+  function callSync(op, a, b) {
+    try {
+      hostSync(op, a, b);
+    } catch (_hostError) {
+      throw new Err("sandbox bridge failure");
+    }
+  }
+
+  // Returns a realm Promise for the JSON text the host answers with.
+  function callAsync(op, payload) {
+    const settled = new P(function (resolve) {
+      try {
+        hostAsync(op, payload, function (error, result) {
+          resolve([
+            typeof error === "string" ? error : null,
+            typeof result === "string" ? result : null,
+          ]);
+        });
+      } catch (_hostError) {
+        resolve(["sandbox bridge failure", null]);
+      }
+    });
+    // The Error is created in this microtask, not under the host's frame.
+    return apply(pThen, settled, [
+      function (pair) {
+        if (pair[0] !== null) {
+          throw new Err(pair[0]);
+        }
+        return pair[1] === null ? undefined : jsonParse(pair[1]);
+      },
+    ]);
+  }
+
+  function describeError(e) {
+    try {
+      if (e !== null && typeof e === "object" && typeof e.message === "string") {
+        const name = typeof e.name === "string" && e.name !== "Error" ? e.name + ": " : "";
+        return name + e.message;
+      }
+      return Str(e);
+    } catch (_e) {
+      return "error";
+    }
+  }
+
+  function joinArgs(args) {
+    let out = "";
+    for (let i = 0; i < args.length; i++) {
+      out += (i === 0 ? "" : " ") + Str(args[i]);
+    }
+    return out;
+  }
+
+  function define(name, value) {
+    defineProperty(G, name, { value: value, writable: true, configurable: true, enumerable: false });
+  }
+
+  // --- Output capture ---
+  define("print", function (...args) {
+    callSync("print", joinArgs(args));
+  });
+  define("console", {
+    log: function (...args) {
+      callSync("print", joinArgs(args));
+    },
+    info: function (...args) {
+      callSync("print", joinArgs(args));
+    },
+    error: function (...args) {
+      callSync("print", "ERROR: " + joinArgs(args));
+    },
+    warn: function (...args) {
+      callSync("print", "WARN: " + joinArgs(args));
+    },
+  });
+
+  // --- LLM recursive sub-calls ---
+  function optionalText(value) {
+    return value === undefined || value === null ? undefined : Str(value);
+  }
+  define("llm_query", function (prompt, subContext) {
+    return callAsync(
+      "llm_query",
+      jsonStringify({ prompt: Str(prompt), context: optionalText(subContext) }),
+    );
+  });
+  define("llm_query_parallel", function (queries) {
+    if (!isArray(queries)) {
+      return apply(pResolve, P, [undefined]).then(function () {
+        throw new TypeError("llm_query_parallel expects an array of { prompt, context }");
+      });
+    }
+    const normalized = [];
+    for (let i = 0; i < queries.length; i++) {
+      const q = q
```

**File**: `src/agents/rlm/sandbox.escape.test.ts` (added, +579/-0)
```diff
@@ -0,0 +1,579 @@
+/**
+ * The RLM sandbox runs code written by a sub-LLM that reads attacker-influenced
+ * text. Before 2026-11-19 it was seeded with host-realm objects, so
+ * `Error.constructor("return process")()` returned the gateway's `process`
+ * (security report, same class as the code_interpreter escape of 2026-09-20).
+ *
+ * Every probe below tries to reach the HOST realm. `typeof process` evaluated
+ * through a host Function is "object"; anything else means the probe failed.
+ * A probe passes the test when it cannot produce "object".
+ */
+import { afterEach, describe, expect, it } from "vitest";
+import { applyOwnerOnlyToolPolicy, isOwnerOnlyToolName } from "../tool-policy.js";
+import { RLMSandbox, sandboxPermissionFlagForTest } from "./sandbox.js";
+
+const sandboxes: RLMSandbox[] = [];
+
+function sandbox(): RLMSandbox {
+  const sb = new RLMSandbox({
+    context: "some context",
+    timeout: 3000,
+    onLLMQuery: async (prompt) => `echo:${prompt}`,
+    onLLMQueryParallel: async (queries) => queries.map((q) => `echo:${q.prompt}`),
+    liveApis: {
+      search: async (query) => [{ snippet: `hit ${query}`, score: 1, source: "memory" }],
+      loadTranscript: async () => "[t] USER: hi",
+      listSessions: async () => {
+        throw new Error("db locked");
+      },
+    },
+  });
+  sandboxes.push(sb);
+  return sb;
+}
+
+/** JS (sandbox side) that tries to turn `expr` into the host process. */
+function probe(expr: string): string {
+  return `
+    let verdict = "no-escape";
+    try {
+      const target = ${expr};
+      const F = target.constructor.constructor;
+      const proc = F("return typeof process")();
+      verdict = "ESCAPED:" + proc;
+    } catch (e) {
+      verdict = "blocked";
+    }
+    print(verdict);
+  `;
+}
+
+afterEach(() => {
+  for (const sb of sandboxes.splice(0)) {
+    sb.dispose();
+  }
+});
+
+describe("RLM sandbox: no host realm reachable", () => {
+  it("blocks the reported primitive", async () => {
+    const result = await sandbox().execute(
+      `let v = "blocked"; try { v = "ESCAPED:" + typeof Error.constructor("return process")(); } catch (e) {} print(v);`,
+    );
+    expect(result.output).toBe("blocked");
+  });
+
+  // Each of these was a host-realm object (or returned one) before the fix.
+  const targets: Array<[string, string]> = [
+    ["an intrinsic", "JSON"],
+    ["a class", "Promise"],
+    ["print", "print"],
+    ["console.log", "console.log"],
+    ["a text helper", "grep"],
+    ["store", "store"],
+    ["FINAL", "FINAL"],
+    ["llm_query", "llm_query"],
+    ["the llm_query promise", 'llm_query("x")'],
+    ["the llm_query result", 'await llm_query("x")'],
+    ["the llm_query_parallel result", 'await llm_query_parallel([{ prompt: "a" }])'],
+    ["the search promise", 'search("q")'],
+    ["the search result array", 'await search("q")'],
+    ["a search result row", '(await search("q"))[0]'],
+    ["the listSessions error row", "(await listSessions())[0]"],
+    ["the run driver", "__rlm_run"],
+    ["the global", "globalThis"],
+    ["this", "this"],
+    ["a helper's return value", 'chunk("abcdef", 2)'],
+    ["textStats output", 'textStats("a b")'],
+    ["a regexp match list", 'extractAll("a b", "a")'],
+  ];
+  for (const [label, expr] of targets) {
+    it(`cannot pivot through ${label}`, async () => {
+      const result = await sandbox().execute(probe(expr));
+      expect(result.output).not.toContain("ESCAPED");
+      expect(result.output).toBe("blocked");
+    });
+  }
+
+  it("has no host constructor or host global on the global", async () => {
+    const sb = sandbox();
+    const result = await sb.execute(
+      `print(typeof process, typeof require, typeof Buffer, typeof setTimeout);`,
+    );
+    expect(result.output).toBe("undefined undefined undefined undefined");
+    // A bare `constructor` resolves to the realm's own Object, never the host's.
+    expect((await sb.execute(probe("constructor"))).output).toBe("blocked");
+    expect((await sb.execute(probe("{ constructor }"))).output).toBe("blocked");
+  });
+
+  it("disables eval and Function(string) in the realm", async () => {
+    const result = await sandbox().execute(`
+      const out = [];
+      try { eval("1"); out.push("eval-ran"); } catch (e) { out.push("eval-blocked"); }
+      try { (function(){}).constructor("return 1")(); out.push("fn-ran"); } catch (e) { out.push("fn-blocked"); }
+      try { (async function(){}).constructor("return 1"); out.push("afn-ran"); } catch (e) { out.push("afn-blocked"); }
+      print(out.join(","));
+    `);
+    expect(result.output).toBe("eval-blocked,fn-blocked,afn-blocked");
+  });
+
+  it("values imported into the store are realm objects", async () => {
+    const sb = sandbox();
+    sb.importStore({ planted: { nested: [1, 2, 3] } });
+    const result = await sb.execute(
+      `{${probe('get("planted")')}} {${probe('get("planted").nested')}} print(get("planted").nested[2]);`,
+    );
+    expect(
```

**File**: `src/agents/rlm/sandbox.ts` (modified, +535/-241)
```diff
@@ -1,15 +1,60 @@
 /**
- * RLM Sandbox — Secure JavaScript execution environment using Node.js vm module.
+ * RLM Sandbox — runs LLM-written JavaScript that explores a loaded context
+ * string. No filesystem, network API, or require access is offered to it.
  *
- * The sandbox provides a minimal, isolated REPL where LLM-generated code can
- * explore a loaded context string. No filesystem, network, or require access.
+ * SECURITY (report by Aleksandr Tynianov, 2026-11-19: deep_recall RLM sandbox
+ * escape -> host RCE). The code that runs here is written by a sub-LLM that
+ * reads attacker-influenced text, so it is treated as hostile. The previous
+ * implementation ran it in a node:vm context inside the gateway and seeded
+ * that context with host-realm objects; one constructor-chain hop
+ * (`Error.constructor("return process")()`) reached the gateway's `process`.
+ *
+ * There are now two independent layers.
+ *
+ * Layer 1, process isolation (this file). The vm lives in a separate `node`
+ * process, never in the gateway:
+ *
+ *   - started with an EMPTY environment (no API keys, no tokens);
+ *   - under the Node permission model: no filesystem, no child processes, no
+ *     worker threads, no native addons (the program arrives on stdin, so not
+ *     even its own script needs to be readable);
+ *   - with a capped heap, so runaway allocation kills the child, not the
+ *     gateway;
+ *   - killed outright when a run overruns its deadline, which is what stops a
+ *     loop that spins after an `await` (the vm timeout only bounds synchronous
+ *     code).
+ *
+ *   The gateway talks to it over an IPC channel carrying JSON. Every message
+ *   from the child is untrusted and type-checked; the only things it can ask
+ *   for are the same bridged calls sandbox code may make anyway (llm_query,
+ *   search, loadTranscript, listSessions), and only while a run is in flight.
+ *   The gateway never evaluates anything the child sends.
+ *
+ * Layer 2, realm hardening (sandbox-child-source.ts, vm-realm-hardening.ts).
+ * Inside the child, no object of the child's own main realm is reachable from
+ * sandbox code: null-prototype global, code generation off, every helper
+ * defined inside the realm, a two-function string-only bridge, stack capture
+ * pinned off, the `import` keyword refused. An escape from layer 2 lands in a
+ * process that holds no secrets and may not touch the disk or spawn anything.
+ *
+ * Not covered: the permission model of Node 22 does not restrict outbound
+ * network access, so code that defeats layer 2 could still open a socket from
+ * the child. It would have only the context string to send.
+ *
+ * State model: the store is the durable state. After every run the child
+ * returns a JSON snapshot of it, and the synchronous accessors below
+ * (exportStore, getVariable, resolveFinalAnswer) read that snapshot, so the
+ * gateway never calls into sandbox code. The child is disposable: it is
+ * stopped when idle and after a timeout, and the next run starts a fresh one
+ * from the snapshot. Realm globals do not survive that; store() does.
  *
  * Based on: "Recursive Language Models" (Zhang, Kraska, Khattab, 2026)
  * Paper: https://arxiv.org/abs/2512.24601
  * Reference: hampton-io/RLM (TypeScript)
  */
 
-import { createContext, Script, type Context } from "node:vm";
+import { spawn, type ChildProcess } from "node:child_process";
+import { SANDBOX_CHILD_SOURCE } from "./sandbox-child-source.js";
 import type { RLMLiveApis, SandboxExecutionResult } from "./types.js";
 
 export type SandboxOptions = {
@@ -27,14 +72,108 @@ export type SandboxOptions = {
 
 /** Cap live-API return payloads so a single call can't blow the REPL loop. */
 const LIVE_API_MAX_CHARS = 400_000;
+/** V8 old-space cap for the sandbox process. */
+const CHILD_HEAP_MB = 512;
+/** How long a new sandbox process may take to report ready. */
+const CHILD_READY_TIMEOUT_MS = 15_000;
+/** An idle sandbox process is stopped after this long; the store snapshot stays. */
+const CHILD_IDLE_MS = 120_000;
+/** Grace on top of the vm timeout before the process is killed. */
+const HARD_TIMEOUT_GRACE_MS = 5_000;
+/** Output accepted from one run (the child stops sending at 1M chars). */
+const MAX_OUTPUT_CHARS = 1_100_000;
+/** Bridged calls (llm_query, search, ...) accepted per run. */
+const MAX_BRIDGE_CALLS_PER_RUN = 500;
+
+/**
+ * Whether this runtime accepts a permission-model flag. Set to null once a
+ * spawn shows it does not (the child is then still a separate process with an
+ * empty environment and a capped heap).
+ */
+let permissionFlag: string | null | undefined;
+
+function resolvePermissionFlag(): string | null {
+  if (permissionFlag === undefined) {
+    const flags = process.allowedNodeEnvironmentFlags;
+    permissionFlag = flags.has("--permission")
+      ? "--permission"
+      : flags.has("--experimental-permission")
+        ? "--experimental-permission"
+        : null;
+  }
+  return permissi
```

**File**: `src/agents/tool-policy.ts` (modified, +6/-0)
```diff
@@ -78,6 +78,12 @@ const OWNER_ONLY_TOOL_NAMES = new Set<string>([
   "code_interpreter",
   "computer_use",
   "browser",
+  // deep_recall runs code written by a sub-LLM that reads attacker-influenced
+  // text (src/agents/rlm/sandbox.ts). It runs in a locked-down child process,
+  // but it is still code execution on the host and it spends money on sub-LLM
+  // calls, so no non-owner sender may drive it (security report 2026-11-19).
+  // recall_range covers a guest's current-session lookups.
+  "deep_recall",
   // Card purchases from the owner's Link account (PLAN-53 C1).
   "purchase",
   // Money. The wallet sends USDC and pays x402 resources with numeric caps as
```

**File**: `src/agents/tools/code-interpreter-tool.sandbox.test.ts` (modified, +37/-0)
```diff
@@ -31,6 +31,43 @@ describe("code_interpreter JS sandbox hardening (security/code-interpreter-vm-es
     });
   }
 
+  // Node host callbacks reachable from plain JS (red-team pass, 2026-11-19):
+  // the errors they throw are host-realm objects, so the payloads below use
+  // only property access, which disabling code generation does not stop.
+  const SHOW = `try { return "ESCAPED:" + typeof e.constructor.constructor("return process")(); } catch (x) { return "blocked"; }`;
+  const hostCallbackPayloads: Array<[string, string]> = [
+    [
+      "stack formatter, symbol name",
+      `const err = new Error("x"); err.name = Symbol(); try { return typeof err.stack; } catch (e) { ${SHOW} }`,
+    ],
+    [
+      "captureStackTrace on a plain object",
+      `const o = { name: Symbol() }; try { Error.captureStackTrace(o); return typeof o.stack; } catch (e) { ${SHOW} }`,
+    ],
+    [
+      "re-enabled stack capture",
+      `try { Error.stackTraceLimit = 10; } catch (_) {} const err = new TypeError("x"); err.name = Symbol(); try { return typeof err.stack; } catch (e) { ${SHOW} }`,
+    ],
+  ];
+  for (const [label, payload] of hostCallbackPayloads) {
+    it(`gets no host error from the ${label}`, async () => {
+      const r = await executeJavaScript(payload, freshSession());
+      expect(r.error).toBeNull();
+      expect(r.returnValue).toBe("undefined");
+    });
+  }
+
+  it("refuses dynamic import (its rejection is a host error)", async () => {
+    const r = await executeJavaScript(
+      `try { await import("x"); } catch (e) { ${SHOW} }`,
+      freshSession(),
+    );
+    expect(String(r.error)).toMatch(/"import" cannot appear/);
+    expect(r.returnValue).toBeNull();
+    const ok = await executeJavaScript(`return "important"`, freshSession());
+    expect(ok.returnValue).toBe("important");
+  });
+
   it("blocks eval() directly", async () => {
     const r = await executeJavaScript(`return eval('1+1')`, freshSession());
     expect(r.error).toBeTruthy();
```

#### Recent Merged Pull Requests:
- **PR #388** (2026-11-19): chore(main): release 1.14.2 (@github-actions[bot])
- **PR #387** (2026-11-19): fix(security): run the deep_recall sandbox in a locked-down process and close vm escapes (@VGIL77)
- **PR #380** (2026-11-18): chore(main): release 1.14.1 (@github-actions[bot])
- **PR #379** (2026-11-18): fix(skills): ship a sidecar that carries the package topic, and fail loudly without one (@VGIL77)
- **PR #378** (2026-11-17): test(installer): do not require a signature check on runners with no verifier (@VGIL77)
- **PR #377** (2026-11-17): feat(skills): cross-agent evidence cards with quorum and guard, replicated and integrated (@VGIL77)

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

## X. security): run the deep_recall sandbox in a locked-down process and close vm esc

**RULE**:
When implementing operations in `docs/memory/deep-recall.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Bitterbot-AI/bitterbot-desktop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ac9552c9`: security): run the deep_recall sandbox in a locked-down process and close vm escapes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/memory/deep-recall.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
`deep_recall` is an owner-only tool, like `code_interpreter`: a non-owner sender's turn does not get it at all, because it runs sub-LLM-written code on the gateway host (see [Sandbox isolation](#sandbox-isolation)). A non-owner turn still has `recall_range` for exact lookups in its own conversation. The scope downgrade below stays in place as a second layer.


## Sandbox isolation

The REPL code is written by a model that reads transcripts, memory and tool output, so it is treated as hostile. Two independent layers contain it.

**A separate process.** The code never runs inside the gateway. Each sandbox is its own `node` process, started with:

- an empty environment (no API keys or tokens),
- the Node permission model: no filesystem access, no child processes, no worker threads, no native addons,
- a 512 MB heap cap.

The gateway talks to it over an IPC channel that carries JSON. The only things the process can ask for are the calls sandbox code is allowed anyway (`llm_query`, `llm_query_parallel`, `search`, `loadTranscript`, `listSessions`), only while a code block is running, and at most 500 per block. A block that overruns its deadline, including one that loops forever after an
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ac9552c9` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
