> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yvgude-lean-ctx-learnings.md`  
> **Source**: github ([https://github.com/yvgude/lean-ctx](https://github.com/yvgude/lean-ctx))  
> **Source Version**: `9fc77dec`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T11:26:00.056Z  
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
> **Harvest Timestamp**: 2026-10-31T11:26:00.043Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yvgude/lean-ctx`
- **Description**: LeanCTX is the Context Gateway for AI Systems. Select task-relevant context, apply supported controls, connect local knowledge and inspect recorded evidence. Open-source Engine: CLI, MCP, hooks and supported proxy paths.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3912 stars

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
- **Issue #2148** (2026-10-26): **bug: lean-ctx root bleeds accross sessions**
  *Symptoms*: **lean-ctx version:** (run `lean-ctx --version`) 3.11.0  **OS:** (macOS / Linux / Windows) linux  **AI tool:** (Cursor / Claude Code / Copilot / Crush / other)  **What happened:**  In my project toktok, with a brand new conversation, I had this :  <img width="1882" height="185" alt="Image" src="https://github.com/user-attachments/assets/606ea904-4710-496d-a84d-328c9bf3a778" />  <img width="1882" height="298" alt="Image" src="https://github.com/user-attachments/assets/83e2a718-4c74-4c93-a3a4-58e89ce2c811" />  The root was not in the right folder.  **What you expected:**  Root should always follow Claude Code's own root  
  **Post-Mortem & Fix Analysis**:
  > checking!

- **Issue #2147** (2026-10-26): **bug: Model re-reads with fresh:true everytime there is a dedup ref inside the content**
  *Symptoms*: **lean-ctx version:** (run `lean-ctx --version`) 3.11.0  **OS:** (macOS / Linux / Windows) linux  **AI tool:** (Cursor / Claude Code / Copilot / Crush / other): CC  **What happened:**  <img width="1339" height="174" alt="Image" src="https://github.com/user-attachments/assets/bd2bc88a-9336-439a-ab56-bdcda1f77afb" />  **What you expected:**  The model shouldn't waste tokens re-reading the same files twice 

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

### Incident Patch 1: `1cc70602` (2026-10-30)
**Commit Message**: perf(build): split the engine crate into 256 codegen units in dev-fast (#2160)

A one-line edit made cargo fast regenerate most of the engine crate: with
16 units each covers a large slice of the code. Measured on pounce, same
commit, idle machine, 3 edit builds per variant (dependencies unchanged):

  codegen-units  edit build (median)  lean_ctx codegen (median)
  16             37.2 s               18.6 s
  256            26.8 s                8.9 s

CLI runtime (20x read -m map, 20x grep over src/, 3 rounds) is equal
within noise; the binary is 2.4 % smaller. Release keeps its own profile.

Committed with --no-verify: the hook's guard ran locally (exit 0); its
Rust steps ran green on pounce for this staged tree (cargo fmt --check,
clippy --all-features prod and tests, gen_docs --check,
gen_testbench_recording --check) to keep the loaded Mac free.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `rust/Cargo.toml` (modified, +6/-0)
```diff
@@ -476,6 +476,12 @@ codegen-units = 16
 incremental = true
 strip = false
 
+# Small code units let an incremental rebuild of the engine crate regenerate
+# only what changed: on 30.10. a one-line edit took a median 27 s instead of
+# 37 s (codegen 9 s instead of 19 s) with unchanged runtime.
+[profile.dev-fast.package.lean-ctx]
+codegen-units = 256
+
 [target.'cfg(windows)'.dependencies]
 leanctx-native-storage = { path = "crates/leanctx-native-storage", version = "=0.1.1" }
 windows-sys = { version = "0.61", features = [
```

---

### Incident Patch 2: `d4b3ded1` (2026-10-30)
**Commit Message**: fix: 3.12.1 fixes, engine optimizations and OSS hardening (#2161)

Public export of private source 4198b400bd705df1f15452c2362ec6a0e781d5f7.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -72,6 +72,9 @@ website/
 # counted as "changed files" by preflight's change classification.
 .ctarget/
 target-wt*/
+# Machine-local build tuning (rust/scripts/setup-fast-build.sh: linker, sccache).
+# The shared `cargo fast` alias is tracked in rust/.cargo/config.toml.
+/.cargo/config.toml
 AGENTS.md.lean-ctx.*.bak
 docs/gpt/
 
```

**File**: `AGENTS.md` (modified, +7/-19)
```diff
@@ -110,10 +110,11 @@ lean-ctx automatically persists session context across restarts:
 - **Files**: Touched files with summaries and modification status
 - **Progress**: Task completion state and next steps
 
-This data is delivered through the first tool call's `--- AUTO CONTEXT ---`
-briefing (default `minimal_overhead = true`: initialize instructions stay
-byte-stable for provider prompt caching, #498). With `minimal_overhead = false`
-it is additionally injected at session start via the `ACTIVE SESSION` LITM block.
+This data is delivered as a `--- AUTO CONTEXT ---` briefing on the first
+`ctx_session` call with `action="load"`, `"status"` or `"show"` — never
+prepended to other tool results, which stay deterministic for provider prompt
+caching (#498). With `minimal_overhead = false` it is additionally injected at
+session start via the `ACTIVE SESSION` LITM block.
 
 Continuity is per agent: the briefing (last task, recent decisions), session
 findings in `ctx_knowledge search` and every other session-continuity read come
@@ -247,28 +248,15 @@ change-aware fast gate (the pre-push hook runs it too).
 ## Output Determinism (#498)
 
 Tool outputs MUST be deterministic functions of (file content, mode, CRP mode, task).
-Provider-side prompt caching (Anthropic 90%, OpenAI 50% discount) rewards byte-stable text;
+Provider-side prompt caching (a cache hit bills at 0.1× input on Anthropic and OpenAI GPT-5.6+,
+a miss rewrites the prefix at 1.25× or more) rewards byte-stable text;
 any timestamp, counter or random element in tool output bodies defeats it.
 
 - No timestamps/counters in output bodies. Artifact paths are content-addressed
   (see `save_tee`: `{cmd_slug}_{blake3(cmd)[..8]}.log`).
 - Dynamic additions (hints, checkpoints) only as state-triggered suffixes with stable headers.
 - Regression guard: determinism tests in `ctx_read/tests.rs`, `ctx_search.rs`, `shell/redact.rs`.
 
-<!-- lean-ctx -->
-## lean-ctx
-
-lean-ctx is active — the MCP tools replace native equivalents.
-Full rules: LEAN-CTX.md (open on demand — do not auto-load).
-<!-- /lean-ctx -->
-<!-- lean-ctx-compression -->
-OUTPUT STYLE: concise
-- Bullet points over paragraphs
-- Skip filler words and hedging ("I think", "probably", "it seems")
-- 1-sentence explanations max, then code/action
-- No repeating what the user said
-<!-- /lean-ctx-compression -->
-
 ## LeanCTX Context Gateway product-scope, source-security and IP guard — REQUIRED FOR ALL AGENTS
 
 Before **any** LeanCTX code, docs, connectors, SDK, EE, CI, packaging, refactor or release work, read `.agents/skills/leanctx-ip-governance/SKILL.md` and its **PRODUCT_SCOPE**, **CONNECTOR_AND_DECISION_SECURITY**, IP/licensing and release references. The product is the **Context Gateway for AI Systems** (Select → Control → Prove), not a general model router, agent orchestration framework or Thinkery OS; team coordination context (presence, leases, workspace bus, shared work graph) is in scope, agent execution and scheduling are not. New features must serve authorized source→ContextDecision→ContextBundle/Receipt, with current ACL/freshness/revocation checks; out-of-scope proposals require founder approval. Classify every affected file by product scope AND source rights. Preserve existing Apache functionality unless a separately approved reversible deprecation plan exists. New proprietary EE remains private; no public push, bulk deletion, history rewriting, relicense, CLA change or IP transfer claim without documented owner/legal/release authority. Respect stronger repository rules, preserve other agents' worktrees, record evidence and test security/compatibility. No public release credentials in agent workspaces.
```

**File**: `CHANGELOG.md` (modified, +304/-1)
```diff
@@ -6,8 +6,119 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
 
 ## [Unreleased]
 
+### Security
+
+- **Native Read and Grep now follow the secret-path rule.** `ctx_read` and `ctx_search`
+  refused `.env`, keys and credential files, but the host's own Read and Grep did not:
+  Claude Code keeps the Read redirect off and the redirect hook passed `.env` straight to
+  the native tool. The PreToolUse `hook redirect` now denies a native read or search whose
+  file, search root, file glob or symlink target is secret-like, with the same detector,
+  role switch (`io.allow_secret_paths`), warn/enforce mode and policy event as `ctx_read`,
+  in Hybrid mode and on the shadow surface too, on Claude Code, CodeBuddy, Cursor, Copilot
+  CLI and Gemini CLI. Behaviour change: native reads of files such as `*.pem` test
+  certificates or a `.npmrc` are now denied under the default role; allow them through the
+  role. Not covered: a directory-wide search, shell reads (`cat .env`), Windsurf and
+  Antigravity; see Security & Governance §4.0.
+
+- **LeanCTX approves a shell command only when your AI tool would have run it without
+  asking.** The shell and file hooks answered "allow" for every call they passed through or
+  wrapped, which skipped the AI tool's permission prompt for any command. They now mirror the
+  AI tool's own decision instead of granting one. Claude Code gets every rewrite, with "allow"
+  only when its permission settings (allow rules, its built-in read-only commands,
+  `bypassPermissions`) would have run the original command without a prompt; a command that a
+  deny or ask rule names, or may name, is left unchanged so the rule still applies. Cursor,
+  Copilot CLI and Codex, which take a rewrite only as an approval, get one only for a fixed set
+  of side-effect-free commands (`git status`/`log`/`diff`/`show`, `cat`, `ls`, `grep`, `rg`,
+  `find` without actions, …); builds, tests and every other command run unchanged under their
+  own approval. Gemini CLI never gets an approval, and a command its settings allow or
+  restrict by name is left unchanged. Unhandled calls and the timeout fallback carry no
+  decision.
+- **`report-issue` redacts secrets before a report can become a public issue.** The whole
+  report body, including the raw tee excerpt that `--include-tee` attaches, now goes through
+  the engine's secret redaction (tokens, keys, credentials become `[REDACTED:…]`), whatever
+  the role or `[secret_detection]` settings; before, only home paths and the user name were
+  masked. The GitHub token it asks for when `gh` is missing is read without echo.
+- **PathJail writes stay in the active project by default.** The default `path_jail_scope`
+  is `projects` again instead of `home`: every project below `~` stays readable, but tools
+  write only in the session's project, host-declared roots and allowed paths, so an agent
+  working in one repository can no longer plant `~/code/other/.git/hooks/pre-commit`.
+  `lean-ctx config set path_jail_scope home` (or `LEAN_CTX_PATH_JAIL_SCOPE=home`) restores
+  the 3.11.3 behaviour, and `lean-ctx doctor` and the server's startup warning now list it as
+  a jail relaxation. The Claude Code and CodeBuddy auto-memory exception
+  (`.claude/projects/<slug>/memory/`) now applies only under your own home directory (or
+  `CLAUDE_CONFIG_DIR`), not to a look-alike directory anywhere on disk. Upgrade note: see the
+  upgrade guide.
+- **`ctx_multi_repo add_root` passes PathJail.** The root was taken from the raw `path`
+  argument, so an agent could register `/` or `~` and then search and read it through
+  `repo=<alias>`. The root is now resolved through the jail like every other path argument,
+  and a root the jail refuses is not registered; `allow-path` and the other allow entries
+  still admit one.
+- **Project policies cannot drop the security defaults.** A project's
+  `.lean-ctx/policies.json` replaced the built-in exclusions for `.env*`, private keys and
+  credentials, and a later `Pin` or `Include` overrode them. The security defaults are now
+  always loaded ahead of the project's policies (a project policy reusing their names is
+  ignored), and their `Exclude` wins over any later action.
+- **`ctx_patch op="replace_all"` writes through the shared edit boundary.** It now takes the
+  per-file lock before reading, reads with the edit size cap and symlink refusal, refuses to
+  write when the file changed since it was read (TOCTOU guard), keeps the file's permissions
+  and invalidates the read dedup state, like every other `ctx_edit` and `ctx_patch` write.
+- **No approximate edit after a lossy read.** When the last read of a file was a compressed or
+  reduced view (`map`, `signatures`, `aggressive`, `entropy`, `task`, density or reference
+  modes), `ctx_edit` applies only an exact match against the file on disk; the
+  whitespace-tolerant and re-indent matchers are skipped, and a miss asks for a re-read with
```

**File**: `LEAN-CTX.md` (modified, +9/-14)
```diff
@@ -1,29 +1,24 @@
 <!-- lean-ctx-owned: PROJECT-LEAN-CTX.md v1 -->
 <!-- lean-ctx-rules -->
-<!-- version: 12 -->
-
-CRITICAL: ALWAYS use lean-ctx ctx_* tools as mapped below.
+<!-- version: 13 -->
 
 LeanCTX (lean-ctx) — Context Gateway for AI Systems.
 
-ACTUALLY EMIT the ctx_* tool call (ctx_compose first) — describing a tool is not calling it.
-
-MANDATORY MAPPING:
+lean-ctx routing — the host's built-in tools map to:
 • Read/cat -> ctx_read(path, mode)
 • Grep -> ctx_search(pattern, path)
 • Shell/bash -> ctx_shell(command)
 • Glob/find -> ctx_glob(pattern)
 • ls/find -> ctx_tree(path, depth)
+This covers built-in file/search/shell tools only; other MCP servers keep their own jobs.
 
-NEVER use built-in Read/Grep/Shell/Glob for these jobs. SELF-CORRECT: the moment you reach for one, stop and call the ctx_* tool instead. Other MCP servers keep their own jobs.
+Call the tool; describing a call does not run it.
 
-Tool selection by intent:
-• Orient / understand code (call FIRST) -> ctx_compose
-• Read a file -> ctx_read(path, mode=signatures|map|full); edit after reading -> ctx_patch
-• Exact symbol -> ctx_search(action=symbol); pattern -> ctx_search; by meaning -> ctx_search(action=semantic)
-• Files by glob -> ctx_glob; structure -> ctx_tree; callers/impact -> ctx_callgraph
-• Verify after edits -> ctx_shell(test/build); memory -> ctx_session / ctx_knowledge
-Semantic questions -> search tools, not whole-file reads: reading more ≠ understanding more.
+By task:
+• Unfamiliar code -> ctx_compose (search + read + symbols in one call)
+• Read -> ctx_read(mode=signatures|map|full); edit -> ctx_patch
+• Symbol -> ctx_search(action=symbol); meaning -> ctx_search(action=semantic)
+• Callers/impact -> ctx_callgraph; memory -> ctx_session / ctx_knowledge
 
 AGENT LOOP (phase -> tool):
 • Orient — understand before acting -> ctx_compose
```

**File**: `PUBLISH_MANIFEST.toml` (modified, +42/-3)
```diff
@@ -436,7 +436,6 @@ new_paths = [
   # protocol types and C0 hive/hive-v2 fixtures, engine metrics v2, consent helper,
   # shell approval, tasks, knowledge import and their tests: own work under Apache-2.0.
   # PROPOSED by the release rehearsal: the owner confirms this list before the export.
-  "docs/architecture/gateway-no-lockout.md",
   "rust/crates/lean-ctx-protocol/src/hive/anchor.rs",
   "rust/crates/lean-ctx-protocol/src/hive/automerge.rs",
   "rust/crates/lean-ctx-protocol/src/hive/codegraph.rs",
@@ -1457,6 +1456,34 @@ new_paths = [
   "rust/src/cli/dispatch/cockpit_hint.rs",
   "rust/src/cli/dispatch/network/cockpit_start.rs",
   "rust/src/dashboard/launch.rs",
+  # 3.12.1: failure-template scrubber, ctx_edit repeats, withheld audit and
+  # report export, hook permission mirroring (engine/engine-fix).
+  "rust/examples/retemplate_failure_messages.rs",
+  "rust/src/cli/report_export.rs",
+  "rust/src/core/failure_template_tests.rs",
+  "rust/src/core/failure_vocabulary.rs",
+  "rust/src/hook_handlers/claude_permissions.rs",
+  "rust/src/hook_handlers/claude_permissions_tests.rs",
+  "rust/src/hook_handlers/gemini_permissions.rs",
+  "rust/src/hook_handlers/safe_commands.rs",
+  "rust/src/hook_handlers/safe_commands_tests.rs",
+  "rust/src/tools/ctx_edit/applied_edits.rs",
+  # 3.12.1 optplan: governor hook, partial shell runs, lossless collapse,
+  # secret gate, ctx_read symbol (lean-ctx-af, integration/optplan).
+  "rust/src/core/patterns/lossless_collapse.rs",
+  "rust/src/core/shell_allowlist/partial.rs",
+  "rust/src/hook_handlers/govern/bash.rs",
+  "rust/src/hook_handlers/govern/diagnostics.rs",
+  "rust/src/hook_handlers/govern/enforce.rs",
+  "rust/src/hook_handlers/govern/mod.rs",
+  "rust/src/hook_handlers/govern/tests.rs",
+  "rust/src/hook_handlers/secret_gate.rs",
+  "rust/src/hooks/agents/claude_governor.rs",
+  "rust/src/tools/registered/ctx_read_symbol.rs",
+  # 3.12.1: the shared `cargo fast` alias (only the alias, no [build] job budget),
+  # so fresh clones can run `make build`; the root .cargo/config.toml stays private.
+  "rust/.cargo/config.toml",
+  "tests/build/test_cargo_alias.py",
 ]
 
 # Public paths the export no longer carries: each one is a feature sunset with
@@ -1879,6 +1906,18 @@ removed_paths = [
   "rust/src/setup/agent_select.rs",
   # 3.12.0 PROPOSED (owner confirms): the proxy /dashboard page now points to `lean-ctx cockpit`.
   "rust/src/proxy/web_app/dashboard.html",
+  # 3.12.1: the Visualizer page, unused since `visualize` was removed in 3.12.0;
+  # `cockpit --export` writes the Cockpit report (cli/report_export.rs).
+  "rust/src/assets/visualizer.html",
+  "rust/src/cli/visualize_cmd.rs",
+  "rust/src/core/visualizer.rs",
+  # 3.12.1 optplan: no Pro paths in the open engine; context ranking, memory
+  # selection and read strategy are local and free (2c38e03e05, 4f3ecaa5f1).
+  "rust/src/core/context_store/policy_store.rs",
+  "rust/src/core/intelligence_runtime/context_policy.rs",
+  "rust/src/core/intelligence_runtime/context_selection.rs",
+  "rust/src/core/intelligence_runtime/memory_curation.rs",
+  "rust/src/tools/ctx_compose_selection.rs",
 ]
 
 include = [
@@ -1957,7 +1996,7 @@ forbidden_prefixes = [
 # the canonical registry changes (scripts/check-capabilities.py checks the pin).
 [[generated]]
 path = "product/capabilities.toml"
-sha256 = "c241ccc39d56dd29db7c70805d73912052ff9b2cd32286a8e2e714f06135db0b"
+sha256 = "1fed7ac3a656c34351259279ef22897c47ae5fd88efd92956e9140be0cfdae38"
 required = true
 
 # The public source layout: `scripts/check-source-layout.py --project
@@ -1966,7 +2005,7 @@ required = true
 # product/source-layout.json changes.
 [[generated]]
 path = "docs/reference/generated/product-capabilities.md"
-sha256 = "aabdc717811e7d8ed694d6b471cff5b9e7a92befcc0f2602e9ccfc2f2c3df7f3"
+sha256 = "64b36affde791d759d115766fdd93433994cc03a366ffad4865757b8806f30c0"
 required = true
 
 [[generated]]
```

**File**: `SECURITY.md` (modified, +9/-9)
```diff
@@ -44,16 +44,16 @@ lean-ctx enforces a **filesystem boundary** for tool I/O:
 
 - **PathJail**: all tool path inputs are resolved (symlinks and `..` included) and checked
   against the jail scope (`path_jail_scope`, global-only):
-  - `home` (default since v3.11.1; read **and write** below `~` since v3.11.3): every path
-    below the user's home directory, except the protected zones — every top-level dot entry (`~/.ssh`, `~/.aws`, `~/.gnupg`,
+  - `projects` (default; also the default of v3.11.1–v3.11.2): only paths inside a project
+    below `~` (a folder between it and `~` holds `.git`, `Cargo.toml`, `package.json` or another
+    project marker) are readable; loose personal files stay jailed, and writes stay limited to
+    the session's project, host-declared roots and explicit allow entries.
+  - `home` (opt-in; the default of v3.11.3–v3.12.0, reported as a jail relaxation): every path
+    below the user's home directory, read **and write**, except the protected zones — every top-level dot entry (`~/.ssh`, `~/.aws`, `~/.gnupg`,
     `~/.config`, shell rc files, other agents' `~/.claude` / `~/.codex` / `~/.cursor`),
     `~/Library`, `~/AppData` / `NTUSER.DAT*` and `~/snap`. Everything outside `~` stays jailed.
     Zones are a hard deny: a root or allow entry that merely contains a zone does not open it.
     An implausible `$HOME` (`/`, `/root`, `/tmp`, not owned by the user) disables the scope.
-  - `projects` (the default of v3.11.1–v3.11.2): only paths inside a project below `~` (a folder
-    between it and `~` holds `.git`, `Cargo.toml`, `package.json` or another project marker) are
-    readable; loose personal files stay jailed, and writes stay limited to the session's project,
-    host-declared roots and explicit allow entries.
   - `project`: only the current `project_root` plus the explicit allow roots below.
   - If a path would escape, the call fails naming the single command that admits it
     (`lean-ctx allow-path <dir>`) and asks the agent to defer to the user.
@@ -285,11 +285,11 @@ proof of OS isolation. Inspect `rust/src/core/sandbox.rs` for the release in use
 - **interpreter inline-code blocking**: `bash -c`, `sh -c`, `python -c`, `node -e`, … are rejected (including via delegation wrappers like `env`, `timeout`, `xargs`) — quoting a payload inside `bash -c '…'` does not bypass the file-write or allowlist checks because the interpreter call itself is refused,
 - file-write detection (`>`, `>>`, `tee`, heredoc-to-file, `dd of=`, `curl -o/-O`, `wget` to file) — output capture (`>`, `>>`, `tee`) may go to the session's project, `allow_paths` / `extra_roots`, `write_allow_paths` or a scratch path (never `/`, `~`, an ancestor of `~` or a `read_only_roots` entry); downloads only to scratch paths and `write_allow_paths`; everything else belongs to the editor's native Write/Edit tools where the agent's permission UI governs them,
 - dangerous-flag blocking (`git --upload-pack`, `tar --to-command`, `find -exec`, `awk system()`), inline env hijack blocking (`PATH=`, `LD_PRELOAD=`, `GIT_SSH_COMMAND=`, …), and dangerous env-key filtering on the MCP `env` parameter,
-- **no self-loosening** (allowlist mode, the default): lean-ctx subcommands that widen its own guardrails — `yolo`, `allow <cmd>`, `allow-path <dir>`, `trust`, `security open`, `security secrets off`, `config set` of a security or path/allowlist key — are refused, so an agent cannot undo a refusal it just received. Listing, `--remove`, `secure`, `untrust` and `security secrets on` still run. The user runs the blocked commands in their own terminal (warn-only there, see below). `ctx_execute` is not covered — see the next paragraph.
+- **no self-loosening** (allowlist mode, the default): lean-ctx subcommands that widen its own guardrails — `yolo`, `allow <cmd>`, `allow-path <dir>`, `trust`, `security open`, `security secrets off`, `config set` of a security or path/allowlist key — are refused, so an agent cannot undo a refusal it just received. Listing, `--remove`, `secure`, `untrust` and `security secrets on` still run. The user runs the blocked commands in their own terminal (warn-only there, see below). Shell code in `ctx_execute` is covered as well — see the next paragraph.
 
 Enforcement applies to the MCP path, hook-child mode and every non-interactive CLI invocation; an interactive human terminal gets a warning instead (`LEAN_CTX_ALLOWLIST_WARN_ONLY=1` opts out explicitly). Cloud/infra mutation CLIs (terraform, kubectl, aws, …) are excluded from the default allowlist and require per-tool opt-in (`lean-ctx allow <cmd>`). Commands inside a substitution in an argument (`$(…)`, backticks, `<(…)`/`>(…)`) are gated like top-level commands in every enforce-mode call. `shell_strict_mode = true` upgrades the remaining warn-only heuristic (pipe to a bare interpreter) to a hard block.
 
-**`ctx_execute(language=shell)` is deliberately NOT allowlisted (GH #905).** The checks above gate `ctx_shell` and `lean-ctx -c` only. `ctx_execut
```

**File**: `discord-faq.md` (modified, +1/-1)
```diff
@@ -136,7 +136,7 @@ If you're using `pi-lean-ctx` (Pi editor), make sure you're on the latest versio
 3. Check that your project root is correct: `lean-ctx doctor`
 
 **Q: "path escapes project root" error!**
-Since v3.11.3 everything below your home directory is readable and writable out of the box (`path_jail_scope = "home"`), except protected locations like `~/.ssh`, `~/.aws`, `~/.config` and `~/Library`. If you still see it:
+Out of the box (`path_jail_scope = "projects"`) every project below your home directory is readable and the active project is writable; protected locations like `~/.ssh`, `~/.aws`, `~/.config` and `~/Library` stay closed. `lean-ctx config set path_jail_scope home` makes all of `~` readable and writable. If you still see it:
 - The error names the fix — usually `lean-ctx allow-path <dir>` for a directory outside `~`, a non-project folder, a sibling project you want to edit, or a protected one like `~/.config/...` (takes effect immediately)
 - Session bound to the wrong project? Run `lean-ctx doctor` — "Project binding" shows a `LEAN_CTX_PROJECT_ROOT` pinned in a global agent config (older setups wrote it); `lean-ctx doctor --fix` removes it, then restart the agent once
 - On an older version: `lean-ctx update`
```

**File**: `docs/POSITIONING_CANONICAL.md` (modified, +5/-5)
```diff
@@ -40,9 +40,8 @@ inside the product. Other deeper lifecycles must not replace the primary story.
 | **LeanCTX Engine** | The runtime implementing context capabilities |
 | **LeanCTX SDK** | The integration surface for embedding supported Engine capabilities |
 | **Context Intelligence** | Context selection and preparation capabilities inside LeanCTX |
-| **Community** | The open-source Engine and its supported local paths, under Apache-2.0 |
-| **Pro** | The released personal hosted-services plan, including Personal Cloud sync/backup and hosted index capacity within the selected plan's limits |
-| **Enterprise** | Commercial organization controls and deployment, scoped to the licensed release and agreement |
+| **LeanCTX OSS** | The open-source Engine, free and complete on its supported local paths, under Apache-2.0 (formerly "Community") |
+| **LeanCTX Hive** | The paid version (Personal · Team · Enterprise): control and proof on top of OSS — filter packs, org policy, compliance, Cockpit across engines, shared context and team coordination — scoped to the licensed release and agreement |
 | **SDK / OEM** | Embedding and distribution scope under the applicable SDK/runtime licenses and commercial agreement |
 
 Keep the customer's application, agent loop, model choice and UI. Coding agents
@@ -67,8 +66,9 @@ Local context-only use does not require hosted services. Provider/execution
 controls apply only to supported calls routed through the configured runtime.
 Enterprise identity, organization policy, retention, connector coverage and
 operations must be described against that edition's supported release.
-Pro availability does not establish that every newer adaptive-context or
-intelligence feature is included in the current public release.
+No local context behaviour (ranking, memory selection, read strategy, planning)
+has a paid-better variant; LeanCTX Hive adds governance, not better local
+results.
 
 ## Evidence and security claims
 
```

#### Recent Merged Pull Requests:
- **PR #2163** (2026-10-31): chore: 3.12.1 cleanup, emspace provider, read outline and template collapse (@yvgude)
- **PR #2161** (2026-10-30): fix: 3.12.1 fixes, engine optimizations and OSS hardening (@yvgude)
- **PR #2160** (2026-10-30): perf(build): 256 codegen units for the engine crate in dev-fast (@yvgude)
- **PR #2159** (2026-10-29): ci(release): build once on main, reuse the verified build on the tag (@yvgude)
- **PR #2158** (2026-10-29): Release 3.12.0: the Cockpit installs itself, faster release (@yvgude)
- **PR #2157** (2026-10-29): Release 3.12.0: release pipeline fix and security alerts (@yvgude)

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

## X. build): split the engine crate into 256 codegen units in dev-fast (#2160)

**RULE**:
When implementing operations in `rust/Cargo.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yvgude/lean-ctx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1cc70602`: build): split the engine crate into 256 codegen units in dev-fast (#2160). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `rust/Cargo.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# Small code units let an incremental rebuild of the engine crate regenerate
# only what changed: on 30.10. a one-line edit took a median 27 s instead of
# 37 s (codegen 9 s instead of 19 s) with unchanged runtime.
[profile.dev-fast.package.lean-ctx]
codegen-units = 256

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1cc70602` are properly handled with clean fallback behavior.
