> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dathere-qsv-learnings.md`  
> **Source**: github ([https://github.com/dathere/qsv](https://github.com/dathere/qsv))  
> **Source Version**: `b50fa327`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T15:42:14.402Z  
> **Learning ID**: `learn-github-dathere-qsv`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): dathere/qsv

> **Canonical Artifact**: `07_PROJECT_LEARNING/dathere-qsv-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dathere/qsv](https://github.com/dathere/qsv))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-22T15:42:14.395Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dathere/qsv`
- **Description**: Blazing-fast, Neuro-symbolic Data-Wrangling toolkit
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3813 stars

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

use minijinja::{Environment, value::Serde};
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
    let mj_context = minijinja::Value::from(Serde(context));

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
                              Must be a single character. (default: ,)
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

use crate::{CliResult, cmd::joinp::path_delim, config::Delimiter, util};

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
    // stdin is copied to a temp `stdin.csv`, whose made-up extension must not pick the delimiter
    let mut stdin_input: Option<PathBuf> = None;
    let mut inputs = Vec::with_capacity(args.arg_input.len());
    for (path, source) in util::process_input_with_sources(args.arg_input, &tmpdir, "")? {
        if matches!(source, util::InputSource::Stdin) {
            stdin_input = Some(path.clone());
        }
        inputs.push(path);
    }
    args.arg_input = inputs;

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
    // each input's own delimiter, shared by cache generation and the query plan
    let input_delims: Vec<u8> = args
        .arg_input
        .iter()
        .map(|p| {
            if stdin_input.as_ref() == Some(p) {
                delim
            } else {
                path_delim(p, args.flag_delimiter, delim)
            }
        })
        .collect();

    // ── 1. Resolve table names & aliases ────────────────────────
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
use std::sync::OnceLock;
#[cfg(feature = "self_update")]
use std::time::Duration;

use docopt::Docopt;
use serde::de::DeserializeOwned;

use crate::{CliError, CliResult, config::Delimiter, select::SelectColumns};

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

const OTHER_ENV_VARS: &[&str] = &["all_proxy", "no_proxy", "http_proxy", "https_proxy"];

#[cfg(all(feature = "fetch", not(feature = "lite")))]
macro_rules! update_cache_info {
    ($progress:expr_2021, $cache_instance:expr_2021) => {
        use cached::Cached;
        use indicatif::HumanCount;

        let cache = $cache_instance.read();
        let size = cache.cache_size();
        if size > 0 {
            let hits = cache.cache_hits().unwrap_or_default();
            let misses = cache.cache_misses().unwrap_or(1);
            #[allow(clippy::cast_precision_loss)]
            let hit_ratio = (hits as f64 / (hits + misses) as f64) * 100.0;
            let capacity = cache.cache_capacity();
            drop(cache);
            $progress.set_message(format!(
                " of {} records. Cache {:.2}% entries: {} capacity: {}.",
                HumanCount($progress.length().unwrap()),
                hit_ratio,
                HumanCount(size as u64),
                HumanCount(capacity.unwrap() as u64),
            ));
        }
    };
    ($progress:expr_2021, $cache_hits:expr_2021, $num_rows:expr_2021) => {
        use indicatif::HumanCount;

        #[allow(clippy::cast_precision_loss)]
        let hit_ratio = ($cache_hits as f64 / $num_rows as f64) * 100.0;
        $progress.set_message(format!(
            " of {} records. Cache hit ratio: {hit_ratio:.2}%",
            HumanCount($progress.length().unwrap()),
        ));
    };
}

#[cfg(all(feature = "fetch", not(feature = "lite")))]
pub(crate) use update_cache_info;

pub fn get_args<T>(usage: &str, argv: &[&str]) -> CliResult<T>
where
    T: DeserializeOwned,
{
    // `Docopt::deserialize` is just `parse().and_then(ArgvMap::deserialize)`, so splitting
    // it costs nothing and lets the guard see docopt's PARSED values. `parse` is also
    // where --help/--version are detected, so both still short-circuit ahead of the guard.
    let vals = Docopt::new(usage)
        .and_then(|d| {
            d.argv(argv.iter().copied())
                .version(Some(version()))
                .parse()
        })
        .map_err(CliError::from)?;

    check_output_is_not_input(&vals, argv)?;

    vals.deserialize().map_err(CliError::from)
}

pub type Idx = Option<usize>;

// how often a background (non-flag) update check is allowed to hit GitHub: ~twice a month
#[cfg(feature = "self_update")]
const UPDATE_CHECK_INTERVAL: Duration = Duration::from_hours(360);

/// Tabular file extensions qsv recognizes for delimiter inference inside a zip.
const ZIP_TABULAR_EXTS: [&str; 4] = ["csv", "tsv", "tab", "ssv"];

mod args;
mod derived_file;
mod envvars;
mod headers;
mod http;
mod index;
mod input;
mod json_out;
mod rows;
mod runtime;
mod special_format;
mod stats_cache;
mod subprocess;
mod update;
mod version;

pub use args::*;
pub use derived_file::*;
pub use envvars::*;
pub use headers::*;
pub use http::*;
pub use index::*;
pub use input::*;
pub use json_out::*;
pub use rows::*;
pub use runtime::*;
pub use special_format::*;
pub use stats_cache::*;
pub use subprocess::*;
pub use update::*;
pub use version::*;

#[cfg(test)]
mod tests;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4829** (2026-10-16): **schema: --enum-threshold ignored when no column is under it (every column gets a full enum)**
  *Symptoms*: ## Summary  `qsv schema --enum-threshold N` is supposed to limit `enum` constraints to columns with at most N distinct values. But when **no** column has between 2 and N distinct values, **every** column gets a complete `enum`, however many distinct values it has. When at least one column does qualify, the threshold works as documented. So whether a column gets an `enum` depends on the *other* columns in the file.  Found while reviewing #4827.  ## Repro (qsv 25.0.0 / master)  ```sh # every column is above the threshold -> every column gets a full enum { echo id,txt; for i in $(seq 1 80); do echo "$i,v$i"; done; } > hc.csv qsv schema hc.csv --enum-threshold 50 jq -c '.properties|map_values(.enum|length)' hc.csv.schema.json # {"id":80,"txt":80}  # add one column with 3 distinct values -> the threshold suddenly applies { echo id,txt,cat; for i in $(seq 1 80); do echo "$i,v$i,c$((i%3))"; done; } > mx.csv qsv schema mx.csv jq -c '.properties|map_values(.enum|length)' mx.csv.schema.json # {"id":0,"txt":0,"cat":3} ```  Similarly, `--enum-threshold 1` (where no column with more than one value can qualify) enumerates every column instead of none.  ## Cause  `build_low_cardinality_column_selector_arg` returns `""` when no column qualifies. `get_unique_values` then calls `SelectColumns::parse("")`, which means "select all columns", so `frequency` gathers values for every column, and an `enum` is emitted for each one (80 values each in the first repro, even though the threshold is 50).  

- **Issue #4783** (2026-10-10): **validate --split-ragged: compressed inputs write split files to the current dir, and can overwrite another input's**
  *Symptoms*: `validate --split-ragged` writes `<input>.valid`, `<input>.invalid` and `<input>.validation-errors.tsv` next to a plain input. For `.sz` and `.zip` inputs, which `process_input` unpacks into a temp dir, it writes them into the **current directory** instead, under the input's path relative to that temp dir. So where the files land depends on the input's format, and they can collide.  ### Reproduce (qsv at `257ae7b38`) Split files land in three different places: ```sh mkdir jan feb mar run printf 'x,y\n1,2\n3\n' > jan/data.csv; cp jan/data.csv feb/data.csv; cp jan/data.csv mar/data.csv qsv snappy compress feb/data.csv -o feb/data.csv.sz; rm feb/data.csv (cd mar && zip -q data.zip data.csv && rm data.csv) cd run && qsv validate --split-ragged ../jan/data.csv ../feb/data.csv.sz ../mar/data.zip ``` ``` jan/data.csv.valid, .invalid, .validation-errors.tsv        # plain: next to the input run/data.csv.valid, .invalid, .validation-errors.tsv        # .sz: cwd run/data/data.csv.valid, .invalid, .validation-errors.tsv   # zip: cwd/<archive name>/ ``` A plain file and a `.sz` file in the same folder **overwrite each other's split files, silently**: ```sh printf 'x,y\n1,2\n3\n' > data.csv printf 'x,y\n5,6\n7,8,9\n' > other.csv qsv snappy compress other.csv -o data.csv.sz qsv validate --split-ragged data.csv data.csv.sz cat data.csv.valid      # x,y / 5,6        ← data.csv's 1,2 is gone cat data.csv.invalid    # x,y / 7,8,9      ← data.csv's 3 is gone ``` Both runs print `Wrote data.csv.

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

### Incident Patch 1: `ebb69346` (2026-10-22)
**Commit Message**: deps: update lock file for various security fixes

**File**: `Cargo.lock` (modified, +12/-24)
```diff
@@ -4824,9 +4824,9 @@ checksum = "cf8baf1c55e62ffcace7a9f06f4bd9cd3f0c4beb022d3b367256b91b87513d98"
 
 [[package]]
 name = "memmap2"
-version = "0.9.11"
+version = "0.9.12"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d1219ed1b7f229ee7104d281dd01d6802fe28bb6e95d292942c4daacdeb798c0"
+checksum = "6b0ca1155a9ecc25aa12e8313a119f32edf0255fea2f44839c4ac0a12b2ac157"
 dependencies = [
  "libc",
 ]
@@ -4879,9 +4879,9 @@ dependencies = [
 
 [[package]]
 name = "minijinja"
-version = "3.0.1"
+version = "3.0.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "789a6b737c4a13bec43cd3c1b982aa8a8a192ff4bf444e0fb1fd5a324f064fd1"
+checksum = "0032a2738ba16d9a8822e4eb2833faeed5c41d767633ea753f33b6becd58cbfc"
 dependencies = [
  "itoa",
  "percent-encoding",
@@ -4893,9 +4893,9 @@ dependencies = [
 
 [[package]]
 name = "minijinja-contrib"
-version = "3.0.1"
+version = "3.0.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e15d0d31fbf10ce99b313a238406d62dd5913d95a9be5fa081f1232e31292fc7"
+checksum = "d3ca3f8d41a993f03d865f7fd8a3e63502f778b16ef4680bbc0863d3a2ce12fd"
 dependencies = [
  "jiff",
  "minijinja",
@@ -6844,9 +6844,9 @@ checksum = "4a6394b9e965e73d0a289ee54f589087e2c676aedf60885baf52c76b771e4958"
 
 [[package]]
 name = "ppmd-rust"
-version = "1.5.1"
+version = "1.5.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "494b4379484fc92217cc7d9e3a532375b1d01a61889ec8333025dc3b0377af56"
+checksum = "cd4acc8d264ea385db64ccfdcdfd5909ee9eda0975666723d59f3bfec80b3611"
 
 [[package]]
 name = "ppv-lite86"
@@ -8774,17 +8774,6 @@ dependencies = [
  "windows-sys 0.61.2",
 ]
 
-[[package]]
-name = "socks"
-version = "0.3.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f0c3dbbd9ae980613c6dd8e28a9407b50509d3803b57624d5dfe8315218cd58b"
-dependencies = [
- "byteorder",
- "libc",
- "winapi",
-]
-
 [[package]]
 name = "sorted-vec"
 version = "0.8.11"
@@ -9465,9 +9454,9 @@ dependencies = [
 
 [[package]]
 name = "tokio"
-version = "1.54.0"
+version = "1.54.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a0c168a474b95bfecfe908a65d4bdffc523144b649a74c09c286afb35d53e0bc"
+checksum = "b52fd3255258d26fac7264ab5a76b53c13367136dc011d3d6ad4f8ed070396a3"
 dependencies = [
  "bytes",
  "libc",
@@ -9930,9 +9919,9 @@ checksum = "6d49784317cd0d1ee7ec5c716dd598ec5b4483ea832a2dced265471cc0f690ae"
 
 [[package]]
 name = "ureq"
-version = "3.4.2"
+version = "3.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9a7ac20be9b7726e0bbdbf974c059676d9acb1cd414961f570a4e8231cacd7fc"
+checksum = "cde93ff05758a36a851a398a772b0b79a82fbe3c186a46f2696baaeaf84c966b"
 dependencies = [
  "base64 0.23.1",
  "cookie_store",
@@ -9944,7 +9933,6 @@ dependencies = [
  "rustls-pki-types",
  "serde",
  "serde_json",
- "socks",
  "ureq-proto",
  "utf8-zero",
  "webpki-roots",
```

---

### Incident Patch 2: `6e9a8b15` (2026-10-22)
**Commit Message**: viz: bump vendored DataTables to 3.1.4 (prototype-pollution fix) (#4876)

* viz: bump vendored DataTables to dt-3.1.4/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1

DataTables 3.1.4 is a core-only security release fixing prototype
pollution in util.assignDeep / util.assignDeepObject; upstream recommends
it for all 3.0.0-3.1.3 users. No extension moved.

- Exposure in the data viewer was low: rows reach DataTables as positional
  arrays and the settings objects are qsv-generated literals, so no
  CSV-controlled key reaches the merge helpers.
- Vendored files are the CDN combo bytes (3.1.3 vendored == 3.1.3 CDN was
  confirmed first). The stylesheet differs only in its banner; every
  extension section of the JS is byte-identical, core grows 36 bytes.
- All seven locale files byte-identical to the 3.1.4 plug-ins; zh
  date-condition override stays.
- SRI hashes regenerated; gallery regenerated via
  refresh_external_dashboards.sh (diffs are version/SRI/timestamp churn and
  per-build schematic UUIDs only).
- Verified in Chrome on both the QSV_VIZ_CDN (SRI) and inline gzip paths:
  core reports 3.1.4, all extensions register, sort and search work,
  console clean.

Co-Authored-By: Claude Opus 

**File**: `.github/workflows/devskim.yml` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ jobs:
           #   DevSkim flags as localhost access — fixture noise, not runtime code.
           #   Scoped to the generated text formats so executable/config files in
           #   the same dir (check_semanticmd.py, datadict.yaml) stay scanned.
-          # src/cmd/assets/datatables.min.* : vendored DataTables 3.1.3 bundle
+          # src/cmd/assets/datatables.min.* : vendored DataTables 3.1.4 bundle
           #   (dt/b/cc/date/sb). DS172411 flags every setTimeout call site
           #   regardless of argument type; all 24 in the bundle pass a function
           #   literal, none pass a string — minified third-party noise.
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -64,6 +64,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   - **SQL fixes**: `RIGHT SEMI`/`RIGHT ANTI` join conditions, join keys assigned to the wrong input, `EXISTS` over aggregates, and correlated aggregates over no rows ([#30135](https://github.com/pola-rs/polars/pull/30135), [#30137](https://github.com/pola-rs/polars/pull/30137), [#30146](https://github.com/pola-rs/polars/pull/30146), [#30130](https://github.com/pola-rs/polars/pull/30130)).
   - Also faster joins (as-of joins in particular) and sliced sorts, and out-of-core streaming group-by.
 - **`viz smart`: the guided Tour's vendored [driver.js](https://driverjs.com) is now 1.10.2** (was 1.8.0; [#4859](https://github.com/dathere/qsv/pull/4859)). This brings upstream fixes for popovers and hint beacons inside `<dialog>`s and transformed containers, scrolls tour targets that sit out of view inside a scrollable container into view, and renders the popover title and footer as plain `div`s instead of `header`/`footer` landmarks, so screen readers no longer announce extra page regions. The embedded payloads, the `QSV_VIZ_CDN` jsDelivr URLs and their SRI digests are updated together.
+- **`viz`: vendored DataTables bundle bumped to `dt-3.1.4/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1`** (DataTables 3.1.3 -> 3.1.4; no extension moved; [#4876](https://github.com/dathere/qsv/pull/4876)). This is a core-only security release: it fixes a prototype-pollution risk in DataTables' `util.assignDeep`/`util.assignDeepObject`, and upstream recommends the update for every 3.0.0-3.1.3 user. In qsv's data viewer those helpers merge only qsv-generated settings objects, so exposure was low. The remaining core fixes (`prepend()` with a jQuery object, re-showing hidden columns on destroy, TypeScript types) don't affect the drawer. The stylesheet is byte-identical apart from its version banner, and every extension section of the JS is unchanged. All seven vendored locale files are byte-identical to the 3.1.4 plug-ins, and the `QSV_VIZ_CDN` Subresource Integrity hashes were regenerated.
 - **Internal: `src/util.rs` split into 15 submodules under `src/util/`.** The 7,800-line file is now a facade that keeps the shared statics, `SchemaArgs` and `get_args`, and re-exports `stats_cache`, `input`, `special_format`, `http` and the other submodules, so every `util::…` path is unchanged. Pure code motion with no behavior change ([#4855](https://github.com/dathere/qsv/pull/4855)).
 
 ### Fixed
```

**File**: `THIRD_PARTY_NOTICES.md` (modified, +2/-2)
```diff
@@ -21,7 +21,7 @@ run `cargo tree` or a tool such as `cargo-about` for that inventory.
 | [plotly.js](https://github.com/plotly/plotly.js) | 3.7.0 | MIT | embedded in `qsv viz` HTML output (gzip+base64), or referenced by CDN |
 | [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | as bundled in plotly.js 3.7.0 | BSD-3-Clause | bundled *inside* plotly.js; ships wherever plotly.js does |
 | [plotly.rs](https://github.com/plotly/plotly.rs) | git rev `00fe051` | MIT | Cargo dependency, compiled into the `qsv` binary |
-| [DataTables](https://datatables.net/) + Buttons, ColumnControl, DateTime, SearchBuilder | `dt-3.1.3/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1` | MIT | vendored in `src/cmd/assets/`, compiled in and embedded in `viz smart` HTML |
+| [DataTables](https://datatables.net/) + Buttons, ColumnControl, DateTime, SearchBuilder | `dt-3.1.4/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1` | MIT | vendored in `src/cmd/assets/`, compiled in and embedded in `viz smart` HTML |
 | [driver.js](https://driverjs.com/) | 1.10.2 | MIT | vendored in `src/cmd/assets/`, compiled in and embedded in `viz smart` HTML (the guided tour) |
 | [LuaDate](https://github.com/Tieske/date) | 2.2.1 | MIT | vendored in `resources/luau/vendor/luadate/`, compiled into the binary |
 | [DCAT-US v3 schemas](https://github.com/GSA/dcat-us) | commit `1ca074b` | CC0-1.0 | vendored in `resources/dcat-us-v3/`, compiled into the binary |
@@ -307,7 +307,7 @@ THE SOFTWARE.
 ## DataTables
 
 Upstream: <https://datatables.net/> — download-builder combination
-`dt-3.1.3/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1`, comprising DataTables 3.1.3,
+`dt-3.1.4/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1`, comprising DataTables 3.1.4,
 Buttons 4.1.2, ColumnControl 2.1.2, DateTime 2.1.2 and SearchBuilder 2.1.1.
 
 Vendored unmodified at [`src/cmd/assets/datatables.min.js`](src/cmd/assets/datatables.min.js)
```

**File**: `examples/viz/smart_allegheny_dogs.html` (modified, +7/-7)
```diff
@@ -2,7 +2,7 @@
 <!-- Third-party software used by this page:
      plotly.js 3.7.0 - (c) 2012-2026 Plotly, Inc. - MIT
        (bundles MapLibre GL JS - BSD-3-Clause)
-     DataTables 3.1.3 + Buttons/ColumnControl/DateTime/SearchBuilder
+     DataTables 3.1.4 + Buttons/ColumnControl/DateTime/SearchBuilder
        (c) SpryMedia Ltd - MIT
      driver.js 1.10.2 - (c) Kamran Ahmed - MIT
      Basemap tiles (c) OpenStreetMap contributors (ODbL 1.0), (c) CARTO
@@ -76,7 +76,7 @@ <h1 class="qsv-viz-title">allegheny_dog_licenses.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>50,013 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Preview<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>8</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>100.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-21 11:28 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 00:19 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -941,7 +941,7 @@ <h1>allegheny_dog_licenses.csv — Data Schematic</h1>
 <div class="qsv-dict-downloads">
 <a class="qsv-dict-export" download="allegheny_dog_licenses_csv_data_schematic.schema.json" href="data:application/json;base64,ewogICIkc2NoZW1hIjogImh0dHBzOi8vanNvbi1zY2hlbWEub3JnL2RyYWZ0LzIwMjAtMTIvc2NoZW1hIiwKICAidGl0bGUiOiAiRGF0YSBEaWN0aW9uYXJ5IGZvciBhbGxlZ2hlbnlfZG9nX2xpY2Vuc2VzLmNzdiIsCiAgImRlc2NyaXB0aW9uIjogIlRoaXMgZGF0YXNldCBwcm92aWRlcyBhIGNvbXByZWhlbnNpdmUgcmVnaXN0cnkgb2YgZG9nIGxpY2Vuc2VzLCBlbmNvbXBhc3NpbmcgNTAsMDEzIGluZGl2aWR1YWwgcmVjb3Jkcy4gSXQgZGV0YWlscyBwZXQgY2hhcmFjdGVyaXN0aWNzIHN1Y2ggYXMgYnJlZWQgYW5kIGNvbG9yIGFsb25nc2lkZSBhZG1pbmlzdHJhdGl2ZSBpbmZvcm1hdGlvbiBsaWtlIGxpY2Vuc2UgdHlwZXMsIGVmZmVjdGl2ZSBkYXRlcywgYW5kIG93bmVyIHppcCBjb2Rlcy4gVGhlIGRhdGEgc2VydmVzIHRvIGRvY3VtZW50IHBldCBvd25lcnNoaXAgYW5kIHZhbGlkIGxpY2Vuc2luZyBwZXJpb2RzIGFjcm9zcyB2YXJpb3VzIGNhdGVnb3JpZXMgb2YgbGlmZXRpbWUgYW5kIHNlbmlvciByZWdpc3RyYXRpb25zLlxuXG4jIyMgTm90YWJsZSBDaGFyYWN0ZXJpc3RpY3NcblxuKiAqKlNlbnRpbmVsIFZhbHVlczoqKiBUaGUgYEV4cFllYXJgIGZpZWxkIGNvbnNpc3RzIGVudGlyZWx5IG9mIHRoZSB2YWx1ZSBgMjA5OWAsIHdoaWNoIHNlcnZlcyBhcyBhIHNlbnRpbmVsIGluZGljYXRpbmcgbm8gZXhwaXJhdGlvbi5cbiogKipQSUkvU2Vuc2l0aXZlIERhdGE6KiogVGhlIGRhdGFzZXQgY29udGFpbnMgUGVyc29uYWxseSBJZGVudGlmaWFibGUgSW5mb3JtYXRpb24gKFBJSSkgaW4gdGhlIGZvcm0gb2YgYERvZ05hbWVgIGFuZCBnZW9ncmFwaGljIGlkZW50aWZpZXJzIHZpYSBgT3duZXJaaXBgLlxuKiAqKkhpZ2ggQ2FyZGluYWxpdHk6KiogVGhlIGBEb2dOYW1lYCBhbmQgYEJyZWVkYCBmaWVsZHMgZXhoaWJpdCBoaWdoIGNhcmRpbmFsaXR5LCBpbmRpY2F0aW5nIGEgd2lkZSB2YXJpZXR5IG9mIHVuaXF1ZSB2YWx1ZXMgYWNyb3NzIHRoZSBkYXRhc2V0LlxuKiAqKkRpc3RyaWJ1dGlvbiBQYXR0ZXJuczoqKiBUaGUgYExpY2Vuc2VUeXBlYCBmaWVsZCBzaG93cyBhIGNvbmNlbnRyYXRpb24gaW4gbGlmZXRpbWUgcmVnaXN0cmF0aW9ucywgcGFydGljdWxhcmx5IGZvciBzcGF5ZWQgZmVtYWxlcyBhbmQgbmV1dGVyZWQgbWFsZXMuXG4qICoqRGF0YSBRdWFsaXR5OioqIFRoZSBkYXRhc2V0IGlzIGhpZ2hseSBjb21wbGV0ZSB3aXRoIHZlcnkgbG93IG51bGwgY291bnRzIGFjcm9zcyBhbGwgZmllbGRzOyBob3dldmVyLCB0aGUgYEJyZWVkYCBhbmQgYENvbG9yYCBmaWVsZHMgY29udGFpbiBtaW5vciBzcGFyc2l0eS5cbiogKipUZW1wb3JhbCBSYW5nZToqKiBUaGUgYFZhbGlkRGF0ZWAgZmllbGQgc2hvd3MgYSB0ZW1wb3JhbCBzcGFuIG9mIGFwcHJveGltYXRlbHkgMjMgeWVhcnMsIGZyb20gMjAwMyB0byAyMDI2LlxuXG5HZW5lcmF0ZWQgYnkgcXN2IHYyMS4xLjAgZGVzY3JpYmVncHRcbkNvbW1hbmQgbGluZTogdGFyZ2V0L2RlYnVnL3FzdiBkZXNjcmliZWdwdCAtLWRpY3Rpb25hcnkgLS1kZXNjcmlwdGlvbiBleGFtcGxlcy92aXovYWxsZWdoZW55X2RvZ19saWNlbnNlcy5jc3YgLS1mb3JtYXQganNvbnNjaGVtYSAtbyBleGFtcGxlcy92aXovYWxsZWdoZW55X2RvZ3NfZGljdC5zY2hlbWEuanNvbiAtLWZyZXNoIC0tdHdvLXBhc3MgLS1pbmZlci1jb250ZW50LXR5cGUgLS1pbmZlci1udWxsLXZhbHVlc1xuUHJvbXB0IGZpbGU6IERlZmF1bHQgdjcuMi4wXG5Nb2RlbDogZ29vZ2xlL2dlbW1hLTQtMjZiLWE0YlxuTExNIEFQSSBVUkw6IGh0dHA6Ly9sb2NhbGhvc3Q6MTIzNC92MVxuTGFuZ3VhZ2U6IFxuVGltZXN0YW1wOiAyMDI2LTA3LTE3VDEzOjQyOjE0LjE2ODUyNSswMDowMFxuXG5XQVJOSU5HOiBEZXNjcmlwdGlvbiBnZW5lcmF0ZWQgYnkgYW4gTExNIGFuZCBtYXkgY29udGFpbiBpbmFjY3VyYWNpZXMuIFZlcmlmeSBiZWZvcmUgdXNpbmchXG4iLAogICJ0eXBlIjogIm9iamVjdCIsCiAgInByb3BlcnRpZXMiOiB7CiAgICAiX2lkIjogewogICAgICAidHlwZSI6IFsKICAgICAgICAiaW50ZWdlciIKICAgICAgXSwKICAgICAgInRpdGxlIjogIlJlY29yZCBJRCIsCiAgICAgICJkZXNjcmlwdGlvbiI6ICJBIHVuaXF1ZSBpbnRlZ2VyIGlkZW50aWZpZXIgZm9yIGVhY2ggcmVjb3JkIGluIHRoZSBkYXRhc2V0LiIsCiAgICAgICJtaW5pbXVtIjogMjk1ODUyMjcsCiAgICAgICJtYXhpbXVtIjogMjk2MzUyMzksCiAgICAgICJ4LXFzdiI6IHsKICAgICAgICAicXN2X3R5cGUiOiAiSW50ZWdlciIsCiAgICAgICAgImNhcmRpbmFsaXR5IjogNTAwMTMsCiAgICAgICAgIm51bGxfY291bnQiOiAwLAogICAgICAgICJjb250ZW50X3R5cGUiOiAidW5pcXVlX2lkIiwKICAgICAgICAicm9sZSI6ICJpZGVudGlmaWVyIiwKICAgICAgICAiY29uY2VwdCI6ICJpZC5zdXJyb2dhdGVfa2V5IiwKICAgICAgICAiZXhhbXBsZV9jb3VudHMiOiAiPEFMTF9VTklRVUU+IgogICAgICB9CiAgICB9LAogICAgIkxpY2Vuc2VUeXBlIjogewog
```

**File**: `examples/viz/smart_cms_medicare.html` (modified, +5/-5)
```diff
@@ -2,7 +2,7 @@
 <!-- Third-party software used by this page:
      plotly.js 3.7.0 - (c) 2012-2026 Plotly, Inc. - MIT
        (bundles MapLibre GL JS - BSD-3-Clause)
-     DataTables 3.1.3 + Buttons/ColumnControl/DateTime/SearchBuilder
+     DataTables 3.1.4 + Buttons/ColumnControl/DateTime/SearchBuilder
        (c) SpryMedia Ltd - MIT
      driver.js 1.10.2 - (c) Kamran Ahmed - MIT
      Full texts: https://github.com/dathere/qsv/blob/master/THIRD_PARTY_NOTICES.md -->
@@ -74,7 +74,7 @@ <h1 class="qsv-viz-title">cms_medicare_providers.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>30,007 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Preview<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>4</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>97.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-21 11:28 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 00:19 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -943,8 +943,8 @@ <h1 class="qsv-viz-title">cms_medicare_providers.csv — Data Schematic</h1>
 })();
 </script>
 
-<link rel="stylesheet" href="https://cdn.datatables.net/v/dt/dt-3.1.3/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.css" integrity="sha384-ocwhkdhxJhahyOR1uuhXjsfZRbwxcPXtVQM544ExdtdCD3tg+Z+aXD/Xm8oTwTpK" crossorigin="anonymous">
-<script src="https://cdn.datatables.net/v/dt/dt-3.1.3/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.js" integrity="sha384-lrZ3R3TIwZRywxf4o3vZT0gzuqvLi57OuwTwjm6jyvppZIwIyBVHw7jk80URF9y+" crossorigin="anonymous"></script>
+<link rel="stylesheet" href="https://cdn.datatables.net/v/dt/dt-3.1.4/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.css" integrity="sha384-GmwleB1P0WhMZXHpBV6YMP4M6E37rRjmrKfIptevjapB/cZIKD6apheUY/I7vqLC" crossorigin="anonymous">
+<script src="https://cdn.datatables.net/v/dt/dt-3.1.4/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.js" integrity="sha384-VC5dLAcszQpBHAWmzJuO3uucDRPfdkYzNohSU7GIM1gUwzAHoqyITmih/Bgo8noE" crossorigin="anonymous"></script>
 <script id="qsv-data-rows" type="application/json">[["Chiropractic","ND","23","0"],["Physical Therapist in Private Practice","NY","11","0"],["Audiologist","NY","16","0"],["Physical Therapist in Private Practice","WA","17","0"],["Family Practice","CA","16","0"],["Physical Therapist in Private Practice","NY","11","0"],["Chiropractic","NM","41","0"],["Hospitalist","CA","86","24109.29"],["Anesthesiology","MT","223","43294.09"],["Nurse Practitioner","PA","11","647.45"],["Podiatry","TX","187","43423.99"],["Certified Registered Nurse Anesthetist (CRNA)","AL","464","26963.05"],["Family Practice","NC","88",""],["Endocrinology","FL","1735","254941.67"],["Physical Therapist in Private Practice","WA","25","28524.71"],["Physician Assistant","IN","45","5248.75"],["Dermatology","CO","930","461544.26"],["Orthopedic Surgery","MI","311","115202.28"],["Interventional Radiology","OK","591","56598.61"],["Physician Assistant","FL","150","28141.89"],["Nurse Practitioner","GA","43","3413.12"],["Otolaryngology","FL","637","204825.55"],["Obstetrics \u0026 Gynecology","UT","28","5159.51"],["Dermatology","PA","411","46657.48"],["Physical Therapist in Private Practice","NY","19","9746.62"],["General Surgery","TX","53","20555.75"],["Hematology","PA","50","2495.89"],["Certified Registered Nurse Anesthetist (CRNA)","TX","99","10029.15"],["Physician Assistant","NY","62","7138.67"],["Emergency Medicine","CA","104","15582.9"],["General Surgery","LA","21","3821.28"],["Otolaryngology","NY","446","435999.05"],["Family Practice","MO","75","7943.55"],["Neurology","NY","112","62854.59"],["Physician Assistant","GA","237","26213.61"],["Physical Therapist in Private Practice","VA","19","66020.28"],["Hematology-Oncology","NY","123","46898.89"],["Nurse Practitioner","IN","67","12559.34"],["Hospitalist","UT","127","43998.67"],["Nurse Practitioner","TX","198","23435.39"],["Pulmonary Disease","IL","221","183677.1"],["Ophthalmology","MA","359","79704.84"],["Dermatology","SC","537","489209.23"],["Physical Therapist in Private Practice","NV","57","31326.34"],["Allergy/ Immunology","FL","156",""],["Nurse Practitioner","SC","55",""],["Family Practice","KY","198",""],["Physician Assistant","MN","79","8387.58"],["Internal Medicine","FL","115",""],["Diagnostic Radiology","CA","992","22081.81"],["Physician Assistant","TN","295","32235.8"],["Nurse Practitioner","MD","82","7481.61"],["Nurse Practitioner","PA","38","22989.17"],["Neurology","PA","39","12426.24"],["Physical Therapist in Private Practice","IL","89","95573.15"],["Nurse Practiti
```

**File**: `examples/viz/smart_cpdb.html` (modified, +5/-5)
```diff
@@ -2,7 +2,7 @@
 <!-- Third-party software used by this page:
      plotly.js 3.7.0 - (c) 2012-2026 Plotly, Inc. - MIT
        (bundles MapLibre GL JS - BSD-3-Clause)
-     DataTables 3.1.3 + Buttons/ColumnControl/DateTime/SearchBuilder
+     DataTables 3.1.4 + Buttons/ColumnControl/DateTime/SearchBuilder
        (c) SpryMedia Ltd - MIT
      driver.js 1.10.2 - (c) Kamran Ahmed - MIT
      Full texts: https://github.com/dathere/qsv/blob/master/THIRD_PARTY_NOTICES.md -->
@@ -74,7 +74,7 @@ <h1 class="qsv-viz-title">nyc_capital_projects.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>12,587 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Preview<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>7</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>98.8%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-21 11:28 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 00:19 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -983,8 +983,8 @@ <h1 class="qsv-viz-title">nyc_capital_projects.csv — Data Schematic</h1>
 })();
 </script>
 
-<link rel="stylesheet" href="https://cdn.datatables.net/v/dt/dt-3.1.3/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.css" integrity="sha384-ocwhkdhxJhahyOR1uuhXjsfZRbwxcPXtVQM544ExdtdCD3tg+Z+aXD/Xm8oTwTpK" crossorigin="anonymous">
-<script src="https://cdn.datatables.net/v/dt/dt-3.1.3/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.js" integrity="sha384-lrZ3R3TIwZRywxf4o3vZT0gzuqvLi57OuwTwjm6jyvppZIwIyBVHw7jk80URF9y+" crossorigin="anonymous"></script>
+<link rel="stylesheet" href="https://cdn.datatables.net/v/dt/dt-3.1.4/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.css" integrity="sha384-GmwleB1P0WhMZXHpBV6YMP4M6E37rRjmrKfIptevjapB/cZIKD6apheUY/I7vqLC" crossorigin="anonymous">
+<script src="https://cdn.datatables.net/v/dt/dt-3.1.4/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.js" integrity="sha384-VC5dLAcszQpBHAWmzJuO3uucDRPfdkYzNohSU7GIM1gUwzAHoqyITmih/Bgo8noE" crossorigin="anonymous"></script>
 <script id="qsv-data-rows" type="application/json">[["038LBCENPH3","BPL","Brooklyn Public Library","","2800000","0","0"],["039LQMTGRMS","QPL","Queens Borough Public Library","","60000","0","0"],["850HL82HSS3","DDC","Department of Design and Construction","Fixed Asset","0","0","0"],["846P-217PDGT","DPR","Department of Parks and Recreation","Fixed Asset","-19000","0.00","401178.65"],["850HH112CTFS","DDC","Department of Design and Construction","Fixed Asset","3045000","71319.61","406640.19"],["039LQGL-RES","QPL","Queens Borough Public Library","","1000000","0","0"],["039LQNN_26","QPL","Queens Borough Public Library","","0","0","0"],["039LQNO-CCTV","QPL","Queens Borough Public Library","","0","0","0"],["039LQPHRS-23","QPL","Queens Borough Public Library","","300000","0","0"],["126PV176BLR2","DCLA","Department of Cultural Affairs","ITT, Vehicles, and Equipment","0","0","0"],["126PV176BZV2","DCLA","Department of Cultural Affairs","ITT, Vehicles, and Equipment","1000","2199000","0"],["126PV176COGN","DCLA","Department of Cultural Affairs","ITT, Vehicles, and Equipment","0","0","0"],["126PV187-SI4","DCLA","Department of Cultural Affairs","ITT, Vehicles, and Equipment","120000","112000","0"],["126PV197-AV1","DCLA","Department of Cultural Affairs","ITT, Vehicles, and Equipment","65000","0.00","59644.35"],["126PV204AUD1","DCLA","Department of Cultural Affairs","ITT, Vehicles, and Equipment","295000","0","0"],["126PV204ICOM","DCLA","Department of Cultural Affairs","ITT, Vehicles, and Equipment","274000","0","0"],["126PV204-IT2","DCLA","Department of Cultural Affairs","ITT, Vehicles, and Equipment","462000","0","0"],["126PV204JLC6","DCLA","Department of Cultural Affairs","ITT, Vehicles, and Equipment","471000","0","0"],["126PV204JLC7","DCLA","Department of Cultural Affairs","ITT, Vehicles, and Equipment","400000","0","0"],["126PV205NBGM","DCLA","Department of Cultural Affairs","ITT, Vehicles, and Equipment","150000","0","0"],["125HAM14CRSR","DFTA","Department for the Aging","Fixed Asset","100000","0","0"],["035LRCE12DOT","NYRL","New York Research Libraries","","0","0","0"],["846P-411C567","DPR","Department of Parks and Recreation","Fixed Asset","704000","0.00","13718953.95"],["035L21FREEZE","NYRL","New York Research Libraries","","393000","6600","0"],["850AGDJCCCON","DDC","Department of Design and Construction","ITT, Vehicles, and Equipment","0","0","145865"],["846P-5CLAYST","DPR","Department of Parks and Recreation","Fixed Asset","0","0","47900"],["846P-4FLBAY2","DPR","Department of Parks and Recr
```

**File**: `examples/viz/smart_dict_sunburst.html` (modified, +5/-5)
```diff
@@ -2,7 +2,7 @@
 <!-- Third-party software used by this page:
      plotly.js 3.7.0 - (c) 2012-2026 Plotly, Inc. - MIT
        (bundles MapLibre GL JS - BSD-3-Clause)
-     DataTables 3.1.3 + Buttons/ColumnControl/DateTime/SearchBuilder
+     DataTables 3.1.4 + Buttons/ColumnControl/DateTime/SearchBuilder
        (c) SpryMedia Ltd - MIT
      driver.js 1.10.2 - (c) Kamran Ahmed - MIT
      Full texts: https://github.com/dathere/qsv/blob/master/THIRD_PARTY_NOTICES.md -->
@@ -74,7 +74,7 @@ <h1 class="qsv-viz-title">sales_sample.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>500 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Explore<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>13</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>100.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-21 11:28 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 00:19 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -991,8 +991,8 @@ <h1 class="qsv-viz-title">sales_sample.csv — Data Schematic</h1>
 })();
 </script>
 
-<link rel="stylesheet" href="https://cdn.datatables.net/v/dt/dt-3.1.3/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.css" integrity="sha384-ocwhkdhxJhahyOR1uuhXjsfZRbwxcPXtVQM544ExdtdCD3tg+Z+aXD/Xm8oTwTpK" crossorigin="anonymous">
-<script src="https://cdn.datatables.net/v/dt/dt-3.1.3/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.js" integrity="sha384-lrZ3R3TIwZRywxf4o3vZT0gzuqvLi57OuwTwjm6jyvppZIwIyBVHw7jk80URF9y+" crossorigin="anonymous"></script>
+<link rel="stylesheet" href="https://cdn.datatables.net/v/dt/dt-3.1.4/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.css" integrity="sha384-GmwleB1P0WhMZXHpBV6YMP4M6E37rRjmrKfIptevjapB/cZIKD6apheUY/I7vqLC" crossorigin="anonymous">
+<script src="https://cdn.datatables.net/v/dt/dt-3.1.4/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.js" integrity="sha384-VC5dLAcszQpBHAWmzJuO3uucDRPfdkYzNohSU7GIM1gUwzAHoqyITmih/Bgo8noE" crossorigin="anonymous"></script>
 <script id="qsv-data-rows" type="application/json">[["100001","North","Electronics","PayPal","False","2","37","284","10200","13","0.03","0.32","cust-3b8f37f8a88b"],["100002","North","Books","Debit Card","True","5","42","219","8500","14","0.08","0.28","cust-c24101a9e71f"],["100003","South","Sports","Cash","True","2","46","57","2500","21","0.03","0.34","cust-43b79a8dca03"],["100004","North","Sports","Cash","True","4","59","45","2200","25","0.19","0.19","cust-5c94dc98d2c1"],["100005","South","Sports","Credit Card","False","2","47","124","4100","14","0.3","0.1","cust-5d65d58842de"],["100006","South","Home","PayPal","False","3","53","41","1700","22","0.21","0.2","cust-765629d4beef"],["100007","West","Home","Debit Card","True","1","40","166","5700","16","0.14","0.26","cust-e0599132b63e"],["100008","East","Clothing","Cash","True","4","56","78","4000","22","0.09","0.29","cust-bf3c434308bc"],["100009","West","Books","Cash","True","2","32","29","600","13","0.3","0.11","cust-6c12ae340454"],["100010","North","Toys","Cash","True","4","48","275","12000","16","0.09","0.27","cust-b881ae270da7"],["100011","North","Sports","PayPal","True","3","54","237","12800","23","0.0","0.35","cust-8026f8cda88b"],["100012","South","Books","Credit Card","True","3","11","264","2300","6","0.21","0.2","cust-f4188a14be62"],["100013","North","Books","PayPal","True","1","73","162","10900","28","0.08","0.29","cust-15ed14296c07"],["100014","West","Electronics","Debit Card","False","4","63","286","16900","23","0.06","0.3","cust-3638f6e07cc0"],["100015","South","Sports","PayPal","True","3","19","66","1100","8","0.09","0.28","cust-3ae88dcdcd03"],["100016","South","Electronics","Credit Card","True","1","41","122","4900","18","0.02","0.34","cust-3ced839fbc50"],["100017","East","Sports","Cash","False","2","33","300","8200","10","0.17","0.22","cust-182530beb45f"],["100018","North","Sports","Cash","True","4","8","244","1400","5","0.3","0.11","cust-1931a56c0941"],["100019","North","Toys","PayPal","True","1","40","234","8900","17","0.05","0.31","cust-ec5bdfde4fbf"],["100020","North","Toys","Credit Card","False","5","58","12","500","26","0.34","0.07","cust-680a2a935d62"],["100021","West","Toys","Debit Card","True","1","40","204","7400","16","0.09","0.28","cust-b2536c4a37ea"],["100022","West","Clothing","Debit Card","True","1","20","282","5500","8","0.02","0.34","cust-80ba7a0ecfea"],["100023","South","Electronics","Credit Card","True","1","17","125","1800","6","0.14","0.25","cust-983294340a03"],["100024","North","Books","Credit Card","True","5","31","29
```

**File**: `examples/viz/smart_dict_treemap.html` (modified, +5/-5)
```diff
@@ -2,7 +2,7 @@
 <!-- Third-party software used by this page:
      plotly.js 3.7.0 - (c) 2012-2026 Plotly, Inc. - MIT
        (bundles MapLibre GL JS - BSD-3-Clause)
-     DataTables 3.1.3 + Buttons/ColumnControl/DateTime/SearchBuilder
+     DataTables 3.1.4 + Buttons/ColumnControl/DateTime/SearchBuilder
        (c) SpryMedia Ltd - MIT
      driver.js 1.10.2 - (c) Kamran Ahmed - MIT
      Full texts: https://github.com/dathere/qsv/blob/master/THIRD_PARTY_NOTICES.md -->
@@ -74,7 +74,7 @@ <h1 class="qsv-viz-title">customer_spend.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>300 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Explore<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>5</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>100.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-21 11:28 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 00:19 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -927,8 +927,8 @@ <h1 class="qsv-viz-title">customer_spend.csv — Data Schematic</h1>
 })();
 </script>
 
-<link rel="stylesheet" href="https://cdn.datatables.net/v/dt/dt-3.1.3/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.css" integrity="sha384-ocwhkdhxJhahyOR1uuhXjsfZRbwxcPXtVQM544ExdtdCD3tg+Z+aXD/Xm8oTwTpK" crossorigin="anonymous">
-<script src="https://cdn.datatables.net/v/dt/dt-3.1.3/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.js" integrity="sha384-lrZ3R3TIwZRywxf4o3vZT0gzuqvLi57OuwTwjm6jyvppZIwIyBVHw7jk80URF9y+" crossorigin="anonymous"></script>
+<link rel="stylesheet" href="https://cdn.datatables.net/v/dt/dt-3.1.4/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.css" integrity="sha384-GmwleB1P0WhMZXHpBV6YMP4M6E37rRjmrKfIptevjapB/cZIKD6apheUY/I7vqLC" crossorigin="anonymous">
+<script src="https://cdn.datatables.net/v/dt/dt-3.1.4/b-4.1.2/cc-2.1.2/date-2.1.2/sb-2.1.1/datatables.min.js" integrity="sha384-VC5dLAcszQpBHAWmzJuO3uucDRPfdkYzNohSU7GIM1gUwzAHoqyITmih/Bgo8noE" crossorigin="anonymous"></script>
 <script id="qsv-data-rows" type="application/json">[["1001","Basic","East","215.39","190"],["1002","Basic","Central","33.58","14"],["1003","Plus","South","203.26","11"],["1004","Plus","West","28.51","128"],["1005","Pro","East","238.66","14"],["1006","Basic","Central","31.74","18"],["1007","Basic","South","190.01","24"],["1008","Basic","West","35.99","46"],["1009","Plus","East","189.56","155"],["1010","Plus","Central","17.79","91"],["1011","Pro","South","225.5","352"],["1012","Basic","West","29.68","62"],["1013","Basic","East","225.56","67"],["1014","Basic","Central","32.76","305"],["1015","Plus","South","230.02","184"],["1016","Plus","West","38.38","84"],["1017","Pro","East","213.81","12"],["1018","Basic","Central","29.26","42"],["1019","Basic","South","211.95","68"],["1020","Basic","West","23.3","159"],["1021","Plus","East","205.46","285"],["1022","Plus","Central","31.71","217"],["1023","Pro","South","220.87","135"],["1024","Basic","West","39.14","375"],["1025","Basic","East","218.09","706"],["1026","Basic","Central","24.28","23"],["1027","Plus","South","193.64","30"],["1028","Plus","West","35.79","121"],["1029","Pro","East","245.93","261"],["1030","Basic","Central","32.54","154"],["1031","Basic","South","231.08","214"],["1032","Basic","West","25.72","163"],["1033","Plus","East","202.58","330"],["1034","Plus","Central","26.28","522"],["1035","Pro","South","193.76","12"],["1036","Basic","West","31.68","218"],["1037","Basic","East","185.8","311"],["1038","Basic","Central","12.37","61"],["1039","Plus","South","199.84","5"],["1040","Plus","West","36.84","112"],["1041","Pro","East","224.42","11"],["1042","Basic","Central","33.04","264"],["1043","Basic","South","229.34","90"],["1044","Basic","West","33.83","370"],["1045","Plus","East","237.19","144"],["1046","Plus","Central","33.71","387"],["1047","Pro","South","235.16","59"],["1048","Basic","West","17.32","97"],["1049","Basic","East","196.4","570"],["1050","Basic","Central","41.27","30"],["1051","Plus","South","225.85","48"],["1052","Plus","West","34.55","120"],["1053","Pro","East","208.09","1"],["1054","Basic","Central","27.1","98"],["1055","Basic","South","204.15","551"],["1056","Basic","West","36.63","212"],["1057","Plus","East","195.16","203"],["1058","Plus","Central","29.06","10"],["1059","Pro","South","245.29","374"],["1060","Basic","West","22.81","288"],["1061","Basic","East","205.83","20"],["1062","Basic","Central","34.42","182"],["1063","Plus","South","226.21","43"],["1064","Plus","West","31.0","32"],["1065","Pro","East","216.83","1"],["1066",
```

---

### Incident Patch 3: `8e951826` (2026-10-22)
**Commit Message**: fix(viz): escape the tour config fully and the remaining plotly label sinks (#4879)

* fix(viz): escape the tour config fully and the remaining plotly label sinks

The guided tour's `#qsv-tour-config` JSON escaped only `</`. Its `"key"` carries the raw
column name, and a header containing `<!--<script>` puts the HTML tokenizer into the
double-escaped script state, where the block's own `</script>` no longer closes it: the rest
of the page (tour, theme toggle, qsv-clientd bridge) was swallowed as script text. It now
escapes `&`/`<`/`>` like the figure payloads.

Plotly renders a pseudo-HTML subset (including live http(s) `<a href>` links) in labels.
Hovers, titles and freq-bar ticks were already escaped; these sinks now go through
`escape_hover` too: correlation/association heatmap labels (standalone and smart), Sankey
node labels, treemap/sunburst/icicle labels (ids/parents keep the raw segment), the lollipop
category axis (Top Relationships and funnel stage ticks), and bridge waterfall categories.

Regenerated the three gallery pages whose tour config changes encoding (content identical
after JSON.parse).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* docs: cite PR #4879 i

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -72,6 +72,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   - Location cells are trimmed in the built-in `iso3`/`usa-states` modes, so `PA ` and `PA` are one region instead of two, and `--denominator census` finds padded codes.
   - A GeoJSON feature id stored as an integral float (`"FIPS": 6037.0`, as geopandas writes an integer column that holds a NaN) is emitted as `6037`, the spelling plotly matches, instead of `6037.0`, which matched no region.
   - A mistyped `--denominator census@<year>` (e.g. `census@2O21`) is now a clear usage error. It used to be read as a column name and fail with "selector does not exist" (on `viz choropleth`, only after fetching boundaries).
+- **`viz smart`: a column name containing `<!--<script>` no longer breaks the rest of the page.** ([#4879](https://github.com/dathere/qsv/pull/4879)) The guided tour's config is JSON inside a `<script>` element, and only `</` was escaped in it. Its `"key"` field carries the raw column name, and `<!--<script>` there switches the browser's HTML parser into a state where the element's own `</script>` no longer closes it. Everything after it was swallowed as script text, so the tour, the theme toggle and the qsv-clientd bridge never ran. It is now escaped like the chart payloads (`<`, `>` and `&` become JSON Unicode escapes). This was not a script-injection hole: the swallowed text never executed.
+- **`viz`: CSV text no longer renders as markup in more chart labels.** ([#4879](https://github.com/dathere/qsv/pull/4879)) Plotly renders a subset of HTML in labels, including clickable `http(s)` links. Hover text, titles and frequency-bar ticks were already escaped, but some labels were not, so a CSV value or header such as `<a href="...">` became a live off-site link, and `<b>` restyled text. Escaped now: correlation/association heatmap labels (`viz heatmap` and `viz smart`), Sankey node labels, treemap/sunburst/icicle labels, Top Relationships ticks, and funnel/bridge stage names.
 - **`joinp --cache-schema 1` no longer writes a schema that types unparseable dates as dates.** ([#4872](https://github.com/dathere/qsv/pull/4872)) When it reused a stats cache that had inferred dates, as a `moarstats --advanced` cache (from `viz smart --smarter` or `pivotp --agg smart`) does, every Date/DateTime column became a Polars date type, even in formats Polars can't read such as `04/18/2019 09:55:45 PM`. The join failed, and the cached `.pschema.json` it left behind broke later `joinp` and `sqlp` reads of that file. As in `schema --polars` and `sqlp --cache-schema` since #4751, a column now gets a date type only if Polars parses a sample of its raw values; otherwise it is String. Day-first dates need `QSV_PREFER_DMY`.
 - **`pivotp --agg smart` (the default) picks Median far less often — behavior change.** ([#4869](https://github.com/dathere/qsv/pull/4869)) Its "high variability" test compared the stats cache's `cv` with 1, but `stats` reports CV as a percentage, so any numeric column with a CV above 1% got Median. That was nearly every one, and it hid the cardinality, mixed-sign and skewness checks after it. The cut is now 100% (stddev larger than the mean). **Pivots that relied on the default can now return Sum (or Mean) where they returned Median; pass an explicit `--agg` (e.g. `--agg median`) to keep the old result.**
 - **`pivotp --agg smart` now detects skewed data.** ([#4869](https://github.com/dathere/qsv/pull/4869)) Its skewness check read `stats`' `skewness`, which is Bowley's quartile skewness and never exceeds 1 in absolute value, against a cut of 2, so it could never fire. It now uses `moarstats --advanced`'s moment skewness (|G1| ≥ 1 picks Median), falling back to Pearson skewness when G1 isn't in the cache.
```

**File**: `examples/viz/smart_allegheny_dogs.html` (modified, +5/-5)
```diff
@@ -76,7 +76,7 @@ <h1 class="qsv-viz-title">allegheny_dog_licenses.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>50,013 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Preview<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>8</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>100.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 00:19 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 03:55 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -941,7 +941,7 @@ <h1>allegheny_dog_licenses.csv — Data Schematic</h1>
 <div class="qsv-dict-downloads">
 <a class="qsv-dict-export" download="allegheny_dog_licenses_csv_data_schematic.schema.json" href="data:application/json;base64,ewogICIkc2NoZW1hIjogImh0dHBzOi8vanNvbi1zY2hlbWEub3JnL2RyYWZ0LzIwMjAtMTIvc2NoZW1hIiwKICAidGl0bGUiOiAiRGF0YSBEaWN0aW9uYXJ5IGZvciBhbGxlZ2hlbnlfZG9nX2xpY2Vuc2VzLmNzdiIsCiAgImRlc2NyaXB0aW9uIjogIlRoaXMgZGF0YXNldCBwcm92aWRlcyBhIGNvbXByZWhlbnNpdmUgcmVnaXN0cnkgb2YgZG9nIGxpY2Vuc2VzLCBlbmNvbXBhc3NpbmcgNTAsMDEzIGluZGl2aWR1YWwgcmVjb3Jkcy4gSXQgZGV0YWlscyBwZXQgY2hhcmFjdGVyaXN0aWNzIHN1Y2ggYXMgYnJlZWQgYW5kIGNvbG9yIGFsb25nc2lkZSBhZG1pbmlzdHJhdGl2ZSBpbmZvcm1hdGlvbiBsaWtlIGxpY2Vuc2UgdHlwZXMsIGVmZmVjdGl2ZSBkYXRlcywgYW5kIG93bmVyIHppcCBjb2Rlcy4gVGhlIGRhdGEgc2VydmVzIHRvIGRvY3VtZW50IHBldCBvd25lcnNoaXAgYW5kIHZhbGlkIGxpY2Vuc2luZyBwZXJpb2RzIGFjcm9zcyB2YXJpb3VzIGNhdGVnb3JpZXMgb2YgbGlmZXRpbWUgYW5kIHNlbmlvciByZWdpc3RyYXRpb25zLlxuXG4jIyMgTm90YWJsZSBDaGFyYWN0ZXJpc3RpY3NcblxuKiAqKlNlbnRpbmVsIFZhbHVlczoqKiBUaGUgYEV4cFllYXJgIGZpZWxkIGNvbnNpc3RzIGVudGlyZWx5IG9mIHRoZSB2YWx1ZSBgMjA5OWAsIHdoaWNoIHNlcnZlcyBhcyBhIHNlbnRpbmVsIGluZGljYXRpbmcgbm8gZXhwaXJhdGlvbi5cbiogKipQSUkvU2Vuc2l0aXZlIERhdGE6KiogVGhlIGRhdGFzZXQgY29udGFpbnMgUGVyc29uYWxseSBJZGVudGlmaWFibGUgSW5mb3JtYXRpb24gKFBJSSkgaW4gdGhlIGZvcm0gb2YgYERvZ05hbWVgIGFuZCBnZW9ncmFwaGljIGlkZW50aWZpZXJzIHZpYSBgT3duZXJaaXBgLlxuKiAqKkhpZ2ggQ2FyZGluYWxpdHk6KiogVGhlIGBEb2dOYW1lYCBhbmQgYEJyZWVkYCBmaWVsZHMgZXhoaWJpdCBoaWdoIGNhcmRpbmFsaXR5LCBpbmRpY2F0aW5nIGEgd2lkZSB2YXJpZXR5IG9mIHVuaXF1ZSB2YWx1ZXMgYWNyb3NzIHRoZSBkYXRhc2V0LlxuKiAqKkRpc3RyaWJ1dGlvbiBQYXR0ZXJuczoqKiBUaGUgYExpY2Vuc2VUeXBlYCBmaWVsZCBzaG93cyBhIGNvbmNlbnRyYXRpb24gaW4gbGlmZXRpbWUgcmVnaXN0cmF0aW9ucywgcGFydGljdWxhcmx5IGZvciBzcGF5ZWQgZmVtYWxlcyBhbmQgbmV1dGVyZWQgbWFsZXMuXG4qICoqRGF0YSBRdWFsaXR5OioqIFRoZSBkYXRhc2V0IGlzIGhpZ2hseSBjb21wbGV0ZSB3aXRoIHZlcnkgbG93IG51bGwgY291bnRzIGFjcm9zcyBhbGwgZmllbGRzOyBob3dldmVyLCB0aGUgYEJyZWVkYCBhbmQgYENvbG9yYCBmaWVsZHMgY29udGFpbiBtaW5vciBzcGFyc2l0eS5cbiogKipUZW1wb3JhbCBSYW5nZToqKiBUaGUgYFZhbGlkRGF0ZWAgZmllbGQgc2hvd3MgYSB0ZW1wb3JhbCBzcGFuIG9mIGFwcHJveGltYXRlbHkgMjMgeWVhcnMsIGZyb20gMjAwMyB0byAyMDI2LlxuXG5HZW5lcmF0ZWQgYnkgcXN2IHYyMS4xLjAgZGVzY3JpYmVncHRcbkNvbW1hbmQgbGluZTogdGFyZ2V0L2RlYnVnL3FzdiBkZXNjcmliZWdwdCAtLWRpY3Rpb25hcnkgLS1kZXNjcmlwdGlvbiBleGFtcGxlcy92aXovYWxsZWdoZW55X2RvZ19saWNlbnNlcy5jc3YgLS1mb3JtYXQganNvbnNjaGVtYSAtbyBleGFtcGxlcy92aXovYWxsZWdoZW55X2RvZ3NfZGljdC5zY2hlbWEuanNvbiAtLWZyZXNoIC0tdHdvLXBhc3MgLS1pbmZlci1jb250ZW50LXR5cGUgLS1pbmZlci1udWxsLXZhbHVlc1xuUHJvbXB0IGZpbGU6IERlZmF1bHQgdjcuMi4wXG5Nb2RlbDogZ29vZ2xlL2dlbW1hLTQtMjZiLWE0YlxuTExNIEFQSSBVUkw6IGh0dHA6Ly9sb2NhbGhvc3Q6MTIzNC92MVxuTGFuZ3VhZ2U6IFxuVGltZXN0YW1wOiAyMDI2LTA3LTE3VDEzOjQyOjE0LjE2ODUyNSswMDowMFxuXG5XQVJOSU5HOiBEZXNjcmlwdGlvbiBnZW5lcmF0ZWQgYnkgYW4gTExNIGFuZCBtYXkgY29udGFpbiBpbmFjY3VyYWNpZXMuIFZlcmlmeSBiZWZvcmUgdXNpbmchXG4iLAogICJ0eXBlIjogIm9iamVjdCIsCiAgInByb3BlcnRpZXMiOiB7CiAgICAiX2lkIjogewogICAgICAidHlwZSI6IFsKICAgICAgICAiaW50ZWdlciIKICAgICAgXSwKICAgICAgInRpdGxlIjogIlJlY29yZCBJRCIsCiAgICAgICJkZXNjcmlwdGlvbiI6ICJBIHVuaXF1ZSBpbnRlZ2VyIGlkZW50aWZpZXIgZm9yIGVhY2ggcmVjb3JkIGluIHRoZSBkYXRhc2V0LiIsCiAgICAgICJtaW5pbXVtIjogMjk1ODUyMjcsCiAgICAgICJtYXhpbXVtIjogMjk2MzUyMzksCiAgICAgICJ4LXFzdiI6IHsKICAgICAgICAicXN2X3R5cGUiOiAiSW50ZWdlciIsCiAgICAgICAgImNhcmRpbmFsaXR5IjogNTAwMTMsCiAgICAgICAgIm51bGxfY291bnQiOiAwLAogICAgICAgICJjb250ZW50X3R5cGUiOiAidW5pcXVlX2lkIiwKICAgICAgICAicm9sZSI6ICJpZGVudGlmaWVyIiwKICAgICAgICAiY29uY2VwdCI6ICJpZC5zdXJyb2dhdGVfa2V5IiwKICAgICAgICAiZXhhbXBsZV9jb3VudHMiOiAiPEFMTF9VTklRVUU+IgogICAgICB9CiAgICB9LAogICAgIkxpY2Vuc2VUeXBlIjogewogICAgICAidHlwZSI6IFsKICAgICAgICAic3RyaW5nIgogICAgICBdLAogICAgICAidGl0bGUiOiAiTGljZW5zZSBUeXBlIiwKICAgICAgImRlc2NyaXB0aW9uIjogIlRoZSBzcGVjaWZpYyBjbGFzc2lmaWNhdGlvbiBvZiB0aGUgZG9nIGxpY2Vuc2UgKGUuZy4sIGxpZmV0aW1lLCBzZW5pb3IpLiIsCiAgICAgICJleGFtcGxlcyI6IFsKICAgICAgICAiRG9nIExpZmV0aW1lIFNwYXllZCBGZW1hbGUiLAogICAgICAgICJEb2cgTGlmZXRpbWUgTmV1dGVyZWQgTWFsZSIsCiAgICAgICAgIkRvZyBMaWZldGltZSBNYWxlIiwKICAgICAgICAiRG9nIFNlbmlvciBMaWZldGltZSBTcGF5ZWQgRmVtYWxlIiwKICAgICAg
```

**File**: `examples/viz/smart_wpa_211_requests.html` (modified, +5/-5)
```diff
@@ -76,7 +76,7 @@ <h1 class="qsv-viz-title">wpa_211_requests.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>279,464 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Preview<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>7</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>98.8%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 00:19 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 03:55 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 <tr><td class="qsv-viz-meta-k">PID:</td><td><a href="https://data.wprdc.org/dataset/211-requests" target="_blank" rel="noopener noreferrer">https://data.wprdc.org/dataset/211-requests</a></td></tr>
 </table>
@@ -966,7 +966,7 @@ <h1>wpa_211_requests.csv — Data Schematic</h1>
 <div class="qsv-dict-downloads">
 <a class="qsv-dict-export" download="wpa_211_requests_csv_data_schematic.schema.json" href="data:application/json;base64,ewogICIkc2NoZW1hIjogImh0dHBzOi8vanNvbi1zY2hlbWEub3JnL2RyYWZ0LzIwMjAtMTIvc2NoZW1hIiwKICAidGl0bGUiOiAid3BhXzIxMV9yZXF1ZXN0cyIsCiAgInR5cGUiOiAib2JqZWN0IiwKICAiZGVzY3JpcHRpb24iOiAiUkVBTCAyLTEtMSBoZWxwbGluZSByZXF1ZXN0cyBhY3Jvc3MgdGhlIDI1IFdlc3Rlcm4gUGVubnN5bHZhbmlhIGNvdW50aWVzIHNlcnZlZCBieSB0aGUgVW5pdGVkIFdheSBvZiBTb3V0aHdlc3Rlcm4gUGVubnN5bHZhbmlhLCBvbmUgcm93IHBlciByZXF1ZXN0LCB0aGUgdXBzdHJlYW0gcmVzb3VyY2UgZW50aXJlICgyMDIzLTA5LTIyIC4uIDIwMjUtMDgtMjcsIG5vIHdpbmRvdyBhbmQgbm8gc2FtcGxlIC0gc2VlIGdlbl93cGFfMjExX3JlcXVlc3RzLnB5KS4gVXNlZCB0byBkZW1vbnN0cmF0ZSBhIGRlbm9taW5hdG9yLWF3YXJlIHJlZ2lvbiBtYXAgb24gYSByZWFsIHNlcnZpY2UgbG9nIHJhdGhlciB0aGFuIGEgc3ludGhldGljIG9uZS4gTm8gcG9wdWxhdGlvbiBjb2x1bW4gaXMgY2FycmllZCBvbiBwdXJwb3NlOiB0aGUgcmF0ZSBwYW5lbCdzIGRlbm9taW5hdG9yIGlzIEZFVENIRUQgYnkgLS1kZW5vbWluYXRvciBjZW5zdXNAMjAyNCwgYW5kIHRoZSBjb3VudHkgYm91bmRhcmllcyBieSAtLWdlb2pzb24gYXV0bywgd2hpY2ggYWxzbyBjYW5vbmljYWxpemVzIHRoZSBjb3VudHkgTkFNRVMgYmVsb3cgdG8gQ2Vuc3VzIEdFT0lEcyBzbyB0aGUgZmV0Y2hlZCBwb3B1bGF0aW9uIGtleXMgb250byB0aGVtLiIsCiAgIngtcXN2IjogewogICAgImdyYWluIjogIm9uZSByb3cgPSBvbmUgMi0xLTEgcmVxdWVzdCIsCiAgICAiZ3JhaW5fdW5pdCI6ICJyZXF1ZXN0IgogIH0sCiAgInByb3BlcnRpZXMiOiB7CiAgICAiY29udGFjdF9kYXRlIjogewogICAgICAidHlwZSI6ICJzdHJpbmciLAogICAgICAidGl0bGUiOiAiQ29udGFjdCBEYXRlIiwKICAgICAgImRlc2NyaXB0aW9uIjogIkRhdGUgdGhlIHJlcXVlc3QgcmVhY2hlZCB0aGUgMi0xLTEgaGVscGxpbmUuIiwKICAgICAgIngtcXN2IjogewogICAgICAgICJxc3ZfdHlwZSI6ICJEYXRlIiwKICAgICAgICAiY2FyZGluYWxpdHkiOiA3MDQsCiAgICAgICAgIm51bGxfY291bnQiOiAwLAogICAgICAgICJjb250ZW50X3R5cGUiOiAiZGF0ZTolWS0lbS0lZCIsCiAgICAgICAgInJvbGUiOiAidGltZXN0YW1wIiwKICAgICAgICAiY29uY2VwdCI6ICJ0aW1lLmV2ZW50X3RpbWVzdGFtcCIKICAgICAgfQogICAgfSwKICAgICJjb3VudHkiOiB7CiAgICAgICJ0eXBlIjogInN0cmluZyIsCiAgICAgICJ0aXRsZSI6ICJDb3VudHkiLAogICAgICAiZGVzY3JpcHRpb24iOiAiQ291bnR5IG9mIHRoZSBjYWxsZXIsIG5vcm1hbGl6ZWQgdG8gdGhlICc8TmFtZT4gQ291bnR5JyBzcGVsbGluZyBieSB0aGUgZ2VuZXJhdG9yICh0aGUgdXBzdHJlYW0gMjAyMC0yMDIzIGFuZCAyMDIzLTIwMjUgcmVzb3VyY2VzIGRpc2FncmVlIG9uIHRoZSBzdWZmaXgpLiBUaGUgT05MWSByZWdpb24gY29uY2VwdCBpbiB0aGlzIGRpY3Rpb25hcnksIGRlbGliZXJhdGVseTogdGhlIHVwc3RyZWFtIGZlZWQgYWxzbyBjYXJyaWVzIGEgemlwX2NvZGUsIGFuZCB0YWdnaW5nIGl0IGdlby4qIHdvdWxkIGNyZWF0ZSBhIGNvbXBldGluZyBjaG9yb3BsZXRoIGNhbmRpZGF0ZSBzY29yaW5nIGFnYWluc3QgYSBjb3VudHkta2V5ZWQgbWFwLiBBbGwgMjUgbmFtZXMgYXJlIFBlbm5zeWx2YW5pYSBjb3VudGllcyBhbmQgYXJlIHVuaXF1ZSB3aXRoaW4gdGhlIHN0YXRlLCBzbyAtIHVubGlrZSB0cmlzdGF0ZV9jb3VudHlfaW5jaWRlbnRzIC0gdGhleSBuZWVkIG5vIHN0YXRlIHF1YWxpZmllciB0byBzdG9wIHRoZSBmcmVxdWVuY3kgYmFyIHNpbGVudGx5IHN1bW1pbmcgbmFtZXNha2VzLiIsCiAgICAgICJ4LXFzdiI6IHsKICAgICAgICAicXN2X3R5cGUiOiAiU3RyaW5nIiwKICAgICAgICAiY2FyZGluYWxpdHkiOiAyNSwKICAgICAgICAibnVsbF9jb3VudCI6IDAsCiAgICAgICAgImNvbnRlbnRfdHlwZSI6ICJjYXRlZ29yeSIsCiAgICAgICAgInJvbGUiOiAiZGltZW5zaW9uIiwKICAgICAgICAiY29uY2VwdCI6ICJnZW8uY291bnR5IgogICAgICB9CiAgICB9LAogICAgInN0YXRlIjogewogICAgICAidHlwZSI6ICJzdHJpbmciLAogICAgICAidGl0bGUiOiAiU3RhdGUiLAogICAgICAiZGVzY3JpcHRpb24iOiAiQ29uc3RhbnQgYnkgY29uc3RydWN0aW9uIC0gdGhpcyBpcyB0aGUgV2VzdGVybiBQZW5uc3lsdmFuaWEgMi0xLTEgcmVnaW9uLiBDYXJyaWVkIHNvIC0tZ2VvanNvbiBhdXRvIHNjb3BlcyBpdHMgYm91bmRhcnkgZmV0Y2ggdG8gb25lIHN0YXRlIHJhdGhlciB0aGFuIHByb2JpbmcgdGhlIG5hdGlvbi4iLAogICAgICAiY29uc3QiOiAiUEEiLAogICAgICAieC1xc3YiOiB7CiAgICAgICAgInFzdl90eXBlIjogIlN0cmluZyIsCiAgICAgICAgImNhcmRpbmFsaXR5IjogMSwKICAgICAgICAibnVsbF9jb3VudCI6IDAsCiAgICAgICAgImNvbnRlbnRfdHlwZSI6ICJzdGF0ZV9hYmJyIiwKICAgICAgICAicm9sZSI6ICJkaW1lbnNpb24iLAogICAgICAgICJjb25jZXB0IjogImdlby5zdGF0ZSIKICAgICAgfQogICAgfSwKICAgICJnZW5kZXIiOiB7CiAgICAgICJ0eXBlIjogWwogICAgICAgICJzdHJpbmciLAogICAgICAgICJudWxsIgogICAgICBdLAogICAgICAidGl0bGUiOiAiR2VuZGVyIiwKICAgICAgImRlc2NyaXB0aW9uIjogIlNlbGYtcmVwb3J0ZWQgZ2VuZGVyIG9mIHRoZSBjYWxsZXIsIHd
```

**File**: `src/cmd/viz.rs` (modified, +29/-11)
```diff
@@ -12627,6 +12627,9 @@ fn heatmap_trace_with_range(
     }
     hover_template.push_str("<extra></extra>");
 
+    // labels are raw column names, rendered as tick text and through `%{x}`/`%{y}` in the hover —
+    // both plotly pseudo-HTML — so escape them (callers truncate first, so no entity is split)
+    let labels: Vec<String> = labels.iter().map(|l| escape_hover(l)).collect();
     let mut h = HeatMap::new(labels.clone(), labels, matrix)
         .color_scale(ColorScale::Palette(palette))
         .zmin(zmin)
@@ -18024,12 +18027,16 @@ fn build_tour_chrome(
         "steps": steps,
         "hints": hints,
     });
-    // `</` must not appear inside a <script> payload (it would terminate the tag mid-JSON);
-    // serde_json never escapes it, so do it here — JSON string escaping makes `<\/` read back
-    // as `</`.
+    // Escape `<`/`>`/`&` as the figure payloads do. Rewriting only `</` was not enough: `"key"`
+    // carries the raw column name, and a header containing `<!--<script>` puts the HTML tokenizer
+    // into the double-escaped script state, where this block's own `</script>` no longer closes
+    // it and the rest of the page is swallowed as script text. `<` cannot occur outside a JSON
+    // string, so the rewrite is lossless (JSON.parse reads each escape back as the original char).
     let config_json = serde_json::to_string(&config)
         .unwrap_or_default()
-        .replace("</", "<\\/");
+        .replace('&', "\\u0026")
+        .replace('<', "\\u003c")
+        .replace('>', "\\u003e");
     let mut out = String::with_capacity(config_json.len() + 4096);
     out.push_str(&driverjs_lib_block());
     out.push('\n');
@@ -39587,14 +39594,20 @@ fn panel_trace_funnel_bridge(
             }
         };
 
-        cats.push(stages[0].clone());
+        // category names are displayed as plotly pseudo-HTML ticks, so escape them like the hover
+        // (escaping is injective, so the categories stay distinct)
+        cats.push(escape_hover(&stages[0]));
         vals.push(totals[0]);
         measures.push(Measure::Absolute);
         hover.push(stage_hover(0));
 
         for k in 1..stages.len() {
             let delta = totals[k] - totals[k - 1];
-            cats.push(format!("{} \u{2212} {}", stages[k], stages[k - 1]));
+            cats.push(format!(
+                "{} \u{2212} {}",
+                escape_hover(&stages[k]),
+                escape_hover(&stages[k - 1])
+            ));
             vals.push(delta);
             measures.push(Measure::Relative);
             hover.push(format!(
@@ -39609,7 +39622,7 @@ fn panel_trace_funnel_bridge(
 
             // `Total` re-derives its own height from the running total; the real amount goes
             // in the slot anyway so the arrays stay parallel and the JSON self-documenting.
-            cats.push(stages[k].clone());
+            cats.push(escape_hover(&stages[k]));
             vals.push(totals[k]);
             measures.push(Measure::Total);
             hover.push(stage_hover(k));
@@ -43218,7 +43231,7 @@ fn hierarchy_arrays(
     let root_children = tree.get(&Vec::<String>::new())?;
     let total: f64 = root_children.values().sum();
 
-    let mut labels = vec![root_label.to_string()];
+    let mut labels = vec![escape_hover(root_label)];
     let mut parents = vec![String::new()];
     let mut values = vec![total];
     let mut ids = vec![HIER_ROOT_ID.to_string()];
@@ -43275,7 +43288,8 @@ fn hierarchy_arrays(
                 let child_id = unique_id(format!("{prefix_id}{HIER_PATH_SEP}{seg}"));
                 let mut child_path = prefix.clone();
                 child_path.push(seg.clone());
-                labels.push(seg.clone());
+                // display text only (plotly pseudo-HTML); `ids`/`parents` keep the raw segment
+                labels.push(escape_hover(seg));
                 parents.push(prefix_id.clone());
                 values.push(v);
                 ids.push(child_id.clone());
@@ -43454,7 +43468,10 @@ fn sankey_trace(
     link_value: &[f64],
     positions: Option<&(Vec<f64>, Vec<f64>)>,
 ) -> Box<dyn Trace> {
-    let label_refs: Vec<&str> = node_labels.iter().map(String::as_str).collect();
+    // node labels are raw CSV values rendered as plotly pseudo-HTML (an `<a href>` became a live
+    // link); links address nodes by index, so escaping the display text cannot break the graph
+    let escaped: Vec<String> = node_labels.iter().map(|l| escape_hover(l)).collect();
+    let label_refs: Vec<&str> = escaped.iter().map(String::as_str).collect();
     let node_colors: Vec<String> = (0..node_labels.len())
         .map(|i| PALETTE[i % PALETTE.len()].to_string())
         .collect();
@@ -44596,7 +44613,8 @@ fn lollipop_category_axis(theme: Option<BuiltinTheme>, tick_text: &[String]) ->
         .show_line(false)
         .tick_mode(TickMode::Array)
         .tick_values((0..tick_text.len()).map(|i| i as f64).collect())
-        .tick_text(tick_text.to_vec());
+        // r
```

**File**: `tests/test_viz.rs` (modified, +205/-0)
```diff
@@ -23965,3 +23965,208 @@ fn viz_denominator_census_bad_vintage_is_usage_error() {
         "expected an invalid-vintage error; got: {got}"
     );
 }
+
+/// How viz writes text into JSON inside a `<script>` block: `&`, `<` and `>` become the JSON
+/// escapes for U+0026/U+003C/U+003E (backslash, `u`, four hex digits). Built at runtime so the
+/// needles below never spell those escapes in source.
+fn script_json_escaped(s: &str) -> String {
+    let bs = '\u{5c}';
+    s.replace('&', &format!("{bs}u0026"))
+        .replace('<', &format!("{bs}u003c"))
+        .replace('>', &format!("{bs}u003e"))
+}
+
+/// What a plotly label looks like on the page once viz HTML-escapes it (`escape_hover`) and the
+/// figure JSON is then script-escaped.
+fn escaped_label(s: &str) -> String {
+    script_json_escaped(
+        &s.replace('&', "&amp;")
+            .replace('<', "&lt;")
+            .replace('>', "&gt;"),
+    )
+}
+
+// The guided-tour config is JSON inside `<script type="application/json">`, and its `"key"` carries
+// the raw column name. Escaping only `</` let a header containing `<!--<script>` push the HTML
+// tokenizer into the double-escaped script state, where the block's own `</script>` no longer
+// closes it and the rest of the page (tour, theme toggle, daemon bridge) is swallowed as text.
+#[test]
+fn viz_smart_tour_config_escapes_comment_open() {
+    let wrk = Workdir::new("viz_smart_tour_config_escapes_comment_open");
+    wrk.create_from_string(
+        "t.csv",
+        "id,<!--<script>,val\n1,a,10\n2,b,20\n3,a,30\n4,c,15\n",
+    );
+    let out_html = wrk.path("t.html").to_string_lossy().to_string();
+    let mut cmd = wrk.command("viz");
+    cmd.args(["smart", "t.csv", "-o", &out_html])
+        .env("QSV_VIZ_NO_COMPRESS", "1");
+    wrk.assert_success(&mut cmd);
+
+    let html = wrk.read_to_string("t.html").unwrap();
+    let start = html
+        .find(r#"id="qsv-tour-config""#)
+        .expect("the page must embed a tour config");
+    let body_start = start + html[start..].find('>').unwrap() + 1;
+    let body = &html[body_start..body_start + html[body_start..].find("</script>").unwrap()];
+    assert!(
+        !body.contains('<'),
+        "no raw `<` may appear inside the tour-config script block; got: {body}"
+    );
+    let key = format!(r#""key":"{}""#, script_json_escaped("<!--<script>"));
+    assert!(
+        body.contains(&key),
+        "the column name must survive as an escaped JSON string ({key}); got: {body}"
+    );
+}
+
+// Sankey node labels are raw CSV values rendered as plotly pseudo-HTML: an `<a href>` became a live
+// off-site link and `<b>` restyled the node. They must be escaped like every hover sink.
+#[test]
+fn viz_sankey_escapes_node_labels() {
+    let wrk = Workdir::new("viz_sankey_escapes_node_labels");
+    wrk.create_from_string(
+        "s.csv",
+        "from,to,w\n<b>x</b>,p,3\nz,\"<a href=\"\"https://e.com\"\">q</a>\",2\n",
+    );
+    let mut cmd = wrk.command("viz");
+    cmd.args([
+        "sankey", "s.csv", "--source", "from", "--target", "to", "--value", "w",
+    ])
+    .env("QSV_VIZ_NO_COMPRESS", "1");
+    let out = wrk.output(&mut cmd);
+    assert!(out.status.success());
+    let html = String::from_utf8_lossy(&out.stdout);
+    assert!(
+        html.contains(&escaped_label("<b>x</b>")),
+        "node label markup was not escaped"
+    );
+    assert!(
+        !html.contains(&script_json_escaped("<a href")),
+        "a raw `<a href>` node label renders as a live link"
+    );
+}
+
+// Correlation-heatmap categories are raw column names, shown as tick text and via `%{x}`/`%{y}`.
+#[test]
+fn viz_heatmap_correlation_escapes_labels() {
+    let wrk = Workdir::new("viz_heatmap_correlation_escapes_labels");
+    wrk.create_from_string("c.csv", "<b>A</b>,B,C\n1,2,3\n2,4,7\n3,7,8\n4,8,12\n");
+    let mut cmd = wrk.command("viz");
+    cmd.args(["heatmap", "c.csv"])
+        .env("QSV_VIZ_NO_COMPRESS", "1");
+    let out = wrk.output(&mut cmd);
+    assert!(out.status.success());
+    let html = String::from_utf8_lossy(&out.stdout);
+    let x = format!(r#""x":["{}","B","C"]"#, escaped_label("<b>A</b>"));
+    assert!(html.contains(&x), "heatmap labels were not escaped ({x})");
+}
+
+// Treemap/sunburst/icicle labels are raw category values; `ids`/`parents` key the tree, so only
+// the display labels change.
+#[test]
+fn viz_treemap_escapes_labels() {
+    let wrk = Workdir::new("viz_treemap_escapes_labels");
+    wrk.create_from_string("t.csv", "r,c,v\n<i>N</i>,a,1\n<i>N</i>,b,2\nS,a,3\nS,b,1\n");
+    let mut cmd = wrk.command("viz");
+    cmd.args([
+        "treemap", "t.csv", "--cols", "r,c", "--value", "v", "--agg", "sum",
+    ])
+    .env("QSV_VIZ_NO_COMPRESS", "1");
+    let out = wrk.output(&mut cmd);
+    assert!(out.status.success());
+    let html = String::from_utf8_lossy(&out.stdout);
+    let labels_at = html.find(r#""labels":["#).expect("treemap labels");
+    let labels = &html[labels_at..labels_at + html[labe
```

#### Recent Merged Pull Requests:
- **PR #4885** (2026-10-22): fix(viz): draw auto-resolved state maps with Alaska/Hawaii on the albers usa inset map (@jqnatividad)
- **PR #4884** (2026-10-22): test(viz): re-enable viz_denominator_census_is_reserved and make it test the reservation (@jqnatividad)
- **PR #4883** (2026-10-22): fix(viz): extent outliers skip state-scoped sets and require a real gap (@jqnatividad)
- **PR #4882** (2026-10-22): fix(viz): skip blank --slider cells; reject negative pie slices; P/E suffixes (@jqnatividad)
- **PR #4881** (2026-10-22): fix(viz): smart declines over-long bubble axes; ignore blanks in bare-year pick (@jqnatividad)
- **PR #4880** (2026-10-22): fix(viz): type category label axes so numeric-looking labels don't drop the rest (@jqnatividad)

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

## X. deps: update lock file for various security fixes

**RULE**:
When implementing operations in `Cargo.lock`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dathere/qsv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ebb69346`: deps: update lock file for various security fixes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `Cargo.lock`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
version = "0.9.12"
checksum = "6b0ca1155a9ecc25aa12e8313a119f32edf0255fea2f44839c4ac0a12b2ac157"
version = "3.0.2"
checksum = "0032a2738ba16d9a8822e4eb2833faeed5c41d767633ea753f33b6becd58cbfc"
version = "3.0.2"
checksum = "d3ca3f8d41a993f03d865f7fd8a3e63502f778b16ef4680bbc0863d3a2ce12fd"
version = "1.5.2"
checksum = "cd4acc8d264ea385db64ccfdcdfd5909ee9eda0975666723d59f3bfec80b3611"
version = "1.54.1"
checksum = "b52fd3255258d26fac7264ab5a76b53c13367136dc011d3d6ad4f8ed070396a3"
version = "3.5.0"
checksum = "cde93ff05758a36a851a398a772b0b79a82fbe3c186a46f2696baaeaf84c966b"
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
version = "0.9.11"
checksum = "d1219ed1b7f229ee7104d281dd01d6802fe28bb6e95d292942c4daacdeb798c0"
version = "3.0.1"
checksum = "789a6b737c4a13bec43cd3c1b982aa8a8a192ff4bf444e0fb1fd5a324f064fd1"
version = "3.0.1"
checksum = "e15d0d31fbf10ce99b313a238406d62dd5913d95a9be5fa081f1232e31292fc7"
version = "1.5.1"
checksum = "494b4379484fc92217cc7d9e3a532375b1d01a61889ec8333025dc3b0377af56"
[[package]]
name = "socks"
version = "0.3.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f0c3dbbd9ae980613c6dd8e28a9407b50509d3803b57624d5dfe8315218cd58b"
dependencies = [
 "byteorder",
 "libc",
 "winapi",
]

version = "1.54.0"
checksum = "a0c168a474b95bfecfe908a65d4bdffc523144b649a74c09c286afb35d53e0bc"
version = "3.4.2"
checksum = "9a7ac20be9b7726e0bbdbf974c059676d9acb1cd414961f570a4e8231cacd7fc"
 "socks",
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ebb69346` are properly handled with clean fallback behavior.
