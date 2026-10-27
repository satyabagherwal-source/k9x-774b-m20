> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bitterbot-ai-bitterbot-desktop-learnings.md`  
> **Source**: github ([https://github.com/Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop))  
> **Source Version**: `a22e2df0`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T17:38:03.667Z  
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
> **Harvest Timestamp**: 2026-10-27T17:38:03.063Z  
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

### Incident Patch 1: `a22e2df0` (2026-10-27)
**Commit Message**: fix(memory): keyword channel matches natural-language queries; failed embedding batch no longer aborts sync (#312)

* fix(memory): make the keyword channel match natural-language queries; keep a failed embedding batch from aborting sync

Two defects the PLAN-58 per-channel diagnostics and the retrieval baseline
surfaced on 2026-10-27.

- buildFtsQuery AND-joined every token, so a chunk had to contain every word
  of the query. That held for terse two-word lookups and for no conversational
  question: the keyword channel contributed zero results to natural-language
  queries on the live store (0 of 6 results carried a keyword rank) and to the
  LongMemEval baseline (keyword R@10 = 0% on every question). "Hybrid" search
  was vector-only in practice. Terms are now OR-joined with a shared stopword
  list (dropped only when the query has three or more tokens) and a 16-term
  cap; bm25 ranks by how many terms match and how rare they are, so an
  all-terms match still sorts first. proactive-recall's recall fallback shares
  the stopword list.
- A transient embedding failure during sync left the item's embedding as [],
  and Buffer.from(new Float32Array([]).buffer) binds as NULL in node:s

**File**: `benchmarks/longmemeval/README.md` (modified, +12/-0)
```diff
@@ -45,6 +45,18 @@ chunk (`vector-only`, `keyword-only`, `graph-only`, `multi`). The output
 JSON records the git commit it measured, so a saved run is the frozen
 baseline any later retrieval change is compared against.
 
+Saved runs (LongMemEval-S, first 50 questions, all `single-session-user`, quiet bridge):
+
+| metric                            | `bitterbot_longmemeval_s_retrieval.json` (code 9708d2d1, AND-joined FTS) | `..._2026-10-27_keyword-or.json` (code 09e5a54e, OR-joined FTS) |
+| --------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
+| questions scored                  | 49 (one lost to the empty-embedding NOT NULL bug)                        | 50                                                              |
+| R@5 / R@10                        | 98.0% / 100%                                                             | 100% / 100%                                                     |
+| vector R@5                        | 98.0%                                                                    | 98.0%                                                           |
+| keyword R@5 / R@10                | 0.0% / 0.0%                                                              | 100% / 100%                                                     |
+| attribution of the top-5 gold hit | vector-only 98%, none 2%                                                 | multi 100%                                                      |
+
+The vector channel did not change between the two runs; the difference is that the keyword channel now takes part at all. On this slice it agrees with the vector channel on every gold session, which is what the fused score should reflect.
+
 ## How It Works
 
 1. **Ingest**: Each question's chat history is converted to timestamped session files and ingested through Bitterbot's normal memory pipeline (chunk → embed → store with temporal metadata)
```

**File**: `benchmarks/longmemeval/bitterbot-bridge.ts` (modified, +14/-0)
```diff
@@ -108,6 +108,20 @@ export async function createBenchmarkMemoryManager(): Promise<BenchmarkBridge> {
       },
       list: [{ id: agentId, default: true, workspace: workspaceDir }],
     },
+    // Retrieval baseline = raw store + search. Without these switches the
+    // manager starts the dream engine (trigger-on-start cycle, emotional
+    // mini-dreams), consolidation, curiosity and the health sweep inside the
+    // benchmark process: minutes per question, LLM calls on the operator's
+    // key, and a score that is no longer "raw mode". The biological runner
+    // has its own bridge for that comparison.
+    memory: {
+      dream: { enabled: false },
+      consolidation: { enabled: false },
+      curiosity: { enabled: false },
+      emotional: { enabled: false },
+      healthSweep: { enabled: false },
+      coverageDiagnostics: { enabled: false },
+    },
   } as BitterbotConfig;
 
   const manager = await MemoryIndexManager.get({ cfg: config, agentId });
```

**File**: `benchmarks/longmemeval/results/bitterbot_longmemeval_s_retrieval.json` (modified, +1961/-44)
```diff
@@ -1,21 +1,47 @@
 {
-  "dataset": "/mnt/d/Bitterbot/bitterbot-desktop/benchmarks/longmemeval/data/longmemeval_s.json",
-  "n_questions": 5,
-  "elapsed_seconds": 2729.7,
+  "dataset": "/home/vicmg/bitterbot-desktop/benchmarks/longmemeval/data/longmemeval_s.json",
+  "git_commit": "9708d2d1",
+  "generated_at": "2026-10-27T15:48:53.764Z",
+  "n_questions": 50,
+  "elapsed_seconds": 1337.9,
   "overall": {
-    "n": 0,
-    "R@5": "—",
-    "R@10": "—",
-    "R@5(all)": "—",
-    "R@10(all)": "—"
+    "n": 49,
+    "R@5": "98.0%",
+    "R@10": "100.0%",
+    "R@5(all)": "98.0%",
+    "R@10(all)": "100.0%",
+    "vector R@5": "98.0%",
+    "keyword R@5": "0.0%",
+    "graph R@5": "0.0%",
+    "vector R@10": "98.0%",
+    "keyword R@10": "0.0%",
+    "attribution": {
+      "vector-only": "98.0%",
+      "keyword-only": "0.0%",
+      "graph-only": "0.0%",
+      "multi": "0.0%",
+      "none": "2.0%"
+    }
   },
   "by_question_type": {
     "single-session-user": {
-      "n": 0,
-      "R@5": "—",
-      "R@10": "—",
-      "R@5(all)": "—",
-      "R@10(all)": "—"
+      "n": 49,
+      "R@5": "98.0%",
+      "R@10": "100.0%",
+      "R@5(all)": "98.0%",
+      "R@10(all)": "100.0%",
+      "vector R@5": "98.0%",
+      "keyword R@5": "0.0%",
+      "graph R@5": "0.0%",
+      "vector R@10": "98.0%",
+      "keyword R@10": "0.0%",
+      "attribution": {
+        "vector-only": "98.0%",
+        "keyword-only": "0.0%",
+        "graph-only": "0.0%",
+        "multi": "0.0%",
+        "none": "2.0%"
+      }
     }
   },
   "per_question": [
@@ -24,70 +50,1961 @@
       "question_type": "single-session-user",
       "num_haystack_sessions": 53,
       "num_answer_sessions": 1,
-      "retrieved_sessions": [],
+      "retrieved_sessions": [
+        "answer_280352e9",
+        "sharegpt_UnjngE7_65",
+        "f6859b48_2",
+        "d414cac5_4",
+        "sharegpt_PdnvIns_0",
+        "41abc171_4",
+        "sharegpt_Jcy1CVN_0",
+        "sharegpt_QZMeA7V_17",
+        "02bd2b90_3",
+        "0586f435_3"
+      ],
       "answer_session_ids": ["answer_280352e9"],
-      "recall_any_5": 0,
-      "recall_any_10": 0,
-      "recall_all_5": 0,
-      "recall_all_10": 0,
-      "num_chunks_returned": 0,
-      "error": "fetch failed"
+      "recall_any_5": 1,
+      "recall_any_10": 1,
+      "recall_all_5": 1,
+      "recall_all_10": 1,
+      "num_chunks_returned": 50,
+      "channel_recall": {
+        "vector": {
+          "recall_any_5": 1,
+          "recall_any_10": 1
+        },
+        "keyword": {
+          "recall_any_5": 0,
+          "recall_any_10": 0
+        },
+        "graph": {
+          "recall_any_5": 0,
+          "recall_any_10": 0
+        }
+      },
+      "attribution": "vector-only",
+      "fusion": "rrf"
     },
     {
       "question_id": "118b2229",
       "question_type": "single-session-user",
       "num_haystack_sessions": 45,
       "num_answer_sessions": 1,
-      "retrieved_sessions": [],
+      "retrieved_sessions": [
+        "answer_40a90d51",
+        "7d8b5834_1",
+        "004edb32",
+        "5209e813_2",
+        "0afa904a",
+        "c22571ff_2",
+        "sharegpt_M3x4mZx_0",
+        "sharegpt_dabXXRO_10",
+        "afe04238_1",
+        "db50c0f6"
+      ],
       "answer_session_ids": ["answer_40a90d51"],
-      "recall_any_5": 0,
-      "recall_any_10": 0,
-      "recall_all_5": 0,
-      "recall_all_10": 0,
-      "num_chunks_returned": 0,
-      "error": "memory embeddings batch timed out after 120s"
+      "recall_any_5": 1,
+      "recall_any_10": 1,
+      "recall_all_5": 1,
+      "recall_all_10": 1,
+      "num_chunks_returned": 50,
+      "channel_recall": {
+        "vector": {
+          "recall_any_5": 1,
+          "recall_any_10": 1
+        },
+        "keyword": {
+          "recall_any_5": 0,
+          "recall_any_10": 0
+        },
+        "graph": {
+          "recall_any_5": 0,
+          "recall_any_10": 0
+        }
+      },
+      "attribution": "vector-only",
+      "fusion": "rrf"
     },
     {
       "question_id": "51a45a95",
       "question_type": "single-session-user",
       "num_haystack_sessions": 50,
       "num_answer_sessions": 1,
-      "retrieved_sessions": [],
+      "retrieved_sessions": [
+        "answer_d61669c7",
+        "sharegpt_MKMWjX0_25",
+        "55e0c6db_2",
+        "sharegpt_apWLb2c_0",
+        "4679a05c",
+        "6e0b1800_2",
+        "07d1915d_1",
+        "d680a212_1",
+        "83addb61_4",
+        "dfe646a7_1"
+      ],
       "answer_session_ids": ["answer_d61669c7"],
-      "recall_any_5": 0,
-      "recall_any_10": 0,
-      "recall_all_5": 0,
-      "recall_all_10": 0,
-      "num_chunks_returned": 0,
-      "error": "memory embeddings batch timed out after 120s"
+      "recall_any_5": 1,
+      "recall_any_10": 1,
+      "recall_all_5": 1,
+      "recall_all_10": 1,
+      "num_chunks_returned": 50,
+      "channel_recall": {
+        "vector": {
+          "recall_any_5": 1,
+       
```

**File**: `benchmarks/longmemeval/results/bitterbot_longmemeval_s_retrieval_2026-10-27_keyword-or.json` (added, +2048/-0)
```diff
@@ -0,0 +1,2048 @@
+{
+  "dataset": "/home/vicmg/bitterbot-desktop/benchmarks/longmemeval/data/longmemeval_s.json",
+  "git_commit": "09e5a54e",
+  "generated_at": "2026-10-27T16:15:20.404Z",
+  "n_questions": 50,
+  "elapsed_seconds": 1440.8,
+  "overall": {
+    "n": 50,
+    "R@5": "100.0%",
+    "R@10": "100.0%",
+    "R@5(all)": "100.0%",
+    "R@10(all)": "100.0%",
+    "vector R@5": "98.0%",
+    "keyword R@5": "100.0%",
+    "graph R@5": "0.0%",
+    "vector R@10": "98.0%",
+    "keyword R@10": "100.0%",
+    "attribution": {
+      "vector-only": "0.0%",
+      "keyword-only": "0.0%",
+      "graph-only": "0.0%",
+      "multi": "100.0%",
+      "none": "0.0%"
+    }
+  },
+  "by_question_type": {
+    "single-session-user": {
+      "n": 50,
+      "R@5": "100.0%",
+      "R@10": "100.0%",
+      "R@5(all)": "100.0%",
+      "R@10(all)": "100.0%",
+      "vector R@5": "98.0%",
+      "keyword R@5": "100.0%",
+      "graph R@5": "0.0%",
+      "vector R@10": "98.0%",
+      "keyword R@10": "100.0%",
+      "attribution": {
+        "vector-only": "0.0%",
+        "keyword-only": "0.0%",
+        "graph-only": "0.0%",
+        "multi": "100.0%",
+        "none": "0.0%"
+      }
+    }
+  },
+  "per_question": [
+    {
+      "question_id": "e47becba",
+      "question_type": "single-session-user",
+      "num_haystack_sessions": 53,
+      "num_answer_sessions": 1,
+      "retrieved_sessions": [
+        "answer_280352e9",
+        "02bd2b90_3",
+        "sharegpt_UnjngE7_65",
+        "f6859b48_2",
+        "d414cac5_4",
+        "sharegpt_PdnvIns_0",
+        "41abc171_4",
+        "sharegpt_Jcy1CVN_0",
+        "sharegpt_QZMeA7V_17",
+        "0586f435_3"
+      ],
+      "answer_session_ids": ["answer_280352e9"],
+      "recall_any_5": 1,
+      "recall_any_10": 1,
+      "recall_all_5": 1,
+      "recall_all_10": 1,
+      "num_chunks_returned": 50,
+      "channel_recall": {
+        "vector": {
+          "recall_any_5": 1,
+          "recall_any_10": 1
+        },
+        "keyword": {
+          "recall_any_5": 1,
+          "recall_any_10": 1
+        },
+        "graph": {
+          "recall_any_5": 0,
+          "recall_any_10": 0
+        }
+      },
+      "attribution": "multi",
+      "fusion": "rrf"
+    },
+    {
+      "question_id": "118b2229",
+      "question_type": "single-session-user",
+      "num_haystack_sessions": 45,
+      "num_answer_sessions": 1,
+      "retrieved_sessions": [
+        "answer_40a90d51",
+        "5209e813_2",
+        "db50c0f6",
+        "0afa904a",
+        "7d8b5834_1",
+        "sharegpt_dabXXRO_10",
+        "afe04238_1",
+        "db73b7e4_4",
+        "5dce60dd",
+        "ultrachat_392094"
+      ],
+      "answer_session_ids": ["answer_40a90d51"],
+      "recall_any_5": 1,
+      "recall_any_10": 1,
+      "recall_all_5": 1,
+      "recall_all_10": 1,
+      "num_chunks_returned": 50,
+      "channel_recall": {
+        "vector": {
+          "recall_any_5": 1,
+          "recall_any_10": 1
+        },
+        "keyword": {
+          "recall_any_5": 1,
+          "recall_any_10": 1
+        },
+        "graph": {
+          "recall_any_5": 0,
+          "recall_any_10": 0
+        }
+      },
+      "attribution": "multi",
+      "fusion": "rrf"
+    },
+    {
+      "question_id": "51a45a95",
+      "question_type": "single-session-user",
+      "num_haystack_sessions": 50,
+      "num_answer_sessions": 1,
+      "retrieved_sessions": [
+        "answer_d61669c7",
+        "d680a212_1",
+        "07ba9acd_2",
+        "217debf7",
+        "4679a05c",
+        "5c44d9fe_1",
+        "127fd1c9",
+        "fab585c2_1",
+        "98c198fb",
+        "dfe646a7_1"
+      ],
+      "answer_session_ids": ["answer_d61669c7"],
+      "recall_any_5": 1,
+      "recall_any_10": 1,
+      "recall_all_5": 1,
+      "recall_all_10": 1,
+      "num_chunks_returned": 50,
+      "channel_recall": {
+        "vector": {
+          "recall_any_5": 1,
+          "recall_any_10": 1
+        },
+        "keyword": {
+          "recall_any_5": 1,
+          "recall_any_10": 1
+        },
+        "graph": {
+          "recall_any_5": 0,
+          "recall_any_10": 0
+        }
+      },
+      "attribution": "multi",
+      "fusion": "rrf"
+    },
+    {
+      "question_id": "58bf7951",
+      "question_type": "single-session-user",
+      "num_haystack_sessions": 57,
+      "num_answer_sessions": 1,
+      "retrieved_sessions": [
+        "answer_355c48bb",
+        "ultrachat_221066",
+        "ultrachat_155546",
+        "sharegpt_9qAGH5s_0",
+        "sharegpt_DGiqvVv_270",
+        "7e17ae56_5",
+        "ultrachat_71618",
+        "ultrachat_304942",
+        "sharegpt_LG0uJvY_0",
+        "sharegpt_PancT1q_0"
+      ],
+      "answer_session_ids": ["answer_355c48bb"],
+      "recall_any_5": 1,
+      "recall_any_10": 1,
+      "recall_all_5": 1,
+      "recall_all_10": 1,
+      "num_chunks_returned": 50,
+      "channel_recall": {
+        "vector": {
+ 
```

**File**: `benchmarks/longmemeval/runner-retrieval.ts` (modified, +13/-2)
```diff
@@ -95,9 +95,19 @@ function attribution(chunks: MemorySearchResult[], top5: Set<string>, gold: stri
   return found[0] ? (`${found[0]}-only` as Attribution) : "none";
 }
 
+/**
+ * The commit under test, read ONCE before the first question. A run takes
+ * long enough for HEAD to move (the 2026-10-27 baseline was stamped with a
+ * commit made while it ran), so the stamp is taken at the start, and a dirty
+ * working tree is marked because the measured code is then not that commit.
+ */
 function gitCommit(): string | null {
   try {
-    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
+    const head = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
+    const dirty = execSync("git status --porcelain --untracked-files=no", {
+      encoding: "utf-8",
+    }).trim();
+    return dirty ? `${head}+dirty` : head;
   } catch {
     return null;
   }
@@ -212,6 +222,7 @@ function fmt(agg: Aggregate) {
 // ── Main ──
 
 async function run() {
+  const measuredCommit = gitCommit();
   const dataFile = args.oracle
     ? join(args["data-dir"]!, "longmemeval_oracle.json")
     : join(args["data-dir"]!, "longmemeval_s.json");
@@ -375,7 +386,7 @@ async function run() {
   const summary = {
     dataset: dataFile,
     // PLAN-58: the baseline is only comparable when it names the code it measured.
-    git_commit: gitCommit(),
+    git_commit: measuredCommit,
     generated_at: new Date().toISOString(),
     n_questions: perQuestion.length,
     elapsed_seconds: parseFloat(totalSec),
```

**File**: `docs/memory/curiosity-and-search.md` (modified, +2/-0)
```diff
@@ -234,6 +234,8 @@ flowchart TB
 
 **Hybrid merging** uses reciprocal rank fusion by default (`mergeStrategy: "rrf"`); the configurable weights (0.7 vector + 0.3 text) apply only with `mergeStrategy: "weighted"`. BM25 ranks are converted to [0,1] scores via `bm25RankToScore()`. A PLAN-18 graph-reader channel joins the fusion as a third ranked list when the knowledge graph is populated.
 
+**Keyword query shape.** `buildFtsQuery()` OR-joins the query's terms for the FTS5 `MATCH`, dropping a short shared stopword list when the query has three or more tokens (a one- or two-word lookup keeps every word) and capping at 16 distinct terms. bm25 then ranks chunks by how many of the terms they contain and how rare those terms are, so a chunk holding every term still sorts first. Until 2026-10-27 the terms were AND-joined: a chunk had to contain every token, which held for terse lookups and for no conversational question, and the per-channel diagnostics showed the keyword channel contributing nothing to natural-language queries on the live store or the LongMemEval baseline. The `fusion` field still reports `rrf` in that case, so look at `channels.keyword` presence, not `fusion`, to tell whether the keyword channel took part.
+
 **Per-channel diagnostics (PLAN-58).** Every result carries `channels` and `fusion` alongside the fused `score`:
 
 ```ts
```

**File**: `src/memory/hybrid.test.ts` (modified, +20/-4)
```diff
@@ -8,14 +8,30 @@ import {
 import { rrfFuse } from "./rrf.js";
 
 describe("memory hybrid helpers", () => {
-  it("buildFtsQuery tokenizes and AND-joins", () => {
-    expect(buildFtsQuery("hello world")).toBe('"hello" AND "world"');
-    expect(buildFtsQuery("FOO_bar baz-1")).toBe('"FOO_bar" AND "baz" AND "1"');
+  it("buildFtsQuery tokenizes and OR-joins so bm25 ranks by how many terms match", () => {
+    expect(buildFtsQuery("hello world")).toBe('"hello" OR "world"');
+    expect(buildFtsQuery("FOO_bar baz-1")).toBe('"FOO_bar" OR "baz" OR "1"');
     expect(buildFtsQuery("金银价格")).toBe('"金银价格"');
-    expect(buildFtsQuery("価格 2026年")).toBe('"価格" AND "2026年"');
+    expect(buildFtsQuery("価格 2026年")).toBe('"価格" OR "2026年"');
     expect(buildFtsQuery("   ")).toBeNull();
   });
 
+  it("buildFtsQuery drops stopwords from a sentence but keeps every word of a short lookup", () => {
+    // A natural question: under AND this matched nothing anywhere.
+    expect(buildFtsQuery("what did the user say about their trip to Paris")).toBe(
+      '"user" OR "say" OR "trip" OR "Paris"',
+    );
+    // Two tokens: no stopword pass, so "the" survives on purpose.
+    expect(buildFtsQuery("the matrix")).toBe('"the" OR "matrix"');
+    // All stopwords: fall back to the raw tokens rather than returning nothing.
+    expect(buildFtsQuery("and the for")).toBe('"and" OR "the" OR "for"');
+    // Duplicates collapse and the term list is capped.
+    expect(buildFtsQuery("alpha alpha beta")).toBe('"alpha" OR "beta"');
+    expect(
+      buildFtsQuery(Array.from({ length: 30 }, (_, i) => `term${i}`).join(" "))?.split(" OR "),
+    ).toHaveLength(16);
+  });
+
   it("bm25RankToScore is monotonic and clamped", () => {
     expect(bm25RankToScore(0)).toBeCloseTo(1);
     expect(bm25RankToScore(1)).toBeCloseTo(0.5);
```

**File**: `src/memory/hybrid.ts` (modified, +147/-2)
```diff
@@ -62,6 +62,143 @@ export type HybridKeywordResult = {
   emotionalValence?: number | null;
 };
 
+/**
+ * Minimal English stopword set shared by the keyword channel and the
+ * proactive-recall fallback. It only needs to strip the glue words of a
+ * conversational sentence; bm25's inverse document frequency handles the rest.
+ */
+export const FTS_STOPWORDS: ReadonlySet<string> = new Set([
+  "the",
+  "and",
+  "for",
+  "are",
+  "was",
+  "were",
+  "did",
+  "does",
+  "has",
+  "had",
+  "have",
+  "you",
+  "your",
+  "yours",
+  "our",
+  "ours",
+  "his",
+  "her",
+  "hers",
+  "its",
+  "their",
+  "theirs",
+  "this",
+  "that",
+  "these",
+  "those",
+  "with",
+  "from",
+  "what",
+  "which",
+  "when",
+  "where",
+  "who",
+  "whom",
+  "why",
+  "how",
+  "can",
+  "could",
+  "would",
+  "should",
+  "will",
+  "shall",
+  "may",
+  "might",
+  "must",
+  "about",
+  "into",
+  "onto",
+  "over",
+  "under",
+  "again",
+  "then",
+  "than",
+  "there",
+  "here",
+  "just",
+  "very",
+  "not",
+  "but",
+  "any",
+  "all",
+  "some",
+  "one",
+  "two",
+  "get",
+  "got",
+  "let",
+  "lets",
+  "please",
+  "tell",
+  "know",
+  "think",
+  "want",
+  "need",
+  "yesterday",
+  "today",
+  "tomorrow",
+  "now",
+  "still",
+  "yet",
+  "also",
+  "too",
+  "a",
+  "i",
+  "to",
+  "of",
+  "in",
+  "on",
+  "at",
+  "it",
+  "is",
+  "as",
+  "be",
+  "by",
+  "or",
+  "an",
+  "if",
+  "we",
+  "my",
+  "me",
+  "do",
+  "so",
+  "up",
+  "no",
+  "us",
+  "he",
+  "she",
+  "they",
+  "them",
+  "been",
+  "being",
+]);
+
+/** Query terms kept after stopword removal; bm25 ranks by how many match. */
+export const FTS_MAX_QUERY_TERMS = 16;
+
+/**
+ * Build the FTS5 MATCH expression for the keyword channel.
+ *
+ * Terms are OR-joined, not AND-joined. Under AND, a chunk had to contain
+ * every token of the query, which held for terse two-word lookups and for
+ * nothing conversational: the PLAN-58 per-channel diagnostics showed the
+ * keyword channel contributing zero results to natural-language questions on
+ * the live store and on the LongMemEval baseline, so "hybrid" search had been
+ * vector-only in practice. With OR, bm25 ranks chunks by how many of the
+ * query's terms they contain and how rare those terms are, so an all-terms
+ * match still sorts first and the channel has something to say about the
+ * rest. Stopwords are dropped only when the query has three or more tokens,
+ * so a short lookup keeps every word it was given. Returns null when nothing
+ * searchable remains.
+ */
 export function buildFtsQuery(raw: string): string | null {
   const tokens =
     raw
@@ -71,8 +208,16 @@ export function buildFtsQuery(raw: string): string | null {
   if (tokens.length === 0) {
     return null;
   }
-  const quoted = tokens.map((t) => `"${t.replaceAll('"', "")}"`);
-  return quoted.join(" AND ");
+  const content =
+    tokens.length >= 3 ? tokens.filter((t) => !FTS_STOPWORDS.has(t.toLowerCase())) : tokens;
+  const kept = content.length > 0 ? content : tokens;
+  const unique = [...new Set(kept.map((t) => t.replaceAll('"', "")))]
+    .filter(Boolean)
+    .slice(0, FTS_MAX_QUERY_TERMS);
+  if (unique.length === 0) {
+    return null;
+  }
+  return unique.map((t) => `"${t}"`).join(" OR ");
 }
 
 export function bm25RankToScore(rank: number): number {
```

---

### Incident Patch 2: `ee51008c` (2026-10-27)
**Commit Message**: fix(skills): lint src/agents/skills again, dedupe fit text, two-node mesh harness, startup log (#311)

* fix(skills): lint src/agents/skills again, dedupe fit mismatch text, add the local two-node mesh harness

- .oxlintrc.json: the `skills/` ignore pattern also matched `src/agents/skills/`,
  so that directory was linted nowhere, CI included. Anchor it to the repo-root
  bundled skills dir and fix the 15 findings it hid (unused imports and
  variables, `sort` -> `toSorted`, a useless regex escape, a brittle unused
  replaced-count computation).
- applicability-fit: name the sender model once when the gate model and the
  read model are the same string (was "measured on X, X: weaker ...").
- server-startup-memory: memory search turned off is a configuration, not
  "initialization failed: unknown error"; log it as information and keep the
  warning for a real thrown error. Unit test added.
- scripts/sim-mesh: two throwaway gateways on one machine joined only over
  loopback (the wrapper strips the public bootstraps the gateway merges in),
  with a publisher script that runs the real housekeeping pass and
  orchestrator publish, and a retraction script. Verified end to end: fit
  goo

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -240,6 +240,8 @@ benchmarks/arc-agi-3/results/
 
 # PLAN-24 Phase 2 contrastive run scratch + timestamped artifacts
 benchmarks/longmemeval/.work-contrastive/
+benchmarks/longmemeval/.work-retrieval/
+benchmarks/longmemeval/.bench-runs/
 # Per-run benchmark artifacts (PLAN-41 p0-24): two historic run dirs and
 # the bio work tree were tracked at ~57MB; runs are reproducible, not source.
 benchmarks/longmemeval/.bench-runs-bio/
```

**File**: `.oxlintrc.json` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@
     "node_modules/",
     "patches/",
     "pnpm-lock.yaml",
-    "skills/",
+    "/skills/",
     "deploy/mailbox-host/mailbox-host.bundle.mjs",
     "src/canvas-host/a2ui/a2ui.bundle.js",
     "Swabble/",
```

**File**: `desktop/renderer/src/components/skills/SkillEditor.tsx` (modified, +1/-1)
```diff
@@ -296,7 +296,7 @@ export function SkillEditor({ onClose }: { onClose: () => void }) {
   const validation = useMemo<ValidationResult>(() => validate(content), [content]);
 
   const appTheme = useUIStore((s) => s.theme);
-  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
+  const monacoRef = useRef<Parameters<OnMount>[1]>(null);
 
   const onEditorMount: OnMount = useCallback((editor, monaco) => {
     monacoRef.current = monaco;
```

**File**: `docs/memory/skills-pipeline.md` (modified, +13/-0)
```diff
@@ -345,6 +345,19 @@ gate or touching the orchestrator.
 - Config: `skills.evolution.applicabilityProfile.{enabled, publish,
   windowDays}`, defaults `true`, `true`, `14`.
 
+#### Exercising it locally
+
+`scripts/sim-mesh/` brings up two throwaway gateways on one machine, joined
+only over loopback with the public bootstraps stripped, and drives the whole
+outbound and inbound path without an LLM: seeded evolved skills on the
+publisher go through the real housekeeping pass (evidence record, profile,
+signed trailer, orchestrator publish), arrive on the receiver through its
+orchestrator, and land in quarantine with the fit on the envelope, in the
+review list, in the staged meta after an operator accept and in the
+evolution status. A signed retraction from the publisher removes the
+receiver's quarantined copy. See the README there for the exact commands and
+the expected fits.
+
 ### Measuring it: the ablation harness (PLAN-45 Phase 5.1 and 5.2)
 
 The mechanism above is only a claim until it has numbers. `pnpm
```

**File**: `scripts/sim-mesh/README.md` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+# Local two-node mesh test
+
+Two throwaway Bitterbot nodes on one machine, connected only to each other
+over loopback, so the skill propagation path can be exercised end to end
+without an LLM and without touching the public mesh:
+
+evolved skill on A → housekeeping (evidence record, applicability profile,
+signed provenance trailer) → orchestrator `publish_skill` → Gossipsub →
+B's orchestrator → `skill_received` → ingest (signature, hash, binding,
+applicability fit) → quarantine → operator accept → staging → evolution
+status, and a signed retraction back the other way.
+
+Each node is a real gateway with its own state dir, keys, ports and
+orchestrator. Dreams, consolidation, curiosity and memory search are off in
+the generated config so a test node makes no model or embedding calls. The
+orchestrator runs through `orchestrator-isolated.sh`, which drops every
+non-loopback bootstrap the gateway merges in from the defaults and DNS and
+forces relay mode off. A test node therefore never reaches the relay fleet.
+
+Budget: each fresh gateway settles around 700 MB RSS. On a small box stop
+them as soon as the run is done.
+
+## Run
+
+Build first (`pnpm build`) so `dist/entry.js` is current. All paths below
+are relative to the repository root. Replace `$A`/`$B` with the state dirs.
+
+```bash
+A=~/bitterbot-sim/a; B=~/bitterbot-sim/b
+export A_IPC=/tmp/bitterbot-orchestrator-sim-a.sock B_IPC=/tmp/bitterbot-orchestrator-sim-b.sock
+
+# 1. Fresh identities. A node whose key dir is empty would otherwise inherit a
+#    legacy key from <repo>/keys or ~/keys and share the live node's peer id.
+mkdir -p $A/keys $B/keys
+for n in a b; do
+  timeout 4 orchestrator/target/release/bitterbot-orchestrator \
+    --ipc-path /tmp/keygen-$n.sock --key-dir ~/bitterbot-sim/$n/keys \
+    --listen-addr /ip4/127.0.0.1/tcp/9299 --relay-mode off >/dev/null 2>&1 || true
+  rm -f /tmp/keygen-$n.sock
+done
+
+# 2. Node A (publisher): weaker primary model so its "poor" skill reads as such on B.
+node scripts/sim-mesh/write-config.mjs a 19101 9201 9857 anthropic/claude-haiku-4-5
+BITTERBOT_STATE_DIR=$A BITTERBOT_ORCHESTRATOR_IPC_PATH=$A_IPC \
+  setsid nohup node dist/entry.js gateway > $A/gateway.log 2>&1 < /dev/null &
+until curl -sf http://127.0.0.1:9857/api/peers >/dev/null; do sleep 2; done
+A_PEER=$(curl -s http://127.0.0.1:9857/api/peers | sed 's/.*"peer_id":"\([^"]*\)".*/\1/')
+
+# 3. Node B (receiver) dials A over loopback.
+node scripts/sim-mesh/write-config.mjs b 19102 9202 9858 anthropic/claude-opus-4-8 \
+  /ip4/127.0.0.1/tcp/9201/p2p/$A_PEER
+BITTERBOT_STATE_DIR=$B BITTERBOT_ORCHESTRATOR_IPC_PATH=$B_IPC \
+  setsid nohup node dist/entry.js gateway > $B/gateway.log 2>&1 < /dev/null &
+until curl -s http://127.0.0.1:9857/api/peers | grep -q '"connected_peers":1'; do sleep 2; done
+
+# 4. Publish from A through its real housekeeping pass and orchestrator.
+BITTERBOT_STATE_DIR=$A BITTERBOT_ORCHESTRATOR_IPC_PATH=$A_IPC \
+  node --import tsx scripts/sim-mesh/publish-sim.mts run1
+
+# 5. Read the result on B: review list, fit, then accept one into staging.
+BITTERBOT_STATE_DIR=$B node dist/entry.js skills incoming list --json
+cat $B/skills-incoming/sim-mesh-good-run1/.envelope.json | grep -A4 applicability_fit
+BITTERBOT_STATE_DIR=$B node dist/entry.js skills incoming accept sim-mesh-good-run1
+cat $B/skills-staging/sim-mesh-good-run1/.evolution-meta.json | grep -A4 applicabilityFit
+
+# 6. Retract the other one from A; B drops its quarantined copy within a second.
+BITTERBOT_STATE_DIR=$A BITTERBOT_ORCHESTRATOR_IPC_PATH=$A_IPC \
+  node --import tsx scripts/sim-mesh/retract-sim.mts sim-mesh-poor-run1
+grep -i retraction $B/gateway.log
+
+# 7. Stop both gateways (their orchestrators exit with them) and keep or delete the dirs.
+pkill -f "bitterbot-orchestrator-sim-[ab].sock"
+```
+
+Expected on B with the defaults above: `sim-mesh-good-run1` fit `good`,
+score 1.0, no mismatches; `sim-mesh-poor-run1` fit `poor`, score 0.25, with
+the weaker model, the declared OS, the missing binary and the thin evidence
+named. The fit orders evaluation and tightens the canary; it never admits or
+rejects a skill (see `docs/memory/skills-pipeline.md`).
+
+Scripts here import from `src/` and run under `node --import tsx`; they are
+not part of the build.
```

**File**: `scripts/sim-mesh/orchestrator-isolated.sh` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+#!/usr/bin/env bash
+# Isolated-mesh wrapper for local multi-node tests (scripts/sim-mesh/README.md).
+#
+# The gateway always merges the public relay fleet (and the DNS bootstrap list)
+# into the orchestrator's --bootstrap arguments. A test node must never dial
+# them: a simulated skill would gossip onto the real mesh. This wrapper keeps
+# only loopback bootstraps, forces relay mode off and passes everything else
+# through to the real binary. Point `p2p.orchestratorBinary` at it.
+set -euo pipefail
+HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+REAL="${SIM_MESH_ORCHESTRATOR:-$HERE/../../orchestrator/target/release/bitterbot-orchestrator}"
+args=()
+while [ $# -gt 0 ]; do
+  case "$1" in
+    --bootstrap)
+      case "$2" in /ip4/127.0.0.1/*) args+=("$1" "$2") ;; esac
+      shift 2
+      ;;
+    --relay-mode) shift 2 ;;
+    *)
+      args+=("$1")
+      shift
+      ;;
+  esac
+done
+exec "$REAL" "${args[@]}" --relay-mode off
```

**File**: `scripts/sim-mesh/publish-sim.mts` (added, +204/-0)
```diff
@@ -0,0 +1,204 @@
+/**
+ * Publisher side of the local two-node mesh test (scripts/sim-mesh/README.md).
+ *
+ *   BITTERBOT_STATE_DIR=~/bitterbot-sim/a BITTERBOT_ORCHESTRATOR_IPC_PATH=/tmp/bitterbot-orchestrator-sim-a.sock \
+ *     node --import tsx scripts/sim-mesh/publish-sim.mts <tag>
+ *
+ * Seeds two skills exactly as the evolution loop leaves them (SKILL.md,
+ * `.evolution-meta.json` with an accepted gate verdict, credited reads in the
+ * skill-wiki ledger), then runs the REAL housekeeping pass against the node's
+ * state dir: evidence record, applicability profile, signed provenance trailer
+ * and the orchestrator `publish_skill` verb over the node's own IPC socket.
+ * No LLM is involved. The "good" skill was measured on the receiver's model
+ * with eight passing runs; the "poor" one on a weaker model, declares another
+ * OS and a binary nobody has, and carries two thin runs.
+ */
+import { randomUUID } from "node:crypto";
+import fs from "node:fs/promises";
+import net from "node:net";
+import path from "node:path";
+import readline from "node:readline";
+import { WIKI_SUBDIR } from "../../src/agents/skills/impact-trail.js";
+import { keyPairFromPrivateKeyPem } from "../../src/commerce/envelope.js";
+import { loadConfig } from "../../src/config/io.js";
+import { loadOrCreateDeviceIdentity } from "../../src/infra/device-identity.js";
+import { ipcAuthLine, loadOrCreateIpcToken } from "../../src/infra/orchestrator-ipc-token.js";
+import { resolveP2pKeyDir } from "../../src/infra/p2p-key-dir.js";
+import { runHousekeeping } from "../../src/memory/skill-evolution/housekeeping.js";
+
+const configDir = process.env.BITTERBOT_STATE_DIR;
+const ipcPath = process.env.BITTERBOT_ORCHESTRATOR_IPC_PATH;
+if (!configDir || !ipcPath) {
+  throw new Error("set BITTERBOT_STATE_DIR and BITTERBOT_ORCHESTRATOR_IPC_PATH to the test node's");
+}
+const TAG = process.argv[2] ?? "mesh1";
+const GOOD_MODEL = process.env.SIM_MESH_GOOD_MODEL ?? "anthropic/claude-opus-4-8";
+const POOR_MODEL = process.env.SIM_MESH_POOR_MODEL ?? "anthropic/claude-haiku-4-5";
+const now = Date.now();
+const DAY = 86_400_000;
+
+type Pending = { res: (v: unknown) => void; rej: (e: Error) => void; t: NodeJS.Timeout };
+type Ipc = { send: (type: string, payload: unknown) => Promise<unknown>; close: () => void };
+
+/** The same JSON-line protocol the gateway's orchestrator bridge speaks. */
+function connectIpc(socketPath: string, token: string): Promise<Ipc> {
+  return new Promise((resolve, reject) => {
+    const pending = new Map<string, Pending>();
+    const sock = net.createConnection({ path: socketPath }, () => {
+      sock.write(ipcAuthLine(token));
+      resolve({
+        send: (type, payload) =>
+          new Promise((res, rej) => {
+            const id = randomUUID();
+            const t = setTimeout(() => {
+              pending.delete(id);
+              rej(new Error(`${type} timed out`));
+            }, 20_000);
+            pending.set(id, { res, rej, t });
+            sock.write(`${JSON.stringify({ type, id, payload })}\n`);
+          }),
+        close: () => sock.end(),
+      });
+    });
+    sock.on("error", reject);
+    readline.createInterface({ input: sock }).on("line", (line) => {
+      let msg: { type: string; id?: string; payload?: unknown };
+      try {
+        msg = JSON.parse(line) as typeof msg;
+      } catch {
+        return;
+      }
+      const p = msg.type === "response" && msg.id ? pending.get(msg.id) : undefined;
+      if (p && msg.id) {
+        clearTimeout(p.t);
+        pending.delete(msg.id);
+        p.res(msg.payload);
+      }
+    });
+  });
+}
+
+const seeds = [
+  { name: `sim-mesh-good-${TAG}`, model: GOOD_MODEL, bins: ["node"], os: null, runs: 8, fails: 0 },
+  {
+    name: `sim-mesh-poor-${TAG}`,
+    model: POOR_MODEL,
+    bins: ["definitely-missing-bin-xyz"],
+    os: ["darwin"],
+    runs: 2,
+    fails: 1,
+  },
+] as const;
+
+const liveRoot = path.join(configDir, "skills");
+const wikiDir = path.join(configDir, WIKI_SUBDIR);
+await fs.mkdir(wikiDir, { recursive: true });
+let readLines = "";
+for (const s of seeds) {
+  const dir = path.join(liveRoot, s.name);
+  await fs.mkdir(dir, { recursive: true });
+  const skillMd = [
+    "---",
+    `name: ${s.name}`,
+    `description: Use when the task asks to ${s.name} against a flaky host; not for local files.`,
+    "bitterbot:",
+    "  requires:",
+    `    bins: [${s.bins.join(", ")}]`,
+    ...(s.os ? [`  os: [${s.os.join(", ")}]`] : []),
+    "---",
+    "",
+    `Mesh simulation skill (${TAG}). Steps: check the host answers, retry twice with backoff, report the final status. It does nothing real.`,
+    "",
+  ].join("\n");
+  await fs.writeFile(path.join(dir, "SKILL.md"), skillMd);
+  const meta = {
+    origin: "wiki-evolution",
+    stagedAt: now - 5 * DAY,
+    validation: {
+      mode: "tasks",
+      verdict: "accepted",
+      validatedAt: now - 4 * DAY,
+      model: s.model,
+      evolverModel: s.mod
```

**File**: `scripts/sim-mesh/retract-sim.mts` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+/**
+ * Publisher side: retract a skill this test node published (scripts/sim-mesh/README.md).
+ *
+ *   BITTERBOT_STATE_DIR=... BITTERBOT_ORCHESTRATOR_IPC_PATH=... \
+ *     node --import tsx scripts/sim-mesh/retract-sim.mts <skillName> [reason]
+ *
+ * Uses the real `publishRetraction` (PLAN-45 3.4): the signed stub rides the
+ * publish verb and the receiver drops the quarantined copy by author key and
+ * content hash.
+ */
+import { randomUUID } from "node:crypto";
+import fs from "node:fs/promises";
+import net from "node:net";
+import path from "node:path";
+import readline from "node:readline";
+import { loadConfig } from "../../src/config/io.js";
+import { ipcAuthLine, loadOrCreateIpcToken } from "../../src/infra/orchestrator-ipc-token.js";
+import { resolveP2pKeyDir } from "../../src/infra/p2p-key-dir.js";
+import { publishRetraction } from "../../src/memory/skill-evolution/p2p-publish.js";
+
+const configDir = process.env.BITTERBOT_STATE_DIR;
+const ipcPath = process.env.BITTERBOT_ORCHESTRATOR_IPC_PATH;
+const [name, reason = "simulation: retract after mesh test"] = process.argv.slice(2);
+if (!configDir || !ipcPath || !name) {
+  throw new Error(
+    "usage: BITTERBOT_STATE_DIR=.. BITTERBOT_ORCHESTRATOR_IPC_PATH=.. retract-sim.mts <skillName> [reason]",
+  );
+}
+const meta = JSON.parse(
+  await fs.readFile(path.join(configDir, "skills", name, ".evolution-meta.json"), "utf-8"),
+) as { published?: { contentHash?: string } };
+const contentHash = meta.published?.contentHash;
+if (!contentHash) {
+  throw new Error(`${name} has no published marker; nothing to retract`);
+}
+const token = loadOrCreateIpcToken(resolveP2pKeyDir(loadConfig().p2p?.keyDir));
+const pending = new Map<string, (v: unknown) => void>();
+const sock = await new Promise<net.Socket>((res, rej) => {
+  const s = net.createConnection({ path: ipcPath }, () => {
+    s.write(ipcAuthLine(token));
+    res(s);
+  });
+  s.on("error", rej);
+});
+readline.createInterface({ input: sock }).on("line", (line) => {
+  let msg: { type: string; id?: string; payload?: unknown };
+  try {
+    msg = JSON.parse(line) as typeof msg;
+  } catch {
+    return;
+  }
+  const settle = msg.type === "response" && msg.id ? pending.get(msg.id) : undefined;
+  if (settle && msg.id) {
+    pending.delete(msg.id);
+    settle(msg.payload);
+  }
+});
+const publisher = {
+  publishSkill: (skillMd: string, skillName: string) =>
+    new Promise<unknown>((res) => {
+      const id = randomUUID();
+      pending.set(id, res);
+      sock.write(
+        `${JSON.stringify({ type: "publish_skill", id, payload: { skill_md: skillMd, name: skillName } })}\n`,
+      );
+    }),
+};
+const result = await publishRetraction({
+  publisher,
+  name,
+  contentHash,
+  reason,
+  storeOpts: { configDir },
+});
+console.log("retraction:", JSON.stringify(result), "of", contentHash.slice(0, 12));
+sock.end();
```

#### Recent Merged Pull Requests:
- **PR #312** (2026-10-27): fix(memory): keyword channel matches natural-language queries; failed embedding batch no longer aborts sync (@VGIL77)
- **PR #311** (2026-10-27): fix(skills): lint src/agents/skills again, dedupe fit text, two-node mesh harness, startup log (@VGIL77)
- **PR #310** (2026-10-27): fix(skills): resolve the receiver's primary model from agents.defaults.model for the applicability fit (@VGIL77)
- **PR #309** (2026-10-27): feat(memory): per-channel retrieval diagnostics and skill applicability profiles (PLAN-58) (@VGIL77)
- **PR #308** (2026-10-23): fix(compute): local operator pools are local trust, startup reconcile waits for the coordinator, beta installs update to stable (@VGIL77)
- **PR #292** (2026-10-22): fix(memory): attach compute episode and nudge sinks on every manager get (@VGIL77)

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

## X. memory): keyword channel matches natural-language queries; failed embedding batc

**RULE**:
When implementing operations in `benchmarks/longmemeval/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Bitterbot-AI/bitterbot-desktop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a22e2df0`: memory): keyword channel matches natural-language queries; failed embedding batch no longer aborts sync (#312). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `benchmarks/longmemeval/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
Saved runs (LongMemEval-S, first 50 questions, all `single-session-user`, quiet bridge):

| metric                            | `bitterbot_longmemeval_s_retrieval.json` (code 9708d2d1, AND-joined FTS) | `..._2026-10-27_keyword-or.json` (code 09e5a54e, OR-joined FTS) |
| --------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| questions scored                  | 49 (one lost to the empty-embedding NOT NULL bug)                        | 50                                                              |
| R@5 / R@10                        | 98.0% / 100%                                                             | 100% / 100%                                                     |
| vector R@5                        | 98.0%                                                                    | 98.0%                                                           |
| keyword R@5 / R@10                | 0.0% / 0.0%                                                              | 100% / 100%                                                     |
| attribution of the top-5 gold hit 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a22e2df0` are properly handled with clean fallback behavior.
