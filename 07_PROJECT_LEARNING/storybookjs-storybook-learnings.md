# Forensic Learning Record (Deep Inspection): storybookjs/storybook

> **Canonical Artifact**: `07_PROJECT_LEARNING/storybookjs-storybook-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/storybookjs/storybook](https://github.com/storybookjs/storybook))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:12:00.159Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `storybookjs/storybook`
- **Description**: Storybook is the industry standard workshop for building, documenting, and testing UI components in isolation
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 91199 stars

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

### Core Architecture Module: `agent-eval/scripts/render-results-summary.mjs`
```
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const agentEvalRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const resultsRoot = join(agentEvalRoot, 'results');
const TIMESTAMP_DIR = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listDirectories(path) {
  if (!existsSync(path)) {
    return [];
  }

  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// Results are laid out as <experiment path>/<timestamp>/<eval>/summary.json,
// where the experiment path may be nested (e.g. cc-plugin/native-default).
function findTimestampDirectories(dir = resultsRoot) {
  return listDirectories(dir).flatMap((name) => {
    const path = join(dir, name);

    return TIMESTAMP_DIR.test(name) ? [path] : findTimestampDirectories(path);
  });
}

// Usage is computed by the experiments' onRunComplete hook (lib/usage.ts)
// and persisted in each run's result.json as metadata.usage.
function collectEvalUsage(evalRoot) {
  const runs = listDirectories(evalRoot).filter((name) => /^run-\d+$/.test(name));
  const combined = { total: 0, cost: 0, costKnown: true };
  const found = runs.flatMap((run) => {
    const resultPath = join(evalRoot, run, 'result.json');
    const usage = existsSync(resultPath) ? readJson(resultPath).metadata?.usage : undefined;

    return usage ? [usage] : [];
  });

  if (found.length === 0) {
    return null;
  }

  for (const usage of found) {
    combined.total += usage.totalTokens;

    if (usage.estimatedCostUsd === undefined) {
      combined.costKnown = false;
    } else {
      combined.cost += usage.estimatedCostUsd;
    }
  }

  return combined;
}

function formatTokens(count) {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }

  return count >= 1_000 ? `${Math.round(count / 1_000)}k` : `${count}`;
}

function formatCost(usage) {
  if (!usage.costKnown && usage.cost === 0) {
    return '—';
  }

  return `${usage.costKnown ? '' : '≥'}$${usage.cost.toFixed(2)}`;
}

function collectEvals(runRoot) {
  return listDirectories(runRoot).flatMap((name) => {
    const summaryPath = join(runRoot, name, 'summary.json');

    if (!existsSync(summaryPath)) {
      return [];
    }

    const classificationPath = join(runRoot, name, 'classification.json');

    return [
      {
        name,
        summary: readJson(summaryPath),
        classification: existsSync(classificationPath) ? readJson(classificationPath) : null,
        usage: collectEvalUsage(join(runRoot, name)),
      },
    ];
  });
}

function collectExperiments() {
  const latestRunByExperiment = new Map();

  for (const runRoot of findTimestampDirectories()) {
    const experiment = relative(resultsRoot, dirname(runRoot)).split(sep).join('/');
    const previous = latestRunByExperiment.get(experiment);

    // Timestamps are ISO-based, so lexicographic comparison finds the latest run.
    if (!previous || runRoot > previous) {
      latestRunByExperiment.set(experiment, runRoot);
    }
  }

  return [...latestRunByExperiment.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([experiment, runRoot]) => ({
      experiment,
      timestamp: relative(dirname(runRoot), runRoot),
      evals: collectEvals(runRoot),
    }));
}

// Classifier output is free-form: strip newlines, pipes, and backticks so a
// reason can never break out of its markdown table cell.
function sanitizeCell(value) {
  return String(value ?? '')
    .replaceAll(/\s+/g, ' ')
    .replaceAll('|', '\\|')
    .replaceAll('`', "'")
    .trim();
}

function renderEvalRow({ name, summary, classification, usage }) {
  const passed = summary.passedRuns === summary.totalRuns;
  const status = passed ? '✅' : '❌';
  const duration =
    typeof summary.meanDuration === 'number' ? `${summary.meanDuration.toFixed(1)}s` : '—';
  const tokens = usage ? formatTokens(usage.total) : '—';
  const cost = usage ? formatCost(usage) : '—';
  const failure = classification
    ? `\`${sanitizeCell(classification.failureType)}\` — ${sanitizeCell(classification.failureReason)}`
    : '';

  return `| ${status} | \`${name}\` | ${summary.passedRuns}/${summary.totalRuns} (${summary.passRate}) | ${duration} | ${tokens} | ${cost} | ${failure} |`;
}

function renderExperiment({ experiment, timestamp, evals }) {
  if (evals.length === 0) {
    return `#### \`${experiment}\`\n\n_No results._`;
  }

  return [
    `#### \`${experiment}\` (${timestamp})`,
    '',
    '| | Eval | Pass rate | Mean duration | Tokens | Cost | Failure |',
    '|---|---|---|---|---|---|---|',
    ...evals.map(renderEvalRow),
  ].join('\n');
}

const experiments = collectExperiments();
const evals = experiments.flatMap(({ evals: experimentEvals }) => experimentEvals);
const passedEvals = evals.filter(({ summary }) => summary.passedRuns === summary.totalRuns);
const totals = evals
  .map(({ usage }) => usage)
  .filter(Boolean)
  .reduce(
    (acc, usage) => ({
      total: acc.total + usage.total,
      cost: acc.cost + usage.cost,
      costKnown: acc.costKnown && usage.costKnown,
    }),
    { total: 0, cost: 0, costKnown: true }
  );
const playgroundUrl = process.env.PLAYGROUND_URL;
const runUrl = process.env.RUN_URL;

const sections = [
  [
    '### Agent eval results',
    '',
    `**${passedEvals.length}/${evals.length} evals passed**${
      totals.total > 0 ? ` · ${formatTokens(totals.total)} tokens · ${formatCost(totals)}` : ''
    }${runUrl ? ` ([workflow run](${runUrl}))` : ''}`,
  ].join('\n'),
];

if (playgroundUrl) {
  sections.push(`Playground: ${playgroundUrl}`);
}

if (experiments.length > 0) {
  sections.push(
    [
      '<details>',
      '<summary>Results by experiment</summary>',
      '',
      experiments.map(renderExperiment).join('\n\n'),
      '',
      '</details>',
    ].join('\n')
  );
  sections.push(
    '_Cost is estimated from model token usage at provider list prices ([Vercel AI Gateway](https://vercel.com/docs/ai-gateway/pricing) adds no markup) and excludes Vercel Sandbox compute._'
  );
}

process.stdout.write(`${sections.join('\n\n')}\n`);

```

### Core Architecture Module: `agent-eval/templates/reshaped-storybook/public/mockServiceWorker.js`
```
/* eslint-disable */
/* tslint:disable */

/**
 * Mock Service Worker.
 * @see https://github.com/mswjs/msw
 * - Please do NOT modify this file.
 */

const PACKAGE_VERSION = '2.14.6';
const INTEGRITY_CHECKSUM = '4db4a41e972cec1b64cc569c66952d82';
const IS_MOCKED_RESPONSE = Symbol('isMockedResponse');
const activeClientIds = new Set();

addEventListener('install', function () {
  self.skipWaiting();
});

addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

addEventListener('message', async function (event) {
  const clientId = Reflect.get(event.source || {}, 'id');

  if (!clientId || !self.clients) {
    return;
  }

  const client = await self.clients.get(clientId);

  if (!client) {
    return;
  }

  const allClients = await self.clients.matchAll({
    type: 'window',
  });

  switch (event.data) {
    case 'KEEPALIVE_REQUEST': {
      sendToClient(client, {
        type: 'KEEPALIVE_RESPONSE',
      });
      break;
    }

    case 'INTEGRITY_CHECK_REQUEST': {
      sendToClient(client, {
        type: 'INTEGRITY_CHECK_RESPONSE',
        payload: {
          packageVersion: PACKAGE_VERSION,
          checksum: INTEGRITY_CHECKSUM,
        },
      });
      break;
    }

    case 'MOCK_ACTIVATE': {
      activeClientIds.add(clientId);

      sendToClient(client, {
        type: 'MOCKING_ENABLED',
        payload: {
          client: {
            id: client.id,
            frameType: client.frameType,
          },
        },
      });
      break;
    }

    case 'CLIENT_CLOSED': {
      activeClientIds.delete(clientId);

      const remainingClients = allClients.filter((client) => {
        return client.id !== clientId;
      });

      // Unregister itself when there are no more clients
      if (remainingClients.length === 0) {
        self.registration.unregister();
      }

      break;
    }
  }
});

addEventListener('fetch', function (event) {
  const requestInterceptedAt = Date.now();

  // Bypass navigation requests.
  if (event.request.mode === 'navigate') {
    return;
  }

  // Opening the DevTools triggers the "only-if-cached" request
  // that cannot be handled by the worker. Bypass such requests.
  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
    return;
  }

  // Bypass all requests when there are no active clients.
  // Prevents the self-unregistered worked from handling requests
  // after it's been terminated (still remains active until the next reload).
  if (activeClientIds.size === 0) {
    return;
  }

  const requestId = crypto.randomUUID();
  event.respondWith(handleRequest(event, requestId, requestInterceptedAt));
});

/**
 * @param {FetchEvent} event
 * @param {string} requestId
 * @param {number} requestInterceptedAt
 */
async function handleRequest(event, requestId, requestInterceptedAt) {
  const client = await resolveMainClient(event);
  const requestCloneForEvents = event.request.clone();
  const response = await getResponse(event, client, requestId, requestInterceptedAt);

  // Send back the response clone for the "response:*" life-cycle events.
  // Ensure MSW is active and ready to handle the message, otherwise
  // this message will pend indefinitely.
  if (client && activeClientIds.has(client.id)) {
    const serializedRequest = await serializeRequest(requestCloneForEvents);

    // Clone the response so both the client and the library could consume it.
    const responseClone = response.clone();

    sendToClient(
      client,
      {
        type: 'RESPONSE',
        payload: {
          isMockedResponse: IS_MOCKED_RESPONSE in response,
          request: {
            id: requestId,
            ...serializedRequest,
          },
          response: {
            type: responseClone.type,
            status: responseClone.status,
            statusText: responseClone.statusText,
            headers: Object.fromEntries(responseClone.headers.entries()),
            body: responseClone.body,
          },
        },
      },
      responseClone.body ? [serializedRequest.body, responseClone.body] : []
    );
  }

  return response;
}

/**
 * Resolve the main client for the given event.
 * Client that issues a request doesn't necessarily equal the client
 * that registered the worker. It's with the latter the worker should
 * communicate with during the response resolving phase.
 * @param {FetchEvent} event
 * @returns {Promise<Client | undefined>}
 */
async function resolveMainClient(event) {
  const client = await self.clients.get(event.clientId);

  if (activeClientIds.has(event.clientId)) {
    return client;
  }

  if (client?.frameType === 'top-level') {
    return client;
  }

  const allClients = await self.clients.matchAll({
    type: 'window',
  });

  return allClients
    .filter((client) => {
      // Get only those clients that are currently visible.
      return client.visibilityState === 'visible';
    })
    .find((client) => {
      // Find the client ID that's recorded in the
      // set of clients that have registered the worker.
      return activeClientIds.has(client.id);
    });
}

/**
 * @param {FetchEvent} event
 * @param {Client | undefined} client
 * @param {string} requestId
 * @param {number} requestInterceptedAt
 * @returns {Promise<Response>}
 */
async function getResponse(event, client, requestId, requestInterceptedAt) {
  // Clone the request because it might've been already used
  // (i.e. its body has been read and sent to the client).
  const requestClone = event.request.clone();

  function passthrough() {
    // Cast the request headers to a new Headers instance
    // so the headers can be manipulated with.
    const headers = new Headers(requestClone.headers);

    // Remove the "accept" header value that marked this request as passthrough.
    // This prevents request alteration and also keeps it compliant with the
    // user-defined CORS policies.
    const acceptHeader = headers.get('accept');
    if (acceptHeader) {
      const values = acceptHeader.split(',').map((value) => value.trim());
      const filteredValues = values.filter((value) => value !== 'msw/passthrough');

      if (filteredValues.length > 0) {
        headers.set('accept', filteredValues.join(', '));
      } else {
        headers.delete('accept');
      }
    }

    return fetch(requestClone, { headers });
  }

  // Bypass mocking when the client is not active.
  if (!client) {
    return passthrough();
  }

  // Bypass initial page load requests (i.e. static assets).
  // The absence of the immediate/parent client in the map of the active clients
  // means that MSW hasn't dispatched the "MOCK_ACTIVATE" event yet
  // and is not ready to handle requests.
  if (!activeClientIds.has(client.id)) {
    return passthrough();
  }

  // Notify the client that a request has been intercepted.
  const serializedRequest = await serializeRequest(event.request);
  const clientMessage = await sendToClient(
    client,
    {
      type: 'REQUEST',
      payload: {
        id: requestId,
        interceptedAt: requestInterceptedAt,
        ...serializedRequest,
      },
    },
    [serializedRequest.body]
  );

  switch (clientMessage.type) {
    case 'MOCK_RESPONSE': {
      return respondWithMock(clientMessage.data);
    }

    case 'PASSTHROUGH': {
      return passthrough();
    }
  }

  return passthrough();
}

/**
 * @param {Client} client
 * @param {any} message
 * @param {Array<Transferable>} transferrables
 * @returns {Promise<any>}
 */
function sendToClient(client, message, transferrables = []) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = (event) => {
      if (event.data && event.data.error) {
        return reject(event.data.error);
      }

      resolve(event.data);
    };

    client.postMessage(message, [channel.port2, ...transferrables.filter(Boolean)]);
  });
}

/**
 * @param {Response} response
 * @returns {Response}
 */
function respondWithMock(response) {
  // Setting response status code to 0 is a no-op.
  // However, when responding with a "Response.error()", the produced Response
  // instance will have status code set to 0. Since it's not possible to create
  // a Response instance with status code 0, handle that use-case separately.
  if (response.status === 0) {
    return Response.error();
  }

  const mockedResponse = new Response(response.body, response);

  Reflect.defineProperty(mockedResponse, IS_MOCKED_RESPONSE, {
    value: true,
    enumerable: true,
  });

  return mockedResponse;
}

/**
 * @param {Request} request
 */
async function serializeRequest(request) {
  return {
    url: request.url,
    mode: request.mode,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    cache: request.cache,
    credentials: request.credentials,
    destination: request.destination,
    integrity: request.integrity,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    body: await request.arrayBuffer(),
    keepalive: request.keepalive,
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #36602** (2026-10-05): **Core: Point the tools CLI at a private composed Storybook's own MCP**
  *Symptoms*: <!-- If your PR is related to an issue, provide the number(s) above; if it resolves multiple issues, be sure to break them up (e.g. "closes #1000, closes #1001"). -->  <!--  Thank you for contributing to Storybook! Please submit all PRs to the `next` branch unless they are specific to the current release. Storybook maintainers cherry-pick bug and documentation fixes into the `main` branch as part of the release process, so you shouldn't need to worry about this. For additional guidance: https://storybook.js.org/docs/contribute  -->  ## What I did  Linear: [SB-2125](https://linear.app/chromaui/issue/SB-2125)  Since #36428, `storybook tools docs` lists composed `refs`. A **private** ref, such as a private Chromatic project, answers `401`, and the CLI has no credentials. The agent got a dead end:  ``` # Tetra (private) id: tetra  error: Failed to get component manifest: Failed to fetch manifest: 401 Unauthorized ```  The decision is that the CLI does not get its own login. Private and hosted Storybooks are read over MCP. This is a regression: the deprecated `storybook ai` CLI already gave the right answer for this case. This PR brings that notice back, with the same text:  ``` # Tetra (private) id: tetra  This composed Storybook is private and cannot be read through the local Storybook MCP proxy.  Use this source's own MCP endpoint instead: https://main--69b825e208f8a441cf8ff5fe.chromatic.com/mcp ```  ### History: why this is a regression  1. **May 2026, storybookjs/mcp#242** ("
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/storybookjs/storybook/pull/36602?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <details> <summary>🧰 Additional context used</summary>  <details> <summary>📚 Code guidelines (1)</summary>  ``` .cursor/rules/spy-mocking.mdc — auto-discovered ```  </details>  </details> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: Organization U

- **Issue #36601** (2026-10-05): **Tools: Use strict input schemas so CLI and MCP reject unknown arguments**
  *Symptoms*: Closes [SB-2196](https://linear.app/chromaui/issue/SB-2196/bug-storybook-tools-silently-ignores-unknown-flags)  ## What I did  Toolset inputs used `v.object`, which strips undeclared keys. A mistyped argument therefore disappeared, and the tool ran on its defaults and returned a plausible but wrong answer. With a composed ref, `storybook tools docs show --storybook-id icons` (instead of `--storybookId icons`) silently returned the **local** component with exit 0. MCP had the same problem.  ### The fix: valibot `strictObject` in the schema  Every toolset input is now a `v.strictObject` instead of a `v.object`: `docs list/show/show-story`, `stories preview/changed/find-by-component`, `review create`, and addon-vitest's `test run`.  ```diff -    ? v.object({ +    ? v.strictObject({          id: v.pipe(v.string(), v.description('The component or docs entry ID (e.g., "button")')),          ...storybookIdField,        }) ```  The schema is the single source of truth for which arguments a tool accepts. There is no separate key check: the CLI and MCP already validate their calls against this schema before the handler runs, so both now reject an undeclared key (one MCP exception is listed under Behavior notes).  - **CLI** (and the SDK's `tools.call`): the SDK validates the input with the method's schema and throws `invalid-input`. `run.ts` already handles that path; it now renders an undeclared key as `Unknown flag`, lists the valid flags (or says the tool takes no arguments), and exi
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/storybookjs/storybook/pull/36601?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: Organization UI - **Review profile**: CHILL - **Plan**: Advanced - **Run ID**: `646be373-bbdf-4687-828d-79aaf40ee7af`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed fro
  > @coderabbitai Re the nitpick on `run.test.ts` (move the `resolve` spy into `beforeEach`): skipping. The spy is used by a single test, and the repo's testing guideline keeps one-off overrides inside that test, with `beforeEach` reserved for values every test uses. The rest of this file also creates its `vi.fn` spies inline per test.
  > <!-- This is an auto-generated reply by CodeRabbit --> > [!TIP] > For best results, initiate chat on the files or code changes.  <details> <summary>🧩 Analysis chain</summary>  🏁 Script executed:  ```shell #!/bin/bash set -euo pipefail fd '^run\.test\.ts$' code/core/src/cli/tools ast-grep outline code/core/src/cli/tools/run.test.ts --items all rg -n -C 5 'beforeEach|vi\.fn|resolve|unknown' code/core/src/cli/tools/run.test.ts ```  Length of output: 14025  ---  </details>  `@kasperpeulen` Thanks for the guidance. The `resolve` spy serves only one test, and other tests in `run.test.ts` also create spies inline. Keeping it inside the test is appropriate. I withdraw the nitpick.    ---  <details> <summary>✏️ Learnings added</summary>  ``` Learnt from: kasperpeulen URL: https://github.com/storybookjs/storybook/pull/36601  Timestamp: 2026-10-05T13:25:55.597Z Learning: In storybookjs/storybook Vitest tests, keep one-off overrides and spies inside the test that uses them. Reserve `beforeEach` 

- **Issue #36598** (2026-10-05): **Core: Mark a review stale only on changes made after it was published**
  *Symptoms*: Closes SB-2192  Follow-up to #36586. @JReinhold, this replaces the `if (revision > 0)` condition you flagged there. A review is now marked stale only by a file change made after it was published, dated by the file's own modification time (mtime) rather than by when the builder reported it. The 10 s grace window is gone.  ## What I did  The module graph now tracks `graphChangedAt`: when the newest change that bumped the graph was made. It is a maximum, so an older edit reported late cannot move it back. `markStale` compares it with the `createdAt` of the current review and of a pending one. So a change made while an update is pending now marks that update stale too; before, accepting the update hid the change. Pending still outranks stale in `bannerKind`, so the user sees nothing new until they accept.  ```ts // module-graph engine, handleFileChange: date the change by the file itself const changedAt = await stat(event.path).then(   (stats) => Math.min(stats.mtimeMs, receivedAt),   () => receivedAt );  // review/server.ts, the dev-server subscription moduleGraph.queries.graphChangedAt.subscribe(undefined, ({ data: changedAt }) => {   if (changedAt !== undefined) {     void review.commands.markStale({ changedAt });   } });  // review/state-transitions.ts, applied to both state.current and state.pending const isOutdated = (review: ReviewState | null): review is ReviewState =>   review?.createdAt !== undefined && !review.stale && changedAt > review.createdAt; ```  ### What the gr
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/storybookjs/storybook/pull/36598?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <details> <summary>🧰 Additional context used</summary>  <details> <summary>📚 Code guidelines (1)</summary>  ``` .cursor/rules/spy-mocking.mdc — auto-discovered ```  </details>  </details> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: Organization U
  > # Package Benchmarks <sup>Commit: `520b603`, ran on 5 October 2026 at 13:42:50 UTC</sup>  The following packages have significant changes to their size or dependencies:  ### `storybook`  |                       | **Before**                                              | **After**                                               | **Difference**                                  | |-----------------------|---------------------------------------------------------|---------------------------------------------------------|-------------------------------------------------| | Dependency count      | 73                          | 73                           | 0  | | Self size             | 21.71 MB                                 | 21.74 MB                                  | 🚨 +31 KB 🚨         | | Dependency size       | 31.24 MB                           | 31.24 MB                            | 0 B   | | Bundle Size Analyzer  | [Link](https://next--635781f3500dd2c49e189caf.chromatic.com/?path=
  > @JReinhold thanks for the approval. Heads-up: I pushed a simplification after it, so you approved a slightly different version.  The review no longer records the module-graph revision. Once each change is dated by its file mtime, capped at when the event arrived, a change that the review already includes is always dated before the review's `createdAt`. So the revision comparison added nothing. Now:  ```ts const isOutdated = (review) =>   review?.createdAt !== undefined && !review.stale && changedAt > review.createdAt; ```  `setReview` and `ReviewState` are back to what `next` has, and the subscription now watches `graphChangedAt` instead of `graphRevision`. The description's "Why a change time, and no recorded revision" section has the full reasoning. I reran the Vite e2e on the final commit and got the same results. 

- **Issue #36586** (2026-10-05): **Core: Subscribe services to module-graph changes only in the dev server**
  *Symptoms*: Closes [SB-2189](https://linear.app/chromaui/issue/SB-2189/tools-cli-a-succeeded-review-create-exits-1-on-an-unhandled-markstale)  Supersedes #36566.  ## What I did  ### In short  - **Bug.** Once any file in the story module graph had changed since Storybook started, an attached `storybook tools` command could:   1. make the dev server mark the current review stale, so the review page says "Code changes detected. This review may be stale." although nothing changed;   2. exit 1 after it had already succeeded, on an unhandled `OpenServiceRemoteCommandUnhandledError` for `core/review.markStale`. - **Cause.** The review service subscribed to the module graph *during registration*, and registration also runs in the attached CLI. To that subscription, the CLI's first state sync looks like a file change. - **Fix.** Subscriptions that execute commands no longer start during registration. `services` queues them right next to the registration, and `experimental_devServer`, which only the dev server applies, starts them. Docgen and story-docs had the same pattern and follow it too. The rule is now in the open-service README.  ### Why it happened  `registerReviewService` registered the service *and* subscribed to `graphRevision` of `core/module-graph`, calling `markStale` whenever the revision was above 0. The `services` preset runs in the dev server, but also in the attached tools CLI, `storybook build` and the `--no-attach` CLI.  ```text dev server:  revision 0 → 1 → 2 → 3       each s
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/storybookjs/storybook/pull/36586?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <details> <summary>🧰 Additional context used</summary>  <details> <summary>📚 Code guidelines (1)</summary>  ``` .cursor/rules/spy-mocking.mdc — auto-discovered ```  </details>  </details> <!-- walkthrough_start -->  ## Walkthrough  Module-graph subscriptions for review, docgen, and story docs now start through the `experimental_devServer` preset instead of during service registration. The extraction service provides a sha

- **Issue #36582** (2026-10-05): **CLI: Fix Windows paths in automigration failure reports**
  *Symptoms*: Closes #  <!-- If your PR is related to an issue, provide the number(s) above; if it resolves multiple issues, be sure to break them up (e.g. "closes #1000, closes #1001"). -->  No linked issue. This fixes `failure-report.test.ts` failures in the Windows unit tests on `next`.  <!--  Thank you for contributing to Storybook! Please submit all PRs to the `next` branch unless they are specific to the current release. Storybook maintainers cherry-pick bug and documentation fixes into the `main` branch as part of the release process, so you shouldn't need to worry about this. For additional guidance: https://storybook.js.org/docs/contribute  -->  ## What I did  The automigration failure report breaks on Windows in two ways:  - `path.relative` returns backslashes, so the File column shows `src\B.stories.ts`. Relative paths are now normalized with `slash`, like elsewhere in the CLI. - Stripping the project root from error messages only matched the host separator, so the Reason column kept `/project/src/B.stories.ts`. The message and root are now both normalized with `slash` before stripping, so either separator style works.  The regression test covers both the POSIX and Windows path implementations and adds a case for backslash paths in error messages.  ## Checklist for Contributors  ### Testing  <!-- Please check (put an "x" inside the "[ ]") the applicable items below to communicate how to test your changes -->  #### The changes in this PR are covered in the following automated tes
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/storybookjs/storybook/pull/36582?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <details> <summary>🧰 Additional context used</summary>  <details> <summary>📚 Code guidelines (1)</summary>  ``` .cursor/rules/spy-mocking.mdc — auto-discovered ```  </details>  </details> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: Organization U

- **Issue #36579** (2026-10-05): **Addon Docs: Keep the dev server running when a story file is deleted during a rebuild**
  *Symptoms*: ## What I did  The `@storybook/addon-docs` csf-plugin webpack loader reads the story file from disk to add its original source. The read ran outside the loader's `try`, so if the file was deleted while a rebuild was in progress, `ENOENT` became an unhandled rejection and stopped the dev server:  ``` Error: ENOENT: no such file or directory, open '.../src/stories/ChangeDetectionNew.stories.ts'     at async Object.loader (.../@storybook/addon-docs/dist/csf-plugin/webpack-loader.js:19:98) ```  The read is now inside the `try`. When it fails, the loader passes the content through unchanged, as it already does for every other error, and webpack picks up the deletion on the next rebuild.  Seen in the `change-detection` e2e test on the `nextjs/default-ts` sandbox in Babel mode, where rebuilds are slower and the window is wider (#36571). This PR is independent of it.  ## Checklist for Contributors  ### Testing  #### The changes in this PR are covered in the following automated tests:  - [ ] stories - [x] unit tests - [ ] integration tests - [ ] end-to-end tests  `webpack-loader.test.ts` is new. Its deleted-file case fails without the fix (`ENOENT: no such file or directory`) and passes with it.  #### Manual testing  1. Run a webpack sandbox, e.g. `yarn task sandbox --template react-webpack/18-ts --start-from auto`, then `yarn storybook`. 2. Create a story file, and delete it while webpack is rebuilding. 3. Before this PR, the dev server exits with `ENOENT`. With it, the server keeps 
  **Post-Mortem & Fix Analysis**:
  >  <!--   1 failure:  PR is not labeled...   0 warning:          DangerID: danger-id-Danger; -->  <table>   <thead>     <tr>       <th width="50"></th>       <th width="100%" data-danger-table="true">Fails</th>     </tr>   </thead>   <tbody><tr>       <td>:no_entry_sign:</td>       <td>    PR is not labeled with one of: ["qa:needed","qa:skip","qa:success"]   </td>     </tr>   </tbody> </table>     <p align="right">   Generated by :no_entry_sign: <a href="https://danger.systems/js">dangerJS</a> against fcb641577ed371c8f7ba019006b5cb2d1d73dc1e </p> 
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/storybookjs/storybook/pull/36579?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <details> <summary>🧰 Additional context used</summary>  <details> <summary>📚 Code guidelines (1)</summary>  ``` .cursor/rules/spy-mocking.mdc — auto-discovered ```  </details>  </details> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: Organization U

- **Issue #36577** (2026-10-05): **Review: Stop the attached CLI from crashing on a forwarded markStale**
  *Symptoms*: ## What I did  `storybook tools review create` could exit with code 1 after it had already printed a successful result. This PR stops that.  The attached `storybook tools` runtime registers the review service in delegated mode, so every command goes to the running dev server. `registerReviewService` also subscribed to the module graph of the CLI process itself. When that graph changed, the CLI forwarded a `markStale` to the dev server as a fire-and-forget call. If the dev server did not acknowledge in time, the rejection was unhandled and crashed the CLI:  ``` SB_CORE-COMMON_0015 (OpenServiceRemoteCommandUnhandledError): The Storybook this runtime is attached to did not acknowledge remote command "core/review.markStale" in time ```  The dev server already watches its own module graph and marks the review stale itself, so the attached runtime now skips the subscription. This follows the rule in `code/core/src/cli/tools/architecture.md`: eager work at registration time should not run in the caller.  Found while running agent evals for #36563 with review on. The crash appeared in 5 of 14 plugin-cell runs (Claude Code and Codex). Codex treats the exit code 1 as a failed `review create`, skips opening the review in the in-app browser, and fails "opens the review in the in-app browser" (803, 804 and 808 on `codex-plugin-gpt-6-sol-medium`). With this fix applied, those three runs passed and their transcripts hold no `markStale` error.  ## Checklist for Contributors  ### Testing  ###
  **Post-Mortem & Fix Analysis**:
  >  <!--   1 failure:  This PR needs an ...   0 warning:          DangerID: danger-id-Danger; -->  <table>   <thead>     <tr>       <th width="50"></th>       <th width="100%" data-danger-table="true">Fails</th>     </tr>   </thead>   <tbody><tr>       <td>:no_entry_sign:</td>       <td>This PR needs an approving review from a Storybook Core or Developer Experience team member before it can be merged. No approvals found.</td>     </tr>   </tbody> </table>     <p align="right">   Generated by :no_entry_sign: <a href="https://danger.systems/js">dangerJS</a> against 9a8d29132771347afc03dbe3b5d1da9e56eb8aa6 </p> 
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/storybookjs/storybook/pull/36577?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <details> <summary>🧰 Additional context used</summary>  <details> <summary>📚 Code guidelines (1)</summary>  ``` .cursor/rules/spy-mocking.mdc — auto-discovered ```  </details>  </details> <!-- recent_review_start -->  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: Organization UI - **Review profile**: CHILL - **Plan**: Advanced - **Run ID**:
  > Superseded by #36586, which fixes the same crash by subscribing services to module-graph changes only in the dev server. Follow-up on the stale condition itself: SB-2192.

- **Issue #36574** (2026-10-05): **React-Vite: Run react-docgen without the project Babel config first**
  *Symptoms*: ## What I did  react-docgen in `@storybook/react-vite` parsed with the project's Babel config. A `babel.config.*` that only adds a plugin (no TypeScript preset), such as the usual StyleX setup, made the parse of every `.tsx` file fail, so components had no docgen and no controls.  react-docgen now parses with its own parser settings first (`babelrc: false, configFile: false`). Only when that fails does it retry with the project Babel config, so configs that add syntax react-docgen doesn't know keep working. If both fail, the first error is thrown. `MISSING_DEFINITION` (no component in the file) is passed through as before.  No API or option change.  Found while working on StyleX support (#36571). This PR is independent of it.  ## Checklist for Contributors  ### Testing  #### The changes in this PR are covered in the following automated tests:  - [ ] stories - [x] unit tests - [ ] integration tests - [ ] end-to-end tests  `react-docgen.babel.test.ts`: 1. A plugin-only `babel.config.json` still gives docgen for a `.tsx` component (fails without the fix). 2. No project config: output unchanged. 3. A project config that adds parser syntax through a syntax plugin: the fallback to the project config still parses it. 4. Files without a component are still skipped.  #### Manual testing  Covered by the unit tests above, which reproduce the failure with a real Babel config file on disk. The StyleX sandbox in #36571 (plugin-only `babel.config.*`) also builds and shows docgen with this c
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/storybookjs/storybook/pull/36574?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <details> <summary>🧰 Additional context used</summary>  <details> <summary>📚 Code guidelines (1)</summary>  ``` .cursor/rules/spy-mocking.mdc — auto-discovered ```  </details>  </details> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: Organization U

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

### Incident Patch 1: `01bdd152` (2026-10-05)
**Commit Message**: Merge pull request #36559 from storybookjs/kasper/sb-2184-skills-stop-requiring-addon-mcp

Skills: Stop requiring addon-mcp

**File**: `agent-eval/evals/812-first-story-empty-project/.storybook/main.ts` (modified, +1/-6)
```diff
@@ -2,12 +2,7 @@ import type { StorybookConfig } from '@storybook/react-vite';
 
 const config: StorybookConfig = {
   stories: ['../@(stories|src)/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
-  addons: [
-    '@storybook/addon-a11y',
-    '@storybook/addon-vitest',
-    '@storybook/addon-docs',
-    '@storybook/addon-mcp',
-  ],
+  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest', '@storybook/addon-docs'],
   framework: '@storybook/react-vite',
 };
 export default config;
```

**File**: `agent-eval/evals/812-first-story-empty-project/package.json` (modified, +0/-2)
```diff
@@ -10,9 +10,7 @@
   "devDependencies": {
     "@storybook/addon-a11y": "workspace:*",
     "@storybook/addon-docs": "workspace:*",
-    "@storybook/addon-mcp": "workspace:*",
     "@storybook/addon-vitest": "workspace:*",
-    "@storybook/mcp": "workspace:*",
     "@storybook/react": "workspace:*",
     "@storybook/react-vite": "workspace:*",
     "@vitest/browser-playwright": "4.0.6",
```

**File**: `agent-eval/evals/820-init-no-storybook/EVAL.ts` (modified, +2/-22)
```diff
@@ -1,4 +1,4 @@
-import { readFileSync, readdirSync } from 'node:fs';
+import { readFileSync } from 'node:fs';
 import { describe, expect, test } from 'vitest';
 import {
   expectShellCommandMatching,
@@ -9,10 +9,6 @@ import {
 } from '#test-utils';
 
 describe('initializing Storybook in a project without it', () => {
-  // Only the lifecycle outcome is asserted: the storybook-init skill installs
-  // the published stable release, which has no story/review workflow tooling
-  // to assert on — that workflow is owned by the 80x evals.
-
   test('invokes the storybook-init skill', () => {
     expectSkillInvoked('storybook-init');
   });
@@ -23,7 +19,7 @@ describe('initializing Storybook in a project without it', () => {
     expectShellCommandMatching(/create(-|\s+)storybook|storybook(@\S+)?\s+init/);
   });
 
-  test('installs Storybook and the MCP addon', () => {
+  test('installs Storybook', () => {
     const packageJson = parseJson(readFileSync('package.json', 'utf8'));
     if (!isRecord(packageJson)) {
       expect.fail('Expected package.json to contain a JSON object');
@@ -34,27 +30,11 @@ describe('initializing Storybook in a project without it', () => {
       ...(isRecord(packageJson.devDependencies) ? packageJson.devDependencies : {}),
     };
     expect(dependencies.storybook, 'Expected a storybook dependency').toBeTypeOf('string');
-    expect(
-      dependencies['@storybook/addon-mcp'],
-      'Expected the @storybook/addon-mcp dependency (skill step 2: npx storybook add @storybook/addon-mcp)'
-    ).toBeTypeOf('string');
 
     const scripts = isRecord(packageJson.scripts) ? packageJson.scripts : {};
     expect(scripts.storybook, 'Expected a storybook script').toBeTypeOf('string');
   });
 
-  test('registers the MCP addon in the Storybook config', () => {
-    const mainFile = readdirSync('.storybook').find((entry) => /^main\.[cm]?[jt]sx?$/.test(entry));
-    if (mainFile === undefined) {
-      expect.fail('Expected a .storybook/main config file to exist');
-    }
-
-    expect(
-      readFileSync(`.storybook/${mainFile}`, 'utf8'),
-      'Expected @storybook/addon-mcp to be registered in the Storybook config'
-    ).toContain('@storybook/addon-mcp');
-  });
-
   test('the initialized Storybook boots', async () => {
     await expectStorybookBoots();
   });
```

**File**: `agent-eval/lib/mcp/start-storybook-mcp.mjs` (modified, +22/-4)
```diff
@@ -4,7 +4,12 @@ import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
 import { setTimeout as delay } from 'node:timers/promises';
 
 const port = process.env.STORYBOOK_MCP_PORT || '6006';
-const mcpUrl = 'http://127.0.0.1:' + port + '/mcp';
+const storybookUrl = 'http://127.0.0.1:' + port;
+const mcpUrl = storybookUrl + '/mcp';
+// Only the MCP experiments keep @storybook/addon-mcp, so only they have an MCP endpoint to wait for.
+const usesMcp =
+  JSON.parse(await readFile('__agent_eval__/agent.json', 'utf8')).integration === 'mcp';
+const readyUrl = usesMcp ? mcpUrl : storybookUrl + '/index.json';
 const logPath = process.env.STORYBOOK_MCP_LOG_PATH || '/tmp/storybook-mcp.log';
 const parsedTimeoutMs = Number(process.env.STORYBOOK_MCP_TIMEOUT_MS);
 const timeoutMs =
@@ -76,8 +81,8 @@ const logTail = await readFile(logPath, 'utf8')
   .then((tail) => tail || '(no Storybook log was written)');
 
 process.stderr.write(
-  'Storybook MCP server did not become ready at ' +
-    mcpUrl +
+  'Storybook did not become ready at ' +
+    readyUrl +
     ' within ' +
     timeoutMs +
     'ms. Storybook log tail:\n' +
@@ -123,7 +128,7 @@ async function assertCheckoutPackagesInstalled() {
 
 async function isReady() {
   try {
-    return await initializeMcp();
+    return usesMcp ? await initializeMcp() : await servesStoryIndex();
   } catch {
     return false;
   }
@@ -141,6 +146,10 @@ async function dumpMcpDebug() {
     // The startup log first, so it is captured even when the fetches below throw.
     await copyFile(logPath, debugDir + '/storybook.log').catch(() => {});
 
+    if (!usesMcp) {
+      return;
+    }
+
     const landing = await fetch(mcpUrl, {
       headers: { Accept: 'text/html' },
       signal: AbortSignal.timeout(5_000),
@@ -195,3 +204,12 @@ async function initializeMcp() {
   await response.body?.cancel();
   return response.ok;
 }
+
+async function servesStoryIndex() {
+  const response = await fetch(storybookUrl + '/index.json', {
+    signal: AbortSignal.timeout(5_000),
+  });
+
+  await response.body?.cancel();
+  return response.ok;
+}
```

**File**: `agent-eval/lib/mcp/start-storybook-mcp.test.ts` (modified, +22/-0)
```diff
@@ -20,10 +20,16 @@ afterEach(() => {
 });
 
 function runInstall(options: {
+  integration?: 'mcp' | 'plugin';
   checkoutPackages?: string[];
   lockfilePackages?: Record<string, { resolved?: string }>;
 }) {
   projectDir = mkdtempSync(path.join(tmpdir(), 'start-storybook-mcp-'));
+  mkdirSync(path.join(projectDir, '__agent_eval__'));
+  writeFileSync(
+    path.join(projectDir, '__agent_eval__', 'agent.json'),
+    JSON.stringify({ integration: options.integration ?? 'mcp' })
+  );
   if (options.checkoutPackages) {
     mkdirSync(path.join(projectDir, 'local-packages'));
     writeFileSync(
@@ -109,3 +115,19 @@ describe('the checkout package check', () => {
     expect(result.stderr).toContain('did not become ready');
   });
 });
+
+describe('the readiness check', () => {
+  it('waits for the MCP endpoint in an MCP sandbox', () => {
+    const result = runInstall({ integration: 'mcp' });
+
+    expect(result.status).toBe(1);
+    expect(result.stderr).toContain('did not become ready at http://127.0.0.1:1/mcp');
+  });
+
+  it('waits for the story index in a sandbox without the MCP addon', () => {
+    const result = runInstall({ integration: 'plugin' });
+
+    expect(result.status).toBe(1);
+    expect(result.stderr).toContain('did not become ready at http://127.0.0.1:1/index.json');
+  });
+});
```

**File**: `agent-eval/lib/templates.test.ts` (modified, +46/-3)
```diff
@@ -1,11 +1,12 @@
-import { readFileSync } from 'node:fs';
-import { join } from 'node:path';
+import { readdirSync, readFileSync } from 'node:fs';
+import { join, sep } from 'node:path';
 import { fileURLToPath } from 'node:url';
 
 import type { Sandbox } from '@vercel/agent-eval';
 import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
 
 import {
+  addMcpAddon,
   pointStorybookAtCheckout,
   isReviewEnabledFor,
   readStorybookWorkspace,
@@ -41,6 +42,30 @@ describe('isReviewEnabledFor', () => {
   });
 });
 
+describe('addMcpAddon', () => {
+  it('registers the addon in every template and fixture Storybook', () => {
+    const mainFiles = [
+      ...findStorybookMainFiles(join(AGENT_EVAL_ROOT, 'templates')),
+      ...findStorybookMainFiles(join(AGENT_EVAL_ROOT, 'evals')),
+    ];
+    expect(mainFiles.length).toBeGreaterThan(0);
+
+    for (const mainFile of mainFiles) {
+      const files = {
+        '.storybook/main.ts': readFileSync(mainFile, 'utf8'),
+        'package.json': readFileSync(join(mainFile, '..', '..', 'package.json'), 'utf8'),
+      };
+
+      addMcpAddon(files);
+
+      expect(files['.storybook/main.ts'], mainFile).toContain("'@storybook/addon-mcp'],");
+      expect(JSON.parse(files['package.json']).devDependencies, mainFile).toMatchObject({
+        '@storybook/addon-mcp': 'workspace:*',
+      });
+    }
+  });
+});
+
 // The Codex MCP experiment copies the server instructions into AGENTS.md, so a
 // change to them must update the copy too.
 describe('Codex AGENTS.md instructions', () => {
@@ -94,7 +119,12 @@ describe('readTemplateCheckoutPackages', () => {
     const packages = (await readTemplateCheckoutPackages()).map((pkg) => pkg.name);
 
     expect(packages).toEqual(
-      expect.arrayContaining(['storybook', '@storybook/react-vite', '@storybook/builder-vite'])
+      expect.arrayContaining([
+        'storybook',
+        '@storybook/react-vite',
+        '@storybook/builder-vite',
+        '@storybook/addon-mcp',
+      ])
     );
   });
 });
@@ -241,3 +271,16 @@ describe('writeClaudeInAppBrowserMock', () => {
     expect(files['CLAUDE.md']).toMatch(/^# Project rules\n\n[\s\S]*<built_in_browser>/);
   });
 });
+
+function findStorybookMainFiles(rootDir: string): string[] {
+  return readdirSync(rootDir, { withFileTypes: true }).flatMap((entry) => {
+    const entryPath = join(rootDir, entry.name);
+    if (entry.isDirectory()) {
+      return entry.name === 'node_modules' ? [] : findStorybookMainFiles(entryPath);
+    }
+    // `sep`-based so the match also works on Windows, where `join` emits backslashes.
+    return entry.name === 'main.ts' && entryPath.includes(`${sep}.storybook${sep}`)
+      ? [entryPath]
+      : [];
+  });
+}
```

**File**: `agent-eval/lib/templates.ts` (modified, +42/-0)
```diff
@@ -127,6 +127,10 @@ export function isReviewEnabledFor(integration: EvalIntegration): boolean {
     integration === 'plugin' || (integration === 'mcp' && process.env.EVAL_STORYBOOK_LATEST !== '1')
   );
 }
+const STORYBOOK_MAIN_PATTERN = /(^|\/)\.storybook\/main\.ts$/;
+const STORYBOOK_MCP_ADDON = '@storybook/addon-mcp';
+// Captures the entries of the `addons` list, without the trailing comma.
+const STORYBOOK_ADDONS_PATTERN = /addons: \[([^\]]*?),?\s*\]/;
 const STORYBOOK_MCP_SERVER_NAME = 'storybook-dev-mcp';
 const CLAUDE_BROWSER_MCP_SERVER_NAME = 'Browser';
 const STORYBOOK_MCP_URL = 'http://127.0.0.1:6006/mcp';
@@ -177,6 +181,10 @@ export async function setupSandbox(
 
   files = mergeTemplateAndFixtureFiles(files, fixtureFiles);
 
+  if (options.integration === 'mcp') {
+    addMcpAddon(files);
+  }
+
   const workspace = await readStorybookWorkspace();
   let packedCheckout = false;
   if (process.env.EVAL_STORYBOOK_LATEST === '1') {
@@ -325,6 +333,35 @@ function mergeTemplateAndFixtureFiles(
   return files;
 }
 
+// Only the MCP experiments get the addon: the plugin skills have to work in a project without it.
+export function addMcpAddon(files: Record<string, string>): void {
+  for (const [filePath, content] of Object.entries(files)) {
+    if (!STORYBOOK_MAIN_PATTERN.test(filePath)) {
+      continue;
+    }
+
+    if (!STORYBOOK_ADDONS_PATTERN.test(content)) {
+      throw new Error(`Cannot add ${STORYBOOK_MCP_ADDON}: ${filePath} has no "addons: [...]" list`);
+    }
+    files[filePath] = content.replace(
+      STORYBOOK_ADDONS_PATTERN,
+      (_, addons: string) =>
+        `addons: [${[addons.trim(), `'${STORYBOOK_MCP_ADDON}'`].filter(Boolean).join(', ')}]`
+    );
+
+    const manifestPath = path.posix.join(path.posix.dirname(filePath), '..', 'package.json');
+    const packageJson = parseJsonFile(manifestPath, files[manifestPath] ?? '', 'fixture');
+    if (!isRecord(packageJson)) {
+      throw new Error(`Expected ${manifestPath} to contain a JSON object`);
+    }
+    packageJson.devDependencies = {
+      ...(isRecord(packageJson.devDependencies) ? packageJson.devDependencies : {}),
+      [STORYBOOK_MCP_ADDON]: WORKSPACE_SPEC,
+    };
+    files[manifestPath] = JSON.stringify(packageJson, null, 2).concat('\n');
+  }
+}
+
 function parseJsonFile(filePath: string, content: string, source: 'fixture' | 'template'): unknown {
   try {
     return JSON.parse(content) as unknown;
@@ -628,6 +665,11 @@ function readPackedTarballs(packages: WorkspacePackage[]): Record<string, string
 export async function readTemplateCheckoutPackages(): Promise<WorkspacePackage[]> {
   const workspace = await readStorybookWorkspace();
   const packages = new Map<string, WorkspacePackage>();
+  // No manifest lists the addon: setup adds it for the MCP experiments.
+  const mcpAddon = workspace.get(STORYBOOK_MCP_ADDON);
+  if (mcpAddon) {
+    packages.set(mcpAddon.name, mcpAddon);
+  }
   for (const sourceDir of [TEMPLATES_DIR, EVALS_DIR]) {
     for await (const manifestPath of fs.glob('**/package.json', {
       cwd: sourceDir,
```

**File**: `agent-eval/templates/monorepo/packages/ui/.storybook/main.ts` (modified, +1/-6)
```diff
@@ -2,12 +2,7 @@ import type { StorybookConfig } from '@storybook/react-vite';
 
 const config: StorybookConfig = {
   stories: ['../@(stories|src)/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
-  addons: [
-    '@storybook/addon-a11y',
-    '@storybook/addon-vitest',
-    '@storybook/addon-docs',
-    '@storybook/addon-mcp',
-  ],
+  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest', '@storybook/addon-docs'],
   framework: '@storybook/react-vite',
 };
 export default config;
```

---

### Incident Patch 2: `72e2c567` (2026-10-05)
**Commit Message**: Merge pull request #36601 from storybookjs/kasper/sb-2196-bug-storybook-tools-silently-ignores-unknown-flags

Tools: Use strict input schemas so CLI and MCP reject unknown arguments

**File**: `code/addons/vitest/src/node/toolset/definition.test.ts` (modified, +6/-0)
```diff
@@ -95,6 +95,12 @@ describe('test API', () => {
     });
   });
 
+  it('rejects an undeclared input key instead of dropping it', () => {
+    const result = v.safeParse(toolset.methods.run.input, { a11y: true, undeclared: true });
+
+    expect(result.issues?.map((issue) => issue.path?.[0].key)).toEqual(['undeclared']);
+  });
+
   it('renders the same per-story report for the CLI consumer as for MCP', async () => {
     vi.mocked(runStoryTests).mockResolvedValue(
       completed({
```

**File**: `code/addons/vitest/src/node/toolset/definition.ts` (modified, +1/-1)
```diff
@@ -110,7 +110,7 @@ export type TestRunFailureData = Extract<
   a11y: boolean;
 };
 
-const runInputSchema = v.object({
+const runInputSchema = v.strictObject({
   stories: v.optional(
     v.pipe(
       storyInputArraySchema,
```

**File**: `code/core/src/cli/tools/README.md` (modified, +5/-0)
```diff
@@ -64,6 +64,11 @@ set). `--json` keeps only the tool result.
 be combined. `requiresDevServer` is a **local-mode intercept** only: when attached, those methods
 run caller-side (`stories.preview` reads `origin` from the instance record).
 
+Tool arguments are `--key value` flags spelled exactly like the input schema keys (camelCase, e.g.
+`--storybookId`); there are no kebab-case aliases. Toolset inputs are `v.strictObject`, so a flag
+or `--input` key the tool does not declare is an invalid-input error, and the CLI names the flag
+and lists the valid ones.
+
 `docs` honours the project's `refs`: with composed Storybooks, `docs list` prints one section per
 source and `docs show` / `docs show-story` take `--storybookId`, which defaults to `local`. Remote
 manifests are fetched without credentials and with a 3 second timeout in every mode; a ref that
```

**File**: `code/core/src/cli/tools/run.test.ts` (modified, +80/-0)
```diff
@@ -6,6 +6,7 @@
  */
 
 import type { StoryIndex } from 'storybook/internal/types';
+import type { StandardSchemaV1 } from '@standard-schema/spec';
 import { beforeEach, describe, expect, it, vi } from 'vitest';
 
 import * as v from 'valibot';
@@ -19,6 +20,7 @@ import {
   registerToolset,
 } from '../../shared/open-service/toolset-registry.ts';
 import type { DocsAccess } from '../../shared/open-service/toolsets/docs/access.ts';
+import { createDocsToolset } from '../../shared/open-service/toolsets/docs/definition.ts';
 import type { StorybookInstanceRecord } from './instances/types.ts';
 import { runToolsCommand, type ToolsInvocation, type ToolsRunDeps } from './run.ts';
 import { invokeToolsetMethod } from '../../shared/open-service/toolset-definition.ts';
@@ -545,6 +547,84 @@ describe('dispatch', () => {
     expect(result.output).toContain('--help');
   });
 
+  it('rejects an unknown flag without calling the tool, naming it and listing the valid flags', async () => {
+    const resolve = vi.fn(DOCS_ACCESS.resolve);
+    clearToolsetRegistry();
+    registerToolset(
+      createDocsToolset({
+        sources: [
+          { source: { id: 'local', title: 'Local' }, access: { ...DOCS_ACCESS, resolve } },
+          { source: { id: 'tetra', title: 'Tetra' }, access: { ...DOCS_ACCESS, resolve } },
+        ],
+      })
+    );
+    const { deps } = makeDeps();
+
+    const result = await run(['docs', 'show', '--id', 'button', '--storybook-id', 'tetra'], deps);
+
+    expect(result.exitCode).toBe(1);
+    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'invalid-arguments' });
+    expect(result.output).toBe(`Invalid arguments for \`npx storybook tools docs show\`:
+
+- Unknown flag \`--storybook-id\`.
+
+Valid flags: \`--id\`, \`--storybookId\`.
+
+Run \`npx storybook tools docs show --help\` for the expected arguments.`);
+    expect(resolve).not.toHaveBeenCalled();
+  });
+
+  it('rejects an unknown --input key the same way', async () => {
+    const { deps } = makeDeps();
+
+    const result = await run(
+      ['docs', 'show', '--input', '{"id":"button","storybook-id":"x"}'],
+      deps
+    );
+
+    expect(result.exitCode).toBe(1);
+    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'invalid-arguments' });
+    expect(result.output).toContain('- Unknown flag `--storybook-id`.');
+    expect(result.output).toContain('Valid flags: `--id`.');
+  });
+
+  it('points a target option given after the tool name back before the toolset name', async () => {
+    const { deps } = makeDeps();
+
+    const result = await run(['docs', 'show', '--id', 'button', '--port', '6006'], deps);
+
+    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'invalid-arguments' });
+    expect(result.output).toContain(
+      'goes before the toolset name: `npx storybook tools --port <value> docs show`'
+    );
+  });
+
+  it('rejects any flag for a tool that takes no arguments', async () => {
+    const { deps } = makeDeps();
+
+    const result = await run(['stories', 'changed', '--verbose'], deps);
+
+    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'invalid-arguments' });
+    expect(result.output).toContain('- Unknown flag `--verbose`.');
+    expect(result.output).toContain('This tool takes no arguments.');
+  });
+
+  it('declares every core tool input closed, so an undeclared key never reaches a handler', async () => {
+    const composedDocs = createDocsToolset({
+      sources: [{ source: { id: 'local', title: 'Local' }, access: DOCS_ACCESS }],
+    });
+    for (const toolset of [...getRegisteredToolsets(), composedDocs]) {
+      for (const [methodName, method] of Object.entries(toolset.methods)) {
+        const validation = await method.input['~standard'].validate({ undeclared: true });
+        const keys = validation.issues?.map((issue: StandardSchemaV1.Issue) => {
+          const [segment] = issue.path ?? [];
+          return typeof segment === 'object' ? segment.key : segment;
+        });
+        expect(keys ?? [], `${toolset.id}.${methodName}`).toContain('undeclared');
+      }
+    }
+  });
+
   it('leaves the test toolset out when the project does not register it', async () => {
     // Core harness never registers addon-vitest's `test` toolset.
     registerCoreToolsetsForTest();
```

**File**: `code/core/src/cli/tools/run.ts` (modified, +31/-8)
```diff
@@ -16,6 +16,7 @@ import {
   type ToolsClientInfo,
   type ToolsHostKind,
   type ToolsMode,
+  type ToolsetJsonSchema,
 } from './sdk/index.ts';
 import {
   discoverRunningInstance,
@@ -324,7 +325,8 @@ async function dispatchTools(
   }
 
   const { methodName } = parseToolsetMethodId(method.ref);
-  const commandPath = `npx storybook tools ${entry.id} ${toCliMethodName(methodName)}`;
+  const toolPath = `${entry.id} ${toCliMethodName(methodName)}`;
+  const commandPath = `npx storybook tools ${toolPath}`;
 
   if (tools.mode === 'local' && method.requiresDevServer) {
     const discovery = await (deps.discoverInstance ?? discoverRunningInstance)(invocation.target);
@@ -352,7 +354,7 @@ async function dispatchTools(
     if (isInvalidInputError(error)) {
       return result({
         exitCode: 1,
-        output: formatValidationIssues(commandPath, error.data.issues ?? []),
+        output: formatValidationIssues(toolPath, error.data.issues ?? [], method.input),
         outcome: { kind: 'intercept', reason: 'invalid-arguments' },
       });
     }
@@ -430,18 +432,39 @@ type ValidationIssues = ReadonlyArray<{
   path?: ReadonlyArray<PropertyKey | { key?: unknown }>;
 }>;
 
-function formatValidationIssues(commandPath: string, issues: ValidationIssues): string {
+const TARGET_OPTIONS = ['cwd', 'config-dir', 'port'];
+
+function formatValidationIssues(
+  toolPath: string,
+  issues: ValidationIssues,
+  input: ToolsetJsonSchema | undefined
+): string {
+  const commandPath = `npx storybook tools ${toolPath}`;
+  const declaredKeys = input?.properties
+    ? Object.keys(input.properties as Record<string, unknown>)
+    : undefined;
+  let hasUnknownKey = false;
   const lines = issues.map((issue) => {
-    const path = issue.path
-      ?.map((segment) =>
+    const segments =
+      issue.path?.map((segment) =>
         typeof segment === 'object' && segment !== null ? String(segment.key) : String(segment)
-      )
-      .join('.');
+      ) ?? [];
+    const [key] = segments;
+    if (declaredKeys && segments.length === 1 && !declaredKeys.includes(key)) {
+      hasUnknownKey = true;
+      return TARGET_OPTIONS.includes(key)
+        ? `- Unknown flag \`--${key}\`. It selects the target Storybook, so it goes before the toolset name: \`npx storybook tools --${key} <value> ${toolPath}\`.`
+        : `- Unknown flag \`--${key}\`.`;
+    }
+    const path = segments.join('.');
     return path ? `- \`${path}\`: ${issue.message}` : `- ${issue.message}`;
   });
+  const validFlags = !declaredKeys?.length
+    ? 'This tool takes no arguments.'
+    : `Valid flags: ${declaredKeys.map((key) => `\`--${key}\``).join(', ')}.`;
   return `Invalid arguments for \`${commandPath}\`:
 
 ${lines.join('\n')}
-
+${hasUnknownKey ? `\n${validFlags}\n` : ''}
 Run \`${commandPath} --help\` for the expected arguments.`;
 }
```

**File**: `code/core/src/shared/open-service/README.md` (modified, +3/-2)
```diff
@@ -109,7 +109,8 @@ and synchronization; **toolsets** are the public agent surface for CLI and MCP a
 
 - `title` — required short display label used by client UIs and the tools CLI command list
 - `description` — `string`, or a function of `ctx` when the prose differs per transport
-- `input` — the input schema
+- `input` — the input schema; a `v.strictObject`, so a mistyped argument is an invalid-input
+  error instead of being dropped and the method running on its defaults
 - `output` — optional; published as the MCP `outputSchema`, and `structuredContent` is
   narrowed to it. Some clients (Claude Code) hand the model only `structuredContent` when a tool
   publishes it and drop the text, so the declared shape must carry everything the Markdown says,
@@ -1036,7 +1037,7 @@ type ExampleState = {
   values: Record<string, string | undefined>;
 };
 
-const entryIdSchema = v.object({ entryId: v.string() });
+const entryIdSchema = v.strictObject({ entryId: v.string() });
 const valueSchema = v.nullable(v.string());
 
 export const exampleServiceDef = defineService({
```

**File**: `code/core/src/shared/open-service/toolsets/docs/definition.ts` (modified, +5/-5)
```diff
@@ -330,11 +330,11 @@ export function createDocsToolset(options: CreateDocsToolsetOptions) {
   // A composition lets the caller name the Storybook, defaulting to this one; a single one must
   // not ask.
   const showSchema = multiSource
-    ? v.object({
+    ? v.strictObject({
         id: v.pipe(v.string(), v.description('The component or docs entry ID (e.g., "button")')),
         ...storybookIdField,
       })
-    : v.object({
+    : v.strictObject({
         id: v.pipe(v.string(), v.description('The component or docs entry ID (e.g., "button")')),
       });
 
@@ -363,8 +363,8 @@ export function createDocsToolset(options: CreateDocsToolsetOptions) {
     ),
   };
   const showStorySchema = multiSource
-    ? v.object({ ...showStoryFields, ...storybookIdField })
-    : v.object(showStoryFields);
+    ? v.strictObject({ ...showStoryFields, ...storybookIdField })
+    : v.strictObject(showStoryFields);
 
   /** The access for a lookup, plus the id it was scoped to. */
   const access = (storybookId: string | undefined, ctx: ToolsetCtx) =>
@@ -375,7 +375,7 @@ export function createDocsToolset(options: CreateDocsToolsetOptions) {
     description: 'Storybook component and docs documentation.',
     methods: {
       [DOCS_METHOD_NAMES.list]: {
-        input: v.object({
+        input: v.strictObject({
           withStoryIds: v.optional(
             v.pipe(
               v.boolean(),
```

**File**: `code/core/src/shared/open-service/toolsets/review/definition.ts` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ const reviewCollectionSchema = v.object({
   ),
 });
 
-const reviewCreateInputSchema = v.object({
+const reviewCreateInputSchema = v.strictObject({
   title: v.pipe(
     v.string(),
     v.description(
```

---

### Incident Patch 3: `cb4332d5` (2026-10-05)
**Commit Message**: fix(core): answer docs show for a private source with the own-MCP notice

docs show and show-story let RequiresOwnMcpError escape, so the tools
CLI exited 1 and reported the notice as a crash to telemetry. Treat it
as an answer, like @storybook/mcp already does: the outcome is ok and
the notice is carried in the output's notice field.

Refs SB-2125

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `code/core/src/shared/open-service/toolsets/docs/definition.test.ts` (modified, +44/-0)
```diff
@@ -3,6 +3,7 @@ import { describe, expect, it } from 'vitest';
 import { invokeToolsetMethod, type ToolsetCtx } from '../../toolset-definition.ts';
 import type { DocsAccess } from './access.ts';
 import { createDocsToolset } from './definition.ts';
+import { RequiresOwnMcpError } from './sources.ts';
 
 const button = {
   id: 'button',
@@ -271,6 +272,49 @@ describe('docs.showStory in a composition', () => {
   });
 });
 
+describe('a composed source that requires its own MCP', () => {
+  const privateSource = { id: 'private', title: 'Private', url: 'https://private.example.com' };
+  const composed = createDocsToolset({
+    sources: [
+      { source: { id: 'local', title: 'Local' }, access: docsAccess },
+      {
+        source: privateSource,
+        access: {
+          list: () => Promise.reject(new RequiresOwnMcpError(privateSource)),
+          resolve: () => Promise.reject(new RequiresOwnMcpError(privateSource)),
+        },
+      },
+    ],
+  });
+  const notice = `# Private
+id: private
+
+This composed Storybook is private and cannot be read through the local Storybook MCP proxy.
+
+Use this source's own MCP endpoint instead:
+https://private.example.com/mcp`;
+
+  it('answers show with the own-MCP notice', async () => {
+    const outcome = await composed.methods.show.handler(
+      { id: 'button', storybookId: 'private' },
+      cliCtx
+    );
+
+    expect(outcome.ok).toBe(true);
+    expect(outcome.markdown).toBe(notice);
+  });
+
+  it('answers showStory with the own-MCP notice', async () => {
+    const outcome = await composed.methods.showStory.handler(
+      { storyId: 'button--primary', storybookId: 'private' },
+      cliCtx
+    );
+
+    expect(outcome.ok).toBe(true);
+    expect(outcome.markdown).toBe(notice);
+  });
+});
+
 describe('usage reporting', () => {
   async function run(methodName: 'list' | 'show' | 'showStory', input: unknown) {
     return (await invokeToolsetMethod(toolset, methodName, input, mcpCtx)).telemetry;
```

**File**: `code/core/src/shared/open-service/toolsets/docs/definition.ts` (modified, +40/-10)
```diff
@@ -13,7 +13,7 @@ import {
 } from './manifest-formatter/markdown.ts';
 import type { AllManifests } from './manifest-formatter/manifest-types.ts';
 import { listSources, type DocsSource } from './multi-source.ts';
-import type { SourceListing } from './sources.ts';
+import { RequiresOwnMcpError, type SourceListing } from './sources.ts';
 import { estimateTokens } from '../estimate-tokens.ts';
 
 const DOCS_TOOLSET_ID = 'docs';
@@ -61,6 +61,8 @@ export type DocsShowOutput = {
   storybookId?: string;
   /** Set when the request named no source, or one that does not exist. */
   sourceError?: string;
+  /** Set when the named source can only be read through its own MCP endpoint. */
+  notice?: string;
 };
 
 export type DocsShowStoryOutput = {
@@ -70,6 +72,7 @@ export type DocsShowStoryOutput = {
   entry?: ResolvedDocsEntry;
   storybookId?: string;
   sourceError?: string;
+  notice?: string;
 };
 
 /**
@@ -92,13 +95,17 @@ export function selectReportedManifests({
  */
 type ShowResolution =
   | { kind: 'source-error'; message: string }
+  | { kind: 'notice'; message: string }
   | { kind: 'entry-missing' }
   | { kind: 'found'; entry: ResolvedDocsEntry };
 
-function resolveShow({ entry, sourceError }: DocsShowOutput): ShowResolution {
+function resolveShow({ entry, sourceError, notice }: DocsShowOutput): ShowResolution {
   if (sourceError !== undefined) {
     return { kind: 'source-error', message: sourceError };
   }
+  if (notice !== undefined) {
+    return { kind: 'notice', message: notice };
+  }
   if (entry === undefined) {
     return { kind: 'entry-missing' };
   }
@@ -112,6 +119,7 @@ type ComponentStory = NonNullable<ComponentEntry['component']['stories']>[number
 type ShowStoryResolution =
   | { kind: 'input-invalid' }
   | { kind: 'source-error'; message: string }
+  | { kind: 'notice'; message: string }
   | { kind: 'component-missing' }
   | { kind: 'story-missing'; component: ComponentEntry['component'] }
   | { kind: 'found'; component: ComponentEntry['component']; story: ComponentStory };
@@ -132,13 +140,16 @@ function componentIdOfStoryId(storyId: string): string {
 }
 
 function resolveShowStory(data: DocsShowStoryOutput): ShowStoryResolution {
-  const { entry, storyId, storyName, sourceError } = data;
+  const { entry, storyId, storyName, sourceError, notice } = data;
   if (!isShowStorySelector(data)) {
     return { kind: 'input-invalid' };
   }
   if (sourceError !== undefined) {
     return { kind: 'source-error', message: sourceError };
   }
+  if (notice !== undefined) {
+    return { kind: 'notice', message: notice };
+  }
   if (entry === undefined || entry.kind !== 'component') {
     return { kind: 'component-missing' };
   }
@@ -157,12 +168,14 @@ function resolveShowStory(data: DocsShowStoryOutput): ShowStoryResolution {
  * the frozen `@storybook/mcp` API.
  */
 export function isDocsShowError(output: DocsShowOutput): boolean {
-  return resolveShow(output).kind !== 'found';
+  const { kind } = resolveShow(output);
+  return kind !== 'found' && kind !== 'notice';
 }
 
 /** Whether `docs.showStory` failed: an unusable source, a missing component, or a missing story. */
 export function isDocsShowStoryError(output: DocsShowStoryOutput): boolean {
-  return resolveShowStory(output).kind !== 'found';
+  const { kind } = resolveShowStory(output);
+  return kind !== 'found' && kind !== 'notice';
 }
 
 function describeList(ctx: ToolsetCtx): string {
@@ -188,6 +201,7 @@ function renderShow(data: DocsShowOutput, ctx: ToolsetCtx): string {
   const resolution = resolveShow(data);
   switch (resolution.kind) {
     case 'source-error':
+    case 'notice':
       return resolution.message;
     case 'entry-missing':
       return formatEntryNotFound(data.id, data.storybookId, ctx);
@@ -220,6 +234,7 @@ function renderShowStory(
     case 'input-invalid':
       return `Provide either \`storyId\`, or both \`componentId\` and \`storyName\`. Story ids are listed by the ${getToolName(ctx)(DOCS_METHOD_REFS.list)} tool with \`withStoryIds: true\` and in ${getToolName(ctx)(DOCS_METHOD_REFS.show)} output.`;
     case 'source-error':
+    case 'notice':
       return resolution.message;
     case 'component-missing':
       return data.storyId !== undefined
@@ -252,6 +267,21 @@ const storybookIdField = {
   ),
 };
 
+// A source that needs its own MCP is an answer to route the agent, not a failed lookup.
+async function resolveFromSource(
+  access: DocsAccess,
+  id: string
+): Promise<Pick<DocsShowOutput, 'entry' | 'notice'>> {
+  try {
+    return { entry: await access.resolve(id) };
+  } catch (error) {
+    if (error instanceof RequiresOwnMcpError) {
+      return { notice: error.message };
+    }
+    throw error;
+  }
+}
+
 /**
  * Picks the access for a lookup, or explains which source the caller should have named.
  *
@@ -398,7 +428,7 @@ export function createDocsToolset(options: CreateDocsToolsetOptions) {
           const selected = access(storybookId, ctx);
           const da
```

---

### Incident Patch 4: `04da5a5b` (2026-10-05)
**Commit Message**: fix(core): point the tools CLI at a private composed Storybook's own MCP

A composed ref answering 401 to the tools CLI rendered a bare
"Failed to fetch manifest: 401 Unauthorized" error section. Throw
RequiresOwnMcpError instead, so docs list, show and show-story print
the own-MCP notice that `storybook ai` used to show.

Refs SB-2125

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `code/core/src/shared/open-service/toolsets/docs/access-provider.test.ts` (modified, +17/-0)
```diff
@@ -712,6 +712,23 @@ describe('sourceUrlManifestProvider', () => {
       { signal: expect.any(AbortSignal) }
     );
   });
+
+  it('lists a source that answers 401 as a notice pointing at its own MCP endpoint', async () => {
+    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 401 }));
+
+    const [listing] = await listSources(
+      createCompositionDocsSources({
+        sources: [source],
+        manifestProvider: sourceUrlManifestProvider,
+      }),
+      { withStoryIds: false }
+    );
+
+    expect(listing).toEqual({
+      source,
+      notice: { kind: 'requires-own-mcp', endpoint: 'https://ds.example.com/sub/mcp' },
+    });
+  });
 });
 
 describe('resolveComponentEntry', () => {
```

**File**: `code/core/src/shared/open-service/toolsets/docs/access-provider.ts` (modified, +4/-1)
```diff
@@ -81,7 +81,7 @@ async function defaultManifestProvider(
 }
 
 // For a composition assembled at boot rather than per request (the docs toolset core registers
-// for the tools CLI): no request, no credentials, so a private source lands in its own error section.
+// for the tools CLI): no request, no credentials, so a private source points at its own MCP.
 export const sourceUrlManifestProvider: ManifestProvider = async (_request, path, source) => {
   if (!source?.url) {
     throw new ManifestGetError('The local source has no URL to fetch manifests from.');
@@ -92,6 +92,9 @@ export const sourceUrlManifestProvider: ManifestProvider = async (_request, path
   const response = await fetch(manifestUrl, {
     signal: AbortSignal.timeout(REF_MANIFEST_FETCH_TIMEOUT_MS),
   });
+  if (response.status === 401) {
+    throw new RequiresOwnMcpError({ ...source, url: source.url });
+  }
   return readManifestText(response, manifestUrl);
 };
 
```

**File**: `code/core/src/shared/open-service/toolsets/docs/sources.ts` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ export class RequiresOwnMcpError extends Error {
 
   constructor(source: SourceWithUrl) {
     const endpoint = getSourceMcpEndpoint(source);
-    super(`Composed Storybook "${source.title}" requires its own MCP endpoint: ${endpoint}`);
+    super(formatRequiresOwnMcpNotice(source, endpoint));
     this.name = 'RequiresOwnMcpError';
     this.source = source;
     this.endpoint = endpoint;
```

---

### Incident Patch 5: `32ede1a5` (2026-10-05)
**Commit Message**: fix(cli): hint target options, reject --__proto__, name --input keys

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `code/core/src/cli/tools/README.md` (modified, +4/-2)
```diff
@@ -65,8 +65,10 @@ be combined. `requiresDevServer` is a **local-mode intercept** only: when attach
 run caller-side (`stories.preview` reads `origin` from the instance record).
 
 Tool arguments are `--key value` flags spelled exactly like the input schema keys (camelCase, e.g.
-`--storybookId`); there are no kebab-case aliases. A flag or `--input` key the schema does not
-declare fails the run with the valid flags listed, before the tool is called.
+`--storybookId`); there are no kebab-case aliases. A flag or `--input` key that an object input
+schema does not declare fails the run with the valid flags listed, before the tool is called.
+Schemas that admit extra keys (`looseObject`, `objectWithRest`) or have no object root are not
+checked.
 
 `docs` honours the project's `refs`: with composed Storybooks, `docs list` prints one section per
 source and `docs show` / `docs show-story` take `--storybookId`, which defaults to `local`. Remote
```

**File**: `code/core/src/cli/tools/run.test.ts` (modified, +21/-1)
```diff
@@ -584,7 +584,27 @@ Run \`npx storybook tools docs show --help\` for the expected arguments.`);
     expect(result.exitCode).toBe(1);
     expect(result.outcome).toEqual({ kind: 'intercept', reason: 'invalid-arguments' });
     expect(result.output).toContain('- Unknown key `storybook-id` in `--input`.');
-    expect(result.output).toContain('Valid flags: `--id`.');
+    expect(result.output).toContain('Valid keys: `id`.');
+  });
+
+  it('points a target option given after the tool name back before the toolset name', async () => {
+    const { deps } = makeDeps();
+
+    const result = await run(['docs', 'show', '--id', 'button', '--port', '6006'], deps);
+
+    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'invalid-arguments' });
+    expect(result.output).toContain(
+      'goes before the toolset name: `npx storybook tools --port <value> docs show`'
+    );
+  });
+
+  it('rejects a `--__proto__` flag instead of dropping it', async () => {
+    const { deps } = makeDeps();
+
+    const result = await run(['docs', 'show', '--id', 'button', '--__proto__', '{"a":1}'], deps);
+
+    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'invalid-arguments' });
+    expect(result.output).toContain('- Unknown flag `--__proto__`.');
   });
 
   it('leaves the test toolset out when the project does not register it', async () => {
```

**File**: `code/core/src/cli/tools/run.ts` (modified, +33/-19)
```diff
@@ -328,15 +328,20 @@ async function dispatchTools(
   const commandPath = `npx storybook tools ${entry.id} ${toCliMethodName(methodName)}`;
 
   const acceptedKeys = acceptedArgumentKeys(method.input);
-  const unknownKeys = acceptedKeys
-    ? Object.keys(parsed.args).filter((key) => !acceptedKeys.includes(key))
-    : [];
-  if (acceptedKeys && unknownKeys.length > 0) {
-    return result({
-      exitCode: 1,
-      output: formatUnknownArguments(commandPath, unknownKeys, parsed.flagKeys, acceptedKeys),
-      outcome: { kind: 'intercept', reason: 'invalid-arguments' },
-    });
+  if (acceptedKeys) {
+    const unknownKeys = Object.keys(parsed.args).filter((key) => !acceptedKeys.includes(key));
+    if (unknownKeys.length > 0) {
+      return result({
+        exitCode: 1,
+        output: formatUnknownArguments(
+          `${entry.id} ${toCliMethodName(methodName)}`,
+          unknownKeys,
+          parsed.flagKeys,
+          acceptedKeys
+        ),
+        outcome: { kind: 'intercept', reason: 'invalid-arguments' },
+      });
+    }
   }
 
   if (tools.mode === 'local' && method.requiresDevServer) {
@@ -438,31 +443,40 @@ function formatRequiresDevServer(
   return lines.join('\n');
 }
 
-// `undefined` means any key may be valid: the schema has no JSON Schema form, or it admits extra
-// keys. An absent `additionalProperties` counts as closed because valibot's `object` converts that
-// way and drops the keys it does not declare.
+// Absent `additionalProperties` counts as closed: valibot's `object` converts that way and drops
+// undeclared keys.
 function acceptedArgumentKeys(schema: ToolsetJsonSchema | undefined): string[] | undefined {
   if (schema?.type !== 'object' || (schema.additionalProperties ?? false) !== false) {
     return undefined;
   }
   return Object.keys((schema.properties as Record<string, unknown> | undefined) ?? {});
 }
 
+const TARGET_OPTIONS = ['cwd', 'config-dir', 'port'];
+
 function formatUnknownArguments(
-  commandPath: string,
+  toolPath: string,
   unknownKeys: string[],
   flagKeys: string[],
   acceptedKeys: string[]
 ): string {
-  const lines = unknownKeys.map((key) =>
-    flagKeys.includes(key)
-      ? `- Unknown flag \`--${key}\`.`
-      : `- Unknown key \`${key}\` in \`--input\`.`
-  );
+  const commandPath = `npx storybook tools ${toolPath}`;
+  const lines = unknownKeys.map((key) => {
+    if (!flagKeys.includes(key)) {
+      return `- Unknown key \`${key}\` in \`--input\`.`;
+    }
+    if (TARGET_OPTIONS.includes(key)) {
+      return `- Unknown flag \`--${key}\`. It selects the target Storybook, so it goes before the toolset name: \`npx storybook tools --${key} <value> ${toolPath}\`.`;
+    }
+    return `- Unknown flag \`--${key}\`.`;
+  });
+  const onlyInputKeys = unknownKeys.every((key) => !flagKeys.includes(key));
   const accepted =
     acceptedKeys.length === 0
       ? 'This tool takes no arguments.'
-      : `Valid flags: ${acceptedKeys.map((key) => `\`--${key}\``).join(', ')}.`;
+      : onlyInputKeys
+        ? `Valid keys: ${acceptedKeys.map((key) => `\`${key}\``).join(', ')}.`
+        : `Valid flags: ${acceptedKeys.map((key) => `\`--${key}\``).join(', ')}.`;
   return `Invalid arguments for \`${commandPath}\`:
 
 ${lines.join('\n')}
```

**File**: `code/core/src/cli/tools/sdk/json-schema.ts` (modified, +1/-2)
```diff
@@ -21,8 +21,7 @@ export function toToolsetJsonSchema(schema: StandardSchemaV1): ToolsetJsonSchema
   try {
     return toJsonSchema(schema as never, {
       errorMode: 'ignore',
-      // `looseObject` converts exactly like `object`, which drops undeclared keys; mark it open so
-      // the tools CLI forwards its extra keys instead of rejecting them.
+      // `looseObject` otherwise converts exactly like `object`, which the tools CLI treats as closed.
       overrideSchema: ({ valibotSchema, jsonSchema }) =>
         valibotSchema.type === 'loose_object'
           ? { ...jsonSchema, additionalProperties: true }
```

**File**: `code/core/src/cli/tools/tool-tokens.ts` (modified, +2/-1)
```diff
@@ -53,7 +53,8 @@ export function parseToolsTokens(
   let json = defaults.json ?? false;
   let output = defaults.output;
   let attach = defaults.attach;
-  const flagArgs: Record<string, unknown> = {};
+  // Null prototype so `--__proto__` lands as an own key instead of replacing the prototype.
+  const flagArgs: Record<string, unknown> = Object.create(null);
 
   let i = 0;
   while (i < tokens.length) {
```

---

### Incident Patch 6: `ed9b668f` (2026-10-05)
**Commit Message**: fix(core): cap a change's mtime at its arrival and stat every change

A future mtime could otherwise date every later change after a review. Removals
reconciled from the story index can concern files that still exist, so only a
failed stat falls back to the arrival time.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `code/core/src/shared/open-service/services/module-graph/definition.ts` (modified, +2/-4)
```diff
@@ -155,7 +155,7 @@ export const moduleGraphServiceDef = defineService({
     },
     graphChangedAt: {
       description:
-        'Newest modification time (unix ms) among the file changes that advanced `graphRevision`, 0 before the first one. Dates a change by the file itself, so a builder that reports an edit late cannot make it look newer than it is.',
+        "Newest time (unix ms) a file change that advanced `graphRevision` was made, 0 before the first one. Dated by the file's modification time where possible, so a builder that reports an edit late cannot make it look newer than it is.",
       input: noInputSchema,
       output: v.number(),
       handler: (_input, ctx) => ctx.self.state.graphChangedAt,
@@ -269,9 +269,7 @@ export const moduleGraphServiceDef = defineService({
         changedAt: v.optional(
           v.pipe(
             v.number(),
-            v.description(
-              'Modification time (unix ms) of the changed file. Defaults to now when unknown.'
-            )
+            v.description('When (unix ms) the change was made. Defaults to now when unknown.')
           )
         ),
       }),
```

**File**: `code/core/src/shared/open-service/services/module-graph/engine/module-graph-engine.test.ts` (modified, +5/-1)
```diff
@@ -264,7 +264,7 @@ describe('ModuleGraphEngine', () => {
     expect(callbacks.onBump).toHaveBeenCalledWith(['./src/B.stories.tsx'], expect.any(Number));
   });
 
-  it('dates a bump by the file mtime, or by when the event arrived for a removal', async () => {
+  it('dates a bump by the file mtime, capped at when the event arrived, which also dates a deleted file', async () => {
     const story = '/repo/src/B.stories.tsx';
     const { patchSpy } = installDependencyGraphMocks(buildReverseIndex([[story, story, 0]]));
     const { service, adapter, emitFileChange, callbacks } = setup({
@@ -281,11 +281,15 @@ describe('ModuleGraphEngine', () => {
     vi.mocked(stat).mockResolvedValueOnce({ mtimeMs: 40_000 } as Awaited<ReturnType<typeof stat>>);
     emitFileChange({ kind: 'change', path: story });
     await vi.runAllTimersAsync();
+    vi.mocked(stat).mockResolvedValueOnce({ mtimeMs: 60_000 } as Awaited<ReturnType<typeof stat>>);
+    emitFileChange({ kind: 'change', path: story });
+    await vi.runAllTimersAsync();
     emitFileChange({ kind: 'unlink', path: story });
     await vi.runAllTimersAsync();
 
     expect(callbacks.onBump).toHaveBeenNthCalledWith(1, ['./src/B.stories.tsx'], 40_000);
     expect(callbacks.onBump).toHaveBeenNthCalledWith(2, ['./src/B.stories.tsx'], 50_000);
+    expect(callbacks.onBump).toHaveBeenNthCalledWith(3, ['./src/B.stories.tsx'], 50_000);
   });
 
   it('buffers file events emitted during the build and applies them in order after build resolves', async () => {
```

**File**: `code/core/src/shared/open-service/services/module-graph/engine/module-graph-engine.ts` (modified, +9/-9)
```diff
@@ -37,7 +37,8 @@ export interface ModuleGraphEngineOptions {
   /**
    * Fired after every settled file-change patch. Empty `bumpedStoryFiles` means the path was
    * out of graph: `fileActivityRevision` still advances so change detection can rescan git.
-   * `changedAt` is the changed file's modification time, or when the event arrived for a removal.
+   * `changedAt` is the changed file's modification time, capped at when the event arrived, or the
+   * arrival time for a deleted file.
    */
   onBump?: (bumpedStoryFiles: string[], changedAt: number) => void | Promise<void>;
 }
@@ -400,14 +401,13 @@ export class ModuleGraphEngine {
       return;
     }
     // Builders can report an edit long after it happened (webpack holds edits made during a
-    // compile until it finishes), so the file's own mtime dates the change.
-    const changedAt =
-      event.kind === 'unlink'
-        ? receivedAt
-        : await stat(event.path).then(
-            (stats) => stats.mtimeMs,
-            () => receivedAt
-          );
+    // compile until it finishes), so the file's own mtime dates the change. A future mtime (clock
+    // skew, `touch -d`) is capped at arrival so it cannot date every later change after a review.
+    // A deleted file has no mtime, so its arrival dates it.
+    const changedAt = await stat(event.path).then(
+      (stats) => Math.min(stats.mtimeMs, receivedAt),
+      () => receivedAt
+    );
     const prePatchBumped = this.collectBumpedStoryFiles(event.path);
     const revisionBefore = this.reverseIndex.revision;
     try {
```

**File**: `code/core/src/shared/open-service/services/module-graph/types.ts` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ export type ModuleGraphServiceState = {
   workingDir: string;
   status: ModuleGraphStatus;
   graphRevision: number;
-  /** Newest modification time (unix ms) among the file changes that advanced {@link graphRevision}. */
+  /** Newest time (unix ms) a file change that advanced {@link graphRevision} was made. */
   graphChangedAt: number;
   /**
    * Monotonic counter advanced on every processed file-change event, including out-of-graph
```

**File**: `code/core/src/shared/open-service/services/review/definition.ts` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ export const reviewServiceDef = defineService({
     },
     bannerKind: {
       description:
-        'Returns which attention banner review surfaces should show: pending-update outranks stale (accepting the update supersedes the warning); null when neither applies.',
+        'Returns which attention banner review surfaces should show: pending-update outranks stale, and once accepted the banner reflects the staleness of the accepted review; null when neither applies.',
       input: v.undefined(),
       output: v.nullable(v.picklist(['pending-update', 'stale'])),
       handler: (_input, ctx) =>
```

---

### Incident Patch 7: `8040311e` (2026-10-05)
**Commit Message**: fix(cli): reject unknown flags in storybook tools

A flag or --input key the tool's input schema does not declare was
stripped by valibot, so the call ran on defaults and returned a
plausible but wrong answer (e.g. --storybook-id instead of
--storybookId). Reject it as invalid arguments before the tool runs,
naming the unknown keys and listing the valid flags.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `code/core/src/cli/tools/README.md` (modified, +4/-0)
```diff
@@ -64,6 +64,10 @@ set). `--json` keeps only the tool result.
 be combined. `requiresDevServer` is a **local-mode intercept** only: when attached, those methods
 run caller-side (`stories.preview` reads `origin` from the instance record).
 
+Tool arguments are `--key value` flags spelled exactly like the input schema keys (camelCase, e.g.
+`--storybookId`); there are no kebab-case aliases. A flag or `--input` key the schema does not
+declare fails the run with the valid flags listed, before the tool is called.
+
 `docs` honours the project's `refs`: with composed Storybooks, `docs list` prints one section per
 source and `docs show` / `docs show-story` take `--storybookId`, which defaults to `local`. Remote
 manifests are fetched without credentials and with a 3 second timeout in every mode; a ref that
```

**File**: `code/core/src/cli/tools/run.test.ts` (modified, +72/-0)
```diff
@@ -19,6 +19,7 @@ import {
   registerToolset,
 } from '../../shared/open-service/toolset-registry.ts';
 import type { DocsAccess } from '../../shared/open-service/toolsets/docs/access.ts';
+import { createDocsToolset } from '../../shared/open-service/toolsets/docs/definition.ts';
 import type { StorybookInstanceRecord } from './instances/types.ts';
 import { runToolsCommand, type ToolsInvocation, type ToolsRunDeps } from './run.ts';
 import { invokeToolsetMethod } from '../../shared/open-service/toolset-definition.ts';
@@ -545,6 +546,47 @@ describe('dispatch', () => {
     expect(result.output).toContain('--help');
   });
 
+  it('rejects an unknown flag without calling the tool, naming it and listing the valid flags', async () => {
+    const resolve = vi.fn(DOCS_ACCESS.resolve);
+    clearToolsetRegistry();
+    registerToolset(
+      createDocsToolset({
+        sources: [
+          { source: { id: 'local', title: 'Local' }, access: { ...DOCS_ACCESS, resolve } },
+          { source: { id: 'tetra', title: 'Tetra' }, access: { ...DOCS_ACCESS, resolve } },
+        ],
+      })
+    );
+    const { deps } = makeDeps();
+
+    const result = await run(['docs', 'show', '--id', 'button', '--storybook-id', 'tetra'], deps);
+
+    expect(result.exitCode).toBe(1);
+    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'invalid-arguments' });
+    expect(result.output).toBe(`Invalid arguments for \`npx storybook tools docs show\`:
+
+- Unknown flag \`--storybook-id\`.
+
+Valid flags: \`--id\`, \`--storybookId\`.
+
+Run \`npx storybook tools docs show --help\` for the expected arguments.`);
+    expect(resolve).not.toHaveBeenCalled();
+  });
+
+  it('rejects an unknown --input key the same way', async () => {
+    const { deps } = makeDeps();
+
+    const result = await run(
+      ['docs', 'show', '--input', '{"id":"button","storybook-id":"x"}'],
+      deps
+    );
+
+    expect(result.exitCode).toBe(1);
+    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'invalid-arguments' });
+    expect(result.output).toContain('- Unknown key `storybook-id` in `--input`.');
+    expect(result.output).toContain('Valid flags: `--id`.');
+  });
+
   it('leaves the test toolset out when the project does not register it', async () => {
     // Core harness never registers addon-vitest's `test` toolset.
     registerCoreToolsetsForTest();
@@ -697,6 +739,16 @@ describe('outcome mapping', () => {
               throw error;
             },
           },
+          loose: {
+            title: 'loose',
+            input: v.looseObject({ a: v.optional(v.number()) }),
+            description: 'loose echo',
+            handler: async (input: Record<string, unknown>) => ({
+              ok: true,
+              data: input,
+              markdown: JSON.stringify(input),
+            }),
+          },
           input: {
             title: 'input',
             input: v.object({ a: v.optional(v.number()), b: v.optional(v.number()) }),
@@ -754,6 +806,26 @@ describe('outcome mapping', () => {
     });
   });
 
+  it('rejects any flag for a tool that takes no arguments', async () => {
+    const { deps } = makeDeps();
+
+    const result = await run(['echo', 'ok', '--a', '1'], deps);
+
+    expect(result.exitCode).toBe(1);
+    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'invalid-arguments' });
+    expect(result.output).toContain('- Unknown flag `--a`.');
+    expect(result.output).toContain('This tool takes no arguments.');
+  });
+
+  it('forwards undeclared keys to a tool whose schema admits them', async () => {
+    const { deps } = makeDeps();
+
+    const result = await run(['echo', 'loose', '--a', '1', '--extra', 'x', '--json'], deps);
+
+    expect(result.outcome).toEqual({ kind: 'success' });
+    expect(JSON.parse(result.output)).toEqual({ a: 1, extra: 'x' });
+  });
+
   it('merges --input with individual flags, flags winning', async () => {
     const { deps } = makeDeps();
 
```

**File**: `code/core/src/cli/tools/run.ts` (modified, +47/-0)
```diff
@@ -16,6 +16,7 @@ import {
   type ToolsClientInfo,
   type ToolsHostKind,
   type ToolsMode,
+  type ToolsetJsonSchema,
 } from './sdk/index.ts';
 import {
   discoverRunningInstance,
@@ -326,6 +327,18 @@ async function dispatchTools(
   const { methodName } = parseToolsetMethodId(method.ref);
   const commandPath = `npx storybook tools ${entry.id} ${toCliMethodName(methodName)}`;
 
+  const acceptedKeys = acceptedArgumentKeys(method.input);
+  const unknownKeys = acceptedKeys
+    ? Object.keys(parsed.args).filter((key) => !acceptedKeys.includes(key))
+    : [];
+  if (acceptedKeys && unknownKeys.length > 0) {
+    return result({
+      exitCode: 1,
+      output: formatUnknownArguments(commandPath, unknownKeys, parsed.flagKeys, acceptedKeys),
+      outcome: { kind: 'intercept', reason: 'invalid-arguments' },
+    });
+  }
+
   if (tools.mode === 'local' && method.requiresDevServer) {
     const discovery = await (deps.discoverInstance ?? discoverRunningInstance)(invocation.target);
     return result({
@@ -425,6 +438,40 @@ function formatRequiresDevServer(
   return lines.join('\n');
 }
 
+// `undefined` means any key may be valid: the schema has no JSON Schema form, or it admits extra
+// keys. An absent `additionalProperties` counts as closed because valibot's `object` converts that
+// way and drops the keys it does not declare.
+function acceptedArgumentKeys(schema: ToolsetJsonSchema | undefined): string[] | undefined {
+  if (schema?.type !== 'object' || (schema.additionalProperties ?? false) !== false) {
+    return undefined;
+  }
+  return Object.keys((schema.properties as Record<string, unknown> | undefined) ?? {});
+}
+
+function formatUnknownArguments(
+  commandPath: string,
+  unknownKeys: string[],
+  flagKeys: string[],
+  acceptedKeys: string[]
+): string {
+  const lines = unknownKeys.map((key) =>
+    flagKeys.includes(key)
+      ? `- Unknown flag \`--${key}\`.`
+      : `- Unknown key \`${key}\` in \`--input\`.`
+  );
+  const accepted =
+    acceptedKeys.length === 0
+      ? 'This tool takes no arguments.'
+      : `Valid flags: ${acceptedKeys.map((key) => `\`--${key}\``).join(', ')}.`;
+  return `Invalid arguments for \`${commandPath}\`:
+
+${lines.join('\n')}
+
+${accepted}
+
+Run \`${commandPath} --help\` for the expected arguments.`;
+}
+
 type ValidationIssues = ReadonlyArray<{
   message: string;
   path?: ReadonlyArray<PropertyKey | { key?: unknown }>;
```

**File**: `code/core/src/cli/tools/sdk/json-schema.ts` (modified, +9/-1)
```diff
@@ -19,7 +19,15 @@ export function toToolsetJsonSchema(schema: StandardSchemaV1): ToolsetJsonSchema
     return undefined;
   }
   try {
-    return toJsonSchema(schema as never, { errorMode: 'ignore' }) as ToolsetJsonSchema;
+    return toJsonSchema(schema as never, {
+      errorMode: 'ignore',
+      // `looseObject` converts exactly like `object`, which drops undeclared keys; mark it open so
+      // the tools CLI forwards its extra keys instead of rejecting them.
+      overrideSchema: ({ valibotSchema, jsonSchema }) =>
+        valibotSchema.type === 'loose_object'
+          ? { ...jsonSchema, additionalProperties: true }
+          : undefined,
+    }) as ToolsetJsonSchema;
   } catch {
     return undefined;
   }
```

**File**: `code/core/src/cli/tools/tool-tokens.test.ts` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@ describe('parseToolsTokens', () => {
       output: undefined,
       attach: undefined,
       args: { maxDistance: 2, name: 'button' },
+      flagKeys: ['maxDistance', 'name'],
     });
   });
 
```

**File**: `code/core/src/cli/tools/tool-tokens.ts` (modified, +11/-1)
```diff
@@ -23,6 +23,8 @@ export type ParsedToolsTokens =
       /** `true` from `--attach`, `false` from `--no-attach`. */
       attach?: boolean;
       args: Record<string, unknown>;
+      /** The keys of `args` given as `--key` flags; the rest came from `--input`. */
+      flagKeys: string[];
     }
   | { ok: false; error: string };
 
@@ -161,7 +163,15 @@ export function parseToolsTokens(
     inputArgs = parsed as Record<string, unknown>;
   }
 
-  return { ok: true, help, json, output, attach, args: { ...inputArgs, ...flagArgs } };
+  return {
+    ok: true,
+    help,
+    json,
+    output,
+    attach,
+    args: { ...inputArgs, ...flagArgs },
+    flagKeys: Object.keys(flagArgs),
+  };
 }
 
 /**
```

---

### Incident Patch 8: `6d573b0a` (2026-10-05)
**Commit Message**: fix(core): let experimental_devServer await services itself

Instead of only failing on the wrong order, experimental_devServer now awaits
applyServicesPresetOnce, so services always completes first whatever the boot
code does. The missing-queue error stays as a backstop for a services run that
did not fill this module's queue.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `.agents/guidelines/architecture.md` (modified, +2/-2)
```diff
@@ -90,8 +90,8 @@ the fields to change and provide migration-specific error guidance.
 - Register services and toolsets from the same `services` preset hook and behind the same feature
   gate. Missing or duplicate registrations fail loudly.
 - The tools CLI applies `services` too, so subscriptions that execute commands start from
-  `experimental_devServer`, not at registration. `experimental_devServer` throws if `services` has
-  not completed. See "Server Registration Flow" in the open-service README.
+  `experimental_devServer`, not at registration. `experimental_devServer` awaits `services` itself
+  and throws if the queue is still missing. See "Server Registration Flow" in the open-service README.
 - The tools CLI consumes `storybook/internal/tools` (`createTools`). Default mode is
   attach-preferred (`auto`): join a running instance as a delegated leaf, or load locally on gate
   failure. `--attach` requires attachment; `--no-attach` forces local. When several running
```

**File**: `code/core/src/core-server/build-dev.ts` (modified, +0/-1)
```diff
@@ -282,7 +282,6 @@ export async function buildDevStandalone(
   const features = await presets.apply('features');
   global.FEATURES = features;
 
-  // `storybookDevServer` applies `experimental_devServer`, which starts the subscriptions queued here.
   await applyServicesPresetOnce(presets);
   await presets.apply('experimental_serverChannel', channel);
 
```

**File**: `code/core/src/core-server/presets/common-preset.ts` (modified, +9/-4)
```diff
@@ -32,7 +32,7 @@ import {
 } from 'storybook/internal/types';
 
 import {
-  OpenServiceDevServerBeforeServicesError,
+  OpenServiceDevServerSubscriptionsMissingError,
   OpenServiceServicesAppliedTwiceError,
 } from '../../server-errors.ts';
 import {
@@ -59,6 +59,7 @@ import { createStoriesToolset } from '../../shared/open-service/toolsets/stories
 import { GitDiffProvider } from '../change-detection/GitDiffProvider.ts';
 import { getChangeDetectionReadiness } from '../change-detection/readiness.ts';
 import { getStatusStoreByTypeId } from '../stores/status.ts';
+import { applyServicesPresetOnce } from '../utils/apply-services-preset-once.ts';
 import { getPreviewBuilder } from '../utils/get-builders.ts';
 import { getRefsFromConfig } from '../utils/get-refs-from-config.ts';
 import { loadManifests } from '../utils/manifests/manifests.ts';
@@ -375,7 +376,7 @@ async function getHeadlessChangeDetectionAdapter(options: Options) {
 }
 
 // Started from `experimental_devServer`: the attached tools CLI also applies `services`.
-// Set only when `services` completes, so `experimental_devServer` fails if it runs first or mid-flight.
+// Set only when `services` completes; `experimental_devServer` awaits that and fails loudly if unset.
 let devServerSubscriptions: Array<() => void> | undefined;
 
 globalThis.STORYBOOK_SERVICES_LOADED = globalThis.STORYBOOK_SERVICES_LOADED ?? false;
@@ -497,9 +498,13 @@ export const services = async (_value: void, options: Options): Promise<void> =>
   devServerSubscriptions = subscriptions;
 };
 
-export const experimental_devServer: PresetPropertyFn<'experimental_devServer'> = async (app) => {
+export const experimental_devServer: PresetPropertyFn<'experimental_devServer'> = async (
+  app,
+  options
+) => {
+  await applyServicesPresetOnce(options.presets);
   if (!devServerSubscriptions) {
-    throw new OpenServiceDevServerBeforeServicesError();
+    throw new OpenServiceDevServerSubscriptionsMissingError();
   }
   for (const subscribe of devServerSubscriptions.splice(0)) {
     subscribe();
```

**File**: `code/core/src/core-server/presets/dev-server-subscriptions.test.ts` (modified, +39/-18)
```diff
@@ -23,21 +23,27 @@ const index = {
 
 let now: number;
 let options: Options;
+let servicesHook: () => Promise<void>;
 let services: typeof import('./common-preset.ts').services;
 let experimental_devServer: typeof import('./common-preset.ts').experimental_devServer;
-let OpenServiceDevServerBeforeServicesError: typeof import('../../server-errors.ts').OpenServiceDevServerBeforeServicesError;
+let applyServicesPresetOnce: typeof import('../utils/apply-services-preset-once.ts').applyServicesPresetOnce;
+let OpenServiceDevServerSubscriptionsMissingError: typeof import('../../server-errors.ts').OpenServiceDevServerSubscriptionsMissingError;
 
 beforeEach(async () => {
   // The subscription queue is module state, so each test needs a fresh `common-preset` instance.
   vi.resetModules();
   ({ services, experimental_devServer } = await import('./common-preset.ts'));
-  ({ OpenServiceDevServerBeforeServicesError } = await import('../../server-errors.ts'));
+  ({ applyServicesPresetOnce } = await import('../utils/apply-services-preset-once.ts'));
+  ({ OpenServiceDevServerSubscriptionsMissingError } = await import('../../server-errors.ts'));
 
+  servicesHook = () => services(undefined, options);
   options = {
     channel: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
     presets: {
       apply: async (extension: string, config?: unknown) => {
         switch (extension) {
+          case 'services':
+            return servicesHook();
           case 'features':
             return { changeDetection: true };
           case 'storyIndexGenerator':
@@ -51,6 +57,7 @@ beforeEach(async () => {
   clearRegistry();
   clearToolsetRegistry();
   vi.stubGlobal('STORYBOOK_SERVICES_LOADED', false);
+  vi.stubGlobal('STORYBOOK_SERVICES_PRESET_PROMISE', undefined);
   now = 1_000;
   vi.spyOn(Date, 'now').mockImplementation(() => now);
 });
@@ -62,8 +69,7 @@ afterEach(() => {
   vi.restoreAllMocks();
 });
 
-it('marks the review stale on module-graph changes only once experimental_devServer ran', async () => {
-  await services(undefined, options);
+async function setButtonReview() {
   const review = getService<ReviewService>('core/review', { internal: true });
   const moduleGraph = getService<ModuleGraphService>('core/module-graph', { internal: true });
   await review.commands.setReview({
@@ -72,8 +78,15 @@ it('marks the review stale on module-graph changes only once experimental_devSer
     collections: [{ title: 'Button', rationale: 'Changed.', storyIds: ['button--primary'] }],
     changedFiles: [],
   });
-
+  // Past the review's grace window, so a module-graph change marks it stale.
   now = 12_000;
+  return { review, moduleGraph };
+}
+
+it('marks the review stale on module-graph changes only once experimental_devServer ran', async () => {
+  await applyServicesPresetOnce(options.presets);
+  const { review, moduleGraph } = await setButtonReview();
+
   await moduleGraph.commands._applyGraphUpdate({ bumpedStoryFiles: ['./src/Button.stories.tsx'] });
   expect(review.queries.current.get(undefined)?.stale).toBeUndefined();
 
@@ -82,20 +95,28 @@ it('marks the review stale on module-graph changes only once experimental_devSer
   await vi.waitFor(() => expect(review.queries.current.get(undefined)?.stale).toBe(true));
 });
 
-it('throws when experimental_devServer runs before services', async () => {
-  await expect(experimental_devServer(undefined as never, options)).rejects.toThrow(
-    OpenServiceDevServerBeforeServicesError
-  );
+it('applies services itself when experimental_devServer runs first', async () => {
+  await experimental_devServer(undefined as never, options);
+  const { review, moduleGraph } = await setButtonReview();
+
+  await moduleGraph.commands._applyGraphUpdate({ bumpedStoryFiles: ['./src/Button.stories.tsx'] });
+  await vi.waitFor(() => expect(review.queries.current.get(undefined)?.stale).toBe(true));
 });
 
-it('throws when experimental_devServer runs while services is still in flight', async () => {
-  const applyingServices = services(undefined, options);
+it('waits for services that are still being applied', async () => {
+  const applyingServices = applyServicesPresetOnce(options.presets);
+  await experimental_devServer(undefined as never, options);
+  await applyingServices;
+  const { review, moduleGraph } = await setButtonReview();
 
-  try {
-    await expect(experimental_devServer(undefined as never, options)).rejects.toThrow(
-      OpenServiceDevServerBeforeServicesError
-    );
-  } finally {
-    await applyingServices;
-  }
+  await moduleGraph.commands._applyGraphUpdate({ bumpedStoryFiles: ['./src/Button.stories.tsx'] });
+  await vi.waitFor(() => expect(review.queries.current.get(undefined)?.stale).toBe(true));
+});
+
+it('throws when services completed without queuing the dev-server subscriptions', async () => {
+  servicesHook = async () => {};
+
+  await expect(experimental_devServer(undefined as never, options)).rejects.toThrow(
+    OpenServiceDevServerSubscriptions
```

**File**: `code/core/src/server-errors.ts` (modified, +4/-4)
```diff
@@ -402,14 +402,14 @@ export class OpenServiceServicesAppliedTwiceError extends StorybookError {
   }
 }
 
-export class OpenServiceDevServerBeforeServicesError extends StorybookError {
+export class OpenServiceDevServerSubscriptionsMissingError extends StorybookError {
   constructor() {
     super({
-      name: 'OpenServiceDevServerBeforeServicesError',
+      name: 'OpenServiceDevServerSubscriptionsMissingError',
       category: Category.CORE_COMMON,
       code: 33,
-      message: dedent`The "experimental_devServer" preset property was applied before the "services" preset property completed.
-        Apply "services" and await it before starting the dev server; otherwise the review, docgen and story-docs services never follow file changes.`,
+      message: dedent`The "services" preset property completed without queuing the dev server subscriptions, for example because Storybook core is loaded twice.
+        The review, docgen and story-docs services would not follow file changes.`,
     });
   }
 }
```

**File**: `code/core/src/shared/open-service/README.md` (modified, +1/-1)
```diff
@@ -441,7 +441,7 @@ re-runs on HMR. The default `services` preset hook in
 [common-preset.ts](../../core-server/presets/common-preset.ts) still throws if the preset is applied
 more than once in the same process, which catches misconfigured preset wiring early.
 
-Registration must not start subscriptions that execute commands, because the attached tools CLI registers the same services. Its first [state sync](#state-sync-multi-master) advances every query from the initial state to the dev server's current one, so such a subscription would treat old changes as new and send their commands to the dev server. Export the subscription next to `register…Service` and start it from the `experimental_devServer` preset hook, which only the dev server applies; in [common-preset.ts](../../core-server/presets/common-preset.ts), `services` queues it beside the registration and `experimental_devServer` starts the queue. `experimental_devServer` throws `OpenServiceDevServerBeforeServicesError` if `services` has not completed, so the dev server cannot silently skip these subscriptions.
+Registration must not start subscriptions that execute commands, because the attached tools CLI registers the same services. Its first [state sync](#state-sync-multi-master) advances every query from the initial state to the dev server's current one, so such a subscription would treat old changes as new and send their commands to the dev server. Export the subscription next to `register…Service` and start it from the `experimental_devServer` preset hook, which only the dev server applies; in [common-preset.ts](../../core-server/presets/common-preset.ts), `services` queues it beside the registration and `experimental_devServer` starts the queue. `experimental_devServer` awaits `services` itself (through `applyServicesPresetOnce`), so the order holds whatever the boot code does, and throws `OpenServiceDevServerSubscriptionsMissingError` if the queue is still missing.
 
 The internal Storybook config registers an example debug service through a dedicated preset file
 ([`code/.storybook/services-preset.ts`](../../../../.storybook/services-preset.ts)), gated on
```

---

### Incident Patch 9: `71ff7095` (2026-10-05)
**Commit Message**: Update code/renderers/svelte/src/svelte-csf/utils/error/parser/extract/svelte.ts

Co-authored-by: Julien Huang <[REDACTED_EMAIL]>

**File**: `code/renderers/svelte/src/svelte-csf/utils/error/parser/extract/svelte.ts` (modified, +1/-1)
```diff
@@ -229,7 +229,7 @@ export class IndexerParseError extends StorybookSvelteCSFError {
 
       ${describeCause(this.cause)}
 
-      If the original error doesn't point to a problem in the stories file or in the Svelte config, please report it on the issue tracker on GitHub.
+      If the original error doesn't point to a problem in the stories file or in the Svelte config, please report it on the issue tracker on GitHub at https://github.com/storybookjs/storybook/issues/new?template=bug_report.yml.
     `;
   }
 }
```

---

### Incident Patch 10: `b38fbda9` (2026-10-05)
**Commit Message**: fix(core): only guard the services-before-devServer order

Keep a second experimental_devServer application a no-op, sharpen the error
message and comments, and document the guard next to the queue contract.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `.agents/guidelines/architecture.md` (modified, +2/-2)
```diff
@@ -90,8 +90,8 @@ the fields to change and provide migration-specific error guidance.
 - Register services and toolsets from the same `services` preset hook and behind the same feature
   gate. Missing or duplicate registrations fail loudly.
 - The tools CLI applies `services` too, so subscriptions that execute commands start from
-  `experimental_devServer`, not at registration. See "Server Registration Flow" in the open-service
-  README.
+  `experimental_devServer`, not at registration. `experimental_devServer` throws if `services` has
+  not completed. See "Server Registration Flow" in the open-service README.
 - The tools CLI consumes `storybook/internal/tools` (`createTools`). Default mode is
   attach-preferred (`auto`): join a running instance as a delegated leaf, or load locally on gate
   failure. `--attach` requires attachment; `--no-attach` forces local. When several running
```

**File**: `code/core/src/core-server/build-dev.ts` (modified, +1/-2)
```diff
@@ -282,8 +282,7 @@ export async function buildDevStandalone(
   const features = await presets.apply('features');
   global.FEATURES = features;
 
-  // Must complete before `storybookDevServer` applies `experimental_devServer`, which starts the
-  // module-graph subscriptions `services` queued; the reverse order throws.
+  // `storybookDevServer` applies `experimental_devServer`, which starts the subscriptions queued here.
   await applyServicesPresetOnce(presets);
   await presets.apply('experimental_serverChannel', channel);
 
```

**File**: `code/core/src/core-server/presets/common-preset.ts` (modified, +2/-3)
```diff
@@ -375,7 +375,7 @@ async function getHeadlessChangeDetectionAdapter(options: Options) {
 }
 
 // Started from `experimental_devServer`: the attached tools CLI also applies `services`.
-// Undefined until `services` completes, so a dev server that skipped or raced it fails loudly.
+// Set only when `services` completes, so `experimental_devServer` fails if it runs first or mid-flight.
 let devServerSubscriptions: Array<() => void> | undefined;
 
 globalThis.STORYBOOK_SERVICES_LOADED = globalThis.STORYBOOK_SERVICES_LOADED ?? false;
@@ -501,10 +501,9 @@ export const experimental_devServer: PresetPropertyFn<'experimental_devServer'>
   if (!devServerSubscriptions) {
     throw new OpenServiceDevServerBeforeServicesError();
   }
-  for (const subscribe of devServerSubscriptions) {
+  for (const subscribe of devServerSubscriptions.splice(0)) {
     subscribe();
   }
-  devServerSubscriptions = undefined;
 
   return app;
 };
```

**File**: `code/core/src/core-server/presets/dev-server-subscriptions.test.ts` (modified, +7/-13)
```diff
@@ -91,17 +91,11 @@ it('throws when experimental_devServer runs before services', async () => {
 it('throws when experimental_devServer runs while services is still in flight', async () => {
   const applyingServices = services(undefined, options);
 
-  await expect(experimental_devServer(undefined as never, options)).rejects.toThrow(
-    OpenServiceDevServerBeforeServicesError
-  );
-  await applyingServices;
-});
-
-it('throws when experimental_devServer is applied twice', async () => {
-  await services(undefined, options);
-  await experimental_devServer(undefined as never, options);
-
-  await expect(experimental_devServer(undefined as never, options)).rejects.toThrow(
-    OpenServiceDevServerBeforeServicesError
-  );
+  try {
+    await expect(experimental_devServer(undefined as never, options)).rejects.toThrow(
+      OpenServiceDevServerBeforeServicesError
+    );
+  } finally {
+    await applyingServices;
+  }
 });
```

**File**: `code/core/src/server-errors.ts` (modified, +2/-2)
```diff
@@ -408,8 +408,8 @@ export class OpenServiceDevServerBeforeServicesError extends StorybookError {
       name: 'OpenServiceDevServerBeforeServicesError',
       category: Category.CORE_COMMON,
       code: 33,
-      message: dedent`The "experimental_devServer" preset property was applied before the "services" preset property completed, or more than once.
-        The dev server must apply "services" once before "experimental_devServer", or services such as the review stop following file changes.`,
+      message: dedent`The "experimental_devServer" preset property was applied before the "services" preset property completed.
+        Apply "services" and await it before starting the dev server; otherwise the review, docgen and story-docs services never follow file changes.`,
     });
   }
 }
```

**File**: `code/core/src/shared/open-service/README.md` (modified, +1/-1)
```diff
@@ -441,7 +441,7 @@ re-runs on HMR. The default `services` preset hook in
 [common-preset.ts](../../core-server/presets/common-preset.ts) still throws if the preset is applied
 more than once in the same process, which catches misconfigured preset wiring early.
 
-Registration must not start subscriptions that execute commands, because the attached tools CLI registers the same services. Its first [state sync](#state-sync-multi-master) advances every query from the initial state to the dev server's current one, so such a subscription would treat old changes as new and send their commands to the dev server. Export the subscription next to `register…Service` and start it from the `experimental_devServer` preset hook, which only the dev server applies; in [common-preset.ts](../../core-server/presets/common-preset.ts), `services` queues it beside the registration and `experimental_devServer` starts the queue.
+Registration must not start subscriptions that execute commands, because the attached tools CLI registers the same services. Its first [state sync](#state-sync-multi-master) advances every query from the initial state to the dev server's current one, so such a subscription would treat old changes as new and send their commands to the dev server. Export the subscription next to `register…Service` and start it from the `experimental_devServer` preset hook, which only the dev server applies; in [common-preset.ts](../../core-server/presets/common-preset.ts), `services` queues it beside the registration and `experimental_devServer` starts the queue. `experimental_devServer` throws `OpenServiceDevServerBeforeServicesError` if `services` has not completed, so the dev server cannot silently skip these subscriptions.
 
 The internal Storybook config registers an example debug service through a dedicated preset file
 ([`code/.storybook/services-preset.ts`](../../../../.storybook/services-preset.ts)), gated on
```

---

### Incident Patch 11: `13260421` (2026-10-05)
**Commit Message**: fix(core): date module-graph changes by file mtime for review staleness

Webpack reports an edit made during a running compile only once that
compile finishes, so an agent's own edit can reach the module graph
after its review was published. The engine now dates every graph bump
by the changed file's mtime (or arrival time for removals), the module
graph exposes the newest one as graphChangedAt, and a review only turns
stale when the graph moved past its revision through a change made after
it was published. setReview no longer waits for the engine to settle.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `code/core/src/core-server/change-detection/change-detection-service.test.ts` (modified, +5/-0)
```diff
@@ -1,3 +1,5 @@
+import { stat } from 'node:fs/promises';
+
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 
 import { logger } from 'storybook/internal/node-logger';
@@ -36,6 +38,7 @@ import {
   resetChangeDetectionReadiness as internal_resetChangeDetectionReadiness,
 } from './readiness.ts';
 
+vi.mock('node:fs/promises', { spy: true });
 vi.mock('storybook/internal/node-logger', { spy: true });
 vi.mock('../../shared/open-service/server.ts', () => ({
   getService: vi.fn(),
@@ -132,6 +135,8 @@ describe('ChangeDetectionService', () => {
 
   beforeEach(() => {
     vi.useFakeTimers();
+    // Fixture paths do not exist; real fs I/O would also not settle under fake timers.
+    vi.mocked(stat).mockRejectedValue(new Error('ENOENT'));
     internal_resetChangeDetectionReadiness();
     vi.mocked(logger.info).mockImplementation(() => undefined);
     vi.mocked(logger.warn).mockImplementation(() => undefined);
```

**File**: `code/core/src/core-server/presets/dev-server-subscriptions.test.ts` (modified, +4/-0)
```diff
@@ -21,6 +21,7 @@ const index = {
   },
 } as StoryIndex;
 
+let now: number;
 let options: Options;
 
 beforeEach(() => {
@@ -41,6 +42,8 @@ beforeEach(() => {
   } as unknown as Options;
   clearRegistry();
   vi.stubGlobal('STORYBOOK_SERVICES_LOADED', false);
+  now = 1_000;
+  vi.spyOn(Date, 'now').mockImplementation(() => now);
 });
 
 afterEach(() => {
@@ -60,6 +63,7 @@ it('marks the review stale on module-graph changes only once experimental_devSer
     changedFiles: [],
   });
 
+  now = 12_000;
   await moduleGraph.commands._applyGraphUpdate({ bumpedStoryFiles: ['./src/Button.stories.tsx'] });
   expect(review.queries.current.get(undefined)?.stale).toBeUndefined();
 
```

**File**: `code/core/src/manager/components/review/ReviewPage.stories.tsx` (modified, +1/-1)
```diff
@@ -435,7 +435,7 @@ export const PendingUpdateSupersedesStale = meta.story({
     const canvas = within(canvasElement);
 
     await applyReviewState();
-    await reviewService.commands.markStale({ revision: 1 });
+    await reviewService.commands.markStale({ revision: 1, changedAt: Date.now() });
     await expect(await canvas.findByText(/Code changes detected/)).toBeInTheDocument();
 
     await reviewService.commands.setReview(updatedReviewState);
```

**File**: `code/core/src/manager/components/review/review-service-story-helpers.ts` (modified, +2/-2)
```diff
@@ -31,9 +31,9 @@ export const reviewServiceForStories = registerService(reviewServiceDef, {
       },
     },
     markStale: {
-      handler: async ({ revision }, ctx) => {
+      handler: async (change, ctx) => {
         ctx.self.setState((state) => {
-          applyMarkStale(state, revision);
+          applyMarkStale(state, change);
         });
       },
     },
```

**File**: `code/core/src/shared/open-service/services/module-graph/definition.ts` (modified, +18/-1)
```diff
@@ -90,6 +90,7 @@ export const moduleGraphServiceDef = defineService({
     workingDir: process.cwd(),
     status: { value: 'booting' },
     graphRevision: 0,
+    graphChangedAt: 0,
     fileActivityRevision: 0,
     storyChangeRevisions: {},
     latestChangedStoryFiles: [],
@@ -152,6 +153,13 @@ export const moduleGraphServiceDef = defineService({
         return max;
       },
     },
+    graphChangedAt: {
+      description:
+        'Newest modification time (unix ms) among the file changes that advanced `graphRevision`, 0 before the first one. Dates a change by the file itself, so a builder that reports an edit late cannot make it look newer than it is.',
+      input: noInputSchema,
+      output: v.number(),
+      handler: (_input, ctx) => ctx.self.state.graphChangedAt,
+    },
     fileActivityRevision: {
       description:
         'Monotonic counter advanced on every processed file-change event, including out-of-graph paths that do not advance `graphRevision`. Change detection watches this to rescan git after working-tree edits.',
@@ -250,14 +258,22 @@ export const moduleGraphServiceDef = defineService({
     _applyGraphUpdate: {
       internal: true,
       description:
-        'Advances file activity for every processed file event. When `bumpedStoryFiles` is non-empty, also bumps graph revision and records those stories. Called by the graph engine after any index apply for the same patch; does not write the reverse index.',
+        'Advances file activity for every processed file event. When `bumpedStoryFiles` is non-empty, also bumps graph revision, advances `graphChangedAt`, and records those stories. Called by the graph engine after any index apply for the same patch; does not write the reverse index.',
       input: v.object({
         bumpedStoryFiles: v.pipe(
           v.array(storyIndexPathSchema),
           v.description(
             'Story files whose graph changed, using story-index-style relative paths. Each listed file has its version incremented.'
           )
         ),
+        changedAt: v.optional(
+          v.pipe(
+            v.number(),
+            v.description(
+              'Modification time (unix ms) of the changed file. Defaults to now when unknown.'
+            )
+          )
+        ),
       }),
       output: v.void(),
       handler: async (input, ctx) => {
@@ -271,6 +287,7 @@ export const moduleGraphServiceDef = defineService({
             return;
           }
           state.graphRevision += 1;
+          state.graphChangedAt = Math.max(state.graphChangedAt, input.changedAt ?? Date.now());
           state.latestChangedStoryFiles = input.bumpedStoryFiles;
           for (const storyFile of input.bumpedStoryFiles) {
             state.storyChangeRevisions[storyFile] = state.graphRevision;
```

**File**: `code/core/src/shared/open-service/services/module-graph/engine/module-graph-engine.test.ts` (modified, +32/-3)
```diff
@@ -1,3 +1,5 @@
+import { stat } from 'node:fs/promises';
+
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 
 import { logger } from 'storybook/internal/node-logger';
@@ -13,6 +15,7 @@ import {
 import { ModuleGraphFailureError } from '../errors.ts';
 import { ModuleGraphEngine } from './module-graph-engine.ts';
 
+vi.mock('node:fs/promises', { spy: true });
 vi.mock('storybook/internal/node-logger', { spy: true });
 vi.mock('./dependency-graph/resolver-factory.ts', { spy: true });
 vi.mock('./dependency-graph/dependency-graph-builder.ts', { spy: true });
@@ -50,6 +53,8 @@ function setup(options?: {
 describe('ModuleGraphEngine', () => {
   beforeEach(() => {
     vi.useFakeTimers();
+    // Fixture paths do not exist; real fs I/O would also not settle under fake timers.
+    vi.mocked(stat).mockRejectedValue(new Error('ENOENT'));
     vi.mocked(logger.info).mockImplementation(() => undefined);
     vi.mocked(logger.warn).mockImplementation(() => undefined);
     vi.mocked(logger.error).mockImplementation(() => undefined);
@@ -232,7 +237,7 @@ describe('ModuleGraphEngine', () => {
     expect(patchSpy).toHaveBeenCalledTimes(1);
     expect(callbacks.onIndex).not.toHaveBeenCalled();
     expect(callbacks.onBump).toHaveBeenCalledTimes(1);
-    expect(callbacks.onBump).toHaveBeenCalledWith([]);
+    expect(callbacks.onBump).toHaveBeenCalledWith([], expect.any(Number));
   });
 
   it('bumps stories without calling onIndex when a patch leaves the reverse index untouched', async () => {
@@ -256,7 +261,31 @@ describe('ModuleGraphEngine', () => {
 
     expect(callbacks.onIndex).not.toHaveBeenCalled();
     expect(callbacks.onBump).toHaveBeenCalledTimes(1);
-    expect(callbacks.onBump).toHaveBeenCalledWith(['./src/B.stories.tsx']);
+    expect(callbacks.onBump).toHaveBeenCalledWith(['./src/B.stories.tsx'], expect.any(Number));
+  });
+
+  it('dates a bump by the file mtime, or by when the event arrived for a removal', async () => {
+    const story = '/repo/src/B.stories.tsx';
+    const { patchSpy } = installDependencyGraphMocks(buildReverseIndex([[story, story, 0]]));
+    const { service, adapter, emitFileChange, callbacks } = setup({
+      storyIndex: createStoryIndex([
+        { storyId: 'b--default', importPath: './src/B.stories.tsx', title: 'B' },
+      ]),
+    });
+    patchSpy.mockImplementation(async () => undefined);
+    vi.setSystemTime(50_000);
+
+    service.start(adapter);
+    await vi.runAllTimersAsync();
+
+    vi.mocked(stat).mockResolvedValueOnce({ mtimeMs: 40_000 } as Awaited<ReturnType<typeof stat>>);
+    emitFileChange({ kind: 'change', path: story });
+    await vi.runAllTimersAsync();
+    emitFileChange({ kind: 'unlink', path: story });
+    await vi.runAllTimersAsync();
+
+    expect(callbacks.onBump).toHaveBeenNthCalledWith(1, ['./src/B.stories.tsx'], 40_000);
+    expect(callbacks.onBump).toHaveBeenNthCalledWith(2, ['./src/B.stories.tsx'], 50_000);
   });
 
   it('buffers file events emitted during the build and applies them in order after build resolves', async () => {
@@ -316,7 +345,7 @@ describe('ModuleGraphEngine', () => {
     expect(patchSpy).toHaveBeenCalledWith({ kind: 'add', path: '/repo/src/B.stories.tsx' });
     // The replayed add flows through the normal patch path, so the new story is reported as a
     // targeted bump — no separate untargeted index-invalidation bump is needed.
-    expect(callbacks.onBump).toHaveBeenCalledWith(['./src/B.stories.tsx']);
+    expect(callbacks.onBump).toHaveBeenCalledWith(['./src/B.stories.tsx'], expect.any(Number));
   });
 
   it('does not emit an update when an invalidation leaves the story set unchanged', async () => {
```

**File**: `code/core/src/shared/open-service/services/module-graph/engine/module-graph-engine.ts` (modified, +28/-13)
```diff
@@ -1,4 +1,4 @@
-import { writeFile } from 'node:fs/promises';
+import { stat, writeFile } from 'node:fs/promises';
 
 import { join, normalize } from 'pathe';
 
@@ -37,8 +37,9 @@ export interface ModuleGraphEngineOptions {
   /**
    * Fired after every settled file-change patch. Empty `bumpedStoryFiles` means the path was
    * out of graph: `fileActivityRevision` still advances so change detection can rescan git.
+   * `changedAt` is the changed file's modification time, or when the event arrived for a removal.
    */
-  onBump?: (bumpedStoryFiles: string[]) => void | Promise<void>;
+  onBump?: (bumpedStoryFiles: string[], changedAt: number) => void | Promise<void>;
 }
 
 /**
@@ -119,7 +120,8 @@ export class ModuleGraphEngine {
   private async mirrorUpdate(
     changedFile: string,
     prePatchBumped: Set<string>,
-    indexChanged: boolean
+    indexChanged: boolean,
+    changedAt: number
   ): Promise<void> {
     if (!this.reverseIndex) {
       return;
@@ -137,7 +139,8 @@ export class ModuleGraphEngine {
       );
     }
     await this.options.onBump?.(
-      Array.from(bumpedStoryFiles, (storyFile) => toStoryIndexPath(storyFile, this.workingDir))
+      Array.from(bumpedStoryFiles, (storyFile) => toStoryIndexPath(storyFile, this.workingDir)),
+      changedAt
     );
   }
 
@@ -230,9 +233,9 @@ export class ModuleGraphEngine {
     });
 
     // Subscribe BEFORE build — buffer events until patcher is ready
-    const eventBuffer: FileChangeEvent[] = [];
+    const eventBuffer: Array<{ event: FileChangeEvent; receivedAt: number }> = [];
     const unsubscribeBuffer = adapter.onFileChange((event) => {
-      eventBuffer.push(event);
+      eventBuffer.push({ event, receivedAt: Date.now() });
     });
 
     const { reverseIndex, graph } = await this.dependencyGraphBuilder.build(this.storyFiles);
@@ -252,15 +255,16 @@ export class ModuleGraphEngine {
 
     // Drain buffered events into patchQueue, then switch to live handler
     unsubscribeBuffer();
-    for (const event of eventBuffer) {
+    for (const { event, receivedAt } of eventBuffer) {
       this.patchQueue = this.patchQueue
-        .then(() => this.handleFileChange(event))
+        .then(() => this.handleFileChange(event, receivedAt))
         .catch(() => undefined);
     }
 
     adapter.onFileChange((event) => {
+      const receivedAt = Date.now();
       this.patchQueue = this.patchQueue
-        .then(() => this.handleFileChange(event))
+        .then(() => this.handleFileChange(event, receivedAt))
         .catch(() => undefined);
     });
 
@@ -320,14 +324,15 @@ export class ModuleGraphEngine {
 
     this.storyFiles = next;
 
+    const receivedAt = Date.now();
     for (const path of added) {
       this.patchQueue = this.patchQueue
-        .then(() => this.handleFileChange({ kind: 'add', path }))
+        .then(() => this.handleFileChange({ kind: 'add', path }, receivedAt))
         .catch(() => undefined);
     }
     for (const path of removed) {
       this.patchQueue = this.patchQueue
-        .then(() => this.handleFileChange({ kind: 'unlink', path }))
+        .then(() => this.handleFileChange({ kind: 'unlink', path }, receivedAt))
         .catch(() => undefined);
     }
   }
@@ -390,10 +395,19 @@ export class ModuleGraphEngine {
     }
   }
 
-  private async handleFileChange(event: FileChangeEvent): Promise<void> {
+  private async handleFileChange(event: FileChangeEvent, receivedAt: number): Promise<void> {
     if (!this.incrementalPatcher || !this.reverseIndex) {
       return;
     }
+    // Builders can report an edit long after it happened (webpack holds edits made during a
+    // compile until it finishes), so the file's own mtime dates the change.
+    const changedAt =
+      event.kind === 'unlink'
+        ? receivedAt
+        : await stat(event.path).then(
+            (stats) => stats.mtimeMs,
+            () => receivedAt
+          );
     const prePatchBumped = this.collectBumpedStoryFiles(event.path);
     const revisionBefore = this.reverseIndex.revision;
     try {
@@ -408,7 +422,8 @@ export class ModuleGraphEngine {
     await this.mirrorUpdate(
       event.path,
       prePatchBumped,
-      this.reverseIndex.revision !== revisionBefore
+      this.reverseIndex.revision !== revisionBefore,
+      changedAt
     );
   }
 }
```

**File**: `code/core/src/shared/open-service/services/module-graph/server.test.ts` (modified, +16/-0)
```diff
@@ -282,6 +282,22 @@ describe('module-graph open service', () => {
       expect(runtime.queries.graphRevision.get(undefined)).toBe(2);
     });
 
+    it('keeps the newest in-graph change time, even when an older edit is reported later', async () => {
+      const runtime = registerBareModuleGraph();
+
+      await runtime.commands._applyGraphUpdate({
+        bumpedStoryFiles: ['./a.stories.tsx'],
+        changedAt: 2_000,
+      });
+      await runtime.commands._applyGraphUpdate({
+        bumpedStoryFiles: ['./b.stories.tsx'],
+        changedAt: 1_000,
+      });
+      await runtime.commands._applyGraphUpdate({ bumpedStoryFiles: [], changedAt: 3_000 });
+
+      expect(runtime.queries.graphChangedAt.get(undefined)).toBe(2_000);
+    });
+
     it('advances file activity but not graph revision for an out-of-graph change', async () => {
       const runtime = registerBareModuleGraph();
       await runtime.commands._applyGraphSnapshot({
```

---

### Incident Patch 12: `d11956c3` (2026-10-05)
**Commit Message**: fix(core): fail loudly when experimental_devServer runs before services

The dev server starts the module-graph subscriptions that `services` queues from
`experimental_devServer`. If that order ever flipped, the queue was empty and the
review stale marking and docgen re-extraction silently stopped. The queue is now
only published once `services` completes, and `experimental_devServer` throws
OpenServiceDevServerBeforeServicesError when it is missing.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `code/core/src/core-server/build-dev.ts` (modified, +2/-0)
```diff
@@ -282,6 +282,8 @@ export async function buildDevStandalone(
   const features = await presets.apply('features');
   global.FEATURES = features;
 
+  // Must complete before `storybookDevServer` applies `experimental_devServer`, which starts the
+  // module-graph subscriptions `services` queued; the reverse order throws.
   await applyServicesPresetOnce(presets);
   await presets.apply('experimental_serverChannel', channel);
 
```

**File**: `code/core/src/core-server/presets/common-preset.ts` (modified, +17/-6)
```diff
@@ -31,7 +31,10 @@ import {
   type StorybookConfigRaw,
 } from 'storybook/internal/types';
 
-import { OpenServiceServicesAppliedTwiceError } from '../../server-errors.ts';
+import {
+  OpenServiceDevServerBeforeServicesError,
+  OpenServiceServicesAppliedTwiceError,
+} from '../../server-errors.ts';
 import {
   registerDocgenService,
   subscribeDocgenToModuleGraphChanges,
@@ -372,7 +375,8 @@ async function getHeadlessChangeDetectionAdapter(options: Options) {
 }
 
 // Started from `experimental_devServer`: the attached tools CLI also applies `services`.
-const devServerSubscriptions: Array<() => void> = [];
+// Undefined until `services` completes, so a dev server that skipped or raced it fails loudly.
+let devServerSubscriptions: Array<() => void> | undefined;
 
 globalThis.STORYBOOK_SERVICES_LOADED = globalThis.STORYBOOK_SERVICES_LOADED ?? false;
 
@@ -382,6 +386,7 @@ export const services = async (_value: void, options: Options): Promise<void> =>
   }
   globalThis.STORYBOOK_SERVICES_LOADED = true;
 
+  const subscriptions: Array<() => void> = [];
   const getIndex = () =>
     options.presets
       .apply<StoryIndexGenerator>('storyIndexGenerator')
@@ -422,7 +427,7 @@ export const services = async (_value: void, options: Options): Promise<void> =>
     registerReviewService({
       getIndex,
     });
-    devServerSubscriptions.push(subscribeReviewToModuleGraphChanges);
+    subscriptions.push(subscribeReviewToModuleGraphChanges);
     registerToolset(reviewToolset);
   }
 
@@ -448,7 +453,7 @@ export const services = async (_value: void, options: Options): Promise<void> =>
         getIndex,
         docgenProvider: (input) => docgenWorker.extract(input.entry),
       });
-      devServerSubscriptions.push(() =>
+      subscriptions.push(() =>
         subscribeDocgenToModuleGraphChanges({ getIndex, workingDir: process.cwd() })
       );
     }
@@ -461,7 +466,7 @@ export const services = async (_value: void, options: Options): Promise<void> =>
       getIndex,
       storyDocsProvider,
     });
-    devServerSubscriptions.push(() =>
+    subscriptions.push(() =>
       subscribeStoryDocsToModuleGraphChanges({ getIndex, workingDir: process.cwd() })
     );
   }
@@ -488,12 +493,18 @@ export const services = async (_value: void, options: Options): Promise<void> =>
         : { docsAccess: localDocsAccess }
     )
   );
+
+  devServerSubscriptions = subscriptions;
 };
 
 export const experimental_devServer: PresetPropertyFn<'experimental_devServer'> = async (app) => {
-  for (const subscribe of devServerSubscriptions.splice(0)) {
+  if (!devServerSubscriptions) {
+    throw new OpenServiceDevServerBeforeServicesError();
+  }
+  for (const subscribe of devServerSubscriptions) {
     subscribe();
   }
+  devServerSubscriptions = undefined;
 
   return app;
 };
```

**File**: `code/core/src/core-server/presets/dev-server-subscriptions.test.ts` (modified, +36/-2)
```diff
@@ -4,7 +4,7 @@ import { afterEach, beforeEach, expect, it, vi } from 'vitest';
 import { clearRegistry, getService } from '../../shared/open-service/server.ts';
 import type { ModuleGraphService } from '../../shared/open-service/services/module-graph/definition.ts';
 import type { ReviewService } from '../../shared/open-service/services/review/definition.ts';
-import { experimental_devServer, services } from './common-preset.ts';
+import { clearToolsetRegistry } from '../../shared/open-service/toolset-registry.ts';
 
 const index = {
   v: 5,
@@ -23,8 +23,16 @@ const index = {
 
 let now: number;
 let options: Options;
+let services: typeof import('./common-preset.ts').services;
+let experimental_devServer: typeof import('./common-preset.ts').experimental_devServer;
+let OpenServiceDevServerBeforeServicesError: typeof import('../../server-errors.ts').OpenServiceDevServerBeforeServicesError;
+
+beforeEach(async () => {
+  // The subscription queue is module state, so each test needs a fresh `common-preset` instance.
+  vi.resetModules();
+  ({ services, experimental_devServer } = await import('./common-preset.ts'));
+  ({ OpenServiceDevServerBeforeServicesError } = await import('../../server-errors.ts'));
 
-beforeEach(() => {
   options = {
     channel: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
     presets: {
@@ -41,13 +49,15 @@ beforeEach(() => {
     },
   } as unknown as Options;
   clearRegistry();
+  clearToolsetRegistry();
   vi.stubGlobal('STORYBOOK_SERVICES_LOADED', false);
   now = 1_000;
   vi.spyOn(Date, 'now').mockImplementation(() => now);
 });
 
 afterEach(() => {
   clearRegistry();
+  clearToolsetRegistry();
   vi.unstubAllGlobals();
   vi.restoreAllMocks();
 });
@@ -71,3 +81,27 @@ it('marks the review stale on module-graph changes only once experimental_devSer
   await moduleGraph.commands._applyGraphUpdate({ bumpedStoryFiles: ['./src/Button.stories.tsx'] });
   await vi.waitFor(() => expect(review.queries.current.get(undefined)?.stale).toBe(true));
 });
+
+it('throws when experimental_devServer runs before services', async () => {
+  await expect(experimental_devServer(undefined as never, options)).rejects.toThrow(
+    OpenServiceDevServerBeforeServicesError
+  );
+});
+
+it('throws when experimental_devServer runs while services is still in flight', async () => {
+  const applyingServices = services(undefined, options);
+
+  await expect(experimental_devServer(undefined as never, options)).rejects.toThrow(
+    OpenServiceDevServerBeforeServicesError
+  );
+  await applyingServices;
+});
+
+it('throws when experimental_devServer is applied twice', async () => {
+  await services(undefined, options);
+  await experimental_devServer(undefined as never, options);
+
+  await expect(experimental_devServer(undefined as never, options)).rejects.toThrow(
+    OpenServiceDevServerBeforeServicesError
+  );
+});
```

**File**: `code/core/src/server-errors.ts` (modified, +12/-0)
```diff
@@ -402,6 +402,18 @@ export class OpenServiceServicesAppliedTwiceError extends StorybookError {
   }
 }
 
+export class OpenServiceDevServerBeforeServicesError extends StorybookError {
+  constructor() {
+    super({
+      name: 'OpenServiceDevServerBeforeServicesError',
+      category: Category.CORE_COMMON,
+      code: 33,
+      message: dedent`The "experimental_devServer" preset property was applied before the "services" preset property completed, or more than once.
+        The dev server must apply "services" once before "experimental_devServer", or services such as the review stop following file changes.`,
+    });
+  }
+}
+
 export class OpenServiceMissingToolsetError extends StorybookError {
   constructor(public data: { toolsetId: string }) {
     super({
```

---

### Incident Patch 13: `40455559` (2026-10-05)
**Commit Message**: feat(skills): stop requiring addon-mcp

The skills no longer ask for @storybook/addon-mcp; nothing they use needs it.
The eval templates drop the addon and sandbox setup adds it for the MCP
experiments only, so the plugin experiments run on a project without it.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `agent-eval/evals/812-first-story-empty-project/.storybook/main.ts` (modified, +1/-6)
```diff
@@ -2,12 +2,7 @@ import type { StorybookConfig } from '@storybook/react-vite';
 
 const config: StorybookConfig = {
   stories: ['../@(stories|src)/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
-  addons: [
-    '@storybook/addon-a11y',
-    '@storybook/addon-vitest',
-    '@storybook/addon-docs',
-    '@storybook/addon-mcp',
-  ],
+  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest', '@storybook/addon-docs'],
   framework: '@storybook/react-vite',
 };
 export default config;
```

**File**: `agent-eval/evals/812-first-story-empty-project/package.json` (modified, +0/-1)
```diff
@@ -10,7 +10,6 @@
   "devDependencies": {
     "@storybook/addon-a11y": "workspace:*",
     "@storybook/addon-docs": "workspace:*",
-    "@storybook/addon-mcp": "workspace:*",
     "@storybook/addon-vitest": "workspace:*",
     "@storybook/mcp": "workspace:*",
     "@storybook/react": "workspace:*",
```

**File**: `agent-eval/evals/820-init-no-storybook/EVAL.ts` (modified, +4/-21)
```diff
@@ -1,4 +1,4 @@
-import { readFileSync, readdirSync } from 'node:fs';
+import { readFileSync } from 'node:fs';
 import { describe, expect, test } from 'vitest';
 import {
   expectShellCommandMatching,
@@ -9,9 +9,8 @@ import {
 } from '#test-utils';
 
 describe('initializing Storybook in a project without it', () => {
-  // Only the lifecycle outcome is asserted: the storybook-init skill installs
-  // the published stable release, which has no story/review workflow tooling
-  // to assert on — that workflow is owned by the 80x evals.
+  // Only the lifecycle outcome is asserted; the story/review workflow is owned
+  // by the 80x evals.
 
   test('invokes the storybook-init skill', () => {
     expectSkillInvoked('storybook-init');
@@ -23,7 +22,7 @@ describe('initializing Storybook in a project without it', () => {
     expectShellCommandMatching(/create(-|\s+)storybook|storybook(@\S+)?\s+init/);
   });
 
-  test('installs Storybook and the MCP addon', () => {
+  test('installs Storybook', () => {
     const packageJson = parseJson(readFileSync('package.json', 'utf8'));
     if (!isRecord(packageJson)) {
       expect.fail('Expected package.json to contain a JSON object');
@@ -34,27 +33,11 @@ describe('initializing Storybook in a project without it', () => {
       ...(isRecord(packageJson.devDependencies) ? packageJson.devDependencies : {}),
     };
     expect(dependencies.storybook, 'Expected a storybook dependency').toBeTypeOf('string');
-    expect(
-      dependencies['@storybook/addon-mcp'],
-      'Expected the @storybook/addon-mcp dependency (skill step 2: npx storybook add @storybook/addon-mcp)'
-    ).toBeTypeOf('string');
 
     const scripts = isRecord(packageJson.scripts) ? packageJson.scripts : {};
     expect(scripts.storybook, 'Expected a storybook script').toBeTypeOf('string');
   });
 
-  test('registers the MCP addon in the Storybook config', () => {
-    const mainFile = readdirSync('.storybook').find((entry) => /^main\.[cm]?[jt]sx?$/.test(entry));
-    if (mainFile === undefined) {
-      expect.fail('Expected a .storybook/main config file to exist');
-    }
-
-    expect(
-      readFileSync(`.storybook/${mainFile}`, 'utf8'),
-      'Expected @storybook/addon-mcp to be registered in the Storybook config'
-    ).toContain('@storybook/addon-mcp');
-  });
-
   test('the initialized Storybook boots', async () => {
     await expectStorybookBoots();
   });
```

**File**: `agent-eval/lib/mcp/start-storybook-mcp.mjs` (modified, +20/-4)
```diff
@@ -4,7 +4,12 @@ import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
 import { setTimeout as delay } from 'node:timers/promises';
 
 const port = process.env.STORYBOOK_MCP_PORT || '6006';
-const mcpUrl = 'http://127.0.0.1:' + port + '/mcp';
+const storybookUrl = 'http://127.0.0.1:' + port;
+const mcpUrl = storybookUrl + '/mcp';
+// Only the MCP experiments keep @storybook/addon-mcp, so only they have an MCP endpoint to wait for.
+const usesMcp =
+  JSON.parse(await readFile('__agent_eval__/agent.json', 'utf8')).integration === 'mcp';
+const readyUrl = usesMcp ? mcpUrl : storybookUrl + '/index.json';
 const logPath = process.env.STORYBOOK_MCP_LOG_PATH || '/tmp/storybook-mcp.log';
 const parsedTimeoutMs = Number(process.env.STORYBOOK_MCP_TIMEOUT_MS);
 const timeoutMs =
@@ -76,8 +81,8 @@ const logTail = await readFile(logPath, 'utf8')
   .then((tail) => tail || '(no Storybook log was written)');
 
 process.stderr.write(
-  'Storybook MCP server did not become ready at ' +
-    mcpUrl +
+  'Storybook did not become ready at ' +
+    readyUrl +
     ' within ' +
     timeoutMs +
     'ms. Storybook log tail:\n' +
@@ -123,7 +128,7 @@ async function assertCheckoutPackagesInstalled() {
 
 async function isReady() {
   try {
-    return await initializeMcp();
+    return usesMcp ? await initializeMcp() : await servesStoryIndex();
   } catch {
     return false;
   }
@@ -141,6 +146,10 @@ async function dumpMcpDebug() {
     // The startup log first, so it is captured even when the fetches below throw.
     await copyFile(logPath, debugDir + '/storybook.log').catch(() => {});
 
+    if (!usesMcp) {
+      return;
+    }
+
     const landing = await fetch(mcpUrl, {
       headers: { Accept: 'text/html' },
       signal: AbortSignal.timeout(5_000),
@@ -195,3 +204,10 @@ async function initializeMcp() {
   await response.body?.cancel();
   return response.ok;
 }
+
+async function servesStoryIndex() {
+  const response = await fetch(readyUrl, { signal: AbortSignal.timeout(5_000) });
+
+  await response.body?.cancel();
+  return response.ok;
+}
```

**File**: `agent-eval/lib/mcp/start-storybook-mcp.test.ts` (modified, +22/-0)
```diff
@@ -20,10 +20,16 @@ afterEach(() => {
 });
 
 function runInstall(options: {
+  integration?: 'mcp' | 'plugin';
   checkoutPackages?: string[];
   lockfilePackages?: Record<string, { resolved?: string }>;
 }) {
   projectDir = mkdtempSync(path.join(tmpdir(), 'start-storybook-mcp-'));
+  mkdirSync(path.join(projectDir, '__agent_eval__'));
+  writeFileSync(
+    path.join(projectDir, '__agent_eval__', 'agent.json'),
+    JSON.stringify({ integration: options.integration ?? 'mcp' })
+  );
   if (options.checkoutPackages) {
     mkdirSync(path.join(projectDir, 'local-packages'));
     writeFileSync(
@@ -109,3 +115,19 @@ describe('the checkout package check', () => {
     expect(result.stderr).toContain('did not become ready');
   });
 });
+
+describe('the readiness check', () => {
+  it('waits for the MCP endpoint in an MCP sandbox', () => {
+    const result = runInstall({ integration: 'mcp' });
+
+    expect(result.status).toBe(1);
+    expect(result.stderr).toContain('did not become ready at http://127.0.0.1:1/mcp');
+  });
+
+  it('waits for the story index in a sandbox without the MCP addon', () => {
+    const result = runInstall({ integration: 'plugin' });
+
+    expect(result.status).toBe(1);
+    expect(result.stderr).toContain('did not become ready at http://127.0.0.1:1/index.json');
+  });
+});
```

**File**: `agent-eval/lib/templates.test.ts` (modified, +46/-3)
```diff
@@ -1,11 +1,12 @@
-import { readFileSync } from 'node:fs';
-import { join } from 'node:path';
+import { readdirSync, readFileSync } from 'node:fs';
+import { join, sep } from 'node:path';
 import { fileURLToPath } from 'node:url';
 
 import type { Sandbox } from '@vercel/agent-eval';
 import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
 
 import {
+  addMcpAddon,
   pointStorybookAtCheckout,
   isReviewEnabledFor,
   readStorybookWorkspace,
@@ -41,6 +42,30 @@ describe('isReviewEnabledFor', () => {
   });
 });
 
+describe('addMcpAddon', () => {
+  it('registers the addon in every template and fixture Storybook', () => {
+    const mainFiles = [
+      ...findStorybookMainFiles(join(AGENT_EVAL_ROOT, 'templates')),
+      ...findStorybookMainFiles(join(AGENT_EVAL_ROOT, 'evals')),
+    ];
+    expect(mainFiles.length).toBeGreaterThan(0);
+
+    for (const mainFile of mainFiles) {
+      const files = {
+        '.storybook/main.ts': readFileSync(mainFile, 'utf8'),
+        'package.json': readFileSync(join(mainFile, '..', '..', 'package.json'), 'utf8'),
+      };
+
+      addMcpAddon(files);
+
+      expect(files['.storybook/main.ts'], mainFile).toContain("'@storybook/addon-mcp'],");
+      expect(JSON.parse(files['package.json']).devDependencies, mainFile).toMatchObject({
+        '@storybook/addon-mcp': 'workspace:*',
+      });
+    }
+  });
+});
+
 // The Codex MCP experiment copies the server instructions into AGENTS.md, so a
 // change to them must update the copy too.
 describe('Codex AGENTS.md instructions', () => {
@@ -94,7 +119,12 @@ describe('readTemplateCheckoutPackages', () => {
     const packages = (await readTemplateCheckoutPackages()).map((pkg) => pkg.name);
 
     expect(packages).toEqual(
-      expect.arrayContaining(['storybook', '@storybook/react-vite', '@storybook/builder-vite'])
+      expect.arrayContaining([
+        'storybook',
+        '@storybook/react-vite',
+        '@storybook/builder-vite',
+        '@storybook/addon-mcp',
+      ])
     );
   });
 });
@@ -241,3 +271,16 @@ describe('writeClaudeInAppBrowserMock', () => {
     expect(files['CLAUDE.md']).toMatch(/^# Project rules\n\n[\s\S]*<built_in_browser>/);
   });
 });
+
+function findStorybookMainFiles(rootDir: string): string[] {
+  return readdirSync(rootDir, { withFileTypes: true }).flatMap((entry) => {
+    const entryPath = join(rootDir, entry.name);
+    if (entry.isDirectory()) {
+      return entry.name === 'node_modules' ? [] : findStorybookMainFiles(entryPath);
+    }
+    // `sep`-based so the match also works on Windows, where `join` emits backslashes.
+    return entry.name === 'main.ts' && entryPath.includes(`${sep}.storybook${sep}`)
+      ? [entryPath]
+      : [];
+  });
+}
```

**File**: `agent-eval/lib/templates.ts` (modified, +42/-0)
```diff
@@ -127,6 +127,10 @@ export function isReviewEnabledFor(integration: EvalIntegration): boolean {
     integration === 'plugin' || (integration === 'mcp' && process.env.EVAL_STORYBOOK_LATEST !== '1')
   );
 }
+const STORYBOOK_MAIN_PATTERN = /(^|\/)\.storybook\/main\.ts$/;
+const STORYBOOK_MCP_ADDON = '@storybook/addon-mcp';
+// Captures the entries of the `addons` list, without the trailing comma.
+const STORYBOOK_ADDONS_PATTERN = /addons: \[([^\]]*?),?\s*\]/;
 const STORYBOOK_MCP_SERVER_NAME = 'storybook-dev-mcp';
 const CLAUDE_BROWSER_MCP_SERVER_NAME = 'Browser';
 const STORYBOOK_MCP_URL = 'http://127.0.0.1:6006/mcp';
@@ -177,6 +181,10 @@ export async function setupSandbox(
 
   files = mergeTemplateAndFixtureFiles(files, fixtureFiles);
 
+  if (options.integration === 'mcp') {
+    addMcpAddon(files);
+  }
+
   const workspace = await readStorybookWorkspace();
   let packedCheckout = false;
   if (process.env.EVAL_STORYBOOK_LATEST === '1') {
@@ -325,6 +333,35 @@ function mergeTemplateAndFixtureFiles(
   return files;
 }
 
+// Only the MCP experiments get the addon: the plugin skills have to work in a project without it.
+export function addMcpAddon(files: Record<string, string>): void {
+  for (const [filePath, content] of Object.entries(files)) {
+    if (!STORYBOOK_MAIN_PATTERN.test(filePath)) {
+      continue;
+    }
+
+    if (!STORYBOOK_ADDONS_PATTERN.test(content)) {
+      throw new Error(`Cannot add ${STORYBOOK_MCP_ADDON}: ${filePath} has no "addons: [...]" list`);
+    }
+    files[filePath] = content.replace(
+      STORYBOOK_ADDONS_PATTERN,
+      (_, addons: string) =>
+        `addons: [${[addons.trim(), `'${STORYBOOK_MCP_ADDON}'`].filter(Boolean).join(', ')}]`
+    );
+
+    const manifestPath = path.posix.join(path.posix.dirname(filePath), '..', 'package.json');
+    const packageJson = parseJsonFile(manifestPath, files[manifestPath] ?? '', 'fixture');
+    if (!isRecord(packageJson)) {
+      throw new Error(`Expected ${manifestPath} to contain a JSON object`);
+    }
+    packageJson.devDependencies = {
+      ...(isRecord(packageJson.devDependencies) ? packageJson.devDependencies : {}),
+      [STORYBOOK_MCP_ADDON]: WORKSPACE_SPEC,
+    };
+    files[manifestPath] = JSON.stringify(packageJson, null, 2).concat('\n');
+  }
+}
+
 function parseJsonFile(filePath: string, content: string, source: 'fixture' | 'template'): unknown {
   try {
     return JSON.parse(content) as unknown;
@@ -628,6 +665,11 @@ function readPackedTarballs(packages: WorkspacePackage[]): Record<string, string
 export async function readTemplateCheckoutPackages(): Promise<WorkspacePackage[]> {
   const workspace = await readStorybookWorkspace();
   const packages = new Map<string, WorkspacePackage>();
+  // No manifest lists the addon: setup adds it for the MCP experiments.
+  const mcpAddon = workspace.get(STORYBOOK_MCP_ADDON);
+  if (mcpAddon) {
+    packages.set(mcpAddon.name, mcpAddon);
+  }
   for (const sourceDir of [TEMPLATES_DIR, EVALS_DIR]) {
     for await (const manifestPath of fs.glob('**/package.json', {
       cwd: sourceDir,
```

**File**: `agent-eval/templates/monorepo/packages/ui/.storybook/main.ts` (modified, +1/-6)
```diff
@@ -2,12 +2,7 @@ import type { StorybookConfig } from '@storybook/react-vite';
 
 const config: StorybookConfig = {
   stories: ['../@(stories|src)/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
-  addons: [
-    '@storybook/addon-a11y',
-    '@storybook/addon-vitest',
-    '@storybook/addon-docs',
-    '@storybook/addon-mcp',
-  ],
+  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest', '@storybook/addon-docs'],
   framework: '@storybook/react-vite',
 };
 export default config;
```

---

### Incident Patch 14: `572958f4` (2026-10-05)
**Commit Message**: Docs: add the Svelte CSF entries to the migration guide

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `MIGRATION.md` (modified, +188/-0)
```diff
@@ -40,6 +40,8 @@
   - [`--preview-url` and `--force-build-preview` removed](#--preview-url-and---force-build-preview-removed)
   - [Automigrations for Storybook 10 and earlier removed](#automigrations-for-storybook-10-and-earlier-removed)
   - [Web Components: server-side docgen suffixes event, slot and part argType keys](#web-components-server-side-docgen-suffixes-event-slot-and-part-argtype-keys)
+  - [Svelte CSF is built into the Svelte frameworks](#svelte-csf-is-built-into-the-svelte-frameworks)
+  - [Svelte CSF: legacy story syntax removed](#svelte-csf-legacy-story-syntax-removed)
 - [From version 10.5.x to 10.6.0](#from-version-105x-to-1060)
   - [Vue 3: `vue-docgen-api` is deprecated](#vue-3-vue-docgen-api-is-deprecated)
   - [Experimental Playwright CT integration removed](#experimental-playwright-ct-integration-removed)
@@ -1207,6 +1209,192 @@ argTypes: { 'my-change': { table: { disable: true } } },
 argTypes: { 'my-change-event': { table: { disable: true } } },
 ```
 
+### Svelte CSF is built into the Svelte frameworks
+
+`@storybook/svelte-vite` and `@storybook/sveltekit` now include Svelte CSF, so you no longer need `@storybook/addon-svelte-csf`. Storybook doesn't start while the addon is still in `addons`.
+
+Run the automigration:
+
+```sh
+npx storybook automigrate addon-svelte-csf-to-core
+```
+
+The automigration changes your stories and the files in your Storybook config directory. Change other files that import from `@storybook/addon-svelte-csf` by hand.
+
+Or migrate by hand:
+
+1. Remove `@storybook/addon-svelte-csf` from `addons` in `.storybook/main.js|ts`, and from your `package.json`.
+2. Import Svelte CSF from your framework package. The exports keep their names.
+
+```diff
+- import { defineMeta, type Args } from '@storybook/addon-svelte-csf';
++ import { defineMeta, type Args } from '@storybook/sveltekit'; // or '@storybook/svelte-vite'
+```
+
+The error codes stay the same. Their docs are in [`code/renderers/svelte/src/svelte-csf/ERRORS.md`](https://github.com/storybookjs/storybook/blob/next/code/renderers/svelte/src/svelte-csf/ERRORS.md).
+
+### Svelte CSF: legacy story syntax removed
+
+Svelte CSF supports only stories defined with `defineMeta`. Storybook 11 removes these parts of the legacy syntax:
+
+- The `<Meta>` component and `export const meta`
+- The `<Template>` component, and the `legacyTemplate` option that turned it on
+- The `let:args` and `let:context` directives on `<Story>`
+
+The automigration lists the story files that don't use `defineMeta`, and doesn't change them. Migrate them by hand.
+
+<details>
+<summary>Migrate legacy stories to <code>defineMeta</code></summary>
+
+#### `<Meta>` component
+
+Before:
+
+```svelte
+<script>
+  import { Meta } from '@storybook/addon-svelte-csf';
+
+  import Button from './Button.svelte';
+</script>
+
+<Meta title="Atoms/Button" component={Button} args={{ size: 'medium' }} />
+```
+
+After:
+
+```svelte
+<script module>
+  import { defineMeta } from '@storybook/sveltekit'; // or '@storybook/svelte-vite'
+
+  import Button from './Button.svelte';
+
+  const { Story } = defineMeta({
+    title: 'Atoms/Button',
+    component: Button,
+    args: {
+      size: 'medium',
+    },
+  });
+</script>
+```
+
+#### `export const meta`
+
+Before:
+
+```svelte
+<script module>
+  import { Story } from '@storybook/addon-svelte-csf';
+
+  import Button from './Button.svelte';
+
+  export const meta = {
+    title: 'Atoms/Button',
+    component: Button,
+    args: {
+      size: 'medium',
+    },
+  };
+</script>
+
+<Story name="Default" />
+```
+
+After:
+
+```svelte
+<script module>
+  import { defineMeta } from '@storybook/sveltekit'; // or '@storybook/svelte-vite'
+
+  import Button from './Button.svelte';
+
+  const { Story } = defineMeta({
+    title: 'Atoms/Button',
+    component: Button,
+    args: {
+      size: 'medium',
+    },
+  });
+</script>
+
+<Story name="Default" />
+```
+
+#### `let:args` and `let:context`
+
+Use a `template` snippet. Its first argument is the args, and its optional second argument is the story context.
+
+Before:
+
+```svelte
+<Story name="Default" let:args let:context>
+  <Button {...args} />
+  <div>Story name: {context.name}</div>
+</Story>
+```
+
+After:
+
+```svelte
+<Story name="Default">
+  {#snippet template(args, context)}
+    <Button {...args} />
+    <div>Story name: {context.name}</div>
+  {/snippet}
+</Story>
+```
+
+#### `<Template>` component
+
+A story without a template renders the component from `defineMeta`, with the args as props. So you can remove a `<Template>` that only renders the component.
+
+To share a template between stories, define a snippet at the top level of the file, and pass it to each story:
+
+```svelte
+{#snippet template(args)}
+  <Button {...args}>Click me</Button>
+{/snippet}
+
+<Story name="Primary" args={{ primary: true }} {template} />
+<Story name="Secondary" args={{ primary: false }} {template} />
+```
+
+To use the same template for all stories in the 
```

---

### Incident Patch 15: `e937141e` (2026-10-05)
**Commit Message**: CLI: add an automigration from addon-svelte-csf to the built-in Svelte CSF

The addon-svelte-csf-to-core fix removes @storybook/addon-svelte-csf from
main.js addons and package.json, and rewrites the addon imports to the
framework package (@storybook/svelte-vite or @storybook/sveltekit) in the
stories and the config files. It merges the rewritten import into an
existing import from the framework package. Its prompt lists the files it
changes. It lists the story files that use the legacy syntax and leaves
them unchanged, because they must be migrated by hand.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `code/lib/cli-storybook/src/automigrate/fixes/addon-svelte-csf-to-core.test.ts` (added, +415/-0)
```diff
@@ -0,0 +1,415 @@
+import { readFile, writeFile } from 'node:fs/promises';
+import { resolve } from 'node:path';
+
+import { beforeEach, describe, expect, it, vi } from 'vitest';
+
+import { type JsPackageManager, removeAddon } from 'storybook/internal/common';
+import { logger } from 'storybook/internal/node-logger';
+import type { StorybookConfigRaw } from 'storybook/internal/types';
+
+import { fs, vol } from 'memfs';
+import { dedent } from 'ts-dedent';
+
+import { createFixFiles } from '../fix-files.ts';
+import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
+import type { CheckOptions, RunOptions } from '../types.ts';
+import {
+  type AddonSvelteCsfToCoreResult,
+  addonSvelteCsfToCore,
+} from './addon-svelte-csf-to-core.ts';
+
+vi.mock('node:fs/promises', { spy: true });
+vi.mock('storybook/internal/common', { spy: true });
+vi.mock('storybook/internal/node-logger', { spy: true });
+// The pipeline globs the config directory; real globby, reading the in-memory file system.
+vi.mock('globby', async (importOriginal) => {
+  const { globby } = await importOriginal<typeof import('globby')>();
+  const { fs: memoryFs } = await import('memfs');
+  return {
+    globby: (patterns: string, options: object) =>
+      globby(patterns, { ...options, fs: memoryFs as never }),
+  };
+});
+
+const MAIN = resolve('/project/.storybook/main.ts');
+const DECORATORS = resolve('/project/.storybook/decorators.ts');
+const STORY = resolve('/project/src/Button.stories.svelte');
+const LEGACY_STORY = resolve('/project/src/Legacy.stories.svelte');
+const HELPER = resolve('/project/src/lib/args.ts');
+const DOCS = resolve('/project/src/Button.mdx');
+
+const mainConfigFile = (addon: string) => dedent`
+  import type { StorybookConfig } from '@storybook/sveltekit';
+
+  const config: StorybookConfig = {
+    stories: ['../src/**/*.stories.@(ts|svelte)'],
+    addons: ['@storybook/addon-docs', ${addon}],
+    framework: '@storybook/sveltekit',
+  };
+  export default config;
+`;
+
+// `vol.fromJSON` creates the parent directories, which `vol.writeFileSync` does not.
+const write = (path: string, content: string) => vol.fromJSON({ [path]: content });
+
+const STORY_FILE = dedent`
+  <script module>
+    import { defineMeta } from '@storybook/addon-svelte-csf';
+  </script>
+`;
+
+const LEGACY_STORY_FILE = dedent`
+  <script>
+    import { Meta, Story } from '@storybook/addon-svelte-csf';
+  </script>
+
+  <Meta title="Button" />
+`;
+
+describe('addon-svelte-csf-to-core', () => {
+  const packageManager = {
+    getAllDependencies: vi.fn(),
+  } as unknown as JsPackageManager;
+
+  const storyFiles = () =>
+    Object.keys(vol.toJSON()).filter((path) => path.includes('.stories.') || path.endsWith('.mdx'));
+
+  const mainConfig = { framework: '@storybook/sveltekit', addons: ['@storybook/addon-svelte-csf'] };
+
+  const check = (config: Partial<StorybookConfigRaw> = mainConfig, storybookVersion = '11.0.0') =>
+    checkFix(addonSvelteCsfToCore, {
+      packageManager,
+      mainConfig: config,
+      storybookVersion,
+      storiesPaths: storyFiles(),
+      configDir: resolve('/project/.storybook'),
+      mainConfigPath: MAIN,
+      files: createFixFiles().files,
+    } as unknown as CheckOptions);
+
+  const migrate = async (config: Partial<StorybookConfigRaw> = mainConfig) => {
+    const result = await check(config);
+    await runFix(addonSvelteCsfToCore, {
+      result,
+      packageManager,
+      mainConfigPath: MAIN,
+      configDir: resolve('/project/.storybook'),
+      storiesPaths: storyFiles(),
+      storybookVersion: '11.0.0',
+    } as unknown as Omit<RunOptions<AddonSvelteCsfToCoreResult>, 'files'>);
+    return vol.toJSON();
+  };
+
+  beforeEach(() => {
+    vi.clearAllMocks();
+    vol.reset();
+    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
+    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
+    vi.mocked(logger.warn).mockImplementation(() => {});
+    vi.mocked(removeAddon).mockResolvedValue(undefined);
+    vi.mocked(packageManager.getAllDependencies).mockReturnValue({
+      '@storybook/addon-svelte-csf': '^5.1.5',
+    });
+    vol.fromJSON({
+      [MAIN]: mainConfigFile("'@storybook/addon-svelte-csf'"),
+      [STORY]: STORY_FILE,
+    });
+  });
+
+  describe('check', () => {
+    it('applies when the addon is in addons as a string', async () => {
+      await expect(check()).resolves.toEqual({
+        framework: '@storybook/sveltekit',
+        mainConfigPath: MAIN,
+        importFiles: [STORY],
+        legacyStoryFiles: [],
+        legacyTemplate: false,
+      });
+    });
+
+    it('applies when the addon is in addons as an object', async () => {
+      const result = await check({
+        framework: { name: '@storybook/svelte-vite', options: {} },
+        addons: [{ name: '@storybook/addon-svelte-csf', options: {} }],
+      });
+
+      expect(result?.framework).toBe('@storybook/svelte-vite');

```

**File**: `code/lib/cli-storybook/src/automigrate/fixes/addon-svelte-csf-to-core.ts` (added, +296/-0)
```diff
@@ -0,0 +1,296 @@
+import { resolve } from 'node:path';
+
+import { parser, traverse, types as t } from 'storybook/internal/babel';
+import { normalizeAddonName, removeAddon } from 'storybook/internal/common';
+import { logger } from 'storybook/internal/node-logger';
+import type { StorybookConfigRaw } from 'storybook/internal/types';
+
+import picocolors from 'picocolors';
+import { dedent } from 'ts-dedent';
+
+import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
+import { isAtOrPastVersion } from '../helpers/versionBoundary.ts';
+import { type FileKind, collectFiles } from '../pipeline.ts';
+import type { Fix } from '../types.ts';
+
+const ADDON_SVELTE_CSF = '@storybook/addon-svelte-csf';
+const SVELTE_CSF_FRAMEWORKS = ['@storybook/svelte-vite', '@storybook/sveltekit'];
+const MIGRATION_GUIDE = 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md';
+const LEGACY_SYNTAX_LINK = `${MIGRATION_GUIDE}#svelte-csf-legacy-story-syntax-removed`;
+
+// `from '…'`, `import '…'` and `import('…')`, but not other strings such as an `addons` entry.
+// Only for files that don't parse, and MDX.
+const ADDON_IMPORT =
+  /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"`])@storybook\/addon-svelte-csf\2/g;
+// JSDoc type imports, such as `@type {import('…').Args}`.
+const COMMENT_IMPORT = /(\bimport\s*\(\s*)(['"`])@storybook\/addon-svelte-csf\2/g;
+// Attribute values such as `generics="T extends Record<string, unknown>"` can contain `>`.
+const SCRIPT_BLOCK = /(<script\b(?:[^>"']|"[^"]*"|'[^']*')*>)([\s\S]*?)(<\/script>)/g;
+const REWRITTEN_KINDS: FileKind[] = ['main', 'preview', 'manager', 'config', 'story'];
+
+export interface AddonSvelteCsfToCoreResult {
+  framework: string;
+  // Set when the addon is in `addons`, so the main config changes too.
+  mainConfigPath?: string;
+  importFiles: string[];
+  // Stories without `defineMeta`. The fix leaves them for the user to migrate by hand.
+  legacyStoryFiles: string[];
+  legacyTemplate: boolean;
+}
+
+const isAddonSvelteCsf = (addon: NonNullable<StorybookConfigRaw['addons']>[number]) =>
+  normalizeAddonName(addon) === ADDON_SVELTE_CSF;
+
+const needsLegacyWarning = (result: AddonSvelteCsfToCoreResult) =>
+  result.legacyTemplate || result.legacyStoryFiles.length > 0;
+
+const parse = (code: string) => {
+  // A `.ts` file with `<T>(x: T) => x` or `<T>value` only parses without JSX.
+  for (const plugins of [['typescript', 'jsx'], ['typescript']] as const) {
+    try {
+      return parser.parse(code, { sourceType: 'module', plugins: [...plugins] });
+    } catch {}
+  }
+  return undefined;
+};
+
+// Change the module name of the addon's imports, but not other strings or comments that name it.
+const renameImports = (code: string, framework: string) => {
+  const ast = parse(code);
+  if (!ast) {
+    return code.replace(ADDON_IMPORT, `$1$2${framework}$2`);
+  }
+  const ranges: { start: number; end: number }[] = [];
+  const addSource = (node: t.Node | null | undefined) => {
+    const name = t.isStringLiteral(node)
+      ? node.value
+      : t.isTemplateLiteral(node) && node.expressions.length === 0
+        ? node.quasis[0].value.cooked
+        : undefined;
+    if (node && name === ADDON_SVELTE_CSF) {
+      ranges.push({ start: node.start! + 1, end: node.end! - 1 });
+    }
+  };
+  traverse(ast, {
+    ImportDeclaration: ({ node }) => addSource(node.source),
+    ExportNamedDeclaration: ({ node }) => addSource(node.source),
+    ExportAllDeclaration: ({ node }) => addSource(node.source),
+    CallExpression: ({ node }) => {
+      if (t.isImport(node.callee)) {
+        addSource(node.arguments[0]);
+      }
+    },
+    TSImportType: ({ node }) => {
+      const argument = node.argument as t.Node;
+      addSource(t.isTSLiteralType(argument) ? argument.literal : argument);
+    },
+  });
+  for (const comment of ast.comments ?? []) {
+    for (const match of comment.value.matchAll(COMMENT_IMPORT)) {
+      // Comment values start after `//` or `/*`.
+      const start = comment.start! + 2 + match.index + match[1].length + 1;
+      ranges.push({ start, end: start + ADDON_SVELTE_CSF.length });
+    }
+  }
+  return ranges
+    .sort((a, b) => b.start - a.start)
+    .reduce(
+      (result, { start, end }) => result.slice(0, start) + framework + result.slice(end),
+      code
+    );
+};
+
+// Without this, a file that already imports from the framework package ends up with two imports.
+const mergeImports = (code: string, source: string) => {
+  const ast = parse(code);
+  if (!ast) {
+    return code;
+  }
+
+  const groups = new Map<string, t.ImportDeclaration[]>();
+  for (const node of ast.program.body) {
+    if (
+      t.isImportDeclaration(node) &&
+      node.source.value === source &&
+      node.specifiers.length > 0 &&
+      node.specifiers.every((specifier) => t.isImportSpecifier(specifier))
+    ) {
+      const kind = node.importKind ?? 'value';
+      groups.set(kind, [...(groups.get(kind) ?? []), node]);
+    }
+ 
```

**File**: `code/lib/cli-storybook/src/automigrate/fixes/index.ts` (modified, +2/-0)
```diff
@@ -4,6 +4,7 @@ import { angularToAngularVite } from './angular-to-angular-vite.ts';
 import { angularViteRemoveCompodoc } from './angular-vite-remove-compodoc.ts';
 import { csfNextMockedArgs } from './csf-next-mocked-args.ts';
 import { addonMcp } from './addon-mcp.ts';
+import { addonSvelteCsfToCore } from './addon-svelte-csf-to-core.ts';
 import { argtypesDefaultValue } from './argtypes-default-value.ts';
 import { componentSubtitle } from './component-subtitle.ts';
 import { eslintPlugin } from './eslint-plugin.ts';
@@ -34,6 +35,7 @@ export const allFixes: Fix[] = [
   angularToAngularVite,
   angularViteRemoveCompodoc,
   reactViteToTanstackReact,
+  addonSvelteCsfToCore,
   addonMcp,
   wrapGetAbsolutePath,
   storybookPackageNameConflict,
```

#### Recent Merged Pull Requests:
- **PR #36603** (2026-10-05): Svelte: Fix the Svelte CSF automigration unit tests on Windows (@JReinhold)
- **PR #36602** (2026-10-05): Core: Point the tools CLI at a private composed Storybook's own MCP (@kasperpeulen)
- **PR #36601** (2026-10-05): Tools: Use strict input schemas so CLI and MCP reject unknown arguments (@kasperpeulen)
- **PR #36598** (2026-10-05): Core: Mark a review stale only on changes made after it was published (@kasperpeulen)
- **PR #36597** (2026-10-05): Svelte: Support Svelte CSF in core (@JReinhold)
- **PR #36595** (2026-10-05): Svelte: Remove the deprecated Svelte CSF Story props id, autodocs and source (@JReinhold)
- **PR #36594** (2026-10-05): Core: Make experimental_devServer await the services preset (@kasperpeulen)
- **PR #36592** (2026-10-05): Svelte: Show the cause of the Svelte CSF IndexerParseError (0009) (@JReinhold)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
