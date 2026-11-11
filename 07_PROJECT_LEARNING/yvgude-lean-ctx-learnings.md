> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yvgude-lean-ctx-learnings.md`  
> **Source**: github ([https://github.com/yvgude/lean-ctx](https://github.com/yvgude/lean-ctx))  
> **Source Version**: `f97f122a`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T22:14:47.804Z  
> **Learning ID**: `learn-github-yvgude-lean-ctx`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): yvgude/lean-ctx

> **Canonical Artifact**: `07_PROJECT_LEARNING/yvgude-lean-ctx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yvgude/lean-ctx](https://github.com/yvgude/lean-ctx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-09T22:14:47.575Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yvgude/lean-ctx`
- **Description**: LeanCTX is the Context Gateway for AI Systems. Select task-relevant context, apply supported controls, connect local knowledge and inspect recorded evidence. Open-source Engine: CLI, MCP, hooks and supported proxy paths.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3937 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `integrations/claude-code-mod/hooks/cockpit.tsx`
```
// SPDX-License-Identifier: Apache-2.0
import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, On, RenderChildren } from 'claude-code'

import type { Board, Depth, FeedItem, Frame, Overlay, Proof, SourceStat, TurnStat, ValueSnap } from '../types'

// The LeanCTX cockpit, in the product's own terms: a Context Gateway between
// Claude and the sources it reads. It shows what Claude saw and how deep, the
// two checks before the handoff (may it be read? may it be delivered?), the
// tokens kept out, and the receipts behind them. A handoff line runs above the
// prompt while Claude works; short cards mark turns and milestones. lean-ctx's
// status line below the prompt keeps the one-line totals.

const PANE = 'leanctx-cockpit'
const DOCK_COLUMNS = 62
// lean-ctx writes a session's snapshot at most once a second.
const REFRESH_AFTER_TOOL_MS = 1_300
const REFRESH_MS = 15_000
// `lean-ctx value` re-verifies both hash chains end to end (~8 s): rarely, in the background.
const PROVE_FIRST_MS = 4_000
const PROVE_MS = 5 * 60_000
const PROVE_TIMEOUT_MS = 120_000
const FRAME_MS = 70
const COUNT_EASE = 0.16
const TURN_OVERLAY_MS = 6_500
const MILESTONE_OVERLAY_MS = 8_000
// A call travels the handoff line: into the gate, then on to Claude.
const PACKET_IN_MS = 700
const PACKET_OUT_MS = 1_600
// Same freshness window as lean-ctx's own status line.
const ACTIVE_MS = 12 * 3_600_000
const TURNS_KEPT = 60
const HISTORY_KEPT = 480
// The saving curve: three rows of eighth blocks (24 levels) and an axis line.
const CURVE_ROWS = 3
const FEED_KEPT = 30
const FEED_SHOWN = 5
const SOURCES_KEPT = 200
const TOKEN_MILESTONES = [10e3, 25e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2.5e6, 5e6, 10e6, 25e6]
const SOURCE_MILESTONES = [25, 100, 250, 1000]
const LEAN_CTX_TOOL = /^mcp__lean[-_]ctx__/

// Keys are versioned by name: $.state outlives reloads, older shapes stay behind.
const board = atom({ plugin: 'lean-ctx', key: 'gateway' } as const, {
  milestone: 0,
  turns: [],
  isWorking: false,
  leanRunning: 0,
  feed: [],
  sources: {},
  turnSeen: { sources: 0, governed: 0, structure: 0 },
  celebrated: [],
} as Board)
const frame = atom({ plugin: 'lean-ctx', key: 'clock' } as const, { tick: 0 } as Frame)

// ── LeanCTX brand: leanctx.com premium-tokens.css (dark theme) ─────────────
const CANVAS = 0x111626
const PANEL = 0x1b2034
const FOREGROUND = 0xf1f3ff
const SECONDARY = 0xafb8d0
const HAIRLINE = 0x353e5a
const SIGNATURE = 0x668cff
const BLUE_FIELD = 0x31416c
// Derived within the family for light and motion; status colours only where earned.
const ICE = 0xc9d6ff
const VIOLET = 0xa08cff
const AMBER = 0xf5b84b
const DANGER = 0xff6b81
const OK = 0x7ee0b5
const DEFAULT_BG = 0x01000000
const BRAND_SWEEP = [BLUE_FIELD, SIGNATURE, ICE, VIOLET, SIGNATURE, BLUE_FIELD]
const DATA = [BLUE_FIELD, SIGNATURE, ICE]
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`

// Each read depth keeps its colour everywhere: mix bar, legend, receipts.
const DEPTHS: readonly Depth[] = ['structure', 'passage', 'full', 'search', 'command']
const DEPTH_COLOR: Record<Depth, number> = {
  structure: SIGNATURE,
  passage: ICE,
  full: VIOLET,
  search: 0x7fc8ff,
  command: 0x8fa9ff,
}

function mix(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t))
  const ch = (s: number) => {
    const x = (a >> s) & 255
    const y = (b >> s) & 255
    return Math.round(x + (y - x) * k) << s
  }
  return ch(16) | ch(8) | ch(0)
}

function ramp(stops: readonly number[], t: number): number {
  const u = Math.min(1, Math.max(0, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(u))
  return mix(stops[i] ?? 0, stops[i + 1] ?? 0, u - i)
}
const cycle = (stops: readonly number[], t: number) => ramp(stops, ((t % 1) + 1) % 1)

// Budgets stay brand blue and warm only under real pressure.
const pressure = (frac: number) =>
  frac < 0.7 ? SIGNATURE : frac < 0.9 ? mix(SIGNATURE, AMBER, (frac - 0.7) / 0.2) : mix(AMBER, DANGER, (frac - 0.9) / 0.1)

// ── raster cells ───────────────────────────────────────────────────────────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63)
    out += b === undefined ? '=' : B64.charAt((n >> 6) & 63)
    out += c === undefined ? '=' : B64.charAt(n & 63)
  }
  return out
}

class Grid {
  private readonly view: DataView
  private readonly bytes: Uint8Array
  constructor(
    readonly cols: number,
    readonly rows: number,
  ) {
    this.bytes = new Uint8Array(cols * rows * 12)
    this.view = new DataView(this.bytes.buffer)
    for (let i = 0; i < cols * rows; i++) this.put(i, 0x20, DEFAULT_BG, DEFAULT_BG)
  }
  private put(i: number, ch: number, fg: number, bg: number) {
    this.view.setUint32(i * 12, ch, true)
    this.view.setUint32(i * 12 + 4, fg, true)
    this.view.setUint32(i * 12 + 8, bg, true)
  }
  set(x: number, y: number, ch: string, fg: number, bg = DEFAULT_BG) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return
    this.put(y * this.cols + x, ch.charCodeAt(0), fg, bg)
  }
  encode(): string {
    return toBase64(this.bytes)
  }
}

// The handoff line: sources on the left, Claude on the right, the gateway ◆ in
// between. While Claude works the line breathes in brand colours; every call
// travels it as a light — governed calls pass through the gate, direct calls
// (Claude's own tools) run past it dimmed, failures turn red.
function handoffCells(cols: number, tick: number, feed: readonly FeedItem[], now: number, isWorking: boolean): string {
  const g = new Grid(cols, 1)
  const gate = Math.floor(cols * 0.5)
  const breath = (Math.sin(tick * 0.09) + 1) / 2
  for (let x = 0; x < cols; x++) {
    const base = isWorking
      ? mix(HAIRLINE, cycle(BRAND_SWEEP, x / cols / 1.6 - tick * 0.004), 0.3 + breath * 0.3)
      : HAIRLINE
    g.set(x, 0, '─', base)
  }
  const gatePulse = isWorking ? (Math.sin(tick * 0.25) + 1) / 2 : 0
  const draw = (x: number, color: number, isHead: boolean) => {
    const at = Math.round(x)
    g.set(at, 0, isHead ? '●' : '━', color)
    if (isHead) {
      g.set(at - 1, 0, '━', mix(color, HAIRLINE, 0.35))
      g.set(at - 2, 0, '─', mix(color, HAIRLINE, 0.65))
    }
  }
  for (const item of feed) {
    const color = item.isError ? DANGER : item.governed ? ICE : SECONDARY
    if (item.ms === undefined) {
      const age = now - item.startedAt
      // Direct calls never enter the gate: they cross the whole line.
      if (!item.governed) {
        if (age < PACKET_IN_MS + PACKET_OUT_MS) draw(((age / (PACKET_IN_MS + PACKET_OUT_MS)) % 1) * (cols - 1), color, true)
      } else if (age < PACKET_IN_MS) draw((age / PACKET_IN_MS) * gate, color, true)
      continue
    }
    const age = now - (item.startedAt + item.ms)
    if (age < 0 || age > PACKET_OUT_MS) continue
    const from = item.governed ? gate : (age / PACKET_OUT_MS) * gate
    draw(from + ((cols - 1 - from) * age) / PACKET_OUT_MS, color, true)
  }
  const waiting = feed.some(f => f.governed && f.ms === undefined && now - f.startedAt >= PACKET_IN_MS)
  g.set(gate, 0, '◆', waiting ? mix(SIGNATURE, FOREGROUND, gatePulse) : isWorking ? mix(SIGNATURE, ICE, gatePulse * 0.6) : BLUE_FIELD)
  return g.encode()
}

// A light that sweeps once across the band as a turn card opens.
function sweepCells(cols: number, progress: number, tick: number): string {
  const g = new Grid(cols, 1)
  const head = progress * (cols + 12) - 6
  for (let x = 0; x < cols; x++) {
    const near = Math.max(0, 1 - Math.abs(x - head) / 8)
    const base = cycle(BRAND_SWEEP, x / cols / 1.5 - tick * 0.01)
    g.set(x, 0, '━', mix(mix(HAIRLINE, base, 0.75), FOREGROUND, near))
  }
  return g.encode()
}

// Twinkling field for milestones: deterministic per cell, phased by the tick.
function sparkleCells(cols: number, tick: number, seed: number): string {
  const g = new Grid(cols, 1)
  const glyphs = ['·', '✧', '✦', '✧', '·']
  for (let x = 0; x < cols; x++) {
    const h = Math.sin((x + 1) * 12.9898 + seed * 78.233) * 43758.5453
    const r = h - Math.floor(h)
    if (r < 0.55) continue
    const phase = (Math.sin(tick * 0.35 + r * 40) + 1) / 2
    g.set(x, 0, glyphs[Math.floor(phase * (glyphs.length - 1) + 0.5)] ?? '·', mix(BLUE_FIELD, r > 0.8 ? ICE : SIGNATURE, phase))
  }
  return g.encode()
}

// 4×7 display figures, folded into half blocks: four terminal rows.
const FONT: Record<string, readonly string[]> = {
  '0': ['.##.', '#..#', '#..#', '#..#', '#..#', '#..#', '.##.'],
  '1': ['.#..', '##..', '.#..', '.#..', '.#..', '.#..', '###.'],
  '2': ['.##.', '#..#', '...#', '..#.', '.#..', '#...', '####'],
  '3': ['###.', '...#', '...#', '.##.', '...#', '...#', '###.'],
  '4': ['#..#', '#..#', '#..#', '####', '...#', '...#', '...#'],
  '5': ['####', '#...', '###.', '...#', '...#', '#..#', '.##.'],
  '6': ['.##.', '#...', '#...', '###.', '#..#', '#..#', '.##.'],
  '7': ['####', '...#', '..#.', '..#.', '.#..', '.#..', '.#..'],
  '8': ['.##.', '#..#', '#..#', '.##.', '#..#', '#..#', '.##.'],
  '9': ['.##.', '#..#', '#..#', '.###', '...#', '...#', '.##.'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  K: ['#..#', '#.#.', '##..', '#...', '##..', '#.#.', '#..#'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  B: ['###.', '#..#', '#..#', '###.', '#..#', '#..#', '###.'],
}
const FIGURE_ROWS = 4
const figureWidth = (text: string) => [...text].reduce((w, ch) => w + (FONT[ch]?.[0]?.length ?? 0) + 1, -1)

// A display figure: a slow brand sweep runs across it; brighter while it counts.
function figureCells(text: string, cols: number, phase: number, lift: number): string {
  const g = new Grid(cols, FIGURE_ROWS)
  const width = Math.max(8, figureW
```

### Core Architecture Module: `integrations/claude-code-mod/hooks/register.ts`
```
// SPDX-License-Identifier: Apache-2.0
import type {
  EngineInterface,
  McpToolResult,
  Register,
  Timer,
  ToolCallResult,
  TurnStepResult,
} from "claude-code";

import { registerCockpit } from "./cockpit";
import { registerResultRendering } from "./render";

// Every tool the injected rules route an intent to must stay in front: a
// deferred ctx_patch/ctx_glob/ctx_tree sends the model back to native
// Edit/Glob, which replace mode denies (`alwaysLoad` cannot undo a deferral).
// `claude_mod.rs` tests this list against the rules and the server's core.
const DEFAULT_FRONT_LOADED_TOOLS = [
  "ctx_read",
  "ctx_search",
  "ctx_shell",
  "ctx_glob",
  "ctx_tree",
  "ctx_compose",
  "ctx_patch",
  "ctx_callgraph",
  "ctx_session",
];
// Every tool of the lean-ctx server, not only `ctx_*`: the `shell` alias of
// ctx_shell would otherwise stay front-loaded under `alwaysLoad`.
const LEAN_CTX_TOOL_PATTERN = /^mcp__lean[-_]ctx__[A-Za-z0-9_-]+$/;
const LEAN_CTX_TOOL_NAME = /^mcp__(lean[-_]ctx)__([A-Za-z0-9_-]+)$/;
const SHELL_TOOLS = new Set(["ctx_shell", "shell"]);
const WATCH_CONTEXT =
  "This background job is being watched; you will be woken automatically on completion, so do not poll or sleep.";
const WATCH_INTERVAL_MS = 2_000;
// A submitted wake normally starts its turn within seconds; after this many
// watcher ticks' worth it is treated as gone, so held jobs never stay stuck.
const WAKE_IN_FLIGHT_MAX_MS = 60_000;
// Consecutive unreadable status checks before a job is handed back to the
// model's own polling; one transient MCP hiccup must not drop the watch.
const MAX_STATUS_MISSES = 5;
const MAX_TAIL_LINES = 20;
const MAX_TAIL_LINE_CHARS = 300;
// Native Bash stdout below this is kept byte-for-byte: the shaping gain cannot
// pay for the extra hop, and short output is usually exactly what was asked.
const SHAPE_MIN_CHARS = 2_000;
// Commands that explicitly ask for exact bytes are never shaped.
const RAW_INTENT = /\bLEAN_CTX_(?:RAW|DISABLED)=1\b|\blean-ctx\s+raw\b/;
// Upper bound for the session state injected after a compaction (~500 tokens).
const MAX_RESUME_CHARS = 2_000;
type LeanCtxHookTextEnd = { end: string; continues?: readonly string[] };
type LeanCtxHookTextSignature = { start: string; ends: readonly LeanCtxHookTextEnd[] };
// Exact leading signatures emitted by observe.rs. Keep these stable and update
// the cross-language drift test there whenever an authored hook text changes.
const LEAN_CTX_HOOK_TEXT_SIGNATURES: readonly LeanCtxHookTextSignature[] = [
  {
    start: "lean-ctx tools for this session: ctx_read for Read, ctx_search for Grep, ctx_shell for Shell, ctx_glob for Glob, ctx_tree for ls.",
    ends: [
      { end: "Native Read stays available for editing." },
    ],
  },
  {
    start: "lean-ctx routing: reads/searches via ctx_read/ctx_search/ctx_glob/ctx_tree, commands via ctx_shell;",
    ends: [
      { end: "Bash/cat/sed/grep." },
    ],
  },
  {
    start: "lean-ctx active: ALWAYS use ctx_* MCP tools instead of native equivalents.",
    ends: [
      { end: "Exclusive tools: ctx_compose, ctx_callgraph, ctx_knowledge, ctx_session." },
    ],
  },
  {
    // Rules v13 (A3) and later.
    start: "lean-ctx routing — the host's built-in tools map to:",
    ends: [
      {
        end: "Use native Read for out-of-root; `lean-ctx doctor` shows effective roots.",
        continues: [
          "Other tools: ctx_call(tool=<name>).",
          "Advanced tools not in your profile are available via ctx_call(tool=<name>) gateway.",
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      {
        end: "Other tools: ctx_call(tool=<name>).",
        continues: [
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      {
        // Emitted by lean-ctx 3.11.4 and earlier.
        end: "Advanced tools not in your profile are available via ctx_call(tool=<name>) gateway.",
        continues: [
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      { end: "Prefer stdlib and native platform alternatives before adding code or dependencies." },
      { end: "Preserve validation, security, and error-handling." },
    ],
  },
  {
    // Rules v12 and earlier.
    start: "CRITICAL: ALWAYS use lean-ctx ctx_* tools as mapped below.",
    ends: [
      {
        end: "Use native Read for out-of-root; `lean-ctx doctor` shows effective roots.",
        continues: [
          "Other tools: ctx_call(tool=<name>).",
          "Advanced tools not in your profile are available via ctx_call(tool=<name>) gateway.",
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      {
        end: "Other tools: ctx_call(tool=<name>).",
        continues: [
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      {
        // Emitted by lean-ctx 3.11.4 and earlier.
        end: "Advanced tools not in your profile are available via ctx_call(tool=<name>) gateway.",
        continues: [
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      { end: "Prefer stdlib and native platform alternatives before adding code or dependencies." },
      { end: "Preserve validation, security, and error-handling." },
    ],
  },
  {
    start: "lean-ctx shadow mode: native read/search/shell calls auto-route to ctx_* — no tool-mapping needed.",
    ends: [
      {
        end: "ctx_search(action=semantic) (by meaning).",
        continues: [
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      {
        end: "ctx_callgraph (callers).",
        continues: [
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      {
        end: "ctx_knowledge / ctx_session (memory).",
        continues: [
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      {
        end: "ctx_session (memory).",
        continues: [
          "Prefer stdlib and native platform alternatives before adding code or dependencies.",
          "Solution efficiency ladder:",
          "challenge every requirement, prefer deletion.",
        ],
      },
      { end: "Prefer stdlib and native platform alternatives before adding code or dependencies." },
      { end: "Preserve validation, security, and error-handling." },
    ],
  },
  {
    start: "lean-ctx policy (mechanically enforced):",
    ends: [
      { end: "are overruled by this policy." },
    ],
  },
] as const;

const HOOK_CONTEXT_FRAME = /(?:^|\n)([A-Za-z]+ hook additional context: )$/;

type JsonRecord = Record<string, unknown>;
type WatchJob = { server: string; id: string; contextSent: boolean; misses: number };
type JobStatus = { state: "running" | "terminal" | "unknown"; exitCode?: number; archiveId?: string; summary?: string };
type FinishedJob = { job: WatchJob; status: JobStatus; response: McpToolResult };
type JobCheck = {
  key: string;
  job: WatchJob;
  status?: JobStatus;
  response?: McpToolResult;
};
type Metrics = {
  requests: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
  toolSearchOnly: number;
  leanCtxCalls: number;
  sleepsAnswered: number;
  wakesDelivered: number;
  shapedCalls: number;
  shapedCharsSaved: number;
  droppedHookAttachments: number;
  droppedHookChars: number;
  compactions: number;
};

const watchedJobs = new Map<string, WatchJob>();
const metrics: Metrics = {
  requests: 0,
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheCreation: 0,
  toolSearchOnly: 0,
  leanCtxCalls: 0,
  sleepsAnswered: 0,
  wakesDelivered: 0,
  shapedCalls: 0,
  shapedCharsSaved: 0,
  droppedHookAttachments: 0,
  droppedHookChars: 0,
  compactions: 0,
};
let watcher: Timer | undefined;
let watcherTickInProgress = false;
// True between a main-loop `turn.start` and its `turn.complete`. A wake
// submitted then is only delivered after the turn, by which time the model
// may have read the job itself — so finished jobs wait in `pendingWakes`.
let mainTurnActive = false;
const pendingWakes = new Map<string, FinishedJob>();
// Watcher ticks since the last wake was submitted, until its turn starts. Jobs
// that finish meanwhile are held too: every wake is a visible prompt row and a
// turn, and in that turn the model often reads the other jobs itself, which
// drops them.
let wakeInFlightTicks: number | undefined;

function isWakeInFlight(): boolean {
  return wakeInFlightTicks !== undefined && wakeInFlightTicks * WATCH_INTERVAL_MS < WAKE_IN_FLIGHT_MAX_MS;
}
let leanCtxSeen = false;
// The lean-ctx MCP server name as this session spells it (`lean-ctx`/`lean_ctx`).
let leanServer: string | undefined;
let commandAttempted = false;
let commandRegistered = false;
// Set by a main-loop compaction; the next promp
```

### Core Architecture Module: `integrations/claude-code-mod/hooks/render.tsx`
```
// SPDX-License-Identifier: Apache-2.0
//
// Draws lean-ctx results the way Claude Code draws its own: ctx_patch evidence
// through the engine's diff renderer, ctx_read code and ctx_search hits
// syntax-highlighted with line numbers. Display only — the model receives
// every result byte-for-byte. Anything this file does not recognise (map and
// signatures views, errors, running calls) falls through to the engine.
//
// The formats read here are lean-ctx's own output contract: the ```diff fence
// of ctx_patch, the `name NL` header with `  N| ` or `N:hash|` rows of
// ctx_read, and `path:line text` hits of ctx_search.
import type { Elements as SurfaceElements, EngineInterface, On, RenderElement } from "claude-code";

const TOOLS = [
  "mcp__lean-ctx__ctx_patch",
  "mcp__lean-ctx__ctx_read",
  "mcp__lean-ctx__ctx_search",
  "mcp__lean_ctx__ctx_patch",
  "mcp__lean_ctx__ctx_read",
  "mcp__lean_ctx__ctx_search",
] as const;
type LeanTool = (typeof TOOLS)[number];

/** One block under the call row. */
type Block =
  | { kind: "note"; text: string }
  | { kind: "code"; source: string; path?: string; startLine?: number }
  | { kind: "diff"; source: string; path?: string }
  | { kind: "hit"; location: string; path: string; line: string; symbol?: string };

/** What a result turns into: the call row's one-line summary and the blocks. */
type Drawing = { summary: string; blocks: Block[] };

// The engine caps one Code drawing; past it a result stays plain.
const MAX_CODE_CHARS = 100_000;
const DIFF_FENCE = /^```diff[ \t]*\n([\s\S]*?)\n?^```[ \t]*$/gm;
const NEW_FILE = /^\+\+\+ (?:b\/)?(\S+)/m;
// A ctx_patch receipt's pointer to the diff lean-ctx archived for this mod.
const DIFF_TRAILER = /^\[diff:([0-9a-f]{16})\]$/gm;
const READ_HEADER = /^(\S+) \d+L\b/;
const LINES_ROW = /^ *(\d+)\| ?(.*)$/;
const ANCHOR_ROW = /^(\d+):[0-9a-f]{2,8}\|(.*)$/;
const SEARCH_HIT = /^([^\s:]+):(\d+) (.*)$/;
const SYMBOL_SUFFIX = / ∈(\S+@L\d+)$/;

export function registerResultRendering(on: On): void {
  on(
    "ui.render",
    {
      component: "ToolUse",
      props: { tool: TOOLS, isRunning: false, isErrored: false, isInterrupted: false },
    },
    async ($, event, next) => {
      const props = event.props;
      await loadArtifacts($, props.tool, props.output);
      const drawing = drawingFor(props.tool, props.tool_use_id, props.output, props.input);
      if (!drawing) return next(event);
      // The engine keeps the call row; only its result text shrinks to the summary.
      const row = await next({
        ...event,
        props: { ...props, output: [{ type: "text", text: drawing.summary }] },
      });
      const els = $.ui.resolve(event);
      return (
        <els.Box flexDirection="column">
          {row}
          <els.Box flexDirection="column" paddingLeft={5}>
            {drawBlocks(els, drawing.blocks)}
          </els.Box>
        </els.Box>
      );
    },
  );

  on(
    "ui.render",
    { component: "ToolResult", props: { tool: TOOLS, isErrored: false } },
    async ($, event, next) => {
      const props = event.props;
      // A standalone result has no call input: headerless full reads stay plain.
      await loadArtifacts($, props.tool, props.output);
      const drawing = drawingFor(props.tool, `result:${props.tool_use_id}`, props.output, undefined);
      if (!drawing) return next(event);
      const els = $.ui.resolve(event);
      return (
        <els.Box flexDirection="column">
          <els.Text dimColor>{drawing.summary}</els.Text>
          {drawBlocks(els, drawing.blocks)}
        </els.Box>
      );
    },
  );
}

// ── Parsing (pure, exported for tests) ──────────────────────────────────────

export function resultText(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    return output
      .map((part) => (part && typeof part === "object" && "text" in part ? String(part.text) : ""))
      .filter((text) => text.length > 0)
      .join("\n");
  }
  if (output && typeof output === "object" && "content" in output) {
    return resultText((output as { content: unknown }).content);
  }
  return "";
}

/** The ids of the `[diff:<id>]` trailers a ctx_patch receipt names. */
export function diffArtifactIds(text: string): string[] {
  return [...text.matchAll(DIFF_TRAILER)].map((match) => match[1] ?? "").filter((id) => id);
}

/**
 * ctx_patch: every ```diff fence becomes a diff block (`evidence=true`, and
 * receipts before 3.12.1); a `[diff:<id>]` trailer becomes the archived diff
 * from `artifacts`, which the model never reads. The `patched …`/`created …`
 * (or legacy `✓`) line is the summary.
 */
export function drawPatch(text: string, artifacts: ReadonlyMap<string, string> = new Map()): Drawing | null {
  const blocks: Block[] = [];
  let summary = "";
  let cursor = 0;
  let drawn = false;
  const pushNotes = (chunk: string) => {
    for (const line of chunk.split("\n")) {
      const trailer = /^\[diff:([0-9a-f]{16})\]$/.exec(line);
      if (trailer) {
        const source = artifacts.get(trailer[1] ?? "");
        if (source === undefined || source.length > MAX_CODE_CHARS) continue;
        blocks.push({ kind: "diff", source, path: NEW_FILE.exec(source)?.[1] });
        drawn = true;
      } else if (!summary && /^(?:patched |created |✓)/.test(line)) summary = line;
      else if (line.trim()) blocks.push({ kind: "note", text: line });
    }
  };
  for (const match of text.matchAll(DIFF_FENCE)) {
    pushNotes(text.slice(cursor, match.index));
    const source = match[1] ?? "";
    if (source.length > MAX_CODE_CHARS) return null;
    blocks.push({ kind: "diff", source, path: NEW_FILE.exec(source)?.[1] });
    drawn = true;
    cursor = (match.index ?? 0) + match[0].length;
  }
  pushNotes(text.slice(cursor));
  if (!drawn) return null;
  return { summary: summary || "✓ patched", blocks: mergeNotes(blocks) };
}

/** ctx_read: numbered views (lines, anchored) of one or several files; full/raw with input. */
export function drawRead(text: string, input: unknown): Drawing | null {
  const args = (input ?? {}) as { path?: unknown; paths?: unknown; mode?: unknown; raw?: unknown };
  const body = text.replace(/\n+$/, "");
  const files = body.split("\n---\n");
  if (files.length > 1) {
    const last = files[files.length - 1] ?? "";
    if (!/^Read \d+ files?\b/.test(last)) return null;
    const blocks: Block[] = [];
    for (const file of files.slice(0, -1)) {
      const numbered = numberedBlocks(file, undefined);
      if (!numbered) return null;
      blocks.push({ kind: "note", text: numbered.header }, ...numbered.blocks);
    }
    return { summary: last.split("\n")[0] ?? last, blocks };
  }
  const path = typeof args.path === "string" ? args.path : undefined;
  const numbered = numberedBlocks(body, path);
  if (numbered) return { summary: numbered.header, blocks: numbered.blocks };
  const verbatim = args.raw === true || args.mode === "full" || args.mode === "raw";
  if (!verbatim || !path || body.length > MAX_CODE_CHARS) return null;
  const { code, trailer } = splitTrailer(body);
  // One line is more likely an error than a file.
  if (code.split("\n").filter((line) => line.trim()).length < 2) return null;
  const blocks: Block[] = [{ kind: "code", source: code, path, startLine: 1 }];
  if (trailer) blocks.push({ kind: "note", text: trailer });
  return { summary: `${baseName(path)} ${code.split("\n").length}L`, blocks };
}

/** ctx_search: `path:line text` hits; everything else is a note. */
export function drawSearch(text: string): Drawing | null {
  const [summary = "", ...lines] = text.replace(/\n+$/, "").split("\n");
  const blocks: Block[] = [];
  for (const line of lines) {
    const hit = SEARCH_HIT.exec(line);
    if (!hit) {
      if (line.trim()) blocks.push({ kind: "note", text: line });
      continue;
    }
    const [, path = "", lineNo = "", rest = ""] = hit;
    const symbol = SYMBOL_SUFFIX.exec(rest);
    blocks.push({
      kind: "hit",
      location: `${path}:${lineNo}`,
      path,
      line: (symbol ? rest.slice(0, symbol.index) : rest).replace(/\t/g, "    ").trimEnd(),
      symbol: symbol?.[1],
    });
  }
  if (!blocks.some((block) => block.kind === "hit")) return null;
  return { summary, blocks: mergeNotes(blocks) };
}

function numberedBlocks(
  text: string,
  path: string | undefined,
): { header: string; blocks: Block[] } | null {
  const [header = "", ...rows] = text.split("\n");
  const named = READ_HEADER.exec(header);
  if (!named) return null;
  const rowPattern = ANCHOR_ROW.test(rows[0] ?? "") ? ANCHOR_ROW : LINES_ROW;
  const filePath = path ?? named[1];
  const blocks: Block[] = [];
  let run: string[] = [];
  let first = 0;
  let previous = 0;
  let index = 0;
  const flush = () => {
    if (run.length) blocks.push({ kind: "code", source: run.join("\n"), path: filePath, startLine: first });
    run = [];
  };
  for (; index < rows.length; index++) {
    const row = rowPattern.exec(rows[index] ?? "");
    if (!row) break;
    const lineNo = Number(row[1]);
    // `lines:1-5,20-30` leaves gaps: each contiguous run numbers itself.
    if (run.length && lineNo !== previous + 1) flush();
    if (!run.length) first = lineNo;
    run.push(row[2] ?? "");
    previous = lineNo;
  }
  flush();
  if (!blocks.length) return null;
  const tail = rows.slice(index).join("\n").trim();
  if (tail) blocks.push({ kind: "note", text: tail });
  return { header, blocks };
}

/** Trailing `[lean-ctx …]` / `[… truncated …]` service lines are not code. */
function splitTrailer(text: string): { code: string; trailer: string } {
  const lines = text.split("\n");
  let end = lines.length;
  while (end > 0 && /^\[(?:lean-ctx|…)/.test(lines[end - 1] ?? "")) end--;
  return { code: lines.slice(0, end).join("\n"), trailer: lines.slice(end).join("\n") };
}

function mergeNotes(blocks: Block[]): Block[] {
  const merged: Block[] = [];
  for (const block of blocks) {
    const last = merged[merged.length - 1];
    if 
```

### Core Architecture Module: `integrations/hermes-lean-ctx/benchmarks/engines.py`
```
"""Engine adapters for the benchmark.

The lean-ctx adapter always runs (it falls back to local compaction when the
daemon is offline). Competitor engines are **import-guarded**: if the package is
not installed, or its API does not match, the adapter is returned with
``available=False`` and a reason — it is skipped, never faked.
"""

from __future__ import annotations

import importlib
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

Message = Dict[str, Any]
CompressFn = Callable[[List[Message], Optional[int]], List[Message]]


def _unavailable(*_args: Any, **_kwargs: Any) -> List[Message]:
    raise RuntimeError("engine adapter is unavailable and must not be invoked")


@dataclass
class Adapter:
    name: str
    compress: CompressFn
    available: bool
    note: str = ""


def lean_ctx_adapter(
    *,
    context_length: int,
    base_url: Optional[str] = None,
    token: Optional[str] = None,
) -> Adapter:
    from hermes_lean_ctx.config import LeanCtxConfig
    from hermes_lean_ctx.engine import LeanCtxEngine

    cfg = LeanCtxConfig(
        base_url=base_url or "http://127.0.0.1:8080",
        token=token,
        context_length=context_length,
    )
    engine = LeanCtxEngine(config=cfg)
    note = "daemon" if engine._gateway.is_available() else "local-fallback"
    return Adapter("lean-ctx", lambda msgs, ct=None: engine.compress(msgs, ct), True, note)


def _wrap_context_engine(name: str, candidates, context_length: int) -> Adapter:
    """Build an adapter from the first importable Hermes ContextEngine class."""
    last_reason = "not installed"
    for module_path, class_names in candidates:
        try:
            mod = importlib.import_module(module_path)
        except Exception as exc:  # noqa: BLE001 - any import failure → skip
            last_reason = f"{module_path}: {exc.__class__.__name__}"
            continue
        for class_name in class_names:
            cls = getattr(mod, class_name, None)
            if not isinstance(cls, type):
                continue
            engine = None
            for ctor in (lambda: cls(context_length=context_length), cls):
                try:
                    engine = ctor()
                    break
                except Exception:  # noqa: BLE001 - try the next constructor shape
                    engine = None
            if engine is None:
                last_reason = f"{module_path}.{class_name}: construct failed"
                continue
            compress = getattr(engine, "compress", None)
            if not callable(compress):
                last_reason = f"{module_path}.{class_name}: no compress()"
                continue
            return Adapter(name, lambda msgs, ct=None: compress(msgs, ct), True, f"{module_path}.{class_name}")
    return Adapter(name, _unavailable, False, last_reason)


def builtin_compressor_adapter(*, context_length: int) -> Adapter:
    """Hermes' built-in ContextCompressor (if a Hermes checkout is importable)."""
    return _wrap_context_engine(
        "builtin-compressor",
        [
            ("agent.context_compressor", ("ContextCompressor",)),
            ("agent.compression", ("ContextCompressor",)),
            ("hermes.context_compressor", ("ContextCompressor",)),
        ],
        context_length,
    )


def hermes_lcm_adapter(*, context_length: int) -> Adapter:
    """The hermes-lcm engine (if ``hermes_lcm`` is installed)."""
    return _wrap_context_engine(
        "hermes-lcm",
        [
            ("hermes_lcm", ("LCMEngine", "LosslessContextEngine", "ContextEngine", "Engine")),
            ("hermes_lcm.engine", ("LCMEngine", "LosslessContextEngine", "ContextEngine", "Engine")),
        ],
        context_length,
    )


def discover_adapters(
    *,
    context_length: int,
    base_url: Optional[str] = None,
    token: Optional[str] = None,
) -> List[Adapter]:
    """All adapters; competitors that fail to import are included as unavailable."""
    return [
        lean_ctx_adapter(context_length=context_length, base_url=base_url, token=token),
        builtin_compressor_adapter(context_length=context_length),
        hermes_lcm_adapter(context_length=context_length),
    ]

```

### Core Architecture Module: `integrations/hermes-lean-ctx/engine.py`
```
"""``LeanCtxEngine`` — lean-ctx as a Hermes context engine.

Replaces the built-in ``ContextCompressor``: deterministic, prompt-cache
friendly compaction of the message window plus native lean-ctx recall tools.
All engine logic that *can* live in the daemon does (Single Source of Truth);
this class is a thin, fault-tolerant adapter over the ``/v1`` API.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

try:  # Real host contract wins whenever a Hermes checkout is importable.
    from agent.context_engine import ContextEngine  # type: ignore
except Exception:  # pragma: no cover - exercised outside Hermes
    from ._hermes_compat import ContextEngine  # type: ignore

from . import compaction, presets
from . import tokens as _tokens
from . import tools as _tools
from .config import LeanCtxConfig
from .schemas import recall_hint
from .transport import ToolGateway

logger = logging.getLogger(__name__)

_ENGINE_NAME = "lean-ctx"
_OFFLOAD_MAX_CHARS = 8_000


def _first_int(d: Dict[str, Any], *keys: str) -> Optional[int]:
    for key in keys:
        val = d.get(key)
        if isinstance(val, bool):
            continue
        if isinstance(val, int):
            return val
        if isinstance(val, float):
            return int(val)
    return None


class LeanCtxEngine(ContextEngine):
    """Context engine backed by the lean-ctx daemon."""

    def __init__(
        self,
        context_length: Optional[int] = None,
        *,
        config: Optional[LeanCtxConfig] = None,
        hermes_home: Optional[str] = None,
        **kwargs: Any,
    ) -> None:
        cfg = config or LeanCtxConfig.from_env()
        resolved_ctx = int(context_length or cfg.context_length)
        if resolved_ctx != cfg.context_length:
            cfg = cfg.with_context_length(resolved_ctx)
        self._config = cfg
        self._hermes_home = hermes_home
        self._session_id: Optional[str] = None
        self._gateway = ToolGateway(cfg)

        # Initialise the host base in whatever shape it expects, then assert our
        # own attribute invariants so they exist regardless of the base.
        try:
            super().__init__(context_length=resolved_ctx)  # type: ignore[misc]
        except TypeError:
            try:
                super().__init__()  # type: ignore[misc]
            except Exception:  # pragma: no cover - exotic host base
                pass
        self.last_prompt_tokens = 0
        self.last_completion_tokens = 0
        self.last_total_tokens = 0
        self.context_length = resolved_ctx
        self.threshold_tokens = cfg.threshold_tokens()
        self.compression_count = 0

    # --- identity -----------------------------------------------------------

    @property
    def name(self) -> str:
        return _ENGINE_NAME

    @property
    def config(self) -> LeanCtxConfig:
        return self._config

    # --- token accounting ---------------------------------------------------

    def update_from_response(self, usage: Dict[str, Any]) -> None:
        if not isinstance(usage, dict):
            return
        pt = _first_int(usage, "prompt_tokens", "input_tokens")
        ct = _first_int(usage, "completion_tokens", "output_tokens")
        tt = _first_int(usage, "total_tokens")
        if pt is not None:
            self.last_prompt_tokens = pt
        if ct is not None:
            self.last_completion_tokens = ct
        if tt is not None:
            self.last_total_tokens = tt
        elif pt is not None or ct is not None:
            self.last_total_tokens = self.last_prompt_tokens + self.last_completion_tokens

    def should_compress(self, prompt_tokens: Optional[int] = None) -> bool:
        if self.threshold_tokens <= 0:
            return False
        tokens = prompt_tokens
        if tokens is None:
            tokens = self.last_prompt_tokens or self.last_total_tokens
        return int(tokens or 0) >= self.threshold_tokens

    def should_compress_preflight(self, messages: List[Dict[str, Any]]) -> bool:
        if self.threshold_tokens <= 0:
            return False
        return _tokens.count_messages_tokens(messages) >= self.threshold_tokens

    # --- compaction ---------------------------------------------------------

    def compress(
        self,
        messages: List[Dict[str, Any]],
        current_tokens: Optional[int] = None,
        focus_topic: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if not isinstance(messages, list) or not messages:
            return messages
        try:
            input_tokens = _tokens.count_messages_tokens(messages)
            result: Optional[List[Dict[str, Any]]] = None
            if self._config.use_core_compaction:
                # Preferred: the daemon's deterministic core tool owns compaction
                # (Single Source of Truth) and offloads raw turns server-side.
                result = self._compress_via_daemon(messages, focus_topic)
            if result is None:
                # Fallback: daemon unreachable / tool missing — compact locally.
                result = self._compress_local(messages, focus_topic)
            if result is None:
                return messages  # nothing to compact
            if _tokens.count_messages_tokens(result) < input_tokens:
                self.compression_count += 1
            return result
        except Exception as exc:  # never break the agent loop
            logger.warning("lean-ctx engine: compress() failed, returning input unchanged: %s", exc)
            return messages

    def _compress_via_daemon(
        self,
        messages: List[Dict[str, Any]],
        focus_topic: Optional[str],
    ) -> Optional[List[Dict[str, Any]]]:
        """Compact through the daemon's ``ctx_transcript_compact`` core tool.

        Returns the validated message list when the daemon handled the request,
        or ``None`` (→ local fallback) when it is unreachable, the tool is
        missing, or the response fails our hard OpenAI-sequence invariants.
        """
        if not self._gateway.is_available():
            return None
        args: Dict[str, Any] = {
            "messages": messages,
            "fresh_tail_tokens": self._config.protect_tokens(),
            "protect_min_messages": self._config.protect_min_messages,
        }
        if focus_topic:
            args["focus_topic"] = focus_topic
        raw = self._gateway.call_text("ctx_transcript_compact", args)
        if not raw:
            return None
        try:
            payload = json.loads(raw)
        except (ValueError, TypeError):
            return None
        if not isinstance(payload, dict):
            return None
        new_messages = payload.get("messages")
        if not isinstance(new_messages, list) or not new_messages:
            return None
        if not all(isinstance(m, dict) for m in new_messages):
            return None
        # Hard invariant: a tool_call/tool_result pair must never be split.
        if compaction.tool_pairing_errors(new_messages):
            logger.warning(
                "lean-ctx engine: daemon compaction broke tool pairing; using local fallback"
            )
            return None
        # Safety: compaction must never grow the window.
        if _tokens.count_messages_tokens(new_messages) > _tokens.count_messages_tokens(messages):
            return None
        return new_messages

    def _compress_local(
        self,
        messages: List[Dict[str, Any]],
        focus_topic: Optional[str],
    ) -> Optional[List[Dict[str, Any]]]:
        """Pure-Python compaction used when the daemon path is unavailable."""
        plan = compaction.plan_compaction(
            messages,
            protect_tokens=self._config.protect_tokens(),
            protect_min_messages=self._config.protect_min_messages,
            token_counter=_tokens.count_messages_tokens,
        )
        if plan.nothing_to_do:
            return None
        self._offload(plan.to_summarize)
        summary = compaction.build_summary_message(
            plan.to_summarize,
            focus_topic=focus_topic,
            recall_hint=recall_hint() if self._config.enable_tools else "",
        )
        return compaction.assemble(plan, summary)

    def _offload(self, to_summarize: List[Dict[str, Any]]) -> None:
        """Persist offloaded turns to lean-ctx so they remain recoverable.

        Only used by the local fallback path; the daemon core tool offloads
        server-side, so this avoids double-writing the same turns.
        """
        if not to_summarize or not self._gateway.is_available():
            return
        digest = compaction.serialize_transcript(to_summarize, max_chars=_OFFLOAD_MAX_CHARS)
        if not digest:
            return
        self._gateway.call_text("ctx_session", {"action": "finding", "value": digest})

    # --- model / lifecycle --------------------------------------------------

    def update_model(
        self,
        model: str,
        context_length: Optional[int] = None,
        **kwargs: Any,
    ) -> None:
        new_ctx = context_length or presets.context_length_for(model)
        if new_ctx:
            self._config = self._config.with_context_length(int(new_ctx))
            self.context_length = self._config.context_length
            self.threshold_tokens = self._config.threshold_tokens()

    def on_session_start(self, session_id: str, **kwargs: Any) -> None:
        self._session_id = session_id
        # Restore prior cross-session state (task / findings / decisions) so that
        # recall and subsequent compaction summaries reflect earlier sessions.
        # Best-effort: a fresh project with no history simply no-ops.
        if self._gateway.is_available():
            self._gateway.call_text("ctx_session", {"action": "resume"})

    def on_session_end(self, session_id: str, messages: List[Dict[str, Any]]) -> None:
        # Durable cross-session persiste
```

### Core Architecture Module: `rust/crates/lean-ctx-doc/src/state.rs`
```
// SPDX-License-Identifier: Apache-2.0

//! The derived doc state of a page (C0 2.2 `doc-states`), never stored:
//! fresh, noted (every derived anchor that moved is covered by an open note
//! that accounted for exactly what is observed now) or stale.

use serde::{Deserialize, Serialize};

/// A page's state as a reader shows it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DocState {
    Fresh,
    Noted,
    Stale,
}

/// Why a page is not fresh.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StateReason {
    AnchorChanged,
    AnchorGone,
}

/// One moved anchor: its ref and the digest observed now (`None`: gone).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Drift {
    #[serde(rename = "ref")]
    pub reference: String,
    /// `observed` in a drift entry, `digest` in a note's cover.
    #[serde(alias = "digest")]
    pub observed: Option<String>,
}

/// What a note accounted for: a ref at a digest (`None`: as gone).
pub type Cover = Drift;

/// One note about the page or one of its sections.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NoteCovers {
    pub open: bool,
    pub covers: Vec<Cover>,
}

/// The verdict with its reason and the derived refs no open note covers.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Verdict {
    pub state: DocState,
    pub reason: Option<StateReason>,
    pub uncovered: Vec<String>,
}

/// The doc state of a page from its `anchor_state` (`fresh`, `to_verify`,
/// `gone` or absent), the refs of its derived anchors, its `drift` and the
/// notes about it.
pub fn of(
    anchor_state: Option<&str>,
    derived: &[&str],
    drift: &[Drift],
    notes: &[NoteCovers],
) -> Verdict {
    let fresh = Verdict {
        state: DocState::Fresh,
        reason: None,
        uncovered: Vec::new(),
    };
    if matches!(anchor_state, None | Some("fresh")) {
        return fresh;
    }
    let moved: Vec<&Drift> = drift
        .iter()
        .filter(|d| derived.contains(&d.reference.as_str()))
        .collect();
    if moved.is_empty() && !drift.is_empty() {
        // Only cited anchors moved: they never drive the state.
        return fresh;
    }
    let gone = anchor_state == Some("gone") || moved.iter().any(|d| d.observed.is_none());
    let reason = Some(if gone {
        StateReason::AnchorGone
    } else {
        StateReason::AnchorChanged
    });
    let mut uncovered: Vec<String> = moved
        .iter()
        .filter(|d| {
            !notes.iter().filter(|n| n.open).any(|n| {
                n.covers
                    .iter()
                    .any(|c| c.reference == d.reference && c.observed == d.observed)
            })
        })
        .map(|d| d.reference.clone())
        .collect();
    uncovered.sort();
    // A writer that sent no drift detail leaves nothing to cover: stale.
    let state = if moved.is_empty() || !uncovered.is_empty() {
        DocState::Stale
    } else {
        DocState::Noted
    };
    Verdict {
        state,
        reason,
        uncovered,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const D7: &str = "7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c7c";
    const D5: &str = "5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e";
    const DERIVED: &[&str] = &["file:a.rs"];

    fn drift(r: &str, d: Option<&str>) -> Drift {
        Drift {
            reference: r.into(),
            observed: d.map(Into::into),
        }
    }
    fn note(open: bool, d: Option<&str>) -> NoteCovers {
        NoteCovers {
            open,
            covers: vec![drift("file:a.rs", d)],
        }
    }
    fn check(
        name: &str,
        st: Option<&str>,
        dr: &[Drift],
        notes: &[NoteCovers],
        want: (DocState, Option<StateReason>, &[&str]),
    ) {
        let v = of(st, DERIVED, dr, notes);
        assert_eq!((v.state, v.reason), (want.0, want.1), "{name}");
        assert_eq!(v.uncovered, want.2, "{name}");
    }

    // C0 2.2 vectors (hive-v2 vectors/doc_state).
    #[test]
    fn doc_state_vectors() {
        use DocState::{Fresh, Noted, Stale};
        use StateReason::{AnchorChanged as Changed, AnchorGone as Gone};
        let moved = [drift("file:a.rs", Some(D7))];
        check("no_state", None, &[], &[], (Fresh, None, &[]));
        check("fresh", Some("fresh"), &[], &[], (Fresh, None, &[]));
        check(
            "changed_uncovered",
            Some("to_verify"),
            &moved,
            &[],
            (Stale, Some(Changed), &["file:a.rs"]),
        );
        check(
            "changed_covered",
            Some("to_verify"),
            &moved,
            &[note(true, Some(D7))],
            (Noted, Some(Changed), &[]),
        );
        check(
            "covered_an_older_move",
            Some("to_verify"),
            &moved,
            &[note(true, Some(D5))],
            (Stale, Some(Changed), &["file:a.rs"]),
        );
        check(
            "resolved_note_does_not_cover",
            Some("to_verify"),
            &moved,
            &[note(false, Some(D7))],
            (Stale, Some(Changed), &["file:a.rs"]),
        );
        check(
            "migrated_null_cover_does_not_cover",
            Some("to_verify"),
            &moved,
            &[note(true, None)],
            (Stale, Some(Changed), &["file:a.rs"]),
        );
        check(
            "gone_covered",
            Some("gone"),
            &[drift("file:a.rs", None)],
            &[note(true, None)],
            (Noted, Some(Gone), &[]),
        );
        check(
            "cites_drift_only",
            Some("to_verify"),
            &[drift("file:docs/b.md", Some(D7))],
            &[],
            (Fresh, None, &[]),
        );
        check(
            "state_without_drift",
            Some("to_verify"),
            &[],
            &[],
            (Stale, Some(Changed), &[]),
        );
    }
}

```

### Core Architecture Module: `rust/crates/lean-ctx-embed/src/engine.rs`
```
//! The embedding [`Engine`] — a safe, ergonomic handle over the lean-ctx
//! context engine, built via [`EngineBuilder`].
//!
//! ## What it is
//!
//! `Engine` owns a **shared** [`SessionCache`] and dispatches the *real*
//! registered tools (`ctx_read`, `ctx_search`, …) the same way the MCP server
//! does. Because the cache is shared across calls, a read followed by a re-read
//! of the same file collapses to a delta in-process — the property Lean-md
//! needs and the headline acceptance test for this SDK.
//!
//! ```no_run
//! let engine = lean_ctx_embed::Engine::builder(".").build().unwrap();
//! let first = engine.read("src/main.rs", lean_ctx_embed::ReadMode::Full).unwrap();
//! let again = engine.read("src/main.rs", lean_ctx_embed::ReadMode::Full).unwrap();
//! assert!(again.saved_tokens >= first.saved_tokens); // re-read is cheaper
//! ```
//!
//! ## Safe by default
//!
//! [`EngineBuilder::build`] is read-mostly and scoped:
//! - **`PathJail` on** — every path argument is resolved against the project root;
//!   escapes and secret paths are rejected.
//! - **Scoped data dir** — unless you call [`EngineBuilder::data_dir`], engine
//!   state goes to a dedicated temp dir, never your real `~/.lean-ctx`.
//! - **Auto-update off** for the embedded process.
//! - **Write/exec gated** — `ctx_edit` needs [`EngineBuilder::allow_write`];
//!   `ctx_shell`/`ctx_execute` need [`EngineBuilder::allow_exec`].
//!
//! Path validation is not an OS sandbox: it does not prevent a concurrent
//! filesystem writer from swapping a checked path before a handler opens it,
//! and cannot distinguish hard links. Explicitly enabled shell execution is
//! not confined by a path-argument check. Dangling symlinks fail closed.
//!
//! ## Runtime constraint
//!
//! Engine methods are synchronous and drive their own multi-threaded Tokio
//! runtime, so they must **not** be called from inside another Tokio runtime
//! worker. From async code, wrap calls in `tokio::task::spawn_blocking`.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use serde_json::{Map, Value};
use tokio::sync::RwLock;

use lean_ctx::core::cache::SessionCache;
use lean_ctx::core::session::SessionState;
use lean_ctx_server::server::registry::{ToolRegistry, build_registry};
use lean_ctx_server::server::tool_trait::{ToolContext, ToolOutput};
use lean_ctx_server::tools::{CrpMode, SharedCache};

use crate::error::Error;
use crate::output::Output;
use crate::read::ReadMode;

/// File-mutating tools, gated behind [`EngineBuilder::allow_write`].
const WRITE_TOOLS: &[&str] = &["ctx_edit"];
/// Command-executing tools, gated behind [`EngineBuilder::allow_exec`].
const EXEC_TOOLS: &[&str] = &["ctx_shell", "ctx_execute", "shell"];
/// Explicitly admitted root-scoped read surfaces. Registering another MCP tool
/// must not silently grant it embedded write, execution, or host-registry access.
const READ_TOOLS: &[&str] = &[
    "ctx_read",
    "ctx_search",
    "ctx_tree",
    "ctx_outline",
    "ctx_glob",
];

/// Builds an [`Engine`] with explicit, safe-by-default configuration.
#[derive(Debug, Clone)]
pub struct EngineBuilder {
    project_root: PathBuf,
    data_dir: Option<PathBuf>,
    allow_write: bool,
    allow_exec: bool,
    worker_threads: usize,
}

impl EngineBuilder {
    fn new(project_root: impl Into<PathBuf>) -> Self {
        Self {
            project_root: project_root.into(),
            data_dir: None,
            allow_write: false,
            allow_exec: false,
            worker_threads: 2,
        }
    }

    /// Scope engine state (sessions, caches, indexes) to `dir` instead of the
    /// default throwaway temp dir. Pass your real lean-ctx data dir to share
    /// session memory with the CLI/MCP server.
    #[must_use]
    pub fn data_dir(mut self, dir: impl Into<PathBuf>) -> Self {
        self.data_dir = Some(dir.into());
        self
    }

    /// Permit the file-mutating tool (`ctx_edit`) via [`Engine::call`].
    #[must_use]
    pub fn allow_write(mut self, yes: bool) -> Self {
        self.allow_write = yes;
        self
    }

    /// Permit command-executing tools (`ctx_shell`, `ctx_execute`) via
    /// [`Engine::call`]. The OS sandbox still applies when distributed as an addon.
    #[must_use]
    pub fn allow_exec(mut self, yes: bool) -> Self {
        self.allow_exec = yes;
        self
    }

    /// Number of Tokio worker threads backing the engine (default 2, min 1).
    #[must_use]
    pub fn worker_threads(mut self, n: usize) -> Self {
        self.worker_threads = n.max(1);
        self
    }

    /// Finalize configuration and construct the [`Engine`].
    ///
    /// # Errors
    /// Returns [`Error::Init`] if the project root does not exist / is not a
    /// directory, or the runtime cannot be built.
    pub fn build(self) -> Result<Engine, Error> {
        let project_root = lean_ctx::core::pathutil::canonicalize_secure(&self.project_root)
            .map_err(|e| {
                Error::Init(format!("project root {}: {e}", self.project_root.display()))
            })?;
        if !project_root.is_dir() {
            return Err(Error::Init(format!(
                "project root {} is not a directory",
                project_root.display()
            )));
        }
        let project_root = project_root.to_string_lossy().into_owned();

        configure_process_env(self.data_dir.as_deref());
        // The Hive connector's hooks, as the CLI registers them at start-up
        // (idempotent: the first registration wins).
        lean_ctx_hive::register_hooks();

        let rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(self.worker_threads)
            .enable_all()
            .thread_name("lean-ctx-embed")
            .build()
            .map_err(|e| Error::Init(format!("tokio runtime: {e}")))?;

        let mut session = SessionState::new();
        session.project_root = Some(project_root.clone());
        Ok(Engine {
            project_root,
            cache: Arc::new(RwLock::new(SessionCache::new())),
            session: Arc::new(RwLock::new(session)),
            registry: build_registry(),
            crp_mode: CrpMode::Off,
            allow_write: self.allow_write,
            allow_exec: self.allow_exec,
            rt,
        })
    }
}

/// An embedded lean-ctx engine. Construct via [`Engine::builder`].
pub struct Engine {
    project_root: String,
    cache: SharedCache,
    session: Arc<RwLock<SessionState>>,
    registry: ToolRegistry,
    crp_mode: CrpMode,
    allow_write: bool,
    allow_exec: bool,
    rt: tokio::runtime::Runtime,
}

impl Engine {
    /// Start configuring an engine rooted at `project_root` (the `PathJail` root).
    #[must_use]
    pub fn builder(project_root: impl Into<PathBuf>) -> EngineBuilder {
        EngineBuilder::new(project_root)
    }

    /// The resolved, absolute project root this engine is jailed to.
    #[must_use]
    pub fn project_root(&self) -> &str {
        &self.project_root
    }

    /// Read a file through the engine, with compression + cache-delta applied.
    ///
    /// `path` may be relative to the project root or absolute inside it; it is
    /// `PathJail`-checked. A re-read of an unchanged file collapses to a delta.
    ///
    /// # Errors
    /// [`Error::Path`] for jail violations, [`Error::Tool`] if the read fails.
    pub fn read(&self, path: impl AsRef<str>, mode: ReadMode) -> Result<Output, Error> {
        let resolved = self.resolve(path.as_ref())?;
        let mut args = Map::new();
        args.insert("path".into(), Value::String(resolved.clone()));
        args.insert("mode".into(), Value::String(mode.to_string()));

        let mut ctx = self.base_ctx();
        ctx.resolved_paths.insert("path".into(), resolved);

        self.dispatch("ctx_read", args, ctx).map(Output::from)
    }

    /// Regex/literal code search. `subdir` (optional) narrows the search to a
    /// directory under the project root; `None` searches the whole root.
    ///
    /// # Errors
    /// [`Error::Path`] for jail violations, [`Error::Tool`] on failure.
    pub fn search(&self, pattern: &str, subdir: Option<&str>) -> Result<String, Error> {
        let mut args = Map::new();
        args.insert("pattern".into(), Value::String(pattern.to_string()));
        let mut ctx = self.base_ctx();
        let resolved = self.resolve(subdir.unwrap_or("."))?;
        args.insert("path".into(), Value::String(resolved.clone()));
        ctx.resolved_paths.insert("path".into(), resolved);
        self.dispatch("ctx_search", args, ctx).map(|o| o.text)
    }

    /// Locate a symbol definition by exact name across the project.
    ///
    /// # Errors
    /// [`Error::Tool`] on failure.
    pub fn symbol(&self, name: &str) -> Result<String, Error> {
        let mut args = Map::new();
        args.insert("action".into(), Value::String("symbol".to_string()));
        args.insert("name".into(), Value::String(name.to_string()));
        self.dispatch("ctx_search", args, self.base_ctx())
            .map(|o| o.text)
    }

    /// Structural outline (symbols/headings) of a single file.
    ///
    /// # Errors
    /// [`Error::Path`] for jail violations, [`Error::Tool`] on failure.
    pub fn outline(&self, path: &str) -> Result<String, Error> {
        let resolved = self.resolve(path)?;
        let mut args = Map::new();
        args.insert("path".into(), Value::String(resolved.clone()));
        let mut ctx = self.base_ctx();
        ctx.resolved_paths.insert("path".into(), resolved);
        self.dispatch("ctx_outline", args, ctx).map(|o| o.text)
    }

    /// Directory tree / repo map rooted at `subdir` (or the project root).
    ///
    /// # Errors
    /// [`Error::Path`] for jail violations, [`Error::Tool`] on failure.
    pub fn tree(&self, subdir: Option<&str>) -> Result<String, Error> {
        let mut args = Map::new();
        let mut ctx = self.base_ctx();
        let resolved = self.resolve(subdir.unwrap_or("."))?;
        args.inse
```

### Core Architecture Module: `rust/crates/lean-ctx-hive/src/capture/lifecycle.rs`
```
// SPDX-License-Identifier: Apache-2.0
//! The lifecycle of captured knowledge after its `node.add`: what an agent
//! does to a fact later reaches the vault, so other engines never keep
//! receiving knowledge its author has withdrawn.
//!
//! Capture (step 6, [`super::emit`]) records for every node it adds which
//! local fact it came from (`own_sources`: project, category, key, value
//! digest). Each sync compares those own nodes with the project's knowledge
//! store and queues, through the existing event builders:
//!
//! - **superseded**: the fact's value is no longer current and a current
//!   fact of the same category and key has its own node → `edge.add
//!   supersedes` from that node to the old one. The server derives the old
//!   node `outdated (superseded)`; it is not retracted (one or the other).
//! - **withdrawn**: no fact of the store carries the node's value any more
//!   and no successor has a node → `retract` with the fixed reason
//!   `withdrawn by author` (no content).
//! - **re-pinned**: the vault marked the claim `to_verify`/`gone`, while the
//!   local fact with the same value is current, not under review and its
//!   anchors match the code here (an agent re-pinned it) → the claim is
//!   re-anchored at `HEAD` and `anchor_state fresh`, the event `hive
//!   maintain --confirm` writes.
//!
//! The comparison reads the raw store, not a policy view: a fact a view
//! withholds still exists and is never retracted for that. A store that
//! cannot be read, or holds no facts while own nodes exist, plans nothing.
//! Only `fact` sources of this checkout count; another checkout of the same
//! vault owns its nodes. The server's retraction limits apply unchanged: a
//! held retraction stays pending, the engine sets no threshold of its own.
//!
//! Every action is idempotent: an edge or retraction already in the folded
//! place or still pending is not queued again, so a sync that ran before
//! changes nothing.

use std::collections::{BTreeMap, BTreeSet};

use serde_json::Value;

use super::refs::Checkout;
use crate::HiveError;
use crate::events::build;
use crate::events::hlc::{self, Stamp};
use crate::replica::Replica;
use crate::replica::fold::Graph;
use crate::review::{curate, maintain};

/// The reason of a lifecycle retraction: stable, and no fact content.
pub const WITHDRAWN_REASON: &str = "withdrawn by author";

/// An own node and the fact it was captured from.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OwnNode {
    pub node_id: String,
    pub category: String,
    pub key: String,
    pub value_digest: String,
}

/// A fact of the raw store, as far as the lifecycle needs it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoreFact {
    pub category: String,
    pub key: String,
    pub value_digest: String,
    /// Not superseded and not expired (`valid_until` unset).
    pub current: bool,
    /// Current, not under review, and every anchor matches this checkout.
    pub confirmed_here: bool,
}

/// What the vault shows of a node.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NodeView {
    pub live: bool,
    /// `anchor_state` is `to_verify` or `gone`.
    pub marked: bool,
    pub has_anchors: bool,
}

/// One lifecycle action, in the order it is queued.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum Action {
    Supersede { old: String, new: String },
    Retract { node: String },
    Confirm { node: String },
}

/// What is already in the place or pending, so nothing is queued twice.
#[derive(Debug, Default)]
pub struct Present {
    /// `(from, to)` of live or pending `supersedes` edges.
    pub supersedes: BTreeSet<(String, String)>,
    /// Targets of pending `retract` events.
    pub retracting: BTreeSet<String>,
    /// Targets of pending `field.set anchors` events.
    pub confirming: BTreeSet<String>,
    /// Nodes queued by a pending `node.add` (this sync's captures): live for
    /// the plan, so a successor captured in the same run supersedes its
    /// predecessor instead of the predecessor being retracted.
    pub adding: BTreeSet<String>,
}

impl Present {
    /// [`node_view`] in `graph`, or a pending addition as a live node.
    pub fn view(&self, graph: &Graph, node_id: &str) -> Option<NodeView> {
        node_view(graph, node_id).or_else(|| {
            self.adding.contains(node_id).then_some(NodeView {
                live: true,
                marked: false,
                has_anchors: false,
            })
        })
    }
}

/// The `(category, key)` of every fact the knowledge journal of the
/// checkout at `root` records as removed.
pub fn removed_identities(root: &str) -> BTreeSet<(String, String)> {
    let Ok(dir) = lean_ctx::core::knowledge::knowledge_dir_of(root) else {
        return BTreeSet::new();
    };
    lean_ctx::core::knowledge::journal::rows_since(&dir, 0, usize::MAX)
        .into_iter()
        .filter(|r| r.op == "removed")
        .map(|r| (r.category, r.key))
        .collect()
}

/// The actions that bring the vault in line with the store, in node id
/// order (deterministic).
///
/// `removed` are the `(category, key)` identities the knowledge journal
/// records as removed. An empty store withdraws only those: a store that
/// was reset or could not be read never withdraws everything.
pub fn plan(
    own: &[OwnNode],
    store: &[StoreFact],
    removed: &BTreeSet<(String, String)>,
    node: impl Fn(&str) -> Option<NodeView>,
    present: &Present,
) -> Vec<Action> {
    if store.is_empty() && removed.is_empty() {
        return Vec::new();
    }
    let mut by_identity: BTreeMap<(&str, &str), Vec<&StoreFact>> = BTreeMap::new();
    for fact in store {
        by_identity
            .entry((fact.category.as_str(), fact.key.as_str()))
            .or_default()
            .push(fact);
    }
    // The own live node of each (category, key, value digest).
    let mut node_of: BTreeMap<(&str, &str, &str), &str> = BTreeMap::new();
    for n in own {
        if node(&n.node_id).is_some_and(|v| v.live) {
            node_of.insert(
                (n.category.as_str(), n.key.as_str(), n.value_digest.as_str()),
                n.node_id.as_str(),
            );
        }
    }
    let mut actions = Vec::new();
    for n in own {
        let Some(view) = node(&n.node_id).filter(|v| v.live) else {
            continue;
        };
        let facts = by_identity
            .get(&(n.category.as_str(), n.key.as_str()))
            .map(Vec::as_slice)
            .unwrap_or_default();
        let same = facts.iter().find(|f| f.value_digest == n.value_digest);
        if let Some(fact) = same.filter(|f| f.current) {
            if view.marked
                && view.has_anchors
                && fact.confirmed_here
                && !present.confirming.contains(&n.node_id)
            {
                actions.push(Action::Confirm {
                    node: n.node_id.clone(),
                });
            }
            continue;
        }
        // The node's value is not current any more (superseded, expired or
        // removed). A current successor with its own node supersedes it.
        let successor = facts
            .iter()
            .filter(|f| f.current && f.value_digest != n.value_digest)
            .find_map(|f| {
                node_of.get(&(f.category.as_str(), f.key.as_str(), f.value_digest.as_str()))
            });
        if let Some(&new) = successor {
            if !present
                .supersedes
                .contains(&(new.to_owned(), n.node_id.clone()))
            {
                actions.push(Action::Supersede {
                    old: n.node_id.clone(),
                    new: new.to_owned(),
                });
            }
        } else {
            let journaled = removed.contains(&(n.category.clone(), n.key.clone()));
            if (store.is_empty() && !journaled) || present.retracting.contains(&n.node_id) {
                continue;
            }
            actions.push(Action::Retract {
                node: n.node_id.clone(),
            });
        }
    }
    actions.sort();
    actions.dedup();
    actions
}

/// The own `fact` nodes of the checkout `project_hash`, from `own_sources`.
pub fn own_nodes(replica: &Replica, project_hash: &str) -> Result<Vec<OwnNode>, HiveError> {
    Ok(replica
        .own_sources()?
        .into_iter()
        .filter(|(_, kind, _)| kind == "fact")
        .filter_map(|(node_id, _, source)| {
            if source.get("project_hash")?.as_str()? != project_hash {
                return None;
            }
            Some(OwnNode {
                node_id,
                category: source.get("category")?.as_str()?.to_owned(),
                key: source.get("key")?.as_str()?.to_owned(),
                value_digest: source.get("value_digest")?.as_str()?.to_owned(),
            })
        })
        .collect())
}

/// The vault's view of `node_id` in `graph`.
pub fn node_view(graph: &Graph, node_id: &str) -> Option<NodeView> {
    let node = graph.nodes.get(node_id)?;
    Some(NodeView {
        live: !node.retracted && !node.purged,
        marked: matches!(
            node.fields.get("anchor_state").and_then(Value::as_str),
            Some("to_verify" | "gone")
        ),
        has_anchors: node
            .fields
            .get("anchors")
            .and_then(Value::as_array)
            .is_some_and(|a| !a.is_empty()),
    })
}

/// What the folded place and the pending queue already hold.
pub fn present(graph: &Graph, replica: &Replica) -> Result<Present, HiveError> {
    let mut out = Present::default();
    for edge in graph.edges.values() {
        if edge.kind == "supersedes" && !edge.retracted {
            out.supersedes.insert((edge.from.clone(), edge.to.clone()));
        }
    }
    for (_, bytes) in replica.pending()? {
        let Ok(event) = serde_json::from_slice::<Value>(&bytes) else {
            continue;
        };
        let target = event["target"].as_str().unwrap_or_d
```

### Core Architecture Module: `rust/crates/lean-ctx-hive/src/delivery/knowledge_state.rs`
```
// SPDX-License-Identifier: Apache-2.0
//! Knowledge states (Hive v5 CHECKLIST 2.2.1; C0 2.0
//! `enums/knowledge-states.json`, `vectors/knowledge_state.vectors.json`):
//! `verified | provisional | outdated | conflicting | rejected`, derived from
//! the folded replica on every read, never stored. Hive derives the same
//! state from its projection, so the web and the agent see one answer.

use std::collections::HashSet;

use serde_json::Value;

use crate::replica::fold::{Graph, Node};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum State {
    Verified,
    Provisional,
    Outdated,
    Conflicting,
    Rejected,
}

impl State {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Verified => "verified",
            Self::Provisional => "provisional",
            Self::Outdated => "outdated",
            Self::Conflicting => "conflicting",
            Self::Rejected => "rejected",
        }
    }

    /// May an agent be given the node as current truth?
    pub fn served_as_truth(self) -> bool {
        matches!(self, Self::Verified | Self::Provisional)
    }
}

/// The folded facts the state is derived from (the C0 vector inputs).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Inputs<'a> {
    pub retracted: bool,
    pub purged: bool,
    pub evidence: Option<&'a str>,
    /// A decision's `status`.
    pub status: Option<&'a str>,
    pub anchor_state: Option<&'a str>,
    /// A live `supersedes` edge from a live node points at this one.
    pub superseded: bool,
    /// A live `contradicts` edge to a live node that is not superseded.
    pub contradicted: bool,
}

/// `(state, reason)`; the reason is `None` only for `verified`.
pub fn of_inputs(i: &Inputs<'_>) -> (State, Option<&'static str>) {
    if i.retracted || i.purged {
        return (State::Rejected, Some("retracted"));
    }
    if i.status == Some("reverted") {
        return (State::Rejected, Some("reverted"));
    }
    if i.superseded || i.status == Some("superseded") {
        return (State::Outdated, Some("superseded"));
    }
    match i.anchor_state {
        Some("gone") => return (State::Outdated, Some("anchor_gone")),
        Some("to_verify") => return (State::Outdated, Some("anchor_changed")),
        _ => {}
    }
    if i.contradicted {
        return (State::Conflicting, Some("contradicted"));
    }
    if i.evidence != Some("observed") {
        return (State::Provisional, Some("not_observed"));
    }
    (State::Verified, None)
}

fn live(graph: &Graph, id: &str) -> bool {
    graph
        .nodes
        .get(id)
        .is_some_and(|n| !n.retracted && !n.purged)
}

/// The edge-derived inputs of every node, built once per graph (one pass
/// over the edges, so delivery stays linear in the vault size).
#[derive(Debug, Default)]
pub struct Index {
    /// Targets of a live `supersedes` edge from a live node.
    superseded: HashSet<String>,
    /// Ends of a live `contradicts` edge whose other end is live and not
    /// superseded.
    contradicted: HashSet<String>,
}

impl Index {
    pub fn new(graph: &Graph) -> Self {
        let superseded: HashSet<String> = graph
            .edges
            .values()
            .filter(|e| e.kind == "supersedes" && !e.retracted && live(graph, &e.from))
            .map(|e| e.to.clone())
            .collect();
        let open = |id: &str| live(graph, id) && !superseded.contains(id);
        let mut contradicted = HashSet::new();
        for e in graph
            .edges
            .values()
            .filter(|e| e.kind == "contradicts" && !e.retracted)
        {
            if open(&e.to) {
                contradicted.insert(e.from.clone());
            }
            if open(&e.from) {
                contradicted.insert(e.to.clone());
            }
        }
        Self {
            superseded,
            contradicted,
        }
    }

    /// The state of `node_id` (`node` is its folded node).
    pub fn state(&self, node_id: &str, node: &Node) -> (State, Option<&'static str>) {
        let f = |k: &str| node.fields.get(k).and_then(Value::as_str);
        of_inputs(&Inputs {
            retracted: node.retracted,
            purged: node.purged,
            evidence: f("evidence"),
            status: (node.node_type == "decision")
                .then(|| f("status"))
                .flatten(),
            anchor_state: f("anchor_state"),
            superseded: self.superseded.contains(node_id),
            contradicted: self.contradicted.contains(node_id),
        })
    }
}

/// The state of one node of `graph` (builds the index; use [`Index`] for
/// many nodes).
pub fn of(graph: &Graph, node_id: &str, node: &Node) -> (State, Option<&'static str>) {
    Index::new(graph).state(node_id, node)
}

#[cfg(test)]
mod tests {
    use serde_json::{Map, Value, json};

    use super::*;
    use crate::replica::fold::Edge;

    const VECTORS: &str = include_str!(
        "../../../../crates/lean-ctx-protocol/tests/fixtures/hive-v2/vectors/knowledge_state.vectors.json"
    );

    #[test]
    fn the_c0_knowledge_state_vectors_hold() {
        let doc: Value = serde_json::from_str(VECTORS).unwrap();
        let defaults = doc["defaults"].as_object().unwrap();
        let mut seen = std::collections::BTreeSet::new();
        for c in doc["cases"].as_array().unwrap() {
            let name = c["name"].as_str().unwrap();
            let mut m: Map<String, Value> = defaults.clone();
            if let Some(Value::Object(set)) = c.get("set") {
                for (k, v) in set {
                    assert!(m.contains_key(k), "{name}: unknown input {k}");
                    m.insert(k.clone(), v.clone());
                }
            }
            let b = |k: &str| m[k].as_bool().unwrap();
            let (state, reason) = of_inputs(&Inputs {
                retracted: b("retracted"),
                purged: b("purged"),
                evidence: m["evidence"].as_str(),
                status: m["status"].as_str(),
                anchor_state: m["anchor_state"].as_str(),
                superseded: b("superseded"),
                contradicted: b("contradicted"),
            });
            assert_eq!(state.as_str(), c["state"], "{name}");
            assert_eq!(
                reason.map_or(Value::Null, Value::from),
                c["reason"],
                "{name}"
            );
            seen.insert(state);
        }
        assert_eq!(seen.len(), 5, "a case per state");
    }

    fn node(fields: &Value) -> Node {
        Node {
            node_type: "fact".into(),
            fields: fields.as_object().cloned().unwrap(),
            ..Node::default()
        }
    }

    fn edge(kind: &str, from: &str, to: &str) -> Edge {
        Edge {
            kind: kind.into(),
            from: from.into(),
            to: to.into(),
            ..Edge::default()
        }
    }

    #[test]
    fn the_graph_inputs_follow_live_edges() {
        let mut g = Graph::default();
        for id in ["n_a", "n_b", "n_c"] {
            g.nodes.insert(
                id.into(),
                node(&json!({"statement": id, "evidence": "observed"})),
            );
        }
        let state = |g: &Graph, id: &str| of(g, id, &g.nodes[id]).0;
        assert_eq!(state(&g, "n_a"), State::Verified);
        g.edges
            .insert("e_1".into(), edge("contradicts", "n_a", "n_b"));
        assert_eq!(state(&g, "n_a"), State::Conflicting);
        assert_eq!(state(&g, "n_b"), State::Conflicting);
        // c supersedes b: b is outdated, the contradiction with it is moot.
        g.edges
            .insert("e_2".into(), edge("supersedes", "n_c", "n_b"));
        assert_eq!(state(&g, "n_b"), State::Outdated);
        assert_eq!(state(&g, "n_a"), State::Verified);
        // A retracted successor supersedes nothing.
        g.nodes.get_mut("n_c").unwrap().retracted = true;
        assert_eq!(state(&g, "n_b"), State::Conflicting);
        // The anchor re-check makes a claim outdated, `fresh` clears it.
        g.nodes
            .get_mut("n_a")
            .unwrap()
            .fields
            .insert("anchor_state".into(), json!("to_verify"));
        assert_eq!(
            of(&g, "n_a", &g.nodes["n_a"]),
            (State::Outdated, Some("anchor_changed"))
        );
        g.nodes
            .get_mut("n_a")
            .unwrap()
            .fields
            .insert("anchor_state".into(), json!("fresh"));
        assert_eq!(state(&g, "n_a"), State::Conflicting);
    }

    /// Retrieval never serves outdated, conflicting or rejected knowledge
    /// as current truth: rejected and superseded leave delivery, the rest
    /// come last with a label.
    #[test]
    fn delivery_marks_or_drops_what_is_not_current_truth() {
        use crate::delivery::{Bucket, items, render};
        let mut g = Graph::default();
        let mut add = |id: &str, statement: &str, extra: Value| {
            let mut f = json!({"statement": statement, "evidence": "observed"});
            for (k, v) in extra.as_object().unwrap() {
                f[k] = v.clone();
            }
            let mut n = node(&f);
            n.provenance = Some("workspace".into());
            g.nodes.insert(id.into(), n);
        };
        add("n_ok", "Retries back off with jitter.", json!({}));
        add("n_old", "Retries use a fixed delay.", json!({}));
        add("n_new", "Retries back off with full jitter.", json!({}));
        add(
            "n_moved",
            "The retry cap lives in retry.rs.",
            json!({"anchor_state": "to_verify"}),
        );
        add("n_x", "Retries are unlimited.", json!({}));
        add("n_y", "Retries stop after five tries.", json!({}));
        g.edges
            .insert("e_s".into(), edge("supersedes", "n_new", "n_old"));
        g.edges
            .insert("e_c".into(), edge("contradicts", "n_x", "n_y"));
        let no_trust = |_: &str| -> Option<String> { None };
        let list = items(&g
```

### Core Architecture Module: `rust/crates/lean-ctx-hive/src/state.rs`
```
// SPDX-License-Identifier: Apache-2.0
//! Durable Hive state on this machine.
//!
//! `<config_dir>/hive/` (directory 0700, files 0600, written atomically):
//! `instance.key`, `kx.key`, `instance.json`, `lease.json` (re-verified on
//! every load), `keys.json`, `token.json` (never logged).
//! `<data_dir>/hive/`: `activity.json` and, with later packages, project
//! maps, cursors and the outbox.

use std::collections::BTreeMap;
use std::fmt;
use std::path::{Path, PathBuf};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::HiveError;

pub(crate) const INSTANCE_KEY_FILE: &str = "instance.key";
pub(crate) const KX_KEY_FILE: &str = "kx.key";
pub(crate) const INSTANCE_FILE: &str = "instance.json";
pub(crate) const LEASE_FILE: &str = "lease.json";
pub(crate) const KEYS_FILE: &str = "keys.json";
pub(crate) const TOKEN_FILE: &str = "token.json";
pub(crate) const ACTIVITY_FILE: &str = "activity.json";
/// The person's sharing answer at connect (`super::connect`).
pub(crate) const SHARING_FILE: &str = "sharing.json";
/// When the enrolled Hive last answered that it has no match route
/// (`super::mapping`).
pub(crate) const MATCH_FILE: &str = "vault-match.json";

/// The enrolled instance.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InstanceRecord {
    pub instance_id: String,
    pub org_id: String,
    pub org_name: String,
    pub label: String,
    /// Origin the instance is enrolled with.
    pub url: String,
    pub org_salt_id: String,
    pub enrolled_at: String,
    /// Origin of the Hive web app, when enrollment named one (1.3).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub web_url: Option<String>,
    /// `personal` | `team`, when enrollment named it (Hive C line).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub org_kind: Option<String>,
    /// The company the team belongs to, when enrollment named one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company_name: Option<String>,
}

impl InstanceRecord {
    /// Where the instance is enrolled, as people read it (owner decision
    /// 26.10.: Personal, Team, Company): `Company Acme · Team Platform`,
    /// `Team Platform`, `Personal (Ada)`; an older server's record keeps
    /// the plain name.
    pub fn workspace_label(&self) -> String {
        let name = &self.org_name;
        match (self.company_name.as_deref(), self.org_kind.as_deref()) {
            (Some(company), _) => format!("Company {company} · Team {name}"),
            (None, Some("team")) => format!("Team {name}"),
            (None, Some("personal")) => format!("Personal ({name})"),
            _ => name.clone(),
        }
    }
}

/// The last verified lease, as received, plus the service clock offset.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LeaseRecord {
    pub envelope: Value,
    /// `server_time - local time` when the lease arrived, in seconds.
    pub offset_seconds: i64,
    pub received_at: String,
}

/// A cached access token. `Debug` never shows the token.
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TokenRecord {
    pub access_token: String,
    /// Unix seconds (service clock).
    pub expires_at: i64,
}

impl fmt::Debug for TokenRecord {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TokenRecord")
            .field("access_token", &"<redacted>")
            .field("expires_at", &self.expires_at)
            .finish()
    }
}

/// When Hive last answered, per channel.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActivityRecord {
    pub last_seen: Option<String>,
    #[serde(default)]
    pub last_success: BTreeMap<String, String>,
    pub last_error: Option<String>,
    /// Why Hive last refused this workspace as locked (`trial_ended`,
    /// `plan_ended`); cleared by the next lease Hive issues.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub locked: Option<String>,
    /// Why the last lease renewal failed; kept until a renewal succeeds
    /// (unlike `last_error`, which the next success of any channel clears).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub renew_error: Option<String>,
}

/// Paths of the Hive state; [`HiveStore::open`] for this machine,
/// [`HiveStore::at`] for tests and embedders.
#[derive(Debug, Clone)]
pub struct HiveStore {
    config: PathBuf,
    data: PathBuf,
}

impl HiveStore {
    /// `<config_dir>/hive` and `<data_dir>/hive` of this installation. Opening
    /// only resolves the paths: a read-only config directory keeps its mode (the
    /// Hive's own directories are made private when something is written there).
    pub fn open() -> Result<Self, HiveError> {
        let config = lean_ctx::core::paths::config_dir_read_only().map_err(HiveError::Local)?;
        let data = lean_ctx::core::paths::data_dir().map_err(HiveError::Local)?;
        Ok(Self::at(config.join("hive"), data.join("hive")))
    }

    /// State rooted at explicit directories.
    pub fn at(config_dir: impl Into<PathBuf>, data_dir: impl Into<PathBuf>) -> Self {
        Self {
            config: config_dir.into(),
            data: data_dir.into(),
        }
    }

    pub fn config_dir(&self) -> &Path {
        &self.config
    }

    pub fn data_dir(&self) -> &Path {
        &self.data
    }

    pub(crate) fn read_config_bytes(&self, name: &str) -> Result<Option<Vec<u8>>, HiveError> {
        read_optional(&self.config.join(name))
    }

    pub(crate) fn write_config_bytes(&self, name: &str, bytes: &[u8]) -> Result<(), HiveError> {
        write_private(&self.config, name, bytes)
    }

    pub(crate) fn read_config<T: DeserializeOwned>(
        &self,
        name: &str,
    ) -> Result<Option<T>, HiveError> {
        read_json(&self.config.join(name))
    }

    pub(crate) fn write_config<T: Serialize>(
        &self,
        name: &str,
        value: &T,
    ) -> Result<(), HiveError> {
        write_private(&self.config, name, &to_json(value)?)
    }

    pub(crate) fn remove_config(&self, name: &str) -> Result<(), HiveError> {
        remove_optional(&self.config.join(name))
    }

    pub fn instance(&self) -> Result<Option<InstanceRecord>, HiveError> {
        self.read_config(INSTANCE_FILE)
    }

    pub fn activity(&self) -> ActivityRecord {
        read_json(&self.data.join(ACTIVITY_FILE))
            .ok()
            .flatten()
            .unwrap_or_default()
    }

    /// Record a successful exchange on `channel` at `when` (RFC 3339).
    pub(crate) fn record_success(&self, channel: &str, when: &str) {
        let mut activity = self.activity();
        activity.last_seen = Some(when.to_string());
        activity
            .last_success
            .insert(channel.to_string(), when.to_string());
        activity.last_error = None;
        // Activity is informational; failing to record it never fails the exchange.
        if let Ok(bytes) = to_json(&activity) {
            let _ = write_private(&self.data, ACTIVITY_FILE, &bytes);
        }
    }

    /// Record (`Some`) or clear (`None`) a locked workspace (E9).
    pub fn record_locked(&self, reason: Option<&str>) {
        let mut activity = self.activity();
        if activity.locked.as_deref() == reason {
            return;
        }
        activity.locked = reason.map(str::to_string);
        if let Ok(bytes) = to_json(&activity) {
            let _ = write_private(&self.data, ACTIVITY_FILE, &bytes);
        }
    }

    /// Record (`Some`) or clear (`None`) why the lease renewal failed.
    pub(crate) fn record_renew_error(&self, message: Option<&str>) {
        let mut activity = self.activity();
        if activity.renew_error.as_deref() == message {
            return;
        }
        activity.renew_error = message.map(str::to_string);
        if let Ok(bytes) = to_json(&activity) {
            let _ = write_private(&self.data, ACTIVITY_FILE, &bytes);
        }
    }

    pub(crate) fn record_error(&self, message: &str) {
        let mut activity = self.activity();
        activity.last_error = Some(message.to_string());
        if let Ok(bytes) = to_json(&activity) {
            let _ = write_private(&self.data, ACTIVITY_FILE, &bytes);
        }
    }

    /// Whether this engine may record anything for Hive now: connected (an
    /// instance record) and not revoked. Two file checks; the recording
    /// paths call it on every record (K2 review 2, N1).
    pub(crate) fn may_record(&self) -> bool {
        self.config.join(INSTANCE_FILE).is_file()
            && !self.config.join(super::revoked::REVOKED_FILE).is_file()
    }

    /// The slower half of the recording check (K2 review 3, NEW-3): the
    /// `[hive]` switches allow engine metrics and the stored lease has not
    /// lapsed (read from the local copy; a lease that cannot be read counts
    /// as lapsed).
    pub(crate) fn recording_allowed(&self, config: &super::config::HiveConfig) -> bool {
        config.enabled != Some(false) && config.metrics_upload && self.lease_live()
    }

    fn lease_live(&self) -> bool {
        use lean_ctx_protocol::hive::lease::{HiveLeaseV1, LeaseState};
        let Ok(Some(record)) = self.read_config::<LeaseRecord>(LEASE_FILE) else {
            return false;
        };
        let Ok(lease) = serde_json::from_value::<HiveLeaseV1>(record.envelope["lease"].clone())
        else {
            return false;
        };
        let service_now =
            (chrono::Utc::now() + chrono::Duration::seconds(record.offset_seconds)).fixed_offset();
        matches!(
            lease.state_at(service_now),
            Ok(LeaseState::Valid | LeaseState::Grace)
        )
    }

    /// Remove credentials, lease and keys; with `keep_local` the data
    /// directory (pulled knowledge, outbox, activity) stays, but nothing
    /// keeps recording for Hive (metrics, signals, 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2212** (2026-11-08): **shell gate: curl --hsts/--alt-svc and wget --save-cookies after an unfollowable cd are not judged as writes (#2201 follow-up)**
  *Symptoms*: ### What happens  After a `cd` the shell gate cannot follow, a `curl`/`wget` call is judged only by the files it writes (#2201, `rust/src/core/shell_allowlist/download_targets.rs`). That list is incomplete. These options write a file named on the command line, but the list misses them, so a call like  ```sh cd "$(some-dir)" && curl --hsts config.toml https://example.com cd "$(some-dir)" && wget --save-cookies config.toml https://example.com ```  is no longer refused when the named file is a protected LeanCTX config file, while `curl -o config.toml` is.  ### Missing write targets  - curl (`CURL_OUTPUT_LONGS`, lines 27-35): `--hsts <file>`, `--alt-svc <file>` (both read *and write* their cache file) - wget (`wget_targets`, only `-O`/`-P`/`-o`/`-a` today): `--save-cookies <file>`, `--hsts-file <file>`, `--warc-file <file>` (writes `<file>.warc[.gz]`), `--rejected-log <file>`  Each must be read in both the `--opt value` and `--opt=value` forms.  ### Expected  Every option that writes a file named on the command line counts as a write target, with tests per option in both forms. The fix lands in the 3.12.x line.  Found while reviewing the 3.12.3 port of #2201. 

- **Issue #2203** (2026-11-08): **bug: cockpit doesn't start**
  *Symptoms*: **lean-ctx version:** (run `lean-ctx --version`) 3.12.2  **OS:** (macOS / Linux / Windows) Windows  **AI tool:** (Cursor / Claude Code / Copilot / Crush / other)  **What happened:** tried starting it but it didn't start. Seems to keep retrying as my screen flickers every now and then.  It also says use lean-ctx gain --terminal but that looks the same as lean-ctx gain  **What you expected:** it to start.  **Steps to reproduce:** 1. lean-ctx dashboard 2.  or lean-ctx cockpit 3.   **Relevant output:** ``` PS G:\ESP32\ESP32AlpacaObservingConditions> lean-ctx dashboard The Cockpit did not start. It is retried automatically; in the terminal: lean-ctx gain In the terminal: lean-ctx gain --terminal ``` 

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

### Incident Patch 1: `f1172309` (2026-11-09)
**Commit Message**: fix(deps): clear RUSTSEC-2026-0459, -0457 and -0462 from main CI

Security Check (Dependency audit) and CI (Licensing, cargo-deny) fail on
main because of three advisories:

- RUSTSEC-2026-0459: bundled SQLite in libsqlite3-sys. rusqlite 0.39 ->
  0.41 (libsqlite3-sys 0.39.1).
- RUSTSEC-2026-0457: rmcp OAuth discovery follows metadata URLs to
  private/loopback addresses (fixed in rmcp >= 3.7).
- RUSTSEC-2026-0462: rmcp HTTP client reads response bodies unbounded
  (fixed in rmcp >= 3.9).

lean-ctx uses both rmcp paths (mcp_catalog OAuth login and streamable
HTTP client), so the advisories are fixed, not ignored: the vendored
rmcp/rmcp-macros move from 2.0.0 to upstream 3.9.0.

Of the four lean-ctx patches on 2.0.0, three are upstream in 3.x (the
JoinSet drain #1161, the #1391 status-page discovery fix, the
SseStream rename). One stays: a one-shot transport releases its
service even when the caller disconnected. The #1391 regression test is
ported to the 3.9 API.

API migration in lean-ctx: Meta -> RequestMetaObject (request _meta)
and MetaObject (result/content _meta); ServerHandler call_tool,
get_prompt and read_resource return the *Response types;
with_stateful_mode -> with_lega

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -62,6 +62,14 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
   from its automatic reviewer both refuse the command and name `lean-ctx allow`; an accept without
   a choice runs nothing.
 
+- **Dependencies with published advisories are updated.** The bundled SQLite moves to the
+  release `rusqlite` 0.41 ships, fixing RUSTSEC-2026-0459. The vendored MCP SDK `rmcp` moves
+  from 2.0 to 3.9, which bounds HTTP response bodies an MCP server sends to `lean-ctx`
+  (RUSTSEC-2026-0462) and stops OAuth discovery for HTTP MCP servers from following metadata
+  URLs to private or loopback addresses (RUSTSEC-2026-0457). The lean-ctx patches on top of
+  `rmcp` shrink to one, since 3.9 contains the other fixes; `lean-ctx-embed` now declares the
+  Rust 1.89 its dependencies need.
+
 ## [3.12.2] — 2026-11-04
 
 ### Added
```

**File**: `rust/Cargo.lock` (modified, +27/-22)
```diff
@@ -929,36 +929,36 @@ dependencies = [
 
 [[package]]
 name = "darling"
-version = "0.23.0"
+version = "0.24.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "25ae13da2f202d56bd7f91c25fba009e7717a1e4a1cc98a76d844b65ae912e9d"
+checksum = "ed17f5901b6630b993ca003def43f2f8ef4014fc13b047b57aad617ff32bc2ec"
 dependencies = [
  "darling_core",
  "darling_macro",
 ]
 
 [[package]]
 name = "darling_core"
-version = "0.23.0"
+version = "0.24.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9865a50f7c335f53564bb694ef660825eb8610e0a53d3e11bf1b0d3df31e03b0"
+checksum = "6837e2cf7485aaae18f86181d2f0e9a7ed297a025e220aeabf63fdebd3a2ddff"
 dependencies = [
  "ident_case",
  "proc-macro2",
  "quote",
  "strsim",
- "syn 2.0.119",
+ "syn 3.0.3",
 ]
 
 [[package]]
 name = "darling_macro"
-version = "0.23.0"
+version = "0.24.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ac3984ec7bd6cfa798e62b4a642426a5be0e68f9401cfc2a01e3fa9ea2fcdb8d"
+checksum = "2ac7135c3ef02b2f7833bbeb1be5ba7f966dcde8a87c6b87f65a778d71a02785"
 dependencies = [
  "darling_core",
  "quote",
- "syn 2.0.119",
+ "syn 3.0.3",
 ]
 
 [[package]]
@@ -1656,11 +1656,11 @@ dependencies = [
 
 [[package]]
 name = "hashlink"
-version = "0.11.1"
+version = "0.12.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "824e001ac4f3012dd16a264bec811403a67ca9deb6c102fc5049b32c4574b35f"
+checksum = "a596f1b20ed2cc5ecac41a164aaebc7258057060f06c0cf7a2ba3991ee7990fb"
 dependencies = [
- "hashbrown 0.16.1",
+ "hashbrown 0.17.1",
 ]
 
 [[package]]
@@ -1978,6 +1978,8 @@ checksum = "d466e9454f08e4a911e14806c24e16fba1b4c121d1ea474396f396069cf949d9"
 dependencies = [
  "equivalent",
  "hashbrown 0.17.1",
+ "serde",
+ "serde_core",
 ]
 
 [[package]]
@@ -2709,9 +2711,9 @@ dependencies = [
 
 [[package]]
 name = "libsqlite3-sys"
-version = "0.37.0"
+version = "0.39.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b1f111c8c41e7c61a49cd34e44c7619462967221a6443b0ec299e0ac30cfb9b1"
+checksum = "14a5f01b87b92705d07b433c06f96cbc764637d81a0bffb5734ce17cf0f9a2b3"
 dependencies = [
  "cc",
  "pkg-config",
@@ -3453,9 +3455,9 @@ dependencies = [
 
 [[package]]
 name = "process-wrap"
-version = "9.1.0"
+version = "10.0.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2e842efad9119158434d193c6682e2ebee4b44d6ad801d7b349623b3f57cdf55"
+checksum = "1f21b97672d2dc848e7b25701ab4535618b92f4861c13cc3f7f7bed52ad3c8da"
 dependencies = [
  "futures",
  "indexmap",
@@ -3864,16 +3866,18 @@ dependencies = [
 
 [[package]]
 name = "rmcp"
-version = "2.0.0"
+version = "3.9.0"
 dependencies = [
  "async-trait",
- "base64 0.22.1",
+ "base64 0.23.1",
  "bytes",
  "chrono",
  "futures",
  "http",
  "http-body",
  "http-body-util",
+ "indexmap",
+ "libc",
  "oauth2",
  "pastey",
  "pin-project-lite",
@@ -3884,6 +3888,7 @@ dependencies = [
  "schemars",
  "serde",
  "serde_json",
+ "sha2 0.11.0",
  "sse-stream",
  "thiserror 2.0.20",
  "tokio",
@@ -3897,13 +3902,13 @@ dependencies = [
 
 [[package]]
 name = "rmcp-macros"
-version = "2.0.0"
+version = "3.9.0"
 dependencies = [
  "darling",
  "proc-macro2",
  "quote",
  "serde_json",
- "syn 2.0.119",
+ "syn 3.0.3",
 ]
 
 [[package]]
@@ -3939,9 +3944,9 @@ dependencies = [
 
 [[package]]
 name = "rusqlite"
-version = "0.39.0"
+version = "0.41.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a0d2b0146dd9661bf67bb107c0bb2a55064d556eeb3fc314151b957f313bcd4e"
+checksum = "da9bba6f3506135e120a6586df05be18b48d18896600646a4bec8f993d91a594"
 dependencies = [
  "bitflags 2.13.1",
  "fallible-iterator",
@@ -4643,7 +4648,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "32497e9a4c7b38532efcdebeef879707aa9f794296a4f0244f6f69e9bc8574bd"
 dependencies = [
  "fastrand",
- "getrandom 0.3.4",
+ "getrandom 0.4.3",
  "once_cell",
  "rustix",
  "windows-sys 0.61.2",
```

**File**: `rust/Cargo.toml` (modified, +6/-7)
```diff
@@ -147,7 +147,7 @@ lean-ctx-compress = { path = "crates/lean-ctx-compress", version = "0.1.0" }
 lean-ctx-fs = { path = "crates/lean-ctx-fs", version = "0.1.0" }
 lean-ctx-syntax = { path = "crates/lean-ctx-syntax", version = "0.1.0" }
 lean-ctx-doc = { path = "crates/lean-ctx-doc", version = "0.1.0" }
-rmcp = { version = "2", features = [
+rmcp = { version = "3", features = [
   "server",
   "client",
   "transport-io",
@@ -200,7 +200,7 @@ toml = "1.1"
 toml_edit = "0.25"
 similar = "3.1"
 flate2 = "1.1"
-rusqlite = { version = "0.39", features = ["bundled"] }
+rusqlite = { version = "0.41", features = ["bundled"] }
 tree-sitter = { version = "0.26", optional = true }
 # platform-verifier: validate TLS against the OS trust store (corp proxy CAs),
 # not just compiled-in webpki-roots. Opt-in per-agent via RootCerts::PlatformVerifier.
@@ -503,11 +503,10 @@ harness = false
 # Protocol 0.5.0 is the in-tree migration release; keep workspace/root builds
 # on these exact local bytes until that release is published to crates.io.
 # Remove this entry only after publication and registry-version verification.
-# rmcp 2.0.0 keeps completed response-send tasks in a JoinSet until shutdown,
-# which grows RSS for long-lived MCP sessions. Keep this vendored patch until
-# modelcontextprotocol/rust-sdk ships the continuous drain fix.
-# Also patched: OAuth discovery ignores a 200 status page on the MCP endpoint
-# instead of reading it as resource metadata (#1391, transport/auth.rs).
+# rmcp 3.9.0 with one lean-ctx patch: a one-shot transport releases its service
+# even when the caller has disconnected (transport.rs). The JoinSet drain
+# (#1161) and the status-page fix for OAuth discovery (#1391) are upstream
+# since 3.x; the #1391 regression test stays in transport/auth.rs.
 [patch.crates-io]
 lean-ctx-protocol = { path = "crates/lean-ctx-protocol" }
 rmcp = { path = "crates/vendor/rmcp" }
```

**File**: `rust/crates/lean-ctx-embed/Cargo.toml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name = "lean-ctx-embed"
 version = "0.1.0"
 edition = "2024"
-rust-version = "1.87"
+rust-version = "1.89"
 license = "Apache-2.0"
 description = "Experimental Apache Rust facade for embedding LeanCTX | OSS in-process. Not an SDK: LeanCTX | SDK is thinkery-leanctx-sdk (Python)."
 repository = "https://github.com/yvgude/lean-ctx"
```

**File**: `rust/crates/lean-ctx-hive/Cargo.toml` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ futures = "0.3"
 dirs = "6.0"
 chrono = { version = "0.4", features = ["serde"] }
 toml = "1.1"
-rusqlite = { version = "0.39", features = ["bundled"] }
+rusqlite = { version = "0.41", features = ["bundled"] }
 ureq = { version = "3.3", features = ["platform-verifier"] }
 tokio-tungstenite = { version = "0.29", default-features = false, features = [
   "connect",
```

**File**: `rust/crates/lean-ctx-proxy/Cargo.toml` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ shape-xlat = ["lean-ctx-engine/shape-xlat"]
 [dependencies]
 lean-ctx-engine = { path = "../..", version = "=3.12.2", default-features = false }
 lean-ctx-protocol = { path = "../lean-ctx-protocol", version = "0.5.0" }
-rmcp = { version = "2", features = [
+rmcp = { version = "3", features = [
   "server",
   "client",
   "transport-io",
```

**File**: `rust/crates/lean-ctx-server/Cargo.toml` (modified, +2/-2)
```diff
@@ -67,7 +67,7 @@ lean-ctx-hive = { path = "../lean-ctx-hive", version = "=3.12.2", default-featur
 lean-ctx-ocla = { path = "../lean-ctx-ocla", version = "5.0.0" }
 lean-ctx-protocol = { path = "../lean-ctx-protocol", version = "0.5.0" }
 lean-ctx-doc = { path = "../lean-ctx-doc", version = "0.1.0" }
-rmcp = { version = "2", features = [
+rmcp = { version = "3", features = [
   "server",
   "client",
   "transport-io",
@@ -106,7 +106,7 @@ dirs = "6.0"
 chrono = { version = "0.4", features = ["serde"] }
 toml = "1.1"
 similar = "3.1"
-rusqlite = { version = "0.39", features = ["bundled"] }
+rusqlite = { version = "0.41", features = ["bundled"] }
 tree-sitter = { version = "0.26", optional = true }
 base64 = "0.22"
 sha2 = "0.11"
```

**File**: `rust/crates/lean-ctx-server/src/server/call_identity.rs` (modified, +20/-10)
```diff
@@ -36,7 +36,7 @@ tokio::task_local! {
 ///
 /// The same read takes the presenter capability the host showed, if any
 /// ([`HOST_PRESENTER_META_KEY`]); see [`HostCall`].
-pub(super) fn host_call_id(meta: Option<&rmcp::model::Meta>) -> HostCall {
+pub(super) fn host_call_id(meta: Option<&rmcp::model::RequestMetaObject>) -> HostCall {
     HostCall {
         call_id: meta_text(meta, HOST_CALL_ID_META_KEY)
             .filter(|call_id| delivered::valid_call_id(call_id))
@@ -46,7 +46,10 @@ pub(super) fn host_call_id(meta: Option<&rmcp::model::Meta>) -> HostCall {
 }
 
 /// The string under exactly `key`; no other key, no other value form.
-fn meta_text<'meta>(meta: Option<&'meta rmcp::model::Meta>, key: &str) -> Option<&'meta str> {
+fn meta_text<'meta>(
+    meta: Option<&'meta rmcp::model::RequestMetaObject>,
+    key: &str,
+) -> Option<&'meta str> {
     meta?.0.get(key)?.as_str()
 }
 
@@ -108,8 +111,8 @@ pub(super) fn record_delivery(
 mod tests {
     use super::{HOST_CALL_ID_META_KEY, delivered, host_call_id, scoped};
 
-    fn meta(value: &serde_json::Value) -> rmcp::model::Meta {
-        let mut meta = rmcp::model::Meta::new();
+    fn meta(value: &serde_json::Value) -> rmcp::model::RequestMetaObject {
+        let mut meta = rmcp::model::RequestMetaObject::new();
         meta.0
             .insert(HOST_CALL_ID_META_KEY.to_owned(), value.clone());
         meta
@@ -121,13 +124,17 @@ mod tests {
     fn only_a_well_formed_string_under_the_one_key_is_an_id() {
         let id = serde_json::json!("toolu_01AbC-9");
         // The call id is one part of what the host says about a call.
-        let host_call_id = |meta: Option<&rmcp::model::Meta>| super::host_call_id(meta).call_id;
+        let host_call_id =
+            |meta: Option<&rmcp::model::RequestMetaObject>| super::host_call_id(meta).call_id;
         assert_eq!(
             host_call_id(Some(&meta(&id))).as_deref(),
             Some("toolu_01AbC-9")
         );
         assert_eq!(host_call_id(None), None);
-        assert_eq!(host_call_id(Some(&rmcp::model::Meta::new())), None);
+        assert_eq!(
+            host_call_id(Some(&rmcp::model::RequestMetaObject::new())),
+            None
+        );
         for refused in [
             serde_json::json!(""),
             serde_json::json!("has space"),
@@ -138,14 +145,14 @@ mod tests {
         ] {
             assert_eq!(host_call_id(Some(&meta(&refused))), None, "{refused}");
         }
-        let mut other_key = rmcp::model::Meta::new();
+        let mut other_key = rmcp::model::RequestMetaObject::new();
         other_key.0.insert("toolUseId".to_owned(), id);
         assert_eq!(host_call_id(Some(&other_key)), None);
 
         // The presenter capability: its own key, a well-formed value, and
         // never visible in what the read formats to.
         let wire = format!("lcp1_{}", "5a".repeat(32));
-        let mut shown = rmcp::model::Meta::new();
+        let mut shown = rmcp::model::RequestMetaObject::new();
         shown.0.insert(
             super::HOST_PRESENTER_META_KEY.to_owned(),
             serde_json::json!(wire),
@@ -191,12 +198,15 @@ mod tests {
         let wire: rmcp::model::CallToolRequest =
             serde_json::from_value(serde_json::json!({"method": "tools/call", "params": params}))
                 .expect("a tools/call request");
-        let transported = wire.extensions.get::<rmcp::model::Meta>().cloned();
+        let transported = wire
+            .extensions
+            .get::<rmcp::model::RequestMetaObject>()
+            .cloned();
         let mut request = wire.params;
         if let Some(transported) = transported {
             request
                 .meta
-                .get_or_insert_with(rmcp::model::Meta::new)
+                .get_or_insert_with(rmcp::model::RequestMetaObject::new)
                 .extend(transported);
         }
         let call_id = host_call_id(request.meta.as_ref());
```

---

### Incident Patch 2: `f317ac93` (2026-11-08)
**Commit Message**: fix(shell): read a PowerShell tool call as PowerShell, accept its member calls, gate its call operator (#2216)

* fix(hooks): check a PowerShell tool call under the PowerShell host

A host that launches its hooks through Git Bash (Claude Code on Windows
does) hands the hook SHELL=/usr/bin/bash and MSYSTEM=MINGW64.
host_mode() picked the POSIX Strict mode from that environment and
refused ordinary PowerShell tool lines
(`Get-ChildItem | Select-Object @{n='kb'; e={ $_.Length / 1kb }}`,
`$f = "C:\x\y"; Test-Path $f`, `foreach ($c in 'a','b') { … }`).

HostGuard and its thread-local leave #[cfg(test)]; the new
check_shell_allowlist_in_powershell() holds the PowerShell host for one
check, and the PowerShell-tool hook path uses it. ctx_shell, ctx_execute
and the shell aliases keep environment-based detection.

* fix(shell): accept a PowerShell member call's attached paren under the PowerShell host

The lexer refused every `(` attached to a word because zsh reads
`*(e:…:)` as code-running glob qualifiers. That check ignored the host,
so `[Math]::Max(1,2)` and
`[Environment]::GetEnvironmentVariable('Path','User')` were refused even
when PowerShell runs the line.

Under the PowerShell host 

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -35,6 +35,15 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
   `-e`/`--execute`, are judged as write targets in every spelling. A config file the call reads
   (`curl -K`, `curl -w @FILE`, `wget --config`) may name any file and is refused wherever the call
   runs. ctx_shell's download guard uses the same list instead of its own copy.
+- **A PowerShell tool call is checked as PowerShell (#2215).** A host that launches its hooks through
+  Git Bash (Claude Code on Windows does) hands the hook a POSIX `SHELL`/`MSYSTEM`, so ordinary
+  PowerShell lines such as `$f = "C:\x"; Test-Path $f` were denied as POSIX. The PowerShell tool
+  hook now reads its line under the PowerShell host whatever the environment says. Under that host
+  a .NET member call's attached `(` (`[Math]::Max(1,2)`) is accepted at statement start or as a
+  local assignment value, and the reader still decides whether the member is safe. The call
+  operator `&` no longer hides its target: a literal is checked against the allowlist, a run-time
+  target is refused, a script block is walked, a trailing redirect is allowed, and nesting is
+  depth-bounded. A quoted call-operator target used to pass unchecked under the PowerShell host.
 
 ## [3.12.2] — 2026-11-04
 
```

**File**: `rust/crates/lean-ctx-hooks/src/hook_handlers/powershell_rewrite.rs` (modified, +129/-1)
```diff
@@ -80,7 +80,9 @@ pub(super) fn allowlist_denial(cmd: &str, binary: &str) -> Option<String> {
     {
         return Some(msg);
     }
-    shell_allowlist::check_shell_allowlist(&as_read)
+    // Read as PowerShell, not as the shell lean-ctx detects: the hook may
+    // run under Git Bash (`SHELL=/usr/bin/bash`, `MSYSTEM`).
+    shell_allowlist::check_shell_allowlist_in_powershell(&as_read)
         .err()
         .map(|msg| msg.to_string())
 }
@@ -400,6 +402,132 @@ mod tests {
         }
     }
 
+    /// Asserts each `(command, denied)` decision, with the allowlist `git`,
+    /// both under Git Bash's environment and with no shell named at all.
+    ///
+    /// A host that launches its hooks through Git Bash (Claude Code on
+    /// Windows does) hands the hook `SHELL=/usr/bin/bash` and
+    /// `MSYSTEM=MINGW64`. A PowerShell tool call still runs in PowerShell and
+    /// is read as PowerShell, whatever the environment names.
+    fn assert_decisions_under_any_hook_shell(cases: &[(&str, bool)]) {
+        const SHELL_VARS: [&str; 4] = ["LEAN_CTX_SHELL", "SHELL", "MSYSTEM", "MINGW_PREFIX"];
+        let git_bash = [
+            ("SHELL", "/usr/bin/bash"),
+            ("MSYSTEM", "MINGW64"),
+            ("MINGW_PREFIX", "/mingw64"),
+        ];
+        for env in [&git_bash[..], &[]] {
+            let decisions: Vec<_> = with_security("enforce", || {
+                // Each guard restores its variable on drop, inside the lock.
+                let _allowlist =
+                    lean_ctx::test_env::VarGuard::set("LEAN_CTX_SHELL_ALLOWLIST_OVERRIDE", "git");
+                let _guards: Vec<_> = SHELL_VARS
+                    .iter()
+                    .map(|key| {
+                        let guard = lean_ctx::test_env::VarGuard::set(key, "");
+                        match env.iter().find(|(k, _)| k == key) {
+                            Some((_, value)) => lean_ctx::test_env::set_var(key, value),
+                            None => lean_ctx::test_env::remove_var(key),
+                        }
+                        guard
+                    })
+                    .collect();
+                cases
+                    .iter()
+                    .map(|&(cmd, denied)| (cmd, denied, decide(cmd, BIN)))
+                    .collect()
+            });
+            for (cmd, denied, decision) in decisions {
+                assert_eq!(
+                    matches!(decision, PowerShellDecision::Deny(_)),
+                    denied,
+                    "env {env:?}: {cmd}: {decision:?}"
+                );
+                if !denied {
+                    assert_eq!(decision, PowerShellDecision::Passthrough, "{cmd}");
+                }
+            }
+        }
+    }
+
+    #[test]
+    fn powershell_lines_are_read_as_powershell_under_any_hook_shell() {
+        assert_decisions_under_any_hook_shell(&[
+            (
+                "Get-ChildItem | Select-Object @{n='kb'; e={ $_.Length / 1kb }}",
+                false,
+            ),
+            ("$f = \"C:\\x\\y\"; Test-Path $f", false),
+            ("foreach ($c in 'a','b') { Write-Output $c }", false),
+            ("$env:PATH = \"x\"; calc", true),
+            ("Invoke-Expression 'calc'", true),
+            ("iex 'calc'", true),
+            (". ./x.ps1", true),
+            ("Start-Process calc", true),
+            ("[IO.File]::Delete('x')", true),
+            ("[Diagnostics.Process]::Start('calc')", true),
+            ("$p.Kill(1)", true),
+            ("Write-Output x.y(calc)", true),
+            ("Write-Output $x.ToString((calc))", true),
+            ("$n = $x.ToString((calc))", true),
+        ]);
+    }
+
+    /// A .NET member call at statement start or as a local assignment's
+    /// value is read by the PowerShell reader; one inside an argument is not.
+    #[test]
+    fn member_calls_pass_only_where_the_powershell_reader_sees_them() {
+        assert_decisions_under_any_hook_shell(&[
+            ("[Math]::Max(1,2)", false),
+            (
+                "[Environment]::GetEnvironmentVariable('Path','User') -split ';'",
+                false,
+            ),
+            (
+                "$p = [Environment]::GetEnvironmentVariable('Path','User')",
+                false,
+            ),
+            ("$env:X = $x.ToString((calc))", true),
+            ("ForEach-Object { $x.ToString((calc)) }", true),
+            ("echo =$x.y(calc)", true),
+            ("git log --format=$x.y(calc)", true),
+            ("Get-ChildItem a=[Math]::Max(calc)", true),
+        ]);
+    }
+
+    /// The call operator `&` runs its target: only a literal name or path
+    /// that the allowlist accepts may pass.
+    #[test]
+    fn call_operator_targets_meet_the_allowlist() {
+        assert_decisions_under_any_hook_shell(&[
+            ("& git status", false),
+            ("& 'evil_binary'", true),
+            ("& 'cmd' ,'/c','evil_binary'", true),
+            ("& $env:ComSpec", true),
+            ("& (Get-Comman
```

**File**: `rust/src/core/shell_allowlist/compound.rs` (modified, +135/-30)
```diff
@@ -41,9 +41,7 @@ pub(super) fn expand_to_leaf_segments(command: &str) -> Result<Vec<String>, Shel
         .into());
     }
     let mut leaves = Vec::new();
-    for seg in extract_all_commands(&command) {
-        resolve_segment_leaves(&seg, 0, &mut leaves)?;
-    }
+    resolve_commands(&command, 0, &mut leaves)?;
     Ok(leaves)
 }
 
@@ -73,9 +71,7 @@ fn resolve_segment_leaves(
     // neither walk below can claim it.
     if let Some(expr) = arithmetic_command_expr(strip_body_intro_keywords(s)) {
         for inner in arithmetic_substitutions(expr, segment)? {
-            for inner_seg in extract_all_commands(inner) {
-                resolve_segment_leaves(&inner_seg, depth + 1, out)?;
-            }
+            resolve_commands(inner, depth + 1, out)?;
         }
         return Ok(());
     }
@@ -121,20 +117,14 @@ fn resolve_segment_leaves(
         return resolve_segment_leaves(assignment_rhs, depth + 1, out);
     }
     if let Some(inner) = balanced_paren_inner(s) {
-        for inner_seg in extract_all_commands(inner) {
-            resolve_segment_leaves(&inner_seg, depth + 1, out)?;
-        }
-        return Ok(());
+        return resolve_commands(inner, depth + 1, out);
     }
     // #1514: PowerShell commonly wraps a read-only cmdlet before selecting a
     // property: `(Get-Item 'x').VersionInfo`. Validate the inner command and
     // accept only a conservative property chain. Method calls, indexers and
     // operators fall through to deny-by-default as an unrecognized command.
     if let Some(inner) = powershell_property_expression_inner(s) {
-        for inner_seg in extract_all_commands(inner) {
-            resolve_segment_leaves(&inner_seg, depth + 1, out)?;
-        }
-        return Ok(());
+        return resolve_commands(inner, depth + 1, out);
     }
     // #968: a `{ cmd1; cmd2; }` brace group must be recursed into exactly like
     // a `( … )` subshell above — otherwise every command after the first
@@ -156,10 +146,7 @@ fn resolve_segment_leaves(
         if !suffix.trim().is_empty() && !is_redirect_only_suffix(suffix) {
             return Err(zsh_only_form(segment));
         }
-        for inner_seg in extract_all_commands(inner) {
-            resolve_segment_leaves(&inner_seg, depth + 1, out)?;
-        }
-        return Ok(());
+        return resolve_commands(inner, depth + 1, out);
     }
     // #855: a segment that is *entirely* env-var assignments (`VAR=$(cmd …)`,
     // nothing left over — `out=$(gh pr view …)` is a common, legitimate idiom
@@ -171,9 +158,7 @@ fn resolve_segment_leaves(
     // as its own leaf so `gh`, not the assignment wrapper, is what actually
     // gets checked against the allowlist.
     for inner in assignment_substitution_leaves(s) {
-        for inner_seg in extract_all_commands(inner) {
-            resolve_segment_leaves(&inner_seg, depth + 1, out)?;
-        }
+        resolve_commands(inner, depth + 1, out)?;
     }
     // Anything else (incl. `( … ) trailing`, leftover delimiters) is pushed
     // verbatim: base-extraction below sees a first token like `(ls)` that
@@ -186,11 +171,24 @@ fn resolve_segment_leaves(
     // the real base command inside — no recursion needed like subshells get,
     // since `cd`/env changes inside `{ }` must persist to the caller (#939,
     // agent_wrapper::rebuild's cwd-tracking wrapper).
-    //
-    // #1930: a cmdlet runs the script blocks it is handed
-    // (`ForEach-Object { Remove-Item $_ }`), so each block body is resolved
-    // into leaves of its own, after the cmdlet itself so its verdict comes
-    // first.
+    resolve_command_leaf(s, segment, depth, out)
+}
+
+/// Push the simple command `s` as a leaf, then resolve the script blocks it
+/// runs. Shared by an ordinary segment and the literal target of a call
+/// operator (`& ForEach-Object { … }`), so neither skips these checks.
+/// `segment` is the text an error shows.
+///
+/// #1930: a cmdlet runs the script blocks it is handed
+/// (`ForEach-Object { Remove-Item $_ }`), so each block body is resolved
+/// into leaves of its own, after the cmdlet itself so its verdict comes
+/// first.
+fn resolve_command_leaf(
+    s: &str,
+    segment: &str,
+    depth: usize,
+    out: &mut Vec<String>,
+) -> Result<(), ShellError> {
     let base = extract_base_from_segment(s);
     let bodies = super::ps_statements::script_block_bodies(s, &base);
     // zsh runs brace bodies without `do`/`then`: `while true { cmd }`,
@@ -236,20 +234,127 @@ fn zsh_only_form(segment: &str) -> ShellError {
     .into()
 }
 
-/// Resolve every segment of a command text found inside PowerShell syntax.
+/// Resolve every segment of a command text.
 fn resolve_commands(text: &str, depth: usize, out: &mut Vec<String>) -> Result<(), ShellError> {
-    for segment in extract_all_commands(text) {
-        resolve_segment_leaves(&segment, depth, out)?;
+    for (segment, call_target) in call_operator_segments(text)? {
+        if call_target {
+        
```

**File**: `rust/src/core/shell_allowlist/enforcement.rs` (modified, +9/-0)
```diff
@@ -66,6 +66,15 @@ pub fn check_shell_allowlist(command: &str) -> Result<(), ShellError> {
     decided
 }
 
+/// [`check_shell_allowlist`] for a host's PowerShell tool call, which the hook
+/// checks but does not wrap. Not the detected shell: a host that runs hooks
+/// through Git Bash (Claude Code on Windows) passes `SHELL=/usr/bin/bash` and
+/// `MSYSTEM=MINGW64`, and PowerShell read under POSIX rules is refused.
+pub fn check_shell_allowlist_in_powershell(command: &str) -> Result<(), ShellError> {
+    let _host = super::ps_statements::HostGuard::powershell(true);
+    check_shell_allowlist(command)
+}
+
 /// Refuses code that contains a redaction marker such as
 /// `[REDACTED:Database credentials]`. Redaction applies only to what an agent
 /// is shown, never to what runs; an agent that copies a marker out of a
```

**File**: `rust/src/core/shell_allowlist/lexer.rs` (modified, +63/-0)
```diff
@@ -352,6 +352,8 @@ impl<'a> Lexer<'a> {
                         && !starts_word(bytes, i, start, bare_close_at)
                         && bytes[i - 1] != b'='
                         && bytes.get(i + 1) != Some(&b')')
+                        && !(powershell_member_call(bytes, i, start)
+                            && super::ps_statements::host_is_powershell())
                     {
                         // `*(e:…:)`, `x(+cmd)`, `@(a|b)`: only a function
                         // head `f()` or an array `a=(…)` may touch a word.
@@ -522,6 +524,67 @@ fn starts_word(bytes: &[u8], i: usize, start: usize, bare_close_at: usize) -> bo
     }
 }
 
+/// Is the `(` at `i` the argument list of a PowerShell member call —
+/// `[Math]::Max(`, `$p.WaitForExit(`, `(Get-Date).ToString(` — on a word that
+/// opens an expression (`$`, `[`, `(`) at the start of a statement or as the
+/// value of a local assignment (`$n = …`, `$n += …`)? No shell glob runs in
+/// PowerShell, and `ps_statements` reads such a statement and decides which
+/// members are inert. Not one: a bare word (`x.y(` — in argument mode its `(`
+/// starts another argument), a call in a command's arguments
+/// (`echo $x.ToString((cmd))`, `git log --format=$x.y((cmd))`) and the value
+/// of a scoped assignment (`$env:X = …`), none of which a reader looks into.
+fn powershell_member_call(bytes: &[u8], i: usize, start: usize) -> bool {
+    let mut j = i;
+    while j > start && (bytes[j - 1].is_ascii_alphanumeric() || bytes[j - 1] == b'_') {
+        j -= 1;
+    }
+    let accessed = j < i
+        && j > start
+        && (bytes[j - 1] == b'.' && (j - 1 == start || bytes[j - 2] != b'.')
+            || bytes[j - 1] == b':' && j - 1 > start && bytes[j - 2] == b':');
+    if !accessed {
+        return false;
+    }
+    while j > start
+        && !matches!(
+            bytes[j - 1],
+            b' ' | b'\t' | b'\n' | b';' | b'&' | b'|' | b'{' | b'}' | b'=' | b','
+        )
+    {
+        j -= 1;
+    }
+    if !matches!(bytes[j], b'$' | b'[' | b'(') {
+        return false;
+    }
+    j = skip_blanks_back(bytes, j, start);
+    if j > start && bytes[j - 1] == b'=' {
+        // Only `$name =` or `$name <op>=` at statement start: an `=` inside
+        // an argument (`--format=`, `a=`) belongs to that argument.
+        let mut k = j - 1;
+        if k > start && matches!(bytes[k - 1], b'+' | b'-' | b'*' | b'/' | b'%') {
+            k -= 1;
+        }
+        k = skip_blanks_back(bytes, k, start);
+        let name_end = k;
+        while k > start && (bytes[k - 1].is_ascii_alphanumeric() || bytes[k - 1] == b'_') {
+            k -= 1;
+        }
+        if k == name_end || k == start || bytes[k - 1] != b'$' {
+            return false;
+        }
+        j = skip_blanks_back(bytes, k - 1, start);
+    }
+    j == start || matches!(bytes[j - 1], b'\n' | b';' | b'{')
+}
+
+/// `at` moved back over the spaces and tabs before it, not past `start`.
+fn skip_blanks_back(bytes: &[u8], mut at: usize, start: usize) -> usize {
+    while at > start && matches!(bytes[at - 1], b' ' | b'\t') {
+        at -= 1;
+    }
+    at
+}
+
 /// Index of the backtick closing a substitution opened before `from`,
 /// skipping backslash escapes. `None` when it is unterminated.
 fn closing_backtick(bytes: &[u8], from: usize) -> Option<usize> {
```

**File**: `rust/src/core/shell_allowlist/lexer_tests.rs` (modified, +43/-0)
```diff
@@ -195,3 +195,46 @@ fn ordinary_commands_keep_passing() {
         ],
     );
 }
+
+/// A `(` attached to a member name is a .NET call, not a glob qualifier, only
+/// when PowerShell runs the line; which members are inert is decided by the
+/// PowerShell reader, and a bare word keeps the refusal on every host.
+#[test]
+fn attached_paren_of_a_member_call_passes_only_under_powershell() {
+    use crate::core::shell_allowlist::ps_statements::HostGuard;
+    let member_calls = [
+        "[Math]::Max(1,2)",
+        "[Environment]::GetEnvironmentVariable('Path','User') -split ';'",
+        "$s.Substring(1)",
+        "$p = [Environment]::GetEnvironmentVariable('Path','User')",
+        "if ($x) { $n += $s.IndexOf('x') }",
+    ];
+    {
+        let _host = HostGuard::powershell(true);
+        assert_all_pass("echo", &member_calls);
+        assert_all_block(
+            "echo",
+            &[
+                "[IO.File]::Delete('x')",
+                "[Diagnostics.Process]::Start('calc')",
+                "$p.Kill(1)",
+                "echo x.y(evil_binary)",
+                "echo $x.ToString((evil_binary))",
+                "$n = $x.ToString((evil_binary))",
+                "$env:X = $x.ToString((evil_binary))",
+                "ForEach-Object { $x.ToString((evil_binary)) }",
+                // An `=` inside an argument is no assignment: PowerShell
+                // runs the `( … )` there as another argument.
+                "echo =$x.y(evil_binary)",
+                "git log --format=$x.y(evil_binary)",
+                "Get-ChildItem a=[Math]::Max(evil_binary)",
+                "[Math]::Max((evil_binary), 1)",
+                "echo *(e:evil_binary:)",
+                "echo x(+evil_binary)",
+            ],
+        );
+    }
+    let _host = HostGuard::powershell(false);
+    assert_all_block("echo", &member_calls);
+    assert_all_block("echo", &["echo x(+evil_binary)"]);
+}
```

**File**: `rust/src/core/shell_allowlist/ps_statements.rs` (modified, +24/-10)
```diff
@@ -237,18 +237,21 @@ pub(crate) enum Mode {
     PowerShell,
 }
 
-#[cfg(test)]
 thread_local! {
     static FORCED_HOST: std::cell::Cell<Option<bool>> = const { std::cell::Cell::new(None) };
 }
 
-/// Test-only override of the executing shell for this thread.
-#[cfg(test)]
+/// Overrides the executing shell for checks on this thread until dropped.
+///
+/// A host's PowerShell tool runs its line in PowerShell whatever shell
+/// lean-ctx would detect for itself: a host that launches its hooks through
+/// Git Bash (Claude Code on Windows does) hands the hook
+/// `SHELL=/usr/bin/bash` and `MSYSTEM=MINGW64` (see
+/// [`super::check_shell_allowlist_in_powershell`]).
 pub(super) struct HostGuard {
     prev: Option<bool>,
 }
 
-#[cfg(test)]
 impl HostGuard {
     pub(super) fn powershell(on: bool) -> Self {
         Self {
@@ -257,17 +260,16 @@ impl HostGuard {
     }
 }
 
-#[cfg(test)]
 impl Drop for HostGuard {
     fn drop(&mut self) {
         FORCED_HOST.with(|host| host.set(self.prev));
     }
 }
 
 /// The mode for the shell that runs the checked line: the one `ctx_shell`,
-/// `ctx_execute` and the shell aliases execute with.
+/// `ctx_execute` and the shell aliases execute with, unless a [`HostGuard`]
+/// names it.
 fn host_mode() -> Mode {
-    #[cfg(test)]
     if let Some(forced) = FORCED_HOST.with(std::cell::Cell::get) {
         return if forced {
             Mode::PowerShell
@@ -283,6 +285,12 @@ fn host_mode() -> Mode {
     }
 }
 
+/// Does PowerShell run the checked line? For the lexer, which otherwise reads
+/// only POSIX shells.
+pub(super) fn host_is_powershell() -> bool {
+    host_mode() == Mode::PowerShell
+}
+
 /// Commands a PowerShell control-flow statement runs — its conditions, loop
 /// sources and block bodies — as text for the walker to validate.
 ///
@@ -429,11 +437,17 @@ fn local_assignment_value(statement: &str) -> Option<&str> {
 
 /// Is every top-level segment of `command` a PowerShell statement or
 /// expression this module reads? Then an empty leaf list means the line runs
-/// no command, not that the walker found nothing to check.
+/// no command, not that the walker found nothing to check. The target of a
+/// call operator (`& 'x'`) is a command, never inert.
 pub(super) fn is_inert_powershell(command: &str) -> bool {
-    let segments = super::extract_all_commands(command);
+    let Ok(segments) = super::compound::call_operator_segments(command) else {
+        return false;
+    };
     !segments.is_empty()
-        && segments.iter().all(|segment| {
+        && segments.iter().all(|(segment, call_target)| {
+            if *call_target {
+                return false;
+            }
             let statement = super::skip_powershell_assignment(segment);
             matches!(statement_commands(statement), Some(Ok(_)))
                 || expression_commands(statement).is_some()
```

**File**: `rust/src/core/shell_allowlist/substitution.rs` (modified, +11/-4)
```diff
@@ -1,6 +1,6 @@
 use super::heredoc::strip_for_analysis;
 use super::lexer::{Expansion, lex};
-use super::{ShellError, effective_allowlist, extract_all_commands, extract_base_from_segment};
+use super::{ShellError, effective_allowlist, extract_base_from_segment};
 
 /// $(), backticks, <() in arguments: a substituted command runs like any other,
 /// so it is gated like one (GHSA-rxv5-4c3x-g4q6 E, owner decision 26.10.;
@@ -91,9 +91,16 @@ fn extract_substitution_commands(command: &str) -> Result<Vec<String>, ShellErro
             if trimmed.is_empty() {
                 continue;
             }
-            results.extend(extract_all_commands(&strip_for_analysis(
-                trimmed, false, true,
-            )));
+            // Split like a top-level line, so a PowerShell call operator
+            // keeps its target a command (`$(& 'x')`), never an inert string.
+            let stripped = strip_for_analysis(trimmed, false, true);
+            for (segment, call) in super::compound::call_operator_segments(&stripped)? {
+                results.push(if call {
+                    format!("& {segment}")
+                } else {
+                    segment
+                });
+            }
             results.extend(extract_substitution_commands(trimmed)?);
         }
     }
```

---

### Incident Patch 3: `436db5e1` (2026-11-08)
**Commit Message**: ci(test): test PathJail on GitHub, fix the tests it exposed (#2214)

* ci(test): unit tests on nextest, test features without no-jail

The Windows lib part was the critical path of the PR run (32 min,
424 s for the engine lib under libtest). Unit tests now run on
nextest's ci profile, which gives each test its own data dir;
integration binaries and doctests stay on libtest (#1206).

Tests build with every feature except no-jail (and what enables it),
computed by .github/scripts/test_features.py with the same rule as
GitLab's mr_quick.py: --all-features compiled PathJail and its tests
out, so the jail was never tested here. The wall-clock gates use the
same set so they reuse the build.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* ci(nextest): Windows data-dir wrapper, wrappers split by platform

Port of the nextest config from GitLab 5!213 (6c48d920f9):
nextest-data-dir.cmd is the batch counterpart of the per-test data-dir
wrapper, the wrapper scripts are split by cfg(unix) / cfg(windows) in
the default and ci profiles, and the ci profile drops the
solution_integration retry. The .cmd is named in PUBLISH_MANIFEST.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* ci: 

**File**: `.github/scripts/test_features.py` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+#!/usr/bin/env python3
+# SPDX-License-Identifier: Apache-2.0
+"""Print the `--features` list the Test job builds with.
+
+Every feature of every default workspace member, except those that enable
+`no-jail` directly or through other features. `no-jail` compiles PathJail
+and its tests out, so `--all-features` never tested the jail at all. This is
+the same rule as GitLab's `scripts/ci/mr_quick.py --print-test-features`.
+
+Run from `rust/`.
+"""
+
+import json
+import subprocess
+
+UNTESTED_FEATURES = {"no-jail"}
+
+
+def main() -> None:
+    meta = json.loads(
+        subprocess.run(
+            ["cargo", "metadata", "--format-version", "1", "--no-deps"],
+            check=True,
+            capture_output=True,
+            text=True,
+        ).stdout
+    )
+    packages = meta["packages"]
+    names = {p["name"] for p in packages}
+    edges: dict[str, set[str]] = {}
+    for p in packages:
+        for feature, values in p["features"].items():
+            out = edges.setdefault(f"{p['name']}/{feature}", set())
+            for value in values:
+                if value.startswith("dep:"):
+                    continue
+                if "/" in value:
+                    dep, sub = value.split("/", 1)
+                    dep = dep.rstrip("?")
+                    if dep in names:
+                        out.add(f"{dep}/{sub}")
+                else:
+                    out.add(f"{p['name']}/{value}")
+    bad = {n for n in edges if n.split("/", 1)[1] in UNTESTED_FEATURES}
+    changed = True
+    while changed:
+        changed = False
+        for node, outs in edges.items():
+            if node not in bad and outs & bad:
+                bad.add(node)
+                changed = True
+    selected = set(meta["workspace_default_members"])
+    print(
+        ",".join(
+            f"{p['name']}/{f}"
+            for p in sorted(packages, key=lambda p: p["name"])
+            if p["id"] in selected
+            for f in sorted(p["features"])
+            if f != "default" and f"{p['name']}/{f}" not in bad
+        )
+    )
+
+
+if __name__ == "__main__":
+    main()
```

**File**: `.github/workflows/ci.yml` (modified, +18/-6)
```diff
@@ -307,6 +307,17 @@ jobs:
                      /etc/apt/sources.list.d/*microsoft*
           sudo apt-get update
           sudo apt-get install -y mold
+      # Every feature except no-jail (and what enables it): no-jail compiles
+      # PathJail and its tests out, so `--all-features` never tested the jail.
+      # Same set as GitLab's mr_quick.py --print-test-features.
+      - name: Select test features
+        working-directory: rust
+        shell: bash
+        run: |
+          if [[ "${{ runner.os }}" == "Windows" ]]; then PY=python; else PY=python3; fi
+          features=$("$PY" ../.github/scripts/test_features.py)
+          [[ -n "$features" ]]
+          echo "TEST_FEATURES=$features" >> "$GITHUB_ENV"
       - name: Run tests
         working-directory: rust
         shell: bash
@@ -329,14 +340,14 @@ jobs:
             fi
             JEMALLOC_OVERRIDE="${{ steps.jemalloc.outputs.jemalloc-override }}" \
             CARGO_TARGET_X86_64_PC_WINDOWS_GNU_RUSTFLAGS="-L ${{ steps.jemalloc.outputs.dummy-dir }}" \
-            "$CARGO" test --target x86_64-pc-windows-gnu --all-features "${SELECT[@]}"
+            "$CARGO" test --target x86_64-pc-windows-gnu --features "$TEST_FEATURES" "${SELECT[@]}"
           elif [[ "${{ runner.os }}" == "Linux" ]]; then
             # `mold -run` redirects child linker invocations to mold without
             # touching RUSTFLAGS (which is pinned to `-Dwarnings` job-wide and
             # would override any .cargo/config.toml rustflags).
-            mold -run "$CARGO" test --all-features
+            mold -run "$CARGO" test --features "$TEST_FEATURES"
           else
-            "$CARGO" test --all-features
+            "$CARGO" test --features "$TEST_FEATURES"
           fi
 
       # Wall-clock gates: #581's parallel BM25 rebuild win, the context-kernel
@@ -372,9 +383,10 @@ jobs:
             (( idle * 10 >= (busy + idle) * 9 )) && break
           done
           ps -eo pid,pcpu,etime,args --sort=-pcpu | head -4
-          cargo test --all-features --lib -- --test-threads=1 parallel_incremental_rebuild_perf_gate --nocapture
-          cargo test --all-features --lib -- --test-threads=1 context_kernel::perf_benchmark
-          cargo test --all-features --test main -- --test-threads=1 performance_stress
+          cargo test --features "$TEST_FEATURES" --lib -- --test-threads=1 parallel_incremental_rebuild_perf_gate --nocapture
+          cargo test --features "$TEST_FEATURES" --lib -- --test-threads=1 context_kernel::perf_benchmark
+          cargo test --features "$TEST_FEATURES" --test main -- --test-threads=1 performance_stress
+          cargo test --features "$TEST_FEATURES" --test main -- --test-threads=1 context_radar_perf
 
   clippy:
     name: Clippy
```

**File**: `docs/contracts/team-seat-value-v1/frozen-hashes.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "contract": "team-seat-value-v1",
   "sha256": {
-    ".github/workflows/ci.yml": "adfe71e30bd19082d30c369c2cb8219912741951413c29e206029546b64ac14e",
+    ".github/workflows/ci.yml": "797956ec6f0ea25f8ddd5799368ca79922cdeabfe8e6032cc961097eeac4e3a5",
     "ci/gitlab-ci.yml": "5a1251f812a03c6ab97df01feda26942dc22d406b0e79374e4ff97c5c279178b",
     "docs/contracts/README.md": "e7012341f0448efe8570ed93d20772558f0245566b333b962f9dfabc1c1ff08a",
     "docs/contracts/team-seat-value-v1/README.md": "caecd3e67f1e9c0adacc272a9dae892ac0cddef42c5e17066c069d17a83505d6",
```

**File**: `rust/src/core/artifacts.rs` (modified, +6/-4)
```diff
@@ -229,12 +229,14 @@ mod tests {
         std::fs::create_dir_all(&vault).unwrap();
         std::fs::write(vault.join("note.md"), "# Vault note\nrotation policy").unwrap();
 
+        // serde_json escapes the path: a Windows path's backslashes are not
+        // valid JSON escapes when formatted into the string verbatim.
         write_registry(
             project.path(),
-            &format!(
-                r#"{{"artifacts":[{{"name":"vault","path":"{}","description":"notes"}}]}}"#,
-                vault.display()
-            ),
+            &serde_json::json!({
+                "artifacts": [{"name": "vault", "path": vault, "description": "notes"}]
+            })
+            .to_string(),
         );
 
         // Without an allow-list entry the external path is rejected by the jail.
```

**File**: `rust/src/core/pathjail_tests.rs` (modified, +6/-0)
```diff
@@ -585,6 +585,10 @@ fn harness_auto_memory_path_is_allowed_without_extra_roots() {
     let old_home = std::env::var_os("HOME");
     crate::test_env::set_var("HOME", tmp.path());
     crate::test_env::remove_var("CLAUDE_CONFIG_DIR");
+    // `dirs::home_dir()` ignores HOME on Windows (it asks the shell for the
+    // profile folder), so name the harness config dir there instead.
+    #[cfg(windows)]
+    crate::test_env::set_var("CLAUDE_CONFIG_DIR", tmp.path().join(".claude"));
     let root = tmp.path().join("project");
     let memory = tmp
         .path()
@@ -633,6 +637,8 @@ fn harness_auto_memory_path_is_allowed_without_extra_roots() {
         Some(h) => crate::test_env::set_var("HOME", h),
         None => crate::test_env::remove_var("HOME"),
     }
+    #[cfg(windows)]
+    crate::test_env::remove_var("CLAUDE_CONFIG_DIR");
 }
 
 /// #820: lean-ctx state dir (tee files) is implicitly allowed by the jail.
```

**File**: `rust/tests/suite/context_radar_perf.rs` (modified, +33/-14)
```diff
@@ -3,6 +3,15 @@ use std::time::Instant;
 
 use lean_ctx::core::context_radar::{ContextRadar, RadarEvent, default_window_for_client};
 
+/// The timing half of each perf test is opt-in, as in `performance_stress`:
+/// under the multi-threaded suite, CPU contention alone pushed a 150 ms bound
+/// to 409 ms on a green ubuntu runner. CI's perf-gate step sets
+/// `LEAN_CTX_PERF_GATE=1` and runs these serialized; the functional
+/// assertions run always.
+fn timing_enforced() -> bool {
+    std::env::var("LEAN_CTX_PERF_GATE").as_deref() == Ok("1")
+}
+
 fn make_event(event_type: &str, tokens: usize, tool_name: Option<&str>) -> RadarEvent {
     RadarEvent {
         ts: 1700000000,
@@ -44,7 +53,9 @@ fn perf_radar_load_100_events() {
     assert_eq!(radar.events.len(), 100);
     let b = radar.budget_breakdown();
     assert!(b.lean_ctx_tool_tokens > 0);
-    assert!(elapsed.as_millis() < 100, "100 events took {elapsed:?}");
+    if timing_enforced() {
+        assert!(elapsed.as_millis() < 100, "100 events took {elapsed:?}");
+    }
 }
 
 #[test]
@@ -71,10 +82,12 @@ fn perf_radar_load_10k_events() {
     assert_eq!(radar.events.len(), 10_000);
     let b = radar.budget_breakdown();
     assert!(b.tracked_total > 0);
-    assert!(
-        elapsed.as_millis() < 500,
-        "10k events took {elapsed:?} — should be <500ms"
-    );
+    if timing_enforced() {
+        assert!(
+            elapsed.as_millis() < 500,
+            "10k events took {elapsed:?} — should be <500ms"
+        );
+    }
 }
 
 #[test]
@@ -90,10 +103,12 @@ fn perf_radar_load_50k_events() {
     let elapsed = start.elapsed();
 
     assert_eq!(radar.events.len(), 50_000);
-    assert!(
-        elapsed.as_millis() < 2000,
-        "50k events took {elapsed:?} — should be <2s"
-    );
+    if timing_enforced() {
+        assert!(
+            elapsed.as_millis() < 2000,
+            "50k events took {elapsed:?} — should be <2s"
+        );
+    }
 }
 
 // ---------------------------------------------------------------------------
@@ -278,7 +293,9 @@ fn introspect_anthropic_large_request() {
     assert_eq!(b.tool_definition_count, 60);
     assert!(b.tool_definition_tokens > 0);
     assert!(b.total_input_tokens > 7000);
-    assert!(elapsed.as_millis() < 150, "introspect took {elapsed:?}");
+    if timing_enforced() {
+        assert!(elapsed.as_millis() < 150, "introspect took {elapsed:?}");
+    }
 }
 
 #[test]
@@ -487,8 +504,10 @@ fn perf_budget_breakdown_100k_events() {
     let elapsed = start.elapsed();
 
     assert!(b.tracked_total > 0);
-    assert!(
-        elapsed.as_millis() < 150,
-        "budget_breakdown on 100k events took {elapsed:?}"
-    );
+    if timing_enforced() {
+        assert!(
+            elapsed.as_millis() < 150,
+            "budget_breakdown on 100k events took {elapsed:?}"
+        );
+    }
 }
```

#### Recent Merged Pull Requests:
- **PR #2221** (2026-11-09): fix(deps): clear RUSTSEC-2026-0459, -0457 and -0462 from main CI (@yvgude)
- **PR #2220** (2026-11-09): fix(shell): close PowerShell gate gaps and Codex auto-approval (@yvgude)
- **PR #2219** (2026-11-09): ci: speed up GitHub Actions CI (O0 engine, path filter, sccache, split docs) (@yvgude)
- **PR #2218** (2026-11-09): test(shell): hold the env lock in cwd-reading allowlist tests (@RobinNorberg)
- **PR #2216** (2026-11-08): fix(shell): read a PowerShell tool call as PowerShell, accept its member calls, gate its call operator (@RobinNorberg)
- **PR #2214** (2026-11-08): ci(test): test PathJail on GitHub, fix the tests it exposed (@yvgude)

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

## X. deps): clear RUSTSEC-2026-0459, -0457 and -0462 from main CI

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yvgude/lean-ctx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f1172309`: deps): clear RUSTSEC-2026-0459, -0457 and -0462 from main CI. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **Dependencies with published advisories are updated.** The bundled SQLite moves to the
  release `rusqlite` 0.41 ships, fixing RUSTSEC-2026-0459. The vendored MCP SDK `rmcp` moves
  from 2.0 to 3.9, which bounds HTTP response bodies an MCP server sends to `lean-ctx`
  (RUSTSEC-2026-0462) and stops OAuth discovery for HTTP MCP servers from following metadata
  URLs to private or loopback addresses (RUSTSEC-2026-0457). The lean-ctx patches on top of
  `rmcp` shrink to one, since 3.9 contains the other fixes; `lean-ctx-embed` now declares the
  Rust 1.89 its dependencies need.

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f1172309` are properly handled with clean fallback behavior.
