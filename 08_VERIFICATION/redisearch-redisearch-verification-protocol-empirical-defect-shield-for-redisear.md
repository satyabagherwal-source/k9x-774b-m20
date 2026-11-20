# Verification Protocol: Verification Protocol: Empirical Defect Shield for RediSearch/RediSearch

<!-- PROVENANCE_START
{
  "source_repository": "RediSearch/RediSearch",
  "source_url": "https://github.com/RediSearch/RediSearch",
  "source_version": "f01b5c68",
  "license": "NOASSERTION",
  "timestamp": "2026-11-20T12:07:25.690Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-redisearch-redisearch",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [RediSearch/RediSearch](https://github.com/RediSearch/RediSearch) (Revision: `f01b5c68`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-20T12:07:25.690Z`  
> **Learning ID**: `learn-github-redisearch-redisearch`


## 1. Scope & Verification Target
- **Target Repository**: `RediSearch/RediSearch` (Commit: `f01b5c68`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): RediSearch/RediSearch

> **Canonical Artifact**: `07_PROJECT_LEARNING/redisearch-redisearch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RediSearch/RediSearch](https://github.com/RediSearch/RediSearch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T12:07:24.569Z  
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
import { execa } from 'execa';
import { ENV } from './checks.ts';
import type { Vcs } from './ports.ts';

export async function git(cwd: string, args: string[], input = ''): Promise<string> {
  return (await execa('git', args, { cwd, env: ENV, input })).stdout;
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
import { hash, type NewFinding, type FindingSource } from './job.ts';
import type { Forge, Stage } from './ports.ts';
import { git } from './git.ts';

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

/** Amp configures git's credential helper in Orbs, so this needs nothing beyond git itself. */
async function githubToken(cwd: string): Promise<string> {
  const env = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (env) return env;
  const fill = await git(cwd, ['credential', 'fill'], 'protocol=https\nhost=github.com\n\n');
  const password = fill.match(/^password=(.*)$/m)?.[1];
  if (!password) throw new Error('git has no credentials for github.com');
  return password;
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
  const api = () => (client ??= githubToken(root).then((auth) => new Octokit({ auth })));
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
      for (let page = threads; page.pageInfo.hasNextPage; ) {
        page = (await query(page.pageInfo.endCursor)).repository.pullRequest.reviewThreads;
        threads.nodes.push(...page.nodes);
      }
      return readFeedback(ci, data, stage, number, posted, head);
    },

    /** An existing PR keeps its base: GitHub refuses to change it within a stack. */
    async publish(o) {
      const octokit = await api();
      const fetched = o.existing
        ? (await octokit.rest.pulls.get({ owner, repo, pull_number: o.existing.number })).data
        : undefined;
      // A merged or closed PR cannot carry a new candidate: a new one replaces it. A merged one
      // still takes a new description for the candidate it merged, such as the retrospective.
      const current =
        fetched?.state === 'open' || (fetched?.merged && o.existing!.head === o.candidat
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

### Incident Patch 1: `20c75192` (2026-11-19)
**Commit Message**: [MOD-15594] Fix crash on documents with more than 65536 fields (#12426)

* [MOD-15594] Fix crash on documents with more than 65536 fields

* [MOD-15594] Fix CI: sync FFI headers, skip slow cap test under Miri, flatten buildGroupRP

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `rwnqqozrprn` (added, +314/-0)
```diff
@@ -0,0 +1,314 @@
+
+                   SSUUMMMMAARRYY OOFF LLEESSSS CCOOMMMMAANNDDSS
+
+      Commands marked with * may be preceded by a number, _N.
+      Notes in parentheses indicate the behavior if _N is given.
+      A key preceded by a caret indicates the Ctrl key; thus ^K is ctrl-K.
+
+  h  H                 Display this help.
+  q  :q  Q  :Q  ZZ     Exit.
+ ---------------------------------------------------------------------------
+
+                           MMOOVVIINNGG
+
+  e  ^E  j  ^N  CR  *  Forward  one line   (or _N lines).
+  y  ^Y  k  ^K  ^P  *  Backward one line   (or _N lines).
+  f  ^F  ^V  SPACE  *  Forward  one window (or _N lines).
+  b  ^B  ESC-v      *  Backward one window (or _N lines).
+  z                 *  Forward  one window (and set window to _N).
+  w                 *  Backward one window (and set window to _N).
+  ESC-SPACE         *  Forward  one window, but don't stop at end-of-file.
+  d  ^D             *  Forward  one half-window (and set half-window to _N).
+  u  ^U             *  Backward one half-window (and set half-window to _N).
+  ESC-)  RightArrow *  Right one half screen width (or _N positions).
+  ESC-(  LeftArrow  *  Left  one half screen width (or _N positions).
+  ESC-}  ^RightArrow   Right to last column displayed.
+  ESC-{  ^LeftArrow    Left  to first column.
+  F                    Forward forever; like "tail -f".
+  ESC-F                Like F but stop when search pattern is found.
+  r  ^R  ^L            Repaint screen.
+  R                    Repaint screen, discarding buffered input.
+        ---------------------------------------------------
+        Default "window" is the screen height.
+        Default "half-window" is half of the screen height.
+ ---------------------------------------------------------------------------
+
+                          SSEEAARRCCHHIINNGG
+
+  /_p_a_t_t_e_r_n          *  Search forward for (_N-th) matching line.
+  ?_p_a_t_t_e_r_n          *  Search backward for (_N-th) matching line.
+  n                 *  Repeat previous search (for _N-th occurrence).
+  N                 *  Repeat previous search in reverse direction.
+  ESC-n             *  Repeat previous search, spanning files.
+  ESC-N             *  Repeat previous search, reverse dir. & spanning files.
+  ^O^N  ^On         *  Search forward for (_N-th) OSC8 hyperlink.
+  ^O^P  ^Op         *  Search backward for (_N-th) OSC8 hyperlink.
+  ^O^L  ^Ol            Jump to the currently selected OSC8 hyperlink.
+  ESC-u                Undo (toggle) search highlighting.
+  ESC-U                Clear search highlighting.
+  &_p_a_t_t_e_r_n          *  Display only matching lines.
+        ---------------------------------------------------
+        A search pattern may begin with one or more of:
+        ^N or !  Search for NON-matching lines.
+        ^E or *  Search multiple files (pass thru END OF FILE).
+        ^F or @  Start search at FIRST file (for /) or last file (for ?).
+        ^K       Highlight matches, but don't move (KEEP position).
+        ^R       Don't use REGULAR EXPRESSIONS.
+        ^S _n     Search for match in _n-th parenthesized subpattern.
+        ^W       WRAP search if no match found.
+        ^L       Enter next character literally into pattern.
+ ---------------------------------------------------------------------------
+
+                           JJUUMMPPIINNGG
+
+  g  <  ESC-<       *  Go to first line in file (or line _N).
+  G  >  ESC->       *  Go to last line in file (or line _N).
+  p  %              *  Go to beginning of file (or _N percent into file).
+  t                 *  Go to the (_N-th) next tag.
+  T                 *  Go to the (_N-th) previous tag.
+  {  (  [           *  Find close bracket } ) ].
+  }  )  ]           *  Find open bracket { ( [.
+  ESC-^F _<_c_1_> _<_c_2_>  *  Find close bracket _<_c_2_>.
+  ESC-^B _<_c_1_> _<_c_2_>  *  Find open bracket _<_c_1_>.
+        ---------------------------------------------------
+        Each "find close bracket" command goes forward to the close bracket 
+          matching the (_N-th) open bracket in the top line.
+        Each "find open bracket" command goes backward to the open bracket 
+          matching the (_N-th) close bracket in the bottom line.
+
+  m_<_l_e_t_t_e_r_>            Mark the current top line with <letter>.
+  M_<_l_e_t_t_e_r_>            Mark the current bottom line with <letter>.
+  '_<_l_e_t_t_e_r_>            Go to a previously marked position.
+  ''                   Go to the previous position.
+  ^X^X                 Same as '.
+  ESC-m_<_l_e_t_t_e_r_>        Clear a mark.
+        ---------------------------------------------------
+        A mark is any upper-case or lower-case letter.
+        Certain marks are predefined:
+             ^  means  beginning of the file
+             $ 
```

**File**: `src/pipeline/pipeline_construction.c` (modified, +3/-3)
```diff
@@ -72,14 +72,14 @@ static ResultProcessor *buildGroupRP(PLN_GroupStep *gstp, RLookup *srclookup,
       if (loadKeys) {
         // We failed to get the key for reading, so we know getting it for loading will succeed.
         srckeys[ii] = RLookup_GetKey_LoadEx(srclookup, fldname, fldname_len, fldname, RLOOKUP_F_NOFLAGS);
-        *loadKeys = array_ensure_append_1(*loadKeys, srckeys[ii]);
       }
       // We currently allow implicit loading only for known fields from the schema.
       // If we can't load keys, or the key we loaded is not in the schema, we fail.
-      if (!loadKeys || !(RLookupKey_GetFlags(srckeys[ii]) & RLOOKUP_F_SCHEMASRC)) {
+      if (!srckeys[ii] || !(RLookupKey_GetFlags(srckeys[ii]) & RLOOKUP_F_SCHEMASRC)) {
         QueryError_SetWithUserDataFmt(err, QUERY_ERROR_CODE_NO_PROP_KEY, "No such property", " `%s`", fldname);
         goto cleanup;
       }
+      *loadKeys = array_ensure_append_1(*loadKeys, srckeys[ii]);
     }
     dstkeys[ii] = RLookup_GetKey_WriteEx(&gstp->lookup, fldname, fldname_len, RLOOKUP_F_NOFLAGS);
     if (!dstkeys[ii]) {
@@ -294,7 +294,7 @@ static ResultProcessor *getArrangeRP(Pipeline *pipeline, const AggregationPipeli
           sortkey = RLookup_GetKey_Load(lk, keystr, keystr, RLOOKUP_F_NOFLAGS);
           // We currently allow implicit loading only for known fields from the schema.
           // If the key we loaded is not in the schema, we fail.
-          if (!(RLookupKey_GetFlags(sortkey) & RLOOKUP_F_SCHEMASRC)) {
+          if (!sortkey || !(RLookupKey_GetFlags(sortkey) & RLOOKUP_F_SCHEMASRC)) {
             QueryError_SetWithUserDataFmt(status, QUERY_ERROR_CODE_NO_PROP_KEY, "Property", " `%s` not loaded nor in schema", keystr);
             goto end;
           }
```

**File**: `src/redisearch_rs/headers/reducers_ffi.h` (modified, +2/-0)
```diff
@@ -13,6 +13,8 @@
  * An append-only list of [`RLookupKey`]s.
  *
  * This type maintains a list of [`RLookupKey`]s addressable by string name.
+ * It holds at most one key per row slot; once every slot is taken, creating a
+ * key yields `None`.
  *
  * # Sealing
  *
```

**File**: `src/redisearch_rs/headers/rlookup.h` (modified, +2/-0)
```diff
@@ -119,6 +119,8 @@ typedef uint32_t RLookup_Opt;
  * An append-only list of [`RLookupKey`]s.
  *
  * This type maintains a list of [`RLookupKey`]s addressable by string name.
+ * It holds at most one key per row slot; once every slot is taken, creating a
+ * key yields `None`.
  *
  * # Sealing
  *
```

**File**: `src/redisearch_rs/rlookup/src/load_document/hash.rs` (modified, +30/-8)
```diff
@@ -258,17 +258,18 @@ impl<'n> DocumentFormat for HashDocumentFormat<'n> {
                     // Key name is already taken by a query key.
                     return;
                 } else {
-                    c.into_current().unwrap()
+                    c.into_current()
                 }
             } else {
                 // First returned document, create the key.
-                rlookup
-                    .get_key_load(
-                        field_cstr.to_owned(),
-                        field_cstr,
-                        RLookupKeyFlag::ForceLoad.into(),
-                    )
-                    .unwrap()
+                rlookup.get_key_load(
+                    field_cstr.to_owned(),
+                    field_cstr,
+                    RLookupKeyFlag::ForceLoad.into(),
+                )
+            };
+            let Some(key) = key else {
+                return;
             };
 
             let coerce = if key.flags.contains(RLookupKeyFlag::Numeric) && !self.force_string {
@@ -391,6 +392,27 @@ mod tests {
         assert_eq!(expect_string(&v), b"\xff\xfe\x80hello");
     }
 
+    #[test]
+    #[cfg_attr(miri, ignore)] // can't call FFI function RedisModule_CreateString under miri
+    fn load_all_fills_the_last_row_slot_and_skips_the_rest() {
+        redis_mock::init_redis_module_mock();
+        let mut builder = redis_mock::TestContext::builder();
+        builder.with_key_type(&KeyType::Hash);
+        builder.inject_key_value(c"fits".to_owned(), c"1".to_owned());
+        builder.inject_key_value(c"overflows".to_owned(), c"2".to_owned());
+        let mut ctx = builder.build();
+        let format = HashDocumentFormat::new(NonNull::from_mut(&mut ctx).cast(), false);
+        let mut rlookup = RLookup::new();
+        rlookup.fill_all_but_last_row_slot();
+        let mut row = RLookupRow::new();
+
+        format
+            .load_all(&mut rlookup, &mut row, &make_string(&c"doc:1".to_owned()))
+            .unwrap();
+
+        assert_eq!(row.num_dyn_values(), 1);
+    }
+
     #[test]
     #[cfg_attr(miri, ignore)] // can't call FFI function RedisModule_CreateString under miri
     fn invalid_fallback_to_zero() {
```

**File**: `src/redisearch_rs/rlookup/src/load_document/json.rs` (modified, +5/-5)
```diff
@@ -171,17 +171,17 @@ impl DocumentFormat for JsonDocumentFormat<'_> {
         let value = self.load_root(key_name)?;
 
         let rlk = if let Some(rlk) = rlookup.find_key_by_name(JSON_ROOT) {
-            rlk.into_current().unwrap()
+            rlk.into_current()
         } else {
             // A SORTABLE schema field on `$` makes the key value-available from
             // the sorting vector, in which case `get_key_load` returns `None`
             // unless forced.
-            rlookup
-                .get_key_load(JSON_ROOT, JSON_ROOT, RLookupKeyFlag::ForceLoad.into())
-                .unwrap()
+            rlookup.get_key_load(JSON_ROOT, JSON_ROOT, RLookupKeyFlag::ForceLoad.into())
         };
 
-        dst_row.write_key(rlk, value);
+        if let Some(rlk) = rlk {
+            dst_row.write_key(rlk, value);
+        }
 
         Ok(())
     }
```

**File**: `src/redisearch_rs/rlookup/src/lookup.rs` (modified, +15/-9)
```diff
@@ -57,6 +57,8 @@ pub type RLookupOptions = BitFlags<RLookupOption>;
 /// An append-only list of [`RLookupKey`]s.
 ///
 /// This type maintains a list of [`RLookupKey`]s addressable by string name.
+/// It holds at most one key per row slot; once every slot is taken, creating a
+/// key yields `None`.
 ///
 /// # Sealing
 ///
@@ -205,7 +207,7 @@ impl<'a> RLookup<'a> {
     }
 
     /// Resolve a writable key by name, lazily indexing wide lookups before the search.
-    pub(crate) fn get_or_create_key_by_name(&mut self, name: &[u8]) -> &RLookupKey<'a> {
+    pub(crate) fn get_or_create_key_by_name(&mut self, name: &[u8]) -> Option<&RLookupKey<'a>> {
         let slot = if let Some(slot) = self.keys.find_slot_for_write(name) {
             slot
         } else {
@@ -214,10 +216,9 @@ impl<'a> RLookup<'a> {
             self.get_key_write_slot(
                 CString::new(name).expect("field names cannot contain NUL"),
                 RLookupKeyFlags::empty(),
-            )
-            .expect("a missing key must be writable")
+            )?
         };
-        self.keys.get(slot).unwrap()
+        self.keys.get(slot)
     }
 
     /// Add all non-overridden keys from `src` to `self`.
@@ -337,7 +338,7 @@ impl<'a> RLookup<'a> {
         // the schema as SORTABLE, and create only if so.
         let name = match self.gen_key_from_spec(name, flags) {
             Ok(key) => {
-                return Some(self.keys.push_slot(key));
+                return self.keys.push(key);
             }
             Err(name) => name,
         };
@@ -349,7 +350,7 @@ impl<'a> RLookup<'a> {
             let special = self.hidden_if_schema_special(key.name().as_ref());
             key.flags |= special;
 
-            return Some(self.keys.push_slot(key));
+            return self.keys.push(key);
         }
 
         None
@@ -450,7 +451,7 @@ impl<'a> RLookup<'a> {
             // B. we didn't find the key in the lookup table:
             // create a new key with the name and flags.
             self.keys
-                .push_slot(RLookupKey::new(name, flags | RLookupKeyFlag::QuerySrc))
+                .push(RLookupKey::new(name, flags | RLookupKeyFlag::QuerySrc))?
         };
 
         Some(key)
@@ -548,10 +549,10 @@ impl<'a> RLookup<'a> {
                 .unwrap();
             slot
         } else {
-            self.keys.push_slot(RLookupKey::new(
+            self.keys.push(RLookupKey::new(
                 name.clone(),
                 flags | RLookupKeyFlag::DocSrc | RLookupKeyFlag::IsLoaded,
-            ))
+            ))?
         };
 
         let key = self.keys.cursor_at_mut(slot).into_current().unwrap();
@@ -591,6 +592,11 @@ impl<'a> RLookup<'a> {
         Some(slot)
     }
 
+    #[cfg(test)]
+    pub(crate) fn fill_all_but_last_row_slot(&mut self) {
+        self.keys.fill_all_but_last_row_slot();
+    }
+
     /// The row len of the [`RLookup`] is the number of keys in its key list not counting the overridden keys.
     pub fn get_row_len(&self) -> u32 {
         self.keys.row_len()
```

**File**: `src/redisearch_rs/rlookup/src/lookup/key_list.rs` (modified, +36/-15)
```diff
@@ -213,9 +213,13 @@ impl<'a> KeyList<'a> {
         store.find_slot(name)
     }
 
-    pub(crate) fn push_slot(&mut self, mut key: RLookupKey<'a>) -> u16 {
+    /// Insert a key at the next logical row slot and return that slot.
+    ///
+    /// Returns `None`, leaving the list unchanged, once every slot a
+    /// [`dstidx`](super::key::RLookupKeyHeader::dstidx) can address is taken.
+    pub(crate) fn push(&mut self, mut key: RLookupKey<'a>) -> Option<u16> {
+        let slot = u16::try_from(self.live().len()).ok()?;
         let store = self.store.get_or_insert_with(|| Box::new(KeyStore::new()));
-        let slot = u16::try_from(store.live.len()).expect("RLookup key count exceeds u16::MAX");
         key.dstidx = slot;
         store.live.push(OwnedKey::new(key));
         if store.by_name.is_some() {
@@ -225,20 +229,18 @@ impl<'a> KeyList<'a> {
         #[cfg(debug_assertions)]
         self.assert_valid("KeyList::push");
 
-        slot
+        Some(slot)
     }
 
-    /// Insert a key at the next logical row slot.
-    pub(crate) fn push(&mut self, key: RLookupKey<'a>) -> Pin<&mut RLookupKey<'a>> {
-        let slot = self.push_slot(key);
-
-        self.store
-            .as_mut()
-            .unwrap()
-            .live
-            .get_mut(usize::from(slot))
-            .unwrap()
-            .get_pin_mut()
+    #[cfg(test)]
+    pub(crate) fn fill_all_but_last_row_slot(&mut self) {
+        let store = self.store.get_or_insert_with(|| Box::new(KeyStore::new()));
+        let first = u16::try_from(store.live.len()).unwrap();
+        store.live.extend((first..u16::MAX).map(|slot| {
+            let mut key = RLookupKey::new(c"filler", RLookupKeyFlags::empty());
+            key.dstidx = slot;
+            OwnedKey::new(key)
+        }));
     }
 
     pub fn cursor_front(&self) -> Cursor<'_, 'a> {
@@ -477,6 +479,23 @@ mod tests {
         assert_eq!(keys.row_len(), 3);
     }
 
+    #[test]
+    #[cfg_attr(miri, ignore = "fills every row slot, too slow under Miri")]
+    fn push_is_refused_once_every_dstidx_is_taken() {
+        let mut keys = KeyList::new();
+        keys.fill_all_but_last_row_slot();
+
+        assert_eq!(
+            keys.push(RLookupKey::new(c"last", RLookupKeyFlags::empty())),
+            Some(u16::MAX)
+        );
+        assert_eq!(
+            keys.push(RLookupKey::new(c"overflow", RLookupKeyFlags::empty())),
+            None
+        );
+        assert_eq!(keys.row_len(), u32::from(u16::MAX) + 1);
+    }
+
     #[test]
     fn duplicate_names_resolve_to_first_slot() {
         let mut keys = KeyList::new();
@@ -657,7 +676,9 @@ mod tests {
         assert_eq!(keys.find_slot(c"pre"), Some(0));
 
         // ...nor of a name first seen after promotion.
-        let post_slot = keys.push_slot(RLookupKey::new(c"post", RLookupKeyFlags::empty()));
+        let post_slot = keys
+            .push(RLookupKey::new(c"post", RLookupKeyFlags::empty()))
+            .unwrap();
         keys.push(RLookupKey::new(c"post", RLookupKeyFlags::empty()));
         assert_eq!(keys.find_slot(c"post"), Some(post_slot));
 
```

---

### Incident Patch 2: `cdd910a2` (2026-11-19)
**Commit Message**: [MOD-14129] Always require TAG dictionaries when restoring Flex indexes from SST (#12442)

* [MOD-14129] Require dictionaries when restoring disk TAG indexes from SST

* Remove redundant TAG restore flag from disk open callback

* Remove the per-index TAG dictionary marker from v30 SST RDBs

**File**: `src/query.c` (modified, +5/-13)
```diff
@@ -796,9 +796,7 @@ static inline bool QueryNode_ValidateToken(QueryNode *n, IndexSpec *spec, RSSear
   return true;
 }
 
-// TAG clauses that expand terms need a complete dictionary before they can be enabled on Flex.
-static int validateDiskTagMultiTermQuery(QueryNodeType queryType, const IndexSpec *spec,
-                                         QueryError *status) {
+static int validateDiskTagMultiTermQuery(QueryNodeType queryType, QueryError *status) {
   if (!SearchDisk_IsEnabledForValidation()) {
     return REDISMODULE_OK;
   }
@@ -816,15 +814,9 @@ static int validateDiskTagMultiTermQuery(QueryNodeType queryType, const IndexSpe
     default:
       return REDISMODULE_OK;
   }
-  if (spec->tagDictionariesAvailable) {
-    // until MOD-20990 will enable multi term tag queries
-    QueryError_SetWithoutUserDataFmt(status, QUERY_ERROR_CODE_FLEX_UNSUPPORTED_QUERY,
-                                     "%s queries are not supported on Flex indexes", queryTypeName);
-  } else {
-    QueryError_SetError(status, QUERY_ERROR_CODE_FLEX_UNSUPPORTED_QUERY,
-                        "TAG dictionary is unavailable after loading a legacy SST index; "
-                        "drop and recreate the index to use TAG multi-term queries");
-  }
+  // TODO(MOD-20990): Enable multi-term TAG queries on Flex indexes.
+  QueryError_SetWithoutUserDataFmt(status, QUERY_ERROR_CODE_FLEX_UNSUPPORTED_QUERY,
+                                   "%s queries are not supported on Flex indexes", queryTypeName);
   return REDISMODULE_ERR;
 }
 
@@ -870,7 +862,7 @@ static int QueryNode_CheckIsValid(QueryNode *n, IndexSpec *spec, RSSearchOptions
         }
         for (size_t ii = 0; ii < QueryNode_NumChildren(n); ++ii) {
           QueryNode *child = n->children[ii];
-          if (validateDiskTagMultiTermQuery(child->type, spec, status) != REDISMODULE_OK) {
+          if (validateDiskTagMultiTermQuery(child->type, status) != REDISMODULE_OK) {
             return REDISMODULE_ERR;
           }
         }
```

**File**: `src/search_disk.c` (modified, +1/-2)
```diff
@@ -445,8 +445,7 @@ RedisSearchDiskIndexSpec *SearchDisk_OpenIndexWithRdbState(
   SearchDiskCompactionCallbacks callbacks = SearchDisk_CompactionCallbacks();
   RedisSearchDiskIndexSpec *result = disk->basic.openIndexSpecWithRdbState(
       ctx, disk_db, indexName, obfuscatedName, strlen(obfuscatedName), type, rdbState,
-      c_index_spec->tagDictionariesAvailable, c_index_spec->flags, fields, c_index_spec->numFields,
-      &callbacks, c_index_spec);
+      c_index_spec->flags, fields, c_index_spec->numFields, &callbacks, c_index_spec);
   rm_free(fields);
   SearchDisk_CompleteLogicalOpen(result, c_index_spec);
   SearchDisk_CheckOpenResult(ctx, result);
```

**File**: `src/search_disk_api.h` (modified, +3/-4)
```diff
@@ -338,14 +338,14 @@ typedef struct BasicDiskAPI {
    * Consumes `rdbState` unconditionally — the state is freed by this call
    * regardless of whether IndexSpec creation succeeds or fails. The caller
    * MUST null its pointer after this call, on both paths.
+   * The caller has restored the dictionaries for all disk TAG fields.
    *
    * @param disk Pointer to the disk context
    * @param indexName Name of the index
    * @param obfuscatedName Obfuscated name of the index (for logging)
    * @param obfuscatedNameLen Length of the obfuscated name
    * @param type Document type for this index
    * @param rdbState Temporary RDB state from loadRdbToTempObject (will be consumed)
-   * @param tagCountsRestored Complete C-owned TAG dictionaries are ready for compaction updates.
    * @param flags The index's `IndexSpec::flags`, as for openIndexSpec.
    * @param fields Borrowed schema declarations, used to open CFs with their final options.
    * @param numFields Number of declarations in fields.
@@ -358,9 +358,8 @@ typedef struct BasicDiskAPI {
   RedisSearchDiskIndexSpec *(*openIndexSpecWithRdbState)(
       RedisModuleCtx *ctx, RedisSearchDisk *disk, const HiddenString *indexName,
       const char *obfuscatedName, size_t obfuscatedNameLen, DocumentType type,
-      RedisSearchDiskRdbState *rdbState, bool tagCountsRestored, IndexFlags flags,
-      const SearchDiskField *fields, size_t numFields,
-      const SearchDiskCompactionCallbacks *callbacks, void *private_data);
+      RedisSearchDiskRdbState *rdbState, IndexFlags flags, const SearchDiskField *fields,
+      size_t numFields, const SearchDiskCompactionCallbacks *callbacks, void *private_data);
 
   /**
    * @brief Free a temporary RDB state object.
```

**File**: `src/spec.c` (modified, +7/-17)
```diff
@@ -2573,7 +2573,6 @@ static void initializeIndexSpec(IndexSpec *sp, const HiddenString *name, IndexFl
   sp->diskSpec = NULL;
   sp->pendingDiskRdbState = NULL;
   sp->diskRegistered = false;
-  sp->tagDictionariesAvailable = true;
   sp->resume_bg_indexing = false;
   sp->monitorDocumentExpiration = RSGlobalConfig.monitorExpiration;
   sp->monitorFieldExpiration = RSGlobalConfig.monitorExpiration &&
@@ -3333,7 +3332,6 @@ void IndexSpec_RdbSave(RedisModuleIO *rdb, IndexSpec *sp, int contextFlags) {
   // In a forked child the memory is a snapshot and no lock is needed.
   const bool storeDiskRdbData = contextFlags & REDISMODULE_CTX_FLAGS_SST_RDB;
   const bool saveDiskSpec = sp->diskSpec && storeDiskRdbData;
-  const bool saveTagDictionaries = saveDiskSpec && sp->tagDictionariesAvailable;
   const bool inMainProcess = !(contextFlags & REDISMODULE_CTX_FLAGS_IS_CHILD);
   const bool needLock = saveDiskSpec && inMainProcess;
   RedisModuleCtx *ctx = RedisModule_GetContextFromIO(rdb);
@@ -3346,12 +3344,8 @@ void IndexSpec_RdbSave(RedisModuleIO *rdb, IndexSpec *sp, int contextFlags) {
   HiddenString_SaveToRdb(sp->specName, rdb);
   RedisModule_SaveUnsigned(rdb, (uint64_t)sp->flags);
   RedisModule_SaveUnsigned(rdb, sp->numFields);
-  if (saveDiskSpec) {
-    // One availability flag governs all TAG dictionary payloads in the field records.
-    RedisModule_SaveUnsigned(rdb, saveTagDictionaries);
-  }
   for (int i = 0; i < sp->numFields; i++) {
-    FieldSpec_RdbSave(rdb, &sp->fields[i], contextFlags, saveTagDictionaries, needLock);
+    FieldSpec_RdbSave(rdb, &sp->fields[i], contextFlags, saveDiskSpec, needLock);
   }
 
   SchemaRule_RdbSave(sp->rule, rdb);
@@ -3474,22 +3468,19 @@ IndexSpec *IndexSpec_RdbLoad(RedisModuleIO *rdb, int encver, bool useSst, QueryE
   IndexSpec_MakeKeyless(sp);
   RedisModule_Log(RSDummyContext, "notice", useSst ? "Loading RDB for IndexSpec with SST flag": "Loading RDB for IndexSpec without SST flag");
   loadDiskSpec = isSpecOnDisk(sp) && useSst;
-  if (loadDiskSpec) {
-    uint64_t available = 0;
-    if (encver >= INDEX_SST_TAG_VALUES_VERSION) {
-      available = LoadUnsigned_IOError(rdb, goto cleanup);
-      if (available > 1) goto cleanup;
-    }
-    sp->tagDictionariesAvailable = available != 0;
-  }
-  loadTagDictionaries = loadDiskSpec && sp->tagDictionariesAvailable;
+  loadTagDictionaries = loadDiskSpec && encver >= INDEX_SST_TAG_VALUES_VERSION;
   for (int i = 0; i < sp->numFields; i++) {
     FieldSpec *fs = sp->fields + i;
     if (FieldSpec_RdbLoad(rdb, fs, spec_ref, encver, useSst, loadTagDictionaries) !=
         REDISMODULE_OK) {
       QueryError_SetWithUserDataFmt(status, QUERY_ERROR_CODE_PARSE_ARGS, "Failed to load index field", " %d", i);
       goto cleanup;
     }
+    if (loadDiskSpec && FIELD_IS(fs, INDEXFLD_T_TAG) && !loadTagDictionaries) {
+      QueryError_SetError(status, QUERY_ERROR_CODE_PARSE_ARGS,
+                          "SST RDB is missing the TAG dictionary for a disk index");
+      goto cleanup;
+    }
     if (fs->ftId != RS_INVALID_FIELD_ID) {
       // Prefer not to rely on the ordering of fields in the RDB file
       *array_ensure_at(&sp->fieldIdToIndex, fs->ftId, t_fieldIndex) = fs->index;
@@ -3685,7 +3676,6 @@ void *IndexSpec_LegacyRdbLoad(RedisModuleIO *rdb, int encver) {
   sp->numSortableFields = 0;
   sp->terms = NULL;
   sp->docs = DocTable_New(INITIAL_DOC_TABLE_SIZE);
-  sp->tagDictionariesAvailable = true;
   // IndexSpec_Free clears it, so it must be valid before the first failed read below.
   sp->stats.indexError = IndexError_Init();
 
```

**File**: `src/spec.h` (modified, +0/-2)
```diff
@@ -387,8 +387,6 @@ typedef struct IndexSpec {
   // replication ending. Vector index state is stored inline in each field.
   RedisSearchDiskRdbState *pendingDiskRdbState;
   bool diskRegistered;
-  // Complete TAG dictionaries are available
-  bool tagDictionariesAvailable;
 
   // True when the SST+RDB stream indicated the source node was still
   // background-indexing (scan in progress, or a previous scan failed on OOM)
```

**File**: `tests/cpptests/test_cpp_disk_open_fields.cpp` (modified, +46/-58)
```diff
@@ -71,7 +71,6 @@ class DiskSchemaOpenTest : public ::testing::Test {
   static inline int closeIndexSpecCalls = 0;
   static inline int rdbStateToken = 0;
   static inline SearchDiskCompactionCallbacks compactionCallbacks{};
-  static inline bool restoredTagCounts = false;
 
   static bool recordSchema(RedisModuleCtx *ctx, void *privateData, IndexFlags flags,
                            const SearchDiskField *fields, size_t n) {
@@ -140,10 +139,9 @@ class DiskSchemaOpenTest : public ::testing::Test {
     };
     api.basic.openIndexSpecWithRdbState =
         [](RedisModuleCtx *ctx, RedisSearchDisk *, const HiddenString *, const char *, size_t,
-           DocumentType, RedisSearchDiskRdbState *state, bool tagCountsRestored, IndexFlags flags,
+           DocumentType, RedisSearchDiskRdbState *state, IndexFlags flags,
            const SearchDiskField *fields, size_t n, const SearchDiskCompactionCallbacks *,
            void *privateData) {
-          restoredTagCounts = tagCountsRestored;
           EXPECT_EQ(state, reinterpret_cast<RedisSearchDiskRdbState *>(&rdbStateToken));
           events.emplace_back("openIndexWithRdbState");
           return recordSchema(ctx, privateData, flags, fields, n)
@@ -627,29 +625,27 @@ class DiskTagPersistenceTest : public DiskSchemaOpenTest {
     io = RMCK_CreateRdbIO();
   }
 
-  IndexSpec *saveSource(bool tagDictionariesAvailable = true) {
+  IndexSpec *saveSource(int contextFlags = REDISMODULE_CTX_FLAGS_SST_RDB) {
     QueryError err = QueryError_Default();
     IndexSpec *sp = create("tag_sst_counts", {"first", "TAG", "second", "TAG"}, &err);
     EXPECT_NE(sp, nullptr) << QueryError_GetUserError(&err);
     if (!sp) return nullptr;
     const char *tags[] = {"hello", "world", ""};
     TagIndex_Commit(TagIndex_Open(&sp->fields[0]), tags, 3, &sp->stats);
     TagIndex_Commit(TagIndex_Open(&sp->fields[0]), tags, 1, &sp->stats);
-    sp->tagDictionariesAvailable = tagDictionariesAvailable;
-    IndexSpec_RdbSave(io, sp, REDISMODULE_CTX_FLAGS_SST_RDB);
+    IndexSpec_RdbSave(io, sp, contextFlags);
     return sp;
   }
 
   void skipRdbString() {
     RedisModule_Free(RMCK_LoadStringBuffer(io, nullptr));
   }
 
-  size_t tagDictionaryFlagOffset() {
+  void skipIndexHeader() {
     io->read_pos = 0;
     skipRdbString();        // Index name
     RMCK_LoadUnsigned(io);  // Index flags
     RMCK_LoadUnsigned(io);  // Number of fields
-    return io->read_pos;
   }
 
   // Advance over the schema for one TAG field in this fixture.
@@ -678,6 +674,15 @@ class DiskTagPersistenceTest : public DiskSchemaOpenTest {
     EXPECT_EQ(io->read_pos, io->buffer.size());
   }
 
+  void expectLoadError(int version, const char *message) {
+    QueryError err = QueryError_Default();
+    loaded = IndexSpec_RdbLoad(io, version, true, &err);
+    EXPECT_EQ(loaded, nullptr);
+    EXPECT_EQ(QueryError_GetCode(&err), QUERY_ERROR_CODE_PARSE_ARGS);
+    EXPECT_NE(std::string(QueryError_GetUserError(&err)).find(message), std::string::npos);
+    QueryError_ClearError(&err);
+  }
+
   void TearDown() override {
     if (loaded) {
       if (loaded->diskSpec) SearchDisk_CloseIndexOnMainThread(RSDummyContext, loaded);
@@ -693,7 +698,6 @@ TEST_F(DiskTagPersistenceTest, CountsSurviveLoadingAndStorageBinding) {
   discardSource();
   load(INDEX_CURRENT_VERSION);
   ASSERT_NE(loaded, nullptr);
-  EXPECT_TRUE(loaded->tagDictionariesAvailable);
   auto *idx = TagIndex_Open(&loaded->fields[0]);
   ASSERT_NE(idx, nullptr);
   EXPECT_TRUE(idx->valuesAreCounts);
@@ -703,7 +707,6 @@ TEST_F(DiskTagPersistenceTest, CountsSurviveLoadingAndStorageBinding) {
   EXPECT_EQ(reinterpret_cast<uintptr_t>(TrieMap_Find(idx->values, "", 0)), 1u);
   EXPECT_EQ(TagIndex_NUniqueValues(TagIndex_Open(&loaded->fields[1])), 0u);
   ASSERT_TRUE(IndexSpec_SSTRdbOpenAndApply(RSDummyContext, loaded));
-  EXPECT_TRUE(restoredTagCounts);
   EXPECT_EQ(TagIndex_Open(&loaded->fields[0]), idx);
   EXPECT_EQ(idx->diskSpec, loaded->diskSpec);
 }
@@ -716,73 +719,58 @@ TEST_F(DiskTagPersistenceTest, UnboundCountDictionariesCanBeDiscarded) {
   EXPECT_EQ(loaded->diskSpec, nullptr);
 }
 
-TEST_F(DiskTagPersistenceTest, LegacyPayloadRemainsUnavailableAfterAnotherSave) {
-  ASSERT_NE(saveSource(false), nullptr);
-  const size_t offset = tagDictionaryFlagOffset();
-  ASSERT_LE(offset + sizeof(uint64_t), io->buffer.size());
-  io->buffer.erase(io->buffer.begin() + offset, io->buffer.begin() + offset + sizeof(uint64_t));
+TEST_F(DiskTagPersistenceTest, RestoredTagQueriesRequireExactValues) {
+  ASSERT_NE(saveSource(), nullptr);
   discardSource();
-  load(INDEX_SST_TAG_VALUES_VERSION - 1);
-  ASSERT_NE(loaded, nullptr);
-  EXPECT_FALSE(loaded->tagDictionariesAvailable);
-  ASSERT_TRUE(IndexSpec_SSTRdbOpenAndApply(RSDummyContext, loaded));
-  EXPECT_FALSE(restoredTagCounts);
-  {
-    Restore unstable{RSGlobalConfig.enableUnstableFeatures};
-    RSGlobalConfig.enableUnstableFeatures = true;
-    RedisSearchCtx sctx = SEARCH_CTX_STATIC(RSDummyContext, lo
```

**File**: `tests/cpptests/test_cpp_sst_finish_replication.cpp` (modified, +3/-3)
```diff
@@ -61,8 +61,8 @@ class SSTFinishReplicationTestBase : public ::testing::Test {
     api.basic.updateMemoryLimit = [](RedisSearchDisk *, size_t, size_t) { return true; };
     api.basic.openIndexSpecWithRdbState =
         [](RedisModuleCtx *, RedisSearchDisk *, const HiddenString *, const char *, size_t,
-           DocumentType, RedisSearchDiskRdbState *, bool, IndexFlags, const SearchDiskField *,
-           size_t, const SearchDiskCompactionCallbacks *, void *privateData) {
+           DocumentType, RedisSearchDiskRdbState *, IndexFlags, const SearchDiskField *, size_t,
+           const SearchDiskCompactionCallbacks *, void *privateData) {
           ++opens[privateData];
           return reinterpret_cast<RedisSearchDiskIndexSpec *>(privateData);
         };
@@ -106,7 +106,7 @@ TEST_F(SSTFinishReplicationTestBase, FailedOpenAbortsCompletion) {
   stageSpec("sst_finish_open_failure");
   api.basic.openIndexSpecWithRdbState =
       [](RedisModuleCtx *, RedisSearchDisk *, const HiddenString *, const char *, size_t,
-         DocumentType, RedisSearchDiskRdbState *, bool, IndexFlags, const SearchDiskField *, size_t,
+         DocumentType, RedisSearchDiskRdbState *, IndexFlags, const SearchDiskField *, size_t,
          const SearchDiskCompactionCallbacks *,
          void *) { return static_cast<RedisSearchDiskIndexSpec *>(nullptr); };
   Restore<decltype(RedisModule_GetContextFlags)> flags{RedisModule_GetContextFlags};
```

---

### Incident Patch 3: `80a68c76` (2026-11-19)
**Commit Message**: [MOD-20897] Name RHEL 10 build artifacts rhel10 (#12322)

get-platform mapped rocky8/rocky9 to rhel8/rhel9 but had no rocky10 entry,
so Rocky Linux 10 builds were published as Linux-rocky10-*. Redis Enterprise
consumes the rhel10 name, as it does rhel9 today.

RHEL images (ID=rhel, e.g. UBI or rs-devcontainer) report a minor
VERSION_ID, which leaked into the name (rhel10.0, rhel9.9). Strip it, as
RediSearchEnterprise's get-platform already does for rhel8/rhel9.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `sbin/get-platform` (modified, +6/-0)
```diff
@@ -137,8 +137,14 @@ def map_version_artifact(osnick):
         "ol8": "rhel8",
         "rocky8": "rhel8",
         "rocky9": "rhel9",
+        "rocky10": "rhel10",
     }
 
+    # RHEL images report ID=rhel with a minor VERSION_ID (e.g. rhel10.0); keep the
+    # artifact name stable across minor updates.
+    if osnick.startswith("rhel") and "." in osnick:
+        return osnick.split(".", 1)[0]
+
     # Special mapping: any alpine3.x → alpine3
     if osnick.startswith("alpine3") or osnick.startswith("NotpineForGHA3"):
         return "alpine3"
```

#### Recent Merged Pull Requests:
- **PR #12449** (closed): [MOD-14129] Temporarily revert disk TAG dictionary persistence (@nonirosenfeldredis)
- **PR #12448** (2026-11-20): Bump version from 8.12.1 to 8.12.2 (@oshadmi)
- **PR #12444** (2026-11-19): CI: pin cargo-deny to 0.21.0 in the lint job (@oshadmi)
- **PR #12442** (2026-11-19): [MOD-14129] Always require TAG dictionaries when restoring Flex indexes from SST (@nonirosenfeldredis)
- **PR #12438** (2026-11-19): [MOD-21414] Test restoring an aliased index that is already registered (@kei-nan)
- **PR #12433** (2026-11-19): [8.12] [MOD-21404] CI: install LLVM 21 from EL8 AppStream and EL9 EPEL to keep LTO on Rocky/Alma (@oshadmi)

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

## X. [MOD-15594] Fix crash on documents with more than 65536 fields

**RULE**:
When implementing operations in `rwnqqozrprn`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RediSearch/RediSearch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `20c75192`: [MOD-15594] Fix crash on documents with more than 65536 fields. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `rwnqqozrprn`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:

                   SSUUMMMMAARRYY OOFF LLEESSSS CCOOMMMMAANNDDSS

      Commands marked with * may be preceded by a number, _N.
      Notes in parentheses indicate the behavior if _N is given.
      A key preceded by a caret indicates the Ctrl key; thus ^K is ctrl-K.

  h  H                 Display this help.
  q  :q  Q  :Q  ZZ     Exit.
 ---------------------------------------------------------------------------

                           MMOOVVIINNGG

  e  ^E  j  ^N  CR  *  Forward  one line   (or _N lines).
  y  ^Y  k  ^K  ^P  *  Backward one line   (or _N lines).
  f  ^F  ^V  SPACE  *  Forward  one window (or _N lines).
  b  ^B  ESC-v      *  Backward one window (or _N lines).
  z                 *  Forward  one window (and set window to _N).
  w                 *  Backward one window (and set window to _N).
  ESC-SPACE         *  Forward  one window, but don't stop at end-of-file.
  d  ^D             *  Forward  one half-window (and set half-window to _N).
  u  ^U             *  Backward one half-window (and set half-window to _N).
  ESC-)  RightArrow *  Right one half screen width (or _N positions).
  ESC-(  LeftArrow  *  Left  one half
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `20c75192` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
