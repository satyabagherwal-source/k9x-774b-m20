# Forensic Learning Record (Deep Inspection): getsentry/MobileBuildMCP

> **Canonical Artifact**: `07_PROJECT_LEARNING/getsentry-mobilebuildmcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/getsentry/MobileBuildMCP](https://github.com/getsentry/MobileBuildMCP))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:24:33.237Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `getsentry/MobileBuildMCP`
- **Description**: A Model Context Protocol (MCP) server and CLI that provides tools for agent use when working on iOS and macOS projects.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6459 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/warden-sweep/scripts/_utils.py`
```
"""Shared utilities for warden-sweep scripts."""
from __future__ import annotations

import json
import os
import subprocess
from typing import Any


def run_cmd(
    args: list[str], timeout: int = 30, cwd: str | None = None
) -> subprocess.CompletedProcess[str]:
    """Run a command and return the result."""
    return subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=cwd,
    )


def run_cmd_stdout(
    args: list[str], timeout: int = 30, cwd: str | None = None
) -> str | None:
    """Run a command and return stripped stdout, or None on failure."""
    try:
        result = run_cmd(args, timeout=timeout, cwd=cwd)
        return result.stdout.strip() if result.returncode == 0 else None
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def read_json(path: str) -> dict[str, Any] | None:
    """Read a JSON file and return parsed object, or None on failure."""
    if not os.path.exists(path):
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def write_json(path: str, data: dict[str, Any]) -> None:
    """Write a dict to a JSON file with trailing newline."""
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def read_jsonl(path: str) -> list[dict[str, Any]]:
    """Read a JSONL file and return list of parsed objects."""
    entries: list[dict[str, Any]] = []
    if not os.path.exists(path):
        return entries
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return entries


def severity_badge(severity: str) -> str:
    """Return a markdown-friendly severity indicator."""
    badges = {
        "critical": "**CRITICAL**",
        "high": "**HIGH**",
        "medium": "MEDIUM",
        "low": "LOW",
        "info": "info",
    }
    return badges.get(severity, severity)


def pr_number_from_url(pr_url: str) -> str:
    """Extract the PR or issue number from a GitHub URL's last path segment."""
    return pr_url.rstrip("/").split("/")[-1]


def ensure_github_label(name: str, color: str, description: str) -> None:
    """Create a GitHub label if it doesn't exist (idempotent)."""
    try:
        subprocess.run(
            [
                "gh", "label", "create", name,
                "--color", color,
                "--description", description,
            ],
            capture_output=True,
            timeout=15,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

```

### Core Architecture Module: `scripts/install-git-hooks.js`
```
#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

function runGit(args) {
  return spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

const insideWorkTree = runGit(['rev-parse', '--is-inside-work-tree']);
if (insideWorkTree.status !== 0 || insideWorkTree.stdout.trim() !== 'true') {
  console.log('[hooks] Skipping git hook install (not inside a git worktree).');
  process.exit(0);
}

const setHookPath = runGit(['config', 'core.hooksPath', '.githooks']);
if (setHookPath.status !== 0) {
  const output = (setHookPath.stderr || setHookPath.stdout || '').trim();
  console.error('[hooks] Failed to set core.hooksPath to .githooks');
  if (output) {
    console.error(output);
  }
  process.exit(1);
}

console.log('[hooks] Installed git hooks path: .githooks');

```

### Core Architecture Module: `scripts/repro-mcp-lifecycle-leak.ts`
```
import { spawn } from 'node:child_process';
import process from 'node:process';

interface CliOptions {
  iterations: number;
  closeDelayMs: number;
  settleMs: number;
  shutdownMode: 'graceful-stdin' | 'parent-hard-exit';
}

interface PeerProcess {
  pid: number;
  ppid: number;
  ageSeconds: number;
  rssKb: number;
  command: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    iterations: 20,
    closeDelayMs: 0,
    settleMs: 2000,
    shutdownMode: 'parent-hard-exit',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];

    if (arg === '--iterations' && value) {
      options.iterations = Number(value);
      index += 1;
    } else if (arg === '--close-delay-ms' && value) {
      options.closeDelayMs = Number(value);
      index += 1;
    } else if (arg === '--settle-ms' && value) {
      options.settleMs = Number(value);
      index += 1;
    } else if (arg === '--shutdown-mode' && value) {
      if (value !== 'graceful-stdin' && value !== 'parent-hard-exit') {
        throw new Error('--shutdown-mode must be graceful-stdin or parent-hard-exit');
      }
      options.shutdownMode = value;
      index += 1;
    }
  }

  if (!Number.isFinite(options.iterations) || options.iterations < 1) {
    throw new Error('--iterations must be a positive number');
  }
  if (!Number.isFinite(options.closeDelayMs) || options.closeDelayMs < 0) {
    throw new Error('--close-delay-ms must be a non-negative number');
  }
  if (!Number.isFinite(options.settleMs) || options.settleMs < 0) {
    throw new Error('--settle-ms must be a non-negative number');
  }

  return options;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLikelyMcpCommand(command: string): boolean {
  const normalized = command.toLowerCase();
  return (
    /(^|\s)mcp(\s|$)/.test(normalized) &&
    !/(^|\s)daemon(\s|$)/.test(normalized) &&
    (normalized.includes('mobilebuildmcp') ||
      normalized.includes('build/cli.js') ||
      normalized.includes('/cli.js'))
  );
}

function parseElapsedSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const daySplit = trimmed.split('-');
  const timePart = daySplit.length === 2 ? daySplit[1] : daySplit[0];
  const dayCount = daySplit.length === 2 ? Number(daySplit[0]) : 0;
  const parts = timePart.split(':').map((part) => Number(part));

  if (!Number.isFinite(dayCount) || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  if (parts.length === 1) {
    return dayCount * 86400 + parts[0];
  }
  if (parts.length === 2) {
    return dayCount * 86400 + parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return dayCount * 86400 + parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return null;
}

async function sampleMcpProcesses(): Promise<PeerProcess[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('ps', ['-axo', 'pid=,ppid=,etime=,rss=,command='], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `ps exited with code ${code}`));
        return;
      }

      const processes = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const match = line.match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(.+)$/);
          if (!match) {
            return null;
          }
          const ageSeconds = parseElapsedSeconds(match[3]);
          return {
            pid: Number(match[1]),
            ppid: Number(match[2]),
            ageSeconds,
            rssKb: Number(match[4]),
            command: match[5],
          };
        })
        .filter((entry): entry is PeerProcess => {
          return (
            entry !== null &&
            Number.isFinite(entry.pid) &&
            Number.isFinite(entry.ageSeconds) &&
            Number.isFinite(entry.rssKb) &&
            isLikelyMcpCommand(entry.command)
          );
        });

      resolve(processes);
    });
  });
}

interface IterationResult {
  helperExited: boolean;
  childExited: boolean;
  childPid: number | null;
}

async function runGracefulStdinIteration(closeDelayMs: number): Promise<IterationResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['build/cli.js', 'mcp'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'ignore', 'ignore'],
    });

    let settled = false;
    const finish = (result: IterationResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    child.once('close', () => {
      finish({ helperExited: true, childExited: true, childPid: child.pid ?? null });
    });
    child.once('error', () => {
      finish({ helperExited: false, childExited: false, childPid: child.pid ?? null });
    });

    setTimeout(() => {
      child.stdin.end();
    }, closeDelayMs);

    setTimeout(
      () => {
        finish({ helperExited: false, childExited: false, childPid: child.pid ?? null });
      },
      Math.max(1000, closeDelayMs + 1000),
    );
  });
}

async function runParentHardExitIteration(closeDelayMs: number): Promise<IterationResult> {
  return new Promise((resolve) => {
    const helper = spawn(
      process.execPath,
      [
        'scripts/repro-mcp-parent-exit-helper.mjs',
        process.execPath,
        'build/cli.js',
        process.cwd(),
        String(closeDelayMs),
      ],
      {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let childPid: number | null = null;
    let settled = false;
    let stdout = '';

    const finish = (result: IterationResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    helper.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      const candidate = stdout.split('\n')[0]?.trim();
      if (candidate && /^\d+$/.test(candidate)) {
        childPid = Number(candidate);
      }
    });

    helper.once('error', () => {
      finish({ helperExited: false, childExited: false, childPid });
    });

    helper.once('close', (code) => {
      finish({ helperExited: code === 0, childExited: false, childPid });
    });

    setTimeout(
      () => {
        finish({ helperExited: false, childExited: false, childPid });
      },
      Math.max(1500, closeDelayMs + 1500),
    );
  });
}

async function runIteration(options: CliOptions): Promise<IterationResult> {
  if (options.shutdownMode === 'parent-hard-exit') {
    return runParentHardExitIteration(options.closeDelayMs);
  }

  return runGracefulStdinIteration(options.closeDelayMs);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const before = await sampleMcpProcesses();
  const baselinePids = new Set(before.map((entry) => entry.pid));

  let helperExitedCount = 0;
  let childExitedCount = 0;
  const spawnedChildPids = new Set<number>();

  for (let index = 0; index < options.iterations; index += 1) {
    const result = await runIteration(options);
    if (result.helperExited) {
      helperExitedCount += 1;
    }
    if (result.childExited) {
      childExitedCount += 1;
    }
    if (result.childPid !== null) {
      spawnedChildPids.add(result.childPid);
    }
  }

  await delay(options.settleMs);

  const after = await sampleMcpProcesses();
  const lingering = after.filter((entry) => !baselinePids.has(entry.pid));
  const lingeringSpawned = lingering.filter((entry) => spawnedChildPids.has(entry.pid));

  console.log(
    JSON.stringify(
      {
        shutdownMode: options.shutdownMode,
        iterations: options.iterations,
        helperExitedCount,
        childExitedCount,
        spawnedChildPidCount: spawnedChildPids.size,
        baselineProcessCount: before.length,
        finalProcessCount: after.length,
        lingeringProcessCount: lingering.length,
        lingeringSpawnedProcessCount: lingeringSpawned.length,
        lingeringSpawned: lingeringSpawned.map(({ pid, ppid, ageSeconds, rssKb, command }) => ({
          pid,
          ppid,
          ageSeconds,
          rssKb,
          command,
        })),
        lingering: lingering.map(({ pid, ppid, ageSeconds, rssKb, command }) => ({
          pid,
          ppid,
          ageSeconds,
          rssKb,
          command,
        })),
        orphanedLingeringCount: lingering.filter((entry) => entry.ppid === 1).length,
        maxLingeringRssKb: lingering.reduce((max, entry) => Math.max(max, entry.rssKb), 0),
      },
      null,
      2,
    ),
  );

  process.exit(lingeringSpawned.length === 0 ? 0 : 1);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

```

### Core Architecture Module: `src/benchmarks/claude-ui/render.ts`
```
import path from 'node:path';
import type { BenchmarkResult, MetricResult, SequenceDiffHunk, SequenceDiffLine } from './types.ts';

export interface RenderOptions {
  color?: boolean;
  width?: number;
  cwd?: string;
}

interface ResolvedOptions {
  color: boolean;
  width: number;
  cwd: string;
}

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function resolveOptions(opts: RenderOptions | undefined): ResolvedOptions {
  const color =
    opts?.color ?? (process.env.NO_COLOR === undefined && Boolean(process.stdout.isTTY));
  const width =
    opts?.width ??
    (typeof process.stdout.columns === 'number' && process.stdout.columns > 0
      ? Math.min(process.stdout.columns, 100)
      : 96);
  const cwd = opts?.cwd ?? process.cwd();
  return { color, width, cwd };
}

function colorize(opts: ResolvedOptions, code: string, text: string): string {
  return opts.color ? `${code}${text}${ANSI.reset}` : text;
}

function statusLabel(
  status: 'COMPLETED' | 'INCOMPLETE' | 'OBSERVED',
  opts: ResolvedOptions,
): string {
  if (status === 'COMPLETED') return colorize(opts, ANSI.green, 'COMPLETED');
  if (status === 'INCOMPLETE') return colorize(opts, ANSI.red, 'INCOMPLETE');
  return colorize(opts, ANSI.dim, 'OBSERVED');
}

function statusGlyph(status: 'COMPLETED' | 'INCOMPLETE', opts: ResolvedOptions): string {
  const glyph = status === 'COMPLETED' ? '✓' : '!';
  if (status === 'COMPLETED') return colorize(opts, ANSI.green, glyph);
  return colorize(opts, ANSI.red, glyph);
}

function rule(ch: string, width: number): string {
  return ch.repeat(Math.max(10, width));
}

function header(title: string, opts: ResolvedOptions): string {
  const inner = rule('═', opts.width);
  const titleLine = colorize(opts, ANSI.bold, title);
  return `${inner}\n  ${titleLine}\n${inner}`;
}

function suiteBanner(result: BenchmarkResult, opts: ResolvedOptions): string {
  const status = overallStatus(result);
  const duration = formatDuration(result.run.wallClockSeconds);
  const left = `${statusLabel(status, opts)}  ${colorize(opts, ANSI.bold, result.name)}`;
  const right = colorize(opts, ANSI.dim, duration);
  const padWidth = Math.max(0, opts.width - visibleLength(left) - visibleLength(right));
  return `${rule('─', opts.width)}\n${left}${' '.repeat(padWidth)}${right}`;
}

function overallStatus(result: BenchmarkResult): 'COMPLETED' | 'INCOMPLETE' {
  return result.completed ? 'COMPLETED' : 'INCOMPLETE';
}

function visibleLength(text: string): number {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function relativePath(target: string, cwd: string): string {
  const rel = path.relative(cwd, target);
  if (!rel || rel.startsWith('..')) return target;
  return rel;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}m ${rest.toFixed(1)}s`;
}

function formatNumber(value: number, isWallClock: boolean): string {
  if (!isWallClock) return value.toString();
  return value.toFixed(2);
}

function formatDelta(actual: number, baseline: number, isWallClock: boolean): string {
  const delta = actual - baseline;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : ' ';
  const magnitude = Math.abs(delta);
  return `${sign}${isWallClock ? magnitude.toFixed(2) : magnitude.toString()}`;
}

function padEnd(text: string, width: number): string {
  const pad = Math.max(0, width - visibleLength(text));
  return text + ' '.repeat(pad);
}

function padStart(text: string, width: number): string {
  const pad = Math.max(0, width - visibleLength(text));
  return ' '.repeat(pad) + text;
}

interface MetricRow {
  name: string;
  actual: string;
  baseline: string;
  delta: string;
}

function metricToRow(metric: MetricResult): MetricRow {
  const isWallClock = metric.name === 'wallClockSeconds';
  const isTool = metric.name.startsWith('tool:');
  return {
    name: isTool ? metric.name.slice('tool:'.length) : metric.name,
    actual: formatNumber(metric.actual, isWallClock),
    baseline: formatNumber(metric.baseline, isWallClock),
    delta: formatDelta(metric.actual, metric.baseline, isWallClock),
  };
}

function renderTable(
  headers: readonly string[],
  rows: readonly string[][],
  aligns: readonly ('left' | 'right')[],
  opts: ResolvedOptions,
): string[] {
  const widths = headers.map((h, i) =>
    Math.max(visibleLength(h), ...rows.map((row) => visibleLength(row[i] ?? ''))),
  );
  const fmtRow = (row: readonly string[]): string =>
    row
      .map((cell, i) =>
        aligns[i] === 'right' ? padStart(cell, widths[i]!) : padEnd(cell, widths[i]!),
      )
      .join('  ');
  const headerLine = colorize(opts, ANSI.dim, fmtRow(headers));
  return [headerLine, ...rows.map(fmtRow)];
}

function renderMetricsSection(result: BenchmarkResult, opts: ResolvedOptions): string[] {
  if (result.metrics.length === 0) return [];

  const headline = result.metrics.filter((m) => !m.name.startsWith('tool:'));
  const tools = result.metrics.filter((m) => m.name.startsWith('tool:'));

  const lines: string[] = [];

  if (headline.length > 0) {
    lines.push('', colorize(opts, ANSI.bold, 'Metrics'));
    const rows = headline
      .map(metricToRow)
      .map((row) => [row.name, row.actual, row.baseline, row.delta]);
    const table = renderTable(
      ['METRIC', 'ACTUAL', 'BASELINE', 'DELTA'],
      rows,
      ['left', 'right', 'right', 'right'],
      opts,
    );
    for (const line of table) lines.push(`  ${line}`);
  }

  if (tools.length > 0) {
    lines.push('', colorize(opts, ANSI.bold, 'Tool calls (baseline-observed)'));
    const rows = tools
      .map(metricToRow)
      .map((row) => [row.name, row.actual, row.baseline, row.delta]);
    const table = renderTable(
      ['TOOL', 'ACTUAL', 'BASELINE', 'DELTA'],
      rows,
      ['left', 'right', 'right', 'right'],
      opts,
    );
    for (const line of table) lines.push(`  ${line}`);
  }

  return lines;
}

function renderStumbleSection(result: BenchmarkResult, opts: ResolvedOptions): string[] {
  const { failures, patternFailures, parseErrors } = result.audit;
  const { claudeExitCode, parserExitCode } = result.run;
  const total = result.completion.issueCount;
  if (total === 0) {
    return ['', `${statusLabel('OBSERVED', opts)}  stumbles: 0`];
  }

  const lines: string[] = [
    '',
    `${statusLabel(result.completion.completed ? 'OBSERVED' : 'INCOMPLETE', opts)}  stumbles: ${total}`,
  ];

  if (claudeExitCode !== 0) {
    lines.push(`  • claude exit code: ${claudeExitCode ?? 'null'}`);
  }
  if (parserExitCode !== 0) {
    lines.push(`  • parser exit code: ${parserExitCode ?? 'null'}`);
  }
  if (parseErrors.length > 0) {
    lines.push(`  • parse errors: ${parseErrors.length}`);
    for (const error of parseErrors.slice(0, 3)) {
      lines.push(`      ${colorize(opts, ANSI.dim, truncate(error, 120))}`);
    }
    if (parseErrors.length > 3) {
      lines.push(`      ${colorize(opts, ANSI.dim, `…and ${parseErrors.length - 3} more`)}`);
    }
  }
  if (failures.length > 0) {
    lines.push(`  • tool errors: ${failures.length}`);
    for (const failure of failures.slice(0, 5)) {
      const name = failure.shortName ?? failure.fullName ?? '(unknown)';
      const msg = truncate(failure.message, 100);
      lines.push(`      ${colorize(opts, ANSI.red, name)} @ line ${failure.line}: ${msg}`);
    }
    if (failures.length > 5) {
      lines.push(`      ${colorize(opts, ANSI.dim, `…and ${failures.length - 5} more`)}`);
    }
  }
  if (patternFailures.length > 0) {
    lines.push(`  • pattern matches: ${patternFailures.length}`);
    for (const item of patternFailures.slice(0, 5)) {
      lines.push(
        `      ${colorize(opts, ANSI.yellow, item.pattern)} @ line ${item.line}: ${truncate(item.excerpt, 100)}`,
      );
    }
    if (patternFailures.length > 5) {
      lines.push(`      ${colorize(opts, ANSI.dim, `…and ${patternFailures.length - 5} more`)}`);
    }
  }

  return lines;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function renderSequenceSection(result: BenchmarkResult, opts: ResolvedOptions): string[] {
  const baselineLen = result.sequence.baseline.length;
  if (baselineLen === 0) return [];

  const lines: string[] = [''];
  const comparison = result.sequence.matched
    ? 'matched'
    : `${result.sequence.missing.length} missing from baseline, ${result.sequence.additional.length} additional`;
  lines.push(`${statusLabel('OBSERVED', opts)}  tool sequence: ${comparison}`);

  if (result.sequence.diff.length === 0) return lines;

  for (const hunk of result.sequence.diff) {
    lines.push(...renderHunk(hunk, opts));
  }
  return lines;
}

function renderHunk(hunk: SequenceDiffHunk, opts: ResolvedOptions): string[] {
  const baselineIndexes = hunk.lines
    .map((l) => l.baselineIndex)
    .filter((v): v is number => v !== undefined);
  const actualIndexes = hunk.lines
    .map((l) => l.actualIndex)
    .filter((v): v is number => v !== undefined);
  const baselineRange = formatRange(baselineIndexes);
  const actualRange = formatRange(actualIndexes);
  const headerText = `  @@ baseline[${baselineRange}] actual[${actualRange}] @@`;
  const lines = [colorize(opts, ANSI.cyan, headerText)];

  const baselineColWidth = Math.max(
    3,
    ...hunk.lines.map((l) => (l.baselineIndex !== undefined ? String(l.baselineIndex).length : 0)),
  );
  const actualColWidth = Math.max(
    3,
    ...hunk.lines.map((l) => (l.actualIndex !== undefined ? String(l.actualIndex).length : 0)),
  );

  for (const line of hunk.lines) {
    lines.push(renderHunkLine(line, baselineColWidth, actualColWidth, opts));
  }
  return lines;
}

function formatRange(indexes: number[]): string {
  if (i
```

### Core Architecture Module: `src/benchmarks/claude-ui/simulator-lifecycle.ts`
```
import { spawn } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import type { BenchmarkConfig } from './types.ts';
import { openBenchmarkSimulatorFrontend } from './simulator-frontend.ts';

type SessionDefaultKey = keyof NonNullable<BenchmarkConfig['sessionDefaults']>;

export interface LoggedCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationSeconds: number;
}

export interface LifecycleCommandOptions {
  command: string;
  args: string[];
  cwd: string;
  logPath: string;
  env?: NodeJS.ProcessEnv;
}

export type LifecycleCommandExecutor = (
  opts: LifecycleCommandOptions,
) => Promise<LoggedCommandResult>;

export type LifecycleLogWriter = (logPath: string, message: string) => Promise<void>;

export const defaultLifecycleLogWriter: LifecycleLogWriter = async (logPath, message) => {
  await appendFile(logPath, `${message}\n`, 'utf8');
};

export interface TemporarySimulatorPlan {
  enabled: boolean;
  reason?: string;
  deviceTypeName?: string;
  existingSimulatorId?: string;
  existingSimulatorName?: string;
}

export interface CreatedTemporarySimulator {
  createdByHarness: true;
  simulatorId: string;
  name: string;
  deviceTypeName: string;
  logPath: string;
}

export interface ExistingSimulator {
  createdByHarness: false;
  simulatorId: string;
  name: string;
  logPath: string;
}

export type PreparedSimulator = CreatedTemporarySimulator | ExistingSimulator;

export type LifecycleProgressReporter = (message: string) => void;

function sessionDefaultString(config: BenchmarkConfig, key: SessionDefaultKey): string | undefined {
  const value = config.sessionDefaults?.[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`sessionDefaults.${key} must be a non-empty string`);
  }
  return value;
}

export function resolveTemporarySimulatorPlan(config: BenchmarkConfig): TemporarySimulatorPlan {
  const existingSimulatorId = sessionDefaultString(config, 'simulatorId');
  const deviceTypeName = sessionDefaultString(config, 'simulatorName');

  if (config.temporarySimulator === false) {
    return {
      enabled: false,
      reason: 'temporarySimulator is false',
      existingSimulatorId,
      existingSimulatorName: existingSimulatorId === undefined ? deviceTypeName : undefined,
    };
  }

  if (existingSimulatorId !== undefined) {
    if (config.temporarySimulator === true) {
      throw new Error(
        `${config.name}: temporarySimulator cannot be true when sessionDefaults.simulatorId is set`,
      );
    }
    return {
      enabled: false,
      reason: 'sessionDefaults.simulatorId is set',
      existingSimulatorId,
    };
  }

  if (deviceTypeName === undefined) {
    throw new Error(
      `${config.name}: temporary simulator requires sessionDefaults.simulatorName or temporarySimulator: false`,
    );
  }

  return { enabled: true, deviceTypeName };
}

export function temporarySimulatorName(suiteSlug: string, timestamp: string): string {
  return `Claude UI ${suiteSlug} ${timestamp}`;
}

async function appendLifecycleLog(
  logPath: string,
  message: string,
  logWriter: LifecycleLogWriter = defaultLifecycleLogWriter,
): Promise<void> {
  await logWriter(logPath, message);
}

export async function tryAppendLifecycleLog(
  logPath: string,
  message: string,
  logWriter: LifecycleLogWriter = defaultLifecycleLogWriter,
): Promise<string | undefined> {
  try {
    await appendLifecycleLog(logPath, message, logWriter);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function commandText(command: string, args: string[]): string {
  return `${command} ${args.join(' ')}`;
}

function commandOutput(result: LoggedCommandResult): string {
  return [result.stdout, result.stderr].filter((item) => item.length > 0).join('\n');
}

function isAlreadyBooted(result: LoggedCommandResult): boolean {
  if (result.exitCode === 0) return true;
  return /already booted|current state:\s*Booted|state:\s*Booted/i.test(commandOutput(result));
}

interface SimctlDevice {
  name?: unknown;
  udid?: unknown;
  isAvailable?: unknown;
}

interface SimctlListDevices {
  devices?: Record<string, SimctlDevice[]>;
}

function resolveSimulatorIdFromList(output: string, simulatorName: string): string {
  const parsed = JSON.parse(output) as SimctlListDevices;
  for (const devices of Object.values(parsed.devices ?? {})) {
    for (const device of devices) {
      if (
        device.name === simulatorName &&
        device.isAvailable !== false &&
        typeof device.udid === 'string'
      ) {
        return device.udid;
      }
    }
  }
  throw new Error(`no available simulator found named '${simulatorName}'`);
}

async function bootAndOpenSimulator(opts: {
  configName: string;
  simulatorId: string;
  cwd: string;
  logPath: string;
  executor: LifecycleCommandExecutor;
  onEvent?: LifecycleProgressReporter;
  readinessDelayMs?: number;
  logWriter?: LifecycleLogWriter;
  readyLogPrefix: string;
  bootstatusSubject: string;
}): Promise<void> {
  const bootArgs = ['simctl', 'boot', opts.simulatorId];
  opts.onEvent?.(`booting simulator ${opts.simulatorId}`);
  const bootResult = await opts.executor({
    command: 'xcrun',
    args: bootArgs,
    cwd: opts.cwd,
    logPath: opts.logPath,
  });
  if (!isAlreadyBooted(bootResult)) {
    throw new Error(
      `${opts.configName}: failed to boot simulator with ${commandText('xcrun', bootArgs)} (exit ${bootResult.exitCode}); see ${opts.logPath}`,
    );
  }
  if (bootResult.exitCode !== 0) {
    await appendLifecycleLog(
      opts.logPath,
      'Boot command reported simulator was already booted; continuing',
      opts.logWriter,
    );
  }

  opts.onEvent?.(`waiting for simulator ${opts.simulatorId} bootstatus`);
  const bootstatusArgs = ['simctl', 'bootstatus', opts.simulatorId, '-b'];
  const bootstatusResult = await opts.executor({
    command: 'xcrun',
    args: bootstatusArgs,
    cwd: opts.cwd,
    logPath: opts.logPath,
  });
  if (bootstatusResult.exitCode !== 0) {
    throw new Error(
      `${opts.configName}: ${opts.bootstatusSubject} did not reach bootstatus with ${commandText('xcrun', bootstatusArgs)} (exit ${bootstatusResult.exitCode}); see ${opts.logPath}`,
    );
  }

  await openBenchmarkSimulatorFrontend({
    simulatorId: opts.simulatorId,
    configName: opts.configName,
    cwd: opts.cwd,
    logPath: opts.logPath,
    executor: opts.executor,
    appendLog: (message) => appendLifecycleLog(opts.logPath, message, opts.logWriter),
    onEvent: opts.onEvent,
  });

  await waitForReadinessDelay({
    logPath: opts.logPath,
    milliseconds: opts.readinessDelayMs ?? 2_000,
    onEvent: opts.onEvent,
    logWriter: opts.logWriter,
  });
  await appendLifecycleLog(
    opts.logPath,
    `${opts.readyLogPrefix}: ${opts.simulatorId}`,
    opts.logWriter,
  );
  opts.onEvent?.(`simulator ready ${opts.simulatorId}`);
}

async function waitForReadinessDelay(opts: {
  logPath: string;
  milliseconds: number;
  onEvent?: LifecycleProgressReporter;
  logWriter?: LifecycleLogWriter;
}): Promise<void> {
  if (opts.milliseconds <= 0) return;
  const seconds = opts.milliseconds / 1000;
  opts.onEvent?.(`waiting ${seconds.toFixed(1)}s for simulator UI readiness`);
  await appendLifecycleLog(
    opts.logPath,
    `Readiness delay seconds: ${seconds.toFixed(1)}`,
    opts.logWriter,
  );
  await new Promise<void>((resolve) => {
    setTimeout(resolve, opts.milliseconds);
  });
}

export async function runLoggedCommand(
  opts: LifecycleCommandOptions,
): Promise<LoggedCommandResult> {
  await appendLifecycleLog(
    opts.logPath,
    `Command: ${opts.command} ${opts.args.join(' ')}\nStarted: ${new Date().toISOString()}`,
  );

  return await new Promise<LoggedCommandResult>((resolve, reject) => {
    const started = process.hrtime.bigint();
    const child = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      void appendLifecycleLog(opts.logPath, `Spawn error: ${error.message}`).finally(() => {
        reject(error);
      });
    });
    child.on('close', (exitCode) => {
      if (settled) return;
      settled = true;
      const durationSeconds = Number(process.hrtime.bigint() - started) / 1_000_000_000;
      const result = {
        exitCode,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        durationSeconds,
      };
      const stdoutText = result.stdout.trim();
      const stderrText = result.stderr.trim();
      void appendLifecycleLog(
        opts.logPath,
        [
          `Finished: ${new Date().toISOString()}`,
          `Exit status: ${exitCode}`,
          `Wall clock seconds: ${durationSeconds.toFixed(2)}`,
          stdoutText.length > 0 ? `stdout:\n${stdoutText}` : undefined,
          stderrText.length > 0 ? `stderr:\n${stderrText}` : undefined,
        ]
          .filter((line): line is string => line !== undefined)
          .join('\n'),
      )
        .then(() => resolve(result))
        .catch(reject);
    });
  });
}

export async function prepareTemporarySimulator(opts: {
  config: BenchmarkConfig;
  suiteSlug: string;
  timestamp: string;
  cwd: string;
  logPath: string;
  executor?: LifecycleCommandExecutor;
  logWriter?: LifecycleLogWriter;
  onEvent?: LifecycleProgressReporter;
  readinessDelayMs?: number;
}): Promise<PreparedSimulator | undefined> {
  const plan = resolveTemporarySimulatorPlan(opts.config);
  const logWriter = opts.logWriter ?? defaultLifecycleLogWriter
```

### Core Architecture Module: `src/core/manifest/import-resource-module.ts`
```
/**
 * Resource module importer.
 * Dynamically imports resource modules using named exports only.
 */

import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getPackageRoot } from './load-manifest.ts';

export interface ImportedResourceModule {
  handler: (uri: URL) => Promise<{ contents: Array<{ text: string }> }>;
}

const moduleCache = new Map<string, ImportedResourceModule>();

/**
 * Import a resource module by its manifest module path.
 *
 * Accepts named export only: `export const handler = ...`
 *
 * @param moduleId - Extensionless module path (e.g., 'mcp/resources/simulators')
 * @returns Imported resource module with handler
 */
export async function importResourceModule(moduleId: string): Promise<ImportedResourceModule> {
  const cached = moduleCache.get(moduleId);
  if (cached) {
    return cached;
  }

  const packageRoot = getPackageRoot();
  const modulePath = path.join(packageRoot, 'build', `${moduleId}.js`);
  const moduleUrl = pathToFileURL(modulePath).href;

  let mod: Record<string, unknown>;
  try {
    mod = (await import(moduleUrl)) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Failed to import resource module '${moduleId}': ${err}`);
  }

  if (typeof mod.handler !== 'function') {
    throw new Error(
      `Resource module '${moduleId}' does not export the required shape. ` +
        `Expected a named export: export const handler = ...`,
    );
  }

  const result: ImportedResourceModule = {
    handler: mod.handler as ImportedResourceModule['handler'],
  };

  moduleCache.set(moduleId, result);
  return result;
}

/**
 * Reset module cache (for tests).
 */
export function __resetResourceModuleCacheForTests(): void {
  moduleCache.clear();
}

```

### Core Architecture Module: `src/core/manifest/import-tool-module.ts`
```
/**
 * Tool module importer.
 * Dynamically imports tool modules using named exports only.
 */

import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ToolSchemaShape } from '../plugin-types.ts';
import type { ToolHandlerContext } from '../../rendering/types.ts';
import { getPackageRoot } from './load-manifest.ts';

export interface ImportedToolModule {
  schema: ToolSchemaShape;
  mcpSchema: ToolSchemaShape;
  handler: (params: Record<string, unknown>, ctx?: ToolHandlerContext) => Promise<unknown>;
}

const moduleCache = new Map<string, ImportedToolModule>();

/**
 * Import a tool module by its manifest module path.
 *
 * Accepts named exports only: `schema`, optional MCP-specific `mcpSchema`, and `handler`.
 *
 * @param moduleId - Extensionless module path (e.g., 'mcp/tools/simulator/build_sim')
 * @returns Imported tool module with schema and handler
 */
export async function importToolModule(moduleId: string): Promise<ImportedToolModule> {
  const cached = moduleCache.get(moduleId);
  if (cached) {
    return cached;
  }

  const packageRoot = getPackageRoot();
  const modulePath = path.join(packageRoot, 'build', `${moduleId}.js`);
  const moduleUrl = pathToFileURL(modulePath).href;

  let mod: Record<string, unknown>;
  try {
    mod = (await import(moduleUrl)) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Failed to import tool module '${moduleId}': ${err}`);
  }

  if (!mod.schema || typeof mod.handler !== 'function') {
    throw new Error(
      `Tool module '${moduleId}' does not export the required shape. ` +
        `Expected named exports: export const schema = ... and export const handler = ...`,
    );
  }

  const result: ImportedToolModule = {
    schema: mod.schema as ToolSchemaShape,
    mcpSchema: (mod.mcpSchema ?? mod.schema) as ToolSchemaShape,
    handler: mod.handler as (
      params: Record<string, unknown>,
      ctx?: ToolHandlerContext,
    ) => Promise<unknown>,
  };

  moduleCache.set(moduleId, result);
  return result;
}

/**
 * Reset module cache (for tests).
 */
export function __resetToolModuleCacheForTests(): void {
  moduleCache.clear();
}

```

### Core Architecture Module: `src/core/manifest/index.ts`
```
/**
 * Manifest system exports.
 */

export * from './schema.ts';
export * from './load-manifest.ts';
export * from './import-tool-module.ts';
export * from './import-resource-module.ts';

```

### Core Architecture Module: `src/core/manifest/load-manifest.ts`
```
/**
 * Manifest loader for YAML-based tool and workflow definitions.
 * Loads and merges multiple YAML files into a resolved manifest.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  toolManifestEntrySchema,
  workflowManifestEntrySchema,
  resourceManifestEntrySchema,
  type ToolManifestEntry,
  type WorkflowManifestEntry,
  type ResourceManifestEntry,
  type ResolvedManifest,
} from './schema.ts';
import { getManifestsDir, getPackageRoot } from '../resource-root.ts';

export type { ResolvedManifest, ToolManifestEntry, WorkflowManifestEntry, ResourceManifestEntry };
import { isValidPredicate } from '../../visibility/predicate-registry.ts';
export { getManifestsDir, getPackageRoot } from '../resource-root.ts';

function loadYamlFiles(dir: string): unknown[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  const results: unknown[] = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      const parsed = parseYaml(content) as Record<string, unknown> | null;
      if (parsed) {
        results.push({ ...parsed, _sourceFile: file });
      }
    } catch (err) {
      throw new Error(`Failed to parse YAML file ${filePath}: ${err}`);
    }
  }

  return results;
}

export class ManifestValidationError extends Error {
  constructor(
    message: string,
    public readonly sourceFile?: string,
  ) {
    super(sourceFile ? `${message} (in ${sourceFile})` : message);
    this.name = 'ManifestValidationError';
  }
}

/**
 * Load and validate the complete manifest registry.
 * Merges all YAML files from manifests/tools/ and manifests/workflows/.
 */
export function loadManifest(): ResolvedManifest {
  const manifestsDir = getManifestsDir();
  const toolsDir = path.join(manifestsDir, 'tools');
  const workflowsDir = path.join(manifestsDir, 'workflows');

  const tools = new Map<string, ToolManifestEntry>();
  const workflows = new Map<string, WorkflowManifestEntry>();

  const toolFiles = loadYamlFiles(toolsDir);
  for (const raw of toolFiles) {
    const sourceFile = (raw as { _sourceFile?: string })._sourceFile;
    const result = toolManifestEntrySchema.safeParse(raw);
    if (!result.success) {
      throw new ManifestValidationError(
        `Invalid tool manifest: ${result.error.message}`,
        sourceFile,
      );
    }

    const tool = result.data;

    if (tools.has(tool.id)) {
      throw new ManifestValidationError(`Duplicate tool ID '${tool.id}'`, sourceFile);
    }

    for (const pred of tool.predicates) {
      if (!isValidPredicate(pred)) {
        throw new ManifestValidationError(
          `Unknown predicate '${pred}' in tool '${tool.id}'`,
          sourceFile,
        );
      }
    }

    tools.set(tool.id, tool);
  }

  const workflowFiles = loadYamlFiles(workflowsDir);
  for (const raw of workflowFiles) {
    const sourceFile = (raw as { _sourceFile?: string })._sourceFile;
    const result = workflowManifestEntrySchema.safeParse(raw);
    if (!result.success) {
      throw new ManifestValidationError(
        `Invalid workflow manifest: ${result.error.message}`,
        sourceFile,
      );
    }

    const workflow = result.data;

    if (workflows.has(workflow.id)) {
      throw new ManifestValidationError(`Duplicate workflow ID '${workflow.id}'`, sourceFile);
    }

    for (const pred of workflow.predicates) {
      if (!isValidPredicate(pred)) {
        throw new ManifestValidationError(
          `Unknown predicate '${pred}' in workflow '${workflow.id}'`,
          sourceFile,
        );
      }
    }

    for (const toolId of workflow.tools) {
      if (!tools.has(toolId)) {
        throw new ManifestValidationError(
          `Workflow '${workflow.id}' references unknown tool '${toolId}'`,
          sourceFile,
        );
      }
    }

    workflows.set(workflow.id, workflow);
  }

  const mcpNames = new Map<string, string>();
  for (const [toolId, tool] of tools) {
    const existing = mcpNames.get(tool.names.mcp);
    if (existing) {
      throw new ManifestValidationError(
        `Duplicate MCP name '${tool.names.mcp}' used by tools '${existing}' and '${toolId}'`,
      );
    }
    mcpNames.set(tool.names.mcp, toolId);
  }

  for (const [toolId, tool] of tools.entries()) {
    const sourceFile = toolFiles.find((raw) => {
      const candidate = raw as { id?: string; _sourceFile?: string };
      return candidate.id === toolId;
    }) as { _sourceFile?: string } | undefined;

    for (const nextStep of tool.nextSteps) {
      if (nextStep.toolId && !tools.has(nextStep.toolId)) {
        throw new ManifestValidationError(
          `Tool '${toolId}' next step references unknown tool '${nextStep.toolId}'`,
          sourceFile?._sourceFile,
        );
      }
    }
  }

  const resourcesDir = path.join(manifestsDir, 'resources');
  const resources = new Map<string, ResourceManifestEntry>();

  const resourceFiles = loadYamlFiles(resourcesDir);
  for (const raw of resourceFiles) {
    const sourceFile = (raw as { _sourceFile?: string })._sourceFile;
    const result = resourceManifestEntrySchema.safeParse(raw);
    if (!result.success) {
      throw new ManifestValidationError(
        `Invalid resource manifest: ${result.error.message}`,
        sourceFile,
      );
    }

    const resource = result.data;

    if (resources.has(resource.id)) {
      throw new ManifestValidationError(`Duplicate resource ID '${resource.id}'`, sourceFile);
    }

    const existingUri = [...resources.values()].find((r) => r.uri === resource.uri);
    if (existingUri) {
      throw new ManifestValidationError(
        `Duplicate resource URI '${resource.uri}' used by resources '${existingUri.id}' and '${resource.id}'`,
        sourceFile,
      );
    }

    for (const pred of resource.predicates) {
      if (!isValidPredicate(pred)) {
        throw new ManifestValidationError(
          `Unknown predicate '${pred}' in resource '${resource.id}'`,
          sourceFile,
        );
      }
    }

    resources.set(resource.id, resource);
  }

  return { tools, workflows, resources };
}

/**
 * Get tools for a specific workflow.
 */
export function getWorkflowTools(
  manifest: ResolvedManifest,
  workflowId: string,
): ToolManifestEntry[] {
  const workflow = manifest.workflows.get(workflowId);
  if (!workflow) {
    return [];
  }

  return workflow.tools
    .map((toolId) => manifest.tools.get(toolId))
    .filter((t): t is ToolManifestEntry => t !== undefined);
}

/**
 * Get all unique tools across selected workflows.
 */
export function getToolsForWorkflows(
  manifest: ResolvedManifest,
  workflowIds: string[],
): ToolManifestEntry[] {
  const seenToolIds = new Set<string>();
  const tools: ToolManifestEntry[] = [];

  for (const workflowId of workflowIds) {
    const workflowTools = getWorkflowTools(manifest, workflowId);
    for (const tool of workflowTools) {
      if (!seenToolIds.has(tool.id)) {
        seenToolIds.add(tool.id);
        tools.push(tool);
      }
    }
  }

  return tools;
}

/**
 * Get workflow metadata from the manifest.
 * Returns a record mapping workflow IDs to their title/description.
 */
export function getWorkflowMetadataFromManifest(): Record<
  string,
  { name: string; description: string }
> {
  const manifest = loadManifest();
  const metadata: Record<string, { name: string; description: string }> = {};

  for (const [id, workflow] of manifest.workflows.entries()) {
    metadata[id] = {
      name: workflow.title,
      description: workflow.description,
    };
  }

  return metadata;
}

```

### Core Architecture Module: `src/core/manifest/schema.ts`
```
/**
 * Zod schemas for manifest YAML validation.
 * These schemas define the canonical data model for tools and workflows.
 */

import { z } from 'zod';

/**
 * Availability flags for different runtimes.
 */
export const availabilitySchema = z
  .object({
    mcp: z.boolean().default(true),
    cli: z.boolean().default(true),
  })
  .strict();

export type Availability = z.infer<typeof availabilitySchema>;

/**
 * Routing hints for daemon-backed CLI execution.
 */
export const routingSchema = z
  .object({
    stateful: z.boolean().default(false),
  })
  .strict();

export type Routing = z.infer<typeof routingSchema>;

/**
 * MCP tool annotations (hints for clients).
 * All properties are optional hints, not guarantees.
 */
export const annotationsSchema = z.object({
  title: z.string().optional(),
  readOnlyHint: z.boolean().optional(),
  destructiveHint: z.boolean().optional(),
  idempotentHint: z.boolean().optional(),
  openWorldHint: z.boolean().optional(),
});

export type Annotations = z.infer<typeof annotationsSchema>;

/**
 * Tool names for MCP and CLI.
 */
export const toolNamesSchema = z.object({
  /** MCP name is required and must be globally unique */
  mcp: z.string(),
  /** CLI name is optional; if omitted, derived from MCP name */
  cli: z.string().optional(),
});

export type ToolNames = z.infer<typeof toolNamesSchema>;

export const outputSchemaMetadataSchema = z
  .object({
    schema: z.string().regex(/^mobilebuildmcp\.output\.[a-z0-9-]+$/),
    version: z.string().regex(/^[0-9]+$/),
  })
  .strict();

export type OutputSchemaMetadata = z.infer<typeof outputSchemaMetadataSchema>;

/**
 * Static next-step template declared on a tool manifest.
 */
export const manifestNextStepTemplateSchema = z
  .object({
    label: z.string(),
    toolId: z.string().optional(),
    params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
    priority: z.number().optional(),
    when: z.enum(['always', 'success', 'failure']).default('always'),
    condition: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/)
      .optional(),
  })
  .strict();

export type ManifestNextStepTemplate = z.infer<typeof manifestNextStepTemplateSchema>;

/**
 * Tool manifest entry schema.
 * Describes a single tool's metadata and configuration.
 */
export const toolManifestEntrySchema = z.object({
  /** Unique tool identifier */
  id: z.string(),

  /**
   * Module path (extensionless, package-relative).
   * Resolved to build/<module>.js at runtime.
   */
  module: z.string(),

  /** Tool names for MCP and CLI */
  names: toolNamesSchema,

  /** Tool description */
  description: z.string().optional(),

  /** Per-runtime availability flags */
  availability: availabilitySchema.default({ mcp: true, cli: true }),

  /** Predicate names for visibility filtering (all must pass) */
  predicates: z.array(z.string()).default([]),

  /** Routing hints for daemon */
  routing: routingSchema.optional(),

  /** MCP annotations (hints for clients) */
  annotations: annotationsSchema.optional(),

  /** Structured output schema advertised to MCP clients */
  outputSchema: outputSchemaMetadataSchema.optional(),

  /** Static next-step templates for this tool */
  nextSteps: z.array(manifestNextStepTemplateSchema).default([]),
});

export type ToolManifestEntry = z.infer<typeof toolManifestEntrySchema>;

/**
 * MCP-specific workflow selection rules.
 */
export const workflowSelectionMcpSchema = z.object({
  /** Used when config.enabledWorkflows is empty */
  defaultEnabled: z.boolean().default(false),
  /** Include when predicates pass, regardless of user selection */
  autoInclude: z.boolean().default(false),
});

export type WorkflowSelectionMcp = z.infer<typeof workflowSelectionMcpSchema>;

/**
 * Workflow selection rules.
 */
export const workflowSelectionSchema = z.object({
  mcp: workflowSelectionMcpSchema.optional(),
});

export type WorkflowSelection = z.infer<typeof workflowSelectionSchema>;

/**
 * Apple platforms used by setup to recommend workflows.
 */
export const workflowTargetPlatformSchema = z.enum(['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']);

export type WorkflowTargetPlatform = z.infer<typeof workflowTargetPlatformSchema>;

/**
 * Workflow manifest entry schema.
 * Describes a workflow's metadata and tool composition.
 */
export const workflowManifestEntrySchema = z.object({
  /** Unique workflow identifier (matches directory name) */
  id: z.string(),

  /** Display title for the workflow */
  title: z.string(),

  /** Workflow description */
  description: z.string(),

  /** Setup platforms this workflow is recommended for */
  targetPlatforms: z.array(workflowTargetPlatformSchema),

  /** Per-runtime availability flags */
  availability: availabilitySchema.default({ mcp: true, cli: true }),

  /** MCP selection rules */
  selection: workflowSelectionSchema.optional(),

  /** Predicate names for visibility filtering (all must pass) */
  predicates: z.array(z.string()).default([]),

  /** Tool IDs belonging to this workflow */
  tools: z.array(z.string()),
});

export type WorkflowManifestEntry = z.infer<typeof workflowManifestEntrySchema>;

/**
 * Resource availability flags (MCP only).
 */
export const resourceAvailabilitySchema = z
  .object({
    mcp: z.boolean().default(true),
  })
  .strict();

export type ResourceAvailability = z.infer<typeof resourceAvailabilitySchema>;

/**
 * Resource manifest entry schema.
 * Describes a single MCP resource's metadata and configuration.
 */
export const resourceManifestEntrySchema = z.object({
  /** Unique resource identifier */
  id: z.string(),

  /**
   * Module path (extensionless, package-relative).
   * Resolved to build/<module>.js at runtime.
   */
  module: z.string(),

  /** MCP resource name */
  name: z.string(),

  /** Resource URI (e.g., mobilebuildmcp://simulators) */
  uri: z.string(),

  /** Resource description */
  description: z.string(),

  /** MIME type for the resource content */
  mimeType: z.string(),

  /** Per-runtime availability flags */
  availability: resourceAvailabilitySchema.default({ mcp: true }),

  /** Predicate names for visibility filtering (all must pass) */
  predicates: z.array(z.string()).default([]),
});

export type ResourceManifestEntry = z.infer<typeof resourceManifestEntrySchema>;

/**
 * Resolved manifest containing all tools, workflows, and resources.
 */
export interface ResolvedManifest {
  tools: Map<string, ToolManifestEntry>;
  workflows: Map<string, WorkflowManifestEntry>;
  resources: Map<string, ResourceManifestEntry>;
}

/**
 * Derive CLI name from MCP name using kebab-case conversion.
 * - Underscores become hyphens
 * - camelCase becomes kebab-case
 */
export function deriveCliName(mcpName: string): string {
  return mcpName
    .replace(/_/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Get the effective CLI name for a tool.
 */
export function getEffectiveCliName(tool: ToolManifestEntry): string {
  return tool.names.cli ?? deriveCliName(tool.names.mcp);
}

```

### Core Architecture Module: `src/core/plugin-types.ts`
```
import * as z from 'zod';

export type ToolSchemaShape = Record<string, z.ZodType>;

```

### Core Architecture Module: `src/core/resource-root.ts`
```
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const RESOURCE_ROOT_ENV_VAR = 'MOBILEBUILDMCP_RESOURCE_ROOT';
let cachedPackageRoot: string | null = null;
let cachedResourceRoot: string | null = null;

export function resetResourceRootCacheForTests(): void {
  cachedPackageRoot = null;
  cachedResourceRoot = null;
}

function hasResourceLayout(root: string): boolean {
  return fs.existsSync(path.join(root, 'manifests')) || fs.existsSync(path.join(root, 'bundled'));
}

function findPackageRootFrom(startDir: string): string | null {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

export function getPackageRoot(): string {
  if (cachedPackageRoot) {
    return cachedPackageRoot;
  }

  const candidates: string[] = [];
  const importMetaUrl = typeof import.meta.url === 'string' ? import.meta.url : null;
  if (importMetaUrl) {
    candidates.push(path.dirname(fileURLToPath(importMetaUrl)));
  }
  candidates.push(process.cwd());
  const entry = process.argv[1];
  if (entry) {
    candidates.push(path.dirname(entry));
  }

  for (const candidate of candidates) {
    const found = findPackageRootFrom(candidate);
    if (found) {
      cachedPackageRoot = found;
      return found;
    }
  }

  throw new Error('Could not find package root (no package.json found in parent directories)');
}

function getExecutableResourceRoot(): string | null {
  const execPath = process.execPath;
  const candidateDirs = [path.dirname(execPath), path.dirname(path.dirname(execPath))];
  for (const candidate of candidateDirs) {
    if (hasResourceLayout(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function getResourceRoot(): string {
  if (cachedResourceRoot) {
    return cachedResourceRoot;
  }

  const explicitRoot = process.env[RESOURCE_ROOT_ENV_VAR];
  if (explicitRoot) {
    cachedResourceRoot = path.resolve(explicitRoot);
    return cachedResourceRoot;
  }

  const executableRoot = getExecutableResourceRoot();
  if (executableRoot) {
    cachedResourceRoot = executableRoot;
    return cachedResourceRoot;
  }

  cachedResourceRoot = getPackageRoot();
  return cachedResourceRoot;
}

export function getManifestsDir(): string {
  return path.join(getResourceRoot(), 'manifests');
}

export function getStructuredOutputSchemasDir(): string {
  return path.join(getResourceRoot(), 'schemas', 'structured-output');
}

export function getBundledAxePath(): string {
  return path.join(getResourceRoot(), 'bundled', 'axe');
}

export function getBundledFrameworksDir(): string {
  return path.join(getResourceRoot(), 'bundled', 'Frameworks');
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #514** (2026-09-17): **[Bug]: Simulator test fails on mixed iOS and watchOS test plans in 2.7.0**
  *Symptoms*: ### Bug Description  `simulator test` fails on XcodeBuildMCP 2.7.0 when the scheme's test plan contains both iOS and watchOS unit test targets. The same command, project and simulator pass on 2.6.2.  2.7.0 builds the project and discovers both tests, then the prepared test phase fails to resolve the requested iOS Simulator. Removing only the watchOS test target from the test plan makes 2.7.0 pass.  I have attached a standalone repro with three targets and no dependencies, package manager or code signing.  ### Debug Output  ``` ⚙️ XcodeBuildMCP Doctor     Generated: 2026-08-11T00:51:34.307Z    Server Version: 2.7.0    Output Mode: Redacted (default)  System Information   platform: darwin   release: 25.6.0   arch: arm64   cpus: 15 x Apple M5 Pro   memory: 48 GB   hostname: <redacted>   username: <redacted>   homedir: /Users/<redacted>   tmpdir: /var/folders/ql/lrbqh2nx1615gy6k6tptrdjc0000gn/T  Node.js Information   version: v26.7.0   execPath: /opt/homebrew/Cellar/node/26.7.0/bin/node   pid: 93030   ppid: 89346   platform: darwin   arch: arm64   cwd: /Users/<redacted>/Documents/Work/<redacted>   argv: /opt/homebrew/Cellar/node/26.7.0/bin/node /opt/homebrew/Cellar/xcodebuildmcp/2.7.0/libexec/build/doctor-cli.js  Process Tree   Running under Xcode: No   93030 (ppid 89346): node -- node /opt/homebrew/Cellar/xcodebuildmcp/2.7.0/libexec/build/doctor-cli.js   89346 (ppid 89339): /opt/homebrew/li -- /opt/homebrew/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-arm64/v
  **Post-Mortem & Fix Analysis**:
  > This issue has been inactive for 30 days. It will be closed in 7 days if no further activity occurs. Add a comment to keep it open, or apply the `no-stale` label.
  > Closing due to inactivity. If this is still relevant, please reopen or file a new issue with updated context.

- **Issue #478** (2026-07-21): **Warden: code-review**
  *Symptoms*: ## Warden Scheduled Scan Results  **Run:** 2026-07-20T07:18:39.308Z **Commit:** `60cfdc3`  ### Summary  | Severity | Count | |----------|-------| | Medium | 3 | | Low | 2 |  ### Findings  #### [`src/mcp/tools/macos/stop_mac_app.ts`](https://github.com/getsentry/XcodeBuildMCP/blob/60cfdc357ea6e91744ad85fe3bbe9d037a84d675/src/mcp/tools/macos/stop_mac_app.ts)  - `BHS-GHQ` **`pkill -f` with unvalidated appName may kill unintended processes** ([L68](https://github.com/getsentry/XcodeBuildMCP/blob/60cfdc357ea6e91744ad85fe3bbe9d037a84d675/src/mcp/tools/macos/stop_mac_app.ts#L68)) · medium   `pkill -f` matches the given pattern as a regex against the full command line of every process. Passing an arbitrary user-supplied `appName` here can match and terminate unrelated processes (e.g., a short/common name, or regex metacharacters), and could be abused to kill processes the caller shouldn't be able to target. Consider using `pkill -x` against the executable name, resolving the app to a specific PID first, or at least validating/escaping `appName`. - `ALJ-4DM` **`processId === 0` produces misleading log target** ([L60](https://github.com/getsentry/XcodeBuildMCP/blob/60cfdc357ea6e91744ad85fe3bbe9d037a84d675/src/mcp/tools/macos/stop_mac_app.ts#L60)) · low   On line 63, `params.processId ? \`PID ${params.processId}\` : params.appName!` uses a truthy check, which is inconsistent with the `!== undefined` checks on lines 59 and 68. If `processId === 0` (and `appName` is undefined), `target` b
  **Post-Mortem & Fix Analysis**:
  > I spot-checked the reported findings against `60cfdc3`. All four code paths match the description.  - `stop_mac_app.ts:68` passes raw `params.appName` into `pkill -f`. - `stop_mac_app.ts:63` uses a truthy check that skips `processId === 0`. - `axe-helpers.ts:82` throws instead of returning `null` when the configured source directory is missing or has no release build. - `domain-result-text.ts:1131` dereferences `activeProfile[key]` without guarding for `undefined`. - `bundle-id.ts` returns untrimmed spawn output, leaving a trailing newline for callers to handle.  Consider splitting these into individual issues so they can be assigned and closed independently.
  > Re-triaged each finding against current main and its callers:\n\n- The stop_mac_app finding is valid and more severe than the original report: substring matching can target unrelated processes, while zero or negative PIDs have unsafe kill semantics. I reopened the existing focused issue #306 and opened draft PR #484 with exact-name matching plus schema and execution-boundary PID validation.\n- The AXe helper throwing for an invalid configured source directory is intentional. Project configuration is required context, and the runtime contract is to fail loudly rather than silently fall back.\n- The activeProfile renderer claim is not reachable as reported; its callers only enter the field loop after establishing an active profile.\n- Bundle identifier output is normalized by every current caller. Trimming inside the helper could be a cleanup, but there is no demonstrated user-facing defect.\n\nThe actionable defect is now independently tracked by #306 and PR #484, so I am closing this a

- **Issue #466** (2026-07-22): **[Bug]:  xcodemake incremental builds fails**
  *Symptoms*: ### Bug Description   xcodemake incremental builds fail when derivedDataPath contains slashes; bundled xcodemake also inherits Git safe.bareRepository env  ## Summary  `xcodebuildmcp simulator build` fails when xcodemake incremental builds are enabled. The failure appears to come from the bundled `xcodemake` script constructing its capture log filename from the raw argument list, including `-derivedDataPath /Users/...`, which introduces `/` path separators into the log filename.  The current upstream `johnno1962/xcodemake` appears to have fixed this by writing logs under `.xcodemake/` with sanitized/truncated argument text plus an MD5 hash.  ## Environment  - xcodebuildmcp: 2.6.2 installed via Homebrew - macOS: Darwin - Xcode: 26.4 / build 17E192 - Workflow: `xcodebuildmcp simulator build` - Simulator: iPhone 12  ## Command  ```bash time xcodebuildmcp simulator build \   --scheme MyScheme \   --workspace-path MyWorkspace.xcworkspace  Also reproduced after unsetting Git config env vars:  time env -u GIT_CONFIG_COUNT -u GIT_CONFIG_KEY_0 -u GIT_CONFIG_VALUE_0 \   xcodebuildmcp simulator build \   --scheme MyScheme \   --workspace-path MyWorkspace.xcworkspace  Actual result  The build fails during xcodemake Makefile generation:  xcodemake is enabled and available, using it for incremental builds. Generating Makefile with xcodemake (first build may take longer)  iOS Simulator Build build failed for scheme MyScheme. Incremental build using xcodemake failed, suggest using preferXcod
  **Post-Mortem & Fix Analysis**:
  > I'm new at contributing to open source, but I'm going to take a stab at submitting a PR to resolve this issue. At the very least, I have forked this repo and will know if the update will solve my issue locally. 
  > Confirmed and addressed in draft PR #485, following the merged repair in `cameroncooke/xcodemake#2`.  The XcodeBuildMCP PR updates the checksum-pinned wrapper and always delegates incremental state validation to it. That fixes absolute DerivedData log names while avoiding a stale-Makefile hazard where retained logs from older argument sets could incorrectly select the single project `Makefile`.  Regression coverage executes the exact pinned Perl wrapper with fake `xcodebuild` and `make` binaries and verifies initial capture, matching reuse, changed-argument recapture, project freshness invalidation, and the external absolute DerivedData path from this report.  Local validation passed: lint, format, typecheck, build, the full unit suite (2,894 tests), focused wrapper tests, and independent review. Snapshot and smoke suites were not run because repository policy requires explicit approval.  The inherited Git security configuration and incorrect `xcodebuildmcp doctor` setup guidance are s
  > Progress update: the wrapper lifecycle fixes identified during review are merged upstream in [cameroncooke/xcodemake#3](https://github.com/cameroncooke/xcodemake/pull/3). Draft PR #485 is repinned to the merged commit and now includes regression coverage for Makefile reuse, `-configuration` preservation, and direct fallback. Local lint, typecheck, format, build, focused tests, and the full unit suite pass; the new CI cycle is running.

- **Issue #458** (2026-07-22): **snapshot_ui 'No translation object returned' persists across simulator reboots on iOS 26.5**
  *Symptoms*: ### Summary  `snapshot_ui` / `axe describe-ui` returns `Error: No translation object returned for simulator. This means you have likely specified a point onscreen that is invalid or invisible due to a fullscreen dialog` on **every** call, for **~40 minutes across multiple `shutdown`+`boot` cycles**, on a booted iOS 26.5 simulator where the app and SpringBoard are visibly healthy (screenshots work fine the whole time).  The documented recovery in the AXe skill / #290 (shutdown+boot, wait past the ~5–30s AX-daemon warmup window, use a fresh simulator) did **not** help. The actual root cause turned out to be a **wedged host `CoreSimulatorBridge` process**, and the fix is to kill it so it respawns:  ```sh pgrep -f "/usr/libexec/CoreSimulatorBridge" | xargs kill -9 sleep 2 axe describe-ui --udid <UDID>   # immediately returns a full tree again ```  After the `kill -9`, `describe-ui` / `snapshot_ui` returned a correct hierarchy on the very next call and stayed reliable for the rest of a long session (hundreds of subsequent taps/snapshots). No reboot, no data wipe, no fresh simulator needed.  This looks like the *"different bug"* the maintainer explicitly invited a reproduction of in #290:  > If you ever see the empty hierarchy persist longer than ~30 s on a freshly-booted sim, that would be a different bug than the one #312 was trying to address; we'd be interested in a reproduction.  One nuance vs #290: the symptom here is the **point-only error string** (`No translation object re
  **Post-Mortem & Fix Analysis**:
  > Confirmed and addressed in draft AXe PR cameroncooke/AXe#62: https://github.com/cameroncooke/AXe/pull/62\n\nThe implementation does not use the reported host-wide pgrep/kill -9 workaround. Frontmost hierarchy requests first poll through the observed accessibility warm-up window, then use simctl and launchctl to restart only user/foreground/com.apple.CoreSimulator.bridge for the affected simulator. Recovery is serialized per simulator across processes so overlapping requests share one attempt, while later independent requests can retry.\n\nPoint-based accessibility requests preserve the existing noTranslationObject behavior and never restart the bridge.\n\nValidation passed on Xcode 26.5 and Xcode 27 beta 4 (227 tests on each), plus manual frontmost-hierarchy and point-query validation on iOS 26.5. This issue should remain open until AXe is released and XcodeBuildMCP pins that release.
  > Closing as unable to reproduce on the current matching Xcode/iOS environment. The original observation may still have been real and environmental, but there is not enough evidence to ship automatic CoreSimulator service recovery in AXe.  The investigation used the exact AXe 1.7.1 release binary from this report, Xcode 26.5, iOS 26.5, and fresh iPhone 17 Pro Simulators. Twenty fresh-device trials covered idle operation, sustained Simulator CPU pressure, media-analysis pressure, and combined CPU/media pressure with concurrent AX hierarchy requests, screenshots, and app switching.  Across 1,115 hierarchy requests:  - 1,115 returned valid populated hierarchies; - zero returned `No translation object returned`; - zero produced other failures or timeouts; - zero screenshots failed.  A reproduction required the exact error to continue for at least 30 seconds while the Simulator, SpringBoard, Settings, and screenshots remained healthy. That condition did not occur.  The host was macOS 26.5.2 r

- **Issue #453** (2026-07-21): **Xcode 27 beta: UI automation still fails because bundled AXe looks for SimulatorKit under PrivateFrameworks**
  *Symptoms*: ### Summary  This is a fresh reproduction of the Xcode 27 beta `SimulatorKit.framework` path issue discussed in #446. I am opening a new issue because #446 is closed as not planned, but the current released XcodeBuildMCP still reports UI automation as available while `snapshot_ui` / AXe-backed UI automation fails at runtime.  Build, install, launch, and screenshots still work. The broken part is semantic UI automation / accessibility hierarchy capture / element-ref tapping.  ### Environment  - XcodeBuildMCP: `2.6.2` - AXe reported by doctor: `1.7.1` - Xcode: `Xcode 27.0`, build `27A5194q` - Active developer dir: `/Applications/Xcode-beta.app/Contents/Developer` - macOS/Darwin: `27.0.0` - Host arch: `arm64` - Client: Codex Desktop using XcodeBuildMCP tools  ### What works  These XcodeBuildMCP simulator actions worked against the same app/simulator:  - `build_run_sim` after passing `IPHONEOS_DEPLOYMENT_TARGET=16.4` - `install_app_sim` - `launch_app_sim` - `screenshot`  ### What fails  `mcp__xcodebuildmcp.snapshot_ui` fails after the app is launched:  ```text Failed to get accessibility hierarchy. CLIError(errorDescription: "Failed to load essential private frameworks: Attempting to load a file at path '/Applications/Xcode-beta.app/Contents/Developer/Library/PrivateFrameworks/SimulatorKit.framework', but it does not exist") ```  The framework exists in the Xcode 27 beta bundle at the new location:  ```text /Applications/Xcode-beta.app/Contents/SharedFrameworks/SimulatorKit.frame
  **Post-Mortem & Fix Analysis**:
  > @judiazm Did you find any workaround for this issue? I've stumbled across the same issue and haven’t found a solution by now.
  > Yes I'm working on it, a fix should be out shortly.  On Sat, Jul 18, 2026 at 9:18 AM Michael Biehler ***@***.***> wrote:  > *biehlermi* left a comment (getsentry/XcodeBuildMCP#453) > <https://github.com/getsentry/XcodeBuildMCP/issues/453#issuecomment-5010555932> > > @judiazm <https://github.com/judiazm> Did you find any workaround for > this issue? I've stumbled across the same issue and haven’t found a > solution by now. > > — > Reply to this email directly, view it on GitHub > <https://github.com/getsentry/XcodeBuildMCP/issues/453?email_source=notifications&email_token=AAEZ6SLDT5H6V6IQIXDBJST5FMXDVA5CNFSNUABFM5UWIORPF5TWS5BNNB2WEL2JONZXKZKDN5WW2ZLOOQXTKMBRGA2TKNJZGMZKM4TFMFZW63VGMFZXG2LHN2SWK5TFNZ2KYZTPN52GK4S7MNWGSY3L#issuecomment-5010555932>, > or unsubscribe > <https://github.com/notifications/unsubscribe-auth/AAEZ6SNHIL6Y6JWKVIXKJLL5FMXDVAVCNFSNUABFKJSXA33TNF2G64TZHM4TINJVGUYTGNRRHNEXG43VMU5TINZSGIYTMNRRGQYKC5QC> > . > You are receiving this because you were ass
  > Verified and fixed on `main`.  AXe 1.7.1 reproduces the reported Xcode 27 failure because it only checks `Contents/Developer/Library/PrivateFrameworks/SimulatorKit.framework`. [AXe #60](https://github.com/cameroncooke/AXe/pull/60) added the Xcode 27 `Contents/SharedFrameworks` lookup while retaining the legacy fallback, and its validation included a successful `snapshot_ui` capture under Xcode 27.  [XcodeBuildMCP #479](https://github.com/getsentry/XcodeBuildMCP/pull/479) updates the bundled AXe pin to 1.8.0. I also verified that AXe 1.8.0 loads the simulator frameworks under Xcode 27 beta 4, where 1.7.1 fails with the exact error reported here.  The fix will be included in the next XcodeBuildMCP release. Until then, 2.6.2 remains affected; an explicit AXe 1.8.0 override is the workaround. 

- **Issue #447** (2026-07-12): **[Bug]: suppressWarnings doesn't work**
  *Symptoms*: ### Bug Description  We have a legacy app with many existing warnings, so I'm trying to filter them out of MCP or CLI responses for the agent to  avoid unecessarily filling up context. I've found that suppressWarnings: true in sessionDefaults doesn't work when using either the MCP or the CLI.   This is Claude's analysis of why - it's a different cause for each:  ### 1. The structured/domain result renderer ignores suppressWarnings (affects MCP runtime).  The text the MCP tool returns is produced by createStandardDiagnosticSections in build/utils/renderers/domain-result-text.js, which renders diagnostics.warnings unconditionally:  ```js if (diagnostics.warnings.length > 0) {   sections.push(     createSection(       `Warnings (${diagnostics.warnings.length}):`,       createMarkedDiagnosticLines(diagnostics.warnings, "\u26A0"),       { blankLineAfterTitle: true }     )   ); } ``` suppressWarnings is never threaded into domain-result-text.js / renderDomainResultTextItems. It is only honored in the streaming cli-text transcript path:  ```js // build/utils/renderers/cli-text-renderer.js case "compiler-warning": {   if (!suppressWarnings) {     groupedWarnings.push(item);   }   break; } ```  The diagnostics.warnings array is likewise always populated regardless of the flag:  ```js // build/utils/xcodebuild-domain-results.js function createBasicDiagnostics(state, didError, fallbackErrorMessages) {   const warnings = state.warnings.map((warning) => ({     message: warning.message,   

- **Issue #446** (2026-06-09): **[Bug]: Bundled AXe fails with Xcode 27 because SimulatorKit.framework moved to Contents/SharedFrameworks**
  *Symptoms*: ### Bug Description  When using XcodeBuildMCP with Xcode 27 beta, bundled AXe fails to load SimulatorKit.framework because it assumes the Xcode 26 framework location:  `Contents/Developer/Library/PrivateFrameworks/SimulatorKit.framework`  In Xcode 27, SimulatorKit.framework appears to have moved to:  `Contents/SharedFrameworks/SimulatorKit.framework`  This breaks simulator UI automation / AXe commands that load private simulator frameworks.  ### Debug Output  ``` Running XcodeBuildMCP Doctor (v2.6.2)... Collecting system information and checking dependencies...   ⚙️ XcodeBuildMCP Doctor     Generated: 2026-06-08T23:07:21.993Z    Server Version: 2.6.2    Output Mode: Redacted (default)  System Information   platform: darwin   release: 27.0.0   arch: arm64   cpus: 8 x Apple M3   memory: 16 GB   hostname: <redacted>   username: <redacted>   homedir: /Users/<redacted>   tmpdir: /var/folders/hf/y9db8py56j59mcnr_z039gkh0000gn/T  Node.js Information   version: v25.6.1   execPath: /opt/homebrew/Cellar/node/25.6.1/bin/node   pid: 12525   ppid: 12456   platform: darwin   arch: arm64   cwd: /Users/<redacted>/Documents/workspace/<redacted>   argv: /opt/homebrew/Cellar/node/25.6.1/bin/node /var/folders/hf/y9db8py56j59mcnr_z039gkh0000gn/T/tmp.CplNFz4qjg/_npx/0d0ba08c6c224614/node_modules/.bin/xcodebuildmcp-doctor  Process Tree   Running under Xcode: No   12525 (ppid 12456): node -- node /var/folders/hf/y9db8py56j59mcnr_z039gkh0000gn/T/tmp.CplNFz4qjg/_npx/0d0ba08c6c224614/node_modules/.bin/

- **Issue #440** (2026-06-03): **[Bug]: build_macOS is super slow and hangs my entire mac in Codex.**
  *Symptoms*: ### Bug Description  I usually tell codex to run build_macOS after modifications to verify work. This used to run within a few seconds until recently. It slows my entire Macbook to build whereas building manually via XCode gets done in seconds.  I added `tool_timeout_sec = 600` to codex's config.toml file like mentioned in the [documentation](https://www.xcodebuildmcp.com/docs/troubleshooting) (It wasn't stated under which section so I put it on the top of the file), codex still returns `timed out awaiting tools/call after 120s`.    ### Debug Output  ⚙️ XcodeBuildMCP Doctor     Generated: 2026-06-02T09:40:08.823Z    Server Version: 2.6.0    Output Mode: Redacted (default)  System Information   platform: darwin   release: 25.0.0   arch: arm64   cpus: 8 x Apple M2   memory: 16 GB   hostname: <redacted>   username: <redacted>   homedir: /Users/<redacted>   tmpdir: /var/folders/s0/0vsl_1hs23vgb5blg86p4khh0000gn/T  Node.js Information   version: v25.2.1   execPath: /opt/homebrew/Cellar/node/25.2.1/bin/node   pid: 14357   ppid: 14345   platform: darwin   arch: arm64   cwd: /Users/<redacted>   argv: /opt/homebrew/Cellar/node/25.2.1/bin/node /Users/<redacted>/.npm/_npx/99336612077b7094/node_modules/.bin/xcodebuildmcp-doctor  Process Tree   Running under Xcode: No   14357 (ppid 14345): node -- node /Users/<redacted>/.npm/_npx/99336612077b7094/node_modules/.bin/xcodebuildmcp-doctor   14345 (ppid 768): npm -- exec xcodebu npm exec xcodebuildmcp-doctor   768 (ppid 760): -zsh -- -zsh   76
  **Post-Mortem & Fix Analysis**:
  > Thanks @BarnoTD, a couple of questions:  1. Have you tried using the CLI i.e. `xcodebuildmcp macos build-and-run`? 2. If you can repo with the CLI can you run `xcodebuildmcp macos build-and-run --verbose --output raw` and see where it's getting stuck, also can you send me the output?  or  3. Can you send me a repro project?  
  > Thank you @cameroncooke. I was using XCodeBuildMCP for MCP-server-only, so now I installed xcodebuildmcp globally to try the commands given.   The build was fast and successful. I re-tried by removing the mcp from code, installing xcodebuildmcp (this time via NPM globally) and going through `xcodebuildmcp setup` and `xcodebuild init`. this seems to solve my problem.  **What I was doing wrong:** before, I manually inserted "enabled workflows" and other env variables into Codex's mcp settings because I didn't want to install cli (in order to get macOS workflow). 

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

### Incident Patch 1: `f0e977ec` (2026-09-23)
**Commit Message**: Merge pull request #539 from getsentry/itaybre/fix/release-workflow-failures

ci: Unblock tag-triggered release workflows

**File**: `.github/workflows/sentry.yml` (modified, +4/-0)
```diff
@@ -14,6 +14,10 @@ jobs:
       - uses: actions/checkout@v4
         with:
           fetch-depth: 0
+      - name: Setup Node.js
+        uses: actions/setup-node@v4
+        with:
+          node-version: '24'
       - name: Install dependencies
         run: npm ci
 
```

**File**: `src/snapshot-tests/__tests__/json-fixture-schema.test.ts` (modified, +1/-1)
```diff
@@ -238,7 +238,7 @@ describe('structured JSON fixture schemas', () => {
         expect(result.rawText, probe.toolName).toContain(probe.expectedInfrastructureText);
       }
     }
-  }, 30_000);
+  }, 120_000);
 
   it('rejects the historical schema-valued additionalProperties input', () => {
     expect(() =>
```

---

### Incident Patch 2: `f5706731` (2026-09-23)
**Commit Message**: Merge pull request #538 from getsentry/itaybre/ref/rename-to-mobilebuildmcp

ref!: Rename project to MobileBuildMCP

**File**: `.agents/skills/mobilebuildmcp-docs-command-review/SKILL.md` (renamed, +6/-6)
```diff
@@ -1,10 +1,10 @@
 ---
-name: xcodebuildmcp-docs-command-review
-description: Use when reviewing XcodeBuildMCP changelog CLI command references for invalid current guidance while allowing historical migration examples.
+name: mobilebuildmcp-docs-command-review
+description: Use when reviewing MobileBuildMCP changelog CLI command references for invalid current guidance while allowing historical migration examples.
 allowed-tools: Read Grep Glob
 ---
 
-# XcodeBuildMCP Docs Command Review
+# MobileBuildMCP Docs Command Review
 
 Review changed changelog entries for CLI command references that would mislead users or agents.
 
@@ -20,7 +20,7 @@ Report a finding only when a command reference is presented as current guidance
 
 ### High severity
 
-- A changelog bullet, example, or migration instruction tells users to run a removed or invalid `xcodebuildmcp` command as the current path.
+- A changelog bullet, example, or migration instruction tells users to run a removed or invalid `mobilebuildmcp` command as the current path.
 - A Breaking change mentions a removed command but does not give a valid replacement.
 - A command reference uses the wrong workflow/tool pairing in a way a user or agent would likely copy.
 
@@ -41,10 +41,10 @@ Example that should not be reported:
 
 ```markdown
 Before:
-xcodebuildmcp logging start-sim-log-cap
+mobilebuildmcp logging start-sim-log-cap
 
 After:
-xcodebuildmcp simulator build-and-run
+mobilebuildmcp simulator build-and-run
 ```
 
 ## Output
```

**File**: `.agents/skills/mobilebuildmcp-docs-release-review/SKILL.md` (renamed, +5/-5)
```diff
@@ -1,9 +1,9 @@
 ---
-name: xcodebuildmcp-docs-release-review
-description: Use when reviewing XcodeBuildMCP documentation, CLI command references, website manifest generation, changelog, release notes, and release script changes.
+name: mobilebuildmcp-docs-release-review
+description: Use when reviewing MobileBuildMCP documentation, CLI command references, website manifest generation, changelog, release notes, and release script changes.
 ---
 
-# XcodeBuildMCP Docs and Release Review
+# MobileBuildMCP Docs and Release Review
 
 Review guardrails for documentation, generated references, and release flow consistency.
 
@@ -32,11 +32,11 @@ Review guardrails for documentation, generated references, and release flow cons
 - Website manifest generation preserves expected normalized fields.
 - Docs explain runtime/contracts without deprecated patterns.
 - Keep docs-only work from introducing product behavior changes.
-- CLI command references in changelog entries are reviewed by `xcodebuildmcp-docs-command-review`.
+- CLI command references in changelog entries are reviewed by `mobilebuildmcp-docs-command-review`.
 
 ## Validation
 
 - `npm run build`
 - Release notes check when touched:
   - `node scripts/generate-github-release-notes.mjs --version <version> --changelog CHANGELOG.md`
-- `npx skill-check .agents/skills/xcodebuildmcp-docs-release-review`
+- `npx skill-check .agents/skills/mobilebuildmcp-docs-release-review`
```

**File**: `.agents/skills/mobilebuildmcp-packaging-resource-review/SKILL.md` (renamed, +5/-5)
```diff
@@ -1,9 +1,9 @@
 ---
-name: xcodebuildmcp-packaging-resource-review
-description: Use when reviewing XcodeBuildMCP packaging, resource-root, build artifact, bundled AXe, schema, manifest, and portable macOS distribution changes.
+name: mobilebuildmcp-packaging-resource-review
+description: Use when reviewing MobileBuildMCP packaging, resource-root, build artifact, bundled AXe, schema, manifest, and portable macOS distribution changes.
 ---
 
-# XcodeBuildMCP Packaging and Resource Review
+# MobileBuildMCP Packaging and Resource Review
 
 Review guardrails for package/build/resource integrity and portable distribution.
 
@@ -29,7 +29,7 @@ Review guardrails for package/build/resource integrity and portable distribution
 - Published package `files` includes required runtime resources.
 - Portable package includes `build`, `manifests`, `bundled`, `skills`, `package.json`, and production dependencies.
 - AXe binary/framework expectations remain verified.
-- Wrapper scripts preserve `XCODEBUILDMCP_RESOURCE_ROOT` and `DYLD_FRAMEWORK_PATH`.
+- Wrapper scripts preserve `MOBILEBUILDMCP_RESOURCE_ROOT` and `DYLD_FRAMEWORK_PATH`.
 - Schemas and manifests stay available in installed and portable layouts.
 - Do not assume build outputs exist before `npm run build`.
 - Avoid network-dependent packaging behavior without verification/checksums.
@@ -40,4 +40,4 @@ Review guardrails for package/build/resource integrity and portable distribution
 - Packaging-specific when touched:
   - `npm run package:macos -- --help` (if supported)
   - `npm run verify:portable` after artifact creation
-- `npx skill-check .agents/skills/xcodebuildmcp-packaging-resource-review`
+- `npx skill-check .agents/skills/mobilebuildmcp-packaging-resource-review`
```

**File**: `.agents/skills/mobilebuildmcp-rendering-streaming-review/SKILL.md` (renamed, +4/-4)
```diff
@@ -1,9 +1,9 @@
 ---
-name: xcodebuildmcp-rendering-streaming-review
-description: Use when reviewing XcodeBuildMCP rendering, streaming fragment, next-step, and CLI output mode changes for boundary violations.
+name: mobilebuildmcp-rendering-streaming-review
+description: Use when reviewing MobileBuildMCP rendering, streaming fragment, next-step, and CLI output mode changes for boundary violations.
 ---
 
-# XcodeBuildMCP Rendering and Streaming Review
+# MobileBuildMCP Rendering and Streaming Review
 
 Review guardrails for rendering boundaries, streaming fragments, and output modes.
 
@@ -39,4 +39,4 @@ Review guardrails for rendering boundaries, streaming fragments, and output mode
 - `npm test -- src/runtime/__tests__/tool-invoker.test.ts`
 - `npm run test:snapshots`
 - `npm run typecheck`
-- `npx skill-check .agents/skills/xcodebuildmcp-rendering-streaming-review`
+- `npx skill-check .agents/skills/mobilebuildmcp-rendering-streaming-review`
```

**File**: `.agents/skills/mobilebuildmcp-runtime-boundary-review/SKILL.md` (renamed, +4/-4)
```diff
@@ -1,9 +1,9 @@
 ---
-name: xcodebuildmcp-runtime-boundary-review
-description: Use when reviewing XcodeBuildMCP runtime boundary changes across MCP, direct CLI invocation, daemon-routed tools, and Xcode IDE bridge routing.
+name: mobilebuildmcp-runtime-boundary-review
+description: Use when reviewing MobileBuildMCP runtime boundary changes across MCP, direct CLI invocation, daemon-routed tools, and Xcode IDE bridge routing.
 ---
 
-# XcodeBuildMCP Runtime Boundary Review
+# MobileBuildMCP Runtime Boundary Review
 
 Review guardrails for runtime routing and invocation boundaries.
 
@@ -38,4 +38,4 @@ Review guardrails for runtime routing and invocation boundaries.
 
 - `npm test -- src/runtime/__tests__/tool-invoker.test.ts`
 - `npm run typecheck`
-- `npx skill-check .agents/skills/xcodebuildmcp-runtime-boundary-review`
+- `npx skill-check .agents/skills/mobilebuildmcp-runtime-boundary-review`
```

**File**: `.agents/skills/mobilebuildmcp-snapshot-fixture-review/SKILL.md` (renamed, +3/-3)
```diff
@@ -1,9 +1,9 @@
 ---
-name: xcodebuildmcp-snapshot-fixture-review
-description: Use when reviewing XcodeBuildMCP snapshot fixture changes for MCP, CLI, and JSON output contract integrity.
+name: mobilebuildmcp-snapshot-fixture-review
+description: Use when reviewing MobileBuildMCP snapshot fixture changes for MCP, CLI, and JSON output contract integrity.
 ---
 
-# XcodeBuildMCP Snapshot Fixture Review
+# MobileBuildMCP Snapshot Fixture Review
 
 Review guardrails for fixture and snapshot contract integrity.
 
```

**File**: `.agents/skills/mobilebuildmcp-structured-output-review/SKILL.md` (renamed, +5/-5)
```diff
@@ -1,9 +1,9 @@
 ---
-name: xcodebuildmcp-structured-output-review
-description: Use when reviewing XcodeBuildMCP structured output schema changes, schema versioning, manifest outputSchema metadata, and JSON fixture compatibility.
+name: mobilebuildmcp-structured-output-review
+description: Use when reviewing MobileBuildMCP structured output schema changes, schema versioning, manifest outputSchema metadata, and JSON fixture compatibility.
 ---
 
-# XcodeBuildMCP Structured Output Review
+# MobileBuildMCP Structured Output Review
 
 Review guardrails for structured output schema correctness and compatibility.
 
@@ -24,7 +24,7 @@ Review guardrails for structured output schema correctness and compatibility.
 
 ## Guardrails
 
-- `schema` uses `xcodebuildmcp.output.<name>` format.
+- `schema` uses `mobilebuildmcp.output.<name>` format.
 - `schemaVersion` uses integer strings only.
 - Breaking schema changes create a new versioned schema file.
 - Published schema versions are not removed or mutated incompatibly.
@@ -37,4 +37,4 @@ Review guardrails for structured output schema correctness and compatibility.
 - `npm run test:schema-fixtures`
 - `npm test -- src/core/__tests__/structured-output-schema.test.ts`
 - `npm run typecheck`
-- `npx skill-check .agents/skills/xcodebuildmcp-structured-output-review`
+- `npx skill-check .agents/skills/mobilebuildmcp-structured-output-review`
```

**File**: `.agents/skills/mobilebuildmcp-test-boundary-review/SKILL.md` (renamed, +4/-4)
```diff
@@ -1,9 +1,9 @@
 ---
-name: xcodebuildmcp-test-boundary-review
-description: Use when reviewing XcodeBuildMCP tests for correct unit, snapshot, schema, smoke, and external process boundaries.
+name: mobilebuildmcp-test-boundary-review
+description: Use when reviewing MobileBuildMCP tests for correct unit, snapshot, schema, smoke, and external process boundaries.
 ---
 
-# XcodeBuildMCP Test Boundary Review
+# MobileBuildMCP Test Boundary Review
 
 Review guardrails for test isolation, scope, and contract validation.
 
@@ -38,4 +38,4 @@ Review guardrails for test isolation, scope, and contract validation.
 - `npm test`
 - `npm run typecheck`
 - If fixtures/schemas changed: `npm run test:snapshots` and `npm run test:schema-fixtures`
-- `npx skill-check .agents/skills/xcodebuildmcp-test-boundary-review`
+- `npx skill-check .agents/skills/mobilebuildmcp-test-boundary-review`
```

---

### Incident Patch 3: `116ac5cb` (2026-09-23)
**Commit Message**: fix(scaffolding): Keep existing template repository names

The iOS and macOS template repositories and their release assets still use
the XcodeBuildMCP prefix. Renaming the repositories alone would not help,
because GitHub keeps existing release asset filenames and the download URL
is derived from the repository name. Restore the original names in the
template manager, tests, and local development configs so scaffolding keeps
working. Renaming the templates is a separate follow-up.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `.mcp.json` (modified, +2/-2)
```diff
@@ -14,8 +14,8 @@
       "env": {
         "MOBILEBUILDMCP_DEBUG": "true",
         "MOBILEBUILDMCP_SENTRY_DISABLED": "true",
-        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "../../../MobileBuildMCP-iOS-Template",
-        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "../../../MobileBuildMCP-macOS-Template"
+        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "../../../XcodeBuildMCP-iOS-Template",
+        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "../../../XcodeBuildMCP-macOS-Template"
       }
     }
   }
```

**File**: `.vscode/launch.json` (modified, +2/-2)
```diff
@@ -36,8 +36,8 @@
       "env": {
         "MOBILEBUILDMCP_DEBUG": "true",
         "INCREMENTAL_BUILDS_ENABLED": "false",
-        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-iOS-Template",
-        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-macOS-Template"
+        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-iOS-Template",
+        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-macOS-Template"
       },
       "sourceMaps": true,
       "outFiles": [
```

**File**: `.vscode/mcp.json` (modified, +4/-4)
```diff
@@ -11,8 +11,8 @@
       "env": {
         "MOBILEBUILDMCP_DEBUG": "true",
         "INCREMENTAL_BUILDS_ENABLED": "false",
-        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-iOS-Template",
-        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-macOS-Template"
+        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-iOS-Template",
+        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-macOS-Template"
       }
     },
     "MobileBuildMCP-Dev": {
@@ -27,8 +27,8 @@
       "env": {
         "MOBILEBUILDMCP_DEBUG": "true",
         "INCREMENTAL_BUILDS_ENABLED": "false",
-        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-iOS-Template",
-        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-macOS-Template"
+        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-iOS-Template",
+        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-macOS-Template"
       }
     }
   }
```

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ ESM TypeScript project (`type: module`). Key layers:
    ```
 4. Update `CHANGELOG.md` under `## [Unreleased]`
 5. Update documentation if adding or modifying features
-6. Clone and test against example projects (e.g., `MobileBuildMCP-iOS-Template`) when changes affect runtime behavior
+6. Clone and test against example projects (e.g., `XcodeBuildMCP-iOS-Template`) when changes affect runtime behavior
 7. Push and create a pull request with a clear description
 8. Link any related issues
 
```

**File**: `MobileBuildMCP.code-workspace` (modified, +2/-2)
```diff
@@ -4,10 +4,10 @@
       "path": ".",
     },
     {
-      "path": "../MobileBuildMCP-iOS-Template",
+      "path": "../XcodeBuildMCP-iOS-Template",
     },
     {
-      "path": "../MobileBuildMCP-macOS-Template",
+      "path": "../XcodeBuildMCP-macOS-Template",
     },
   ],
 }
```

**File**: `src/mcp/tools/project-scaffolding/__tests__/scaffold_ios_project.test.ts` (modified, +3/-3)
```diff
@@ -33,7 +33,7 @@ describe('scaffold_ios_project plugin', () => {
       existsSync: (path) => {
         return (
           path.includes('mobilebuild-mcp-template') ||
-          path.includes('MobileBuildMCP-iOS-Template') ||
+          path.includes('XcodeBuildMCP-iOS-Template') ||
           path.includes('/template') ||
           path.endsWith('template') ||
           path.includes('extracted') ||
@@ -163,7 +163,7 @@ describe('scaffold_ios_project plugin', () => {
         '-o',
         expect.stringMatching(/template\.zip$/),
         expect.stringMatching(
-          /https:\/\/github\.com\/getsentry\/MobileBuildMCP-iOS-Template\/releases\/download\/v\d+\.\d+\.\d+\/MobileBuildMCP-iOS-Template-\d+\.\d+\.\d+\.zip/,
+          /https:\/\/github\.com\/getsentry\/XcodeBuildMCP-iOS-Template\/releases\/download\/v\d+\.\d+\.\d+\/XcodeBuildMCP-iOS-Template-\d+\.\d+\.\d+\.zip/,
         ),
       ]);
       expect(unzipOptions).toEqual({
@@ -206,7 +206,7 @@ describe('scaffold_ios_project plugin', () => {
         '-f',
         '-o',
         expect.stringMatching(/template\.zip$/),
-        'https://github.com/getsentry/MobileBuildMCP-iOS-Template/releases/download/v2.0.0/MobileBuildMCP-iOS-Template-2.0.0.zip',
+        'https://github.com/getsentry/XcodeBuildMCP-iOS-Template/releases/download/v2.0.0/XcodeBuildMCP-iOS-Template-2.0.0.zip',
       ]);
 
       await initConfigStoreForTest({ iosTemplatePath: '/mock/template/path' });
```

**File**: `src/mcp/tools/project-scaffolding/__tests__/scaffold_macos_project.test.ts` (modified, +5/-5)
```diff
@@ -133,9 +133,9 @@ describe('scaffold_macos_project plugin', () => {
   describe('Command Generation', () => {
     it('should generate correct curl command for macOS template download', async () => {
       const expectedUrl =
-        'https://github.com/getsentry/MobileBuildMCP-macOS-Template/releases/download/';
+        'https://github.com/getsentry/XcodeBuildMCP-macOS-Template/releases/download/';
 
-      expect(expectedUrl).toContain('MobileBuildMCP-macOS-Template');
+      expect(expectedUrl).toContain('XcodeBuildMCP-macOS-Template');
       expect(expectedUrl).toContain('releases/download');
 
       const expectedFilename = 'template.zip';
@@ -159,14 +159,14 @@ describe('scaffold_macos_project plugin', () => {
 
     it('should generate correct commands for template with version', async () => {
       const testVersion = 'v1.0.0';
-      const expectedUrlWithVersion = `https://github.com/getsentry/MobileBuildMCP-macOS-Template/releases/download/${testVersion}/`;
+      const expectedUrlWithVersion = `https://github.com/getsentry/XcodeBuildMCP-macOS-Template/releases/download/${testVersion}/`;
 
       expect(expectedUrlWithVersion).toContain(testVersion);
-      expect(expectedUrlWithVersion).toContain('MobileBuildMCP-macOS-Template');
+      expect(expectedUrlWithVersion).toContain('XcodeBuildMCP-macOS-Template');
       expect(expectedUrlWithVersion).toContain('releases/download');
       expect(testVersion).toMatch(/^v\d+\.\d+\.\d+$/);
       expect(expectedUrlWithVersion).toBe(
-        `https://github.com/getsentry/MobileBuildMCP-macOS-Template/releases/download/${testVersion}/`,
+        `https://github.com/getsentry/XcodeBuildMCP-macOS-Template/releases/download/${testVersion}/`,
       );
     });
 
```

**File**: `src/utils/template-manager.ts` (modified, +2/-2)
```diff
@@ -12,8 +12,8 @@ import { getConfig } from './config-store.ts';
  */
 export class TemplateManager {
   private static readonly GITHUB_ORG = 'getsentry';
-  private static readonly IOS_TEMPLATE_REPO = 'MobileBuildMCP-iOS-Template';
-  private static readonly MACOS_TEMPLATE_REPO = 'MobileBuildMCP-macOS-Template';
+  private static readonly IOS_TEMPLATE_REPO = 'XcodeBuildMCP-iOS-Template';
+  private static readonly MACOS_TEMPLATE_REPO = 'XcodeBuildMCP-macOS-Template';
 
   /**
    * Get the template path for a specific platform
```

---

### Incident Patch 4: `b7e2a25e` (2026-09-23)
**Commit Message**: test(scaffolding): Expect MobileBuildMCP template repository names

The template manager now downloads from the MobileBuildMCP-iOS-Template and
MobileBuildMCP-macOS-Template repositories. Update the scaffolding tests and
the VS Code launch and MCP configs to use the same names.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `.vscode/launch.json` (modified, +2/-2)
```diff
@@ -36,8 +36,8 @@
       "env": {
         "MOBILEBUILDMCP_DEBUG": "true",
         "INCREMENTAL_BUILDS_ENABLED": "false",
-        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-iOS-Template",
-        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-macOS-Template"
+        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-iOS-Template",
+        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-macOS-Template"
       },
       "sourceMaps": true,
       "outFiles": [
```

**File**: `.vscode/mcp.json` (modified, +4/-4)
```diff
@@ -11,8 +11,8 @@
       "env": {
         "MOBILEBUILDMCP_DEBUG": "true",
         "INCREMENTAL_BUILDS_ENABLED": "false",
-        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-iOS-Template",
-        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-macOS-Template"
+        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-iOS-Template",
+        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-macOS-Template"
       }
     },
     "MobileBuildMCP-Dev": {
@@ -27,8 +27,8 @@
       "env": {
         "MOBILEBUILDMCP_DEBUG": "true",
         "INCREMENTAL_BUILDS_ENABLED": "false",
-        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-iOS-Template",
-        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../XcodeBuildMCP-macOS-Template"
+        "MOBILEBUILDMCP_IOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-iOS-Template",
+        "MOBILEBUILDMCP_MACOS_TEMPLATE_PATH": "${workspaceFolder}/../MobileBuildMCP-macOS-Template"
       }
     }
   }
```

**File**: `src/mcp/tools/project-scaffolding/__tests__/scaffold_ios_project.test.ts` (modified, +3/-3)
```diff
@@ -33,7 +33,7 @@ describe('scaffold_ios_project plugin', () => {
       existsSync: (path) => {
         return (
           path.includes('mobilebuild-mcp-template') ||
-          path.includes('XcodeBuildMCP-iOS-Template') ||
+          path.includes('MobileBuildMCP-iOS-Template') ||
           path.includes('/template') ||
           path.endsWith('template') ||
           path.includes('extracted') ||
@@ -163,7 +163,7 @@ describe('scaffold_ios_project plugin', () => {
         '-o',
         expect.stringMatching(/template\.zip$/),
         expect.stringMatching(
-          /https:\/\/github\.com\/getsentry\/XcodeBuildMCP-iOS-Template\/releases\/download\/v\d+\.\d+\.\d+\/XcodeBuildMCP-iOS-Template-\d+\.\d+\.\d+\.zip/,
+          /https:\/\/github\.com\/getsentry\/MobileBuildMCP-iOS-Template\/releases\/download\/v\d+\.\d+\.\d+\/MobileBuildMCP-iOS-Template-\d+\.\d+\.\d+\.zip/,
         ),
       ]);
       expect(unzipOptions).toEqual({
@@ -206,7 +206,7 @@ describe('scaffold_ios_project plugin', () => {
         '-f',
         '-o',
         expect.stringMatching(/template\.zip$/),
-        'https://github.com/getsentry/XcodeBuildMCP-iOS-Template/releases/download/v2.0.0/XcodeBuildMCP-iOS-Template-2.0.0.zip',
+        'https://github.com/getsentry/MobileBuildMCP-iOS-Template/releases/download/v2.0.0/MobileBuildMCP-iOS-Template-2.0.0.zip',
       ]);
 
       await initConfigStoreForTest({ iosTemplatePath: '/mock/template/path' });
```

**File**: `src/mcp/tools/project-scaffolding/__tests__/scaffold_macos_project.test.ts` (modified, +5/-5)
```diff
@@ -133,9 +133,9 @@ describe('scaffold_macos_project plugin', () => {
   describe('Command Generation', () => {
     it('should generate correct curl command for macOS template download', async () => {
       const expectedUrl =
-        'https://github.com/getsentry/XcodeBuildMCP-macOS-Template/releases/download/';
+        'https://github.com/getsentry/MobileBuildMCP-macOS-Template/releases/download/';
 
-      expect(expectedUrl).toContain('XcodeBuildMCP-macOS-Template');
+      expect(expectedUrl).toContain('MobileBuildMCP-macOS-Template');
       expect(expectedUrl).toContain('releases/download');
 
       const expectedFilename = 'template.zip';
@@ -159,14 +159,14 @@ describe('scaffold_macos_project plugin', () => {
 
     it('should generate correct commands for template with version', async () => {
       const testVersion = 'v1.0.0';
-      const expectedUrlWithVersion = `https://github.com/getsentry/XcodeBuildMCP-macOS-Template/releases/download/${testVersion}/`;
+      const expectedUrlWithVersion = `https://github.com/getsentry/MobileBuildMCP-macOS-Template/releases/download/${testVersion}/`;
 
       expect(expectedUrlWithVersion).toContain(testVersion);
-      expect(expectedUrlWithVersion).toContain('XcodeBuildMCP-macOS-Template');
+      expect(expectedUrlWithVersion).toContain('MobileBuildMCP-macOS-Template');
       expect(expectedUrlWithVersion).toContain('releases/download');
       expect(testVersion).toMatch(/^v\d+\.\d+\.\d+$/);
       expect(expectedUrlWithVersion).toBe(
-        `https://github.com/getsentry/XcodeBuildMCP-macOS-Template/releases/download/${testVersion}/`,
+        `https://github.com/getsentry/MobileBuildMCP-macOS-Template/releases/download/${testVersion}/`,
       );
     });
 
```

---

### Incident Patch 5: `3794c208` (2026-09-23)
**Commit Message**: ref!: Rename project to MobileBuildMCP

Rename every project identifier from XcodeBuildMCP to MobileBuildMCP: the
npm package and CLI binaries, MOBILEBUILDMCP_* environment variables,
mobilebuildmcp:// resource URIs, mobilebuildmcp.output.* structured output
schema IDs, the .mobilebuildmcp/config.yaml project config directory, the
~/Library/Developer/MobileBuildMCP state directory, socket and lock names,
the Homebrew formula, skills, Warden review skills, and snapshot fixtures.

Retire the xcodebuildmcp.com domain, which no longer resolves. Schema $id
URLs now use the raw GitHub URL of this repository, documentation links
point at the MDX sources in the getsentry/xcodebuildmcp.com repository,
and MCP registry publishing switches from DNS auth to GitHub OIDC under
the io.github.getsentry namespace.

External resources that still carry the old name are intentionally kept:
the iOS and macOS template repositories, the Homebrew tap repository, the
website repository, and GitHub secret names.

Remove the old branding images from assets.

BREAKING CHANGE: package name, binaries, environment variables, schema IDs,
resource URIs, config and state directories, and the registry name changed.


**File**: `.agents/skills/mobilebuildmcp-docs-command-review/SKILL.md` (renamed, +6/-6)
```diff
@@ -1,10 +1,10 @@
 ---
-name: xcodebuildmcp-docs-command-review
-description: Use when reviewing XcodeBuildMCP changelog CLI command references for invalid current guidance while allowing historical migration examples.
+name: mobilebuildmcp-docs-command-review
+description: Use when reviewing MobileBuildMCP changelog CLI command references for invalid current guidance while allowing historical migration examples.
 allowed-tools: Read Grep Glob
 ---
 
-# XcodeBuildMCP Docs Command Review
+# MobileBuildMCP Docs Command Review
 
 Review changed changelog entries for CLI command references that would mislead users or agents.
 
@@ -20,7 +20,7 @@ Report a finding only when a command reference is presented as current guidance
 
 ### High severity
 
-- A changelog bullet, example, or migration instruction tells users to run a removed or invalid `xcodebuildmcp` command as the current path.
+- A changelog bullet, example, or migration instruction tells users to run a removed or invalid `mobilebuildmcp` command as the current path.
 - A Breaking change mentions a removed command but does not give a valid replacement.
 - A command reference uses the wrong workflow/tool pairing in a way a user or agent would likely copy.
 
@@ -41,10 +41,10 @@ Example that should not be reported:
 
 ```markdown
 Before:
-xcodebuildmcp logging start-sim-log-cap
+mobilebuildmcp logging start-sim-log-cap
 
 After:
-xcodebuildmcp simulator build-and-run
+mobilebuildmcp simulator build-and-run
 ```
 
 ## Output
```

**File**: `.agents/skills/mobilebuildmcp-docs-release-review/SKILL.md` (renamed, +5/-5)
```diff
@@ -1,9 +1,9 @@
 ---
-name: xcodebuildmcp-docs-release-review
-description: Use when reviewing XcodeBuildMCP documentation, CLI command references, website manifest generation, changelog, release notes, and release script changes.
+name: mobilebuildmcp-docs-release-review
+description: Use when reviewing MobileBuildMCP documentation, CLI command references, website manifest generation, changelog, release notes, and release script changes.
 ---
 
-# XcodeBuildMCP Docs and Release Review
+# MobileBuildMCP Docs and Release Review
 
 Review guardrails for documentation, generated references, and release flow consistency.
 
@@ -32,11 +32,11 @@ Review guardrails for documentation, generated references, and release flow cons
 - Website manifest generation preserves expected normalized fields.
 - Docs explain runtime/contracts without deprecated patterns.
 - Keep docs-only work from introducing product behavior changes.
-- CLI command references in changelog entries are reviewed by `xcodebuildmcp-docs-command-review`.
+- CLI command references in changelog entries are reviewed by `mobilebuildmcp-docs-command-review`.
 
 ## Validation
 
 - `npm run build`
 - Release notes check when touched:
   - `node scripts/generate-github-release-notes.mjs --version <version> --changelog CHANGELOG.md`
-- `npx skill-check .agents/skills/xcodebuildmcp-docs-release-review`
+- `npx skill-check .agents/skills/mobilebuildmcp-docs-release-review`
```

**File**: `.agents/skills/mobilebuildmcp-packaging-resource-review/SKILL.md` (renamed, +5/-5)
```diff
@@ -1,9 +1,9 @@
 ---
-name: xcodebuildmcp-packaging-resource-review
-description: Use when reviewing XcodeBuildMCP packaging, resource-root, build artifact, bundled AXe, schema, manifest, and portable macOS distribution changes.
+name: mobilebuildmcp-packaging-resource-review
+description: Use when reviewing MobileBuildMCP packaging, resource-root, build artifact, bundled AXe, schema, manifest, and portable macOS distribution changes.
 ---
 
-# XcodeBuildMCP Packaging and Resource Review
+# MobileBuildMCP Packaging and Resource Review
 
 Review guardrails for package/build/resource integrity and portable distribution.
 
@@ -29,7 +29,7 @@ Review guardrails for package/build/resource integrity and portable distribution
 - Published package `files` includes required runtime resources.
 - Portable package includes `build`, `manifests`, `bundled`, `skills`, `package.json`, and production dependencies.
 - AXe binary/framework expectations remain verified.
-- Wrapper scripts preserve `XCODEBUILDMCP_RESOURCE_ROOT` and `DYLD_FRAMEWORK_PATH`.
+- Wrapper scripts preserve `MOBILEBUILDMCP_RESOURCE_ROOT` and `DYLD_FRAMEWORK_PATH`.
 - Schemas and manifests stay available in installed and portable layouts.
 - Do not assume build outputs exist before `npm run build`.
 - Avoid network-dependent packaging behavior without verification/checksums.
@@ -40,4 +40,4 @@ Review guardrails for package/build/resource integrity and portable distribution
 - Packaging-specific when touched:
   - `npm run package:macos -- --help` (if supported)
   - `npm run verify:portable` after artifact creation
-- `npx skill-check .agents/skills/xcodebuildmcp-packaging-resource-review`
+- `npx skill-check .agents/skills/mobilebuildmcp-packaging-resource-review`
```

**File**: `.agents/skills/mobilebuildmcp-rendering-streaming-review/SKILL.md` (renamed, +4/-4)
```diff
@@ -1,9 +1,9 @@
 ---
-name: xcodebuildmcp-rendering-streaming-review
-description: Use when reviewing XcodeBuildMCP rendering, streaming fragment, next-step, and CLI output mode changes for boundary violations.
+name: mobilebuildmcp-rendering-streaming-review
+description: Use when reviewing MobileBuildMCP rendering, streaming fragment, next-step, and CLI output mode changes for boundary violations.
 ---
 
-# XcodeBuildMCP Rendering and Streaming Review
+# MobileBuildMCP Rendering and Streaming Review
 
 Review guardrails for rendering boundaries, streaming fragments, and output modes.
 
@@ -39,4 +39,4 @@ Review guardrails for rendering boundaries, streaming fragments, and output mode
 - `npm test -- src/runtime/__tests__/tool-invoker.test.ts`
 - `npm run test:snapshots`
 - `npm run typecheck`
-- `npx skill-check .agents/skills/xcodebuildmcp-rendering-streaming-review`
+- `npx skill-check .agents/skills/mobilebuildmcp-rendering-streaming-review`
```

**File**: `.agents/skills/mobilebuildmcp-runtime-boundary-review/SKILL.md` (renamed, +4/-4)
```diff
@@ -1,9 +1,9 @@
 ---
-name: xcodebuildmcp-runtime-boundary-review
-description: Use when reviewing XcodeBuildMCP runtime boundary changes across MCP, direct CLI invocation, daemon-routed tools, and Xcode IDE bridge routing.
+name: mobilebuildmcp-runtime-boundary-review
+description: Use when reviewing MobileBuildMCP runtime boundary changes across MCP, direct CLI invocation, daemon-routed tools, and Xcode IDE bridge routing.
 ---
 
-# XcodeBuildMCP Runtime Boundary Review
+# MobileBuildMCP Runtime Boundary Review
 
 Review guardrails for runtime routing and invocation boundaries.
 
@@ -38,4 +38,4 @@ Review guardrails for runtime routing and invocation boundaries.
 
 - `npm test -- src/runtime/__tests__/tool-invoker.test.ts`
 - `npm run typecheck`
-- `npx skill-check .agents/skills/xcodebuildmcp-runtime-boundary-review`
+- `npx skill-check .agents/skills/mobilebuildmcp-runtime-boundary-review`
```

**File**: `.agents/skills/mobilebuildmcp-snapshot-fixture-review/SKILL.md` (renamed, +3/-3)
```diff
@@ -1,9 +1,9 @@
 ---
-name: xcodebuildmcp-snapshot-fixture-review
-description: Use when reviewing XcodeBuildMCP snapshot fixture changes for MCP, CLI, and JSON output contract integrity.
+name: mobilebuildmcp-snapshot-fixture-review
+description: Use when reviewing MobileBuildMCP snapshot fixture changes for MCP, CLI, and JSON output contract integrity.
 ---
 
-# XcodeBuildMCP Snapshot Fixture Review
+# MobileBuildMCP Snapshot Fixture Review
 
 Review guardrails for fixture and snapshot contract integrity.
 
```

**File**: `.agents/skills/mobilebuildmcp-structured-output-review/SKILL.md` (renamed, +5/-5)
```diff
@@ -1,9 +1,9 @@
 ---
-name: xcodebuildmcp-structured-output-review
-description: Use when reviewing XcodeBuildMCP structured output schema changes, schema versioning, manifest outputSchema metadata, and JSON fixture compatibility.
+name: mobilebuildmcp-structured-output-review
+description: Use when reviewing MobileBuildMCP structured output schema changes, schema versioning, manifest outputSchema metadata, and JSON fixture compatibility.
 ---
 
-# XcodeBuildMCP Structured Output Review
+# MobileBuildMCP Structured Output Review
 
 Review guardrails for structured output schema correctness and compatibility.
 
@@ -24,7 +24,7 @@ Review guardrails for structured output schema correctness and compatibility.
 
 ## Guardrails
 
-- `schema` uses `xcodebuildmcp.output.<name>` format.
+- `schema` uses `mobilebuildmcp.output.<name>` format.
 - `schemaVersion` uses integer strings only.
 - Breaking schema changes create a new versioned schema file.
 - Published schema versions are not removed or mutated incompatibly.
@@ -37,4 +37,4 @@ Review guardrails for structured output schema correctness and compatibility.
 - `npm run test:schema-fixtures`
 - `npm test -- src/core/__tests__/structured-output-schema.test.ts`
 - `npm run typecheck`
-- `npx skill-check .agents/skills/xcodebuildmcp-structured-output-review`
+- `npx skill-check .agents/skills/mobilebuildmcp-structured-output-review`
```

**File**: `.agents/skills/mobilebuildmcp-test-boundary-review/SKILL.md` (renamed, +4/-4)
```diff
@@ -1,9 +1,9 @@
 ---
-name: xcodebuildmcp-test-boundary-review
-description: Use when reviewing XcodeBuildMCP tests for correct unit, snapshot, schema, smoke, and external process boundaries.
+name: mobilebuildmcp-test-boundary-review
+description: Use when reviewing MobileBuildMCP tests for correct unit, snapshot, schema, smoke, and external process boundaries.
 ---
 
-# XcodeBuildMCP Test Boundary Review
+# MobileBuildMCP Test Boundary Review
 
 Review guardrails for test isolation, scope, and contract validation.
 
@@ -38,4 +38,4 @@ Review guardrails for test isolation, scope, and contract validation.
 - `npm test`
 - `npm run typecheck`
 - If fixtures/schemas changed: `npm run test:snapshots` and `npm run test:schema-fixtures`
-- `npx skill-check .agents/skills/xcodebuildmcp-test-boundary-review`
+- `npx skill-check .agents/skills/mobilebuildmcp-test-boundary-review`
```

---

### Incident Patch 6: `9e848ebc` (2026-08-02)
**Commit Message**: fix(mcp): Complete Codex schema compatibility

Expose Codex-compatible MCP wire schemas for record-shaped environment
inputs and arbitrary Xcode arguments while preserving object-based CLI
and domain inputs.

Add build-first, fail-closed per-tool contract fixtures for both public
schema modes and validate the complete static catalog.

Fixes #491

**File**: `CHANGELOG.md` (modified, +2/-2)
```diff
@@ -2,9 +2,9 @@
 
 ## [Unreleased]
 
-### Fixed
+### Changed
 
-- Fixed Codex MCP tool-schema compatibility and added fail-closed static contract baselines for adaptive and full session-default schemas ([#491](https://github.com/getsentry/XcodeBuildMCP/issues/491)).
+- Dictionary-shaped MCP inputs now use client-compatible wire representations ([#491](https://github.com/getsentry/XcodeBuildMCP/issues/491)). The `env` and `testRunnerEnv` inputs on build, launch, test, and session-default tools are arrays of `{ "key": "...", "value": "..." }` entries, while `xcode_ide_call_tool.arguments` is a JSON object string. XcodeBuildMCP converts these values to their existing internal objects only after MCP input validation.
 
 ## [2.7.0]
 
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -47,10 +47,10 @@
     "license:check": "npx -y license-checker --production --onlyAllow 'MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;Unlicense;FSL-1.1-MIT;BlueOak-1.0.0'",
     "knip": "knip",
     "test": "vitest run",
-    "test:tool-contracts": "npm run build && vitest run --config vitest.contract.config.ts",
     "posttest": "npm run test:warden-watchdog",
     "test:warden-watchdog": "node --test scripts/__tests__/warden-watchdog.test.mjs",
-    "test:schema-fixtures": "vitest run src/snapshot-tests/__tests__/json-fixture-schema.test.ts",
+    "test:schema-fixtures": "npm run build && vitest run --config vitest.schema.config.ts",
+    "test:schema-fixtures:update": "UPDATE_SNAPSHOTS=1 npm run test:schema-fixtures",
     "test:snapshot": "npm run build && vitest run --config vitest.snapshot.config.ts",
     "test:snapshots": "npm run test:snapshot",
     "test:snapshot:device": "npm run build && vitest run --config vitest.snapshot.config.ts src/snapshot-tests/__tests__/device.snapshot.test.ts && vitest run --config vitest.snapshot.config.ts src/snapshot-tests/__tests__/cli-json.snapshot.test.ts src/snapshot-tests/__tests__/mcp-json.snapshot.test.ts -t 'device workflow'",
```

**File**: `src/contract-tests/__tests__/mcp-tool-contracts.test.ts` (removed, +0/-32)
```diff
@@ -1,32 +0,0 @@
-import { execFile } from 'node:child_process';
-import { readFile } from 'node:fs/promises';
-import { fileURLToPath } from 'node:url';
-import { promisify } from 'node:util';
-import { describe, expect, it } from 'vitest';
-import type { McpToolContractFixture } from '../capture-mcp-tool-contracts.ts';
-
-const execFileAsync = promisify(execFile);
-const fixtureDirectory = fileURLToPath(new URL('../fixtures/', import.meta.url));
-
-async function readFixture(mode: 'adaptive' | 'full'): Promise<McpToolContractFixture> {
-  const contents = await readFile(`${fixtureDirectory}mcp-tool-contracts.${mode}.json`, 'utf8');
-  return JSON.parse(contents) as McpToolContractFixture;
-}
-
-async function captureFixture(mode: 'adaptive' | 'full'): Promise<McpToolContractFixture> {
-  const { stdout } = await execFileAsync(process.execPath, [
-    'build/contract-tests/capture-mcp-tool-contracts.js',
-    mode,
-  ]);
-  return JSON.parse(stdout) as McpToolContractFixture;
-}
-
-describe('MCP static tool contracts', () => {
-  it.each(['adaptive', 'full'] as const)(
-    'matches the fail-closed %s schema baseline',
-    async (mode) => {
-      await expect(captureFixture(mode)).resolves.toEqual(await readFixture(mode));
-    },
-    30_000,
-  );
-});
```

**File**: `src/contract-tests/capture-mcp-tool-contracts.ts` (removed, +0/-171)
```diff
@@ -1,171 +0,0 @@
-import { mkdir, writeFile } from 'node:fs/promises';
-import { join } from 'node:path';
-import { pathToFileURL } from 'node:url';
-import { Client } from '@modelcontextprotocol/sdk/client/index.js';
-import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
-import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
-import { getPackageRoot, loadManifest } from '../core/manifest/load-manifest.ts';
-import { initConfigStore } from '../utils/config-store.ts';
-import { getDefaultFileSystemExecutor } from '../utils/execution/index.ts';
-import { importToolModule } from '../core/manifest/import-tool-module.ts';
-import { registerMcpTool } from '../utils/tool-registry.ts';
-
-type ContractMode = 'adaptive' | 'full';
-
-interface ToolContract {
-  name: string;
-  inputSchema: unknown;
-  outputSchema: string | null;
-}
-
-export interface McpToolContractFixture {
-  mode: ContractMode;
-  tools: ToolContract[];
-  outputSchemas: Record<string, unknown>;
-}
-
-function sortJson(value: unknown): unknown {
-  if (Array.isArray(value)) {
-    return value.map(sortJson);
-  }
-  if (typeof value !== 'object' || value === null) {
-    return value;
-  }
-
-  return Object.fromEntries(
-    Object.entries(value)
-      .sort(([left], [right]) => left.localeCompare(right))
-      .map(([key, child]) => [key, sortJson(child)]),
-  );
-}
-
-function assertCodexCompatibleSchema(schema: unknown, label: string): void {
-  if (JSON.stringify(schema).includes('propertyNames')) {
-    throw new Error(`Codex-incompatible propertyNames keyword in ${label}`);
-  }
-}
-
-function hasSessionDefaultsStructuredOutput(value: unknown): boolean {
-  return (
-    typeof value === 'object' &&
-    value !== null &&
-    'schema' in value &&
-    value.schema === 'xcodebuildmcp.output.session-defaults'
-  );
-}
-
-function parseMode(args: string[]): ContractMode {
-  if (args.length < 1 || args.length > 2 || (args[0] !== 'adaptive' && args[0] !== 'full')) {
-    throw new Error('Usage: capture-mcp-tool-contracts <adaptive|full>');
-  }
-  if (args.length === 2 && args[1] !== '--write') {
-    throw new Error('Usage: capture-mcp-tool-contracts <adaptive|full> [--write]');
-  }
-  return args[0];
-}
-
-function outputSchemaReference(
-  outputSchema: { schema: string; version: string } | undefined,
-): string | null {
-  return outputSchema ? `${outputSchema.schema}@${outputSchema.version}` : null;
-}
-
-export async function captureMcpToolContracts(mode: ContractMode): Promise<McpToolContractFixture> {
-  await initConfigStore({
-    cwd: process.cwd(),
-    fs: getDefaultFileSystemExecutor(),
-    overrides: { disableSessionDefaults: mode === 'full' },
-  });
-
-  const manifest = loadManifest();
-  const server = new McpServer({ name: 'mcp-tool-contract-test', version: '1.0.0' });
-  const outputSchemaReferences = new Map<string, string | null>();
-
-  for (const tool of manifest.tools.values()) {
-    const module = await importToolModule(tool.module);
-    registerMcpTool(server, tool, module);
-    outputSchemaReferences.set(tool.names.mcp, outputSchemaReference(tool.outputSchema));
-  }
-
-  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
-  await server.connect(serverTransport);
-  const client = new Client({ name: 'mcp-tool-contract-client', version: '1.0.0' });
-  await client.connect(clientTransport);
-
-  try {
-    const result = await client.listTools();
-    const sessionDefaultsResult = await client.callTool({
-      name: 'session_set_defaults',
-      arguments: { env: { FEATURE_FLAG: mode } },
-    });
-    if (!hasSessionDefaultsStructuredOutput(sessionDefaultsResult.structuredContent)) {
-      throw new Error('session_set_defaults did not reach its domain result through MCP.');
-    }
-    const outputSchemas: Record<string, unknown> = {};
-    return {
-      mode,
-      tools: result.tools
-        .map((tool) => {
-          const outputSchemaReference = outputSchemaReferences.get(tool.name);
-          if (outputSchemaReference === undefined) {
-            throw new Error(`MCP returned an unknown static tool: ${tool.name}`);
-          }
-          if (outputSchemaReference === null) {
-            if (tool.outputSchema !== undefined) {
-              throw new Error(`MCP returned an unexpected output schema for ${tool.name}`);
-            }
-          } else if (tool.outputSchema === undefined) {
-            throw new Error(`MCP omitted the output schema for ${tool.name}`);
-          } else {
-            const normalizedOutputSchema = sortJson(tool.outputSchema);
-            assertCodexCompatibleSchema(normalizedOutputSchema, `${tool.name} output schema`);
-            const existingOutputSchema = outputSchemas[outputSchemaReference];
-            if (
-              existingOutputSchema !== undefined &&
-              JSON.stringify(existingOutputSchema) !== JSON.stringify(normalizedOutputSchema)
-            ) {
-              
```

**File**: `src/core/manifest/import-tool-module.ts` (modified, +3/-1)
```diff
@@ -11,6 +11,7 @@ import { getPackageRoot } from './load-manifest.ts';
 
 export interface ImportedToolModule {
   schema: ToolSchemaShape;
+  mcpSchema: ToolSchemaShape;
   handler: (params: Record<string, unknown>, ctx?: ToolHandlerContext) => Promise<unknown>;
 }
 
@@ -19,7 +20,7 @@ const moduleCache = new Map<string, ImportedToolModule>();
 /**
  * Import a tool module by its manifest module path.
  *
- * Accepts named exports only: `export const schema = ...` and `export const handler = ...`
+ * Accepts named exports only: `schema`, optional MCP-specific `mcpSchema`, and `handler`.
  *
  * @param moduleId - Extensionless module path (e.g., 'mcp/tools/simulator/build_sim')
  * @returns Imported tool module with schema and handler
@@ -50,6 +51,7 @@ export async function importToolModule(moduleId: string): Promise<ImportedToolMo
 
   const result: ImportedToolModule = {
     schema: mod.schema as ToolSchemaShape,
+    mcpSchema: (mod.mcpSchema ?? mod.schema) as ToolSchemaShape,
     handler: mod.handler as (
       params: Record<string, unknown>,
       ctx?: ToolHandlerContext,
```

**File**: `src/core/structured-output-schema.ts` (modified, +1/-2)
```diff
@@ -2,7 +2,6 @@ import fs from 'node:fs';
 import path from 'node:path';
 import { z, type ZodType } from 'zod';
 import { getStructuredOutputSchemasDir } from './resource-root.ts';
-import { normalizeMcpSchemaForCodex } from '../utils/mcp-input-schema.ts';
 
 const SCHEMA_PATTERN = /^xcodebuildmcp\.output\.[a-z0-9-]+$/;
 const SCHEMA_VERSION_PATTERN = /^[0-9]+$/;
@@ -270,7 +269,7 @@ function getMcpOutputSchemaForRegistrationJson(ref: StructuredOutputSchemaRef):
     registrationSchema.$defs = defs;
   }
 
-  return normalizeMcpSchemaForCodex(registrationSchema) as JsonObject;
+  return registrationSchema;
 }
 
 export function getMcpOutputSchemaForRegistration(ref: StructuredOutputSchemaRef): McpOutputSchema {
```

**File**: `src/mcp/tools/device/build_run_device.ts` (modified, +26/-0)
```diff
@@ -36,6 +36,10 @@ import {
 } from '../../../utils/xcodebuild-domain-results.ts';
 import { resolveEffectiveDerivedDataPath } from '../../../utils/derived-data-path.ts';
 import { createBuildInvocationFragment } from '../../../utils/xcodebuild-pipeline.ts';
+import {
+  createEnvironmentVariableInputSchema,
+  normalizeEnvironmentVariableArgument,
+} from '../../../utils/environment-variable-input.ts';
 
 function createBuildRunDeviceRequest(params: BuildRunDeviceParams): BuildInvocationRequest {
   return {
@@ -78,6 +82,12 @@ const buildRunDeviceSchema = z.preprocess(
   withProjectOrWorkspace(baseSchemaObject),
 );
 
+const mcpFullSchemaObject = baseSchemaObject.extend({
+  env: createEnvironmentVariableInputSchema(
+    'Environment variables to pass to the launched app as key-value entries',
+  ),
+});
+
 export type BuildRunDeviceParams = z.infer<typeof buildRunDeviceSchema>;
 type BuildRunDeviceResult = BuildRunResultDomainResult;
 
@@ -300,6 +310,16 @@ const publicSchemaObject = baseSchemaObject.omit({
   preferXcodebuild: true,
 } as const);
 
+const mcpPublicSchemaObject = mcpFullSchemaObject.omit({
+  projectPath: true,
+  workspacePath: true,
+  scheme: true,
+  deviceId: true,
+  configuration: true,
+  derivedDataPath: true,
+  preferXcodebuild: true,
+} as const);
+
 export async function build_run_deviceLogic(
   params: BuildRunDeviceParams,
   executor: CommandExecutor,
@@ -335,6 +355,11 @@ export const schema = getSessionAwareToolSchemaShape({
   legacy: baseSchemaObject,
 });
 
+export const mcpSchema = getSessionAwareToolSchemaShape({
+  sessionAware: mcpPublicSchemaObject,
+  legacy: mcpFullSchemaObject,
+});
+
 export const handler = createSessionAwareTool<BuildRunDeviceParams>({
   internalSchema: toInternalSchema<BuildRunDeviceParams>(buildRunDeviceSchema),
   logicFunction: (params, executor) =>
@@ -345,4 +370,5 @@ export const handler = createSessionAwareTool<BuildRunDeviceParams>({
     { oneOf: ['projectPath', 'workspacePath'], message: 'Provide a project or workspace' },
   ],
   exclusivePairs: [['projectPath', 'workspacePath']],
+  normalizeExplicitArgs: (args) => normalizeEnvironmentVariableArgument(args, 'env'),
 });
```

**File**: `src/mcp/tools/device/launch_app_device.ts` (modified, +21/-0)
```diff
@@ -27,6 +27,10 @@ import {
   buildLaunchSuccess,
   setLaunchResultStructuredOutput,
 } from '../../../utils/app-lifecycle-results.ts';
+import {
+  createEnvironmentVariableInputSchema,
+  normalizeEnvironmentVariableArgument,
+} from '../../../utils/environment-variable-input.ts';
 
 const launchAppDeviceSchema = z.object({
   deviceId: z.string().describe('UDID of the device (obtained from list_devices)'),
@@ -41,11 +45,22 @@ const launchAppDeviceSchema = z.object({
     .describe('Environment variables to pass to the launched app (as key-value dictionary)'),
 });
 
+const mcpFullSchemaObject = launchAppDeviceSchema.extend({
+  env: createEnvironmentVariableInputSchema(
+    'Environment variables to pass to the launched app as key-value entries',
+  ),
+});
+
 const publicSchemaObject = launchAppDeviceSchema.omit({
   deviceId: true,
   bundleId: true,
 } as const);
 
+const mcpPublicSchemaObject = mcpFullSchemaObject.omit({
+  deviceId: true,
+  bundleId: true,
+} as const);
+
 type LaunchAppDeviceParams = z.infer<typeof launchAppDeviceSchema>;
 type LaunchAppDeviceResult = LaunchResultDomainResult;
 
@@ -118,10 +133,16 @@ export const schema = getSessionAwareToolSchemaShape({
   legacy: launchAppDeviceSchema,
 });
 
+export const mcpSchema = getSessionAwareToolSchemaShape({
+  sessionAware: mcpPublicSchemaObject,
+  legacy: mcpFullSchemaObject,
+});
+
 export const handler = createSessionAwareTool<LaunchAppDeviceParams>({
   internalSchema: toInternalSchema<LaunchAppDeviceParams>(launchAppDeviceSchema),
   logicFunction: (params, executor) =>
     launch_app_deviceLogic(params, executor, getDefaultFileSystemExecutor()),
   getExecutor: getDefaultCommandExecutor,
   requirements: [{ allOf: ['deviceId', 'bundleId'], message: 'Provide deviceId and bundleId' }],
+  normalizeExplicitArgs: (args) => normalizeEnvironmentVariableArgument(args, 'env'),
 });
```

---

### Incident Patch 7: `95b89f24` (2026-08-01)
**Commit Message**: fix(mcp): normalize Codex tool schemas

Normalize published MCP schemas for Codex compatibility and add build-first static contract baselines for adaptive and full session-default modes.

Fixes #491

**File**: `CHANGELOG.md` (modified, +6/-1)
```diff
@@ -1,5 +1,11 @@
 # Changelog
 
+## [Unreleased]
+
+### Fixed
+
+- Fixed Codex MCP tool-schema compatibility and added fail-closed static contract baselines for adaptive and full session-default schemas ([#491](https://github.com/getsentry/XcodeBuildMCP/issues/491)).
+
 ## [2.7.0]
 
 ### New! Xcode 27 Device Hub simulator support
@@ -749,4 +755,3 @@ Please note that the UI automation features are an early preview and currently i
 ## [v1.0.1] - 2025-04-02
 - Initial release of XcodeBuildMCP
 - Basic support for building iOS and macOS applications
-
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -47,6 +47,7 @@
     "license:check": "npx -y license-checker --production --onlyAllow 'MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;Unlicense;FSL-1.1-MIT;BlueOak-1.0.0'",
     "knip": "knip",
     "test": "vitest run",
+    "test:tool-contracts": "npm run build && vitest run --config vitest.contract.config.ts",
     "posttest": "npm run test:warden-watchdog",
     "test:warden-watchdog": "node --test scripts/__tests__/warden-watchdog.test.mjs",
     "test:schema-fixtures": "vitest run src/snapshot-tests/__tests__/json-fixture-schema.test.ts",
```

**File**: `src/contract-tests/__tests__/mcp-tool-contracts.test.ts` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+import { execFile } from 'node:child_process';
+import { readFile } from 'node:fs/promises';
+import { fileURLToPath } from 'node:url';
+import { promisify } from 'node:util';
+import { describe, expect, it } from 'vitest';
+import type { McpToolContractFixture } from '../capture-mcp-tool-contracts.ts';
+
+const execFileAsync = promisify(execFile);
+const fixtureDirectory = fileURLToPath(new URL('../fixtures/', import.meta.url));
+
+async function readFixture(mode: 'adaptive' | 'full'): Promise<McpToolContractFixture> {
+  const contents = await readFile(`${fixtureDirectory}mcp-tool-contracts.${mode}.json`, 'utf8');
+  return JSON.parse(contents) as McpToolContractFixture;
+}
+
+async function captureFixture(mode: 'adaptive' | 'full'): Promise<McpToolContractFixture> {
+  const { stdout } = await execFileAsync(process.execPath, [
+    'build/contract-tests/capture-mcp-tool-contracts.js',
+    mode,
+  ]);
+  return JSON.parse(stdout) as McpToolContractFixture;
+}
+
+describe('MCP static tool contracts', () => {
+  it.each(['adaptive', 'full'] as const)(
+    'matches the fail-closed %s schema baseline',
+    async (mode) => {
+      await expect(captureFixture(mode)).resolves.toEqual(await readFixture(mode));
+    },
+    30_000,
+  );
+});
```

**File**: `src/contract-tests/capture-mcp-tool-contracts.ts` (added, +171/-0)
```diff
@@ -0,0 +1,171 @@
+import { mkdir, writeFile } from 'node:fs/promises';
+import { join } from 'node:path';
+import { pathToFileURL } from 'node:url';
+import { Client } from '@modelcontextprotocol/sdk/client/index.js';
+import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
+import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
+import { getPackageRoot, loadManifest } from '../core/manifest/load-manifest.ts';
+import { initConfigStore } from '../utils/config-store.ts';
+import { getDefaultFileSystemExecutor } from '../utils/execution/index.ts';
+import { importToolModule } from '../core/manifest/import-tool-module.ts';
+import { registerMcpTool } from '../utils/tool-registry.ts';
+
+type ContractMode = 'adaptive' | 'full';
+
+interface ToolContract {
+  name: string;
+  inputSchema: unknown;
+  outputSchema: string | null;
+}
+
+export interface McpToolContractFixture {
+  mode: ContractMode;
+  tools: ToolContract[];
+  outputSchemas: Record<string, unknown>;
+}
+
+function sortJson(value: unknown): unknown {
+  if (Array.isArray(value)) {
+    return value.map(sortJson);
+  }
+  if (typeof value !== 'object' || value === null) {
+    return value;
+  }
+
+  return Object.fromEntries(
+    Object.entries(value)
+      .sort(([left], [right]) => left.localeCompare(right))
+      .map(([key, child]) => [key, sortJson(child)]),
+  );
+}
+
+function assertCodexCompatibleSchema(schema: unknown, label: string): void {
+  if (JSON.stringify(schema).includes('propertyNames')) {
+    throw new Error(`Codex-incompatible propertyNames keyword in ${label}`);
+  }
+}
+
+function hasSessionDefaultsStructuredOutput(value: unknown): boolean {
+  return (
+    typeof value === 'object' &&
+    value !== null &&
+    'schema' in value &&
+    value.schema === 'xcodebuildmcp.output.session-defaults'
+  );
+}
+
+function parseMode(args: string[]): ContractMode {
+  if (args.length < 1 || args.length > 2 || (args[0] !== 'adaptive' && args[0] !== 'full')) {
+    throw new Error('Usage: capture-mcp-tool-contracts <adaptive|full>');
+  }
+  if (args.length === 2 && args[1] !== '--write') {
+    throw new Error('Usage: capture-mcp-tool-contracts <adaptive|full> [--write]');
+  }
+  return args[0];
+}
+
+function outputSchemaReference(
+  outputSchema: { schema: string; version: string } | undefined,
+): string | null {
+  return outputSchema ? `${outputSchema.schema}@${outputSchema.version}` : null;
+}
+
+export async function captureMcpToolContracts(mode: ContractMode): Promise<McpToolContractFixture> {
+  await initConfigStore({
+    cwd: process.cwd(),
+    fs: getDefaultFileSystemExecutor(),
+    overrides: { disableSessionDefaults: mode === 'full' },
+  });
+
+  const manifest = loadManifest();
+  const server = new McpServer({ name: 'mcp-tool-contract-test', version: '1.0.0' });
+  const outputSchemaReferences = new Map<string, string | null>();
+
+  for (const tool of manifest.tools.values()) {
+    const module = await importToolModule(tool.module);
+    registerMcpTool(server, tool, module);
+    outputSchemaReferences.set(tool.names.mcp, outputSchemaReference(tool.outputSchema));
+  }
+
+  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
+  await server.connect(serverTransport);
+  const client = new Client({ name: 'mcp-tool-contract-client', version: '1.0.0' });
+  await client.connect(clientTransport);
+
+  try {
+    const result = await client.listTools();
+    const sessionDefaultsResult = await client.callTool({
+      name: 'session_set_defaults',
+      arguments: { env: { FEATURE_FLAG: mode } },
+    });
+    if (!hasSessionDefaultsStructuredOutput(sessionDefaultsResult.structuredContent)) {
+      throw new Error('session_set_defaults did not reach its domain result through MCP.');
+    }
+    const outputSchemas: Record<string, unknown> = {};
+    return {
+      mode,
+      tools: result.tools
+        .map((tool) => {
+          const outputSchemaReference = outputSchemaReferences.get(tool.name);
+          if (outputSchemaReference === undefined) {
+            throw new Error(`MCP returned an unknown static tool: ${tool.name}`);
+          }
+          if (outputSchemaReference === null) {
+            if (tool.outputSchema !== undefined) {
+              throw new Error(`MCP returned an unexpected output schema for ${tool.name}`);
+            }
+          } else if (tool.outputSchema === undefined) {
+            throw new Error(`MCP omitted the output schema for ${tool.name}`);
+          } else {
+            const normalizedOutputSchema = sortJson(tool.outputSchema);
+            assertCodexCompatibleSchema(normalizedOutputSchema, `${tool.name} output schema`);
+            const existingOutputSchema = outputSchemas[outputSchemaReference];
+            if (
+              existingOutputSchema !== undefined &&
+              JSON.stringify(existingOutputSchema) !== JSON.stringify(normalizedOutputSchema)
+            ) {
+              
```

**File**: `src/core/structured-output-schema.ts` (modified, +2/-1)
```diff
@@ -2,6 +2,7 @@ import fs from 'node:fs';
 import path from 'node:path';
 import { z, type ZodType } from 'zod';
 import { getStructuredOutputSchemasDir } from './resource-root.ts';
+import { normalizeMcpSchemaForCodex } from '../utils/mcp-input-schema.ts';
 
 const SCHEMA_PATTERN = /^xcodebuildmcp\.output\.[a-z0-9-]+$/;
 const SCHEMA_VERSION_PATTERN = /^[0-9]+$/;
@@ -269,7 +270,7 @@ function getMcpOutputSchemaForRegistrationJson(ref: StructuredOutputSchemaRef):
     registrationSchema.$defs = defs;
   }
 
-  return registrationSchema;
+  return normalizeMcpSchemaForCodex(registrationSchema) as JsonObject;
 }
 
 export function getMcpOutputSchemaForRegistration(ref: StructuredOutputSchemaRef): McpOutputSchema {
```

**File**: `src/utils/__tests__/mcp-input-schema.test.ts` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+import { describe, expect, it } from 'vitest';
+import * as z from 'zod';
+import { getMcpInputSchemaForRegistration } from '../mcp-input-schema.ts';
+
+describe('getMcpInputSchemaForRegistration', () => {
+  it('removes redundant record propertyNames without changing input parsing', () => {
+    const inputSchema = getMcpInputSchemaForRegistration({
+      env: z.record(z.string(), z.string()).optional(),
+    });
+
+    expect(inputSchema.parse({ env: { FEATURE_FLAG: 'true' } })).toEqual({
+      env: { FEATURE_FLAG: 'true' },
+    });
+    expect(JSON.stringify(z.toJSONSchema(inputSchema))).not.toContain('propertyNames');
+  });
+
+  it('keeps record key constraints at the parsing boundary', () => {
+    const inputSchema = getMcpInputSchemaForRegistration({
+      env: z.record(z.string().regex(/^APP_/), z.string()),
+    });
+
+    expect(() => inputSchema.parse({ env: { FEATURE_FLAG: 'true' } })).toThrow();
+    expect(JSON.stringify(z.toJSONSchema(inputSchema))).not.toContain('propertyNames');
+  });
+});
```

**File**: `src/utils/mcp-input-schema.ts` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+import * as z from 'zod';
+import type { ToolSchemaShape } from '../core/plugin-types.ts';
+
+type JsonObject = Record<string, unknown>;
+
+function isJsonObject(value: unknown): value is JsonObject {
+  return typeof value === 'object' && value !== null && !Array.isArray(value);
+}
+
+function cloneJson<T>(value: T): T {
+  return JSON.parse(JSON.stringify(value)) as T;
+}
+
+export function normalizeMcpSchemaForCodex(value: unknown): unknown {
+  if (Array.isArray(value)) {
+    return value.map(normalizeMcpSchemaForCodex);
+  }
+  if (!isJsonObject(value)) {
+    return value;
+  }
+
+  const normalized: JsonObject = {};
+  for (const [key, child] of Object.entries(value)) {
+    if (key === 'propertyNames') {
+      continue;
+    }
+    normalized[key] = normalizeMcpSchemaForCodex(child);
+  }
+  return normalized;
+}
+
+/**
+ * Wraps a tool's raw Zod shape so its published MCP schema omits
+ * `propertyNames` emitted for records. The original Zod schema remains responsible
+ * for parsing tool arguments, including any property-name constraints.
+ */
+export function getMcpInputSchemaForRegistration(shape: ToolSchemaShape): z.ZodType {
+  const schema = z.object(shape);
+  const normalizedJsonSchema = normalizeMcpSchemaForCodex(z.toJSONSchema(schema));
+  const schemaWithJsonHook = schema as z.ZodType & {
+    _zod?: { toJSONSchema?: () => JsonObject };
+  };
+
+  if (!schemaWithJsonHook._zod) {
+    throw new Error('Zod schema internals are unavailable for MCP input schema registration.');
+  }
+  if (!isJsonObject(normalizedJsonSchema)) {
+    throw new Error('MCP input schema registration must produce a JSON object.');
+  }
+
+  schemaWithJsonHook._zod.toJSONSchema = (): JsonObject => cloneJson(normalizedJsonSchema);
+  return schema;
+}
```

**File**: `src/utils/tool-registry.ts` (modified, +34/-12)
```diff
@@ -1,4 +1,4 @@
-import { type RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
+import { type McpServer, type RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
 import { server } from '../server/server-state.ts';
 import type { ToolResponse } from '../types/common.ts';
 import type { ToolCatalog, ToolDefinition } from '../runtime/types.ts';
@@ -21,6 +21,7 @@ import { createRenderSession } from '../rendering/render.ts';
 import type { StructuredOutputEnvelope } from '../types/structured-output.ts';
 import { toStructuredEnvelope } from './structured-output-envelope.ts';
 import { getMcpOutputSchemaForRegistration } from '../core/structured-output-schema.ts';
+import { getMcpInputSchemaForRegistration } from './mcp-input-schema.ts';
 
 type RenderSession = ReturnType<typeof createRenderSession>;
 
@@ -294,6 +295,27 @@ async function invokeRegisteredTool(
   }
 }
 
+export function createMcpToolRegistrationConfig(
+  toolManifest: ToolManifestEntry,
+  toolModule: ImportedToolModule,
+): {
+  description: string;
+  inputSchema: ReturnType<typeof getMcpInputSchemaForRegistration>;
+  outputSchema?: ReturnType<typeof getMcpOutputSchemaForRegistration>;
+  annotations: ToolManifestEntry['annotations'];
+} {
+  const outputSchema = toolManifest.outputSchema
+    ? getMcpOutputSchemaForRegistration(toolManifest.outputSchema)
+    : undefined;
+
+  return {
+    description: toolManifest.description ?? '',
+    inputSchema: getMcpInputSchemaForRegistration(toolModule.schema),
+    ...(outputSchema ? { outputSchema } : {}),
+    annotations: toolManifest.annotations,
+  };
+}
+
 function registerToolFromManifest(
   toolManifest: ToolManifestEntry,
   toolModule: ImportedToolModule,
@@ -307,21 +329,21 @@ function registerToolFromManifest(
     return;
   }
 
-  const outputSchema = toolManifest.outputSchema
-    ? getMcpOutputSchemaForRegistration(toolManifest.outputSchema)
-    : undefined;
+  const registeredTool = registerMcpTool(server, toolManifest, toolModule);
+  registryState.tools.set(toolName, registeredTool);
+}
 
-  const registeredTool = server.registerTool(
+export function registerMcpTool(
+  mcpServer: McpServer,
+  toolManifest: ToolManifestEntry,
+  toolModule: ImportedToolModule,
+): RegisteredTool {
+  const toolName = toolManifest.names.mcp;
+  return mcpServer.registerTool(
     toolName,
-    {
-      description: toolManifest.description ?? '',
-      inputSchema: toolModule.schema,
-      ...(outputSchema ? { outputSchema } : {}),
-      annotations: toolManifest.annotations,
-    },
+    createMcpToolRegistrationConfig(toolManifest, toolModule),
     (args: unknown): Promise<ToolResponse> => invokeRegisteredTool(toolName, toolModule, args),
   );
-  registryState.tools.set(toolName, registeredTool);
 }
 
 function shouldExposeTool(
```

---

### Incident Patch 8: `61795738` (2026-07-23)
**Commit Message**: fix(security): harden shell arguments and workflow permissions (#488)

* fix(security): Resolve CodeQL alerts

* fix(security): Guard shell executable option parsing

* fix(security): Use portable command relay

**File**: `.github/workflows/ci.yml` (modified, +3/-0)
```diff
@@ -6,6 +6,9 @@ on:
   pull_request:
     branches: [main]
 
+permissions:
+  contents: read
+
 jobs:
   build-and-test:
     runs-on: ubuntu-latest
```

**File**: `.github/workflows/sentry.yml` (modified, +3/-0)
```diff
@@ -4,6 +4,9 @@ on:
     tags:
       - 'v*'
 
+permissions:
+  contents: read
+
 jobs:
   release:
     runs-on: ubuntu-latest
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@
 - Fixed `stop_mac_app` app-name targeting so it no longer terminates unrelated processes whose command lines contain the app name, and reject unsafe process IDs before execution ([#306](https://github.com/getsentry/XcodeBuildMCP/issues/306)).
 - Fixed incremental `xcodemake` builds when DerivedData uses an absolute path by updating the pinned wrapper and delegating Makefile reuse to it so its argument and freshness checks are always applied ([#466](https://github.com/getsentry/XcodeBuildMCP/issues/466)).
 - Fixed the scheduled Warden sweep to authenticate through OpenRouter and track the current v0 action release ([#483](https://github.com/getsentry/XcodeBuildMCP/issues/483)).
+- Fixed shell-mode command execution so environment-derived arguments never become shell source, and restricted CI and Sentry release workflows to read-only repository access.
 
 ## [2.6.2]
 
```

**File**: `src/utils/__tests__/command.test.ts` (modified, +62/-0)
```diff
@@ -1,7 +1,69 @@
+import { chmod, mkdtemp, rm, writeFile } from 'fs/promises';
+import { tmpdir } from 'os';
+import { join } from 'path';
 import { describe, expect, it } from 'vitest';
 import { __getRealCommandExecutor } from '../command.ts';
 
 describe('defaultExecutor', () => {
+  it('passes arguments literally when shell execution is requested', async () => {
+    const executor = __getRealCommandExecutor();
+    const argumentsWithMetacharacters = [
+      '$(printf injected)',
+      '`printf injected`',
+      'value; printf injected',
+      '$HOME',
+      "single'quote",
+    ];
+
+    const result = await executor(
+      ['/usr/bin/printf', '%s\n', ...argumentsWithMetacharacters],
+      'Shell Argument Test',
+      true,
+    );
+
+    expect(result).toMatchObject({
+      success: true,
+      exitCode: 0,
+      output: `${argumentsWithMetacharacters.join('\n')}\n`,
+    });
+  });
+
+  it('treats a leading-dash executable as a command name when shell execution is requested', async () => {
+    const executableDirectory = await mkdtemp(join(tmpdir(), 'xcodebuildmcp-command-'));
+    const executablePath = join(executableDirectory, '-c');
+    await writeFile(executablePath, '#!/bin/sh\nprintf "%s\\n" "$@"\n', 'utf8');
+    await chmod(executablePath, 0o700);
+
+    try {
+      const executor = __getRealCommandExecutor();
+      const result = await executor(['-c', 'literal argument'], 'Shell Executable Test', true, {
+        env: { PATH: executableDirectory },
+      });
+
+      expect(result).toMatchObject({
+        success: true,
+        exitCode: 0,
+        output: 'literal argument\n',
+      });
+    } finally {
+      await rm(executableDirectory, { recursive: true, force: true });
+    }
+  });
+
+  it('returns an exit response when a shell-mode executable is missing', async () => {
+    const executor = __getRealCommandExecutor();
+    const result = await executor(
+      ['xcodebuildmcp-command-that-does-not-exist'],
+      'Missing Shell Executable Test',
+      true,
+    );
+
+    expect(result).toMatchObject({
+      success: false,
+      exitCode: 127,
+    });
+  });
+
   it('settles after exit even when child close is delayed', async () => {
     const executor = __getRealCommandExecutor();
     const startedAt = Date.now();
```

**File**: `src/utils/command.ts` (modified, +8/-9)
```diff
@@ -18,17 +18,15 @@ async function defaultExecutor(
   opts?: CommandExecOptions,
   detached: boolean = false,
 ): Promise<CommandResponse> {
-  let escapedCommand = command;
-  if (useShell) {
-    const commandString = command.map((arg) => shellEscapeArg(arg)).join(' ');
+  let executable = command[0];
+  let args = command.slice(1);
 
-    escapedCommand = ['/bin/sh', '-c', commandString];
+  if (useShell) {
+    executable = '/usr/bin/env';
+    args = ['--', ...command];
   }
 
   return new Promise((resolve, reject) => {
-    let executable = escapedCommand[0];
-    let args = escapedCommand.slice(1);
-
     if (!useShell && executable === 'xcodebuild') {
       const xcrunPath = '/usr/bin/xcrun';
       if (existsSync(xcrunPath)) {
@@ -37,8 +35,9 @@ async function defaultExecutor(
       }
     }
 
-    const displayCommand =
-      useShell && escapedCommand.length === 3 ? escapedCommand[2] : [executable, ...args].join(' ');
+    const displayCommand = useShell
+      ? command.map((arg) => shellEscapeArg(arg)).join(' ')
+      : [executable, ...args].join(' ');
     log('debug', `Executing ${logPrefix ?? ''} command: ${displayCommand}`);
 
     const emitTranscript = transcriptEmitterStorage.getStore();
```

---

### Incident Patch 9: `bc54feeb` (2026-07-23)
**Commit Message**: Fix badge links in README.md

Updated badge links in the README file.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 A Model Context Protocol (MCP) server and CLI that provides tools for agent use when working on iOS and macOS projects.
 
 [![CI](https://github.com/getsentry/XcodeBuildMCP/actions/workflows/ci.yml/badge.svg)](https://github.com/getsentry/XcodeBuildMCP/actions/workflows/ci.yml)
-[![npm version](https://badge.fury.io/js/xcodebuildmcp.svg)](https://badge.fury.io/js/xcodebuildmcp) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Node.js](https://img.shields.io/badge/node->=18.x-brightgreen.svg)](https://nodejs.org/) [![Xcode 16](https://img.shields.io/badge/Xcode-16-blue.svg)](https://developer.apple.com/xcode/) [![macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://www.apple.com/macos/) [![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/getsentry/XcodeBuildMCP) [![AgentAudit Security](https://img.shields.io/badge/AgentAudit-Safe-brightgreen?logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAxTDMgNXY2YzAgNS41NSAzLjg0IDEwLjc0IDkgMTIgNS4xNi0xLjI2IDktNi40NSA5LTEyVjVsLTktNHoiLz48L3N2Zz4=)](https://www.agentaudit.dev/skills/xcodebuildmcp)
+[![npm version](https://badge.fury.io/js/xcodebuildmcp.svg)](https://badge.fury.io/js/xcodebuildmcp) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Node.js](https://img.shields.io/badge/node->=18.x-brightgreen.svg)](https://nodejs.org/) [![Xcode 16](https://img.shields.io/badge/Xcode-16-blue.svg)](https://developer.apple.com/xcode/) [![macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://www.apple.com/macos/) [![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/getsentry/XcodeBuildMCP) [![AgentAudit Security](https://img.shields.io/badge/AgentAudit-Safe-brightgreen?logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAxTDMgNXY2YzAgNS41NSAzLjg0IDEwLjc0IDkgMTIgNS4xNi0xLjI2IDktNi40NSA5LTEyVjVsLTktNHoiLz48L3N2Zz4=)](https://www.agentaudit.dev/skills/xcodebuildmcp) [![pkg.pr.new](https://pkg.pr.new/badge/getsentry/XcodeBuildMCP)](https://pkg.pr.new/~/getsentry/XcodeBuildMCP)
 
 ## Installation
 
```

---

### Incident Patch 10: `a7d367fa` (2026-07-22)
**Commit Message**: fix(macos): prevent stop_mac_app from terminating unrelated processes (#484)

* fix(macos): Target app processes exactly

Stop macOS apps by exact executable name instead of matching the app name against every process argument. Reject empty app names and unsafe process IDs before command execution.

Fixes #306

* fix(macos): Validate process IDs at execution boundary

Reject unsafe process IDs before constructing or invoking kill, even when callers bypass the typed-tool schema.

Refs #306

* fix: reject unsafe macOS process IDs in schema

* fix: support long macOS app names

* fix(macos): Match app names by process name

Use killall instead of full-command regular expressions so later arguments cannot select unrelated processes.

Refs #306

* test(macos): Clarify long app name coverage

Name the unit test for its command-construction boundary; host-level validation covers actual process selection.

Refs #306

* fix(macos): Sanitize invalid stop artifacts

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@
 - Fixed `suppressWarnings` being ignored in settled build, build-run, and test output. The flag was honored only while streaming, so warnings still reached the final MCP tool response ([#447](https://github.com/getsentry/XcodeBuildMCP/issues/447)).
 - Fixed iOS scaffold orientation and device-family settings, LLDB command isolation and argument escaping, run-destination parsing without an active scheme, concurrent working-directory mutations, blocking physical-device name lookup, and unverified `xcodemake` downloads ([#459](https://github.com/getsentry/XcodeBuildMCP/issues/459)).
 - Fixed simulator UI launching and keyboard controls to prefer Xcode 27's Device Hub when available, with Simulator.app as the legacy fallback.
+- Fixed `stop_mac_app` app-name targeting so it no longer terminates unrelated processes whose command lines contain the app name, and reject unsafe process IDs before execution ([#306](https://github.com/getsentry/XcodeBuildMCP/issues/306)).
 - Fixed incremental `xcodemake` builds when DerivedData uses an absolute path by updating the pinned wrapper and delegating Makefile reuse to it so its argument and freshness checks are always applied ([#466](https://github.com/getsentry/XcodeBuildMCP/issues/466)).
 
 ## [2.6.2]
```

**File**: `src/mcp/tools/macos/__tests__/stop_mac_app.test.ts` (modified, +90/-28)
```diff
@@ -1,6 +1,11 @@
 import { describe, it, expect } from 'vitest';
 import { schema, handler, stop_mac_appLogic } from '../stop_mac_app.ts';
-import { allText, runLogic } from '../../../../test-utils/test-helpers.ts';
+import {
+  allText,
+  createMockToolHandlerContext,
+  runLogic,
+} from '../../../../test-utils/test-helpers.ts';
+import { createMockExecutor, createNoopExecutor } from '../../../../test-utils/mock-executors.ts';
 
 describe('stop_mac_app plugin', () => {
   describe('Export Field Validation (Literal)', () => {
@@ -17,28 +22,53 @@ describe('stop_mac_app plugin', () => {
 
       // Test invalid inputs
       expect(schema.appName.safeParse(null).success).toBe(false);
+      expect(schema.appName.safeParse('').success).toBe(false);
       expect(schema.processId.safeParse('not-number').success).toBe(false);
       expect(schema.processId.safeParse(null).success).toBe(false);
+      expect(schema.processId.safeParse(0).success).toBe(false);
+      expect(schema.processId.safeParse(-1).success).toBe(false);
+      expect(schema.processId.safeParse(1.5).success).toBe(false);
+      expect(schema.processId.safeParse(Number.NaN).success).toBe(false);
+      expect(schema.processId.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
     });
   });
 
   describe('Input Validation', () => {
     it('should return exact validation error for missing parameters', async () => {
-      const mockExecutor = async () => ({ success: true, output: '', process: {} as any });
-      const result = await runLogic(() => stop_mac_appLogic({}, mockExecutor));
+      const result = await runLogic(() => stop_mac_appLogic({}, createNoopExecutor()));
 
       expect(result.isError).toBe(true);
       expect(allText(result)).toContain('appName or processId');
     });
+
+    it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
+      'should reject unsafe process ID %s at the execution boundary',
+      async (processId) => {
+        const calls: string[][] = [];
+        const executor = createMockExecutor({ onExecute: (command) => calls.push(command) });
+        const { ctx, result, run } = createMockToolHandlerContext();
+
+        await run(() => stop_mac_appLogic({ processId }, executor));
+
+        expect(result.isError()).toBe(true);
+        expect(result.text()).toContain('processId must be a positive safe integer');
+        const structuredResult = ctx.structuredOutput?.result;
+        expect(structuredResult?.kind).toBe('stop-result');
+        if (structuredResult?.kind !== 'stop-result') {
+          throw new Error('Expected stop-result structured output.');
+        }
+        expect(structuredResult.artifacts).toEqual({ appName: '' });
+        expect(calls).toHaveLength(0);
+      },
+    );
   });
 
   describe('Command Generation', () => {
     it('should generate correct command for process ID', async () => {
-      const calls: any[] = [];
-      const mockExecutor = async (command: string[]) => {
-        calls.push({ command });
-        return { success: true, output: '', process: {} as any };
-      };
+      const calls: string[][] = [];
+      const mockExecutor = createMockExecutor({
+        onExecute: (command) => calls.push(command),
+      });
 
       await runLogic(() =>
         stop_mac_appLogic(
@@ -50,35 +80,69 @@ describe('stop_mac_app plugin', () => {
       );
 
       expect(calls).toHaveLength(1);
-      expect(calls[0].command).toEqual(['kill', '1234']);
+      expect(calls[0]).toEqual(['kill', '1234']);
     });
 
-    it('should generate correct command for app name', async () => {
-      const calls: any[] = [];
-      const mockExecutor = async (command: string[]) => {
-        calls.push({ command });
-        return { success: true, output: '', process: {} as any };
-      };
+    it('should target app names by literal process name', async () => {
+      const calls: string[][] = [];
+      const mockExecutor = createMockExecutor({
+        onExecute: (command) => calls.push(command),
+      });
 
       await runLogic(() =>
         stop_mac_appLogic(
           {
-            appName: 'Calculator',
+            appName: 'Brimday',
           },
           mockExecutor,
         ),
       );
 
       expect(calls).toHaveLength(1);
-      expect(calls[0].command).toEqual(['pkill', '-f', 'Calculator']);
+      expect(calls[0]).toEqual(['killall', '--', 'Brimday']);
+    });
+
+    it('should pass long app executable names to killall', async () => {
+      const calls: string[][] = [];
+      const mockExecutor = createMockExecutor({
+        onExecute: (command) => calls.push(command),
+      });
+
+      await runLogic(() =>
+        stop_mac_appLogic(
+          {
+            appName: 'ThisIsAVeryLongApplicationName',
+          },
+          mockExecutor,
+        ),
+      );
+
+      expect(calls[0]).toEqual(['killall', '--', 'ThisIsAVeryLongApplicationName']);
+    });
+
+    it('should treat app names as literal process names', async () 
```

**File**: `src/mcp/tools/macos/stop_mac_app.ts` (modified, +21/-7)
```diff
@@ -14,8 +14,13 @@ import {
 } from '../../../utils/app-lifecycle-results.ts';
 
 const stopMacAppSchema = z.object({
-  appName: z.string().optional(),
-  processId: z.number().optional(),
+  appName: z.string().min(1).optional(),
+  processId: z
+    .number()
+    .int()
+    .positive()
+    .refine(Number.isSafeInteger, 'processId must be a positive safe integer.')
+    .optional(),
 });
 
 type StopMacAppParams = z.infer<typeof stopMacAppSchema>;
@@ -54,20 +59,29 @@ export function createStopMacAppExecutor(
   executor: CommandExecutor,
 ): NonStreamingExecutor<StopMacAppParams, StopMacAppResult> {
   return async (params) => {
-    const artifacts = createStopMacAppArtifacts(params);
-
     if (!params.appName && params.processId === undefined) {
-      return buildStopFailure(artifacts, 'Either appName or processId must be provided.');
+      return buildStopFailure({ appName: '' }, 'Either appName or processId must be provided.');
     }
 
-    const target = params.processId ? `PID ${params.processId}` : params.appName!;
+    if (
+      params.processId !== undefined &&
+      (!Number.isSafeInteger(params.processId) || params.processId <= 0)
+    ) {
+      return buildStopFailure(
+        { appName: params.appName ?? '' },
+        'processId must be a positive safe integer.',
+      );
+    }
+
+    const artifacts = createStopMacAppArtifacts(params);
+    const target = params.processId !== undefined ? `PID ${params.processId}` : params.appName!;
     log('info', `Stopping macOS app: ${target}`);
 
     try {
       const command =
         params.processId !== undefined
           ? ['kill', String(params.processId)]
-          : ['pkill', '-f', params.appName!];
+          : ['killall', '--', params.appName!];
       const result = await executor(command, 'Stop macOS App');
 
       if (!result.success) {
```

**File**: `src/smoke-tests/__tests__/e2e-mcp-device-macos.test.ts` (modified, +3/-3)
```diff
@@ -20,7 +20,7 @@ beforeAll(async () => {
       'xctrace list devices': { success: true, output: 'No devices found.' },
       open: { success: true, output: '' },
       kill: { success: true, output: '' },
-      pkill: { success: true, output: '' },
+      killall: { success: true, output: '' },
       'defaults read': { success: true, output: 'io.sentry.MyApp' },
       PlistBuddy: { success: true, output: 'io.sentry.MyApp' },
       xcresulttool: { success: true, output: '{}' },
@@ -328,7 +328,7 @@ describe('MCP Device and macOS Tool Invocation (e2e)', () => {
       expect(commandStrs.some((c) => c.includes('kill') && c.includes('54321'))).toBe(true);
     });
 
-    it('stop_mac_app captures pkill command with appName', async () => {
+    it('stop_mac_app captures killall command with appName', async () => {
       harness.resetCapturedCommands();
       const result = await harness.client.callTool({
         name: 'stop_mac_app',
@@ -338,7 +338,7 @@ describe('MCP Device and macOS Tool Invocation (e2e)', () => {
       expectContent(result);
 
       const commandStrs = harness.capturedCommands.map((c) => c.command.join(' '));
-      expect(commandStrs.some((c) => c.includes('MyMacApp'))).toBe(true);
+      expect(commandStrs.some((c) => c === 'killall -- MyMacApp')).toBe(true);
     });
 
     it('get_mac_app_path captures xcodebuild showBuildSettings command', async () => {
```

---

### Incident Patch 11: `931b57ac` (2026-07-22)
**Commit Message**: fix(build): support absolute DerivedData paths with xcodemake (#485)

* fix(build): Support hashed xcodemake logs

Update the pinned xcodemake revision so absolute DerivedData paths produce safe capture log filenames. Match the new logs by their argument hash before deciding whether to run make directly.

Fixes #466

* fix(build): Delegate incremental builds to xcodemake

Always invoke the pinned wrapper so it owns Makefile argument and freshness validation before delegating to make.

Refs #466

* test(build): Cover pinned xcodemake lifecycle

Execute the checksum-verified pinned wrapper with fake build tools and verify capture, reuse, argument invalidation, and project freshness behavior.

Refs #466

* fix(build): preserve xcodemake lifecycle state

Repin the bundled wrapper to the upstream lifecycle fixes and add regression coverage for long configuration arguments, direct fallback, and Makefile reuse.

* test(build): Resolve xcodemake fixture by module

Keep the wrapper lifecycle test independent of the process working directory.

* test(build): Stabilize wrapper mtime assertion

Compare the observed Makefile timestamp with the explicit sentinel using a filesystem-resolution tol

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@
 - Fixed `suppressWarnings` being ignored in settled build, build-run, and test output. The flag was honored only while streaming, so warnings still reached the final MCP tool response ([#447](https://github.com/getsentry/XcodeBuildMCP/issues/447)).
 - Fixed iOS scaffold orientation and device-family settings, LLDB command isolation and argument escaping, run-destination parsing without an active scheme, concurrent working-directory mutations, blocking physical-device name lookup, and unverified `xcodemake` downloads ([#459](https://github.com/getsentry/XcodeBuildMCP/issues/459)).
 - Fixed simulator UI launching and keyboard controls to prefer Xcode 27's Device Hub when available, with Simulator.app as the legacy fallback.
+- Fixed incremental `xcodemake` builds when DerivedData uses an absolute path by updating the pinned wrapper and delegating Makefile reuse to it so its argument and freshness checks are always applied ([#466](https://github.com/getsentry/XcodeBuildMCP/issues/466)).
 
 ## [2.6.2]
 
```

**File**: `src/utils/__tests__/build-utils-xcodemake.test.ts` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import path from 'node:path';
+import { createMockExecutor } from '../../test-utils/mock-executors.ts';
+
+const { executeXcodemakeCommandMock } = vi.hoisted(() => ({
+  executeXcodemakeCommandMock: vi.fn(),
+}));
+
+vi.mock('../xcodemake.ts', () => ({
+  isXcodemakeEnabled: () => true,
+  isXcodemakeAvailable: () => Promise.resolve(true),
+  executeXcodemakeCommand: executeXcodemakeCommandMock,
+}));
+
+import { executeXcodeBuildCommand } from '../build-utils.ts';
+import { XcodePlatform } from '../xcode.ts';
+
+describe('build-utils xcodemake lifecycle', () => {
+  let projectDirectory: string;
+
+  beforeEach(() => {
+    projectDirectory = mkdtempSync(path.join(tmpdir(), 'xcodebuildmcp-xcodemake-'));
+    writeFileSync(path.join(projectDirectory, 'Makefile'), 'all:\n\t@true\n');
+    executeXcodemakeCommandMock.mockResolvedValue({ success: true, output: 'BUILD SUCCEEDED' });
+  });
+
+  afterEach(() => {
+    rmSync(projectDirectory, { recursive: true, force: true });
+    vi.clearAllMocks();
+  });
+
+  it('delegates existing Makefile validation to xcodemake for external DerivedData', async () => {
+    const workspacePath = path.join(projectDirectory, 'MyWorkspace.xcworkspace');
+    const derivedDataPath =
+      '/Users/developer/Library/Developer/XcodeBuildMCP/DerivedData/MyWorkspace-57a542dedf16';
+    const executorCall = vi.fn();
+    const executor = createMockExecutor({ onExecute: executorCall });
+
+    const result = await executeXcodeBuildCommand(
+      {
+        scheme: 'MyScheme',
+        configuration: 'Debug',
+        workspacePath,
+        derivedDataPath,
+      },
+      {
+        platform: XcodePlatform.iOSSimulator,
+        simulatorId: 'SIMULATOR-UDID',
+        logPrefix: 'iOS Simulator Build',
+      },
+      false,
+      'build',
+      executor,
+    );
+
+    expect(result.isError).toBeFalsy();
+    expect(executorCall).not.toHaveBeenCalled();
+    expect(executeXcodemakeCommandMock).toHaveBeenCalledWith(
+      projectDirectory,
+      [
+        '-workspace',
+        workspacePath,
+        '-scheme',
+        'MyScheme',
+        '-configuration',
+        'Debug',
+        '-skipMacroValidation',
+        '-destination',
+        'platform=iOS Simulator,id=SIMULATOR-UDID',
+        '-collect-test-diagnostics',
+        'never',
+        '-derivedDataPath',
+        derivedDataPath,
+        'build',
+      ],
+      'iOS Simulator Build',
+    );
+  });
+
+  it('uses the current working directory when no project or workspace path is provided', async () => {
+    const derivedDataPath =
+      '/Users/developer/Library/Developer/XcodeBuildMCP/DerivedData/MyScheme-57a542dedf16';
+    const executorCall = vi.fn();
+    const executor = createMockExecutor({ onExecute: executorCall });
+
+    const result = await executeXcodeBuildCommand(
+      {
+        scheme: 'MyScheme',
+        derivedDataPath,
+      },
+      {
+        platform: XcodePlatform.iOSSimulator,
+        simulatorId: 'SIMULATOR-UDID',
+        logPrefix: 'iOS Simulator Build',
+      },
+      false,
+      'build',
+      executor,
+    );
+
+    expect(result.isError).toBeFalsy();
+    expect(executorCall).not.toHaveBeenCalled();
+    expect(executeXcodemakeCommandMock).toHaveBeenCalledWith(
+      process.cwd(),
+      expect.arrayContaining(['-derivedDataPath', derivedDataPath]),
+      'iOS Simulator Build',
+    );
+  });
+});
```

**File**: `src/utils/__tests__/fixtures/xcodemake/README.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+# Pinned xcodemake test data
+
+`xcodemake-75f47d4b69c1604cb886ab37d348c2c245d18329` is an exact, unmodified copy of
+[`cameroncooke/xcodemake` at commit `75f47d4b69c1604cb886ab37d348c2c245d18329`](https://github.com/cameroncooke/xcodemake/blob/75f47d4b69c1604cb886ab37d348c2c245d18329/xcodemake).
+
+SHA-256: `0934f784661f8b295f51064b8e94659c986ca25affc5062f20d5210ae0e25201`
+
+The wrapper regression test verifies this checksum against the production pin before execution. Do
+not edit the fixture independently of `XCODEMAKE_COMMIT` and `XCODEMAKE_SHA256`.
```

**File**: `src/utils/__tests__/fixtures/xcodemake/xcodemake-75f47d4b69c1604cb886ab37d348c2c245d18329` (added, +605/-0)
```diff
@@ -0,0 +1,605 @@
+#!/usr/bin/env perl -w
+#
+# "xcodemake"
+#
+# Derived from: https://github.com/johnno1962/xcodemake
+#
+# A short script to convert xcodebuild output into a Makefile.
+# Once a Makefile has been generated you can use the much
+# faster "make" command for most builds instead of launching
+# the more ponderous xcodebuild for each iteration. Sure,
+# this could be rewritten in python and use ninja instead.
+#
+# xcodebuild re-run if its arguments change or make fails or project modified.
+# Makefile re-generated if script modified or xcodebuild recaptured.
+#
+
+use IO::File;
+use strict;
+use JSON::PP;
+use Digest::MD5 qw(md5_hex);
+
+my @original_ARGV = @ARGV;
+
+# --- Global Utility Functions ---
+sub escape {
+    # Escape characters in $_[1] listed in $_[0] with a backslash
+    $_[1] =~ s/([$_[0]])/\\$1/g;
+}
+sub unescape {
+    # Unescape characters in $_[1] listed in $_[0] preceded by a backslash
+    $_[1] =~ s/\\([$_[0]])/$1/g;
+}
+
+# escape literal '$' for make --> '$$'
+sub dollarEscape {
+    # $_[0] is the variable passed by reference implicitly
+    $_[0] =~ s/\$/\$\$/g;
+}
+# escape characters sensitive to the shell/make for file paths
+sub shellEscape {
+     # $_[0] is the variable passed by reference implicitly
+    escape("()#&\$", $_[0]); # Escape shell metacharacters & Make '$'
+    # Escape spaces for shell commands separately
+    $_[0] =~ s/ /\\ /g;
+}
+
+sub hasConfigurationArgument {
+    return scalar grep { /^--?(?:config|configuration)$/ } @_;
+}
+
+sub fileContainsLiteral {
+    my ($file, $literal) = @_;
+    open my $fh, "<", $file or return 0;
+    while (my $line = <$fh>) {
+        if (index($line, $literal) != -1) {
+            close $fh;
+            return 1;
+        }
+    }
+    close $fh;
+    return 0;
+}
+
+# --- Global Variables ---
+my $log_tag = join "_", ("xcodemake", @original_ARGV);
+$log_tag =~ s{[/:]+}{_}g;
+$log_tag =~ s{[^[:alnum:]._+=,@ -]+}{_}g;
+$log_tag =~ s{\s+}{_}g;
+$log_tag =~ s{_+}{_}g;
+$log_tag =~ s{^_+|_+$}{}g;
+$log_tag ||= "xcodemake";
+my $max_log_name_length = 150;
+my $log_suffix = "-" . md5_hex(join "\0", @original_ARGV) . ".log";
+$log_tag = substr($log_tag, 0, $max_log_name_length - length($log_suffix));
+$log_tag =~ s{_+$}{};
+my $log = ($log_tag || "xcodemake") . $log_suffix;
+my $make = "Makefile";
+
+my $xcodebuild = ($ENV{DEVELOPER_BIN_DIR}||'/usr/bin')."/xcodebuild";
+my $archs = $ENV{ARCHS}||'arm64';
+my $has_config_in_original = hasConfigurationArgument(@original_ARGV);
+
+my $variant = "$xcodebuild ARCHS=$archs @original_ARGV";
+$variant .= " -config Debug" unless $has_config_in_original;
+
+my $builddb = ($ENV{OBJROOT}||'/tmp')."/XCBuildData/build.db";
+
+my $EXIT_SUCCESS = 0;
+my ($LOG, $fileArg); # $LOG will be lexical to generateMakefile
+
+# regex for file path argument (handles spaces escaped with backslash)
+my $notSpace = "[^\\\\\\s]";
+$fileArg = "$notSpace+(?:\\\\.$notSpace*)*";
+
+# --- Main Logic ---
+
+# Recapture xcodebuild output if paramaters change or project has been edited
+captureXcodebuild() if ! -f $log || `find . -name project.pbxproj -newer '$log'`;
+
+# Regenerate Makefile if the script, xcodebuild path, or arguments changed.
+generateMakefile() if ! -f $make || -M $0 < -M $make || !fileContainsLiteral($make, $variant);
+
+exit $EXIT_SUCCESS if $EXIT_SUCCESS == system "make";
+
+rename $builddb, $builddb.".save" if -f $builddb;
+
+# If make failed, try running xcodebuild directly. If it succeeds, regenerate and try make again.
+# Prepare command array for direct xcodebuild run (needs env)
+my @direct_build_cmd_parts = ($xcodebuild);
+# Use the original arguments captured at the start
+my @direct_build_args = @original_ARGV;
+push @direct_build_args, ('-config', 'Debug') unless $has_config_in_original;
+my @direct_build_cmd = (@direct_build_cmd_parts, @direct_build_args);
+
+my $direct_build_status;
+{
+    local $ENV{ARCHS} = $archs; # Set environment for direct build too
+    $direct_build_status = system(@direct_build_cmd);
+}
+
+if ($direct_build_status == $EXIT_SUCCESS) {
+    captureXcodebuild(); # Recapture if direct build worked
+    generateMakefile();
+    exit $EXIT_SUCCESS if $EXIT_SUCCESS == system "make"; # Try make again
+}
+
+rename $builddb.".save", $builddb if -f $builddb.".save";
+exit !$EXIT_SUCCESS; # Exit with failure if direct build or second make failed
+
+# --- Subroutines ---
+
+sub captureXcodebuild {
+    # Move Xcode's build database to one side
+    rename $builddb, $builddb.".save" if -f $builddb;
+
+    # --- Prepare Arguments for List system() ---
+    # Simply use xcodebuild directly, inheriting the environment
+    my @base_cmd_parts = ($xcodebuild);
+
+    # Use the *original* @ARGV captured at the script start
+    my @cmd_args = @original_ARGV;
+    # Add default -config Debug if necessary *to the list*
+    # Check original args for all possible configuration argument formats
+    my $has_config = hasConfigurationArgument(@original_ARGV);
+   
```

**File**: `src/utils/__tests__/xcodemake-wrapper.test.ts` (added, +195/-0)
```diff
@@ -0,0 +1,195 @@
+import { execFileSync } from 'node:child_process';
+import { createHash } from 'node:crypto';
+import {
+  chmodSync,
+  existsSync,
+  mkdirSync,
+  mkdtempSync,
+  readFileSync,
+  readdirSync,
+  rmSync,
+  statSync,
+  utimesSync,
+  writeFileSync,
+} from 'node:fs';
+import { tmpdir } from 'node:os';
+import path from 'node:path';
+import { fileURLToPath } from 'node:url';
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+import { XCODEMAKE_COMMIT, XCODEMAKE_SHA256 } from '../xcodemake.ts';
+
+const FILESYSTEM_TIMESTAMP_TOLERANCE_MS = 1_000;
+const PINNED_FIXTURE_PATH = fileURLToPath(
+  new URL(`./fixtures/xcodemake/xcodemake-${XCODEMAKE_COMMIT}`, import.meta.url),
+);
+
+function writeExecutable(filePath: string, contents: string): void {
+  writeFileSync(filePath, contents);
+  chmodSync(filePath, 0o755);
+}
+
+function readLines(filePath: string): string[] {
+  if (!existsSync(filePath)) {
+    return [];
+  }
+
+  const contents = readFileSync(filePath, 'utf8').trim();
+  return contents.length > 0 ? contents.split('\n') : [];
+}
+
+describe('pinned xcodemake wrapper lifecycle', () => {
+  let temporaryDirectory: string;
+  let projectDirectory: string;
+  let projectFile: string;
+  let fakeBinDirectory: string;
+  let xcodebuildInvocationLog: string;
+  let makeInvocationLog: string;
+
+  beforeEach(() => {
+    temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'xcodebuildmcp-xcodemake-wrapper-'));
+    projectDirectory = path.join(temporaryDirectory, 'project');
+    fakeBinDirectory = path.join(temporaryDirectory, 'bin');
+    xcodebuildInvocationLog = path.join(temporaryDirectory, 'xcodebuild-invocations.log');
+    makeInvocationLog = path.join(temporaryDirectory, 'make-invocations.log');
+
+    mkdirSync(path.join(projectDirectory, 'MyWorkspace.xcworkspace'), { recursive: true });
+    mkdirSync(fakeBinDirectory, { recursive: true });
+    projectFile = path.join(projectDirectory, 'MyWorkspace.xcodeproj', 'project.pbxproj');
+    mkdirSync(path.dirname(projectFile), { recursive: true });
+    writeFileSync(projectFile, '// test project\n');
+
+    writeExecutable(
+      path.join(fakeBinDirectory, 'xcodebuild'),
+      '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$XCODEMAKE_TEST_XCODEBUILD_LOG"\n',
+    );
+    writeExecutable(
+      path.join(fakeBinDirectory, 'make'),
+      '#!/bin/sh\nprintf \'make\\n\' >> "$XCODEMAKE_TEST_MAKE_LOG"\nattempts=0\nwhile IFS= read -r _; do attempts=$((attempts + 1)); done < "$XCODEMAKE_TEST_MAKE_LOG"\nif [ "${XCODEMAKE_TEST_FAIL_FIRST_MAKE:-0}" = "1" ] && [ "$attempts" -eq 1 ]; then\n  exit 1\nfi\n',
+    );
+  });
+
+  afterEach(() => {
+    rmSync(temporaryDirectory, { recursive: true, force: true });
+  });
+
+  function runWrapper(arguments_: string[], environment: Record<string, string> = {}): void {
+    execFileSync('perl', [PINNED_FIXTURE_PATH, ...arguments_], {
+      cwd: projectDirectory,
+      encoding: 'utf8',
+      stdio: 'pipe',
+      env: {
+        ...process.env,
+        PATH: `${fakeBinDirectory}${path.delimiter}${process.env.PATH ?? ''}`,
+        DEVELOPER_BIN_DIR: fakeBinDirectory,
+        OBJROOT: path.join(temporaryDirectory, 'objroot'),
+        XCODEMAKE_TEST_XCODEBUILD_LOG: xcodebuildInvocationLog,
+        XCODEMAKE_TEST_MAKE_LOG: makeInvocationLog,
+        ...environment,
+      },
+    });
+  }
+
+  function captureLogs(): string[] {
+    return readdirSync(projectDirectory).filter(
+      (fileName) => fileName.startsWith('xcodemake') && fileName.endsWith('.log'),
+    );
+  }
+
+  it('captures and reuses builds while invalidating changed or stale state', () => {
+    const fixtureChecksum = createHash('sha256')
+      .update(readFileSync(PINNED_FIXTURE_PATH))
+      .digest('hex');
+    expect(fixtureChecksum).toBe(XCODEMAKE_SHA256);
+
+    const derivedDataPath =
+      '/Users/developer/Library/Developer/XcodeBuildMCP/DerivedData/MyWorkspace-57a542dedf16';
+    const initialArguments = [
+      '-workspace',
+      'MyWorkspace.xcworkspace',
+      '-scheme',
+      'MyScheme',
+      '-configuration',
+      'Debug',
+      '-derivedDataPath',
+      derivedDataPath,
+      'build',
+    ];
+
+    runWrapper(initialArguments);
+
+    const initialXcodebuildInvocations = readLines(xcodebuildInvocationLog);
+    expect(initialXcodebuildInvocations).toHaveLength(2);
+    expect(initialXcodebuildInvocations).not.toContainEqual(
+      expect.stringContaining('-config Debug'),
+    );
+    expect(initialXcodebuildInvocations[0]).toContain(derivedDataPath);
+    expect(initialXcodebuildInvocations[0]).toMatch(/ clean$/);
+    expect(initialXcodebuildInvocations[1]).not.toMatch(/ clean$/);
+    expect(readLines(makeInvocationLog)).toHaveLength(1);
+    expect(captureLogs()).toHaveLength(1);
+    expect(readFileSync(path.join(projectDirectory, 'Makefile'), 'utf8')).toContain(
+      derivedDataPath,
+    );
+
+    const makefilePath = path.join(projectDirectory, 'Makefile');
+    cons
```

**File**: `src/utils/__tests__/xcodemake.test.ts` (modified, +0/-18)
```diff
@@ -13,7 +13,6 @@ import {
   XCODEMAKE_COMMIT,
   XCODEMAKE_DOWNLOAD_URL,
   XCODEMAKE_SHA256,
-  doesMakeLogFileExist,
   executeXcodemakeCommand,
   installXcodemake,
   verifyXcodemakeScript,
@@ -57,23 +56,6 @@ describe('executeXcodemakeCommand', () => {
   });
 });
 
-describe('doesMakeLogFileExist', () => {
-  it('reads the project directory without mutating process cwd', () => {
-    const originalCwd = process.cwd();
-    const readDirectory = vi.fn(() => ['xcodemake -scheme App.log']);
-
-    const exists = doesMakeLogFileExist(
-      '/tmp/project',
-      ['xcodebuild', '-scheme', 'App'],
-      readDirectory,
-    );
-
-    expect(exists).toBe(true);
-    expect(readDirectory).toHaveBeenCalledWith('/tmp/project');
-    expect(process.cwd()).toBe(originalCwd);
-  });
-});
-
 describe('xcodemake installer integrity', () => {
   it('pins the download URL to an exact commit and checksum', () => {
     expect(XCODEMAKE_COMMIT).toMatch(/^[a-f0-9]{40}$/);
```

**File**: `src/utils/build-utils.ts` (modified, +8/-26)
```diff
@@ -2,14 +2,7 @@ import { log } from './logger.ts';
 import { XcodePlatform, constructDestinationString } from './xcode.ts';
 import type { CommandExecutor, CommandExecOptions } from './command.ts';
 import type { SharedBuildParams, PlatformBuildOptions } from '../types/common.ts';
-import {
-  isXcodemakeEnabled,
-  isXcodemakeAvailable,
-  executeXcodemakeCommand,
-  executeMakeCommand,
-  doesMakefileExist,
-  doesMakeLogFileExist,
-} from './xcodemake.ts';
+import { isXcodemakeEnabled, isXcodemakeAvailable, executeXcodemakeCommand } from './xcodemake.ts';
 import path from 'path';
 import os from 'node:os';
 import { resolveEffectiveDerivedDataPath } from './derived-data-path.ts';
@@ -89,7 +82,7 @@ export async function executeXcodeBuildCommand(
       projectPath,
     });
 
-    let projectDir = '';
+    let projectDir = process.cwd();
     if (workspacePath) {
       projectDir = path.dirname(workspacePath);
       command.push('-workspace', workspacePath);
@@ -184,23 +177,12 @@ export async function executeXcodeBuildCommand(
 
     let result;
     if (useXcodemake) {
-      const makefileExists = doesMakefileExist(projectDir);
-      log('debug', 'Makefile exists: ' + makefileExists);
-
-      const makeLogFileExists = doesMakeLogFileExist(projectDir, command);
-      log('debug', 'Makefile log exists: ' + makeLogFileExists);
-
-      if (makefileExists && makeLogFileExists) {
-        addBuildMessage('ℹ️ Using make for incremental build');
-        result = await executeMakeCommand(projectDir, platformOptions.logPrefix);
-      } else {
-        addBuildMessage('ℹ️ Generating Makefile with xcodemake (first build may take longer)');
-        result = await executeXcodemakeCommand(
-          projectDir,
-          command.slice(1),
-          platformOptions.logPrefix,
-        );
-      }
+      addBuildMessage('ℹ️ Running incremental build with xcodemake');
+      result = await executeXcodemakeCommand(
+        projectDir,
+        command.slice(1),
+        platformOptions.logPrefix,
+      );
     } else {
       const streamHandlers = pipeline
         ? {
```

**File**: `src/utils/xcodemake.ts` (modified, +3/-45)
```diff
@@ -1,7 +1,7 @@
 import { log } from './logger.ts';
 import type { CommandResponse } from './command.ts';
 import { getDefaultCommandExecutor } from './command.ts';
-import { existsSync, readdirSync, statSync } from 'fs';
+import { existsSync, statSync } from 'fs';
 import { createHash, randomUUID } from 'node:crypto';
 import * as path from 'path';
 import * as os from 'os';
@@ -10,8 +10,8 @@ import { getConfig } from './config-store.ts';
 
 let overriddenXcodemakePath: string | null = null;
 
-export const XCODEMAKE_COMMIT = '1749682a99794edc257010b3eaa35c39f0f91c50';
-export const XCODEMAKE_SHA256 = 'b84f2e58326a1c009e5349e28895817d2968f2cb655b6a2a7c7c719971007db7';
+export const XCODEMAKE_COMMIT = '75f47d4b69c1604cb886ab37d348c2c245d18329';
+export const XCODEMAKE_SHA256 = '0934f784661f8b295f51064b8e94659c986ca25affc5062f20d5210ae0e25201';
 export const XCODEMAKE_DOWNLOAD_URL = `https://raw.githubusercontent.com/cameroncooke/xcodemake/${XCODEMAKE_COMMIT}/xcodemake`;
 
 interface XcodemakeInstallerDependencies {
@@ -172,40 +172,6 @@ export function doesMakefileExist(projectDir: string): boolean {
   return existsSync(`${projectDir}/Makefile`);
 }
 
-type ReadDirectory = (path: string) => string[];
-
-export function doesMakeLogFileExist(
-  projectDir: string,
-  command: string[],
-  readDirectory: ReadDirectory = (directory) => readdirSync(directory),
-): boolean {
-  try {
-    const xcodemakeCommand = ['xcodemake', ...command.slice(1)];
-    const escapedCommand = xcodemakeCommand.map((arg) => {
-      // Remove projectDir from arguments if present at the start
-      const prefix = projectDir + '/';
-      if (arg.startsWith(prefix)) {
-        return arg.substring(prefix.length);
-      }
-      return arg;
-    });
-    const commandString = escapedCommand.join(' ');
-    const logFileName = `${commandString}.log`;
-    log('debug', `Checking for Makefile log: ${logFileName} in directory: ${projectDir}`);
-
-    const files = readDirectory(projectDir);
-    const exists = files.includes(logFileName);
-    log('debug', `Makefile log ${exists ? 'exists' : 'does not exist'}: ${logFileName}`);
-    return exists;
-  } catch (error) {
-    log(
-      'error',
-      `Error checking for Makefile log: ${error instanceof Error ? error.message : String(error)}`,
-    );
-    return false;
-  }
-}
-
 export async function executeXcodemakeCommand(
   projectDir: string,
   buildArgs: string[],
@@ -222,11 +188,3 @@ export async function executeXcodemakeCommand(
 
   return getDefaultCommandExecutor()(command, logPrefix, false, { cwd: projectDir });
 }
-
-export async function executeMakeCommand(
-  projectDir: string,
-  logPrefix: string,
-): Promise<CommandResponse> {
-  const command = ['make'];
-  return getDefaultCommandExecutor()(command, logPrefix, false, { cwd: projectDir });
-}
```

---

### Incident Patch 12: `f73e3a54` (2026-07-21)
**Commit Message**: ci(warden): Reduce PR review cost and enforce timeout (#480)

* ci(warden): Reduce PR review cost and enforce timeout

Remove the duplicate repository Warden lane and retain only the two productive automatic PR skills.

Add a ten-minute watchdog and manual guidance for targeted domain reviews.

* fix(warden): Address watchdog review feedback

Start monitoring requested runs so queue time is enforced, pin Node 24, make deadline polling deterministic, and run watchdog tests through npm test.

* fix(warden): Restore manual domain reviews

Keep runtime, test, and tool contract skills configured with local-only triggers so the agent handoff commands remain usable without adding PR CI cost.

* fix(warden): Monitor unnamed required runs

The workflow_run trigger already selects Warden and provides the exact run ID. Validate only the pull request event so org-required runs are still monitored when GitHub omits their workflow name.

* fix(warden): Isolate watchdog test arguments

Run the watchdog suite through npm posttest so targeted Vitest arguments are not forwarded to the Node test runner.

* fix(warden): Close watchdog lifecycle gaps

Recheck terminal state after cancellation, monitor 

**File**: `.agents/skills/xcodebuildmcp-snapshot-fixture-review/SKILL.md` (modified, +12/-8)
```diff
@@ -30,11 +30,15 @@ Review guardrails for fixture and snapshot contract integrity.
 - JSON fixtures preserve stable structured output envelopes.
 - Volatile values are normalized in code, not patched ad hoc in fixtures.
 - Missing fixtures are generated through the snapshot update flow.
-
-## Validation
-
-- `npm run test:snapshots`
-- `npm run test:schema-fixtures`
-- `npm test -- src/snapshot-tests/__tests__/fixture-io.test.ts`
-- `npm test -- src/snapshot-tests/__tests__/json-normalize.test.ts`
-- `npx skill-check .agents/skills/xcodebuildmcp-snapshot-fixture-review`
+- Verify project-defined normalization sentinels in normalization code and tests before reporting
+  them as implausible fixture values. In particular, `99999` is an intentional sentinel for
+  volatile UI capture counts.
+- Group every occurrence of the same root cause into one finding and list the affected fixtures.
+  Do not emit separate findings for equivalent CLI, MCP, text, or JSON drift.
+- Do not repeat a finding that is already resolved by the current diff.
+
+## Review limits
+
+- Review the changed fixtures and the directly relevant normalization or contract code only.
+- Do not run snapshot or smoke suites as part of an automated PR review.
+- Prefer one high-confidence cross-fixture finding over multiple speculative discrepancies.
```

**File**: `.agents/skills/xcodebuildmcp-test-boundary-review/SKILL.md` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ Review guardrails for test isolation, scope, and contract validation.
 - `src/**/__tests__/**`
 - `src/test-utils/**`
 - `src/snapshot-tests/**`
+- `scripts/**/__tests__/**`
 - `package.json`
 - `xcodebuildmcp.com/app/docs/_content/testing.mdx`
 - `xcodebuildmcp.com/app/docs/_content/contributing.mdx`
```

**File**: `.github/workflows/warden-watchdog.yml` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+name: Warden watchdog
+
+on:
+  workflow_run:
+    workflows: [Warden]
+    # GitHub omits `requested` for reruns, so reruns are caught when they enter `in_progress`.
+    types: [requested, in_progress]
+
+permissions:
+  actions: write
+  contents: read
+
+jobs:
+  enforce-timeout:
+    if: >-
+      github.event.workflow_run.event == 'pull_request' &&
+      (github.event.action == 'requested' || github.event.workflow_run.run_attempt > 1)
+    runs-on: ubuntu-latest
+    timeout-minutes: 11
+    concurrency:
+      group: warden-watchdog-${{ github.event.workflow_run.id }}
+      cancel-in-progress: true
+    steps:
+      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
+        with:
+          ref: ${{ github.event.repository.default_branch }}
+          persist-credentials: false
+      - name: Setup Node.js
+        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
+        with:
+          node-version: '24'
+      - name: Enforce Warden timeout
+        env:
+          GITHUB_TOKEN: ${{ github.token }}
+          TARGET_RUN_ID: ${{ github.event.workflow_run.id }}
+          TARGET_RUN_ATTEMPT: ${{ github.event.workflow_run.run_attempt }}
+          WARDEN_MAX_RUNTIME_SECONDS: 600
+          WARDEN_POLL_SECONDS: 15
+        run: node scripts/warden-watchdog.mjs
```

**File**: `.github/workflows/warden.yml` (removed, +0/-29)
```diff
@@ -1,29 +0,0 @@
-name: Warden
-
-on:
-  pull_request:
-    types: [opened, synchronize, reopened]
-
-concurrency:
-  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
-  cancel-in-progress: true
-
-# contents: write required for resolving review threads via GraphQL
-# See: https://github.com/orgs/community/discussions/44650
-permissions:
-  contents: write
-  pull-requests: write
-  checks: write
-
-jobs:
-  review:
-    runs-on: ubuntu-latest
-    timeout-minutes: 20
-    env:
-      WARDEN_MODEL: ${{ secrets.WARDEN_MODEL }}
-      WARDEN_SENTRY_DSN: ${{ secrets.WARDEN_SENTRY_DSN }}
-    steps:
-      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
-      - uses: getsentry/warden@2130c979dec0163048d954d9599504e2d9fa2b07
-        with:
-          anthropic-api-key: ${{ secrets.WARDEN_ANTHROPIC_API_KEY }}
```

**File**: `AGENTS.md` (modified, +4/-1)
```diff
@@ -48,7 +48,9 @@ ESM TypeScript project (`type: module`). Key layers:
 - NEVER remove or downgrade code to fix type errors from outdated dependencies; upgrade the dependency instead
 - Always ask before removing functionality or code that appears to be intentional
 - Do not add fallback behavior by default. If required context, configuration, runtime state, or dependencies are missing, fail loudly and fix the caller/setup instead of silently switching to an alternate path. Add a fallback only when explicitly requested or when it is a documented product requirement.
-- Follow TypeScript best practices
+- Review the complete merge-base diff and trace changed or reused helper contracts, including error and sentinel returns, through callers, consumers, tests, and operational configuration.
+- Verify standard quality commands include every changed path and exercise exact entry points and argument variants; validate explicitly when they do not.
+- For asynchronous, workflow, or process-boundary changes, enumerate lifecycle states, retries, supersession, and race transitions; test terminal outcomes and missing or optional metadata.
 
 ## Import Conventions
 - ESM with explicit `.ts` extensions in `src/` (tsup rewrites to `.js` at build)
@@ -92,6 +94,7 @@ When reading issues:
 - CLI design note: do not rely on CLI session-default writes. CLI is intentionally deterministic for CI/scripting and should use explicit command arguments as the primary input surface.
 - When working on skill sources in `skills/`, use the `skill-creator` skill workflow.
 - After modifying any skill source, run `npx skill-check <skill-directory>` and address all errors/warnings before handoff.
+- Before handoff, run the matching manual Warden review for high-risk changes: runtime/CLI/daemon boundaries → `xcodebuildmcp-runtime-boundary-review`; test infrastructure or harnesses → `xcodebuildmcp-test-boundary-review`; tool manifests, schemas, or contracts → `xcodebuildmcp-tool-contract-review`. Invoke only applicable skills with `warden --skill <name>`.
 -
 ## Multi-process filesystem state
 - XcodeBuildMCP explicitly supports multiple concurrent MCP server, daemon, CLI, test, and helper processes for the same or different workspaces.
```

**File**: `CLAUDE.md` (modified, +4/-1)
```diff
@@ -7,7 +7,9 @@
 - NEVER remove or downgrade code to fix type errors from outdated dependencies; upgrade the dependency instead
 - Always ask before removing functionality or code that appears to be intentional
 - Do not add fallback behavior by default. If required context, configuration, runtime state, or dependencies are missing, fail loudly and fix the caller/setup instead of silently switching to an alternate path. Add a fallback only when explicitly requested or when it is a documented product requirement.
-- Follow TypeScript best practices
+- Review the complete merge-base diff and trace changed or reused helper contracts, including error and sentinel returns, through callers, consumers, tests, and operational configuration.
+- Verify standard quality commands include every changed path and exercise exact entry points and argument variants; validate explicitly when they do not.
+- For asynchronous, workflow, or process-boundary changes, enumerate lifecycle states, retries, supersession, and race transitions; test terminal outcomes and missing or optional metadata.
 
 ## Test Conventions
 - Snapshot tests (`*.snapshot.test.ts`) must only assert generated tool output against fixtures. Move helper, parser, schema, setup, or behavior assertions to non-snapshot unit/integration tests.
@@ -25,6 +27,7 @@ When reading issues:
 - CLI design note: do not rely on CLI session-default writes. CLI is intentionally deterministic for CI/scripting and should use explicit command arguments as the primary input surface.
 - When working on skill sources in `skills/`, use the `skill-creator` skill workflow.
 - After modifying any skill source, run `npx skill-check <skill-directory>` and address all errors/warnings before handoff.
+- Before handoff, run the matching manual Warden review for high-risk changes: runtime/CLI/daemon boundaries → `xcodebuildmcp-runtime-boundary-review`; test infrastructure or harnesses → `xcodebuildmcp-test-boundary-review`; tool manifests, schemas, or contracts → `xcodebuildmcp-tool-contract-review`. Invoke only applicable skills with `warden --skill <name>`.
 -
 ## Multi-process filesystem state
 - XcodeBuildMCP explicitly supports multiple concurrent MCP server, daemon, CLI, test, and helper processes for the same or different workspaces.
```

**File**: `package.json` (modified, +6/-4)
```diff
@@ -30,10 +30,10 @@
     "package:macos:universal": "scripts/package-macos-portable.sh --universal",
     "verify:portable": "scripts/verify-portable-install.sh",
     "homebrew:formula": "scripts/create-homebrew-formula.sh",
-    "lint": "eslint 'src/**/*.{js,ts}' 'benchmarks/claude-ui/**/*.ts'",
-    "lint:fix": "eslint 'src/**/*.{js,ts}' 'benchmarks/claude-ui/**/*.ts' --fix",
-    "format": "prettier --write 'src/**/*.{js,ts}' 'benchmarks/claude-ui/**/*.{ts,md,yml}'",
-    "format:check": "prettier --check 'src/**/*.{js,ts}' 'benchmarks/claude-ui/**/*.{ts,md,yml}'",
+    "lint": "eslint 'src/**/*.{js,ts}' 'benchmarks/claude-ui/**/*.ts' scripts/warden-watchdog.mjs scripts/__tests__/warden-watchdog.test.mjs",
+    "lint:fix": "eslint 'src/**/*.{js,ts}' 'benchmarks/claude-ui/**/*.ts' scripts/warden-watchdog.mjs scripts/__tests__/warden-watchdog.test.mjs --fix",
+    "format": "prettier --write 'src/**/*.{js,ts}' 'benchmarks/claude-ui/**/*.{ts,md,yml}' scripts/warden-watchdog.mjs scripts/__tests__/warden-watchdog.test.mjs",
+    "format:check": "prettier --check 'src/**/*.{js,ts}' 'benchmarks/claude-ui/**/*.{ts,md,yml}' scripts/warden-watchdog.mjs scripts/__tests__/warden-watchdog.test.mjs",
     "typecheck": "npx tsc --noEmit && npx tsc -p tsconfig.test.json && npx tsc -p tsconfig.benchmarks.json",
     "typecheck:tests": "npx tsc -p tsconfig.test.json",
     "inspect": "npx @modelcontextprotocol/inspector@latest node build/cli.js mcp",
@@ -47,6 +47,8 @@
     "license:check": "npx -y license-checker --production --onlyAllow 'MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;Unlicense;FSL-1.1-MIT;BlueOak-1.0.0'",
     "knip": "knip",
     "test": "vitest run",
+    "posttest": "npm run test:warden-watchdog",
+    "test:warden-watchdog": "node --test scripts/__tests__/warden-watchdog.test.mjs",
     "test:schema-fixtures": "vitest run src/snapshot-tests/__tests__/json-fixture-schema.test.ts",
     "test:snapshot": "npm run build && vitest run --config vitest.snapshot.config.ts",
     "test:snapshots": "npm run test:snapshot",
```

**File**: `scripts/__tests__/warden-watchdog.test.mjs` (added, +251/-0)
```diff
@@ -0,0 +1,251 @@
+import assert from 'node:assert/strict';
+import { readFileSync } from 'node:fs';
+import test from 'node:test';
+import { URL } from 'node:url';
+
+import {
+  githubRequest,
+  isPullRequestRun,
+  monitorWardenRun,
+  runStartTimeMs,
+  runtimeSeconds,
+} from '../warden-watchdog.mjs';
+
+function wardenRun(overrides = {}) {
+  return {
+    id: 1,
+    name: 'Warden',
+    event: 'pull_request',
+    status: 'in_progress',
+    run_attempt: 1,
+    created_at: '2026-07-21T09:00:00Z',
+    run_started_at: '2026-07-21T09:01:00Z',
+    ...overrides,
+  };
+}
+
+test('githubRequest scopes conflict handling to callers that allow it', async (context) => {
+  const originalFetch = globalThis.fetch;
+  context.after(() => {
+    globalThis.fetch = originalFetch;
+  });
+  globalThis.fetch = async () => ({ ok: false, status: 409 });
+
+  await assert.rejects(githubRequest('/run'), /GitHub API GET \/run failed: 409/);
+  assert.equal(await githubRequest('/cancel', { method: 'POST', allowConflict: true }), null);
+});
+
+test('workflow starts the watchdog for initial runs and reruns', () => {
+  const workflow = readFileSync(
+    new URL('../../.github/workflows/warden-watchdog.yml', import.meta.url),
+    'utf8',
+  );
+
+  assert.match(workflow, /types: \[requested, in_progress\]/);
+  assert.match(workflow, /github\.event\.action == 'requested'/);
+  assert.match(workflow, /github\.event\.workflow_run\.run_attempt > 1/);
+  assert.match(
+    workflow,
+    / {4}concurrency:\n {6}group: warden-watchdog-\$\{\{ github\.event\.workflow_run\.id \}\}\n {6}cancel-in-progress: true/,
+  );
+  assert.match(
+    workflow,
+    /TARGET_RUN_ATTEMPT: \$\{\{ github\.event\.workflow_run\.run_attempt \}\}/,
+  );
+});
+
+test('isPullRequestRun classifies runs using only the event', () => {
+  assert.equal(isPullRequestRun(wardenRun()), true);
+  assert.equal(isPullRequestRun(wardenRun({ name: '' })), true);
+  assert.equal(isPullRequestRun(wardenRun({ event: 'push' })), false);
+});
+
+test('runtimeSeconds includes queue time and never returns a negative duration', () => {
+  const run = wardenRun();
+
+  assert.equal(runtimeSeconds(run, Date.parse('2026-07-21T09:10:00Z')), 600);
+  assert.equal(runtimeSeconds(run, Date.parse('2026-07-21T08:59:00Z')), 0);
+});
+
+test('runStartTimeMs includes queue time from attempt-scoped rerun metadata', () => {
+  const rerun = wardenRun({
+    run_attempt: 3,
+    created_at: '2026-07-21T09:30:00Z',
+    run_started_at: '2026-07-21T09:36:28Z',
+  });
+
+  assert.equal(runStartTimeMs(rerun), Date.parse('2026-07-21T09:30:00Z'));
+  assert.equal(runtimeSeconds(rerun, Date.parse('2026-07-21T09:40:00Z')), 600);
+});
+
+test('runStartTimeMs rejects a rerun without a valid attempt timestamp', () => {
+  assert.throws(
+    () => runStartTimeMs(wardenRun({ run_attempt: 2, created_at: null })),
+    /invalid start timestamp/,
+  );
+});
+
+test('monitorWardenRun ignores non-PR runs', async () => {
+  const result = await monitorWardenRun({
+    maxRuntimeSeconds: 600,
+    pollSeconds: 15,
+    getRun: async () => wardenRun({ event: 'push' }),
+    cancelRun: async () => assert.fail('non-PR run must not be cancelled'),
+  });
+
+  assert.deepEqual(result, { cancelled: false, ignored: true });
+});
+
+test('monitorWardenRun returns when the Warden run completes', async () => {
+  const runs = [wardenRun(), wardenRun({ status: 'completed' })];
+  let nowMs = Date.parse('2026-07-21T09:00:00Z');
+
+  const result = await monitorWardenRun({
+    maxRuntimeSeconds: 600,
+    pollSeconds: 15,
+    now: () => nowMs,
+    sleep: async (milliseconds) => {
+      nowMs += milliseconds;
+    },
+    getRun: async () => runs.shift(),
+    cancelRun: async () => assert.fail('completed run must not be cancelled'),
+  });
+
+  assert.deepEqual(result, { cancelled: false, ignored: false });
+});
+
+test('monitorWardenRun cancels a queued Warden run at the runtime limit', async () => {
+  let cancelled = false;
+
+  const result = await monitorWardenRun({
+    maxRuntimeSeconds: 600,
+    pollSeconds: 15,
+    now: () => Date.parse('2026-07-21T09:10:00Z'),
+    sleep: async () => assert.fail('stale run must be cancelled immediately'),
+    getRun: async () => wardenRun({ status: 'queued' }),
+    cancelRun: async () => {
+      cancelled = true;
+      return true;
+    },
+  });
+
+  assert.equal(cancelled, true);
+  assert.deepEqual(result, { cancelled: true, ignored: false });
+});
+
+test('monitorWardenRun calculates each delay from one clock reading', async () => {
+  const runs = [wardenRun(), wardenRun({ status: 'completed' })];
+  const times = [Date.parse('2026-07-21T09:09:59.999Z'), Date.parse('2026-07-21T09:10:00.001Z')];
+  let sleptMilliseconds = 0;
+
+  const result = await monitorWardenRun({
+    maxRuntimeSeconds: 600,
+    pollSeconds: 15,
+    now: () => times.shift(),
+    sleep: async (milliseconds) => {
+      sleptMilliseconds = milliseconds;
+    },
+    getRun: async () 
```

---

### Incident Patch 13: `7cd7d5af` (2026-07-21)
**Commit Message**: fix(simulator): prefer Device Hub for simulator UI (#479)

* build: Upgrade AXe to 1.8.0

* fix(simulator): prefer Device Hub for simulator UI

Open Device Hub for visible simulator workflows when available, with Simulator.app as the compatibility fallback. Target the selected simulator by UDID and drive keyboard controls through Device Hub's menus.

* fix(simulator): make Device Hub shortcuts locale independent

* docs(manifests): simplify simulator tool descriptions

**File**: `.axe-version` (modified, +1/-1)
```diff
@@ -1 +1 @@
-1.7.1
+1.8.0
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@
 - Fixed malformed simulator discovery responses, project discovery path-boundary checks, and compiler diagnostic filenames containing glob metacharacters ([#424](https://github.com/getsentry/XcodeBuildMCP/issues/424)).
 - Fixed `suppressWarnings` being ignored in settled build, build-run, and test output. The flag was honored only while streaming, so warnings still reached the final MCP tool response ([#447](https://github.com/getsentry/XcodeBuildMCP/issues/447)).
 - Fixed iOS scaffold orientation and device-family settings, LLDB command isolation and argument escaping, run-destination parsing without an active scheme, concurrent working-directory mutations, blocking physical-device name lookup, and unverified `xcodemake` downloads ([#459](https://github.com/getsentry/XcodeBuildMCP/issues/459)).
+- Fixed simulator UI launching and keyboard controls to prefer Xcode 27's Device Hub when available, with Simulator.app as the legacy fallback.
 
 ## [2.6.2]
 
```

**File**: `manifests/tools/build_run_sim.yaml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ module: mcp/tools/simulator/build_run_sim
 names:
   mcp: build_run_sim
   cli: build-and-run
-description: Build, install, and launch on iOS Simulator; boots simulator and attempts to open Simulator.app as needed. Runtime logs are captured automatically and the log file path is included in the response. Preferred single-step run tool when defaults are set.
+description: Build, install, and launch on iOS Simulator, booting it when needed. Runtime logs are captured automatically and the log file path is included in the response. Preferred single-step run tool when defaults are set.
 outputSchema:
   schema: xcodebuildmcp.output.build-run-result
   version: "2"
```

**File**: `manifests/tools/open_sim.yaml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ module: mcp/tools/simulator/open_sim
 names:
   mcp: open_sim
   cli: open
-description: Open Simulator.app for visibility/manual workflows. Not required before simulator build-and-run (build_run_sim).
+description: Open the simulator frontend for visibility and manual workflows. Not required before simulator build-and-run (build_run_sim).
 outputSchema:
   schema: xcodebuildmcp.output.simulator-action-result
   version: "2"
```

**File**: `manifests/tools/toggle_connect_hardware_keyboard.yaml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ module: mcp/tools/simulator-management/toggle_connect_hardware_keyboard
 names:
   mcp: toggle_connect_hardware_keyboard
   cli: toggle-connect-hardware-keyboard
-description: Toggle whether the iOS Simulator receives Mac hardware keyboard input (Cmd+Shift+K). Disconnecting makes the on-screen keyboard appear for tap-based input. Requires the simulator to be booted and Accessibility permission for the MCP host.
+description: Toggle whether the iOS Simulator simulates a hardware keyboard connection. Disconnecting makes the on-screen keyboard appear for tap-based input. Requires the simulator to be booted and Accessibility permission for the MCP host.
 outputSchema:
   schema: xcodebuildmcp.output.simulator-action-result
   version: "2"
```

**File**: `manifests/tools/toggle_software_keyboard.yaml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ module: mcp/tools/simulator-management/toggle_software_keyboard
 names:
   mcp: toggle_software_keyboard
   cli: toggle-software-keyboard
-description: Toggle the iOS Simulator software keyboard (Cmd+K). Shows or hides the on-screen keyboard. Requires the simulator to be booted and Accessibility permission for the MCP host.
+description: Toggle the iOS Simulator software keyboard. Shows or hides the on-screen keyboard. Requires the simulator to be booted and Accessibility permission for the MCP host.
 outputSchema:
   schema: xcodebuildmcp.output.simulator-action-result
   version: "2"
```

**File**: `src/benchmarks/claude-ui/__tests__/preflight-commands.test.ts` (modified, +5/-5)
```diff
@@ -27,7 +27,7 @@ describe('Claude UI benchmark preflight commands', () => {
       'killall -9 RocketSim || true',
       'sleep 2',
       'open -gja RocketSim',
-      'open -a Simulator --args -CurrentDeviceUDID SIM-123',
+      "open 'devices:///manage/select?id=SIM-123' || open -a Simulator --args -CurrentDeviceUDID SIM-123",
       'sleep 10',
     ]);
   });
@@ -46,9 +46,9 @@ describe('Claude UI benchmark preflight commands', () => {
       }),
     ).toEqual([
       'open RocketSim',
-      'open -a Simulator --args -CurrentDeviceUDID SIM-123',
+      "open 'devices:///manage/select?id=SIM-123' || open -a Simulator --args -CurrentDeviceUDID SIM-123",
       'open /Applications/RocketSim.app',
-      'open -a Simulator --args -CurrentDeviceUDID SIM-123',
+      "open 'devices:///manage/select?id=SIM-123' || open -a Simulator --args -CurrentDeviceUDID SIM-123",
     ]);
   });
 
@@ -60,11 +60,11 @@ describe('Claude UI benchmark preflight commands', () => {
       }),
     ).toEqual([
       'open -a RocketSim.app',
-      "open -a Simulator --args -CurrentDeviceUDID 'SIM'\"'\"'123'",
+      "open 'devices:///manage/select?id=SIM%27123' || open -a Simulator --args -CurrentDeviceUDID 'SIM'\"'\"'123'",
     ]);
   });
 
-  it('does not inject Simulator.app focus commands in headless launch mode', () => {
+  it('does not inject simulator frontend focus commands in headless launch mode', () => {
     process.env[HEADLESS_ENV_VAR] = '1';
     const commands = ['open -gja RocketSim'];
 
```

**File**: `src/benchmarks/claude-ui/__tests__/simulator-existing-lifecycle.test.ts` (modified, +48/-2)
```diff
@@ -74,16 +74,62 @@ describe('Claude UI existing simulator lifecycle', () => {
       ['xcrun', 'simctl', 'list', 'devices', 'available', '--json'],
       ['xcrun', 'simctl', 'boot', 'EXISTING-SIM-123'],
       ['xcrun', 'simctl', 'bootstatus', 'EXISTING-SIM-123', '-b'],
-      ['open', '-a', 'Simulator', '--args', '-CurrentDeviceUDID', 'EXISTING-SIM-123'],
+      ['open', 'devices:///manage/select?id=EXISTING-SIM-123'],
     ]);
     expect(events).toEqual([
       'resolving simulator iPhone 17 Pro Max',
       'using simulator EXISTING-SIM-123',
       'booting simulator EXISTING-SIM-123',
       'waiting for simulator EXISTING-SIM-123 bootstatus',
-      'opening Simulator.app for EXISTING-SIM-123',
+      'opening Device Hub for EXISTING-SIM-123',
       'simulator ready EXISTING-SIM-123',
     ]);
     expect(log.messages.join('\n')).toContain('Existing simulator ready: EXISTING-SIM-123');
   });
+
+  it('falls back to Simulator.app when Device Hub is unavailable', async () => {
+    const commands: LifecycleCommandOptions[] = [];
+    const executor: LifecycleCommandExecutor = async (opts) => {
+      commands.push(opts);
+      if (opts.args[1] === 'list') {
+        return {
+          exitCode: 0,
+          stdout: JSON.stringify({
+            devices: {
+              'com.apple.CoreSimulator.SimRuntime.iOS-26-0': [
+                { name: 'iPhone 17 Pro Max', udid: 'EXISTING-SIM-123', isAvailable: true },
+              ],
+            },
+          }),
+          stderr: '',
+          durationSeconds: 0.01,
+        };
+      }
+      if (opts.command === 'open' && opts.args[0]?.startsWith('devices:')) {
+        return {
+          exitCode: 1,
+          stdout: '',
+          stderr: 'Device Hub unavailable',
+          durationSeconds: 0.01,
+        };
+      }
+      return { exitCode: 0, stdout: '', stderr: '', durationSeconds: 0.01 };
+    };
+
+    await prepareTemporarySimulator({
+      config: config({ temporarySimulator: false }),
+      suiteSlug: 'weather',
+      timestamp: '20260522T120000Z',
+      cwd: '/repo',
+      logPath: '/tmp/simulator-lifecycle.log',
+      executor,
+      logWriter: async () => undefined,
+      readinessDelayMs: 0,
+    });
+
+    expect(commands.slice(-2).map((item) => [item.command, ...item.args])).toEqual([
+      ['open', 'devices:///manage/select?id=EXISTING-SIM-123'],
+      ['open', '-a', 'Simulator', '--args', '-CurrentDeviceUDID', 'EXISTING-SIM-123'],
+    ]);
+  });
 });
```

---

### Incident Patch 14: `60cfdc35` (2026-07-16)
**Commit Message**: fix: Harden scaffold and utility edge cases (#476)

* fix: Address verified Warden findings

Correct scaffold settings, isolate LLDB command output, and make device lookup asynchronous.

Also harden xcuserstate parsing, template extraction, and xcodemake installation.

Fixes #459

* fix(debugger): Report running state after resume

* fix(device): Preserve names after refresh failure

* fix(debugger): Clear running state after termination

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -11,6 +11,7 @@
 
 - Fixed malformed simulator discovery responses, project discovery path-boundary checks, and compiler diagnostic filenames containing glob metacharacters ([#424](https://github.com/getsentry/XcodeBuildMCP/issues/424)).
 - Fixed `suppressWarnings` being ignored in settled build, build-run, and test output. The flag was honored only while streaming, so warnings still reached the final MCP tool response ([#447](https://github.com/getsentry/XcodeBuildMCP/issues/447)).
+- Fixed iOS scaffold orientation and device-family settings, LLDB command isolation and argument escaping, run-destination parsing without an active scheme, concurrent working-directory mutations, blocking physical-device name lookup, and unverified `xcodemake` downloads ([#459](https://github.com/getsentry/XcodeBuildMCP/issues/459)).
 
 ## [2.6.2]
 
@@ -694,4 +695,3 @@ Please note that the UI automation features are an early preview and currently i
 - Initial release of XcodeBuildMCP
 - Basic support for building iOS and macOS applications
 
-
```

**File**: `src/mcp/tools/project-scaffolding/__tests__/ios-scaffold-settings.test.ts` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+import { describe, expect, it } from 'vitest';
+import { deviceFamiliesToNumeric, orientationToIOSConstant } from '../ios-scaffold-settings.ts';
+
+describe('iOS scaffold settings', () => {
+  it.each([
+    ['portrait', 'UIInterfaceOrientationPortrait'],
+    ['portrait-upside-down', 'UIInterfaceOrientationPortraitUpsideDown'],
+    ['landscape-left', 'UIInterfaceOrientationLandscapeLeft'],
+    ['landscape-right', 'UIInterfaceOrientationLandscapeRight'],
+  ] as const)('maps %s to its Info.plist constant', (orientation, expected) => {
+    expect(orientationToIOSConstant(orientation)).toBe(expected);
+  });
+
+  it.each([
+    [['iphone'], '1'],
+    [['ipad'], '2'],
+    [['iphone', 'ipad'], '1,2'],
+    [['universal'], '1,2'],
+  ] as const)('maps device families %j to %s', (families, expected) => {
+    expect(deviceFamiliesToNumeric([...families])).toBe(expected);
+  });
+});
```

**File**: `src/mcp/tools/project-scaffolding/__tests__/scaffold_ios_project.test.ts` (modified, +31/-1)
```diff
@@ -129,12 +129,16 @@ describe('scaffold_ios_project plugin', () => {
       await initConfigStoreForTest({ iosTemplatePath: '' });
 
       let capturedCommands: string[][] = [];
+      let unzipOptions: unknown;
       const trackingCommandExecutor = createMockExecutor({
         success: true,
         output: 'Command executed successfully',
       });
       const capturingExecutor = async (command: string[], ...args: any[]) => {
         capturedCommands.push(command);
+        if (command[0] === 'unzip') {
+          unzipOptions = args[2];
+        }
         return trackingCommandExecutor(command, ...args);
       };
 
@@ -162,6 +166,9 @@ describe('scaffold_ios_project plugin', () => {
           /https:\/\/github\.com\/getsentry\/XcodeBuildMCP-iOS-Template\/releases\/download\/v\d+\.\d+\.\d+\/XcodeBuildMCP-iOS-Template-\d+\.\d+\.\d+\.zip/,
         ),
       ]);
+      expect(unzipOptions).toEqual({
+        cwd: expect.stringMatching(/xcodebuild-mcp-template-/),
+      });
 
       await initConfigStoreForTest({ iosTemplatePath: '/mock/template/path' });
     });
@@ -242,6 +249,22 @@ describe('scaffold_ios_project plugin', () => {
     });
 
     it('should return success response with all optional parameters', async () => {
+      let writtenXCConfig: string | undefined;
+      const xcconfigFileSystem = createMockFileSystemExecutor({
+        existsSync: (path) => path.includes('/mock/template/path'),
+        readdir: async () => [
+          { name: 'Project.xcconfig', isDirectory: () => false, isFile: () => true } as any,
+        ],
+        readFile: async () =>
+          [
+            'TARGETED_DEVICE_FAMILY = old',
+            'INFOPLIST_KEY_UISupportedInterfaceOrientations = old',
+            'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = old',
+          ].join('\n'),
+        writeFile: async (_path, content) => {
+          writtenXCConfig = content;
+        },
+      });
       const result = await runLogic(() =>
         scaffold_ios_projectLogic(
           {
@@ -258,13 +281,20 @@ describe('scaffold_ios_project plugin', () => {
             supportedOrientationsIpad: ['portrait', 'landscape-left'],
           },
           mockCommandExecutor,
-          mockFileSystemExecutor,
+          xcconfigFileSystem,
         ),
       );
 
       expect(result.isError).toBeFalsy();
       const text = allText(result);
       expect(text).toContain('Project scaffolded successfully');
+      expect(writtenXCConfig).toContain('TARGETED_DEVICE_FAMILY = 1');
+      expect(writtenXCConfig).toContain(
+        'INFOPLIST_KEY_UISupportedInterfaceOrientations = UIInterfaceOrientationPortrait',
+      );
+      expect(writtenXCConfig).toContain(
+        'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft',
+      );
       expect(result.nextStepParams).toEqual({
         build_sim: {
           workspacePath: '/tmp/test-projects/TestIOSApp.xcworkspace',
```

**File**: `src/mcp/tools/project-scaffolding/ios-scaffold-settings.ts` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+export type IOSDeviceFamily = 'iphone' | 'ipad' | 'universal';
+
+export type IOSOrientation =
+  | 'portrait'
+  | 'landscape-left'
+  | 'landscape-right'
+  | 'portrait-upside-down';
+
+const ORIENTATION_CONSTANTS: Record<IOSOrientation, string> = {
+  portrait: 'UIInterfaceOrientationPortrait',
+  'portrait-upside-down': 'UIInterfaceOrientationPortraitUpsideDown',
+  'landscape-left': 'UIInterfaceOrientationLandscapeLeft',
+  'landscape-right': 'UIInterfaceOrientationLandscapeRight',
+};
+
+/** Converts a scaffold orientation token to its Info.plist build-setting constant. */
+export function orientationToIOSConstant(orientation: IOSOrientation): string {
+  return ORIENTATION_CONSTANTS[orientation];
+}
+
+/** Converts scaffold device-family tokens to Xcode's numeric build-setting value. */
+export function deviceFamiliesToNumeric(families: IOSDeviceFamily[]): string {
+  if (families.includes('universal')) {
+    return '1,2';
+  }
+
+  const numericFamilies = new Set<string>();
+  if (families.includes('iphone')) {
+    numericFamilies.add('1');
+  }
+  if (families.includes('ipad')) {
+    numericFamilies.add('2');
+  }
+  return [...numericFamilies].join(',');
+}
```

**File**: `src/mcp/tools/project-scaffolding/scaffold_ios_project.ts` (modified, +13/-39)
```diff
@@ -14,6 +14,12 @@ import {
   getHandlerContext,
 } from '../../../utils/typed-tool-factory.ts';
 import { createScaffoldDomainResult, setScaffoldStructuredOutput } from './domain-result.ts';
+import {
+  deviceFamiliesToNumeric,
+  orientationToIOSConstant,
+  type IOSDeviceFamily,
+  type IOSOrientation,
+} from './ios-scaffold-settings.ts';
 
 const BaseScaffoldSchema = z.object({
   projectName: z.string().min(1),
@@ -36,40 +42,6 @@ const ScaffoldiOSProjectSchema = BaseScaffoldSchema.extend({
     .optional(),
 });
 
-/**
- * Convert orientation enum to iOS constant
- */
-function orientationToIOSConstant(orientation: string): string {
-  switch (orientation) {
-    case 'Portrait':
-      return 'UIInterfaceOrientationPortrait';
-    case 'PortraitUpsideDown':
-      return 'UIInterfaceOrientationPortraitUpsideDown';
-    case 'LandscapeLeft':
-      return 'UIInterfaceOrientationLandscapeLeft';
-    case 'LandscapeRight':
-      return 'UIInterfaceOrientationLandscapeRight';
-    default:
-      return orientation;
-  }
-}
-
-/**
- * Convert device family enum to numeric value
- */
-function deviceFamilyToNumeric(family: string): string {
-  switch (family) {
-    case 'iPhone':
-      return '1';
-    case 'iPad':
-      return '2';
-    case 'iPhone+iPad':
-      return '1,2';
-    default:
-      return '1,2';
-  }
-}
-
 /**
  * Update Package.swift file with deployment target
  */
@@ -114,9 +86,11 @@ function updateXCConfigFile(content: string, params: Record<string, unknown>): s
   const currentProjectVersion = params.currentProjectVersion as string | undefined;
   const platform = params.platform as string;
   const deploymentTarget = params.deploymentTarget as string | undefined;
-  const targetedDeviceFamily = params.targetedDeviceFamily as string | undefined;
-  const supportedOrientations = params.supportedOrientations as string[] | undefined;
-  const supportedOrientationsIpad = params.supportedOrientationsIpad as string[] | undefined;
+  const targetedDeviceFamily = params.targetedDeviceFamily as IOSDeviceFamily[] | undefined;
+  const supportedOrientations = params.supportedOrientations as IOSOrientation[] | undefined;
+  const supportedOrientationsIpad = params.supportedOrientationsIpad as
+    | IOSOrientation[]
+    | undefined;
 
   // Update project identity settings
   result = result.replace(/PRODUCT_NAME = .+/g, `PRODUCT_NAME = ${projectName}`);
@@ -148,8 +122,8 @@ function updateXCConfigFile(content: string, params: Record<string, unknown>): s
     }
 
     // Device family
-    if (targetedDeviceFamily) {
-      const deviceFamilyValue = deviceFamilyToNumeric(targetedDeviceFamily);
+    if (targetedDeviceFamily && targetedDeviceFamily.length > 0) {
+      const deviceFamilyValue = deviceFamiliesToNumeric(targetedDeviceFamily);
       result = result.replace(
         /TARGETED_DEVICE_FAMILY = .+/g,
         `TARGETED_DEVICE_FAMILY = ${deviceFamilyValue}`,
```

**File**: `src/utils/__tests__/device-name-resolver.test.ts` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+import { beforeEach, describe, expect, it, vi } from 'vitest';
+import {
+  __resetDeviceNameCacheForTests,
+  formatDeviceId,
+  resolveDeviceName,
+  type DeviceNameResolverDependencies,
+} from '../device-name-resolver.ts';
+
+const deviceId = 'device-identifier';
+const udid = '00008110-0012345678901234';
+
+function createDependencies(
+  overrides: Partial<DeviceNameResolverDependencies> = {},
+): DeviceNameResolverDependencies {
+  return {
+    runDevicectl: vi.fn().mockResolvedValue(undefined),
+    readOutput: vi.fn().mockResolvedValue(
+      JSON.stringify({
+        result: {
+          devices: [
+            {
+              identifier: deviceId,
+              deviceProperties: { name: 'Cam’s iPhone' },
+              hardwareProperties: { udid },
+            },
+          ],
+        },
+      }),
+    ),
+    removeOutput: vi.fn().mockResolvedValue(undefined),
+    createOutputPath: () => '/tmp/devices.json',
+    now: () => 1_000,
+    ...overrides,
+  };
+}
+
+describe('device name resolver', () => {
+  beforeEach(() => {
+    __resetDeviceNameCacheForTests();
+  });
+
+  it('loads device names asynchronously and resolves identifiers and UDIDs', async () => {
+    const deps = createDependencies();
+
+    await expect(resolveDeviceName(deviceId, deps)).resolves.toBe('Cam’s iPhone');
+    await expect(resolveDeviceName(udid, deps)).resolves.toBe('Cam’s iPhone');
+
+    expect(deps.runDevicectl).toHaveBeenCalledOnce();
+    expect(deps.runDevicectl).toHaveBeenCalledWith('/tmp/devices.json');
+    expect(deps.removeOutput).toHaveBeenCalledWith('/tmp/devices.json');
+  });
+
+  it('returns immediately while an asynchronous cache refresh is running', async () => {
+    let finishRefresh: (() => void) | undefined;
+    const runDevicectl = vi.fn(
+      () =>
+        new Promise<void>((resolve) => {
+          finishRefresh = resolve;
+        }),
+    );
+    const deps = createDependencies({ runDevicectl });
+
+    expect(formatDeviceId(deviceId, deps)).toBe(deviceId);
+    expect(runDevicectl).toHaveBeenCalledOnce();
+
+    finishRefresh?.();
+    await expect(resolveDeviceName(deviceId, deps)).resolves.toBe('Cam’s iPhone');
+    expect(formatDeviceId(deviceId, deps)).toBe(`Cam’s iPhone (${deviceId})`);
+  });
+
+  it('falls back to the device ID when devicectl fails', async () => {
+    const deps = createDependencies({
+      runDevicectl: vi.fn().mockRejectedValue(new Error('unavailable')),
+    });
+
+    await expect(resolveDeviceName(deviceId, deps)).resolves.toBeUndefined();
+    expect(formatDeviceId(deviceId, deps)).toBe(deviceId);
+    expect(deps.removeOutput).toHaveBeenCalledWith('/tmp/devices.json');
+  });
+
+  it('retains stale device names when a background refresh fails', async () => {
+    let now = 1_000;
+    const deps = createDependencies({ now: () => now });
+
+    await expect(resolveDeviceName(deviceId, deps)).resolves.toBe('Cam’s iPhone');
+    now = 31_001;
+    vi.mocked(deps.runDevicectl).mockRejectedValueOnce(new Error('unavailable'));
+
+    expect(formatDeviceId(deviceId, deps)).toBe(`Cam’s iPhone (${deviceId})`);
+    await expect(resolveDeviceName(deviceId, deps)).resolves.toBe('Cam’s iPhone');
+    await expect(resolveDeviceName(deviceId, deps)).resolves.toBe('Cam’s iPhone');
+    expect(formatDeviceId(deviceId, deps)).toBe(`Cam’s iPhone (${deviceId})`);
+    expect(deps.runDevicectl).toHaveBeenCalledTimes(3);
+  });
+});
```

**File**: `src/utils/__tests__/nskeyedarchiver-parser.test.ts` (modified, +33/-6)
```diff
@@ -1,4 +1,9 @@
-import { describe, it, expect } from 'vitest';
+import { beforeEach, describe, it, expect, vi } from 'vitest';
+import { parseBuffer as bplistParseBuffer } from 'bplist-parser';
+
+vi.mock('bplist-parser', () => ({
+  parseBuffer: vi.fn(),
+}));
 import {
   parseXcuserstate,
   parseXcuserstateBuffer,
@@ -8,6 +13,12 @@ import {
 } from '../nskeyedarchiver-parser.ts';
 
 describe('NSKeyedArchiver Parser', () => {
+  beforeEach(() => {
+    vi.mocked(bplistParseBuffer).mockImplementation(() => {
+      throw new Error('invalid plist');
+    });
+  });
+
   describe('parseXcuserstate (file path)', () => {
     it('returns empty result for non-existent file', () => {
       const result = parseXcuserstate('/non/existent/file.xcuserstate');
@@ -97,11 +108,27 @@ describe('NSKeyedArchiver Parser', () => {
   });
 
   describe('edge cases', () => {
-    it('handles xcuserstate without ActiveScheme', () => {
-      // This would require a specially crafted test fixture
-      // For now, we just verify the function doesn't crash
-      const result = parseXcuserstateBuffer(Buffer.from('bplist00'));
-      expect(result).toEqual({});
+    it('extracts ActiveRunDestination without ActiveScheme', () => {
+      const simulatorId = '12345678-1234-1234-1234-123456789ABC';
+      vi.mocked(bplistParseBuffer).mockReturnValue([
+        {
+          $archiver: 'NSKeyedArchiver',
+          $objects: [
+            '$null',
+            'ActiveRunDestination',
+            'targetDeviceLocation',
+            { 'NS.keys': [{ UID: 1 }], 'NS.objects': [{ UID: 4 }] },
+            { 'NS.keys': [{ UID: 2 }], 'NS.objects': [{ UID: 5 }] },
+            `dvtdevice-iphonesimulator:${simulatorId}`,
+          ],
+        },
+      ]);
+
+      expect(parseXcuserstateBuffer(Buffer.from('plist'))).toEqual({
+        deviceLocation: `dvtdevice-iphonesimulator:${simulatorId}`,
+        simulatorId,
+        simulatorPlatform: 'iphonesimulator',
+      });
     });
 
     it('handles scheme object without IDENameString', () => {
```

**File**: `src/utils/__tests__/xcodemake.test.ts` (modified, +101/-1)
```diff
@@ -1,4 +1,5 @@
 import { beforeEach, describe, expect, it, vi } from 'vitest';
+import { createHash } from 'node:crypto';
 
 const { executorMock } = vi.hoisted(() => ({
   executorMock: vi.fn(),
@@ -8,7 +9,15 @@ vi.mock('../command.ts', () => ({
   getDefaultCommandExecutor: () => executorMock,
 }));
 
-import { executeXcodemakeCommand } from '../xcodemake.ts';
+import {
+  XCODEMAKE_COMMIT,
+  XCODEMAKE_DOWNLOAD_URL,
+  XCODEMAKE_SHA256,
+  doesMakeLogFileExist,
+  executeXcodemakeCommand,
+  installXcodemake,
+  verifyXcodemakeScript,
+} from '../xcodemake.ts';
 
 describe('executeXcodemakeCommand', () => {
   beforeEach(() => {
@@ -47,3 +56,94 @@ describe('executeXcodemakeCommand', () => {
     expect(process.cwd()).toBe(originalCwd);
   });
 });
+
+describe('doesMakeLogFileExist', () => {
+  it('reads the project directory without mutating process cwd', () => {
+    const originalCwd = process.cwd();
+    const readDirectory = vi.fn(() => ['xcodemake -scheme App.log']);
+
+    const exists = doesMakeLogFileExist(
+      '/tmp/project',
+      ['xcodebuild', '-scheme', 'App'],
+      readDirectory,
+    );
+
+    expect(exists).toBe(true);
+    expect(readDirectory).toHaveBeenCalledWith('/tmp/project');
+    expect(process.cwd()).toBe(originalCwd);
+  });
+});
+
+describe('xcodemake installer integrity', () => {
+  it('pins the download URL to an exact commit and checksum', () => {
+    expect(XCODEMAKE_COMMIT).toMatch(/^[a-f0-9]{40}$/);
+    expect(XCODEMAKE_SHA256).toMatch(/^[a-f0-9]{64}$/);
+    expect(XCODEMAKE_DOWNLOAD_URL).toBe(
+      `https://raw.githubusercontent.com/cameroncooke/xcodemake/${XCODEMAKE_COMMIT}/xcodemake`,
+    );
+  });
+
+  it('accepts matching content and rejects mismatched content', () => {
+    const content = '#!/bin/sh\necho trusted\n';
+    const checksum = createHash('sha256').update(content).digest('hex');
+
+    expect(() => verifyXcodemakeScript(content, checksum)).not.toThrow();
+    expect(() => verifyXcodemakeScript(`${content}echo tampered\n`, checksum)).toThrow(
+      'xcodemake checksum mismatch',
+    );
+  });
+
+  it('does not write or chmod a script that fails integrity verification', async () => {
+    const mkdir = vi.fn().mockResolvedValue(undefined);
+    const writeFile = vi.fn().mockResolvedValue(undefined);
+    const chmod = vi.fn().mockResolvedValue(undefined);
+    const rename = vi.fn().mockResolvedValue(undefined);
+    const unlink = vi.fn().mockResolvedValue(undefined);
+    const fetchMock = vi.fn().mockResolvedValue(new Response('tampered'));
+
+    await expect(
+      installXcodemake({
+        fetch: fetchMock as typeof fetch,
+        mkdir,
+        writeFile,
+        chmod,
+        rename,
+        unlink,
+      }),
+    ).resolves.toBe(false);
+
+    expect(fetchMock).toHaveBeenCalledWith(XCODEMAKE_DOWNLOAD_URL);
+    expect(writeFile).not.toHaveBeenCalled();
+    expect(chmod).not.toHaveBeenCalled();
+    expect(rename).not.toHaveBeenCalled();
+  });
+
+  it('atomically replaces the installed script after verification', async () => {
+    const content = '#!/bin/sh\necho trusted\n';
+    const checksum = createHash('sha256').update(content).digest('hex');
+    const mkdir = vi.fn().mockResolvedValue(undefined);
+    const writeFile = vi.fn().mockResolvedValue(undefined);
+    const chmod = vi.fn().mockResolvedValue(undefined);
+    const rename = vi.fn().mockResolvedValue(undefined);
+    const unlink = vi.fn().mockRejectedValue(new Error('already renamed'));
+
+    await expect(
+      installXcodemake(
+        {
+          fetch: vi.fn().mockResolvedValue(new Response(content)) as typeof fetch,
+          mkdir,
+          writeFile,
+          chmod,
+          rename,
+          unlink,
+        },
+        checksum,
+      ),
+    ).resolves.toBe(true);
+
+    const stagingPath = expect.stringMatching(/\/xcodemake\.\d+\.[a-f0-9-]+\.tmp$/);
+    expect(writeFile).toHaveBeenCalledWith(stagingPath, content, 'utf8');
+    expect(chmod).toHaveBeenCalledWith(stagingPath, 0o755);
+    expect(rename).toHaveBeenCalledWith(stagingPath, expect.stringMatching(/\/xcodemake$/));
+  });
+});
```

---

### Incident Patch 15: `46b2cf64` (2026-07-16)
**Commit Message**: fix: Address verified Warden findings (#477)

* fix: Address verified Warden findings

Keep project scans within their workspace boundary, treat diagnostic filenames as literal glob input, and preserve simulator lookup error contracts for malformed simctl output.

Fixes #424

* fix(project-discovery): Resolve bundle scan paths from parent

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@
 
 ### Fixed
 
+- Fixed malformed simulator discovery responses, project discovery path-boundary checks, and compiler diagnostic filenames containing glob metacharacters ([#424](https://github.com/getsentry/XcodeBuildMCP/issues/424)).
 - Fixed `suppressWarnings` being ignored in settled build, build-run, and test output. The flag was honored only while streaming, so warnings still reached the final MCP tool response ([#447](https://github.com/getsentry/XcodeBuildMCP/issues/447)).
 
 ## [2.6.2]
```

**File**: `src/mcp/tools/project-discovery/__tests__/discover_projs.test.ts` (modified, +90/-0)
```diff
@@ -130,6 +130,96 @@ describe('discover_projs plugin', () => {
       expect(result.workspaces).toEqual([]);
       expect(readdirCallCount).toBe(3);
     });
+
+    it('defaults prefix-matching sibling scan paths to the workspace root', async () => {
+      const scannedPaths: string[] = [];
+      const mockFileSystemExecutor = createMockFileSystemExecutor({
+        stat: async (filePath) => {
+          scannedPaths.push(filePath);
+          return { isDirectory: () => true, mtimeMs: 0 };
+        },
+        readdir: async (directoryPath) => {
+          scannedPaths.push(directoryPath);
+          return [];
+        },
+      });
+
+      await discoverProjects(
+        { workspaceRoot: '/workspace/app', scanPath: '../application' },
+        mockFileSystemExecutor,
+      );
+
+      expect(scannedPaths).toEqual(['/workspace/app', '/workspace/app']);
+    });
+
+    it('skips recursive entries in prefix-matching sibling directories', async () => {
+      const mockFileSystemExecutor = createMockFileSystemExecutor({
+        stat: async () => ({ isDirectory: () => true, mtimeMs: 0 }),
+        readdir: async () => [
+          {
+            name: '../application/Outside.xcodeproj',
+            isDirectory: () => true,
+            isSymbolicLink: () => false,
+          },
+        ],
+      });
+
+      const result = await discoverProjects(
+        { workspaceRoot: '/workspace/app' },
+        mockFileSystemExecutor,
+      );
+
+      expect(result.projects).toEqual([]);
+    });
+
+    it('uses the containing directory as the recursive boundary for bundle workspace roots', async () => {
+      const mockFileSystemExecutor = createMockFileSystemExecutor({
+        stat: async () => ({ isDirectory: () => true, mtimeMs: 0 }),
+        readdir: async () => [
+          { name: 'App.xcodeproj', isDirectory: () => true, isSymbolicLink: () => false },
+        ],
+      });
+
+      const result = await discoverProjects(
+        { workspaceRoot: '/workspace/App.xcodeproj' },
+        mockFileSystemExecutor,
+      );
+
+      expect(result.projects).toEqual(['/workspace/App.xcodeproj']);
+    });
+
+    it('uses the containing directory for relative bundle workspace roots', async () => {
+      const scannedPaths: string[] = [];
+      const mockFileSystemExecutor = createMockFileSystemExecutor({
+        stat: async (filePath) => {
+          scannedPaths.push(filePath);
+          return { isDirectory: () => true, mtimeMs: 0 };
+        },
+        readdir: async () => [],
+      });
+
+      await discoverProjects({ workspaceRoot: 'App.xcodeproj' }, mockFileSystemExecutor);
+
+      expect(scannedPaths).toEqual([process.cwd()]);
+    });
+
+    it('resolves an explicit dot scan path from a relative bundle workspace root', async () => {
+      const scannedPaths: string[] = [];
+      const mockFileSystemExecutor = createMockFileSystemExecutor({
+        stat: async (filePath) => {
+          scannedPaths.push(filePath);
+          return { isDirectory: () => true, mtimeMs: 0 };
+        },
+        readdir: async () => [],
+      });
+
+      await discoverProjects(
+        { workspaceRoot: 'App.xcodeproj', scanPath: '.' },
+        mockFileSystemExecutor,
+      );
+
+      expect(scannedPaths).toEqual([process.cwd()]);
+    });
   });
 
   describe('Logic error handling', () => {
```

**File**: `src/mcp/tools/project-discovery/discover_projs.ts` (modified, +18/-22)
```diff
@@ -25,6 +25,16 @@ interface DirentLike {
   isSymbolicLink(): boolean;
 }
 
+function isPathWithin(rootPath: string, candidatePath: string): boolean {
+  const relativePath = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
+  return (
+    relativePath === '' ||
+    (relativePath !== '..' &&
+      !relativePath.startsWith(`..${path.sep}`) &&
+      !path.isAbsolute(relativePath))
+  );
+}
+
 function getErrorDetails(
   error: unknown,
   fallbackMessage: string,
@@ -62,8 +72,6 @@ async function _findProjectsRecursive(
   }
 
   log('debug', `Scanning directory: ${currentDirAbs} at depth ${currentDepth}`);
-  const normalizedWorkspaceRoot = path.normalize(workspaceRootAbs);
-
   try {
     const entries = await fileSystemExecutor.readdir(currentDirAbs, { withFileTypes: true });
     for (const rawEntry of entries) {
@@ -81,7 +89,7 @@ async function _findProjectsRecursive(
         continue;
       }
 
-      if (!path.normalize(absoluteEntryPath).startsWith(normalizedWorkspaceRoot)) {
+      if (!isPathWithin(workspaceRootAbs, absoluteEntryPath)) {
         log(
           'warn',
           `Skipping entry outside workspace root: ${absoluteEntryPath} (Workspace: ${workspaceRootAbs})`,
@@ -166,38 +174,26 @@ function isBundleLikePath(workspaceRoot: string): boolean {
   );
 }
 
-function resolveScanBase(workspaceRoot: string, scanPath?: string): string {
-  if (scanPath) {
-    return scanPath;
-  }
-
-  if (isBundleLikePath(workspaceRoot)) {
-    return path.dirname(workspaceRoot);
-  }
-
-  return '.';
-}
-
 async function discoverProjectsOrError(
   params: DiscoverProjectsParams,
   fileSystemExecutor: FileSystemExecutor,
 ): Promise<DiscoverProjectsComputation> {
-  const scanPath = resolveScanBase(params.workspaceRoot, params.scanPath);
+  const scanPath = params.scanPath ?? '.';
   const maxDepth = params.maxDepth ?? DEFAULT_MAX_DEPTH;
   const workspaceRoot = params.workspaceRoot;
 
-  const requestedScanPath = path.resolve(workspaceRoot, scanPath);
-  let absoluteScanPath = requestedScanPath;
   const workspaceBoundary = isBundleLikePath(workspaceRoot)
     ? path.dirname(workspaceRoot)
     : workspaceRoot;
-  const normalizedWorkspaceRoot = path.normalize(workspaceBoundary);
-  if (!path.normalize(absoluteScanPath).startsWith(normalizedWorkspaceRoot)) {
+  const absoluteWorkspaceBoundary = path.resolve(workspaceBoundary);
+  const requestedScanPath = path.resolve(absoluteWorkspaceBoundary, scanPath);
+  let absoluteScanPath = requestedScanPath;
+  if (!isPathWithin(absoluteWorkspaceBoundary, absoluteScanPath)) {
     log(
       'warn',
       `Requested scan path '${scanPath}' resolved outside workspace root '${workspaceRoot}'. Defaulting scan to workspace root.`,
     );
-    absoluteScanPath = normalizedWorkspaceRoot;
+    absoluteScanPath = absoluteWorkspaceBoundary;
   }
 
   const context: DiscoverProjectsExecutionContext = {
@@ -228,7 +224,7 @@ async function discoverProjectsOrError(
   const results: DiscoverProjectsResult = { projects: [], workspaces: [] };
   await _findProjectsRecursive(
     absoluteScanPath,
-    workspaceRoot,
+    absoluteWorkspaceBoundary,
     0,
     maxDepth,
     results,
```

**File**: `src/utils/__tests__/simulator-resolver.test.ts` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+import { describe, expect, it } from 'vitest';
+import { createMockExecutor } from '../../test-utils/mock-executors.ts';
+import { resolveSimulatorIdToName, resolveSimulatorNameToId } from '../simulator-resolver.ts';
+
+describe('simulator resolver', () => {
+  it('returns a contract error for invalid JSON from simctl', async () => {
+    const result = await resolveSimulatorNameToId(
+      createMockExecutor({ output: 'not-json' }),
+      'iPhone 17 Pro',
+    );
+
+    expect(result).toMatchObject({
+      success: false,
+      error: expect.stringContaining('Failed to parse simulator list:'),
+    });
+  });
+
+  it('returns a contract error for a malformed devices payload', async () => {
+    const result = await resolveSimulatorIdToName(
+      createMockExecutor({ output: JSON.stringify({ devices: { 'iOS 27.0': null } }) }),
+      'SIMULATOR-ID',
+    );
+
+    expect(result).toEqual({
+      success: false,
+      error: 'Failed to parse simulator list: simctl returned an invalid devices payload.',
+    });
+  });
+});
```

**File**: `src/utils/__tests__/simulator-steps.test.ts` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+import { describe, expect, it } from 'vitest';
+import { createMockExecutor } from '../../test-utils/mock-executors.ts';
+import { findSimulatorById } from '../simulator-steps.ts';
+
+describe('simulator steps', () => {
+  it('returns a contract error for invalid JSON from simctl', async () => {
+    const result = await findSimulatorById(
+      'SIMULATOR-ID',
+      createMockExecutor({ output: 'not-json' }),
+    );
+
+    expect(result).toMatchObject({
+      simulator: null,
+      error: expect.stringContaining('Failed to parse simulator list:'),
+    });
+  });
+});
```

**File**: `src/utils/renderers/__tests__/event-formatting.test.ts` (modified, +31/-0)
```diff
@@ -1,3 +1,5 @@
+import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
+import { tmpdir } from 'node:os';
 import { join } from 'node:path';
 import { describe, expect, it } from 'vitest';
 import {
@@ -126,6 +128,35 @@ describe('event formatting', () => {
     );
   });
 
+  it('treats glob metacharacters in compiler diagnostic filenames literally', () => {
+    const projectBaseDir = mkdtempSync(join(tmpdir(), 'xcodebuildmcp-diagnostic-'));
+    const sourceDir = join(projectBaseDir, 'Sources');
+    const decoyDir = join(projectBaseDir, 'Decoy');
+    const literalFile = join(sourceDir, 'ContentView[1].swift');
+
+    try {
+      mkdirSync(sourceDir, { recursive: true });
+      mkdirSync(decoyDir, { recursive: true });
+      writeFileSync(literalFile, '');
+      writeFileSync(join(decoyDir, 'ContentView1.swift'), '');
+
+      const rendered = formatHumanCompilerErrorEvent(
+        {
+          type: 'compiler-error',
+          operation: 'BUILD',
+          message: 'unterminated string literal',
+          rawLine: 'ContentView[1].swift:16:18: error: unterminated string literal',
+        },
+        { baseDir: projectBaseDir },
+      );
+
+      expect(rendered).toContain(`${literalFile}:16:18`);
+      expect(rendered).not.toContain('Decoy/ContentView1.swift');
+    } finally {
+      rmSync(projectBaseDir, { recursive: true, force: true });
+    }
+  });
+
   it('formats tool-originated errors in xcodebuild-style form', () => {
     expect(
       formatHumanCompilerErrorEvent({
```

**File**: `src/utils/renderers/event-formatting.ts` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 import { existsSync } from 'node:fs';
 import path from 'node:path';
-import { globSync } from 'glob';
+import { escape, globSync } from 'glob';
 import type {
   ArtifactRenderItem,
   BuildStageRenderItem,
@@ -211,7 +211,7 @@ function resolveDiagnosticPathCandidate(
     return cached ?? filePath;
   }
 
-  const matches = globSync(`**/${filePath}`, {
+  const matches = globSync(`**/${escape(filePath)}`, {
     cwd: options.baseDir,
     nodir: true,
     ignore: DIAGNOSTIC_PATH_IGNORE_PATTERNS,
```

**File**: `src/utils/simulator-resolver.ts` (modified, +36/-5)
```diff
@@ -7,6 +7,41 @@ export type SimulatorResolutionResult =
 
 type SimulatorDevice = { udid: string; name: string };
 
+function isRecord(value: unknown): value is Record<string, unknown> {
+  return typeof value === 'object' && value !== null && !Array.isArray(value);
+}
+
+function isSimulatorDevice(value: unknown): value is SimulatorDevice {
+  return isRecord(value) && typeof value.udid === 'string' && typeof value.name === 'string';
+}
+
+function parseSimulatorDevices(
+  output: string,
+): { devices: Record<string, SimulatorDevice[]> } | { error: string } {
+  let parsed: unknown;
+  try {
+    parsed = JSON.parse(output) as unknown;
+  } catch (parseError) {
+    return { error: `Failed to parse simulator list: ${parseError}` };
+  }
+
+  if (!isRecord(parsed) || !isRecord(parsed.devices)) {
+    return { error: 'Failed to parse simulator list: simctl returned an invalid devices payload.' };
+  }
+
+  const devices: Record<string, SimulatorDevice[]> = {};
+  for (const [runtime, runtimeDevices] of Object.entries(parsed.devices)) {
+    if (!Array.isArray(runtimeDevices) || !runtimeDevices.every(isSimulatorDevice)) {
+      return {
+        error: 'Failed to parse simulator list: simctl returned an invalid devices payload.',
+      };
+    }
+    devices[runtime] = runtimeDevices;
+  }
+
+  return { devices };
+}
+
 async function fetchSimulatorDevices(
   executor: CommandExecutor,
 ): Promise<{ devices: Record<string, SimulatorDevice[]> } | { error: string }> {
@@ -20,11 +55,7 @@ async function fetchSimulatorDevices(
     return { error: `Failed to list simulators: ${result.error}` };
   }
 
-  try {
-    return JSON.parse(result.output) as { devices: Record<string, SimulatorDevice[]> };
-  } catch (parseError) {
-    return { error: `Failed to parse simulator list: ${parseError}` };
-  }
+  return parseSimulatorDevices(result.output);
 }
 
 function findSimulator(
```

#### Recent Merged Pull Requests:
- **PR #539** (2026-09-23): ci: Unblock tag-triggered release workflows (@itaybre)
- **PR #538** (2026-09-23): ref!: Rename project to MobileBuildMCP (@itaybre)
- **PR #536** (closed): feat: add managed simulator resource leases (@RxChi1d)
- **PR #522** (closed): chore(deps-dev): bump @humanfs/node from 0.16.6 to 0.16.8 (@dependabot[bot])
- **PR #521** (closed): chore(deps): bump fast-uri from 3.1.4 to 3.1.7 (@dependabot[bot])
- **PR #515** (closed): chore(deps): bump @hono/node-server from 1.19.13 to 1.19.17 (@dependabot[bot])
- **PR #510** (closed): chore(deps): bump hono from 4.12.31 to 4.13.1 (@dependabot[bot])
- **PR #508** (closed): feat(mcp): support protocol revision 2026-07-28 on SDK v2 (@anxkhn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
