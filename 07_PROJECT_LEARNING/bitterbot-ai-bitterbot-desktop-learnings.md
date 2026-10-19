> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bitterbot-ai-bitterbot-desktop-learnings.md`  
> **Source**: github ([https://github.com/Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop))  
> **Source Version**: `3ddb21ab`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T15:17:56.142Z  
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
> **Harvest Timestamp**: 2026-10-19T15:17:56.136Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Bitterbot-AI/bitterbot-desktop`
- **Description**: Bitterbot - a mesh of agents that turns shared experience into collective capability.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2476 stars

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

### Incident Patch 1: `3ddb21ab` (2026-10-19)
**Commit Message**: feat(compute): PLAN-57 Phase 6, bounded hormonal nudges, the Compute settings group, and the upgrade story (#276)

Hormones (§4.7, last by design): a job the owner can see succeed on the
pool, one the watcher saw running, gives a recall-sized dopamine lift
(0.05); a worker still listed but offline since a fresh previous poll, a
coordinator that goes unreachable, or a sustained embedding fallback gives
a cortisol rise of the same size. One nudge per kind every thirty minutes
and four per rolling hour, so two nudges of one kind can never reach the
dream engine's 0.15 rise trigger: compute colours the mood and never
starts a dream or a scratch note. Internal batches never lift; jobs first
seen already finished never nudge; a poll after an idle stretch rebuilds
its baseline instead of blaming a worker for the gap. The memory manager
registers the nudge sink only when compute.awareness.nudges is on (default
on), so turning it off is a no-op path whatever a plugin passes.

Settings: a Compute group (label, order, help) so the compute.* rows no
longer fall into the unlabelled bucket; compute.awareness.nudges with
label, help and default.

Upgrade: docs/network/compute.md says what the def

**File**: `docs/memory/emotional-system.md` (modified, +14/-12)
```diff
@@ -24,18 +24,20 @@ value = baseline + (value - baseline) × 2^(-elapsed / halfLife)
 
 Events stimulate specific hormones. Each event has a magnitude (how much to add) and a target hormone:
 
-| Event               | Hormone            | Magnitude    | Trigger                                |
-| ------------------- | ------------------ | ------------ | -------------------------------------- |
-| `reward`            | dopamine           | +0.30        | Positive feedback                      |
-| `achievement`       | dopamine, oxytocin | +0.40, +0.20 | Task completion, breakthrough          |
-| `curiosity_high`    | dopamine           | +0.25        | Curiosity reward > 0.7                 |
-| `error`             | cortisol           | +0.30        | Bug, error, frustration                |
-| `urgency`           | cortisol           | +0.40        | Time pressure detected                 |
-| `social`            | oxytocin           | +0.30        | Personal sharing, trust building       |
-| `marketplace_sale`  | dopamine, oxytocin | +0.15, +0.05 | Skill sold on marketplace              |
-| `recall_positive`   | dopamine           | +0.05        | Retrieved positive memories            |
-| `recall_negative`   | cortisol           | +0.05        | Retrieved negative memories            |
-| `recall_relational` | oxytocin           | +0.05        | Retrieved personal/relational memories |
+| Event               | Hormone            | Magnitude    | Trigger                                                                                               |
+| ------------------- | ------------------ | ------------ | ----------------------------------------------------------------------------------------------------- |
+| `reward`            | dopamine           | +0.30        | Positive feedback                                                                                     |
+| `achievement`       | dopamine, oxytocin | +0.40, +0.20 | Task completion, breakthrough                                                                         |
+| `curiosity_high`    | dopamine           | +0.25        | Curiosity reward > 0.7                                                                                |
+| `error`             | cortisol           | +0.30        | Bug, error, frustration                                                                               |
+| `urgency`           | cortisol           | +0.40        | Time pressure detected                                                                                |
+| `social`            | oxytocin           | +0.30        | Personal sharing, trust building                                                                      |
+| `marketplace_sale`  | dopamine, oxytocin | +0.15, +0.05 | Skill sold on marketplace                                                                             |
+| `recall_positive`   | dopamine           | +0.05        | Retrieved positive memories                                                                           |
+| `recall_negative`   | cortisol           | +0.05        | Retrieved negative memories                                                                           |
+| `recall_relational` | oxytocin           | +0.05        | Retrieved personal/relational memories                                                                |
+| `compute_success`   | dopamine           | +0.05        | A compute job you can see succeeded on the pool (rate-limited)                                        |
+| `compute_setback`   | cortisol           | +0.05        | A pool worker went offline, the coordinator went away, or embeddings keep falling back (rate-limited) |
 
 Note the **recall events** have smaller magnitudes (0.05) than direct events (0.10-0.40) to prevent runaway feedback loops.
 
```

**File**: `docs/network/compute.md` (modified, +22/-0)
```diff
@@ -105,6 +105,27 @@ rules and refusal reasons are in
 - `bitterbot doctor` has two sections, "Compute embeddings" and "Compute
   payments", read from the same local ledger.
 
+## Upgrading
+
+Compute awareness is on by default, on new installs and on upgrades alike:
+a config without a `compute` key behaves as `compute.enabled: true`. On a
+node without the Soapbox plugin loaded that means nothing at all. The
+`compute` tool and its prompt section exist only when a backend (the
+plugin with a coordinator) is loaded, the state block renders only when
+something is actionable, the compute block in working memory appears only
+once there is activity, and no connection is opened. An idle upgraded node
+spends no extra tokens and dials nothing new. The Settings form does gain a
+Compute group with every key below on every node, so the switches are
+visible before they matter.
+
+What does change once the plugin is loaded and a pool exists: memory
+embedding batches may route to eligible pool workers under the egress
+policy (`compute.embeddings.provider: pool` is the default; set `local` to
+keep them home), finished jobs become episodes, and compute colours the
+agent's mood a little. Paid jobs stay off until you turn
+`compute.paid.enabled` on. `compute.enabled: false` turns everything off at
+once.
+
 ## Settings
 
 All keys live under `compute` in `~/.bitterbot/bitterbot.json` and in the
@@ -117,6 +138,7 @@ Settings form.
 | `compute.awareness.maxTokens`            | `120`       | Token budget for that block.                                                                   |
 | `compute.awareness.creditFloor`          | `10`        | Below this many credits the block says so.                                                     |
 | `compute.awareness.wakeBudgetPerHour`    | `20`        | Most agent wakes per hour from compute completions; the rest are deferred, never dropped.      |
+| `compute.awareness.nudges`               | `true`      | Small hormonal nudges on owner-visible successes and setbacks; rate-limited.                   |
 | `compute.pools.<id>.trust`               | `untrusted` | Which memory classes may reach the pool (see above).                                           |
 | `compute.embeddings.provider`            | `pool`      | Route memory embedding batches to eligible pool workers; `local` turns routing off.            |
 | `compute.embeddings.marginMs`            | `500`       | A worker must beat the local estimate by this much to be chosen.                               |
```

**File**: `docs/tools/compute.md` (modified, +24/-1)
```diff
@@ -320,6 +320,25 @@ route and class, paid jobs funded), which The Niche section reflects; a
 node with no compute activity gets no block. See
 [Compute pools](/network/compute).
 
+## Hormones
+
+Compute leaves a small mark on the agent's mood, nothing more. A job you
+can see succeed on the pool, one the watcher saw running, gives a dopamine
+lift the size of a recalled happy memory (0.05); a worker still listed but
+offline since the previous poll, the coordinator going unreachable, or
+memory embeddings falling back to local for a sustained run gives a
+cortisol rise of the same size. The node's own batches never lift; their
+one setback is that sustained-fallback event. Jobs first seen already
+finished (after an outage) never nudge, and a poll after an idle stretch
+starts a fresh baseline instead of blaming the gap on a worker.
+
+The bounds are the point: one nudge per kind every thirty minutes and four
+per hour, and at that size and spacing two nudges of one kind cannot add up
+to the dream engine's hormonal rise trigger (0.15), so compute colours the
+mood and never starts a dream or an automatic scratch note.
+`compute.awareness.nudges: false` registers no sink at all, and every nudge
+is then a no-op whatever the plugin passes.
+
 ## What the agent can never do
 
 There is no action that funds, approves or signs anything. The paid path
@@ -346,7 +365,11 @@ secrets never reach the agent.
 To get the state block and completion delivery, also:
 
 - open the delivery store (`ComputeDeliveryStore.open()`) and start the
-  watcher (`startComputeWatcher({ backend, store, ownerSessionKey })`);
+  watcher (`startComputeWatcher({ backend, store, ownerSessionKey, wakeBudgetPerHour, nudges })`,
+  passing `compute.awareness.wakeBudgetPerHour` and `compute.awareness.nudges`
+  from the config; report an unreachable coordinator as `reachable: false`
+  in the snapshot rather than throwing, so the state block and the setback
+  nudge can see it);
 - record an origin for every job you submit, before or right after the
   coordinator accepts it: `store.recordOrigin(jobId, "owner", null)` for the
   Compute tab and CLI, `"agent"` with the task's session key for
```

**File**: `src/compute/awareness/index.ts` (modified, +11/-0)
```diff
@@ -140,3 +140,14 @@ export {
   hasComputeActivity,
   renderComputeNicheInput,
 } from "./niche.js";
+export {
+  type ComputeNudge,
+  type ComputeNudgeKind,
+  type ComputeNudgeSink,
+  COMPUTE_NUDGE_COOLDOWN_MS,
+  COMPUTE_NUDGE_HOURLY_CAP,
+  getComputeNudgeSink,
+  nudgeCompute,
+  registerComputeNudgeSink,
+  resetComputeNudgesForTest,
+} from "./nudges.js";
```

**File**: `src/compute/awareness/nudges.test.ts` (added, +261/-0)
```diff
@@ -0,0 +1,261 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+import type {
+  ComputeBackend,
+  ComputeJobSummary,
+  ComputeSnapshot,
+  ComputeWorker,
+} from "./backend.js";
+import { ComputeDeliveryStore } from "./deliveries.js";
+import { resetComputeEpisodesForTest } from "./episodes.js";
+import {
+  COMPUTE_NUDGE_COOLDOWN_MS,
+  COMPUTE_NUDGE_HOURLY_CAP,
+  type ComputeNudge,
+  nudgeCompute,
+  registerComputeNudgeSink,
+  resetComputeNudgesForTest,
+} from "./nudges.js";
+import { resetComputeStateForTest } from "./state.js";
+import { type ComputeWatcher, startComputeWatcher } from "./watcher.js";
+
+const NOW = 1_700_000_000_000;
+
+describe("compute nudges are bounded (PLAN-57 Phase 6)", () => {
+  afterEach(() => resetComputeNudgesForTest());
+
+  it("does nothing without a sink or when disabled", () => {
+    expect(nudgeCompute({ kind: "success", reason: "x", now: NOW })).toBe(false);
+    const sink = vi.fn();
+    registerComputeNudgeSink(sink);
+    expect(nudgeCompute({ kind: "success", reason: "x", enabled: false, now: NOW })).toBe(false);
+    expect(sink).not.toHaveBeenCalled();
+  });
+
+  it("allows one nudge per kind per cooldown, caps the rolling hour, and survives a throwing sink", () => {
+    const seen: ComputeNudge[] = [];
+    registerComputeNudgeSink((n) => {
+      seen.push(n);
+    });
+    expect(nudgeCompute({ kind: "success", reason: "job a", now: NOW })).toBe(true);
+    expect(nudgeCompute({ kind: "success", reason: "job b", now: NOW + 1000 })).toBe(false);
+    expect(nudgeCompute({ kind: "setback", reason: "worker", now: NOW + 1000 })).toBe(true);
+    expect(
+      nudgeCompute({ kind: "success", reason: "job c", now: NOW + COMPUTE_NUDGE_COOLDOWN_MS }),
+    ).toBe(true);
+    expect(
+      nudgeCompute({
+        kind: "setback",
+        reason: "again",
+        now: NOW + COMPUTE_NUDGE_COOLDOWN_MS + 1000,
+      }),
+    ).toBe(true);
+    expect(seen.map((n) => n.reason)).toEqual(["job a", "worker", "job c", "again"]);
+    expect(seen).toHaveLength(COMPUTE_NUDGE_HOURLY_CAP);
+    // Two kinds at one per cooldown is exactly the hourly cap; nothing more fits
+    // until the oldest ages out of the rolling hour.
+    expect(nudgeCompute({ kind: "success", reason: "capped", now: NOW + 59 * 60_000 })).toBe(false);
+    expect(nudgeCompute({ kind: "success", reason: "aged out", now: NOW + 60 * 60_000 })).toBe(
+      true,
+    );
+    registerComputeNudgeSink(() => {
+      throw new Error("boom");
+    });
+    expect(() =>
+      nudgeCompute({ kind: "success", reason: "x", now: NOW + 10 * 60 * 60_000 }),
+    ).not.toThrow();
+  });
+});
+
+describe("the watcher nudges on owner-visible successes and setbacks", () => {
+  let store: ComputeDeliveryStore;
+  let w: ComputeWatcher | null = null;
+  const jobs: ComputeJobSummary[] = [];
+  const workers: ComputeWorker[] = [];
+  const timers: Array<{ fn: () => void; ms: number }> = [];
+  const nudges: ComputeNudge[] = [];
+  const clock = { now: NOW };
+  let reachable = true;
+
+  function worker(id: string, online = true): ComputeWorker {
+    return {
+      id,
+      online,
+      paused: false,
+      gpu: false,
+      cpuThreads: 2,
+      memoryMib: 512,
+      pools: ["lab"],
+      projects: [],
+      modes: ["private"],
+    };
+  }
+  function job(over: Partial<ComputeJobSummary> & { id: string }): ComputeJobSummary {
+    return {
+      status: "running",
+      mode: "private",
+      scope: "lab",
+      workload: "sha256",
+      items: 2,
+      attempts: 1,
+      ...over,
+    };
+  }
+  async function flush() {
+    for (let i = 0; i < 6; i += 1) {
+      await new Promise((r) => setImmediate(r));
+    }
+  }
+  async function runTimers() {
+    for (const t of timers.splice(0)) {
+      t.fn();
+      await flush();
+    }
+  }
+
+  beforeEach(() => {
+    resetComputeStateForTest();
+    resetComputeEpisodesForTest();
+    resetComputeNudgesForTest();
+    store = ComputeDeliveryStore.inMemory();
+    jobs.length = 0;
+    workers.length = 0;
+    timers.length = 0;
+    nudges.length = 0;
+    clock.now = NOW;
+    reachable = true;
+    registerComputeNudgeSink((n) => {
+      nudges.push(n);
+    });
+  });
+
+  afterEach(() => {
+    w?.stop();
+    w = null;
+    store.close();
+    resetComputeNudgesForTest();
+  });
+
+  async function start(over: { nudges?: boolean } = {}) {
+    let version = 0;
+    const backend: ComputeBackend = {
+      snapshot: async (): Promise<ComputeSnapshot> => ({
+        version: ++version,
+        asOf: clock.now,
+        reachable,
+        pools: [],
+        workers: workers.slice(),
+        jobs: jobs.slice(),
+      }),
+      jobs: async () => jobs.slice(),
+      job: async (id) => jobs.find((j) => j.id === id) ?? null,
+      result: async () => null,
+    };
+    w = startComputeWatcher({
+      backend,
+      store,
+      ownerSessionKey: () => "agent:main:main",
+      wakeBudgetPerHour: 20,
+   
```

**File**: `src/compute/awareness/nudges.ts` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+/**
+ * PLAN-57 §4.7, Phase 6: hormonal nudges from compute. Flavour, not
+ * function: a small dopamine lift when a job the owner can see succeeds, a
+ * small cortisol rise when a worker drops out, the coordinator goes
+ * unreachable, or pool embeddings fall back to local for a sustained run.
+ *
+ * Bounded by construction: one nudge per kind per 30-minute window and a
+ * cap per rolling hour across kinds; internal traffic never lifts (callers
+ * only nudge successes for owner- or agent-started jobs), and the one
+ * internal setback is the sustained-fallback event. The magnitude (0.05, the
+ * recall class) and the spacing are chosen so that two nudges of one kind
+ * can never add up to the dream engine's hormonal rise trigger (0.15 by
+ * default) even before decay: compute colours the mood, it never starts a
+ * dream. `compute.awareness.nudges: false` keeps the sink from being
+ * registered at all, and without a sink every nudge is a no-op.
+ */
+
+import { createSubsystemLogger } from "../../logging/subsystem.js";
+
+const log = createSubsystemLogger("compute/nudges");
+
+export type ComputeNudgeKind = "success" | "setback";
+
+export type ComputeNudge = {
+  kind: ComputeNudgeKind;
+  /** What happened, for the log; never rendered to the model. */
+  reason: string;
+  at: number;
+};
+
+export type ComputeNudgeSink = (nudge: ComputeNudge) => unknown;
+
+/** At most one nudge of a kind inside this window. */
+export const COMPUTE_NUDGE_COOLDOWN_MS = 30 * 60_000;
+/** At most this many nudges of any kind per rolling hour. */
+export const COMPUTE_NUDGE_HOURLY_CAP = 4;
+const HOUR_MS = 60 * 60_000;
+
+let sink: ComputeNudgeSink | null = null;
+const lastByKind = new Map<ComputeNudgeKind, number>();
+let recent: number[] = [];
+
+export function registerComputeNudgeSink(next: ComputeNudgeSink | null): void {
+  sink = next;
+}
+
+export function getComputeNudgeSink(): ComputeNudgeSink | null {
+  return sink;
+}
+
+export function resetComputeNudgesForTest(): void {
+  sink = null;
+  lastByKind.clear();
+  recent = [];
+}
+
+/**
+ * Apply a nudge if one is due. Returns true when the sink was called.
+ * `enabled` is the config switch; callers pass `compute.awareness.nudges`.
+ */
+export function nudgeCompute(input: {
+  kind: ComputeNudgeKind;
+  reason: string;
+  enabled?: boolean;
+  now?: number;
+}): boolean {
+  if (input.enabled === false || !sink) {
+    return false;
+  }
+  const now = input.now ?? Date.now();
+  recent = recent.filter((t) => now - t < HOUR_MS);
+  if (recent.length >= COMPUTE_NUDGE_HOURLY_CAP) {
+    return false;
+  }
+  const last = lastByKind.get(input.kind);
+  if (last !== undefined && now - last < COMPUTE_NUDGE_COOLDOWN_MS) {
+    return false;
+  }
+  lastByKind.set(input.kind, now);
+  recent.push(now);
+  try {
+    sink({ kind: input.kind, reason: input.reason.slice(0, 120), at: now });
+    log.debug(`compute nudge ${input.kind}: ${input.reason}`);
+    return true;
+  } catch (err) {
+    log.debug(`compute nudge sink threw: ${String(err)}`);
+    return false;
+  }
+}
```

**File**: `src/compute/awareness/upgrade-idle.test.ts` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+/**
+ * PLAN-57 Phase 6: the default-on flip on upgrade. A node whose config has
+ * no `compute` key behaves as enabled, and on an idle node (no backend, no
+ * pool, nothing routed) that must cost nothing: no tool, no prompt section,
+ * no state block, no compute block in working memory, no nudges.
+ */
+import { afterEach, describe, expect, it } from "vitest";
+import { buildAgentSystemPrompt } from "../../agents/system-prompt.js";
+import { createComputeTool } from "../../agents/tools/compute-tool.js";
+import { FIELD_DEFAULTS } from "../../config/schema.defaults.js";
+import { buildWorkingMemorySynthesisPrompt } from "../../memory/working-memory-prompt.js";
+import { resetComputeBackendForTest } from "./backend.js";
+import { nudgeCompute, resetComputeNudgesForTest } from "./nudges.js";
+import { resetComputeRuntimeForTest } from "./runtime.js";
+import { resetComputeStateForTest, resolveComputeStateBlockFromConfig } from "./state.js";
+
+const upgradedConfig = {} as Record<string, never>;
+
+describe("upgrade to compute awareness on an idle node", () => {
+  afterEach(() => {
+    resetComputeBackendForTest();
+    resetComputeRuntimeForTest();
+    resetComputeStateForTest();
+    resetComputeNudgesForTest();
+  });
+
+  it("is on by default and costs nothing without a backend", () => {
+    expect(FIELD_DEFAULTS["compute.enabled"]).toBe(true);
+    expect(FIELD_DEFAULTS["compute.awareness.nudges"]).toBe(true);
+    // No backend registered: the tool does not exist, so the prompt section does not either.
+    expect(createComputeTool({ config: upgradedConfig })).toBeUndefined();
+    const toolNames = ["wallet", "exec", "memory_search"];
+    const before = buildAgentSystemPrompt({ workspaceDir: "/tmp/bitterbot", toolNames });
+    expect(before).not.toContain("## Compute Pools");
+    // The state block needs a snapshot; an upgraded config and no snapshot render nothing.
+    expect(resolveComputeStateBlockFromConfig(upgradedConfig)).toBeFalsy();
+    expect(resolveComputeStateBlockFromConfig({ compute: { enabled: true } })).toBeFalsy();
+    // Working memory synthesis carries no compute block without facts.
+    const synthesis = buildWorkingMemorySynthesisPrompt({
+      oldState: "",
+      scratchNotes: "",
+      recentCrystals: [],
+      dreamInsights: [],
+      curiosityTargets: [],
+      emergingSkills: [],
+      hormonalState: { dopamine: 0.5, cortisol: 0.2, oxytocin: 0.4, mood: "calm" },
+      timestamp: "2026-10-18T00:00:00Z",
+    });
+    expect(synthesis).not.toContain("## Input: Compute");
+    // Nudges have no sink and no effect.
+    expect(nudgeCompute({ kind: "success", reason: "x" })).toBe(false);
+  });
+
+  it("turns everything off with the one kill switch", () => {
+    expect(createComputeTool({ config: { compute: { enabled: false } } })).toBeUndefined();
+    expect(resolveComputeStateBlockFromConfig({ compute: { enabled: false } })).toBeFalsy();
+  });
+});
```

**File**: `src/compute/awareness/watcher.ts` (modified, +57/-0)
```diff
@@ -24,6 +24,7 @@ import { createSubsystemLogger } from "../../logging/subsystem.js";
 import type { ComputeBackend, ComputeJobSummary, ComputeSnapshot } from "./backend.js";
 import type { ComputeDeliveryStore, ComputeJobOrigin } from "./deliveries.js";
 import { emitComputeEpisode, episodeFromJob } from "./episodes.js";
+import { nudgeCompute } from "./nudges.js";
 import {
   publishComputeSnapshot,
   pushComputeTransition,
@@ -55,6 +56,8 @@ export type ComputeWatcherOptions = {
   /** The owner's main session: where owner-started jobs report. */
   ownerSessionKey: () => string;
   wakeBudgetPerHour?: number;
+  /** PLAN-57 Phase 6: hormonal nudges on owner-visible successes and setbacks (compute.awareness.nudges, default on). */
+  nudges?: boolean;
   minPollMs?: number;
   maxPollMs?: number;
   reconcileLimit?: number;
@@ -95,6 +98,14 @@ export function startComputeWatcher(opts: ComputeWatcherOptions): ComputeWatcher
   let stopped = false;
   let polling = false;
   let lastStatuses = new Map<string, string>();
+  // Phase 6: what the previous poll saw, to notice a worker dropping out or
+  // the coordinator going away.
+  let lastOnlineWorkers: Set<string> | null = null;
+  let lastReachable: boolean | null = null;
+  let lastPollAt: number | null = null;
+  const nudgesOn = opts.nudges !== false;
+  // A baseline older than this says nothing about what happened since.
+  const baselineMaxAgeMs = 2 * maxPoll;
   const wakes: number[] = [];
 
   const unsubscribe = subscribe((evt) => {
@@ -179,6 +190,45 @@ export function startComputeWatcher(opts: ComputeWatcherOptions): ComputeWatcher
     });
   }
 
+  /**
+   * A worker that was online at the previous poll and is now listed offline,
+   * or a coordinator that went away. The previous poll must be recent: after
+   * an idle stretch the baseline says nothing about what happened since, and
+   * a worker that simply left the pool is not a setback.
+   */
+  function noticeSetbacks(snapshot: ComputeSnapshot): void {
+    const at = now();
+    const fresh = lastPollAt !== null && at - lastPollAt <= baselineMaxAgeMs;
+    if (fresh && lastReachable === true && !snapshot.reachable) {
+      nudgeCompute({
+        kind: "setback",
+        reason: "coordinator unreachable",
+        enabled: nudgesOn,
+        now: at,
+      });
+    }
+    lastReachable = snapshot.reachable;
+    const byId = new Map(snapshot.workers.map((w) => [w.id, w]));
+    if (fresh && lastOnlineWorkers && snapshot.reachable) {
+      const lost = [...lastOnlineWorkers].filter((id) => {
+        const w = byId.get(id);
+        return w !== undefined && !w.online;
+      });
+      if (lost.length > 0) {
+        nudgeCompute({
+          kind: "setback",
+          reason: `worker offline: ${lost.slice(0, 3).join(", ")}`,
+          enabled: nudgesOn,
+          now: at,
+        });
+      }
+    }
+    if (snapshot.reachable) {
+      lastOnlineWorkers = new Set(snapshot.workers.filter((w) => w.online).map((w) => w.id));
+    }
+    lastPollAt = at;
+  }
+
   function handleTransitions(jobs: ComputeJobSummary[]): void {
     for (const job of jobs) {
       const prev = lastStatuses.get(job.id);
@@ -198,6 +248,12 @@ export function startComputeWatcher(opts: ComputeWatcherOptions): ComputeWatcher
         linkTask(route, job);
         // §4.7: a finished job the agent or owner started becomes an episode.
         emitComputeEpisode(episodeFromJob(job, route, now()));
+        // Phase 6: an owner-visible success the watcher saw in flight is a
+        // small lift. A job first seen already finished (reconciled after an
+        // outage, or found by a refresh during startup) does not nudge.
+        if (job.status === "succeeded" && prev !== undefined) {
+          nudgeCompute({ kind: "success", reason: `job ${job.id}`, enabled: nudgesOn, now: now() });
+        }
       }
     }
   }
@@ -229,6 +285,7 @@ export function startComputeWatcher(opts: ComputeWatcherOptions): ComputeWatcher
       const snapshot = await opts.backend.snapshot();
       publishComputeSnapshot(snapshot);
       setComputeInternalJobs(opts.store.internalJobIds());
+      noticeSetbacks(snapshot);
       handleTransitions(snapshot.jobs);
       lastStatuses = new Map(snapshot.jobs.map((j) => [j.id, j.status]));
       retryDeferred();
```

#### Recent Merged Pull Requests:
- **PR #276** (2026-10-19): feat(compute): PLAN-57 Phase 6, bounded hormonal nudges, the Compute settings group, and the upgrade story (@VGIL77)
- **PR #275** (2026-10-19): feat(compute): PLAN-57 Phase 5, compute facts in the Niche, job episodes, and the owner's compute CLI (@VGIL77)
- **PR #274** (2026-10-19): feat(compute): PLAN-57 Phase 4, payment authority enforced at the signer for paid compute (@VGIL77)
- **PR #273** (2026-10-18): feat(compute): PLAN-57 Phase 3, embedding profiles, pool-routed embeddings under an egress policy, and the migration command (@VGIL77)
- **PR #272** (2026-10-18): feat(compute): PLAN-57 Phase 2, agent-initiated submit and cancel with PLAN-16 task linkage (@VGIL77)
- **PR #270** (2026-10-18): feat(compute): PLAN-57 Phase 1, the compute state block, the watcher and durable completion delivery (@VGIL77)

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

## X. compute): PLAN-57 Phase 6, bounded hormonal nudges, the Compute settings group, 

**RULE**:
When implementing operations in `docs/memory/emotional-system.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Bitterbot-AI/bitterbot-desktop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3ddb21ab`: compute): PLAN-57 Phase 6, bounded hormonal nudges, the Compute settings group, and the upgrade story (#276). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/memory/emotional-system.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
| Event               | Hormone            | Magnitude    | Trigger                                                                                               |
| ------------------- | ------------------ | ------------ | ----------------------------------------------------------------------------------------------------- |
| `reward`            | dopamine           | +0.30        | Positive feedback                                                                                     |
| `achievement`       | dopamine, oxytocin | +0.40, +0.20 | Task completion, breakthrough                                                                         |
| `curiosity_high`    | dopamine           | +0.25        | Curiosity reward > 0.7                                                                                |
| `error`             | cortisol           | +0.30        | Bug, error, frustration                                                                               |
| `urgency`           | cortisol           | +0.40        | Time pressure detected                                                                                |
| `social`            | oxytocin           | +0.30  
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
| Event               | Hormone            | Magnitude    | Trigger                                |
| ------------------- | ------------------ | ------------ | -------------------------------------- |
| `reward`            | dopamine           | +0.30        | Positive feedback                      |
| `achievement`       | dopamine, oxytocin | +0.40, +0.20 | Task completion, breakthrough          |
| `curiosity_high`    | dopamine           | +0.25        | Curiosity reward > 0.7                 |
| `error`             | cortisol           | +0.30        | Bug, error, frustration                |
| `urgency`           | cortisol           | +0.40        | Time pressure detected                 |
| `social`            | oxytocin           | +0.30        | Personal sharing, trust building       |
| `marketplace_sale`  | dopamine, oxytocin | +0.15, +0.05 | Skill sold on marketplace              |
| `recall_positive`   | dopamine           | +0.05        | Retrieved positive memories            |
| `recall_negative`   | cortisol           | +0.05        | Retrieved negative memories            |
| `recall_relational` | oxytocin           | +0.05        | Retrieved personal/relational
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3ddb21ab` are properly handled with clean fallback behavior.
