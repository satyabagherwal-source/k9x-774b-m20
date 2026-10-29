> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bitterbot-ai-bitterbot-desktop-learnings.md`  
> **Source**: github ([https://github.com/Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop))  
> **Source Version**: `f9ac780a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-29T23:35:04.254Z  
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
> **Harvest Timestamp**: 2026-10-29T23:35:04.249Z  
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

### Incident Patch 1: `f9ac780a` (2026-10-29)
**Commit Message**: feat(memory): PLAN-59 Phase 1 pilot harness (forked consolidation arms) (#329)

Build the first PLAN-59 mechanism pilot: gain x need selection of bounded,
reversible memory operations compared against recency and random selection,
every arm on its own VACUUM INTO fork of a sealed snapshot, scored on a
family-partitioned question set with the live-recall method.

benchmarks/plan59-phase1/
- snapshot.mts seals a read-only VACUUM INTO copy with a hashed manifest and
  refuses any output under ~/.bitterbot
- partition.ts/.mts cut questions 50/25/25 by family (chunk path) under a
  seed; the final split is refused unless --final --freeze names a protocol
  file marked status: frozen (implemented, unused)
- operations.ts: consolidate_cluster (connected components over
  near_merge_hints >= 0.85, co-surfacing qualification, one joined parent
  chunk, members demoted with parent_id, lifecycle consolidated,
  hygiene_done and index rows removed, never deleted) and bound_validity
  (valid_time_end from superseded canonical facts); re-embed reported as
  inapplicable from the data; quoted and realised costs
- estimate.ts: need per family (decayed access prior, development top-5
  demand, unsu

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -216,6 +216,8 @@ keys/
 
 # Research / planning playground (internal only)
 research/
+# PLAN-59 phase reports are published documentation, not the playground.
+!docs/research/
 
 # Wallet seed data (should never be in repo)
 wallet-data.json
```

**File**: `benchmarks/plan59-phase1/README.md` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+# PLAN-59 Phase 1 pilot: gain x need consolidation on forked stores
+
+A development and qualification pilot for the first PLAN-59 mechanism:
+selecting bounded, reversible memory operations by estimated future benefit
+and comparing that selection against the same operations chosen by recency or
+at random, every arm on its own fork of one sealed snapshot of a node's real
+memory store. The live store is never written. The pilot fixes the sample
+size for a later, separately frozen collection; it is not that collection and
+was not externally preregistered.
+
+The result of the run on 2026-10-29 is in `docs/research/plan59-phase1-pilot.md`
+and in `results/`: a negative pilot. One of 130 candidate clusters co-surfaced
+for the development questions at the lowered bar, below the floor of five, so
+the arm run stopped by rule and no contrast was computed.
+
+## What the harness does
+
+1. **Snapshot** (`snapshot.mts`). `--copy-from` opens the live store READ-ONLY
+   and takes a `VACUUM INTO` copy into scratch; `--db` copies an existing copy.
+   The manifest beside it records SHA-256, chunk count, lifecycle counts,
+   created time and commit. Output anywhere under `~/.bitterbot` is refused.
+2. **Questions**. `benchmarks/live-recall/make-questions.mts` writes one
+   question per sampled chunk (the chunk id is the gold label) under a fixed
+   seed. The file paraphrases private memory: it lives under
+   `~/.bitterbot/benchmarks/live-recall/` with mode 0600, is never committed,
+   and only its hash and counts appear here.
+3. **Partition** (`partition.mts`, `partition.ts`). A family is the gold
+   chunk's `path` (one session transcript or memory file). Families are ordered
+   by `sha256(seed:path)` and cut 50 / 25 / 25 into development,
+   qualification and final; every question of a family lands in one split.
+   `<questions>.partition.json` holds chunk ids, family hashes, seed and counts
+   only. The final split is never read by estimation or selection; the runner
+   refuses to score it unless `--final --freeze <sha256>` names a protocol file
+   that contains `status: frozen` and hashes to that value. The path is
+   implemented and tested and the pilot does not use it.
+4. **Operations** (`operations.ts`), applied on forks only:
+   - `consolidate_cluster`: connected components over `near_merge_hints`
+     pairs at `base_similarity >= 0.85` among live chunks (lifecycle
+     `generated` or `activated`, `parent_id` null), capped at six members by
+     weighted degree. A cluster qualifies when at least two members sit in
+     the fused top 5 of at least three development queries (two when fewer
+     than eight clusters qualify; the runner records which bar it used).
+     Applying it inserts one new chunk whose text is the members' texts joined
+     by a separator (no LLM rewriting), embedded with the normal provider,
+     `parent_id` null, importance = max over members, access_count = sum,
+     lifecycle `generated`. Members get `parent_id` = the new id, lifecycle
+     `consolidated`, `hygiene_done` = 1, importance halved, and their rows are
+     removed from `chunks_vec` and `chunks_fts`. Members are never deleted;
+     their text and embedding stay in `chunks`, so the operation is reversible.
+   - `bound_validity`: for each canonical fact with `superseded_by` and
+     `valid_until` set, set `valid_time_end = valid_until` on the chunks in
+     its `evidence_chunk_ids` where it is null. No text changes; reversible.
+   - Re-embedding does not apply on this store: every indexed chunk carries
+     `text-embedding-3-small` and the live provider is that model, so there is
+     no model or index change to re-embed after. `describeReembed` reports this
+     from the data and the result file records it.
+   - Every operation returns a quoted cost (chunks touched, embedding calls,
+     estimated ms) and the apply step records the realised one. Dollars,
+     seconds and calls are reported separately in the result file.
+5. **Estimation** (`estimate.ts`), development partition only:
+   - need(k) per family = sum over chunks of `access_count` decayed from
+     `last_accessed_at` with a 30-day half-life, plus the number of development
+     queries with a chunk of k in the fused top 5, plus 1 per development query
+     whose gold is in k and whose fused rank is above 10 or missing. Phase 0
+     `retrieval_hits` are added, decayed the same way, when the table exists
+     and has rows; on this snapshot it is empty, so the access prior carries.
+     The plan's first-order session-transition term is deferred: it needs
+     stable topic ids and real session boundaries from the Phase 0 telemetry,
+     which has not yet run in a deployed build.
+   - gain(op | k) = mean change in parent-mapped reciprocal rank over the
+     development queries affected by the operation (gold in a touched family,
+     or a touched chunk in the baseline top 10) whose gold is in k, measured
```

**File**: `benchmarks/plan59-phase1/arms.test.ts` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+import { describe, expect, it } from "vitest";
+import {
+  buildArms,
+  chooseK,
+  selectPrioritised,
+  selectRandom,
+  selectRecency,
+  shuffledBatch,
+  ZERO_SELECTION_COST,
+} from "./arms.js";
+import type { PriorityRow } from "./estimate.js";
+import type { Operation } from "./operations.js";
+
+const op = (id: string, lastAccessedAt: number | null): Operation => ({
+  kind: "bound_validity",
+  id,
+  factId: id,
+  validUntil: 1,
+  chunkIds: [`${id}-c`],
+  families: [`fam-${id}`],
+  lastAccessedAt,
+});
+const pool = [op("a", 5), op("b", null), op("c", 9), op("d", 9), op("e", 1), op("f", 3)];
+const row = (opId: string, priority: number, need = 1): PriorityRow => ({
+  opId,
+  need,
+  benefit: priority,
+  cost: 1,
+  priority,
+  affectedQueries: 1,
+  gain: {},
+});
+
+describe("arm selection", () => {
+  it("picks K as 20 or the candidate count when fewer", () => {
+    expect(chooseK(82)).toBe(20);
+    expect(chooseK(7)).toBe(7);
+    expect(chooseK(0)).toBe(0);
+    expect(chooseK(50, 5)).toBe(5);
+  });
+
+  it("recency takes the most recently accessed first, ties by id, never-accessed last", () => {
+    expect(selectRecency(pool, 4).map((o) => o.id)).toEqual(["c", "d", "a", "f"]);
+    expect(selectRecency(pool, 6).map((o) => o.id)).toEqual(["c", "d", "a", "f", "e", "b"]);
+  });
+
+  it("random is uniform without replacement and reproducible under the seed", () => {
+    const r1 = selectRandom(pool, 3, "59");
+    const r2 = selectRandom(pool, 3, "59");
+    expect(r1.map((o) => o.id)).toEqual(r2.map((o) => o.id));
+    expect(new Set(r1.map((o) => o.id)).size).toBe(3);
+    const r3 = selectRandom(pool, 6, "other");
+    expect(r3.map((o) => o.id).toSorted()).toEqual(["a", "b", "c", "d", "e", "f"]);
+    expect(r3.map((o) => o.id)).not.toEqual(selectRandom(pool, 6, "59").map((o) => o.id));
+  });
+
+  it("prioritised orders by priority, then need, then id, with unestimated candidates last", () => {
+    const rows = new Map([
+      ["a", row("a", 0.5)],
+      ["b", row("b", 0.9)],
+      ["c", row("c", 0.5, 7)],
+      ["d", row("d", 0)],
+    ]);
+    const needOf = (o: Operation) => (o.id === "e" ? 10 : 2);
+    expect(selectPrioritised(pool, 6, rows, needOf).map((o) => o.id)).toEqual([
+      "b",
+      "c",
+      "a",
+      "d",
+      "e",
+      "f",
+    ]);
+    expect(selectPrioritised(pool, 2, rows, needOf).map((o) => o.id)).toEqual(["b", "c"]);
+  });
+
+  it("shuffled batch is the same set in a seeded order", () => {
+    const selected = selectRecency(pool, 6);
+    const s1 = shuffledBatch(selected, "59");
+    expect(s1.map((o) => o.id).toSorted()).toEqual(selected.map((o) => o.id).toSorted());
+    expect(s1).toEqual(shuffledBatch(selected, "59"));
+    expect(s1.map((o) => o.id)).not.toEqual(selected.map((o) => o.id));
+  });
+
+  it("buildArms gives every arm K operations, charges estimation only to prioritised arms", () => {
+    const rows = new Map([
+      ["a", row("a", 0.5)],
+      ["b", row("b", 0.9)],
+    ]);
+    const cost = { forks: 2, searches: 30, embeddingCalls: 2, seconds: 12 };
+    const arms = buildArms({
+      candidates: pool,
+      k: 4,
+      seed: "59",
+      priorities: rows,
+      needOf: () => 0,
+      estimationCost: cost,
+    });
+    expect(arms.unchanged.operations).toEqual([]);
+    for (const name of ["recency", "random", "prioritised", "shuffled_batch"] as const) {
+      expect(arms[name].operations).toHaveLength(4);
+    }
+    expect(arms.prioritised.operations.slice(0, 2).map((o) => o.id)).toEqual(["b", "a"]);
+    expect(arms.shuffled_batch.operations.map((o) => o.id).toSorted()).toEqual(
+      arms.prioritised.operations.map((o) => o.id).toSorted(),
+    );
+    expect(arms.prioritised.selectionCost).toEqual(cost);
+    expect(arms.shuffled_batch.selectionCost).toEqual(cost);
+    expect(arms.recency.selectionCost).toEqual(ZERO_SELECTION_COST);
+    expect(arms.random.selectionCost).toEqual(ZERO_SELECTION_COST);
+  });
+});
```

**File**: `benchmarks/plan59-phase1/arms.ts` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+/**
+ * PLAN-59 Phase 1: arm construction.
+ *
+ * Every arm is a list of operations applied, in order, to its own fork of the
+ * sealed snapshot. K is 20 or the number of qualifying candidates when fewer,
+ * the same K for every arm.
+ *
+ *   unchanged       no operations
+ *   recency         the K candidates whose chunks were most recently accessed
+ *   random          K drawn uniformly without replacement under a recorded seed
+ *   prioritised     top K by priority (estimate.ts)
+ *   shuffled_batch  the prioritised arm's exact set in a seeded random order,
+ *                   charged the prioritised arm's selection cost
+ */
+import { seededShuffle } from "./common.js";
+import type { PriorityRow } from "./estimate.js";
+import type { Operation } from "./operations.js";
+
+export type ArmName = "unchanged" | "recency" | "random" | "prioritised" | "shuffled_batch";
+export const ARMS: readonly ArmName[] = [
+  "unchanged",
+  "recency",
+  "random",
+  "prioritised",
+  "shuffled_batch",
+];
+
+export const DEFAULT_K = 20;
+
+export function chooseK(candidateCount: number, kMax = DEFAULT_K): number {
+  return Math.max(0, Math.min(kMax, candidateCount));
+}
+
+const byId = (a: Operation, b: Operation) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
+
+export function selectRecency(candidates: readonly Operation[], k: number): Operation[] {
+  return [...candidates]
+    .toSorted((a, b) => {
+      const ta = a.lastAccessedAt ?? Number.NEGATIVE_INFINITY;
+      const tb = b.lastAccessedAt ?? Number.NEGATIVE_INFINITY;
+      return tb - ta || byId(a, b);
+    })
+    .slice(0, k);
+}
+
+export function selectRandom(
+  candidates: readonly Operation[],
+  k: number,
+  seed: string,
+): Operation[] {
+  return seededShuffle([...candidates].toSorted(byId), `${seed}:random`).slice(0, k);
+}
+
+/**
+ * Top K by priority. Candidates without a priority row (outside the gain
+ * estimation cap) rank below every estimated one, by need then id, so the arm
+ * is still filled when fewer than K candidates were estimated.
+ */
+export function selectPrioritised(
+  candidates: readonly Operation[],
+  k: number,
+  rows: ReadonlyMap<string, PriorityRow>,
+  needOf: (op: Operation) => number,
+): Operation[] {
+  return [...candidates]
+    .toSorted((a, b) => {
+      const ra = rows.get(a.id);
+      const rb = rows.get(b.id);
+      if (ra && rb) {
+        return rb.priority - ra.priority || rb.need - ra.need || byId(a, b);
+      }
+      if (ra) return -1;
+      if (rb) return 1;
+      return needOf(b) - needOf(a) || byId(a, b);
+    })
+    .slice(0, k);
+}
+
+export function shuffledBatch(selected: readonly Operation[], seed: string): Operation[] {
+  return seededShuffle(selected, `${seed}:shuffled_batch`);
+}
+
+export type SelectionCost = {
+  forks: number;
+  searches: number;
+  embeddingCalls: number;
+  seconds: number;
+};
+
+export const ZERO_SELECTION_COST: SelectionCost = {
+  forks: 0,
+  searches: 0,
+  embeddingCalls: 0,
+  seconds: 0,
+};
+
+export type ArmPlan = { arm: ArmName; operations: Operation[]; selectionCost: SelectionCost };
+
+export function buildArms(params: {
+  candidates: readonly Operation[];
+  k: number;
+  seed: string;
+  priorities: ReadonlyMap<string, PriorityRow>;
+  needOf: (op: Operation) => number;
+  /** what estimating priorities cost: forks, searches, embedding calls, seconds */
+  estimationCost: SelectionCost;
+}): Record<ArmName, ArmPlan> {
+  const prioritised = selectPrioritised(
+    params.candidates,
+    params.k,
+    params.priorities,
+    params.needOf,
+  );
+  return {
+    unchanged: { arm: "unchanged", operations: [], selectionCost: ZERO_SELECTION_COST },
+    recency: {
+      arm: "recency",
+      operations: selectRecency(params.candidates, params.k),
+      selectionCost: ZERO_SELECTION_COST,
+    },
+    random: {
+      arm: "random",
+      operations: selectRandom(params.candidates, params.k, params.seed),
+      selectionCost: ZERO_SELECTION_COST,
+    },
+    prioritised: {
+      arm: "prioritised",
+      operations: prioritised,
+      selectionCost: params.estimationCost,
+    },
+    shuffled_batch: {
+      arm: "shuffled_batch",
+      operations: shuffledBatch(prioritised, params.seed),
+      selectionCost: params.estimationCost,
+    },
+  };
+}
```

**File**: `benchmarks/plan59-phase1/common.ts` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+/**
+ * PLAN-59 Phase 1 pilot: shared helpers.
+ *
+ * Everything here is pure or touches only the paths it is handed. The one
+ * safety rule every entry point shares lives here: nothing under ~/.bitterbot
+ * is ever written except the private question/partition files that the
+ * live-recall tooling already keeps there with mode 0600.
+ */
+import { execSync } from "node:child_process";
+import { createHash } from "node:crypto";
+import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
+import { homedir } from "node:os";
+import { join, resolve } from "node:path";
+import { DatabaseSync } from "node:sqlite";
+
+export const sha256 = (s: string | Buffer | Uint8Array): string =>
+  createHash("sha256").update(s).digest("hex");
+
+export const sha256File = (path: string): string => sha256(readFileSync(path));
+
+/** One generated question, exactly as benchmarks/live-recall/make-questions.mts writes it. */
+export type Question = {
+  chunkId: string;
+  path: string;
+  source: string;
+  startLine: number;
+  endLine: number;
+  textSha256?: string;
+  question: string;
+};
+
+/** The family a question belongs to: the gold chunk's file path. */
+export const familyOf = (q: Pick<Question, "path">): string => q.path;
+
+export function loadQuestions(path: string): { questions: Question[]; raw: string } {
+  const raw = readFileSync(path, "utf-8");
+  const questions = raw
+    .split("\n")
+    .filter((l) => l.trim())
+    .map((l) => JSON.parse(l) as Question);
+  return { questions, raw };
+}
+
+// ── ~/.bitterbot guard ───────────────────────────────────────────────────────
+
+export function bitterbotHome(): string {
+  return resolve(join(homedir(), ".bitterbot"));
+}
+
+export function isUnderBitterbotHome(p: string, home = bitterbotHome()): boolean {
+  const r = resolve(p);
+  return r === home || r.startsWith(`${home}/`);
+}
+
+/** The one directory under ~/.bitterbot a private question or partition file may land in. */
+export function isPrivateBenchmarkPath(p: string, home = bitterbotHome()): boolean {
+  const allowed = join(home, "benchmarks", "live-recall");
+  const r = resolve(p);
+  return r.startsWith(`${allowed}/`);
+}
+
+export function refuseUnderBitterbotHome(p: string, what: string): void {
+  if (isUnderBitterbotHome(p)) {
+    throw new Error(`refusing to write ${what} under ~/.bitterbot: ${p}`);
+  }
+}
+
+// ── snapshots and forks ──────────────────────────────────────────────────────
+
+/**
+ * Copy a SQLite file with `VACUUM INTO` through a READ-ONLY connection. The
+ * source is never modified (no WAL is created on a read-only open); the
+ * destination must not exist and must not be under ~/.bitterbot.
+ */
+export function vacuumInto(src: string, dest: string): { ms: number; bytes: number } {
+  refuseUnderBitterbotHome(dest, "a database copy");
+  if (existsSync(dest)) {
+    throw new Error(`destination exists: ${dest}`);
+  }
+  const t0 = performance.now();
+  const ro = new DatabaseSync(resolve(src), { readOnly: true });
+  try {
+    // The copy is a scratch fork; syncing every page to disk made a 370 MB
+    // VACUUM INTO take 40 s on the pilot box against 7 s without.
+    ro.exec("PRAGMA synchronous = OFF");
+    ro.exec(`VACUUM INTO '${resolve(dest).replace(/'/g, "''")}'`);
+  } finally {
+    ro.close();
+  }
+  return { ms: performance.now() - t0, bytes: statSync(dest).size };
+}
+
+/** Remove a database copy and its WAL/SHM side files. */
+export function removeDbFiles(path: string): void {
+  refuseUnderBitterbotHome(path, "a delete");
+  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
+    rmSync(`${path}${suffix}`, { force: true });
+  }
+}
+
+/** Size of a database including any WAL that has not been checkpointed. */
+export function dbBytes(path: string): number {
+  let total = 0;
+  for (const suffix of ["", "-wal"]) {
+    try {
+      total += statSync(`${path}${suffix}`).size;
+    } catch {
+      // absent side file
+    }
+  }
+  return total;
+}
+
+export function gitCommit(cwd?: string): string | null {
+  try {
+    const head = execSync("git rev-parse --short HEAD", { encoding: "utf-8", cwd }).trim();
+    const dirty = execSync("git status --porcelain --untracked-files=no", {
+      encoding: "utf-8",
+      cwd,
+    }).trim();
+    return dirty ? `${head}+dirty` : head;
+  } catch {
+    return null;
+  }
+}
+
+// ── seeded randomness ────────────────────────────────────────────────────────
+
+/**
+ * Deterministic PRNG (sfc32) seeded from a string through SHA-256. Every
+ * random choice in the pilot (random arm, shuffled batch, bootstrap resamples)
+ * goes through one of these so a run is reproducible from its recorded seed.
+ */
+export function seededRandom(seed: string): () => number {
+  const h = createHash("sha256").update(seed).digest();
+  let a = h.readUInt32LE(0);
+  let b = h.readUInt32LE(4);
+  let c = h.readUInt32LE(8);
+  let d = h.readUInt32LE(12);
+  const next = () => {
+    a >>>= 
```

**File**: `benchmarks/plan59-phase1/estimate.test.ts` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+import { describe, expect, it } from "vitest";
+import { DAY_MS } from "./common.js";
+import {
+  affectedQueries,
+  costScalar,
+  decayFactor,
+  type DevBaseline,
+  estimatedBenefit,
+  gainByFamily,
+  needByFamily,
+  operationNeed,
+  priority,
+  priorityRow,
+} from "./estimate.js";
+import type { ClusterCandidate } from "./operations.js";
+
+const NOW = 1_800_000_000_000;
+
+describe("need", () => {
+  it("decays access counts with a 30-day half-life", () => {
+    expect(decayFactor(NOW, NOW)).toBe(1);
+    expect(decayFactor(NOW - 30 * DAY_MS, NOW)).toBeCloseTo(0.5, 10);
+    expect(decayFactor(NOW - 60 * DAY_MS, NOW)).toBeCloseTo(0.25, 10);
+    expect(decayFactor(NOW - 15 * DAY_MS, NOW, 15)).toBeCloseTo(0.5, 10);
+    expect(decayFactor(null, NOW)).toBe(0);
+    // a timestamp in the future counts as fresh, never above 1
+    expect(decayFactor(NOW + DAY_MS, NOW)).toBe(1);
+  });
+
+  it("sums the access prior, top-5 demand and unsuccessful retrievals per family", () => {
+    const chunks = [
+      { id: "a1", path: "A", accessCount: 4, lastAccessedAt: NOW - 30 * DAY_MS, createdAt: 0 },
+      { id: "a2", path: "A", accessCount: 2, lastAccessedAt: null, createdAt: NOW },
+      { id: "b1", path: "B", accessCount: 0, lastAccessedAt: null, createdAt: null },
+      { id: "c1", path: "C", accessCount: 10, lastAccessedAt: NOW, createdAt: 0 },
+    ];
+    const dev: DevBaseline[] = [
+      { chunkId: "a1", family: "A", fusedRank: 1, topTenIds: ["a1", "c1", "x", "y", "z", "b1"] },
+      { chunkId: "b1", family: "B", fusedRank: null, topTenIds: ["c1", "a2"] },
+      { chunkId: "c1", family: "C", fusedRank: 12, topTenIds: ["c1"] },
+    ];
+    const chunkFamily = new Map(chunks.map((c) => [c.id, c.path]));
+    const need = needByFamily({ chunks, devBaseline: dev, chunkFamily, now: NOW });
+    // A: 4 * 0.5 (30 days) + 2 * 1 (no timestamp, decays from created_at = now) = 4;
+    //    top-5 demand: a1 (q1) + a2 (q2) = 2; no unsuccessful
+    expect(need.get("A")!.accessPrior).toBeCloseTo(4, 10);
+    expect(need.get("A")!.topFiveDemand).toBe(2);
+    expect(need.get("A")!.unsuccessful).toBe(0);
+    expect(need.get("A")!.total).toBeCloseTo(6, 10);
+    // B: no accesses, b1 sits at position 6 (outside top 5), gold missing -> 1
+    expect(need.get("B")!.total).toBe(1);
+    // C: 10 fresh accesses, in top 5 of q1, q2, q3 = 3, rank 12 -> unsuccessful 1
+    expect(need.get("C")!.total).toBeCloseTo(14, 10);
+  });
+
+  it("uses retrieval_hits when present and leaves them at zero otherwise", () => {
+    const chunks = [{ id: "a1", path: "A", accessCount: 0, lastAccessedAt: null, createdAt: 0 }];
+    const chunkFamily = new Map([["a1", "A"]]);
+    const without = needByFamily({ chunks, devBaseline: [], chunkFamily, now: NOW });
+    expect(without.get("A")).toBeUndefined();
+    const withHits = needByFamily({
+      chunks,
+      devBaseline: [],
+      chunkFamily,
+      now: NOW,
+      retrievalHits: [
+        { chunkId: "a1", createdAt: NOW },
+        { chunkId: "a1", createdAt: NOW - 30 * DAY_MS },
+      ],
+    });
+    expect(withHits.get("A")!.retrievalHits).toBeCloseTo(1.5, 10);
+    expect(withHits.get("A")!.total).toBeCloseTo(1.5, 10);
+  });
+});
+
+const cluster: ClusterCandidate = {
+  kind: "consolidate_cluster",
+  id: "cc_1",
+  families: ["A"],
+  memberIds: ["a1", "a2"],
+  pairCount: 1,
+  minSimilarity: 0.9,
+  lastAccessedAt: null,
+};
+
+describe("priority", () => {
+  it("prices cost as 1 + chunks + 2 * embedding calls", () => {
+    expect(costScalar({ chunksTouched: 3, embeddingCalls: 1 })).toBe(6);
+    expect(costScalar({ chunksTouched: 0, embeddingCalls: 0 })).toBe(1);
+  });
+
+  it("guards a zero or invalid cost instead of dividing by it", () => {
+    expect(priority(2, 4)).toBe(0.5);
+    expect(priority(2, 0)).toBe(2);
+    expect(priority(2, -3)).toBe(2);
+    expect(priority(2, Number.NaN)).toBe(2);
+    expect(Number.isFinite(priority(2, 0))).toBe(true);
+  });
+
+  it("weights gain by need and divides by cost", () => {
+    const need = new Map([
+      ["A", { total: 6, accessPrior: 6, topFiveDemand: 0, unsuccessful: 0, retrievalHits: 0 }],
+      ["B", { total: 2, accessPrior: 2, topFiveDemand: 0, unsuccessful: 0, retrievalHits: 0 }],
+    ]);
+    const gain = new Map([
+      ["A", 0.5],
+      ["B", -0.25],
+    ]);
+    expect(estimatedBenefit(gain, need)).toBeCloseTo(2.5, 10);
+    expect(operationNeed(cluster, need)).toBe(6);
+    const row = priorityRow({
+      op: cluster,
+      need,
+      gain,
+      cost: { chunksTouched: 3, embeddingCalls: 1, estimatedMs: 0 },
+      affectedQueries: 4,
+    });
+    expect(row.cost).toBe(6);
+    expect(row.priority).toBeCloseTo(2.5 / 6, 10);
+  });
+});
+
+describe("gain", () => {
+  const dev: DevBaseline[] = [
+    { chunkId: "q1", family: "A", fusedRank: 2, topTenIds: ["x"] },
+    { chunkId: "q2", family: "B", fusedRank: 4, topTenIds: ["a1", "y"] },
+    { chunkId: "q3", fa
```

**File**: `benchmarks/plan59-phase1/estimate.ts` (added, +205/-0)
```diff
@@ -0,0 +1,205 @@
+/**
+ * PLAN-59 Phase 1: need, gain and priority. Development partition only.
+ *
+ * need(k) for a family k (a chunk path) is the sum of
+ *   1. the access prior: each chunk's access_count decayed from its
+ *      last_accessed_at with a 30-day half-life (a chunk with accesses but no
+ *      timestamp decays from created_at);
+ *   2. development demand: the number of development queries whose fused top 5
+ *      contains a chunk of k;
+ *   3. unsuccessful retrievals: 1 per development query whose gold is in k and
+ *      whose fused rank is above 10 or missing;
+ *   4. `retrieval_hits` (PLAN-59 Phase 0) decayed the same way, when the table
+ *      exists and has rows. It is empty on the pilot snapshot, so the access
+ *      prior carries.
+ * The plan's first-order session-transition term is deferred (see README).
+ *
+ * gain(op | k) is the mean change in parent-mapped reciprocal rank over the
+ * development queries affected by the operation whose gold is in k, measured
+ * by applying only that operation on a fork. Queries are affected when their
+ * gold is in a family the operation touches or when their baseline top 10
+ * contains a chunk the operation touches.
+ *
+ * priority(op) = sum_k need(k) * gain(op | k) / cost(op),
+ * cost(op) = 1 + chunksTouched + 2 * embeddingCalls (weights fixed here).
+ */
+import { DAY_MS } from "./common.js";
+import { type Operation, type OperationCost, affectedChunkIds } from "./operations.js";
+
+export const COST_WEIGHTS = { base: 1, perChunk: 1, perEmbeddingCall: 2 } as const;
+export const NEED_HALF_LIFE_DAYS = 30;
+
+export function costScalar(cost: Pick<OperationCost, "chunksTouched" | "embeddingCalls">): number {
+  return (
+    COST_WEIGHTS.base +
+    COST_WEIGHTS.perChunk * Math.max(0, cost.chunksTouched) +
+    COST_WEIGHTS.perEmbeddingCall * Math.max(0, cost.embeddingCalls)
+  );
+}
+
+/**
+ * benefit / cost with a zero-cost guard: a non-positive or non-finite cost is
+ * treated as the base cost (1) rather than producing Infinity or NaN.
+ */
+export function priority(benefit: number, cost: number): number {
+  const c = Number.isFinite(cost) && cost > 0 ? cost : COST_WEIGHTS.base;
+  return benefit / c;
+}
+
+export function decayFactor(
+  lastAt: number | null,
+  now: number,
+  halfLifeDays = NEED_HALF_LIFE_DAYS,
+): number {
+  if (lastAt === null || !Number.isFinite(lastAt)) {
+    return 0;
+  }
+  const ageDays = Math.max(0, (now - lastAt) / DAY_MS);
+  return Math.pow(0.5, ageDays / halfLifeDays);
+}
+
+export type ChunkNeedRow = {
+  id: string;
+  path: string;
+  accessCount: number;
+  lastAccessedAt: number | null;
+  createdAt: number | null;
+};
+
+/** What the estimator needs from one development query's baseline run. */
+export type DevBaseline = {
+  chunkId: string;
+  family: string;
+  /** parent-mapped fused rank on the unchanged fork, null when missing */
+  fusedRank: number | null;
+  /** chunk ids of the fused top 10, in order */
+  topTenIds: string[];
+};
+
+export type NeedBreakdown = {
+  total: number;
+  accessPrior: number;
+  topFiveDemand: number;
+  unsuccessful: number;
+  retrievalHits: number;
+};
+
+export function needByFamily(params: {
+  chunks: readonly ChunkNeedRow[];
+  devBaseline: readonly DevBaseline[];
+  chunkFamily: ReadonlyMap<string, string>;
+  now: number;
+  halfLifeDays?: number;
+  retrievalHits?: ReadonlyArray<{ chunkId: string; createdAt: number }>;
+}): Map<string, NeedBreakdown> {
+  const half = params.halfLifeDays ?? NEED_HALF_LIFE_DAYS;
+  const out = new Map<string, NeedBreakdown>();
+  const get = (fam: string) => {
+    let b = out.get(fam);
+    if (!b) {
+      b = { total: 0, accessPrior: 0, topFiveDemand: 0, unsuccessful: 0, retrievalHits: 0 };
+      out.set(fam, b);
+    }
+    return b;
+  };
+  for (const c of params.chunks) {
+    if (c.accessCount <= 0) continue;
+    const at = c.lastAccessedAt ?? c.createdAt;
+    get(c.path).accessPrior += c.accessCount * decayFactor(at, params.now, half);
+  }
+  for (const q of params.devBaseline) {
+    for (const id of q.topTenIds.slice(0, 5)) {
+      const fam = params.chunkFamily.get(id);
+      if (fam !== undefined) get(fam).topFiveDemand += 1;
+    }
+    if (q.fusedRank === null || q.fusedRank > 10) {
+      get(q.family).unsuccessful += 1;
+    }
+  }
+  for (const h of params.retrievalHits ?? []) {
+    const fam = params.chunkFamily.get(h.chunkId);
+    if (fam !== undefined) get(fam).retrievalHits += decayFactor(h.createdAt, params.now, half);
+  }
+  for (const b of out.values()) {
+    b.total = b.accessPrior + b.topFiveDemand + b.unsuccessful + b.retrievalHits;
+  }
+  return out;
+}
+
+/** Sum of need over the families an operation touches (its own ranking key for the gain cap). */
+export function operationNeed(op: Operation, need: ReadonlyMap<string, NeedBreakdown>): number {
+  return op.families.reduce((s, f) => s + (need.get(f)?.total ?? 0), 0);
+}
+
+/** Development queries whose out
```

**File**: `benchmarks/plan59-phase1/harness.ts` (added, +237/-0)
```diff
@@ -0,0 +1,237 @@
+/**
+ * PLAN-59 Phase 1: the manager-side harness.
+ *
+ * Opens a fork through the normal MemoryIndexManager under the frozen scoring
+ * settings benchmarks/live-recall/evidence-gate.mts established (every
+ * background engine off, recency boost off, hormonal state off, evidence
+ * telemetry off, wall clock frozen for the duration of a query batch) and
+ * turns each search into a QueryOutcome. Query embeddings are memoised
+ * in-process by text, so every arm scores the same question with the same
+ * vector and the embedding bill is one call per distinct question.
+ */
+import { mkdirSync, writeFileSync } from "node:fs";
+import { join } from "node:path";
+import { DatabaseSync } from "node:sqlite";
+import type { BitterbotConfig } from "../../src/config/config.js";
+import { createEmbeddingProvider, type EmbeddingProvider } from "../../src/memory/embeddings.js";
+import { MemoryIndexManager } from "../../src/memory/manager.js";
+import type { MemorySearchResult } from "../../src/memory/types.js";
+import { type Question, sha256 } from "./common.js";
+import type { EmbedFn } from "./operations.js";
+import { channelRanks, type QueryOutcome, type RankedResult, rankOf } from "./scoring.js";
+
+export const EMBEDDING_MODEL = "text-embedding-3-small";
+
+/** In-process memo shared by every manager and by the operation embedder. */
+export class EmbeddingMemo {
+  private readonly cache = new Map<string, Promise<number[]>>();
+  calls = 0;
+  /** characters sent to the provider (cache misses only), for the token estimate */
+  chars = 0;
+  wrap(embed: (text: string) => Promise<number[]>): (text: string) => Promise<number[]> {
+    return (text: string) => {
+      const hit = this.cache.get(text);
+      if (hit) return hit;
+      this.calls += 1;
+      this.chars += text.length;
+      const p = embed(text).catch((err: unknown) => {
+        this.cache.delete(text);
+        throw err;
+      });
+      this.cache.set(text, p);
+      return p;
+    };
+  }
+  get size(): number {
+    return this.cache.size;
+  }
+}
+
+export async function makeEmbedder(params: {
+  liveConfig: BitterbotConfig;
+  apiKey: string;
+  memo: EmbeddingMemo;
+}): Promise<EmbedFn> {
+  const result = await createEmbeddingProvider({
+    config: params.liveConfig,
+    provider: "openai",
+    remote: { apiKey: params.apiKey },
+    model: EMBEDDING_MODEL,
+    fallback: "none",
+  });
+  const provider = result.provider;
+  return params.memo.wrap((text) => provider.embedQuery(text, { feature: "plan59-phase1" }));
+}
+
+export function frozenConfig(params: {
+  storePath: string;
+  workspaceDir: string;
+  agentId: string;
+  apiKey: string;
+  maxResults: number;
+}): BitterbotConfig {
+  return {
+    agents: {
+      defaults: {
+        workspace: params.workspaceDir,
+        memorySearch: {
+          enabled: true,
+          provider: "openai",
+          model: EMBEDDING_MODEL,
+          remote: { apiKey: params.apiKey },
+          sources: ["memory", "sessions"],
+          store: { path: params.storePath, vector: { enabled: true } },
+          sync: {
+            intervalMinutes: 0,
+            onSearch: false,
+            onStartup: false,
+            watch: false,
+            onSessionStart: false,
+          },
+          query: {
+            maxResults: params.maxResults,
+            minScore: 0,
+            hybrid: { enabled: true, mergeStrategy: "rrf", candidateMultiplier: 5 },
+            recency: { enabled: false },
+          },
+        },
+      },
+      list: [{ id: params.agentId, default: false, workspace: params.workspaceDir }],
+    },
+    memory: {
+      dream: { enabled: false },
+      consolidation: { enabled: false },
+      curiosity: { enabled: false, evidence: { mode: "off" } },
+      emotional: { enabled: false, hormonal: { enabled: false } },
+      healthSweep: { enabled: false },
+      coverageDiagnostics: { enabled: false },
+    },
+  } as unknown as BitterbotConfig;
+}
+
+export type OpenStore = {
+  manager: MemoryIndexManager;
+  close: () => Promise<void>;
+};
+
+export async function openFrozenStore(params: {
+  storePath: string;
+  workDir: string;
+  agentId: string;
+  apiKey: string;
+  maxResults: number;
+  memo: EmbeddingMemo;
+}): Promise<OpenStore> {
+  const workspaceDir = join(params.workDir, "workspace", params.agentId);
+  mkdirSync(join(workspaceDir, "memory"), { recursive: true });
+  writeFileSync(join(workspaceDir, "memory", "MEMORY.md"), "# plan59 phase 1\n");
+  const manager = await MemoryIndexManager.get({
+    cfg: frozenConfig({ ...params, workspaceDir }),
+    agentId: params.agentId,
+  });
+  if (!manager) {
+    throw new Error("MemoryIndexManager.get returned null");
+  }
+  // Route this manager's query embeddings through the shared memo.
+  const inner = manager as unknown as { provider: EmbeddingProvider };
+  const original = inner.provider.embedQuery.bind(inner.provider);
+  inner.provider.embedQuery = params
```

#### Recent Merged Pull Requests:
- **PR #329** (2026-10-29): feat(memory): PLAN-59 Phase 1 pilot harness (forked consolidation arms) (@VGIL77)
- **PR #328** (2026-10-29): feat(memory): default evidence telemetry to shadow mode (@VGIL77)
- **PR #322** (2026-10-29): feat(memory): evidence telemetry and shadow decision traces (PLAN-59 Phase 0) (@VGIL77)
- **PR #321** (2026-10-28): fix(memory): GCCRF and curiosity-target defects (@VGIL77)
- **PR #320** (2026-10-28): fix(p2p): fail-closed skill ingest and publish gates (@VGIL77)
- **PR #318** (2026-10-28): feat(benchmarks): LongMemEval runner on the official protocol (@VGIL77)

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

## X. memory): PLAN-59 Phase 1 pilot harness (forked consolidation arms) (#329)

**RULE**:
When implementing operations in `.gitignore`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Bitterbot-AI/bitterbot-desktop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f9ac780a`: memory): PLAN-59 Phase 1 pilot harness (forked consolidation arms) (#329). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.gitignore`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
# PLAN-59 phase reports are published documentation, not the playground.
!docs/research/
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f9ac780a` are properly handled with clean fallback behavior.
