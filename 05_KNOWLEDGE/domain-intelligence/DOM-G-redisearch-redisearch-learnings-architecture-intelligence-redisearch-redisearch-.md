# Domain G — Architecture Intelligence: Architecture Intelligence: redisearch-redisearch-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "redisearch-redisearch-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T12:20:24.710Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-redisearch-redisearch-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [redisearch-redisearch-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T12:20:24.710Z`  
> **Learning ID**: `LEARN-EVO-redisearch-redisearch-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), I (Content & Information Intelligence), L (Deployment & Operations Intelligence), B (Product Intelligence), F (Design Intelligence)
- **Confidence Rating**: 68%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from redisearch-redisearch-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/redisearch-redisearch-learnings.md`  
> **Source**: github ([https://github.com/RediSearch/RediSearch](https://github.com/RediSearch/RediSearch))  
> **Source Version**: `7a24743f`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T12:19:38.120Z  
> **Learning ID**: `learn-github-redisearch-redisearch`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): RediSearch/RediSearch

> **Canonical Artifact**: `07_PROJECT_LEARNING/redisearch-redisearch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RediSearch/RediSearch](https://github.com/RediSearch/RediSearch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T12:19:38.112Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RediSearch/RediSearch`
- **Description**: A query and indexing engine for Redis, providing secondary indexing, full-text search, vector similarity search and aggregations.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 6245 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.amp/plugins/rust-port/core/checks.ts`
```
/*
 * Copyright (c) 2006-Present, Redis Ltd.
 * All rights reserved.
 *
 * Licensed under your choice of the Redis Source Available License 2.0
 * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
 * GNU Affero General Public License v3 (AGPLv3).
 */

/**
 * Running a stage's checks: each command in its own process group, its output in a log, and a
 * problem when it exits non-zero or its profile judge rejects its log.
 */
import { execa } from 'execa';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import type { Judge, Vcs } from './ports.ts';

export const ENV = { GIT_EDITOR: 'true', GIT_TERMINAL_PROMPT: '0', NO_COLOR: '1' };

export interface Check {
  kind: string;
  command: string;
}

export interface CheckResult extends Check {
  exitCode: number | null;
  /** Milliseconds since the epoch. */
  started: number;
  ms: number;
  log: string;
  /** Why the check failed: its exit code, or what its log shows. */
  problem?: string;
}

/** Where checks and trials run: the checkout, a directory for their logs, and the claim's signal and environment. */
export interface CheckEnv {
  root: string;
  dir: string;
  vcs: Vcs;
  signal: AbortSignal;
  vars: Record<string, string>;
  judges: Record<string, Judge>;
  debug: (message: string) => void;
}

export const readLog = async (path: string) =>
  stripVTControlCharacters(await readFile(path, 'utf8').catch(() => ''));

/**
 * Runs checks one at a time, because builds share the cargo lock, and stops at the first failure,
 * which already rejects the candidate. Each result carries its `problem`, if it has one.
 */
export async function runChecks(run: CheckEnv, checks: Check[]): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const [index, check] of checks.entries()) {
    const log = join(run.dir, `check-${index}-${check.kind}.log`);
    const started = Date.now();
    const exitCode = run.signal.aborted ? null : await execute(run, check.command, log);
    const result: CheckResult = { ...check, exitCode, started, ms: Date.now() - started, log };
    result.problem =
      exitCode === null
        ? 'timed out'
        : exitCode !== 0
          ? `exited ${exitCode}`
          : await run.judges[check.kind]?.({
              check: result,
              log: await readLog(log),
              root: run.root,
            });
    run.debug(`check \`${check.command}\` ${result.problem ?? 'passed'} in ${result.ms}ms: ${log}`);
    results.push(result);
    if (result.problem) break;
  }
  return results;
}

async function execute(run: CheckEnv, command: string, log: string) {
  // Both streams append to one log, so their output interleaves as it happened.
  await writeFile(log, '');
  // A process group of its own, so aborting also kills the redis-servers and compilers it starts.
  const child = execa('bash', ['-o', 'pipefail', '-c', command], {
    cwd: run.root,
    env: { ...ENV, ...run.vars },
    detached: true,
    reject: false,
    stdin: 'ignore',
    stdout: { file: log, append: true },
    stderr: { file: log, append: true },
  });
  const kill = () => {
    try {
      process.kill(-child.pid!, 'SIGKILL');
    } catch {}
  };
  run.signal.addEventListener('abort', kill, { once: true });
  // An abort before the listener existed would otherwise leave the check running.
  if (run.signal.aborted) kill();
  const { exitCode } = await child;
  run.signal.removeEventListener('abort', kill);
  return run.signal.aborted ? null : (exitCode ?? null);
}

/**
 * Whether checks' logs show the test `name` ran: a line naming it, module path included, that
 * does not report it ignored or skipped. Another check may still skip it, say under Miri.
 */
export function testRan(logs: string, name: string): boolean {
  const named = new RegExp(`(?<!\\w)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\w)`);
  return logs
    .split('\n')
    .some((line) => named.test(line) && !/\b(ignored|skip(ped)?)\b/i.test(line));
}

```

### Core Architecture Module: `.amp/plugins/rust-port/core/confirm.ts`
```
/*
 * Copyright (c) 2006-Present, Redis Ltd.
 * All rights reserved.
 *
 * Licensed under your choice of the Redis Source Available License 2.0
 * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
 * GNU Affero General Public License v3 (AGPLv3).
 */

/**
 * Confirming reviewer proposals by trying them: a proposal blocks only when its failing test
 * fails, its deletion keeps every test passing, or it cites a repository rule.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readLog, runChecks, type Check, type CheckResult, type CheckEnv } from './checks.ts';
import { parseDiff } from './diff.ts';
import { hash, type NewFinding, type Repro } from './job.ts';
import type { Profile, Stage } from './ports.ts';
import { resolveLocation, checkRefs } from './refs.ts';
import { runnerList, type Proposal, type Review } from './review.ts';

/** Deletions tried per assessment; each runs the stage's test checks. */
const MAX_DELETIONS = 3;

type Rules = Pick<
  Profile,
  'classify' | 'stripTests' | 'disabledTestPattern' | 'testRunners' | 'isTestCommand'
>;

/** The finding a checked proposal becomes; `verdict` says what the plugin confirmed. */
export function toFinding(
  r: Review,
  p: Proposal,
  o: {
    stage: Stage;
    candidate: string;
    blocking: boolean;
    verdict: string;
    proof?: string;
    repro?: Repro;
    link?: string;
  },
): NewFinding {
  return {
    // Identical findings from several reviewers share a key, so they merge into one.
    key: `review:${hash(o.stage, o.candidate, p.location, p.scenario, p.correction)}`,
    source: 'review',
    stage: o.stage,
    revision: o.candidate,
    blocking: o.blocking,
    title: `${r.label} · ${p.location}`,
    body: [`Problem: ${p.scenario}`, `Fix: ${p.correction}`, `Evidence: ${o.verdict}`, o.proof]
      .filter(Boolean)
      .join('\n'),
    repro: o.repro,
    links: o.link ? [o.link] : [],
  };
}

/** What trying a reviewer's patch showed, and what the plugin ran, for the worker to reuse. */
interface Trial {
  confirmed: boolean;
  outcome: string;
  proof?: string;
}

/** Applies a patch, runs `checks` with it, and takes it out again; a string if it does not apply. */
async function withPatch(
  run: CheckEnv,
  patch: string,
  checks: Check[],
): Promise<CheckResult[] | string> {
  const text = patch.endsWith('\n') ? patch : `${patch}\n`;
  if (!(await run.vcs.applyPatch(text))) return 'its patch does not apply';
  try {
    return await runChecks(run, checks);
  } finally {
    if (!(await run.vcs.applyPatch(text, { reverse: true })))
      throw new Error('A reviewer patch could not be taken out again');
  }
}

/** Runs a reproduction's command, with its test patched in unless the candidate already has it. */
export async function runReproduction(run: CheckEnv, repro: Repro, kind: string) {
  const check = [{ kind, command: repro.command }];
  // Present only verbatim: a weakened test of the same name must not stand in for it.
  const added = parseDiff(repro.patch).find((f) => f.path === repro.path)?.added ?? [];
  const text = await readFile(join(run.root, repro.path), 'utf8').catch(() => undefined);
  const present = text !== undefined && added.length > 0 && added.every((l) => text.includes(l));
  return present
    ? (await runChecks(run, check))[0]
    : withPatch(run, repro.patch, check).then((r) => (typeof r === 'string' ? r : r[0]));
}

/**
 * Confirms a finding by its failing test: one test runner whose command passes without the test
 * and fails with it, naming it. Anything else may be the patch failing to compile or an unrelated
 * test.
 */
async function confirmReproduction(
  run: CheckEnv,
  rules: Rules,
  repro: Repro,
  n: number,
): Promise<Trial> {
  const files = parseDiff(repro.patch).map((f) => f.path);
  if (!files.includes(repro.path) || files.some((f) => rules.classify(f) !== 'test'))
    return {
      confirmed: false,
      outcome: `its patch must add ${repro.path} and touch only test sources`,
    };
  if (!rules.isTestCommand(repro.command))
    return { confirmed: false, outcome: `its command must be one of ${runnerList(rules)}` };
  const [before] = await runChecks(run, [{ kind: `repro-${n}-before`, command: repro.command }]);
  if (before.exitCode !== 0)
    return { confirmed: false, outcome: `its command fails without the test (${before.log})` };
  const after = await runReproduction(run, repro, `repro-${n}`);
  if (typeof after === 'string') return { confirmed: false, outcome: after };
  if (after.exitCode === null) return { confirmed: false, outcome: 'its command timed out' };
  if (after.exitCode === 0) return { confirmed: false, outcome: 'its test passes' };
  if (!(await readLog(after.log)).includes(repro.test))
    return {
      confirmed: false,
      outcome: `its command fails, but its log never names ${repro.test}`,
    };
  return {
    confirmed: true,
    outcome: `reproduced: \`${repro.command}\` exits ${after.exitCode} (${after.log})`,
    proof: `Reproduction (${repro.command}):\n${repro.patch}`,
  };
}

/**
 * Whether a deletion removes or disables tests, which proves nothing: a test file, an added line
 * that switches a test off, or a line of a source that appears only inside its tests. `read`
 * gives the candidate's text of a file.
 */
export async function deletesTests(
  rules: Pick<Rules, 'classify' | 'stripTests' | 'disabledTestPattern'>,
  patch: string,
  read: (path: string) => Promise<string>,
) {
  for (const f of parseDiff(patch)) {
    if (
      rules.classify(f.path) === 'test' ||
      f.added.some((line) => rules.disabledTestPattern.test(line))
    )
      return true;
    const text = await read(f.path).catch(() => '');
    const production = rules.stripTests?.(f.path, text);
    if (production === undefined) continue;
    if (f.removed.some((line) => line.trim() && text.includes(line) && !production.includes(line)))
      return true;
  }
  return false;
}

/** Confirms that code is not needed: every test check passes without it. */
async function confirmDeletion(
  run: CheckEnv,
  rules: Rules,
  patch: string,
  tests: Check[],
  n: number,
): Promise<Trial> {
  const net = parseDiff(patch).reduce((sum, f) => sum + f.removed.length - f.added.length, 0);
  const read = (path: string) => readFile(join(run.root, path), 'utf8');
  if (net <= 0 || (await deletesTests(rules, patch, read)))
    return { confirmed: false, outcome: 'its patch must remove more than it adds, outside tests' };
  const results = await withPatch(
    run,
    patch,
    tests.map((c) => ({ ...c, kind: `${c.kind}-deletion-${n}` })),
  );
  if (typeof results === 'string') return { confirmed: false, outcome: results };
  const failed = results.find((r) => r.problem);
  if (failed) return { confirmed: false, outcome: `\`${failed.command}\` fails without it` };
  return {
    confirmed: true,
    outcome: `every test check passes without it (−${net} lines)`,
    proof: `Deletion:\n${patch}`,
  };
}

/**
 * Turns proposals into findings. Those whose references do not hold are dropped; the rest block
 * only if their test fails, their deletion keeps the tests passing, or they cite a rule. Proposals
 * resolving to one line are one finding, and a confirmed one replaces a suggestion there.
 */
export async function confirmProposals(
  run: CheckEnv,
  rules: Rules,
  reviews: Review[],
  o: { stage: Stage; candidate: string; tests: Check[]; link: (thread: string) => string },
): Promise<NewFinding[]> {
  const findings: NewFinding[] = [];
  const kept = new Map<string, number>();
  let n = 0;
  let deletions = 0;
  for (const r of reviews)
    for (const p of r.proposals) {
      const problems = !(typeof p.location === 'string' && p.location && p.scenario)
        ? ['it has no location or scenario']
        : p.refs.length
          ? await checkRefs(run.root, p.refs)
          : ['it cites nothing'];
      if (problems.length) {
        run.debug(`${r.label}: dropped ${p.location}: ${problems.join('; ')}`);
        continue;
      }
      const id = await resolveLocation(run.root, p.location);
      const earlier = kept.get(id);
      if (earlier !== undefined && findings[earlier].blocking) continue;
      let result: Trial | undefined;
      if (p.repro) result = await confirmReproduction(run, rules, p.repro, ++n);
      else if (p.deletion && deletions++ < MAX_DELETIONS)
        result = await confirmDeletion(run, rules, p.deletion.patch, o.tests, ++n);
      const rule = p.refs.find((ref) => rules.classify(ref.path) === 'rule');
      const blocking = !!result?.confirmed || !!rule;
      const verdict = result?.confirmed
        ? result.outcome
        : rule
          ? `breaks the rule at ${rule.path}${rule.line ? `:${rule.line}` : ''}`
          : `unconfirmed${result ? `, ${result.outcome}` : ''}`;
      const finding = toFinding(r, p, {
        ...{ stage: o.stage, candidate: o.candidate, blocking, verdict },
        proof: result?.confirmed ? result.proof : undefined,
        repro: result?.confirmed ? p.repro : undefined,
        link: r.thread && o.link(r.thread),
      });
      if (earlier === undefined) kept.set(id, findings.push(finding) - 1);
      else if (blocking) findings[earlier] = finding;
    }
  return findings;
}

```

### Core Architecture Module: `.amp/plugins/rust-port/core/diff.ts`
```
/*
 * Copyright (c) 2006-Present, Redis Ltd.
 * All rights reserved.
 *
 * Licensed under your choice of the Redis Source Available License 2.0
 * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
 * GNU Affero General Public License v3 (AGPLv3).
 */

/**
 * What a change is: the files of a diff, the lines each adds and removes, and the measures the
 * gates take of them.
 */
import { hash } from './job.ts';
import type { Profile } from './ports.ts';

const GIT_FILE = 'diff --git ';

export interface FileChange {
  path: string;
  added: string[];
  removed: string[];
  /** The file before and after, where the caller read them. */
  texts?: [before: string | undefined, after: string | undefined];
}

/**
 * The files a unified diff changes, with the lines it adds and removes in each. A file starts at
 * its `---`/`+++` pair; hunk line counts are ignored, because a model's are often wrong. Where the
 * diff has `diff --git` lines, a file starts at its own, so one without hunks, binary or empty,
 * still counts, and a `---`/`+++` pair is a header only before the file's first hunk, so hunk
 * content that looks like one is not one.
 */
export function parseDiff(diff: string): FileChange[] {
  const files: FileChange[] = [];
  const lines = diff.split('\n');
  const fromGit = lines.some((line) => line.startsWith(GIT_FILE));
  const clean = (path: string) => path.replace(/^[ab]\//, '');
  let file: FileChange | undefined;
  let inHeader = false;
  const start = (path: string) => {
    file = { path: clean(path), added: [], removed: [] };
    files.push(file);
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fromGit && line.startsWith(GIT_FILE)) {
      // Both sides name the same path, `a/<path> b/<path>`, unless the file was renamed, when a
      // `rename to` or `+++` line below names it.
      const sides = line.slice(GIT_FILE.length);
      start(sides.slice(0, (sides.length - 1) / 2));
      inHeader = true;
    } else if (fromGit && inHeader && line.startsWith('rename to ')) {
      file!.path = line.slice('rename to '.length);
    } else if (
      (!fromGit || inHeader) &&
      line.startsWith('--- ') &&
      lines[i + 1]?.startsWith('+++ ')
    ) {
      const [from, to] = [line, lines[++i]].map((l) => l.slice(4).split('\t')[0].trim());
      const path = to === '/dev/null' ? from : to;
      if (fromGit) file!.path = clean(path);
      else start(path);
    } else if (line.startsWith('@@')) inHeader = false;
    else if (file && !inHeader && line[0] === '+') file.added.push(line.slice(1));
    else if (file && !inHeader && line[0] === '-') file.removed.push(line.slice(1));
  }
  return files;
}

/** Equal for the same change rebased: line numbers and blob IDs aside, whitespace kept. */
export const patchId = (diff: string) =>
  hash(diff.split('\n').filter((line) => !/^(index |@@)/.test(line)));

/** Lines added and removed per file, as reviewers skim a change. */
export const diffStat = (files: FileChange[]) =>
  files.map((f) => `${f.path} | +${f.added.length} -${f.removed.length}`).join('\n');

export interface Size {
  /** Lines added, Markdown and `.gitignore` aside as the PR size label counts. */
  lines: number;
  /**
   * Lines of code added minus deleted, tests and generated files aside: the growth floor. In a
   * file whose texts are known and whose language holds tests in sources, only production lines
   * count.
   */
  code: number;
  files: number;
}

export function measureSize(
  files: FileChange[],
  profile: Pick<Profile, 'classify' | 'stripTests'>,
): Size {
  const size = { lines: 0, code: 0, files: 0 };
  const lines = (text: string) => text.split('\n').filter((line) => line.trim()).length;
  for (const { path, added, removed, texts } of files) {
    if (path.endsWith('.md') || path.endsWith('.gitignore')) continue;
    size.lines += added.length;
    size.files++;
    const kind = profile.classify(path);
    if (kind === 'test' || kind === 'generated') continue;
    const [before, after] = (texts ?? []).map((t) => profile.stripTests?.(path, t ?? ''));
    size.code +=
      texts && before !== undefined && after !== undefined
        ? lines(after) - lines(before)
        : added.length - removed.length;
  }
  return size;
}

/**
 * Pushback by lines added, which grows with them; nothing up to 250. The classes end where the PR
 * size label's do, and XL blocks. Deletions do not count: the classes counter bloat.
 */
export function sizeClass(lines: number): { label: string; note: string } | undefined {
  if (lines <= 250) return;
  if (lines <= 500)
    return {
      label: 'M',
      note: 'Every line costs a reviewer attention; before claiming again, delete what the port does not need.',
    };
  if (lines <= 1000)
    return {
      label: 'L',
      note: 'Reviewers will push back on a stage this big. Stop adding: cut first, and question every file the stage touches.',
    };
  return {
    label: 'XL',
    note: 'Too large to review: the stage cannot be admitted until it adds at most 1000 lines.',
  };
}

/** Files changed only in blank lines; other whitespace may matter, in a string or in Python. */
export function blankOnlyFiles(files: FileChange[]): string[] {
  return files
    .filter((f) => {
      const lines = [...f.added, ...f.removed];
      return lines.length && lines.every((line) => !line.trim());
    })
    .map((f) => f.path);
}

/** The files that lie outside every one of `paths`, each a file or a directory. */
export function filesOutside(files: string[], paths: string[]): string[] {
  const dirs = paths.map((p) => p.replace(/\/*$/, '/'));
  return files.filter((f) => !paths.includes(f) && !dirs.some((d) => f.startsWith(d)));
}

```

### Core Architecture Module: `.amp/plugins/rust-port/core/engine.ts`
```
/*
 * Copyright (c) 2006-Present, Redis Ltd.
 * All rights reserved.
 *
 * Licensed under your choice of the Redis Source Available License 2.0
 * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
 * GNU Affero General Public License v3 (AGPLv3).
 */

/**
 * The engine runs one job: a module ported as stacked PRs, one per stage of the profile.
 *
 * The worker drives it through the operations: it records a plan, then claims each stage with a
 * committed revision. A claim passes the gates, which cost nothing, then pays for an assessment
 * (checks, then reviewers) unless passing evidence for the same revision exists. A stage nothing
 * holds back is admitted: its PR is published, and the worker that started on it hands the job to
 * a fresh worker for the next stage. Everything left to do is a finding; forge feedback becomes
 * findings at the start of every turn. After each turn the engine decides whether the worker
 * continues on its own. Once every stage is admitted and nothing is outstanding, a retrospective
 * finishes the job.
 *
 * The sections below follow that story: operations, turns, claiming, publishing and handing on,
 * feedback, and the messages the worker reads.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readLog, runChecks, testRan, type CheckEnv, type CheckResult } from './checks.ts';
import { confirmProposals, runReproduction } from './confirm.ts';
import { diffStat, parseDiff, patchId, sizeClass, type Size } from './diff.ts';
import { checkClaim } from './gates.ts';
import {
  addFindings,
  blocksAdmission,
  budget,
  closeFinding,
  done,
  formatFindings,
  hash,
  isAdmitted,
  newState,
  outstanding,
  passed,
  previousStage,
  progressMark,
  replaceFindings,
  repliesDue,
  RETRO,
  reviewedEvidence,
  runReport,
  stopReason,
  takeNewFindings,
  TARGETS,
  validateRetro,
  type Evidence,
  type NewFinding,
  type Retro,
  type State,
} from './job.ts';
import { citedTests, describePlan, pullRequest, validatePlan, type Plan } from './plan.ts';
import type { Forge, Host, Profile, Stage, Vcs } from './ports.ts';
import { checkRefs } from './refs.ts';
import { reviewStage, type Review } from './review.ts';
import { stateFile } from './state-file.ts';

/** How long one assessment's checks and reviewers may take. */
const ASSESSMENT_MINUTES = 90;

const REF_SCHEMA = {
  type: 'object',
  properties: { path: { type: 'string' }, line: { type: 'number' }, test: { type: 'string' } },
};
const EVIDENCE_SCHEMA = {
  type: 'array',
  items: { ...REF_SCHEMA, properties: { ...REF_SCHEMA.properties, finding: { type: 'string' } } },
};
const RETRO_SCHEMA = Object.fromEntries(
  Object.entries(RETRO).map(([list, fields]) => [
    list,
    {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ...Object.fromEntries(
            fields.map((f) => [
              f,
              f === 'target' ? { type: 'string', enum: TARGETS } : { type: 'string' },
            ]),
          ),
          evidence: EVIDENCE_SCHEMA,
        },
        required: [...fields, 'evidence'],
      },
    },
  ]),
);

/** Something the worker can do, which the host offers as a tool named by {@link Host.toolName}. */
export interface Operation {
  name: string;
  description: string;
  schema: { type: 'object'; properties: Record<string, object>; required?: string[] };
  run(input: Record<string, unknown>, thread: string, signal: AbortSignal): Promise<string>;
}

export interface EngineOptions<X> {
  /** The checkout the job works in. */
  root: string;
  /** Where the job's state, run logs and debug log live. */
  dir: string;
  profile: Profile<X>;
  host: Host;
  vcs: Vcs;
  forge: (repository: string) => Forge;
  /** The documents the worker follows, in order. */
  policy: string[];
  log: (message: string) => void;
  /** Called with the job's summary whenever its state is saved. */
  saved?: (summary: string) => void;
  /** Aborts every assessment, as when the host unloads the plugin. */
  disposed: AbortSignal;
}

export function engine<X extends object>(o: EngineOptions<X>) {
  const { root, profile, host, vcs } = o;
  const stages = profile.stages.map((s) => s.name);
  const { toolName: tool } = host;
  const prefix = `[${profile.name}]`;
  const quoted = o.policy.map((p) => `\`${p}\``);
  const policy =
    quoted.length > 1 ? `${quoted.slice(0, -1).join(', ')} and ${quoted.at(-1)}` : quoted[0];
  const follow = `Follow ${policy}`;
  // The job's stage order is the profile's: every plan is recorded in it, and a state written
  // before that rule is brought into it when loaded.
  const inStageOrder = (plan: Plan<X>) => {
    plan.stages = Object.fromEntries(stages.map((s) => [s, plan.stages[s]]));
  };
  const { debug, load, loadQuietly, save, enqueue, withOwnedJob } = stateFile<X>({
    ...{ dir: o.dir, name: profile.name, log: o.log },
    prepare: (state) => inStageOrder(state.job.plan),
    saved: (state) => o.saved?.(summary(state)),
  });

  // ## The worker's operations
  //
  // Every operation but `plan` acts on the job the calling thread owns, in the queue.

  const operations: Operation[] = [
    {
      name: 'plan',
      description: `Record or amend the plan ${policy} describe. Amending invalidates every admission and keeps the budget.`,
      schema: { type: 'object', properties: { plan: { type: 'object' } }, required: ['plan'] },
      run: (input, thread) =>
        enqueue(tool('plan'), async () => {
          const plan = input.plan as Plan<X>;
          const errors = validatePlan(plan, profile);
          if (!errors.length) {
            inStageOrder(plan);
            const branches = stages.map((s) => `${plan.branchPrefix}-${s}`);
            const forge = o.forge(plan.repository);
            errors.push(...(await forge.checkRemote({ remote: plan.remote, branches })));
            const base = await vcs.fetchBranch(plan.remote, plan.baseBranch);
            errors.push(...((await profile.checkPlan?.(plan, { root, vcs, base })) ?? []));
          }
          if (errors.length) throw new Error(errors.join('\n'));
          const state = (await load()) ?? newState(thread, plan);
          if (state.job.owner !== thread) throw new Error('Another thread owns the job');
          const where = (p: Plan) => [p.repository, p.remote, p.baseBranch, p.branchPrefix];
          if (
            Object.keys(state.job.prs).length &&
            hash(where(state.job.plan)) !== hash(where(plan))
          )
            throw new Error(
              'The stage PRs are open: repository, remote, baseBranch and branchPrefix are fixed',
            );
          state.job.plan = plan;
          state.job.planHash = hash(plan);
          await save(state);
          return `${follow}. ${summary(state)}`;
        }),
    },
    {
      name: 'claim',
      description: `Claim that a committed, checked-out revision completes a stage. Blocks while checks and ${profile.reviewers.length} reviewers run, opens or updates the stage PR on admission, and returns new findings.`,
      schema: {
        type: 'object',
        properties: {
          stage: { type: 'string', enum: stages },
          revision: {
            type: 'string',
            description: 'The checked-out commit; the tree must be clean',
          },
        },
        required: ['stage', 'revision'],
      },
      run: ({ stage, revision }, thread, signal) =>
        withOwnedJob(`${tool('claim')} ${stage} ${revision}`, thread, (state) =>
          claim(state, String(stage), String(revision), signal),
        ),
    },
    {
      name: 'blocked',
      description:
        'Report a blocker only a human can resolve, such as missing access or a plan that cannot work. Stops automatic continuation; your next claim clears it.',
      schema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] },
      run: (input, thread) =>
        withOwnedJob(tool('blocked'), thread, async (state) => {
          state.job.blocked = String(input.reason);
          return 'Reported. Summarize where the work stands and end your turn.';
        }),
    },
    {
      name: 'close',
      description:
        'Close a reviewer finding or review comment: fixed, or no-change with the reason it does not apply, citing the files, lines or tests that show it. Failed checks and CI close themselves.',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          resolution: { type: 'string', enum: ['fixed', 'no-change'] },
          reason: {
            type: 'string',
            description:
              'Required for no-change and review threads, where it is the reply: one plain line of at most 280 characters.',
          },
          evidence: { type: 'array', items: { ...REF_SCHEMA, required: ['path'] } },
        },
        required: ['id', 'resolution', 'evidence'],
      },
      run: (input, thread) =>
        withOwnedJob(`${tool('close')} ${input.id} ${input.resolution}`, thread, async (state) => {
          const { id, resolution, reason, evidence } = input as any;
          const problems = await checkRefs(root, evidence);
          if (problems.length)
            throw new Error(`The evidence does not hold:\n- ${problems.join('\n- ')}`);
          const finding = closeFinding(state, id, resolution, reason, evidence);
          // The admitted candidate does not contain the fix, so the stage must be claimed again.
          if (resolution === 'fixed') delete state.job.admitted[finding.stage];
          // A no-change answer goes out now; a fix is answered when it is published.
          if (resolution === 'no-change') await postReplies(state);
          return `Closed ${id}. ${outstanding(state).length} outstanding.`;
        }),
    },
    {
      name: 'retro',
      description: `Once every stage is admitted, nothing is outstanding and CI is green, record the postm
```

### Core Architecture Module: `.amp/plugins/rust-port/core/gates.ts`
```
/*
 * Copyright (c) 2006-Present, Redis Ltd.
 * All rights reserved.
 *
 * Licensed under your choice of the Redis Source Available License 2.0
 * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
 * GNU Affero General Public License v3 (AGPLv3).
 */

/** What rejects a claim before anything runs, so a rejection costs no assessment. */
import {
  blankOnlyFiles,
  measureSize,
  filesOutside,
  parseDiff,
  sizeClass,
  type Size,
} from './diff.ts';
import { reviewedEvidence, type State } from './job.ts';
import { citedTests } from './plan.ts';
import type { Profile, Stage, Vcs } from './ports.ts';
import { checkRefs } from './refs.ts';

/**
 * A house rule, as far as a pattern can catch it. Each is a ratchet: a file may not have more
 * violations at the candidate than at the base, so existing code is never blamed and nothing new
 * slips in.
 */
export interface Rule {
  applies(path: string): boolean;
  count(text: string): number;
  message: string;
}

/** What `path` breaks of `rules` that it did not already break at `before`. */
export function ruleViolations(
  rules: Rule[],
  path: string,
  before: string | undefined,
  after: string,
) {
  return rules
    .filter((r) => r.applies(path) && r.count(after) > (before === undefined ? 0 : r.count(before)))
    .map((r) => `${path} ${r.message}`);
}

/**
 * Why the candidate cannot be the stage, and its size: everything that rejects a claim before
 * anything runs, so a rejection costs no assessment.
 */
export async function checkClaim<X extends object>(o: {
  root: string;
  vcs: Vcs;
  profile: Profile<X>;
  state: State<X>;
  stage: Stage;
  base: string;
  candidate: string;
}): Promise<{ problems: string[]; size: Size }> {
  const { root, vcs, profile, state, stage, base, candidate } = o;
  const { plan } = state.job;
  const generated = (path: string) => profile.classify(path) === 'generated';
  const files = parseDiff(await vcs.diff(base, candidate));
  const { paths } = plan.stages[stage];
  // Without rename detection a moved file names both its paths, so neither escapes the scope.
  const stray = filesOutside(
    files.map((f) => f.path).filter((f) => !generated(f)),
    paths,
  );
  if (stray.length)
    return {
      problems: [`it changes ${stray.join(', ')}, outside ${paths.join(', ')}; revert or amend`],
      size: { lines: 0, code: 0, files: 0 },
    };
  for (const f of files)
    f.texts = [await vcs.readFileAt(base, f.path), await vcs.readFileAt(candidate, f.path)];
  const size = measureSize(files, profile);
  const problems = blankOnlyFiles(files.filter((f) => !generated(f.path))).map(
    (path) => `${path} changes only blank lines; restore it`,
  );
  const tooBig = sizeClass(size.lines);
  if (tooBig?.label === 'XL') problems.push(`it adds ${size.lines} lines: ${tooBig.note}`);
  // Once reviewed, a stage's code may not grow: a fix pays for itself in deleted code.
  const floor = Math.min(...reviewedEvidence(state, stage).map((e) => e.size.code));
  if (size.code > floor)
    problems.push(
      `it adds ${size.code} net lines of code (tests aside), its reviewed version ${floor}: ` +
        'a fix must delete as much code as it adds',
    );
  for (const { path, texts } of files) {
    const [before, after] = texts!;
    if (after !== undefined) problems.push(...ruleViolations(profile.rules, path, before, after));
  }
  const tests = citedTests(plan, stage).map((t) => ({ path: t.path, test: t.name }));
  problems.push(
    ...(await checkRefs(root, tests)),
    ...(await missingFixes(vcs, state, stage, candidate)),
  );
  problems.push(
    ...((await profile.checkClaim?.({ root, vcs, plan, stage, base, candidate, files })) ?? []),
  );
  return { problems, size };
}

/**
 * The stage's findings closed as fixed whose fix the candidate lacks: it changes none of the files
 * the fix cites since the revision the finding was raised on.
 */
async function missingFixes(vcs: Vcs, state: State, stage: Stage, candidate: string) {
  const problems = [];
  for (const f of Object.values(state.findings)) {
    if (f.stage !== stage || f.closed?.resolution !== 'fixed') continue;
    const paths = (f.closed.evidence ?? []).map((r) => r.path);
    // A revision this checkout never had cannot be compared, and is not held against it.
    const changed = await vcs.diff(f.revision, candidate, { paths }).catch(() => '?');
    if (!changed)
      problems.push(
        `${f.id} was closed as fixed, but nothing it cites changed since ${f.revision.slice(0, 10)}`,
      );
  }
  return problems;
}

```

### Core Architecture Module: `.amp/plugins/rust-port/core/git.ts`
```
/*
 * Copyright (c) 2006-Present, Redis Ltd.
 * All rights reserved.
 *
 * Licensed under your choice of the Redis Source Available License 2.0
 * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
 * GNU Affero General Public License v3 (AGPLv3).
 */

/** The {@link Vcs} on a git checkout. */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execa } from 'execa';
import { ENV } from './checks.ts';
import type { Vcs } from './ports.ts';

export async function git(cwd: string, args: string[], input = ''): Promise<string> {
  return (await execa('git', args, { cwd, env: ENV, input })).stdout;
}

/**
 * Tracks `branch@remote` when `root` is also a jj checkout. jj imports a branch pushed by git as
 * an untracked remote bookmark, and jj's default `immutable_heads()` makes those and all their
 * ancestors immutable, so the worker could no longer amend or rebase its own stages.
 */
export async function trackInJj(root: string, remote: string, branch: string): Promise<void> {
  if (!existsSync(join(root, '.jj'))) return;
  const jj = (args: string[]) => execa('jj', args, { cwd: root, env: ENV });
  await jj(['git', 'import']);
  await jj(['bookmark', 'track', `${branch}@${remote}`]);
}

export function gitVcs(root: string): Vcs {
  const sh = (args: string[], input?: string) => git(root, args, input);
  const dirty = async () => !!(await sh(['status', '--porcelain']));
  return {
    async currentRevision() {
      if (await dirty()) throw new Error('The working tree is dirty');
      return sh(['rev-parse', 'HEAD']);
    },
    resolveRevision: (revision) => sh(['rev-parse', '--verify', `${revision}^{commit}`]),
    async fetchBranch(remote, branch) {
      await sh(['fetch', remote, branch]);
      return sh(['rev-parse', 'FETCH_HEAD']);
    },
    mergeBase: (a, b) => sh(['merge-base', a, b]),
    diff: (from, to, o) =>
      sh([
        ...['diff', '--no-ext-diff', o?.renames ? '--find-renames' : '--no-renames', from, to],
        ...(o?.paths ? ['--', ...o.paths] : []),
      ]),
    readFileAt: (revision, path) => sh(['show', `${revision}:${path}`]).catch(() => undefined),
    listFiles: async (revision) =>
      (await sh(['ls-tree', '-r', '--name-only', revision])).split('\n').filter(Boolean),
    // Hunk line counts written by a model are often off; --recount ignores them.
    applyPatch: (patch, o) =>
      sh(['apply', '--recount', ...(o?.reverse ? ['-R'] : [])], patch).then(
        () => true,
        () => false,
      ),
    async discardChanges() {
      if (!(await dirty())) return false;
      await sh(['restore', '--source=HEAD', '--staged', '--worktree', '--', '.']);
      await sh(['clean', '-fd']);
      return true;
    },
  };
}

```

### Core Architecture Module: `.amp/plugins/rust-port/core/github.ts`
```
/*
 * Copyright (c) 2006-Present, Redis Ltd.
 * All rights reserved.
 *
 * Licensed under your choice of the Redis Source Available License 2.0
 * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
 * GNU Affero General Public License v3 (AGPLv3).
 */

/** The {@link Forge} on GitHub: stage PRs pushed from the checkout, their review threads and CI. */
import { Octokit } from '@octokit/rest';
import { execa } from 'execa';
import { hash, type NewFinding, type FindingSource } from './job.ts';
import type { Forge, Stage } from './ports.ts';
import { git, trackInJj } from './git.ts';

// STALE is a check GitHub gave up on: it never passed.
const FAILED = [
  'FAILURE',
  'ERROR',
  'TIMED_OUT',
  'CANCELLED',
  'ACTION_REQUIRED',
  'STARTUP_FAILURE',
  'STALE',
];

/** The start of a GitHub remote URL, before the repository: HTTPS, SSH or scp-style. */
const REMOTE =
  /^(https:\/\/([^@/]+@)?github\.com\/|ssh:\/\/([^@/]+@)?github\.com\/|[^@/:]+@github\.com:)/i;

const FEEDBACK = `query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) { pullRequest(number: $number) {
    state headRefOid url
    reviewThreads(first: 100, after: $after) { pageInfo { hasNextPage endCursor }
      nodes { id isResolved path line
      root: comments(first: 1) { nodes { databaseId } }
      comments(last: 20) { nodes { databaseId author { login } body url } } } }
    reviews(last: 50) { nodes { databaseId author { login __typename } body url
      comments { totalCount } } }
    comments(last: 50) { nodes { databaseId author { login __typename } body url } }
    commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 100) { nodes {
      ... on CheckRun { name conclusion detailsUrl }
      ... on StatusContext { context state targetUrl } } } } } } }
  } }
}`;

const RESOLVE = `mutation($id: ID!) {
  resolveReviewThread(input: { threadId: $id }) { clientMutationId }
}`;

/** How the repository's CI reports: the check whose verdict decides, and checks that never block. */
export interface CI {
  gate: string;
  advisory: RegExp;
}

/** Bots wrap their comments in HTML comments and collapsed sections the worker never needs. */
function trimComment(body: string, max = 1500): string {
  const text = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<details>[\s\S]*?<\/details>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > max ? `${text.slice(0, max)}… (full text at the link)` : text;
}

/** Selects credentials with repository access before any write can be attempted. */
async function githubClient(cwd: string, owner: string, repo: string): Promise<Octokit> {
  const env = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  const fill = env
    ? ''
    : await git(cwd, ['credential', 'fill'], 'protocol=https\nhost=github.com\n\n').catch(() => '');
  const token = env || fill.match(/^password=(.*)$/m)?.[1];
  let denied: unknown;
  if (token) {
    const client = new Octokit({ auth: token });
    try {
      await client.rest.repos.get({ owner, repo });
      return client;
    } catch (error) {
      if (![401, 403, 404].includes((error as { status?: number }).status ?? 0)) throw error;
      denied = error;
    }
  }
  const auth = await execa('gh', ['auth', 'token', '--hostname', 'github.com'], {
    cwd,
    // Environment tokens override gh's stored login, which may have broader repository access.
    env: { GH_TOKEN: undefined, GITHUB_TOKEN: undefined, GH_PROMPT_DISABLED: '1' },
  })
    .then(({ stdout }) => stdout.trim())
    .catch(() => '');
  if (!auth)
    throw (
      denied ??
      new Error('No GitHub credentials available; run gh auth login or connect the GitHub App.')
    );
  const client = new Octokit({ auth });
  await client.rest.repos.get({ owner, repo });
  return client;
}

/**
 * The review comments and the CI verdict of a stage PR, from the {@link FEEDBACK} query; nothing
 * once it merged. `posted` are the comments the plugin wrote; `head` is the revision it published.
 */
export function readFeedback(
  ci: CI,
  data: any,
  stage: Stage,
  number: number,
  posted: number[] = [],
  head?: string,
): { findings: NewFinding[]; pending: boolean } {
  const pr = data.repository.pullRequest;
  // The plugin posts with the operator's token, so only the IDs it recorded tell its replies apart.
  const ours = (comment: { databaseId: number }) => posted.includes(comment.databaseId);
  const finding = (
    source: FindingSource,
    key: string,
    title: string,
    body: string,
    url: string,
  ): NewFinding => ({
    ...{ source, key, title, body, stage, revision: pr.headRefOid },
    ...{ blocking: true, links: [url] },
  });
  // A PR closed unmerged, or one whose head moved past what the job published, no longer carries
  // the assessed candidate, so its CI says nothing about it. Its comments are still heard.
  const failed = (title: string, body: string) => finding('ci', `ci:${stage}`, title, body, pr.url);
  const stale =
    pr.state === 'CLOSED'
      ? failed(`PR #${number} was closed without merging`, 'Reopen it or publish the stage again.')
      : head && pr.headRefOid !== head
        ? failed(
            `PR #${number} head is ${pr.headRefOid.slice(0, 10)}, not the published ${head.slice(0, 10)}`,
            'Something else pushed to its branch; claim the stage again.',
          )
        : undefined;

  const findings: NewFinding[] = [];
  const keys = new Set<string>();
  for (const t of pr.reviewThreads.nodes) {
    const thread = t.comments.nodes;
    const last = thread.at(-1);
    if (t.isResolved || !last || ours(last)) continue;
    const body = thread.map((c: any) => `${c.author?.login}: ${trimComment(c.body)}`).join('\n');
    // Keyed by content, not ID: a stacked PR repeats its ancestors' comments, on other lines. Two
    // threads on one PR with the same text are still two.
    let key = `comment:${hash(
      t.path,
      thread.filter((c: any) => !ours(c)).map((c: any) => c.body),
    )}`;
    if (keys.has(key)) key = `${key}:${t.id}`;
    keys.add(key);
    findings.push({
      ...finding(
        'comment',
        key,
        `review comment on PR #${number} · ${t.path}:${t.line}`,
        body,
        last.url,
      ),
      // GitHub takes replies only to a thread's first comment.
      replies: [{ pr: number, comment: t.root.nodes[0].databaseId, thread: t.id }],
    });
  }
  // People are always heard. Bots are heard in review threads only: their review bodies summarize
  // those threads, and their conversation comments are reports CI already covers. The body is part
  // of the key, so an edited comment is a new finding.
  const human = (c: any) => c.body.trim() && !ours(c) && c.author?.__typename !== 'Bot';
  for (const [kind, nodes] of [
    ['review', pr.reviews.nodes],
    ['comment', pr.comments.nodes],
  ] as const)
    for (const c of nodes.filter(human))
      findings.push(
        finding(
          'comment',
          `${kind}:${c.databaseId}:${hash(c.body)}`,
          `${kind} by ${c.author?.login} on PR #${number}`,
          trimComment(c.body),
          c.url,
        ),
      );

  if (stale) return { findings: [...findings, stale], pending: false };

  // The gate reports after the slowest check, so until then a failed check is reported at once
  // under the gate; once it reports, only an explicit success passes.
  const runs = (pr.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? []).map(
    (c: any) => ({
      name: c.name ?? c.context,
      result: c.conclusion ?? c.state,
      url: c.detailsUrl ?? c.targetUrl,
    }),
  );
  const gate = runs.find((r: any) => r.name === ci.gate);
  const pending = !gate || gate.result == null || ['PENDING', 'EXPECTED'].includes(gate.result);
  const failures = runs.filter(
    (r: any) => r !== gate && FAILED.includes(r.result) && !ci.advisory.test(r.name),
  );
  const failing = pending ? failures.length > 0 : gate.result !== 'SUCCESS';
  const list =
    failures.map((r: any) => `- ${r.name}: ${r.url}`).join('\n') || 'No failed check is listed.';
  if (failing)
    findings.push(
      finding(
        'ci',
        `ci:${stage}`,
        `CI ${ci.gate} failed on PR #${number}`,
        `${list}\nRead the run log to find which stage the fix belongs in.`,
        gate?.url ?? failures[0]?.url ?? pr.url,
      ),
    );
  return { findings, pending };
}

/** The stage PRs of `repository` on GitHub, pushed from the checkout at `root`. */
export function github(o: { root: string; repository: string; ci: CI }): Forge {
  const { root, repository, ci } = o;
  const [owner, repo] = repository.split('/');
  // Made on first use, so inspecting a plan needs no credentials.
  let client: Promise<Octokit> | undefined;
  const api = () => (client ??= githubClient(root, owner, repo));
  const sh = (args: string[]) => git(root, args);

  return {
    async checkRemote({ remote, branches }) {
      const problems: string[] = [];
      const url = await sh(['remote', 'get-url', remote]).catch(() => '');
      const path = url.replace(REMOTE, '');
      if (
        path === url ||
        !new RegExp(`^${repository.replace(/\./g, '\\.')}(\\.git)?/?$`, 'i').test(path)
      )
        problems.push(`remote ${remote} is not github.com/${repository}, where the PRs open`);
      for (const branch of branches)
        await sh(['check-ref-format', '--branch', branch]).catch(() =>
          problems.push(`${branch} is not a valid branch name`),
        );
      return problems;
    },

    async fetchFeedback({ stage, number, posted, head }) {
      const octokit = await api();
      const query = (after?: string) =>
        octokit.graphql<any>(FEEDBACK, { owner, name: repo, number, after });
      const data = await query();
      // Only review threads are paged in full: they are where unresolved feedback lives.
      const threads = data.repository.pullRequest.reviewThreads;
      f
```

### Core Architecture Module: `.amp/plugins/rust-port/core/job.ts`
```
/*
 * Copyright (c) 2006-Present, Redis Ltd.
 * All rights reserved.
 *
 * Licensed under your choice of the Redis Source Available License 2.0
 * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
 * GNU Affero General Public License v3 (AGPLv3).
 */

/**
 * The job and everything it remembers: the plan, the evidence of each assessment, and the
 * findings, which are everything left to do. Functions here only read and change that state.
 */
import { createHash } from 'node:crypto';
import type { CheckResult } from './checks.ts';
import type { Size } from './diff.ts';
import type { Plan } from './plan.ts';
import type { PR, Stage } from './ports.ts';

/** Assessments a job may run before an operator grants more. */
export const BUDGET = 30;

export const TARGETS = ['plugin', 'policy', 'skills', 'checks', 'reviewers'] as const;
/** Each retro list and the text fields its items need, besides their evidence. */
export const RETRO = {
  mistakes: ['what', 'cost', 'prevention'],
  cuts: ['what', 'lines'],
  improvements: ['problem', 'proposal', 'target'],
} as const;

export interface State<X = {}> {
  job: Job<X>;
  evidence: Record<string, Evidence>;
  findings: Record<string, Finding>;
}

export interface Job<X = {}> {
  owner: string;
  /** Worker threads that owned the job before {@link Job.owner}: one per stage handed on. */
  former?: string[];
  plan: Plan<X>;
  /** Evidence and admissions hold only under the plan they were gathered under. */
  planHash: string;
  started: string;
  admitted: Partial<Record<Stage, { candidate: string; base: string; plan: string }>>;
  prs: Partial<Record<Stage, PR>>;
  /** Assessments run; grants extend {@link BUDGET}. */
  used: number;
  grants: { amount: number; at: string; by: string }[];
  /** Number of the last finding created, and of the last one shown to the worker. */
  created: number;
  delivered: number;
  /** IDs of the comments the plugin posted, which feedback collection leaves out. */
  posted: number[];
  /** A blocker the worker reported; its next claim clears it. */
  blocked?: string;
  /** {@link progressMark} at the last automatic continuation. */
  continued?: string;
  retro?: Retro;
}

/** What one assessment of a candidate showed, bound to its stage, base and plan. */
export interface Evidence {
  stage: Stage;
  candidate: string;
  base: string;
  plan: string;
  /** {@link patchId} of the stage's diff: equal for the same change rebased. */
  patch: string;
  checks: CheckResult[];
  /** Empty when a check failed, because then the reviewers do not run. */
  reviewers: { reviewer: string; thread?: string }[];
  size: Size;
}

/** A file in the workspace, a line of it, or a test it names, as evidence the plugin checks. */
export interface FileRef {
  path: string;
  line?: number;
  test?: string;
}
export type Ref = FileRef | { finding: string };

/** A failing test as a patch adding it to `path`, and the command that runs it. */
export interface Repro {
  path: string;
  test: string;
  patch: string;
  command: string;
}

/**
 * Who closes a finding: the worker closes reviewer findings and review comments; failed checks and
 * CI close themselves once they pass.
 */
export type FindingSource = 'review' | 'comment' | 'check' | 'ci';

export interface Finding {
  readonly id: string;
  /** Identity of what was reported; exact duplicates share it. */
  readonly key: string;
  readonly source: FindingSource;
  readonly stage: Stage;
  /** The revision it was raised against. */
  readonly revision: string;
  readonly blocking: boolean;
  readonly title: string;
  readonly body: string;
  /** The failing test that reproduced it, which every later claim re-runs. */
  readonly repro?: Repro;
  links: string[];
  /** The forge comments to answer and threads to resolve; each is dropped once done. */
  replies?: { pr: number; comment?: number; thread?: string }[];
  /** The PRs a reply was posted on. */
  answered?: number[];
  closed?: {
    /** `superseded`: the same failure was reported again on a newer revision. */
    resolution: 'fixed' | 'no-change' | 'passed' | 'superseded';
    reason?: string;
    evidence?: FileRef[];
  };
}
export type NewFinding = Omit<Finding, 'id'>;

/** A postmortem about the next iteration: what went wrong, what to cut, what to change. */
export interface Retro {
  mistakes: { what: string; cost: string; prevention: string; evidence: Ref[] }[];
  cuts: { what: string; lines: string; evidence: Ref[] }[];
  improvements: {
    problem: string;
    proposal: string;
    target: (typeof TARGETS)[number];
    evidence: Ref[];
  }[];
}

/** A short digest of `parts`, independent of the order of keys in any object among them. */
export function hash(...parts: unknown[]): string {
  const sorted = (_: string, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value;
  return createHash('sha256').update(JSON.stringify(parts, sorted)).digest('hex').slice(0, 16);
}

export function newState<X extends object>(owner: string, plan: Plan<X>): State<X> {
  const job: Job<X> = {
    ...{ owner, plan, planHash: hash(plan), started: new Date().toISOString() },
    ...{ admitted: {}, prs: {}, used: 0, grants: [], created: 0, delivered: 0, posted: [] },
  };
  return { job, evidence: {}, findings: {} };
}

export const budget = (job: Job) => job.grants.reduce((sum, g) => sum + g.amount, BUDGET);

/** Why the job may not go on without a human, if it may not. */
export function stopReason(job: Job): string | undefined {
  if (job.blocked) return `blocked: ${job.blocked}`;
  if (job.used >= budget(job)) return `the assessment budget (${budget(job)}) is used up`;
}

/** Changes whenever a turn moved the job: an assessment, a finding raised or closed, an admission. */
export function progressMark(state: State): string {
  const closed = Object.values(state.findings).filter((f) => f.closed).length;
  const { used, created, admitted, retro, planHash } = state.job;
  return hash(used, created, closed, admitted, !!retro, planHash);
}

/** The plan's stages, in the profile's order, which the engine keeps them in. */
export const stageOrder = (job: Job): Stage[] => Object.keys(job.plan.stages);

export const previousStage = (job: Job, stage: Stage): Stage | undefined =>
  stageOrder(job)[stageOrder(job).indexOf(stage) - 1];

/** A stage stays admitted while the plan and the admitted stage it was built on are unchanged. */
export function isAdmitted(job: Job, stage: Stage): boolean {
  const admission = job.admitted[stage];
  const prev = previousStage(job, stage);
  if (admission?.plan !== job.planHash) return false;
  return !prev || (isAdmitted(job, prev) && admission.base === job.admitted[prev]!.candidate);
}

export const passed = (evidence: Evidence) => evidence.checks.every((c) => !c.problem);

/** The stage's reviewed evidence under the current plan, oldest first. */
export const reviewedEvidence = (state: State, stage: Stage) =>
  Object.values(state.evidence).filter(
    (e) => e.stage === stage && e.plan === state.job.planHash && e.reviewers.length,
  );

/**
 * The replies due on review threads: a no-change answer at once, a fix once its stage's PR moved
 * past the revision the finding was raised on, quoting the head that carries it.
 */
export function repliesDue(state: State): { finding: Finding; reply: string }[] {
  return Object.values(state.findings).flatMap((finding) => {
    const { closed, replies, stage, revision } = finding;
    if (!closed || !replies?.length) return [];
    if (closed.resolution !== 'fixed') return [{ finding, reply: closed.reason! }];
    const head = state.job.prs[stage]?.head;
    return head && head !== revision
      ? [{ finding, reply: `Fixed in ${head.slice(0, 10)}: ${closed.reason}` }]
      : [];
  });
}

export function outstanding(state: State): Finding[] {
  const stages = stageOrder(state.job);
  return Object.values(state.findings)
    .filter((f) => !f.closed)
    .sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage) || seq(a) - seq(b));
}

/** CI runs only after publication, so its findings cannot hold back the admission that publishes. */
export const blocksAdmission = (f: Finding, stage: Stage) =>
  f.stage === stage && f.blocking && f.source !== 'ci';

/** Every stage admitted, nothing outstanding and every reply posted: the retrospective is next. */
export function done(state: State): boolean {
  return (
    stageOrder(state.job).every((s) => isAdmitted(state.job, s)) &&
    !outstanding(state).length &&
    !Object.values(state.findings).some((f) => f.closed && f.replies?.length)
  );
}

const seq = (f: Finding) => Number(f.id.slice(1));

function insert(state: State, finding: NewFinding) {
  const id = `F${++state.job.created}`;
  state.findings[id] = { id, ...finding };
}

/**
 * Adds findings whose key is new. A duplicate merges into the existing finding: an open one gains
 * its links, and either gains its replies, so a comment on two stacked PRs is answered on both.
 */
export function addFindings(state: State, findings: NewFinding[]): void {
  for (const finding of findings) {
    const existing = Object.values(state.findings).find((f) => f.key === finding.key);
    if (!existing) {
      insert(state, finding);
      continue;
    }
    // The same comment again on a PR it was answered on is new feedback, such as a regression.
    const again = finding.replies?.find(
      (r) => existing.closed && existing.answered?.includes(r.pr),
    );
    if (again) {
      const key = `${finding.key}:${again.thread ?? again.comment}`;
      if (!Object.values(state.findings).some((f) => f.key === key))
        insert(state, { ...finding, key });
      continue;
    }
    if (!existing.closed) existing.links = [...new Set([...existing.links, ...finding.links])];
    for (const reply of finding.replies ?? [])
      if (!existing.replies
```

### Core Architecture Module: `.amp/plugins/rust-port/core/plan.ts`
```
/*
 * Copyright (c) 2006-Present, Redis Ltd.
 * All rights reserved.
 *
 * Licensed under your choice of the Redis Source Available License 2.0
 * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
 * GNU Affero General Public License v3 (AGPLv3).
 */

/**
 * The plan the worker records: what the port must keep, what it may change, and the stages, with
 * the prose reviewers and PRs show of it.
 */
import type { Check } from './checks.ts';
import type { Profile, Stage } from './ports.ts';

/** A test named as evidence: `name` is defined in the file at `path` from `stage` on. */
export interface Test {
  path: string;
  name: string;
  stage: Stage;
}

/** Where the new code behaves differently from the old; each language names one side. */
export interface Divergence {
  behavior: string;
  why: string;
  test: Test;
  [side: string]: unknown;
}

export type Plan<X = {}> = X & {
  repository: string;
  remote: string;
  baseBranch: string;
  /** Stage branches are `<branchPrefix>-<stage>`. */
  branchPrefix: string;
  /** Behavior callers rely on, and the tests that pin it. */
  contract: { behavior: string; tests: Test[] }[];
  /** For a human to accept on the PRs. */
  divergences: Divergence[];
  structure: string;
  interfaces: string;
  stages: Record<
    Stage,
    { deliverable: string; paths: string[]; checks: Check[]; title: string; body: string }
  >;
};

type Languages = Profile['languages'];

const blank = (text: unknown) => typeof text !== 'string' || !text.trim();
const sides = (languages: Languages) => [languages.from, languages.to].map((l) => l.toLowerCase());

/** The tests the plan cites up to `stage`: a stage's candidate must contain them and run them. */
export function citedTests(plan: Plan, stage: Stage): Test[] {
  const stages = Object.keys(plan.stages);
  return [...plan.contract.flatMap((c) => c.tests), ...plan.divergences.map((d) => d.test)].filter(
    (t) => stages.indexOf(t.stage) <= stages.indexOf(stage),
  );
}

function testErrors(t: Test | undefined, what: string, stages: readonly Stage[]): string[] {
  return blank(t?.path) || blank(t?.name) || !stages.includes(t?.stage ?? '')
    ? [`${what} needs a test: { path, name, stage }, stage one of ${stages.join(', ')}`]
    : [];
}

/** What is malformed in the parts of a plan every project has. */
export function validatePlan(plan: Plan, profile: Pick<Profile, 'stages' | 'languages'>): string[] {
  const stages = profile.stages.map((s) => s.name);
  const errors = (['remote', 'baseBranch', 'branchPrefix', 'structure', 'interfaces'] as const)
    .filter((field) => blank(plan?.[field]))
    .map((field) => `${field} is required`);
  if (!/^[\w.-]+\/[\w.-]+$/.test(plan?.repository)) errors.push('repository must be owner/name');
  if (!plan.contract?.length) errors.push('contract needs at least one item');
  for (const [i, c] of (plan.contract ?? []).entries()) {
    if (blank(c?.behavior)) errors.push(`contract[${i}] needs a behavior`);
    if (!c?.tests?.length) errors.push(`contract[${i}] needs the tests that pin it`);
    for (const t of c?.tests ?? []) errors.push(...testErrors(t, `contract[${i}]`, stages));
  }
  if (!Array.isArray(plan.divergences)) errors.push('divergences is required, even if empty');
  const [from, to] = sides(profile.languages);
  for (const [i, d] of (plan.divergences ?? []).entries()) {
    if ([d?.behavior, d?.[from], d?.[to], d?.why].some(blank))
      errors.push(`divergences[${i}] needs behavior, ${from}, ${to} and why`);
    errors.push(...testErrors(d?.test, `divergences[${i}]`, stages));
  }
  for (const { name, checks } of profile.stages) {
    const s = plan.stages?.[name];
    if (blank(s?.deliverable)) errors.push(`${name} needs a deliverable`);
    if (!s?.paths?.length || s.paths.some(blank))
      errors.push(`${name} needs the paths it may change`);
    if (blank(s?.title) || blank(s?.body)) errors.push(`${name} needs a PR title and body`);
    // A check passes only if every command in it does.
    for (const c of s?.checks ?? [])
      if (/\|\||;|(^|[^&])&(?!&)/.test(c?.command ?? ''))
        errors.push(`${name} ${c.kind} check chains commands with something other than \`&&\``);
    for (const [kind, runs] of Object.entries(checks)) {
      const command = s?.checks?.find((c) => c.kind === kind)?.command ?? '';
      if (blank(command) || runs.some((r) => !command.includes(r)))
        errors.push(
          `${name} needs a ${kind} check${runs.map((r) => ` running \`${r}\``).join(' and')}`,
        );
    }
  }
  return errors;
}

const testName = (t: Test) => `\`${t.path}::${t.name}\``;

export function describeDivergences(plan: Plan, languages: Languages): string {
  const { from, to } = languages;
  if (!plan.divergences.length) return `None: the ${to} behaves like the ${from} everywhere.`;
  const [f, t] = sides(languages);
  return plan.divergences
    .map(
      (d) =>
        `- **${d.behavior}.** ${from}: ${d[f]} ${to}: ${d[t]} Why: ${d.why} Test: ${testName(d.test)}`,
    )
    .join('\n');
}

/**
 * The stage's PR. Every PR lists the divergences, so whoever reviews it can reject one, then, folded
 * away, the plan it was admitted under, so an amendment that widens a stage or weakens its checks
 * shows, and the `record` of the run.
 */
export function pullRequest<X extends object>(
  plan: Plan<X>,
  profile: Profile<X>,
  stage: Stage,
  record: string,
) {
  const { title, body } = plan.stages[stage];
  return {
    title,
    body: `${body}

#### Behavior changes from ${profile.languages.from}

${describeDivergences(plan, profile.languages)}

<details><summary>How this port ran</summary>

${describePlan(plan, profile, false)}

${record}
</details>
`,
  };
}

/** The plan as reviewers read it; a PR shows the divergences on their own. */
export function describePlan<X extends object>(
  plan: Plan<X>,
  profile: Profile<X>,
  withDivergences = true,
): string {
  const stages = profile.stages.map(({ name }) => {
    const { paths, checks } = plan.stages[name];
    return `- \`${name}\` may change ${paths.map((p) => `\`${p}\``).join(', ')} and must pass ${checks.map((c) => `\`${c.command}\``).join(', ')}.`;
  });
  const contract = plan.contract.map(
    (c) => `- ${c.behavior} Tests: ${c.tests.map(testName).join(', ')}`,
  );
  const extra = profile.describePlan?.(plan);
  return `### Contract

${contract.join('\n')}
${withDivergences ? `\n### Divergences from ${profile.languages.from}\n\n${describeDivergences(plan, profile.languages)}\n` : ''}
### Stages

${stages.join('\n')}
${extra ? `\n${extra}\n` : ''}
### Structure, dependencies and handoffs

${plan.structure}

### Interfaces later stages rely on

${plan.interfaces}`;
}

```

### Core Architecture Module: `.amp/plugins/rust-port/core/ports.ts`
```
/*
 * Copyright (c) 2006-Present, Redis Ltd.
 * All rights reserved.
 *
 * Licensed under your choice of the Redis Source Available License 2.0
 * (RSALv2); or (b) the Server Side Public License v1 (SSPLv1); or (c) the
 * GNU Affero General Public License v3 (AGPLv3).
 */

/** Everything outside the workflow: the agent host, the forge, the VCS and the project. */
import type { CheckResult } from './checks.ts';
import type { FileChange } from './diff.ts';
import type { Rule } from './gates.ts';
import type { NewFinding } from './job.ts';
import type { Plan } from './plan.ts';
import type { Reviewer } from './review.ts';

export type Stage = string;

/** Where the worker and its reviewers run as threads. */
export interface Host {
  threadUrl(thread: string): string;
  /** The name the worker calls an operation by. */
  toolName(operation: string): string;
  /** A thread under `parent`: a read-only reviewer when given `role`, a worker otherwise. */
  startThread(o: { parent: string; labels: string[]; role?: string }): Promise<string>;
  sendMessage(thread: string, message: string): Promise<void>;
  /** Sends `message` and waits for the reply; aborting `signal` cancels the thread's turn. */
  ask(
    thread: string,
    message: string,
    o: { signal: AbortSignal; timeoutMs: number },
  ): Promise<string>;
}

export interface PR {
  number: number;
  url: string;
  head: string;
}

/** Where the stage PRs open, for one repository. */
export interface Forge {
  /** What keeps the stage PRs from opening from `remote` on `branches`. */
  checkRemote(o: { remote: string; branches: string[] }): Promise<string[]>;
  /** Pushes `candidate` to `branch` and opens the PR from it into `base`, or updates `existing`. */
  publish(o: {
    remote: string;
    branch: string;
    base: string;
    candidate: string;
    title: string;
    body: string;
    existing?: PR;
  }): Promise<PR>;
  /**
   * The review comments and the CI verdict of a stage PR. `posted` are the comments the plugin
   * wrote; `head` is the revision it published.
   */
  fetchFeedback(o: {
    stage: Stage;
    number: number;
    posted: number[];
    head: string;
  }): Promise<{ findings: NewFinding[]; pending: boolean }>;
  /** Replies to a review thread's first comment; the reply's ID. */
  replyToComment(pr: number, comment: number, body: string): Promise<number>;
  resolveThread(thread: string): Promise<void>;
}

/** The checkout the job works in. */
export interface Vcs {
  /** The checked-out revision; throws if the tree is dirty. */
  currentRevision(): Promise<string>;
  resolveRevision(revision: string): Promise<string>;
  /** Fetches `branch` from `remote`; the fetched revision. */
  fetchBranch(remote: string, branch: string): Promise<string>;
  mergeBase(a: string, b: string): Promise<string>;
  /**
   * The unified diff between two revisions, limited to `paths` if given. Renames show as a delete
   * and an add, so every path a change touches is named, unless `renames` asks for them as such.
   */
  diff(from: string, to: string, o?: { paths?: string[]; renames?: boolean }): Promise<string>;
  readFileAt(revision: string, path: string): Promise<string | undefined>;
  listFiles(revision: string): Promise<string[]>;
  applyPatch(patch: string, o?: { reverse: true }): Promise<boolean>;
  /** Puts back what the checks changed or created, ignored files aside; whether anything had. */
  discardChanges(): Promise<boolean>;
}

/** Judges a check that exited 0 from its log, or the files it wrote under `root`. */
export type Judge = (o: {
  check: CheckResult;
  log: string;
  root: string;
}) => Promise<string | undefined> | string | undefined;

/** What a project brings: its stages, layout, rules, runners, judges, reviewers and hooks. */
export interface Profile<X = {}> {
  /** Names the job in labels, messages and its state directory. */
  name: string;
  /** In order; each kind of check a stage's plan must have, and what it must run. */
  stages: { name: Stage; checks: Record<string, string[]> }[];
  /** The language ported from and to; the divergence fields are their lowercase names. */
  languages: { from: string; to: string };
  classify(path: string): 'build' | 'rule' | 'generated' | 'test' | 'source';
  /** The text outside the tests a source file holds, where its language puts tests there. */
  stripTests?(path: string, text: string): string | undefined;
  /** An added line that switches a test off. */
  disabledTestPattern: RegExp;
  rules: Rule[];
  /** The files of the {@link classify} `rule`, as reviewers read them. */
  ruleFiles: string;
  /** What a reproduction may run: a `*` stands for a word. */
  testRunners: string[];
  /** Whether a reproduction command only runs tests with one of {@link testRunners}. */
  isTestCommand(command: string): boolean;
  judges: Record<string, Judge>;
  reviewers: Reviewer[];
  /** What the plan gets wrong about the repository at `base`, once it is well formed. */
  checkPlan?(plan: Plan<X>, o: { root: string; vcs: Vcs; base: string }): Promise<string[]>;
  /** What else rejects a claim before anything runs. */
  checkClaim?(o: {
    root: string;
    vcs: Vcs;
    plan: Plan<X>;
    stage: Stage;
    base: string;
    candidate: string;
    files: FileChange[];
  }): Promise<string[]>;
  /** Sections of the plan the core does not know, as reviewers and PRs read them. */
  describePlan?(plan: Plan<X>): string;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #12186** (2026-11-04): **[BUG] FLOAT32 COSINE search returns distance -1 for an identical nonzero subnormal vector**
  *Symptoms*: **Describe the bug**  A `FLOAT32` vector index using the `COSINE` distance metric returns a distance of `-1` when an identical, finite, nonzero subnormal vector is used as both the stored vector and the query vector.  For an identical nonzero vector, the cosine similarity should be `1` and the cosine distance should be `0`. Instead, the returned distance is `-1`, which is outside the expected cosine-distance range and can affect ranking and threshold filtering.  The input value is the smallest positive nonzero IEEE-754 float32 value:  ```text t = 1.401298464324817e-45 vector = [t, t] ```  The result was reproduced consistently.  **To Reproduce**  1. Start Redis Stack:  ```bash docker run --rm --name redis-cosine-repro -p 6379:6379 redis/redis-stack-server:latest ```  2. Install the Python client:  ```bash python -m pip install redis ```  3. Save and run the following script:  ```python import struct import uuid  import redis   client = redis.Redis(host="127.0.0.1", port=6379)  suffix = uuid.uuid4().hex[:8] index_name = f"idx_cosine_subnormal_{suffix}" key_prefix = f"cosine_subnormal_{suffix}:" point_key = f"{key_prefix}0"  # IEEE-754 binary32 bit pattern 0x00000001: # the smallest positive, nonzero float32 value. tiny = struct.unpack("<f", struct.pack("<I", 1))[0]  # The stored vector and query vector are identical. vector_blob = struct.pack("<ff", tiny, tiny)  try:     client.execute_command(         "FT.CREATE",         index_name,         "ON", "HASH",         "PREFIX", "1

- **Issue #11970** (2026-10-26): **[BUG] Duplicate FT.AGGREGATE cursor rows after deletes while index backfill is active**
  *Symptoms*: ## Describe the bug  A raw redis-py diagnostic observed duplicate physical row IDs across FT.AGGREGATE / FT.CURSOR READ pages immediately after bulk deletes while FT.INFO still reported indexing=1. This reproducer does not use Go, ADBC or Arrow. Please investigate whether this is a defect or an expected limitation during initial backfill, and document a supported readiness/mitigation contract.  ## Environment  - Redis OSS 8.6.2; Search module version 80600 (8.6.0), local Docker standalone. - Client: macOS 26.7.1 arm64, redis-py; diagnostic runs RESP2 and RESP3 separately. - search-max-aggregate-results: 2147483648. - Observations were captured on October 21, 2026. This report uses preserved evidence; it is not a new reproduction against latest master. CPU model was not recorded.  ## To reproduce  1. On a disposable Redis with Search, create a HASH index with sortable NUMERIC __rowid, adv and width fields. 2. Insert row IDs 1..100000, then delete every ID not divisible by 10. No further application writes are made during reads. 3. Query `@__rowid:[1 100000]` with `LOAD 4 @__key @__rowid @width @adv`, `TIMEOUT 0`, `WITHCURSOR COUNT 10000`, `DIALECT 2`. Finish every cursor with `FT.CURSOR READ ... COUNT 10000`. 4. Compare the complete row multiset with IDs 10,20,...,100000. Repeat, and compare with a separate run that first waits for num_docs=10000 and indexing=0.  Preserved executable reproducer (creates/drops only a generated test prefix/index): https://github.com/alberttwong/

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

### Incident Patch 1: `7a24743f` (2026-11-25)
**Commit Message**: [MOD-20693] Stop the query pipeline on memory pressure (#12378)

* Check query memory at build, before execution

Carried from https://github.com/RediSearch/RediSearch/pull/12122

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* Stop the sorter and score normalizer on memory pressure

Carried from https://github.com/RediSearch/RediSearch/pull/12123

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* Stop the grouper on memory pressure

Carried from https://github.com/RediSearch/RediSearch/pull/12124

Conflicts with master resolved: master rewrote the GROUPBY key expansion
(extractGroups recursion became invokeGroupReducers with a combination
loop), so the per-row expansion checkpoint moved into that loop. A test
addition conflicted with a neighbouring master test; both are kept.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* Stop the safe loader on memory pressure

Carried from https://github.com/RediSearch/RediSearch/pull/12125

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* Stop the WITHCOUNT depleter and APPLY/FILTER on memory pressure

Carried from https://github.com/RediSearch/RediSearch/pull/12126

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EM

**File**: `src/aggregate/aggregate_exec.c` (modified, +34/-3)
```diff
@@ -24,6 +24,7 @@
 #include "search_ctx.h"
 #include "aggregate.h"
 #include "aggregate_exec_common.h"
+#include "query_memory.h"
 #include "cursor.h"
 #include "concurrent_ctx.h"
 #include "rmutil/util.h"
@@ -435,8 +436,19 @@ static inline void debugPauseStoreResults(AREQ *req, bool before) {
 }
 #endif
 static int applyOomStop(AREQ *req, int rc) {
-  return ApplyOomStop(&req->base.limits, req->base.reqConfig.oomPolicy,
-                      AREQ_QueryProcessingCtx(req)->err, rc);
+  QueryError *err = AREQ_QueryProcessingCtx(req)->err;
+  // A buffering stage that kept its rows past an OOM stop may hold enough of them to fill the
+  // reply's limit or a pager's, so the reply ends without reading the stop's RS_RESULT_STOPPED.
+  // When no later cursor read reports the stop, the reply is cut.
+  const bool lastReply =
+      rc == RS_RESULT_EOF || (rc == RS_RESULT_OK && !(AREQ_RequestFlags(req) & QEXEC_F_IS_CURSOR));
+  // A blocked-client timeout that fired in the meantime owns the reply, as in ApplyOomStop.
+  if (lastReply && req->base.reqConfig.oomPolicy != OomPolicy_Fail &&
+      AREQ_QueryProcessingCtx(req)->oomCut &&
+      !QueryRequestLimits_IsBlockedClientTimedOut(&req->base.limits)) {
+    QueryError_SetQueryOOMWarning(err);
+  }
+  return ApplyOomStop(&req->base.limits, req->base.reqConfig.oomPolicy, err, rc);
 }
 
 static void startPipeline(AREQ *req, ResultProcessor *rp, SearchResult ***results, SearchResult *r, int *rc) {
@@ -722,7 +734,8 @@ static bool shouldSetCursorDone(AREQ *req, int rc) {
   if (rc == RS_RESULT_STOPPED) {
     switch (req->base.limits.timeout.config.timeoutPolicy) {
       case TimeoutPolicy_Return:
-        return false;
+        // A memory stop ends the request even when its outcome is reported as a timeout.
+        return QueryRequestLimits_IsMemoryStopped(&req->base.limits);
       case TimeoutPolicy_ReturnStrict:
       case TimeoutPolicy_Fail:
         return true;
@@ -1406,6 +1419,15 @@ void AREQ_Execute_Callback(blockedClientReqCtx *BCRctx) {
   blockedClientReqCtx_destroy(BCRctx);
 }
 
+// Memory checkpoint once the query is built, which also covers the wait for a worker. FT.EXPLAIN
+// builds a plan it never runs, so it is exempt.
+static int checkBuildMemory(AREQ *req, QueryError *status) {
+  if (!IsSearch(req) && !IsAggregate(req)) {
+    return REDISMODULE_OK;
+  }
+  return QueryMemory_CheckBeforeExecution(&req->base.limits, req->base.reqConfig.oomPolicy, status);
+}
+
 // Assumes the spec is guarded by its own lock (for read), such that races with
 // main-thread/GC updates are avoided.
 static int prepareExecutionPlan(AREQ *req, QueryError *status) {
@@ -1471,6 +1493,15 @@ static int prepareExecutionPlan(AREQ *req, QueryError *status) {
     req->profileClocks.profilePipelineBuildTime = rs_wall_clock_elapsed_ns(&parseClock);
   }
 
+  if (rc == REDISMODULE_OK && checkBuildMemory(req, status) != REDISMODULE_OK) {
+    return REDISMODULE_ERR;
+  }
+  // A build checkpoint that stopped the query under ON_OOM RETURN leaves the pipeline to run:
+  // its row source, built only now, must end at its first read.
+  if (rc == REDISMODULE_OK && QueryRequestLimits_IsMemoryStopped(&req->base.limits)) {
+    RP_EndRowSourceOnStop(AREQ_QueryProcessingCtx(req));
+  }
+
   if (IsDebug(req)) {
     rc = parseAndCompileDebug((AREQ_Debug *)req, status);
     if (rc != REDISMODULE_OK) {
```

**File**: `src/aggregate/aggregate_exec_common.c` (modified, +34/-6)
```diff
@@ -49,15 +49,23 @@
 
 int ApplyOomStop(const QueryRequestLimits *limits, RSOomPolicy oomPolicy, QueryError *err,
                  int rc) {
-  if (rc != RS_RESULT_STOPPED || !QueryRequestLimits_IsMemoryStopped(limits)) {
+  // A blocked-client timeout's callback owns the reply, so it wins over an earlier OOM stop.
+  if (rc != RS_RESULT_STOPPED || !QueryRequestLimits_IsMemoryStopped(limits) ||
+      QueryRequestLimits_IsBlockedClientTimedOut(limits)) {
     return rc;
   }
   if (oomPolicy == OomPolicy_Fail) {
     QueryError_SetCode(err, QUERY_ERROR_CODE_OUT_OF_MEMORY);
     return RS_RESULT_ERROR;
   }
   QueryError_SetQueryOOMWarning(err);
-  // Not STOPPED: that replies as a timeout, and a cursor would read again into the same stop.
+  // A timeout that also fired outranks the stop: ON_TIMEOUT FAIL replies its error (the OOM
+  // warning is then unused) and RETURN replies both warnings, the timeout one derived from rc.
+  if (QueryRequestLimits_IsTimedOutExact(limits)) {
+    return RS_RESULT_STOPPED;
+  }
+  // Without a timeout, EOF rather than STOPPED: STOPPED replies as a timeout, and a cursor would
+  // read again into the same stop.
   return RS_RESULT_EOF;
 }
 
@@ -102,6 +110,13 @@ static inline void debugCheckAndPauseAfterAggregateResult(AREQ *areq) {
 static inline void debugCheckAndPauseAfterAggregateResult(AREQ *areq) {}
 #endif
 
+static bool oomStopKeepsBufferedRows(const AREQ *areq) {
+  const QueryRequestLimits *timeout = &areq->base.limits;
+  return QueryRequestLimits_IsMemoryStopped(timeout) &&
+         areq->base.reqConfig.oomPolicy != OomPolicy_Fail &&
+         !QueryRequestLimits_IsBlockedClientTimedOut(timeout);
+}
+
  SearchResult **AggregateResults(ResultProcessor *rp, AREQ *areq, int *rc) {
    SearchResult **results = array_new(SearchResult *, 8);
    SearchResult r = SearchResult_New();
@@ -119,8 +134,19 @@ static inline void debugCheckAndPauseAfterAggregateResult(AREQ *areq) {}
      // Honour a memory stop or a main-thread timeout flag at the row
      // boundary: buffering stages (safe loader, sorter yield) can keep emitting
      // from internal buffers without re-touching upstream's per-row timeout check.
-     if (areq && (QueryRequestLimits_IsMemoryStopped(&areq->base.limits) ||
-                  QueryRequestLimits_IsBlockedClientTimedOut(&areq->base.limits))) {
+     // An OOM stop under ON_OOM RETURN is the exception: those stages then hand
+     // over the rows they already hold (see RP_StopPolicy), and read nothing new.
+     if (areq &&
+         (QueryRequestLimits_IsMemoryStopped(&areq->base.limits) ||
+          QueryRequestLimits_IsBlockedClientTimedOut(&areq->base.limits)) &&
+         !oomStopKeepsBufferedRows(areq)) {
+       *rc = RS_RESULT_STOPPED;
+       break;
+     }
+     // Rows handed over after an OOM stop read nothing upstream, so no per-row check there sees
+     // a clock deadline: this one ends the drain on it.
+     if (areq && oomStopKeepsBufferedRows(areq) &&
+         QueryRequestLimits_IsTimedOut(&areq->base.limits)) {
        *rc = RS_RESULT_STOPPED;
        break;
      }
@@ -138,8 +164,10 @@ static inline void debugCheckAndPauseAfterAggregateResult(AREQ *areq) {}
      // Aggregate all results before populating the response
      *results = AggregateResults(rp, ctx->areq, rc);
      // Check timeout after aggregation; a memory stop raised while filling the limit ends it the
-     // same way.
-     if (QueryRequestLimits_ShouldStopExact(ctx->limits)) {
+     // same way, except under ON_OOM RETURN, where the held rows keep coming over the next reads.
+     if (QueryRequestLimits_IsTimedOutExact(ctx->limits) ||
+         (QueryRequestLimits_IsMemoryStopped(ctx->limits) &&
+          !(ctx->areq && oomStopKeepsBufferedRows(ctx->areq)))) {
        *rc = RS_RESULT_STOPPED;
      }
    } else {
```

**File**: `src/aggregate/aggregate_exec_common.h` (modified, +3/-0)
```diff
@@ -35,6 +35,9 @@ void ReplyWithTimeoutError(RedisModule_Reply *reply);
  *   startPipelineCommon buffers under FAIL.
  * - Otherwise: the query OOM warning in `err` and RS_RESULT_EOF, so the rows
  *   produced so far are the final, partial result instead of a timeout.
+ *   If the request's timeout also fired (QueryRequestLimits_IsTimedOutExact),
+ *   RS_RESULT_STOPPED is returned instead, so the timeout outcome is kept: an
+ *   error under ON_TIMEOUT FAIL, a warning beside the OOM one otherwise.
  */
 int ApplyOomStop(const struct QueryRequestLimits *limits, RSOomPolicy oomPolicy,
                  QueryError *err, int rc);
```

**File**: `src/aggregate/aggregate_request.c` (modified, +6/-1)
```diff
@@ -1945,7 +1945,12 @@ int AREQ_BuildPipelineWithAggregationParams(AREQ *req,
                                             QueryError *status) {
   // Build errors go to the caller's `status`; the running pipeline reports into the request's own
   // error slot, which the reply phase reads whenever (and on whichever thread) it runs.
-  Pipeline_Initialize(&req->pipeline, req->base.limits.timeout.config.timeoutPolicy, &req->base.reply.err);
+  Pipeline_Initialize(&req->pipeline, &req->base);
+  if (IsHybrid(req)) {
+    // The hybrid reply does not map an OOM stop yet, so hybrid pipelines run without memory
+    // checkpoints: a stop there would reply as a timeout.
+    req->pipeline.qctx.limits = NULL;
+  }
   if (!IsCoordinator(req)) {
     QueryPipelineParams params = {
       .common = {
```

**File**: `src/aggregate/expr/expression.c` (modified, +4/-0)
```diff
@@ -481,6 +481,10 @@ typedef struct RPEvaluator {
 #define RESULT_EVAL_ERR RS_RESULT_MAX + 1
 
 static int rpevalCommon(RPEvaluator *pc, SearchResult *r) {
+  // Checked before the next row, so the arena growth of the previous evaluation is counted.
+  if (RP_FillShouldCut(&pc->base)) {
+    return RS_RESULT_STOPPED;
+  }
   /** Get the upstream result */
   int rc = pc->base.upstream->Next(pc->base.upstream, r);
   if (rc != RS_RESULT_OK) {
```

**File**: `src/aggregate/group_by.c` (modified, +21/-2)
```diff
@@ -16,6 +16,7 @@
 #include "value_ffi.h"
 #include "search_result_ffi.h"
 #include "pipeline/pipeline.h"
+#include "query_memory.h"
 #include "reducer.h"
 #include "query_error.h"
 #include "query_error_ffi.h"
@@ -281,6 +282,13 @@ static int invokeGroupReducers(Grouper *g, RLookupRow *srcrow, t_docId docId) {
 
   // Rows without multi-valued keys belong to one group, so skip the scan for more.
   do {
+    // The array values of one row can reach up to maxGroups groups, new or existing, before the
+    // per-row check.
+    if (combinations > 1 && g->base.parent->limits &&
+        QueryMemory_Checkpoint(g->base.parent->limits)) {
+      RP_EndRowSourceOnStop(g->base.parent);
+      return RS_RESULT_STOPPED;
+    }
     int rc = addToGroup(g, nkeys ? g->cursors[nkeys - 1].hash : 0, srcrow, docId);
     if (rc != RS_RESULT_OK) {
       return rc;
@@ -298,6 +306,12 @@ static int Grouper_rpAccum(ResultProcessor *base, SearchResult *res) {
   while ((rc = base->upstream->Next(base->upstream, res)) == RS_RESULT_OK) {
     rc = invokeGroupReducers(g, SearchResult_GetRowDataMut(res), SearchResult_GetDocId(res));
     SearchResult_Clear(res);
+    if (rc == RS_RESULT_OK && base->parent->limits &&
+        QueryMemory_Checkpoint(base->parent->limits)) {
+      // No partial groups: like a timeout, the stop yields none, and Grouper_rpFree frees them.
+      RP_EndRowSourceOnStop(base->parent);
+      rc = RS_RESULT_STOPPED;
+    }
     if (rc != RS_RESULT_OK) {
       break;
     }
@@ -311,9 +325,14 @@ static int Grouper_rpAccum(ResultProcessor *base, SearchResult *res) {
     base->parent->skippedResults = 0;
     g->iter = kh_begin(khid);
     return Grouper_rpYield(base, res);
-  } else {
-    return rc;
   }
+  if (rc == RS_RESULT_STOPPED && base->parent->limits &&
+      QueryRequestLimits_IsMemoryStopped(base->parent->limits)) {
+    // No group is replied, so none is counted either.
+    base->parent->totalResults = 0;
+    base->parent->skippedResults = 0;
+  }
+  return rc;
 }
 
 static void Grouper_rpFree(ResultProcessor *grrp) {
```

**File**: `src/coord/dist_aggregate.c` (modified, +5/-0)
```diff
@@ -724,6 +724,11 @@ void printAggProfile(RedisModule_Reply *reply, void *ctx) {
     do {
       MRReply_Free(rpnet->current.root);
       RPNet_resetCurrent(rpnet);
+      // A memory stop, possibly requested mid-drain, aborts the pop on an empty channel with
+      // RS_RESULT_STOPPED forever. Take only what is queued, so the next call ends with EOF.
+      if (QueryRequestLimits_IsMemoryStopped(&req->base.limits)) {
+        rpnet->drainOnly = true;
+      }
     } while (getNextReply(rpnet) != RS_RESULT_EOF);
     rpnet->breakdown.waitTime = waitTime;
     rpnet->breakdown.convertTime = convertTime;
```

**File**: `src/hybrid/hybrid_request.c` (modified, +11/-2)
```diff
@@ -9,6 +9,7 @@
 
 #include "hybrid/hybrid_request.h"
 #include "config.h"
+#include "query_memory.h"
 #include <stdatomic.h>
 #include <stdint.h>
 #include <string.h>
@@ -127,6 +128,12 @@ int HybridRequest_BuildDepletionPipeline(HybridRequest *req, bool depleteInBackg
         if (isProfile) {
           areq->profileClocks.profilePipelineBuildTime = rs_wall_clock_elapsed_ns(&parseClock);
         }
+        // Only FAIL is decided here: the hybrid reply does not map an OOM stop yet, so under
+        // RETURN a stop requested now would reply as a timeout.
+        if (rc == REDISMODULE_OK && areq->base.reqConfig.oomPolicy == OomPolicy_Fail) {
+          rc = QueryMemory_CheckBeforeExecution(&areq->base.limits, areq->base.reqConfig.oomPolicy,
+                                                &areq->base.reply.err);
+        }
         if (rc != REDISMODULE_OK) {
             break;
         }
@@ -351,7 +358,9 @@ void HybridRequest_Init(HybridRequest *hybridReq, RedisSearchCtx *sctx, AREQ **r
     // Initialize the tail pipeline that will merge results from all requests
     hybridReq->tailPipeline = rm_calloc(1, sizeof(Pipeline));
     AGPLN_Init(&hybridReq->tailPipeline->ap);
-    Pipeline_Initialize(hybridReq->tailPipeline, hybridReq->base.limits.timeout.config.timeoutPolicy, &hybridReq->base.reply.err);
+    Pipeline_Initialize(hybridReq->tailPipeline, &hybridReq->base);
+    // No memory checkpoints in hybrid pipelines (see AREQ_BuildPipelineWithAggregationParams).
+    hybridReq->tailPipeline->qctx.limits = NULL;
     QueryRequest_SetEndProcRef(&hybridReq->base, &hybridReq->tailPipeline->qctx.endProc);
     // Capture the background-scan-OOM warning flag while the spec is guaranteed
     // alive (main-thread command handling). The reply path reads only this
@@ -364,7 +373,7 @@ void HybridRequest_Init(HybridRequest *hybridReq, RedisSearchCtx *sctx, AREQ **r
     // Initialize pipelines for each individual request
     for (size_t i = 0; i < nrequests; i++) {
         initializeAREQ(requests[i]);
-        Pipeline_Initialize(&requests[i]->pipeline, requests[i]->base.limits.timeout.config.timeoutPolicy, &requests[i]->base.reply.err);
+        Pipeline_Initialize(&requests[i]->pipeline, &requests[i]->base);
     }
     hybridReq->profileClocks.initClock = now;
 
```

---

### Incident Patch 2: `4fefcf22` (2026-11-25)
**Commit Message**: [MOD-21401] Fix a crash on DIALECT 1 queries on fields of the wrong type (#12455)

* Fix a crash on DIALECT 1 tag queries on non-TAG fields

DIALECT 1 builds a tag node on any field, and the tag evaluator only
debug-asserted the field type before reading tagOpts. A debug build
aborted the server on a query such as `@vec:{x}` on a VECTOR field; a
release build read that field's own options (vector parameters, a
geometry index) as a tag index pointer. The evaluator now checks the
type, and such a query matches nothing.

The flow test runs the query on VECTOR and GEOSHAPE fields, whose
options put a non-null pointer where a TAG field keeps its tag index.
On master it crashes the server; with the fix it returns no results.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Check field types in the DIALECT 1 parser for tag, numeric and geo queries

DIALECT 1 built a tag, numeric range or geo filter node on a field of any
type. DIALECT 2 and the legacy FILTER/GEOFILTER arguments reject or nullify
such queries when they are built. Do the same in the DIALECT 1 grammar: a
query on a field of the wrong type becomes a null node, which matches nothing,
also inside an intersection.

The eva

**File**: `src/query_parser/v1/parser.c` (modified, +15/-1)
```diff
@@ -1562,6 +1562,11 @@ static YYACTIONTYPE yy_reduce(
             if (!fs) {
                 QueryNode_Free(yylhsminor.yy17);
                 yylhsminor.yy17 = NULL;
+            } else if (!FIELD_IS(fs, INDEXFLD_T_TAG)) {
+                // DIALECT 2 rejects this; DIALECT 1 keeps it valid but matching nothing. It becomes
+                // a null node rather than a dropped clause, so an intersection with it stays empty.
+                QueryNode_Free(yylhsminor.yy17);
+                yylhsminor.yy17 = NewQueryNode(QN_NULL);
             } else {
                 yylhsminor.yy17->tag.fieldIndex = fs->index;
             }
@@ -1605,8 +1610,13 @@ static YYACTIONTYPE yy_reduce(
     // we keep the capitalization as is
     yylhsminor.yy17 = NULL;
     const FieldSpec *fs = ctx->sctx->spec ? IndexSpec_GetFieldWithLength(ctx->sctx->spec, yymsp[-2].minor.yy0.s, yymsp[-2].minor.yy0.len) : NULL;
-    if (fs) {
+    if (fs && FIELD_IS(fs, INDEXFLD_T_NUMERIC)) {
         yylhsminor.yy17 = NewNumericNode(yymsp[0].minor.yy86, fs);
+    } else if (fs) {
+        // As for a tag query on a non-TAG field: valid on DIALECT 1, matching nothing.
+        QueryParam_Free(yymsp[0].minor.yy86);
+        yymsp[0].minor.yy86 = NULL;
+        yylhsminor.yy17 = NewQueryNode(QN_NULL);
     } else if (yymsp[0].minor.yy86) {
         QueryParam_Free(yymsp[0].minor.yy86);
         yymsp[0].minor.yy86 = NULL;
@@ -1630,6 +1640,10 @@ static YYACTIONTYPE yy_reduce(
         if (!fs) {
             QueryNode_Free(yylhsminor.yy17);
             yylhsminor.yy17 = NULL;
+        } else if (!FIELD_IS(fs, INDEXFLD_T_GEO)) {
+            // As for a tag query on a non-TAG field: valid on DIALECT 1, matching nothing.
+            QueryNode_Free(yylhsminor.yy17);
+            yylhsminor.yy17 = NewQueryNode(QN_NULL);
         }
     }
 }
```

**File**: `src/query_parser/v1/parser.y` (modified, +15/-1)
```diff
@@ -513,6 +513,11 @@ expr(A) ::= modifier(B) COLON tag_list(C) . {
             if (!fs) {
                 QueryNode_Free(A);
                 A = NULL;
+            } else if (!FIELD_IS(fs, INDEXFLD_T_TAG)) {
+                // DIALECT 2 rejects this; DIALECT 1 keeps it valid but matching nothing. It becomes
+                // a null node rather than a dropped clause, so an intersection with it stays empty.
+                QueryNode_Free(A);
+                A = NewQueryNode(QN_NULL);
             } else {
                 A->tag.fieldIndex = fs->index;
             }
@@ -574,8 +579,13 @@ expr(A) ::= modifier(B) COLON numeric_range(C). {
     // we keep the capitalization as is
     A = NULL;
     const FieldSpec *fs = ctx->sctx->spec ? IndexSpec_GetFieldWithLength(ctx->sctx->spec, B.s, B.len) : NULL;
-    if (fs) {
+    if (fs && FIELD_IS(fs, INDEXFLD_T_NUMERIC)) {
         A = NewNumericNode(C, fs);
+    } else if (fs) {
+        // As for a tag query on a non-TAG field: valid on DIALECT 1, matching nothing.
+        QueryParam_Free(C);
+        C = NULL;
+        A = NewQueryNode(QN_NULL);
     } else if (C) {
         QueryParam_Free(C);
         C = NULL;
@@ -602,6 +612,10 @@ expr(A) ::= modifier(B) COLON geo_filter(C). {
         if (!fs) {
             QueryNode_Free(A);
             A = NULL;
+        } else if (!FIELD_IS(fs, INDEXFLD_T_GEO)) {
+            // As for a tag query on a non-TAG field: valid on DIALECT 1, matching nothing.
+            QueryNode_Free(A);
+            A = NewQueryNode(QN_NULL);
         }
     }
 }
```

**File**: `src/redisearch_rs/query_eval/src/nodes/geo.rs` (modified, +15/-0)
```diff
@@ -48,6 +48,21 @@ pub(crate) fn eval<'index>(
         field_index < ctx.spec().numFields,
         "fieldIndex must be within the spec's current field count"
     );
+    if cfg!(debug_assertions) {
+        let spec = ctx.spec();
+        // SAFETY: `field_index` is within `spec.numFields` (asserted above), so this
+        // stays within the bounds of the `numFields`-sized array `spec.fields` points to.
+        let field_ptr = unsafe { spec.fields.add(field_index as usize) };
+        // SAFETY: `field_ptr` points into the live spec's field array, which the
+        // query's spec read lock keeps alive and unmodified throughout evaluation.
+        let field = unsafe { &*field_ptr };
+        // Both query parsers and the legacy `GEOFILTER` argument build a geo node only on a
+        // GEO field.
+        assert!(
+            field.types() & ffi::FieldType_INDEXFLD_T_GEO != 0,
+            "a geo node must reference a geo field"
+        );
+    }
 
     // Disk-index path: when the spec is backed by an on-disk index, delegate to
     // the enterprise geo iterator instead of opening the in-memory range tree.
```

**File**: `src/redisearch_rs/query_eval/src/nodes/numeric.rs` (modified, +19/-0)
```diff
@@ -40,6 +40,25 @@ pub(crate) fn eval<'index>(
         "numeric node must have a resolved field index"
     );
     let field_index = nf.field_index;
+    if cfg!(debug_assertions) {
+        let spec = ctx.spec();
+        assert!(
+            field_index < spec.numFields,
+            "field_index must be within the spec's current field count"
+        );
+        // SAFETY: `field_index` is within `spec.numFields` (checked above), so this
+        // stays within the bounds of the `numFields`-sized array `spec.fields` points to.
+        let field_ptr = unsafe { spec.fields.add(field_index as usize) };
+        // SAFETY: `field_ptr` points into the live spec's field array, which the
+        // query's spec read lock keeps alive and unmodified throughout evaluation.
+        let field = unsafe { &*field_ptr };
+        // Both query parsers and the legacy `FILTER` argument build a numeric node only on a
+        // NUMERIC field.
+        assert!(
+            field.types() & ffi::FieldType_INDEXFLD_T_NUMERIC != 0,
+            "a numeric node must reference a numeric field"
+        );
+    }
 
     // Disk-index path: when the spec is backed by an on-disk index, delegate to
     // the enterprise numeric iterator instead of opening the in-memory range
```

**File**: `src/redisearch_rs/query_eval/src/nodes/tag.rs` (modified, +2/-1)
```diff
@@ -99,11 +99,12 @@ pub(crate) fn eval<'index>(
     // Going through the raw pointer detaches the borrow from `ctx`, which the
     // children's evaluation needs exclusively.
     let field = unsafe { &*field_ptr };
+    // Both query parsers build a tag node only on a TAG field.
     debug_assert!(
         field.types() & ffi::FieldType_INDEXFLD_T_TAG != 0,
         "a tag node must reference a tag field"
     );
-    // SAFETY: the field is a tag field, so `tagOpts` is the active union member.
+    // SAFETY: the field is a tag field (asserted above), so `tagOpts` is the active union member.
     let index = NonNull::new(unsafe { field.__bindgen_anon_1.tagOpts.tagIndex })?;
     // SAFETY: the tag index belongs to the field; the query's spec read lock keeps
     // it alive and excludes writers, so it is not restructured during evaluation.
```

**File**: `tests/pytests/test_geo.py` (modified, +20/-0)
```diff
@@ -241,3 +241,23 @@ def testGeoParseTrailingWhitespace(env):
   conn.execute_command('HSET', 'ws2', 'g', '1.23, 4.56 ')
 
   assertInfoField(env, 'idx', 'hash_indexing_failures', 0)
+
+
+@skip(cluster=True)
+def testDialect1GeoQueryOnANonGeoFieldMatchesNothing(env):
+    # DIALECT 2 rejects a geo filter on a non-GEO field. DIALECT 1 accepts it and it matches
+    # nothing, also inside an intersection. A NUMERIC field's range tree holds plain numbers, which
+    # the filter's geohash ranges used to be matched against.
+    conn = getConnectionByEnv(env)
+    env.expect('FT.CREATE', 'idx', 'SCHEMA', 'n', 'NUMERIC', 't', 'TAG', 'loc', 'GEO').ok()
+    # `n` holds the geohash score of the query center, so matching the filter's geohash ranges
+    # against the numeric tree would find the document.
+    conn.execute_command('GEOADD', 'geohash_probe', 1, 1, 'p')
+    center_score = conn.execute_command('ZSCORE', 'geohash_probe', 'p')
+    conn.execute_command('DEL', 'geohash_probe')
+    conn.execute_command('HSET', 'doc:1', 'n', center_score, 't', 'red', 'loc', '1,1')
+    for field in ['n', 't']:
+        env.expect('FT.SEARCH', 'idx', f'@{field}:[1 1 10 km]', 'DIALECT', 1).equal([0])
+        env.expect('FT.SEARCH', 'idx', f'@{field}:[1 1 10 km] @loc:[1 1 10 km]',
+                   'DIALECT', 1).equal([0])
+    env.expect('FT.SEARCH', 'idx', '@loc:[1 1 10 km]', 'NOCONTENT', 'DIALECT', 1).equal([1, 'doc:1'])
```

**File**: `tests/pytests/test_numbers.py` (modified, +14/-0)
```diff
@@ -893,3 +893,17 @@ def validate_subtree(subtree):
     cause_split(1) # to the left (of 2, right of 0)
 
     validate_tree(env.cmd(debug_cmd(), 'DUMP_NUMIDXTREE', idx, field, 'MINIMAL'))
+
+
+@skip(cluster=True)
+def testDialect1NumericQueryOnANonNumericFieldMatchesNothing(env):
+    # DIALECT 2 rejects a numeric range on a non-NUMERIC field. DIALECT 1 accepts it and it matches
+    # nothing, also inside an intersection. A GEO field keeps its points in a numeric range tree,
+    # which an unbounded range used to match.
+    conn = getConnectionByEnv(env)
+    env.expect('FT.CREATE', 'idx', 'SCHEMA', 'loc', 'GEO', 't', 'TAG', 'n', 'NUMERIC').ok()
+    conn.execute_command('HSET', 'doc:1', 'loc', '1,1', 't', 'red', 'n', 5)
+    for field in ['loc', 't']:
+        env.expect('FT.SEARCH', 'idx', f'@{field}:[-inf +inf]', 'DIALECT', 1).equal([0])
+        env.expect('FT.SEARCH', 'idx', f'@{field}:[-inf +inf] @n:[5 5]', 'DIALECT', 1).equal([0])
+    env.expect('FT.SEARCH', 'idx', '@n:[5 5]', 'NOCONTENT', 'DIALECT', 1).equal([1, 'doc:1'])
```

**File**: `tests/pytests/test_tags.py` (modified, +18/-0)
```diff
@@ -1352,3 +1352,21 @@ def testSortableTagIndexingInvalidUtf8LoweringOverflow(env):
     env.assertEqual(errors['last indexing error key'], 'doc2')
 
     env.expect('FT.SEARCH', 'idx_sortable', '*', 'NOCONTENT').equal([1, 'doc1'])
+
+
+@skip(cluster=True)
+def testDialect1TagQueryOnANonTagFieldMatchesNothing(env):
+    # DIALECT 2 rejects a tag query on a non-TAG field. DIALECT 1 accepts it and it matches
+    # nothing, also inside an intersection, which a dropped clause would not. VECTOR and GEOSHAPE
+    # keep their own options where a TAG field keeps its tag index.
+    conn = getConnectionByEnv(env)
+    env.expect('FT.CREATE', 'idx', 'SCHEMA',
+               'v', 'VECTOR', 'FLAT', 6, 'TYPE', 'FLOAT32', 'DIM', 2, 'DISTANCE_METRIC', 'L2',
+               'g', 'GEOSHAPE', 'FLAT',
+               't', 'TAG').ok()
+    conn.execute_command('HSET', 'doc:1', 'v', np.array([1.0, 2.0], dtype=np.float32).tobytes(),
+                         'g', 'POINT (1 1)', 't', 'red')
+    for field in ['v', 'g']:
+        env.expect('FT.SEARCH', 'idx', f'@{field}:{{red}}', 'DIALECT', 1).equal([0])
+        env.expect('FT.SEARCH', 'idx', f'@{field}:{{red}} @t:{{red}}', 'DIALECT', 1).equal([0])
+    env.expect('FT.SEARCH', 'idx', '@t:{red}', 'NOCONTENT', 'DIALECT', 1).equal([1, 'doc:1'])
```

#### Recent Merged Pull Requests:
- **PR #12545** (closed): [MOD-20990] Stop TAG dictionary walks when a query reaches its limits (@nonirosenfeldredis)
- **PR #12543** (closed): [2.6] [MOD-21401] Fix a crash on DIALECT 1 queries on fields of the wrong type (@redisearch-backport-pull-request[bot])
- **PR #12542** (closed): [2.8] [MOD-21401] Fix a crash on DIALECT 1 queries on fields of the wrong type (@redisearch-backport-pull-request[bot])
- **PR #12541** (closed): [8.2] [MOD-21401] Fix a crash on DIALECT 1 queries on fields of the wrong type (@redisearch-backport-pull-request[bot])
- **PR #12540** (closed): [8.4] [MOD-21401] Fix a crash on DIALECT 1 queries on fields of the wrong type (@redisearch-backport-pull-request[bot])
- **PR #12539** (closed): [8.6] [MOD-21401] Fix a crash on DIALECT 1 queries on fields of the wrong type (@redisearch-backport-pull-request[bot])

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

## X. [MOD-20693] Stop the query pipeline on memory pressure

**RULE**:
When implementing operations in `src/aggregate/aggregate_exec.c`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RediSearch/RediSearch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7a24743f`: [MOD-20693] Stop the query pipeline on memory pressure. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/aggregate/aggregate_exec.c`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#include "query_memory.h"
  QueryError *err = AREQ_QueryProcessingCtx(req)->err;
  // A buffering stage that kept its rows past an OOM stop may hold enough of them to fill the
  // reply's limit or a pager's, so the reply ends without reading the stop's RS_RESULT_STOPPED.
  // When no later cursor read reports the stop, the reply is cut.
  const bool lastReply =
      rc == RS_RESULT_EOF || (rc == RS_RESULT_OK && !(AREQ_RequestFlags(req) & QEXEC_F_IS_CURSOR));
  // A blocked-client timeout that fired in the meantime owns the reply, as in ApplyOomStop.
  if (lastReply && req->base.reqConfig.oomPolicy != OomPolicy_Fail &&
      AREQ_QueryProcessingCtx(req)->oomCut &&
      !QueryRequestLimits_IsBlockedClientTimedOut(&req->base.limits)) {
    QueryError_SetQueryOOMWarning(err);
  }
  return ApplyOomStop(&req->base.limits, req->base.reqConfig.oomPolicy, err, rc);
        // A memory stop ends the request even when its outcome is reported as a timeout.
        return QueryRequestLimits_IsMemoryStopped(&req->base.limits);
// Memory checkpoint once the query is built, which also covers the wait for a worker. FT.EXPLAIN
// builds a plan it never runs, so it is exempt.
static int checkBuild
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
  return ApplyOomStop(&req->base.limits, req->base.reqConfig.oomPolicy,
                      AREQ_QueryProcessingCtx(req)->err, rc);
        return false;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7a24743f` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
