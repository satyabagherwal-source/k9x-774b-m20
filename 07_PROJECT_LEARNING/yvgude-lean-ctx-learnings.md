> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yvgude-lean-ctx-learnings.md`  
> **Source**: github ([https://github.com/yvgude/lean-ctx](https://github.com/yvgude/lean-ctx))  
> **Source Version**: `b6de365b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-14T00:25:02.720Z  
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
> **Harvest Timestamp**: 2026-11-14T00:25:02.712Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yvgude/lean-ctx`
- **Description**: LeanCTX is the Context Gateway for AI Systems. Select task-relevant context, apply supported controls, connect local knowledge and inspect recorded evidence. Open-source Engine: CLI, MCP, hooks and supported proxy paths.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3944 stars

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
// `lean-ctx value` re-verifies both hash chains end to end: rarely, in the background.
const PROVE_FIRST_MS = 4_000
const PROVE_MS = 5 * 60_000
const PROVE_TIMEOUT_MS = 120_000
// After a failed or timed-out proof the clock waits twice as long each time, up to an hour (#2240).
const PROVE_BACKOFF_MAX_MS = 60 * 60_000
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
function figureCells(text: s
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

use crate::capture::conflicts::Kind;
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
    /// From the folded edges alone.
    pub fn new(graph: &Graph) -> Self {
        Self::build(graph, &[])
    }

    /// From the folded edges and the links of each fact's values the save
    /// history resolves ([`crate::capture::conflicts::derived`]): two
    /// Instances' concurrent values of one shared fact are `conflicting`
    /// as soon as both are folded here, not only once the conflict edge has
    /// travelled through the Hive (#286).
    pub fn with_saves(
        graph: &Graph,
        saves: &std::collections::BTreeMap<String, crate::replica::log::Save>,
    ) -> Self {
        Self::build(graph, &crate::capture::conflicts::derived(graph, saves))
    }

    fn build(graph: &Graph, links: &[(Kind, String, String)]) -> Self {
        let mut superseded: HashSet<String> = graph
            .edges
            .values()
            .filter(|e| e.kind == "supersedes" && !e.retracted && live(graph, &e.from))
            .map(|e| e.to.clone())
            .collect();
        superseded.extend(
            links
                .iter()
                .filter(|(kind, from, _)| *kind == Kind::Supersedes && live(graph, from))
                .map(|(_, _, to)| to.clone()),
        );
        let open = |id: &str| live(graph, id) && !superseded.contains(id);
        let mut contradicted = HashSet::new();
        let pairs = graph
            .edges
            .values()
            .filter(|e| e.kind == "contradicts" && !e.retracted)
            .map(|e| (e.from.as_str(), e.to.as_str()))
            .chain(
                links
                    .iter()
                    .filter(|(kind, _, _)| *kind == Kind::Contradicts)
                    .map(|(_, from, to)| (from.as_str(), to.as_str())),
            );
        for (from, to) in pairs {
            if open(to) {
                contradicted.insert(from.to_owned());
            }
            if open(from) {
                contradicted.insert(to.to_owned());
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
    #[
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
- **Issue #2244** (2026-11-13): **bug: Multi repo search is not working**
  *Symptoms*: **lean-ctx version:** (run `lean-ctx --version`)  3.12.3  **OS:** (macOS / Linux / Windows)  MacOS and Windows  **AI tool:** (Cursor / Claude Code / Copilot / Crush / other)  VSCode with Copilot harness  **What happened:**  ctx_multi_repo was working in 3.12.2, but in 3.12.3 it stopped working:  <img width="471" height="568" alt="image" src="https://github.com/user-attachments/assets/3ca05e06-bb75-492e-b913-b3e71d978ff6" />  If l call `ctx_multi_repo list_roots` I get (pending) on each folder. It did not resolve by just waiting (in case there is some background operation that needs to finish).  **What you expected:**  A ctx_multi_repo query and multiple roots to return results.   **Steps to reproduce:**  1. a VS Code code-worspace with multiple projects  2. a `.lean-ctx.toml `file with extra_roots and absolute paths that are valid based on the OS (MacOS/Windows)  3. `lean-ctx trust`  - to truest the workspace, specifically the extra roots 4. for each directory i call manually `lean-ctx index build` 5. for each repository we call ctx_multi_repo add_root - results in multi-repo status: ACTIVE and N number of roots 6. try to query across repos - which results in the error on the screenshot above 

- **Issue #2212** (2026-11-08): **shell gate: curl --hsts/--alt-svc and wget --save-cookies after an unfollowable cd are not judged as writes (#2201 follow-up)**
  *Symptoms*: ### What happens  After a `cd` the shell gate cannot follow, a `curl`/`wget` call is judged only by the files it writes (#2201, `rust/src/core/shell_allowlist/download_targets.rs`). That list is incomplete. These options write a file named on the command line, but the list misses them, so a call like  ```sh cd "$(some-dir)" && curl --hsts config.toml https://example.com cd "$(some-dir)" && wget --save-cookies config.toml https://example.com ```  is no longer refused when the named file is a protected LeanCTX config file, while `curl -o config.toml` is.  ### Missing write targets  - curl (`CURL_OUTPUT_LONGS`, lines 27-35): `--hsts <file>`, `--alt-svc <file>` (both read *and write* their cache file) - wget (`wget_targets`, only `-O`/`-P`/`-o`/`-a` today): `--save-cookies <file>`, `--hsts-file <file>`, `--warc-file <file>` (writes `<file>.warc[.gz]`), `--rejected-log <file>`  Each must be read in both the `--opt value` and `--opt=value` forms.  ### Expected  Every option that writes a file named on the command line counts as a write target, with tests per option in both forms. The fix lands in the 3.12.x line.  Found while reviewing the 3.12.3 port of #2201. 

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

### Incident Patch 1: `b6de365b` (2026-11-12)
**Commit Message**: Merge pull request #2242 from yvgude/release/3.12.4-r4

Release 3.12.4

**File**: `CHANGELOG.md` (modified, +125/-0)
```diff
@@ -6,6 +6,8 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
 
 ## [Unreleased]
 
+## [3.12.4] — 2026-11-12
+
 ### Added
 
 - **Policy enforcement acknowledged to Hive (D4).** The bus hello now names the features
@@ -18,6 +20,129 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
   `policy.sessions` adds `installed.enforcement` (`applied_version`, `acknowledged_at`,
   `sessions`, `reported_at`), additively.
 
+- **ECCP L/I/G change classifier (task 156).** `scripts/change-class <base> <head>`
+  prints `L` (no public Rust item changed), `I` (public items only added) or `G`
+  (public item changed or removed, Cargo features or dependency tables,
+  `Cargo.lock`, `build.rs`, Cargo config, toolchain pin, CI configuration or a
+  generated registry) from the git objects alone, without a build or network,
+  and serves as `$ECCP_CLASSIFIER` for `scripts/eccp-envelope`.
+
+- **ECCP change envelope in git notes (task 157).** `scripts/eccp-envelope` writes,
+  shows and verifies a `leanctx.change-envelope/v1` JSON note under
+  `refs/notes/eccp` on a merge request head: intent, base, class, read set,
+  derivations and check evidence (`docs/contracts/change-envelope-v1.md`).
+
+- **Audit entries v2 bind each tool call to its session (ent3-1).** Every new
+  audit-trail entry carries `v: 2` and a chained `v2_hash` over its timestamp
+  and, for a call of an MCP session, the `session_id`, a per-session `seq`,
+  the decision and an output digest, so an edited timestamp, seq or fact fails
+  `verify_chain` and `verify_chain_full` at that entry. Input and output digests
+  are HMAC-SHA256 under the engine-local key (`hive/receipts.hmac-key`, never
+  uploaded). The v1 `entry_hash` is unchanged: older engines and
+  `leanctx-verify` still verify a mixed trail, and an entry of a newer version
+  counts as forward-compatible, not as tampering.
+
+- **Managed configuration for MDM-provisioned machines (task 169).** An organisation can
+  preconfigure an Instance through a macOS configuration profile, the Windows policy key
+  `HKLM\SOFTWARE\Policies\LeanCTX\Managed` or `/etc/lean-ctx/managed.toml`
+  (`leanctx.managed-config/v1`, `docs/contracts/managed-config-v1.md`). Managed
+  `hive.url` and `hive.root_key` win over `[hive]` and `config set` on them is refused;
+  `hive.org` refuses an enrollment for another org; `hive.require` makes tools refuse
+  until the machine is signed in and has a policy floor. A carrier that is malformed,
+  a symlink, or not root-owned (it or its directory) fails closed; it is checked and
+  read through one open handle. `hive status` and the cockpit `hive status --json`
+  (`managed`, since 1.7) show the carrier and each member.
+
+- **Unit claims warn before two agents edit the same code.** A `ctx_patch` or `ctx_edit`
+  write claims the functions, types and Markdown sections it touches for the editing agent
+  (10-minute lease, renewed on each edit). When another agent holds a claim on a touched
+  unit, the write goes ahead and the result names the holder (`LEAN_CTX_CLAIM_MODE=warn`,
+  the default). `strict` refuses the write before anything is written, and `off` turns the
+  check off. `ctx_agent action=claims` lists the live claims. `action=plan_claims` plans a
+  task against them, through an optional local planner (`LEAN_CTX_CLAIM_PLANNER`) or a
+  built-in fallback without network, and claims the free units. Claims are released when
+  the agent reports `status=finished` and when the server shuts down.
+
+### Security
+
+The first five fixes below were reported by @dkiaulakis.
+
+- **A redirection written another way cannot write past the gate (GHSA-4gm5-2mgw-9r9r).** A
+  redirection with a file-descriptor prefix, an `&>`/`>|`/`<>` operator, a quoted or escaped
+  target, or no space before its target was missed, so an agent shell could write lean-ctx's
+  own state or an unlisted file. The gate now reads every redirection in its canonical form
+  before any other check.
+
+- **A command inside `( … )` or `{ …; }` is checked like any other (GHSA-9jrf-q94p-frhr).** A
+  subshell or group was one segment to the gate, whose first word (`(eval`, `(rm`) matched no
+  rule, and a redirection after the group was dropped. Every group is now opened into its
+  commands for the checks, and a redirection after it is checked too; a command in a `case`
+  arm or after `then`, `do`, `else` or `coproc` is judged as its own command. The line that
+  runs is unchanged.
+
+- **The state guard follows the working directory and the values a line builds
+  (GHSA-cfmv-qg29-3rvp).** Repeated or conditional `cd ..`, a `cd` in a loop, function or trap,
+  `CDPATH`/`HOME`/`OLDPWD` assignments, variables assigned or read at run time (also
+  `${d:=…}` and `set --` arguments, also inside a longer word), the shell's own
+  `$PWD`/`$OLDPWD`/`$_` and `~+`/`~-`/`~N`, brace and parameter expansions, function
+  arguments, `alias` bodies, `GIT_DIR`-
```

**File**: `PUBLIC-EXPORT-RECEIPT.json` (modified, +663/-411)
```diff
@@ -331,11 +331,11 @@
    "size": 1033
   },
   {
-   "blob": "c64f0b1ac0eaa0e6f40489cf23046d142a60a727",
+   "blob": "1516a1ee651df535b86515a6d72266efad671428",
    "mode": "100644",
    "path": "CHANGELOG.md",
-   "sha256": "5f708d8498443961ea47028c9f12422c8df16b792b63df46c30f1f1ca1db4f8f",
-   "size": 1272010
+   "sha256": "b21ed364e667e4239709a8a01a0d04688b0f3784571a5001a8823b23f5f05514",
+   "size": 1280635
   },
   {
    "blob": "77a7c7a520af8fc8b4df372eb5bd5fddcefbfecf",
@@ -436,11 +436,11 @@
    "size": 525
   },
   {
-   "blob": "5ea3b6397ca88514f5ab94d0848164921d0ce4cc",
+   "blob": "3cd05e74c413de624925a3fc8c5f0a27e0c76b86",
    "mode": "100644",
    "path": "PUBLISH_MANIFEST.toml",
-   "sha256": "ec6665ab41d39d72cd40d9db1abea9461cb723d6dff6ba9a9237729ea520b8ce",
-   "size": 310499
+   "sha256": "7392d39258c40018285ae618f4ed3a14f7c5358109fb89ec6adb34c52311935a",
+   "size": 312964
   },
   {
    "blob": "b50ec9ee68e230777b65ff932e22735417a8e540",
@@ -450,10 +450,10 @@
    "size": 38306
   },
   {
-   "blob": "79c8d5f64ce9040787790be6d7af987644efac54",
+   "blob": "90cdc9b4223cbe89ea594c2afae3478fb370c776",
    "mode": "100644",
    "path": "SBOM.cdx.json",
-   "sha256": "a32ffd39a679765dec3231701a978dbc1eeaaba4fb1ffe48b4d71e0f0d6e9e0a",
+   "sha256": "d702d0d8eeca3baf404bc3191ad6bf5c159bf460f2e9e4e9e91b936e1b33a2cd",
    "size": 689556
   },
   {
@@ -464,10 +464,10 @@
    "size": 32425
   },
   {
-   "blob": "b2b8efcc513cd0a0ab69410b047eb7a94f1c5c54",
+   "blob": "97a8bfd612479e9df3c40f4c1d3284de52b4c7c5",
    "mode": "100644",
    "path": "THIRD_PARTY_NOTICES",
-   "sha256": "c7ab236b6d058ed5b2c598e6ba1e749faa2087221c2b3a514b4937e7f231e5ac",
+   "sha256": "d3d27f494df715682fd7306fbf9a60f49fc99b87f1e95c929c25c09867bd9074",
    "size": 331754
   },
   {
@@ -513,10 +513,10 @@
    "size": 593
   },
   {
-   "blob": "99ea4539c31f8772ad014df1a6350d98c4b8c5f2",
+   "blob": "bc0d0484a42c163ee07dc5c0b7e853fbd4968739",
    "mode": "100644",
    "path": "aur/lean-ctx/PKGBUILD",
-   "sha256": "6ccda55f6860646b3c94bd0601eac844d9542f1abae1d9efd06faaa0019ba265",
+   "sha256": "721a41ab8854f5785cd63e1519f76ba526975580aae109fcce42ad3aa3a6e38d",
    "size": 2096
   },
   {
@@ -527,11 +527,11 @@
    "size": 6789
   },
   {
-   "blob": "e735e77f234e947a9bc6715383f814634a45ff9b",
+   "blob": "3bf3d255849fe76b9a95099510d9940099118f70",
    "mode": "100644",
    "path": "ci/gitlab-ci.yml",
-   "sha256": "da2e8500337f3bf1d2e9574823e59ab48be589a461f418b46cdc560400a10e8c",
-   "size": 53224
+   "sha256": "bc10f112e6b5228694c78f8bd23e5da91253fdb5263ea7b5697c1bccb4835c35",
+   "size": 60637
   },
   {
    "blob": "102f24e836104cc226bf24b5a5ce582ec184eb39",
@@ -3264,11 +3264,11 @@
    "size": 8690
   },
   {
-   "blob": "437206a949df05418ba4568f9ccf5a9c33990aa1",
+   "blob": "d99134e5d44f81033ce5c8f6c1c1c786a99d1127",
    "mode": "100644",
    "path": "docs/reference/generated/config-keys.md",
-   "sha256": "f6cdc32b8dd13845923e5c14ca1853d0128e1a3f87ab35154ffdc0a0c6c8ba54",
-   "size": 72058
+   "sha256": "5e431aad9867b6e9e06e0e77d884dca22ea8e68efaa5259718505a241361fa6b",
+   "size": 72738
   },
   {
    "blob": "e13f846428672699c0599c3951fce4ad25fbe648",
@@ -3278,11 +3278,11 @@
    "size": 5512
   },
   {
-   "blob": "13db6570848b81860092c6473bd99acb9a4ab22c",
+   "blob": "dd0dd6f74c89aa1f5c3818dc22e92138afce860c",
    "mode": "100644",
    "path": "docs/reference/generated/mcp-tools.md",
-   "sha256": "2107f1f7ab9af2e0bf7da6535e49af938ab3a20466b325dc233b6d94f9098291",
-   "size": 23420
+   "sha256": "08f517964b066fe064d85e75eb2dbac701a88be19c4f2763607c5c37035f65bd",
+   "size": 23520
   },
   {
    "blob": "392dce35ae93180bf5953b4e7e77f2d56a3102be",
@@ -3656,11 +3656,11 @@
    "size": 9354
   },
   {
-   "blob": "d45801744365bff4f74744692821e317b0295b38",
+   "blob": "019df3bb674de25b71c9b37084c2647f14bb6b21",
    "mode": "100644",
    "path": "integrations/claude-code-mod/hooks/cockpit.tsx",
-   "sha256": "7705784f31ecdb0bf0c6872a22d76d392af2410836897945afff896af54f0a5c",
-   "size": 64696
+   "sha256": "d71bf5f35d9a94030b3ddc500fc375c3734697fc81858e340bd62922925c31d8",
+   "size": 65938
   },
   {
    "blob": "9f45101460f1aad4ec66b7747876b8a64c40c739",
@@ -3691,11 +3691,11 @@
    "size": 35330
   },
   {
-   "blob": "c727b23ee499d95d9566bf06af867132d9077e39",
+   "blob": "e4b9cecdd08f780eb5079f42a49543928a38f2b9",
    "mode": "100644",
    "path": "integrations/claude-code-mod/tests/cockpit.test.tsx",
-   "sha256": "c360f62b14ad315d10700e8796cc7081fecc2052e7e21d17413fc575224cbe39",
-   "size": 4334
+   "sha256": "40d311e3823abae9c251d1a4cf04f53beb8009a7bb163664e48c90b2d34dcd81",
+   "size": 6809
   },
   {
    "blob": "770c0e5660f09fa6175f5a67d6352cca1ff6f101",
@@ -4006,18 +4006,18 @@
    "size": 193663
   },
   {
-   "blob": "9ef0440b7a4cacbd751127a77909c28aea8db8f5",
+   "blob": "bee3e7eac086bf2cd7ce0edb6066478fd71e5914",
    "mode": "100644",
    "path": "legal/third-party-assets.toml",
-   "sha256": "d081cb4f7dfa289
```

**File**: `PUBLISH_MANIFEST.toml` (modified, +48/-0)
```diff
@@ -345,6 +345,8 @@ new_paths = [
   "rust/src/core/context_admission/cross_line.rs",
   "rust/src/core/context_admission/egress_api_tests.rs",
   "rust/src/core/context_admission/egress_walk.rs",
+  # GHSA-xmx8-69qv-7f86 regression tests: Apache-2.0, own work.
+  "rust/src/core/context_admission/operand_tests.rs",
   "rust/src/core/context_admission/origin.rs",
   "rust/src/core/context_admission/receipt_store/anchors.rs",
   "rust/src/core/context_admission/receipt_store/capacity.rs",
@@ -395,6 +397,7 @@ new_paths = [
   "rust/src/shell/containment/starter.rs",
   "rust/src/shell/containment/tests.rs",
   "rust/src/shell/containment/wire.rs",
+  "scripts/ci/postmerge_bisect.py",
   "scripts/eccp-envelope",
   "scripts/agent_tools_compatibility.py",
   "scripts/check-capabilities.py",
@@ -408,6 +411,7 @@ new_paths = [
   "rust/crates/lean-ctx-server/tests/main.rs",
   "rust/crates/lean-ctx-protocol/tests/main.rs",
   "scripts/check-local-free.py",
+  "scripts/tests/test_postmerge_bisect.py",
   "tests/delivery/test_check_local_free.py",
   "tests/hive-e2e/lifecycle.cjs",
   "tests/hive-e2e/lifecycle.sh",
@@ -430,6 +434,14 @@ new_paths = [
   "scripts/scan-release-artifacts.py",
   "scripts/source-export-manifest.py",
   "scripts/sync-capabilities.py",
+  # W3-08 deterministic checkers: own code, Apache-2.0 SPDX-headed.
+  "scripts/mutants-changed",
+  "scripts/tests/test_mutants_changed.py",
+  "rust/crates/lean-ctx-shell-policy/tests/proptest_tokenizer.rs",
+  "rust/fuzz/.gitignore",
+  "rust/fuzz/Cargo.toml",
+  "rust/fuzz/README.md",
+  "rust/fuzz/fuzz_targets/shell_tokenizer.rs",
   # ECCP W1b-02 change classifier (task 156): own code, Apache-2.0 SPDX-headed.
   "scripts/change-class",
   "scripts/tests/test_change_class.py",
@@ -1337,6 +1349,7 @@ new_paths = [
   "rust/crates/lean-ctx-hive/src/metrics_v2/tests.rs",
   "rust/crates/lean-ctx-hive/src/metrics_v2/upload.rs",
   "rust/crates/lean-ctx-hive/src/migrate.rs",
+  "rust/crates/lean-ctx-hive/src/models_access.rs",
   "rust/crates/lean-ctx-hive/src/migrate_tests.rs",
   "rust/crates/lean-ctx-hive/src/policy_tests.rs",
   "rust/crates/lean-ctx-hive/src/receipts_tests.rs",
@@ -1378,6 +1391,7 @@ new_paths = [
   "rust/crates/lean-ctx-hive/src/throttle_tests.rs",
   "rust/src/core/untrusted.rs",
   "rust/src/core/hive_gate.rs",
+  "rust/src/core/hive_models.rs",
   "rust/src/core/config/hive.rs",
   "rust/src/core/engine_interface/receipt_sink.rs",
   "rust/crates/lean-ctx-hive/src/vault.rs",
@@ -1407,6 +1421,10 @@ new_paths = [
   "rust/crates/lean-ctx-shell-policy/src/tests_ps_quotes.rs",
   "rust/crates/lean-ctx-shell-policy/src/tests_ps_escapes.rs",
   "rust/crates/lean-ctx-shell-policy/src/redaction_marker.rs",
+  # 3.12.4 shell-gate advisories (GHSA-4gm5/9jrf/cfmv/fv44).
+  "rust/crates/lean-ctx-shell-policy/src/groups.rs",
+  "rust/crates/lean-ctx-shell-policy/src/redirections.rs",
+  "rust/crates/lean-ctx-shell-policy/src/tests_ghsa_3124.rs",
   "rust/crates/lean-ctx-server/tests/agent_wait_roundtrip.rs",
   "rust/tests/suite/hive_fake_wire_conformance.rs",
   "scripts/sync-hive-c0.sh",
@@ -1859,6 +1877,7 @@ new_paths = [
   "rust/crates/lean-ctx/src/cli/migrate_legacy.rs",
   "rust/crates/lean-ctx/src/cli/mod.rs",
   "rust/crates/lean-ctx/src/cli/model_cmd.rs",
+  "rust/crates/lean-ctx/src/cli/models_cmd.rs",
   "rust/crates/lean-ctx/src/cli/ocla_cmd.rs",
   "rust/crates/lean-ctx/src/cli/output_savings_cmd.rs",
   "rust/crates/lean-ctx/src/cli/overview_cmd.rs",
@@ -2073,6 +2092,8 @@ new_paths = [
   "rust/src/core/mcp_roots/derive.rs",
   "rust/src/core/policy/audit_filter.rs",
   "rust/src/core/read_mode.rs",
+  # redaction.rs tests moved into their own file (LOC gate): Apache-2.0, own work.
+  "rust/src/core/redaction/tests.rs",
   "rust/src/core/reference_store.rs",
   "rust/src/core/reference_store/tests.rs",
   "rust/src/core/rooted_read.rs",
@@ -2159,6 +2180,7 @@ new_paths = [
   "rust/crates/lean-ctx-proxy/src/integration_tests.rs",
   "rust/crates/lean-ctx-proxy/src/intent.rs",
   "rust/crates/lean-ctx-proxy/src/introspect.rs",
+  "rust/crates/lean-ctx-proxy/src/leanctx_provider.rs",
   "rust/crates/lean-ctx-proxy/src/lib.rs",
   "rust/crates/lean-ctx-proxy/src/lineage.rs",
   "rust/crates/lean-ctx-proxy/src/live_zone.rs",
@@ -2672,6 +2694,7 @@ new_paths = [
   "rust/crates/lean-ctx-hooks/src/hook_handlers/tests_search_rewrites.rs",
   "rust/crates/lean-ctx-hooks/src/hook_handlers/value_recap.rs",
   "rust/crates/lean-ctx-hooks/src/hook_handlers/vibe.rs",
+  "rust/crates/lean-ctx-hooks/src/hook_handlers/write_guard.rs",
   "rust/crates/lean-ctx-hooks/src/hooks/agents/amp.rs",
   "rust/crates/lean-ctx-hooks/src/hooks/agents/antigravity.rs",
   "rust/crates/lean-ctx-hooks/src/hooks/agents/claude.rs",
@@ -2730,6 +2753,15 @@ new_paths = [
   "rust/src/ipc/detached.rs",
   "rust/src/ipc/process/services.rs",
   "rust/src/ipc/process/tests.rs",
+  # mz6/mz14 T4: model origin/host-country enforcement. Own code, Apache-2.0;
+  # the catalog d
```

**File**: `SBOM.cdx.json` (modified, +26/-26)
```diff
@@ -94,7 +94,7 @@
       "version": "0.2.0"
     },
     {
-      "bom-ref": "path+file://./rust/crates/lean-ctx-ocla#6.0.0",
+      "bom-ref": "path+file://./rust/crates/lean-ctx-ocla#7.0.0",
       "description": "Open Context & Token Lifecycle Architecture \u2014 the provider-neutral contract boundary (capability traits, canonical types, token envelopes) shared between lean-ctx-core (OSS) and lean-ctx-enterprise (proprietary).",
       "externalReferences": [
         {
@@ -108,10 +108,10 @@
         }
       ],
       "name": "lean-ctx-ocla",
-      "purl": "pkg:cargo/lean-ctx-ocla@6.0.0?download_url=file://crates/lean-ctx-ocla",
+      "purl": "pkg:cargo/lean-ctx-ocla@7.0.0?download_url=file://crates/lean-ctx-ocla",
       "scope": "required",
       "type": "library",
-      "version": "6.0.0"
+      "version": "7.0.0"
     },
     {
       "bom-ref": "path+file://./rust/crates/lean-ctx-patterns#0.1.0",
@@ -138,7 +138,7 @@
       "version": "0.1.0"
     },
     {
-      "bom-ref": "path+file://./rust/crates/lean-ctx-protocol#0.6.0",
+      "bom-ref": "path+file://./rust/crates/lean-ctx-protocol#0.7.0",
       "description": "Open wire contracts for lean-ctx: events, observations, assignments, evidence gaps.",
       "externalReferences": [
         {
@@ -152,10 +152,10 @@
         }
       ],
       "name": "lean-ctx-protocol",
-      "purl": "pkg:cargo/lean-ctx-protocol@0.6.0?download_url=file://crates/lean-ctx-protocol",
+      "purl": "pkg:cargo/lean-ctx-protocol@0.7.0?download_url=file://crates/lean-ctx-protocol",
       "scope": "required",
       "type": "library",
-      "version": "0.6.0"
+      "version": "0.7.0"
     },
     {
       "bom-ref": "path+file://./rust/crates/lean-ctx-syntax#0.1.0",
@@ -182,7 +182,7 @@
       "version": "0.1.0"
     },
     {
-      "bom-ref": "path+file://./rust/crates/lean-ctx-workgraph#0.2.0",
+      "bom-ref": "path+file://./rust/crates/lean-ctx-workgraph#0.3.0",
       "description": "Bounded multi-agent work graph, budget cascade and outcome evaluation model for LeanCTX | OSS.",
       "externalReferences": [
         {
@@ -200,10 +200,10 @@
         }
       ],
       "name": "lean-ctx-workgraph",
-      "purl": "pkg:cargo/lean-ctx-workgraph@0.2.0?download_url=file://crates/lean-ctx-workgraph",
+      "purl": "pkg:cargo/lean-ctx-workgraph@0.3.0?download_url=file://crates/lean-ctx-workgraph",
       "scope": "required",
       "type": "library",
-      "version": "0.2.0"
+      "version": "0.3.0"
     },
     {
       "bom-ref": "path+file://./rust/crates/leanctx-native-storage#0.1.1",
@@ -16916,11 +16916,11 @@
         "path+file://./rust/crates/lean-ctx-compress#0.1.0",
         "path+file://./rust/crates/lean-ctx-doc#0.2.0",
         "path+file://./rust/crates/lean-ctx-fs#0.2.0",
-        "path+file://./rust/crates/lean-ctx-ocla#6.0.0",
+        "path+file://./rust/crates/lean-ctx-ocla#7.0.0",
         "path+file://./rust/crates/lean-ctx-patterns#0.1.0",
-        "path+file://./rust/crates/lean-ctx-protocol#0.6.0",
+        "path+file://./rust/crates/lean-ctx-protocol#0.7.0",
         "path+file://./rust/crates/lean-ctx-syntax#0.1.0",
-        "path+file://./rust/crates/lean-ctx-workgraph#0.2.0",
+        "path+file://./rust/crates/lean-ctx-workgraph#0.3.0",
         "path+file://./rust/crates/leanctx-native-storage#0.1.1",
         "registry+https://github.com/rust-lang/crates.io-index#libc@0.2.189",
         "registry+https://github.com/rust-lang/crates.io-index#libloading@0.8.9",
@@ -16977,7 +16977,7 @@
         "registry+https://github.com/rust-lang/crates.io-index#zip@9.0.5",
         "registry+https://github.com/rust-lang/crates.io-index#zstd@0.14.3"
       ],
-      "ref": "path+file://./rust#lean-ctx-engine@3.12.3"
+      "ref": "path+file://./rust#lean-ctx-engine@3.12.4"
     },
     {
       "dependsOn": [
@@ -17027,14 +17027,14 @@
         "registry+https://github.com/rust-lang/crates.io-index#blake3@1.8.6",
         "registry+https://github.com/rust-lang/crates.io-index#ed25519-dalek@2.2.0",
         "registry+https://github.com/rust-lang/crates.io-index#getrandom@0.4.3",
-        "path+file://./rust/crates/lean-ctx-protocol#0.6.0",
+        "path+file://./rust/crates/lean-ctx-protocol#0.7.0",
         "registry+https://github.com/rust-lang/crates.io-index#semver@1.0.28",
         "registry+https://github.com/rust-lang/crates.io-index#serde@1.0.229",
         "registry+https://github.com/rust-lang/crates.io-index#serde_json@1.0.151",
         "registry+https://github.com/rust-lang/crates.io-index#sha2@0.11.0",
         "registry+https://github.com/rust-lang/crates.io-index#thiserror@2.0.20"
       ],
-      "ref": "path+file://./rust/crates/lean-ctx-ocla#6.0.0"
+      "ref": "path+file://./rust/crates/lean-ctx-ocla#7.0.0"
     },
     {
       "dependsOn": [
@@ -17057,7 +17057,7 @@
         "registry+https://github.com/rust-lang/crates.io-index#serde_json@1.0.151",
         "registry+https://github.com/rust-lang/crates.io-index#sha2@0.11.0"
 
```

**File**: `THIRD_PARTY_NOTICES` (modified, +5/-5)
```diff
@@ -2,16 +2,16 @@
 Schema: leanctx.third-party-notices/v1
 Status: GENERATED AND APPROVED
 Content-Digest-Scope: SHA-256 of this file with the Content-Digest value zeroed
-Content-Digest: sha256:4a5fee5839343fcffba0b23ec686f31e15fa29ed6ad2a4d769f34076b8a66bff
+Content-Digest: sha256:34ade52836261ab9442d08e834c836746595985a214b739a0939b1148ea8d226
 Source inventory: rust/Cargo.lock + cargo metadata --locked --offline --all-features + SBOM.cdx.json + legal/third-party-assets.toml + packages/pi-lean-ctx/package-lock.json
 Generation command: cargo metadata --locked --offline --all-features --manifest-path rust/Cargo.toml --format-version 1
 Approval contract: legal/third-party-notices-approval.toml binds approved_content_sha256 to this file's exact SHA-256
-Cargo.lock SHA-256: 244406655444ce38a045358b0780179fe504634f075af30d8252e60e9fdd3e74
+Cargo.lock SHA-256: ee5d9e5ba2cedd3e2345074b40f0e29ceaf6b2f5c77663b53057ad148fb44475
 Cargo metadata inventory SHA-256: 7034b4be10f229be5a7a64b15e9aa88df642468dc286ab14c8f22840e8d7c9df
-SBOM.cdx.json SHA-256: a32ffd39a679765dec3231701a978dbc1eeaaba4fb1ffe48b4d71e0f0d6e9e0a
+SBOM.cdx.json SHA-256: d702d0d8eeca3baf404bc3191ad6bf5c159bf460f2e9e4e9e91b936e1b33a2cd
 SBOM components: 559
-Asset manifest SHA-256: d081cb4f7dfa2892dd6d8999be5dae00fc5b785dd40f81360a6fa4fe92abbd2a
-npm package-lock.json SHA-256: afae69f88fa3c76df4c3520744ec90fa507ae9f5f0fc2ec075183c3790cae1ef
+Asset manifest SHA-256: 4a17f7c4335e1bd1dc67fbbad3c4dfe9693c302a9312645ec72850ef49cd94e6
+npm package-lock.json SHA-256: 5eaa80ca72ed4df8d3022adfdb3af4c050b5f6c53ee8c3a3b3159ac63eb0d9ba
 Bundled MCP SDK: @modelcontextprotocol/sdk 1.32.1 (sha512-2DdE+SJDtzLEEWzY1ZjY7Q+VcPhcV1KisD3zI4u0XZyktsjHum1mwbMI+JaulUBi2OZk+KJAi2uPXzxichPkdw==)
 Cargo graph packages: 624
 Third-party Cargo packages: 601
```

**File**: `aur/lean-ctx/PKGBUILD` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 # Maintainer: Yves Gugger <yves@pounce.ch>
 pkgname=lean-ctx
-pkgver=3.12.2
+pkgver=3.12.3
 pkgrel=1
 pkgdesc="LeanCTX | OSS — open-source Context Gateway for AI Systems. Context selection, supported controls, and evidence through local integration paths."
 arch=('x86_64' 'aarch64')
@@ -12,7 +12,7 @@ makedepends=('cargo' 'gcc')
 # resolver finds it — no manual install, no runtime download.
 depends=('gcc-libs' 'onnxruntime')
 source=("$pkgname-$pkgver.tar.gz::https://github.com/yvgude/lean-ctx/releases/download/v$pkgver/lean-ctx-$pkgver-source.tar.gz")
-sha256sums=('2601b71bc2aae00fdc84b2c63479fa87ed5791342ae98a5da77e490e617eac4a')
+sha256sums=('0c6ba5f54555e2f6714ffe9705fedfb6144865834d56671869caba2c0a2dae95')
 
 prepare() {
   cd "$pkgname-$pkgver/rust"
```

**File**: `ci/gitlab-ci.yml` (modified, +148/-54)
```diff
@@ -190,7 +190,7 @@ ip-boundary-skill-installed:
     name: lean-ctx-ci-rust:65e3bbf776c5
     pull_policy: if-not-present
   # Python only: run on the small runner (2 CPU / 4 GB slots), so the job does
-  # not queue behind Rust builds for a 12-CPU slot.
+  # not queue behind Rust builds for a 6-CPU slot.
   tags: [light]
   timeout: 5 minutes
   interruptible: false
@@ -334,9 +334,15 @@ v4-runtime:
     # `target`: tests recognise build output by paths like /target/debug/deps.
     # It is the only compiler cache (W1-08: sccache is gone; the persistent
     # target already holds every unchanged crate).
-    CI_TARGET_DIR: "/builds/.ci-cache/$CI_PROJECT_PATH_SLUG/target"
-    # A target over this size (GiB) is wiped at job start.
-    CI_TARGET_CAP_GB: "40"
+    # One target per concurrent build directory of a runner, keyed like the
+    # runner's own /builds/<short token>/<concurrent id> (11.11., p5 jobs
+    # 32317/32318/32345: jobs in /builds/<token>/1 and /2 built into one
+    # target, and one job's cargo replaced or removed the other's test
+    # binaries mid-run).
+    CI_TARGET_DIR: "/builds/.ci-cache/$CI_PROJECT_PATH_SLUG/slot-$CI_RUNNER_SHORT_TOKEN-$CI_CONCURRENT_PROJECT_ID/target"
+    # A target over this size (GiB) is wiped at job start. Per slot: with
+    # about six slots on the host, 30 keeps the worst case near 180 GiB.
+    CI_TARGET_CAP_GB: "30"
     # Warm build farm (W4-04, scripts/ci/warm_farm.py). The runner mounts the
     # root-owned host directory /srv/ci-cache/warm-farm here. A green
     # protected post-merge run publishes its target (incremental data
@@ -352,8 +358,9 @@ v4-runtime:
     # Incremental compilation of the workspace crates into the slot's
     # persistent target (W1-08): a change recompiles only what it touched.
     CARGO_INCREMENTAL: "1"
-    # The runner gives each job a 12-CPU / 20-GiB cgroup (all jobs share the
-    # host's 24-CPU / 64-GiB CI slice); more jobs than CPUs gain nothing. The
+    # The runner gives each job a cgroup of 6 CPUs (cpu.max 600000/100000, as
+    # mr-quick prints it, 12.11.); all jobs share the host's 24-CPU / 64-GiB CI
+    # slice. 12 jobs exceed the quota and the cgroup throttles the excess. The
     # two ~9-GiB engine rustc (lib, lib test) dominate and fit side by side.
     CARGO_BUILD_JOBS: "12"
     CARGO_PROFILE_DEV_DEBUG: line-tables-only
@@ -380,7 +387,7 @@ v4-runtime:
     # The image carries every tool; nothing is installed at job time. The
     # resolved compiler version is recorded with the evidence.
     - |
-      for ci_tool in git python3 cmake clang mold node npm useradd runuser cargo-clippy cargo-nextest rustfmt; do
+      for ci_tool in git python3 cmake clang mold node npm useradd runuser flock cargo-clippy cargo-nextest rustfmt; do
         command -v "$ci_tool" >/dev/null || { echo "CI image lacks $ci_tool" >&2; exit 1; }
       done
     - |
@@ -440,101 +447,168 @@ v4-runtime:
       # swap the target for a link nor forge the stamp beside it; the target
       # belongs to ci-runner. Nothing here follows a symlink. Toolchain or
       # image changes and targets over CI_TARGET_CAP_GB start fresh.
+      # Each concurrent build directory has its own target (CI_TARGET_DIR).
+      # Should two jobs ever share one (11.11., p5 jobs 32317/32318/32321: a
+      # wipe deleted a running job's test binaries and du failed on files
+      # another job removed), each holds a shared lock on target.lock (fd 9)
+      # until the job ends; only a job that gets the lock exclusively without
+      # waiting (fd 8) wipes or cleans up. A busy slot keeps its target.
       test "${CI_BUILDS_DIR:-}" = /builds || { echo "target: unexpected CI_BUILDS_DIR" >&2; exit 1; }
       case "${CI_PROJECT_PATH_SLUG:-}" in ''|*[!a-z0-9-]*) echo "target: unexpected CI_PROJECT_PATH_SLUG" >&2; exit 1;; esac
       case "${CI_TARGET_CAP_GB:-}" in ''|*[!0-9]*) echo "target: unexpected CI_TARGET_CAP_GB" >&2; exit 1;; esac
-      ci_target_parent="/builds/.ci-cache/$CI_PROJECT_PATH_SLUG"
+      case "${CI_RUNNER_SHORT_TOKEN:-}" in ''|*[!A-Za-z0-9_-]*) echo "target: unexpected CI_RUNNER_SHORT_TOKEN" >&2; exit 1;; esac
+      case "${CI_CONCURRENT_PROJECT_ID:-}" in ''|*[!0-9]*) echo "target: unexpected CI_CONCURRENT_PROJECT_ID" >&2; exit 1;; esac
+      ci_target_parent="/builds/.ci-cache/$CI_PROJECT_PATH_SLUG/slot-$CI_RUNNER_SHORT_TOKEN-$CI_CONCURRENT_PROJECT_ID"
       ci_target="$ci_target_parent/target"
       test "${CI_TARGET_DIR:-}" = "$ci_target" || { echo "target: unexpected CI_TARGET_DIR" >&2; exit 1; }
       case "$ci_target/" in "$CI_PROJECT_DIR"/*) echo "target: inside the checkout" >&2; exit 1;; esac
+      case "${CI_JOB_ID:-}" in ''|*[!0-9]*) echo "target: unexpected CI_JOB_ID" >&2; exit 1;; esac
       if test -L /builds; then echo "target: /builds is a symlink" >&2; exit 1; fi
-      for ci_dir in /builds/.ci-cache "$ci_target_parent"; do
+      for ci_dir in /builds/.ci-cache "/builds/.ci-cache/$CI_PROJECT_PATH_SLUG" "$
```

**File**: `docs/reference/generated/config-keys.md` (modified, +8/-0)
```diff
@@ -214,6 +214,12 @@ MCP decision-loop runtime settings
 - `enabled` (bool, default `true`) — Enable the MCP decision-loop runtime
 - `max_filter_level` (u8, default `0`) — Maximum lossy post-dispatch triage level (0 disables output filtering)
 
+## `[decisions]`
+
+Decision layer (.leanctx/decisions/*.toml): pre-edit check mode
+
+- `enforce` (string, default `hint`) — Pre-edit check of .leanctx/decisions: hint (report), refuse (strict: edit not written), off
+
 ## `[embedding]`
 
 Semantic-embedding engine settings (model selection for ctx_search action=semantic)
@@ -275,6 +281,8 @@ LeanCTX | Hive: workspace knowledge, policies and the shared agent bus.
 - `bus` (string: auto | off, default `auto`) — Relay the agent bus through Hive (auto) or keep it local (off).
 - `enabled` (bool, default `null`) — Pause all Hive traffic with false; unset means on while this machine is connected.
 - `metrics_upload` (bool, default `true`) — Send hourly instance metrics to Hive (counts only, including full re-fetches and unregulated program names; never content).
+- `models_anthropic_agents` (bool, default `false`) — Let Anthropic-shaped agents reach the subscription models through shape-xlat routing aliases; false means OpenAI-shaped agents only. Owner question Q3 is open: true takes effect only once it is decided.
+- `models_url` (string, default `null`) — Origin of the Hive models gateway for the leanctx provider; unset means https://models.<hive host>. Only the Hive host or a direct subdomain of it is honoured.
 - `pull_interval_minutes` (integer, default `5`) — Minutes between Hive sync passes (1-60; values outside are clamped).
 - `queen_identity` (string: warn | enforce, default `warn` — env `LEAN_CTX_HIVE_QUEEN_IDENTITY`) — A bus sender presenting as the Queen that is no registered Queen session: warn (pass, log in bus/queen-warnings.json, mark for the receiver) or enforce (refuse); any other value counts as enforce. Enforce only once queen-sessions.json lists every Queen session.
 - `receipts_upload` (bool, default `true`) — Upload context receipts to Hive.
```

---

### Incident Patch 2: `7476f371` (2026-11-12)
**Commit Message**: Release 3.12.4

Release 3.12.4 export (private source b7ef2ff147, integration/3.12.3). Supersedes #2241.

- **Security:** six fixes. Five were reported by @dkiaulakis: the agent shell state gate (redirections, subshells and groups, the working directory and values built at run time, read-only git subcommands) and context admission (the detector and the redactor now judge the same operand). One was reported by @kasparovabi: memory compaction, context bundles, rule exports and the artifact registry no longer write through a symlink. Details are in `CHANGELOG.md` under `[3.12.4]`.
- **Added:**
  - Policy enforcement acknowledged to Hive (D4).
  - The ECCP change classifier and envelope.
  - Audit entries v2.
  - Managed configuration for MDM-provisioned machines.
  - Unit claims: `ctx_patch` and `ctx_edit` warn when another agent holds a claim on the code they change.
- **Fixed:**
  - The PowerShell verb-prefix check no longer panics the shell gate on a multi-byte character.
  - #2240: the cockpit's proof clock no longer pins a core per session. `lean-ctx value` streams the audit trail and the savings ledger (on a 2.3 GB trail: 18.5 s / 2.2 GB RSS → 1.7 s / 19 MB, same result). The co

**File**: `CHANGELOG.md` (modified, +125/-0)
```diff
@@ -6,6 +6,8 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
 
 ## [Unreleased]
 
+## [3.12.4] — 2026-11-12
+
 ### Added
 
 - **Policy enforcement acknowledged to Hive (D4).** The bus hello now names the features
@@ -18,6 +20,129 @@ Current positioning: [LeanCTX Engine — Context Gateway for AI Systems](docs/PO
   `policy.sessions` adds `installed.enforcement` (`applied_version`, `acknowledged_at`,
   `sessions`, `reported_at`), additively.
 
+- **ECCP L/I/G change classifier (task 156).** `scripts/change-class <base> <head>`
+  prints `L` (no public Rust item changed), `I` (public items only added) or `G`
+  (public item changed or removed, Cargo features or dependency tables,
+  `Cargo.lock`, `build.rs`, Cargo config, toolchain pin, CI configuration or a
+  generated registry) from the git objects alone, without a build or network,
+  and serves as `$ECCP_CLASSIFIER` for `scripts/eccp-envelope`.
+
+- **ECCP change envelope in git notes (task 157).** `scripts/eccp-envelope` writes,
+  shows and verifies a `leanctx.change-envelope/v1` JSON note under
+  `refs/notes/eccp` on a merge request head: intent, base, class, read set,
+  derivations and check evidence (`docs/contracts/change-envelope-v1.md`).
+
+- **Audit entries v2 bind each tool call to its session (ent3-1).** Every new
+  audit-trail entry carries `v: 2` and a chained `v2_hash` over its timestamp
+  and, for a call of an MCP session, the `session_id`, a per-session `seq`,
+  the decision and an output digest, so an edited timestamp, seq or fact fails
+  `verify_chain` and `verify_chain_full` at that entry. Input and output digests
+  are HMAC-SHA256 under the engine-local key (`hive/receipts.hmac-key`, never
+  uploaded). The v1 `entry_hash` is unchanged: older engines and
+  `leanctx-verify` still verify a mixed trail, and an entry of a newer version
+  counts as forward-compatible, not as tampering.
+
+- **Managed configuration for MDM-provisioned machines (task 169).** An organisation can
+  preconfigure an Instance through a macOS configuration profile, the Windows policy key
+  `HKLM\SOFTWARE\Policies\LeanCTX\Managed` or `/etc/lean-ctx/managed.toml`
+  (`leanctx.managed-config/v1`, `docs/contracts/managed-config-v1.md`). Managed
+  `hive.url` and `hive.root_key` win over `[hive]` and `config set` on them is refused;
+  `hive.org` refuses an enrollment for another org; `hive.require` makes tools refuse
+  until the machine is signed in and has a policy floor. A carrier that is malformed,
+  a symlink, or not root-owned (it or its directory) fails closed; it is checked and
+  read through one open handle. `hive status` and the cockpit `hive status --json`
+  (`managed`, since 1.7) show the carrier and each member.
+
+- **Unit claims warn before two agents edit the same code.** A `ctx_patch` or `ctx_edit`
+  write claims the functions, types and Markdown sections it touches for the editing agent
+  (10-minute lease, renewed on each edit). When another agent holds a claim on a touched
+  unit, the write goes ahead and the result names the holder (`LEAN_CTX_CLAIM_MODE=warn`,
+  the default). `strict` refuses the write before anything is written, and `off` turns the
+  check off. `ctx_agent action=claims` lists the live claims. `action=plan_claims` plans a
+  task against them, through an optional local planner (`LEAN_CTX_CLAIM_PLANNER`) or a
+  built-in fallback without network, and claims the free units. Claims are released when
+  the agent reports `status=finished` and when the server shuts down.
+
+### Security
+
+The first five fixes below were reported by @dkiaulakis.
+
+- **A redirection written another way cannot write past the gate (GHSA-4gm5-2mgw-9r9r).** A
+  redirection with a file-descriptor prefix, an `&>`/`>|`/`<>` operator, a quoted or escaped
+  target, or no space before its target was missed, so an agent shell could write lean-ctx's
+  own state or an unlisted file. The gate now reads every redirection in its canonical form
+  before any other check.
+
+- **A command inside `( … )` or `{ …; }` is checked like any other (GHSA-9jrf-q94p-frhr).** A
+  subshell or group was one segment to the gate, whose first word (`(eval`, `(rm`) matched no
+  rule, and a redirection after the group was dropped. Every group is now opened into its
+  commands for the checks, and a redirection after it is checked too; a command in a `case`
+  arm or after `then`, `do`, `else` or `coproc` is judged as its own command. The line that
+  runs is unchanged.
+
+- **The state guard follows the working directory and the values a line builds
+  (GHSA-cfmv-qg29-3rvp).** Repeated or conditional `cd ..`, a `cd` in a loop, function or trap,
+  `CDPATH`/`HOME`/`OLDPWD` assignments, variables assigned or read at run time (also
+  `${d:=…}` and `set --` arguments, also inside a longer word), the shell's own
+  `$PWD`/`$OLDPWD`/`$_` and `~+`/`~-`/`~N`, brace and parameter expansions, function
+  arguments, `alias` bodies, `GIT_DIR`-
```

**File**: `PUBLIC-EXPORT-RECEIPT.json` (modified, +663/-411)
```diff
@@ -331,11 +331,11 @@
    "size": 1033
   },
   {
-   "blob": "c64f0b1ac0eaa0e6f40489cf23046d142a60a727",
+   "blob": "1516a1ee651df535b86515a6d72266efad671428",
    "mode": "100644",
    "path": "CHANGELOG.md",
-   "sha256": "5f708d8498443961ea47028c9f12422c8df16b792b63df46c30f1f1ca1db4f8f",
-   "size": 1272010
+   "sha256": "b21ed364e667e4239709a8a01a0d04688b0f3784571a5001a8823b23f5f05514",
+   "size": 1280635
   },
   {
    "blob": "77a7c7a520af8fc8b4df372eb5bd5fddcefbfecf",
@@ -436,11 +436,11 @@
    "size": 525
   },
   {
-   "blob": "5ea3b6397ca88514f5ab94d0848164921d0ce4cc",
+   "blob": "3cd05e74c413de624925a3fc8c5f0a27e0c76b86",
    "mode": "100644",
    "path": "PUBLISH_MANIFEST.toml",
-   "sha256": "ec6665ab41d39d72cd40d9db1abea9461cb723d6dff6ba9a9237729ea520b8ce",
-   "size": 310499
+   "sha256": "7392d39258c40018285ae618f4ed3a14f7c5358109fb89ec6adb34c52311935a",
+   "size": 312964
   },
   {
    "blob": "b50ec9ee68e230777b65ff932e22735417a8e540",
@@ -450,10 +450,10 @@
    "size": 38306
   },
   {
-   "blob": "79c8d5f64ce9040787790be6d7af987644efac54",
+   "blob": "90cdc9b4223cbe89ea594c2afae3478fb370c776",
    "mode": "100644",
    "path": "SBOM.cdx.json",
-   "sha256": "a32ffd39a679765dec3231701a978dbc1eeaaba4fb1ffe48b4d71e0f0d6e9e0a",
+   "sha256": "d702d0d8eeca3baf404bc3191ad6bf5c159bf460f2e9e4e9e91b936e1b33a2cd",
    "size": 689556
   },
   {
@@ -464,10 +464,10 @@
    "size": 32425
   },
   {
-   "blob": "b2b8efcc513cd0a0ab69410b047eb7a94f1c5c54",
+   "blob": "97a8bfd612479e9df3c40f4c1d3284de52b4c7c5",
    "mode": "100644",
    "path": "THIRD_PARTY_NOTICES",
-   "sha256": "c7ab236b6d058ed5b2c598e6ba1e749faa2087221c2b3a514b4937e7f231e5ac",
+   "sha256": "d3d27f494df715682fd7306fbf9a60f49fc99b87f1e95c929c25c09867bd9074",
    "size": 331754
   },
   {
@@ -513,10 +513,10 @@
    "size": 593
   },
   {
-   "blob": "99ea4539c31f8772ad014df1a6350d98c4b8c5f2",
+   "blob": "bc0d0484a42c163ee07dc5c0b7e853fbd4968739",
    "mode": "100644",
    "path": "aur/lean-ctx/PKGBUILD",
-   "sha256": "6ccda55f6860646b3c94bd0601eac844d9542f1abae1d9efd06faaa0019ba265",
+   "sha256": "721a41ab8854f5785cd63e1519f76ba526975580aae109fcce42ad3aa3a6e38d",
    "size": 2096
   },
   {
@@ -527,11 +527,11 @@
    "size": 6789
   },
   {
-   "blob": "e735e77f234e947a9bc6715383f814634a45ff9b",
+   "blob": "3bf3d255849fe76b9a95099510d9940099118f70",
    "mode": "100644",
    "path": "ci/gitlab-ci.yml",
-   "sha256": "da2e8500337f3bf1d2e9574823e59ab48be589a461f418b46cdc560400a10e8c",
-   "size": 53224
+   "sha256": "bc10f112e6b5228694c78f8bd23e5da91253fdb5263ea7b5697c1bccb4835c35",
+   "size": 60637
   },
   {
    "blob": "102f24e836104cc226bf24b5a5ce582ec184eb39",
@@ -3264,11 +3264,11 @@
    "size": 8690
   },
   {
-   "blob": "437206a949df05418ba4568f9ccf5a9c33990aa1",
+   "blob": "d99134e5d44f81033ce5c8f6c1c1c786a99d1127",
    "mode": "100644",
    "path": "docs/reference/generated/config-keys.md",
-   "sha256": "f6cdc32b8dd13845923e5c14ca1853d0128e1a3f87ab35154ffdc0a0c6c8ba54",
-   "size": 72058
+   "sha256": "5e431aad9867b6e9e06e0e77d884dca22ea8e68efaa5259718505a241361fa6b",
+   "size": 72738
   },
   {
    "blob": "e13f846428672699c0599c3951fce4ad25fbe648",
@@ -3278,11 +3278,11 @@
    "size": 5512
   },
   {
-   "blob": "13db6570848b81860092c6473bd99acb9a4ab22c",
+   "blob": "dd0dd6f74c89aa1f5c3818dc22e92138afce860c",
    "mode": "100644",
    "path": "docs/reference/generated/mcp-tools.md",
-   "sha256": "2107f1f7ab9af2e0bf7da6535e49af938ab3a20466b325dc233b6d94f9098291",
-   "size": 23420
+   "sha256": "08f517964b066fe064d85e75eb2dbac701a88be19c4f2763607c5c37035f65bd",
+   "size": 23520
   },
   {
    "blob": "392dce35ae93180bf5953b4e7e77f2d56a3102be",
@@ -3656,11 +3656,11 @@
    "size": 9354
   },
   {
-   "blob": "d45801744365bff4f74744692821e317b0295b38",
+   "blob": "019df3bb674de25b71c9b37084c2647f14bb6b21",
    "mode": "100644",
    "path": "integrations/claude-code-mod/hooks/cockpit.tsx",
-   "sha256": "7705784f31ecdb0bf0c6872a22d76d392af2410836897945afff896af54f0a5c",
-   "size": 64696
+   "sha256": "d71bf5f35d9a94030b3ddc500fc375c3734697fc81858e340bd62922925c31d8",
+   "size": 65938
   },
   {
    "blob": "9f45101460f1aad4ec66b7747876b8a64c40c739",
@@ -3691,11 +3691,11 @@
    "size": 35330
   },
   {
-   "blob": "c727b23ee499d95d9566bf06af867132d9077e39",
+   "blob": "e4b9cecdd08f780eb5079f42a49543928a38f2b9",
    "mode": "100644",
    "path": "integrations/claude-code-mod/tests/cockpit.test.tsx",
-   "sha256": "c360f62b14ad315d10700e8796cc7081fecc2052e7e21d17413fc575224cbe39",
-   "size": 4334
+   "sha256": "40d311e3823abae9c251d1a4cf04f53beb8009a7bb163664e48c90b2d34dcd81",
+   "size": 6809
   },
   {
    "blob": "770c0e5660f09fa6175f5a67d6352cca1ff6f101",
@@ -4006,18 +4006,18 @@
    "size": 193663
   },
   {
-   "blob": "9ef0440b7a4cacbd751127a77909c28aea8db8f5",
+   "blob": "bee3e7eac086bf2cd7ce0edb6066478fd71e5914",
    "mode": "100644",
    "path": "legal/third-party-assets.toml",
-   "sha256": "d081cb4f7dfa289
```

**File**: `PUBLISH_MANIFEST.toml` (modified, +48/-0)
```diff
@@ -345,6 +345,8 @@ new_paths = [
   "rust/src/core/context_admission/cross_line.rs",
   "rust/src/core/context_admission/egress_api_tests.rs",
   "rust/src/core/context_admission/egress_walk.rs",
+  # GHSA-xmx8-69qv-7f86 regression tests: Apache-2.0, own work.
+  "rust/src/core/context_admission/operand_tests.rs",
   "rust/src/core/context_admission/origin.rs",
   "rust/src/core/context_admission/receipt_store/anchors.rs",
   "rust/src/core/context_admission/receipt_store/capacity.rs",
@@ -395,6 +397,7 @@ new_paths = [
   "rust/src/shell/containment/starter.rs",
   "rust/src/shell/containment/tests.rs",
   "rust/src/shell/containment/wire.rs",
+  "scripts/ci/postmerge_bisect.py",
   "scripts/eccp-envelope",
   "scripts/agent_tools_compatibility.py",
   "scripts/check-capabilities.py",
@@ -408,6 +411,7 @@ new_paths = [
   "rust/crates/lean-ctx-server/tests/main.rs",
   "rust/crates/lean-ctx-protocol/tests/main.rs",
   "scripts/check-local-free.py",
+  "scripts/tests/test_postmerge_bisect.py",
   "tests/delivery/test_check_local_free.py",
   "tests/hive-e2e/lifecycle.cjs",
   "tests/hive-e2e/lifecycle.sh",
@@ -430,6 +434,14 @@ new_paths = [
   "scripts/scan-release-artifacts.py",
   "scripts/source-export-manifest.py",
   "scripts/sync-capabilities.py",
+  # W3-08 deterministic checkers: own code, Apache-2.0 SPDX-headed.
+  "scripts/mutants-changed",
+  "scripts/tests/test_mutants_changed.py",
+  "rust/crates/lean-ctx-shell-policy/tests/proptest_tokenizer.rs",
+  "rust/fuzz/.gitignore",
+  "rust/fuzz/Cargo.toml",
+  "rust/fuzz/README.md",
+  "rust/fuzz/fuzz_targets/shell_tokenizer.rs",
   # ECCP W1b-02 change classifier (task 156): own code, Apache-2.0 SPDX-headed.
   "scripts/change-class",
   "scripts/tests/test_change_class.py",
@@ -1337,6 +1349,7 @@ new_paths = [
   "rust/crates/lean-ctx-hive/src/metrics_v2/tests.rs",
   "rust/crates/lean-ctx-hive/src/metrics_v2/upload.rs",
   "rust/crates/lean-ctx-hive/src/migrate.rs",
+  "rust/crates/lean-ctx-hive/src/models_access.rs",
   "rust/crates/lean-ctx-hive/src/migrate_tests.rs",
   "rust/crates/lean-ctx-hive/src/policy_tests.rs",
   "rust/crates/lean-ctx-hive/src/receipts_tests.rs",
@@ -1378,6 +1391,7 @@ new_paths = [
   "rust/crates/lean-ctx-hive/src/throttle_tests.rs",
   "rust/src/core/untrusted.rs",
   "rust/src/core/hive_gate.rs",
+  "rust/src/core/hive_models.rs",
   "rust/src/core/config/hive.rs",
   "rust/src/core/engine_interface/receipt_sink.rs",
   "rust/crates/lean-ctx-hive/src/vault.rs",
@@ -1407,6 +1421,10 @@ new_paths = [
   "rust/crates/lean-ctx-shell-policy/src/tests_ps_quotes.rs",
   "rust/crates/lean-ctx-shell-policy/src/tests_ps_escapes.rs",
   "rust/crates/lean-ctx-shell-policy/src/redaction_marker.rs",
+  # 3.12.4 shell-gate advisories (GHSA-4gm5/9jrf/cfmv/fv44).
+  "rust/crates/lean-ctx-shell-policy/src/groups.rs",
+  "rust/crates/lean-ctx-shell-policy/src/redirections.rs",
+  "rust/crates/lean-ctx-shell-policy/src/tests_ghsa_3124.rs",
   "rust/crates/lean-ctx-server/tests/agent_wait_roundtrip.rs",
   "rust/tests/suite/hive_fake_wire_conformance.rs",
   "scripts/sync-hive-c0.sh",
@@ -1859,6 +1877,7 @@ new_paths = [
   "rust/crates/lean-ctx/src/cli/migrate_legacy.rs",
   "rust/crates/lean-ctx/src/cli/mod.rs",
   "rust/crates/lean-ctx/src/cli/model_cmd.rs",
+  "rust/crates/lean-ctx/src/cli/models_cmd.rs",
   "rust/crates/lean-ctx/src/cli/ocla_cmd.rs",
   "rust/crates/lean-ctx/src/cli/output_savings_cmd.rs",
   "rust/crates/lean-ctx/src/cli/overview_cmd.rs",
@@ -2073,6 +2092,8 @@ new_paths = [
   "rust/src/core/mcp_roots/derive.rs",
   "rust/src/core/policy/audit_filter.rs",
   "rust/src/core/read_mode.rs",
+  # redaction.rs tests moved into their own file (LOC gate): Apache-2.0, own work.
+  "rust/src/core/redaction/tests.rs",
   "rust/src/core/reference_store.rs",
   "rust/src/core/reference_store/tests.rs",
   "rust/src/core/rooted_read.rs",
@@ -2159,6 +2180,7 @@ new_paths = [
   "rust/crates/lean-ctx-proxy/src/integration_tests.rs",
   "rust/crates/lean-ctx-proxy/src/intent.rs",
   "rust/crates/lean-ctx-proxy/src/introspect.rs",
+  "rust/crates/lean-ctx-proxy/src/leanctx_provider.rs",
   "rust/crates/lean-ctx-proxy/src/lib.rs",
   "rust/crates/lean-ctx-proxy/src/lineage.rs",
   "rust/crates/lean-ctx-proxy/src/live_zone.rs",
@@ -2672,6 +2694,7 @@ new_paths = [
   "rust/crates/lean-ctx-hooks/src/hook_handlers/tests_search_rewrites.rs",
   "rust/crates/lean-ctx-hooks/src/hook_handlers/value_recap.rs",
   "rust/crates/lean-ctx-hooks/src/hook_handlers/vibe.rs",
+  "rust/crates/lean-ctx-hooks/src/hook_handlers/write_guard.rs",
   "rust/crates/lean-ctx-hooks/src/hooks/agents/amp.rs",
   "rust/crates/lean-ctx-hooks/src/hooks/agents/antigravity.rs",
   "rust/crates/lean-ctx-hooks/src/hooks/agents/claude.rs",
@@ -2730,6 +2753,15 @@ new_paths = [
   "rust/src/ipc/detached.rs",
   "rust/src/ipc/process/services.rs",
   "rust/src/ipc/process/tests.rs",
+  # mz6/mz14 T4: model origin/host-country enforcement. Own code, Apache-2.0;
+  # the catalog d
```

**File**: `SBOM.cdx.json` (modified, +26/-26)
```diff
@@ -94,7 +94,7 @@
       "version": "0.2.0"
     },
     {
-      "bom-ref": "path+file://./rust/crates/lean-ctx-ocla#6.0.0",
+      "bom-ref": "path+file://./rust/crates/lean-ctx-ocla#7.0.0",
       "description": "Open Context & Token Lifecycle Architecture \u2014 the provider-neutral contract boundary (capability traits, canonical types, token envelopes) shared between lean-ctx-core (OSS) and lean-ctx-enterprise (proprietary).",
       "externalReferences": [
         {
@@ -108,10 +108,10 @@
         }
       ],
       "name": "lean-ctx-ocla",
-      "purl": "pkg:cargo/lean-ctx-ocla@6.0.0?download_url=file://crates/lean-ctx-ocla",
+      "purl": "pkg:cargo/lean-ctx-ocla@7.0.0?download_url=file://crates/lean-ctx-ocla",
       "scope": "required",
       "type": "library",
-      "version": "6.0.0"
+      "version": "7.0.0"
     },
     {
       "bom-ref": "path+file://./rust/crates/lean-ctx-patterns#0.1.0",
@@ -138,7 +138,7 @@
       "version": "0.1.0"
     },
     {
-      "bom-ref": "path+file://./rust/crates/lean-ctx-protocol#0.6.0",
+      "bom-ref": "path+file://./rust/crates/lean-ctx-protocol#0.7.0",
       "description": "Open wire contracts for lean-ctx: events, observations, assignments, evidence gaps.",
       "externalReferences": [
         {
@@ -152,10 +152,10 @@
         }
       ],
       "name": "lean-ctx-protocol",
-      "purl": "pkg:cargo/lean-ctx-protocol@0.6.0?download_url=file://crates/lean-ctx-protocol",
+      "purl": "pkg:cargo/lean-ctx-protocol@0.7.0?download_url=file://crates/lean-ctx-protocol",
       "scope": "required",
       "type": "library",
-      "version": "0.6.0"
+      "version": "0.7.0"
     },
     {
       "bom-ref": "path+file://./rust/crates/lean-ctx-syntax#0.1.0",
@@ -182,7 +182,7 @@
       "version": "0.1.0"
     },
     {
-      "bom-ref": "path+file://./rust/crates/lean-ctx-workgraph#0.2.0",
+      "bom-ref": "path+file://./rust/crates/lean-ctx-workgraph#0.3.0",
       "description": "Bounded multi-agent work graph, budget cascade and outcome evaluation model for LeanCTX | OSS.",
       "externalReferences": [
         {
@@ -200,10 +200,10 @@
         }
       ],
       "name": "lean-ctx-workgraph",
-      "purl": "pkg:cargo/lean-ctx-workgraph@0.2.0?download_url=file://crates/lean-ctx-workgraph",
+      "purl": "pkg:cargo/lean-ctx-workgraph@0.3.0?download_url=file://crates/lean-ctx-workgraph",
       "scope": "required",
       "type": "library",
-      "version": "0.2.0"
+      "version": "0.3.0"
     },
     {
       "bom-ref": "path+file://./rust/crates/leanctx-native-storage#0.1.1",
@@ -16916,11 +16916,11 @@
         "path+file://./rust/crates/lean-ctx-compress#0.1.0",
         "path+file://./rust/crates/lean-ctx-doc#0.2.0",
         "path+file://./rust/crates/lean-ctx-fs#0.2.0",
-        "path+file://./rust/crates/lean-ctx-ocla#6.0.0",
+        "path+file://./rust/crates/lean-ctx-ocla#7.0.0",
         "path+file://./rust/crates/lean-ctx-patterns#0.1.0",
-        "path+file://./rust/crates/lean-ctx-protocol#0.6.0",
+        "path+file://./rust/crates/lean-ctx-protocol#0.7.0",
         "path+file://./rust/crates/lean-ctx-syntax#0.1.0",
-        "path+file://./rust/crates/lean-ctx-workgraph#0.2.0",
+        "path+file://./rust/crates/lean-ctx-workgraph#0.3.0",
         "path+file://./rust/crates/leanctx-native-storage#0.1.1",
         "registry+https://github.com/rust-lang/crates.io-index#libc@0.2.189",
         "registry+https://github.com/rust-lang/crates.io-index#libloading@0.8.9",
@@ -16977,7 +16977,7 @@
         "registry+https://github.com/rust-lang/crates.io-index#zip@9.0.5",
         "registry+https://github.com/rust-lang/crates.io-index#zstd@0.14.3"
       ],
-      "ref": "path+file://./rust#lean-ctx-engine@3.12.3"
+      "ref": "path+file://./rust#lean-ctx-engine@3.12.4"
     },
     {
       "dependsOn": [
@@ -17027,14 +17027,14 @@
         "registry+https://github.com/rust-lang/crates.io-index#blake3@1.8.6",
         "registry+https://github.com/rust-lang/crates.io-index#ed25519-dalek@2.2.0",
         "registry+https://github.com/rust-lang/crates.io-index#getrandom@0.4.3",
-        "path+file://./rust/crates/lean-ctx-protocol#0.6.0",
+        "path+file://./rust/crates/lean-ctx-protocol#0.7.0",
         "registry+https://github.com/rust-lang/crates.io-index#semver@1.0.28",
         "registry+https://github.com/rust-lang/crates.io-index#serde@1.0.229",
         "registry+https://github.com/rust-lang/crates.io-index#serde_json@1.0.151",
         "registry+https://github.com/rust-lang/crates.io-index#sha2@0.11.0",
         "registry+https://github.com/rust-lang/crates.io-index#thiserror@2.0.20"
       ],
-      "ref": "path+file://./rust/crates/lean-ctx-ocla#6.0.0"
+      "ref": "path+file://./rust/crates/lean-ctx-ocla#7.0.0"
     },
     {
       "dependsOn": [
@@ -17057,7 +17057,7 @@
         "registry+https://github.com/rust-lang/crates.io-index#serde_json@1.0.151",
         "registry+https://github.com/rust-lang/crates.io-index#sha2@0.11.0"
 
```

**File**: `THIRD_PARTY_NOTICES` (modified, +5/-5)
```diff
@@ -2,16 +2,16 @@
 Schema: leanctx.third-party-notices/v1
 Status: GENERATED AND APPROVED
 Content-Digest-Scope: SHA-256 of this file with the Content-Digest value zeroed
-Content-Digest: sha256:4a5fee5839343fcffba0b23ec686f31e15fa29ed6ad2a4d769f34076b8a66bff
+Content-Digest: sha256:34ade52836261ab9442d08e834c836746595985a214b739a0939b1148ea8d226
 Source inventory: rust/Cargo.lock + cargo metadata --locked --offline --all-features + SBOM.cdx.json + legal/third-party-assets.toml + packages/pi-lean-ctx/package-lock.json
 Generation command: cargo metadata --locked --offline --all-features --manifest-path rust/Cargo.toml --format-version 1
 Approval contract: legal/third-party-notices-approval.toml binds approved_content_sha256 to this file's exact SHA-256
-Cargo.lock SHA-256: 244406655444ce38a045358b0780179fe504634f075af30d8252e60e9fdd3e74
+Cargo.lock SHA-256: ee5d9e5ba2cedd3e2345074b40f0e29ceaf6b2f5c77663b53057ad148fb44475
 Cargo metadata inventory SHA-256: 7034b4be10f229be5a7a64b15e9aa88df642468dc286ab14c8f22840e8d7c9df
-SBOM.cdx.json SHA-256: a32ffd39a679765dec3231701a978dbc1eeaaba4fb1ffe48b4d71e0f0d6e9e0a
+SBOM.cdx.json SHA-256: d702d0d8eeca3baf404bc3191ad6bf5c159bf460f2e9e4e9e91b936e1b33a2cd
 SBOM components: 559
-Asset manifest SHA-256: d081cb4f7dfa2892dd6d8999be5dae00fc5b785dd40f81360a6fa4fe92abbd2a
-npm package-lock.json SHA-256: afae69f88fa3c76df4c3520744ec90fa507ae9f5f0fc2ec075183c3790cae1ef
+Asset manifest SHA-256: 4a17f7c4335e1bd1dc67fbbad3c4dfe9693c302a9312645ec72850ef49cd94e6
+npm package-lock.json SHA-256: 5eaa80ca72ed4df8d3022adfdb3af4c050b5f6c53ee8c3a3b3159ac63eb0d9ba
 Bundled MCP SDK: @modelcontextprotocol/sdk 1.32.1 (sha512-2DdE+SJDtzLEEWzY1ZjY7Q+VcPhcV1KisD3zI4u0XZyktsjHum1mwbMI+JaulUBi2OZk+KJAi2uPXzxichPkdw==)
 Cargo graph packages: 624
 Third-party Cargo packages: 601
```

**File**: `aur/lean-ctx/PKGBUILD` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 # Maintainer: Yves Gugger <yves@pounce.ch>
 pkgname=lean-ctx
-pkgver=3.12.2
+pkgver=3.12.3
 pkgrel=1
 pkgdesc="LeanCTX | OSS — open-source Context Gateway for AI Systems. Context selection, supported controls, and evidence through local integration paths."
 arch=('x86_64' 'aarch64')
@@ -12,7 +12,7 @@ makedepends=('cargo' 'gcc')
 # resolver finds it — no manual install, no runtime download.
 depends=('gcc-libs' 'onnxruntime')
 source=("$pkgname-$pkgver.tar.gz::https://github.com/yvgude/lean-ctx/releases/download/v$pkgver/lean-ctx-$pkgver-source.tar.gz")
-sha256sums=('2601b71bc2aae00fdc84b2c63479fa87ed5791342ae98a5da77e490e617eac4a')
+sha256sums=('0c6ba5f54555e2f6714ffe9705fedfb6144865834d56671869caba2c0a2dae95')
 
 prepare() {
   cd "$pkgname-$pkgver/rust"
```

**File**: `ci/gitlab-ci.yml` (modified, +148/-54)
```diff
@@ -190,7 +190,7 @@ ip-boundary-skill-installed:
     name: lean-ctx-ci-rust:65e3bbf776c5
     pull_policy: if-not-present
   # Python only: run on the small runner (2 CPU / 4 GB slots), so the job does
-  # not queue behind Rust builds for a 12-CPU slot.
+  # not queue behind Rust builds for a 6-CPU slot.
   tags: [light]
   timeout: 5 minutes
   interruptible: false
@@ -334,9 +334,15 @@ v4-runtime:
     # `target`: tests recognise build output by paths like /target/debug/deps.
     # It is the only compiler cache (W1-08: sccache is gone; the persistent
     # target already holds every unchanged crate).
-    CI_TARGET_DIR: "/builds/.ci-cache/$CI_PROJECT_PATH_SLUG/target"
-    # A target over this size (GiB) is wiped at job start.
-    CI_TARGET_CAP_GB: "40"
+    # One target per concurrent build directory of a runner, keyed like the
+    # runner's own /builds/<short token>/<concurrent id> (11.11., p5 jobs
+    # 32317/32318/32345: jobs in /builds/<token>/1 and /2 built into one
+    # target, and one job's cargo replaced or removed the other's test
+    # binaries mid-run).
+    CI_TARGET_DIR: "/builds/.ci-cache/$CI_PROJECT_PATH_SLUG/slot-$CI_RUNNER_SHORT_TOKEN-$CI_CONCURRENT_PROJECT_ID/target"
+    # A target over this size (GiB) is wiped at job start. Per slot: with
+    # about six slots on the host, 30 keeps the worst case near 180 GiB.
+    CI_TARGET_CAP_GB: "30"
     # Warm build farm (W4-04, scripts/ci/warm_farm.py). The runner mounts the
     # root-owned host directory /srv/ci-cache/warm-farm here. A green
     # protected post-merge run publishes its target (incremental data
@@ -352,8 +358,9 @@ v4-runtime:
     # Incremental compilation of the workspace crates into the slot's
     # persistent target (W1-08): a change recompiles only what it touched.
     CARGO_INCREMENTAL: "1"
-    # The runner gives each job a 12-CPU / 20-GiB cgroup (all jobs share the
-    # host's 24-CPU / 64-GiB CI slice); more jobs than CPUs gain nothing. The
+    # The runner gives each job a cgroup of 6 CPUs (cpu.max 600000/100000, as
+    # mr-quick prints it, 12.11.); all jobs share the host's 24-CPU / 64-GiB CI
+    # slice. 12 jobs exceed the quota and the cgroup throttles the excess. The
     # two ~9-GiB engine rustc (lib, lib test) dominate and fit side by side.
     CARGO_BUILD_JOBS: "12"
     CARGO_PROFILE_DEV_DEBUG: line-tables-only
@@ -380,7 +387,7 @@ v4-runtime:
     # The image carries every tool; nothing is installed at job time. The
     # resolved compiler version is recorded with the evidence.
     - |
-      for ci_tool in git python3 cmake clang mold node npm useradd runuser cargo-clippy cargo-nextest rustfmt; do
+      for ci_tool in git python3 cmake clang mold node npm useradd runuser flock cargo-clippy cargo-nextest rustfmt; do
         command -v "$ci_tool" >/dev/null || { echo "CI image lacks $ci_tool" >&2; exit 1; }
       done
     - |
@@ -440,101 +447,168 @@ v4-runtime:
       # swap the target for a link nor forge the stamp beside it; the target
       # belongs to ci-runner. Nothing here follows a symlink. Toolchain or
       # image changes and targets over CI_TARGET_CAP_GB start fresh.
+      # Each concurrent build directory has its own target (CI_TARGET_DIR).
+      # Should two jobs ever share one (11.11., p5 jobs 32317/32318/32321: a
+      # wipe deleted a running job's test binaries and du failed on files
+      # another job removed), each holds a shared lock on target.lock (fd 9)
+      # until the job ends; only a job that gets the lock exclusively without
+      # waiting (fd 8) wipes or cleans up. A busy slot keeps its target.
       test "${CI_BUILDS_DIR:-}" = /builds || { echo "target: unexpected CI_BUILDS_DIR" >&2; exit 1; }
       case "${CI_PROJECT_PATH_SLUG:-}" in ''|*[!a-z0-9-]*) echo "target: unexpected CI_PROJECT_PATH_SLUG" >&2; exit 1;; esac
       case "${CI_TARGET_CAP_GB:-}" in ''|*[!0-9]*) echo "target: unexpected CI_TARGET_CAP_GB" >&2; exit 1;; esac
-      ci_target_parent="/builds/.ci-cache/$CI_PROJECT_PATH_SLUG"
+      case "${CI_RUNNER_SHORT_TOKEN:-}" in ''|*[!A-Za-z0-9_-]*) echo "target: unexpected CI_RUNNER_SHORT_TOKEN" >&2; exit 1;; esac
+      case "${CI_CONCURRENT_PROJECT_ID:-}" in ''|*[!0-9]*) echo "target: unexpected CI_CONCURRENT_PROJECT_ID" >&2; exit 1;; esac
+      ci_target_parent="/builds/.ci-cache/$CI_PROJECT_PATH_SLUG/slot-$CI_RUNNER_SHORT_TOKEN-$CI_CONCURRENT_PROJECT_ID"
       ci_target="$ci_target_parent/target"
       test "${CI_TARGET_DIR:-}" = "$ci_target" || { echo "target: unexpected CI_TARGET_DIR" >&2; exit 1; }
       case "$ci_target/" in "$CI_PROJECT_DIR"/*) echo "target: inside the checkout" >&2; exit 1;; esac
+      case "${CI_JOB_ID:-}" in ''|*[!0-9]*) echo "target: unexpected CI_JOB_ID" >&2; exit 1;; esac
       if test -L /builds; then echo "target: /builds is a symlink" >&2; exit 1; fi
-      for ci_dir in /builds/.ci-cache "$ci_target_parent"; do
+      for ci_dir in /builds/.ci-cache "/builds/.ci-cache/$CI_PROJECT_PATH_SLUG" "$
```

**File**: `docs/reference/generated/config-keys.md` (modified, +8/-0)
```diff
@@ -214,6 +214,12 @@ MCP decision-loop runtime settings
 - `enabled` (bool, default `true`) — Enable the MCP decision-loop runtime
 - `max_filter_level` (u8, default `0`) — Maximum lossy post-dispatch triage level (0 disables output filtering)
 
+## `[decisions]`
+
+Decision layer (.leanctx/decisions/*.toml): pre-edit check mode
+
+- `enforce` (string, default `hint`) — Pre-edit check of .leanctx/decisions: hint (report), refuse (strict: edit not written), off
+
 ## `[embedding]`
 
 Semantic-embedding engine settings (model selection for ctx_search action=semantic)
@@ -275,6 +281,8 @@ LeanCTX | Hive: workspace knowledge, policies and the shared agent bus.
 - `bus` (string: auto | off, default `auto`) — Relay the agent bus through Hive (auto) or keep it local (off).
 - `enabled` (bool, default `null`) — Pause all Hive traffic with false; unset means on while this machine is connected.
 - `metrics_upload` (bool, default `true`) — Send hourly instance metrics to Hive (counts only, including full re-fetches and unregulated program names; never content).
+- `models_anthropic_agents` (bool, default `false`) — Let Anthropic-shaped agents reach the subscription models through shape-xlat routing aliases; false means OpenAI-shaped agents only. Owner question Q3 is open: true takes effect only once it is decided.
+- `models_url` (string, default `null`) — Origin of the Hive models gateway for the leanctx provider; unset means https://models.<hive host>. Only the Hive host or a direct subdomain of it is honoured.
 - `pull_interval_minutes` (integer, default `5`) — Minutes between Hive sync passes (1-60; values outside are clamped).
 - `queen_identity` (string: warn | enforce, default `warn` — env `LEAN_CTX_HIVE_QUEEN_IDENTITY`) — A bus sender presenting as the Queen that is no registered Queen session: warn (pass, log in bus/queen-warnings.json, mark for the receiver) or enforce (refuse); any other value counts as enforce. Enforce only once queen-sessions.json lists every Queen session.
 - `receipts_upload` (bool, default `true`) — Upload context receipts to Hive.
```

#### Recent Merged Pull Requests:
- **PR #2242** (2026-11-12): Release 3.12.4 (@yvgude)
- **PR #2241** (closed): Release 3.12.4 (@yvgude)
- **PR #2239** (closed): Release 3.12.4 (@yvgude)
- **PR #2238** (closed): Release 3.12.4 (@yvgude)
- **PR #2235** (2026-11-11): release: LeanCTX 3.12.3 (final export, GitHub issues) (@yvgude)
- **PR #2234** (closed): release: LeanCTX 3.12.3 (final export) (@yvgude)

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

## X. Empirical Invariant Guard in CHANGELOG.md

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yvgude/lean-ctx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b6de365b`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
## [3.12.4] — 2026-11-12

- **ECCP L/I/G change classifier (task 156).** `scripts/change-class <base> <head>`
  prints `L` (no public Rust item changed), `I` (public items only added) or `G`
  (public item changed or removed, Cargo features or dependency tables,
  `Cargo.lock`, `build.rs`, Cargo config, toolchain pin, CI configuration or a
  generated registry) from the git objects alone, without a build or network,
  and serves as `$ECCP_CLASSIFIER` for `scripts/eccp-envelope`.

- **ECCP change envelope in git notes (task 157).** `scripts/eccp-envelope` writes,
  shows and verifies a `leanctx.change-envelope/v1` JSON note under
  `refs/notes/eccp` on a merge request head: intent, base, class, read set,
  derivations and check evidence (`docs/contracts/change-envelope-v1.md`).

- **Audit entries v2 bind each tool call to its session (ent3-1).** Every new
  audit-trail entry carries `v: 2` and a chained `v2_hash` over its timestamp
  and, for a call of an MCP session, the `session_id`, a per-session `seq`,
  the decision and an output digest, so an edited timestamp, seq or fact fails
  `verify_chain` and `verify_chain_full` at that entry. Input and output digests
  are HMAC-SHA256 u
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b6de365b` are properly handled with clean fallback behavior.
