# Forensic Learning Record (Deep Inspection): nanocoai/nanoclaw

> **Canonical Artifact**: `07_PROJECT_LEARNING/nanocoai-nanoclaw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nanocoai/nanoclaw](https://github.com/nanocoai/nanoclaw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:21:01.118Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nanocoai/nanoclaw`
- **Description**: A lightweight alternative to OpenClaw that runs in containers for security. Connects to WhatsApp, Telegram, Slack, Discord, Gmail and other messaging apps,, has memory, scheduled jobs, and runs directly on Anthropic's Agents SDK
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 30863 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/add-atomic-chat-tool/atomic-chat-env.ts`
```
/**
 * Host-side env forwarding for the Atomic Chat MCP tool: any `ATOMIC_CHAT_*`
 * host overrides, as spec-shaped env (a record) — argv never crosses
 * composition anymore.
 *
 * The reach-in spreads this into the CONTRIBUTED env lane
 * (`ContainerSpec.contributedEnv`), not the composed literal:
 * `ATOMIC_CHAT_API_KEY` is credential-NAMED, and the composed lane's key-name
 * check would refuse it and deny the spawn. The contributed lane exempts the
 * name and still refuses credential-shaped VALUES — which is the right rule
 * for a local service token.
 *
 * Lives in its own file so the reach-in in `container-runner.ts` is a single
 * spread and this logic is behavior-testable in isolation.
 */
export function atomicChatEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (process.env.ATOMIC_CHAT_HOST) {
    env.ATOMIC_CHAT_HOST = process.env.ATOMIC_CHAT_HOST;
  }
  if (process.env.ATOMIC_CHAT_API_KEY) {
    env.ATOMIC_CHAT_API_KEY = process.env.ATOMIC_CHAT_API_KEY;
  }
  return env;
}

```

### Core Architecture Module: `.claude/skills/add-atomic-chat-tool/atomic-chat-mcp-stdio.ts`
```
/**
 * Atomic Chat MCP Server for NanoClaw
 * Exposes local Atomic Chat models (OpenAI-compatible, /v1) as tools for the container agent.
 * Uses host.docker.internal to reach the host's Atomic Chat desktop app from Docker.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import fs from 'fs';
import path from 'path';

const ATOMIC_CHAT_HOST =
  process.env.ATOMIC_CHAT_HOST || 'http://host.docker.internal:1337';
const ATOMIC_CHAT_API_KEY = process.env.ATOMIC_CHAT_API_KEY || '';
const ATOMIC_CHAT_STATUS_FILE = '/workspace/ipc/atomic_chat_status.json';

function log(msg: string): void {
  console.error(`[ATOMIC] ${msg}`);
}

function writeStatus(status: string, detail?: string): void {
  try {
    const data = { status, detail, timestamp: new Date().toISOString() };
    const tmpPath = `${ATOMIC_CHAT_STATUS_FILE}.tmp`;
    fs.mkdirSync(path.dirname(ATOMIC_CHAT_STATUS_FILE), { recursive: true });
    fs.writeFileSync(tmpPath, JSON.stringify(data));
    fs.renameSync(tmpPath, ATOMIC_CHAT_STATUS_FILE);
  } catch {
    /* best-effort */
  }
}

async function atomicFetch(
  apiPath: string,
  options?: RequestInit,
): Promise<Response> {
  const url = `${ATOMIC_CHAT_HOST}${apiPath}`;
  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (ATOMIC_CHAT_API_KEY) {
    headers.Authorization = `Bearer ${ATOMIC_CHAT_API_KEY}`;
  }
  const finalOptions: RequestInit = { ...options, headers };
  try {
    return await fetch(url, finalOptions);
  } catch (err) {
    // Fallback to localhost if host.docker.internal fails
    if (ATOMIC_CHAT_HOST.includes('host.docker.internal')) {
      const fallbackUrl = url.replace('host.docker.internal', 'localhost');
      return await fetch(fallbackUrl, finalOptions);
    }
    throw err;
  }
}

const server = new McpServer({
  name: 'atomic_chat',
  version: '1.0.0',
});

server.tool(
  'atomic_chat_list_models',
  'List all models available in the local Atomic Chat desktop app. Use this to see which models are loaded before calling atomic_chat_generate.',
  {},
  async () => {
    log('Listing models...');
    writeStatus('listing', 'Listing available models');
    try {
      const res = await atomicFetch('/v1/models');
      if (!res.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Atomic Chat API error: ${res.status} ${res.statusText}`,
            },
          ],
          isError: true,
        };
      }

      const data = (await res.json()) as {
        data?: Array<{ id: string; owned_by?: string }>;
      };
      const models = data.data || [];

      if (models.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No models available. Open Atomic Chat on the host and download a model from the Hub.',
            },
          ],
        };
      }

      const list = models
        .map((m) => `- ${m.id}${m.owned_by ? ` (${m.owned_by})` : ''}`)
        .join('\n');

      log(`Found ${models.length} models`);
      return {
        content: [
          { type: 'text' as const, text: `Available models:\n${list}` },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to connect to Atomic Chat at ${ATOMIC_CHAT_HOST}: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  'atomic_chat_generate',
  'Send a prompt to a local Atomic Chat model and get a response. Good for cheaper/faster tasks like summarization, translation, or general queries. Use atomic_chat_list_models first to see available models.',
  {
    model: z
      .string()
      .describe(
        'The model ID as returned by atomic_chat_list_models (e.g. "llama3.2-3b-instruct")',
      ),
    prompt: z.string().describe('The prompt to send to the model'),
    system: z
      .string()
      .optional()
      .describe('Optional system prompt to set model behavior'),
    temperature: z
      .number()
      .optional()
      .describe('Sampling temperature (0.0–2.0). Defaults to model default.'),
    max_tokens: z
      .number()
      .optional()
      .describe('Maximum number of tokens to generate in the response.'),
  },
  async (args) => {
    log(`>>> Generating with ${args.model} (${args.prompt.length} chars)...`);
    writeStatus('generating', `Generating with ${args.model}`);
    try {
      const messages: Array<{ role: string; content: string }> = [];
      if (args.system) {
        messages.push({ role: 'system', content: args.system });
      }
      messages.push({ role: 'user', content: args.prompt });

      const body: Record<string, unknown> = {
        model: args.model,
        messages,
        stream: false,
      };
      if (args.temperature !== undefined) body.temperature = args.temperature;
      if (args.max_tokens !== undefined) body.max_tokens = args.max_tokens;

      const startedAt = Date.now();
      const res = await atomicFetch('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          content: [
            {
              type: 'text' as const,
              text: `Atomic Chat error (${res.status}): ${errorText}`,
            },
          ],
          isError: true,
        };
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      const response = data.choices?.[0]?.message?.content ?? '';
      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      const completionTokens = data.usage?.completion_tokens;

      const meta = `\n\n[${args.model} | ${elapsedSec}s${
        completionTokens !== undefined ? ` | ${completionTokens} tokens` : ''
      }]`;

      log(
        `<<< Done: ${args.model} | ${elapsedSec}s | ${
          completionTokens ?? '?'
        } tokens | ${response.length} chars`,
      );
      writeStatus(
        'done',
        `${args.model} | ${elapsedSec}s | ${completionTokens ?? '?'} tokens`,
      );

      return { content: [{ type: 'text' as const, text: response + meta }] };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to call Atomic Chat: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

```

### Core Architecture Module: `.claude/skills/add-clidash/add/tools/clidash/activity.js`
```
// Message-activity reader for clidash.
//
// ncl has no `messages` resource — message data lives in the per-session SQLite
// DBs (`data/v2-sessions/<group>/<session>/{inbound,outbound}.db`). We read them
// read-only with Node's built-in `node:sqlite` (no new dependency) and aggregate
// per-session in/out totals + a daily time-series for charting.

import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Timestamps come in two shapes across tables: SQLite "YYYY-MM-DD HH:MM:SS" (UTC)
// and already-ISO "YYYY-MM-DDTHH:MM:SS.sssZ". Normalize to a comparable ISO form
// so date-bucketing and max("last") work regardless of which a row used.
function normTs(ts) {
  if (typeof ts !== 'string' || ts.length < 10) return null;
  if (ts.includes('T')) return ts; // already ISO
  return `${ts.replace(' ', 'T')}Z`;
}

// Local calendar day "YYYY-MM-DD" — chart labels are read by a human, so
// bucket by the server's local day, not the UTC date prefix.
function localDay(date) {
  return date.toLocaleDateString('sv-SE');
}

function readTable(dbPath, table) {
  let db;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db.prepare(`SELECT timestamp FROM ${table}`).all();
    const byDay = new Map();
    let last = null;
    for (const r of rows) {
      const ts = normTs(r.timestamp);
      if (!ts) continue;
      const day = localDay(new Date(ts));
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      if (last === null || ts > last) last = ts;
    }
    return { total: rows.length, byDay, last };
  } catch {
    return { total: 0, byDay: new Map(), last: null }; // missing/locked/corrupt → skip
  } finally {
    try { db?.close(); } catch { /* already closed */ }
  }
}

function listDirs(path) {
  try {
    return readdirSync(path, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Aggregate message activity across all session DBs under `sessionsRoot`.
 * @returns {{ sessions: Array, series: Array<{date,in,out}> }}
 *   sessions — per session: { agent_group_id, session_id, in, out, lastActivity }
 *   series   — one bucket per day for the last `days` days (local time, newest last)
 */
export function collectActivity(sessionsRoot, days, now) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(localDay(new Date(now.getTime() - i * 86_400_000)));
  }
  const series = new Map(dates.map((d) => [d, { date: d, in: 0, out: 0 }]));
  const sessions = [];

  for (const group of listDirs(sessionsRoot)) {
    for (const session of listDirs(join(sessionsRoot, group))) {
      const base = join(sessionsRoot, group, session);
      // a real session dir has at least one of the two message DBs; skip shared
      // scaffolding dirs like `.claude-shared` that don't.
      if (!existsSync(join(base, 'inbound.db')) && !existsSync(join(base, 'outbound.db'))) continue;
      const inb = readTable(join(base, 'inbound.db'), 'messages_in');
      const out = readTable(join(base, 'outbound.db'), 'messages_out');
      const lastActivity = [inb.last, out.last].filter(Boolean).sort().at(-1) ?? null;
      sessions.push({ agent_group_id: group, session_id: session, in: inb.total, out: out.total, lastActivity });
      for (const [day, n] of inb.byDay) series.get(day)?.in !== undefined && (series.get(day).in += n);
      for (const [day, n] of out.byDay) series.get(day)?.out !== undefined && (series.get(day).out += n);
    }
  }
  return { sessions, series: dates.map((d) => series.get(d)) };
}

```

### Core Architecture Module: `.claude/skills/add-clidash/add/tools/clidash/logs.js`
```
// Log tailing for clidash — reads the last N lines of an allowlisted log file
// and strips ANSI color codes (the host logger writes colored output).

import { readFile } from 'node:fs/promises';

const ANSI_RE = /\x1b\[[0-9;]*m/g;

/**
 * Last `maxLines` lines of a log file, ANSI-stripped.
 * @returns {{ lines: string[], text: string }}
 */
export async function tailFile(path, maxLines) {
  const raw = (await readFile(path, 'utf8')).replace(ANSI_RE, '');
  const all = raw.split('\n');
  if (all.length && all.at(-1) === '') all.pop(); // drop trailing newline's empty field
  const lines = all.slice(-maxLines);
  return { lines, text: lines.join('\n') };
}

```

### Core Architecture Module: `.claude/skills/add-clidash/add/tools/clidash/parsers.js`
```
// Pluggable parsers for clidash.
//
// discoveryParsers — turn a CLI's "help"-style output into a resource list.
// parseOutput / unwrapPath — turn a CLI's list output into rows.
// All per-CLI knowledge beyond these small functions lives in clidash.config.json.

/**
 * Discovery parsers, keyed by the `discover.parser` name in config.
 * Each receives the raw discovery output and returns
 * [{ name, description, verbs }] for resources that support `list`.
 * They must throw loudly on unrecognized formats — silent empty results
 * would render as silently-stale tabs.
 */
export const discoveryParsers = {
  /**
   * Parses ncl's two-column help format:
   *
   *   Resources:
   *     sessions             Session — the runtime unit. ...
   *                          verbs: list, get
   *   Commands:
   *     help                 ...
   */
  'ncl-help'(text) {
    const lines = String(text).split('\n');
    const start = lines.findIndex((l) => l.trim() === 'Resources:');
    if (start === -1) {
      throw new Error('ncl-help parser: no "Resources:" section in output — format may have changed');
    }
    const resources = [];
    let current = null;
    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      if (/^\S/.test(line)) break; // next top-level section, e.g. "Commands:"
      const verbsMatch = line.match(/^\s+verbs:\s*(.+)$/);
      if (verbsMatch && current) {
        current.verbs = verbsMatch[1].split(',').map((v) => v.trim()).filter(Boolean);
        continue;
      }
      const resMatch = line.match(/^  (\S+)\s{2,}(\S.*)$/);
      if (resMatch) {
        current = { name: resMatch[1], description: resMatch[2].trim(), verbs: [] };
        resources.push(current);
      }
    }
    return resources.filter((r) => r.verbs.includes('list'));
  },
};

/**
 * Parses a CLI's list output per the config's `output` field.
 * - 'json'      — one JSON document.
 * - 'jsonlines' — one JSON object per line (docker/kubectl style).
 * Thrown errors carry the raw output on `err.raw` so the UI can show it.
 */
export function parseOutput(text, format) {
  if (format === 'json') {
    try {
      return JSON.parse(text);
    } catch (e) {
      const err = new Error(`Invalid JSON output: ${e.message}`);
      err.raw = text;
      throw err;
    }
  }
  if (format === 'jsonlines') {
    const rows = [];
    const lines = String(text).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        rows.push(JSON.parse(line));
      } catch (e) {
        const err = new Error(`Invalid JSON on line ${i + 1}: ${e.message}`);
        err.raw = text;
        throw err;
      }
    }
    return rows;
  }
  throw new Error(`Unknown output format: ${format}`);
}

/**
 * Follows a dot-path into a response envelope (e.g. 'data' for ncl's
 * {id, ok, data} frame). No path → value passes through unchanged.
 * Missing path throws — a changed envelope must fail loudly.
 */
export function unwrapPath(value, path) {
  if (!path) return value;
  let cur = value;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(key in cur)) {
      throw new Error(`Unwrap path "${path}" not found in CLI output (missing "${key}")`);
    }
    cur = cur[key];
  }
  return cur;
}

```

### Core Architecture Module: `.claude/skills/add-clidash/add/tools/clidash/public/app.js`
```
// clidash frontend — vanilla JS, no build step.
//
// Layout: a left sidebar with top-level items (Overview, Activity) and grouped
// sections (one per CLI — ncl, docker — and a Files section for on-disk docs).
// Each page shows the exact command that produced it. Tables auto-derive from
// `ncl <resource> list --json`; rows drill into their `get` detail.
//
// Refresh UX: on first load every resource of every CLI is prefetched so nav is
// instant. 60s auto-refresh + a manual button. Background refreshes diff-and-
// inject (the data DOM rebuilds only when the data signature changes).

import { mdToHtml } from './md.js';

const $ = (id) => document.getElementById(id);

const state = {
  clis: [],
  docCollections: [],
  activeView: 'overview',   // 'overview' | 'activity' | 'r:<cli>:<resource>' | 'doc:<collection>'
  paused: false,
  refreshSeconds: 60,
  lastUpdated: null,
  refreshing: false,
  snapshots: new Map(),     // "cli/resource" -> { rows, fetchedAt, command }
  errors: new Map(),
  activity: null,           // { sessions, series }
  activityConfigured: false,
  activityCommand: null,
  logs: [],                 // [{ name, label }]
  logCache: new Map(),      // name -> { text, command }
  activeDocPath: null,
  openDocGroups: new Set(), // which doc groups (e.g. agents) are expanded
  docCache: new Map(),
  configCache: new Map(),   // groupId -> container config (for the overview page)
  helpCache: new Map(),     // "cli/resource" -> help text | null (prefetched each cycle)
  detail: null,
  sidebarOpen: false,
  renderedSig: null,
};

const SVG_NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of [].concat(children)) if (c != null) node.append(c);
  return node;
}

// Lucide-style inline icons (static trusted markup) — crisp, themeable via currentColor.
const ICONS = {
  overview: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  activity: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  terminal: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m6 9 3 3-3 3"/><path d="M13 15h4"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
  logs: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M8 13h8"/><path d="M8 17h5"/>',
};
function icon(name) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.innerHTML = ICONS[name] ?? '';
  return s;
}

// ---------------------------------------------------------------- helpers

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// Local wall time "YYYY-MM-DD HH:mm" — the raw ISO string is UTC; slicing it
// would display UTC wall time with no marker, masquerading as local.
function absTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

function relTime(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso;
  const s = Math.round(ms / 1000);
  if (s < 0) return new Date(iso).toLocaleString();
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function coarseAgo(date) {
  const s = (Date.now() - date.getTime()) / 1000;
  if (s < 60) return 'less than a minute ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m === 1 ? '1 minute ago' : `${m} minutes ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? '1 hour ago' : `${h} hours ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

function staleness(lastActive) {
  if (!lastActive) return 'gray';
  const min = (Date.now() - new Date(lastActive).getTime()) / 60000;
  if (Number.isNaN(min)) return 'gray';
  return min < 15 ? 'green' : min < 120 ? 'amber' : 'red';
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function fmtValue(value) {
  if (value === null || value === undefined) return { text: 'null', cls: 'null' };
  if (typeof value === 'string' && ISO_RE.test(value)) return { iso: value };
  return { text: typeof value === 'object' ? JSON.stringify(value) : String(value) };
}

function cellFor(value) {
  const f = fmtValue(value);
  if (f.cls === 'null') return el('td', { class: 'null' }, 'null');
  if (f.iso) {
    return el('td', {}, el('span', { class: 'reltime', title: f.iso }, [
      relTime(f.iso), el('span', { class: 'abs' }, absTime(f.iso)),
    ]));
  }
  if (f.text.length > 42) {
    const span = el('span', { class: 'trunc', title: f.text }, f.text.slice(0, 39) + '…');
    span.addEventListener('click', (e) => { e.stopPropagation(); span.textContent = f.text; span.classList.remove('trunc'); });
    return el('td', {}, span);
  }
  return el('td', {}, f.text);
}

function kvRows(obj) {
  return Object.entries(obj ?? {}).map(([k, v]) => {
    let valEl;
    if (v && typeof v === 'object') valEl = el('pre', { class: 'kv-json' }, JSON.stringify(v, null, 2));
    else if (typeof v === 'string' && ISO_RE.test(v)) valEl = el('span', { class: 'reltime', title: v }, `${relTime(v)}  (${absTime(v)})`);
    else if (v === null || v === undefined) valEl = el('span', { class: 'null' }, 'null');
    else valEl = el('span', {}, String(v));
    return el('div', { class: 'kv-row' }, [el('span', { class: 'kv-key' }, k), valEl]);
  });
}

function resolveRef(cliName, ref, id) {
  const snap = state.snapshots.get(`${cliName}/${ref.ref}`);
  const row = snap?.rows?.find((r) => String(r.id) === String(id));
  return row ? (row[ref.label] ?? null) : null;
}

function badgeChip(value, colorMap) {
  const color = colorMap[String(value).toLowerCase()] ?? 'gray';
  return el('span', { class: `badge-status ${color}` }, [el('span', { class: `dot ${color}` }), String(value)]);
}

function buildCell(value, column, ctx) {
  if (ctx.badges?.[column] && value != null && typeof value !== 'object') {
    return el('td', {}, badgeChip(value, ctx.badges[column]));
  }
  if (ctx.enrich?.[column] && value != null) {
    const name = resolveRef(ctx.cliName, ctx.enrich[column], value);
    if (name != null) {
      return el('td', { class: 'enriched', title: String(value) }, [
        el('span', {}, String(name)), el('span', { class: 'raw-id' }, String(value)),
      ]);
    }
  }
  return cellFor(value);
}

function summaryBar(resource, rows, col, cli) {
  let label = resource.replace(/-/g, ' ');
  if (rows.length === 1 && label.endsWith('s')) label = label.slice(0, -1);
  const bits = [el('span', { class: 'sum-count' }, `${rows.length} ${label}`)];
  if (col && rows.some((r)
```

### Core Architecture Module: `.claude/skills/add-clidash/add/tools/clidash/public/md.js`
```
// Minimal, dependency-free, XSS-safe markdown → HTML for clidash's file viewer
// (SKILL.md / CLAUDE.md). Pure string functions, no DOM — importable in both the
// browser (app.js) and node tests.
//
// Safety model: the ENTIRE source is HTML-escaped first, so no raw markup from a
// file can reach innerHTML. Markdown transforms then emit only tags this module
// generates. Link hrefs are taken from the URL capture group and gated to an
// http(s) scheme, so a `javascript:`/`data:` URL (or one smuggled via link text)
// can never become an executable href.

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function mdToHtml(src) {
  const lines = escapeHtml(src).split('\n');
  const out = [];
  let i = 0;
  const inline = (t) => t
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (m, text, url) =>
      /^https?:\/\//i.test(url) ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>` : m);
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre class="code"><code>${buf.join('\n')}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^\s*([-*])\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*([-*])\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*([-*])\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^\s*>\s?/.test(line)) { out.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ''))}</blockquote>`); i++; continue; }
    if (line.trim() === '') { i++; continue; }
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6}\s|```|\s*[-*]\s|\s*\d+\.\s|\s*>)/.test(lines[i])) {
      para.push(lines[i++]);
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

```

### Core Architecture Module: `.claude/skills/add-clidash/add/tools/clidash/server.js`
```
// clidash — CLI-agnostic read-only web dashboard.
// Node built-ins only. All per-CLI knowledge lives in clidash.config.json;
// the only per-CLI code is optional view plugins (views/) and discovery
// parsers (parsers.js).
//
// Security model: the server can only exec the configured argv templates.
// `{resource}` is the sole substitution and is validated against the
// discovered/static resource set before exec. execFile, never a shell.

import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve, sep, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { discoveryParsers, parseOutput, unwrapPath } from './parsers.js';
import { globFiles, describeFile, resolveDoc } from './docs.js';
import { collectActivity } from './activity.js';
import { tailFile } from './logs.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const MAX_DOC_BYTES = 2 * 1024 * 1024; // cap a single served document at 2 MB

const DEFAULTS = {
  bind: '127.0.0.1',
  port: 4690,
  refreshSeconds: 60,
  execTimeoutMs: 10_000,
  discoveryTtlMs: 60_000,
};

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

export function createApp(userConfig) {
  const config = { ...DEFAULTS, ...userConfig };
  const publicDir = resolve(config.publicDir ?? join(MODULE_DIR, 'public'));
  const viewsDir = resolve(config.viewsDir ?? join(MODULE_DIR, 'views'));

  // Human-readable form of a command, for display in the UI ("the command run").
  const displayCmd = (bin, args) => `${basename(bin)} ${args.join(' ')}`;

  // ---- exec --------------------------------------------------------------

  function execCli(cliCfg, args, label) {
    return new Promise((resolvePromise, rejectPromise) => {
      execFile(cliCfg.bin, args, {
        cwd: cliCfg.cwd,
        timeout: config.execTimeoutMs,
        maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, ...cliCfg.env },
      }, (error, stdout, stderr) => {
        if (error) {
          const timedOut = error.killed || error.signal === 'SIGTERM';
          const detail = stderr.trim() || error.message;
          const msg = timedOut
            ? `${label} timed out after ${config.execTimeoutMs}ms`
            : `${label} failed: ${detail}`;
          rejectPromise(new Error(msg));
          return;
        }
        resolvePromise(stdout);
      });
    });
  }

  // ---- resource discovery (cached, coalesced, keeps last good) -----------

  const discoveryCache = new Map(); // cli -> { at, resources }
  const discoveryInflight = new Map(); // cli -> Promise

  async function discoverResources(cliName) {
    const cliCfg = config.clis[cliName];
    if (cliCfg.resources) {
      return cliCfg.resources.map((name) =>
        typeof name === 'string' ? { name, description: '' } : name,
      );
    }
    const cached = discoveryCache.get(cliName);
    if (cached && Date.now() - cached.at < config.discoveryTtlMs) return cached.resources;
    if (discoveryInflight.has(cliName)) return discoveryInflight.get(cliName);

    const parser = discoveryParsers[cliCfg.discover.parser];
    if (!parser) throw new Error(`Unknown discovery parser: ${cliCfg.discover.parser}`);
    const promise = execCli(cliCfg, cliCfg.discover.args, `${cliName} discovery`)
      .then((stdout) => {
        const resources = parser(stdout);
        discoveryCache.set(cliName, { at: Date.now(), resources });
        return resources;
      })
      .finally(() => discoveryInflight.delete(cliName));
    discoveryInflight.set(cliName, promise);
    return promise;
  }

  // ---- row fetching (coalesced per cli+resource) --------------------------

  const listInflight = new Map(); // "cli\0resource" -> Promise

  async function fetchRows(cliName, resourceName) {
    const cliCfg = config.clis[cliName];
    const resources = await discoverResources(cliName);
    if (!resources.some((r) => r.name === resourceName)) {
      const err = new Error(`Unknown resource "${resourceName}" for CLI "${cliName}"`);
      err.statusCode = 404;
      throw err;
    }
    const key = `${cliName}\0${resourceName}`;
    if (listInflight.has(key)) return listInflight.get(key);

    // {resource} may appear as a whole arg or inside one (e.g. an ssh remote
    // command). Safe either way — the value is allowlist-validated above.
    const args = cliCfg.list.map((a) => a.replaceAll('{resource}', resourceName));
    const promise = execCli(cliCfg, args, `${cliName} ${resourceName} list`)
      .then((stdout) => {
        const parsed = parseOutput(stdout, cliCfg.output ?? 'json');
        const rows = unwrapPath(parsed, cliCfg.unwrap);
        if (!Array.isArray(rows)) {
          const err = new Error(`${cliName} ${resourceName}: expected an array of rows`);
          err.raw = stdout;
          throw err;
        }
        return rows;
      })
      .finally(() => listInflight.delete(key));
    listInflight.set(key, promise);
    return promise;
  }

  // ---- detail commands (drill-down: get, config-get, …) -------------------

  const cmdInflight = new Map();
  const ID_RE = /^[A-Za-z0-9:_.-]+$/; // ncl ids / uuids; no shell metas (and execFile never shells)

  async function runCommand(cliName, cmdName, resourceName, id) {
    const cliCfg = config.clis[cliName];
    const template = cliCfg.commands?.[cmdName];
    if (!template) {
      const err = new Error(`Unknown command "${cmdName}"`);
      err.statusCode = 404;
      throw err;
    }
    const needsResource = template.includes('{resource}');
    if (needsResource) {
      const resources = await discoverResources(cliName);
      if (!resources.some((r) => r.name === resourceName)) {
        const err = new Error(`Unknown resource "${resourceName}"`);
        err.statusCode = 404;
        throw err;
      }
    }
    if (template.includes('{id}') && !ID_RE.test(id ?? '')) {
      const err = new Error('Invalid id');
      err.statusCode = 400;
      throw err;
    }
    const key = `${cliName}\0${cmdName}\0${resourceName}\0${id}`;
    if (cmdInflight.has(key)) return cmdInflight.get(key);
    const args = template.map((a) => a.replaceAll('{resource}', resourceName ?? '').replaceAll('{id}', id ?? ''));
    const promise = execCli(cliCfg, args, `${cliName} ${cmdName}`)
      .then((stdout) => unwrapPath(parseOutput(stdout, cliCfg.output ?? 'json'), cliCfg.unwrap))
      .finally(() => cmdInflight.delete(key));
    cmdInflight.set(key, promise);
    return promise;
  }

  // ---- per-resource help (raw text from `<cli> <resource> help`) -----------

  const helpInflight = new Map();
  async function runHelp(cliName, resourceName) {
    const cliCfg = config.clis[cliName];
    if (!cliCfg.help) { const e = new Error(`No help for "${cliName}"`); e.statusCode = 404; throw e; }
    const resources = await discoverResources(cliName);
    if (!resources.some((r) => r.name === resourceName)) {
      const e = new Error(`Unknown resource "${resourceName}"`); e.statusCode = 404; throw e;
    }
    const key = `${cliName}\0${resourceName}`;
    if (helpInflight.has(key)) return helpInflight.get(key);
    const args = cliCfg.help.map((a) => a.replaceAll('{resource}', resourceName));
    const promise = execCli(cliCfg, args, `${cliName} ${resourceName} help`).finally(() => helpInflight.delete(key));
    helpInflight.set(key, promise);
    return promise;
  }

  // ---- view plugins --------------------------------------------------------

  async function listViews(cliName) {
    try {
      const files = await readdir(viewsDir);
      return files
        .filter((f) => f.startsWith(`${cl
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3194** (2026-08-18): **`/update-nanoclaw` can stamp success without a recoverable cutover**
  *Symptoms*: ## What happens  `/update-nanoclaw` changes the running checkout before the update has passed validation. Its rollback point protects Git, but not the SQLite database, gitignored configuration, or external components changed during the update.  This leaves four failure windows on current `main` at `358f1a81`:  1. The merge changes source mounted into new agent containers while the host is    still accepting messages. New source can run against the old image before    validation or an image rebuild finishes. 2. Installed channel and provider refreshes have no blocking result contract.    A selected refresh can fail or do nothing, then the updater still stamps    success. 3. Using the printed rollback after a failed restart resets Git without undoing    a forward SQLite migration, `.env` change, or OneCLI pin move. 4. The upgrade marker records only `package.json` version. It cannot distinguish    two commits with the same version, and restart success is not checked through    the real CLI socket.  The result can be a checkout that reports a successful update but cannot be recovered by the rollback command it printed.  ## Why it happens  The current skill is a sequence of live commands without durable transaction state.  - It merges directly into the live checkout, then installs dependencies and   validates afterward. - The backup branch and tag cover source code only. - `/update-skills` fetches registry branches from `origin`, which is normally   the user's fork, then records 

- **Issue #2995** (2026-07-13): **Outbound messages to an offline channel adapter are marked delivered without any send**
  *Symptoms*: ## What happens  When the channel adapter for an outbound message is not registered, the delivery loop still marks the message as delivered. This state is easy to reach: credentials are missing so the factory returned null, setup failed, or a named instance is offline.  The `delivered` row gets `status='delivered'` with `platform_message_id=NULL`. The log says "Message delivered". File attachments are deleted from the outbox. No send happened. The user never sees the message, and the operator sees a healthy delivery log.  ## Why it happens  Verified against main at 0c0f4c2.  1. The delivery bridge returns `undefined` when it cannot find the exact adapter. It only logs a warning    ([`src/channels/channel-registry.ts:86-89`](https://github.com/nanocoai/nanoclaw/blob/0c0f4c2592d7f4191eff92e7d4a3a9b7042f74d9/src/channels/channel-registry.ts#L86-L89)). 2. `undefined` is also the normal return for an adapter that sends fine but has no platform message id. The caller cannot tell the two apart. 3. `drainSession` treats any return without a throw as success and calls    `markDelivered(inDb, msg.id, platformMsgId ?? null)`    ([`src/delivery.ts:195-196`](https://github.com/nanocoai/nanoclaw/blob/0c0f4c2592d7f4191eff92e7d4a3a9b7042f74d9/src/delivery.ts#L195-L196)). 4. Before returning, `deliverMessage` also logs "Message delivered" and calls `clearOutbox`, so attachment files are gone too    ([`src/delivery.ts:379-387`](https://github.com/nanocoai/nanoclaw/blob/0c0f4c2592d7f4191eff92e7

- **Issue #2868** (2026-08-18): **/update-skills is a silent no-op for already-installed channels — pre-flight skips the code/deps refresh**
  *Symptoms*: ## Summary  Running `/update-skills` on an installed channel does not refresh that channel's adapter code or pinned dependency. It silently skips the only steps that would do so.  This nullifies the `[Unreleased]` CHANGELOG migration that asks users to "re-run `/add-<channel>`" to pick up the `4.29.0` Chat SDK adapter — live on main today for anyone tracking trunk via `git pull` / `pnpm install`; pending the next manual release for tagged users. Either way the migration tool silently does nothing.  ## How it fails  `/update-skills` Step 3 invokes the corresponding `/add-<name>` skill via the Skill tool (`.claude/skills/update-skills/SKILL.md`):  > Its apply runs its own pre-flight, fetches the latest files from upstream… and installs any pinned dependency.  But each per-channel skill starts with an idempotent pre-flight that short-circuits when the channel is already installed. From `.claude/skills/add-discord/SKILL.md` (quoted from `main`):  > ### Pre-flight (idempotent) > Skip to **Credentials** if all of these are already in place: > - `src/channels/discord.ts` exists > - `src/channels/index.ts` contains `import './discord.js';` > - `src/channels/discord-registration.test.ts` exists > - `@chat-adapter/discord` is listed in `package.json` dependencies  For any channel that has been installed once, those conditions are always true. The pre-flight skips:  1. `git fetch origin channels` 2. `git show origin/channels:src/channels/discord.ts > src/channels/discord.ts` 3. The barr
  **Post-Mortem & Fix Analysis**:
  > ## Option C — preferred fix direction (after cross-checking all channels)  Both options A and B in the issue have structural problems (see below). A third approach holds more cleanly.  ### Why A and B fall short  **Option A (`--force` flag):** - Doesn't fix direct `/add-<channel>` reruns — users manually re-running the skill still hit the silent no-op unless they know the flag - Bypassing pre-flight routes into the Credentials section, requiring another skip rule for "update mode" — two flags' worth of state - Silently overrides deliberate user version pins with no warning  **Option B (move fetch/bump into `/update-skills`):** - Makes `/update-skills` channel-aware; adding a new channel now requires editing two files - Version pin ownership becomes ambiguous — the per-channel skill owns the pin today; centralizing the bump requires either fragile markdown parsing or a duplicate pin table - Doesn't fix direct `/add-<channel>` reruns either  ### Option C — split the pre-flight by concern

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

### Incident Patch 1: `c2663b17` (2026-09-30)
**Commit Message**: fix(container): refresh agent-runner lockfile to clear transitive advisories (#3974)

bun update within existing ranges: hono 4.13.12, @hono/node-server 1.19.17,
fast-uri 3.1.8, qs 6.16.0, body-parser 2.3.0, express-rate-limit 8.7.0
(ip-address 10.7.2). All reach the runner through @modelcontextprotocol/sdk
1.29.0; package.json is unchanged. bun audit: 43 findings -> 0.

**File**: `container/agent-runner/bun.lock` (modified, +12/-8)
```diff
@@ -41,7 +41,7 @@
 
     "@babel/runtime": ["@babel/runtime@7.29.2", "", {}, "sha512-JiDShH45zKHWyGe4ZNVRrCjBz8Nh9TMmZG1kh4QTK8hCBTWBi8Da+i7s1fJw7/lYpM4ccepSNfqzZ/QvABBi5g=="],
 
-    "@hono/node-server": ["@hono/node-server@1.19.14", "", { "peerDependencies": { "hono": "^4" } }, "sha512-GwtvgtXxnWsucXvbQXkRgqksiH2Qed37H9xHZocE5sA3N8O8O8/8FA3uclQXxXVzc9XBZuEOMK7+r02FmSpHtw=="],
+    "@hono/node-server": ["@hono/node-server@1.19.17", "", { "peerDependencies": { "hono": "^4" } }, "sha512-dSneS5qhiauZWGDCeK4o695Xd9nUNjviSZCMQrj10eetr8Uln1ucn6bbphOM6UynAMMtNIzZNSpL9vnASJwrPQ=="],
 
     "@modelcontextprotocol/sdk": ["@modelcontextprotocol/sdk@1.29.0", "", { "dependencies": { "@hono/node-server": "^1.19.9", "ajv": "^8.17.1", "ajv-formats": "^3.0.1", "content-type": "^1.0.5", "cors": "^2.8.5", "cross-spawn": "^7.0.5", "eventsource": "^3.0.2", "eventsource-parser": "^3.0.0", "express": "^5.2.1", "express-rate-limit": "^8.2.1", "hono": "^4.11.4", "jose": "^6.1.3", "json-schema-typed": "^8.0.2", "pkce-challenge": "^5.0.0", "raw-body": "^3.0.0", "zod": "^3.25 || ^4.0", "zod-to-json-schema": "^3.25.1" }, "peerDependencies": { "@cfworker/json-schema": "^4.1.1" }, "optionalPeers": ["@cfworker/json-schema"] }, "sha512-zo37mZA9hJWpULgkRpowewez1y6ML5GsXJPY8FI0tBBCd77HEvza4jDqRKOXgHNn867PVGCyTdzqpz0izu5ZjQ=="],
 
@@ -57,7 +57,7 @@
 
     "ajv-formats": ["ajv-formats@3.0.1", "", { "dependencies": { "ajv": "^8.0.0" } }, "sha512-8iUql50EUR+uUcdRQ3HDqa6EVyo3docL8g5WJ3FNcWmu62IbkGUue/pEyLBW8VGKKucTPgqeks4fIU1DA4yowQ=="],
 
-    "body-parser": ["body-parser@2.2.2", "", { "dependencies": { "bytes": "^3.1.2", "content-type": "^1.0.5", "debug": "^4.4.3", "http-errors": "^2.0.0", "iconv-lite": "^0.7.0", "on-finished": "^2.4.1", "qs": "^6.14.1", "raw-body": "^3.0.1", "type-is": "^2.0.1" } }, "sha512-oP5VkATKlNwcgvxi0vM0p/D3n2C3EReYVX+DNYs5TjZFn/oQt2j+4sVJtSMr18pdRr8wjTcBl6LoV+FUwzPmNA=="],
+    "body-parser": ["body-parser@2.3.0", "", { "dependencies": { "bytes": "^3.1.2", "content-type": "^2.0.0", "debug": "^4.4.3", "http-errors": "^2.0.1", "iconv-lite": "^0.7.2", "on-finished": "^2.4.1", "qs": "^6.15.2", "raw-body": "^3.0.2", "type-is": "^2.1.0" } }, "sha512-2cGmJupaNgg+QUwVLAucDuWuoMZ6EX9iHDRswZ5lsNYEmwPaRknMPCLZz07yTzVq/83p4o/wzbDZbBrTvGGTIw=="],
 
     "bun-types": ["bun-types@1.3.12", "", { "dependencies": { "@types/node": "*" } }, "sha512-HqOLj5PoFajAQciOMRiIZGNoKxDJSr6qigAttOX40vJuSp6DN/CxWp9s3C1Xwm4oH7ybueITwiaOcWXoYVoRkA=="],
 
@@ -107,13 +107,13 @@
 
     "express": ["express@5.2.1", "", { "dependencies": { "accepts": "^2.0.0", "body-parser": "^2.2.1", "content-disposition": "^1.0.0", "content-type": "^1.0.5", "cookie": "^0.7.1", "cookie-signature": "^1.2.1", "debug": "^4.4.0", "depd": "^2.0.0", "encodeurl": "^2.0.0", "escape-html": "^1.0.3", "etag": "^1.8.1", "finalhandler": "^2.1.0", "fresh": "^2.0.0", "http-errors": "^2.0.0", "merge-descriptors": "^2.0.0", "mime-types": "^3.0.0", "on-finished": "^2.4.1", "once": "^1.4.0", "parseurl": "^1.3.3", "proxy-addr": "^2.0.7", "qs": "^6.14.0", "range-parser": "^1.2.1", "router": "^2.2.0", "send": "^1.1.0", "serve-static": "^2.2.0", "statuses": "^2.0.1", "type-is": "^2.0.1", "vary": "^1.1.2" } }, "sha512-hIS4idWWai69NezIdRt2xFVofaF4j+6INOpJlVOLDO8zXGpUVEVzIYk12UUi2JzjEzWL3IOAxcTubgz9Po0yXw=="],
 
-    "express-rate-limit": ["express-rate-limit@8.3.2", "", { "dependencies": { "ip-address": "10.1.0" }, "peerDependencies": { "express": ">= 4.11" } }, "sha512-77VmFeJkO0/rvimEDuUC5H30oqUC4EyOhyGccfqoLebB0oiEYfM7nwPrsDsBL1gsTpwfzX8SFy2MT3TDyRq+bg=="],
+    "express-rate-limit": ["express-rate-limit@8.7.0", "", { "dependencies": { "debug": "^4.4.3", "ip-address": "^10.2.0" }, "peerDependencies": { "express": ">= 4.11" } }, "sha512-hOwV7WOxXfjRpAM1DSJWZDXx3GhplwD8IfwuwvogD8i1Qnkgosw/H45s4ZnFAUHDAhPjlY9hLBvJhKmGMyY26g=="],
 
     "fast-deep-equal": ["fast-deep-equal@3.1.3", "", {}, "sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q=="],
 
     "fast-sha256": ["fast-s
```

---

### Incident Patch 2: `805e282e` (2026-09-30)
**Commit Message**: fix(update): refuse cutover when the service liveness probe itself fails (#3962)

**File**: `scripts/update/service.test.ts` (modified, +190/-5)
```diff
@@ -7,6 +7,7 @@ import path from 'node:path';
 import { afterEach, describe, expect, it, vi } from 'vitest';
 
 import {
+  adoptUserRuntimeDir,
   CUTOVER_LIST_CLI_TIMEOUT_MS,
   CUTOVER_STOP_CLI_TIMEOUT_MS,
   CONTROLLER_GATEWAY_ROLE,
@@ -15,6 +16,7 @@ import {
   createCommandRunner,
   detectService,
   drainContainers,
+  probe,
   restartGatewayContainers,
   startService,
   stopService,
@@ -32,15 +34,24 @@ function temp(): string {
   return root;
 }
 
-function makeEnv(platform: NodeJS.Platform, responses: Record<string, { ok: boolean; stdout?: string }> = {}) {
+type FakeResponse = { ok: boolean; stdout?: string; status?: number | null; stderr?: string };
+
+function makeEnv(platform: NodeJS.Platform, responses: Record<string, FakeResponse> = {}) {
   const home = temp();
   const calls: string[] = [];
   const runner: CommandRunner = {
     run(command, args) {
       const key = `${command} ${args.join(' ')}`;
       calls.push(key);
       const response = responses[key];
-      if (response && !response.ok) throw new Error(key);
+      if (response && !response.ok) {
+        // Same shape as execFileSync's error: exit status (null when unspawnable) + stderr.
+        throw Object.assign(new Error(`Command failed: ${key}\n${response.stderr ?? ''}`), {
+          status: response.status === undefined ? 1 : response.status,
+          stdout: response.stdout ?? '',
+          stderr: response.stderr ?? '',
+        });
+      }
       return response?.stdout ?? '';
     },
     tryRun(command, args) {
@@ -73,7 +84,7 @@ describe('service-mode detection and control', () => {
     const root = temp();
     const name = `nanoclaw-v2-${slug(root)}`;
     const { env, calls, home } = makeEnv('linux', {
-      [`systemctl --user is-active --quiet ${name}`]: { ok: true },
+      [`systemctl --user is-active ${name}`]: { ok: true },
     });
     const unit = path.join(home, '.config', 'systemd', 'user', `${name}.service`);
     fs.mkdirSync(path.dirname(unit), { recursive: true });
@@ -102,7 +113,7 @@ describe('service-mode detection and control', () => {
     const root = temp();
     const name = `com.nanoclaw-v2-${slug(root)}`;
     const { env, calls, home } = makeEnv('darwin', {
-      [`launchctl print gui/1000/${name}`]: { ok: false },
+      [`launchctl print gui/1000/${name}`]: { ok: false, status: 113, stderr: 'Could not find service' },
     });
     const plist = path.join(home, 'Library', 'LaunchAgents', `${name}.plist`);
     fs.mkdirSync(path.dirname(plist), { recursive: true });
@@ -138,6 +149,180 @@ describe('service-mode detection and control', () => {
   });
 });
 
+describe('liveness probes: running / stopped / probe failed', () => {
+  // The bug: `.ok` read every non-zero exit as "stopped". With no user bus
+  // (`su -`, cron, non-interactive SSH) systemctl fails before it can look,
+  // and cutover then skipped the stop, finish the restart, and the update
+  // reported complete against the stale host. Exit 3 is the only "stopped".
+  function userUnit(): { root: string; name: string; probeKey: string } {
+    const root = temp();
+    const name = `nanoclaw-v2-${slug(root)}`;
+    return { root, name, probeKey: `systemctl --user is-active ${name}` };
+  }
+  function writeUserUnit(home: string, name: string): void {
+    const unit = path.join(home, '.config', 'systemd', 'user', `${name}.service`);
+    fs.mkdirSync(path.dirname(unit), { recursive: true });
+    fs.writeFileSync(unit, '[Service]\n');
+  }
+  const busError = 'Failed to connect to bus: No medium found';
+
+  it('systemd --user: exit 3 is stopped, a bus error is a refusal that names the fix', () => {
+    const stopped = userUnit();
+    const env1 = makeEnv('linux', { [stopped.probeKey]: { ok: false, status: 3 } });
+    writeUserUnit(env1.home, stopped.name);
+    expect(detectService(stopped.root, env1.env)).toMatchObject({ mode: 'systemd-user', active: false });
+
+    const failed = userUnit();
+    const env2 = makeEnv('linux'
```

**File**: `scripts/update/service.ts` (modified, +96/-17)
```diff
@@ -52,6 +52,8 @@ export type ServiceMode = 'launchd' | 'systemd-user' | 'systemd-system' | 'nohup
 export interface ServiceHandle {
   mode: ServiceMode;
   active: boolean;
+  /** Unit still starting or stopping: must be stopped like a running one, never counts as healthy. */
+  transitional?: boolean;
   name?: string;
   definition?: string;
   pid?: number;
@@ -88,6 +90,56 @@ function processExists(pid: number): boolean {
   }
 }
 
+/**
+ * `systemctl --user` needs XDG_RUNTIME_DIR; `su -`, cron and non-interactive
+ * SSH leave it unset while the user manager still runs (linger or another
+ * session). Adopt /run/user/<uid> process-wide: stop and start need it too.
+ */
+export function adoptUserRuntimeDir(uid: number, runRoot = '/run/user'): void {
+  if (process.env.XDG_RUNTIME_DIR) return;
+  const runtimeDir = path.join(runRoot, String(uid));
+  if (fs.existsSync(runtimeDir)) process.env.XDG_RUNTIME_DIR = runtimeDir;
+}
+
+/**
+ * Liveness by exit code: 0 = running (stdout), `stoppedExit` = stopped
+ * (undefined), anything else = the probe itself failed, so throw. Reading every
+ * failure as "stopped" let a run without the user bus skip stop and restart,
+ * pass health against the stale host, and report complete.
+ */
+export function probe(
+  env: ServiceEnvironment,
+  command: string,
+  args: string[],
+  stoppedExit: number[],
+  hint: string,
+): { stdout: string; transitional: boolean } | undefined {
+  try {
+    return { stdout: env.runner.run(command, args), transitional: false };
+  } catch (err) {
+    const failed = err as { status?: number | null; stdout?: Buffer | string; stderr?: Buffer | string };
+    if (typeof failed.status === 'number' && stoppedExit.includes(failed.status)) {
+      // systemctl is-active exits 3 for activating/deactivating too (a unit
+      // mid auto-restart still holds the service): only its terminal states
+      // are stopped. Other tools print nothing on their stopped exit.
+      const state = failed.stdout?.toString().trim() ?? '';
+      return /^(activating|deactivating)$/.test(state) ? { stdout: state, transitional: true } : undefined;
+    }
+    const detail = failed.stderr?.toString().trim() || (err instanceof Error ? err.message : String(err));
+    throw new Error(
+      `Cannot tell whether NanoClaw is running: \`${command} ${args.join(' ')}\` failed (${detail}). ${hint}`,
+    );
+  }
+}
+
+function flag(unit: { transitional: boolean } | undefined): { transitional?: true } {
+  return unit?.transitional ? { transitional: true } : {};
+}
+
+function userBusHint(uid: number): string {
+  return `Run the update from a login session of this user, or with XDG_RUNTIME_DIR=/run/user/${uid} while the user manager runs (loginctl enable-linger).`;
+}
+
 function escapeRegex(value: string): string {
   return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
 }
@@ -102,7 +154,15 @@ export function detectService(projectRoot: string, env: ServiceEnvironment): Ser
         mode: 'launchd',
         name,
         definition,
-        active: env.runner.tryRun('launchctl', ['print', `gui/${env.uid}/${name}`]).ok,
+        // 113: not loaded in this domain; 112 (no such domain) and the rest are probe failures.
+        active:
+          probe(
+            env,
+            'launchctl',
+            ['print', `gui/${env.uid}/${name}`],
+            [113],
+            'Run the update from a login session of this user.',
+          ) !== undefined,
       };
     }
   }
@@ -112,20 +172,20 @@ export function detectService(projectRoot: string, env: ServiceEnvironment): Ser
     const userDefinition = path.join(env.home, '.config', 'systemd', 'user', `${name}.service`);
     const systemDefinition = `/etc/systemd/system/${name}.service`;
     if (fs.existsSync(userDefinition)) {
-      return {
-        mode: 'systemd-user',
-        name,
-        definition: userDefinition,
-        active: env.runner.tryRun('systemctl', ['--user', 'is-active', '--quiet', name]).ok,
-      }
```

---

### Incident Patch 3: `4c1eabd3` (2026-09-29)
**Commit Message**: fix(log): never throw when a log value cannot be JSON-serialized (#3958)

* fix(log): never throw when a log value cannot be JSON-serialized

formatErr and formatData called JSON.stringify directly, which throws on a
circular object or a BigInt. emit has no try/catch, so a log.*({ err }) call
inside a catch or event handler threw into uncaughtException, and log.ts
then exits the host.

Route both through a safe stringify: plain JSON first, then a replacer that
marks cycles as [Circular] and BigInt as "<n>n", then String(v).

* fix(log): catch in emit so no data bag can make logging throw

safeStringify covered the JSON paths, but Object.entries(data) reads getters
on the data bag before it runs, so a throwing getter still reached
uncaughtException. Catch in emit and write the bare message instead.

* refactor(log): fall back to util.inspect instead of a custom replacer

The catch in emit is the backstop, so safeStringify only needs to cover the
common JSON throws. inspect handles cycles, BigInt, a throwing toJSON and
proxies; anything it cannot handle falls through to emit's catch. Normal
values stay byte-identical.

* fix(log): honor a top-level toJSON and keep depth in the inspec

**File**: `src/log.test.ts` (added, +140/-0)
```diff
@@ -0,0 +1,140 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+
+import { log } from './log.js';
+
+describe('log never throws on unserializable data', () => {
+  let written: string[];
+
+  beforeEach(() => {
+    written = [];
+    const capture = (chunk: string | Uint8Array) => {
+      written.push(String(chunk));
+      return true;
+    };
+    vi.spyOn(process.stderr, 'write').mockImplementation(capture);
+    vi.spyOn(process.stdout, 'write').mockImplementation(capture);
+  });
+
+  afterEach(() => vi.restoreAllMocks());
+
+  const throwingTraps: ProxyHandler<object> = {
+    get: () => {
+      throw new Error('get trap');
+    },
+    ownKeys: () => {
+      throw new Error('ownKeys trap');
+    },
+    getOwnPropertyDescriptor: () => {
+      throw new Error('descriptor trap');
+    },
+  };
+
+  it('logs a circular non-Error err value', () => {
+    const err: Record<string, unknown> = { code: 'E_SINK' };
+    err.self = err;
+    expect(() => log.warn('sink failed', { err })).not.toThrow();
+    expect(written.join('')).toContain('[Circular');
+  });
+
+  it('logs a circular value under any other key', () => {
+    const node: Record<string, unknown> = { id: 1 };
+    node.parent = { child: node };
+    expect(() => log.error('bad node', { node })).not.toThrow();
+    expect(written.join('')).toContain('[Circular');
+  });
+
+  it('logs BigInt values', () => {
+    expect(() => log.warn('big', { err: 10n })).not.toThrow();
+    expect(written.join('')).toContain('10n');
+  });
+
+  it('honors a top-level toJSON when stringify throws on its result', () => {
+    // The BigInt in toJSON's result makes stringify throw, so the inspect fallback runs.
+    const value = {
+      token: 'SECRET',
+      toJSON() {
+        return { id: 1n };
+      },
+    };
+    expect(() => log.warn('redacted', { err: value })).not.toThrow();
+    const out = written.join('');
+    expect(out).toContain('1n');
+    expect(out).not.toContain('SECRET');
+  });
+
+  it('passes the root key to toJSON, as JSON.stringify does', () => {
+    const value = {
+      token: 'SECRET',
+      toJSON(key: string) {
+        return key === '' ? { id: 1n } : this;
+      },
+    };
+    log.warn('keyed', { err: value });
+    expect(written.join('')).not.toContain('SECRET');
+  });
+
+  it('never prints the raw value when toJSON throws', () => {
+    const value = {
+      token: 'SECRET',
+      toJSON() {
+        throw new Error('no');
+      },
+    };
+    expect(() => log.warn('throwing toJSON', { err: value })).not.toThrow();
+    const out = written.join('');
+    expect(out).not.toContain('SECRET');
+    expect(out).toContain('[unserializable]');
+  });
+
+  it('keeps other fields, but not the value, when a toJSON getter throws', () => {
+    const err = {
+      token: 'SECRET',
+      get toJSON(): never {
+        throw new Error('getter');
+      },
+    };
+    log.warn('getter toJSON', { requestId: 'req-123', err });
+    const out = written.join('');
+    expect(out).toContain('req-123');
+    expect(out).not.toContain('SECRET');
+  });
+
+  it('does not call toJSON twice', () => {
+    const value = {
+      token: 'SECRET',
+      toJSON() {
+        delete (this as { toJSON?: unknown }).toJSON;
+        return { id: 1n };
+      },
+    };
+    log.warn('once', { err: value });
+    const out = written.join('');
+    expect(out).toContain('1n');
+    expect(out).not.toContain('SECRET');
+  });
+
+  it('keeps fields four levels deep in the inspect fallback', () => {
+    const err = { n: 1n, a: { b: { c: { d: { code: 'E_DEEP' } } } } };
+    log.warn('deep', { err });
+    expect(written.join('')).toContain('E_DEEP');
+  });
+
+  it('survives a Proxy with throwing traps, as a value or as the data bag', () => {
+    expect(() => log.warn('proxy value', { err: new Proxy({}, throwingTraps) })).not.toThrow();
+    expect(() => log.warn('proxy bag', new Proxy({}, throwingTraps) as Record<string, unknown>))
```

**File**: `src/log.ts` (modified, +37/-3)
```diff
@@ -1,3 +1,5 @@
+import { inspect } from 'node:util';
+
 const LEVELS = { debug: 20, info: 30, warn: 40, error: 50, fatal: 60 } as const;
 type Level = keyof typeof LEVELS;
 
@@ -15,17 +17,38 @@ const FULL_RESET = '\x1b[0m';
 
 const threshold = LEVELS[(process.env.LOG_LEVEL as Level) || 'info'] ?? LEVELS.info;
 
+const INSPECT_OPTS = { breakLength: Infinity, depth: 6 };
+
+function safeStringify(v: unknown): string {
+  // JSON.stringify throws on cycles and BigInt; inspect handles both. Anything
+  // inspect cannot handle falls through to the catch in emit.
+  let root: { value: unknown } | undefined;
+  /* eslint-disable no-catch-all/no-catch-all -- logging must never throw */
+  try {
+    // The first replacer call sees the root after toJSON ran, so the fallback
+    // honors a redacting toJSON without calling it twice.
+    return JSON.stringify(v, (_key, value: unknown) => {
+      root ??= { value };
+      return value;
+    });
+  } catch {
+    // No root means reading or running toJSON threw; never print the raw value.
+    return root ? inspect(root.value, INSPECT_OPTS) : '[unserializable]';
+  }
+  /* eslint-enable no-catch-all/no-catch-all */
+}
+
 function formatErr(err: unknown): string {
   if (err instanceof Error) {
     return `{ type: "${err.constructor.name}", message: "${err.message}", stack: ${err.stack} }`;
   }
-  return JSON.stringify(err);
+  return safeStringify(err);
 }
 
 function formatData(data: Record<string, unknown>): string {
   const parts: string[] = [];
   for (const [k, v] of Object.entries(data)) {
-    parts.push(`${KEY_COLOR}${k}${RESET}=${k === 'err' ? formatErr(v) : JSON.stringify(v)}`);
+    parts.push(`${KEY_COLOR}${k}${RESET}=${k === 'err' ? formatErr(v) : safeStringify(v)}`);
   }
   return parts.length ? ' ' + parts.join(' ') : '';
 }
@@ -43,7 +66,18 @@ function emit(level: Level, msg: string, data?: Record<string, unknown>): void {
   if (LEVELS[level] < threshold) return;
   const tag = `${COLORS[level]}${level.toUpperCase()}${level === 'fatal' ? FULL_RESET : RESET}`;
   const stream = LEVELS[level] >= LEVELS.warn ? process.stderr : process.stdout;
-  stream.write(`[${ts()}] ${tag} ${MSG_COLOR}${msg}${RESET}${data ? formatData(data) : ''}\n`);
+  /* eslint-disable no-catch-all/no-catch-all -- logging must never throw: a throw here reaches uncaughtException, which exits the host */
+  try {
+    stream.write(`[${ts()}] ${tag} ${MSG_COLOR}${msg}${RESET}${data ? formatData(data) : ''}\n`);
+  } catch {
+    // e.g. a throwing getter on the data bag itself, read before safeStringify sees it.
+    try {
+      process.stderr.write(`[${ts()}] ${tag} ${MSG_COLOR}${msg}${RESET} [log data unserializable]\n`);
+    } catch {
+      /* nowhere left to report it */
+    }
+  }
+  /* eslint-enable no-catch-all/no-catch-all */
 }
 
 export const log = {
```

---

### Incident Patch 4: `ae0ba863` (2026-09-29)
**Commit Message**: fix(iron-proxy): stop early on arm64 engines that cannot run amd64 images (#3953)

* fix(iron-proxy): run Iron Control natively where amd64 cannot be emulated

ironsh/iron-control is published for linux/amd64 only, and the skill pins
that platform into the compose file, so an arm64 Linux engine without a
QEMU binfmt handler died at exec. Setup now checks the engine before any
pull: amd64 and every engine that can run amd64 containers keep the pinned
image and digest as today; only an engine that cannot emulate amd64 builds
the pinned revision locally with Buildx and runs it on its own platform,
reusing the build while its arch and revision label match. Without Buildx
it stops before any fetch and prints the options, including the binfmt
command pinned by digest, which it never runs. Nothing is recorded.

Replaces #3891 after review: emulation first, no image.json or consent
prompt, proxy Dockerfile untouched so the proxy image hash is unchanged.

Fixes #3888

* fix(iron-proxy): tell a broken docker from a missing Buildx plugin

Field review of #3953: the failed Buildx probe alone read as "install
docker-buildx-plugin" even when docker itself had stopped answering, so
re-check the e

**File**: `.claude/skills/add-iron-proxy/SKILL.md` (modified, +10/-2)
```diff
@@ -52,7 +52,7 @@ NanoClaw's approval service uses a private Unix socket on Linux. On macOS it use
 
 `NANOCLAW_IRON_PROXY_PORT` in `.env` sets the internal proxy port (default `8080`). Setup uses the same value for the front listener and the agent proxy URL. This does not publish a host port. Re-run setup and restart this NanoClaw copy after changing it.
 
-`NANOCLAW_IRON_CONTROL_PORT` sets the console port (default `10257`). Only `127.0.0.1` is published. Set it before setup if another install uses that port; use the URL printed by setup. The official image currently targets `linux/amd64`; Docker on Apple Silicon runs it with emulation.
+`NANOCLAW_IRON_CONTROL_PORT` sets the console port (default `10257`). Only `127.0.0.1` is published. Set it before setup if another install uses that port; use the URL printed by setup. The official image currently targets `linux/amd64`; Docker on Apple Silicon runs it with emulation. On another architecture, setup checks the engine before it pulls anything and stops, printing the command that enables amd64 emulation, when the engine cannot run that image.
 
 ```nc:run effect:step
 pnpm exec tsx .claude/skills/add-iron-proxy/scripts/setup.ts --with-control
@@ -66,6 +66,14 @@ pnpm exec tsx .claude/skills/add-iron-proxy/scripts/setup.ts --with-control
 - **A command times out:** use the last printed stage to identify whether source
   download, image build, or console startup failed. Check connectivity and Docker
   health before retrying. The installer terminates the timed-out process group.
+- **"Iron Control cannot run on this aarch64 Docker engine", or `exec format error`
+  at the Iron Control step:** the pinned console image is amd64 only. Run the printed
+  `tonistiigi/binfmt` command against the Docker engine, or choose the OneCLI gateway;
+  then re-run setup. The registration lives in the kernel and is gone after a reboot:
+  re-run the command, or register it at boot (a systemd unit or your Docker host's
+  boot script), or Iron Control restart-loops with `exec format error`. Setup only checks an engine running on this machine's own kernel;
+  a VM or remote engine (Docker Desktop, Colima, a `DOCKER_HOST` elsewhere) is not
+  inspected and needs emulation enabled inside the engine.
 - **The database exists but keys are missing:** restore its matching `control.env`.
   Keep the database volume and encryption keys together; do not generate replacement
   keys for an existing database. `nanoclaw uninstall` removes both together: the
@@ -84,7 +92,7 @@ pnpm run build
 ```
 
 ```nc:run effect:test
-pnpm exec vitest run src/gateway-providers/iron-proxy.test.ts src/gateway-providers/iron-proxy-approval.test.ts src/gateway-providers/gateway-provider-registry.test.ts src/gateway-approval-coordinator.test.ts .claude/skills/add-iron-proxy/scripts/control.test.ts .claude/skills/add-iron-proxy/scripts/provider-credentials.test.ts .claude/skills/add-iron-proxy/scripts/credential-isolation.test.ts .claude/skills/add-iron-proxy/scripts/install-command.test.ts
+pnpm exec vitest run src/gateway-providers/iron-proxy.test.ts src/gateway-providers/iron-proxy-approval.test.ts src/gateway-providers/gateway-provider-registry.test.ts src/gateway-approval-coordinator.test.ts .claude/skills/add-iron-proxy/scripts/control.test.ts .claude/skills/add-iron-proxy/scripts/setup.test.ts .claude/skills/add-iron-proxy/scripts/provider-credentials.test.ts .claude/skills/add-iron-proxy/scripts/credential-isolation.test.ts .claude/skills/add-iron-proxy/scripts/install-command.test.ts
 ```
 
 The setup consumer writes `NANOCLAW_GATEWAY_PROVIDER=iron-proxy` only after every directive succeeds. Restart only this copy's NanoClaw service after an upgrade so its session contribution and approval bridge match the new installation. Check the proxy has synced its assigned principal before reporting the gateway ready.
```

**File**: `.claude/skills/add-iron-proxy/scripts/control-preflight.ts` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+import fs from 'node:fs';
+import os from 'node:os';
+import path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import { installCommand } from './install-command.js';
+
+const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
+const pins = JSON.parse(fs.readFileSync(path.join(skill, 'versions.json'), 'utf8')) as Record<string, string>;
+
+/** Registers QEMU user-mode emulation for linux/amd64 with the engine's kernel; printed, never run by setup. */
+export const AMD64_EMULATION_COMMAND = `docker run --privileged --rm ${pins['amd64-emulation-image']} --install amd64`;
+
+const BINFMT = '/proc/sys/fs/binfmt_misc';
+
+/**
+ * Whether this kernel runs amd64 binaries through binfmt_misc: the global
+ * switch on, and one enabled handler for 64-bit x86-64 ELF at offset 0 (the
+ * handler's name varies; NixOS registers x86_64-linux) with the F flag,
+ * without which the interpreter is looked up inside each container, and the
+ * console image has none. Undefined when binfmt_misc cannot be read here
+ * (not mounted in this namespace): unknown, not absent.
+ */
+export function hasAmd64Emulation(
+  list = () => fs.readdirSync(BINFMT),
+  read = (file: string) => fs.readFileSync(path.join(BINFMT, file), 'utf8'),
+): boolean | undefined {
+  let status: string;
+  try {
+    status = read('status').trim();
+  } catch {
+    return undefined;
+  }
+  if (status !== 'enabled') return false;
+  try {
+    return list().some((name) => {
+      if (name === 'status' || name === 'register') return false;
+      const lines = read(name).split('\n');
+      const field = (key: string) =>
+        lines
+          .find((line) => line.startsWith(key))
+          ?.slice(key.length)
+          .trim() ?? '';
+      const magic = field('magic ').replace(/\s/g, '');
+      return (
+        lines[0].trim() === 'enabled' &&
+        field('flags:').includes('F') &&
+        (field('offset ') || '0') === '0' &&
+        magic.startsWith('7f454c4602') &&
+        magic.slice(36, 40) === '3e00'
+      );
+    });
+  } catch {
+    return undefined;
+  }
+}
+
+/**
+ * The pinned console image is linux/amd64 only. On an engine that runs on
+ * this machine (same kernel and hostname) and can neither run it natively nor
+ * emulate it, stop before any pull and say what enables emulation. An engine
+ * elsewhere (Docker Desktop, a VM, a remote daemon) cannot be inspected from
+ * here and is left to run as before. Setup runs this before building Iron Proxy.
+ */
+export async function checkControlEngine(emulation = hasAmd64Emulation, platform = process.platform): Promise<void> {
+  const [arch, kernel, host] = (
+    await installCommand('docker', ['info', '--format', '{{.Architecture}} {{.KernelVersion}} {{.Name}}'], {
+      label: 'Check the Docker engine architecture',
+      timeoutMs: 15_000,
+      capture: true,
+      failureHint: 'Check that Docker is running and reachable, then retry.',
+    })
+  )
+    .trim()
+    .split(' ');
+  if (!/^[a-z0-9_]+$/.test(arch ?? ''))
+    throw new Error('Docker did not report its engine architecture; check that Docker is running');
+  if (arch === 'x86_64' || platform !== 'linux' || kernel !== os.release() || host !== os.hostname()) return;
+  if (emulation() !== false) return;
+  throw new Error(
+    [
+      `Iron Control cannot run on this ${arch} Docker engine: its pinned image is linux/amd64 only and the engine has no amd64 emulation.`,
+      'Pick one, then re-run setup:',
+      `  - Enable amd64 emulation for this Docker engine: ${AMD64_EMULATION_COMMAND}`,
+      '    Iron Control then runs its pinned image emulated; Iron Proxy stays native. The registration lives in the kernel and is gone after a reboot: re-run it, or register it at boot, or Iron Control restart-loops with exec format error.',
+      '  - Choose the OneCLI gateway instead of Iron Proxy.',
+    ].join('\n'),
+  );
+}
```

**File**: `.claude/skills/add-iron-proxy/scripts/setup.test.ts` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+import fs from 'node:fs';
+import os from 'node:os';
+import path from 'node:path';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+import { parse as yaml } from 'yaml';
+
+import { InstallCommandFailure } from './install-command.js';
+
+/** A fresh arm64 Linux engine with no cached images; the kernel's QEMU registration varies per test. */
+const engine = { emulation: false, calls: [] as string[][] };
+
+// The kernel's QEMU registration, never the test machine's own.
+const X86_64_HANDLER =
+  'enabled\ninterpreter /usr/bin/qemu-x86_64\nflags: POCF\noffset 0\nmagic 7f454c4602010100000000000000000002003e00\nmask fffffffffffefe00fffffffffffffffffeffffff\n';
+const readFileSync = fs.readFileSync;
+vi.spyOn(fs, 'readFileSync').mockImplementation(((file: fs.PathOrFileDescriptor, ...rest: unknown[]) => {
+  if (typeof file === 'string' && file.startsWith('/proc/sys/fs/binfmt_misc/')) {
+    if (file.endsWith('/status')) return 'enabled\n';
+    if (!engine.emulation) throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
+    return X86_64_HANDLER;
+  }
+  return (readFileSync as (...args: unknown[]) => unknown)(file, ...rest);
+}) as typeof fs.readFileSync);
+const readdirSync = fs.readdirSync;
+vi.spyOn(fs, 'readdirSync').mockImplementation(((dir: fs.PathLike, ...rest: unknown[]) => {
+  if (dir === '/proc/sys/fs/binfmt_misc')
+    return engine.emulation ? ['qemu-x86_64', 'register', 'status'] : ['register', 'status'];
+  return (readdirSync as (...args: unknown[]) => unknown)(dir, ...rest);
+}) as typeof fs.readdirSync);
+const composeStarted = new Error('compose up reached');
+
+vi.mock('./install-command.js', async (original) => {
+  const actual = await original<typeof import('./install-command.js')>();
+  return {
+    ...actual,
+    installCommand: vi.fn(async (command: string, args: string[], options: { label: string; absentHint?: string }) => {
+      engine.calls.push([command, ...args]);
+      if (command === 'git' || command === 'python3') return '';
+      if (command !== 'docker') throw new Error(`unexpected command: ${command}`);
+      if (args[0] === 'info') return `aarch64 ${os.release()} ${os.hostname()}\n`;
+      if (args[0] === 'build') return '';
+      if (args[0] === 'image' && args[1] === 'inspect') {
+        if (!engine.calls.some((call) => call[1] === 'build')) {
+          throw new actual.InstallCommandFailure(`${options.label}: ${options.absentHint ?? 'failed (exit 1)'}`);
+        }
+        return `sha256:${'b'.repeat(64)}`;
+      }
+      if (args[0] === 'volume') return '';
+      if (args[0] === 'compose') throw composeStarted;
+      throw new Error(`unexpected command: docker ${args.join(' ')}`);
+    }),
+  };
+});
+
+const { run } = await import('./setup.js');
+const { installCommand } = await import('./install-command.js');
+const installCommandMock = vi.mocked(installCommand);
+const { controlPaths } = await import('./control.js');
+const { hasAmd64Emulation } = await import('./control-preflight.js');
+
+const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
+const roots: string[] = [];
+
+beforeEach(() => {
+  engine.calls.length = 0;
+  engine.emulation = false;
+  Object.defineProperty(process, 'platform', { ...platform, value: 'linux' });
+});
+afterEach(() => {
+  Object.defineProperty(process, 'platform', platform);
+  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
+});
+
+function project(): string {
+  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iron-setup-test-'));
+  roots.push(root);
+  return root;
+}
+
+const dockerVerbs = () => engine.calls.filter((call) => call[0] === 'docker').map((call) => call[1]);
+
+describe('Iron Proxy setup on an arm64 Linux engine', () => {
+  it('stops before building or fetching anything when the engine cannot run amd64 images', async () => {
+    const root = project();
+    const failure = await run(['--with-contro
```

**File**: `.claude/skills/add-iron-proxy/scripts/setup.ts` (modified, +4/-0)
```diff
@@ -12,6 +12,7 @@ import { upsertEnvVar } from '../../../../setup/set-env.js';
 import { installStep, installCommand, InstallCommandFailure } from './install-command.js';
 import { buildManagedProxy, hasFrontProxy } from './build-managed-proxy.js';
 import { controlPaths, installControl, removeControl, storeModelCredential } from './control.js';
+import { checkControlEngine } from './control-preflight.js';
 import { readAllowedHostsFile, validateAllowedHost } from '../payload/src/gateway-providers/iron-proxy-allowlist.js';
 
 const pins = JSON.parse(
@@ -224,6 +225,9 @@ export async function run(args: string[], projectRoot = process.cwd()): Promise<
   const managed = args.includes('--with-control') || !!readProjectEnv(projectRoot).NANOCLAW_IRON_CONTROL_URL;
   const localIndex = args.indexOf('--local-image');
   if (managed || localIndex < 0) {
+    // An engine that cannot run the console stops here, before the Iron
+    // Proxy build spends minutes.
+    if (managed) await checkControlEngine();
     IMAGE = await buildManagedProxy();
     if (managed) await installControl(projectRoot);
     upsertEnvVar('NANOCLAW_IRON_PROXY_IMAGE', IMAGE, projectRoot);
```

**File**: `.claude/skills/add-iron-proxy/versions.json` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
   "iron-control-commit": "6fe857654376d67d100400bbd26c31540effb127",
   "iron-control-image": "docker.io/ironsh/iron-control:sha-6fe8576@sha256:dc287ea43c6b5305a4ae03d9496fb352678ccf6b206bb8c509691521687d3f22",
   "iron-control-platform": "linux/amd64",
+  "amd64-emulation-image": "docker.io/tonistiigi/binfmt:qemu-v10.2.3-68@sha256:400a4873b838d1b89194d982c45e5fb3cda4593fbfd7e08a02e76b03b21166f0",
   "iron-control-postgres-image": "docker.io/library/postgres:17-alpine@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73",
   "iron-proxy-source": "https://github.com/ironsh/iron-proxy.git",
   "iron-proxy-commit": "2393dd175a8c419153fb49917fdeceb94cd9ed59"
```

---

### Incident Patch 5: `94d82996` (2026-09-29)
**Commit Message**: fix(host): stop containers whose session or agent group was deleted (#3947)

* fix(host): stop containers whose session or agent group was deleted

The per-session reconcile only visits sessions that still have a row,
and returns early when the agent group is gone. So once a delete removes
the rows (setup's ping cleanup, `ncl groups delete`), nothing stopped
the container until the next host restart, where adoption does.

The host sweep gets a singleton duty, stopOrphanedSessions: list this
install's sessions from the driver, then stop each one whose session
row or agent group no longer exists. The runtime is listed before the
rows are read, and a spawn reads its session row before it creates a
container, so a legitimate spawn always has a row by then. A spawn this
process still has in flight is skipped until the next tick.

spawnContainer also rechecks the session and group right before
driver.prepare, so a delete that lands mid-spawn gets no container.

Fixes #3909

* fix(drivers): keep a prepared handle when a listing names its key

The orphan sweep lists sessions every tick, and the hub replaced each
listed key's truth-read handle with the reconstructed one. A prepared
handle h

**File**: `src/cli/resources/groups.ts` (modified, +2/-1)
```diff
@@ -237,7 +237,8 @@ registerResource({
       description:
         'Delete an agent group and its dependent rows (sessions, destinations, approvals, role grants, ' +
         'memberships, channel wirings). FK-ordered cascade in a single transaction. ' +
-        'Use --id <group-id>. Out of scope: killing running containers, on-disk cleanup of groups/<folder>/ and data/v2-sessions/<group-id>/. ' +
+        "Use --id <group-id>. The host sweep stops the group's running containers within about a minute. " +
+        'Out of scope: on-disk cleanup of groups/<folder>/ and data/v2-sessions/<group-id>/. ' +
         'The leftover groups/<folder>/ blocks re-creating a group under the same folder name until it is moved or removed.',
       handler: async (args) => {
         const id = args.id as string;
```

**File**: `src/container-runner.orphans.test.ts` (added, +170/-0)
```diff
@@ -0,0 +1,170 @@
+/**
+ * The host sweep's orphan stop: a supervised session whose session row or
+ * agent group was deleted is stopped, one whose rows exist (or whose spawn is
+ * still in flight) is not, and the runtime is never listed for it.
+ */
+import fs from 'fs';
+import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
+
+import type { SupervisedHandle, SupervisedSnapshot } from './drivers/session-events.js';
+
+const { snapshots, listSessions, prepare } = vi.hoisted(() => {
+  const snapshots: SupervisedSnapshot[] = [];
+  return { snapshots, listSessions: vi.fn(async () => snapshots), prepare: vi.fn() };
+});
+vi.mock('./config.js', async () => {
+  const actual = await vi.importActual<typeof import('./config.js')>('./config.js');
+  const root = '/tmp/nanoclaw-test-orphan-sweep';
+  return { ...actual, DATA_DIR: `${root}/data`, GROUPS_DIR: `${root}/groups` };
+});
+vi.mock('./drivers/index.js', () => {
+  const driver = { kind: 'fake', listSessions, prepare, capabilities: () => ({}) };
+  return { getSessionDriver: () => driver, isSessionEventsDriver: () => false };
+});
+
+import {
+  adoptRunningSessions,
+  isContainerRunning,
+  killContainer,
+  stopOrphanedSessions,
+  wakeContainer,
+} from './container-runner.js';
+import { dispatch } from './cli/dispatch.js';
+import './cli/resources/groups.js';
+import { ensureContainerConfig } from './db/container-configs.js';
+import { initTestDb, closeDb, runMigrations, createAgentGroup, createSession, getDb } from './db/index.js';
+import type { Session } from './types.js';
+
+function now(): string {
+  return new Date().toISOString();
+}
+
+function fakeHandle(sessionId: string, start: () => Promise<void> = async () => {}) {
+  const terminalCallbacks: Array<(failure?: unknown) => void> = [];
+  const stop = vi.fn(async (_reason: string) => {
+    for (const callback of terminalCallbacks) callback(undefined);
+  });
+  const handle = {
+    key: { installSlug: 'test-install', agentGroupId: 'ag-1', sessionId },
+    name: `nanoclaw-v2-${sessionId}`,
+    start,
+    stop,
+    async status() {
+      return { phase: 'running' };
+    },
+    onTerminal(callback: (failure?: unknown) => void) {
+      terminalCallbacks.push(callback);
+    },
+  } as unknown as SupervisedHandle;
+  return { handle, stop };
+}
+
+/** Register sess-1 as a supervised runtime through startup adoption. */
+async function adopt() {
+  const { handle, stop } = fakeHandle('sess-1');
+  snapshots.push({ handle, phase: 'running' } as SupervisedSnapshot);
+  expect((await adoptRunningSessions()).adopted).toBe(1);
+  listSessions.mockClear();
+  return stop;
+}
+
+function session(id: string): Session {
+  return {
+    id,
+    agent_group_id: 'ag-1',
+    messaging_group_id: null,
+    thread_id: null,
+    agent_provider: null,
+    status: 'active',
+    container_status: 'running',
+    last_active: now(),
+    created_at: now(),
+  };
+}
+
+beforeEach(async () => {
+  snapshots.length = 0;
+  listSessions.mockClear();
+  prepare.mockReset();
+  const db = await initTestDb();
+  await runMigrations(db);
+  await createAgentGroup({
+    id: 'ag-1',
+    name: 'Test Agent',
+    folder: 'test-agent',
+    agent_provider: null,
+    created_at: now(),
+  });
+  await createSession(session('sess-1'));
+});
+
+afterEach(async () => {
+  if (isContainerRunning('sess-1')) {
+    killContainer('sess-1', 'test-teardown');
+    await vi.waitFor(() => expect(isContainerRunning('sess-1')).toBe(false));
+  }
+  await closeDb();
+  fs.rmSync('/tmp/nanoclaw-test-orphan-sweep', { recursive: true, force: true });
+});
+
+describe('stopOrphanedSessions', () => {
+  it('leaves a session whose rows exist alone', async () => {
+    const stop = await adopt();
+    expect(await stopOrphanedSessions()).toBe(0);
+    expect(stop).not.toHaveBeenCalled();
+    expect(isContainerRunning('sess-1')).toBe(true);
+  });
+
+  it('stops and unregisters a session whose row was deleted, without listing the 
```

**File**: `src/container-runner.ts` (modified, +28/-0)
```diff
@@ -887,6 +887,34 @@ export async function adoptRunningSessions(): Promise<{ adopted: number; stopped
   return { adopted, stopped };
 }
 
+/**
+ * Stop the sessions this process supervises whose session row or agent group
+ * no longer exists. The per-session reconcile only visits live rows, so a
+ * delete (setup cleanup, `ncl groups delete`) would otherwise leave the
+ * container up until the next host restart, where adoption stops it the same
+ * way. Containers no process supervises are adoption's job, not this sweep's.
+ *
+ * Not racy against a legitimate spawn: a runtime is registered only after its
+ * session row was read (`spawnContainer`) or checked (adoption), and the rows
+ * are read after that, so a missing row was deleted. A spawn still in flight
+ * is left for the next tick, once `start()` has returned.
+ */
+export async function stopOrphanedSessions(): Promise<number> {
+  let stopped = 0;
+  for (const [sessionId, runtime] of [...activeContainers]) {
+    if (wakePromises.has(sessionId) || runtime.stopReason) continue;
+    const session = await getSession(sessionId);
+    if (session && (await getAgentGroup(session.agent_group_id))) continue;
+    log.warn('Stopping container whose session or agent group was deleted', {
+      sessionId,
+      containerName: runtime.containerName,
+    });
+    killContainer(sessionId, 'orphaned');
+    stopped += 1;
+  }
+  return stopped;
+}
+
 /**
  * Honor stop intents that outlived their process. A kill-with-respawn used to
  * live only in a volatile onExit callback: a host dying between the kill and
```

**File**: `src/host-sweep.queue.test.ts` (modified, +23/-2)
```diff
@@ -18,7 +18,9 @@ vi.mock('./reconcile-session.js', () => ({
 vi.mock('./db/sessions.js', () => ({ getActiveSessions: vi.fn() }));
 vi.mock('./egress-lockdown.js', () => ({ ensureEgressNetwork: vi.fn() }));
 vi.mock('./modules/approvals/index.js', () => ({ sweepAwaitingReasonRejects: vi.fn() }));
+vi.mock('./container-runner.js', () => ({ stopOrphanedSessions: vi.fn() }));
 
+import { stopOrphanedSessions } from './container-runner.js';
 import { getActiveSessions } from './db/sessions.js';
 import { ensureEgressNetwork } from './egress-lockdown.js';
 import { RECONCILE_CONCURRENCY, startHostSweep, stopHostSweep } from './host-sweep.js';
@@ -58,6 +60,12 @@ beforeEach(() => {
     .mockImplementation(async () => {
       order.push('approvals');
     });
+  vi.mocked(stopOrphanedSessions)
+    .mockReset()
+    .mockImplementation(async () => {
+      order.push('orphans');
+      return 0;
+    });
   vi.mocked(getActiveSessions)
     .mockReset()
     .mockResolvedValue([{ id: 's-1' }, { id: 's-2' }] as Awaited<ReturnType<typeof getActiveSessions>>);
@@ -82,7 +90,8 @@ describe('sweep over the workqueue', () => {
     await runSweepTick();
 
     expect(reconcileSession).toHaveBeenCalledTimes(2);
-    expect(order).toEqual(['egress', 'session:s-1', 'session:s-2', 'approvals']);
+    expect(order.filter((step) => step !== 'orphans')).toEqual(['egress', 'session:s-1', 'session:s-2', 'approvals']);
+    expect(order).toContain('orphans');
 
     await runSweepTick();
     expect(reconcileSession).toHaveBeenCalledTimes(4);
@@ -133,6 +142,18 @@ describe('sweep over the workqueue', () => {
 
     await runSweepTick();
     // s-2 and the closing singleton still ran; the tick completed and re-armed.
-    expect(order).toEqual(['egress', 'session:s-2', 'approvals']);
+    expect(order.filter((step) => step !== 'orphans')).toEqual(['egress', 'session:s-2', 'approvals']);
+  });
+
+  it('stops orphaned sessions once per tick, and a failure there still re-arms', async () => {
+    await runSweepTick();
+    expect(stopOrphanedSessions).toHaveBeenCalledTimes(1);
+
+    vi.mocked(stopOrphanedSessions).mockRejectedValueOnce(new Error('db down'));
+    await runSweepTick();
+    expect(stopOrphanedSessions).toHaveBeenCalledTimes(2);
+
+    await runSweepTick();
+    expect(stopOrphanedSessions).toHaveBeenCalledTimes(3);
   });
 });
```

**File**: `src/host-sweep.ts` (modified, +12/-1)
```diff
@@ -12,6 +12,7 @@
  * stable.
  */
 import { INSTALL_SLUG } from './config.js';
+import { stopOrphanedSessions } from './container-runner.js';
 import { ensureEgressNetwork } from './egress-lockdown.js';
 import { getActiveSessions } from './db/sessions.js';
 import { peekSessionDriver } from './drivers/index.js';
@@ -99,6 +100,15 @@ export function startHostSweep(): void {
           log.error('Egress lockdown re-heal failed', { err });
         }
       },
+      // Stop containers whose session or agent group was deleted: the
+      // per-session reconcile only visits sessions that still have a row.
+      'singleton:orphan-containers': async () => {
+        try {
+          await stopOrphanedSessions();
+        } catch (err) {
+          log.error('Orphaned container sweep failed', { err });
+        }
+      },
       // Finalize any "Reject with reason…" holds whose reply window elapsed
       // (admin ghosted, or the host restarted mid-capture). Central-DB scan,
       // once per tick — not per session.
@@ -148,7 +158,7 @@ async function sweep(): Promise<void> {
   if (!running || !tickQueue) return;
 
   // Enqueue order matches the loop this replaces: egress re-heal, then every
-  // active session, then the approvals scan. Keys START in that order; up to
+  // active session, then the approvals scan; the orphan-container stop last. Keys START in that order; up to
   // RECONCILE_CONCURRENCY of them run at once.
   tickQueue.add('singleton:egress-reheal');
   try {
@@ -160,6 +170,7 @@ async function sweep(): Promise<void> {
     log.error('Host sweep error', { err });
   }
   tickQueue.add('singleton:approvals-scan');
+  tickQueue.add('singleton:orphan-containers');
 
   // The tick ends — and the next one is armed — only after everything this
   // tick enqueued has run. Delayed backoff retries don't hold the tick open.
```

---

### Incident Patch 6: `0ccc1e8f` (2026-09-28)
**Commit Message**: fix(iron-proxy): remove Iron Control's database on uninstall (#3883)

**File**: `.claude/skills/add-iron-proxy/REMOVE.md` (modified, +18/-7)
```diff
@@ -7,13 +7,24 @@ pnpm exec tsx .claude/skills/add-iron-proxy/scripts/setup.ts --remove
 ```
 
 NanoClaw's uninstall flow removes this copy's gateway material with its other data.
+Iron Control's `web` and `database` containers carry the same `nanoclaw-install`
+and `nanoclaw-role=gateway` labels as the central proxy. A container with the
+install label, the gateway role (`nanoclaw-role=gateway`) and no session label
+is gateway-owned (`GATEWAY_ROLE`, see `docs/gateway-seam.md`): the update drain
+and the host's residue reaping leave it alone. The
+uninstaller does not read the role: it takes the Compose project of each
+container with this copy's install label, which is this copy's alone because the
+project name comes from the install slug. With the data group it then
+removes the project's containers, database volume and network, because the
+encryption keys it deletes from `data/` are the only way to read that database. The project is found through
+its containers: an install whose containers predate the labels gets them on its
+next setup run, and a volume whose containers were already removed (the command
+above, or an earlier service-only uninstall) is not found. In both cases the
+uninstaller leaves the volume and the next setup prints the exact removal commands.
 
-The ordinary removal command preserves Iron Control's database volume. Before
-uninstalling this copy, either back up that volume together with
-`data/session-materials/iron-control/`, or remove the database with the exact
-Compose project/file printed by setup using `docker compose ... down --volumes`
-when the operator requested permanent data deletion. Do this before NanoClaw
-removes the encryption keys. Never remove another copy's volume or a shared
-database.
+The ordinary removal command above preserves Iron Control's database volume. To
+keep the data, back up that volume together with
+`data/session-materials/iron-control/` before uninstalling. Never remove another
+copy's volume or a shared database.
 
 Use the journal-derived skill removal to remove installed payload files.
```

**File**: `.claude/skills/add-iron-proxy/SKILL.md` (modified, +8/-1)
```diff
@@ -68,7 +68,14 @@ pnpm exec tsx .claude/skills/add-iron-proxy/scripts/setup.ts --with-control
   health before retrying. The installer terminates the timed-out process group.
 - **The database exists but keys are missing:** restore its matching `control.env`.
   Keep the database volume and encryption keys together; do not generate replacement
-  keys for an existing database.
+  keys for an existing database. `nanoclaw uninstall` removes both together: the
+  containers carry this copy's `nanoclaw-install` and `nanoclaw-role=gateway` labels
+  (gateway-owned: the gateway role and no session, so the update drain and residue
+  reaping keep them), and the uninstaller removes their Compose project's volume and
+  network with `data/`.
+  If the folder was deleted by hand, the error prints the `docker rm -f` and
+  `docker volume rm` commands that delete the old database; run them only if its
+  credentials can go.
 
 ## Validate
 
```

**File**: `.claude/skills/add-iron-proxy/scripts/control.test.ts` (modified, +37/-2)
```diff
@@ -1,11 +1,20 @@
 import fs from 'node:fs';
 import os from 'node:os';
 import path from 'node:path';
-import { afterEach, describe, expect, it } from 'vitest';
+import { afterEach, describe, expect, it, vi } from 'vitest';
 import { parse as yaml } from 'yaml';
 
-import { controlCompose, controlPaths, controlPort } from './control.js';
+import { controlCompose, controlPaths, controlPort, installControl } from './control.js';
 import { hasFrontProxy, frontProxyHash } from './build-managed-proxy.js';
+import { installCommand } from './install-command.js';
+import { getInstallSlug } from '../../../../src/install-slug.js';
+import { GATEWAY_ROLE, LABELS } from '../../../../src/drivers/types.js';
+
+vi.mock('./install-command.js', async (importActual) => ({
+  ...(await importActual<typeof import('./install-command.js')>()),
+  installCommand: vi.fn(async () => ''),
+}));
+const installCommandMock = vi.mocked(installCommand);
 
 const roots: string[] = [];
 const temporary = () => {
@@ -14,6 +23,7 @@ const temporary = () => {
   return root;
 };
 afterEach(() => {
+  installCommandMock.mockClear();
   delete process.env.NANOCLAW_IRON_CONTROL_PORT;
   for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
 });
@@ -46,6 +56,31 @@ describe('official Iron Control installation', () => {
     expect(() => controlPort(root)).toThrow('between 1 and 65535');
   });
 
+  it('labels both services like the central proxy, and neither the volume nor the network', () => {
+    const root = temporary();
+    const config = yaml(controlCompose(root, 18443));
+    const labels = { [LABELS.install]: getInstallSlug(root), [LABELS.role]: GATEWAY_ROLE };
+    expect(config.services.web.labels).toEqual(labels);
+    expect(config.services.database.labels).toEqual(labels);
+    expect(Object.keys(config.services.web).slice(0, 4)).toEqual(['image', 'platform', 'restart', 'labels']);
+    expect(config.volumes.database).toEqual({});
+    expect(config.networks.default).toEqual({ name: controlPaths(root).network });
+  });
+
+  it('prints the exact cleanup commands when the database outlived its keys', async () => {
+    const root = temporary();
+    const project = controlPaths(root).project;
+    installCommandMock.mockResolvedValueOnce(`other_database\n${project}_database\n`);
+    const failure = installControl(root);
+    await expect(failure).rejects.toThrow(`restore ${controlPaths(root).environment}`);
+    await expect(failure).rejects.toThrow(
+      `docker rm -f ${project}-database-1 ${project}-web-1; docker volume rm ${project}_database`,
+    );
+    // Only the volume listing ran: nothing was removed or started.
+    expect(installCommandMock).toHaveBeenCalledTimes(1);
+    expect(fs.existsSync(controlPaths(root).environment)).toBe(false);
+  });
+
   it('requires both the pinned source and the exact approval front', () => {
     const labels = {
       'org.opencontainers.image.revision': '2393dd175a8c419153fb49917fdeceb94cd9ed59',
```

**File**: `.claude/skills/add-iron-proxy/scripts/control.ts` (modified, +15/-1)
```diff
@@ -6,6 +6,7 @@ import { fileURLToPath } from 'node:url';
 import { installCommand } from './install-command.js';
 
 import { stringify as yaml } from 'yaml';
+import { GATEWAY_ROLE, LABELS } from '../../../../src/drivers/types.js';
 import { getInstallSlug } from '../../../../src/install-slug.js';
 import { upsertEnvVar } from '../../../../setup/set-env.js';
 
@@ -46,12 +47,18 @@ export function controlPort(root: string): number {
 
 export function controlCompose(root: string, port: number): string {
   const p = controlPaths(root);
+  // Same labels as the central proxy: the install label lets uninstall remove
+  // this project's volume and network; the role keeps the host's residue
+  // reaping off a running gateway. Never on the volume: Compose would offer
+  // to recreate an existing one (data loss) when its labels change.
+  const labels = { [LABELS.install]: getInstallSlug(root), [LABELS.role]: GATEWAY_ROLE };
   return yaml({
     name: p.project,
     services: {
       database: {
         image: pins['iron-control-postgres-image'],
         restart: 'unless-stopped',
+        labels,
         env_file: [p.databaseEnvironment],
         volumes: ['database:/var/lib/postgresql/data'],
         healthcheck: { test: ['CMD-SHELL', 'pg_isready -U iron_control'], interval: '2s', timeout: '3s', retries: 30 },
@@ -60,6 +67,7 @@ export function controlCompose(root: string, port: number): string {
         image: pins['iron-control-image'],
         platform: pins['iron-control-platform'],
         restart: 'unless-stopped',
+        labels,
         env_file: [p.environment],
         command: ['./bin/rails', 'server'],
         ports: [`127.0.0.1:${port}:3000`],
@@ -141,8 +149,14 @@ export async function installControl(root = process.cwd()): Promise<void> {
       timeoutMs: 15_000,
       capture: true,
     });
+    // A folder deleted by hand leaves the containers and volume behind, and
+    // the same path derives the same names; setup never removes them itself.
     if (volumes.trim().split('\n').includes(`${p.project}_database`))
-      throw new Error(`Iron Control database exists but its encryption keys are missing; restore ${p.environment}`);
+      throw new Error(
+        `Iron Control database exists but its encryption keys are missing; restore ${p.environment}, ` +
+          `or delete the old database and every credential stored in it with: ` +
+          `docker rm -f ${p.project}-database-1 ${p.project}-web-1; docker volume rm ${p.project}_database`,
+      );
     const password = secret();
     const email = 'operator@nanoclaw.local';
     const databasePassword = secret();
```

**File**: `setup/uninstall/flow.test.ts` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+import { describe, expect, it } from 'vitest';
+
+import { PROJECT_NOTE, projectRows } from './flow.js';
+import { buildRemovalPlan } from './plan.js';
+import type { Inventory } from './scan.js';
+
+describe('uninstall data group disclosure', () => {
+  const projects = {
+    names: ['gw-abcd1234'],
+    containers: ['gw-abcd1234-web-1', 'gw-abcd1234-database-1'],
+    volumes: ['gw-abcd1234_database'],
+    networks: ['gw-abcd1234'],
+  };
+
+  it('lists the service containers the data group removes when the service group is kept', () => {
+    const inv: Inventory = {
+      slug: 'abcd1234',
+      projectRoot: '/proj',
+      containerRuntime: 'docker',
+      service: { containerIds: [] },
+      data: [],
+      runtime: [],
+      user: [],
+      projects,
+      notes: [],
+    };
+    const actions = buildRemovalPlan(inv, { service: false, data: true, user: false });
+    expect(actions.map((a) => a.kind)).toEqual(['rm-project-residue']);
+    expect(projectRows(projects)).toEqual([
+      { what: 'Service containers', where: 'gw-abcd1234-web-1, gw-abcd1234-database-1' },
+      { what: 'Service data volumes', where: 'gw-abcd1234_database' },
+      { what: 'Service networks', where: 'gw-abcd1234' },
+    ]);
+    expect(PROJECT_NOTE).toContain('even if you keep group 1');
+  });
+});
```

---

### Incident Patch 7: `66fc9c0d` (2026-09-28)
**Commit Message**: fix(setup): restrict failure-assist agents on a live install (#3920)

**File**: `.claude/skills/add-codex/payload/setup/providers/codex.test.ts` (modified, +37/-0)
```diff
@@ -23,14 +23,17 @@ vi.mock('../logs.js', () => ({ step: vi.fn(), userInput: vi.fn() }));
 // The API-key path reads the key through clack's masked prompt; everything
 // else in the module keeps the real clack rendering.
 const mockPassword = vi.fn();
+const mockConfirm = vi.fn();
 vi.mock('@clack/prompts', async (original) => ({
   ...(await original<typeof import('@clack/prompts')>()),
   password: (...args: unknown[]) => mockPassword(...args),
+  confirm: (...args: unknown[]) => mockConfirm(...args),
 }));
 
 import * as setupLog from '../logs.js';
 import {
   buildCodexFailurePrompt,
+  offerCodexFailureAssist,
   runCodexApiKeyAuth,
   runCodexInstallCheck,
   runCodexLoginAuth,
@@ -104,6 +107,40 @@ describe('buildCodexFailurePrompt', () => {
   });
 });
 
+describe('offerCodexFailureAssist', () => {
+  afterEach(() => {
+    vi.unstubAllEnvs();
+    mockSpawn.mockReset();
+    mockSpawnSync.mockReset();
+    mockConfirm.mockReset();
+  });
+
+  it('launches Codex read-only with approval on request', async () => {
+    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-assist-home-'));
+    try {
+      fs.mkdirSync(path.join(home, '.codex'));
+      fs.writeFileSync(path.join(home, '.codex', 'auth.json'), '{}');
+      vi.stubEnv('HOME', home);
+      mockSpawnSync.mockReturnValue({ status: 0, stdout: 'codex-cli 0.155.1' });
+      mockConfirm.mockResolvedValue(true);
+      mockSpawn.mockImplementation(() => {
+        const child = new EventEmitter();
+        setImmediate(() => child.emit('close', 0));
+        return child;
+      });
+
+      expect(await offerCodexFailureAssist({ stepName: 'gateway', msg: 'boom' }, '/repo')).toBe('launched');
+
+      const [binary, args] = mockSpawn.mock.calls[0] as [string, string[]];
+      expect(binary).toBe('codex');
+      expect(args.slice(0, 4)).toEqual(['--sandbox', 'read-only', '--ask-for-approval', 'on-request']);
+      expect(args).toHaveLength(5);
+    } finally {
+      fs.rmSync(home, { recursive: true, force: true });
+    }
+  });
+});
+
 // Session-isolation invariant: the ChatGPT session vaulted for the gateway
 // must never be the user's personal ~/.codex session — sharing one OAuth
 // session across two consumers gets the whole family invalidated server-side
```

**File**: `.claude/skills/add-codex/payload/setup/providers/codex.ts` (modified, +6/-1)
```diff
@@ -306,7 +306,12 @@ export async function offerCodexFailureAssist(ctx: AssistContext, projectRoot: s
 
   return new Promise<FailureAssistResult>((resolve) => {
     // codex accepts a positional initial prompt for the interactive TUI.
-    const child = spawn('codex', [prompt], { cwd: projectRoot, stdio: 'inherit' });
+    // Commands run in a read-only sandbox; anything that needs more (a
+    // write, the Docker socket, the service manager) asks first.
+    const child = spawn('codex', ['--sandbox', 'read-only', '--ask-for-approval', 'on-request', prompt], {
+      cwd: projectRoot,
+      stdio: 'inherit',
+    });
     child.on('close', () => {
       p.log.success(brandBody("Back from Codex. Let's continue."));
       resolve('launched');
```

**File**: `.claude/skills/add-opencode/SKILL.md` (modified, +5/-0)
```diff
@@ -43,6 +43,11 @@ and installation-check failures. Host diagnostic context is model input and may
 remain in native OpenCode history; deleting its private temporary file does not
 erase those records. The helper requires stable OpenCode 1.18.25 or newer with
 `--prompt` and prefers the newest compatible installation it finds.
+`--debug`, `--update` and failure help launch it with an `OPENCODE_PERMISSION`
+override, so OpenCode asks before every edit and command even when the
+operator's top-level config allows them (OpenCode itself skips the prompt for
+a bare redirection with no command, such as `> file`). `--configure` keeps
+OpenCode's native permissions.
 Automatic help before payload
 installation is optional and is not part of the runtime contract.
 
```

**File**: `.claude/skills/add-opencode/payload/scripts/opencode-host.test.ts` (modified, +32/-3)
```diff
@@ -111,7 +111,11 @@ describe('native host OpenCode lifecycle', () => {
     const binary = path.join(root, 'data/host-harness/opencode/node_modules/.bin/opencode');
     expect(findHostOpenCode(root)).toEqual({ binary, version: OPENCODE_HOST_INSTALL_VERSION });
     expect(await hostOpenCode.launch(root)).toBe('exited');
-    expect(edge.spawn).toHaveBeenLastCalledWith(binary, [], { cwd: root, stdio: 'inherit' });
+    expect(edge.spawn).toHaveBeenLastCalledWith(binary, [], {
+      cwd: root,
+      stdio: 'inherit',
+      env: expect.objectContaining({ OPENCODE_PERMISSION: JSON.stringify({ edit: 'ask', bash: 'ask' }) }),
+    });
   });
 
   it('rejects failed help commands even when stderr names the maintenance option', () => {
@@ -185,7 +189,7 @@ describe('native host OpenCode lifecycle', () => {
     expect(await hostOpenCode.prepare(root)).toBe('unavailable');
   });
 
-  it('uses the current checkout, native permissions, and only a context file reference in argv', async () => {
+  it('uses the current checkout, a restrictive permission override, and only a context file reference in argv', async () => {
     touch(path.join(root, 'bin/opencode'));
     const context = path.join(root, 'context with spaces.md');
     touch(context, 'PRIVATE FAILURE DETAIL');
@@ -194,7 +198,18 @@ describe('native host OpenCode lifecycle', () => {
     expect(args).toEqual(['--prompt', `Read ${JSON.stringify(context)} and follow the maintenance request inside it.`]);
     expect(JSON.stringify(args)).not.toContain('PRIVATE FAILURE DETAIL');
     expect(args).not.toContain('--auto');
-    expect(options).toEqual({ cwd: root, stdio: 'inherit' });
+    expect(options.cwd).toBe(root);
+    expect(options.stdio).toBe('inherit');
+    expect(options.env.PATH).toBe(process.env.PATH);
+    // OPENCODE_PERMISSION merges after the global and project config, so it
+    // wins over an operator's top-level allow-all.
+    expect(JSON.parse(options.env.OPENCODE_PERMISSION)).toEqual({ edit: 'ask', bash: 'ask' });
+  });
+
+  it('keeps native configuration free of the maintenance override', async () => {
+    touch(path.join(root, 'bin/opencode'));
+    await hostOpenCode.configure(root);
+    expect(edge.spawn.mock.calls[0][2]).toEqual({ cwd: root, stdio: 'inherit' });
   });
 
   it('allows native configuration without consulting Docker or OneCLI', async () => {
@@ -266,6 +281,20 @@ describe('existing setup failure-assist hook', () => {
     });
     await runHostOpenCode(['--update'], root);
   });
+  it('asks before every edit and command in debug and update sessions', async () => {
+    touch(path.join(root, 'bin/opencode'));
+    const permissions: Record<string, string>[] = [];
+    edge.spawn.mockImplementation((_binary: string, _args: string[], options: { env: Record<string, string> }) => {
+      permissions.push(JSON.parse(options.env.OPENCODE_PERMISSION));
+      const child = new EventEmitter();
+      queueMicrotask(() => child.emit('close', 0));
+      return child;
+    });
+    await runHostOpenCode(['--update'], root);
+    await runHostOpenCode(['--debug'], root);
+    expect(permissions).toHaveLength(2);
+    for (const permission of permissions) expect(permission).toEqual({ edit: 'ask', bash: 'ask' });
+  });
 });
 
 it('reports standalone installation failure instead of a successful command exit', async () => {
```

**File**: `.claude/skills/add-opencode/payload/scripts/opencode-host.ts` (modified, +14/-3)
```diff
@@ -66,9 +66,20 @@ export function findHostOpenCode(root: string): { binary: string; version: strin
   return selected;
 }
 
-function run(binary: string, args: string[], root: string): Promise<'exited' | 'failed' | 'unavailable'> {
+/**
+ * OpenCode allows edits and commands by default. OPENCODE_PERMISSION merges
+ * after the global and project config, so maintenance sessions ask first.
+ */
+export const MAINTENANCE_PERMISSION = JSON.stringify({ edit: 'ask', bash: 'ask' });
+
+function run(
+  binary: string,
+  args: string[],
+  root: string,
+  env?: NodeJS.ProcessEnv,
+): Promise<'exited' | 'failed' | 'unavailable'> {
   return new Promise((resolve) => {
-    const child = spawn(binary, args, { cwd: root, stdio: 'inherit' });
+    const child = spawn(binary, args, env ? { cwd: root, stdio: 'inherit', env } : { cwd: root, stdio: 'inherit' });
     child.once('error', () => resolve('unavailable'));
     child.once('close', (code) => resolve(code === 0 ? 'exited' : 'failed'));
   });
@@ -143,7 +154,7 @@ export const hostOpenCode = {
     const args = contextFile
       ? ['--prompt', `Read ${JSON.stringify(contextFile)} and follow the maintenance request inside it.`]
       : [];
-    return run(binary, args, root);
+    return run(binary, args, root, { ...process.env, OPENCODE_PERMISSION: MAINTENANCE_PERMISSION });
   },
 };
 
```

---

### Incident Patch 8: `7890eae8` (2026-09-28)
**Commit Message**: fix(scheduling): kill the whole process group when a pre-task script times out (#3957)

**File**: `container/agent-runner/src/scheduling/task-script.test.ts` (modified, +100/-0)
```diff
@@ -12,6 +12,9 @@
  * own test goes red.
  */
 import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
+import fs from 'node:fs';
+import os from 'node:os';
+import path from 'node:path';
 
 import { initTestSessionDb, closeSessionDb, getInboundDb, getOutboundDb } from '../mailbox/sqlite/connection.js';
 import { getPendingMessages, markScriptSkipped } from '../db/messages-in.js';
@@ -115,3 +118,100 @@ describe('a timed-out script is reported as a timeout', () => {
     expect(joined).not.toContain('timed out');
   });
 });
+
+describe('a timed-out script takes its children down with it', () => {
+  let tmp: string;
+  beforeEach(() => {
+    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'task-script-'));
+  });
+  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));
+
+  it('kills the forked last command, so its side effect never lands', async () => {
+    const marker = path.join(tmp, 'side-effect');
+    const pidFile = path.join(tmp, 'grandchild.pid');
+    // bash forks (not execs) this last command, so the grandchild outlives a bash-only kill.
+    const script = `bash -c 'echo $$ > ${pidFile}; sleep 1; echo 1 > ${marker}'`;
+
+    const original = console.error;
+    console.error = () => {};
+    try {
+      expect(await runScript(script, 't-orphan', 300)).toBeNull();
+    } finally {
+      console.error = original;
+    }
+
+    // Wait past the grandchild's own sleep, which also gives init time to reap it.
+    await new Promise((r) => setTimeout(r, 1500));
+    expect(fs.existsSync(marker)).toBe(false);
+    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
+    expect(() => process.kill(pid, 0)).toThrow();
+  });
+
+  it('resolves after the kill grace even if a child escaped the group and holds the pipes', async () => {
+    const started = Date.now();
+    const original = console.error;
+    console.error = () => {};
+    try {
+      // set -m puts the background job in its own process group.
+      expect(await runScript('set -m; (sleep 6; echo escaped >&2) & wait', 't-escape', 200)).toBeNull();
+    } finally {
+      console.error = original;
+    }
+    expect(Date.now() - started).toBeLessThan(4000);
+  }, 10_000);
+
+  it('sends SIGTERM first, so a script can trap its timeout and clean up', async () => {
+    const cleaned = path.join(tmp, 'cleaned');
+    const original = console.error;
+    console.error = () => {};
+    try {
+      const script = `trap 'echo 1 > ${cleaned}; exit 1' TERM; sleep 5 & wait`;
+      const started = Date.now();
+      expect(await runScript(script, 't-trap', 200)).toBeNull();
+      // Exited on SIGTERM, so it resolves inside the grace instead of waiting for SIGKILL.
+      expect(Date.now() - started).toBeLessThan(1500);
+    } finally {
+      console.error = original;
+    }
+    expect(fs.existsSync(cleaned)).toBe(true);
+  });
+
+  it('SIGKILLs a child that ignores SIGTERM, and resolves only once it is dead', async () => {
+    const marker = path.join(tmp, 'stubborn');
+    const pidFile = path.join(tmp, 'stubborn.pid');
+    const pgidFile = path.join(tmp, 'stubborn.pgid');
+    const original = console.error;
+    console.error = () => {};
+    try {
+      // An ignored signal stays ignored across exec, so sleep ignores SIGTERM too.
+      // The script's own bash is the group leader, so its pid is the group id.
+      const script = `echo $$ > ${pgidFile}; bash -c 'trap "" TERM; echo $$ > ${pidFile}; sleep 3; echo 1 > ${marker}'`;
+      const started = Date.now();
+      expect(await runScript(script, 't-stubborn', 200)).toBeNull();
+      expect(Date.now() - started).toBeGreaterThanOrEqual(2000);
+    } finally {
+      console.error = original;
+    }
+    // Checked at resolution, not later: resolving early would let the next task's script overlap this one.
+    const pgid = Number(fs.readFileSync(pgidFile, 'utf8'));
+    expect(() => process.kill(-pgid, 0)).toThrow();
+    const pid = Number(fs.readFileSync(pidFile, 'utf8'));

```

**File**: `container/agent-runner/src/scheduling/task-script.ts` (modified, +143/-47)
```diff
@@ -1,11 +1,18 @@
-import { execFile } from 'node:child_process';
+import { spawn } from 'node:child_process';
 import fs from 'node:fs';
 import path from 'node:path';
 import type { MessageInRow } from '../db/messages-in.js';
 import { touchHeartbeat } from '../heartbeat.js';
 
 const SCRIPT_TIMEOUT_MS = 30_000;
 const SCRIPT_MAX_BUFFER = 1024 * 1024;
+// On timeout the group gets SIGTERM, so a script can trap it and clean up as it could
+// under execFile, then SIGKILL after the grace. 2 s is enough to drop a lock or temp dir
+// and adds little to the 30 s budget. Worst case a timed-out script holds the queue for
+// timeout + grace + reap cap (33 s at the defaults).
+const SCRIPT_KILL_GRACE_MS = 2_000;
+// SIGKILL is not synchronous; wait this long for the group to vanish before moving on.
+const SCRIPT_KILL_REAP_MS = 1_000;
 
 export interface ScriptResult {
   wakeAgent: boolean;
@@ -25,54 +32,143 @@ export async function runScript(
   fs.writeFileSync(scriptPath, script, { mode: 0o755 });
 
   return new Promise((resolve) => {
-    execFile(
-      'bash',
-      [scriptPath],
-      { timeout: timeoutMs, maxBuffer: SCRIPT_MAX_BUFFER, env: process.env },
-      (error, stdout, stderr) => {
-        try {
-          fs.unlinkSync(scriptPath);
-        } catch {
-          /* best-effort cleanup */
-        }
-
-        if (stderr) {
-          log(`[${taskId}] stderr: ${stderr.slice(0, 500)}`);
-        }
-
-        if (error) {
-          // execFile kills on timeout, so a script that ran too long arrives
-          // here as a generic "Command failed" — indistinguishable from one
-          // that exited non-zero on its first line. `killed` is what separates
-          // them; say which happened, and name the ceiling that was hit.
-          if ((error as { killed?: boolean }).killed) {
-            log(`[${taskId}] timed out after ${timeoutMs}ms and was killed; output discarded`);
-          } else {
-            log(`[${taskId}] error: ${error.message}`);
-          }
+    // Bash forks the last command of a script file instead of exec'ing it, so
+    // killing bash alone orphans that child and its side effects still land.
+    // Run the script in its own process group and kill the whole group.
+    const child = spawn('bash', [scriptPath], { detached: true, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
+
+    const out = { stdout: [] as Buffer[], stderr: [] as Buffer[] };
+    const bytes = { stdout: 0, stderr: 0 };
+    let killed = false;
+    let overflow: 'stdout' | 'stderr' | null = null;
+    let exitCode: number | null = null;
+    let exitSignal: NodeJS.Signals | null = null;
+
+    const signalGroup = (signal: NodeJS.Signals | 0): boolean => {
+      try {
+        process.kill(-child.pid!, signal);
+        return true;
+      } catch {
+        return false; // group already gone
+      }
+    };
+
+    // After a kill, resolve only once the group is gone, so the next task's script
+    // never overlaps this one and no signal is sent after the PGID could be reused.
+    let closed = false;
+    let groupGone = false;
+    let poll: ReturnType<typeof setInterval> | undefined;
+    let graceTimer: ReturnType<typeof setTimeout> | undefined;
+    const tryFinish = (): void => {
+      if (closed && (!killed || groupGone)) finish(null);
+    };
+    const endGroup = (): void => {
+      clearInterval(poll);
+      clearTimeout(graceTimer);
+      groupGone = true;
+      // A process that left the group can still hold the pipes open; drop them
+      // so 'close' fires, as execFile does.
+      child.stdout.destroy();
+      child.stderr.destroy();
+      tryFinish();
+    };
+    const killGroup = (): void => {
+      if (killed) return;
+      killed = true;
+      if (!signalGroup('SIGTERM')) return endGroup();
+      poll = setInterval(() => {
+        if (!signalGroup(0)) endGroup();
+      }, 100);
+      graceTimer = setTimeout(() => {
+        signalGroup('SIGKILL');
+        graceTim
```

---

### Incident Patch 9: `27679916` (2026-09-28)
**Commit Message**: fix(add-onecli): name the credential, not the provider, in adapter errors (#3960)

**File**: `.claude/skills/add-onecli/scripts/provider-credentials.test.ts` (modified, +6/-6)
```diff
@@ -10,13 +10,13 @@ import {
 } from './provider-credentials.js';
 
 const CHATGPT_SECRET: OneCliCredential = {
-  name: 'OpenCode ChatGPT',
+  name: 'Provider ChatGPT',
   type: 'openai',
   hostPattern: 'chatgpt.com',
   authMode: 'oauth',
 };
 const google: OneCliCredential = {
-  name: 'OpenCode google',
+  name: 'Provider google',
   type: 'generic',
   hostPattern: 'generativelanguage.googleapis.com',
   injectionConfig: { headerName: 'x-goog-api-key', valueFormat: '{value}' },
@@ -35,7 +35,7 @@ const metadata = (spec: OneCliCredential = google) => ({
 
 afterEach(() => vi.unstubAllEnvs());
 
-describe('OpenCode vault management', () => {
+describe('OneCLI vault management', () => {
   it('reuses an inline credential when a legacy response omits its source', async () => {
     const transport = vi.fn(
       async (_url: string, init: RequestInit) =>
@@ -253,9 +253,9 @@ describe('OpenCode vault management', () => {
   });
 });
 
-describe('OpenCode credential host migration', () => {
+describe('OneCLI credential host migration', () => {
   const target: OneCliCredential = {
-    name: 'OpenCode openai',
+    name: 'Provider openai',
     type: 'generic',
     hostPattern: 'new.example',
     injectionConfig: { headerName: 'Authorization', valueFormat: 'Bearer {value}' },
@@ -388,7 +388,7 @@ describe('gateway seam adapter', () => {
     );
     const connection = createProviderCredentialConnection(key());
     expect(await connection.find()).toBeNull();
-    await expect(connection.keep()).rejects.toThrow('No stored OpenCode credential');
+    await expect(connection.keep()).rejects.toThrow(`No stored ${google.name} credential`);
     await connection.save('google-fixture');
     expect(writes).toEqual([expect.objectContaining({ name: google.name, type: 'generic', value: 'google-fixture' })]);
   });
```

**File**: `.claude/skills/add-onecli/scripts/provider-credentials.ts` (modified, +12/-10)
```diff
@@ -65,7 +65,7 @@ export function findOneCliCredential(payload: unknown, descriptor: OneCliCredent
   const secret = namedSecret(payload, descriptor.name);
   if (!secret) return null;
   const injection = descriptor.injectionConfig;
-  // Older OpenCode setup used bearer injection for every generic key. Only
+  // An older provider setup used bearer injection for every generic key. Only
   // that known mistake may be repaired; arbitrary rules belong to the operator.
   const knownKeyMapping =
     !injection || sameInjection(secret.injectionConfig, injection) || sameInjection(secret.injectionConfig, BEARER);
@@ -104,7 +104,7 @@ export function createOneCliCredentialConnection(
   const saved = readEnvFile(['ONECLI_URL', 'ONECLI_API_KEY', 'ONECLI_PROJECT_ID'], root);
   url ??= process.env.ONECLI_URL || saved.ONECLI_URL;
   apiKey ??= process.env.ONECLI_API_KEY || saved.ONECLI_API_KEY;
-  if (!url) throw new Error('Configure ONECLI_URL before connecting an OpenCode credential.');
+  if (!url) throw new Error(`Configure ONECLI_URL before connecting the ${descriptor.name} credential.`);
   const base = new URL(url);
   if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
     throw new Error('ONECLI_URL must be an HTTP(S) gateway URL without embedded credentials, query, or fragment.');
@@ -129,7 +129,7 @@ export function createOneCliCredentialConnection(
       // API responses can include previews of secrets. Never echo them or a
       // transport error, including when a successful write's response is lost.
       throw new Error(
-        'Could not confirm the OpenCode credential in OneCLI. Check gateway connectivity and management permissions, then retry.',
+        `Could not confirm the ${descriptor.name} credential in OneCLI. Check gateway connectivity and management permissions, then retry.`,
       );
     }
   };
@@ -153,7 +153,9 @@ export function createOneCliCredentialConnection(
       const previous = { ...descriptor, hostPattern: secret.hostPattern };
       findOneCliCredential(metadata, previous);
       if (!(await options.confirmHostChange(previous.hostPattern, descriptor.hostPattern))) {
-        throw new Error('OpenCode credential host change cancelled. Existing credential and defaults are unchanged.');
+        throw new Error(
+          `The ${descriptor.name} credential host change cancelled. Existing credential and defaults are unchanged.`,
+        );
       }
       expected = previous;
     }
@@ -166,7 +168,7 @@ export function createOneCliCredentialConnection(
     async keep(existingId) {
       const metadata = await request('', 'GET');
       if (findOneCliCredential(metadata, expected) !== existingId) {
-        throw new Error('The OpenCode vault entry changed during setup. Check OneCLI and retry.');
+        throw new Error(`The ${descriptor.name} vault entry changed during setup. Check OneCLI and retry.`);
       }
       const secret = (metadata as Array<Record<string, unknown>>).find((row) => row.id === existingId)!;
       const changes = {
@@ -181,9 +183,9 @@ export function createOneCliCredentialConnection(
       }
     },
     async save(value, existingId) {
-      if (!value.trim()) throw new Error('Cannot save an empty OpenCode credential.');
+      if (!value.trim()) throw new Error(`Cannot save an empty ${descriptor.name} credential.`);
       if ((await find()) !== existingId) {
-        throw new Error('The OpenCode vault entry changed during setup. Check OneCLI and retry.');
+        throw new Error(`The ${descriptor.name} vault entry changed during setup. Check OneCLI and retry.`);
       }
       if (existingId) {
         await request(`/${encodeURIComponent(existingId)}`, 'PATCH', {
@@ -243,7 +245,7 @@ export function createProviderCredentialConnection(
   void target.proxyValue;
   let observed: string | null | undefined;
   const require = (): string | null => {
-    if (observed === undefined) throw new Erro
```

---

### Incident Patch 10: `63082563` (2026-09-28)
**Commit Message**: fix(update): keep gateway-owned containers through cutover and residue reaping (#3948)

* fix(update): keep gateway containers through cutover and residue reaping

The cutover drain (#3873) stopped every install-labeled container, which
includes the Iron central proxy (role=gateway, no session). On the next
host start reapResidue removed it as an exited orphan, and nothing
recreates it: every spawn then failed with "Iron Proxy central container
is unavailable" until add-iron-proxy setup was re-run.

- drainContainers skips containers with a role label and no session.
- reapResidue's exited-container pass keeps them too, matching the
  pre-seam pass, which already preserved gateway-owned roles.

* fix(update): restart kept gateways after a rollback restores data/

restoreSnapshot replaces data/, so a gateway kept running through
cutover would keep its bind mounts on the deleted approval and config
directories. Restart gateway-owned containers right after the restore,
best effort, before the old service starts.

* fix(update): match role=gateway exactly; restart stopped gateways on rollback

* fix(update): log when gateway containers cannot be listed on rollback

* refactor(drivers):

**File**: `.claude/skills/add-iron-proxy/scripts/setup.ts` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ import path from 'node:path';
 import { fileURLToPath } from 'node:url';
 
 import { getInstallSlug } from '../../../../src/install-slug.js';
-import { LABELS } from '../../../../src/drivers/types.js';
+import { GATEWAY_ROLE, LABELS } from '../../../../src/drivers/types.js';
 import { upsertEnvVar } from '../../../../setup/set-env.js';
 import { installStep, installCommand, InstallCommandFailure } from './install-command.js';
 import { buildManagedProxy, hasFrontProxy } from './build-managed-proxy.js';
@@ -149,7 +149,7 @@ async function startCentralProxy(projectRoot: string): Promise<void> {
     '--label',
     centralInstallLabel(projectRoot),
     '--label',
-    `${LABELS.role}=gateway`,
+    `${LABELS.role}=${GATEWAY_ROLE}`,
     ...(uid == null ? [] : ['--user', `${uid}:${gid ?? uid}`]),
     ...centralHostGatewayArgs(),
     '--restart',
```

**File**: `docs/gateway-seam.md` (modified, +12/-0)
```diff
@@ -252,6 +252,18 @@ The payload lands in ordinary paths — `src/gateway-providers/<kind>.ts`,
 `src/gateway-providers/installed.ts`. Nothing outside that directory is
 rewritten to install a gateway.
 
+## Gateway-owned containers
+
+A gateway skill that runs its own long-lived containers labels them
+`nanoclaw-install=<slug>` and `nanoclaw-role=gateway` (`GATEWAY_ROLE` in
+`src/drivers/types.ts`), with no `nanoclaw-session`. Core never stops or reaps
+those in install-wide sweeps (host residue reaping, the update cutover drain);
+only the gateway's setup recreates them. After an update rollback restores
+`data/`, core restarts them so their bind mounts point at the restored
+directories. Uninstall still removes them with the rest of the install. Do not
+add these labels to a gateway's existing Compose volumes or networks: Compose
+then asks to recreate them, which loses their data.
+
 ## Mount class `gateway-trust`
 
 Public CA material a MITM gateway needs the agent to trust. Pinned by path to
```

**File**: `scripts/update/service.test.ts` (modified, +68/-8)
```diff
@@ -9,16 +9,20 @@ import { afterEach, describe, expect, it, vi } from 'vitest';
 import {
   CUTOVER_LIST_CLI_TIMEOUT_MS,
   CUTOVER_STOP_CLI_TIMEOUT_MS,
+  CONTROLLER_GATEWAY_ROLE,
   CUTOVER_STOP_GRACE_SECONDS,
+  DRAIN_LIST_FORMAT,
   createCommandRunner,
   detectService,
   drainContainers,
+  restartGatewayContainers,
   startService,
   stopService,
   verifyServiceHealth,
   type CommandRunner,
   type ServiceEnvironment,
 } from './service.js';
+import { GATEWAY_ROLE, LABELS } from '../../src/drivers/types.js';
 
 const roots: string[] = [];
 
@@ -139,11 +143,11 @@ describe('drain and health gates', () => {
     const root = temp();
     const label = `nanoclaw-install=${slug(root)}`;
     const { env, calls } = makeEnv('linux', {
-      [`docker ps -q --filter label=${label}`]: { ok: true, stdout: '' },
+      [`docker ps --filter label=${label} --format ${DRAIN_LIST_FORMAT}`]: { ok: true, stdout: '' },
     });
 
     await drainContainers(root, env);
-    expect(calls).toEqual([`docker ps -q --filter label=${label}`]);
+    expect(calls).toEqual([`docker ps --filter label=${label} --format ${DRAIN_LIST_FORMAT}`]);
   });
 
   it('stops the labeled containers itself, then waits for the runtime to list none (#3828)', async () => {
@@ -152,7 +156,7 @@ describe('drain and health gates', () => {
     // succeed: the drain must be the thing that stops them.
     const root = temp();
     const label = `nanoclaw-install=${slug(root)}`;
-    const ps = `docker ps -q --filter label=${label}`;
+    const ps = `docker ps --filter label=${label} --format ${DRAIN_LIST_FORMAT}`;
     let listings = 0;
     const { env, calls } = makeEnv('linux');
     env.runner.tryRun = (command, args) => {
@@ -173,10 +177,63 @@ describe('drain and health gates', () => {
     expect(progress).toEqual(['Stopping 2 NanoClaw container(s) for cutover: aaa111, bbb222']);
   });
 
+  it('keeps its inlined label contract equal to src/drivers/types.ts', () => {
+    expect(DRAIN_LIST_FORMAT).toBe(`{{.ID}}|{{.Label "${LABELS.session}"}}|{{.Label "${LABELS.role}"}}`);
+    expect(CONTROLLER_GATEWAY_ROLE).toBe(GATEWAY_ROLE);
+  });
+
+  it('leaves gateway-owned containers running through cutover', async () => {
+    // A gateway's own container carries the install label and role=gateway but
+    // no session; stopping it let the next host start reap it.
+    const root = temp();
+    const label = `nanoclaw-install=${slug(root)}`;
+    const ps = `docker ps --filter label=${label} --format ${DRAIN_LIST_FORMAT}`;
+    let stopped = false;
+    const { env, calls } = makeEnv('linux');
+    env.runner.tryRun = (command, args) => {
+      const key = `${command} ${args.join(' ')}`;
+      calls.push(key);
+      if (args[0] === 'stop') stopped = true;
+      if (key === ps)
+        return { ok: true, stdout: `${stopped ? '' : 'agent111|s1|agent\nbare444||agent\n'}gw222||gateway\n` };
+      return { ok: true, stdout: '' };
+    };
+
+    await drainContainers(root, env);
+    expect(calls).toEqual([ps, `docker stop -t ${CUTOVER_STOP_GRACE_SECONDS} agent111 bare444`, ps]);
+  });
+
+  it('still stops pre-seam containers (no session, no role)', async () => {
+    const root = temp();
+    const label = `nanoclaw-install=${slug(root)}`;
+    const ps = `docker ps --filter label=${label} --format ${DRAIN_LIST_FORMAT}`;
+    const { env, calls } = makeEnv('linux', { [ps]: { ok: true, stdout: 'old333||\n' } });
+
+    await expect(drainContainers(root, env, 0)).rejects.toThrow('old333');
+    expect(calls).toContain(`docker stop -t ${CUTOVER_STOP_GRACE_SECONDS} old333`);
+  });
+
+  it('restarts only gateway-owned containers after a snapshot restore, and never throws', () => {
+    const root = temp();
+    const label = `nanoclaw-install=${slug(root)}`;
+    const ps = `docker ps -a --filter label=${label} --format ${DRAIN_LIST_FORMAT}`;
+    const restart = `docker restart -t ${CUTOVER_STOP_GRACE_SECONDS} gw222`;
+    const { env, calls } = makeEnv('linux', {
+
```

**File**: `scripts/update/service.ts` (modified, +61/-8)
```diff
@@ -221,6 +221,10 @@ export const CUTOVER_STOP_CLI_TIMEOUT_MS = 30_000;
 /** Bound on each `docker ps` poll, for the same reason. */
 export const CUTOVER_LIST_CLI_TIMEOUT_MS = 15_000;
 
+/** Copies of `LABELS` and `GATEWAY_ROLE` (src/drivers/types.ts); a test pins them equal. */
+export const DRAIN_LIST_FORMAT = '{{.ID}}|{{.Label "nanoclaw-session"}}|{{.Label "nanoclaw-role"}}';
+export const CONTROLLER_GATEWAY_ROLE = 'gateway';
+
 /**
  * Stop this install's containers, then wait until the runtime lists none.
  *
@@ -232,10 +236,10 @@ export const CUTOVER_LIST_CLI_TIMEOUT_MS = 15_000;
  *
  * Stopping here, after the service is down, is race-free: nothing is left that
  * could spawn a replacement (the manual `docker stop` before cutover was not).
- * The filter is the install label alone — the set the host's own residue
- * reaping and `setup/uninstall` act on: agent containers plus any per-session
- * auxiliary. The OneCLI gateway is a separate compose project without this
- * label and is never touched.
+ * The filter is the install label (agent containers plus per-session
+ * auxiliaries) minus gateway-owned ones (role=gateway, no session): nothing
+ * recreates those at host start. Same rule as `isGatewayOwned` in
+ * src/drivers/types.ts, inlined to keep the controller's imports small.
  *
  * A container mid-turn is stopped as well. The agent-runner has no SIGTERM
  * handler and the controller cannot read turn state from outside the host
@@ -250,10 +254,19 @@ export async function drainContainers(projectRoot: string, env: ServiceEnvironme
   const runtime = process.env.CONTAINER_RUNTIME ?? 'docker';
   const label = `nanoclaw-install=${getInstallSlug(projectRoot)}`;
   const list = (): { ok: boolean; ids: string[] } => {
-    const listed = env.runner.tryRun(runtime, ['ps', '-q', '--filter', `label=${label}`], undefined, {
-      timeoutMs: CUTOVER_LIST_CLI_TIMEOUT_MS,
-    });
-    return { ok: listed.ok, ids: listed.stdout.split('\n').filter(Boolean) };
+    const listed = env.runner.tryRun(
+      runtime,
+      ['ps', '--filter', `label=${label}`, '--format', DRAIN_LIST_FORMAT],
+      undefined,
+      { timeoutMs: CUTOVER_LIST_CLI_TIMEOUT_MS },
+    );
+    const ids = listed.stdout
+      .split('\n')
+      .filter(Boolean)
+      .map((line) => line.split('|'))
+      .filter(([, sessionId, role]) => !!sessionId || role !== CONTROLLER_GATEWAY_ROLE)
+      .map(([id]) => id);
+    return { ok: listed.ok, ids };
   };
   const initial = list();
   if (!initial.ok) throw new Error(`Cannot inspect active NanoClaw containers with ${runtime}`);
@@ -281,6 +294,46 @@ export async function drainContainers(projectRoot: string, env: ServiceEnvironme
   }
 }
 
+/**
+ * Restart this install's gateway-owned containers (see drainContainers).
+ * A snapshot restore replaces `data/`, and a container's bind mounts keep
+ * pointing at the deleted directories until it restarts. Stopped ones are
+ * included so a retried rollback recovers a restart that failed halfway.
+ * Best effort: throwing here would leave the service down, so a failure is
+ * logged with the recovery step instead.
+ */
+export function restartGatewayContainers(projectRoot: string, env: ServiceEnvironment): void {
+  const runtime = process.env.CONTAINER_RUNTIME ?? 'docker';
+  const label = `nanoclaw-install=${getInstallSlug(projectRoot)}`;
+  const listed = env.runner.tryRun(
+    runtime,
+    ['ps', '-a', '--filter', `label=${label}`, '--format', DRAIN_LIST_FORMAT],
+    undefined,
+    { timeoutMs: CUTOVER_LIST_CLI_TIMEOUT_MS },
+  );
+  const ids = listed.stdout
+    .split('\n')
+    .filter(Boolean)
+    .map((line) => line.split('|'))
+    .filter(([, sessionId, role]) => !sessionId && role === CONTROLLER_GATEWAY_ROLE)
+    .map(([id]) => id);
+  if (!listed.ok) {
+    env.log?.(`Cannot list gateway containers with ${runtime}; restart them or re-run the gateway's setup script.`);
+    return;
+  }
+  if (ids.length === 0) return;
+  env.log?.(`Re
```

**File**: `scripts/update/transaction.e2e.test.ts` (modified, +10/-2)
```diff
@@ -18,7 +18,7 @@ import {
   validateUpdate,
   type UpdateRuntime,
 } from './transaction.js';
-import { CUTOVER_STOP_CLI_TIMEOUT_MS, drainContainers, stopService } from './service.js';
+import { CUTOVER_STOP_CLI_TIMEOUT_MS, DRAIN_LIST_FORMAT, drainContainers, stopService } from './service.js';
 import { getInstallSlug } from '../../src/install-slug.js';
 import type { CommandRunner, ServiceHandle } from './service.js';
 
@@ -195,6 +195,9 @@ function fakeRuntime(
     drainContainers: async () => {
       events.push('containers drained');
     },
+    restartGateways: () => {
+      events.push('gateways restarted');
+    },
     // The fixtures are minimal repos with no setup/ tree; load this checkout's.
     loadGateway: () => loadGatewayModules(path.resolve(import.meta.dirname, '../..')),
     startService: () => {
@@ -286,8 +289,13 @@ describe('update-nanoclaw transaction end to end', () => {
     fs.writeFileSync(path.join(fixture.install, 'start-nanoclaw.sh'), '#!/bin/bash\nexit 1\n');
     fs.writeFileSync(path.join(fixture.install, 'nanoclaw.pid'), '9999\n');
     runtime.detectService = () => ({ mode: 'unmanaged', active: true });
+    const beforeRollback = events.length;
     state = await rollbackUpdate(fixture.install, state.id, runtime);
     expect(state.phase).toBe('rolled-back');
+    // Gateways kept through cutover must be remounted onto the restored data/.
+    const rollbackEvents = events.slice(beforeRollback);
+    expect(rollbackEvents).toContain('gateways restarted');
+    expect(rollbackEvents.indexOf('gateways restarted')).toBeLessThan(rollbackEvents.indexOf('service start'));
     expect(exec(fixture.install, 'git', ['rev-parse', 'HEAD'])).toBe(fixture.originalHead);
     expect(fs.readFileSync(path.join(fixture.install, 'data/v2.db'), 'utf8')).toBe('old-schema');
     expect(fs.readFileSync(path.join(fixture.install, '.env'), 'utf8')).toBe('EXAMPLE=old\n');
@@ -611,7 +619,7 @@ describe('update-nanoclaw transaction end to end', () => {
     expect(cut.phase).toBe('cutover');
     // state.projectRoot is realpathed (macOS tmp lives under /var → /private/var), so derive the slug from it.
     const slugValue = getInstallSlug(cut.projectRoot);
-    const ps = `docker ps -q --filter label=nanoclaw-install=${slugValue}`;
+    const ps = `docker ps --filter label=nanoclaw-install=${slugValue} --format ${DRAIN_LIST_FORMAT}`;
     expect(events.indexOf('service stop')).toBeLessThan(events.indexOf(ps));
     expect(events.filter((e) => e.startsWith('docker '))).toEqual([ps, 'docker stop -t 10 idle111', ps]);
 
```

#### Recent Merged Pull Requests:
- **PR #3974** (2026-09-30): fix(container): refresh agent-runner lockfile to clear transitive advisories (@glifocat)
- **PR #3962** (2026-09-30): fix(update): refuse cutover when the service liveness probe itself fails (@glifocat)
- **PR #3960** (2026-09-28): fix(add-onecli): name the credential, not the provider, in adapter errors (@glifocat)
- **PR #3959** (2026-09-28): test(agent-runner): spawn bun children asynchronously so CI stops hanging in spawnSync (@glifocat)
- **PR #3958** (2026-09-29): fix(log): never throw when a log value cannot be JSON-serialized (@glifocat)
- **PR #3957** (2026-09-28): fix(scheduling): kill the whole process group when a pre-task script times out (@glifocat)
- **PR #3955** (2026-09-29): docs(opencode): keep gateway notes in the gateway skills (@glifocat)
- **PR #3954** (2026-09-29): docs(gateways): correct what the credential reread refuses in two comments (@glifocat)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
