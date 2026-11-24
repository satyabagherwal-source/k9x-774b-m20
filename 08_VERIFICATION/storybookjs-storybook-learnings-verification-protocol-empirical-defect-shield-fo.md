# Verification Protocol: Verification Protocol: Empirical Defect Shield for storybookjs-storybook-learnings

<!-- PROVENANCE_START
{
  "source_repository": "storybookjs-storybook-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T05:28:32.318Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-storybookjs-storybook-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [storybookjs-storybook-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T05:28:32.318Z`  
> **Learning ID**: `LEARN-EVO-storybookjs-storybook-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `storybookjs-storybook-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/storybookjs-storybook-learnings.md`  
> **Source**: github ([https://github.com/storybookjs/storybook](https://github.com/storybookjs/storybook))  
> **Source Version**: `e5411198`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T05:28:18.310Z  
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
> **Harvest Timestamp**: 2026-11-24T05:28:18.304Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `storybookjs/storybook`
- **Description**: Storybook is the industry standard workshop for building, documenting, and testing UI components in isolation
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 91696 stars

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
- **Issue #37667** (2026-11-23): **Core: Register manifest routes before the preview builder starts**
  *Symptoms*: An alternative attempt to #37509.  Closes #37471  <!-- If your PR is related to an issue, provide the number(s) above; if it resolves multiple issues, be sure to break them up (e.g. "closes #1000, closes #1001"). -->  <!--  Thank you for contributing to Storybook! Please submit all PRs to the `next` branch unless they are specific to the current release. Storybook maintainers cherry-pick bug and documentation fixes into the `main` branch as part of the release process, so you shouldn't need to worry about this. For additional guidance: https://storybook.js.org/docs/contribute  -->  ## What I did  In `storybook dev`, the dev server registered the `/manifests/*` routes after the preview builder had started. A builder can add a catch-all middleware, and that middleware then answers these requests before Storybook does. SvelteKit's Vite plugin adds one, its dev SSR handler. So on SvelteKit, all manifest routes returned 500 with an error from SvelteKit's render.  The dev server now registers the manifest routes before the builders start, right after the `experimental_devServer` preset. That is the same place where `addon-mcp` registers `/mcp`, which is why `/mcp` already worked on SvelteKit.  ```diff  storybookDevServer    registerIndexJsonRoute    user middleware    presets.apply('experimental_devServer')   # addon-mcp: /mcp +  registerManifests                          # /manifests/*    managerBuilder.start    previewBuilder.start                       # Vite middleware, incl. S

- **Issue #37660** (2026-11-23): **Core: Make hover/neighbor preloading follow navigation logic**
  *Symptoms*: ## What I did  Follow-up to #37234, which improved preloading for search results.  Before #37234, the first child of a component would be preloaded, even if navigating to the component would select a different child. For instance, with a Button that has a subcomponent ButtonContent, the first child would match the first story of ButtonContent instead of the first story of Button itself.  * Now that we have a utility to ensure preloading follows the same logic as navigation, this PR applies it to story preloading when hovering a component in the sidebar * It also removes preloading on group/root entries because these are too in the tree for us to infer user intent * Finally, it ensures the proper first child of a neighbour is selected when switching to the next component with Alt+Down/Up   ## Checklist for Contributors  ### Testing  <!-- Please check (put an "x" inside the "[ ]") the applicable items below to communicate how to test your changes -->  #### The changes in this PR are covered in the following automated tests:  - [x] stories - [x] unit tests - [ ] integration tests - [ ] end-to-end tests  #### Manual testing   1. Run the internal Storybook with `yarn storybook:ui` and open it in the browser with the DevTools Network tab open. A preload shows up as a request for the stories or MDX file of the preloaded entry. 2. Hover a component row whose stories have not been loaded yet. Its stories file is requested. 3. Hover a root heading and a group row. Nothing is requested.

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

### Incident Patch 1: `b1e15cd3` (2026-11-23)
**Commit Message**: Merge pull request #37667 from storybookjs/jeppe/manifest-routes-before-builder

Core: Register manifest routes before the preview builder starts

**File**: `code/core/src/core-server/dev-server.ts` (modified, +6/-3)
```diff
@@ -94,6 +94,12 @@ export async function storybookDevServer(
   // Apply experimental_devServer preset to allow addons/frameworks to extend the dev server with middlewares, etc.
   await options.presets.apply('experimental_devServer', app);
 
+  // Register before the preview builder starts, so that a catch-all middleware the builder adds,
+  // such as SvelteKit's dev SSR handler, cannot answer these requests first.
+  if (features?.componentsManifest) {
+    registerManifests({ app, presets: options.presets });
+  }
+
   if (!core?.builder) {
     throw new MissingBuilderError();
   }
@@ -193,9 +199,6 @@ export async function storybookDevServer(
     throw e;
   }
 
-  if (features?.componentsManifest) {
-    registerManifests({ app, presets: options.presets });
-  }
   // Now the preview has successfully started, we can count this as a 'dev' event.
   doTelemetry(app, core, storyIndexGeneratorPromise, options);
 
```

---

### Incident Patch 2: `6a525886` (2026-11-23)
**Commit Message**: Merge pull request #37680 from storybookjs/valentin/fix-upgrade-skills-test-windows

CLI: Stub process ancestry in upgrade skills tests

**File**: `code/lib/cli-storybook/src/upgrade.skills.test.ts` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@ vi.mock(import('storybook/internal/common'), async (importOriginal) => {
   return {
     ...actual,
     isCI: vi.fn(),
+    getProcessAncestry: () => [],
     JsPackageManagerFactory: Object.assign(actual.JsPackageManagerFactory, {
       getPackageManager: () => ({
         type: 'npm',
```

---

### Incident Patch 3: `993d30e8` (2026-11-23)
**Commit Message**: Merge pull request #37652 from storybookjs/julien/fix-windows-path-issues

Windows: Fix backslash path issues

**File**: `code/builders/builder-vite/src/vite-config.ts` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ function reportUnloadedUserViteConfig(configDir: string, projectRoot: string): v
 
   warnOnce(
     dedent`
-      No user Vite config was loaded: Storybook auto-discovers a Vite config file in "${projectRoot}" (the directory above your Storybook config dir "${configDir}"), and none was found there.
+      No user Vite config was loaded: Storybook auto-discovers a Vite config file in "${normalize(projectRoot)}" (the directory above your Storybook config dir "${normalize(configDir)}"), and none was found there.
       A Vite config was found at "${unloadedConfig}", but it is outside of that directory and was not loaded.
       To load it, point the "viteConfigPath" builder option at it, e.g. core: { builder: { options: { viteConfigPath: '${unloadedConfig}' } } }.
       To keep it unloaded and silence this warning, set "viteConfigPath" to null, e.g. core: { builder: { options: { viteConfigPath: null } } }.
```

**File**: `code/core/src/core-server/utils/StoryIndexGenerator.ts` (modified, +2/-2)
```diff
@@ -206,15 +206,15 @@ export class StoryIndexGenerator {
     if (files.length === 0 && !ignoreWarnings) {
       once.warn(
         `No story files found for the specified pattern: ${picocolors.blue(
-          join(specifier.directory, specifier.files)
+          slash(join(specifier.directory, specifier.files))
         )}`
       );
     }
 
     files.sort().forEach((absolutePath: Path) => {
       const ext = extname(absolutePath);
       if (ext === '.storyshot') {
-        const relativePath = relative(workingDir, absolutePath);
+        const relativePath = slash(relative(workingDir, absolutePath));
         logger.info(`Skipping ${ext} file ${relativePath}`);
         return;
       }
```

**File**: `code/core/src/core-server/utils/copy-all-static-files.ts` (modified, +2/-1)
```diff
@@ -1,8 +1,9 @@
 import { cp } from 'node:fs/promises';
-import { join, relative, resolve } from 'node:path';
+import { join, resolve } from 'node:path';
 
 import { logger } from 'storybook/internal/node-logger';
 
+import { relative } from 'pathe';
 import picocolors from 'picocolors';
 
 import { mapStaticDir } from './server-statics.ts';
```

**File**: `code/lib/cli-storybook/src/add.test.ts` (modified, +1/-1)
```diff
@@ -205,7 +205,7 @@ describe('add (extra)', () => {
     });
 
     expect(logger.log).toHaveBeenCalledWith(
-      `Adding '@storybook/addon-docs' to the "addons" field in ${join('packages', 'ui', '.storybook', 'main.ts')}`
+      `Adding '@storybook/addon-docs' to the "addons" field in packages/ui/.storybook/main.ts`
     );
   });
 });
```

**File**: `code/lib/cli-storybook/src/add.ts` (modified, +1/-2)
```diff
@@ -1,10 +1,9 @@
-import { relative } from 'node:path';
-
 import { type PackageManagerName, setupAddonInConfig, versions } from 'storybook/internal/common';
 import { readConfig } from 'storybook/internal/csf-tools';
 import { logger as nodeLogger, prompt } from 'storybook/internal/node-logger';
 import type { StorybookConfigRaw } from 'storybook/internal/types';
 
+import { relative } from 'pathe';
 import SemVer from 'semver';
 import { dedent } from 'ts-dedent';
 
```

**File**: `code/lib/cli-storybook/src/automigrate/fixes/addon-svelte-csf-to-core.test.ts` (modified, +2/-1)
```diff
@@ -1,12 +1,13 @@
 import { readFile, writeFile } from 'node:fs/promises';
-import { relative, resolve } from 'node:path';
+import { resolve } from 'node:path';
 
 import { beforeEach, describe, expect, it, vi } from 'vitest';
 
 import { type JsPackageManager, getProjectRoot, removeAddon } from 'storybook/internal/common';
 import type { StorybookConfigRaw } from 'storybook/internal/types';
 
 import { fs, vol } from 'memfs';
+import { relative } from 'pathe';
 import { dedent } from 'ts-dedent';
 
 import { createFixFiles } from '../fix-files.ts';
```

**File**: `code/lib/cli-storybook/src/automigrate/fixes/addon-svelte-csf-to-core.ts` (modified, +2/-1)
```diff
@@ -1,4 +1,4 @@
-import { relative, resolve } from 'node:path';
+import { resolve } from 'node:path';
 
 import { getProjectRoot, normalizeAddonName, removeAddon } from 'storybook/internal/common';
 import {
@@ -9,6 +9,7 @@ import {
 } from 'storybook/internal/csf-tools';
 import type { StorybookConfigRaw } from 'storybook/internal/types';
 
+import { relative } from 'pathe';
 import picocolors from 'picocolors';
 import { dedent } from 'ts-dedent';
 
```

**File**: `code/lib/cli-storybook/src/automigrate/helpers/failure-report.test.ts` (modified, +18/-0)
```diff
@@ -232,4 +232,22 @@ describe('file failures', () => {
       "| `src/B.stories.ts` | EACCES: permission denied, open 'src/B.stories.ts' |"
     );
   });
+
+  it('logs the report path with forward slashes on Windows', async () => {
+    // Simulates `relative` from a Windows cwd nested above the project root.
+    vi.mocked(relative).mockImplementation((from, to) =>
+      win32.relative(win32.join('C:\\work', from), win32.join('C:\\work', to))
+    );
+    vi.spyOn(process, 'cwd').mockReturnValue('/');
+
+    await reportFileFailures(
+      [{ fixId: 'rename-legacy', file: stories[1], kind: 'story', message: 'failed' }],
+      ['rename-legacy']
+    );
+
+    expect(logger.warn).toHaveBeenCalledWith(
+      expect.stringContaining(`project/${REPORT_FILE_NAME}`)
+    );
+    expect(vi.mocked(logger.warn).mock.lastCall?.[0]).not.toContain('\\');
+  });
 });
```

#### Recent Merged Pull Requests:
- **PR #37680** (2026-11-23): CLI: Stub process ancestry in upgrade skills tests (@valentinpalkovic)
- **PR #37667** (2026-11-23): Core: Register manifest routes before the preview builder starts (@JReinhold)
- **PR #37660** (2026-11-23): Core: Make hover/neighbor preloading follow navigation logic (@Sidnioulz)
- **PR #37657** (2026-11-23): Release: Prerelease 11.0.0-beta.5 (@github-actions[bot])
- **PR #37656** (2026-11-23): Build: Push release branches with a storybook-bot app token (@JReinhold)
- **PR #37652** (2026-11-23): Windows: Fix backslash path issues (@huang-julien)

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

## X. Empirical Invariant Guard in dev-server.ts

**RULE**:
When implementing operations in `code/core/src/core-server/dev-server.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in storybookjs/storybook. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b1e15cd3`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `code/core/src/core-server/dev-server.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  // Register before the preview builder starts, so that a catch-all middleware the builder adds,
  // such as SvelteKit's dev SSR handler, cannot answer these requests first.
  if (features?.componentsManifest) {
    registerManifests({ app, presets: options.presets });
  }

```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
  if (features?.componentsManifest) {
    registerManifests({ app, presets: options.presets });
  }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b1e15cd3` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
