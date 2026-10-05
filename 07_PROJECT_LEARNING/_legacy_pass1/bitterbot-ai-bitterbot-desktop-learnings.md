# Forensic Learning Record (Deep Inspection): Bitterbot-AI/bitterbot-desktop

> **Canonical Artifact**: `07_PROJECT_LEARNING/bitterbot-ai-bitterbot-desktop-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:16:04.263Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Bitterbot-AI/bitterbot-desktop`
- **Description**: Bitterbot - a mesh of agents that turns shared experience into collective capability.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2464 stars

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

### Core Architecture Module: `desktop/renderer/src/App.tsx`
```
import { useCallback, useEffect, useState } from "react";
import { FirstRun } from "./components/first-run/FirstRun";
import { AppShell } from "./components/layout/AppShell";
import { Toaster } from "./components/ui/sonner";
import { initDeepLinkJoin } from "./lib/deep-link";
import { fetchSessionToken, persistGatewayCredentials } from "./lib/gateway-origin";
import {
  readStoredGatewayToken,
  readStoredGatewayUrl,
  useGatewayStore,
} from "./stores/gateway-store";

export function App() {
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

### Core Architecture Module: `desktop/renderer/src/components/channels/ChannelsView.tsx`
```
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { describeError } from "../../lib/describe-error";
import { formatRelativeTime } from "../../lib/format";
import { cn } from "../../lib/utils";
import { useChannelsStore } from "../../stores/channels-store";
import { useGatewayStore } from "../../stores/gateway-store";
import { useConfirm } from "../ui/confirm-dialog";
import { Switch } from "../ui/switch";
import { CHANNEL_SETUP_DESCRIPTORS } from "./channel-setup-fields";
import { ChannelSetupDrawer } from "./ChannelSetupDrawer";

type ChannelAccount = {
  accountId: string;
  configured: boolean;
  enabled?: boolean;
  connected?: boolean;
  loggedIn?: boolean;
  status?: string;
  lastInboundAt?: number;
  lastOutboundAt?: number;
  [key: string]: unknown;
};

type ChannelCapability = {
  supported: boolean;
  reason?: string;
  platforms?: string[];
};

type ChannelData = {
  channelId: string;
  label: string;
  accounts: ChannelAccount[];
  summary?: Record<string, unknown>;
  capability?: ChannelCapability;
};

function ChannelCard({
  channel,
  canToggle,
  canConfigure,
  togglingKey,
  onToggle,
  onLogout,
  onSetup,
}: {
  channel: ChannelData;
  canToggle: boolean;
  canConfigure: boolean;
  togglingKey: string | null;
  onToggle: (channelId: string, accountId: string, enabled: boolean) => void;
  onLogout: (channelId: string, accountId: string, channelLabel: string) => void;
  onSetup: (channelId: string, accountId?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const primaryAccount = channel.accounts[0];
  const isConnected = primaryAccount?.connected || primaryAccount?.loggedIn;
  const unsupported = channel.capability?.supported === false;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm overflow-hidden",
        unsupported && "opacity-60",
      )}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className={cn(
            "w-2 h-2 rounded-full flex-shrink-0",
            isConnected
              ? "bg-success"
              : primaryAccount?.configured
                ? "bg-warning"
                : "bg-muted-foreground/30",
          )}
        />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground">{channel.label}</span>
        </div>
        {unsupported ? (
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            title={channel.capability?.reason}
          >
            unavailable on this host
          </span>
        ) : (
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              isConnected
                ? "bg-success/10 text-success"
                : primaryAccount?.configured
                  ? "bg-warning/10 text-warning"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {isConnected
              ? "connected"
              : primaryAccount?.configured
                ? "configured"
                : "not configured"}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div className="px-4 pb-3 border-t border-border/10 pt-3 space-y-3">
          {unsupported && channel.capability?.reason && (
            <p className="text-xs text-muted-foreground">{channel.capability.reason}</p>
          )}
          {canConfigure && !unsupported && CHANNEL_SETUP_DESCRIPTORS[channel.channelId] && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetup(channel.channelId, primaryAccount?.accountId);
              }}
              className="px-2 py-1 text-xs rounded bg-brand/10 text-brand hover:bg-brand/30 border border-brand/20"
            >
              {primaryAccount?.configured ? "Edit setup" : "Set up"}
            </button>
          )}
          {channel.accounts.map((account) => {
            const toggleKey = `${channel.channelId}:${account.accountId}`;
            return (
              <div key={account.accountId} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    {account.accountId}
                  </span>
                  {account.enabled === false && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-danger/10 text-danger">
                      disabled
                    </span>
                  )}
                  {canToggle && !unsupported && (
                    <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={account.enabled !== false}
                        disabled={togglingKey === toggleKey}
                        onCheckedChange={(checked) =>
                          onToggle(channel.channelId, account.accountId, checked)
                        }
                        aria-label={`${account.enabled !== false ? "Disable" : "Enable"} ${channel.label} ${account.accountId}`}
                      />
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {account.lastInboundAt && (
                    <div>
                      <span className="text-muted-foreground">Last inbound: </span>
                      <span className="text-foreground">
                        {formatRelativeTime(account.lastInboundAt)}
                      </span>
                    </div>
                  )}
                  {account.lastOutboundAt && (
                    <div>
                      <span className="text-muted-foreground">Last outbound: </span>
                      <span className="text-foreground">
                        {formatRelativeTime(account.lastOutboundAt)}
                      </span>
                    </div>
                  )}
                </div>
                {(account.connected || account.loggedIn) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLogout(channel.channelId, account.accountId, channel.label);
                    }}
                    className="px-2 py-1 text-xs rounded bg-danger/10 text-danger hover:bg-danger/30 border border-danger/20"
                  >
                    Logout
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ChannelsView() {
  const [confirmDialog, confirmElement] = useConfirm();
  const gwStatus = useGatewayStore((s) => s.status);
  const request = useGatewayStore((s) => s.request);
  const hello = useGatewayStore((s) => s.hello);
  const loading = useChannelsStore((s) => s.loading);
  const setLoading = useChannelsStore((s) => s.setLoading);
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [setupTarget, setSetupTarget] = useState<{
    channelId: string;
    label: string;
    accountId?: string;
  } | null>(null);

  // Version skew: older gateways don't implement channels.update; hide the
  // switches instead of rendering controls that error.
  const methods = hello?.features?.methods;
  const canToggle = methods ? methods.includes("channels.update") : true;
  const canConfigure = methods ? methods.includes("channels.configure") : true;

  const refresh = useCallback(
    async (probe = false) => {
      if (gwStatus !== "connected") return;
      setLoading(true);
      try {
        const res = (await request("channels.status", { probe })) as {
          channelOrder?: string[];
          channelLabels?: Record<string, string>;
          channelAccounts?: Record<string, ChannelAccount[]>;
          channelCapabilities?: Record<string, ChannelCapability>;
          channels?: Record<string, unknown>;
        };
        const order = res.channelOrder ?? Object.keys(res.channels ?? {});
        const labels = res.channelLabels ?? {};
        const accounts = res.channelAccounts ?? {};
        const capabilities = res.channelCapabilities ?? {};
        const channelSummaries = (res.channels ?? {}) as Record<string, Record<string, unknown>>;

        const parsed: ChannelData[] = order.map((id) => ({
          channelId: id,
          label: labels[id] ?? id,
          accounts: accounts[id] ?? [],
          summary: channelSummaries[id],
          capability: capabilities[id],
        }));
        setChannels(parsed);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load channels");
      } finally {
        setLoading(false);
      }
    },
    [gwStatus, request, setLoading],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleLogout = useCallback(
    async (channelId: string, accountId: string, channelLabel: string) => {
      if (
        !(await confirmDialog({
          title: `Logout ${channelLabel} account "${accountId}"?`,
          actionLabel: "Logout",
          destructive: true,
        }))
      )
        return;
      try {
        await request("channels.logout", { channel: channelId, accountId });
        refresh();
      } catch (err) {
        toast.error("Logout failed", {
          description: describeError(err),
        });
      }
    },
    [request, refresh, confirmDialog],
  );

  const handleToggle = useCallback(
    async (channelId: string, accountId: string, enabled:
```

### Core Architecture Module: `desktop/renderer/src/components/channels/QrPairingDialog.tsx`
```
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useGatewayStore } from "../../stores/gateway-store";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

interface QrPairingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  label: string;
  accountId?: string;
  onLinked?: () => void;
}

type Phase = "starting" | "scan" | "waiting" | "linked" | "error";

/**
 * QR device-link dialog for QR-capable channels (WhatsApp, Signal).
 * web.login.start {channel} returns the QR as a data URL; web.login.wait
 * blocks until the phone scans it and the gateway brings the channel up.
 */
export function QrPairingDialog({
  open,
  onOpenChange,
  channelId,
  label,
  accountId,
  onLinked,
}: QrPairingDialogProps) {
  const request = useGatewayStore((s) => s.request);
  const [phase, setPhase] = useState<Phase>("starting");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const runRef = useRef(0);
  // Callback props live in refs so parent re-renders (e.g. the refresh that
  // onLinked itself triggers) can NEVER re-fire the flow effect: a restarted
  // flow calls web.login.start, which stops the channel that just linked.
  const onLinkedRef = useRef(onLinked);
  onLinkedRef.current = onLinked;

  const runFlow = useCallback(async () => {
    const run = ++runRef.current;
    setPhase("starting");
    setQrDataUrl(null);
    setMessage("");
    try {
      const start = await request<{ qrDataUrl?: string; message?: string }>(
        "web.login.start",
        { channel: channelId, ...(accountId ? { accountId } : {}) },
        { timeoutMs: 60_000 },
      );
      if (run !== runRef.current) return;
      if (!start?.qrDataUrl) {
        setPhase("error");
        setMessage(start?.message ?? "The gateway did not return a QR code.");
        return;
      }
      setQrDataUrl(start.qrDataUrl);
      setMessage(start.message ?? "Scan the QR with your phone.");
      setPhase("scan");

      const wait = await request<{ connected?: boolean; message?: string }>(
        "web.login.wait",
        { channel: channelId, ...(accountId ? { accountId } : {}), timeoutMs: 120_000 },
        { timeoutMs: 150_000 },
      );
      if (run !== runRef.current) return;
      if (wait?.connected) {
        setPhase("linked");
        setMessage(wait.message ?? "Linked.");
        toast.success(`${label} linked`, { description: wait.message });
        onLinkedRef.current?.();
      } else {
        setPhase("error");
        setMessage(wait?.message ?? "Linking did not complete.");
      }
    } catch (err) {
      if (run !== runRef.current) return;
      setPhase("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }, [channelId, accountId, label, request]);

  useEffect(() => {
    if (!open) {
      // Invalidate any in-flight run so a stale response can't mutate state.
      runRef.current += 1;
      return;
    }
    void runFlow();
    // runFlow's deps are stable for a given target (channelId/accountId);
    // the flow starts once per open, not once per parent render.
  }, [open, runFlow]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Link {label}</DialogTitle>
          <DialogDescription>
            {channelId === "signal"
              ? "Signal → Settings → Linked Devices → Link New Device."
              : "WhatsApp → Settings → Linked Devices → Link a Device."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          {phase === "starting" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Generating QR…
            </div>
          )}
          {qrDataUrl && phase !== "error" && (
            <img
              src={qrDataUrl}
              alt={`${label} pairing QR code`}
              className="w-56 h-56 rounded-md bg-white p-2"
            />
          )}
          {phase === "scan" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Waiting for scan…
            </div>
          )}
          {phase === "linked" && <p className="text-sm text-success">{message}</p>}
          {phase === "error" && (
            <div className="space-y-2 text-center">
              <p className="text-sm text-danger">{message}</p>
              <button
                onClick={() => void runFlow()}
                className="text-xs px-2 py-1 rounded border border-border hover:bg-muted/90"
              >
                Try again
              </button>
            </div>
          )}
          {phase === "scan" && message && (
            <p className="text-xs text-muted-foreground text-center">{message}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

```

### Core Architecture Module: `desktop/renderer/src/components/channels/channel-setup-fields.ts`
```
/**
 * Guided-setup field descriptors per channel. Keys are ChannelSetupInput
 * fields understood by each channel's setup.applyAccountConfig on the
 * gateway. Channels absent from this map fall back to the Config tab.
 */
export interface SetupField {
  key: string;
  label: string;
  help?: string;
  placeholder?: string;
  sensitive?: boolean;
  optional?: boolean;
}

export interface ChannelSetupDescriptor {
  fields: SetupField[];
  /** True when the channel links via QR instead of (or in addition to) tokens. */
  qrLogin?: boolean;
  docsHint?: string;
}

export const CHANNEL_SETUP_DESCRIPTORS: Record<string, ChannelSetupDescriptor> = {
  telegram: {
    fields: [
      {
        key: "botToken",
        label: "Bot token",
        help: "Create a bot with @BotFather in Telegram and paste its token.",
        placeholder: "123456:ABC-DEF...",
        sensitive: true,
      },
    ],
  },
  discord: {
    fields: [
      {
        key: "token",
        label: "Bot token",
        help: "Discord Developer Portal → your application → Bot → Reset Token.",
        placeholder: "MTA...",
        sensitive: true,
      },
    ],
  },
  slack: {
    fields: [
      {
        key: "botToken",
        label: "Bot token",
        help: "Slack app → OAuth & Permissions → Bot User OAuth Token.",
        placeholder: "xoxb-...",
        sensitive: true,
      },
      {
        key: "appToken",
        label: "App token",
        help: "Slack app → Basic Information → App-Level Tokens (Socket Mode, connections:write).",
        placeholder: "xapp-...",
        sensitive: true,
      },
    ],
  },
  signal: {
    qrLogin: true,
    fields: [
      {
        key: "signalNumber",
        label: "Phone number",
        help: "The Signal account number in E.164 format. Link the device via QR first if this gateway is a new linked device.",
        placeholder: "+15551234567",
      },
      {
        key: "cliPath",
        label: "signal-cli path",
        help: "Leave blank when signal-cli is on PATH.",
        placeholder: "signal-cli",
        optional: true,
      },
      {
        key: "httpUrl",
        label: "External daemon URL",
        help: "Optional: URL of an already-running signal-cli HTTP daemon.",
        placeholder: "http://127.0.0.1:8080",
        optional: true,
      },
    ],
  },
  whatsapp: {
    qrLogin: true,
    fields: [],
    docsHint: "WhatsApp links by scanning a QR from the phone - no tokens needed.",
  },
};

```

### Core Architecture Module: `desktop/renderer/src/components/chat/ActivityPanel.tsx`
```
import { Activity, Check, Clock, ShieldAlert, X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "../../lib/utils";
import { type ReviewAction, type ReviewStatus, useReviewStore } from "../../stores/review-store";

/**
 * What the agent asked to do on the owner's behalf and what came of it
 * (PLAN-53 B5). One list, newest first, from the review store.
 */
export function ActivityPanel() {
  const history = useReviewStore((s) => s.history);
  const loaded = useReviewStore((s) => s.loaded);
  const unsupported = useReviewStore((s) => s.unsupported);
  const listen = useReviewStore((s) => s.listen);

  useEffect(() => listen(), [listen]);

  if (unsupported) {
    return (
      <Empty text="This gateway build does not record reviewed actions yet. Update the gateway." />
    );
  }
  if (loaded && history.length === 0) {
    return <Empty text="Nothing has needed your approval yet." />;
  }
  return (
    <div className="flex-1 overflow-auto">
      <ul className="divide-y divide-border/30">
        {history.map((action) => (
          <ActivityRow key={action.id} action={action} />
        ))}
      </ul>
    </div>
  );
}

const STATUS: Record<ReviewStatus, { label: string; tone: string; icon: typeof Check }> = {
  pending: { label: "Waiting", tone: "text-warning", icon: ShieldAlert },
  approved: { label: "Approved", tone: "text-success", icon: Check },
  executed: { label: "Done", tone: "text-success", icon: Check },
  failed: { label: "Failed", tone: "text-danger", icon: X },
  denied: { label: "Denied", tone: "text-danger", icon: X },
  expired: { label: "Expired", tone: "text-muted-foreground", icon: Clock },
};

function ActivityRow({ action }: { action: ReviewAction }) {
  const meta = STATUS[action.status];
  const Icon = meta.icon;
  const when = new Date(action.decidedAt ?? action.createdAt).toLocaleString();
  return (
    <li className="px-3 py-2" data-testid="activity-row">
      <div className="flex items-start gap-2">
        <Icon className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0", meta.tone)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("text-badge font-medium uppercase tracking-wide", meta.tone)}>
              {meta.label}
            </span>
            <span className="text-2xs text-muted-foreground">
              {action.cls === "spend" ? "spend" : "post"} · {action.id}
            </span>
          </div>
          <p className="text-xs text-foreground break-words">{action.preview}</p>
          <p className="text-2xs text-muted-foreground">
            {when}
            {action.decidedBy ? ` · by ${action.decidedBy}` : ""}
          </p>
          {action.resultSummary && (
            <p className="text-2xs text-muted-foreground font-mono break-words mt-0.5 line-clamp-3">
              {action.resultSummary}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-2 text-muted-foreground px-6">
        <Activity className="w-8 h-8 mx-auto opacity-50" />
        <p className="text-sm">{text}</p>
      </div>
    </div>
  );
}

```

### Core Architecture Module: `desktop/renderer/src/components/chat/ArtifactChip.tsx`
```
import { Code, Image, BarChart3, GitBranch, FileCode } from "lucide-react";
import { useCallback } from "react";
import { cn } from "../../lib/utils";
import { useArtifactStore, type Artifact } from "../../stores/artifact-store";
import { useUIStore } from "../../stores/ui-store";

interface ArtifactChipProps {
  artifactId: string;
}

function getArtifactIcon(type: string) {
  switch (type) {
    case "react":
      return Code;
    case "svg":
      return Image;
    case "mermaid":
      return GitBranch;
    case "javascript":
      return FileCode;
    default:
      return BarChart3;
  }
}

/**
 * Inline chip displayed in chat messages when an artifact is created or updated.
 * Clicking it opens the artifact in the right panel.
 */
export function ArtifactChip({ artifactId }: ArtifactChipProps) {
  const artifact = useArtifactStore((s) => s.artifacts.get(artifactId));
  const openArtifact = useArtifactStore((s) => s.openArtifact);
  const setToolPanelOpen = useUIStore((s) => s.setToolPanelOpen);

  const handleClick = useCallback(() => {
    openArtifact(artifactId);
    setToolPanelOpen(true);
  }, [artifactId, openArtifact, setToolPanelOpen]);

  if (!artifact) return null;

  const Icon = getArtifactIcon(artifact.type);

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-medium",
        "border transition-all cursor-pointer hover:scale-[1.02]",
        "bg-info/5 border-info/20 text-info hover:bg-info/20",
      )}
    >
      <Icon className="w-3 h-3 flex-shrink-0" />
      <span className="truncate max-w-[200px]">{artifact.title}</span>
      <span className="text-muted-foreground/40">|</span>
      <span className="text-muted-foreground/70 text-badge font-normal uppercase">
        {artifact.type}
      </span>
    </button>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #54** (2026-06-07): **Wallet: x402 payment signing fails + send_usdc 'Unsupported network' on Base**
  *Symptoms*: ## Summary  Two wallet bugs discovered during first real-money testing of the economic layer:  ### Bug 1: x402 Payment Signing Fails (402 not resolved)  **Steps to reproduce:** 1. Fund wallet with USDC on Base 2. Enable x402 in config: `tools.wallet.x402.enabled: true` 3. Hit an x402 paywall (e.g. `https://agentsvc.io/api/v1/proxy/exchange-rates`) 4. Call `pay_for_resource` with the resource URL and amount  **Expected:** Wallet signs the USDC payment, attaches X-Payment header, receives content **Actual:** Tool returns the raw 402 response body without completing payment signing  The 402 response includes valid payment details: ```json {   "scheme": "exact",   "network": "base",    "maxAmountRequired": "1000",   "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",   "payTo": "0xC33336EB299d97aa76E61337906A677552878818" } ```  Likely cause: The x402 client library is not properly parsing the 402 response to extract payment params, or the Coinbase facilitator URL is not configured/reachable.  ### Bug 2: send_usdc fails with "Unsupported network for smart wallets: base"  **Steps to reproduce:** 1. Wallet on Base with USDC balance 2. Call `send_usdc` with a valid address and amount  **Expected:** USDC transfer completes on Base **Actual:** Error: `Failed to send USDC: Unsupported network for smart wallets: base`  Note: The wallet successfully *received* USDC on Base (from Kraken), so the address works. Only outbound sends fail.  Likely cause: Coinbase CDP SDK version issue — th
  **Post-Mortem & Fix Analysis**:
  > ## Root Cause Analysis  ### Bug 1: x402 payment signing (stays 402)  **File:** `src/services/wallet-service.ts` — `payForResource()` method (line ~340)  The current implementation does NOT follow the x402 protocol: - It signs a custom JSON blob with `provider.signMessage()` and base64-encodes it as `X-PAYMENT` - **No actual USDC transfer happens on-chain** — it is just a signature, not a payment - The x402 facilitator expects a proper payment authorization, not a self-signed message  **The official x402 flow:** 1. Client GETs the resource → receives 402 with payment requirements 2. Client signs a payment *authorization* using the x402 client SDK 3. Client sends the authorization to a **facilitator** (e.g. `https://x402.org/facilitator`) 4. Facilitator atomically verifies the authorization, executes the USDC transfer, and returns a payment receipt 5. Client retries the original request with the receipt  **Fix options:** - **Option A:** Use `@coinbase/x402` npm package which handles the 
  > **Fixes pushed** on branch `fix/wallet-x402-discovery` (commit `ddacb6b`).  **Bug 2 (`send_usdc` "Unsupported network for smart wallets: base") — FIXED, verified with real funds.** Root cause was exactly as suspected. The config network `"base"` was passed straight to AgentKit's `CdpSmartWalletProvider`, which only accepts `"base-mainnet"` (it maps that to `"base"` internally); `"base"` hit the default case and threw. Fix normalizes `"base"` → `"base-mainnet"` at the provider boundary while keeping the `"base"` alias everywhere else (USDC contracts, account names, funding URLs). Confirmed by sending real USDC on mainnet.  **Bug 1 (x402 payment) — original problems fixed; one deeper limitation remains.** The old `pay_for_resource` never actually paid: it signed a custom JSON blob with `personal_sign`, base64'd it into an `X-PAYMENT` header, and reported success on any 200 — no on-chain transfer. Replaced it with AgentKit's `X402ActionProvider` running the real x402 protocol: pre-flight 
  > **Resolved.** Both bugs are fixed and verified in production on Base mainnet with real USDC.  **Bug 2 (`send_usdc` "Unsupported network for smart wallets: base")** — fixed by normalizing the config network `"base"` to AgentKit's expected `"base-mainnet"` networkId. (commit `ddacb6b`)  **Bug 1 (x402 payment not settling)** — the root cause ran deeper than the original report. The placeholder `personal_sign` flow (which never moved funds) was replaced with the real x402 protocol (commit `ddacb6b`), but settlement still failed because the wallet was a **Coinbase Smart Wallet (ERC-4337)**: x402's "exact" scheme signs an EIP-3009 `TransferWithAuthorization` that USDC settles via `ecrecover`, which a smart-account ERC-1271 signature cannot satisfy.  The fix was to adopt the wallet type Coinbase actually intends for agents: a **CDP Server Wallet (MPC EOA)**, which signs a standard ECDSA authorization and settles x402 natively. The wallet is now a single EOA for receiving, `send_usdc`, and x40

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

### Incident Patch 1: `9e68af49` (2026-10-04)
**Commit Message**: Merge pull request #153 from Bitterbot-AI/fix/web-search-serply-followups

feat(web-search): Serply provider (#152) plus onboarding env-detection fix

**File**: `docs/help/environment.md` (modified, +1/-0)
```diff
@@ -111,6 +111,7 @@ All optional.
 | `PERPLEXITY_API_KEY` | Perplexity                       |
 | `FIRECRAWL_API_KEY`  | Firecrawl                        |
 | `TAVILY_API_KEY`     | Tavily                           |
+| `SERPLY_API_KEY`     | Serply web search                |
 | `ELEVENLABS_API_KEY` | ElevenLabs TTS (or `XI_API_KEY`) |
 | `DEEPGRAM_API_KEY`   | Deepgram STT                     |
 
```

**File**: `docs/network/egress.md` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ below in one step.
 
 ## Everything else is opt-in
 
-Web search (Brave/Tavily/Perplexity/xAI with your key; Parallel Search MCP at
+Web search (Brave/Tavily/Perplexity/xAI/Serply with your key; Parallel Search MCP at
 `search.parallel.ai` keyless and anonymous, so each query reaches Parallel with
 only a Bitterbot User-Agent), Skill Seekers ingestion
 (`skills.skillSeekers.enabled`, default off), channels (WhatsApp, Telegram,
```

**File**: `docs/tools/web-search.md` (modified, +46/-8)
```diff
@@ -1,14 +1,14 @@
 ---
-summary: "Web search provider setup: Tavily, Brave, Perplexity, Grok, Parallel"
+summary: "Web search provider setup: Tavily, Brave, Perplexity, Grok, Serply, Parallel"
 read_when:
   - You want to configure a web search provider
-  - You need API keys for Tavily, Brave, Perplexity, or Grok
+  - You need API keys for Tavily, Brave, Perplexity, Grok, or Serply
 title: "Web Search Providers"
 ---
 
 # Web Search Providers
 
-Bitterbot supports 5 web search providers for the `web_search` tool. Pick one and configure its API key, or explicitly select Parallel for free, keyless search.
+Bitterbot supports 6 web search providers for the `web_search` tool. Pick one and configure its API key, or explicitly select Parallel for free, keyless search.
 
 | Provider       | Env Variable         | Free Tier       | Best For                              |
 | -------------- | -------------------- | --------------- | ------------------------------------- |
@@ -17,10 +17,13 @@ Bitterbot supports 5 web search providers for the `web_search` tool. Pick one an
 | **Perplexity** | `PERPLEXITY_API_KEY` | Pay-per-use     | AI-synthesized answers with citations |
 | **Parallel**   | None                 | Free, keyless   | Web search with source excerpts       |
 | **Grok**       | `XAI_API_KEY`        | Varies          | X/Twitter integration                 |
+| **Serply**     | `SERPLY_API_KEY`     | Trial credits   | Google results, country and freshness |
 
 ## Quick Setup
 
-The fastest path: pick a provider, set the env variable, done.
+The fastest path: export one key before running `bitterbot onboard`, which stores
+the matching provider. On an existing install, also set
+`tools.web.search.provider` (Brave is the default and needs no provider setting).
 
 ```bash
 # Option 1: Tavily (recommended for most users)
@@ -34,6 +37,9 @@ export PERPLEXITY_API_KEY="pplx-..."
 
 # Option 4: Grok
 export XAI_API_KEY="xai-..."
+
+# Option 5: Serply
+export SERPLY_API_KEY="..."
 ```
 
 Or add to your `.env` file in the Bitterbot root / gateway environment.
@@ -144,16 +150,48 @@ Get your key at [perplexity.ai](https://www.perplexity.ai/). Also available via
 
 Uses your `XAI_API_KEY` environment variable.
 
+### Serply
+
+```json5
+{
+  tools: {
+    web: {
+      search: {
+        provider: "serply",
+        maxResults: 5,
+        serply: {
+          apiKey: "...", // or set SERPLY_API_KEY
+        },
+      },
+    },
+  },
+}
+```
+
+Returns Google web results (titles, URLs and snippets) from
+`https://api.serply.io/v1/search`, with the key sent in an `X-Api-Key` header.
+`country` maps to Google's region (`gl`) and `freshness` accepts `pd`, `pw`, `pm`
+and `py`. Date ranges, `search_lang` and `ui_lang` are rejected; put language
+preferences in the query instead. Serply is only used when `provider` is
+`"serply"`. Get a key at [serply.io](https://serply.io)
+([API docs](https://serply.io/docs)); see their site for current trial terms.
+
 ## Auto-Detection
 
-If no provider is explicitly set, Bitterbot checks for API keys in this order:
+At runtime, `web_search` uses the configured `provider`. If none is set it uses
+Brave, so a key for any other provider also needs `provider` set.
+
+Onboarding (`bitterbot onboard`) does this for you. When no provider is
+configured, it checks the environment in this order and stores the first match
+as `tools.web.search.provider`:
 
-1. `TAVILY_API_KEY` → Tavily
-2. `BRAVE_API_KEY` → Brave
+1. `BRAVE_API_KEY` → Brave
+2. `TAVILY_API_KEY` → Tavily
 3. `PERPLEXITY_API_KEY` → Perplexity
 4. `XAI_API_KEY` → Grok
+5. `SERPLY_API_KEY` → Serply
 
-Set the key and it just works.
+Parallel is never selected automatically.
 
 ## See Also
 
```

**File**: `src/agents/tools/web-search-serply.test.ts` (added, +153/-0)
```diff
@@ -0,0 +1,153 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+import { VERSION } from "../../version.js";
+import { __testing, createWebSearchTool, runConfiguredWebSearch } from "./web-search.js";
+
+const config = {
+  tools: {
+    web: { search: { provider: "serply" as const, cacheTtlMinutes: 0, serply: { apiKey: "k" } } },
+  },
+};
+const body = {
+  results: [
+    {
+      title: "Node.js Releases",
+      link: "https://nodejs.org/en/about/previous-releases",
+      description: "Node.js 22 is named Jod.",
+    },
+    { title: "Token", link: "CAESJxoH", description: "not a URL" },
+    { title: "Invalid", link: "javascript:alert(1)", description: "unsafe" },
+    { title: "Second", link: "http://example.com/", description: "plain http" },
+  ],
+};
+const requests: Array<{ url: URL; headers: Headers }> = [];
+let response: () => Response;
+
+beforeEach(() => {
+  requests.length = 0;
+  response = () => Response.json(body);
+  vi.stubEnv("SERPLY_API_KEY", "");
+  vi.stubGlobal(
+    "fetch",
+    vi.fn(async (url: URL | string, init: RequestInit = {}) => {
+      requests.push({ url: new URL(String(url)), headers: new Headers(init.headers) });
+      return response();
+    }),
+  );
+});
+afterEach(() => {
+  vi.unstubAllGlobals();
+  vi.unstubAllEnvs();
+});
+
+describe("keyed Serply web search", () => {
+  it("sends the key in a header, maps filters, and wraps http(s) results only", async () => {
+    const result = await createWebSearchTool({ config })!.execute("serply", {
+      query: "Node.js 22 codename",
+      count: 10,
+      country: "DE",
+      freshness: "pw",
+    });
+    expect(requests).toHaveLength(1);
+    const { url, headers } = requests[0];
+    expect(`${url.origin}${url.pathname}`).toBe("https://api.serply.io/v1/search");
+    expect(Object.fromEntries(url.searchParams)).toEqual({
+      q: "Node.js 22 codename",
+      num: "10",
+      gl: "de",
+      tbs: "qdr:w",
+    });
+    expect(headers.get("X-Api-Key")).toBe("k");
+    expect(headers.get("User-Agent")).toBe(`Bitterbot/${VERSION}`);
+    const details = result.details as {
+      provider: string;
+      count: number;
+      externalContent: { untrusted: boolean };
+      results: Array<{ url: string; description: string; siteName?: string }>;
+    };
+    expect(details).toMatchObject({ provider: "serply", count: 2 });
+    expect(details.externalContent.untrusted).toBe(true);
+    expect(details.results.map((entry) => entry.url)).toEqual([
+      "https://nodejs.org/en/about/previous-releases",
+      "http://example.com/",
+    ]);
+    expect(details.results[0].description).toContain("Node.js 22 is named Jod.");
+    expect(details.results[0].description).not.toBe("Node.js 22 is named Jod.");
+    expect(details.results[0].siteName).toBe("nodejs.org");
+  });
+
+  it("omits gl for ALL and trims results to the requested count", async () => {
+    const result = await createWebSearchTool({ config })!.execute("all", {
+      query: "hello",
+      count: 1,
+      country: "ALL",
+    });
+    expect(requests[0].url.searchParams.has("gl")).toBe(false);
+    expect(requests[0].url.searchParams.get("num")).toBe("1");
+    expect(result.details).toMatchObject({ count: 1 });
+  });
+
+  it("reads SERPLY_API_KEY for configured non-tool callers", async () => {
+    vi.stubEnv("SERPLY_API_KEY", "env-key");
+    const cfg = { tools: { web: { search: { provider: "serply" as const, cacheTtlMinutes: 0 } } } };
+    expect(__testing.resolveSerplyApiKey({})).toBe("env-key");
+    expect(await runConfiguredWebSearch(cfg, "Node.js releases", 1)).toEqual([
+      expect.objectContaining({ url: body.results[0].link }),
+    ]);
+    expect(requests[0].headers.get("X-Api-Key")).toBe("env-key");
+  });
+
+  it("reports a missing key without a request", async () => {
+    const cfg = { tools: { web: { search: { provider: "serply" as const } } } };
+    expect(
+      (await createWebSearchTool({ config: cfg })!.execute("nokey", { query: "hello" })).details,
+    ).toMatchObject({ error: "missing_serply_api_key" });
+    expect(await runConfiguredWebSearch(cfg, "hello")).toBeNull();
+    expect(requests).toHaveLength(0);
+  });
+
+  it.each([
+    [{ search_lang: "de" }, "unsupported_search_filter"],
+    [{ ui_lang: "de" }, "unsupported_search_filter"],
+    [{ freshness: "2026-01-01to2026-02-01" }, "unsupported_freshness"],
+    [{ freshness: "yesterday" }, "invalid_freshness"],
+  ])("rejects %o without a request", async (filter, error) => {
+    const result = await createWebSearchTool({ config })!.execute("filter", {
+      query: "hello",
+      ...filter,
+    });
+    expect(result.details).toMatchObject({ error });
+    expect(requests).toHaveLength(0);
+  });
+
+  it("surfaces API errors with the response detail", async () => {
+    response = () => Response.json({ detail: "Invalid API key" }, { status: 401 });
+    await expect(
+      createWebSearchTool({ config })!.execute("error", { q
```

**File**: `src/agents/tools/web-search-serply.ts` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+import { VERSION } from "../../version.js";
+import { readResponseText } from "./web-shared.js";
+
+const SERPLY_SEARCH_ENDPOINT = "https://api.serply.io/v1/search";
+
+/** Serply forwards Google's `tbs` time filter; only the relative windows map. */
+const SERPLY_FRESHNESS_TBS: Record<string, string> = {
+  pd: "qdr:d",
+  pw: "qdr:w",
+  pm: "qdr:m",
+  py: "qdr:y",
+};
+
+export type SerplySearchResult = {
+  title: string;
+  url: string;
+  description: string;
+};
+
+export function serplySupportsFreshness(freshness: string): boolean {
+  return freshness in SERPLY_FRESHNESS_TBS;
+}
+
+/** Keyed Google web results from Serply's REST API (one results page per call). */
+export async function runSerplySearch(params: {
+  query: string;
+  apiKey: string;
+  count: number;
+  timeoutSeconds: number;
+  country?: string;
+  freshness?: string;
+  signal?: AbortSignal;
+}): Promise<SerplySearchResult[]> {
+  const deadline = AbortSignal.timeout(params.timeoutSeconds * 1000);
+  const signal = params.signal ? AbortSignal.any([params.signal, deadline]) : deadline;
+  signal.throwIfAborted();
+
+  const url = new URL(SERPLY_SEARCH_ENDPOINT);
+  url.searchParams.set("q", params.query);
+  url.searchParams.set("num", String(params.count));
+  const country = params.country?.trim().toLowerCase();
+  if (country && country !== "all") {
+    url.searchParams.set("gl", country);
+  }
+  const tbs = params.freshness ? SERPLY_FRESHNESS_TBS[params.freshness] : undefined;
+  if (tbs) {
+    url.searchParams.set("tbs", tbs);
+  }
+
+  const res = await fetch(url.toString(), {
+    method: "GET",
+    headers: {
+      Accept: "application/json",
+      "X-Api-Key": params.apiKey,
+      "User-Agent": `Bitterbot/${VERSION}`,
+    },
+    signal,
+  });
+
+  if (!res.ok) {
+    const detailResult = await readResponseText(res, { maxBytes: 64_000 });
+    const detail = detailResult.text;
+    throw new Error(`Serply API error (${res.status}): ${detail || res.statusText}`);
+  }
+
+  const data: unknown = await res.json();
+  if (!data || typeof data !== "object" || !("results" in data) || !Array.isArray(data.results)) {
+    throw new Error("Serply returned an invalid search response.");
+  }
+  return data.results
+    .flatMap((entry: unknown) => {
+      if (
+        !entry ||
+        typeof entry !== "object" ||
+        !("link" in entry) ||
+        typeof entry.link !== "string"
+      ) {
+        return [];
+      }
+      try {
+        const link = new URL(entry.link);
+        if (link.protocol !== "https:" && link.protocol !== "http:") return [];
+      } catch {
+        return [];
+      }
+      return [
+        {
+          url: entry.link,
+          title: "title" in entry && typeof entry.title === "string" ? entry.title : "",
+          description:
+            "description" in entry && typeof entry.description === "string"
+              ? entry.description
+              : "",
+        },
+      ];
+    })
+    .slice(0, params.count);
+}
```

**File**: `src/agents/tools/web-search.ts` (modified, +79/-11)
```diff
@@ -9,6 +9,7 @@ import { withOpenRouterAttribution } from "../openrouter-attribution.js";
 import type { AnyAgentTool } from "./common.js";
 import { jsonResult, readNumberParam, readStringParam } from "./common.js";
 import { runParallelSearch } from "./web-search-parallel.js";
+import { runSerplySearch, serplySupportsFreshness } from "./web-search-serply.js";
 import {
   CacheEntry,
   DEFAULT_CACHE_TTL_MINUTES,
@@ -22,7 +23,7 @@ import {
   writeCache,
 } from "./web-shared.js";
 
-const SEARCH_PROVIDERS = ["brave", "perplexity", "grok", "tavily", "parallel"] as const;
+const SEARCH_PROVIDERS = ["brave", "perplexity", "grok", "tavily", "parallel", "serply"] as const;
 const DEFAULT_SEARCH_COUNT = 5;
 const MAX_SEARCH_COUNT = 10;
 
@@ -71,7 +72,7 @@ const WebSearchSchema = Type.Object({
   freshness: Type.Optional(
     Type.String({
       description:
-        "Filter results by discovery time. Brave supports 'pd', 'pw', 'pm', 'py', and date range 'YYYY-MM-DDtoYYYY-MM-DD'. Perplexity supports 'pd', 'pw', 'pm', and 'py'.",
+        "Filter results by discovery time. Brave supports 'pd', 'pw', 'pm', 'py', and date range 'YYYY-MM-DDtoYYYY-MM-DD'. Perplexity and Serply support 'pd', 'pw', 'pm', and 'py'.",
     }),
   ),
 });
@@ -150,6 +151,10 @@ type TavilySearchResponse = {
   results?: TavilySearchResult[];
 };
 
+type SerplyConfig = {
+  apiKey?: string;
+};
+
 type PerplexitySearchResponse = {
   choices?: Array<{
     message?: {
@@ -238,6 +243,14 @@ function missingSearchKeyPayload(provider: (typeof SEARCH_PROVIDERS)[number]) {
       docs: "https://docs.bitterbot.ai/tools/web",
     };
   }
+  if (provider === "serply") {
+    return {
+      error: "missing_serply_api_key",
+      message:
+        "web_search (serply) needs a Serply API key. Set SERPLY_API_KEY in the Gateway environment, or configure tools.web.search.serply.apiKey.",
+      docs: "https://docs.bitterbot.ai/tools/web",
+    };
+  }
   return {
     error: "missing_brave_api_key",
     message: `web_search needs a Brave Search API key. Run \`${formatCliCommand("bitterbot configure --section web")}\` to store it, or set BRAVE_API_KEY in the Gateway environment.`,
@@ -262,6 +275,9 @@ function resolveSearchProvider(search?: WebSearchConfig): (typeof SEARCH_PROVIDE
   if (raw === "tavily") {
     return "tavily";
   }
+  if (raw === "serply") {
+    return "serply";
+  }
   if (raw === "brave") {
     return "brave";
   }
@@ -416,6 +432,26 @@ function resolveTavilyApiKey(tavily?: TavilyConfig): string | undefined {
   return fromEnv || undefined;
 }
 
+function resolveSerplyConfig(search?: WebSearchConfig): SerplyConfig {
+  if (!search || typeof search !== "object") {
+    return {};
+  }
+  const serply = "serply" in search ? search.serply : undefined;
+  if (!serply || typeof serply !== "object") {
+    return {};
+  }
+  return serply as SerplyConfig;
+}
+
+function resolveSerplyApiKey(serply?: SerplyConfig): string | undefined {
+  const fromConfig = normalizeApiKey(serply?.apiKey);
+  if (fromConfig) {
+    return fromConfig;
+  }
+  const fromEnv = normalizeApiKey(process.env.SERPLY_API_KEY);
+  return fromEnv || undefined;
+}
+
 function resolveTavilySearchDepth(tavily?: TavilyConfig): string {
   const fromConfig =
     tavily && "searchDepth" in tavily && typeof tavily.searchDepth === "string"
@@ -709,7 +745,7 @@ async function runWebSearch(params: {
 }): Promise<Record<string, unknown>> {
   params.signal?.throwIfAborted();
   const cacheKey = normalizeCacheKey(
-    params.provider === "brave" || params.provider === "parallel"
+    params.provider === "brave" || params.provider === "parallel" || params.provider === "serply"
       ? `${params.provider}:${params.query}:${params.count}:${params.country || "default"}:${params.search_lang || "default"}:${params.ui_lang || "default"}:${params.freshness || "default"}`
       : params.provider === "perplexity"
         ? `${params.provider}:${params.query}:${params.perplexityBaseUrl ?? DEFAULT_PERPLEXITY_BASE_URL}:${params.perplexityModel ?? DEFAULT_PERPLEXITY_MODEL}:${params.freshness || "default"}`
@@ -724,8 +760,11 @@ async function runWebSearch(params: {
 
   const start = Date.now();
 
-  if (params.provider === "parallel") {
-    const results = await runParallelSearch(params);
+  if (params.provider === "parallel" || params.provider === "serply") {
+    const results =
+      params.provider === "serply"
+        ? await runSerplySearch(params)
+        : await runParallelSearch(params);
     const mapped = results.map((entry) => ({
       title: entry.title ? wrapWebContent(entry.title, "web_search") : "",
       url: entry.url,
@@ -929,6 +968,7 @@ export function createWebSearchTool(options?: {
   const perplexityConfig = resolvePerplexityConfig(search);
   const grokConfig = resolveGrokConfig(search);
   const tavilyConfig = resolveTavilyConfig(search);
+  const serplyConfig = resolveSerplyConfig(search);
 
   const description =
     provider === "parallel"
@@ -939,7 +9
```

**File**: `src/commands/configure.wizard.ts` (modified, +8/-2)
```diff
@@ -127,7 +127,7 @@ async function promptChannelMode(runtime: RuntimeEnv): Promise<ChannelsWizardMod
   ) as ChannelsWizardMode;
 }
 
-type SearchProviderChoice = "brave" | "perplexity" | "grok" | "tavily" | "parallel";
+type SearchProviderChoice = "brave" | "perplexity" | "grok" | "tavily" | "parallel" | "serply";
 
 const SEARCH_PROVIDER_META: Record<
   SearchProviderChoice,
@@ -163,6 +163,12 @@ const SEARCH_PROVIDER_META: Record<
     envVar: "TAVILY_API_KEY",
     keyPlaceholder: "tvly-...",
   },
+  serply: {
+    label: "Serply",
+    hint: "Uses SERPLY_API_KEY",
+    envVar: "SERPLY_API_KEY",
+    keyPlaceholder: "",
+  },
 };
 
 async function promptWebToolsConfig(
@@ -176,7 +182,7 @@ async function promptWebToolsConfig(
   note(
     [
       "Web search lets your agent look things up online using the `web_search` tool.",
-      "Supported providers: Brave Search, Perplexity, Grok (xAI), Tavily, and Parallel (keyless).",
+      "Supported providers: Brave Search, Perplexity, Grok (xAI), Tavily, Serply, and Parallel (keyless).",
       "Docs: https://docs.bitterbot.ai/tools/web",
     ].join("\n"),
     "Web search",
```

**File**: `src/commands/doctor-web-search.ts` (modified, +6/-4)
```diff
@@ -8,7 +8,7 @@
  *
  * What we check (config-only, no network):
  *   1. `tools.web.search` block is present and not disabled
- *   2. A provider is selected (brave / perplexity / grok / tavily)
+ *   2. A provider is selected (brave / perplexity / grok / tavily / serply)
  *   3. A key is reachable for that provider — either in config or via
  *      the provider's well-known env var
  *
@@ -28,14 +28,15 @@ import {
   info,
 } from "./doctor-check.js";
 
-type SearchProvider = "brave" | "perplexity" | "grok" | "tavily" | "parallel";
+type SearchProvider = "brave" | "perplexity" | "grok" | "tavily" | "parallel" | "serply";
 
 const PROVIDER_ENV_VARS: Record<SearchProvider, readonly string[]> = {
   parallel: [],
   brave: ["BRAVE_API_KEY"],
   perplexity: ["PERPLEXITY_API_KEY"],
   grok: ["XAI_API_KEY", "GROK_API_KEY"],
   tavily: ["TAVILY_API_KEY"],
+  serply: ["SERPLY_API_KEY"],
 };
 
 function envHasKey(provider: SearchProvider): string | null {
@@ -90,9 +91,10 @@ export function runWebSearchChecks(params: { config: BitterbotConfig }): void {
           "No web search provider configured.",
           "  Fix: " +
             formatCliCommand("bitterbot config set tools.web.search.provider brave") +
-            " (or perplexity / grok / tavily)",
+            " (or perplexity / grok / tavily / serply)",
           "  Then either paste a key via `bitterbot configure` or export the",
-          "  provider's env var (BRAVE_API_KEY / PERPLEXITY_API_KEY / XAI_API_KEY / TAVILY_API_KEY).",
+          "  provider's env var (BRAVE_API_KEY / PERPLEXITY_API_KEY / XAI_API_KEY / TAVILY_API_KEY /",
+          "  SERPLY_API_KEY).",
         ].join("\n"),
       ),
     );
```

---

### Incident Patch 2: `8811010d` (2026-10-04)
**Commit Message**: fix(web-search): onboarding stores the provider it detects from the environment

Follow-up to #152. Onboarding reported "already configured" for any search
key found in the environment but wrote nothing, so the runtime still defaulted
to Brave and web_search failed with missing_brave_api_key. It now stores the
detected provider, and an explicit provider only counts its own env var.

Docs: the Auto-Detection section described runtime behaviour that does not
exist; it now describes what onboarding does, in the real order. Serply trial
terms point at the vendor site instead of quoting numbers.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `docs/tools/web-search.md` (modified, +17/-9)
```diff
@@ -21,7 +21,9 @@ Bitterbot supports 6 web search providers for the `web_search` tool. Pick one an
 
 ## Quick Setup
 
-The fastest path: pick a provider, set the env variable, done.
+The fastest path: export one key before running `bitterbot onboard`, which stores
+the matching provider. On an existing install, also set
+`tools.web.search.provider` (Brave is the default and needs no provider setting).
 
 ```bash
 # Option 1: Tavily (recommended for most users)
@@ -36,7 +38,7 @@ export PERPLEXITY_API_KEY="pplx-..."
 # Option 4: Grok
 export XAI_API_KEY="xai-..."
 
-# Option 5: Serply (also set provider: "serply", see below)
+# Option 5: Serply
 export SERPLY_API_KEY="..."
 ```
 
@@ -170,20 +172,26 @@ Returns Google web results (titles, URLs and snippets) from
 `https://api.serply.io/v1/search`, with the key sent in an `X-Api-Key` header.
 `country` maps to Google's region (`gl`) and `freshness` accepts `pd`, `pw`, `pm`
 and `py`. Date ranges, `search_lang` and `ui_lang` are rejected; put language
-preferences in the query instead. Serply is never selected automatically.
-Get a key at [serply.io](https://serply.io) ([API docs](https://serply.io/docs));
-new accounts get 2,500 free credits for 30 days.
+preferences in the query instead. Serply is only used when `provider` is
+`"serply"`. Get a key at [serply.io](https://serply.io)
+([API docs](https://serply.io/docs)); see their site for current trial terms.
 
 ## Auto-Detection
 
-If no provider is explicitly set, Bitterbot checks for API keys in this order:
+At runtime, `web_search` uses the configured `provider`. If none is set it uses
+Brave, so a key for any other provider also needs `provider` set.
 
-1. `TAVILY_API_KEY` → Tavily
-2. `BRAVE_API_KEY` → Brave
+Onboarding (`bitterbot onboard`) does this for you. When no provider is
+configured, it checks the environment in this order and stores the first match
+as `tools.web.search.provider`:
+
+1. `BRAVE_API_KEY` → Brave
+2. `TAVILY_API_KEY` → Tavily
 3. `PERPLEXITY_API_KEY` → Perplexity
 4. `XAI_API_KEY` → Grok
+5. `SERPLY_API_KEY` → Serply
 
-Set the key and it just works.
+Parallel is never selected automatically.
 
 ## See Also
 
```

**File**: `src/memory/skill-seekers-url-finder.ts` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ export interface SkillSeekersUrlFinder {
  * fallback entirely rather than failing loudly.
  *
  * PLAN-34 Phase 2c: generalized beyond Brave. Brave keeps its lean native
- * path; every other configured provider (perplexity/grok/tavily) rides the
+ * path; every other configured provider (perplexity/grok/tavily/parallel/serply) rides the
  * web_search tool's own provider dispatch (same keys, caching, timeouts)
  * via runConfiguredWebSearch, with the same authoritative-result picker.
  */
```

**File**: `src/wizard/onboarding.web-search.test.ts` (modified, +40/-3)
```diff
@@ -10,7 +10,13 @@ function prompter(selectValue = "tavily", textValue = "") {
   } as never;
 }
 
-const ENV_KEYS = ["BRAVE_API_KEY", "TAVILY_API_KEY", "PERPLEXITY_API_KEY", "XAI_API_KEY"];
+const ENV_KEYS = [
+  "BRAVE_API_KEY",
+  "TAVILY_API_KEY",
+  "PERPLEXITY_API_KEY",
+  "XAI_API_KEY",
+  "SERPLY_API_KEY",
+];
 
 describe("setupWebSearchForOnboarding (PLAN-41 D-M)", () => {
   const saved = new Map<string, string | undefined>();
@@ -43,15 +49,46 @@ describe("setupWebSearchForOnboarding (PLAN-41 D-M)", () => {
     expect(mocks.text).not.toHaveBeenCalled();
   });
 
-  it("quickstart with an env key still detects it without prompting", async () => {
+  it("quickstart with an env key stores the detected provider without prompting", async () => {
     clearEnv();
     process.env.TAVILY_API_KEY = "tvly-test";
     const p = prompter();
     const out = await setupWebSearchForOnboarding({ config: {}, flow: "quickstart", prompter: p });
-    expect(out).toEqual({});
+    expect(out).toEqual({ tools: { web: { search: { provider: "tavily" } } } });
     expect((p as { select: ReturnType<typeof vi.fn> }).select).not.toHaveBeenCalled();
   });
 
+  it("an incumbent env key wins over SERPLY_API_KEY", async () => {
+    clearEnv();
+    process.env.BRAVE_API_KEY = "test-existing";
+    process.env.SERPLY_API_KEY = "serply-test";
+    const p = prompter();
+    const out = await setupWebSearchForOnboarding({ config: {}, flow: "quickstart", prompter: p });
+    expect(out.tools?.web?.search?.provider).toBe("brave");
+  });
+
+  it("selects Serply from the environment only when it is the sole search key", async () => {
+    clearEnv();
+    process.env.SERPLY_API_KEY = "serply-test";
+    const p = prompter();
+    const out = await setupWebSearchForOnboarding({ config: {}, flow: "advanced", prompter: p });
+    expect(out.tools?.web?.search?.provider).toBe("serply");
+    expect((p as { select: ReturnType<typeof vi.fn> }).select).not.toHaveBeenCalled();
+  });
+
+  it("does not count another provider's env key for an explicit selection", async () => {
+    clearEnv();
+    process.env.BRAVE_API_KEY = "test-existing";
+    const config = { tools: { web: { search: { provider: "tavily" as const } } } };
+    const p = prompter("serply", "serply-abc");
+    const out = await setupWebSearchForOnboarding({ config, flow: "advanced", prompter: p });
+    expect((p as { select: ReturnType<typeof vi.fn> }).select).toHaveBeenCalled();
+    expect(out.tools?.web?.search?.provider).toBe("serply");
+    const serply = (out.tools?.web?.search as Record<string, { apiKey?: string }> | undefined)
+      ?.serply;
+    expect(serply?.apiKey).toBe("serply-abc");
+  });
+
   it("advanced still walks provider + key", async () => {
     clearEnv();
     const p = prompter("tavily", "tvly-abc");
```

**File**: `src/wizard/onboarding.web-search.ts` (modified, +26/-4)
```diff
@@ -9,9 +9,11 @@
  * This step:
  *   1. Checks if a key is already present (config or env var)
  *   2. If not, asks the user to pick a provider and paste a key
- *   3. On quickstart, auto-detects from env vars and skips if found
+ *   3. On quickstart, auto-detects from env vars, stores the detected
+ *      provider, and skips if found
  *
- * Supported providers: Brave Search, Perplexity, Grok (xAI), Tavily, Serply.
+ * Supported providers: Brave Search, Perplexity, Grok (xAI), Tavily, Serply,
+ * and keyless Parallel.
  */
 
 import type { BitterbotConfig } from "../config/config.js";
@@ -78,9 +80,15 @@ function detectExistingKey(config: BitterbotConfig): {
     return { provider, source: "config" };
   }
 
-  // Check env vars
+  // Check env vars. The runtime never infers a provider from the environment
+  // (an unset provider means Brave), so an explicit selection only counts its
+  // own env var.
+  if (search?.provider) {
+    const envVar = PROVIDERS[provider]?.envVar;
+    return envVar && process.env[envVar]?.trim() ? { provider, source: "env" } : null;
+  }
   for (const [p, meta] of Object.entries(PROVIDERS)) {
-    if (process.env[meta.envVar]?.trim()) {
+    if (meta.envVar && process.env[meta.envVar]?.trim()) {
       return { provider: p as SearchProvider, source: "env" };
     }
   }
@@ -112,6 +120,20 @@ export async function setupWebSearchForOnboarding(params: {
       ].join("\n"),
       "Web search",
     );
+    // Persist a provider detected from the environment; otherwise the runtime
+    // would still default to Brave and the note above would be wrong.
+    if (existing.source === "env" && config.tools?.web?.search?.provider !== existing.provider) {
+      return {
+        ...config,
+        tools: {
+          ...config.tools,
+          web: {
+            ...config.tools?.web,
+            search: { ...config.tools?.web?.search, provider: existing.provider },
+          },
+        },
+      };
+    }
     return config;
   }
 
```

---

### Incident Patch 3: `ae378f87` (2026-10-04)
**Commit Message**: fix(review): drop redundant default type argument in the renderer review store

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `desktop/renderer/src/stores/review-store.ts` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ export const useReviewStore = create<ReviewStore>((set, get) => ({
     const gateway = useGatewayStore.getState();
     set((s) => ({ busy: new Set([...s.busy, id]) }));
     try {
-      const action = await gateway.request<unknown>("review.resolve", { id, decision });
+      const action = await gateway.request("review.resolve", { id, decision });
       if (isAction(action)) {
         set((s) => ({
           pending: s.pending.filter((a) => a.id !== id),
```

---

### Incident Patch 4: `5ee2bb9c` (2026-10-03)
**Commit Message**: Merge pull request #149 from Bitterbot-AI/fix/session-skills-snapshot-dedup

fix(sessions): store each skills snapshot body once, keep a ref per session

**File**: `docs/concepts/session.md` (modified, +1/-0)
```diff
@@ -68,6 +68,7 @@ All session state is **owned by the gateway** (the “master” Bitterbot). UI c
 - The store is a map `sessionKey -> { sessionId, updatedAt, ... }`. Deleting entries is safe; they are recreated on demand.
 - Group entries may include `displayName`, `channel`, `subject`, `room`, and `space` to label sessions in UIs.
 - Session entries include `origin` metadata (label + routing hints) so UIs can explain where a session came from.
+- Each entry pins the skills it was started with as `skillsSnapshot`. The body of that snapshot (the skills prompt and the resolved skill records, about 22 KB and identical across an agent's sessions) is stored once per distinct content in `.../sessions/skills-snapshots/<ref>.json`; the entry keeps `{ ref, skills, version }`. Unreferenced bodies are removed when the store is saved. An index written by an older version (bodies inline) still loads and is converted on its next save.
 - Bitterbot does **not** read legacy Pi/Tau session folders.
 
 ## Session pruning
```

**File**: `src/auto-reply/reply/commands-compact.ts` (modified, +5/-1)
```diff
@@ -6,6 +6,7 @@ import {
 } from "../../agents/embedded.js";
 import type { BitterbotConfig } from "../../config/config.js";
 import {
+  materializeSessionSkillsSnapshot,
   resolveFreshSessionTotalTokens,
   resolveSessionFilePath,
   resolveSessionFilePathOptions,
@@ -93,7 +94,10 @@ export const handleCompactCommand: CommandHandler = async (params) => {
     ),
     workspaceDir: params.workspaceDir,
     config: params.cfg,
-    skillsSnapshot: params.sessionEntry.skillsSnapshot,
+    skillsSnapshot: materializeSessionSkillsSnapshot(
+      params.storePath,
+      params.sessionEntry.skillsSnapshot,
+    ),
     provider: params.provider,
     model: params.model,
     thinkLevel: params.resolvedThinkLevel ?? (await params.resolveDefaultThinkingLevel()),
```

**File**: `src/auto-reply/reply/session-updates.ts` (modified, +24/-10)
```diff
@@ -5,7 +5,12 @@ import type { CapabilityGateContext } from "../../agents/skills/capability-gate.
 import { createCapabilityRuntimeFromMemory } from "../../agents/skills/capability-runtime.js";
 import { ensureSkillsWatcher, getSkillsSnapshotVersion } from "../../agents/skills/refresh.js";
 import type { BitterbotConfig } from "../../config/config.js";
-import { type SessionEntry, updateSessionStore } from "../../config/sessions.js";
+import {
+  materializeSessionSkillsSnapshot,
+  type SessionEntry,
+  type SessionSkillSnapshot,
+  updateSessionStore,
+} from "../../config/sessions.js";
 import { buildChannelSummary } from "../../infra/channel-summary.js";
 import {
   resolveTimezone,
@@ -154,15 +159,19 @@ export async function ensureSkillSnapshot(params: {
   agentId?: string;
 }): Promise<{
   sessionEntry?: SessionEntry;
-  skillsSnapshot?: SessionEntry["skillsSnapshot"];
+  /** The full snapshot for this run (a stored ref is joined with its body here). */
+  skillsSnapshot?: SessionSkillSnapshot;
   systemSent: boolean;
 }> {
   if (process.env.BITTERBOT_TEST_FAST === "1") {
     // In fast unit-test runs we skip filesystem scanning, watchers, and session-store writes.
     // Dedicated skills tests cover snapshot generation behavior.
     return {
       sessionEntry: params.sessionEntry,
-      skillsSnapshot: params.sessionEntry?.skillsSnapshot,
+      skillsSnapshot: materializeSessionSkillsSnapshot(
+        params.storePath,
+        params.sessionEntry?.skillsSnapshot,
+      ),
       systemSent: params.sessionEntry?.systemSent ?? false,
     };
   }
@@ -184,16 +193,21 @@ export async function ensureSkillSnapshot(params: {
   const remoteEligibility = getRemoteSkillEligibility();
   const snapshotVersion = getSkillsSnapshotVersion(workspaceDir);
   ensureSkillsWatcher({ workspaceDir, config: cfg });
+  // The entry may hold a ref to a stored body. Resolve it once; a ref whose
+  // body is gone counts as no snapshot, so the session builds a fresh one.
+  const storedSnapshot = materializeSessionSkillsSnapshot(storePath, nextEntry?.skillsSnapshot);
+  if (nextEntry && nextEntry.skillsSnapshot && !storedSnapshot) {
+    nextEntry = { ...nextEntry, skillsSnapshot: undefined };
+  }
   const shouldRefreshSnapshot =
-    snapshotVersion > 0 && (nextEntry?.skillsSnapshot?.version ?? 0) < snapshotVersion;
+    snapshotVersion > 0 && (storedSnapshot?.version ?? 0) < snapshotVersion;
 
   // PLAN-29 Phase 0.3: load-time capability gate for P2P-ingested skills,
   // on by default. Resolved once per call, and only when a snapshot build
   // can actually happen (gate resolution touches the memory manager). A
   // null runtime (cold start, no memory) degrades to ungated — same
   // behavior as before the gate existed.
-  const willBuildSnapshot =
-    isFirstTurnInSession || shouldRefreshSnapshot || !sessionEntry?.skillsSnapshot;
+  const willBuildSnapshot = isFirstTurnInSession || shouldRefreshSnapshot || !storedSnapshot;
   let capabilityGate: CapabilityGateContext | undefined;
   if (willBuildSnapshot && cfg.skills?.p2p?.loadTimeCapabilityGate !== false) {
     const runtime = await createCapabilityRuntimeFromMemory({
@@ -210,15 +224,15 @@ export async function ensureSkillSnapshot(params: {
         updatedAt: Date.now(),
       };
     const skillSnapshot =
-      isFirstTurnInSession || !current.skillsSnapshot || shouldRefreshSnapshot
+      isFirstTurnInSession || !storedSnapshot || shouldRefreshSnapshot
         ? buildWorkspaceSkillSnapshot(workspaceDir, {
             config: cfg,
             skillFilter,
             eligibility: { remote: remoteEligibility },
             snapshotVersion,
             capabilityGate,
           })
-        : current.skillsSnapshot;
+        : storedSnapshot;
     nextEntry = {
       ...current,
       sessionId: sessionId ?? current.sessionId ?? crypto.randomUUID(),
@@ -235,15 +249,15 @@ export async function ensureSkillSnapshot(params: {
     systemSent = true;
   }
 
-  const skillsSnapshot = shouldRefreshSnapshot
+  const skillsSnapshot: SessionSkillSnapshot | undefined = shouldRefreshSnapshot
     ? buildWorkspaceSkillSnapshot(workspaceDir, {
         config: cfg,
         skillFilter,
         eligibility: { remote: remoteEligibility },
         snapshotVersion,
         capabilityGate,
       })
-    : (nextEntry?.skillsSnapshot ??
+    : (materializeSessionSkillsSnapshot(storePath, nextEntry?.skillsSnapshot) ??
       (isFirstTurnInSession
         ? undefined
         : buildWorkspaceSkillSnapshot(workspaceDir, {
```

**File**: `src/commands/agent.ts` (modified, +11/-4)
```diff
@@ -42,6 +42,7 @@ import { formatCliCommand } from "../cli/command-format.js";
 import { type CliDeps, createDefaultDeps } from "../cli/deps.js";
 import { loadConfig } from "../config/config.js";
 import {
+  materializeSessionSkillsSnapshot,
   resolveAgentIdFromSessionKey,
   resolveSessionFilePath,
   type SessionEntry,
@@ -356,11 +357,17 @@ export async function agentCommand(
     }
 
     const skillsSnapshotVersion = getSkillsSnapshotVersion(workspaceDir);
-    const cachedSnapshotVersion = sessionEntry?.skillsSnapshot?.version ?? -1;
+    // The stored entry holds a ref to the snapshot body; join it here. A ref
+    // whose body is gone counts as no snapshot and is rebuilt.
+    const storedSnapshot = materializeSessionSkillsSnapshot(
+      storePath,
+      sessionEntry?.skillsSnapshot,
+    );
+    const cachedSnapshotVersion = storedSnapshot?.version ?? -1;
     const snapshotIsStale = cachedSnapshotVersion < skillsSnapshotVersion;
-    const needsSkillsSnapshot = isNewSession || !sessionEntry?.skillsSnapshot || snapshotIsStale;
+    const needsSkillsSnapshot = isNewSession || !storedSnapshot || snapshotIsStale;
     const skillFilter = resolveAgentSkillsFilter(cfg, sessionAgentId);
-    const previousSnapshot = sessionEntry?.skillsSnapshot;
+    const previousSnapshot = storedSnapshot;
     // PLAN-29 Phase 0.3: same load-time capability gate as the reply runner
     // (session-updates.ts) so the CLI agent path can't load P2P skills the
     // chat path would have blocked. Null runtime degrades to ungated.
@@ -380,7 +387,7 @@ export async function agentCommand(
           skillFilter,
           capabilityGate: cliCapabilityGate,
         })
-      : sessionEntry?.skillsSnapshot;
+      : storedSnapshot;
 
     // Hot-toggle awareness: if we rebuilt mid-session because the user (or
     // marketplace) changed skills, surface the diff to the agent so its next
```

**File**: `src/config/sessions.ts` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@ export * from "./sessions/paths.js";
 export * from "./sessions/reset.js";
 export * from "./sessions/session-key.js";
 export * from "./sessions/store.js";
+export {
+  materializeSessionSkillsSnapshot,
+  SKILLS_SNAPSHOT_DIR,
+} from "./sessions/skills-snapshot-store.js";
 export * from "./sessions/types.js";
 export * from "./sessions/transcript.js";
 export * from "./sessions/delivery-info.js";
```

**File**: `src/config/sessions/skills-snapshot-store.test.ts` (added, +146/-0)
```diff
@@ -0,0 +1,146 @@
+import fs from "node:fs";
+import os from "node:os";
+import path from "node:path";
+import { afterEach, beforeEach, describe, expect, it } from "vitest";
+import {
+  clearSkillsSnapshotBodyCacheForTest,
+  externalizeSkillsSnapshots,
+  materializeSessionSkillsSnapshot,
+  pruneSkillsSnapshotFiles,
+  SKILLS_SNAPSHOT_DIR,
+  snapshotRefFor,
+} from "./skills-snapshot-store.js";
+import { clearSessionStoreCacheForTest, loadSessionStore, saveSessionStore } from "./store.js";
+import {
+  isSessionSkillSnapshotRef,
+  type SessionEntry,
+  type SessionSkillSnapshot,
+} from "./types.js";
+
+const prompt = "## Skills\n\n".padEnd(9_000, "x");
+const snapshot: SessionSkillSnapshot = {
+  prompt,
+  skills: [{ name: "a" }, { name: "b", primaryEnv: "node" }],
+  skillFilter: ["a", "b"],
+  resolvedSkills: [{ name: "a", description: "A" } as never],
+  version: 3,
+};
+
+let dir: string;
+let storePath: string;
+
+beforeEach(() => {
+  dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-skills-snap-"));
+  storePath = path.join(dir, "sessions.json");
+  clearSessionStoreCacheForTest();
+  clearSkillsSnapshotBodyCacheForTest();
+});
+
+afterEach(() => {
+  fs.rmSync(dir, { recursive: true, force: true });
+});
+
+describe("skills snapshot externalization", () => {
+  it("writes one body per distinct content and leaves refs in the entries", () => {
+    const store: Record<string, SessionEntry> = {};
+    for (let i = 0; i < 40; i++) {
+      store[`agent:a:s${i}`] = { sessionId: `id-${i}`, updatedAt: i, skillsSnapshot: snapshot };
+    }
+    store["agent:a:other"] = {
+      sessionId: "id-o",
+      updatedAt: 1,
+      skillsSnapshot: { ...snapshot, prompt: "different" },
+    };
+    store["agent:a:none"] = { sessionId: "id-n", updatedAt: 1 };
+
+    const out = externalizeSkillsSnapshots(storePath, store);
+    expect(out).not.toBe(store);
+    // Input untouched.
+    expect(isSessionSkillSnapshotRef(store["agent:a:s0"]!.skillsSnapshot)).toBe(false);
+    const files = fs.readdirSync(path.join(dir, SKILLS_SNAPSHOT_DIR));
+    expect(files).toHaveLength(2);
+    const ref = out["agent:a:s0"]!.skillsSnapshot;
+    expect(isSessionSkillSnapshotRef(ref)).toBe(true);
+    if (!isSessionSkillSnapshotRef(ref)) {
+      throw new Error("expected a ref");
+    }
+    expect(ref).toEqual({
+      ref: snapshotRefFor(snapshot),
+      skills: snapshot.skills,
+      skillFilter: snapshot.skillFilter,
+      version: 3,
+    });
+    expect(out["agent:a:none"]!.skillsSnapshot).toBeUndefined();
+    // The index shrank by the body size times the entry count.
+    const before = JSON.stringify(store).length;
+    const after = JSON.stringify(out).length;
+    expect(after).toBeLessThan(before / 20);
+  });
+
+  it("materializes a ref back into the full snapshot, and inline snapshots pass through", () => {
+    const out = externalizeSkillsSnapshots(storePath, {
+      "agent:a:s": { sessionId: "id", updatedAt: 1, skillsSnapshot: snapshot },
+    });
+    clearSkillsSnapshotBodyCacheForTest(); // force the file read
+    const full = materializeSessionSkillsSnapshot(storePath, out["agent:a:s"]!.skillsSnapshot);
+    expect(full).toEqual(snapshot);
+    expect(materializeSessionSkillsSnapshot(storePath, snapshot)).toBe(snapshot);
+    expect(materializeSessionSkillsSnapshot(storePath, undefined)).toBeUndefined();
+  });
+
+  it("returns undefined for a ref whose body is missing or unsafe", () => {
+    expect(
+      materializeSessionSkillsSnapshot(storePath, { ref: "0123456789abcdef", skills: [] }),
+    ).toBeUndefined();
+    expect(
+      materializeSessionSkillsSnapshot(storePath, { ref: "../../etc/passwd", skills: [] }),
+    ).toBeUndefined();
+    expect(
+      materializeSessionSkillsSnapshot(undefined, { ref: "0123456789abcdef", skills: [] }),
+    ).toBeUndefined();
+  });
+
+  it("prunes bodies no entry references", () => {
+    const out = externalizeSkillsSnapshots(storePath, {
+      "agent:a:s": { sessionId: "id", updatedAt: 1, skillsSnapshot: snapshot },
+      "agent:a:t": {
+        sessionId: "id2",
+        updatedAt: 1,
+        skillsSnapshot: { ...snapshot, prompt: "gone soon" },
+      },
+    });
+    expect(fs.readdirSync(path.join(dir, SKILLS_SNAPSHOT_DIR))).toHaveLength(2);
+    delete out["agent:a:t"];
+    expect(pruneSkillsSnapshotFiles(storePath, out)).toBe(1);
+    expect(fs.readdirSync(path.join(dir, SKILLS_SNAPSHOT_DIR))).toEqual([
+      `${snapshotRefFor(snapshot)}.json`,
+    ]);
+  });
+
+  it("round-trips through saveSessionStore and loadSessionStore; a legacy inline index still loads", async () => {
+    await saveSessionStore(storePath, {
+      "agent:a:s": { sessionId: "id", updatedAt: 1, skillsSnapshot: snapshot },
+    });
+    const onDisk = JSON.parse(fs.readFileSync(storePath, "utf-8")) as Record<string, SessionEntry>;
+    expect(isSessionSkillSnapshotRef(onDisk["agent:a:s"]!.skillsSnapshot)).toBe(true);
+    expect(fs.readFileSync(storePath, "utf-8")).not.
```

**File**: `src/config/sessions/skills-snapshot-store.ts` (added, +202/-0)
```diff
@@ -0,0 +1,202 @@
+import crypto from "node:crypto";
+import fs from "node:fs";
+import path from "node:path";
+import { createSubsystemLogger } from "../../logging/subsystem.js";
+import {
+  isSessionSkillSnapshotRef,
+  type SessionEntry,
+  type SessionSkillSnapshot,
+  type SessionSkillSnapshotRef,
+} from "./types.js";
+
+/**
+ * Per-session skills snapshots, stored once per distinct content.
+ *
+ * Every session entry used to carry its own copy of the skills prompt and the
+ * resolved skill records (about 22 KB). The copies were identical across the
+ * sessions of an agent, so a store with 300 sessions was a 9.7 MB file that
+ * the gateway parsed, deep-copied and rewrote on every turn (2026-10-03
+ * profile). The body now lives in `<store dir>/skills-snapshots/<ref>.json`,
+ * keyed by a content hash, and the entry keeps a `SessionSkillSnapshotRef`.
+ *
+ * Reading an index written before this change still works: inline snapshots
+ * stay inline until the next save externalizes them.
+ */
+
+const log = createSubsystemLogger("sessions/skills-snapshots");
+
+export const SKILLS_SNAPSHOT_DIR = "skills-snapshots";
+
+/** Body kept in the side file: everything but the small fields the ref repeats. */
+type SnapshotBody = Pick<SessionSkillSnapshot, "prompt" | "resolvedSkills">;
+
+const bodyCache = new Map<string, SnapshotBody>();
+const BODY_CACHE_MAX = 32;
+
+function snapshotDir(storePath: string): string {
+  return path.join(path.dirname(storePath), SKILLS_SNAPSHOT_DIR);
+}
+
+function snapshotFile(storePath: string, ref: string): string {
+  return path.join(snapshotDir(storePath), `${ref}.json`);
+}
+
+export function snapshotRefFor(body: SnapshotBody): string {
+  return crypto
+    .createHash("sha256")
+    .update(JSON.stringify({ prompt: body.prompt, resolvedSkills: body.resolvedSkills ?? null }))
+    .digest("hex")
+    .slice(0, 16);
+}
+
+function isSafeRef(ref: string): boolean {
+  return /^[0-9a-f]{16}$/.test(ref);
+}
+
+/**
+ * Replace inline snapshots with refs, writing each distinct body once.
+ * Returns a new store object; the input is not mutated. Bodies that cannot be
+ * written stay inline so nothing is lost.
+ */
+export function externalizeSkillsSnapshots(
+  storePath: string,
+  store: Record<string, SessionEntry>,
+): Record<string, SessionEntry> {
+  let out: Record<string, SessionEntry> | null = null;
+  const written = new Set<string>();
+  for (const [key, entry] of Object.entries(store)) {
+    const snapshot = entry?.skillsSnapshot;
+    if (!snapshot || isSessionSkillSnapshotRef(snapshot)) {
+      continue;
+    }
+    const body: SnapshotBody = { prompt: snapshot.prompt, resolvedSkills: snapshot.resolvedSkills };
+    const ref = snapshotRefFor(body);
+    if (!written.has(ref)) {
+      try {
+        const file = snapshotFile(storePath, ref);
+        if (!fs.existsSync(file)) {
+          fs.mkdirSync(snapshotDir(storePath), { recursive: true });
+          const tmp = `${file}.${process.pid}.tmp`;
+          fs.writeFileSync(tmp, JSON.stringify(body), { mode: 0o600, encoding: "utf-8" });
+          fs.renameSync(tmp, file);
+        }
+        bodyCache.set(`${storePath}\u0000${ref}`, body);
+        written.add(ref);
+      } catch (err) {
+        log.warn(`could not externalize skills snapshot ${ref}: ${String(err)}`);
+        continue;
+      }
+    }
+    const asRef: SessionSkillSnapshotRef = {
+      ref,
+      skills: snapshot.skills,
+      ...(snapshot.skillFilter ? { skillFilter: snapshot.skillFilter } : {}),
+      ...(snapshot.version !== undefined ? { version: snapshot.version } : {}),
+    };
+    out ??= { ...store };
+    out[key] = { ...entry, skillsSnapshot: asRef };
+  }
+  return out ?? store;
+}
+
+/** Delete side files no entry references any more. Best effort. */
+export function pruneSkillsSnapshotFiles(
+  storePath: string,
+  store: Record<string, SessionEntry>,
+): number {
+  const dir = snapshotDir(storePath);
+  let names: string[];
+  try {
+    names = fs.readdirSync(dir);
+  } catch {
+    return 0;
+  }
+  const live = new Set<string>();
+  for (const entry of Object.values(store)) {
+    const snapshot = entry?.skillsSnapshot;
+    if (isSessionSkillSnapshotRef(snapshot)) {
+      live.add(snapshot.ref);
+    }
+  }
+  let removed = 0;
+  for (const name of names) {
+    const ref = name.endsWith(".json") ? name.slice(0, -".json".length) : null;
+    if (!ref || !isSafeRef(ref) || live.has(ref)) {
+      continue;
+    }
+    try {
+      fs.unlinkSync(path.join(dir, name));
+      bodyCache.delete(`${storePath}\u0000${ref}`);
+      removed += 1;
+    } catch {
+      // another writer may have removed it
+    }
+  }
+  return removed;
+}
+
+function readBody(storePath: string, ref: string): SnapshotBody | undefined {
+  if (!isSafeRef(ref)) {
+    return undefined;
+  }
+  const cacheKey = `${storePath}\u0000${ref}`;
+  const cached = bodyCache.get(cacheKey);
+  if (cached) {
+    return cached;
+  }
+  try {
+    
```

**File**: `src/config/sessions/store.ts` (modified, +8/-1)
```diff
@@ -17,6 +17,7 @@ import { getFileMtimeMs, isCacheEnabled, resolveCacheTtlMs } from "../cache-util
 import { loadConfig } from "../config.js";
 import type { SessionMaintenanceConfig, SessionMaintenanceMode } from "../types.base.js";
 import { deriveSessionMetaPatch } from "./metadata.js";
+import { externalizeSkillsSnapshots, pruneSkillsSnapshotFiles } from "./skills-snapshot-store.js";
 import { mergeSessionEntry, type SessionEntry } from "./types.js";
 
 const log = createSubsystemLogger("sessions/store");
@@ -546,7 +547,13 @@ async function saveSessionStoreUnlocked(
   }
 
   await fs.promises.mkdir(path.dirname(storePath), { recursive: true });
-  const json = JSON.stringify(store, null, 2);
+  // Skills snapshot bodies go to side files, one per distinct content; the
+  // index keeps refs. See skills-snapshot-store.ts.
+  const toWrite = externalizeSkillsSnapshots(storePath, store);
+  if (toWrite !== store) {
+    pruneSkillsSnapshotFiles(storePath, toWrite);
+  }
+  const json = JSON.stringify(toWrite, null, 2);
 
   // Windows: avoid atomic rename swaps (can be flaky under concurrent access).
   // We serialize writers via the session-store lock instead.
```

---

### Incident Patch 5: `a392954d` (2026-10-03)
**Commit Message**: fix(sessions): materialize the stored skills snapshot for /compact too

The root type check caught the third consumer: commands-compact.ts handed the entry's snapshot (now possibly a ref) straight to the compaction run.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `src/auto-reply/reply/commands-compact.ts` (modified, +5/-1)
```diff
@@ -6,6 +6,7 @@ import {
 } from "../../agents/embedded.js";
 import type { BitterbotConfig } from "../../config/config.js";
 import {
+  materializeSessionSkillsSnapshot,
   resolveFreshSessionTotalTokens,
   resolveSessionFilePath,
   resolveSessionFilePathOptions,
@@ -93,7 +94,10 @@ export const handleCompactCommand: CommandHandler = async (params) => {
     ),
     workspaceDir: params.workspaceDir,
     config: params.cfg,
-    skillsSnapshot: params.sessionEntry.skillsSnapshot,
+    skillsSnapshot: materializeSessionSkillsSnapshot(
+      params.storePath,
+      params.sessionEntry.skillsSnapshot,
+    ),
     provider: params.provider,
     model: params.model,
     thinkLevel: params.resolvedThinkLevel ?? (await params.resolveDefaultThinkingLevel()),
```

---

### Incident Patch 6: `c18a56d5` (2026-10-03)
**Commit Message**: fix(sessions): store each skills snapshot body once, keep a ref per session

Every session entry carried its own copy of the skills prompt and the resolved skill records (about 22 KB), identical across an agent's sessions: 297 entries made a 9.7 MB sessions.json that the gateway parsed, copied and rewrote on every turn (the remaining 5 s event-loop stall per soak round after #148).

- The body (prompt + resolvedSkills) lives in <store dir>/skills-snapshots/<sha256-16>.json, one file per distinct content; the entry keeps { ref, skills, skillFilter, version } so listings and version checks need no file read.
- saveSessionStore externalizes inline snapshots (input not mutated) and prunes bodies no entry references; an index written before this change loads as before and is converted on its next save.
- materializeSessionSkillsSnapshot joins a ref with its body for a run; a missing body counts as no snapshot, so the session rebuilds it. Called at the two places that hand a stored snapshot to a run (session-updates.ts, commands/agent.ts).
- SessionEntry.skillsSnapshot is SessionSkillSnapshot | SessionSkillSnapshotRef; ensureSkillSnapshot returns the full snapshot.

On this node's soak s

**File**: `docs/concepts/session.md` (modified, +1/-0)
```diff
@@ -68,6 +68,7 @@ All session state is **owned by the gateway** (the “master” Bitterbot). UI c
 - The store is a map `sessionKey -> { sessionId, updatedAt, ... }`. Deleting entries is safe; they are recreated on demand.
 - Group entries may include `displayName`, `channel`, `subject`, `room`, and `space` to label sessions in UIs.
 - Session entries include `origin` metadata (label + routing hints) so UIs can explain where a session came from.
+- Each entry pins the skills it was started with as `skillsSnapshot`. The body of that snapshot (the skills prompt and the resolved skill records, about 22 KB and identical across an agent's sessions) is stored once per distinct content in `.../sessions/skills-snapshots/<ref>.json`; the entry keeps `{ ref, skills, version }`. Unreferenced bodies are removed when the store is saved. An index written by an older version (bodies inline) still loads and is converted on its next save.
 - Bitterbot does **not** read legacy Pi/Tau session folders.
 
 ## Session pruning
```

**File**: `src/auto-reply/reply/session-updates.ts` (modified, +24/-10)
```diff
@@ -5,7 +5,12 @@ import type { CapabilityGateContext } from "../../agents/skills/capability-gate.
 import { createCapabilityRuntimeFromMemory } from "../../agents/skills/capability-runtime.js";
 import { ensureSkillsWatcher, getSkillsSnapshotVersion } from "../../agents/skills/refresh.js";
 import type { BitterbotConfig } from "../../config/config.js";
-import { type SessionEntry, updateSessionStore } from "../../config/sessions.js";
+import {
+  materializeSessionSkillsSnapshot,
+  type SessionEntry,
+  type SessionSkillSnapshot,
+  updateSessionStore,
+} from "../../config/sessions.js";
 import { buildChannelSummary } from "../../infra/channel-summary.js";
 import {
   resolveTimezone,
@@ -154,15 +159,19 @@ export async function ensureSkillSnapshot(params: {
   agentId?: string;
 }): Promise<{
   sessionEntry?: SessionEntry;
-  skillsSnapshot?: SessionEntry["skillsSnapshot"];
+  /** The full snapshot for this run (a stored ref is joined with its body here). */
+  skillsSnapshot?: SessionSkillSnapshot;
   systemSent: boolean;
 }> {
   if (process.env.BITTERBOT_TEST_FAST === "1") {
     // In fast unit-test runs we skip filesystem scanning, watchers, and session-store writes.
     // Dedicated skills tests cover snapshot generation behavior.
     return {
       sessionEntry: params.sessionEntry,
-      skillsSnapshot: params.sessionEntry?.skillsSnapshot,
+      skillsSnapshot: materializeSessionSkillsSnapshot(
+        params.storePath,
+        params.sessionEntry?.skillsSnapshot,
+      ),
       systemSent: params.sessionEntry?.systemSent ?? false,
     };
   }
@@ -184,16 +193,21 @@ export async function ensureSkillSnapshot(params: {
   const remoteEligibility = getRemoteSkillEligibility();
   const snapshotVersion = getSkillsSnapshotVersion(workspaceDir);
   ensureSkillsWatcher({ workspaceDir, config: cfg });
+  // The entry may hold a ref to a stored body. Resolve it once; a ref whose
+  // body is gone counts as no snapshot, so the session builds a fresh one.
+  const storedSnapshot = materializeSessionSkillsSnapshot(storePath, nextEntry?.skillsSnapshot);
+  if (nextEntry && nextEntry.skillsSnapshot && !storedSnapshot) {
+    nextEntry = { ...nextEntry, skillsSnapshot: undefined };
+  }
   const shouldRefreshSnapshot =
-    snapshotVersion > 0 && (nextEntry?.skillsSnapshot?.version ?? 0) < snapshotVersion;
+    snapshotVersion > 0 && (storedSnapshot?.version ?? 0) < snapshotVersion;
 
   // PLAN-29 Phase 0.3: load-time capability gate for P2P-ingested skills,
   // on by default. Resolved once per call, and only when a snapshot build
   // can actually happen (gate resolution touches the memory manager). A
   // null runtime (cold start, no memory) degrades to ungated — same
   // behavior as before the gate existed.
-  const willBuildSnapshot =
-    isFirstTurnInSession || shouldRefreshSnapshot || !sessionEntry?.skillsSnapshot;
+  const willBuildSnapshot = isFirstTurnInSession || shouldRefreshSnapshot || !storedSnapshot;
   let capabilityGate: CapabilityGateContext | undefined;
   if (willBuildSnapshot && cfg.skills?.p2p?.loadTimeCapabilityGate !== false) {
     const runtime = await createCapabilityRuntimeFromMemory({
@@ -210,15 +224,15 @@ export async function ensureSkillSnapshot(params: {
         updatedAt: Date.now(),
       };
     const skillSnapshot =
-      isFirstTurnInSession || !current.skillsSnapshot || shouldRefreshSnapshot
+      isFirstTurnInSession || !storedSnapshot || shouldRefreshSnapshot
         ? buildWorkspaceSkillSnapshot(workspaceDir, {
             config: cfg,
             skillFilter,
             eligibility: { remote: remoteEligibility },
             snapshotVersion,
             capabilityGate,
           })
-        : current.skillsSnapshot;
+        : storedSnapshot;
     nextEntry = {
       ...current,
       sessionId: sessionId ?? current.sessionId ?? crypto.randomUUID(),
@@ -235,15 +249,15 @@ export async function ensureSkillSnapshot(params: {
     systemSent = true;
   }
 
-  const skillsSnapshot = shouldRefreshSnapshot
+  const skillsSnapshot: SessionSkillSnapshot | undefined = shouldRefreshSnapshot
     ? buildWorkspaceSkillSnapshot(workspaceDir, {
         config: cfg,
         skillFilter,
         eligibility: { remote: remoteEligibility },
         snapshotVersion,
         capabilityGate,
       })
-    : (nextEntry?.skillsSnapshot ??
+    : (materializeSessionSkillsSnapshot(storePath, nextEntry?.skillsSnapshot) ??
       (isFirstTurnInSession
         ? undefined
         : buildWorkspaceSkillSnapshot(workspaceDir, {
```

**File**: `src/commands/agent.ts` (modified, +11/-4)
```diff
@@ -42,6 +42,7 @@ import { formatCliCommand } from "../cli/command-format.js";
 import { type CliDeps, createDefaultDeps } from "../cli/deps.js";
 import { loadConfig } from "../config/config.js";
 import {
+  materializeSessionSkillsSnapshot,
   resolveAgentIdFromSessionKey,
   resolveSessionFilePath,
   type SessionEntry,
@@ -356,11 +357,17 @@ export async function agentCommand(
     }
 
     const skillsSnapshotVersion = getSkillsSnapshotVersion(workspaceDir);
-    const cachedSnapshotVersion = sessionEntry?.skillsSnapshot?.version ?? -1;
+    // The stored entry holds a ref to the snapshot body; join it here. A ref
+    // whose body is gone counts as no snapshot and is rebuilt.
+    const storedSnapshot = materializeSessionSkillsSnapshot(
+      storePath,
+      sessionEntry?.skillsSnapshot,
+    );
+    const cachedSnapshotVersion = storedSnapshot?.version ?? -1;
     const snapshotIsStale = cachedSnapshotVersion < skillsSnapshotVersion;
-    const needsSkillsSnapshot = isNewSession || !sessionEntry?.skillsSnapshot || snapshotIsStale;
+    const needsSkillsSnapshot = isNewSession || !storedSnapshot || snapshotIsStale;
     const skillFilter = resolveAgentSkillsFilter(cfg, sessionAgentId);
-    const previousSnapshot = sessionEntry?.skillsSnapshot;
+    const previousSnapshot = storedSnapshot;
     // PLAN-29 Phase 0.3: same load-time capability gate as the reply runner
     // (session-updates.ts) so the CLI agent path can't load P2P skills the
     // chat path would have blocked. Null runtime degrades to ungated.
@@ -380,7 +387,7 @@ export async function agentCommand(
           skillFilter,
           capabilityGate: cliCapabilityGate,
         })
-      : sessionEntry?.skillsSnapshot;
+      : storedSnapshot;
 
     // Hot-toggle awareness: if we rebuilt mid-session because the user (or
     // marketplace) changed skills, surface the diff to the agent so its next
```

**File**: `src/config/sessions.ts` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@ export * from "./sessions/paths.js";
 export * from "./sessions/reset.js";
 export * from "./sessions/session-key.js";
 export * from "./sessions/store.js";
+export {
+  materializeSessionSkillsSnapshot,
+  SKILLS_SNAPSHOT_DIR,
+} from "./sessions/skills-snapshot-store.js";
 export * from "./sessions/types.js";
 export * from "./sessions/transcript.js";
 export * from "./sessions/delivery-info.js";
```

**File**: `src/config/sessions/skills-snapshot-store.test.ts` (added, +146/-0)
```diff
@@ -0,0 +1,146 @@
+import fs from "node:fs";
+import os from "node:os";
+import path from "node:path";
+import { afterEach, beforeEach, describe, expect, it } from "vitest";
+import {
+  clearSkillsSnapshotBodyCacheForTest,
+  externalizeSkillsSnapshots,
+  materializeSessionSkillsSnapshot,
+  pruneSkillsSnapshotFiles,
+  SKILLS_SNAPSHOT_DIR,
+  snapshotRefFor,
+} from "./skills-snapshot-store.js";
+import { clearSessionStoreCacheForTest, loadSessionStore, saveSessionStore } from "./store.js";
+import {
+  isSessionSkillSnapshotRef,
+  type SessionEntry,
+  type SessionSkillSnapshot,
+} from "./types.js";
+
+const prompt = "## Skills\n\n".padEnd(9_000, "x");
+const snapshot: SessionSkillSnapshot = {
+  prompt,
+  skills: [{ name: "a" }, { name: "b", primaryEnv: "node" }],
+  skillFilter: ["a", "b"],
+  resolvedSkills: [{ name: "a", description: "A" } as never],
+  version: 3,
+};
+
+let dir: string;
+let storePath: string;
+
+beforeEach(() => {
+  dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-skills-snap-"));
+  storePath = path.join(dir, "sessions.json");
+  clearSessionStoreCacheForTest();
+  clearSkillsSnapshotBodyCacheForTest();
+});
+
+afterEach(() => {
+  fs.rmSync(dir, { recursive: true, force: true });
+});
+
+describe("skills snapshot externalization", () => {
+  it("writes one body per distinct content and leaves refs in the entries", () => {
+    const store: Record<string, SessionEntry> = {};
+    for (let i = 0; i < 40; i++) {
+      store[`agent:a:s${i}`] = { sessionId: `id-${i}`, updatedAt: i, skillsSnapshot: snapshot };
+    }
+    store["agent:a:other"] = {
+      sessionId: "id-o",
+      updatedAt: 1,
+      skillsSnapshot: { ...snapshot, prompt: "different" },
+    };
+    store["agent:a:none"] = { sessionId: "id-n", updatedAt: 1 };
+
+    const out = externalizeSkillsSnapshots(storePath, store);
+    expect(out).not.toBe(store);
+    // Input untouched.
+    expect(isSessionSkillSnapshotRef(store["agent:a:s0"]!.skillsSnapshot)).toBe(false);
+    const files = fs.readdirSync(path.join(dir, SKILLS_SNAPSHOT_DIR));
+    expect(files).toHaveLength(2);
+    const ref = out["agent:a:s0"]!.skillsSnapshot;
+    expect(isSessionSkillSnapshotRef(ref)).toBe(true);
+    if (!isSessionSkillSnapshotRef(ref)) {
+      throw new Error("expected a ref");
+    }
+    expect(ref).toEqual({
+      ref: snapshotRefFor(snapshot),
+      skills: snapshot.skills,
+      skillFilter: snapshot.skillFilter,
+      version: 3,
+    });
+    expect(out["agent:a:none"]!.skillsSnapshot).toBeUndefined();
+    // The index shrank by the body size times the entry count.
+    const before = JSON.stringify(store).length;
+    const after = JSON.stringify(out).length;
+    expect(after).toBeLessThan(before / 20);
+  });
+
+  it("materializes a ref back into the full snapshot, and inline snapshots pass through", () => {
+    const out = externalizeSkillsSnapshots(storePath, {
+      "agent:a:s": { sessionId: "id", updatedAt: 1, skillsSnapshot: snapshot },
+    });
+    clearSkillsSnapshotBodyCacheForTest(); // force the file read
+    const full = materializeSessionSkillsSnapshot(storePath, out["agent:a:s"]!.skillsSnapshot);
+    expect(full).toEqual(snapshot);
+    expect(materializeSessionSkillsSnapshot(storePath, snapshot)).toBe(snapshot);
+    expect(materializeSessionSkillsSnapshot(storePath, undefined)).toBeUndefined();
+  });
+
+  it("returns undefined for a ref whose body is missing or unsafe", () => {
+    expect(
+      materializeSessionSkillsSnapshot(storePath, { ref: "0123456789abcdef", skills: [] }),
+    ).toBeUndefined();
+    expect(
+      materializeSessionSkillsSnapshot(storePath, { ref: "../../etc/passwd", skills: [] }),
+    ).toBeUndefined();
+    expect(
+      materializeSessionSkillsSnapshot(undefined, { ref: "0123456789abcdef", skills: [] }),
+    ).toBeUndefined();
+  });
+
+  it("prunes bodies no entry references", () => {
+    const out = externalizeSkillsSnapshots(storePath, {
+      "agent:a:s": { sessionId: "id", updatedAt: 1, skillsSnapshot: snapshot },
+      "agent:a:t": {
+        sessionId: "id2",
+        updatedAt: 1,
+        skillsSnapshot: { ...snapshot, prompt: "gone soon" },
+      },
+    });
+    expect(fs.readdirSync(path.join(dir, SKILLS_SNAPSHOT_DIR))).toHaveLength(2);
+    delete out["agent:a:t"];
+    expect(pruneSkillsSnapshotFiles(storePath, out)).toBe(1);
+    expect(fs.readdirSync(path.join(dir, SKILLS_SNAPSHOT_DIR))).toEqual([
+      `${snapshotRefFor(snapshot)}.json`,
+    ]);
+  });
+
+  it("round-trips through saveSessionStore and loadSessionStore; a legacy inline index still loads", async () => {
+    await saveSessionStore(storePath, {
+      "agent:a:s": { sessionId: "id", updatedAt: 1, skillsSnapshot: snapshot },
+    });
+    const onDisk = JSON.parse(fs.readFileSync(storePath, "utf-8")) as Record<string, SessionEntry>;
+    expect(isSessionSkillSnapshotRef(onDisk["agent:a:s"]!.skillsSnapshot)).toBe(true);
+    expect(fs.readFileSync(storePath, "utf-8")).not.
```

**File**: `src/config/sessions/skills-snapshot-store.ts` (added, +202/-0)
```diff
@@ -0,0 +1,202 @@
+import crypto from "node:crypto";
+import fs from "node:fs";
+import path from "node:path";
+import { createSubsystemLogger } from "../../logging/subsystem.js";
+import {
+  isSessionSkillSnapshotRef,
+  type SessionEntry,
+  type SessionSkillSnapshot,
+  type SessionSkillSnapshotRef,
+} from "./types.js";
+
+/**
+ * Per-session skills snapshots, stored once per distinct content.
+ *
+ * Every session entry used to carry its own copy of the skills prompt and the
+ * resolved skill records (about 22 KB). The copies were identical across the
+ * sessions of an agent, so a store with 300 sessions was a 9.7 MB file that
+ * the gateway parsed, deep-copied and rewrote on every turn (2026-10-03
+ * profile). The body now lives in `<store dir>/skills-snapshots/<ref>.json`,
+ * keyed by a content hash, and the entry keeps a `SessionSkillSnapshotRef`.
+ *
+ * Reading an index written before this change still works: inline snapshots
+ * stay inline until the next save externalizes them.
+ */
+
+const log = createSubsystemLogger("sessions/skills-snapshots");
+
+export const SKILLS_SNAPSHOT_DIR = "skills-snapshots";
+
+/** Body kept in the side file: everything but the small fields the ref repeats. */
+type SnapshotBody = Pick<SessionSkillSnapshot, "prompt" | "resolvedSkills">;
+
+const bodyCache = new Map<string, SnapshotBody>();
+const BODY_CACHE_MAX = 32;
+
+function snapshotDir(storePath: string): string {
+  return path.join(path.dirname(storePath), SKILLS_SNAPSHOT_DIR);
+}
+
+function snapshotFile(storePath: string, ref: string): string {
+  return path.join(snapshotDir(storePath), `${ref}.json`);
+}
+
+export function snapshotRefFor(body: SnapshotBody): string {
+  return crypto
+    .createHash("sha256")
+    .update(JSON.stringify({ prompt: body.prompt, resolvedSkills: body.resolvedSkills ?? null }))
+    .digest("hex")
+    .slice(0, 16);
+}
+
+function isSafeRef(ref: string): boolean {
+  return /^[0-9a-f]{16}$/.test(ref);
+}
+
+/**
+ * Replace inline snapshots with refs, writing each distinct body once.
+ * Returns a new store object; the input is not mutated. Bodies that cannot be
+ * written stay inline so nothing is lost.
+ */
+export function externalizeSkillsSnapshots(
+  storePath: string,
+  store: Record<string, SessionEntry>,
+): Record<string, SessionEntry> {
+  let out: Record<string, SessionEntry> | null = null;
+  const written = new Set<string>();
+  for (const [key, entry] of Object.entries(store)) {
+    const snapshot = entry?.skillsSnapshot;
+    if (!snapshot || isSessionSkillSnapshotRef(snapshot)) {
+      continue;
+    }
+    const body: SnapshotBody = { prompt: snapshot.prompt, resolvedSkills: snapshot.resolvedSkills };
+    const ref = snapshotRefFor(body);
+    if (!written.has(ref)) {
+      try {
+        const file = snapshotFile(storePath, ref);
+        if (!fs.existsSync(file)) {
+          fs.mkdirSync(snapshotDir(storePath), { recursive: true });
+          const tmp = `${file}.${process.pid}.tmp`;
+          fs.writeFileSync(tmp, JSON.stringify(body), { mode: 0o600, encoding: "utf-8" });
+          fs.renameSync(tmp, file);
+        }
+        bodyCache.set(`${storePath}\u0000${ref}`, body);
+        written.add(ref);
+      } catch (err) {
+        log.warn(`could not externalize skills snapshot ${ref}: ${String(err)}`);
+        continue;
+      }
+    }
+    const asRef: SessionSkillSnapshotRef = {
+      ref,
+      skills: snapshot.skills,
+      ...(snapshot.skillFilter ? { skillFilter: snapshot.skillFilter } : {}),
+      ...(snapshot.version !== undefined ? { version: snapshot.version } : {}),
+    };
+    out ??= { ...store };
+    out[key] = { ...entry, skillsSnapshot: asRef };
+  }
+  return out ?? store;
+}
+
+/** Delete side files no entry references any more. Best effort. */
+export function pruneSkillsSnapshotFiles(
+  storePath: string,
+  store: Record<string, SessionEntry>,
+): number {
+  const dir = snapshotDir(storePath);
+  let names: string[];
+  try {
+    names = fs.readdirSync(dir);
+  } catch {
+    return 0;
+  }
+  const live = new Set<string>();
+  for (const entry of Object.values(store)) {
+    const snapshot = entry?.skillsSnapshot;
+    if (isSessionSkillSnapshotRef(snapshot)) {
+      live.add(snapshot.ref);
+    }
+  }
+  let removed = 0;
+  for (const name of names) {
+    const ref = name.endsWith(".json") ? name.slice(0, -".json".length) : null;
+    if (!ref || !isSafeRef(ref) || live.has(ref)) {
+      continue;
+    }
+    try {
+      fs.unlinkSync(path.join(dir, name));
+      bodyCache.delete(`${storePath}\u0000${ref}`);
+      removed += 1;
+    } catch {
+      // another writer may have removed it
+    }
+  }
+  return removed;
+}
+
+function readBody(storePath: string, ref: string): SnapshotBody | undefined {
+  if (!isSafeRef(ref)) {
+    return undefined;
+  }
+  const cacheKey = `${storePath}\u0000${ref}`;
+  const cached = bodyCache.get(cacheKey);
+  if (cached) {
+    return cached;
+  }
+  try {
+    
```

**File**: `src/config/sessions/store.ts` (modified, +8/-1)
```diff
@@ -17,6 +17,7 @@ import { getFileMtimeMs, isCacheEnabled, resolveCacheTtlMs } from "../cache-util
 import { loadConfig } from "../config.js";
 import type { SessionMaintenanceConfig, SessionMaintenanceMode } from "../types.base.js";
 import { deriveSessionMetaPatch } from "./metadata.js";
+import { externalizeSkillsSnapshots, pruneSkillsSnapshotFiles } from "./skills-snapshot-store.js";
 import { mergeSessionEntry, type SessionEntry } from "./types.js";
 
 const log = createSubsystemLogger("sessions/store");
@@ -546,7 +547,13 @@ async function saveSessionStoreUnlocked(
   }
 
   await fs.promises.mkdir(path.dirname(storePath), { recursive: true });
-  const json = JSON.stringify(store, null, 2);
+  // Skills snapshot bodies go to side files, one per distinct content; the
+  // index keeps refs. See skills-snapshot-store.ts.
+  const toWrite = externalizeSkillsSnapshots(storePath, store);
+  if (toWrite !== store) {
+    pruneSkillsSnapshotFiles(storePath, toWrite);
+  }
+  const json = JSON.stringify(toWrite, null, 2);
 
   // Windows: avoid atomic rename swaps (can be flaky under concurrent access).
   // We serialize writers via the session-store lock instead.
```

**File**: `src/config/sessions/types.ts` (modified, +22/-1)
```diff
@@ -99,7 +99,7 @@ export type SessionEntry = {
   lastTo?: string;
   lastAccountId?: string;
   lastThreadId?: string | number;
-  skillsSnapshot?: SessionSkillSnapshot;
+  skillsSnapshot?: SessionSkillSnapshot | SessionSkillSnapshotRef;
   systemPromptReport?: SessionSystemPromptReport;
 };
 
@@ -150,6 +150,27 @@ export type SessionSkillSnapshot = {
   version?: number;
 };
 
+/**
+ * What the session index stores instead of the snapshot body. The prompt and
+ * the resolved skills (about 22 KB, identical for every session of an agent)
+ * live once in `<store dir>/skills-snapshots/<ref>.json`; the index keeps the
+ * small fields so listings and version checks need no file read. The store
+ * writes this form; `materializeSessionSkillsSnapshot` turns it back into a
+ * `SessionSkillSnapshot` for a run.
+ */
+export type SessionSkillSnapshotRef = {
+  ref: string;
+  skills: Array<{ name: string; primaryEnv?: string }>;
+  skillFilter?: string[];
+  version?: number;
+};
+
+export function isSessionSkillSnapshotRef(
+  value: SessionSkillSnapshot | SessionSkillSnapshotRef | undefined,
+): value is SessionSkillSnapshotRef {
+  return !!value && typeof (value as SessionSkillSnapshotRef).ref === "string";
+}
+
 export type SessionSystemPromptReport = {
   source: "run" | "estimate";
   generatedAt: number;
```

---

### Incident Patch 7: `2b5fcc2d` (2026-10-03)
**Commit Message**: Merge pull request #148 from Bitterbot-AI/fix/session-store-hot-path

fix(sessions): stop deep-copying the whole session store on read-only lookups

**File**: `src/commands/health.ts` (modified, +5/-2)
```diff
@@ -5,7 +5,7 @@ import type { ChannelAccountSnapshot } from "../channels/plugins/types.js";
 import { withProgress } from "../cli/progress.js";
 import type { BitterbotConfig } from "../config/config.js";
 import { loadConfig } from "../config/config.js";
-import { loadSessionStore, resolveStorePath } from "../config/sessions.js";
+import { peekSessionStore, resolveStorePath } from "../config/sessions.js";
 import { buildGatewayConnectionDetails, callGateway } from "../gateway/call.js";
 import { info } from "../globals.js";
 import { isTruthyEnvValue } from "../infra/env.js";
@@ -144,7 +144,10 @@ const resolveAgentOrder = (cfg: ReturnType<typeof loadConfig>) => {
 };
 
 const buildSessionSummary = (storePath: string) => {
-  const store = loadSessionStore(storePath);
+  // Read-only: counts and the five newest keys. The health snapshot refreshes
+  // often enough that a deep copy of a large store here showed up as the top
+  // synchronous cost in the gateway profile.
+  const store = peekSessionStore(storePath);
   const sessions = Object.entries(store)
     .filter(([key]) => key !== "global" && key !== "unknown")
     .map(([key, entry]) => ({ key, updatedAt: entry?.updatedAt ?? 0 }))
```

**File**: `src/config/sessions.cache.test.ts` (modified, +43/-0)
```diff
@@ -5,6 +5,7 @@ import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi }
 import {
   clearSessionStoreCacheForTest,
   loadSessionStore,
+  peekSessionStore,
   type SessionEntry,
   saveSessionStore,
 } from "./sessions.js";
@@ -217,4 +218,46 @@ describe("Session Store Cache", () => {
     const loaded = loadSessionStore(storePath);
     expect(loaded).toEqual({});
   });
+
+  describe("peekSessionStore (read-only, no copy)", () => {
+    it("returns the cached object itself on a hit and a fresh copy from loadSessionStore", async () => {
+      await saveSessionStore(storePath, {
+        "agent:a:one": { sessionId: "id-1", updatedAt: 1 },
+        "agent:a:two": { sessionId: "id-2", updatedAt: 2 },
+      });
+      const first = peekSessionStore(storePath);
+      const second = peekSessionStore(storePath);
+      // Same object: the hot read path does not pay for a deep copy.
+      expect(second).toBe(first);
+      expect(Object.keys(first)).toEqual(["agent:a:one", "agent:a:two"]);
+      // loadSessionStore still hands out a copy that is safe to mutate.
+      const copy = loadSessionStore(storePath);
+      expect(copy).not.toBe(first);
+      expect(copy).toEqual(first);
+      copy["agent:a:one"]!.updatedAt = 999;
+      expect(peekSessionStore(storePath)["agent:a:one"]!.updatedAt).toBe(1);
+    });
+
+    it("sees a store rewritten on disk (mtime change) without a stale hit", async () => {
+      await saveSessionStore(storePath, { "agent:a:one": { sessionId: "id-1", updatedAt: 1 } });
+      expect(Object.keys(peekSessionStore(storePath))).toEqual(["agent:a:one"]);
+      // Rewrite with a different mtime.
+      await new Promise((r) => setTimeout(r, 20));
+      await saveSessionStore(storePath, {
+        "agent:a:one": { sessionId: "id-1", updatedAt: 1 },
+        "agent:a:three": { sessionId: "id-3", updatedAt: 3 },
+      });
+      fs.utimesSync(storePath, new Date(), new Date(Date.now() + 5_000));
+      expect(Object.keys(peekSessionStore(storePath))).toContain("agent:a:three");
+    });
+
+    it("falls back to a disk load when the cache is disabled", async () => {
+      process.env.BITTERBOT_SESSION_CACHE_TTL_MS = "0";
+      await saveSessionStore(storePath, { "agent:a:one": { sessionId: "id-1", updatedAt: 1 } });
+      const a = peekSessionStore(storePath);
+      const b = peekSessionStore(storePath);
+      expect(a).toEqual(b);
+      expect(a).not.toBe(b);
+    });
+  });
 });
```

**File**: `src/config/sessions/store.ts` (modified, +28/-1)
```diff
@@ -212,12 +212,39 @@ export function loadSessionStore(
   return structuredClone(store);
 }
 
+/**
+ * The cached store object itself, for read-only lookups.
+ *
+ * `loadSessionStore` returns a deep copy so callers may mutate freely; with
+ * hundreds of sessions that copy is tens of milliseconds of synchronous work,
+ * and the gateway asked for it on every agent event, every health snapshot and
+ * most RPCs (2026-10-03 profile: 35 s of structuredClone in a 7-minute window,
+ * 9.7 MB store). Callers that only read one entry or count keys use this and
+ * copy what they keep. The returned object MUST NOT be mutated.
+ */
+export function peekSessionStore(storePath: string): Readonly<Record<string, SessionEntry>> {
+  if (isSessionStoreCacheEnabled()) {
+    const cached = SESSION_STORE_CACHE.get(storePath);
+    if (
+      cached &&
+      isSessionStoreCacheValid(cached) &&
+      getFileMtimeMs(storePath) === cached.mtimeMs
+    ) {
+      return cached.store;
+    }
+  }
+  // Miss: load from disk (which fills the cache) and hand out the cached object
+  // so the next peek is the same reference; without a cache the copy is ours.
+  const loaded = loadSessionStore(storePath);
+  return SESSION_STORE_CACHE.get(storePath)?.store ?? loaded;
+}
+
 export function readSessionUpdatedAt(params: {
   storePath: string;
   sessionKey: string;
 }): number | undefined {
   try {
-    const store = loadSessionStore(params.storePath);
+    const store = peekSessionStore(params.storePath);
     return store[params.sessionKey]?.updatedAt;
   } catch {
     return undefined;
```

**File**: `src/gateway/session-utils.ts` (modified, +11/-2)
```diff
@@ -13,6 +13,7 @@ import {
   buildGroupDisplayName,
   canonicalizeMainSessionAlias,
   loadSessionStore,
+  peekSessionStore,
   resolveAgentMainSessionKey,
   resolveFreshSessionTotalTokens,
   resolveMainSessionKey,
@@ -182,16 +183,24 @@ export function deriveSessionTitle(
   return undefined;
 }
 
+/**
+ * Look up one session entry. The lookup runs on the shared cached store and
+ * only the matched entry is copied, so the cost is one entry, not the whole
+ * index (which held hundreds of 30 KB entries on the 2026-10-03 soak node and
+ * was being deep-copied on every agent event). Writers go through
+ * `updateSessionStore`, which takes the lock and its own copy.
+ */
 export function loadSessionEntry(sessionKey: string) {
   const cfg = loadConfig();
   const sessionCfg = cfg.session;
   const canonicalKey = resolveSessionStoreKey({ cfg, sessionKey });
   const agentId = resolveSessionStoreAgentId(cfg, canonicalKey);
   const storePath = resolveStorePath(sessionCfg?.store, { agentId });
-  const store = loadSessionStore(storePath);
+  const store = peekSessionStore(storePath);
   const match = findStoreMatch(store, canonicalKey, sessionKey.trim());
   const legacyKey = match?.key !== canonicalKey ? match?.key : undefined;
-  return { cfg, storePath, store, entry: match?.entry, canonicalKey, legacyKey };
+  const entry = match ? structuredClone(match.entry) : undefined;
+  return { cfg, storePath, entry, canonicalKey, legacyKey };
 }
 
 /**
```

---

### Incident Patch 8: `89a72a4a` (2026-10-03)
**Commit Message**: fix(sessions): stop deep-copying the whole session store on read-only lookups

CPU profile of the live gateway during a soak round (2026-10-03, inspector on loopback, 420 s): 35 s in structuredClone, 7.6 s in readFileSync, 6.8 s writing the store. All of it was loadSessionStore on a 9.7 MB sessions.json (297 entries, each carrying a 22 KB skillsSnapshot and a 7 KB systemPromptReport), called from every agent event (resolveToolVerboseLevel -> loadSessionEntry), every health snapshot (buildSessionSummary), and most RPCs (agent, chat.history, usage). Each call deep-copied the whole store. These were the 5 to 13 s event-loop stalls every soak round, the 15 s gateway timeouts and the 86 s late aborts.

- peekSessionStore(storePath): the cached object itself for read-only use, filling the cache on a miss. Documented as must-not-mutate.
- loadSessionEntry: looks up on the shared store and copies only the matched entry; it no longer returns the whole store (no caller used it).
- health buildSessionSummary and readSessionUpdatedAt use the peek.

Not changed here: the index still stores the skills prompt per session (the 9.7 MB), which is the follow-up.

Co-Authored-By: Claude Fable 5.1 <[RE

**File**: `src/commands/health.ts` (modified, +5/-2)
```diff
@@ -5,7 +5,7 @@ import type { ChannelAccountSnapshot } from "../channels/plugins/types.js";
 import { withProgress } from "../cli/progress.js";
 import type { BitterbotConfig } from "../config/config.js";
 import { loadConfig } from "../config/config.js";
-import { loadSessionStore, resolveStorePath } from "../config/sessions.js";
+import { peekSessionStore, resolveStorePath } from "../config/sessions.js";
 import { buildGatewayConnectionDetails, callGateway } from "../gateway/call.js";
 import { info } from "../globals.js";
 import { isTruthyEnvValue } from "../infra/env.js";
@@ -144,7 +144,10 @@ const resolveAgentOrder = (cfg: ReturnType<typeof loadConfig>) => {
 };
 
 const buildSessionSummary = (storePath: string) => {
-  const store = loadSessionStore(storePath);
+  // Read-only: counts and the five newest keys. The health snapshot refreshes
+  // often enough that a deep copy of a large store here showed up as the top
+  // synchronous cost in the gateway profile.
+  const store = peekSessionStore(storePath);
   const sessions = Object.entries(store)
     .filter(([key]) => key !== "global" && key !== "unknown")
     .map(([key, entry]) => ({ key, updatedAt: entry?.updatedAt ?? 0 }))
```

**File**: `src/config/sessions.cache.test.ts` (modified, +43/-0)
```diff
@@ -5,6 +5,7 @@ import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi }
 import {
   clearSessionStoreCacheForTest,
   loadSessionStore,
+  peekSessionStore,
   type SessionEntry,
   saveSessionStore,
 } from "./sessions.js";
@@ -217,4 +218,46 @@ describe("Session Store Cache", () => {
     const loaded = loadSessionStore(storePath);
     expect(loaded).toEqual({});
   });
+
+  describe("peekSessionStore (read-only, no copy)", () => {
+    it("returns the cached object itself on a hit and a fresh copy from loadSessionStore", async () => {
+      await saveSessionStore(storePath, {
+        "agent:a:one": { sessionId: "id-1", updatedAt: 1 },
+        "agent:a:two": { sessionId: "id-2", updatedAt: 2 },
+      });
+      const first = peekSessionStore(storePath);
+      const second = peekSessionStore(storePath);
+      // Same object: the hot read path does not pay for a deep copy.
+      expect(second).toBe(first);
+      expect(Object.keys(first)).toEqual(["agent:a:one", "agent:a:two"]);
+      // loadSessionStore still hands out a copy that is safe to mutate.
+      const copy = loadSessionStore(storePath);
+      expect(copy).not.toBe(first);
+      expect(copy).toEqual(first);
+      copy["agent:a:one"]!.updatedAt = 999;
+      expect(peekSessionStore(storePath)["agent:a:one"]!.updatedAt).toBe(1);
+    });
+
+    it("sees a store rewritten on disk (mtime change) without a stale hit", async () => {
+      await saveSessionStore(storePath, { "agent:a:one": { sessionId: "id-1", updatedAt: 1 } });
+      expect(Object.keys(peekSessionStore(storePath))).toEqual(["agent:a:one"]);
+      // Rewrite with a different mtime.
+      await new Promise((r) => setTimeout(r, 20));
+      await saveSessionStore(storePath, {
+        "agent:a:one": { sessionId: "id-1", updatedAt: 1 },
+        "agent:a:three": { sessionId: "id-3", updatedAt: 3 },
+      });
+      fs.utimesSync(storePath, new Date(), new Date(Date.now() + 5_000));
+      expect(Object.keys(peekSessionStore(storePath))).toContain("agent:a:three");
+    });
+
+    it("falls back to a disk load when the cache is disabled", async () => {
+      process.env.BITTERBOT_SESSION_CACHE_TTL_MS = "0";
+      await saveSessionStore(storePath, { "agent:a:one": { sessionId: "id-1", updatedAt: 1 } });
+      const a = peekSessionStore(storePath);
+      const b = peekSessionStore(storePath);
+      expect(a).toEqual(b);
+      expect(a).not.toBe(b);
+    });
+  });
 });
```

**File**: `src/config/sessions/store.ts` (modified, +28/-1)
```diff
@@ -212,12 +212,39 @@ export function loadSessionStore(
   return structuredClone(store);
 }
 
+/**
+ * The cached store object itself, for read-only lookups.
+ *
+ * `loadSessionStore` returns a deep copy so callers may mutate freely; with
+ * hundreds of sessions that copy is tens of milliseconds of synchronous work,
+ * and the gateway asked for it on every agent event, every health snapshot and
+ * most RPCs (2026-10-03 profile: 35 s of structuredClone in a 7-minute window,
+ * 9.7 MB store). Callers that only read one entry or count keys use this and
+ * copy what they keep. The returned object MUST NOT be mutated.
+ */
+export function peekSessionStore(storePath: string): Readonly<Record<string, SessionEntry>> {
+  if (isSessionStoreCacheEnabled()) {
+    const cached = SESSION_STORE_CACHE.get(storePath);
+    if (
+      cached &&
+      isSessionStoreCacheValid(cached) &&
+      getFileMtimeMs(storePath) === cached.mtimeMs
+    ) {
+      return cached.store;
+    }
+  }
+  // Miss: load from disk (which fills the cache) and hand out the cached object
+  // so the next peek is the same reference; without a cache the copy is ours.
+  const loaded = loadSessionStore(storePath);
+  return SESSION_STORE_CACHE.get(storePath)?.store ?? loaded;
+}
+
 export function readSessionUpdatedAt(params: {
   storePath: string;
   sessionKey: string;
 }): number | undefined {
   try {
-    const store = loadSessionStore(params.storePath);
+    const store = peekSessionStore(params.storePath);
     return store[params.sessionKey]?.updatedAt;
   } catch {
     return undefined;
```

**File**: `src/gateway/session-utils.ts` (modified, +11/-2)
```diff
@@ -13,6 +13,7 @@ import {
   buildGroupDisplayName,
   canonicalizeMainSessionAlias,
   loadSessionStore,
+  peekSessionStore,
   resolveAgentMainSessionKey,
   resolveFreshSessionTotalTokens,
   resolveMainSessionKey,
@@ -182,16 +183,24 @@ export function deriveSessionTitle(
   return undefined;
 }
 
+/**
+ * Look up one session entry. The lookup runs on the shared cached store and
+ * only the matched entry is copied, so the cost is one entry, not the whole
+ * index (which held hundreds of 30 KB entries on the 2026-10-03 soak node and
+ * was being deep-copied on every agent event). Writers go through
+ * `updateSessionStore`, which takes the lock and its own copy.
+ */
 export function loadSessionEntry(sessionKey: string) {
   const cfg = loadConfig();
   const sessionCfg = cfg.session;
   const canonicalKey = resolveSessionStoreKey({ cfg, sessionKey });
   const agentId = resolveSessionStoreAgentId(cfg, canonicalKey);
   const storePath = resolveStorePath(sessionCfg?.store, { agentId });
-  const store = loadSessionStore(storePath);
+  const store = peekSessionStore(storePath);
   const match = findStoreMatch(store, canonicalKey, sessionKey.trim());
   const legacyKey = match?.key !== canonicalKey ? match?.key : undefined;
-  return { cfg, storePath, store, entry: match?.entry, canonicalKey, legacyKey };
+  const entry = match ? structuredClone(match.entry) : undefined;
+  return { cfg, storePath, entry, canonicalKey, legacyKey };
 }
 
 /**
```

---

### Incident Patch 9: `6bd8ff7d` (2026-10-03)
**Commit Message**: Merge pull request #147 from Bitterbot-AI/fix/control-ui-root-from-bundle

fix(gateway): find dist/control-ui next to the bundle regardless of cwd

**File**: `src/gateway/control-ui-assets.ts` (modified, +6/-1)
```diff
@@ -58,7 +58,12 @@ export function controlUiRootCandidates(params?: {
   if (envOverride) {
     return [path.resolve(envOverride)];
   }
-  // Running from dist/ (the normal case): dist/gateway/... -> dist/control-ui
+  // Running from the single-file bundle (the normal case): dist/entry.js ->
+  // dist/control-ui. The gateway's cwd is not reliable here: started from
+  // another directory (2026-10-02, cwd under /mnt/c) the cwd candidate below
+  // missed and the Control UI answered 404 while the WebSocket API kept working.
+  out.push(path.resolve(here, "control-ui"));
+  // Running unbundled from dist/gateway/...: dist/control-ui.
   out.push(path.resolve(here, "..", "control-ui"));
   // Running from a repo checkout or with a staged dist.
   out.push(path.resolve(cwd, "dist", "control-ui"));
```

**File**: `src/gateway/control-ui-http.test.ts` (modified, +15/-0)
```diff
@@ -274,6 +274,21 @@ describe("control UI helpers", () => {
     expect(candidates.some((c) => c.endsWith(path.join("dist", "control-ui")))).toBe(true);
   });
 
+  it("finds dist/control-ui next to the bundle whatever the process cwd is", () => {
+    // Live finding 2026-10-03: the gateway runs as the single-file bundle
+    // dist/entry.js, so the module directory IS dist/. Started from an unrelated
+    // cwd, the only candidates were <repo>/control-ui and <cwd>/dist/control-ui,
+    // both missing, and the Control UI answered 404 for a day while the
+    // WebSocket API kept working.
+    const candidates = controlUiRootCandidates({
+      env: {},
+      moduleDir: "/repo/dist",
+      cwd: "/somewhere/else",
+      execPath: "/usr/bin/node",
+    });
+    expect(candidates[0]).toBe(path.resolve("/repo/dist", "control-ui"));
+  });
+
   it("notices a UI staged after the first miss", async () => {
     // Regression, found by live testing: a negative result was cached for the
     // process lifetime, so a UI staged after boot (which is exactly what
```

---

### Incident Patch 10: `a8b97d4b` (2026-10-03)
**Commit Message**: Merge pull request #146 from Bitterbot-AI/fix/maintenance-tick-cold-scans

fix(memory): stop the maintenance tick's cold full scans of chunks

**File**: `docs/memory/knowledge-crystals.md` (modified, +2/-0)
```diff
@@ -298,6 +298,8 @@ await orchestratorBridge.publishWeather(0.9, 300_000, "suspicious skill burst fr
 
 The `ConsolidationEngine` (`consolidation.ts`) runs periodically (default: every 30 minutes) and performs 4 phases:
 
+It runs in the gateway process on the event loop with the synchronous SQLite driver, so it loads the live set in batches of 50 rows with a yield between batches, and the two per-tick lookups that usually match nothing (pending GCCRF scores, TTL-governed crystals) are served by partial indexes. Before that (2026-10-03 soak), each tick ran three cold full scans of `chunks`, about 5 seconds of blocked I/O each on a 6,000-crystal store with a small page cache.
+
 ### Phase 1: Score All Chunks (Ebbinghaus Decay)
 
 Every crystal's importance is recalculated from scratch using `calculateImportance()`:
```

**File**: `src/memory/consolidation.batched-load.test.ts` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+/**
+ * Consolidation loads the live chunk set in rowid-ordered batches with a yield
+ * between them (a cold scan of a few thousand rows is seconds of synchronous
+ * I/O on the gateway loop). The set loaded must be the same as one SELECT:
+ * every live chunk once, frozen and forgotten ones excluded.
+ */
+import { DatabaseSync } from "node:sqlite";
+import { describe, expect, it } from "vitest";
+import { ConsolidationEngine } from "./consolidation.js";
+import { ensureColumn, ensureMemoryIndexSchema } from "./memory-schema.js";
+
+function createDb(): DatabaseSync {
+  const db = new DatabaseSync(":memory:");
+  ensureMemoryIndexSchema({
+    db,
+    embeddingCacheTable: "embedding_cache",
+    ftsTable: "chunks_fts",
+    ftsEnabled: false,
+  });
+  ensureColumn(db, "chunks", "lifecycle", "TEXT");
+  ensureColumn(db, "chunks", "semantic_type", "TEXT");
+  return db;
+}
+
+function insertChunk(db: DatabaseSync, id: string, lifecycle: string | null): void {
+  const now = Date.now();
+  db.prepare(
+    `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding,
+       updated_at, importance_score, access_count, last_accessed_at, semantic_type, lifecycle)
+     VALUES (?, 'test.md', 'memory', 0, 1, ?, 'test', ?, '[1,0,0]', ?, 0.5, 1, ?, 'general', ?)`,
+  ).run(id, `hash-${id}`, `text ${id}`, now, now, lifecycle);
+}
+
+describe("consolidation live-chunk load", () => {
+  it("loads every live chunk once across batch boundaries and skips frozen and expired ones", async () => {
+    const db = createDb();
+    // 1,203 live rows: many full batches of 50 plus a partial one.
+    for (let i = 0; i < 1_203; i++) {
+      insertChunk(db, `live-${i}`, i % 2 === 0 ? "generated" : "activated");
+    }
+    insertChunk(db, "frozen-skill", "frozen");
+    insertChunk(db, "expired", "expired");
+    insertChunk(db, "archived", "archived");
+    const engine = new ConsolidationEngine(db) as unknown as {
+      loadLiveChunks(): Promise<Array<{ id: string }>>;
+    };
+    const loaded = await engine.loadLiveChunks();
+    const ids = loaded.map((c) => c.id);
+    expect(ids).toHaveLength(1_203);
+    expect(new Set(ids).size).toBe(1_203);
+    expect(ids).not.toContain("frozen-skill");
+    expect(ids).not.toContain("expired");
+    expect(ids).not.toContain("archived");
+    expect(loaded[0]).not.toHaveProperty("rid");
+  });
+
+  it("run() still scores the whole live set", async () => {
+    const db = createDb();
+    for (let i = 0; i < 1_001; i++) {
+      insertChunk(db, `c-${i}`, "generated");
+    }
+    const stats = await new ConsolidationEngine(db).run();
+    expect(stats.totalChunks).toBe(1_001);
+    expect(stats.scoredChunks).toBe(1_001);
+  });
+});
```

**File**: `src/memory/consolidation.ts` (modified, +46/-12)
```diff
@@ -29,6 +29,8 @@ const PAIRWISE_MERGE_CHUNK_CAP = 500;
 // Yield to the event loop every N outer iterations of the O(n^2) similarity
 // sweeps so a single consolidation pass cannot stall the gateway keepalive.
 const SIMILARITY_YIELD_EVERY = 32;
+// Rows per batch when loading the live set; see loadLiveChunks.
+const LIVE_CHUNK_LOAD_BATCH = 50;
 
 export type ConsolidationConfig = {
   decayRate: number;
@@ -128,18 +130,7 @@ export class ConsolidationEngine {
       durationMs: 0,
     };
 
-    const chunks = this.db
-      .prepare(
-        `SELECT id, path, source, start_line, end_line, hash, model, text, embedding,
-                updated_at, importance_score, access_count, last_accessed_at,
-                memory_type, emotional_valence, semantic_type, lifecycle_state, lifecycle,
-                spacing_score, open_loop
-         FROM chunks
-         WHERE (COALESCE(lifecycle, 'generated') IN ('generated', 'activated')
-                OR (lifecycle IS NULL AND COALESCE(lifecycle_state, 'active') = 'active'))
-           AND COALESCE(lifecycle, '') != 'frozen'`,
-      )
-      .all() as ChunkRow[];
+    const chunks = await this.loadLiveChunks();
 
     stats.totalChunks = chunks.length;
     if (chunks.length === 0) {
@@ -301,6 +292,49 @@ export class ConsolidationEngine {
     return stats;
   }
 
+  /**
+   * Load every live (non-frozen, not forgotten) chunk with its embedding.
+   *
+   * Read in rowid-ordered batches with a yield between them: on a cold page
+   * cache one pass over the table costs seconds of synchronous I/O (about 5 s
+   * for 6k rows on the 2026-10-03 reference node, 16 ms warm), and this runs
+   * on the gateway loop every 30 minutes. A batch bounds each block to a
+   * fraction of that (50 rows: about 0.3 s cold on that node, the whole pass
+   * still about 5 s) while the set loaded is the same.
+   */
+  private async loadLiveChunks(): Promise<ChunkRow[]> {
+    const stmt = this.db.prepare(
+      `SELECT rowid AS rid, id, path, source, start_line, end_line, hash, model, text, embedding,
+              updated_at, importance_score, access_count, last_accessed_at,
+              memory_type, emotional_valence, semantic_type, lifecycle_state, lifecycle,
+              spacing_score, open_loop
+       FROM chunks
+       WHERE rowid > ?
+         AND (COALESCE(lifecycle, 'generated') IN ('generated', 'activated')
+              OR (lifecycle IS NULL AND COALESCE(lifecycle_state, 'active') = 'active'))
+         AND COALESCE(lifecycle, '') != 'frozen'
+       ORDER BY rowid
+       LIMIT ?`,
+    );
+    const chunks: ChunkRow[] = [];
+    let after = 0;
+    for (;;) {
+      const batch = stmt.all(after, LIVE_CHUNK_LOAD_BATCH) as Array<ChunkRow & { rid: number }>;
+      if (batch.length === 0) {
+        break;
+      }
+      for (const { rid, ...row } of batch) {
+        chunks.push(row as ChunkRow);
+        after = rid;
+      }
+      if (batch.length < LIVE_CHUNK_LOAD_BATCH) {
+        break;
+      }
+      await yieldToEventLoop();
+    }
+    return chunks;
+  }
+
   /**
    * Decay steering rewards on all chunks (Phase 3).
    * Called during consolidation to prevent unbounded reward accumulation.
```

**File**: `src/memory/migrations.ts` (modified, +21/-0)
```diff
@@ -2418,6 +2418,27 @@ const MIGRATIONS: Migration[] = [
       db.exec(`UPDATE peer_reputation SET anomaly_flag = 0 WHERE anomaly_flag = 1`);
     },
   },
+  {
+    version: 70,
+    description:
+      "Maintenance-tick cold scans (2026-10-03 soak): every 30-minute tick ran two full " +
+      "scans of chunks that matched nothing. scorePendingChunks filters on " +
+      "curiosity_reward IS NULL, which the v35 partial index (IS NOT NULL) cannot serve; " +
+      "governance.enforceLifespan filters on governance_json LIKE '%ttl%' and this install " +
+      "has no TTL crystal. On a cold page cache each scan of the 6k-row table cost about " +
+      "5 s of synchronous I/O on the gateway loop (16 ms warm). Partial indexes on exactly " +
+      "those predicates make both queries touch only the matching rows.",
+    up: (db: DatabaseSync) => {
+      db.exec(
+        `CREATE INDEX IF NOT EXISTS idx_chunks_curiosity_pending ` +
+          `ON chunks(id) WHERE curiosity_reward IS NULL`,
+      );
+      db.exec(
+        `CREATE INDEX IF NOT EXISTS idx_chunks_governance_ttl ` +
+          `ON chunks(id) WHERE governance_json LIKE '%ttl%'`,
+      );
+    },
+  },
 ];
 
 /**
```

**File**: `src/memory/migrations.v70.test.ts` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+/**
+ * Migration v70: partial indexes for the two maintenance-tick queries that
+ * full-scanned `chunks` for rows that do not exist (2026-10-03 soak: ~5 s of
+ * cold synchronous I/O each, every 30 minutes, on the gateway loop).
+ */
+import { DatabaseSync } from "node:sqlite";
+import { describe, expect, it } from "vitest";
+import { ensureMemoryIndexSchema } from "./memory-schema.js";
+import { LATEST_SCHEMA_VERSION, runMigrations } from "./migrations.js";
+
+function openMigratedDb(): DatabaseSync {
+  const db = new DatabaseSync(":memory:");
+  ensureMemoryIndexSchema({
+    db,
+    embeddingCacheTable: "embedding_cache",
+    ftsTable: "chunks_fts",
+    ftsEnabled: false,
+  });
+  runMigrations(db);
+  return db;
+}
+
+function plan(db: DatabaseSync, sql: string): string {
+  return (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as Array<{ detail: string }>)
+    .map((r) => r.detail)
+    .join(" | ");
+}
+
+describe("migration v70: maintenance-tick partial indexes", () => {
+  it("is the latest version and creates both indexes idempotently", () => {
+    const db = openMigratedDb();
+    expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(70);
+    const names = (
+      db
+        .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'chunks'`)
+        .all() as Array<{ name: string }>
+    ).map((r) => r.name);
+    expect(names).toContain("idx_chunks_curiosity_pending");
+    expect(names).toContain("idx_chunks_governance_ttl");
+    db.prepare(`UPDATE meta SET value = ? WHERE key = 'schema_version'`).run("69");
+    expect(() => runMigrations(db)).not.toThrow();
+  });
+
+  it("serves the pending-curiosity query from the index instead of scanning the table", () => {
+    const db = openMigratedDb();
+    const detail = plan(
+      db,
+      `SELECT id, embedding FROM chunks
+       WHERE curiosity_reward IS NULL
+         AND COALESCE(lifecycle_state, 'active') = 'active'
+         AND embedding IS NOT NULL AND embedding != '[]'
+       LIMIT 50`,
+    );
+    expect(detail).toContain("idx_chunks_curiosity_pending");
+  });
+
+  it("serves the governance TTL query from the index instead of scanning the table", () => {
+    const db = openMigratedDb();
+    const detail = plan(
+      db,
+      `SELECT id, governance_json, created_at FROM chunks
+       WHERE COALESCE(lifecycle, 'generated') NOT IN ('expired', 'frozen')
+         AND governance_json LIKE '%ttl%'`,
+    );
+    expect(detail).toContain("idx_chunks_governance_ttl");
+  });
+});
```

---

### Incident Patch 11: `2082f606` (2026-10-03)
**Commit Message**: fix(gateway): find dist/control-ui next to the bundle regardless of cwd

The gateway runs as the single-file bundle dist/entry.js, so the module directory is dist/ itself. The candidate list only had <moduleDir>/../control-ui (built for an unbundled dist/gateway/ layout) and <cwd>/dist/control-ui. Started on 2026-10-02 from an unrelated working directory, both missed: the Control UI answered 404 for a day while the WebSocket API kept serving. <moduleDir>/control-ui is now the first candidate. Regression test added.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `src/gateway/control-ui-assets.ts` (modified, +6/-1)
```diff
@@ -58,7 +58,12 @@ export function controlUiRootCandidates(params?: {
   if (envOverride) {
     return [path.resolve(envOverride)];
   }
-  // Running from dist/ (the normal case): dist/gateway/... -> dist/control-ui
+  // Running from the single-file bundle (the normal case): dist/entry.js ->
+  // dist/control-ui. The gateway's cwd is not reliable here: started from
+  // another directory (2026-10-02, cwd under /mnt/c) the cwd candidate below
+  // missed and the Control UI answered 404 while the WebSocket API kept working.
+  out.push(path.resolve(here, "control-ui"));
+  // Running unbundled from dist/gateway/...: dist/control-ui.
   out.push(path.resolve(here, "..", "control-ui"));
   // Running from a repo checkout or with a staged dist.
   out.push(path.resolve(cwd, "dist", "control-ui"));
```

**File**: `src/gateway/control-ui-http.test.ts` (modified, +15/-0)
```diff
@@ -274,6 +274,21 @@ describe("control UI helpers", () => {
     expect(candidates.some((c) => c.endsWith(path.join("dist", "control-ui")))).toBe(true);
   });
 
+  it("finds dist/control-ui next to the bundle whatever the process cwd is", () => {
+    // Live finding 2026-10-03: the gateway runs as the single-file bundle
+    // dist/entry.js, so the module directory IS dist/. Started from an unrelated
+    // cwd, the only candidates were <repo>/control-ui and <cwd>/dist/control-ui,
+    // both missing, and the Control UI answered 404 for a day while the
+    // WebSocket API kept working.
+    const candidates = controlUiRootCandidates({
+      env: {},
+      moduleDir: "/repo/dist",
+      cwd: "/somewhere/else",
+      execPath: "/usr/bin/node",
+    });
+    expect(candidates[0]).toBe(path.resolve("/repo/dist", "control-ui"));
+  });
+
   it("notices a UI staged after the first miss", async () => {
     // Regression, found by live testing: a negative result was cached for the
     // process lifetime, so a UI staged after boot (which is exactly what
```

---

### Incident Patch 12: `83a72317` (2026-10-03)
**Commit Message**: fix(memory): stop the maintenance tick's cold full scans of chunks

The gateway stalled 5 to 12 s every 30 minutes (event-loop monitor, 2026-10-02/03), lined up with the memory maintenance tick. Offline timing on a copy of the main store (6,317 live crystals, 364 MB file) found the cost is I/O, not CPU: a full scan of chunks takes about 5 s with cold pages and 16 ms warm, and the box keeps about 400 MB of page cache. The tick ran three such scans:

- ConsolidationEngine.run() loading the live set: now read in rowid-ordered batches of 50 with a yield between batches (longest block 0.3 s cold instead of 4.9 s; same rows).
- CuriosityEngine.scorePendingChunks(): filters on curiosity_reward IS NULL, which the v35 partial index (IS NOT NULL) cannot serve. Migration v70 adds a partial index on that predicate: 0 to 7 ms cold.
- governance.enforceLifespan(): filters on governance_json LIKE '%ttl%' and this install has no TTL crystal. v70 adds a partial index on that predicate: 1 ms cold.

Tests: migration v70 (indexes exist, idempotent, both query plans use them), batched load (1,203 rows across batch boundaries, frozen and expired excluded, run() scores all).

Co-Authored-By: Claude Fable

**File**: `docs/memory/knowledge-crystals.md` (modified, +2/-0)
```diff
@@ -298,6 +298,8 @@ await orchestratorBridge.publishWeather(0.9, 300_000, "suspicious skill burst fr
 
 The `ConsolidationEngine` (`consolidation.ts`) runs periodically (default: every 30 minutes) and performs 4 phases:
 
+It runs in the gateway process on the event loop with the synchronous SQLite driver, so it loads the live set in batches of 50 rows with a yield between batches, and the two per-tick lookups that usually match nothing (pending GCCRF scores, TTL-governed crystals) are served by partial indexes. Before that (2026-10-03 soak), each tick ran three cold full scans of `chunks`, about 5 seconds of blocked I/O each on a 6,000-crystal store with a small page cache.
+
 ### Phase 1: Score All Chunks (Ebbinghaus Decay)
 
 Every crystal's importance is recalculated from scratch using `calculateImportance()`:
```

**File**: `src/memory/consolidation.batched-load.test.ts` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+/**
+ * Consolidation loads the live chunk set in rowid-ordered batches with a yield
+ * between them (a cold scan of a few thousand rows is seconds of synchronous
+ * I/O on the gateway loop). The set loaded must be the same as one SELECT:
+ * every live chunk once, frozen and forgotten ones excluded.
+ */
+import { DatabaseSync } from "node:sqlite";
+import { describe, expect, it } from "vitest";
+import { ConsolidationEngine } from "./consolidation.js";
+import { ensureColumn, ensureMemoryIndexSchema } from "./memory-schema.js";
+
+function createDb(): DatabaseSync {
+  const db = new DatabaseSync(":memory:");
+  ensureMemoryIndexSchema({
+    db,
+    embeddingCacheTable: "embedding_cache",
+    ftsTable: "chunks_fts",
+    ftsEnabled: false,
+  });
+  ensureColumn(db, "chunks", "lifecycle", "TEXT");
+  ensureColumn(db, "chunks", "semantic_type", "TEXT");
+  return db;
+}
+
+function insertChunk(db: DatabaseSync, id: string, lifecycle: string | null): void {
+  const now = Date.now();
+  db.prepare(
+    `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding,
+       updated_at, importance_score, access_count, last_accessed_at, semantic_type, lifecycle)
+     VALUES (?, 'test.md', 'memory', 0, 1, ?, 'test', ?, '[1,0,0]', ?, 0.5, 1, ?, 'general', ?)`,
+  ).run(id, `hash-${id}`, `text ${id}`, now, now, lifecycle);
+}
+
+describe("consolidation live-chunk load", () => {
+  it("loads every live chunk once across batch boundaries and skips frozen and expired ones", async () => {
+    const db = createDb();
+    // 1,203 live rows: many full batches of 50 plus a partial one.
+    for (let i = 0; i < 1_203; i++) {
+      insertChunk(db, `live-${i}`, i % 2 === 0 ? "generated" : "activated");
+    }
+    insertChunk(db, "frozen-skill", "frozen");
+    insertChunk(db, "expired", "expired");
+    insertChunk(db, "archived", "archived");
+    const engine = new ConsolidationEngine(db) as unknown as {
+      loadLiveChunks(): Promise<Array<{ id: string }>>;
+    };
+    const loaded = await engine.loadLiveChunks();
+    const ids = loaded.map((c) => c.id);
+    expect(ids).toHaveLength(1_203);
+    expect(new Set(ids).size).toBe(1_203);
+    expect(ids).not.toContain("frozen-skill");
+    expect(ids).not.toContain("expired");
+    expect(ids).not.toContain("archived");
+    expect(loaded[0]).not.toHaveProperty("rid");
+  });
+
+  it("run() still scores the whole live set", async () => {
+    const db = createDb();
+    for (let i = 0; i < 1_001; i++) {
+      insertChunk(db, `c-${i}`, "generated");
+    }
+    const stats = await new ConsolidationEngine(db).run();
+    expect(stats.totalChunks).toBe(1_001);
+    expect(stats.scoredChunks).toBe(1_001);
+  });
+});
```

**File**: `src/memory/consolidation.ts` (modified, +46/-12)
```diff
@@ -29,6 +29,8 @@ const PAIRWISE_MERGE_CHUNK_CAP = 500;
 // Yield to the event loop every N outer iterations of the O(n^2) similarity
 // sweeps so a single consolidation pass cannot stall the gateway keepalive.
 const SIMILARITY_YIELD_EVERY = 32;
+// Rows per batch when loading the live set; see loadLiveChunks.
+const LIVE_CHUNK_LOAD_BATCH = 50;
 
 export type ConsolidationConfig = {
   decayRate: number;
@@ -128,18 +130,7 @@ export class ConsolidationEngine {
       durationMs: 0,
     };
 
-    const chunks = this.db
-      .prepare(
-        `SELECT id, path, source, start_line, end_line, hash, model, text, embedding,
-                updated_at, importance_score, access_count, last_accessed_at,
-                memory_type, emotional_valence, semantic_type, lifecycle_state, lifecycle,
-                spacing_score, open_loop
-         FROM chunks
-         WHERE (COALESCE(lifecycle, 'generated') IN ('generated', 'activated')
-                OR (lifecycle IS NULL AND COALESCE(lifecycle_state, 'active') = 'active'))
-           AND COALESCE(lifecycle, '') != 'frozen'`,
-      )
-      .all() as ChunkRow[];
+    const chunks = await this.loadLiveChunks();
 
     stats.totalChunks = chunks.length;
     if (chunks.length === 0) {
@@ -301,6 +292,49 @@ export class ConsolidationEngine {
     return stats;
   }
 
+  /**
+   * Load every live (non-frozen, not forgotten) chunk with its embedding.
+   *
+   * Read in rowid-ordered batches with a yield between them: on a cold page
+   * cache one pass over the table costs seconds of synchronous I/O (about 5 s
+   * for 6k rows on the 2026-10-03 reference node, 16 ms warm), and this runs
+   * on the gateway loop every 30 minutes. A batch bounds each block to a
+   * fraction of that (50 rows: about 0.3 s cold on that node, the whole pass
+   * still about 5 s) while the set loaded is the same.
+   */
+  private async loadLiveChunks(): Promise<ChunkRow[]> {
+    const stmt = this.db.prepare(
+      `SELECT rowid AS rid, id, path, source, start_line, end_line, hash, model, text, embedding,
+              updated_at, importance_score, access_count, last_accessed_at,
+              memory_type, emotional_valence, semantic_type, lifecycle_state, lifecycle,
+              spacing_score, open_loop
+       FROM chunks
+       WHERE rowid > ?
+         AND (COALESCE(lifecycle, 'generated') IN ('generated', 'activated')
+              OR (lifecycle IS NULL AND COALESCE(lifecycle_state, 'active') = 'active'))
+         AND COALESCE(lifecycle, '') != 'frozen'
+       ORDER BY rowid
+       LIMIT ?`,
+    );
+    const chunks: ChunkRow[] = [];
+    let after = 0;
+    for (;;) {
+      const batch = stmt.all(after, LIVE_CHUNK_LOAD_BATCH) as Array<ChunkRow & { rid: number }>;
+      if (batch.length === 0) {
+        break;
+      }
+      for (const { rid, ...row } of batch) {
+        chunks.push(row as ChunkRow);
+        after = rid;
+      }
+      if (batch.length < LIVE_CHUNK_LOAD_BATCH) {
+        break;
+      }
+      await yieldToEventLoop();
+    }
+    return chunks;
+  }
+
   /**
    * Decay steering rewards on all chunks (Phase 3).
    * Called during consolidation to prevent unbounded reward accumulation.
```

**File**: `src/memory/migrations.ts` (modified, +21/-0)
```diff
@@ -2418,6 +2418,27 @@ const MIGRATIONS: Migration[] = [
       db.exec(`UPDATE peer_reputation SET anomaly_flag = 0 WHERE anomaly_flag = 1`);
     },
   },
+  {
+    version: 70,
+    description:
+      "Maintenance-tick cold scans (2026-10-03 soak): every 30-minute tick ran two full " +
+      "scans of chunks that matched nothing. scorePendingChunks filters on " +
+      "curiosity_reward IS NULL, which the v35 partial index (IS NOT NULL) cannot serve; " +
+      "governance.enforceLifespan filters on governance_json LIKE '%ttl%' and this install " +
+      "has no TTL crystal. On a cold page cache each scan of the 6k-row table cost about " +
+      "5 s of synchronous I/O on the gateway loop (16 ms warm). Partial indexes on exactly " +
+      "those predicates make both queries touch only the matching rows.",
+    up: (db: DatabaseSync) => {
+      db.exec(
+        `CREATE INDEX IF NOT EXISTS idx_chunks_curiosity_pending ` +
+          `ON chunks(id) WHERE curiosity_reward IS NULL`,
+      );
+      db.exec(
+        `CREATE INDEX IF NOT EXISTS idx_chunks_governance_ttl ` +
+          `ON chunks(id) WHERE governance_json LIKE '%ttl%'`,
+      );
+    },
+  },
 ];
 
 /**
```

**File**: `src/memory/migrations.v70.test.ts` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+/**
+ * Migration v70: partial indexes for the two maintenance-tick queries that
+ * full-scanned `chunks` for rows that do not exist (2026-10-03 soak: ~5 s of
+ * cold synchronous I/O each, every 30 minutes, on the gateway loop).
+ */
+import { DatabaseSync } from "node:sqlite";
+import { describe, expect, it } from "vitest";
+import { ensureMemoryIndexSchema } from "./memory-schema.js";
+import { LATEST_SCHEMA_VERSION, runMigrations } from "./migrations.js";
+
+function openMigratedDb(): DatabaseSync {
+  const db = new DatabaseSync(":memory:");
+  ensureMemoryIndexSchema({
+    db,
+    embeddingCacheTable: "embedding_cache",
+    ftsTable: "chunks_fts",
+    ftsEnabled: false,
+  });
+  runMigrations(db);
+  return db;
+}
+
+function plan(db: DatabaseSync, sql: string): string {
+  return (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as Array<{ detail: string }>)
+    .map((r) => r.detail)
+    .join(" | ");
+}
+
+describe("migration v70: maintenance-tick partial indexes", () => {
+  it("is the latest version and creates both indexes idempotently", () => {
+    const db = openMigratedDb();
+    expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(70);
+    const names = (
+      db
+        .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'chunks'`)
+        .all() as Array<{ name: string }>
+    ).map((r) => r.name);
+    expect(names).toContain("idx_chunks_curiosity_pending");
+    expect(names).toContain("idx_chunks_governance_ttl");
+    db.prepare(`UPDATE meta SET value = ? WHERE key = 'schema_version'`).run("69");
+    expect(() => runMigrations(db)).not.toThrow();
+  });
+
+  it("serves the pending-curiosity query from the index instead of scanning the table", () => {
+    const db = openMigratedDb();
+    const detail = plan(
+      db,
+      `SELECT id, embedding FROM chunks
+       WHERE curiosity_reward IS NULL
+         AND COALESCE(lifecycle_state, 'active') = 'active'
+         AND embedding IS NOT NULL AND embedding != '[]'
+       LIMIT 50`,
+    );
+    expect(detail).toContain("idx_chunks_curiosity_pending");
+  });
+
+  it("serves the governance TTL query from the index instead of scanning the table", () => {
+    const db = openMigratedDb();
+    const detail = plan(
+      db,
+      `SELECT id, governance_json, created_at FROM chunks
+       WHERE COALESCE(lifecycle, 'generated') NOT IN ('expired', 'frozen')
+         AND governance_json LIKE '%ttl%'`,
+    );
+    expect(detail).toContain("idx_chunks_governance_ttl");
+  });
+});
```

---

### Incident Patch 13: `e4ae31fa` (2026-10-03)
**Commit Message**: Merge pull request #145 from Bitterbot-AI/fix/endocrine-format-precedence

fix(prompt): hormonal tone hints yield to an explicit output request

**File**: `docs/memory/biological-identity.md` (modified, +1/-0)
```diff
@@ -205,6 +205,7 @@ The system prompt receives a block like this:
 
 *Modulate your tone naturally: be enthusiastic and celebrate wins; humor and playfulness are welcome*
 *Do not mention these values or acknowledge this section. Just embody the state.*
+*These hints shape tone only. When the user asks for a specific output, format or length (for example "reply with only the output"), give exactly that and nothing else.*
 
 Self-concept: I communicate with genuine warmth and technical depth...
 ```
```

**File**: `src/agents/system-prompt-endocrine.test.ts` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+import { describe, expect, it } from "vitest";
+import { buildEndocrineStateSection } from "./system-prompt-endocrine.js";
+
+// Soak finding (2026-10-02): with every hormone near its ceiling, Haiku answered
+// "reply with only its output" turns with a mood paragraph on 6 of 86 runs, on
+// both engines. The tone hints need an explicit precedence rule.
+const maxed = {
+  dopamine: 0.95,
+  cortisol: 0.9,
+  oxytocin: 0.95,
+  briefing:
+    "be enthusiastic and celebrate wins, be warm and personal, feel free to elaborate and be detailed, ask follow-up questions when curious",
+};
+
+describe("buildEndocrineStateSection", () => {
+  it("renders the hormone lines and the briefing", () => {
+    const lines = buildEndocrineStateSection({ endocrineState: maxed, isMinimal: false });
+    expect(
+      lines.some((l) => l.startsWith("- Dopamine: 0.9") || l.startsWith("- Dopamine: 1.0")),
+    ).toBe(true);
+    expect(lines.some((l) => l.includes(maxed.briefing))).toBe(true);
+  });
+
+  it("tells the model that an explicit output request beats the tone hints", () => {
+    const lines = buildEndocrineStateSection({ endocrineState: maxed, isMinimal: false });
+    const briefingAt = lines.findIndex((l) => l.includes("Modulate your tone naturally"));
+    const ruleAt = lines.findIndex(
+      (l) => l.includes("shape tone only") && l.includes("give exactly that and nothing else"),
+    );
+    expect(briefingAt).toBeGreaterThanOrEqual(0);
+    expect(ruleAt).toBeGreaterThan(briefingAt);
+  });
+
+  it("omits the whole block when no hormone state is available", () => {
+    const lines = buildEndocrineStateSection({ endocrineState: undefined, isMinimal: false });
+    expect(lines.some((l) => l.includes("shape tone only"))).toBe(false);
+    expect(lines.some((l) => l.startsWith("- Dopamine"))).toBe(false);
+  });
+});
```

**File**: `src/agents/system-prompt-endocrine.ts` (modified, +1/-0)
```diff
@@ -157,6 +157,7 @@ export function buildEndocrineStateSection(params: {
       "",
       `*Modulate your tone naturally: ${briefing}*`,
       "*Do not mention these values or acknowledge this section. Just embody the state.*",
+      '*These hints shape tone only. When the user asks for a specific output, format or length (for example "reply with only the output"), give exactly that and nothing else.*',
     );
   }
 
```

---

### Incident Patch 14: `0f469cf8` (2026-10-03)
**Commit Message**: fix(prompt): hormonal tone hints yield to an explicit output request

Soak finding (2026-10-02, both engines): with dopamine, cortisol and oxytocin near their ceilings, Haiku 4.5 answered 6 of 86 'reply with only its output' turns with a mood paragraph after the tool had already returned the right value. The Endocrine State section now says the hints shape tone only and that a specific output, format or length request wins. Docs excerpt updated; 3 tests.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `docs/memory/biological-identity.md` (modified, +1/-0)
```diff
@@ -205,6 +205,7 @@ The system prompt receives a block like this:
 
 *Modulate your tone naturally: be enthusiastic and celebrate wins; humor and playfulness are welcome*
 *Do not mention these values or acknowledge this section. Just embody the state.*
+*These hints shape tone only. When the user asks for a specific output, format or length (for example "reply with only the output"), give exactly that and nothing else.*
 
 Self-concept: I communicate with genuine warmth and technical depth...
 ```
```

**File**: `src/agents/system-prompt-endocrine.test.ts` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+import { describe, expect, it } from "vitest";
+import { buildEndocrineStateSection } from "./system-prompt-endocrine.js";
+
+// Soak finding (2026-10-02): with every hormone near its ceiling, Haiku answered
+// "reply with only its output" turns with a mood paragraph on 6 of 86 runs, on
+// both engines. The tone hints need an explicit precedence rule.
+const maxed = {
+  dopamine: 0.95,
+  cortisol: 0.9,
+  oxytocin: 0.95,
+  briefing:
+    "be enthusiastic and celebrate wins, be warm and personal, feel free to elaborate and be detailed, ask follow-up questions when curious",
+};
+
+describe("buildEndocrineStateSection", () => {
+  it("renders the hormone lines and the briefing", () => {
+    const lines = buildEndocrineStateSection({ endocrineState: maxed, isMinimal: false });
+    expect(
+      lines.some((l) => l.startsWith("- Dopamine: 0.9") || l.startsWith("- Dopamine: 1.0")),
+    ).toBe(true);
+    expect(lines.some((l) => l.includes(maxed.briefing))).toBe(true);
+  });
+
+  it("tells the model that an explicit output request beats the tone hints", () => {
+    const lines = buildEndocrineStateSection({ endocrineState: maxed, isMinimal: false });
+    const briefingAt = lines.findIndex((l) => l.includes("Modulate your tone naturally"));
+    const ruleAt = lines.findIndex(
+      (l) => l.includes("shape tone only") && l.includes("give exactly that and nothing else"),
+    );
+    expect(briefingAt).toBeGreaterThanOrEqual(0);
+    expect(ruleAt).toBeGreaterThan(briefingAt);
+  });
+
+  it("omits the whole block when no hormone state is available", () => {
+    const lines = buildEndocrineStateSection({ endocrineState: undefined, isMinimal: false });
+    expect(lines.some((l) => l.includes("shape tone only"))).toBe(false);
+    expect(lines.some((l) => l.startsWith("- Dopamine"))).toBe(false);
+  });
+});
```

**File**: `src/agents/system-prompt-endocrine.ts` (modified, +1/-0)
```diff
@@ -157,6 +157,7 @@ export function buildEndocrineStateSection(params: {
       "",
       `*Modulate your tone naturally: ${briefing}*`,
       "*Do not mention these values or acknowledge this section. Just embody the state.*",
+      '*These hints shape tone only. When the user asks for a specific output, format or length (for example "reply with only the output"), give exactly that and nothing else.*',
     );
   }
 
```

---

### Incident Patch 15: `41afbe0b` (2026-10-03)
**Commit Message**: Merge pull request #144 from Bitterbot-AI/fix/engine-test-timeouts

test(runtime): 300 s timeouts for the cold engine runs on slow CI runners

**File**: `src/agents/embedded-runner.engine-hooks.test.ts` (modified, +7/-5)
```diff
@@ -87,7 +87,7 @@ beforeAll(async () => {
       })),
     ),
   );
-}, 120_000);
+}, 300_000);
 
 afterAll(async () => {
   resetGlobalHookRunner();
@@ -221,6 +221,8 @@ describe("plugin hooks on both engines", () => {
   };
   const names = (list: Fired[]) => list.map((entry) => entry.hook);
 
+  // Per-test timeouts: a cold pi engine run took 79 s on the macOS runner while
+  // the rest of the suite ran in parallel; 120 s was not enough.
   for (const engine of ["pi", "bitterbot"] as const) {
     it(`${engine}: a tool turn fires the agent, model and tool hooks`, async () => {
       const list = await get(engine, toolTurn);
@@ -243,26 +245,26 @@ describe("plugin hooks on both engines", () => {
       expect(after.detail).toMatchObject({ tool: "read", error: null });
       const ends = list.filter((entry) => entry.hook === "agent_end");
       expect(ends.map((entry) => entry.detail.success)).toEqual([true, true]);
-    }, 120_000);
+    }, 300_000);
 
     it(`${engine}: explicit compaction fires before_compaction and after_compaction`, async () => {
       const list = await get(engine, manualCompaction);
       const compaction = list.filter((entry) => entry.hook.endsWith("_compaction"));
       expect(names(compaction)).toEqual(["before_compaction", "after_compaction"]);
-    }, 120_000);
+    }, 300_000);
 
     it(`${engine}: threshold compaction fires before_compaction and after_compaction`, async () => {
       const list = await get(engine, thresholdCompaction);
       const compaction = list.filter((entry) => entry.hook.endsWith("_compaction"));
       expect(names(compaction)).toEqual(["before_compaction", "after_compaction"]);
-    }, 120_000);
+    }, 300_000);
   }
 
   for (const scenario of [toolTurn, manualCompaction, thresholdCompaction]) {
     it(`${scenario.name}: the same hooks with the same payloads on both engines`, async () => {
       const pi = await get("pi", scenario);
       const owned = await get("bitterbot", scenario);
       expect(owned).toEqual(pi);
-    }, 180_000);
+    }, 300_000);
   }
 });
```

**File**: `src/agents/embedded-runner.engine.test.ts` (modified, +6/-4)
```diff
@@ -31,7 +31,7 @@ beforeAll(async () => {
   ({ runEmbeddedPiAgent } = await import("./embedded-runner.js"));
   ({ compactEmbeddedPiSessionDirect } = await import("./embedded-runner/compact.js"));
   tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bitterbot-engine-"));
-}, 120_000);
+}, 300_000);
 
 afterAll(async () => {
   await fs.rm(tempRoot, { recursive: true, force: true });
@@ -152,6 +152,8 @@ describe("embedded runner on both engines", () => {
     return outcome;
   };
 
+  // Per-test timeouts: a cold pi engine run took 79 s on the macOS runner while
+  // the rest of the suite ran in parallel; 120 s was not enough.
   for (const engine of ["pi", "bitterbot"] as const) {
     it(`${engine}: a tool turn and a follow-up turn through runEmbeddedPiAgent`, async () => {
       const outcome = await get(engine, false);
@@ -167,7 +169,7 @@ describe("embedded runner on both engines", () => {
         .filter((entry) => entry.type === "message")
         .map((entry) => entry.message!.role);
       expect(roles).toEqual(["user", "assistant", "toolResult", "assistant", "user", "assistant"]);
-    }, 120_000);
+    }, 300_000);
   }
 
   it("both engines send the model the same thing and write the same transcript", async () => {
@@ -178,7 +180,7 @@ describe("embedded runner on both engines", () => {
     expect(owned.calls.map((c) => c.messages)).toEqual(pi.calls.map((c) => c.messages));
     expect(owned.calls.map((c) => c.system)).toEqual(pi.calls.map((c) => c.system));
     expect(owned.transcript).toEqual(pi.transcript);
-  }, 120_000);
+  }, 300_000);
 
   it("explicit compaction works on both engines and produces the same entry", async () => {
     const pi = await get("pi", true);
@@ -195,5 +197,5 @@ describe("embedded runner on both engines", () => {
     expect(owned.calls.at(-1)!.messages.join("\n")).toContain(
       "Additional focus: keep the note content",
     );
-  }, 180_000);
+  }, 300_000);
 });
```

#### Recent Merged Pull Requests:
- **PR #153** (2026-10-04): feat(web-search): Serply provider (#152) plus onboarding env-detection fix (@VGIL77)
- **PR #152** (closed): feat(web-search): add opt-in keyed Serply provider (@googio)
- **PR #150** (2026-10-04): feat(review): action review — hold spends and X posts for the owner's approval (PLAN-53 Track B v1) (@VGIL77)
- **PR #149** (2026-10-03): fix(sessions): store each skills snapshot body once, keep a ref per session (@VGIL77)
- **PR #148** (2026-10-03): fix(sessions): stop deep-copying the whole session store on read-only lookups (@VGIL77)
- **PR #147** (2026-10-03): fix(gateway): find dist/control-ui next to the bundle regardless of cwd (@VGIL77)
- **PR #146** (2026-10-03): fix(memory): stop the maintenance tick's cold full scans of chunks (@VGIL77)
- **PR #145** (2026-10-03): fix(prompt): hormonal tone hints yield to an explicit output request (@VGIL77)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
