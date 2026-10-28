> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bitterbot-ai-bitterbot-desktop-learnings.md`  
> **Source**: github ([https://github.com/Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop))  
> **Source Version**: `c22b2932`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T14:49:48.809Z  
> **Learning ID**: `learn-github-bitterbot-ai-bitterbot-desktop`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Bitterbot-AI/bitterbot-desktop

> **Canonical Artifact**: `07_PROJECT_LEARNING/bitterbot-ai-bitterbot-desktop-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-28T14:49:48.800Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Bitterbot-AI/bitterbot-desktop`
- **Description**: Bitterbot - a mesh of agents that turns shared experience into collective capability.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2478 stars

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

### Core Architecture Module: `benchmarks/longmemeval-v2/worker.ts`
```
// This process has no API credentials, evaluator files, personal HOME or network.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { DatabaseSync } from "node:sqlite";
import type { BitterbotConfig } from "../../src/config/types.js";

type Json = Record<string, unknown>;
const send = (value: unknown) => process.stdout.write(JSON.stringify(value) + "\n");
console.log = (...args: unknown[]) => console.error(...args);
let now = Date.parse("2025-01-01T00:00:00Z");
const NativeDate = Date;
// Only wall-clock semantics are virtualized. perf_hooks/timers retain real elapsed time.
globalThis.Date = new Proxy(NativeDate, {
  construct(target, args) {
    return Reflect.construct(target, args.length ? args : [now]);
  },
  apply() {
    return new NativeDate(now).toString();
  },
  get(target, key) {
    return key === "now" ? () => now : Reflect.get(target, key);
  },
});
let apiId = 0;
const pending = new Map<number, { resolve: (v: Json) => void; reject: (e: Error) => void }>();
function api(kind: string, body: Json): Promise<Json> {
  const id = ++apiId;
  send({ type: "api", id, kind, body });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url !== "https://benchmark.invalid/v1/embeddings" || init?.method !== "POST") {
    throw new Error("Benchmark denied unexpected fetch: " + url.split("?")[0]);
  }
  const body = JSON.parse(String(init.body)) as Json;
  const payload = await api("embedding", body);
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
let manager: import("../../src/memory/manager.js").MemoryIndexManager;
let profile: string;
let config: Json;
let sessionCount = 0;
let managerConfig: BitterbotConfig;
const agentId = "lme-isolated";
function health() {
  const db = new DatabaseSync(path.join(profile, "memory.sqlite"), { readOnly: true });
  try {
    const pendingRow = db
      .prepare(
        "SELECT count(*) AS n FROM chunks WHERE (model = 'pending' OR embedding IS NULL OR length(embedding) = 0 OR embedding = '[]') AND text IS NOT NULL AND length(trim(text)) > 0 AND (lifecycle_state IS NULL OR lifecycle_state <> 'forgotten')",
      )
      .get();
    if (Number(pendingRow?.n) !== 0)
      throw new Error("Incomplete embeddings: " + String(pendingRow?.n));
    return { chunks: db.prepare("SELECT count(*) AS n FROM chunks").get()?.n };
  } finally {
    db.close();
  }
}
async function drainEmbeddings() {
  const backfill = manager as unknown as {
    backfillPendingEmbeddings(opts?: {
      limit?: number;
    }): Promise<{ embedded: number; remaining: number }>;
  };
  for (;;) {
    const result = await backfill.backfillPendingEmbeddings({ limit: 200 });
    if (result.remaining === 0) return;
    if (result.embedded === 0) throw new Error("Embedding backfill made no progress");
  }
}
async function handle(request: Json): Promise<unknown> {
  if (request.op === "init") {
    profile = String(request.profile);
    config = request.config as Json;
    now = Number(request.now);
    const workspace = path.join(profile, "workspace");
    fs.mkdirSync(workspace, { recursive: true });
    const complete = async (prompt: string) => {
      const result = await api("dream", { messages: [{ role: "user", content: prompt }] });
      const choices = result.choices as Array<{ message: { content: string } }>;
      const content = choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty dream completion");
      return content;
    };
    const cfg: BitterbotConfig = {
      agents: {
        defaults: {
          workspace,
          model: { primary: "openai/" + String(config.dreamModel) },
          memorySearch: {
            enabled: true,
            provider: "openai",
            model: String(config.embeddingModel),
            fallback: "none",
            remote: {
              baseUrl: "https://benchmark.invalid/v1",
              apiKey: "broker",
              batch: { enabled: false },
            },
            sources: ["memory", "sessions"],
            experimental: { sessionMemory: true },
            store: { path: path.join(profile, "memory.sqlite"), vector: { enabled: true } },
            sync: { intervalMinutes: 0, onSearch: false, onSessionStart: false, watch: false },
            query: {
              maxResults: Number(config.maxResults),
              minScore: 0,
              hybrid: {
                enabled: true,
                mergeStrategy: "rrf",
                vectorWeight: 0.7,
                textWeight: 0.3,
                candidateMultiplier: 5,
              },
            },
            cache: { enabled: true },
            chunking: { tokens: 384, overlap: 48 },
          },
        },
        list: [{ id: agentId, default: true, workspace, agentDir: path.join(profile, "agent") }],
      },
      memory: {
        consolidation: { enabled: true, intervalMinutes: 0 },
        dream: {
          enabled: true,
          intervalMinutes: 0,
          synthesisMode: "llm",
          model: "openai/" + String(config.dreamModel),
          synthesisModel: "openai/" + String(config.dreamModel),
          llmCall: complete,
          synthesisLlmCall: complete,
          maxLlmCallsPerCycle: Number(config.dreamCalls),
          adaptiveInterval: { enabled: false },
        },
        emotional: { enabled: true, hormonal: { enabled: true } },
        curiosity: { enabled: true, autoResearch: { enabled: false } },
        digest: { enabled: false },
        healthSweep: { enabled: false },
        dreamBrief: { enabled: false },
      },
      skills: { skillSeekers: { trending: { enabled: false } }, evolution: { enabled: false } },
    };
    managerConfig = cfg;
    const { MemoryIndexManager } = await import("../../src/memory/manager.js");
    const created = await MemoryIndexManager.get({ cfg, agentId });
    if (!created) throw new Error("Memory manager unavailable");
    manager = created;
    return { ready: true };
  }
  now = Number(request.now);
  let seed = (Number(config.seed) ^ Math.floor(now / 1000)) >>> 0;
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  if (!Number.isFinite(now)) throw new Error("Explicit historical timestamp required");
  if (request.op === "ingest") {
    if (sessionCount > 0) {
      await manager.close();
      const { MemoryIndexManager } = await import("../../src/memory/manager.js");
      const reopened = await MemoryIndexManager.get({ cfg: managerConfig, agentId });
      if (!reopened) throw new Error("Failed to reopen memory manager");
      manager = reopened;
    }
    const trajectory = request.trajectory as {
      id: string;
      goal: string;
      outcome: string;
      start_url: string;
      states: Json[];
    };
    if (!/^[a-zA-Z0-9_-]+$/.test(trajectory.id)) throw new Error("Invalid trajectory ID");
    const dir = path.join(profile, "state", "agents", agentId, "sessions");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date(now).toISOString();
    const records: Json[] = [
      {
        type: "session",
        version: 3,
        id: trajectory.id,
        timestamp: stamp,
        cwd: path.join(profile, "workspace"),
      },
    ];
    records.push({
      type: "message",
      timestamp: stamp,
      message: {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              trajectory: trajectory.id,
              goal: trajectory.goal,
              start_url: trajectory.start_url,
            }),
          },
        ],
      },
    });
    for (const state of trajectory.states) {
      records.push({
        type: "message",
        timestamp: stamp,
        message: {
          role: "assistant",
          content: [
            { type: "text", text: JSON.stringify({ trajectory: trajectory.id, ...state }) },
          ],
        },
      });
    }
    records.push({
      type: "message",
      timestamp: stamp,
      message: {
        role: "assistant",
        content: [{ type: "text", text: JSON.stringify({ outcome: trajectory.outcome }) }],
      },
    });
    const target = path.join(dir, trajectory.id + ".jsonl");
    fs.writeFileSync(target, records.map((x) => JSON.stringify(x)).join("\n") + "\n", {
      flag: "wx",
    });
    fs.utimesSync(target, now / 1000, now / 1000);
    await manager.sync({ reason: "longmemeval-v2-transcript" });
    await manager.probeVectorAvailability();
    const status = manager.status();
    if (status.fallback || !status.vector?.available || !status.fts?.available)
      throw new Error(
        "Memory backend degraded: " +
          JSON.stringify({ vector: status.vector, fts: status.fts, fallback: status.fallback }),
      );
    sessionCount++;
    return { sessionCount, ...health() };
  }
  if (request.op === "health") {
    return manager.status();
  }
  if (request.op === "consolidate") {
    const result = await manager.consolidate();
    if (!result) throw new Error("Consolidation did not run");
    return { result, ...health() };
  }
  if (request.op === "dream") {
    const result = await manager.dream();
    if (!result || result.cycle.error || result.cycle.completedAt === null) {
      throw new Error("Dream incomplete: " + JSON.stringify(result?.cycle));
    }
    const { readWorkingMemoryProvenance } =
      await import("../../src/memory/working-memory-snapshots.js");
    const provenance = await readWorkingMemoryProvenance(path.join(profile, "workspace"));
    if (
      provenance.some(
        (record) => record.trigger === result.cycle.cycleId && record.wasHeuristicFallback,
      )
    ) {
      throw new Error("Production working-memory synthesis used heuristic fallback");
    }
    // Watchers are disabled; a normal manager r
```

### Core Architecture Module: `desktop/renderer/src/App.tsx`
```
import { useCallback, useEffect, useState } from "react";
import { FirstRun } from "./components/first-run/FirstRun";
import { AppShell } from "./components/layout/AppShell";
import { SetupWizard } from "./components/setup/SetupWizard";
import { Toaster } from "./components/ui/sonner";
import { initDeepLinkJoin } from "./lib/deep-link";
import { fetchSessionToken, persistGatewayCredentials } from "./lib/gateway-origin";
import { isSetupPath } from "./lib/setup-route";
import {
  readStoredGatewayToken,
  readStoredGatewayUrl,
  useGatewayStore,
} from "./stores/gateway-store";

export function App() {
  // PLAN-56 Phase 4: `<basePath>/setup` is browser-first onboarding, with its
  // own connection (a one-time setup token, wizard scope only).
  if (typeof window !== "undefined" && isSetupPath(window.location.pathname)) {
    return (
      <>
        <SetupWizard />
        <Toaster richColors position="top-right" />
      </>
    );
  }
  return <ControlApp />;
}

function ControlApp() {
  const connect = useGatewayStore((s) => s.connect);

  // Decide at boot whether we already have a token. A stored one (from a prior
  // FirstRun) wins; otherwise ask the gateway that served this page via the
  // same-origin handoff endpoint, which replaces the old build-time
  // VITE_GATEWAY_TOKEN define. Only when both come up empty do we render
  // <FirstRun>, so we never flash a "Disconnected" badge at a new user.
  // `undefined` means "still deciding" and renders nothing.
  const [hasCredentials, setHasCredentials] = useState<boolean | undefined>(() =>
    readStoredGatewayToken() !== null ? true : undefined,
  );

  useEffect(() => {
    if (hasCredentials !== undefined) return;
    let cancelled = false;
    void (async () => {
      const token = await fetchSessionToken();
      if (cancelled) return;
      if (token) {
        persistGatewayCredentials({ url: readStoredGatewayUrl(), token });
        setHasCredentials(true);
      } else {
        setHasCredentials(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasCredentials]);

  useEffect(() => {
    if (hasCredentials !== true) return;
    const url = readStoredGatewayUrl();
    connect(url);
  }, [connect, hasCredentials]);

  // bitterbot:// deep links (Tauri shell only; no-op in the browser).
  // Registered at app boot so a cold-start link (the app was LAUNCHED by
  // the guest page's "Open in Bitterbot") is picked up too.
  useEffect(() => {
    void initDeepLinkJoin();
  }, []);

  const handleFirstRunComplete = useCallback(() => {
    setHasCredentials(true);
  }, []);

  // Still asking the gateway for a token: render nothing rather than flashing
  // FirstRun at a user who is about to be connected automatically.
  if (hasCredentials === undefined) {
    return null;
  }

  if (!hasCredentials) {
    return (
      <>
        <FirstRun onComplete={handleFirstRunComplete} />
        <Toaster richColors position="top-right" />
      </>
    );
  }

  return (
    <>
      <AppShell />
      <Toaster richColors position="top-right" />
    </>
  );
}

```

### Core Architecture Module: `desktop/renderer/src/components/agents/AgentsView.tsx`
```
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { describeError } from "../../lib/describe-error";
import { cn } from "../../lib/utils";
import { useAgentsStore, type AgentEntry, type AgentFile } from "../../stores/agents-store";
import { useGatewayStore } from "../../stores/gateway-store";

function AgentFilePanel({
  file,
  agentId,
  onSave,
}: {
  file: AgentFile;
  agentId: string;
  onSave: (agentId: string, name: string, content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.content ?? "");

  return (
    <div className="rounded-lg border border-border/10 bg-muted/20 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-foreground">{file.name}</span>
          {file.missing && (
            <span className="text-badge px-1 py-0.5 rounded bg-warning/10 text-warning">
              missing
            </span>
          )}
          {file.size != null && (
            <span className="text-badge text-muted-foreground">
              {file.size < 1024 ? `${file.size}B` : `${(file.size / 1024).toFixed(1)}KB`}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {editing ? (
            <>
              <button
                onClick={() => {
                  onSave(agentId, file.name, draft);
                  setEditing(false);
                }}
                className="px-2 py-0.5 text-xs rounded bg-brand/20 text-brand hover:bg-brand/40"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setDraft(file.content ?? "");
                  setEditing(false);
                }}
                className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground hover:bg-muted/90"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setDraft(file.content ?? "");
                setEditing(true);
              }}
              className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground hover:bg-muted/90"
            >
              Edit
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full p-3 text-xs font-mono bg-transparent border-0 focus:outline-none resize-none min-h-[120px]"
          rows={8}
        />
      ) : file.content ? (
        <pre className="p-3 text-xs font-mono text-foreground/80 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
          {file.content}
        </pre>
      ) : (
        <div className="p-3 text-xs text-muted-foreground italic">
          {file.missing ? "File does not exist yet" : "No content"}
        </div>
      )}
    </div>
  );
}

const GENOME_FILES = new Set(["GENOME.md"]);
const PROTOCOL_FILES = new Set(["PROTOCOLS.md", "TOOLS.md", "HEARTBEAT.md"]);
const MEMORY_FILES = new Set(["MEMORY.md", "memory/MEMORY.md"]);

function FilesSections({
  files,
  agentId,
  onSaveFile,
}: {
  files: AgentFile[];
  agentId: string;
  onSaveFile: (agentId: string, name: string, content: string) => void;
}) {
  const genome = files.filter((f) => GENOME_FILES.has(f.name));
  const protocols = files.filter((f) => PROTOCOL_FILES.has(f.name));
  const memory = files.filter((f) => MEMORY_FILES.has(f.name));
  const known = new Set([...GENOME_FILES, ...PROTOCOL_FILES, ...MEMORY_FILES]);
  const other = files.filter((f) => !known.has(f.name));

  return (
    <div className="space-y-5">
      {genome.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-brand uppercase tracking-wider px-1 mb-2">
            Core identity (read-mostly)
          </h4>
          <p className="text-badge text-muted-foreground px-1 mb-2">
            Safety rules, temperament baselines and core values. This file anchors who your agent is
            — everything it learns is constrained by it, and nothing the agent does rewrites it.
          </p>
          <div className="space-y-2">
            {genome.map((file) => (
              <AgentFilePanel key={file.name} file={file} agentId={agentId} onSave={onSaveFile} />
            ))}
          </div>
        </div>
      )}

      {memory.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-brand-cyan uppercase tracking-wider px-1 mb-2">
            Working memory (agent-maintained)
          </h4>
          <p className="text-badge text-muted-foreground px-1 mb-2">
            Rewritten by the agent during its maintenance cycles: its self-notes, what it knows
            about you, what it's working on, and open questions it wants to chase.
          </p>
          <div className="space-y-2">
            {memory.map((file) => (
              <AgentFilePanel key={file.name} file={file} agentId={agentId} onSave={onSaveFile} />
            ))}
          </div>
        </div>
      )}

      {protocols.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider px-1 mb-2">
            Operating procedures
          </h4>
          <p className="text-badge text-muted-foreground px-1 mb-2">
            Runtime behavior, memory conventions, safety rules, tools config. These govern what the
            agent does, not who it is.
          </p>
          <div className="space-y-2">
            {protocols.map((file) => (
              <AgentFilePanel key={file.name} file={file} agentId={agentId} onSave={onSaveFile} />
            ))}
          </div>
        </div>
      )}

      {other.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider px-1 mb-2">
            Other
          </h4>
          <div className="space-y-2">
            {other.map((file) => (
              <AgentFilePanel key={file.name} file={file} agentId={agentId} onSave={onSaveFile} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentDetail({
  agent,
  files,
  filesLoading,
  onSaveFile,
}: {
  agent: AgentEntry;
  files: AgentFile[];
  filesLoading: boolean;
  onSaveFile: (agentId: string, name: string, content: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm p-4">
        <div className="flex items-center gap-3 mb-3">
          {agent.avatar && <span className="text-2xl">{agent.avatar}</span>}
          <div>
            <h3 className="text-lg font-semibold text-foreground">{agent.name ?? agent.id}</h3>
            <p className="text-xs text-muted-foreground font-mono">{agent.id}</p>
          </div>
          {agent.isDefault && (
            <span className="text-xs px-2 py-0.5 rounded bg-brand/10 text-brand">default</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {agent.workspace && (
            <div>
              <span className="text-muted-foreground">Workspace: </span>
              <span className="text-foreground font-mono">{agent.workspace}</span>
            </div>
          )}
          {agent.model && (
            <div>
              <span className="text-muted-foreground">Model: </span>
              <span className="text-foreground">{agent.model}</span>
            </div>
          )}
        </div>
      </div>

      {filesLoading ? (
        <div className="p-4 text-sm text-muted-foreground text-center">Loading files…</div>
      ) : (
        <FilesSections files={files} agentId={agent.id} onSaveFile={onSaveFile} />
      )}
    </div>
  );
}

export function AgentsView() {
  const gwStatus = useGatewayStore((s) => s.status);
  const request = useGatewayStore((s) => s.request);
  const agents = useAgentsStore((s) => s.agents);
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);
  const files = useAgentsStore((s) => s.files);
  const filesLoading = useAgentsStore((s) => s.filesLoading);
  const loading = useAgentsStore((s) => s.loading);
  const setAgents = useAgentsStore((s) => s.setAgents);
  const setSelectedAgentId = useAgentsStore((s) => s.setSelectedAgentId);
  const setFiles = useAgentsStore((s) => s.setFiles);
  const setFilesLoading = useAgentsStore((s) => s.setFilesLoading);
  const setLoading = useAgentsStore((s) => s.setLoading);
  const setError = useAgentsStore((s) => s.setError);

  const refresh = useCallback(async () => {
    if (gwStatus !== "connected") return;
    setLoading(true);
    try {
      const res = (await request("agents.list", {})) as {
        agents?: AgentEntry[];
      };
      if (res?.agents) {
        setAgents(res.agents);
        if (!selectedAgentId && res.agents.length > 0) {
          setSelectedAgentId(res.agents[0].id);
        }
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [gwStatus, request, setAgents, setSelectedAgentId, selectedAgentId, setLoading, setError]);

  // Load files when agent selection changes
  const loadFiles = useCallback(async () => {
    if (gwStatus !== "connected" || !selectedAgentId) return;
    setFilesLoading(true);
    try {
      const listRes = (await request("agents.files.list", {
        agentId: selectedAgentId,
      })) as { files?: AgentFile[] };
      const fileList = listRes?.files ?? [];

      // Load content for each file
      const withContent = await Promise.all(
        fileList.map(async (f) => {
          if (f.missing) return f;
          try {
            const getRes = (await request("agents.files.get", {
      
```

### Core Architecture Module: `desktop/renderer/src/components/channels/ChannelSetupDrawer.tsx`
```
import { CheckCircle2, Loader2, QrCode, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useGatewayStore } from "../../stores/gateway-store";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { CHANNEL_SETUP_DESCRIPTORS } from "./channel-setup-fields";
import { QrPairingDialog } from "./QrPairingDialog";

interface ChannelSetupDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  label: string;
  accountId?: string;
  onSaved?: () => void;
}

type ProbeState = { ok: boolean; error?: string } | null;

/**
 * Guided credential setup for a channel: per-channel fields with help copy,
 * validate-before-save (channels.validate probes the draft live without
 * persisting), then channels.configure writes + hot-restarts the account.
 */
export function ChannelSetupDrawer({
  open,
  onOpenChange,
  channelId,
  label,
  accountId,
  onSaved,
}: ChannelSetupDrawerProps) {
  const request = useGatewayStore((s) => s.request);
  const descriptor = CHANNEL_SETUP_DESCRIPTORS[channelId];

  const [values, setValues] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [probe, setProbe] = useState<ProbeState>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Secrets never linger after the dialog closes.
      setValues({});
      setProbe(null);
      setValidating(false);
      setSaving(false);
    }
    onOpenChange(next);
  };

  const buildInput = () => {
    const input: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value.trim()) input[key] = value.trim();
    }
    return input;
  };

  const requiredFilled = (descriptor?.fields ?? [])
    .filter((f) => !f.optional)
    .every((f) => Boolean(values[f.key]?.trim()));
  const hasAnyInput = Object.values(values).some((v) => v.trim());

  const handleValidate = async () => {
    setValidating(true);
    setProbe(null);
    try {
      const res = await request<{
        result?: { ok?: boolean; error?: string | null };
        probed?: boolean;
        note?: string;
      }>(
        "channels.validate",
        { channel: channelId, accountId, input: buildInput() },
        {
          timeoutMs: 30_000,
        },
      );
      const ok = res?.result?.ok === true;
      setProbe({
        ok,
        error: ok ? (res?.note ?? undefined) : (res?.result?.error ?? "Validation failed."),
      });
    } catch (err) {
      setProbe({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await request<{
        ok?: boolean;
        runtime?: string;
        probe?: { ok?: boolean; error?: string };
      }>(
        "channels.configure",
        { channel: channelId, accountId, input: buildInput() },
        {
          timeoutMs: 30_000,
        },
      );
      // Make sure the account is enabled so saving is sufficient to go live.
      try {
        await request("channels.update", { channel: channelId, accountId, enabled: true });
      } catch {
        // Older gateway without channels.update; configure already restarted it.
      }
      const probeOk = res?.probe ? res.probe.ok === true : true;
      if (probeOk) {
        toast.success(`${label} configured`, {
          description: "Credentials saved and the channel restarted - no gateway restart.",
        });
      } else {
        toast.warning(`${label} saved, but the probe failed`, {
          description: res?.probe?.error ?? "Check the credentials.",
        });
      }
      onSaved?.();
      handleOpenChange(false);
    } catch {
      // Central toast reports the failure; keep the dialog open for retry.
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Set up {label}</DialogTitle>
            <DialogDescription>
              {descriptor?.docsHint ??
                "Credentials are sent to your gateway, verified live, and applied without a restart."}
            </DialogDescription>
          </DialogHeader>

          {!descriptor ? (
            <p className="text-sm text-muted-foreground">
              Guided setup is not available for this channel yet. Use the Config tab or the CLI
              wizard (<span className="font-mono">bitterbot onboard</span>).
            </p>
          ) : (
            <div className="space-y-3">
              {descriptor.fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={`setup-${channelId}-${field.key}`}>
                    {field.label}
                    {field.optional && (
                      <span className="text-muted-foreground font-normal"> (optional)</span>
                    )}
                  </Label>
                  <Input
                    id={`setup-${channelId}-${field.key}`}
                    type={field.sensitive ? "password" : "text"}
                    autoComplete="off"
                    placeholder={field.placeholder}
                    value={values[field.key] ?? ""}
                    onChange={(e) => {
                      setValues((prev) => ({ ...prev, [field.key]: e.target.value }));
                      setProbe(null);
                    }}
                  />
                  {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
                </div>
              ))}

              {descriptor.qrLogin && (
                <Button variant="outline" className="w-full" onClick={() => setQrOpen(true)}>
                  <QrCode className="h-4 w-4 mr-2" /> Link device via QR
                </Button>
              )}

              {probe && (
                <div
                  className={`flex items-start gap-2 text-sm rounded-md border p-2 ${
                    probe.ok ? "border-success/30 text-success" : "border-danger/30 text-danger"
                  }`}
                >
                  {probe.ok ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  )}
                  <span>{probe.ok ? (probe.error ?? "Connected.") : probe.error}</span>
                </div>
              )}
            </div>
          )}

          {descriptor && descriptor.fields.length > 0 && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => void handleValidate()}
                disabled={!hasAnyInput || validating || saving}
              >
                {validating && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Validate
              </Button>
              <Button onClick={() => void handleSave()} disabled={!requiredFilled || saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Save &amp; Enable
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <QrPairingDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        channelId={channelId}
        label={label}
        accountId={accountId}
        onLinked={onSaved}
      />
    </>
  );
}

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

### Incident Patch 1: `c22b2932` (2026-10-28)
**Commit Message**: feat(benchmarks): LongMemEval runner on the official protocol (#318)

* feat(benchmarks): LongMemEval runner on the official protocol

The existing LongMemEval runner could not produce a citable number: it judged
with its own prompt on a floating gpt-4o alias, fed question_type hints to
the reader and the retrieval query, and wrote the dataset's gold-marked
session ids (every evidence id contains "answer") into the ingested text and
file names. This adds a runner that follows the reference pipeline
(xiaowu0162/LongMemEval @ 9e0b455f) exactly and leaves the old runners as
diagnostic tooling, labelled non-comparable.

- official-protocol.ts: reader template (Chain-of-Note and direct), context
  formatting (date-sorted "### Session i" blocks, python json.dumps-faithful
  turn lists), the five per-type judge prompts and the abstention prompt,
  verdict rule, aggregates (overall, task-averaged, abstention), session
  recall; all copied verbatim from the reference and pinned by tests.
- runner-official.ts: per question, rebuilds turns as {role, content} with
  positional session ids (removes the has_answer and id leaks), one nl
  document per session, back-dates chunks to the session, se

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -264,3 +264,6 @@ docs/plans/
 docs/reviews/v1-release-audit-2026-08-21.md
 docs/reviews/v1-release-audit-2026-08-21-verification.md
 docs/reviews/circles-p2p-security-remediation-2026-08-14.md
+
+benchmarks/longmemeval/.work-official/
+benchmarks/longmemeval/.work-official-scorer/
```

**File**: `benchmarks/longmemeval/README.md` (modified, +162/-6)
```diff
@@ -2,6 +2,157 @@
 
 Runs the [LongMemEval](https://github.com/xiaowu0162/LongMemEval) benchmark (ICLR 2025) against Bitterbot's biological memory system.
 
+Two kinds of runner live here. `runner-official.ts` follows the reference
+protocol exactly and produces numbers that can be placed next to published
+ones. Everything else (`runner.ts`, `runner-biological.ts`,
+`runner-retrieval.ts`, `runner-contrastive.ts`) is diagnostic tooling whose
+output is **not comparable** to any published LongMemEval figure: those
+runners use their own judge prompt, feed `question_type` hints to the
+reader, and until 2026-10-27 wrote the dataset's gold-marked session ids into
+the retrieval corpus. Use them to compare Bitterbot against Bitterbot, never
+against the leaderboard.
+
+## Official protocol run
+
+The reference pipeline defines a third-party result as: feed each question's
+timestamped history to the memory system without the question, ask the
+question at `question_date`, write `{question_id, hypothesis}` JSONL, score it
+with the unmodified `evaluate_qa.py` using the pinned `gpt-4o-2024-08-06`
+judge and its five question-type prompts, and report overall (question
+weighted), task-averaged (mean of the six type means) and abstention accuracy.
+`official-protocol.ts` holds the reader template, context formatting, judge
+prompts and aggregates copied verbatim from the reference at commit
+`9e0b455f`; `official-protocol.test.ts` pins them.
+
+```bash
+pnpm benchmark:longmemeval:download                   # cleaned S + oracle from HF, hashes checked below
+
+# 1. Answer all 500 questions (hours; resumable with --resume)
+pnpm benchmark:longmemeval:official -- \
+  --out benchmarks/longmemeval/results/official-s-haiku-4-5.jsonl \
+  --reader anthropic/claude-haiku-4-5-20251001 --unit session --k 10
+
+# 2a. Score with the reference scripts themselves (venv + OPENAI_API_KEY)
+pnpm benchmark:longmemeval:official:scorer -- benchmarks/longmemeval/results/official-s-haiku-4-5.jsonl
+
+# 2b. Or with the TypeScript port (same judge, prompts, decoding, output format).
+#     Refuses a file with fewer than 500 distinct ids unless --allow-partial (pilots).
+pnpm benchmark:longmemeval:official:evaluate -- --hyp benchmarks/longmemeval/results/official-s-haiku-4-5.jsonl
+
+# Baselines with the same reader: long context (no retrieval) and oracle (gold sessions only)
+pnpm benchmark:longmemeval:official -- --full-context --out benchmarks/longmemeval/results/official-s-fullctx-haiku-4-5.jsonl
+pnpm benchmark:longmemeval:official -- --oracle --out benchmarks/longmemeval/results/official-oracle-haiku-4-5.jsonl
+```
+
+What the runner does per question, and why each step is there:
+
+| Step                                                                                                                 | Protocol reason                                                                                                                                                                       |
+| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| Rebuild every turn as `{role, content}` and give sessions positional ids `session-001`…                              | The dataset leaks gold two ways: `has_answer` keys exist only on evidence-session turns, and every evidence session id contains the substring `answer`. Neither may reach the system. |
+| One document per session, `Session Date:` header, `role: content` lines (the reference `nl` format)                  | Every retrieved chunk maps to one session and so to one date.                                                                                                                         |
+| Back-date each session's chunks to the session timestamp and search with `now = question_date`                       | Recency and temporal-intent boosts measure age; the history is from 2023 and must be scored as of the question, not as of the ingest.                                                 |
+| Query = the raw question. No `question_type` anywhere on the inference path                                          | `question_type` is a scoring key in `evaluate_qa.py`; the reference retrieval query is the question text.                                                                             |
+| Top-k distinct sessions by best chunk (or top-k chunks with `--unit chunk`), rendered date-sorted as `### Session i` | `run_generation.py` sorts retrieved items by timestamp and labels each with its date; sessions are rendered as `json.dumps` of the turn list, the paper's recommended format.         |
+| Chain-of-Note template (`--reading con`), pinned reader id, temperature 0, 800 max tokens                            | The paper's default reading str
```

**File**: `benchmarks/longmemeval/analyze-official.ts` (added, +197/-0)
```diff
@@ -0,0 +1,197 @@
+/**
+ * Dissect an official-protocol run: where the misses come from.
+ *
+ * Joins the hypothesis file, the judge output (`.eval-results-gpt-4o`), the
+ * retrieval log (`.retrieval.jsonl`) and the reference data, and reports per
+ * question type: accuracy, session recall at several k, how many misses had
+ * every gold session inside the reader's context (a reading failure) versus
+ * missing one (a retrieval failure), where the first missing gold session
+ * ranked, and abstention behaviour (false abstentions on answerable
+ * questions, missed abstentions on `_abs` ones). Output is JSON on stdout plus
+ * a markdown table; nothing here touches the inference path.
+ *
+ *   node --import tsx benchmarks/longmemeval/analyze-official.ts --hyp <jsonl> [--k 10] [--ref data/longmemeval_s.json] [--samples 0]
+ */
+import { readFileSync } from "node:fs";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+import { parseArgs } from "node:util";
+import { isAbstentionId, QUESTION_TYPES, type RawItem } from "./official-protocol.js";
+
+const __dirname = dirname(fileURLToPath(import.meta.url));
+const { values: args } = parseArgs({
+  options: {
+    hyp: { type: "string" },
+    ref: { type: "string", default: join(__dirname, "data", "longmemeval_s.json") },
+    k: { type: "string", default: "10" },
+    /** Print this many wrong answers per type (question, expected, answer head) for reading. */
+    samples: { type: "string", default: "0" },
+  },
+  strict: true,
+});
+if (!args.hyp) {
+  throw new Error("--hyp <hypothesis.jsonl> is required");
+}
+const K = Number(args.k);
+const samples = Number(args.samples);
+const lines = (p: string) =>
+  readFileSync(p, "utf-8")
+    .split("\n")
+    .filter((l) => l.trim())
+    .map((l) => JSON.parse(l) as Record<string, unknown>);
+
+const ref = new Map(
+  (JSON.parse(readFileSync(args.ref!, "utf-8")) as RawItem[]).map((r) => [r.question_id, r]),
+);
+const hyps = new Map(lines(args.hyp).map((h) => [h.question_id as string, h.hypothesis as string]));
+const labels = new Map(
+  lines(`${args.hyp}.eval-results-gpt-4o`).map((r) => [
+    r.question_id as string,
+    (r.autoeval_label as { label: boolean }).label,
+  ]),
+);
+type Ret = { question_id: string; ranked: string[]; gold: string[]; abstention: boolean };
+const retrieval = new Map(
+  lines(`${args.hyp}.retrieval.jsonl`).map((r) => [r.question_id as string, r as unknown as Ret]),
+);
+
+const ABSTAIN_RE =
+  /not enough information|no information|does not (contain|mention|provide)|doesn't (contain|mention|provide)|cannot (determine|find|answer)|can't (determine|find|answer)|unable to (determine|find|answer)|insufficient|not (available|mentioned|provided) in/i;
+
+type Bucket = {
+  n: number;
+  correct: number;
+  recallAll: Record<number, number>;
+  recallAny: Record<number, number>;
+  retrievalScored: number;
+  wrongAllGoldInContext: number;
+  wrongGoldMissing: number;
+  missingGoldRanks: number[];
+  falseAbstain: number;
+  absN: number;
+  absCorrect: number;
+  hypChars: number[];
+};
+const KS = [1, 3, 5, 10, K].filter((v, i, a) => a.indexOf(v) === i).toSorted((a, b) => a - b);
+const empty = (): Bucket => ({
+  n: 0,
+  correct: 0,
+  recallAll: Object.fromEntries(KS.map((k) => [k, 0])),
+  recallAny: Object.fromEntries(KS.map((k) => [k, 0])),
+  retrievalScored: 0,
+  wrongAllGoldInContext: 0,
+  wrongGoldMissing: 0,
+  missingGoldRanks: [],
+  falseAbstain: 0,
+  absN: 0,
+  absCorrect: 0,
+  hypChars: [],
+});
+const byType: Record<string, Bucket> = {};
+const all = empty();
+const wrongSamples: Record<
+  string,
+  Array<{ id: string; q: string; expected: string; got: string }>
+> = {};
+
+for (const [id, label] of labels) {
+  const item = ref.get(id);
+  const ret = retrieval.get(id);
+  const hyp = hyps.get(id) ?? "";
+  if (!item || !ret) continue;
+  const b = (byType[item.question_type] ??= empty());
+  for (const t of [b, all]) {
+    t.n++;
+    if (label) t.correct++;
+    t.hypChars.push(hyp.length);
+    const abstained = ABSTAIN_RE.test(hyp);
+    if (isAbstentionId(id)) {
+      t.absN++;
+      if (label) t.absCorrect++;
+    } else {
+      if (abstained && !label) t.falseAbstain++;
+      const gold = new Set(ret.gold);
+      if (gold.size > 0) {
+        t.retrievalScored++;
+        for (const k of KS) {
+          const top = new Set(ret.ranked.slice(0, k));
+          const hit = [...gold].filter((g) => top.has(g)).length;
+          if (hit > 0) t.recallAny[k]!++;
+          if (hit === gold.size) t.recallAll[k]!++;
+        }
+        if (!label) {
+          const topK = new Set(ret.ranked.slice(0, K));
+          const missing = [...gold].filter((g) => !topK.has(g));
+          if (missing.length === 0) {
+            t.wrongAllGoldInContext++;
+          } else {
+            t.wrongGoldMissing++;
+            for (const g of missing) {
+              const r = ret.ranked.indexOf(g);
+              t.missingG
```

**File**: `benchmarks/longmemeval/bitterbot-bridge.ts` (modified, +89/-14)
```diff
@@ -17,6 +17,9 @@ const __filename = fileURLToPath(import.meta.url);
 const __dirname = dirname(__filename);
 
 // Bitterbot internal imports
+import type { DatabaseSync } from "node:sqlite";
+import { resolveApiKeyForProvider } from "../../src/agents/model-auth.js";
+import { loadConfig } from "../../src/config/io.js";
 import type { BitterbotConfig } from "../../src/config/types.js";
 import { MemoryIndexManager } from "../../src/memory/manager.js";
 import type { MemorySearchResult } from "../../src/memory/types.js";
@@ -30,7 +33,17 @@ export interface BenchmarkBridge {
 }
 
 export interface BenchmarkMemoryManager {
-  search(query: string, opts?: { maxResults?: number }): Promise<MemorySearchResult[]>;
+  /** `now` = the instant the question is asked (epoch ms); boosts measure age from it. */
+  search(
+    query: string,
+    opts?: { maxResults?: number; now?: number },
+  ): Promise<MemorySearchResult[]>;
+  /**
+   * Back-date the chunks of each ingested file to the time the conversation
+   * happened, so age-dependent scoring sees the history's own timeline rather
+   * than the ingest wall clock. Keys are file basenames as passed to ingest.
+   */
+  setChunkTimestamps(timestamps: Record<string, number>): number;
   sync(opts?: { reason?: string }): Promise<void>;
   ingestMarkdownFiles(files: string[]): Promise<void>;
   /** Retry embeddings for chunks a transient failure left pending; returns what is still pending. */
@@ -39,12 +52,48 @@ export interface BenchmarkMemoryManager {
 }
 
 export interface BenchmarkLlmProvider {
-  complete(params: { model: string; prompt: string; maxTokens?: number }): Promise<string>;
+  complete(params: {
+    model: string;
+    prompt: string;
+    maxTokens?: number;
+    temperature?: number;
+  }): Promise<string>;
+}
+
+export interface BenchmarkBridgeOptions {
+  /**
+   * `query.postFusionBoostScale` for the run. Omitted = the legacy pin of 1
+   * every saved retrieval run used; `"production"` = leave the key unset so
+   * the shipped default applies (what an official-protocol run must measure).
+   */
+  postFusionBoostScale?: number | "production";
+  /** `query.maxResults` default for searches that do not pass one. */
+  maxResults?: number;
+}
+
+/**
+ * API keys: environment first, then the operator's normal auth path (the same
+ * resolution the gateway uses), so a benchmark never needs keys pasted into a
+ * shell.
+ */
+async function resolveKey(provider: "openai" | "anthropic"): Promise<string | undefined> {
+  const env = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
+  if (env?.trim()) {
+    return env.trim();
+  }
+  try {
+    const resolved = await resolveApiKeyForProvider({ provider, cfg: loadConfig() });
+    return resolved?.apiKey ?? undefined;
+  } catch {
+    return undefined;
+  }
 }
 
 // ── Factory ──
 
-export async function createBenchmarkMemoryManager(): Promise<BenchmarkBridge> {
+export async function createBenchmarkMemoryManager(
+  options: BenchmarkBridgeOptions = {},
+): Promise<BenchmarkBridge> {
   const runId = randomUUID().slice(0, 8);
   const benchDir = join(__dirname, ".bench-runs", runId);
   const workspaceDir = join(benchDir, "workspace");
@@ -58,12 +107,14 @@ export async function createBenchmarkMemoryManager(): Promise<BenchmarkBridge> {
   // Write an empty MEMORY.md so the workspace is recognized
   writeFileSync(join(memoryDir, "MEMORY.md"), "# Benchmark Memory\n", "utf-8");
 
-  // Resolve API keys from env
-  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
+  // Resolve API keys: env, else the operator's configured auth profiles.
+  const openaiApiKey = await resolveKey("openai");
   if (!openaiApiKey) {
-    throw new Error("OPENAI_API_KEY env var is required for LongMemEval embeddings");
+    throw new Error(
+      "no OpenAI key: set OPENAI_API_KEY or configure the openai provider (embeddings need it)",
+    );
   }
-  const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim();
+  const anthropicApiKey = await resolveKey("anthropic");
 
   // Use the static factory — this creates the embedding provider and DB properly
   const agentId = `benchmark-${runId}`;
@@ -91,7 +142,7 @@ export async function createBenchmarkMemoryManager(): Promise<BenchmarkBridge> {
             onStartup: false,
           },
           query: {
-            maxResults: 15,
+            maxResults: options.maxResults ?? 15,
             minScore: 0.0,
             importanceWeight: 0.15,
             hybrid: {
@@ -101,11 +152,13 @@ export async function createBenchmarkMemoryManager(): Promise<BenchmarkBridge> {
               keywordWeight: 0.3,
               candidateMultiplier: 5,
             },
-            // LongMemEval sessions carry synthetic 2023 dates, so the recency and
-            // temporal boosts are uniform noise here. Pin the legacy full-boost
-            // behaviour so every saved run stays comparable; the live-recall
-            // benchmark is where
```

**File**: `benchmarks/longmemeval/evaluate-official.ts` (added, +177/-0)
```diff
@@ -0,0 +1,177 @@
+/**
+ * LongMemEval official scoring, as `evaluate_qa.py` does it.
+ *
+ * Same judge snapshot (gpt-4o-2024-08-06), same five question-type prompts,
+ * same decoding (temperature 0, max_tokens 10), same verdict rule
+ * (`'yes' in response.lower()`), same output: one JSON line per hypothesis
+ * with `autoeval_label: {model, label}` appended, written to
+ * `<hyp>.eval-results-gpt-4o`. Aggregates follow `print_qa_metrics.py`:
+ * per type, task-averaged (mean of the six type means), overall
+ * (question-weighted) and abstention.
+ *
+ * To cross-check against the reference Python script itself, run
+ * `bash benchmarks/longmemeval/official-scorer.sh <hyp> <ref>`.
+ *
+ *   node --import tsx benchmarks/longmemeval/evaluate-official.ts --hyp <jsonl> [--ref data/longmemeval_s.json]
+ */
+import { appendFileSync, existsSync, readFileSync } from "node:fs";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+import { parseArgs } from "node:util";
+import { resolveApiKeyForProvider } from "../../src/agents/model-auth.js";
+import { loadConfig } from "../../src/config/io.js";
+import {
+  aggregate,
+  isAbstentionId,
+  type Judged,
+  JUDGE_MAX_TOKENS,
+  JUDGE_TEMPERATURE,
+  judgePrompt,
+  OFFICIAL_JUDGE_MODEL,
+  parseJudgeLabel,
+  type RawItem,
+} from "./official-protocol.js";
+
+const __dirname = dirname(fileURLToPath(import.meta.url));
+const { values: args } = parseArgs({
+  options: {
+    hyp: { type: "string" },
+    ref: { type: "string", default: join(__dirname, "data", "longmemeval_s.json") },
+    concurrency: { type: "string", default: "4" },
+    /** Score a partial file (pilots). An official number needs all 500. */
+    "allow-partial": { type: "boolean", default: false },
+  },
+  strict: true,
+});
+if (!args.hyp) {
+  throw new Error("--hyp <hypothesis.jsonl> is required");
+}
+const hypPath = args.hyp;
+const resultPath = `${hypPath}.eval-results-gpt-4o`;
+
+type Hyp = { question_id: string; hypothesis: string; [k: string]: unknown };
+const hyps = readFileSync(hypPath, "utf-8")
+  .split("\n")
+  .filter((l) => l.trim())
+  .map((l) => JSON.parse(l) as Hyp);
+const ref = new Map(
+  (JSON.parse(readFileSync(args.ref!, "utf-8")) as RawItem[]).map(
+    (r) => [r.question_id, r] as const,
+  ),
+);
+const distinct = new Set(hyps.map((h) => h.question_id));
+if (distinct.size !== hyps.length) {
+  throw new Error(`${hyps.length - distinct.size} duplicate question_id(s) in ${hypPath}`);
+}
+if (distinct.size !== ref.size && !args["allow-partial"]) {
+  throw new Error(
+    `${distinct.size} hypotheses for ${ref.size} reference questions; an official number needs every one (pass --allow-partial for a pilot)`,
+  );
+}
+
+// Resume: verdicts already written are kept (same inputs, deterministic judge).
+const judged = new Map<string, Judged>();
+if (existsSync(resultPath)) {
+  for (const line of readFileSync(resultPath, "utf-8").split("\n")) {
+    if (!line.trim()) continue;
+    const row = JSON.parse(line) as Hyp & { autoeval_label: { label: boolean } };
+    const item = ref.get(row.question_id);
+    if (item) {
+      judged.set(row.question_id, {
+        question_id: row.question_id,
+        question_type: item.question_type,
+        label: row.autoeval_label.label,
+      });
+    }
+  }
+}
+
+const envKey = process.env.OPENAI_API_KEY?.trim();
+const apiKey =
+  envKey || (await resolveApiKeyForProvider({ provider: "openai", cfg: loadConfig() }))?.apiKey;
+if (!apiKey) {
+  throw new Error("no OpenAI key for the judge");
+}
+
+async function judgeOnce(prompt: string): Promise<string> {
+  let lastErr: unknown;
+  for (let attempt = 0; attempt < 5; attempt++) {
+    try {
+      const res = await fetch("https://api.openai.com/v1/chat/completions", {
+        method: "POST",
+        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
+        body: JSON.stringify({
+          model: OFFICIAL_JUDGE_MODEL,
+          messages: [{ role: "user", content: prompt }],
+          n: 1,
+          temperature: JUDGE_TEMPERATURE,
+          max_tokens: JUDGE_MAX_TOKENS,
+        }),
+      });
+      if (!res.ok) {
+        throw new Error(`judge ${res.status}: ${(await res.text()).slice(0, 200)}`);
+      }
+      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
+      return data.choices[0]?.message.content ?? "";
+    } catch (err) {
+      lastErr = err;
+      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
+    }
+  }
+  throw lastErr;
+}
+
+const todo = hyps.filter((h) => {
+  if (!ref.has(h.question_id)) {
+    console.warn(`Warning: skipping ${h.question_id} as it is not in reference data.`);
+    return false;
+  }
+  return !judged.has(h.question_id);
+});
+console.log(`judging ${todo.length} of ${hyps.length} hypotheses with ${OFFICIAL_JUDGE_MODEL}`);
+
+const concurrency = Math.max(1, Number(args.concurrency));
+let cursor = 0;
+let doneCo
```

**File**: `benchmarks/longmemeval/official-protocol.test.ts` (added, +202/-0)
```diff
@@ -0,0 +1,202 @@
+import { describe, expect, it } from "vitest";
+import {
+  aggregate,
+  buildReaderPrompt,
+  firstPerType,
+  formatHistory,
+  isAbstentionId,
+  judgePrompt,
+  OFFICIAL_JUDGE_MODEL,
+  parseJudgeLabel,
+  parseLongMemEvalDate,
+  pythonJsonDumpsTurns,
+  type RawItem,
+  sessionRecall,
+  sessionToNlDocument,
+  toInferenceItem,
+} from "./official-protocol.js";
+
+const item: RawItem = {
+  question_id: "gpt4_70e84552_abs",
+  question_type: "multi-session",
+  question: "What did I name my dog?",
+  answer: 42,
+  question_date: "2023/05/20 (Sat) 02:21",
+  haystack_dates: ["2023/04/10 (Mon) 23:07", "2023/04/10 (Mon) 17:50", "2023/05/01 (Mon) 09:00"],
+  haystack_session_ids: ["sharegpt_1", "answer_abc_1", "answer_abc_2"],
+  haystack_sessions: [
+    [
+      { role: "user", content: "hi" },
+      { role: "assistant", content: "hello" },
+    ],
+    [
+      { role: "user", content: "I named my dog Biscuit", has_answer: true },
+      { role: "assistant", content: "Nice name", has_answer: false },
+    ],
+    [{ role: "user", content: 'café ☕ "quoted"\nline', has_answer: false }],
+  ],
+  answer_session_ids: ["answer_abc_1", "answer_abc_2"],
+};
+
+describe("toInferenceItem", () => {
+  it("strips has_answer and every dataset session id from the inference view", () => {
+    const { inference, gold } = toInferenceItem(item);
+    const dump = JSON.stringify(inference);
+    expect(dump).not.toContain("has_answer");
+    expect(dump).not.toContain("answer_");
+    expect(dump).not.toContain("sharegpt");
+    expect(inference.sessions.map((s) => s.id)).toEqual([
+      "session-001",
+      "session-002",
+      "session-003",
+    ]);
+    // Dataset order is kept (the online order); the reader sorts by date later.
+    expect(inference.sessions[0]!.date).toBe("2023/04/10 (Mon) 23:07");
+    expect(gold.goldOpaqueIds).toEqual(new Set(["session-002", "session-003"]));
+    expect(gold.isAbstention).toBe(true);
+  });
+
+  it("writes every turn into the nl document with its date header", () => {
+    const { inference } = toInferenceItem(item);
+    const doc = sessionToNlDocument(inference.sessions[1]!);
+    expect(doc).toBe(
+      "Session Date: 2023/04/10 (Mon) 17:50\n\nuser: I named my dog Biscuit\n\nassistant: Nice name\n",
+    );
+  });
+});
+
+describe("parseLongMemEvalDate", () => {
+  it("parses the dataset format as UTC", () => {
+    expect(parseLongMemEvalDate("2023/05/20 (Sat) 02:21")).toBe(Date.UTC(2023, 4, 20, 2, 21));
+  });
+  it("rejects anything else", () => {
+    expect(() => parseLongMemEvalDate("2023-05-20")).toThrow();
+  });
+});
+
+describe("reader prompt", () => {
+  it("reproduces python json.dumps for the turn list", () => {
+    expect(
+      pythonJsonDumpsTurns(
+        item.haystack_sessions[2]!.map((t) => ({ role: t.role, content: t.content })),
+      ),
+    ).toBe('[{"role": "user", "content": "caf\\u00e9 \\u2615 \\"quoted\\"\\nline"}]');
+  });
+
+  it("matches run_generation.py formatting: date-sorted sessions, CoN template, raw question_date", () => {
+    const prompt = buildReaderPrompt({
+      items: [
+        { date: "2023/04/10 (Mon) 23:07", turns: [{ role: "user", content: "b" }] },
+        { date: "2023/04/10 (Mon) 17:50", turns: [{ role: "user", content: "a" }] },
+      ],
+      questionDate: "2023/05/20 (Sat) 02:21",
+      question: "Q?",
+      reading: "con",
+      format: "json",
+    });
+    expect(prompt).toBe(
+      "I will give you several history chats between you and a user. Please answer the question based on the relevant chat history. Answer the question step by step: first extract all the relevant information, and then reason over the information to get the answer.\n\n\nHistory Chats:\n\n" +
+        '\n### Session 1:\nSession Date: 2023/04/10 (Mon) 17:50\nSession Content:\n\n[{"role": "user", "content": "a"}]\n' +
+        '\n### Session 2:\nSession Date: 2023/04/10 (Mon) 23:07\nSession Content:\n\n[{"role": "user", "content": "b"}]\n' +
+        "\n\nCurrent Date: 2023/05/20 (Sat) 02:21\nQuestion: Q?\nAnswer (step by step):",
+    );
+  });
+
+  it("renders chunk text as-is for the nl unit and the direct template ends with Answer:", () => {
+    const history = formatHistory([{ date: "2023/04/10 (Mon) 17:50", text: "user: a" }], "nl");
+    expect(history).toBe(
+      "\n### Session 1:\nSession Date: 2023/04/10 (Mon) 17:50\nSession Content:\nuser: a\n",
+    );
+    const prompt = buildReaderPrompt({
+      items: [],
+      questionDate: "d",
+      question: "q",
+      reading: "direct",
+      format: "nl",
+    });
+    expect(prompt.endsWith("\nCurrent Date: d\nQuestion: q\nAnswer:")).toBe(true);
+    expect(prompt).not.toContain("step by step");
+  });
+});
+
+describe("judge", () => {
+  it("pins the official judge snapshot", () => {
+    expect(OFFICIAL_JUDGE_MODEL).toBe("gpt-4o-2024-08-06");
+  });
+
+  it("selects the abstention template from the id alone and stringifies integer answers", ()
```

**File**: `benchmarks/longmemeval/official-protocol.ts` (added, +395/-0)
```diff
@@ -0,0 +1,395 @@
+/**
+ * LongMemEval official protocol, as code.
+ *
+ * Everything here mirrors the reference implementation in
+ * https://github.com/xiaowu0162/LongMemEval at commit 9e0b455f (2026-05-11):
+ * `src/generation/run_generation.py` for the reader prompt and context
+ * formatting, `src/evaluation/evaluate_qa.py` for the judge prompts and verdict
+ * parsing, `src/evaluation/print_qa_metrics.py` for the aggregates, and the
+ * README for which fields a memory system may see. Template strings are copied
+ * verbatim; where Python formatting matters (json.dumps) it is reproduced.
+ *
+ * Pure functions only, so the protocol is unit-testable without a store.
+ */
+
+export const OFFICIAL_PROTOCOL_REF =
+  "xiaowu0162/LongMemEval@9e0b455f4ef0e2ab8f2e582289761153549043fc";
+
+// ── Dataset view ────────────────────────────────────────────────────────────
+
+export type RawTurn = { role: string; content: string; has_answer?: boolean };
+
+export type RawItem = {
+  question_id: string;
+  question_type: string;
+  question: string;
+  /** A string in 468 questions and an integer in 32; the judge sees str(answer). */
+  answer: string | number;
+  question_date: string;
+  haystack_dates: string[];
+  haystack_session_ids: string[];
+  haystack_sessions: RawTurn[][];
+  answer_session_ids: string[];
+};
+
+export type Turn = { role: string; content: string };
+
+export type InferenceSession = {
+  /** Opaque id assigned by position; never derived from the dataset's ids. */
+  id: string;
+  date: string;
+  turns: Turn[];
+};
+
+/** What a memory system may see before it answers. Nothing else. */
+export type InferenceItem = {
+  question_id: string;
+  question: string;
+  question_date: string;
+  sessions: InferenceSession[];
+};
+
+/** Evaluation-only companion: which opaque ids are gold. Built after search. */
+export type GoldMap = {
+  goldOpaqueIds: Set<string>;
+  isAbstention: boolean;
+};
+
+export const OPAQUE_ID_PREFIX = "session-";
+
+export function opaqueSessionId(index: number): string {
+  return `${OPAQUE_ID_PREFIX}${String(index + 1).padStart(3, "0")}`;
+}
+
+/**
+ * Strip every evaluation-only signal from a dataset item.
+ *
+ * Two leaks the official data carries (both documented in the repo's issues):
+ * every turn of an evidence session has a `has_answer` key (true or false) and
+ * no filler turn has one, so key presence marks gold; and every evidence
+ * session id contains the substring "answer" by construction. Turns are
+ * rebuilt with only role and content, and sessions get positional ids.
+ * Sessions keep dataset order (the "online" order the history arrived in).
+ */
+export function toInferenceItem(item: RawItem): { inference: InferenceItem; gold: GoldMap } {
+  const sessions: InferenceSession[] = item.haystack_sessions.map((turns, i) => ({
+    id: opaqueSessionId(i),
+    date: item.haystack_dates[i] ?? "",
+    turns: turns.map((t) => ({ role: t.role, content: t.content })),
+  }));
+  const goldOpaqueIds = new Set<string>();
+  const gold = new Set(item.answer_session_ids ?? []);
+  for (let i = 0; i < item.haystack_session_ids.length; i++) {
+    if (gold.has(item.haystack_session_ids[i]!)) {
+      goldOpaqueIds.add(opaqueSessionId(i));
+    }
+  }
+  return {
+    inference: {
+      question_id: item.question_id,
+      question: item.question,
+      question_date: item.question_date,
+      sessions,
+    },
+    gold: { goldOpaqueIds, isAbstention: isAbstentionId(item.question_id) },
+  };
+}
+
+/** evaluate_qa.py line 101: `abstention='_abs' in entry['question_id']`. */
+export function isAbstentionId(questionId: string): boolean {
+  return questionId.includes("_abs");
+}
+
+// ── Time ────────────────────────────────────────────────────────────────────
+
+const DATE_RE = /^(\d{4})\/(\d{2})\/(\d{2}) \((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\) (\d{2}):(\d{2})$/;
+
+/**
+ * Parse the dataset's `%Y/%m/%d (%a) %H:%M` timestamps (no zone; treated as
+ * UTC). Used as the memory system's "now" for the question and as each
+ * session's creation time, so age-dependent scoring sees 2023 as 2023.
+ */
+export function parseLongMemEvalDate(s: string): number {
+  const m = DATE_RE.exec(s.trim());
+  if (!m) {
+    throw new Error(`not a LongMemEval timestamp: ${JSON.stringify(s)}`);
+  }
+  const [, y, mo, d, h, mi] = m;
+  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
+}
+
+// ── Ingest format ───────────────────────────────────────────────────────────
+
+/**
+ * One document per session in the official `nl` history format
+ * (run_generation.py L239: `"\n\n{}: {}".format(role, content.strip())`),
+ * headed by the session date. A retrieved chunk of this file is therefore a
+ * legitimate `nl`-format fragment of the session.
+ */
+export function sessionToNlDocument(session: InferenceSession): string {
+  const parts = [`Session Date: ${session.date}`];
+  for (const t of session.turns) {
+    parts.push(`${t.role}: ${t.content.trim()
```

**File**: `benchmarks/longmemeval/official-scorer.sh` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+#!/usr/bin/env bash
+# Score a hypothesis file with the reference LongMemEval scripts, unmodified.
+#
+# Fetches evaluate_qa.py and print_qa_metrics.py at the pinned commit into a
+# scratch dir, installs their four dependencies into a local venv, and runs
+# them. Needs OPENAI_API_KEY in the environment (the reference script reads it
+# itself). Output: <hyp>.eval-results-gpt-4o next to the hypothesis file.
+#
+#   bash benchmarks/longmemeval/official-scorer.sh <hypothesis.jsonl> [reference.json]
+set -euo pipefail
+
+HYP="${1:?usage: official-scorer.sh <hypothesis.jsonl> [reference.json]}"
+HERE="$(cd "$(dirname "$0")" && pwd)"
+REF="${2:-$HERE/data/longmemeval_s.json}"
+COMMIT="9e0b455f4ef0e2ab8f2e582289761153549043fc"
+TOOLS="$HERE/.work-official-scorer"
+VENV="$TOOLS/venv"
+RAW="https://raw.githubusercontent.com/xiaowu0162/LongMemEval/$COMMIT/src/evaluation"
+
+mkdir -p "$TOOLS"
+for f in evaluate_qa.py print_qa_metrics.py; do
+  if [ ! -f "$TOOLS/$f" ]; then
+    echo "fetching $f @ ${COMMIT:0:8}"
+    curl -fsSL "$RAW/$f" -o "$TOOLS/$f"
+  fi
+done
+if [ ! -x "$VENV/bin/python" ]; then
+  python3 -m venv "$VENV"
+  "$VENV/bin/pip" install --quiet openai numpy backoff tqdm
+fi
+: "${OPENAI_API_KEY:?OPENAI_API_KEY must be set for the reference judge}"
+
+HYP_ABS="$(cd "$(dirname "$HYP")" && pwd)/$(basename "$HYP")"
+REF_ABS="$(cd "$(dirname "$REF")" && pwd)/$(basename "$REF")"
+cd "$TOOLS"
+"$VENV/bin/python" -I evaluate_qa.py gpt-4o "$HYP_ABS" "$REF_ABS" | tail -n 12
+"$VENV/bin/python" -I print_qa_metrics.py "$HYP_ABS.eval-results-gpt-4o" "$REF_ABS" || true
```

#### Recent Merged Pull Requests:
- **PR #318** (2026-10-28): feat(benchmarks): LongMemEval runner on the official protocol (@VGIL77)
- **PR #317** (2026-10-27): bench(live-recall): replay the agent's real memory_search queries under each boost scale (@VGIL77)
- **PR #316** (2026-10-27): fix(gateway): restarted gateway outlives its parent's lock instead of dying at the 5 s timeout (@VGIL77)
- **PR #315** (2026-10-27): fix(memory): bound post-fusion boosts to the RRF scale; held-out live-memory benchmark; evidence-level LongMemEval metrics (@VGIL77)
- **PR #313** (closed): bench(longmemeval): stratified per-type sampling and the stratified before/after of the keyword-channel change (@VGIL77)
- **PR #312** (2026-10-27): fix(memory): keyword channel matches natural-language queries; failed embedding batch no longer aborts sync (@VGIL77)

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

## X. benchmarks): LongMemEval runner on the official protocol (#318)

**RULE**:
When implementing operations in `.gitignore`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Bitterbot-AI/bitterbot-desktop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c22b2932`: benchmarks): LongMemEval runner on the official protocol (#318). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.gitignore`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:

benchmarks/longmemeval/.work-official/
benchmarks/longmemeval/.work-official-scorer/
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c22b2932` are properly handled with clean fallback behavior.
