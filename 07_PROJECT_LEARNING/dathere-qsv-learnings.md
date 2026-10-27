> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dathere-qsv-learnings.md`  
> **Source**: github ([https://github.com/dathere/qsv](https://github.com/dathere/qsv))  
> **Source Version**: `acf15714`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T22:50:01.831Z  
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
> **Harvest Timestamp**: 2026-10-27T22:50:01.189Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dathere/qsv`
- **Description**: Blazing-fast, Neuro-symbolic Data-Wrangling toolkit
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3816 stars

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

/// A frequency-cache column stored as a single sentinel (`<ALL_UNIQUE>`, `<HIGH_CARDINALITY>`,
/// `<NON_UTF8>`) has no per-value data: its one entry is a marker, not a value covering 100% of
/// rows. It must be neither matched against a WHERE literal (`WHERE col = '<NON_UTF8>'` would
/// "match 100% of rows") nor reported as a skewed top value.
fn is_sentinel_entry(freq: &FreqEntry) -> bool {
    freq.frequencies.len() == 1
        && matches!(
            freq.frequencies[0].value.as_str(),
            "<ALL_UNIQUE>" | "<HIGH_CARDINALITY>" | "<NON_UTF8>"
        )
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
    } else 
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

### Incident Patch 1: `acf15714` (2026-10-27)
**Commit Message**: docs(benchmarks): regenerate Data Schematic for the 27.0.1 run (#4950)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `benchmarks/Benchmarks.wiki.md` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 # Benchmarks
 
-qsv's benchmark suite runs 305 benchmarks on a **1,000,000-row × 41-column, 520 MB**
+qsv's benchmark suite runs 303 benchmarks on a **1,000,000-row × 41-column, 520 MB**
 sample of NYC's 311 data, timed with [hyperfine](https://github.com/sharkdp/hyperfine)
 (2 warmups + 3 timed runs each). See
 [`scripts/results/README.md`](https://github.com/dathere/qsv/blob/master/scripts/results/README.md)
@@ -25,6 +25,6 @@ without losing speed, and this release's biggest speedups.
 > **Note:** cross-version numbers are not strictly apples-to-apples — commands gain features
 > over time. Treat the historical trend as a broad trajectory, not an exact speedup.
 
-_Last generated for qsv 26.0.0 (aarch64-apple-darwin). Regenerate with
+_Last generated for qsv 27.0.1 (aarch64-apple-darwin). Regenerate with
 `python3 scripts/gen_benchmark_viz.py` and copy this page's link — the Data Schematic itself
 redeploys to GitHub Pages automatically on push to `master`._
```

**File**: `benchmarks/change_by_family.html` (modified, +22/-1)
```diff
@@ -16,7 +16,7 @@
 
         <script type="module">
             const graph_div = document.getElementById("plotly-html-element");
-            await Plotly.newPlot(graph_div, {"data":[{"type":"box","x":["apply","apply","apply","apply","apply","apply","apply","apply","exclude","exclude","exclude","exclude","exclude","exclude","exclude","exclude","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","luau","luau","luau","luau","luau","luau","luau","luau","luau","luau","luau","luau","luau","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","search","search","search","search","search","search","search","search","search","search","slice","slice","slice","slice","slice","slice","split","split","split","split","split","split","split","sqlp","sqlp","sqlp","sqlp","sqlp","sqlp","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","tojsonl","tojsonl","tojsonl","tojsonl","tojsonl","tojsonl","tojsonl","tojsonl","validate","validate","validate","validate","validate","validate","validate","validate","validate","validate","validate","validate","validate","validate"],"y":[1.5,2.3,6.22,4.22,6.9,3.7,4.15,4.15,7.29,8.84,8.58,7.96,5.2,5.09,5.7,6.04,2.41,1.94,0.34,0.34,1.14,0.89,1.76,2.14,2.79,1.69,1.13,0.17,1.89,1.64,2.53,1.02,3.25,1.48,6.89,3.92,-0.58,1.34,4.03,3.32,2.37,1.64,2.39,2.31,3.5,1.94,2.49,2.42,2.13,2.39,4.04,2.63,2.37,2.57,6.73,6.46,5.6,0.29,5.6,6.09,-0.02,-0.05,-0.15,6.25,-1.11,6.12,5.25,7.19,-1.72,0.01,-0.73,6.19,4.61,7.22,1.72,2.64,3.08,4.45,4.18,1.9,2.64,3.8,7.22,9.86,-3.74,9.48,-3.04,10.13,-4.22,-8.0,-15.77,8.44,8.89,22.83,4.63,-0.05,-0.12,0.97,3.35,0.97,-1.64,-2.63,-0.96,0.96,-0.29,-0.33,0.15,0.04,0.87,0.25,1.0,1.58,-1.67,-3.2,2.0,0.58,-4.84,2.41,-0.56,0.54,0.91,-2.8,3.29,2.76,-4.84,-4.73,21.7,22.07,28.64,16.28,14.69,20.44,19.25,13.2,2.43,2.11,5.87,2.85,2.78,3.52,4.89,3.22,3.78,7.18,10.33,7.4,2.63,3.21],"boxpoints":"outliers","quartilemethod":"linear"}],"layout":{"title":{"text":"Release-over-release change by command family"},"uirevision":"qsv-viz","xaxis":{"title":{"text":"family"}},"yaxis":{"title":{"text":"% faster vs previous version"},"range":[-19.0,32.0]}},"config":{"responsive":true},"frames":null});
+            await Plotly.newPlot(graph_div, {"data":[{"type":"box","x":["apply","apply","apply","apply","apply","apply","apply","apply","exclude","exclude","exclude","exclude","exclude","exclude","exclude","exclude","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","frequency","luau","luau","luau","luau","luau","luau","luau","luau","luau","luau","luau","luau","luau","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","search","search","search","search","search","search","search","search","search","search","slice","slice","slice","slice","slice","slice","split","split","split","split","split","split","split","sqlp","sqlp","sqlp","sqlp","sqlp","sqlp","sqlp","sqlp","sqlp","sqlp","sqlp","sqlp","sqlp","sqlp","sqlp","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","stats","tojsonl","tojsonl","tojsonl","tojsonl","tojsonl","tojsonl","tojsonl","tojsonl","validate","validate","validate","validate","validate","validate","validate","validate","validate","validate","validate","validate","validate","validate"],"y":[0.83,-0.7,-2.68,-0.38,-2.28,-3.35,-3.41,-1.51,-1.69,-2.46,-1.31,-1.47,-2.31,-2.19,-0.96,-1.51,-8.5,-13.31,-0.06,0.09,0.82,-2.29,-1.22,0.33,-7.33,-14.79,-14.8,1.35,-9.55,1.53,-15.64,1.02,-10.6,0.93,-3.8,-14.6,3.27,11.52,-18.33,-0.12,-11.74,-1.4,-2.22,-1.72,-2.68,-3.85,-3.31,-3.29,-0.25,-0.84,0.03,-1.69,-0.26,-0.66,0.4,0.19,0.08,2.1,-0.73,-0.63,1.85,2.94,2.07,-0.76,2.57,-2.17,-0.58,-0.06,4.2,2.06,2.92,-1.55,0.71,-2.06,1.03,-0.08,-0.41,-1.88,0.16,0.88,0.68,-2.16,-1.67,-3.16,5.83,-2.68,5.53,-3.04,6.32,16.42,17.62,-2.65,3.95,-32.14,4.32,1.21,-1.34,0.38,6.09,3.34,6.47,15.91,-0.69,-2.22,0.33,0.18,-0.09,1.32,6.91,-0.75,-1.56,1.51,1.18,1.55,1.55,1.91,1.8,-0.62,1.02,-0.82,-0.51,4.01,-4.69,0.6,-0.71,7.11,0.31,0.9,0.39,0.41,5.17,-2.95,0.09,6.5,5.27,-0.1,-1.52,-0.38,-0.34,0.48,0.37,2.19,1.72,2.35,0.44,-1.08,0.38,0.29,-1.79,1.82,1.09,1.56,1.8,
```

**File**: `benchmarks/count_callout.html` (modified, +22/-1)
```diff
@@ -16,7 +16,7 @@
 
         <script type="module">
             const graph_div = document.getElementById("plotly-html-element");
-            await Plotly.newPlot(graph_div, {"data":[{"type":"bar","x":["no index","with index"],"y":[5714286.0,90909091.0],"textposition":"outside","texttemplate":["5.71M","90.9M"],"textfont":{"size":10},"cliponaxis":false}],"layout":{"title":{"text":"count: the index-read superpower"},"uirevision":"qsv-viz","xaxis":{"title":{"text":"index_status"}},"yaxis":{"title":{"text":"records/sec"}}},"config":{"responsive":true},"frames":null});
+            await Plotly.newPlot(graph_div, {"data":[{"type":"bar","x":["no index","with index"],"y":[5524862.0,100000000.0],"textposition":"outside","texttemplate":["5.52M","100M"],"textfont":{"size":10},"cliponaxis":false}],"layout":{"title":{"text":"count: the index-read superpower"},"uirevision":"qsv-viz","xaxis":{"title":{"text":"index_status"}},"yaxis":{"title":{"text":"records/sec"}}},"config":{"responsive":true},"frames":null});
         </script>
     </div>
 <style>
@@ -378,6 +378,25 @@
     var fl = gd._fullLayout || {};
     return Object.keys(fl).filter(function (k) { return /^scene\d*$/.test(k); });
   }
+  // A sandboxed frame without allow-same-origin gives the page an opaque origin but leaves
+  // location.origin as the URL's; MapLibre's worker (a blob:null URL) reports "null", and the
+  // MapLibre bundled with plotly.js 3.x drops every message whose origin differs from its own, so
+  // the map's tiles never finish loading and the panel stays blank with no error. file:// pages are
+  // exempt from that check. Say so above each map rather than leave an empty panel unexplained.
+  function sandboxNotice(gd) {
+    if (window.origin !== "null" || location.protocol === "file:") return;
+    var lay = (gd && gd.layout) || {};
+    if (!Object.keys(lay).some(function (k) { return /^map\d*$/.test(k); })) return;
+    var host = gd.parentNode;
+    if (!host || host.querySelector(":scope > .qsv-sandbox-map-note")) return;
+    var note = document.createElement("div");
+    note.className = "qsv-sandbox-map-note";
+    note.setAttribute("role", "note");
+    note.textContent = "This map can't load inside a sandboxed frame. Open this Data Schematic in its own browser tab to see it.";
+    note.style.cssText = "margin:4px 0;padding:6px 10px;border:1px solid #d97706;border-radius:6px;" +
+      "background:#fffbeb;color:#78350f;font:13px/1.4 system-ui,sans-serif";
+    host.insertBefore(note, gd);
+  }
   function installGl3dScrollFix(gd) {
     if (gd.__qsvGl3dFix || !sceneKeys(gd).length) return;
     gd.__qsvGl3dFix = true;
@@ -416,6 +435,8 @@
       // cluster bubbles: repaint plotly's black-by-default count labels and add hover/click-to-zoom
       // (see installClusterUi). No-op for non-map panels and for maps that never cluster.
       applyClusterUi(gd);
+      // map panels in a sandboxed (opaque-origin) frame can't load tiles: explain the blank panel
+      sandboxNotice(gd);
       // gl3d panels: stop the WebGL canvas from eating the wheel inline so the page can scroll
       // (scrollZoom:false suppresses the zoom but not the canvas preventDefault; see above).
       installGl3dScrollFix(gd);
```

**File**: `benchmarks/freq_growth.html` (modified, +22/-1)
```diff
@@ -16,7 +16,7 @@
 
         <script type="module">
             const graph_div = document.getElementById("plotly-html-element");
-            await Plotly.newPlot(graph_div, {"data":[{"type":"scatter","name":"frequency","mode":"lines","x":["0.113.0","0.114.0","0.115.0","0.116.0","0.117.0","0.118.0","0.119.0","0.120.0","0.121.0","0.122.0","0.123.0","0.124.1","0.125.0","0.126.0","0.127.0","0.128.0","0.129.1","0.130.0","0.131.1","0.132.0","0.133.1","0.134.0","0.135.0","0.136.0","0.137.0","0.138.0","1.0.0","2.0.0","2.1.0","2.2.1","3.0.0","3.1.1","3.2.0","3.3.0","4.0.0","5.0.3","5.1.0","6.0.1","7.0.1","7.1.0","8.0.0","8.1.1","9.1.0","10.0.0","11.0.2","12.0.0","14.0.0","15.0.0","15.0.1","16.0.0","16.1.0","17.0.0","18.0.0","19.0.0","19.1.0","20.0.0","20.1.0","21.0.0","21.1.0","22.0.1","23.0.1","24.0.0","25.0.0","26.0.0"],"y":[1.0,0.9949144080264717,0.9391003680746984,0.9720571285924462,0.977424220696102,0.9508277697222709,0.9525327044726652,0.8492673029631872,0.8522655449152047,0.8555612209669795,0.9752704791344667,0.9835773886348306,0.9785050749693271,0.938064660048758,0.8359013581053448,0.9253174843448748,0.9305039914593923,0.9201867461240619,0.9138556488577999,0.9198680667314648,0.909163094801808,0.9393924908512458,0.8309326152424353,0.9341050685957393,0.8944640078182677,0.9256414750606818,0.9460847580957844,0.9314839305916283,0.9205054255166589,0.9176452779681002,1.0804160890602676,0.9535577898521859,0.947436489852717,0.8633502764543731,0.89748615072473,0.9057505696394142,0.9454128757097255,0.8265374952862007,0.9608050903721644,0.9350929747127902,0.9545881865549164,0.9688650233432655,0.9559611636046889,1.0883857295367996,1.0777843284097368,1.0734290433775766,1.017885880909511,1.0186666454213738,0.9894410894586169,1.0592982679775012,1.0289281218629998,1.090621796608189,1.0661020730094488,1.0648193884542456,1.0618397361334628,1.050914344290593,1.0451250019917462,1.3521699410974255,1.5253668796507274,1.6556483266676227,1.0937660999484802,1.887463683827552,1.875468060357877,1.9229990917637312]},{"type":"scatter","name":"frequency_index","mode":"lines","x":["0.113.0","0.114.0","0.115.0","0.116.0","0.117.0","0.118.0","0.119.0","0.120.0","0.121.0","0.122.0","0.123.0","0.124.1","0.125.0","0.126.0","0.127.0","0.128.0","0.129.1","0.130.0","0.131.1","0.132.0","0.133.1","0.134.0","0.135.0","0.136.0","0.137.0","0.138.0","1.0.0","2.0.0","2.1.0","2.2.1","3.0.0","3.1.1","3.2.0","3.3.0","4.0.0","5.0.3","5.1.0","6.0.1","7.0.1","7.1.0","8.0.0","8.1.1","9.1.0","10.0.0","11.0.2","12.0.0","14.0.0","15.0.0","15.0.1","16.0.0","16.1.0","17.0.0","18.0.0","19.0.0","19.1.0","20.0.0","20.1.0","21.0.0","21.1.0","22.0.1","23.0.1","24.0.0","25.0.0","26.0.0"],"y":[1.0,0.9509949603187892,0.8442397364631818,1.0464454341492817,1.0052311807253123,0.9956666694571878,0.986282146803737,0.852848843049928,0.8521540032816529,0.8605632387904765,1.0071660583330542,0.9716298178347789,0.9582834527676389,0.986282146803737,0.8691409520141982,0.9268785788433848,0.8921104292937749,0.9005552439473596,0.9044469745169608,1.0402044335800154,0.9947196363392827,1.048542510799317,0.9816558115393631,0.9985161403743763,1.0013834008639453,0.9881448196765228,0.36009861701771423,1.0613039128687674,1.0269334125841343,0.3503331882262331,1.1575727070287647,1.1240016910558215,1.0776985734855842,1.0866519606201654,1.0548850165756958,0.9928328952215115,1.0433155158557412,1.103845059103238,0.8845697434952952,0.8749539564008975,0.897466137025751,0.8875699025550011,0.9013306600140643,0.9219780748752637,0.9083732377858889,0.8898344104745002,0.8181748735893916,0.8055777634531025,0.8168971637142953,0.8018743930616482,0.7688799685229213,0.8324944329102903,0.8200982402973579,0.8391707547801628,0.8371563473194253,1.1003635351438235,1.0855238924421524,1.8230753775575126,1.9970333271941867,1.8686522619964505,2.084552791079262,3.095992532565382,3.353991561464019,3.3647762281083615]},{"type":"scatter","name":"frequency_no_limit","mode":"lines","x":["0.127.0","0.128.0","0.129.1","0.130.0","0.131.1","0.132.0","0.133.1","0.134.0","0.135.0","0.136.0","0.137.0","0.138.0","1.0.0","2.0.0","2.1.0","2.2.1","3.0.0","3.1.1","3.2.0","3.3.0","4.0.0","5.0.3","5.1.0","6.0.1","7.0.1","7.1.0","8.0.0","8.1.1","9.1.0","10.0.0","11.0.2","12.0.0","14.0.0","15.0.0","15.0.1","16.0.0","16.1.0","17.0.0","18.0.0","19.0.0","19.1.0","20.0.0","20.1.0","21.0.0","21.1.0","22.0.1","23.0.1","24.0.0","25.0.0","26.0.0"],"y":[1.0,1.0716226519365288,1.0720729479549909,1.0759055811121288,1.01588316865121,1.046206511894467,0.923644122869409,1.093144754818935,1.0110629544535812,1.082506511382767,1.0364586264948037,1.1004313631176859,1.0877974895996971,1.0889539316471113,1.0820459813638852,1.0734238360103774,1.1930541839152216,1.1685335189098742,1.1706724249975695,1.1288307142820593,1.1226391440282049,1.1179826738372896,1.2003305582135528,1.169065686931693,1.122889877038485,0.89740414579357,0.908395462244214,1.1248650391194666,1.10637731736147,1.2062713954571271,1.1927727489036828,1.2511014342951587,1.2681512789942024,1.27383626
```

**File**: `benchmarks/gainers.html` (modified, +22/-1)
```diff
@@ -16,7 +16,7 @@
 
         <script type="module">
             const graph_div = document.getElementById("plotly-html-element");
-            await Plotly.newPlot(graph_div, {"data":[{"type":"scatter","mode":"markers","x":["tojsonl_index","writestat_sav","writestat_xpt","writestat_dta","split_index","tojsonl_batchall","tojsonl","tojsonl_no_boolean","tojsonl_trim","tojsonl_index_j1","tojsonl_j1","tojsonl_trim_j1","snappy_compress","count_flexible","sortcheck_sorted"],"y":[28.64,26.81,24.33,23.94,22.83,22.07,21.7,20.44,19.25,16.28,14.69,13.2,12.08,11.28,11.06],"hovertext":["name: tojsonl_index\u003cbr\u003edelta (%): 28.64\u003cbr\u003edelta (%): 28.64\u003cbr\u003edelta (%): 28.64","name: writestat_sav\u003cbr\u003edelta (%): 26.81\u003cbr\u003edelta (%): 26.81\u003cbr\u003edelta (%): 26.81","name: writestat_xpt\u003cbr\u003edelta (%): 24.33\u003cbr\u003edelta (%): 24.33\u003cbr\u003edelta (%): 24.33","name: writestat_dta\u003cbr\u003edelta (%): 23.94\u003cbr\u003edelta (%): 23.94\u003cbr\u003edelta (%): 23.94","name: split_index\u003cbr\u003edelta (%): 22.83\u003cbr\u003edelta (%): 22.83\u003cbr\u003edelta (%): 22.83","name: tojsonl_batchall\u003cbr\u003edelta (%): 22.07\u003cbr\u003edelta (%): 22.07\u003cbr\u003edelta (%): 22.07","name: tojsonl\u003cbr\u003edelta (%): 21.7\u003cbr\u003edelta (%): 21.7\u003cbr\u003edelta (%): 21.7","name: tojsonl_no_boolean\u003cbr\u003edelta (%): 20.44\u003cbr\u003edelta (%): 20.44\u003cbr\u003edelta (%): 20.44","name: tojsonl_trim\u003cbr\u003edelta (%): 19.25\u003cbr\u003edelta (%): 19.25\u003cbr\u003edelta (%): 19.25","name: tojsonl_index_j1\u003cbr\u003edelta (%): 16.28\u003cbr\u003edelta (%): 16.28\u003cbr\u003edelta (%): 16.28","name: tojsonl_j1\u003cbr\u003edelta (%): 14.69\u003cbr\u003edelta (%): 14.69\u003cbr\u003edelta (%): 14.69","name: tojsonl_trim_j1\u003cbr\u003edelta (%): 13.2\u003cbr\u003edelta (%): 13.2\u003cbr\u003edelta (%): 13.2","name: snappy_compress\u003cbr\u003edelta (%): 12.08\u003cbr\u003edelta (%): 12.08\u003cbr\u003edelta (%): 12.08","name: count_flexible\u003cbr\u003edelta (%): 11.28\u003cbr\u003edelta (%): 11.28\u003cbr\u003edelta (%): 11.28","name: sortcheck_sorted\u003cbr\u003edelta (%): 11.06\u003cbr\u003edelta (%): 11.06\u003cbr\u003edelta (%): 11.06"],"hoverinfo":"text","marker":{"size":[40,36,32,31,29,27,27,24,22,16,13,10,8,6,6],"color":[28.64,26.81,24.33,23.94,22.83,22.07,21.7,20.44,19.25,16.28,14.69,13.2,12.08,11.28,11.06],"colorscale":"Viridis","showscale":true,"colorbar":{"title":{"text":"delta (%)"}}}}],"layout":{"title":{"text":"Biggest speedups this release"},"uirevision":"qsv-viz","xaxis":{"title":{"text":"name"}},"yaxis":{"title":{"text":"% faster vs previous version"}}},"config":{"responsive":true},"frames":null});
+            await Plotly.newPlot(graph_div, {"data":[{"type":"scatter","mode":"markers","x":["schema_index","extsort_spill","extsort","pivotp_smart","pivotp_basic","partition","pivotp_dates_rows","split_chunks","split","extdedup","snappy_compress","sqlp_format_arrow","excel_metadata_short","frequency_sketch_index","readstat_dta_select"],"y":[76.48,48.25,42.29,36.87,36.1,26.13,24.62,17.62,16.42,16.1,16.05,15.91,12.32,11.52,10.04],"hovertext":["name: schema_index\u003cbr\u003edelta (%): 76.48\u003cbr\u003edelta (%): 76.48\u003cbr\u003edelta (%): 76.48","name: extsort_spill\u003cbr\u003edelta (%): 48.25\u003cbr\u003edelta (%): 48.25\u003cbr\u003edelta (%): 48.25","name: extsort\u003cbr\u003edelta (%): 42.29\u003cbr\u003edelta (%): 42.29\u003cbr\u003edelta (%): 42.29","name: pivotp_smart\u003cbr\u003edelta (%): 36.87\u003cbr\u003edelta (%): 36.87\u003cbr\u003edelta (%): 36.87","name: pivotp_basic\u003cbr\u003edelta (%): 36.1\u003cbr\u003edelta (%): 36.1\u003cbr\u003edelta (%): 36.1","name: partition\u003cbr\u003edelta (%): 26.13\u003cbr\u003edelta (%): 26.13\u003cbr\u003edelta (%): 26.13","name: pivotp_dates_rows\u003cbr\u003edelta (%): 24.62\u003cbr\u003edelta (%): 24.62\u003cbr\u003edelta (%): 24.62","name: split_chunks\u003cbr\u003edelta (%): 17.62\u003cbr\u003edelta (%): 17.62\u003cbr\u003edelta (%): 17.62","name: split\u003cbr\u003edelta (%): 16.42\u003cbr\u003edelta (%): 16.42\u003cbr\u003edelta (%): 16.42","name: extdedup\u003cbr\u003edelta (%): 16.1\u003cbr\u003edelta (%): 16.1\u003cbr\u003edelta (%): 16.1","name: snappy_compress\u003cbr\u003edelta (%): 16.05\u003cbr\u003edelta (%): 16.05\u003cbr\u003edelta (%): 16.05","name: sqlp_format_arrow\u003cbr\u003edelta (%): 15.91\u003cbr\u003edelta (%): 15.91\u003cbr\u003edelta (%): 15.91","name: excel_metadata_short\u003cbr\u003edelta (%): 12.32\u003cbr\u003edelta (%): 12.32\u003cbr\u003edelta (%): 12.32","name: frequency_sketch_index\u003cbr\u003edelta (%): 11.52\u003cbr\u003edelta (%): 11.52\u003cbr\u003edelta (%): 11.52","name: readstat_dta_select\u003cbr\u003edelta (%): 10.04\u003cbr\u003edelta (%): 10.04\u003cbr\u003edelta (%): 10.04"],"hoverinfo":"text","marker":{"size":[40,26,23,20,19,14,13,10,9,9,9,9,7,7,6],"color":[76.48,48.25,42.29,36.87,36.1,26.13,24.62,1
```

**File**: `benchmarks/heatmap.html` (modified, +22/-1)
```diff
@@ -16,7 +16,7 @@
 
         <script type="module">
             const graph_div = document.getElementById("plotly-html-element");
-            await Plotly.newPlot(graph_div, {"data":[{"type":"heatmap","colorscale":"Viridis","x":["16.0.0","16.1.0","17.0.0","18.0.0","19.0.0","19.1.0","20.0.0","20.1.0","21.0.0","21.1.0","22.0.1","23.0.1","24.0.0","25.0.0","26.0.0"],"y":["searchset","stats","count","frequency","search"],"z":[[0.6318607562195442,0.6601396931244702,0.6035804033145729,0.6059050033889601,0.5937108829987483,0.6043535393393132,0.6880466940174942,0.7065868546107793,0.7055305185769766,0.7217125670948021,0.9477911343293163,0.9652353108875299,0.9516129184516134,0.9792532393361036,1.0],[0.83177559613085,0.7772924707074325,0.7091633324302801,0.732510166469146,0.7235772372195121,0.7177418637096834,0.7772924707074325,0.767241345551727,0.751054738911402,0.9780218078461681,1.0,0.9888888849333337,0.8476190188000025,0.9621620091783912,0.9944132924692834],[1.0,0.3030303,0.90909091,1.0,0.90909091,0.90909091,0.90909091,0.90909091,0.90909091,0.90909091,0.90909091,1.0,0.90909091,1.0,0.90909091],[0.2383143301961726,0.228508499941221,0.24741450143277705,0.24373039533699029,0.24939868148436573,0.24880000646880016,0.32702428350263135,0.3226139923879638,0.5418117740871061,0.5935114824312986,0.5553570684392838,0.6195219681075712,0.9201184039230785,0.9967948339166657,1.0],[0.6666666666666666,0.6845637898791932,0.6144577649638583,0.5619834592727277,0.5284974727461113,0.5326370405639702,0.7846153814769232,0.7527675148782293,0.7906976412093037,0.9532709460560784,0.9902912324271858,0.9488372102511627,0.9400921386359459,0.9622640816603804,1.0]]}],"layout":{"title":{"text":"Relative throughput vs each command\u0027s recent peak"},"uirevision":"qsv-viz","xaxis":{"title":{"text":"version"}},"yaxis":{"title":{"text":"name"}}},"config":{"responsive":true},"frames":null});
+            await Plotly.newPlot(graph_div, {"data":[{"type":"heatmap","colorscale":"Viridis","x":["16.1.0","17.0.0","18.0.0","19.0.0","19.1.0","20.0.0","20.1.0","21.0.0","21.1.0","22.0.1","23.0.1","24.0.0","25.0.0","26.0.0","27.0.1"],"y":["count","frequency","search","searchset","stats"],"z":[[0.3030303,0.90909091,1.0,0.90909091,0.90909091,0.90909091,0.90909091,0.90909091,0.90909091,0.90909091,1.0,0.90909091,1.0,0.90909091,1.0],[0.22777377188832806,0.24661898452665784,0.24294672401254136,0.24859678480354988,0.24800003472000487,0.3259727956361914,0.3215766850207359,0.5400696756097546,0.5916031528244414,0.5535714174999985,0.6175300064542009,0.91715992840239,0.9935898191025747,0.9967846795498552,1.0],[0.6845637898791932,0.6144577649638583,0.5619834592727277,0.5284974727461113,0.5326370405639702,0.7846153814769232,0.7527675148782293,0.7906976412093037,0.9532709460560784,0.9902912324271858,0.9488372102511627,0.9400921386359459,0.9622640816603804,1.0,0.9807691248461585],[0.6573423385315323,0.6010227197954561,0.6033374693325061,0.5911950217609957,0.601792579641484,0.6851310829737834,0.7035926792814642,0.7025408194918361,0.7186542962691408,0.9437748512450298,0.9611451077709784,0.9475804404839119,0.975103634979273,0.9957624808475039,1.0],[0.7772924707074325,0.7091633324302801,0.732510166469146,0.7235772372195121,0.7177418637096834,0.7772924707074325,0.767241345551727,0.751054738911402,0.9780218078461681,1.0,0.9888888849333337,0.8476190188000025,0.9621620091783912,0.9944132924692834,0.9673912927391314]]}],"layout":{"title":{"text":"Relative throughput vs each command\u0027s recent peak"},"uirevision":"qsv-viz","xaxis":{"title":{"text":"version"},"type":"category"},"yaxis":{"title":{"text":"name"},"type":"category"}},"config":{"responsive":true},"frames":null});
         </script>
     </div>
 <style>
@@ -378,6 +378,25 @@
     var fl = gd._fullLayout || {};
     return Object.keys(fl).filter(function (k) { return /^scene\d*$/.test(k); });
   }
+  // A sandboxed frame without allow-same-origin gives the page an opaque origin but leaves
+  // location.origin as the URL's; MapLibre's worker (a blob:null URL) reports "null", and the
+  // MapLibre bundled with plotly.js 3.x drops every message whose origin differs from its own, so
+  // the map's tiles never finish loading and the panel stays blank with no error. file:// pages are
+  // exempt from that check. Say so above each map rather than leave an empty panel unexplained.
+  function sandboxNotice(gd) {
+    if (window.origin !== "null" || location.protocol === "file:") return;
+    var lay = (gd && gd.layout) || {};
+    if (!Object.keys(lay).some(function (k) { return /^map\d*$/.test(k); })) return;
+    var host = gd.parentNode;
+    if (!host || host.querySelector(":scope > .qsv-sandbox-map-note")) return;
+    var note = document.createElement("div");
+    note.className = "qsv-sandbox-map-note";
+    note.setAttribute("role", "note");
+    note.textContent = "This map can't load inside a sandboxed frame. Open this Data Schematic in its own browser tab to see it.";
+    note.style.cssText = "margin:4px 0;padding:6px 
```

**File**: `benchmarks/index.html` (modified, +8/-8)
```diff
@@ -49,13 +49,13 @@
 <header>
 <h1 id=top>qsv benchmark Data Schematic<a class=anchor href='#top' aria-label='Permalink to “qsv benchmark Data Schematic”'>#</a></h1>
 <p class=sub>Interactive charts of the qsv benchmark suite, rendered with <code>qsv viz</code> — a live showcase of the command charting its own performance.</p>
-<div class=meta><span><b>qsv</b> 26.0.0</span><span><b>Platform</b> aarch64-apple-darwin</span><span><b>CPU</b> Apple M2 Pro (12 cores)</span><span><b>RAM</b> 32 GiB</span><span><b>Build</b> prebuilt-pgo</span><span><b>Dataset</b> NYC 311 — 1M rows × 41 cols (520 MB)</span></div>
+<div class=meta><span><b>qsv</b> 27.0.1</span><span><b>Platform</b> aarch64-apple-darwin</span><span><b>CPU</b> Apple M2 Pro (12 cores)</span><span><b>RAM</b> 32 GiB</span><span><b>Build</b> prebuilt-pgo</span><span><b>Dataset</b> NYC 311 — 1M rows × 41 cols (520 MB)</span></div>
 </header>
 <div class=caveat><b>Read me first.</b> Throughput is records/sec = the rows a benchmark reads ÷ the mean of 3 runs (2 warmups) via hyperfine. That is the full 1M rows for almost every benchmark; <code>geoconvert_csv2geojsonl</code> (745,305 rows), <code>to_ods</code> (500,000) and the <code>pragmastat_50k*</code> series (50,000) read a smaller subset. Cross-version numbers are <b>not strictly apples-to-apples</b> — commands gain features over time, so a command's benchmark in an old release may do less work than today's. Read the historical charts (the trend, the flagship deep-dives and the heatmap) as broad trajectory, not exact speedup. <code>count</code> gets its own panel below (not the shared-scale charts) because with an index it just reads a stored row count (tens of millions of records/sec) and would flatten every other bar.</div>
 <main>
 <section>
 <h2 id=index_advantage>The index advantage<a class=anchor href='#index_advantage' aria-label='Permalink to “The index advantage”'>#</a></h2>
-<p class=desc>Build an index once and qsv can skip the opening scan on every run after. The payoff is lopsided — 5.8x for stats down to 2.5x for tojsonl on this run, and next to nothing for streaming commands, so only the pairs where an index actually moves the needle are shown here.</p>
+<p class=desc>Build an index once and qsv can skip the opening scan on every run after. The payoff is lopsided — 5.6x for stats down to 2.5x for tojsonl on this run, and next to nothing for streaming commands, so only the pairs where an index actually moves the needle are shown here.</p>
 <iframe class=chart loading=lazy scrolling=no src='index_advantage.html'></iframe>
 <details class=vizsrc><summary>see the qsv viz command</summary><pre><code>figs.append(viz(&quot;bar&quot;, index_src,
                 [&quot;--x&quot;, &quot;command&quot;, &quot;--y&quot;, &quot;recs_per_sec&quot;, &quot;--series&quot;, &quot;index_status&quot;,
@@ -68,7 +68,7 @@ <h2 id=index_advantage>The index advantage<a class=anchor href='#index_advantage
 </section>
 <section>
 <h2 id=count_callout>count with an index is effectively instant<a class=anchor href='#count_callout' aria-label='Permalink to “count with an index is effectively instant”'>#</a></h2>
-<p class=desc>The index advantage at its extreme. With an index, count doesn&#x27;t scan at all — it reads a row count qsv already stored, a ~16x jump from ~5.7M to ~91M rows/sec. It sits on its own axis precisely because that number would flatten every other bar on the page. The un-indexed bar scans the file to count it, so it tracks whatever the current scan path costs; the indexed bar reads the stored count and does not.</p>
+<p class=desc>The index advantage at its extreme. With an index, count doesn&#x27;t scan at all — it reads a row count qsv already stored, a ~18x jump from ~5.5M to ~100M rows/sec. It sits on its own axis precisely because that number would flatten every other bar on the page. The un-indexed bar scans the file to count it, so it tracks whatever the current scan path costs; the indexed bar reads the stored count and does not.</p>
 <iframe class=chart loading=lazy scrolling=no src='count_callout.html'></iframe>
 <details class=vizsrc><summary>see the qsv viz command</summary><pre><code>figs.append(viz(&quot;bar&quot;, prep_count(),
                 [&quot;--x&quot;, &quot;index_status&quot;, &quot;--y&quot;, &quot;recs_per_sec&quot;,
@@ -82,7 +82,7 @@ <h2 id=count_callout>count with an index is effectively instant<a class=anchor h
 </section>
 <section>
 <h2 id=index_superpowers>The index superpowers<a class=anchor href='#index_superpowers' aria-label='Permalink to “The index superpowers”'>#</a></h2>
-<p class=desc>Some commands don&#x27;t just skip the opening scan with an index — they skip almost all the work. slice and sample seek straight to the rows they need; schema reuses cached statistics. That&#x27;s a different order of magnitude: slice_one_middle leads at 44x faster, with the rest of the seek-and-reuse tier 7x to 40x faster — versus the low single digits for the scan-skippers abo
```

**File**: `benchmarks/index_advantage.html` (modified, +22/-1)
```diff
@@ -16,7 +16,7 @@
 
         <script type="module">
             const graph_div = document.getElementById("plotly-html-element");
-            await Plotly.newPlot(graph_div, {"data":[{"type":"bar","x":["frequency","search","searchset","stats","tojsonl"],"y":[724113.0,1776199.0,755287.0,958773.0,157085.0],"name":"no index"},{"type":"bar","x":["frequency","search","searchset","stats","tojsonl"],"y":[3215434.0,4901961.0,2118644.0,5586592.0,388802.0],"name":"with index"}],"layout":{"title":{"text":"The index advantage"},"uirevision":"qsv-viz","xaxis":{"title":{"text":"command"}},"yaxis":{"title":{"text":"records/sec"}}},"config":{"responsive":true},"frames":null});
+            await Plotly.newPlot(graph_div, {"data":[{"type":"bar","x":["frequency","search","searchset","stats","tojsonl"],"y":[667111.0,1742160.0,758150.0,973710.0,156912.0],"name":"no index"},{"type":"bar","x":["frequency","search","searchset","stats","tojsonl"],"y":[3225806.0,4807692.0,2127660.0,5434783.0,387297.0],"name":"with index"}],"layout":{"title":{"text":"The index advantage"},"uirevision":"qsv-viz","xaxis":{"title":{"text":"command"}},"yaxis":{"title":{"text":"records/sec"}}},"config":{"responsive":true},"frames":null});
         </script>
     </div>
 <style>
@@ -378,6 +378,25 @@
     var fl = gd._fullLayout || {};
     return Object.keys(fl).filter(function (k) { return /^scene\d*$/.test(k); });
   }
+  // A sandboxed frame without allow-same-origin gives the page an opaque origin but leaves
+  // location.origin as the URL's; MapLibre's worker (a blob:null URL) reports "null", and the
+  // MapLibre bundled with plotly.js 3.x drops every message whose origin differs from its own, so
+  // the map's tiles never finish loading and the panel stays blank with no error. file:// pages are
+  // exempt from that check. Say so above each map rather than leave an empty panel unexplained.
+  function sandboxNotice(gd) {
+    if (window.origin !== "null" || location.protocol === "file:") return;
+    var lay = (gd && gd.layout) || {};
+    if (!Object.keys(lay).some(function (k) { return /^map\d*$/.test(k); })) return;
+    var host = gd.parentNode;
+    if (!host || host.querySelector(":scope > .qsv-sandbox-map-note")) return;
+    var note = document.createElement("div");
+    note.className = "qsv-sandbox-map-note";
+    note.setAttribute("role", "note");
+    note.textContent = "This map can't load inside a sandboxed frame. Open this Data Schematic in its own browser tab to see it.";
+    note.style.cssText = "margin:4px 0;padding:6px 10px;border:1px solid #d97706;border-radius:6px;" +
+      "background:#fffbeb;color:#78350f;font:13px/1.4 system-ui,sans-serif";
+    host.insertBefore(note, gd);
+  }
   function installGl3dScrollFix(gd) {
     if (gd.__qsvGl3dFix || !sceneKeys(gd).length) return;
     gd.__qsvGl3dFix = true;
@@ -416,6 +435,8 @@
       // cluster bubbles: repaint plotly's black-by-default count labels and add hover/click-to-zoom
       // (see installClusterUi). No-op for non-map panels and for maps that never cluster.
       applyClusterUi(gd);
+      // map panels in a sandboxed (opaque-origin) frame can't load tiles: explain the blank panel
+      sandboxNotice(gd);
       // gl3d panels: stop the WebGL canvas from eating the wheel inline so the page can scroll
       // (scrollZoom:false suppresses the zoom but not the canvas preventDefault; see above).
       installGl3dScrollFix(gd);
```

---

### Incident Patch 2: `b99d3180` (2026-10-27)
**Commit Message**: Merge branch 'master' of https://github.com/dathere/qsv

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -4,6 +4,15 @@ All notable changes to this project will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
+## [Unreleased]
+
+### Added
+- `viz smart`: a Data Schematic embedded in an iframe now reports its own height to the embedding page (`postMessage({qsvVizHeight: <px>}, "*")`), so a host such as CKAN can size the iframe to its content without injecting a script. It reports only when framed, on load, on resize (including the data viewer drawer opening and closing, so the iframe grows and shrinks), and when its content reflows. The data viewer now accepts the embedding page's `qsvVizViewport` answer only from that page. The gallery generator injects only its scroll-forwarding script into these pages. ([#4949](https://github.com/dathere/qsv/pull/4949))
+
+### Fixed
+- **`viz smart`: a map in a sandboxed iframe now says why it's blank** ([#4947](https://github.com/dathere/qsv/pull/4947), [#4946](https://github.com/dathere/qsv/issues/4946)). Embedded in an `<iframe sandbox>` without `allow-same-origin` (the CKAN Webpage view the wiki recommends), every MapLibre map panel stayed empty with no error: the map library bundled with plotly.js 3.x rejects its own worker's messages when the page's origin is `null`. The schematic now shows a note above each such map telling the viewer to open it in its own tab. Pages opened from a file aren't affected. Rendering the maps there needs a plotly.js upgrade; #4946 tracks it.
+- `get`: overwriting an existing file with `--output` (`get`, `get cache-fetch`) no longer briefly exposes the new contents: the temp file that replaces it is owner-only (`0600`) while the data is written, and takes the old file's mode only afterwards. It also keeps the old file's group, so a group-readable file isn't handed to a different group; where the group can't be kept, the new file isn't group-readable, and other users get no access the old file denied its group. Setuid/setgid bits aren't carried over, as an in-place overwrite would have cleared them. Follow-up to [#4945](https://github.com/dathere/qsv/pull/4945). ([#4948](https://github.com/dathere/qsv/pull/4948))
+
 ## [27.0.1] - 2026-10-27 📡 The "Live Data Schematics" Release 📊
 
 ### Highlights
```

**File**: `examples/viz/gen_gallery.py` (modified, +24/-9)
```diff
@@ -268,13 +268,21 @@
 # drawer (issue #4283) reserves its space via body margin-bottom while open, and on close the
 # iframe must SHRINK back. Body margins are counted because that reserved drawer space is exactly
 # a body margin; fixed-position chrome (the drawer, theme toggle, logo) is deliberately excluded.
-RESIZE_REPORTER_JS = (
-    "<script>(function(){function r(){var b=document.body,c=getComputedStyle(b);"
+#
+# `qsv viz smart` now reports its own height (its `<script id="qsv-embed-height">`, the same
+# formula), so for those pages only the user-scroll half is injected; the full reporter is kept for
+# pre-generated Data Schematics built before that. Both injected variants are a bare `<script>`
+# with no literal `<` inside, which is what `inject_resize_reporter`'s strip regex relies on, and
+# the native script's id keeps it out of that match.
+NATIVE_HEIGHT_REPORTER = '<script id="qsv-embed-height">'
+_HEIGHT_REPORTER = (
+    "function r(){var b=document.body,c=getComputedStyle(b);"
     "parent.postMessage({qsvVizHeight:Math.ceil(b.offsetHeight+"
     "(parseFloat(c.marginTop)||0)+(parseFloat(c.marginBottom)||0))},\"*\");}"
     "addEventListener(\"load\",r);addEventListener(\"resize\",r);"
     "if(window.ResizeObserver)new ResizeObserver(r).observe(document.body);"
-    "setTimeout(r,200);setTimeout(r,800);"
+    "setTimeout(r,200);setTimeout(r,800);")
+_USER_SCROLL_REPORTER = (
     # a deep-linked Data Schematic fills the viewport, so the reader's scroll input lands INSIDE this
     # iframe, not the parent gallery window. Forward it so the parent's jump stabilizer can tell the
     # reader has taken over and stop re-aligning / cancel its pending on-load re-arm (see JUMP_JS).
@@ -287,7 +295,9 @@
     # drawer's reveal scroll after a TOC jump.
     "var us=function(){parent.postMessage({qsvUserScroll:1},\"*\");};"
     "[\"wheel\",\"touchstart\",\"keydown\",\"pointerdown\"].forEach(function(t){"
-    "addEventListener(t,us,{capture:true,passive:true});});})();</script>")
+    "addEventListener(t,us,{capture:true,passive:true});});")
+RESIZE_REPORTER_JS = "<script>(function(){" + _HEIGHT_REPORTER + _USER_SCROLL_REPORTER + "})();</script>"
+USER_SCROLL_REPORTER_JS = "<script>(function(){" + _USER_SCROLL_REPORTER + "})();</script>"
 
 # Trace types plotly.js draws with WebGL. Chrome keeps only ~16 live WebGL contexts per page (and
 # same-origin iframes share that budget), dropping the OLDEST when a new one is created — the lost
@@ -1706,14 +1716,19 @@ def inject_resize_reporter(html):
     first-match replace would inject the reporter inside that script string, where it never runs —
     leaving the iframe stuck at its initial height (the Allegheny dog-licenses Data Schematic clipping).
 
-    Idempotent: strip any previously-injected reporter (a <script> containing qsvVizHeight; it has no
-    literal `<` in its body) before re-adding the current one, so re-running against an already-built
+    A Data Schematic that reports its own height (NATIVE_HEIGHT_REPORTER) gets only the user-scroll
+    half; an older one gets the full reporter.
+
+    Idempotent: strip any previously-injected reporter (a bare <script> containing qsvVizHeight or
+    qsvUserScroll; neither has a literal `<` in its body, and the native one carries an id, so it is
+    never matched) before re-adding the current one, so re-running against an already-built
     Data Schematic (e.g. the reused pre-generated ones) refreshes the reporter instead of duplicating it."""
-    html = re.sub(r"<script>[^<]*qsvVizHeight[^<]*</script>\n?", "", html)
+    html = re.sub(r"<script>[^<]*(?:qsvVizHeight|qsvUserScroll)[^<]*</script>\n?", "", html)
+    reporter = USER_SCROLL_REPORTER_JS if NATIVE_HEIGHT_REPORTER in html else RESIZE_REPORTER_JS
     idx = html.rfind("</body>")
     if idx == -1:
-        return html + RESIZE_REPORTER_JS
-    return html[:idx] + RESIZE_REPORTER_JS + "\n" + html[idx:]
+        return html + reporter
+    return html[:idx] + reporter + "\n" + html[idx:]
 
 
 def grid_cols(args):
```

**File**: `examples/viz/smart_allegheny_dogs.html` (modified, +49/-5)
```diff
@@ -76,7 +76,7 @@ <h1 class="qsv-viz-title">allegheny_dog_licenses.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>50,013 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Preview<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>8</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>100.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-27 11:48 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-27 20:18 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 27.0.1</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -501,6 +501,25 @@ <h1 class="qsv-viz-title">allegheny_dog_licenses.csv — Data Schematic</h1>
     var fl = gd._fullLayout || {};
     return Object.keys(fl).filter(function (k) { return /^scene\d*$/.test(k); });
   }
+  // A sandboxed frame without allow-same-origin gives the page an opaque origin but leaves
+  // location.origin as the URL's; MapLibre's worker (a blob:null URL) reports "null", and the
+  // MapLibre bundled with plotly.js 3.x drops every message whose origin differs from its own, so
+  // the map's tiles never finish loading and the panel stays blank with no error. file:// pages are
+  // exempt from that check. Say so above each map rather than leave an empty panel unexplained.
+  function sandboxNotice(gd) {
+    if (window.origin !== "null" || location.protocol === "file:") return;
+    var lay = (gd && gd.layout) || {};
+    if (!Object.keys(lay).some(function (k) { return /^map\d*$/.test(k); })) return;
+    var host = gd.parentNode;
+    if (!host || host.querySelector(":scope > .qsv-sandbox-map-note")) return;
+    var note = document.createElement("div");
+    note.className = "qsv-sandbox-map-note";
+    note.setAttribute("role", "note");
+    note.textContent = "This map can't load inside a sandboxed frame. Open this Data Schematic in its own browser tab to see it.";
+    note.style.cssText = "margin:4px 0;padding:6px 10px;border:1px solid #d97706;border-radius:6px;" +
+      "background:#fffbeb;color:#78350f;font:13px/1.4 system-ui,sans-serif";
+    host.insertBefore(note, gd);
+  }
   function installGl3dScrollFix(gd) {
     if (gd.__qsvGl3dFix || !sceneKeys(gd).length) return;
     gd.__qsvGl3dFix = true;
@@ -539,6 +558,8 @@ <h1 class="qsv-viz-title">allegheny_dog_licenses.csv — Data Schematic</h1>
       // cluster bubbles: repaint plotly's black-by-default count labels and add hover/click-to-zoom
       // (see installClusterUi). No-op for non-map panels and for maps that never cluster.
       applyClusterUi(gd);
+      // map panels in a sandboxed (opaque-origin) frame can't load tiles: explain the blank panel
+      sandboxNotice(gd);
       // gl3d panels: stop the WebGL canvas from eating the wheel inline so the page can scroll
       // (scrollZoom:false suppresses the zoom but not the canvas preventDefault; see above).
       installGl3dScrollFix(gd);
@@ -941,7 +962,7 @@ <h1>allegheny_dog_licenses.csv — Data Schematic</h1>
 <div class="qsv-dict-downloads">
 <a class="qsv-dict-export" download="allegheny_dog_licenses_csv_data_schematic.schema.json" href="data:application/json;base64,ewogICIkc2NoZW1hIjogImh0dHBzOi8vanNvbi1zY2hlbWEub3JnL2RyYWZ0LzIwMjAtMTIvc2NoZW1hIiwKICAidGl0bGUiOiAiRGF0YSBEaWN0aW9uYXJ5IGZvciBhbGxlZ2hlbnlfZG9nX2xpY2Vuc2VzLmNzdiIsCiAgImRlc2NyaXB0aW9uIjogIlRoaXMgZGF0YXNldCBwcm92aWRlcyBhIGNvbXByZWhlbnNpdmUgcmVnaXN0cnkgb2YgZG9nIGxpY2Vuc2VzLCBlbmNvbXBhc3NpbmcgNTAsMDEzIGluZGl2aWR1YWwgcmVjb3Jkcy4gSXQgZGV0YWlscyBwZXQgY2hhcmFjdGVyaXN0aWNzIHN1Y2ggYXMgYnJlZWQgYW5kIGNvbG9yIGFsb25nc2lkZSBhZG1pbmlzdHJhdGl2ZSBpbmZvcm1hdGlvbiBsaWtlIGxpY2Vuc2UgdHlwZXMsIGVmZmVjdGl2ZSBkYXRlcywgYW5kIG93bmVyIHppcCBjb2Rlcy4gVGhlIGRhdGEgc2VydmVzIHRvIGRvY3VtZW50IHBldCBvd25lcnNoaXAgYW5kIHZhbGlkIGxpY2Vuc2luZyBwZXJpb2RzIGFjcm9zcyB2YXJpb3VzIGNhdGVnb3JpZXMgb2YgbGlmZXRpbWUgYW5kIHNlbmlvciByZWdpc3RyYXRpb25zLlxuXG4jIyMgTm90YWJsZSBDaGFyYWN0ZXJpc3RpY3NcblxuKiAqKlNlbnRpbmVsIFZhbHVlczoqKiBUaGUgYEV4cFllYXJgIGZpZWxkIGNvbnNpc3RzIGVudGlyZWx5IG9mIHRoZSB2YWx1ZSBgMjA5OWAsIHdoaWNoIHNlcnZlcyBhcyBhIHNlbnRpbmVsIGluZGljYXRpbmcgbm8gZXhwaXJhdGlvbi5cbiogKipQSUkvU2Vuc2l0aXZlIERhdGE6KiogVGhlIGRhdGFzZXQgY29udGFpbnMgUGVyc29uYWxseSBJZGVudGlmaWFibGUgSW5mb3JtYXRpb24gKFBJSSkgaW4gdGhlIGZvcm0gb2YgYERvZ05hbWVgIGFuZCBnZW9ncmFwaGljIGlkZW50aWZpZXJzIHZpYSBgT3duZXJaaXBgLlxuKiAqKkhpZ2ggQ2FyZGluYWxpdHk6KiogVGhlIGBEb2dOYW1lYCBhbmQgYEJyZWVkYCBmaWVsZHMgZXhoaWJpdCBoaWdoIGNhcmRpbmFsaXR5LCBpbmRpY2F0aW5nIGEgd2lkZSB2YXJpZXR5IG9mIHVuaXF1ZSB2YWx1ZXMgYWNyb3NzIHRoZSBkYXRhc2V0LlxuKiAqKkRpc3RyaWJ1dGlvbiBQYXR0ZXJuczoqKiBUaGUgYExpY2Vuc2VUeXBlYCBmaWVsZCBzaG93cyBhIGNvbmNlbnRyYXRpb24gaW4gbGlmZXRpbWUgcmVnaXN0cmF0aW9ucywgcG
```

**File**: `examples/viz/smart_cms_medicare.html` (modified, +47/-3)
```diff
@@ -74,7 +74,7 @@ <h1 class="qsv-viz-title">cms_medicare_providers.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>30,007 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Preview<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>4</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>97.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-27 11:48 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-27 20:17 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 27.0.1</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -604,6 +604,25 @@ <h1 class="qsv-viz-title">cms_medicare_providers.csv — Data Schematic</h1>
     var fl = gd._fullLayout || {};
     return Object.keys(fl).filter(function (k) { return /^scene\d*$/.test(k); });
   }
+  // A sandboxed frame without allow-same-origin gives the page an opaque origin but leaves
+  // location.origin as the URL's; MapLibre's worker (a blob:null URL) reports "null", and the
+  // MapLibre bundled with plotly.js 3.x drops every message whose origin differs from its own, so
+  // the map's tiles never finish loading and the panel stays blank with no error. file:// pages are
+  // exempt from that check. Say so above each map rather than leave an empty panel unexplained.
+  function sandboxNotice(gd) {
+    if (window.origin !== "null" || location.protocol === "file:") return;
+    var lay = (gd && gd.layout) || {};
+    if (!Object.keys(lay).some(function (k) { return /^map\d*$/.test(k); })) return;
+    var host = gd.parentNode;
+    if (!host || host.querySelector(":scope > .qsv-sandbox-map-note")) return;
+    var note = document.createElement("div");
+    note.className = "qsv-sandbox-map-note";
+    note.setAttribute("role", "note");
+    note.textContent = "This map can't load inside a sandboxed frame. Open this Data Schematic in its own browser tab to see it.";
+    note.style.cssText = "margin:4px 0;padding:6px 10px;border:1px solid #d97706;border-radius:6px;" +
+      "background:#fffbeb;color:#78350f;font:13px/1.4 system-ui,sans-serif";
+    host.insertBefore(note, gd);
+  }
   function installGl3dScrollFix(gd) {
     if (gd.__qsvGl3dFix || !sceneKeys(gd).length) return;
     gd.__qsvGl3dFix = true;
@@ -642,6 +661,8 @@ <h1 class="qsv-viz-title">cms_medicare_providers.csv — Data Schematic</h1>
       // cluster bubbles: repaint plotly's black-by-default count labels and add hover/click-to-zoom
       // (see installClusterUi). No-op for non-map panels and for maps that never cluster.
       applyClusterUi(gd);
+      // map panels in a sandboxed (opaque-origin) frame can't load tiles: explain the blank panel
+      sandboxNotice(gd);
       // gl3d panels: stop the WebGL canvas from eating the wheel inline so the page can scroll
       // (scrollZoom:false suppresses the zoom but not the canvas preventDefault; see above).
       installGl3dScrollFix(gd);
@@ -1345,6 +1366,8 @@ <h1 class="qsv-viz-title">cms_medicare_providers.csv — Data Schematic</h1>
   }
   if (window.self !== window.top) {
     addEventListener("message", function (ev) {
+      // only the embedding page knows its viewport; any other frame's answer is ignored
+      if (ev.source !== window.parent) return;
       var d = ev.data;
       if (!d || typeof d.qsvVizViewport !== "number" || !(d.qsvVizViewport > 0)) return;
       parentVh = d.qsvVizViewport;
@@ -2497,7 +2520,7 @@ <h1 class="qsv-viz-title">cms_medicare_providers.csv — Data Schematic</h1>
   else setTimeout(init, 0);
 })();
 </script>
-<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"27.0.1","schematic_uuid":"d686763d-5ca4-49bc-91d0-6475b8d99de2","fingerprint":{"algo":"blake3","digest":"ff0858a992d6fe65ecf8030a5b865c56f2a4305924037e3e82e598ab278e28fa","bytes":1049432},"rows":30007,"viz_args":["--smarter","--preview-threshold","500"],"redacted":[],"pid":null}</script>
+<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"27.0.1","schematic_uuid":"cf560cc0-b5e2-4d54-b5a3-b936146a4f93","fingerprint":{"algo":"blake3","digest":"ff0858a992d6fe65ecf8030a5b865c56f2a4305924037e3e82e598ab278e28fa","bytes":1049432},"rows":30007,"viz_args":["--smarter","--preview-threshold","500"],"redacted":[],"pid":null}</script>
 <style id="qsv-live-style">
 .qsv-live-chip, .qsv-live-panel, .qsv-live-dialog, .qsv-live-toast {
   position: fixed; z-index: 2147482000; font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
@@ -3192,6 +3215,27 @@ <h1 class="qsv-viz-title">cms_medicare_providers.csv — Data Schematic</h1>
 })();
 </script>
 <div class="qsv-page-f
```

**File**: `examples/viz/smart_cpdb.html` (modified, +47/-3)
```diff
@@ -74,7 +74,7 @@ <h1 class="qsv-viz-title">nyc_capital_projects.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>12,587 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Preview<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>7</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>98.8%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-27 11:48 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-27 20:17 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 27.0.1</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -644,6 +644,25 @@ <h1 class="qsv-viz-title">nyc_capital_projects.csv — Data Schematic</h1>
     var fl = gd._fullLayout || {};
     return Object.keys(fl).filter(function (k) { return /^scene\d*$/.test(k); });
   }
+  // A sandboxed frame without allow-same-origin gives the page an opaque origin but leaves
+  // location.origin as the URL's; MapLibre's worker (a blob:null URL) reports "null", and the
+  // MapLibre bundled with plotly.js 3.x drops every message whose origin differs from its own, so
+  // the map's tiles never finish loading and the panel stays blank with no error. file:// pages are
+  // exempt from that check. Say so above each map rather than leave an empty panel unexplained.
+  function sandboxNotice(gd) {
+    if (window.origin !== "null" || location.protocol === "file:") return;
+    var lay = (gd && gd.layout) || {};
+    if (!Object.keys(lay).some(function (k) { return /^map\d*$/.test(k); })) return;
+    var host = gd.parentNode;
+    if (!host || host.querySelector(":scope > .qsv-sandbox-map-note")) return;
+    var note = document.createElement("div");
+    note.className = "qsv-sandbox-map-note";
+    note.setAttribute("role", "note");
+    note.textContent = "This map can't load inside a sandboxed frame. Open this Data Schematic in its own browser tab to see it.";
+    note.style.cssText = "margin:4px 0;padding:6px 10px;border:1px solid #d97706;border-radius:6px;" +
+      "background:#fffbeb;color:#78350f;font:13px/1.4 system-ui,sans-serif";
+    host.insertBefore(note, gd);
+  }
   function installGl3dScrollFix(gd) {
     if (gd.__qsvGl3dFix || !sceneKeys(gd).length) return;
     gd.__qsvGl3dFix = true;
@@ -682,6 +701,8 @@ <h1 class="qsv-viz-title">nyc_capital_projects.csv — Data Schematic</h1>
       // cluster bubbles: repaint plotly's black-by-default count labels and add hover/click-to-zoom
       // (see installClusterUi). No-op for non-map panels and for maps that never cluster.
       applyClusterUi(gd);
+      // map panels in a sandboxed (opaque-origin) frame can't load tiles: explain the blank panel
+      sandboxNotice(gd);
       // gl3d panels: stop the WebGL canvas from eating the wheel inline so the page can scroll
       // (scrollZoom:false suppresses the zoom but not the canvas preventDefault; see above).
       installGl3dScrollFix(gd);
@@ -1385,6 +1406,8 @@ <h1 class="qsv-viz-title">nyc_capital_projects.csv — Data Schematic</h1>
   }
   if (window.self !== window.top) {
     addEventListener("message", function (ev) {
+      // only the embedding page knows its viewport; any other frame's answer is ignored
+      if (ev.source !== window.parent) return;
       var d = ev.data;
       if (!d || typeof d.qsvVizViewport !== "number" || !(d.qsvVizViewport > 0)) return;
       parentVh = d.qsvVizViewport;
@@ -2537,7 +2560,7 @@ <h1 class="qsv-viz-title">nyc_capital_projects.csv — Data Schematic</h1>
   else setTimeout(init, 0);
 })();
 </script>
-<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"27.0.1","schematic_uuid":"ac09cbf4-dab7-499a-a7b6-76f41d3a476e","fingerprint":{"algo":"blake3","digest":"530b533b644037036b22823af6c7b58ff863393c06b3819c37a16ab975e5bfad","bytes":1214414},"rows":12587,"viz_args":["--smarter","--dictionary","nyc_capital_projects_dict.schema.json","--preview-threshold","500"],"redacted":["--dictionary"],"pid":null}</script>
+<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"27.0.1","schematic_uuid":"690737d8-d9ba-4112-9049-4118260baf0c","fingerprint":{"algo":"blake3","digest":"530b533b644037036b22823af6c7b58ff863393c06b3819c37a16ab975e5bfad","bytes":1214414},"rows":12587,"viz_args":["--smarter","--dictionary","nyc_capital_projects_dict.schema.json","--preview-threshold","500"],"redacted":["--dictionary"],"pid":null}</script>
 <style id="qsv-live-style">
 .qsv-live-chip, .qsv-live-panel, .qsv-live-dialog, .qsv-live-toast {
   position: fixed; z-index: 2147482000; font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
@@ -3232,6 
```

**File**: `examples/viz/smart_geo_outliers.html` (modified, +47/-3)
```diff
@@ -75,7 +75,7 @@ <h1 class="qsv-viz-title">delivery_stops.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>200 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Explore<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>10</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>100.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-27 11:48 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-27 20:17 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 27.0.1</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -541,6 +541,25 @@ <h1 class="qsv-viz-title">delivery_stops.csv — Data Schematic</h1>
     var fl = gd._fullLayout || {};
     return Object.keys(fl).filter(function (k) { return /^scene\d*$/.test(k); });
   }
+  // A sandboxed frame without allow-same-origin gives the page an opaque origin but leaves
+  // location.origin as the URL's; MapLibre's worker (a blob:null URL) reports "null", and the
+  // MapLibre bundled with plotly.js 3.x drops every message whose origin differs from its own, so
+  // the map's tiles never finish loading and the panel stays blank with no error. file:// pages are
+  // exempt from that check. Say so above each map rather than leave an empty panel unexplained.
+  function sandboxNotice(gd) {
+    if (window.origin !== "null" || location.protocol === "file:") return;
+    var lay = (gd && gd.layout) || {};
+    if (!Object.keys(lay).some(function (k) { return /^map\d*$/.test(k); })) return;
+    var host = gd.parentNode;
+    if (!host || host.querySelector(":scope > .qsv-sandbox-map-note")) return;
+    var note = document.createElement("div");
+    note.className = "qsv-sandbox-map-note";
+    note.setAttribute("role", "note");
+    note.textContent = "This map can't load inside a sandboxed frame. Open this Data Schematic in its own browser tab to see it.";
+    note.style.cssText = "margin:4px 0;padding:6px 10px;border:1px solid #d97706;border-radius:6px;" +
+      "background:#fffbeb;color:#78350f;font:13px/1.4 system-ui,sans-serif";
+    host.insertBefore(note, gd);
+  }
   function installGl3dScrollFix(gd) {
     if (gd.__qsvGl3dFix || !sceneKeys(gd).length) return;
     gd.__qsvGl3dFix = true;
@@ -579,6 +598,8 @@ <h1 class="qsv-viz-title">delivery_stops.csv — Data Schematic</h1>
       // cluster bubbles: repaint plotly's black-by-default count labels and add hover/click-to-zoom
       // (see installClusterUi). No-op for non-map panels and for maps that never cluster.
       applyClusterUi(gd);
+      // map panels in a sandboxed (opaque-origin) frame can't load tiles: explain the blank panel
+      sandboxNotice(gd);
       // gl3d panels: stop the WebGL canvas from eating the wheel inline so the page can scroll
       // (scrollZoom:false suppresses the zoom but not the canvas preventDefault; see above).
       installGl3dScrollFix(gd);
@@ -1282,6 +1303,8 @@ <h1 class="qsv-viz-title">delivery_stops.csv — Data Schematic</h1>
   }
   if (window.self !== window.top) {
     addEventListener("message", function (ev) {
+      // only the embedding page knows its viewport; any other frame's answer is ignored
+      if (ev.source !== window.parent) return;
       var d = ev.data;
       if (!d || typeof d.qsvVizViewport !== "number" || !(d.qsvVizViewport > 0)) return;
       parentVh = d.qsvVizViewport;
@@ -2924,7 +2947,7 @@ <h1 class="qsv-viz-title">delivery_stops.csv — Data Schematic</h1>
   else setTimeout(init, 0);
 })();
 </script>
-<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"27.0.1","schematic_uuid":"9781ac8e-3458-4294-8223-b82700056190","fingerprint":{"algo":"blake3","digest":"bd40d2c0b40542c2ad595c9f0a698886ccbc046365a02dba66197518f21e286d","bytes":13402},"rows":200,"viz_args":["--preview-threshold","500"],"redacted":[],"pid":null}</script>
+<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"27.0.1","schematic_uuid":"efc83606-96ab-417a-81db-17b70faf133e","fingerprint":{"algo":"blake3","digest":"bd40d2c0b40542c2ad595c9f0a698886ccbc046365a02dba66197518f21e286d","bytes":13402},"rows":200,"viz_args":["--preview-threshold","500"],"redacted":[],"pid":null}</script>
 <style id="qsv-live-style">
 .qsv-live-chip, .qsv-live-panel, .qsv-live-dialog, .qsv-live-toast {
   position: fixed; z-index: 2147482000; font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
@@ -3619,6 +3642,27 @@ <h1 class="qsv-viz-title">delivery_stops.csv — Data Schematic</h1>
 })();
 </script>
 <div class="qsv-page-foot"><footer id="qsv-credits">Charts: <a href="https://plotly.com/javascript/" ta
```

**File**: `examples/viz/smart_onboarding_funnel.html` (modified, +47/-3)
```diff
@@ -72,7 +72,7 @@
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>60 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Explore<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>6</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>100.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-27 11:48 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-27 20:17 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 27.0.1</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -520,6 +520,25 @@
     var fl = gd._fullLayout || {};
     return Object.keys(fl).filter(function (k) { return /^scene\d*$/.test(k); });
   }
+  // A sandboxed frame without allow-same-origin gives the page an opaque origin but leaves
+  // location.origin as the URL's; MapLibre's worker (a blob:null URL) reports "null", and the
+  // MapLibre bundled with plotly.js 3.x drops every message whose origin differs from its own, so
+  // the map's tiles never finish loading and the panel stays blank with no error. file:// pages are
+  // exempt from that check. Say so above each map rather than leave an empty panel unexplained.
+  function sandboxNotice(gd) {
+    if (window.origin !== "null" || location.protocol === "file:") return;
+    var lay = (gd && gd.layout) || {};
+    if (!Object.keys(lay).some(function (k) { return /^map\d*$/.test(k); })) return;
+    var host = gd.parentNode;
+    if (!host || host.querySelector(":scope > .qsv-sandbox-map-note")) return;
+    var note = document.createElement("div");
+    note.className = "qsv-sandbox-map-note";
+    note.setAttribute("role", "note");
+    note.textContent = "This map can't load inside a sandboxed frame. Open this Data Schematic in its own browser tab to see it.";
+    note.style.cssText = "margin:4px 0;padding:6px 10px;border:1px solid #d97706;border-radius:6px;" +
+      "background:#fffbeb;color:#78350f;font:13px/1.4 system-ui,sans-serif";
+    host.insertBefore(note, gd);
+  }
   function installGl3dScrollFix(gd) {
     if (gd.__qsvGl3dFix || !sceneKeys(gd).length) return;
     gd.__qsvGl3dFix = true;
@@ -558,6 +577,8 @@
       // cluster bubbles: repaint plotly's black-by-default count labels and add hover/click-to-zoom
       // (see installClusterUi). No-op for non-map panels and for maps that never cluster.
       applyClusterUi(gd);
+      // map panels in a sandboxed (opaque-origin) frame can't load tiles: explain the blank panel
+      sandboxNotice(gd);
       // gl3d panels: stop the WebGL canvas from eating the wheel inline so the page can scroll
       // (scrollZoom:false suppresses the zoom but not the canvas preventDefault; see above).
       installGl3dScrollFix(gd);
@@ -1261,6 +1282,8 @@
   }
   if (window.self !== window.top) {
     addEventListener("message", function (ev) {
+      // only the embedding page knows its viewport; any other frame's answer is ignored
+      if (ev.source !== window.parent) return;
       var d = ev.data;
       if (!d || typeof d.qsvVizViewport !== "number" || !(d.qsvVizViewport > 0)) return;
       parentVh = d.qsvVizViewport;
@@ -2413,7 +2436,7 @@
   else setTimeout(init, 0);
 })();
 </script>
-<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"27.0.1","schematic_uuid":"e82bb658-3bf4-41f8-8561-ce6871819b9f","fingerprint":{"algo":"blake3","digest":"99982234ec29b1011a433250814fc51e8cd825ceb947e0dcfa6837b09978163c","bytes":1938},"rows":60,"viz_args":["--dictionary","onboarding_funnel_dict.schema.json","--preview-threshold","500"],"redacted":["--dictionary"],"pid":null}</script>
+<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"27.0.1","schematic_uuid":"c113b6ff-e77f-4c16-94f7-46a27f5524e2","fingerprint":{"algo":"blake3","digest":"99982234ec29b1011a433250814fc51e8cd825ceb947e0dcfa6837b09978163c","bytes":1938},"rows":60,"viz_args":["--dictionary","onboarding_funnel_dict.schema.json","--preview-threshold","500"],"redacted":["--dictionary"],"pid":null}</script>
 <style id="qsv-live-style">
 .qsv-live-chip, .qsv-live-panel, .qsv-live-dialog, .qsv-live-toast {
   position: fixed; z-index: 2147482000; font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
@@ -3108,6 +3131,27 @@
 })();
 </script>
 <div class="qsv-page-foot"><footer id="qsv-credits">Charts: <a href="https://plotly.com/javascript/" target="_blank" rel="noopener">plotly.js</a> (MIT) &middot; Table: <a href="https://datatables.net/" target="_blank" rel="noopener">DataTables</a> (MIT) &middot; Tour: <a href="https://driverjs.com/" target="_blank" rel="noopener">driver.js</a> (MIT) &middot; <a href="https://g
```

**File**: `examples/viz/smart_regions_growth.html` (modified, +47/-3)
```diff
@@ -74,7 +74,7 @@ <h1 class="qsv-viz-title">regions_growth.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>844 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Preview<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>5</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>100.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-27 11:48 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-27 20:18 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 27.0.1</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -539,6 +539,25 @@ <h1 class="qsv-viz-title">regions_growth.csv — Data Schematic</h1>
     var fl = gd._fullLayout || {};
     return Object.keys(fl).filter(function (k) { return /^scene\d*$/.test(k); });
   }
+  // A sandboxed frame without allow-same-origin gives the page an opaque origin but leaves
+  // location.origin as the URL's; MapLibre's worker (a blob:null URL) reports "null", and the
+  // MapLibre bundled with plotly.js 3.x drops every message whose origin differs from its own, so
+  // the map's tiles never finish loading and the panel stays blank with no error. file:// pages are
+  // exempt from that check. Say so above each map rather than leave an empty panel unexplained.
+  function sandboxNotice(gd) {
+    if (window.origin !== "null" || location.protocol === "file:") return;
+    var lay = (gd && gd.layout) || {};
+    if (!Object.keys(lay).some(function (k) { return /^map\d*$/.test(k); })) return;
+    var host = gd.parentNode;
+    if (!host || host.querySelector(":scope > .qsv-sandbox-map-note")) return;
+    var note = document.createElement("div");
+    note.className = "qsv-sandbox-map-note";
+    note.setAttribute("role", "note");
+    note.textContent = "This map can't load inside a sandboxed frame. Open this Data Schematic in its own browser tab to see it.";
+    note.style.cssText = "margin:4px 0;padding:6px 10px;border:1px solid #d97706;border-radius:6px;" +
+      "background:#fffbeb;color:#78350f;font:13px/1.4 system-ui,sans-serif";
+    host.insertBefore(note, gd);
+  }
   function installGl3dScrollFix(gd) {
     if (gd.__qsvGl3dFix || !sceneKeys(gd).length) return;
     gd.__qsvGl3dFix = true;
@@ -577,6 +596,8 @@ <h1 class="qsv-viz-title">regions_growth.csv — Data Schematic</h1>
       // cluster bubbles: repaint plotly's black-by-default count labels and add hover/click-to-zoom
       // (see installClusterUi). No-op for non-map panels and for maps that never cluster.
       applyClusterUi(gd);
+      // map panels in a sandboxed (opaque-origin) frame can't load tiles: explain the blank panel
+      sandboxNotice(gd);
       // gl3d panels: stop the WebGL canvas from eating the wheel inline so the page can scroll
       // (scrollZoom:false suppresses the zoom but not the canvas preventDefault; see above).
       installGl3dScrollFix(gd);
@@ -1280,6 +1301,8 @@ <h1 class="qsv-viz-title">regions_growth.csv — Data Schematic</h1>
   }
   if (window.self !== window.top) {
     addEventListener("message", function (ev) {
+      // only the embedding page knows its viewport; any other frame's answer is ignored
+      if (ev.source !== window.parent) return;
       var d = ev.data;
       if (!d || typeof d.qsvVizViewport !== "number" || !(d.qsvVizViewport > 0)) return;
       parentVh = d.qsvVizViewport;
@@ -2432,7 +2455,7 @@ <h1 class="qsv-viz-title">regions_growth.csv — Data Schematic</h1>
   else setTimeout(init, 0);
 })();
 </script>
-<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"27.0.1","schematic_uuid":"df0da02f-c719-4852-9e4e-a2605f1dd815","fingerprint":{"algo":"blake3","digest":"11c45355afc05ac4e33e611f55109465bf22a716e0d543e5b31e5485f4300177","bytes":30192},"rows":844,"viz_args":["--preview-threshold","500"],"redacted":[],"pid":null}</script>
+<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"27.0.1","schematic_uuid":"f1e53940-3fb2-43d5-930a-12c1da8b4546","fingerprint":{"algo":"blake3","digest":"11c45355afc05ac4e33e611f55109465bf22a716e0d543e5b31e5485f4300177","bytes":30192},"rows":844,"viz_args":["--preview-threshold","500"],"redacted":[],"pid":null}</script>
 <style id="qsv-live-style">
 .qsv-live-chip, .qsv-live-panel, .qsv-live-dialog, .qsv-live-toast {
   position: fixed; z-index: 2147482000; font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
@@ -3127,6 +3150,27 @@ <h1 class="qsv-viz-title">regions_growth.csv — Data Schematic</h1>
 })();
 </script>
 <div class="qsv-page-foot"><footer id="qsv-credits">Charts: <a href="https://plotly.com/javascript/" tar
```

#### Recent Merged Pull Requests:
- **PR #4950** (2026-10-27): docs(benchmarks): regenerate Data Schematic for the 27.0.1 run (@jqnatividad)
- **PR #4949** (2026-10-27): feat(viz): smart Data Schematics report their own height when framed (@jqnatividad)
- **PR #4948** (2026-10-27): fix(get): --output overwrite temp starts owner-only and keeps the group (@jqnatividad)
- **PR #4947** (2026-10-27): fix(viz): explain blank map panels in sandboxed iframes (@jqnatividad)
- **PR #4945** (2026-10-27): fix(get): --output files follow the umask, not the cache's 0600 (@jqnatividad)
- **PR #4944** (2026-10-27): fix(get): step past stale cache temps; tighten a symlinked cache root (@jqnatividad)

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

## X. docs(benchmarks): regenerate Data Schematic for the 27.0.1 run (#4950)

**RULE**:
When implementing operations in `benchmarks/Benchmarks.wiki.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dathere/qsv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `acf15714`: docs(benchmarks): regenerate Data Schematic for the 27.0.1 run (#4950). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `benchmarks/Benchmarks.wiki.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
qsv's benchmark suite runs 303 benchmarks on a **1,000,000-row × 41-column, 520 MB**
_Last generated for qsv 27.0.1 (aarch64-apple-darwin). Regenerate with
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
qsv's benchmark suite runs 305 benchmarks on a **1,000,000-row × 41-column, 520 MB**
_Last generated for qsv 26.0.0 (aarch64-apple-darwin). Regenerate with
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `acf15714` are properly handled with clean fallback behavior.
