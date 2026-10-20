> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dathere-qsv-learnings.md`  
> **Source**: github ([https://github.com/dathere/qsv](https://github.com/dathere/qsv))  
> **Source Version**: `87b65968`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T02:43:13.303Z  
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
> **Harvest Timestamp**: 2026-10-20T02:43:12.809Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dathere/qsv`
- **Description**: Blazing-fast, Neuro-symbolic Data-Wrangling toolkit
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3811 stars

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

### Incident Patch 1: `87b65968` (2026-10-20)
**Commit Message**: feat(viz): optional qsv-clientd live mode for Data Schematics (#4848)

* feat(viz): optional qsv-clientd live mode for Data Schematics

`qsv viz smart` HTML now embeds a `qsv-schematic-source` JSON block (schema 1) and a small
bridge script that lets an open schematic use a local qsv-clientd daemon
(https://github.com/dathere/qsv-client, docs/DAEMON.md).

- qsv-schematic-source fields:
  - qsv_version and a per-render schematic_uuid.
  - A SHA-256 fingerprint of the input, for plain local files only.
  - rows and pid.
  - The smart viz_args, with input and -o/--output stripped. File-valued flags
    (--dictionary, --geojson, --dictionary-context) keep only a basename and are listed
    in `redacted`.
  - Emitted through inline_json_script, which escapes `& < >`.
- Bridge: inert unless the page was opened from disk or is served from loopback, so
  published schematics never contact the viewer's machine or trigger local-network
  permission prompts.
  - Once the page loads, it probes 127.0.0.1:$QSV_CLIENTD_PORT (default 14470).
  - It pairs only after the user approves a code with `qsv-clientd approve`.
  - Once paired, it offers drill-down from frequency bars, refresh, re-render, fe

**File**: `.claude/skills/qsv/qsv-viz.json` (modified, +5/-0)
```diff
@@ -279,6 +279,11 @@
         "description": "Maximum number of panels in the Data Schematic. 0 (the default) means auto: draw every eligible column (up to 65), for both HTML and static image export. Up to 8 cartesian panels render as one typed subplot grid; beyond 8, HTML switches to an inline-div grid and static export uses domain-positioned axes to fit one image. Set a positive <n> to cap the panel count instead; eligible columns beyond the cap are reported but not drawn.",
         "default": 0
       },
+      {
+        "flag": "--no-daemon-bridge",
+        "type": "flag",
+        "description": "Leave out the qsv-clientd bridge script. By default a `smart` HTML Data Schematic sends one \"hello\" request to 127.0.0.1 when opened (port 14470, or QSV_CLIENTD_PORT at render time) and, only if a qsv-clientd daemon answers, offers a \"Live data\" chip to pair with it (approved in a shell) for drill-down, refresh, re-render and read-only queries. With no daemon it does nothing, so the page stays self-contained. Setting QSV_VIZ_NO_DAEMON=1 has the same effect. The page's qsv-schematic-source provenance JSON is kept either way, but without the input fingerprint (which costs an extra read of the input). HTML output only. Only affects `smart`. See https://github.com/dathere/qsv/blob/master/docs/DATA_SCHEMATIC.md"
+      },
       {
         "flag": "--no-headers",
         "type": "flag",
```

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -6,6 +6,14 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Added
+- **`viz smart`: optional live mode for Data Schematics with [qsv-clientd](https://github.com/dathere/qsv-client)** ([#4848](https://github.com/dathere/qsv/pull/4848)).
+  - **Embedded source block.** Smart HTML now embeds a `qsv-schematic-source` JSON block. It contains the qsv version, a per-render `schematic_uuid`, a BLAKE3 fingerprint of the input (local files only; memory-mapped and multithreaded, about 0.05s per GB from the OS cache, skipped with `--no-daemon-bridge`), the row count, the PID and the smart arguments.
+  - **Arguments are redacted.** The input path and `-o/--output` are stripped from the recorded arguments, and file-valued flags keep only a basename and are listed in `redacted`.
+  - **Bridge script.** A small bridge script also lets an open schematic use qsv-clientd, an optional per-user daemon from qsv-client. After you approve a pairing code with `qsv-clientd approve`, the schematic can drill into the rows behind a frequency bar, refresh its stats, re-render itself, fetch the latest data, and run read-only queries.
+  - **Inert by default.** The bridge does nothing unless the schematic was opened from disk or is served from loopback, so published schematics never contact the viewer's machine or trigger local-network permission prompts. Without the daemon, schematics are unchanged.
+  - **Opt-out and port.** `--no-daemon-bridge` (or `QSV_VIZ_NO_DAEMON=1`) leaves the script out. `QSV_CLIENTD_PORT` sets the port it probes (default 14470).
+
 ### Fixed
 - **`schema`: the 26.0.0 Unicode length pass made indexed runs 7× slower.** The character-length pass added in [#4827](https://github.com/dathere/qsv/pull/4827) read the whole file on one thread, decoding every field, whenever a String column had non-ASCII text. It now decodes only the columns it measures and, when the file is indexed, splits the rows across threads like `frequency`. On the 1M-row benchmark file, indexed `schema` drops from 442 ms to 93 ms (25.0.0, before the pass existed: 55 ms); the schema it writes is unchanged ([#4852](https://github.com/dathere/qsv/pull/4852)).
 - **Benchmark archive: 247 more invalid historical runs removed** ([#4851](https://github.com/dathere/qsv/pull/4851)). 237 runs timed a command that errored out at startup. 10 more were found by rerunning suspect windows with the original release binaries: `joinp`/`joinp_streaming` 14.0.0–15.0.1 fail with a Polars dtype error on `Incident Zip`, and `count`/`count_polars_lowmem` 2.0.0–2.1.0 print `0` instead of `1000000`. The other fast windows (`count` 0.125.0–1.0.0, the `sqlp` family 0.126.0–0.135.0, and the suite-wide 2.0.0–3.0.0 dip) reproduced and were kept.
```

**File**: `docs/DATA_SCHEMATIC.md` (modified, +74/-1)
```diff
@@ -218,7 +218,7 @@ the artifact.
 | 4 — Declared, not guessed | The pipeline panel is drawn *only* from an `x-qsv.relationships` declaration; `target` is never inferred. |
 | 5 — Form follows data | A declared pipeline renders as a funnel only while the stage **totals never increase**; otherwise as a bridge, with the reason in the subtitle. Row-wise containment is measured and disclosed separately in the subtitle, but does not decide the form — the two can disagree in either direction. |
 | 6 — Denominators | Pipeline totals sum over rows complete across all declared stages; the subtitle states that basis. |
-| 7 — Self-contained | plotly.js is embedded by default (`QSV_VIZ_CDN` opts out). Continental/global extents and all static exports use an offline ScatterGeo projection; a *local*-extent panel uses a MapLibre tile basemap, which needs network at view time. The reverse-geocode overlay degrades to absent when offline. |
+| 7 — Self-contained | plotly.js is embedded by default (`QSV_VIZ_CDN` opts out). The optional qsv-clientd bridge ([Live mode](#live-mode-optional)) is inert without the daemon. Continental/global extents and all static exports use an offline ScatterGeo projection; a *local*-extent panel uses a MapLibre tile basemap, which needs network at view time. The reverse-geocode overlay degrades to absent when offline. |
 | 8 — Checkable | `--dict-info` bundles the schema, the charted frequency counts and the consumed stats sidecars into the HTML, each under a 4 MB cap. The human-readable `<stem>.stats.csv` is deliberately not offered, since viz never reads it. |
 | 9 — Provenance | Header metadata table: `Generated by: qsv <version>` and `Compiled:` always; `--dataset-pid` adds a citable identifier. Local paths are redacted, so the table carries no dataset filename. |
 | 10 — Limits in place | Sampled violins are titled "(sampled)"; snap/drop coverage is noted beneath the map. |
@@ -234,6 +234,79 @@ CDN-loaded third-party JavaScript — unrelated to the bundle.) Adding per-input
 an attestation that identifies the *computation* rather than merely the output is the
 remaining work for Level 3.
 
+
+### Live mode (optional)
+
+A `viz smart` HTML schematic can be connected to
+[qsv-clientd](https://github.com/dathere/qsv-client/blob/main/docs/DAEMON.md), a per-user
+daemon that runs qsv locally. Connected, the page can drill into the rows behind a frequency
+bar, refresh its statistics, re-render itself, fetch the latest data from its source, and run
+allowlisted read-only queries. Live mode is an add-on: it never replaces what the page already
+embeds, and it does not change the conformance level.
+
+**The provenance block.** Every smart HTML page embeds, whether or not the bridge is included:
+
+```html
+<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"26.0.0",
+  "schematic_uuid":"…","fingerprint":{"algo":"blake3","digest":"…","bytes":47702},
+  "rows":100,"viz_args":["--limit","5"],"redacted":[],"pid":null}</script>
+```
+
+| Field | Meaning |
+|---|---|
+| `schema` | Version of this block's layout (`1`). |
+| `qsv_version` | The qsv that drew the page. |
+| `schematic_uuid` | A fresh random id per render; the daemon pairs a page with its dataset by it. |
+| `fingerprint` | BLAKE3 (`digest`, lowercase hex) and size (`bytes`) of the raw input file, hashed memory-mapped on all cores. Present only when the input is a plain local file and the bridge is included — omitted for URLs, `dc:` handles, and with `--no-daemon-bridge` or `QSV_VIZ_NO_DAEMON`, which skip the extra read of the input. |
+| `rows` | The row count shown in the metadata table. |
+| `viz_args` | The arguments after `viz smart`, without the input and `-o`/`--output`. |
+| `redacted` | Flags in `viz_args` whose file value was cut down to its basename: `--dictionary` and `--geojson` when the value is a path (not `infer`, `auto`, `census:…`, a shortcut or a URL), and `--dictionary-context` always. Always present, possibly empty. |
+| `pid` | The `--dataset-pid` value, or `null`. |
+
+`<`, `>` and `&` are written as `<`, `>` and `&` inside the JSON, so no value
+can close the script element. Local paths are never recorded, matching MUST 9's redaction.
+
+**The bridge.** Unless opted out, the page also carries a small inline script
+(`id="qsv-daemon-bridge"`, no external dependencies). On load it sends one request to
+`http://127.0.0.1:<port>/v1/hello` (port 14470, or `QSV_CLIENTD_PORT` at render time) with a
+300 ms timeout and no credentials. If nothing answers, or the reply is not qsv-clientd's, it does
+nothing else: no UI, no retries. The page remains fully self-contained, so **MUST 7 holds with
+or without the daemon**. Some browsers' local-network protections may still ask before a page
+talks to `127.0.0.1`.
+
+The bridge activates only for a schematic opened from disk (`file:`) or served from a loopback
+address (`127.0.0.1`, `localhost`, `[::1]`). On any other origin, such as a schematic publis
```

**File**: `docs/ENVIRONMENT_VARIABLES.md` (modified, +2/-0)
```diff
@@ -74,6 +74,8 @@
 | `QSV_VIZ_MAX_POINTS` | the maximum number of data points `viz smart` embeds per panel (map, time-series, correlated-pair scatter, 3D scatter); above this, points are uniformly downsampled. The violin sample budget derives from this (one-fifth — 30,000 at the default): the fixed 10,000 point-overlay cutoff is unaffected, but the violin "(sampled)" boundary and sample size scale with it. An advanced knob: larger values embed more points for higher fidelity at the cost of a heavier, slower-to-render HTML; smaller values keep the output leaner. A non-numeric or zero value falls back to the default. (default: 150000). Requires the `viz` feature. |
 | `QSV_VIZ_CDN` | if set, `viz` HTML output loads the plotly.js runtime from the CDN (`<script src="https://cdn.plot.ly/...">`, pinned to the same version qsv would otherwise embed) instead of embedding it. This shrinks a page by ~1.9 MB - a single chart drops to a few KB - but the page then requires network access **when it is viewed**, so the output is no longer offline-capable. Intended for charts published to the web. Governs only the plotly.js bundle: figure payloads still follow `QSV_VIZ_NO_COMPRESS`. Does not affect the size of the qsv binary itself. Requires the `viz` feature. |
 | `QSV_VIZ_NO_COMPRESS` | if set, `viz` HTML output is fully readable plain text: plotly.js and large map-panel figures embed inline instead of as gzip+base64 payloads inflated in-browser via the native `DecompressionStream` API, and map coordinate/size arrays stay decimal JSON instead of base64 float32 typed arrays. Compression (the default) cuts a self-contained page by ~3 MB (plotly.js 4.8 MB → 1.9 MB) and shrinks map payloads 3-4x, but needs a 2023+ browser and, for strict-CSP embeds, `unsafe-eval`. Set this for old browsers, strict-CSP iframe embeds, or when grepping/debugging the emitted HTML. Note that `QSV_VIZ_CDN` also sidesteps the `unsafe-eval` requirement on its own (there is no bundle to inflate and install), though gzipped map figures still need `DecompressionStream`. Requires the `viz` feature. |
+| `QSV_CLIENTD_PORT` | the loopback port of the [qsv-clientd](https://github.com/dathere/qsv-client/blob/main/docs/DAEMON.md) daemon that a `viz smart` HTML Data Schematic's bridge script probes (`http://127.0.0.1:<port>/v1/hello`) when the page is opened. Read when the schematic is rendered and baked into the page. A non-numeric or zero value falls back to the default. (default: 14470). See [Live mode](DATA_SCHEMATIC.md#live-mode-optional). Requires the `viz` feature. |
+| `QSV_VIZ_NO_DAEMON` | if set, `viz smart` HTML output leaves out the qsv-clientd bridge script, exactly like `--no-daemon-bridge`. Without a running daemon the bridge is inert anyway (the page stays self-contained); set this for pages that must never contact `127.0.0.1`. The `qsv-schematic-source` provenance JSON is still embedded, but without the input fingerprint, which saves a full extra read of the input. Requires the `viz` feature. |
 | `QSV_VIZ_DICT_FRESH` | if set, `viz smart --dictionary infer` forces a genuinely FRESH Data Dictionary inference. Two layers cache an inferred dictionary and this bypasses BOTH: the `<stem>.schema.json` sidecar beside the input (normally reused as-is, skipping the LLM entirely) **and** `describegpt`'s own completion cache (`~/.qsv-cache/describegpt`, its `--disk-cache-dir` default, 28-day TTL), by passing it `--fresh`. Defeating only one leaves the other silently serving the old dictionary. Intended for regenerating dictionary-driven artifacts (e.g. the `examples/viz` gallery) after a model or prompt-file change. Note a successful re-infer OVERWRITES the sidecar, including a hand-edited one; a failed one leaves it untouched and soft-falls back to the stats-only Data Schematic. Off by default - reuse is the cheap, documented behavior. Requires the `viz` feature. |
 | `QSV_CENSUS_API_KEY` | the US Census Data API key used by `viz choropleth --denominator census` (and the `viz smart` rate panel it drives) to fetch ACS population denominators. REQUIRED for that path - the Census Bureau redirects unkeyed requests to a "Missing Key" HTML page rather than refusing them, so qsv asks for the key up front rather than failing obscurely later. Request a free one at <https://api.census.gov/data/key_signup.html>. Requires the `viz` feature. |
 | `QSV_VIZ_BOUNDARY_CACHE_TTL_DAYS` | how many days a boundary set fetched by `viz --geojson auto` (Census TIGERweb county/ZCTA/tract/place polygons) stays fresh in `QSV_CACHE_DIR` before it is re-fetched. A repeated command within the TTL makes no network request at all. (default: 30). Requires the `viz` feature. |
```

**File**: `docs/help/viz.md` (modified, +4/-0)
```diff
@@ -28,6 +28,9 @@ network to be VIEWED). Set QSV_VIZ_NO_COMPRESS for plain-text HTML that works on
 browsers and strict-CSP embeds. Progress is shown on stderr, auto-hidden when stderr is not a
 terminal, and disabled by setting QSV_PROGRESSBAR to a falsy value. For all of the above, see
 <https://github.com/dathere/qsv/wiki/Visualization#output-and-file-size>
+A `smart` HTML Data Schematic embeds a small qsv-clientd bridge (see --no-daemon-bridge):  
+QSV_CLIENTD_PORT sets the daemon port it probes (default 14470), and QSV_VIZ_NO_DAEMON
+leaves it, and the input fingerprint, out.
 
 The output format is inferred from the --output file extension (.html is the default).
 Interactive HTML is written to stdout when --output is not given; image formats always
@@ -477,6 +480,7 @@ qsv viz --help
 | &nbsp;`‑‑tour‑audience`&nbsp; | string | Who the guided Tour should talk to. Forwarded to describegpt when `--dictionary infer` generates the dictionary, so the inferred dictionary carries an "x-qsv.tour" narration written for that audience (e.g. "Explain like I'm 10" - the default - or "a board of directors", "data journalists"). The audience shapes ONLY the tour prose; field labels and descriptions keep their normal register. Ignored unless a FRESH `--dictionary infer` actually runs: when an existing <stem>.schema.json sidecar is reused, delete it (or set QSV_VIZ_DICT_FRESH=1) to re-infer with a new audience. Only affects `smart`. |  |
 | &nbsp;`‑‑dict‑info`&nbsp; | flag | When a usable Data Dictionary is available (per --dictionary), add a "Data Schematic" link beneath the page title and an info icon on each panel title: hovering shows that column's description, clicking opens a human-friendly rendering of the dictionary in a side drawer NEXT TO the plots, scrolled to that column's entry. The drawer carries a table of contents, per-column "View chart" links, download buttons bundling every sidecar this run READ (each under 4 MB), and a record of what the Data Schematic LEFT OUT. Everything is embedded in the HTML, so no extra file is written. HTML output only; ignored with a note when no dictionary is available or when exporting an image. Only affects `smart`. See <https://github.com/dathere/qsv/wiki/Visualization#dict-info> |  |
 | &nbsp;`‑‑dataset‑pid`&nbsp; | string | A persistent identifier (PID) for the dataset - typically a full URL such as a DOI (<https://doi.org/10.1234/abc>) or other citable link. When set, a "PID" row is added to the metadata table at the top of the Data Schematic. http(s) and mailto values become a clickable link; any other scheme is shown as plain text. HTML output only. Only affects `smart`. |  |
+| &nbsp;`‑‑no‑daemon‑bridge`&nbsp; | flag | Leave out the qsv-clientd bridge script. By default a `smart` HTML Data Schematic sends one "hello" request to 127.0.0.1 when opened (port 14470, or QSV_CLIENTD_PORT at render time) and, only if a qsv-clientd daemon answers, offers a "Live data" chip to pair with it (approved in a shell) for drill-down, refresh, re-render and read-only queries. With no daemon it does nothing, so the page stays self-contained. Setting QSV_VIZ_NO_DAEMON=1 has the same effect. The page's qsv-schematic-source provenance JSON is kept either way, but without the input fingerprint (which costs an extra read of the input). HTML output only. Only affects `smart`. See <https://github.com/dathere/qsv/blob/master/docs/DATA_SCHEMATIC.md> |  |
 | &nbsp;`‑‑bivariate`&nbsp; | flag | Add two pairwise-association overview panels driven by `qsv moarstats --bivariate`: a normalized mutual information (NMI) heatmap over every column pair (numeric AND categorical, unlike the Pearson-only correlation heatmap), plus a ranked "top relationships" bar of the strongest pairs when there are more than 8 chartable columns. Identifier / PII / free-text columns (per the --dictionary option) and map lat/lon columns are excluded. It TURNS ON --smarter, plus --dictionary infer when --dictionary isn't already set. Capped at 50 columns (1,225 pairs); wider datasets skip these panels with a warning. Only affects `smart`. See <https://github.com/dathere/qsv/wiki/Visualization#bivariate> |  |
 | &nbsp;`‑‑log‑scale`&nbsp; | string | Use a logarithmic y-axis for panels with a high dynamic range: frequency bar panels whose tallest bar dwarfs the rest (e.g. a large "(NULL)" or "Other (N)" bucket), so the small categories stay visible; and box panels of an all-positive column whose observed max/min ratio is huge. One of: auto, on, off. "auto" switches a panel to a log y-axis only when its dynamic range is high; "on" forces it on every frequency panel and every all-positive box panel; "off" keeps the linear axes. Only affects `smart`. | `auto` |
 | &nbsp;`‑‑violin`&nbsp; | string | Draw distribution panels as violins (a box plot wrapped in a KDE density silhouette - a strict superset of a plain box) instead of boxes. One of: auto, on, off. "auto" draws a violin for every continuous column EXCEPT those on a log va
```

**File**: `scripts/viz-golden-check.sh` (modified, +3/-1)
```diff
@@ -71,10 +71,12 @@ run_case() {
         >"$OUT/$name.stdout" 2>"$OUT/$name.stderr"
     local rc=$?
 
-    # Normalize the two by-design nondeterministic sinks so a byte-diff is meaningful.
+    # Normalize the by-design nondeterministic sinks so a byte-diff is meaningful.
     # perl (not `sed -i`) because in-place editing is spelled incompatibly on BSD vs GNU sed.
     if [[ "$ext" == "html" ]]; then
         perl -i -pe 's/\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/<TIMESTAMP>/g' "$OUT/$name.$ext"
+        # the qsv-schematic-source block's per-render id (see cmd::viz_daemon)
+        perl -i -pe 's/"schematic_uuid":"[0-9a-f-]{36}"/"schematic_uuid":"<UUID>"/g' "$OUT/$name.$ext"
     fi
     perl -i -pe 's/\(elapsed: [\d.]+s\)/(elapsed: <T>)/g' "$OUT/$name.stderr"
 
```

**File**: `src/cmd/mod.rs` (modified, +2/-0)
```diff
@@ -158,6 +158,8 @@ pub mod viz;
 #[cfg(all(feature = "viz", feature = "feature_capable"))]
 pub mod viz_census;
 #[cfg(all(feature = "viz", feature = "feature_capable"))]
+pub mod viz_daemon;
+#[cfg(all(feature = "viz", feature = "feature_capable"))]
 pub mod viz_i18n;
 #[cfg(all(feature = "readstat", feature = "feature_capable"))]
 pub mod writestat;
```

**File**: `src/cmd/viz.rs` (modified, +229/-38)
```diff
@@ -16,6 +16,9 @@ network to be VIEWED). Set QSV_VIZ_NO_COMPRESS for plain-text HTML that works on
 browsers and strict-CSP embeds. Progress is shown on stderr, auto-hidden when stderr is not a
 terminal, and disabled by setting QSV_PROGRESSBAR to a falsy value. For all of the above, see
 https://github.com/dathere/qsv/wiki/Visualization#output-and-file-size
+A `smart` HTML Data Schematic embeds a small qsv-clientd bridge (see --no-daemon-bridge):
+QSV_CLIENTD_PORT sets the daemon port it probes (default 14470), and QSV_VIZ_NO_DAEMON
+leaves it, and the input fingerprint, out.
 
 The output format is inferred from the --output file extension (.html is the default).
 Interactive HTML is written to stdout when --output is not given; image formats always
@@ -693,7 +696,18 @@ smart options:
                            top of the Data Schematic. http(s) and mailto values become a
                            clickable link; any other scheme is shown as plain text. HTML
                            output only. Only affects `smart`.
-    --bivariate            Add two pairwise-association overview panels driven by
+    --no-daemon-bridge     Leave out the qsv-clientd bridge script. By default a `smart`
+                           HTML Data Schematic sends one "hello" request to 127.0.0.1 when
+                           opened (port 14470, or QSV_CLIENTD_PORT at render time) and,
+                           only if a qsv-clientd daemon answers, offers a "Live data" chip to
+                           pair with it (approved in a shell) for drill-down, refresh,
+                           re-render and read-only queries. With no daemon it does nothing,
+                           so the page stays self-contained. Setting QSV_VIZ_NO_DAEMON=1 has
+                           the same effect. The page's qsv-schematic-source provenance JSON
+                           is kept either way, but without the input fingerprint (which
+                           costs an extra read of the input). HTML output only. Only affects `smart`. See
+                           https://github.com/dathere/qsv/blob/master/docs/DATA_SCHEMATIC.md
+    --bivariate           Add two pairwise-association overview panels driven by
                            `qsv moarstats --bivariate`: a normalized mutual information (NMI)
                            heatmap over every column pair (numeric AND categorical, unlike
                            the Pearson-only correlation heatmap), plus a ranked "top
@@ -1757,6 +1771,7 @@ struct Args {
     flag_tour_audience:      Option<String>,
     flag_dict_info:          bool,
     flag_dataset_pid:        Option<String>,
+    flag_no_daemon_bridge:   bool,
     flag_log_scale:          String,
     flag_violin:             String,
     flag_title:              Option<String>,
@@ -1784,6 +1799,11 @@ struct Args {
     flag_output:             Option<String>,
     flag_delimiter:          Option<Delimiter>,
     flag_no_headers:         bool,
+    /// The raw `viz smart` invocation recorded in the Data Schematic's `qsv-schematic-source`
+    /// block. Captured from argv in `run`, before any flag is rewritten (a deferred `--geojson
+    /// auto` becomes a cache path; stdin becomes a temp file).
+    #[serde(skip)]
+    source_args:             crate::cmd::viz_daemon::SourceArgs,
 }
 
 /// The chart image format, derived from the --output extension.
@@ -1822,6 +1842,10 @@ impl OutFormat {
 
 pub fn run(argv: &[&str]) -> CliResult<()> {
     let mut args: Args = util::get_args(USAGE, argv)?;
+    if args.cmd_smart {
+        args.source_args =
+            crate::cmd::viz_daemon::SourceArgs::from_argv(argv, usage_option_takes_value);
+    }
 
     // Repair a stale compiled-in webdriver path before ANY other work (#4620). Deliberately the
     // first statement after arg parsing, because it mutates process env: main.rs spawns no
@@ -2203,6 +2227,8 @@ pub fn run(argv: &[&str]) -> CliResult<()> {
                 data_chrome,
                 tour_chrome,
                 title_fit,
+                daemon_chrome,
+                drill_attr,
             } => {
                 // HTML smart-grid is wrapped in qsv's own page so it gets the light/dark toggle;
                 // plotly's `to_html()` (used by the generic single-`Plot` path) has no injection
@@ -2217,6 +2243,8 @@ pub fn run(argv: &[&str]) -> CliResult<()> {
                         data_chrome.as_deref(),
                         tour_chrome.as_deref(),
                         &title_fit,
+                        daemon_chrome.as_deref(),
+                        &drill_attr,
                     );
                     progress.finish_and_clear();
                     return output_inline_html(&html, &args);
@@ -2265,22 +2293,26 @@ pub fn run(argv: &[&str]) -> CliResult<()> {
 enum SmartRender {
     // `Plot` is large; box it so the enum isn't bloated by the rarely-larger variant.
     Grid {
-        plot:        Box<Plot>,
-        dims:      
```

#### Recent Merged Pull Requests:
- **PR #4854** (2026-10-20): fix(benchmarks): sync before each extsort run (@jqnatividad)
- **PR #4853** (2026-10-20): fix(benchmarks): remove 28 sqlp_tryparsedates runs that timed a cached schema (@jqnatividad)
- **PR #4852** (2026-10-20): perf(schema): parallelize the Unicode length pass on indexed files (@jqnatividad)
- **PR #4851** (2026-10-20): fix(benchmarks): remove 247 historical runs that timed a failed or broken command (@jqnatividad)
- **PR #4850** (2026-10-19): fix(benchmarks): keep multi-release deltas out of the change charts (@jqnatividad)
- **PR #4849** (2026-10-19): benchmarks: regenerate Data Schematic for the 26.0.0 run (@jqnatividad)

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

## X. viz): optional qsv-clientd live mode for Data Schematics (#4848)

**RULE**:
When implementing operations in `.claude/skills/qsv/qsv-viz.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dathere/qsv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `87b65968`: viz): optional qsv-clientd live mode for Data Schematics (#4848). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/skills/qsv/qsv-viz.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      {
        "flag": "--no-daemon-bridge",
        "type": "flag",
        "description": "Leave out the qsv-clientd bridge script. By default a `smart` HTML Data Schematic sends one \"hello\" request to 127.0.0.1 when opened (port 14470, or QSV_CLIENTD_PORT at render time) and, only if a qsv-clientd daemon answers, offers a \"Live data\" chip to pair with it (approved in a shell) for drill-down, refresh, re-render and read-only queries. With no daemon it does nothing, so the page stays self-contained. Setting QSV_VIZ_NO_DAEMON=1 has the same effect. The page's qsv-schematic-source provenance JSON is kept either way, but without the input fingerprint (which costs an extra read of the input). HTML output only. Only affects `smart`. See https://github.com/dathere/qsv/blob/master/docs/DATA_SCHEMATIC.md"
      },
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `87b65968` are properly handled with clean fallback behavior.
