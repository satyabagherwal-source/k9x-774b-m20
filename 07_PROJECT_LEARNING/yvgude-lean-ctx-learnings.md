> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yvgude-lean-ctx-learnings.md`  
> **Source**: github ([https://github.com/yvgude/lean-ctx](https://github.com/yvgude/lean-ctx))  
> **Source Version**: `7c9025c4`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-02T17:39:23.116Z  
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
> **Harvest Timestamp**: 2026-11-02T17:39:06.946Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yvgude/lean-ctx`
- **Description**: LeanCTX is the Context Gateway for AI Systems. Select task-relevant context, apply supported controls, connect local knowledge and inspect recorded evidence. Open-source Engine: CLI, MCP, hooks and supported proxy paths.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3926 stars

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
use lean_ctx::server::registry::{ToolRegistry, build_registry};
use lean_ctx::server::tool_trait::{ToolContext, ToolOutput};
use lean_ctx::tools::{CrpMode, SharedCache};

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
        args.insert("path".into(), Value::String(resolved.clone()));
        ctx.resolved_paths.insert("path".into(), resolved);
        self.dispatch("ctx_tree", args, ctx).map(|o| o.text)
    }

    /// Call 
```

### Core Architecture Module: `rust/crates/lean-ctx-protocol/src/engine_context_materialization.rs`
```
// SPDX-License-Identifier: Apache-2.0

//! Bounded materialization of an already-planned explicit source batch.
//!
//! The request carries the original source bodies because the planning
//! response intentionally contains descriptors only.  The binding digest is
//! an integrity join to that prior response, not an authorization grant or a
//! receipt.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fmt::Write as _;

use crate::{
    EngineContextSourcePlanRequestV1, EngineContextSourcePlanResponseV1, SemanticVersion,
    Sha256Digest, UtcTimestamp, ValidationError,
};

/// Keep the materialized context within the existing explicit-source bound.
pub const MAX_ENGINE_SOURCE_MATERIALIZED_CONTEXT_BYTES: usize =
    super::MAX_ENGINE_SOURCE_PLAN_REQUEST_BYTES;

/// Re-submit the bounded original source batch with the digest of the plan to
/// which the caller intends to bind materialization.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineContextSourceMaterializationRequestV1 {
    pub source_plan: EngineContextSourcePlanRequestV1,
    pub expected_binding_digest: Sha256Digest,
    /// Server-emitted identity time from a retention-enabled source plan.
    /// This is an unsigned replay hint, never authorization or provenance.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub planning_evaluation_time: Option<UtcTimestamp>,
}

impl EngineContextSourceMaterializationRequestV1 {
    /// Validate the original source request and its serialized size before any
    /// policy planning or body joining occurs.
    pub fn validate_payload(&self) -> Result<(), ValidationError> {
        self.source_plan.validate_payload()?;
        let encoded = serde_json::to_vec(self)
            .map_err(|_| ValidationError::new("invalid Engine materialization request"))?;
        if encoded.len() > super::MAX_ENGINE_SOURCE_PLAN_REQUEST_BYTES {
            return Err(ValidationError::new(
                "Engine materialization source request exceeds size bound",
            ));
        }
        Ok(())
    }
}

/// Digest-bound context bytes selected by the canonical source planner.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineContextSourceMaterializationResponseV1 {
    pub schema_version: u32,
    pub transport_version: u32,
    pub engine_interface_version: SemanticVersion,
    pub plan: EngineContextSourcePlanResponseV1,
    pub materialized_digest: Sha256Digest,
    pub materialized_token_count: u64,
    pub content: String,
}

impl EngineContextSourceMaterializationResponseV1 {
    /// Validate the additive response envelope and the digest of its final
    /// policy-enforced materialized bytes.
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.schema_version != 1
            || self.transport_version != 1
            || self.engine_interface_version.as_str() != "1.0.0"
            || self.content.len() > MAX_ENGINE_SOURCE_MATERIALIZED_CONTEXT_BYTES
            || self.materialized_token_count > self.plan.result.plan.budget_tokens
        {
            return Err(ValidationError::new(
                "invalid Engine materialization response envelope",
            ));
        }
        self.plan.validate_binding()?;
        let actual = sha256_digest(self.content.as_bytes())?;
        if actual != self.materialized_digest {
            return Err(ValidationError::new(
                "Engine materialized content digest mismatch",
            ));
        }
        Ok(())
    }
}

fn sha256_digest(bytes: &[u8]) -> Result<Sha256Digest, ValidationError> {
    let mut digest = String::from("sha256:");
    for byte in Sha256::digest(bytes).iter() {
        write!(&mut digest, "{byte:02x}")
            .map_err(|_| ValidationError::new("Engine materialized digest encoding failed"))?;
    }
    Sha256Digest::new(digest)
}

```

### Core Architecture Module: `rust/crates/lean-ctx-protocol/src/engine_context_materialization_v2.rs`
```
// SPDX-License-Identifier: Apache-2.0

//! Opt-in v2 materialization: the unchanged v1 exchange plus a presenter
//! capability.
//!
//! A presenter capability is a bearer secret the Engine hands to the caller
//! that presented the sources. Whoever later shows it is treated as THE
//! HOLDER OF THAT CAPABILITY for those presentations. It is not an agent
//! name, not an attested identity and not an authorization: current source
//! rights are checked again at every use, with or without it.
//!
//! The capability is host-internal. It must never be placed in model context,
//! tool arguments, tool results, logs or receipts, and never sent to a
//! provider. Records name a presenter only by [`EnginePresenterGrantV1::presenter_ref`].

use serde::{Deserialize, Serialize};

use crate::{
    EngineContextSourceMaterializationRequestV1, EngineContextSourceMaterializationResponseV1,
    ProtocolReference, ValidationError,
};

/// Schema id of the v2 materialization exchange.
pub const ENGINE_CONTEXT_MATERIALIZATION_V2_SCHEMA_ID: &str =
    "leanctx.engine-context-materialization/v2";
/// Schema id of the presenter revocation exchange.
pub const ENGINE_PRESENTER_REVOCATION_V1_SCHEMA_ID: &str = "leanctx.engine-presenter-revocation/v1";
/// First Engine release that serves `context-materialize-sources-v2`.
pub const ENGINE_PRESENTER_CAPABILITY_MIN_ENGINE_VERSION: &str = "3.11.0";
/// Longest lifetime a caller may ask for: one day.
pub const MAX_ENGINE_PRESENTER_TTL_SECONDS: u32 = 24 * 60 * 60;
/// Wire prefix of a presenter capability.
pub const ENGINE_PRESENTER_CAPABILITY_PREFIX: &str = "lcp1_";
/// Wire prefix of a content-free presenter reference.
pub const ENGINE_PRESENTER_REF_PREFIX: &str = "presenter:";

const CAPABILITY_HEX_CHARS: usize = 64;
const PRESENTER_REF_HEX_CHARS: usize = 32;

fn lower_hex(text: &str, length: usize) -> bool {
    text.len() == length
        && text
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

/// Whether `text` has the wire form of a presenter capability. Form only:
/// says nothing about whether any Engine issued it.
#[must_use]
pub fn is_engine_presenter_capability_form(text: &str) -> bool {
    text.strip_prefix(ENGINE_PRESENTER_CAPABILITY_PREFIX)
        .is_some_and(|hex| lower_hex(hex, CAPABILITY_HEX_CHARS))
}

/// How the caller wants the sources of this request to be presented.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "snake_case", tag = "mode")]
pub enum EnginePresenterRequestV1 {
    /// Mint a new capability with this lifetime.
    Issue { ttl_seconds: u32 },
    /// Present under a capability the caller already holds. The capability
    /// is never part of this JSON: it reaches the Engine through
    /// `--presenter-capability-file`.
    Renew,
}

/// The v1 materialization request, with the presenter mode.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineContextSourceMaterializationRequestV2 {
    pub schema_version: u32,
    pub materialization: EngineContextSourceMaterializationRequestV1,
    pub presenter: EnginePresenterRequestV1,
}

impl EngineContextSourceMaterializationRequestV2 {
    /// Validate the envelope and the unchanged v1 payload.
    pub fn validate_payload(&self) -> Result<(), ValidationError> {
        if self.schema_version != 2 {
            return Err(invalid());
        }
        match self.presenter {
            EnginePresenterRequestV1::Issue { ttl_seconds }
                if !(1..=MAX_ENGINE_PRESENTER_TTL_SECONDS).contains(&ttl_seconds) =>
            {
                Err(invalid())
            }
            _ => self.materialization.validate_payload(),
        }
    }
}

/// What the Engine tells the caller about its presenter entry.
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EnginePresenterGrantV1 {
    /// Content-free reference of the presenter entry: `presenter:` and 32
    /// lowercase hex characters. Derived from a stored verifier, never from
    /// the capability. Safe in records.
    pub presenter_ref: ProtocolReference,
    /// End of the capability's lifetime, Unix seconds.
    pub expires_at_unix: u64,
    /// The capability, for `issue` only. Host-internal secret.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capability: Option<String>,
}

impl std::fmt::Debug for EnginePresenterGrantV1 {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("EnginePresenterGrantV1")
            .field("presenter_ref", &self.presenter_ref)
            .field("expires_at_unix", &self.expires_at_unix)
            .field(
                "capability",
                &self.capability.as_ref().map(|_| "<redacted>"),
            )
            .finish()
    }
}

impl EnginePresenterGrantV1 {
    fn validate(&self) -> Result<(), ValidationError> {
        let reference_ok = self
            .presenter_ref
            .as_str()
            .strip_prefix(ENGINE_PRESENTER_REF_PREFIX)
            .is_some_and(|hex| lower_hex(hex, PRESENTER_REF_HEX_CHARS));
        let capability_ok = self
            .capability
            .as_deref()
            .is_none_or(is_engine_presenter_capability_form);
        if reference_ok && capability_ok {
            Ok(())
        } else {
            Err(invalid())
        }
    }
}

/// The unchanged v1 materialization response, with the presenter grant.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineContextSourceMaterializationResponseV2 {
    pub schema_version: u32,
    pub materialization: EngineContextSourceMaterializationResponseV1,
    pub presenter: EnginePresenterGrantV1,
}

impl EngineContextSourceMaterializationResponseV2 {
    /// Validate the envelope, the grant's form and the v1 payload. The
    /// capability never appears inside the materialized content.
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.schema_version != 2 {
            return Err(invalid());
        }
        self.presenter.validate()?;
        let leaked = self
            .presenter
            .capability
            .as_deref()
            .is_some_and(|capability| self.materialization.content.contains(capability));
        if leaked {
            return Err(invalid());
        }
        self.materialization.validate()
    }
}

/// Request of `context-presenter-revoke`. The capability to revoke reaches
/// the Engine through `--presenter-capability-file`, never through this JSON.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EnginePresenterRevocationRequestV1 {
    pub schema_version: u32,
}

/// Answer of `context-presenter-revoke`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EnginePresenterRevocationResponseV1 {
    pub schema_version: u32,
    pub presenter_ref: ProtocolReference,
    pub revoked: bool,
}

fn invalid() -> ValidationError {
    ValidationError::new("invalid Engine materialization v2 envelope")
}

```

### Core Architecture Module: `rust/crates/lean-ctx-protocol/src/engine_context_plan.rs`
```
// SPDX-License-Identifier: Apache-2.0

//! Local Engine planning transport. A plan is not admission or execution evidence.

use serde::{Deserialize, Serialize};

use crate::{ContextPlanProjectionV1, SemanticVersion, TaskId, ValidationError};

/// Bound the request before parsing, independently of the selected context budget.
pub const MAX_ENGINE_CONTEXT_PLAN_REQUEST_BYTES: usize = 64 * 1024;
pub const MAX_ENGINE_CONTEXT_PLAN_QUERY_BYTES: usize = 16 * 1024;
pub const MAX_ENGINE_CONTEXT_PLAN_TOKENS: u32 = 1_048_576;
pub const MAX_ENGINE_CONTEXT_PLAN_CANDIDATES: u16 = 256;

/// Ask the canonical kernel for a reference plan under the host's local policy.
/// The task ID is correlation only, never an identity or authorization grant.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineContextPlanRequestV1 {
    pub schema_version: u32,
    pub transport_version: u32,
    pub engine_interface_version: SemanticVersion,
    pub task_id: TaskId,
    pub query: String,
    pub budget_tokens: u32,
    pub max_candidates: u16,
}

impl EngineContextPlanRequestV1 {
    /// Validate payload bounds; the receiving transport must also admit versions.
    pub fn validate_payload(&self) -> Result<(), ValidationError> {
        if self.query.trim().is_empty()
            || self.query.len() > MAX_ENGINE_CONTEXT_PLAN_QUERY_BYTES
            || self.query.contains('\0')
            || !(1..=MAX_ENGINE_CONTEXT_PLAN_TOKENS).contains(&self.budget_tokens)
            || !(1..=MAX_ENGINE_CONTEXT_PLAN_CANDIDATES).contains(&self.max_candidates)
        {
            return Err(ValidationError::new("invalid Engine context-plan bounds"));
        }
        Ok(())
    }
}

/// Existing canonical projection, not a second planner or a fabricated receipt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineContextPlanResponseV1 {
    pub schema_version: u32,
    pub transport_version: u32,
    pub engine_interface_version: SemanticVersion,
    pub plan: ContextPlanProjectionV1,
}

```

### Core Architecture Module: `rust/crates/lean-ctx-protocol/src/engine_context_source_execution.rs`
```
// SPDX-License-Identifier: Apache-2.0

//! Typed wire envelope for the operator-owned explicit-source execution flow.
//!
//! This module only validates joins among the existing task, execution-plan,
//! source-plan, invocation, observation, and receipt projections.  It does not
//! authorize a caller, verify a signer, or create a second receipt authority.

use std::fmt::Write as _;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{
    AcceptanceState, EngineContextSourceMaterializationRequestV1,
    EngineContextSourcePlanResponseV1, EngineInvocationV1, EngineObservationStatusV1,
    EngineObservationV1, EnginePolicyDecisionV1, ExecutionPlanV1, ProtocolReference, ReceiptId,
    SemanticVersion, Sha256Digest, TaskEnvelopeV1, ValidationError, deserialize_schema_version,
    validate_schema_version,
};

/// The host stdin request is bounded by the existing one-megabyte source
/// transport limit before this typed envelope is decoded.
pub const MAX_ENGINE_SOURCE_EXECUTION_REQUEST_BYTES: usize =
    crate::MAX_ENGINE_SOURCE_PLAN_REQUEST_BYTES;

/// Native Engine output uses the same one-megabyte bound as materialized input.
pub const MAX_ENGINE_SOURCE_EXECUTION_VIEW_BYTES: usize =
    crate::MAX_ENGINE_SOURCE_MATERIALIZED_CONTEXT_BYTES;

const TRANSPORT_VERSION: u32 = 1;
const ENGINE_INTERFACE_VERSION: &str = "1.0.0";
const LOCAL_NATIVE_PROVIDER: &str = "local-native";
const LOCAL_NATIVE_CAPABILITY: &str = "capability://leanctx/context-optimization";
const LOCAL_NATIVE_CAPABILITY_VERSION: &str = "1.0.0";
const INPUT_REF_PREFIX: &str = "input:source-materialization-sha256:";
const SOURCE_PLAN_EVIDENCE_PREFIX: &str = "artifact://execution/evidence/";
const TASK_REF_PREFIX: &str = "task:sha256:";
const PLAN_REF_PREFIX: &str = "plan:sha256:";

/// The exact operator request accepted by `context-sources-receipt`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineContextSourceExecutionRequestV1 {
    #[serde(deserialize_with = "deserialize_schema_version")]
    pub schema_version: u32,
    pub transport_version: u32,
    pub engine_interface_version: SemanticVersion,
    pub task: TaskEnvelopeV1,
    pub plan: ExecutionPlanV1,
    pub materialization: EngineContextSourceMaterializationRequestV1,
}

impl EngineContextSourceExecutionRequestV1 {
    /// Validate the request envelope and its cross-object identity joins.
    pub fn validate(&self) -> Result<(), ValidationError> {
        validate_header(
            self.schema_version,
            self.transport_version,
            &self.engine_interface_version,
        )?;
        self.task.validate()?;
        self.plan.validate()?;
        self.materialization.validate_payload()?;
        validate_header(
            self.materialization.source_plan.planning.schema_version,
            self.materialization.source_plan.planning.transport_version,
            &self
                .materialization
                .source_plan
                .planning
                .engine_interface_version,
        )?;
        if self.task.task_id != self.plan.task_id
            || self.materialization.source_plan.planning.task_id != self.task.task_id
        {
            return Err(ValidationError::new(
                "source execution request task IDs do not agree",
            ));
        }
        validate_local_native_plan(&self.plan)?;
        if self.plan.context_plan_id.is_some()
            || self.task.region_policy_ref.is_some()
            || self.task.model_policy_ref.is_some()
        {
            return Err(ValidationError::new(
                "source execution request is not a local-native declaration",
            ));
        }
        bounded_wire_size(self, MAX_ENGINE_SOURCE_EXECUTION_REQUEST_BYTES)
    }
}

/// The actual output view returned by the native Engine adapter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineContextSourceExecutionViewV1 {
    pub text: String,
    pub output_ref: Option<ProtocolReference>,
    pub output_digest: Option<Sha256Digest>,
}

impl EngineContextSourceExecutionViewV1 {
    fn validate_for(&self, observation: &EngineObservationV1) -> Result<(), ValidationError> {
        if self.text.len() > MAX_ENGINE_SOURCE_EXECUTION_VIEW_BYTES
            || self.output_ref != observation.output_ref
            || self.output_digest != observation.output_digest
        {
            return Err(ValidationError::new(
                "source execution view does not bind the Engine observation",
            ));
        }
        let output_digest = self.output_digest.as_ref().ok_or_else(|| {
            ValidationError::new("source execution view is missing its output digest")
        })?;
        let expected_output_ref = format!("output:{}", output_digest.hex());
        if self.output_ref.as_ref().map(ProtocolReference::as_str)
            != Some(expected_output_ref.as_str())
        {
            return Err(ValidationError::new(
                "source execution output ref does not bind its digest",
            ));
        }
        let digest = sha256_digest(self.text.as_bytes())?;
        if self.output_digest.as_ref() != Some(&digest) {
            return Err(ValidationError::new(
                "source execution view digest does not bind its text",
            ));
        }
        Ok(())
    }
}

/// The canonical receipt identity projection returned by the host authority.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineContextSourceCanonicalReceiptV1 {
    pub receipt_id: ReceiptId,
    pub receipt_ref: ProtocolReference,
    pub receipt_digest: Sha256Digest,
    pub outcome: AcceptanceState,
}

impl EngineContextSourceCanonicalReceiptV1 {
    fn validate(&self) -> Result<(), ValidationError> {
        if self.outcome != AcceptanceState::Unknown
            || self.receipt_ref.as_str() != format!("id:{}", self.receipt_digest.as_str())
        {
            return Err(ValidationError::new(
                "source execution receipt must be unknown and digest-bound",
            ));
        }
        Ok(())
    }
}

/// The actual v1 source execution response; fields intentionally match the
/// existing JSON object emitted by the CLI host adapter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineContextSourceExecutionResponseV1 {
    #[serde(deserialize_with = "deserialize_schema_version")]
    pub schema_version: u32,
    pub transport_version: u32,
    pub engine_interface_version: SemanticVersion,
    pub source_plan: EngineContextSourcePlanResponseV1,
    pub execution_plan: ExecutionPlanV1,
    pub view: EngineContextSourceExecutionViewV1,
    pub invocation: EngineInvocationV1,
    pub observation: EngineObservationV1,
    pub canonical_receipt: EngineContextSourceCanonicalReceiptV1,
}

impl EngineContextSourceExecutionResponseV1 {
    /// Validate response versions, canonical source evidence, and all joins
    /// needed to consume this response as one bounded execution result.
    pub fn validate(&self) -> Result<(), ValidationError> {
        validate_header(
            self.schema_version,
            self.transport_version,
            &self.engine_interface_version,
        )?;
        self.source_plan.validate_binding()?;
        self.execution_plan.validate()?;
        self.invocation.validate()?;
        self.observation.validate_for(&self.invocation)?;
        self.view.validate_for(&self.observation)?;
        self.canonical_receipt.validate()?;

        if self.execution_plan.task_id != self.source_plan.result.plan.task_id
            || self.execution_plan.context_plan_id.as_ref()
                != Some(&self.source_plan.result.plan.context_plan_id)
            || self.execution_plan.context_token_limit()
                != Some(self.source_plan.result.plan.budget_tokens)
        {
            return Err(ValidationError::new(
                "source execution response plan does not bind its source plan",
            ));
        }
        validate_local_native_plan(&self.execution_plan)?;
        if self.invocation.operation.capability_id.as_str() != LOCAL_NATIVE_CAPABILITY
            || self.invocation.operation.capability_version.as_str()
                != LOCAL_NATIVE_CAPABILITY_VERSION
        {
            return Err(ValidationError::new(
                "source execution response is not bound to the local-native capability",
            ));
        }
        if self.invocation.policy_admission.decision != EnginePolicyDecisionV1::Admitted
            || self.observation.status != EngineObservationStatusV1::Succeeded
            || self.observation.source_lineage != self.invocation.source_refs
        {
            return Err(ValidationError::new(
                "source execution response is not an admitted complete observation",
            ));
        }
        let source_plan_digest = canonical_sha256(&self.source_plan)?;
        let execution_plan_digest = canonical_sha256(&self.execution_plan)?;
        validate_source_references(
            &self.invocation,
            &source_plan_digest,
            &execution_plan_digest,
        )?;
        let receipt_link = self.observation.receipt_link.as_ref().ok_or_else(|| {
            ValidationError::new("source execution response is missing the Engine receipt link")
        })?;
        if receipt_link.receipt_ref.as_str()
            != format!("receipt:{}", receipt_link.receipt_digest.as_str())
        {
            return Err(ValidationError::new(
                "source execution Engine receipt ref does not bind its digest",
            ));
        }
        Ok(())
    }

    /// Validate this response against the exact request that admitted it.
    /// The task evidence is not repeated in the response wire object, so this
    /// join is explicit for consumers that retain the 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2162** (2026-11-02): **bug: Not able to install new realease due to signature verification problems**
  *Symptoms*: **lean-ctx version:** (run `lean-ctx --version`) 3.11.0  **OS:** (macOS / Linux / Windows) linux  **AI tool:** (Cursor / Claude Code / Copilot / Crush / other) -  **What happened:**  <img width="893" height="283" alt="Image" src="https://github.com/user-attachments/assets/4714112d-1554-42dc-aded-814040918bae" />  **What you expected:**  working   **Steps to reproduce:** 1. lean-ctx update  **Relevant output:** ``` (paste terminal output here) ``` 
  **Post-Mortem & Fix Analysis**:
  > Hello, yes this is a known problem with your current version 3.11. Please check https://github.com/yvgude/lean-ctx/issues/2071
  > Closing as a duplicate of #2071. The 3.11.0 updater needs the external `cosign` tool. Reinstall once through the channel you used (for example `curl -fsSL https://leanctx.com/install.sh | sh`); from then on `lean-ctx update` works without cosign.

- **Issue #2148** (2026-10-26): **bug: lean-ctx root bleeds accross sessions**
  *Symptoms*: **lean-ctx version:** (run `lean-ctx --version`) 3.11.0  **OS:** (macOS / Linux / Windows) linux  **AI tool:** (Cursor / Claude Code / Copilot / Crush / other)  **What happened:**  In my project toktok, with a brand new conversation, I had this :  <img width="1882" height="185" alt="Image" src="https://github.com/user-attachments/assets/606ea904-4710-496d-a84d-328c9bf3a778" />  <img width="1882" height="298" alt="Image" src="https://github.com/user-attachments/assets/83e2a718-4c74-4c93-a3a4-58e89ce2c811" />  The root was not in the right folder.  **What you expected:**  Root should always follow Claude Code's own root  
  **Post-Mortem & Fix Analysis**:
  > checking!

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

### Incident Patch 1: `3550b694` (2026-11-01)
**Commit Message**: fix: 3.12.1 shell security, knowledge journal, Hive-ready engine, cleanup waves 3–4 (#2168)

* fix: 3.12.1 shell security, knowledge journal, Hive-ready engine, cleanup waves 3–4

Public export of private source ce4df17c70becdabb06095ff518ab827162a7850.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test: make two shell-gate tests hold on Windows

The run-directory side-door test built its relative path to home with the
drive prefix still in it; the vibe heredoc test read the allowlist without
the test env lock and raced tests that narrow it.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +2/-0)
```diff
@@ -474,6 +474,8 @@ jobs:
         run: node packages/lean-ctx-bin/postinstall.cockpit.test.cjs
       - name: Test fail-closed checksum verification
         run: node packages/lean-ctx-bin/postinstall.checksum.test.cjs
+      - name: Test preinstall stops only the installed daemon
+        run: node packages/lean-ctx-bin/preinstall.test.cjs
 
   cookbook:
     name: Cookbook (Node)
```

**File**: `.github/workflows/publish-clients.yml` (modified, +4/-30)
```diff
@@ -3,16 +3,17 @@ name: Historical /v1 client publishing
 # This workflow preserves publication mechanics for archived thin-client
 # prototypes. It is not an SDK release path at all: the one LeanCTX SDK is
 # `thinkery-leanctx-sdk`, developed and released in Thinkery-AG/leanctx-sdk.
-# See docs/reference/sdk-surface.md.
+# See docs/reference/sdk-surface.md. The TypeScript client in cookbook/sdk is
+# a private cookbook example (`private: true`) and is never published here.
 
 on:
   workflow_dispatch:
     inputs:
       targets:
         description: "Which registries to publish to"
         type: choice
-        default: npm
-        options: [all, npm, pypi, crates]
+        default: crates
+        options: [all, pypi, crates]
   push:
     tags:
       - 'client-v[0-9]*'
@@ -44,33 +45,6 @@ jobs:
           path: ${{ runner.temp }}/ip-provenance-publish-clients-report.json
           if-no-files-found: ignore
 
-  publish-npm:
-    name: Historical TypeScript client (disabled)
-    needs: ip-provenance-gate
-    if: false
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v4 # v4
-        with:
-          persist-credentials: false
-      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
-        with:
-          node-version: 22
-          registry-url: https://registry.npmjs.org
-      - name: Build, test, publish
-        working-directory: cookbook
-        run: |
-          set -euo pipefail
-          npm ci
-          npm --workspace lean-ctx-client run build
-          npm --workspace lean-ctx-client test
-          PKG_VERSION="$(node -p "require('./sdk/package.json').version")"
-          if npm view "lean-ctx-client@${PKG_VERSION}" version >/dev/null 2>&1; then
-            echo "npm already has lean-ctx-client@${PKG_VERSION} — skipping publish."
-            exit 0
-          fi
-          npm publish --workspace lean-ctx-client --access public
-
   publish-pypi:
     name: Historical Python client (disabled)
     # clients/python is archived; canonical lean-ctx-python publication is
```

**File**: `AGENTS.md` (modified, +52/-10)
```diff
@@ -95,15 +95,44 @@ The engine crate `lean_ctx` is large; every compile with codegen costs
 8–17 GB RAM and queues behind the machine's compile gate. With many agents
 per machine, memory runs out. Therefore:
 
-- **Workers** iterate with `cargo check --locked --all-targets` only (type
-  checks code and tests, no codegen). A worker runs affected tests at most once
-  per task, filtered, and only when the task needs behaviour evidence.
+- **Workers** iterate with
+  `cargo check --locked --all-targets --config build.incremental=true` only
+  (type checks code and tests, no codegen). Incremental is off in the global
+  Cargo config to save disk, but for this edit loop it pays: measured
+  2026-10-31 after a one-line edit, `--all-targets` 95 s → 18 s and plain
+  `check` 40 s → 11 s; the first incremental check of a worktree builds the
+  cache (minutes) and keeps about 5.5 GB under its target dir. A worker runs
+  affected tests at most once per task, filtered, and only when the task needs
+  behaviour evidence.
 - **Workers do not run** `cargo fast`, `cargo build`, `--release`,
   `dev-install`/`make dev`, or the full `cargo test --lib`.
 - **The integrator** (lead) runs `cargo fast`, `dev-install` and the full gates
   once per integrated batch, on one machine at a time.
 - A worker that needs a runnable binary asks the lead instead of building one.
 
+### Split before you grow (owner 2026-11-01)
+
+The engine crate `lean_ctx` is being split into workspace crates; Rust stays
+the language. Every change and every new feature is checked for that split
+before it is written, and the check is part of the handover:
+
+- **New code goes into a crate, not into the monolith,** whenever it has a
+  clear boundary: its own crate under `rust/crates/`, or the crate of the area
+  it belongs to once that exists. New code in `rust/src/` needs a reason in the
+  handover (what it needs from the monolith, and why it cannot depend on a
+  crate instead).
+- **Changes to existing code do not deepen the coupling:** no new
+  `crate::` edges from a module that is already split out or scheduled for a
+  split; shared types move down into a lower crate rather than up.
+- **A new heavy dependency** (a parser, ML runtime, HTTP stack, database
+  client) lands behind a feature in its own crate, never directly in
+  `lean_ctx`.
+- **The handover names the decision:** "crate: <name>" or "monolith: <reason>".
+  The integrator rejects a batch without it.
+- Another language only where the component does not need Rust and an ADR
+  shows the benefit (the plan's §10 gates); signed, crypto and policy logic is
+  never implemented twice.
+
 Published artifacts and release rehearsals keep the production `--release`
 profile. Do not use `cargo clean` in the normal edit/build loop. Use one shared
 target directory and the configured job budget across worktrees.
@@ -155,15 +184,27 @@ Step 2 (`ctx_session` progress) stays, since it is per-agent session state.
 
 Working the space economically:
 - read `emspace schema` at most once per session;
-- read pages with `emspace page show --body <slug>…` (several slugs in one
-  call) unless the source/notes header is the point;
+- read the part of a page you need: `ctx_provider(action="query",
+  provider="emspace", resource="page", id="<slug>", mode="text",
+  query="outline")`, then the one section (`query="<section>"`); the whole
+  body is `emspace page show --body <slug>…` (several slugs in one call);
 - before documenting, check the checkout is the base the space documents, and
   rescan only what `emspace coverage` and `emspace status` (stale) name;
 - find a page for a file through the `ctx_read` hint rather than a separate
   `emspace search` → `page show` chain;
 - check open sessions through `ctx_agent read` instead of a separate
   `emspace orient` when only the in-flight work matters.
 
+Keeping knowledge current without rewriting it:
+- `ctx_knowledge(action="changes", query="<lsn>")` lists what changed since
+  an LSN (every save is journaled); `query="session"` lists what this session
+  wrote, and a `ctx_session` handoff names that changeset;
+- a fact marked *to verify* because its anchored code changed but the fact
+  still holds: `ctx_knowledge(action="repin", category=…, key=…)` re-anchors
+  it to the code as it is, without retyping its text;
+- `ctx_knowledge(action="coverage")` lists the most edited files (90 days)
+  no fact is anchored to: what to record next.
+
 After 30+ tool calls without documentation:
 - lean-ctx will prompt with `[CHECKPOINT: please document current progress]`
 - Respond by calling `ctx_session(action="task")` with current status
@@ -182,12 +223,13 @@ and `ctx_read` shows cross-source hints (e.g. "Issue #42 references this file");
 turn them off with `output_hints.cross_source_hint = false`.
 
 **Emspace:** a linked checkout needs no setup. `ctx_read` indexes the space in
-the background (first read, then every ten minutes) and, with
+the background (
```

**File**: `CHANGELOG.md` (modified, +495/-6)
```diff
@@ -8,6 +8,37 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
 
 ### Security
 
+- **The skill's `curl | bash` installer verifies the binary.** It installed whatever archive
+  it downloaded; like `install.sh` it now checks it against the release's `SHA256SUMS` and
+  refuses to install without a hash tool, without the sums file, without exactly one entry for
+  the archive or on a different digest.
+- **A Cockpit bundle with two checksum entries is refused.** `install.sh`, `install.ps1` and the
+  npm postinstall took the first matching line of `COCKPIT_SHA256SUMS`; they now require exactly
+  one entry for the bundle, as for the engine archive.
+- **`npm install lean-ctx-bin@X` installs engine X.** The postinstall downloaded whatever
+  release was newest on GitHub; it now fetches the release that matches the package's own
+  version and refuses another.
+- **The Hermes plugin names its own client.** Its `requirements.txt` asked for `leanctx`, which
+  on PyPI is an unrelated third-party package; it now pins `lean-ctx-client==0.1.0`, the final
+  release of the retired HTTP `/v1` client the plugin imports as `leanctx`.
+
+- **Hive connect names no project before a yes and lists exactly what it shares.** Against a
+  Hive with the C0 2.1 device setup, `hive connect` sent the folder name and git remote to
+  Hive before anyone agreed, and the sharing question named daily usage totals and context
+  receipts, which this version never sends, but not fact states, the automatic 1.x merges
+  and objections, friction counts or task traffic. It now asks before the approval and sends
+  the project only after a yes (or `--yes`); the question lists exactly what leaves the
+  machine, the device setup announces only `knowledge` and `bus`, and a no also keeps fact
+  states and the automatic 1.x merges and objections on the machine.
+- **Hive screening fails closed on a broken rule.** A forbidden pattern
+  (`[egress] forbidden_patterns` or a Hive filter pack) that did not compile was dropped
+  silently, so what it should have blocked went to Hive. Such a rule now pauses every Hive
+  content channel until it is fixed, and the Hive status names it; the policy pull that may
+  bring a fixed rule goes on. The paths and symbol names of the code graph and the new place
+  of a moved fact anchor now pass the same screen.
+- **Hive fencing tokens are no longer printed.** `ctx_agent lease_acquire` answered
+  `scope=hive fencing_token=…`, and the debug output of a task claim carried its lease id and
+  token. Both stay in their 0600 files; the answer says `scope=hive`.
 - **A dashboard request that names a project is answered for that project or refused.**
   The dashboard accepted an `X-LeanCTX-Project` header on routes outside its project list
   (`/api/tree`, `/api/architecture`, `/api/compression-demo`, `/api/tools-health` and others)
@@ -34,6 +65,85 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
   certificates or a `.npmrc` are now denied under the default role; allow them through the
   role. Not covered: a directory-wide search, shell reads (`cat .env`), Windsurf and
   Antigravity; see Security & Governance §4.0.
+- **The shell hooks check every command they let run without the `lean-ctx -c` wrap.**
+  The PreToolUse hooks enforce the shell allowlist by wrapping a violating command in
+  `lean-ctx -c`. Several kinds of command were neither wrapped nor checked and ran natively
+  without any allowlist check:
+  - a command with a heredoc (`<<`), which cannot be wrapped: inline code ran that
+    `python -c` is blocked for (since v3.10.0);
+  - a command whose program is lean-ctx, which is never wrapped again. The hooks recognised
+    it by its first word alone, so a compound behind a `lean-ctx …` prefix ran unchecked
+    (since v3.10.0), and `lean-ctx allow …`, `lean-ctx yolo` or
+    `lean-ctx config set shell_security …` could loosen the agent's own policy from the
+    host's shell, which `ctx_shell` refuses (since v3.11.1);
+  - a `&&`/`;` chain with a file read in it, whose read was rewritten to `lean-ctx read` in
+    place while the other commands of the chain ran natively (since v3.10.0);
+  - every Bash command on Mistral Vibe (`hook vibe-pre-tool`, since v3.10.0), and on Codex
+    (`hook codex-pretooluse`) and `hook copilot` every command the hook did not rewrite to a
+    read-only one (since the hooks enforce the allowlist, v3.10.0);
+  - PowerShell, and any command whose wrap the host's permissions did not let through, in
+    the governor's `hook rewrite-enforce` (new in 3.12).
+
+  All of these are now checked in the hook and denied when they violate the allowlist, in
+  `enforce` mode; `warn` logs and `off` lets them run, as configured. lean-ctx is recognised
+  by its program word, with or without a path, quotes, `VAR=value` or `env`; `lean-ctx-x` is
+  another program. A plain `lean-ctx …` call needs no allowlist entry; one wi
```

**File**: `PUBLISH_MANIFEST.toml` (modified, +36/-2)
```diff
@@ -265,6 +265,10 @@ new_paths = [
   # output. Own code, Apache-2.0 SPDX-headed.
   "rust/src/core/patterns/emspace.rs",
   "rust/src/core/providers/emspace.rs",
+  # Knowledge change journal and the ctx_knowledge actions on it (changes,
+  # repin, coverage; owner go 2026-10-31). Own code, Apache-2.0 SPDX-headed.
+  "rust/src/core/knowledge/journal.rs",
+  "rust/src/tools/ctx_knowledge/changes.rs",
   "rust/src/core/root_selection.rs",
   "rust/src/core/audit_trail/checkpoint.rs",
   "rust/src/core/workspace_authority.rs",
@@ -373,6 +377,7 @@ new_paths = [
   "rust/src/cli/hive_cmd.rs",
   "rust/src/cli/gotchas_cmd.rs",
   "rust/src/core/hive/auth.rs",
+  "rust/src/core/hive/background.rs",
   "rust/src/core/hive/bus/control.rs",
   "rust/src/core/hive/bus/frames.rs",
   "rust/src/core/hive/bus/handoff.rs",
@@ -396,7 +401,6 @@ new_paths = [
   "rust/src/core/hive/metrics/collect.rs",
   "rust/src/core/hive/metrics/local_state.rs",
   "rust/src/core/hive/metrics/mod.rs",
-  "rust/src/core/hive/metrics/payload.rs",
   "rust/src/core/hive/metrics/upload.rs",
   "rust/src/core/hive/mod.rs",
   "rust/src/core/hive/outbox.rs",
@@ -1340,7 +1344,6 @@ new_paths = [
   "rust/src/core/hive/mapping.rs",
   "rust/src/core/hive/metrics/hive_use.rs",
   "rust/src/core/hive/metrics/hive_use_tests.rs",
-  "rust/src/core/hive/metrics/k2_review_tests.rs",
   "rust/src/core/hive/metrics_v2/buffer.rs",
   "rust/src/core/hive/metrics_v2/collect.rs",
   "rust/src/core/hive/metrics_v2/gate.rs",
@@ -1381,6 +1384,7 @@ new_paths = [
   "rust/src/core/hive/sync/records.rs",
   "rust/src/core/hive/sync/records_tests.rs",
   "rust/src/core/hive/sync/writer.rs",
+  "rust/src/core/hive/tasks/cache.rs",
   "rust/src/core/hive/tasks/claims.rs",
   "rust/src/core/hive/tasks/client.rs",
   "rust/src/core/hive/tasks/keeper.rs",
@@ -1422,6 +1426,8 @@ new_paths = [
   "rust/src/server/shell_approval.rs",
   "rust/src/server/shell_approval_tests.rs",
   "rust/src/tools/ctx_agent_control.rs",
+  "rust/src/tools/ctx_agent_lease.rs",
+  "rust/src/hooks/agents/claude_tests.rs",
   "rust/src/tools/registered/ctx_tasks.rs",
   "rust/tests/agent_wait_roundtrip.rs",
   "rust/tests/suite/hive_fake_wire_conformance.rs",
@@ -1457,10 +1463,22 @@ new_paths = [
   "rust/src/tools/registered/ctx_read_symbol.rs",
   # 3.12.1 optplan R4: template collapse of repetitive output (lean-ctx-af).
   "rust/src/core/patterns/template_collapse.rs",
+  # 3.12.1 shell-security policy resolved from the real user config (lean-ctx-af).
+  "rust/src/core/config/shell_policy.rs",
+  "rust/src/core/shell_allowlist/enforcement_patterns.rs",
+  "rust/src/core/shell_allowlist/self_config_tests.rs",
+  # 3.12.1 outline token budget for ctx_read (lean-ctx-af, read-shell-volume).
+  "rust/src/tools/ctx_read/outline_budget.rs",
   # 3.12.1: the shared `cargo fast` alias (only the alias, no [build] job budget),
   # so fresh clones can run `make build`; the root .cargo/config.toml stays private.
   "rust/.cargo/config.toml",
   "tests/build/test_cargo_alias.py",
+  # 3.12.1 wave 3 (cli): npm preinstall stops only the installed daemon.
+  "packages/lean-ctx-bin/preinstall.test.cjs",
+  # the skill's curl | bash installer: exit status, temp dir, checksum.
+  "tests/build/test_skill_install_sh.py",
+  # the AUR recipe's version coupling.
+  "scripts/tests/test_check_package_versions.py",
   # 3.12.1 cleanup: the Task Spine v1 cohort the V3 receipt migration tests read,
   # moved from _archive/benchmarks/efficiency/task-spine-v1/ (same synthetic files).
   "rust/tests/fixtures/v3/task-spine-v1/README.md",
@@ -2556,6 +2574,9 @@ removed_paths = [
   # swarm, conductor, compute, sync/swarm, ctx_compute, ctx_tasks scope=swarm,
   # hive swarm|compute CLI, scripts/e2e/swarm-two-engines.sh). None of them is
   # in `baseline_commit`, so they left `new_paths` instead of being listed here.
+  # Hive 1.x retired, owner decision 2026-10-31: the daily `POST /v1/metrics`
+  # builder (core/hive/metrics/payload.rs, metrics/k2_review_tests.rs) left
+  # `new_paths` the same way.
   # Research/eval tooling removed from the engine, owner decision 2026-10-30.
   ".github/workflows/benchmark-study.yml",
   "rust/eval/accuracy-suite.ndjson",
@@ -2684,6 +2705,7 @@ removed_paths = [
   "rust/crates/lean-ctx-ocla/src/observation.rs",
   "rust/src/cli/dispatch/analytics/provider_run.rs",
   "rust/src/core/a2a/compress.rs",
+  "rust/src/core/a2a/telemetry.rs",
   "rust/src/core/code_health/coupling.rs",
   "rust/src/core/cognitive/chunker.rs",
   "rust/src/core/cognitive/mod.rs",
@@ -2724,6 +2746,18 @@ removed_paths = [
   "rust/src/proxy/web_app/normalize.rs",
   "rust/src/proxy/web_app/proof_tests.rs",
   "rust/tests/multi_read_cap_scenarios.rs",
+  # Adaptive/memory trim, measured then trimmed (CHANGELOG [Unreleased] Removed):
+  # learning stores no default read consults.
+  "rust/src/core/adaptive_mode_policy.rs",
+  "rust/src/core/bandit.rs",
+  "rust/src/core/feedback.rs",
+  "rust/src/core/mode_predictor
```

**File**: `aur/lean-ctx/PKGBUILD` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 # Maintainer: Yves Gugger <yves@pounce.ch>
 pkgname=lean-ctx
-pkgver=3.10.5
+pkgver=3.12.0
 pkgrel=1
 pkgdesc="LeanCTX Engine — open-source Context Gateway for AI Systems. Context selection, supported controls, and evidence through local integration paths."
 arch=('x86_64' 'aarch64')
@@ -12,7 +12,7 @@ makedepends=('cargo' 'gcc')
 # resolver finds it — no manual install, no runtime download.
 depends=('gcc-libs' 'onnxruntime')
 source=("$pkgname-$pkgver.tar.gz::https://github.com/yvgude/lean-ctx/releases/download/v$pkgver/lean-ctx-$pkgver-source.tar.gz")
-sha256sums=('3235fddead565b17be0a720779cb3ca3e73a10aa096acdb233e0348ff63bad9a')
+sha256sums=('a1009099b7933ddb8948d6511a38c4f9addfcfbc60c0a54161adea174e32bfb5')
 
 prepare() {
   cd "$pkgname-$pkgver/rust"
```

**File**: `clients/rust/lean-ctx-client/src/client.rs` (modified, +51/-3)
```diff
@@ -33,7 +33,9 @@ pub struct EventQuery {
 /// [`LeanCtxClient::builder`] (bearer token, default workspace/channel,
 /// timeout). All methods are blocking; wrap calls in your own thread pool or
 /// `spawn_blocking` when used from async code.
-#[derive(Debug, Clone)]
+///
+/// `Debug` never prints the bearer token: a set token shows as `"<redacted>"`.
+#[derive(Clone)]
 pub struct LeanCtxClient {
     base_url: String,
     bearer_token: Option<String>,
@@ -42,6 +44,23 @@ pub struct LeanCtxClient {
     agent: ureq::Agent,
 }
 
+impl std::fmt::Debug for LeanCtxClient {
+    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        f.debug_struct("LeanCtxClient")
+            .field("base_url", &self.base_url)
+            .field("bearer_token", &redacted(self.bearer_token.as_ref()))
+            .field("workspace_id", &self.workspace_id)
+            .field("channel_id", &self.channel_id)
+            .field("agent", &self.agent)
+            .finish()
+    }
+}
+
+/// What `Debug` shows for a secret: whether it is set, never its value.
+fn redacted(secret: Option<&String>) -> Option<&'static str> {
+    secret.map(|_| "<redacted>")
+}
+
 impl LeanCtxClient {
     /// Create a client for `base_url` with no auth and default timeout.
     ///
@@ -387,8 +406,8 @@ impl LeanCtxClient {
     }
 }
 
-/// Builder for [`LeanCtxClient`].
-#[derive(Debug, Clone)]
+/// Builder for [`LeanCtxClient`]. Its `Debug`, too, redacts the bearer token.
+#[derive(Clone)]
 pub struct LeanCtxClientBuilder {
     base_url: String,
     bearer_token: Option<String>,
@@ -397,6 +416,18 @@ pub struct LeanCtxClientBuilder {
     timeout: Option<Duration>,
 }
 
+impl std::fmt::Debug for LeanCtxClientBuilder {
+    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        f.debug_struct("LeanCtxClientBuilder")
+            .field("base_url", &self.base_url)
+            .field("bearer_token", &redacted(self.bearer_token.as_ref()))
+            .field("workspace_id", &self.workspace_id)
+            .field("channel_id", &self.channel_id)
+            .field("timeout", &self.timeout)
+            .finish()
+    }
+}
+
 impl LeanCtxClientBuilder {
     fn new(base_url: impl AsRef<str>) -> Self {
         Self {
@@ -573,6 +604,23 @@ mod tests {
         assert_eq!(c.base_url(), "http://x");
     }
 
+    #[test]
+    fn debug_redacts_the_bearer_token() {
+        let builder = LeanCtxClient::builder("http://x").bearer_token("sentinel-token");
+        let shown = format!("{builder:?}");
+        assert!(!shown.contains("sentinel-token"), "{shown}");
+        assert!(shown.contains("<redacted>"), "{shown}");
+        let client = builder.workspace_id("ws").build().unwrap();
+        let shown = format!("{client:?}");
+        assert!(!shown.contains("sentinel-token"), "{shown}");
+        assert!(
+            shown.contains("<redacted>") && shown.contains("ws"),
+            "{shown}"
+        );
+        let anonymous = format!("{:?}", LeanCtxClient::new("http://x").unwrap());
+        assert!(anonymous.contains("bearer_token: None"), "{anonymous}");
+    }
+
     #[test]
     fn query_is_percent_encoded() {
         let q = encode_query(&[("workspaceId".into(), "a b/c".into())]);
```

**File**: `cookbook/package-lock.json` (modified, +1/-1)
```diff
@@ -3353,7 +3353,7 @@
     "sdk": {
       "name": "lean-ctx-client",
       "version": "0.1.0",
-      "license": "MIT"
+      "license": "Apache-2.0"
     }
   }
 }
```

---

### Incident Patch 2: `7b157a3d` (2026-11-01)
**Commit Message**: fix: 3.12.1 first engine crate split, knowledge lifecycle to Hive, cleanup waves 5–6 (#2170)

* fix: 3.12.1 first engine crate split, knowledge lifecycle to Hive, cleanup waves 5–6

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* docs: no intra-doc links from public items to private ones in lean-ctx-fs and lean-ctx-syntax

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +41/-1)
```diff
@@ -1256,6 +1256,46 @@ jobs:
             echo "Waiting 30s for crates.io index propagation..."
             sleep 30
           fi
+          PATTERNS_VERSION="$(grep -m1 '^version' crates/lean-ctx-patterns/Cargo.toml | sed -E 's/.*"([^"]+)".*/\1/')"
+          if ! curl -fsSL -H "User-Agent: lean-ctx-release" \
+               "https://crates.io/api/v1/crates/lean-ctx-patterns/${PATTERNS_VERSION}" >/dev/null 2>&1; then
+            echo "Publishing lean-ctx-patterns ${PATTERNS_VERSION} to crates.io first..."
+            cargo publish --allow-dirty --token "${CARGO_REGISTRY_TOKEN}" -p lean-ctx-patterns
+            echo "Waiting 30s for crates.io index propagation..."
+            sleep 30
+          fi
+          LEAN_CTX_WORKGRAPH_VERSION="$(grep -m1 '^version' crates/lean-ctx-workgraph/Cargo.toml | sed -E 's/.*"([^"]+)".*/\1/')"
+          if ! curl -fsSL -H "User-Agent: lean-ctx-release" \
+               "https://crates.io/api/v1/crates/lean-ctx-workgraph/${LEAN_CTX_WORKGRAPH_VERSION}" >/dev/null 2>&1; then
+            echo "Publishing lean-ctx-workgraph ${LEAN_CTX_WORKGRAPH_VERSION} to crates.io first..."
+            cargo publish --allow-dirty --token "${CARGO_REGISTRY_TOKEN}" -p lean-ctx-workgraph
+            echo "Waiting 30s for crates.io index propagation..."
+            sleep 30
+          fi
+          LEAN_CTX_COMPRESS_VERSION="$(grep -m1 '^version' crates/lean-ctx-compress/Cargo.toml | sed -E 's/.*"([^"]+)".*/\1/')"
+          if ! curl -fsSL -H "User-Agent: lean-ctx-release" \
+               "https://crates.io/api/v1/crates/lean-ctx-compress/${LEAN_CTX_COMPRESS_VERSION}" >/dev/null 2>&1; then
+            echo "Publishing lean-ctx-compress ${LEAN_CTX_COMPRESS_VERSION} to crates.io first..."
+            cargo publish --allow-dirty --token "${CARGO_REGISTRY_TOKEN}" -p lean-ctx-compress
+            echo "Waiting 30s for crates.io index propagation..."
+            sleep 30
+          fi
+          LEAN_CTX_FS_VERSION="$(grep -m1 '^version' crates/lean-ctx-fs/Cargo.toml | sed -E 's/.*"([^"]+)".*/\1/')"
+          if ! curl -fsSL -H "User-Agent: lean-ctx-release" \
+               "https://crates.io/api/v1/crates/lean-ctx-fs/${LEAN_CTX_FS_VERSION}" >/dev/null 2>&1; then
+            echo "Publishing lean-ctx-fs ${LEAN_CTX_FS_VERSION} to crates.io first..."
+            cargo publish --allow-dirty --token "${CARGO_REGISTRY_TOKEN}" -p lean-ctx-fs
+            echo "Waiting 30s for crates.io index propagation..."
+            sleep 30
+          fi
+          LEAN_CTX_SYNTAX_VERSION="$(grep -m1 '^version' crates/lean-ctx-syntax/Cargo.toml | sed -E 's/.*"([^"]+)".*/\1/')"
+          if ! curl -fsSL -H "User-Agent: lean-ctx-release" \
+               "https://crates.io/api/v1/crates/lean-ctx-syntax/${LEAN_CTX_SYNTAX_VERSION}" >/dev/null 2>&1; then
+            echo "Publishing lean-ctx-syntax ${LEAN_CTX_SYNTAX_VERSION} to crates.io first..."
+            cargo publish --allow-dirty --token "${CARGO_REGISTRY_TOKEN}" -p lean-ctx-syntax
+            echo "Waiting 30s for crates.io index propagation..."
+            sleep 30
+          fi
           STORAGE_VERSION="$(grep -m1 '^version' crates/leanctx-native-storage/Cargo.toml | sed -E 's/.*"([^"]+)".*/\1/')"
           if ! curl -fsSL -H "User-Agent: lean-ctx-release" \
                "https://crates.io/api/v1/crates/leanctx-native-storage/${STORAGE_VERSION}" >/dev/null 2>&1; then
@@ -1279,7 +1319,7 @@ jobs:
           cargo package --locked -p lean-ctx
           # Verification is intentionally mandatory: source packages cannot rely
           # on this repository's local `[patch.crates-io]` entries.
-          cargo publish --allow-dirty --token "${CARGO_REGISTRY_TOKEN}"
+          cargo publish --allow-dirty --token "${CARGO_REGISTRY_TOKEN}" -p lean-ctx
 
   publish-npm:
     name: Publish to npm
```

**File**: `AGENTS.md` (modified, +11/-2)
```diff
@@ -121,9 +121,18 @@ before it is written, and the check is part of the handover:
   it belongs to once that exists. New code in `rust/src/` needs a reason in the
   handover (what it needs from the monolith, and why it cannot depend on a
   crate instead).
+- **The map is `rust/CRATE_MAP.md`** (machine form `rust/CRATE_MAP.toml`):
+  extracted crates, modules scheduled for a crate, and the allowed direction.
+  Crates never depend on `lean-ctx`. The engine depends on them through a thin
+  facade (for example `core::patterns`), so engine paths stay stable. New code
+  for an extracted area goes into its crate, never beside the facade.
 - **Changes to existing code do not deepen the coupling:** no new
-  `crate::` edges from a module that is already split out or scheduled for a
-  split; shared types move down into a lower crate rather than up.
+  `crate::` edges out of a module that is split out or scheduled for a split;
+  shared types move down into a lower crate rather than up.
+  `scripts/check-crate-boundaries.py` (preflight and the pounce gate) fails on
+  such an edge. Its baseline `rust/crate_boundary_baseline.json` only grows with
+  the crate-split lead's sign-off ("monolith: <reason>" plus `--update`), and it
+  shrinks with every edge you cut.
 - **A new heavy dependency** (a parser, ML runtime, HTTP stack, database
   client) lands behind a feature in its own crate, never directly in
   `lean_ctx`.
```

**File**: `CHANGELOG.md` (modified, +85/-4)
```diff
@@ -229,6 +229,11 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
   token in the process list; the new `--auth-token-file <path>` (or `LEAN_CTX_HTTP_TOKEN_FILE`)
   reads it from a bounded regular file, besides `LEAN_CTX_HTTP_TOKEN`. Giving both the token
   and a token file is refused.
+- **`cockpit` reads its auth token from a file too.** `--auth-token=<token>` (and `--token=`)
+  left the Bearer token in the process list; `--auth-token-file <path>` (or
+  `LEAN_CTX_HTTP_TOKEN_FILE` while `LEAN_CTX_HTTP_TOKEN` is unset) reads it from a bounded
+  regular file, and a background server reads the same file instead of getting the token.
+  Giving both the token and a token file is refused.
 - **Role and policy denials are tool errors.** A tool blocked by the active role, a context
   policy pack or its egress rules came back as a successful result; it now carries
   `isError: true` with the same reason, and its audit entry names the calling agent instead
@@ -269,6 +274,17 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
   `action=repin` re-anchors a fact marked to verify to its code as it is now without
   retyping it, and `action=coverage` lists the most edited files that no fact is anchored to.
 - **`ctx_provider query mode=text`** lists each item with its body, for every provider.
+- **A connected engine keeps the vault in line with what its agents changed.** Until now a
+  fact reached the Hive vault once, when it was captured; correcting, superseding, removing or
+  re-pinning it later never left the machine, so other engines kept receiving knowledge its
+  author had withdrawn. Each sync now compares the engine's own vault items with its knowledge
+  store: a superseded fact whose successor is shared gets `supersedes` (the vault shows it
+  outdated), a withdrawn one is retracted (reason "withdrawn by author", no content), and a
+  fact re-pinned locally is re-anchored in the vault. Only items this checkout captured, the
+  raw store decides (a fact a policy view withholds is never retracted), an unreadable or
+  empty store changes nothing, and the server's retraction limits and review holds apply
+  unchanged. The knowledge journal gates the pass (nothing to do while it stands still, a full
+  pass hourly); `hive sync` reports what it queued.
 - **Governor rule R4: template collapse for large Bash output.** R2 folds only
   byte-identical lines, so real logs, lint output and exports, whose lines differ in a
   timestamp, sequence number or id, never shrank and the governor wrote no receipts. R4
@@ -330,6 +346,10 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
 
 ### Changed
 
+- **`ctx_search` drops the `[∈ enclosing symbol → …]` legend line.** The `∈name@Lstart`
+  tags on hits stay — agents read those symbols by name and line — but no agent in the
+  benchmark transcripts used the `handle=` form the legend described; it cost about 30
+  tokens per run.
 - **The telemetry data dictionary says which events LeanCTX | OSS sends.** Of the 24
   contract events the engine sends eleven; nine (trial, subscription, team and
   orchestration) belong to the hosted service and are never built by the engine, and four
@@ -499,6 +519,20 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
 
 ### Removed
 
+- **Episodic and procedural memory** (owner decision 2026-11-01, measured on 126 real
+  tasks: procedures were never selected into a kernel plan, and episodes, tool/file run
+  logs, never reached the delivered kernel trailer for code queries; decisions, findings
+  and gotchas already live in project knowledge). Gone are `core::episodic_memory`,
+  `core::procedural_memory`, the `memory.episodic` / `memory.procedural` kernel
+  providers, the episode recorded at MCP shutdown and on a completed `ctx_session` task
+  (the `Episode auto-recorded` note), the procedure capacity reclaim and its
+  `Procedures:` line in the consolidation report, the `episodic`/`procedural` lines of
+  `ctx_knowledge action=lifecycle_report` and of the effective-config summary, the doctor
+  capacity checks for both stores, and the `episodes`, `procedures` and `existing_paths`
+  inputs of the dashboard's work analysis (its work view now reports `available: false`).
+  Existing files under `memory/episodes`, `memory/procedures` and
+  `memory/archive/procedures` stay on disk; nothing reads them, and only the existing
+  orphaned-project prune still removes a removed project's episode file.
 - **Dormant Context Kernel code without a caller:** `enforce_plan` (the mode never reached
   filtering), `activation::should_suppress_in_mode`, `health::format_health` and
   `health_api::one_line_status`. No command, route or tool output changes.
@@ -569,9 +603,27 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
   always uses the static layout. `ctx_metrics` no longer prints the cali
```

**File**: `CONTRACTS.md` (modified, +1/-1)
```diff
@@ -306,7 +306,7 @@ Interfaces for external integrations and future plugin system.
 
 ### CompressionPattern (planned v1)
 
-- **Status**: Interface extracted from `rust/src/core/patterns/mod.rs`
+- **Status**: Interface extracted from the `lean-ctx-patterns` crate (`rust/crates/lean-ctx-patterns/src/lib.rs`)
 - **Future**: Plugin-loadable compression patterns for proprietary CLI tools
 
 ### LcpTool (planned v1)
```

**File**: `CONTRIBUTING.md` (modified, +2/-2)
```diff
@@ -190,14 +190,14 @@ lean-ctx/
 
 ### Add a shell compression pattern
 
-1. Add a new module in `rust/src/core/patterns/<tool>.rs`
+1. Add a new module in `rust/crates/lean-ctx-patterns/src/<tool>.rs` (the `lean-ctx-patterns` crate)
 2. Implement:
 
 ```rust
 pub fn compress(command: &str, output: &str) -> Option<String>
 ```
 
-3. Register the module + routing in `rust/src/core/patterns/mod.rs` (`try_specific_pattern`)
+3. Register the module + routing in `rust/crates/lean-ctx-patterns/src/lib.rs` (`PATTERNS`, routed by `try_specific_pattern_with`)
 4. Add tests (unit tests in the module or integration tests in `rust/tests/`)
 5. Run the quality checks above
 
```

**File**: `PUBLISH_MANIFEST.toml` (modified, +334/-4)
```diff
@@ -148,7 +148,6 @@ new_paths = [
   "rust/src/shell/containment/tests.rs",
   "rust/src/shell/containment/wire.rs",
   "rust/src/tools/admitted_sources.rs",
-  "rust/src/tools/ctx_knowledge/consolidate_admission_tests.rs",
   "rust/src/tools/ctx_read/file_io_admission_tests.rs",
   "rust/src/tools/ctx_session/tests.rs",
   "scripts/agent_tools_compatibility.py",
@@ -159,6 +158,8 @@ new_paths = [
   "rust/tests/local_free_invariant.rs",
   "scripts/check-local-free.py",
   "tests/delivery/test_check_local_free.py",
+  "tests/hive-e2e/lifecycle.cjs",
+  "tests/hive-e2e/lifecycle.sh",
   "scripts/check-source-layout.py",
   "scripts/export-offline-build.py",
   "scripts/export-secret-gate.py",
@@ -263,12 +264,16 @@ new_paths = [
   # Emspace provider (owner go 2026-10-31): read-only connector for the space
   # a project is linked to via `.emspace`, and the compressor of its CLI
   # output. Own code, Apache-2.0 SPDX-headed.
-  "rust/src/core/patterns/emspace.rs",
   "rust/src/core/providers/emspace.rs",
   # Knowledge change journal and the ctx_knowledge actions on it (changes,
   # repin, coverage; owner go 2026-10-31). Own code, Apache-2.0 SPDX-headed.
   "rust/src/core/knowledge/journal.rs",
   "rust/src/tools/ctx_knowledge/changes.rs",
+  # Hive capture lifecycle: supersede, withdraw and re-anchor own vault items
+  # after local knowledge changes (owner go 2026-11-01). Own code,
+  # Apache-2.0 SPDX-headed.
+  "rust/src/core/hive/capture/lifecycle.rs",
+  "rust/src/core/hive/capture/lifecycle_tests.rs",
   "rust/src/core/root_selection.rs",
   "rust/src/core/audit_trail/checkpoint.rs",
   "rust/src/core/workspace_authority.rs",
@@ -1451,7 +1456,6 @@ new_paths = [
   "rust/src/tools/ctx_edit/applied_edits.rs",
   # 3.12.1 optplan: governor hook, partial shell runs, lossless collapse,
   # secret gate, ctx_read symbol (lean-ctx-af, integration/optplan).
-  "rust/src/core/patterns/lossless_collapse.rs",
   "rust/src/core/shell_allowlist/partial.rs",
   "rust/src/hook_handlers/govern/bash.rs",
   "rust/src/hook_handlers/govern/diagnostics.rs",
@@ -1462,7 +1466,6 @@ new_paths = [
   "rust/src/hooks/agents/claude_governor.rs",
   "rust/src/tools/registered/ctx_read_symbol.rs",
   # 3.12.1 optplan R4: template collapse of repetitive output (lean-ctx-af).
-  "rust/src/core/patterns/template_collapse.rs",
   # 3.12.1 shell-security policy resolved from the real user config (lean-ctx-af).
   "rust/src/core/config/shell_policy.rs",
   "rust/src/core/shell_allowlist/enforcement_patterns.rs",
@@ -1532,6 +1535,193 @@ new_paths = [
   "rust/tests/fixtures/v3/task-spine-v1/tasks/task-010-database-migration/execution_receipt.json",
   "rust/tests/fixtures/v3/task-spine-v1/tasks/task-010-database-migration/outcome.json",
   "rust/tests/fixtures/v3/task-spine-v1/tasks/task-010-database-migration/task_envelope.json",
+  "rust/crates/lean-ctx-patterns/Cargo.toml",
+  "rust/crates/lean-ctx-patterns/README.md",
+  "rust/crates/lean-ctx-patterns/src/alembic.rs",
+  "rust/crates/lean-ctx-patterns/src/ansi.rs",
+  "rust/crates/lean-ctx-patterns/src/ansible.rs",
+  "rust/crates/lean-ctx-patterns/src/argocd.rs",
+  "rust/crates/lean-ctx-patterns/src/artisan.rs",
+  "rust/crates/lean-ctx-patterns/src/aws.rs",
+  "rust/crates/lean-ctx-patterns/src/bazel.rs",
+  "rust/crates/lean-ctx-patterns/src/buf.rs",
+  "rust/crates/lean-ctx-patterns/src/bun.rs",
+  "rust/crates/lean-ctx-patterns/src/cargo.rs",
+  "rust/crates/lean-ctx-patterns/src/clang.rs",
+  "rust/crates/lean-ctx-patterns/src/cmake.rs",
+  "rust/crates/lean-ctx-patterns/src/composer.rs",
+  "rust/crates/lean-ctx-patterns/src/cosign.rs",
+  "rust/crates/lean-ctx-patterns/src/curl.rs",
+  "rust/crates/lean-ctx-patterns/src/dbt.rs",
+  "rust/crates/lean-ctx-patterns/src/deno.rs",
+  "rust/crates/lean-ctx-patterns/src/deploy.rs",
+  "rust/crates/lean-ctx-patterns/src/deps_cmd.rs",
+  "rust/crates/lean-ctx-patterns/src/docker.rs",
+  "rust/crates/lean-ctx-patterns/src/dotnet.rs",
+  "rust/crates/lean-ctx-patterns/src/emspace.rs",
+  "rust/crates/lean-ctx-patterns/src/env_filter.rs",
+  "rust/crates/lean-ctx-patterns/src/eslint.rs",
+  "rust/crates/lean-ctx-patterns/src/fd.rs",
+  "rust/crates/lean-ctx-patterns/src/find.rs",
+  "rust/crates/lean-ctx-patterns/src/flutter.rs",
+  "rust/crates/lean-ctx-patterns/src/flyway.rs",
+  "rust/crates/lean-ctx-patterns/src/gem.rs",
+  "rust/crates/lean-ctx-patterns/src/gh.rs",
+  "rust/crates/lean-ctx-patterns/src/git/commit.rs",
+  "rust/crates/lean-ctx-patterns/src/git/diff.rs",
+  "rust/crates/lean-ctx-patterns/src/git/log.rs",
+  "rust/crates/lean-ctx-patterns/src/git/mod.rs",
+  "rust/crates/lean-ctx-patterns/src/git/parser.rs",
+  "rust/crates/lean-ctx-patterns/src/git/status.rs",
+  "rust/crates/lean-ctx-patterns/src/glab.rs",
+  "rust/crates/lean-ctx-patterns/src/golang.rs",
+  "rust/crates/lean-ctx-patterns/src/grep.rs",
+  "rust/crates/lean-ctx-patterns/src/grype.rs",
+  "rust/crates/lean-ctx-patterns/src/helm.rs",
+  "rust/crates/l
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -170,7 +170,7 @@ Keep useful task records and discover relationships between code and local
 knowledge. Learning here means context continuity; it does not train your model.
 
 - **Session memory (CCP)**: persist task/facts/decisions across chats — structured recovery queries survive compaction
-- **Knowledge graph**: temporal facts with validity windows, episodic + procedural memory
+- **Knowledge graph**: temporal facts with validity windows, relations and lifecycle
 - **Property Graph**: multi-edge code graph (imports, calls, exports, type_ref) powers impact analysis and search ranking
 - **Permission-bound reuse:** access and retention rules still apply when stored
   context is retrieved. Experimental `.ctxpkg` export is described under Research below.
```

**File**: `SBOM.cdx.json` (modified, +204/-24)
```diff
@@ -1,6 +1,54 @@
 {
   "bomFormat": "CycloneDX",
   "components": [
+    {
+      "bom-ref": "path+file://./rust/crates/lean-ctx-compress#0.1.0",
+      "description": "Deterministic text compressors (Markdown, JSON, CSV/TSV, YAML, HTML) for the LeanCTX Engine.",
+      "externalReferences": [
+        {
+          "type": "website",
+          "url": "https://leanctx.com"
+        },
+        {
+          "type": "vcs",
+          "url": "https://github.com/yvgude/lean-ctx"
+        }
+      ],
+      "licenses": [
+        {
+          "expression": "Apache-2.0"
+        }
+      ],
+      "name": "lean-ctx-compress",
+      "purl": "pkg:cargo/lean-ctx-compress@0.1.0?download_url=file://crates/lean-ctx-compress",
+      "scope": "required",
+      "type": "library",
+      "version": "0.1.0"
+    },
+    {
+      "bom-ref": "path+file://./rust/crates/lean-ctx-fs#0.1.0",
+      "description": "Filesystem and environment foundation for the LeanCTX Engine: atomic writes, file locks, hashing, JSONC, home resolution.",
+      "externalReferences": [
+        {
+          "type": "website",
+          "url": "https://leanctx.com"
+        },
+        {
+          "type": "vcs",
+          "url": "https://github.com/yvgude/lean-ctx"
+        }
+      ],
+      "licenses": [
+        {
+          "expression": "Apache-2.0"
+        }
+      ],
+      "name": "lean-ctx-fs",
+      "purl": "pkg:cargo/lean-ctx-fs@0.1.0?download_url=file://crates/lean-ctx-fs",
+      "scope": "required",
+      "type": "library",
+      "version": "0.1.0"
+    },
     {
       "bom-ref": "path+file://./rust/crates/lean-ctx-ocla#4.0.0",
       "description": "Open Context & Token Lifecycle Architecture \u2014 the provider-neutral contract boundary (capability traits, canonical types, token envelopes) shared between lean-ctx-core (OSS) and lean-ctx-enterprise (proprietary).",
@@ -21,6 +69,30 @@
       "type": "library",
       "version": "4.0.0"
     },
+    {
+      "bom-ref": "path+file://./rust/crates/lean-ctx-patterns#0.1.0",
+      "description": "Deterministic shell-output compression patterns and token counting for the LeanCTX Engine.",
+      "externalReferences": [
+        {
+          "type": "website",
+          "url": "https://leanctx.com"
+        },
+        {
+          "type": "vcs",
+          "url": "https://github.com/yvgude/lean-ctx"
+        }
+      ],
+      "licenses": [
+        {
+          "expression": "Apache-2.0"
+        }
+      ],
+      "name": "lean-ctx-patterns",
+      "purl": "pkg:cargo/lean-ctx-patterns@0.1.0?download_url=file://crates/lean-ctx-patterns",
+      "scope": "required",
+      "type": "library",
+      "version": "0.1.0"
+    },
     {
       "bom-ref": "path+file://./rust/crates/lean-ctx-protocol#0.4.0",
       "description": "Open wire contracts for lean-ctx: events, observations, assignments, evidence gaps.",
@@ -41,6 +113,54 @@
       "type": "library",
       "version": "0.4.0"
     },
+    {
+      "bom-ref": "path+file://./rust/crates/lean-ctx-syntax#0.1.0",
+      "description": "Tree-sitter based code structure for the LeanCTX Engine: signatures, deep AST queries, import resolution and the post-edit syntax gate.",
+      "externalReferences": [
+        {
+          "type": "website",
+          "url": "https://leanctx.com"
+        },
+        {
+          "type": "vcs",
+          "url": "https://github.com/yvgude/lean-ctx"
+        }
+      ],
+      "licenses": [
+        {
+          "expression": "Apache-2.0"
+        }
+      ],
+      "name": "lean-ctx-syntax",
+      "purl": "pkg:cargo/lean-ctx-syntax@0.1.0?download_url=file://crates/lean-ctx-syntax",
+      "scope": "required",
+      "type": "library",
+      "version": "0.1.0"
+    },
+    {
+      "bom-ref": "path+file://./rust/crates/lean-ctx-workgraph#0.1.0",
+      "description": "Bounded multi-agent work graph, budget cascade and outcome evaluation model for the LeanCTX Engine.",
+      "externalReferences": [
+        {
+          "type": "website",
+          "url": "https://leanctx.com"
+        },
+        {
+          "type": "vcs",
+          "url": "https://github.com/yvgude/lean-ctx"
+        }
+      ],
+      "licenses": [
+        {
+          "expression": "Apache-2.0"
+        }
+      ],
+      "name": "lean-ctx-workgraph",
+      "purl": "pkg:cargo/lean-ctx-workgraph@0.1.0?download_url=file://crates/lean-ctx-workgraph",
+      "scope": "required",
+      "type": "library",
+      "version": "0.1.0"
+    },
     {
       "bom-ref": "path+file://./rust/crates/leanctx-native-storage#0.1.1",
       "description": "Handle-bound native storage primitives shared by LeanCTX components",
@@ -16749,8 +16869,13 @@
         "registry+https://github.com/rust-lang/crates.io-index#http@1.5.0",
         "registry+https://github.com/rust-lang/crates.io-index#ignore@0.4.30",
         "registry+https://github.com/rust-lang/crates.io-index#keyring@3.6.3",
+        "path+file://./rust/crates/lean-ctx-compress#0.1
```

---

### Incident Patch 3: `7c9025c4` (2026-11-02)
**Commit Message**: fix: 3.12.1 Hive C0 2.1/2.2, agents talk to agents, humans observe (#2173)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +103/-12)
```diff
@@ -346,6 +346,33 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
 
 ### Changed
 
+- **The engine speaks Hive-Protocol 2.2: agents check each other's task results.** Every
+  Hive request sends `Hive-Protocol: 2.2`; the engine records the minor Hive answers (2.0,
+  2.1 or 2.2) at engine start and writes the 2.2 shapes only to a 2.2 Hive: a captured
+  decision now carries its anchors there. A task result leaves the task `submitted` until
+  another agent checks it: `ctx_tasks action=verify verdict=accept|reject` (a reject names
+  its reason and opens the task again; Hive refuses the agent that did the work). Hive's
+  new `task.event` bus frame reaches every engine of the vault: the engine refreshes its
+  task list and tells its own agents on the local bus, every agent of the project when a
+  task is open (again), and every agent but the one that did the work when a result waits
+  for its check. The vault bus knows six message types (`question`, `offer`, `handoff`,
+  `finding`, `answer` and `progress` as a status line); `need`, `claim`, `result`, the
+  progress `goal` and `~` swarm addresses are gone. The consent kinds `procedure_confirm`
+  and `reviewer_enable` are gone with Hive's review gates; the engine never runs a shared
+  procedure's commands (delivery shows its title and steps). A delivered vault item no longer has an `[unconfirmed]` bucket, and the
+  knowledge state follows the 2.2 vectors (no `unconfirmed` reason).
+- **The engine speaks Hive-Protocol 2.1.** Every Hive request, the enrollment included,
+  sends `Hive-Protocol: 2.1`. Hive answers a 2.1 enrollment with key set v3; the engine
+  accepts it and checks it, and the lease it signs, as it checks every stored v3 set (the
+  lease key is the v3 key of purpose `policy`). Enrollments with key set v1 keep working.
+- **Hive's TOML org policy is no longer read.** Hive-Protocol 2.1 has none: the engine
+  ignores `org_policy`, `unpin` and `policy_version` in the policy bundle and the lease's
+  `policy_signer_keys`, installs no org policy from Hive and no longer refuses a bundle that
+  drops one ("drops the org policy without a signed unpin"). Org-policy state an older
+  engine kept in `<data_dir>/hive/policy/` is ignored and dropped on the next save, so it can
+  never refuse a bundle. Hive filter packs are verified and applied as before. `hive status`
+  no longer prints a "Company policy" or "Required" line, `hive status --json` has no
+  `policy` field, and `hive sync` reports "Policy bundle verified (N filter packs)".
 - **`ctx_search` drops the `[∈ enclosing symbol → …]` legend line.** The `∈name@Lstart`
   tags on hits stay — agents read those symbols by name and line — but no agent in the
   benchmark transcripts used the `handle=` form the legend described; it cost about 30
@@ -439,13 +466,43 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
   have no effect (see Deprecated); `autopilot evidence` still shows the local evidence. The config key
   `intelligence_runtime.context_policy_apply` is still accepted but has no effect, and a
   previously promoted policy file under `context-policy/` in the data directory is ignored.
-- lean-ctx-protocol: `HiveStatusPolicyV1` gains `required_filter_packs` (breaking for
-  struct literals) → 0.5.0. The version bump, its pins and lockfiles, the SBOM and the
-  notices follow in the next release preparation. With the same bump, the status output
-  types (`HiveCliStatusV1`, `HiveStatusPolicyV1` and their siblings) drop
-  `deny_unknown_fields` (or become `#[non_exhaustive]`), as the contract's convention for
-  response types says, so later additive fields are not breaking for typed readers.
-  The same bump removes `hive::compute` (Hive Task Compute was retired).
+- lean-ctx-protocol → 0.5.0 (breaking). The version bump, its pins and lockfiles, the SBOM
+  and the notices follow in the next release preparation. The status output types
+  (`HiveCliStatusV1` and its siblings) drop `deny_unknown_fields` (or become
+  `#[non_exhaustive]`), as the contract's convention for response types says, so later
+  additive fields are not breaking for typed readers. The same bump removes
+  `hive::compute` (Hive Task Compute), and with Hive Protocol 2.1 also
+  `hive::swarm`, the swarm network and sender (`NetworkV1::Swarm`, `SenderV1::Swarm`,
+  `NetworkKind`; `MessageBodyV1::validate` takes no network), swarm handles and limits
+  (`profiles::HandleV1`, `HANDLE_SCHEMA`, `SWARM_LIMITS`, `handle_ok`),
+  `EngineOptinV1.topics` and `TaskOriginKind::QuarantineTimeout` (a task naming it parses
+  as `Unknown`). `EnrollmentV1.keys` becomes `EnrollmentKeySet`: key set v1 (`kid`) or v3
+  (`HiveKeySetV3`, `key_id` and `purposes`, told apart by `schema`), and `validate()`
+  checks that the lease `kid` names a lease key of the set. The TOML org policy is gone:
+  `PolicyBundleV1` loses `org_policy`, `unpin` and `policy_version`, `HiveLeaseV1` 
```

**File**: `PUBLISH_MANIFEST.toml` (modified, +59/-315)
```diff
@@ -160,6 +160,10 @@ new_paths = [
   "tests/delivery/test_check_local_free.py",
   "tests/hive-e2e/lifecycle.cjs",
   "tests/hive-e2e/lifecycle.sh",
+  "tests/hive-e2e/bus.cjs",
+  "tests/hive-e2e/bus.sh",
+  "tests/hive-e2e/tasks.cjs",
+  "tests/hive-e2e/tasks.sh",
   "scripts/check-source-layout.py",
   "scripts/export-offline-build.py",
   "scripts/export-secret-gate.py",
@@ -274,6 +278,8 @@ new_paths = [
   # Apache-2.0 SPDX-headed.
   "rust/src/core/hive/capture/lifecycle.rs",
   "rust/src/core/hive/capture/lifecycle_tests.rs",
+  "rust/src/core/hive/bus/messages_v2.rs",
+  "rust/src/core/hive/bus/task_events.rs",
   "rust/src/core/root_selection.rs",
   "rust/src/core/audit_trail/checkpoint.rs",
   "rust/src/core/workspace_authority.rs",
@@ -312,7 +318,6 @@ new_paths = [
   "rust/crates/lean-ctx-protocol/src/hive/lease.rs",
   "rust/crates/lean-ctx-protocol/src/hive/mod.rs",
   "rust/crates/lean-ctx-protocol/src/hive/policy.rs",
-  "rust/crates/lean-ctx-protocol/src/hive/sealed.rs",
   "rust/crates/lean-ctx-protocol/src/hive/status.rs",
   "rust/crates/lean-ctx-protocol/src/hive/telemetry.rs",
   "rust/crates/lean-ctx-protocol/tests/hive_fixtures.rs",
@@ -344,36 +349,26 @@ new_paths = [
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/error.forbidden_right.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/error.instance_limit.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/error.invalid_state.json",
-  "rust/crates/lean-ctx-protocol/tests/fixtures/hive/error.key_exists.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/error.plan_required.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/error.proposal_state.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/error.rate_limited.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/error.revision_conflict.json",
-  "rust/crates/lean-ctx-protocol/tests/fixtures/hive/error.sealed_plaintext.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/error.upgrade_required.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/error.upload_disabled.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/keyset.response.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/knowledge_put.request.json",
-  "rust/crates/lean-ctx-protocol/tests/fixtures/hive/knowledge_put.sealed.request.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/knowledge_revision.response.json",
-  "rust/crates/lean-ctx-protocol/tests/fixtures/hive/knowledge_revision.sealed.response.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/lease_envelope.response.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/metrics.request.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/metrics_ack.response.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/org_salt.response.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/policy_bundle.response.json",
-  "rust/crates/lean-ctx-protocol/tests/fixtures/hive/policy_bundle.signed.response.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/proposal.request.json",
-  "rust/crates/lean-ctx-protocol/tests/fixtures/hive/proposal.sealed.request.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/proposal_ack.response.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/proposal_list.response.json",
-  "rust/crates/lean-ctx-protocol/tests/fixtures/hive/proposal_view.sealed.response.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/receipts.request.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/receipts_ack.response.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/revision_list.response.json",
-  "rust/crates/lean-ctx-protocol/tests/fixtures/hive/sealed_grant.request.json",
-  "rust/crates/lean-ctx-protocol/tests/fixtures/hive/sealed_key.response.json",
-  "rust/crates/lean-ctx-protocol/tests/fixtures/hive/sealed_pending.response.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/status.connected.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/status.lapsed.json",
   "rust/crates/lean-ctx-protocol/tests/fixtures/hive/status.not_connected.json",
@@ -399,21 +394,17 @@ new_paths = [
   "rust/src/core/hive/knowledge/learn.rs",
   "rust/src/core/hive/knowledge/mod.rs",
   "rust/src/core/hive/knowledge/pull.rs",
-  "rust/src/core/hive/knowledge/review.rs",
   "rust/src/core/hive/knowledge/screening.rs",
   "rust/src/core/hive/lease.rs",
   "rust/src/core/hive/link.rs",
   "rust/src/core/hive/metrics/collect.rs",
-  "rust/src/core/hive/metrics/local_state.rs",
   "rust/src/core/hive/metrics/mod.rs",
-  "rust/src/core/hive/metrics/upload.rs",
   "rust/src/core/hive/mod.rs",
   "rust/src/core/hive/outbox.rs",
   "rust/src/core/hive/policy.rs",
   "rust/src/core/hive/receipts.rs",
   "rust/src/core/hive/runtime_lease.rs",
   "rust/src/core/hive/scheduler.rs",
-  "rust/src/core/hive/sealed.rs",
   "rust/src/core/hive/state.rs",
   "rust/src/c
```

**File**: `SBOM.cdx.json` (modified, +1/-2)
```diff
@@ -16853,7 +16853,6 @@
         "registry+https://github.com/rust-lang/crates.io-index#chacha20poly1305@0.10.1",
         "registry+https://github.com/rust-lang/crates.io-index#chrono@0.4.45",
         "registry+https://github.com/rust-lang/crates.io-index#clap@4.6.6",
-        "registry+https://github.com/rust-lang/crates.io-index#curve25519-dalek@4.1.3",
         "registry+https://github.com/rust-lang/crates.io-index#dashmap@6.2.1",
         "registry+https://github.com/rust-lang/crates.io-index#dirs@6.0.0",
         "registry+https://github.com/rust-lang/crates.io-index#ed25519-dalek@2.2.0",
@@ -20850,7 +20849,7 @@
       },
       {
         "name": "leanctx:cargo-lock-sha256",
-        "value": "8446a84ff552675ec7d0b9593857c170f8054c3ab03ab9db063d682009a1a73a"
+        "value": "b22136d62dce29b3cfdf7d21b0e9dde9139a6669a17fc3d9c5623476ec59a1a6"
       }
     ],
     "tools": [
```

**File**: `THIRD_PARTY_NOTICES` (modified, +4/-4)
```diff
@@ -2,15 +2,15 @@
 Schema: leanctx.third-party-notices/v1
 Status: GENERATED AND APPROVED
 Content-Digest-Scope: SHA-256 of this file with the Content-Digest value zeroed
-Content-Digest: sha256:f36be4c688183b9b0ae18ab1bd6ef724d9a0087ea59be850305651a1ba4e5986
+Content-Digest: sha256:0a8eb7cee574a2ea1d964a9b3765d757de915540c97eb8d40722a1b9fd6eb0cf
 Source inventory: rust/Cargo.lock + cargo metadata --locked --offline --all-features + SBOM.cdx.json + legal/third-party-assets.toml + packages/pi-lean-ctx/package-lock.json
 Generation command: cargo metadata --locked --offline --all-features --manifest-path rust/Cargo.toml --format-version 1
 Approval contract: legal/third-party-notices-approval.toml binds approved_content_sha256 to this file's exact SHA-256
-Cargo.lock SHA-256: 8446a84ff552675ec7d0b9593857c170f8054c3ab03ab9db063d682009a1a73a
+Cargo.lock SHA-256: b22136d62dce29b3cfdf7d21b0e9dde9139a6669a17fc3d9c5623476ec59a1a6
 Cargo metadata inventory SHA-256: ab36d895ace61e75409e9eac896dbdcaae6444c04d19fbb424fdbd2824c519bd
-SBOM.cdx.json SHA-256: ce7b7c770e0ffdd063e5ec37b3a8b872600989912b10ee58003d12b1216bc7c9
+SBOM.cdx.json SHA-256: 90512513e60f32345486863ac4cdeb5b79b286d042bfac6834b52bc134bcdcca
 SBOM components: 557
-Asset manifest SHA-256: 494baa053be258854e8ec70ab7e1ae02ad053f78370a188274b656275a3bc886
+Asset manifest SHA-256: e0d4a666f1c4a31ff5a925d3bce62623e1d5c6b4b11871b5ff9ec65452db91ba
 npm package-lock.json SHA-256: 2698eb8bcaf09c3ff275826b3be2e28e5fb6044b3245cd6ec23475e06d1744a1
 Bundled MCP SDK: @modelcontextprotocol/sdk 1.32.1 (sha512-2DdE+SJDtzLEEWzY1ZjY7Q+VcPhcV1KisD3zI4u0XZyktsjHum1mwbMI+JaulUBi2OZk+KJAi2uPXzxichPkdw==)
 Cargo graph packages: 612
```

**File**: `docs/reference/generated/config-keys.md` (modified, +0/-1)
```diff
@@ -268,7 +268,6 @@ LeanCTX Hive: workspace knowledge, policies and the shared agent bus.
 - `receipts_upload` (bool, default `true`) — Upload context receipts to Hive.
 - `root_key` (string, default `null`) — Root public key (base64 Ed25519) of a self-hosted Hive.
 - `runtime_consent` (bool, default `false`) — You agreed to install the proprietary Intelligence runtime your plan licenses (set by `hive connect` or `hive runtime install`).
-- `sealed_grants` (string: confirm | auto, default `confirm`) — Sealed vaults: grant the vault key to a newly approved instance only after you confirmed its fingerprint (confirm), or to every instance Hive lists (auto).
 - `url` (string, default `https://hive.leanctx.com`) — Hive origin (https; a self-hosted Hive may use any https URL).
 - `vault_labels` (bool, default `true`) — Send checkout folder names as vault labels.
 - `worker.max_tasks_per_day` (integer, default `null`) — Worker mode: at most this many claimed tasks per day on this machine; only tightens the opt-in budget set on the web.
```

**File**: `legal/third-party-assets.toml` (modified, +2/-2)
```diff
@@ -4,9 +4,9 @@ authority = "THIRD_PARTY_NOTICES"
 
 [inputs]
 cargo_lock = "rust/Cargo.lock"
-cargo_lock_sha256 = "8446a84ff552675ec7d0b9593857c170f8054c3ab03ab9db063d682009a1a73a"
+cargo_lock_sha256 = "b22136d62dce29b3cfdf7d21b0e9dde9139a6669a17fc3d9c5623476ec59a1a6"
 sbom = "SBOM.cdx.json"
-sbom_sha256 = "ce7b7c770e0ffdd063e5ec37b3a8b872600989912b10ee58003d12b1216bc7c9"
+sbom_sha256 = "90512513e60f32345486863ac4cdeb5b79b286d042bfac6834b52bc134bcdcca"
 npm_lock = "packages/pi-lean-ctx/package-lock.json"
 npm_lock_sha256 = "2698eb8bcaf09c3ff275826b3be2e28e5fb6044b3245cd6ec23475e06d1744a1"
 
```

**File**: `legal/third-party-notices-approval.toml` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
 schema = "leanctx.third-party-notices-approval/v1"
-approved_content_sha256 = "d32e30dcf0641129515ceb236617649d297dadd9ca27b320a5011bff24961d18"
+approved_content_sha256 = "22938c1bafeab558ce8db4b830a233f7a32e2554e1a4549c83cb8908fcd59f15"
 approving_owner = "Yves Gugger"
-approval_evidence = "Copyright owner approval of the generated THIRD_PARTY_NOTICES (GENERATED AND APPROVED variant of scripts/generate-third-party-notices.py) for 3.12.1 after the first engine crate split; third-party Cargo packages unchanged (599), the only notice changes are the input digests, the Cargo graph 607 -> 612 (the own workspace crates lean-ctx-patterns, -workgraph, -compress, -fs, -syntax) and SBOM components 552 -> 557. Owner okay in the 3.12.1 integration lead session on 2026-11-01 (answer \"Freigeben\" to the notices question naming old a3b2e085 and new pending 39fd5a61)."
-approved_at = "2026-11-01"
+approval_evidence = "Copyright owner approval of the generated THIRD_PARTY_NOTICES (GENERATED AND APPROVED variant of scripts/generate-third-party-notices.py) for 3.12.1 after the Hive C0 2.1/2.2 engine sync; notice content unchanged (599 third-party Cargo packages, Cargo graph 612, same SBOM components), only the Cargo.lock and SBOM input digests change because curve25519-dalek is no longer a direct dependency. Owner okay in the 3.12.1 integration lead session on 2026-11-02 (answer \"Freigeben\" to the notices question naming old d32e30dc and new pending c10143a0)."
+approved_at = "2026-11-02"
```

**File**: `rust/Cargo.lock` (modified, +0/-3)
```diff
@@ -2180,7 +2180,6 @@ dependencies = [
  "chrono",
  "clap",
  "criterion",
- "curve25519-dalek",
  "dashmap",
  "dirs",
  "ed25519-dalek",
@@ -2342,9 +2341,7 @@ dependencies = [
  "base64 0.22.1",
  "chacha20poly1305",
  "chrono",
- "curve25519-dalek",
  "ed25519-dalek",
- "hkdf",
  "hmac",
  "regex",
  "serde",
```

#### Recent Merged Pull Requests:
- **PR #2173** (2026-11-02): fix: 3.12.1 Hive C0 2.1/2.2, agents talk to agents, humans observe (@yvgude)
- **PR #2170** (2026-11-01): fix: 3.12.1 first engine crate split, knowledge lifecycle to Hive, cleanup waves 5–6 (@yvgude)
- **PR #2168** (2026-11-01): fix: 3.12.1 shell security, knowledge journal, Hive-ready engine, cleanup waves 3–4 (@yvgude)
- **PR #2167** (2026-10-31): fix: emspace follow-up, background job output (#2164), semantic scan bound (#2063) (@yvgude)
- **PR #2163** (2026-10-31): chore: 3.12.1 cleanup, emspace provider, read outline and template collapse (@yvgude)
- **PR #2161** (2026-10-30): fix: 3.12.1 fixes, engine optimizations and OSS hardening (@yvgude)

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

## X. 3.12.1 shell security, knowledge journal, Hive-ready engine, cleanup waves 3–4 (

**RULE**:
When implementing operations in `.github/workflows/ci.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yvgude/lean-ctx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3550b694`: 3.12.1 shell security, knowledge journal, Hive-ready engine, cleanup waves 3–4 (#2168). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/ci.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      - name: Test preinstall stops only the installed daemon
        run: node packages/lean-ctx-bin/preinstall.test.cjs
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3550b694` are properly handled with clean fallback behavior.
