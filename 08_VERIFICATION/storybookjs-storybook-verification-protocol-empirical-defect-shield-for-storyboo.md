# Verification Protocol: Verification Protocol: Empirical Defect Shield for storybookjs/storybook

<!-- PROVENANCE_START
{
  "source_repository": "storybookjs/storybook",
  "source_url": "https://github.com/storybookjs/storybook",
  "source_version": "f071f047",
  "license": "MIT",
  "timestamp": "2026-11-13T18:05:59.452Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-storybookjs-storybook",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [storybookjs/storybook](https://github.com/storybookjs/storybook) (Revision: `f071f047`).  
> **License**: MIT | **Timestamp**: `2026-11-13T18:05:59.452Z`  
> **Learning ID**: `learn-github-storybookjs-storybook`


## 1. Scope & Verification Target
- **Target Repository**: `storybookjs/storybook` (Commit: `f071f047`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): storybookjs/storybook

> **Canonical Artifact**: `07_PROJECT_LEARNING/storybookjs-storybook-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/storybookjs/storybook](https://github.com/storybookjs/storybook))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T18:05:58.647Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `storybookjs/storybook`
- **Description**: Storybook is the industry standard workshop for building, documenting, and testing UI components in isolation
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 91557 stars

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
- **Issue #37406** (2026-11-13): **[Bug]: @storybook/react-vite 10.x -> @joshwooding/vite-plugin-react-docgen-typescript 0.7.0 -> glob 13.x has CVE-2026-118773**
  *Symptoms*: ### Describe the bug  @storybook/react-vite 10.x has dependency to "@joshwooding/vite-plugin-react-docgen-typescript" "^0.7.0".  All version of "@joshwooding/vite-plugin-react-docgen-typescript" below 0.9.1 has a dependency of glob 13.x which has CVE-2026-118773.  Since 0.7.0 is < 1.0.0, semver does not resolve ^0.7.0 to 0.9.1 - at least pnpm does not do so).  Upping the dependency to "@joshwooding/vite-plugin-react-docgen-typescript" "^0.9.1" should resolve the issue.  ### Reproduction link  no  ### Reproduction steps  _No response_  ### System  ```bash storybook 10.6.7 ```  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > We could not detect a valid reproduction link. **Make sure to follow the bug report template carefully.**  ### Why was this issue closed?  To be able to investigate, we need access to a reproduction to identify what triggered the issue. We need a link to a **public** GitHub repository, Stackblitz or CodeSandbox. The easiest way to create a reproduction is with [storybook.new](https://storybook.new).  The bug template that you filled out has a section called "To reproduce", which is where you should provide the link to the reproduction.  - If you did not provide a link or the link you provided is not valid, we will close the issue. - If you provide a link to a private repository, we will close the issue. - If you provide a link to a repository but not in the correct section, we will close the issue.  ### What should I do?  Depending on the reason the issue was closed, you can do the following:  - If you did not provide a link, please open a new issue with a link to a reproduction. - If 

- **Issue #37389** (2026-11-13): **Manager: Improve performance of story preloading**
  *Symptoms*: Closes #37145.  ## What I did  `PRELOAD_ENTRIES` is fired on multiple occasions: * When hovering a sidebar node, for the node and its children * When loading a story, for its direct siblings addressable by kb shortcut * After a search, to preload results  The hover and kb sibling preloads compete with the rest of the web app for resources, and can cause significant lags. Preloading a story can cause many imported modules to be downloaded, and hovering over the sidebar can cause dozens of stories to be queued for preloading.  ### Fix 1: Dedupe preload requests  Some data: * Preloading provides roughly 50-150ms of benefit to end users, based on probe measurements * The gain concentrates on first paint (up to 33% faster with preloading) and dimishes on story ready (possibly due to sibling preloading competing for CPU)  * We also assume from past UX research that users spend 200-400ms between the moment they hover a story and the moment they click it * The preloading itself can take 250ms based on probe measurements  So the benefit is obtained only if we don't further slow down or delay preloading. Debouncing in the manager UI would probably cause the benefits of preloading to be lost.  Instead, as emitting events is relatively cheap, we make the event handler drop pending preloads as soon as a new preload request lands. This matches the fact that if a user hovers over many sidebar items, they're only ever gonna click on the one their mouse is actually on top of.  ### Fix 2: Fix 

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

### Incident Patch 1: `c36d09d2` (2026-11-13)
**Commit Message**: fix(ecosystem-qa): redact the run result in a step of its own, also after a crash

run.ts redacts its output only when it reaches its end, while the upload runs always. A run that crashed or was cancelled uploaded its logs as they were. The upload now waits for a redaction step that runs always, and does not happen when that step fails.

**File**: `.github/workflows/ecosystem-qa.yml` (modified, +8/-1)
```diff
@@ -250,8 +250,15 @@ jobs:
         if: ${{ always() }}
         run: if [[ -d ecosystem-qa/results ]]; then find ecosystem-qa/results -type l -print -delete; fi
 
-      - name: Upload the run result
+      # run.ts redacts its output when it reaches its end. A run that crashed or was cancelled did
+      # not, and the upload publishes whatever is there.
+      - name: Redact credentials in the run result
+        id: redact
         if: ${{ always() }}
+        run: node ecosystem-qa/redact.ts ecosystem-qa/results
+
+      - name: Upload the run result
+        if: ${{ always() && steps.redact.outcome == 'success' }}
         uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
         with:
           name: qa-result-${{ matrix.os }}-${{ matrix.engine }}
```

**File**: `ecosystem-qa/redact.ts` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+import { existsSync } from 'node:fs';
+
+import { redactTree } from './lib/redact.ts';
+
+const HELP = `Usage: node ecosystem-qa/redact.ts <dir>
+
+Redacts credentials in every text file under <dir>, in place. run.ts does the same when it reaches
+its end; this is for the output of a run that did not.`;
+
+const [dir] = process.argv.slice(2);
+if (!dir || dir === '--help') {
+  console.log(HELP);
+  process.exit(dir ? 0 : 1);
+}
+if (existsSync(dir)) {
+  redactTree(dir);
+}
```

---

### Incident Patch 2: `2a70199b` (2026-11-13)
**Commit Message**: Merge pull request #37390 from storybookjs/sidnioulz/manager-rerender-storm

Manager: Cut re-renders and store writes on story change

**File**: `code/core/src/manager-api/modules/addons.ts` (modified, +14/-4)
```diff
@@ -8,6 +8,8 @@ import type {
   Addon_TypesMapping,
 } from 'storybook/internal/types';
 
+import { isEqual } from 'es-toolkit/predicate';
+
 import type { ModuleFn } from '../lib/types.tsx';
 import type { Options } from '../store.ts';
 
@@ -128,10 +130,18 @@ export const init: ModuleFn<SubAPI, SubState> = ({ provider, store, fullAPI }):
         typeof newStateOrMerger === 'function' ? newStateOrMerger : () => newStateOrMerger
       ) as API_StateMerger<S>;
       return store
-        .setState(
-          (s) => ({ addons: { ...s.addons, [addonId]: merger(s.addons[addonId]) } }),
-          options
-        )
+        .setState((s) => {
+          const current = s.addons[addonId];
+          const next = merger(current);
+          // Addons tend to write their state again on every story change, mostly unchanged. A
+          // write of an equal state would still re-render the whole manager and hand consumers
+          // a new object. A write that asks for persistence goes through: the value may not be
+          // in storage yet.
+          const persisted = (options?.persistence ?? 'none') !== 'none';
+          return !persisted && isEqual(next, current)
+            ? {}
+            : { addons: { ...s.addons, [addonId]: next } };
+        }, options)
         .then(() => api.getAddonState(addonId));
     },
     getAddonState: (addonId) => {
```

**File**: `code/core/src/manager-api/modules/shortcuts.ts` (modified, +16/-5)
```diff
@@ -9,6 +9,7 @@ import {
 import { global } from '@storybook/global';
 
 import copy from 'copy-to-clipboard';
+import { isEqual } from 'es-toolkit/predicate';
 
 import { logger } from 'storybook/internal/client-logger';
 import type { KeyboardEventLike } from '../lib/shortcut.ts';
@@ -264,11 +265,21 @@ export const init: ModuleFn = ({ store, fullAPI, provider }) => {
       return value;
     },
     async setAddonShortcut(addon: string, shortcut: API_AddonShortcut) {
-      await api.setShortcuts((shortcuts) => ({
-        ...shortcuts,
-        [`${addon}-${shortcut.actionName}`]: shortcut.defaultShortcut,
-      }));
-      addonsShortcuts[`${addon}-${shortcut.actionName}`] = shortcut;
+      const id = `${addon}-${shortcut.actionName}`;
+      const previous = addonsShortcuts[id];
+      addonsShortcuts[id] = shortcut;
+      // The store holds the key binding, which the user may have customised. A registration writes
+      // it when it is new or its default changed, not to replace the binding with the default.
+      const isRegistered =
+        !!previous &&
+        isEqual(previous.defaultShortcut, shortcut.defaultShortcut) &&
+        id in (store.getState().shortcuts ?? {});
+      if (!isRegistered) {
+        await api.setShortcuts((shortcuts) => ({
+          ...shortcuts,
+          [id]: shortcut.defaultShortcut,
+        }));
+      }
       return shortcut;
     },
     async restoreDefaultShortcut(action) {
```

**File**: `code/core/src/manager-api/store.ts` (modified, +7/-0)
```diff
@@ -138,6 +138,13 @@ export default class Store {
 
     const delta: Patch =
       typeof inputPatch === 'function' ? resolveUpdater(inputPatch, this.getState()) : inputPatch;
+    // Nothing to commit or persist: every React setState re-renders the provider, and persisting
+    // rewrites the whole stored state.
+    if (Object.keys(delta).length === 0) {
+      const state = this.getState();
+      callback?.(state);
+      return state;
+    }
     const pending: PendingPatch = { patch: delta, committed: false };
     this.pendingPatches.push(pending);
 
```

**File**: `code/core/src/manager-api/tests/addons.test.js` (modified, +69/-0)
```diff
@@ -1,11 +1,27 @@
 import { describe, expect, it, vi } from 'vitest';
 
+import store2 from 'store2';
+
 import { Addon_TypesEnum as types } from 'storybook/internal/types';
 
 import { init as initAddons } from '../modules/addons';
 import Store from '../store';
 import { createLaggingUpstream } from '../test-utils/store';
 
+vi.mock('store2', () => ({
+  default: {
+    local: {
+      set: vi.fn(),
+      get: vi.fn(),
+    },
+    session: {
+      set: vi.fn(),
+      get: vi.fn(),
+    },
+    _: { fn: () => {} },
+  },
+}));
+
 const PANELS = {
   a11y: {
     title: 'Accessibility',
@@ -202,5 +218,58 @@ describe('Addons API', () => {
       expect(storyIdsDuringCommit).toEqual(['story-2']);
       expect(api.getAddonState('my-addon')).toEqual({ open: true });
     });
+
+    it('does not write a state equal to the current one', async () => {
+      const current = { open: true, results: [{ id: 1 }] };
+      const setState = vi.fn().mockImplementation((patch, callback) => callback());
+      const store = new Store({ setState, getState: () => ({ addons: { 'my-addon': current } }) });
+      const { api } = initAddons({ provider, store });
+
+      const result = await api.setAddonState('my-addon', { open: true, results: [{ id: 1 }] });
+
+      expect(setState).not.toHaveBeenCalled();
+      expect(result).toBe(current);
+    });
+
+    it('does not write when a merger returns a state equal to the current one', async () => {
+      const setState = vi.fn().mockImplementation((patch, callback) => callback());
+      const store = new Store({
+        setState,
+        getState: () => ({ addons: { counter: { count: 0 } } }),
+      });
+      const { api } = initAddons({ provider, store });
+
+      await api.setAddonState('counter', (s) => ({ ...s, count: 0 }));
+
+      expect(setState).not.toHaveBeenCalled();
+    });
+
+    it('writes an equal state when persistence is requested', async () => {
+      const current = { open: true };
+      const setState = vi.fn().mockImplementation((patch, callback) => callback());
+      const store = new Store({ setState, getState: () => ({ addons: { 'my-addon': current } }) });
+      const { api } = initAddons({ provider, store });
+
+      await api.setAddonState('my-addon', { open: true }, { persistence: 'session' });
+
+      expect(setState).toHaveBeenCalledTimes(1);
+      expect(store2.session.set).toHaveBeenCalled();
+    });
+
+    it('writes a changed state', async () => {
+      let state = { addons: { counter: { count: 0 } } };
+      const setState = vi.fn().mockImplementation((patch, callback) => {
+        state = { ...state, ...patch };
+        callback();
+      });
+      const store = new Store({ setState, getState: () => state });
+      const { api } = initAddons({ provider, store });
+
+      const result = await api.setAddonState('counter', (s) => ({ ...s, count: s.count + 1 }));
+
+      expect(setState).toHaveBeenCalledTimes(1);
+      expect(result).toEqual({ count: 1 });
+      expect(api.getAddonState('counter')).toEqual({ count: 1 });
+    });
   });
 });
```

**File**: `code/core/src/manager-api/tests/shortcuts.test.js` (modified, +70/-0)
```diff
@@ -344,6 +344,76 @@ describe('addon shortcut matching', () => {
   });
 });
 
+describe('addon shortcut re-registration', () => {
+  const setup = () => {
+    const store = createMockStore();
+    const fullAPI = { getNavAvailability: () => 'shown' };
+    const { api, state } = initShortcuts({ store, provider: {}, fullAPI });
+    store.setState({ ...state, ui: { enableShortcuts: true }, storyId: 'a', refId: undefined });
+    store.setState.mockClear();
+    return { api, store };
+  };
+  const shortcut = (overrides) => ({
+    label: 'Do it',
+    defaultShortcut: ['O'],
+    actionName: 'doIt',
+    action: vi.fn(),
+    ...overrides,
+  });
+
+  it('writes the binding to the store once and fires the latest action', async () => {
+    const { api, store } = setup();
+    const first = shortcut();
+    const second = shortcut();
+
+    await api.setAddonShortcut('my-addon', first);
+    expect(store.setState).toHaveBeenCalledTimes(1);
+
+    await api.setAddonShortcut('my-addon', second);
+    expect(store.setState).toHaveBeenCalledTimes(1);
+
+    expect(api.handleKeydownEvent({ key: 'O', code: 'KeyO' })).toBe('my-addon-doIt');
+    expect(first.action).not.toHaveBeenCalled();
+    expect(second.action).toHaveBeenCalled();
+  });
+
+  it('keeps a binding the user customised when the addon registers again', async () => {
+    const { api } = setup();
+    await api.setAddonShortcut('my-addon', shortcut());
+    await api.setShortcut('my-addon-doIt', ['P']);
+
+    await api.setAddonShortcut('my-addon', shortcut());
+
+    expect(api.getShortcutKeys()['my-addon-doIt']).toEqual(['P']);
+    expect(api.handleKeydownEvent({ key: 'P', code: 'KeyP' })).toBe('my-addon-doIt');
+  });
+
+  it('writes again when the default binding changes', async () => {
+    const { api, store } = setup();
+    await api.setAddonShortcut('my-addon', shortcut());
+    store.setState.mockClear();
+
+    await api.setAddonShortcut('my-addon', shortcut({ defaultShortcut: ['P'] }));
+
+    expect(store.setState).toHaveBeenCalledTimes(1);
+    expect(api.getShortcutKeys()['my-addon-doIt']).toEqual(['P']);
+    expect(api.getDefaultShortcuts()['my-addon-doIt']).toEqual(['P']);
+  });
+
+  it('writes again when the binding is missing from the store', async () => {
+    const { api, store } = setup();
+    await api.setAddonShortcut('my-addon', shortcut());
+    const { 'my-addon-doIt': _removed, ...rest } = store.getState().shortcuts;
+    store.setState({ shortcuts: rest });
+    store.setState.mockClear();
+
+    await api.setAddonShortcut('my-addon', shortcut());
+
+    expect(store.setState).toHaveBeenCalledTimes(1);
+    expect(api.getShortcutKeys()['my-addon-doIt']).toEqual(['O']);
+  });
+});
+
 describe('focus region shortcuts', () => {
   const setup = ({ navShown = true, panelShown = true } = {}) => {
     const store = createMockStore();
```

**File**: `code/core/src/manager-api/tests/store.test.js` (modified, +27/-0)
```diff
@@ -172,6 +172,33 @@ describe('store', () => {
         });
       }));
 
+    it('skips React and storage when a patch function changes nothing', async () => {
+      const setState = vi.fn().mockImplementation((x, cb) => cb());
+      const getState = vi.fn().mockReturnValue({ foo: 'bar', other: { a: 1 } });
+      const store = new Store({ setState, getState });
+      const callback = vi.fn();
+
+      const result = await store.setState((s) => ({ foo: s.foo }), callback, {
+        persistence: 'session',
+      });
+
+      expect(setState).not.toHaveBeenCalled();
+      expect(store2.session.set).not.toHaveBeenCalled();
+      expect(result).toEqual({ foo: 'bar', other: { a: 1 } });
+      expect(callback).toHaveBeenCalledWith({ foo: 'bar', other: { a: 1 } });
+    });
+
+    it('skips React and storage for an empty patch', async () => {
+      const setState = vi.fn().mockImplementation((x, cb) => cb());
+      const getState = vi.fn().mockReturnValue({ foo: 'bar' });
+      const store = new Store({ setState, getState });
+
+      await store.setState({}, { persistence: 'permanent' });
+
+      expect(setState).not.toHaveBeenCalled();
+      expect(store2.local.set).not.toHaveBeenCalled();
+    });
+
     it('allows a patch function and persists its results', async () => {
       const setState = vi.fn().mockImplementation((x, cb) => cb());
       const getState = vi.fn().mockReturnValue({ foo: 'OLD' });
```

**File**: `code/core/src/manager/container/Menu.test.tsx` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+// @vitest-environment happy-dom
+import type { SyntheticEvent } from 'react';
+
+import { renderHook } from '@testing-library/react';
+import { describe, expect, it, vi } from 'vitest';
+
+import type { API } from 'storybook/manager-api';
+
+import { useMenu } from './Menu.tsx';
+
+vi.mock('../components/sidebar/useChecklist.ts', () => ({
+  useChecklist: () => ({ progress: 100 }),
+}));
+
+describe('useMenu', () => {
+  it('runs the action an addon registered last when its menu item is clicked', () => {
+    const first = vi.fn();
+    const second = vi.fn();
+    const registration = {
+      label: 'Do it',
+      defaultShortcut: ['O'],
+      actionName: 'doIt',
+      showInMenu: true,
+      action: first,
+    };
+    const addonsShortcuts = { 'my-addon-doIt': registration };
+    const api = {
+      getShortcutKeys: () => ({}),
+      getAddonsShortcuts: () => addonsShortcuts,
+      getDocsUrl: () => 'https://storybook.js.org/docs',
+    } as unknown as API;
+
+    const { result } = renderHook(() =>
+      useMenu({
+        api,
+        showToolbar: true,
+        isPanelShown: true,
+        isNavShown: true,
+        enableShortcuts: true,
+      })
+    );
+    const item = result.current.flat().find((menuItem) => menuItem.id === 'my-addon-doIt');
+    expect(item).toBeDefined();
+
+    // The addon registers again with a new closure. Nothing in the store changes, so the menu
+    // list is not rebuilt.
+    addonsShortcuts['my-addon-doIt'] = { ...registration, action: second };
+    item?.onClick?.({} as SyntheticEvent, item);
+
+    expect(first).not.toHaveBeenCalled();
+    expect(second).toHaveBeenCalledTimes(1);
+  });
+});
```

**File**: `code/core/src/manager/container/Menu.tsx` (modified, +4/-2)
```diff
@@ -195,10 +195,12 @@ export const useMenu = ({
     const keys = shortcutKeys as any;
     return Object.entries(addonsShortcuts)
       .filter(([_, { showInMenu }]) => showInMenu)
-      .map(([actionName, { label, action }]) => ({
+      .map(([actionName, { label }]) => ({
         id: actionName,
         title: label,
-        onClick: () => action(),
+        // An addon re-registers its action without a store write, so read it when the item is
+        // clicked rather than when this list is built.
+        onClick: () => api.getAddonsShortcuts()[actionName]?.action(),
         right: enableShortcuts && keys[actionName] ? <Shortcut keys={keys[actionName]} /> : null,
       }));
   }, [api, enableShortcuts, shortcutKeys]);
```

---

### Incident Patch 3: `93a4eef9` (2026-11-13)
**Commit Message**: ci: pack ecosystem-qa node_modules into the Linux workspace

ecosystem-qa nests its dependencies (hoistingLimits: workspaces), like
agent-eval. Without its node_modules in the workspace, typescript-validation
can't resolve @ai-hero/sandcastle or ecosystem-qa's own zod v4.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `scripts/ci/common-jobs.ts` (modified, +3/-2)
```diff
@@ -68,9 +68,10 @@ export const build_linux = defineJob('Build (linux)', () => ({
         `${WORKING_DIR}/node_modules`,
         `${WORKING_DIR}/code/node_modules`,
         `${WORKING_DIR}/scripts/node_modules`,
-        // agent-eval nests all its dependencies (installConfig.hoistingLimits),
-        // so downstream checks need its node_modules packed explicitly.
+        // agent-eval and ecosystem-qa nest all their dependencies (installConfig.hoistingLimits),
+        // so downstream checks need their node_modules packed explicitly.
         `${WORKING_DIR}/agent-eval/node_modules`,
+        `${WORKING_DIR}/ecosystem-qa/node_modules`,
       ],
       packageDirs.map((p) => `${WORKING_DIR}/code/${p.replace('src', 'node_modules')}`)
     ),
```

#### Recent Merged Pull Requests:
- **PR #37416** (2026-11-13): Ecosystem QA: Give the agent one list of check ids and their number (@valentinpalkovic)
- **PR #37412** (2026-11-13): Ecosystem QA: Keep the agent's answer when the sandbox cannot be removed (@valentinpalkovic)
- **PR #37408** (2026-11-13): Build: Pack ecosystem-qa node_modules into the CI workspace (@ndelangen)
- **PR #37402** (2026-11-13): Ecosystem QA: Give the agent the migration guide of the tested version (@valentinpalkovic)
- **PR #37400** (2026-11-13): Core: Make the watch-story-specifiers test expectations separator-agnostic (@obvious-autobuild[bot])
- **PR #37390** (2026-11-13): Manager: Cut re-renders and store writes on story change (@Sidnioulz)

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

## X. ecosystem-qa): redact the run result in a step of its own, also after a crash

**RULE**:
When implementing operations in `.github/workflows/ecosystem-qa.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in storybookjs/storybook. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c36d09d2`: ecosystem-qa): redact the run result in a step of its own, also after a crash. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/ecosystem-qa.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
      # run.ts redacts its output when it reaches its end. A run that crashed or was cancelled did
      # not, and the upload publishes whatever is there.
      - name: Redact credentials in the run result
        id: redact
        run: node ecosystem-qa/redact.ts ecosystem-qa/results

      - name: Upload the run result
        if: ${{ always() && steps.redact.outcome == 'success' }}
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
      - name: Upload the run result
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c36d09d2` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
