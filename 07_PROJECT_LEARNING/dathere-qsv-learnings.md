# Forensic Learning Record (Deep Inspection): dathere/qsv

> **Canonical Artifact**: `07_PROJECT_LEARNING/dathere-qsv-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dathere/qsv](https://github.com/dathere/qsv))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:16:13.354Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dathere/qsv`
- **Description**: Blazing-fast Data-Wrangling toolkit
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3803 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/src/concurrency.ts`
```
/**
 * Slot-based concurrency control for MCP tool invocations.
 */

import type { ChildProcess } from "child_process";
import { config } from "./config.js";
import { KILL_GRACE_PERIOD_MS } from "./tool-constants.js";

/**
 * Track active child processes for graceful shutdown (SIGTERM on exit).
 */
export const activeProcesses = new Set<ChildProcess>();

/**
 * Track in-flight operation count for concurrency limiting.
 * Incremented/decremented via acquireSlot/releaseSlot in handleToolCall
 * to cover the entire execution path (both runQsvSimple and SkillExecutor.runQsv).
 */
let activeOperationCount = 0;

/**
 * A slot waiter with an explicit settled flag for reliable handoff detection.
 * `settled` is true if the waiter already timed out (callback becomes a no-op).
 */
interface SlotWaiter {
  settled: boolean;
  callback: () => void;
}

/**
 * Queue of waiters for concurrency slots.
 * Each entry carries a settled flag so releaseSlot can skip timed-out waiters
 * without relying on observable side-effects of the callback.
 */
const slotWaiters: SlotWaiter[] = [];

/**
 * Maximum queue size for backpressure. When the waiter queue reaches this size,
 * new acquireSlot() calls return "backpressure" immediately to prevent unbounded
 * queueing. Declared as `let` solely for test-only overrides via _testConcurrency.
 */
let MAX_QUEUE_SIZE = 64;

/** Result of acquireSlot: true (acquired), "timeout", or "backpressure". */
export type SlotResult = true | "timeout" | "backpressure";

/**
 * Acquire a concurrency slot, waiting up to timeoutMs if all slots are busy.
 * Returns true if slot acquired, "timeout" if waited too long, or
 * "backpressure" if the waiter queue is full.
 */
export async function acquireSlot(timeoutMs: number): Promise<SlotResult> {
  // IMPORTANT: The check-then-increment below is safe because it's synchronous
  // (no `await` between check and increment). Node.js single-threaded execution
  // guarantees atomicity for synchronous code. Do NOT insert an `await` here.
  if (activeOperationCount < config.maxConcurrentOperations) {
    activeOperationCount++;
    return true;
  }

  // Prune all settled (timed-out) waiters before adding a new one,
  // so the array doesn't grow unboundedly if releases are rare.
  // Filter the entire array, not just the front, to handle cases where
  // early waiters have long timeouts and later ones time out first.
  for (let i = slotWaiters.length - 1; i >= 0; i--) {
    if (slotWaiters[i].settled) slotWaiters.splice(i, 1);
  }

  // Backpressure: reject immediately if queue is full
  if (slotWaiters.length >= MAX_QUEUE_SIZE) {
    return "backpressure";
  }

  // No immediate slot — wait in queue
  return new Promise<SlotResult>((resolve) => {
    const waiter: SlotWaiter = { settled: false, callback: () => {} };

    const timer = setTimeout(() => {
      if (!waiter.settled) {
        waiter.settled = true;
        resolve("timeout");
      }
    }, timeoutMs);

    waiter.callback = () => {
      if (!waiter.settled) {
        waiter.settled = true;
        clearTimeout(timer);
        activeOperationCount++;
        resolve(true);
      }
    };

    slotWaiters.push(waiter);
  });
}

/**
 * Release a concurrency slot and wake the next waiter if any.
 */
export function releaseSlot(): void {
  // Try to hand off to the next live waiter. Skip any that already timed out.
  while (slotWaiters.length > 0) {
    const waiter = slotWaiters.shift();
    if (waiter && !waiter.settled) {
      // The callback increments activeOperationCount for the new operation,
      // so we must also decrement for the releasing operation to keep the
      // count correct (net effect: count stays the same).
      try {
        waiter.callback();
      } catch (err) {
        // callback() is a simple resolve — this should never happen, but guard
        // against a count mismatch if it does (callback failed to increment).
        console.warn("releaseSlot: waiter callback threw unexpectedly:", err);
      }
      if (activeOperationCount > 0) {
        activeOperationCount--;
      } else {
        console.warn("releaseSlot: activeOperationCount already at 0 during waiter handoff — count/waiter mismatch");
      }
      return; // handed off successfully
    }
    // timed-out waiter, skip
  }
  // No waiters (or all timed out) — just release the slot.
  if (activeOperationCount > 0) {
    activeOperationCount--;
  } else {
    console.warn("releaseSlot: activeOperationCount already at 0 — possible double-release");
  }
}

/**
 * Flag indicating shutdown is in progress
 */
export let isShuttingDown = false;

/**
 * Initiate graceful shutdown
 */
export function initiateShutdown(): void {
  isShuttingDown = true;
  console.error(
    `[MCP Tools] Shutdown initiated, ${activeOperationCount} active operations, ${activeProcesses.size} tracked processes`,
  );
}

/**
 * Kill all active child processes for graceful shutdown.
 */
export function killAllProcesses(): void {
  // Snapshot the set so we can iterate again after the grace period without
  // racing with `close` handlers that remove entries from `activeProcesses`.
  const survivors: ChildProcess[] = [];
  for (const proc of activeProcesses) {
    try {
      proc.kill("SIGTERM");
      survivors.push(proc);
    } catch {
      // Process might have already exited
    }
  }
  activeProcesses.clear();

  // After a short grace period, force-kill anything still running. Mirrors
  // the SIGTERM → grace → SIGKILL pattern in spawn-utils.spawnWithTimeout.
  // The timer is unref'd so it never blocks process exit on its own.
  if (survivors.length > 0) {
    const killTimer = setTimeout(() => {
      for (const proc of survivors) {
        if (proc.exitCode === null && proc.signalCode === null) {
          try {
            proc.kill("SIGKILL");
          } catch {
            // exited between check and kill
          }
        }
      }
    }, KILL_GRACE_PERIOD_MS);
    killTimer.unref();
  }
  console.error("[MCP Tools] All child processes terminated");
}

/**
 * Get count of active child processes tracked for shutdown
 */
export function getActiveProcessCount(): number {
  return activeProcesses.size;
}

/**
 * Get count of active operations (in-flight tool calls)
 */
export function getActiveOperationCount(): number {
  return activeOperationCount;
}

/**
 * Get the current queue size and limit for backpressure reporting.
 */
export function getQueueStatus(): { queued: number; maxQueue: number } {
  return { queued: slotWaiters.length, maxQueue: MAX_QUEUE_SIZE };
}

/**
 * Test-only exports for concurrency slot logic.
 * Exported to enable unit testing of acquireSlot/releaseSlot behavior.
 */
export const _testConcurrency = {
  acquireSlot,
  releaseSlot,
  getSlotWaiterCount: () => slotWaiters.length,
  setMaxConcurrent: (n: number) => {
    // Test-only escape hatch: bypasses type safety to mutate config directly.
    // Will break if config is ever frozen or made readonly.
    (config as Record<string, unknown>).maxConcurrentOperations = n;
  },
  reset: () => {
    activeOperationCount = 0;
    slotWaiters.length = 0;
  },
  // Upper bound is intentionally generous — backpressure logic begins to
  // amortize poorly past a few thousand queued waiters; 10_000 is a sanity
  // ceiling that catches typos (e.g., setting size to 1e9) without
  // constraining any realistic stress test.
  setMaxQueueSize: (n: number) => {
    if (!Number.isInteger(n) || n < 1 || n > 10_000) {
      throw new Error(`setMaxQueueSize: value must be an integer in [1, 10000], got ${n}`);
    }
    MAX_QUEUE_SIZE = n;
  },
  getMaxQueueSize: () => MAX_QUEUE_SIZE,
};

```

### Core Architecture Module: `.claude/skills/src/spawn-utils.ts`
```
/**
 * Common process spawning utility with timeout and output collection.
 *
 * Consolidates the SIGTERM → SIGKILL cascade, output truncation,
 * and timer cleanup shared by executor.ts, duckdb.ts, and parquet-bridge.ts.
 */

import { spawn, type ChildProcess, type StdioOptions } from "child_process";
import { KILL_GRACE_PERIOD_MS, DEFAULT_MAX_OUTPUT_SIZE } from "./tool-constants.js";

/** Options for {@link spawnWithTimeout}. */
export interface SpawnWithTimeoutOptions {
  /** Binary to execute. */
  binary: string;
  /** Command-line arguments. */
  args: string[];
  /** Working directory for the child process. */
  cwd?: string;
  /** Timeout in milliseconds. */
  timeoutMs: number;
  /** Data to write to stdin. If undefined stdin is set to "ignore". */
  stdin?: string | Buffer;
  /** Whether to capture stdout (default: true). When false, stdout is "ignore". */
  captureStdout?: boolean;
  /** Max bytes to collect from stdout before truncating (default: 50 MB). */
  maxStdoutSize?: number;
  /** Message appended to stdout when truncated. */
  stdoutTruncationMsg?: string;
  /** Max bytes to collect from stderr before truncating (default: 50 MB). */
  maxStderrSize?: number;
  /** Called immediately after spawn (e.g. to add to activeProcesses). */
  onSpawn?: (proc: ChildProcess) => void;
  /** Called when the process closes or errors (e.g. to remove from activeProcesses). */
  onExit?: (proc: ChildProcess) => void;
}

/** Raw result from {@link spawnWithTimeout}. Callers map this to their own types. */
export interface SpawnResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Spawn a child process with a timeout and SIGTERM → SIGKILL cascade.
 *
 * Returns a raw result; callers decide whether to resolve/reject, map exit
 * codes, or attach metadata based on their needs.
 */
export function spawnWithTimeout(options: SpawnWithTimeoutOptions): Promise<SpawnResult> {
  const {
    binary,
    args,
    cwd,
    timeoutMs,
    stdin,
    captureStdout = true,
    maxStdoutSize = DEFAULT_MAX_OUTPUT_SIZE,
    stdoutTruncationMsg = "\n\n[OUTPUT TRUNCATED - Result too large.]\n",
    maxStderrSize = DEFAULT_MAX_OUTPUT_SIZE,
    onSpawn,
    onExit,
  } = options;

  const stdinMode = stdin !== undefined ? "pipe" : "ignore";
  const stdoutMode = captureStdout ? "pipe" : "ignore";
  const stdio: StdioOptions = [stdinMode, stdoutMode, "pipe"];

  return new Promise((resolve) => {
    const proc = spawn(binary, args, { stdio, cwd });

    onSpawn?.(proc);

    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let processExited = false;  // guards SIGKILL after SIGTERM
    let finalized = false;      // ensures finish() runs exactly once
    let timer: ReturnType<typeof setTimeout> | null = null;
    let killTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (killTimer) { clearTimeout(killTimer); killTimer = null; }
    };

    // ── Timeout: SIGTERM → grace period → SIGKILL ──────────────────────
    timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      killTimer = setTimeout(() => {
        if (!processExited && proc.exitCode === null) {
          try { proc.kill("SIGKILL"); } catch { /* may have exited between check and kill */ }
          proc.unref();
        }
      }, KILL_GRACE_PERIOD_MS);
    }, timeoutMs);

    // ── stdin ───────────────────────────────────────────────────────────
    if (stdin !== undefined) {
      proc.stdin!.on("error", (err) => {
        // EPIPE is expected if the child exits before consuming all input.
        const msg = err?.message ?? String(err);
        stderr += `\n[STDIN ERROR] ${msg}`;
      });
      proc.stdin!.write(stdin);
      proc.stdin!.end();
    }

    // ── stdout collection ──────────────────────────────────────────────
    if (captureStdout) {
      proc.stdout!.on("data", (chunk) => {
        const data = chunk.toString();
        if (stdout.length + data.length > maxStdoutSize) {
          if (!stdoutTruncated) {
            stdoutTruncated = true;
            stdout += stdoutTruncationMsg;
          }
          return;
        }
        stdout += data;
      });
    }

    // ── stderr collection ──────────────────────────────────────────────
    proc.stderr!.on("data", (chunk) => {
      const data = chunk.toString();
      if (stderr.length + data.length > maxStderrSize) {
        if (!stderrTruncated) {
          stderrTruncated = true;
          stderr = stderr.slice(0, maxStderrSize) + "\n[STDERR TRUNCATED]";
        }
        return;
      }
      stderr += data;
    });

    // Shared finalizer: clears timers, calls onExit exactly once, resolves once.
    const finish = (result: SpawnResult) => {
      if (finalized) return;
      finalized = true;
      processExited = true;
      clearTimers();
      onExit?.(proc);
      resolve(result);
    };

    // ── close ──────────────────────────────────────────────────────────
    proc.on("close", (exitCode, signal) => {
      finish({ exitCode, signal, stdout, stderr, timedOut });
    });

    // ── spawn error (e.g. ENOENT) ──────────────────────────────────────
    proc.on("error", (err) => {
      // Surface the error in stderr so callers can inspect it uniformly.
      const msg = err?.message ?? String(err);
      finish({ exitCode: null, signal: null, stdout, stderr: stderr + `\n[SPAWN ERROR] ${msg}`, timedOut: false });
    });
  });
}

```

### Core Architecture Module: `.claude/skills/src/utils.ts`
```
/**
 * Shared utility functions for QSV MCP Server
 */

/**
 * Extract a human-readable message from an unknown error.
 * Use in catch blocks: `catch (error: unknown) { getErrorMessage(error) }`
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Strip absolute filesystem paths from an error message before returning
 * it to the MCP client. Replaces `/Users/foo/bar/file.csv` or
 * `C:\Users\foo\file.csv` with just the basename to avoid leaking
 * system paths in protocol responses.
 *
 * Note: paths containing spaces (e.g. `/Users/foo/my docs/file.csv`)
 * are only partially matched — the regex stops at whitespace. This is
 * acceptable because qsv itself doesn't handle space-paths reliably.
 */
export function sanitizeErrorForClient(message: string): string {
  // Unix absolute paths: /foo/bar/baz.ext → baz.ext
  // Windows absolute paths: C:\foo\bar\baz.ext → baz.ext
  return message.replace(
    /(?:[A-Za-z]:\\|\/)[^\s:,"']+/g,
    (match) => {
      const trimmedMatch = match.replace(/[/\\]+$/g, "");
      const parts = trimmedMatch.split(/[/\\]/);
      return parts[parts.length - 1] || trimmedMatch || match;
    },
  );
}

/**
 * Type guard to check if an error is a NodeJS.ErrnoException (has a `code` property).
 * Use in catch blocks: `if (isNodeError(err) && err.code === 'ENOENT') { ... }`
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

/**
 * MCP tool result helpers to eliminate repetitive { content: [{ type: "text"... }] } boilerplate
 */
export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

export function successResult(text: string) {
  return { content: [{ type: "text" as const, text }], isError: false as const };
}

/**
 * Build a structured response for a completed directory-set operation.
 * Used when the App UI should show a minimal confirmation instead of the full picker.
 */
export function completedDirResult(text: string, path: string) {
  return {
    content: [{ type: "text" as const, text }],
    isError: false as const,
    structuredContent: {
      completed: true,
      currentPath: path,
    },
  };
}

/**
 * Compare two semantic version strings.
 * Strips pre-release (-alpha.1) and build metadata (+build.123) before comparing.
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2.
 * Returns NaN if either version string is unparsable.
 */
export function compareVersions(v1: string, v2: string): number {
  // Strip pre-release and build metadata (e.g., "1.2.3-alpha.1+build" -> "1.2.3")
  const strip = (v: string) => v.replace(/[-+].*$/, "");
  const parts1 = strip(v1).split(".").map(Number);
  const parts2 = strip(v2).split(".").map(Number);

  // Validate that all parts are valid numbers
  if (parts1.some(isNaN) || parts2.some(isNaN)) {
    console.warn(
      `[Utils] Invalid version format: "${v1}" or "${v2}" - returning NaN`,
    );
    return NaN;
  }

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }
  return 0;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits required to change one string into the other
 */
export function levenshteinDistance(str1: string, str2: string): number {
  // Normalize strings to lowercase for case-insensitive comparison
  const a = str1.toLowerCase();
  const b = str2.toLowerCase();

  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find files that are similar to the target filename using fuzzy matching
 * Returns files sorted by similarity (most similar first)
 */
export function findSimilarFiles(
  target: string,
  availableFiles: Array<{ name: string; description?: string }>,
  maxResults: number = 5,
): Array<{ name: string; distance: number }> {
  const results = availableFiles.map((file) => ({
    name: file.name,
    distance: levenshteinDistance(target, file.name),
  }));

  // Sort by distance (lower is better)
  results.sort((a, b) => a.distance - b.distance);

  // Return top matches
  return results.slice(0, maxResults);
}

/**
 * Find the --output path from a CLI args array.
 * Handles both `["--output", "path"]` (two elements) and `["--output=path"]` (single element) forms.
 * Returns the path string, or empty string if not found.
 */
export function findOutputPath(args: string[]): string {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && i + 1 < args.length) {
      return args[i + 1];
    }
    if (args[i].startsWith("--output=")) {
      return args[i].slice("--output=".length);
    }
  }
  return "";
}

/**
 * Build a fallback result message for describegpt when stdout is empty.
 * Points the user to the output file where describegpt persisted its results.
 */
export function describegptFallbackResult(args: string[]): string {
  const outputPath = findOutputPath(args);
  return outputPath
    ? `describegpt output written to: ${outputPath}`
    : "describegpt completed but produced no output.";
}

/**
 * Reserved cache file suffixes that must not be used as --output targets.
 * These are auto-generated sidecar files managed by qsv's smart commands.
 */
const RESERVED_CACHE_SUFFIXES = [
  ".stats.csv",
  ".stats.csv.data.jsonl",
  ".stats.bivariate.csv",
  ".stats.bivariate.joined.csv",
  ".freq.csv.data.jsonl",
  ".pschema.json",
];

/**
 * Check if a file path matches a reserved cache file pattern.
 * These files are auto-generated by qsv and should not be overwritten via --output.
 */
export function isReservedCachePath(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return RESERVED_CACHE_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

/**
 * Build a user-facing error message for reserved cache path violations.
 * Derives the suffix list from RESERVED_CACHE_SUFFIXES to stay in sync.
 */
export function reservedCachePathError(outputPath: string): string {
  const suffixList = RESERVED_CACHE_SUFFIXES.join(", ");
  return (
    `Output path "${outputPath}" matches a reserved cache file pattern. ` +
    `Files ending in ${suffixList} are auto-managed by qsv. Use a different output path.`
  );
}

```

### Core Architecture Module: `.claude/skills/src/wink-nlp-utils.d.ts`
```
/**
 * Type declarations for wink-nlp-utils
 */

declare module "wink-nlp-utils" {
  interface StringFunctions {
    lowerCase: (input: string) => string;
    upperCase: (input: string) => string;
    removeExtraSpaces: (input: string) => string;
    removePunctuations: (input: string) => string;
    removeHTMLTags: (input: string) => string;
    removeSPLCharacters: (input: string) => string;
    removeElisions: (input: string) => string;
    splitElisions: (input: string) => string;
    tokenize: (input: string) => string[];
    tokenize0: (input: string) => string[];
    trim: (input: string) => string;
    extractPersonsName: (input: string) => string[];
    extractRunOfCapitalWords: (input: string) => string[];
  }

  interface TokensFunctions {
    stem: (tokens: string[]) => string[];
    removeWords: (tokens: string[]) => string[];
    removePunctuations: (tokens: string[]) => string[];
    removeHyphens: (tokens: string[]) => string[];
    removeTerminalPeriod: (tokens: string[]) => string[];
    propagateNegations: (tokens: string[]) => string[];
    amplifyNegations: (tokens: string[]) => string[];
    bagOfWords: (tokens: string[]) => Record<string, number>;
    bigrams: (tokens: string[]) => string[];
    trigrams: (tokens: string[]) => string[];
    ngrams: (tokens: string[], n: number) => string[];
    phonetize: (tokens: string[]) => string[];
    soundex: (tokens: string[]) => string[];
    sow: (tokens: string[], size?: number) => number[];
  }

  interface HelperFunctions {
    index: () => Record<string, unknown>;
  }

  interface NLPUtils {
    string: StringFunctions;
    tokens: TokensFunctions;
    helper: HelperFunctions;
  }

  const nlp: NLPUtils;
  export = nlp;
}

```

### Core Architecture Module: `examples/viz/gen_northeast_states.py`
```
#!/usr/bin/env python3
"""Build examples/viz/northeast_states.{geojson,csv} from US Census Bureau data.

Eleven Northeast states -- MD, DE, PA, NJ, NY, CT, RI, MA, VT, NH, ME -- with real TIGER
boundaries, colored in the gallery by population density.

- northeast_states.geojson: the TIGERweb response, unmodified except for a deterministic
  feature sort and one-feature-per-line formatting. properties keeps STUSAB (matched by
  `--feature-id-key properties.STUSAB`), NAME (auto-detected for hover labels), AREALAND
  and AREAWATER.
- northeast_states.csv: state,people_per_sq_mi -- two columns, matching the sibling
  fixture us_state_stats.csv. Density is DERIVED (see below); it is not a published
  Census column.

people_per_sq_mi = POPESTIMATE2024 / (AREALAND / 2589988.110336)

AREALAND is TIGER land area in square meters, excluding water, so this is land-area
density -- the conventional definition. It stays auditable straight from the committed
fixtures: multiply a CSV density by the matching feature's properties.AREALAND (converted
to square miles) to recover the population.

Boundaries are requested with maxAllowableOffset=0.002 degrees, which is ArcGIS
server-side simplification. Full resolution is 4.9 MB -- far too heavy to commit and
pointless for a tile map. 0.002 lands at ~70 KB and still preserves Cape Cod, Long
Island, the Chesapeake and the Maine coast; 0.005 (33 KB) visibly coarsens all four.

Source & license
----------------
US Census Bureau TIGERweb, States layer:
https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0/query
  where=STUSAB IN ('MD','DE','PA','NJ','NY','CT','RI','MA','VT','NH','ME')
  outFields=STUSAB,NAME,AREALAND,AREAWATER  outSR=4326  f=geojson
  maxAllowableOffset=0.002

US Census Bureau Population Estimates, Vintage 2024 state totals:
https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/state/totals/NST-EST2024-ALLDATA.csv
  rows where SUMLEV == '040', field POPESTIMATE2024

Works of the US Census Bureau are US Government works in the PUBLIC DOMAIN under
17 U.S.C. section 105 -- attribution is NOT legally required. (Contrast gen_world_cities.py,
whose GeoNames input is CC BY 4.0 and *does* require it.) The sources are recorded anyway,
here and in examples/viz/README.md ("Data sources & licensing") and the repository-root
THIRD_PARTY_NOTICES.md -- keep all three in step if this script's inputs change.

Do NOT switch to api.census.gov: it now rejects keyless requests with "Missing Key". Both
URLs above are keyless static/REST endpoints, which is why this script self-fetches instead
of taking pre-downloaded paths the way gen_world_cities.py does.

Usage: gen_northeast_states.py [outdir]   (default: this script's directory)
"""
import csv
import io
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# USPS code -> Census "NAME", which is how the population CSV keys its rows.
STATES = {
    "CT": "Connecticut",
    "DE": "Delaware",
    "MA": "Massachusetts",
    "MD": "Maryland",
    "ME": "Maine",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NY": "New York",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "VT": "Vermont",
}

SQ_METERS_PER_SQ_MILE = 2589988.110336

TIGERWEB = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
    "State_County/MapServer/0/query"
)
# ArcGIS server-side generalization, in degrees. See the module docstring.
MAX_ALLOWABLE_OFFSET = 0.002

POPEST = (
    "https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/"
    "state/totals/NST-EST2024-ALLDATA.csv"
)
POP_FIELD = "POPESTIMATE2024"
STATE_SUMLEV = "040"


def fetch(url, params=None):
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=120) as resp:  # noqa: S310
        return resp.read()


def fetch_boundaries():
    codes = ",".join(f"'{c}'" for c in sorted(STATES))
    raw = fetch(
        TIGERWEB,
        {
            "where": f"STUSAB IN ({codes})",
            "outFields": "STUSAB,NAME,AREALAND,AREAWATER",
            "returnGeometry": "true",
            "maxAllowableOffset": MAX_ALLOWABLE_OFFSET,
            "outSR": "4326",
            "f": "geojson",
        },
    )
    fc = json.loads(raw)
    if "features" not in fc:
        sys.exit(f"TIGERweb returned no features: {str(fc)[:200]}")
    feats = fc["features"]

    # ArcGIS does not guarantee result ordering, so sort for byte-stable re-runs.
    feats.sort(key=lambda f: f["properties"]["STUSAB"])

    got = [f["properties"]["STUSAB"] for f in feats]
    if sorted(got) != sorted(STATES):
        sys.exit(f"expected {sorted(STATES)}, got {sorted(got)}")
    # qsv auto-detects the hover label by probing properties.name/NAME/... on the FIRST
    # feature only, so a single feature missing NAME would silently downgrade every label.
    missing = [f["properties"]["STUSAB"] for f in feats if not f["properties"].get("NAME")]
    if missing:
        sys.exit(f"features missing NAME: {missing}")
    return feats


def fetch_population():
    text = fetch(POPEST).decode("utf-8-sig")
    pop = {}
    for row in csv.DictReader(io.StringIO(text)):
        if row["SUMLEV"] == STATE_SUMLEV:
            pop[row["NAME"]] = int(row[POP_FIELD])
    missing = [n for n in STATES.values() if n not in pop]
    if missing:
        sys.exit(f"population missing for: {missing}")
    return pop


def write_geojson(path, feats):
    """One feature per line: compact enough for a 70 KB fixture, still diff-readable."""
    lines = [",\n".join("    " + json.dumps(f, separators=(",", ":")) for f in feats)]
    path.write_text(
        '{\n  "type": "FeatureCollection",\n  "features": [\n'
        + lines[0]
        + "\n  ]\n}\n"
    )


def main():
    outdir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent
    feats = fetch_boundaries()
    pop = fetch_population()

    rows = []
    for f in feats:
        p = f["properties"]
        code = p["STUSAB"]
        sq_mi = int(p["AREALAND"]) / SQ_METERS_PER_SQ_MILE
        rows.append((code, pop[STATES[code]] / sq_mi))
    # densest first, so the fixture self-documents the spread
    rows.sort(key=lambda r: -r[1])

    gj = outdir / "northeast_states.geojson"
    write_geojson(gj, feats)

    csv_path = outdir / "northeast_states.csv"
    with csv_path.open("w", newline="") as fh:
        # LF, not csv's default CRLF, to match the other committed fixtures
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(["state", "people_per_sq_mi"])
        for code, density in rows:
            w.writerow([code, f"{density:.1f}"])

    print(f"wrote {gj} ({gj.stat().st_size:,} bytes, {len(feats)} features)")
    print(f"wrote {csv_path} ({len(rows)} rows)")
    for code, density in rows:
        print(f"  {code}  {density:>8.1f}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/viz/gen_tristate_county_incidents.py`
```
#!/usr/bin/env python3
"""Build examples/viz/tristate_county_incidents.csv + tristate_counties.geojson.

SYNTHETIC incidents on REAL counties.

The gallery's sibling figure (district_requests.csv + district_boundaries.geojson) teaches
the count-vs-rate fallacy on six hand-drawn rectangles in a Kansas field. This fixture
teaches the same lesson on geography a reader recognizes: the 210 counties of Ohio,
Pennsylvania and West Virginia (88 + 67 + 55), keyed by real 5-digit county FIPS.

What is real and what is not
----------------------------
REAL:  the county GEOIDs, names and boundaries (TIGERweb, written to
       tristate_counties.geojson beside the CSV), and the population the rate panel divides
       by (ACS 5-year B01003, fetched by `--denominator census@2024`).
FAKE:  the incident rows themselves. There is no real tri-state incident feed behind this;
       the counts are DERIVED from the real populations by the formula below.

Why derived rather than random: the figure's whole claim is "the count map is a population
map, and dividing by population inverts the ranking". A reader must be able to check that.
With this script the check is mechanical -- rerun it and diff.

count_i = round(acs_pop_i * rate_i / 1000)

    rate_i  = base_i * (0.85 + 0.30 * h_i)          # per 1,000 residents
    base_i  = R_HI - (R_HI - R_LO) * (i / (N - 1))  # i = rank ASCENDING by population
    h_i     = blake2b(fips) / 2**64                 # deterministic per-county wobble

So the smallest county gets the highest base rate and the largest the lowest, with a +/-15%
hash-derived wobble so the anti-correlation is not a suspiciously perfect straight line.
blake2b keyed on the FIPS (not random) is what makes re-runs byte-identical.

The spread is deliberate: population across these 210 counties spans ~100x while the rate
spans only 4x, so raw COUNT still tracks population -- the count choropleth genuinely is a
population map -- while the RATE choropleth cleanly inverts the top of the ranking. The
script asserts that inversion (top-10-by-count and top-10-by-rate must not overlap) rather
than trusting it.

There is deliberately NO numeric column in the output. `viz smart` will chart any
role=measure column as a third map panel, and this figure must show exactly two: count and
rate. It also carries no population column -- the point is that the denominator is FETCHED,
not shipped, so a committed copy would only invite a mismatched comparison.

ACS_VINTAGE below MUST stay in step with `--denominator census@2024` in gen_gallery.py.
The committed counts are computed against that release; divide them by a different one and
the caption's numbers stop reproducing.

Source & license
----------------
US Census Bureau TIGERweb, Counties layer (keyless):
https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query
  where=STATE IN ('39','42','54')  outFields=GEOID,NAME  outSR=4326  f=geojson
  maxAllowableOffset=0.001   (server-side generalization; see fetch_boundaries)

US Census Bureau Data API, ACS 5-year detailed tables, total population:
https://api.census.gov/data/2024/acs/acs5?get=B01003_001E,NAME&for=county:*&in=state:NN

Works of the US Census Bureau are US Government works in the PUBLIC DOMAIN under
17 U.S.C. section 105. The generated incident rows are ours, MIT-licensed with qsv.

NOTE, and this is the one place this script contradicts its sibling: gen_northeast_states.py
says "Do NOT switch to api.census.gov: it now rejects keyless requests". That advice holds
for the POPULATION ESTIMATES it uses, which are published as keyless static CSVs. It does
NOT hold here -- ACS table B01003 is published ONLY on the Data API, so a key is genuinely
required. Set QSV_CENSUS_API_KEY (free: https://api.census.gov/data/key_signup.html).
Only this script and a COLD `--denominator census` cache need it; once
~/.qsv-cache/viz-denominators is warm, `qsv viz` makes no request and needs no key.

Usage: gen_tristate_county_incidents.py [outdir]   (default: this script's directory)
"""
import csv
import hashlib
import json
import os
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# Ohio, Pennsylvania, West Virginia. Contiguous, and together they read unmistakably as a
# map -- Lake Erie along the top, the West Virginia panhandles, the Ohio River.
STATE_FIPS = {"39": "OH", "42": "PA", "54": "WV"}
EXPECTED_COUNTIES = 210  # 88 OH + 67 PA + 55 WV

# Keep in step with `--denominator census@2024` in gen_gallery.py. See the docstring.
ACS_VINTAGE = 2024

# Per-1,000-resident incident rate at the extremes of the population ranking. R_HI applies
# to the LEAST populous county, R_LO to the most. The 4x spread is small next to the ~100x
# population spread, which is exactly what keeps raw count tracking population.
R_LO = 0.6
R_HI = 2.4
WOBBLE_LO = 0.85
WOBBLE_SPAN = 0.30

TIGERWEB_COUNTIES = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
    "State_County/MapServer/1/query"
)
# ArcGIS server-side generalization, in degrees. See fetch_boundaries().
MAX_ALLOWABLE_OFFSET = 0.001

ACS_ROOT = "https://api.census.gov/data"
ACS_POPULATION_TABLE = "B01003_001E"

# Cycled per county so every county carries a spread of both dimensions. Six types x three
# severities = 18 combinations; counties get 8+ rows each, so the smallest still shows
# several. Cycled rather than sampled to keep the file deterministic.
INCIDENT_TYPES = [
    "Road obstruction",
    "Downed line",
    "Water main",
    "Signal outage",
    "Debris",
    "Flooding",
]
SEVERITIES = ["Minor", "Moderate", "Severe"]


# api.census.gov returns transient 503s under load -- observed repeatedly while building this
# fixture, on the same URL that had just succeeded. Retry with backoff rather than failing the
# whole generation; a real outage still surfaces after the last attempt.
FETCH_ATTEMPTS = 5
FETCH_BACKOFF_SECS = 3


def fetch(url, params=None):
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    last = None
    for attempt in range(1, FETCH_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(url, timeout=60) as resp:  # noqa: S310
                return resp.read()
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            last = exc
            if attempt == FETCH_ATTEMPTS:
                break
            wait = FETCH_BACKOFF_SECS * attempt
            print(f"  retry {attempt}/{FETCH_ATTEMPTS - 1} after {exc} "
                  f"(sleeping {wait}s)", file=sys.stderr)
            time.sleep(wait)
    sys.exit(f"giving up on {url.split('?')[0]} after {FETCH_ATTEMPTS} attempts: {last}")


def fetch_boundaries():
    """The 210 county polygons, server-simplified, as a GeoJSON FeatureCollection.

    Simplification is not optional here. At full resolution TIGERweb returns 17.8 MB for
    these three states, and `viz smart` embeds the geometry once PER CHOROPLETH TRACE -- this
    figure has two (count and rate), so an unsimplified build inlines ~34 MB into
    gallery.html and roughly triples the committed page. maxAllowableOffset is ArcGIS
    server-side generalization, in degrees. Measured against this exact query:

        offset  0      17.81 MB
        offset  0.001   0.36 MB   <- chosen
        offset  0.002   0.23 MB
        offset  0.005   0.12 MB

    0.001 buys a ~50x reduction and is the conservative pick for COUNTY-sized features.
    Compare gen_northeast_states.py, which picks 0.002 for eleven whole states: coarser
    features tolerate a coarser offset, so do not copy that number here without re-checking
    how the small eastern-Ohio counties render.
    """
    codes = ",".join(f"'{s}'" for s in sorted(STATE_FIPS))
    raw = fetch(
        TIGERWEB_COUNTIES,
        {
            "where": f"STATE IN ({codes})",
            "outFields": "GEOID,NAME",
            "returnGeometry": "true",
            "maxAllowableOffset": MAX_ALLOWABLE_OFFSET,
            "outSR": "4326",
            "f": "geojson",
        },
    )
    fc = json.loads(raw)
    if "features" not in fc:
        sys.exit(f"TIGERweb returned no features: {str(fc)[:300]}")
    # ArcGIS does not guarantee result ordering, so sort for byte-stable re-runs.
    fc["features"].sort(key=lambda f: f["properties"]["GEOID"])
    return fc


def emit_geojson(fc, path):
    """One feature per line so a re-run diffs readably rather than as one giant line."""
    with open(path, "w", encoding="utf-8") as fh:
        fh.write('{"type":"FeatureCollection","features":[\n')
        for i, feat in enumerate(fc["features"]):
            fh.write(json.dumps(feat, separators=(",", ":"), sort_keys=True))
            fh.write(",\n" if i < len(fc["features"]) - 1 else "\n")
        fh.write("]}\n")


def fetch_population(key):
    """GEOID -> ACS 5-year total population, one keyed request per state."""
    out = {}
    for state in sorted(STATE_FIPS):
        raw = fetch(
            f"{ACS_ROOT}/{ACS_VINTAGE}/acs/acs5",
            {
                "get": ACS_POPULATION_TABLE,
                "for": "county:*",
                "in": f"state:{state}",
                "key": key,
            },
        )
        rows = json.loads(raw)
        header, body = rows[0], rows[1:]
        pop_i = header.index(ACS_POPULATION_TABLE)
        st_i, cty_i = header.index("state"), header.index("county")
        for row in body:
            geoid = f"{row[st_i]:0>2}{row[cty_i]:0>3}"
            out[geoid] = int(row[pop_i])
    return out


def wobble(fips):
    """Deterministic per-county multiplier in [0.85, 1.15). Hashed from the FIPS so a
    re-run reproduces the CSV byte for byte."""
    digest = hashlib.blake2b(fips.encode(), digest_size=8).digest()
    unit = int.from_bytes(digest, "big") / 2**64
    return WOBBLE_LO + WOBBLE_SPAN * unit


def build_counts(names, pops):
    """[(fips, name, state, population, count, rate_per_1k)], ranked asc
```

### Core Architecture Module: `src/cmd/profile/formula_engine.rs`
```
//! Native Rust formula engine for `qsv profile`.
//!
//! Evaluates the spec's `formula` / `suggestion_formula` templates against
//! the qsv-built analysis context using `minijinja` as the template engine.
//! Helpers (filters + globals) live in `formula_helpers.rs` and are ported
//! from DP+'s `jinja2_helpers.py`.
//!
//! Replaces the previous PyO3-based `py_engine.rs` so `qsv profile` no
//! longer requires a host Python interpreter or the `jinja2` package.
//! External API (`evaluate_spec`, `FormulaResult`) is preserved bit-for-bit
//! so the rest of the profile pipeline (`profile.rs::run`,
//! `merge_formula_results`) is untouched.

use minijinja::Environment;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[cfg(test)]
use super::spec;
use super::{formula_helpers, spec::Spec, sql_backend::SqlBackend};
use crate::CliResult;

/// One formula extracted from a scheming Field, ready to evaluate.
#[derive(Debug, Serialize)]
struct FormulaSpec<'a> {
    field_name: &'a str,
    /// `"formula"` or `"suggestion_formula"`.
    kind:       &'static str,
    /// `"dataset"` or `"resource"`.
    scope:      &'static str,
    template:   &'a str,
}

/// One result entry returned from formula evaluation.
///
/// The `_traceback` field is populated only when a formula render fails;
/// the underscore prefix mirrors the Python convention preserved across
/// the serde round-trip via explicit rename for wire-shape stability.
#[derive(Debug, Deserialize, Serialize)]
pub struct FormulaResult {
    pub field_name: String,
    pub kind:       String,
    pub scope:      String,
    pub value:      Option<Value>,
    pub error:      Option<String>,
    #[serde(
        rename = "_traceback",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub traceback:  Option<String>,
}

/// Evaluate every `formula` / `suggestion_formula` in `spec` against
/// `context`. Returns one `FormulaResult` per template encountered.
/// If the spec has no formulas, returns `Ok(vec![])` without building
/// the template environment.
///
/// `sql_backend`, when provided, installs a Polars-backed SQL backend so
/// the SQL-requiring helpers (`temporal_resolution`,
/// `guess_accrual_periodicity`) can query the input CSV. Callers build
/// the backend so they can apply the profile's CSV parsing options
/// (delimiter, header presence). The backend is uninstalled before this
/// function returns.
///
/// Errors during render are NOT fatal — they surface as `error` strings
/// on the corresponding entry, so a failing formula in one field does
/// not abort the whole profile pass.
pub fn evaluate_spec(
    spec: &Spec,
    context: &Value,
    sql_backend: Option<SqlBackend>,
) -> CliResult<Vec<FormulaResult>> {
    // 1. flatten spec into a Vec<FormulaSpec>
    let mut formulas: Vec<FormulaSpec> = Vec::new();
    for f in spec.real_dataset_fields() {
        push_if_some(&mut formulas, f, "dataset");
    }
    for f in spec.real_resource_fields() {
        push_if_some(&mut formulas, f, "resource");
    }
    if formulas.is_empty() {
        return Ok(Vec::new());
    }

    // 2. install the SQL backend for the duration of this call.
    formula_helpers::set_sql_backend(sql_backend);

    // 3. build the minijinja environment with all helpers registered.
    let mut env = Environment::new();
    formula_helpers::register(&mut env);

    // 4. convert the context JSON Value into a minijinja Value once.
    let mj_context = minijinja::Value::from_serialize(context);

    // 5. evaluate each formula
    let mut out: Vec<FormulaResult> = Vec::with_capacity(formulas.len());
    for f in formulas {
        let mut entry = FormulaResult {
            field_name: f.field_name.to_string(),
            kind:       f.kind.to_string(),
            scope:      f.scope.to_string(),
            value:      None,
            error:      None,
            traceback:  None,
        };
        match render_template(&env, f.template, &mj_context) {
            Ok(rendered) => {
                let normalized = if f.kind == "suggestion_formula" {
                    normalize_suggestion(&rendered)
                } else {
                    Some(rendered)
                };
                entry.value = normalized.map(Value::String);
            },
            Err(err) => {
                entry.error = Some(format_minijinja_error(&err));
                entry.traceback = Some(format_minijinja_traceback(&err));
            },
        }
        out.push(entry);
    }

    // 6. clear the SQL backend so a later call without csv_path doesn't see stale state.
    formula_helpers::set_sql_backend(None);

    Ok(out)
}

/// Render a template source against the prebuilt context.
fn render_template(
    env: &Environment,
    template_src: &str,
    context: &minijinja::Value,
) -> Result<String, minijinja::Error> {
    let tmpl = env.template_from_str(template_src)?;
    tmpl.render(context)
}

/// Suggestion outputs are "soft" — a render that produces empty/whitespace
/// or the literal string `"None"` should surface as JSON `null` so
/// downstream consumers can treat "no useful suggestion" uniformly. Hard
/// `formula` results are left untouched: an explicit `""` may be the
/// intended value.
fn normalize_suggestion(value: &str) -> Option<String> {
    let stripped = value.trim();
    if stripped.is_empty() || stripped == "None" {
        None
    } else {
        Some(value.to_string())
    }
}

/// Short single-line error message — `TypeName: message`.
fn format_minijinja_error(err: &minijinja::Error) -> String {
    format!("{}: {}", err.kind(), err)
}

/// Multi-line debug traceback (minijinja captures source span + the
/// error chain). Mirrors Python's `traceback.format_exc(limit=2)` shape
/// so existing roborev regression test `_traceback round-trip` passes.
fn format_minijinja_traceback(err: &minijinja::Error) -> String {
    // {:#?} on a minijinja::Error includes the full chain + template
    // source location, which is what we want for diagnosis.
    format!("{err:#?}")
}

fn push_if_some<'a>(
    out: &mut Vec<FormulaSpec<'a>>,
    field: &'a super::spec::Field,
    scope: &'static str,
) {
    let Some(name) = field.field_name.as_deref() else {
        return;
    };
    if let Some(t) = field.formula.as_deref()
        && !t.trim().is_empty()
    {
        out.push(FormulaSpec {
            field_name: name,
            kind: "formula",
            scope,
            template: t,
        });
    }
    if let Some(t) = field.suggestion_formula.as_deref()
        && !t.trim().is_empty()
    {
        out.push(FormulaSpec {
            field_name: name,
            kind: "suggestion_formula",
            scope,
            template: t,
        });
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn normalize_suggestion_coerces_empty_and_none() {
        assert_eq!(normalize_suggestion(""), None);
        assert_eq!(normalize_suggestion("   \n  "), None);
        assert_eq!(normalize_suggestion("None"), None);
        assert_eq!(normalize_suggestion("  None  "), None);
        assert_eq!(normalize_suggestion("hello"), Some("hello".to_string()));
        assert_eq!(normalize_suggestion("none"), Some("none".to_string()));
    }

    #[test]
    fn empty_spec_returns_empty_results() {
        let spec =
            spec::load_from_str("scheming_version: 2\ndataset_type: test\n", "test").unwrap();
        let ctx = json!({});
        let results = evaluate_spec(&spec, &ctx, None).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn formula_with_undefined_var_renders_empty() {
        // minijinja's default Undefined behaves like Jinja2's default —
        // attribute access on a defined-but-empty object renders empty.
        let yaml = "
scheming_version: 2
dataset_type: test
dataset_fields:
  - field_name: greeting
    suggestion_formula: 'Hello {{ package.title }}'
";
        let spec = spec::load_from_str(yaml, "test").unwrap();
        let ctx = json!({"package": {}}); // package exists, title is undefined
        let results = evaluate_spec(&spec, &ctx, None).unwrap();
        assert_eq!(results.len(), 1);
        // "Hello " trimmed is "Hello" — non-empty, survives normalization.
        assert_eq!(
            results[0].value.as_ref().and_then(|v| v.as_str()),
            Some("Hello "),
            "got error: {:?}",
            results[0].error
        );
        assert!(results[0].error.is_none());
    }

    #[test]
    fn formula_error_surfaces_in_traceback() {
        let yaml = "
scheming_version: 2
dataset_type: test
dataset_fields:
  - field_name: bad
    suggestion_formula: '{{ undefined_function() }}'
";
        let spec = spec::load_from_str(yaml, "test").unwrap();
        let ctx = json!({});
        let results = evaluate_spec(&spec, &ctx, None).unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].error.is_some(), "expected error to be set");
        assert!(
            results[0].traceback.is_some(),
            "expected _traceback to be set"
        );
        assert!(results[0].value.is_none());
    }
}

```

### Core Architecture Module: `src/cmd/scoresql.rs`
```
pub(crate) static USAGE: &str = r#"
Analyze a SQL query against CSV file caches (stats, moarstats, frequency) to produce a
performance score with actionable optimization suggestions BEFORE running the query.

Accepts the same input/SQL arguments as sqlp. Outputs a human-readable performance report
(default) or JSON (--json). Supports Polars mode (default) and DuckDB mode (--duckdb).

Scoring factors include:
  * Query plan analysis (EXPLAIN output from Polars or DuckDB)
  * Type optimization (column types vs. usage in query)
  * Join key cardinality and data distribution
  * Filter selectivity from frequency cache
  * Query anti-pattern detection (SELECT *, missing LIMIT, cartesian joins, etc.)
  * Infrastructure checks (index files, cache freshness)

Caches are auto-generated when missing:
  * stats cache via `qsv stats --everything --stats-jsonl`
  * frequency cache via `qsv frequency --frequency-jsonl`

Examples:

  # Score a simple filter query against a single CSV file
  $ qsv scoresql data.csv "SELECT * FROM data WHERE col1 > 10"

  # Output the score report as JSON instead of the default human-readable format
  $ qsv scoresql --json data.csv "SELECT col1, col2 FROM data ORDER BY col1"

  # Score a join query across two CSV files
  $ qsv scoresql data.csv data2.csv "SELECT * FROM data JOIN data2 ON data.id = data2.id"

  # Use DuckDB for query plan analysis instead of Polars
  $ qsv scoresql --duckdb data.csv "SELECT * FROM data WHERE status = 'active'"

  # Use _t_N aliases just like sqlp (see sqlp documentation)
  $ qsv scoresql data.csv data2.csv "SELECT * FROM _t_1 JOIN _t_2 ON _t_1.id = _t_2.id"

  # Score a query from a SQL script file (only the last query is scored)
  $ qsv scoresql data.csv script.sql

For more examples, see https://github.com/dathere/qsv/blob/master/tests/test_scoresql.rs.
See also https://github.com/dathere/qsv/wiki/SQL-and-Polars#scoresql

Usage:
    qsv scoresql [options] <input>... <sql>
    qsv scoresql --help

scoresql arguments:
    input                     The CSV file/s to analyze. Use '-' for standard input.
                              If input is a directory, all files in the directory will
                              be read as input.
                              If the input is a file with a '.infile-list' extension,
                              the file will be read as a list of input files.

    sql                       The SQL query to score/analyze.
                              If the query ends with ".sql", it will be read as a
                              SQL script file, with single-line "--" comments stripped.
                              If the script has multiple queries separated by ";",
                              only the last non-empty query is scored.

scoresql options:
    --json                    Output results as JSON instead of human-readable report.
    --duckdb                  Use DuckDB for query plan analysis instead of Polars.
                              Uses the QSV_DUCKDB_PATH environment variable if set,
                              otherwise looks for "duckdb" in PATH.
    --try-parsedates          Automatically try to parse dates/datetimes and time.
    --infer-len <arg>         Number of rows to scan when inferring schema.
                              [default: 10000]
    --ignore-errors           Ignore errors when parsing CSVs.
    --truncate-ragged-lines   Truncate lines with more fields than the header.

Common options:
    -h, --help                Display this message
    -o, --output <file>       Write output to <file> instead of stdout.
    -d, --delimiter <arg>     The field delimiter for reading CSV data.
                              Must be a single character. [default: ,]
    -q, --quiet               Do not print informational messages to stderr.
"#;

use std::{
    borrow::Cow,
    env,
    fmt::Write as FmtWrite,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::Command,
    sync::OnceLock,
};

use foldhash::{HashMap, HashMapExt};
use polars::{prelude::*, sql::SQLContext};
use serde::{Deserialize, Serialize};

use crate::{CliResult, cmd::joinp::tsvssv_delim, config::Delimiter, util, util::process_input};

#[derive(Deserialize, Clone)]
struct Args {
    arg_input:                  Vec<PathBuf>,
    arg_sql:                    String,
    flag_json:                  bool,
    flag_duckdb:                bool,
    flag_try_parsedates:        bool,
    flag_infer_len:             usize,
    flag_ignore_errors:         bool,
    flag_truncate_ragged_lines: bool,
    flag_output:                Option<String>,
    flag_delimiter:             Option<Delimiter>,
    flag_quiet:                 bool,
}

// ── Scoring constants ──────────────────────────────────────────────────────

const MAX_SCORE: u32 = 100;
const WEIGHT_TYPE_OPT: u32 = 20;
const WEIGHT_JOIN_CARD: u32 = 20;
const WEIGHT_FILTER_SEL: u32 = 20;
const WEIGHT_DATA_DIST: u32 = 20;
const WEIGHT_PATTERNS: u32 = 20;

static DUCKDB_PATH: OnceLock<String> = OnceLock::new();

// remove full-line comments starting with "--"
// NOTE: inline trailing comments (e.g., `SELECT 1 -- comment`) are not stripped
static COMMENT_REGEX: std::sync::LazyLock<regex::Regex> =
    std::sync::LazyLock::new(|| regex::Regex::new(r"(?m)^\s*--.*$").unwrap());

// ── Output structs ─────────────────────────────────────────────────────────

#[derive(Serialize)]
struct ScoreReport {
    score:        u32,
    max_score:    u32,
    rating:       String,
    plan:         String,
    breakdown:    Vec<ScoreBreakdown>,
    suggestions:  Vec<String>,
    cache_status: CacheStatus,
}

#[derive(Serialize)]
struct ScoreBreakdown {
    category: String,
    score:    u32,
    max:      u32,
    detail:   String,
}

#[derive(Serialize)]
struct CacheStatus {
    stats_available:     Vec<String>,
    stats_missing:       Vec<String>,
    frequency_available: Vec<String>,
    frequency_missing:   Vec<String>,
    index_available:     Vec<String>,
    index_missing:       Vec<String>,
}

// ── Parsed SQL info ────────────────────────────────────────────────────────

struct SqlInfo {
    has_select_star:  bool,
    has_order_by:     bool,
    has_limit:        bool,
    has_join:         bool,
    has_where:        bool,
    has_subquery:     bool,
    where_columns:    Vec<String>,
    /// `(column, optional_literal)` pairs from `col OP literal` predicates in
    /// the WHERE clause. The literal is `Some` when the right-hand side is a
    /// quoted string, a number, or one of the SQL keyword literals
    /// `TRUE`/`FALSE`/`NULL`; bare identifiers are intentionally excluded so
    /// `a.x = b.y` doesn't masquerade as a value lookup. `None` is reserved
    /// for future predicate types where no literal can be extracted.
    ///
    /// Keyword vs string literals are tagged via [`WhereLiteral`] so that
    /// `WHERE col = NULL` and `WHERE col = 'NULL'` get different lookup
    /// semantics in `score_filter_selectivity` — the former matches empty
    /// frequency-cache cells, the latter only the literal string `"NULL"`.
    where_predicates: Vec<(String, Option<WhereLiteral>)>,
    join_columns:     Vec<String>,
    order_columns:    Vec<String>,
}

/// Distinguishes SQL keyword literals (`TRUE`/`FALSE`/`NULL`) from regular
/// values so `score_filter_selectivity` can normalize keyword forms (case-
/// insensitive match for booleans, empty-string match for nulls) without
/// affecting quoted strings whose payload happens to be the same word.
#[derive(Clone, Debug)]
enum WhereLiteral {
    /// SQL keyword: `TRUE`, `FALSE`, or `NULL`. Stored as upper-case canonical
    /// form so callers can match with `==`.
    Keyword(String),
    /// Quoted string (already un-escaped) or numeric literal. Compared with
    /// exact string equality against frequency-cache values.
    Value(String),
}

// ── Cache data per input file ──────────────────────────────────────────────

struct InputCacheData {
    file_path:      PathBuf,
    table_name:     String,
    stats:          Vec<crate::cmd::stats::StatsData>,
    has_freq_cache: bool,
    has_index:      bool,
    freq_entries:   Vec<FreqEntry>,
}

#[derive(Clone)]
#[allow(dead_code)]
struct FreqEntry {
    field:       String,
    cardinality: u64,
    frequencies: Vec<FreqValue>,
}

#[derive(Clone)]
#[allow(dead_code)]
struct FreqValue {
    value:      String,
    count:      u64,
    percentage: f64,
}

// ════════════════════════════════════════════════════════════════════════════
// run()
// ════════════════════════════════════════════════════════════════════════════

pub fn run(argv: &[&str]) -> CliResult<()> {
    let mut args: Args = util::get_args(USAGE, argv)?;

    let tmpdir = tempfile::tempdir()?;
    args.arg_input = process_input(args.arg_input, &tmpdir, "")?;

    if args.arg_input.is_empty() {
        return fail_incorrectusage_clierror!("No input files provided.");
    }

    let delim = if let Some(delimiter) = args.flag_delimiter {
        delimiter.as_byte()
    } else if let Ok(delim) = env::var("QSV_DEFAULT_DELIMITER") {
        Delimiter::decode_delimiter(&delim)?.as_byte()
    } else {
        b','
    };

    // ── 1. Resolve table names & aliases ───────────────────────────────────
    let mut table_aliases: HashMap<String, String> = HashMap::with_capacity(args.arg_input.len());
    let mut lossy_table_name = Cow::default();
    let mut table_name;
    let mut table_names: Vec<String> = Vec::with_capacity(args.arg_input.len());
    // O(1) duplicate-stem detection — `table_names.iter().position()` would be
    // O(n²) when scoring a directory expanded to many CSVs by `process_input`.
    // The map stores the first input index where each stem was seen so the
    // error message can still report both positions.
    let mut seen_stems: HashMap<String, usize> = HashMap::with_capacity(args.arg_input.len());

    for (idx, table) in args.arg_input.iter().enumerate() {
        table_name = Path::new(table)
      
```

### Core Architecture Module: `src/llmutil.rs`
```
//! Shared helpers for talking to OpenAI API-compatible Large Language Models (LLMs).
//!
//! This module centralizes the low-level HTTP plumbing for chat-completion requests so
//! multiple commands (e.g. `describegpt`, `apply summarize`) can share a single, tested
//! implementation instead of duplicating request-building and response-parsing logic.
//!
//! Higher-level concerns (prompt-file resolution, attribution placeholders, caching) stay
//! in the calling commands; this module only knows how to build a request, POST it to the
//! `/chat/completions` endpoint, and parse the response.

use std::time::Instant;

use reqwest::blocking::{Client, Response};
use serde_json::{Value, json};

use crate::{CliError, CliResult};

/// The parsed result of a chat-completion request.
#[allow(dead_code)]
#[derive(Debug, Default, Clone)]
pub struct LlmResponse {
    /// The completion text (`choices[0].message.content`).
    pub content:           String,
    /// Optional chain-of-thought/reasoning (`choices[0].message.reasoning`), empty if absent.
    pub reasoning:         String,
    pub prompt_tokens:     u64,
    pub completion_tokens: u64,
    pub total_tokens:      u64,
    /// Wall-clock time of the request in milliseconds.
    pub elapsed_ms:        u64,
}

/// Sends an HTTP request using the provided client and parameters.
///
/// # Arguments
///
/// * `client` - The HTTP client used to make the request
/// * `api_key` - Optional API key for authentication via Bearer token
/// * `request_data` - Optional JSON data to include in POST requests
/// * `method` - HTTP method to use ("GET" or "POST")
/// * `url` - The URL to send the request to
///
/// # Errors
///
/// Returns a `CliError` if an unsupported method is used, GET includes data, POST is missing
/// data, the request fails, or the response has a non-success status code.
pub fn send_request(
    client: &Client,
    api_key: Option<&str>,
    request_data: Option<&Value>,
    method: &str,
    url: &str,
) -> CliResult<Response> {
    // Build request based on method
    let mut request = match method {
        "GET" => {
            if request_data.is_some() {
                return fail_clierror!("GET requests cannot include request data");
            }
            client.get(url)
        },
        "POST" => {
            let Some(data) = request_data else {
                return fail_clierror!("POST requests require request data");
            };
            client
                .post(url)
                .header("Content-Type", "application/json")
                .body(data.to_string())
        },
        other => {
            let error_json = json!({ "Unsupported HTTP method": other });
            return fail_clierror!("{error_json}");
        },
    };

    // Add API key header if provided
    if let Some(key) = api_key
        && !key.is_empty()
    {
        request = request.header("Authorization", format!("Bearer {key}"));
    }

    // Send request and handle response
    let response = request.send()?;

    // Check for HTTP error status
    if !response.status().is_success() {
        let status = response.status();
        let output = response
            .text()
            .unwrap_or_else(|_| "Unable to read error response".to_string());
        return fail_clierror!("HTTP {status} error: {output}");
    }

    Ok(response)
}

/// Builds the JSON request body for a chat-completion call.
///
/// Constructs `{"model", "messages", "stream": false}`, includes `max_tokens` only when set
/// (omitted entirely when `None`, since some OpenAI-compatible servers reject a `null` value),
/// and overlays any additional model properties supplied as a JSON object string (`addl_props`).
///
/// # Errors
///
/// Returns a `CliError` if `addl_props` is not valid JSON or is not a JSON object.
pub fn build_request(
    model: &str,
    max_tokens: Option<u32>,
    messages: &Value,
    addl_props: Option<&str>,
) -> CliResult<Value> {
    let mut request_data = json!({
        "model": model,
        "messages": messages,
        "stream": false
    });

    // Only send max_tokens when explicitly set; a `null` value is rejected by some servers,
    // and "unset" is the documented meaning of --max-tokens 0 / localhost.
    if let Some(max_tokens) = max_tokens {
        request_data["max_tokens"] = json!(max_tokens);
    }

    if let Some(addl_props) = addl_props {
        let addl_props_json: Value = serde_json::from_str(addl_props)
            .map_err(|e| CliError::Other(format!("Invalid JSON in --addl-props: {e:?}")))?;

        // If addl_props_json is an object, extend/overlay all its keys into request_data
        if let Some(obj) = addl_props_json.as_object() {
            for (key, value) in obj {
                request_data[key] = value.clone();
            }
        } else {
            return fail_clierror!(
                "--addl-props should be a JSON object mapping keys to values; got: {}",
                addl_props_json
            );
        }
    }

    Ok(request_data)
}

/// Makes a chat-completion request to an OpenAI API-compatible endpoint.
///
/// POSTs to `{base_url}/chat/completions`, parses the completion text, optional reasoning,
/// and token-usage statistics.
///
/// # Errors
///
/// Returns a `CliError` if the request body is invalid, the HTTP request fails, the API
/// returns an error, or the response is missing required fields.
pub fn chat_completion(
    client: &Client,
    base_url: &str,
    api_key: &str,
    model: &str,
    max_tokens: Option<u32>,
    messages: &Value,
    addl_props: Option<&str>,
) -> CliResult<LlmResponse> {
    let request_data = build_request(model, max_tokens, messages, addl_props)?;

    if log::log_enabled!(log::Level::Trace) {
        log::trace!("Request data: {request_data:?}");
    }

    let start_time = Instant::now();
    // trim a trailing '/' so a base_url like ".../v1/" doesn't yield a double-slash path
    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let response = send_request(
        client,
        Some(api_key),
        Some(&request_data),
        "POST",
        &endpoint,
    )?;

    let response_json: Value = response.json()?;
    if log::log_enabled!(log::Level::Trace) {
        log::trace!("Response: {response_json:?}");
    }

    // If response is an error, surface the error message
    if let Value::Object(ref map) = response_json
        && map.contains_key("error")
    {
        return fail_clierror!("LLM API Error: {}", map["error"]);
    }

    let Some(content) = response_json["choices"]
        .get(0)
        .and_then(|choice| choice["message"]["content"].as_str())
    else {
        return fail_clierror!("Invalid response: missing or malformed completion content");
    };
    // Reasoning is optional - use empty string if not provided
    let reasoning = response_json["choices"]
        .get(0)
        .and_then(|choice| choice["message"]["reasoning"].as_str())
        .unwrap_or("");

    let Some(usage) = response_json["usage"].as_object() else {
        return fail_clierror!("Invalid response: missing or malformed usage");
    };
    let elapsed_ms = start_time.elapsed().as_millis() as u64;

    Ok(LlmResponse {
        content: content.to_string(),
        reasoning: reasoning.to_string(),
        prompt_tokens: usage["prompt_tokens"].as_u64().unwrap_or(0),
        completion_tokens: usage["completion_tokens"].as_u64().unwrap_or(0),
        total_tokens: usage["total_tokens"].as_u64().unwrap_or(0),
        elapsed_ms,
    })
}

```

### Core Architecture Module: `src/util.rs`
```
#[cfg(any(feature = "feature_capable", feature = "lite"))]
use std::borrow::Cow;
#[allow(unused_imports)]
use std::fmt::Write as _;
#[cfg(target_family = "unix")]
use std::os::unix::process::ExitStatusExt;
#[cfg(feature = "polars")]
use std::sync::Arc;
use std::{
    cmp::min,
    env, fs,
    fs::File,
    io::{BufRead, BufReader, BufWriter, Read, Write},
    path::{Path, PathBuf},
    process::Command,
    str,
    sync::OnceLock,
    time::{Duration, Instant, SystemTime},
};

use csv::ByteRecord;
use csv_index::RandomAccessSimple;
use docopt::{ArgvMap, Docopt, Value};
use filetime::FileTime;
use human_panic::setup_panic;
#[cfg(any(feature = "feature_capable", feature = "lite"))]
use indicatif::ProgressDrawTarget;
use indicatif::{HumanCount, ProgressBar, ProgressStyle};
use log::{info, log_enabled, warn};
#[cfg(feature = "polars")]
use polars::prelude::Schema;
use reqwest::Client;
use serde::de::DeserializeOwned;
#[cfg(any(feature = "feature_capable", feature = "lite"))]
use serde::de::{Deserialize, Deserializer, Error};
use sysinfo::System;
use zip::read::root_dir_common_filter;

#[cfg(feature = "polars")]
use crate::cmd::count::polars_count_input;
use crate::{
    CURRENT_COMMAND, CliError, CliResult, QsvExitCode,
    cmd::stats::{JsonTypes, STATSDATA_TYPES_MAP, StatsData},
    config,
    config::{
        Config, DEFAULT_RDR_BUFFER_CAPACITY, DEFAULT_WTR_BUFFER_CAPACITY, Delimiter, SpecialFormat,
        get_delim_by_extension, get_special_format,
    },
    select::SelectColumns,
};

#[macro_export]
macro_rules! regex_oncelock {
    ($re:literal $(,)?) => {{
        static RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
        #[allow(clippy::regex_creation_in_loops)] // false positive as we use oncelock
        RE.get_or_init(|| regex::Regex::new($re).expect("Invalid regex"))
    }};
}

// leave at least 20% of the available memory free
const DEFAULT_FREEMEMORY_HEADROOM_PCT: u8 = 20;

// safety margin for memory-aware chunking
// (uses 80% of available memory to leave headroom for system operations & other processes)
pub const SAFETY_MARGIN: f64 = 0.8;

const DEFAULT_BATCH_SIZE: usize = 50_000;

const DEFAULT_STATSCACHE_MODE: &str = "auto";

static ROW_COUNT: OnceLock<Option<u64>> = OnceLock::new();

static JOBS_TO_USE: OnceLock<usize> = OnceLock::new();

pub static QUIET_FLAG: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

// Set once at startup by `init_allocator_runtime()` when jemalloc's
// `background_thread` is successfully enabled (Linux; rejected on macOS). When
// true, jemalloc purges freed pages on background threads at no RSS cost, so the
// per-command page-retention lever (`retain_alloc_pages_for_aggregation`) is
// skipped to avoid paying its higher RSS for no additional benefit.
// Only read under the jemalloc-gated retain path / version string; harmless
// elsewhere.
#[allow(dead_code)]
pub static BACKGROUND_THREADS_ACTIVE: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

// only consumed by non-lite commands (describegpt, lens, python, luau)
#[cfg(not(feature = "lite"))]
pub static FILE_PATH_PREFIX: &str = "file:";

pub type ByteString = Vec<u8>;

#[allow(dead_code)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum StatsMode {
    Schema,
    /// Like `Schema`, but additionally computes quartiles (q1/median/q3)
    /// and mode. Used by `qsv profile` so its descriptive-statistics
    /// projection (e.g. the Croissant annotations) can surface the full
    /// extended stat set on a fresh run without a pre-built `--everything`
    /// stats cache.
    ProfileSchema,
    Frequency,
    FrequencyForceStats,
    #[cfg(feature = "polars")]
    PolarsSchema,
    Outliers,
    None,
}

#[allow(dead_code)]
#[derive(serde::Deserialize, Clone)]
pub struct SchemaArgs {
    pub flag_enum_threshold:  u64,
    pub flag_ignore_case:     bool,
    pub flag_strict_dates:    bool,
    pub flag_strict_formats:  bool,
    pub flag_pattern_columns: SelectColumns,
    pub flag_dates_whitelist: String,
    pub flag_prefer_dmy:      bool,
    pub flag_force:           bool,
    pub flag_stdout:          bool,
    pub flag_jobs:            Option<usize>,
    pub flag_polars:          bool,
    pub flag_no_headers:      bool,
    pub flag_delimiter:       Option<Delimiter>,
    pub arg_input:            Option<String>,
    pub flag_memcheck:        bool,
    pub flag_output:          Option<String>,
}

#[inline]
pub fn num_cpus() -> usize {
    num_cpus::get()
}

static QSV_PATH: OnceLock<String> = OnceLock::new();

pub const CARGO_BIN_NAME: &str = env!("CARGO_BIN_NAME");
pub const CARGO_PKG_VERSION: &str = env!("CARGO_PKG_VERSION");

const TARGET: &str = match option_env!("TARGET") {
    Some(target) => target,
    None => "Unknown_target",
};
const QSV_KIND: &str = match option_env!("QSV_KIND") {
    Some(kind) => kind,
    None => "installed",
};

#[cfg(feature = "polars")]
const QSV_POLARS_REV: &str = match option_env!("QSV_POLARS_REV") {
    Some(rev) => rev,
    None => "",
};

// Add constant for whitespace visualization
// the whitespace markers as as defined in
// https://doc.rust-lang.org/reference/whitespace.html
const WHITESPACE_MARKERS: &[(char, &str)] = &[
    // common whitespace markers other than space
    ('\t', "《→》"), // tab
    ('\n', "《¶》"), // newline
    ('\r', "《⏎》"), // carriage return
    // more obscure whitespace markers
    ('\u{000B}', "《⋮》"), // vertical tab
    ('\u{000C}', "《␌》"), // form feed
    // note: the horizontal tab (U+0009) is the same code point as '\t' above,
    // so it is intentionally not repeated here (the '\t' entry already covers it).
    ('\u{0085}', "《␤》"), // next line
    ('\u{200E}', "《␎》"), // left-to-right mark
    ('\u{200F}', "《␏》"), // right-to-left mark
    ('\u{2028}', "《␊》"), // line separator
    ('\u{2029}', "《␍》"), // paragraph separator
    // additional common whitespace markers beyond
    // https://doc.rust-lang.org/reference/whitespace.html
    ('\u{00A0}', "《⍽》"),     // non-breaking space
    ('\u{2003}', "《emsp》"),  // em space
    ('\u{2007}', "《figsp》"), // figure space
    ('\u{200B}', "《zwsp》"),  // zero width space
];

/// Render a duration in seconds as a compact, single-unit string: "28d", "6h", "45m", "3s".
///
/// Deliberately ONE unit, the largest that fits, and deliberately WORDLESS. Callers that want a
/// phrase build it around this ("last fetched {} ago"); callers that want a table cell use it
/// as-is. An earlier version baked the phrase in, which made it unusable as a column value.
///
/// Precision beyond one unit is noise for both consumers — the number exists to answer "do I
/// care?", not to be arithmetic. Days are the largest unit: `qsv get --older-than` also accepts
/// weeks on INPUT, but "28d" reads more plainly in a cache listing than "4w", and no caller
/// round-trips this back through that parser.
// `diskcache::rich`'s stale-refresh warning and `get cache-list`'s AGE column are the only
// callers, and both live under the `get` feature.
#[cfg(any(feature = "get", test))]
pub fn fmt_duration_compact(secs: i64) -> String {
    const MINUTE: i64 = 60;
    const HOUR: i64 = 60 * MINUTE;
    const DAY: i64 = 24 * HOUR;

    match secs {
        s if s >= DAY => format!("{}d", s / DAY),
        s if s >= HOUR => format!("{}h", s / HOUR),
        s if s >= MINUTE => format!("{}m", s / MINUTE),
        s => format!("{s}s"),
    }
}

pub fn reset_sigpipe() {
    cfg_select! {
        unix => unsafe {
            libc::signal(libc::SIGPIPE, libc::SIG_DFL);
        },
        _ => {},
    }
}

pub fn current_exe() -> CliResult<PathBuf> {
    let exe_path = std::env::current_exe()?;
    Ok(exe_path)
}

/// Visualizes whitespace characters in a string by replacing them with visible markers
///
/// This function takes a string and returns a new string where whitespace characters
/// are replaced with visible Unicode markers to make them easier to see.
///
/// # Arguments
///
/// * `s` - The input string to visualize whitespace in
///
/// # Returns
///
/// A new String with whitespace characters replaced by visible markers
///
/// # Behavior
///
/// - If the input string contains only spaces, each space is replaced with "《_》"
/// - For other whitespace characters (tab, newline, etc), uses markers defined in
///   `WHITESPACE_MARKERS`
/// - Non-whitespace characters are left unchanged
/// - For strings with mixed content, single spaces are preserved as-is
///
/// # Examples
///
/// ```
/// let s = "hello\tworld\n";
/// let vis = visualize_whitespace(s);
/// assert_eq!(vis, "hello《→》world《¶》");
///
/// let spaces = "   ";
/// let vis = visualize_whitespace(spaces);
/// assert_eq!(vis, "《_》《_》《_》");
/// ```
pub fn visualize_whitespace(s: &str) -> String {
    // Check if string is all spaces
    let is_all_spaces = s.chars().all(|c| c == ' ');

    let mut result = String::with_capacity(s.len() * 3);
    for c in s.chars() {
        if c == ' ' {
            if is_all_spaces {
                // Only use space marker if entire string is spaces
                result.push_str("《_》");
            } else {
                result.push(c);
            }
        } else if let Some((_, replacement)) = WHITESPACE_MARKERS.iter().find(|(ws, _)| *ws == c) {
            result.push_str(replacement);
        } else {
            result.push(c);
        }
    }
    result
}

/// Converts a byte slice to a `Cow<str>` for output formatting.
///
/// Uses SIMD-accelerated UTF-8 validation via `simdutf8::basic::from_utf8` on the
/// happy path (returns a borrowed `&str` with no allocation on valid UTF-8, which
/// is the overwhelming common case including all-ASCII).
///
/// Falls back to `String::from_utf8_lossy` only when the bytes are not valid
/// UTF-8 (replacement characters substituted, allocates).
///
/// This is faster than `String::from_utf8_lossy` alone, which always uses scalar
/// UTF-8 validation and pre-allocates a `String` of the input length.
#[i
```

### Core Architecture Module: `.claude/skills/examples/basic.js`
```
#!/usr/bin/env node
/**
 * Basic Skill Execution Example
 * Demonstrates loading and executing individual qsv skills
 */

import { SkillLoader, SkillExecutor } from '../dist/index.js';

async function main() {
  console.log('QSV Skills - Basic Execution Example');
  console.log('====================================\n');

  // Load skills
  const loader = new SkillLoader();
  await loader.loadAll();

  console.log(`Loaded ${loader.getAll().length} skills\n`);

  // Get skill statistics
  const stats = loader.getStats();
  console.log('Skill Statistics:');
  console.log(`  Total skills: ${stats.total}`);
  console.log(`  Total examples: ${stats.totalExamples}`);
  console.log(`  Total options: ${stats.totalOptions}`);
  console.log(`  Total arguments: ${stats.totalArgs}`);
  console.log('\nSkills by category:');
  Object.entries(stats.byCategory).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
  console.log();

  // Search for skills
  console.log('Searching for "duplicate" skills:');
  const duplicateSkills = loader.search('duplicate');
  duplicateSkills.forEach(skill => {
    console.log(`  - ${skill.name}: ${skill.description.substring(0, 60)}...`);
  });
  console.log();

  // Load a specific skill
  const selectSkill = await loader.load('qsv-select');
  if (selectSkill) {
    console.log('qsv-select skill:');
    console.log(`  Description: ${selectSkill.description.substring(0, 100)}...`);
    console.log(`  Examples: ${selectSkill.examples.length}`);
    console.log(`  Options: ${selectSkill.command.options.length}`);
    console.log(`  Category: ${selectSkill.category}`);
    console.log();

    // Show first 3 examples
    console.log('First 3 examples:');
    selectSkill.examples.slice(0, 3).forEach((ex, i) => {
      console.log(`  ${i + 1}. ${ex.description}`);
      console.log(`     ${ex.command}`);
    });
    console.log();
  }

  // Execute a skill (if qsv is installed)
  console.log('Testing skill execution...');
  const executor = new SkillExecutor();

  // Create sample CSV data
  const csvData = `name,age,city
Alice,30,NYC
Bob,25,LA
Charlie,35,Chicago
Alice,30,NYC
David,28,Boston`;

  try {
    // Execute qsv-dedup skill
    const dedupSkill = await loader.load('qsv-dedup');
    if (dedupSkill) {
      console.log('Executing qsv-dedup...');
      const result = await executor.execute(dedupSkill, {
        stdin: csvData
      });

      console.log(`  Success: ${result.success}`);
      console.log(`  Command: ${result.metadata.command}`);
      console.log(`  Duration: ${result.metadata.duration}ms`);
      console.log(`  Output rows: ${result.output.split('\\n').length - 1}`);
      console.log('  Output:');
      console.log(result.output.split('\\n').slice(0, 5).map(l => `    ${l}`).join('\\n'));
    }
  } catch (error) {
    console.log(`  ⚠️  qsv not found or error: ${error.message}`);
    console.log('  Install qsv to run skill execution examples');
  }

  console.log('\n✨ Example complete!');
}

main().catch(console.error);
```

### Core Architecture Module: `.claude/skills/examples/update-checker-demo.js`
```
#!/usr/bin/env node
/**
 * Update Checker Demo
 *
 * Demonstrates the auto-update checking functionality
 */

import { UpdateChecker, getUpdateConfigFromEnv } from '../dist/update-checker.js';

async function main() {
  console.log('QSV MCP Server - Update Checker Demo');
  console.log('=====================================\n');

  // Get qsv binary path from environment or use default
  const qsvBinPath = process.env.QSV_MCP_BIN_PATH || 'qsv';

  // Create update checker with default config
  const checker = new UpdateChecker(qsvBinPath, undefined, {
    autoRegenerateSkills: false, // Don't actually regenerate in demo
    checkForUpdatesOnStartup: true,
    notifyOnUpdatesAvailable: true
  });

  try {
    console.log('1️⃣  Checking qsv binary version...');
    const qsvVersion = await checker.getQsvBinaryVersion();
    console.log(`   ✅ qsv binary version: ${qsvVersion}\n`);

    console.log('2️⃣  Checking skills version...');
    const skillsVersion = checker.getSkillsVersion();
    console.log(`   ✅ Skills generated with: ${skillsVersion}\n`);

    console.log('3️⃣  Checking MCP server version...');
    const mcpVersion = checker.getMcpServerVersion();
    console.log(`   ✅ MCP server version: ${mcpVersion}\n`);

    console.log('4️⃣  Performing quick version check...');
    const quickCheck = await checker.quickCheck();
    if (quickCheck.skillsOutdated) {
      console.log('   ⚠️  Skills are outdated!');
      console.log(`   qsv binary: ${quickCheck.versions.qsvBinaryVersion}`);
      console.log(`   Skills: ${quickCheck.versions.skillsGeneratedWithVersion}\n`);
    } else {
      console.log('   ✅ Skills are up to date\n');
    }

    console.log('5️⃣  Performing full update check (includes GitHub API)...');
    console.log('   (This may take a few seconds...)\n');
    const fullCheck = await checker.checkForUpdates();

    if (fullCheck.recommendations.length > 0) {
      console.log('📦 Update Recommendations:');
      console.log('─────────────────────────');
      fullCheck.recommendations.forEach(rec => {
        console.log(rec);
      });
      console.log();
    } else {
      console.log('   ✅ Everything is up to date!\n');
    }

    console.log('6️⃣  Version tracking file:');
    const versionInfo = checker.loadVersionInfo();
    if (versionInfo) {
      console.log('   Stored version info:');
      console.log(`   - qsv binary: ${versionInfo.qsvBinaryVersion}`);
      console.log(`   - Skills: ${versionInfo.skillsGeneratedWithVersion}`);
      console.log(`   - MCP server: ${versionInfo.mcpServerVersion}`);
      console.log(`   - Last checked: ${versionInfo.lastChecked}\n`);
    } else {
      console.log('   No version info file found (this is normal on first run)\n');
    }

    console.log('✨ Demo complete!');
    console.log('\nTo enable auto-regeneration, set:');
    console.log('  QSV_MCP_AUTO_REGENERATE_SKILLS=true');
    console.log('\nSee AUTO_UPDATE.md for full documentation.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4724** (2026-10-04): **frequency --other-sorted: CSV output ignores the flag; JSON uses a separate re-sort**
  *Symptoms*: ## Summary  `--other-sorted` is documented as:  > By default, the "Other" category is placed at the end of the frequency table for a field. If this is enabled, the "Other" category will be sorted with the rest of the values by count.  - **CSV output ignores the flag.** CSV output is identical with and without `--other-sorted`: Other is always last. - **JSON output follows the help text,** but through a separate, JSON-only re-sort in `output_json`'s `build_frequency_field`.  So the two formats disagree, and the JSON-only re-sort has needed three follow-up fixes for tie handling (see below).  ## Repro (master, `ab290f246`)  ```sh python3 -c " rows=['v,w'] for v,n in [('a',10),('b',8)]+[(f'x{i}',1) for i in range(12)]+[('',5)]: rows += [f'{v},1']*n open('o.csv','w').write('\n'.join(rows)+'\n')" qsv frequency -s v --limit 2 --other-sorted o.csv qsv frequency -s v --limit 2 --other-sorted --json o.csv ```  Rows as `value,count,rank`:  | flags | CSV | JSON | |---|---|---| | (none) | a,10 · b,8 · Other (12),12 · (NULL),5 | a,10 · b,8 · Other (12),12 · (NULL),5 | | `--other-sorted` | a,10 · b,8 · **Other (12),12** · (NULL),5 | **Other (12),12** · a,10 · b,8 · (NULL),5 | | `--other-sorted --null-sorted` | a,10 · b,8 · (NULL),5 · **Other (12),12** | Other (12),12 · a,10 · b,8 · (NULL),5 |  The same happens with `--weight`. With `--other-sorted --null-sorted`, CSV even puts NULL (5) before Other (12), so neither row is in count order.  ## Cause  - The flag dates from `ce5c93db0` (2024-0
  **Post-Mortem & Fix Analysis**:
  > ## Correction: the fix changes JSON output too  The description above says "JSON output should be unchanged" and "the fix only needs to move Other." While fixing this in #4725, I found that is not quite right.  **JSON also ignored the documented NULL default.** Without `--null-sorted`, the JSON-only re-sort moved NULL into count order. The help text says NULL is "placed at the end … after Other" unless `--null-sorted` is set. With a NULL of 9 between `a` (10) and `b` (8):  | `--other-sorted`, no `--null-sorted` | order | |---|---| | CSV before | a · b · Other (12) · (NULL) *(flag ignored)* | | CSV after #4725 | Other (12) · a · b · (NULL) | | JSON before | Other (12) · a · **(NULL)** · b | | JSON after #4725 | Other (12) · a · b · **(NULL)** |  **Weighted ties now use the tie tolerance.** The old JSON re-sort compared rounded counts. #4725 compares weighted totals with the same tolerance used for rank ties (`weights_tied`). An Other of 8.4 now goes ahead of a value of 8.2 instead of ty

- **Issue #4719** (2026-10-04): **frequency --weight: fractional weights give non-deterministic ranks and order in parallel runs**
  *Symptoms*: ## Summary  With a fractional `--weight` column on an indexed file, repeated **identical** `frequency` runs produce different output. The row order changes, and so do the **`rank` values**: values whose total weights are mathematically equal end up in different rank groups. `--jobs 1` is deterministic. Integer weights are not affected.  Reproduces on the released **23.0.1** binary and on current master (after #4716 and #4718), so it's pre-existing.  ## Repro  ```sh python3 -c " print('v,w') for i in range(200000): print(f'v{i % 1000},{((i * 7) % 10 + 1) / 10}')" > w.csv qsv index w.csv for i in 1 2 3; do qsv frequency --weight w --limit 0 w.csv -o r$i.csv; done qsv frequency --weight w --limit 0 --jobs 1 w.csv -o s1.csv qsv frequency --weight w --limit 0 --jobs 1 w.csv -o s2.csv diff r1.csv r2.csv | grep -c '^<'   # 550 differing rows (23.0.1) diff s1.csv s2.csv | grep -c '^<'   # 0 ```  With exact arithmetic, the 1,000 values fall into **10** groups of equal total weight, and `--jobs 1` reports 10 distinct ranks. Parallel runs reported 10, 13, 15 or 17 distinct ranks from run to run. For example, `v104` and `v4` (total weight 180 each) were rank 2 in one run and rank 3 in the next:  ``` r1: v,v104,180,0.16364,2      r2: v,v104,180,0.16364,3 ```  On a real 584k-row file with a fractional weight column, ~1.9M of ~1.96M output rows differed between two runs.  ## Analysis (not confirmed)  The parallel path sums each value's weights per chunk, then merges the chunks in whatever o
  **Post-Mortem & Fix Analysis**:
  > ## Root cause found  The analysis above was right about the tolerance but missed two things. A fix is on branch `fix-4719-weighted-tolerance` (not pushed yet).  ### 1. The stats-derived tolerance was only applied to JSON output  `counts_weighted` gets its tolerance from `STATS_RECORDS`, but `get_unique_headers` only fills that in when `is_json && --weight`. The JSON-only gate came in with `21ed90f63` (stats in `--json` output), and #4041 (`9121e0f5f`) kept it. **CSV output always used the absolute `f64::EPSILON` fallback**, which is smaller than one ulp of any total above 2. That's why the repro varied even with a stats cache.  A/B on master, same binary, repro file, default `-j`:  | Output | Distinct ranks | Rows differing between runs | |---|---|---| | `--json` (stats tolerance applied) | 10 in all 6 runs | 0 | | CSV (`EPSILON` fallback) | 12–18 | 100–850 |  ### 2. `--jobs 1` was deterministic but also wrong  Sequential sums hit this too: `10.1 + 10.2` = `20.299999999999997`, one ulp

- **Issue #4689** (2026-10-01): **describegpt: LLM descriptions contain LaTeX (`$\times$`, `\$`) that the Data Schematic drawer renders raw**
  *Symptoms*: - **Symptom:** gemma-4-31b wrote `728 records (52 states $\times$ 7 program years $\times$ 2 payment types)`, `($\approx$\$179.73)` and `\$726,936` into the JSONSchema `description`. The viz dictionary drawer rendered those strings literally. - **Options (either or both):**   - Add "plain Markdown, no LaTeX/math markup, don't escape dollar signs" to the description prompt.   - Post-process known patterns (`$\times$` → ×, `$\approx$` → ≈, `\$` → $) in describegpt output before writing. - Example pre-fix dictionaries are available on request.  <details><summary>Test data (public, reproducible)</summary>  Found while building a demo from **CMS Open Payments** summary data, qsv 23.0.1 (master `78826b418`). - State summary: `https://download.cms.gov/openpayments/SMRY_RPTS_P06302026_06032026/PBLCTN_STATE_SMRY_P06302026_06032026-joined.csv`   - `op_state_physicians_all.csv` = rows with `Recipient_Type == "Covered Recipient Physician"`, `Program_Year != "ALL"`, `Country_Code == "US"`, selecting `State_Code,State_Name,Payment_Type,Program_Year,Total_Number_of_Physicians,Total_Payment_Amount_Physician,Mean_/Median_*_Physician,Total_Payment_Count_Physician` (868 rows)   - `op_state_physicians.csv` = the same minus `AA,AE,AP,AS,GU,MP,VI,FM,MH,PW` (728 rows), `Program_Year` rewritten as `YYYY-01-01` - Teaching hospital summary: `https://download.cms.gov/openpayments/SMRY_RPTS_P06302026_06032026/PBLCTN_TH_SMRY_P06302026_06032026.csv` (`Program_Year != "ALL"`, 8,801 rows), plus a `County_FI

- **Issue #4688** (2026-09-30): **describegpt: `--prompt` SQL triggers a wall of Polars "Casting from String to Date is deprecated" warnings**
  *Symptoms*: - **Repro:**   `qsv describegpt op_state_physicians.csv --base-url http://localhost:1234/v1 --model google/gemma-4-26b-a4b -p "Which 5 states had the largest percentage growth in General payments to physicians from 2019 to 2025?" --sql-results out`   - stderr repeats `Deprecation: Casting from String to Date is deprecated and will be removed in Polars 2.0. Use str.to_date() instead.` dozens of times.   - The answer itself is correct. - **Cause:** the LLM writes `CAST("Program_Year" AS DATE)`, and polars SQL warns once per cast evaluation. - **Options:**   - Have the prompt (`resources/describegpt_defaults.toml`, SQL-generation section) tell the model that date columns are already typed Date and don't need casting. The sqlp path does schema inference with `--try-parse-dates`, so check whether it already is.   - Deduplicate or suppress Polars deprecation warnings while running the generated SQL.   - Longer term, this CAST will break outright in Polars 2.0, so the prompt should steer toward `str.to_date()` or no cast at all.  <details><summary>Test data (public, reproducible)</summary>  Found while building a demo from **CMS Open Payments** summary data, qsv 23.0.1 (master `78826b418`). - State summary: `https://download.cms.gov/openpayments/SMRY_RPTS_P06302026_06032026/PBLCTN_STATE_SMRY_P06302026_06032026-joined.csv`   - `op_state_physicians_all.csv` = rows with `Recipient_Type == "Covered Recipient Physician"`, `Program_Year != "ALL"`, `Country_Code == "US"`, selecting `State_
  **Post-Mortem & Fix Analysis**:
  > Fixed on master by the Polars bump in 50c2cf18f (Polars rev `9d5804d`). qsv 23.0.1's Polars (`py-1.44.2`) printed the deprecation once per evaluation of a SQL `CAST(<string> AS DATE)`. The newer Polars removed that deprecation, and Polars SQL now performs the cast itself, so no prompt or warning-suppression change is needed.  Measured on the same queries (a String column, a string expression, a string literal): 23.0.1 printed 0/1/2 warnings, master prints 0/0/0, with identical results. The real `--prompt` query from this issue printed 14 warnings on 23.0.1 and none on master.  Users on 23.0.1 will see the warnings until the next release. #4699 adds `sqlp_cast_string_to_date_is_silent`, which pins both the results and the silence so a future Polars bump can't bring the warning back unnoticed.

- **Issue #4687** (2026-10-01): **geocode: suggest misses Puerto Rico municipios and returns out-of-admin1 matches despite `--admin1`**
  *Symptoms*: - **Repro:** `qsv geocode suggest Teaching_Hospital_CITY --admin1 US.PR -f "%dyncols: {g_name:name}, {g_county:admin2}, {g_countyfips:us_county_fips_code}"` over PR cities returned:   - Ponce → "Ponca City"   - Mayaguez → "Miami"   - Manati → "Manhattan"   - Carolina → "Newport"   - Rio Piedras → "Rio Linda" - Even with `--admin1 US.PR` set, the results are foreign-state places. That suggests either (a) PR places aren't in the index under admin1 `US.PR` (Geonames files PR as its own country code `PR`), or (b) the admin1 filter doesn't constrain the fuzzy search. - **Other misses** with `--admin1 US.CA`/`US.FL`/`US.NH`/`US.LA`:   - Davis, CA → San Diego   - Northridge, CA → Oildale   - Inverness, FL → Inver Grove Heights (that's in MN, so it breaks the admin1 filter)   - Lebanon, NH → Georgetown   - Bogalusa, LA → Nogales - **Investigate:**   - Does `--admin1 US.XX` filter candidates before ranking, or only rank them?   - Should `US.PR` alias to country `PR` (and similarly for the other territories)?   - Should a result whose admin1 ≠ the requested admin1 ever be returned, rather than blank + reported? - The unmatched city/state list (128 pairs) and the raw geocode results are available on request.  <details><summary>Test data (public, reproducible)</summary>  Found while building a demo from **CMS Open Payments** summary data, qsv 23.0.1 (master `78826b418`). - State summary: `https://download.cms.gov/openpayments/SMRY_RPTS_P06302026_06032026/PBLCTN_STATE_SMRY_P06302026_06032

- **Issue #4686** (2026-10-01): **viz smart: yearly time-series axis drops year tick labels (e.g. no 2020 label)**
  *Symptoms*: - **Symptom:** `op_state_physicians.html`, the panel "Total Payment Amount (USD) (sum) over Program Year". The x axis labels only 2019, 2021, 2022, 2024 and 2025. The 2020 point (the COVID dip, the most important point) has no tick label. - **Likely cause:** Plotly's automatic date ticks on a date axis. For Year buckets with ≤ ~20 points, set `dtick: "M12"` with `tickformat: "%Y"`, or use a categorical axis of the year strings. - **Where:** the trace/layout construction in `build_timeseries_panel` (`src/cmd/viz.rs:27628`).  <details><summary>Test data (public, reproducible)</summary>  Found while building a demo from **CMS Open Payments** summary data, qsv 23.0.1 (master `78826b418`). - State summary: `https://download.cms.gov/openpayments/SMRY_RPTS_P06302026_06032026/PBLCTN_STATE_SMRY_P06302026_06032026-joined.csv`   - `op_state_physicians_all.csv` = rows with `Recipient_Type == "Covered Recipient Physician"`, `Program_Year != "ALL"`, `Country_Code == "US"`, selecting `State_Code,State_Name,Payment_Type,Program_Year,Total_Number_of_Physicians,Total_Payment_Amount_Physician,Mean_/Median_*_Physician,Total_Payment_Count_Physician` (868 rows)   - `op_state_physicians.csv` = the same minus `AA,AE,AP,AS,GU,MP,VI,FM,MH,PW` (728 rows), `Program_Year` rewritten as `YYYY-01-01` - Teaching hospital summary: `https://download.cms.gov/openpayments/SMRY_RPTS_P06302026_06032026/PBLCTN_TH_SMRY_P06302026_06032026.csv` (`Program_Year != "ALL"`, 8,801 rows), plus a `County_FIPS`/`County_Name` 

- **Issue #4682** (2026-10-01): **viz: `--geojson census:county` fails with "Census response is not valid JSON" while the same TIGERweb queries succeed via curl**
  *Symptoms*: - **Repro (every time, on two runs; TIGERweb was up):**   `qsv viz smart op_teaching_hospitals.csv --dictionary op_teaching_hospitals.schema.json --geojson census:county --denominator census -o x.html`   - Output: `--geojson census:county: no region column resolved against a Census geography — 'County FIPS Code': Census response is not valid JSON: expected value at line 1 column 1; 'County Name': …; 'Hospital City': …`   - Pinning the vintage (`census:county@2024`) fails the same way. - **What works in curl:**   - The catalog: `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2025/MapServer?f=json` → 200, valid JSON. Also fine for ACS2023, ACS2024 and ACS2026.   - The probe query: `…/tigerWMS_ACS2025/MapServer/82/query?where=GEOID IN (...200 codes...)&outFields=GEOID&returnGeometry=false&f=geojson` → 200, `application/geo+json`.   - The catalog again with `Accept-Encoding: gzip, br, zstd, deflate` and `User-Agent: qsv/23.0.1` → still plain, valid JSON. - **Source path:**   - `get_json` (`src/cmd/viz_census.rs:317-378`; the error is at `:375`), called via `resolve_layer_ids` (`:430`), `probe_layer` (`:532`) and `score_candidates` (`:926`).   - The client comes from `census_client()` (`:245`) → `util::create_reqwest_blocking_client(None, timeout, Some(tigerweb_root()))`. - **Why it's odd:** *every* candidate column fails identically, including the city-name path, which points at a shared first request (the catalog / `resolve_layer_ids`) or at the client
  **Post-Mortem & Fix Analysis**:
  > ## Diagnosis: TIGERweb's firewall rejects oversized geometry pages (HTTP 200 + HTML)  Not environmental, and not a client/decompression bug.  With `QSV_LOG_LEVEL=trace`, every lightweight request succeeds: the catalog, the MapServer metadata, and the `GEOID IN (...)` probes with `returnGeometry=false`. Only the **geometry fetch** fails: `where=STATE IN (...52 states...)&returnGeometry=true&outSR=4326&orderByFields=GEOID&resultRecordCount=500&f=geojson`. For that request TIGERweb's F5 WAF answers:  ``` HTTP/1.1 200 OK Content-Type: text/html; charset=utf-8 Content-Length: 189  <html><head><title>Request Rejected</title></head><body>The requested URL was rejected. Please consult with your administrator.<br><br>Your support ID is: ...</body></html> ```  `error_for_status` lets a 200 through, so serde fails on `<html>` and reports "not valid JSON".  **curl reproduces it exactly** (GET, POST, and an `OR` predicate all behave the same). The earlier "works in curl" checks only covered the cat

- **Issue #4680** (2026-10-01): **viz: `--denominator census` hard-fails on territory/military state codes instead of excluding and reporting them**
  *Symptoms*: - **Repro:**   `qsv viz smart op_state_physicians_all.csv --dictionary op_state_physicians.schema.json --geojson us_states.geojson --feature-id-key properties.STUSAB --denominator census -o x.html`   - Output: `usage error: --denominator census: 4 of 56 location values are not US state codes (e.g. AS, GU, MP, VI). Census population is resolved for US states and counties.` - **Help text promises otherwise** (`viz --help`, `--denominator`): "Uncovered regions are excluded and reported." - **Source:** `src/cmd/viz.rs:8274-8297`, in the USPS-code branch.   - Any code that `viz_census::state_fips_for_usps` can't map goes into `unknown`, and a non-empty `unknown` triggers `fail_incorrectusage_clierror!`.   - The lookup table `USPS_STATE_FIPS` (`src/cmd/viz_census.rs:2076`) holds exactly 52 codes: the 50 states + DC + PR (checked). - **Expected:** exclude codes with no ACS population (territories AS/GU/MP/VI, military AA/AE/AP, freely associated FM/MH/PW) and report them in the same coverage note used for uncovered regions. Refuse only when **nothing** resolves.   - Also check what the 5-digit county and 2-digit FIPS branches do with unknown codes, so all three branches behave the same.   - The county path with the explicit county GeoJSON did **not** fail on Connecticut's legacy county FIPS (09001…), which suggests those branches already exclude. - **Tests:** add a case with mixed state and territory codes. Assert that the output renders, that the territories are listed as excluded,

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

### Incident Patch 1: `6671d3d6` (2026-10-04)
**Commit Message**: fix(readstat): write SPSS DTIME durations as seconds (#4730)

The readers return SPSS DTIME variables as polars Duration columns, which
the CSV writer rejects ("datatype duration[μs] cannot be written to
CSV"), so any .sav/.zsav file with one failed outright.

Convert Duration columns to Float64 seconds - SPSS's own storage unit -
in the output schema and in every batch (and the .por frame), using the
column's time unit. The --compress-numeric pass sees the same values, so
whole-second durations compress to integers like any other number.

Fixture readstat_dtime.sav written with pyreadstat 1.3.6; expected
values are pyreadstat's read_sav(disable_datetime_conversion=True).
Mutation-checked at all three conversion sites.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -135,6 +135,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **`frequency`: the frequency cache now validates the qsv version that wrote it, and self-heals when it is stale** ([#4618](https://github.com/dathere/qsv/pull/4618)). `.freq.csv.data.jsonl` always recorded `qsv_version` but never compared it, so a cache written by an older qsv - whose `<ALL_UNIQUE>`/HIGH_CARDINALITY sentinels, percentages or ranks may no longer match - was served indefinitely. Because `frequency` only writes its cache under `--frequency-jsonl`, a bare version check would have turned every upgrade into a permanent cache miss; instead the run that rejects a version-stale cache recomputes and rewrites it in place. The version is compared only after every option check agrees, only when the cached column selection matches this run's, and only when a cache file already exists - so it refreshes caches but never creates one. `viz` rejects a version-stale cache without rewriting it and falls back to its own computation.
 
 ### Fixed
+- **`readstat` failed on SPSS files with a duration (DTIME) variable.** The reader returns DTIME variables as durations, which the CSV writer can't write, so the whole conversion stopped with `datatype duration[μs] cannot be written to CSV`. They are now written as their number of seconds, the unit SPSS stores them in (`3725.0` for 1:02:05), so they stay numeric and lossless. `--compress-numeric` treats them like any other number.
 - **`readstat` split some SPSS strings longer than 255 bytes into 255-byte pieces.** SPSS stores such a string as a run of hidden records. When one of their names matched another long string's short name, as in files written by polars-readstat 0.23.3 and earlier, the reader gave that string's width to the hidden record. The string then came out as several extra columns (`S35r11` became `S35R11`, `S35r11`, `S35R12`, `S35R13`). Fixed by [polars-readstat-rs 0.24.0](https://github.com/jrothbaum/polars_readstat/releases/tag/v0.24.0) ([jrothbaum/polars_readstat#68](https://github.com/jrothbaum/polars_readstat/issues/68)), which qsv now requires. The output now matches pyreadstat.
 - **`frequency --lmt-threshold` applied limits to the wrong columns.** Since the option was added, limits applied to columns with *at most* the threshold's number of unique values, the opposite of the documented behavior. They now apply, as documented, only to columns with *at least* that many unique values (e.g. `--limit 10 --lmt-threshold 50` caps high-cardinality columns and returns low-cardinality ones in full). When `--pct-nulls` is off (the default), NULL is not counted toward a column's unique values, and the top-N fast path now counts the same way as the full sort. **Behavior change:** runs that relied on the inverted behavior will produce different output. `--lmt-threshold 0` (the default) is unaffected.
 - **`frequency --other-sorted` was ignored by CSV output, and JSON applied it differently.** CSV always put the "Other" row last. JSON sorted it by count through a separate re-sort, which also moved NULL into count order even without `--null-sorted`. Both formats now share one implementation: with `--other-sorted`, Other is placed among the values by count (ties broken by value), and NULL stays last unless `--null-sorted` is set, as documented. **Behavior change:** CSV output with `--other-sorted` now places Other by count, JSON output with `--other-sorted` but without `--null-sorted` now keeps NULL last, and with `--weight` Other is compared by its weighted total rather than its rounded count (an Other of 8.4 now goes ahead of a value of 8.2 instead of tying it at 8). [#4724](https://github.com/dathere/qsv/issues/4724)
```

**File**: `docs/help/readstat.md` (modified, +2/-1)
```diff
@@ -26,7 +26,8 @@ SPSS    .sav, .zsav, .por
 ```
 
 Coded values are written as their underlying codes, not their labels, so the
-conversion is lossless. Use --value-labels to decode them instead. SAS keeps
+conversion is lossless. SPSS durations (DTIME) are written as their number of
+seconds, as SPSS stores them. Use --value-labels to decode them instead. SAS keeps
 its value labels in a separate .sas7bcat format catalog, which --value-labels
 finds next to the data file, or --sas7bcat names.
 
```

**File**: `src/cmd/readstat.rs` (modified, +47/-4)
```diff
@@ -11,7 +11,8 @@ Supported input formats:
     SPSS    .sav, .zsav, .por
 
 Coded values are written as their underlying codes, not their labels, so the
-conversion is lossless. Use --value-labels to decode them instead. SAS keeps
+conversion is lossless. SPSS durations (DTIME) are written as their number of
+seconds, as SPSS stores them. Use --value-labels to decode them instead. SAS keeps
 its value labels in a separate .sas7bcat format catalog, which --value-labels
 finds next to the data file, or --sas7bcat names.
 
@@ -181,7 +182,7 @@ use std::{
 
 use polars::prelude::{
     CsvWriter, DataFrame, DataType, IdxCa, IdxSize, IntoSeries, PlSmallStr, PolarsResult, Schema,
-    SerWriter, StringChunked,
+    SchemaRef, SerWriter, StringChunked, TimeUnit,
 };
 use polars_readstat_rs::{
     CatalogKey, InformativeNullColumns, InformativeNullMode, InformativeNullOpts, ReadStatFormat,
@@ -1113,7 +1114,8 @@ fn whole_number_columns(
         preserve_order: Some(!window.is_all()),
         ..opts.clone()
     };
-    let schema = readstat_schema(path, Some(scan_opts.clone()), Some(rs_format))?;
+    let mut schema = readstat_schema(path, Some(scan_opts.clone()), Some(rs_format))?;
+    durations_as_seconds_schema(&mut schema);
     let mut scan = WholeNumberScan::new(&schema);
     if let Some(selection) = selection {
         scan.candidates
@@ -1133,7 +1135,8 @@ fn whole_number_columns(
     )?;
     let mut start = 0_u64;
     for batch in batches {
-        let batch = batch?;
+        let mut batch = batch?;
+        durations_as_seconds(&mut batch)?;
         let height = batch.height() as u64;
         if window.is_all() {
             scan.update(&batch)?;
@@ -1632,6 +1635,43 @@ impl SentinelLabels {
     }
 }
 
+/// SPSS DTIME variables come back from the readers as polars Durations, which
+/// the CSV writer cannot write. They are written as seconds instead - the unit
+/// SPSS stores them in - so they stay numeric & lossless.
+fn units_per_second(dtype: &DataType) -> Option<f64> {
+    match dtype {
+        DataType::Duration(TimeUnit::Nanoseconds) => Some(1e9),
+        DataType::Duration(TimeUnit::Microseconds) => Some(1e6),
+        DataType::Duration(TimeUnit::Milliseconds) => Some(1e3),
+        _ => None,
+    }
+}
+
+fn durations_as_seconds_schema(schema: &mut SchemaRef) {
+    let durations: Vec<PlSmallStr> = schema
+        .iter()
+        .filter(|(_, dtype)| units_per_second(dtype).is_some())
+        .map(|(name, _)| name.clone())
+        .collect();
+    for name in durations {
+        std::sync::Arc::make_mut(schema).set_dtype(&name, DataType::Float64);
+    }
+}
+
+fn durations_as_seconds(df: &mut DataFrame) -> PolarsResult<()> {
+    let durations: Vec<(PlSmallStr, f64)> = df
+        .columns()
+        .iter()
+        .filter_map(|col| units_per_second(col.dtype()).map(|per| (col.name().clone(), per)))
+        .collect();
+    for (name, per_second) in durations {
+        let col = df.column(&name)?.as_materialized_series();
+        let seconds = col.cast(&DataType::Int64)?.cast(&DataType::Float64)? / per_second;
+        df.replace(&name, seconds.with_name(name.clone()).into())?;
+    }
+    Ok(())
+}
+
 /// Stream the file to CSV, one batch at a time, so memory stays bounded.
 fn write_data<W: Write>(
     args: &Args,
@@ -1696,6 +1736,7 @@ fn write_data<W: Write>(
         )
     } else {
         let mut df = polars_readstat_rs::scan_por(path, opts.clone())?.collect()?;
+        durations_as_seconds(&mut df)?;
         if let Some(selection) = selection {
             df = df.select(selection.iter().map(String::as_str))?;
         }
@@ -1705,6 +1746,7 @@ fn write_data<W: Write>(
         }
         (df.schema().clone(), Some(df))
     };
+    durations_as_seconds_schema(&mut schema);
 
     // The columns written, in order: each selected variable, followed by its
     // sentinel column if it has one. A variable of the file that happens to
@@ -1806,6 +1848,7 @@ fn write_data<W: Write>(
         let mut start = 0_u64;
         for batch in batches {
             let mut df = batch?;
+            durations_as_seconds(&mut df)?;
             let height = df.height() as u64;
             if !window.is_all() {
                 // before the sentinel check, so it counts only the rows written
```

**File**: `tests/test_readstat.rs` (modified, +36/-0)
```diff
@@ -2127,3 +2127,39 @@ fn readstat_select_ignores_unselected_sentinel_clash() {
     let stderr = wrk.stderr_on_error(&mut cmd);
     assert!(stderr.contains("named \"rating_null\""), "{stderr}");
 }
+
+/// SPSS DTIME variables are written as seconds, the unit SPSS stores them in.
+/// The readers return them as polars Durations, which the CSV writer can't
+/// write, so any file with one failed outright.
+///   `readstat_dtime.sav` - written with pyreadstat 1.3.6: `dur` is DTIME23.2,
+///     `whole` DTIME11, `t` TIME8. Expected values are pyreadstat's
+///     `read_sav(..., disable_datetime_conversion=True)`.
+#[test]
+fn readstat_spss_dtime_as_seconds() {
+    let wrk = Workdir::new("readstat_spss_dtime_as_seconds");
+    let f = wrk.load_test_file("readstat_dtime.sav");
+
+    let mut cmd = wrk.command("readstat");
+    cmd.arg(&f);
+    let got: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
+    let expected = vec![
+        svec!["id", "dur", "whole", "t"],
+        svec!["1.0", "3725.0", "60.0", "10:30:15.000000000"],
+        svec!["2.0", "1.5", "90061.0", "00:00:01.000000000"],
+        svec!["3.0", "", "0.0", ""],
+    ];
+    assert_eq!(got, expected);
+
+    // they are plain numbers to --compress-numeric
+    let mut cmd = wrk.command("readstat");
+    cmd.args(["--compress-numeric", "--select", "dur,whole"])
+        .arg(&f);
+    let got: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
+    let expected = vec![
+        svec!["dur", "whole"],
+        svec!["3725.0", "60"],
+        svec!["1.5", "90061"],
+        svec!["", "0"],
+    ];
+    assert_eq!(got, expected);
+}
```

---

### Incident Patch 2: `b4f9225c` (2026-10-04)
**Commit Message**: ci: add a Linux ARM64 musl release target (#4721)

Linux x86_64 ships both GNU and musl builds, but ARM64 shipped only
GNU. Build aarch64-unknown-linux-musl natively on ubuntu-24.04-arm with
musl-tools, using the reduced feature set of the x86_64 musl release.

- Build without default features: tikv-jemalloc does not build with the
  native ARM64 musl toolchain, so this target uses the system allocator.
- Skip qsvdp and qsvmcp on all aarch64 Linux targets, as already done for
  aarch64-unknown-linux-gnu: their Polars fat-LTO link OOM-kills the
  hosted ARM runner.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/publish-target.yml` (modified, +3/-3)
```diff
@@ -285,9 +285,9 @@ jobs:
         cargo +${{ inputs.rust }} build --profile "$BIN_PROFILE" $PROFILE_TUNING --timings --locked --bin qsvlite --features=lite,self_update,${{ inputs.addl_qsvlite_features }} --target ${{ inputs.target }} ${{ inputs.default_features }}
     - name: Build qsvdp
       # qsvdp (datapusher_plus) is a Linux deployment helper, so only build it for x86_64
-      # Linux. Skip aarch64-unknown-linux-gnu (its Polars fat-LTO link OOM-kills the hosted
+      # Linux. Skip the aarch64 Linux targets (the Polars fat-LTO link OOM-kills the hosted
       # ARM runner — qsvmcp is already excluded there too) and all non-Linux targets.
-      if: ${{ matrix.part != 'mcp' && inputs.target != 'aarch64-unknown-linux-gnu' && inputs.os_name == 'linux' }}
+      if: ${{ matrix.part != 'mcp' && !startsWith(inputs.target, 'aarch64-unknown-linux-') && inputs.os_name == 'linux' }}
       # Deliberately NO `addl_rustflags` (i.e. no -C target-cpu=x86-64-v3): qsvdp stays on the
       # portable x86-64 baseline. DataPusher+ servers often run on VMs with conservative CPU
       # models (kvm64/qemu64) that lack AVX2, and a SIGILLing qsvdp can't `--update` itself back.
@@ -296,7 +296,7 @@ jobs:
         # shellcheck disable=SC2086
         cargo +${{ inputs.rust }} build --profile "$BIN_PROFILE" $PROFILE_TUNING --timings --locked --bin qsvdp --features=datapusher_plus,${{ inputs.addl_qsvdp_features }} --target ${{ inputs.target }} ${{ inputs.default_features }}
     - name: Build qsvmcp
-      if: ${{ matrix.part != 'main' && inputs.target != 'x86_64-unknown-linux-musl' && inputs.target != 'aarch64-unknown-linux-gnu' }}
+      if: ${{ matrix.part != 'main' && !endsWith(inputs.target, '-unknown-linux-musl') && inputs.target != 'aarch64-unknown-linux-gnu' }}
       env:
         RUSTFLAGS: ${{ inputs.addl_rustflags }}
       shell: bash
```

**File**: `.github/workflows/publish.yml` (modified, +20/-0)
```diff
@@ -216,6 +216,26 @@ jobs:
             codegen-units:
             # sequential build keeps the #4372 dependency sharing, worth more here than parallelism
             split-mcp: false
+          - os: ubuntu-24.04-arm
+            os-name: linux
+            target: aarch64-unknown-linux-musl
+            architecture: aarch64
+            # Build natively and use musl-tools for the static ARM64 artifact.
+            use-cross: false
+            musl-prep: true
+            # Keep the reduced feature set used by the existing x86_64 musl release.
+            addl-build-args: --features=apply,fetch,foreach,self_update,lens,color,synthesize
+            # tikv-jemalloc does not build with the native ARM64 musl toolchain.
+            default-features: --no-default-features
+            addl-qsvlite-features:
+            addl-qsvdp-features:
+            addl-rustflags:
+            pgo: false
+            pgo-train-flags:
+            pgo-lto:
+            lto:
+            codegen-units:
+            split-mcp: false
           # - os: ubuntu-20.04
           #   os-name: linux
           #   target: arm-unknown-linux-gnueabihf
```

---

### Incident Patch 3: `4ffc75bf` (2026-10-04)
**Commit Message**: feat(stats): warn when exact mode/cardinality tracking may not fit in memory (#4726)

Exact mode & cardinality tables (modes: Frequencies<Vec<u8>>) hold every
distinct value of every column and are nearly all of --everything's
memory. On NYC 311 (1M rows, 44 columns), peak RSS is 607 MB at -j 1 and
1.2 GB at -j 16, because each row-chunk holds its own copy of values
that appear across the file, then the merge resizes the combined table
while unmerged chunks are still alive.

The shipped lever, --mode-cardinality-cap, cut --everything on that file
from 1,226 MB / 0.37 s to 435 MB / 0.17 s (cap 10000), but nothing
pointed users to it. Defaults are deliberately unchanged: the stats cache
is read by frequency, schema, joinp, pivotp, viz and others, and exact
cardinality matters most on the ID/timestamp columns a cap would hit.

- mode_memory_warning(): returns a warning when an exact mode tracker is
  built (same condition as Stats::new), no cap is set, and the estimate
  exceeds util::SAFETY_MARGIN (80%) of available memory.
- parallel_stats() (memory-aware chunking path) estimates the whole file
  with the existing estimate_chunk_memory() and calls it. On NYC 311 it
  estimated 1.6 G

**File**: `.claude/skills/qsv/qsv-stats.json` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@
       {
         "flag": "--everything",
         "type": "flag",
-        "description": "Compute all statistics available."
+        "description": "Compute all statistics available. On large files, mode & cardinality tracking dominates memory use. See --mode-cardinality-cap for how to bound it."
       },
       {
         "flag": "--flexible",
@@ -101,7 +101,7 @@
       {
         "flag": "--mode-cardinality-cap",
         "type": "number",
-        "description": "Bound mode-tracking memory on high-cardinality columns. When > 0, if a column's mode tracker grows past <n> UNIQUE values (true cardinality, for both unweighted and weighted runs), qsv drops it and emits sentinel values instead of exact modes and cardinality. The cap is a direct memory bound on the tracker, which stores one entry per unique value. Sentinel output: * mode columns: \"*HIGH_CARDINALITY\" * cardinality column: \">=<n>\" (the \">=\" prefix DOES break downstream parsers expecting a plain integer; cap is opt-in only). Under --cardinality-method approx, the cardinality column ignores this cap (HLL gives an approximate estimate at fixed memory, ~1.5% RSE) — only mode/antimode columns are gated. Useful on wide tables with many ID/UUID/timestamp columns where tracking exact cardinality is wasted work.",
+        "description": "Bound mode-tracking memory on high-cardinality columns. When > 0, if a column's mode tracker grows past <n> UNIQUE values (true cardinality, for both unweighted and weighted runs), qsv drops it and emits sentinel values instead of exact modes and cardinality. The cap is a direct memory bound on the tracker, which stores one entry per unique value. Sentinel output: * mode columns: \"*HIGH_CARDINALITY\" * cardinality column: \">=<n>\" (the \">=\" prefix DOES break downstream parsers expecting a plain integer; cap is opt-in only). Under --cardinality-method approx, the cardinality column ignores this cap (HLL gives an approximate estimate at fixed memory, ~1.5% RSE) — only mode/antimode columns are gated. Useful on wide tables with many ID/UUID/timestamp columns where tracking exact cardinality is wasted work. For large files, a cap of 10000 combined with \"--cardinality-method approx\" keeps an approximate cardinality for capped columns. On a 1M-row, 44-column file this cut --everything's peak memory by ~65% and its runtime by half. Parallel runs warn when mode & cardinality tracking may not fit in available memory.",
         "default": 0
       },
       {
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -60,6 +60,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **`profile`: qsv's DCAT-US v3 validator is now tested against GSA's OWN conformance fixtures.** 23 `good`/`bad` examples for Dataset, Catalog and Distribution are vendored under `resources/dcat-us-v3/examples/` at the same pin as the schemas, and `gsa_conformance` asserts every `good` fixture validates clean and every `bad` one is rejected. This checks something no other test did: not whether the projection is shaped right (the golden tests cover that) but whether qsv's *validator* enforces the bundle the way the bundle's authors intend. Those diverged once — `format` is an annotation rather than an assertion by default in JSON Schema 2020-12, so qsv passed output data.gov rejected, and the gap was only caught by submitting to <https://harvest.data.gov/validate/> by hand. Verified this catches it: with format assertion disabled the suite fails and names `Catalog/bad/invalid_issued_format.json` and `Distribution/bad/invalid_url_format.json`. Every `bad` fixture was also confirmed to be rejected for its own named defect rather than incidentally by the unknown-key lint. Fixtures are hashed by the existing pin test alongside the schemas, and the refresh procedure re-vendors both at one commit.
 
 ### Changed
+- **`stats` warns when exact mode & cardinality tracking may not fit in memory.** These tables hold every distinct value of every column, and they account for nearly all of `--everything`'s memory: on a 1M-row, 44-column NYC 311 file, peak memory goes from 607 MB at `--jobs 1` to 1.2 GB at `--jobs 16`, because each chunk holds its own copy of values that appear across the file. Parallel runs now warn when the estimated memory exceeds 80% of what's available, suggesting `--mode-cardinality-cap` (with `--cardinality-method approx` to keep approximate cardinalities). On that file, a cap of 10000 cut `--everything`'s peak memory by ~65% and its runtime by half. The `--everything` and `--mode-cardinality-cap` help text now points to this. Defaults and output are unchanged.
 - **Faster `frequency`, with lower peak memory: 1.5× by default, 2× with `--weight`** ([#4716](https://github.com/dathere/qsv/pull/4716), [#4718](https://github.com/dathere/qsv/pull/4718)). Profiling a 434 MB file with several high-cardinality columns found two serial bottlenecks after the parallel count:
   - **Output:** columns are now ranked in parallel, and each worker frees its own column's table instead of the writer freeing millions of keys one at a time. Rows are still written in column order, and the number of ranked columns held at once is bounded by `--jobs` whenever a column's output is unbounded (`--limit 0`, negative limits, `--lmt-threshold`). A full frequency-cache hit now respects `--jobs` too.
   - **Merge:** chunk tables are folded into one table per column as they arrive, sized up front from the stats cache's cardinality, instead of a pairwise tree reduce that re-inserted every value at each level and kept re-growing tables.
```

**File**: `docs/help/stats.md` (modified, +1/-1)
```diff
@@ -229,7 +229,7 @@ qsv stats --help
 | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Option&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Type | Description | Default |
 |--------|------|-------------|--------|
 | &nbsp;`‑s,`<br>`‑‑select`&nbsp; | string | Select a subset of columns to compute stats for. See 'qsv select --help' for the format details. This is provided here because piping 'qsv select' into 'qsv stats' will prevent the use of indexing. |  |
-| &nbsp;`‑E,`<br>`‑‑everything`&nbsp; | flag | Compute all statistics available. |  |
+| &nbsp;`‑E,`<br>`‑‑everything`&nbsp; | flag | Compute all statistics available. On large files, mode & cardinality tracking dominates memory use. See --mode-cardinality-cap for how to bound it. |  |
 | &nbsp;`‑‑typesonly`&nbsp; | flag | Infer data types only and do not compute statistics. Note that if you want to infer dates and boolean types, you'll still need to use the --infer-dates & --infer-boolean options. |  |
 
 <a name="boolean-inferencing-options"></a>
```

**File**: `src/cmd/stats.rs` (modified, +107/-1)
```diff
@@ -150,6 +150,8 @@ stats options:
                               This is provided here because piping 'qsv select'
                               into 'qsv stats' will prevent the use of indexing.
     -E, --everything          Compute all statistics available.
+                              On large files, mode & cardinality tracking dominates
+                              memory use. See --mode-cardinality-cap for how to bound it.
     --typesonly               Infer data types only and do not compute statistics.
                               Note that if you want to infer dates and boolean types, you'll
                               still need to use the --infer-dates & --infer-boolean options.
@@ -283,6 +285,12 @@ stats options:
                               are gated.
                               Useful on wide tables with many ID/UUID/timestamp columns
                               where tracking exact cardinality is wasted work.
+                              For large files, a cap of 10000 combined with
+                              "--cardinality-method approx" keeps an approximate
+                              cardinality for capped columns. On a 1M-row, 44-column
+                              file this cut --everything's peak memory by ~65% and
+                              its runtime by half. Parallel runs warn when mode &
+                              cardinality tracking may not fit in available memory.
                               [default: 0]
 
     --round <decimal_places>  Round statistics to <decimal_places>. Rounding is done following
@@ -2989,6 +2997,25 @@ impl Args {
                 estimate_chunk_memory(chunk_size, avg_record_size, &which_stats, headers.len())
                     / (1024 * 1024);
 
+            // Exact mode/cardinality tables hold every distinct value of every column, and a
+            // parallel run briefly holds per-chunk copies too. Point users at the cap when the
+            // whole-file estimate won't fit, instead of letting a large run swap or get killed.
+            let whole_file_estimate = estimate_chunk_memory(
+                idx_count as usize,
+                avg_record_size,
+                &which_stats,
+                headers.len(),
+            );
+            let mut sys = sysinfo::System::new();
+            sys.refresh_memory();
+            if let Some(warning) = mode_memory_warning(
+                whole_file_estimate as u64,
+                sys.available_memory(),
+                &which_stats,
+            ) {
+                wwarn!("{warning}");
+            }
+
             // Safety: max_chunk_memory_mb is guaranteed Some(...) here since
             // needs_memory_aware_chunking requires max_chunk_memory_mb.is_some()
             let chunking_mode = if max_chunk_memory_mb.unwrap_or(0) == 0 {
@@ -3892,6 +3919,36 @@ const fn estimate_chunk_memory(
         .saturating_add(overhead)
 }
 
+/// Builds the warning shown when exact mode/cardinality tracking may not fit in memory.
+///
+/// Returns `None` when no exact mode tracker is built (same condition as `Stats::new`), when
+/// --mode-cardinality-cap already bounds it, when available memory is unknown (0), or when the
+/// estimate fits within [`util::SAFETY_MARGIN`] of available memory.
+#[allow(clippy::cast_precision_loss)]
+fn mode_memory_warning(
+    estimate_bytes: u64,
+    available_bytes: u64,
+    which_stats: &WhichStats,
+) -> Option<String> {
+    let exact_tracker =
+        which_stats.mode || (which_stats.cardinality && !which_stats.approx_cardinality);
+    if !exact_tracker || which_stats.mode_cardinality_cap > 0 || available_bytes == 0 {
+        return None;
+    }
+    if estimate_bytes as f64 <= available_bytes as f64 * util::SAFETY_MARGIN {
+        return None;
+    }
+    let gib = |bytes: u64| bytes as f64 / f64::from(1_u32 << 30);
+    Some(format!(
+        "stats may need ~{:.1} GiB of memory, mostly for exact mode & cardinality tracking, but \
+         only ~{:.1} GiB is available. To bound it, set --mode-cardinality-cap (e.g. 10000) and \
+         add --cardinality-method approx to keep approximate cardinalities. See `qsv stats \
+         --help`.",
+        gib(estimate_bytes),
+        gib(available_bytes)
+    ))
+}
+
 /// Calculates memory-aware chunk size for parallel statistics processing.
 ///
 /// This function determines an appropriate chunk size based on:
@@ -7119,7 +7176,7 @@ impl Commute for TypedMinMax {
 mod tests {
     use stats::Commute;
 
-    use super::merge_chunks_in_order;
+    use super::{WhichStats, merge_chunks_in_order, mode_memory_warning};
 
     /// Minimal `Commute` stand-in: merging sums, so the merged total tells us exactly which
     /// chunks were folded in. Using a toy type rather than `Stats` keeps the test about the
@@ -7143,6 +7200,55 @@ mod tests {
         recv
     }
 
+    #[test]
+    fn mode_memory_warning_only_when_exact_tracking_does_not_fit() {
+        const GIB: u64 = 1 << 30;
+
```

---

### Incident Patch 4: `868a913c` (2026-10-04)
**Commit Message**: fix(frequency): implement --other-sorted once for CSV and JSON (#4725)

* fix(frequency): implement --other-sorted once for CSV and JSON

CSV output ignored --other-sorted: counts()/counts_weighted() always push
the Other row last, and move_other_to_end_if_needed only rotated Other
when it was FIRST, so the flag changed nothing. JSON output instead
re-sorted its finished rows in build_frequency_field. That re-sort also
moved NULL rows into count order without --null-sorted, against the
documented default ("NULL ... placed at the end ... after Other").

Replace move_other_to_end_if_needed with place_other_row, which runs in
process_frequencies/process_frequencies_weighted for every format,
including frequency-cache output. With --other-sorted it slots Other
before the first row it outranks by count, breaking ties by value (the
same comparator the JSON re-sort used); move_null_to_end_if_needed then
handles NULL as before. The JSON-only re-sort, including the
tie-handling added in #4720, is removed.

Behavior changes:
- CSV with --other-sorted: Other is placed by count instead of last.
- JSON with --other-sorted but not --null-sorted: NULL stays last.

On the issue repro, CSV and JSON

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -131,6 +131,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 - **`frequency --lmt-threshold` applied limits to the wrong columns.** Since the option was added, limits applied to columns with *at most* the threshold's number of unique values, the opposite of the documented behavior. They now apply, as documented, only to columns with *at least* that many unique values (e.g. `--limit 10 --lmt-threshold 50` caps high-cardinality columns and returns low-cardinality ones in full). When `--pct-nulls` is off (the default), NULL is not counted toward a column's unique values, and the top-N fast path now counts the same way as the full sort. **Behavior change:** runs that relied on the inverted behavior will produce different output. `--lmt-threshold 0` (the default) is unaffected.
+- **`frequency --other-sorted` was ignored by CSV output, and JSON applied it differently.** CSV always put the "Other" row last. JSON sorted it by count through a separate re-sort, which also moved NULL into count order even without `--null-sorted`. Both formats now share one implementation: with `--other-sorted`, Other is placed among the values by count (ties broken by value), and NULL stays last unless `--null-sorted` is set, as documented. **Behavior change:** CSV output with `--other-sorted` now places Other by count, JSON output with `--other-sorted` but without `--null-sorted` now keeps NULL last, and with `--weight` Other is compared by its weighted total rather than its rounded count (an Other of 8.4 now goes ahead of a value of 8.2 instead of tying it at 8). [#4724](https://github.com/dathere/qsv/issues/4724)
 - **`frequency --weight` split or merged ties in weighted totals.** Totals were compared with an absolute tolerance that was `f64::EPSILON` for CSV output and `stddev(weight) × 1e-6` for JSON output. With fractional weights, totals that are equal in exact arithmetic but differ in their last bits (e.g. `10.1 + 10.2` vs `20.3`) got different ranks. In parallel runs this also made ranks and row order change from run to run, because chunk sums are merged in arrival order. With large weights, the JSON tolerance merged distinct totals (e.g. 20000001 and 20000003) into one tie and reported the same count for both. Ties are now detected with a relative tolerance (within 1e-9 of the tie's first total), so output is deterministic and CSV and JSON agree. Each row keeps its own total, so a tie never changes a reported count, and a `--limit` that cuts through a tie keeps the same values on every run. [#4719](https://github.com/dathere/qsv/issues/4719)
 - **`frequency --weight` dropped the "Other" row when a column had NULLs.** With NULL set aside (the default `--pct-nulls` off), NULL was subtracted from the column's unique count twice, so values past `--limit` could vanish from the output instead of being summed into "Other (N)". Unweighted output was not affected.
 - **`viz smart`: a constant date column no longer hides the time series and the seasonality ring.** A Date column holding a single value (e.g. a publication date stamped on every row, like Open Payments' `Payment_Publication_Date`) counts as "sorted", so it outranked the real event date when `viz smart` picked the column for the time-series panel and the cyclic (day-of-week/month) panel. Both then had a single bucket and were silently dropped, and stderr reported the event date as "no time panel could be drawn from it". Date columns with fewer than two distinct values are now skipped by both pickers.
```

**File**: `src/cmd/frequency.rs` (modified, +44/-58)
```diff
@@ -2667,23 +2667,53 @@ impl Args {
         Ok(true)
     }
 
-    /// Helper to move "Other" category to end if not sorted
-    fn move_other_to_end_if_needed<T>(&self, counts: &mut [(Vec<u8>, T, f64, f64)]) {
+    /// Positions the "Other" row. `counts()` / `counts_weighted()` always push it last, which is
+    /// the default placement. With --other-sorted it is slotted among the other rows by count
+    /// (ties broken by value), for every output format. It runs before
+    /// `move_null_to_end_if_needed`; rows are in count order, so where Other lands relative to a
+    /// NULL that is later moved to the end does not change the order of the remaining rows.
+    ///
+    /// `tied` decides when Other's count equals a row's: exact for unweighted counts, and
+    /// [`weights_tied`] for weighted totals, whose last bits depend on summation order (Other is
+    /// `total - shown`, and the total is summed in hash-map order).
+    fn place_other_row<T: PartialOrd>(
+        &self,
+        counts: &mut Vec<(Vec<u8>, T, f64, f64)>,
+        tied: impl Fn(&T, &T) -> bool,
+    ) {
+        if !self.flag_other_sorted {
+            return;
+        }
         let other_prefix = format!("{} (", self.flag_other_text);
-        let other_prefix_bytes = other_prefix.as_bytes();
-        if !self.flag_other_sorted
-            && counts
-                .first()
-                .is_some_and(|(value, _, _, _)| value.starts_with(other_prefix_bytes))
-        {
-            counts.rotate_left(1);
+        // rank 0 tells Other apart from a data value that happens to start with the prefix
+        let is_other = counts.last().is_some_and(|(value, _, _, rank)| {
+            *rank == 0.0 && value.starts_with(other_prefix.as_bytes())
+        });
+        if !is_other {
+            return;
         }
+        // safety: is_other implies a last element
+        let other = counts.pop().unwrap();
+        let pos = counts
+            .iter()
+            .position(|(value, count, _, _)| {
+                // Other goes before the first row it outranks by count, then by value
+                if tied(&other.1, count) {
+                    return other.0 < *value;
+                }
+                if self.flag_asc {
+                    other.1 < *count
+                } else {
+                    other.1 > *count
+                }
+            })
+            .unwrap_or(counts.len());
+        counts.insert(pos, other);
     }
 
     /// Helper to move NULL category to end if not sorted.
-    /// Unlike `move_other_to_end_if_needed()` which only checks position 0 (since "Other" always
-    /// has rank 0 and appears first in ascending sort), NULL can appear anywhere based on its
-    /// count, so we need to search the entire list.
+    /// Unlike the "Other" row, which `counts()` always pushes last, NULL can appear anywhere based
+    /// on its count, so we need to search the entire list.
     /// This function handles multiple NULL entries (e.g., when literal "(NULL)" values exist
     /// in the data alongside empty strings that are converted to "(NULL)").
     fn move_null_to_end_if_needed<T: Copy>(&self, counts: &mut Vec<(Vec<u8>, T, f64, f64)>) {
@@ -2742,7 +2772,7 @@ impl Args {
 
         // For non-all-unique columns, process individual weighted values
         let mut counts_to_process = self.counts_weighted(weighted_map);
-        self.move_other_to_end_if_needed(&mut counts_to_process);
+        self.place_other_row(&mut counts_to_process, |a, b| weights_tied(*a, *b));
         self.move_null_to_end_if_needed(&mut counts_to_process);
 
         // Convert to processed frequencies (count is f64, convert to u64 for display)
@@ -2785,7 +2815,7 @@ impl Args {
         } else {
             // Process regular frequencies
             let mut counts_to_process = self.counts(ftab);
-            self.move_other_to_end_if_needed(&mut counts_to_process);
+            self.place_other_row(&mut counts_to_process, |a, b| a == b);
             self.move_null_to_end_if_needed(&mut counts_to_process);
 
             // Convert to processed frequencies
@@ -4198,50 +4228,6 @@ impl Args {
                                      processed_frequencies: &mut Vec<ProcessedFrequency>,
                                      field_stats: &mut Vec<FieldStats>,
                                      skip_stats: bool| {
-            // With --other-sorted, slot "Other" (rank 0), and NULL rows moved to the end, back
-            // into order, breaking ties by value for deterministic output. The ranked rows keep
-            // their established order: inside a weighted tie each row reports its own rounded
-            // total, which can differ by one, so re-sorting them by count would reorder a tie.
-            // For the same reason a ranked NULL goes back by rank, not by count. With
-            // --null-sorted, NULL rows were never moved, so they stay where they are.
-            if self.flag_other_sorted {
-                /
```

**File**: `tests/test_frequency.rs` (modified, +153/-41)
```diff
@@ -753,41 +753,43 @@ fn frequency_custom_other_text() {
     assert_eq!(got, expected);
 }
 
+// Output order is asserted unsorted: --limit 1 keeps z (3) in h2 while Other holds y, Y, x (4),
+// so --other-sorted must put Other FIRST there. In h1, Other (3) stays after a (4). These tests
+// used to sort their output, which let CSV ignore --other-sorted unnoticed (#4724).
 #[test]
 fn frequency_custom_other_text_sorted() {
     let (wrk, mut cmd) = setup("frequency_custom_other_text_sorted");
-    cmd.args(["--limit", "-4"])
-        .args(["--lmt-threshold", "4"])
+    cmd.args(["--limit", "1"])
         .args(["--other-text", "Ibang halaga"])
         .arg("--other-sorted")
         .arg("--pct-nulls");
 
-    let mut got: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
-    got.sort_unstable();
+    let got: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
     let expected = vec![
         svec!["field", "value", "count", "percentage", "rank"],
-        svec!["h1", "Ibang halaga (3)", "3", "42.85714", "0"],
         svec!["h1", "a", "4", "57.14286", "1"],
-        svec!["h2", "Ibang halaga (4)", "7", "100", "0"],
+        svec!["h1", "Ibang halaga (3)", "3", "42.85714", "0"],
+        svec!["h2", "Ibang halaga (3)", "4", "57.14286", "0"],
+        svec!["h2", "z", "3", "42.85714", "1"],
     ];
     assert_eq!(got, expected);
 }
 
+// See frequency_custom_other_text_sorted: asserted unsorted, Other outranks z in h2.
 #[test]
 fn frequency_other_sorted() {
     let (wrk, mut cmd) = setup("frequency_other_sorted");
-    cmd.args(["--limit", "-4"])
-        .args(["--lmt-threshold", "4"])
+    cmd.args(["--limit", "1"])
         .arg("--other-sorted")
         .arg("--pct-nulls");
 
-    let mut got: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
-    got.sort_unstable();
+    let got: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
     let expected = vec![
         svec!["field", "value", "count", "percentage", "rank"],
-        svec!["h1", "Other (3)", "3", "42.85714", "0"],
         svec!["h1", "a", "4", "57.14286", "1"],
-        svec!["h2", "Other (4)", "7", "100", "0"],
+        svec!["h1", "Other (3)", "3", "42.85714", "0"],
+        svec!["h2", "Other (3)", "4", "57.14286", "0"],
+        svec!["h2", "z", "3", "42.85714", "1"],
     ];
     assert_eq!(got, expected);
 }
@@ -2903,8 +2905,8 @@ fn frequency_weight_tie_keeps_own_counts_and_limits_by_value() {
 }
 
 // NULL's weights sum to 20.499999999999996 (count 20) and tie with b's 20.5 (count 21).
-// JSON --other-sorted must keep a ranked NULL in rank order, whether --null-sorted left it in
-// place or it was moved to the end and slotted back.
+// --other-sorted must not reorder that tie. With --null-sorted, NULL keeps its rank position;
+// without it, NULL goes to the end as documented (#4724) - in JSON and CSV alike.
 #[test]
 fn frequency_weight_other_sorted_keeps_ranked_null_tie_order() {
     let wrk = Workdir::new("frequency_weight_other_sorted_keeps_ranked_null_tie_order");
@@ -2945,23 +2947,41 @@ fn frequency_weight_other_sorted_keeps_ranked_null_tie_order() {
                 )
             })
             .collect();
+        let null = ("(NULL)".to_string(), 20, 1.0);
+        let b = ("b".to_string(), 21, 2.0);
+        let c = ("c".to_string(), 4, 3.0);
+        let expected = if null_sorted {
+            vec![null, b, c]
+        } else {
+            vec![b, c, null]
+        };
+        assert_eq!(got, expected, "null_sorted={null_sorted}");
+
+        let mut cmd = wrk.command("frequency");
+        cmd.arg("in.csv")
+            .args(["--weight", "w"])
+            .args(["--limit", "0"])
+            .args(["--rank-strategy", "ordinal"])
+            .arg("--pct-nulls")
+            .arg("--other-sorted");
+        if null_sorted {
+            cmd.arg("--null-sorted");
+        }
+        let csv: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
+        let csv_values: Vec<&str> = csv.iter().skip(1).map(|r| r[1].as_str()).collect();
+        let json_values: Vec<&str> = expected.iter().map(|(v, _, _)| v.as_str()).collect();
         assert_eq!(
-            got,
-            vec![
-                ("(NULL)".to_string(), 20, 1.0),
-                ("b".to_string(), 21, 2.0),
-                ("c".to_string(), 4, 3.0),
-            ],
-            "null_sorted={null_sorted}"
+            csv_values, json_values,
+            "CSV vs JSON, null_sorted={null_sorted}"
         );
     }
 }
 
-// Other must be placed by count against the COMPLETE ranked sequence, i.e. after the ranked
-// NULL is back in place: Other (21) sorts before NULL (20), even though it ties A's count.
+// Without --null-sorted, a ranked NULL still goes to the end (#4724), and Other is placed by
+// count among the remaining rows: Other (21) before A (20.5 -> 21), then NULL.
 #[test]
-fn frequency_weight_other_sorted_places_other_after_ranked_null() {
-    let wrk = Workdir::new("frequency_weight_other_sorted_places_other_after_ranked_null");
+fn frequency_weight
```

---

### Incident Patch 5: `9ca67c70` (2026-10-04)
**Commit Message**: fix(frequency): use a relative tolerance for weighted ties (#4720)

* fix(frequency): use a relative tolerance for weighted ties

Weighted totals were grouped into ties with an absolute tolerance:
f64::EPSILON for CSV output, and stddev(weight) * 1e-6 for JSON output
(STATS_RECORDS was only populated when is_json && --weight).

- EPSILON is below one ulp of any total above 2, so totals that are equal
  in exact arithmetic (e.g. 10.1 + 10.2 vs 20.3) got different ranks. In
  parallel runs, chunk sums are merged in arrival order, so ranks and row
  order also changed from run to run.
- The stats-scaled tolerance scales with the spread of individual weights,
  not with the size of the sum. With large weights it merged distinct
  totals (20000001 and 20000003) into one tie and reported the same count
  for both.

Ties are now detected with a relative tolerance (1e-9 of the larger
total) for both CSV and JSON. The name-keyed STATS_RECORDS plumbing,
which only existed for the old tolerance, is removed. Rows within a tie
group were already sorted by value, so output is now deterministic.

Tests: ulp-apart totals tie (sequential, CSV and JSON), large distinct
totals are not merged, and a 2

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -131,6 +131,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 - **`frequency --lmt-threshold` applied limits to the wrong columns.** Since the option was added, limits applied to columns with *at most* the threshold's number of unique values, the opposite of the documented behavior. They now apply, as documented, only to columns with *at least* that many unique values (e.g. `--limit 10 --lmt-threshold 50` caps high-cardinality columns and returns low-cardinality ones in full). When `--pct-nulls` is off (the default), NULL is not counted toward a column's unique values, and the top-N fast path now counts the same way as the full sort. **Behavior change:** runs that relied on the inverted behavior will produce different output. `--lmt-threshold 0` (the default) is unaffected.
+- **`frequency --weight` split or merged ties in weighted totals.** Totals were compared with an absolute tolerance that was `f64::EPSILON` for CSV output and `stddev(weight) × 1e-6` for JSON output. With fractional weights, totals that are equal in exact arithmetic but differ in their last bits (e.g. `10.1 + 10.2` vs `20.3`) got different ranks. In parallel runs this also made ranks and row order change from run to run, because chunk sums are merged in arrival order. With large weights, the JSON tolerance merged distinct totals (e.g. 20000001 and 20000003) into one tie and reported the same count for both. Ties are now detected with a relative tolerance (within 1e-9 of the tie's first total), so output is deterministic and CSV and JSON agree. Each row keeps its own total, so a tie never changes a reported count, and a `--limit` that cuts through a tie keeps the same values on every run. [#4719](https://github.com/dathere/qsv/issues/4719)
 - **`frequency --weight` dropped the "Other" row when a column had NULLs.** With NULL set aside (the default `--pct-nulls` off), NULL was subtracted from the column's unique count twice, so values past `--limit` could vanish from the output instead of being summed into "Other (N)". Unweighted output was not affected.
 - **`viz smart`: a constant date column no longer hides the time series and the seasonality ring.** A Date column holding a single value (e.g. a publication date stamped on every row, like Open Payments' `Payment_Publication_Date`) counts as "sorted", so it outranked the real event date when `viz smart` picked the column for the time-series panel and the cyclic (day-of-week/month) panel. Both then had a single bucket and were silently dropped, and stderr reported the event date as "no time panel could be drawn from it". Date columns with fewer than two distinct values are now skipped by both pickers.
 - **`viz --denominator census` no longer refuses the map over codes without ACS population** ([#4680](https://github.com/dathere/qsv/issues/4680)). A state column containing territory or military codes (AS, GU, MP, VI, AA/AE/AP, FM/MH/PW) failed the whole run with "not US state codes". Those regions are now excluded from the rate and reported, as the help text promised. The run fails only when no value is a state. The county path had a related bug. For a state it has no rows for (e.g. an island area's counties), the Census Data API returns HTTP 204 with an empty body. qsv misread that as a missing or invalid API key and aborted. Those counties are now excluded and reported too.
```

**File**: `src/cmd/frequency.rs` (modified, +154/-154)
```diff
@@ -396,11 +396,6 @@ pub struct Args {
 
 const NON_UTF8_ERR: &str = "<Non-UTF8 ERROR>";
 
-// Name-keyed stats records. Retained ONLY for lookups that legitimately address a
-// column by its user-specified name: the `--weight` column's tolerance scale and
-// `--stats-filter`. NOT used for per-output-column JSON stats (see STATS_RECORDS_BY_POS),
-// which must be positional so duplicate-named columns don't collapse onto one record.
-static STATS_RECORDS: OnceLock<HashMap<String, StatsData>> = OnceLock::new();
 // Per-output-column stats for JSON/TOON output, aligned positionally to the FINAL
 // selected columns (index = output column position). Positional — not name-keyed — so
 // duplicate-named columns each report their own stats.
@@ -1734,14 +1729,19 @@ fn apply_ranking_strategy_unweighted(
 
 #[allow(clippy::cast_precision_loss)]
 fn apply_ranking_strategy_weighted(
-    groups: Vec<(f64, Vec<Vec<u8>>)>,
+    groups: Vec<WeightGroup>,
     strategy: RankStrategy,
     pct_factor: f64,
     null_val: &[u8],
     pct_nulls: bool,
 ) -> (Vec<(Vec<u8>, f64, f64, f64)>, f64, f64) {
-    let mut counts_final: Vec<(Vec<u8>, f64, f64, f64)> =
-        Vec::with_capacity(groups.iter().map(|(_, group)| group.len()).sum::<usize>() + 1);
+    let mut counts_final: Vec<(Vec<u8>, f64, f64, f64)> = Vec::with_capacity(
+        groups
+            .iter()
+            .map(|(_, members)| members.len())
+            .sum::<usize>()
+            + 1,
+    );
     let mut current_rank = 1.0_f64;
     let mut count_sum = 0.0_f64;
     let mut pct_sum = 0.0_f64;
@@ -1774,32 +1774,29 @@ fn apply_ranking_strategy_weighted(
         match strategy {
             RankStrategy::Dense => {
                 // Dense ranking (1223)
-                for (weight, mut group) in groups {
-                    group.sort_unstable();
-                    for byte_string in group {
+                for (_, group) in groups {
+                    for (byte_string, weight) in group {
                         emit(byte_string, weight, current_rank);
                     }
                     current_rank += 1.0;
                 }
             },
             RankStrategy::Min => {
                 // Standard competition ranking (1224)
-                for (weight, mut group) in groups {
-                    group.sort_unstable();
+                for (_, group) in groups {
                     let group_len = group.len();
-                    for byte_string in group {
+                    for (byte_string, weight) in group {
                         emit(byte_string, weight, current_rank);
                     }
                     current_rank += group_len as f64;
                 }
             },
             RankStrategy::Max => {
                 // Modified competition ranking (1334)
-                for (weight, mut group) in groups {
-                    group.sort_unstable();
+                for (_, group) in groups {
                     let group_len = group.len();
                     let max_rank = current_rank + group_len as f64 - 1.0;
-                    for byte_string in group {
+                    for (byte_string, weight) in group {
                         emit(byte_string, weight, max_rank);
                     }
                     current_rank += group_len as f64;
@@ -1808,9 +1805,8 @@ fn apply_ranking_strategy_weighted(
             RankStrategy::Ordinal => {
                 // Ordinal ranking (1234). Sentinel-suppressed nulls do NOT
                 // consume a rank slot, matching the other strategies.
-                for (weight, mut group) in groups {
-                    group.sort_unstable();
-                    for byte_string in group {
+                for (_, group) in groups {
+                    for (byte_string, weight) in group {
                         let suppressed = emit(byte_string, weight, current_rank);
                         if !suppressed {
                             current_rank += 1.0;
@@ -1820,11 +1816,10 @@ fn apply_ranking_strategy_weighted(
             },
             RankStrategy::Average => {
                 // Fractional ranking (1 2.5 2.5 4)
-                for (weight, mut group) in groups {
-                    group.sort_unstable();
+                for (_, group) in groups {
                     let group_len = group.len();
                     let avg_rank = current_rank + (group_len as f64 - 1.0) / 2.0;
-                    for byte_string in group {
+                    for (byte_string, weight) in group {
                         emit(byte_string, weight, avg_rank);
                     }
                     current_rank += group_len as f64;
@@ -1836,27 +1831,42 @@ fn apply_ranking_strategy_weighted(
     (counts_final, count_sum, pct_sum)
 }
 
-/// Apply limits to weighted frequency counts
+/// Apply limits to weighted frequency tie groups
 ///
 /// # Arguments
-/// * `counts` - Mutable reference to vector of `(value, weight)` pairs
+/// * `groups` - M
```

**File**: `tests/test_frequency.rs` (modified, +372/-0)
```diff
@@ -2789,6 +2789,378 @@ fn frequency_weight_fractional_weights() {
     assert_eq!(got, expected);
 }
 
+// 10.1 + 10.2 sums to 20.299999999999997, one ulp below 20.3 (and more than
+// f64::EPSILON away), so "a" and "b" only tie under a relative tolerance (#4719).
+#[test]
+fn frequency_weight_ulp_apart_totals_tie() {
+    let wrk = Workdir::new("frequency_weight_ulp_apart_totals_tie");
+    let rows = vec![
+        svec!["value", "weight"],
+        svec!["a", "10.1"],
+        svec!["a", "10.2"],
+        svec!["b", "20.3"],
+        svec!["c", "5"],
+        svec!["c", "5"],
+    ];
+    wrk.create("in.csv", rows);
+    for json in [false, true] {
+        let mut cmd = wrk.command("frequency");
+        cmd.arg("in.csv")
+            .args(["--limit", "0"])
+            .args(["--weight", "weight"]);
+        let got: Vec<(String, f64)> = if json {
+            cmd.arg("--json");
+            let v: Value = serde_json::from_str(&wrk.stdout::<String>(&mut cmd)).unwrap();
+            v["fields"][0]["frequencies"]
+                .as_array()
+                .unwrap()
+                .iter()
+                .map(|f| {
+                    (
+                        f["value"].as_str().unwrap().to_string(),
+                        f["rank"].as_f64().unwrap(),
+                    )
+                })
+                .collect()
+        } else {
+            let rows: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
+            rows.into_iter()
+                .skip(1)
+                .map(|r| (r[1].clone(), r[4].parse().unwrap()))
+                .collect()
+        };
+        let expected = vec![
+            ("a".to_string(), 1.0),
+            ("b".to_string(), 1.0),
+            ("c".to_string(), 2.0),
+        ];
+        assert_eq!(got, expected, "json={json}");
+    }
+}
+
+// a's weights sum to 20.499999999999996, b's to 20.5: a tie, but on opposite sides of the
+// count's rounding boundary. Tie detection must not change either count (b used to inherit
+// a's weight and report 20), and limits must act on the value-ordered tie, so --limit 1
+// keeps "a" even though b's total sorts first by weight.
+#[test]
+fn frequency_weight_tie_keeps_own_counts_and_limits_by_value() {
+    let wrk = Workdir::new("frequency_weight_tie_keeps_own_counts_and_limits_by_value");
+    let rows = vec![
+        svec!["v", "w"],
+        svec!["a", "20"],
+        svec!["a", "0.15"],
+        svec!["a", "0.15"],
+        svec!["a", "0.15"],
+        svec!["a", "0.05"],
+        svec!["b", "20.5"],
+    ];
+    wrk.create("in.csv", rows);
+    let run = |extra: &[&str]| {
+        let mut cmd = wrk.command("frequency");
+        cmd.arg("in.csv").args(["--weight", "w"]).args(extra);
+        let got: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
+        got.into_iter()
+            .skip(1)
+            .map(|r| (r[1].clone(), r[2].clone(), r[4].clone()))
+            .collect::<Vec<_>>()
+    };
+    let both = vec![
+        ("a".to_string(), "20".to_string(), "1".to_string()),
+        ("b".to_string(), "21".to_string(), "1".to_string()),
+    ];
+    assert_eq!(run(&["--limit", "0"]), both);
+    assert_eq!(run(&["--limit", "0", "--asc"]), both);
+    assert_eq!(
+        run(&["--limit", "1", "--other-text", "<NONE>"]),
+        vec![("a".to_string(), "20".to_string(), "1".to_string())]
+    );
+
+    // JSON --other-sorted must not re-sort the tie by its members' (different) rounded counts
+    let mut cmd = wrk.command("frequency");
+    cmd.arg("in.csv")
+        .args(["--weight", "w"])
+        .args(["--limit", "0"])
+        .args(["--rank-strategy", "ordinal"])
+        .arg("--other-sorted")
+        .arg("--json");
+    let v: Value = serde_json::from_str(&wrk.stdout::<String>(&mut cmd)).unwrap();
+    let got: Vec<(String, u64, f64)> = v["fields"][0]["frequencies"]
+        .as_array()
+        .unwrap()
+        .iter()
+        .map(|f| {
+            (
+                f["value"].as_str().unwrap().to_string(),
+                f["count"].as_u64().unwrap(),
+                f["rank"].as_f64().unwrap(),
+            )
+        })
+        .collect();
+    assert_eq!(
+        got,
+        vec![("a".to_string(), 20, 1.0), ("b".to_string(), 21, 2.0)]
+    );
+}
+
+// NULL's weights sum to 20.499999999999996 (count 20) and tie with b's 20.5 (count 21).
+// JSON --other-sorted must keep a ranked NULL in rank order, whether --null-sorted left it in
+// place or it was moved to the end and slotted back.
+#[test]
+fn frequency_weight_other_sorted_keeps_ranked_null_tie_order() {
+    let wrk = Workdir::new("frequency_weight_other_sorted_keeps_ranked_null_tie_order");
+    let rows = vec![
+        svec!["v", "w"],
+        svec!["", "20"],
+        svec!["", "0.15"],
+        svec!["", "0.15"],
+        svec!["", "0.15"],
+        svec!["", "0.05"],
+        svec!["b", "20.5"],
+        svec!["c", "3"],
+        svec!["c", "1"],
+    ];
+    wrk.create("in.csv", rows);
+    for null_sorted in [true,
```

---

### Incident Patch 6: `05606c72` (2026-10-04)
**Commit Message**: fix(frequency): `--lmt-threshold` applies limits to columns with >= N unique values (#4717)

* fix(frequency): `--lmt-threshold` applies limits to columns with >= N unique values

Since the option was added (12ce3eaf9), the check was
`lmt_threshold >= unique_count`, so limits applied to columns with AT MOST
the threshold's unique values: the opposite of the help text, the commit
message, and docs/STATS_DEFINITIONS.md ("only apply limits when unique
count >= N"). Flip the comparison in apply_limits_unweighted,
apply_limits_weighted, and the counts() top-N fast path.

With --pct-nulls off (the default), the full-sort path sets the NULL
bucket aside before testing the threshold; the fast path counted it. That
was harmless while inverted, but after the flip the two paths would
disagree for a column whose count including NULL equals the threshold, so
the fast path now uses the same count.

Tests: frequency_limit_threshold_notmet asserted the inverted behavior
(both fixture columns have 4 unique values, so threshold 3 is met); it
now uses threshold 5. New tests cover mixed cardinality (unweighted and
--weight) and the NULL boundary with --pct-nulls off/on. Each fix was
mutation-tested: r

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -126,6 +126,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **`frequency`: the frequency cache now validates the qsv version that wrote it, and self-heals when it is stale** ([#4618](https://github.com/dathere/qsv/pull/4618)). `.freq.csv.data.jsonl` always recorded `qsv_version` but never compared it, so a cache written by an older qsv - whose `<ALL_UNIQUE>`/HIGH_CARDINALITY sentinels, percentages or ranks may no longer match - was served indefinitely. Because `frequency` only writes its cache under `--frequency-jsonl`, a bare version check would have turned every upgrade into a permanent cache miss; instead the run that rejects a version-stale cache recomputes and rewrites it in place. The version is compared only after every option check agrees, only when the cached column selection matches this run's, and only when a cache file already exists - so it refreshes caches but never creates one. `viz` rejects a version-stale cache without rewriting it and falls back to its own computation.
 
 ### Fixed
+- **`frequency --lmt-threshold` applied limits to the wrong columns.** Since the option was added, limits applied to columns with *at most* the threshold's number of unique values, the opposite of the documented behavior. They now apply, as documented, only to columns with *at least* that many unique values (e.g. `--limit 10 --lmt-threshold 50` caps high-cardinality columns and returns low-cardinality ones in full). When `--pct-nulls` is off (the default), NULL is not counted toward a column's unique values, and the top-N fast path now counts the same way as the full sort. **Behavior change:** runs that relied on the inverted behavior will produce different output. `--lmt-threshold 0` (the default) is unaffected.
+- **`frequency --weight` dropped the "Other" row when a column had NULLs.** With NULL set aside (the default `--pct-nulls` off), NULL was subtracted from the column's unique count twice, so values past `--limit` could vanish from the output instead of being summed into "Other (N)". Unweighted output was not affected.
 - **`viz smart`: a constant date column no longer hides the time series and the seasonality ring.** A Date column holding a single value (e.g. a publication date stamped on every row, like Open Payments' `Payment_Publication_Date`) counts as "sorted", so it outranked the real event date when `viz smart` picked the column for the time-series panel and the cyclic (day-of-week/month) panel. Both then had a single bucket and were silently dropped, and stderr reported the event date as "no time panel could be drawn from it". Date columns with fewer than two distinct values are now skipped by both pickers.
 - **`viz --denominator census` no longer refuses the map over codes without ACS population** ([#4680](https://github.com/dathere/qsv/issues/4680)). A state column containing territory or military codes (AS, GU, MP, VI, AA/AE/AP, FM/MH/PW) failed the whole run with "not US state codes". Those regions are now excluded from the rate and reported, as the help text promised. The run fails only when no value is a state. The county path had a related bug. For a state it has no rows for (e.g. an island area's counties), the Census Data API returns HTTP 204 with an empty body. qsv misread that as a missing or invalid API key and aborted. Those counties are now excluded and reported too.
 - **`viz --geojson auto`/`census:*`: nationwide Census boundaries failed with "Census response is not valid JSON"** ([#4682](https://github.com/dathere/qsv/issues/4682)). When a dataset spanned most of the country, qsv fetched every county in 52 states at full survey resolution, 500 per page. TIGERweb's firewall refuses any response much over ~25 MB, and it does so with HTTP 200 and an HTML "Request Rejected" page, which qsv then tried to parse as JSON. The Census tests use a mock service with one or two states, so they could not catch it.
```

**File**: `src/cmd/frequency.rs` (modified, +17/-8)
```diff
@@ -1818,11 +1818,11 @@ fn apply_ranking_strategy_weighted(
 ///   only values with weight greater than or equal to the absolute value of this limit; if zero, no
 ///   limits are applied
 /// * `lmt_threshold` - Threshold controlling when limits are applied. Limits are applied when this
-///   is 0 or when it is greater than or equal to the number of unique values; when this is a
-///   positive number less than the unique count, no limits are applied.
+///   is 0 or when the number of unique values is greater than or equal to it; a column with fewer
+///   unique values than a positive threshold is returned in full.
 fn apply_limits_weighted(counts: &mut Vec<(Vec<u8>, f64)>, limit: isize, lmt_threshold: usize) {
     let unique_counts_len = counts.len();
-    if lmt_threshold == 0 || lmt_threshold >= unique_counts_len {
+    if lmt_threshold == 0 || unique_counts_len >= lmt_threshold {
         let abs_limit = limit.unsigned_abs();
 
         #[allow(clippy::cast_precision_loss)]
@@ -1842,8 +1842,8 @@ fn apply_limits_weighted(counts: &mut Vec<(Vec<u8>, f64)>, limit: isize, lmt_thr
 /// * `limit` - Limit value (positive = top N, negative = threshold)
 /// * `unq_limit` - Unique limit for all-unique columns
 /// * `lmt_threshold` - Threshold controlling when limits are applied. Limits are applied when this
-///   is 0 or when it is >= the number of unique values. When this is a positive number less than
-///   the unique count, no limits are applied.
+///   is 0 or when the number of unique values is >= it. A column with fewer unique values than a
+///   positive threshold is returned in full.
 /// * `all_unique` - Whether the column has all unique values
 fn apply_limits_unweighted(
     counts: &mut Vec<(Vec<u8>, u64)>,
@@ -1853,7 +1853,7 @@ fn apply_limits_unweighted(
     all_unique: bool,
 ) {
     let unique_counts_len = counts.len();
-    if lmt_threshold == 0 || lmt_threshold >= unique_counts_len {
+    if lmt_threshold == 0 || unique_counts_len >= lmt_threshold {
         let abs_limit = limit.unsigned_abs();
         let unique_limited = if all_unique && limit > 0 && unq_limit != abs_limit && unq_limit > 0 {
             counts.truncate(unq_limit);
@@ -3013,7 +3013,8 @@ impl Args {
             // Subtract null_weight from other_weight since NULL is handled separately
             (
                 total_weight - count_sum - null_weight,
-                unique_counts_len.saturating_sub(1), // NULL was removed from counts
+                // unlike counts(), unique_counts_len was taken after NULL left `counts`
+                unique_counts_len,
             )
         } else {
             (total_weight - count_sum, unique_counts_len)
@@ -3077,8 +3078,16 @@ impl Args {
             abs_limit
         };
 
+        // apply_limits_unweighted tests the threshold after the NULL bucket is set aside
+        // (when --pct-nulls is off), so use that same count here or the two paths could
+        // disagree for a column whose count including NULL equals the threshold.
+        let threshold_unique_count = if !self.flag_pct_nulls && ftab.count(&Vec::new()) > 0 {
+            unique_counts_len - 1
+        } else {
+            unique_counts_len
+        };
         let threshold_fires =
-            self.flag_lmt_threshold == 0 || self.flag_lmt_threshold >= unique_counts_len;
+            self.flag_lmt_threshold == 0 || threshold_unique_count >= self.flag_lmt_threshold;
         let use_topn =
             self.flag_limit > 0 && threshold_fires && effective_limit < unique_counts_len;
 
```

**File**: `tests/test_frequency.rs` (modified, +139/-1)
```diff
@@ -380,9 +380,10 @@ fn frequency_limit_threshold() {
 
 #[test]
 fn frequency_limit_threshold_notmet() {
+    // both columns have 4 unique values, below the threshold of 5
     let (wrk, mut cmd) = setup("frequency_limit_threshold_notmet");
     cmd.args(["--limit", "-2"])
-        .args(["--lmt-threshold", "3"])
+        .args(["--lmt-threshold", "5"])
         .arg("--pct-nulls");
 
     let mut got: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
@@ -401,6 +402,143 @@ fn frequency_limit_threshold_notmet() {
     assert_eq!(got, expected);
 }
 
+// --lmt-threshold applies limits only to columns with at least that many unique values:
+// `hi` (6 unique) is limited, `lo` (2 unique) is returned in full.
+fn setup_lmt_threshold_mixed(name: &str) -> (Workdir, process::Command) {
+    let rows = vec![
+        svec!["lo", "hi", "w"],
+        svec!["x", "a", "1"],
+        svec!["x", "a", "1"],
+        svec!["x", "a", "1"],
+        svec!["y", "b", "1"],
+        svec!["y", "c", "1"],
+        svec!["x", "d", "1"],
+        svec!["y", "e", "1"],
+        svec!["x", "f", "1"],
+    ];
+    let wrk = Workdir::new(name);
+    wrk.create("in.csv", rows);
+    let mut cmd = wrk.command("frequency");
+    cmd.arg("in.csv")
+        .args(["--limit", "1"])
+        .args(["--lmt-threshold", "4"]);
+    (wrk, cmd)
+}
+
+fn lmt_threshold_mixed_expected() -> Vec<Vec<String>> {
+    vec![
+        svec!["field", "value", "count", "percentage", "rank"],
+        svec!["lo", "x", "5", "62.5", "1"],
+        svec!["lo", "y", "3", "37.5", "2"],
+        svec!["hi", "a", "3", "37.5", "1"],
+        svec!["hi", "Other (5)", "5", "62.5", "0"],
+    ]
+}
+
+#[test]
+fn frequency_limit_threshold_limits_only_high_cardinality() {
+    let (wrk, mut cmd) = setup_lmt_threshold_mixed("frequency_lmt_threshold_high_card");
+    cmd.args(["--select", "lo,hi"]);
+
+    let got: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
+    assert_eq!(got, lmt_threshold_mixed_expected());
+}
+
+#[test]
+fn frequency_limit_threshold_limits_only_high_cardinality_weighted() {
+    let (wrk, mut cmd) = setup_lmt_threshold_mixed("frequency_lmt_threshold_high_card_weighted");
+    cmd.args(["--select", "lo,hi,w"]).args(["--weight", "w"]);
+
+    let got: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
+    assert_eq!(got, lmt_threshold_mixed_expected());
+}
+
+// `v` has 4 unique values counting NULL, 3 without. With --pct-nulls off (the default),
+// NULL is set aside before the threshold is tested, so 3 < 4 and `v` is returned in full;
+// the top-N fast path must agree with the full-sort path on that count.
+fn setup_lmt_threshold_null_boundary(name: &str) -> (Workdir, process::Command) {
+    let rows = vec![
+        svec!["v", "k"],
+        svec!["a", "1"],
+        svec!["a", "1"],
+        svec!["a", "1"],
+        svec!["b", "1"],
+        svec!["c", "1"],
+        svec!["", "1"],
+    ];
+    let wrk = Workdir::new(name);
+    wrk.create("in.csv", rows);
+    let mut cmd = wrk.command("frequency");
+    cmd.arg("in.csv")
+        .args(["--select", "v"])
+        .args(["--limit", "1"])
+        .args(["--lmt-threshold", "4"]);
+    (wrk, cmd)
+}
+
+#[test]
+fn frequency_limit_threshold_null_set_aside() {
+    let (wrk, mut cmd) = setup_lmt_threshold_null_boundary("frequency_lmt_threshold_null_aside");
+
+    let got: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
+    let expected = vec![
+        svec!["field", "value", "count", "percentage", "rank"],
+        svec!["v", "a", "3", "60", "1"],
+        svec!["v", "b", "1", "20", "2"],
+        svec!["v", "c", "1", "20", "2"],
+        svec!["v", "(NULL)", "1", "", ""],
+    ];
+    assert_eq!(got, expected);
+}
+
+#[test]
+fn frequency_limit_threshold_null_counted() {
+    let (wrk, mut cmd) = setup_lmt_threshold_null_boundary("frequency_lmt_threshold_null_counted");
+    cmd.arg("--pct-nulls");
+
+    let got: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
+    let expected = vec![
+        svec!["field", "value", "count", "percentage", "rank"],
+        svec!["v", "a", "3", "50", "1"],
+        svec!["v", "Other (3)", "3", "50", "0"],
+    ];
+    assert_eq!(got, expected);
+}
+
+// With a NULL set aside, the weighted "Other" row must still account for the values
+// past --limit; NULL was subtracted from the unique count twice, dropping `b` entirely.
+#[test]
+fn frequency_weighted_other_with_null() {
+    let wrk = Workdir::new("frequency_weighted_other_with_null");
+    let rows = vec![
+        svec!["v", "w"],
+        svec!["a", "1"],
+        svec!["a", "1"],
+        svec!["a", "1"],
+        svec!["b", "1"],
+        svec!["", "1"],
+    ];
+    wrk.create("in.csv", rows);
+
+    for threshold in ["0", "1"] {
+        let mut cmd = wrk.command("frequency");
+        cmd.arg("in.csv")
+            .args(["--select", "v,w"])
+            .args(["--weight", "w"])
+            .args(["--limit", "1"])
+            .args(["--lmt-threshold", threshold]);
+
+        let got: Vec<Vec<String>> = wr
```

---

### Incident Patch 7: `10cdbe09` (2026-10-03)
**Commit Message**: fix: keep moarstats enrichment for symlinked inputs (#4697) (#4713)

* fix: keep moarstats enrichment for symlinked inputs (#4697)

`stats` and `moarstats` write their cache files beside the path as given,
but stats-cache readers (`util::get_stats_records`) look up
`.stats.csv.data.jsonl` beside the canonicalized target. For a symlinked
input the enriched JSONL was never read: moarstats' internal `frequency`
pass and then `viz smart --smarter` found no current canonical cache,
re-ran plain `stats` on the link, clobbered the enriched `.stats.csv` and
synced lean (no --infer-dates) metadata — silently dropping the
moarstats-driven panels (Lorenz, Gini).

Add `util::mirror_stats_jsonl_to_canonical`, called by `stats` (fresh
--stats-jsonl write) and `moarstats` (default output, non-joined), which
also writes the JSONL and syncs its `.stats.csv.json` sidecar beside the
canonical target. The sidecar sync is extracted from `get_stats_records`
into `util::sync_stats_metadata_to_canonical` so all three share it.
No-op for regular files.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: sync the canonical stats cache pair before the JSONL; skip weighted (roborev 4985)

- Sync the `

**File**: `src/cmd/moarstats.rs` (modified, +13/-0)
```diff
@@ -7783,6 +7783,19 @@ pub fn run(argv: &[&str]) -> CliResult<()> {
         ) {
             wwarn!("Failed to regenerate stats JSONL cache: {e}");
         }
+
+        // Stats-cache readers (`util::get_stats_records`, which `viz smart --smarter` feeds from
+        // this very run) look up the JSONL beside the CANONICALIZED input; for a symlink the
+        // enriched JSONL above would otherwise never be read (#4697). Only for the default
+        // cache location — an explicit --output or a --join-inputs run is not the input's cache.
+        if args.flag_output.is_none() && temp_joined_path.is_none() {
+            util::mirror_stats_jsonl_to_canonical(
+                output_path_str,
+                &jsonl_path,
+                input_path,
+                actual_input_path,
+            );
+        }
     } else {
         wwarn!(
             "Output path {:?} is not valid UTF-8, skipping JSONL cache regeneration",
```

**File**: `src/cmd/stats.rs` (modified, +18/-0)
```diff
@@ -2532,6 +2532,15 @@ pub fn run(argv: &[&str]) -> CliResult<()> {
                     b',', // cache is always CSV (comma-delimited)
                     &path,
                 )?;
+                // readers look the (unweighted) JSONL up beside the canonicalized input (#4697)
+                if args.flag_weight.is_none() {
+                    util::mirror_stats_jsonl_to_canonical(
+                        &currstats_filename,
+                        &stats_jsonl_pathbuf,
+                        &path,
+                        &path,
+                    );
+                }
             }
         } else if compute_stats {
             // We just recomputed and installed a stats.csv but are NOT writing a sidecar
@@ -2606,6 +2615,15 @@ pub fn run(argv: &[&str]) -> CliResult<()> {
                     &path,
                 )?;
             }
+            // a cache hit through a symlink must prewarm the canonical JSONL too (#4697)
+            if args.flag_weight.is_none() {
+                util::mirror_stats_jsonl_to_canonical(
+                    &currstats_filename,
+                    &stats_jsonl_pathbuf,
+                    &path,
+                    &path,
+                );
+            }
         }
     }
 
```

**File**: `src/util.rs` (modified, +128/-32)
```diff
@@ -3952,6 +3952,123 @@ fn stats_cache_parsing_opts_conflict(
     false
 }
 
+/// Keep the stats cache pair (`.stats.csv` + its `.stats.csv.json` metadata sidecar) beside the
+/// CANONICAL target in sync with the pair beside the path as GIVEN.
+///
+/// Stats-cache readers look up `.stats.csv.data.jsonl` beside the canonicalized input, but `stats`
+/// and `moarstats` write their cache files beside the path they were given. Those coincide for an
+/// ordinary input and diverge for a symlink — and a divergence is not merely a missing sidecar:
+/// an earlier direct run on the target leaves a canonical sidecar that keeps describing itself as
+/// current while a run via the link replaces the canonical JSONL underneath it. A later direct run
+/// then reads stale-but-matching metadata and reuses a cache built with different parsing options.
+///
+/// The `.stats.csv` travels WITH its sidecar: replacing only the metadata would let `stats` itself
+/// validate the canonical `.stats.csv` from a different run against the copied args and serve it.
+/// When there is no given-side `.stats.csv` to copy, the canonical one is removed instead. The
+/// canonical JSONL is invalidated FIRST (if that fails, nothing is touched and the old provenance
+/// stands), then the canonical sidecar, so a failure part-way leaves no metadata vouching for a
+/// mismatched `.stats.csv` and no JSONL whose provenance is gone. Callers write the canonical JSONL
+/// afterwards, and must not leave it published when this returns `false`. The `.stats.csv`
+/// copy goes through `DerivedFile`, like every other stats cache, so it never grants access the
+/// input does not.
+///
+/// Call this BEFORE writing the canonical JSONL: `stats_jsonl_predates_stats_cache` rejects a JSONL
+/// older than either sidecar, and `fs::copy` stamps a fresh mtime on Linux.
+///
+/// Returns whether the canonical pair now mirrors the given one (trivially `true` when there is
+/// nothing to sync). Never errors: a stale sidecar is only a cache-reuse hint, so a failure is
+/// logged and reported through the return value.
+pub fn sync_stats_cache_to_canonical(input_path: &Path, canonical_input_path: &Path) -> bool {
+    let given_metadata = input_path.with_extension("stats.csv.json");
+    let canonical_metadata = canonical_input_path.with_extension("stats.csv.json");
+    // Compare RESOLVED paths, not the raw ones: for an ordinary input these name the same
+    // file via a relative and an absolute path, and `fs::copy` onto itself truncates it —
+    // which corrupts the very metadata this is meant to keep trustworthy.
+    let same_file = match (
+        given_metadata.canonicalize(),
+        canonical_metadata.canonicalize(),
+    ) {
+        (Ok(a), Ok(b)) => a == b,
+        _ => false,
+    };
+    if same_file || !given_metadata.exists() {
+        return true;
+    }
+
+    let remove_if_present = |p: &Path| match std::fs::remove_file(p) {
+        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(CliError::from(e)),
+        _ => Ok(()),
+    };
+    let given_stats = input_path.with_extension("stats.csv");
+    let canonical_stats = canonical_input_path.with_extension("stats.csv");
+    let synced = remove_if_present(&canonical_input_path.with_extension("stats.csv.data.jsonl"))
+        .and_then(|()| remove_if_present(&canonical_metadata))
+        .and_then(|()| {
+            if given_stats.exists() {
+                let mut installed =
+                    DerivedFile::create(canonical_input_path, &canonical_stats, "statscache")?;
+                std::io::copy(&mut File::open(&given_stats)?, &mut installed)?;
+                installed.install()
+            } else {
+                remove_if_present(&canonical_stats)
+            }
+        })
+        .and_then(|()| {
+            std::fs::copy(&given_metadata, &canonical_metadata)?;
+            Ok(())
+        });
+    if let Err(e) = synced {
+        log::warn!(
+            "could not sync stats cache beside {}: {e}",
+            canonical_input_path.display()
+        );
+        return false;
+    }
+    true
+}
+
+/// For a symlinked input, also write the `.stats.csv.data.jsonl` cache (and sync the stats cache
+/// pair it was built from) beside the CANONICAL target — the location every stats-cache reader
+/// looks it up — since `stats`/`moarstats` write their cache files beside the path as given
+/// (#4697). Only for the UNWEIGHTED cache: readers never consult `.stats.weighted.csv*`, so callers
+/// must not pass a weighted run.
+///
+/// `jsonl_written` is the JSONL the caller just wrote beside `input_path`, converted from
+/// `stats_csv`; `permission_source` is passed through to `csv_to_jsonl`. A no-op when the two
+/// locations resolve to the same file. Best-effort: a failure is logged, never returned, since the
+/// caller's own cache was written and the reader falls back to regenerating.
+pub fn mirror_stats_jsonl_to_canonical(
+    stats_csv: &str,
+    jsonl_
```

**File**: `tests/test_moarstats.rs` (modified, +36/-0)
```diff
@@ -218,6 +218,42 @@ fn moarstats_auto_generate_stats() {
     );
 }
 
+#[cfg(unix)]
+#[test]
+fn moarstats_symlinked_input_writes_enriched_canonical_jsonl() {
+    // REGRESSION (#4697): stats-cache readers look up `.stats.csv.data.jsonl` beside the
+    // CANONICALIZED input, but moarstats wrote its enriched JSONL only beside the symlink, so
+    // consumers (e.g. `viz smart --smarter`) never saw the moarstats columns.
+    let wrk = Workdir::new("moarstats_symlinked_input_writes_enriched_canonical_jsonl");
+    std::fs::create_dir_all(wrk.path("sub")).unwrap();
+    let mut csv = String::from("cat,amount\n");
+    for i in 1..=60_u64 {
+        csv.push_str(&format!(
+            "{},{}\n",
+            ["a", "b", "c"][(i % 3) as usize],
+            i.pow(2)
+        ));
+    }
+    std::fs::write(wrk.path("sub/target.csv"), &csv).unwrap();
+    std::os::unix::fs::symlink(wrk.path("sub/target.csv"), wrk.path("link.csv")).unwrap();
+
+    let mut cmd = wrk.command("moarstats");
+    cmd.args(["--advanced", "link.csv"]);
+    wrk.assert_success(&mut cmd);
+
+    let canonical_jsonl = wrk
+        .read_to_string("sub/target.stats.csv.data.jsonl")
+        .expect("JSONL cache must be written beside the symlink target");
+    assert!(
+        canonical_jsonl.contains("gini_coefficient"),
+        "canonical JSONL must carry moarstats' columns: {canonical_jsonl}"
+    );
+    assert!(
+        wrk.path("sub/target.stats.csv.json").exists(),
+        "the metadata sidecar must accompany the canonical JSONL"
+    );
+}
+
 #[test]
 fn moarstats_custom_output() {
     let wrk = Workdir::new("moarstats_custom_output");
```

**File**: `tests/test_stats.rs` (modified, +91/-0)
```diff
@@ -4783,6 +4783,97 @@ fn stats_weighted_mean_simple() {
     );
 }
 
+#[test]
+fn stats_weighted_stats_jsonl_does_not_write_unweighted_cache() {
+    // REGRESSION (roborev 4985): the #4697 canonical-JSONL mirror targeted the UNWEIGHTED name,
+    // so a weighted run wrote weighted results into `<stem>.stats.csv.data.jsonl`, which readers
+    // then consumed as the unweighted cache.
+    let wrk = Workdir::new("stats_weighted_stats_jsonl_does_not_write_unweighted_cache");
+    wrk.create_from_string("data.csv", "a,w\n1,1\n2,2\n3,3\n");
+    let mut cmd = wrk.command("stats");
+    cmd.args([
+        "--weight",
+        "w",
+        "--stats-jsonl",
+        "--cache-threshold",
+        "1",
+        "data.csv",
+    ]);
+    wrk.assert_success(&mut cmd);
+    assert!(wrk.path("data.stats.weighted.csv.data.jsonl").exists());
+    assert!(
+        !wrk.path("data.stats.csv.data.jsonl").exists(),
+        "a weighted run must not write the unweighted JSONL cache"
+    );
+}
+
+#[cfg(unix)]
+#[test]
+fn stats_symlink_run_does_not_pair_canonical_cache_with_foreign_metadata() {
+    // REGRESSION (roborev 4985): syncing ONLY the metadata sidecar beside the symlink target left
+    // the target's `.stats.csv` from a different run paired with it, so a direct run with the
+    // symlink run's options validated the sidecar and served the stale CSV.
+    let wrk = Workdir::new("stats_symlink_run_does_not_pair_canonical_cache_with_foreign_metadata");
+    std::fs::create_dir_all(wrk.path("sub")).unwrap();
+    wrk.create_from_string("sub/target.csv", "h1,h2\n1,2\n3,4\n5,6\n");
+    std::os::unix::fs::symlink(wrk.path("sub/target.csv"), wrk.path("link.csv")).unwrap();
+
+    let run = |args: &[&str]| -> String {
+        let mut cmd = wrk.command("stats");
+        cmd.args(args);
+        wrk.stdout::<String>(&mut cmd)
+    };
+    run(&["-E", "--cache-threshold", "1", "sub/target.csv"]);
+    let via_link = run(&[
+        "-E",
+        "--no-headers",
+        "--stats-jsonl",
+        "--cache-threshold",
+        "1",
+        "link.csv",
+    ]);
+    let direct = run(&[
+        "-E",
+        "--no-headers",
+        "--cache-threshold",
+        "1",
+        "sub/target.csv",
+    ]);
+    assert_eq!(
+        direct, via_link,
+        "a direct --no-headers run must not be served the headered canonical .stats.csv"
+    );
+}
+
+#[cfg(unix)]
+#[test]
+fn stats_symlink_failed_canonical_sync_publishes_no_unvouched_jsonl() {
+    // REGRESSION (roborev 4986/4987): when syncing the stats cache beside the symlink target
+    // fails part-way (here: a DIRECTORY sits where the canonical `.stats.csv` goes), the canonical
+    // sidecar is already gone, so a JSONL published there would carry no provenance and be
+    // accepted by later runs with different parsing options. `frequency` reaches this through
+    // `get_stats_records`; the mismatched parsing option forces it to regenerate via the link.
+    let wrk = Workdir::new("stats_symlink_failed_canonical_sync_publishes_no_unvouched_jsonl");
+    std::fs::create_dir_all(wrk.path("sub")).unwrap();
+    wrk.create_from_string("sub/target.csv", "h\n1\n1\n2\n");
+    std::os::unix::fs::symlink(wrk.path("sub/target.csv"), wrk.path("link.csv")).unwrap();
+
+    let mut cmd = wrk.command("stats");
+    cmd.args(["--stats-jsonl", "--cache-threshold", "1", "sub/target.csv"]);
+    wrk.assert_success(&mut cmd);
+    assert!(wrk.path("sub/target.stats.csv.data.jsonl").exists());
+    std::fs::remove_file(wrk.path("sub/target.stats.csv")).unwrap();
+    std::fs::create_dir(wrk.path("sub/target.stats.csv")).unwrap();
+
+    let mut cmd = wrk.command("frequency");
+    cmd.args(["--no-headers", "link.csv"]);
+    wrk.assert_success(&mut cmd);
+    assert!(
+        !wrk.path("sub/target.stats.csv.data.jsonl").exists(),
+        "a failed sync must leave no canonical JSONL without its metadata sidecar"
+    );
+}
+
 #[test]
 fn stats_weighted_mean_vs_unweighted() {
     let wrk = Workdir::new("stats_weighted_mean_vs_unweighted");
```

**File**: `tests/test_viz.rs` (modified, +46/-0)
```diff
@@ -16800,6 +16800,52 @@ fn viz_smart_symlinked_input_is_unaffected_by_a_prior_no_headers_run() {
     );
 }
 
+#[cfg(unix)]
+#[test]
+fn viz_smart_smarter_symlinked_input_keeps_moarstats_panels() {
+    // REGRESSION (#4697): stats/moarstats wrote their cache beside the SYMLINK while
+    // `get_stats_records` reads the JSONL beside the canonical TARGET, so `--smarter` never saw
+    // the moarstats enrichment, regenerated plain stats and silently dropped the moarstats-driven
+    // panels (Lorenz curves among them). A symlink must chart exactly what a copy charts.
+    let wrk = Workdir::new("viz_smart_smarter_symlinked_input_keeps_moarstats_panels");
+    std::fs::create_dir_all(wrk.path("sub")).unwrap();
+    let mut csv = String::from("cat,amount\n");
+    for i in 1..=120_u64 {
+        csv.push_str(&format!(
+            "{},{}\n",
+            ["a", "b", "c", "d", "e"][(i % 5) as usize],
+            i.pow(3)
+        ));
+    }
+    std::fs::write(wrk.path("sub/target.csv"), &csv).unwrap();
+    std::fs::write(wrk.path("copy.csv"), &csv).unwrap();
+    std::os::unix::fs::symlink(wrk.path("sub/target.csv"), wrk.path("link.csv")).unwrap();
+
+    let render = |input: &str, name: &str| {
+        let out = wrk.path(name).to_string_lossy().to_string();
+        let mut cmd = wrk.command("viz");
+        cmd.args(["smart", input, "--smarter", "-o", &out]);
+        wrk.assert_success(&mut cmd);
+        wrk.read_to_string(name).unwrap().matches("Lorenz").count()
+    };
+
+    let copy_lorenz = render("copy.csv", "copy.html");
+    assert!(
+        copy_lorenz > 0,
+        "fixture must yield a Lorenz panel for a regular file"
+    );
+    assert_eq!(
+        render("link.csv", "link.html"),
+        copy_lorenz,
+        "a symlinked input must chart the same moarstats panels as a copy"
+    );
+    let link_stats = wrk.read_to_string("link.stats.csv").unwrap();
+    assert!(
+        link_stats.contains("gini_coefficient"),
+        "the enriched .stats.csv beside the symlink must not be clobbered by plain stats"
+    );
+}
+
 #[cfg(unix)]
 #[test]
 fn viz_smart_direct_read_is_unaffected_by_a_prior_symlink_no_headers_run() {
```

---

### Incident Patch 8: `3faf78a8` (2026-10-02)
**Commit Message**: build(deps): bump dtolnay/rust-toolchain (#4705)

Bumps [dtolnay/rust-toolchain](https://github.com/dtolnay/rust-toolchain) from 02cb101ec7c40f2c49e1d9714d64511d8e1b74de to 7e38f4b43b4db5c8dd498af069a4f6196df1d067.
- [Release notes](https://github.com/dtolnay/rust-toolchain/releases)
- [Commits](https://github.com/dtolnay/rust-toolchain/compare/02cb101ec7c40f2c49e1d9714d64511d8e1b74de...7e38f4b43b4db5c8dd498af069a4f6196df1d067)

---
updated-dependencies:
- dependency-name: dtolnay/rust-toolchain
  dependency-version: 7e38f4b43b4db5c8dd498af069a4f6196df1d067
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/avx512-bench.yml` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ jobs:
           fi
 
       # Third-party actions pinned to full commit SHAs (Codacy security rule).
-      - uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # master @ 2026-06-01
+      - uses: dtolnay/rust-toolchain@7e38f4b43b4db5c8dd498af069a4f6196df1d067 # master @ 2026-06-01
         with:
           toolchain: stable
       - uses: Swatinem/rust-cache@c19371144df3bb44fab255c43d04cbc2ab54d1c4 # v2.9.1
```

**File**: `.github/workflows/rust-linux-arm64.yml` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ jobs:
     # Third-party actions pinned to full commit SHAs (Codacy security rule), matching
     # avx512-bench.yml. Older workflows predate the rule and are grandfathered.
     - name: Installing Rust toolchain
-      uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # master @ 2026-06-01
+      uses: dtolnay/rust-toolchain@7e38f4b43b4db5c8dd498af069a4f6196df1d067 # master @ 2026-06-01
       with:
         toolchain: stable
         targets: aarch64-unknown-linux-gnu
```

---

### Incident Patch 9: `2feabd07` (2026-10-02)
**Commit Message**: build(deps): bump anthropics/claude-code-action from 1.0.236 to 1.0.237 (#4706)

Bumps [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) from 1.0.236 to 1.0.237.
- [Release notes](https://github.com/anthropics/claude-code-action/releases)
- [Commits](https://github.com/anthropics/claude-code-action/compare/v1.0.236...v1.0.237)

---
updated-dependencies:
- dependency-name: anthropics/claude-code-action
  dependency-version: 1.0.237
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/claude-code-review.yml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ jobs:
 
       - name: Run Claude Code Review
         id: claude-review
-        uses: anthropics/claude-code-action@v1.0.236
+        uses: anthropics/claude-code-action@v1.0.237
         with:
           claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
           plugin_marketplaces: 'https://github.com/anthropics/claude-code.git'
```

**File**: `.github/workflows/claude.yml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ jobs:
 
       - name: Run Claude Code
         id: claude
-        uses: anthropics/claude-code-action@v1.0.236
+        uses: anthropics/claude-code-action@v1.0.237
         with:
           claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
 
```

---

### Incident Patch 10: `06f30a8b` (2026-10-01)
**Commit Message**: fix(viz): skip constant date columns when picking the time axis (#4704)

* fix(viz): skip constant date columns when picking the time axis

A Date column holding a single value (e.g. a publication date stamped on
every row) counts as "sorted", so sort_order_rank put it ahead of the real
event date in canonical_date_col and build_cyclic_panel. Both panels then
had one bucket and were silently dropped, and stderr reported the event
date as "no time panel could be drawn from it".

Both pickers now skip date columns with fewer than two distinct values.
Found on the CMS Open Payments 2025 General Payments detail file, whose
Payment_Publication_Date (2026-06-30 on all 16.1M rows) hid Date_of_Payment.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(viz): don't count blank cells as a second date in the constant-date guard

stats counts the blank value in `cardinality`, so a constant date column
with some empty cells (cardinality 2) still passed the guard. It stayed
"Ascending" and kept outranking the real event date. Both temporal pickers
now use has_multiple_dates, which discounts the blank when nullcount > 0.
The regression tests now include blank cells, and both fail under th

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -114,6 +114,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **`frequency`: the frequency cache now validates the qsv version that wrote it, and self-heals when it is stale** ([#4618](https://github.com/dathere/qsv/pull/4618)). `.freq.csv.data.jsonl` always recorded `qsv_version` but never compared it, so a cache written by an older qsv - whose `<ALL_UNIQUE>`/HIGH_CARDINALITY sentinels, percentages or ranks may no longer match - was served indefinitely. Because `frequency` only writes its cache under `--frequency-jsonl`, a bare version check would have turned every upgrade into a permanent cache miss; instead the run that rejects a version-stale cache recomputes and rewrites it in place. The version is compared only after every option check agrees, only when the cached column selection matches this run's, and only when a cache file already exists - so it refreshes caches but never creates one. `viz` rejects a version-stale cache without rewriting it and falls back to its own computation.
 
 ### Fixed
+- **`viz smart`: a constant date column no longer hides the time series and the seasonality ring.** A Date column holding a single value (e.g. a publication date stamped on every row, like Open Payments' `Payment_Publication_Date`) counts as "sorted", so it outranked the real event date when `viz smart` picked the column for the time-series panel and the cyclic (day-of-week/month) panel. Both then had a single bucket and were silently dropped, and stderr reported the event date as "no time panel could be drawn from it". Date columns with fewer than two distinct values are now skipped by both pickers.
 - **`viz --denominator census` no longer refuses the map over codes without ACS population** ([#4680](https://github.com/dathere/qsv/issues/4680)). A state column containing territory or military codes (AS, GU, MP, VI, AA/AE/AP, FM/MH/PW) failed the whole run with "not US state codes". Those regions are now excluded from the rate and reported, as the help text promised. The run fails only when no value is a state. The county path had a related bug. For a state it has no rows for (e.g. an island area's counties), the Census Data API returns HTTP 204 with an empty body. qsv misread that as a missing or invalid API key and aborted. Those counties are now excluded and reported too.
 - **`viz --geojson auto`/`census:*`: nationwide Census boundaries failed with "Census response is not valid JSON"** ([#4682](https://github.com/dathere/qsv/issues/4682)). When a dataset spanned most of the country, qsv fetched every county in 52 states at full survey resolution, 500 per page. TIGERweb's firewall refuses any response much over ~25 MB, and it does so with HTTP 200 and an HTML "Request Rejected" page, which qsv then tried to parse as JSON. The Census tests use a mock service with one or two states, so they could not catch it.
   - Geometry is now generalized server-side (`maxAllowableOffset`: ~50 m for counties, ~10 m for tracts, ZCTAs and places). Nationwide counties go from ~300 MB to ~11 MB, which also makes the resulting pages usable. Boundaries cached by earlier builds are retired (cache key v5), so maps drawn from Census boundaries will look very slightly smoother.
```

**File**: `src/cmd/viz.rs` (modified, +10/-1)
```diff
@@ -27754,6 +27754,14 @@ fn parse_record_cyclic_date(
         .map(|dt| dt.naive_utc())
 }
 
+/// Whether a date column holds at least two distinct non-blank dates. `stats` counts the blank
+/// value in `cardinality`, so a constant date with some empty cells reads as cardinality 2. A
+/// constant date can't form a trend or a cycle, and being trivially "sorted" it would otherwise
+/// outrank the real event date in the temporal-column pickers.
+fn has_multiple_dates(s: &crate::cmd::stats::StatsData) -> bool {
+    s.cardinality.saturating_sub(u64::from(s.nullcount > 0)) >= 2
+}
+
 /// Pick the canonical date/datetime column for temporal panels (time-series overview, animated
 /// scatter). When a dictionary tagged timestamps, prefer the event/created one (`timestamp_rank`);
 /// among equal ranks prefer a column the file is physically sorted by (`sort_order_rank` — likely
@@ -27767,6 +27775,7 @@ fn canonical_date_col(
     stats
         .iter()
         .enumerate()
+        .filter(|(_, s)| has_multiple_dates(s))
         .filter_map(|(i, s)| match s.r#type.as_str() {
             "Date" => Some((i, false)),
             "DateTime" => Some((i, true)),
@@ -29619,7 +29628,7 @@ fn build_cyclic_panel(
     let Some((date_idx, is_datetime)) = stats
         .iter()
         .enumerate()
-        .filter(|(i, _)| !is_map_col(*i))
+        .filter(|(i, s)| !is_map_col(*i) && has_multiple_dates(s))
         .filter_map(|(i, s)| match s.r#type.as_str() {
             "Date" => Some((i, false)),
             "DateTime" => Some((i, true)),
```

**File**: `tests/test_viz.rs` (modified, +61/-0)
```diff
@@ -4804,6 +4804,67 @@ fn viz_smart_timeseries_panel() {
     assert!(html.contains("revenue over txn_date"));
 }
 
+#[test]
+fn viz_smart_timeseries_skips_constant_date_column() {
+    let wrk = Workdir::new("viz_smart_timeseries_skips_constant_date_column");
+    // a publication date stamped on every row comes FIRST and is trivially "sorted", so it used
+    // to win the canonical-date pick over the real (unsorted) event date and yield a one-bucket
+    // series - i.e. no time-series panel at all. Blank cells must not make it look like two dates.
+    let mut rows = String::from("published,txn_date,revenue\n");
+    for i in (0..40).rev() {
+        let day = (i % 28) + 1;
+        let month = (i / 28) + 1;
+        let revenue = 1000 + i * 13;
+        // a few blank cells: stats counts the blank as a value, so the column's cardinality is 2
+        let published = if i % 10 == 3 { "" } else { "2022-06-30" };
+        rows.push_str(&format!("{published},2021-{month:02}-{day:02},{revenue}\n"));
+    }
+    wrk.create_from_string("sales.csv", &rows);
+
+    let out_html = wrk.path("dash.html").to_string_lossy().to_string();
+    let mut cmd = wrk.command("viz");
+    cmd.env("QSV_VIZ_NO_COMPRESS", "1")
+        .args(["smart", "sales.csv", "-o", &out_html]);
+    wrk.assert_success(&mut cmd);
+
+    let html = wrk.read_to_string("dash.html").unwrap();
+    assert!(
+        html.contains("revenue over txn_date"),
+        "no trend over the event date"
+    );
+    assert!(!html.contains("over published"));
+}
+
+#[test]
+fn viz_smart_cyclic_panel_skips_constant_date_column() {
+    let wrk = Workdir::new("viz_smart_cyclic_panel_skips_constant_date_column");
+    // a constant leading date column ties the event date on sort order and wins on column order,
+    // which left the cyclic panel folding a single day into nothing.
+    let mut rows = String::from("published,ts\n");
+    for d in 0..35u32 {
+        let date = date_after_monday_june_7_2021(d);
+        for h in 0..24 {
+            for _ in 0..if d % 7 < 5 { 3 } else { 1 } {
+                let published = if h == 5 { "" } else { "2022-06-30" };
+                rows.push_str(&format!("{published},{date}T{h:02}:15:00\n"));
+            }
+        }
+    }
+    wrk.create_from_string("events.csv", &rows);
+
+    let out_html = wrk.path("dash.html").to_string_lossy().to_string();
+    let mut cmd = wrk.command("viz");
+    cmd.env("QSV_VIZ_NO_COMPRESS", "1")
+        .args(["smart", "events.csv", "-o", &out_html]);
+    wrk.assert_success(&mut cmd);
+
+    let html = wrk.read_to_string("dash.html").unwrap();
+    assert!(
+        html.contains("Records by day of week (ts)"),
+        "expected a day-of-week ring on the event timestamp"
+    );
+}
+
 #[test]
 fn viz_smart_collapses_one_to_one_categorical_twins() {
     // `orgcode` <-> `orgfullname`: a code/label pair in strict 1:1 correspondence. Charted
```

---

### Incident Patch 11: `1f2eea75` (2026-10-01)
**Commit Message**: build(deps): bump anthropics/claude-code-action from 1.0.235 to 1.0.236 (#4703)

Bumps [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) from 1.0.235 to 1.0.236.
- [Release notes](https://github.com/anthropics/claude-code-action/releases)
- [Commits](https://github.com/anthropics/claude-code-action/compare/v1.0.235...v1.0.236)

---
updated-dependencies:
- dependency-name: anthropics/claude-code-action
  dependency-version: 1.0.236
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/claude-code-review.yml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ jobs:
 
       - name: Run Claude Code Review
         id: claude-review
-        uses: anthropics/claude-code-action@v1.0.235
+        uses: anthropics/claude-code-action@v1.0.236
         with:
           claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
           plugin_marketplaces: 'https://github.com/anthropics/claude-code.git'
```

**File**: `.github/workflows/claude.yml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ jobs:
 
       - name: Run Claude Code
         id: claude
-        uses: anthropics/claude-code-action@v1.0.235
+        uses: anthropics/claude-code-action@v1.0.236
         with:
           claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
 
```

---

### Incident Patch 12: `b5d2c85e` (2026-10-01)
**Commit Message**: fix(viz): one ACS request per state, not per county, for --denominator census (#4698) (#4702)

census_denominator_map built the list of states to scope by with one
entry per county code (c[..2]) and never deduplicated it, and
fetch_population sends one `for=county:*&in=state:XX` request per
entry. So each state's full county table was downloaded once for every
county of that state in the data: a 614-county, 52-state dataset sent
~600 requests and took ~210 s cold. Warm runs hid it, because
denominator_cache_key already sorts and dedups the states.

Sort + dedup the list. Results are unchanged, since each per-state
response already covers all of that state's counties. Measured on the
same dataset with an empty cache: ~210 s -> 27 s; warm 1.9 s.

The existing county test (two PA counties) now asserts exactly one
county-level ACS request; without the dedup it sees two.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -135,6 +135,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   - **The country is inferred from every admin1 code prefix**, so `--admin1 US.NY,US.PR` (or `US.NY,CA.ON`) no longer needs `--country`.
   - **Exact names win ties.** Geonames' fuzzy search scores any name that merely starts with the value as a perfect match and breaks ties by population, so "Davis" ranked San Diego above Davis, CA, and "Ponce" ranked Ponce Inlet, FL. A place whose own name is the value now wins, with or without `--admin1`.
   - The default index stays `cities15000`. On the same pairs, `cities1000` recovers 4 more small towns but makes every lookup about 2.4x slower and roughly doubles memory, so it remains opt-in via `index-load 1000`.
+- **`viz --denominator census`: a first run on county data no longer sends one Census request per county** ([#4698](https://github.com/dathere/qsv/issues/4698)). The list of states to fetch was never deduplicated, so each state's full county table was downloaded once for every county of that state in the data. A 614-county, 52-state dataset sent ~600 requests and took ~210 s cold; it now sends one per state and takes ~27 s. Cached runs were unaffected, because the cache key already deduplicated the states.
 - **`stats` & `frequency` no longer invoke undefined behavior on malformed CSV** ([#4614](https://github.com/dathere/qsv/pull/4614)). Both called `unwrap_unchecked()` on the record reader's result, so a ragged record - everyday malformed input - was type-confusion UB: release builds died with no output at all (`stats` SIGTRAP, exit 133; `frequency` SIGSEGV, exit 139). The read error is now reported. The pipelined `stats` reader, which used to look like a normal EOF when it bailed (complete-looking stats for a truncated read), now returns its error, and the parallel paths surface a worker's read error instead of silently merging a partial result. Commands that run `stats` as a subprocess (`schema`, `viz smart`, `frequency`'s cache path) now relay its diagnostic instead of only an exit code.
 - **`--flexible` is now part of every stats/frequency cache-validity key** ([#4616](https://github.com/dathere/qsv/pull/4616)). Three reuse paths ignored it: `stats --everything --flexible` served its cache to any later, narrower strict `stats` run; `frequency --flexible --frequency-jsonl` served a strict `frequency` run a complete-looking table for records it should refuse; and the stats JSONL cache consumers keyed only on `--no-headers`/`--delimiter`/`--prefer-dmy`. The consumer checks are deliberately one-way: a `--flexible` cache is refused to a strict run, but a `--flexible` run may reuse a strict cache, since a strict cache proves the input had no ragged records.
 - **`stats` caches never out-permission their source CSV** ([#4622](https://github.com/dathere/qsv/pull/4622)). `<FILESTEM>.stats.csv.data.jsonl` was created at the umask default, so a `0600` CSV yielded a world-readable `0644` file of its columns' min/max and mode/antimode values, while `<FILESTEM>.stats.csv` was always `0600` whatever the source. Both now go through the new `util::DerivedFile`, which writes a sibling temp at its final mode (umask default intersected with the source's mode) and renames it into place - the frequency cache's logic, now shared. A world-readable CSV therefore gets a reusable `.stats.csv` again. Under `moarstats --join-inputs` the JSONL cache takes its mode from the joined data, not just the primary input. ACL/xattr labels are not carried over ([#4621](https://github.com/dathere/qsv/issues/4621)).
```

**File**: `src/cmd/viz.rs` (modified, +6/-1)
```diff
@@ -8370,7 +8370,12 @@ fn census_denominator_map(
     // (geography, state FIPS to scope by, caller-code -> Census GEOID)
     let (geo, states, keyed): (DenominatorGeography, Vec<String>, Vec<(String, String)>) =
         if all(&numeric_of(5)) {
-            let states: Vec<String> = trimmed.iter().map(|c| c[..2].to_string()).collect();
+            // ONE entry per state: `fetch_population` sends one request per entry, and each
+            // response already covers every county in that state. Undeduped, a cold run on 614
+            // counties in 52 states sent ~600 requests and took ~210 s (issue #4698).
+            let mut states: Vec<String> = trimmed.iter().map(|c| c[..2].to_string()).collect();
+            states.sort_unstable();
+            states.dedup();
             let keyed = trimmed
                 .iter()
                 .map(|c| ((*c).to_string(), (*c).to_string()))
```

**File**: `tests/test_viz_census.rs` (modified, +7/-0)
```diff
@@ -1200,6 +1200,13 @@ fn viz_denominator_census_fetches_population_and_states_its_release() {
             asked.iter().any(|c| c.starts_with("acs?county")),
             "expected a county-level ACS request, got: {asked:?}"
         );
+        // ONE county request per STATE, not per county: both counties are in PA, and each
+        // response covers the whole state (issue #4698 -- one request per county took ~210 s)
+        assert_eq!(
+            asked.iter().filter(|c| c.starts_with("acs?county")).count(),
+            1,
+            "two PA counties must share one state request, got: {asked:?}"
+        );
 
         // and a repeated command makes no further request — the Data Schematic's offline promise
         let after_first = observed.requests.load(Ordering::SeqCst);
```

---

### Incident Patch 13: `e18894e4` (2026-10-01)
**Commit Message**: fix(geocode): --admin1 filters, accepts US territories, prefers exact names (#4687) (#4700)

`geocode suggest --admin1` returned places outside the requested
admin1 (Inverness, FL -> Inver Grove Heights, MN), never found Puerto
Rico (Ponce -> Ponca City), and ranked big cities over exact names
("Davis" -> San Diego). Three causes, three fixes:

- Strict filter. suggest took the top 10 fuzzy matches, returned the
  first inside the admin1, and otherwise fell back to the overall top
  match, contradicting the USAGE's "list of admin1s to filter for". Now
  only an in-admin1 place is returned, from up to 1,000 candidates (the
  engine sorts every match before truncating, so the width is free). A
  value with no such match is left unchanged or set to --invalid-result,
  and a count is printed on stderr with an index-load 1000 hint. This
  reverses the #4427 decision to leave suggest's fallback advisory; viz's
  hinted resolver was already strict.
- US territories. Geonames files PR, VI, GU, AS and MP as countries of
  their own (Ponce is admin1 PR.113 of country PR), so US.PR inferred
  country US and excluded every PR place before ranking. US.<territory>
  now maps to that country with

**File**: `.claude/skills/qsv/qsv-geocode.json` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@
       {
         "flag": "--admin1",
         "type": "string",
-        "description": "The comma-delimited, case-insensitive list of admin1s to filter for."
+        "description": "The comma-delimited, case-insensitive list of admin1s to filter for. Only a place inside one of them is returned. A value with no match inside them is left unchanged (or set to the invalid-result value), and the number of such values is reported on stderr."
       },
       {
         "flag": "--batch",
```

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -128,6 +128,12 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   - Whole single-symbol spans (`$\times$`, `$\approx$`, `$\le$`, `$\pm$` and a few more) are rewritten to their Unicode character before any output is written. This covers fresh completions, cached ones and MCP `--process-response` alike. A bare `$`, other LaTeX and multi-token math are left alone.
   - `\$` is deliberately **not** removed: it is a valid Markdown escape, and without it GitHub renders the text between two dollar amounts as math. The `viz` drawer and the Data Schematic header now honor Markdown backslash escapes, so they display `\$179.73` as `$179.73`. The header's Description row also renders inline Markdown (bold, code, links) instead of printing `**` literally.
   - Dictionaries saved by `--dictionary infer` before this change keep their `$\times$` until they are regenerated. Their `\$` renders correctly now.
+- **`geocode suggest --admin1` now filters, finds Puerto Rico, and prefers exact names** ([#4687](https://github.com/dathere/qsv/issues/4687)). Measured on 128 hard city/state pairs (a demo's unmatched list), wrong-state answers dropped from 10 to 0, and correct answers rose from 116 to 122.
+  - **`--admin1` is now a filter, as its usage text always said.** It used to look at the 10 best fuzzy matches, return the first inside the admin1, and otherwise return the overall best match from anywhere: Inverness, FL became Inver Grove Heights, MN. Now only a place inside the listed admin1s is returned, drawn from up to 1,000 candidates. A value with no such match is left unchanged (or set to `--invalid-result`), and a count is printed on stderr with a hint that `qsv geocode index-load 1000` finds more small towns. **This changes output** for anyone who relied on the out-of-admin1 fallback.
+  - **US territories:** `US.PR`, `US.VI`, `US.GU`, `US.AS` and `US.MP` now work. Geonames files them as countries of their own (Ponce is admin1 `PR.113` of country `PR`), so `--admin1 US.PR` used to exclude every Puerto Rico place, and Ponce came back as Ponca City. An explicit `--country US` also admits a territory that `--admin1` names.
+  - **The country is inferred from every admin1 code prefix**, so `--admin1 US.NY,US.PR` (or `US.NY,CA.ON`) no longer needs `--country`.
+  - **Exact names win ties.** Geonames' fuzzy search scores any name that merely starts with the value as a perfect match and breaks ties by population, so "Davis" ranked San Diego above Davis, CA, and "Ponce" ranked Ponce Inlet, FL. A place whose own name is the value now wins, with or without `--admin1`.
+  - The default index stays `cities15000`. On the same pairs, `cities1000` recovers 4 more small towns but makes every lookup about 2.4x slower and roughly doubles memory, so it remains opt-in via `index-load 1000`.
 - **`stats` & `frequency` no longer invoke undefined behavior on malformed CSV** ([#4614](https://github.com/dathere/qsv/pull/4614)). Both called `unwrap_unchecked()` on the record reader's result, so a ragged record - everyday malformed input - was type-confusion UB: release builds died with no output at all (`stats` SIGTRAP, exit 133; `frequency` SIGSEGV, exit 139). The read error is now reported. The pipelined `stats` reader, which used to look like a normal EOF when it bailed (complete-looking stats for a truncated read), now returns its error, and the parallel paths surface a worker's read error instead of silently merging a partial result. Commands that run `stats` as a subprocess (`schema`, `viz smart`, `frequency`'s cache path) now relay its diagnostic instead of only an exit code.
 - **`--flexible` is now part of every stats/frequency cache-validity key** ([#4616](https://github.com/dathere/qsv/pull/4616)). Three reuse paths ignored it: `stats --everything --flexible` served its cache to any later, narrower strict `stats` run; `frequency --flexible --frequency-jsonl` served a strict `frequency` run a complete-looking table for records it should refuse; and the stats JSONL cache consumers keyed only on `--no-headers`/`--delimiter`/`--prefer-dmy`. The consumer checks are deliberately one-way: a `--flexible` cache is refused to a strict run, but a `--flexible` run may reuse a strict cache, since a strict cache proves the input had no ragged records.
 - **`stats` caches never out-permission their source CSV** ([#4622](https://github.com/dathere/qsv/pull/4622)). `<FILESTEM>.stats.csv.data.jsonl` was created at the umask default, so a `0600` CSV yielded a world-readable `0644` file of its columns' min/max and mode/antimode values, while `<FILESTEM>.stats.csv` was always `0600` whatever the source. Both now go through the new `util::DerivedFile`, which writes a sibling temp at its final mode (umask default intersected with the source's mode) and renames it into place - the frequency cache's logic, now shared. A world-readable CSV therefore gets a reusable `.stats.csv` again. Under `moarstats --join-inputs` the JS
```

**File**: `docs/help/geocode.md` (modified, +1/-1)
```diff
@@ -514,7 +514,7 @@ qsv geocode --help
 | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Option&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Type | Description | Default |
 |--------|------|-------------|--------|
 | &nbsp;`‑‑min‑score`&nbsp; | float | The minimum Jaro-Winkler distance score. | `0.8` |
-| &nbsp;`‑‑admin1`&nbsp; | string | The comma-delimited, case-insensitive list of admin1s to filter for. |  |
+| &nbsp;`‑‑admin1`&nbsp; | string | The comma-delimited, case-insensitive list of admin1s to filter for. Only a place inside one of them is returned. A value with no match inside them is left unchanged (or set to the invalid-result value), and the number of such values is reported on stderr. |  |
 
 <a name="reverse-only-option"></a>
 
```

**File**: `src/cmd/geocode.rs` (modified, +141/-87)
```diff
@@ -361,16 +361,22 @@ geocode options:
     --min-score <score>         The minimum Jaro-Winkler distance score.
                                 [default: 0.8]
     --admin1 <admin1_list>      The comma-delimited, case-insensitive list of admin1s to filter for.
+                                Only a place inside one of them is returned. A value with no match
+                                inside them is left unchanged (or set to the invalid-result value),
+                                and the number of such values is reported on stderr.
     
                                 If all uppercase, it will be treated as an admin1 code (e.g. US.NY, JP.40, CN.23).
                                 Otherwise, it will be treated as an admin1 name (e.g New York, Tokyo, Shanghai).
+                                US territories, which Geonames files as countries of their own, are
+                                accepted as US.PR, US.VI, US.GU, US.AS and US.MP.
 
-                                Requires the --country option. However, if all admin1 codes have the same
-                                prefix (e.g. US.TX, US.NJ, US.CA), the country can be inferred from the
-                                admin1 code (in this example - US), and the --country option is not required.
+                                Requires the --country option, unless every entry is an admin1 code:
+                                then the countries are inferred from the code prefixes (e.g. US.TX,US.PR
+                                infers US and PR), and the --country option is not required.
 
-                                If specifying multiple admin1 filters, you can mix admin1 codes and names,
-                                and they are matched in priority order.
+                                If specifying multiple admin1 filters, you can mix admin1 codes and names.
+                                A place inside any of them qualifies, and the best-scoring one is
+                                returned, preferring a place whose name is exactly the value.
 
                                 Matches are made using a starts_with() comparison (i.e. "US" will match "US.NY",
                                 "US.NJ", etc. for admin1 code. "New" will match "New York", "New Jersey",
@@ -686,47 +692,77 @@ fn parse_region_filters(
     country_list: Option<&str>,
     admin1_list: Option<&str>,
 ) -> CliResult<(Option<Vec<String>>, Option<Vec<Admin1Filter>>)> {
-    let mut admin1_code_prefix = String::new();
-    let mut admin1_same_prefix = true;
+    // US territories are countries of their own in Geonames (Ponce is admin1 `PR.113` of country
+    // `PR`, not of `US`), so `US.PR` must become country `PR` with an admin1 prefix matching any
+    // of its municipios (issue #4687).
+    const US_TERRITORIES: &[&str] = &["PR", "VI", "GU", "AS", "MP"];
     let mut country_list = country_list.map(ToString::to_string);
 
     let admin1_filter_list = if let Some(admin1_list) = admin1_list {
         let admin1_code_re = ADMIN1_CODE_REGEX();
-        let list = admin1_list
-            .split(',')
-            .map(|s| {
-                let temp_s = s.trim();
-                let is_code_flag = admin1_code_re.is_match(temp_s);
-                Admin1Filter {
-                    admin1_string: if is_code_flag {
-                        if admin1_same_prefix {
-                            if admin1_code_prefix.is_empty() {
-                                admin1_code_prefix = temp_s[0..3].to_string();
-                            } else if admin1_code_prefix != temp_s[0..3] {
-                                // different country prefixes, so the country can't be inferred
-                                admin1_same_prefix = false;
-                            }
-                        }
-                        temp_s.to_string()
-                    } else {
-                        // its an admin1 name, lowercase it for case-insensitive starts_with()
-                        temp_s.to_lowercase()
-                    },
-                    is_code:       is_code_flag,
+        let mut prefixes: Vec<String> = Vec::new();
+        let mut all_codes = true;
+        let mut territories: Vec<&str> = Vec::new();
+        let mut list: Vec<Admin1Filter> = Vec::new();
+        for s in admin1_list.split(',') {
+            let temp_s = s.trim();
+            if let Some(t) = temp_s
+                .to_ascii_uppercase()
+                .strip_prefix("US.")
+                .and_then(|t| US_TERRITORIES.iter().find(|x| **x == t))
+            {
+                territories.push(t);
+                if !prefixes.iter().any(|p| p == t) {
+                    prefixes.push((*t).to_string());
+                }
+                list.push(Admin1Filter {
+                    admin1_string: format!("{t}."),
+                    is_code:       true,
+                });
+                continue;
+            }
+            let is_code_flag 
```

**File**: `tests/test_geocode.rs` (modified, +114/-7)
```diff
@@ -383,28 +383,135 @@ fn geocode_suggest_filter_country_admin1() {
         .arg("data.csv");
 
     let got: Vec<Vec<String>> = wrk.read_stdout_on_success(&mut cmd);
+    // --admin1 FILTERS (issue #4687): a value with no match inside the listed admin1s is left
+    // unchanged, never replaced by a place elsewhere (this used to return Melrose Park, Illinois
+    // and East Haven, Connecticut for New York values, and McKinney, Texas for Makati).
     let expected = vec![
         svec!["Location"],
-        svec!["Melrose Park, Illinois, Cook US"],
+        svec!["Melrose, New York"],
         svec!["Elmwood Park, New Jersey, Bergen County US"],
         svec!["New York, New York,  US"],
         svec!["Brooklyn, New York, Kings US"],
-        svec!["East Haven, Connecticut,  US"],
+        svec!["East Meadow, New York, Nassau US"],
         svec!["This is not a Location and it will not be geocoded"],
         // Jersey City matched as the admin1 filter included "New J"
         // which starts_with match "New Jersey"
         svec!["Jersey City, New Jersey, Hudson US"],
         // suggest expects a city name, not lat, long
         svec!["(41.90059, -87.85673)"],
-        // Makati did not match, even with the Metro Manila admin1 filter
-        // as the country filter was set to US
-        // as a result, the country filter takes precedence over the admin1 filter
-        // and the closest match for Makati in the US is McAllen in Texas
-        svec!["McKinney, Texas, Collin US"],
+        // the Metro Manila filter cannot admit it: the country filter is US
+        svec!["Makati, Metro Manila, Philippines"],
     ];
     assert_eq!(got, expected);
 }
 
+// US territories are countries of their own in Geonames (Ponce is admin1 `PR.113` of country
+// `PR`), so `US.PR` used to exclude every Puerto Rico place before ranking (issue #4687).
+#[test]
+fn geocode_suggest_admin1_us_territory() {
+    let wrk = Workdir::new("geocode_suggest_admin1_us_territory");
+    wrk.create(
+        "data.csv",
+        vec![
+            svec!["city"],
+            svec!["Ponce"],
+            svec!["Mayaguez"],
+            svec!["Carolina"],
+        ],
+    );
+    let mut cmd = wrk.command("geocode");
+    cmd.args(["suggest", "city", "data.csv"])
+        .args(["-f", "{name}, {admin1} {country}"])
+        .args(["--admin1", "US.PR"]);
+    let got: Vec<Vec<String>> = wrk.read_stdout_on_success(&mut cmd);
+    let expected = vec![
+        svec!["city"],
+        svec!["Ponce, Ponce PR"],
+        svec!["Mayagüez, Mayagüez PR"],
+        svec!["Carolina, Carolina PR"],
+    ];
+    assert_eq!(got, expected);
+
+    // an explicit --country US still admits the territory the admin1 list names
+    let mut cmd = wrk.command("geocode");
+    cmd.args(["suggest", "city", "data.csv"])
+        .args(["-f", "{name}, {admin1} {country}"])
+        .args(["--country", "US", "--admin1", "US.PR"]);
+    let got: Vec<Vec<String>> = wrk.read_stdout_on_success(&mut cmd);
+    assert_eq!(got, expected);
+}
+
+// Every entry an admin1 code: the countries are inferred from ALL their prefixes, so a mixed
+// state + territory list needs no --country (issue #4687).
+#[test]
+fn geocode_suggest_admin1_mixed_country_prefixes() {
+    let wrk = Workdir::new("geocode_suggest_admin1_mixed_country_prefixes");
+    wrk.create(
+        "data.csv",
+        vec![svec!["city"], svec!["Rochester"], svec!["Ponce"]],
+    );
+    let mut cmd = wrk.command("geocode");
+    cmd.args(["suggest", "city", "data.csv"])
+        .args(["-f", "{name}, {admin1} {country}"])
+        .args(["--admin1", "US.NY,US.PR"]);
+    let got: Vec<Vec<String>> = wrk.read_stdout_on_success(&mut cmd);
+    let expected = vec![
+        svec!["city"],
+        svec!["Rochester, New York US"],
+        svec!["Ponce, Ponce PR"],
+    ];
+    assert_eq!(got, expected);
+}
+
+// --admin1 is strict: Inverness, FL is not in the default (cities15000) index, and the value must
+// stay unchanged and be counted rather than become Inver Grove Heights, Minnesota (issue #4687).
+#[test]
+fn geocode_suggest_admin1_is_strict_and_reports_misses() {
+    let wrk = Workdir::new("geocode_suggest_admin1_is_strict_and_reports_misses");
+    wrk.create(
+        "data.csv",
+        vec![svec!["city"], svec!["Inverness"], svec!["Tampa"]],
+    );
+    let mut cmd = wrk.command("geocode");
+    cmd.args(["suggest", "city", "data.csv"])
+        .args(["-f", "{name}, {admin1}"])
+        .args(["--admin1", "US.FL"]);
+    let out = wrk.output(&mut cmd);
+    assert!(out.status.success());
+    let stdout = String::from_utf8_lossy(&out.stdout);
+    assert_eq!(stdout, "city\nInverness\n\"Tampa, Florida\"\n");
+    let stderr = String::from_utf8_lossy(&out.stderr);
+    assert!(
+        stderr.contains(
+            "1 value(s) found no match within --admin1 US.FL, so they were left unchanged"
+        ),
+        "{stderr}"
+    );
+}
+
+// A prefix match scores a flat 1.0 and ties go t
```

---

### Incident Patch 14: `e537ce7c` (2026-10-01)
**Commit Message**: fix(describegpt,viz): no LaTeX in descriptions; render escaped dollars (#4689) (#4699)

* fix(describegpt,viz): no LaTeX in descriptions; render escaped dollars (#4689)

Some models (gemma-4-31b) wrote `52 states $\times$ 7 years
($\approx$\$179.73)` into the dataset description, and the viz Data
Schematic drawer showed it verbatim.

- describegpt: whole single-symbol spans ($\times$, $\approx$, $\le$,
  $\pm$, ...) are rewritten to their Unicode character in
  process_phase_output, the one point every Description passes through:
  a fresh completion, a cache replay and an MCP --process-response
  alike. Bare `$`, other LaTeX and multi-token math are left alone.
- Prompt v9.1.1: the description prompt asks for plain prose with
  Unicode symbols. On gemma-4-31b the old prompt wrote LaTeX in 1 of 2
  runs, the new one in 0 of 2 (raw completions, read from the cache).
- `\$` is deliberately kept. It is valid CommonMark, and without it
  GitHub renders the text between two dollar amounts as math. Instead,
  viz's inline Markdown renderer now honors backslash escapes of ASCII
  punctuation (the escaped character still goes through HTML escaping),
  and the header's Description row uses 

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -123,6 +123,11 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   - A dictionary carrying only the legacy `content_type: duration` now charts that column as an averaged measure, as `concept: time.duration` already did (#4177). It used to be dropped as a timestamp, and a column of 4-digit durations (1800–3600 s) could have been read as years.
   - The stderr "skipped" list no longer makes the time series look like a failure. The column driving it reads `Program_Year (time axis)`. A timestamp column that isn't the axis says why: another column is the time axis, or its values aren't dates or 4-digit years (e.g. epoch seconds). The Data Schematic drawer labels a bare-year axis the same way.
 - **`viz`: time axes no longer drop year labels in mid-width panels** ([#4686](https://github.com/dathere/qsv/issues/4686)). This wasn't Plotly's date ticking. Year buckets are already a categorical axis, whose labels viz's own resize script thinned on a fixed 72 px per label, a width sized for `2024-Q1`. Seven years in a ~450 px panel kept five labels, and 2020 was one of those dropped. The script now measures each label's width in the axis font. It also places labels at an even interval, so it never shows two adjacent categories while skipping their neighbours (2021 and 2022 shown, 2020 and 2023 dropped). All seven years now show from about 400 px (previously about 600 px). Labels on dense quarter axes always keep a gap of at least 16 px, though a very wide axis can show a label or two fewer than before.
+- **`describegpt` descriptions no longer carry LaTeX, and the `viz` Data Schematic renders escaped dollars** ([#4689](https://github.com/dathere/qsv/issues/4689)). Some models wrote `52 states $\times$ 7 years ($\approx$\$179.73)` into the dataset description, and the Data Schematic showed it verbatim.
+  - The description prompt now asks for plain prose with Unicode symbols (×, ≈, ≤, ≥, ±). The default prompt file is now v9.1.1.
+  - Whole single-symbol spans (`$\times$`, `$\approx$`, `$\le$`, `$\pm$` and a few more) are rewritten to their Unicode character before any output is written. This covers fresh completions, cached ones and MCP `--process-response` alike. A bare `$`, other LaTeX and multi-token math are left alone.
+  - `\$` is deliberately **not** removed: it is a valid Markdown escape, and without it GitHub renders the text between two dollar amounts as math. The `viz` drawer and the Data Schematic header now honor Markdown backslash escapes, so they display `\$179.73` as `$179.73`. The header's Description row also renders inline Markdown (bold, code, links) instead of printing `**` literally.
+  - Dictionaries saved by `--dictionary infer` before this change keep their `$\times$` until they are regenerated. Their `\$` renders correctly now.
 - **`stats` & `frequency` no longer invoke undefined behavior on malformed CSV** ([#4614](https://github.com/dathere/qsv/pull/4614)). Both called `unwrap_unchecked()` on the record reader's result, so a ragged record - everyday malformed input - was type-confusion UB: release builds died with no output at all (`stats` SIGTRAP, exit 133; `frequency` SIGSEGV, exit 139). The read error is now reported. The pipelined `stats` reader, which used to look like a normal EOF when it bailed (complete-looking stats for a truncated read), now returns its error, and the parallel paths surface a worker's read error instead of silently merging a partial result. Commands that run `stats` as a subprocess (`schema`, `viz smart`, `frequency`'s cache path) now relay its diagnostic instead of only an exit code.
 - **`--flexible` is now part of every stats/frequency cache-validity key** ([#4616](https://github.com/dathere/qsv/pull/4616)). Three reuse paths ignored it: `stats --everything --flexible` served its cache to any later, narrower strict `stats` run; `frequency --flexible --frequency-jsonl` served a strict `frequency` run a complete-looking table for records it should refuse; and the stats JSONL cache consumers keyed only on `--no-headers`/`--delimiter`/`--prefer-dmy`. The consumer checks are deliberately one-way: a `--flexible` cache is refused to a strict run, but a `--flexible` run may reuse a strict cache, since a strict cache proves the input had no ragged records.
 - **`stats` caches never out-permission their source CSV** ([#4622](https://github.com/dathere/qsv/pull/4622)). `<FILESTEM>.stats.csv.data.jsonl` was created at the umask default, so a `0600` CSV yielded a world-readable `0644` file of its columns' min/max and mode/antimode values, while `<FILESTEM>.stats.csv` was always `0600` whatever the source. Both now go through the new `util::DerivedFile`, which writes a sibling temp at its final mode (umask default intersected with the source's mode) and renames it into place - the frequency cache's logic, now shared. A world-readable CSV therefore gets a reusable `.stats.csv` again. Under `moarstats --join-inputs` the JSONL cache takes i
```

**File**: `resources/describegpt_defaults.toml` (modified, +3/-2)
```diff
@@ -1,7 +1,7 @@
 name = "qsv Default Prompt File"
 description = "Default prompt file for qsv's describegpt command."
 author = "qsv team"
-version = "9.1.0"
+version = "9.1.1"
 tokens = 20000
 base_url = "http://localhost:1234/v1"
 model = "google/gemma-4-26b-a4b"
@@ -573,7 +573,8 @@ other data quality issues that the User should be aware of).
 
 Add an Attribution with the placeholder "{{ generated_by_signature }}" at the bottom of the output.
 
-The entire output should be in Markdown format.
+The entire output should be in Markdown format. Write plain prose: do not use LaTeX or math markup
+such as `$\\times$` or `$\\approx$`, and write symbols directly as Unicode characters (×, ≈, ≤, ≥, ±).
 """
 
 tags_prompt = """
```

**File**: `src/cmd/describegpt.rs` (modified, +96/-0)
```diff
@@ -4666,6 +4666,20 @@ fn process_phase_output(
     base_url: &str,
     output_format: OutputFormat,
 ) -> CliResult<()> {
+    // A description is shown as plain text (the viz Data Schematic drawer, a catalog's abstract),
+    // where a `$\times$` from an LLM that writes LaTeX reads as noise (issue #4689). Cleaned here,
+    // the one point every Description passes through: a fresh completion, a cache replay and an
+    // MCP `--process-response` alike.
+    let cleaned;
+    let completion_response = if kind == PromptType::Description {
+        cleaned = CompletionResponse {
+            response: replace_latex_symbols(&completion_response.response),
+            ..completion_response.clone()
+        };
+        &cleaned
+    } else {
+        completion_response
+    };
     // Dictionary when --prompt is active: generate dictionary JSON for prompt context, no output.
     if kind == PromptType::Dictionary && args.flag_prompt.is_some() {
         let (combined_entries, relationships, _grain, _grain_unit, _tour) =
@@ -5969,6 +5983,58 @@ fn finalize_structured_output(
     Ok(())
 }
 
+/// Single-symbol LaTeX math spans an LLM writes in prose, and their Unicode equivalents.
+const LATEX_SYMBOLS: &[(&str, &str)] = &[
+    ("times", "×"),
+    ("approx", "≈"),
+    ("le", "≤"),
+    ("leq", "≤"),
+    ("ge", "≥"),
+    ("geq", "≥"),
+    ("pm", "±"),
+    ("ne", "≠"),
+    ("neq", "≠"),
+    ("cdot", "·"),
+    ("div", "÷"),
+    ("to", "→"),
+    ("rightarrow", "→"),
+    ("infty", "∞"),
+];
+
+/// Replace whole `$\cmd$` spans (e.g. `$\times$`, `$\approx$`) with their Unicode symbol (issue
+/// #4689). Only a span that is exactly one known command between two dollar signs is rewritten:
+/// a bare `$` (a currency amount), `\$` (a Markdown-escaped dollar, which renders correctly and
+/// keeps GitHub from reading two amounts as a math span) and any other LaTeX are left alone.
+fn replace_latex_symbols(s: &str) -> String {
+    let mut out = String::with_capacity(s.len());
+    let mut rest = s;
+    while let Some(pos) = rest.find("$\\") {
+        out.push_str(&rest[..pos]);
+        let after = &rest[pos + 2..];
+        let name_len = after.bytes().take_while(u8::is_ascii_alphabetic).count();
+        let replacement = (name_len > 0 && after[name_len..].starts_with('$'))
+            .then(|| {
+                LATEX_SYMBOLS
+                    .iter()
+                    .find(|(name, _)| *name == &after[..name_len])
+                    .map(|(_, sym)| *sym)
+            })
+            .flatten();
+        match replacement {
+            Some(sym) => {
+                out.push_str(sym);
+                rest = &after[name_len + 1..];
+            },
+            None => {
+                out.push_str("$\\");
+                rest = after;
+            },
+        }
+    }
+    out.push_str(rest);
+    out
+}
+
 /// Strip the rendered attribution footer (and any preceding `---` separator) from an
 /// LLM phase response. Mirrors the `"Generated by"` anchor used by `format_phase_toon`;
 /// also handles the unsubstituted `{GENERATED_BY_SIGNATURE}` placeholder.
@@ -9833,6 +9899,36 @@ p_fewshot_examples = ""
         assert_eq!(yaml_scalar("a: b"), "\"a: b\"");
     }
 
+    #[test]
+    fn replace_latex_symbols_rewrites_single_symbol_spans() {
+        // the strings gemma-4-31b actually wrote (issue #4689)
+        assert_eq!(
+            replace_latex_symbols(
+                r"728 records (52 states $\times$ 7 program years $\times$ 2 payment types)"
+            ),
+            "728 records (52 states × 7 program years × 2 payment types)"
+        );
+        assert_eq!(
+            replace_latex_symbols(r"relatively low ($\approx$\$179.73), up to \$456 million"),
+            r"relatively low (≈\$179.73), up to \$456 million"
+        );
+        assert_eq!(
+            replace_latex_symbols(r"$\le$ 5, $\geq$ 2, $\pm$ 1"),
+            "≤ 5, ≥ 2, ± 1"
+        );
+        // bare dollars, unknown commands, multi-token math and a dangling `$\` are untouched
+        for keep in [
+            "costs $5 and $10",
+            r"$\alpha$ level",
+            r"$52 \times 7$",
+            r"$\timesX$",
+            r"ends with $\",
+            r"$\times",
+        ] {
+            assert_eq!(replace_latex_symbols(keep), keep);
+        }
+    }
+
     #[test]
     fn semanticmd_strip_attribution_block() {
         // Rendered attribution (anchored on "Generated by"), with a `---` separator.
```

**File**: `src/cmd/viz.rs` (modified, +52/-1)
```diff
@@ -24768,6 +24768,16 @@ fn md_inline_depth(text: &str, depth: usize) -> String {
     while i < n {
         let c = b[i];
         match c {
+            // CommonMark backslash escape: `\$`, `\*`, `\_` ... stand for the bare character
+            // (issue #4689 -- LLM descriptions escape dollar signs so a GitHub renderer won't read
+            // a `$...$` pair as math). Only ASCII punctuation escapes, so `\a` stays
+            // two characters. Handled before the emphasis/link/code arms, so an escaped
+            // marker never opens one, and the character goes through `lit`, so `\<` is
+            // still HTML-escaped.
+            b'\\' if i + 1 < n && b[i + 1].is_ascii_punctuation() => {
+                lit.push(b[i + 1] as char);
+                i += 2;
+            },
             b'`' => {
                 // Inline code: content up to the next backtick, escaped, not re-parsed.
                 if let Some(rel) = text[i + 1..].find('`') {
@@ -37089,7 +37099,9 @@ impl<'a> SmartCtx<'a> {
                     rows.push_str(&format!(
                         "<tr><td class=\"qsv-viz-meta-k\">{}</td><td>{}</td></tr>\n",
                         t!("viz.meta.description"),
-                        html_escape(&first_para)
+                        // the same inline Markdown the drawer renders (issue #4689): raw-escaping
+                        // it showed `**bold**` and `\$` literally in the header
+                        md_inline(&first_para)
                     ));
                 }
             }
@@ -47680,6 +47692,45 @@ mod tests {
         assert!(data.generated_by.is_none());
     }
 
+    #[test]
+    fn render_dict_markdown_backslash_escapes() {
+        // issue #4689: an escaped dollar is a literal dollar, as in any CommonMark renderer
+        assert_eq!(
+            render_dict_markdown(r"low (\$179.73), up to \$456 million"),
+            "<p>low ($179.73), up to $456 million</p>\n"
+        );
+        // an escaped marker never opens emphasis
+        assert_eq!(
+            render_dict_markdown(r"\*not emphasis\* and \_nor this\_"),
+            "<p>*not emphasis* and _nor this_</p>\n"
+        );
+        // only ASCII punctuation escapes; `\\` is one backslash; a trailing `\` is literal
+        assert_eq!(render_dict_markdown(r"\a stays"), "<p>\\a stays</p>\n");
+        assert_eq!(
+            render_dict_markdown(r"one \\ backslash"),
+            "<p>one \\ backslash</p>\n"
+        );
+        assert_eq!(
+            render_dict_markdown(r"ends with \"),
+            "<p>ends with \\</p>\n"
+        );
+        // the escaped character is still HTML-escaped: `\<` never emits a raw `<`
+        assert_eq!(
+            render_dict_markdown(r"\<script\>"),
+            "<p>&lt;script&gt;</p>\n"
+        );
+        // inside a code span the backslash is literal
+        assert_eq!(
+            render_dict_markdown(r"`a \$ b`"),
+            "<p><code>a \\$ b</code></p>\n"
+        );
+        // an escaped bullet marker is a paragraph, not a list item
+        assert_eq!(
+            render_dict_markdown(r"\* not a bullet"),
+            "<p>* not a bullet</p>\n"
+        );
+    }
+
     #[test]
     fn render_dict_markdown_basic_formatting() {
         // bold, italic, inline code
```

**File**: `tests/test_describegpt.rs` (modified, +72/-0)
```diff
@@ -2386,6 +2386,78 @@ fn describegpt_process_response_produces_output() {
     );
 }
 
+/// Issue #4689: single-symbol LaTeX spans in a Description are rewritten to Unicode on the
+/// shared output path, so an MCP `--process-response` gets the same cleanup as a direct run.
+/// `\$` is left alone: it is a valid Markdown escape.
+#[test]
+fn describegpt_process_response_description_replaces_latex_symbols() {
+    use std::{io::Write, process::Stdio};
+
+    let wrk = Workdir::new("describegpt_process_response_description_latex");
+    wrk.create_indexed(
+        "data.csv",
+        vec![
+            svec!["name", "age", "city"],
+            svec!["Alice", "30", "NYC"],
+            svec!["Bob", "25", "LA"],
+        ],
+    );
+
+    let mut cmd = wrk.command("describegpt");
+    cmd.arg("--prepare-context")
+        .arg("--description")
+        .arg("--no-cache")
+        .arg("data.csv");
+    let prep: serde_json::Value = serde_json::from_str(&wrk.stdout::<String>(&mut cmd)).unwrap();
+
+    let phases: Vec<serde_json::Value> = prep["phases"]
+        .as_array()
+        .unwrap()
+        .iter()
+        .map(|p| {
+            serde_json::json!({
+                "kind": p["kind"],
+                "response": r"728 records (52 states $\times$ 7 years), median ($\approx$\$179.73).",
+                "reasoning": "",
+                "token_usage": {"prompt": 1, "completion": 1, "total": 2, "elapsed": 1}
+            })
+        })
+        .collect();
+    let process_input = serde_json::json!({
+        "phases": phases,
+        "analysis_results": prep["analysis_results"],
+        "model": prep["model"]
+    });
+
+    let mut cmd_2 = wrk.command("describegpt");
+    cmd_2
+        .arg("--process-response")
+        .arg("--description")
+        .arg("--no-cache")
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped());
+    let mut child = cmd_2.spawn().unwrap();
+    child
+        .stdin
+        .as_mut()
+        .unwrap()
+        .write_all(process_input.to_string().as_bytes())
+        .unwrap();
+    let output = child.wait_with_output().unwrap();
+    let stdout = String::from_utf8_lossy(&output.stdout);
+    assert!(
+        output.status.success(),
+        "stderr: {}",
+        String::from_utf8_lossy(&output.stderr)
+    );
+    assert!(
+        stdout.contains(r"728 records (52 states × 7 years), median (≈\$179.73)."),
+        "Got: {stdout}"
+    );
+    assert!(!stdout.contains(r"$\times$"), "Got: {stdout}");
+}
+
 /// Run --prepare-context then --process-response (with a canned Dictionary response)
 /// on `data.csv` in `wrk`, returning the parsed total JSON output. LLM-free.
 #[cfg(feature = "whatlang")]
```

**File**: `tests/test_sqlp.rs` (modified, +56/-0)
```diff
@@ -6062,3 +6062,59 @@ fn sqlp_window_order_by_multiple_keys_limitation() {
         "unexpected stderr: {mixed_dir_stderr}"
     );
 }
+
+// Issue #4688: Polars py-1.44.2 (qsv 23.0.1) printed "Deprecation: Casting from String to Date
+// is deprecated" once per evaluation of a SQL `CAST(<string> AS DATE)`, so an LLM-written
+// describegpt query produced a wall of warnings. Newer Polars handles the SQL cast without the
+// warning. Pin both the results and the silence, so a Polars bump can't bring the warning back
+// (or turn the cast into an error) unnoticed.
+#[test]
+fn sqlp_cast_string_to_date_is_silent() {
+    let wrk = Workdir::new("sqlp_cast_string_to_date_is_silent");
+    wrk.create(
+        "t.csv",
+        vec![
+            svec!["id", "d", "y"],
+            svec!["1", "2020-01-15", "2019"],
+            svec!["2", "2021-03-02", "2020"],
+            svec!["3", "2022-07-09", "2021"],
+        ],
+    );
+
+    for (query, try_parsedates, expected) in [
+        // a String column (no date inference)
+        (
+            "select CAST(d AS DATE) AS x from _t_1",
+            false,
+            "x\n2020-01-15\n2021-03-02\n2022-07-09\n",
+        ),
+        // a string expression
+        (
+            "select CAST(CONCAT(CAST(y AS VARCHAR), '-01-01') AS DATE) AS x from _t_1",
+            true,
+            "x\n2019-01-01\n2020-01-01\n2021-01-01\n",
+        ),
+        // a string literal compared against a parsed Date column
+        (
+            "select count(*) AS n from _t_1 where d >= CAST('2021-01-01' AS DATE)",
+            true,
+            "n\n2\n",
+        ),
+    ] {
+        let mut cmd = wrk.command("sqlp");
+        cmd.arg("t.csv").arg(query);
+        if try_parsedates {
+            cmd.arg("--try-parsedates");
+        }
+        let out = wrk.output(&mut cmd);
+        let stderr = String::from_utf8_lossy(&out.stderr);
+        assert!(out.status.success(), "{query}: {stderr}");
+        assert_eq!(String::from_utf8_lossy(&out.stdout), expected, "{query}");
+        assert!(
+            !["deprecation", "deprecated"]
+                .iter()
+                .any(|w| stderr.to_ascii_lowercase().contains(w)),
+            "{query} printed a deprecation warning: {stderr}"
+        );
+    }
+}
```

**File**: `tests/test_viz.rs` (modified, +44/-0)
```diff
@@ -5364,6 +5364,50 @@ fn viz_smart_metadata_description_only_with_dict_info() {
     ));
 }
 
+#[test]
+fn viz_smart_metadata_description_renders_inline_markdown() {
+    // issue #4689: the header row showed `**grew**` and `\$` literally, while the drawer
+    // rendered them. Both now go through the same inline renderer, which still escapes raw HTML.
+    let wrk = Workdir::new("viz_smart_metadata_description_renders_inline_markdown");
+    wrk.create_from_string(
+        "data.csv",
+        "region,revenue\neast,1000\neast,1200\nwest,5000\nwest,5200\n",
+    );
+    wrk.create_from_string(
+        "dict.schema.json",
+        r#"{
+          "$schema": "https://json-schema.org/draft/2020-12/schema",
+          "type": "object",
+          "description": "Payments **grew** to \\$456 million <b>here</b>.",
+          "properties": {
+            "region": { "type": "string", "title": "Region",
+              "x-qsv": { "qsv_type": "String", "role": "dimension", "concept": "category.status" } },
+            "revenue": { "type": "integer", "title": "Revenue",
+              "x-qsv": { "qsv_type": "Integer", "role": "measure", "concept": "measure.amount" } }
+          }
+        }"#,
+    );
+    let out = wrk.path("di.html").to_string_lossy().to_string();
+    let mut cmd = wrk.command("viz");
+    cmd.args([
+        "smart",
+        "data.csv",
+        "-o",
+        &out,
+        "--dict-info",
+        "--dictionary",
+    ])
+    .arg(wrk.path("dict.schema.json"));
+    wrk.assert_success(&mut cmd);
+    let html = wrk.read_to_string("di.html").unwrap();
+    assert!(
+        html.contains(
+            r#"<td class="qsv-viz-meta-k">Description:</td><td>Payments <strong>grew</strong> to $456 million &lt;b&gt;here&lt;/b&gt;.</td>"#
+        ),
+        "header description row"
+    );
+}
+
 #[test]
 fn viz_smart_metadata_description_absent_when_dictionary_has_none() {
     let wrk = Workdir::new("viz_smart_metadata_description_absent_when_dictionary_has_none");
```

---

### Incident Patch 15: `5028c3c5` (2026-10-01)
**Commit Message**: fix(viz): bare-year time axes and responsive year tick labels (#4685, #4686) (#4695)

* fix(viz): bare-year time axes and responsive year tick labels (#4685, #4686)

#4685: a dictionary-routed column of 4-digit years now drives the
time-series panel. qsv stats types `2019` as Integer, so the column was
never a date column. It must not become one either: every consumer of
canonical_date_col re-parses cells with qsv_dateparser, which reads
"2019" as epoch seconds.
- bare_year_col / trend_time_col pick an Integer column only when the
  dictionary routes it Temporal and its min/max are 4-digit years. It is
  used only by the trend panel and by the drawer/stderr "time axis"
  label, via one shared function.
- The trend parses such a cell as Jan 1 of that year, buckets by Year
  (categorical axis), and averages an untagged numeric Y per year.
- The stderr skip list names the axis ("Program_Year (time axis)") and
  says why any other timestamp column isn't one.
- Without a dictionary nothing changes.

#4686: the missing year labels came from viz's own
RESPONSIVE_CATEGORY_TICKS_SCRIPT, not Plotly's date ticks. It budgeted a
fixed 72 px per label (sized for "2024-Q1") and picked labels by r

**File**: `.claude/skills/qsv/qsv-viz.json` (modified, +1/-1)
```diff
@@ -141,7 +141,7 @@
       {
         "flag": "--dictionary",
         "type": "string",
-        "description": "Use a describegpt Data Dictionary to guide panel selection from each field's semantic role/concept (falling back to its content type) instead of relying on column statistics alone: dimensions and numeric codes (ward, census_tract, zone) become bars, measures get box/correlation/trend panels, date/datetime columns feed the time-series panel, identifiers / PII / free-text are skipped, and lat/lon feed the map. Field labels are shown as panel subtitles. Columns the dictionary cannot classify still use the statistical heuristic. <src> is either \"infer\", to run describegpt on the input now (requires an LLM configured), or a path to an existing describegpt dictionary file (jsonschema or json). With \"infer\", the generated dictionary is saved beside the input as <stem>.schema.json; if that file already exists it is REUSED as-is, skipping the LLM. An inferred dictionary is a DRAFT, not an oracle: re-inferring the same data can assign a column a different role, and role drives panel selection, so a re-infer can hand you a structurally different Data Schematic. The saved sidecar is therefore the artifact of record - review it, correct it, and keep it beside the data. Set QSV_VIZ_DICT_FRESH=1 to ignore it and bypass describegpt's completion cache, forcing a fresh inference that overwrites the sidecar on success. Generation/read failures soft-fall back to the stats-only Data Schematic. qsv re-verifies every hint below on read, so a hand-edit can correct the model but cannot smuggle in a claim the data does not support. Per-field hints live in a property's \"x-qsv\" object: gauge_range [min,max] - render the KPI tile as a GAUGE on that canonical scale; kept only when the observed value is inside it target <goal> - add a \"vs target\" DELTA (value minus target). A goal you supply, so \"infer\" never emits one currency <ISO-4217> - prefix the KPI tile with that currency's symbol ($192B); an unknown code renders verbatim (\"XOF 1.2B\") unit <UCUM code> - suffix a NON-monetary measure with the unit symbol (\"18.4 °C\"), in KPI tiles, axis titles and hovers. Checked CASE-SENSITIVELY against ~44 common units (UCUM distinguishes \"m\" from the \"M\" mega prefix); an off-table code is dropped. Mutually exclusive with currency aggregation sum|mean - declare how the measure combines across a group, overriding qsv's extensive-vs-intensive guess either way denominator {column, unit?, level?} - on a REGION-CODE column, name the column holding each region's population to add a RATE panel beside the raw-count region map. \"unit\" converts an area given in m2 or km2; \"level\" names the AREAL unit those values describe as a \"geo.\" concept token, and a level naming a COARSER geography than the region column is refused The dictionary is also the ONLY source of the pipeline panel, declared in the DATASET-level \"x-qsv\" object as a \"relationships\" entry with \"kind\": \"pipeline\". Stages may be held in separate columns (\"members\", widest/upstream first) or as values of one category column (\"stage_column\" plus \"stages\", with an optional \"value_column\"). Declared order is authoritative and is never re-sorted by size: it draws as a funnel while the stage totals never grow, and as a BRIDGE when one outruns its predecessor. For the hint semantics, the pipeline encodings and worked JSON, see https://github.com/dathere/qsv/wiki/Visualization#data-dictionary Only affects `smart`."
+        "description": "Use a describegpt Data Dictionary to guide panel selection from each field's semantic role/concept (falling back to its content type) instead of relying on column statistics alone: dimensions and numeric codes (ward, census_tract, zone) become bars, measures get box/correlation/trend panels, date/datetime columns (or a column of 4-digit years tagged as time) feed the time-series panel, identifiers / PII / free-text are skipped, and lat/lon feed the map. Field labels are shown as panel subtitles. Columns the dictionary cannot classify still use the statistical heuristic. <src> is either \"infer\", to run describegpt on the input now (requires an LLM configured), or a path to an existing describegpt dictionary file (jsonschema or json). With \"infer\", the generated dictionary is saved beside the input as <stem>.schema.json; if that file already exists it is REUSED as-is, skipping the LLM. An inferred dictionary is a DRAFT, not an oracle: re-inferring the same data can assign a column a different role, and role drives panel selection, so a re-infer can hand you a structurally different Data Schematic. The saved sidecar is therefore the artifact of record - review it, correct it, and keep it beside the data. Set QSV_VIZ_DICT_FRESH=1 to ignore it and bypass describegpt's completion cache, forcing a fresh inference that overwrites the sidecar on success. Generation/read failures soft-fall back to the stats-only Data Schema
```

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -113,6 +113,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   - If the firewall still refuses a page, the pager halves the page size and retries at the same offset, down to 25 records.
   - A refusal is now reported as a firewall rejection, with its support ID. Any other non-JSON response reports its HTTP status, content type, size and the start of its body.
   - A refusal also aborts `viz smart` region resolution at once. Before, the same shared geometry fetch was charged to every candidate column in turn and summarized as "no region column resolved".
+- **`viz smart`: a dictionary-tagged column of bare years now drives the time-series panel** ([#4685](https://github.com/dathere/qsv/issues/4685)). `qsv stats` types `2019` as Integer, so a `Program_Year` / `Fiscal_Year` column tagged `time.*` drew no trend panel; the data had to be rewritten as `2019-01-01` first. Such a column is now treated as a yearly axis (categorical x-axis, one point per year) when the data dictionary routes it as time and its values are all 4-digit years. An untagged numeric Y is averaged per year rather than plotted as raw rows. Without a dictionary nothing changes, since a column of 4-digit numbers can just as well be a price or a code. Animations and the seasonality profile still require a real date.
+  - A dictionary carrying only the legacy `content_type: duration` now charts that column as an averaged measure, as `concept: time.duration` already did (#4177). It used to be dropped as a timestamp, and a column of 4-digit durations (1800–3600 s) could have been read as years.
+  - The stderr "skipped" list no longer makes the time series look like a failure. The column driving it reads `Program_Year (time axis)`. A timestamp column that isn't the axis says why: another column is the time axis, or its values aren't dates or 4-digit years (e.g. epoch seconds). The Data Schematic drawer labels a bare-year axis the same way.
+- **`viz`: time axes no longer drop year labels in mid-width panels** ([#4686](https://github.com/dathere/qsv/issues/4686)). This wasn't Plotly's date ticking. Year buckets are already a categorical axis, whose labels viz's own resize script thinned on a fixed 72 px per label, a width sized for `2024-Q1`. Seven years in a ~450 px panel kept five labels, and 2020 was one of those dropped. The script now measures each label's width in the axis font. It also places labels at an even interval, so it never shows two adjacent categories while skipping their neighbours (2021 and 2022 shown, 2020 and 2023 dropped). All seven years now show from about 400 px (previously about 600 px). Labels on dense quarter axes always keep a gap of at least 16 px, though a very wide axis can show a label or two fewer than before.
 - **`stats` & `frequency` no longer invoke undefined behavior on malformed CSV** ([#4614](https://github.com/dathere/qsv/pull/4614)). Both called `unwrap_unchecked()` on the record reader's result, so a ragged record - everyday malformed input - was type-confusion UB: release builds died with no output at all (`stats` SIGTRAP, exit 133; `frequency` SIGSEGV, exit 139). The read error is now reported. The pipelined `stats` reader, which used to look like a normal EOF when it bailed (complete-looking stats for a truncated read), now returns its error, and the parallel paths surface a worker's read error instead of silently merging a partial result. Commands that run `stats` as a subprocess (`schema`, `viz smart`, `frequency`'s cache path) now relay its diagnostic instead of only an exit code.
 - **`--flexible` is now part of every stats/frequency cache-validity key** ([#4616](https://github.com/dathere/qsv/pull/4616)). Three reuse paths ignored it: `stats --everything --flexible` served its cache to any later, narrower strict `stats` run; `frequency --flexible --frequency-jsonl` served a strict `frequency` run a complete-looking table for records it should refuse; and the stats JSONL cache consumers keyed only on `--no-headers`/`--delimiter`/`--prefer-dmy`. The consumer checks are deliberately one-way: a `--flexible` cache is refused to a strict run, but a `--flexible` run may reuse a strict cache, since a strict cache proves the input had no ragged records.
 - **`stats` caches never out-permission their source CSV** ([#4622](https://github.com/dathere/qsv/pull/4622)). `<FILESTEM>.stats.csv.data.jsonl` was created at the umask default, so a `0600` CSV yielded a world-readable `0644` file of its columns' min/max and mode/antimode values, while `<FILESTEM>.stats.csv` was always `0600` whatever the source. Both now go through the new `util::DerivedFile`, which writes a sibling temp at its final mode (umask default intersected with the source's mode) and renames it into place - the frequency cache's logic, now shared. A world-readable CSV therefore gets a reusable `.stats.csv` again. Under `moarstats --join-inputs` the JSONL cache takes its mode from the joined data, not jus
```

**File**: `docs/help/viz.md` (modified, +1/-1)
```diff
@@ -418,7 +418,7 @@ qsv viz --help
 | &nbsp;`‑‑no‑other`&nbsp; | flag | Omit the "Other (N)" aggregate bar from frequency bar charts. It collects the categories beyond --limit (N = how many distinct categories were rolled up) and is shown by default. When just ONE category is left over, it is charted under its own name instead of as an opaque "Other (1)" bar. |  |
 | &nbsp;`‑‑smarter`&nbsp; | flag | Before building the Data Schematic, run `qsv moarstats --advanced` to enrich the stats cache with distribution-shape statistics (bimodality, entropy, skewness, outlier share, Gini). This unlocks histograms for bimodal columns, frequency bars for concentrated high-cardinality columns, skew/outlier hints on box panels, and Lorenz curves for the most unequal additive measures. Costs one extra pass and writes <stem>.stats.csv, its sidecars and an .idx index. On geocode-enabled builds it also adds the US FIPS code to map hovers. Applied only with default parsing; an input using the --no-headers or --delimiter flags falls back to the standard Data Schematic. Only affects `smart`. |  |
 | &nbsp;`‑‑hierarchy‑style`&nbsp; | string | For `smart`, the chart used for the categorical part-to-whole hierarchy panel (built when 2+ low-cardinality dimensions exist). One of: auto (default), treemap, sunburst, icicle. auto follows best practice - a treemap for a shallow 2-level hierarchy (accurate size comparison) and a sunburst for a deep 3-level one (parent/child structure); icicle is an opt-in level-aligned alternative. An explicit style also bypasses the association screen that would otherwise skip an uninformative panel. Only affects `smart`. |  |
-| &nbsp;`‑‑dictionary`&nbsp; | string | Use a describegpt Data Dictionary to guide panel selection from each field's semantic role/concept (falling back to its content type) instead of relying on column statistics alone: dimensions and numeric codes (ward, census_tract, zone) become bars, measures get box/correlation/trend panels, date/datetime columns feed the time-series panel, identifiers / PII / free-text are skipped, and lat/lon feed the map. Field labels are shown as panel subtitles. Columns the dictionary cannot classify still use the statistical heuristic. <src> is either "infer", to run describegpt on the input now (requires an LLM configured), or a path to an existing describegpt dictionary file (jsonschema or json). With "infer", the generated dictionary is saved beside the input as <stem>.schema.json; if that file already exists it is REUSED as-is, skipping the LLM. An inferred dictionary is a DRAFT, not an oracle: re-inferring the same data can assign a column a different role, and role drives panel selection, so a re-infer can hand you a structurally different Data Schematic. The saved sidecar is therefore the artifact of record - review it, correct it, and keep it beside the data. Set QSV_VIZ_DICT_FRESH=1 to ignore it and bypass describegpt's completion cache, forcing a fresh inference that overwrites the sidecar on success. Generation/read failures soft-fall back to the stats-only Data Schematic. qsv re-verifies every hint below on read, so a hand-edit can correct the model but cannot smuggle in a claim the data does not support. Per-field hints live in a property's "x-qsv" object: gauge_range [min,max] - render the KPI tile as a GAUGE on that canonical scale; kept only when the observed value is inside it target <goal> - add a "vs target" DELTA (value minus target). A goal you supply, so "infer" never emits one currency <ISO-4217> - prefix the KPI tile with that currency's symbol ($192B); an unknown code renders verbatim ("XOF 1.2B") unit <UCUM code> - suffix a NON-monetary measure with the unit symbol ("18.4 °C"), in KPI tiles, axis titles and hovers. Checked CASE-SENSITIVELY against ~44 common units (UCUM distinguishes "m" from the "M" mega prefix); an off-table code is dropped. Mutually exclusive with currency aggregation sum\|mean - declare how the measure combines across a group, overriding qsv's extensive-vs-intensive guess either way denominator {column, unit?, level?} - on a REGION-CODE column, name the column holding each region's population to add a RATE panel beside the raw-count region map. "unit" converts an area given in m2 or km2; "level" names the AREAL unit those values describe as a "geo." concept token, and a level naming a COARSER geography than the region column is refused The dictionary is also the ONLY source of the pipeline panel, declared in the DATASET-level "x-qsv" object as a "relationships" entry with "kind": "pipeline". Stages may be held in separate columns ("members", widest/upstream first) or as values of one category column ("stage_column" plus "stages", with an optional "value_column"). Declared order is authoritative and is never re-sorted by size: it draws as a funnel while the stage totals never grow, and as a BRIDGE when one outruns its predecessor. For the hint semantics, the pipeline encodings and worked JSON, see <https://g
```

**File**: `examples/viz/README.md` (modified, +3/-1)
```diff
@@ -193,7 +193,9 @@ columns, a **3D scatter** of the strongest pair plus the *least-redundant* third
 axis is added as well — unless the strongest pair is itself near-collinear, in
 which case the 3D would collapse to a plane and is skipped. When the data has a date/datetime
 column (auto-detected via stats date inference) plus a continuous numeric column,
-a **time-series trend** panel of that column over time is added too. When a
+a **time-series trend** panel of that column over time is added too. With a `--dictionary`,
+a column of 4-digit years tagged as time (e.g. `Program_Year`, concept `time.date`) serves
+as a yearly time axis as well, since `stats` types bare years as Integer, not Date. When a
 latitude/longitude column pair is detected, a **geographic map** panel leads the
 Data Schematic — drawn on MapLibre tiles for local extents, or as an offline
 **projection world-overview** (ScatterGeo, no tiles or token) when the
```

**File**: `src/cmd/viz.rs` (modified, +204/-38)
```diff
@@ -539,9 +539,10 @@ smart options:
                            each field's semantic role/concept (falling back to its content
                            type) instead of relying on column statistics alone: dimensions
                            and numeric codes (ward, census_tract, zone) become bars, measures
-                           get box/correlation/trend panels, date/datetime columns feed the
-                           time-series panel, identifiers / PII / free-text are skipped, and
-                           lat/lon feed the map. Field labels are shown as panel subtitles.
+                           get box/correlation/trend panels, date/datetime columns (or a
+                           column of 4-digit years tagged as time) feed the time-series
+                           panel, identifiers / PII / free-text are skipped, and lat/lon
+                           feed the map. Field labels are shown as panel subtitles.
                            Columns the dictionary cannot classify still use the statistical
                            heuristic. <src> is either "infer", to run describegpt on the
                            input now (requires an LLM configured), or a path to an existing
@@ -13407,11 +13408,28 @@ const SCRIPT_TEMPLATE: &str = r#"<script>
 /// Those labels deliberately use a category axis ("2024-Q1" is not a date), but plotly's default
 /// auto-angle turns a dense category axis vertical and then admits nearly every label. The axis is
 /// marked by an explicit zero-degree `tickangle`; this observer converts its measured pixel width
-/// into an evenly-spaced label budget (including both endpoints), preserving every trace point
-/// while showing only labels that fit.
+/// into an even label stride (including both endpoints), preserving every trace point while
+/// showing only labels that fit.
+///
+/// Each label's slot is its MEASURED width (canvas `measureText` in the axis's own tick font) plus
+/// a gap, capped at the original fixed 72 px, so a slot is never wider than before. The fixed
+/// 72 px was sized for "2024-Q1" and thinned 4-character years for no reason: seven years in a
+/// ~450 px panel kept five labels and dropped 2020 (issue #4686). Labels then follow an EVEN
+/// stride; on a wide dense axis that can show a label or two fewer than the old rounded-index
+/// picking, which is the price of never placing two labels on adjacent categories.
 const RESPONSIVE_CATEGORY_TICKS_SCRIPT: &str = r#"<script>
 (function () {
-  var MARK = "qsv-responsive-category-ticks", PX_PER_TICK = 72;
+  var MARK = "qsv-responsive-category-ticks", MAX_PX_PER_TICK = 72, TICK_GAP_PX = 16, ctx = null;
+  function labelPx(labels, font) {
+    try {
+      ctx = ctx || document.createElement("canvas").getContext("2d");
+      ctx.font = (font.size || 12) + "px " + (font.family || "sans-serif");
+      var widest = 0;
+      for (var i = 0; i < labels.length; i++)
+        widest = Math.max(widest, ctx.measureText(String(labels[i])).width);
+      return widest;
+    } catch (e) { return MAX_PX_PER_TICK; }
+  }
   function update(gd) {
     var layout = gd.layout || {}, full = gd._fullLayout, state = gd.__qsvCategoryTicks;
     if (!full || !full._size || !state || state.mark !== MARK) return;
@@ -13422,12 +13440,19 @@ const RESPONSIVE_CATEGORY_TICKS_SCRIPT: &str = r#"<script>
       if (!categories.length) return;
       var domain = fa.domain || [0, 1];
       var width = full._size.w * Math.max(0, domain[1] - domain[0]);
-      var budget = Math.min(categories.length, Math.max(2, Math.floor(width / PX_PER_TICK)));
-      var ticks = [];
-      for (var i = 0; i < budget; i++) {
-        var at = budget === 1 ? 0 : Math.round(i * (categories.length - 1) / (budget - 1));
-        if (ticks[ticks.length - 1] !== categories[at]) ticks.push(categories[at]);
-      }
+      var perTick = Math.min(MAX_PX_PER_TICK, Math.ceil(labelPx(categories, fa.tickfont || {})) + TICK_GAP_PX);
+      // An EVEN stride of k categories, sized so any two labels are at least one label slot
+      // apart. Picking a label budget and rounding indices instead put some labels on ADJACENT
+      // categories (2021 next to 2022, with 2020 and 2023 dropped), which reads as random and,
+      // once slots are measured rather than fixed, left dense axes only a few px apart.
+      var n = categories.length;
+      var k = Math.max(1, Math.ceil(perTick / Math.max(width / Math.max(n, 1), 1e-6)));
+      var idx = [];
+      for (var i = 0; i < n; i += k) idx.push(i);
+      // keep both endpoints: the last stride label moves to the final category, which only
+      // lengthens the final interval
+      if (idx[idx.length - 1] !== n - 1) { if (idx.length > 1) idx.pop(); idx.push(n - 1); }
+      var ticks = idx.map(function (i) { return categories[i]; });
       if (JSON.stringify(axis.ticktext || []) !== JSON.stringify(ticks)) {
         upd[key + ".tickmode"] = "array";
         upd[key + ".tickvals"] = ticks;
@@
```

**File**: `tests/test_viz.rs` (modified, +276/-0)
```diff
@@ -18915,6 +18915,282 @@ fn viz_smart_trend_quarterly_uses_quarter_bucket_and_category_axis() {
     );
 }
 
+// ------------------------------------------------------------------------------------------------
+// Issue #4685: a dictionary-routed column of bare 4-digit years drives the time-series panel.
+// ------------------------------------------------------------------------------------------------
+
+/// Line traces whose x values are all 4-digit years, from a page rendered with
+/// `QSV_VIZ_NO_COMPRESS` (plain figure JSON), paired with that figure's x-axis type.
+fn year_axis_line_traces(html: &str) -> Vec<(serde_json::Value, String)> {
+    let mut out = Vec::new();
+    for chunk in html.split("Plotly.newPlot(").skip(1) {
+        let Some(comma) = chunk.find(", ") else {
+            continue;
+        };
+        let mut vals = serde_json::Deserializer::from_str(&chunk[comma + 2..])
+            .into_iter::<serde_json::Value>();
+        let Some(Ok(fig)) = vals.next() else {
+            continue;
+        };
+        let axis_type = fig["layout"]["xaxis"]["type"]
+            .as_str()
+            .unwrap_or("")
+            .to_string();
+        for t in fig["data"].as_array().into_iter().flatten() {
+            let xs: Vec<&str> = t["x"]
+                .as_array()
+                .map(|a| a.iter().filter_map(|v| v.as_str()).collect())
+                .unwrap_or_default();
+            if t["mode"] == "lines"
+                && !xs.is_empty()
+                && xs
+                    .iter()
+                    .all(|x| x.len() == 4 && x.bytes().all(|b| b.is_ascii_digit()))
+            {
+                out.push((t.clone(), axis_type.clone()));
+            }
+        }
+    }
+    out
+}
+
+/// yr,amt rows: 2019..=2023, three rows per year, amounts chosen so each year's sum is distinct.
+fn bare_year_rows() -> String {
+    let mut rows = String::from("yr,amt\n");
+    for (i, year) in (2019..=2023).enumerate() {
+        for k in 1..=3 {
+            rows.push_str(&format!("{year},{}\n", 100 * (i + 1) + k));
+        }
+    }
+    rows
+}
+
+fn bare_year_dict(amt_concept: Option<&str>) -> String {
+    let amt = amt_concept.map_or(String::new(), |c| {
+        format!(
+            r#", "amt": {{ "type": "number", "x-qsv": {{ "qsv_type": "Integer", "role": "measure", "concept": "{c}" }} }}"#
+        )
+    });
+    format!(
+        r#"{{ "$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object",
+  "properties": {{
+    "yr": {{ "type": "integer", "title": "Program Year", "x-qsv": {{ "qsv_type": "Integer", "role": "dimension", "concept": "time.date" }} }}{amt}
+  }} }}"#
+    )
+}
+
+#[test]
+fn viz_smart_bare_year_column_drives_the_time_series() {
+    let wrk = Workdir::new("viz_smart_bare_year_column_drives_the_time_series");
+    wrk.create_from_string("y.csv", &bare_year_rows());
+    wrk.create_from_string("dict.json", &bare_year_dict(Some("measure.money")));
+
+    let mut cmd = wrk.command("viz");
+    cmd.env("QSV_VIZ_NO_COMPRESS", "1")
+        .args([
+            "smart",
+            "y.csv",
+            "--dict-info",
+            "-o",
+            "dash.html",
+            "--dictionary",
+        ])
+        .arg(wrk.path("dict.json"));
+    let out = wrk.output(&mut cmd);
+    let stderr = String::from_utf8_lossy(&out.stderr);
+    assert!(out.status.success(), "{stderr}");
+    let html = wrk.read_to_string("dash.html").unwrap();
+
+    let traces = year_axis_line_traces(&html);
+    assert_eq!(
+        traces.len(),
+        1,
+        "exactly one year-axis trend expected: {stderr}"
+    );
+    let (trace, axis_type) = &traces[0];
+    assert_eq!(
+        trace["x"],
+        serde_json::json!(["2019", "2020", "2021", "2022", "2023"])
+    );
+    // measure.money sums per year: (101+102+103), (201+202+203), ...
+    assert_eq!(
+        trace["y"],
+        serde_json::json!([306.0, 606.0, 906.0, 1206.0, 1506.0])
+    );
+    assert_eq!(
+        axis_type, "category",
+        "yearly buckets use the category axis"
+    );
+    // stderr and the drawer both name the column as the time axis, not as dropped
+    assert!(
+        stderr.contains("yr (time axis)"),
+        "stderr must say the year column is the time axis: {stderr}"
+    );
+    assert!(
+        html.contains("it is the x-axis of the time-based panels"),
+        "the drawer must describe the year column as the time axis"
+    );
+}
+
+#[test]
+fn viz_smart_bare_year_axis_averages_an_untagged_measure_per_year() {
+    // An un-tagged numeric Y normally plots RAW rows over time; on a year axis that would stack
+    // every row of a year on its Jan 1 and label it "2019-01-01". It must be averaged per year.
+    let wrk = Workdir::new("viz_smart_bare_year_axis_averages_an_untagged_measure_per_year");
+    wrk.create_from_string("y.csv", &bare_year_rows());
+    wrk.create_from_string("dict.json", &bare_year_dict(None));
+
+    let mut cmd = wrk.command("viz");
+   
```

#### Recent Merged Pull Requests:
- **PR #4731** (2026-10-04): feat(readstat): --dictionary writes a JSON Schema data dictionary from the file's metadata (@jqnatividad)
- **PR #4730** (2026-10-04): fix(readstat): write SPSS DTIME durations as seconds (@jqnatividad)
- **PR #4729** (2026-10-04): feat(readstat): read part of a file with --select, --offset, --limit & --sample (@jqnatividad)
- **PR #4727** (2026-10-04): deps(readstat): bump polars-readstat-rs to 0.24.0 (@jqnatividad)
- **PR #4726** (2026-10-04): feat(stats): warn when exact mode/cardinality tracking may not fit in memory (@jqnatividad)
- **PR #4725** (2026-10-04): fix(frequency): implement --other-sorted once for CSV and JSON (@jqnatividad)
- **PR #4723** (2026-10-04): ci(windows): pin generated help & tool-definition files to LF (@jqnatividad)
- **PR #4722** (2026-10-04): ci: publish a Windows ARM64 GNU-family (gnullvm) artifact (@meop)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
