# Forensic Learning Record (Deep Inspection): KnockOutEZ/wigolo

> **Canonical Artifact**: `07_PROJECT_LEARNING/knockoutez-wigolo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/KnockOutEZ/wigolo](https://github.com/KnockOutEZ/wigolo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:26:35.912Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `KnockOutEZ/wigolo`
- **Description**: The go-to web for your AI coding agent — local-first search, fetch, crawl & research over MCP. No API keys, no cloud, $0/query. Public beta.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 5443 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/search/mock-engine.ts`
```
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from '../../src/logger.js';
import type { SearchEngine, SearchEngineOptions, RawSearchResult } from '../../src/types.js';
import type { PrerecordedResponse } from './types.js';

const log = createLogger('search');

export interface MockEngineOptions {
  simulateLatencyMs?: number;
  simulateError?: boolean;
}

export function loadPrerecordedResponses(responsesDir: string): Map<string, PrerecordedResponse> {
  try {
    if (!existsSync(responsesDir)) {
      throw new Error(`Responses directory not found: ${responsesDir}`);
    }

    const files = readdirSync(responsesDir);
    const responses = new Map<string, PrerecordedResponse>();

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const raw = readFileSync(join(responsesDir, file), 'utf-8');
        const parsed = JSON.parse(raw) as PrerecordedResponse;
        if (parsed.queryId && Array.isArray(parsed.results)) {
          responses.set(parsed.queryId, parsed);
        }
      } catch (err) {
        log.warn('skipping malformed response file', { file, error: String(err) });
      }
    }

    return responses;
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) throw err;
    log.error('loadPrerecordedResponses failed', { error: String(err) });
    throw err;
  }
}

export class MockSearchEngine implements SearchEngine {
  name = 'mock';

  constructor(
    private readonly responses: Map<string, PrerecordedResponse>,
    private readonly queryId: string,
    private readonly options: MockEngineOptions = {},
  ) {}

  async search(query: string, options?: SearchEngineOptions): Promise<RawSearchResult[]> {
    try {
      if (this.options.simulateError) {
        throw new Error('Simulated search engine error');
      }

      if (this.options.simulateLatencyMs && this.options.simulateLatencyMs > 0) {
        await new Promise(resolve => setTimeout(resolve, this.options.simulateLatencyMs));
      }

      const response = this.responses.get(this.queryId);
      if (!response) {
        log.debug('no prerecorded response for queryId', { queryId: this.queryId });
        return [];
      }

      let results = response.results.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        relevance_score: r.relevance_score,
        engine: 'mock' as const,
      }));

      if (options?.maxResults && options.maxResults < results.length) {
        results = results.slice(0, options.maxResults);
      }

      return results;
    } catch (err) {
      if (this.options.simulateError) throw err;
      log.error('MockSearchEngine.search failed', { error: String(err) });
      return [];
    }
  }
}

```

### Core Architecture Module: `examples/plugin-search-engine/index.mjs`
```
export const searchEngine = {
  name: 'example-search-engine',
  async search(query) {
    return [
      {
        title: `Example result for ${query}`,
        url: 'https://example.com/search-engine-example',
        snippet: 'Minimal search engine plugin example.',
        relevance_score: 1,
        engine: 'example-search-engine',
      },
    ];
  },
};

```

### Core Architecture Module: `packages/wigolo-crewai/wigolo_crewai/_core.py`
```
"""CrewAI-free core logic for wigolo-crewai.

This module holds all of the real behaviour — building a wigolo client and the
per-tool run functions that map arguments onto the SDK, shape the result into a
JSON string, and turn wigolo errors into clean error strings. It deliberately
does NOT import crewai, so it is fully unit-testable without that dependency.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from wigolo import Client, WigoloError


def build_client(
    base_url: Optional[str] = None,
    token: Optional[str] = None,
    local: bool = True,
) -> Client:
    """Construct a wigolo ``Client``.

    Defaults to ``local=True`` so a zero-setup embedded daemon is spawned when
    no server is configured. Pass ``base_url``/``token`` to target a running
    server instead, or ``local=False`` to require one.
    """
    return Client(base_url=base_url, token=token, local=local)


def _drop_none(mapping: dict[str, Any]) -> dict[str, Any]:
    """Strip ``None`` values so SDK defaults apply for unset arguments."""
    return {k: v for k, v in mapping.items() if v is not None}


def _to_json(result: Any) -> str:
    """Serialize a tool result dict to a compact JSON string."""
    return json.dumps(result, default=str, ensure_ascii=False)


def _error(tool: str, exc: Exception) -> str:
    """Map a wigolo error into a clean JSON error string (no stack trace)."""
    return json.dumps({"error": f"wigolo {tool} failed: {exc}"}, ensure_ascii=False)


def run_search(
    client: Client,
    query: str,
    *,
    max_results: int = 5,
    include_content: bool = True,
    time_range: Optional[str] = None,
    include_domains: Optional[list[str]] = None,
    exclude_domains: Optional[list[str]] = None,
    category: Optional[str] = None,
    **kwargs: Any,
) -> str:
    """Search the web and return results as a JSON string."""
    params = _drop_none(
        {
            "query": query,
            "max_results": max_results,
            "include_content": include_content,
            "time_range": time_range,
            "include_domains": include_domains,
            "exclude_domains": exclude_domains,
            "category": category,
            **kwargs,
        }
    )
    try:
        return _to_json(client.search(**params))
    except WigoloError as exc:
        return _error("search", exc)


def run_fetch(
    client: Client,
    url: str,
    *,
    render_js: bool = False,
    section: Optional[str] = None,
    max_chars: Optional[int] = None,
    use_auth: bool = False,
    **kwargs: Any,
) -> str:
    """Fetch a single page and return its content as a JSON string."""
    params = _drop_none(
        {
            "url": url,
            "render_js": render_js,
            "section": section,
            "max_chars": max_chars,
            "use_auth": use_auth,
            **kwargs,
        }
    )
    try:
        return _to_json(client.fetch(**params))
    except WigoloError as exc:
        return _error("fetch", exc)


def run_research(
    client: Client,
    question: str,
    *,
    depth: str = "standard",
    max_sources: Optional[int] = None,
    include_domains: Optional[list[str]] = None,
    exclude_domains: Optional[list[str]] = None,
    **kwargs: Any,
) -> str:
    """Run multi-step research and return the brief as a JSON string."""
    params = _drop_none(
        {
            "question": question,
            "depth": depth,
            "max_sources": max_sources,
            "include_domains": include_domains,
            "exclude_domains": exclude_domains,
            **kwargs,
        }
    )
    try:
        return _to_json(client.research(**params))
    except WigoloError as exc:
        return _error("research", exc)


def run_crawl(
    client: Client,
    url: str,
    *,
    strategy: str = "bfs",
    max_depth: Optional[int] = None,
    max_pages: Optional[int] = None,
    include_patterns: Optional[list[str]] = None,
    exclude_patterns: Optional[list[str]] = None,
    **kwargs: Any,
) -> str:
    """Crawl a site and return the pages/urls as a JSON string."""
    params = _drop_none(
        {
            "url": url,
            "strategy": strategy,
            "max_depth": max_depth,
            "max_pages": max_pages,
            "include_patterns": include_patterns,
            "exclude_patterns": exclude_patterns,
            **kwargs,
        }
    )
    try:
        return _to_json(client.crawl(**params))
    except WigoloError as exc:
        return _error("crawl", exc)


def run_extract(
    client: Client,
    url: str,
    *,
    mode: str = "structured",
    schema: Optional[Any] = None,
    css_selector: Optional[str] = None,
    **kwargs: Any,
) -> str:
    """Extract structured data from a page and return it as a JSON string."""
    params = _drop_none(
        {
            "url": url,
            "mode": mode,
            "schema": schema,
            "css_selector": css_selector,
            **kwargs,
        }
    )
    try:
        return _to_json(client.extract(**params))
    except WigoloError as exc:
        return _error("extract", exc)

```

### Core Architecture Module: `packaging/binary/react-devtools-core-stub.mjs`
```
// Stub for `react-devtools-core`, an optional dev-only import inside ink. It is
// not installed as a runtime dependency, but esbuild hoists the external import
// to an eager top-level require in flat output, which crashes boot inside the
// binary. Aliasing to this no-op stub keeps the ink import resolvable while the
// TUI itself stays externalized/unavailable in the binary (headless-first).
export function connectToDevTools() {}
export function initialize() {}
export default {};

```

### Core Architecture Module: `src/cache/diff-engine.ts`
```
import { createLogger } from '../logger.js';
import type { DiffHunk, DiffSummary, DiffOutput, DiffOutputShape, DiffGranularity } from '../types.js';
import { computeLcsTable } from './lcs.js';

const log = createLogger('cache');

/**
 * Line cap above which LCS is skipped and the envelope falls back to a
 * summary-only shape with `truncated: true`. Mirrors `MAX_DIFF_LINES` in
 * `diff-summary.ts` so the two modules degrade in lock-step. A unit test
 * pins them equal — if you tune one, tune the other.
 */
export const DIFF_LINE_CAP = 5000;

/**
 * Token cap for word-granularity LCS. The LCS DP table is O(m*n) — at
 * 5000-line cap a page averaging ~25 tokens/line could reach ~125k tokens
 * per side, producing a ~15.6-billion-cell table (~62 GB at 4 bytes/cell)
 * that crashes the MCP server outright. PR #89 sec+perf reviewers flagged
 * this as HIGH. At 50k tokens per side the table is ~10 GB-virtual /
 * realistic-sparse-write — still a lot, but inside what V8 can lazily
 * back. Inputs over the cap fall back to line-granularity hunks and the
 * envelope carries `truncated: true` so callers see the degrade.
 */
export const DIFF_TOKEN_CAP = 50_000;

const UNIFIED_CONTEXT = 3;

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function splitLines(text: string): string[] {
  if (text === '') return [];
  const normalized = normalizeLineEndings(text);
  const lines = normalized.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

type EditOp =
  | { type: 'equal'; oldLine: string; newLine: string }
  | { type: 'delete'; oldLine: string }
  | { type: 'insert'; newLine: string };

/** Walk the LCS DP table backwards to produce an ordered edit script. */
function buildEditScript(oldLines: string[], newLines: string[]): EditOp[] {
  const m = oldLines.length;
  const n = newLines.length;
  const stride = n + 1;
  const dp = computeLcsTable(oldLines, newLines);
  const ops: EditOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: 'equal', oldLine: oldLines[i - 1], newLine: newLines[j - 1] });
      i--;
      j--;
    } else if (dp[(i - 1) * stride + j] >= dp[i * stride + (j - 1)]) {
      ops.push({ type: 'delete', oldLine: oldLines[i - 1] });
      i--;
    } else {
      ops.push({ type: 'insert', newLine: newLines[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    ops.push({ type: 'delete', oldLine: oldLines[i - 1] });
    i--;
  }
  while (j > 0) {
    ops.push({ type: 'insert', newLine: newLines[j - 1] });
    j--;
  }
  ops.reverse();
  return ops;
}

function countsFromOps(ops: EditOp[]): { added: number; removed: number; modified: number } {
  // Pair adjacent delete+insert runs as "modified" — git's default semantics.
  // Order-tolerant: LCS backtrack can emit insert-then-delete or
  // delete-then-insert depending on the dp-table tie-breaking.
  let added = 0;
  let removed = 0;
  let modified = 0;
  let i = 0;
  while (i < ops.length) {
    if (ops[i].type === 'equal') {
      i++;
      continue;
    }
    let dels = 0;
    let ins = 0;
    while (i < ops.length && ops[i].type !== 'equal') {
      if (ops[i].type === 'delete') dels++;
      else if (ops[i].type === 'insert') ins++;
      i++;
    }
    const pair = Math.min(dels, ins);
    modified += pair;
    removed += dels - pair;
    added += ins - pair;
  }
  return { added, removed, modified };
}

function changedCharsFromOps(ops: EditOp[]): number {
  let total = 0;
  for (const op of ops) {
    if (op.type === 'delete') total += op.oldLine.length;
    else if (op.type === 'insert') total += op.newLine.length;
  }
  return total;
}

function approximateSummaryForTruncated(oldLines: string[], newLines: string[]): DiffSummary {
  // We can't run LCS over the cap (quadratic blow-up). Approximate counts so
  // the caller still sees the magnitude of the change.
  const m = oldLines.length;
  const n = newLines.length;
  if (m === 0) return { added_lines: n, removed_lines: 0, modified_lines: 0, total_changed_chars: charLen(newLines) };
  if (n === 0) return { added_lines: 0, removed_lines: m, modified_lines: 0, total_changed_chars: charLen(oldLines) };
  const overlap = Math.min(m, n);
  const modified = overlap;
  const added = Math.max(0, n - overlap);
  const removed = Math.max(0, m - overlap);
  return {
    added_lines: added,
    removed_lines: removed,
    modified_lines: modified,
    total_changed_chars: charLen(oldLines) + charLen(newLines),
  };
}

function charLen(lines: string[]): number {
  let total = 0;
  for (const l of lines) total += l.length;
  return total;
}

export interface UnifiedDiffResult {
  diff: string;
  truncated: boolean;
  summary: DiffSummary;
}

export function computeUnifiedDiff(oldText: string, newText: string): UnifiedDiffResult {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);

  if (oldLines.length > DIFF_LINE_CAP || newLines.length > DIFF_LINE_CAP) {
    log.debug('diff-engine: line cap exceeded, returning approximate summary', {
      oldLineCount: oldLines.length,
      newLineCount: newLines.length,
    });
    return {
      diff: '',
      truncated: true,
      summary: approximateSummaryForTruncated(oldLines, newLines),
    };
  }

  const ops = buildEditScript(oldLines, newLines);
  const counts = countsFromOps(ops);
  const summary: DiffSummary = {
    added_lines: counts.added,
    removed_lines: counts.removed,
    modified_lines: counts.modified,
    total_changed_chars: changedCharsFromOps(ops),
  };

  if (counts.added === 0 && counts.removed === 0 && counts.modified === 0) {
    return { diff: '', truncated: false, summary };
  }

  // Normalize once and pass to the renderer pre-sorted. Avoids a second
  // O(n) pass inside `renderUnifiedDiff`.
  const normalized = normalizeEditOrder(ops);
  const diff = renderUnifiedDiff(normalized);
  return { diff, truncated: false, summary };
}

/**
 * Cheaper alternative to `computeUnifiedDiff` for callers (the section walker)
 * that only need the summary counts. Runs LCS once via `buildEditScript`
 * and computes counts + char totals without rendering the unified patch
 * or normalizing edit order.
 */
export function computeDiffSummaryOnly(oldText: string, newText: string): UnifiedDiffResult {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);

  if (oldLines.length > DIFF_LINE_CAP || newLines.length > DIFF_LINE_CAP) {
    return {
      diff: '',
      truncated: true,
      summary: approximateSummaryForTruncated(oldLines, newLines),
    };
  }

  const ops = buildEditScript(oldLines, newLines);
  const counts = countsFromOps(ops);
  return {
    diff: '',
    truncated: false,
    summary: {
      added_lines: counts.added,
      removed_lines: counts.removed,
      modified_lines: counts.modified,
      total_changed_chars: changedCharsFromOps(ops),
    },
  };
}

/**
 * Reorder consecutive non-equal ops so all deletes come before inserts
 * within a run. Matches `git diff` rendering convention — pure ordering
 * tweak, never changes the set of ops.
 */
function normalizeEditOrder(ops: EditOp[]): EditOp[] {
  const out: EditOp[] = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].type === 'equal') {
      out.push(ops[i]);
      i++;
      continue;
    }
    const dels: EditOp[] = [];
    const ins: EditOp[] = [];
    while (i < ops.length && ops[i].type !== 'equal') {
      if (ops[i].type === 'delete') dels.push(ops[i]);
      else ins.push(ops[i]);
      i++;
    }
    out.push(...dels, ...ins);
  }
  return out;
}

/**
 * Render a unified-diff string. **Caller must pass already-normalized ops.**
 * `computeUnifiedDiff` runs `normalizeEditOrder` once before calling — keeping
 * the normalize step out of the render path avoids a second O(n) pass.
 */
function renderUnifiedDiff(ops: EditOp[]): string {
  // Track old/new line numbers as we walk ops; emit @@ hunks grouped by
  // proximity (within 2*UNIFIED_CONTEXT lines counts as one hunk).
  type Group = { ops: EditOp[]; oldStart: number; newStart: number };
  const groups: Group[] = [];
  let oldLine = 1;
  let newLine = 1;
  let pendingContext: EditOp[] = [];
  let current: Group | null = null;
  let trailingEquals = 0;

  const flushCurrent = () => {
    if (current) {
      groups.push(current);
      current = null;
      trailingEquals = 0;
    }
  };

  for (const op of ops) {
    if (op.type === 'equal') {
      if (current) {
        current.ops.push(op);
        trailingEquals++;
        if (trailingEquals > 2 * UNIFIED_CONTEXT) {
          // Trim trailing context to UNIFIED_CONTEXT and flush.
          const keep = current.ops.length - (trailingEquals - UNIFIED_CONTEXT);
          current.ops = current.ops.slice(0, keep);
          flushCurrent();
          pendingContext = [op];
        }
      } else {
        pendingContext.push(op);
        if (pendingContext.length > UNIFIED_CONTEXT) {
          pendingContext.shift();
        }
      }
      oldLine++;
      newLine++;
    } else {
      if (!current) {
        const leadingContext = pendingContext.slice(-UNIFIED_CONTEXT);
        const oldStart = oldLine - leadingContext.length;
        const newStart = newLine - leadingContext.length;
        current = { ops: [...leadingContext, op], oldStart, newStart };
        pendingContext = [];
      } else {
        current.ops.push(op);
      }
      trailingEquals = 0;
      if (op.type === 'delete') oldLine++;
      else newLine++;
    }
  }

  if (current) {
    // Trim trailing context if it exceeds the window.
    const tail = current.ops.length;
    let trail = 0;
    for (let k = tail - 1; k >= 0; k--) {
      if (current.ops[k].type === 'equal') trail++;
      else break;
    }
    if (trail > UNIFIED_CONTEXT) {
      current.ops = current.ops.slice(0, tail - (trail - UNIFIED_CONTEXT));
    }
    flu
```

### Core Architecture Module: `src/cli/agents/utils.ts`
```
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, lstatSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

export function getPackageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/cli/agents/utils.js → ../../.. = package root
  return join(here, '..', '..', '..');
}

export function getVersion(): string {
  try {
    const raw = readFileSync(join(getPackageRoot(), 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function readAsset(relPath: string): string {
  const full = join(getPackageRoot(), 'assets', relPath);
  return readFileSync(full, 'utf-8').replace(/\{version\}/g, getVersion());
}

/**
 * If a backup file already exists at `bakPath`, rename it to a timestamped
 * sibling so a subsequent backup write does not destroy the prior copy.
 * Silent no-op when no backup exists or the rename fails — best-effort safety
 * net for repeated interrupted installs.
 */
function rotateBackup(bakPath: string): void {
  if (!existsSync(bakPath)) return;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  let target = `${bakPath}.${ts}`;
  let suffix = 0;
  while (existsSync(target)) {
    suffix += 1;
    target = `${bakPath}.${ts}-${suffix}`;
  }
  try {
    renameSync(bakPath, target);
  } catch {
    // best-effort — leave the existing bak in place rather than crash
  }
}

/**
 * Merge a block (delimited by wigolo:start/wigolo:end markers) into a file.
 * Creates the file if it doesn't exist.
 * Replaces an existing block, or appends if no block present.
 *
 * Mismatched markers (one present, not both) are treated as corruption from a
 * previously interrupted write — the file is backed up to <path>.wigolo-bak
 * and the mismatched marker is stripped before the new block is appended.
 * Without this guard the next merge would eat user content between the
 * orphan marker and the freshly-written end marker.
 */
export function mergeBlock(filePath: string, block: string): void {
  mkdirSync(dirname(filePath), { recursive: true });

  const START = '<!-- wigolo:start';
  const END = '<!-- wigolo:end -->';

  if (!existsSync(filePath)) {
    writeFileSync(filePath, block.trimEnd() + '\n', 'utf-8');
    return;
  }

  const content = readFileSync(filePath, 'utf-8');
  const startIdx = content.indexOf(START);
  const endIdx = content.indexOf(END);
  const hasStart = startIdx !== -1;
  const hasEnd = endIdx !== -1;

  if (hasStart && hasEnd) {
    const before = content.slice(0, startIdx).trimEnd();
    const after = content.slice(endIdx + END.length).trimStart();
    const parts = [before, block.trimEnd(), after].filter(Boolean);
    writeFileSync(filePath, parts.join('\n\n') + '\n', 'utf-8');
    return;
  }

  if (hasStart !== hasEnd) {
    rotateBackup(filePath + '.wigolo-bak');
    writeFileSync(filePath + '.wigolo-bak', content, 'utf-8');

    let salvaged = content;
    if (hasStart) {
      // Drop everything from the orphan start marker to end-of-line.
      const lineEnd = content.indexOf('\n', startIdx);
      salvaged = (content.slice(0, startIdx).trimEnd()
        + (lineEnd === -1 ? '' : '\n' + content.slice(lineEnd + 1))).trimEnd();
    } else {
      // Drop the orphan end marker line.
      const lineStart = content.lastIndexOf('\n', endIdx);
      const lineEnd = content.indexOf('\n', endIdx);
      const head = lineStart === -1 ? '' : content.slice(0, lineStart);
      const tail = lineEnd === -1 ? '' : content.slice(lineEnd + 1);
      salvaged = (head + (head && tail ? '\n' : '') + tail).trimEnd();
    }

    const out = salvaged
      ? salvaged + '\n\n' + block.trimEnd() + '\n'
      : block.trimEnd() + '\n';
    writeFileSync(filePath, out, 'utf-8');
    return;
  }

  const trimmed = content.trimEnd();
  writeFileSync(filePath, trimmed + '\n\n' + block.trimEnd() + '\n', 'utf-8');
}

/**
 * Remove the wigolo block from a file. Returns true if a block was removed.
 *
 * If the block was the file's only content, the file is unlinked rather than
 * left as a 0-byte stub. Symlinks are never unlinked — they may resolve to
 * user content outside the file we own.
 */
export function removeBlock(filePath: string): boolean {
  if (!existsSync(filePath)) return false;

  const START = '<!-- wigolo:start';
  const END = '<!-- wigolo:end -->';
  const content = readFileSync(filePath, 'utf-8');
  const startIdx = content.indexOf(START);
  const endIdx = content.indexOf(END);

  if (startIdx === -1 || endIdx === -1) return false;

  const before = content.slice(0, startIdx).trimEnd();
  const after = content.slice(endIdx + END.length).trimStart();
  const parts = [before, after].filter(Boolean);
  const newContent = parts.join('\n\n');

  if (!newContent) {
    let isSymlink = false;
    try {
      isSymlink = lstatSync(filePath).isSymbolicLink();
    } catch {
      isSymlink = false;
    }
    if (!isSymlink) {
      try {
        unlinkSync(filePath);
        return true;
      } catch {
        // fall through to truncate
      }
    }
    writeFileSync(filePath, '', 'utf-8');
    return true;
  }

  writeFileSync(filePath, newContent + '\n', 'utf-8');
  return true;
}

/**
 * Create or merge an MCP server entry into a JSON config file.
 * keyPath like ['mcpServers', 'wigolo'] navigates/creates nested keys.
 * Other servers in the file are preserved.
 */
export function mergeMcpJson(
  configPath: string,
  entry: Record<string, unknown>,
  keyPath: string[],
): void {
  mkdirSync(dirname(configPath), { recursive: true });

  let root: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      root = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    } catch {
      root = {};
    }
  }

  let obj = root;
  for (let i = 0; i < keyPath.length - 1; i++) {
    const key = keyPath[i];
    if (typeof obj[key] !== 'object' || obj[key] === null) {
      obj[key] = {};
    }
    obj = obj[key] as Record<string, unknown>;
  }
  obj[keyPath[keyPath.length - 1]] = entry;

  writeFileSync(configPath, JSON.stringify(root, null, 2) + '\n', 'utf-8');
}

/** Remove the wigolo entry from a JSON MCP config, preserving other servers. */
export function removeMcpJson(configPath: string, keyPath: string[]): void {
  if (!existsSync(configPath)) return;

  let root: Record<string, unknown>;
  try {
    root = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return;
  }

  let obj = root;
  for (let i = 0; i < keyPath.length - 1; i++) {
    const key = keyPath[i];
    if (typeof obj[key] !== 'object' || obj[key] === null) return;
    obj = obj[key] as Record<string, unknown>;
  }
  delete obj[keyPath[keyPath.length - 1]];

  writeFileSync(configPath, JSON.stringify(root, null, 2) + '\n', 'utf-8');
}

/** Detect whether wigolo is installed globally and return the appropriate command. */
export function getMcpCommand(): { command: string; args: string[] } {
  try {
    const path = execSync('which wigolo', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (path) {
      return { command: 'wigolo', args: [] };
    }
  } catch {
    // not found globally
  }
  return { command: 'npx', args: ['-y', 'wigolo'] };
}

```

### Core Architecture Module: `src/cli/tui/components/FieldRenderer.tsx`
```
/**
 * FieldRenderer — generic Ink component that renders one schema-driven field.
 *
 * Stateless except for an ephemeral edit buffer used while editing text-like
 * inputs (text/number/path). Edit-mode is parent-controlled via the `editing`
 * prop; ALL persistent value state lives in the parent's settings-store.
 *
 * Field kinds handled:
 *   - select      — left/right arrows cycle options; wraps at ends
 *   - multiselect — list of checkboxes; space toggles focused option, enter
 *                   commits buffer via onChange(string[]) + onEditDone, esc
 *                   cancels. Options come pre-computed by the parent — each
 *                   may carry a `hint` (e.g. 'installed') that renders dimmed.
 *   - toggle      — enter flips boolean
 *   - text        — typed input; enter commits, esc cancels
 *   - number      — typed input; enter commits if in [min,max]; esc cancels
 *   - path        — same as text, with display-only ~/  for homedir prefix
 *   - readonly    — never focusable, never fires onChange
 *   - masked      — secret display (`****<last4>`); `r` replace / `x` remove;
 *                   edit mode buffer never round-trips through props (typed
 *                   value flows out via onChange on enter).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import os from 'node:os';
import { semantic } from '../theme/palette.js';
import { reducedMotion } from '../theme/motion-guard.js';
import type { FieldDef } from '../schema/types.js';

const SAVED_CHECK_TTL = 1500;

// Upper bound on how many masking asterisks we ever render for an in-progress
// secret. Pasting a long API key used to emit one asterisk per character
// (`'*'.repeat(buffer.length)`), which overflowed the field width and cascaded
// across the whole layout (#108). Beyond this many chars we switch to a compact
// `••••… (N chars)` summary so the rendered width stays bounded while the full
// value remains in the buffer untouched.
const MASKED_ECHO_MAX = 32;

/**
 * Bounded mask for the in-edit secret buffer. For short inputs we echo one
 * asterisk per char (familiar feedback). Once the buffer exceeds MASKED_ECHO_MAX
 * we cap the asterisk run and append a `(N chars)` counter, keeping the rendered
 * string a fixed, line-safe width regardless of how long the pasted secret is.
 * The plaintext never appears in the output.
 */
function maskedEcho(length: number): string {
  if (length <= MASKED_ECHO_MAX) return '*'.repeat(length);
  return `${'*'.repeat(MASKED_ECHO_MAX)}… (${length} chars)`;
}

export interface FieldRendererProps {
  field: FieldDef;
  value: unknown;
  current?: unknown;
  focused: boolean;
  editing: boolean;
  onChange: (next: unknown) => void;
  onEditStart: () => void;
  onEditDone: () => void;
  onEditCancel: () => void;
  /**
   * When non-null, the field shows a transient ✓ for SAVED_CHECK_TTL ms.
   * Parent sets this to Date.now() on each successful save; null clears it.
   * Ignored when reducedMotion() returns true.
   */
  savedAt?: number | null;
}

function displayPath(v: unknown): string {
  if (typeof v !== 'string' || v.length === 0) return '';
  const home = os.homedir();
  if (v === home) return '~';
  // Match either separator so Windows paths (C:\Users\x\...) display as ~/...
  // and always emit forward slashes in the rendered tail for consistent UX.
  if (v.startsWith(home + '/') || v.startsWith(home + '\\')) {
    return '~/' + v.slice(home.length + 1).replace(/\\/g, '/');
  }
  return v;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function maskedSummary(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  const tail = value.slice(-4);
  return `****${tail}`;
}

function renderValue(field: FieldDef, value: unknown): string {
  switch (field.kind) {
    case 'toggle':
      return value ? 'on' : 'off';
    case 'path':
      return displayPath(value);
    case 'number':
      return value === undefined || value === null ? '' : String(value);
    case 'select': {
      // Show the raw value (matches schema/env-var semantics) — labels live in
      // help text / options panel when editing.
      return value === undefined || value === null ? '' : String(value);
    }
    case 'masked':
      return maskedSummary(value);
    case 'readonly':
    case 'text':
    default:
      return value === undefined || value === null ? '' : String(value);
  }
}

export function FieldRenderer(props: FieldRendererProps): React.ReactElement {
  const {
    field,
    value,
    current,
    focused,
    editing,
    onChange,
    onEditStart,
    onEditDone,
    onEditCancel,
    savedAt = null,
  } = props;

  // Transient ✓ checkmark — visible for SAVED_CHECK_TTL ms after a successful save.
  const [showCheck, setShowCheck] = useState(false);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (savedAt === null || reducedMotion()) return;
    setShowCheck(true);
    if (checkTimerRef.current !== null) clearTimeout(checkTimerRef.current);
    checkTimerRef.current = setTimeout(() => {
      setShowCheck(false);
      checkTimerRef.current = null;
    }, SAVED_CHECK_TTL);
    return () => {
      if (checkTimerRef.current !== null) {
        clearTimeout(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, [savedAt]);

  // Ephemeral buffer used only for text/number/path/masked while editing.
  const [buffer, setBuffer] = useState<string>(() => {
    if (field.kind === 'path') return displayPath(value);
    // Masked never pre-fills the buffer — secrets are write-once from the user.
    if (field.kind === 'masked') return '';
    return value === undefined || value === null ? '' : String(value);
  });

  // Ephemeral multiselect state: a Set of selected option values being edited,
  // and the cursor index within the option list. Both reset on every edit-mode
  // entry from the persisted value[] / 0. Outside editing they are inert.
  const [multiBuffer, setMultiBuffer] = useState<Set<string>>(
    () => new Set(Array.isArray(value) ? (value as string[]) : []),
  );
  const [multiCursor, setMultiCursor] = useState<number>(0);

  // Reset buffer whenever we (re)enter editing or the underlying value changes
  // outside of editing.
  useEffect(() => {
    if (editing && (field.kind === 'text' || field.kind === 'number' || field.kind === 'path')) {
      if (field.kind === 'path') setBuffer(displayPath(value));
      else setBuffer(value === undefined || value === null ? '' : String(value));
    }
    // Masked entry starts with a clean buffer every time we enter edit mode —
    // the prior secret never leaks back into the typed display.
    if (editing && field.kind === 'masked') {
      setBuffer('');
    }
    // Multiselect: seed the buffer from the persisted array, cursor at 0.
    if (editing && field.kind === 'multiselect') {
      setMultiBuffer(new Set(Array.isArray(value) ? (value as string[]) : []));
      setMultiCursor(0);
    }
  }, [editing, field.kind, value]);

  const isPending =
    current !== undefined && !valuesEqual(value, current);

  useInput(
    (input, key) => {
      // readonly is inert.
      if (field.kind === 'readonly') return;

      // Non-focused fields ignore all input.
      if (!focused) return;

      // SELECT — left/right cycles; enter is a no-op.
      if (field.kind === 'select') {
        const opts = field.options ?? [];
        if (opts.length === 0) return;
        const idx = opts.findIndex((o) => o.value === value);
        const safeIdx = idx >= 0 ? idx : 0;
        if (key.rightArrow) {
          const next = opts[(safeIdx + 1) % opts.length];
          if (next && next.value !== value) {
            onChange(next.value);
          }
          return;
        }
        if (key.leftArrow) {
          const prev = opts[(safeIdx - 1 + opts.length) % opts.length];
          if (prev && prev.value !== value) {
            onChange(prev.value);
          }
          return;
        }
        return;
      }

      // TOGGLE — enter flips.
      if (field.kind === 'toggle') {
        if (key.return) {
          onChange(!value);
          onEditDone();
        }
        return;
      }

      // MULTISELECT — checkbox list. When idle, enter requests edit mode from
      // the parent (so outer ↑/↓ field-navigation still wins). When editing,
      // the field grabs ↑/↓ to walk options, space toggles the focused row,
      // enter commits the buffer as a string[] via onChange + onEditDone,
      // esc cancels without mutation.
      if (field.kind === 'multiselect') {
        const opts = field.options ?? [];
        if (!editing) {
          if (key.return) {
            onEditStart();
          }
          return;
        }
        if (opts.length === 0) {
          // Nothing to do — bounce out of edit mode rather than getting stuck.
          if (key.return || key.escape) onEditCancel();
          return;
        }
        if (key.escape) {
          onEditCancel();
          return;
        }
        if (key.return) {
          const next: string[] = opts.map((o) => o.value).filter((v) => multiBuffer.has(v));
          onChange(next);
          onEditDone();
          return;
        }
        if (key.upArrow) {
          setMultiCursor((c) => (c > 0 ? c - 1 : opts.length - 1));
          return;
        }
        if (key.downArrow) {
          setMultiCursor((c) => (c < opts.length - 1 ? c + 1 : 0));
          return;
        }
        if (input === ' ') {
          const cur = opts[multiCursor];
          if (!cur) return;
          setMultiBuffer((prev) => {
            const nextSet = new Set(prev);
            if (nextSet.has(cur.value)) nextSet.delete(cur.value);
            else nextSet.add(cur.value);
            return nextSet;
          });
          return;
        }
```

### Core Architecture Module: `src/cli/tui/hooks/useVerify.ts`
```
import { useState, useEffect } from 'react';
import type { WarmupReporter } from '../reporter.js';
import type { VerifyResult } from '../verify.js';

export interface VerifyItem {
  id: string;
  name: string;
  status: 'pending' | 'checking' | 'pass' | 'fail' | 'warn';
  detail: string;
  timeMs?: number;
}

const INITIAL_ITEMS: VerifyItem[] = [
  { id: 'searxng', name: 'Search engine', status: 'pending', detail: '' },
  { id: 'reranker', name: 'ML reranker', status: 'pending', detail: '' },
  { id: 'embeddings', name: 'Embeddings', status: 'pending', detail: '' },
];

function createVerifyReporter(
  setItems: React.Dispatch<React.SetStateAction<VerifyItem[]>>,
  starts: Map<string, number>,
): WarmupReporter {
  return {
    start(id: string, _label: string) {
      starts.set(id, Date.now());
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'checking' } : item,
        ),
      );
    },
    update() {},
    progress() {},
    success(id: string, detail?: string) {
      const elapsed = starts.has(id) ? Date.now() - starts.get(id)! : undefined;
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'pass', detail: detail ?? 'ok', timeMs: elapsed } : item,
        ),
      );
    },
    fail(id: string, error: string) {
      const elapsed = starts.has(id) ? Date.now() - starts.get(id)! : undefined;
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'fail', detail: error, timeMs: elapsed } : item,
        ),
      );
    },
    note() {},
    finish() {},
  };
}

export function useVerify(dataDir: string): {
  items: VerifyItem[];
  done: boolean;
  result: VerifyResult | null;
} {
  const [items, setItems] = useState<VerifyItem[]>(INITIAL_ITEMS);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const starts = new Map<string, number>();
    const reporter = createVerifyReporter(setItems, starts);

    async function run() {
      const { runVerify } = await import('../verify.js');
      const r = await runVerify(dataDir, reporter);
      if (!cancelled) {
        setResult(r);
        setDone(true);
      }
    }

    run().catch(() => {
      if (!cancelled) setDone(true);
    });

    return () => { cancelled = true; };
  }, [dataDir]);

  return { items, done, result };
}

```

### Core Architecture Module: `src/cli/tui/state/activity-store-instance.ts`
```
import { createActivityStore } from './activity-store.js';
import type { ActivityStore } from './activity-store.js';

export const activityStore: ActivityStore = createActivityStore();

```

### Core Architecture Module: `src/cli/tui/state/activity-store.ts`
```
type Listener = () => void;

export interface ActivityStore {
  begin(label: string): () => void;
  busy(): boolean;
  labels(): string[];
  subscribe(fn: Listener): () => void;
}

export function createActivityStore(): ActivityStore {
  const active = new Map<symbol, string>();
  const listeners = new Set<Listener>();
  const fire = () => listeners.forEach((l) => l());

  return {
    begin(label) {
      const key = Symbol(label);
      active.set(key, label);
      fire();
      return () => {
        if (active.delete(key)) fire();
      };
    },
    busy: () => active.size > 0,
    labels: () => Array.from(active.values()),
    subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
}

```

### Core Architecture Module: `src/cli/tui/state/agent-install-hints.ts`
```
/**
 * Live install-state hints for the agents multiselect.
 *
 * The agents category schema (`schema/agents.ts`) declares static options with
 * no per-agent install state. Detection lives at runtime in each
 * `AgentTarget.detect()`. This module bridges the two: given the set of agent
 * ids currently detected as installed, it decorates a multiselect field's
 * options with an `installed` hint so the row reflects reality.
 *
 * The decorator is pure and synchronous so it slots straight into
 * `CategoryScreen`'s `decorateField` seam; callers own the async detection and
 * feed the resulting id-set in, re-running detection (and bumping the screen's
 * `refreshSignal`) whenever install state may have changed — e.g. right after
 * an install completes (#105).
 */
import type { FieldDef } from '../schema/types.js';
import type { AgentTarget } from './agent-targets.js';

const INSTALLED_HINT = 'installed';

/** settingsPath of the agents multiselect — the only field we decorate. */
const AGENTS_FIELD_PATH = 'agents';

/**
 * Returns a `decorateField` callback that stamps an `installed` hint onto every
 * agents-multiselect option whose value is in `installedIds`. Non-agents fields
 * and non-multiselect fields pass through untouched.
 */
export function makeInstalledHintDecorator(
  installedIds: ReadonlySet<string>,
): (field: FieldDef) => FieldDef {
  return (field) => {
    if (field.settingsPath !== AGENTS_FIELD_PATH) return field;
    if (field.kind !== 'multiselect' || !field.options) return field;
    return {
      ...field,
      options: field.options.map((o) =>
        installedIds.has(o.value) ? { ...o, hint: INSTALLED_HINT } : o,
      ),
    };
  };
}

/**
 * Runs `detect()` across every agent target in parallel and returns the set of
 * ids currently reporting wigolo as installed. Detection failures are treated
 * as "not installed" so a single flaky probe never blanks the whole list.
 */
export async function detectInstalledAgentIds(
  agents: ReadonlyArray<AgentTarget>,
): Promise<Set<string>> {
  const results = await Promise.all(
    agents.map(async (a) => {
      try {
        return (await a.detect()) ? a.id : null;
      } catch {
        return null;
      }
    }),
  );
  return new Set(results.filter((id): id is AgentTarget['id'] => id !== null));
}

```

### Core Architecture Module: `src/cli/tui/state/agent-targets.ts`
```
/**
 * Registry of MCP agent targets the TUI propagates settings into.
 *
 * Each AgentTarget describes:
 *   - configPath: per-OS resolved JSON file the agent reads
 *   - serverPath: JSON path into that file pointing at the wigolo server entry
 *   - envPath:    JSON path within the server entry to the env block
 *   - detect():   is wigolo currently installed in this agent?
 *   - backupDir(): where propagation.ts writes pre-write backups
 *
 * Paths are aligned with the SP7 agent handlers in src/cli/agents/ so the
 * TUI mutates the same files the install flow created. Mismatching either
 * side would leave stale env blocks behind.
 */

import { readFile as nodeReadFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { vscodeUserDir } from '../../agents/vscode.js';

export type AgentId = 'claude-code' | 'vscode' | 'zed' | 'windsurf' | 'cursor';

export interface AgentTarget {
  id: AgentId;
  label: string;
  /** Absolute path to the agent's MCP/settings JSON file. */
  configPath: string;
  /** JSON path to the wigolo server entry, e.g. ['mcpServers', 'wigolo']. */
  serverPath: ReadonlyArray<string>;
  /** JSON path inside the server entry to its env block, e.g. ['mcpServers','wigolo','env']. */
  envPath: ReadonlyArray<string>;
  /** True when wigolo is currently registered in this agent's config. */
  detect(): Promise<boolean>;
  /** Directory the propagation pipeline writes per-agent backups into. */
  backupDir(): string;
}

export interface DefaultAgentTargetsOpts {
  /** Wigolo data dir (e.g. ~/.wigolo). Backups land at `<dataDir>/backups/`. */
  dataDir: string;
  /** Override for tests; defaults to os.homedir(). */
  home?: string;
  /** Override for tests; defaults to process.platform. */
  platform?: NodeJS.Platform;
  /** Override for tests; defaults to process.env. */
  env?: NodeJS.ProcessEnv;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * Returns true if the JSON file at `configPath` contains a value at the
 * specified `serverPath`. Returns false on parse errors or missing files.
 *
 * Fully async — uses fs.promises.readFile and treats ENOENT as a miss. The
 * 5-agent fan-out runs through Promise.all, so the per-agent probe must not
 * block the event loop.
 */
async function detectAtPath(configPath: string, serverPath: ReadonlyArray<string>): Promise<boolean> {
  let raw: string;
  try {
    raw = await nodeReadFile(configPath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EACCES') return false;
    return false;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  let cur: unknown = parsed;
  for (const key of serverPath) {
    if (!isObject(cur)) return false;
    cur = cur[key];
    if (cur === undefined) return false;
  }
  return cur !== undefined && cur !== null;
}

function resolveVscodeMcpPath(home: string, plat: NodeJS.Platform, env: NodeJS.ProcessEnv): string {
  const override = env.WIGOLO_VSCODE_MCP_PATH;
  if (override) return override;
  void plat; // platform branch reserved for future Code/User layout
  return join(vscodeUserDir(home), 'mcp.json');
}

export function defaultAgentTargets(opts: DefaultAgentTargetsOpts): AgentTarget[] {
  const home = opts.home ?? homedir();
  const plat: NodeJS.Platform = opts.platform ?? platform();
  const env = opts.env ?? process.env;
  const backupDir = join(opts.dataDir, 'backups');

  const claudeCodePath = join(home, '.claude.json');
  const claudeCodeServer: ReadonlyArray<string> = ['mcpServers', 'wigolo'];

  const vscodePath = resolveVscodeMcpPath(home, plat, env);
  const vscodeServer: ReadonlyArray<string> = ['servers', 'wigolo'];

  const zedPath = join(home, '.config', 'zed', 'settings.json');
  const zedServer: ReadonlyArray<string> = ['context_servers', 'wigolo'];

  const windsurfPath = join(home, '.codeium', 'windsurf', 'mcp_config.json');
  const windsurfServer: ReadonlyArray<string> = ['mcpServers', 'wigolo'];

  const cursorPath = join(home, '.cursor', 'mcp.json');
  const cursorServer: ReadonlyArray<string> = ['mcpServers', 'wigolo'];

  return [
    {
      id: 'claude-code',
      label: 'Claude Code',
      configPath: claudeCodePath,
      serverPath: claudeCodeServer,
      envPath: [...claudeCodeServer, 'env'],
      detect: () => detectAtPath(claudeCodePath, claudeCodeServer),
      backupDir: () => backupDir,
    },
    {
      id: 'vscode',
      label: 'VS Code (Copilot)',
      configPath: vscodePath,
      serverPath: vscodeServer,
      envPath: [...vscodeServer, 'env'],
      detect: () => detectAtPath(vscodePath, vscodeServer),
      backupDir: () => backupDir,
    },
    {
      id: 'zed',
      label: 'Zed',
      configPath: zedPath,
      serverPath: zedServer,
      envPath: [...zedServer, 'env'],
      detect: () => detectAtPath(zedPath, zedServer),
      backupDir: () => backupDir,
    },
    {
      id: 'windsurf',
      label: 'Windsurf',
      configPath: windsurfPath,
      serverPath: windsurfServer,
      envPath: [...windsurfServer, 'env'],
      detect: () => detectAtPath(windsurfPath, windsurfServer),
      backupDir: () => backupDir,
    },
    {
      id: 'cursor',
      label: 'Cursor',
      configPath: cursorPath,
      serverPath: cursorServer,
      envPath: [...cursorServer, 'env'],
      detect: () => detectAtPath(cursorPath, cursorServer),
      backupDir: () => backupDir,
    },
  ];
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #195** (2026-07-19): **Security and quality isn't working**
  *Symptoms*: Quick heads-up: the **Report a vulnerability** link under **Security → Advisories** (`…/security/advisories/new`) returns a 404, which means **Private Vulnerability Reporting isn't enabled** on this repo. As-is, there's no private channel for someone to responsibly disclose a security issue if one turns up.  Easy fix if you'd like to accept private reports: **Settings → Code security and analysis → Private vulnerability reporting → Enable.**  Nothing to report right now — just flagging the broken link so the channel's ready if anything ever comes up. Cheers!
  **Post-Mortem & Fix Analysis**:
  > Thanks @spartan8806 for pointing it out. I have enabled the Security and Quality option. Feel free to close the issue if you think this has been resolved. Cheers!

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

### Incident Patch 1: `c2b14fa3` (2026-09-27)
**Commit Message**: fix(site): accurate privacy wording and sturdier logo scripts

The comparison tables said query data never leaves the machine, but
wigolo's searches go to the search engines it queries; the row now
says where queries go, with no vendor in between. The analytics
disclosure describes Umami as anonymous, cookieless session counting,
and the tag no longer records URL query strings.

fetch-logos records a failed download and moves on instead of
aborting the run, and mine reports a final non-OK GitHub response with
its status instead of a TypeError.

**File**: `SPONSORS.md` (modified, +4/-4)
```diff
@@ -113,10 +113,10 @@ What is measured:
   pageviews, and Google Search Console impressions for the site's pages. README
   impressions can't be counted accurately, because GitHub proxies and caches
   images; repo views are the stand-in, and they're described as exactly that.
-- **What is never collected** — no cookies, no local storage, no personal
-  data, and nothing that identifies an individual visitor. The site uses
-  cookieless analytics (Umami) and honours Do Not Track. The wigolo tool itself
-  sends nothing to the site; this covers the website only.
+- **What is collected** — anonymous page views and events, grouped into
+  sessions without cookies or local storage, with URL query strings left out.
+  The site uses Umami and honours Do Not Track. The wigolo tool itself sends
+  nothing to the site; this covers the website only.
 
 The implementation is in [`site/src/lib/sponsors.ts`](site/src/lib/sponsors.ts),
 [`site/src/lib/analytics.ts`](site/src/lib/analytics.ts) and the interstitial in
```

**File**: `site/scripts/logo-wall/fetch-logos.mjs` (modified, +7/-1)
```diff
@@ -92,7 +92,13 @@ for (const c of companies) {
       problems.push(`${c.name}: unknown logo source "${c.logo.source}"`);
       continue;
     }
-    const res = await fetch(url, { redirect: "follow" });
+    let res;
+    try {
+      res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
+    } catch (e) {
+      problems.push(`${c.name}: ${url} → ${e.message}`);
+      continue;
+    }
     const type = res.headers.get("content-type") ?? "";
     if (!res.ok || !type.startsWith("image/")) {
       problems.push(`${c.name}: ${url} → ${res.status} ${type}`);
```

**File**: `site/scripts/logo-wall/mine.mjs` (modified, +1/-0)
```diff
@@ -42,6 +42,7 @@ async function gql(query, variables, attempt = 1) {
     await new Promise((r) => setTimeout(r, 2000 * attempt));
     return gql(query, variables, attempt + 1);
   }
+  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${await res.text()}`);
   const body = await res.json();
   if (body.errors?.length) {
     if (attempt < 5) {
```

**File**: `site/src/app/go/[slug]/SponsorCard.tsx` (modified, +2/-2)
```diff
@@ -26,8 +26,8 @@ export default function SponsorCard({
         </a>
         <p className={styles.note}>
           You&rsquo;re being forwarded from a wigolo sponsor link. We count
-          clicks on these links to measure how much reach a placement gets — no
-          cookies, nothing stored about you.
+          clicks on these links to measure how much reach a placement gets, with
+          anonymous, cookieless analytics.
         </p>
       </div>
     </main>
```

**File**: `site/src/app/sponsors/page.tsx` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ export default async function SponsorsPage() {
               with the placement it came from, then forwards with a <code>utm_content</code>{" "}
               tag — so
               clicks from the README, the docs and releases show up separately in your analytics and in
-              ours. The site&apos;s analytics are cookieless and store nothing about individual visitors.
+              ours. The site&apos;s analytics are anonymous and cookieless.
               Figures are shared on request.
             </p>
           </section>
```

**File**: `site/src/components/Analytics.tsx` (modified, +1/-0)
```diff
@@ -35,6 +35,7 @@ export default function Analytics() {
       data-website-id={UMAMI_ID}
       data-domains={UMAMI_DOMAINS}
       data-do-not-track="true"
+      data-exclude-search="true"
       strategy="afterInteractive"
     />
   );
```

**File**: `site/src/content/alternatives.ts` (modified, +4/-4)
```diff
@@ -45,9 +45,9 @@ const sharedRows = (them: Record<string, string> = {}): Row[] =>
     { label: "Account / API key", wigolo: "None", them: "Required" },
     { label: "Cost per query", wigolo: "$0, unlimited", them: "Metered (see pricing below)" },
     {
-      label: "Query data leaves your machine",
-      wigolo: "No — only the requests to the pages themselves",
-      them: "Yes, to the vendor",
+      label: "Where your queries go",
+      wigolo: "Straight to the search engines it queries and the pages it fetches — no vendor in between, no account attached",
+      them: "To the vendor, tied to your account",
     },
     {
       label: "Persistent local memory",
@@ -99,7 +99,7 @@ export const ALTERNATIVES: readonly Alternative[] = [
         "Where it runs": "Their cloud, or self-hosted with Docker Compose",
         "Account / API key": "Required for the hosted API",
         "Cost per query": "Metered on the hosted API (see pricing below)",
-        "Query data leaves your machine": "Yes on the hosted API, to the vendor",
+        "Where your queries go": "To the vendor on the hosted API, tied to your account",
       }),
       {
         label: "Pricing",
```

---

### Incident Patch 2: `9e4f608b` (2026-09-23)
**Commit Message**: feat(site): rebuild /docs on Fumadocs with examples and search

The repo's docs/ and examples/ READMEs stay the single source: a
prebuild step copies them into the docs collection with frontmatter,
sidebar order from the index tables, and links rewritten so doc-to-doc
stays on the site and everything else goes to GitHub. The build fails
when a page and its index table disagree.

Every existing /docs/<page>/ URL is unchanged. Examples get their own
section, search runs from a static index, and llms.txt/llms-full.txt
are generated from the same pages. The docs UI's CSS loads only under
/docs; the global reset moved into a cascade layer so it no longer
overrides it, with the homepage layout verified unchanged.

**File**: `site/.gitignore` (modified, +4/-0)
```diff
@@ -40,3 +40,7 @@ yarn-error.log*
 *.tsbuildinfo
 next-env.d.ts
 /.logo-wall/
+
+# generated docs content (scripts/sync-content.mjs)
+/content/
+/.source/
```

**File**: `site/README.md` (modified, +6/-0)
```diff
@@ -32,3 +32,9 @@ npm run logos:check    # verify every entry has a logo (CI runs this before buil
 Each entry: `tier` 1 (top row, scrolls left) or 2 (bottom row, scrolls right); `evidence` is `verified` when GitHub attests the link (public org membership, org-owned fork, or a profile email on the company domain) and `self-reported` when it rests on the free-text company field alone; `display` is `icon+name`, `wordmark` (the logo already spells the name) or `name` (text only); `logo.source` is `simple-icons` (inline SVG, preferred), `github-avatar`, `favicon`, `file` (drop a PNG at `.logo-wall/raw-logos/<slug>.png`) or `none`. Rasters are converted to monochrome silhouettes so every logo takes the same treatment. `npm run logos:mine -- --offline` re-ranks the cached pull without calling the API.
 
 Dependencies it adds: `simple-icons` (CC0 brand SVGs, build-time only), `svg-path-bbox` (crops wordmarks to their glyph), and dev-only `pngjs` (raster normalisation) and `vitest` (`npm test`).
+
+## Docs
+
+`/docs` renders the repo's own `docs/*.md` and `examples/*/README.md` — edit those, not anything under `site/`. `scripts/sync-content.mjs` runs before `dev`/`build`: it copies them into the gitignored `content/docs/`, adds frontmatter (title from the page's `# ` heading, description from the index table), orders the sidebar from the `docs/README.md` and `examples/README.md` tables, and rewrites links (doc-to-doc stays on the site, anything else goes to GitHub). The build fails if a page exists without a table row, or the reverse.
+
+Built with Fumadocs (`fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx`) and Tailwind v4 (`tailwindcss`, `@tailwindcss/postcss`), both loaded only on `/docs`. Search is a static index (`/search.json`, fetched on first search). `/llms.txt` and `/llms-full.txt` are generated from the same pages, led by `src/content/llms-preamble.md`.
```

**File**: `site/next.config.mjs` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+import path from "node:path";
+import { fileURLToPath } from "node:url";
+import { createMDX } from "fumadocs-mdx/next";
+
+const __dirname = path.dirname(fileURLToPath(import.meta.url));
+
+// Static export for GitHub Pages (custom domain wigolo.app, served from the
+// root). NEXT_PUBLIC_BASE_PATH stays supported for sub-path hosting; unset in
+// production. `.mjs` because fumadocs-mdx is ESM-only.
+const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
+
+/** @type {import("next").NextConfig} */
+const nextConfig = {
+  output: "export",
+  basePath: basePath || undefined,
+  images: { unoptimized: true },
+  trailingSlash: true,
+  turbopack: {
+    root: __dirname,
+  },
+};
+
+export default createMDX()(nextConfig);
```

**File**: `site/next.config.ts` (removed, +0/-18)
```diff
@@ -1,18 +0,0 @@
-import type { NextConfig } from "next";
-
-// Static export for GitHub Pages. NEXT_PUBLIC_BASE_PATH is set to "/wigolo"
-// by the Pages workflow (project pages live under the repo path); local dev
-// leaves it unset and everything serves from /.
-const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
-
-const nextConfig: NextConfig = {
-  output: "export",
-  basePath: basePath || undefined,
-  images: { unoptimized: true },
-  trailingSlash: true,
-  turbopack: {
-    root: __dirname,
-  },
-};
-
-export default nextConfig;
```

**File**: `site/package.json` (modified, +9/-6)
```diff
@@ -10,28 +10,31 @@
     "logos:mine": "node scripts/logo-wall/mine.mjs",
     "logos:fetch": "node scripts/logo-wall/fetch-logos.mjs",
     "logos:check": "node scripts/logo-wall/fetch-logos.mjs --check",
-    "test": "vitest run && node --test scripts/logo-wall/*.test.mjs"
+    "test": "vitest run && node --test scripts/logo-wall/*.test.mjs scripts/sync-content.test.mjs",
+    "predev": "node scripts/sync-content.mjs",
+    "prebuild": "node scripts/sync-content.mjs"
   },
   "dependencies": {
-    "highlight.js": "^11.11.1",
+    "fumadocs-core": "16.15.13",
+    "fumadocs-mdx": "15.4.3",
+    "fumadocs-ui": "16.15.13",
     "motion": "^12.42.2",
     "next": "16.2.10",
     "react": "19.2.4",
     "react-dom": "19.2.4",
-    "react-markdown": "^10.1.0",
-    "rehype-highlight": "^7.0.2",
-    "rehype-slug": "^6.0.0",
-    "remark-gfm": "^4.0.1",
     "simple-icons": "^16.32.0",
     "svg-path-bbox": "^2.1.0"
   },
   "devDependencies": {
+    "@tailwindcss/postcss": "4.3.3",
+    "@types/mdx": "2.0.14",
     "@types/node": "^20",
     "@types/react": "^19",
     "@types/react-dom": "^19",
     "eslint": "^9",
     "eslint-config-next": "16.2.10",
     "pngjs": "^7.0.0",
+    "tailwindcss": "4.3.3",
     "typescript": "^5",
     "vitest": "^4.1.6"
   }
```

**File**: `site/postcss.config.mjs` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+// Tailwind only exists for the docs UI; its stylesheet is imported by the
+// docs layout alone, so marketing pages never load it. transformAssetUrls is
+// off because its url() rewriting corrupts next/font's generated font CSS
+// ("next/font/google queries have exactly one entry" under Turbopack).
+const config = { plugins: { "@tailwindcss/postcss": { transformAssetUrls: false } } };
+
+export default config;
```

**File**: `site/scripts/sync-content.mjs` (added, +229/-0)
```diff
@@ -0,0 +1,229 @@
+#!/usr/bin/env node
+// Copy the repo's public docs/ and examples/ READMEs into site/content/docs/
+// (gitignored) as the docs site's content source. The repo files stay plain
+// GitHub markdown; this step adds frontmatter, sidebar order and link
+// rewriting so the same text works in both places.
+//
+// Fails the build when docs/ and the docs/README.md "Pages" table disagree,
+// or when examples/ and the examples/README.md table disagree — a page is
+// never silently dropped from (or dangling in) the sidebar.
+
+import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
+import { dirname, join, posix } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const GH = "https://github.com/KnockOutEZ/wigolo";
+
+/** Walk markdown lines, calling `fn` only on text outside fenced code blocks. */
+export function mapOutsideFences(markdown, fn) {
+  let fence = null;
+  return markdown
+    .split("\n")
+    .map((line) => {
+      const m = line.match(/^\s*(```+|~~~+)/);
+      if (m) {
+        if (!fence) fence = m[1][0];
+        else if (m[1][0] === fence) fence = null;
+        return line;
+      }
+      return fence ? line : fn(line);
+    })
+    .join("\n");
+}
+
+/** First `# ` heading outside code, and the markdown with it removed. */
+export function takeTitle(markdown) {
+  let title = null;
+  let fence = false;
+  const lines = markdown.split("\n");
+  for (let i = 0; i < lines.length; i++) {
+    if (/^\s*(```|~~~)/.test(lines[i])) fence = !fence;
+    if (!fence && /^# \S/.test(lines[i])) {
+      title = lines[i].slice(2).trim();
+      lines.splice(i, 1);
+      break;
+    }
+  }
+  return { title, body: lines.join("\n").replace(/^\s*\n/, "") };
+}
+
+/** First prose paragraph, flattened to plain text, capped for meta descriptions. */
+export function firstParagraph(markdown, max = 160) {
+  const para = markdown
+    .split(/\n\s*\n/)
+    .map((p) => p.trim())
+    .find((p) => p && !/^(#|\||```|!\[|>|-|\*|<)/.test(p));
+  if (!para) return "";
+  const text = para
+    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
+    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
+    .replace(/[`*_]/g, "")
+    .replace(/\s+/g, " ")
+    .trim();
+  if (text.length <= max) return text;
+  const cut = text.slice(0, max - 1);
+  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
+}
+
+/** Rows of a `| [Label](./target) | description |` index table. */
+export function parseIndexTable(markdown) {
+  const rows = [];
+  for (const line of markdown.split("\n")) {
+    const m = line.match(/^\|\s*\[([^\]]+)\]\(\.\/([^)]+)\)\s*\|\s*(.+?)\s*\|\s*$/);
+    if (m) rows.push({ label: m[1], target: m[2], description: m[3] });
+  }
+  return rows;
+}
+
+// Table cells escape pipes as `\|`; a description is plain text, so unescape.
+export const flatten = (s) =>
+  s
+    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
+    .replace(/\\\|/g, "|")
+    .replace(/[`*_]/g, "")
+    .trim();
+
+/**
+ * Map a repo path to where it lives in the content tree, or null when the
+ * docs site has no page (or copied asset) for it.
+ *   docs/README.md                 → index.md
+ *   docs/<page>.md                 → <page>.md
+ *   examples/ | examples/README.md → examples/index.md
+ *   examples/<x>/ | …/README.md    → examples/<x>/index.md
+ *   examples/<x>/<image>           → examples/<x>/<image>   (copied assets)
+ */
+export function contentPathFor(repoPath, known) {
+  const p = repoPath.replace(/\/$/, "");
+  if (p === "docs/README.md" || p === "docs") return "index.md";
+  let m = p.match(/^docs\/([\w-]+\.md)$/);
+  if (m) return known.docs.has(m[1]) ? m[1] : null;
+  if (p === "examples" || p === "examples/README.md") return "examples/index.md";
+  m = p.match(/^examples\/([\w-]+)(?:\/README\.md)?$/);
+  if (m) return known.examples.has(m[1]) ? `examples/${m[1]}/index.md` : null;
+  m = p.match(/^examples\/([\w-]+)\/([\w.-]+\.(?:gif|png|jpe?g|svg|webp))$/i);
+  if (m && known.examples.has(m[1])) return `examples/${m[1]}/${m[2]}`;
+  return null;
+}
+
+/**
+ * Rewrite relative links/images in one file. `from` is the file's repo path
+ * (docs/tools.md), `to` its content path (tools.md). Links that land on a
+ * docs-site page become content-relative (Fumadocs turns them into routes);
+ * everything else points at GitHub, so no link is ever broken on the site.
+ */
+export function rewriteLinks(markdown, from, to, known, isDir = () => false) {
+  const fromDir = posix.dirname(from);
+  const toDir = posix.dirname(to);
+  return mapOutsideFences(markdown, (line) =>
+    line.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (all, bang, text, target, title) => {
+      if (/^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(target)) return all;
+      const hashAt = target.search(/[#?]/);
+      const path = hashAt === -1 ? target : target.slice(0, hashAt);
+      const suffix = hashAt === -1 ? "" : target.slice(hashAt);
+      if (!path) return all;
+     
```

**File**: `site/scripts/sync-content.test.mjs` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import {
+  rewriteLinks,
+  contentPathFor,
+  takeTitle,
+  parseIndexTable,
+  firstParagraph,
+  mapOutsideFences,
+  flatten,
+} from "./sync-content.mjs";
+
+const known = {
+  docs: new Set(["tools.md", "rest-api.md", "plugins.md"]),
+  examples: new Set(["rest-curl", "one-shot-cli", "plugin-search-engine"]),
+};
+const GH = "https://github.com/KnockOutEZ/wigolo";
+
+test("doc-to-doc links stay relative so the docs site turns them into routes", () => {
+  const out = rewriteLinks("See [REST](./rest-api.md#auth).", "docs/tools.md", "tools.md", known);
+  assert.equal(out, "See [REST](./rest-api.md#auth).");
+});
+
+test("the docs index is README.md on GitHub but index.md on the site", () => {
+  const out = rewriteLinks("[Back](./README.md)", "docs/tools.md", "tools.md", known);
+  assert.equal(out, "[Back](./index.md)");
+});
+
+test("a doc linking into examples/ reaches the example's page, not GitHub", () => {
+  const out = rewriteLinks("[plugin](../examples/plugin-search-engine/)", "docs/plugins.md", "plugins.md", known);
+  assert.equal(out, "[plugin](./examples/plugin-search-engine/index.md)");
+});
+
+test("examples link to each other through their index pages", () => {
+  const out = rewriteLinks("[curl](../rest-curl/)", "examples/one-shot-cli/README.md", "examples/one-shot-cli/index.md", known);
+  assert.equal(out, "[curl](../rest-curl/index.md)");
+});
+
+test("files outside the docs set go to GitHub instead of a dead site URL", () => {
+  assert.equal(
+    rewriteLinks("[sec](../SECURITY.md)", "docs/privacy-security.md", "privacy-security.md", known),
+    `[sec](${GH}/blob/main/SECURITY.md)`,
+  );
+  assert.equal(
+    rewriteLinks("[pkg](../packaging/)", "docs/installation.md", "installation.md", known),
+    `[pkg](${GH}/tree/main/packaging)`,
+  );
+  assert.equal(
+    rewriteLinks("[wf](./workflow.json)", "examples/n8n-remote-mcp/README.md", "examples/n8n-remote-mcp/index.md", known),
+    `[wf](${GH}/blob/main/examples/n8n-remote-mcp/workflow.json)`,
+  );
+});
+
+test("a directory link without a trailing slash is still a tree URL", () => {
+  const out = rewriteLinks("[mcpb](../mcpb)", "docs/installation.md", "installation.md", known, (p) => p === "mcpb");
+  assert.equal(out, `[mcpb](${GH}/tree/main/mcpb)`);
+});
+
+test("example demo gifs stay local, since they are copied next to the page", () => {
+  const out = rewriteLinks("![demo](demo.gif)", "examples/one-shot-cli/README.md", "examples/one-shot-cli/index.md", known);
+  assert.equal(out, "![demo](./demo.gif)");
+});
+
+test("absolute URLs, anchors and code blocks are left alone", () => {
+  const md = "[x](https://a.b) [y](#h)\n```\n[z](./rest-api.md)\n```";
+  assert.equal(rewriteLinks(md, "docs/tools.md", "tools.md", known), md);
+});
+
+test("an unknown doc is not linked as a site page", () => {
+  assert.equal(contentPathFor("docs/nope.md", known), null);
+});
+
+test("the title comes from the first h1 outside code and is removed from the body", () => {
+  const { title, body } = takeTitle("```\n# not me\n```\n# Tools\n\nBody");
+  assert.equal(title, "Tools");
+  assert.ok(!body.includes("# Tools"));
+  assert.ok(body.includes("# not me"));
+});
+
+test("the index table yields order and descriptions", () => {
+  const rows = parseIndexTable("| Page | x |\n| --- | --- |\n| [Tools](./tools.md) | The 10 tools. |\n| [L](../LICENSING.md) | no |");
+  assert.deepEqual(rows, [{ label: "Tools", target: "tools.md", description: "The 10 tools." }]);
+});
+
+test("meta descriptions are plain text and bounded", () => {
+  const d = firstParagraph("wigolo is a **local-first** [server](./x.md) " + "word ".repeat(60), 80);
+  assert.ok(d.length <= 80);
+  assert.ok(!d.includes("*") && !d.includes("]("));
+});
+
+test("fence tracking ignores a different fence char inside a block", () => {
+  const seen = [];
+  mapOutsideFences("a\n```\n~~~\nb\n```\nc", (l) => (seen.push(l), l));
+  assert.deepEqual(seen, ["a", "c"]);
+});
+
+test("a table-cell description loses its markdown and pipe escapes", () => {
+  // Otherwise the page subtitle and meta description read "--json \\| jq".
+  assert.equal(flatten("the `--json \\| jq` [contract](./x.md)"), "the --json | jq contract");
+});
```

---

### Incident Patch 3: `60aaeccb` (2026-08-01)
**Commit Message**: fix(fetch): bound the reddit OAuth requests

Neither the token mint nor the data request passed a signal, and the default
fetch has no request timeout. A stalled call held the router's fetch path open
indefinitely rather than falling through to the normal ladder.

Both now carry a 15s ceiling, and the data request combines it with the
caller's signal so cancellation still wins. anySignal's cleanup runs in a
finally — it attaches a listener to the caller's long-lived shared signal, and
skipping it would accumulate one listener per fetch.

Found by CodeRabbit.

**File**: `src/fetch/reddit-api.ts` (modified, +37/-13)
```diff
@@ -26,6 +26,15 @@ import type { RawFetchResult } from '../types.js';
 import type { RedditThread, RedditComment } from '../extraction/site-extractors/reddit.js';
 import { guardFetchUrl } from '../watch/ssrf.js';
 import { createLogger } from '../logger.js';
+import { anySignal } from '../util/abort.js';
+
+/**
+ * Hard ceiling on each Reddit HTTP call. The default `fetch` has no request
+ * timeout, so a stalled token mint or data request would hold the router's
+ * fetch path open until the process exits instead of falling through to the
+ * normal ladder. Combined with any caller signal, so cancellation still wins.
+ */
+const REDDIT_REQUEST_TIMEOUT_MS = 15_000;
 
 /** Fixed OAuth token endpoint — app-only (client-credentials) grant. */
 const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
@@ -198,6 +207,7 @@ export class RedditTokenManager {
         'User-Agent': this.creds.userAgent,
       },
       body: 'grant_type=client_credentials',
+      signal: AbortSignal.timeout(REDDIT_REQUEST_TIMEOUT_MS),
       // The token endpoint is a fixed host and must never legitimately
       // redirect. `redirect: 'manual'` disables the auto-follower so a hostile
       // 3xx (e.g. to an internal address) is never followed with the Basic
@@ -430,6 +440,7 @@ export async function fetchViaRedditApi(
   tokenManager: RedditTokenManager,
   creds: RedditCredentials,
   fetchFn: FetchFn = fetch,
+  signal?: AbortSignal,
 ): Promise<RawFetchResult | null> {
   const endpointPath = mapRedditUrlToEndpoint(url);
   if (endpointPath === null) return null;
@@ -443,19 +454,32 @@ export async function fetchViaRedditApi(
   }
 
   const token = await tokenManager.getToken();
-  const res = await fetchFn(endpointUrl, {
-    method: 'GET',
-    headers: {
-      Authorization: `Bearer ${token}`,
-      'User-Agent': creds.userAgent,
-    },
-    // The OAuth data host is fixed and must never legitimately redirect.
-    // `redirect: 'manual'` disables the auto-follower (default: follow, up to
-    // 20 hops) so a hostile 3xx to an internal address is never followed with
-    // the bearer token attached. Any 3xx is rejected below, which makes the
-    // router fall through to the normal fetch ladder.
-    redirect: 'manual',
-  });
+  // Bounded, and still cancellable by the caller — whichever fires first. The
+  // combiner attaches a listener to the caller's (long-lived, shared) signal,
+  // so its cleanup runs as soon as this request settles; skipping it would
+  // accumulate one listener per fetch on that signal.
+  const combined = signal
+    ? anySignal([signal, AbortSignal.timeout(REDDIT_REQUEST_TIMEOUT_MS)])
+    : null;
+  let res: Response;
+  try {
+    res = await fetchFn(endpointUrl, {
+      method: 'GET',
+      headers: {
+        Authorization: `Bearer ${token}`,
+        'User-Agent': creds.userAgent,
+      },
+      signal: combined ? combined.signal : AbortSignal.timeout(REDDIT_REQUEST_TIMEOUT_MS),
+      // The OAuth data host is fixed and must never legitimately redirect.
+      // `redirect: 'manual'` disables the auto-follower (default: follow, up to
+      // 20 hops) so a hostile 3xx to an internal address is never followed with
+      // the bearer token attached. Any 3xx is rejected below, which makes the
+      // router fall through to the normal fetch ladder.
+      redirect: 'manual',
+    });
+  } finally {
+    combined?.cleanup();
+  }
 
   if (res.status >= 300 && res.status < 400) {
     throw new Error(`reddit oauth endpoint returned an unexpected redirect (HTTP ${res.status})`);
```

**File**: `src/fetch/router.ts` (modified, +3/-3)
```diff
@@ -907,7 +907,7 @@ export class SmartRouter {
    * returns null so the caller degrades gracefully to the honest normal ladder
    * rather than hard-failing the whole fetch.
    */
-  private async tryRedditApi(url: string, config: Config): Promise<RawFetchResult | null> {
+  private async tryRedditApi(url: string, config: Config, signal?: AbortSignal): Promise<RawFetchResult | null> {
     const logger = createLogger('fetch');
     const creds: RedditCredentials = {
       // redditApiConfigured() guaranteed both are non-null before this call.
@@ -921,7 +921,7 @@ export class SmartRouter {
       this.redditTokenManager = { key: creds.clientId, mgr: new RedditTokenManager(creds) };
     }
     try {
-      return await fetchViaRedditApi(url, this.redditTokenManager.mgr, creds);
+      return await fetchViaRedditApi(url, this.redditTokenManager.mgr, creds, undefined, signal);
     } catch (err) {
       if (err instanceof RedditRateLimitError) {
         logger.info('reddit-api rate limited — falling through to normal ladder', {
@@ -964,7 +964,7 @@ export class SmartRouter {
       !screenshot &&
       !(actions && actions.length > 0)
     ) {
-      const redditResult = await this.tryRedditApi(url, config);
+      const redditResult = await this.tryRedditApi(url, config, options.signal);
       if (redditResult !== null) return redditResult;
       logger.debug('reddit-api path did not apply — falling through to normal ladder', { url });
     }
```

**File**: `tests/unit/fetch/reddit-api.test.ts` (modified, +43/-0)
```diff
@@ -401,3 +401,46 @@ describe('fetchViaRedditApi', () => {
     expect(calledUrl.hostname).toBe('oauth.reddit.com');
   });
 });
+
+describe('reddit fetches are bounded', () => {
+  // Neither call passed a signal, and the default fetch has no request timeout.
+  // A stalled token mint or data request therefore held the router's fetch path
+  // open indefinitely instead of falling through to the normal ladder.
+  it('passes an abort signal to the token request', async () => {
+    const fetchFn = vi.fn(async (_u: string, init?: RequestInit) => {
+      expect(init?.signal).toBeInstanceOf(AbortSignal);
+      return jsonResponse({ access_token: 't', expires_in: 3600 });
+    }) as unknown as FetchFn;
+    const mgr = new RedditTokenManager(CREDS, fetchFn, () => 0);
+    await mgr.getToken();
+    expect(fetchFn).toHaveBeenCalled();
+  });
+
+  it('passes an abort signal to the data request', async () => {
+    const calls: Array<RequestInit | undefined> = [];
+    const fetchFn = vi.fn(async (u: string, init?: RequestInit) => {
+      calls.push(init);
+      return u.includes('access_token')
+        ? jsonResponse({ access_token: 't', expires_in: 3600 })
+        : jsonResponse({ kind: 'Listing', data: { children: [] } });
+    }) as unknown as FetchFn;
+    const mgr = new RedditTokenManager(CREDS, fetchFn, () => 0);
+    await fetchViaRedditApi('https://www.reddit.com/r/rust/hot', mgr, CREDS, fetchFn);
+    expect(calls.length).toBe(2);
+    for (const c of calls) expect(c?.signal).toBeInstanceOf(AbortSignal);
+  });
+
+  it('aborts the data request when the caller cancels', async () => {
+    const ac = new AbortController();
+    const fetchFn = vi.fn(async (u: string, init?: RequestInit) => {
+      if (u.includes('access_token')) return jsonResponse({ access_token: 't', expires_in: 3600 });
+      ac.abort();
+      expect(init?.signal?.aborted).toBe(true);
+      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
+    }) as unknown as FetchFn;
+    const mgr = new RedditTokenManager(CREDS, fetchFn, () => 0);
+    await expect(
+      fetchViaRedditApi('https://www.reddit.com/r/rust/hot', mgr, CREDS, fetchFn, ac.signal),
+    ).rejects.toThrow();
+  });
+});
```

---

### Incident Patch 4: `daf256ae` (2026-08-01)
**Commit Message**: fix: forward the whole failure-metadata contract from both adapters

The REPL adapter forwarded challenge_class + solve_method but dropped
http_status; the crawl adapter forwarded http_status but dropped the other
two. Each surface exposed a different subset of the same failure, and a
per-adapter subset is exactly how they drift apart.

Without http_status a caller cannot tell an anti-bot 403 from a challenge
served at 200. Both now forward all three.

Found by CodeRabbit.

**File**: `src/repl/commands/fetch.ts` (modified, +3/-0)
```diff
@@ -84,6 +84,9 @@ export async function executeFetch(args: ParsedArgs, deps: ReplDeps): Promise<Fe
       // an honest null solve_method), instead of dropping it in the envelope.
       return {
         ...errEnvelope(url, r.error_reason),
+        // http_status belongs to the same contract: without it a caller cannot
+        // tell an anti-bot 403 from a challenge served at 200.
+        ...(typeof r.http_status === 'number' ? { http_status: r.http_status } : {}),
         ...(r.challenge_class !== undefined ? { challenge_class: r.challenge_class } : {}),
         ...(r.solve_method !== undefined ? { solve_method: r.solve_method } : {}),
       };
```

**File**: `src/tools/crawl.ts` (modified, +5/-1)
```diff
@@ -73,8 +73,12 @@ export async function handleCrawl(
           cached: false,
           error: r.error_reason,
           // Carry the upstream status through when the failure exposes one
-          // (anti-bot 403/429) so the crawl limiter can adapt pace per-domain.
+          // (anti-bot 403/429) so the crawl limiter can adapt pace per-domain,
+          // plus the solve-ladder provenance — the three travel together, and a
+          // per-adapter subset is how the surfaces drift apart.
           ...(typeof r.http_status === 'number' ? { http_status: r.http_status } : {}),
+          ...(r.challenge_class !== undefined ? { challenge_class: r.challenge_class } : {}),
+          ...(r.solve_method !== undefined ? { solve_method: r.solve_method } : {}),
         };
       }
       return r.data;
```

---

### Incident Patch 5: `23ca3c71` (2026-08-01)
**Commit Message**: fix(crawl): clamp the cooldown multiplier when the base delay is zero

maxMultiplier fell back to `next` when delayMs was 0, so the clamp compared a
value against itself and the multiplier doubled on every 403/429 forever.

crawlPrivateDelayMs defaults to 0, so this is the NORMAL state for private
hosts. The wait it produced stayed 0 either way, but the unbounded state lies
in wait for any later change that gives such a domain a real delay. Pin the
ceiling to 1 there instead.

Found by CodeRabbit.

**File**: `src/crawl/rate-limiter.ts` (modified, +6/-1)
```diff
@@ -102,7 +102,12 @@ export class RateLimiter {
     if (status === 403 || status === 429) {
       state.successStreak = 0;
       const next = state.cooldownMultiplier * this.cooldownFactor;
-      const maxMultiplier = state.delayMs > 0 ? this.cooldownMaxMs / state.delayMs : next;
+      // A ZERO base delay (the default for private hosts) has no meaningful
+      // multiplier: scaling it yields 0 either way. Falling back to `next` left
+      // the multiplier uncapped, doubling on every block forever — unbounded
+      // state that also lies in wait for any later change that gives the domain
+      // a non-zero delay. Pin it to 1 instead.
+      const maxMultiplier = state.delayMs > 0 ? this.cooldownMaxMs / state.delayMs : 1;
       state.cooldownMultiplier = Math.min(next, Math.max(1, maxMultiplier));
       return;
     }
```

**File**: `tests/unit/crawl/rate-limiter.test.ts` (modified, +32/-0)
```diff
@@ -210,3 +210,35 @@ describe('RateLimiter adaptive cooldown', () => {
     expect(() => limiter.recordResponse('never-seen.com', 429)).not.toThrow();
   });
 });
+
+describe('RateLimiter — cooldown stays bounded when the base delay is zero', () => {
+  // crawlPrivateDelayMs defaults to 0, so delayMs === 0 is the NORMAL state for
+  // private hosts. maxMultiplier fell back to `next` there, leaving the
+  // multiplier uncapped: it doubled on every 403/429 forever, and any later
+  // change that made a zero base delay non-zero would inherit an absurd wait.
+  it('does not grow the multiplier without bound on repeated blocks', () => {
+    const rl = new RateLimiter({ cooldownFactor: 2, cooldownMaxMs: 30_000, jitterPct: 0, rng: () => 0.5 });
+    rl.registerDomain('http://zero.example/a');
+    // Force the zero-base-delay state this guards.
+    (rl as unknown as { domains: Map<string, { delayMs: number }> }).domains.get('zero.example')!.delayMs = 0;
+
+    for (let i = 0; i < 40; i++) rl.recordResponse('zero.example', 429);
+
+    const m = (rl as unknown as { domains: Map<string, { cooldownMultiplier: number }> })
+      .domains.get('zero.example')!.cooldownMultiplier;
+    expect(Number.isFinite(m)).toBe(true);
+    expect(m).toBeLessThanOrEqual(1);
+    // And the wait it produces is still sane.
+    expect(rl.nextWaitMs('zero.example')).toBe(0);
+  });
+
+  it('still caps a NON-zero base delay at cooldownMaxMs', () => {
+    const rl = new RateLimiter({ cooldownFactor: 2, cooldownMaxMs: 4_000, jitterPct: 0, rng: () => 0.5 });
+    rl.registerDomain('http://slow.example/a');
+    (rl as unknown as { domains: Map<string, { delayMs: number }> }).domains.get('slow.example')!.delayMs = 1_000;
+
+    for (let i = 0; i < 20; i++) rl.recordResponse('slow.example', 403);
+
+    expect(rl.nextWaitMs('slow.example')).toBeLessThanOrEqual(4_000);
+  });
+});
```

---

### Incident Patch 6: `a2b5a68f` (2026-08-01)
**Commit Message**: fix(cache): keep proxy credentials out of the persisted clearance route

solvedRoute is written as `proxyUrl ?? 'direct'`, and proxyUrl is resolved
through resolveCredentialUrl — so it can carry inline `user:pass@`. That went
into the cache DB verbatim, in cleartext, surviving across runs.
persisted-config.ts already treats credential-bearing URLs as secrets that
must never reach disk in cleartext; this contradicted that posture.

The reuse gate only needs EQUALITY of the egress route, never the original
string. routeIdentity() reduces it to scheme//host:port.

It lives in store.ts — the actual disk boundary, so no caller can bypass it —
and clearance-reuse imports the SAME function for the comparison side. Two
different reductions would have silently killed reuse for every proxy user,
which the test pins: a clearance minted from the credential-bearing config
must still match the current route derived from that same raw URL, while two
different proxies stay distinguishable.

cache/store imports nothing from fetch/, so the value import is cycle-free.

Found by CodeRabbit.

**File**: `src/cache/store.ts` (modified, +29/-1)
```diff
@@ -817,6 +817,34 @@ export function getDomainClearance(host: string): DomainClearance | null {
 }
 
 /** Store (or replace) the anti-bot clearance for a host. */
+/**
+ * The stable, NON-SECRET identity of an egress route.
+ *
+ * `solvedRoute` is supplied as `proxyUrl ?? 'direct'`, and proxyUrl is resolved
+ * through `resolveCredentialUrl` — so it can carry inline `user:pass@`. The
+ * reuse gate only ever needs EQUALITY of the route, never the original string,
+ * and persisted-config.ts already treats credential-bearing URLs as secrets
+ * that must not reach disk in cleartext. Strip the userinfo down to
+ * `scheme//host:port` so the cache DB never holds a credential, while two
+ * different proxies stay distinguishable.
+ *
+ * Lives here, at the disk boundary, so no caller can bypass it; the comparison
+ * side imports the same function so both ends agree.
+ */
+export function routeIdentity(route: string | undefined | null): string {
+  if (route == null) return 'direct';
+  const trimmed = route.trim();
+  if (trimmed.length === 0 || trimmed === 'direct') return 'direct';
+  try {
+    const u = new URL(trimmed);
+    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
+  } catch {
+    // Not a URL (a label, or malformed). It carries no userinfo to leak, so
+    // keep it as-is rather than collapsing distinct routes into 'direct'.
+    return trimmed;
+  }
+}
+
 export function recordDomainClearance(host: string, clearance: DomainClearance): void {
   try {
     const db = getDatabase();
@@ -839,7 +867,7 @@ export function recordDomainClearance(host: string, clearance: DomainClearance):
       clearance.ua,
       clearance.tier,
       clearance.expiresAt,
-      clearance.solvedRoute ?? 'direct',
+      routeIdentity(clearance.solvedRoute),
     );
   } catch (err) {
     log.warn('recordDomainClearance failed', { host, error: err instanceof Error ? err.message : String(err) });
```

**File**: `src/fetch/clearance-reuse.ts` (modified, +6/-3)
```diff
@@ -1,4 +1,5 @@
 import { currentStealthChromeMajor } from './stealth.js';
+import { routeIdentity } from '../cache/store.js';
 import type { DomainClearance } from '../cache/store.js';
 
 /**
@@ -61,9 +62,11 @@ export function isClearanceFresh(clearance: DomainClearance, now: number): boole
  * existed.
  */
 export function normalizeClearanceRoute(route: string | undefined | null): string {
-  if (route == null) return 'direct';
-  const trimmed = route.trim();
-  return trimmed.length === 0 ? 'direct' : trimmed;
+  // Same reduction the store applies on write, so a clearance minted while the
+  // configured proxyUrl carried credentials still matches the current route
+  // derived from that same raw URL. Using a different rule on either side would
+  // silently kill reuse for every proxy user.
+  return routeIdentity(route);
 }
 
 /**
```

**File**: `tests/unit/cache/clearance-route-secret.test.ts` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+import { describe, it, expect, beforeEach, afterEach } from 'vitest';
+import { mkdtempSync, rmSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
+import { initDatabase, closeDatabase, getDatabase } from '../../../src/cache/db.js';
+import { _resetMigrationGuard } from '../../../src/cache/migrations/runner.js';
+import { getDomainClearance, recordDomainClearance } from '../../../src/cache/store.js';
+import { routeMatchesClearance, normalizeClearanceRoute } from '../../../src/fetch/clearance-reuse.js';
+
+/**
+ * `solvedRoute` is written as `getConfig().proxyUrl ?? 'direct'`, and proxyUrl
+ * is resolved through resolveCredentialUrl — so it can carry inline
+ * `user:pass@`. Persisting it verbatim wrote those credentials into the cache
+ * DB in cleartext, where they survive across runs. persisted-config.ts already
+ * treats credential-bearing URLs as secrets that must never reach disk in
+ * cleartext; this contradicted that posture.
+ *
+ * The gate only needs EQUALITY of the egress route, never the original string.
+ */
+const CRED_PROXY = 'http://alice:hunter2@proxy.example.com:8080';
+
+describe('a clearance never persists proxy credentials', () => {
+  let dir: string;
+
+  beforeEach(() => {
+    _resetMigrationGuard();
+    dir = mkdtempSync(join(tmpdir(), 'wigolo-route-secret-'));
+    initDatabase(join(dir, 'cache.db'));
+  });
+  afterEach(() => {
+    closeDatabase();
+    rmSync(dir, { recursive: true, force: true });
+  });
+
+  function record(route: string) {
+    recordDomainClearance('example.com', {
+      cookie: 'cf_clearance=TOKEN',
+      ua: 'Mozilla/5.0 Chrome/142.0.0.0',
+      tier: 'browser',
+      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
+      solvedRoute: route,
+    });
+  }
+
+  it('strips userinfo before the value reaches the database', () => {
+    record(CRED_PROXY);
+    const raw = getDatabase()
+      .prepare('SELECT solved_route FROM domain_routing WHERE domain = ?')
+      .get('example.com') as { solved_route: string };
+
+    expect(raw.solved_route).not.toContain('hunter2');
+    expect(raw.solved_route).not.toContain('alice');
+    expect(raw.solved_route).toContain('proxy.example.com');
+  });
+
+  it('keeps the route distinguishable — different proxies must not collide', () => {
+    record(CRED_PROXY);
+    const a = getDomainClearance('example.com')!.solvedRoute;
+    record('http://bob:pw@other.example.com:8080');
+    const b = getDomainClearance('example.com')!.solvedRoute;
+    expect(a).not.toBe(b);
+  });
+
+  it('still matches the SAME proxy computed from the credential-bearing config', () => {
+    // The mint side stores the stripped identity; the compare side derives the
+    // current route from the raw configured proxyUrl. They must agree, or reuse
+    // silently dies for every proxy user.
+    record(CRED_PROXY);
+    const stored = getDomainClearance('example.com')!;
+    expect(routeMatchesClearance(stored.solvedRoute, CRED_PROXY)).toBe(true);
+  });
+
+  it('does NOT match a different proxy', () => {
+    record(CRED_PROXY);
+    const stored = getDomainClearance('example.com')!;
+    expect(routeMatchesClearance(stored.solvedRoute, 'http://elsewhere.example:3128')).toBe(false);
+  });
+
+  it('leaves the direct route alone', () => {
+    record('direct');
+    expect(getDomainClearance('example.com')!.solvedRoute).toBe('direct');
+    expect(routeMatchesClearance('direct', 'direct')).toBe(true);
+  });
+
+  it('normalizes both sides of the comparison identically', () => {
+    expect(normalizeClearanceRoute(CRED_PROXY)).toBe(
+      normalizeClearanceRoute('http://proxy.example.com:8080'),
+    );
+  });
+});
```

---

### Incident Patch 7: `72844239` (2026-08-01)
**Commit Message**: fix(fetch): stop stranding the hosted browser, and drive a frame that exists

Two defects on the hosted / solve paths.

The hosted browser was assigned and then handed to newContext() BEFORE the
main try/finally that closes it, so a context failure leaked it — remotely,
where it keeps billing. It now closes and degrades to a local browser, the
same way a failed connect already did.

challengeSolveFrame looped selectors inside a try/catch, but
page.frameLocator() builds a LAZY locator and never throws when nothing
matches. The catch could not fire, so the loop always returned the FIRST
selector: every vision solve drove the reCAPTCHA bframe locator and hCaptcha
frames were never targeted at all. Probe the underlying iframe element and
return the frame that is actually present.

Both found by CodeRabbit.

**File**: `src/fetch/browser-pool.ts` (modified, +37/-9)
```diff
@@ -88,6 +88,13 @@ const WIDGET_FRAME_SELECTORS = [
 
 /** How many selectors a total miss pays for. Exported so the budget contract is
  *  assertable without reaching into the private locator. */
+/** Cross-origin frames a vision solve drives into, most specific first. */
+const CHALLENGE_FRAME_SELECTORS = [
+  'iframe[src*="api2/bframe"]',
+  'iframe[src*="hcaptcha.com"]',
+  'iframe[title*="challenge" i]',
+] as const;
+
 export const WIDGET_LOCATE_SELECTOR_COUNT =
   WIDGET_DOC_SELECTORS.length + WIDGET_FRAME_SELECTORS.length;
 
@@ -690,8 +697,20 @@ export class MultiBrowserPool {
         // Treat the hosted browser like the pinned-CDP browser so the shared
         // finally closes it (never released to the local pool).
         cdpBrowser = scrapingHandle.browser;
-        const contexts = cdpBrowser.contexts();
-        ctx = contexts.length > 0 ? contexts[0] : await cdpBrowser.newContext();
+        try {
+          const contexts = cdpBrowser.contexts();
+          ctx = contexts.length > 0 ? contexts[0] : await cdpBrowser.newContext();
+        } catch (err) {
+          // This runs BEFORE the main try/finally, so a context failure here
+          // would strand the hosted browser — and a hosted one keeps running
+          // (and billing) remotely. Close it and degrade like a failed connect.
+          log.warn('hosted scraping-browser context creation failed, falling back to a local browser', {
+            error: err instanceof Error ? err.message : String(err),
+          });
+          await scrapingHandle.close().catch(() => {});
+          cdpBrowser = null;
+          ctx = await this.acquireForType(resolvedType);
+        }
       } else {
         // Off / bad scheme / connect failed → graceful fall back to launch.
         ctx = await this.acquireForType(resolvedType);
@@ -1520,12 +1539,21 @@ export class MultiBrowserPool {
 
   /** The cross-origin reCAPTCHA image-select (bframe) / hCaptcha challenge frame
    *  a vision solve drives into, or null when it can't be resolved. */
-  private challengeSolveFrame(page: import('playwright').Page) {
+  private async challengeSolveFrame(page: import('playwright').Page) {
     if (typeof page.frameLocator !== 'function') return null;
-    for (const sel of ['iframe[src*="api2/bframe"]', 'iframe[src*="hcaptcha.com"]', 'iframe[title*="challenge" i]']) {
-      try {
-        return page.frameLocator(sel).first();
-      } catch { /* try next selector */ }
+    // `frameLocator` builds a LAZY locator — it does not throw when no matching
+    // frame exists, so a try/catch around it never fires and the loop always
+    // returned the FIRST selector. hCaptcha and generic challenge frames were
+    // therefore never targeted: every solve drove the reCAPTCHA bframe locator,
+    // matching nothing. Probe the underlying iframe element instead.
+    for (const sel of CHALLENGE_FRAME_SELECTORS) {
+      const present = await page
+        .locator(sel)
+        .first()
+        .count()
+        .then((n) => n > 0)
+        .catch(() => false);
+      if (present) return page.frameLocator(sel).first();
     }
     return null;
   }
@@ -1534,7 +1562,7 @@ export class MultiBrowserPool {
    *  0-based left-to-right, top-to-bottom; the frame exposes them as a table of
    *  cells. Best-effort per tile so one un-clickable index never aborts the set. */
   private async clickChallengeTiles(page: import('playwright').Page, indices: number[]): Promise<void> {
-    const frame = this.challengeSolveFrame(page);
+    const frame = await this.challengeSolveFrame(page);
     if (!frame) return;
     for (const idx of indices) {
       const cell = frame.locator('table td, .task-image').nth(idx);
@@ -1563,7 +1591,7 @@ export class MultiBrowserPool {
 
   /** Press the verify/submit control of the challenge (grid + text captchas). */
   private async submitChallenge(page: import('playwright').Page): Promise<void> {
-    const frame = this.challengeSolveFrame(page);
+    const frame = await this.challengeSolveFrame(page);
     if (frame) {
       const verify = frame.locator('#recaptcha-verify-button, .button-submit');
       const clicked = await verify.first().click({ timeout: 2000 }).then(() => true).catch(() => false);
```

---

### Incident Patch 8: `c1d7515a` (2026-08-01)
**Commit Message**: fix(fetch): close a hosted browser that connects after timeout or abort

withTimeoutAndAbort rejects on whichever fires first, but the underlying
connect(wss) keeps running. When it later resolved, the fulfilment handler
saw settled === true and returned without closing it.

Nobody was waiting for that browser and nobody would ever close it — and it
is a HOSTED one, so it kept running (and billing) on the provider's side
until their own idle timeout. Close it instead, best-effort and detached,
since by then there is no caller a rejection could reach.

**File**: `src/fetch/scraping-browser.ts` (modified, +21/-1)
```diff
@@ -145,6 +145,19 @@ export async function connectScrapingBrowser(
  * Race a connect promise against a timeout and an abort signal. Rejects on
  * whichever fires first so a hung / slow hosted endpoint never blocks forever.
  */
+/** Best-effort close of a browser nobody is waiting for any more. Never throws
+ *  — it runs detached from any caller, so a rejection here has nowhere to go. */
+async function closeStrandedBrowser(value: unknown): Promise<void> {
+  const closable = value as { close?: () => Promise<void> | void } | null;
+  if (!closable || typeof closable.close !== 'function') return;
+  try {
+    await closable.close();
+    defaultLogger.debug('scraping-browser: closed a connection that arrived after timeout/abort');
+  } catch {
+    /* nothing further we can do from here */
+  }
+}
+
 function withTimeoutAndAbort<T>(
   promise: Promise<T>,
   timeoutMs: number,
@@ -181,7 +194,14 @@ function withTimeoutAndAbort<T>(
 
     promise.then(
       (value) => {
-        if (settled) return;
+        if (settled) {
+          // The connect won the race against nothing — we already rejected on
+          // timeout/abort and the caller has moved on. Nobody will ever close
+          // this browser, and it is a HOSTED one: left open it keeps running
+          // (and billing) on the provider's side until their own idle timeout.
+          void closeStrandedBrowser(value);
+          return;
+        }
         settled = true;
         cleanup();
         resolve(value);
```

**File**: `tests/unit/fetch/resource-leak-guards.test.ts` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+import { describe, it, expect, vi } from 'vitest';
+import { connectScrapingBrowser } from '../../../src/fetch/scraping-browser.js';
+
+/**
+ * Both opt-in browser paths could strand a live browser:
+ *
+ *  - `withTimeoutAndAbort` rejects on timeout/abort, but the underlying
+ *    `connect(wss)` keeps running. When it later resolved, the fulfilment
+ *    handler saw `settled === true` and returned WITHOUT closing it — a hosted
+ *    browser left running on the provider's side, billed, until it timed out
+ *    there.
+ *  - The pool assigned the hosted browser and then called `newContext()`
+ *    outside the try/finally that closes it, so a context failure leaked it.
+ */
+describe('scraping-browser never strands a browser that arrives late', () => {
+  it('closes a browser that connects AFTER the timeout fired', async () => {
+    const close = vi.fn().mockResolvedValue(undefined);
+    let resolveConnect: (b: unknown) => void = () => {};
+    const connect = vi.fn(
+      () => new Promise((res) => { resolveConnect = res; }),
+    ) as never;
+
+    const handle = await connectScrapingBrowser({
+      wss: 'wss://user:pass@host.example:9222',
+      timeoutMs: 20,
+      connect,
+    });
+    expect(handle).toBeNull(); // timed out
+
+    // The provider answers late. Nothing is waiting for it any more, so the
+    // only correct action is to close it.
+    resolveConnect({ close });
+    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));
+  });
+
+  it('closes a browser that connects AFTER an abort', async () => {
+    const close = vi.fn().mockResolvedValue(undefined);
+    let resolveConnect: (b: unknown) => void = () => {};
+    const connect = vi.fn(
+      () => new Promise((res) => { resolveConnect = res; }),
+    ) as never;
+    const ac = new AbortController();
+
+    const pending = connectScrapingBrowser({
+      wss: 'wss://host.example:9222',
+      timeoutMs: 5_000,
+      connect,
+      signal: ac.signal,
+    });
+    ac.abort();
+    expect(await pending).toBeNull();
+
+    resolveConnect({ close });
+    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));
+  });
+
+  it('does NOT close a browser that arrives in time', async () => {
+    const close = vi.fn().mockResolvedValue(undefined);
+    const connect = vi.fn(async () => ({ close })) as never;
+
+    const handle = await connectScrapingBrowser({
+      wss: 'wss://host.example:9222',
+      timeoutMs: 5_000,
+      connect,
+    });
+
+    expect(handle).not.toBeNull();
+    expect(close).not.toHaveBeenCalled();
+    await handle!.close();
+    expect(close).toHaveBeenCalledTimes(1);
+  });
+});
```

---

### Incident Patch 9: `72fbc3c3` (2026-08-01)
**Commit Message**: fix(fetch): stop the slider heuristic firing on ordinary page furniture

hasSliderMarker required a corroborating hint, but the hint could be
satisfied by the token that triggered the check: `'slider'.includes('slide')`
is true, so `sliderish && (puzzle || slide)` was vacuous for every page
carrying a carousel, a range input, or `class="slider"`.

Those pages classified as a drag puzzle, and the vision rung would attempt a
drag gesture on them.

The corroboration must be a SEPARATE signal, so it is now puzzle/verify/
captcha. GeeTest and slidebg still short-circuit ahead of it, and a slider
co-present with a real puzzle hint still resolves.

Found by CodeRabbit.

**File**: `src/fetch/challenge-classify.ts` (modified, +7/-2)
```diff
@@ -280,9 +280,14 @@ export function classifyImageSubType(html: string): ImageSolveSubType {
 function hasSliderMarker(lower: string): boolean {
   if (lower.includes('geetest')) return true;
   if (lower.includes('slidebg')) return true;
+  // The corroborating hint must be a SEPARATE signal from the token that
+  // triggered the check. `'slider'.includes('slide')` made the old guard
+  // vacuous: every carousel, range input and `class="slider"` satisfied its own
+  // corroboration and classified as a drag puzzle, so the vision rung would
+  // attempt a drag on ordinary UI.
   const sliderish = lower.includes('slider') || lower.includes('drag');
-  if (sliderish && (lower.includes('puzzle') || lower.includes('slide'))) return true;
-  return false;
+  if (!sliderish) return false;
+  return lower.includes('puzzle') || lower.includes('verify') || lower.includes('captcha');
 }
 
 /**
```

**File**: `tests/unit/fetch/challenge-classify.test.ts` (modified, +32/-0)
```diff
@@ -263,3 +263,35 @@ describe('classifyImageSubType', () => {
     });
   });
 });
+
+describe('classifyImageSubType — slider detection must not fire on ordinary UI', () => {
+  // `sliderish && (puzzle || slide)` was vacuous for the `slider` token, because
+  // the string "slider" itself contains "slide". Any page carrying a carousel,
+  // range input or `class="slider"` therefore classified as a drag puzzle — and
+  // the vision rung would attempt a drag gesture on it.
+  it('does NOT call a plain carousel a slider puzzle', () => {
+    expect(
+      classifyImageSubType('<html><body><div class="slider"><img src="/a.jpg"></div></body></html>'),
+    ).not.toBe('slider');
+  });
+
+  it('does NOT call a range input a slider puzzle', () => {
+    expect(
+      classifyImageSubType('<html><body><input type="range" class="volume-slider"></body></html>'),
+    ).not.toBe('slider');
+  });
+
+  it('still detects a GeeTest slide puzzle', () => {
+    expect(classifyImageSubType('<html><body><div class="geetest_slider"></div></body></html>')).toBe('slider');
+  });
+
+  it('still detects a slidebg drag puzzle', () => {
+    expect(classifyImageSubType('<html><body><div class="slideBg"></div></body></html>')).toBe('slider');
+  });
+
+  it('still detects a slider co-present with an explicit puzzle hint', () => {
+    expect(
+      classifyImageSubType('<html><body><div class="slider">Drag the puzzle piece to verify</div></body></html>'),
+    ).toBe('slider');
+  });
+});
```

---

### Incident Patch 10: `59e18046` (2026-08-01)
**Commit Message**: fix(fetch): judge wall density over the whole document, not a leading slice

isLowContentDensity measured the text ratio on html.slice(0, 32768). Any
modern page opens with 32KB+ of <head> scripts and stylesheets carrying
almost no text, so a genuinely substantive page read as empty and a real 403
was relabelled a bot wall:

  bytes total          69279
  visible WHOLE doc    34799   <- clearly a real page
  visible first 32KB     379   <- the slice lies
  isChallengeShell(403) true   <- relabelled

challenge-classify.ts already documents this exact trap, in this same PR:
walmart's 405KB page carries <600 visible chars in its first 32KB but 2,777
overall, "so slicing here would defeat the guard entirely". The density rule
made the mistake that comment warns about.

approxVisibleTextLength keeps its 32KB bound by DEFAULT — that is correct for
the interstitial detectors, where a challenge shell is tiny and a leading
slice sees all of it. Only the density rule opts into the whole document, and
only behind an anti-bot status, so no hot path pays for the full scan.

My earlier test asserted the opposite and passed only because its fixture was
~1.6KB — smaller than the slice, so the slic

**File**: `src/fetch/tls-tier.ts` (modified, +21/-4)
```diff
@@ -527,8 +527,20 @@ const REAL_FORM_PATTERN = /<form[\s>][\s\S]*?<(?:input|button|select|textarea)[\
 // Approximate the visible text length of an HTML body: strip script/style and
 // tags, collapse whitespace. Cheap and bounded — the caller only cares whether
 // the result is tiny (interstitial) or substantial (real page).
-function approxVisibleTextLength(html: string): number {
-  const slice = html.length > 32768 ? html.slice(0, 32768) : html;
+/**
+ * Approximate rendered-text length.
+ *
+ * Bounded to the first 32KB by DEFAULT, which is correct for the interstitial
+ * detectors (`isNearEmptyBody`, `isChallengeSkeleton`): a challenge shell is
+ * tiny, so a leading slice sees all of it and a huge real document is not worth
+ * scanning in full.
+ *
+ * `whole: true` measures the ENTIRE document, which the density rule needs — a
+ * ratio computed on a leading slice is meaningless, because any modern page
+ * opens with 32KB+ of head assets carrying no text.
+ */
+function approxVisibleTextLength(html: string, opts?: { whole?: boolean }): number {
+  const slice = !opts?.whole && html.length > 32768 ? html.slice(0, 32768) : html;
   const stripped = slice
     .replace(/<script[\s\S]*?<\/script>/gi, ' ')
     .replace(/<style[\s\S]*?<\/style>/gi, ' ')
@@ -587,8 +599,13 @@ const WALL_MAX_TEXT_DENSITY = 0.05;
  */
 export function isLowContentDensity(html: string | null | undefined): boolean {
   if (!html || html.length < WALL_MIN_HTML_BYTES) return false;
-  const slice = html.length > 32768 ? html.slice(0, 32768) : html;
-  return approxVisibleTextLength(slice) / slice.length < WALL_MAX_TEXT_DENSITY;
+  // Measured over the WHOLE document, deliberately NOT a leading slice. Any
+  // modern page opens with 32KB+ of <head> scripts and stylesheets carrying
+  // almost no text, so judging density on a prefix calls a large REAL page
+  // empty and relabels a genuine 403 as a bot wall. Mirrors the same rule in
+  // challenge-classify.ts, which documents the walmart case (405KB page: <600
+  // visible chars in its first 32KB, 2,777 overall).
+  return approxVisibleTextLength(html, { whole: true }) / html.length < WALL_MAX_TEXT_DENSITY;
 }
 
 export function isChallengeSkeleton(html: string | null | undefined): boolean {
```

**File**: `tests/unit/fetch/challenge-status-distinguishable.test.ts` (modified, +33/-0)
```diff
@@ -23,6 +23,20 @@ const REAL_403_PAGE =
   'You do not have permission to view this resource. Contact your administrator. '.repeat(20) +
   '</p></body></html>';
 
+/**
+ * A LARGE real page whose first 32KB is `<head>` scripts and stylesheets — the
+ * normal shape of any modern site, and the case the original fixture was too
+ * small to reach. challenge-classify.ts already documents this trap: walmart's
+ * 405KB page carries <600 visible chars in its first 32KB but 2,777 overall, so
+ * judging density on a leading slice calls a real page empty.
+ */
+const BIG_REAL_403_PAGE =
+  '<html><head>' +
+  '<script src="/static/chunk.js"></script><link rel="stylesheet" href="/a.css">'.repeat(420) +
+  '</head><body>' +
+  '<p>Access to this administrative area is restricted to authorised staff. Contact your administrator to request access. '.repeat(300) +
+  '</p></body></html>';
+
 describe('the wall-shape rule keeps a real anti-bot status distinguishable', () => {
   it('treats a large all-scaffolding body as low density', () => {
     expect(isLowContentDensity(SCAFFOLD)).toBe(true);
@@ -32,6 +46,25 @@ describe('the wall-shape rule keeps a real anti-bot status distinguishable', ()
     expect(isLowContentDensity(REAL_403_PAGE)).toBe(false);
   });
 
+  it('does NOT misjudge a LARGE real page whose first 32KB is head scripts', () => {
+    // Regression: density was measured on html.slice(0, 32768). Any modern
+    // page's leading 32KB is head assets, so a genuinely substantive body read
+    // as empty and a real 403 was relabelled a bot wall.
+    expect(isLowContentDensity(BIG_REAL_403_PAGE)).toBe(false);
+    expect(isChallengeShell(403, BIG_REAL_403_PAGE)).toBe(false);
+  });
+
+  it('still catches a LARGE wall — size alone must not buy a pass', () => {
+    // The mirror of the case above: a big page that is genuinely all
+    // scaffolding is still a wall, so the fix cannot be "ignore large pages".
+    const bigWall =
+      '<html><head>' +
+      '<script src="/px.js"></script><link rel="stylesheet" href="/a.css">'.repeat(900) +
+      '</head><body><div id="challenge"></div></body></html>';
+    expect(isLowContentDensity(bigWall)).toBe(true);
+    expect(isChallengeShell(403, bigWall)).toBe(true);
+  });
+
   it('needs BOTH an anti-bot status and low density — status alone is not a wall', () => {
     // A substantive 403 (an admin page saying "forbidden") must pass through as
     // an ordinary HTTP error, not get relabelled a challenge.
```

---

### Incident Patch 11: `e795c12e` (2026-08-01)
**Commit Message**: test(fetch): pin the wall-shape rule's status-distinguishability contract

The vendor-agnostic wall-shape rule relabels an anti-bot-status response with
an all-scaffolding body as blocked_by_challenge rather than http_403. Reviewed
as a possible defect — a genuine client-rendered 403 losing its status — and
it is not one: the density guard means a substantive "Forbidden" page is never
low-density, and when the rule does fire the status is still surfaced as
http_status.

No behaviour change. These tests pin both halves so the contract cannot erode
silently, because if it did the crawl adaptive cooldown (which keys on 403/429)
would stop firing with nothing to notice.

**File**: `tests/unit/fetch/challenge-status-distinguishable.test.ts` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+import { describe, it, expect } from 'vitest';
+import { isChallengeShell, isLowContentDensity } from '../../../src/fetch/tls-tier.js';
+
+/**
+ * The vendor-agnostic wall-shape rule relabels a large, all-scaffolding body
+ * served with an anti-bot status as `blocked_by_challenge` rather than
+ * `http_403`. That is deliberate — a marker catalog only recognises walls we
+ * have already met — but it means a caller can no longer read the error CODE to
+ * learn what the origin actually said.
+ *
+ * The contract that makes it safe: whenever a real anti-bot status exists it is
+ * still surfaced as `http_status`, so a genuine 403 stays distinguishable from a
+ * challenge served at 200. That also matters mechanically — the crawl adaptive
+ * cooldown keys on 403/429, so dropping the status would silently disable it.
+ *
+ * These pin both halves. Without them the relabel could quietly swallow the
+ * status and nothing would notice.
+ */
+
+const SCAFFOLD = `<html><head>${'<script src="/a.js"></script>'.repeat(60)}</head><body><div id="x"></div></body></html>`;
+const REAL_403_PAGE =
+  '<html><body><h1>Forbidden</h1><p>' +
+  'You do not have permission to view this resource. Contact your administrator. '.repeat(20) +
+  '</p></body></html>';
+
+describe('the wall-shape rule keeps a real anti-bot status distinguishable', () => {
+  it('treats a large all-scaffolding body as low density', () => {
+    expect(isLowContentDensity(SCAFFOLD)).toBe(true);
+  });
+
+  it('does NOT treat a substantive error page as low density', () => {
+    expect(isLowContentDensity(REAL_403_PAGE)).toBe(false);
+  });
+
+  it('needs BOTH an anti-bot status and low density — status alone is not a wall', () => {
+    // A substantive 403 (an admin page saying "forbidden") must pass through as
+    // an ordinary HTTP error, not get relabelled a challenge.
+    expect(isChallengeShell(403, REAL_403_PAGE)).toBe(false);
+  });
+
+  it('needs BOTH — low density alone is not a wall either', () => {
+    // An un-hydrated SPA shell at 200 is the normal shape of a JS app booting.
+    expect(isChallengeShell(200, SCAFFOLD)).toBe(false);
+  });
+
+  it('fires only when the two coincide', () => {
+    expect(isChallengeShell(403, SCAFFOLD)).toBe(true);
+    expect(isChallengeShell(429, SCAFFOLD)).toBe(true);
+    expect(isChallengeShell(503, SCAFFOLD)).toBe(true);
+  });
+
+  it('ignores a body too small for the density ratio to mean anything', () => {
+    // A 30-byte error body's ratio is noise, not signal.
+    expect(isLowContentDensity('<html><body></body></html>')).toBe(false);
+    expect(isChallengeShell(403, '<html><body></body></html>')).toBe(false);
+  });
+});
```

---

### Incident Patch 12: `8a6112cc` (2026-08-01)
**Commit Message**: fix(fetch): reject reddit path segments instead of rewriting them

sanitizeSegment stripped anything outside [A-Za-z0-9_-] so the fixed-host
endpoint could never be escaped. That kept the URL safe but silently changed
WHICH resource was fetched:

  /r/foo.bar                    -> /r/foobar
  /r/AskReddit%2F..%2Fpolitics  -> /r/AskReddit2F2Fpolitics

Both are real subreddits. The caller asked for one community and got another
back with no signal that a substitution had happened.

Reddit names are [A-Za-z0-9_-]+, so a segment needing rewrite is one we
cannot serve. Return null and let the router fall through to the normal
ladder against the URL as written.

Strictly stronger than the old behaviour, so the two existing SSRF tests are
updated to assert the stronger property rather than relaxed: a hostile path
now performs NO egress at all — not the data endpoint, not even a token —
where before it fetched a sanitized, wrong resource. The fixed-host assertion
is retained on a legal path so that guarantee stays covered.

**File**: `src/fetch/reddit-api.ts` (modified, +16/-6)
```diff
@@ -63,9 +63,19 @@ export function isRedditUrl(url: string): boolean {
 
 const SORTS = new Set(['hot', 'new', 'top', 'rising', 'controversial', 'best']);
 
-/** Keep only characters valid in a reddit name segment (sub / user / id). */
-function sanitizeSegment(seg: string): string {
-  return seg.replace(/[^A-Za-z0-9_-]/g, '');
+/**
+ * A reddit name segment (sub / user / id), or null when the input is not already
+ * one. Reddit names are `[A-Za-z0-9_-]+`, so anything else cannot be served.
+ *
+ * This REJECTS rather than sanitizes. Stripping the offending characters keeps
+ * the fixed-host URL safe but silently changes WHICH resource is fetched —
+ * `/r/foo.bar` became `/r/foobar`, and `/r/AskReddit%2F..%2Fpolitics` became the
+ * real-but-wrong `/r/AskReddit2F2Fpolitics` — handing back another community's
+ * content with no signal. Returning null makes the router fall through to the
+ * normal ladder against the URL as the caller wrote it.
+ */
+function validSegment(seg: string): string | null {
+  return /^[A-Za-z0-9_-]+$/.test(seg) ? seg : null;
 }
 
 /**
@@ -96,19 +106,19 @@ export function mapRedditUrlToEndpoint(url: string): string | null {
 
   // /user/<name> or /u/<name>
   if ((parts[0] === 'user' || parts[0] === 'u') && parts[1]) {
-    const name = sanitizeSegment(parts[1]);
+    const name = validSegment(parts[1]);
     if (!name) return null;
     return `/user/${name}/about`;
   }
 
   // /r/<sub>/...
   if (parts[0] === 'r' && parts[1]) {
-    const sub = sanitizeSegment(parts[1]);
+    const sub = validSegment(parts[1]);
     if (!sub) return null;
 
     // /r/<sub>/comments/<id>[/slug]
     if (parts[2] === 'comments' && parts[3]) {
-      const id = sanitizeSegment(parts[3]);
+      const id = validSegment(parts[3]);
       if (!id) return null;
       return `/r/${sub}/comments/${id}`;
     }
```

**File**: `tests/unit/fetch/reddit-api.test.ts` (modified, +18/-7)
```diff
@@ -90,11 +90,15 @@ describe('mapRedditUrlToEndpoint', () => {
     expect(mapRedditUrlToEndpoint('https://www.reddit.com/settings')).toBeNull();
   });
 
-  it('sanitizes path segments so no injection reaches the endpoint', () => {
-    // A crafted segment must not smuggle characters outside [A-Za-z0-9_-] into
-    // the constructed endpoint path.
-    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/ru$st!/hot')).toBe('/r/rust/hot');
-    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/a.b.c/hot')).toBe('/r/abc/hot');
+  it('REFUSES a segment carrying anything outside [A-Za-z0-9_-] rather than sanitizing it', () => {
+    // Stripping the offending characters kept the endpoint safe but silently
+    // fetched a DIFFERENT resource (`/r/a.b.c` -> the real `/r/abc`). Refusing
+    // is strictly stronger: no injection reaches the endpoint AND no wrong
+    // community is served in place of the requested one.
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/ru$st!/hot')).toBeNull();
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/a.b.c/hot')).toBeNull();
+    // The legal name is unaffected.
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/rust/hot')).toBe('/r/rust/hot');
   });
 });
 
@@ -378,13 +382,20 @@ describe('fetchViaRedditApi', () => {
     const mgr = new RedditTokenManager(CREDS, fetchFn, () => 0);
 
     // A hostile path with an embedded @ / host-like segment must not redirect
-    // egress off oauth.reddit.com — the host comes from the fixed base only.
-    await fetchViaRedditApi(
+    // egress off oauth.reddit.com. It no longer even reaches the API: the name
+    // is not a legal reddit segment, so the mapper refuses and NOTHING is
+    // fetched — not the data endpoint, not even a token.
+    const hostile = await fetchViaRedditApi(
       'https://www.reddit.com/r/rust@evil.example/hot',
       mgr,
       CREDS,
       fetchFn,
     );
+    expect(hostile).toBeNull();
+    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
+
+    // And the host of a LEGAL request still comes from the fixed base only.
+    await fetchViaRedditApi('https://www.reddit.com/r/rust/hot', mgr, CREDS, fetchFn);
     const dataCall = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[1];
     const calledUrl = new URL(dataCall[0] as string);
     expect(calledUrl.hostname).toBe('oauth.reddit.com');
```

**File**: `tests/unit/fetch/reddit-url-fidelity.test.ts` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+import { describe, it, expect } from 'vitest';
+import { mapRedditUrlToEndpoint } from '../../../src/fetch/reddit-api.js';
+
+/**
+ * The endpoint mapper strips characters that are invalid in a Reddit name so the
+ * fixed-host URL can never be escaped. Stripping is the right defence, but
+ * SILENTLY stripping changes which resource is fetched: `/r/foo.bar` became
+ * `/r/foobar`, and the caller got a different subreddit's content back with no
+ * signal that a substitution happened.
+ *
+ * A segment that had to be rewritten is not a segment we can serve — return null
+ * so the router falls through to the normal ladder against the URL as given.
+ */
+describe('reddit endpoint mapping never silently substitutes a different resource', () => {
+  it('refuses a subreddit whose name had to be rewritten', () => {
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/foo.bar/')).toBeNull();
+  });
+
+  it('refuses a percent-encoded traversal attempt rather than mangling it into a real sub', () => {
+    // Previously mapped to /r/AskReddit2F2Fpolitics — a real, WRONG subreddit.
+    expect(
+      mapRedditUrlToEndpoint('https://www.reddit.com/r/AskReddit%2F..%2Fpolitics/'),
+    ).toBeNull();
+  });
+
+  it('refuses a rewritten username', () => {
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/user/bad$name')).toBeNull();
+  });
+
+  it('refuses a rewritten thread id', () => {
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/rust/comments/ab!c12/title/')).toBeNull();
+  });
+
+  it('still maps clean URLs exactly as before', () => {
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/rust/comments/abc123/title/')).toBe(
+      '/r/rust/comments/abc123',
+    );
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/rust/')).toBe('/r/rust/hot');
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/rust/top')).toBe('/r/rust/top');
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/user/spez')).toBe('/user/spez/about');
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/u/spez')).toBe('/user/spez/about');
+  });
+
+  it('accepts the underscore and hyphen that are legal in reddit names', () => {
+    expect(mapRedditUrlToEndpoint('https://www.reddit.com/r/my_sub-name/')).toBe(
+      '/r/my_sub-name/hot',
+    );
+  });
+});
```

---

### Incident Patch 13: `a3d1a1ef` (2026-08-01)
**Commit Message**: fix(fetch): make cdp-direct honour proxy + redirect egress policy

This rung spawns its own browser, so it inherits none of the egress controls
the Playwright tiers get for free.

Proxy: it launched with a proxy-stripped env and no --proxy-server, so with a
proxy configured it egressed DIRECT on the operator's real IP, unlogged —
silently defeating a boundary they deliberately set up. Now it passes
--proxy-server. Chrome accepts no inline credentials there, so an
authenticated proxy cannot be honoured at all; rather than fall back to
direct (the exact leak) the rung REFUSES and the fetch degrades to the normal
browser tier, which does honour it.

Redirects: the SSRF guard ran on the REQUESTED url only, but Page.navigate
follows redirects inside the browser — a public host redirecting to cloud
metadata / RFC-1918 had its content read and returned. finalUrl was also
hardcoded to the requested url, so the hop was invisible to the cache key and
every downstream consumer. Now the landing url is read from the isolated
world, reported honestly, and re-guarded.

The landing guard deliberately does NOT skip IP literals the way the
pre-navigation guard does: that skip is only justified becau

**File**: `src/fetch/cdp-direct.ts` (modified, +134/-2)
```diff
@@ -9,7 +9,7 @@ import { sanitizedChildEnv } from '../util/child-env.js';
 import { stealthLaunchArgs } from './stealth.js';
 import { discoverSessions, isCDPReachable } from './cdp-client.js';
 import { classifyChallenge } from './challenge-classify.js';
-import { guardResolvedHost, type LookupAll } from '../watch/ssrf.js';
+import { guardFetchUrl, guardResolvedHost, type LookupAll } from '../watch/ssrf.js';
 import type { RawFetchResult } from '../types.js';
 
 const log = createLogger('fetch');
@@ -71,6 +71,11 @@ export type CriFactory = (opts: { target: string; local?: boolean }) => Promise<
 /** The eval expression that reads the fully-hydrated document HTML. */
 const CONTENT_EXPRESSION = 'document.documentElement.outerHTML';
 
+/** Reads where the page ACTUALLY landed. `Page.navigate` follows redirects
+ *  inside the browser, so the requested URL is not necessarily the one whose
+ *  content we are about to read. */
+const LOCATION_EXPRESSION = 'location.href';
+
 /** Name of the isolated world we create for leak-free evaluation. */
 const ISOLATED_WORLD_NAME = 'wigolo_cdp_direct';
 
@@ -158,6 +163,9 @@ export interface CdpDirectConnectOptions {
 export interface CdpDirectHandle {
   navigate(url: string): Promise<void>;
   getContentHtml(): Promise<string>;
+  /** Where the page actually landed after any in-browser redirects, or '' when
+   *  it cannot be read. Never throws. */
+  getLocationHref?(): Promise<string>;
   close(): Promise<void>;
   /** Best-effort: send the browser window to the background (minimized) so a
    *  HEADFUL render never steals the user's screen. Resolves even when the
@@ -312,6 +320,25 @@ export async function cdpDirectConnect(
       return typeof value === 'string' ? value : '';
     },
 
+    async getLocationHref(): Promise<string> {
+      if (closed) return '';
+      try {
+        const contextId = await ensureIsolatedWorld();
+        const res = (await transport.send('Runtime.evaluate', {
+          expression: LOCATION_EXPRESSION,
+          contextId,
+          returnByValue: true,
+          awaitPromise: false,
+        })) as EvaluateResult;
+        const value = res?.result?.value;
+        return typeof value === 'string' ? value : '';
+      } catch {
+        // Best-effort: an unreadable location falls back to the requested URL,
+        // which the caller has already guarded.
+        return '';
+      }
+    },
+
     async close(): Promise<void> {
       if (closed) return;
       closed = true;
@@ -753,6 +780,71 @@ function isIpLiteralHost(host: string): boolean {
  * `false` when the resolved address is blocked. Honours the SAME
  * `fetchAllowPrivate` policy the rest of the fetch path uses.
  */
+/**
+ * The `--proxy-server` argument this rung must launch with so it egresses the
+ * SAME way as every other tier, or a refusal.
+ *
+ * This rung spawns its own browser, so unlike the Playwright tiers it does not
+ * inherit the configured proxy for free — and its env is proxy-stripped. Left
+ * unwired it egressed DIRECT on the operator's real IP whenever a proxy was
+ * configured, silently defeating the boundary they set up.
+ *
+ * Chrome's `--proxy-server` accepts NO inline credentials, so an authenticated
+ * proxy cannot be honoured here at all. Rather than fall back to direct (the
+ * exact leak), the rung REFUSES: `{ refuse: true }` makes the caller return null
+ * and the fetch degrades to the normal browser tier, which does honour it.
+ */
+function proxyArgFor(cfg: { useProxy: boolean; proxyUrl: string | null }):
+  | { refuse: true }
+  | { refuse: false; arg: string | null } {
+  if (!cfg.useProxy || !cfg.proxyUrl) return { refuse: false, arg: null };
+  let parsed: URL;
+  try {
+    parsed = new URL(cfg.proxyUrl);
+  } catch {
+    // An unparseable proxy URL cannot be honoured — refuse rather than leak.
+    return { refuse: true };
+  }
+  if (parsed.username || parsed.password) return { refuse: true };
+  // Rebuild from parts so nothing beyond scheme/host/port reaches the flag.
+  const port = parsed.port ? `:${parsed.port}` : '';
+  return { refuse: false, arg: `--proxy-server=${parsed.protocol}//${parsed.hostname}${port}` };
+}
+
+/** True when `value` parses as an http(s) URL. Used to decide whether a
+ *  `location.href` read is trustworthy enough to act on. */
+function isHttpUrl(value: string): boolean {
+  if (!value) return false;
+  try {
+    const p = new URL(value);
+    return p.protocol === 'http:' || p.protocol === 'https:';
+  } catch {
+    return false;
+  }
+}
+
+/**
+ * Guard a POST-REDIRECT landing URL. Unlike the pre-navigation check this must
+ * NOT skip IP literals: that skip is justified only because the caller's literal
+ * guard already vetted the REQUESTED url, and a redirect target was never seen
+ * by it. `http://169.254.169.254/` is exactly the shape a rebind lands on, so it
+ * gets the literal guard here plus the resolved check for hostnames.
+ */
+async function landingGuardOk(url: string,
```

**File**: `tests/unit/fetch/cdp-direct-egress-policy.test.ts` (added, +157/-0)
```diff
@@ -0,0 +1,157 @@
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
+import { resetConfig } from '../../../src/config.js';
+import {
+  cdpDirectFetch,
+  _setCdpDirectFetchDepsForTests,
+  _setProcessKillForTests,
+  type CdpDirectFetchDeps,
+  type CdpTransport,
+} from '../../../src/fetch/cdp-direct.js';
+import type { LookupAll } from '../../../src/watch/ssrf.js';
+
+/**
+ * The raw-CDP rung spawns its own browser, which means it bypasses BOTH of the
+ * egress controls the rest of the fetch path honours unless it is wired to
+ * respect them explicitly:
+ *
+ *  H1 — it launched with a proxy-stripped env and no `--proxy-server`, so with a
+ *       proxy configured it egressed DIRECT on the operator's real IP, unlogged.
+ *  H2 — the SSRF guard ran on the REQUESTED url only. `Page.navigate` follows
+ *       redirects inside the browser, so a public host redirecting to cloud
+ *       metadata / RFC-1918 had its content read and returned, and `finalUrl`
+ *       was hardcoded to the requested url so the hop was invisible downstream.
+ */
+
+const REAL_HTML = '<html><head><title>Real</title></head><body>' + 'x'.repeat(2000) + '</body></html>';
+
+interface Harness {
+  spawnedArgs: string[];
+  navigatedTo: string[];
+  locationHref: string;
+}
+
+function harness(h: Harness): CdpDirectFetchDeps {
+  const transport: CdpTransport = {
+    send: vi.fn(async (method: string, params?: Record<string, unknown>) => {
+      if (method === 'Page.navigate') {
+        h.navigatedTo.push(String(params?.url));
+        return { frameId: 'F1' };
+      }
+      if (method === 'Page.createIsolatedWorld') return { executionContextId: 7 };
+      if (method === 'Runtime.evaluate') {
+        const expr = String(params?.expression ?? '');
+        // The final-URL read must go through the same isolated world.
+        if (expr.includes('location')) return { result: { type: 'string', value: h.locationHref } };
+        return { result: { type: 'string', value: REAL_HTML } };
+      }
+      if (method === 'Browser.getVersion') return { userAgent: 'Mozilla/5.0 Chrome/151.0.7922.72' };
+      return {};
+    }),
+    close: vi.fn(async () => {}),
+  };
+  return {
+    resolveChrome: () => '/fake/chrome',
+    spawn: (_cmd, args) => {
+      h.spawnedArgs = args;
+      return { pid: 4242, on: vi.fn(), kill: vi.fn(), exitCode: 0, signalCode: null } as never;
+    },
+    isReachable: async () => true,
+    mkdtemp: async (p: string) => p + 'tmp',
+    rm: async () => {},
+    connectTransport: async () => transport,
+  };
+}
+
+describe('cdp-direct honours the configured egress policy (H1)', () => {
+  let h: Harness;
+  beforeEach(() => {
+    h = { spawnedArgs: [], navigatedTo: [], locationHref: 'https://example.com/' };
+    _setProcessKillForTests(() => {});
+    _setCdpDirectFetchDepsForTests(harness(h));
+    resetConfig();
+  });
+  afterEach(() => {
+    _setCdpDirectFetchDepsForTests(undefined);
+    _setProcessKillForTests(undefined);
+    delete process.env.USE_PROXY;
+    delete process.env.PROXY_URL;
+    resetConfig();
+  });
+
+  it('passes the configured proxy to the spawned browser rather than egressing direct', async () => {
+    process.env.USE_PROXY = 'true';
+    process.env.PROXY_URL = 'http://proxy.example.com:8080';
+    resetConfig();
+
+    const res = await cdpDirectFetch('https://example.com/', { lookup: publicLookup });
+
+    expect(res).not.toBeNull();
+    expect(h.spawnedArgs).toContain('--proxy-server=http://proxy.example.com:8080');
+  });
+
+  it('REFUSES to run rather than leak past a proxy it cannot authenticate', async () => {
+    // Chrome's --proxy-server takes no inline credentials. Egressing direct
+    // would defeat the proxy, so the rung declines and the caller falls back.
+    process.env.USE_PROXY = 'true';
+    process.env.PROXY_URL = 'http://user:pass@proxy.example.com:8080';
+    resetConfig();
+
+    const res = await cdpDirectFetch('https://example.com/', { lookup: publicLookup });
+
+    expect(res).toBeNull();
+    expect(h.navigatedTo).toEqual([]);
+  });
+
+  it('adds no proxy flag when none is configured', async () => {
+    const res = await cdpDirectFetch('https://example.com/', { lookup: publicLookup });
+    expect(res).not.toBeNull();
+    expect(h.spawnedArgs.some((a) => a.startsWith('--proxy-server'))).toBe(false);
+  });
+});
+
+describe('cdp-direct guards the POST-redirect landing url (H2)', () => {
+  let h: Harness;
+  beforeEach(() => {
+    h = { spawnedArgs: [], navigatedTo: [], locationHref: 'https://example.com/' };
+    _setProcessKillForTests(() => {});
+    _setCdpDirectFetchDepsForTests(harness(h));
+    resetConfig();
+  });
+  afterEach(() => {
+    _setCdpDirectFetchDepsForTests(undefined);
+    _setProcessKillForTests(undefined);
+    resetConfig();
+  });
+
+  it('refuses to return content when the page landed on a blocked address', async () => {
+    // Public host, allowed at request time, redirects in-browser
```

---

### Incident Patch 14: `0b51fa2d` (2026-08-01)
**Commit Message**: fix(fetch): fall back to the standard driver when the hardened one cannot launch

resolveStealthLauncher proves the optional hardened driver IMPORTS. It never
proves it can LAUNCH — and the driver resolves a browser revision it neither
installs nor owns.

launchDedicatedStealthBrowser resolved the launcher once and used it at all
four launch sites. The only try/catch fell back from channel:'chrome' to
bundled through the SAME launcher, so nothing ever reached the standard
driver. A version skew between the two packages therefore hard-failed every
anti-bot fetch, with no fallback and no CI signal.

Wrap each launch so a hardened-driver failure degrades to the standard
launcher, and cache the demotion so a broken optional driver is probed once
per process rather than once per fetch. A channel failure and a driver
failure are now caught at different levels and cannot be confused. Errors
from the standard launcher still propagate — nothing left to fall back to.

Does NOT downgrade a hardened driver that works, which is the negative case
the third test covers.

**File**: `src/fetch/browser-pool.ts` (modified, +46/-7)
```diff
@@ -291,6 +291,10 @@ export class MultiBrowserPool {
   // channel:'chrome' launch cost on every stealth fetch. Chromium-only — the
   // authentic-channel concept does not apply to firefox/webkit.
   private resolvedStealthChannel: 'chrome' | 'bundled' | null = null;
+  // Cached outcome of the hardened-driver LAUNCH probe. 'standard' means the
+  // optional hardened driver imported but could not launch on this machine, so
+  // we stop reaching for it. null = not yet demoted.
+  private resolvedStealthDriver: 'standard' | null = null;
 
   constructor(options?: MultiBrowserPoolOptions) {
     let types = options?.browserTypes ?? ['chromium'];
@@ -501,7 +505,18 @@ export class MultiBrowserPool {
    */
   private async launchDedicatedStealthBrowser(type: BrowserType, forceNoProxy = false): Promise<Browser> {
     const cfg = getConfig();
-    const launcher = await resolveStealthLauncher(type, cfg.stealthDriver, getLauncher(type));
+    const standard = getLauncher(type);
+    // `resolveStealthLauncher` proves the hardened driver IMPORTS — never that
+    // it can LAUNCH. It resolves a browser revision it neither installs nor
+    // owns, so a version skew between it and the standard driver leaves a
+    // launcher that loads fine and then fails on every launch. Without a
+    // launch-time fallback that hard-fails every anti-bot fetch, silently. Once
+    // we learn it cannot launch on this machine we stop reaching for it.
+    const hardened =
+      this.resolvedStealthDriver === 'standard'
+        ? standard
+        : await resolveStealthLauncher(type, cfg.stealthDriver, standard);
+    const usingHardened = hardened !== standard;
     // A managed-challenge direct-retry forces a proxy-free launch even when a
     // proxy is configured (a datacenter proxy blocks many managed challenges).
     const proxy = forceNoProxy ? undefined : playwrightProxyOption(cfg.proxyUrl, cfg.useProxy);
@@ -516,28 +531,52 @@ export class MultiBrowserPool {
       ...(proxy ? { proxy } : {}),
     };
 
+    /**
+     * Launch through the hardened driver, degrading to the standard one when
+     * the hardened driver itself cannot launch (as opposed to the CHANNEL being
+     * unavailable, which the caller handles separately). The downgrade is
+     * cached for the process so a broken optional driver is probed once, not
+     * once per fetch. Errors from the STANDARD launcher propagate — at that
+     * point there is nothing left to fall back to.
+     */
+    const launchWithFallback = async (opts: Record<string, unknown>): Promise<Browser> => {
+      if (!usingHardened) return standard.launch(opts);
+      try {
+        return await hardened.launch(opts);
+      } catch (err) {
+        this.resolvedStealthDriver = 'standard';
+        log.warn('hardened stealth driver could not launch, using the standard browser driver', {
+          type,
+          error: err instanceof Error ? err.message : String(err),
+        });
+        return standard.launch(opts);
+      }
+    };
+
     // Only chromium supports the authentic installed-browser channel. For
     // firefox/webkit (or a 'chromium'-forced config) launch bundled directly.
     const wantChannel = type === 'chromium' && cfg.browserChannel !== 'chromium';
     if (!wantChannel) {
       this.resolvedStealthChannel = 'bundled';
-      return launcher.launch(baseOpts);
+      return launchWithFallback(baseOpts);
     }
 
     // Cached probe: never re-attempt channel:'chrome' once we know it fails on
     // this machine, and never drop back to bundled once we know chrome works.
     if (this.resolvedStealthChannel === 'bundled') {
-      return launcher.launch(baseOpts);
+      return launchWithFallback(baseOpts);
     }
     if (this.resolvedStealthChannel === 'chrome') {
-      return launcher.launch({ ...baseOpts, channel: 'chrome' });
+      return launchWithFallback({ ...baseOpts, channel: 'chrome' });
     }
 
     // First probe this process. Try the authentic browser; on ANY launch
     // failure (not installed / spawn error) fall back to the bundled engine and
-    // cache the outcome so later fetches skip the failed attempt.
+    // cache the outcome so later fetches skip the failed attempt. A hardened
+    // driver that cannot launch AT ALL is caught one level down, so a channel
+    // failure and a driver failure cannot be confused for one another.
     try {
-      const browser = await launcher.launch({ ...baseOpts, channel: 'chrome' });
+      const browser = await launchWithFallback({ ...baseOpts, channel: 'chrome' });
       this.resolvedStealthChannel = 'chrome';
       log.info('anti-bot stealth launch using authentic installed browser', { type });
       return browser;
@@ -547,7 +586,7 @@ export class MultiBrowserPool {
         type,
         error: err instanceof Error ? err.message : String(err),
       });
-      return launcher.launch(baseOpts);
+      return launchWithFallback(baseOpts);
     }
   }
 
```

**File**: `tests/unit/fetch/browser-pool.driver-fallback.test.ts` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
+import { resetConfig } from '../../../src/config.js';
+
+/**
+ * The hardened stealth driver ships as an optional dependency and resolves a
+ * browser revision it neither installs nor owns. `resolveStealthLauncher` only
+ * proves the module IMPORTS — never that it can LAUNCH.
+ *
+ * Before this fix the launcher was resolved once and every launch site used it:
+ * the only try/catch fell back from `channel:'chrome'` to bundled through the
+ * SAME launcher, so a driver that imported but could not launch hard-failed the
+ * fetch with no path back to the standard driver. A version skew between the two
+ * packages would have taken out every anti-bot fetch, silently.
+ *
+ * The pool must degrade to the standard launcher instead, and remember it.
+ */
+
+interface State {
+  hardenedAttempts: number;
+  standardLaunches: Array<Record<string, unknown>>;
+  hardenedWorks: boolean;
+}
+const state: State = { hardenedAttempts: 0, standardLaunches: [], hardenedWorks: false };
+
+function makePage() {
+  return {
+    goto: vi.fn().mockResolvedValue({
+      status: () => 200,
+      url: () => 'https://example.com',
+      headers: () => ({ 'content-type': 'text/html' }),
+    }),
+    waitForLoadState: vi.fn().mockResolvedValue(undefined),
+    waitForFunction: vi.fn().mockResolvedValue(undefined),
+    evaluate: vi.fn().mockImplementation((src: string) =>
+      typeof src === 'string' && src.includes('hasContent')
+        ? Promise.resolve({ hasContent: true, hasSpaRoot: false, nearEmpty: false })
+        : Promise.resolve({ textLen: 1000, nodes: 8 })),
+    content: vi.fn().mockResolvedValue('<html><body>real content here</body></html>'),
+    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
+    on: vi.fn(),
+    close: vi.fn().mockResolvedValue(undefined),
+  };
+}
+function makeBrowser() {
+  return {
+    version: vi.fn(() => '142.0.7444.0'),
+    newContext: vi.fn().mockResolvedValue({
+      addInitScript: vi.fn().mockResolvedValue(undefined),
+      close: vi.fn().mockResolvedValue(undefined),
+      newPage: vi.fn().mockResolvedValue(makePage()),
+      cookies: vi.fn().mockResolvedValue([]),
+    }),
+    close: vi.fn().mockResolvedValue(undefined),
+  };
+}
+
+vi.mock('playwright', () => {
+  const launch = vi.fn().mockImplementation((opts: Record<string, unknown>) => {
+    state.standardLaunches.push(opts);
+    return Promise.resolve(makeBrowser());
+  });
+  const stub = { launch };
+  return { chromium: stub, firefox: stub, webkit: stub };
+});
+
+import { MultiBrowserPool } from '../../../src/fetch/browser-pool.js';
+import { _setStealthDriverForTests, type StealthDriverLauncher } from '../../../src/fetch/stealth.js';
+
+/** A hardened driver that IMPORTS fine but always fails to LAUNCH — the exact
+ *  shape of a browser-revision skew between the two packages. */
+function brokenHardenedDriver(): StealthDriverLauncher {
+  return {
+    launch: vi.fn(() => {
+      state.hardenedAttempts++;
+      return Promise.reject(new Error("Executable doesn't exist at .../chrome-1223/chrome"));
+    }),
+  } as unknown as StealthDriverLauncher;
+}
+
+describe('dedicated stealth launch degrades when the hardened driver cannot launch', () => {
+  beforeEach(() => {
+    state.hardenedAttempts = 0;
+    state.standardLaunches = [];
+    process.env.WIGOLO_STEALTH_DRIVER = 'auto';
+    process.env.WIGOLO_BROWSER_CHANNEL = 'chromium'; // isolate the driver axis
+    resetConfig();
+  });
+  afterEach(() => {
+    _setStealthDriverForTests(undefined);
+    process.env.WIGOLO_STEALTH_DRIVER = 'playwright';
+    delete process.env.WIGOLO_BROWSER_CHANNEL;
+    resetConfig();
+  });
+
+  it('falls back to the standard driver instead of hard-failing the fetch', async () => {
+    _setStealthDriverForTests(brokenHardenedDriver());
+    const pool = new MultiBrowserPool();
+
+    const result = await pool.fetchWithBrowser('https://blocked.example', { stealth: true });
+
+    expect(result.method).toBe('browser');
+    expect(state.hardenedAttempts).toBeGreaterThan(0);
+    expect(state.standardLaunches.length).toBe(1);
+    await pool.shutdown();
+  });
+
+  it('remembers the failure — a second fetch does not re-attempt the broken driver', async () => {
+    _setStealthDriverForTests(brokenHardenedDriver());
+    const pool = new MultiBrowserPool();
+
+    await pool.fetchWithBrowser('https://a.example', { stealth: true });
+    const attemptsAfterFirst = state.hardenedAttempts;
+    await pool.fetchWithBrowser('https://b.example', { stealth: true });
+
+    expect(state.hardenedAttempts).toBe(attemptsAfterFirst);
+    expect(state.standardLaunches.length).toBe(2);
+    await pool.shutdown();
+  });
+
+  it('still uses the hardened driver when it CAN launch (no needless downgrade)', async () => {
+    const working = {
+      launch: vi.fn(() => {
+        state.hardenedAttempts++;
+        return Promise.resol
```

---

### Incident Patch 15: `ebb611ec` (2026-08-01)
**Commit Message**: fix(config): default humanize + autoPass to off, completing the opt-in posture

WIGOLO_HUMANIZE   auto -> off
WIGOLO_AUTO_PASS  auto -> off

Both rungs are reactive — they only run once a fetch has already hit a
challenge, so neither ever slowed a successful fetch. But both added time
to a fetch that ends up blocked anyway, and neither has a measured win:
behavioural interaction did not change a wall outcome in this project's own
testing (passive render sufficed), and the auto-pass gesture has never
converted a block into a pass on a live target.

With these off, an existing install now behaves as it did before on the
FAILURE path too, not just the happy path. Measured on glassdoor,
cache-busted, same blocked_by_challenge verdict throughout:

  origin/main                    15.5s
  this PR as submitted          226.0s
  after the widget-probe fix     19.3s
  now                             2.7s

Faster than the baseline, because the vendor-agnostic wall-shape rule
recognises the wall at the HTTP tier and skips a browser escalation that
was never going to clear it. Happy path unchanged: wikipedia 1.7s via
method=http.

Unknown values now normalize to 'off' rather than 'auto', so a 

**File**: `src/config.ts` (modified, +21/-11)
```diff
@@ -263,12 +263,18 @@ export interface Config {
    * dependency-free behavioral pass (curved mouse traversal + small randomized
    * scroll + randomized delays, hard time-capped) runs on the browser tier
    * AFTER navigation settles and BEFORE content extraction.
-   *   - 'off'  : never engage; browser fetches pay zero behavioral cost.
-   *   - 'auto' : engage ONLY on the anti-bot / stealth escalation path
-   *              (DEFAULT) — a benign, non-escalated browser fetch does NOT
-   *              pay the cost.
+   *   - 'off'  : never engage; browser fetches pay zero behavioral cost
+   *              (DEFAULT).
+   *   - 'auto' : engage ONLY on the anti-bot / stealth escalation path — a
+   *              benign, non-escalated browser fetch does NOT pay the cost.
    *   - 'on'   : engage on every browser fetch.
-   * Any other value normalizes to 'auto' (the safe default).
+   * Any other value normalizes to 'off' (the safe default).
+   *
+   * Defaults OFF. The pass is reactive (escalation path only), so it never
+   * slows a successful fetch — but it does add ~1.2s to one that ends up
+   * blocked anyway, and behavioural interaction did not measure as a lever that
+   * changes a bot-wall outcome (passive render sufficed). Opt in with
+   * WIGOLO_HUMANIZE=auto.
    */
   humanize: 'off' | 'auto' | 'on';
   /**
@@ -283,8 +289,12 @@ export interface Config {
   hardcore: 'off' | 'on';
   /**
    * Automated interactive-challenge pass (trusted-input gesture on a checkbox /
-   * Turnstile widget). 'off' | 'auto' (engage on the escalation path, DEFAULT) |
-   * 'on'. Any other value normalizes to 'auto'. WIGOLO_AUTO_PASS.
+   * Turnstile widget). 'off' (DEFAULT) | 'auto' (engage on the escalation path)
+   * | 'on'. Any other value normalizes to 'off'. WIGOLO_AUTO_PASS.
+   *
+   * Defaults OFF. The rung only runs on a fetch that already hit a challenge, so
+   * it never slows a successful one, but it adds ~3s to a fetch that ends up
+   * blocked anyway and has no measured win. Opt in with WIGOLO_AUTO_PASS=auto.
    */
   autoPass: 'off' | 'auto' | 'on';
   /**
@@ -747,16 +757,16 @@ export function getConfig(): Config {
         : 'playwright';
     })(),
     humanize: (() => {
-      const raw = (envStr('WIGOLO_HUMANIZE', 'auto', settings, 'humanize') ?? 'auto').toLowerCase();
-      return raw === 'off' || raw === 'on' ? (raw as 'off' | 'on') : 'auto';
+      const raw = (envStr('WIGOLO_HUMANIZE', 'off', settings, 'humanize') ?? 'off').toLowerCase();
+      return raw === 'auto' || raw === 'on' ? (raw as 'auto' | 'on') : 'off';
     })(),
     hardcore: (() => {
       const raw = (envStr('WIGOLO_HARDCORE', 'off', settings, 'hardcore') ?? 'off').toLowerCase();
       return raw === 'on' ? 'on' : 'off';
     })(),
     autoPass: (() => {
-      const raw = (envStr('WIGOLO_AUTO_PASS', 'auto', settings, 'autoPass') ?? 'auto').toLowerCase();
-      return raw === 'off' || raw === 'on' ? (raw as 'off' | 'on') : 'auto';
+      const raw = (envStr('WIGOLO_AUTO_PASS', 'off', settings, 'autoPass') ?? 'off').toLowerCase();
+      return raw === 'auto' || raw === 'on' ? (raw as 'auto' | 'on') : 'off';
     })(),
     cdpDirect: (() => {
       const raw = (envStr('WIGOLO_CDP_DIRECT', 'off', settings, 'cdpDirect') ?? 'off').toLowerCase();
```

**File**: `tests/unit/config-persistence.test.ts` (modified, +2/-2)
```diff
@@ -119,13 +119,13 @@ describe('getConfig() — humanize (behavioral realism) resolution', () => {
     expect(getConfig().humanize).toBe('off');
   });
 
-  it('defaults to auto when both env and config.json are absent', () => {
+  it('defaults to off when both env and config.json are absent', () => {
     const cfgPath = join(dir, 'config.json');
     writeFileSync(cfgPath, JSON.stringify({ version: 1, settings: {} }));
     setConfigPath(cfgPath);
     delete process.env.WIGOLO_HUMANIZE;
     resetConfig(); resetPersistedConfig();
-    expect(getConfig().humanize).toBe('auto');
+    expect(getConfig().humanize).toBe('off');
   });
 });
 
```

**File**: `tests/unit/config.test.ts` (modified, +12/-3)
```diff
@@ -124,9 +124,18 @@ describe('config', () => {
   });
 
   describe('humanize (behavioral realism) configuration', () => {
-    it('defaults WIGOLO_HUMANIZE to auto', () => {
+    // Defaults OFF: the pass is reactive (escalation path only) so it never
+    // slows a successful fetch, but it adds ~1.2s to one that ends up blocked
+    // anyway, for a lever that did not measure as changing a wall outcome.
+    it('defaults WIGOLO_HUMANIZE to off', () => {
       delete process.env.WIGOLO_HUMANIZE;
       resetConfig();
+      expect(getConfig().humanize).toBe('off');
+    });
+
+    it('reads WIGOLO_HUMANIZE=auto to opt into the escalation-path pass', () => {
+      process.env.WIGOLO_HUMANIZE = 'auto';
+      resetConfig();
       expect(getConfig().humanize).toBe('auto');
     });
 
@@ -142,10 +151,10 @@ describe('config', () => {
       expect(getConfig().humanize).toBe('off');
     });
 
-    it('normalizes an unknown WIGOLO_HUMANIZE value to the safe auto default', () => {
+    it('normalizes an unknown WIGOLO_HUMANIZE value to the safe off default', () => {
       process.env.WIGOLO_HUMANIZE = 'aggressive';
       resetConfig();
-      expect(getConfig().humanize).toBe('auto');
+      expect(getConfig().humanize).toBe('off');
     });
 
     it('is case-insensitive for WIGOLO_HUMANIZE', () => {
```

**File**: `tests/unit/config/hardcore-mode.test.ts` (modified, +9/-6)
```diff
@@ -60,7 +60,7 @@ describe('config — hardcore-mode knob defaults', () => {
   it('all new knobs take their documented defaults when unset', () => {
     const cfg = getConfig();
     expect(cfg.hardcore).toBe('off');
-    expect(cfg.autoPass).toBe('auto');
+    expect(cfg.autoPass).toBe('off');
     expect(cfg.cdpDirect).toBe('off');
     expect(cfg.aiSolve).toBe('off');
     expect(cfg.aiSolveMaxAttempts).toBe(2);
@@ -92,7 +92,7 @@ describe('config — hardcore knob env / persisted / normalize', () => {
     expect(getConfig().hardcore).toBe('on');
   });
 
-  it('WIGOLO_AUTO_PASS: env off/auto/on, persisted, junk→auto', () => {
+  it('WIGOLO_AUTO_PASS: env off/auto/on, persisted, junk→off', () => {
     process.env.WIGOLO_AUTO_PASS = 'on';
     resetConfig();
     expect(getConfig().autoPass).toBe('on');
@@ -103,7 +103,7 @@ describe('config — hardcore knob env / persisted / normalize', () => {
 
     process.env.WIGOLO_AUTO_PASS = 'nonsense';
     resetConfig();
-    expect(getConfig().autoPass).toBe('auto');
+    expect(getConfig().autoPass).toBe('off');
 
     delete process.env.WIGOLO_AUTO_PASS;
     writeFileSync(
@@ -318,15 +318,18 @@ describe('config — hardcore preset resolver', () => {
     expect(cfg.stealthDriver).toBe('playwright');
     expect(cfg.browserChannel).toBe('chromium');
     expect(cfg.browserHeadful).toBe(false);
-    expect(cfg.humanize).toBe('auto');
+    // Both rungs default OFF: reactive-only, so they never slow a successful
+    // fetch, but they add time to one that ends up blocked anyway for no
+    // measured win. Opt in per-knob.
+    expect(cfg.humanize).toBe('off');
     expect(cfg.cdpDirect).toBe('off');
-    expect(cfg.autoPass).toBe('auto');
+    expect(cfg.autoPass).toBe('off');
     expect(cfg.aiSolve).toBe('off');
     expect(cfg.humanSolve).toBe('off');
     expect(cfg.challengeCompletionTimeoutMs).toBe(15000);
   });
 
-  it('does NOT touch proxyBypassOnChallenge (its default is already true)', () => {
+  it('does NOT touch proxyBypassOnChallenge (the preset owns no entry for it)', () => {
     // Assert the resolver is a no-op on this knob: with hardcore on and the knob
     // explicitly set false, it must stay false (the preset must not flip it).
     process.env.WIGOLO_HARDCORE = 'on';
```

**File**: `tests/unit/fetch/browser-pool.challenge.test.ts` (modified, +8/-2)
```diff
@@ -206,6 +206,9 @@ describe('browser-pool anti-bot fast-fail (D6)', () => {
   });
   afterEach(() => {
     vi.useRealTimers();
+    // A test that opted into the auto-pass rung must not leave it on for the
+    // next one — the default is off.
+    delete process.env.WIGOLO_AUTO_PASS;
     resetConfig();
   });
 
@@ -567,8 +570,11 @@ describe('browser-pool anti-bot fast-fail (D6)', () => {
     // WHY (reviewer-flagged regression): the ladder-solved harvest must thread
     // the CURRENT egress route into recordDomainClearance.solvedRoute. This drives
     // the REAL pool path: the auto-poll cannot see the clearance cookie (no CDP
-    // session), times out, and the LADDER's auto-pass rung (default gate 'auto')
-    // opens a CDP session — which reveals the cookie — and clears.
+    // session), times out, and the LADDER's auto-pass rung opens a CDP session
+    // — which reveals the cookie — and clears. The rung is OPT-IN (it adds time
+    // to an already-blocked fetch), so this test enables it explicitly.
+    process.env.WIGOLO_AUTO_PASS = 'auto';
+    resetConfig();
     vi.useFakeTimers();
     process.env.WIGOLO_CHALLENGE_COMPLETION_MS = '3000';
     resetConfig();
```

#### Recent Merged Pull Requests:
- **PR #638** (2026-09-27): feat(site): wigolo.app, logo wall, docs site, comparison pages, analytics and sponsor layout (@KnockOutEZ)
- **PR #636** (2026-09-21): docs(licensing): strip the AGPL explainer, keep the ask (@KnockOutEZ)
- **PR #634** (2026-09-21): docs: add commercial licensing terms (LICENSING.md); AGPL-3.0 unchanged (@KnockOutEZ)
- **PR #627** (2026-09-11): docs(readme): add Discord community link and badge (@KnockOutEZ)
- **PR #626** (2026-09-08): fix(daemon): revoke broker grants after schema migration (@KnockOutEZ)
- **PR #625** (2026-09-08): fix(fetch): degrade to the lower tier on the domain-marked path when no browser engine (PX2 RC gate arm) (@KnockOutEZ)
- **PR #624** (2026-09-08): feat(binary): brew tap formula + release automation hook (@KnockOutEZ)
- **PR #623** (2026-09-08): fix(core)!: PX2-R — registration becomes an unlock, not a gate (@KnockOutEZ)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
