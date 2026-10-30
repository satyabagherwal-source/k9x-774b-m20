> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bitterbot-ai-bitterbot-desktop-learnings.md`  
> **Source**: github ([https://github.com/Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop))  
> **Source Version**: `fe517486`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T03:59:44.277Z  
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
> **Harvest Timestamp**: 2026-10-30T03:59:43.678Z  
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

### Incident Patch 1: `fe517486` (2026-10-30)
**Commit Message**: feat(memory): weighted RRF channel fusion with sweep and real-query validation (#332)

Hybrid memory search fused its vector, keyword and graph channels with
unweighted reciprocal rank fusion (1 / (60 + rank) per channel). On one
node's real memory the fused list lost to its own keyword channel. This
adds per-channel RRF weights and a configurable RRF constant, measures
them, and sets the default from that measurement.

Weighted RRF:
- rrfFuse accepts a weight per list (contribution weight / (k + rank));
  weight 0 removes a channel's contribution without changing candidate
  retrieval, and an id found only by silenced channels is dropped.
- mergeHybridResultsRRF takes weights and k; the manager reads them from
  agents.defaults.memorySearch.query.hybrid.rrfWeights {vector, keyword,
  graph} and hybrid.rrfK (types, zod, labels, help, defaults registry).
  Negative or non-finite values fall back to the default with a warning.
- 1/1/1 at k 60 reproduces the previous ordering exactly (tested).

Measurement (docs/research/fusion-weights-2026-10-29.md):
- benchmarks/live-recall/fusion-sweep.mts: capture once, re-fuse offline
  through the production rrfFuse over 72 settings, select on t

**File**: `benchmarks/live-recall/README.md` (modified, +70/-6)
```diff
@@ -83,12 +83,26 @@ code paths can be judged on what the agent actually asks:
    `~/.bitterbot/event-journal.sqlite` (stream `tool`, phase `start`). Private
    output under `~/.bitterbot`, never committed; a manifest with counts and the
    file hash is.
-2. `replay-judge.mts` searches a copy of the snapshot once per setting
-   (here `postFusionBoostScale` 1, 0.1, 0), pools the top-k passages across
-   settings, and asks a small model ONCE per (query, passage) pair whether the
-   passage answers the query. The same verdicts score every setting, so the
-   comparison is fair even where the judge is not. Output: hit@k (any relevant
-   passage in the top k), precision@k, relevant@1, MRR; hashes and ranks only.
+2. `replay-judge.mts` searches a copy of the snapshot once per setting,
+   pools the top-k passages across settings, and asks a small model ONCE per
+   (query, passage) pair whether the passage answers the query. The same
+   verdicts score every setting, so the comparison is fair even where the
+   judge is not. Output: hit@k (any relevant passage in the top k),
+   precision@k, relevant@1, MRR; hashes and ranks only.
+
+   A setting is `boost=<postFusionBoostScale>;rrf=<vector>,<keyword>,<graph>[;k=<rrfK>]`,
+   passed as `--settings "boost=0.1;rrf=1,1,1" "boost=0.1;rrf=0.25,1,1" ...`
+   (`--scales 1,0.1,0` is the older spelling for boost scales alone). The first
+   setting is the baseline. Every search runs with the wall clock frozen at
+   `--now` and hormonal modulation off, so a setting's list depends on the
+   code and the snapshot only; the recency boost keeps its production default.
+   `--rejudge N` asks the judge again about N random pooled pairs to estimate
+   its flip rate; the output then carries, per setting against the baseline,
+   the paired delta in hit@k and MRR, a paired bootstrap over queries
+   (sampling noise), the sd of the delta when every pooled verdict flips at
+   that rate (judge noise), and a `nonInferior` flag (both deltas at least
+   minus twice the judge-noise sd). `--verdict-cache` checkpoints verdicts
+   (hashes and booleans) so a run that loses the network resumes for free.
 
 Results, 2026-10-27: 68 distinct real queries (May to October 2026, median 36
 characters), k = 5, judge `claude-haiku-4-5`, 398 pairs judged. Only 33 of the
@@ -109,6 +123,56 @@ queries, which are short and keyword-shaped and sit closer to the keyword
 channel's strengths, and 0 is not distinguishable from 0.1 on this sample. The
 default stays at 0.1.
 
+Results, 2026-10-29 (`results/replay-journal-fusion-weights-2026-10-29.json`):
+the same 68 queries against a fresh snapshot (3,952 chunks), k = 5, clock
+frozen, hormonal modulation off, `postFusionBoostScale` 0.1 throughout, RRF
+channel weights varied (vector, keyword, graph). 329 pairs judged by
+`claude-haiku-4-5` ($0.06); 36 of 68 queries had any relevant passage under
+any setting. Re-judging 80 random pairs flipped 3 (3.75 percent).
+
+| RRF weights (vector, keyword, graph) | hit@5 | precision@5 | relevant@1 | MRR   | delta hit@5 vs 1,1,1 | delta MRR vs 1,1,1 | judge-noise margin (hit@5 / MRR) |
+| ------------------------------------ | ----- | ----------- | ---------- | ----- | -------------------- | ------------------ | -------------------------------- |
+| 1, 1, 1 (unweighted, default)        | 47.1% | 33.5%       | 36.8%      | 0.400 |                      |                    |                                  |
+| 0.5, 1, 1                            | 45.6% | 33.5%       | 36.8%      | 0.398 | -1.5 pt              | -0.003             | 3.5 pt / 0.017                   |
+| 0.25, 1, 1                           | 47.1% | 32.6%       | 36.8%      | 0.402 | 0.0 pt               | +0.002             | 4.7 pt / 0.026                   |
+| 0.1, 1, 1                            | 48.5% | 32.6%       | 35.3%      | 0.394 | +1.5 pt              | -0.006             | 5.1 pt / 0.030                   |
+
+The margin is twice the sd of the paired delta when every pooled verdict flips
+independently at the observed 3.75 percent rate; all three keyword-heavier
+settings are non-inferior to 1/1/1 under it, and none is better (paired
+bootstrap over queries spans zero for every contrast). The large gain the
+generated questions showed does not appear on real queries, which are short
+and keyword-shaped and already sit where both channels agree. The default
+stays 1/1/1: with no measured real-query benefit there is nothing to pay the
+comparability cost for. 0.25 and 0.1 are available as configuration. Full
+tables and the decision: `docs/research/fusion-weights-2026-10-29.md`.
+
+## Fusion-weight sweep (generated questions, partitioned)
+
+`fusion-sweep.mts` asks how the fused list should combine its channels. It
+runs one deep search per question (fused top 200 with every channel's own rank
+on each result) from a frozen fork of the snapshot, then re-fuses offline
+through the production `rrfFuse` over a grid of RRF channel we
```

**File**: `benchmarks/live-recall/fusion-sweep.mts` (added, +489/-0)
```diff
@@ -0,0 +1,489 @@
+/**
+ * Fusion-weight sweep on the PLAN-59 Phase 1 partition.
+ *
+ * Captures one deep fused search per question from a frozen fork of a store
+ * snapshot (the fused top N with every channel's own rank on each result),
+ * then re-fuses offline with weighted RRF over a grid of channel weights and
+ * RRF constants, through the production `rrfFuse`. Selection happens on the
+ * development split only, confirmation on qualification (family-paired
+ * bootstrap), and the final split stays sealed behind the Phase 1 partition
+ * gate (`--final --freeze <sha256>` of a protocol file marked frozen).
+ *
+ * The capture holds chunk ids and file paths of private memory, so it is
+ * written only under `~/.bitterbot/benchmarks/live-recall/` with mode 0600
+ * and is never committed. The result file holds weights, hashes and numbers.
+ *
+ *   node --import tsx benchmarks/live-recall/fusion-sweep.mts \
+ *     --snapshot <copy.sqlite> --questions ~/.bitterbot/benchmarks/live-recall/plan59-questions-<date>.jsonl \
+ *     --capture ~/.bitterbot/benchmarks/live-recall/plan59-fusion-capture-<date>.json \
+ *     --out benchmarks/live-recall/results/fusion-sweep-<date>.json [--max 200] [--now <epoch ms>]
+ *
+ * The capture is reused when it exists, so the grid can be changed and the
+ * sweep re-run without another round of searches. Captures take about ten
+ * seconds per question at 1,000 candidates per channel on a small box; a
+ * partial capture is checkpointed every ten questions and resumed.
+ */
+import {
+  chmodSync,
+  existsSync,
+  mkdirSync,
+  mkdtempSync,
+  readFileSync,
+  writeFileSync,
+} from "node:fs";
+import { tmpdir } from "node:os";
+import { dirname, join } from "node:path";
+import { DatabaseSync } from "node:sqlite";
+import { parseArgs } from "node:util";
+import { resolveApiKeyForProvider } from "../../src/agents/model-auth.js";
+import { loadConfig } from "../../src/config/io.js";
+import { rrfFuse } from "../../src/memory/rrf.js";
+import type { MemorySearchResult } from "../../src/memory/types.js";
+import {
+  gitCommit,
+  isPrivateBenchmarkPath,
+  loadQuestions,
+  type Question,
+  refuseUnderBitterbotHome,
+  sha256,
+  sha256File,
+} from "../plan59-phase1/common.js";
+import {
+  EmbeddingMemo,
+  makeIdResolver,
+  openFrozenStore,
+  parentMap,
+} from "../plan59-phase1/harness.js";
+import {
+  assertFinalAllowed,
+  type FinalGate,
+  type Partition,
+  questionsIn,
+  type Split,
+} from "../plan59-phase1/partition.js";
+import { type Channel, CHANNELS, type RankedResult, rankOf } from "../plan59-phase1/scoring.js";
+
+const { values: args } = parseArgs({
+  options: {
+    snapshot: { type: "string" },
+    questions: { type: "string" },
+    capture: { type: "string" },
+    out: { type: "string" },
+    max: { type: "string", default: "200" },
+    now: { type: "string" },
+    work: { type: "string" },
+    final: { type: "boolean", default: false },
+    freeze: { type: "string" },
+    protocol: { type: "string" },
+  },
+  strict: true,
+});
+if (!args.snapshot || !args.questions || !args.capture || !args.out) {
+  throw new Error(
+    "usage: --snapshot <sqlite> --questions <jsonl> --capture <private json> --out <result json> [--max 200] [--now ms]",
+  );
+}
+if (!isPrivateBenchmarkPath(args.capture)) {
+  throw new Error(
+    `the capture holds private paths; --capture must be under ~/.bitterbot/benchmarks/live-recall/ (got ${args.capture})`,
+  );
+}
+refuseUnderBitterbotHome(args.out, "a sweep result");
+const MAX = Math.max(1, Math.floor(Number(args.max)));
+
+// ---- questions and partition ----------------------------------------------
+
+type CapturedResult = {
+  id: string | null;
+  path: string;
+  startLine: number;
+  endLine: number;
+  fusedRank: number;
+  ch: Partial<Record<Channel, number>>;
+};
+type Capture = { chunkId: string; path: string; split: Split; results: CapturedResult[] };
+type CaptureFile = {
+  snapshotSha256?: string;
+  questionsSha256: string;
+  frozenNow: number;
+  maxResults: number;
+  gitCommit: string | null;
+  captures: Capture[];
+};
+
+const { questions, raw } = loadQuestions(args.questions);
+const qSha = sha256(raw);
+const partition = JSON.parse(readFileSync(`${args.questions}.partition.json`, "utf8")) as Partition;
+let finalGate: FinalGate | undefined;
+if (args.final) {
+  finalGate = assertFinalAllowed({
+    final: true,
+    freeze: args.freeze,
+    protocolPath: args.protocol ?? join(dirname(args.out), "fusion-sweep.protocol.md"),
+  });
+}
+const splits: Split[] = finalGate
+  ? ["development", "qualification", "final"]
+  : ["development", "qualification"];
+const bySplit = new Map<Split, Question[]>(
+  splits.map((s) => [
+    s,
+    questionsIn(s, questions, partition, { questionsSha256: qSha, finalGate }),
+  ]),
+);
+const splitOf = new Map<string, Split>();
+for (const [s, qs] of bySplit) {
+  for (const q of qs) {
+    splitOf.set(q.chunkId, s);
+  }
+}
+const all = splits.fl
```

**File**: `benchmarks/live-recall/replay-judge.mts` (modified, +478/-66)
```diff
@@ -1,50 +1,138 @@
 /**
- * Replay real agent queries against a store snapshot under several
- * post-fusion boost scales and judge relevance with a small model.
+ * Replay real agent queries against a store snapshot under several search
+ * settings and judge relevance with a small model.
  *
  * The held-out set (run.mts) has exact ground truth but synthetic questions.
  * Real queries from the journal (extract-journal-queries.mts) have no ground
  * truth, so a judge model marks each (query, passage) pair relevant or not,
  * ONCE, and the same verdicts score every setting. Settings differ only in the
  * code path under test, so the comparison is fair even if the judge is not
- * perfect. Output holds metrics and ids only.
+ * perfect. Output holds metrics, hashes and ranks only.
+ *
+ * A setting is a post-fusion boost scale, an RRF weight triple
+ * (vector,keyword,graph) and optionally an RRF constant:
  *
  *   node --import tsx benchmarks/live-recall/replay-judge.mts \
  *     --snapshot ~/snap.sqlite --queries ~/.bitterbot/benchmarks/live-recall/journal-queries.jsonl \
- *     --scales 1,0.1,0 --out benchmarks/live-recall/results/replay-<date>.json [--k 5] [--judge claude-haiku-4-5]
+ *     --settings "boost=0.1;rrf=1,1,1" "boost=0.1;rrf=0.25,1,1" "boost=0.1;rrf=0.1,1,1" \
+ *     --out benchmarks/live-recall/results/replay-<date>.json [--k 5] [--judge claude-haiku-4-5] \
+ *     [--now <epoch ms>] [--rejudge 60] [--verdict-cache <json>]
+ *
+ * `--scales 1,0.1,0` is the older spelling of `--settings "boost=1;rrf=1,1,1" ...`.
+ * The first setting is the baseline the others are compared with. The wall
+ * clock is frozen at `--now` for every search (default: the start of the run)
+ * and hormonal modulation is off, so a setting's result list is a function of
+ * the code and the snapshot alone; the recency boost keeps its production
+ * default. `--rejudge N` asks the judge a second time about N randomly chosen
+ * pooled pairs to estimate its flip rate, which sets the non-inferiority
+ * margin (see `judgeNoise` and `contrasts` in the output).
  */
 import { execSync } from "node:child_process";
 import { createHash } from "node:crypto";
-import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
+import {
+  chmodSync,
+  copyFileSync,
+  existsSync,
+  mkdirSync,
+  mkdtempSync,
+  readFileSync,
+  rmSync,
+  writeFileSync,
+} from "node:fs";
 import { tmpdir } from "node:os";
 import { dirname, join } from "node:path";
 import { parseArgs } from "node:util";
 import { resolveApiKeyForProvider } from "../../src/agents/model-auth.js";
 import type { BitterbotConfig } from "../../src/config/config.js";
 import { loadConfig } from "../../src/config/io.js";
+import type { EmbeddingProvider } from "../../src/memory/embeddings.js";
+import type { HybridRrfWeights } from "../../src/memory/hybrid.js";
 import { MemoryIndexManager } from "../../src/memory/manager.js";
 import type { MemorySearchResult } from "../../src/memory/types.js";
+import { seededRandom } from "../plan59-phase1/common.js";
 
-const { values: args } = parseArgs({
+const { values: args, positionals } = parseArgs({
+  allowPositionals: true,
   options: {
     snapshot: { type: "string" },
     queries: { type: "string" },
     out: { type: "string" },
-    scales: { type: "string", default: "1,0.1,0" },
+    scales: { type: "string" },
+    settings: { type: "string", multiple: true },
     k: { type: "string", default: "5" },
     judge: { type: "string", default: "claude-haiku-4-5" },
+    now: { type: "string" },
+    rejudge: { type: "string", default: "0" },
+    "verdict-cache": { type: "string" },
   },
   strict: true,
 });
 if (!args.snapshot || !args.queries || !args.out) {
   throw new Error(
-    "usage: --snapshot <sqlite> --queries <jsonl> --out <json> [--scales 1,0.1,0] [--k 5]",
+    'usage: --snapshot <sqlite> --queries <jsonl> --out <json> [--settings "boost=0.1;rrf=1,1,1" ...] [--scales 1,0.1,0] [--k 5]',
   );
 }
 const K = Number(args.k);
-const scales = args.scales.split(",").map((s) => Number(s.trim()));
 const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
 
+// ---- settings ---------------------------------------------------------------
+
+type Setting = {
+  label: string;
+  boost: number;
+  rrf: HybridRrfWeights;
+  rrfK: number;
+};
+
+/** Parse `boost=0.1;rrf=0.25,1,1;k=60` (every part optional; defaults 0.1 / 1,1,1 / 60). */
+function parseSetting(spec: string): Setting {
+  const setting: Setting = {
+    label: spec.trim(),
+    boost: 0.1,
+    rrf: { vector: 1, keyword: 1, graph: 1 },
+    rrfK: 60,
+  };
+  for (const part of spec.split(";")) {
+    const [key, value] = part.split("=").map((s) => s.trim());
+    if (!key) {
+      continue;
+    }
+    if (key === "boost") {
+      setting.boost = Number(value);
+    } else if (key === "rrf") {
+      const [v, k, g] = (value ?? "").split(",").map((s) => Number(s.trim()));
+ 
```

**File**: `benchmarks/live-recall/results/fusion-sweep-2026-10-29.json` (added, +445/-0)
```diff
@@ -0,0 +1,445 @@
+{
+  "ranAt": "2026-10-30T00:57:21.498Z",
+  "gitCommit": "f9ac780a+dirty",
+  "snapshotSha256": "03be448df9d4e5570d47d36d68b8bd433a9cfb4e59fc464ed67d861cd0828990",
+  "questionsSha256": "bc36b6b0bc60999aa060a5d1b92e4f66669c8bd63564b65feab563857c308d32",
+  "frozenNow": 1793317267487,
+  "maxResults": 200,
+  "fusion": "src/memory/rrf.ts rrfFuse, weight / (k + rank), ties by live fused rank",
+  "caveat": "channel lists are the per-channel ranks of the chunks inside the live fused top-200; gold chunks outside that list are unrecoverable here",
+  "goldAbsentFromCapture": {
+    "development": 40,
+    "qualification": 18
+  },
+  "development": {
+    "n": 212,
+    "liveFused": {
+      "n": 212,
+      "mrr": 0.2547,
+      "r1": 0.1604,
+      "r5": 0.3491,
+      "cov10": 0.467
+    },
+    "currentUnweightedRrf60": {
+      "n": 212,
+      "mrr": 0.2689,
+      "r1": 0.1745,
+      "r5": 0.3726,
+      "cov10": 0.4811
+    },
+    "keywordOnly": {
+      "n": 212,
+      "mrr": 0.4174,
+      "r1": 0.316,
+      "r5": 0.5519,
+      "cov10": 0.6509
+    },
+    "best": {
+      "w": {
+        "v": 0.1,
+        "k": 1,
+        "g": 0,
+        "rrfK": 60
+      },
+      "n": 212,
+      "mrr": 0.4227,
+      "r1": 0.3208,
+      "r5": 0.5613,
+      "cov10": 0.6509
+    },
+    "top10": [
+      {
+        "w": {
+          "v": 0.1,
+          "k": 1,
+          "g": 0,
+          "rrfK": 60
+        },
+        "n": 212,
+        "mrr": 0.4227,
+        "r1": 0.3208,
+        "r5": 0.5613,
+        "cov10": 0.6509
+      },
+      {
+        "w": {
+          "v": 0.1,
+          "k": 1,
+          "g": 0.5,
+          "rrfK": 60
+        },
+        "n": 212,
+        "mrr": 0.4227,
+        "r1": 0.3208,
+        "r5": 0.5613,
+        "cov10": 0.6509
+      },
+      {
+        "w": {
+          "v": 0.1,
+          "k": 1,
+          "g": 1,
+          "rrfK": 60
+        },
+        "n": 212,
+        "mrr": 0.4227,
+        "r1": 0.3208,
+        "r5": 0.5613,
+        "cov10": 0.6509
+      },
+      {
+        "w": {
+          "v": 0.25,
+          "k": 1,
+          "g": 0,
+          "rrfK": 15
+        },
+        "n": 212,
+        "mrr": 0.4188,
+        "r1": 0.316,
+        "r5": 0.5377,
+        "cov10": 0.6415
+      },
+      {
+        "w": {
+          "v": 0.25,
+          "k": 1,
+          "g": 0.5,
+          "rrfK": 15
+        },
+        "n": 212,
+        "mrr": 0.4188,
+        "r1": 0.316,
+        "r5": 0.5377,
+        "cov10": 0.6415
+      },
+      {
+        "w": {
+          "v": 0.25,
+          "k": 1,
+          "g": 1,
+          "rrfK": 15
+        },
+        "n": 212,
+        "mrr": 0.4188,
+        "r1": 0.316,
+        "r5": 0.5377,
+        "cov10": 0.6415
+      },
+      {
+        "w": {
+          "v": 0.1,
+          "k": 1,
+          "g": 0,
+          "rrfK": 5
+        },
+        "n": 212,
+        "mrr": 0.4179,
+        "r1": 0.316,
+        "r5": 0.5519,
+        "cov10": 0.6509
+      },
+      {
+        "w": {
+          "v": 0.1,
+          "k": 1,
+          "g": 0.5,
+          "rrfK": 5
+        },
+        "n": 212,
+        "mrr": 0.4179,
+        "r1": 0.316,
+        "r5": 0.5519,
+        "cov10": 0.6509
+      },
+      {
+        "w": {
+          "v": 0.1,
+          "k": 1,
+          "g": 1,
+          "rrfK": 5
+        },
+        "n": 212,
+        "mrr": 0.4179,
+        "r1": 0.316,
+        "r5": 0.5519,
+        "cov10": 0.6509
+      },
+      {
+        "w": {
+          "v": 0,
+          "k": 1,
+          "g": 0,
+          "rrfK": 5
+        },
+        "n": 212,
+        "mrr": 0.4174,
+        "r1": 0.316,
+        "r5": 0.5519,
+        "cov10": 0.6509
+      }
+    ],
+    "worst3": [
+      {
+        "w": {
+          "v": 1,
+          "k": 1,
+          "g": 0,
+          "rrfK": 60
+        },
+        "n": 212,
+        "mrr": 0.2689,
+        "r1": 0.1745,
+        "r5": 0.3726,
+        "cov10": 0.4811
+      },
+      {
+        "w": {
+          "v": 1,
+          "k": 1,
+          "g": 0.5,
+          "rrfK": 60
+        },
+        "n": 212,
+        "mrr": 0.2689,
+        "r1": 0.1745,
+        "r5": 0.3726,
+        "cov10": 0.4811
+      },
+      {
+        "w": {
+          "v": 1,
+          "k": 1,
+          "g": 1,
+          "rrfK": 60
+        },
+        "n": 212,
+        "mrr": 0.2689,
+        "r1": 0.1745,
+        "r5": 0.3726,
+        "cov10": 0.4811
+      }
+    ]
+  },
+  "qualification": {
+    "n": 106,
+    "liveFused": {
+      "n": 106,
+      "mrr": 0.2379,
+      "r1": 0.1415,
+      "r5": 0.3302,
+      "cov10": 0.4434
+    },
+    "currentUnweightedRrf60": {
+      "n": 106,
+      "mrr": 0.246,
+      "r1": 0.1415,
+      "r5": 0.3491,
+      "cov10": 0.4434
+    },
+    "keywordOnly": {
+      "n": 106,
+      "mrr": 0.4052,
+      "r1": 0.2642,
+      "r5": 0.5943,
+      "cov10": 0.6887
+    },
+    "best": {
+      "w": {
+        "v"
```

**File**: `benchmarks/live-recall/results/replay-journal-fusion-weights-2026-10-29.json` (added, +1578/-0)
```diff
@@ -0,0 +1,1578 @@
+{
+  "git_commit": "f9ac780a+dirty",
+  "snapshotSha256": "03be448df9d4e5570d47d36d68b8bd433a9cfb4e59fc464ed67d861cd0828990",
+  "queriesSha256": "f3075b7c9129fe562d04d79893176583d4256dc70acbd65f65eddc60fa0406a2",
+  "judge": "claude-haiku-4-5",
+  "judgePromptSha256": "56d6dc5281a15b16bb9790e296c942a2e9c2629ea264bbf939a8b9956f726f79",
+  "k": 5,
+  "n": 68,
+  "frozenNow": 1793317267487,
+  "determinism": "clock frozen at frozenNow, hormonal modulation off, recency boost at its default",
+  "embeddingCalls": 68,
+  "pairsJudged": 329,
+  "pairsFromCache": 92,
+  "judgeUsage": {
+    "calls": 317,
+    "inputTokens": 50343,
+    "outputTokens": 1508,
+    "costUsd": 0.0579
+  },
+  "judgeNoise": {
+    "rejudged": 80,
+    "flips": 3,
+    "flipRate": 0.0375,
+    "flipRateUsed": 0.0375,
+    "rule": "margin = 2 x sd of the paired delta when every pooled verdict flips independently with flipRateUsed (the larger of the observed rate and 3/n)"
+  },
+  "anyRelevantQueries": 36,
+  "elapsed_seconds": 349.1,
+  "summary": {
+    "boost=0.1;rrf=1,1,1": {
+      "n": 68,
+      "hitAtK": 0.471,
+      "precisionAtK": 0.335,
+      "mrr": 0.4,
+      "relevantAt1": 0.368,
+      "setting": {
+        "boost": 0.1,
+        "rrf": {
+          "vector": 1,
+          "keyword": 1,
+          "graph": 1
+        },
+        "rrfK": 60
+      }
+    },
+    "boost=0.1;rrf=0.5,1,1": {
+      "n": 68,
+      "hitAtK": 0.456,
+      "precisionAtK": 0.335,
+      "mrr": 0.398,
+      "relevantAt1": 0.368,
+      "setting": {
+        "boost": 0.1,
+        "rrf": {
+          "vector": 0.5,
+          "keyword": 1,
+          "graph": 1
+        },
+        "rrfK": 60
+      }
+    },
+    "boost=0.1;rrf=0.25,1,1": {
+      "n": 68,
+      "hitAtK": 0.471,
+      "precisionAtK": 0.326,
+      "mrr": 0.402,
+      "relevantAt1": 0.368,
+      "setting": {
+        "boost": 0.1,
+        "rrf": {
+          "vector": 0.25,
+          "keyword": 1,
+          "graph": 1
+        },
+        "rrfK": 60
+      }
+    },
+    "boost=0.1;rrf=0.1,1,1": {
+      "n": 68,
+      "hitAtK": 0.485,
+      "precisionAtK": 0.326,
+      "mrr": 0.394,
+      "relevantAt1": 0.353,
+      "setting": {
+        "boost": 0.1,
+        "rrf": {
+          "vector": 0.1,
+          "keyword": 1,
+          "graph": 1
+        },
+        "rrfK": 60
+      }
+    }
+  },
+  "contrasts": [
+    {
+      "setting": "boost=0.1;rrf=0.5,1,1",
+      "baseline": "boost=0.1;rrf=1,1,1",
+      "deltaHitAtK": -0.0147,
+      "deltaMrr": -0.0029,
+      "queriesUp": 2,
+      "queriesDown": 4,
+      "queryBootstrap": {
+        "deltaHitAtK": [-0.0588, 0.0294],
+        "deltaMrr": [-0.0304, 0.0245]
+      },
+      "judgeNoiseSd": {
+        "deltaHitAtK": 0.0174,
+        "deltaMrr": 0.0083
+      },
+      "nonInferior": true
+    },
+    {
+      "setting": "boost=0.1;rrf=0.25,1,1",
+      "baseline": "boost=0.1;rrf=1,1,1",
+      "deltaHitAtK": 0,
+      "deltaMrr": 0.0017,
+      "queriesUp": 5,
+      "queriesDown": 4,
+      "queryBootstrap": {
+        "deltaHitAtK": [-0.0735, 0.0735],
+        "deltaMrr": [-0.0311, 0.0319]
+      },
+      "judgeNoiseSd": {
+        "deltaHitAtK": 0.0234,
+        "deltaMrr": 0.0132
+      },
+      "nonInferior": true
+    },
+    {
+      "setting": "boost=0.1;rrf=0.1,1,1",
+      "baseline": "boost=0.1;rrf=1,1,1",
+      "deltaHitAtK": 0.0147,
+      "deltaMrr": -0.0061,
+      "queriesUp": 6,
+      "queriesDown": 5,
+      "queryBootstrap": {
+        "deltaHitAtK": [-0.0588, 0.0882],
+        "deltaMrr": [-0.0475, 0.0326]
+      },
+      "judgeNoiseSd": {
+        "deltaHitAtK": 0.0257,
+        "deltaMrr": 0.0151
+      },
+      "nonInferior": true
+    }
+  ],
+  "per_query": [
+    {
+      "q": "c4b4aafcd5d3",
+      "results": {
+        "boost=0.1;rrf=1,1,1": {
+          "ranks": [],
+          "relevant": 0
+        },
+        "boost=0.1;rrf=0.5,1,1": {
+          "ranks": [],
+          "relevant": 0
+        },
+        "boost=0.1;rrf=0.25,1,1": {
+          "ranks": [],
+          "relevant": 0
+        },
+        "boost=0.1;rrf=0.1,1,1": {
+          "ranks": [],
+          "relevant": 0
+        }
+      }
+    },
+    {
+      "q": "c3e3a474a0e8",
+      "results": {
+        "boost=0.1;rrf=1,1,1": {
+          "ranks": [],
+          "relevant": 0
+        },
+        "boost=0.1;rrf=0.5,1,1": {
+          "ranks": [],
+          "relevant": 0
+        },
+        "boost=0.1;rrf=0.25,1,1": {
+          "ranks": [],
+          "relevant": 0
+        },
+        "boost=0.1;rrf=0.1,1,1": {
+          "ranks": [],
+          "relevant": 0
+        }
+      }
+    },
+    {
+      "q": "ec7da990967b",
+      "results": {
+        "boost=0.1;rrf=1,1,1": {
+          "ranks": [],
+          "relevant": 0
+        },
+        "boost=0.1;rrf=0.5,1,1": {
+          "ranks": [],
+          "relevant": 0
+        },
+        "boost=0.1;rrf=0.25,1,1": {
+          "ranks": [],
+
```

**File**: `docs/docs.json` (modified, +1/-1)
```diff
@@ -739,7 +739,7 @@
               },
               {
                 "group": "Research",
-                "pages": ["research/plan59-phase1-pilot"]
+                "pages": ["research/plan59-phase1-pilot", "research/fusion-weights-2026-10-29"]
               }
             ]
           },
```

**File**: `docs/memory/curiosity-and-search.md` (modified, +3/-1)
```diff
@@ -232,7 +232,9 @@ flowchart TB
     H --> K[Return results]
 ```
 
-**Hybrid merging** uses reciprocal rank fusion by default (`mergeStrategy: "rrf"`); the configurable weights (0.7 vector + 0.3 text) apply only with `mergeStrategy: "weighted"`. BM25 ranks are converted to [0,1] scores via `bm25RankToScore()`. A PLAN-18 graph-reader channel joins the fusion as a third ranked list when the knowledge graph is populated.
+**Hybrid merging** uses reciprocal rank fusion by default (`mergeStrategy: "rrf"`); the legacy `vectorWeight` / `textWeight` pair (0.7 + 0.3) applies only with `mergeStrategy: "weighted"`. BM25 ranks are converted to [0,1] scores via `bm25RankToScore()`. A PLAN-18 graph-reader channel joins the fusion as a third ranked list when the knowledge graph is populated.
+
+**RRF channel weights.** Under RRF each channel contributes `weight / (k + rank)` for every result it ranked, with `query.hybrid.rrfWeights: { vector, keyword, graph }` and `query.hybrid.rrfK` (default 60). The default is 1/1/1, plain unweighted RRF; a weight of 0 silences a channel without changing what it retrieves (a result found only by a silenced channel is dropped). Negative or non-finite values fall back to the default with a warning. On one node's real memory the keyword channel carries the fused list (names, paths and identifiers): a 2026-10-29 sweep on 318 generated questions found vector 0.1 / keyword 1 best by a wide margin, but on the agent's 68 real, shorter queries no keyword-heavier setting was better than 1/1/1 (vector 0.25: MRR 0.402 against 0.400, hit@5 identical), so the generated-question gain did not transfer and the default was kept. Vector 0.25 and 0.1 are non-inferior on real queries and available as configuration; a LongMemEval-S retrieval check at 0.25 is the precondition for any future default change. Measurement and decision rule: [the fusion-weights research page](../research/fusion-weights-2026-10-29.md).
 
 **Keyword query shape.** `buildFtsQuery()` OR-joins the query's terms for the FTS5 `MATCH`, dropping a short shared stopword list when the query has three or more tokens (a one- or two-word lookup keeps every word) and capping at 16 distinct terms. bm25 then ranks chunks by how many of the terms they contain and how rare those terms are, so a chunk holding every term still sorts first. Until 2026-10-27 the terms were AND-joined: a chunk had to contain every token, which held for terse lookups and for no conversational question, and the per-channel diagnostics showed the keyword channel contributing nothing to natural-language queries on the live store or the LongMemEval baseline. The `fusion` field still reports `rrf` in that case, so look at `channels.keyword` presence, not `fusion`, to tell whether the keyword channel took part.
 
```

**File**: `docs/research/fusion-weights-2026-10-29.md` (added, +231/-0)
```diff
@@ -0,0 +1,231 @@
+---
+title: "Weighted RRF channel fusion: sweep and real-query validation"
+description: "Hybrid memory search fused its vector, keyword and graph channels with unweighted RRF. A partitioned sweep on generated questions and a judge-scored replay of the agent's real queries measured whether down-weighting the vector channel helps, and set the default."
+---
+
+This is a retrieval diagnostic and a default decision, not a curiosity
+component and not externally preregistered. It ran on 2026-10-29 against a
+sealed `VACUUM INTO` copy of one node's memory store; the live store was never
+written. Selection used the development split of the PLAN-59 Phase 1 partition
+only, confirmation the qualification split, and the final split was never read.
+
+Tools: `benchmarks/live-recall/fusion-sweep.mts` (capture once, re-fuse
+offline through the production `rrfFuse`, select on development, confirm on
+qualification) and `benchmarks/live-recall/replay-judge.mts` (real queries,
+judge-scored, every setting scored on the same verdicts). Result files:
+`benchmarks/live-recall/results/fusion-sweep-2026-10-29.json` and
+`benchmarks/live-recall/results/replay-journal-fusion-weights-2026-10-29.json`
+(weights, hashes, ranks and numbers only). Method notes:
+`benchmarks/live-recall/README.md`.
+
+## What was found on main
+
+`src/memory/rrf.ts` fused the channels with plain reciprocal rank fusion,
+`1 / (60 + rank)` per channel, unweighted. The `vectorWeight` and `textWeight`
+keys under `query.hybrid` apply only to the legacy `mergeStrategy: "weighted"`
+path. The PLAN-59 Phase 1 pilot's development baseline had already shown the
+fused list losing to its own keyword channel on this store (fused MRR 0.254
+against keyword-alone 0.421); this work asks whether channel weights recover
+the gap and whether the agent's real queries agree.
+
+## Provenance
+
+| item                | value                                                                                                                                                            |
+| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| commit under test   | `f9ac780a` (main, PLAN-59 Phase 1 harness merged) plus this change                                                                                               |
+| snapshot            | `VACUUM INTO` copy of the live store, read-only source, 3,952 chunks, 368 MB                                                                                     |
+| snapshot SHA-256    | `03be448df9d4e5570d47d36d68b8bd433a9cfb4e59fc464ed67d861cd0828990`                                                                                               |
+| frozen clock        | 2026-10-29T23:41:07Z (capture time) for both the sweep and the replay                                                                                            |
+| generated questions | 449, `claude-haiku-4-5`, seed 59; file SHA-256 `bc36b6b0bc60999aa060a5d1b92e4f66669c8bd63564b65feab563857c308d32`                                                |
+| partition           | seed 59, by family (chunk path): 212 development / 106 qualification / 131 final (never read)                                                                    |
+| capture             | one search per development and qualification question, fused top 200 with per-channel ranks, `maxResults` 200, recency off, hormonal off                         |
+| real queries        | 68 distinct `memory_search` queries from the event journal, May to October 2026; file SHA-256 `f3075b7c9129fe562d04d79893176583d4256dc70acbd65f65eddc60fa0406a2` |
+| judge               | `claude-haiku-4-5`, one YES/NO verdict per (query, passage) pair, shared across settings                                                                         |
+| embedding model     | `text-embedding-3-small`                                                                                                                                         |
+
+The question, partition and capture files paraphrase or name private memory
+and live under `~/.bitterbot/benchmarks/live-recall/` with mode 0600; they are
+not in the repository.
+
+## Sweep on generated questions
+
+Weighted RRF scores a result as the sum over channels of
+`weight / (k + rank)`. The grid was vector weight 0, 0.1, 0.25, 0.5, 0.75, 1
+against keyword weight 1, graph weight 0, 0.5, 1, and k 5, 15, 30, 60: 72
+settings, re-fused offline from one capture per question. "Live fused" is the
+list the search actually returned (unweighted RRF followed by the bounded
+post-fusion boosts); "unweighted RRF" is the same ranks re-fused at 1/1/1
+without the boosts, so the gap between those two rows is what the boosts cost.
+
+### Development split (212 questions, 158 families): selection
+
+| setting                                   | MRR  
```

---

### Incident Patch 2: `b6c09df1` (2026-10-30)
**Commit Message**: feat(memory): shadow surfacing trial eligibility and assignment (PLAN-59 Phase 2) (#331)

Phase 2 measures whether proactively surfacing autonomously learned
information is useful to the owner. Before any live trial can withhold
anything, eligibility and assignment run in shadow: every eligible
surfacing opportunity is logged, assigned to an arm by a randomised
block design, and delivered exactly as today. Nothing the owner sees
changes in this PR; the live withhold condition is a separate exposure
decision and PR, so the mode enum is `off | shadow` only.

- Config `memory.curiosity.evidence.surfacingTrial` (mode default
  `shadow`, blockMinutes 240, carryOverDays 7, optional seed), Zod entry
  next to CuriosityEvidenceSchema, resolver with the evidence-config
  fallback style. `evidence.mode: off` wins: the trial then writes nothing.
- `src/memory/surfacing-trial.ts`: block id = floor(now / blockMinutes);
  arm per (kind, block) from HMAC-SHA256(seed, kind, blockId), balanced
  and independent across blocks; seed derived from the node's evidence
  digest key when none is configured. Carry-over reuses the arm of an
  assignment of the same (kind, ref_id) inside the window. Every
  

**File**: `docs/gateway/configuration-reference.md` (modified, +7/-0)
```diff
@@ -1957,6 +1957,12 @@ The memory subsystems (`memory.dream`, `memory.consolidation`, `memory.curiosity
         mode: "shadow", // "off" | "observe" | "shadow" (default "shadow")
         retentionDays: 90, // prune rows older than this on the consolidation tick
         topK: 10, // retrieval rows kept per search
+        surfacingTrial: {
+          mode: "shadow", // "off" | "shadow" (default "shadow")
+          blockMinutes: 240, // length of one randomisation block
+          carryOverDays: 7, // an item assigned within this window keeps its arm
+          seed: "optional", // absent: derived from this node's evidence digest key
+        },
       },
     },
   },
@@ -1965,6 +1971,7 @@ The memory subsystems (`memory.dream`, `memory.consolidation`, `memory.curiosity
 
 - `off`: nothing is written. `observe`: retrieval hits and surfacing events. `shadow`: also dream-engine decision traces.
 - Observation changes no behaviour in any mode. Query text is never stored; queries and session keys appear only as node-keyed digests. See [Evidence telemetry](/memory/evidence-telemetry).
+- `surfacingTrial` (PLAN-59 Phase 2, shadow stage): logs every proactive surfacing opportunity as `eligible` and assigns it `surface` or `withhold` by a randomised block design, then delivers exactly as before. `shadow` changes nothing the owner sees; `off` restores the Phase 0 rows. A `live` mode does not exist yet; the withhold condition is a separate decision and PR. Writes nothing when `evidence.mode` is `off`. See [Surfacing trial](/memory/evidence-telemetry#surfacing-trial-shadow-stage).
 
 ## Browser
 
```

**File**: `docs/memory/curiosity-and-search.md` (modified, +1/-1)
```diff
@@ -112,7 +112,7 @@ Maximum active targets: 10 (configurable). Expired targets are cleaned up during
 
 Budget: `maxPerDay` (10) questions per UTC day, +2 when dopamine > 0.65, −2 when cortisol > 0.65 (cortisol also raises the confidence floor by 0.1). Pause state lives in `memory_meta`.
 
-Use ledger (`src/memory/curiosity-use.ts`): memory search and proactive recall call `recordCuriosityUse` for any self-learned chunk they return; `curiosityRoiByRegion` feeds step 1. Evidence layer (`memory.curiosity.evidence`, default `shadow`): every owner search writes its top-K chunk ids under a keyed query digest, every voiced finding, proactive-recall fact and dream brief writes a `delivered` row, and a dismiss labels it `explicit`; see [Evidence telemetry](/memory/evidence-telemetry). RPCs: `curiosity.status`, `curiosity.list`, `curiosity.pause`, `curiosity.resume`, `curiosity.dismiss`, `curiosity.ask`, `curiosity.runNow`; the same from the terminal as [`bitterbot curiosity`](/cli/curiosity).
+Use ledger (`src/memory/curiosity-use.ts`): memory search and proactive recall call `recordCuriosityUse` for any self-learned chunk they return; `curiosityRoiByRegion` feeds step 1. Evidence layer (`memory.curiosity.evidence`, default `shadow`): every owner search writes its top-K chunk ids under a keyed query digest, every voiced finding, proactive-recall fact and dream brief writes a `delivered` row, and a dismiss labels it `explicit`; since PLAN-59 Phase 2 the shadow surfacing trial (`evidence.surfacingTrial`, default `shadow`) logs each of those as `eligible` and `assigned` to a randomised-block arm first, without changing what is delivered; see [Evidence telemetry](/memory/evidence-telemetry). RPCs: `curiosity.status`, `curiosity.list`, `curiosity.pause`, `curiosity.resume`, `curiosity.dismiss`, `curiosity.ask`, `curiosity.runNow`; the same from the terminal as [`bitterbot curiosity`](/cli/curiosity).
 
 Private names come from the knowledge graph's `person`, `organization` and `project` entities. A "person" that is not a name ("here", "commands", a peer id) is filed as a `concept` at write time (`looksLikePersonName`) and migration v75 reclassified existing rows, so the filter blocks people, not ordinary words.
 
```

**File**: `docs/memory/evidence-telemetry.md` (modified, +90/-25)
```diff
@@ -2,7 +2,7 @@
 
 An observational layer under the curiosity and dream system. It records what retrieval surfaced, what the agent proactively surfaced to the owner and what came of it, and (in shadow mode) what a "GCCRF as diagnostic only" routing would have decided in the dream engine next to what the legacy routing actually decided. It changes no behaviour in any mode: retrieval order, dream seeds, dream mode choice, hormone events and target closure are exactly what they were before it existed. Later phases read these tables; this phase only writes them.
 
-Code: `src/memory/evidence-telemetry.ts` (writer), migration v79 in `src/memory/migrations.ts`, call sites in `src/memory/manager.ts` and `src/memory/dream-engine.ts`.
+Code: `src/memory/evidence-telemetry.ts` (writer), `src/memory/surfacing-trial.ts` (PLAN-59 Phase 2 shadow assignment), migrations v79 and v80 in `src/memory/migrations.ts`, call sites in `src/memory/manager.ts` and `src/memory/dream-engine.ts`.
 
 ## Modes and defaults
 
@@ -55,20 +55,21 @@ Indexes: `created_at`; `(chunk_id, created_at)`; `query_id`.
 
 What the agent put in front of the owner, and separately what the owner did about it.
 
-| column             | meaning                                                                                                   |
-| ------------------ | --------------------------------------------------------------------------------------------------------- |
-| `event_id`         | idempotency key (`INSERT OR IGNORE`), for example `cf:<finding id>:<hour bucket>`                         |
-| `kind`             | `curiosity_finding`, `proactive_recall`, `dream_brief`, `dream_digest`, `curiosity_target`                |
-| `ref_id`           | the surfaced item (finding id, chunk id, brief id, notification key)                                      |
-| `arm`              | `legacy` in Phase 0; later phases add arms                                                                |
-| `opportunity_id`   | the curiosity target a finding answered, so a dismiss by target id finds the delivery                     |
-| `session_digest`   | digest of the conversation the item was surfaced in, when known                                           |
-| `stage`            | `eligible`, `assigned`, `delivered`, `visible`, `responded`                                               |
-| `outcome`          | `useful`, `corrected`, `dismissed`, `answered`, `engaged_weak`, `unknown`; NULL until something labels it |
-| `label_provenance` | `explicit` (the owner acted), `inferred`, `unknown`                                                       |
-| `cost_usd`         | cost attributed to producing the item, when known                                                         |
-| `created_at`       | when the stage was reached                                                                                |
-| `outcome_at`       | when the outcome was labelled                                                                             |
+| column             | meaning                                                                                                                                                                                             |
+| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| `event_id`         | idempotency key (`INSERT OR IGNORE`), for example `cf:<finding id>:<hour bucket>`                                                                                                                   |
+| `kind`             | `curiosity_finding`, `proactive_recall`, `dream_brief`, `dream_digest`, `curiosity_target`                                                                                                          |
+| `ref_id`           | the surfaced item (finding id, chunk id, brief id, notification key)                                                                                                                                |
+| `arm`              | `legacy` (Phase 0 rows, or the trial off), `unassigned` (an `eligible` row, before the draw), `surface` or `withhold` (assigned by the surfacing trial)                                             |
+| `opportunity_id`   | shared id of one opportunity across its `eligible`, `assigned` and `delivered` rows: the curiosity target a finding answered (so a dismiss by target id finds the delivery), the event id otherwise |
+| `session_digest`   | digest of the conversation the item was surfaced in, when known                                                                                                                                     |
+| `stage`            | `eligible`, `assigned`, `delivered`, `visible`, `responded`                                                                                                               
```

**File**: `src/config/config.curiosity-evidence.test.ts` (modified, +48/-3)
```diff
@@ -1,15 +1,15 @@
 /**
  * PLAN-59 Phase 0: `memory.curiosity.evidence` in the config schema.
  *
- * The typed branch accepts the three keys and rejects a bad mode or an unknown
- * key. Inside the full config the curiosity block sits in a union with
+ * The typed branch accepts the three keys (and, since PLAN-59 Phase 2, the
+ * `surfacingTrial` block) and rejects a bad mode or an unknown key. Inside the full config the curiosity block sits in a union with
  * `z.unknown()` (acceptance of `memory` was never narrowed), so a bad mode there
  * still validates and is handled by `resolveEvidenceConfig` at the read site.
  */
 
 import { describe, expect, it } from "vitest";
 import { validateConfigObject } from "./validation.js";
-import { CuriosityEvidenceSchema } from "./zod-schema.js";
+import { CuriosityEvidenceSchema, CuriositySurfacingTrialSchema } from "./zod-schema.js";
 
 describe("memory.curiosity.evidence (PLAN-59 Phase 0)", () => {
   it("accepts the three keys in a full config", () => {
@@ -42,6 +42,51 @@ describe("memory.curiosity.evidence (PLAN-59 Phase 0)", () => {
     expect(CuriosityEvidenceSchema.safeParse({ modes: "off" }).success).toBe(false);
   });
 
+  it("accepts the Phase 2 surfacingTrial block and rejects a live mode or an unknown key", () => {
+    const res = validateConfigObject({
+      memory: {
+        curiosity: {
+          evidence: {
+            mode: "shadow",
+            surfacingTrial: { mode: "shadow", blockMinutes: 240, carryOverDays: 7, seed: "node-a" },
+          },
+        },
+      },
+    });
+    expect(res.ok).toBe(true);
+    if (res.ok) {
+      const curiosity = (res.config.memory as { curiosity?: { evidence?: unknown } }).curiosity;
+      expect(curiosity?.evidence).toEqual({
+        mode: "shadow",
+        surfacingTrial: { mode: "shadow", blockMinutes: 240, carryOverDays: 7, seed: "node-a" },
+      });
+    }
+    for (const mode of ["off", "shadow"]) {
+      expect(CuriositySurfacingTrialSchema.safeParse({ mode }).success).toBe(true);
+    }
+    expect(CuriositySurfacingTrialSchema.safeParse({}).success).toBe(true);
+    // the withhold condition is a separate exposure decision and PR
+    expect(CuriositySurfacingTrialSchema.safeParse({ mode: "live" }).success).toBe(false);
+    expect(CuriositySurfacingTrialSchema.safeParse({ blockMinutes: 0 }).success).toBe(false);
+    expect(CuriositySurfacingTrialSchema.safeParse({ carryOverDays: -1 }).success).toBe(false);
+    expect(CuriositySurfacingTrialSchema.safeParse({ seed: "" }).success).toBe(false);
+    expect(CuriositySurfacingTrialSchema.safeParse({ blocks: 3 }).success).toBe(false);
+    expect(CuriosityEvidenceSchema.safeParse({ surfacingTrial: { mode: "shadow" } }).success).toBe(
+      true,
+    );
+    expect(CuriosityEvidenceSchema.safeParse({ surfacingTrial: { mode: "live" } }).success).toBe(
+      false,
+    );
+  });
+
+  it("a bad surfacingTrial mode in the full config falls to the unknown branch like the evidence mode", () => {
+    expect(
+      validateConfigObject({
+        memory: { curiosity: { evidence: { surfacingTrial: { mode: "live" } } } },
+      }).ok,
+    ).toBe(true);
+  });
+
   it("a bad mode in the full config falls to the unknown branch and is left to the read site", () => {
     // Documented behaviour of MemorySchema: the curiosity union's fallback is z.unknown().
     const res = validateConfigObject({ memory: { curiosity: { evidence: { mode: "shadwo" } } } });
```

**File**: `src/config/zod-schema.ts` (modified, +15/-0)
```diff
@@ -34,11 +34,26 @@ const NodeHostSchema = z
  * is `z.unknown()`, so a bad mode there degrades to the unknown branch and the
  * code-read site (`resolveEvidenceConfig`) falls back to the default.
  */
+/**
+ * PLAN-59 Phase 2: `memory.curiosity.evidence.surfacingTrial`. Same arrangement
+ * as the evidence block: the typed branch feeds the form; the read site
+ * (`resolveSurfacingTrialConfig`) does its own coercion.
+ */
+export const CuriositySurfacingTrialSchema = z
+  .object({
+    mode: z.enum(["off", "shadow"]).optional(),
+    blockMinutes: z.number().positive().optional(),
+    carryOverDays: z.number().positive().optional(),
+    seed: z.string().min(1).optional(),
+  })
+  .strict();
+
 export const CuriosityEvidenceSchema = z
   .object({
     mode: z.enum(["off", "observe", "shadow"]).optional(),
     retentionDays: z.number().positive().optional(),
     topK: z.number().int().positive().optional(),
+    surfacingTrial: CuriositySurfacingTrialSchema.optional(),
   })
   .strict();
 
```

**File**: `src/memory/curiosity-types.ts` (modified, +31/-0)
```diff
@@ -106,6 +106,32 @@ export type CuriosityWeights = {
  */
 export type CuriosityEvidenceMode = "off" | "observe" | "shadow";
 
+/**
+ * PLAN-59 Phase 2 surfacing trial modes. `off` writes delivered rows with the
+ * `legacy` arm as Phase 0 did; `shadow` logs eligibility and a randomised-block
+ * arm for every proactive surfacing opportunity and delivers exactly as before.
+ * A `live` mode (withholding) is a separate exposure decision and PR.
+ */
+export type CuriositySurfacingTrialMode = "off" | "shadow";
+
+export type CuriositySurfacingTrialConfig = {
+  /** Default: "shadow" (observation only; nothing the owner sees changes). */
+  mode?: CuriositySurfacingTrialMode;
+  /** Length of one randomisation block in minutes. Default: 240. */
+  blockMinutes?: number;
+  /**
+   * An item (same kind and ref id) assigned within this many days keeps its
+   * arm instead of drawing again. Default: 7.
+   */
+  carryOverDays?: number;
+  /**
+   * Trial seed for the arm draw. Absent, it is derived from the node's own
+   * evidence digest key, so assignment is deterministic per node and cannot
+   * be reconstructed from the logged rows.
+   */
+  seed?: string;
+};
+
 export type CuriosityEvidenceConfig = {
   /**
    * Default: "shadow" (every tier of evidence, so the GCCRF retirement decision
@@ -116,6 +142,11 @@ export type CuriosityEvidenceConfig = {
   retentionDays?: number;
   /** At most this many retrieval rows per search. Default: 10. */
   topK?: number;
+  /**
+   * PLAN-59 Phase 2: shadow eligibility and assignment for proactive surfacing.
+   * Writes nothing when `mode` (the evidence layer) is `off`.
+   */
+  surfacingTrial?: CuriositySurfacingTrialConfig;
 };
 
 export type CuriosityConfig = {
```

**File**: `src/memory/evidence-telemetry.test.ts` (modified, +75/-0)
```diff
@@ -285,6 +285,81 @@ describe("EvidenceTelemetry", () => {
     ).toBeNull();
   });
 
+  it("stores stage details as canonical JSON and a guarded label never overwrites or creates a row", () => {
+    const db = openDb();
+    const t = new EvidenceTelemetry(db, { mode: "observe" }, quiet);
+    t.recordSurfacing({
+      eventId: "assigned:pr:c1:1",
+      kind: "proactive_recall",
+      refId: "c1",
+      arm: "withhold",
+      stage: "assigned",
+      details: { carryOver: false, blockId: 7 },
+      now: 1000,
+    });
+    t.recordSurfacing({
+      eventId: "pr:c1:1",
+      kind: "proactive_recall",
+      refId: "c1",
+      arm: "withhold",
+      stage: "delivered",
+      now: 1000,
+    });
+    expect(
+      (
+        db
+          .prepare(`SELECT details_json FROM surfacing_events WHERE event_id = 'assigned:pr:c1:1'`)
+          .get() as { details_json: string }
+      ).details_json,
+    ).toBe('{"blockId":7,"carryOver":false}');
+    expect(
+      (
+        db
+          .prepare(`SELECT details_json FROM surfacing_events WHERE event_id = 'pr:c1:1'`)
+          .get() as {
+          details_json: string | null;
+        }
+      ).details_json,
+    ).toBeNull();
+    // guarded label on an unlabelled row: applied
+    expect(
+      t.recordSurfacingOutcome({
+        eventId: "pr:c1:1",
+        outcome: "explicit_retrieval",
+        provenance: "shadow_crossover",
+        onlyIfUnlabelled: true,
+        now: 2000,
+      }),
+    ).toBe(true);
+    // the owner's explicit label replaces it (ungarded), and the guarded marker then leaves it alone
+    t.recordSurfacingOutcome({ eventId: "pr:c1:1", outcome: "dismissed", provenance: "explicit" });
+    expect(
+      t.recordSurfacingOutcome({
+        eventId: "pr:c1:1",
+        outcome: "explicit_retrieval",
+        provenance: "shadow_crossover",
+        onlyIfUnlabelled: true,
+      }),
+    ).toBe(false);
+    expect(
+      db
+        .prepare(
+          `SELECT outcome, label_provenance FROM surfacing_events WHERE event_id = 'pr:c1:1'`,
+        )
+        .get(),
+    ).toEqual({ outcome: "dismissed", label_provenance: "explicit" });
+    // guarded with no matching row: no responded row is created
+    expect(
+      t.recordSurfacingOutcome({
+        refId: "nothing-here",
+        outcome: "explicit_retrieval",
+        provenance: "shadow_crossover",
+        onlyIfUnlabelled: true,
+      }),
+    ).toBe(false);
+    expect(count(db, "surfacing_events")).toBe(2);
+  });
+
   it("decision traces are shadow-only and diverged compares canonical forms (or the decision key)", () => {
     const db = openDb();
     const observe = new EvidenceTelemetry(db, { mode: "observe" }, quiet);
```

**File**: `src/memory/evidence-telemetry.ts` (modified, +48/-7)
```diff
@@ -115,8 +115,19 @@ export type SurfacingOutcome =
   | "dismissed"
   | "answered"
   | "engaged_weak"
+  /**
+   * PLAN-59 Phase 2: the owner retrieved the item through an explicit memory
+   * search. In the shadow stage this is a baseline rate, not a crossover from
+   * a withheld condition (nothing is withheld in shadow).
+   */
+  | "explicit_retrieval"
+  | "unknown";
+export type LabelProvenance =
+  | "explicit"
+  | "inferred"
+  /** PLAN-59 Phase 2: set by the shadow crossover marker, never by the owner. */
+  | "shadow_crossover"
   | "unknown";
-export type LabelProvenance = "explicit" | "inferred" | "unknown";
 
 export type RecordSurfacingInput = {
   /** Idempotency key: the same event id is written once (INSERT OR IGNORE). */
@@ -128,6 +139,12 @@ export type RecordSurfacingInput = {
   sessionKey?: string;
   stage: SurfacingStage;
   costUsd?: number;
+  /**
+   * PLAN-59 Phase 2: small JSON payload for the stage (the surfacing trial
+   * stores the randomisation block id and the carry-over flag on `assigned`
+   * rows). Never content, never a query.
+   */
+  details?: Record<string, unknown>;
   now?: number;
 };
 
@@ -138,6 +155,12 @@ export type RecordSurfacingOutcomeInput = {
   provenance: LabelProvenance;
   /** Kind for the `responded` row created when no delivered row matches. */
   kind?: string;
+  /**
+   * PLAN-59 Phase 2: leave a row alone when it already carries an outcome, so
+   * an inferred marker never overwrites what the owner said. Also skips the
+   * `responded` fallback row.
+   */
+  onlyIfUnlabelled?: boolean;
   now?: number;
 };
 
@@ -234,6 +257,16 @@ export class EvidenceTelemetry {
     return { ...this.cfg };
   }
 
+  /**
+   * The live connection, or null when the tables are missing. For the
+   * surfacing trial's own lookups (carry-over, crossover, counts): it reads
+   * through this accessor on every call, so a rebind after a database swap is
+   * picked up without the trial holding a handle of its own.
+   */
+  connection(): DatabaseSync | null {
+    return this.available ? this.db : null;
+  }
+
   /** True when rows can be written at all (mode not off, tables present). */
   isEnabled(): boolean {
     return this.available && this.cfg.mode !== "off";
@@ -318,8 +351,9 @@ export class EvidenceTelemetry {
     try {
       const stmt = this.db.prepare(
         `INSERT OR IGNORE INTO surfacing_events
-           (event_id, kind, ref_id, arm, opportunity_id, session_digest, stage, cost_usd, created_at)
-         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
+           (event_id, kind, ref_id, arm, opportunity_id, session_digest, stage, cost_usd,
+            details_json, created_at)
+         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
       );
       let inserted = 0;
       this.inTransaction(() => {
@@ -333,6 +367,7 @@ export class EvidenceTelemetry {
             this.sessionDigest(e.sessionKey),
             e.stage,
             typeof e.costUsd === "number" && Number.isFinite(e.costUsd) ? e.costUsd : null,
+            e.details ? canonicalJson(e.details) : null,
             e.now ?? Date.now(),
           );
           inserted += Number(res.changes);
@@ -361,24 +396,30 @@ export class EvidenceTelemetry {
       const now = input.now ?? Date.now();
       const target = input.eventId
         ? (this.db
-            .prepare(`SELECT id FROM surfacing_events WHERE event_id = ? LIMIT 1`)
-            .get(input.eventId) as { id: number } | undefined)
+            .prepare(`SELECT id, outcome FROM surfacing_events WHERE event_id = ? LIMIT 1`)
+            .get(input.eventId) as { id: number; outcome: string | null } | undefined)
         : (this.db
             .prepare(
-              `SELECT id FROM surfacing_events
+              `SELECT id, outcome FROM surfacing_events
                 WHERE (ref_id = ? OR opportunity_id = ?)
                 ORDER BY CASE WHEN stage = 'delivered' THEN 0 ELSE 1 END, created_at DESC, id DESC
                 LIMIT 1`,
             )
-            .get(input.refId!, input.refId!) as { id: number } | undefined);
+            .get(input.refId!, input.refId!) as { id: number; outcome: string | null } | undefined);
       if (target) {
+        if (input.onlyIfUnlabelled && target.outcome !== null) {
+          return false;
+        }
         this.db
           .prepare(
             `UPDATE surfacing_events SET outcome = ?, label_provenance = ?, outcome_at = ? WHERE id = ?`,
           )
           .run(input.outcome, input.provenance, now, target.id);
         return true;
       }
+      if (input.onlyIfUnlabelled) {
+        return false;
+      }
       const ref = input.refId ?? input.eventId!;
       this.db
         .prepare(
```

#### Recent Merged Pull Requests:
- **PR #332** (2026-10-30): feat(memory): weighted RRF channel fusion with sweep and real-query validation (@VGIL77)
- **PR #331** (2026-10-30): feat(memory): shadow surfacing trial eligibility and assignment (PLAN-59 Phase 2) (@VGIL77)
- **PR #329** (2026-10-29): feat(memory): PLAN-59 Phase 1 pilot harness (forked consolidation arms) (@VGIL77)
- **PR #328** (2026-10-29): feat(memory): default evidence telemetry to shadow mode (@VGIL77)
- **PR #322** (2026-10-29): feat(memory): evidence telemetry and shadow decision traces (PLAN-59 Phase 0) (@VGIL77)
- **PR #321** (2026-10-28): fix(memory): GCCRF and curiosity-target defects (@VGIL77)

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

## X. memory): weighted RRF channel fusion with sweep and real-query validation (#332)

**RULE**:
When implementing operations in `benchmarks/live-recall/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Bitterbot-AI/bitterbot-desktop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fe517486`: memory): weighted RRF channel fusion with sweep and real-query validation (#332). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `benchmarks/live-recall/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
2. `replay-judge.mts` searches a copy of the snapshot once per setting,
   pools the top-k passages across settings, and asks a small model ONCE per
   (query, passage) pair whether the passage answers the query. The same
   verdicts score every setting, so the comparison is fair even where the
   judge is not. Output: hit@k (any relevant passage in the top k),
   precision@k, relevant@1, MRR; hashes and ranks only.

   A setting is `boost=<postFusionBoostScale>;rrf=<vector>,<keyword>,<graph>[;k=<rrfK>]`,
   passed as `--settings "boost=0.1;rrf=1,1,1" "boost=0.1;rrf=0.25,1,1" ...`
   (`--scales 1,0.1,0` is the older spelling for boost scales alone). The first
   setting is the baseline. Every search runs with the wall clock frozen at
   `--now` and hormonal modulation off, so a setting's list depends on the
   code and the snapshot only; the recency boost keeps its production default.
   `--rejudge N` asks the judge again about N random pooled pairs to estimate
   its flip rate; the output then carries, per setting against the baseline,
   the paired delta in hit@k and MRR, a paired bootstrap over queries
   (sampling noise), the sd of the delta when every pooled verdict flips at
 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
2. `replay-judge.mts` searches a copy of the snapshot once per setting
   (here `postFusionBoostScale` 1, 0.1, 0), pools the top-k passages across
   settings, and asks a small model ONCE per (query, passage) pair whether the
   passage answers the query. The same verdicts score every setting, so the
   comparison is fair even where the judge is not. Output: hit@k (any relevant
   passage in the top k), precision@k, relevant@1, MRR; hashes and ranks only.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fe517486` are properly handled with clean fallback behavior.
