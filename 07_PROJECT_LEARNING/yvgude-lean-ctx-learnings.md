> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yvgude-lean-ctx-learnings.md`  
> **Source**: github ([https://github.com/yvgude/lean-ctx](https://github.com/yvgude/lean-ctx))  
> **Source Version**: `a0fbfe77`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T16:01:12.250Z  
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
> **Harvest Timestamp**: 2026-11-08T16:01:12.073Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yvgude/lean-ctx`
- **Description**: LeanCTX is the Context Gateway for AI Systems. Select task-relevant context, apply supported controls, connect local knowledge and inspect recorded evidence. Open-source Engine: CLI, MCP, hooks and supported proxy paths.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3935 stars

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
- **Issue #2189** (2026-11-05): **bug: Claude Code broken after update 3.12.1**
  *Symptoms*: I'm aware of this and currently working an a hotfix.

- **Issue #2178** (2026-11-04): **Windows (MSVC build): lean-ctx.exe exits silently with 0xC0000135 when the VC++ runtime (VCRUNTIME140.dll) is missing**
  *Symptoms*: **lean-ctx version:** v3.12.0 (official `x86_64-pc-windows-msvc` release asset) **OS:** Windows (reproduced on Windows Server 2025, build 26100, clean install)  **What happens**  On a Windows machine without the Microsoft Visual C++ Redistributable, `lean-ctx.exe` from the MSVC release asset exits immediately without any output. The exit status is `0xC0000135` (`STATUS_DLL_NOT_FOUND`): the binary links the C runtime dynamically and needs `VCRUNTIME140.dll`, which a clean Windows install (notably Windows Server, minimal/fresh Windows 11 images, CI images without VS) does not ship.  There is no error message, so the user just sees "nothing happens".  **Steps to reproduce**  1. Fresh Windows Server 2025 (or any Windows without the VC++ 2015–2022 Redistributable). 2. Download and verify `lean-ctx` v3.12.0 `x86_64-pc-windows-msvc` from the release. 3. Run `lean-ctx --version` → no output, `$LASTEXITCODE` = `-1073741515` (`0xC0000135`). 4. Install the VC++ Redistributable (x64) → the same binary works.  **Expected**  The binary runs on a stock Windows install, or the installer/docs state the dependency and install it.  **Possible fixes**  - Link the C runtime statically for the MSVC target (`-C target-feature=+crt-static`, e.g. via `[target.x86_64-pc-windows-msvc] rustflags` in `rust/.cargo/config.toml` or the release workflow). Needs a check of the CUDA variant (`x86_64-pc-windows-msvc-cuda`), whose CUDA libraries may require the dynamic CRT. - Or: `install.ps1` detects the missin

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

### Incident Patch 1: `1f3e7a72` (2026-11-08)
**Commit Message**: fix(server): never block tool dispatch on observation persistence; request ledger (#2196, #2197) (#2209)

* fix(server): never block tool dispatch on observation persistence; request ledger in doctor and /v1/health (#2196, #2197)

- Serving processes hand compatibility observations to a bounded writer
  thread (queue 4096, drop + count when full); validation stays on the
  caller, queued observations are flushed at exit and after HTTP/daemon stop.
- FileUnifiedLedger appends parse only records past the last validated tip
  instead of re-reading the whole ledger under the exclusive lock; a replaced,
  truncated or diverged file falls back to a full scan.
- New request ledger (admitted/completed/errored/refused/abandoned/pending,
  oldest pending method and stage, last completion, last initialize,
  observation counters), shown per server by `lean-ctx doctor` and served at
  GET /v1/health. Ages appear only there, so tool output stays byte-stable.
- LOCK_ORDERING rows for LEDGER and VALIDATED_TIPS.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(request-ledger): withdraw snapshot and flush observations on every shutdown path

Address review on #2209: HTTP /v1/shutdown, ser

**File**: `rust/LOCK_ORDERING.md` (modified, +2/-0)
```diff
@@ -167,6 +167,8 @@ All `std::sync::Mutex` unless noted otherwise.
 | L140 | `REFRESHING` | `core/bm25_cache.rs:104` | `Mutex<Vec<PathBuf>>` | Roots whose background BM25 reload is running, so a stale entry starts at most one reload per root; held only to check, push or remove a root, never across the reload; independent leaf lock, never nested |
 | L141 | `QUEUE` | `core/hive/background.rs:36` | `Mutex<Option<Queue>>` (with `WAKE: Condvar`) | Hive background request queue (pending lease, renew, release and task calls) and the answers waiting per caller; the worker takes a job and releases the lock before running it, so no Hive request runs under it; independent leaf lock, never nested |
 | L142 | `RUNNING` | `core/phase_timing.rs:19` | `Mutex<BTreeMap<u64, (&'static str, Instant)>>` | Phase timers still running, one entry per guard, so `current()` names the newest; held only to insert, remove or read one entry; independent leaf lock, never nested |
+| L143 | `LEDGER` | `core/request_ledger.rs:134` | `Mutex<Ledger>` | Request ledger of a serving process (#2197): pending requests by id with method and stage, last tool completion, last initialize; held only to insert, update, remove or copy entries, released before `phase_timing::current()` (L142) or any I/O; independent leaf lock, never nested |
+| L144 | `VALIDATED_TIPS` | `core/ocla/unified_ledger.rs:273` | `Mutex<Vec<ValidatedTip>>` | Per ledger path, the prefix of the unified savings ledger this process already validated (#2196), so an append parses only newer records; taken only while the ledger's OS file lock is held, to copy, replace or drop one entry, never across I/O; independent leaf lock, never nested |
 
 ### CLI cache transaction file lock
 
```

**File**: `rust/crates/lean-ctx-server/src/server/server_handler.rs` (modified, +24/-4)
```diff
@@ -85,6 +85,9 @@ impl ServerHandler for LeanCtxServer {
         request: InitializeRequestParams,
         context: RequestContext<RoleServer>,
     ) -> Result<InitializeResult, ErrorData> {
+        // #2197: kept apart from tool completions in the request ledger.
+        let ledger_entry = lean_ctx::core::request_ledger::begin("initialize");
+        ledger_entry.stage(lean_ctx::core::request_ledger::Stage::Handler);
         let name = request.client_info.name.clone();
         tracing::info!("MCP client connected: {:?}", name);
         *self.client_name.write().await = name.clone();
@@ -401,16 +404,18 @@ impl ServerHandler for LeanCtxServer {
         // The initialize `instructions` field is that same steering block
         // delivered over a different channel, so the central policy predicate
         // must govern this surface too.
-        if suppress_initialize_instructions(client_caps.client_id.as_str()) {
-            Ok(result)
+        let result = if suppress_initialize_instructions(client_caps.client_id.as_str()) {
+            result
         } else {
             let instructions = lean_ctx::instructions::build_instructions_with_client_and_session(
                 CrpMode::effective(),
                 &name,
                 &session,
             );
-            Ok(result.with_instructions(instructions))
-        }
+            result.with_instructions(instructions)
+        };
+        ledger_entry.finish(lean_ctx::core::request_ledger::Outcome::Completed);
+        Ok(result)
     }
 
     async fn list_tools(
@@ -739,6 +744,10 @@ impl ServerHandler for LeanCtxServer {
         // In flight until this call returns — the idle policy never releases
         // or exits under a running call.
         let _activity = crate::server::mcp_idle::begin_call();
+        // #2197: admitted until exactly one outcome is recorded; a future the
+        // client cancels drops this guard and counts as abandoned.
+        let ledger_entry =
+            lean_ctx::core::request_ledger::begin(&format!("tools/call:{}", request.name.as_ref()));
         restore_tool_meta(&mut request, &context.meta);
 
         let progress_token = request
@@ -771,6 +780,7 @@ impl ServerHandler for LeanCtxServer {
         // delivery so the proxy can tell which call these bytes answered.
         let host_call_id = crate::server::call_identity::host_call_id(request.meta.as_ref());
 
+        ledger_entry.stage(lean_ctx::core::request_ledger::Stage::Handler);
         // #1781: scope the request's cancellation token for the whole dispatch
         // so a tool that waits on a child process can observe an abandoned call
         // instead of holding its blocking-pool slot until its own soft cap.
@@ -788,30 +798,40 @@ impl ServerHandler for LeanCtxServer {
             // boundary inside a string, a parse error): the log line names
             // the event only (AP10-R4).
             tracing::error!("call_tool panicked (tool_panic)");
+            ledger_entry.stage(lean_ctx::core::request_ledger::Stage::Finalizing);
 
             if let Ok(mut detector) =
                 tokio::time::timeout(std::time::Duration::from_secs(1), loop_detector.write()).await
             {
                 detector.record_error_outcome(&tool_name_for_panic, &args_fp_for_panic);
             }
 
+            ledger_entry.finish(lean_ctx::core::request_ledger::Outcome::Errored);
             return Ok(CallToolResult::error(vec![ContentBlock::text(
                 "ERROR: lean-ctx internal error. The MCP server is still running. \
                  Please retry or use a different approach."
                     .to_string(),
             )]));
         };
+        ledger_entry.stage(lean_ctx::core::request_ledger::Stage::Finalizing);
         // #1265: If the client cancelled this request while the tool was
         // executing, drop the result instead of replying to a stale ID.
         if ct.is_cancelled() {
             tracing::warn!(
                 "tool '{tool_name_for_panic}' completed after client cancellation — dropping result"
             );
+            ledger_entry.finish(lean_ctx::core::request_ledger::Outcome::Abandoned);
             return Err(ErrorData::internal_error(
                 "request was cancelled by client",
                 None,
             ));
         }
+        ledger_entry.finish(match &result {
+            Ok(done) if done.is_error != Some(true) => {
+                lean_ctx::core::request_ledger::Outcome::Completed
+            }
+            _ => lean_ctx::core::request_ledger::Outcome::Errored,
+        });
         result
     }
 
```

**File**: `rust/crates/lean-ctx/src/cli/dispatch/server.rs` (modified, +3/-0)
```diff
@@ -106,6 +106,9 @@ pub(super) fn run_mcp_server() -> Result<()> {
     let result = rt.block_on(async {
         core::logging::init_mcp_logging();
         core::protocol::set_mcp_context(true);
+        // Observations never block dispatch; the request ledger publishes
+        // for `lean-ctx doctor` (#2196, #2197).
+        core::request_ledger::start_serving("mcp-stdio");
 
         tracing::info!(
             "lean-ctx v{} MCP server starting",
```

**File**: `rust/crates/lean-ctx/src/doctor/mod.rs` (modified, +109/-0)
```diff
@@ -212,6 +212,34 @@ impl Scoreboard {
     }
 }
 
+/// A pending request older than this is flagged in doctor's request lines.
+const STUCK_REQUEST_AFTER: std::time::Duration = std::time::Duration::from_secs(30);
+
+/// Doctor's request-ledger lines (#2197), one per running server process:
+/// counters, the oldest pending request with its age and stage, and the last
+/// tool completion. Pure; advisory (never scored).
+fn request_ledger_outcomes(
+    snapshots: &[lean_ctx::core::request_ledger::RequestLedgerSnapshot],
+    now_ms: u64,
+) -> Vec<Outcome> {
+    snapshots
+        .iter()
+        .map(|snapshot| {
+            let stuck = snapshot
+                .oldest_pending_age(now_ms)
+                .is_some_and(|age| age >= STUCK_REQUEST_AFTER);
+            let colour = if stuck { YELLOW } else { DIM };
+            Outcome {
+                ok: !stuck,
+                line: format!(
+                    "{BOLD}Requests{RST}  {colour}{}{RST}",
+                    snapshot.render(now_ms)
+                ),
+            }
+        })
+        .collect()
+}
+
 /// Daemon diagnostics that are not checks of their own: the systemd unit
 /// state and linger (Linux) and a crash-looping MCP server. Returned rather
 /// than printed, so the caller decides between text and JSON.
@@ -677,6 +705,15 @@ fn run_inner(json: bool) -> u32 {
         board.note(&note);
     }
 
+    // Request ledgers of running servers (#2197): read from the files their
+    // publisher threads keep, so a saturated worker still answers here.
+    for outcome in request_ledger_outcomes(
+        &lean_ctx::core::request_ledger::published_snapshots(),
+        lean_ctx::core::request_ledger::epoch_ms(),
+    ) {
+        board.info(&outcome);
+    }
+
     // Providers (advisory — presence/health varies per environment, not scored)
     let provider_outcome = provider_outcome();
     board.info(&provider_outcome);
@@ -1109,6 +1146,78 @@ fn config_migration_pause_outcome(config: &std::path::Path) -> Option<Outcome> {
 mod tests {
     use super::is_active_shell_impl;
     use super::{DaemonAutostart, daemon_outcome, unrecorded_services_outcome};
+    use super::{request_ledger_outcomes, strip_ansi};
+
+    /// #2197: doctor names each running server's counters, its oldest
+    /// pending request with age and stage, and its last tool completion, and
+    /// flags a request pending past the stuck threshold.
+    #[test]
+    fn request_ledger_lines_show_counters_oldest_pending_and_last_completion() {
+        use lean_ctx::core::request_ledger::{
+            CompletionRecord, Outcome as RequestOutcome, PendingRequest, RequestLedgerSnapshot,
+            Stage,
+        };
+        let now = 1_000_000_000;
+        let snapshot = RequestLedgerSnapshot {
+            pid: 4242,
+            kind: "http".into(),
+            generation: "gen".into(),
+            started_at_ms: now - 600_000,
+            snapshot_at_ms: now - 1_000,
+            admitted: 40,
+            completed: 36,
+            errored: 1,
+            refused: 2,
+            abandoned: 1,
+            pending: 2,
+            untracked_pending: 0,
+            oldest_pending: Some(PendingRequest {
+                method: "tools/call:ctx_read".into(),
+                stage: Stage::Handler,
+                admitted_at_ms: now - 74_000,
+                age_ms: None,
+            }),
+            last_tool_completion: Some(CompletionRecord {
+                method: "tools/call:ctx_search".into(),
+                outcome: RequestOutcome::Completed,
+                finished_at_ms: now - 3_000,
+                duration_ms: 12,
+                age_ms: None,
+            }),
+            last_initialize: None,
+            current_phase: None,
+            observations: lean_ctx::core::events::DetachedObservationStats::default(),
+        };
+        let lines = request_ledger_outcomes(std::slice::from_ref(&snapshot), now);
+        assert_eq!(lines.len(), 1);
+        let line = strip_ansi(&lines[0].line);
+        assert!(!lines[0].ok, "a 74 s pending request is flagged: {line}");
+        assert!(line.contains("pid 4242 (http), up 10m"), "{line}");
+        assert!(
+            line.contains(
+                "admitted 40 · completed 36 · errored 1 · refused 2 · abandoned 1 · pending 2"
+            ),
+            "{line}"
+        );
+        assert!(
+            line.contains("oldest pending tools/call:ctx_read 74s in handler"),
+            "{line}"
+        );
+        assert!(
+            line.contains("last tool completion 3s ago (completed, 12ms)"),
+            "{line}"
+        );
+        assert!(line.contains("last initialize none yet"), "{line}");
+
+        let idle = RequestLedgerSnapshot {
+            pending: 0,
+            oldest_pending: None,
+            ..snapshot
+        };
+        let lines = request_ledger_outcomes(&[idle], now);
+        assert!(lines[0].ok);
+        assert!(strip_ansi(&lines[0].line).contains("oldes
```

**File**: `rust/crates/lean-ctx/src/http_server/mod.rs` (modified, +53/-9)
```diff
@@ -300,18 +300,32 @@ async fn rate_limit_middleware(
     req: Request<axum::body::Body>,
     next: Next,
 ) -> Response {
+    if is_diagnostic_path(req.uri().path()) {
+        return next.run(req).await;
+    }
     if !state.rate.allow().await {
+        lean_ctx::core::request_ledger::refused();
         return StatusCode::TOO_MANY_REQUESTS.into_response();
     }
     next.run(req).await
 }
 
+/// Health routes answer from counters, never from the work queue: they must
+/// stay reachable exactly when every request slot is taken (#2197).
+fn is_diagnostic_path(path: &str) -> bool {
+    matches!(path, "/health" | "/v1/health")
+}
+
 async fn concurrency_middleware(
     State(state): State<AppState>,
     mut req: Request<axum::body::Body>,
     next: Next,
 ) -> Response {
+    if is_diagnostic_path(req.uri().path()) {
+        return next.run(req).await;
+    }
     let Ok(permit) = state.concurrency.clone().try_acquire_owned() else {
+        lean_ctx::core::request_ledger::refused();
         return StatusCode::TOO_MANY_REQUESTS.into_response();
     };
     let permit = Arc::new(permit);
@@ -325,9 +339,29 @@ async fn health() -> impl IntoResponse {
     (StatusCode::OK, "ok\n")
 }
 
+/// `GET /v1/health`: liveness plus the request ledger (#2197) — counters,
+/// the oldest pending request's method, stage and age, and the last tool
+/// completion. Method names only; no arguments, paths or content.
+async fn v1_health() -> impl IntoResponse {
+    let snapshot = lean_ctx::core::request_ledger::snapshot()
+        .with_ages(lean_ctx::core::request_ledger::epoch_ms());
+    Json(serde_json::json!({ "status": "ok", "requests": snapshot }))
+}
+
+/// Persist queued observations and remove the published request snapshot
+/// (#2196, #2197). Blocking work, so it runs off the async workers.
+async fn finish_serving() {
+    let _ = tokio::task::spawn_blocking(|| {
+        lean_ctx::core::request_ledger::finish_serving(Duration::from_secs(5));
+    })
+    .await;
+}
+
 async fn v1_shutdown() -> impl IntoResponse {
     tokio::spawn(async {
         tokio::time::sleep(Duration::from_millis(100)).await;
+        // `process::exit` runs no destructors or exit hooks.
+        finish_serving().await;
         std::process::exit(0);
     });
     (StatusCode::OK, "shutting down\n")
@@ -1096,6 +1130,7 @@ fn build_router(
 
     Router::new()
         .route("/health", get(health))
+        .route("/v1/health", get(v1_health))
         .route(
             "/ocla/v1/delivery/scoped",
             axum::routing::post(scoped_delivery::execute),
@@ -1175,6 +1210,9 @@ pub async fn serve(cfg: HttpServerConfig) -> Result<()> {
     let receipt_authority =
         lean_ctx_server::server::native_receipts::load_configured_host_authority()
             .map_err(anyhow::Error::msg)?;
+    // Observations never block dispatch; the request ledger publishes for
+    // `lean-ctx doctor` and `/v1/health` (#2196, #2197).
+    lean_ctx::core::request_ledger::start_serving("http");
     // Apply the `LEAN_CTX_KERNEL_*` switches once, so kernel health
     // (`/v1/kernel/health`) reports the configuration this server runs with.
     lean_ctx::core::context_kernel::startup::initialize();
@@ -1214,13 +1252,14 @@ pub async fn serve(cfg: HttpServerConfig) -> Result<()> {
         cfg.project_root.display()
     );
 
-    axum::serve(listener, app)
+    let served = axum::serve(listener, app)
         .with_graceful_shutdown(async move {
             let _ = tokio::signal::ctrl_c().await;
         })
         .await
-        .context("http server")?;
-    Ok(())
+        .context("http server");
+    finish_serving().await;
+    served
 }
 
 /// Serve the daemon over a platform-independent IPC channel (UDS on Unix,
@@ -1230,6 +1269,9 @@ pub async fn serve_ipc(cfg: HttpServerConfig, addr: lean_ctx::ipc::DaemonAddr) -
     let receipt_authority =
         lean_ctx_server::server::native_receipts::load_configured_host_authority()
             .map_err(anyhow::Error::msg)?;
+    // Observations never block dispatch; the request ledger publishes for
+    // `lean-ctx doctor` (#2196, #2197).
+    lean_ctx::core::request_ledger::start_serving("daemon");
     lean_ctx::core::context_kernel::startup::initialize();
 
     lean_ctx::core::telemetry_send::spawn_daemon_telemetry();
@@ -1251,13 +1293,14 @@ pub async fn serve_ipc(cfg: HttpServerConfig, addr: lean_ctx::ipc::DaemonAddr) -
                 cfg.project_root.display()
             );
 
-            axum::serve(listener, app.into_make_service())
+            let served = axum::serve(listener, app.into_make_service())
                 .with_graceful_shutdown(async move {
                     let _ = tokio::signal::ctrl_c().await;
                 })
                 .await
-                .context("ipc server")?;
-            Ok(())
+                .context("ipc server");
+            finish_serving().await;
+            served
         }
         #[cfg(windows)]
         lean_ctx:
```

**File**: `rust/src/core/context_os/context_bus.rs` (modified, +46/-3)
```diff
@@ -267,6 +267,14 @@ pub struct ContextBus {
     inner: Arc<Inner>,
 }
 
+/// A legacy event that passed storage admission, with the exact payload it is
+/// stored as. Built by [`ContextBus::admit_legacy_observation`].
+#[derive(Clone, Debug)]
+pub(crate) struct AdmittedLegacyObservation {
+    pub(crate) event: LeanCtxEvent,
+    pub(crate) payload_json: String,
+}
+
 const STREAM_CHANNEL_SIZE: usize = 256;
 const MAX_SUBSCRIBERS_PER_CHANNEL: usize = 64;
 /// Bound the write-side version cache. Each entry is re-derivable from the DB via
@@ -539,18 +547,53 @@ impl ContextBus {
         producer_instance: &str,
         event: &LeanCtxEvent,
     ) -> Result<i64, ObservationPersistenceError> {
+        let payload = Self::admit_legacy_observation(event)?;
+        self.append_admitted_legacy_observation(producer_instance, &payload)
+    }
+
+    /// The storage admission half of [`Self::append_legacy_observation`]: the
+    /// payload a legacy event is stored as, once admission keeps it verbatim.
+    /// Runs on the producer's thread, under the producer's policy view, so a
+    /// detached writer (`events::emit_compatibility` in a serving process)
+    /// persists exactly what the producer admitted.
+    pub(crate) fn admit_legacy_observation(
+        event: &LeanCtxEvent,
+    ) -> Result<AdmittedLegacyObservation, ObservationPersistenceError> {
         let payload_json = serde_json::to_string(event)?;
         let _: LeanCtxEvent = serde_json::from_str(&payload_json)?;
         super::observation::admit_payload(&payload_json)?;
+        Ok(AdmittedLegacyObservation {
+            event: event.clone(),
+            payload_json,
+        })
+    }
+
+    /// The write half of [`Self::append_legacy_observation`] for a payload
+    /// [`Self::admit_legacy_observation`] already admitted.
+    pub(crate) fn append_admitted_legacy_observation(
+        &self,
+        producer_instance: &str,
+        admitted: &AdmittedLegacyObservation,
+    ) -> Result<i64, ObservationPersistenceError> {
         self.insert_local_observation(
             LocalObservationSource::Legacy,
             producer_instance,
-            event.id,
-            &event.timestamp,
-            &payload_json,
+            admitted.event.id,
+            &admitted.event.timestamp,
+            &admitted.payload_json,
         )
     }
 
+    /// Holds the observation writer as a long transaction would, so a test can
+    /// show that a producer does not wait for it.
+    #[cfg(test)]
+    pub(crate) fn hold_observation_writer(&self) -> std::sync::MutexGuard<'_, Connection> {
+        self.inner
+            .write_conn
+            .lock()
+            .unwrap_or_else(std::sync::PoisonError::into_inner)
+    }
+
     fn insert_local_observation(
         &self,
         source: LocalObservationSource,
```

**File**: `rust/src/core/context_os/mod.rs` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ pub use shared_sessions::{SharedSessionKey, SharedSessionStore};
 
 mod context_bus;
 pub mod observation;
+pub(crate) use context_bus::AdmittedLegacyObservation;
 pub use context_bus::{
     ConsistencyLevel, ContextBus, ContextEventKindV1, ContextEventV1, FilteredSubscription,
     TopicFilter,
```

**File**: `rust/src/core/events.rs` (modified, +276/-9)
```diff
@@ -398,37 +398,247 @@ fn append_jsonl_at(path: &std::path::Path, event: &LeanCtxEvent) -> std::io::Res
 ///
 /// This compatibility adapter deliberately never appends to `events.jsonl`;
 /// that journal remains an immutable historical read source.
+///
+/// In a serving process (after [`enable_detached_observations`]) the write is
+/// handed to a dedicated writer thread: a tool handler never waits on the
+/// observation lock or SQLite (#2196), and when the bounded queue is full the
+/// observation is dropped and counted instead of blocking dispatch. Storage
+/// admission still runs here, on the producer's thread and policy view.
 pub fn emit_compatibility(kind: EventKind) -> u64 {
-    match try_emit(kind) {
+    let result = if DETACHED_ENABLED.load(Ordering::Acquire) {
+        emit_detached(kind)
+    } else {
+        try_emit(kind)
+    };
+    match result {
         Ok(id) => id,
         Err(error) => {
-            tracing::warn!("canonical legacy observation persistence failed: {error}");
+            log_persistence_failure(&error);
             0
         }
     }
 }
 
 /// [`emit_compatibility`] that reports why persistence failed instead of
-/// collapsing the failure into id `0`.
+/// collapsing the failure into id `0`. Always synchronous.
 pub(crate) fn try_emit(
     kind: EventKind,
 ) -> Result<u64, crate::core::context_os::ObservationPersistenceError> {
-    let id = next_event_id();
+    persist_admitted(&admit(kind)?)
+}
+
+fn admit(
+    kind: EventKind,
+) -> Result<
+    crate::core::context_os::AdmittedLegacyObservation,
+    crate::core::context_os::ObservationPersistenceError,
+> {
     let event = LeanCtxEvent {
-        id,
+        id: next_event_id(),
         timestamp: chrono::Local::now()
             .format("%Y-%m-%dT%H:%M:%S%.3f")
             .to_string(),
         kind,
     };
+    crate::core::context_os::ContextBus::admit_legacy_observation(&event)
+}
+
+fn persist_admitted(
+    admitted: &crate::core::context_os::AdmittedLegacyObservation,
+) -> Result<u64, crate::core::context_os::ObservationPersistenceError> {
     crate::core::context_os::try_runtime().and_then(|runtime| {
-        runtime.bus.append_legacy_observation(
+        runtime.bus.append_admitted_legacy_observation(
             crate::core::context_os::observation::producer_instance(),
-            &event,
+            admitted,
         )
     })?;
-    bus().record(event);
-    Ok(id)
+    bus().record(admitted.event.clone());
+    Ok(admitted.event.id)
+}
+
+/// A withheld observation is the gateway working as configured, not a fault:
+/// at warn level it flooded the worker log (765 lines in 5 minutes, #2196).
+fn log_persistence_failure(error: &crate::core::context_os::ObservationPersistenceError) {
+    if matches!(
+        error,
+        crate::core::context_os::ObservationPersistenceError::Withheld
+    ) {
+        tracing::debug!("canonical legacy observation persistence skipped: {error}");
+    } else {
+        tracing::warn!("canonical legacy observation persistence failed: {error}");
+    }
+}
+
+// --- Detached persistence for serving processes (#2196) ---
+
+/// Observations a serving process may have waiting for the writer thread.
+const DETACHED_QUEUE_CAPACITY: usize = 4_096;
+
+static DETACHED_ENABLED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
+static DETACHED_QUEUED: AtomicU64 = AtomicU64::new(0);
+static DETACHED_PERSISTED: AtomicU64 = AtomicU64::new(0);
+static DETACHED_FAILED: AtomicU64 = AtomicU64::new(0);
+static DETACHED_DROPPED: AtomicU64 = AtomicU64::new(0);
+
+enum DetachedMessage {
+    Persist(crate::core::context_os::AdmittedLegacyObservation),
+    Flush(std::sync::mpsc::SyncSender<()>),
+}
+
+/// Counters of the detached observation writer, for doctor and health.
+#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
+pub struct DetachedObservationStats {
+    pub enabled: bool,
+    pub queued: u64,
+    pub persisted: u64,
+    pub failed: u64,
+    pub dropped: u64,
+}
+
+pub fn detached_observation_stats() -> DetachedObservationStats {
+    DetachedObservationStats {
+        enabled: DETACHED_ENABLED.load(Ordering::Acquire),
+        queued: DETACHED_QUEUED.load(Ordering::Relaxed),
+        persisted: DETACHED_PERSISTED.load(Ordering::Relaxed),
+        failed: DETACHED_FAILED.load(Ordering::Relaxed),
+        dropped: DETACHED_DROPPED.load(Ordering::Relaxed),
+    }
+}
+
+/// Route [`emit_compatibility`] through the detached writer for the rest of
+/// this process. Called once by a serving process before it accepts requests;
+/// one-shot CLI commands keep synchronous persistence.
+pub fn enable_detached_observations() {
+    if detached_sender().is_some() {
+        DETACHED_ENABLED.store(true, Ordering::Release);
+    }
+}
+
+fn detached_sender() -> Option<&'static std::sync::mpsc::SyncSender<DetachedMessage>> {
+    static SENDER: OnceLock<Option<std::sync::mpsc::SyncSender<DetachedMessage>>>
```

---

### Incident Patch 2: `a0fbfe77` (2026-11-08)
**Commit Message**: fix(pathjail): document the IDE allow-dirs single flight as L145, fix cache test race (#2195) (#2211)

* fix(pathjail): probe IDE allow-dirs outside the cache lock (#2195)

The allow-dir cache held its mutex across the editor-registry probe
(filesystem and PATH lookups for ~40 editors), so a slow probe on a
network home or stalled mount blocked every concurrent path check. The
lock now only guards copying the cached list out and storing a fresh
one. Document the lock as L145 in LOCK_ORDERING.md.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(pathjail): single-flight refresh for IDE allow-dirs cache (#2195)

Serve the stale list while one caller refreshes an expired entry, stamp
entries with the probe start and never let an older probe overwrite a
newer one. Clear the refresh claim on drop so a panicking probe cannot
pin the stale list. Serialize the remaining cache test on test_env_lock
and add regression tests for stale-while-revalidate and the store order.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(pathjail): bound refresh claims and order probes per home (#2195)

Take over a refresh claim older than the TTL so a hung probe cannot pin
the stale allow-l

**File**: `rust/LOCK_ORDERING.md` (modified, +1/-0)
```diff
@@ -169,6 +169,7 @@ All `std::sync::Mutex` unless noted otherwise.
 | L142 | `RUNNING` | `core/phase_timing.rs:19` | `Mutex<BTreeMap<u64, (&'static str, Instant)>>` | Phase timers still running, one entry per guard, so `current()` names the newest; held only to insert, remove or read one entry; independent leaf lock, never nested |
 | L143 | `LEDGER` | `core/request_ledger.rs:134` | `Mutex<Ledger>` | Request ledger of a serving process (#2197): pending requests by id with method and stage, last tool completion, last initialize; held only to insert, update, remove or copy entries, released before `phase_timing::current()` (L142) or any I/O; independent leaf lock, never nested |
 | L144 | `VALIDATED_TIPS` | `core/ocla/unified_ledger.rs:273` | `Mutex<Vec<ValidatedTip>>` | Per ledger path, the prefix of the unified savings ledger this process already validated (#2196), so an append parses only newer records; taken only while the ledger's OS file lock is held, to copy, replace or drop one entry, never across I/O; independent leaf lock, never nested |
+| L145 | `HOME_ALLOW_DIRS_CACHE` | `core/pathjail.rs:422` | `Mutex<Option<(PathBuf, Instant, Vec<PathBuf>)>>` | IDE allow-dirs of one home with a 300 s TTL (#2195); only reached when IDE dirs are opt-in enabled. Held across the editor-registry probe on purpose as its single flight: every waiter needs the same list, so it never multiplies the probe nor serves an expired list. Any lock its callees (opencode config, detect resolvers, PATH lookups) take nests under L145 and must be recorded here |
 
 ### CLI cache transaction file lock
 
```

**File**: `rust/src/core/pathjail.rs` (modified, +23/-12)
```diff
@@ -392,18 +392,16 @@ fn home_allow_dirs(home: &Path, ide_dirs_allowed: bool) -> Vec<PathBuf> {
     }
     // The editor registry probes the filesystem and PATH for ~40 editors; the
     // jail runs on every path check, so resolve once per process and refresh
-    // on a TTL (#2195).
-    type Entry = Option<(PathBuf, std::time::Instant, Vec<PathBuf>)>;
-    static CACHE: std::sync::OnceLock<std::sync::Mutex<Entry>> = std::sync::OnceLock::new();
-    const TTL: std::time::Duration = std::time::Duration::from_secs(300);
-
-    let mut guard = CACHE
-        .get_or_init(|| std::sync::Mutex::new(None))
-        .lock()
-        .unwrap_or_else(std::sync::PoisonError::into_inner);
-    if let Some((cached_home, at, dirs)) = guard.as_ref()
+    // on a TTL (#2195). The lock is held across the probe on purpose: it is
+    // the single flight. Every caller that reaches it has IDE dirs enabled
+    // (opt-in) and needs this list, so waiting for one probe costs no more
+    // than probing itself, never multiplies the probe I/O, and never serves
+    // an expired allow-list. The TTL runs from when the list is stored.
+    // Lock ordering: L145.
+    let mut cache = lock_home_allow_dirs();
+    if let Some((cached_home, stored_at, dirs)) = cache.as_ref()
         && cached_home == home
-        && at.elapsed() < TTL
+        && stored_at.elapsed() < HOME_ALLOW_DIRS_TTL
     {
         return dirs.clone();
     }
@@ -412,10 +410,23 @@ fn home_allow_dirs(home: &Path, ide_dirs_allowed: bool) -> Vec<PathBuf> {
     let mut out = Vec::new();
     let targets = crate::core::editor_registry::build_targets(home);
     collect_ide_allow_dirs(home, &targets, &mut out);
-    *guard = Some((home.to_path_buf(), std::time::Instant::now(), out.clone()));
+    *cache = Some((home.to_path_buf(), std::time::Instant::now(), out.clone()));
     out
 }
 
+const HOME_ALLOW_DIRS_TTL: std::time::Duration = std::time::Duration::from_secs(300);
+
+/// The IDE allow-dirs of one home: (home, stored at, dirs).
+type HomeAllowDirsCache = Option<(PathBuf, std::time::Instant, Vec<PathBuf>)>;
+
+static HOME_ALLOW_DIRS_CACHE: std::sync::Mutex<HomeAllowDirsCache> = std::sync::Mutex::new(None);
+
+fn lock_home_allow_dirs() -> std::sync::MutexGuard<'static, HomeAllowDirsCache> {
+    HOME_ALLOW_DIRS_CACHE
+        .lock()
+        .unwrap_or_else(std::sync::PoisonError::into_inner)
+}
+
 #[cfg(test)]
 static HOME_ALLOW_DIRS_BUILDS: std::sync::atomic::AtomicUsize =
     std::sync::atomic::AtomicUsize::new(0);
```

**File**: `rust/src/core/pathjail_tests.rs` (modified, +27/-1)
```diff
@@ -238,6 +238,9 @@ fn ide_allow_dirs_are_registry_derived_and_skip_home() {
 // never appears here.
 #[test]
 fn ide_config_dirs_are_excluded_by_default() {
+    // home_allow_dirs shares one process-wide cache and build counter with
+    // home_allow_dirs_is_cached_per_home: serialize and start/leave it empty.
+    let _fresh = FreshHomeAllowDirsCache::new();
     let home = tempfile::tempdir().unwrap();
     for d in [".lean-ctx", ".cursor", ".codex"] {
         std::fs::create_dir_all(home.path().join(d)).unwrap();
@@ -1062,9 +1065,30 @@ fn cursor_agent_output_opens_only_for_the_own_workspace() {
     assert!(is_read_only_path(&app_log), "writes stay denied");
 }
 
+/// Holds `test_env_lock` and an empty home-allow-dirs cache for one test, and
+/// empties the cache again on drop (also when the test panics), so no test
+/// inherits another's entry.
+struct FreshHomeAllowDirsCache {
+    _env: crate::core::data_dir::TestEnvGuard,
+}
+
+impl FreshHomeAllowDirsCache {
+    fn new() -> Self {
+        let env = crate::core::data_dir::test_env_lock();
+        *lock_home_allow_dirs() = None;
+        Self { _env: env }
+    }
+}
+
+impl Drop for FreshHomeAllowDirsCache {
+    fn drop(&mut self) {
+        *lock_home_allow_dirs() = None;
+    }
+}
+
 #[test]
 fn home_allow_dirs_is_cached_per_home() {
-    let _env = crate::core::data_dir::test_env_lock();
+    let _fresh = FreshHomeAllowDirsCache::new();
     let home_a = tempfile::tempdir().unwrap();
     let home_b = tempfile::tempdir().unwrap();
     let builds = || HOME_ALLOW_DIRS_BUILDS.load(std::sync::atomic::Ordering::SeqCst);
@@ -1085,4 +1109,6 @@ fn home_allow_dirs_is_cached_per_home() {
 
     home_allow_dirs(home_b.path(), true);
     assert_eq!(builds(), before + 2, "a different home is recomputed");
+    home_allow_dirs(home_b.path(), true);
+    assert_eq!(builds(), before + 2, "the other home is stored and served");
 }
```

---

### Incident Patch 3: `178952e3` (2026-11-08)
**Commit Message**: fix(cockpit): start on Windows without console flashes and name the failure (#2203) (#2207)

* fix(cockpit): start the Cockpit on Windows without console flashes and name the failure (#2203)

Runtimes ran with a cleared environment and no SystemRoot, so on Windows
Winsock could not load and the Cockpit never bound its loopback port.
prepare_binary now sets SystemRoot from GetSystemWindowsDirectoryW and
starts runtimes with CREATE_NO_WINDOW. A server started only for a
failed open is stopped instead of retrying hidden. StartFailed names the
cause via --foreground logs, source builds are no longer told to install,
and the terminal hint appears once.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(cockpit): check the Windows runtime environment without the private TEMP workspace (#2203)

The private workspace under %TEMP% enforces its own owner checks, which a
CI runner's TEMP does not satisfy. The environment is now built by
runtime_command, which the test checks directly. Also adds the missing
SAFETY comments on the PATH restore in the find_on_path test (#2199),
which failed the test clippy pass.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored

**File**: `rust/crates/lean-ctx/src/cli/dispatch/network/cockpit_start.rs` (modified, +62/-3)
```diff
@@ -100,6 +100,10 @@ pub(crate) fn open(view: Option<&str>, rest: &[String]) -> Outcome {
             .and_then(|p| p.trim().parse().ok())
     });
     let (plan, record) = launch::plan_now(requested);
+    let started = matches!(
+        plan,
+        launch::Plan::Replace { .. } | launch::Plan::Start { .. }
+    );
     let (port, base_path) = match plan {
         launch::Plan::Reuse {
             port,
@@ -147,6 +151,14 @@ pub(crate) fn open(view: Option<&str>, rest: &[String]) -> Outcome {
         }
     };
     if let Some(reason) = warm(port, &base_path) {
+        // Nothing is opened, so a server started for this request is not
+        // left behind: hidden, it would retry the Cockpit on every later
+        // request it receives (#2203).
+        if started
+            && let Some(record) = launch::read_record().filter(|r| r.port == port && r.detached)
+        {
+            launch::stop_instance(&record);
+        }
         return Outcome::Unavailable(reason);
     }
     let token = dashboard::load_saved_token();
@@ -256,16 +268,22 @@ pub(crate) fn opened_line(view: Option<&str>, port: u16, base_path: &str) -> Str
     }
 }
 
-/// The one line when the Cockpit runtime cannot be served.
+/// The one line when the Cockpit runtime cannot be served: the reason and
+/// the action for it. The terminal alternative is [`TERMINAL_HINT`], added
+/// once by the caller.
 pub(crate) fn unavailable_line(reason: CockpitUnavailable) -> &'static str {
     match reason {
-        CockpitUnavailable::NotInstalled | CockpitUnavailable::SourceBuild => {
+        CockpitUnavailable::NotInstalled => {
             "Cockpit not installed \u{2014} lean-ctx cockpit install"
         }
         other => other.message(),
     }
 }
 
+/// The terminal alternative after a Cockpit that could not be opened. Plain
+/// `lean-ctx gain` would try to open the Cockpit again first.
+pub(crate) const TERMINAL_HINT: &str = "In the terminal: lean-ctx gain --terminal";
+
 /// `lean-ctx cockpit stop`: end this data dir's background server by its
 /// recorded PID. The exit code.
 pub(crate) fn stop() -> i32 {
@@ -371,9 +389,50 @@ mod tests {
             "Opened the Cockpit \u{2192} http://localhost:3334/c/"
         );
         assert_eq!(
-            unavailable_line(CockpitUnavailable::SourceBuild),
+            unavailable_line(CockpitUnavailable::NotInstalled),
             "Cockpit not installed \u{2014} lean-ctx cockpit install"
         );
         assert!(unavailable_line(CockpitUnavailable::Disabled).contains("cockpit install"));
     }
+
+    const ALL: [CockpitUnavailable; 5] = [
+        CockpitUnavailable::NotInstalled,
+        CockpitUnavailable::VerificationFailed,
+        CockpitUnavailable::StartFailed,
+        CockpitUnavailable::Disabled,
+        CockpitUnavailable::SourceBuild,
+    ];
+
+    /// #2203: `lean-ctx cockpit` printed "…; in the terminal: lean-ctx gain"
+    /// and then "In the terminal: lean-ctx gain --terminal". The reason line
+    /// names no terminal command; the hint follows exactly once.
+    #[test]
+    fn the_terminal_alternative_is_named_once() {
+        for reason in ALL {
+            let line = unavailable_line(reason);
+            assert!(!line.contains("lean-ctx gain"), "{reason:?}: {line}");
+            let output = format!("{line}\n{TERMINAL_HINT}");
+            assert_eq!(output.matches("lean-ctx gain").count(), 1, "{output}");
+        }
+        assert_eq!(TERMINAL_HINT, "In the terminal: lean-ctx gain --terminal");
+    }
+
+    /// #2203: a Cockpit that did not start was reported as "retried
+    /// automatically" with no way to see why. The line says what happened
+    /// and names a command that shows the cause; a source build is not told
+    /// to run an install it cannot do.
+    #[test]
+    fn each_reason_names_what_happened_and_an_action_that_works() {
+        let start = unavailable_line(CockpitUnavailable::StartFailed);
+        assert!(start.contains("installed but did not start"), "{start}");
+        assert!(start.contains("lean-ctx cockpit --foreground"), "{start}");
+        assert!(!start.contains("retried"), "{start}");
+        let source = unavailable_line(CockpitUnavailable::SourceBuild);
+        assert!(source.starts_with("Source build"), "{source}");
+        assert!(!source.contains("cockpit install"), "{source}");
+        for reason in ALL {
+            let line = unavailable_line(reason);
+            assert!(line.contains("lean-ctx ") || reason == CockpitUnavailable::SourceBuild);
+        }
+    }
 }
```

**File**: `rust/crates/lean-ctx/src/cli/dispatch/network/mod.rs` (modified, +1/-1)
```diff
@@ -426,7 +426,7 @@ pub(crate) fn cmd_cockpit(rest: &[String], view: Option<&str>) {
             }
             cockpit_start::Outcome::Unavailable(reason) => {
                 eprintln!("{}", cockpit_start::unavailable_line(reason));
-                eprintln!("\x1b[2mIn the terminal: lean-ctx gain --terminal\x1b[0m");
+                eprintln!("\x1b[2m{}\x1b[0m", cockpit_start::TERMINAL_HINT);
                 std::process::exit(1);
             }
             cockpit_start::Outcome::Failed(message) => {
```

**File**: `rust/src/core/intelligence_runtime/cockpit.rs` (modified, +24/-7)
```diff
@@ -106,7 +106,9 @@ impl CockpitUnavailable {
         }
     }
 
-    /// One line for a user who opens the Cockpit while it cannot be served.
+    /// One line for a user who opens the Cockpit while it cannot be served:
+    /// the reason and the one action that helps. The terminal alternative is
+    /// added once by the caller (CLI line, unavailable page), never here.
     pub const fn message(self) -> &'static str {
         match self {
             Self::NotInstalled => {
@@ -116,13 +118,13 @@ impl CockpitUnavailable {
                 "The installed Cockpit did not verify and was not started. Reinstall it with: lean-ctx cockpit install"
             }
             Self::StartFailed => {
-                "The Cockpit did not start. It is retried automatically; in the terminal: lean-ctx gain"
+                "The Cockpit is installed but did not start. See why: lean-ctx cockpit --foreground (it logs the cause)"
             }
             Self::Disabled => {
                 "The Cockpit is deactivated. Activate it again with: lean-ctx cockpit install"
             }
             Self::SourceBuild => {
-                "Source build: the Cockpit ships with official installs (install.sh, Homebrew, npm, AUR); in the terminal: lean-ctx gain"
+                "Source build: the Cockpit ships with official installs (install.sh, Homebrew, npm, AUR)"
             }
         }
     }
@@ -665,9 +667,10 @@ pub(super) fn handshake(
         .stdout(Stdio::piped())
         // Nothing the Cockpit writes there is shown; it could repeat a token.
         .stderr(Stdio::null());
-    let child = command
-        .spawn()
-        .map_err(|_| CockpitUnavailable::StartFailed)?;
+    let child = command.spawn().map_err(|error| {
+        tracing::warn!("cockpit not started: the process could not be spawned: {error}");
+        CockpitUnavailable::StartFailed
+    })?;
     let mut process = Process {
         child,
         stdin: None,
@@ -704,7 +707,18 @@ pub(super) fn handshake(
         process.port = port;
         Ok(process)
     } else {
+        let exited = process.child.try_wait().ok().flatten();
         process.stop(Duration::ZERO);
+        if let Some(status) = exited {
+            tracing::warn!(
+                "cockpit not started: it exited ({status}) before naming its loopback port"
+            );
+        } else {
+            tracing::warn!(
+                "cockpit not started: it did not name its loopback port within {} s",
+                deadline.as_secs()
+            );
+        }
         Err(CockpitUnavailable::StartFailed)
     }
 }
@@ -856,7 +870,10 @@ fn start(
     let cockpit_token = hex::encode(token);
     let start_line = start_line(launch, &cockpit_token).ok_or(CockpitUnavailable::StartFailed)?;
     let (prepared, command) = super::health::prepare_binary(&package.binary, &root, EXECUTABLE)
-        .map_err(|_| CockpitUnavailable::StartFailed)?;
+        .map_err(|error| {
+            tracing::warn!("cockpit not started: its private copy was not prepared ({error:?})");
+            CockpitUnavailable::StartFailed
+        })?;
     match handshake(command, &start_line, HANDSHAKE) {
         Ok(process) => Ok(Running {
             process,
```

**File**: `rust/src/core/intelligence_runtime/health.rs` (modified, +89/-13)
```diff
@@ -228,12 +228,27 @@ pub(super) fn prepare_binary(
     // Execute bytes authenticated above, not the separately mutable installed
     // inode. This is private process hygiene, not a hostile same-UID sandbox.
     install::write_new(&executable, binary, true)?;
-    let mut command = Command::new(&executable);
+    let command = runtime_command(&executable, &directory)?;
+    Ok((
+        Prepared {
+            workspace: temporary,
+            #[cfg(target_os = "linux")]
+            executable: executable_directory,
+        },
+        command,
+    ))
+}
+
+/// The runtime's process: its private directory as working directory, home
+/// and temporary directory, and a cleared environment with only what the OS
+/// itself needs.
+fn runtime_command(executable: &Path, directory: &Path) -> Result<Command> {
+    let mut command = Command::new(executable);
     command
-        .current_dir(&directory)
+        .current_dir(directory)
         .env_clear()
-        .env("HOME", &directory)
-        .env("TMPDIR", &directory);
+        .env("HOME", directory)
+        .env("TMPDIR", directory);
     // libdbus discovers the logged-in user's Secret Service through this
     // standard location. Never inherit a caller-selected remote D-Bus address.
     #[cfg(target_os = "linux")]
@@ -243,15 +258,42 @@ pub(super) fn prepare_binary(
         command.env("XDG_RUNTIME_DIR", format!("/run/user/{uid}"));
     }
     #[cfg(windows)]
-    command.env("TEMP", &directory).env("TMP", &directory);
-    Ok((
-        Prepared {
-            workspace: temporary,
-            #[cfg(target_os = "linux")]
-            executable: executable_directory,
-        },
-        command,
-    ))
+    {
+        use std::os::windows::process::CommandExt as _;
+        // Winsock resolves its service providers under %SystemRoot%: with a
+        // cleared environment a runtime cannot open any socket (WSAStartup
+        // fails with WSAEPROVIDERFAILEDINIT), so the Cockpit never binds its
+        // loopback port (#2203). The value comes from the OS, not from the
+        // caller's environment.
+        command
+            .env("TEMP", directory)
+            .env("TMP", directory)
+            .env("SystemRoot", windows_directory()?);
+        // The runtimes are console programs. Started from a process without a
+        // console (the detached Cockpit server), each start would otherwise
+        // open, and on exit close, a console window of its own (#2203).
+        command.creation_flags(CREATE_NO_WINDOW);
+    }
+    Ok(command)
+}
+
+/// `CreateProcessW` flag: the child gets no console window.
+#[cfg(windows)]
+const CREATE_NO_WINDOW: u32 = windows_sys::Win32::System::Threading::CREATE_NO_WINDOW;
+
+/// The Windows directory as the OS reports it (the value of `%SystemRoot%`).
+#[cfg(windows)]
+fn windows_directory() -> std::io::Result<std::ffi::OsString> {
+    use std::os::windows::ffi::OsStringExt as _;
+    use windows_sys::Win32::System::SystemInformation::GetSystemWindowsDirectoryW;
+    let mut buffer = vec![0_u16; 32_768];
+    // SAFETY: buffer is writable for the exact advertised WCHAR capacity.
+    let length =
+        unsafe { GetSystemWindowsDirectoryW(buffer.as_mut_ptr(), buffer.len() as u32) } as usize;
+    if length == 0 || length >= buffer.len() {
+        return Err(std::io::Error::last_os_error());
+    }
+    Ok(std::ffi::OsString::from_wide(&buffer[..length]))
 }
 
 /// Exact supported descriptions only; unknown capability sets never execute.
@@ -494,6 +536,40 @@ pub(super) fn supports_protection(package: &VerifiedPackage) -> bool {
 mod tests {
     use super::*;
 
+    /// #2203: a runtime started with a cleared environment and no
+    /// `SystemRoot` cannot open a socket on Windows, so the Cockpit never
+    /// named its port. The OS value is set, nothing else is inherited.
+    #[cfg(windows)]
+    #[test]
+    fn a_windows_runtime_gets_the_system_root_and_nothing_inherited() {
+        // The environment alone: the private workspace beside %TEMP% has its
+        // own owner checks, which a CI runner's TEMP does not satisfy.
+        let directory = tempfile::tempdir().unwrap();
+        let command = runtime_command(
+            &directory.path().join("leanctx-cockpit.exe"),
+            directory.path(),
+        )
+        .unwrap();
+        let envs: std::collections::BTreeMap<String, Option<String>> = command
+            .get_envs()
+            .map(|(name, value)| {
+                (
+                    name.to_string_lossy().to_ascii_uppercase(),
+                    value.map(|value| value.to_string_lossy().into_owned()),
+                )
+            })
+            .collect();
+        let system_root = windows_directory().unwrap().to_string_lossy().into_owned();
+        assert_eq!(
+            envs.get("SYSTEMROOT"),
+            Some(&Some(system_root.clone())),
+            "{envs:?}"
+        );
+        assert!(std::path::Path::new(&system_root).join("System3
```

**File**: `rust/src/core/pathutil.rs` (modified, +2/-0)
```diff
@@ -746,7 +746,9 @@ mod tests {
         let found = find_on_path("leanctx-fop-probe");
         let missing = find_on_path("leanctx-fop-definitely-missing");
         match old {
+            // SAFETY: serialized by test_env_lock; restores the saved PATH.
             Some(v) => unsafe { std::env::set_var("PATH", v) },
+            // SAFETY: serialized by test_env_lock; PATH was unset before.
             None => unsafe { std::env::remove_var("PATH") },
         }
 
```

#### Recent Merged Pull Requests:
- **PR #2211** (2026-11-08): fix(pathjail): document the IDE allow-dirs single flight as L145, fix cache test race (#2195) (@yvgude)
- **PR #2210** (2026-11-08): feat(agents): add Muse Code agent target (#2198) (@yvgude)
- **PR #2209** (2026-11-08): fix(server): never block tool dispatch on observation persistence; request ledger (#2196, #2197) (@yvgude)
- **PR #2208** (2026-11-08): fix(shell): curl/wget output files after an unfollowable cd (#2201); honour excluded_commands in the hook rewrite (#2194) (@yvgude)
- **PR #2207** (2026-11-08): fix(cockpit): start on Windows without console flashes and name the failure (#2203) (@yvgude)
- **PR #2206** (2026-11-07): fix(shell): honour functions defined in the hook's brace group (#2202) (@yvgude)

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

## X. server): never block tool dispatch on observation persistence; request ledger (#

**RULE**:
When implementing operations in `rust/LOCK_ORDERING.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yvgude/lean-ctx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1f3e7a72`: server): never block tool dispatch on observation persistence; request ledger (#2196, #2197) (#2209). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `rust/LOCK_ORDERING.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
| L143 | `LEDGER` | `core/request_ledger.rs:134` | `Mutex<Ledger>` | Request ledger of a serving process (#2197): pending requests by id with method and stage, last tool completion, last initialize; held only to insert, update, remove or copy entries, released before `phase_timing::current()` (L142) or any I/O; independent leaf lock, never nested |
| L144 | `VALIDATED_TIPS` | `core/ocla/unified_ledger.rs:273` | `Mutex<Vec<ValidatedTip>>` | Per ledger path, the prefix of the unified savings ledger this process already validated (#2196), so an append parses only newer records; taken only while the ledger's OS file lock is held, to copy, replace or drop one entry, never across I/O; independent leaf lock, never nested |
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1f3e7a72` are properly handled with clean fallback behavior.
