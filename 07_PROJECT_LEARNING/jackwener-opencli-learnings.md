# Forensic Learning Record (Deep Inspection): jackwener/OpenCLI

> **Canonical Artifact**: `07_PROJECT_LEARNING/jackwener-opencli-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jackwener/OpenCLI](https://github.com/jackwener/OpenCLI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:23:49.630Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jackwener/OpenCLI`
- **Description**: Make Any Website into CLI & Use your logged-in browser by AI agent. 
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 29723 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `autoresearch/commands/debug.ts`
```
#!/usr/bin/env npx tsx
/**
 * /autoresearch:debug — Hypothesis-driven debugging for specific failing tasks.
 *
 * Scientific method: Gather → Hypothesize → Test → Classify → Log → Repeat
 *
 * Usage:
 *   npx tsx autoresearch/commands/debug.ts --task extract-npm-description
 *   npx tsx autoresearch/commands/debug.ts --task bench-imdb-matrix --iterations 5
 */

import { execSync } from 'node:child_process';
import { readFileSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const TASKS_FILE = join(__dirname, '..', 'browse-tasks.json');
const DEBUG_LOG = join(ROOT, 'debug-results.tsv');

interface BrowseTask {
  name: string;
  steps: string[];
  judge: { type: string; value?: string; minLength?: number; pattern?: string };
}

function exec(cmd: string): string {
  try {
    return execSync(cmd, {
      cwd: ROOT, timeout: 30_000, encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err: any) {
    return err.stdout?.trim() ?? err.message ?? '';
  }
}

function initLog(): void {
  if (!existsSync(DEBUG_LOG)) {
    writeFileSync(DEBUG_LOG, '# AutoResearch Debug Log\niteration\ttask\thypothesis\tresult\tverdict\tdescription\n', 'utf-8');
  }
}

function appendLog(iteration: number, task: string, hypothesis: string, result: string, verdict: string, description: string): void {
  appendFileSync(DEBUG_LOG, `${iteration}\t${task}\t${hypothesis}\t${result}\t${verdict}\t${description}\n`, 'utf-8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const taskName = args.task;
  const maxIterations = args.iterations ?? 10;

  if (!taskName) {
    console.error('Usage: npx tsx autoresearch/commands/debug.ts --task <task-name> [--iterations N]');
    console.error('\nAvailable tasks:');
    const tasks: BrowseTask[] = JSON.parse(readFileSync(TASKS_FILE, 'utf-8'));
    // Show only failing tasks
    for (const task of tasks) {
      try { exec('opencli browser close'); } catch {}
      let lastOutput = '';
      for (const step of task.steps) lastOutput = exec(step);
      const passed = lastOutput.trim().length > 0; // simplified check
      if (!passed) console.error(`  ✗ ${task.name}`);
    }
    process.exit(1);
  }

  const tasks: BrowseTask[] = JSON.parse(readFileSync(TASKS_FILE, 'utf-8'));
  const task = tasks.find(t => t.name === taskName);
  if (!task) {
    console.error(`Task not found: ${taskName}`);
    process.exit(1);
  }

  console.log(`\n🔍 AutoResearch Debug: ${taskName}`);
  console.log(`   Steps: ${task.steps.length}`);
  console.log(`   Judge: ${task.judge.type}${task.judge.value ? ` "${task.judge.value}"` : ''}`);
  console.log(`   Max iterations: ${maxIterations}\n`);

  initLog();

  // Phase 1: Gather — run the task and capture output
  console.log('Phase 1: Gathering symptoms...');
  try { exec('opencli browser close'); } catch {}

  let lastOutput = '';
  for (let i = 0; i < task.steps.length; i++) {
    const step = task.steps[i];
    console.log(`  Step ${i + 1}: ${step.slice(0, 80)}`);
    lastOutput = exec(step);
    if (i < task.steps.length - 1) {
      console.log(`    → ${lastOutput.slice(0, 100)}`);
    }
  }
  console.log(`\n  Final output: ${lastOutput.slice(0, 200)}`);
  console.log(`  Judge expects: ${JSON.stringify(task.judge)}`);

  // Phase 2: Hypothesize + investigate via Claude Code
  for (let iter = 1; iter <= maxIterations; iter++) {
    console.log(`\n━━━ Debug Iteration ${iter}/${maxIterations} ━━━`);

    const prompt = `You are debugging a failing browser automation task.

## Task: ${taskName}
Steps:
${task.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}

## Judge criteria
${JSON.stringify(task.judge)}

## Last output
${lastOutput.slice(0, 500)}

## Instructions
1. Form a SPECIFIC, FALSIFIABLE hypothesis about why this task fails
2. Run the MINIMUM experiment to test your hypothesis (e.g. run one step, check output)
3. Classify: CONFIRMED (bug found), DISPROVEN (try different hypothesis), INCONCLUSIVE
4. If CONFIRMED: describe the root cause and suggest a fix
5. Output format: one line "HYPOTHESIS: ...", one line "RESULT: CONFIRMED|DISPROVEN|INCONCLUSIVE — ..."

Do NOT fix the code — just diagnose. Use opencli browser commands to investigate.`;

    try {
      const result = execSync(
        `claude -p --dangerously-skip-permissions --allowedTools "Bash(opencli:*),Bash(npm:*),Read,Grep,Glob" --output-format text --no-session-persistence "${prompt.replace(/"/g, '\\"')}"`,
        { cwd: ROOT, timeout: 120_000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();

      // Extract hypothesis and result
      const hypMatch = result.match(/HYPOTHESIS:\s*(.+)/i);
      const resMatch = result.match(/RESULT:\s*(CONFIRMED|DISPROVEN|INCONCLUSIVE)\s*[-—]\s*(.+)/i);

      const hypothesis = hypMatch?.[1]?.trim() ?? 'unknown';
      const verdict = resMatch?.[1]?.trim() ?? 'INCONCLUSIVE';
      const description = resMatch?.[2]?.trim() ?? result.split('\n').pop()?.trim() ?? '';

      console.log(`  Hypothesis: ${hypothesis.slice(0, 100)}`);
      console.log(`  Verdict: ${verdict} — ${description.slice(0, 100)}`);

      appendLog(iter, taskName, hypothesis, lastOutput.slice(0, 50), verdict, description);

      if (verdict === 'CONFIRMED') {
        console.log(`\n✅ Root cause found at iteration ${iter}!`);
        console.log(`   ${description}`);
        break;
      }
    } catch (err: any) {
      console.error(`  Error: ${err.message?.slice(0, 100)}`);
      appendLog(iter, taskName, 'error', '', 'CRASH', err.message?.slice(0, 80) ?? '');
    }

    // Re-run task for fresh output
    try { exec('opencli browser close'); } catch {}
    for (const step of task.steps) lastOutput = exec(step);
  }

  try { exec('opencli browser close'); } catch {}
  console.log(`\nDebug log saved to: ${DEBUG_LOG}\n`);
}

main();

```

### Core Architecture Module: `autoresearch/commands/fix.ts`
```
#!/usr/bin/env npx tsx
/**
 * /autoresearch:fix — Iterative error elimination.
 *
 * Auto-detects broken state (build → test → browse tests) and iteratively
 * fixes errors one at a time. Stops when error count reaches 0.
 *
 * Priority: build errors → test failures → browse task failures
 *
 * Usage:
 *   npx tsx autoresearch/commands/fix.ts
 *   npx tsx autoresearch/commands/fix.ts --iterations 10
 */

import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../config.js';
import { Engine, type ModifyContext } from '../engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

function exec(cmd: string): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      cwd: ROOT, timeout: 120_000, encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return { ok: true, output };
  } catch (err: any) {
    return { ok: false, output: (err.stdout ?? '') + '\n' + (err.stderr ?? '') };
  }
}

/** Detect current broken state and return verify command + error count */
function detectBrokenState(): { verify: string; errors: number; description: string } | null {
  // 1. Build
  const build = exec('npm run build 2>&1');
  if (!build.ok) {
    const errorCount = (build.output.match(/error TS/g) || []).length || 1;
    return {
      verify: 'npm run build 2>&1 | grep -c "error TS" || echo 0',
      errors: errorCount,
      description: `${errorCount} TypeScript build error(s)`,
    };
  }

  // 2. Tests
  const test = exec('npm test 2>&1');
  if (!test.ok) {
    const failMatch = test.output.match(/(\d+)\s+fail/i);
    const errorCount = failMatch ? parseInt(failMatch[1], 10) : 1;
    return {
      verify: 'npm test 2>&1 | grep -oP "\\d+(?= fail)" || echo 0',
      errors: errorCount,
      description: `${errorCount} test failure(s)`,
    };
  }

  // 3. Browse tests
  const browse = exec('npx tsx autoresearch/eval-browse.ts 2>&1');
  const scoreMatch = browse.output.match(/SCORE=(\d+)\/(\d+)/);
  if (scoreMatch) {
    const passed = parseInt(scoreMatch[1], 10);
    const total = parseInt(scoreMatch[2], 10);
    const failures = total - passed;
    if (failures > 0) {
      return {
        verify: 'npx tsx autoresearch/eval-browse.ts 2>&1 | tail -1',
        errors: failures,
        description: `${failures} browse task failure(s) (${passed}/${total})`,
      };
    }
  }

  return null; // all clean
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const maxIterations = args.iterations ?? 20;

  console.log('\n🔧 AutoResearch Fix — Detecting broken state...\n');

  const broken = detectBrokenState();
  if (!broken) {
    console.log('  ✓ All clean — nothing to fix!\n');
    return;
  }

  console.log(`  Found: ${broken.description}`);
  console.log(`  Verify: ${broken.verify}\n`);

  const config = {
    goal: `Fix all errors: ${broken.description}`,
    scope: ['src/**/*.ts', 'extension/src/**/*.ts'],
    metric: 'error_count',
    direction: 'lower' as const,
    verify: broken.verify,
    guard: 'npm run build',
    iterations: maxIterations,
    minDelta: 1,
  };

  const logPath = join(ROOT, 'autoresearch-results.tsv');
  const engine = new Engine(config, logPath, {
    modify: async (ctx: ModifyContext) => {
      const prompt = `Fix ONE error. Current error count: ${ctx.currentMetric}. Goal: 0 errors.

Read the error output, understand the root cause, and make ONE focused fix.
Do NOT fix multiple unrelated errors at once.
Do NOT modify test files.

${ctx.stuckHint ? `STUCK HINT: ${ctx.stuckHint}` : ''}`;

      try {
        // Pass prompt via stdin `input` option to avoid shell metacharacter expansion
        const result = execSync(
          'claude -p --dangerously-skip-permissions --allowedTools "Bash(npm:*),Bash(npx:*),Read,Edit,Write,Glob,Grep" --output-format text --no-session-persistence',
          { cwd: ROOT, timeout: 180_000, encoding: 'utf-8', input: prompt, stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();
        const lines = result.split('\n').filter(l => l.trim());
        return lines[lines.length - 1]?.trim()?.slice(0, 120) || 'fix attempt';
      } catch {
        return null;
      }
    },
    onStatus: (msg) => console.log(msg),
  });

  try {
    const results = await engine.run();
    const finalMetric = results[results.length - 1]?.metric ?? broken.errors;
    if (finalMetric === 0) {
      console.log('\n✅ All errors fixed!\n');
    } else {
      console.log(`\n⚠ ${finalMetric} error(s) remaining after ${maxIterations} iterations.\n`);
    }
  } catch (err: any) {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  }
}

main();

```

### Core Architecture Module: `autoresearch/commands/plan.ts`
```
#!/usr/bin/env npx tsx
/**
 * /autoresearch:plan — Interactive configuration wizard.
 *
 * Walks through goal, scope, metric, verify, guard settings
 * and outputs a ready-to-paste run command.
 *
 * Usage:
 *   npx tsx autoresearch/commands/plan.ts
 */

import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESETS } from '../presets/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r));

async function main() {
  console.log('\n🔬 AutoResearch — Configuration Wizard\n');

  // Offer presets first
  const presetNames = Object.keys(PRESETS);
  console.log('Available presets:');
  presetNames.forEach((name, i) => {
    console.log(`  [${i + 1}] ${name} — ${PRESETS[name].goal}`);
  });
  console.log(`  [0] Custom config\n`);

  const choice = await ask('Choose preset or 0 for custom: ');
  const idx = parseInt(choice, 10);

  if (idx > 0 && idx <= presetNames.length) {
    const name = presetNames[idx - 1];
    const iterations = await ask('Iterations (empty = unbounded): ');
    const iterFlag = iterations ? ` --iterations ${iterations}` : '';
    console.log(`\n✅ Ready to run:\n`);
    console.log(`  npx tsx autoresearch/commands/run.ts --preset ${name}${iterFlag}\n`);
    rl.close();
    return;
  }

  // Custom config
  const goal = await ask('Goal (what to improve): ');
  const scope = await ask('Scope (file globs, comma-separated): ');
  const metric = await ask('Metric name (e.g. pass_count, coverage): ');
  const direction = await ask('Direction (higher/lower): ') as 'higher' | 'lower';
  const verify = await ask('Verify command (must output a number): ');

  // Dry-run verify
  console.log('\n  Dry-running verify command...');
  try {
    const output = execSync(verify, { cwd: ROOT, timeout: 120_000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const { extractMetric } = await import('../config.js');
    const value = extractMetric(output);
    if (value != null) {
      console.log(`  ✓ Verify works — current ${metric}: ${value}`);
    } else {
      console.log(`  ⚠ Verify ran but no number extracted from output:\n    ${output.slice(0, 200)}`);
    }
  } catch (err: any) {
    console.log(`  ✗ Verify failed: ${err.message?.slice(0, 100)}`);
  }

  const guard = await ask('Guard command (optional, press Enter to skip): ');
  const iterations = await ask('Iterations (empty = unbounded): ');

  const parts = ['npx tsx autoresearch/commands/run.ts'];
  parts.push(`--goal "${goal}"`);
  parts.push(`--scope "${scope}"`);
  parts.push(`--metric "${metric}"`);
  parts.push(`--direction ${direction}`);
  parts.push(`--verify "${verify}"`);
  if (guard) parts.push(`--guard "${guard}"`);
  if (iterations) parts.push(`--iterations ${iterations}`);

  console.log(`\n✅ Ready to run:\n`);
  console.log(`  ${parts.join(' \\\n    ')}\n`);

  rl.close();
}

main();

```

### Core Architecture Module: `autoresearch/commands/run.ts`
```
#!/usr/bin/env npx tsx
/**
 * /autoresearch — Main autonomous iteration loop.
 *
 * Usage:
 *   npx tsx autoresearch/commands/run.ts --preset browser-reliability
 *   npx tsx autoresearch/commands/run.ts --preset browser-reliability --iterations 5
 *   npx tsx autoresearch/commands/run.ts --goal "..." --scope "src/*.ts" --verify "..." --iterations 10
 *
 * The modify callback spawns Claude Code to make ONE atomic change per iteration.
 * Engine handles commit, verify, guard, keep/discard, and logging.
 */

import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, type AutoResearchConfig } from '../config.js';
import { Engine, type ModifyContext } from '../engine.js';
import { PRESETS } from '../presets/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CLAUDE_ALLOWED_TOOLS = 'Bash(npm:*),Bash(npx:*),Bash(git:*),Read,Edit,Write,Glob,Grep';

export function buildClaudeModifyInvocation(prompt: string) {
  const options: ExecFileSyncOptionsWithStringEncoding = {
    cwd: ROOT,
    timeout: 300_000,
    encoding: 'utf-8',
    input: prompt,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  };
  return {
    command: 'claude',
    args: [
      '-p',
      '--dangerously-skip-permissions',
      '--allowedTools',
      CLAUDE_ALLOWED_TOOLS,
      '--output-format',
      'text',
      '--no-session-persistence',
    ],
    options,
  };
}

function buildModifyPrompt(ctx: ModifyContext, config: AutoResearchConfig): string {
  const recent = ctx.recentLog.slice(-10).map(r =>
    `  ${r.status.padEnd(12)} ${r.description}`
  ).join('\n');

  return `You are an autonomous improvement agent. Make ONE atomic change to improve this metric.

## Goal
${config.goal}

## Current State
- Metric (${config.metric}): ${ctx.currentMetric} (best: ${ctx.bestMetric})
- Iteration: ${ctx.iteration}
- Consecutive discards: ${ctx.consecutiveDiscards}
${ctx.stuckHint ? `\n## STUCK — Try a Different Approach\n${ctx.stuckHint}` : ''}

## Recent History
${recent || '  (no history yet)'}

## Git Log (recent experiments)
${ctx.gitLog.split('\n').slice(0, 10).join('\n')}

## Scope (files you can modify)
${ctx.scopeFiles.join('\n')}

## Rules
1. Make ONE atomic change (one logical intent, even if multiple files)
2. Read the failing test output or code BEFORE modifying
3. DO NOT modify test files or the verify command
4. Describe what you changed in one sentence (no "and" linking unrelated actions)
5. If previous approach was discarded, try something DIFFERENT
6. Focus on the specific failures — read error messages carefully`;
}

async function modify(ctx: ModifyContext, config: AutoResearchConfig): Promise<string | null> {
  const prompt = buildModifyPrompt(ctx, config);

  console.log('  Claude Code making a change...');
  try {
    // Keep command structure and the repository-derived prompt out of a shell.
    // Claude reads the prompt from stdin when -p has no positional prompt.
    const invocation = buildClaudeModifyInvocation(prompt);
    const result = execFileSync(
      invocation.command,
      invocation.args,
      invocation.options
    ).trim();

    // Extract description from Claude's response (last non-empty line or summary)
    const lines = result.split('\n').filter(l => l.trim());
    const desc = lines[lines.length - 1]?.trim() || 'change made by Claude Code';
    return desc.slice(0, 120);
  } catch (err: any) {
    console.error('  Claude Code failed:', err.message?.slice(0, 100));
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Resolve config from preset or CLI args
  let config: AutoResearchConfig;
  if (args.preset) {
    config = PRESETS[args.preset];
    if (!config) {
      console.error(`Unknown preset: ${args.preset}`);
      console.error(`Available: ${Object.keys(PRESETS).join(', ')}`);
      process.exit(1);
    }
    // Allow CLI overrides
    if (args.iterations != null) config = { ...config, iterations: args.iterations };
    if (args.guard != null) config = { ...config, guard: args.guard };
  } else if (args.goal && args.verify) {
    config = {
      goal: args.goal,
      scope: args.scope ?? ['src/**/*.ts'],
      metric: args.metric ?? 'score',
      direction: args.direction ?? 'higher',
      verify: args.verify,
      guard: args.guard,
      iterations: args.iterations,
      minDelta: args.minDelta,
    };
  } else {
    console.error('Usage: npx tsx autoresearch/commands/run.ts --preset <name> [--iterations N]');
    console.error('   or: npx tsx autoresearch/commands/run.ts --goal "..." --verify "..." --scope "..."');
    console.error(`\nAvailable presets: ${Object.keys(PRESETS).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n🔬 AutoResearch: ${config.goal}`);
  console.log(`   Metric: ${config.metric} (${config.direction})`);
  console.log(`   Verify: ${config.verify}`);
  console.log(`   Guard:  ${config.guard ?? '(none)'}`);
  console.log(`   Iterations: ${config.iterations ?? '∞'}`);
  console.log('');

  const logPath = join(ROOT, 'autoresearch-results.tsv');
  const engine = new Engine(config, logPath, {
    modify: (ctx) => modify(ctx, config),
    onStatus: (msg) => console.log(msg),
  });

  try {
    await engine.run();
  } catch (err: any) {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

```

### Core Architecture Module: `autoresearch/config.ts`
```
/**
 * AutoResearch Configuration — type definitions and CLI parsing.
 *
 * Based on Karpathy's autoresearch: constraint + mechanical metric + unbounded loop.
 */

export interface AutoResearchConfig {
  /** Plain-language goal, e.g. "Increase browser pass rate to 59/59" */
  goal: string;
  /** Glob patterns for files the agent can modify */
  scope: string[];
  /** What the metric measures, e.g. "pass_count" */
  metric: string;
  /** Whether improvement means the number goes up or down */
  direction: 'higher' | 'lower';
  /** Shell command that outputs a number (the metric value) */
  verify: string;
  /** Optional guard command — must pass for a keep decision */
  guard?: string;
  /** Max iterations (undefined = unbounded) */
  iterations?: number;
  /** Minimum delta to count as real improvement (noise filter) */
  minDelta?: number;
}

export type IterationStatus =
  | 'baseline'
  | 'keep'
  | 'keep (reworked)'
  | 'discard'
  | 'crash'
  | 'no-op'
  | 'hook-blocked';

export interface IterationResult {
  iteration: number;
  commit: string;
  metric: number;
  delta: number;
  guard: 'pass' | 'fail' | '-';
  status: IterationStatus;
  description: string;
}

/** Parse CLI args into a partial config (missing fields filled by preset or prompts) */
export function parseArgs(argv: string[]): Partial<AutoResearchConfig> & { preset?: string; task?: string } {
  const config: Partial<AutoResearchConfig> & { preset?: string; task?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--preset': config.preset = next; i++; break;
      case '--goal': config.goal = next; i++; break;
      case '--scope': config.scope = next?.split(','); i++; break;
      case '--metric': config.metric = next; i++; break;
      case '--direction': config.direction = next as 'higher' | 'lower'; i++; break;
      case '--verify': config.verify = next; i++; break;
      case '--guard': config.guard = next; i++; break;
      case '--iterations': config.iterations = parseInt(next, 10); i++; break;
      case '--min-delta': config.minDelta = parseFloat(next); i++; break;
      case '--task': config.task = next; i++; break;
    }
  }
  return config;
}

/** Extract a number from command output using common patterns */
export function extractMetric(output: string): number | null {
  // Try: last line that looks like a number
  const lines = output.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    // Match standalone numbers: "56", "95.2", "SCORE=56/59" → 56
    const scoreMatch = line.match(/SCORE[=:]\s*(\d+)/i);
    if (scoreMatch) return parseFloat(scoreMatch[1]);
    const numMatch = line.match(/^[\d.]+$/);
    if (numMatch) return parseFloat(numMatch[0]);
  }
  // Fallback: first number in output
  const fallback = output.match(/(\d+(?:\.\d+)?)/);
  return fallback ? parseFloat(fallback[1]) : null;
}

```

### Core Architecture Module: `autoresearch/engine.ts`
```
/**
 * AutoResearch Engine — Karpathy's 8-phase autonomous iteration loop.
 *
 * Phase 0: Precondition checks (git clean, no locks)
 * Phase 1: Review (read scope files + log + git history)
 * Phase 2: Ideate (select next change based on history)
 * Phase 3: Modify (one atomic change — delegated to caller)
 * Phase 4: Commit (git add + commit with experiment prefix)
 * Phase 5: Verify (run verify command, extract metric)
 * Phase 5.5: Guard (optional regression check)
 * Phase 6: Decide (keep/discard/crash + rollback)
 * Phase 7: Log (append TSV)
 * Phase 8: Repeat
 */

import { execSync, execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { type AutoResearchConfig, type IterationResult, type IterationStatus, extractMetric } from './config.js';
import { Logger } from './logger.js';

export interface EngineCallbacks {
  /** Called at Phase 2-3: review context, ideate, and make ONE change.
   *  Return a one-sentence description of what was changed, or null to skip. */
  modify(context: ModifyContext): Promise<string | null>;

  /** Called when engine needs to report status */
  onStatus?(msg: string): void;
}

export interface ModifyContext {
  iteration: number;
  bestMetric: number;
  currentMetric: number;
  recentLog: IterationResult[];
  gitLog: string;
  scopeFiles: string[];
  consecutiveDiscards: number;
  stuckHint: string | null;
}

const ROOT = join(import.meta.dirname ?? process.cwd(), '..');

function exec(cmd: string, opts?: { timeout?: number; cwd?: string }): string {
  try {
    return execSync(cmd, {
      cwd: opts?.cwd ?? ROOT,
      timeout: opts?.timeout ?? 120_000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    }).trim();
  } catch (err: any) {
    return err.stdout?.trim() ?? err.message ?? '';
  }
}

function execStrict(cmd: string, opts?: { timeout?: number }): string {
  return execSync(cmd, {
    cwd: ROOT,
    timeout: opts?.timeout ?? 120_000,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  }).trim();
}

export class Engine {
  private config: AutoResearchConfig;
  private logger: Logger;
  private callbacks: EngineCallbacks;
  private bestMetric: number = 0;
  private currentMetric: number = 0;
  private iteration: number = 0;

  constructor(config: AutoResearchConfig, logPath: string, callbacks: EngineCallbacks) {
    this.config = config;
    this.logger = new Logger(logPath);
    this.callbacks = callbacks;
  }

  private log(msg: string): void {
    this.callbacks.onStatus?.(msg);
  }

  /** Phase 0: Precondition checks */
  private checkPreconditions(): void {
    // Git repo exists
    try { execStrict('git rev-parse --git-dir'); }
    catch { throw new Error('Not a git repository'); }

    // Clean working tree
    const status = exec('git status --porcelain');
    if (status) throw new Error(`Working tree not clean:\n${status}`);

    // No stale locks
    if (existsSync(join(ROOT, '.git', 'index.lock'))) {
      throw new Error('Stale .git/index.lock found — remove it first');
    }

    // Not detached HEAD
    try { execStrict('git symbolic-ref HEAD'); }
    catch { throw new Error('Detached HEAD — checkout a branch first'); }
  }

  /** Phase 5: Run verify command and extract metric */
  private runVerify(): number | null {
    this.log('  verify...');
    const output = exec(this.config.verify, { timeout: 300_000 });
    return extractMetric(output);
  }

  /** Phase 5.5: Run guard command */
  private runGuard(): boolean {
    if (!this.config.guard) return true;
    this.log('  guard...');
    try {
      execStrict(this.config.guard, { timeout: 300_000 });
      return true;
    } catch {
      return false;
    }
  }

  /** Phase 4: Commit changes */
  private commit(description: string): string | null {
    if (!this.config.scope.length) return null; // no scope = nothing to stage
    // Stage only files matching scope globs (avoid staging unrelated changes)
    // Use execFileSync to bypass shell glob expansion so git handles pathspecs directly
    execFileSync('git', ['add', '--', ...this.config.scope], {
      cwd: ROOT, timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'],
    });
    const diff = exec('git diff --cached --quiet; echo $?');
    if (diff === '0') return null; // no changes

    try {
      execStrict(`git commit -m "experiment(browser): ${description.replace(/"/g, '\\"')}"`);
      return exec('git rev-parse --short HEAD');
    } catch {
      // Hook failure
      exec('git reset HEAD');
      return 'hook-blocked';
    }
  }

  /** Phase 6: Rollback */
  private safeRevert(): void {
    try {
      execStrict('git revert HEAD --no-edit');
    } catch {
      exec('git revert --abort');
      exec('git reset --hard HEAD~1');
    }
  }

  /** Get stuck hint when >5 consecutive discards */
  private getStuckHint(discards: number): string | null {
    if (discards < 5) return null;
    const hints = [
      'Re-read ALL scope files from scratch. Try a completely different approach.',
      'Review entire results log — what worked before? Try combining successful changes.',
      'Try the OPPOSITE of what has been failing.',
      'Try a radical architectural change instead of incremental tweaks.',
      'Simplify — remove complexity rather than adding it.',
    ];
    return hints[Math.min(discards - 5, hints.length - 1)];
  }

  /** Run the main loop */
  async run(): Promise<IterationResult[]> {
    const results: IterationResult[] = [];

    // Phase 0: Preconditions
    this.log('Phase 0: Precondition checks...');
    this.checkPreconditions();

    // Initialize logger
    this.logger.init(this.config);

    // Baseline measurement
    this.log('Measuring baseline...');
    const baseline = this.runVerify();
    if (baseline == null) throw new Error('Verify command returned no metric for baseline');
    this.bestMetric = baseline;
    this.currentMetric = baseline;

    const baselineCommit = exec('git rev-parse --short HEAD');
    const baselineResult: IterationResult = {
      iteration: 0,
      commit: baselineCommit,
      metric: baseline,
      delta: 0,
      guard: this.config.guard ? (this.runGuard() ? 'pass' : 'fail') : '-',
      status: 'baseline',
      description: `initial state — ${this.config.metric} ${baseline}`,
    };
    this.logger.append(baselineResult);
    results.push(baselineResult);
    this.log(`Baseline: ${this.config.metric} = ${baseline}`);

    // Main loop
    const maxIter = this.config.iterations ?? Infinity;
    for (this.iteration = 1; this.iteration <= maxIter; this.iteration++) {
      this.log(`\n━━━ Iteration ${this.iteration}${maxIter < Infinity ? `/${maxIter}` : ''} ━━━`);

      // Phase 1: Review
      const gitLog = exec('git log --oneline -20');
      const recentLog = this.logger.readLast(20);
      const scopeFiles = this.config.scope;
      const consecutiveDiscards = this.logger.consecutiveDiscards();

      // Phase 2-3: Ideate + Modify (delegated to callback)
      const context: ModifyContext = {
        iteration: this.iteration,
        bestMetric: this.bestMetric,
        currentMetric: this.currentMetric,
        recentLog,
        gitLog,
        scopeFiles,
        consecutiveDiscards,
        stuckHint: this.getStuckHint(consecutiveDiscards),
      };

      let description: string | null;
      try {
        description = await this.callbacks.modify(context);
      } catch (err: any) {
        this.log(`  modify error: ${err.message}`);
        const result: IterationResult = {
          iteration: this.iteration,
          commit: '-',
          metric: this.currentMetric,
          delta: 0,
          guard: '-',
          status: 'crash',
          description: `modify crashed: ${err.message?.slice(0, 80)}`,
        };
        this.logger.append(result);
        results.push(result);
        continue;
      }

      if (!description) {
        const result
```

### Core Architecture Module: `autoresearch/eval-all.ts`
```
#!/usr/bin/env npx tsx
/**
 * Combined Test Suite Runner — runs browse + V2EX + Zhihu tasks.
 * Reports combined score for AutoResearch iteration.
 *
 * Usage:
 *   npx tsx autoresearch/eval-all.ts              # Run all
 *   npx tsx autoresearch/eval-all.ts --suite v2ex  # Run one suite
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RESULTS_DIR = join(__dirname, 'results');

interface SuiteResult {
  name: string;
  passed: number;
  total: number;
  failures: string[];
  duration: number;
}

function runSuite(name: string, script: string): SuiteResult {
  const start = Date.now();
  try {
    const output = execSync(`npx tsx ${script}`, {
      cwd: ROOT,
      timeout: 600_000,
      encoding: 'utf-8',
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Parse SCORE=X/Y from output
    const scoreMatch = output.match(/SCORE=(\d+)\/(\d+)/);
    const passed = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
    const total = scoreMatch ? parseInt(scoreMatch[2], 10) : 0;

    // Parse failures
    const failures: string[] = [];
    const failLines = output.match(/✗.*$/gm) || [];
    for (const line of failLines) {
      const m = line.match(/✗\s+(?:\[.*?\]\s+)?(\S+)/);
      if (m) failures.push(m[1].replace(/:$/, ''));
    }

    return { name, passed, total, failures, duration: Date.now() - start };
  } catch (err: any) {
    const output = err.stdout ?? '';
    const scoreMatch = output.match(/SCORE=(\d+)\/(\d+)/);
    const passed = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
    const total = scoreMatch ? parseInt(scoreMatch[2], 10) : 0;
    const failures: string[] = [];
    const failLines = output.match(/✗.*$/gm) || [];
    for (const line of failLines) {
      const m = line.match(/✗\s+(?:\[.*?\]\s+)?(\S+)/);
      if (m) failures.push(m[1].replace(/:$/, ''));
    }
    return { name, passed, total, failures, duration: Date.now() - start };
  }
}

function main() {
  const args = process.argv.slice(2);
  const singleSuite = args.includes('--suite') ? args[args.indexOf('--suite') + 1] : null;

  const suites = [
    { name: 'browse', script: 'autoresearch/eval-browse.ts' },
    { name: 'v2ex', script: 'autoresearch/eval-v2ex.ts' },
    { name: 'zhihu', script: 'autoresearch/eval-zhihu.ts' },
  ].filter(s => !singleSuite || s.name === singleSuite);

  console.log(`\n🔬 Combined AutoResearch — ${suites.length} suites\n`);

  const results: SuiteResult[] = [];
  for (const suite of suites) {
    console.log(`  Running ${suite.name}...`);
    const result = runSuite(suite.name, suite.script);
    results.push(result);
    const icon = result.passed === result.total ? '✓' : '✗';
    console.log(`    ${icon} ${result.name}: ${result.passed}/${result.total} (${Math.round(result.duration / 1000)}s)`);
    if (result.failures.length > 0) {
      for (const f of result.failures.slice(0, 5)) {
        console.log(`      ✗ ${f}`);
      }
    }
  }

  // Summary
  const totalPassed = results.reduce((s, r) => s + r.passed, 0);
  const totalTasks = results.reduce((s, r) => s + r.total, 0);
  const totalDuration = results.reduce((s, r) => s + r.duration, 0);
  const allFailures = results.flatMap(r => r.failures.map(f => `${r.name}:${f}`));

  console.log(`\n${'━'.repeat(50)}`);
  console.log(`  Combined: ${totalPassed}/${totalTasks}`);
  for (const r of results) {
    console.log(`    ${r.name}: ${r.passed}/${r.total}`);
  }
  console.log(`  Time: ${Math.round(totalDuration / 60000)}min`);
  if (allFailures.length > 0) {
    console.log(`\n  All failures:`);
    for (const f of allFailures) console.log(`    ✗ ${f}`);
  }

  // Save result
  mkdirSync(RESULTS_DIR, { recursive: true });
  const existing = readdirSync(RESULTS_DIR).filter(f => f.startsWith('all-')).length;
  const roundNum = String(existing + 1).padStart(3, '0');
  const resultPath = join(RESULTS_DIR, `all-${roundNum}.json`);
  writeFileSync(resultPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    score: `${totalPassed}/${totalTasks}`,
    suites: Object.fromEntries(results.map(r => [r.name, `${r.passed}/${r.total}`])),
    failures: allFailures,
    duration: `${Math.round(totalDuration / 60000)}min`,
  }, null, 2), 'utf-8');
  console.log(`\n  Results saved to: ${resultPath}`);
  console.log(`\nSCORE=${totalPassed}/${totalTasks}`);
}

main();

```

### Core Architecture Module: `autoresearch/eval-browse.ts`
```
#!/usr/bin/env npx tsx
/**
 * Layer 1: Deterministic Browse Command Testing
 *
 * Runs predefined opencli browser command sequences against real websites.
 * No LLM involved — tests command reliability only.
 *
 * Usage:
 *   npx tsx autoresearch/eval-browse.ts              # Run all tasks
 *   npx tsx autoresearch/eval-browse.ts --task hn-top5  # Run single task
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TASKS_FILE = join(__dirname, 'browse-tasks.json');
const RESULTS_DIR = join(__dirname, 'results');
const BASELINE_FILE = join(__dirname, 'baseline-browse.txt');

interface BrowseTask {
  name: string;
  steps: string[];
  judge: JudgeCriteria;
  set?: 'test';
  note?: string;
}

type JudgeCriteria =
  | { type: 'contains'; value: string }
  | { type: 'arrayMinLength'; minLength: number }
  | { type: 'nonEmpty' }
  | { type: 'matchesPattern'; pattern: string };

interface TaskResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  set: 'train' | 'test';
}

function judge(criteria: JudgeCriteria, output: string): boolean {
  try {
    switch (criteria.type) {
      case 'contains':
        return output.toLowerCase().includes(criteria.value.toLowerCase());
      case 'arrayMinLength': {
        try {
          const arr = JSON.parse(output);
          if (Array.isArray(arr)) return arr.length >= criteria.minLength;
        } catch { /* not JSON array */ }
        return false;
      }
      case 'nonEmpty':
        return output.trim().length > 0 && output.trim() !== 'null' && output.trim() !== 'undefined';
      case 'matchesPattern':
        return new RegExp(criteria.pattern).test(output);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

function runCommand(cmd: string): string {
  try {
    return execSync(cmd, {
      cwd: join(__dirname, '..'),
      timeout: 30000,
      encoding: 'utf-8',
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err: any) {
    return err.stdout?.trim() || err.stderr?.trim() || '';
  }
}

function runTask(task: BrowseTask): TaskResult {
  const start = Date.now();
  let lastOutput = '';

  try {
    for (const step of task.steps) {
      lastOutput = runCommand(step);
    }

    const passed = judge(task.judge, lastOutput);

    return {
      name: task.name,
      passed,
      duration: Date.now() - start,
      error: passed ? undefined : `Output: ${lastOutput.slice(0, 100)}`,
      set: task.set === 'test' ? 'test' : 'train',
    };
  } catch (err: any) {
    return {
      name: task.name,
      passed: false,
      duration: Date.now() - start,
      error: err.message?.slice(0, 100),
      set: task.set === 'test' ? 'test' : 'train',
    };
  }
}

function main() {
  const args = process.argv.slice(2);
  const singleTask = args.includes('--task') ? args[args.indexOf('--task') + 1] : null;

  const allTasks: BrowseTask[] = JSON.parse(readFileSync(TASKS_FILE, 'utf-8'));
  const tasks = singleTask ? allTasks.filter(t => t.name === singleTask) : allTasks;

  if (tasks.length === 0) {
    console.error(`Task "${singleTask}" not found.`);
    process.exit(1);
  }

  console.log(`\n🔬 Layer 1: Browse Commands — ${tasks.length} tasks\n`);

  const results: TaskResult[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    process.stdout.write(`  [${i + 1}/${tasks.length}] ${task.name}...`);

    const result = runTask(task);
    results.push(result);

    const icon = result.passed ? '✓' : '✗';
    console.log(` ${icon} (${(result.duration / 1000).toFixed(1)}s)`);

    // Close browser between tasks for clean state
    if (i < tasks.length - 1) {
      try { runCommand('opencli browser close'); } catch { /* ignore */ }
    }
  }

  // Final close
  try { runCommand('opencli browser close'); } catch { /* ignore */ }

  // Summary
  const trainResults = results.filter(r => r.set === 'train');
  const testResults = results.filter(r => r.set === 'test');
  const totalPassed = results.filter(r => r.passed).length;
  const trainPassed = trainResults.filter(r => r.passed).length;
  const testPassed = testResults.filter(r => r.passed).length;
  const totalDuration = results.reduce((s, r) => s + r.duration, 0);

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  Score:  ${totalPassed}/${results.length} (train: ${trainPassed}/${trainResults.length}, test: ${testPassed}/${testResults.length})`);
  console.log(`  Time:   ${Math.round(totalDuration / 60000)}min`);

  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log(`\n  Failures:`);
    for (const f of failures) {
      console.log(`    ✗ ${f.name}: ${f.error ?? 'unknown'}`);
    }
  }
  console.log('');

  // Save result
  mkdirSync(RESULTS_DIR, { recursive: true });
  const existing = readdirSync(RESULTS_DIR).filter(f => f.startsWith('browse-')).length;
  const roundNum = String(existing + 1).padStart(3, '0');
  const resultPath = join(RESULTS_DIR, `browse-${roundNum}.json`);
  writeFileSync(resultPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    score: `${totalPassed}/${results.length}`,
    trainScore: `${trainPassed}/${trainResults.length}`,
    testScore: `${testPassed}/${testResults.length}`,
    duration: `${Math.round(totalDuration / 60000)}min`,
    tasks: results,
  }, null, 2), 'utf-8');
  console.log(`  Results saved to: ${resultPath}`);
  console.log(`\nSCORE=${totalPassed}/${results.length}`);
}

main();

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2434** (2026-08-29): **[Bug]: Omni 1.1 Flash: Flow job-list / flow job-status fail with client error 400**
  *Symptoms*: ### Description  Google Flow shipped a UI + model-lineup change on 2026-08-29. After it, `opencli flow job-list` and `opencli flow job-status` fail with `client error 400`, so **any polling workflow breaks** — but `flow gen` and `flow job-download` both still work.  ### Steps to Reproduce  ## Steps to reproduce  ```bash opencli flow credits            # works opencli flow models             # works opencli flow project-current    # works opencli flow project-list       # works  opencli flow job-list --limit 2       # FAILS: client error 400 opencli flow job-status --mediaId <any valid mediaId>   # FAILS: client error 400 ```  ### Actual output  ``` ok: false error:   code: UNKNOWN   message: client error 400   exitCode: 1 # AutoFix: re-run with --trace=retain-on-failure for trace artifact ```  ### Expected Behavior  ### Expected  A job list / job status.  ## The key detail: generation is NOT broken, only the job-query surface  This is what makes the bug easy to misdiagnose. Full sequence on a working account:  ```bash $ opencli flow gen --prompt "Medium shot, static. She lifts one hand from the table." \     --refs ./still.png --length 4 --aspect 16:9 --yes true - 状态: ✅ 已提交   消耗积分: 15   余额: 105   ok: true   mediaId: 4ea974f5-----------------03f6e827323d   model_raw: abra_r2v_4s  $ opencli flow job-status --mediaId 4ea974f5-----------------03f6e827323d   client error 400                       # ← broken  $ opencli flow job-download --mediaId 4ea974f5-----------------03f6e82732

- **Issue #2240** (2026-08-28): **[Bug]: doubao/ask times out after 90 seconds on v1.8.6 while Browser Bridge is connected**
  *Symptoms*: ### Description  On macOS, `opencli doubao ask` consistently times out after 90 seconds even though the OpenCLI daemon and Browser Bridge extension are connected.  Before running the command, I manually opened the Doubao chat page in the same connected Chrome profile and confirmed that the normal chat interface and message input were visible.  The test did not use `opencli doubao login`, automatic browser navigation, file uploads, or project data.  After 90 seconds, the command returned:  ```text ok: false error:   code: TIMEOUT   message: doubao/ask timed out after 90s   help: Try again, or increase timeout with --timeout <seconds> (or OPENCLI_BROWSER_COMMAND_TIMEOUT for the global default)   exitCode: 75 ```  The status command reported a connected page but could not determine the login state:  ```text opencli doubao status -f json  Status: Connected Login: Unknown Url: https://www.doubao.com/chat/ ```  `opencli doubao whoami -f json` exited with code `77` without returning a parseable account object.  The timeout may be caused by:  * a Doubao DOM or selector change; * the prompt not being inserted or submitted; * the response or completion state not being detected; * an unrecognized authentication or verification state; * the adapter selecting an unexpected page or session.  Possibly related issues:  * #1478: previous Doubao message selector drift after a DOM change; * #1894: Doubao verification challenge detection.  This symptom differs from #1894 because OpenCLI did not 
  **Post-Mortem & Fix Analysis**:
  > 关闭为已被更精确的当前版本复现取代。#2400 在 CLI 1.8.7 / extension 1.0.23 上复现了相同的 `doubao ask` 超时，并把根因缩小到 about:blank 租约页与被领养豆包标签之间的执行目标分裂，同时提供了稳定 workaround。#2240 只记录了 1.8.6 的泛化超时且没有更窄证据，继续并行保留会把同一故障拆成两条模糊队列；后续统一在 #2400 跟进。

- **Issue #2211** (2026-07-31): **[Bug]: opencli drains stdin at startup, silently breaking `while read` loops & pipelines (even `--version`/`--help`)**
  *Symptoms*: # [Bug] `opencli` consumes stdin at startup, silently breaking `while read` loops and shell pipelines (even `--version` / `--help`)  ## 环境 (Environment)  - opencli: `@jackwener/opencli` v1.8.5 (`opencli --version` → `1.8.5`) - Shim: `/usr/local/bin/opencli` → `BROWSERBRIDGE_MANAGED_SHIM` → `/Applications/OpenCLIApp.app/Contents/MacOS/opencli-app` (OpenCLIApp v0.1.36, Mach-O arm64) - OS: macOS 26.2 (arm64) - Shell: `/bin/sh`, tested with both `sh` and `bash` — same result  ## 现象 (Summary)  Every `opencli` invocation **unconditionally consumes all remaining stdin at process startup**, even for commands that never read input (e.g. `--version`, `--help`). When opencli is invoked inside a classic `while read` loop that itself reads from a pipe (or a file via stdin), the child process drains the shared stdin, so the loop's `read` hits EOF and the loop **silently terminates after the first iteration**.  I hit this while batch-fetching 17 Bilibili video summaries in a loop — only 1 of 17 ran, with no error at all. That silent partial execution is the dangerous part: no exit code, no warning, just "fewer items than expected".  ## 最小复现 (Minimal reproduction)  ```sh seq 3 | while read -r i; do   echo "iter $i start"   opencli --version   echo "iter $i end" done ```  **Actual output (bug):**  ``` iter 1 start 1.8.5 iter 1 end ```  Only **1 of 3** iterations executes. Same with `opencli --help`, same with any real command (e.g. `opencli doctor`).  **Control (no stdin-reading command):**  

- **Issue #2139** (2026-08-25): **[Bug]: OPENCLI_DAEMON_PORT is no longer supported (received 19825)**
  *Symptoms*: ### Description  ```shell > opencli doctor  error: OPENCLI_DAEMON_PORT is no longer supported (received 19825). The OpenCLI Chrome extension can only connect to localhost:19825. Unset OPENCLI_DAEMON_PORT and rerun opencli. ``` I have installed the latest OpenCLI APP and Chrome Exetention.  <img width="1989" height="200" alt="Image" src="https://github.com/user-attachments/assets/322fd8f4-966c-47c2-98b5-b963db2bfc93" />  <img width="980" height="680" alt="Image" src="https://github.com/user-attachments/assets/6af22cf6-7a42-484a-90a5-51d437abb8ff" />  <img width="318" height="214" alt="Image" src="https://github.com/user-attachments/assets/c68bb47d-16c9-4e3f-a470-36166a53941c" />  ### Steps to Reproduce  1. Run `opencli doctor` 2. See error   ### Expected Behavior  connect successfully  ### OpenCLI Version  can't execute  ### Node.js Version  20.x  ### Operating System  macOS  ### Logs / Screenshots  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > hey opencli team, whats the fix for this?? pls do proper testing, so this is so much waste of time for us?? 
  > Some findings from debugging this on macOS (OpenCLIApp 0.1.35, pkg install) that may help people who are stuck, plus one thing the app team may want to pick up:  **Root cause is already fixed on the CLI side in v1.8.6** (PR #2074, "tolerate OPENCLI_DAEMON_PORT at the default port"), but **OpenCLIApp 0.1.35 still bundles CLI 1.8.5**, so app-managed installs stay broken until an app release ships with a tolerant core. Two details we verified:  - The injection comes from the app **server process**: quitting/restarting the app doesn't help, and deleting `browserBridge.daemonPort` from `~/Library/Application Support/BrowserBridge/state.json` doesn't either — the server regenerates it on startup and injects `OPENCLI_DAEMON_PORT=19825` into every CLI child it spawns. - The menu-bar panel's "extension not connected" / "daemon not running" warning is **misleading**: the panel health-checks through the same broken managed path, so it stays yellow even when the daemon and extension are actually f
  > Resolved in the desktop distribution: OpenCLIApp v0.1.36 explicitly fixed the inherited  failure, and the current v0.1.38 release bundles OpenCLI 1.8.6, whose core tolerates the default injected port. Closing as completed. Please update OpenCLIApp if an older app-managed runtime is still installed.

- **Issue #2108** (2026-08-25): **# [Bug] File upload (`browser upload` / `page.uploadFiles`) fails with `-32000 "Not allowed"` on all sites via the extension bridge**
  *Symptoms*: ### Description  ## Summary `opencli browser <session> upload` and the adapter-facing `page.uploadFiles()` / `page.setFileInput()` fail on **every** site with a real `<input type=file>`. The Browser Bridge calls CDP `DOM.setFileInputFiles` directly with a `nodeId`, which Chrome rejects for **chrome.debugger-attached** debuggers since Chrome 72 (Chromium #928255). This makes file/image attachment non-functional for all adapters (Perplexity, ChatGPT, Gemini, Google AI Mode, etc.).  `opencli browser <session> upload` and the adapter-facing page.uploadFiles() / page.setFileInput() fail on EVERY site that has a real <input type=file>, with CDP error {"code":-32000,"message":"Not allowed"}. The input resolves fine (uploadFiles' own "not_file_input" guard passes) — only the final DOM.setFileInputFiles call is rejected. Tried both nodeId and backendNodeId; both fail.  Root cause: Chromium #928255 — since Chrome 72, DOM.setFileInputFiles is "Not allowed" when the debugger is attached via chrome.debugger (extensions) and called directly. It only works via the file-chooser interception flow. This blocks file/image attachment for ALL adapters (perplexity ask --attach, chatgpt image --image, project-file-add, etc.).  ## Environment - opencli v1.8.6, extension v1.0.22, Chrome 149, macOS - Browser Bridge (chrome.debugger extension), single connected profile  ## Reproduction ​```bash opencli --profile <p> browser ppx open "https://www.perplexity.ai" opencli --profile <p> browser ppx upload "
  **Post-Mortem & Fix Analysis**:
  > Adding a +1 from a fully automated / headless setup.  **Reproduced on opencli v1.8.7, Linux, Chrome 151, extension v1.0.22.** `opencli browser <s> upload "input[type=file]" <file>` → `{"code":-32000,"message":"Not allowed"}`, and the same happens through the adapter-facing `page.uploadFiles()` / `page.setFileInput()` path. The `<input type=file>` resolves fine (the `not_file_input` guard passes); only the final `DOM.setFileInputFiles` call is rejected.  **Why a "real" fix matters here:** a growing share of users drive Chrome **headless / CI / non-interactive**, where there is no human at the keyboard to open the native file-chooser dialog. When `DOM.setFileInputFiles` is refused under a `chrome.debugger` attachment (Chromium #928255), those sessions simply have no way to attach a file at all — so this single gate breaks image/file attachment for every adapter in headless automation, not just for interactive users who could click through the dialog manually.  **Workaround I can confirm 
  > Status update: this was fixed in #2125 (merged 2026-07-13). The Browser Bridge no longer calls `DOM.setFileInputFiles` with a bare nodeId — since extension **v1.0.23** it uses the file-chooser interception flow that Chromium requires for `chrome.debugger`-attached debuggers (`Page.setInterceptFileChooserDialog` → programmatic click → `Page.fileChooserOpened` → `DOM.setFileInputFiles` with the event's `backendNodeId`), which is exactly the path crbug 928255 left open.  Both reproductions in this thread report **extension v1.0.22**, which predates the fix. Please update the extension:  - **Manual/unpacked installs**: download `opencli-extension-v1.0.23.zip` from the [v1.8.7 release](https://github.com/jackwener/OpenCLI/releases/tag/v1.8.7) and reload (I verified this artifact contains the interception flow). - **Chrome Web Store installs**: chrome://extensions → Developer mode → Update, and check the version shows 1.0.23.  After updating, `opencli browser <session> upload` / `page.upload
  > Resolved by #2125 and shipped in v1.8.7 with Browser Bridge extension v1.0.23. The extension now uses the required file-chooser interception flow ( →  →  with the event ) instead of the rejected bare-node path. Both reports here used extension v1.0.22. Closing as completed; please reopen with a v1.0.23 reproduction if it persists.

- **Issue #2102** (2026-08-25): **[Bug]: Windows: OpenCLIApp CLI shim returns no output for commands**
  *Symptoms*: ### Description  On Windows, after installing OpenCLIApp, every openclicommand invoked from PowerShell produces zero output and no error​ — the prompt returns immediately: ```cmd PS> opencli --help PS> opencli --version PS> opencli list PS> opencli hackernews top --limit 5 ``` All silent. However, opencli doctor(invoked through the app's internal channel, not the shim) reports the runtime is healthy — Node found, daemon running, extension connected, OpenCLI runtime @jackwener/opencli@1.8.5resolved correctly at D:\01Software\OpenCLIApp\node_modules\@jackwener\opencli\dist\src\main.js. Root cause:​ The opencli.cmdshim under WindowsApps(C:\Users\<user>\AppData\Local\Microsoft\WindowsApps\opencli.cmd) is an app-managed stub, but it fails to forward execution to the OpenCLIApp-managed Node runtime. When the stub can't launch the backing process (PATH conflict / execution policy / stub logic edge case), it exits silently with no stderr, making the failure invisible to the user.   ### Steps to Reproduce  1. Install OpenCLIApp desktop on Windows (v0.1.35, Store or installer). 2. Confirm opencliresolves to the WindowsApps stub: ```cmd Get-Command opencli # Path: C:\Users\<user>\AppData\Local\Microsoft\WindowsApps\opencli.cmd ``` 3. Run any CLI command: ```cmd opencli --help opencli --version opencli list ``` 4. Observe: no stdout, no stderr, immediate return. 5. Compare with opencli doctor(works — it goes through the app's own channel, bypassing the shim): ```cmd Server status: runnin
  **Post-Mortem & Fix Analysis**:
  > Can confirm this on **OpenCLIApp 0.1.37 / Windows 11 ARM64 (Surface Pro X)**.  The app-managed shim is:  ```bat @echo off REM OPENCLIAPP_MANAGED_SHIM "%LOCALAPPDATA%\OpenCLIApp\opencli-app.exe" __opencli_shim %* ```  `opencli --version` / `opencli doctor` return immediately with **zero stdout and zero stderr**, matching this issue.  While debugging it I also found a separate ARM64 packaging problem: `%LOCALAPPDATA%\OpenCLIApp\node_modules\node\bin\node` has the magic bytes `CF FA ED FE` (Mach-O), so the bundled Node executable cannot run on Windows ARM64. With that runtime, nothing listens on port 19825 and the Edge/Chromium Browser Bridge v1.0.22 stays on `Reconnecting...`.  I replaced it with the official **Node.js v24.16.0 win-arm64 `node.exe`** and invoked the packaged OpenCLI runtime directly. That restored the daemon and bridge:  ```text opencli v1.8.6 doctor (node v24.16.0) [OK] Daemon: running on port 19825 (v1.8.6) [OK] Extension: connected (v1.0.22) [OK] Connectivity: connect
  > Resolved in OpenCLIApp v0.1.38. The Windows packaging fix now bundles the target Windows Node runtime, flattens app command results so stdout/stderr reach the managed shim, preserves non-zero install failures, and validates the installed batch shim path. v0.1.38 is the current desktop release. Closing as completed; please reopen with v0.1.38 diagnostics if output is still lost.
  > Confirmed fixed on OpenCLIApp 0.1.38 / Windows 11 ARM64 (Surface Pro X).  "opencli --version", "opencli doctor", and "opencli list" now return stdout normally through the managed WindowsApps shim. The bundled Node runtime is also correctly executable on Windows ARM64 ("v24.16.0"), and the daemon starts successfully on port 19825.  Thanks for the fix!

- **Issue #2072** (2026-07-03): **[Bug]: OpenCLI daemon not reachable on 127.0.0.1:19825: Connection refused (os error 61)**
  *Symptoms*: ### Description  MacOS 26.5.2 (25F84)  Chrome 149.0.7827.156 (arm64) OpenCLIApp 0.1.35 OpenCLI 1.0.21  the daemon cannot run till I run the script below: /Applications/OpenCLIApp.app/Contents/Resources/node_modules/node/bin/node \   /Applications/OpenCLIApp.app/Contents/Resources/node_modules/@jackwener/opencli/dist/src/daemon.js ℹ  [daemon] Listening on http://127.0.0.1:19825 ℹ  [daemon] Extension connected ℹ  [ext] [opencli] Connected to daemon ℹ  [daemon] Extension profile connected: *********  ### Steps to Reproduce  opencli doctor error: OPENCLI_DAEMON_PORT is no longer supported (received 19825). The OpenCLI Chrome extension can only connect to localhost:19825. Unset OPENCLI_DAEMON_PORT and rerun opencli.   ### Expected Behavior  can run smoothly  ### OpenCLI Version  no chance  ### Node.js Version  20.x  ### Operating System  macOS  ### Logs / Screenshots  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Closing as a duplicate of #2068 — same root cause: OpenCLIApp injects `OPENCLI_DAEMON_PORT=19825` into the environment of the CLI it manages, and CLI v1.8.5 hard-rejects the variable even when it carries the default port value, so the daemon never starts (your manual `node .../daemon.js` works precisely because it bypasses the injected env). Tracking the fix in #2068: the CLI will tolerate the variable when it equals the default 19825, and OpenCLIApp will stop injecting it.
  > thank you mate and please confirm when it will be released on https://opencli.info/download

- **Issue #2071** (2026-08-25): **[Bug]: div包裹svg，两个都标记数字，点击事件绑定在div上，svg没有绑定点击事件，在执行click时点击的是svg，导致事件无法触发**
  *Symptoms*: ### Description  [Bug]: div包裹svg，两个都标记数字，点击事件绑定在div上，svg没有绑定点击事件，在执行click时点击的是svg，导致事件无法触发  ### Steps to Reproduce  1. Run `opencli ...` 2. ... 3. See error   ### Expected Behavior  执行click时可知道点击div而非svg，从而触发点击事件  ### OpenCLI Version  1.8.4  ### Node.js Version  22.x  ### Operating System  macOS  ### Logs / Screenshots  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 小红书搜索文本，点击右下角的放大镜
  > 已由 #2126 修复并随 v1.8.7 发布。browser click 现在会做命中测试；当实际命中的是没有点击处理器的 SVG/子节点时，会重新定位到可点击祖先，并在结果中返回 click_method、hit、retargeted，不再把未触发的点击静默报成成功。现关闭为已完成；若新版本仍可复现，请附 trace 重新打开。

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

### Incident Patch 1: `2c598f58` (2026-08-30)
**Commit Message**: fix: javascript.lang.security.detect-child-process.detect-child-process security vulnerability (#2318)

Automated security fix generated by OrbisAI Security

**File**: `clis/spotify/spotify.js` (modified, +8/-3)
```diff
@@ -4,7 +4,7 @@ import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
 import { createServer } from 'http';
 import { homedir } from 'os';
 import { join } from 'path';
-import { exec } from 'child_process';
+import { execFile } from 'child_process';
 import { assertSpotifyCredentialsConfigured, getFirstSpotifyTrack, mapSpotifyTrackResults, parseDotEnv, resolveSpotifyCredentials, } from './utils.js';
 // ── Credentials ───────────────────────────────────────────────────────────────
 // Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET as environment variables,
@@ -99,8 +99,13 @@ async function findTrackUri(query) {
     return track;
 }
 function openBrowser(url) {
-    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
-    exec(cmd);
+    if (process.platform === 'win32') {
+        execFile('cmd', ['/c', 'start', '', url]);
+    } else if (process.platform === 'darwin') {
+        execFile('open', [url]);
+    } else {
+        execFile('xdg-open', [url]);
+    }
 }
 // ── Commands ──────────────────────────────────────────────────────────────────
 cli({
```

---

### Incident Patch 2: `48712502` (2026-08-29)
**Commit Message**: fix(xiaohongshu): stop ask breaking on webpack chunk renumbering, and stop it spending a note search per call (#2420)

* fix(xiaohongshu): locate 点点 conversation store by fingerprint, not a hardcoded module id

webpackRequire(6404) throws "Cannot read properties of undefined (reading
'call')" once Xiaohongshu renumbers its webpack chunks, which it did
(6404 -> 32914). Every `ask` call then fails in ~4s, before any chat happens.
Reported in #2408.

A hardcoded numeric module id has no contract with the site, so patching in the
new number only resets the clock until the next redeploy. This tries the known
ids first (zero scan cost in the common case), then locates the module by what
it *is*: scan webpackRequire.m for a factory whose source mentions both
createConversation and sendMessage. On a live page that is 1 candidate out of
~1600 modules. The scan only calls .toString(), which has no side effects; a
candidate is executed only after its source matches the fingerprint.

Tests execute the generated page script against a fake webpack runtime, so the
lookup is exercised rather than asserted as a substring - including the case
that matters: a store sitting at an id in neither the kno

**File**: `clis/xiaohongshu/ask.js` (modified, +54/-3)
```diff
@@ -263,7 +263,41 @@ export function buildAskEvaluateJs(query, timeoutSeconds, sourceLimit) {
           let webpackRequire;
           window.webpackChunkxhs_pc_web.push([[Date.now()], {}, (req) => { webpackRequire = req; }]);
           if (!webpackRequire) return { ok: false, error: 'webpack_require_unavailable', page_url: location.href };
-          const mod = webpackRequire(6404);
+          // Locate the conversation store module.
+          //
+          // A hardcoded webpack module id has no contract with the site: Xiaohongshu
+          // renumbers chunks on redeploys, and when it does, webpackRequire(<stale id>)
+          // throws "Cannot read properties of undefined (reading 'call')" from webpack's
+          // own runtime and every ask fails. That already happened once (6404 -> 32914).
+          //
+          // So: try known ids first (zero scan cost in the common case), then fall back
+          // to locating the module by what it *is* rather than by its number. The scan
+          // only calls .toString() on factory functions, which has no side effects; a
+          // candidate is executed only after its source matches the fingerprint.
+          const looksLikeConversationModule = (candidate) => (
+            candidate
+            && typeof candidate.t === 'function'
+            && candidate.G
+            && typeof candidate.G.AiChat === 'string'
+          );
+          let mod = null;
+          for (const knownId of [32914, 6404]) {
+            try {
+              const candidate = webpackRequire(knownId);
+              if (looksLikeConversationModule(candidate)) { mod = candidate; break; }
+            } catch { /* id absent from this build */ }
+          }
+          if (!mod) {
+            for (const id of Object.keys(webpackRequire.m || {})) {
+              let source = '';
+              try { source = webpackRequire.m[id].toString(); } catch { continue; }
+              if (!source.includes('createConversation') || !source.includes('sendMessage')) continue;
+              try {
+                const candidate = webpackRequire(id);
+                if (looksLikeConversationModule(candidate)) { mod = candidate; break; }
+              } catch { /* not loadable, keep looking */ }
+            }
+          }
           const useConversationStore = mod?.t;
           const scenes = mod?.G || { AiChat: 'aiChat' };
           if (typeof useConversationStore !== 'function') {
@@ -406,8 +440,25 @@ export const command = cli({
         const query = requirePrompt(kwargs?.query);
         const timeout = parseAskTimeout(kwargs?.timeout);
         const sourceLimit = parseAskLimit(kwargs?.['source-limit']);
-        const keyword = encodeURIComponent(query);
-        await page.goto(`https://${XHS_WEB_HOST}/search_result?keyword=${keyword}&source=web_search_result_notes`);
+        // Enter through 点点's own page, not search_result?keyword=<query>.
+        //
+        // Two reasons, both measured 2026-08-28 on a live logged-in session:
+        //
+        // 1. Cost. Loading search_result?keyword=... fires a real note search
+        //    (so.xiaohongshu.com/api/sns/web/v2/search/notes) before any chat happens —
+        //    a search request spent purely as a side effect of the URL chosen to reach
+        //    a chat store. /ai_chat serves the same conversation store and fires zero
+        //    search/notes for the whole page lifetime.
+        // 2. Risk control. #1224 documented that direct navigation to
+        //    search_result?keyword=... triggers Xiaohongshu's security verification in
+        //    the automation browser; xiaohongshu/search was reworked away from that
+        //    exact pattern. ask still used it.
+        //
+        // Controlled A/B, identical query ("清迈 咖啡馆 推荐"), same session, minutes apart:
+        //    search_result -> 1238 chars, 5 sources, 1x search/notes
+        //    /ai_chat      -> 1195 chars, 5 sources, 0x search/notes
+        // The navig
```

**File**: `clis/xiaohongshu/ask.test.js` (modified, +71/-1)
```diff
@@ -197,7 +197,10 @@ describe('xiaohongshu ask', () => {
 
         const result = await cmd.func(page, { query: '上海露营需要注意什么？', timeout: 30, 'source-limit': 10 });
 
-        expect(page.goto).toHaveBeenCalledWith(expect.stringContaining('https://www.xiaohongshu.com/search_result?keyword='));
+        // 点点's own page, never search_result?keyword=... — that URL costs a real
+        // note search on load and is the pattern #1224 tied to security verification.
+        expect(page.goto).toHaveBeenCalledWith('https://www.xiaohongshu.com/ai_chat');
+        expect(page.goto).not.toHaveBeenCalledWith(expect.stringContaining('search_result'));
         expect(page.evaluate.mock.calls[0][0]).toContain('window.webpackChunkxhs_pc_web');
         expect(result).toMatchObject({
             answer: '答案正文',
@@ -265,3 +268,70 @@ describe('xiaohongshu ask', () => {
         expect(script).not.toContain('rounds[rounds.length - 1]');
     });
 });
+
+// Executes the generated page script against a fake webpack runtime, so the module
+// lookup is exercised for real rather than asserted as a substring. The point is the
+// module id: Xiaohongshu renumbers chunks on redeploys (6404 -> 32914 broke every ask),
+// so the lookup has to survive an id nobody has seen before.
+async function runAskScriptAgainstFakeRuntime({ moduleId, answer = '答案正文' }) {
+    const msgId = 'msg-1';
+    const store = {
+        switchScene: () => {},
+        clearConversation: () => {},
+        createConversation: () => {},
+        sendMessage: async () => msgId,
+        getSceneRounds: () => [{ aiMessage: { msgId, isFinished: true, text: answer } }],
+        agent: {
+            getResponseReferences: async () => ({
+                baseInfo: { totalCnt: 'ai总结7篇笔记生成' },
+                items: [{ id: '69d6fc08000000001f007646', title: '来源标题', nickName: '作者A' }],
+            }),
+        },
+    };
+    // toString() of this factory carries the fingerprint the scan looks for.
+    const conversationFactory = () => ({ marker: 'createConversation sendMessage' });
+    const decoyFactory = () => ({ marker: 'unrelated module' });
+    // moduleId === null models a build where the store is simply not present at all.
+    const exportsById = moduleId === null
+        ? {}
+        : { [moduleId]: { t: () => store, G: { AiChat: 'aiChat', Onebox: 'onebox' } } };
+    const webpackRequire = (id) => {
+        if (!(id in exportsById)) throw new TypeError("Cannot read properties of undefined (reading 'call')");
+        return exportsById[id];
+    };
+    webpackRequire.m = moduleId === null
+        ? { 4242: decoyFactory }
+        : { 4242: decoyFactory, [moduleId]: conversationFactory };
+
+    const priorWindow = globalThis.window;
+    const priorLocation = globalThis.location;
+    globalThis.window = {
+        webpackChunkxhs_pc_web: { push: ([, , cb]) => cb(webpackRequire) },
+    };
+    globalThis.location = { href: 'https://www.xiaohongshu.com/ai_chat' };
+    try {
+        return await (0, eval)(buildAskEvaluateJs('测试问题', 5, 5));
+    } finally {
+        globalThis.window = priorWindow;
+        globalThis.location = priorLocation;
+    }
+}
+
+describe('xiaohongshu ask conversation-store lookup', () => {
+    it('uses the known module id when the build still has it', async () => {
+        const result = await runAskScriptAgainstFakeRuntime({ moduleId: 32914 });
+        expect(result).toMatchObject({ ok: true, answer: '答案正文' });
+        expect(result.sources).toHaveLength(1);
+    });
+
+    it('still finds the store after Xiaohongshu renumbers the chunk', async () => {
+        // An id in neither the known list nor any previous build.
+        const result = await runAskScriptAgainstFakeRuntime({ moduleId: 778899 });
+        expect(result).toMatchObject({ ok: true, answer: '答案正文' });
+    });
+
+    it('reports conversation_store_missing when no module matches, instead of throwing', async () => {
+        const result = await runAskScriptAgains
```

---

### Incident Patch 3: `2a6929f8` (2026-08-29)
**Commit Message**: fix(linux-do): use current session for whoami (#2397)

* fix(linux-do): use current session for whoami

* test(linux-do): use generic identity fixture

**File**: `clis/linux-do/auth.js` (modified, +18/-9)
```diff
@@ -14,31 +14,40 @@ async function verifyLinuxDoIdentity(page) {
   await page.wait(2);
   const probe = await page.evaluate(`(async () => {
     try {
-      const u = document.querySelector('meta[name="current-user-username"]')?.getAttribute('content') || '';
-      if (!u) return { kind: 'auth', detail: 'Linux.do meta[current-user-username] missing — anonymous' };
-      const r = await fetch('/u/' + encodeURIComponent(u) + '.json', {
+      const r = await fetch('/session/current.json', {
         credentials: 'include',
         headers: { Accept: 'application/json' },
       });
       if (r.status === 401 || r.status === 403) {
-        return { kind: 'auth', detail: 'Linux.do /u/<self>.json HTTP ' + r.status };
+        return { kind: 'auth', detail: 'Linux.do /session/current.json HTTP ' + r.status };
       }
       if (!r.ok) return { kind: 'http', httpStatus: r.status };
       const d = await r.json();
-      const user = d?.user;
-      if (!user || !user.id) return { kind: 'auth', detail: 'Linux.do /u/<self>.json missing user.id' };
-      return { ok: true, user_id: String(user.id), username: String(user.username || u), name: String(user.name || '') };
+      const user = d?.current_user;
+      if (!user || !user.id || !user.username) {
+        return { kind: 'auth', detail: 'Linux.do /session/current.json missing current_user' };
+      }
+      return {
+        ok: true,
+        user_id: String(user.id),
+        username: String(user.username),
+        name: String(user.name || ''),
+      };
     } catch (e) {
       return { kind: 'exception', detail: String(e && e.message || e) };
     }
   })()`);
   if (probe?.kind === 'auth') throw new AuthRequiredError('linux.do', probe.detail);
-  if (probe?.kind === 'http') throw new CommandExecutionError(`HTTP ${probe.httpStatus} from Linux.do /u/<self>.json`);
+  if (probe?.kind === 'http') throw new CommandExecutionError(`HTTP ${probe.httpStatus} from Linux.do /session/current.json`);
   if (probe?.kind === 'exception') throw new CommandExecutionError(`Linux.do whoami failed: ${probe.detail}`);
-  if (!probe?.ok) throw new CommandExecutionError(`Unexpected Linux.do probe: ${JSON.stringify(probe)}`);
+  if (!probe?.ok || !probe.user_id || !probe.username) {
+    throw new CommandExecutionError(`Unexpected Linux.do probe: ${JSON.stringify(probe)}`);
+  }
   return { user_id: probe.user_id, username: probe.username, name: probe.name };
 }
 
+export const __test__ = { verifyLinuxDoIdentity };
+
 registerSiteAuthCommands({
   site: 'linux-do',
   domain: 'linux.do',
```

**File**: `clis/linux-do/auth.test.js` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+import { describe, expect, it, vi } from 'vitest';
+import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
+import { __test__ } from './auth.js';
+
+function makePage({ cookies = [{ name: '_t', value: 'session' }], probe } = {}) {
+  return {
+    getCookies: vi.fn().mockResolvedValue(cookies),
+    goto: vi.fn().mockResolvedValue(undefined),
+    wait: vi.fn().mockResolvedValue(undefined),
+    evaluate: vi.fn().mockResolvedValue(probe),
+  };
+}
+
+describe('linux-do auth identity probe', () => {
+  it('uses Discourse session/current.json instead of the removed username meta tag', async () => {
+    const page = makePage({
+      probe: { ok: true, user_id: '42', username: 'alice', name: '' },
+    });
+
+    await expect(__test__.verifyLinuxDoIdentity(page)).resolves.toEqual({
+      user_id: '42',
+      username: 'alice',
+      name: '',
+    });
+
+    const script = page.evaluate.mock.calls[0][0];
+    expect(script).toContain('/session/current.json');
+    expect(script).toContain('current_user');
+    expect(script).not.toContain('current-user-username');
+    expect(script).not.toContain("fetch('/u/'");
+  });
+
+  it('fails before navigation when the Linux.do session cookie is missing', async () => {
+    const page = makePage({ cookies: [] });
+
+    await expect(__test__.verifyLinuxDoIdentity(page)).rejects.toBeInstanceOf(AuthRequiredError);
+    expect(page.goto).not.toHaveBeenCalled();
+  });
+
+  it.each([
+    [{ kind: 'auth', detail: 'anonymous' }, AuthRequiredError],
+    [{ kind: 'http', httpStatus: 500 }, CommandExecutionError],
+    [{ kind: 'exception', detail: 'boom' }, CommandExecutionError],
+    [{ ok: true, username: 'alice', name: '' }, CommandExecutionError],
+  ])('maps malformed and failed probes to typed errors', async (probe, errorType) => {
+    const page = makePage({ probe });
+    await expect(__test__.verifyLinuxDoIdentity(page)).rejects.toBeInstanceOf(errorType);
+  });
+});
```

---

### Incident Patch 4: `75c85e57` (2026-08-29)
**Commit Message**: fix(xiaohongshu): retry once through a cooldown on risk-control soft blocks (#1825) (#2207)

Reading XHS note-detail pages (note / comments / download) back-to-back trips
velocity-based risk control: a soft block that redirects to
website-login/error?error_code=300017/300031 or renders "安全限制" /
"访问链接异常" (#1825, #962). Today the first block fails the command outright,
and an unattended loop keeps hammering — which escalates the risk state toward
the account-violation / ban path (#842, #677).

XHS soft blocks are frequently transient per-request challenges, so a single
reload after a real cooldown recovers many of them. Add a shared
`readXhsDetailPage` helper that navigates, settles, extracts, and — only on a
security block — waits one long randomized cooldown (8–18s) and reloads exactly
ONCE before surfacing SECURITY_BLOCK. The single-retry cap is structural (a
guarded `if`, no caller-tunable retry count) so it can never devolve into a
hammer loop; `retryOnBlock: false` opts into the previous fail-fast behavior.

note / comments / download now share this helper, replacing three copies of the
inline securityBlock detection. This does NOT throttle request velocity across
separate CLI 

**File**: `clis/xiaohongshu/comments.js` (modified, +12/-9)
```diff
@@ -6,8 +6,9 @@
  * the --with-replies flag.
  */
 import { cli, Strategy } from '@jackwener/opencli/registry';
-import { AuthRequiredError, CliError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
+import { AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
 import { parseNoteId, buildNoteUrl } from './note-helpers.js';
+import { readXhsDetailPage } from './risk-control.js';
 
 const XHS_PROFILE_HREF_SELECTOR = '.author-wrapper a[href*="/user/profile/"], a.name[href*="/user/profile/"], a.user-name[href*="/user/profile/"], a[href*="/user/profile/"]';
 
@@ -300,17 +301,19 @@ export const command = cli({
         const withReplies = Boolean(kwargs['with-replies']);
         const raw = String(kwargs['note-id']);
         const noteId = parseNoteId(raw);
-        await page.goto(buildNoteUrl(raw, { commandName: 'xiaohongshu comments' }));
-        await page.wait({ time: 2 + Math.random() * 3 });
-        const data = await page.evaluate(buildCommentsExtractJs(withReplies, limit));
+        // readXhsDetailPage paces the navigation and retries once through a
+        // cooldown if risk control soft-blocks the page (throws SECURITY_BLOCK
+        // when still blocked after the retry).
+        const data = await readXhsDetailPage(page, {
+            url: buildNoteUrl(raw, { commandName: 'xiaohongshu comments' }),
+            extractJs: buildCommentsExtractJs(withReplies, limit),
+            securityHelp: /^https?:\/\//.test(raw)
+                ? 'The page may be temporarily restricted. Try again later or from a different session.'
+                : 'Try using a full URL from search results (with xsec_token) instead of a bare note ID.',
+        });
         if (!data || typeof data !== 'object') {
             throw new EmptyResultError('xiaohongshu/comments', 'Unexpected evaluate response');
         }
-        if (data.securityBlock) {
-            throw new CliError('SECURITY_BLOCK', 'Xiaohongshu security block: the note detail page was blocked by risk control.', /^https?:\/\//.test(raw)
-                ? 'The page may be temporarily restricted. Try again later or from a different session.'
-                : 'Try using a full URL from search results (with xsec_token) instead of a bare note ID.');
-        }
         if (data.loginWall) {
             throw new AuthRequiredError('www.xiaohongshu.com', 'Note comments require login');
         }
```

**File**: `clis/xiaohongshu/download.js` (modified, +13/-8)
```diff
@@ -9,7 +9,8 @@
 import { cli, Strategy } from '@jackwener/opencli/registry';
 import { formatCookieHeader } from '@jackwener/opencli/download';
 import { downloadMedia } from '@jackwener/opencli/download/media-download';
-import { CliError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
+import { CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
+import { readXhsDetailPage } from './risk-control.js';
 import { buildNoteUrl, parseNoteId } from './note-helpers.js';
 /**
  * Build the media-extraction IIFE. The note id is interpolated as a default
@@ -219,14 +220,18 @@ export const command = cli({
         const rawInput = String(kwargs['note-id']);
         const output = kwargs.output;
         const noteId = parseNoteId(rawInput);
-        await page.goto(buildNoteUrl(rawInput, { allowShortLink: true, commandName: 'xiaohongshu download' }));
-        await page.wait({ time: 1 + Math.random() * 2 });
-        const data = await page.evaluate(buildDownloadExtractJs(noteId));
-        if (data?.securityBlock) {
-            throw new CliError('SECURITY_BLOCK', 'Xiaohongshu security block: the note detail page was blocked by risk control.', /^https?:\/\//.test(rawInput)
+        // readXhsDetailPage paces the navigation and retries once through a
+        // cooldown if risk control soft-blocks the page (throws SECURITY_BLOCK
+        // when still blocked after the retry).
+        const data = await readXhsDetailPage(page, {
+            url: buildNoteUrl(rawInput, { allowShortLink: true, commandName: 'xiaohongshu download' }),
+            extractJs: buildDownloadExtractJs(noteId),
+            securityHelp: /^https?:\/\//.test(rawInput)
                 ? 'The page may be temporarily restricted. Try again later or from a different session.'
-                : 'Try using a full URL from search results (with xsec_token) instead of a bare note ID.');
-        }
+                : 'Try using a full URL from search results (with xsec_token) instead of a bare note ID.',
+            settleMinS: 1,
+            settleMaxS: 3,
+        });
         if (!data || typeof data !== 'object' || !Array.isArray(data.media)) {
             throw new CommandExecutionError('Xiaohongshu media extraction returned malformed payload.');
         }
```

**File**: `clis/xiaohongshu/note.js` (modified, +12/-9)
```diff
@@ -7,8 +7,9 @@
  * Requires a full Xiaohongshu note URL with xsec_token.
  */
 import { cli, Strategy } from '@jackwener/opencli/registry';
-import { AuthRequiredError, CliError, EmptyResultError } from '@jackwener/opencli/errors';
+import { AuthRequiredError, EmptyResultError } from '@jackwener/opencli/errors';
 import { parseNoteId, buildNoteUrl } from './note-helpers.js';
+import { readXhsDetailPage } from './risk-control.js';
 /**
  * Host-agnostic IIFE that scrapes note title / author / counts / tags from a
  * rendered note detail page. Exported so the rednote adapter can reuse the
@@ -77,17 +78,19 @@ export const command = cli({
         const raw = String(kwargs['note-id']);
         const noteId = parseNoteId(raw);
         const url = buildNoteUrl(raw, { commandName: 'xiaohongshu note' });
-        await page.goto(url);
-        await page.wait({ time: 2 + Math.random() * 3 });
-        const data = await page.evaluate(NOTE_EXTRACT_JS);
+        // readXhsDetailPage paces the navigation and retries once through a
+        // cooldown if risk control soft-blocks the page (throws SECURITY_BLOCK
+        // when still blocked after the retry).
+        const data = await readXhsDetailPage(page, {
+            url,
+            extractJs: NOTE_EXTRACT_JS,
+            securityHelp: /^https?:\/\//.test(raw)
+                ? 'The page may be temporarily restricted. Try again later or from a different session.'
+                : 'Try using a full URL from search results (with xsec_token) instead of a bare note ID.',
+        });
         if (!data || typeof data !== 'object') {
             throw new EmptyResultError('xiaohongshu/note', 'Unexpected evaluate response');
         }
-        if (data.securityBlock) {
-            throw new CliError('SECURITY_BLOCK', 'Xiaohongshu security block: the note detail page was blocked by risk control.', /^https?:\/\//.test(raw)
-                ? 'The page may be temporarily restricted. Try again later or from a different session.'
-                : 'Try using a full URL from search results (with xsec_token) instead of a bare note ID.');
-        }
         if (data.loginWall) {
             throw new AuthRequiredError('www.xiaohongshu.com', 'Note content requires login');
         }
```

**File**: `clis/xiaohongshu/risk-control.js` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+import { CliError } from '@jackwener/opencli/errors';
+
+/**
+ * Xiaohongshu risk-control pacing shared by the note / comments / download
+ * detail-page commands.
+ *
+ * XHS gates note-detail navigation behind velocity-based risk control: reading a
+ * run of notes back-to-back trips a soft block that redirects to
+ * `website-login/error?error_code=300017` / `300031` or renders "安全限制" /
+ * "访问链接异常" (issues #1825, #962). Those soft blocks are frequently transient
+ * per-request challenges — a single reload after a real cooldown clears many of
+ * them. So instead of failing on the first block, retry ONCE after a long
+ * randomized cooldown.
+ *
+ * The retry is deliberately capped at one: hammering a hot risk state is exactly
+ * what escalates it toward the account-violation / ban path (#842, #677). This
+ * helper only makes each read gentler and recovers transient blocks — it does
+ * NOT cap request velocity across separate CLI invocations (that needs
+ * session-level throttling, tracked as a follow-up).
+ */
+
+/** Randomized delay in seconds within [minS, maxS]. `rand` is injectable for tests. */
+export function jitterSeconds(minS, maxS, rand = Math.random) {
+    return minS + rand() * (maxS - minS);
+}
+
+/** A detail-page extract payload signals risk control via `securityBlock: true`. */
+export function isSecurityBlock(data) {
+    return Boolean(data && typeof data === 'object' && !Array.isArray(data) && data.securityBlock);
+}
+
+/**
+ * Navigate to a XHS detail page and run `extractJs`, retrying once through a long
+ * randomized cooldown when risk control soft-blocks the page. Returns the extract
+ * payload (never a security-block payload — that path throws SECURITY_BLOCK after
+ * the single retry is exhausted). Callers keep their own loginWall / notFound /
+ * shape handling on the returned payload.
+ *
+ * @param {object} page Browser Bridge page handle.
+ * @param {object} opts
+ * @param {string} opts.url            Fully-built note/detail URL to navigate to.
+ * @param {string} opts.extractJs      Page-side extraction IIFE returning `{ securityBlock, ... }`.
+ * @param {string} [opts.securityHelp] Hint attached to the thrown SECURITY_BLOCK error.
+ * @param {number} [opts.settleMinS]   Min settle delay after navigation (seconds).
+ * @param {number} [opts.settleMaxS]   Max settle delay after navigation (seconds).
+ * @param {boolean} [opts.retryOnBlock] Do the single cooldown reload on a soft block (default true); false = fail fast.
+ * @param {number} [opts.cooldownMinS] Min cooldown before the retry (seconds).
+ * @param {number} [opts.cooldownMaxS] Max cooldown before the retry (seconds).
+ * @param {() => number} [opts.rand]   Injectable RNG for deterministic tests.
+ */
+export async function readXhsDetailPage(page, {
+    url,
+    extractJs,
+    securityHelp,
+    settleMinS = 2,
+    settleMaxS = 5,
+    retryOnBlock = true,
+    cooldownMinS = 8,
+    cooldownMaxS = 18,
+    rand = Math.random,
+} = {}) {
+    const readOnce = async () => {
+        await page.goto(url);
+        await page.wait({ time: jitterSeconds(settleMinS, settleMaxS, rand) });
+        return page.evaluate(extractJs);
+    };
+
+    let data = await readOnce();
+    // At most ONE retry — a single `if`, never a loop. Hammering a hot risk state
+    // is exactly what escalates it toward account-violation / ban (#842, #677),
+    // so the one-cooldown-reload cap is enforced structurally, not by a caller's
+    // choice of retry count.
+    if (retryOnBlock && isSecurityBlock(data)) {
+        await page.wait({ time: jitterSeconds(cooldownMinS, cooldownMaxS, rand) });
+        data = await readOnce();
+    }
+
+    if (isSecurityBlock(data)) {
+        throw new CliError(
+            'SECURITY_BLOCK',
+            'Xiaohongshu security block: the note detail page was blocked by risk control.',
+            securityHelp,
+        );
+    }
+    return data;
+}
+
+export const __test__ = { jitterSec
```

**File**: `clis/xiaohongshu/risk-control.test.js` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+import { describe, expect, it, vi } from 'vitest';
+import { CliError } from '@jackwener/opencli/errors';
+import { __test__ } from './risk-control.js';
+
+const { jitterSeconds, isSecurityBlock, readXhsDetailPage } = __test__;
+
+function makePage(evaluateResults) {
+    let i = 0;
+    return {
+        goto: vi.fn().mockResolvedValue(undefined),
+        wait: vi.fn().mockResolvedValue(undefined),
+        evaluate: vi.fn().mockImplementation(() =>
+            Promise.resolve(evaluateResults[Math.min(i++, evaluateResults.length - 1)])),
+    };
+}
+
+describe('xiaohongshu risk-control jitterSeconds', () => {
+    it('stays within [min, max] and tracks rand', () => {
+        expect(jitterSeconds(2, 5, () => 0)).toBe(2);
+        expect(jitterSeconds(2, 5, () => 1)).toBe(5);
+        expect(jitterSeconds(2, 5, () => 0.5)).toBe(3.5);
+        const v = jitterSeconds(8, 18); // real Math.random
+        expect(v).toBeGreaterThanOrEqual(8);
+        expect(v).toBeLessThanOrEqual(18);
+    });
+});
+
+describe('xiaohongshu risk-control isSecurityBlock', () => {
+    it('is true only for a plain object flagged securityBlock', () => {
+        expect(isSecurityBlock({ securityBlock: true })).toBe(true);
+        expect(isSecurityBlock({ securityBlock: false })).toBe(false);
+        expect(isSecurityBlock({})).toBe(false);
+        expect(isSecurityBlock(null)).toBe(false);
+        expect(isSecurityBlock(undefined)).toBe(false);
+        expect(isSecurityBlock([{ securityBlock: true }])).toBe(false); // arrays are not payloads
+        expect(isSecurityBlock('securityBlock')).toBe(false);
+    });
+});
+
+describe('xiaohongshu risk-control readXhsDetailPage', () => {
+    const url = 'https://www.xiaohongshu.com/search_result/abc?xsec_token=tok';
+    const extractJs = '(() => ({}))()';
+
+    it('returns the payload on first read without any cooldown when not blocked', async () => {
+        const page = makePage([{ title: 'ok', securityBlock: false }]);
+        const data = await readXhsDetailPage(page, { url, extractJs, rand: () => 0.5 });
+        expect(data).toEqual({ title: 'ok', securityBlock: false });
+        expect(page.goto).toHaveBeenCalledTimes(1);
+        expect(page.evaluate).toHaveBeenCalledTimes(1);
+        // only the settle wait, no cooldown
+        expect(page.wait).toHaveBeenCalledTimes(1);
+    });
+
+    it('recovers a transient soft-block with a single cooldown retry', async () => {
+        const page = makePage([{ securityBlock: true }, { title: 'recovered', securityBlock: false }]);
+        const data = await readXhsDetailPage(page, { url, extractJs, rand: () => 0.5 });
+        expect(data).toEqual({ title: 'recovered', securityBlock: false });
+        // re-navigated + re-extracted exactly once more
+        expect(page.goto).toHaveBeenCalledTimes(2);
+        expect(page.evaluate).toHaveBeenCalledTimes(2);
+        // a long cooldown wait happened between the two reads: 8 + 0.5*(18-8) = 13
+        expect(page.wait).toHaveBeenCalledWith({ time: 13 });
+    });
+
+    it('throws SECURITY_BLOCK (with the hint) when still blocked after the one retry — never hammers', async () => {
+        const page = makePage([{ securityBlock: true }, { securityBlock: true }, { securityBlock: true }]);
+        await expect(readXhsDetailPage(page, {
+            url,
+            extractJs,
+            securityHelp: 'Try again later or from a different session.',
+            rand: () => 0.5,
+        })).rejects.toMatchObject({
+            code: 'SECURITY_BLOCK',
+            hint: 'Try again later or from a different session.',
+        });
+        // exactly one retry — goto/evaluate called twice, not more
+        expect(page.goto).toHaveBeenCalledTimes(2);
+        expect(page.evaluate).toHaveBeenCalledTimes(2);
+    });
+
+    it('fails fast without a retry when retryOnBlock is false', async () => {
+        const page = makePage([{ securityBlock: true }, { title: 'never reached', 
```

---

### Incident Patch 5: `1c66cc9e` (2026-08-29)
**Commit Message**: fix(errors): duck-typing for cross-package CliError in toEnvelope (#2388)

* fix(errors): duck-typing for cross-package CliError in toEnvelope

Plugins resolve their own copy of @jackwener/opencli (own node_modules), so
 fails across package copies and every plugin error
degrades to code: UNKNOWN with the hint lost. Switch to shape-based detection
(code + message strings, optional hint) — real CliError instances behave
identically, plain Errors still map to UNKNOWN.

Also serializes error-like plain objects carrying code/message. Adds tests
for the cross-package shape, plain-object passthrough, and UNKNOWN fallback.

* fix(errors): require exitCode when duck-typing CliError

The shape check accepted any object with string code+message, which also
matches Node system errors (ENOENT, ECONNREFUSED, EACCES) and library
errors carrying a string code. Those would surface their errno as the
envelope code, widening the machine-readable contract callers switch on:

  before this commit: ENOENT -> code "ENOENT"
  intended/base:      ENOENT -> code "UNKNOWN"

CliError's constructor always assigns exitCode (defaulting to
GENERIC_ERROR) while Node system errors never do, so requiring a numeric


**File**: `src/errors.test.ts` (modified, +42/-0)
```diff
@@ -119,6 +119,48 @@ describe('toEnvelope', () => {
     expect(envelope.error.message).toBe('string error');
   });
 
+
+  it('passes through cross-package CliError copies (duck-typed shape)', () => {
+    // Simulates a CliError thrown by a plugin that resolves its own copy of
+    // @jackwener/opencli — different class identity, same shape.
+    class ForeignCliError extends Error {
+      code = 'INVALID_ARGS';
+      hint: string | undefined;
+      // A real CliError always assigns exitCode in its constructor, so a
+      // faithful cross-package copy carries it too.
+      exitCode = 2;
+      constructor(message: string, hint?: string) {
+        super(message);
+        this.name = 'CliError';
+        this.hint = hint;
+      }
+    }
+    const envelope = toEnvelope(new ForeignCliError('bad file', 'pass a real path'));
+    expect(envelope.error.code).toBe('INVALID_ARGS');
+    expect(envelope.error.help).toBe('pass a real path');
+    expect(envelope.error.message).toBe('bad file');
+  });
+
+  it('does not treat a bare {code,message} object as a CliError', () => {
+    // No exitCode => not CliError-shaped. Accepting these would let any
+    // foreign string `code` into the envelope contract.
+    const envelope = toEnvelope({ code: 'FORBIDDEN', message: 'scope violation' });
+    expect(envelope.error.code).toBe('UNKNOWN');
+  });
+
+  it('keeps Node system errors as UNKNOWN instead of surfacing their errno', () => {
+    // fs/net errors have a string `code` and `message` but no exitCode.
+    // Reporting `ENOENT` as the envelope code would widen the machine-readable
+    // contract that callers switch on.
+    const enoent = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
+    expect(toEnvelope(enoent).error.code).toBe('UNKNOWN');
+  });
+
+  it('keeps UNKNOWN for Errors without a code', () => {
+    const envelope = toEnvelope(new Error('random failure'));
+    expect(envelope.error.code).toBe('UNKNOWN');
+  });
+
   it('serializes deep cause chains without stack overflow', () => {
     // Build a 20-level deep cause chain — should truncate at depth 10
     let deepErr: Error = new Error('root');
```

**File**: `src/errors.ts` (modified, +22/-5)
```diff
@@ -257,14 +257,31 @@ export function toEnvelope(err: unknown): ErrorEnvelope {
     receiptPath: traceReceipt.receiptPath,
     status: traceReceipt.status,
   } : undefined;
-  if (err instanceof CliError) {
+  // Duck typing: accept own CliError instances AND cross-package copies that
+  // carry the same shape. `instanceof` fails when the throwing module resolves
+  // a different copy of @jackwener/opencli (e.g. a plugin with its own
+  // node_modules) — those errors used to degrade to UNKNOWN and lose `hint`.
+  //
+  // `exitCode` is the discriminator: CliError's constructor always assigns it
+  // (defaulting to GENERIC_ERROR), while Node system errors carry a string
+  // `code` (ENOENT, ECONNREFUSED, EACCES) and a string `message` but never an
+  // `exitCode`. Without this check those would be reported with their errno as
+  // the envelope `code`, silently widening the contract that callers switch on.
+  const isCliErrorLike =
+    err !== null &&
+    typeof err === 'object' &&
+    typeof (err as any).code === 'string' &&
+    typeof (err as any).message === 'string' &&
+    typeof (err as any).exitCode === 'number';
+  if (err instanceof CliError || isCliErrorLike) {
+    const e = err as any;
     return {
       ok: false,
       error: {
-        code: err.code,
-        message: err.message,
-        ...(err.hint ? { help: err.hint } : {}),
-        exitCode: err.exitCode,
+        code: e.code,
+        message: e.message,
+        ...(typeof e.hint === 'string' && e.hint ? { help: e.hint } : {}),
+        exitCode: e.exitCode ?? EXIT_CODES.GENERIC_ERROR,
         ...(cause ? { cause } : {}),
       },
       ...(trace ? { trace } : {}),
```

---

### Incident Patch 6: `4e8109b6` (2026-08-29)
**Commit Message**: fix: honor manual CDP endpoint for web adapters (#2148)

**File**: `src/runtime.test.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import { BrowserBridge, CDPBridge } from './browser/index.js';
+import { getBrowserFactory } from './runtime.js';
+
+describe('getBrowserFactory', () => {
+  afterEach(() => {
+    vi.unstubAllEnvs();
+  });
+
+  it('uses BrowserBridge for regular sites by default', () => {
+    expect(getBrowserFactory('xianyu')).toBe(BrowserBridge);
+  });
+
+  it('uses CDPBridge when OPENCLI_CDP_ENDPOINT is configured', () => {
+    vi.stubEnv('OPENCLI_CDP_ENDPOINT', 'http://127.0.0.1:9333');
+
+    expect(getBrowserFactory('xianyu')).toBe(CDPBridge);
+  });
+});
```

**File**: `src/runtime.ts` (modified, +4/-2)
```diff
@@ -7,10 +7,12 @@ import { DEFAULT_BROWSER_COMMAND_TIMEOUT, DEFAULT_BROWSER_CONNECT_TIMEOUT } from
 export { DEFAULT_BROWSER_COMMAND_TIMEOUT, DEFAULT_BROWSER_CONNECT_TIMEOUT };
 
 /**
- * Returns the appropriate browser factory based on site type.
- * Uses CDPBridge for registered Electron apps, otherwise BrowserBridge.
+ * Returns the appropriate browser factory based on explicit configuration and site type.
+ * A manual CDP endpoint takes precedence, registered Electron apps use CDPBridge,
+ * and all other sites use BrowserBridge.
  */
 export function getBrowserFactory(site?: string): new () => IBrowserFactory {
+  if (process.env.OPENCLI_CDP_ENDPOINT) return CDPBridge;
   if (site && isElectronApp(site)) return CDPBridge;
   return BrowserBridge;
 }
```

---

### Incident Patch 7: `25dece3f` (2026-08-29)
**Commit Message**: fix(pipeline): reject invalid concurrency limits (#2407)

**File**: `src/pipeline/steps/fetch.test.ts` (modified, +15/-1)
```diff
@@ -1,5 +1,5 @@
 import { afterEach, describe, expect, it, vi } from 'vitest';
-import { CliError } from '../../errors.js';
+import { ArgumentError, CliError } from '../../errors.js';
 import type { IPage } from '../../types.js';
 import { stepFetch } from './fetch.js';
 
@@ -92,6 +92,20 @@ describe('stepFetch', () => {
     expect(jsonMock).not.toHaveBeenCalled();
   });
 
+  it('rejects invalid browser batch concurrency before evaluating page code', async () => {
+    const page = {
+      evaluate: vi.fn(),
+    } as unknown as IPage;
+
+    await expect(stepFetch(
+      page,
+      { url: 'https://api.example.com/items/${{ item.id }}', concurrency: 0 },
+      [{ id: 1 }],
+      {},
+    )).rejects.toBeInstanceOf(ArgumentError);
+    expect(page.evaluate).not.toHaveBeenCalled();
+  });
+
   it('stringifies non-Error batch browser failures consistently', async () => {
     vi.stubGlobal('fetch', vi.fn().mockRejectedValue('socket hang up'));
 
```

**File**: `src/pipeline/steps/fetch.ts` (modified, +4/-1)
```diff
@@ -2,7 +2,7 @@
  * Pipeline step: fetch — HTTP API requests.
  */
 
-import { CliError, getErrorMessage } from '../../errors.js';
+import { ArgumentError, CliError, getErrorMessage } from '../../errors.js';
 import { log } from '../../logger.js';
 import type { IPage } from '../../types.js';
 import { render } from '../template.js';
@@ -95,6 +95,9 @@ export async function stepFetch(page: IPage | null, params: unknown, data: unkno
   // Per-item fetch when data is array and URL references item
   if (Array.isArray(data) && urlTemplate.includes('item')) {
     const concurrency = typeof paramObject.concurrency === 'number' ? paramObject.concurrency : 5;
+    if (!Number.isInteger(concurrency) || concurrency < 1) {
+      throw new ArgumentError(`Concurrency limit must be a positive integer. Received: "${String(concurrency)}"`);
+    }
 
     // Render all URLs upfront
     const renderedHeaders: Record<string, string> = {};
```

**File**: `src/utils.test.ts` (modified, +13/-1)
```diff
@@ -1,11 +1,12 @@
 import { describe, it, expect } from 'vitest';
 import {
+  mapConcurrent,
   parseJsonOrThrowLoginWall,
   throwIfLoginWall,
   BROWSER_JSON_SNIFF_FN,
   type LoginWallSignal,
 } from './utils.js';
-import { LoginWallError } from './errors.js';
+import { ArgumentError, LoginWallError } from './errors.js';
 
 function makeResponse(body: string, opts: { status?: number; contentType?: string; url?: string } = {}): Response {
   return new Response(body, {
@@ -14,6 +15,17 @@ function makeResponse(body: string, opts: { status?: number; contentType?: strin
   });
 }
 
+describe('mapConcurrent', () => {
+  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
+    'rejects invalid concurrency limit %s instead of skipping work',
+    async (limit) => {
+      const worker = async (value: number) => value * 2;
+
+      await expect(mapConcurrent([1, 2], limit, worker)).rejects.toBeInstanceOf(ArgumentError);
+    },
+  );
+});
+
 describe('parseJsonOrThrowLoginWall', () => {
   it('returns parsed JSON on a normal application/json response', async () => {
     const res = makeResponse(JSON.stringify({ hello: 'world', n: 42 }));
```

**File**: `src/utils.ts` (modified, +5/-1)
```diff
@@ -5,7 +5,7 @@
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 import TurndownService from 'turndown';
-import { LoginWallError } from './errors.js';
+import { ArgumentError, LoginWallError } from './errors.js';
 
 /** Type guard: checks if a value is a non-null, non-array object. */
 export function isRecord(value: unknown): value is Record<string, unknown> {
@@ -18,6 +18,10 @@ export async function mapConcurrent<T, R>(
   limit: number,
   fn: (item: T, index: number) => Promise<R>,
 ): Promise<R[]> {
+  if (!Number.isInteger(limit) || limit < 1) {
+    throw new ArgumentError(`Concurrency limit must be a positive integer. Received: "${String(limit)}"`);
+  }
+
   const results: R[] = new Array(items.length);
   let index = 0;
 
```

---

### Incident Patch 8: `49907e53` (2026-08-28)
**Commit Message**: fix(dribbble): distinguish empty states from selector drift (#2423)

* fix(dribbble): distinguish empty states from drift

* fix(dribbble): handle promoted and nested list items

---------

Co-authored-by: OpenCLI-sol <opencli-sol@users.noreply.github.com>

**File**: `clis/dribbble/dribbble.test.js` (modified, +169/-1)
```diff
@@ -126,6 +126,32 @@ describe('dribbble production DOM extractors', () => {
         }]);
     });
 
+    it('skips explicit promoted cards and keeps canonical absolute shot URLs', async () => {
+        const page = pageFor(`
+          <main id="content">
+            <li id="screenshot-ad" data-thumbnail-id="ad">
+              <a href="https://sponsor.example/campaign">Sponsored design</a>
+              <a href="/advertise">Advertise</a>
+            </li>
+            <li id="screenshot-27611165" data-thumbnail-id="27611165">
+              <img alt="Cabin seat map" src="https://cdn.example/shot.png">
+              <a href="https://dribbble.com/shots/27611165-Pick-Your-Seat">View shot</a>
+              <a href="/shots/27611165-Pick-Your-Seat/bucketings/new">Save shot</a>
+              <div class="user-information"><a href="/mondaysys">Mondaysys</a></div>
+            </li>
+          </main>
+        `, 'https://dribbble.com/search/shots/popular?q=mobile');
+
+        await expect(command('shot').func(page, {
+            query: 'mobile', sort: 'popular', limit: 1,
+        })).resolves.toEqual([expect.objectContaining({
+            rank: 1,
+            id: '27611165',
+            title: 'Cabin seat map',
+            url: 'https://dribbble.com/shots/27611165-Pick-Your-Seat',
+        })]);
+    });
+
     it('extracts the exact profile heading and rich about fields without badge text', () => {
         const payload = runInDom(extractProfileRow, `
           <div class="profile-masthead" data-profile-masthead-container>
@@ -245,6 +271,148 @@ describe('dribbble production DOM extractors', () => {
             'https://dribbble.com/shots/999999999')).toMatchObject({ ok: true, empty: true });
     });
 
+    it('distinguishes an explicit empty shot page from shot-card selector drift', async () => {
+        const emptyPage = pageFor(`
+          <body id="search-results">
+            <div id="wrap"><div class="no-results">No results found</div></div>
+            <main id="content"></main>
+          </body>
+        `,
+            'https://dribbble.com/search/shots/popular?q=missing');
+        await expect(command('shot').func(emptyPage, {
+            query: 'missing', sort: 'popular', limit: 1,
+        })).rejects.toMatchObject({ code: 'EMPTY_RESULT' });
+
+        const driftPage = pageFor('<main id="content"></main>',
+            'https://dribbble.com/search/shots/popular?q=mobile');
+        await expect(command('shot').func(driftPage, {
+            query: 'mobile', sort: 'popular', limit: 1,
+        })).rejects.toMatchObject({ code: 'COMMAND_EXEC' });
+
+        const unrelatedMarkerPage = pageFor(`
+          <div class="no-results">Unrelated component</div><main id="content"></main>
+        `, 'https://dribbble.com/search/shots/popular?q=mobile');
+        await expect(command('shot').func(unrelatedMarkerPage, {
+            query: 'mobile', sort: 'popular', limit: 1,
+        })).rejects.toMatchObject({ code: 'COMMAND_EXEC' });
+    });
+
+    it('distinguishes completed empty designer results from card selector drift', async () => {
+        const emptyPage = pageFor(`
+          <div class="designer-search-results">
+            <drb-infinite-scroll data-designer-search-infinite-scroll disabled></drb-infinite-scroll>
+          </div>
+        `, 'https://dribbble.com/hire?keywords=missing');
+        await expect(command('designer').func(emptyPage, {
+            query: 'missing', limit: 1,
+        })).rejects.toMatchObject({ code: 'EMPTY_RESULT' });
+
+        const driftPage = pageFor('<div class="designer-search-results"></div>',
+            'https://dribbble.com/hire?keywords=product');
+        await expect(command('designer').func(driftPage, {
+            query: 'product', limit: 1,
+        })).rejects.toMatchObject({ code: 'COMMAND_EXEC' });
+    });
+
+    it('distinguishes empty profile tabs from service and collection selector drift', async () => {
+        const emptyService = page
```

**File**: `clis/dribbble/utils.js` (modified, +88/-24)
```diff
@@ -124,15 +124,44 @@ export function extractShotRows(limit) {
     if (!root) {
         return { ok: false, reason: 'shot result root was not found', title: document.title || '' };
     }
+    const searchEmpty = /^\/search\/shots\/(?:following|popular|recent)\/?$/.test(document.location.pathname)
+        && document.body?.id === 'search-results'
+        && document.querySelector('#wrap > .no-results');
+    const portfolioEmpty = /^\/[A-Za-z0-9_-]+\/(?:shots|likes)\/?$/.test(document.location.pathname)
+        && root.querySelector('.empty-shots-list');
+    if (cards.length === 0 && !searchEmpty && !portfolioEmpty) {
+        return { ok: false, reason: 'shot cards and the empty-state marker were not found', title: document.title || '' };
+    }
 
-    const rows = cards.map((el, index) => {
-        const shotLink = [...el.querySelectorAll('a[href]')]
-            .find((anchor) => /^\/shots\/\d+(?:-|\/|$)/.test(anchor.getAttribute('href') || ''));
-        if (!shotLink) return null;
+    const parsedCards = cards.map((el) => {
+        const anchors = [...el.querySelectorAll('a[href]')];
+        const shotLink = anchors.find((anchor) => {
+            try {
+                const target = new URL(anchor.getAttribute('href') || '', location.href);
+                return /(^|\.)dribbble\.com$/i.test(target.hostname)
+                    && /^\/shots\/\d+(?:-[^/]+)?\/?$/.test(target.pathname);
+            } catch {
+                return false;
+            }
+        });
+        if (!shotLink) {
+            const hasOutboundTarget = anchors.some((anchor) => {
+                try {
+                    return !/(^|\.)dribbble\.com$/i.test(
+                        new URL(anchor.getAttribute('href') || '', location.href).hostname,
+                    );
+                } catch {
+                    return false;
+                }
+            });
+            const isPromoted = hasOutboundTarget
+                && anchors.some((anchor) => /^\/advertise\/?$/.test(anchor.getAttribute('href') || ''));
+            return { promoted: isPromoted };
+        }
         const profileLink = el.querySelector('.user-information a[href], a[data-search-profile-clicked][href]');
         const image = el.querySelector('img');
-        return {
-            rank: index + 1,
+        const row = {
+            rank: 0,
             id: clean(el.getAttribute('data-thumbnail-id') || el.id.replace(/^screenshot-/, '')),
             title: clean(el.querySelector('.shot-title')?.textContent || image?.getAttribute('alt') || ''),
             designer: clean(profileLink?.textContent || ''),
@@ -141,9 +170,19 @@ export function extractShotRows(limit) {
             imageUrl: clean(image?.currentSrc || image?.getAttribute('src') || image?.getAttribute('data-src') || ''),
             url: new URL(shotLink.getAttribute('href'), location.href).href,
         };
-    }).filter((row) => row && row.id && row.title && row.url);
+        return { row };
+    });
+    if (parsedCards.some((card) => !card.promoted && (!card.row || !card.row.id || !card.row.title || !card.row.url))) {
+        return { ok: false, reason: 'one or more shot cards were missing required identity fields' };
+    }
+    const parsedRows = parsedCards
+        .flatMap((card) => card.row ? [card.row] : [])
+        .map((row, index) => ({ ...row, rank: index + 1 }));
+    if (parsedRows.length === 0 && cards.length > 0) {
+        return { ok: false, reason: 'shot results contained only promoted cards' };
+    }
 
-    return { ok: true, rows: rows.slice(0, limit) };
+    return { ok: true, rows: parsedRows.slice(0, limit) };
 }
 
 export function extractDesignerRows(limit) {
@@ -157,8 +196,11 @@ export function extractDesignerRows(limit) {
     if (!root) {
         return { ok: false, reason: 'designer result root was not found', title: document.title || '' };
     }
+    if (cards.length === 0 && !root.querySelector('[data-designer-search-infinite-scroll][disabl
```

---

### Incident Patch 9: `c9fb444c` (2026-08-28)
**Commit Message**: chore(pack): exclude test files and fixtures from npm package (#2410)

The published tarball ships 601 compiled *.test.js files, ~100 *.test.d.ts,
stray *.test.ts sources, and clis/**/__fixtures__/ HTML snapshots — none of
which are used at runtime. Excluding them shrinks the package from 2340 to
1638 files and from 14.0 MB to 9.2 MB unpacked (tarball 3.1 MB -> 2.2 MB),
which noticeably speeds up npm install.

Verified with npm pack --dry-run against the extracted 1.8.7 tarball
contents: no .test.* or __fixtures__ entries remain.

Co-authored-by: exe.dev user <exedev@koala-fife.exe.xyz>
Co-authored-by: Claude Fable 5 <noreply@anthropic.com>

**File**: `package.json` (modified, +3/-1)
```diff
@@ -37,7 +37,9 @@
     "cli-manifest.json",
     "scripts/",
     "README.md",
-    "LICENSE"
+    "LICENSE",
+    "!**/*.test.*",
+    "!**/__fixtures__/"
   ],
   "scripts": {
     "dev": "tsx src/main.ts",
```

---

### Incident Patch 10: `50902ffe` (2026-08-26)
**Commit Message**: fix(browser): preserve structured network captures (#2406)

* fix(browser): preserve structured network captures

* test(browser): cover direct CDP request capture

* fix(browser): redact credential-shaped request values

* fix(browser): redact bare CSRF request fields

---------

Co-authored-by: OpenCLI-sol <opencli-sol@users.noreply.github.com>

**File**: `skills/opencli-adapter-author/references/api-discovery.md` (modified, +4/-2)
```diff
@@ -57,7 +57,7 @@ opencli browser network
 - `shape` — response body 的路径→类型映射（不含原 body，省 token）
 - `status / url / method / ct / size`
 
-静态资源 / 埋点 / 追踪默认已过滤。默认会保留 JSON / XML / plain text / `text/javascript` 这类 API 响应；如果你确定浏览器 DevTools 里有目标请求但这里缺失，用 `--all` 查一遍是否被 content-type 或 URL 噪音过滤挡掉。
+静态资源 / 埋点 / 追踪默认已过滤。默认会保留 JSON / XML / plain text / `text/javascript`，也会识别 `text/x-component` 与明确的 `/rsc-action/` React Server Component 流。如果你确定浏览器 DevTools 里有目标请求但这里缺失，用 `--all` 查一遍是否被其他 content-type 或 URL 噪音过滤挡掉。capture queue 是破坏性读取；Core 会先缓存本批原始条目再做展示过滤，所以紧接着的空 `--all` 仍可复用该 session 的 raw cache，而不是永久丢掉被隐藏的条目。
 
 如果是冷启动，先看 `opencli browser analyze <url>` 里的 `api_candidates`：
 
@@ -102,11 +102,13 @@ opencli browser network --detail <key>
 
 capture 会持久化到 `~/.opencli/cache/browser-network/<session>.json`（默认 TTL 24h），所以 `--detail` 即使跨多条其他命令也还在。
 
+`--detail` 还会在 capture provider 支持时返回 `request`：method 仍在顶层；headers 中 cookie、Authorization、CSRF/XSRF、token/key/secret/session 等值会替换为 `<redacted>`；可安全识别的 JSON object / URL-encoded form 会保留结构，位置数组、opaque 或截断 body 只保留 kind、shape、full size、truncated/omitted 状态。不要因为 body 被安全省略就拿 URL 单独 replay——这说明请求合同仍不完整。
+
 这也意味着私有页面的 response 可能落在本地 cache。侦察结束要删除相关 session capture 并释放 browser session；不要依赖 24h TTL 代替清理。
 
 ### 关键 request headers
 
-`browser network` 当前只抓响应（body + status + ct），抓不到请求头。要看请求头就在 DevTools Network 面板里点这条 request，或用 `browser eval` 手动 `fetch(url)` 复现一次观察浏览器发出去的头：
+先用 `browser network --detail <key>` 看脱敏后的 request headers / body shape；不要打印或复制 credential 原值。旧 capture provider 若没有返回 `request`，再去 DevTools Network 面板核字段名，或用页面自然动作重新 capture，不能用 `browser eval` 猜造一份缺 header/body 的 URL-only 请求：
 
 | 看到 | 含义 | 对应策略 |
 |------|------|---------|
```

**File**: `skills/opencli-adapter-author/references/deep-recon.md` (modified, +8/-0)
```diff
@@ -34,6 +34,8 @@ Never paste credentials or response bodies into the ledger. Store structural fac
 
 Dynamic evidence proves that a request occurred. Static scanning expands recall to lazy pagination, detail, search, and routes that this session did not trigger. Neither alone proves a production contract.
 
+Do not equate “structured” with JSON. React Server Components (`text/x-component`), streamed HTML fragments, protobuf-like payloads, and positional arrays may carry the authoritative data. Preserve their content type, request context, truncation state, and structural shape even when the default network view would normally hide them.
+
 jsluice is optional and stays outside adapter runtime. Feed it script text through stdin, keep source locations, and treat `EXPR` as unknown. Do not persist suspected secret values. A candidate becomes useful only after dynamic occurrence or a safe replay verifies its shape and semantics.
 
 ## 4. Attribute requests with causal diffs
@@ -74,6 +76,8 @@ A read contract must prove all of these:
 5. **Auth boundary**: cookies/CSRF/origin/runtime requirements are explicit and do not leak secrets.
 6. **Failure semantics**: auth, HTTP, malformed/truncated body, repeated cursor/page, timeout, and partial data fail typed.
 
+Replay the complete request contract, not a URL-shaped fragment. A captured URL returning 4xx/5xx does not reject the underlying endpoint when headers, body, cookies, runtime action identifiers, or page-owned signing were omitted. Record the missing context and use `INTERCEPT` until it can be reproduced safely; never guess absent request fields from a bundle string.
+
 A direct API-backed write contract additionally must prove:
 
 1. target identity is deterministically bound in the request;
@@ -90,13 +94,17 @@ A direct API-backed write contract additionally must prove:
 Browser capture queues may be destructive drains. Before relying on them:
 
 - install capture before the action and drain stale entries;
+- cache the raw selected capture before applying display-only MIME, static-resource, or shape filters;
 - allow in-flight responses to settle;
 - treat bodyless or truncated relevant entries as possible data loss;
+- inspect non-JSON structured streams with request method, safely redacted headers, body shape, and size/truncation metadata;
 - merge all relevant completed responses in the action window;
 - identify pages/cursors by content, not arrival order alone;
 - deduplicate by stable entity ID;
 - reject repeated pages/cursors and page-cap exhaustion rather than return accumulated partial rows.
 
+Never copy authorization, cookies, CSRF/XSRF values, API keys, session identifiers, or token-bearing request bodies into output, ledgers, fixtures, or site memory. Redact keyed values; if a positional or opaque body cannot be sanitized confidently, preserve only its kind, shape, full size, and truncation/omission state.
+
 A cached page may render without a fresh request. A DOM fallback is valid only when it is strictly scoped to the target container, preserves the public columns, and can distinguish empty state from structure drift. Do not silently switch to a weaker page-wide selector.
 
 ## 8. Choose strategy per command
```

**File**: `src/browser/cdp.test.ts` (modified, +41/-2)
```diff
@@ -3,10 +3,12 @@ import { beforeEach, describe, expect, it, vi } from 'vitest';
 const { MockWebSocket } = vi.hoisted(() => {
   class MockWebSocket {
     static OPEN = 1;
+    static lastInstance: MockWebSocket | undefined;
     readyState = 1;
     private handlers = new Map<string, Array<(...args: unknown[]) => void>>();
 
     constructor(_url: string) {
+      MockWebSocket.lastInstance = this;
       queueMicrotask(() => this.emit('open'));
     }
 
@@ -22,7 +24,7 @@ const { MockWebSocket } = vi.hoisted(() => {
       this.readyState = 3;
     }
 
-    private emit(event: string, ...args: unknown[]): void {
+    emit(event: string, ...args: unknown[]): void {
       for (const handler of this.handlers.get(event) ?? []) {
         handler(...args);
       }
@@ -36,7 +38,7 @@ vi.mock('ws', () => ({
   WebSocket: MockWebSocket,
 }));
 
-import { CDPBridge } from './cdp.js';
+import { CDPBridge, CDP_REQUEST_BODY_CAPTURE_LIMIT } from './cdp.js';
 
 describe('CDPBridge cookies', () => {
   beforeEach(() => {
@@ -96,4 +98,41 @@ describe('CDPBridge cookies', () => {
       ['Page.getLayoutMetrics', {}],
     ]);
   });
+
+  it('captures request headers and bounded post data on direct CDP pages', async () => {
+    vi.stubEnv('OPENCLI_CDP_ENDPOINT', 'ws://127.0.0.1:9222/devtools/page/1');
+
+    const bridge = new CDPBridge();
+    const fullBody = 'x'.repeat(CDP_REQUEST_BODY_CAPTURE_LIMIT + 5);
+    vi.spyOn(bridge, 'send').mockImplementation(async (method: string) => {
+      if (method === 'Network.getRequestPostData') return { postData: fullBody };
+      return {};
+    });
+
+    const page = await bridge.connect();
+    await page.startNetworkCapture?.();
+    MockWebSocket.lastInstance?.emit('message', Buffer.from(JSON.stringify({
+      method: 'Network.requestWillBeSent',
+      params: {
+        requestId: 'request-1',
+        request: {
+          method: 'POST',
+          url: 'https://example.test/rsc-action/actions/pagination',
+          headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
+          hasPostData: true,
+        },
+      },
+    })));
+
+    const entries = await page.readNetworkCapture?.() as Array<Record<string, unknown>>;
+    expect(entries).toHaveLength(1);
+    expect(entries[0]).toMatchObject({
+      method: 'POST',
+      requestHeaders: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
+      requestBodyKind: 'string',
+      requestBodyFullSize: fullBody.length,
+      requestBodyTruncated: true,
+    });
+    expect(String(entries[0].requestBodyPreview)).toHaveLength(CDP_REQUEST_BODY_CAPTURE_LIMIT);
+  });
 });
```

**File**: `src/browser/cdp.ts` (modified, +44/-1)
```diff
@@ -46,6 +46,7 @@ const CDP_SEND_TIMEOUT = 30_000;
 // surface `responseBodyFullSize` + `responseBodyTruncated` so downstream layers
 // can tell the agent what happened instead of lying about the payload.
 export const CDP_RESPONSE_BODY_CAPTURE_LIMIT = 8 * 1024 * 1024;
+export const CDP_REQUEST_BODY_CAPTURE_LIMIT = 1 * 1024 * 1024;
 
 export class CDPBridge implements IBrowserFactory {
   private _ws: WebSocket | null = null;
@@ -191,6 +192,11 @@ class CDPPage extends CDPBasePage {
   private _networkCapturePattern = '';
   private _networkEntries: Array<{
     url: string; method: string; responseStatus?: number;
+    requestHeaders?: Record<string, string>;
+    requestBodyKind?: string;
+    requestBodyPreview?: string;
+    requestBodyFullSize?: number;
+    requestBodyTruncated?: boolean;
     responseContentType?: string;
     responsePreview?: string;
     responseBodyFullSize?: number;
@@ -313,14 +319,51 @@ class CDPPage extends CDPBasePage {
 
       // Step 1: Record request method/url on requestWillBeSent
       this.bridge.on('Network.requestWillBeSent', (params: unknown) => {
-        const p = params as { requestId: string; request: { method: string; url: string }; timestamp: number };
+        const p = params as {
+          requestId: string;
+          request: {
+            method: string;
+            url: string;
+            headers?: Record<string, unknown>;
+            postData?: string;
+            hasPostData?: boolean;
+          };
+          timestamp: number;
+        };
         if (!this._networkCapturePattern || p.request.url.includes(this._networkCapturePattern)) {
+          const rawBody = typeof p.request.postData === 'string' ? p.request.postData : '';
+          const bodyTruncated = rawBody.length > CDP_REQUEST_BODY_CAPTURE_LIMIT;
           const idx = this._networkEntries.push({
             url: p.request.url,
             method: p.request.method,
+            requestHeaders: Object.fromEntries(
+              Object.entries(p.request.headers ?? {}).map(([name, value]) => [name, String(value)]),
+            ),
+            requestBodyKind: p.request.hasPostData ? 'string' : 'empty',
+            requestBodyPreview: bodyTruncated ? rawBody.slice(0, CDP_REQUEST_BODY_CAPTURE_LIMIT) : rawBody,
+            requestBodyFullSize: rawBody.length,
+            requestBodyTruncated: bodyTruncated,
             timestamp: Date.now(),
           }) - 1;
           this._pendingRequests.set(p.requestId, idx);
+
+          if (p.request.hasPostData && p.request.postData === undefined) {
+            const requestBodyFetch = this.bridge.send('Network.getRequestPostData', { requestId: p.requestId }).then((result: unknown) => {
+              const postData = (result as { postData?: string } | undefined)?.postData;
+              if (typeof postData !== 'string') return;
+              const truncated = postData.length > CDP_REQUEST_BODY_CAPTURE_LIMIT;
+              this._networkEntries[idx].requestBodyPreview = truncated
+                ? postData.slice(0, CDP_REQUEST_BODY_CAPTURE_LIMIT)
+                : postData;
+              this._networkEntries[idx].requestBodyFullSize = postData.length;
+              this._networkEntries[idx].requestBodyTruncated = truncated;
+            }).catch(() => {
+              // Some request types do not expose post data.
+            }).finally(() => {
+              this._pendingBodyFetches.delete(requestBodyFetch);
+            });
+            this._pendingBodyFetches.add(requestBodyFetch);
+          }
         }
       });
 
```

**File**: `src/browser/network-cache.ts` (modified, +3/-0)
```diff
@@ -13,6 +13,7 @@
 import * as fs from 'node:fs';
 import * as os from 'node:os';
 import * as path from 'node:path';
+import type { SafeNetworkRequest } from './network-request.js';
 
 export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
 
@@ -32,6 +33,8 @@ export interface CachedNetworkEntry {
     body_truncated?: boolean;
     body_full_size?: number;
     timestamp?: number;
+    /** Sanitized request context; credential values and opaque bodies are omitted. */
+    request?: SafeNetworkRequest;
 }
 
 export interface NetworkCacheFile {
```

#### Recent Merged Pull Requests:
- **PR #2539** (2026-09-24): Remove site sitemaps and external CLI hub (@jackwener)
- **PR #2516** (closed): fix(xiaohongshu): recover detail-page reads from bridge Navigation rejected races (@davidxifeng)
- **PR #2502** (closed): fix(cli): reject unknown -f/--format values (@lorenzozanee)
- **PR #2501** (closed): fix(browser): retry navigate once on Navigation rejected (Chromium 152+) (@lorenzozanee)
- **PR #2500** (closed): fix(browser): remove owned tab directly on explicit close-window (@lorenzozanee)
- **PR #2499** (closed): fix(browser): keep debugger attached across navigate on Chromium 152+ (@lorenzozanee)
- **PR #2498** (closed): fix(browser): surface WSL guidance in doctor when extension is disconnected (@lorenzozanee)
- **PR #2494** (closed): fix(deepseek): ensure --new starts a fresh conversation (@lorenzozanee)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
