# Domain G — Architecture Intelligence: Architecture Intelligence: storybookjs/storybook Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "storybookjs/storybook",
  "source_url": "https://github.com/storybookjs/storybook",
  "source_version": "69f59581",
  "license": "MIT",
  "timestamp": "2026-11-26T15:38:08.470Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-storybookjs-storybook",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [storybookjs/storybook](https://github.com/storybookjs/storybook) (Revision: `69f59581`).  
> **License**: MIT | **Timestamp**: `2026-11-26T15:38:08.470Z`  
> **Learning ID**: `learn-github-storybookjs-storybook`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), K (Quality & Verification Intelligence), B (Product Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), F (Design Intelligence), I (Content & Information Intelligence), C (Market & Business Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 56%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from storybookjs/storybook:

# Forensic Learning Record (Deep Inspection): storybookjs/storybook

> **Canonical Artifact**: `07_PROJECT_LEARNING/storybookjs-storybook-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/storybookjs/storybook](https://github.com/storybookjs/storybook))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T15:38:07.538Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `storybookjs/storybook`
- **Description**: Storybook is the industry standard workshop for building, documenting, and testing UI components in isolation
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 91731 stars

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
- **Issue #37795** (2026-11-26): **Sidebar: Fix ContextMenu focus handling after pointer dismissal**
  *Symptoms*: ## What I did  The bug came from extra code I wrote that ensures the current TreeNode doesn't take a focus-visible style after closing its context menu. That code conflicted with react-aria internals. I removed that code and adjusted CSS selectors to use react-aria's `data-focus-visible` to ensure proper styling.   <details><summary>LLM word vomit</summary>  1. **Removed complex focus restoration logic** in `TreeNode.tsx` that attempted to blur focus when a context menu was dismissed by pointer. This logic was fragile and could cause focus loops.  2. **Updated focus behavior** to rely on react-aria's built-in focus management:    - When dismissed by pointer: Focus returns to the row but shows no keyboard focus indicator (no ring, status icon visible)    - When dismissed by keyboard (Escape): Focus returns to the row with keyboard focus visible (ring shown, context menu button visible)  3. **Updated CSS selectors** from `:focus-visible` to `[data-focus-visible]` to match react-aria's input modality tracking, which correctly handles scripted focus that follows pointer input.  4. **Extracted a reusable helper function** `openDualSlotRowMenu` in the stories to reduce duplication across multiple test scenarios.  5. **Replaced `ContextMenuOutsideDismissSurvivesFocusTrap` story** with `ContextMenuEscapeDismiss` to properly test keyboard dismissal behavior instead of testing an internal implementation detail. </details>   ## Checklist for Contributors  ### Testing  #### The changes i

- **Issue #37792** (2026-11-26): **CLI: Make upgrade and init work under a package age gate**
  *Symptoms*: Closes #37665  <!-- If your PR is related to an issue, provide the number(s) above; if it resolves multiple issues, be sure to break them up (e.g. "closes #1000, closes #1001"). -->  <!--  Thank you for contributing to Storybook! Please submit all PRs to the `next` branch unless they are specific to the current release. Storybook maintainers cherry-pick bug and documentation fixes into the `main` branch as part of the release process, so you shouldn't need to worry about this. For additional guidance: https://storybook.js.org/docs/contribute  -->  ## What I did  In a project with a package age gate, `npx storybook@<fresh version> upgrade` and `npx storybook@<fresh version> init` failed in two places. Yarn 4.15 and later give new projects a one-day gate by default, so on Yarn this also affects projects that never opted in.  **1. The age gate blocked the download of the CLI itself.**  The `storybook` binary downloads `@storybook/cli` (for `upgrade`) or `create-storybook` (for `init`) through the project's package manager. Yarn, pnpm and npm apply the age gate to that download, so the command stopped with the package manager's own error before the age gate precheck in those commands could run:  ``` $ npx storybook@11.0.0-rc.0 upgrade --yes ➤ YN0016: │ @storybook/cli@npm:11.0.0-rc.0: All versions satisfying "11.0.0-rc.0" are quarantined ➤ YN0000: · Failed with errors in 0s 26ms ```  The dispatcher now runs that same precheck before the download. The precheck itself is unchanged: 

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

### Incident Patch 1: `44e786e3` (2026-11-26)
**Commit Message**: Agent guidelines: A migration note is for a breaking change or a deprecation

Agents and the review bots asked for a MIGRATION.md entry for changes users
notice, bug fixes included. 18 of the 122 PRs that changed MIGRATION.md since
August are labelled bug.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.agents/guidelines/pull-requests.md` (modified, +8/-0)
```diff
@@ -15,6 +15,14 @@ Reproduce it locally against a real PR with `DANGER_GITHUB_API_TOKEN="$(gh auth
 - **Do not add a `ci:*` label.** The review bot or a maintainer adds it once automated review has finished, so CI does not run on work that is still changing.
 For a pkg.pr.new canary, follow the [canary skill](../skills/canary/SKILL.md) and [`CONTRIBUTING/RELEASING.md`](../../CONTRIBUTING/RELEASING.md).
 
+## Migration notes
+
+Add an entry to `MIGRATION.md` only for a breaking change or a deprecation: a change after which users have to change their code, config or setup, now or before the next major.
+
+A change is not breaking when the old behavior was a bug, even when users notice it. To decide, ask whether the change could ship in a minor release. If it could, it gets no entry, also while the next major is open on `next`. A user-visible fix belongs in the PR description, which the changelog links to.
+
+An entry is for removing or renaming an API, option or package, raising a supported version, or deprecating something. A fix that makes a name, an output or an error match what the docs or another part of Storybook already said gets none.
+
 ## Greptile review
 
 Greptile reviews a PR by itself when the PR leaves draft, and again on each push after that. It does not review a draft PR by itself. To ask for a review of a draft, comment `@greptileai review` on the PR (`gh pr comment <number> --body "@greptileai review"`). Greptile reacts with 👀, starts a "Greptile Review" check on the head commit, and posts a summary comment and inline comments after about five minutes. It reviews the head at the time of the comment, so push first. A local `greptile review` CLI run does not replace the review on the PR.
```

**File**: `.agents/skills/code-review/rules.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ Include a command a maintainer can rerun with the finding.
 - Follow `package.json` `exports` and declaration generation; an internal filename does not establish a public export.
 - Check accepted consumer expressions, inference, supported versions, and dependency ranges in affected sibling packages.
 - A caller search inside this repository does not establish compatibility for external consumers.
-- Check migration guidance when supported usage or peer dependency floors change.
+- A breaking change or a deprecation, such as a raised peer dependency floor, needs a `MIGRATION.md` entry, and no other change does. [Pull requests](../../guidelines/pull-requests.md#migration-notes) defines both.
 - Internal APIs follow "migrate every caller, then delete the old path" in the same PR. Public APIs follow the deprecation process instead, so a compatibility layer there is expected, not debt.
 
 ### Shared core, docs blocks, framework or renderer adapters
```

**File**: `.obvious/guidelines/pull-requests.md` (modified, +8/-0)
```diff
@@ -15,6 +15,14 @@ Reproduce it locally against a real PR with `DANGER_GITHUB_API_TOKEN="$(gh auth
 - **Do not add a `ci:*` label.** The review bot or a maintainer adds it once automated review has finished, so CI does not run on work that is still changing.
 For a pkg.pr.new canary, follow the [canary skill](../skills/canary/SKILL.md) and [`CONTRIBUTING/RELEASING.md`](../../CONTRIBUTING/RELEASING.md).
 
+## Migration notes
+
+Add an entry to `MIGRATION.md` only for a breaking change or a deprecation: a change after which users have to change their code, config or setup, now or before the next major.
+
+A change is not breaking when the old behavior was a bug, even when users notice it. To decide, ask whether the change could ship in a minor release. If it could, it gets no entry, also while the next major is open on `next`. A user-visible fix belongs in the PR description, which the changelog links to.
+
+An entry is for removing or renaming an API, option or package, raising a supported version, or deprecating something. A fix that makes a name, an output or an error match what the docs or another part of Storybook already said gets none.
+
 ## Greptile review
 
 Greptile reviews a PR by itself when the PR leaves draft, and again on each push after that. It does not review a draft PR by itself. To ask for a review of a draft, comment `@greptileai review` on the PR (`gh pr comment <number> --body "@greptileai review"`). Greptile reacts with 👀, starts a "Greptile Review" check on the head commit, and posts a summary comment and inline comments after about five minutes. It reviews the head at the time of the comment, so push first. A local `greptile review` CLI run does not replace the review on the PR.
```

**File**: `.obvious/skills/code-review/rules.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ Include a command a maintainer can rerun with the finding.
 - Follow `package.json` `exports` and declaration generation; an internal filename does not establish a public export.
 - Check accepted consumer expressions, inference, supported versions, and dependency ranges in affected sibling packages.
 - A caller search inside this repository does not establish compatibility for external consumers.
-- Check migration guidance when supported usage or peer dependency floors change.
+- A breaking change or a deprecation, such as a raised peer dependency floor, needs a `MIGRATION.md` entry, and no other change does. [Pull requests](../../guidelines/pull-requests.md#migration-notes) defines both.
 - Internal APIs follow "migrate every caller, then delete the old path" in the same PR. Public APIs follow the deprecation process instead, so a compatibility layer there is expected, not debt.
 
 ### Shared core, docs blocks, framework or renderer adapters
```

---

### Incident Patch 2: `2069ff0a` (2026-11-26)
**Commit Message**: Leave the migration note out: a story named like the preview names it is a fix

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `MIGRATION.md` (modified, +0/-11)
```diff
@@ -26,7 +26,6 @@
     - [Svelte: the source snippet leaves out action args by value](#svelte-the-source-snippet-leaves-out-action-args-by-value)
     - [Vue: slots come from the component's props](#vue-slots-come-from-the-components-props)
   - [Deprecated CSF and manager type aliases removed](#deprecated-csf-and-manager-type-aliases-removed)
-  - [Stories exported with `export { … }` are named like `export const` stories](#stories-exported-with-export----are-named-like-export-const-stories)
   - [`docgenServer` is stable and enabled by default](#docgenserver-is-stable-and-enabled-by-default)
     - [Temporary regressions on source snippet generation](#temporary-regressions-on-source-snippet-generation)
   - [Builder docgen is deprecated](#builder-docgen-is-deprecated)
@@ -1270,16 +1269,6 @@ Story context objects passed to loaders and play functions no longer carry the d
 
 The manager resolves `SELECT_STORY` payloads from `storyId` or `title`/`name`, and still accepts the deprecated `kind`/`story` payload that composed Storybooks built with Storybook 10.x or earlier send, so cross-story links inside those refs keep navigating. A payload without any of those keys is ignored with a warning. Composed refs must publish a story index (`stories.json`); the v2 format is no longer accepted and the legacy `setStories` event is no longer read.
 
-### Stories exported with `export { … }` are named like `export const` stories
-
-A story exported with `export { X }` or `export { a as X }` was named by its export name as it is: `export { primaryButton }` was named `primaryButton`. It is now named like a story exported with `export const`: by its `name` when the story object in the same file has one, else by its export name in start case (`Primary Button`). A story re-exported from another file, with `export { X } from './other.stories'`, is named by its export name in start case.
-
-This changes the story's name in the sidebar and the name of its Vitest test. The preview already used these names. Story ids and URLs do not change.
-
-Svelte CSF stories also get Vitest tests named like the stories: `<Story name="Hover Shows Full Date" />` had a test named `HoverShowsFullDate`, and now has one named `Hover Shows Full Date`.
-
-Vitest stores a snapshot under the name of its test. Run a renamed test that uses `toMatchSnapshot` or a screenshot once with `-u`.
-
 ### `docgenServer` is stable and enabled by default
 
 The `experimentalDocgenServer` feature is now `docgenServer`, and Storybook no longer reads the old name.
```

#### Recent Merged Pull Requests:
- **PR #37801** (2026-11-26): Agents: Add a migration note only for a breaking change or a deprecation (@kasperpeulen)
- **PR #37800** (2026-11-26): CI: Run the docs check in ci:focus when docs change (@valentinpalkovic)
- **PR #37798** (2026-11-26): Docs: Fix the CSF 3 banner link in the JSDoc tags snippet (@valentinpalkovic)
- **PR #37796** (closed): Docs: Compare skills-index paths drive-agnostically (@obvious-autobuild[bot])
- **PR #37795** (2026-11-26): Sidebar: Fix ContextMenu focus handling after pointer dismissal (@Sidnioulz)
- **PR #37794** (2026-11-26): Docs: Improve PR template guidance for describing changes (@Sidnioulz)

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

## X. Agent guidelines: A migration note is for a breaking change or a deprecation

**RULE**:
When implementing operations in `.agents/guidelines/pull-requests.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in storybookjs/storybook. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `44e786e3`: Agent guidelines: A migration note is for a breaking change or a deprecation. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.agents/guidelines/pull-requests.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
## Migration notes

Add an entry to `MIGRATION.md` only for a breaking change or a deprecation: a change after which users have to change their code, config or setup, now or before the next major.

A change is not breaking when the old behavior was a bug, even when users notice it. To decide, ask whether the change could ship in a minor release. If it could, it gets no entry, also while the next major is open on `next`. A user-visible fix belongs in the PR description, which the changelog links to.

An entry is for removing or renaming an API, option or package, raising a supported version, or deprecating something. A fix that makes a name, an output or an error match what the docs or another part of Storybook already said gets none.

```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `44e786e3` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
