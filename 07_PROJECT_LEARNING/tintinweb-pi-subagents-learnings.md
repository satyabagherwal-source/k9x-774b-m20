# Forensic Learning Record (Deep Inspection): tintinweb/pi-subagents

> **Canonical Artifact**: `07_PROJECT_LEARNING/tintinweb-pi-subagents-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tintinweb/pi-subagents](https://github.com/tintinweb/pi-subagents))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:58:42.450Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tintinweb/pi-subagents`
- **Description**: Claude Code like Sub-Agents & Workflow Orchestration for Pi — parallel execution, live widget, fleet view, custom agent types, mid-run steering, claude compatible dynamic workflows and more ...
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1233 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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

Co-authored-by: tintinweb <tintinweb@oststrom.com>

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
 
       expect(() => viewer.render(80)).not.toThr
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
+      rmSync(project
```

---

### Incident Patch 5: `917853c2` (2026-08-24)
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
@@ -442,7 +442,7 @@ Create 
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
+     
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

---

### Incident Patch 6: `92422a4b` (2026-08-24)
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
+- **Configuration a spawn could not honour is disclosed rather than presented as what was asked for** ([#182](https://github.com/tintinweb/pi-subagents/issues/182)). An agent file's pinned `model` or `thinking` outranks the matching tool-call parameter, 
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
+        return resolvedAsked.provider === model?.provider && resolvedAsked.id
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

---

### Incident Patch 7: `c73e968e` (2026-08-23)
**Commit Message**: fix(ui): close conversation viewer on Ctrl+C (#255)

Co-authored-by: elrond <171308700+elrond298@users.noreply.github.com>

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

### Incident Patch 8: `9afe114c` (2026-08-19)
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
+    a
```

---

### Incident Patch 9: `af042244` (2026-08-19)
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

Co-authored-by: Xiangzhe <xiangzhedev@gmail.com>

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -22,7 +22,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 - **The `Agent` tool no longer tells the model that foreground agents run one at a time** ([#232](https://github.com/tintinweb/pi-subagents/issues/232) — thanks [@willfenton](https://github.com/willfenton)). *"Foreground calls run sequentially — only one executes at a time"* was never true: pi's agent loop dispatches a message's tool calls through `Promise.all` unless the whole batch opts out via `toolExecution: "sequential"` or some tool in it declares `executionMode: "sequential"`, and this extension sets neither — two foreground `Agent` calls in one message start within microseconds of each other. Nothing serialized them at this layer either; `agent-manager` deliberately exempts foreground agents from the `maxConcurrent` queue, since they block the parent anyway. The claim was self-inflicted rather than inherited: `d0cb511` replaced a correct bullet with it, and the later upstream-alignment pass grafted it onto the end of Claude Code's real sentence instead of replacing it, which also left an invented `with run_in_background: true on each` qualifier in the middle — upstream says a single message with multiple tool uses runs concurrently, full stop. Both are gone, restoring upstream's wording (minus its build-validator/test-runner example, consistent with the examples already omitted for token cost). The cost of the error was steering: an orchestrator that wanted parallelism was pushed into background spawns it did not need, paying a queue slot and a notification round-trip for concurrency it already had. Investigating where the sentence came from is what surfaced the default divergence in the breaking note above, so the two ship together — the remaining foreground/background prose is now Claude Code's own, including the `Don't race` bullet that only earns its place once background is the default.
-- **Scheduled and RPC-spawned agents show their token counts in the widget, and finished agents keep theirs in the conversation viewer.** Both surfaces read from the live activity tracker, which only `Agent`-tool spawns get and which is deleted the moment an agent finishes — so those agents rendered with no token stats at all. Both now fall back to the agent's record, where the totals survive. Spotted in [#194](https://github.com/tintinweb/pi-subagents/pull/194) — thanks [@daanzu](https://github.com/daanzu).
+- **Scheduled and RPC-spawned agents show their token counts in the widget, and finished agents keep theirs in the conversation viewer.** Both surfaces read spend from the live activity tracker, which only `Agent`-tool spawns get and which is deleted the moment an agent finishes — so those agents rendered with no token stats at all. Every surface now reads it from the agent's record instead: the record is the only total that outlives the run and the only one a nested child's spend is folded into, so the figure no longer jumped upward at completion as the read switched from one to the other. The tracker keeps what is genuinely live — tool activity, turn count, context percentage — and no longer accumulates a second copy of the totals. Spotted in [#194](https://github.com/tintinweb/pi-subagents/pull/194) — thanks [@daanzu](https://github.com/daanzu).
+- **Agents started outside the `Agent` tool say what they are doing, instead of `thinking…` for their whole run** ([#181](https://github.com/tintinweb/pi-subagents/pull/181) — thanks [@xz-dev](https://github.com/xz-dev)). The widget's activity line and turn counter come from an activity tracker that only the `Agent` tool handler created, so an agent started through cross-extension RPC (the path `TaskExecute` uses), through an `@handle` mention, or through the `Symbol.for("pi-subagents:manager")` registry showed a permanent `thinking…` while the same row's tool-use count climbed beside it and the conversation viewer showed the real work. The tracker now belongs to the on
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
 
 `options.model` accepts either a `Model` object (e.g. `ctx.model`) or a `"provider/modelId"` string — strings are resolved against `ctx.modelRegistry` at the RPC boundary, so cross-extension callers can forward serializable value
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
+    // leaves the displayed ceilin
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

---

### Incident Patch 10: `42460ca4` (2026-08-18)
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
+ 
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
+    expect(result?.items.map(i => i.value)).toEqual(["@explore", "@plan", 
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
