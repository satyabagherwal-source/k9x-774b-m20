# Forensic Learning Record (Deep Inspection): trailhq/Graft

> **Canonical Artifact**: `07_PROJECT_LEARNING/trailhq-graft-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/trailhq/Graft](https://github.com/trailhq/Graft))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:20:24.219Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `trailhq/Graft`
- **Description**: Turbocharge Claude Code, Cursor, Codex, Gemini & every coding agent: faster, cheaper, with contextual understanding specific to your codebase.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 9606 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/app/queue.ts`
```
/**
 * The work queue.
 *
 * A webhook must be answered in seconds, and a review takes tens of them, so the
 * HTTP handler's only job is to enqueue. Two properties matter and neither comes
 * free from a bare array:
 *
 *  - **Superseding.** Five pushes to one pull request in a minute is normal, and
 *    reviewing the first four is wasted work whose comments are immediately
 *    overwritten. A queued job for the same PR is replaced, not appended.
 *  - **A ceiling.** One repository must not be able to starve every other
 *    installation, so a fixed number of workers drain the queue.
 */

export interface QueueOptions {
  concurrency?: number;
  /** Called for every failure: a job that throws must not take the process down,
   * and a silent catch would hide a broken installation forever. */
  onError?: (err: unknown, key: string) => void;
}

export class WorkQueue<T> {
  private readonly pending = new Map<string, T>();
  private readonly running = new Set<string>();
  private readonly concurrency: number;
  private readonly onError: (err: unknown, key: string) => void;
  private idle: Array<() => void> = [];

  constructor(
    private readonly run: (item: T) => Promise<void>,
    opts: QueueOptions = {},
  ) {
    this.concurrency = Math.max(1, opts.concurrency ?? 2);
    this.onError = opts.onError ?? (() => {});
  }

  /**
   * Queue work under `key`, replacing anything queued under it and not yet started.
   *
   * A job already RUNNING is left alone: cancelling mid-clone buys nothing, and
   * the newer job simply runs after it and overwrites the comment.
   */
  push(key: string, item: T): void {
    this.pending.set(key, item);
    this.pump();
  }

  get size(): number {
    return this.pending.size + this.running.size;
  }

  /** Resolves when nothing is queued or running — for tests and for shutdown. */
  async drain(): Promise<void> {
    if (this.size === 0) return;
    await new Promise<void>((resolve) => this.idle.push(resolve));
  }

  private pump(): void {
    while (this.running.size < this.concurrency) {
      const next = this.pending.entries().next();
      if (next.done) break;
      const [key, item] = next.value;
      this.pending.delete(key);
      this.running.add(key);
      void this.run(item)
        .catch((err) => this.onError(err, key))
        .finally(() => {
          this.running.delete(key);
          this.pump();
          if (this.size === 0) {
            const waiting = this.idle;
            this.idle = [];
            for (const resolve of waiting) resolve();
          }
        });
    }
  }
}

```

### Core Architecture Module: `src/app/review-worker.ts`
```
/**
 * One review, in its own process. Forked by `./review-process.ts`, never imported.
 *
 * The whole file is glue: it waits for a `start`, calls the same
 * `reviewPullRequest` the server used to call directly, and reports back. Nothing
 * about a review changes by running here — that is the point. The two dependencies
 * it cannot satisfy locally are wired to the parent instead:
 *
 *  - `token` is handed over in the start message. This process never holds the
 *    App's private key, so a hostile repository that somehow got code running here
 *    finds one repository's short-lived token and not the App's identity.
 *  - `publish` is a round trip. The page store and the webhook secret its signed
 *    URLs are keyed on live with the HTTP server, and a page is only useful to the
 *    process that will serve it.
 *
 * Deliberately no `graft` state of its own: no lock, no cache directory, no
 * telemetry. A review works on a throwaway clone in /tmp and takes its findings
 * with it when it exits.
 */
import { reviewPullRequest } from "./review.js";
import type { Fetch } from "./identity.js";
import type { FromChild, StartMessage, ToChild } from "./review-process.js";

/** Publish requests waiting on the parent, by sequence number. */
const awaiting = new Map<number, (url: string | null) => void>();
let seq = 0;

/** Fire and forget. `process.send` throws on a closed channel, and a log line is
 * not worth crashing a review over — the `disconnect` handler below has already
 * decided what a closed channel means. */
const send = (msg: FromChild): void => {
  if (!process.connected) return;
  try {
    process.send?.(msg);
  } catch {
    /* parent went away mid-review */
  }
};

/** Close the channel, or leave if it is already gone. Either way this is the end of
 * the process — see the `disconnect` handler below. */
function bye(): void {
  try {
    if (process.connected) process.disconnect?.();
    else process.exit(0);
  } catch {
    process.exit(0);
  }
}

/**
 * The last word, then close the channel.
 *
 * Sent with a callback because that callback is the flush: `done` has to be on the
 * wire before the channel closes, or the parent sees a process that exited without
 * reporting and turns a finished review into a failure.
 */
function finish(msg: FromChild): void {
  if (!process.connected) return bye();
  try {
    process.send?.(msg, () => bye());
  } catch {
    bye();
  }
}

async function run(start: StartMessage): Promise<void> {
  try {
    const result = await reviewPullRequest(start.job, {
      token: async () => start.token,
      fetch: globalThis.fetch as unknown as Fetch,
      api: start.api,
      publish: (_job, html) =>
        new Promise<string | null>((resolve) => {
          const id = (seq += 1);
          awaiting.set(id, resolve);
          send({ t: "publish", seq: id, html });
        }),
      log: (msg) => send({ t: "log", msg }),
    });
    finish({ t: "done", result });
  } catch (err) {
    // `reviewPullRequest` has already run the token through `redact`, so this
    // message is safe to put in the parent's log — which is where it is going.
    finish({ t: "failed", message: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * No parent, no point.
 *
 * A review whose channel has closed has nowhere to publish a page and nobody to
 * report to. If the server process died, nothing will SIGKILL this one either, and
 * without this it would sit in a clone for the rest of the parent's 15-minute
 * ceiling. Going now leaves the same throwaway tree behind that a SIGKILL would —
 * what it does not do is spend a quarter of an hour producing a review no one can
 * receive.
 */
process.on("disconnect", () => process.exit(0));

process.on("message", (raw) => {
  const msg = raw as ToChild;
  if (msg.t === "start") {
    void run(msg);
    return;
  }
  awaiting.get(msg.seq)?.(msg.url);
  awaiting.delete(msg.seq);
});

```

### Core Architecture Module: `src/blast/render.ts`
```
/**
 * Renderers for a {@link BlastReport}: the Mermaid+markdown comment body a CI job
 * posts, and a plain-text report for a terminal.
 *
 * The diagram is the product here — a reviewer should see which areas a change
 * reaches, and whether its tests moved, before reading a single path — so the
 * markdown leads with it and keeps every per-symbol list collapsed underneath.
 * GitHub renders Mermaid natively in comments, so there is nothing to host.
 *
 * Both sides of the diagram are drawn at the same grain: areas, not files. The
 * first version drew one box per changed file, which cannot fit a real PR (24 files
 * against a cap of ten) and told a reviewer nothing per box — `src/graph/write.ts`
 * on its own is not a unit anyone reasons about.
 */
import type { BlastReport, ChangedArea, ImpactedModule, Impacted, TestSignal } from "./blast.js";
import type { Evidence } from "../viz/assemble.js";
import { fileReader, impactedEvidence, reachTerms } from "./evidence.js";
import { MAX_REVIEWERS, mention, sinceLabel, type Owner } from "./owners.js";

/** Diagram cap. Everything past it folds into one aggregate circle carrying the
 * dropped counts, so the picture shrinks but never lies. */
const MAX_MODULE_BOXES = 5;
/** Rows in the table under the diagram. */
const MAX_TABLE_ROWS = 6;
/** Symbols listed in the one collapsed list of everything. */
const MAX_SYMBOLS_LISTED = 60;
/** Rows in the collapsed ownership table. Past this it is a `git shortlog`, not a
 * hint about who to ask. */
const MAX_OWNER_ROWS = 8;

/**
 * A quoted Mermaid label. Every line is escaped on its own and only then joined
 * with `<br/>` — escaping the joined string would eat the tag's own angle brackets
 * and render the literal text "br/" inside the node.
 */
function label(...lines: string[]): string {
  return `"${lines.map(escapeLabel).join("<br/>")}"`;
}

/** Quotes end a Mermaid label, and angle brackets would inject markup into it. */
function escapeLabel(text: string): string {
  return text.replace(/"/g, "#quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

function depthLabel(depth: number): string {
  return Number.isFinite(depth) ? `depth ${depth}` : "full closure";
}

/**
 * Node colours, taken from `graft viz`'s own palette (viewer/style.css) so the two
 * pictures of the same graph read as one thing: teal is "depends on your change"
 * (`--k-method`), grey is the overflow circle (`--edge`). One hue for one kind of
 * thing, now that the diff itself is not drawn. Fill AND text colour are set
 * explicitly, because a GitHub comment renders in either theme and a node that
 * inherits one of them is illegible in the other.
 */
const VIZ = {
  reachedFill: "#D9EDF3", reachedStroke: "#3AA7C9", reachedInk: "#0E313C",
  tailFill: "#EEF2F3", tailStroke: "#9AA4A9", tailInk: "#3A4247",
} as const;

/** The glyph carried on a changed circle. Meaning lives in the diagram's key. */
const TEST_GLYPH: Record<TestSignal, string> = { changed: "✓", stale: "⚠", none: "✗", na: "–" };

/**
 * The diagram: one circle per area that can be affected, and nothing else.
 *
 * Everything about the changed side is gone on purpose. Drawing which of your edits
 * reaches which area is a many-to-many relation, so it can only ever render as a
 * mesh — nine arrows over eleven circles at its tidiest — and the reviewer has to
 * trace lines to read it. That relation still exists in the table's "Reached from"
 * column, where a reader can look it up when they want it, so the picture is free
 * to answer the only question it is asked at a glance: what can break?
 *
 * `TB`, not `LR`: with no edges, top-bottom is what lays unconnected nodes out as a
 * row instead of a tall column.
 *
 * Returns null when there is nothing to draw — an empty diagram frame reads as a
 * broken renderer, and the caller has a sentence for "no dependents found".
 */
export function mermaidDiagram(r: BlastReport): string | null {
  const shown = r.modules.slice(0, MAX_MODULE_BOXES);
  if (shown.length === 0) return null;
  const hidden = r.modules.slice(MAX_MODULE_BOXES);

  const lines = ["flowchart TB"];
  shown.forEach((m, i) => {
    lines.push(`  A${i}((${label(m.label, plural(m.symbols.length, "symbol"))}))`);
  });
  const TAIL = "AX";
  if (hidden.length > 0) {
    const symbols = hidden.reduce((n, m) => n + m.symbols.length, 0);
    lines.push(`  ${TAIL}((${label(plural(hidden.length, "smaller area"), plural(symbols, "symbol"))}))`);
  }

  lines.push(`  classDef reached fill:${VIZ.reachedFill},stroke:${VIZ.reachedStroke},stroke-width:1.5px,color:${VIZ.reachedInk};`);
  lines.push(`  class ${shown.map((_, i) => `A${i}`).join(",")} reached;`);
  if (hidden.length > 0) {
    lines.push(`  classDef tail fill:${VIZ.tailFill},stroke:${VIZ.tailStroke},stroke-width:1px,color:${VIZ.tailInk};`);
    lines.push(`  class ${TAIL} tail;`);
  }
  return lines.join("\n");
}

/**
 * The PR-comment body: diagram, then one table, then everything else collapsed.
 *
 * `root` is the repository the report was taken in. With it, the collapsed symbol
 * list quotes the line that reaches the diff — the same line the hosted page shows,
 * from the same helper. Without it the list is unchanged, so a caller that has no
 * checkout (a test, a piped report) loses nothing but the snippet.
 */
export function markdownReport(r: BlastReport, opts: { root?: string } = {}): string {
  const out: string[] = [];
  const symbols = r.modules.reduce((n, m) => n + m.symbols.length, 0);

  out.push("### 🌱 graft blast radius");
  out.push("");
  out.push(headline(r, symbols));
  const testLine = testHeadline(r);
  if (testLine) out.push(testLine);
  // Above the diagram on purpose: it is the one line in this comment the author
  // ACTS on rather than reads, and it costs a single row before the picture.
  const tag = tagLine(r);
  if (tag) out.push(tag);

  if (symbols > 0) {
    const diagram = mermaidDiagram(r);
    if (diagram) {
      out.push("");
      out.push("```mermaid");
      out.push(diagram);
      out.push("```");
    }
    out.push("");
    out.push(...impactTable(r));
  }

  const owners = ownerSection(r);
  if (owners.length > 0) {
    out.push("");
    out.push(...owners);
  }

  out.push("");
  const reach = reachTerms(r.seeds, r.changed);
  const read = fileReader(opts.root);
  out.push(...detailSections(r, symbols, (s) => impactedEvidence(s, reach, read)));

  const caveats = caveatLines(r);
  if (caveats.length > 0) {
    out.push("");
    for (const line of caveats) out.push(line);
  }
  out.push("");
  out.push(`<sub>\`graft blast\` · ${r.basis} · ${depthLabel(r.depth)} · ${plural(r.changed.length, "changed file")}</sub>`);
  return out.join("\n") + "\n";
}

function headline(r: BlastReport, symbols: number): string {
  const areas = plural(r.areas.length, "area");
  if (symbols === 0) {
    return `**Nothing outside this diff depends on it.** ${areas} changed; no indexed dependents at ${depthLabel(r.depth)}.`;
  }
  return `**${areas} changed → ${plural(r.modules.length, "area")} can be affected.** ${plural(symbols, "dependent symbol")}, ${depthLabel(r.depth)}.`;
}

/**
 * One sentence on whether the diff brought its tests. Leads with the areas that
 * have no tests at all, since that is the only state worth a reviewer's comment.
 */
function testHeadline(r: BlastReport): string | null {
  if (r.areas.length === 0) return null;
  const none = r.areas.filter((a) => a.tests === "none");
  const stale = r.areas.filter((a) => a.tests === "stale");
  const changed = r.areas.filter((a) => a.tests === "changed");
  const parts: string[] = [];
  if (none.length > 0) parts.push(`**no test reaches ${none.map((a) => a.label).join(", ")}**`);
  if (stale.length > 0) parts.push(`${stale.map((a) => a.label).join(", ")} ${stale.length === 1 ? "has tests" : "have tests"} the diff did not touch`);
  if (changed.length > 0) parts.push(`${plural(changed.length, "area")} updated ${changed.length === 1 ? "its" : "their"} tests`);
  if (parts.length === 0) return null;
  return `Tests: ${parts.join("; ")}.`;
}

/**
 * The table replaces 31 collapsed sections that held one bullet each. One row per
 * affected area, with the nearest symbol to start reading at — a reviewer wants a
 * place to look, not an inventory.
 */
function impactTable(r: BlastReport): string[] {
  const shown = r.modules.slice(0, MAX_TABLE_ROWS);
  const hidden = r.modules.slice(MAX_TABLE_ROWS);
  const areaOf = new Map<string, string>();
  for (const a of r.areas) for (const f of a.files) areaOf.set(f, a.label);

  const rows = ["| Can be affected | Symbols | Nearest hop | Reached from |", "| --- | --: | --- | --- |"];
  for (const mod of shown) {
    const nearest = mod.symbols[0];
    const hop = nearest ? `\`${nearest.path}:${nearest.span}\` ${nearest.name} — ${nearest.relation}, depth ${nearest.depth}` : "—";
    // Two names, then a count. Six area names in one cell is what turned this
    // column into a wall wider than the rest of the table put together.
    const names = [...new Set(mod.from.map((f) => areaOf.get(f) ?? f))];
    const from = names.length === 0 ? "—"
      : names.length <= 2 ? names.join(", ")
      : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
    rows.push(`| ${mod.label} | ${mod.symbols.length} | ${hop} | ${from} |`);
  }
  if (hidden.length > 0) {
    const symbols = hidden.reduce((n, m) => n + m.symbols.length, 0);
    rows.push(`| _${plural(hidden.length, "smaller area")}_ | ${symbols} | ${hidden.slice(0, 3).map((m) => m.label).join(", ")}${hidden.length > 3 ? ", …" : ""} | see below |`);
  }
  return rows;
}

/**
 * The tag line: who to ask, and why them.
 *
 * A handle is printed only where git carried one — `mention` never invents an
 * `@`, because a guessed mention pings a stranger who has nothing to do with the
 * change. A bare name is bolded instead, so it still reads as a person.
 *
```

### Core Architecture Module: `src/claude/hooks.ts`
```
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { join, basename, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { readWiring } from './stats.js';
import { formatBlastRadius, relevantRetrieval, formatOrientation } from './format.js';
import { indexFreshness, staleBanner } from '../context/check.js';
import { patchStats, readStats, acquireLock, readSession, writeSession, resolveContextDir } from './state.js';
import { graftCliPath, claudeScriptPath } from './paths.js';
import { runUpkeep } from '../upkeep-run.js';
import { runningVersion } from '../upkeep.js';
import { flushClosedSessions, summarizeSession } from '../telemetry/sessions.js';
import { hasSavingsTally, lastAssistantTurn, lastTurnBilling } from './tally.js';
import { scopeOf, scopesOfGraph } from '../graph/scopes.js';
import { classifyToolUse, isMcpToolName, isGraftMcpTool, parseSavings, recordToolUse, type ToolKind } from './session-metrics.js';
import { readLink } from '../brain/link.js';
import { pickedAgents } from '../brain/push.js';
import { readTrailSnapshot, trailContextLine } from '../brain/watch-trail.js';
import { maybeAutopush, readTrailPushState, recordSeenSuggestions, type AutopushDeps } from '../brain/autopush.js';

/** Prompts shorter than this never trigger retrieval — they are almost always
 * conversational ("yes go ahead", "thanks") and the coverage gate can't judge
 * them reliably with so few terms. */
const MIN_PROMPT_CHARS = 12;

function readStdin(): any {
  const seam = process.env.GRAFT_TEST_STDIN;
  const raw = seam !== undefined ? seam : safeReadFd0();
  try { return JSON.parse(raw); } catch { return {}; }
}
function safeReadFd0(): string { try { return readFileSync(0, 'utf8'); } catch { return ''; } }

function projectDir(input: any): string {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}
export function underGraft(dir: string, file: string): boolean {
  const rel = file.startsWith(dir) ? file.slice(dir.length) : file;
  return rel.replace(/^[/\\]+/, '').replace(/\\/g, '/').startsWith('graft/');
}
/** Default budget for a graft child process invoked from a hook, matching the 8s
 * the installed hook entries carry. */
const CHILD_TIMEOUT_MS = 8000;
/** Headroom left for the hook's own work (read stdin, score, write session, emit)
 * after its `graft ask` child returns. */
const HOOK_OVERHEAD_MS = 2000;
/** Floor, so a hand-edited tiny timeout can't leave the child no time at all. */
const MIN_CHILD_TIMEOUT_MS = 4000;

/**
 * How long the prompt hook may let `graft ask` run — derived from the budget that is
 * *actually installed* in this repo's `.claude/settings.json`, not from what the
 * current version of `settings-merge.ts` would install.
 *
 * A query now brings the graph up to date first, so `graft init` raises the
 * UserPromptSubmit budget to 15s to cover the one cold rebuild after an upgrade. But
 * `mergeGraftSettings` only runs during `graft init` — upgrading the npm package does
 * not re-run it. So every repo wired before that change keeps `"timeout": 8000`, and
 * hard-coding a 13s child there means Claude Code kills the hook first: `emit()` and
 * `writeSession()` never run, the turn gets no retrieval pack at all, and the SIGKILLed
 * child can't even release the build lock. Reading the installed number keeps the child
 * strictly inside whatever budget this repo really has.
 */
export function promptAskTimeout(dir: string): number {
  const installed = installedHookTimeout(dir, 'UserPromptSubmit');
  if (installed === null) return CHILD_TIMEOUT_MS - HOOK_OVERHEAD_MS;
  return Math.max(MIN_CHILD_TIMEOUT_MS, installed - HOOK_OVERHEAD_MS);
}

/**
 * Every settings file Claude Code merges hook definitions from, for a session
 * rooted at `dir`. The per-repo file is not the only place graft's hooks can be
 * installed: declaring them once at the user level wires every repo on the
 * machine at once, and such a repo has no `.claude/settings.json` at all.
 */
function hookSettingsFiles(dir: string): string[] {
  const user = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
  return [
    join(dir, '.claude', 'settings.json'),
    join(dir, '.claude', 'settings.local.json'),
    join(user, 'settings.json'),
  ];
}

/** The timeout on one settings file's graft hook entry for `event`, or null if it
 * can't be read (no settings file, hand-edited shape, unparseable JSON). */
function hookTimeoutIn(file: string, event: string): number | null {
  try {
    const settings = JSON.parse(readFileSync(file, 'utf8')) as any;
    const blocks = settings?.hooks?.[event];
    if (!Array.isArray(blocks)) return null;
    for (const block of blocks) {
      for (const h of block?.hooks ?? []) {
        if (typeof h?.command === 'string' && h.command.includes('graft-hooks.cjs') && typeof h.timeout === 'number') {
          return h.timeout;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * The budget this hook is actually running under, or null when no settings file
 * declares one.
 *
 * The smallest declared timeout wins rather than the nearest, because when more
 * than one file declares the hook Claude Code runs every matching entry and this
 * process cannot tell which one launched it. Guessing high is the expensive
 * mistake: an overrunning child gets the whole hook SIGKILLed, so `emit()` and
 * `writeSession()` never run and the turn silently gets no retrieval at all.
 * Guessing low only shortens one query.
 */
function installedHookTimeout(dir: string, event: string): number | null {
  let smallest: number | null = null;
  for (const file of hookSettingsFiles(dir)) {
    const timeout = hookTimeoutIn(file, event);
    if (timeout === null) continue;
    if (smallest === null || timeout < smallest) smallest = timeout;
  }
  return smallest;
}

/**
 * Append `--dir <contextDir>` for the hooks' own `graft ask`/`graft check`
 * children — the one place in this file that spawns the CLI itself rather
 * than reading `graft/` off disk (which already resolves through
 * `resolveContextDir` inside `util/state.ts` and `claude/stats.ts`). A no-op
 * when `GRAFT_DIR` isn't set, so an unconfigured repo's spawned CLI sees
 * byte-identical argv to before this existed.
 */
function withContextDirArg(dir: string, args: string[]): string[] {
  return process.env.GRAFT_DIR ? [...args, '--dir', resolveContextDir(dir)] : args;
}

function graftJson(dir: string, args: string[], timeout: number = CHILD_TIMEOUT_MS): any | null {
  try {
    // GRAFT_TEST_CLI is a test seam (mirrors GRAFT_TEST_STDIN/GRAFT_TEST_SYNC_RUN) so
    // tests can point the prompt hook's `graft ask`/`graft check` calls at a stub
    // script and observe the exact args it was invoked with, instead of shelling
    // out to the real CLI (which isn't built relative to the TS source under test).
    const cliPath = process.env.GRAFT_TEST_CLI ?? graftCliPath();
    const out = execFileSync(process.execPath, [cliPath, ...args],
      { cwd: dir, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(out);
  } catch (e: any) {
    // `graft check` exits non-zero when the graph is stale (by design) but still
    // prints valid JSON to stdout; recover it from the thrown error before giving up.
    if (e && typeof e.stdout === 'string' && e.stdout.trim()) {
      try { return JSON.parse(e.stdout); } catch { /* not JSON — fall through */ }
    }
    return null;
  }
}
function checkStaleCount(dir: string): number {
  const r = graftJson(dir, withContextDirArg(dir, ['check', '.', '--json']));
  const g = r?.graph ?? {};
  return (g.changed?.length ?? 0) + (g.added?.length ?? 0) + (g.removed?.length ?? 0);
}
function emit(eventName: string, additionalContext: string): void {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: eventName, additionalContext } }));
}

/**
 * The absolute path of the file a PostToolUse edit touched, across host edit-tool
 * shapes:
 *   - Claude Code (`Write`/`Edit`/`MultiEdit`) states it directly as
 *     `tool_input.file_path` (already absolute).
 *   - Codex (`apply_patch`) carries the whole patch in `tool_input.command` and
 *     names the file in the patch header (`*** Add File:` / `*** Update File:`),
 *     as a repo-relative path — resolved against `dir` here. Take the first
 *     Add/Update target; that one file is enough to mark the graph dirty and
 *     draw a blast radius (the sync re-checks the whole tree anyway).
 * Returns null when neither shape yields a path, so the hook stays a clean no-op.
 */
export function editedFilePath(input: any, dir: string): string | null {
  const direct = input?.tool_input?.file_path;
  if (typeof direct === 'string' && direct.trim()) return direct;
  const cmd = input?.tool_input?.command;
  if (typeof cmd === 'string' && cmd) {
    const m = /^\*\*\*\s+(?:Add|Update)\s+File:\s+(.+?)\s*$/m.exec(cmd);
    if (m) return isAbsolute(m[1]) ? m[1] : join(dir, m[1]);
  }
  return null;
}

async function handlePostEdit(input: any, dir: string): Promise<void> {
  const file = editedFilePath(input, dir);
  if (!file || underGraft(dir, file)) return;
  patchStats(dir, { dirty: true, staleCount: checkStaleCount(dir), lastFile: basename(file) });
  const w = readWiring(dir);
  if (w) { const br = formatBlastRadius(w, file); if (br) emit('PostToolUse', br); }
}

/**
 * The "you're working in backend/, weight it" hint: on a multi-scope repo,
 * narrow the prompt hook's `ask` call to whatever scope the last-edited file
 * (`stats.lastFile`, captured at {@link handlePostEdit}) sits in.
 *
 * `lastFile` is only a basename (not a repo-relative path — see
 * `handlePostEdit`), so this is a best-effort lookup against the CURRENT
 * graph: any file node whose path ends in `/<lastFile>` (or equals it, for a
 * repo-root file). Fails soft in every direction a hook must never crash on —
 * no graph, 
```

### Core Architecture Module: `src/claude/state.ts`
```
/**
 * Claude Code session state. The shared `graft/.cache/` pieces (the statusline's
 * `Stats` snapshot and the build lock) live in `../util/state.js` so the graph's
 * pre-query auto-refresh can take the same lock; they are re-exported here so
 * every existing import path keeps working.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cacheDir, readJson, writeJsonAtomic } from '../util/state.js';
import type { AgentHost } from '../telemetry/contract.js';

export {
  LOCK_STALE_MS,
  acquireLock,
  acquireLockIn,
  releaseLockIn,
  cacheDir,
  emptyStats,
  patchStats,
  readStats,
  releaseLock,
  resolveContextDir,
  writeJsonAtomic,
  writeStats,
} from '../util/state.js';
export type { Stats } from '../util/state.js';

export interface SessionState {
  lastQuery: string | null;
  perAgentQuery: Record<string, string>;
  graftReads: number; sourceReads: number;
  /** Cumulative tokens saved this session via `ask --source` retrieval (est.). */
  savedTokens: number;
  /** Pointers the prompt hook already injected this session (novelty gate:
   * a hit whose pointer was shown once is never re-injected). Optional so
   * session files written before this field still parse. */
  injectedPointers?: string[];
  /** Weak-match nudges spent this session, capped so the line stays signal.
   * Optional for the same backwards-compatibility reason as above. */
  nudges?: number;
  /** Turns this session in which the agent used a graft retrieval tool — the
   * denominator for "did it tell the user what that saved". Counted at Stop,
   * and only for turns whose reply we could actually read (see claude/tally.ts). */
  graftTurns?: number;
  /** Of those turns, the ones whose reply carried a "graft saved ~N tokens"
   * tally. `graftTurns - reportedTurns` is silent value: saved, never said. */
  reportedTurns?: number;
  /** Set by the tool-savings hook when the current turn touched graft, cleared
   * at Stop once the turn has been counted. Transient, not a total. */
  turnUsedGraft?: boolean;
  /** `uuid` of the last assistant reply already examined, so a Stop that fires
   * without new prose (or fires twice) can't count one reply as two turns. */
  lastTallyUuid?: string;
  /** Running micro-dollar cost of the input tokens this session has been billed
   * for, and the tokens that bought. Their ratio is the blended price of one
   * input token here — model and cache-hit ratio already folded in — which is
   * what turns `savedTokens` into a dollar figure. Stored as the pair rather
   * than the ratio so the rate re-blends as the session's cache warms rather
   * than freezing at whatever turn one happened to pay. Optional: absent on a
   * host that exposes no transcript, and on turn one of every session. */
  inputCostMicros?: number;
  inputTokensBilled?: number;
  /** `uuid` of the last assistant entry already billed, so a duplicate Stop
   * can't charge one turn twice. Separate from `lastTallyUuid` because the two
   * are sampled on different turns: the tally only on graft turns, the cost on
   * every one. */
  lastBillingUuid?: string;
  /** Set once this session has been rolled up into a `session_summary`
   * telemetry event, so a resumed or long-lived session is counted once.
   * A flag rather than deleting the file: the file still holds `lastQuery` and
   * `injectedPointers`, which a resumed session needs. */
  summarized?: boolean;
  /** Which host recorded this session, stamped on the first tool use. Lets the
   * `session_summary` be attributed correctly even when Claude Code's idle sweep
   * is what finally flushes a Cursor session. Optional: files written before
   * host-stamping (or an empty session never touched by a tool) fall back to the
   * flushing host. */
  host?: AgentHost;
}

function emptySession(): SessionState {
  return { lastQuery: null, perAgentQuery: {}, graftReads: 0, sourceReads: 0, savedTokens: 0, injectedPointers: [], nudges: 0 };
}

/** The per-repo session directory holding one `<id>.json` per agent session. */
export function sessionDir(d: string): string { return join(cacheDir(d), 'session'); }

function sessionPath(d: string, id: string): string { return join(sessionDir(d), `${id}.json`); }

/** Every session id with a file on disk, or `[]` when none exist (never throws).
 *  Shared by the telemetry rollup and `graft stats` so they agree on the set. */
export function listSessionIds(d: string): string[] {
  try {
    return readdirSync(sessionDir(d)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length));
  } catch { return []; }
}

export function readSession(d: string, id: string): SessionState {
  return readJson<SessionState>(sessionPath(d, id)) ?? emptySession();
}
export function writeSession(d: string, id: string, s: SessionState): void {
  writeJsonAtomic(sessionPath(d, id), s);
}

```

### Core Architecture Module: `src/engine.ts`
```
/**
 * The Context Graph Engine.
 *
 * Two operations, no database:
 *   - {@link Graft.init}  build `.context/` from a code repo.
 *   - {@link Graft.check} report whether `.context/` is still in
 *     sync with the code (for CI).
 *
 * The graph is a folder of linked markdown files committed to the repo; git is
 * the sync. This class wires the configured LLM provider into the build/check
 * pipelines; an API key is required for any LLM-backed operation.
 */
import { resolveConfig, type EngineConfig, type ResolvedConfig } from "./ai/providers.js";
import { ChatSynthesizer, type Synthesizer } from "./ai/synthesize.js";
import { ChatSummarizer, type Summarizer } from "./ai/summarize.js";
import { ChatCruxSummarizer, type CruxSummarizer } from "./ai/crux.js";
import { createChatModel } from "./ai/llm/factory.js";
import type { ChatModel } from "./ai/llm/types.js";
import { buildContext, CODE_EXTENSIONS, type BuildProgress, type BuildResult } from "./context/build.js";
import { checkContext, type CheckResult } from "./context/check.js";
import { buildGraph, type GraphBuildOptions, type GraphBuildResult } from "./graph/build.js";
import { checkGraph, type GraphCheckResult } from "./graph/check.js";
import { ask, type AskResult } from "./ask/ask.js";

export { CODE_EXTENSIONS };
export type { BuildResult, BuildProgress, CheckResult, GraphBuildResult, GraphCheckResult, AskResult };

export interface InitOptions {
  /** Code extensions to include. Default: {@link CODE_EXTENSIONS}. */
  extensions?: string[];
  /** Repo-relative directory prefixes to limit the concept pass (`--only-dir`). */
  onlyDirs?: string[];
  /** Progress callback for long builds. */
  onProgress?: (info: BuildProgress) => void;
}

export interface CheckRunOptions {
  extensions?: string[];
}

export interface GraphRunOptions {
  /** Run the Tier-2 LLM meaning pass (summary + crux). Absent → Tier-1 only. */
  llm?: boolean;
  /** Max files summarized in parallel during the LLM pass. */
  concurrency?: number;
  /** Replay unchanged files from the extraction cache (default true). */
  reuse?: boolean;
  /** Opt-in compiler-grade LSP edge enrichment (`graft build --lsp`). */
  lsp?: boolean;
  /** Repo-relative directory prefixes to limit the build to (`--only-dir`). */
  onlyDirs?: string[];
  onProgress?: GraphBuildOptions["onProgress"];
}

export class Graft {
  private cfg: ResolvedConfig;

  constructor(config: EngineConfig = {}) {
    this.cfg = resolveConfig(config);
  }

  /** Build the `.context/` graph from the repo at `dir`. */
  async init(dir: string, opts: InitOptions = {}): Promise<BuildResult> {
    return buildContext(dir, {
      contextDir: this.cfg.contextDir,
      extensions: opts.extensions,
      onlyDirs: opts.onlyDirs,
      model: this.modelLabel(),
      summarizer: this.summarizer(),
      synthesizer: this.synthesizer(),
      onProgress: opts.onProgress,
    });
  }

  /** Report whether the committed `.context/` markdown graph is in sync with the code. */
  check(dir: string, opts: CheckRunOptions = {}): CheckResult {
    return checkContext(dir, { contextDir: this.cfg.contextDir, extensions: opts.extensions });
  }

  /** Report whether the committed `graph.json` is in sync with the code (Tier-1 diff).
   * Async because the breadth tier warms WASM grammars before re-extraction. */
  checkGraph(dir: string): Promise<GraphCheckResult> {
    return checkGraph(dir, { contextDir: this.cfg.contextDir });
  }

  /**
   * Build `.context/graph.json` — a per-symbol code graph from tree-sitter.
   * Tier-1 (structure) always runs; the Tier-2 meaning layer runs only when
   * `opts.llm` is set. Either way the prior meaning layer is preserved.
   */
  graph(dir: string, opts: GraphRunOptions = {}): Promise<GraphBuildResult> {
    return buildGraph(dir, {
      contextDir: this.cfg.contextDir,
      summarizer: opts.llm ? this.cruxSummarizer() : undefined,
      concurrency: opts.concurrency,
      reuse: opts.reuse,
      lsp: opts.lsp,
      onlyDirs: opts.onlyDirs,
      onProgress: opts.onProgress,
    });
  }

  /**
   * Answer a plain-words query from the committed `graft/` graph — the active
   * channel. Deterministic and $0: routes structural queries to the wiring
   * edges and everything else to a lexical rank over concepts + symbols.
   */
  ask(dir: string, query: string, opts: { limit?: number; source?: boolean; full?: boolean; in?: string; graphRank?: boolean } = {}): AskResult {
    return ask(dir, query, {
      contextDir: this.cfg.contextDir,
      limit: opts.limit,
      source: opts.source,
      full: opts.full,
      in: opts.in,
      graphRank: opts.graphRank,
    });
  }

  private _chatModel?: ChatModel;

  /** The configured transport, or a clear error telling the user how to set a key. */
  private chatModel(): ChatModel {
    if (this.cfg.chatModel) return this.cfg.chatModel;
    if (this._chatModel) return this._chatModel;
    if (!this.cfg.apiKey) {
      throw new Error(
        "No API key. Set GRAFT_API_KEY (and GRAFT_PROVIDER / GRAFT_BASE_URL / GRAFT_MODEL " +
          "for your provider) to build or summarize the graph.",
      );
    }
    this._chatModel = createChatModel({
      provider: this.cfg.provider,
      apiKey: this.cfg.apiKey,
      model: this.cfg.model,
      baseUrl: this.cfg.baseUrl,
      headers: this.cfg.headers,
    });
    return this._chatModel;
  }

  private synthesizer(): Synthesizer {
    return this.cfg.synthesizer ?? new ChatSynthesizer(this.chatModel());
  }

  /** Per-node crux summarizer for the code graph's Tier-2 pass. */
  private cruxSummarizer(): CruxSummarizer {
    return this.cfg.cruxSummarizer ?? new ChatCruxSummarizer(this.chatModel());
  }

  private summarizer(): Summarizer {
    return this.cfg.summarizer ?? new ChatSummarizer(this.chatModel());
  }

  /** Human label for the active model, recorded in the manifest. */
  private modelLabel(): string {
    if (this.cfg.chatModel) return this.cfg.chatModel.label;
    if (this.cfg.synthesizer || this.cfg.summarizer || this.cfg.cruxSummarizer) return "custom";
    return `${this.cfg.provider}:${this.cfg.model}`;
  }
}

```

### Core Architecture Module: `src/hosts/codex-hooks.ts`
```
/**
 * Active-layer install for CLI agents that read user-level hooks.json with
 * PostToolUse semantics. Writes the shared hook shim and one PostToolUse
 * entry that runs post-edit + background sync after every file edit.
 */
import { writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hooksShim } from '../claude/shim-template.js';
import { claudeDistDir } from '../claude/paths.js';
import type { PlannedWrite } from './plan.js';
import { writeOwned, isGraftEntry, readJsonObject, type ConfigWrite } from './config-write.js';

function dirExists(p: string): boolean {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

/**
 * The files installing the Codex hook would touch — pure, no writes. Both live
 * under `~/.codex`, so both are scoped 'global': the hook entries fire in every
 * repo opened with Codex, not just this one. Empty when the CLI isn't installed,
 * mirroring `installCodexHooks`' early return.
 */
export function hookTargets(home: string): PlannedWrite[] {
  const base = join(home, '.codex');
  if (!dirExists(base)) return [];
  return [
    {
      hostId: 'agents', id: 'codex-hook-shim',
      path: join(base, 'hooks', 'graft', 'graft-hooks.cjs'),
      scope: 'global', kind: 'hook', what: 'post-edit hook shim',
    },
    {
      hostId: 'agents', id: 'codex-hooks',
      path: join(base, 'hooks.json'),
      scope: 'global', kind: 'hook', what: 'SessionStart / UserPromptSubmit / PostToolUse / Stop',
    },
  ];
}

/**
 * The graft hook entries Codex should carry, mirroring the Claude Code set:
 *   - SessionStart → orientation from `graft/INDEX.md`
 *   - UserPromptSubmit → the coupling-seed retrieval pack (the accuracy hook)
 *   - PostToolUse (an edit) → blast radius + mark the graph dirty
 *   - Stop → one background graph sync at turn end (not after every edit)
 * `matcher` is omitted where Codex ignores it (UserPromptSubmit, Stop). The edit
 * matcher includes `apply_patch` — Codex's native edit tool — alongside the
 * Claude Code edit-tool names, and `hooks.ts`'s `editedFilePath` reads the touched
 * file out of either shape.
 */
interface DesiredEntry { event: string; matcher?: string; sub: string; timeout: number; }
function desiredEntries(): DesiredEntry[] {
  return [
    { event: 'SessionStart', matcher: 'startup|resume|compact', sub: 'session-start', timeout: 10000 },
    { event: 'UserPromptSubmit', sub: 'prompt', timeout: 15000 },
    { event: 'PostToolUse', matcher: 'apply_patch|Write|Edit|MultiEdit', sub: 'post-edit', timeout: 10000 },
    { event: 'Stop', sub: 'stop', timeout: 10000 },
  ];
}

export function installCodexHooks(home: string): ConfigWrite[] {
  const targets = hookTargets(home);
  if (targets.length === 0) return [];

  const shimPath = targets[0].path;
  const shimWrite = writeOwned('codex-hook-shim', shimPath, hooksShim(claudeDistDir()), 0o755);
  const cfgPath = targets[1].path;
  const skipped: ConfigWrite = { id: 'codex-hooks', path: cfgPath, action: 'skipped-unparseable' };

  const loaded = readJsonObject(cfgPath);
  if (loaded === 'unparseable') return [shimWrite, skipped];
  const { root, existed } = loaded;
  const before = JSON.stringify(root);
  const hooks = (root.hooks ??= {});
  if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) return [shimWrite, skipped];

  for (const d of desiredEntries()) {
    if (hooks[d.event] !== undefined && !Array.isArray(hooks[d.event])) return [shimWrite, skipped];
    const prior: unknown[] = Array.isArray(hooks[d.event]) ? hooks[d.event] : [];
    const handler = { type: 'command', command: `node "${shimPath}" ${d.sub}`, timeout: d.timeout };
    const entry = d.matcher ? { matcher: d.matcher, hooks: [handler] } : { hooks: [handler] };
    // Preserve foreign entries in this event; replace any prior graft entry so an
    // upgrade re-points to the current shim/sub-command instead of stacking.
    hooks[d.event] = [...prior.filter((e) => !isGraftEntry(e)), entry];
  }

  if (JSON.stringify(root) === before) return [shimWrite, { id: 'codex-hooks', path: cfgPath, action: 'unchanged' }];
  writeFileSync(cfgPath, `${JSON.stringify(root, null, 2)}\n`);
  return [shimWrite, { id: 'codex-hooks', path: cfgPath, action: existed ? 'updated' : 'created' }];
}

```

### Core Architecture Module: `src/hosts/cursor-hooks.ts`
```
/**
 * Cursor project hooks (https://cursor.com/docs/hooks) — the adapter that lets
 * Cursor produce the same session usage mix Claude Code does (graft reads vs
 * Read/Grep, plus token savings), which Cursor otherwise has no way to record.
 *
 * Unlike the Codex hooks (which live under `~/.codex` and fire in every repo),
 * Cursor project hooks are **repo-local**: `.cursor/hooks.json` + a shim under
 * `.cursor/hooks/`. That matches graft's Cursor-only posture — a `--no-global`
 * init that never writes outside the repo — so these are scoped 'repo' and are
 * NOT suppressed by `--global false`; only `--no-hooks` skips them.
 *
 * The shim is the same one Claude Code and Codex use (`hooksShim`): it locates
 * the installed `@nanonets/graft` package and calls `hooks.js`' `main(argv[2])`,
 * so the sub-command in each entry (`cursor-post-tool`, `cursor-mcp`,
 * `cursor-session-end`) routes to the matching handler in `../claude/hooks.ts`.
 *
 * Events, confirmed against the Cursor hooks docs (the matcher/tool-name shape
 * is load-bearing, so it is read from the docs, not guessed):
 *   - `postToolUse` (matcher `Read|Grep|Glob|Search|Shell`) → classify a source read
 *     vs a graft-CLI Shell call; MCP tools are skipped here so they aren't
 *     double-counted against `afterMCPExecution`.
 *   - `afterMCPExecution` → the graft MCP calls, savings parsed from `result_json`.
 *   - `sessionEnd` → roll the closed session up into `session_summary` as Cursor.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hooksShim } from '../claude/shim-template.js';
import { claudeDistDir } from '../claude/paths.js';
import type { PlannedWrite } from './plan.js';
import { writeOwned, isGraftEntry, readJsonObject, type ConfigWrite } from './config-write.js';

/** The Cursor hooks.json schema version graft writes. */
const CURSOR_HOOKS_VERSION = 1;

function shimPathFor(repo: string): string {
  return join(repo, '.cursor', 'hooks', 'graft-hooks.cjs');
}
function configPathFor(repo: string): string {
  return join(repo, '.cursor', 'hooks.json');
}

/**
 * The files a Cursor-hooks install would touch — pure, no writes. Both are
 * repo-local, so both are scoped 'repo' (they fire only in this repo, matching
 * the Cursor-only, no-global init). Always returns the pair: unlike Codex there
 * is no "is the CLI installed" gate — the repo's own `.cursor/` is what we write.
 */
export function cursorHookTargets(repo: string): PlannedWrite[] {
  return [
    {
      hostId: 'cursor', id: 'cursor-hook-shim',
      path: shimPathFor(repo),
      scope: 'repo', kind: 'hook', what: 'session-scoring hook shim',
    },
    {
      hostId: 'cursor', id: 'cursor-hooks',
      path: configPathFor(repo),
      scope: 'repo', kind: 'hook', what: 'postToolUse / afterMCPExecution / sessionEnd',
    },
  ];
}

/**
 * The graft hook entries Cursor should carry. `matcher` is set only where Cursor
 * filters by tool (postToolUse); `afterMCPExecution` fires for every MCP tool and
 * `sessionEnd` for none, so they carry no matcher.
 */
interface DesiredEntry { event: string; matcher?: string; sub: string; }
function desiredEntries(): DesiredEntry[] {
  return [
    { event: 'postToolUse', matcher: 'Read|Grep|Glob|Search|Shell', sub: 'cursor-post-tool' },
    { event: 'afterMCPExecution', sub: 'cursor-mcp' },
    { event: 'sessionEnd', sub: 'cursor-session-end' },
  ];
}

/**
 * Install (or refresh) graft's Cursor project hooks in `repo`. Idempotent, and
 * conservative with a hand-edited config: an unparseable or wrong-shaped
 * `hooks.json` is left exactly as-is (reported `skipped-unparseable`) rather than
 * clobbered. Foreign hook entries are preserved; a stale graft entry is replaced
 * so an upgrade re-points to the current shim/sub-command instead of stacking.
 */
export function installCursorHooks(repo: string): ConfigWrite[] {
  const shimPath = shimPathFor(repo);
  const shimWrite = writeOwned('cursor-hook-shim', shimPath, hooksShim(claudeDistDir()), 0o755);
  const cfgPath = configPathFor(repo);
  const skipped: ConfigWrite = { id: 'cursor-hooks', path: cfgPath, action: 'skipped-unparseable' };

  const loaded = readJsonObject(cfgPath);
  if (loaded === 'unparseable') return [shimWrite, skipped];
  const { root, existed } = loaded;
  const before = JSON.stringify(root);
  if (root.version === undefined) root.version = CURSOR_HOOKS_VERSION;
  const hooks = (root.hooks ??= {});
  if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) return [shimWrite, skipped];

  for (const d of desiredEntries()) {
    if (hooks[d.event] !== undefined && !Array.isArray(hooks[d.event])) return [shimWrite, skipped];
    const prior: unknown[] = Array.isArray(hooks[d.event]) ? hooks[d.event] : [];
    const command = `node "${shimPath}" ${d.sub}`;
    const entry = d.matcher ? { matcher: d.matcher, command } : { command };
    hooks[d.event] = [...prior.filter((e) => !isGraftEntry(e)), entry];
  }

  if (JSON.stringify(root) === before) return [shimWrite, { id: 'cursor-hooks', path: cfgPath, action: 'unchanged' }];
  writeFileSync(cfgPath, `${JSON.stringify(root, null, 2)}\n`);
  return [shimWrite, { id: 'cursor-hooks', path: cfgPath, action: existed ? 'updated' : 'created' }];
}

```

### Core Architecture Module: `src/telemetry/queue.ts`
```
/**
 * The local event queue: one NDJSON line per event in `~/.graft/`.
 *
 * The queue exists because graft is a CLI, not an app. Every other tool we
 * studied sends from a process that is already running and can afford to wait;
 * `graft ask` lives for two seconds and its whole value proposition is being
 * faster than reading files. So nothing is ever sent inline — events are
 * appended here, and a detached child (`graft _telemetry-flush`, once a day)
 * does the network. A user who is offline for a week loses nothing; a user on a
 * hostile network never notices, because no command ever waits on a socket.
 *
 * Concurrency: appends are a single `appendFileSync` of one short line to a file
 * opened `O_APPEND`, which POSIX makes atomic below PIPE_BUF (4 KB — an event is
 * ~300 bytes). Two graft processes interleaving cannot produce a torn line.
 *
 * Draining renames the file first and reads the renamed copy, so events appended
 * during a flush land in a fresh queue instead of being dropped by the truncate.
 */
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';

/**
 * The ceiling on the queue. An unflushable machine — permanently offline, or a
 * key that never works — must not grow a file in someone's home forever.
 *
 * Bytes are the bound, because size is the only thing cheap enough to check on
 * every append (one `statSync`); counting lines would mean reading the whole
 * file each time. {@link TRIM_TO_EVENTS} is not a second ceiling — it is how
 * FAR a trim cuts back, so a queue of unusually small events sheds a worthwhile
 * amount rather than one line at a time. Between trims the file can hold more
 * than that many events, and can exceed the byte bound by one append.
 */
export const MAX_QUEUE_BYTES = 256 * 1024;
export const TRIM_TO_EVENTS = 500;

export function queuePath(home: string = homedir()): string {
  return join(home, '.graft', 'telemetry-queue.ndjson');
}

/**
 * Append one event. Never throws — a full disk or a read-only home must not fail
 * the command the user actually ran.
 */
export function enqueue(event: unknown, home?: string): void {
  const path = queuePath(home);
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(event) + '\n');
    trim(path);
  } catch { /* unwritable home, full disk — telemetry is never worth an error */ }
}

/**
 * Enforce the cap by dropping the OLDEST events. Newest-wins because the recent
 * ones describe the version the user is on now; a year-old queue from 0.9
 * answers nothing. Only rewrites when actually over, so the common path is one
 * `statSync`.
 */
function trim(path: string): void {
  let size: number;
  try { size = statSync(path).size; } catch { return; }
  if (size <= MAX_QUEUE_BYTES) return;
  try {
    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
    // Walk backwards from the newest, taking lines while both budgets hold, so
    // the file left behind always satisfies the byte bound — a count-only trim
    // would leave 500 large events well over it.
    const kept: string[] = [];
    let bytes = 0;
    for (let i = lines.length - 1; i >= 0 && kept.length < TRIM_TO_EVENTS; i--) {
      bytes += Buffer.byteLength(lines[i]) + 1;
      if (bytes > MAX_QUEUE_BYTES) break;
      kept.push(lines[i]);
    }
    kept.reverse();
    writeFileSync(path, kept.length ? kept.join('\n') + '\n' : '');
  } catch { /* leave it; the next drain clears it anyway */ }
}

/**
 * Take everything pending, leaving an empty queue behind.
 *
 * The rename is what makes this safe against a concurrent append: from the
 * instant it returns, other processes are writing to a brand-new file. Malformed
 * lines are skipped rather than poisoning the batch — a torn write from a crash
 * mid-append should cost one event, not the whole queue.
 */
export function drain(home?: string): unknown[] {
  const path = queuePath(home);
  const taken = `${path}.${process.pid}.sending`;
  try { renameSync(path, taken); } catch { return []; } // nothing queued
  let text = '';
  try { text = readFileSync(taken, 'utf8'); } catch { /* fall through to cleanup */ }
  try { rmSync(taken, { force: true }); } catch { /* best effort */ }
  const out: unknown[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* torn line — skip just this one */ }
  }
  return out;
}

/** Read without draining, for `graft telemetry debug`. */
export function peek(home?: string): unknown[] {
  const out: unknown[] = [];
  let text = '';
  try { text = readFileSync(queuePath(home), 'utf8'); } catch { return out; }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip */ }
  }
  return out;
}

/** Put a failed batch back, so a flush that could not reach the network does not
 *  silently discard a week of events. Oldest-first, ahead of anything queued
 *  since the drain. */
export function requeue(events: unknown[], home?: string): void {
  if (events.length === 0) return;
  const path = queuePath(home);
  try {
    const pending = (() => { try { return readFileSync(path, 'utf8'); } catch { return ''; } })();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, events.map((e) => JSON.stringify(e)).join('\n') + '\n' + pending);
    trim(path);
  } catch { /* best effort */ }
}

```

### Core Architecture Module: `src/util/id.ts`
```
import { randomUUID, createHash } from "node:crypto";

/** Generate a random unique id with a short type prefix, e.g. "node_ab12…". */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** Stable content hash (sha256, hex) used for document dedup. */
export function contentHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Normalize a name/alias for case- and whitespace-insensitive matching. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

```

### Core Architecture Module: `src/util/paths.ts`
```
/**
 * Repo-relative paths, always posix.
 *
 * Every path graft stores — node ids, `node.path`, extract-cache keys, the
 * freshness fingerprint, the card manifest — is repo-relative and separated by
 * `/` on every platform. That is not cosmetic: the query layer parses these
 * strings with `/` as the separator, and does it by hand rather than through
 * `node:path`. `pathUnderPrefix` (`--in` scoping) tests
 * `startsWith(`${prefix}/`)`, `map`'s `dirKey` splits on `/` to cluster by
 * directory, `resolveSymbol` matches a filename query with
 * `endsWith("/" + query)`. Hand any of them a `src\gate.ts` and none of them
 * error — they match nothing, silently. On Windows that made every `--in`
 * report "nothing indexed under …" and made `map` emit one single-file
 * "directory" per file.
 *
 * So normalize once, here, where a path is *created*, instead of defensively at
 * each consumer — a consumer that forgets is a silent wrong answer, and there
 * are more consumers than producers.
 *
 * {@link toPosixPath} splits on the platform `sep`, never a literal `\`: a
 * posix filename may legitimately contain a backslash, and splitting on `"\\"`
 * would corrupt it. That also makes this module provably the identity function
 * on posix, which is what guarantees an existing Mac/Linux graph is byte-identical
 * across this change.
 */
import { relative, sep } from "node:path";

/** Platform separators → `/`. Identity on posix. */
export function toPosixPath(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}

/**
 * `relative(from, to)`, normalized to posix — the canonical form of every path
 * graft stores. Use this rather than bare `relative` for anything that lands in
 * the graph, a cache key, or a manifest. Bare `relative` is still right for
 * text shown in the terminal, where a native separator is what the platform's
 * users expect.
 */
export function relPosix(from: string, to: string): string {
  return toPosixPath(relative(from, to));
}

/**
 * Trailing `/` off a repo-relative path, in linear time.
 *
 * The obvious `replace(/\/+$/, "")` is a polynomial-ReDoS shape — `\/+$` can begin
 * matching at any point inside a run of slashes, so a path ending in many slashes
 * and then anything else costs O(n²). CodeQL flags it (`js/polynomial-redos`), and
 * rightly: these inputs are a `--dir` or `--in` value rather than anything
 * attacker-controlled, but the ambiguity buys nothing and a loop is both faster
 * and plainer.
 */
export function stripTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 0 && path[end - 1] === "/") end--;
  return path.slice(0, end);
}

/**
 * Normalize a user-supplied path prefix (`--in`) so it can be compared against
 * a stored `node.path`: posix separators, no leading `./`, no trailing
 * separator. Windows users type — and their shell's tab-completion produces —
 * `--in server\src\gpu`, so both separators have to reduce to the same prefix.
 */
export function normalizePathPrefix(p: string): string {
  let out = toPosixPath(p);
  while (out.startsWith("./")) out = out.slice(2);
  // Trailing separators only; a bare "/" normalizes to "" (match everything),
  // which is exactly how `pathUnderPrefix` reads an empty prefix.
  return stripTrailingSlashes(out);
}

```

### Core Architecture Module: `src/util/source.ts`
```
import { readFileSync } from "node:fs";

/** Read source text, decoding Windows tooling's common UTF-16LE output. UTF-16BE
 * is rare and unsupported by Node's built-in decoders, so callers silently skip it. */
export function readSourceFile(path: string): string | null {
  const bytes = readFileSync(path);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2).toString("utf16le");
  return bytes.toString("utf8");
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

- **Issue #505** (2026-09-30): **fix(hosts): preserve Codex MCP transport during init**
  *Symptoms*: ## Problem  `graft init` retracted unselected hosts from machine-wide config, even though host selection is for one repo. Initializing a repo without `agents` could remove Codex's `[mcp_servers.graft]` table. The TOML remover stopped at `[mcp_servers.graft.env]`, leaving an env-only server with no `command` or `url`; Codex then rejects its config as an invalid transport.  Separately, Codex MCP registration stripped and rebuilt the parent table, replacing a user-managed `command`/`args` and dropping other options when an env subtable was present.  ## Change  - Limit routine `graft init` retraction to repo-local targets. Explicit retraction still supports machine-wide targets. - Merge the Codex MCP table in place, preserving an existing stdio or HTTP transport, arguments, options, and env values. Add `GRAFT_HARNESS_HOST` only when the stdio env is missing; repair an env-only entry by inserting its transport before the child table. - Remove Graft child TOML tables together with the parent during explicit retraction. - Isolate CLI init tests from the real home directory and add regressions for the observed invalid-transport shape and custom transport preservation.  ## Verification  - The new repo-init regression failed before the fix: a Gemini-only init deleted a pre-existing Codex MCP entry. It passes after the fix. - 63 focused host tests passed after the final changes. - Full suite passed with a temporary HOME: 1,328 passed, 0 failed. - `npm run build`, `git diff --check`, and
  **Post-Mortem & Fix Analysis**:
  > <!-- graft-blast-radius --> ### 🌱 graft blast radius  **2 areas changed → 1 area can be affected.** 1 dependent symbol, depth 2. Tests: **no test reaches CLI Target Wiring**; 1 area updated its tests. Tag: @anirudhkumar-nanonets — MCP Configuration, CLI Target Wiring · @shhdwi — 3 of 3 areas · @afeddersen — Hosts Initialization  ```mermaid flowchart TB   A0(("Hosts Initialization<br/>1 symbol"))   classDef reached fill:#D9EDF3,stroke:#3AA7C9,stroke-width:1.5px,color:#0E313C;   class A0 reached; ```  | Can be affected | Symbols | Nearest hop | Reached from | | --- | --: | --- | --- | | Hosts Initialization | 1 | `src/hosts/init.ts:L40-L98` runHostsInit — calls, depth 2 | MCP Configuration |  <details> <summary><strong>Who knows this code</strong> — 3 people across 3 areas</summary>  | Area | Who knows it | | --- | --- | | **MCP Configuration** · changed | @anirudhkumar-nanonets — 6 commits, last 19d ago · @shhdwi — 3 commits, last 2mo ago | | **CLI Target Wiring** · changed | @anirudhk
  > Closing this draft during contribution cleanup so the work can be sequenced later as a focused submission. The fork branch is preserved; no replacement PR is being opened.

- **Issue #504** (2026-09-30): **feat(graph): index Terraform and HCL sources**
  *Symptoms*: ## Summary - Index Terraform and HCL source files (`.tf`, `.hcl`) with the bundled tree-sitter Terraform grammar; no new dependency. - Emit qualified symbols for resources, data sources, variables, locals, modules, providers, outputs, and other top-level HCL blocks. - Resolve Terraform traversals as precise `references` edges across files, dropping ambiguous or external targets rather than guessing. - Exclude `.tfvars` from graph extraction and default deep context selection, even when Git tracks the file. Variable-value files often contain credentials, and `-e` does not limit the graph crux pass. An explicit sensitive-file design is needed before indexing them.  This covers native HCL syntax; Terraform's JSON configuration form (`.tf.json`) is not included.  ## Verification - Focused Terraform, extension, and context suites: 41 passed. - Full suite: 1,328 passed, 0 failed (outside the port-restricted sandbox). - `npm run build` and `git diff --check` passed. - Regression fixture confirms a tracked, ignored `.tfvars` produces neither graph nodes nor default context coverage. 
  **Post-Mortem & Fix Analysis**:
  > <!-- graft-blast-radius --> ### 🌱 graft blast radius  **2 areas changed → 6 areas can be affected.** 14 dependent symbols, depth 2. Tests: 1 area updated its tests. Tag: @anirudhkumar-nanonets — 8 of 8 areas · @shhdwi — 5 of 8 areas · @Frankie-Xu — Context Build  ```mermaid flowchart TB   A0(("Workspace Graph<br/>5 symbols"))   A1(("CLI Engine<br/>4 symbols"))   A2(("Pull Request Review<br/>2 symbols"))   A3(("Context Check<br/>1 symbol"))   A4(("Claude Hooks<br/>1 symbol"))   AX(("1 smaller area<br/>1 symbol"))   classDef reached fill:#D9EDF3,stroke:#3AA7C9,stroke-width:1.5px,color:#0E313C;   class A0,A1,A2,A3,A4 reached;   classDef tail fill:#EEF2F3,stroke:#9AA4A9,stroke-width:1px,color:#3A4247;   class AX tail; ```  | Can be affected | Symbols | Nearest hop | Reached from | | --- | --: | --- | --- | | Workspace Graph | 5 | `src/graph/build.ts:L151-L410` buildGraph — calls, depth 1 | Context Build, Graph Traversal | | CLI Engine | 4 | `src/engine.ts:L1-L161` engine.ts — imports, dep
  > Closing this during contribution cleanup so the work can be sequenced later as a focused submission. The fork branch is preserved; no replacement PR is being opened.

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

### Incident Patch 1: `8c057696` (2026-09-18)
**Commit Message**: feat(brain): hold the push until the brain is built, and land the browser on it (#422)

Three things, all on the same failure. Roughly a third of the repo brains
attempted in production die inside the miner, AFTER the push has succeeded —
and nothing on either side says so.

- `brain push` now follows the build instead of printing "watch it finish in
  your browser" and handing the prompt back. Four stages off the same row the
  browser reads, each printed once as it settles, and a failure reported at the
  stage it happened at: a repo read successfully and then lost in the miner says
  so rather than looking unreachable. Exits non-zero on a real failure, so a CI
  step hears about it. Ctrl-C detaches without cancelling; --no-watch restores
  the old fire-and-forget ending.

- The handoff's 303 now lands on Trail's build screen. It pointed at
  /brain/<id>, which redirects to the graph the instant the row exists — minutes
  before it holds a rule — so every terminal signup saw an empty visualisation
  of a brain that was building fine.

- writeLink gitignores .graft/. BrainLink's own comment has called that
  directory "git-ignored" since it was written and nothing ever made it tru

**File**: `src/brain/link.ts` (modified, +11/-1)
```diff
@@ -14,6 +14,8 @@
  */
 import { readBuildConfig, patchBuildConfig, cacheDir, readJson, writeJsonAtomic } from '../util/state.js';
 import { join } from 'node:path';
+import { ensureGitignored, LINK_NOTE } from '../context/node-file.js';
+import { BUILD_CONFIG_DIR } from '../util/state.js';
 
 /** Default API host. Overridden by GRAFT_BRAIN_URL, for staging and self-hosted. */
 const DEFAULT_BRAIN_BASE_URL = 'https://agents.nanonets.com';
@@ -83,9 +85,17 @@ export function readLink(dir: string): BrainLink | null {
   return stored;
 }
 
-/** Persist the link for repo `dir`, merging into any existing build config. */
+/** Persist the link for repo `dir`, merging into any existing build config.
+ *
+ * The write is what creates `.graft/config.json`, and that file holds the read
+ * token — which is exactly why this is also where it gets ignored. The comment
+ * on {@link BrainLink} has claimed `.graft/` was "git-ignored" since the day it
+ * was written, and nothing ever made it true: `ensureGitignored` only ever ran
+ * for the graph cache. Every repository anyone ran `graft brain connect` in was
+ * therefore one `git add -A` away from publishing a credential. */
 export function writeLink(dir: string, link: BrainLink): void {
   patchBuildConfig(dir, { brain: link });
+  ensureGitignored(dir, join(dir, BUILD_CONFIG_DIR), LINK_NOTE);
 }
 
 /** Forget the link for repo `dir`. Leaves the cached rules for `uninstall` to remove. */
```

**File**: `src/brain/signup.ts` (modified, +12/-5)
```diff
@@ -181,12 +181,19 @@ export function webBaseUrl(baseUrl?: string): string {
 
 /** Where the browser is sent once the handoff has been accepted.
  *
- * Back into Trail, at the brain it just made. The alternative — leaving the
- * person on a local page that says "go back to your terminal" — ends the flow
- * on a blank throwaway served by a port that is about to close, at exactly the
- * moment the brain starts being mined and there is something to watch. */
+ * Back into Trail, at the screen that shows the brain being built. The
+ * alternative — leaving the person on a local page that says "go back to your
+ * terminal" — ends the flow on a blank throwaway served by a port that is about
+ * to close, at exactly the moment there is something to watch.
+ *
+ * NOT `/brain/<id>`, which is where this pointed first. That route redirects to
+ * the brain's graph, and the redirect fires the instant the row exists — which
+ * is minutes before it has any rules in it. Every terminal signup therefore
+ * landed on an empty visualisation of a brain that was, at that moment, being
+ * built perfectly well. The build screen is the same wait the browser-first
+ * flow shows, and it leads to the graph once there is a graph. */
 export function brainUrl(brainId: string, baseUrl?: string): string {
-  return `${webBaseUrl(baseUrl)}/brain/${encodeURIComponent(brainId)}`;
+  return `${webBaseUrl(baseUrl)}/get-started?step=build&brain=${encodeURIComponent(brainId)}`;
 }
 
 /** Where to send the browser for a repo's brain. */
```

**File**: `src/brain/watch.ts` (added, +207/-0)
```diff
@@ -0,0 +1,207 @@
+/**
+ * Watching a brain being built, from the terminal.
+ *
+ * `graft brain push` used to end at "it is being mined into rules now — a few
+ * minutes. Watch it finish in your browser." and hand the prompt straight back.
+ * That sentence is the last thing this process ever says about the work, and it
+ * is said BEFORE the part that actually fails: of the repo brains attempted in
+ * production, roughly a third die inside the miner, after the push succeeded.
+ * The terminal has already returned by then, so on this side the failure does
+ * not exist at all — and on a CI runner or over SSH, where nobody is going to
+ * open a browser, it exists nowhere.
+ *
+ * So the push now holds the line and reports the same four stages the browser
+ * shows, off the same row. Ctrl-C detaches without cancelling anything, because
+ * the work is server-side and killing a watcher must never look like killing
+ * the build.
+ */
+import type { BrainLink } from "./link.js";
+import { baseUrlFor } from "./link.js";
+
+/** The stages, in the order they happen. The wording matches Trail's build
+ *  screen deliberately: two products describing one process differently is how
+ *  a person ends up unsure whether they are looking at the same thing. */
+export const STAGES = [
+  { id: "reach", label: "reaching the repository" },
+  { id: "read", label: "reading its history" },
+  { id: "mine", label: "mining the rules" },
+  { id: "file", label: "filing them into the brain" },
+] as const;
+
+export type StageId = (typeof STAGES)[number]["id"];
+export type StageState = "waiting" | "doing" | "done" | "failed";
+
+export interface Stage {
+  id: StageId;
+  label: string;
+  state: StageState;
+  /** A count worth printing beside a stage that has produced one. */
+  detail?: string;
+}
+
+/** The repo row, as the public endpoint returns it. Only the fields the stages
+ *  read, so a field added server-side cannot quietly change what is printed. */
+export interface RepoState {
+  status: string;
+  errorMessage?: string;
+  ruleCount: number;
+  commitCount: number;
+  threadCount: number;
+}
+
+export interface BuildView {
+  stages: Stage[];
+  done: boolean;
+  /** The server's own words, when it failed. */
+  error: string | null;
+}
+
+const num = (v: unknown): number => (typeof v === "number" && v > 0 ? v : 0);
+
+/**
+ * Which stage the work is in.
+ *
+ * The rule that matters is where a failure lands. A row that never left
+ * `pending` failed at the access check; one that read 412 commits and then died
+ * failed in the miner. Reporting both as "could not reach it" would send someone
+ * to fix repository access for a problem that has nothing to do with it.
+ */
+export function stagesFrom(repo: RepoState | null): BuildView {
+  const commits = num(repo?.commitCount);
+  const threads = num(repo?.threadCount);
+  const rules = num(repo?.ruleCount);
+
+  const reached = !!repo && repo.status !== "pending";
+  const readIt = commits > 0 || threads > 0;
+  const filed = rules > 0;
+  const failed = repo?.status === "failed";
+
+  const failedAt: StageId | null = !failed ? null : !reached || !readIt ? "reach" : !filed ? "mine" : "file";
+
+  const order = STAGES.map((s) => s.id);
+  const state = (id: StageId): StageState => {
+    if (failedAt === id) return "failed";
+    if (failedAt && order.indexOf(id) > order.indexOf(failedAt)) return "waiting";
+    switch (id) {
+      case "reach":
+        return reached ? "done" : "doing";
+      case "read":
+        return readIt ? "done" : reached ? "doing" : "waiting";
+      case "mine":
+        return filed ? "done" : readIt ? "doing" : "waiting";
+      case "file":
+        return filed ? "done" : readIt ? "doing" : "waiting";
+    }
+  };
+
+  const detail = (id: StageId): string | undefined => {
+    if (id === "read" && (commits || threads)) {
+      return [commits ? `${commits} commits` : null, threads ? `${threads} discussions` : null].filter(Boolean).join(", ");
+    }
+    if (id === "file" && rules) return `${rules} rules`;
+    return undefined;
+  };
+
+  return {
+    stages: STAGES.map((s) => ({ id: s.id, label: s.label, state: state(s.id), detail: detail(s.id) })),
+    done: repo?.status === "completed" && filed,
+    error: failed ? (repo?.errorMessage?.trim() || "the read stopped before it finished") : null,
+  };
+}
+
+/**
+ * Read the repo row this brain is building.
+ *
+ * The same endpoint `fetchExpectedRepo` uses, read for its counts rather than
+ * its slug. Null on any failure, so a watcher that cannot reach the API prints
+ * nothing new rather than inventing a failure the build did not have.
+ */
+export async function fetchRepoState(link: BrainLink, fetchImpl: typeof fetch = fetch): Promise<RepoState | null> {
+  try {
+    const res = await fetchImpl(`${baseUrlFor(link)}/api/public/brains/${encodeURIComponent(link.brainId)}/repo`, {
+      headers: { authorization: `Bearer ${link.token}`, accept: "application/json" },
+  
```

**File**: `src/cli.ts` (modified, +35/-3)
```diff
@@ -22,6 +22,7 @@ import { rulesForPointers } from "./brain/attach.js";
 import { clearLink, type BrainLink } from "./brain/link.js";
 import { buildLocalDigest, fetchExpectedRepo, pushDigest, repoSlugFromGit, sameRepo } from "./brain/push.js";
 import { readLink, writeLink } from "./brain/link.js";
+import { watchBuild } from "./brain/watch.js";
 import { openBrowser, signupUrl, startHandoff } from "./brain/signup.js";
 import { contextDirFor } from "./context/node-file.js";
 import { loadGraphCached } from "./graph/load.js";
@@ -1348,7 +1349,8 @@ brain
   .description("Read THIS repo on your machine and build its brain — no GitHub App, works on private repos")
   .argument("[dir]", "target repo directory", ".")
   .option("--no-approve", "leave the mined rules as drafts for review")
-  .action(async (dir: string, opts: { approve?: boolean }) => {
+  .option("--no-watch", "return as soon as the push is sent, without following the build")
+  .action(async (dir: string, opts: { approve?: boolean; watch?: boolean }) => {
     const repo = resolve(dir);
     // Resolved before the link, because an unlinked repo now signs up for a
     // brain and Trail creates that brain FOR a named repository. Without a slug
@@ -1410,8 +1412,38 @@ brain
     }
     const brainLabel = expected?.brainName ? `“${expected.brainName}”` : link.brainId;
     console.error(`✓ sent ${d.owner}/${d.name} to ${brainLabel}`);
-    console.error("· it is being mined into rules now — a few minutes. Watch it finish in your browser.");
-    console.error("  The rules reach this repo on their own; nothing else to run.");
+
+    // Held rather than handed back. Everything above this line succeeded even
+    // in the runs that end badly: the push lands, and then the miner fails —
+    // which is where roughly a third of production's repo brains die. Returning
+    // the prompt here is what made that invisible from this side, on CI and
+    // over SSH permanently so. `--no-watch` is for a caller that genuinely
+    // wants fire-and-forget, and it prints the old two lines instead.
+    if (opts.watch === false) {
+      console.error("· it is being mined into rules now — a few minutes. Watch it finish in your browser.");
+      console.error("  The rules reach this repo on their own; nothing else to run.");
+      return;
+    }
+
+    console.error("· building the brain — Ctrl-C detaches, it keeps going without you");
+    const outcome = await watchBuild(link);
+    if (outcome === "completed") {
+      console.error("✓ the brain is built — its rules reach this repo on their own; nothing else to run");
+      return;
+    }
+    if (outcome === "failed") {
+      // A non-zero exit, unlike every other ending here: this is the one case
+      // where the work did not produce a brain, and a CI step that ran the push
+      // should hear about it the way it hears about any other failure.
+      console.error("  Nothing was lost — the brain is still there. Run `graft brain push` again to retry the read.");
+      process.exitCode = 1;
+      return;
+    }
+    if (outcome === "unreachable") {
+      console.error("· could not reach Trail to follow the build — it is still running. Watch it finish in your browser.");
+      return;
+    }
+    console.error("· still building after 15 minutes — it has not failed, it is just long. Watch it finish in your browser.");
   });
 
 brain
```

**File**: `src/context/node-file.ts` (modified, +8/-2)
```diff
@@ -120,7 +120,13 @@ export function contextDirFor(root: string, override?: string): string {
  * expressed as a repo-relative ignore). Best-effort: an unwritable `.gitignore`
  * must never abort a build, so write failures are swallowed.
  */
-export function ensureGitignored(root: string, contextDir: string): void {
+const GRAPH_CACHE_NOTE = "graft's local graph cache — regenerable, not committed (run `graft build`).";
+
+/** Why `.graft/` is ignored, which is a different reason: not that it is cheap
+ *  to regenerate, but that it holds a token. */
+export const LINK_NOTE = "graft's brain link — holds a read token, never commit it.";
+
+export function ensureGitignored(root: string, contextDir: string, note = GRAPH_CACHE_NOTE): void {
   if (envTruthy("GRAFT_NO_GITIGNORE")) return;
   const rel = relPosix(root, contextDir);
   if (rel === "" || rel.startsWith("..")) return; // dir is at/above the repo root — nothing sane to ignore
@@ -141,7 +147,7 @@ export function ensureGitignored(root: string, contextDir: string): void {
   });
   if (present) return;
   const gap = current === "" ? "" : current.endsWith("\n") ? "\n" : "\n\n";
-  const block = `${gap}# graft's local graph cache — regenerable, not committed (run \`graft build\`).\n${entry}\n`;
+  const block = `${gap}# ${note}\n${entry}\n`;
   try { writeFileSync(path, current + block); } catch { /* best-effort — build already succeeded */ }
 }
 
```

**File**: `test/brain-signup.test.ts` (modified, +7/-2)
```diff
@@ -94,7 +94,12 @@ test("signup url: GRAFT_BRAIN_URL points signup at staging too", () => {
 // The browser's last stop is Trail, not a local page that is about to stop
 // answering. Ending on "go back to your terminal" wasted the one moment the
 // brain is actually being built and there is something on screen worth seeing.
-test('the accepted handoff sends the browser back into Trail, at its new brain', async () => {
+//
+// And specifically the BUILD screen, not `/brain/<id>`, which is where this went
+// first: that route redirects to the brain's graph the instant the row exists,
+// which is minutes before it holds a single rule. So every terminal signup was
+// landing on an empty visualisation of a brain that was building perfectly well.
+test('the accepted handoff sends the browser to the build screen, not an empty graph', async () => {
   process.env.GRAFT_BRAIN_URL = 'http://localhost:5173';
   const handoff = await startHandoff();
   try {
@@ -103,7 +108,7 @@ test('the accepted handoff sends the browser back into Trail, at its new brain',
       { redirect: 'manual' },
     );
     assert.equal(res.status, 303);
-    assert.equal(res.headers.get('location'), 'http://localhost:5173/brain/abc-123');
+    assert.equal(res.headers.get('location'), 'http://localhost:5173/get-started?step=build&brain=abc-123');
     const got = await handoff.wait(1000);
     assert.deepEqual(got, { link: { brainId: 'abc-123', token: 'gbt_1.xyz' } });
   } finally {
```

**File**: `test/brain-watch.test.ts` (added, +153/-0)
```diff
@@ -0,0 +1,153 @@
+/**
+ * The push now holds the line instead of handing the prompt back, so what is
+ * worth testing is the thing that made holding worthwhile: that a build which
+ * dies is reported, and reported at the stage it actually died at.
+ */
+import { test } from 'node:test';
+import assert from 'node:assert/strict';
+import { linesFor, stagesFrom, watchBuild, type RepoState } from '../src/brain/watch.js';
+import { brainUrl } from '../src/brain/signup.js';
+
+const row = (over: Partial<RepoState> = {}): RepoState => ({
+  status: 'ingesting',
+  ruleCount: 0,
+  commitCount: 0,
+  threadCount: 0,
+  ...over,
+});
+
+const stateOf = (repo: RepoState | null, id: string) => stagesFrom(repo).stages.find((s) => s.id === id)?.state;
+
+// --- where a failure lands ---------------------------------------------------
+
+// The one that matters. A repo read successfully and then lost in the miner
+// must not report itself as unreachable: that sends someone to fix repository
+// access for a problem that has nothing to do with access.
+test('a build that read the history and then died fails at the miner, not the access check', () => {
+  const repo = row({
+    status: 'failed',
+    commitCount: 412,
+    threadCount: 89,
+    errorMessage: 'mine repository history: parse response: unexpected end of JSON input',
+  });
+  assert.equal(stateOf(repo, 'reach'), 'done');
+  assert.equal(stateOf(repo, 'read'), 'done');
+  assert.equal(stateOf(repo, 'mine'), 'failed');
+  assert.match(stagesFrom(repo).error ?? '', /unexpected end of JSON input/);
+});
+
+test('a build that never read anything fails at the access check', () => {
+  const repo = row({ status: 'failed', errorMessage: 'repo not accessible' });
+  assert.equal(stateOf(repo, 'reach'), 'failed');
+  assert.equal(stateOf(repo, 'mine'), 'waiting');
+});
+
+test('no stage after the failed one is left looking live', () => {
+  const view = stagesFrom(row({ status: 'failed', commitCount: 10 }));
+  const at = view.stages.findIndex((s) => s.state === 'failed');
+  assert.ok(at >= 0);
+  for (const s of view.stages.slice(at + 1)) assert.equal(s.state, 'waiting');
+});
+
+test('a failure with no message still says something', () => {
+  assert.equal(stagesFrom(row({ status: 'failed' })).error, 'the read stopped before it finished');
+});
+
+test('done means the rules are in the brain, not just that the row closed', () => {
+  assert.equal(stagesFrom(row({ status: 'completed', commitCount: 412, ruleCount: 0 })).done, false);
+  assert.equal(stagesFrom(row({ status: 'completed', commitCount: 412, ruleCount: 42 })).done, true);
+});
+
+// --- what gets printed -------------------------------------------------------
+
+// This is a log, not a redrawn frame: a line per poll for a stage that is merely
+// still running would bury the four that matter under a hundred that do not.
+test('only settled stages print, and each prints once', () => {
+  const printed = new Set<string>();
+  const first = linesFor(stagesFrom(row({ commitCount: 412, threadCount: 89 })), printed);
+  assert.equal(first.length, 2, 'reach and read have settled; mine and file have not');
+  assert.match(first[1], /412 commits, 89 discussions/);
+  assert.deepEqual(linesFor(stagesFrom(row({ commitCount: 412, threadCount: 89 })), printed), [], 'nothing reprints');
+  const later = linesFor(stagesFrom(row({ status: 'completed', commitCount: 412, threadCount: 89, ruleCount: 42 })), printed);
+  assert.equal(later.length, 2, 'mine and file settle later and print then');
+  assert.match(later.join('\n'), /42 rules/);
+});
+
+// --- the watcher ------------------------------------------------------------
+
+/** A fetch that answers with each row in turn, then repeats the last. */
+function fetchSeries(rows: (Record<string, unknown> | null)[]): typeof fetch {
+  let i = 0;
+  return (async () => {
+    const repo = rows[Math.min(i++, rows.length - 1)];
+    return { ok: true, json: async () => ({ repo }) } as unknown as Response;
+  }) as unknown as typeof fetch;
+}
+
+const LINK = { brainId: '8f2a1c04-0000-0000-0000-000000000000', token: 'gbt_1.sig' };
+const NOW = { timeoutMs: 60_000, pollMs: 0, sleep: async () => {} };
+
+test('the watcher holds until the brain is built', async () => {
+  const lines: string[] = [];
+  const outcome = await watchBuild(LINK, {
+    ...NOW,
+    write: (l) => lines.push(l),
+    fetchImpl: fetchSeries([
+      { status: 'pending', rule_count: 0, commit_count: 0, thread_count: 0 },
+      { status: 'ingesting', rule_count: 0, commit_count: 412, thread_count: 89 },
+      { status: 'completed', rule_count: 42, commit_count: 412, thread_count: 89 },
+    ]),
+  });
+  assert.equal(outcome, 'completed');
+  assert.match(lines.join('\n'), /reaching the repository/);
+  assert.match(lines.join('\n'), /42 rules/);
+});
+
+test('the watcher reports a failure rather than waiting out the clock', async () => {
+  const lines: string[] = [];
+  const outcome = await watchBuil
```

---

### Incident Patch 2: `352f0af9` (2026-09-17)
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
+  assert.equal(runShim(root, join(root, 'nowhere'), join(root, 'project')), '99.0.0');
+});
```

---

### Incident Patch 3: `1e352a3f` (2026-09-16)
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

### Incident Patch 4: `398b5c6a` (2026-09-16)
**Commit Message**: feat(brain): get a repo its brain from the terminal, via a loopback handoff

**File**: `src/brain/signup.ts` (added, +183/-0)
```diff
@@ -0,0 +1,183 @@
+/**
+ * Getting a brain without leaving the terminal.
+ *
+ * Until now a brain could only begin in the browser. You signed up on Trail, it
+ * created the brain, and handed you a `graft init --brain <id>:<token>` line to
+ * paste. That is the right way round when the website is where you already are,
+ * and the wrong way round when you are standing in a repository with graft
+ * already installed — which is where most people meet graft first.
+ *
+ * So `graft brain push` on an unlinked repo starts here instead of stopping.
+ * Graft opens a listener on loopback, sends the browser to Trail carrying the
+ * repository it is standing in and the port to answer on, and waits. Trail does
+ * the signing up, makes a brain for that repository, and redirects back to the
+ * listener with the brain id and its read token. The push then carries on as if
+ * the repo had been linked all along.
+ *
+ * Two things keep that safe. The listener binds to 127.0.0.1, so nothing off
+ * this machine can reach it. And it accepts only a handoff echoing the random
+ * state it just generated, so some other page the user happens to have open
+ * cannot push a brain of its own choosing into their repository.
+ */
+import { spawn } from "node:child_process";
+import { createServer, type Server } from "node:http";
+import { randomBytes, timingSafeEqual } from "node:crypto";
+import type { AddressInfo } from "node:net";
+import type { BrainLink } from "./link.js";
+
+/** Default web host. Overridden by GRAFT_BRAIN_URL, for staging and self-hosted. */
+const DEFAULT_WEB_BASE_URL = "https://agents.nanonets.com";
+
+/** How long the listener waits for the browser before giving up. A signup can
+ * involve reading an email, so this is minutes rather than seconds. */
+export const HANDOFF_TIMEOUT_MS = 5 * 60 * 1000;
+
+/** The one path the listener answers on. */
+export const CALLBACK_PATH = "/graft/callback";
+
+/** What the browser sends back, or why it could not be accepted. */
+export type HandoffResult = { link: BrainLink } | { error: string };
+
+export interface Handoff {
+  /** The loopback port Trail must redirect to. */
+  port: number;
+  /** The nonce Trail must echo back. */
+  state: string;
+  /** Resolves once the browser answers, or when `timeoutMs` passes. */
+  wait(timeoutMs?: number): Promise<HandoffResult>;
+  /** Stop listening. Safe to call more than once. */
+  close(): void;
+}
+
+/** Constant-time compare of two states, length included. */
+function sameState(got: string, want: string): boolean {
+  const a = Buffer.from(got);
+  const b = Buffer.from(want);
+  if (a.length !== b.length) return false;
+  return timingSafeEqual(a, b);
+}
+
+/** The page the user is left looking at. Deliberately plain: it exists to say
+ * "go back to your terminal", and it is served from a throwaway port that is
+ * about to close, so there is nothing to style around. */
+function donePage(ok: boolean): string {
+  const msg = ok
+    ? "Your brain is connected. Return to your terminal — the push is already running."
+    : "That handoff did not match this terminal. Run `graft brain push` again.";
+  return `<!doctype html><meta charset="utf-8"><title>graft</title><body style="font:15px/1.5 system-ui,sans-serif;margin:3rem auto;max-width:32rem;color:#1F2129"><p>${msg}</p><p style="color:#676767">You can close this tab.</p>`;
+}
+
+/**
+ * Start listening for the browser's handoff.
+ *
+ * Port 0 so the OS picks a free one: a fixed port would collide with whatever
+ * else the developer is running, and a second graft in another terminal.
+ */
+export async function startHandoff(): Promise<Handoff> {
+  const state = randomBytes(24).toString("base64url");
+
+  let settle: (r: HandoffResult) => void = () => {};
+  const answered = new Promise<HandoffResult>((resolve) => {
+    settle = resolve;
+  });
+
+  const server: Server = createServer((req, res) => {
+    const url = new URL(req.url ?? "/", "http://127.0.0.1");
+    if (url.pathname !== CALLBACK_PATH) {
+      res.writeHead(404, { "content-type": "text/plain" });
+      res.end("not found");
+      return;
+    }
+
+    // Checked before anything is read out of the query, so a mismatched handoff
+    // never reaches the link-writing path at all.
+    if (!sameState(url.searchParams.get("state") ?? "", state)) {
+      res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
+      res.end(donePage(false));
+      return;
+    }
+
+    const brainId = (url.searchParams.get("brain") ?? "").trim();
+    const token = (url.searchParams.get("token") ?? "").trim();
+    if (!brainId || !token) {
+      res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
+      res.end(donePage(false));
+      settle({ error: "the browser came back without a brain id and token" });
+      return;
+    }
+
+    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
+    res.end(donePage(true));
+    // No `baseUrl` stored, matching `conne
```

**File**: `src/cli.ts` (modified, +58/-6)
```diff
@@ -21,7 +21,8 @@ import { parseBrainArg, connectBrain, pullBrain, brainStatus } from "./brain/con
 import { rulesForPointers } from "./brain/attach.js";
 import { clearLink, type BrainLink } from "./brain/link.js";
 import { buildLocalDigest, fetchExpectedRepo, pushDigest, repoSlugFromGit, sameRepo } from "./brain/push.js";
-import { readLink } from "./brain/link.js";
+import { readLink, writeLink } from "./brain/link.js";
+import { openBrowser, signupUrl, startHandoff } from "./brain/signup.js";
 import { contextDirFor } from "./context/node-file.js";
 import { loadGraphCached } from "./graph/load.js";
 import { ensureFreshChildren, ensureFreshGraph, refreshNote } from "./graph/refresh.js";
@@ -1239,6 +1240,45 @@ const brain = program
   .command("brain")
   .description("The Trail brain attached to this repo: the rules mined from its own history");
 
+/**
+ * Get this repo a brain from the terminal, by sending the user through signup
+ * in their browser and catching the handoff on loopback.
+ *
+ * Returns the link, already saved, or null when the user should be left alone —
+ * every failure prints its own reason first, because the caller only needs to
+ * know whether to carry on.
+ */
+async function signUpForBrain(repo: string, slug: string): Promise<BrainLink | null> {
+  const handoff = await startHandoff();
+  const url = signupUrl({ repo: slug, port: handoff.port, state: handoff.state });
+
+  // Printed before the browser opens, and printed whether or not it opens: on a
+  // remote shell nothing can open, and on a desktop the window sometimes lands
+  // behind the terminal. The URL is the thing that always works.
+  console.error(`· ${slug} has no brain yet. Opening your browser to make one:`);
+  console.error(`  ${url}`);
+
+  // A non-interactive shell has nobody to click anything, so waiting five
+  // minutes for a browser that will never come is worse than saying so now.
+  if (!process.stderr.isTTY) {
+    console.error("· not a terminal — open that link, then run `graft brain connect <brainId>:<token>` here");
+    handoff.close();
+    return null;
+  }
+
+  openBrowser(url);
+  console.error("· waiting for you to finish signing up…");
+
+  const got = await handoff.wait();
+  if ("error" in got) {
+    console.error(`✗ ${got.error}`);
+    return null;
+  }
+  writeLink(repo, got.link);
+  console.error(`✓ brain connected to ${slug}`);
+  return got.link;
+}
+
 brain
   .command("connect")
   .description("Attach a brain to this repo and pull its rules")
@@ -1296,17 +1336,29 @@ brain
   .option("--no-approve", "leave the mined rules as drafts for review")
   .action(async (dir: string, opts: { approve?: boolean }) => {
     const repo = resolve(dir);
-    const link = readLink(repo);
+    // Resolved before the link, because an unlinked repo now signs up for a
+    // brain and Trail creates that brain FOR a named repository. Without a slug
+    // there is nothing to name it after — and the digest builder would fail on
+    // the same missing remote a moment later regardless.
+    const here = repoSlugFromGit(repo);
+    let link = readLink(repo);
     if (!link) {
-      console.error("· no brain attached — run `graft brain connect <brainId>:<token>` first");
-      process.exitCode = 1;
-      return;
+      if (!here) {
+        console.error("✗ this directory has no GitHub `origin` remote — graft can only push a GitHub repository today");
+        process.exitCode = 1;
+        return;
+      }
+      const signedUp = await signUpForBrain(repo, `${here.owner}/${here.name}`);
+      if (!signedUp) {
+        process.exitCode = 1;
+        return;
+      }
+      link = signedUp;
     }
     // What the website said this brain is for. Checked BEFORE any reading, so
     // standing in the wrong checkout costs a message rather than a brain full
     // of another repository's rules — a mistake that is silent afterwards,
     // because the rules look perfectly plausible, just not about your code.
-    const here = repoSlugFromGit(repo);
     const expected = await fetchExpectedRepo(link);
     if (expected && here && !sameRepo(expected.slug, `${here.owner}/${here.name}`)) {
       console.error(`✗ this brain is for ${expected.slug}, but you are in ${here.owner}/${here.name}`);
```

**File**: `test/brain-signup.test.ts` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+/**
+ * The terminal half of signing up for a brain.
+ *
+ * Two of these are security-relevant rather than merely correct. The listener
+ * must refuse a handoff that does not echo the state it generated, because it
+ * is an open port on the developer's machine and any page they have open can
+ * reach loopback. And it must bind to loopback only, so the handoff is not
+ * offered to the network the laptop is sitting on.
+ */
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { CALLBACK_PATH, signupUrl, startHandoff } from "../src/brain/signup.js";
+
+/** Drive the callback the way the browser would. */
+async function callback(port: number, q: Record<string, string>): Promise<number> {
+  const url = `http://127.0.0.1:${port}${CALLBACK_PATH}?${new URLSearchParams(q).toString()}`;
+  const res = await fetch(url);
+  await res.text();
+  return res.status;
+}
+
+test("handoff: the browser's answer becomes the link", async () => {
+  const h = await startHandoff();
+  const waiting = h.wait(5000);
+
+  const status = await callback(h.port, { state: h.state, brain: "brain-123", token: "gbt_1.abc" });
+  assert.equal(status, 200);
+
+  const got = await waiting;
+  assert.deepEqual(got, { link: { brainId: "brain-123", token: "gbt_1.abc" } });
+});
+
+test("handoff: a wrong state is refused and never settles the wait", async () => {
+  const h = await startHandoff();
+  const waiting = h.wait(300);
+
+  const status = await callback(h.port, { state: "not-the-state", brain: "brain-123", token: "gbt_1.abc" });
+  assert.equal(status, 400, "a mismatched state is rejected outright");
+
+  const got = await waiting;
+  assert.ok("error" in got, "the push must not proceed on a handoff it did not ask for");
+});
+
+test("handoff: the right state without a brain and token is an error, not a link", async () => {
+  const h = await startHandoff();
+  const waiting = h.wait(5000);
+
+  const status = await callback(h.port, { state: h.state, brain: "", token: "" });
+  assert.equal(status, 400);
+
+  const got = await waiting;
+  assert.ok("error" in got);
+});
+
+test("handoff: anything but the callback path is a 404", async () => {
+  const h = await startHandoff();
+  const res = await fetch(`http://127.0.0.1:${h.port}/`);
+  await res.text();
+  assert.equal(res.status, 404);
+  h.close();
+});
+
+test("handoff: the wait gives up rather than hanging forever", async () => {
+  const h = await startHandoff();
+  const got = await h.wait(150);
+  assert.ok("error" in got);
+  assert.match((got as { error: string }).error, /timed out/);
+});
+
+test("signup url: carries the repo, the port and the state", () => {
+  const url = new URL(signupUrl({ repo: "NanoNets/Graft", port: 51234, state: "s-t-a-t-e" }));
+  assert.equal(url.origin, "https://agents.nanonets.com");
+  assert.equal(url.pathname, "/get-started");
+  assert.equal(url.searchParams.get("graft_repo"), "NanoNets/Graft");
+  assert.equal(url.searchParams.get("graft_port"), "51234");
+  assert.equal(url.searchParams.get("graft_state"), "s-t-a-t-e");
+  assert.equal(url.searchParams.get("step"), "repo");
+});
+
+test("signup url: GRAFT_BRAIN_URL points signup at staging too", () => {
+  const before = process.env.GRAFT_BRAIN_URL;
+  process.env.GRAFT_BRAIN_URL = "https://staging-agents.nanonets.com/";
+  try {
+    const url = new URL(signupUrl({ repo: "a/b", port: 1, state: "s" }));
+    assert.equal(url.origin, "https://staging-agents.nanonets.com", "a trailing slash must not double up");
+  } finally {
+    if (before === undefined) delete process.env.GRAFT_BRAIN_URL;
+    else process.env.GRAFT_BRAIN_URL = before;
+  }
+});
```

---

### Incident Patch 5: `f9e65396` (2026-09-10)
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

### Incident Patch 6: `eab028ff` (2026-09-10)
**Commit Message**: build: cache the install layer so a deploy is a compile, not a reinstall

**File**: `.dockerignore` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+# The build context is sent to the daemon before anything runs, so everything
+# here is time paid on every single build.
+.git
+node_modules
+dist
+viewer/dist
+data
+graft
+.claude
+*.log
```

**File**: `Dockerfile` (modified, +16/-4)
```diff
@@ -6,9 +6,16 @@
 #
 # Two constraints shape the stages, and both were found the hard way:
 #
-#  - `npm ci` runs this package's `prepare` script, which IS the build. So the
-#    sources have to be present before the install, not after it — a manifests-
-#    only copy fails with "The specified path does not exist: 'tsconfig.json'".
+#  - `npm ci` runs this package's `prepare` script, which IS the build, so a
+#    manifests-only copy fails with "The specified path does not exist:
+#    'tsconfig.json'". Copying the sources first fixes that and costs a full
+#    reinstall on every source change — nine tree-sitter grammars rebuilt from
+#    source through node-gyp, minutes of it, on a one-line edit. So the install
+#    layer drops OUR prepare (npm pkg delete) and keeps every dependency's own
+#    install script, which is what compiles those grammars. Then the sources
+#    arrive, restoring the real package.json, and the build runs explicitly.
+#    Unchanged dependencies now mean a cached install and a deploy that is just
+#    a tsc.
 #  - The runtime cannot reinstall. `npm ci --omit=dev` would run `prepare` again
 #    without tsc present, and `--ignore-scripts` would skip the native builds
 #    tree-sitter needs. So the compiled node_modules is carried over from the
@@ -22,8 +29,13 @@ WORKDIR /app
 RUN apt-get update \
     && apt-get install -y --no-install-recommends python3 make g++ \
     && rm -rf /var/lib/apt/lists/*
+COPY package.json package-lock.json ./
+# Both of this package's own lifecycle scripts want the sources, which are not
+# here yet. Dependencies' scripts are untouched — those are the node-gyp builds
+# worth caching.
+RUN npm pkg delete scripts.prepare scripts.postinstall && npm ci
 COPY . .
-RUN npm ci
+RUN node scripts/postinstall.mjs && npm run prepare
 
 # node 22, not 20: commander@15 declares `node >=22.12`, and running under 20
 # left `npm ci` warning EBADENGINE on every build. The runtime base must match
```

---

### Incident Patch 7: `270edccc` (2026-09-10)
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
+  deps: BrainBuildDeps,
+  auth: Awaited<ReturnType<typeof resolveRepoRead>>,
+  entry: string,
+  timeoutMs: number,
+): Promise<BrainBuildResult> {
+  const log = deps.log ?? ((): void => {});
+  const tag = `${job.owner}/${job.repo}`;
+  // The repository as argv makes `ps` in a container say which read each
+  // process is; the token stays out of it.
+  const child = fork(entry, [tag], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
+  track(child);
+
+  try {
+    return await new Promise<BrainBuildResult>((resolve, reject) => {
+      let settled = false;
+      const settle = (fn: () => void): void => {
+        if (settled) return;
+        settled = true;
+        clearTimeout(timer);
+        fn();
+      };
+
+      const timer = setTimeout(() => {
+        settle(() => reject(new Error(`read of ${tag} exceeded ${timeoutMs}ms and was killed`)));
+      }, timeoutMs);
+      timer.unref();
+
+      child.on("message", (raw) => {
+        const msg = raw as FromChild;
+
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
+ * holds the event loop for the whole read, and a second person pasting a URL
+ * waits behind the first. See brain-build-process.ts.
+ */
+export async function readRepository(job: BrainBuildJob, deps: BrainBuildDeps, auth: RepoReadAuth): Promise<BrainBuildResult> {
   const rawLog = deps.log ?? ((): void => {});
   const api = deps.api ?? "https://api.github.com";
   const tag = `${job.owner}/${job.repo}`;
+  const { token, cloneToken, meta } = auth;
 
   // Every line carries how long we have been at it. A read that feels slow is
-  // four things in a trench coat — the access check, the clone, the graph
-  // build, the pull-request walk — and without the elapsed time on each, the
+  // four things in a trench coat — the clone, the graph build, the
+  // pull-request walk, the digest — and without the elapsed time on each, the
   // only observation anyone can make is "it took two minutes".
   const startedAt = (deps.now ?? Date.now)();
   const log = (msg: string): void => rawLog(`[+${
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

### Incident Patch 8: `2a70cbdf` (2026-09-10)
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
+ * difference is only the rate limit, and the drop to anonymous is a factor of
+ * eighty, so it is worth two extra calls to avoid.
+ */
+async function publicReadToken(deps: BrainBuildDeps, api: string): Promise<string> {
+  if (deps.publicToken) return deps.publicToken;
+  try {
+    const id = await publicReadInstallation(
+      deps.creds,
+      deps.publicOwner ?? "trailhq",
+      deps.fetch,
+      (deps.now ?? Date.now)(),
+      api,
+    );
+    if (id === null) return "";
+    return await installationToken(deps, id, "public read", api);
+  } catch {
+    return "";
+  }
+}
+
 /** Mint an installation token, the credential every authenticated read uses. */
 async function installationToken(deps: BrainBuildDeps, installationId: number, tag: string, api: string): Promise<string> {
   const res = await deps.fetch(`${api}/app/installations/${installationId}/access_tokens`, {
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

### Incident Patch 9: `cf954d0a` (2026-09-10)
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

### Incident Patch 10: `0b5e434a` (2026-09-10)
**Commit Message**: feat(brain): two-way Trail integration — carry rules into every ask, and build a brain from a repo (#322)

* feat(brain): carry a brain's rules into every ask and every agent instruction file

* feat(app): build a repository into a brain on demand, from its own history

* docs(app): document the repo-to-brain read route and its two modes

* feat(app): return the digest when no brain token is sent, so the platform ingests it itself

* fix(app): read PR discussion — the list endpoint has no comment counts to filter on

* fix(brain): pull rules over the public token route, not the workspace-scoped one

* feat(app): tell a missing install apart from a repo the install cannot see

* feat(brain): read the repo's stated rules, and push a brain from a local clone

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -25,3 +25,6 @@ transcripts/
 # Cursor project config — written per machine by `graft init` (hooks, MCP, rule),
 # a personal setup like the Claude settings above, not a shared artifact.
 .cursor/
+
+# graft's local repository settings — not committed.
+/.graft/
```

**File**: `docs/github-app.md` (modified, +50/-0)
```diff
@@ -85,6 +85,52 @@ App settings → Install App → pick the repos. **Installing requires admin on
 repository** (or org-owner for an org-wide install) — the one thing an App does
 not get you around.
 
+## Reading a repository into a Trail brain
+
+The App has a second, optional job: reading one repository's own history so
+Trail can mine rules out of it. That is what backs "paste a repo URL" during
+brain onboarding, and it lives here because this is the only service holding the
+GitHub App credentials and the only one that can build a symbol graph.
+
+`POST /brain/build`, off unless `GRAFT_BRAIN_BUILD_SECRET` is set:
+
+```bash
+curl -X POST https://<your-host>/brain/build \
+  -H "authorization: Bearer $GRAFT_BRAIN_BUILD_SECRET" \
+  -H 'content-type: application/json' \
+  -d '{"owner":"acme","repo":"api"}'
+```
+
+It resolves the installation for `acme/api` (`GET /repos/{owner}/{repo}/installation`,
+App-JWT authed), clones it shallow, builds the graph, and reads:
+
+- **commit subjects and bodies**, `--no-merges --reverse`, up to 1000
+- **closed pull requests and their discussion**, most-discussed first, bots dropped
+- **exported symbols**, with the body hash that later tells Trail whether a rule
+  still describes the code it was mined from
+
+What comes back is a digest of that — **messages, titles, comments, symbol ids
+and hashes. No source code.** Two modes:
+
+| Request | Response |
+| --- | --- |
+| `owner` + `repo` | `202` with the digest, for the caller to ingest itself |
+| plus `brainId` + `brainToken` | the digest is POSTed to the brain; `202` with its job id |
+
+The platform uses the first: it already holds the user's session and writes to
+the brain directly, so handing this service a workspace key just to have it call
+back would mean minting a credential per build for nothing.
+
+`404` with an `error` means the App is not installed on the repository — the
+expected answer for "someone pasted a repo we cannot see", not a failure. The
+caller turns it into a choice: install the App, or run `graft init --brain`
+locally, where the code never leaves the machine.
+
+| Variable | Meaning |
+| --- | --- |
+| `GRAFT_BRAIN_BUILD_SECRET` | Bearer secret for the route. Unset disables it entirely. |
+| `GRAFT_BRAIN_URL` | Platform base URL the digest is posted to, when a `brainToken` is sent. Overrides anything a request supplies, so a caller cannot redirect a repository's history elsewhere. |
+
 ## Security
 
 The App clones code written by strangers on every fork PR while holding a token
@@ -100,6 +146,10 @@ for the base repository, so:
 - **Pages are capabilities, not public URLs.** `/p/<id>?t=<hmac>` — an unknown
   page and a bad token are both `404`, so the endpoint cannot be used to
   discover which pull requests exist. Links expire with the page they point at.
+- **`/brain/build` sends no source.** Its digest is commit messages, pull-request
+  discussion, symbol ids and hashes; the checkout is deleted in a `finally`. The
+  route is off until `GRAFT_BRAIN_BUILD_SECRET` is set, and the secret is
+  compared in constant time — it is long-lived, unlike a per-payload signature.
 
 ## What is not built yet
 
```

**File**: `src/app/brain-build.ts` (added, +262/-0)
```diff
@@ -0,0 +1,262 @@
+/**
+ * Building one repository into a brain, on demand.
+ *
+ * The whole point of the onboarding flow this serves: someone pastes a
+ * repository URL, and a minute later they are looking at rules mined from their
+ * own history. Nothing is installed and nobody has signed up yet, so this has to
+ * work from the repository name alone.
+ *
+ * Runs in the app rather than in the platform because only the app has the
+ * GitHub App credentials, only it can clone, and only graft can build a symbol
+ * graph. What crosses back to the platform is a digest of messages and symbol
+ * ids — never source.
+ */
+import { buildGraph } from "../graph/build.js";
+import { contextDirFor } from "../context/node-file.js";
+import { loadGraphCached } from "../graph/load.js";
+import { checkoutRepository } from "./checkout.js";
+import { appJwt, installationFor, repoAccessGap, type AppCredentials, type Fetch, type RepoAccessGap } from "./identity.js";
+import { buildDigest, postDigest, readCommits, readSymbols, readThreads, type RepoDigest } from "./history.js";
+import {
+  budgetSources,
+  readAgentInstructions,
+  readBranchProtection,
+  readCodeowners,
+  readCodifiedRules,
+  readDecisionDocs,
+  readDeclinedIssues,
+  readReverts,
+  readTestNames,
+  type HistorySource,
+} from "./sources.js";
+
+/** One request to build a repository into a brain. */
+export interface BrainBuildJob {
+  owner: string;
+  repo: string;
+  /** Branch to read; empty means the repository's default. */
+  ref?: string;
+  /**
+   * The brain the rules land in, and the workspace key to write it with.
+   *
+   * Both optional, and omitting them changes the mode: with them, the digest is
+   * posted straight to the brain and only a job id comes back; without them the
+   * digest is RETURNED and the caller ingests it itself.
+   *
+   * The second mode is what the platform's own proxy uses. It already holds the
+   * user's session and can write to the brain directly, so handing graft a
+   * workspace key just to have it call back would mean minting a credential per
+   * build for no gain.
+   */
+  brainId?: string;
+  brainToken?: string;
+  /** Platform base URL. Defaults to production. */
+  brainBaseUrl?: string;
+  /** File the rules as approved rather than as drafts. Onboarding sets it:
+   * a brain whose every rule is an invisible draft answers nothing. */
+  autoApprove?: boolean;
+}
+
+export interface BrainBuildResult {
+  /** Set only when the digest was posted; empty in return-the-digest mode. */
+  jobId: string;
+  headSha: string;
+  commits: number;
+  threads: number;
+  symbols: number;
+  sources: number;
+  /** Set only in return-the-digest mode. */
+  digest?: RepoDigest;
+}
+
+export interface BrainBuildDeps {
+  creds: AppCredentials;
+  fetch: Fetch;
+  api?: string;
+  githubHost?: string;
+  log?: (msg: string) => void;
+  now?: () => number;
+}
+
+/** Raised when the App cannot see the repository. Distinct because the caller
+ * turns it into a specific answer — "install the app, or run it locally" — and
+ * not into a 500. */
+export class RepoNotAccessibleError extends Error {
+  constructor(
+    message: string,
+    /** Which gap it is, so the caller can send the user to the right place. */
+    readonly gap: RepoAccessGap = { reason: "not_installed", ownerId: null, installationId: null },
+  ) {
+    super(message);
+  }
+}
+
+/**
+ * Read the repository and hand its history to the brain.
+ *
+ * Public repositories still go through the installation lookup, because the App
+ * needs a token to clone at any useful rate limit, and a repository the App is
+ * not installed on is exactly the case the UI has to distinguish.
+ */
+export async function buildRepoIntoBrain(
+  job: BrainBuildJob,
+  deps: BrainBuildDeps,
+): Promise<BrainBuildResult> {
+  const log = deps.log ?? ((): void => {});
+  const api = deps.api ?? "https://api.github.com";
+  const tag = `${job.owner}/${job.repo}`;
+
+  const installationId = await installationFor(
+    deps.creds,
+    job.owner,
+    job.repo,
+    deps.fetch,
+    (deps.now ?? Date.now)(),
+    api,
+  );
+  if (installationId === null) {
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
+
+  const tokenRes = await deps.fetch(`${api}/app/installations/${installationId}/access_tokens`, {
+    method: "POST",
+    headers: {
+      authorization: `Bearer ${appJwt(deps.creds, (deps.now ?? Date.now)())}`,
+      accept: "application/vnd.github+json",
+      "user-agent": "graft-app",
+    },
+  });
+  if (!tokenRe
```

**File**: `src/app/checkout.ts` (modified, +75/-0)
```diff
@@ -184,6 +184,81 @@ export function checkoutPullRequest(req: CheckoutRequest): Checkout {
   return { dir, base: "refs/graft/base", ref, cleanup };
 }
 
+/** What a plain-repository checkout needs: no pull request, just a ref. */
+export interface RepoCheckoutRequest {
+  owner: string;
+  repo: string;
+  /** Branch to read. Empty means "whatever HEAD points at" (the default branch). */
+  ref?: string;
+  token: string;
+  /** How much history to fetch. The default is deeper than a PR review needs
+   * because commit MESSAGES are the payload here, not a diff — 50 commits is a
+   * fortnight on an active repo and would mine almost nothing. */
+  depth?: number;
+  api?: string;
+  log?: (msg: string) => void;
+}
+
+/** A plain checkout: the tree, the commit it landed on, and the cleanup. */
+export interface RepoCheckout {
+  dir: string;
+  headSha: string;
+  /** The branch actually checked out, resolved when the caller named none. */
+  branch: string;
+  cleanup: () => void;
+}
+
+/**
+ * Clone one repository at a ref, shallow, for reading rather than reviewing.
+ *
+ * Separate from {@link checkoutPullRequest} rather than a flag on it: that
+ * function's whole shape — two refspecs, the merge/head fallback, the diff-base
+ * resolution — exists to answer "what does this pull request change", and none
+ * of it applies to "read this repository's history". Sharing the hardened `git`
+ * runner is the part worth reusing.
+ */
+export function checkoutRepository(req: RepoCheckoutRequest): RepoCheckout {
+  const host = (req.api ?? "https://github.com").replace(/\/$/, "");
+  const dir = mkdtempSync(join(tmpdir(), `graft-repo-${req.owner}-${req.repo}-`));
+  const cleanup = (): void => rmSync(dir, { recursive: true, force: true });
+  const log = req.log ?? ((): void => {});
+  const tag = `${req.owner}/${req.repo}`;
+  const fail = (step: string, err: string): never => {
+    cleanup();
+    throw new Error(`${tag}: ${step} failed: ${redact(err, req.token)}`);
+  };
+
+  const init = git(dir, ["init", "--quiet", "--initial-branch=graft-tmp"]);
+  if (!init.ok) fail("init", init.err);
+  const remote = git(dir, ["remote", "add", "origin", `${host}/${req.owner}/${req.repo}.git`]);
+  if (!remote.ok) fail("remote", remote.err);
+
+  const depth = req.depth ?? REPO_FETCH_DEPTH;
+  // A named branch is fetched by name; with none, `HEAD` resolves to whatever
+  // the remote's default branch is, which is what the caller means by "the
+  // repository" and saves an API round trip to look the name up.
+  const refspec = req.ref
+    ? `+refs/heads/${req.ref}:refs/graft/head`
+    : `+HEAD:refs/graft/head`;
+  const fetched = git(
+    dir,
+    ["fetch", "--quiet", `--depth=${depth}`, "--no-recurse-submodules", "origin", refspec],
+    req.token,
+  );
+  if (!fetched.ok) fail("fetch", fetched.err);
+
+  const co = git(dir, ["checkout", "--quiet", "--detach", "refs/graft/head"]);
+  if (!co.ok) fail("checkout", co.err);
+
+  const headSha = line(dir, ["rev-parse", "HEAD"]) ?? "";
+  const branch = req.ref ?? line(dir, ["rev-parse", "--abbrev-ref", "origin/HEAD"]) ?? "";
+  log(`${tag}: read ${req.ref || "HEAD"} at ${short(headSha)} (${depth} commits deep)`);
+  return { dir, headSha, branch: branch.replace(/^origin\//, ""), cleanup };
+}
+
+/** Default history depth for a repository read. See RepoCheckoutRequest.depth. */
+const REPO_FETCH_DEPTH = 500;
+
 /** The one fetch each attempt makes: the PR ref to review plus the base branch. */
 function fetchArgs(req: CheckoutRequest, pull: "merge" | "head", deepen = false): string[] {
   return [
```

**File**: `src/app/history.ts` (added, +367/-0)
```diff
@@ -0,0 +1,367 @@
+/**
+ * Reading a repository's history into a rule-bearing digest.
+ *
+ * What a code graph cannot tell you is why the code is the way it is. That
+ * lives in two places: commit messages, and the discussion under pull requests.
+ * This module reads both, plus the symbol ids from the graph so a rule mined
+ * out of them can be anchored to the code it governs.
+ *
+ * It deliberately sends NO source code onward. The digest is messages, titles,
+ * comments, symbol ids and hashes — nothing a reader could reconstruct a private
+ * codebase from.
+ */
+import { spawnSync } from "node:child_process";
+import type { GraphV1 } from "../graph/types.js";
+import type { Fetch } from "./identity.js";
+import type { HistorySource } from "./sources.js";
+
+/** One commit's rule-bearing content. */
+export interface HistoryCommit {
+  sha: string;
+  subject: string;
+  body: string;
+  files: string[];
+}
+
+/** One pull request's discussion. */
+export interface HistoryThread {
+  number: number;
+  title: string;
+  body: string;
+  mergeSha: string;
+  comments: Array<{ body: string; path?: string }>;
+}
+
+/** One symbol, as the brain needs it to anchor a rule. */
+export interface HistorySymbol {
+  id: string;
+  path: string;
+  name: string;
+  kind: string;
+  signature: string;
+  fingerprint: string;
+}
+
+/** The whole payload posted to the brain. */
+export interface RepoDigest {
+  provider: "github";
+  owner: string;
+  name: string;
+  head_sha: string;
+  default_branch: string;
+  is_private: boolean;
+  commits: Array<{ sha: string; subject: string; body: string; files: string[]; symbols: string[] }>;
+  threads: Array<{
+    number: number;
+    title: string;
+    body: string;
+    merge_sha: string;
+    comments: Array<{ body: string; path?: string }>;
+  }>;
+  symbols: HistorySymbol[];
+  /** Everything in the repo that is already a rule, or nearly one: instruction
+   * files, decision records, config, ownership, reverts, test names. One array
+   * rather than a field per kind, so adding a source is adding an entry. */
+  sources: HistorySource[];
+  auto_approve: boolean;
+}
+
+/** Field separators inside one `git log` record. Chosen for being bytes no
+ * commit message contains, the same trick blast/owners.ts uses. */
+const REC = "\x01";
+const FIELD = "\x02";
+
+/** Most commits read out of one repository. Above the brain's own per-ingest
+ * cap, so the trim happens here where the ordering is known. */
+const MAX_COMMITS = 1_000;
+
+/** Run git in `root`, or null when git fails. */
+function git(root: string, args: string[]): string | null {
+  const res = spawnSync("git", ["-c", "core.quotePath=false", ...args], {
+    cwd: root,
+    encoding: "utf8",
+    stdio: ["ignore", "pipe", "pipe"],
+    maxBuffer: 64 * 1024 * 1024,
+  });
+  if (res.error || res.status !== 0 || typeof res.stdout !== "string") return null;
+  return res.stdout;
+}
+
+/**
+ * Commit subjects, bodies and touched files, oldest first.
+ *
+ * `--no-merges`: a merge commit's message is "Merge pull request #N from …",
+ * which establishes nothing — the decision is in the commits it brings in, and
+ * in the thread. `--reverse` so a later reversal reads as a reversal downstream;
+ * the extraction prompt relies on that ordering.
+ */
+export function readCommits(root: string, max = MAX_COMMITS): HistoryCommit[] {
+  const fmt = `${REC}%H${FIELD}%s${FIELD}%b${FIELD}`;
+  const out = git(root, [
+    "log",
+    "--no-merges",
+    "--reverse",
+    `-n`,
+    String(max),
+    `--format=${fmt}`,
+    "--name-only",
+  ]);
+  if (!out) return [];
+
+  const commits: HistoryCommit[] = [];
+  for (const record of out.split(REC)) {
+    if (!record.trim()) continue;
+    const [sha = "", subject = "", body = "", rest = ""] = record.split(FIELD);
+    const files = rest
+      .split("\n")
+      .map((l) => l.trim())
+      .filter((l) => l !== "");
+    // A commit with no subject is a broken record, not a commit worth mining.
+    if (!sha.trim() || !subject.trim()) continue;
+    commits.push({ sha: sha.trim(), subject: subject.trim(), body: body.trim(), files });
+  }
+  return commits;
+}
+
+/** How many pull requests to read, and how many comment pages per thread. */
+const MAX_THREADS = 200;
+const MAX_COMMENT_PAGES = 3;
+/** How many threads' comments are fetched at once. Two requests per pull
+ * request, so this is the real cost of a repository read; 8 keeps it quick
+ * without crowding an installation's rate limit. */
+const THREAD_FETCH_CONCURRENCY = 8;
+
+interface PullListItem {
+  number?: number;
+  title?: string;
+  body?: string | null;
+  merge_commit_sha?: string | null;
+}
+
+interface CommentItem {
+  body?: string | null;
+  path?: string | null;
+  user?: { type?: string } | null;
+}
+
+/**
+ * Closed pull requests and their discussion, most-discussed first.
+ *
+ * Closed only: an open PR's discussion has not concluded, so mining a rule out
+ * of it would record a propos
```

**File**: `src/app/identity.ts` (modified, +103/-0)
```diff
@@ -66,6 +66,109 @@ interface CacheEntry {
  * Tokens last an hour and a busy repository can fire a dozen webhooks a minute;
  * without the cache every one of them spends a round trip and a signature.
  */
+/**
+ * The installation id for one repository.
+ *
+ * Every existing caller gets the id from a webhook payload, because every
+ * existing caller is reacting to one. A request that names a repository instead
+ * has to look it up, and this is the only endpoint that answers it: it is
+ * App-JWT authed, so it works before any installation token exists.
+ *
+ * Returns null when the App is not installed on the repository — which is the
+ * expected answer for "the user pasted a repo we cannot see", not an error.
+ */
+export async function installationFor(
+  creds: AppCredentials,
+  owner: string,
+  repo: string,
+  fetchImpl: Fetch,
+  nowMs: number = Date.now(),
+  api = "https://api.github.com",
+): Promise<number | null> {
+  const res = await fetchImpl(`${api}/repos/${owner}/${repo}/installation`, {
+    headers: {
+      authorization: `Bearer ${appJwt(creds, nowMs)}`,
+      accept: "application/vnd.github+json",
+      "user-agent": "graft-app",
+    },
+  });
+  if (res.status === 404) return null;
+  if (!res.ok) {
+    const body = await res.text();
+    throw new Error(`installation lookup for ${owner}/${repo} failed: ${res.status} ${body.slice(0, 200)}`);
+  }
+  const parsed = JSON.parse(await res.text()) as { id?: number };
+  return typeof parsed.id === "number" ? parsed.id : null;
+}
+
+/**
+ * Why a repository is unreachable, and where to send the user to fix it.
+ *
+ * Two failures look identical from `/repos/{o}/{r}/installation` — both 404 —
+ * and they need different sentences and different links. Either the App is not
+ * on the account at all, so they install it; or it is installed and this
+ * repository simply is not in its selected list, so they edit that list. Telling
+ * someone to install an App they already installed is the kind of dead end that
+ * ends the session.
+ *
+ * ownerId is the account's numeric id, which preselects the right account on
+ * GitHub's install screen. There is no equivalent for preselecting a repository;
+ * GitHub owns that checkbox list.
+ */
+export interface RepoAccessGap {
+  reason: "not_installed" | "repo_not_selected";
+  ownerId: number | null;
+  installationId: number | null;
+}
+
+/** Which of the two gaps applies to owner/repo. */
+export async function repoAccessGap(
+  creds: AppCredentials,
+  owner: string,
+  fetchImpl: Fetch,
+  nowMs: number = Date.now(),
+  api = "https://api.github.com",
+): Promise<RepoAccessGap> {
+  const headers = {
+    authorization: `Bearer ${appJwt(creds, nowMs)}`,
+    accept: "application/vnd.github+json",
+    "user-agent": "graft-app",
+  };
+  // An account is an org or a user and the endpoints differ, so try the org one
+  // and fall back rather than making the caller know which it is.
+  for (const path of [`/orgs/${owner}/installation`, `/users/${owner}/installation`]) {
+    try {
+      const res = await fetchImpl(`${api}${path}`, { headers });
+      if (!res.ok) continue;
+      const parsed = JSON.parse(await res.text()) as { id?: number; account?: { id?: number } };
+      return {
+        reason: "repo_not_selected",
+        ownerId: parsed.account?.id ?? null,
+        installationId: parsed.id ?? null,
+      };
+    } catch {
+      // Try the other shape; a network failure here only costs a less specific
+      // message, never the whole answer.
+    }
+  }
+  return { reason: "not_installed", ownerId: await ownerIdFor(owner, fetchImpl, api), installationId: null };
+}
+
+/** The account's numeric id, for preselecting it on the install screen. */
+async function ownerIdFor(owner: string, fetchImpl: Fetch, api: string): Promise<number | null> {
+  try {
+    // Unauthenticated: a public account's id is public, and this runs on a path
+    // where the App has no installation token to use anyway.
+    const res = await fetchImpl(`${api}/users/${owner}`, {
+      headers: { accept: "application/vnd.github+json", "user-agent": "graft-app" },
+    });
+    if (!res.ok) return null;
+    return (JSON.parse(await res.text()) as { id?: number }).id ?? null;
+  } catch {
+    return null;
+  }
+}
+
 export class InstallationTokens {
   private readonly cache = new Map<number, CacheEntry>();
 
```

**File**: `src/app/main.ts` (modified, +6/-0)
```diff
@@ -46,6 +46,12 @@ const { server, queue } = createApp({
   // server that will not start reviews nothing at all, which is strictly worse
   // than one whose old links go stale.
   pageDir: process.env.GRAFT_PAGE_DIR,
+  // Optional for the same reason as pageDir: unset simply disables
+  // `POST /brain/build`, and a deployment that only reviews pull requests wants
+  // exactly that. The route is the one place the app writes to the platform, so
+  // it stays off until someone deliberately turns it on.
+  brainBuildSecret: process.env.GRAFT_BRAIN_BUILD_SECRET,
+  brainBaseUrl: process.env.GRAFT_BRAIN_URL,
 });
 
 /**
```

**File**: `src/app/server.ts` (modified, +74/-0)
```diff
@@ -17,8 +17,10 @@
  * everything in here is I/O again.
  */
 import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
+import { timingSafeEqual } from "node:crypto";
 import { jobKey, reviewJobFor, type ReviewJob } from "./events.js";
 import { InstallationTokens, verifySignature, type AppCredentials, type Fetch } from "./identity.js";
+import { buildRepoIntoBrain, RepoNotAccessibleError, type BrainBuildJob } from "./brain-build.js";
 import { PageStore } from "./pages.js";
 import { WorkQueue } from "./queue.js";
 import { reviewInChildProcess } from "./review-process.js";
@@ -30,6 +32,9 @@ const MAX_BODY_BYTES = 2 * 1024 * 1024;
 /** Seams for tests: nothing here has a default that touches the network. */
 export interface AppSeams {
   fetch?: Fetch;
+  /** Swapped out so a test can assert what the route handed the builder without
+   * cloning a repository or reaching GitHub. */
+  brainBuild?: typeof buildRepoIntoBrain;
   /** Swapped out to assert what the queue was handed, without a clone — and, being
    * called in-process, without the fork the default reviewer does. */
   review?: typeof reviewPullRequest;
@@ -38,6 +43,13 @@ export interface AppSeams {
 
 export interface AppConfig extends AppCredentials {
   webhookSecret: string;
+  /** Shared secret for `POST /brain/build`. That route is called by the
+   * platform, not by GitHub, so it cannot use the webhook's payload signature —
+   * it takes a bearer token instead. Unset disables the route entirely, which
+   * is the right default for a deployment that only reviews pull requests. */
+  brainBuildSecret?: string;
+  /** Platform base URL the digest is posted to. Defaults to production. */
+  brainBaseUrl?: string;
   /** Public origin, for the links put in comments, e.g. https://graft.example.com */
   publicUrl: string;
   /** Where pages are kept, so a restart does not strand the links already posted. */
@@ -128,6 +140,56 @@ export function createApp(
       return send(res, 202, "application/json", JSON.stringify({ queued: true }));
     }
 
+    // Build one repository into a brain, on demand. Called by the platform when
+    // someone pastes a repository URL during onboarding — there is no webhook
+    // behind it, so it authenticates with a bearer token rather than a payload
+    // signature.
+    if (req.method === "POST" && url.pathname === "/brain/build") {
+      if (!config.brainBuildSecret) return send(res, 404, "text/plain", "not found");
+      // Compared in constant time for the same reason verifySignature is: this
+      // is a long-lived shared secret, and a timing oracle on it is worth more
+      // to an attacker than one on a per-payload signature.
+      if (!bearerMatches(header(req, "authorization"), config.brainBuildSecret)) {
+        return send(res, 401, "text/plain", "unauthorized");
+      }
+      const body = await readBody(req);
+      if (body === null) return send(res, 413, "text/plain", "payload too large");
+      let job: BrainBuildJob;
+      try {
+        job = JSON.parse(body) as BrainBuildJob;
+      } catch {
+        return send(res, 400, "text/plain", "bad json");
+      }
+      // brainId/brainToken are optional: without them the digest comes back in
+      // the response for the caller to ingest itself. See BrainBuildJob.
+      if (!job.owner || !job.repo) {
+        return send(res, 400, "application/json", JSON.stringify({ error: "owner and repo are required" }));
+      }
+      // Synchronous on purpose: the caller is a person waiting on a screen, and
+      // the platform's own import job is what makes the SLOW half (extraction and
+      // placement) asynchronous. This half is a shallow clone and a graph build.
+      try {
+        // The deployment's platform URL wins over anything a caller sends, so a
+        // request cannot redirect a repository's history to another host.
+        if (config.brainBaseUrl) job.brainBaseUrl = config.brainBaseUrl;
+        const built = await (seams.brainBuild ?? buildRepoIntoBrain)(job, {
+          creds: config,
+          fetch: fetchImpl,
+          api: config.api,
+          log,
+          now: seams.now,
+        });
+        return send(res, 202, "application/json", JSON.stringify(built));
+      } catch (e) {
+        if (e instanceof RepoNotAccessibleError) {
+          return send(res, 404, "application/json", JSON.stringify({ error: e.message, ...e.gap }));
+        }
+        const msg = e instanceof Error ? e.message : String(e);
+        log(`brain build ${job.owner}/${job.repo} failed: ${msg}`);
+        return send(res, 502, "application/json", JSON.stringify({ error: msg }));
+      }
+    }
+
     return send(res, 404, "text/plain", "not found");
   }
 
@@ -140,6 +202,18 @@ const header = (req: IncomingMessage, name: string): string | undefined => {
   return Array.isArray(v) ? v[0] : v;
 };
 
+/** Constant-time `Authorization: Bearer <secret>` check. */
+function bearerMatches
```

---

### Incident Patch 11: `6fa2baed` (2026-09-01)
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

### Incident Patch 12: `08ff9f77` (2026-09-01)
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
   const dir = mkdtempSync(join(tmpdir(), `graft-app-${req.owner}-${req.repo}-`));
   const cleanup = (): void => rmSync(dir, { recursive: true, force: true });
+  const log = req.log ?? ((): void => {});
+  const tag = `${req.owner}/${req.repo}#${req.number}`;
+  const fail = (step: string, err: string): never => {
+    cleanup();
+    // A merge ref is absent while GitHub is still computing mergeability, and
+    // present-but-stale right after a push — worth saying which step failed so
+    // that case is distinguishable from a permissions problem.
+    throw new Error(`checkout ${tag} failed at ${step}: ${redact(err, req.token)}`);
+  };
 
-  const steps: Array<[string, string[]]> = [
+  const setup: Array<[string, string[]]> = [
     ["init", ["init", "--quiet", "-b", "__graft_base"]],
     ["remote", ["remote", "add", "origin", `${host}/${req.owner}/${req.repo}.git`]],
-    // Both refs in one fetch: the merge ref to review, the base to diff against.
-    [
-      "fetch",
-      [
-        "fe
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
+    git(work, "update-ref", "refs/pull/7/merge", "HEAD");
+    git(work, "checkout", "--quiet", "main");
+    git(work, "reset", "--hard", "--quiet", "HEAD~1");
+    execFileSync("git", ["clone", "--quiet", "--mirror", work, join(root, "demo.git")]);
+    return { root, repo: "demo" };
+  }
+
+  // Everything below is a landed pull request: `main` had moved on before it
+  // landed, it landed, and `main` moved on again afterwards. No merge ref.
+  writeFileSync(join(work, "base.txt"), "base\nmore\n");
+  git(work, "add", "-A");
+  git(work, "commit", "--quiet", "-m", "other work");
+
+  if (state === "squashed") {
+    git(work, "merge", "--quiet", "--squash", "feature");
+    git(work, "commit", "--quiet", "-m", "squashed #7");
+  } else {
+    git(work, "merge", "--quiet", "--no-ff", "-m", "Merge pull request #7", "feature");
+  }
+
+  // Empty commits: the point is only how FAR the merge is behind the tip.
+  const after = state === "merged-far-behind" ? 55 : 1;
+  for (let i = 0; i < after; i += 1) git(work, "commit",
```

---

### Incident Patch 13: `afa3d2de` (2026-09-01)
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

### Incident Patch 14: `2f69b3f6` (2026-09-01)
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
+ * one and taking it globally would silently outrank the user's own. The hooks are the
+ * piece that has to be global, because they are what a worktree loses.
+ *
+ * Same idempotent shape as the repo merge: graft's prior entries are dropped before
+ * the current set is added, so re-running converges instead of stacking.
+ */
+export function mergeGraftHooks(existing: Json, helpers: string): { merged: Json } {
+  const merged: Json = { ...(existing ?? {}) };
+  merged.hooks = { ...(merged.hooks ?? {}) };
+  for (const [event, blocks] of Object.entries(graftBlocks(helpers))) {
+    const prior = Array.isArray(merged.hooks[event]) ? merged.hooks[event] : [];
+    const foreign = prior.filter((e: Json) => !isGraftEntry(e));
+    merged.hooks[event] = [...foreign, ...blocks];
+  }
+  return { merged };
+}
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
+  if (loaded === 'unparseable') return { id, path, action: 'skipped-unparseable' };
+  const { root: existing, existed } = loaded;
+  const before = JSON.stringify(existing);
+  const { merged } = mergeGraftHooks(existing, helpers);
+  if (JSON.stringify(merged) === before) return { id, path, action: 'unchanged' };
+  mkdirSync(dirname(path), { recursive: true });
+  writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`);
+  return { id, path, action: existed ? 'updated' : 'created' };
+}
+
+/**
+ * Install the user-level copy: the shim, the hook entries that call it, and the
+ * user-scope MCP registration.
+ *
+ * The shim is written to `home` and the hook commands name it by absolute path, for
+ * the reason the repo form can't be reused: `${CLAUDE_PROJECT_DIR}/.claude/helpers/`
+ * resolves inside whatever project is open, and the whole point is to work in one
+ * that has no such file. `hooksShim(claudeDistDir())` bakes in the installed
+ * package's `dist/`, exactly as the Codex install does.
+ *
+ * Best-effort by contract, like every other w
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

**File**: `src/hosts/retract.ts` (modified, +15/-2)
```diff
@@ -31,6 +31,7 @@ import { START, END } from './sections.js';
 import { mcpTargets, stripTomlSection } from './mcp-config.js';
 import { hookTargets } from './codex-hooks.js';
 import { antigravitySkillTargets } from './antigravity.js';
+import { claudeGlobalTargets } from './claude-global.js';
 import { claudeTargets } from '../claude/init.js';
 import { isGraftAllowEntry, isGraftFooterRegex } from '../claude/settings-merge.js';
 import type { WriteScope } from './plan.js';
@@ -364,7 +365,10 @@ function targets(repo: string, opts: RetractOpts): Target[] {
     if (exclude.has(host.id)) keptPaths.add(join(repo, host.relPath));
   }
   for (const t of mcpTargets(repo, [...exclude], { home })) keptPaths.add(t.path);
-  if (exclude.has('claude')) for (const t of claudeTargets(repo)) keptPaths.add(t.path);
+  if (exclude.has('claude')) {
+    for (const t of claudeTargets(repo)) keptPaths.add(t.path);
+    for (const t of claudeGlobalTargets(home)) keptPaths.add(t.path);
+  }
   if (exclude.has('agents')) for (const t of hookTargets(home)) keptPaths.add(t.path);
   if (exclude.has('antigravity')) for (const t of antigravitySkillTargets(home)) keptPaths.add(t.path);
 
@@ -420,8 +424,17 @@ function targets(repo: string, opts: RetractOpts): Target[] {
     ] as Target[]) add(t);
   }
 
-  // 4. Global: Codex's hook shim + entries, and Antigravity's shared skill.
+  // 4. Global: Claude Code's user-level copy, Codex's hook shim + entries, and
+  //    Antigravity's shared skill.
   if (opts.global !== false) {
+    if (!exclude.has('claude')) {
+      const [shim, settings, mcp] = claudeGlobalTargets(home);
+      for (const t of [
+        { hostId: 'claude', path: shim.path, what: shim.what, scope: 'global', run: (a) => removeFile(shim.path, a) },
+        { hostId: 'claude', path: settings.path, what: settings.what, scope: 'global', run: (a) => stripClaudeSettings(settings.path, a) },
+        { hostId: 'claude', path: mcp.path, what: mcp.what, scope: 'global', run: (a) => removeJsonKey(mcp.path, 'mcpServers', a) },
+      ] as Target[]) add(t);
+    }
     if (!exclude.has('agents')) {
       for (const t of hookTargets(home)) {
         add({
```

**File**: `src/mcp/server.ts` (modified, +31/-4)
```diff
@@ -5,6 +5,8 @@
 import { createInterface } from 'node:readline';
 import { TOOLS, callTool } from './tools.js';
 import { mcpInstructions } from './instructions.js';
+import { hasGraftIndex } from '../graph/root.js';
+import { mainWorktreeRoot } from '../graph/seed.js';
 import { runUpkeep } from '../upkeep-run.js';
 import { runningVersion } from '../upkeep.js';
 import { maybeFlushInBackground, track } from '../telemetry/index.js';
@@ -36,6 +38,31 @@ function replyError(id: unknown, code: number, message: string): void {
   send({ jsonrpc: '2.0', id, error: { code, message } });
 }
 
+/**
+ * Which tools this server admits to having.
+ *
+ * `hosts/claude-global.ts` registers graft at the *user* MCP scope, which starts this
+ * server in every project the user opens — including ones that never asked for graft.
+ * Six tool schemas is real context, charged on every turn of every session, and in a
+ * repo with no graph every one of them can only answer "run graft build". So a repo
+ * that never invited graft is told there is nothing to call.
+ *
+ * The parent-checkout clause is not an optimization, it is the case the global
+ * registration exists for: a fresh `git worktree add` has no `graft/` of its own
+ * (it's gitignored, so git never checks it out) and gets one from its parent on the
+ * first query — see graph/seed.ts. Gating on this tree alone would hide graft in
+ * precisely the worktree the user is trying to work in, which is the bug, inverted.
+ *
+ * A `--dir` override is an explicit "the graph is over there", so it always
+ * advertises without a probe.
+ */
+function advertised(root: string, dirOverride?: string): typeof TOOLS {
+  if (dirOverride !== undefined) return TOOLS;
+  if (hasGraftIndex(root)) return TOOLS;
+  const main = mainWorktreeRoot(root);
+  return main && hasGraftIndex(main) ? TOOLS : [];
+}
+
 /**
  * `version` is threaded in from the CLI rather than read here: `readCurrentVersion`
  * resolves package.json relative to the calling module, and from `dist/mcp/` that
@@ -88,11 +115,11 @@ export function startMcpServer(root: string, dirOverride?: string, version = '0'
       case 'ping':
         if (!isNotification) reply(id, {});
         return;
-      case 'tools/list':
-        if (!isNotification) {
-          reply(id, { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
-        }
+      case 'tools/list': {
+        if (isNotification) return;
+        reply(id, { tools: advertised(root, dirOverride).map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
         return;
+      }
       case 'tools/call': {
         if (isNotification) return;
         const name = String(params?.name ?? '');
```

**File**: `src/upkeep-run.ts` (modified, +5/-1)
```diff
@@ -39,7 +39,11 @@ export interface UpkeepResult {
  * `opts.global`/`opts.hooks`, replayed from the stamp.
  */
 function rewriteWiring(repo: string, hosts: string[], opts: WiringOpts): void {
-  if (hosts.includes('claude')) runInit(repo, { build: false, cliPath: graftCliPath(), statusline: opts.statusline });
+  // `opts.global` reaches the claude layer for the same reason `opts.statusline` does:
+  // its `~/.claude` writes (hosts/claude-global.ts) are out-of-repo, and a user who
+  // declined those at init time must keep declining them on every replay.
+  if (hosts.includes('claude'))
+    runInit(repo, { build: false, cliPath: graftCliPath(), statusline: opts.statusline, global: opts.global });
   const others = hosts.filter((h) => h !== 'claude');
   if (others.length)
     runHostsInit(repo, { agents: others, global: opts.global, mcp: opts.mcp, hooks: opts.hooks });
```

---

### Incident Patch 15: `63421bca` (2026-08-31)
**Commit Message**: fix(ingest): index a directory when the build root is a symlink (#154)

Unwrap a symlink-to-directory once so git and the filesystem walk run
inside the target, keep emitted paths on the caller-facing root, and
leave internal file/dir symlinks unfollowed (#143).

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `src/ingest/fs.ts` (modified, +71/-3)
```diff
@@ -2,8 +2,8 @@
  * Filesystem walking used by `init`/`check` to enumerate a repo's source files.
  */
 import { spawnSync } from "node:child_process";
-import { existsSync, lstatSync, readdirSync, statSync } from "node:fs";
-import { join, relative, resolve } from "node:path";
+import { existsSync, lstatSync, readdirSync, realpathSync, statSync } from "node:fs";
+import { isAbsolute, join, relative, resolve, sep } from "node:path";
 
 /** Directories that are dependency/build output, never source. */
 export const SKIP_DIRS = new Set([
@@ -86,12 +86,80 @@ export interface WalkOptions {
   followNestedRepos?: boolean;
 }
 
+/**
+ * Directory `walkDir` actually enumerates.
+ *
+ * `path.resolve` does not follow a symlink, and git discovers the repo from the
+ * child cwd. Unwrap a symlink-to-directory once so the walk runs inside the
+ * target. Ordinary directories stay as `resolve(dir)` — not `realpath` — so a
+ * macOS `/var/folders/…` scratch path is the path the caller handed us.
+ *
+ * A broken symlink throws instead of the `scandir ENOENT` `readdirSync` would
+ * raise after git fails. Internal symlink policy is not decided here.
+ */
+export function canonicalWalkRoot(dir: string): string {
+  const abs = resolve(dir);
+  let st: ReturnType<typeof lstatSync>;
+  try {
+    st = lstatSync(abs);
+  } catch {
+    return abs;
+  }
+  if (!st.isSymbolicLink()) return abs;
+
+  let real: string;
+  try {
+    real = realpathSync(abs);
+  } catch (err) {
+    const code = err && typeof err === "object" && "code" in err ? String((err as NodeJS.ErrnoException).code) : "";
+    if (code === "ELOOP") throw new Error(`symbolic link loop: ${abs}`);
+    throw new Error(`broken symbolic link: ${abs}`);
+  }
+  let realSt: ReturnType<typeof statSync>;
+  try {
+    realSt = statSync(real);
+  } catch {
+    throw new Error(`broken symbolic link: ${abs}`);
+  }
+  if (!realSt.isDirectory()) return abs;
+  return real;
+}
+
+function escapedCanonical(canonical: string, abs: string): boolean {
+  const rel = relative(canonical, abs);
+  return rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
+}
+
+/** Keep emitted paths on the requested root so relative paths stay stable. */
+function remapWalkPaths(requested: string, canonical: string, files: string[]): string[] {
+  if (requested === canonical) return files;
+  const out: string[] = [];
+  for (const abs of files) {
+    if (escapedCanonical(canonical, abs)) continue;
+    const rel = relative(canonical, abs);
+    if (rel === "") continue;
+    out.push(join(requested, rel));
+  }
+  return out;
+}
+
+/**
+ * Recursively list source files under `dir`. A directory symlink as the *input
+ * root* is unwrapped once ({@link canonicalWalkRoot}); emitted paths are remapped
+ * onto the caller-facing root so `relPosix` stays `src/foo.ts` rather than a
+ * `../` escape through the physical path (macOS `/tmp` → `/private/tmp`).
+ * Symlinks *inside* the tree are not followed: git still `lstat`s each listed
+ * path, and the filesystem walk still requires `Dirent.isFile` / `isDirectory`.
+ */
 export function walkDir(
   dir: string,
   includes?: ReadonlySet<string>,
   opts: WalkOptions = {},
 ): string[] {
-  return gitVisibleFiles(dir, includes, opts) ?? walkFilesystem(dir, includes);
+  const requested = resolve(dir);
+  const root = canonicalWalkRoot(requested);
+  const files = gitVisibleFiles(root, includes, opts) ?? walkFilesystem(root, includes);
+  return remapWalkPaths(requested, root, files);
 }
 
 /** Git's canonical working-tree file set, relative to `dir`. Tracked files are
```

**File**: `test/graph-root.test.ts` (modified, +15/-2)
```diff
@@ -8,8 +8,8 @@
  */
 import { test } from "node:test";
 import assert from "node:assert/strict";
-import { mkdirSync, writeFileSync } from "node:fs";
-import { join } from "node:path";
+import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
+import { join, resolve } from "node:path";
 import { nearestGraftRoot, hasGraftIndex } from "../src/graph/root.js";
 import { tmpRepo } from "./helpers.js";
 
@@ -72,3 +72,16 @@ test("an explicit --dir override short-circuits the walk", () => {
   // mislead here.
   assert.deepEqual(nearestGraftRoot(deep, join(repo, "graft")), { root: deep, levels: 0 });
 });
+
+test("a symlink to a built repo is a graft root at the symlink path, not the physical target (#143)", () => {
+  // Query-root walking is not the place we unwrap a build input. existsSync
+  // follows the link, so the index is visible, but the returned root stays the
+  // caller-facing path — the same stability walkDir keeps for emitted files.
+  const repo = builtRepo(tmpRepo("root-symlink-real"));
+  const link = join(tmpRepo("root-symlink-wrap"), "via-link");
+  symlinkSync(repo, link, process.platform === "win32" ? "junction" : "dir");
+
+  assert.ok(hasGraftIndex(link), "the wiring files are visible through the symlink");
+  assert.deepEqual(nearestGraftRoot(link), { root: resolve(link), levels: 0 });
+  assert.notEqual(resolve(link), repo);
+});
```

**File**: `test/ingest-fs.test.ts` (modified, +123/-2)
```diff
@@ -1,9 +1,9 @@
 import { execFileSync } from "node:child_process";
 import { test } from "node:test";
 import assert from "node:assert/strict";
-import { mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
+import { mkdtempSync, mkdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
 import { tmpdir } from "node:os";
-import { join, relative } from "node:path";
+import { join, relative, resolve, sep, isAbsolute } from "node:path";
 import { shouldSkipDir, walkDir, SKIP_DIRS } from "../src/ingest/fs.js";
 import { discoverScopes, discoverWorkspaceChildren } from "../src/graph/scopes.js";
 
@@ -330,3 +330,124 @@ test("workspace-glob resolution (scopes.ts's resolveGlob over visible-file dirs)
     rmSync(dir, { recursive: true, force: true });
   }
 });
+
+/**
+ * #143 — the *input root* may be a directory symlink (nix-store -devel paths).
+ * Follow that root once. Do not follow symlinks *inside* the tree: that is how
+ * loops and outside-root escapes are prevented, and it keeps git-tracked
+ * symlink files skipped via `lstat`.
+ *
+ * Windows: directory links are junctions so CI does not need Developer Mode.
+ */
+function symlinkDirectory(target: string, path: string): void {
+  symlinkSync(target, path, process.platform === "win32" ? "junction" : "dir");
+}
+
+function underRoot(root: string, abs: string): boolean {
+  const rel = relative(root, abs);
+  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
+}
+
+test("walkDir indexes a directory when the input root itself is a symlink (#143)", () => {
+  const real = mkdtempSync(join(tmpdir(), "graft-walk-symlink-real-"));
+  const wrap = mkdtempSync(join(tmpdir(), "graft-walk-symlink-wrap-"));
+  const link = join(wrap, "root");
+  try {
+    write(real, "src/app.ts");
+    write(real, "src/util.ts", "export const util = 2;\n");
+    symlinkDirectory(real, link);
+
+    const rels = walked(link);
+    assert.deepEqual(rels, ["src/app.ts", "src/util.ts"]);
+    assert.ok(rels.every((r) => !r.startsWith("..")), "relative paths must stay inside the requested root");
+    for (const abs of walkDir(link)) {
+      assert.ok(underRoot(resolve(link), abs), "emitted paths stay on the caller-facing root, not a leaked realpath");
+    }
+  } finally {
+    rmSync(wrap, { recursive: true, force: true });
+    rmSync(real, { recursive: true, force: true });
+  }
+});
+
+test("walkDir indexes a Git repo when the input root is a symlink to that repo (#143)", () => {
+  const real = fixture("symlink-git-real");
+  const wrap = mkdtempSync(join(tmpdir(), "graft-walk-symlink-gitwrap-"));
+  const link = join(wrap, "root");
+  try {
+    write(real, "src/app.ts");
+    symlinkDirectory(real, link);
+    assert.deepEqual(walked(link), ["src/app.ts"]);
+  } finally {
+    rmSync(wrap, { recursive: true, force: true });
+    rmSync(real, { recursive: true, force: true });
+  }
+});
+
+test("walkDir reports a broken symlink root instead of a generic scandir ENOENT (#143)", (t) => {
+  const wrap = mkdtempSync(join(tmpdir(), "graft-walk-broken-link-"));
+  const link = join(wrap, "root");
+  try {
+    try {
+      symlinkSync(join(wrap, "missing-target"), link, process.platform === "win32" ? "junction" : "dir");
+    } catch (err) {
+      t.skip(`cannot create a dangling directory link (${err instanceof Error ? err.message : err})`);
+      return;
+    }
+    assert.throws(() => walkDir(link), (err: unknown) => {
+      assert.ok(err instanceof Error);
+      assert.match(err.message, /broken symbolic link/i);
+      assert.doesNotMatch(err.message, /scandir/i);
+      return true;
+    });
+  } finally {
+    rmSync(wrap, { recursive: true, force: true });
+  }
+});
+
+test("walkDir does not follow an internal file or directory symlink (#143)", (t) => {
+  const dir = mkdtempSync(join(tmpdir(), "graft-walk-internal-link-"));
+  const outside = mkdtempSync(join(tmpdir(), "graft-walk-outside-"));
+  try {
+    write(dir, "src/app.ts");
+    write(dir, "src/real.ts", "export const real = 1;\n");
+    write(outside, "leaked.ts", "export const leaked = 1;\n");
+    let fileLink = false;
+    try {
+      symlinkSync(join(dir, "src", "real.ts"), join(dir, "src", "alias.ts"));
+      fileLink = true;
+    } catch (err) {
+      t.diagnostic(`skipping internal file-symlink assertion: ${err instanceof Error ? err.message : err}`);
+    }
+    symlinkDirectory(outside, join(dir, "escape"));
+
+    const rels = walked(dir);
+    assert.deepEqual(rels, ["src/app.ts", "src/real.ts"]);
+    if (fileLink) assert.ok(!rels.includes("src/alias.ts"), "an internal file symlink is not a source file");
+    assert.ok(!rels.some((r) => r.includes("leaked.ts")), "a directory symlink must not escape the root");
+  } finally {
+    rmSync(dir, { recursive: true, force: true });
+    rmSync(outside, { recursive: true, force: true });
+  }
+});
+
+test("walkDir does not recurse forever through an internal symlink to the root (#143)", {
```

#### Recent Merged Pull Requests:
- **PR #507** (2026-09-29): feat(trail): show how many changes were suggested in graft trail pull (@anirudhkumar-nanonets)
- **PR #505** (closed): fix(hosts): preserve Codex MCP transport during init (@ivanpointer)
- **PR #504** (closed): feat(graph): index Terraform and HCL sources (@ivanpointer)
- **PR #501** (closed): feat: record machine-local Graft usage stats (@ivanpointer)
- **PR #496** (2026-09-28): feat(telemetry): trail_pulled event for graft trail pull (@anirudhkumar-nanonets)
- **PR #495** (2026-09-28): feat(trail): finish the sign-up when a coding agent runs graft trail push (@anirudhkumar-nanonets)
- **PR #494** (2026-09-28): feat(trail): send the picked agents with the push (@anirudhkumar-nanonets)
- **PR #493** (2026-09-28): feat(trail): chunked upload, live watch and pull for all context files (@anirudhkumar-nanonets)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
