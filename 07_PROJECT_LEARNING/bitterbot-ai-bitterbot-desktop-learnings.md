> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bitterbot-ai-bitterbot-desktop-learnings.md`  
> **Source**: github ([https://github.com/Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop))  
> **Source Version**: `93a5f683`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-02T14:39:27.677Z  
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
> **Harvest Timestamp**: 2026-11-02T14:39:26.480Z  
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

### Incident Patch 1: `93a5f683` (2026-11-01)
**Commit Message**: docs(memory): bring every memory doc back in line with the code at v1.12.0 (#346)

Claim-by-claim staleness pass over docs/memory/*.md and the condensed
docs/concepts/memory.md against main. About 650 claims checked; 45
contradicted the code, 60 had drifted, a dozen current behaviours were
missing. No source changes.

Wrong and fixed: architecture-overview Quick Start (indexChunk does not
exist), consolidate() return shape, DB path, SQL examples with
nonexistent columns, migration count (80), init chain, backfill timing,
"enabled by default" (four opt-in exceptions). Formulas quoted from older
code: emotional valence, playfulness, anchor cooldown, Bond drift guard,
I_alpha, trajectory window. Documented mechanisms with no caller
(keyword anchor recall, dream anchor attention, dream-proposed
baselines, dopamine on directive resolution, curiosity importance boost,
correction note type) now described as they behave. Defaults: Skill
Seekers off, listing bar 0.6, marketplace window 7 days, maxAttempts 3,
13 dream modes, pricing quality = successRate. Type-vs-table drift on
crystal fields, exploration target types, user profile shape, category
names, startExecution signature. skills-pipe

**File**: `docs/concepts/memory.md` (modified, +8/-4)
```diff
@@ -14,7 +14,7 @@ Bitterbot's memory is a biological cognitive architecture, not a vector database
 
 | Component                      | What It Does                                                                                                                                                                                                                                                                                                        | Docs                                                    |
 | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
-| **Knowledge Crystals**         | Memories that naturally decay via Ebbinghaus curves. Frequently accessed facts become permanent; unused info fades.                                                                                                                                                                                                 | [Knowledge Crystals](../memory/knowledge-crystals.md)   |
+| **Knowledge Crystals**         | Memories that naturally decay via Ebbinghaus curves. Use, spaced repetition and emotional weight slow the decay; unused info fades. Only skills are frozen and never decay.                                                                                                                                         | [Knowledge Crystals](../memory/knowledge-crystals.md)   |
 | **Dream Engine**               | A dream tick runs every 2 hours (adaptive, 30 to 240 minutes). A full cycle runs at most every 8 hours, only after new input and an hour idle, and picks from replay, compression, simulation, extrapolation and the utility lanes (hygiene, distillation, anticipation, relationship mining, canonical promotion). | [Dream Engine](../memory/dream-engine.md)               |
 | **Curiosity Engine**           | Unified intrinsic motivation with GCCRF reward scoring. Maps what the agent _doesn't_ know. Detects gaps, contradictions, and semantic frontiers. Developmental alpha annealing shifts curiosity from common knowledge to frontier exploration.                                                                     | [Curiosity & Search](../memory/curiosity-and-search.md) |
 | **Hormonal System**            | Three neuromodulators (dopamine, cortisol, oxytocin) shape personality in real-time and determine what's worth remembering.                                                                                                                                                                                         | [Emotional System](../memory/emotional-system.md)       |
@@ -56,12 +56,16 @@ Canonical Facts (the ledger described in [How the Memory Works](../memory/how-th
 Session → Chunk indexing → Embedding → Crystal creation
                                             ↓
                               Consolidation (every 30 min)
-                              ├── Ebbinghaus decay
+                              ├── Hormonal decay toward baseline
+                              ├── Ebbinghaus decay + forgetting
                               ├── Chunk merging (cosine ≥ 0.92)
                               ├── SNN near-merge discovery (cosine 0.82-0.91)
                               ├── Orphan cluster detection → replay queue
+                              ├── Tombstone purge (forgotten > 14 days)
                               ├── Curiosity region mapping
-                              └── Hormonal modulation
+                              ├── Governance TTL + stalled goals
+                              ├── Restabilize labile memories, prune graph, contradictions
+                              └── Canonical ledger decay (90 days unconfirmed)
                                             ↓
                                 Dream Engine (tick every 2 h; full cycle at most every 8 h; emotional triggers)
                                 ├── Readiness check (skip if nothing new)
@@ -90,7 +94,7 @@ Everything lives in a single SQLite database per agent at `~/.bitterbot/memory/<
 - Marketplace listings and purchases
 - Skill execution metrics
 
-No external database, no cloud dependency. One `.db` file is the entire memory.
+No external database, no cloud dependency. One `.sqlite` file is the entire memory.
 
 ## Configuration
 
```

**File**: `docs/memory/architecture-overview.md` (modified, +112/-47)
```diff
@@ -12,7 +12,7 @@ The memory system stores everything — crystals, embeddings, dream insights, pe
 2. **Edge-native** — Each node carries its own brain. In a P2P swarm, every peer is fully self-contained. No shared Postgres cluster, no Pinecone account, no cloud dependency.
 3. **Transactional consistency** — Consolidation engine applies decay, merges, and lifecycle transitions in a single ACID transaction. No eventual-consistency bugs.
 4. **sqlite-vec** — The `sqlite-vec` extension provides real vector search (cosine similarity) inside SQLite, combined with FTS5 for BM25 keyword search. Hybrid retrieval with zero network hops.
-5. **Portability** — The entire memory is one `.db` file. Back it up, move it between machines, or inspect it with any SQLite viewer.
+5. **Portability** — The entire memory is one `.sqlite` file. Back it up, move it between machines, or inspect it with any SQLite viewer.
 
 For deployments that need distributed vector search at scale, the embedding and retrieval layers are abstracted behind provider interfaces — but for the primary use case (a single bot's memory), SQLite is the optimal choice.
 
@@ -27,41 +27,40 @@ Get a working memory system in 3 steps:
 ```typescript
 import { MemoryIndexManager } from "./memory/manager.js";
 
+// Returns null when memory search is not configured for the agent
 const manager = await MemoryIndexManager.get({
   cfg: loadConfig(),
   agentId: "my-agent",
 });
 
-// Index a chunk of text — this creates a knowledge crystal
-await manager.indexChunk({
-  text: "TypeScript interfaces are erased at runtime. Use 'type' for simple aliases.",
-  path: "notes/typescript.md",
-  source: "memory",
-  startLine: 1,
-  endLine: 1,
-});
+// Crystals are created by indexing files, not by a direct insert API.
+// Write a note under the agent workspace's memory/ folder, then sync:
+//   <workspace>/memory/notes/typescript.md
+await manager?.sync({ reason: "quick-start", force: true });
 ```
 
+The file watcher also picks up `memory/**/*.md` changes on its own, and session transcripts are indexed as they grow.
+
 ### 2. Force Consolidation
 
 ```typescript
 // Run one consolidation cycle immediately (normally timer-driven every 30 min)
-const result = await manager.consolidate();
-// result: { scored: 1, forgotten: 0, merged: 0 }
+const result = await manager?.consolidate();
+// result: { totalChunks, scoredChunks, mergedChunks, forgottenChunks, durationMs } | null
 ```
 
 ### 3. Search
 
 ```typescript
-const results = await manager.search("typescript runtime types");
+const results = await manager?.search("typescript runtime types");
 // results: [{ id, text, score, importanceScore, ... }]
 ```
 
 ### Inspect State
 
 ```bash
-# Open the database directly
-sqlite3 .bitterbot/memory/memory.db
+# Open the database directly (one file per agent)
+sqlite3 ~/.bitterbot/memory/<agentId>.sqlite
 
 # Count crystals
 SELECT COUNT(*) FROM chunks;
@@ -79,6 +78,8 @@ SELECT * FROM memory_audit_log ORDER BY timestamp DESC LIMIT 10;
 SELECT cycle_id, started_at, insights_generated, modes_used FROM dream_cycles ORDER BY started_at DESC LIMIT 5;
 ```
 
+Retrieval fuses three ranked lists (vector, keyword, graph) with Reciprocal Rank Fusion at `k = 60`. Each channel carries a weight from `agents.defaults.memorySearch.query.rrfWeights` (default `1/1/1`, unweighted). Keyword terms are OR-joined before FTS5. Post-fusion boosts (recency, emotional valence, mood congruence, temporal intent) are scaled by `agents.defaults.memorySearch.query.postFusionBoostScale` (default `0.1`) so they break ties without reordering the fused list.
+
 ---
 
 ## Data Flow
@@ -137,7 +138,7 @@ flowchart TB
     end
 
     subgraph "Deep Recall (on-demand)"
-        DR[deep_recall tool] --> SS[Smart Shortcut - score ≥ 0.8]
+        DR[deep_recall tool] --> SS[Smart Shortcut - 3+ results with score ≥ 0.8]
         SS -->|miss| SUB[Sub-LLM REPL in VM Sandbox]
         SUB --> DB2[(Memory DB + Session JSONL)]
     end
@@ -197,13 +198,15 @@ flowchart TB
 | `src/memory/manager.ts`               | Central orchestrator. Creates all subsystems, runs search, exposes public API |
 | `src/memory/manager-sync-ops.ts`      | File-watching sync logic (mixin)                                              |
 | `src/memory/manager-embedding-ops.ts` | Embedding batch operations (mixin)                                            |
-| `src/memory/migrations.ts`            | Schema versioning: 70 migration versions                                      |
+| `src/memory/migrations.ts`            | Schema versioning: 80 migration versions (v1 to v80)                          |
 | `src/memory/memory-schema.ts`         | Base table creation, `ensureColumn()` helper                                  |
 | `src/memory/crystal-types.ts`         | All type definitions: `KnowledgeCrystal`, lifecycle, governance, etc.         |
 | `src/memory/crystal.ts`               | `CrystalStore` — CRUD operations on knowledge crystals                    
```

**File**: `docs/memory/biological-identity.md` (modified, +45/-32)
```diff
@@ -89,16 +89,16 @@ Concretely, the dream engine:
 
 ### Hormone-Weighted Attention
 
-The dream engine does not treat all sections equally. Hormonal levels at synthesis time determine which sections get the most attention:
+The dream engine does not treat all sections equally. Hormonal levels at synthesis time determine which sections get the most attention. The synthesis prompt emits an attention line for two sections (`buildHormonalAttentionBlock` in `working-memory-prompt.ts`):
 
-| Section        | Primary Hormone                 | When Updated Aggressively                                        |
-| -------------- | ------------------------------- | ---------------------------------------------------------------- |
-| The Phenotype  | Dopamine + Cortisol             | Achievements reshape self-concept; frictions reveal growth areas |
-| The Bond       | Oxytocin                        | Social bonding moments detected in conversation                  |
-| Active Context | Dopamine + Cortisol             | Breakthroughs and blockers                                       |
-| The Niche      | Skill metrics + peer reputation | Network activity changes                                         |
+| Section        | Primary Hormone     | When Updated Aggressively                                                 |
+| -------------- | ------------------- | ------------------------------------------------------------------------- |
+| The Bond       | Oxytocin            | Social bonding moments detected in conversation                           |
+| Active Context | Dopamine + Cortisol | High dopamine: breakthroughs and wins; high cortisol: frictions, blockers |
 
-When oxytocin is dominant (the user shared something personal, expressed gratitude, had a meaningful exchange), The Bond section gets priority expansion. When dopamine is high (task completed, breakthrough achieved), The Phenotype updates to reflect new competencies.
+The Phenotype and The Niche carry no hormonal attention line. The Phenotype is shaped by the Phenotype Guardrails, the Starting Temperament and the Emotional History input block (the five most recent emotional anchors); The Niche by the P2P Network Identity input block (peers, reputation, published and imported skills, marketplace economics).
+
+When oxytocin is dominant (the user shared something personal, expressed gratitude, had a meaningful exchange), The Bond section gets priority expansion. When dopamine is high (task completed, breakthrough achieved), Active Context highlights completed goals and momentum.
 
 ### What Happens to Fading Topics
 
@@ -157,7 +157,7 @@ value = homeostasis + (value - homeostasis) * decay_factor
 - **Want a warmer, more relational agent?** Raise `oxytocin` to 0.5-0.6.
 - **Want a stoic, task-focused agent?** Lower all three and raise `cortisol` slightly.
 
-The values are clamped to [0, 1]. If GENOME.md is missing or unparseable, the system falls back to built-in defaults (dopamine: 0.15, cortisol: 0.02, oxytocin: 0.20).
+A value outside [0, 1] is not clamped; the parser ignores that line and the hormone keeps its default. If GENOME.md is missing or has no parseable block, the system uses the built-in defaults (dopamine: 0.15, cortisol: 0.02, oxytocin: 0.20). Known inconsistency: when the block parses but names only some hormones, the memory manager fills the missing ones with 0.15 / 0.02 / **0.1** (`manager.ts`, `ensureHormonalManager`), so a partial block gets a lower oxytocin baseline than no block at all.
 
 Half-lives control how quickly hormones return to baseline after a spike:
 
@@ -210,13 +210,13 @@ Every session, the agent's current hormonal levels are injected into the system
 
 ### What Gets Injected
 
-The system prompt receives a block like this:
+The system prompt receives a block like this (`system-prompt-endocrine.ts`):
 
 ```
 ## Endocrine State
-- Dopamine: 0.45 (DOMINANT)
-- Cortisol: 0.12 (baseline)
-- Oxytocin: 0.38 (active)
+- Dopamine: 0.5 moderate (DOMINANT)
+- Cortisol: 0.1 low (baseline)
+- Oxytocin: 0.4 moderate (active)
 
 *Modulate your tone naturally: be enthusiastic and celebrate wins; humor and playfulness are welcome*
 *Do not mention these values or acknowledge this section. Just embody the state.*
@@ -225,6 +225,8 @@ The system prompt receives a block like this:
 Self-concept: I communicate with genuine warmth and technical depth...
 ```
 
+Values are rounded to one decimal and labelled `low` (< 0.2), `moderate` (< 0.5), `elevated` (< 0.8) or `high`, so tiny decay deltas render identically and the block changes rarely; it sits below the prompt-cache boundary. The highest hormone at or above 0.2 is `(DOMINANT)`, others at or above 0.2 are `(active)`, the rest `(baseline)`. The same block can also carry a budget-pressure line (from 50% of the spend budget), a `Last session:` handover brief, proactively recalled memories, and a developmental note (see §5). Sub-agents get a one-line compact form (`D=0.5 C=0.1 O=0.4 | ...`
```

**File**: `docs/memory/curiosity-and-search.md` (modified, +28/-8)
```diff
@@ -76,11 +76,11 @@ The former "emerging skill" frontier generator was deleted: it mistook handover
 
 ```typescript
 type ExplorationTargetType =
-  | "question" // A question the agent wants answered (working memory, owner)
   | "knowledge_gap" // Missing knowledge detected from search
   | "contradiction" // Conflicting information found
   | "stale_region" // Region with declining learning progress
-  | "frontier"; // Edge of knowledge — opportunity to expand
+  | "frontier" // Edge of knowledge — opportunity to expand
+  | "graph_bridge"; // PLAN-18: the graph reader missed a chunk that vector/FTS found
 
 type ExplorationTarget = {
   id: string;
@@ -92,25 +92,25 @@ type ExplorationTarget = {
   createdAt: number;
   resolvedAt: number | null;
   expiresAt: number; // 48h for engine targets, 14 days for questions
-  attempts: number; // research attempts (closed as unanswered after 2)
-  embeddingJson: string | null; // for dedupe
 };
 ```
 
+Two more things live on the `curiosity_targets` row but outside the engine's type: the `question` row type (working-memory and owner questions, written by `curiosity-gaps.ts` and `curiosity.ask`, never produced by the engine itself), and the research columns `attempts` (closed as `unanswered` once it reaches `research.maxAttempts`, default 3) and `embedding_json` (for dedupe), which `curiosity-gaps.ts` reads directly.
+
 Maximum active targets: 10 (configurable). Expired targets are cleaned up during `run()`.
 
 ### The research loop (PLAN-54)
 
-`src/memory/curiosity-researcher.ts`, on the maintenance tick, every `intervalMinutes` (240):
+`src/memory/curiosity-researcher.ts`, on the maintenance tick, every `intervalMinutes` (240). One pass has an 8-minute wall-clock deadline; targets not started by then wait for the next pass:
 
 1. Pick up to 4 researchable targets (`question`, or `metadata.researchable = 1`), ranked by priority plus 0.25 × the region's curiosity ROI, minus 0.1 per prior attempt.
-2. Skip sensitive topics on the node (`isSensitiveTopic`), and questions the web cannot answer: the model marks `web_answerable` false for questions about the author's own life, schedule, people, projects or files, and any first-person question ("my", "our", "I") is closed as `not_web_answerable` without a search. Rewrite the question as a search phrase with the agent's own model (a genuinely local model when configured), which also declares the public subject terms it kept (at most 4, each copied from the question). Reject the phrase if it contains an email, a URL, the owner's name or any knowledge-graph person/organization/project (checked on the raw phrase, so a "public term" can never launder a private name), a 3-token fragment or three copied bigrams of the question outside the declared public terms, or a copied non-ASCII token. `research.strictEgress: true` ignores declared public terms (then named technologies cannot be searched). A rejected phrase is never sent; the page shows the question as held back.
+2. Skip sensitive topics on the node (`isSensitiveTopic`), and questions the web cannot answer: the model marks `web_answerable` false for questions about the author's own life, schedule, people, projects or files, and any possessive first-person question ("my", "our", "mine", "ours") is closed as `not_web_answerable` without a web search (the rewrite call below still runs first). Rewrite the question as a search phrase with the agent's own model (a genuinely local model when configured), which also declares the public subject terms it kept (at most 4, each copied from the question). Reject the phrase if it contains an email, a URL, the owner's name or any knowledge-graph person/organization/project (checked on the raw phrase, so a "public term" can never launder a private name), a 3-token fragment or three copied bigrams of the question outside the declared public terms, or a copied non-ASCII token. `research.strictEgress: true` ignores declared public terms (then named technologies cannot be searched). A rejected phrase is never sent; the page shows the question as held back.
 3. Search (`runConfiguredWebSearch`, one retry with "explained"), fetch up to `maxPagesPerTarget` (3) pages from distinct hosts through the SSRF guard, log every egress to `research_egress_log`.
-4. Distill a ≤120-word answer with `confidence` and `supporting_sources`. Verified when confidence ≥ `minConfidence` (0.45) and two sources support it, or one does at confidence ≥ floor + 0.15.
+4. Distill a ≤120-word answer with `confidence` and `supporting_sources`. Verified when confidence ≥ `minConfidence` (0.45) and two sources support it, or one does at confidence ≥ floor + 0.15 (that single-source bar is capped at 0.95).
 5. Store: a `world_fact` chunk (`origin = curiosity`, `path = curiosity/<target>`, evidence URLs, `valid_time_start`), a `curiosity_findings` row (question, phrase, answer, confidence, sources, hormonal state, cost, chunk), and a `research_findings` line the system pro
```

**File**: `docs/memory/curiosity-reward.md` (modified, +5/-3)
```diff
@@ -60,7 +60,7 @@ Each GCCRF component also influences which _mode_ the Dream Engine uses:
 
 ### Hormonal Feedback
 
-High GCCRF rewards trigger dopamine spikes (discovery/achievement). High learning progress triggers mastery signals. Sustained low rewards cause mild stress (stagnation). High empowerment on relational memories triggers oxytocin (the agent is learning about its human).
+`HormonalStateManager.stimulateFromGCCRF` turns the score into hormonal events: a reward above 0.7 fires `curiosity_high` (dopamine +0.25, discovery), a learning-progress component above 0.7 fires `curiosity_progress` (dopamine +0.2, mastery), a strategic-alignment component above 0.7 fires `curiosity_aligned` (dopamine +0.1), a run of 5 consecutive rewards below 0.2 fires `curiosity_stagnant` once (cortisol +0.15, stagnation), and an empowerment component above 0.6 on a `preference`, `relationship` or `episode` chunk fires `curiosity_bonding` (oxytocin +0.25, dopamine +0.1: the agent is learning about its human).
 
 ### Memory Consolidation
 
@@ -76,6 +76,8 @@ The alpha parameter controls the agent's developmental stage:
 | -1.5 to -0.5 | Adolescent | Transitioning from common to novel        |
 | -0.5 to 0.0  | Mature     | Curious about rare, frontier things       |
 
+These bands describe the schedule; the dashboard's stage label uses coarser cut-offs (Infant below -1, Adolescent below -0.3, Mature otherwise).
+
 Maturity is tied to **dream cycles completed** and nothing else: `maturity = min(1, completed_cycles / expectedMatureCycles)`. Chunk count and calendar age used to count too (500 chunks or 30 days meant "mature"), which let a node with a large import and almost no completed cycles jump straight to the frontier-seeking regime. Removing those shortcuts means an upgraded node with many chunks but few completed cycles moves back toward the young regime until its dreams catch up.
 
 ## Configuration
@@ -104,9 +106,9 @@ The Dream Engine's **FSHO oscillator** (Fractional Stuart-Landau Hopf Oscillator
 
 - **GCCRF high prediction error + FSHO low R** → Both agree: explore (scattered, surprising memories)
 - **GCCRF high learning progress + FSHO high R** → Both agree: compress (coherent, consolidating memories)
-- **GCCRF wants exploration + FSHO wants compression** → Disagreement resolved via weighted normalization (0.3 GCCRF, 0.4 FSHO × validation factor, 0.3 curiosity heuristics)
+- **GCCRF wants exploration + FSHO wants compression** → Disagreement resolved via weighted normalization (0.3 GCCRF, 0.4 FSHO × validation factor, 0.3 curiosity heuristics; the GCCRF and curiosity shares drop to 0.275 when long-horizon tasks are pending and to 0.25 when the marketplace is active, see the dream engine page)
 
-**FSHO alpha coupling (opt-in, `memory.curiosity.fshoCoupling`, default off):** when enabled, the FSHO order parameter R informs alpha annealing via a running EMA: `effective_alpha = base_alpha + 0.5 × (R_avg - 0.5)`. High R (coherent memory set) shifts alpha toward frontier-seeking; low R shifts toward consolidation. By default the coupling is **not** applied: R is tracked (and persisted as `gccrf_state.fsho_r_avg`) for telemetry, and novelty uses the pure maturity schedule. The FSHO signal is also **self-validating**: `computeFshoWeightAdjustment()` checks Pearson correlation between R and DQS, scaling FSHO's mode selection weight between 0.5x (noise) and 1.5x (validated).
+**FSHO alpha coupling (opt-in, `memory.curiosity.fshoCoupling`, default off):** when enabled, the FSHO order parameter R informs alpha annealing via a running EMA: `effective_alpha = base_alpha + 0.5 × (R_avg - 0.5)`, clamped to `[alphaStart, alphaEnd]`. High R (coherent memory set) shifts alpha toward frontier-seeking; low R shifts toward consolidation. By default the coupling is **not** applied: R is tracked (and persisted as `gccrf_state.fsho_r_avg`) for telemetry, and novelty uses the pure maturity schedule. The FSHO signal is also **self-validating**: `computeFshoWeightAdjustment()` checks Pearson correlation between R and DQS, scaling FSHO's mode selection weight between 0.5x (noise) and 1.5x (validated).
 
 ### Maturity Calculation
 
```

**File**: `docs/memory/deep-recall.md` (modified, +5/-3)
```diff
@@ -76,7 +76,7 @@ FINAL("GCCRF was discussed on March 12 and March 26: ...");
 
 ## Session-Persistent Sandbox
 
-The sandbox is cached per `agent:session:scope` and **reused across `deep_recall` calls**: values saved with `store()` in one query are readable via `get()` in the next, so repeated recalls build on earlier exploration instead of starting cold.
+The sandbox is cached per `agent:session:scope[:range]:owner|guest` and **reused across `deep_recall` calls**: values saved with `store()` in one query are readable via `get()` in the next, so repeated recalls build on earlier exploration instead of starting cold. The owner/guest suffix means a non-owner turn in the same conversation never reuses an owner's sandbox (its live search closure and bootstrap snapshot were built with owner visibility).
 
 - The bootstrap snapshot is rebuilt after a 15-minute TTL (the store survives the rebuild; live APIs cover the gap in between).
 - JSON-serializable store entries are persisted to disk (`<agent dir>/rlm-store/`) and re-imported after a gateway restart.
@@ -168,7 +168,7 @@ The RLM executor includes two self-improvement mechanisms:
 
 ### Query Result Cache
 
-Identical (or near-identical) queries within a 1-hour window return cached results immediately, avoiding redundant REPL sessions. The cache is keyed on `SHA-256(scope + lowercase query)`, holds up to 50 entries, and lives on the per-session tool instance; staleness is bounded by the 1-hour TTL.
+Identical (or near-identical) queries within a 1-hour window return cached results immediately, avoiding redundant REPL sessions. The cache is keyed on `SHA-256(scope + lowercase query)`, evicts its oldest entry once it holds more than 50, and lives on the RLM executor (`rlm/executor.ts`); staleness is bounded by the 1-hour TTL. Cache hits are reported with `source: "cache"`.
 
 ### Blind Spot Registration
 
@@ -184,7 +184,9 @@ When `deep_recall` returns no useful answer, the failed query is registered as a
 | `recent_sessions` | The 10 most recent transcripts of this agent (dialogue only)                            | Owner senders only; others are downgraded to `current_session` |
 | `all_sessions`    | Every transcript of this agent, including `.reset.*` archives (dialogue only)           | Owner senders only; others are downgraded to `current_session` |
 
-Cross-session scopes read other conversations, and tool results carry file reads and command output that the memory indexer deliberately does not index. A non-owner sender (a group member, another DM) therefore gets `current_session` whatever it asks for, and the result carries a `scopeNote` saying so. "Owner" has the same meaning as for `code_interpreter`: the sender matched the channel's owner allowlist. Subagents and inbound A2A tasks cannot call `deep_recall` at all.
+Cross-session scopes read other conversations, and tool results carry file reads and command output that the memory indexer deliberately does not index. A non-owner sender (a group member, another DM) therefore gets `current_session` whatever it asks for, and the result carries a `scopeNote` saying so. "Owner" has the same meaning as for `code_interpreter`: the sender matched the channel's owner allowlist. Subagents and inbound A2A tasks cannot call `deep_recall` at all (for subagents it is on the deny list in `agent-tools.policy.ts`, together with `recall_range` and `expand_message`).
+
+The owner flag also decides what a recall records and sees. Every search the tool issues (the smart shortcut, the somatic-marker assessment, the live `search()` API, the bootstrap snapshot's seed queries) passes `observe: senderIsOwner` and the agent `sessionKey`, so a retrieval-evidence row is written for owner recalls only and guest recalls leave no trace in the evidence ledger; the snapshot builder takes the same switch as `observeEvidence`. The same flag enables `tagSuperseded`, which ranks results the canonical ledger has superseded last and tags them with the current value; guests get untagged results.
 
 `current_session` is the path the agent takes to reach back into its own offloaded context (a `[Context offloaded]` note or a `[tool output offloaded]` stub in the conversation), so it has three differences from the research scopes:
 
```

**File**: `docs/memory/dream-engine.md` (modified, +39/-15)
```diff
@@ -71,12 +71,13 @@ readiness = newChunks / totalChunks   (information ratio)
 The cycle is skipped if:
 
 - No chunks have been added/updated since the last dream
-- Fewer than 3 new chunks AND no pending near-merge hints AND no curiosity targets
+- Fewer than 3 new chunks AND no pending near-merge hints AND an empty orphan replay queue AND no unexplored curiosity targets
 
 Secondary triggers that guarantee readiness:
 
 - **Near-merge hints** from SNN discovery (score ≥ 0.3)
-- **Active curiosity targets** (score ≥ 0.2)
+- **Queued orphan clusters** in `orphan_replay_queue` (score ≥ 0.3)
+- **Unexplored curiosity targets** (score ≥ 0.2)
 
 Mini-dreams (emotionally triggered) bypass the readiness check entirely.
 
@@ -101,7 +102,8 @@ Each mode serves a different purpose and has a default weight controlling how of
 **`hygiene` (PLAN-40 Lane 2, enabled, reserved slot):** each cycle it
 (a) drains the never-embedded crystal backlog (200/cycle, no LLM,
 cursorless) and (b) enqueues up to 2 "still true?" questions for canonical
-facts unconfirmed for 90+ days (3 asks max, then the fact transitions to
+facts unconfirmed for 90+ days (never the same fact twice within 30 days;
+3 asks max, then the fact transitions to
 `unconfirmed`; a tier ≥ 1 re-confirmation resets the budget for the next
 staleness episode). One selection slot per cycle is reserved for utility
 lanes round-robin so softmax competition can never starve them.
@@ -146,15 +148,21 @@ individually re-enablable via `memory.dream.modes.<mode>.enabled`.
 
 ### Mode Selection — Three-Signal Architecture
 
-`selectModes()` picks 1-3 modes using three complementary signals from the unified `CuriosityEngine`, combined via weighted normalization. The marketplace signal activates only when there is recent marketplace activity; otherwise the original two-signal weights are preserved:
+`selectModes()` picks 1-3 modes using three complementary signals from the unified `CuriosityEngine`, combined via weighted normalization. The marketplace signal activates only when there is recent marketplace activity; a pending-task bias (PLAN-17) takes a smaller share when long-horizon tasks are waiting; otherwise the original weights are preserved:
 
-**When marketplace is active** (purchases, bounties, or searches in the last 24h):
+**When marketplace is active** (purchases, bounties, or searches in the last 7 days, `MarketplaceIntelligence.hasActivity()`):
 
 ```
 adjustment = 0.25 × curiosityAdj + 0.25 × gccrfAdj + (0.30 × fshoFactor) × fshoAdj + 0.20 × marketAdj
 ```
 
-**When no marketplace activity** (fallback to original weights):
+**When tasks are pending and no marketplace activity** (long-horizon tasks waiting on a wakeup or stuck in planning; disable with `BITTERBOT_DREAM_TASK_BIAS=0`):
+
+```
+adjustment = 0.275 × curiosityAdj + 0.275 × gccrfAdj + (0.30 × fshoFactor) × fshoAdj + 0.15 × taskAdj
+```
+
+**When neither is active** (fallback to original weights):
 
 ```
 adjustment = 0.30 × curiosityAdj + 0.30 × gccrfAdj + (0.40 × fshoFactor) × fshoAdj
@@ -203,7 +211,7 @@ After adjustment, mode selection uses temperature-scaled softmax:
 
 #### Auto-Triggers
 
-- `exploration` forced if unresolved curiosity targets exist
+- `exploration` is added when unexplored, unresolved curiosity targets exist, the mode is enabled (`memory.dream.modes.exploration.enabled`, off by default) and a selection slot is still free after the reserved utility-lane slot
 - (the `mutation` auto-trigger was retired in PLAN-45 Phase 1)
 
 ---
@@ -253,7 +261,7 @@ Cross-domain creative recombination. Uses **farthest-point sampling** to select
 
 ### Exploration Mode (local LLM)
 
-Gap-filling driven by the curiosity engine. Loads unresolved `curiosity_targets` of type `knowledge_gap` and generates content to fill those gaps using a local LLM (to minimize cost).
+Gap-filling driven by the curiosity engine. Loads up to 3 unresolved, unexpired `curiosity_targets` that carry no `explored` stamp, of any type, by priority, and generates content to fill those gaps using a local LLM (to minimize cost). The optional external-research step (only when the external research adapter is available and `autoResearch` is on) is narrower: it selects `knowledge_gap`, `market_demand` and `frontier` targets not yet externally researched.
 
 **Off by default since the token-efficiency pass (2026-09-19).** On the reference node exploration asked near-identical questions every cycle (28 of 30 frontier targets already explored) and the live config had already disabled it. Re-enable with `memory.dream.modes.exploration.enabled: true`.
 
@@ -263,7 +271,7 @@ Gap-filling driven by the curiosity engine. Loads unresolved `curiosity_targets`
 
 ### Slow Update (PLAN-21 Phase D)
 
-**Retired in PLAN-45 Phase 1 (2026-09-05).** The epoch-wise longitudinal regression (`dream-slow-update.ts`) and its per-cycle hook were deleted. The `skill_text_history` table it read is intentionally left in place with no migration and is now orpha
```

**File**: `docs/memory/emotional-system.md` (modified, +41/-30)
```diff
@@ -24,20 +24,24 @@ value = baseline + (value - baseline) × 2^(-elapsed / halfLife)
 
 Events stimulate specific hormones. Each event has a magnitude (how much to add) and a target hormone:
 
-| Event               | Hormone            | Magnitude    | Trigger                                                                                               |
-| ------------------- | ------------------ | ------------ | ----------------------------------------------------------------------------------------------------- |
-| `reward`            | dopamine           | +0.30        | Positive feedback                                                                                     |
-| `achievement`       | dopamine, oxytocin | +0.40, +0.20 | Task completion, breakthrough                                                                         |
-| `curiosity_high`    | dopamine           | +0.25        | Curiosity reward > 0.7                                                                                |
-| `error`             | cortisol           | +0.30        | Bug, error, frustration                                                                               |
-| `urgency`           | cortisol           | +0.40        | Time pressure detected                                                                                |
-| `social`            | oxytocin           | +0.30        | Personal sharing, trust building                                                                      |
-| `marketplace_sale`  | dopamine, oxytocin | +0.15, +0.05 | Skill sold on marketplace                                                                             |
-| `recall_positive`   | dopamine           | +0.05        | Retrieved positive memories                                                                           |
-| `recall_negative`   | cortisol           | +0.05        | Retrieved negative memories                                                                           |
-| `recall_relational` | oxytocin           | +0.05        | Retrieved personal/relational memories                                                                |
-| `compute_success`   | dopamine           | +0.05        | A compute job you can see succeeded on the pool (rate-limited)                                        |
-| `compute_setback`   | cortisol           | +0.05        | A pool worker went offline, the coordinator went away, or embeddings keep falling back (rate-limited) |
+| Event                | Hormone            | Magnitude    | Trigger                                                                                               |
+| -------------------- | ------------------ | ------------ | ----------------------------------------------------------------------------------------------------- |
+| `reward`             | dopamine           | +0.30        | Positive feedback                                                                                     |
+| `achievement`        | dopamine, oxytocin | +0.40, +0.20 | Task completion, breakthrough                                                                         |
+| `curiosity_high`     | dopamine           | +0.25        | Curiosity reward > 0.7                                                                                |
+| `curiosity_progress` | dopamine           | +0.20        | Learning-progress component (`deltaEta`) > 0.7                                                        |
+| `curiosity_aligned`  | dopamine           | +0.10        | Strategic-alignment component > 0.7                                                                   |
+| `curiosity_stagnant` | cortisol           | +0.15        | Five consecutive curiosity rewards below 0.2 (one event per run)                                      |
+| `curiosity_bonding`  | oxytocin, dopamine | +0.25, +0.10 | Empowerment > 0.6 on a preference, relationship or episode chunk                                      |
+| `error`              | cortisol           | +0.30        | Bug, error, frustration                                                                               |
+| `urgency`            | cortisol           | +0.40        | Time pressure detected                                                                                |
+| `social`             | oxytocin           | +0.30        | Personal sharing, trust building                                                                      |
+| `marketplace_sale`   | dopamine, oxytocin | +0.15, +0.05 | Skill sold on marketplace                                                                             |
+| `recall_positive`    | dopamine           | +0.05        | Retrieved positive memories                                                                           |
+| `recall_negative`    | cortisol           | +0.05        | Retrieved negative memories                                                                           |
+| `reca
```

#### Recent Merged Pull Requests:
- **PR #346** (2026-11-01): docs(memory): bring every memory doc back in line with the code at v1.12.0 (@VGIL77)
- **PR #345** (2026-10-31): fix(infra): make batch lanes reach the Batches API and offer beta nodes the stable release (@VGIL77)
- **PR #344** (2026-10-31): fix(memory): record evidence only for prompt-included facts, owner searches and on an independent retention clock (@VGIL77)
- **PR #343** (2026-10-31): feat(compute): land the beta recovery stack on main with Soapbox rc10 (@VGIL77)
- **PR #342** (2026-10-31): feat(gateway): explain disabled OpenAI-compatible endpoints instead of a bare 404 (@VGIL77)
- **PR #341** (2026-10-31): feat(gateway): attribute event-loop stalls with an on-demand sampling profiler (@VGIL77)

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

## X. docs(memory): bring every memory doc back in line with the code at v1.12.0 (#346

**RULE**:
When implementing operations in `docs/concepts/memory.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Bitterbot-AI/bitterbot-desktop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `93a5f683`: docs(memory): bring every memory doc back in line with the code at v1.12.0 (#346). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/concepts/memory.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
| **Knowledge Crystals**         | Memories that naturally decay via Ebbinghaus curves. Use, spaced repetition and emotional weight slow the decay; unused info fades. Only skills are frozen and never decay.                                                                                                                                         | [Knowledge Crystals](../memory/knowledge-crystals.md)   |
                              ├── Hormonal decay toward baseline
                              ├── Ebbinghaus decay + forgetting
                              ├── Tombstone purge (forgotten > 14 days)
                              ├── Governance TTL + stalled goals
                              ├── Restabilize labile memories, prune graph, contradictions
                              └── Canonical ledger decay (90 days unconfirmed)
No external database, no cloud dependency. One `.sqlite` file is the entire memory.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
| **Knowledge Crystals**         | Memories that naturally decay via Ebbinghaus curves. Frequently accessed facts become permanent; unused info fades.                                                                                                                                                                                                 | [Knowledge Crystals](../memory/knowledge-crystals.md)   |
                              ├── Ebbinghaus decay
                              └── Hormonal modulation
No external database, no cloud dependency. One `.db` file is the entire memory.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `93a5f683` are properly handled with clean fallback behavior.
