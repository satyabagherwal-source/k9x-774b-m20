# Forensic Learning Record (Deep Inspection): tintinweb/pi-subagents

> **Canonical Artifact**: `07_PROJECT_LEARNING/tintinweb-pi-subagents-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tintinweb/pi-subagents](https://github.com/tintinweb/pi-subagents))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:48:43.656Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tintinweb/pi-subagents`
- **Description**: Claude Code like Sub-Agents & Workflow Orchestration for Pi — parallel execution, live widget, fleet view, custom agent types, mid-run steering, claude compatible dynamic workflows and more ...
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1252 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/workflow/worker-source.ts`
```
/**
 * worker-source.ts — the JavaScript that runs inside the workflow worker thread.
 *
 * The host spawns this with `new Worker(WORKER_SOURCE, { eval: true })`, so the
 * source has to be an inlined string: `AGENTS.md` forbids dynamic `import()`,
 * and a file path would have to survive bundling. Keeping it as a template
 * literal costs editor tooling but nothing else — the worker is plain CommonJS
 * JavaScript and never sees the TypeScript pipeline.
 *
 * Two boundaries stack here, and they are not the same boundary:
 *
 *   host thread  ←postMessage→  worker thread  ←vm context→  workflow script
 *
 * The worker/host split exists for *killability*: `worker.terminate()` stops a
 * runaway script mid-loop, which an in-process `vm` timeout cannot do once the
 * script is inside an `await`. The vm context exists for *determinism and
 * accident-avoidance*, not security — see the note on `codeGeneration` below.
 *
 * ## Why the context gets no host built-ins
 *
 * `vm.createContext(sandbox)` gives the script a fresh realm that already owns
 * `Object`, `Array`, `JSON`, `Math`, `Date`, `Promise`, `Map`, `Set`. We inject
 * *only* our own globals on top. Injecting host built-ins instead would hand the
 * script `Object.constructor` → the **host** `Function`, i.e. a compiler for
 * arbitrary host-realm code.
 *
 * That said: our injected globals are themselves host closures, so
 * `agent.constructor` is still the host `Function`. The hygiene shrinks the
 * surface; it does not close the hole. **`codeGeneration: { strings: false }` is
 * the load-bearing defense** — it makes `Function("…")` and `eval("…")` throw
 * `EvalError`, so a captured host `Function` cannot compile anything. Treat this
 * as a determinism boundary, not a security boundary against a hostile script.
 *
 * ## Why determinism is a prelude and not a stub
 *
 * Because `Date` and `Math` come *from the realm*, they cannot be neutered by
 * injection — there is nothing to inject over. So the compiled source is
 * prefixed with a prelude that runs inside the realm and reassigns `Date.now`
 * and `Math.random` in place, then lexically shadows `Date` with a subclass
 * whose zero-argument constructor throws. Lexical shadowing rather than a global
 * assignment because a `const` in the IIFE scope cannot be reached around.
 *
 * Determinism is enforced because a workflow's journal is replayed by prefix on
 * resume: a script that reads the clock produces a different prefix on the
 * second run and the replay silently diverges.
 */

/**
 * Runs inside the realm, ahead of the script body, on a single line.
 *
 * One line matters: the body is compiled at `\n` + line 1, and the host passes
 * `lineOffset: -1` so reported line numbers match the file the author wrote. Any
 * newline in here shifts every stack frame in every workflow script.
 */
const DETERMINISM_PRELUDE =
  "const Date = (function () {" +
  " const RealDate = globalThis.Date;" +
  " const die = function (what) {" +
  " throw new Error(what + \" is unavailable in workflow scripts (breaks resume)." +
  " Stamp results after the workflow returns, or pass timestamps via `args`.\");" +
  " };" +
  " RealDate.now = function () { return die(\"Date.now()\"); };" +
  " Math.random = function () { return die(\"Math.random()\"); };" +
  " return class WorkflowDate extends RealDate {" +
  " constructor() { if (arguments.length === 0) die(\"new Date()\"); super(...arguments); }" +
  " };" +
  "})();";

export const WORKER_SOURCE = `"use strict";

const { parentPort, workerData } = require("node:worker_threads");
const vm = require("node:vm");

const port = parentPort;
const ITEM_CAP = workerData.itemCap;
const PRELUDE = ${JSON.stringify(DETERMINISM_PRELUDE)};

/* ------------------------------------------------------------------ *
 * RPC to the host
 *
 * The script never touches the agent manager. Every effect leaves as a
 * "call" message and comes back as a "response", so the host owns the
 * semaphore, the caps, and the abort story.
 * ------------------------------------------------------------------ */

let nextCallId = 1;
const pendingCalls = new Map();

/**
 * Output tokens this run has spent, as last reported by the host.
 *
 * A mirror, not a tally: every response carries the host's current total, so
 * there is exactly one counter and it cannot drift. Between responses it cannot
 * be stale in any way the script could observe — tokens only accrue through
 * agents, and an agent's response is the only thing the script waits on.
 */
let spentOutput = 0;

function callHost(method, payload) {
  // Drain first, so the phase() that named this agent reaches the host ahead of
  // the agent entry rather than a tick behind it.
  flushProgress();
  return new Promise(function (resolve, reject) {
    const callId = nextCallId++;
    pendingCalls.set(callId, { resolve: resolve, reject: reject });
    port.postMessage({ type: "call", callId: callId, method: method, payload: payload });
  });
}

port.on("message", function (message) {
  if (!message || message.type !== "response") return;
  if (typeof message.spent === "number") spentOutput = message.spent;
  const waiter = pendingCalls.get(message.callId);
  if (!waiter) return;
  pendingCalls.delete(message.callId);
  if (message.ok) {
    waiter.resolve(message.value);
    return;
  }
  const error = new Error(message.error || "The workflow host rejected the call.");
  // Fatal errors are the run's, not the item's: parallel() and pipeline()
  // swallow ordinary failures into null, and a cap breach must not be
  // silently absorbed that way.
  if (message.fatal) error.workflowFatal = true;
  waiter.reject(error);
});

function isFatal(error) {
  return !!(error && typeof error === "object" && error.workflowFatal === true);
}

/* ------------------------------------------------------------------ *
 * Progress entries
 * ------------------------------------------------------------------ */

let progressQueue = [];
let flushTimer = null;

function emit(entry) {
  progressQueue.push(entry);
  // Batched on a macrotask: a fan-out emits a burst of phase/log entries in one
  // turn, and the host renders once per batch rather than once per entry.
  if (flushTimer === null) flushTimer = setTimeout(flushProgress, 0);
}

function flushProgress() {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (progressQueue.length === 0) return;
  const batch = progressQueue;
  progressQueue = [];
  port.postMessage({ type: "progress", entries: batch });
}

/* ------------------------------------------------------------------ *
 * The JSON boundary
 *
 * Checked here rather than relying on structured clone, which happily
 * carries cycles, BigInt and Maps that the progress log and the resume
 * journal cannot represent. Rejecting loudly beats writing a journal
 * that will not replay.
 * ------------------------------------------------------------------ */

let realmObjectPrototype = null;
/**
 * The realm's own \`JSON.parse\`.
 *
 * Module-scope, not local to main(), because \`agent({ schema })\` parses its
 * result here — outside main's closure — and the object has to carry the
 * *script's* Object.prototype, not the worker's, or \`instanceof Object\` fails
 * inside the script it was handed to.
 */
let realmParse = null;

/**
 * The top-level script's scope.
 *
 * Module-scope because a nested \`workflow()\` needs the realm-native function
 * compiler that \`main()\` builds, and because the compiled child function is
 * cached per body — see {@link workflowIn}.
 */
let rootScope = null;
/**
 * The vm context every script runs in.
 *
 * Held so a nested \`workflow()\` can compile its child there. Compiled from
 * *outside* the realm, with \`vm.Script\`, because the context itself has
 * \`codeGeneration.strings\` off — the script cannot build code, but the worker
 * that owns it still can.
 */
let realmContext = null;
/** Nested invocations made so far, against \`workerData.nestedCap\`. */
let nestedCount = 0;

function boundaryError(what, path) {
  return new Error(
    "Cannot pass " + what + " across the workflow VM boundary (at " + path + ")."
  );
}

function assertBoundary(value, path, seen) {
  if (value === null) return;
  const kind = typeof value;
  if (kind === "string" || kind === "boolean") return;
  if (kind === "number") {
    if (!Number.isFinite(value)) throw boundaryError("a non-finite number", path);
    return;
  }
  if (kind === "undefined") {
    if (path === "the workflow result") return;
    throw boundaryError("undefined", path);
  }
  if (kind === "bigint") throw boundaryError("a BigInt", path);
  if (kind === "symbol") throw boundaryError("a symbol", path);
  if (kind === "function") throw boundaryError("a function", path);
  if (kind !== "object") throw boundaryError("a " + kind, path);

  if (seen.has(value)) throw boundaryError("a circular structure", path);
  seen.add(value);

  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw boundaryError("an object with symbol keys", path);
  }

  if (Array.isArray(value)) {
    const length = value.length;
    for (let i = 0; i < length; i++) {
      // A sparse array round-trips through JSON as nulls, which silently
      // changes the data. Reject instead.
      if (!Object.prototype.hasOwnProperty.call(value, i)) {
        throw boundaryError("a sparse array", path + "[" + i + "]");
      }
      assertBoundary(value[i], path + "[" + i + "]", seen);
    }
    seen.delete(value);
    return;
  }

  const prototype = Object.getPrototypeOf(value);
  // Two prototypes are legitimate: the realm's own Object.prototype (anything
  // the script built) and the worker's (arrays we hand back from parallel).
  // Everything else — Map, Set, Date, a class instance — loses meaning here.
  if (prototype !== null && prototype !== realmObjectPrototype && prototype !== Object.prototype) {
    throw boundaryError("a non-plain object", path);
  }

  const keys = O
```

### Core Architecture Module: `examples/workflows/compose.js`
```
/**
 * compose.js — reuse a saved workflow inside another one.
 *
 * Demonstrates: `workflow(nameOrRef, args?)`, `args` plumbing into the child,
 * and catching the failures a bad reference throws.
 *
 * The child runs in the SAME worker and vm context under its own globals, so it
 * shares this run's concurrency cap, agent counter, abort signal, journal and
 * budget by construction — its agents are simply this run's agents, visible and
 * controllable from the same inspector. What it does not share is phase state:
 * the child's phases render under their own `▸ count-child` group.
 *
 * Nesting is ONE level deep. A `workflow()` call inside the child throws.
 *
 * Requires `lib/count-child.js` to be resolvable — copy both this file and the
 * child into `.pi/workflows/` (the child as `count-child.js`) before running it
 * by name.
 *
 * args: { root?: string }
 *
 * Run: ask the model — "run the workflow at examples/workflows/compose.js".
 */
export const meta = {
  name: 'compose',
  description: 'Count files with a nested workflow, then summarize what it found',
  phases: [{ title: 'Count' }, { title: 'Summarize' }],
}

const root = args?.root ?? 'src/'

phase('Count')

// An unknown name, an unreadable path, a file with no `meta`, or a child that
// will not parse all throw into this script — so catch if you want to carry on.
let count
try {
  count = await workflow('count-child', { root })
} catch (error) {
  log(`nested workflow failed: ${error.message}`)
  return { ok: false, reason: error.message }
}

log(`the child counted ${count} files under ${root}`)

phase('Summarize')
const summary = await agent(
  `There are ${count} source files under ${root}. In one sentence, say whether that is a lot for a project of this kind.`,
  { label: 'summarize', effort: 'low' },
)

return { ok: true, count, summary }

```

### Core Architecture Module: `examples/workflows/fan-out-audit.js`
```
/**
 * fan-out-audit.js — the canonical workflow shape.
 *
 * Demonstrates: a fan-out whose width is discovered at runtime, `pipeline`
 * (no barrier between stages), `label` for readable progress rows, and a
 * per-stage `phase` override.
 *
 * args: { root?: string }  — directory to audit, default "src/routes/"
 *
 * Run: ask the model — "run the workflow at examples/workflows/fan-out-audit.js
 * against src/", or copy it to .pi/workflows/ and ask for it by name.
 */
export const meta = {
  name: 'fan-out-audit',
  description: 'Find files missing auth checks, then try to refute each finding',
  phases: [{ title: 'Scan' }, { title: 'Audit' }, { title: 'Verify' }],
}

const root = args?.root ?? 'src/routes/'

phase('Scan')
const listing = await agent(
  `List every source file under ${root}. One path per line, nothing else.`,
  { label: 'discover' },
)
const files = listing.split('\n').map(s => s.trim()).filter(Boolean)
log(`auditing ${files.length} files under ${root}`)

// pipeline, not parallel: a file that finishes auditing moves straight to
// verification instead of waiting for the slowest sibling to catch up.
phase('Audit')
const findings = await pipeline(
  files,
  file => agent(`Audit ${file} for missing auth checks. Report findings, or "none".`, {
    label: `audit:${file}`,
  }),
  // Later stages still receive the original item — no need to thread it through
  // the previous stage's return value.
  (found, file) => agent(`Try to REFUTE this finding about ${file}: ${found}`, {
    label: `verify:${file}`,
    // Explicit, because the ambient phase() races inside pipeline stages.
    phase: 'Verify',
  }),
)

// A skipped or failed agent is a null, so filter before returning.
return findings.filter(Boolean)

```

### Core Architecture Module: `examples/workflows/gated-fix.js`
```
/**
 * gated-fix.js — verify by running a command, not by asking a second opinion.
 *
 * Demonstrates: `gate` (a shell command that must pass, or the agent is failed
 * and its call returns null), and `resume` to hand the failure back to the same
 * child instead of re-paying for the context it already built.
 *
 * Two constraints this example is shaped around, both worth knowing:
 *
 *   1. `gate` cannot be combined with `resume`. A resumed child keeps the agent
 *      type, model, tree and tools it was started with, so the corrective pass
 *      is NOT itself gated — re-verification needs its own gated call.
 *   2. `isolation: "worktree"` is deliberately not used here. An isolated child's
 *      worktree is committed to a branch and removed when it settles, so a later
 *      agent would verify the main tree and could pass while the fix it was
 *      checking lives somewhere else. Isolation is for parallel writers that
 *      would collide; a serial fix-then-verify chain wants one shared tree.
 *
 * args: { task?: string, test?: string }
 *
 * Run: ask the model — "run the workflow at examples/workflows/gated-fix.js
 * with the test command npm test". Needs a real test command to be useful.
 */
export const meta = {
  name: 'gated-fix',
  description: 'Fix a failing test, then prove it passes by running the suite',
  phases: [{ title: 'Fix' }, { title: 'Verify' }],
}

const task = args?.task ?? 'Find and fix the failing test.'
const testCommand = args?.test ?? 'npm test'

phase('Fix')

// The gate runs after the agent finishes. A non-zero exit fails the agent and
// folds the command's output into its error, so `fixed` is null exactly when
// the suite did not pass — no need to ask a model whether the fix worked.
let fixed = await agent(task, { label: 'fix', gate: testCommand })

if (fixed === null) {
  log(`${testCommand} failed — handing the output back to the same child`)

  // Resume, not a fresh spawn: the child still has everything it learned on the
  // first pass, so it is told what broke rather than rediscovering it.
  fixed = await agent(
    `\`${testCommand}\` is still failing. Read the failure above, fix the cause, and stop.`,
    { label: 'fix', resume: 'fix' },
  )

  // The resume could not carry the gate, so verify separately. This child works
  // in the same tree, which is what makes the check meaningful.
  phase('Verify')
  const verified = await agent(
    `Run \`${testCommand}\` and report the result. Change nothing.`,
    { label: 'verify', gate: testCommand, effort: 'low' },
  )
  return { passed: verified !== null, summary: fixed }
}

return { passed: true, summary: fixed }

```

### Core Architecture Module: `examples/workflows/lib/count-child.js`
```
/**
 * lib/count-child.js — a nested workflow, invoked by compose.js.
 *
 * A child is an ordinary workflow: it needs its own `export const meta =`
 * declaration, which is exactly what marks a file in a workflows directory as
 * runnable rather than as some unrelated script that happens to live there.
 *
 * args: { root?: string }
 */
export const meta = {
  name: 'count-child',
  description: 'Count the source files under a directory',
}

const root = args?.root ?? 'src/'

const found = await agent(`List every source file under ${root}. One path per line, nothing else.`, {
  label: 'scan',
  schema: {
    type: 'object',
    properties: { files: { type: 'array', items: { type: 'string' } } },
    required: ['files'],
  },
})

// A schema call can still return null if the child never complied.
return found === null ? 0 : found.files.length

```

### Core Architecture Module: `examples/workflows/review-panel.js`
```
/**
 * review-panel.js — the case where a barrier is actually earned.
 *
 * Demonstrates: `parallel` used correctly, `effort` tiering (cheap reviewers,
 * an expensive judge), and a `model` override.
 *
 * Most of the time `pipeline` beats `parallel`, because a barrier idles every
 * fast agent until the slowest finishes. This is the exception: the synthesis
 * prompt interpolates ALL of the reviews, so it genuinely cannot start until
 * every one of them is in. That — a prompt that compares results against each
 * other — is what justifies a barrier.
 *
 * args: { target?: string, lenses?: string[] }
 *
 * Run: ask the model — "run the workflow at examples/workflows/review-panel.js
 * against src/auth.ts".
 */
export const meta = {
  name: 'review-panel',
  description: 'Review one thing from several angles, then reconcile the verdicts',
  phases: [{ title: 'Review' }, { title: 'Synthesize' }],
}

const target = args?.target ?? 'the changed files'
const lenses = args?.lenses ?? ['correctness', 'security', 'performance']

phase('Review')

// Perspective diversity, not redundancy: three reviewers with DIFFERENT briefs
// catch failure modes that three identical ones cannot.
const reviews = await parallel(
  lenses.map(lens => () =>
    agent(`Review ${target} through the lens of ${lens} alone. Be specific and brief.`, {
      label: `review:${lens}`,
      // Cheap for the survey work; the judge below gets the depth.
      effort: 'low',
    }),
  ),
)

// A thunk that throws becomes null without taking its siblings down.
const usable = reviews
  .map((text, i) => ({ lens: lenses[i], text }))
  .filter(r => r.text !== null)

if (usable.length === 0) {
  log('every reviewer failed — nothing to synthesize')
  return { reviewed: 0, verdict: null }
}

phase('Synthesize')

// This is the barrier's payoff: one prompt that sees all of them at once and can
// weigh them against each other.
const verdict = await agent(
  [
    `Reconcile these reviews of ${target}. Where they disagree, say which is right and why.`,
    ...usable.map(r => `\n## ${r.lens}\n${r.text}`),
  ].join('\n'),
  { label: 'synthesize', effort: 'high', agentType: 'Plan' },
)

return { reviewed: usable.length, verdict }

```

### Core Architecture Module: `examples/workflows/structured-findings.js`
```
/**
 * structured-findings.js — get objects back, not prose.
 *
 * Demonstrates: `schema` on every agent call, so the script manipulates
 * validated objects instead of parsing text it hopes is well-formed.
 *
 * Reach for this whenever the script has to *do* something with the results —
 * sort, count, filter, compare — rather than hand them straight to you.
 *
 * args: { dimensions?: string[] }  — review angles, default bugs + perf
 *
 * Run: ask the model — "run the workflow at
 * examples/workflows/structured-findings.js".
 */
export const meta = {
  name: 'structured-findings',
  description: 'Review changed files across dimensions and verify each finding',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          severity: { type: 'string' },
        },
        required: ['title', 'file'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: { isReal: { type: 'boolean' }, why: { type: 'string' } },
  required: ['isReal'],
}

const dimensions = args?.dimensions ?? ['bugs', 'performance']

const reviewed = await pipeline(
  dimensions,
  dim => agent(`Review the changed files for ${dim}. Report every finding.`, {
    label: `review:${dim}`,
    phase: 'Review',
    // With a schema the call resolves to the validated object, so `.findings`
    // below is a real array rather than something scraped out of prose.
    schema: FINDINGS,
  }),
  // A barrier is earned here only per-dimension: each dimension's findings are
  // verified concurrently, but dimensions never wait for each other.
  review => parallel(
    review.findings.map(f => () =>
      agent(`Try to REFUTE this finding: ${f.title} (${f.file})`, {
        label: `verify:${f.file}`,
        phase: 'Verify',
        schema: VERDICT,
      }).then(verdict => ({ ...f, verdict })),
    ),
  ),
)

// filter(Boolean) twice: once for a whole dimension that failed, once for an
// individual verification that did. A schema call can still return null.
const confirmed = reviewed
  .filter(Boolean)
  .flat()
  .filter(Boolean)
  .filter(f => f.verdict?.isReal)

return { confirmed: confirmed.length, findings: confirmed }

```

### Core Architecture Module: `src/abortable.ts`
```
/**
 * abortable.ts — race a promise against an AbortSignal without cancelling the
 * underlying work.
 *
 * Used by the `get_subagent_result` wait paths (top-level and nested): pressing
 * Esc cancels only the caller's wait; the background child keeps running and its
 * result stays unconsumed. The listener is removed on every settle path so the
 * signal accumulates no handlers, and a late settlement of the wrapped promise
 * after an abort is absorbed as a no-op (no unhandled rejection).
 */

/** Await a promise until it settles or the caller cancels, without aborting the underlying work. */
export function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(signal.reason);
    };

    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      },
    );
  });
}

```

### Core Architecture Module: `src/agent-color.ts`
```
/**
 * agent-color.ts — Claude Code-compatible agent name badges.
 *
 * Claude Code renders a subagent's name as a badge: the configured color is the
 * background, the text an inverse foreground. Its eight named colors are
 * reproduced here, along with six-digit hex and the extra palette names Agency
 * Agents uses, so those definitions render as written.
 */

import { getConfig } from "./agent-types.js";

const NAMED_AGENT_COLORS: Readonly<Record<string, string>> = {
  // Claude Code's eight subagent colors, as its default theme renders them.
  red: "#DC2626",
  blue: "#6A9BCC",
  green: "#16A34A",
  yellow: "#CA8A04",
  purple: "#827DBD",
  orange: "#D97757",
  pink: "#C46686",
  cyan: "#0891B2",
  // Agency Agents palette aliases.
  amber: "#F59E0B",
  teal: "#008080",
  indigo: "#6366F1",
  gold: "#EAB308",
  "neon-green": "#10B981",
  "neon-cyan": "#06B6D4",
  "metallic-blue": "#3B82F6",
  violet: "#8B5CF6",
  rose: "#F43F5E",
  lime: "#84CC16",
  gray: "#6B7280",
  grey: "#6B7280",
  fuchsia: "#D946EF",
  slate: "#64748B",
  navy: "#1E3A8A",
};

const CUBE_VALUES = [0, 95, 135, 175, 215, 255];
const GRAY_VALUES = Array.from({ length: 24 }, (_, i) => 8 + i * 10);
const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };

type Rgb = { r: number; g: number; b: number };
type ColorMode = "truecolor" | "256color";

export interface AgentNameTheme {
  fg(color: string, text: string): string;
  bold(text: string): string;
  getColorMode?(): ColorMode;
}

export interface AgentNameStyle {
  /** Existing theme foreground used when no valid agent color is configured. */
  fallbackColor?: string;
  /** Reapply an enclosing background after the badge instead of resetting it. */
  restoreBackground?: string;
  bold?: boolean;
}

/** Resolve Claude Code/Agency Agents color syntax to normalized #RRGGBB. */
export function resolveAgentColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  const resolved = NAMED_AGENT_COLORS[normalized] ?? normalized;
  return /^#[0-9a-f]{6}$/i.test(resolved) ? resolved.toUpperCase() : undefined;
}

function parseHex(hex: string): Rgb {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

/** Index of the entry in `values` closest to `value`. */
function nearest(values: readonly number[], value: number): number {
  return values.reduce((best, v, i) => (Math.abs(value - v) < Math.abs(value - values[best]) ? i : best), 0);
}

/**
 * Quantize to the xterm-256 palette the way pi's own theme does, returning both
 * the index to emit and the color the terminal will actually show — badge
 * contrast is judged against the latter.
 */
function rgbTo256({ r, g, b }: Rgb): { index: number; rgb: Rgb } {
  const [rIndex, gIndex, bIndex] = [r, g, b].map((channel) => nearest(CUBE_VALUES, channel));
  const distance = ({ r: cr, g: cg, b: cb }: Rgb) => 0.299 * (r - cr) ** 2 + 0.587 * (g - cg) ** 2 + 0.114 * (b - cb) ** 2;
  const grayIndex = nearest(GRAY_VALUES, Math.round(0.299 * r + 0.587 * g + 0.114 * b));
  const gray = { r: GRAY_VALUES[grayIndex], g: GRAY_VALUES[grayIndex], b: GRAY_VALUES[grayIndex] };
  const cube = { r: CUBE_VALUES[rIndex], g: CUBE_VALUES[gIndex], b: CUBE_VALUES[bIndex] };
  // Only near-neutral colors may take the gray ramp; anything else keeps its tint.
  if (Math.max(r, g, b) - Math.min(r, g, b) < 10 && distance(gray) < distance(cube)) {
    return { index: 232 + grayIndex, rgb: gray };
  }
  return { index: 16 + 36 * rIndex + 6 * gIndex + bIndex, rgb: cube };
}

function ansiColor(layer: "foreground" | "background", color: Rgb | number): string {
  const code = layer === "foreground" ? 38 : 48;
  return typeof color === "number"
    ? `\u001b[${code};5;${color}m`
    : `\u001b[${code};2;${color.r};${color.g};${color.b}m`;
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const linear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/**
 * Render one name as a padded background badge when `color` is valid. Claude
 * Code uses one inverse color for every badge's text; black or white is picked
 * by WCAG contrast here instead, so each palette entry stays readable. Invalid
 * or omitted colors preserve the caller's existing theme styling.
 */
export function renderAgentNameLabel(
  name: string,
  color: string | undefined,
  theme: AgentNameTheme,
  style: AgentNameStyle = {},
): string {
  const resolved = resolveAgentColor(color);
  if (!resolved) {
    const text = style.bold ? theme.bold(name) : name;
    return style.fallbackColor ? theme.fg(style.fallbackColor, text) : text;
  }

  const rgb = parseHex(resolved);
  const quantized = (theme.getColorMode?.() ?? "truecolor") === "256color" ? rgbTo256(rgb) : undefined;
  const shown = quantized?.rgb ?? rgb;
  const contrasting = relativeLuminance(shown) > 0.179 ? BLACK : WHITE;
  const label = style.bold ? theme.bold(` ${name} `) : ` ${name} `;

  return ansiColor("background", quantized?.index ?? rgb)
    + ansiColor("foreground", quantized ? rgbTo256(contrasting).index : contrasting)
    + label
    + "\u001b[39m"
    + (style.restoreBackground ?? "\u001b[49m");
}

/** Whether an agent renders as a badge — i.e. it has a valid configured color. */
export function hasAgentBadge(type: string | undefined): boolean {
  return type !== undefined && resolveAgentColor(getConfig(type).color) !== undefined;
}

/** Render a registered agent's display name with its configured color. */
export function renderAgentName(
  type: string | undefined,
  theme: AgentNameTheme,
  style: AgentNameStyle = {},
): string {
  if (!type) return renderAgentNameLabel("Agent", undefined, theme, style);
  const config = getConfig(type);
  return renderAgentNameLabel(config.displayName, config.color, theme, style);
}

```

### Core Architecture Module: `src/agent-file-toggle.ts`
```
/**
 * agent-file-toggle.ts — Pure helpers for the `/agents` file-editing operations:
 * locating an agent's .md file, toggling its `enabled:` frontmatter flag, and
 * serializing an AgentConfig back to frontmatter for eject.
 *
 * These live outside src/index.ts so they can be tested directly: the `/agents`
 * command handler is an ~890-line closure reached only through `registerCommand`,
 * which every test mocks.
 *
 * The read side of this data (src/custom-agents.ts) parses frontmatter with a
 * real YAML parser, so it honors `enabled: false` at any position in the block.
 * This module must agree with it, and splits the work accordingly:
 *
 * - Deciding whether a file is disabled is a *read*, so it calls that same parser
 *   (`isDisabledContent`) instead of mirroring it. A mirror has to be right about
 *   YAML's boolean spellings and about pi's fence scan, and a regex was wrong
 *   about both.
 * - *Editing* cannot go through the parser, because re-serializing a parsed
 *   document would reformat a file the README tells users to hand-author —
 *   discarding their comments, key order, and quoting. So the edits are line-wise
 *   and preserve everything they don't touch.
 *
 * That leaves removal best-effort: it recognizes a lowercase bare `false`, and
 * reports `changed: false` for the spellings it cannot rewrite, so the caller
 * refuses honestly rather than announcing a change it did not make.
 */

import { existsSync } from "node:fs";
import { join, sep } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { parseAgentFrontmatter } from "./custom-agents.js";
import type { AgentConfig } from "./types.js";

export type AgentFileLocation = "project" | "workspace" | "personal";

export const projectAgentsDir = (cwd: string = process.cwd()) => join(cwd, ".pi", "agents");
export const workspaceAgentsDir = (cwd: string = process.cwd()) => join(cwd, ".agents", "agents");
export const personalAgentsDir = () => join(getAgentDir(), "agents");

/**
 * Find the file path of a custom agent by name, in discovery-precedence order
 * (project, workspace, then global). Mirrors the load-side precedence in
 * src/custom-agents.ts — if the two drift, `/agents` edits a file the loader
 * isn't reading.
 */
export function findAgentFile(
  name: string,
  cwd: string = process.cwd(),
): { path: string; location: AgentFileLocation } | undefined {
  const projectPath = join(projectAgentsDir(cwd), `${name}.md`);
  if (existsSync(projectPath)) return { path: projectPath, location: "project" };
  const workspacePath = join(workspaceAgentsDir(cwd), `${name}.md`);
  if (existsSync(workspacePath)) return { path: workspacePath, location: "workspace" };
  const personalPath = join(personalAgentsDir(), `${name}.md`);
  if (existsSync(personalPath)) return { path: personalPath, location: "personal" };
  return undefined;
}

/**
 * Find the file behind a *loaded* agent, preferring the path the loader
 * actually read (`AgentConfig.sourcePath`) over the `<type>.md` guess.
 *
 * An agent's type comes from its frontmatter `name:` now, so the two can
 * disagree: `reviewer.md` declaring `name: code-reviewer` is loaded as
 * `code-reviewer`, and probing for `code-reviewer.md` finds nothing. That is
 * not a harmless miss — `/agents → Disable` would then take the no-file branch
 * and write a NEW `code-reviewer.md` stub, which loses to `reviewer.md` on
 * load, leaving the agent enabled while reporting success.
 *
 * The probe stays as the fallback: a built-in that was never ejected has no
 * `sourcePath`, and a path can go stale between a load and this call.
 */
export function locateAgentFile(
  name: string,
  sourcePath: string | undefined,
  cwd: string = process.cwd(),
): { path: string; location: AgentFileLocation } | undefined {
  if (sourcePath && existsSync(sourcePath)) {
    return { path: sourcePath, location: classifyAgentDir(sourcePath, cwd) };
  }
  return findAgentFile(name, cwd);
}

/**
 * Which discovery location a loaded agent's file came from. Only ever names
 * a directory in a confirmation prompt, so an unrecognized parent — which
 * loadCustomAgents cannot currently produce — reports as personal rather than
 * widening the type for a case that has no better answer.
 */
function classifyAgentDir(path: string, cwd: string): AgentFileLocation {
  if (path.startsWith(projectAgentsDir(cwd) + sep)) return "project";
  if (path.startsWith(workspaceAgentsDir(cwd) + sep)) return "workspace";
  return "personal";
}

export type DisableOutcome = "disabled" | "already-disabled" | "no-frontmatter";

/** A line that sets `enabled: false`, ignoring trailing whitespace / CR. */
const ENABLED_FALSE = /^enabled:[ \t]*false[ \t]*$/;
/** An opening or closing `---` fence line. */
const FENCE = /^---[ \t]*$/;

/**
 * Split a file into its frontmatter lines and everything else, agreeing with
 * what `parseAgentFrontmatter` (the load side) considers a frontmatter block —
 * including its BOM normalisation, which is why the fence test looks past one.
 * The BOM itself stays in `lines[0]`: it belongs to the file's encoding, not to
 * the block, and an edit must not strip it from the user's file.
 *
 * Lines keep their terminators, so an edit preserves the file's existing line
 * endings instead of rewriting CRLF to LF. Returns undefined when there is no
 * usable block.
 */
function splitFrontmatter(content: string):
  | { lines: string[]; openIdx: number; closeIdx: number; eol: string }
  | undefined {
  const lines = content.split(/(?<=\n)/);
  if (lines.length === 0) return undefined;
  // The BOM stays where it is — it belongs to the file, not the block — so the
  // fence test looks past it and every index below is unaffected.
  const bom = content.startsWith("\uFEFF");
  const first = (bom ? lines[0].slice(1) : lines[0]).replace(/\r?\n$/, "");
  if (!FENCE.test(first)) return undefined;
  const closeIdx = lines.findIndex((l, i) => i > 0 && FENCE.test(l.replace(/\r?\n$/, "")));
  if (closeIdx === -1) return undefined;
  return { lines, openIdx: 0, closeIdx, eol: lines[0].endsWith("\r\n") ? "\r\n" : "\n" };
}

/**
 * Does the loader consider this file disabled?
 *
 * Detection is a READ operation, so it asks the same parser the loader uses
 * rather than mirroring it with a regex — that mirror has to be right about
 * YAML's boolean spellings (`False`, `FALSE`, a trailing `# comment`, a quoted
 * key) *and* about pi's fence scan, which closes the block on any line starting
 * `---` and so ends it early on `----`. A throw means the file is already
 * unparseable, which is what the loader sees too: it skips the agent, so there
 * is no "disabled" state to report.
 */
export function isDisabledContent(content: string): boolean {
  try {
    return parseAgentFrontmatter<Record<string, unknown>>(content).frontmatter.enabled === false;
  } catch {
    return false;
  }
}

/**
 * Add `enabled: false` to a file's frontmatter.
 *
 * `outcome` distinguishes a real edit from a no-op so the caller can report
 * honestly instead of unconditionally claiming success.
 */
export function disableInContent(content: string): { content: string; outcome: DisableOutcome } {
  const block = splitFrontmatter(content);
  if (!block) return { content, outcome: "no-frontmatter" };
  if (isDisabledContent(content)) return { content, outcome: "already-disabled" };
  const lines = [...block.lines];
  lines.splice(1, 0, `enabled: false${block.eol}`);
  return { content: lines.join(""), outcome: "disabled" };
}

/**
 * Remove `enabled: false` from a file's frontmatter, wherever it appears in the
 * block — the loader honors the key at any position, so the two must agree or a
 * hand-authored agent can be disabled and never re-enabled.
 *
 * `changed` is false when the key wasn't found, so the caller can avoid
 * reporting "Enabled <name>" for a write that did nothing.
 */
export function enableInContent(content: string): { content: string; changed: boolean } {
  const block = splitFrontmatter(content);
  if (!block) return { content, changed: false };
  const kept = block.lines.filter(
    (l, i) => !(i > 0 && i < block.closeIdx && ENABLED_FALSE.test(l.replace(/\r?\n$/, ""))),
  );
  if (kept.length === block.lines.length) return { content, changed: false };
  return { content: kept.join(""), changed: true };
}

/** Is this the empty stub `/agents` writes when disabling a built-in default? */
export function isEmptyStub(content: string): boolean {
  return content.replace(/\r\n/g, "\n").trim() === "---\n---";
}

/** The answers `/agents → Create agent → Manual` collects, before serialization. */
export interface NewAgentInput {
  description: string;
  /** Already-resolved `tools:` value ("none", "all", or a CSV of tool names). */
  tools: string;
  /** `provider/modelId`, or undefined to inherit the parent's model. */
  model?: string;
  /** A pi thinking level, or undefined to inherit. */
  thinking?: string;
  systemPrompt: string;
}

/**
 * Build the .md file the create wizard writes.
 *
 * `description` and `model` come straight from a free-text prompt, so they are
 * quoted rather than interpolated — `serializeAgentFile` above quotes the
 * description for the same reason. An unquoted YAML scalar mishandles ordinary
 * input in two ways, and both are silent: a colon ("Scout: find things") makes
 * the file unparseable, and since #212 an unparseable agent file is *skipped*,
 * so the wizard reports success for an agent that does not exist; a `#`
 * ("audit #security") opens a comment and truncates the value. `model` can
 * carry a colon too — pi accepts a `provider/model:thinking` suffix.
 *
 * `tools` and `thinking` are not quoted: both are chosen from fixed menus, and
 * `tools` is a CSV that must stay a bare scalar for the loader's parser.
 */
export function buildNewAgentFile(input: NewAgentInput): string {
  const modelLine = input.model ? `\nmodel: ${JSON.stringify(input.model)}` : "";
  const thinkingLine = input.think
```

### Core Architecture Module: `src/agent-manager.ts`
```
/**
 * agent-manager.ts — Tracks agents, background execution, resume support.
 *
 * There are two independent concurrency pools, never one:
 *
 * - Background (`maxConcurrent`, default 10) bounds detached agents.
 * - Foreground (`maxConcurrentForeground`, default 0 = unlimited) bounds
 *   agents a caller is blocking on inline — `spawnAndWait`.
 *
 * Independent by design: a foreground agent blocks the parent anyway, so
 * charging it to the background pool would let a saturated pool starve the main
 * session of work it could have done itself. Excess agents in either pool are
 * queued and auto-started as slots free up. Nested children take no slot in
 * either — see `occupiesPoolSlot` / `occupiesForegroundSlot`.
 */

import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { isAbsolute } from "node:path";
import type { Model } from "@earendil-works/pi-ai";
import type { AgentSession, ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { resumeAgent, runAgent, type ToolActivity } from "./agent-runner.js";
import { assignHandle, handleBase } from "./mention.js";
import { describeModel } from "./model-resolver.js";
import type { AgentInvocation, AgentRecord, AgentTombstone, IsolationMode, MentionResolution, SubagentType, ThinkingLevel } from "./types.js";
import { addUsage, type LifetimeUsage } from "./usage.js";
import type { CompiledSchema } from "./workflow/json-schema.js";
import { cleanupWorktree, createWorktree, isWorktreeIsolationEnabled, pruneWorktrees, } from "./worktree.js";

export type OnAgentComplete = (record: AgentRecord) => void;
export type OnAgentStart = (record: AgentRecord) => void;
export type OnAgentCompact = (record: AgentRecord, info: CompactionInfo) => void;
/**
 * Fired once per assistant `message_end`, for EVERY agent this manager owns —
 * top-level and nested alike, spawns and resumes. The one place where each
 * message is seen exactly once: `AgentRecord.lifetimeUsage` is deliberately
 * double-booked into ancestors (see `nested-tools.ts`) so a hidden child's spend
 * shows up on the record a human can see, which makes those records useless as
 * a basis for anything that must not count a message twice — parent-session
 * accounting above all.
 */
export type OnAgentUsage = (record: AgentRecord, usage: LifetimeUsage) => void;
export type CompactionInfo = { reason: "manual" | "threshold" | "overflow"; tokensBefore: number };

/**
 * Default max concurrent background agents.
 *
 * Raised from 4 when top-level spawns started defaulting to background
 * (`backgroundByDefault`): foreground agents bypass this pool entirely, so
 * while foreground was the default a fan-out of six ran six. With background
 * as the default every top-level agent takes a slot, and a limit of 4 would
 * have silently queued the tail of exactly the parallel fan-outs the `Agent`
 * tool description tells the model to send.
 */
const DEFAULT_MAX_CONCURRENT = 10;

/**
 * Default max concurrent foreground (blocking) agents — `0` = unlimited, the
 * extension's existing convention for "no ceiling" (`defaultMaxTurns`).
 *
 * Off by default because nothing here ever bounded foreground work, and pi
 * dispatches a message's tool calls through `Promise.all`, so an unqualified
 * fan-out of blocking `Agent` calls has always run all at once. Users who want
 * it bounded — chiefly local models, where parallel agents thrash the prompt
 * cache (#253) — opt in; everyone else keeps today's behaviour exactly.
 */
const DEFAULT_MAX_CONCURRENT_FOREGROUND = 0;

/**
 * How many evicted agents stay addressable by name. Only a bound on memory —
 * a session that spawns hundreds of agents shouldn't retain every one — and
 * far above the handful anyone keeps in their head.
 */
const MAX_TOMBSTONES = 100;

/**
 * Validate a caller-supplied SpawnOptions.cwd. `undefined`/`null` mean "unset"
 * (parent cwd). Anything else must be an absolute path to an existing
 * directory — curated errors instead of TypeErrors from path/fs internals
 * (RPC callers send arbitrary JSON: null, numbers, file paths).
 */
function assertValidSpawnCwd(cwd: unknown): asserts cwd is string | undefined | null {
  if (cwd == null) return;
  if (typeof cwd !== "string" || !isAbsolute(cwd)) {
    throw new Error(`SpawnOptions.cwd must be an absolute path: "${String(cwd)}"`);
  }
  let isDirectory = false;
  try {
    isDirectory = statSync(cwd).isDirectory();
  } catch {
    throw new Error(`SpawnOptions.cwd does not exist: "${cwd}"`);
  }
  if (!isDirectory) {
    throw new Error(`SpawnOptions.cwd is not a directory: "${cwd}"`);
  }
}

/**
 * Whether a record occupies one of the `maxConcurrent` background slots.
 * Nested children don't: their parent already holds a slot, so counting (and
 * therefore queueing) them would deadlock a parent that waits on its own child.
 *
 * Note this bounds nothing horizontally — the depth cap limits how DEEP nesting
 * goes, not how WIDE. A parent's only limit on concurrent children is that each
 * spawn costs it a turn, which is unbounded when max turns is unlimited.
 */
function occupiesPoolSlot(
  record: Pick<AgentRecord, "isBackground" | "parentAgentId" | "workflowId">,
): boolean {
  return !!record.isBackground && isTopLevelAgent(record);
}

/**
 * Whether a record is one of the session's own agents, rather than something
 * another agent or a workflow owns.
 *
 * The single definition behind every user-facing surface — the fleet list, the
 * widget, the `/agents` menus, `@handle` resolution, and the completion events
 * and session entries. An owned child reports through its owner, so surfacing
 * it separately would double-count the same work in the places a person reads.
 */
export function isTopLevelAgent(
  record: Pick<AgentRecord, "parentAgentId" | "workflowId">,
): boolean {
  return record.parentAgentId === undefined && record.workflowId === undefined;
}

/**
 * Whether a record occupies one of the `maxConcurrentForeground` slots.
 *
 * Keyed on `blocking` — a caller awaiting this record inline — rather than on
 * `isBackground === false`, because `spawn()` is also the funnel for DETACHED
 * starts (cross-extension RPC, `@handle` mentions, the registry) that may pass
 * `isBackground: false` and are documented to run immediately regardless. Those
 * block nobody, so bounding them buys nothing and would park a record with no
 * one waiting to release it.
 *
 * Nested children are excluded for the same reason as `occupiesPoolSlot`, and
 * more sharply: their parent is blocked *awaiting them*, so queueing a child
 * behind its own parent is a guaranteed deadlock rather than a possible one.
 * Enforced here rather than at the call site so no caller can reintroduce it.
 *
 * A workflow's children go out through `spawnAndWait` and so are `blocking`
 * too, and are excluded on the same `isTopLevelAgent` test as the background
 * pool: the run already caps how many of its agents run at once, and charging
 * them here as well would let one fan-out queue behind a limit meant for the
 * session's own work.
 *
 * Like the background pool this bounds width at the top level only — a parent's
 * own fan-out is limited by nothing but its turn budget.
 */
function occupiesForegroundSlot(
  record: Pick<AgentRecord, "blocking" | "parentAgentId" | "workflowId">,
): boolean {
  return !!record.blocking && isTopLevelAgent(record);
}

/** Which concurrency pool a spawn is charged to, if any. */
type Pool = "background" | "foreground";

interface SpawnArgs {
  pi: ExtensionAPI;
  ctx: ExtensionContext;
  type: SubagentType;
  prompt: string;
  options: SpawnOptions;
}

interface SpawnOptions {
  description: string;
  /**
   * Optional memorable name for this instance, becoming a second handle
   * (`@auth-audit`) alongside the type-derived one. Slugged, not validated —
   * anything unusable degrades via `handleBase` rather than failing the spawn.
   */
  name?: string;
  /**
   * Reopen this pi session file instead of starting a fresh conversation, so a
   * mention of an evicted agent continues where it left off. The agent's
   * definition is still resolved from its type, so the continuation runs under
   * the type's CURRENT config.
   */
  resumeSessionFile?: string;
  /**
   * Take an evicted agent's names back verbatim instead of allocating fresh
   * ones, so a resumed conversation keeps the handle the user just typed —
   * `handleBase(type)` cannot reproduce a numbered `explore-2`. Safe without an
   * `assignHandle` pass because tombstoned names are excluded from allocation
   * (`takenHandles`), so nothing live can be holding them.
   *
   * Internal capability, like `resumeSessionFile`: a forged handle would
   * duplicate a live agent's name and make `resolveMention` ambiguous, so
   * `spawnTopLevel` strips it from anything a caller sends.
   */
  reclaim?: { handle: string; alias?: string };
  model?: Model<any>;
  maxTurns?: number;
  isolated?: boolean;
  inheritContext?: boolean;
  thinkingLevel?: ThinkingLevel;
  isBackground?: boolean;
  /**
   * Skip whichever pool's queue check applies to this spawn — start immediately
   * even if the configured concurrency limit would otherwise queue it. The slot
   * is still COUNTED once the run starts, so a bypassing spawn transiently
   * exceeds the limit rather than being invisible to it.
   *
   * Used by the scheduler, so a fired job can't be deferred past its trigger
   * window, and by the `/agents` agent-file generator, which has no way to
   * cancel a wait (see its call site).
   */
  bypassQueue?: boolean;
  /**
   * A caller is awaiting this record inline (`spawnAndWait`) — what
   * `maxConcurrentForeground` bounds. Set only by `spawnAndWait`; stripped from
   * caller-supplied options by `spawnTopLevel`, since a forged `blocking` would
   * defer a detached start behind a queue its caller cannot see or release.
   */
  blocking?: boolean;
  /**
   * The workflow run this child belongs to, when a workf
```

### Core Architecture Module: `src/agent-runner.ts`
```
/**
 * agent-runner.ts — Core execution engine: creates sessions, runs agents, collects results.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import type { Model } from "@earendil-works/pi-ai";
import type { ExtensionContext, LoadExtensionsResult } from "@earendil-works/pi-coding-agent";
import {
  type AgentSession,
  type AgentSessionEvent,
  createAgentSession,
  DefaultResourceLoader,
  type ExtensionAPI,
  getAgentDir,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { BUILTIN_TOOL_NAMES, getAgentConfig, getConfig, getMemoryToolNames, getReadOnlyMemoryToolNames, getToolNamesForType } from "./agent-types.js";
import { runInChildSessionContext } from "./child-context.js";
import { buildParentContext, extractText } from "./context.js";
import { DEFAULT_AGENTS } from "./default-agents.js";
import { detectEnv } from "./env.js";
import { buildMemoryBlock, buildReadOnlyMemoryBlock } from "./memory.js";
import { createNestedSubagentTools, getMaxSubagentDepth, type NestedAgentManager } from "./nested-tools.js";
import { buildAgentPrompt, type PromptExtras } from "./prompts.js";
import { preloadSkills } from "./skill-loader.js";
import { createStructuredCapture, createStructuredOutputTool, structuredRetryPrompt } from "./structured-output.js";
import type { SubagentType, ThinkingLevel } from "./types.js";
import type { LifetimeUsage } from "./usage.js";
import type { CompiledSchema } from "./workflow/json-schema.js";

/**
 * Tool names registered by THIS extension. Single source of truth so the
 * registration sites (index.ts) and the subagent exclusion list below can't
 * drift apart. These are our own tools, not pi built-ins, so they can't be
 * derived from pi — but they only need defining once.
 */
export const SUBAGENT_TOOL_NAMES = {
  AGENT: "Agent",
  WORKFLOW: "SubagentWorkflow",
  GET_RESULT: "get_subagent_result",
  STEER: "steer_subagent",
} as const;

/** Names of tools registered by this extension that subagents must NOT inherit. */
const EXCLUDED_TOOL_NAMES: string[] = Object.values(SUBAGENT_TOOL_NAMES);

/**
 * Canonical name of an extension for `extensions: [...]` allowlist matching.
 * Lowercased — extension names match case-insensitively so `extensions: [Mcp]`
 * resolves the same as `[mcp]`. Tool names within `ext:foo/bar` are not affected.
 * Directory extensions (`foo/index.ts`) resolve to the parent directory name;
 * single-file extensions to the basename minus `.ts`/`.js`.
 */
export function extensionCanonicalName(extPath: string): string {
  const base = basename(extPath);
  const name = base === "index.ts" || base === "index.js"
    ? basename(dirname(extPath))
    : base.replace(/\.(ts|js)$/, "");
  return name.toLowerCase();
}

/**
 * The unscoped, lowercased npm short name of the pi package that DECLARES
 * `extPath` as an extension entry — or undefined if the entry doesn't belong to
 * such a package.
 *
 * Climbs from the entry's directory looking for the package that owns it, and
 * stays strictly within that package's tree by stopping at two structural
 * boundaries — no hardcoded depth:
 *   - the FIRST `package.json` found (the package root); the entry's own
 *     manifest always sits at the root, above the entry, below any node_modules.
 *   - a `node_modules` directory: a package never spans one (it's where OTHER
 *     packages live), so reaching it means we've climbed out of the package —
 *     stop before reading a consumer's or parent package's manifest.
 * The name is then taken only when that root's `pi.extensions` manifest actually
 * lists this entry. That "declares this entry" check is deliberate: our own test
 * fixtures live under this repo, whose root manifest declares `./src/index.ts`
 * as `@tintinweb/pi-subagents`, so a looser rule would misattribute every
 * co-located file to `pi-subagents`.
 */
function extensionPackageName(extPath: string): string | undefined {
  const entry = resolve(extPath);
  let dir = dirname(extPath);
  for (;;) {
    // Climbing into node_modules means we've left the owning package's tree.
    if (basename(dir) === "node_modules") return undefined;
    let pkg: { name?: unknown; pi?: { extensions?: unknown } };
    try {
      pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return undefined; // walked to the filesystem root
      dir = parent;
      continue;
    }
    // First package.json wins — it's the package root; decide here.
    const entries = pkg.pi?.extensions;
    if (
      typeof pkg.name === "string" &&
      Array.isArray(entries) &&
      entries.some((e) => typeof e === "string" && resolve(dir, e) === entry)
    ) {
      const short = pkg.name.startsWith("@") ? pkg.name.slice(pkg.name.indexOf("/") + 1) : pkg.name;
      return short.toLowerCase();
    }
    return undefined;
  }
}

/**
 * All names an extension answers to for allowlist matching (lowercased): its
 * path-derived {@link extensionCanonicalName} plus, when a pi package manifest
 * declares this entry, that package's unscoped short name (`@scope/foo` → `foo`).
 * #143: an extension installed via `pi.extensions: ["./src/index.ts"]` would
 * otherwise only ever match as `src` (the source directory), never by its
 * package name. The path-derived name is preserved, so it keeps matching too.
 */
export function extensionCanonicalNames(extPath: string): string[] {
  const canonical = extensionCanonicalName(extPath);
  const pkg = extensionPackageName(extPath);
  return pkg && pkg !== canonical ? [canonical, pkg] : [canonical];
}

/**
 * Classify `extensions: string[]` frontmatter entries for the loader-level filter.
 *
 * An entry is a PATH iff it contains a path separator or starts with `~`; otherwise
 * it is a NAME. `"*"` sets the wildcard flag (keep all default-discovered extensions).
 *
 * Path entries are resolved (`~` expanded, made absolute against `cwd`) into `paths`
 * — and their canonical name is also added to `names`. The loader override matches
 * everything by canonical name, so path-loaded extensions are matched via their name
 * rather than their post-staging `Extension.path`.
 */
export function parseExtensionsSpec(
  entries: string[],
  cwd: string,
): { names: Set<string>; paths: string[]; wildcard: boolean } {
  const names = new Set<string>();
  const paths: string[] = [];
  let wildcard = false;
  for (const entry of entries) {
    if (!entry) continue;
    if (entry === "*") {
      wildcard = true;
      continue;
    }
    const isPathEntry = entry.includes("/") || entry.includes("\\") || entry.startsWith("~");
    if (!isPathEntry) {
      names.add(entry.toLowerCase());
      continue;
    }
    let p = entry;
    if (p === "~" || p.startsWith("~/") || p.startsWith("~\\")) {
      p = homedir() + p.slice(1);
    }
    const abs = isAbsolute(p) ? p : resolve(cwd, p);
    paths.push(abs);
    names.add(extensionCanonicalName(abs));
  }
  return { names, paths, wildcard };
}

/**
 * Parse raw `ext:` selector strings (from the `tools:` CSV) into the set of
 * extension names to keep loaded and a per-extension tool-narrowing map.
 *
 * `ext:foo` → `extNames` has `foo`, no narrowing entry (all of foo's tools).
 * `ext:foo/bar` → `extNames` has `foo`, `narrowing.foo` has `bar` (only `bar`).
 * A name lands in `narrowing` only when a `/tool` form is seen, so a bare
 * `ext:foo` alongside `ext:foo/bar` leaves narrowing in effect (narrowing wins).
 * The split is on the first `/`; extension canonical names never contain `/`.
 */
export function parseExtSelectors(entries: string[]): {
  extNames: Set<string>;
  narrowing: Map<string, Set<string>>;
} {
  const extNames = new Set<string>();
  const narrowing = new Map<string, Set<string>>();
  for (const raw of entries) {
    if (!raw) continue;
    const body = raw.slice("ext:".length);
    const slash = body.indexOf("/");
    // Extension name matches case-insensitively (matches the loader-side canonical
    // name). Tool names are case-preserved — they're matched against pi-mono's
    // registered identifiers, which are case-sensitive.
    const name = (slash === -1 ? body : body.slice(0, slash)).trim().toLowerCase();
    if (!name) continue;
    extNames.add(name);
    if (slash === -1) continue;
    const tool = body.slice(slash + 1).trim();
    if (!tool) continue;
    let set = narrowing.get(name);
    if (!set) {
      set = new Set();
      narrowing.set(name, set);
    }
    set.add(tool);
  }
  return { extNames, narrowing };
}

/**
 * Keep a subagent's tool scope correct as extensions register tools over time.
 *
 * Extensions may call `registerTool` long after load — pi-mcp from `session_start`,
 * context-mode from `before_agent_start` — so scope has to be re-derived rather than
 * snapshotted. `registerTool` writes into the very `extension.tools` maps this reads,
 * so `inScope()` sees late arrivals on the next call.
 *
 * Two enforcement points, because neither covers the whole picture:
 *
 *   - `turn_end` re-narrows the ACTIVE set. pi emits `turn_end` immediately before
 *     `prepareNextTurn` re-snapshots `agent.state.tools`, and session listeners run
 *     synchronously, so the narrow lands in time for turns 2..N.
 *   - `beforeToolCall` blocks out-of-scope calls. Turn 1 cannot be narrowed at all:
 *     `before_agent_start` fires INSIDE `prompt()` and may widen the tool set, but
 *     `createContextSnapshot()` freezes that turn's tools immediately after — there
 *     is no hook in between. A call-time check is the only correct guard there.
 *
 * Both are installed on the session and deliberately NOT unsubscribed: they must
 * outlive the `runAgent` call so resumed/steered turns stay scoped. pi's `dispose()`
 * clears `_eventListeners`, so they die with the session rather than leaking.
 *
 * Only meaningful when extensions are lo
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #249** (2026-08-19): **fix(ui): track RPC-spawned agent activity - continuation of #181**
  *Symptoms*: supersedes, closes https://github.com/tintinweb/pi-subagents/pull/181

- **Issue #238** (2026-08-17): **fix(isolation): accept "off" and add a worktreeIsolation project switch**
  *Symptoms*: Fixes #231. Refs #184. Supersedes #201 (closed by its author as "no longer reproduces" on 2026-08-14 — #231 reproduced it 3/3 the next day).  ## The diagnosis is schema shape, not prompting  The session log attached to #231 (`openai-codex` / `gpt-5.6-sol`) shows the model filling **every** optional parameter on all three `Agent` calls:  ```json { "isolation": "worktree", "model": "default", "thinking": "high",   "max_turns": 20, "run_in_background": false, "resume": "",   "isolated": false, "inherit_context": false, "schedule": "" } ```  `resume: ""` and `schedule: ""` are the tell. The model isn't *choosing* a worktree — it's refusing to omit anything. Every other optional field has an inert filler; `isolation` was the only one whose sole legal value had an expensive side effect. That is the design flaw @tinysnake named in #184.  It isn't fixable by wording. Across three rounds the model's reasoning ("Adjusting API call by removing isolation"), its user-facing text ("should completely omit `isolation`"), the subagent prompt it wrote (*不要创建或使用 worktree*) and two explicit user instructions all said omit — and the structured call still contained `"worktree"` every time. Each run then reviewed an empty `git diff --cached` inside a clean worktree and returned nothing.  ## Changes  **1. `isolation: "off"`** — both tool schemas, built once and shared so they cannot drift. `off` is listed first and described as the default; the field description now also warns that a worktree cannot

- **Issue #63** (2026-05-12): **Alternative for PgUp/PgDown?**
  *Symptoms*: I'm on a macbook with german keyboard layout, I don't have Page up and Page Down keys. Would you consider adding alternative keys to listen to page scrolls? I.e. A/S or Y/X or Z/X?

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

### Incident Patch 1: `e955e29c` (2026-09-03)
**Commit Message**: fix: stand down for lowercase `workflow` tools (#283)

FOREIGN_WORKFLOW_TOOL_NAMES matched only `Workflow` and
`SubagentWorkflow`, so @quintinshaw/pi-dynamic-workflows — which
registers lowercase `workflow` — never tripped the collision check and
both orchestrators stayed in the tool spec with no warning.

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -7,6 +7,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+- **The workflow stand-down now recognises a lowercase `workflow` tool** ([#283](https://github.com/tintinweb/pi-subagents/issues/283) — thanks [@zampierilucas](https://github.com/zampierilucas)). The match is exact on purpose, and the set held `Workflow` and `SubagentWorkflow` only, so `@quintinshaw/pi-dynamic-workflows` — which registers lowercase `workflow` — never tripped it: with `workflowsEnabled` unset, both orchestrators reached the model and nothing warned. Adding the third name is the whole fix; exactness is kept, so a `list_workflows` still cannot take the feature down.
+
 ## [0.19.0] - 2026-08-25
 
 > **⚠️ Breaking — this release requires pi 0.84.0 or newer** (`peerDependencies` moves from `>=0.81.0`). `SubagentWorkflow` needs two host APIs that do not exist below it, and both fail the typecheck rather than degrading quietly — see the `Changed` entry below for which, and why neither was worth reimplementing to hold the old floor. npm flags an older pi at install time.
```

**File**: `src/workflow/collisions.ts` (modified, +4/-1)
```diff
@@ -46,11 +46,14 @@ import { SUBAGENT_TOOL_NAMES } from "../agent-runner.js";
  *
  * Our own name, because pi resolves a duplicate registration silently, and
  * Claude Code's bare `Workflow`, because a port of that tool is what a second
- * workflow extension most likely calls itself.
+ * workflow extension most likely calls itself. Lowercase `workflow` is the same
+ * tool by pi convention: it is what `@quintinshaw/pi-dynamic-workflows`
+ * registers, and the match here is exact, so the case has to be listed by hand.
  */
 export const FOREIGN_WORKFLOW_TOOL_NAMES: ReadonlySet<string> = new Set([
   SUBAGENT_TOOL_NAMES.WORKFLOW,
   "Workflow",
+  "workflow",
 ]);
 
 /** The fields of a registered tool this decision reads. */
```

**File**: `test/workflow-tool.test.ts` (modified, +21/-0)
```diff
@@ -1398,6 +1398,27 @@ describe("collisions with another extension", () => {
     expect(warnings(context).some(m => /other-ext/.test(m))).toBe(true);
   });
 
+  it("withdraws its tool when another extension provides a lowercase `workflow` tool", async () => {
+    // #283: `@quintinshaw/pi-dynamic-workflows` — the second orchestrator most
+    // likely to be installed alongside this one — registers its tool as
+    // lowercase `workflow`. The match is exact, so the name has to be listed by
+    // hand; without it neither orchestrator stands down and the model is
+    // offered both, with no warning that it happened.
+    const booted = bootAuto();
+    booted.pi.getAllTools.mockReturnValue([
+      foreign("workflow", "pi-dynamic-workflows"),
+      foreign("workflow_control", "pi-dynamic-workflows"),
+    ]);
+    const context = uiContext();
+
+    await booted.lifecycle.get("session_start")?.({}, context);
+
+    expect(booted.pi.getActiveTools()).not.toContain("SubagentWorkflow");
+    expect(booted.pi.getActiveTools()).toContain("Agent");
+    expect(warnings(context).some(m => /already provides a "workflow" tool/.test(m))).toBe(true);
+    expect(warnings(context).some(m => /pi-dynamic-workflows/.test(m))).toBe(true);
+  });
+
   it("names the setting that keeps both", async () => {
     const booted = bootAuto();
     booted.pi.getAllTools.mockReturnValue([foreign("Workflow")]);
```

---

### Incident Patch 2: `4f572eaa` (2026-08-27)
**Commit Message**: fix linter warning

**File**: `test/workflow-tool-description.test.ts` (modified, +1/-0)
```diff
@@ -152,6 +152,7 @@ describe("rendering", () => {
     // A bare `${...}` in the .ts literal would interpolate at module load and
     // reach the model as a value (or throw), not as the example text.
     expect(description).not.toContain("[object Object]");
+    // biome-ignore lint/suspicious/noTemplateCurlyInString: the literal placeholder is the subject under test
     expect(description).toContain("${f.title}");
   });
 });
```

---

### Incident Patch 3: `3d910232` (2026-08-27)
**Commit Message**: fix: bound conversation viewer render cost (#264)

* fix: bound conversation viewer render cost

* fix: keep the viewer truncation notice readable at narrow widths

The notice goes through truncateToWidth at innerW (width - 4), so
"... (truncated, N more UTF-16 code units)" is cut mid-word on a
50-column terminal and leaves the reader a bare number. "characters"
keeps the O(1) count and fits. The unit was also uncountable by hand:
omitting an astral character plus one ASCII character reports 3.

Restores the RESULT_MAX_CHARS doc comment, which only changed to match
the previous wording.

* fix: abbreviate the omitted-character count in the viewer notice

A multi-megabyte result reports a seven-digit count, which tells the
reader nothing beyond "a lot" and pushes the notice past the width the
frame gives it. Report a magnitude instead: exact below 1000, then k/M
to one decimal.

The bracket is picked against the rounded value, so 999,999 reads 1M
rather than the 1000k a naive < 1e6 test produces.

---------

Co-authored-by: tintinweb <[REDACTED_EMAIL]>

**File**: `src/ui/conversation-viewer.ts` (modified, +21/-5)
```diff
@@ -116,12 +116,25 @@ function capResult(text: string): { text: string; elided: number } {
   if (text.length <= RESULT_MAX_CHARS) return { text, elided: 0 };
   return {
     text: text.slice(0, RESULT_MAX_CHARS),
-    elided: text.slice(RESULT_MAX_CHARS).split("\n").length,
+    elided: text.length - RESULT_MAX_CHARS,
   };
 }
 
+/**
+ * `999` · `1.5k` · `8.4M` — a magnitude cue, not an exact count, past 1000.
+ *
+ * The bracket is chosen against the *rounded* value, so 999,999 reads `1M`
+ * rather than the `1000.0k` a naive `< 1e6` test produces.
+ */
+function humanCount(n: number): string {
+  if (n < 1_000) return `${n}`;
+  const thousands = n < 999_950;
+  const value = thousands ? n / 1_000 : n / 1_000_000;
+  return `${value.toFixed(1).replace(/\.0$/, "")}${thousands ? "k" : "M"}`;
+}
+
 function truncationNote(elided: number): string {
-  return `... (truncated, ${elided} more line${elided === 1 ? "" : "s"})`;
+  return `... (truncated, ${humanCount(elided)} more character${elided === 1 ? "" : "s"})`;
 }
 
 export class ConversationViewer implements Component {
@@ -391,7 +404,7 @@ export class ConversationViewer implements Component {
   }
 
   /** Render `text` as Markdown, reusing this message's component instance. */
-  private markdownLines(msg: object, text: string, width: number, dim: boolean): string[] {
+  private markdownLines(msg: AgentSession["messages"][number], text: string, width: number, dim: boolean): string[] {
     let entry = this.markdownCache.get(msg);
     if (!entry) {
       entry = {
@@ -411,10 +424,13 @@ export class ConversationViewer implements Component {
       };
       this.markdownCache.set(msg, entry);
     } else if (entry.text !== text) {
-      // Streaming: the message object is stable, its text grows.
+      // Streaming: the message object is stable, its text grows. A failed
+      // prefix remains unsafe after append-only deltas, so retry only when the
+      // content was replaced or truncated.
+      const shouldRetry = !text.startsWith(entry.text);
       entry.md.setText(text);
       entry.text = text;
-      entry.failed = false;
+      if (shouldRetry) entry.failed = false;
     }
     if (entry.failed) return this.rawLines(text, width, dim);
 
```

**File**: `test/conversation-viewer.test.ts` (modified, +59/-12)
```diff
@@ -10,6 +10,8 @@ import type { AgentRecord } from "../src/types.js";
 let wrapOverride: ((text: string, width: number) => string[]) | null = null;
 /** Bumped per `new Markdown(...)`, so a test can assert the per-message cache holds. */
 let markdownConstructions = 0;
+/** Bumped per Markdown render attempt, including failed ones. */
+let markdownRenderCalls = 0;
 /** Forces the Markdown component to throw, for the viewer's fallback path. */
 let markdownThrows = false;
 
@@ -23,6 +25,7 @@ vi.mock("@earendil-works/pi-tui", async (importOriginal) => {
         super(...args);
       }
       render(width: number): string[] {
+        markdownRenderCalls++;
         // Real trigger is ~54 nested blockquotes overflowing pi-tui's recursive
         // renderer. Forced rather than reproduced: a real overflow costs ~2.4s
         // and its depth depends on the platform's stack limit, so reproducing it
@@ -92,6 +95,7 @@ function assertAllLinesFit(lines: string[], width: number) {
 beforeEach(() => {
   wrapOverride = null;
   markdownConstructions = 0;
+  markdownRenderCalls = 0;
   markdownThrows = false;
 });
 
@@ -500,7 +504,7 @@ describe("ConversationViewer", () => {
 
       expect(out).toContain("line 100");                       // far past the old 500-char cut
       expect(out).not.toContain("line 2999");                  // but still bounded
-      expect(out).toMatch(/\.\.\. \(truncated, \d+ more lines\)/);
+      expect(out).toMatch(/\.\.\. \(truncated, [\d.]+[kM]? more characters\)/);
     });
 
     it("puts the truncation notice outside the code fence it cut into", () => {
@@ -511,33 +515,76 @@ describe("ConversationViewer", () => {
 
       // Appended into the content it lands inside the unterminated fence, where
       // it picks up the code-block indent and reads as a line of the tool's source.
-      expect(note).toMatch(/^\.\.\. \(truncated, \d+ more lines\)$/);
+      expect(note).toMatch(/^\.\.\. \(truncated, [\d.]+[kM]? more characters\)$/);
     });
 
-    it("falls back to literal wrapping when the Markdown parser throws", () => {
+    it("reports the exact omitted character count", () => {
+      // UTF-16 code units, so the astral character here counts as two.
+      const text = `${"x".repeat(RESULT_MAX_CHARS)}😀x`;
+      const viewer = viewerFor(result(text));
+      const content = ((viewer as any).buildContentLines(76) as string[]).map(strip);
+
+      expect(content).toContain("... (truncated, 3 more characters)");
+    });
+
+    it("abbreviates a large omitted count so the notice fits a narrow frame", () => {
+      // The notice goes through truncateToWidth at innerW (width - 4). An exact
+      // count runs to seven digits on a multi-megabyte result and pushes the
+      // notice past 46, where the unit is cut off and only a number survives.
+      const text = `${"x".repeat(RESULT_MAX_CHARS)}${"y".repeat(1_100_000)}`;
+      const note = viewerFor(result(text)).render(50).map(strip).find(l => l.includes("truncated,"));
+
+      expect(note).toContain("1.1M more characters)");
+    });
+
+    it("rounds into the M bracket rather than reporting 1000k", () => {
+      // 999,999 / 1000 rounds to 1000.0 — the bracket has to be picked against
+      // the rounded value, not the raw one.
+      const text = `${"x".repeat(RESULT_MAX_CHARS)}${"y".repeat(999_999)}`;
+      const note = strip(viewerFor(result(text)).render(80).join("\n")).split("\n").find(l => l.includes("truncated,"));
+
+      expect(note).toContain("1M more characters");
+    });
+
+    it("falls back to literal wrapping once for an unsafe streaming prefix", () => {
       // render() is on the TUI's critical path, so a parser throw must degrade
       // rather than take the overlay down with it.
-      const viewer = viewerFor(result("# heading"), "all");
+      const messages = result("# heading");
+      const viewer = viewerFor(messages, "all");
       markdownThrows = true;
 
       expect(() => viewer.render(80)).not.toThrow();
       expect(strip(viewer.render(80).join("\n"))).toContain("# heading");
 
-      // And the failure is remembered — otherwise the throw repeats on every
-      // render and every scroll key. Still literal once the parser would work.
+      // An append-only delta keeps the unsafe prefix, so it must stay literal
+      // without retrying the recursive parser on every streamed update.
+      messages[0].content[0].text += "\nmore";
+      expect(strip(viewer.render(80).join("\n"))).toContain("more");
+      expect(markdownRenderCalls).toBe(1);
+
       markdownThrows = false;
       expect(strip(viewer.render(80).join("\n"))).toContain("# heading");
+      expect(markdownRenderCalls).toBe(1);
+
+      // Replacing the failed content can remove the unsafe prefix, so it gets
+      // one fresh Markdown attempt instead of staying literal forever.
+      messages[0].content[0].text = "## safe";
+      const replaced = strip(viewer.render(80).join("\n"));
+      expect(markdownRen
```

---

### Incident Patch 4: `084d177c` (2026-08-24)
**Commit Message**: fix(rpc): enforce scopeModels on the spawn path (#240)

subagents:rpc:spawn resolved options.model and handed it to the spawn
without ever calling checkModelScope, so the allowlist the Agent tool and
the nested tools enforce was bypassed by every cross-extension caller. An
orchestrator on openrouter passed model: "sonnet" through pi-tasks
TaskExecute; it fuzzy-resolved to anthropic/claude-sonnet-4 and ran,
billed to OpenRouter, with anthropic/* nowhere in enabledModels.

A model on the RPC payload is an orchestrator-level choice, exactly like
Agent({ model }), so it now gets the same hard error listing the allowed
models — the RPC envelope turns the throw into { success: false, error }
and pi-tasks reports the spawn as failed. callerSupplied is
unconditionally true here, so the verdict is only ever ok or error;
frontmatter-pinned and parent-inherited models resolve later, in
agent-runner, and keep warn-and-proceed. The check reads the RESOLVED
model, since resolveModel is fuzzy enough to land on a provider the
caller never named.

The guard covers any override, not just the serialized string form, so an
in-process caller passing a Model object can't slip past it either — which
make

**File**: `README.md` (modified, +1/-0)
```diff
@@ -514,6 +514,7 @@ When on, each subagent spawn's effective model is validated against pi's own `en
 | Model source | Out-of-scope behavior |
 |---|---|
 | Caller-supplied via `Agent({ model: "..." })` | Hard error returned to the orchestrator, listing allowed models |
+| Caller-supplied via cross-extension RPC (`subagents:rpc:spawn`, e.g. pi-tasks `TaskExecute`) | Hard error returned to the calling extension, listing allowed models |
 | Pinned in agent frontmatter | Warning toast + the pinned model runs (frontmatter is authoritative) |
 | Parent-inherited (neither set) | Warning toast + parent's model runs |
 
```

**File**: `src/cross-extension-rpc.ts` (modified, +39/-13)
```diff
@@ -10,6 +10,7 @@
  */
 
 import { type ModelRegistry, resolveModel } from "./model-resolver.js";
+import { checkModelScope } from "./model-scope.js";
 
 /** Minimal event bus interface needed by the RPC handlers. */
 export interface EventBus {
@@ -98,21 +99,46 @@ export function registerRpcHandlers(deps: RpcDeps): RpcHandle {
       // agent's auth lookup doesn't crash with "No API key found for
       // undefined".
       let normalizedOptions = options ?? {};
-      if (typeof normalizedOptions.model === "string") {
-        const registry = (ctx as { modelRegistry?: ModelRegistry }).modelRegistry;
-        if (!registry) {
-          throw new Error(
-            `Model override "${normalizedOptions.model}" provided but ctx.modelRegistry is unavailable`,
-          );
+      // `!= null` on purpose: a JSON-forwarding caller can serialize an unset
+      // field as null, and the runner reads `options.model ?? default`, so null
+      // means "inherit" — not an override to resolve or scope-check.
+      const override = normalizedOptions.model;
+      if (override != null) {
+        const { modelRegistry, cwd } = ctx as { modelRegistry?: ModelRegistry; cwd?: string };
+        // Names the override the same way in both messages below; an object
+        // override would otherwise interpolate as "[object Object]".
+        const label = typeof override === "string" ? override : `${override.provider}/${override.id}`;
+        if (!modelRegistry) {
+          throw new Error(`Model override "${label}" provided but ctx.modelRegistry is unavailable`);
         }
-        const resolved = resolveModel(normalizedOptions.model, registry);
-        if (typeof resolved === "string") {
-          // resolveModel returns a human-readable error string when the
-          // input doesn't match any available model. Surface it instead of
-          // silently falling back so the caller sees the auth/typo issue.
-          throw new Error(resolved);
+        let model = override;
+        if (typeof override === "string") {
+          const resolved = resolveModel(override, modelRegistry);
+          if (typeof resolved === "string") {
+            // resolveModel returns a human-readable error string when the
+            // input doesn't match any available model. Surface it instead of
+            // silently falling back so the caller sees the auth/typo issue.
+            throw new Error(resolved);
+          }
+          model = resolved;
+          normalizedOptions = { ...normalizedOptions, model: resolved };
         }
-        normalizedOptions = { ...normalizedOptions, model: resolved };
+
+        // A model on the RPC payload is an orchestrator-level choice, exactly
+        // like Agent({ model }) — so it gets the Agent tool's hard error, never
+        // the frontmatter warn (#240). The check reads the RESOLVED model:
+        // resolveModel is fuzzy, so a bare "sonnet" can land on a provider the
+        // caller never named. Frontmatter-pinned and parent-inherited models are
+        // resolved later, in agent-runner, and keep warn-and-proceed.
+        const verdict = checkModelScope({
+          model,
+          cwd: cwd ?? process.cwd(),
+          modelRegistry,
+          callerSupplied: true,
+          agentLabel: type,
+          modelInput: label,
+        });
+        if (verdict.kind === "error") throw new Error(verdict.message);
       }
 
       return { id: manager.spawn(pi, ctx, type, prompt, normalizedOptions) };
```

**File**: `test/cross-extension-rpc.test.ts` (modified, +118/-1)
```diff
@@ -1,5 +1,9 @@
-import { beforeEach, describe, expect, it, vi } from "vitest";
+import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 import { type EventBus, PROTOCOL_VERSION, type RpcDeps, registerRpcHandlers, type SpawnCapable } from "../src/cross-extension-rpc.js";
+import { isScopeModelsEnabled, setScopeModelsEnabled } from "../src/model-scope.js";
 
 /** Simple in-process event bus for testing. */
 function createEventBus(): EventBus {
@@ -343,6 +347,25 @@ describe("cross-extension RPC", () => {
       expect(manager.spawn).not.toHaveBeenCalled();
     });
 
+    it("treats an explicit null model as no override at all", async () => {
+      // A JSON-forwarding caller can serialize an unset field as null. The
+      // runner reads `options.model ?? default`, so null means "inherit" —
+      // it must not be resolved, scope-checked, or dereferenced.
+      registerRpcHandlers(deps);
+      const reply = vi.fn();
+      events.on("subagents:rpc:spawn:reply:req-m5", reply);
+      events.emit("subagents:rpc:spawn", {
+        requestId: "req-m5", type: "general-purpose", prompt: "x",
+        options: { model: null },
+      });
+
+      await vi.waitFor(() => expect(reply).toHaveBeenCalled());
+      expect(reply).toHaveBeenCalledWith({ success: true, data: { id: "agent-42" } });
+      expect(manager.spawn).toHaveBeenCalledWith(
+        deps.pi, ctx, "general-purpose", "x", { model: null },
+      );
+    });
+
     it("errors when ctx has no modelRegistry but a string model is given", async () => {
       ctx = { session: true }; // no modelRegistry
       registerRpcHandlers(deps);
@@ -360,4 +383,98 @@ describe("cross-extension RPC", () => {
       expect(manager.spawn).not.toHaveBeenCalled();
     });
   });
+  // --- scopeModels on the RPC spawn path (#240): an override on the RPC
+  //     payload is an orchestrator-level choice, so it gets the Agent tool's
+  //     hard error rather than reaching the spawn on an out-of-scope model. ---
+
+  describe("spawn RPC model scope", () => {
+    const ALLOWED = { id: "gpt-5.5", provider: "openai-codex", name: "GPT 5.5" };
+    const BLOCKED = { id: "claude-sonnet-4", provider: "anthropic", name: "Claude Sonnet 4" };
+    const MODELS = [ALLOWED, BLOCKED];
+    const registry = {
+      find: (provider: string, id: string) =>
+        MODELS.find(m => m.provider === provider && m.id === id) ?? null,
+      getAll: () => MODELS,
+      getAvailable: () => MODELS,
+    };
+
+    let projectDir: string;
+    let agentDir: string;
+    let prevAgentDir: string | undefined;
+    let prevEnabled: boolean;
+
+    beforeEach(() => {
+      // resolveEnabledModels memoizes on (patterns, mtime+size of both settings
+      // files) — a fresh project dir per test keeps one case's allowlist from
+      // being served to the next. Same harness as test/model-scope.test.ts.
+      projectDir = mkdtempSync(join(tmpdir(), "pi-rpc-scope-project-"));
+      agentDir = mkdtempSync(join(tmpdir(), "pi-rpc-scope-global-"));
+      prevAgentDir = process.env.PI_CODING_AGENT_DIR;
+      process.env.PI_CODING_AGENT_DIR = agentDir;
+      prevEnabled = isScopeModelsEnabled();
+      mkdirSync(join(projectDir, ".pi"), { recursive: true });
+      writeFileSync(
+        join(projectDir, ".pi", "settings.json"),
+        JSON.stringify({ enabledModels: ["openai-codex/gpt-5.5"] }),
+      );
+      setScopeModelsEnabled(true);
+      ctx = { session: true, cwd: projectDir, modelRegistry: registry };
+      deps = { events, pi: { events }, getCtx: () => ctx, manager };
+    });
+
+    afterEach(() => {
+      setScopeModelsEnabled(prevEnabled); // module-global — restore for other suites
+      if (prevAgentDir == null) delete process.env.PI_CODING_AGENT_DIR;
+      else process.env.PI_CODING_AGENT_DIR = prevAgentDir;
+      rmSync(projectDir, { recursive: true, force: true });
+      rmSync(agentDir, { recursive: true, force: true });
+    });
+
+    async function spawn(requestId: string, model: unknown) {
+      registerRpcHandlers(deps);
+      const reply = vi.fn();
+      events.on(`subagents:rpc:spawn:reply:${requestId}`, reply);
+      events.emit("subagents:rpc:spawn", {
+        requestId, type: "general-purpose", prompt: "x", options: { model },
+      });
+      await vi.waitFor(() => expect(reply).toHaveBeenCalled());
+      return (reply as ReturnType<typeof vi.fn>).mock.calls[0][0];
+    }
+
+    it("refuses an out-of-scope string override, listing what is allowed", async () => {
+      // The reported case: a bare "sonnet" fuzzy-resolves across providers, so
+      // only the RESOLVED model can be compared against enabledModels.
+      const call = await spawn("req-sc1", "sonnet");
+      expect(call.success).toBe(false);
+      expect(call.error).toMatch(/Model not in scope/);
+      expect(call.error)
```

---

### Incident Patch 5: `723349f8` (2026-08-24)
**Commit Message**: test(perf): add a benchmark suite, CI-safe perf guards, and an A/B harness

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -31,6 +31,9 @@ Thumbs.db
 .claude
 .vscode
 coverage/
+
+# Benchmark output — absolute timings are machine-specific, never committed
+test/perf/.results/
 .gitnexus
 .pi/subagents.json
 
```

**File**: `AGENTS.md` (modified, +1/-0)
```diff
@@ -35,6 +35,7 @@
 - `npm run test` runs the whole suite, including `*-e2e.test.ts` files. To iterate on a single file, run it directly: `npx vitest run test/<file>.test.ts`.
 - If you create or modify a test file, run it and iterate on the test or implementation until it passes.
 - `npm run build` compiles with `tsc`; run it only when verifying the build output or when requested.
+- `npm run bench` runs the benchmarks in `test/perf/*.bench.ts` (absolute timings, ~1 min). Opt-in: it is not part of the check suite, and `npm run test` never picks bench files up. `npm run bench:ab -- <ref>` benchmarks the working tree against another commit and prints the delta — use it for a PR's `## Performance` section. The `*.perf.test.ts` guards beside them assert operation counts, not time, and DO run in the normal suite.
 - For ad-hoc scripts, write them to a temp file (e.g. `/tmp`), run, edit if needed, remove when done. Don't embed multi-line scripts in `bash` commands.
 
 ## Git
```

**File**: `CONTRIBUTING.md` (modified, +4/-0)
```diff
@@ -53,6 +53,10 @@ npm run build       # tsc
 All four must pass. `npm run lint:fix` will auto-fix most style issues, and
 `npm run test:e2e` runs the end-to-end suite if your change touches that surface.
 
+If your change touches a render path or the spawn path, `npm run bench` prints
+absolute timings and `npm run bench:ab -- master` compares them against master.
+Neither is required to pass; both are opt-in, and neither runs in CI.
+
 Other guidelines:
 
 - Keep PRs focused — one logical change per PR. Unrelated refactors make review
```

**File**: `package.json` (modified, +3/-1)
```diff
@@ -42,7 +42,9 @@
     "typecheck": "tsc --noEmit",
     "lint": "biome check src/ test/",
     "lint:fix": "biome check --fix src/ test/",
-    "test:coverage": "vitest run --coverage"
+    "test:coverage": "vitest run --coverage",
+    "bench": "vitest bench",
+    "bench:ab": "node test/perf/ab.mjs"
   },
   "devDependencies": {
     "@biomejs/biome": "^2.4.14",
```

**File**: `test/helpers/perf-fixtures.ts` (added, +276/-0)
```diff
@@ -0,0 +1,276 @@
+/**
+ * perf-fixtures.ts — the stubs the performance suite measures against.
+ *
+ * Three consumers share this: the benchmarks (`test/perf/*.bench.ts`), the
+ * invariant guards (`test/perf/*.perf.test.ts`), and the A/B harness
+ * (`test/perf/ab.mjs`), which copies this file into a worktree of an older
+ * commit and runs the same benchmarks there. That last consumer is why the
+ * builders here stay structural — plain object literals satisfying the shapes
+ * `AgentWidget`, `FleetList` and `ConversationViewer` accept — rather than
+ * importing anything from `src/`. A fixture that reached into production types
+ * would stop compiling the moment it travelled to a tree where those types
+ * differ, which is exactly the tree the comparison exists to measure.
+ *
+ * DETERMINISM RULES, all of them learned from a measurement that lied:
+ *
+ *  - `NOW` is captured once at import and every `startedAt` is derived from it,
+ *    so the elapsed string keeps a stable character *width*. A hardcoded epoch
+ *    rendered `87563024.1s` in one run and `87563018.2s` in the next — one digit
+ *    wider, so a different truncation point, so a different amount of work. The
+ *    diff looked like a regression and was a clock.
+ *  - Nothing inside a measured closure calls `Date.now()` or allocates the
+ *    fixture; build it once, outside, and measure only the call under test.
+ *  - Surplus constructor arguments are passed unconditionally. JavaScript
+ *    ignores extra arguments, which is what lets one benchmark file run against
+ *    an older tree whose constructor took fewer. Do NOT feature-detect with
+ *    `AgentWidget.length`: parameters that have defaults are not counted, so it
+ *    reports the wrong arity and silently measures the wrong configuration.
+ */
+
+/** Identity theme: measure the render, not the ANSI. */
+export const perfTheme = {
+  fg: (_color: string, text: string) => text,
+  bold: (text: string) => text,
+} as any;
+
+/** Frozen "now". Every timestamp below hangs off this — see the header. */
+export const NOW = Date.now();
+
+/** A TUI stub. `columns` is read by widgets that size themselves. */
+export function perfTui(columns = 120, rows = 40) {
+  return { terminal: { columns, rows }, requestRender: () => {} } as any;
+}
+
+/**
+ * A session stub reporting live stats.
+ *
+ * Both halves are load-bearing. `FleetList.agentRecords()` filters on
+ * `a.session`, so a record without one is invisible to the fleet list and the
+ * benchmark silently measures an empty bar. And `getSessionContextPercent()`
+ * reads `getSessionStats().contextUsage`, which the widget calls once per
+ * running agent per frame — returning stats rather than throwing is what keeps
+ * that call on the path it takes in production instead of its catch branch.
+ */
+export function perfSession(messages: unknown[] = []) {
+  return {
+    messages,
+    subscribe: () => () => {},
+    dispose: () => {},
+    getSessionStats: () => ({
+      tokens: { input: 12_000, output: 3_000, cacheWrite: 500 },
+      contextUsage: { percent: 42 },
+    }),
+  } as any;
+}
+
+export interface FleetOptions {
+  running?: number;
+  queued?: number;
+  finished?: number;
+}
+
+/**
+ * One agent record. `i` seeds every varying field so a fleet is heterogeneous
+ * (two agent types, growing token counts) without being random — a benchmark
+ * that changes shape between runs cannot be compared with itself.
+ */
+export function makeRecord(i: number, overrides: Record<string, unknown> = {}) {
+  return {
+    id: `perf-agent-${i}`,
+    type: i % 3 === 0 ? "Explore" : "general-purpose",
+    description: `agent ${i} inspecting a subsystem for the benchmark fixture`,
+    status: "running",
+    toolUses: i % 7,
+    // Recent and fixed: a ~1s elapsed renders as a stable-width "1.0s".
+    startedAt: NOW - 1000 - (i % 5) * 100,
+    completedAt: undefined as number | undefined,
+    lifetimeUsage: { input: 1000 + i * 37, output: 200 + i * 11, cacheRead: 0, cacheWrite: 0 },
+    compactionCount: i % 3,
+    invocation: {
+      modelName: "sonnet 4.6",
+      modelId: "anthropic/claude-sonnet-4-6",
+      thinking: "high",
+      runInBackground: true,
+    },
+    isBackground: true,
+    session: perfSession(),
+    ...overrides,
+  };
+}
+
+/** A fleet in the mix the widget actually renders: running, queued, finished. */
+export function makeFleet(opts: FleetOptions = {}): ReturnType<typeof makeRecord>[] {
+  const { running = 3, queued = 0, finished = 0 } = opts;
+  const out: ReturnType<typeof makeRecord>[] = [];
+  let i = 0;
+  for (let n = 0; n < running; n++) out.push(makeRecord(i++));
+  for (let n = 0; n < queued; n++) out.push(makeRecord(i++, { status: "queued" }));
+  for (let n = 0; n < finished; n++) out.push(makeRecord(i++, { status: "completed", completedAt: NOW }));
+  return out;
+}
+
+/** Live per-agent activity, keyed by id, as the widget and fleet list expect. */
+export function makeActivity(recor
```

**File**: `test/perf/ab.mjs` (added, +196/-0)
```diff
@@ -0,0 +1,196 @@
+/**
+ * ab.mjs — run the benchmarks against the working tree AND against another git
+ * ref, then print the difference.
+ *
+ *   npm run bench:ab -- master
+ *   npm run bench:ab -- HEAD~1 --rounds 5 --filter viewer
+ *
+ * This is the question `vitest bench --compare` cannot answer. `--compare` only
+ * annotates a run with a stored baseline and never fails; more importantly the
+ * baseline has to have been produced by the other tree, which is precisely the
+ * work this script does. Here the comparison is built fresh, from the same
+ * benchmark sources, on the machine you are sitting at.
+ *
+ * METHOD, and why each part is there:
+ *
+ *  - One process per measurement. Two configurations benchmarked in one process
+ *    are not comparable: this repo produced a 7% spread between identical code
+ *    paths purely from JIT ordering.
+ *  - Rounds alternate A, B, A, B. A machine that gets busy mid-run then damages
+ *    both trees rather than whichever went second.
+ *  - Each round contributes its MEDIAN sample, and the reported number is the
+ *    fastest of those rounds. Noise only ever adds time, so the lowest
+ *    observation sits closest to the truth; the median makes each round robust
+ *    to a single outlier rather than letting one GC pause set the number.
+ *  - The working tree's benchmark files and fixtures are COPIED into the base
+ *    worktree before it runs. The base commit does not contain them; without
+ *    this the older side silently benchmarks nothing.
+ *  - Surplus arguments are ignored by JavaScript, which is what lets one
+ *    benchmark file drive an older constructor. A benchmark that names a symbol
+ *    the base lacks fails only that task, and is reported as "n/a" rather than
+ *    taking the run down.
+ */
+import { execFileSync } from "node:child_process";
+import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+
+const REPO = process.cwd();
+const PERF_DIR = join("test", "perf");
+const FIXTURES = join("test", "helpers", "perf-fixtures.ts");
+
+function usage(message) {
+  if (message) console.error(`\n  ${message}`);
+  console.error(`
+  Usage: npm run bench:ab -- <ref> [--rounds N] [--filter substring]
+
+    <ref>       git ref to compare the working tree against (e.g. master, HEAD~1)
+    --rounds    how many alternating A/B rounds to run (default 3)
+    --filter    only benchmark files whose path contains this substring
+`);
+  process.exit(message ? 1 : 0);
+}
+
+function parseArgs(argv) {
+  const opts = { ref: undefined, rounds: 3, filter: undefined };
+  for (let i = 0; i < argv.length; i++) {
+    const arg = argv[i];
+    if (arg === "--help" || arg === "-h") usage();
+    else if (arg === "--rounds") opts.rounds = Number(argv[++i]);
+    else if (arg === "--filter") opts.filter = argv[++i];
+    else if (!opts.ref) opts.ref = arg;
+    else usage(`Unexpected argument: ${arg}`);
+  }
+  if (!opts.ref) usage("Missing <ref>.");
+  if (!Number.isInteger(opts.rounds) || opts.rounds < 1) usage("--rounds must be a positive integer.");
+  return opts;
+}
+
+const git = (...args) => execFileSync("git", args, { cwd: REPO, encoding: "utf-8" }).trim();
+
+/** Run the benchmarks in `cwd`, returning task name → median ms per sample. */
+function runBench(cwd, filter, jsonPath) {
+  const args = ["vitest", "bench", ...(filter ? [filter] : []), `--outputJson=${jsonPath}`];
+  try {
+    execFileSync("npx", args, { cwd, stdio: "ignore" });
+  } catch {
+    // A failed task still writes the file for everything that did run; a missing
+    // file means the whole run died, which the caller reports as "n/a".
+    if (!existsSync(jsonPath)) return null;
+  }
+  if (!existsSync(jsonPath)) return null;
+
+  const report = JSON.parse(readFileSync(jsonPath, "utf-8"));
+  const out = new Map();
+  for (const file of report.files ?? []) {
+    for (const group of file.groups ?? []) {
+      // Group names are absolute-path-prefixed; strip so the two trees agree.
+      const groupName = String(group.fullName ?? "").replace(/^.*\.bench\.ts > /, "");
+      for (const bench of group.benchmarks ?? []) {
+        // Median, not mean: the spawn task does real disk I/O and throws the
+        // occasional millisecond-scale outlier, which drags a mean around by
+        // tens of percent between runs while the median barely moves.
+        out.set(`${groupName} > ${bench.name}`, bench.median ?? bench.mean);
+      }
+    }
+  }
+  return out;
+}
+
+/** Keep the fastest round per task. */
+function mergeMin(into, sample) {
+  if (!sample) return;
+  for (const [name, value] of sample) {
+    const prev = into.get(name);
+    if (prev == null || value < prev) into.set(name, value);
+  }
+}
+
+function fmt(ms) {
+  if (ms == null) return "n/a";
+  if (ms >= 1) return `${ms.toFixed(3)}ms`;
+  if (ms >= 0.001) return `${(ms * 1000).
```

**File**: `test/perf/formatters.bench.ts` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+/**
+ * formatters.bench.ts — the leaf functions the render paths call per agent, per
+ * frame.
+ *
+ * These are individually tiny, which is the reason to isolate them: when a
+ * widget or fleet-list benchmark moves, this file answers "was it the render or
+ * something underneath it?" without bisecting. `buildInvocationTags` in
+ * particular is called once per running row when `showModel` is on, and
+ * `getSessionContextPercent` reaches into the live session on every row
+ * regardless.
+ *
+ * Absolute numbers here are nanoseconds and will look irrelevant next to a
+ * frame. They are — until one of them stops being O(1).
+ */
+import { bench, describe } from "vitest";
+import {
+  buildInvocationTags,
+  describeActivity,
+  formatCost,
+  formatDuration,
+  formatSessionTokens,
+  formatTurns,
+} from "../../src/ui/agent-widget.js";
+import { getLifetimeCost, getLifetimeTotal, getSessionContextPercent } from "../../src/usage.js";
+import { NOW, perfSession, perfTheme } from "../helpers/perf-fixtures.js";
+
+const INVOCATION = {
+  modelName: "sonnet 4.6",
+  modelId: "anthropic/claude-sonnet-4-6",
+  thinking: "high",
+  runInBackground: true,
+  maxTurns: 60,
+} as any;
+
+/** The disclosure shape: both "(asked …)" annotations live, as #257 renders them. */
+const INVOCATION_DISCLOSED = {
+  ...INVOCATION,
+  requestedModel: "google/gemini-3-pro",
+  requestedThinking: "max",
+} as any;
+
+const USAGE = { input: 12_000, output: 3_000, cacheRead: 400, cacheWrite: 500 };
+const SESSION = perfSession();
+
+const ACTIVE_TOOLS = new Map([
+  ["t1", "read"],
+  ["t2", "bash"],
+  ["t3", "grep"],
+]);
+
+describe("invocation tags", () => {
+  bench("buildInvocationTags — nothing overridden", () => {
+    buildInvocationTags(INVOCATION);
+  });
+
+  bench("buildInvocationTags — model and thinking disclosed", () => {
+    buildInvocationTags(INVOCATION_DISCLOSED);
+  });
+});
+
+describe("row formatters", () => {
+  bench("formatSessionTokens", () => {
+    formatSessionTokens(15_500, 42, perfTheme, 2);
+  });
+
+  bench("formatDuration", () => {
+    formatDuration(NOW - 90_000, undefined);
+  });
+
+  bench("formatTurns", () => {
+    formatTurns(4, 60);
+  });
+
+  bench("formatCost", () => {
+    formatCost(0.0123);
+  });
+
+  bench("describeActivity — three tools active", () => {
+    describeActivity(ACTIVE_TOOLS, "");
+  });
+
+  bench("describeActivity — streaming text", () => {
+    describeActivity(new Map(), "a partial assistant response still streaming in");
+  });
+});
+
+describe("usage leaves", () => {
+  bench("getLifetimeTotal", () => {
+    getLifetimeTotal(USAGE);
+  });
+
+  bench("getLifetimeCost", () => {
+    getLifetimeCost(USAGE);
+  });
+
+  bench("getSessionContextPercent", () => {
+    getSessionContextPercent(SESSION);
+  });
+});
```

**File**: `test/perf/no-fs-on-render.perf.test.ts` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+/**
+ * no-fs-on-render.perf.test.ts — a frame must not touch the disk.
+ *
+ * The widget and the conversation viewer redraw on every TUI frame, so a
+ * synchronous read on either path blocks the event loop at up to 62 Hz. Nothing
+ * on those paths reads today; this is the guard that keeps it that way, because
+ * the mistake is easy to make and impossible to see in a functional test — the
+ * output is identical either way, only the terminal stutters.
+ *
+ * `node:fs` is mocked wholesale rather than spied on: `src/` imports its
+ * functions by name (`import { readFileSync } from "node:fs"`), and a named ESM
+ * binding cannot be replaced after the importing module has been evaluated.
+ *
+ * Lives in its own file because that mock applies to the whole module graph;
+ * the other guards must not inherit it.
+ */
+import { describe, expect, it, vi } from "vitest";
+
+/** Every fs entry point a render path could plausibly reach. */
+const FS_CALLS: string[] = [];
+
+vi.mock("node:fs", async (importOriginal) => {
+  const actual = await importOriginal<typeof import("node:fs")>();
+  const watch = ["readFileSync", "readdirSync", "existsSync", "statSync", "lstatSync", "realpathSync"] as const;
+  const wrapped: Record<string, unknown> = { ...actual };
+  for (const name of watch) {
+    const original = (actual as any)[name];
+    wrapped[name] = (...args: unknown[]) => {
+      FS_CALLS.push(`${name}(${String(args[0])})`);
+      return original(...args);
+    };
+  }
+  return { ...wrapped, default: wrapped };
+});
+
+const { AgentWidget } = await import("../../src/ui/agent-widget.js");
+const { ConversationViewer } = await import("../../src/ui/conversation-viewer.js");
+const { makeFleet, makeSession, mountViewer, mountWidget } = await import("../helpers/perf-fixtures.js");
+
+describe("a rendered frame touches no filesystem", () => {
+  it("AgentWidget.render", () => {
+    const w = mountWidget(AgentWidget, makeFleet({ running: 5, queued: 3, finished: 2 }));
+    w.render(); // construction and priming may legitimately read; the frame may not
+    FS_CALLS.length = 0;
+
+    w.render();
+    w.render();
+    w.dispose();
+
+    expect(FS_CALLS).toEqual([]);
+  });
+
+  it("ConversationViewer.render", () => {
+    const viewer = mountViewer(ConversationViewer, makeSession(40));
+    viewer.render(120);
+    FS_CALLS.length = 0;
+
+    viewer.render(120);
+    viewer.render(120);
+
+    expect(FS_CALLS).toEqual([]);
+  });
+});
```

---

### Incident Patch 6: `917853c2` (2026-08-24)
**Commit Message**: fix(ui): render markdown in the conversation viewer, scoped and toggleable (#259)

* fix(ui): render markdown in the conversation viewer, scoped and toggleable

The viewer wrapped every line with wrapTextWithAnsi, so assistant markdown
showed as raw fences and `#` markers, and tool results were cut at 500
characters (#210).

Assistant text now renders as markdown; tool results do not, by default. A
markdown pass over a tool result is lossy in ways that read as the tool
misbehaving: `# section` in a shell script loses its `#`, `3) 7) 9)` comes back
renumbered `3. 4. 5.`, a `---` line is swallowed as a setext heading, and
indented output is re-fenced. Assistant text is authored as markdown; a tool
result is arbitrary bytes.

viewerMarkdown (off | assistant | all) picks the scope, and `m` in the viewer
cycles it and persists the choice. That escape hatch is what makes rendering
safe to default on at all.

The 500-char cap is raised to 16k rather than removed, and now covers
bashExecution too. It bounds render cost, not just display: buildContentLines
runs on every render and on every scroll key, where an uncapped 200KB result
costs ~19ms per keystroke to re-parse against ~0.04ms for a

**File**: `README.md` (modified, +17/-3)
```diff
@@ -16,7 +16,7 @@ https://github.com/user-attachments/assets/8685261b-9338-4fea-8dfe-1c590d5df543
 - **Parallel background agents** — spawn multiple agents that run concurrently with automatic queuing (configurable concurrency limit, default 10) and smart group join (consolidated notifications)
 - **Live widget UI** — persistent above-editor widget with animated spinners, live tool activity, token counts, and colored status icons. Configurable via `/agents → Settings → Widget`: `all` (every agent), `background` (default — hides foreground runs, which already render inline as the `Agent` tool result), or `off`
 - **FleetView** — Claude Code-style navigable list of `main` + every running subagent rendered below the editor (earliest-launched first). Press `↓` (or `←`) at an empty prompt to jump in, `↑`/`↓` to move the selection, `Enter` to open the selected agent's live, auto-updating conversation, `Esc` to return. Finished agents linger briefly before dropping out, and a viewer stays open through completion so you can read the final output. Toggle via `/agents → Settings → Fleet view`
-- **Conversation viewer** — select any agent in `/agents` to open a live-scrolling overlay of its full conversation (auto-follows new content, scroll up to pause). Steer a running agent inline by pressing `Enter` to open a composer, typing, then `Enter` to send (`Esc` or an empty submit returns) — the message appears as a user message and redirects the agent after its current tool. Stop a still-running agent by pressing `x` (then `x` again to confirm) — both work for background agents too
+- **Conversation viewer** — select any agent in `/agents` to open a live-scrolling overlay of its full conversation (auto-follows new content, scroll up to pause). Steer a running agent inline by pressing `Enter` to open a composer, typing, then `Enter` to send (`Esc` or an empty submit returns) — the message appears as a user message and redirects the agent after its current tool. Stop a still-running agent by pressing `x` (then `x` again to confirm) — both work for background agents too. Assistant text renders as Markdown; `m` cycles that between off, assistant-only and everything (see [Viewer markdown](#persistent-settings))
 - **Custom agent types** — define agents in `.pi/agents/<name>.md` or `.agents/agents/<name>.md` (project) or globally, with YAML frontmatter: custom system prompts, model selection, thinking levels, tool restrictions, and Claude Code-compatible colored name badges
 - **Nested subagents** — opt-in, default-off delegation: a custom agent that sets `allowed_subagents` gets its own ownership-scoped `Agent`, `get_subagent_result`, and `steer_subagent` tools, depth-capped from the main session (default 2). It can control only its own children, they are stopped when it finishes, and their transcripts and token spend roll up to it. The allowlist is a privilege boundary — a child runs with its own tools, so pick it as carefully as `tools:` itself
 - **Agent mentions** — subagents are first-class: type `@explore also check the RPC path` at the prompt and it goes to that agent instead of the main model, without a word of it entering the chat. One syntax covers the whole lifecycle — message it while it runs, resume it once it has finished, reopen its session from disk long after that, or start it if it never ran. Mentioning an agent that isn't running spawns it through an off-screen clone of the conversation, so it gets Claude Code's context-written prompt and a real `Agent` tool call without a word of it reaching the chat; `direct` mode starts it here from your text instead, with no model call at all. The orchestrator can `name` an agent so you address it as `@auth-audit`, and handles work in `steer_subagent`/`get_subagent_result` too. `@` completes live agents, resumable ones, and startable types alongside pi's file completion; `@main` forces text back to the main model. Toggle via `/agents → Settings → Agent mentions`
@@ -442,7 +442,7 @@ Create new agent                            ← manual wizard or AI-generated
 Settings                                    ← max concurrency, max turns, grace turns, join mode
 ```
 
-- **Running agents** — select one to open its live conversation viewer. While it's still running, press `Enter` to open the steering composer, then `Enter` again to send a message that redirects the agent (same mechanism as the `steer_subagent` tool; `Esc` or an empty submit returns), or press `x` (then `x` again to confirm) to stop/abort it — including **background** agents, which a global Esc can't unambiguously target (Esc still stops a blocking foreground `Agent` call). A stopped agent reports its partial output flagged as incomplete, not as a completion.
+- **Running agents** — select one to open its live conversation viewer. While it's still running, press `Enter` to open the steering composer, then `Enter` again to send a message that redirects the agent (same mechanism as the `steer_subagent` tool; `Esc` o
```

**File**: `src/agent-file-toggle.ts` (modified, +14/-6)
```diff
@@ -27,7 +27,8 @@
 
 import { existsSync } from "node:fs";
 import { join, sep } from "node:path";
-import { getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";
+import { getAgentDir } from "@earendil-works/pi-coding-agent";
+import { parseAgentFrontmatter } from "./custom-agents.js";
 import type { AgentConfig } from "./types.js";
 
 export type AgentFileLocation = "project" | "workspace" | "personal";
@@ -101,18 +102,25 @@ const FENCE = /^---[ \t]*$/;
 
 /**
  * Split a file into its frontmatter lines and everything else, agreeing with
- * what `parseFrontmatter` (the load side) considers a frontmatter block.
+ * what `parseAgentFrontmatter` (the load side) considers a frontmatter block —
+ * including its BOM normalisation, which is why the fence test looks past one.
+ * The BOM itself stays in `lines[0]`: it belongs to the file's encoding, not to
+ * the block, and an edit must not strip it from the user's file.
  *
  * Lines keep their terminators, so an edit preserves the file's existing line
  * endings instead of rewriting CRLF to LF. Returns undefined when there is no
- * usable block — notably for a BOM-prefixed file, which the parser also reads
- * as having none, so writing a key into it would change nothing on load.
+ * usable block.
  */
 function splitFrontmatter(content: string):
   | { lines: string[]; openIdx: number; closeIdx: number; eol: string }
   | undefined {
   const lines = content.split(/(?<=\n)/);
-  if (lines.length === 0 || !FENCE.test(lines[0].replace(/\r?\n$/, ""))) return undefined;
+  if (lines.length === 0) return undefined;
+  // The BOM stays where it is — it belongs to the file, not the block — so the
+  // fence test looks past it and every index below is unaffected.
+  const bom = content.startsWith("\uFEFF");
+  const first = (bom ? lines[0].slice(1) : lines[0]).replace(/\r?\n$/, "");
+  if (!FENCE.test(first)) return undefined;
   const closeIdx = lines.findIndex((l, i) => i > 0 && FENCE.test(l.replace(/\r?\n$/, "")));
   if (closeIdx === -1) return undefined;
   return { lines, openIdx: 0, closeIdx, eol: lines[0].endsWith("\r\n") ? "\r\n" : "\n" };
@@ -131,7 +139,7 @@ function splitFrontmatter(content: string):
  */
 export function isDisabledContent(content: string): boolean {
   try {
-    return parseFrontmatter<Record<string, unknown>>(content).frontmatter.enabled === false;
+    return parseAgentFrontmatter<Record<string, unknown>>(content).frontmatter.enabled === false;
   } catch {
     return false;
   }
```

**File**: `src/custom-agents.ts` (modified, +20/-1)
```diff
@@ -151,9 +151,28 @@ function loadFromDir(dir: string, agents: Map<string, AgentConfig>, source: "pro
  * Under `strict` the same failure rethrows, still naming the path, so callers
  * that opted into failing closed stop rather than run a substituted agent.
  */
+/**
+ * Parse an agent file's frontmatter, tolerating a leading UTF-8 BOM.
+ *
+ * Editors across the Windows/CJK world write UTF-8 with a BOM by default, and
+ * pi's parser did not look past one before 0.84.3: the fence never matched, so
+ * the frontmatter came back empty and the *whole file* — YAML and all — became
+ * the body. An agent authored that way silently lost every field. `tools: none`
+ * going missing is the sharp edge: the agent registers with the default
+ * toolset rather than none, which is a wider grant than its author wrote.
+ *
+ * Stripped here rather than detected per pi version, because this is the only
+ * place agent files are read and the BOM is a file-encoding artifact, not
+ * content — normalising it at the boundary keeps one behaviour across the whole
+ * supported peer range instead of forking on what happens to be installed.
+ */
+export function parseAgentFrontmatter<T extends Record<string, unknown>>(content: string): { frontmatter: T; body: string } {
+  return parseFrontmatter<T>(content.startsWith("\uFEFF") ? content.slice(1) : content);
+}
+
 function readAgentFile(path: string, strict: boolean): { frontmatter: Record<string, unknown>; body: string } | undefined {
   try {
-    return parseFrontmatter<Record<string, unknown>>(readFileSync(path, "utf-8"));
+    return parseAgentFrontmatter<Record<string, unknown>>(readFileSync(path, "utf-8"));
   } catch (err) {
     const reason = err instanceof Error ? err.message : String(err);
     if (strict) throw new Error(`${path}: ${reason}`);
```

**File**: `src/index.ts` (modified, +44/-2)
```diff
@@ -36,7 +36,7 @@ import { SubagentScheduler } from "./schedule.js";
 import { resolveStorePath, ScheduleStore } from "./schedule-store.js";
 import { applyAndEmitLoaded, loadSettings, type SubagentsSettings, saveAndEmitChanged, type ToolDescriptionMode } from "./settings.js";
 import { getForegroundOutcomeNote, getStatusNote, partialOutputSuffix } from "./status-note.js";
-import { type AgentConfig, type AgentInvocation, type AgentMentionMode, type AgentRecord, type JoinMode, type NotificationDetails, type SubagentType, type WidgetMode } from "./types.js";
+import { type AgentConfig, type AgentInvocation, type AgentMentionMode, type AgentRecord, type JoinMode, type NotificationDetails, type SubagentType, type ViewerMarkdownMode, type WidgetMode } from "./types.js";
 import { createMentionProvider, mentionRoster, type TypeInfo } from "./ui/agent-mention.js";
 import {
   type AgentActivity,
@@ -387,6 +387,14 @@ export default function (pi: ExtensionAPI) {
   let showModel = false;
   function isShowModelEnabled(): boolean { return showModel; }
   function setShowModel(b: boolean): void { showModel = b; widget.update(); }
+  /**
+   * How much of the conversation viewer renders as Markdown. Read through a
+   * getter by the viewer rather than captured like `showCost`, because the
+   * viewer's `m` key writes back here while the overlay is on screen.
+   */
+  let viewerMarkdown: ViewerMarkdownMode = "assistant";
+  function getViewerMarkdown(): ViewerMarkdownMode { return viewerMarkdown; }
+  function setViewerMarkdown(mode: ViewerMarkdownMode): void { viewerMarkdown = mode; }
   const pendingUsage = new PendingUsagePool();
 
   // ---- Cancellable pending notifications ----
@@ -1314,6 +1322,7 @@ export default function (pi: ExtensionAPI) {
       setReportUsage,
       setShowCost,
       setShowModel,
+      setViewerMarkdown,
     },
     (event, payload) => pi.events.emit(event, payload),
   );
@@ -2497,7 +2506,10 @@ Terse command-style prompts produce shallow, generic work.
           if (manager.abort(record.id)) {
             ctx.ui.notify(`Stopped "${record.description}".`, "info");
           }
-        }, keybindings, (message: string) => manager.steer(record.id, message), showCost);
+        }, keybindings, (message: string) => manager.steer(record.id, message), showCost, getViewerMarkdown, (mode) => {
+          setViewerMarkdown(mode);
+          persistSettings(ctx, `Viewer markdown set to ${mode}`);
+        });
       },
       {
         overlay: true,
@@ -2883,6 +2895,7 @@ Write the file using the write tool. Only write the file, nothing else.`;
       reportUsage: isReportUsageEnabled(),
       showCost: isShowCostEnabled(),
       showModel: isShowModelEnabled(),
+      viewerMarkdown: getViewerMarkdown(),
     } satisfies SubagentsSettings;
   }
 
@@ -3030,6 +3043,14 @@ Write the file using the write tool. Only write the file, nothing else.`;
           currentValue: isShowModelEnabled() ? "on" : "off",
           values: ["on", "off"],
         },
+        {
+          id: "viewerMarkdown",
+          label: "Viewer markdown",
+          description:
+            "How much of the conversation viewer renders as Markdown. assistant = assistant text only (default); all = tool results too, for tools that emit Markdown — accepting that a Markdown pass over a diff or a log eats `#` comments, swallows a `---` line and re-fences indented output; off = everything verbatim. `m` in the viewer cycles the same setting (footer: raw / md / md+).",
+          currentValue: getViewerMarkdown(),
+          values: ["off", "assistant", "all"],
+        },
         {
           id: "fleetView",
           label: "Fleet view",
@@ -3178,6 +3199,9 @@ Write the file using the write tool. Only write the file, nothing else.`;
         const enabled = value === "on";
         setShowModel(enabled);
         notifyApplied(ctx, `Model display ${enabled ? "enabled" : "disabled"}`);
+      } else if (id === "viewerMarkdown") {
+        setViewerMarkdown(value as ViewerMarkdownMode);
+        notifyApplied(ctx, `Viewer markdown set to ${value}`);
       } else if (id === "fleetView") {
         const enabled = value === "on";
         setFleetViewEnabled(enabled);
@@ -3286,6 +3310,24 @@ Write the file using the write tool. Only write the file, nothing else.`;
   // the right toast. Successful saves show info; persistence failures downgrade
   // to warning so users aren't silently reverted on restart. Event fires regardless
   // of outcome so listeners see the in-memory change.
+  /**
+   * Persist + broadcast the settings, silent on success — for a change whose
+   * feedback is the UI it just changed: the viewer's `m` key, where a
+   * notification per press would talk over the overlay it is describing.
+   *
+   * A *failed* write still speaks. Every other settings path warns when the
+   * value is session-only, and swallowing it here would leave a preference
+   * looking persisted when the next session will
```

**File**: `src/settings.ts` (modified, +20/-1)
```diff
@@ -6,7 +6,7 @@ import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
 import { dirname, join } from "node:path";
 import { getAgentDir } from "@earendil-works/pi-coding-agent";
 import { NO_FALLBACK } from "./agent-types.js";
-import type { AgentMentionMode, JoinMode, WidgetMode } from "./types.js";
+import type { AgentMentionMode, JoinMode, ViewerMarkdownMode, WidgetMode } from "./types.js";
 
 export interface SubagentsSettings {
   maxConcurrent?: number;
@@ -246,6 +246,19 @@ export interface SubagentsSettings {
    * narrow terminal.
    */
   showModel?: boolean;
+  /**
+   * How much of the conversation viewer's transcript renders as Markdown.
+   * Defaults to `assistant`. Applied live — the viewer's `m` key cycles this
+   * same setting, so a choice made in the overlay persists like one made in
+   * `/agents → Settings`.
+   *
+   * Scoped rather than all-or-nothing because the two kinds of content have
+   * different contracts: assistant text is authored as Markdown, while a tool
+   * result is whatever bytes the tool produced. Rendering the latter as
+   * Markdown is lossy in ways that look like the tool misbehaved — see
+   * `ViewerMarkdownMode` for the specific rewrites — so `all` is opt-in.
+   */
+  viewerMarkdown?: ViewerMarkdownMode;
 }
 
 export type ToolDescriptionMode = "full" | "compact" | "custom";
@@ -273,6 +286,7 @@ export interface SettingsAppliers {
   setReportUsage: (b: boolean) => void;
   setShowCost: (b: boolean) => void;
   setShowModel: (b: boolean) => void;
+  setViewerMarkdown: (mode: ViewerMarkdownMode) => void;
 }
 
 /** Emit callback — a subset of `pi.events.emit` to keep helpers testable. */
@@ -281,6 +295,7 @@ export type SettingsEmit = (event: string, payload: unknown) => void;
 const VALID_JOIN_MODES: ReadonlySet<string> = new Set<JoinMode>(["async", "group", "smart"]);
 const VALID_TOOL_DESCRIPTION_MODES: ReadonlySet<string> = new Set<ToolDescriptionMode>(["full", "compact", "custom"]);
 const VALID_WIDGET_MODES: ReadonlySet<string> = new Set<WidgetMode>(["all", "background", "off"]);
+const VALID_VIEWER_MARKDOWN_MODES: ReadonlySet<string> = new Set<ViewerMarkdownMode>(["off", "assistant", "all"]);
 const VALID_AGENT_MENTION_MODES: ReadonlySet<string> = new Set<AgentMentionMode>(["model", "direct", "off"]);
 
 // Sanity ceilings — prevent hand-edited configs from asking for values that
@@ -376,6 +391,9 @@ function sanitize(raw: unknown): SubagentsSettings {
   if (typeof r.showModel === "boolean") {
     out.showModel = r.showModel;
   }
+  if (typeof r.viewerMarkdown === "string" && VALID_VIEWER_MARKDOWN_MODES.has(r.viewerMarkdown)) {
+    out.viewerMarkdown = r.viewerMarkdown as ViewerMarkdownMode;
+  }
   if (r.fallbackSubagent === false) {
     // The only non-string spelling worth accepting: a boolean would otherwise be
     // dropped, silently leaving the PERMISSIVE default in place. Every string is
@@ -457,6 +475,7 @@ export function applySettings(s: SubagentsSettings, appliers: SettingsAppliers):
   if (typeof s.reportUsage === "boolean") appliers.setReportUsage(s.reportUsage);
   if (typeof s.showCost === "boolean") appliers.setShowCost(s.showCost);
   if (typeof s.showModel === "boolean") appliers.setShowModel(s.showModel);
+  if (s.viewerMarkdown) appliers.setViewerMarkdown(s.viewerMarkdown);
 }
 
 /**
```

**File**: `src/types.ts` (modified, +15/-0)
```diff
@@ -101,6 +101,21 @@ export type JoinMode = 'async' | 'group' | 'smart';
  */
 export type WidgetMode = 'all' | 'background' | 'off';
 
+/**
+ * How much of the conversation viewer's transcript is rendered as Markdown.
+ * - `off`: every line wraps as literal text, as it did before the mode existed.
+ * - `assistant`: assistant text renders as Markdown; tool results stay verbatim
+ *   and dim. The default, because assistant text *is* Markdown by contract
+ *   while a tool result is arbitrary bytes — a Markdown pass over a log or a
+ *   diff eats `#` from shell comments, swallows a `---` line into a setext
+ *   heading, re-fences indented output and redraws `| a | b |` as a table.
+ *   (Ordered-list renumbering is the one such rewrite actively suppressed —
+ *   see `MARKDOWN_OPTIONS` — because it silently changes data, not layout.)
+ * - `all`: tool results render as Markdown too, for tools that genuinely emit
+ *   it (#210's `ctx_execute`), accepting the rewrites above on ones that don't.
+ */
+export type ViewerMarkdownMode = 'off' | 'assistant' | 'all';
+
 /**
  * How `@handle message` starts an agent that is not already running.
  * - `model`: inject Claude Code's `agent_mention` reminder and let the main
```

**File**: `src/ui/conversation-viewer.ts` (modified, +214/-18)
```diff
@@ -5,11 +5,11 @@
  * Subscribes to session events for real-time streaming updates.
  */
 
-import type { AgentSession } from "@earendil-works/pi-coding-agent";
-import { type Component, Input, matchesKey, type TUI, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
+import { type AgentSession, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
+import { type Component, Input, Markdown, type MarkdownOptions, type MarkdownTheme, matchesKey, type TUI, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
 import { renderAgentName } from "../agent-color.js";
 import { extractText } from "../context.js";
-import type { AgentRecord } from "../types.js";
+import type { AgentRecord, ViewerMarkdownMode } from "../types.js";
 import { getLifetimeCost, getLifetimeTotal, getSessionContextPercent } from "../usage.js";
 import type { Theme } from "./agent-widget.js";
 import { type AgentActivity, buildInvocationTags, describeActivity, fgPreservingNestedStyles, formatCost, formatDuration, formatSessionTokens, getPromptModeLabel } from "./agent-widget.js";
@@ -21,6 +21,109 @@ const MIN_VIEWPORT = 3;
 /** Height ceiling shared by the overlay's `maxHeight` and the viewer's internal viewport cap. */
 export const VIEWPORT_HEIGHT_PCT = 70;
 
+/**
+ * Cap on a single tool result or bash output before the viewer elides the rest.
+ *
+ * The cap is not cosmetic — it bounds render cost. `buildContentLines()` runs on
+ * every render *and* on every scroll key (`handleInput` calls it to compute
+ * `maxScroll`), so an uncapped 200 KB result costs ~6 ms per keystroke to parse
+ * as Markdown, against ~0.5 ms once capped and effectively nothing on a cache
+ * hit (best of 5, width 76). 16 KB is roughly a screenful at every terminal size
+ * and still ~30x the 500 characters this replaces, which was small enough to cut
+ * most real results mid-sentence.
+ */
+export const RESULT_MAX_CHARS = 16_000;
+
+/** Cycle order for the viewer's `m` key. */
+const MARKDOWN_MODES: readonly ViewerMarkdownMode[] = ["off", "assistant", "all"];
+
+/** Footer labels — short, because the idle footer is already full at 80 columns. */
+const MARKDOWN_MODE_LABELS: Record<ViewerMarkdownMode, string> = {
+  off: "raw",
+  assistant: "md",
+  all: "md+",
+};
+
+/**
+ * Both options keep the renderer from *rewriting* source that only looks like
+ * Markdown: without them `3) a / 7) b / 9) c` comes back renumbered `3. 4. 5.`
+ * and backslash escapes are normalized away. Neither is a safe edit to make to
+ * a tool's output, and both are cheap to switch off.
+ */
+const MARKDOWN_OPTIONS: MarkdownOptions = {
+  preserveOrderedListMarkers: true,
+  preserveBackslashEscapes: true,
+};
+
+/**
+ * Pi's own Markdown theme when this process has one, else a theme built from the
+ * viewer's `Theme`.
+ *
+ * Preferring pi's is what buys syntax-highlighted code fences (it carries a
+ * `highlightCode`), and it keeps this surface consistent with the notification
+ * renderer, which uses the same source. It has to be *probed* rather than
+ * try/caught around the call: `getMarkdownTheme()` returns arrow functions that
+ * read pi's global theme lazily, so an uninitialized theme throws inside
+ * `render()` — long after this returns — and takes the overlay with it. That is
+ * the case in tests and any embedded session that never called `initTheme()`.
+ */
+function resolveMarkdownTheme(th: Theme): MarkdownTheme {
+  try {
+    const piTheme = getMarkdownTheme();
+    piTheme.heading("probe");
+    return piTheme;
+  } catch {
+    return fallbackMarkdownTheme(th);
+  }
+}
+
+/**
+ * `Theme` carries only `fg` and `bold`, so the three remaining styles are
+ * written as raw SGR. Rendering them as plain text instead would silently drop
+ * `*emphasis*`'s markers with nothing in their place, turning a formatting
+ * change into a content change.
+ */
+function fallbackMarkdownTheme(th: Theme): MarkdownTheme {
+  const sgr = (on: number, off: number) => (text: string) => `\x1b[${on}m${text}\x1b[${off}m`;
+  return {
+    heading: text => th.bold(th.fg("accent", text)),
+    link: text => th.fg("accent", text),
+    linkUrl: text => th.fg("muted", text),
+    code: text => th.fg("muted", text),
+    codeBlock: text => th.fg("muted", text),
+    codeBlockBorder: text => th.fg("dim", text),
+    quote: text => th.fg("muted", text),
+    quoteBorder: text => th.fg("dim", text),
+    hr: text => th.fg("dim", text),
+    listBullet: text => th.fg("accent", text),
+    bold: text => th.bold(text),
+    italic: sgr(3, 23),
+    underline: sgr(4, 24),
+    strikethrough: sgr(9, 29),
+  };
+}
+
+/**
+ * Cap `text` at `RESULT_MAX_CHARS`, reporting the elision separately rather than
+ * appending it.
+ *
+ * Separately because the notice is the viewer's chrome, not the tool's output.
+ * Appended into the string it becomes content: a cut landing inside a fenced
+ * code block — likely, on exactly the large `ctx_execute` resu
```

**File**: `test/agent-file-bom.test.ts` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+/**
+ * agent-file-bom.test.ts — agent files that begin with a UTF-8 BOM.
+ *
+ * Editors across the Windows/CJK world write UTF-8 with a BOM by default, so a
+ * BOM-prefixed agent file is ordinary input rather than a curiosity. pi's parser
+ * did not look past one before 0.84.3: the fence never matched, so frontmatter
+ * came back empty and the whole file — YAML included — became the body. An agent
+ * authored that way lost every field, and `tools: none` going missing meant it
+ * registered with the DEFAULT toolset (bash, edit, write) instead of none — a
+ * wider grant than its author wrote.
+ *
+ * These drive the real loader over a real file, which is what the string-level
+ * tests in custom-agents/agent-file-toggle cannot reach.
+ */
+
+import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { afterEach, beforeEach, describe, expect, it } from "vitest";
+import { disableInContent, enableInContent } from "../src/agent-file-toggle.js";
+import { loadCustomAgents } from "../src/custom-agents.js";
+
+const BOM = "﻿";
+const AGENT = `${BOM}---
+description: 代码审查员
+tools: none
+model: anthropic/claude-haiku-4-5
+---
+
+你是一位资深的代码审查员。请仔细检查代码。`;
+
+describe("BOM-prefixed agent files", () => {
+  let tmpDir: string;
+  let originalHome: string | undefined;
+  let originalAgentDir: string | undefined;
+
+  beforeEach(() => {
+    tmpDir = mkdtempSync(join(tmpdir(), "pi-bom-"));
+    originalHome = process.env.HOME;
+    originalAgentDir = process.env.PI_CODING_AGENT_DIR;
+    process.env.HOME = tmpDir;
+    delete process.env.PI_CODING_AGENT_DIR;
+  });
+
+  afterEach(() => {
+    if (originalHome == null) delete process.env.HOME;
+    else process.env.HOME = originalHome;
+    if (originalAgentDir == null) delete process.env.PI_CODING_AGENT_DIR;
+    else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
+    rmSync(tmpDir, { recursive: true, force: true });
+  });
+
+  /** Write an agent file and return its path. */
+  function writeAgent(name: string, content: string): string {
+    const dir = join(tmpDir, ".agents", "agents");
+    mkdirSync(dir, { recursive: true });
+    const path = join(dir, `${name}.md`);
+    writeFileSync(path, content, "utf-8");
+    return path;
+  }
+
+  it("loads every field, rather than dropping them behind the BOM", () => {
+    writeAgent("审查员", AGENT);
+
+    const agent = loadCustomAgents(tmpDir).get("审查员");
+
+    expect(agent?.description).toBe("代码审查员");
+    expect(agent?.model).toBe("anthropic/claude-haiku-4-5");
+    expect(agent?.systemPrompt).toBe("你是一位资深的代码审查员。请仔细检查代码。");
+    // The YAML must not survive into the prompt — the symptom of the fence miss.
+    expect(agent?.systemPrompt).not.toContain("---");
+  });
+
+  it("honours `tools: none` instead of granting the default toolset", () => {
+    writeAgent("审查员", AGENT);
+
+    const agent = loadCustomAgents(tmpDir).get("审查员");
+
+    // The sharp edge: dropped frontmatter used to leave this agent holding
+    // bash, edit and write — the opposite of what the file asked for.
+    expect(agent?.builtinToolNames).toEqual([]);
+  });
+
+  it("handles BOM + CRLF together, which is what a Windows editor writes", () => {
+    // The combination, not either alone: the same editors that add a BOM also
+    // write CRLF, so this is the likeliest shape of a real file — and the eol
+    // detection reads lines[0], which is the line the BOM sits on.
+    const crlf = `${BOM}---\r\ndescription: 代码审查员\r\ntools: none\r\n---\r\n\r\n你是审查员。\r\n`;
+    const path = writeAgent("审查员", crlf);
+
+    expect(loadCustomAgents(tmpDir).get("审查员")?.description).toBe("代码审查员");
+
+    const { content, outcome } = disableInContent(readFileSync(path, "utf-8"));
+    expect(outcome).toBe("disabled");
+    expect(content.startsWith(BOM)).toBe(true);
+    // No lone LF crept in — the file's line endings survive the edit.
+    expect(/[^\r]\n/.test(content)).toBe(false);
+    expect(enableInContent(content).content).toBe(crlf);
+  });
+
+  it("still refuses a BOM-prefixed file that has no frontmatter at all", () => {
+    // The BOM must not be treated as licence to invent a block that isn't there.
+    const { content, outcome } = disableInContent(`${BOM}没有前置数据。\n`);
+
+    expect(outcome).toBe("no-frontmatter");
+    expect(content).toBe(`${BOM}没有前置数据。\n`);
+  });
+
+  it("disables and re-enables on disk, leaving the file byte-identical", () => {
+    const path = writeAgent("审查员", AGENT);
+
+    writeFileSync(path, disableInContent(readFileSync(path, "utf-8")).content, "utf-8");
+    expect(loadCustomAgents(tmpDir).get("审查员")?.enabled).toBe(false);
+    expect(readFileSync(path, "utf-8").startsWith(BOM)).toBe(true);
+
+    writeFileSync(path, enableInContent(readFileSync(path, "utf-8")).content, "utf-8");
+    expect(loadCustomAgents(tmpDir).get("审查员")?.enabled).not.toBe(false);
+    expect(readFileSync(path, "
```

---

### Incident Patch 7: `92422a4b` (2026-08-24)
**Commit Message**: fix(ui): show the model and thinking level a subagent actually ran with (#257)

* fix(ui): show the model and thinking level a subagent actually ran with

The model was rendered only when it differed from the parent's, so the common
case — an agent that inherits it — showed "thinking: max" with nothing to
attach the level to, and the widget alone could not say what was driving a
given agent. What was shown was also the requested configuration, never the
resolved one: pi applies its own defaults and clamps the level to what the
model supports at session creation, and none of that reached the record. Resume
was worse than stale — it rendered the resume call's model and thinking even
though resumeAgent only prompts the session it reopens and cannot re-apply
either.

The child session is now read back onto AgentRecord.invocation once, in
onSessionCreated, beside the sessionFile capture that already lives there. That
makes the record authoritative and every surface a plain reader of it, rather
than each re-deriving "the session, else the request" for itself. Tight rows
take a short label (haiku 4.5); the conversation viewer's row takes the
canonical provider/model-id, since two provider

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -9,9 +9,14 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Added
 - **`subagents:rpc:consume` — a cross-extension caller can say it has already shown an agent's result** ([tintinweb/pi-tasks#62](https://github.com/tintinweb/pi-tasks/issues/62) — thanks [@felipe3dfx](https://github.com/felipe3dfx)). `get_subagent_result` suppresses the completion notification for a result it hands back, but it is a tool the parent model calls; an extension that joins an agent on `subagents:completed` and reports the result itself had no way to do the same, so the notification still arrived — after the parent had answered — and cost a turn to dismiss. The new RPC marks a settled agent's result consumed, exactly as the tool does. Running and unknown agents are refused, so a caller cannot silence an agent whose result nobody has read yet. Deliberately outside the `subagents:rpc:ping` version handshake: it is additive and best-effort, and an extension built against protocol v2 simply never calls it.
+- **`showModel` — the model and thinking level on the widget's running rows.** A row reads `Explore  inspect code · sonnet 4.6 · thinking: high · ↻3 · 8.2k token · 4.1s`. Off by default, and the only surface that is gated: the row already carries the description, turns, tool uses, tokens and elapsed time, and every character it gains is one the description loses on a narrow terminal. Finished rows and the `◦ N queued` summary are untouched — a fan-out that queues ten agents would otherwise push every finished agent out of the twelve-line widget. Toggle at `/agents → Settings → Show model`; applied live.
 
 ### Fixed
 - **Ctrl+C closes the conversation viewer** ([#255](https://github.com/tintinweb/pi-subagents/pull/255) — thanks [@elrond298](https://github.com/elrond298)). The overlay closed on `Esc` and `q` but swallowed `Ctrl+C`, the reflex key for backing out of a full-screen TUI view, leaving the viewer stuck on screen for anyone who reached for it.
+- **The subagent surfaces name the model the run actually used** ([#168](https://github.com/tintinweb/pi-subagents/pull/168) — thanks [@xz-dev](https://github.com/xz-dev), whose PR is the report and the design here). The model was shown only when it differed from the parent's, so the common case — an agent that inherits it — rendered `thinking: max` with nothing to attach the level to, and no way to tell from the widget alone what was driving a given agent. It is now shown unconditionally, and it is the *effective* model rather than the requested one: pi resolves its own defaults and clamps the thinking level to what the model supports at session creation, and none of that reached the record. The child session is now read back onto `AgentRecord.invocation` once, at session creation, and every surface reads that one place instead of each re-deriving "the session, else the request" for itself. Tight rows get a short label (`haiku 4.5`); the conversation viewer's `↳` row, which has the width for it, gets the canonical `provider/model-id`, since two providers can serve models whose short names read alike. Agents started outside the `Agent` tool — cross-extension RPC, `@handle` mentions — carried no invocation at all and so had no `↳` row; they now get one naming their model and level.
+- **A resume renders the session it reopens, not the parameters of the resume call.** `resumeAgent` only prompts the existing session — it cannot re-apply a model or a thinking level — but the result rendered the resume call's parameters, so `resume: <id>` with `model: google/gemini-3-pro` displayed Gemini for a run that never left the model it was created with. Both resume paths, foreground and background, now render the record.
+- **Configuration a spawn could not honour is disclosed rather than presented as what was asked for** ([#182](https://github.com/tintinweb/pi-subagents/issues/182)). An agent file's pinned `model` or `thinking` outranks the matching tool-call parameter, and pi clamps a level the model cannot reach; both silently replaced the request, which is the comparison the invocation snapshot exists to support ([#62](https://github.com/tintinweb/pi-subagents/issues/62)). The request is now kept beside the effective value — `thinking: low (asked max)`, `haiku 4.5 (asked anthropic/claude-opus-4-6)` — on every surface that renders either. Models are compared after resolution, not as spelling: input is fuzzy, so `model: "haiku"` against a pinned `anthropic/claude-haiku-4-5` is the same model and discloses nothing, while a spelling that resolves to no available model is disclosed precisely because it cannot have taken effect. This is the *disclose* half of #182 and only for these two fields; `max_turns` is still silently overridden, and rejecting a conflicting parameter outright remains open.
+- **Scheduled runs record how they were configured.** A job spawns with no tool call to build an invocation snapshot from, so its conversation viewer said nothi
```

**File**: `README.md` (modified, +16/-0)
```diff
@@ -555,6 +555,22 @@ The `~` marks it as pi's estimate rather than a billed figure. **A cost is shown
 
 Independent of `reportUsage`: this one is what you read, that one is what your session counts. Toggle via `/agents → Settings → Show cost`; applied live.
 
+**Show model** (`showModel`, default `false`): whether the widget's running rows name the model driving each agent and the thinking level it is running at:
+
+```text
+├─ ⠹ Explore  inspect code · sonnet 4.6 · thinking: high · ↻3 · 8.2k token · 4.1s
+```
+
+Off by default because the row already carries the description, turns, tool uses, tokens and elapsed time, and every character it gains is one the description loses on a narrow terminal. The other surfaces show the pair either way: the `Agent` tool result names the model beside its tags, and the conversation viewer's `↳` row spells out the canonical `provider/model-id`.
+
+Both places report what the run *actually* used, read back from the child session once pi has resolved its defaults and clamped the level to what the model supports — not what the call asked for. Where those differ, the request is kept beside the effective value rather than dropped, whether pi clamped it or an agent file's frontmatter outranked it:
+
+```text
+  ↳ anthropic/claude-haiku-4-5 · thinking: low (asked max) · background
+```
+
+Toggle via `/agents → Settings → Show model`; applied live.
+
 **Tool description** (`toolDescriptionMode`, default `"full"`): which Agent tool description the LLM sees. `"full"` is the rich Claude Code-style prompt (~1,400 tokens with the default agents); `"compact"` is ~75% smaller — one-line agent type list, terse usage notes — for small/local models where tool-spec tokens are expensive. Per-option details stay in the parameter descriptions in every mode (the parameter schema is never customizable). Applies on the next pi session.
 
 `"custom"` registers your own description from `<cwd>/.pi/agent-tool-description.md` (project) or `<agentDir>/agent-tool-description.md` (global; project wins). The file is read once at tool registration, so edits also apply on the next pi session. Dynamic parts stay live via placeholders — a static agent list would go stale the moment you add a custom agent:
```

**File**: `src/agent-manager.ts` (modified, +23/-0)
```diff
@@ -14,6 +14,7 @@ import type { Model } from "@earendil-works/pi-ai";
 import type { AgentSession, ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
 import { resumeAgent, runAgent, type ToolActivity } from "./agent-runner.js";
 import { assignHandle, handleBase } from "./mention.js";
+import { describeModel } from "./model-resolver.js";
 import type { AgentInvocation, AgentRecord, AgentTombstone, IsolationMode, MentionResolution, SubagentType, ThinkingLevel } from "./types.js";
 import { addUsage, type LifetimeUsage } from "./usage.js";
 import { cleanupWorktree, createWorktree, isWorktreeIsolationEnabled, pruneWorktrees, } from "./worktree.js";
@@ -467,6 +468,28 @@ export class AgentManager {
         // stubbed session must degrade to "not resumable" rather than throw
         // and take the whole spawn down with it.
         record.sessionFile = session.sessionManager?.getSessionFile?.();
+        // Same reason, different field: the model and thinking level are only
+        // knowable once pi has resolved its defaults and clamped the level to
+        // what the model supports. Writing them back here makes the record
+        // authoritative, so every surface reads one place instead of each
+        // re-deriving "session, else the request" for itself.
+        if (session.model) {
+          record.invocation ??= {};
+          // Read the kept request first: a caller's level survives being clamped
+          // AND, one line later, being replaced by the effective one.
+          const requested = record.invocation.requestedThinking ?? record.invocation.thinking;
+          Object.assign(record.invocation, describeModel(session.model));
+          // Guarded for the reason above: a session that reports no level keeps
+          // the request rather than losing it. Overwriting unconditionally would
+          // turn an older or stubbed session into a blank `thinking:` tag, which
+          // is worse than the stale-but-true value it replaced.
+          if (session.thinkingLevel) {
+            record.invocation.thinking = session.thinkingLevel;
+            if (requested && requested !== session.thinkingLevel) {
+              record.invocation.requestedThinking = requested;
+            }
+          }
+        }
         // Flush any steers that arrived before the session was ready
         if (record.pendingSteers?.length) {
           for (const msg of record.pendingSteers) {
```

**File**: `src/index.ts` (modified, +76/-13)
```diff
@@ -28,7 +28,7 @@ import { GroupJoinManager } from "./group-join.js";
 import { isolationParam, resolveAgentInvocationConfig, resolveJoinMode } from "./invocation-config.js";
 import { describeMention, handleBase, isReservedHandle, parseMention, resolveHandleToType, stripAgentPrefix } from "./mention.js";
 import { runMentionClone } from "./mention-clone.js";
-import { type ModelRegistry, resolveModel } from "./model-resolver.js";
+import { describeModel, type ModelRegistry, resolveModel } from "./model-resolver.js";
 import { checkModelScope, isScopeModelsEnabled, setScopeModelsEnabled } from "./model-scope.js";
 import { getMaxSubagentDepth, setMaxSubagentDepth } from "./nested-tools.js";
 import { createOutputFilePath, ensureOutputFile, getOutputTranscriptDefault, setOutputTranscriptDefault, streamToOutputFile, writeInitialEntry } from "./output-file.js";
@@ -383,6 +383,10 @@ export default function (pi: ExtensionAPI) {
   let showCost = false;
   function isShowCostEnabled(): boolean { return showCost; }
   function setShowCost(b: boolean): void { showCost = b; widget.update(); fleet.update(); }
+  /** Name the model and thinking level on the widget's running rows. */
+  let showModel = false;
+  function isShowModelEnabled(): boolean { return showModel; }
+  function setShowModel(b: boolean): void { showModel = b; widget.update(); }
   const pendingUsage = new PendingUsagePool();
 
   // ---- Cancellable pending notifications ----
@@ -1039,7 +1043,7 @@ export default function (pi: ExtensionAPI) {
   // everything else; "off" = hide the widget entirely. Read live at render time.
   let widgetMode: WidgetMode = "background";
   function getWidgetMode(): WidgetMode { return widgetMode; }
-  const widget = new AgentWidget(manager, agentActivity, getWidgetMode, isShowCostEnabled);
+  const widget = new AgentWidget(manager, agentActivity, getWidgetMode, isShowCostEnabled, isShowModelEnabled);
   function setWidgetMode(m: WidgetMode): void { widgetMode = m; widget.update(); }
 
   // Claude Code-style FleetView: navigable list of main + subagents below the editor.
@@ -1309,6 +1313,7 @@ export default function (pi: ExtensionAPI) {
       setFallbackSubagent: setFallbackSubagent,
       setReportUsage,
       setShowCost,
+      setShowModel,
     },
     (event, payload) => pi.events.emit(event, payload),
   );
@@ -1733,15 +1738,32 @@ Terse command-style prompts produce shallow, generic work.
         writeInitialEntry(rec.outputFile, agentId, params.prompt, ctx.cwd);
       };
 
-      const parentModelId = ctx.model?.id;
-      const effectiveModelId = model?.id;
-      const modelName = effectiveModelId && effectiveModelId !== parentModelId
-        ? (model?.name ?? effectiveModelId).replace(/^Claude\s+/i, "").toLowerCase()
-        : undefined;
+      // Unconditional, not "only when it differs from the parent": a thinking
+      // level reads as a property of a model, and an agent that inherited the
+      // parent's model used to show the level with nothing to attach it to.
+      // This is the pre-session snapshot — agent-manager overwrites it with the
+      // effective values the moment a session reports them.
+      const { modelName, modelId } = model ? describeModel(model) : { modelName: undefined, modelId: undefined };
+      // What the caller SPELLED, kept only if it names a different model than the
+      // one that won. Model input is fuzzy — `"haiku"` and
+      // `"anthropic/claude-haiku-4-5"` are the same model — so comparing the two
+      // strings would disclose an override that never happened. A spelling that
+      // resolves to nothing is still worth disclosing: it cannot have taken effect.
+      const askedModel = ((asked: string | undefined) => {
+        if (!asked) return undefined;
+        const resolvedAsked = resolveModel(asked, ctx.modelRegistry);
+        if (typeof resolvedAsked === "string") return asked;
+        return resolvedAsked.provider === model?.provider && resolvedAsked.id === model?.id ? undefined : asked;
+      })(resolvedConfig.overridden?.model);
       const effectiveMaxTurns = normalizeMaxTurns(resolvedConfig.maxTurns ?? getDefaultMaxTurns());
       const agentInvocation: AgentInvocation = {
         modelName,
+        modelId,
         thinking,
+        // Only set where the agent file outranked the caller, so the surfaces can
+        // disclose a parameter that was accepted but could not take effect (#182).
+        requestedThinking: resolvedConfig.overridden?.thinking,
+        requestedModel: askedModel,
         // Explicit value only — the default fallback would just add noise.
         // Normalize so `0` (unlimited) doesn't surface as a misleading "max turns: 0".
         maxTurns: normalizeMaxTurns(resolvedConfig.maxTurns),
@@ -1762,6 +1784,34 @@ Terse command-style prompts produce shallow, generic work.
         tags: agentTags.length > 0 ? agentTags : undefined,
       };
 
+      /**
+       * `detailBase` for a record that exis
```

**File**: `src/invocation-config.ts` (modified, +25/-0)
```diff
@@ -106,13 +106,32 @@ export function resolveAgentInvocationConfig(
   runInBackground: boolean;
   isolated: boolean;
   isolation?: IsolationMode;
+  /**
+   * Caller parameters an agent file's frontmatter outranked, so the surfaces can
+   * say "(asked X)" instead of presenting the effective value as the requested
+   * one (#182). Populated only where both sides named something and they
+   * disagree — a caller who asked for what they got was still honored.
+   *
+   * `max_turns` is deliberately absent: no surface renders a requested-vs-
+   * effective turn limit, so recording one would be dead data.
+   */
+  overridden?: { thinking?: ThinkingLevel; model?: string };
 } {
   // Precedence first, collapse second — reversing these loses the veto, since
   // an agent file's "off" only outranks a caller's "worktree" while it is still
   // a value. Everything downstream then sees "worktree" or nothing at all.
   const requested = agentConfig?.isolation ?? params.isolation;
   const isolation = requested === "worktree" && opts?.worktreeAllowed !== false ? "worktree" : undefined;
 
+  const overriddenThinking = agentConfig?.thinking != null && params.thinking != null
+    && agentConfig.thinking !== params.thinking
+    ? params.thinking as ThinkingLevel
+    : undefined;
+  const overriddenModel = agentConfig?.model != null && params.model != null
+    && agentConfig.model !== params.model
+    ? params.model
+    : undefined;
+
   return {
     modelInput: agentConfig?.model ?? params.model,
     modelFromParams: agentConfig?.model == null && params.model != null,
@@ -122,6 +141,12 @@ export function resolveAgentInvocationConfig(
     runInBackground: agentConfig?.runInBackground ?? params.run_in_background ?? opts?.defaultRunInBackground ?? false,
     isolated: agentConfig?.isolated ?? params.isolated ?? false,
     isolation,
+    // Undefined rather than an empty object when nothing was overridden: callers
+    // spread this into the invocation snapshot, and an always-present key would
+    // put `requestedThinking: undefined` on every record.
+    overridden: overriddenThinking || overriddenModel
+      ? { thinking: overriddenThinking, model: overriddenModel }
+      : undefined,
   };
 }
 
```

**File**: `src/model-resolver.ts` (modified, +18/-0)
```diff
@@ -14,6 +14,24 @@ export interface ModelRegistry {
   getAvailable?(): any[];
 }
 
+/**
+ * Both display forms of a model. The short one goes on tight rows (the widget,
+ * the Agent tool result), the canonical one where there is room to disambiguate
+ * two providers serving a similarly-named model (the conversation viewer).
+ *
+ * One function, because `index.ts` labels the model it resolved before the run
+ * and `agent-manager.ts` relabels it from the live session afterwards — the two
+ * must agree or the label would visibly change the moment the session starts.
+ */
+export function describeModel(
+  model: { provider: string; id: string; name?: string },
+): { modelName: string; modelId: string } {
+  return {
+    modelName: (model.name ?? model.id).replace(/^Claude\s+/i, "").toLowerCase(),
+    modelId: `${model.provider}/${model.id}`,
+  };
+}
+
 /**
  * Resolve a model string to a Model instance.
  * Tries exact match first ("provider/modelId"), then fuzzy match against all available models.
```

**File**: `src/schedule.ts` (modified, +15/-0)
```diff
@@ -19,6 +19,7 @@ import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-a
 import { Cron } from "croner";
 import { nanoid } from "nanoid";
 import type { AgentManager } from "./agent-manager.js";
+import { normalizeMaxTurns } from "./agent-runner.js";
 import { resolveSpawnType } from "./agent-types.js";
 import { resolveModel } from "./model-resolver.js";
 import type { ScheduleStore } from "./schedule-store.js";
@@ -256,6 +257,20 @@ export class SubagentScheduler {
         isolated: job.isolated,
         thinkingLevel: job.thinking,
         isolation: job.isolation,
+        // A scheduled run has no tool call to build this, so without it the
+        // conversation viewer shows nothing about how the job was configured.
+        // The model is left out on purpose: agent-manager fills in the effective
+        // one when the session reports it, and naming the pre-session pick here
+        // would only be right until then.
+        invocation: {
+          thinking: job.thinking,
+          // Normalized like the Agent tool's own snapshot: `0` means unlimited,
+          // and rendering it as "max turns: 0" would read as a limit of none.
+          maxTurns: normalizeMaxTurns(job.max_turns),
+          isolated: job.isolated,
+          runInBackground: true,
+          isolation: job.isolation,
+        },
       });
     } catch (err) {
       const error = err instanceof Error ? err.message : String(err);
```

**File**: `src/settings.ts` (modified, +17/-0)
```diff
@@ -234,6 +234,18 @@ export interface SubagentsSettings {
    * what the parent session counts.
    */
   showCost?: boolean;
+
+  /**
+   * Whether the widget's running rows name the model driving each agent and the
+   * thinking level it is running at.
+   *
+   * Off by default, unlike the tool result and the conversation viewer, which
+   * show the pair unconditionally: those have a line to themselves, while the
+   * widget row already carries the description, turns, tool uses, tokens and
+   * elapsed time, and every character it gains is one the description loses on a
+   * narrow terminal.
+   */
+  showModel?: boolean;
 }
 
 export type ToolDescriptionMode = "full" | "compact" | "custom";
@@ -260,6 +272,7 @@ export interface SettingsAppliers {
   setFallbackSubagent: (v: string | undefined) => void;
   setReportUsage: (b: boolean) => void;
   setShowCost: (b: boolean) => void;
+  setShowModel: (b: boolean) => void;
 }
 
 /** Emit callback — a subset of `pi.events.emit` to keep helpers testable. */
@@ -360,6 +373,9 @@ function sanitize(raw: unknown): SubagentsSettings {
   if (typeof r.showCost === "boolean") {
     out.showCost = r.showCost;
   }
+  if (typeof r.showModel === "boolean") {
+    out.showModel = r.showModel;
+  }
   if (r.fallbackSubagent === false) {
     // The only non-string spelling worth accepting: a boolean would otherwise be
     // dropped, silently leaving the PERMISSIVE default in place. Every string is
@@ -440,6 +456,7 @@ export function applySettings(s: SubagentsSettings, appliers: SettingsAppliers):
   if (typeof s.worktreeIsolation === "boolean") appliers.setWorktreeIsolation(s.worktreeIsolation);
   if (typeof s.reportUsage === "boolean") appliers.setReportUsage(s.reportUsage);
   if (typeof s.showCost === "boolean") appliers.setShowCost(s.showCost);
+  if (typeof s.showModel === "boolean") appliers.setShowModel(s.showModel);
 }
 
 /**
```

---

### Incident Patch 8: `c73e968e` (2026-08-23)
**Commit Message**: fix(ui): close conversation viewer on Ctrl+C (#255)

Co-authored-by: elrond <[REDACTED_EMAIL]>

**File**: `src/ui/conversation-viewer.ts` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ export class ConversationViewer implements Component {
       return;
     }
 
-    if (matchesKey(data, "escape") || matchesKey(data, "q")) {
+    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c") || matchesKey(data, "q")) {
       this.closed = true;
       this.done(undefined);
       return;
```

**File**: `test/conversation-viewer.test.ts` (modified, +12/-0)
```diff
@@ -109,6 +109,18 @@ describe("ConversationViewer cost display", () => {
 });
 
 describe("ConversationViewer", () => {
+  it("closes with Ctrl+C when not composing", () => {
+    const done = vi.fn();
+    const viewer = new ConversationViewer(
+      mockTui(), mockSession(), mockRecord(), undefined, ansiTheme(), done,
+    );
+
+    viewer.handleInput("\x03");
+
+    expect(done).toHaveBeenCalledOnce();
+    expect(done).toHaveBeenCalledWith(undefined);
+  });
+
   describe("render width safety", () => {
     const widths = [40, 80, 120, 216];
 
```

---

### Incident Patch 9: `3f9d35cd` (2026-08-20)
**Commit Message**: test(nested): pin the nested print-mode e2e suite to faux mode

runWithAgents didn't pass live: false, so PI_E2E_LIVE=1 handed the
suite's scripted assertions to a real model and failed all four tests
in the pre-publish smoke. Matches nested-delegation-e2e and
subagent-error-status-e2e, which already pin it.

**File**: `test/subagents-nested-print-mode-e2e.test.ts` (modified, +3/-0)
```diff
@@ -136,6 +136,9 @@ async function runWithAgents(
     ...options,
     cwd,
     respond,
+    // Pinned faux: every case here scripts exact tool calls, so the pre-publish
+    // smoke's global `PI_E2E_LIVE=1` must not swap a real model in.
+    live: false,
     beforeRun: () => registerAgents(loadCustomAgents(cwd)),
   });
   return { run, cwd };
```

---

### Incident Patch 10: `9afe114c` (2026-08-19)
**Commit Message**: fix(agent-manager): emit session_shutdown on subagent sessions before disposing (#242)

**File**: `src/agent-manager.ts` (modified, +44/-5)
```diff
@@ -199,6 +199,37 @@ interface ResumeOptions {
   onStarted?: () => void;
 }
 
+/** Best-effort ceiling on one child's shutdown handlers, so teardown can't strand a quit. */
+const CHILD_SHUTDOWN_TIMEOUT_MS = 3_000;
+
+/**
+ * Close the extension lifecycle `runAgent` opened with `bindExtensions`, then dispose.
+ *
+ * `AgentSession.dispose()` only calls `ExtensionRunner.invalidate()` — pi emits the event
+ * itself in `AgentSessionRuntime.dispose()` beforehand, and this is the one place that binds
+ * extensions onto a session without going through that path. Without the emit, everything an
+ * extension armed in `session_start` leaks once per spawn, and its next tick throws
+ * `assertActive()` from a bare timer callback — an uncaughtException that kills pi (#242).
+ */
+async function shutdownChildSession(session: AgentSession | undefined): Promise<void> {
+  try {
+    const runner = session?.extensionRunner;
+    // Optional all the way down: on a pi without the getter, or a stubbed session from a
+    // partial `onSessionCreated`, skip the emit — the same degrade as before this fix.
+    if (runner?.hasHandlers?.("session_shutdown")) {
+      // Raced, not awaited outright. `emit` runs every handler serially with no timeout of
+      // its own, and dispose() is reached from pi's own `session_shutdown` with the TUI
+      // already torn down — one hung handler would leave a dead terminal.
+      await Promise.race([
+        runner.emit({ type: "session_shutdown", reason: "quit" }),
+        new Promise<void>(resolve => setTimeout(resolve, CHILD_SHUTDOWN_TIMEOUT_MS).unref()),
+      ]);
+    }
+  } catch { /* a partial session must degrade, not take the teardown down with it */ }
+  // Always, even on timeout: disposal is what this function ultimately exists to do.
+  try { session?.dispose?.(); } catch { /* ignore */ }
+}
+
 export class AgentManager {
   private agents = new Map<string, AgentRecord>();
   private cleanupInterval: ReturnType<typeof setInterval>;
@@ -925,9 +956,15 @@ export class AgentManager {
   /** Dispose a record's session and remove it from the map. */
   private removeRecord(id: string, record: AgentRecord): void {
     this.tombstone(record);
-    record.session?.dispose?.();
+    const session = record.session;
+    // Detached before the shutdown starts, so the record leaves the map at once and
+    // nothing can observe a session that is half torn down.
     record.session = undefined;
     this.agents.delete(id);
+    // Fire-and-forget is right here and only here: this runs from the 60s cleanup timer
+    // and from `clearCompleted()` on session boundaries, with the process staying alive,
+    // so handlers get their full window. The quit path awaits instead — see dispose().
+    void shutdownChildSession(session);
   }
 
   /**
@@ -1032,14 +1069,16 @@ export class AgentManager {
     }
   }
 
-  dispose() {
+  async dispose(): Promise<void> {
     clearInterval(this.cleanupInterval);
     // Clear queue
     this.queue = [];
-    for (const record of this.agents.values()) {
-      record.session?.dispose();
-    }
+    const sessions = [...this.agents.values()].map(record => record.session);
     this.agents.clear();
+    // Awaited, unlike the eviction path: pi awaits this extension's `session_shutdown`
+    // handler and the process exits right after it returns, so anything left unawaited
+    // here never runs at all. Bounded — each call carries its own ceiling, concurrently.
+    await Promise.all(sessions.map(session => shutdownChildSession(session)));
     // Prune any orphaned git worktrees (crash recovery)
     try { pruneWorktrees(process.cwd()); } catch { /* ignore */ }
     // Also prune repos that caller-supplied cwds created worktrees in — a clean
```

**File**: `src/index.ts` (modified, +5/-1)
```diff
@@ -1013,7 +1013,11 @@ export default function (pi: ExtensionAPI) {
     for (const timer of pendingNudges.values()) clearTimeout(timer);
     pendingNudges.clear();
     fleet.dispose();
-    manager.dispose();
+    // Awaited: it emits `session_shutdown` into every retained child session so
+    // extensions bound there can release what they armed in `session_start` (#242).
+    // pi awaits this handler, and the process exits right after — unawaited, those
+    // handlers would never run. Internally bounded, so a hung one can't strand quit.
+    await manager.dispose();
   });
 
   // Live widget: show running agents above editor.
```

**File**: `test/agent-manager-gc.test.ts` (modified, +24/-0)
```diff
@@ -83,6 +83,30 @@ describe("AgentManager — record GC", () => {
     expect(dispose).toHaveBeenCalled();
   });
 
+  it("closes the evicted session's extension lifecycle before disposing it (#242)", async () => {
+    // The reported crash, on its own path: this sweep is what fires ~10 min after a
+    // subagent finishes. Disposing only invalidates the ExtensionRunner, so whatever
+    // an extension armed in `session_start` stayed armed — and its next tick threw
+    // `assertActive()` from a bare timer callback, killing interactive pi.
+    manager = new AgentManager();
+    const { id, record } = await settled("stale");
+    const emit = vi.fn(async () => {});
+    const dispose = vi.fn();
+    record.session = {
+      dispose,
+      extensionRunner: { hasHandlers: (event: string) => event === "session_shutdown", emit },
+    } as any;
+    record.completedAt = Date.now() - (TEN_MINUTES + 30_000);
+
+    await vi.advanceTimersByTimeAsync(TICK);
+
+    expect(manager.getRecord(id)).toBeUndefined();
+    expect(emit).toHaveBeenCalledWith({ type: "session_shutdown", reason: "quit" });
+    // After dispose() the runner is invalidated and every ctx getter throws, so an
+    // emit that landed afterwards would be worse than none.
+    expect(emit.mock.invocationCallOrder[0]).toBeLessThan(dispose.mock.invocationCallOrder[0]);
+  });
+
   it("never evicts a running agent, however old its timestamp looks", async () => {
     // A live agent's session being disposed mid-run is the worst failure this
     // guard prevents, and `completedAt` on a running record is meaningless.
```

**File**: `test/child-session-shutdown.test.ts` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+/**
+ * #242 — `runAgent` calls `session.bindExtensions()` so `session_start` fires and
+ * extensions can set up per-session state, but nothing ever closed that lifecycle:
+ * both eviction (`removeRecord`) and quit (`dispose`) called `session.dispose()`,
+ * which in pi only calls `ExtensionRunner.invalidate()` — it does NOT emit
+ * `session_shutdown`. So anything an extension armed in `session_start` (timers, fs
+ * watchers, sockets) leaked once per spawn, and its next tick threw `assertActive()`
+ * from a bare `Timeout._onTimeout` — an uncaughtException that killed interactive pi.
+ *
+ * pi emits the event itself in `AgentSessionRuntime.dispose()` before disposing; these
+ * tests pin that we do the same, that quit actually waits for the handlers, and that a
+ * hung handler can't strand the user at a dead terminal.
+ */
+import { afterEach, describe, expect, it, vi } from "vitest";
+import { AgentManager } from "../src/agent-manager.js";
+
+vi.mock("../src/agent-runner.js", () => ({
+  runAgent: vi.fn(),
+  resumeAgent: vi.fn(),
+}));
+
+vi.mock("../src/worktree.js", () => ({
+  createWorktree: vi.fn(),
+  cleanupWorktree: vi.fn(() => ({ hasChanges: false })),
+  pruneWorktrees: vi.fn(),
+  isWorktreeIsolationEnabled: vi.fn(() => true),
+}));
+
+import { runAgent } from "../src/agent-runner.js";
+import { pruneWorktrees } from "../src/worktree.js";
+
+const mockPi = {} as any;
+const mockCtx = { cwd: "/tmp" } as any;
+
+/** A child session as `runAgent` leaves it: extensions bound, so a runner with handlers. */
+function boundSession(emit: (...args: any[]) => any = vi.fn(async () => {})) {
+  return {
+    dispose: vi.fn(),
+    extensionRunner: {
+      hasHandlers: vi.fn((event: string) => event === "session_shutdown"),
+      emit: vi.fn(emit),
+    },
+  } as any;
+}
+
+/** Spawn one background agent that resolves with `session`, and wait for it to complete. */
+async function spawnCompleted(manager: AgentManager, session: any) {
+  vi.mocked(runAgent).mockResolvedValue({
+    responseText: "done",
+    session,
+    aborted: false,
+    steered: false,
+  } as any);
+  const id = manager.spawn(mockPi, mockCtx, "general-purpose", "test", {
+    description: "test",
+    isBackground: true,
+  });
+  await manager.getRecord(id)!.promise;
+  return id;
+}
+
+describe("child session shutdown (#242)", () => {
+  let manager: AgentManager;
+
+  afterEach(async () => {
+    await manager?.dispose();
+    vi.useRealTimers();
+    vi.clearAllMocks();
+  });
+
+  it("emits session_shutdown before disposing an evicted session", async () => {
+    manager = new AgentManager();
+    const session = boundSession();
+    await spawnCompleted(manager, session);
+
+    manager.clearCompleted();
+    await vi.waitFor(() => expect(session.dispose).toHaveBeenCalled());
+
+    expect(session.extensionRunner.emit).toHaveBeenCalledWith({
+      type: "session_shutdown",
+      reason: "quit",
+    });
+    // Order is the whole point: after `dispose()` the runner is invalidated and
+    // every `ctx` getter throws, so a handler emitted afterwards is useless.
+    expect(session.extensionRunner.emit.mock.invocationCallOrder[0])
+      .toBeLessThan(session.dispose.mock.invocationCallOrder[0]);
+  });
+
+  it("quit waits for the child's shutdown handlers to finish", async () => {
+    manager = new AgentManager();
+    let releaseHandler!: () => void;
+    const session = boundSession(() => new Promise<void>(r => { releaseHandler = r; }));
+    await spawnCompleted(manager, session);
+
+    const disposed = manager.dispose();
+    let settled = false;
+    void disposed.then(() => { settled = true; });
+    // Several microtask turns: enough for a fire-and-forget implementation to have
+    // resolved, not enough for a correctly awaited one.
+    for (let i = 0; i < 5; i++) await Promise.resolve();
+
+    expect(settled).toBe(false);
+    expect(session.dispose).not.toHaveBeenCalled();
+
+    releaseHandler();
+    await disposed;
+    expect(settled).toBe(true);
+    expect(session.dispose).toHaveBeenCalledOnce();
+  });
+
+  it("quit is not hostage to a handler that never resolves", async () => {
+    manager = new AgentManager();
+    const session = boundSession(() => new Promise<void>(() => {}));
+    await spawnCompleted(manager, session);
+
+    vi.useFakeTimers();
+    const disposed = manager.dispose();
+    // Past the internal ceiling. Without it the TUI is already torn down and the
+    // user is left at a dead terminal with only Ctrl-C.
+    await vi.advanceTimersByTimeAsync(5_000);
+    await disposed;
+
+    expect(session.dispose).toHaveBeenCalledOnce();
+    // Teardown continues past the timeout rather than unwinding.
+    expect(pruneWorktrees).toHaveBeenCalled();
+  });
+
+  it("skips the emit when no extension handles session_shutdown", async () => {
+    manager = new AgentManager();
+    const session = boundSession();
+    session.extensionRunner.hasHandlers = vi.fn(() => 
```

---

### Incident Patch 11: `af042244` (2026-08-19)
**Commit Message**: fix(ui): track RPC-spawned agent activity - continuation of #181 (#249)

* fix(ui): track RPC-spawned agent activity

* fix(ui): track activity for every programmatic spawn, not just RPC (#181)

* fix(ui): track activity for every programmatic spawn (#181)

Agents started outside the Agent tool — cross-extension RPC, @handle mentions,
the manager registry — never got an activity tracker, so their widget row read
"thinking…" for the whole run. The tracker moves into spawnResolved, the funnel
all three pass through; the Agent tool calls manager.spawn directly, so nothing
is double-tracked. Scheduled agents still spawn through the manager and are
unchanged.

Two defects that surfaced: spend now reads from the AgentRecord everywhere
instead of the tracker — only the record carries a nested child's spend and
outlives the run, so figures no longer jump at completion — and the effective
turn limit is resolved in one place, so the displayed ceiling matches the
enforced one.

* update readme/changelog

---------

Co-authored-by: Xiangzhe <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -22,7 +22,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 - **The `Agent` tool no longer tells the model that foreground agents run one at a time** ([#232](https://github.com/tintinweb/pi-subagents/issues/232) — thanks [@willfenton](https://github.com/willfenton)). *"Foreground calls run sequentially — only one executes at a time"* was never true: pi's agent loop dispatches a message's tool calls through `Promise.all` unless the whole batch opts out via `toolExecution: "sequential"` or some tool in it declares `executionMode: "sequential"`, and this extension sets neither — two foreground `Agent` calls in one message start within microseconds of each other. Nothing serialized them at this layer either; `agent-manager` deliberately exempts foreground agents from the `maxConcurrent` queue, since they block the parent anyway. The claim was self-inflicted rather than inherited: `d0cb511` replaced a correct bullet with it, and the later upstream-alignment pass grafted it onto the end of Claude Code's real sentence instead of replacing it, which also left an invented `with run_in_background: true on each` qualifier in the middle — upstream says a single message with multiple tool uses runs concurrently, full stop. Both are gone, restoring upstream's wording (minus its build-validator/test-runner example, consistent with the examples already omitted for token cost). The cost of the error was steering: an orchestrator that wanted parallelism was pushed into background spawns it did not need, paying a queue slot and a notification round-trip for concurrency it already had. Investigating where the sentence came from is what surfaced the default divergence in the breaking note above, so the two ship together — the remaining foreground/background prose is now Claude Code's own, including the `Don't race` bullet that only earns its place once background is the default.
-- **Scheduled and RPC-spawned agents show their token counts in the widget, and finished agents keep theirs in the conversation viewer.** Both surfaces read from the live activity tracker, which only `Agent`-tool spawns get and which is deleted the moment an agent finishes — so those agents rendered with no token stats at all. Both now fall back to the agent's record, where the totals survive. Spotted in [#194](https://github.com/tintinweb/pi-subagents/pull/194) — thanks [@daanzu](https://github.com/daanzu).
+- **Scheduled and RPC-spawned agents show their token counts in the widget, and finished agents keep theirs in the conversation viewer.** Both surfaces read spend from the live activity tracker, which only `Agent`-tool spawns get and which is deleted the moment an agent finishes — so those agents rendered with no token stats at all. Every surface now reads it from the agent's record instead: the record is the only total that outlives the run and the only one a nested child's spend is folded into, so the figure no longer jumped upward at completion as the read switched from one to the other. The tracker keeps what is genuinely live — tool activity, turn count, context percentage — and no longer accumulates a second copy of the totals. Spotted in [#194](https://github.com/tintinweb/pi-subagents/pull/194) — thanks [@daanzu](https://github.com/daanzu).
+- **Agents started outside the `Agent` tool say what they are doing, instead of `thinking…` for their whole run** ([#181](https://github.com/tintinweb/pi-subagents/pull/181) — thanks [@xz-dev](https://github.com/xz-dev)). The widget's activity line and turn counter come from an activity tracker that only the `Agent` tool handler created, so an agent started through cross-extension RPC (the path `TaskExecute` uses), through an `@handle` mention, or through the `Symbol.for("pi-subagents:manager")` registry showed a permanent `thinking…` while the same row's tool-use count climbed beside it and the conversation viewer showed the real work. The tracker now belongs to the one funnel all three spawn paths pass through, so none can be missed and none can supply half-wired callbacks of its own; the `Agent` tool reaches the manager directly, so nothing is double-tracked. Its turn ceiling is resolved exactly the way the run resolves the limit it enforces — explicit value, else the agent's own `max_turns`, else the project default — rather than read off the caller's options, which a mention deliberately omits so the agent file can decide: the row would otherwise render `↻3` where the tool renders `↻3≤20`. Scheduled jobs still spawn through the manager and so still render without per-tool detail.
 
 ## [0.17.1] - 2026-08-18
 
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -199,7 +199,7 @@ The grammar mirrors Claude Code's, and is deliberately narrow so nothing gets sw
 
 While an agent is live its handle addresses *it*, so `@explore` never starts a second Explore alongside a running one — use the `Agent` tool for deliberate parallelism. `@<agent-id>` works too. `main` is reserved and can never be an agent's handle (a type slugging to it gets `main-2`); handles are capped at 64 characters. A handle written as typed always wins over the `@agent-` form, so an agent genuinely called `agent-explore` stays reachable. [Nested subagents](#nested-subagents) are not addressable — they are hidden from every top-level surface and only their owner may steer them, so a handle that would name one starts a fresh top-level agent instead of reaching through that boundary. Suggestions list live agents first, then resumable ones, then startable types — and then pi's own file rows, in the same popup: `@` stays the file picker it always was, and the handles are added to it rather than replacing it. Disable the whole thing via `/agents → Settings → Agent mentions`.
 
-A `direct`-mode start takes the non-tool spawn path shared with the scheduler and cross-extension RPC, so — like those — it writes no `.output` transcript and the widget shows it without per-tool detail. That is the trade for skipping the model call: a `model`-mode start goes through the real `Agent` tool and keeps everything. A mention-*resumed* agent goes through the full resume wiring and keeps both in either mode.
+A `direct`-mode start takes the non-tool spawn path shared with the scheduler and cross-extension RPC, so — like those — it writes no `.output` transcript. That is the trade for skipping the model call: a `model`-mode start goes through the real `Agent` tool and keeps everything. Live tool activity and the turn counter are *not* part of that trade — a direct start renders them like any other agent. A mention-*resumed* agent goes through the full resume wiring and keeps both in either mode.
 
 Individual agent results render Claude Code-style in the conversation:
 
@@ -660,7 +660,7 @@ pi.events.emit("subagents:rpc:spawn", {
 });
 ```
 
-`options` is the manager's spawn-option object, not the `Agent` tool's parameter schema — the background flag is `isBackground`, and the tool's snake_case `run_in_background` is forwarded verbatim and ignored. Every RPC spawn returns its id immediately and runs detached either way; `isBackground: true` is what makes the agent occupy one of the `maxConcurrent` slots (and queue behind them when they are full) and what `subagents:created` reports. Leaving it unset starts the agent immediately regardless of the limit. A top-level RPC spawn renders in the widget and FleetView while it runs — only an explicit `isBackground: false` is dropped by the widget's default `background` mode, the way a foreground `Agent` call is. Nested spawns stay hidden from both.
+`options` is the manager's spawn-option object, not the `Agent` tool's parameter schema — the background flag is `isBackground`, and the tool's snake_case `run_in_background` is forwarded verbatim and ignored. Every RPC spawn returns its id immediately and runs detached either way; `isBackground: true` is what makes the agent occupy one of the `maxConcurrent` slots (and queue behind them when they are full) and what `subagents:created` reports. Leaving it unset starts the agent immediately regardless of the limit. A top-level RPC spawn renders in the widget and FleetView while it runs, with the same live tool activity and turn counter an `Agent`-tool spawn gets — only an explicit `isBackground: false` is dropped by the widget's default `background` mode, the way a foreground `Agent` call is. Nested spawns stay hidden from both.
 
 `options.model` accepts either a `Model` object (e.g. `ctx.model`) or a `"provider/modelId"` string — strings are resolved against `ctx.modelRegistry` at the RPC boundary, so cross-extension callers can forward serializable values without losing auth context.
 
```

**File**: `src/agent-runner.ts` (modified, +14/-1)
```diff
@@ -313,6 +313,19 @@ export function getDefaultMaxTurns(): number | undefined { return defaultMaxTurn
 /** Set the default max turns value. undefined or 0 = unlimited, otherwise minimum 1. */
 export function setDefaultMaxTurns(n: number | undefined): void { defaultMaxTurns = normalizeMaxTurns(n); }
 
+/**
+ * The turn limit a run of `type` will actually enforce: an explicit value if the
+ * caller supplied one, else the agent's own `max_turns`, else the project
+ * default. `undefined` = unlimited.
+ *
+ * Exported because the widget's turn counter (`↻3≤20`) has to predict this
+ * before the run starts, and a second copy of the expression would drift from
+ * the one below that enforces it.
+ */
+export function resolveEffectiveMaxTurns(type: string, explicit?: number): number | undefined {
+  return normalizeMaxTurns(explicit ?? getAgentConfig(type)?.maxTurns ?? defaultMaxTurns);
+}
+
 /**
  * Project default for `persist_session`, from the `rememberAgents` setting.
  * On by default: a persisted session is what lets `@handle` reopen an agent's
@@ -965,7 +978,7 @@ export async function runAgent(
 
   // Track turns for graceful max_turns enforcement
   let turnCount = 0;
-  const maxTurns = normalizeMaxTurns(options.maxTurns ?? agentConfig?.maxTurns ?? defaultMaxTurns);
+  const maxTurns = resolveEffectiveMaxTurns(type, options.maxTurns);
   let softLimitReached = false;
   let aborted = false;
 
```

**File**: `src/index.ts` (modified, +35/-10)
```diff
@@ -19,7 +19,7 @@ import { abortable } from "./abortable.js";
 import { hasAgentBadge, renderAgentName } from "./agent-color.js";
 import { buildNewAgentFile, disableInContent, enableInContent, isEmptyStub, locateAgentFile, personalAgentsDir, projectAgentsDir, serializeAgentFile } from "./agent-file-toggle.js";
 import { AgentManager } from "./agent-manager.js";
-import { getAgentConversation, getDefaultMaxTurns, getGraceTurns, getRememberAgents, normalizeMaxTurns, SUBAGENT_TOOL_NAMES, setDefaultMaxTurns, setGraceTurns, setRememberAgents, steerAgent } from "./agent-runner.js";
+import { getAgentConversation, getDefaultMaxTurns, getGraceTurns, getRememberAgents, normalizeMaxTurns, resolveEffectiveMaxTurns, SUBAGENT_TOOL_NAMES, setDefaultMaxTurns, setGraceTurns, setRememberAgents, steerAgent } from "./agent-runner.js";
 import { BUILTIN_TOOL_NAMES, getAgentConfig, getAllTypes, getAvailableTypes, getConfig, getFallbackSubagent, isDefaultsDisabled, NO_FALLBACK, registerAgents, resolveSpawnType, resolveType, setDefaultsDisabled, setFallbackSubagent } from "./agent-types.js";
 import { inChildSessionContext } from "./child-context.js";
 import { type RpcHandle, registerRpcHandlers } from "./cross-extension-rpc.js";
@@ -59,7 +59,7 @@ import {
 import { FleetList, type FleetUICtx } from "./ui/fleet-list.js";
 import { showSchedulesMenu } from "./ui/schedule-menu.js";
 import { selectItem } from "./ui/select-item.js";
-import { addUsage, getLifetimeCost, getLifetimeTotal, getSessionContextPercent, type LifetimeUsage, PendingUsagePool, toReportedUsage } from "./usage.js";
+import { getLifetimeCost, getLifetimeTotal, getSessionContextPercent, type LifetimeUsage, PendingUsagePool, toReportedUsage } from "./usage.js";
 import { isWorktreeIsolationEnabled, setWorktreeIsolationEnabled } from "./worktree.js";
 
 // ---- Shared helpers ----
@@ -99,7 +99,6 @@ function createActivityTracker(maxTurns?: number, onStreamUpdate?: () => void) {
     maxTurns,
     responseText: "",
     session: undefined,
-    lifetimeUsage: { input: 0, output: 0, cacheWrite: 0, cost: 0 },
   };
 
   const callbacks = {
@@ -125,8 +124,9 @@ function createActivityTracker(maxTurns?: number, onStreamUpdate?: () => void) {
     onSessionCreated: (session: any) => {
       state.session = session;
     },
-    onAssistantUsage: (usage: LifetimeUsage) => {
-      addUsage(state.lifetimeUsage, usage);
+    // Spend is accumulated on the AgentRecord (agent-manager), which is what
+    // every surface reads; this callback exists here only to repaint on it.
+    onAssistantUsage: (_usage: LifetimeUsage) => {
       onStreamUpdate?.();
     },
   };
@@ -610,7 +610,27 @@ export default function (pi: ExtensionAPI) {
     reloadCustomAgents();
     const dispatch = resolveSpawnType(type);
     if (!dispatch.ok) throw new Error(dispatch.message);
-    return manager.spawn(piRef, ctxRef, dispatch.type, prompt, options);
+    // Every programmatic spawn lands here — cross-extension RPC, both `@handle`
+    // mention paths, and the `Symbol.for("pi-subagents:manager")` registry — and
+    // none came through the Agent tool, which is where the UI activity tracker is
+    // otherwise created. Without one the widget and FleetView have no tool name
+    // and no turn count, so the row reads `thinking…` for the agent's whole life
+    // while the header's tool-use count climbs beside it (#181). Double-tracking
+    // is not possible: the Agent tool calls `manager.spawn` directly. The tracker
+    // callbacks are the funnel's own — a caller's are not honoured, since a
+    // half-wired tracker renders worse than none.
+    //
+    // The turn limit is resolved rather than read off `options`, which a mention
+    // spawn deliberately omits so the agent's own config can decide: a tracker
+    // built with `undefined` renders `↻3` where the Agent tool renders `↻3≤20`.
+    // Like the tool's own, it is a prediction — editing the agent file mid-run
+    // leaves the displayed ceiling stale.
+    const { state, callbacks } = createActivityTracker(resolveEffectiveMaxTurns(dispatch.type, options?.maxTurns));
+    // Repaints are left to the manager's `onStart` callback, which already starts
+    // the widget/fleet timers for agents that enter this way.
+    const id = manager.spawn(piRef, ctxRef, dispatch.type, prompt, { ...options, ...callbacks });
+    agentActivity.set(id, state);
+    return id;
   };
 
   const spawnTopLevel = (piRef: any, ctxRef: any, type: string, prompt: string, options: any) => {
@@ -1925,11 +1945,15 @@ Terse command-style prompts produce shallow, generic work.
       let fgId: string | undefined;
 
       const streamUpdate = () => {
+        // Spend from the record, everything else from the live tracker. `fgId`
+        // is set in onSessionCreated below, which fires before the first
+        // assistant message — so nothing is spent while this reads zero.
+        const fgRecord = fgId ? manager.getRecord(fgId) : undefined;
         
```

**File**: `src/ui/agent-widget.ts` (modified, +6/-8)
```diff
@@ -60,8 +60,6 @@ export interface AgentActivity {
   turnCount: number;
   /** Effective max turns for this agent (undefined = unlimited). */
   maxTurns?: number;
-  /** Lifetime usage breakdown — see LifetimeUsage docs. */
-  lifetimeUsage: LifetimeUsage;
 }
 
 /** Metadata attached to Agent tool results for custom rendering. */
@@ -432,14 +430,14 @@ export class AgentWidget {
 
       const bg = this.agentActivity.get(a.id);
       const toolUses = bg?.toolUses ?? a.toolUses;
-      // Falls back to the record: only Agent-tool spawns get an activity entry,
-      // so a scheduled or RPC-started agent would otherwise render with no
-      // stats at all — and, with the setting on, no cost.
-      const usage = bg?.lifetimeUsage ?? a.lifetimeUsage;
-      const tokens = getLifetimeTotal(usage);
+      // Spend comes from the record, never from the activity tracker: the record
+      // is the one that survives the agent finishing, and the one nested-tools
+      // folds a hidden child's spend into. Reading the tracker while an agent
+      // runs and the record once it stops made the figure jump at completion.
+      const tokens = getLifetimeTotal(a.lifetimeUsage);
       const contextPercent = getSessionContextPercent(bg?.session);
       const tokenText = tokens > 0 ? formatSessionTokens(tokens, contextPercent, theme, a.compactionCount) : "";
-      const costText = this.showCost() ? formatCost(getLifetimeCost(usage)) : "";
+      const costText = this.showCost() ? formatCost(getLifetimeCost(a.lifetimeUsage)) : "";
 
       const parts: string[] = [];
       if (bg) parts.push(formatTurns(bg.turnCount, bg.maxTurns));
```

**File**: `src/ui/conversation-viewer.ts` (modified, +5/-5)
```diff
@@ -158,15 +158,15 @@ export class ConversationViewer implements Component {
     const headerParts: string[] = [duration];
     const toolUses = this.activity?.toolUses ?? this.record.toolUses;
     if (toolUses > 0) headerParts.unshift(`${toolUses} tool${toolUses === 1 ? "" : "s"}`);
-    // The viewer opens on finished agents too, whose activity entry is long
-    // gone — the record is the only place their totals survive.
-    const usage = this.activity?.lifetimeUsage ?? this.record.lifetimeUsage;
-    const tokens = getLifetimeTotal(usage);
+    // Spend from the record, context from the live session: the record is the
+    // only total that survives the agent finishing and the only one carrying a
+    // nested child's spend.
+    const tokens = getLifetimeTotal(this.record.lifetimeUsage);
     if (tokens > 0) {
       const percent = getSessionContextPercent(this.activity?.session);
       headerParts.push(formatSessionTokens(tokens, percent, th, this.record.compactionCount));
     }
-    const cost = this.showCost ? formatCost(getLifetimeCost(usage)) : "";
+    const cost = this.showCost ? formatCost(getLifetimeCost(this.record.lifetimeUsage)) : "";
     if (cost) headerParts.push(cost);
 
     lines.push(row(
```

**File**: `src/ui/fleet-list.ts` (modified, +5/-3)
```diff
@@ -389,10 +389,12 @@ export class FleetList {
       : { fallbackColor: "muted" });
     const description = selected ? theme.fg("text", record.description) : record.description;
     const left = `  ${this.bullet(rosterIndex, sel, theme)} ${name}  ${description}`;
-    const usage = this.agentActivity.get(record.id)?.lifetimeUsage ?? record.lifetimeUsage;
-    const tokens = getLifetimeTotal(usage);
+    // The record, not the activity tracker — see the note in AgentWidget's
+    // running line: only the record carries a nested child's spend, and only it
+    // outlives the agent.
+    const tokens = getLifetimeTotal(record.lifetimeUsage);
     const elapsedMs = (record.completedAt ?? Date.now()) - record.startedAt; // freezes once finished
-    const cost = this.showCost() ? formatCost(getLifetimeCost(usage)) : "";
+    const cost = this.showCost() ? formatCost(getLifetimeCost(record.lifetimeUsage)) : "";
     const stats = `${formatFleetElapsed(elapsedMs)} · ${formatFleetTokens(tokens)}${cost ? ` · ${cost}` : ""}`;
     const right = selected ? theme.fg("text", stats) : theme.fg("dim", stats);
     return rightAlign(left, right, width);
```

**File**: `test/agent-mention-wiring.test.ts` (modified, +47/-1)
```diff
@@ -25,7 +25,7 @@ vi.mock("../src/agent-runner.js", async () => {
 // when it comes back empty. mention-clone.test.ts covers the clone itself.
 vi.mock("../src/mention-clone.js", () => ({ runMentionClone: vi.fn() }));
 
-import { resumeAgent, runAgent } from "../src/agent-runner.js";
+import { getDefaultMaxTurns, resumeAgent, runAgent, setDefaultMaxTurns } from "../src/agent-runner.js";
 import subagentsExtension from "../src/index.js";
 import { runMentionClone } from "../src/mention-clone.js";
 import { ctx, flush, type Hermetic, hermeticDir, makePi, textOf } from "./helpers/boot-extension.js";
@@ -460,6 +460,52 @@ describe("mentioning an agent that has never run", () => {
 
   });
 
+  it("shows the turn limit it will actually be held to (#181)", async () => {
+    // The spawn passes no maxTurns on purpose (see the test above), so the
+    // tracker has to resolve the same limit runAgent will enforce — otherwise
+    // the row reads `↻1` where the Agent tool would read `↻1≤9`.
+    const prevMax = getDefaultMaxTurns();
+    try {
+      const { lifecycle } = bootDirect({ defaultMaxTurns: 9 });
+      heldRun(fakeSession());
+      let factory: any;
+      const uiCtx = ctx({
+        hasUI: true,
+        ui: {
+          setStatus: vi.fn(), notify: vi.fn(), addAutocompleteProvider: vi.fn(),
+          onTerminalInput: vi.fn(() => vi.fn()), getEditorText: vi.fn(() => ""), custom: vi.fn(),
+          setWidget: vi.fn((key: string, content: any) => { if (key === "agents" && content) factory = content; }),
+        },
+      });
+      await lifecycle.get("session_start")({}, uiCtx);
+
+      await lifecycle.get("input")({ type: "input", text: "@explore go", source: "interactive" }, uiCtx);
+      await flush();
+
+      const theme = { fg: (_c: string, t: string) => t, bold: (t: string) => t };
+      const lines = factory({ terminal: { columns: 200 }, requestRender: vi.fn() }, theme).render().join("\n");
+      expect(lines).toContain("≤9");
+    } finally {
+      setDefaultMaxTurns(prevMax);
+    }
+  });
+
+  it("tracks its tool activity, so the widget shows what it is doing (#181)", async () => {
+    // A mention spawn never passes through the Agent tool, which is where the
+    // activity tracker is normally created. Without one the widget and
+    // FleetView have no tool name and no turn count for the agent, so its row
+    // reads `thinking…` from start to finish.
+    const { lifecycle } = bootDirect();
+    heldRun(fakeSession());
+
+    await send(lifecycle, "@explore go");
+
+    const opts = vi.mocked(runAgent).mock.calls[0][3] as any;
+    expect(opts.onToolActivity).toBeTypeOf("function");
+    expect(opts.onTurnEnd).toBeTypeOf("function");
+    expect(opts.onSessionCreated).toBeTypeOf("function");
+  });
+
   it("runs it in the background so the prompt is not blocked", async () => {
     const { lifecycle } = bootDirect();
     heldRun(fakeSession());
```

---

### Incident Patch 12: `42460ca4` (2026-08-18)
**Commit Message**: fix(mentions): merge handle suggestions into pi's @ list instead of replacing it

`@` is pi's file picker and the handle rows are additive, but the provider asked
pi only when NO agent matched — and matching is a prefix match, so an empty
token matched every handle. A bare `@` offered no files at all.

Both lists now merge under one prefix, agents first; where the two providers'
delimiter sets disagree, exactly one side answers and there is nothing to merge.
Calling the inner provider on tokens we used to answer alone also needs a guard:
it is not always pi's, and pi catches nothing, so one throw would exit the
session on a keystroke.

**File**: `README.md` (modified, +3/-1)
```diff
@@ -139,6 +139,8 @@ Subagents are addressable. Every agent has a typeable handle — the agent type,
   @explore-2      send message · running · find flaky tests
   @code-review    resume · code-review · check the diff
   @plan           start agent · Software architect agent for designing implementation plans.
+  index.ts        src/index.ts                        ← pi's own file rows, still there
+  index.d.ts      dist/index.d.ts
 ```
 
 The handle names the **agent**, not one process, so a single syntax covers its whole lifecycle:
@@ -195,7 +197,7 @@ The grammar mirrors Claude Code's, and is deliberately narrow so nothing gets sw
 | `@src/index.ts summarize this` | the main model, with pi's normal file attachment |
 | `@nosuchagent hello` | the main model, verbatim — no agent, no type, no interception |
 
-While an agent is live its handle addresses *it*, so `@explore` never starts a second Explore alongside a running one — use the `Agent` tool for deliberate parallelism. `@<agent-id>` works too. `main` is reserved and can never be an agent's handle (a type slugging to it gets `main-2`); handles are capped at 64 characters. A handle written as typed always wins over the `@agent-` form, so an agent genuinely called `agent-explore` stays reachable. [Nested subagents](#nested-subagents) are not addressable — they are hidden from every top-level surface and only their owner may steer them, so a handle that would name one starts a fresh top-level agent instead of reaching through that boundary. Suggestions list live agents first, then startable types; when an `@` token names an agent, file suggestions are suppressed for it. Disable the whole thing via `/agents → Settings → Agent mentions`.
+While an agent is live its handle addresses *it*, so `@explore` never starts a second Explore alongside a running one — use the `Agent` tool for deliberate parallelism. `@<agent-id>` works too. `main` is reserved and can never be an agent's handle (a type slugging to it gets `main-2`); handles are capped at 64 characters. A handle written as typed always wins over the `@agent-` form, so an agent genuinely called `agent-explore` stays reachable. [Nested subagents](#nested-subagents) are not addressable — they are hidden from every top-level surface and only their owner may steer them, so a handle that would name one starts a fresh top-level agent instead of reaching through that boundary. Suggestions list live agents first, then resumable ones, then startable types — and then pi's own file rows, in the same popup: `@` stays the file picker it always was, and the handles are added to it rather than replacing it. Disable the whole thing via `/agents → Settings → Agent mentions`.
 
 A `direct`-mode start takes the non-tool spawn path shared with the scheduler and cross-extension RPC, so — like those — it writes no `.output` transcript and the widget shows it without per-tool detail. That is the trade for skipping the model call: a `model`-mode start goes through the real `Agent` tool and keeps everything. A mention-*resumed* agent goes through the full resume wiring and keeps both in either mode.
 
```

**File**: `src/ui/agent-mention.ts` (modified, +62/-10)
```diff
@@ -15,15 +15,31 @@
  *
  * pi's `CombinedAutocompleteProvider` already owns `@`, where it means "attach a
  * file". Extensions can wrap it (`ctx.ui.addAutocompleteProvider`), so this
- * provider answers the `@` tokens that name an agent and delegates every other
- * one — including all of `applyCompletion`, whose `@`-branch already inserts
+ * provider adds the `@` tokens that name an agent and delegates everything else
+ * — including all of `applyCompletion`, whose `@`-branch already inserts
  * `item.value` plus a trailing space, which is exactly what a handle needs.
  *
- * Matching mirrors Claude Code: case-insensitive prefix (not fuzzy), and when
- * any agent matches, files are dropped from the list rather than mixed in — an
- * `@name` that names an agent is never also a path. Offering never-started
- * types is a deliberate step beyond it; Claude Code's registry holds only live
- * tasks, so an agent you had not launched yet was unaddressable.
+ * Matching mirrors Claude Code: case-insensitive prefix, not fuzzy. What it does
+ * NOT mirror is Claude Code dropping files whenever an agent matches. Here `@` is
+ * pi's file picker first, and the handles are additive, so a token matching both
+ * lists both — agents first. Suppressing on any match sounds narrow and is not:
+ * an empty token prefix-matches every handle, so a bare `@` — the gesture people
+ * use to browse files — would offer no files at all, and a single letter
+ * beginning any handle would do the same.
+ *
+ * Both halves ship under ONE `prefix`, which is sound because wherever BOTH sides
+ * produce rows they measured the same span. pi's `extractAtPrefix` takes the
+ * token after the last of `{space, tab, ", ', =}` and keeps it only if it starts
+ * with `@`; `MENTION_TRIGGER` matches `@[\w-]*` at the cursor, after start-of-line
+ * or `[\s。、？！]`. Where those two disagree, exactly one side answers and there
+ * is nothing to merge: `@src/index.ts` and `@"my file` are pi's alone (no handle
+ * matches), `=@ex` is pi's alone (`=` is a delimiter to pi, not a boundary to us),
+ * and `。@ex` is ours alone (the reverse). A merged response therefore never
+ * carries a prefix from one side and an item from the other.
+ *
+ * Offering never-started types is a deliberate step beyond Claude Code, whose
+ * registry holds only live tasks, so an agent you had not launched yet was
+ * unaddressable.
  */
 
 import type { AutocompleteItem, AutocompleteProvider, AutocompleteSuggestions } from "@earendil-works/pi-tui";
@@ -103,6 +119,10 @@ export function createMentionProvider(
   roster: () => MentionTarget[],
   isEnabled: () => boolean,
 ): AutocompleteProvider {
+  // One warning per provider, not per keystroke: `getSuggestions` runs on every
+  // character typed after `@`, so an unguarded log would bury the terminal in
+  // the time it takes to finish a word.
+  let warnedInnerFailure = false;
   return {
     // Only `@` — the contract is "characters that should naturally trigger
     // THIS provider", and pi unions each wrapper's own set onto the outermost
@@ -111,9 +131,41 @@ export function createMentionProvider(
     triggerCharacters: ["@"],
 
     async getSuggestions(lines, cursorLine, cursorCol, options): Promise<AutocompleteSuggestions | null> {
-      const items = isEnabled() ? mentionItems(roster(), lines[cursorLine] ?? "", cursorCol) : null;
-      if (items) return items;
-      return current.getSuggestions(lines, cursorLine, cursorCol, options);
+      const mine = isEnabled() ? mentionItems(roster(), lines[cursorLine] ?? "", cursorCol) : null;
+      // Asked unconditionally: pi owns `@` and must keep answering for it even
+      // when a handle matches too. That is the same work vanilla pi does on any
+      // `@` keystroke — a capped `fd` search, or nothing at all when the host
+      // configured no `fd` path — but we now do it on tokens we used to answer
+      // alone, so it must not be able to take the popup down with it. The
+      // wrapped provider is not always pi's: another extension may sit inside
+      // us, and before this it was never called for a token naming an agent.
+      // try/catch, not `.catch()`: a provider that throws SYNCHRONOUSLY never
+      // returns the promise a `.catch()` would attach to, and the throw escapes
+      // this method as a rejection — which pi does not handle either
+      // (components/editor.js:1892 awaits with no catch of its own).
+      let theirs: AutocompleteSuggestions | null = null;
+      try {
+        theirs = await current.getSuggestions(lines, cursorLine, cursorCol, options);
+      } catch (err) {
+        // Safe to treat as "no files": pi discards any response whose request is
+        // no longer current, so an aborted search that surfaces as a rejection
+        // cannot leave a stale popup behind (`isAutocompleteRequestCurrent`).
+        // Warned rather than swallowed outright — the failure is invisible in
+        // the popup, and the sam
```

**File**: `test/agent-mention-provider.test.ts` (modified, +137/-31)
```diff
@@ -2,11 +2,13 @@
  * agent-mention-provider.test.ts — the `@handle` suggestions stacked on pi's
  * built-in autocomplete.
  *
- * The provider sits in front of file completion, so the risk is in the two
- * directions it can get the handoff wrong: claiming an `@` token that was meant
- * to attach a file (which would make `@src/…` uncompletable), or delegating one
- * that names a live agent (which buries the agent under fuzzy path matches).
- * Every case below pins one side of that boundary.
+ * The provider sits in front of file completion and must not take it away: `@`
+ * still means "attach a file" in pi, and agents are additive, so a token that
+ * matches both lists them both — agents first, then pi's rows, under one
+ * `prefix`. The risks are at the seam: dropping pi's list when an agent matches
+ * (which is what made a bare `@` stop offering files), inserting the wrong span
+ * because the two providers disagreed about the token, and claiming a token that
+ * was only ever a path. Every case below pins one of those.
  */
 import { CombinedAutocompleteProvider } from "@earendil-works/pi-tui";
 import { describe, expect, it, vi } from "vitest";
@@ -72,21 +74,40 @@ function tombstone(over: Partial<AgentTombstone> = {}): AgentTombstone {
 const suggest = (provider: ReturnType<typeof createMentionProvider>, line: string) =>
   provider.getSuggestions([line], 0, line.length, { signal: new AbortController().signal });
 
+/**
+ * Just the rows we contributed. pi's stub rows are dropped by identity, so a
+ * test about handle ordering stays about handle ordering — without pretending
+ * no file matched, which is the state that hid this bug in the first place.
+ */
+const agentRows = (result: Awaited<ReturnType<typeof suggest>>) =>
+  (result?.items ?? []).filter(item => !(FILE_SUGGESTIONS.items as unknown[]).includes(item));
+
 describe("agent suggestions", () => {
-  it("offers matching handles and keeps files out of the list", async () => {
+  it("lists matching handles above pi's files rather than instead of them", async () => {
     const current = builtIn();
     const provider = createMentionProvider(current, () => mentionRoster(managerWith(record({ handle: "explore" })), []), () => true);
 
     const result = await suggest(provider, "@ex");
 
     expect(result).toEqual({
-      items: [{ value: "@explore", label: "@explore", description: "send message · running · find flaky tests" }],
+      items: [
+        { value: "@explore", label: "@explore", description: "send message · running · find flaky tests" },
+        ...FILE_SUGGESTIONS.items,
+      ],
+      // Ours, not the stub's: when both match, both describe the same span (see
+      // the real-provider describe below), and ours is the authority on where
+      // the handle token starts.
       prefix: "@ex",
     });
-    expect(current.getSuggestions).not.toHaveBeenCalled();
+    // Verbatim: the inner provider has to see the same line, cursor and options
+    // the editor handed us, or its rows describe a different token than ours.
+    expect(current.getSuggestions).toHaveBeenCalledWith(["@ex"], 0, 3, expect.objectContaining({ signal: expect.anything() }));
   });
 
-  it("offers every agent on a bare @", async () => {
+  it("offers every agent on a bare @, and still offers files", async () => {
+    // The regression this file exists for: an empty token prefix-matches EVERY
+    // handle, so suppressing files "when an agent matches" suppressed them on
+    // the one gesture people use to browse — `@` alone.
     const provider = createMentionProvider(
       builtIn(),
       () => mentionRoster(managerWith(record({ handle: "explore" }), record({ handle: "plan", startedAt: 2000 })), []),
@@ -95,7 +116,70 @@ describe("agent suggestions", () => {
 
     const result = await suggest(provider, "@");
 
-    expect(result?.items.map(i => i.value)).toEqual(["@explore", "@plan"]);
+    expect(result?.items.map(i => i.value)).toEqual(["@explore", "@plan", "@src/index.ts"]);
+  });
+
+  it("offers agents alone when no file matched", async () => {
+    const current = builtIn();
+    current.getSuggestions.mockResolvedValue(null);
+    const provider = createMentionProvider(current, () => mentionRoster(managerWith(record({ handle: "explore" })), []), () => true);
+
+    expect(await suggest(provider, "@ex")).toEqual({
+      items: [{ value: "@explore", label: "@explore", description: "send message · running · find flaky tests" }],
+      prefix: "@ex",
+    });
+  });
+
+  it("still offers agents when the wrapped provider throws", async () => {
+    // We now call the inner provider for tokens we used to answer alone, and it
+    // is not always pi's — an extension registered before us sits inside. A
+    // rejection there must not delete the handle rows too.
+    const current = builtIn();
+    current.getSuggestions.mockRejectedValue(new Error("inner provider exploded"));
+    const provider = createMentionProvider(current, () => men
```

---

### Incident Patch 13: `929d2b68` (2026-08-18)
**Commit Message**: clean dist before rebuild

**File**: `package.json` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@
     "nanoid": "^5.0.0"
   },
   "scripts": {
-    "build": "tsc",
+    "build": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\" && tsc",
     "prepublishOnly": "npm run lint && npm run typecheck && npm run test && npm run build",
     "test": "vitest run",
     "test:watch": "vitest",
```

---

### Incident Patch 14: `b4de91ed` (2026-08-18)
**Commit Message**: fix(mentions): let the conversation clone reach its tool, and force background

Two bugs, the second hidden behind the first.

`noTools: "all"` reads like "no built-ins, keep my custom tool" and isn't: Pi
turns it into an empty allowlist, which strips the clone's own `Agent` tool
too. The clone was prompted with nothing to call and every mention fell back to
a direct start with a warning.

Fixing that reached the clone's `Agent` call for the first time — as a
foreground spawn, which answers through its tool result and is marked
`resultConsumed` so no completion notification is sent. That result went into a
session disposed moments later, so the agent ran and reached nobody. Background
is now forced; the clone's model is never told its turn is discarded, so it
cannot be left to choose.

Tests: the fake now reproduces Pi's tool filtering, an e2e guard asserts the
real session's active tools are exactly ["Agent"], and the start path finally
has the notification coverage only resume had.

**File**: `src/mention-clone.ts` (modified, +27/-4)
```diff
@@ -50,7 +50,12 @@
  *     file both under the throwaway fork;
  *   - it is called with no tool-call id. The clone's turn produces one, but the
  *     real session never issued it, and a `<tool-use-id>` pointing at nothing
- *     is exactly the bug the mention-resume path had to fix.
+ *     is exactly the bug the mention-resume path had to fix;
+ *   - and it is forced into the background. A foreground agent returns its
+ *     answer as the tool result and is marked `resultConsumed` so no completion
+ *     notification is sent — correct when the caller is the real conversation,
+ *     silent loss when the caller is a fork about to be discarded. Background
+ *     delivery is the only route from a mention back to the main model.
  *
  * The clone gets one tool and one job. It cannot read, write or run anything —
  * an invisible turn with the full toolset could do invisible work.
@@ -110,8 +115,18 @@ export async function runMentionClone(opts: MentionCloneOptions): Promise<Mentio
         });
       }
       spawned = true;
-      // undefined tool-call id + the main ctx: see the header.
-      return agentTool.execute(undefined as never, params, signal, onUpdate, ctx);
+      // undefined tool-call id + the main ctx: see the header. Background is
+      // forced rather than left to the clone: `run_in_background` defaults to
+      // false, and a foreground agent answers through its TOOL RESULT — which
+      // here is delivered into a session that is disposed moments later, so the
+      // agent would run, appear in the widget and the fleet, and reach nobody.
+      return agentTool.execute(
+        undefined as never,
+        { ...(params as Record<string, unknown>), run_in_background: true } as typeof params,
+        signal,
+        onUpdate,
+        ctx,
+      );
     },
   };
 
@@ -141,7 +156,15 @@ export async function runMentionClone(opts: MentionCloneOptions): Promise<Mentio
         ...(thinkingLevel && { thinkingLevel }),
         modelRegistry: ctx.modelRegistry,
         ...(parentModelRuntime !== undefined && { modelRuntime: parentModelRuntime as never }),
-        noTools: "all",
+        // An allowlist naming exactly the clone's own tool. NOT `noTools:
+        // "all"`, whose doc comment ("start with no tools enabled") reads like
+        // it spares custom tools and does not: it resolves to an EMPTY
+        // allowlist, and `isAllowedTool` then drops every tool from the
+        // registry — the custom one included. The clone would be prompted with
+        // nothing to call, answer in prose, and every mention would fall
+        // through to the direct start with a warning. Same idiom as
+        // agent-runner's `tools: sessionTools` beside its nested `customTools`.
+        tools: [cloneAgentTool.name],
         customTools: [cloneAgentTool],
       } as Parameters<typeof createAgentSession>[0]),
     );
```

**File**: `test/e2e/mention-clone-tool-reachability.e2e.test.ts` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+/**
+ * mention-clone-tool-reachability.e2e.test.ts — reachability guard for the one
+ * tool the mention clone is built around.
+ *
+ * `runMentionClone` hands a session ONE tool and expects the model to call it.
+ * Whether that tool ever reaches the model is decided entirely inside Pi, by
+ * `createAgentSession`'s allowlist plumbing — and the unit tests cannot see it:
+ * their `createAgentSession` is a mock that hands `customTools[0]` straight to
+ * the model turn, so a session option that silently strips the tool passes
+ * every one of them.
+ *
+ * That is not hypothetical. The clone shipped with `noTools: "all"` on the
+ * reading its doc comment invites ("start with no tools enabled" — no
+ * built-ins, keep mine). Pi turns that flag into an EMPTY allowlist, and an
+ * empty array is truthy, so `AgentSession` builds an empty `Set` and
+ * `isAllowedTool` rejects every name — custom tools are filtered by the same
+ * predicate as built-ins. Every mention was prompted with no tools, answered in
+ * prose, and fell back to a direct start with a warning. The unit suite stayed
+ * green throughout.
+ *
+ * So this asserts against a REAL session, on the two things a mock cannot
+ * establish:
+ *   1. the clone's `Agent` tool is actually active on it, and
+ *   2. nothing else is — the invisible turn cannot read, write or run anything.
+ *
+ * No network/LLM: a faux provider satisfies session construction, and the
+ * assertion is on the constructed tool set rather than on a model turn.
+ */
+import { mkdtempSync, rmSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+
+// Real pi-mono session construction; a cold first run under full-suite CPU
+// contention can exceed vitest's 5s default.
+vi.setConfig({ testTimeout: 30_000 });
+
+// Hoisted so the (lifted) mock factory can reach it. Everything except the
+// capture is the real module — the point is to construct a REAL session.
+const { sessions } = vi.hoisted(() => ({ sessions: [] as any[] }));
+
+vi.mock("@earendil-works/pi-coding-agent", async () => {
+  const actual = await vi.importActual<any>("@earendil-works/pi-coding-agent");
+  return {
+    ...actual,
+    createAgentSession: async (opts: any) => {
+      const created = await actual.createAgentSession(opts);
+      sessions.push(created.session);
+      return created;
+    },
+  };
+});
+
+import { runMentionClone } from "../../src/mention-clone.js";
+import { fauxModelBackend } from "../helpers/faux-model-backend.js";
+import { registerFauxProvider } from "../helpers/pi-ai.js";
+
+describe("mention clone tool reachability against real pi-mono", () => {
+  let cwd: string;
+  let faux: ReturnType<typeof registerFauxProvider>;
+
+  beforeEach(() => {
+    sessions.length = 0;
+    cwd = mkdtempSync(join(tmpdir(), "subagents-mention-clone-"));
+    faux = registerFauxProvider({ provider: "faux", models: [{ id: "faux-1", contextWindow: 200_000 }] });
+  });
+  afterEach(() => {
+    faux.unregister();
+    rmSync(cwd, { recursive: true, force: true });
+  });
+
+  it("the clone's Agent tool is live on the real session, and it is the only one", async () => {
+    const model = faux.getModel();
+    const backend = fauxModelBackend(model);
+    const ctx: any = {
+      cwd,
+      model,
+      getSystemPrompt: () => "PARENT",
+      // mention-clone reads the runtime off the registry facade, the same shim
+      // agent-runner carries for Pi >= 0.80.8.
+      modelRegistry: { ...backend.modelRegistry, runtime: backend.modelRuntime },
+      sessionManager: { getEntries: () => [], getLeafId: () => undefined },
+    };
+
+    // Never called: the assertion is on what the session exposes, not on the
+    // faux model deciding to use it.
+    const agentTool = { name: "Agent", execute: vi.fn() } as any;
+
+    // Never rejects by contract; a faux turn that cannot complete is fine,
+    // because the tool set is fixed at construction.
+    await runMentionClone({ ctx, type: "Explore", message: "go", agentTool });
+
+    expect(sessions).toHaveLength(1);
+    // The bug this file exists for: with an empty allowlist this is `[]`.
+    expect(sessions[0].getActiveToolNames()).toEqual(["Agent"]);
+  });
+});
```

**File**: `test/mention-clone.test.ts` (modified, +71/-3)
```diff
@@ -74,9 +74,28 @@ function agentTool() {
   } as any;
 }
 
+/**
+ * Pi's own tool-visibility rule, reproduced from `sdk.js` + `agent-session.js`:
+ * an allowlist is derived once (`tools`, or the empty list when `noTools:
+ * "all"`), and EVERY tool — built-in, extension and custom alike — is dropped
+ * from the registry unless the allowlist names it. So `noTools: "all"` does not
+ * mean "no built-ins, keep my custom tool": it means the clone is handed
+ * nothing, answers in prose, and the mention falls back to a direct start.
+ */
+function visibleTools(opts: any): any[] {
+  const allowed = opts.tools ?? (opts.noTools === "all" ? [] : undefined);
+  const allowedSet = allowed ? new Set<string>(allowed) : undefined;
+  const excluded = new Set<string>(opts.excludeTools ?? []);
+  return (opts.customTools ?? []).filter(
+    (tool: any) => (!allowedSet || allowedSet.has(tool.name)) && !excluded.has(tool.name),
+  );
+}
+
 /**
  * Stand in for `createAgentSession`. `turn` receives the clone's single custom
- * tool and plays the part of the model deciding what to do with it.
+ * tool and plays the part of the model deciding what to do with it — and only
+ * the tools Pi would really expose reach it, so a clone built with an allowlist
+ * that hides its own tool prompts a model with nothing to call.
  */
 function cloneSession(turn?: (tool: any) => Promise<void> | void) {
   const session = {
@@ -85,8 +104,11 @@ function cloneSession(turn?: (tool: any) => Promise<void> | void) {
     dispose: vi.fn(),
   } as any;
   createAgentSession.mockImplementation(async (opts: any) => {
+    const tools = visibleTools(opts);
     session.prompt.mockImplementation(async () => {
-      await turn?.(opts.customTools[0]);
+      // No tool, no tool call: the model can only answer in prose.
+      if (tools.length === 0) return;
+      await turn?.(tools[0]);
     });
     session.createdWith = opts;
     return { session };
@@ -203,9 +225,26 @@ describe("cloning the conversation", () => {
     await runMentionClone(opts());
 
     const built = createAgentSession.mock.calls[0][0];
-    expect(built.noTools).toBe("all");
     expect(built.customTools).toHaveLength(1);
     expect(built.customTools[0].name).toBe("Agent");
+    expect(visibleTools(built).map((tool: any) => tool.name)).toEqual(["Agent"]);
+  });
+
+  it("names its own tool in the allowlist, or Pi hands it nothing", async () => {
+    // `noTools: "all"` reads like "no built-ins, keep my custom tool" and is
+    // not: it sets an EMPTY allowlist, which strips the custom tool from the
+    // registry too (agent-session.js `isAllowedTool`). The clone then has
+    // nothing to call, every mention falls through to the direct start, and the
+    // user sees "Started @x directly — the conversation clone did not start it"
+    // on every single one. Naming the tool is what makes it reachable.
+    cloneSession(callsAgent());
+
+    const result = await runMentionClone(opts());
+
+    const built = createAgentSession.mock.calls[0][0];
+    expect(built.tools).toEqual(["Agent"]);
+    expect(built.noTools).toBeUndefined();
+    expect(result).toEqual({ spawned: true });
   });
 
   it("prompts it with the message, then the reminder", async () => {
@@ -254,9 +293,38 @@ describe("attributing the spawn to the real session", () => {
     expect(tool.execute.mock.calls[0][1]).toEqual({
       subagent_type: "Plan",
       prompt: "sketch the migration",
+      run_in_background: true,
     });
   });
 
+  it("forces the spawn into the background — a foreground result goes nowhere", async () => {
+    // `run_in_background` defaults to false, and a foreground agent returns its
+    // answer as the TOOL RESULT: AgentManager marks the record `resultConsumed`
+    // precisely so the completion notification is skipped as redundant. Here
+    // that tool result lands in the throwaway clone, which is disposed moments
+    // later — so the agent runs to completion, shows up in the widget and the
+    // fleet, and its answer reaches nobody. The main conversation is not part
+    // of the clone's turn, so background delivery is the only way back.
+    const tool = agentTool();
+    cloneSession(callsAgent({ subagent_type: "Explore", prompt: "go" }));
+
+    await runMentionClone(opts({ agentTool: tool }));
+
+    expect(tool.execute.mock.calls[0][1]).toMatchObject({ run_in_background: true });
+  });
+
+  it("overrides a clone that explicitly asked for a foreground run", async () => {
+    // Nothing tells the clone's model that its own turn is discarded, so an
+    // explicit `false` is a reasonable thing for it to emit. It must not decide
+    // this one.
+    const tool = agentTool();
+    cloneSession(callsAgent({ subagent_type: "Explore", prompt: "go", run_in_background: false }));
+
+    await runMentionClone(opts({ agentTool: tool }));
+
+    expect(tool.execute.mock.calls[0][1]).toMatchObject({ run_in_background: true });
+  });
+
   it("refuses a second spaw
```

**File**: `test/mention-start-notification.test.ts` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+/**
+ * mention-start-notification.test.ts — does an agent STARTED by a mention
+ * report back to the main conversation?
+ *
+ * The resume path is pinned in agent-mention-wiring.test.ts ("relays the
+ * resumed answer through the ordinary completion notification"). The start path
+ * — `@handle msg` naming a type with no live instance — has no equivalent, and
+ * it is the path every first mention takes.
+ */
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+
+vi.mock("../src/agent-runner.js", async () => {
+  const actual = await vi.importActual<typeof import("../src/agent-runner.js")>("../src/agent-runner.js");
+  return { ...actual, runAgent: vi.fn(), resumeAgent: vi.fn() };
+});
+vi.mock("../src/mention-clone.js", () => ({ runMentionClone: vi.fn() }));
+
+import { resumeAgent, runAgent } from "../src/agent-runner.js";
+import subagentsExtension from "../src/index.js";
+import { runMentionClone } from "../src/mention-clone.js";
+import { ctx, type Hermetic, hermeticDir, makePi } from "./helpers/boot-extension.js";
+
+let hermetic: Hermetic | undefined;
+let booted: Map<string, any> | undefined;
+
+beforeEach(() => {
+  vi.mocked(runAgent).mockReset();
+  vi.mocked(resumeAgent).mockReset();
+  vi.mocked(runMentionClone).mockReset();
+});
+
+afterEach(async () => {
+  await booted?.get("session_shutdown")?.();
+  delete (globalThis as any)[Symbol.for("pi-subagents:manager")];
+  booted = undefined;
+  hermetic?.restore();
+  hermetic = undefined;
+});
+
+function fakeSession() {
+  return {
+    steer: vi.fn().mockResolvedValue(undefined),
+    dispose: vi.fn(),
+    subscribe: vi.fn(() => () => {}),
+    messages: [],
+    getActiveToolNames: vi.fn(() => []),
+  } as any;
+}
+
+function boot(settings: Record<string, unknown> = {}) {
+  hermetic = hermeticDir({ settings: { outputTranscript: false, ...settings } });
+  const b = makePi();
+  subagentsExtension(b.pi);
+  booted = b.lifecycle;
+  return b;
+}
+
+const send = (lifecycle: Map<string, any>, text: string) =>
+  lifecycle.get("input")({ type: "input", text, source: "interactive" }, ctx());
+
+describe("an agent started by a mention", () => {
+  it("relays its answer through the ordinary completion notification (direct mode)", async () => {
+    const { pi, lifecycle } = boot({ agentMentions: "direct" });
+    vi.mocked(runAgent).mockResolvedValue({
+      responseText: "found four planted bugs",
+      session: fakeSession(),
+      aborted: false,
+      steered: false,
+      failure: undefined,
+    } as any);
+
+    await send(lifecycle, "@Explore find the planted bugs in src/");
+    await new Promise(r => setTimeout(r, 500));
+
+    expect(pi.sendMessage).toHaveBeenCalledWith(
+      expect.objectContaining({
+        customType: "subagent-notification",
+        content: expect.stringContaining("found four planted bugs"),
+      }),
+      expect.objectContaining({ triggerTurn: true }),
+    );
+  });
+
+  it("relays it when the clone fell back to a direct start (model mode)", async () => {
+    // What the user hits today: the clone reports it could not start the agent,
+    // index.ts starts it directly, and the answer still has to come back.
+    const { pi, lifecycle } = boot();
+    vi.mocked(runMentionClone).mockResolvedValue({ spawned: false, error: "the conversation clone did not start it" });
+    vi.mocked(runAgent).mockResolvedValue({
+      responseText: "cyan, obviously",
+      session: fakeSession(),
+      aborted: false,
+      steered: false,
+      failure: undefined,
+    } as any);
+
+    await send(lifecycle, "@Explore whats your favorite color");
+    await new Promise(r => setTimeout(r, 500));
+
+    expect(pi.sendMessage).toHaveBeenCalledWith(
+      expect.objectContaining({
+        customType: "subagent-notification",
+        content: expect.stringContaining("cyan, obviously"),
+      }),
+      expect.objectContaining({ triggerTurn: true }),
+    );
+  });
+});
```

---

### Incident Patch 15: `1060dc4f` (2026-08-17)
**Commit Message**: docs(changelog): trim overlong 0.17.0 entries to AGENTS.md length guidance

**File**: `CHANGELOG.md` (modified, +4/-4)
```diff
@@ -15,15 +15,15 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Added
 - **Subagents are addressable from the prompt: `@handle message` goes to that agent instead of the main model.** Reaching one previously meant spending a main-model turn on `steer_subagent`, or walking the FleetView. The handle names the agent, not one process, so a running or queued agent is messaged, a finished one is resumed in the background, and one that never ran is started — the reply arrives as the ordinary background-completion notification either way. Every agent gets a handle from its type, numbered on collision (`explore`, `explore-2`), offered by `@` completion alongside pi's file completion. Only a leading `@handle` followed by a message is a send, so a bare `@explore`, a mid-sentence mention and `@src/index.ts` still reach the model; toggle with `agentMentions`.
-- **Mentioning an agent that isn't running now starts it through an off-screen clone of the conversation.** Claude Code never spawns a mentioned agent itself: `@agent-<type>` becomes an attachment appending a `<system-reminder>` to the prompt — *"the user has expressed a desire to invoke the agent X. Please invoke the agent appropriately, passing in the required context to it."* — and the model makes the tool call, writing the agent's prompt from the conversation rather than forwarding the typed line. That buys a real `Agent` call and a context-aware prompt, at the price of a visible turn narrating a decision the handle already made. Both are kept: the conversation is copied into a throwaway in-memory session — a literal clone of the session's own entries, same system prompt, not `inherit_context`'s text rendering of them — which takes the turn holding only the `Agent` tool. The copy is taken from memory and is compaction-aware, so it works on the first input of a session, where the session file is still empty (`SessionManager` withholds every write until the first assistant message). Nothing enters the chat but a `Starting @plan…` toast, and what it starts is an ordinary top-level agent with an `.output` transcript, per-tool widget detail and a handle, attributed to the real session. `agentMentions` accordingly takes `"model"` (default), `"direct"` — the previous behaviour, started here from your text with no model call — or `"off"`; the old booleans still read as `"model"`/`"off"`. Messaging a running agent and resuming a finished one are direct in both modes. A clone that cannot run falls back to a direct start rather than losing the mention, and `"model"` lifts the TUI-only restriction for starts, so `pi -p '@plan the migration'` now works.
+- **Mentioning an agent that isn't running now starts it through an off-screen clone of the conversation.** A throwaway copy of the session takes a turn holding only the `Agent` tool, so the model writes the agent's prompt from the conversation instead of forwarding your typed line — the context-aware prompt Claude Code gets from its own mention flow, without a visible turn narrating a decision the handle already made. Nothing enters the chat but a `Starting @plan…` toast, and what starts is an ordinary top-level agent with a transcript, widget detail and a handle. `agentMentions` accordingly takes `"model"` (default), `"direct"` — the previous behaviour, started from your text with no model call — or `"off"`; the old booleans still read as `"model"`/`"off"`. Messaging a running agent and resuming a finished one are direct in both modes, a clone that cannot run falls back to a direct start rather than losing the mention, and `"model"` lifts the TUI-only restriction for starts, so `pi -p '@plan the migration'` now works.
 - **`@handle` keeps working after the agent's record is gone.** Handles used to expire with the in-memory record ~10 minutes past completion, silently flipping `@explore anything else?` from *resume* to *start fresh*. An evicted agent now leaves a tombstone and the mention reopens its session from disk (requires `rememberAgents`, below). Only the definition is re-resolved, so a continuation runs under the type's current frontmatter — and a resume whose type has since been deleted or disabled is refused rather than falling back to another agent. Tombstones cap at 100 and clear on `/new` and session switch.
 - **The model can `name` an agent, and names work wherever ids do.** `Agent` takes an optional `name`, so an agent can be `@auth-audit` instead of leaving you to tell `@explore-2` from `@explore-3`. Naming is additive — the type-derived handle is still assigned, and both draw from one namespace, so neither can shadow the other. `steer_subagent` and `get_subagent_result` now accept a handle as well as an id, ids first, so existing calls are unchanged.
 - **`@main <message>` forces text to the main model; `@agent-<type>` is a synonym.** `main` is reserved and can never be allocated to an agent, so a leading `@main` is stripped and the rest passes through with its
```

#### Recent Merged Pull Requests:
- **PR #361** (closed): fix: declare typebox packages as peerDependencies (@mbeltagy)
- **PR #354** (closed): fix: keep subagent models on the intended provider (@perapp)
- **PR #353** (closed): fix: suppress stale subagent completion notifications (@perapp)
- **PR #340** (closed): fix: await a flag-launched workflow in one-shot headless modes (@ajaynomics)
- **PR #338** (closed): fix: survive session replacement when a flag-launched workflow finishes (@ajaynomics)
- **PR #337** (closed): fix: honour an agent's `isolated` in SubagentWorkflow spawns (@ajaytravel)
- **PR #336** (closed): fix: await a flag-launched workflow in one-shot headless modes (@ajaytravel)
- **PR #335** (closed): fix: survive session replacement when a flag-launched workflow finishes (@ajaytravel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
