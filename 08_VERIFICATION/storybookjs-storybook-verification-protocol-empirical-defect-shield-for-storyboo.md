# Verification Protocol: Verification Protocol: Empirical Defect Shield for storybookjs/storybook

<!-- PROVENANCE_START
{
  "source_repository": "storybookjs/storybook",
  "source_url": "https://github.com/storybookjs/storybook",
  "source_version": "5aea8b6a",
  "license": "MIT",
  "timestamp": "2026-11-17T07:20:10.175Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-storybookjs-storybook",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [storybookjs/storybook](https://github.com/storybookjs/storybook) (Revision: `5aea8b6a`).  
> **License**: MIT | **Timestamp**: `2026-11-17T07:20:10.175Z`  
> **Learning ID**: `learn-github-storybookjs-storybook`


## 1. Scope & Verification Target
- **Target Repository**: `storybookjs/storybook` (Commit: `5aea8b6a`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): storybookjs/storybook

> **Canonical Artifact**: `07_PROJECT_LEARNING/storybookjs-storybook-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/storybookjs/storybook](https://github.com/storybookjs/storybook))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T07:20:09.182Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `storybookjs/storybook`
- **Description**: Storybook is the industry standard workshop for building, documenting, and testing UI components in isolation
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 91599 stars

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
- **Issue #37454** (2026-11-16): **Addon A11y: Update vision simulators to be more rigorous**
  *Symptoms*: Closes #36154  Supersedes #36232  ## What I did  I built on top of @Thodorr's implementation to conclude the work to do on vision simulators. Changes include:  * Replaced the default trinatopia algorithm with Brettel et al 1997 which is more accurate for this deficiency (Machado et al themselves state their algorithm is not accurate) * Kept the inaccurate Machado et al algorithm but declared it inaccurate in the UI * Added a contrast deficiency simulator to match Google Chrome * Reworked Select UI labels to include paper sources when available * Added a migration stop for users who have superseded globals  <img width="306" height="603" alt="image" src="https://github.com/user-attachments/assets/bbd818dc-bd2c-42a7-a9c8-af90d06d6e85" />   ## Checklist for Contributors  ### Testing  <!-- Please check (put an "x" inside the "[ ]") the applicable items below to communicate how to test your changes -->  #### The changes in this PR are covered in the following automated tests:  - [ ] stories - [ ] unit tests - [ ] integration tests - [ ] end-to-end tests  #### Manual testing  See https://github.com/storybookjs/storybook/pull/36232  ### Documentation  <!-- Please check (put an "x" inside the "[ ]") the applicable items below to indicate which documentation has been updated. -->  - [ ] Add or update documentation reflecting your changes - [x] If you are deprecating/removing a feature, make sure to update       [MIGRATION.MD](https://github.com/storybookjs/storybook/blob/next/MIGRATION

- **Issue #37449** (2026-11-16): **[Bug]: Storybook Docs Missing Component & Prop Documentation (`docgenServer` + TypeScript 7)**
  *Symptoms*: ### Describe the bug  ## Summary  In `@vicacha-travels/storefront`, components with complete JSDoc comments and TypeScript prop types (such as [`AccountInfo`](file:///Users/sjoseluis/Projects/experiments/products/tourism/vicacha-travels-develop/apps/storefront/src/modules/account/components/account-info/index.tsx)) appeared in Storybook Docs without their component description, without prop descriptions, and without optional props in the ArgsTable.  ## Observed Behavior  On `/?path=/docs/storefront-account-accountinfo--docs`: - The component-level JSDoc description on [`AccountInfo`](file:///Users/sjoseluis/Projects/experiments/products/tourism/vicacha-travels-develop/apps/storefront/src/modules/account/components/account-info/index.tsx#L27-L30) was not rendered. - The ArgsTable only listed the 4 props explicitly supplied in [`AccountInfo.stories.tsx`](file:///Users/sjoseluis/Projects/experiments/products/tourism/vicacha-travels-develop/apps/storefront/src/modules/account/components/account-info/AccountInfo.stories.tsx#L24-L33) (`label`, `currentInfo`, `clearState`, `children`). - The **Description** column showed `-` for every listed prop. - Optional props defined on [`AccountInfoProps`](file:///Users/sjoseluis/Projects/experiments/products/tourism/vicacha-travels-develop/apps/storefront/src/modules/account/components/account-info/index.tsx#L8-L25) (`isSuccess`, `isError`, `errorMessage`, `data-testid`) were omitted from the table.  ## Root Cause  1. In `@storybook/react-vit

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

### Incident Patch 1: `b7a138cf` (2026-11-16)
**Commit Message**: fix(react): document the declaring file, and fail on a missing export

The engines read the file and export core follows the import to, so a member a parts module renames is documented, not the first docgen in the barrel. A missing export becomes an error. Core resolves with React's own extension order, `.js` first, so a `ui.js` next to `ui.tsx` gives one file. The local-object mapping no longer compares export names, which now name the declaring file.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `code/renderers/react/src/componentManifest/getComponentImports.ts` (modified, +10/-5)
```diff
@@ -47,11 +47,9 @@ export interface TypescriptOptions extends TypescriptOptionsBase {
 
 export type { ComponentRef } from './types.ts';
 
-// The file that declares a component, and the export it declares it under.
-export interface DocgenTarget {
-  path: string;
-  exportName: string;
-}
+// The file that declares a component and the export it declares it under, or why the module the
+// story reads it from has no such export.
+export type DocgenTarget = { path: string; exportName: string } | { missing: string };
 
 /** Selected component for a story file; `storyPath` is the absolute path on disk. */
 export type StoryRef = {
@@ -195,6 +193,13 @@ export const getComponents = async ({
         // Core's resolver decides which file and export the engines document, as in every other
         // renderer. The ref keeps the story file's own import, which the import lines need.
         const target = docgenTargets?.get(c);
+        // An export core found missing is an error, not a reason to document another component.
+        if (target && 'missing' in target) {
+          const error = { name: 'Component export not found', message: target.missing };
+          return docgenEngine === 'react-docgen'
+            ? { ...componentWithPackage, path, reactDocgen: { type: 'error' as const, error } }
+            : { ...componentWithPackage, path, reactDocgenTypescriptError: error };
+        }
         const docgenRef = target
           ? {
               ...componentWithPackage,
```

**File**: `code/renderers/react/src/componentManifest/resolveComponents.ts` (modified, +31/-7)
```diff
@@ -1,6 +1,8 @@
 import {
   createMetaComponentResolver,
+  createModuleResolver,
   extractDeclaredSubcomponents,
+  supportedExtensions,
 } from 'storybook/internal/common';
 import { storyNameFromExport } from 'storybook/internal/csf/csf-utils';
 import {
@@ -29,8 +31,24 @@ import { cachedReadTextFileSync } from './utils.ts';
 
 export type ParsedCsf = ReturnType<ReturnType<typeof loadCsf>['parse']>;
 
-// One instance per process: the resolver caches its module resolutions.
-const resolveMetaComponent = createMetaComponentResolver();
+// One instance per process: the resolver caches its module resolutions. It tries extensions in the
+// order React's own lookup does, `.js` first as Vite does, so when `ui.js` sits next to `ui.tsx`
+// both pick the same file.
+const resolveMetaComponent = createMetaComponentResolver({
+  reader: {
+    resolver: createModuleResolver({
+      extensions: [...supportedExtensions],
+      extensionAlias: {
+        '.js': ['.js', '.ts', '.tsx'],
+        '.jsx': ['.jsx', '.tsx'],
+        '.mjs': ['.mjs', '.mts'],
+        '.cjs': ['.cjs', '.cts'],
+      },
+      mainFields: ['module', 'main'],
+      tsconfig: 'auto',
+    }),
+  },
+});
 
 /** A declared subcomponent paired with the component ref it resolved to (if any). */
 export interface ResolvedSubcomponent {
@@ -138,14 +156,20 @@ export async function resolveStoryFileComponents(options: {
   const resolveName = (name: string, node?: ESTreeNode) => {
     const resolved = resolveMetaComponent(csf, storyPath, node);
     if ('reason' in resolved) {
+      if (resolved.reason === 'missing-export') {
+        docgenTargets.set(name, {
+          missing: `"${resolved.importId}" has no export "${resolved.exportName}", which ${resolved.expression} reads.`,
+        });
+      }
       return name;
     }
     const { localName, importId, importer, path, exportName } = resolved.component;
-    const own = storyImports.get(localName);
-    const ownName =
-      importer === storyPath && own?.importId === importId && own?.importName === exportName
-        ? localName
-        : name;
+    // Core landed on a binding the story file imports itself, through an object the file declares.
+    const throughLocalObject =
+      importer === storyPath &&
+      storyImports.get(localName)?.importId === importId &&
+      !storyImports.has(name.split('.')[0]);
+    const ownName = throughLocalObject ? localName : name;
     if (importId && path) {
       docgenTargets.set(ownName, { path, exportName });
     }
```

---

### Incident Patch 2: `5e0ee43b` (2026-11-16)
**Commit Message**: fix(vue3): report a missing export

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `code/renderers/vue3/src/docgen/component-docgen/build-docgen.ts` (modified, +4/-0)
```diff
@@ -75,6 +75,10 @@ const UNRESOLVED_COMPONENT_MESSAGES: Record<
     name: 'No component import found',
     message: `No component file found for the component declared in ${subject}. Import it into the story file.`,
   }),
+  'missing-export': (subject) => ({
+    name: 'No component found',
+    message: `${subject} names an export that its module does not have. Check the name against the module's exports, and any barrel that re-exports it.`,
+  }),
   'unreadable-component-expression': (subject) => ({
     name: 'No component found',
     message: `We could not follow ${subject} to a component. Storybook follows an imported name, a namespace-import property access, or a chain of property accesses and spreads through modules it can resolve.`,
```

**File**: `code/renderers/vue3/src/docgen/component-docgen/resolve-component/resolve-component.ts` (modified, +2/-1)
```diff
@@ -17,7 +17,8 @@ export interface ResolvedVueComponent {
 export type UnresolvedComponentReason =
   | 'no-meta-component'
   | 'no-component-import'
-  | 'unreadable-component-expression';
+  | 'unreadable-component-expression'
+  | 'missing-export';
 
 const resolveComponent = createMetaComponentResolver({ extensions: ['.vue'] });
 
```

---

### Incident Patch 3: `0452ab57` (2026-11-16)
**Commit Message**: fix(core): write component paths with pathe, and keep a path on another drive

Across Windows drives `relative` gives an absolute path, which `join` glued onto the story folder.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `code/core/src/common/utils/component-path-from-story.ts` (modified, +8/-3)
```diff
@@ -1,20 +1,25 @@
 import { realpathSync } from 'node:fs';
-import { dirname, isAbsolute, join, relative } from 'node:path';
+
+import { dirname, isAbsolute, join, relative } from 'pathe';
 
 /**
  * The path of a component's file, written like the story file's index `importPath` it was reached
  * from.
  *
  * Module resolvers follow symlinks, so the component path is taken relative to the story file's
  * real folder and joined to the folder the index wrote. A symlinked story folder, as in linked
- * sandboxes, then gives the same path as a plain one.
+ * sandboxes, then gives the same path as a plain one. A component on another drive has no relative
+ * path, so its absolute path is returned.
  */
 export function componentPathFromStory(
   storyImportPath: string,
   storyFilePath: string,
   componentPath: string
 ): string {
   const fromStory = relative(dirname(realpathSync(storyFilePath)), componentPath);
-  const path = join(dirname(storyImportPath), fromStory).replaceAll('\\', '/');
+  if (isAbsolute(fromStory)) {
+    return fromStory;
+  }
+  const path = join(dirname(storyImportPath), fromStory);
   return isAbsolute(path) || path.startsWith('../') ? path : `./${path}`;
 }
```

#### Recent Merged Pull Requests:
- **PR #37454** (2026-11-16): Addon A11y: Update vision simulators to be more rigorous (@Sidnioulz)
- **PR #37451** (2026-11-16): Build: Inject CJS require shim only where node outputs use it (@ndelangen)
- **PR #37445** (2026-11-16): Docs: Clear the inline story error once it renders again (@shivastuu)
- **PR #37443** (2026-11-16): CLI: Report the real configuration error when doctor cannot read a project (@aleksaToljic)
- **PR #37442** (2026-11-16): Next.js: Fix TypeScript 6 peer conflict (@Kakadus)
- **PR #37432** (closed): Core: Enable addon-vitest when its Vitest plugin is configured for the Storybook (@kasperpeulen)

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

## X. react): document the declaring file, and fail on a missing export

**RULE**:
When implementing operations in `code/renderers/react/src/componentManifest/getComponentImports.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in storybookjs/storybook. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b7a138cf`: react): document the declaring file, and fail on a missing export. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `code/renderers/react/src/componentManifest/getComponentImports.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
// The file that declares a component and the export it declares it under, or why the module the
// story reads it from has no such export.
export type DocgenTarget = { path: string; exportName: string } | { missing: string };
        // An export core found missing is an error, not a reason to document another component.
        if (target && 'missing' in target) {
          const error = { name: 'Component export not found', message: target.missing };
          return docgenEngine === 'react-docgen'
            ? { ...componentWithPackage, path, reactDocgen: { type: 'error' as const, error } }
            : { ...componentWithPackage, path, reactDocgenTypescriptError: error };
        }
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// The file that declares a component, and the export it declares it under.
export interface DocgenTarget {
  path: string;
  exportName: string;
}
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b7a138cf` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
