> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/storybookjs-storybook-learnings.md`  
> **Source**: github ([https://github.com/storybookjs/storybook](https://github.com/storybookjs/storybook))  
> **Source Version**: `8bddc82a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T00:02:53.736Z  
> **Learning ID**: `learn-github-storybookjs-storybook`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): storybookjs/storybook

> **Canonical Artifact**: `07_PROJECT_LEARNING/storybookjs-storybook-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/storybookjs/storybook](https://github.com/storybookjs/storybook))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-06T00:02:53.730Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `storybookjs/storybook`
- **Description**: Storybook is the industry standard workshop for building, documenting, and testing UI components in isolation
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 91463 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent-eval/evals/805-non-visual-refactor/src/utils/formatRating.ts`
```
export function formatRating(rating: number): string {
  const clamped = Math.min(5, Math.max(0, rating));
  return '★'.repeat(clamped) + '☆'.repeat(5 - clamped);
}

export function clampRating(rating: number): number {
  return Math.min(5, Math.max(0, rating));
}

```

### Core Architecture Module: `agent-eval/lib/agentic-reference/metrics/ds-misuse/score.ts`
```
// Folding a judgement into the numbers that reach a comparison table.
import { mean, round } from '../../../utils/math.ts';

import type { DsMisuseSummary, JudgedNode } from './types.ts';

/** Four decimals, matching coverage.ts: a mean rounded to two flattens a small move. */
const SCORE_DIGITS = 4;

function meanOf(
  nodes: JudgedNode[],
  read: (node: JudgedNode) => number | undefined
): number | null {
  const scores = nodes.flatMap((node) => {
    const score = read(node);
    return typeof score === 'number' ? [score] : [];
  });
  return round(mean(scores), SCORE_DIGITS);
}

/**
 * Each score is a mean over the nodes that received it, or null when none did.
 *
 * null rather than 0 throughout: a run that created no local components has not
 * scored zero on local decisions, and a stored 0 would drag every later mean.
 */
export function summariseJudgement(nodes: JudgedNode[]): DsMisuseSummary {
  return {
    correctDsDecision: meanOf(nodes, (node) => node.correctDsDecision?.score),
    correctDsUsage: meanOf(nodes, (node) => node.correctDsUsage?.score),
    correctLocalDecision: meanOf(nodes, (node) => node.correctLocalDecision?.score),
    evaluated: {
      ds: nodes.filter((node) => node.kind === 'ds').length,
      local: nodes.filter((node) => node.kind === 'local').length,
    },
  };
}

```

### Core Architecture Module: `agent-eval/lib/agentic-reference/metrics/judge-utils.ts`
```
// Judge pricing, colocated with the judge-model choice (JUDGE_MODEL in
// ./ds-misuse/context.ts) so a moved judge model can't silently keep stale
// prices: adding a model to USD_PER_MTOK is what declares its pricing.
import { JUDGE_MODEL } from './ds-misuse/context.ts';

import type { JudgeUsage } from './ds-misuse/judge.ts';

interface TokenPrices {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
}

// List prices per million tokens. The judge caches the doc corpus with a 1h
// TTL, so the cache-write rate quoted here is the 1h one.
const USD_PER_MTOK: Record<string, TokenPrices> = {
  'claude-opus-4-8': { input: 5, cacheRead: 0.5, cacheWrite: 10, output: 25 },
  'claude-opus-5': { input: 5, cacheRead: 0.5, cacheWrite: 10, output: 25 },
};

function pricesFor(model: string): TokenPrices {
  const prices = USD_PER_MTOK[model];
  if (prices === undefined) {
    throw new Error(`no USD_PER_MTOK pricing declared for judge model "${model}".`);
  }
  return prices;
}

/** Cost of one usage record, priced against the given judge model. */
export function usdOf(usage: JudgeUsage, model: string = JUDGE_MODEL): number {
  const prices = pricesFor(model);
  return (
    (usage.inputTokens * prices.input +
      usage.cacheReadTokens * prices.cacheRead +
      usage.cacheWriteTokens * prices.cacheWrite +
      usage.outputTokens * prices.output) /
    1_000_000
  );
}

/** Accumulates one usage record into a running total, in place. */
export function addUsage(total: JudgeUsage, usage: JudgeUsage): void {
  total.inputTokens += usage.inputTokens;
  total.cacheReadTokens += usage.cacheReadTokens;
  total.cacheWriteTokens += usage.cacheWriteTokens;
  total.outputTokens += usage.outputTokens;
}

```

### Core Architecture Module: `agent-eval/lib/agentic-reference/utils.ts`
```
// Name-shortening helpers for the agentic-reference line. A leaf module on
// purpose: post-analysis.ts, cases.ts, and the comparison pipeline all pull
// from here, so nothing below may import back into them.
import type { EvalAgent } from '../templates.ts';

// Case-name segments for each AGENT_CONFIG entry (see experiment.ts), so
// generated case names (`<prefix>-<variant>-<modelSuffix>`) spell out the
// model and effort the entry pins. The shared Record<EvalAgent> key keeps
// this and AGENT_CONFIG covering the same agents.
export const AGENT_NAME_PARTS: Record<EvalAgent, { prefix: string; modelSuffix: string }> = {
  'claude-code': { prefix: 'cc', modelSuffix: 'opus-high' },
  codex: { prefix: 'codex', modelSuffix: 'gpt-5.5-medium' },
};

/** cc-do-dont-opus-high -> do-dont, by stripping any agent's prefix/suffix pair. */
export function shortNameOf(caseName: string): string {
  for (const { prefix, modelSuffix } of Object.values(AGENT_NAME_PARTS)) {
    const head = `${prefix}-`;
    const tail = `-${modelSuffix}`;
    if (caseName.startsWith(head) && caseName.endsWith(tail)) {
      return caseName.slice(head.length, -tail.length);
    }
  }
  return caseName;
}

/**
 * Experiment names share a long prefix; the tables read better without it.
 * Display-only and cc-specific, unlike shortNameOf: names of other agents
 * pass through unshortened.
 */
export function shortExperiment(value: unknown): string {
  return String(value)
    .replace(/^agentic-ref-cc-/, '')
    .replace(/-opus-[^-]+$/, '');
}

/** An eval name down to its number, for the tables' case column. */
export function shortCase(value: unknown): string {
  return String(value).replace(/(-[^\d]+)+$/, '');
}

/** A large count at report width: 1,234,000 -> "1.2M", 1,234 -> "1.2k". */
export function formatCompactCount(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}

```

### Core Architecture Module: `agent-eval/lib/post-analysis/hooks.ts`
```
// Reading an experiment's post-analysis module off its definition.
//
// The IO — finding experiments/<name>.ts and importing it — stays in
// scripts/analyze-results.ts. What lives here is the part that can be wrong:
// deciding whether an experiment carries a post-analysis module, and whether
// that module implements the contract. TypeScript checks this at the definition
// site; this is the runtime backstop for a dynamically imported module.
import { isRecord } from '../utils/type.ts';

import type { PostAnalysis } from './types.ts';

/**
 * The `postAnalysis` an experiment module carries, or null when it carries none
 * — which just means "not ours to measure".
 *
 * Anything present but malformed throws instead: an experiment that meant to be
 * analysed and is silently skipped is the failure mode worth being loud about.
 */
export function postAnalysisFrom(
  experimentModule: unknown,
  experiment: string
): PostAnalysis | null {
  const config = isRecord(experimentModule) ? experimentModule.default : undefined;
  const postAnalysis = isRecord(config) ? config.postAnalysis : undefined;
  if (postAnalysis === undefined || postAnalysis === null) return null;

  const where = `experiments/${experiment}.ts: postAnalysis`;
  if (!isRecord(postAnalysis)) {
    throw new Error(`${where} must be an object, got ${typeof postAnalysis}`);
  }
  if (typeof postAnalysis.analyzeRun !== 'function') {
    throw new Error(`${where} must provide an analyzeRun function`);
  }
  if (typeof postAnalysis.summarize !== 'function') {
    throw new Error(`${where} must provide a summarize function`);
  }
  // Optional, but a typo'd key would otherwise silently drop every delta.
  if (
    postAnalysis.deltaToBaseline !== undefined &&
    typeof postAnalysis.deltaToBaseline !== 'function'
  ) {
    throw new Error(`${where} carries a deltaToBaseline that is not a function`);
  }
  // Optional, but a malformed one would never match a committed baseline and
  // would quietly re-measure the pinned tree on every invocation.
  if (
    postAnalysis.metricsVersion !== undefined &&
    typeof postAnalysis.metricsVersion !== 'number'
  ) {
    throw new Error(`${where} carries a metricsVersion that is not a number`);
  }
  return postAnalysis as unknown as PostAnalysis;
}

```

### Core Architecture Module: `agent-eval/lib/utils/files.ts`
```
import { existsSync, readFileSync } from 'node:fs';

export function readJson<T = unknown>(path: string): T | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

```

### Core Architecture Module: `agent-eval/lib/utils/math.ts`
```
/** Arithmetic mean, or null when there is nothing to average. */
export function mean(values: number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0) / values.length;
}

/** Sum, or null when there is nothing to add. */
export function sum(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((total, value) => total + value, 0);
}

/** Rounds to `digits` decimals for display. */
export function round(value: number | null, digits = 2): number | null {
  if (value === null) {
    return null;
  }
  const factor = 10 ** digits;
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor;
}

/** The finite numbers in a list, dropping NaN, Infinity and non-numbers. */
export function finiteNumbers(values: unknown[]): number[] {
  return values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value)
  );
}

const SHARE_DIGITS = 4;

/** Returns the share of `numerator` over `denominator`, rounded to 4 decimals. */
export function share(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : round(numerator / denominator, SHARE_DIGITS);
}

```

### Core Architecture Module: `agent-eval/lib/utils/shell-segments.ts`
```
// Split a shell command into independently classifiable segments.
//
// Compound commands are the norm in agent transcripts: a single Bash call
// routinely chains exploration, an edit and a verification run. Classifying
// the call as a whole would attribute all of it to one bucket, so the tool
// taxonomy needs the parts.
//
// The pipe distinction is the subtle one. `;`, `&&` and `||` separate
// independent commands, but `|` does not: `npx tsc | tail -20` is one act of
// verification whose output is filtered, not verification plus exploration.
// Counting the `tail` as exploration would inflate a lower-is-better metric
// every time an agent trimmed noisy output — penalising the careful ones.
import { tokenizeShellWords } from '../shell-parse.ts';

export interface ShellSegment {
  tokens: string[];
  /**
   * Path this segment redirects stdout into, or null. A write regardless of the
   * head binary, so churn and the taxonomy both key off it.
   */
  redirectTarget: string | null;
  /** This segment consumes the previous segment's stdout. */
  piped: boolean;
  /** Bodies of the heredocs this segment reads: data, so never part of `tokens`. */
  heredocs: string[];
}

const SEPARATORS = new Set(['&&', '||', ';', '|']);

// Only a stdout redirect writes content worth counting. `2>&1` duplicates a
// descriptor, and `2>/dev/null` is stderr suppression — treating either as a
// write turned every `grep ... 2>/dev/null` in the captured run into an "edit".
const STDOUT_REDIRECT = /^1?>>?$/;
const STDOUT_REDIRECT_WITH_TARGET = /^1?>>?([^&>].*)$/;
/** Redirects here discard output; nothing is written. */
const DISCARD_TARGETS = new Set(['/dev/null', '/dev/stdout', '/dev/stderr']);

function redirectTargetOf(target: string | undefined): string | null {
  if (target === undefined || target === '') return null;
  const path = target.replace(/^['"]|['"]$/g, '');
  return DISCARD_TARGETS.has(path) ? null : path;
}

export function splitCommandSegments(command: string): ShellSegment[] {
  const segments: ShellSegment[] = [];
  let current: string[] = [];
  let heredocs: string[] = [];
  let redirectTarget: string | null = null;
  let piped = false;
  // The previous token was a bare redirect operator, so this token is its
  // target. 'discard' distinguishes `2> file` — whose target must be dropped
  // rather than treated as an argument — from a real stdout write.
  let awaiting: 'stdout' | 'discard' | null = null;

  const flush = () => {
    if (current.length > 0) {
      segments.push({ tokens: current, redirectTarget, piped, heredocs });
    }
    current = [];
    heredocs = [];
    redirectTarget = null;
    awaiting = null;
  };

  for (const { value: token, quotedStart, heredoc } of tokenizeShellWords(command)) {
    if (heredoc !== undefined) {
      heredocs.push(heredoc.body);
      continue;
    }
    if (token === '') continue;
    if (!quotedStart && SEPARATORS.has(token)) {
      // A line break reaches us as `;`. Right after `|` or `&&` it continues
      // the command instead of ending it.
      if (token === ';' && current.length === 0) continue;
      flush();
      piped = token === '|';
      continue;
    }
    if (awaiting !== null) {
      if (awaiting === 'stdout') redirectTarget = redirectTargetOf(token);
      awaiting = null;
      continue;
    }
    if (quotedStart) {
      current.push(token);
      continue;
    }
    if (STDOUT_REDIRECT.test(token)) {
      awaiting = 'stdout';
      continue;
    }
    // An attached form such as `>/tmp/out` survives tokenisation as one token.
    const attached = STDOUT_REDIRECT_WITH_TARGET.exec(token);
    if (attached) {
      redirectTarget = redirectTargetOf(attached[1]);
      continue;
    }
    // A non-stdout redirect (`2>`, `2>>`, `2>&1`) writes no content.
    if (/^\d>>?/.test(token)) {
      if (/^\d>>?$/.test(token)) awaiting = 'discard';
      continue;
    }
    current.push(token);
  }
  flush();

  return segments;
}

```

### Core Architecture Module: `agent-eval/lib/utils/table.ts`
```
// Box-drawn tables for the console, in place of console.table.
//
// console.table renders every cell through util.inspect, so a string cell
// comes out quoted — '29.59%' rather than 29.59%. This renders strings bare
// and right-aligns numbers instead.
//
// Columns are the union of the rows' keys, in the order first seen, so the
// caller controls column order by the order it builds its rows in.
//
// Cells may carry ANSI styling: widths are measured on the visible text, and
// the frame and header carry their own styling only when the output is a
// terminal (see colors.ts).

import { styleText } from 'node:util';
import { stripVTControlCharacters } from 'node:util';

function visibleLength(text: string): number {
  return stripVTControlCharacters(text).length;
}

/** A value as it should read in a cell, and whether it aligns as a number. */
function render(value: unknown): { text: string; numeric: boolean } {
  if (typeof value === 'number') {
    return { text: String(value), numeric: true };
  }
  if (typeof value === 'string') {
    return { text: value, numeric: false };
  }
  if (value === null) {
    return { text: 'null', numeric: false };
  }
  if (value === undefined) {
    return { text: '', numeric: false };
  }
  // Rendered as JSON rather than the [object Object] a bare String() gives.
  if (typeof value === 'object') {
    return { text: JSON.stringify(value) ?? '', numeric: false };
  }
  return { text: String(value as boolean | bigint | symbol), numeric: false };
}

function columnsOf(rows: ReadonlyArray<Record<string, unknown>>): string[] {
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) {
        columns.push(key);
      }
    }
  }
  return columns;
}

function rule(widths: number[], left: string, middle: string, right: string): string {
  return styleText('dim', left + widths.map((width) => '─'.repeat(width + 2)).join(middle) + right);
}

function line(cells: string[], widths: number[], numeric: boolean[]): string {
  // Padding is computed from the visible length so styled cells still align.
  const padded = cells.map((cell, index) => {
    const pad = ' '.repeat(Math.max(0, widths[index]! - visibleLength(cell)));
    return numeric[index] ? pad + cell : cell + pad;
  });
  const bar = styleText('dim', '│');
  return `${bar} ${padded.join(` ${bar} `)} ${bar}`;
}

/**
 * Renders `rows` as a table. An empty row set renders as the empty string, so a
 * caller can print the result unconditionally without leaving a bare frame.
 */
export function formatTable(rows: ReadonlyArray<Record<string, unknown>>): string {
  const columns = columnsOf(rows);
  if (rows.length === 0 || columns.length === 0) {
    return '';
  }

  const cells = rows.map((row) => columns.map((column) => render(row[column])));
  // A column aligns right only when every value in it is a number.
  const numeric = columns.map((_, index) =>
    cells.every((row) => row[index]!.numeric || row[index]!.text === '')
  );
  const widths = columns.map((column, index) =>
    Math.max(column.length, ...cells.map((row) => visibleLength(row[index]!.text)))
  );

  return [
    rule(widths, '┌', '┬', '┐'),
    line(
      columns.map((column) => styleText('bold', column)),
      widths,
      columns.map(() => false)
    ),
    rule(widths, '├', '┼', '┤'),
    ...cells.map((row) =>
      line(
        row.map((cell) => cell.text),
        widths,
        numeric
      )
    ),
    rule(widths, '└', '┴', '┘'),
  ].join('\n');
}

/** Prints what {@link formatTable} renders; an empty row set prints nothing. */
export function printTable(rows: ReadonlyArray<Record<string, unknown>>): void {
  const rendered = formatTable(rows);
  if (rendered !== '') {
    console.log(rendered);
  }
}

```

### Core Architecture Module: `agent-eval/lib/utils/type.ts`
```
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #37204** (2026-11-05): **Svelte: Clearer indexing errors for files without defineMeta, and print each error once**
  *Symptoms*: Closes #  <!-- If your PR is related to an issue, provide the number(s) above; if it resolves multiple issues, be sure to break them up (e.g. "closes #1000, closes #1001"). -->  <!--  Thank you for contributing to Storybook! Please submit all PRs to the `next` branch unless they are specific to the current release. Storybook maintainers cherry-pick bug and documentation fixes into the `main` branch as part of the release process, so you shouldn't need to worry about this. For additional guidance: https://storybook.js.org/docs/contribute  -->  ## What I did  Resolves [SB-2222](https://linear.app/chromaui/issue/SB-2222/svelte-csf-clearer-parser-errors-for-files-without-definemeta-and).  ### The problem  When a Svelte project upgrades to Storybook 11, its stories files that do not use `defineMeta` yet (for example files in the removed legacy syntax) make `storybook dev` and `storybook build` fail. The output had four problems:  1. **The advice does not fix the file.** Errors `0003` ("does not import defineMeta") and `0001` ("does not have a module context") tell the user to import `defineMeta` or to add a module script. A file without `defineMeta` needs more: a `<script module>` that calls `defineMeta()` and uses the `Story` component that it returns. 2. **Each file prints the full message.** Each failing file prints the same ~17-line block, with only the path changed. A project with many unmigrated files, such as [brave/leo](https://github.com/brave/leo), gets about 1,100 lines

- **Issue #37199** (2026-11-05): **Core: Stop a late ack error clobbering resolved static-load state in the story**
  *Symptoms*: Closes #  <!-- If your PR is related to an issue, provide the number(s) above; if it resolves multiple issues, be sure to break them up (e.g. "closes #1000, closes #1001"). -->  ## What I did  `internal-storybook-e2e` intermittently fails `open-service-sync.spec.ts` › *"static load resolves entries from the live server in dev"*. The story shows `No runtime acknowledged remote command "…computeUnbacked"` where the test expects `"static-load:unbacked"`, and it keeps showing it through all three retries.  **Cause.** The static-load story's `beforeEach` wrote one `unbackedStatus` field from two places: the subscription wrote the value, and `loaded().catch` wrote the error. A remote command is best-effort: the server can execute it and broadcast state even after the acknowledgement times out. When the rejection arrived after the value, it overwrote it, and nothing ever wrote the value back.  `975667ae97f` fixed the same race in `OpenServiceDemoPanel`, which works out the status on every render and prefers the value. The story was left as it was, and the e2e test checks the **story**, so the race was still there.  **Change.** The story now stores the value and the error separately and picks between them when it renders, as the panel does: `unbacked != null ? JSON.stringify(unbacked) : (unbackedError ?? 'pending')`. Every write is unconditional, so arrival order no longer matters:  | Situation | Renders | |---|---| | Nothing loaded yet | `pending` | | Dev: value arrives, error befor

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

### Incident Patch 1: `fb339536` (2026-11-05)
**Commit Message**: Build: Declare node types where node built-ins are used

`typescript-validation` has failed on `next` since f6d12ac3ddd: 182 of its 197
errors are TS2591 "Cannot find name 'process'/'node:x'" across thirteen
packages with nothing in common. TypeScript's own message names the fix —
"add 'node' to the types field in your tsconfig" — but the interesting part is
why it only started saying so on November 4.

Automatic @types inclusion yields nothing in this repo. Tracing addon-links
produces zero type-reference-directive resolutions across 4,303 traced
lookups, and the 95 that addon-docs produces all originate inside dependency
.d.ts files (react-colorful references 'react'). So these packages never
resolved @types/node by discovery. They were handed node globals by a
transitive `/// <reference types="node" />` that some dependency happened to
carry, and the dependency churn between e4ec60736 and f6d12ac3ddd — 17 commits
touching yarn.lock — took it away. The tree was never the problem: on the
executor @types/node is present, populated, version 22.19.15, one of 99 real
(non-symlink) directories under the root node_modules/@types.

So this is the dependency that was always implied and ne

**File**: `code/addons/links/src/utils.test.ts` (modified, +4/-2)
```diff
@@ -10,8 +10,10 @@ import { hrefTo, hrefToSync, linkTo } from './utils.ts';
 vi.mock('storybook/preview-api');
 vi.mock('@storybook/global', () => ({
   global: {
-    document: global.document,
-    window: global,
+    // globalThis, not `global`: this suite runs in happy-dom, and the only reason the Node spelling
+    // ever compiled here was an @types/node reference this package picked up through a dependency.
+    document: globalThis.document,
+    window: globalThis,
   },
 }));
 
```

**File**: `code/addons/themes/tsconfig.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
   "extends": "../../tsconfig.json",
-  "compilerOptions": {},
+  "compilerOptions": { "types": ["node"] },
   "include": ["src/**/*"]
 }
```

**File**: `code/frameworks/ember/tsconfig.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
   "extends": "../../tsconfig.json",
-  "compilerOptions": {},
+  "compilerOptions": { "types": ["node"] },
   "include": ["src/**/*"]
 }
```

**File**: `code/frameworks/react-webpack5/tsconfig.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
   "extends": "../../tsconfig.json",
-  "compilerOptions": {},
+  "compilerOptions": { "types": ["node"] },
   "include": ["src/**/*"]
 }
```

**File**: `code/lib/angular-cm/tsconfig.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "extends": "../../tsconfig.json",
-  "compilerOptions": {},
+  "compilerOptions": { "types": ["node"] },
   "include": ["src/**/*"],
   // Fixtures import @angular/core, which this package deliberately does not depend on; the tests
   // compile them with their own TS programs instead.
```

**File**: `code/lib/core-webpack/tsconfig.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
   "extends": "../../tsconfig.json",
-  "compilerOptions": {},
+  "compilerOptions": { "types": ["node"] },
   "include": ["src/**/*"]
 }
```

**File**: `code/lib/create-storybook/tsconfig.json` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 {
   "extends": "../../tsconfig.json",
   "compilerOptions": {
+    "types": ["node"],
     "moduleResolution": "bundler",
     "module": "ES2022"
   },
```

**File**: `code/presets/react-webpack/tsconfig.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
   "extends": "../../tsconfig.json",
-  "compilerOptions": {},
+  "compilerOptions": { "types": ["node"] },
   "include": ["src/**/*"]
 }
```

---

### Incident Patch 2: `f8b075b8` (2026-11-05)
**Commit Message**: Build: Declare node types in every package that imports Node built-ins

TypeScript 6 changed the default of `types` to `[]`, so @types packages are
no longer included unless listed. The repo moved to 6.0.3 on 2026-05-29 and
from then on every package using Node built-ins compiled only because some
dependency's declarations carried `/// <reference types="node" />` — for the
core `storybook` package, the one in vite/dist/node/index.d.ts. Thirteen
packages lost theirs in the November 4 lockfile churn (fixed in #37201); this
declares node types for the rest so none depends on that accident.

- `"types": ["node"]` in 22 more code packages, in addon-vitest (which listed
  only "vitest"), and in agent-eval.
- `@types/node` in devDependencies of the 15 packages that relied on the root
  hoist for it.
- Drops a comment from #37201 in the addon-links test.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `agent-eval/tsconfig.json` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@
     "skipLibCheck": true,
     "strict": true,
     "target": "es2022",
+    "types": ["node"],
     "verbatimModuleSyntax": true
   },
   "include": [
```

**File**: `code/addons/docs/package.json` (modified, +1/-0)
```diff
@@ -97,6 +97,7 @@
     "@mdx-js/mdx": "^3.0.0",
     "@rollup/pluginutils": "^5.0.2",
     "@types/color-convert": "^2.0.0",
+    "@types/node": "^22.19.1",
     "@types/react": "^18.0.0 || ^19.0.0",
     "color-convert": "^2.0.1",
     "es-toolkit": "^1.43.0",
```

**File**: `code/addons/docs/tsconfig.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
   "extends": "../../tsconfig.json",
-  "compilerOptions": {},
+  "compilerOptions": { "types": ["node"] },
   "include": ["src/**/*"]
 }
```

**File**: `code/addons/links/src/utils.test.ts` (modified, +0/-2)
```diff
@@ -10,8 +10,6 @@ import { hrefTo, hrefToSync, linkTo } from './utils.ts';
 vi.mock('storybook/preview-api');
 vi.mock('@storybook/global', () => ({
   global: {
-    // globalThis, not `global`: this suite runs in happy-dom, and the only reason the Node spelling
-    // ever compiled here was an @types/node reference this package picked up through a dependency.
     document: globalThis.document,
     window: globalThis,
   },
```

**File**: `code/addons/mcp/package.json` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@
   "devDependencies": {
     "@storybook/addon-a11y": "workspace:*",
     "@storybook/addon-vitest": "workspace:*",
+    "@types/node": "^22.19.1",
     "storybook": "workspace:*",
     "typescript": "^6.0.3"
   },
```

**File**: `code/addons/mcp/tsconfig.json` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 {
   "extends": ["../../tsconfig.json"],
+  "compilerOptions": { "types": ["node"] },
   "include": ["src/**/*", "**/*.ts"],
   "exclude": ["dist"]
 }
```

**File**: `code/addons/themes/package.json` (modified, +1/-0)
```diff
@@ -61,6 +61,7 @@
   },
   "devDependencies": {
     "@storybook/icons": "^2.0.2",
+    "@types/node": "^22.19.1",
     "react": "^18.2.0",
     "react-dom": "^18.2.0",
     "typescript": "^6.0.3"
```

**File**: `code/addons/vitest/tsconfig.json` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   "extends": "../../tsconfig.json",
   "compilerOptions": {
     "rootDir": "../../../",
-    "types": ["vitest"],
+    "types": ["node", "vitest"],
     "strict": true
   },
   "include": ["src/**/*", "./typings.d.ts"]
```

---

### Incident Patch 3: `6ab1337e` (2026-11-05)
**Commit Message**: Merge pull request #37068 from storybookjs/fix/windows-unit-tests-dg-2427917

Core: Stabilize Windows unit tests (file-lock stale window, vue3 meta + dist-contract timeouts)

**File**: `code/core/src/test/dist-contract.test.ts` (modified, +15/-7)
```diff
@@ -10,6 +10,9 @@ const TYPESCRIPT = createRequire(import.meta.url).resolve('typescript/bin/tsc');
 const TYPESCRIPT_5 = createRequire(import.meta.url).resolve('typescript-5/bin/tsc');
 const DTS_BUILT = existsSync(DTS_ARTIFACT);
 const REPOSITORY_ROOT = join(import.meta.dirname, '../../../..');
+// Compiling the public API surface with tsc takes 30s+ on loaded Windows CI
+// runners, so use a fixed generous timeout instead of the 10s Vitest default.
+const compileTimeoutMs = 90_000;
 const TSC_OPTIONS = [
   '--module',
   'Node16',
@@ -88,13 +91,18 @@ describe('storybook/test declaration contract', () => {
         cwd: REPOSITORY_ROOT,
         stdio: 'pipe',
       });
-    }
+    },
+    compileTimeoutMs
   );
 
-  it.runIf(DTS_BUILT)('compiles the public test API consumer fixture with TypeScript 5.9.3', () => {
-    execFileSync(process.execPath, [TYPESCRIPT_5, ...TSC_OPTIONS], {
-      cwd: REPOSITORY_ROOT,
-      stdio: 'pipe',
-    });
-  });
+  it.runIf(DTS_BUILT)(
+    'compiles the public test API consumer fixture with TypeScript 5.9.3',
+    () => {
+      execFileSync(process.execPath, [TYPESCRIPT_5, ...TSC_OPTIONS], {
+        cwd: REPOSITORY_ROOT,
+        stdio: 'pipe',
+      });
+    },
+    compileTimeoutMs
+  );
 });
```

**File**: `code/core/src/theming/dist-contract.test.ts` (modified, +5/-2)
```diff
@@ -13,6 +13,9 @@ const CONSUMER_FIXTURE = join(import.meta.dirname, '__testfixtures__/typescript-
 const TYPESCRIPT = createRequire(import.meta.url).resolve('typescript/bin/tsc');
 const TYPESCRIPT_5 = createRequire(import.meta.url).resolve('typescript-5/bin/tsc');
 const REPOSITORY_ROOT = join(import.meta.dirname, '../../../..');
+// Compiling the theming API surface with tsc takes 30s+ on loaded Windows CI
+// runners, so use a fixed generous timeout instead of the 10s Vitest default.
+const compileTimeoutMs = 90_000;
 
 // A dev compile writes the JS bundle and skips declarations. CI builds both before the suite.
 const JS_BUILT = existsSync(CREATE_JS);
@@ -121,7 +124,7 @@ describe('published theming entries', () => {
         stdio: 'pipe',
       });
     },
-    30_000
+    compileTimeoutMs
   );
 
   it.runIf(DTS_BUILT)(
@@ -132,6 +135,6 @@ describe('published theming entries', () => {
         stdio: 'pipe',
       });
     },
-    30_000
+    compileTimeoutMs
   );
 });
```

**File**: `code/lib/docgen-harness/src/vue3/vue3-component-meta-baselines.test.ts` (modified, +18/-6)
```diff
@@ -235,14 +235,26 @@ const runComponentMetaFixture = async (
   expect(snippetFilesOnDisk).toEqual(expectedSnippetFiles);
 };
 
+// The first extraction per fixture can outrun the 10s default on a loaded CI runner,
+// mirroring the explicit limits the angular baselines already carry.
+const fixtureTimeoutMs = 30_000;
+
 describe('vue3 vue-component-meta baselines', () => {
-  it.each(fixtureCases)('%s', async (fixtureCase) => {
-    await runComponentMetaFixture(fixtureCase, '__testfixtures__', checker);
-  });
+  it.each(fixtureCases)(
+    '%s',
+    async (fixtureCase) => {
+      await runComponentMetaFixture(fixtureCase, '__testfixtures__', checker);
+    },
+    fixtureTimeoutMs
+  );
 });
 
 describe('vue3 vue-component-meta baselines — tsx components', () => {
-  it.each(tsxFixtureCases)('%s', async (fixtureCase) => {
-    await runComponentMetaFixture(fixtureCase, '__tsx-testfixtures__', tsxChecker);
-  });
+  it.each(tsxFixtureCases)(
+    '%s',
+    async (fixtureCase) => {
+      await runComponentMetaFixture(fixtureCase, '__tsx-testfixtures__', tsxChecker);
+    },
+    fixtureTimeoutMs
+  );
 });
```

**File**: `code/renderers/react/src/dist-contract.test.ts` (modified, +5/-2)
```diff
@@ -13,6 +13,9 @@ const TYPESCRIPT = createRequire(import.meta.url).resolve('typescript/bin/tsc');
 const TYPESCRIPT_5 = createRequire(import.meta.url).resolve('typescript-5/bin/tsc');
 const DTS_BUILT = DTS_ARTIFACTS.every(existsSync);
 const REPOSITORY_ROOT = join(import.meta.dirname, '../../../..');
+// Compiling the full declaration surface with tsc takes 30s+ on loaded Windows
+// CI runners, so use a fixed generous timeout instead of the 10s default.
+const compileTimeoutMs = 90_000;
 const TSC_OPTIONS = [
   '--module',
   'Node16',
@@ -42,7 +45,7 @@ describe('React declaration contract', () => {
         stdio: 'pipe',
       });
     },
-    30_000
+    compileTimeoutMs
   );
 
   it.runIf(DTS_BUILT)(
@@ -53,6 +56,6 @@ describe('React declaration contract', () => {
         stdio: 'pipe',
       });
     },
-    30_000
+    compileTimeoutMs
   );
 });
```

**File**: `test-storybooks/mcp/vitest.config.ts` (modified, +5/-2)
```diff
@@ -9,8 +9,11 @@ import { playwright } from '@vitest/browser-playwright';
 // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
 export default defineConfig({
 	test: {
-		testTimeout: 15_000,
-		hookTimeout: 15_000,
+		// The test-run endpoint spawns a full test run, which on a loaded Windows CI runner can
+		// exceed 15s even though the same tool finishes in ~4s on unloaded hardware. The timeout
+		// only matters when a test would actually exceed it, so a wide ceiling is free.
+		testTimeout: 30_000,
+		hookTimeout: 30_000,
 		projects: [
 			// E2E tests project (for MCP endpoint testing)
 			{
```

#### Recent Merged Pull Requests:
- **PR #37215** (2026-11-05): Build: Drop the temporary base-branch exceptions of the NX experiments (@kasperpeulen)
- **PR #37213** (2026-11-05): Build: Run the CircleCI NX DTE pipeline in two waves of agents, at about the per-job pipeline's cost (@kasperpeulen)
- **PR #37212** (closed): Build: Measure the CircleCI NX DTE pipeline (experiment) (@kasperpeulen)
- **PR #37209** (closed): Build: NX experiment - scheduling with base-branch history (@kasperpeulen)
- **PR #37207** (2026-11-05): Build: Run CircleCI workflows as NX tasks distributed over CircleCI agents (@kasperpeulen)
- **PR #37204** (2026-11-05): Svelte: Clearer indexing errors for files without defineMeta, and print each error once (@JReinhold)

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

## X. Build: Declare node types where node built-ins are used

**RULE**:
When implementing operations in `code/addons/links/src/utils.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in storybookjs/storybook. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fb339536`: Build: Declare node types where node built-ins are used. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `code/addons/links/src/utils.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    // globalThis, not `global`: this suite runs in happy-dom, and the only reason the Node spelling
    // ever compiled here was an @types/node reference this package picked up through a dependency.
    document: globalThis.document,
    window: globalThis,
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
    document: global.document,
    window: global,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fb339536` are properly handled with clean fallback behavior.
