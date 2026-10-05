# Forensic Learning Record (Deep Inspection): trailhq/Graft

> **Canonical Artifact**: `07_PROJECT_LEARNING/trailhq-graft-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/trailhq/Graft](https://github.com/trailhq/Graft))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:38:33.039Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `trailhq/Graft`
- **Description**: Turbocharge Claude Code, Cursor, Codex, Gemini & every coding agent: faster, cheaper, with contextual understanding specific to your codebase.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 9429 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/graph-quality.mjs`
```
/**
 * Graph-quality report + invariant check for a built graph (`graft/.graph/wiring.json`).
 *
 *   node scripts/graph-quality.mjs <repo-dir-or-wiring.json> [--json] [--strict]
 *
 * Tier-0 of the quality strategy: needs no external oracle. Reports the graph's
 * shape (nodes by kind/origin, edges by relation/confidence, resolution rate) and
 * asserts structural INVARIANTS that must always hold:
 *   - no dangling edge endpoints (every source is a node; every target is a node
 *     or a deliberately-unresolved external string)
 *   - valid spans (`Lx-Ly`, x<=y, within file line count where known)
 *   - unique node ids; non-empty names; kinds in the allowed set
 *   - no self-loop call edges
 * Exits non-zero with --strict when any invariant fails (CI gate).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const KINDS = new Set(["file","class","function","method","interface","type","enum","struct","module","constant","variable"]);
const RELATIONS = new Set(["contains","calls","imports","references","implements","extends"]);
const CONFIDENCE = new Set(["lsp_resolved","lsp_dispatch","extracted","inferred"]);

const arg = process.argv[2] ?? ".";
const json = process.argv.includes("--json");
const strict = process.argv.includes("--strict");
const wpath = arg.endsWith(".json") ? arg
  : [join(arg, "graft", ".graph", "wiring.json"), join(arg, "graft", "wiring.json")].find(existsSync);
if (!wpath || !existsSync(wpath)) { console.error(`no graph found at ${arg} (run \`graft build\` first)`); process.exit(2); }

const g = JSON.parse(readFileSync(wpath, "utf8"));
const nodes = g.nodes ?? [], edges = g.edges ?? [];
const ids = new Set(nodes.map((n) => n.id));

const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
const byKind = new Map(), byOrigin = new Map(), byRel = new Map(), byConf = new Map();
for (const n of nodes) { bump(byKind, n.kind); bump(byOrigin, n.origin ?? "?"); }
for (const e of edges) { bump(byRel, e.relation); bump(byConf, e.confidence); }

// ── invariants ──
const problems = [];
const seen = new Set();
for (const n of nodes) {
  if (seen.has(n.id)) problems.push(`dup id: ${n.id}`); seen.add(n.id);
  if (!n.name || !String(n.name).trim()) problems.push(`empty name: ${n.id}`);
  if (!KINDS.has(n.kind)) problems.push(`bad kind '${n.kind}': ${n.id}`);
  const m = /^L(\d+)-L(\d+)$/.exec(n.span ?? "");
  if (!m) problems.push(`bad span '${n.span}': ${n.id}`);
  else if (Number(m[1]) > Number(m[2])) problems.push(`inverted span ${n.span}: ${n.id}`);
}
// an edge target may be a node id OR a deliberately-unresolved external string
// (import specifier / bare heritage name / unresolved Java annotation type);
// only calls/contains must point at real nodes.
let dangling = 0, selfLoops = 0, unresolvedExternal = 0;
for (const e of edges) {
  if (!RELATIONS.has(e.relation)) problems.push(`bad relation '${e.relation}'`);
  if (!CONFIDENCE.has(e.confidence)) problems.push(`bad confidence '${e.confidence}'`);
  if (!ids.has(e.source)) { problems.push(`dangling source: ${e.source}`); dangling++; }
  const targetIsNode = ids.has(e.target);
  if (!targetIsNode) {
    if (e.relation === "imports" || e.relation === "extends" || e.relation === "implements" || e.relation === "references") unresolvedExternal++;
    else { problems.push(`dangling ${e.relation} target: ${e.source} → ${e.target}`); dangling++; }
  }
  if (e.relation === "calls" && e.source === e.target) selfLoops++;
}

// ── resolution / connectivity metrics ──
const calls = edges.filter((e) => e.relation === "calls");
const resolvedCalls = calls.filter((e) => ids.has(e.target)).length;
const withEdge = new Set();
for (const e of edges) { if (e.relation !== "contains") { withEdge.add(e.source); if (ids.has(e.target)) withEdge.add(e.target); } }
const symbolNodes = nodes.filter((n) => n.kind !== "file");
const orphans = symbolNodes.filter((n) => !withEdge.has(n.id)).length;

const report = {
  graph: wpath,
  nodes: nodes.length,
  symbolNodes: symbolNodes.length,
  edges: edges.length,
  byKind: Object.fromEntries([...byKind].sort((a,b)=>b[1]-a[1])),
  byOrigin: Object.fromEntries(byOrigin),
  byRelation: Object.fromEntries(byRel),
  byConfidence: Object.fromEntries(byConf),
  resolution: {
    calls: calls.length,
    resolvedToNode: resolvedCalls,
    resolvedPct: calls.length ? Math.round((resolvedCalls / calls.length) * 100) : null,
    unresolvedExternalImports: unresolvedExternal,
  },
  connectivity: {
    orphanSymbolNodes: orphans,
    orphanPct: symbolNodes.length ? Math.round((orphans / symbolNodes.length) * 100) : null,
  },
  invariants: {
    ok: problems.length === 0,
    danglingEdges: dangling,
    selfLoopCalls: selfLoops,
    violations: problems.length,
    sample: problems.slice(0, 15),
  },
};

if (json) { console.log(JSON.stringify(report, null, 2)); }
else {
  const p = report;
  console.log(`graph-quality — ${p.graph}`);
  console.log(`  nodes ${p.nodes} (${p.symbolNodes} symbols) · edges ${p.edges}`);
  console.log(`  kinds:      ${Object.entries(p.byKind).map(([k,v])=>`${k}=${v}`).join(" ")}`);
  console.log(`  origin:     ${Object.entries(p.byOrigin).map(([k,v])=>`${k}=${v}`).join(" ")}`);
  console.log(`  relations:  ${Object.entries(p.byRelation).map(([k,v])=>`${k}=${v}`).join(" ")}`);
  console.log(`  confidence: ${Object.entries(p.byConfidence).map(([k,v])=>`${k}=${v}`).join(" ")}`);
  console.log(`  calls resolved: ${p.resolution.resolvedToNode}/${p.resolution.calls} (${p.resolution.resolvedPct}%)`);
  console.log(`  orphan symbols: ${p.connectivity.orphanSymbolNodes}/${p.symbolNodes} (${p.connectivity.orphanPct}%)`);
  console.log(`  INVARIANTS: ${p.invariants.ok ? "OK ✓" : `FAIL ✗ (${p.invariants.violations} violations, ${p.invariants.danglingEdges} dangling)`}`);
  if (!p.invariants.ok) for (const s of p.invariants.sample) console.log(`     - ${s}`);
  if (p.invariants.selfLoopCalls) console.log(`  note: ${p.invariants.selfLoopCalls} self-loop calls`);
}
if (strict && !report.invariants.ok) process.exit(1);

```

### Core Architecture Module: `scripts/postinstall.mjs`
```
// Prints a one-line nudge after install, and records the anonymous `install`
// event. Never fails the install.
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Record the install, then hand the queue straight to a detached child.
 *
 * Sending here rather than letting the daily flush pick it up is the entire
 * point of the event: the machine we most want to count is the one that installs
 * graft and never runs a command, and that machine never reaches a flush. The
 * child is detached with stdio ignored, so npm waits on no socket and an offline
 * install looks like any other.
 *
 * Every gate still applies — a fork or a local build has no key, and CI,
 * `DO_NOT_TRACK` and `graft telemetry disable` all close it. See TELEMETRY.md.
 */
async function recordInstall() {
  // `dist/` is absent when this runs from a clone, where `prepare` builds AFTER
  // postinstall. Nothing to record there, and a fork has no key regardless.
  const entry = join(root, 'dist', 'telemetry', 'index.js');
  const cli = join(root, 'dist', 'cli.js');
  if (!existsSync(entry) || !existsSync(cli)) return;
  const mod = await import(pathToFileURL(entry).href);
  // A `dist/` from an older version has no such export. Absent, not broken.
  if (typeof mod.trackInstallIfNew !== 'function') return;
  // npm sets this for `npm i -g`; only its value 'true' means global.
  mod.trackInstallIfNew({ global: process.env.npm_config_global === 'true' });
  const child = spawn(process.execPath, [cli, '_telemetry-flush'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

try {
  if (process.env.CI) process.exit(0);
  const dir = process.env.INIT_CWD || process.cwd();
  // Its own catch: the nudge is the part a user sees, and a telemetry fault must
  // not be able to silence it.
  try { await recordInstall(); } catch { /* telemetry is never worth an error */ }
  if (existsSync(join(dir, '.claude', 'helpers', 'graft-statusline.cjs'))) process.exit(0);
  console.log('\n  Graft installed. Run `npx graft init` to enable the Claude Code integration (statusline + hooks + auto-sync).\n');
} catch {
  /* never fail an install */
}

```

### Core Architecture Module: `scripts/stamp-telemetry-key.mjs`
```
/**
 * Bakes the PostHog key into the built `dist/telemetry/key.js` at publish time.
 *
 * This is what makes "forks never send" true by construction rather than by
 * policy. The key exists only in the published tarball: the repository holds an
 * empty string, so a clone, a fork, a CI build, and a contributor's local
 * `npm run build` all produce a graft whose telemetry module short-circuits on
 * the very first check.
 *
 * Runs from `prepublishOnly`, after `npm run build`. Without GRAFT_POSTHOG_KEY
 * in the environment it prints a warning and changes nothing — publishing a
 * telemetry-less build is a valid thing to do, and it must never be a hard
 * failure at the moment someone is trying to ship.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'dist', 'telemetry', 'key.js');

const key = process.env.GRAFT_POSTHOG_KEY ?? '';
const host = process.env.GRAFT_POSTHOG_HOST ?? '';

if (!key) {
  console.warn('⚠ GRAFT_POSTHOG_KEY not set — publishing a build that sends no telemetry.');
  process.exit(0);
}
if (!existsSync(target)) {
  console.warn(`⚠ ${target} not found — did the build run? Skipping the telemetry key stamp.`);
  process.exit(0);
}
// A key with a quote or a newline in it would break the generated literal (and
// is not a PostHog key). Refuse rather than emit something that won't parse.
if (!/^[A-Za-z0-9_-]+$/.test(key)) {
  console.error('✗ GRAFT_POSTHOG_KEY contains characters that are not valid in a project key.');
  process.exit(1);
}
if (host && !/^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(host)) {
  console.error('✗ GRAFT_POSTHOG_HOST must be a plain https origin, e.g. https://eu.i.posthog.com');
  process.exit(1);
}

const src = readFileSync(target, 'utf8');
let out = src.replace(/const BAKED_KEY = ['"][^'"]*['"];/, `const BAKED_KEY = '${key}';`);
if (host) out = out.replace(/const BAKED_HOST = ['"][^'"]*['"];/, `const BAKED_HOST = '${host}';`);

if (out === src) {
  console.error('✗ could not find BAKED_KEY in dist/telemetry/key.js — the stamp target moved.');
  process.exit(1);
}
writeFileSync(target, out);
console.log(`✓ telemetry key stamped into dist/telemetry/key.js${host ? ` (host ${host})` : ''}`);

```

### Core Architecture Module: `scripts/tally-audit.mjs`
```
/**
 * "Saved vs said": how often does the agent actually TELL the user what graft saved?
 *
 *   node scripts/tally-audit.mjs [transcript-dir] [--json]
 *
 * `savedTokens` (src/claude/state.ts) counts what graft *computed* — every
 * `[graft] tokens saved ≈ N` footer the PostToolUse accumulator swept up. This
 * script measures the other half, offline and in full detail: of the turns that
 * used graft, how many closed with the one-line tally SKILL.md asks for, was the
 * number right, and did it name the call count.
 *
 * The shipped metric (`graft_turns_bucket` / `reported_turns_bucket` on
 * `session_summary`) is the same ratio at bucket resolution, which is all that
 * can cross the wire. Run this locally when the aggregate says something
 * surprising and you need to see which turns and why.
 *
 * Reads Claude Code's own transcript JSONL, which defaults to
 * ~/.claude/projects/<slugified-cwd>/. Nothing leaves the machine.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const SAVED_FOOTER = /\[graft\] tokens saved ≈ ([\d,]+)/g;
const TALLY = /graft\s+saved\s*[~≈]?\s*([\d,.]+)\s*(k|m)?\s*(?:tok|tokens)/i;
const CALLS = /(\d+)\s*calls?/i;
/** How far past the tally to look for its call count. The tally is one line
 * ("🌱 graft saved ~12,400 tokens this turn (3 calls)"); scanning the rest of
 * the reply instead would match any unrelated "3 calls" further down and report
 * near-perfect compliance for a field the agent mostly omits. */
const TALLY_WINDOW = 60;
/** Above this, a per-turn "saved" figure is an estimator artifact rather than a
 * saving — a `--depth all` closure or a vendored tree summing whole-file
 * baselines nobody would have read. Reported separately, never averaged in. */
const IMPLAUSIBLE_TOKENS = 1_000_000;

const args = process.argv.slice(2).filter((a) => a !== "--json");
const asJson = process.argv.includes("--json");
const dir = args[0] ?? defaultTranscriptDir();

function defaultTranscriptDir() {
  const slug = process.cwd().replace(/[/.]/g, "-");
  return join(homedir(), ".claude", "projects", slug);
}
function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((p) => (p?.type === "text" ? p.text ?? "" : "")).join("\n");
}
function isUserPrompt(o) {
  if (o.type !== "user" || o.isSidechain || o.isMeta) return false;
  const c = o.message?.content;
  if (typeof c === "string") return true;
  return Array.isArray(c) && !c.some((p) => p?.type === "tool_result");
}
function median(ns) {
  if (!ns.length) return 0;
  const s = [...ns].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

if (!existsSync(dir)) {
  console.error(`no transcripts at ${dir}`);
  process.exit(1);
}

const turns = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonl"))) {
  let turn = null;
  const flush = () => { if (turn?.calls > 0) turns.push(turn); };
  for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.isSidechain) continue;                    // a subagent's prose is not what the user read
    if (isUserPrompt(o)) { flush(); turn = { file, calls: 0, saved: 0, said: null, statedCalls: null }; continue; }
    if (!turn) continue;
    if (o.type === "user") {                        // a tool_result wearing the user role
      for (const m of JSON.stringify(o.message?.content ?? "").matchAll(SAVED_FOOTER)) {
        turn.calls++;
        turn.saved += Number(m[1].replace(/,/g, "")) || 0;
      }
    }
    if (o.type === "assistant") {
      const m = TALLY.exec(textOf(o.message?.content));
      if (m) {
        let n = Number(m[1].replace(/,/g, ""));
        if (m[2]?.toLowerCase() === "k") n *= 1e3;
        if (m[2]?.toLowerCase() === "m") n *= 1e6;
        turn.said = n;
        const c = CALLS.exec(textOf(o.message?.content).slice(m.index, m.index + TALLY_WINDOW));
        turn.statedCalls = c ? Number(c[1]) : null;
      }
    }
  }
  flush();
}

const said = turns.filter((t) => t.said !== null);
const plausible = turns.filter((t) => t.saved < IMPLAUSIBLE_TOKENS);
const outliers = turns.filter((t) => t.saved >= IMPLAUSIBLE_TOKENS);
const fidelity = { exact: 0, over: 0, under: 0 };
for (const t of said.filter((t) => t.saved > 0)) {
  const r = t.said / t.saved;
  if (r >= 0.9 && r <= 1.1) fidelity.exact++;
  else if (r > 1.1) fidelity.over++;
  else fidelity.under++;
}

const report = {
  transcripts: readdirSync(dir).filter((f) => f.endsWith(".jsonl")).length,
  graft_turns: turns.length,
  reported: said.length,
  silent: turns.length - said.length,
  reported_pct: turns.length ? Number(((said.length / turns.length) * 100).toFixed(1)) : 0,
  stated_call_count: said.filter((t) => t.statedCalls !== null).length,
  median_saved_per_turn: median(plausible.map((t) => t.saved)),
  fidelity,
  implausible_turns: outliers.length,
  implausible_max: outliers.length ? Math.max(...outliers.map((t) => t.saved)) : 0,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const { graft_turns: n } = report;
  console.log(`transcripts scanned:      ${report.transcripts}  (${dir})`);
  console.log(`turns that used graft:    ${n}`);
  console.log(`  ...reported a tally:    ${report.reported}  (${report.reported_pct}%)`);
  console.log(`  ...silent:              ${report.silent}`);
  console.log(`  ...named the call count ${report.stated_call_count}/${report.reported}`);
  console.log(`median saved per turn:    ${report.median_saved_per_turn.toLocaleString()} tok`);
  console.log(`reported number vs footer sum (±10%): exact ${fidelity.exact} · over ${fidelity.over} · under ${fidelity.under}`);
  if (outliers.length) {
    console.log(`\n⚠ ${outliers.length} turn(s) claim ≥${IMPLAUSIBLE_TOKENS.toLocaleString()} tokens saved ` +
      `(max ${report.implausible_max.toLocaleString()}) — an estimator artifact, excluded from the median. ` +
      `See savingsFor() in src/context/savings.ts.`);
  }
}

```

### Core Architecture Module: `src/ai/crux.ts`
```
/**
 * Tier-2 "meaning" call for the code graph — batched one request per file.
 *
 * Given a source file (with 1-based line numbers) and the list of definitions in
 * it, one call returns, for each definition:
 *   1. `summary` — one plain-English sentence: what the symbol is *for*, at the
 *      business-logic level, not a restatement of its signature.
 *   2. `crux_start`/`crux_end` — the smallest contiguous range of FILE line
 *      numbers (inside that symbol's own span) that a reviewer must read to see
 *      the decision or rule the code encodes. `0/0` means there is no single
 *      crux (a trivial getter, a plain data holder).
 *
 * Batching per file means N definitions cost one request, not N — and the model
 * sees each symbol's neighbours, which sharpens the summaries. Line numbers are
 * consumed once, at write time, to slice the crux text verbatim from source.
 */
import type { ChatModel, ChatResponse } from "./llm/types.js";
import { recoverToolArgsFromContent, warnToolChoiceIgnored } from "./llm/recover-tool.js";
import type { Kind } from "../graph/types.js";

/** One definition we want described, located by its line span within the file. */
export interface NodeRef {
  id: string;
  kind: Kind;
  signature: string | null;
  startLine: number; // 1-based file line where the definition starts
  endLine: number;
}

export interface FileCruxInput {
  path: string;
  source: string;
  nodes: NodeRef[];
}

export interface NodeCrux {
  id: string;
  summary: string;
  crux_start: number; // file line, within the symbol's span; 0 = no distinct crux
  crux_end: number;
}

export interface CruxSummarizer {
  describeFile(input: FileCruxInput): Promise<NodeCrux[]>;
  /** Set by {@link ChatCruxSummarizer} after each call; optional on fakes. */
  lastMiss?: CruxMiss | null;
}

/** Why a crux call produced no usable summaries (#235). */
export type CruxMissKind = "empty-toolCalls" | "unparseable" | "truncated" | "empty-parsed";

export interface CruxMiss {
  kind: CruxMissKind;
  finishReason: string | null;
}

function isTruncatedStop(reason: string | null): boolean {
  if (!reason) return false;
  const r = reason.toLowerCase();
  return r === "length" || r === "max_tokens";
}

/** Classify an empty/unusable crux reply. `null` means at least one usable summary. */
export function classifyCruxMiss(res: ChatResponse, parsed: NodeCrux[]): CruxMiss | null {
  const finishReason = res.stopReason;
  if (parsed.some((p) => p.summary.trim())) return null;
  if (isTruncatedStop(finishReason)) return { kind: "truncated", finishReason };
  if (parsed.length > 0) return { kind: "empty-parsed", finishReason };
  const emptyTools = res.toolCalls.length === 0;
  const emptyText = !res.text?.trim();
  if (emptyTools && emptyText) return { kind: "empty-toolCalls", finishReason };
  return { kind: "unparseable", finishReason };
}

/** Per-file error text: miss class + the provider's finish_reason (#235). */
export function formatCruxMiss(kind: CruxMissKind, finishReason: string | null): string {
  const fr = finishReason == null || finishReason === "" ? "null" : finishReason;
  return `model returned no usable symbol summaries [${kind}, finish_reason=${fr}]`;
}

const SYSTEM_PROMPT = `You explain code definitions for a code graph that helps engineers navigate a codebase.

You are given ONE source file with 1-based line numbers, and a list of TARGET definitions in it. Describe EVERY target via the record_symbols tool.

Rules:
- Return EXACTLY ONE entry for EVERY target id, using that id verbatim. The number of entries you return MUST equal the number of targets. Never omit a target: a reply missing any id is invalid and will be re-requested.
- A trivial symbol is NOT an exception. You still return it — with a one-sentence summary and crux 0/0 (see below). "Skip" means "give it no crux span", NEVER "leave it out".
- summary: ONE sentence — what the symbol is FOR at the business-logic level (the problem it solves or the rule it enforces), not a restatement of its signature.
- crux_start / crux_end: FILE line numbers (as shown), inside that symbol's own line range. Pick the SINGLE most important contiguous span — the core branch, formula, guard, or state change — at most ~8 lines, and NEVER the whole function. When there is no single focal span (a trivial getter, a plain data holder, a one-line delegation, or logic spread evenly), use crux_start: 0 and crux_end: 0. That 0/0 IS the answer — do not drop the entry.`;

const RECORD_TOOL = "record_symbols";

const SYMBOLS_SCHEMA = {
  type: "object",
  properties: {
    symbols: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          summary: { type: "string" },
          crux_start: { type: "number" },
          crux_end: { type: "number" },
        },
        required: ["id", "summary", "crux_start", "crux_end"],
      },
    },
  },
  required: ["symbols"],
} as const;

/** Cap the file text sent per request so one huge file can't blow the context. */
const MAX_CODE_CHARS = 18_000;

function numberLines(source: string): string {
  const clipped =
    source.length > MAX_CODE_CHARS ? `${source.slice(0, MAX_CODE_CHARS)}\n… (truncated)` : source;
  return clipped
    .split("\n")
    .map((line, i) => `${i + 1}\t${line}`)
    .join("\n");
}

function userContent(input: FileCruxInput): string {
  const targets = input.nodes
    .map(
      (n) =>
        `- id=${n.id} | ${n.kind} | lines L${n.startLine}-L${n.endLine}` +
        (n.signature ? ` | ${n.signature}` : ""),
    )
    .join("\n");
  const n = input.nodes.length;
  return `FILE: ${input.path}\n\n${numberLines(input.source)}\n\nTARGETS (${n} — return all ${n}, one entry per id):\n${targets}`;
}

/** Normalize the tool's parsed argument object into a {@link NodeCrux} list. */
function parseResults(obj: { symbols?: unknown } | undefined): NodeCrux[] {
  if (!obj || !Array.isArray(obj.symbols)) return [];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0);
  return obj.symbols
    .map((s) => s as Record<string, unknown>)
    .filter((s) => typeof s.id === "string")
    .map((s) => ({
      id: s.id as string,
      summary: typeof s.summary === "string" ? s.summary.trim() : "",
      crux_start: num(s.crux_start),
      crux_end: num(s.crux_end),
    }));
}

/**
 * Some OpenAI-compatible gateways ignore forced `tool_choice` and put the tool
 * payload in `content` instead (plain `{symbols:…}`, fenced JSON, or an emulated
 * `[{name, parameters}]` array). Without this recovery the meaning pass sees an
 * empty `toolCalls` list, leaves every node `pending`, and `graft check` loops
 * on "run --deep" forever (#172; same trigger as #129 for the crux path).
 */
function argsFromResponse(res: { text: string; toolCalls: { name: string; args: unknown }[] }): {
  symbols?: unknown;
} | undefined {
  const call = res.toolCalls.find((c) => c.name === RECORD_TOOL) ?? res.toolCalls[0];
  if (call?.args && typeof call.args === "object" && !Array.isArray(call.args)) {
    return call.args as { symbols?: unknown };
  }
  const recovered = recoverToolArgsFromContent(res.text, {
    toolNames: [RECORD_TOOL, "emit_json"],
    payloadKey: "symbols",
  });
  if (!recovered) warnToolChoiceIgnored("crux", res.text?.trim() ? "unparsed" : "empty");
  return recovered as { symbols?: unknown } | undefined;
}

/** Crux summarizer backed by any {@link ChatModel} via forced tool calling. */
export class ChatCruxSummarizer implements CruxSummarizer {
  lastMiss: CruxMiss | null = null;

  constructor(private model: ChatModel) {}

  async describeFile(input: FileCruxInput): Promise<NodeCrux[]> {
    this.lastMiss = null;
    if (input.nodes.length === 0) return [];
    const res = await this.model.create({
      temperature: 0,
      maxTokens: 8192,
      tools: [
        {
          name: RECORD_TOOL,
          description: "Record each target definition's purpose and crux 
```

### Core Architecture Module: `src/ai/failure.ts`
```
/**
 * When to stop calling a provider that is failing (#127).
 *
 * Both LLM passes of `build --deep` — the per-file concept summaries
 * (`context/build.ts`) and the per-file crux pass (`graph/enrich.ts`) — used to
 * catch every error per file, keep going, and finish with a clean exit. On an
 * 884-file repo behind a gateway whose token quota was spent that produced 1,617
 * failed calls, a normal success footer, and a graph whose meaning tier was
 * missing; the degradation surfaced days later as bad `ask` results.
 *
 * One gate, shared by both passes, so they agree on what "the provider stopped
 * working" means and a caller can report it once.
 *
 * Content-quality misses (empty/unusable crux, #235) still count as failed files
 * so they are not cached as success (#177), but they do not increment the
 * consecutive-failure cutoff — the provider is answering, just not usefully for
 * those files. Quota/auth stay immediately terminal (#127).
 */

/** Consecutive failures that end a pass. One flaky file is normal; five in a row is
 * a provider that is not going to start working, and each further call is spend
 * with no chance of a result. */
export const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Errors no amount of retrying fixes: the key is wrong, or the account/quota is
 * spent. Matched on the message because that is all a provider-neutral transport
 * carries — over-matching costs a build that was going to fail anyway, while
 * under-matching just falls back to the consecutive-failure cutoff.
 */
export function terminalReason(message: string): string | null {
  const m = message.toLowerCase();
  if (/quota|insufficient[_ ]funds|insufficient[_ ]quota|billing|payment required|402/.test(m)) {
    return "the provider reports the quota/credit for this key is exhausted";
  }
  if (/\b401\b|\b403\b|unauthorized|invalid api key|invalid_api_key|authentication/.test(m)) {
    return "the provider rejected the API key";
  }
  return null;
}

/**
 * Failure bookkeeping for one LLM pass: how many units failed, how many were
 * skipped once it gave up, and the human-readable reason it did.
 *
 * Single-threaded by construction — every mutation happens between awaits in the
 * pass's own worker — so no locking is needed despite the concurrency above it.
 */
export class LlmFailureGate {
  /** Units (files) whose call failed. */
  failed = 0;
  /** Units never attempted because the pass had already given up. */
  skipped = 0;
  /** Why the pass stopped, when it did. */
  fatal?: string;
  private consecutive = 0;

  /** True once the pass should stop issuing calls. */
  get stopped(): boolean {
    return this.fatal !== undefined;
  }

  /**
   * Record a failed unit; sets {@link fatal} when this failure is the last straw.
   * Pass `{ quality: true }` for a content-quality miss (#235): counted, not fatal,
   * unless the message is quota/auth (those still stop immediately).
   */
  record(message: string, opts?: { quality?: boolean }): void {
    this.failed++;
    const terminal = terminalReason(message);
    if (terminal) {
      this.fatal = `${terminal} — stopped after ${this.failed} failed file(s). First error: ${message}`;
      return;
    }
    if (opts?.quality) return;
    this.consecutive++;
    if (this.consecutive >= MAX_CONSECUTIVE_FAILURES) {
      this.fatal = `${this.consecutive} files in a row failed, so the pass stopped rather than keep calling. Last error: ${message}`;
    }
  }

  /** Record a success — a failure run only counts while it is unbroken. */
  succeeded(): void {
    this.consecutive = 0;
  }

  /** Record a unit that was not attempted because the pass had stopped. */
  skip(): void {
    this.skipped++;
  }
}

```

### Core Architecture Module: `src/ai/llm/anthropic.ts`
```
/**
 * Native Anthropic transport. Wraps `@anthropic-ai/sdk` (the Messages API), so
 * Claude is a first-class provider rather than something tunneled through an
 * OpenAI-compatible endpoint.
 *
 * The Messages API differs from Chat Completions in ways this adapter absorbs so
 * the rest of graft never sees them:
 *   - `system` is a top-level parameter, not a message.
 *   - tool results ride inside a USER turn, and all results answering one
 *     assistant turn must be coalesced into a single user message.
 *   - `max_tokens` is required (callers get a default).
 *   - `temperature` is rejected by current models, so it is never forwarded.
 *   - structured output is a forced tool (there is no `response_format`).
 *   - assistant turns are replayed verbatim (via `providerRaw`) so thinking-block
 *     signatures survive a multi-turn loop.
 */
import Anthropic from "@anthropic-ai/sdk";
import { transportRetries } from "./types.js";
import type { ChatModel, ChatRequest, ChatResponse, Message, ToolCall, ToolSpec, Usage } from "./types.js";

const PROVIDER = "anthropic";
const JSON_TOOL = "emit_json";
const DEFAULT_MAX_TOKENS = 4096;

export interface AnthropicChatModelOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  label?: string;
  /** Inject a pre-built client (tests pass a stub; production omits it). */
  client?: Anthropic;
}

type CacheControl = { cache_control: { type: "ephemeral" } } | Record<string, never>;
const cc = (on: boolean | undefined): CacheControl => (on ? { cache_control: { type: "ephemeral" } } : {});

export class AnthropicChatModel implements ChatModel {
  readonly label: string;
  private client: Anthropic;
  private model: string;

  constructor(opts: AnthropicChatModelOptions) {
    this.model = opts.model;
    this.label = opts.label ?? `${PROVIDER}:${opts.model}`;
    this.client =
      opts.client ??
      new Anthropic({ apiKey: opts.apiKey, baseURL: opts.baseUrl, maxRetries: transportRetries() });
  }

  async create(req: ChatRequest): Promise<ChatResponse> {
    const system: Anthropic.TextBlockParam[] = [];
    const messages: Anthropic.MessageParam[] = [];

    for (const m of req.messages) {
      if (m.role === "system") {
        system.push({ type: "text", text: m.content, ...cc(m.cacheBreakpoint) });
      } else if (m.role === "user") {
        messages.push({ role: "user", content: [{ type: "text", text: m.content, ...cc(m.cacheBreakpoint) }] });
      } else if (m.role === "tool") {
        // Tool results live in a user turn; coalesce consecutive results together.
        const block: Anthropic.ToolResultBlockParam = {
          type: "tool_result",
          tool_use_id: m.toolCallId ?? "",
          content: [{ type: "text", text: m.content }],
          ...cc(m.cacheBreakpoint),
        };
        const last = messages[messages.length - 1];
        if (last?.role === "user" && Array.isArray(last.content)) {
          (last.content as Anthropic.ContentBlockParam[]).push(block);
        } else {
          messages.push({ role: "user", content: [block] });
        }
      } else {
        messages.push(this.assistantParam(m));
      }
    }

    const tools = req.tools?.map(toAnthropicTool);
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages,
      ...(system.length ? { system } : {}),
    };
    // temperature is intentionally NOT forwarded — current models reject it.

    const fmt = req.responseFormat ?? { kind: "text" };
    if (fmt.kind === "json") {
      params.tools = [
        ...(tools ?? []),
        { name: JSON_TOOL, description: "Return the answer as a JSON object.", input_schema: { type: "object" } },
      ];
      params.tool_choice = { type: "tool", name: JSON_TOOL };
    } else if (fmt.kind === "tool") {
      params.tools = tools;
      params.tool_choice = { type: "tool", name: fmt.name };
    } else if (tools) {
      params.tools = tools;
    }

    const resp = await this.client.messages.create(params);
    return this.fromResponse(resp, fmt.kind);
  }

  /** Reconstruct an assistant turn, replaying the original blocks when we made them. */
  private assistantParam(m: Message): Anthropic.MessageParam {
    if (m.providerRaw?.provider === PROVIDER) return m.providerRaw.raw as Anthropic.MessageParam;
    const content: Anthropic.ContentBlockParam[] = [];
    if (m.content) content.push({ type: "text", text: m.content });
    for (const tc of m.toolCalls ?? []) {
      content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.args as Record<string, unknown> });
    }
    return { role: "assistant", content };
  }

  private fromResponse(resp: Anthropic.Messages.Message, format: "text" | "json" | "tool"): ChatResponse {
    let text = "";
    let toolCalls: ToolCall[] = [];
    for (const block of resp.content) {
      if (block.type === "text") text += block.text;
      else if (block.type === "tool_use") toolCalls.push({ id: block.id, name: block.name, args: block.input });
    }

    if (format === "json") {
      const jsonCall = toolCalls.find((c) => c.name === JSON_TOOL);
      if (jsonCall) text = JSON.stringify(jsonCall.args);
      toolCalls = toolCalls.filter((c) => c.name !== JSON_TOOL);
    }

    return {
      text,
      toolCalls,
      usage: normalizeUsage(resp.usage),
      stopReason: resp.stop_reason ?? null,
      // Replay the raw content verbatim so thinking-block signatures survive.
      assistant: {
        role: "assistant",
        content: text,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        providerRaw: { provider: PROVIDER, raw: { role: "assistant", content: resp.content } },
      },
    };
  }
}

function toAnthropicTool(t: ToolSpec): Anthropic.Tool {
  return { name: t.name, description: t.description, input_schema: t.parameters as Anthropic.Tool.InputSchema };
}

/** Anthropic reports uncached input in `input_tokens` and cache tokens separately. */
function normalizeUsage(u: Anthropic.Usage): Usage {
  return {
    input: u.input_tokens ?? 0,
    output: u.output_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheCreate: u.cache_creation_input_tokens ?? 0,
  };
}

```

### Core Architecture Module: `src/ai/llm/factory.ts`
```
/**
 * One place that turns resolved config into a {@link ChatModel}. `provider` names
 * the WIRE FORMAT, not a vendor: `openai` speaks the OpenAI-compatible API (point
 * `baseUrl` at OpenRouter, Fireworks, a LiteLLM proxy, Groq, a local server, …),
 * `anthropic` speaks the native Messages API. Adding a vendor is a base URL, not
 * a code change; adding a wire format is one new adapter here.
 *
 * `litellm` is a convenience over `openai`: same wire format, but pointed at a
 * LiteLLM proxy by default and paired with `/v1/models` auto-discovery
 * (see litellm.ts), so one endpoint reaches 100+ providers.
 *
 * `orcarouter` is the same kind of convenience over `openai`, pointed at the
 * OrcaRouter AI gateway by default (see orcarouter.ts) so its users get the
 * gateway's routing, failover, and guardrails behind a named provider instead
 * of a bare custom base URL.
 */
import type { ChatModel } from "./types.js";
import { OpenAIChatModel } from "./openai.js";
import { AnthropicChatModel } from "./anthropic.js";
import { LiteLLMChatModel } from "./litellm.js";
import { OrcaRouterChatModel } from "./orcarouter.js";

export type ProviderKind = "openai" | "anthropic" | "litellm" | "orcarouter";

export interface ChatModelConfig {
  provider: ProviderKind;
  apiKey: string;
  model: string;
  baseUrl?: string;
  /** Extra default headers for OpenAI-compatible endpoints (e.g. OpenRouter `X-Title`). */
  headers?: Record<string, string>;
}

export function createChatModel(cfg: ChatModelConfig): ChatModel {
  switch (cfg.provider) {
    case "anthropic":
      return new AnthropicChatModel({ apiKey: cfg.apiKey, model: cfg.model, baseUrl: cfg.baseUrl });
    case "openai":
      return new OpenAIChatModel({
        apiKey: cfg.apiKey,
        model: cfg.model,
        baseUrl: cfg.baseUrl,
        headers: cfg.headers,
      });
    case "litellm":
      return new LiteLLMChatModel({
        apiKey: cfg.apiKey,
        model: cfg.model,
        baseUrl: cfg.baseUrl,
        headers: cfg.headers,
      });
    case "orcarouter":
      return new OrcaRouterChatModel({
        apiKey: cfg.apiKey,
        model: cfg.model,
        baseUrl: cfg.baseUrl,
        headers: cfg.headers,
      });
    default: {
      const _exhaustive: never = cfg.provider;
      throw new Error(`unknown provider: ${String(_exhaustive)}`);
    }
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #507** (2026-09-29): **feat(trail): show how many changes were suggested in graft trail pull**
  *Symptoms*: Moves: `trail_pulled` with `outcome = written` (PostHog DB 11, `posthog_event_full_view`), last 7 days: **0** on 2026-09-29. So far the only events are 2 `dry_run` and 1 `nothing_accepted`, all from one internal tester.  An agent watching a trail can now say "suggestions are waiting for you" before anything is accepted. Before this, `graft trail pull` only reported accepted changes, so a pull done mid-review looked the same as a trail with nothing in it.  - `graft trail pull` (dry run or not) now prints `● 21 suggested so far for the files claude read, 2 of them accepted`, followed by the review link. The count is cut to the files the wired agents read. It covers every suggestion Trail has made, including dismissed ones, because the public API has no per-status counts yet. Getting an exact "waiting for review" count needs a change in Trail. - Fix: when the watcher polls `GET /repo`, it no longer drops the context-file counts. In that response `context_files` is the `true` flag, and the counts are in `context_files_progress`. - `trail_pulled` gets `suggested_bucket`, so pulls where suggestions were waiting and none were accepted can be told apart. - `suggestionsLine` moves from `cli.ts` to `brain/pull.ts`, so push and pull share it.  Checked with a dry run against a real trail: it printed the new line and wrote nothing. `npm test`: 1326 pass, 1 skipped.  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > <!-- graft-blast-radius --> ### 🌱 graft blast radius  **3 areas changed → 3 areas can be affected.** 10 dependent symbols, depth 2. Tests: 1 area updated its tests. Tag: @shhdwi — 3 of 6 areas · @afeddersen — Telemetry Events  ```mermaid flowchart TB   A0(("Session State UI<br/>7 symbols"))   A1(("Telemetry Events<br/>2 symbols"))   A2(("MCP Tools<br/>1 symbol"))   classDef reached fill:#D9EDF3,stroke:#3AA7C9,stroke-width:1.5px,color:#0E313C;   class A0,A1,A2 reached; ```  | Can be affected | Symbols | Nearest hop | Reached from | | --- | --: | --- | --- | | Session State UI | 7 | `src/claude/session-metrics.ts:L1-L212` session-metrics.ts — imports, depth 1 | Telemetry Contract | | Telemetry Events | 2 | `src/telemetry/sessions.ts:L1-L113` sessions.ts — imports, depth 1 | Telemetry Contract | | MCP Tools | 1 | `src/mcp/tools.ts:L1-L330` tools.ts — imports, depth 2 | Telemetry Contract |  <details> <summary><strong>Who knows this code</strong> — 2 people across 6 areas</summary>  | Are

- **Issue #501** (2026-09-29): **feat: record machine-local Graft usage stats**
  *Symptoms*: ## Summary - Record Graft CLI and MCP invocations in a machine-local SQLite store, including exact invocation ID, time, command/surface, repository, available session ID, result, duration, and estimated tokens saved. - Correlate native harness tool-result observations to invocation IDs for truthful querying-model/effort attribution. Missing or unproven metadata remains `unknown`; no machine-global model defaults are imposed. - Record graph build attempts and bounded phase timings with indexed source file/byte counts, parsed/reused counts, graph size, outcome, and trigger. Report recent trends through `graft stats --machine` / `--json` / `--since`. - Use versioned Umzug SQLite migrations so existing local stores upgrade in place. Add fail-open native attribution adapters for Codex, Claude, Cursor, Gemini, and OpenCode, plus lifecycle/init/retract coverage.  ## Privacy and scope Stats remain on the local machine; this PR does not upload the database. Token savings are an estimated avoided-reading counterfactual, not measured API billing savings. Per-tool model/effort attribution depends on the harness exposing suitable native metadata.  ## Verification - `npm run build` - `node --import tsx --test test/hosts-init.test.ts test/stats-store.test.ts test/stats-cli.test.ts test/graph-build-stats.test.ts test/hosts-agent-hook.test.ts test/hosts-attribution-lifecycle.test.ts test/hosts-gemini-attribution.test.ts test/hosts-opencode-attribution.test.ts test/cli-invocation-id.test.ts` (
  **Post-Mortem & Fix Analysis**:
  > <!-- graft-blast-radius --> ### 🌱 graft blast radius  **5 areas changed → 8 areas can be affected.** 16 dependent symbols, depth 2. Tests: Chat Model Factory has tests the diff did not touch; 4 areas updated their tests. Tag: @anirudhkumar-nanonets — 11 of 13 areas · @shhdwi — 6 of 13 areas · @afeddersen — IDE Global Hooks  ```mermaid flowchart TB   A0(("Workspace Graph Analysis<br/>4 symbols"))   A1(("IDE Global Hooks<br/>3 symbols"))   A2(("LLM Provider Routing<br/>2 symbols"))   A3(("Blast Report Naming<br/>2 symbols"))   A4(("PR Review Engine<br/>2 symbols"))   AX(("3 smaller areas<br/>3 symbols"))   classDef reached fill:#D9EDF3,stroke:#3AA7C9,stroke-width:1.5px,color:#0E313C;   class A0,A1,A2,A3,A4 reached;   classDef tail fill:#EEF2F3,stroke:#9AA4A9,stroke-width:1px,color:#3A4247;   class AX tail; ```  | Can be affected | Symbols | Nearest hop | Reached from | | --- | --: | --- | --- | | Workspace Graph Analysis | 4 | `src/graph/map.ts:L325-L350` formatRepoMap — calls, depth 2 
  > Thanks for the substantial work here! This is a 52-file change without a linked issue that combines a SQLite stats store, five host-attribution adapters and CLI changes, raises `engines.node` from `>=20` to `>=22.5.0` while CI still tests Node 20, and commits a repo-root `.mcp.json` plus edits to the repo's own `.claude/helpers`. That's too much to review as one unit, so closing it. Please open an issue to discuss the design, then send focused PRs (e.g. the stats store first) that keep the Node 20 floor.

- **Issue #496** (2026-09-28): **feat(telemetry): trail_pulled event for graft trail pull**
  *Symptoms*: Adds a `trail_pulled` event, sent when `graft trail pull` (or `graft claude-md pull`) finishes, so we can count how many people actually take Trail's context-file suggestions home.  Properties, all closed sets or buckets: - `outcome`: `written` / `already_present` / `nothing_accepted` / `skipped` / `error` / `dry_run` - `kinds`: the context-file kinds written, sorted (`claude_md`, `folder_claude_md`, `agents_md`, `cursor_rule`, `skill`) - `files_bucket`, `changes_bucket`, `skipped_bucket` (the existing `countBucket` labels)  No paths, headings or change text. Documented in TELEMETRY.md and pinned in the contract test, as the contract requires. Rides the existing on-disk queue and daily flush, so it reaches PostHog up to a day after the pull.
  **Post-Mortem & Fix Analysis**:
  > <!-- graft-blast-radius --> ### 🌱 graft blast radius  **2 areas changed → 1 area can be affected.** 2 dependent symbols, depth 2. Tests: Trail Pull Logic has tests the diff did not touch. Tag: @shhdwi — CLI Trail Pull  ```mermaid flowchart TB   A0(("CLI Trail Pull<br/>2 symbols"))   classDef reached fill:#D9EDF3,stroke:#3AA7C9,stroke-width:1.5px,color:#0E313C;   class A0 reached; ```  | Can be affected | Symbols | Nearest hop | Reached from | | --- | --: | --- | --- | | CLI Trail Pull | 2 | `src/cli.ts:L1559-L1571` runTrailPullCommand — calls, depth 1 | Trail Pull Logic |  <details> <summary><strong>Who knows this code</strong> — 1 person across 3 areas</summary>  | Area | Who knows it | | --- | --- | | **CLI Trail Pull** · affected | @shhdwi — 23 commits, last 2mo ago | | **Trail Pull Logic** · changed | _only you — nobody else has touched these files_ | | **Trail Pull Telemetry** · changed | _only you — nobody else has touched these files_ |  _Ownership is git history over each area

- **Issue #495** (2026-09-28): **feat(trail): finish the sign-up when a coding agent runs graft trail push**
  *Symptoms*: When a coding agent (Claude Code, Cursor, CI) runs `graft trail push` on a repo with no trail, the user can now finish signing up, and the push carries on without them having to paste anything.  **Moves:** the share of agent-run sign-ups that end linked. This is `brain_signup_settled` with `mode=agent` and `outcome=linked`, divided by `brain_signup_opened` with `mode=agent`. Before this change it was 0 by construction: without a terminal, the old code printed a link, exited, and always settled as `no_tty`.  ## Why  The CLI shows the link and then waits on a loopback listener. An agent shows the user nothing until the command exits, so the listener was gone before they finished signing up. They ended up on an empty localhost page, and nothing got linked.  ## What changes  - With no terminal, `graft trail push` now runs in two short steps.   - **First run:** opens the sign-up page with a link that has no `graft_port`, saves the state in `.graft/config.json` (git-ignored), and exits at once. Its output tells the agent to ask the user to sign up in that tab and then run the command again straight away.   - **Next run:** asks Trail `POST /api/public/graft-handoffs/claim` with the state every 2 s, for up to 90 s, which stays under an agent's default 2-minute command timeout. It returns 200 with a token (graft then links and the push continues), 202 while not yet (graft says to run it again), 410 when used or expired, or 404 on an older Trail ("not supported yet"). - The saved state
  **Post-Mortem & Fix Analysis**:
  > <!-- graft-blast-radius --> ### 🌱 graft blast radius  **4 areas changed → 3 areas can be affected.** 10 dependent symbols, depth 2. Tests: **no test reaches CLI Entrypoint**; 1 area updated its tests. Tag: @shhdwi — 3 of 7 areas · @tpoignonec — Build Configuration · @bhavesh-gupta-investis — Build Configuration  ```mermaid flowchart TB   A0(("Session State Management<br/>7 symbols"))   A1(("Telemetry Tracking<br/>2 symbols"))   A2(("MCP Tools<br/>1 symbol"))   classDef reached fill:#D9EDF3,stroke:#3AA7C9,stroke-width:1.5px,color:#0E313C;   class A0,A1,A2 reached; ```  | Can be affected | Symbols | Nearest hop | Reached from | | --- | --: | --- | --- | | Session State Management | 7 | `src/claude/session-metrics.ts:L1-L212` session-metrics.ts — imports, depth 1 | Telemetry Contract | | Telemetry Tracking | 2 | `src/telemetry/sessions.ts:L1-L113` sessions.ts — imports, depth 1 | Telemetry Contract | | MCP Tools | 1 | `src/mcp/tools.ts:L1-L330` tools.ts — imports, depth 2 | Telemetry Con

- **Issue #494** (2026-09-28): **feat(trail): send the picked agents with the push**
  *Symptoms*: Sends the agents this repo is wired for (`graft init` stamp plus what is on disk, the same set `graft trail pull` filters by) as `agents` on both the early and the full upload, so Trail shows only the context-file pages those agents read. Omitted when the repo is not wired yet; older Trail servers ignore the field.  Also points the printed review link at Trail's Context files overview (`/brain/<id>/context-files`) instead of the CLAUDE.md page. That page ships in NanoNets/assign#2957, so don't publish this to npm before that reaches production.
  **Post-Mortem & Fix Analysis**:
  > <!-- graft-blast-radius --> ### 🌱 graft blast radius  **2 areas changed → 3 areas can be affected.** 8 dependent symbols, depth 2. Tests: 2 areas updated their tests. Tag: @shhdwi — CLI  ```mermaid flowchart TB   A0(("Brain Build<br/>4 symbols"))   A1(("CLI<br/>3 symbols"))   A2(("Trail Pull<br/>1 symbol"))   classDef reached fill:#D9EDF3,stroke:#3AA7C9,stroke-width:1.5px,color:#0E313C;   class A0,A1,A2 reached; ```  | Can be affected | Symbols | Nearest hop | Reached from | | --- | --: | --- | --- | | Brain Build | 4 | `src/app/brain-build.ts:L251-L358` readRepository — calls, depth 1 | Repository Digest | | CLI | 3 | `src/cli.ts:L1-L1819` cli.ts — calls, depth 1 | Repository Digest, pickedAgents | | Trail Pull | 1 | `src/brain/pull.ts:L65-L165` runTrailPull — calls, depth 1 | pickedAgents |  <details> <summary><strong>Who knows this code</strong> — 1 person across 5 areas</summary>  | Area | Who knows it | | --- | --- | | **CLI** · affected | @shhdwi — 23 commits, last 2mo ago | | *

- **Issue #493** (2026-09-28): **feat(trail): chunked upload, live watch and pull for all context files**
  *Symptoms*: Cuts the time from `graft trail push` to first results in Trail, and makes `graft trail pull` write accepted changes for every context file.  **Push** - The early upload (instruction files, 30 newest PRs, 80 commits) starts right after the repo check, in the background. It reads 80 commits, not 1,000, and runs while the picker and graph build happen. - The early and full reads share one GitHub request cache, including requests still in flight and PRs with no discussion. PR threads are read by a pool of 24 instead of batches of 8. - `sources` now also carries folder `CLAUDE.md` / `AGENTS.md` files (depth up to 4, git-ignored and generated dirs skipped, max 30) and `.claude/skills/*/SKILL.md` (graft's own skill left out, max 30). All are `agent_instructions`, with graft blocks stripped. - The full digest goes up as a gzip in 1 MiB chunks, 4 at a time. Each chunk is retried 4 times with backoff (0.5/1/2/4 s) on network errors, 5xx and 429; `complete` is retried the same way. - The build is followed over `GET /events` (SSE), with up to 3 reconnects before falling back to polling. - Fixed: the poll sleep timer was unref'd, so an idle watch could let the process exit after its first poll without printing an ending.  **Falls back on older servers.** Every new behaviour is gated on a flag from `GET /repo` that defaults to off: - `gzip_upload` gzips the single POST and the early upload. - `chunked_upload` turns on the chunked route. If opening the upload session fails (404, or a non-4
  **Post-Mortem & Fix Analysis**:
  > <!-- graft-blast-radius --> ### 🌱 graft blast radius  **5 areas changed → 4 areas can be affected.** 15 dependent symbols, depth 2. Tests: **no test reaches Spinner**; 3 areas updated their tests. Tag: @shhdwi — 3 of 9 areas · @afeddersen — Telemetry Tracking  ```mermaid flowchart TB   A0(("Session State Management<br/>7 symbols"))   A1(("Brain Build<br/>5 symbols"))   A2(("Telemetry Tracking<br/>2 symbols"))   A3(("MCP Tools<br/>1 symbol"))   classDef reached fill:#D9EDF3,stroke:#3AA7C9,stroke-width:1.5px,color:#0E313C;   class A0,A1,A2,A3 reached; ```  | Can be affected | Symbols | Nearest hop | Reached from | | --- | --: | --- | --- | | Session State Management | 7 | `src/claude/session-metrics.ts:L1-L212` session-metrics.ts — imports, depth 1 | Telemetry Contract | | Brain Build | 5 | `src/app/brain-build-worker.ts:L51-L62` send — calls, depth 1 | History And Sources, Brain Sync | | Telemetry Tracking | 2 | `src/telemetry/sessions.ts:L1-L113` sessions.ts — imports, depth 1 | Telem

- **Issue #488** (2026-09-30): **chore(package): point repository metadata at trailhq/Graft**
  *Symptoms*: ## What this does  Updates the npm package metadata to use the repository's canonical `trailhq/Graft` location instead of the former `NanoNets/context-graph-engine` URLs.  ## What changes  - Point `repository.url` at `https://github.com/trailhq/Graft.git`. - Point `homepage` at the current repository README. - Point `bugs.url` at the current issue tracker.  The old URLs currently redirect, but publishing the canonical values keeps npm and downstream tooling from exposing the former repository name.  ## Testing  - `npm pkg get repository homepage bugs` - `git diff --check origin/main...HEAD`  No runtime code changes. 
  **Post-Mortem & Fix Analysis**:
  > <!-- graft-blast-radius --> ### 🌱 graft blast radius  **Nothing outside this diff depends on it.** 0 areas changed; no indexed dependents at depth 2.   ⚠️ 1 changed file not in the graph (package.json) — no parser claims the extension, or the index predates the file.  <sub>`graft blast` · origin/main...HEAD · depth 2 · 1 changed file</sub>  [**Open the interactive graph →**](https://trailhq.github.io/Graft/pr/488/) — click an area to see its dependent symbols at file:line. 

- **Issue #486** (2026-09-29): **deep: lone file targets fail permanently — model echoes whole target line as id, misreported as [empty-parsed, finish_reason=null]**
  *Symptoms*: ## Summary  `graft build --deep` permanently fails on files where **only the file-level node** is pending (all symbol summaries already cached). The reported error is misleading:  ``` ✗ VDF.Core/FileEntry.cs: model returned no usable symbol summaries [empty-parsed, finish_reason=null] ```  I captured the actual HTTP traffic with a logging proxy: the model returns a **perfectly good** `record_symbols` call every time. The real failure is an **id mismatch**, and the `[empty-parsed, null]` label is a fallback, not the actual miss (`cruxMissMessage(lastMiss=null, "empty-parsed")` in `graph/enrich.js`).  ## Repro  Any repo state where a file's symbols are `ready` but its file node is `pending`, e.g. after the symbols were summarized in an earlier run. Then:  ``` graft build --deep ```  graft sends a single-target request:  ``` TARGETS (1 — return all 1, one entry per id): - id=VDF.Core/FileEntry.cs | file | lines L1-L202 ```  The model (deterministic, temperature 0) echoes the **whole target line** as the id:  ```json {"symbols": [{"id": "VDF.Core/FileEntry.cs | file | lines L1-L202",   "summary": "This file defines the FileEntry class, which encapsulates metadata ...",   "crux_start": 27, "crux_end": 200}]} ```  `collectFileCrux` keys results by the echoed id, so `missing` never resolves (2 identical attempts). Back in the enrich loop `results.get(node.id)` misses, `applied === 0`, and the fallback label is emitted. The file can never complete, on any model.  ## Observed on (all 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detail! This is the same echoed-target-line id mismatch as #259 (whose comments already cover the file-level target variant). The fix is in open PR #492. Closing as a duplicate of #259.

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

### Incident Patch 1: `352f0af9` (2026-09-17)
**Commit Message**: fix(brain): land the finished push in Trail instead of a local page (#417)

* fix(brain): land the finished push in Trail instead of a local page

* test(claude): isolate the shim resolve tests from the machine's own graft install

**File**: `src/brain/signup.ts` (modified, +24/-3)
```diff
@@ -111,8 +111,11 @@ export async function startHandoff(): Promise<Handoff> {
       return;
     }
 
-    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
-    res.end(donePage(true));
+    // 303 so the browser issues a plain GET, and Location built from
+    // GRAFT_BRAIN_URL rather than anything the query carried — the same reason
+    // the Trail side builds its callback rather than being told one.
+    res.writeHead(303, { location: brainUrl(brainId), "cache-control": "no-store" });
+    res.end();
     // No `baseUrl` stored, matching `connect`: GRAFT_BRAIN_URL is read again on
     // every use, so persisting it here would only freeze a host that the env
     // var is already free to move.
@@ -159,9 +162,27 @@ export async function startHandoff(): Promise<Handoff> {
   };
 }
 
+/** The Trail front end this machine is pointed at, without a trailing slash.
+ *
+ * Read at the moment it is needed rather than captured once, matching the rest
+ * of the brain code: GRAFT_BRAIN_URL is free to move between calls. */
+export function webBaseUrl(baseUrl?: string): string {
+  return (process.env.GRAFT_BRAIN_URL || baseUrl || DEFAULT_WEB_BASE_URL).replace(/\/+$/, "");
+}
+
+/** Where the browser is sent once the handoff has been accepted.
+ *
+ * Back into Trail, at the brain it just made. The alternative — leaving the
+ * person on a local page that says "go back to your terminal" — ends the flow
+ * on a blank throwaway served by a port that is about to close, at exactly the
+ * moment the brain starts being mined and there is something to watch. */
+export function brainUrl(brainId: string, baseUrl?: string): string {
+  return `${webBaseUrl(baseUrl)}/brain/${encodeURIComponent(brainId)}`;
+}
+
 /** Where to send the browser for a repo's brain. */
 export function signupUrl(opts: { repo: string; port: number; state: string; baseUrl?: string }): string {
-  const base = (process.env.GRAFT_BRAIN_URL || opts.baseUrl || DEFAULT_WEB_BASE_URL).replace(/\/+$/, "");
+  const base = webBaseUrl(opts.baseUrl);
   const q = new URLSearchParams({
     step: "repo",
     graft_repo: opts.repo,
```

**File**: `test/brain-signup.test.ts` (modified, +21/-0)
```diff
@@ -90,3 +90,24 @@ test("signup url: GRAFT_BRAIN_URL points signup at staging too", () => {
     else process.env.GRAFT_BRAIN_URL = before;
   }
 });
+
+// The browser's last stop is Trail, not a local page that is about to stop
+// answering. Ending on "go back to your terminal" wasted the one moment the
+// brain is actually being built and there is something on screen worth seeing.
+test('the accepted handoff sends the browser back into Trail, at its new brain', async () => {
+  process.env.GRAFT_BRAIN_URL = 'http://localhost:5173';
+  const handoff = await startHandoff();
+  try {
+    const res = await fetch(
+      `http://127.0.0.1:${handoff.port}${CALLBACK_PATH}?state=${encodeURIComponent(handoff.state)}&brain=abc-123&token=gbt_1.xyz`,
+      { redirect: 'manual' },
+    );
+    assert.equal(res.status, 303);
+    assert.equal(res.headers.get('location'), 'http://localhost:5173/brain/abc-123');
+    const got = await handoff.wait(1000);
+    assert.deepEqual(got, { link: { brainId: 'abc-123', token: 'gbt_1.xyz' } });
+  } finally {
+    handoff.close();
+    delete process.env.GRAFT_BRAIN_URL;
+  }
+});
```

**File**: `test/claude-shim-resolve.test.ts` (modified, +50/-2)
```diff
@@ -31,15 +31,51 @@ function fakeInstall(root: string, name: string, version: string): string {
   return distClaude;
 }
 
+/**
+ * Cuts the two candidates this fixture does not control out of the child.
+ *
+ * The shim probes four places, and only the first two — the baked dir and the
+ * project's `node_modules` — are ones a test builds. The other two find
+ * whatever `@nanonets/graft` is installed on the machine running the suite:
+ *
+ *   - `<execDir>/../lib` is the nvm layout, so on any developer box with a
+ *     global graft it resolves to the real package. That install is newer than
+ *     the fixtures, so `best()` correctly preferred it, loaded the real
+ *     `hooks.js` — which writes no marker — and every assertion here read back
+ *     `null`. Green on CI, red on a laptop, for a reason that had nothing to do
+ *     with the behaviour under test.
+ *   - `npm root -g` is the same leak by another route, reached when the cheap
+ *     candidates all miss.
+ *
+ * `process.execPath` is repointed through a `--require` preload rather than by
+ * symlinking a real node: `/proc/self/exe` resolves symlinks on Linux, so the
+ * filesystem trick would isolate macOS and quietly do nothing on the CI leg
+ * that matters. `npm_config_prefix` is what `npm root -g` answers from, so
+ * pointing it at an empty fixture dir leaves npm working and finding nothing —
+ * safer than emptying `PATH`, which on Windows also hides the `cmd.exe` that
+ * `shell: true` needs.
+ *
+ * Same intent as `homeEnv`: the child sees the fixture, never the runner.
+ */
+function isolate(root: string): { preload: string; env: NodeJS.ProcessEnv } {
+  const preload = join(root, 'no-ambient-graft.cjs');
+  const execPath = join(root, 'node-prefix', 'bin', 'node');
+  writeFileSync(preload, `Object.defineProperty(process, 'execPath', { value: ${JSON.stringify(execPath)}, configurable: true });\n`);
+  const prefix = join(root, 'npm-prefix');
+  mkdirSync(prefix, { recursive: true });
+  return { preload, env: { npm_config_prefix: prefix } };
+}
+
 /** Runs the shim with the given baked dir and project dir; returns the version
  * of the install that actually got loaded (or null if none did). */
 function runShim(root: string, bakedDir: string, projectDir: string): string | null {
   const shimPath = join(root, 'graft-hooks.cjs');
   const marker = join(root, 'loaded.txt');
   writeFileSync(shimPath, hooksShim(bakedDir));
-  const res = spawnSync(process.execPath, [shimPath, 'session-start'], {
+  const { preload, env } = isolate(root);
+  const res = spawnSync(process.execPath, ['--require', preload, shimPath, 'session-start'], {
     encoding: 'utf8',
-    env: { ...process.env, MARKER: marker, CLAUDE_PROJECT_DIR: projectDir },
+    env: { ...process.env, ...env, MARKER: marker, CLAUDE_PROJECT_DIR: projectDir },
   });
   assert.equal(res.status, 0, `shim exited ${res.status}: ${res.stderr}`);
   return existsSync(marker) ? readFileSync(marker, 'utf8') : null;
@@ -81,3 +117,15 @@ test('no candidate at all exits quietly — a hook must never fail the session',
   mkdirSync(join(root, 'project'), { recursive: true });
   assert.equal(runShim(root, join(root, 'nowhere'), join(root, 'project')), null);
 });
+
+// Guards the isolation itself. `isolate` repoints the exec dir at the fixture
+// rather than disabling that probe, so the nvm-layout candidate must still be
+// live — just rooted somewhere the test built. Without this, someone deleting
+// the preload would see every assertion above still pass on CI (which has no
+// global graft) and the laptop-only failure would come straight back.
+test('the exec-dir probe reads the fixture prefix, not the machine install', () => {
+  const root = tmpRepo('shim-execdir');
+  fakeInstall(join(root, 'node-prefix', 'lib', 'node_modules', '@nanonets'), 'graft', '99.0.0');
+  fakeInstall(join(root, 'project', 'node_modules', '@nanonets'), 'graft', '0.9.1');
+  assert.equal(runShim(root, join(root, 'nowhere'), join
```

---

### Incident Patch 2: `1e352a3f` (2026-09-16)
**Commit Message**: fix(brain): send signup to Trail's own front end, not the shared agents host

**File**: `src/brain/signup.ts` (modified, +7/-2)
```diff
@@ -25,8 +25,13 @@ import { randomBytes, timingSafeEqual } from "node:crypto";
 import type { AddressInfo } from "node:net";
 import type { BrainLink } from "./link.js";
 
-/** Default web host. Overridden by GRAFT_BRAIN_URL, for staging and self-hosted. */
-const DEFAULT_WEB_BASE_URL = "https://agents.nanonets.com";
+/** Default web host. Overridden by GRAFT_BRAIN_URL, for staging and self-hosted.
+ *
+ * Trail's own front end, not the shared `agents.nanonets.com` one that `link.ts`
+ * calls for the API. Both are served by the same backend, so either would mint a
+ * working token — but this URL is the one a person looks at, and it has to be
+ * the Trail-branded build, with Trail's Auth0 redirect behind the signup. */
+const DEFAULT_WEB_BASE_URL = "https://app.trailhq.com";
 
 /** How long the listener waits for the browser before giving up. A signup can
  * involve reading an email, so this is minutes rather than seconds. */
```

**File**: `test/brain-signup.test.ts` (modified, +3/-1)
```diff
@@ -69,7 +69,9 @@ test("handoff: the wait gives up rather than hanging forever", async () => {
 
 test("signup url: carries the repo, the port and the state", () => {
   const url = new URL(signupUrl({ repo: "NanoNets/Graft", port: 51234, state: "s-t-a-t-e" }));
-  assert.equal(url.origin, "https://agents.nanonets.com");
+  // Trail's front end, not the shared agents host link.ts calls for the API:
+  // the signup a person walks through has to be the Trail-branded build.
+  assert.equal(url.origin, "https://app.trailhq.com");
   assert.equal(url.pathname, "/get-started");
   assert.equal(url.searchParams.get("graft_repo"), "NanoNets/Graft");
   assert.equal(url.searchParams.get("graft_port"), "51234");
```

---

### Incident Patch 3: `f9e65396` (2026-09-10)
**Commit Message**: fix(brain): let the digest finish sending before the child disconnects

**File**: `src/app/brain-build-worker.ts` (modified, +19/-9)
```diff
@@ -38,12 +38,26 @@ export interface FailedMessage {
 
 export type FromChild = LogMessage | DoneMessage | FailedMessage;
 
-function send(msg: FromChild): void {
-  if (!process.send) return;
+/**
+ * Send, and tell me when it has actually gone.
+ *
+ * `process.send` is asynchronous, and a digest of a large repository is several
+ * megabytes — a thousand commits, four thousand symbols. Disconnecting on the
+ * next line tears the channel down mid-write: the child exits 0, having done
+ * every bit of the work, and the parent reports "exited before reporting a
+ * result". It only shows on big repositories, because a small payload clears
+ * the pipe in one write and survives the race.
+ */
+function send(msg: FromChild, done?: () => void): void {
+  if (!process.send) {
+    done?.();
+    return;
+  }
   try {
-    process.send(msg);
+    process.send(msg, undefined, undefined, () => done?.());
   } catch {
     /* parent went away; the exit is the report */
+    done?.();
   }
 }
 
@@ -60,13 +74,9 @@ process.on("message", (raw) => {
     log: (line: string) => send({ t: "log", msg: line }),
   }, msg.auth)
     .then((result) => {
-      send({ t: "done", result });
-      // The digest can be several megabytes and the channel is asynchronous, so
-      // let the write drain rather than exiting out from under it.
-      process.disconnect?.();
+      send({ t: "done", result }, () => process.disconnect?.());
     })
     .catch((e: unknown) => {
-      send({ t: "failed", message: e instanceof Error ? e.message : String(e) });
-      process.disconnect?.();
+      send({ t: "failed", message: e instanceof Error ? e.message : String(e) }, () => process.disconnect?.());
     });
 });
```

---

### Incident Patch 4: `270edccc` (2026-09-10)
**Commit Message**: fix(brain): read a repository in a child process so the app keeps answering

**File**: `src/app/brain-build-process.ts` (added, +151/-0)
```diff
@@ -0,0 +1,151 @@
+/**
+ * Running a repository read somewhere it cannot stop the App answering.
+ *
+ * The same problem the reviewer had, and the same fix — see review-process.ts
+ * for the full reasoning and the production measurements behind it. In short:
+ * every expensive step of a read is synchronous (git through `spawnSync`, the
+ * parse a loop of native tree-sitter calls, the graph written with a blocking
+ * stringify), so in-process one read holds the event loop for its whole
+ * duration.
+ *
+ * Onboarding made that visible in a way reviews did not. Measured on
+ * NanoNets/assign: 0.7s to check access, 7s to clone, 81s to build the symbol
+ * graph, 21s to walk the pull requests. During those 81 seconds the App
+ * answered nothing at all — including the one-second question "can we see this
+ * other repository", asked by the next person to paste a URL, who then waited
+ * out someone else's clone before being told their repo is private. At a
+ * hundred signups there is nearly always a read in flight, so that is not an
+ * edge case, it is the normal case.
+ *
+ * The split is where the credential is: the parent resolves access and mints
+ * the token (network, never blocking), and the child does the work with it.
+ */
+import { fork, type ChildProcess } from "node:child_process";
+import { existsSync } from "node:fs";
+import { fileURLToPath } from "node:url";
+import { resolveRepoRead, type BrainBuildDeps, type BrainBuildJob, type BrainBuildResult } from "./brain-build.js";
+import type { FromChild, StartMessage } from "./brain-build-worker.js";
+
+/**
+ * How long one read may take before the process running it is killed.
+ *
+ * Well above the worst honest read seen (110s on a large monorepo) plus the
+ * clone budget checkout.ts allows itself, because the cost of being wrong is a
+ * read that never happens. It bounds a lost slot, not responsiveness — the
+ * server stopped caring how long a read takes the moment it left this process.
+ */
+const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
+
+export interface ChildBuilderOptions {
+  /** The module the child runs. Only tests pass this. */
+  entry?: string;
+  timeoutMs?: number;
+}
+
+/**
+ * The module a read runs in. `dist/app/brain-build-worker.js` when installed or
+ * containerised; the TypeScript source next door when run from a checkout,
+ * since `fork` inherits `process.execArgv` and a parent started through tsx
+ * hands the child the same loader.
+ */
+export function brainBuildWorkerEntry(): string {
+  const js = fileURLToPath(new URL("./brain-build-worker.js", import.meta.url));
+  if (existsSync(js)) return js;
+  const ts = js.replace(/\.js$/, ".ts");
+  return existsSync(ts) ? ts : js;
+}
+
+/** Reads in flight, so a shutdown does not leave a clone made with a token. */
+const live = new Set<ChildProcess>();
+let hooked = false;
+
+function track(child: ChildProcess): void {
+  live.add(child);
+  if (hooked) return;
+  hooked = true;
+  process.on("exit", () => {
+    for (const c of live) c.kill("SIGKILL");
+  });
+}
+
+/**
+ * A builder with buildRepoIntoBrain's signature that runs the heavy half in a
+ * child process. Same shape on purpose: server.ts swaps one for the other in a
+ * single line, and a test injecting its own builder keeps running in-process.
+ */
+export function childBuilder(opts: ChildBuilderOptions = {}): (job: BrainBuildJob, deps: BrainBuildDeps) => Promise<BrainBuildResult> {
+  const entry = opts.entry ?? brainBuildWorkerEntry();
+  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
+  return async (job, deps) => {
+    // In the parent, deliberately: it is pure network, it is what decides
+    // whether there is anything to fork for, and a RepoNotAccessibleError has
+    // to reach the caller as itself rather than as a dead child process.
+    const auth = await resolveRepoRead(job, deps);
+    return runInChild(job, deps, auth, entry, timeoutMs);
+  };
+}
+
+async function runInChild(
+  job: BrainBuildJob,

```

**File**: `src/app/brain-build-worker.ts` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+/**
+ * The process one repository read runs in.
+ *
+ * Forked by brain-build-process.ts, one per read, and it exits when the read
+ * does. It receives the credential it needs rather than the App's private key,
+ * for the same reason the reviewer's worker does: `ps` and `/proc/<pid>/environ`
+ * are readable, and a key that never crosses the boundary cannot leak across it.
+ *
+ * Everything expensive happens here — the clone, the tree-sitter parse, the
+ * pull-request walk — and none of it can reach the server's event loop.
+ */
+import { readRepository, type BrainBuildJob, type RepoReadAuth } from "./brain-build.js";
+
+/** Parent → child, once, immediately after the fork. */
+export interface StartMessage {
+  t: "start";
+  job: BrainBuildJob;
+  auth: RepoReadAuth;
+  api?: string;
+  githubHost?: string;
+}
+
+/** Child → parent: a line for the App's log, so a read is still traceable. */
+export interface LogMessage {
+  t: "log";
+  msg: string;
+}
+
+export interface DoneMessage {
+  t: "done";
+  result: Awaited<ReturnType<typeof readRepository>>;
+}
+
+export interface FailedMessage {
+  t: "failed";
+  message: string;
+}
+
+export type FromChild = LogMessage | DoneMessage | FailedMessage;
+
+function send(msg: FromChild): void {
+  if (!process.send) return;
+  try {
+    process.send(msg);
+  } catch {
+    /* parent went away; the exit is the report */
+  }
+}
+
+process.on("message", (raw) => {
+  const msg = raw as StartMessage;
+  if (msg.t !== "start") return;
+  void readRepository(msg.job, {
+    // No creds: this half needs none. resolveRepoRead already did every call
+    // that requires the App's identity, and its answer is in `auth`.
+    creds: { appId: "", privateKey: "" },
+    fetch: globalThis.fetch,
+    api: msg.api,
+    githubHost: msg.githubHost,
+    log: (line: string) => send({ t: "log", msg: line }),
+  }, msg.auth)
+    .then((result) => {
+      send({ t: "done", result });
+      // The digest can be several megabytes and the channel is asynchronous, so
+      // let the write drain rather than exiting out from under it.
+      process.disconnect?.();
+    })
+    .catch((e: unknown) => {
+      send({ t: "failed", message: e instanceof Error ? e.message : String(e) });
+      process.disconnect?.();
+    });
+});
```

**File**: `src/app/brain-build.ts` (modified, +80/-54)
```diff
@@ -173,17 +173,90 @@ export async function checkRepoAccess(job: { owner: string; repo: string }, deps
  * both ways is one we genuinely cannot see, and that is the case the UI turns
  * into "read it on your machine".
  */
-export async function buildRepoIntoBrain(
-  job: BrainBuildJob,
-  deps: BrainBuildDeps,
-): Promise<BrainBuildResult> {
+/** Everything the heavy half needs, and nothing it could mint for itself. */
+export interface RepoReadAuth {
+  /** Installation or public-read token, for the GitHub API calls. */
+  token: string;
+  /** Credential for the clone. Empty for a public repository we are not
+   * installed on: git serves those to anyone, and a token minted for another
+   * account is not promised to work on this one. */
+  cloneToken: string;
+  meta: RepoMeta;
+}
+
+/**
+ * Decide how this repository gets read, and mint the credential for it.
+ *
+ * The network half of a build, kept separate from the work: an installation
+ * lookup, a token, a repository lookup. About a second, none of it blocking.
+ *
+ * Throws RepoNotAccessibleError when there is no way in. That is the answer the
+ * onboarding UI turns into a choice, which is why it is raised here — before a
+ * single byte is cloned — rather than discovered somewhere inside the read.
+ */
+export async function resolveRepoRead(job: BrainBuildJob, deps: BrainBuildDeps): Promise<RepoReadAuth> {
+  const api = deps.api ?? "https://api.github.com";
+  const tag = `${job.owner}/${job.repo}`;
+  const installationId = await installationFor(deps.creds, job.owner, job.repo, deps.fetch, (deps.now ?? Date.now)(), api);
+  if (installationId !== null) {
+    const token = await installationToken(deps, installationId, tag, api);
+    const meta = await repoMeta(job.owner, job.repo, token, deps.fetch, api);
+    return { token, cloneToken: token, meta: meta ?? { isPrivate: true, defaultBranch: "" } };
+  }
+
+  // No installation on this repository. That rules out nothing yet: a public
+  // repo clones with no credential at all, and its API answers to any token we
+  // hold. So find a credential for the reading, then ask whether it is public.
+  const token = await publicReadToken(deps, api);
+  const meta = await repoMeta(job.owner, job.repo, token, deps.fetch, api);
+  if (!meta || meta.isPrivate) {
+    // Which of the two gaps it is decides what the UI can offer, so it is
+    // resolved here rather than guessed there.
+    const gap = await repoAccessGap(deps.creds, job.owner, deps.fetch, (deps.now ?? Date.now)(), api);
+    throw new RepoNotAccessibleError(
+      gap.reason === "repo_not_selected"
+        ? `graft is installed on ${job.owner} but ${tag} is not in the list of repositories it can see`
+        : `graft is not installed on ${job.owner}`,
+      gap,
+    );
+  }
+  return { token, cloneToken: "", meta };
+}
+
+/**
+ * Read the repository and hand its history to the brain.
+ *
+ * An installation is the preferred way in: it is the only way into a private
+ * repository, and it carries a rate limit worth having. It is not required for
+ * a public one, though — those clone anonymously and answer the API
+ * anonymously — so a failed installation lookup is a reason to try the open
+ * door, not a reason to stop. Only a repository that is private or unreadable
+ * both ways is one we genuinely cannot see, and that is the case the UI turns
+ * into "read it on your machine".
+ */
+export async function buildRepoIntoBrain(job: BrainBuildJob, deps: BrainBuildDeps): Promise<BrainBuildResult> {
+  return readRepository(job, deps, await resolveRepoRead(job, deps));
+}
+
+/**
+ * The heavy half: clone, graph, history, digest.
+ *
+ * Takes its credential rather than minting one, because this is the half that
+ * runs somewhere else. Every expensive thing in it is synchronous — the git
+ * calls are spawnSync, the parse is a loop of native tree-sitter calls, the
+ * graph is written with a blocking stringify — so in the server process it
+ * ho
```

**File**: `src/app/server.ts` (modified, +7/-1)
```diff
@@ -21,6 +21,7 @@ import { timingSafeEqual } from "node:crypto";
 import { jobKey, reviewJobFor, type ReviewJob } from "./events.js";
 import { InstallationTokens, verifySignature, type AppCredentials, type Fetch } from "./identity.js";
 import { buildRepoIntoBrain, checkRepoAccess, RepoNotAccessibleError, type BrainBuildJob } from "./brain-build.js";
+import { buildRepoInChildProcess } from "./brain-build-process.js";
 import { PageStore } from "./pages.js";
 import { WorkQueue } from "./queue.js";
 import { reviewInChildProcess } from "./review-process.js";
@@ -223,7 +224,12 @@ export function createApp(
         // The deployment's platform URL wins over anything a caller sends, so a
         // request cannot redirect a repository's history to another host.
         if (config.brainBaseUrl) job.brainBaseUrl = config.brainBaseUrl;
-        const built = await (seams.brainBuild ?? buildRepoIntoBrain)(job, {
+        // Out of this process by default. A read is minutes of blocking work
+        // and the App has to keep answering — including the one-second access
+        // question the next person's onboarding is waiting on. A test that
+        // injects its own builder still runs in-process, which is what a test
+        // wants.
+        const built = await (seams.brainBuild ?? buildRepoInChildProcess)(job, {
           creds: config,
           fetch: fetchImpl,
           api: config.api,
```

**File**: `test/app-brain-build-process.test.ts` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+/**
+ * The one failure in forking a read that no protocol test would catch: the
+ * entry path being wrong, or the read stack failing to load in a child.
+ *
+ * Everything else about the child protocol is the reviewer's, tested next door
+ * in app-review-process.test.ts. What is specific here is that a deployed App
+ * forks THIS module, and that importing it pulls in the same nine tree-sitter
+ * native addons at graph/extract.ts's module scope. A grammar that cannot load
+ * in a forked child dies during import — silently, at runtime, on every read.
+ */
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { existsSync } from "node:fs";
+import { fork } from "node:child_process";
+import { brainBuildWorkerEntry } from "../src/app/brain-build-process.js";
+
+const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
+
+test("the brain build worker is where a deployed App looks for it, and it comes up", async () => {
+  const entry = brainBuildWorkerEntry();
+  assert.ok(existsSync(entry), `${entry} must exist — it is what a deployed App forks`);
+
+  const child = fork(entry, ["load-probe"], { stdio: ["ignore", "pipe", "pipe", "ipc"] });
+  let stderr = "";
+  child.stderr?.on("data", (c) => {
+    stderr += String(c);
+  });
+  const ended = new Promise<string>((resolve) => {
+    child.on("exit", (code, signal) => resolve(signal ? `signal ${signal}` : `code ${code}`));
+  });
+  try {
+    // No read runs — a read wants a clone and a token. Still waiting for work
+    // after this long means the stack imported cleanly, which is the assertion.
+    const outcome = await Promise.race([ended, sleep(2500).then(() => "still waiting for work")]);
+    assert.equal(outcome, "still waiting for work", `the brain build worker did not come up: ${stderr}`);
+  } finally {
+    child.kill("SIGKILL");
+  }
+});
```

---

### Incident Patch 5: `2a70cbdf` (2026-09-10)
**Commit Message**: fix(brain): borrow an installation token for public reads, not the anonymous rate limit

**File**: `src/app/brain-build.ts` (modified, +54/-10)
```diff
@@ -15,7 +15,16 @@ import { buildGraph } from "../graph/build.js";
 import { contextDirFor } from "../context/node-file.js";
 import { loadGraphCached } from "../graph/load.js";
 import { checkoutRepository } from "./checkout.js";
-import { appJwt, ghHeaders, installationFor, repoAccessGap, type AppCredentials, type Fetch, type RepoAccessGap } from "./identity.js";
+import {
+  appJwt,
+  ghHeaders,
+  installationFor,
+  publicReadInstallation,
+  repoAccessGap,
+  type AppCredentials,
+  type Fetch,
+  type RepoAccessGap,
+} from "./identity.js";
 import { buildDigest, postDigest, readCommits, readSymbols, readThreads, type RepoDigest } from "./history.js";
 import {
   budgetSources,
@@ -79,13 +88,16 @@ export interface BrainBuildDeps {
   /**
    * Token used for a public repository the App is not installed on.
    *
-   * Optional, and the read works without it: a public repo clones anonymously
-   * and answers the API anonymously too. What it buys is the rate limit —
-   * anonymous is 60 requests an hour for the whole box, which the pull-request
-   * walk exhausts on the first repository of the day, after which every later
-   * build quietly degrades to commits only.
+   * Optional. Without it the read borrows one of our own installation's tokens,
+   * which GitHub answers for any public resource, and falls back to anonymous
+   * if the App has no installations at all. Anonymous works but is 60 requests
+   * an hour for the whole box — one pull-request walk — so it is the last
+   * resort, not the plan.
    */
   publicToken?: string;
+  /** Whose installation to borrow for those reads. Ours, so a public read
+   * spends our rate limit and not a customer's. */
+  publicOwner?: string;
 }
 
 /** Raised when the App cannot see the repository. Distinct because the caller
@@ -133,14 +145,17 @@ export async function buildRepoIntoBrain(
   // single-ref fetch (there is no origin/HEAD to resolve), so both are read
   // from the API rather than guessed.
   let token = "";
+  let cloneToken: string | null = null;
   let meta: RepoMeta | null = null;
   if (installationId !== null) {
     token = await installationToken(deps, installationId, tag, api);
     meta = await repoMeta(job.owner, job.repo, token, deps.fetch, api);
   } else {
-    // No installation. If the repository answers anonymously and says it is
-    // public, that is all the access this read needs.
-    token = deps.publicToken ?? "";
+    // No installation on this repository. That rules out nothing yet: a public
+    // repo clones with no credential at all, and its API answers to any token
+    // we hold. So find a credential for the reading, then ask the repo whether
+    // it is in fact public.
+    token = await publicReadToken(deps, api);
     meta = await repoMeta(job.owner, job.repo, token, deps.fetch, api);
     if (!meta || meta.isPrivate) {
       // Which of the two gaps it is decides what the UI can offer, so it is
@@ -154,14 +169,18 @@ export async function buildRepoIntoBrain(
       );
     }
     log(`${tag}: no installation, reading it as a public repository${token ? "" : " anonymously"}`);
+    // The clone is the one part that stays anonymous. A public repository
+    // serves it to anyone, and a token minted for a different account is not
+    // something git is promised to accept on this one.
+    cloneToken = "";
   }
   if (!meta) meta = { isPrivate: true, defaultBranch: "" };
 
   const checkout = checkoutRepository({
     owner: job.owner,
     repo: job.repo,
     ref: job.ref || meta.defaultBranch,
-    token,
+    token: cloneToken ?? token,
     api: deps.githubHost,
     log,
   });
@@ -269,6 +288,31 @@ async function repoMeta(owner: string, repo: string, token: string, fetchImpl: F
   }
 }
 
+/**
+ * A credential for reading a public repository we are not installed on.
+ *
+ * Order: a token configured for exactly this, then one of our own
+ * installation's, then nothing. Every step of that ladder works — the
+ * di
```

**File**: `src/app/identity.ts` (modified, +35/-0)
```diff
@@ -94,6 +94,41 @@ export function ghHeaders(token: string): Record<string, string> {
   return headers;
 }
 
+/**
+ * An installation token for reading PUBLIC repositories the App is not
+ * installed on.
+ *
+ * GitHub answers any public resource to any installation token, at 5,000
+ * requests an hour. Anonymous answers the same resources at 60 an hour for the
+ * whole box, which one repository's pull-request walk spends in a minute — so
+ * without this, the second public repo of the hour reads as "we cannot see it".
+ *
+ * `owner` is our own account, so this borrows OUR installation's rate limit
+ * rather than some customer's. Falls back to the first installation, and to
+ * null when the App has none, in which case the caller reads anonymously.
+ */
+export async function publicReadInstallation(
+  creds: AppCredentials,
+  owner: string,
+  fetchImpl: Fetch,
+  nowMs: number = Date.now(),
+  api = "https://api.github.com",
+): Promise<number | null> {
+  const res = await fetchImpl(`${api}/app/installations?per_page=100`, {
+    headers: {
+      authorization: `Bearer ${appJwt(creds, nowMs)}`,
+      accept: "application/vnd.github+json",
+      "user-agent": "graft-app",
+    },
+  });
+  if (!res.ok) return null;
+  const list = JSON.parse(await res.text()) as Array<{ id?: number; account?: { login?: string } }>;
+  if (!Array.isArray(list) || list.length === 0) return null;
+  const wanted = owner.toLowerCase();
+  const mine = list.find((i) => (i.account?.login ?? "").toLowerCase() === wanted);
+  return (mine ?? list[0]).id ?? null;
+}
+
 export async function installationFor(
   creds: AppCredentials,
   owner: string,
```

**File**: `src/app/main.ts` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ const { server, queue } = createApp({
   brainBuildSecret: process.env.GRAFT_BRAIN_BUILD_SECRET,
   brainBaseUrl: process.env.GRAFT_BRAIN_URL,
   publicToken: process.env.GRAFT_PUBLIC_GITHUB_TOKEN || process.env.GITHUB_TOKEN,
+  publicOwner: process.env.GRAFT_PUBLIC_INSTALLATION_OWNER,
 });
 
 /**
```

**File**: `src/app/server.ts` (modified, +5/-2)
```diff
@@ -51,9 +51,11 @@ export interface AppConfig extends AppCredentials {
   /** Platform base URL the digest is posted to. Defaults to production. */
   brainBaseUrl?: string;
   /** Token for reading public repositories the App is not installed on.
-   * Optional — without it those reads are anonymous, and anonymous runs out of
-   * rate limit after about one repository an hour. */
+   * Optional — without it the read borrows one of our own installation's
+   * tokens, and only falls back to anonymous if the App has none. */
   publicToken?: string;
+  /** Whose installation to borrow for that. Defaults to ours. */
+  publicOwner?: string;
   /** Public origin, for the links put in comments, e.g. https://graft.example.com */
   publicUrl: string;
   /** Where pages are kept, so a restart does not strand the links already posted. */
@@ -181,6 +183,7 @@ export function createApp(
           fetch: fetchImpl,
           api: config.api,
           publicToken: config.publicToken,
+          publicOwner: config.publicOwner,
           log,
           now: seams.now,
         });
```

---

### Incident Patch 6: `cf954d0a` (2026-09-10)
**Commit Message**: fix(brain): refresh a brain's rules from upkeep, so one empty pull is not forever (#343)

* feat(brain): carry a brain's rules into every ask and every agent instruction file

* feat(app): build a repository into a brain on demand, from its own history

* docs(app): document the repo-to-brain read route and its two modes

* feat(app): return the digest when no brain token is sent, so the platform ingests it itself

* fix(app): read PR discussion — the list endpoint has no comment counts to filter on

* fix(brain): pull rules over the public token route, not the workspace-scoped one

* feat(app): tell a missing install apart from a repo the install cannot see

* feat(brain): read the repo's stated rules, and push a brain from a local clone

* fix(brain): refresh a brain's rules from upkeep, so one empty pull is not forever

**File**: `src/brain/link.ts` (modified, +35/-3)
```diff
@@ -18,9 +18,21 @@ import { join } from 'node:path';
 /** Default API host. Overridden by GRAFT_BRAIN_URL, for staging and self-hosted. */
 const DEFAULT_BRAIN_BASE_URL = 'https://agents.nanonets.com';
 
-/** How long a cached rule set is served before `ask` refreshes it in the background. */
+/** How long a cached rule set is served before upkeep refreshes it. */
 export const RULES_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
 
+/**
+ * The TTL used while the cache holds NO rules.
+ *
+ * A brain is connected during onboarding while it is still being mined, so the
+ * first pull legitimately returns nothing. Six hours of that is the difference
+ * between the feature working and the user concluding it does not: they wired
+ * graft up, got an empty rulebook, and nothing would go back for the real one
+ * until tomorrow. Two minutes costs one cheap request per session until the
+ * rules land, and then the normal TTL takes over.
+ */
+export const EMPTY_RULES_TTL_MS = 2 * 60 * 1000;
+
 /** One rule from the brain, anchored to a symbol in this repo. */
 export interface BrainRule {
   ruleId: string;
@@ -38,6 +50,11 @@ export interface RulesCache {
   brainId: string;
   fetchedAt: number;
   rules: BrainRule[];
+  /** When a refresh was last ATTEMPTED, successful or not. Separate from
+   * `fetchedAt`, which records when rules last actually arrived: without the
+   * distinction, a brain that is still building would be re-checked on every
+   * single command, because its `fetchedAt` never advances. */
+  checkedAt?: number;
 }
 
 /** The persisted brain link. */
@@ -89,9 +106,24 @@ export function writeRulesCache(dir: string, cache: RulesCache): void {
   writeJsonAtomic(rulesCachePath(dir), cache, true);
 }
 
-/** Whether a cached set is old enough to refetch. */
+/**
+ * Whether a cached set is old enough to refetch.
+ *
+ * Keyed off the last ATTEMPT, not the last success, and with a much shorter
+ * window while the cache is empty — see EMPTY_RULES_TTL_MS for why that case
+ * is the one that matters.
+ */
 export function cacheIsStale(cache: RulesCache | null, now = Date.now()): boolean {
-  return !cache || now - cache.fetchedAt > RULES_TTL_MS;
+  if (!cache) return true;
+  const ttl = cache.rules.length === 0 ? EMPTY_RULES_TTL_MS : RULES_TTL_MS;
+  return now - (cache.checkedAt ?? cache.fetchedAt) > ttl;
+}
+
+/** Record that a refresh was attempted, without claiming rules arrived. */
+export function markRulesChecked(dir: string, now = Date.now()): void {
+  const cache = readRulesCache(dir);
+  if (!cache) return;
+  writeRulesCache(dir, { ...cache, checkedAt: now });
 }
 
 /**
```

**File**: `src/cli.ts` (modified, +16/-1)
```diff
@@ -208,7 +208,7 @@ function parseTabs(raw: string | undefined): VizTab[] | undefined {
  * not editorialize on stderr at startup (`mcp` runs its own upkeep at boot, and
  * `_update-check` IS the fetch).
  */
-const UPKEEP_SKIP = new Set(["version", "upgrade", "_update-check", "mcp"]);
+const UPKEEP_SKIP = new Set(["version", "upgrade", "_update-check", "_brain-refresh", "mcp"]);
 
 /**
  * Every other command: top up the cached registry answer in the background and,
@@ -242,6 +242,21 @@ program.hook("postAction", (_parent, action) => {
 });
 
 // Hidden from --help: only ever spawned detached by maybeRefreshInBackground.
+program
+  .command("_brain-refresh", { hidden: true })
+  .description("internal: re-pull the attached brain's rules and rewrite the agent files")
+  .argument("[dir]", "target repo directory", ".")
+  .action(async (dir: string) => {
+    // Spawned detached by upkeep, so nothing here is user-visible and nothing
+    // may throw: a failure means the cached rules keep serving, which is the
+    // correct outcome for a brain that is momentarily unreachable.
+    try {
+      await pullBrain(resolve(dir), { home: homedir() });
+    } catch {
+      /* the next session tries again */
+    }
+  });
+
 program
   .command("_update-check", { hidden: true })
   .description("internal: refresh the cached latest-version answer")
```

**File**: `src/upkeep-run.ts` (modified, +6/-0)
```diff
@@ -11,6 +11,7 @@ import { graftCliPath } from './claude/paths.js';
 import {
   formatUpdateNudge,
   formatWiringRefresh,
+  maybeRefreshBrainRules,
   maybeRefreshInBackground,
   readUpdateCache,
   reconcileWiring,
@@ -66,6 +67,11 @@ export function runUpkeep(
     const refreshLine = formatWiringRefresh(refreshed);
     if (refreshLine) lines.push(refreshLine);
   } catch { /* fail-soft: wiring refresh is never worth breaking a session for */ }
+  try {
+    // Rules the attached brain has gained since the last pull. Detached, so it
+    // never delays the session it runs in.
+    if (opts.background !== false) maybeRefreshBrainRules(repo);
+  } catch { /* same */ }
   try {
     if (opts.background !== false) maybeRefreshInBackground(opts.home);
     const nudge = formatUpdateNudge(current, readUpdateCache(opts.home)?.latest);
```

**File**: `src/upkeep.ts` (modified, +36/-0)
```diff
@@ -32,6 +32,7 @@ import { readJson, writeJsonAtomic, cacheDir } from './util/state.js';
 import { HOSTS } from './hosts/registry.js';
 import { START } from './hosts/sections.js';
 import { getNpmViewVersion, readCurrentVersion } from './cli-meta.js';
+import { cacheIsStale, markRulesChecked, readLink, readRulesCache } from './brain/link.js';
 import { graftCliPath } from './claude/paths.js';
 
 /**
@@ -143,6 +144,41 @@ export function maybeRefreshInBackground(home?: string, now = Date.now()): boole
   }
 }
 
+/**
+ * Refresh the attached brain's rules in a detached child, when they are stale.
+ *
+ * The same shape as the update check above, and for the same reason: this runs
+ * inside session-start hooks and MCP boot, where waiting on the network is a
+ * stalled first turn. So nothing here blocks — the child does the fetch and
+ * this call returns immediately.
+ *
+ * Without it a brain is pulled exactly once, at `graft brain connect`, and
+ * never again. That was survivable when connecting happened after the brain
+ * finished building; it is not survivable now that onboarding connects DURING
+ * the build, because the one pull returns an empty rulebook and nothing would
+ * ever go back for the real one.
+ *
+ * The attempt is stamped before spawning, so a brain that is still building
+ * costs one request per TTL window rather than one per command.
+ */
+export function maybeRefreshBrainRules(repo: string, now = Date.now()): boolean {
+  try {
+    if (!readLink(repo)) return false;
+    const cache = readRulesCache(repo);
+    if (!cacheIsStale(cache, now)) return false;
+    markRulesChecked(repo, now);
+    const child = spawn(process.execPath, [graftCliPath(), '_brain-refresh', repo], {
+      detached: true,
+      stdio: 'ignore',
+      windowsHide: true,
+    });
+    child.unref();
+    return true;
+  } catch {
+    return false; // no spawn, or an unreadable repo — the cached rules still serve
+  }
+}
+
 /** One line, or nothing. Nothing is the common case — don't spend context on
  * "you're up to date". */
 export function formatUpdateNudge(current: string, latest: string | null | undefined): string | null {
```

---

### Incident Patch 7: `6fa2baed` (2026-09-01)
**Commit Message**: fix(app): review closed PRs too, so a merged PR keeps a working graph link (#280)

**File**: `src/app/events.ts` (modified, +7/-1)
```diff
@@ -45,6 +45,13 @@ const ACTIONS = new Set(["opened", "synchronize", "reopened", "ready_for_review"
  * a bot commenting on every push to one is the fastest way to be uninstalled.
  * `ready_for_review` is in the accepted set so the comment appears the moment the
  * author asks for eyes.
+ *
+ * A CLOSED pull request is not skipped. The graph is most useful to whoever reads
+ * the PR later, and a merged PR is exactly what gets read — so the comment has to
+ * keep working after the merge. This costs nothing on live traffic: none of the
+ * four accepted actions fire on an already-merged PR, so in practice this only
+ * admits a `synchronize` that raced a merge, and a deliberate re-delivery. The
+ * accepted-action set, not the PR state, is what bounds the work.
  */
 export function reviewJobFor(event: string, payload: unknown): { job: ReviewJob } | { skip: string } {
   if (event === "ping") return { skip: "ping" };
@@ -66,7 +73,6 @@ export function reviewJobFor(event: string, payload: unknown): { job: ReviewJob
     return { skip: "payload missing installation, repository or pull request fields" };
   }
   if (pr?.draft === true && action !== "ready_for_review") return { skip: "draft" };
-  if (pr?.state === "closed") return { skip: "closed" };
 
   const base = pr?.base?.repo?.full_name;
   const head = pr?.head?.repo?.full_name;
```

**File**: `test/app-events.test.ts` (modified, +9/-1)
```diff
@@ -46,12 +46,20 @@ test("events: a pull request that changed its diff becomes a job", () => {
   assert.equal(fork.job.owner, "NanoNets", "the comment belongs on the BASE repo, not the contributor's copy");
 });
 
+test("events: a merged pull request is still reviewed, so the link survives the merge", () => {
+  // The graph is read most often after the fact, on a PR that already landed.
+  // Skipping closed PRs left every merged comment pointing at a page that could
+  // never be regenerated.
+  const merged = reviewJobFor("pull_request", delivery({ action: "synchronize" }, { state: "closed" }));
+  assert.ok("job" in merged, `a closed PR must still produce a job, got ${JSON.stringify(merged)}`);
+  assert.equal(merged.job.number, 180);
+});
+
 test("events: noise is skipped with a reason", () => {
   const skipped = [
     reviewJobFor("pull_request", delivery({ action: "labeled" })),
     reviewJobFor("pull_request", delivery({ action: "edited" })),
     reviewJobFor("pull_request", delivery({}, { draft: true })),
-    reviewJobFor("pull_request", delivery({}, { state: "closed" })),
     reviewJobFor("issue_comment", delivery()),
     reviewJobFor("ping", {}),
     reviewJobFor("pull_request", delivery({ installation: undefined })),
```

---

### Incident Patch 8: `08ff9f77` (2026-09-01)
**Commit Message**: fix(app): review merged PRs via the head ref, diffed against the merge base (#279)

**File**: `docs/github-app.md` (modified, +4/-1)
```diff
@@ -15,7 +15,10 @@ instead of a workflow file per repo.
 
 1. Verifies the webhook signature, queues the job, answers `202` — GitHub gives
    up on a delivery after ten seconds and a review takes longer.
-2. Fetches `refs/pull/<n>/merge` and the base branch, shallow.
+2. Fetches `refs/pull/<n>/merge` and the base branch, shallow — falling back to
+   `refs/pull/<n>/head` for a closed or merged pull request, whose merge ref
+   GitHub has deleted. The head ref is then diffed against the base branch as it
+   stood at the merge, so the radius is still the pull request's own change.
 3. Builds the structural graph, computes the radius, renders the comment.
 4. Stores the viewer page and links it with a signed URL.
 5. Edits its existing comment rather than adding one per push.
```

**File**: `src/app/checkout.ts` (modified, +161/-29)
```diff
@@ -22,6 +22,16 @@ import { join } from "node:path";
 
 /** Enough history for a merge base against the pull request's base branch. */
 const FETCH_DEPTH = 50;
+/**
+ * One extra reach back, used only on the `/head` fallback below.
+ *
+ * An open PR's base tip is a commit or two from the merge base, so 50 is plenty.
+ * A pull request being re-reviewed weeks after it merged is the opposite case:
+ * the base branch has moved on by however many commits the repo lands in that
+ * time, and the commit the branch was actually merged on top of sits behind all
+ * of them. Deepening once is cheaper than raising `FETCH_DEPTH` for every review.
+ */
+const DEEPEN_DEPTH = 500;
 const GIT_TIMEOUT_MS = 120_000;
 
 export interface CheckoutRequest {
@@ -31,20 +41,28 @@ export interface CheckoutRequest {
   baseRef: string;
   token: string;
   api?: string;
+  /** Where to say which of GitHub's two PR refs the review is actually using —
+   * the App's own log callback, so the two cases are told apart in the container
+   * logs rather than guessed at from the comment. */
+  log?: (msg: string) => void;
 }
 
 export interface Checkout {
-  /** Working tree at the pull request's merge commit. */
+  /** Working tree at the pull request's merge commit, or at its head commit when
+   * the merge ref is gone (see {@link ref}). */
   dir: string;
   /** What `blast --base` should diff against. */
   base: string;
+  /** Which ref the tree came from. `merge` is the normal case; `head` means the
+   * pull request is closed and GitHub has deleted its merge preview. */
+  ref: "merge" | "head";
   /** Removes the tree. Always call it — the token's clone is not something to
    * leave in /tmp. */
   cleanup: () => void;
 }
 
 /** A git invocation with the dangerous parts of the environment removed. */
-function git(dir: string, args: string[], token?: string): { ok: boolean; err: string } {
+function git(dir: string, args: string[], token?: string): { ok: boolean; out: string; err: string } {
   const auth = token
     ? [
         "-c",
@@ -72,52 +90,166 @@ function git(dir: string, args: string[], token?: string): { ok: boolean; err: s
       },
     },
   );
-  return { ok: res.status === 0, err: `${res.stderr ?? ""}${res.error ? ` ${res.error.message}` : ""}`.trim() };
+  return {
+    ok: res.status === 0,
+    out: res.stdout ?? "",
+    err: `${res.stderr ?? ""}${res.error ? ` ${res.error.message}` : ""}`.trim(),
+  };
 }
 
+/** First line of a git command's output, or null when it said nothing useful. */
+function line(dir: string, args: string[]): string | null {
+  const { ok, out } = git(dir, args);
+  const first = out.split("\n")[0]?.trim() ?? "";
+  return ok && first !== "" ? first : null;
+}
+
+const short = (sha: string): string => sha.slice(0, 7);
+
 /**
- * Fetch the PR's merge ref and its base, shallow.
+ * Fetch the PR's code and its base, shallow, and land on it.
  *
  * `refs/pull/N/merge` is GitHub's own merge of the PR into its base — the same
  * thing the checks see, and the right thing to review: it is what will land, not
- * what the contributor's branch says in isolation.
+ * what the contributor's branch says in isolation. It is preferred whenever it
+ * exists.
+ *
+ * But GitHub DELETES that ref the moment a pull request is closed or merged: it
+ * is only a preview of a merge, and there is nothing left to preview afterwards.
+ * Re-reviewing any merged PR therefore died at the fetch with `couldn't find
+ * remote ref refs/pull/N/merge` — 16 in a row on one installation — which is why
+ * `refs/pull/N/head` (the branch tip as the author pushed it, kept indefinitely
+ * in the BASE repository, so it survives even the fork being deleted) is fetched
+ * as a fallback. What changes with it is the diff basis, which
+ * {@link headDiffBase} is entirely about.
  */
 export function checkoutPullRequest(req: CheckoutRequest): Checkout {
   const host = (req.api ?? "https://github.com").replace(/\/$/, "");
   const dir = mk
```

**File**: `src/app/review.ts` (modified, +4/-1)
```diff
@@ -45,7 +45,10 @@ export interface ReviewResult {
 export async function reviewPullRequest(job: ReviewJob, deps: ReviewDeps): Promise<ReviewResult> {
   const log = deps.log ?? (() => {});
   const token = await deps.token(job.installationId);
-  const checkout = checkoutPullRequest({ owner: job.owner, repo: job.repo, number: job.number, baseRef: job.baseRef, token });
+  // `log` goes into the checkout because a closed pull request is reviewed from
+  // `refs/pull/N/head` against a different basis than an open one, and the only
+  // place that difference is visible afterwards is this line.
+  const checkout = checkoutPullRequest({ owner: job.owner, repo: job.repo, number: job.number, baseRef: job.baseRef, token, log });
 
   try {
     log(`${job.owner}/${job.repo}#${job.number}: building`);
```

**File**: `test/app-checkout.test.ts` (modified, +176/-22)
```diff
@@ -6,6 +6,14 @@
  * actually land — and reviewing the head branch instead would report a radius
  * for code that was never going to exist. A local bare repository stands in for
  * GitHub here, so this exercises the real git commands with no network.
+ *
+ * The other half of these tests is the closed pull request, where GitHub has
+ * deleted `refs/pull/N/merge` and `refs/pull/N/head` is all that is left. What
+ * has to be checked there is not that the fetch succeeds — it is that the diff
+ * is still the pull request's own change, because the obvious implementation
+ * (diff the head against the base tip) reports NOTHING for a PR that merged as a
+ * merge commit, and an empty blast radius posted confidently is worse than the
+ * fetch error it replaced.
  */
 import { test } from "node:test";
 import assert from "node:assert/strict";
@@ -16,15 +24,31 @@ import { join } from "node:path";
 import { checkoutPullRequest, redact } from "../src/app/checkout.js";
 
 const git = (cwd: string, ...args: string[]): string =>
-  execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@e", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@e" } });
+  // stderr piped, not inherited: `git merge --squash` chats about the strategy it
+  // chose even under `--quiet`, and it lands in the middle of the TAP stream. A
+  // failure still carries it, on the thrown error.
+  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@e", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@e" } });
+
+/**
+ * How the pull request stands on the fake GitHub.
+ *
+ * `open` is the only one with a merge ref: GitHub deletes it on close, which is
+ * exactly what the other three reproduce. They differ in how the branch landed,
+ * because that is what decides the diff:
+ *  - `merged`: a merge commit, so the head commit is an ancestor of `main`.
+ *  - `squashed`: new commits on `main`, so the head commit is not.
+ *  - `merged-far-behind`: a merge commit, then more commits on `main` than the
+ *    shallow fetch reaches back — the months-old pull request.
+ */
+type PrState = "open" | "merged" | "squashed" | "merged-far-behind";
 
 /**
- * A stand-in for GitHub: a mirror holding `main` and the merge ref.
+ * A stand-in for GitHub: a mirror holding `main` and the PR's refs.
  *
- * `--mirror`, not `--bare`: a bare clone copies branches and tags, and the ref
- * that matters here lives under `refs/pull/`.
+ * `--mirror`, not `--bare`: a bare clone copies branches and tags, and the refs
+ * that matter here live under `refs/pull/`.
  */
-function fakeGitHub(): { root: string; repo: string } {
+function fakeGitHub(state: PrState = "open"): { root: string; repo: string } {
   const root = mkdtempSync(join(tmpdir(), "graft-origin-"));
   const work = join(root, "work");
   execFileSync("git", ["init", "--quiet", "-b", "main", work]);
@@ -38,49 +62,179 @@ function fakeGitHub(): { root: string; repo: string } {
   writeFileSync(join(work, "feature.txt"), "feature\n");
   git(work, "add", "-A");
   git(work, "commit", "--quiet", "-m", "feature");
-
-  // GitHub publishes the merge commit under refs/pull/N/merge; reproduce it.
   git(work, "checkout", "--quiet", "main");
-  git(work, "merge", "--quiet", "--no-ff", "-m", "merge", "feature");
-  git(work, "update-ref", "refs/pull/7/merge", "HEAD");
-  git(work, "checkout", "--quiet", "main");
-  git(work, "reset", "--hard", "--quiet", "HEAD~1");
 
+  // The head ref exists in every state, in the BASE repository — which is why it
+  // outlives both the branch and the whole fork.
+  git(work, "update-ref", "refs/pull/7/head", "refs/heads/feature");
+
+  if (state === "open") {
+    // GitHub publishes the merge commit under refs/pull/N/merge; reproduce it.
+    git(work, "merge", "--quiet", "--no-ff", "-m", "merge", "feature");
+    git(work, "update-ref", "refs/pull
```

---

### Incident Patch 9: `afa3d2de` (2026-09-01)
**Commit Message**: fix(ci): green main — clear every CI var in the telemetry test, align CodeQL pins (#277)

Two unrelated causes, both red on main since before 0.16.0.

1. cursor-session-end turns telemetry ON to observe the rollup and cleared
   only CI. inCi is deliberately generous and also reads GITHUB_ACTIONS plus
   seven more, so on GitHub Actions the gate stayed shut, nothing queued, and
   summarized came back undefined. The list is now CI_ENV_VARS in gate.ts,
   read by both inCi and the test, so a var added to one reaches the other.
   inCi returns identically for every input.

2. codeql-action/init was bumped to 4.37.8 (#240) while analyze stayed on
   4.37.7, and CodeQL refuses a version-mismatched pair. Both now match the
   4.37.8 SHA scorecard.yml already used, and the stale '# v3' comments that
   hid the drift name the real version.

**File**: `.github/workflows/codeql.yml` (modified, +2/-2)
```diff
@@ -26,9 +26,9 @@ jobs:
           persist-credentials: false
 
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28 # v3
+        uses: github/codeql-action/init@db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28 # v4.37.8
         with:
           languages: javascript-typescript
 
       - name: Perform CodeQL analysis
-        uses: github/codeql-action/analyze@ff2f1c621b7f889edc0d3c761ac2e6a3f8cdb0dd # v3
+        uses: github/codeql-action/analyze@db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28 # v4.37.8
```

**File**: `src/telemetry/gate.ts` (modified, +19/-4)
```diff
@@ -29,17 +29,32 @@ export function doNotTrack(env: NodeJS.ProcessEnv = process.env): boolean {
   return v !== undefined && v !== '' && v !== '0';
 }
 
+/**
+ * Every variable {@link inCi} reads, named once.
+ *
+ * Exported because a test that needs telemetry actually ON has to clear all of
+ * them, and clearing a hand-copied subset is how this list silently drifts: the
+ * `cursor-session-end` test cleared `CI` alone, so it passed on a laptop and failed
+ * on GitHub Actions — where `GITHUB_ACTIONS` is set — for every run until someone
+ * read the log. One list, both callers.
+ */
+export const CI_ENV_VARS = [
+  'CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'BUILDKITE', 'CIRCLECI',
+  'TEAMCITY_VERSION', 'JENKINS_URL', 'TF_BUILD', 'BUILD_NUMBER',
+] as const;
+
 /**
  * CI detection. `CI` covers essentially every provider; the rest are the ones
  * that historically did not set it. Deliberately generous — a false positive
  * costs one uncounted user, a false negative pollutes the dataset.
+ *
+ * `CI` is the one read with a value test: `CI=false` is a real thing a user sets
+ * to mean "not CI", while the provider-specific vars are presence-only — none of
+ * them is ever deliberately set to a falsy string.
  */
 export function inCi(env: NodeJS.ProcessEnv = process.env): boolean {
   if (env.CI !== undefined && env.CI !== '' && env.CI !== '0' && env.CI !== 'false') return true;
-  return Boolean(
-    env.GITHUB_ACTIONS || env.GITLAB_CI || env.BUILDKITE || env.CIRCLECI ||
-    env.TEAMCITY_VERSION || env.JENKINS_URL || env.TF_BUILD || env.BUILD_NUMBER,
-  );
+  return CI_ENV_VARS.some((name) => name !== 'CI' && Boolean(env[name]));
 }
 
 /** Null when telemetry may run, otherwise the first gate that closed. */
```

**File**: `test/claude-hooks.test.ts` (modified, +11/-7)
```diff
@@ -7,6 +7,7 @@ import { underGraft, main, lastFileScopeHint, promptAskTimeout } from '../src/cl
 import { readStats, readSession } from '../src/claude/state.js';
 import { runSync } from '../src/claude/sync-run.js';
 import { savingsLine } from '../src/context/savings.js';
+import { CI_ENV_VARS } from '../src/telemetry/gate.js';
 import { writeStats, emptyStats, acquireLock, resolveContextDir } from '../src/claude/state.js';
 
 test('underGraft detects edits inside graft/', () => {
@@ -551,21 +552,24 @@ test('cursor-session-end force-closes THIS conversation even though its file was
 
   // Turn telemetry on against a scratch $HOME so the rollup actually queues (and
   // marks the file), the observable proof the force-close ran — not just no-throw.
-  const saved = {
-    HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE,
-    KEY: process.env.GRAFT_POSTHOG_KEY, CI: process.env.CI, DNT: process.env.DO_NOT_TRACK,
-  };
+  //
+  // EVERY CI variable has to go, not just `CI`: `inCi` is deliberately generous and
+  // also reads GITHUB_ACTIONS, GITLAB_CI and six more. Clearing `CI` alone passed on
+  // a laptop and failed on GitHub Actions, where GITHUB_ACTIONS is set — so the list
+  // comes from `CI_ENV_VARS` rather than being copied here, and cannot drift from it.
+  const scrubbed = ['HOME', 'USERPROFILE', 'GRAFT_POSTHOG_KEY', 'DO_NOT_TRACK', ...CI_ENV_VARS];
+  const saved = Object.fromEntries(scrubbed.map((k) => [k, process.env[k]]));
+  for (const k of [...CI_ENV_VARS, 'DO_NOT_TRACK']) delete process.env[k];
   process.env.HOME = home; process.env.USERPROFILE = home;
   process.env.GRAFT_POSTHOG_KEY = 'phc_test_key';
-  delete process.env.CI; delete process.env.DO_NOT_TRACK;
   process.env.CLAUDE_PROJECT_DIR = d;
   try {
     await runWithStdin(JSON.stringify({ conversation_id: 'c1' }), () => main('cursor-session-end'));
     assert.equal(readSession(d, 'c1').summarized, true, 'the just-ended conversation was rolled up');
   } finally {
     delete process.env.CLAUDE_PROJECT_DIR;
-    for (const [k, v] of Object.entries({ HOME: saved.HOME, USERPROFILE: saved.USERPROFILE, GRAFT_POSTHOG_KEY: saved.KEY, CI: saved.CI, DO_NOT_TRACK: saved.DNT }))
-      if (v === undefined) delete (process.env as any)[k]; else (process.env as any)[k] = v;
+    for (const [k, v] of Object.entries(saved))
+      if (v === undefined) delete process.env[k]; else process.env[k] = v;
   }
 });
 
```

---

### Incident Patch 10: `2f69b3f6` (2026-09-01)
**Commit Message**: fix(hosts): install Claude Code wiring in ~ too, so worktrees keep graft (#276)

A repo whose .gitignore covers *.json loses both .mcp.json and
.claude/settings.json to `git worktree add`, which checks out tracked files
only. The worktree keeps graft's .cjs shims and neither file that points at
them: no SessionStart hook, no MCP server, graft silently absent.

graft's own repair (reconcileWiring) was unreachable there — runUpkeep is
called only from the hook and the MCP server, the two missing things.

So `graft init` also writes a user-level copy under ~, which no .gitignore
reaches and Claude Code reads for every project. Hooks only in ~, not the
statusline or the Bash allowlist. tools/list advertises nothing in a repo
with no graph and no built parent, so a user-scope registration costs no
context where graft was never invited. --no-global now reaches the claude
layer from both the CLI and the wiring replay.

**File**: `src/claude/init.ts` (modified, +16/-2)
```diff
@@ -1,6 +1,8 @@
 import { mkdirSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
 import { join, dirname } from 'node:path';
+import { homedir } from 'node:os';
 import { execFileSync } from 'node:child_process';
+import { installClaudeGlobal, type GlobalWrite } from '../hosts/claude-global.js';
 import { mergeGraftSettings } from './settings-merge.js';
 import { statuslineShim, hooksShim } from './shim-template.js';
 import { skillTemplate } from './skill-template.js';
@@ -52,11 +54,16 @@ export interface InitResult {
   skill: string;
   /** the `.mcp.json` write registering the graft MCP server for Claude Code. */
   mcp: McpWrite;
+  /** the user-level writes under `~/.claude`, empty when `global: false`. */
+  global: GlobalWrite[];
   warnings: string[];
   built: boolean;
 }
 
-export function runInit(dir: string, opts: { build?: boolean; cliPath?: string; statusline?: boolean } = {}): InitResult {
+export function runInit(
+  dir: string,
+  opts: { build?: boolean; cliPath?: string; statusline?: boolean; global?: boolean; home?: string } = {},
+): InitResult {
   // Same list `--dry-run` and the picker report, so the two can't drift apart.
   const [settings, statusline, hooks, skill, mcpTarget] = claudeTargets(dir).map((t) => t.path);
 
@@ -85,6 +92,13 @@ export function runInit(dir: string, opts: { build?: boolean; cliPath?: string;
   // other hosts use (existing servers preserved; unparseable files skipped).
   const mcp = mergeJsonKey('claude', mcpTarget, 'mcpServers', serverEntry());
 
+  // The same wiring again, one level up in `~/.claude`, because everything above
+  // this line can be erased by a `.gitignore` and lost to `git worktree add`. See
+  // hosts/claude-global.ts for the failure that motivates it. Gated on the same
+  // flag `registerMcpConfigs` uses, so `--no-global` still means "nothing outside
+  // this repo".
+  const global = opts.global === false ? [] : installClaudeGlobal(opts.home ?? homedir());
+
   const built = buildGraphIfMissing(dir, opts);
-  return { settingsPath, shims: [sl, hk], skill: skillPath, mcp, warnings, built };
+  return { settingsPath, shims: [sl, hk], skill: skillPath, mcp, global, warnings, built };
 }
```

**File**: `src/claude/settings-merge.ts` (modified, +44/-8)
```diff
@@ -18,21 +18,31 @@ const ALLOW_ENTRIES = [
   'Bash(node dist/cli.js:*)',
 ];
 
-function hookCmd(arg: string): string {
-  return `node "\${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-hooks.cjs" ${arg}`;
+/** Where the repo-level install's shims sit, relative to whatever project is open. */
+const REPO_HELPERS = '${CLAUDE_PROJECT_DIR:-.}/.claude/helpers';
+
+/**
+ * `helpers` is the directory holding `graft-hooks.cjs`, and it is a parameter for
+ * one reason: the user-level install (see hosts/claude-global.ts) has to name an
+ * absolute path. A `${CLAUDE_PROJECT_DIR}` command works only where a previous
+ * `graft init` wrote a shim into that project — which is exactly the case the
+ * global copy exists to cover, so it cannot reuse the repo form.
+ */
+function hookCmd(arg: string, helpers: string = REPO_HELPERS): string {
+  return `node "${helpers}/graft-hooks.cjs" ${arg}`;
 }
-function graftBlocks(): Record<string, Json[]> {
+function graftBlocks(helpers?: string): Record<string, Json[]> {
   return {
     PostToolUse: [
-      { matcher: 'Write|Edit|MultiEdit', hooks: [{ type: 'command', command: hookCmd('post-edit'), timeout: 10000 }] },
+      { matcher: 'Write|Edit|MultiEdit', hooks: [{ type: 'command', command: hookCmd('post-edit', helpers), timeout: 10000 }] },
       // Score the usage mix and sum token savings. A graft retrieval (CLI `graft …`
       // via Bash, or the `graft_*` MCP tools) prints a `[graft] tokens saved ≈ N`
       // footer this hook sums into the session total; the same hook classifies
       // Read/Grep/Glob as source reads vs graft as graft reads, which is what feeds
       // `graft stats` and the `session_summary` graft-vs-grep ratio. Broad matcher,
       // but the handler no-ops instantly unless there is something to record, so an
       // unrelated Bash or a plain Read costs only a stdin read.
-      { matcher: 'Bash|mcp__graft__|Read|Grep|Glob', hooks: [{ type: 'command', command: hookCmd('tool-savings'), timeout: 8000 }] },
+      { matcher: 'Bash|mcp__graft__|Read|Grep|Glob', hooks: [{ type: 'command', command: hookCmd('tool-savings', helpers), timeout: 8000 }] },
     ],
     // Longer budget than the other hooks: its `graft ask` is a real query, and a
     // query now brings the graph up to date first (graph/refresh.ts) — usually
@@ -42,9 +52,9 @@ function graftBlocks(): Record<string, Json[]> {
     // this bump (8s) keeps a child that fits inside 8s. Changing the number here is
     // therefore safe on its own — but it only reaches an existing repo when someone
     // re-runs `graft init`, since that is the only caller of this function.
-    UserPromptSubmit: [{ hooks: [{ type: 'command', command: hookCmd('prompt'), timeout: 15000 }] }],
-    SessionStart: [{ hooks: [{ type: 'command', command: hookCmd('session-start'), timeout: 8000 }] }],
-    Stop: [{ hooks: [{ type: 'command', command: hookCmd('stop'), timeout: 8000 }] }],
+    UserPromptSubmit: [{ hooks: [{ type: 'command', command: hookCmd('prompt', helpers), timeout: 15000 }] }],
+    SessionStart: [{ hooks: [{ type: 'command', command: hookCmd('session-start', helpers), timeout: 8000 }] }],
+    Stop: [{ hooks: [{ type: 'command', command: hookCmd('stop', helpers), timeout: 8000 }] }],
   };
 }
 /**
@@ -141,3 +151,29 @@ export function mergeGraftSettings(
 
   return { merged, warnings };
 }
+
+/**
+ * The hook blocks alone, merged into a settings file, with the shims addressed by
+ * absolute path — `~/.claude/settings.json`, where a write reaches every project on
+ * the machine (see hosts/claude-global.ts for why that copy has to exist).
+ *
+ * Hooks only, deliberately. `mergeGraftSettings` also claims the statusline, the
+ * footer regex and a Bash allowlist, and each of those is a reasonable thing to
+ * accept for a repo you ran `graft init` in and an unreasonable thing to impose on
+ * every repo you ever open — a statusline especially, since a session allows exactly
+ * one and taking it globally would s
```

**File**: `src/cli.ts` (modified, +4/-1)
```diff
@@ -1062,7 +1062,10 @@ function wireTarget(
     for (const r of retracted) console.error(`- removed ${r.path} (${r.what}) — agent not selected`);
 
     if (wantClaude) {
-      const res = runInit(repo, { build: opts.build, cliPath, statusline: wantStatusline });
+      // `global`/`home` are threaded through alongside `statusline`: the claude layer
+      // writes under `~/.claude` now (hosts/claude-global.ts), so --no-global has to
+      // reach it or the flag would silently mean "no out-of-repo writes, except three".
+      const res = runInit(repo, { build: opts.build, cliPath, statusline: wantStatusline, global: opts.global, home });
       console.error(`✓ wrote ${res.settingsPath}`);
       for (const s of res.shims) console.error(`✓ wrote ${s}`);
       console.error(`✓ wrote ${res.skill}`);
```

**File**: `src/hosts/claude-global.ts` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+/**
+ * User-level install for Claude Code: the copy of graft's wiring that lives
+ * outside every repo.
+ *
+ * Why this exists. Everything `graft init` writes for Claude Code lands *in* the
+ * repo — `.mcp.json` and `.claude/settings.json`. A `.gitignore` is free to ignore
+ * both, and `git worktree add` checks out tracked files only, so a worktree of such
+ * a repo starts with graft's shims present and neither of the two files that *point
+ * at* them. No settings.json means no SessionStart hook; no `.mcp.json` means no
+ * tool server. graft is absent, silently, in a tree that looks correctly wired.
+ *
+ * graft already carries the repair for exactly that — `reconcileWiring` rewrites
+ * both files — and it is unreachable here: `runUpkeep` is called only from the hook
+ * and from the MCP server, which are the two things that are missing. Seeding can't
+ * help either, since it runs on the query path, which needs the server.
+ *
+ * So the fix cannot live in the repo. `~/.claude/` is not in anyone's working tree,
+ * no `.gitignore` reaches it, and Claude Code reads it for every project — worktrees
+ * included. Codex has been installed this way from the start (see ./codex-hooks.ts,
+ * whose own note says the entries "fire in every repo opened with Codex, not just
+ * this one"); Claude Code was the one host graft wired repo-only. This module closes
+ * that gap, and is a deliberate mirror of that file.
+ *
+ * The repo-level writes stay exactly as they were. A project that has its own
+ * `.mcp.json` and settings keeps using them; this is the floor underneath, not a
+ * replacement.
+ */
+import { writeFileSync, mkdirSync } from 'node:fs';
+import { dirname, join } from 'node:path';
+import { hooksShim } from '../claude/shim-template.js';
+import { claudeDistDir } from '../claude/paths.js';
+import { mergeGraftHooks } from '../claude/settings-merge.js';
+import { toPosixPath } from '../util/paths.js';
+import { readJsonObject, writeOwned, type ConfigWrite } from './config-write.js';
+import { mergeJsonKey, serverEntry } from './mcp-config.js';
+import type { PlannedWrite } from './plan.js';
+
+/** Same `{ id, path, action }` contract every other writer in this layer reports. */
+export type GlobalWrite = ConfigWrite;
+
+/** The directory the user-level shim lives in — the base every hook command names. */
+export function globalHelpersDir(home: string): string {
+  return join(home, '.claude', 'helpers');
+}
+
+/**
+ * The files a user-level install would touch — pure, no writes, so `--dry-run` and
+ * the picker can report them up front. All three are scoped 'global': they apply to
+ * every project opened with Claude Code, not just this one.
+ *
+ * `~/.claude.json` holds the *user* MCP scope — the top-level `mcpServers` map, the
+ * one `claude mcp add --scope user` writes. Not to be confused with the same file's
+ * `projects["<abs path>"].mcpServers`, which is `--scope local` and per-directory:
+ * a worktree is its own project entry there, so a local registration would miss it
+ * for precisely the same reason the repo file does.
+ */
+export function claudeGlobalTargets(home: string): PlannedWrite[] {
+  const g = (id: string, path: string, kind: PlannedWrite['kind'], what: string): PlannedWrite =>
+    ({ hostId: 'claude', id, path, scope: 'global', kind, what });
+  return [
+    g('claude-global-shim', join(globalHelpersDir(home), 'graft-hooks.cjs'), 'hook', 'hooks shim (user level)'),
+    g('claude-global-hooks', join(home, '.claude', 'settings.json'), 'hook', 'SessionStart / UserPromptSubmit / PostToolUse / Stop'),
+    g('claude-global-mcp', join(home, '.claude.json'), 'mcp', 'mcpServers.graft'),
+  ];
+}
+
+/** Merge graft's hook blocks into a settings file, preserving everything else. */
+function upsertGlobalHooks(id: string, path: string, helpers: string): GlobalWrite {
+  const loaded = readJsonObject(path);
+  if (loaded === 'unparseable') return { id, path, action: 'skipped-un
```

**File**: `src/hosts/plan.ts` (modified, +5/-1)
```diff
@@ -16,6 +16,7 @@ import { hookTargets } from './codex-hooks.js';
 import { cursorHookTargets } from './cursor-hooks.js';
 import { antigravitySkillTargets } from './antigravity.js';
 import { claudeTargets } from '../claude/init.js';
+import { claudeGlobalTargets } from './claude-global.js';
 
 /** Where a write lands. 'global' = outside the repo, affects every project. */
 export type WriteScope = 'repo' | 'global';
@@ -70,7 +71,10 @@ export function planInit(repo: string, opts: { home?: string; ids?: string[] } =
   const detected = new Set(detectHosts(probe).map((h) => h.id));
 
   const plans: HostPlan[] = [
-    { id: 'claude', name: 'Claude Code', detected: true, writes: claudeTargets(repo) },
+    // Repo writes plus the user-level copy under `~/.claude` — the picker and
+    // `--dry-run` render 'global' writes in their own section, so a user sees
+    // what lands outside the repo before agreeing to it.
+    { id: 'claude', name: 'Claude Code', detected: true, writes: [...claudeTargets(repo), ...claudeGlobalTargets(home)] },
     ...HOSTS.map((host) => ({
       id: host.id,
       name: host.name,
```

#### Recent Merged Pull Requests:
- **PR #507** (2026-09-29): feat(trail): show how many changes were suggested in graft trail pull (@anirudhkumar-nanonets)
- **PR #501** (closed): feat: record machine-local Graft usage stats (@ivanpointer)
- **PR #496** (2026-09-28): feat(telemetry): trail_pulled event for graft trail pull (@anirudhkumar-nanonets)
- **PR #495** (2026-09-28): feat(trail): finish the sign-up when a coding agent runs graft trail push (@anirudhkumar-nanonets)
- **PR #494** (2026-09-28): feat(trail): send the picked agents with the push (@anirudhkumar-nanonets)
- **PR #493** (2026-09-28): feat(trail): chunked upload, live watch and pull for all context files (@anirudhkumar-nanonets)
- **PR #488** (2026-09-30): chore(package): point repository metadata at trailhq/Graft (@ivanpointer)
- **PR #476** (closed): fix(statusline): report the workspace at a workspace root instead of 'not built' (#455) (@Souptik96)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
