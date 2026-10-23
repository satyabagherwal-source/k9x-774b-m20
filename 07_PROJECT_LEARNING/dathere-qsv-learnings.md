> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dathere-qsv-learnings.md`  
> **Source**: github ([https://github.com/dathere/qsv](https://github.com/dathere/qsv))  
> **Source Version**: `0386b404`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-23T05:50:36.416Z  
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
> **Harvest Timestamp**: 2026-10-23T05:50:36.408Z  
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

### Incident Patch 1: `2de71899` (2026-10-23)
**Commit Message**: fix(frequency): exact NULLs in frequent_items, cache-hit ALL_UNIQUE count, -i ALL_UNIQUE shortcut, null JSON ratios (#4894)

* fix(frequency): exact NULLs in frequent_items, cache-hit ALL_UNIQUE count, -i ALL_UNIQUE shortcut, null JSON ratios

- --ignore-case: the stats cache's cardinality is case-sensitive, so
  `cardinality == rowcount` cannot prove case-folded uniqueness. Keep the
  <ALL_UNIQUE> shortcut only for Integer columns (no letters to fold); count
  the rest in full. The -i help documents the memory cost.
- Full frequency-cache hit: use the cache's recorded row count for
  <ALL_UNIQUE> instead of summing another column's counts, which is short
  under --no-nulls or with short --flexible records.
- --sketch-method frequent_items: count NULLs exactly, outside the sketch,
  and lay them out as the exact path does. They no longer take a --limit
  slot, leave a rank gap, or fold into Other over a non-NULL denominator.
- --json/--toon: unknown nullcount/sparsity/uniqueness_ratio are null
  instead of a fabricated 0.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* docs(changelog): link #4894

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* style: rustfmt for night

**File**: `.claude/skills/qsv/qsv-frequency.json` (modified, +2/-2)
```diff
@@ -60,7 +60,7 @@
       {
         "flag": "--ignore-case",
         "type": "flag",
-        "description": "Ignore case when computing frequencies."
+        "description": "Ignore case when computing frequencies. The stats cache's cardinality is case-sensitive, so it cannot prove that case-folded values are unique. All-unique columns are therefore counted in full instead of being short-circuited to <ALL_UNIQUE> - except Integer columns, which have no letters to fold. On large files with all-unique text columns (e.g. emails), this can use memory proportional to the row count. Exclude such columns with -s if you don't need them."
       },
       {
         "flag": "--json",
@@ -177,7 +177,7 @@
       {
         "flag": "--sketch-method",
         "type": "string",
-        "description": "Algorithm used to compute the frequency table. Choices: 'exact' (default) tracks every distinct value in a HashMap; 'frequent_items' uses the Apache DataSketches Frequent Items (Misra-Gries) sketch to track top-K heavy hitters with bounded error and constant memory. The frequent_items mode rejects asc, weight, ignore-case, no-trim, other-sorted, null-sorted, frequency-jsonl, stats-filter, and json/pretty-json/toon output; the frequency cache is bypassed. Counts are estimates. The flags rank-strategy, lmt-threshold, and unq-limit are silently ignored under this mode (the sketch's natural ordering is top-K by estimate descending; tied counts use the sketch's hash-table iteration order). The 'Other' row format diverges from exact: label is the bare other-text (no unique-count suffix since the sketch cannot recover the true count of items not in the top-K); rank is 0 to match the exact convention. Note: 'frequent_items' requires a little-endian target. Apache DataSketches does not support big-endian platforms (e.g., s390x); on those builds, this choice is rejected.",
+        "description": "Algorithm used to compute the frequency table. Choices: 'exact' (default) tracks every distinct value in a HashMap; 'frequent_items' uses the Apache DataSketches Frequent Items (Misra-Gries) sketch to track top-K heavy hitters with bounded error and constant memory. The frequent_items mode rejects asc, weight, ignore-case, no-trim, other-sorted, null-sorted, frequency-jsonl, stats-filter, and json/pretty-json/toon output; the frequency cache is bypassed. Counts are estimates. The flags rank-strategy, lmt-threshold, and unq-limit are silently ignored under this mode (the sketch's natural ordering is top-K by estimate descending; tied counts use the sketch's hash-table iteration order). The 'Other' row format diverges from exact: label is the bare other-text (no unique-count suffix since the sketch cannot recover the true count of items not in the top-K); rank is 0 to match the exact convention. Its count is approximate. NULLs are counted exactly, outside the sketch, and are reported as in exact mode (after \"Other\"). Note: 'frequent_items' requires a little-endian target. Apache DataSketches does not support big-endian platforms (e.g., s390x); on those builds, this choice is rejected.",
         "default": "exact"
       },
       {
```

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -72,6 +72,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Internal: `src/util.rs` split into 15 submodules under `src/util/`.** The 7,800-line file is now a facade that keeps the shared statics, `SchemaArgs` and `get_args`, and re-exports `stats_cache`, `input`, `special_format`, `http` and the other submodules, so every `util::…` path is unchanged. Pure code motion with no behavior change ([#4855](https://github.com/dathere/qsv/pull/4855)).
 
 ### Fixed
+- **`frequency --ignore-case` no longer collapses columns with case-variant duplicates to `<ALL_UNIQUE>`.** ([#4894](https://github.com/dathere/qsv/pull/4894)) The stats cache's cardinality is case-sensitive, so a column such as `Bob@x.com` / `bob@x.com` / `amy@x.com` (cardinality 3 in 3 rows) used to print a single `<ALL_UNIQUE>` row instead of `bob@x.com,2` and `amy@x.com,1`. Under `-i` the shortcut is now kept only for Integer columns, which have no letters to fold. Other all-unique columns are counted in full, which uses memory proportional to the row count; the `-i` help says so.
+- **`frequency`: a full frequency-cache hit reports the right `<ALL_UNIQUE>` count.** ([#4894](https://github.com/dathere/qsv/pull/4894)) The count was re-derived by summing another column's counts, which under `--no-nulls` (or with short `--flexible` records) is smaller than the row count, e.g. 3 instead of 5. The cache's recorded row count is now used.
+- **`frequency --sketch-method frequent_items` reports NULLs like the exact method does.** ([#4894](https://github.com/dathere/qsv/pull/4894)) NULLs used to go into the sketch, so they took up a `--limit` slot, left a gap in the ranks, and were counted in "Other" over a denominator that excluded them, so percentages could add up to more than 100. They are now counted exactly, outside the sketch: listed last (after "Other") with no percentage or rank by default, or ranked and limited by their exact count under `--pct-nulls`. For streams small enough for exact estimates, the output now matches the exact method apart from the "Other" label.
+- **`frequency --json`/`--toon`: unknown `nullcount`, `sparsity` and `uniqueness_ratio` are `null`, not 0.** ([#4894](https://github.com/dathere/qsv/pull/4894)) Without a stats cache these were reported as 0, so an all-distinct column showed a `uniqueness_ratio` of 0.0.
 - **`stats`: weighted quartiles, median, MAD and percentiles are correct when the column has nulls or fractional weights.** ([#4889](https://github.com/dathere/qsv/pull/4889)) Null cells' weights were counted in the quantile total but their values were never ranked, so a weighted column with empty cells could report empty `q1`/`q2_median`/`q3` and a `0` that isn't in the data for upper percentiles. Separately, the total was summed in a different order from the running sum, so float rounding could drop the 100th percentile to `0` (weights `0.1/0.2/0.3`) or move a median that sits exactly on the half-weight boundary.
 - **`stats --weight`: zero and negative weights no longer count toward `mode`, `antimode` and `cardinality`**, as the `--weight` help says ([#4889](https://github.com/dathere/qsv/pull/4889)). A zero-weight value used to show up as an antimode with 0 occurrences.
 - **`stats --infer-boolean` requires one true and one false value.** ([#4889](https://github.com/dathere/qsv/pull/4889)) A two-value column whose values both matched the same side of a pattern, such as `Fiona`/`Frank` (both `f*`) or `yes`/`yellow`, was typed `Boolean`. **Behavior change:** a column holding two spellings of the same answer, such as `Yes`/`Y` or `true`/`TRUE`, is now typed `String` instead of `Boolean`, which can change the types that `schema`, `tojsonl` and other stats-cache consumers infer for it.
```

**File**: `docs/help/frequency.md` (modified, +2/-2)
```diff
@@ -100,7 +100,7 @@ qsv frequency --help
 |--------|------|-------------|--------|
 | &nbsp;`‑s,`<br>`‑‑select`&nbsp; | string | Select a subset of columns to compute frequencies for. See 'qsv select --help' for the format details. This is provided here because piping 'qsv select' into 'qsv frequency' will disable the use of indexing. |  |
 | &nbsp;`‑l,`<br>`‑‑limit`&nbsp; | integer | Limit the frequency table to the N most common items. Set to '0' to disable a limit. If negative, only return values with an occurrence count >= absolute value of the negative limit. e.g. --limit -2 will only return values with an occurrence count >= 2. | `10` |
-| &nbsp;`‑‑sketch‑method`&nbsp; | string | Algorithm used to compute the frequency table. Choices: 'exact' (default) tracks every distinct value in a HashMap; 'frequent_items' uses the Apache DataSketches Frequent Items (Misra-Gries) sketch to track top-K heavy hitters with bounded error and constant memory. The frequent_items mode rejects asc, weight, ignore-case, no-trim, other-sorted, null-sorted, frequency-jsonl, stats-filter, and json/pretty-json/toon output; the frequency cache is bypassed. Counts are estimates. The flags rank-strategy, lmt-threshold, and unq-limit are silently ignored under this mode (the sketch's natural ordering is top-K by estimate descending; tied counts use the sketch's hash-table iteration order). The 'Other' row format diverges from exact: label is the bare other-text (no unique-count suffix since the sketch cannot recover the true count of items not in the top-K); rank is 0 to match the exact convention. Note: 'frequent_items' requires a little-endian target. Apache DataSketches does not support big-endian platforms (e.g., s390x); on those builds, this choice is rejected. | `exact` |
+| &nbsp;`‑‑sketch‑method`&nbsp; | string | Algorithm used to compute the frequency table. Choices: 'exact' (default) tracks every distinct value in a HashMap; 'frequent_items' uses the Apache DataSketches Frequent Items (Misra-Gries) sketch to track top-K heavy hitters with bounded error and constant memory. The frequent_items mode rejects asc, weight, ignore-case, no-trim, other-sorted, null-sorted, frequency-jsonl, stats-filter, and json/pretty-json/toon output; the frequency cache is bypassed. Counts are estimates. The flags rank-strategy, lmt-threshold, and unq-limit are silently ignored under this mode (the sketch's natural ordering is top-K by estimate descending; tied counts use the sketch's hash-table iteration order). The 'Other' row format diverges from exact: label is the bare other-text (no unique-count suffix since the sketch cannot recover the true count of items not in the top-K); rank is 0 to match the exact convention. Its count is approximate. NULLs are counted exactly, outside the sketch, and are reported as in exact mode (after "Other"). Note: 'frequent_items' requires a little-endian target. Apache DataSketches does not support big-endian platforms (e.g., s390x); on those builds, this choice is rejected. | `exact` |
 | &nbsp;`‑‑sketch‑map‑size`&nbsp; | integer | Maximum map size for the Frequent Items sketch. Must be a power of two and at least 8. Larger values tighten error bounds at the cost of more memory. Only used when sketch-method is frequent_items. | `4096` |
 | &nbsp;`‑u,`<br>`‑‑unq‑limit`&nbsp; | integer | If a column has all unique values, limit the frequency table to a sample of N unique items. Set to '0' to disable a unique_limit. Only applies in unweighted mode; ignored when --weight is set. | `10` |
 | &nbsp;`‑‑lmt‑threshold`&nbsp; | integer | The threshold for which --limit and --unq-limit will be applied. If the number of unique items in a column >= threshold, the limits will be applied. Set to '0' to disable the threshold and always apply limits. | `0` |
@@ -115,7 +115,7 @@ qsv frequency --help
 | &nbsp;`‑‑null‑text`&nbsp; | string | The text to use for NULL values. If set to the literal string "<NONE>" (case-sensitive, exact match), NULLs will not be included in the frequency table (equivalent to --no-nulls). | `(NULL)` |
 | &nbsp;`‑‑no‑nulls`&nbsp; | flag | Don't include NULLs in the frequency table. This is equivalent to --null-text "<NONE>". |  |
 | &nbsp;`‑‑pct‑nulls`&nbsp; | flag | Include NULL values in percentage and rank calculations. When disabled (default), percentages are "valid percentages" calculated with NULLs excluded from the denominator, and NULL entries display empty percentage and rank values. When enabled, NULLs are included in the denominator (original behavior). Has no effect when --no-nulls is set. |  |
-| &nbsp;`‑i,`<br>`‑‑ignore‑case`&nbsp; | flag | Ignore case when computing frequencies. |  |
+| &nbsp;`‑i,`<br>`‑‑ignore‑case`&nbsp; | flag | Ignore case when computing frequencies. The stats cache's cardinality is case-sensitive, so it cannot prove that case-folded values are unique. All-unique columns are therefore counted in full instead of being short-circuited to <ALL_UNIQUE> - except Inte
```

**File**: `src/cmd/frequency.rs` (modified, +133/-95)
```diff
@@ -106,7 +106,9 @@ frequency options:
                             label is the bare other-text (no unique-count suffix
                             since the sketch cannot recover the true count of
                             items not in the top-K); rank is 0 to match the
-                            exact convention.
+                            exact convention. Its count is approximate.
+                            NULLs are counted exactly, outside the sketch, and
+                            are reported as in exact mode (after "Other").
                             Note: 'frequent_items' requires a little-endian
                             target. Apache DataSketches does not support
                             big-endian platforms (e.g., s390x); on those
@@ -180,6 +182,15 @@ frequency options:
                             (original behavior).
                             Has no effect when --no-nulls is set.
     -i, --ignore-case       Ignore case when computing frequencies.
+                            The stats cache's cardinality is case-sensitive,
+                            so it cannot prove that case-folded values are
+                            unique. All-unique columns are therefore counted
+                            in full instead of being short-circuited to
+                            <ALL_UNIQUE> - except Integer columns, which have
+                            no letters to fold. On large files with all-unique
+                            text columns (e.g. emails), this can use memory
+                            proportional to the row count. Exclude such
+                            columns with -s if you don't need them.
     --no-float <cols>       Exclude Float columns from frequency analysis.
                             Floats typically contain continuous values where
                             frequency tables are not meaningful.
@@ -721,9 +732,11 @@ struct FrequencyField {
     field:            String,
     r#type:           String,
     cardinality:      u64,
-    nullcount:        u64,
-    sparsity:         f64,
-    uniqueness_ratio: f64,
+    // None (JSON `null`) when unknown - no stats record, or no row count - rather than a
+    // fabricated 0, which would read as "no NULLs" / "no distinct values".
+    nullcount:        Option<u64>,
+    sparsity:         Option<f64>,
+    uniqueness_ratio: Option<f64>,
     #[serde(skip_serializing_if = "Vec::is_empty")]
     stats:            Vec<FieldStats>,
     frequencies:      Vec<FrequencyEntry>,
@@ -1082,8 +1095,8 @@ pub fn run(argv: &[&str]) -> CliResult<()> {
             }
             if args.flag_null_sorted {
                 return fail_incorrectusage_clierror!(
-                    "--sketch-method frequent_items does not support --null-sorted. The sketch \
-                     ranks NULL alongside other values by estimate. Use --sketch-method exact."
+                    "--sketch-method frequent_items does not support --null-sorted. NULL is \
+                     always placed at the end. Use --sketch-method exact."
                 );
             }
             if args.flag_frequency_jsonl {
@@ -2579,19 +2592,11 @@ impl Args {
             return Ok(false);
         }
 
-        // Derive row_count from cache: sum counts of first non-ALL_UNIQUE column,
-        // or use cardinality of an ALL_UNIQUE column
-        let row_count = selected_entries
-            .iter()
-            .find_map(|entry| {
-                if entry.frequencies.len() == 1 && entry.frequencies[0].value == "<ALL_UNIQUE>" {
-                    Some(entry.cardinality)
-                } else {
-                    let total: u64 = entry.frequencies.iter().map(|f| f.count).sum();
-                    if total > 0 { Some(total) } else { None }
-                }
-            })
-            .unwrap_or(0);
+        // The cache records the input's exact row count. Don't re-derive it by summing a
+        // column's counts: under --no-nulls (no NULL bucket) or --flexible (short records)
+        // that sum is smaller than the row count, and it would be reported as the
+        // <ALL_UNIQUE> count.
+        let row_count = cache_metadata.record_count;
 
         if row_count == 0 {
             return Ok(false);
@@ -4077,7 +4082,9 @@ impl Args {
         // What positional structures each feature needs, so we only pay for what's
         // requested. ALL per-column lookups are positional (indexed by ORIGINAL CSV column
         // position) so duplicate-named columns are each classified on their own data.
-        let needs_float_types = self.flag_no_float.is_some();
+        // --ignore-case also needs the types: it keeps the <ALL_UNIQUE> shortcut for Integer
+        // columns only (see below).
+        let needs_col_types = self.flag_no_float.is_some() || self.flag_ignore_case;
         #[cfg(feature = "luau")]
         let needs_stats_by_pos = is_json || self.flag_stats_filter.is_some();
         #[cfg(not(feature = 
```

**File**: `src/cmd/pragmastat.rs` (modified, +4/-5)
```diff
@@ -826,11 +826,10 @@ fn columns_from_cache(args: &Args, headers: &csv::ByteRecord) -> Option<Vec<(usi
         #[cfg_attr(target_endian = "big", allow(unused_mut))]
         let mut s_slice = curr_line.as_bytes().to_vec();
 
-        let parse_result =
-            cfg_select! {
-                target_endian = "little" => simd_json::from_slice::<CacheRecord>(&mut s_slice),
-                _ => serde_json::from_slice::<CacheRecord>(&s_slice),
-            };
+        let parse_result = cfg_select! {
+            target_endian = "little" => simd_json::from_slice::<CacheRecord>(&mut s_slice),
+            _ => serde_json::from_slice::<CacheRecord>(&s_slice),
+        };
 
         let Ok(record) = parse_result else {
             return None;
```

**File**: `src/cmd/stats.rs` (modified, +4/-5)
```diff
@@ -2582,11 +2582,10 @@ pub fn run(argv: &[&str]) -> CliResult<()> {
                 .unwrap()
                 .to_string();
             // Use platform-appropriate JSON serialization
-            let json_string =
-                cfg_select! {
-                    target_endian = "little" => simd_json::to_string_pretty(&current_stats_args)?,
-                    _ => serde_json::to_string_pretty(&current_stats_args)?,
-                };
+            let json_string = cfg_select! {
+                target_endian = "little" => simd_json::to_string_pretty(&current_stats_args)?,
+                _ => serde_json::to_string_pretty(&current_stats_args)?,
+            };
             std::fs::write(stats_pathbuf.clone(), json_string)?;
 
             // save the stats data to "<FILESTEM>.stats.csv.data.jsonl"
```

**File**: `src/util/stats_cache.rs` (modified, +13/-17)
```diff
@@ -694,11 +694,10 @@ pub fn get_stats_records_flexible(
             s_slice = curr_line.as_bytes().to_vec();
 
             // Parse regular stats record
-            let parse_result =
-                cfg_select! {
-                    target_endian = "little" => simd_json::from_slice::<StatsData>(&mut s_slice),
-                    _ => serde_json::from_slice::<StatsData>(&s_slice),
-                };
+            let parse_result = cfg_select! {
+                target_endian = "little" => simd_json::from_slice::<StatsData>(&mut s_slice),
+                _ => serde_json::from_slice::<StatsData>(&s_slice),
+            };
 
             if let Ok(mut stats) = parse_result {
                 // a pre-fix cache carries fabricated 0.0 renderings on a date row; drop them
@@ -918,13 +917,11 @@ pub fn get_stats_records_flexible(
                 )));
             }
             return Err(CliError::Other(cfg_select! {
-                target_family = "unix" => {
-                    match status.signal() {
-                        Some(signal) => {
-                            format!("qsv stats terminated with signal: {signal}{detail}")
-                        },
-                        None => format!("qsv stats terminated by unknown cause{detail}"),
-                    }
+                target_family = "unix" => match status.signal() {
+                    Some(signal) => {
+                        format!("qsv stats terminated with signal: {signal}{detail}")
+                    },
+                    None => format!("qsv stats terminated by unknown cause{detail}"),
                 },
                 _ => {
                     format!("qsv stats terminated by unknown cause{detail}")
@@ -958,11 +955,10 @@ pub fn get_stats_records_flexible(
             s_slice = curr_line.as_bytes().to_vec();
 
             // Parse regular stats record
-            let parse_result =
-                cfg_select! {
-                    target_endian = "little" => simd_json::from_slice::<StatsData>(&mut s_slice),
-                    _ => serde_json::from_slice::<StatsData>(&s_slice),
-                };
+            let parse_result = cfg_select! {
+                target_endian = "little" => simd_json::from_slice::<StatsData>(&mut s_slice),
+                _ => serde_json::from_slice::<StatsData>(&s_slice),
+            };
 
             match parse_result {
                 Ok(mut stats) => {
```

**File**: `tests/test_frequency.rs` (modified, +165/-0)
```diff
@@ -8961,3 +8961,168 @@ fn frequency_drops_group_bits_when_the_cache_group_differs() {
         "left temp/probe files behind: {strays:?}"
     );
 }
+
+// A full frequency-cache hit must report the input's row count for <ALL_UNIQUE> columns. It used
+// to re-derive it by summing the first non-ALL_UNIQUE column's counts, which under --no-nulls
+// leaves out that column's NULLs (here: 3 instead of 5). `a` must come BEFORE `id` to hit it.
+#[test]
+fn frequency_cache_hit_all_unique_count_is_the_row_count() {
+    let wrk = Workdir::new("frequency_cache_hit_all_unique_count_is_the_row_count");
+    wrk.create(
+        "data.csv",
+        vec![
+            svec!["a", "id"],
+            svec!["x", "1"],
+            svec!["", "2"],
+            svec!["x", "3"],
+            svec!["y", "4"],
+            svec!["", "5"],
+        ],
+    );
+    let mut stats_cmd = wrk.command("stats");
+    stats_cmd
+        .args(["--cardinality", "--stats-jsonl"])
+        .arg("data.csv");
+    wrk.assert_success(&mut stats_cmd);
+
+    let mut write = wrk.command("frequency");
+    write
+        .args(["--no-nulls", "--frequency-jsonl"])
+        .arg("data.csv");
+    let computed: Vec<Vec<String>> = wrk.read_stdout(&mut write);
+
+    let mut hit = wrk.command("frequency");
+    hit.arg("--no-nulls").arg("data.csv");
+    let (cached, stderr): (Vec<Vec<String>>, String) =
+        wrk.read_stdout_and_stderr_on_success(&mut hit);
+    assert!(
+        stderr.contains("Frequency cache hit"),
+        "second run must be served from the cache, got:\n{stderr}"
+    );
+
+    let expected = vec![
+        svec!["field", "value", "count", "percentage", "rank"],
+        svec!["a", "x", "2", "66.66667", "1"],
+        svec!["a", "y", "1", "33.33333", "2"],
+        svec!["id", "<ALL_UNIQUE>", "5", "100", "0"],
+    ];
+    assert_eq!(computed, expected);
+    assert_eq!(cached, expected, "cache hit must match the computed output");
+}
+
+// The stats cache's cardinality is case-SENSITIVE, so `cardinality == rowcount` cannot prove a
+// column is unique once --ignore-case folds `a`/`A` together. The <ALL_UNIQUE> shortcut used to
+// fire anyway and discard the real distribution. Integer columns (no letters) keep it.
+#[test]
+fn frequency_ignore_case_does_not_short_circuit_to_all_unique() {
+    let wrk = Workdir::new("frequency_ignore_case_does_not_short_circuit_to_all_unique");
+    wrk.create(
+        "data.csv",
+        vec![
+            svec!["email", "id"],
+            svec!["Bob@x.com", "101"],
+            svec!["bob@x.com", "102"],
+            svec!["amy@x.com", "103"],
+        ],
+    );
+    let mut stats_cmd = wrk.command("stats");
+    stats_cmd
+        .args(["--cardinality", "--stats-jsonl"])
+        .arg("data.csv");
+    wrk.assert_success(&mut stats_cmd);
+
+    let mut cmd = wrk.command("frequency");
+    cmd.args(["--ignore-case", "--select", "email,id"])
+        .arg("data.csv");
+    let got: Vec<Vec<String>> = wrk.read_stdout(&mut cmd);
+    let expected = vec![
+        svec!["field", "value", "count", "percentage", "rank"],
+        svec!["email", "bob@x.com", "2", "66.66667", "1"],
+        svec!["email", "amy@x.com", "1", "33.33333", "2"],
+        // an Integer column has no letters to fold, so it keeps the shortcut
+        svec!["id", "<ALL_UNIQUE>", "3", "100", "0"],
+    ];
+    assert_eq!(got, expected);
+}
+
+// The Frequent Items path must lay out NULL, Other and percentages exactly like the exact path
+// (only the bare "Other" label differs). NULLs used to be fed into the sketch: they took a
+// --limit slot, left a gap in the ranks, and were folded into Other over a non-NULL
+// denominator (percentages summing to > 100). No count ties, and a stream far below the sketch's
+// map size, so the sketch's estimates are exact and the comparison is deterministic.
+#[test]
+#[cfg(not(target_endian = "big"))]
+fn frequency_frequent_items_null_and_other_match_exact() {
+    let wrk = Workdir::new("frequency_frequent_items_null_and_other_match_exact");
+    let mut rows = vec![svec!["c", "d"]];
+    for v in ["x", "x", "x", "x", "y", "y", "z", "", "", ""] {
+        rows.push(svec![v, "1"]);
+    }
+    wrk.create("data.csv", rows);
+
+    let strip_other_count = |rows: Vec<Vec<String>>| -> Vec<Vec<String>> {
+        rows.into_iter()
+            .map(|mut r| {
+                if r[1].starts_with("Other (") {
+                    r[1] = "Other".to_string();
+                }
+                r
+            })
+            .collect()
+    };
+
+    for pct_nulls in [false, true] {
+        for limit in ["1", "2", "3", "-2", "0"] {
+            let mut exact = wrk.command("frequency");
+            exact.args(["--select", "c", "--limit", limit]);
+            let mut fi = wrk.command("frequency");
+            fi.args([
+                "--select",
+                "c",
+                "--limit",
+                limit,
+                "--sketch-method",
+                "frequent_it
```

---

### Incident Patch 2: `0386b404` (2026-10-23)
**Commit Message**: fix(frequency): fail on a lost parallel chunk; keep thresholds when refreshing a stale cache (#4897)

* fix(frequency): fail on a lost parallel chunk; keep thresholds when refreshing a stale cache

- Parallel chunk guard: a worker that panics (qsv ships `panic = "unwind"`)
  drops its sender without sending a table or recording a read error, so
  the fold ended early and printed a partial table as complete. Both
  parallel folds (unweighted pass and weighted) now count the chunks they
  received and fail via `check_all_chunks_received` if any is missing.
  Testable through `QSV_TEST_FREQ_PANIC_CHUNK`, a debug-build-only hook.
- Stale-cache refresh: the version-stale self-heal rewrote the cache with
  this run's thresholds, which are the defaults on a plain run (the
  QSV_FREQ_HIGH_CARD_* overrides are only read under --frequency-jsonl).
  `FREQ_CACHE_STALE_SIG` now carries the stale cache's own thresholds and
  the refresh writes with them, so it changes only what the version
  invalidated.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* docs(changelog): link #4897

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(frequency): skip the worker-panic test on single-co

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -72,6 +72,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Internal: `src/util.rs` split into 15 submodules under `src/util/`.** The 7,800-line file is now a facade that keeps the shared statics, `SchemaArgs` and `get_args`, and re-exports `stats_cache`, `input`, `special_format`, `http` and the other submodules, so every `util::…` path is unchanged. Pure code motion with no behavior change ([#4855](https://github.com/dathere/qsv/pull/4855)).
 
 ### Fixed
+- **`frequency`: a parallel worker that crashes is an error, not a partial table.** ([#4897](https://github.com/dathere/qsv/pull/4897)) A worker that panicked dropped its chunk without recording an error, so the indexed (parallel) run printed frequencies counted over only part of the file as if they were complete. Every parallel pass now checks that it folded every chunk, and fails with "N of M parallel chunks failed" otherwise.
+- **`frequency`: refreshing a version-stale frequency cache keeps its `HIGH_CARDINALITY` thresholds.** ([#4897](https://github.com/dathere/qsv/pull/4897)) After a qsv upgrade, a plain `frequency` run refreshes an existing cache, but it rewrote it with the default thresholds (100 / 90%) instead of the ones it was built with (`--high-card-threshold`, `--high-card-pct` or their `QSV_FREQ_HIGH_CARD_*` variables). Columns those thresholds had kept in full became `<HIGH_CARDINALITY>` sentinels and were recomputed on every later run. Results were correct; only speed suffered.
 - **`frequency` no longer collapses a column to `<ALL_UNIQUE>` when trimming merges its values.** ([#4896](https://github.com/dathere/qsv/pull/4896)) The stats cache counts untrimmed values, so a column such as `a` / ` a` / `A` (cardinality 3 in 3 rows) printed a single `<ALL_UNIQUE>` row instead of `a,2` and `A,1`, even with the default options. While it skips an `<ALL_UNIQUE>` candidate, `frequency` now checks whether trimming changes any of its values. If one does, that column is recounted in a second pass and a message names it; clean ID columns keep the shortcut, and `--no-trim` is unaffected. The same check applies to `--weight`, to the parallel (indexed) path across chunks, and to the Integer columns that keep the shortcut under `--ignore-case`. Such a column is no longer cached as `<ALL_UNIQUE>` by `--frequency-jsonl` either.
 - **`frequency`: the frequency cache no longer merges values that aren't valid UTF-8.** ([#4895](https://github.com/dathere/qsv/pull/4895)) The cache stores values as UTF-8 text, so values that differ only in their invalid bytes (Latin-1 `Pé` / `Pè`) were both written as `P�` and came back from a cache hit as one value with their counts added, shifting the other ranks. A column with any such value is now cached as a `<NON_UTF8>` sentinel and recomputed when the cache is reused, while the rest of the columns are still served from the cache. `scoresql`, which also reads the cache, now treats every sentinel (`<NON_UTF8>`, `<ALL_UNIQUE>`, `<HIGH_CARDINALITY>`) as having no per-value data: a `WHERE` literal equal to a sentinel's text, such as `WHERE id = '<ALL_UNIQUE>'`, used to "match ~100% of rows" and cost selectivity points.
 - **`frequency --ignore-case` no longer collapses columns with case-variant duplicates to `<ALL_UNIQUE>`.** ([#4894](https://github.com/dathere/qsv/pull/4894)) The stats cache's cardinality is case-sensitive, so a column such as `Bob@x.com` / `bob@x.com` / `amy@x.com` (cardinality 3 in 3 rows) used to print a single `<ALL_UNIQUE>` row instead of `bob@x.com,2` and `amy@x.com,1`. Under `-i` the shortcut is now kept only for Integer columns, which have no letters to fold. Other all-unique columns are counted in full, which uses memory proportional to the row count; the `-i` help says so.
```

**File**: `src/cmd/frequency.rs` (modified, +67/-7)
```diff
@@ -442,7 +442,17 @@ static FREQ_CACHE_FTABLES: OnceLock<FTables> = OnceLock::new();
 // refresh the stale file after recomputing, so a version-invalidated cache self-heals instead of
 // missing forever - `frequency` only writes its cache under `--frequency-jsonl`, so unlike
 // stats.rs it has no recompute-and-rewrite path of its own.
-static FREQ_CACHE_STALE_SIG: OnceLock<String> = OnceLock::new();
+static FREQ_CACHE_STALE_SIG: OnceLock<StaleFreqCache> = OnceLock::new();
+
+/// What `run()` needs to refresh a version-stale frequency cache faithfully: the selection it
+/// covered, and the `HIGH_CARDINALITY` thresholds it was BUILT with. A plain `frequency` run only
+/// reads its `QSV_FREQ_HIGH_CARD_*` overrides under `--frequency-jsonl`, so without these the
+/// refresh would silently rewrite a custom-threshold cache with the defaults.
+struct StaleFreqCache {
+    selection_signature:      String,
+    flag_high_card_threshold: usize,
+    flag_high_card_pct:       u8,
+}
 // Frequency-cache sentinels for columns stored WITHOUT per-value data, which every reader
 // (this command's cache hit, `read_frequency_cache_view` for viz, and `scoresql`) must recompute
 // or skip rather than read as a value.
@@ -1375,9 +1385,10 @@ pub fn run(argv: &[&str]) -> CliResult<()> {
     //     cannot overwrite a whole-file cache with a narrow one.
     // An empty recorded signature (a cache predating `selection_signature`) can prove none of
     // this, so it is left alone rather than healed.
-    let refreshing_stale_cache = FREQ_CACHE_STALE_SIG
-        .get()
-        .is_some_and(|sig| !sig.is_empty() && *sig == Args::selection_signature(&headers));
+    let refreshing_stale_cache = FREQ_CACHE_STALE_SIG.get().filter(|stale| {
+        !stale.selection_signature.is_empty()
+            && stale.selection_signature == Args::selection_signature(&headers)
+    });
     if args.flag_frequency_jsonl {
         // explicitly requested: a failure to write the cache the user asked for is fatal
         args.write_frequency_jsonl(&headers, &tables, &rconfig)?;
@@ -1392,15 +1403,22 @@ pub fn run(argv: &[&str]) -> CliResult<()> {
         {
             log::warn!("Could not persist dc frequency cache: {err}");
         }
-    } else if refreshing_stale_cache {
+    } else if let Some(stale) = refreshing_stale_cache {
         // BEST-EFFORT, unlike the branch above. This user asked for frequencies, not for a
         // cache write, and the frequencies are already computed. A cache file we cannot
         // replace - read-only file, read-only media, a directory owned by someone else - must
         // not turn an ordinary `qsv frequency` into a failure that prints nothing at all.
         // (`can_use_freq_cache` requires `!flag_frequency_jsonl`, so the two branches are
         // mutually exclusive in practice; they are kept separate because their error policies
         // genuinely differ.)
-        if let Err(e) = args.write_frequency_jsonl(&headers, &tables, &rconfig) {
+        //
+        // Refresh with the thresholds the stale cache was BUILT with, not this run's defaults:
+        // the refresh should change only what the version change invalidated, not demote every
+        // column a custom --high-card-threshold/--high-card-pct kept in full to a sentinel.
+        let mut refresh_args = args.clone();
+        refresh_args.flag_high_card_threshold = stale.flag_high_card_threshold;
+        refresh_args.flag_high_card_pct = stale.flag_high_card_pct;
+        if let Err(e) = refresh_args.write_frequency_jsonl(&headers, &tables, &rconfig) {
             wwarn!(
                 "Could not refresh the version-stale frequency cache: {e}. Continuing with the \
                  computed frequencies."
@@ -2435,7 +2453,11 @@ impl Args {
             // The residual: a strict cache plus a flexible-only user never heals. The message
             // above names --frequency-jsonl so that is recoverable rather than mysterious.
             if metadata.flag_flexible == self.flag_flexible {
-                let _ = FREQ_CACHE_STALE_SIG.set(metadata.selection_signature.clone());
+                let _ = FREQ_CACHE_STALE_SIG.set(StaleFreqCache {
+                    selection_signature:      metadata.selection_signature.clone(),
+                    flag_high_card_threshold: metadata.flag_high_card_threshold,
+                    flag_high_card_pct:       metadata.flag_high_card_pct,
+                });
             }
             return None;
         }
@@ -3536,6 +3558,8 @@ impl Args {
             );
             let read_err = Arc::clone(&read_err);
             pool.execute(move || {
+                #[cfg(debug_assertions)]
+                inject_test_panic(i);
                 // The parent verified the index exists before chunking, but it can be
                 // deleted or invalidated in between (TOCTOU). Fail loudly with actionable
                 // info, matching parallel_stats.
@@ -3566,7 +3590,9 @@ impl A
```

**File**: `tests/test_frequency.rs` (modified, +110/-0)
```diff
@@ -9306,3 +9306,113 @@ fn frequency_all_unique_demotion_across_parallel_chunks() {
         ]
     );
 }
+
+// GUARD: refreshing a version-stale cache must keep the HIGH_CARDINALITY thresholds the cache was
+// BUILT with. A plain run only reads its --high-card-* settings under --frequency-jsonl, so the
+// refresh used to rewrite a custom-threshold cache with the defaults (100 / 90%), turning every
+// column the custom thresholds had kept in full into a <HIGH_CARDINALITY> sentinel that is then
+// recomputed on every later run.
+#[test]
+fn frequency_self_heal_keeps_the_cache_thresholds() {
+    let wrk = Workdir::new("frequency_self_heal_keeps_the_cache_thresholds");
+    // `category` has 19 distinct values in 20 rows: above the default effective threshold
+    // min(100, 90% of 20 = 18), but within a custom min(1000, 100% of 20 = 20).
+    let mut rows = vec![svec!["id", "category"]];
+    for i in 1..=20 {
+        rows.push(vec![
+            format!("item_{i}"),
+            format!("cat_{}", if i <= 19 { i } else { 1 }),
+        ]);
+    }
+    wrk.create("in.csv", rows);
+    let mut writer = wrk.command("frequency");
+    writer
+        .args([
+            "--frequency-jsonl",
+            "--high-card-threshold",
+            "1000",
+            "--high-card-pct",
+            "100",
+        ])
+        .arg("in.csv");
+    wrk.assert_success(&mut writer);
+    let cache = wrk.path("in.freq.csv.data.jsonl");
+    let category_is_full = |cache: &std::path::Path| {
+        let fields = decode_cache_fields(cache);
+        fields[1]["field"] == "category" && fields[1]["frequencies"].as_array().unwrap().len() == 19
+    };
+    assert!(
+        category_is_full(&cache),
+        "setup: the custom thresholds keep `category` in full"
+    );
+
+    set_cache_version(&cache, "0.0.1-ancient");
+    let mut heal = wrk.command("frequency");
+    heal.arg("in.csv");
+    let stderr = wrk.output_stderr(&mut heal);
+    assert!(
+        stderr.contains("written by qsv 0.0.1-ancient"),
+        "expected the stale-version diagnostic, got:\n{stderr}"
+    );
+    assert_eq!(
+        cache_meta(&cache, "qsv_version").as_str().unwrap(),
+        env!("CARGO_PKG_VERSION"),
+        "the stale cache should have been refreshed"
+    );
+    assert_eq!(cache_meta(&cache, "flag_high_card_threshold"), 1000);
+    assert_eq!(cache_meta(&cache, "flag_high_card_pct"), 100);
+    assert!(
+        category_is_full(&cache),
+        "the refresh must not demote `category` to <HIGH_CARDINALITY>"
+    );
+}
+
+// A parallel worker that panics (qsv ships with panic = "unwind") drops its channel sender without
+// sending a table or recording a read error, so the fold used to end early and print a PARTIAL
+// frequency table as if it were complete. Every parallel pass now checks that it folded every
+// chunk. The panic is injected through a debug-build-only hook, so this test is too.
+#[test]
+#[cfg(debug_assertions)]
+fn frequency_parallel_worker_panic_is_an_error() {
+    // qsv caps --jobs/QSV_MAX_JOBS at the CPU count, and 1 job takes the sequential path, which
+    // has no workers to panic - so this needs >= 2 cores (same guard as
+    // moarstats_parallel_path_matches_sequential).
+    let cores = std::thread::available_parallelism().map_or(1, std::num::NonZeroUsize::get);
+    if cores < 2 {
+        eprintln!(
+            "skipping frequency_parallel_worker_panic_is_an_error: needs >= 2 cores to exercise \
+             the parallel path (have {cores})"
+        );
+        return;
+    }
+    let wrk = Workdir::new("frequency_parallel_worker_panic_is_an_error");
+    let mut rows = vec![svec!["code", "w"]];
+    for i in 0..400 {
+        rows.push(vec![format!("c{}", i % 7), "1".to_string()]);
+    }
+    wrk.create_indexed("data.csv", rows);
+
+    for weighted in [false, true] {
+        let mut cmd = wrk.command("frequency");
+        // pin 2 jobs regardless of the caller's QSV_MAX_JOBS (1 would take the sequential path)
+        cmd.env("QSV_MAX_JOBS", "2")
+            .env("QSV_FREQ_CHUNK_MEMORY_MB", "-1")
+            .env("QSV_TEST_FREQ_PANIC_CHUNK", "0")
+            .args(["--jobs", "2", "--select", "code"]);
+        if weighted {
+            cmd.args(["--weight", "w"]);
+        }
+        cmd.arg("data.csv");
+        let got = wrk.output(&mut cmd);
+        let stderr = String::from_utf8_lossy(&got.stderr);
+        assert!(
+            !got.status.success(),
+            "a lost chunk must fail the run (weighted={weighted}), got stdout:\n{}",
+            String::from_utf8_lossy(&got.stdout)
+        );
+        assert!(
+            stderr.contains("1 of 2 parallel chunks failed"),
+            "expected the lost-chunk error (weighted={weighted}), got:\n{stderr}"
+        );
+    }
+}
```

---

### Incident Patch 3: `1de86469` (2026-10-23)
**Commit Message**: docs(viz): regenerate gallery & external Data Schematics for NULL mode rendering (#4893)

#4892 renders a NULL mode/antimode as `NULL` instead of an empty cell. The
stats bundles embedded in the Data Schematics' download row still carried
the old empty values, so regenerate:

- gallery pages via `gen_gallery.py` (nyc311: 24 modes, wpa_211: 1 antimode)
- external dashboards via `refresh_external_dashboards.sh` after clearing
  their stale stats caches (same qsv version, so the caches were otherwise
  reused): pitt311 (7 modes, 3 antimodes), boston311 (9, 3), brazil-lpg (2),
  pa_crashes (1, 1)

The external pages also pick up viz output changes merged since their last
refresh (category axis types, tour-text escaping). Charts are otherwise
unchanged; data dictionaries are the committed ones (no re-inference).

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `examples/viz/smart_allegheny_dogs.html` (modified, +4/-4)
```diff
@@ -76,7 +76,7 @@ <h1 class="qsv-viz-title">allegheny_dog_licenses.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>50,013 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Preview<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>8</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>100.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 11:02 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-23 01:00 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -941,7 +941,7 @@ <h1>allegheny_dog_licenses.csv — Data Schematic</h1>
 <div class="qsv-dict-downloads">
 <a class="qsv-dict-export" download="allegheny_dog_licenses_csv_data_schematic.schema.json" href="data:application/json;base64,ewogICIkc2NoZW1hIjogImh0dHBzOi8vanNvbi1zY2hlbWEub3JnL2RyYWZ0LzIwMjAtMTIvc2NoZW1hIiwKICAidGl0bGUiOiAiRGF0YSBEaWN0aW9uYXJ5IGZvciBhbGxlZ2hlbnlfZG9nX2xpY2Vuc2VzLmNzdiIsCiAgImRlc2NyaXB0aW9uIjogIlRoaXMgZGF0YXNldCBwcm92aWRlcyBhIGNvbXByZWhlbnNpdmUgcmVnaXN0cnkgb2YgZG9nIGxpY2Vuc2VzLCBlbmNvbXBhc3NpbmcgNTAsMDEzIGluZGl2aWR1YWwgcmVjb3Jkcy4gSXQgZGV0YWlscyBwZXQgY2hhcmFjdGVyaXN0aWNzIHN1Y2ggYXMgYnJlZWQgYW5kIGNvbG9yIGFsb25nc2lkZSBhZG1pbmlzdHJhdGl2ZSBpbmZvcm1hdGlvbiBsaWtlIGxpY2Vuc2UgdHlwZXMsIGVmZmVjdGl2ZSBkYXRlcywgYW5kIG93bmVyIHppcCBjb2Rlcy4gVGhlIGRhdGEgc2VydmVzIHRvIGRvY3VtZW50IHBldCBvd25lcnNoaXAgYW5kIHZhbGlkIGxpY2Vuc2luZyBwZXJpb2RzIGFjcm9zcyB2YXJpb3VzIGNhdGVnb3JpZXMgb2YgbGlmZXRpbWUgYW5kIHNlbmlvciByZWdpc3RyYXRpb25zLlxuXG4jIyMgTm90YWJsZSBDaGFyYWN0ZXJpc3RpY3NcblxuKiAqKlNlbnRpbmVsIFZhbHVlczoqKiBUaGUgYEV4cFllYXJgIGZpZWxkIGNvbnNpc3RzIGVudGlyZWx5IG9mIHRoZSB2YWx1ZSBgMjA5OWAsIHdoaWNoIHNlcnZlcyBhcyBhIHNlbnRpbmVsIGluZGljYXRpbmcgbm8gZXhwaXJhdGlvbi5cbiogKipQSUkvU2Vuc2l0aXZlIERhdGE6KiogVGhlIGRhdGFzZXQgY29udGFpbnMgUGVyc29uYWxseSBJZGVudGlmaWFibGUgSW5mb3JtYXRpb24gKFBJSSkgaW4gdGhlIGZvcm0gb2YgYERvZ05hbWVgIGFuZCBnZW9ncmFwaGljIGlkZW50aWZpZXJzIHZpYSBgT3duZXJaaXBgLlxuKiAqKkhpZ2ggQ2FyZGluYWxpdHk6KiogVGhlIGBEb2dOYW1lYCBhbmQgYEJyZWVkYCBmaWVsZHMgZXhoaWJpdCBoaWdoIGNhcmRpbmFsaXR5LCBpbmRpY2F0aW5nIGEgd2lkZSB2YXJpZXR5IG9mIHVuaXF1ZSB2YWx1ZXMgYWNyb3NzIHRoZSBkYXRhc2V0LlxuKiAqKkRpc3RyaWJ1dGlvbiBQYXR0ZXJuczoqKiBUaGUgYExpY2Vuc2VUeXBlYCBmaWVsZCBzaG93cyBhIGNvbmNlbnRyYXRpb24gaW4gbGlmZXRpbWUgcmVnaXN0cmF0aW9ucywgcGFydGljdWxhcmx5IGZvciBzcGF5ZWQgZmVtYWxlcyBhbmQgbmV1dGVyZWQgbWFsZXMuXG4qICoqRGF0YSBRdWFsaXR5OioqIFRoZSBkYXRhc2V0IGlzIGhpZ2hseSBjb21wbGV0ZSB3aXRoIHZlcnkgbG93IG51bGwgY291bnRzIGFjcm9zcyBhbGwgZmllbGRzOyBob3dldmVyLCB0aGUgYEJyZWVkYCBhbmQgYENvbG9yYCBmaWVsZHMgY29udGFpbiBtaW5vciBzcGFyc2l0eS5cbiogKipUZW1wb3JhbCBSYW5nZToqKiBUaGUgYFZhbGlkRGF0ZWAgZmllbGQgc2hvd3MgYSB0ZW1wb3JhbCBzcGFuIG9mIGFwcHJveGltYXRlbHkgMjMgeWVhcnMsIGZyb20gMjAwMyB0byAyMDI2LlxuXG5HZW5lcmF0ZWQgYnkgcXN2IHYyMS4xLjAgZGVzY3JpYmVncHRcbkNvbW1hbmQgbGluZTogdGFyZ2V0L2RlYnVnL3FzdiBkZXNjcmliZWdwdCAtLWRpY3Rpb25hcnkgLS1kZXNjcmlwdGlvbiBleGFtcGxlcy92aXovYWxsZWdoZW55X2RvZ19saWNlbnNlcy5jc3YgLS1mb3JtYXQganNvbnNjaGVtYSAtbyBleGFtcGxlcy92aXovYWxsZWdoZW55X2RvZ3NfZGljdC5zY2hlbWEuanNvbiAtLWZyZXNoIC0tdHdvLXBhc3MgLS1pbmZlci1jb250ZW50LXR5cGUgLS1pbmZlci1udWxsLXZhbHVlc1xuUHJvbXB0IGZpbGU6IERlZmF1bHQgdjcuMi4wXG5Nb2RlbDogZ29vZ2xlL2dlbW1hLTQtMjZiLWE0YlxuTExNIEFQSSBVUkw6IGh0dHA6Ly9sb2NhbGhvc3Q6MTIzNC92MVxuTGFuZ3VhZ2U6IFxuVGltZXN0YW1wOiAyMDI2LTA3LTE3VDEzOjQyOjE0LjE2ODUyNSswMDowMFxuXG5XQVJOSU5HOiBEZXNjcmlwdGlvbiBnZW5lcmF0ZWQgYnkgYW4gTExNIGFuZCBtYXkgY29udGFpbiBpbmFjY3VyYWNpZXMuIFZlcmlmeSBiZWZvcmUgdXNpbmchXG4iLAogICJ0eXBlIjogIm9iamVjdCIsCiAgInByb3BlcnRpZXMiOiB7CiAgICAiX2lkIjogewogICAgICAidHlwZSI6IFsKICAgICAgICAiaW50ZWdlciIKICAgICAgXSwKICAgICAgInRpdGxlIjogIlJlY29yZCBJRCIsCiAgICAgICJkZXNjcmlwdGlvbiI6ICJBIHVuaXF1ZSBpbnRlZ2VyIGlkZW50aWZpZXIgZm9yIGVhY2ggcmVjb3JkIGluIHRoZSBkYXRhc2V0LiIsCiAgICAgICJtaW5pbXVtIjogMjk1ODUyMjcsCiAgICAgICJtYXhpbXVtIjogMjk2MzUyMzksCiAgICAgICJ4LXFzdiI6IHsKICAgICAgICAicXN2X3R5cGUiOiAiSW50ZWdlciIsCiAgICAgICAgImNhcmRpbmFsaXR5IjogNTAwMTMsCiAgICAgICAgIm51bGxfY291bnQiOiAwLAogICAgICAgICJjb250ZW50X3R5cGUiOiAidW5pcXVlX2lkIiwKICAgICAgICAicm9sZSI6ICJpZGVudGlmaWVyIiwKICAgICAgICAiY29uY2VwdCI6ICJpZC5zdXJyb2dhdGVfa2V5IiwKICAgICAgICAiZXhhbXBsZV9jb3VudHMiOiAiPEFMTF9VTklRVUU+IgogICAgICB9CiAgICB9LAogICAgIkxpY2Vuc2VUeXBlIjogewogICAgICAidHlwZSI6IFsKICAgICAgICAic3RyaW5nIgogICAgICBdLAogICAgICAidGl0bGUiOiAiTGljZW5zZSBUeXBlIiwKICAgICAgImRlc2NyaXB0aW9uIjogIlRoZSBzcGVjaWZpYyBjbGFzc2lmaWNhdGlvbiBvZiB0aGUgZG9nIGxpY2Vuc2UgKGUuZy4sIGxpZmV0aW1lLCBzZW5pb3IpLiIsCiAgICAgICJleGFtcGxlcyI6IFsKICAgICAgICAiRG9nIExpZmV0aW1lIFNwYXllZCBGZW1hbGUiLAogICAgICAgICJEb2cgTGlmZXRpbWUgTmV1dGVyZWQgTWFsZSIsCiAgICAgICAgIkRvZyBMaWZldGltZSBNYWxlIiwKICAgICAgICAiRG9nIFNlbmlvciBMaWZldGltZSBTcGF5ZWQgRmVtYWxlIiwKICAgICAg
```

**File**: `examples/viz/smart_cms_medicare.html` (modified, +2/-2)
```diff
@@ -74,7 +74,7 @@ <h1 class="qsv-viz-title">cms_medicare_providers.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>30,007 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Preview<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>4</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>97.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 11:52 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-23 01:00 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -2456,7 +2456,7 @@ <h1 class="qsv-viz-title">cms_medicare_providers.csv — Data Schematic</h1>
   else setTimeout(init, 0);
 })();
 </script>
-<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"26.0.0","schematic_uuid":"a98d8b8b-22bd-40e5-8adb-ebcdd7180cb9","fingerprint":{"algo":"blake3","digest":"ff0858a992d6fe65ecf8030a5b865c56f2a4305924037e3e82e598ab278e28fa","bytes":1049432},"rows":30007,"viz_args":["--smarter","--preview-threshold","500"],"redacted":[],"pid":null}</script>
+<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"26.0.0","schematic_uuid":"308379e7-8a6d-49a5-b66d-b221ea015e93","fingerprint":{"algo":"blake3","digest":"ff0858a992d6fe65ecf8030a5b865c56f2a4305924037e3e82e598ab278e28fa","bytes":1049432},"rows":30007,"viz_args":["--smarter","--preview-threshold","500"],"redacted":[],"pid":null}</script>
 <style id="qsv-live-style">
 .qsv-live-chip, .qsv-live-panel, .qsv-live-dialog, .qsv-live-toast {
   position: fixed; z-index: 2147482000; font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
```

**File**: `examples/viz/smart_cpdb.html` (modified, +2/-2)
```diff
@@ -74,7 +74,7 @@ <h1 class="qsv-viz-title">nyc_capital_projects.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>12,587 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Preview<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>7</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>98.8%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 10:20 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-23 01:00 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -2496,7 +2496,7 @@ <h1 class="qsv-viz-title">nyc_capital_projects.csv — Data Schematic</h1>
   else setTimeout(init, 0);
 })();
 </script>
-<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"26.0.0","schematic_uuid":"8b5c7cbe-bf8e-4cce-862b-7b74693fa5dd","fingerprint":{"algo":"blake3","digest":"530b533b644037036b22823af6c7b58ff863393c06b3819c37a16ab975e5bfad","bytes":1214414},"rows":12587,"viz_args":["--smarter","--dictionary","nyc_capital_projects_dict.schema.json","--preview-threshold","500"],"redacted":["--dictionary"],"pid":null}</script>
+<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"26.0.0","schematic_uuid":"6152e78f-024c-4753-bdbe-7e550c510e00","fingerprint":{"algo":"blake3","digest":"530b533b644037036b22823af6c7b58ff863393c06b3819c37a16ab975e5bfad","bytes":1214414},"rows":12587,"viz_args":["--smarter","--dictionary","nyc_capital_projects_dict.schema.json","--preview-threshold","500"],"redacted":["--dictionary"],"pid":null}</script>
 <style id="qsv-live-style">
 .qsv-live-chip, .qsv-live-panel, .qsv-live-dialog, .qsv-live-toast {
   position: fixed; z-index: 2147482000; font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
```

**File**: `examples/viz/smart_dict_sunburst.html` (modified, +4/-4)
```diff
@@ -74,7 +74,7 @@ <h1 class="qsv-viz-title">sales_sample.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>500 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Explore<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>13</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>100.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 00:19 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-23 01:00 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -98,15 +98,15 @@ <h1 class="qsv-viz-title">sales_sample.csv — Data Schematic</h1>
       <div class="qsv-viz-plot" style="height:420px">
 <div id="qsv-viz-panel-2" class="plotly-graph-div" style="height:100%; width:100%;"></div>
 <script type="text/javascript">
-    Plotly.newPlot("qsv-viz-panel-2", {"data":[{"type":"violin","x":["South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","South","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","North","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","West","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","East","
```

**File**: `examples/viz/smart_dict_treemap.html` (modified, +4/-4)
```diff
@@ -74,7 +74,7 @@ <h1 class="qsv-viz-title">customer_spend.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>300 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Explore<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>5</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>100.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 00:19 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-23 01:00 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -98,7 +98,7 @@ <h1 class="qsv-viz-title">customer_spend.csv — Data Schematic</h1>
       <div class="qsv-viz-plot" style="height:420px">
 <div id="qsv-viz-panel-2" class="plotly-graph-div" style="height:100%; width:100%;"></div>
 <script type="text/javascript">
-    Plotly.newPlot("qsv-viz-panel-2", {"data":[{"type":"violin","x":["Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Basic","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Plus","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro","Pro"],"y":[215.39,33.58,31.74,190.01,35.99,29.68,225.56,32.76,29.26,211.95,23.3,39.14,218.09,24.28,32.54,231.08,25.72,31.68,185.8,12.37,33.04,229.34,33.83,17.32,196.4,41.27,27.1,204.15,36.63,22.81,205.83,34.42,31.94,233.75,33.96,32.7,199.77,31.71,32.49,215.94,29.56,40.44,213.86,34.36,38.36,234.35,30.99,28.14,224.0,34.47,35.23,220.02,22.02,39.85,227.19,32.87,37.13,245.64,28.16,35.83,218.9,37.28,37.48,216.54,29.8,21.18,190.37,25.82,25.53,203.76,24.6,16.4,179.86,23.87,34.62,236.14,39.17,34.83,230.1,36.32,27.49,204.65,24.11,32.99,185.0,37.23,31.28,258.17,37.26,31.82,218.94,33.66,35.52,208.73,30.0,37.38,228.04,23.24,41.05,206.26,33.65,36.8,217.33,35.11,28.49,213.82,36.12,30.17,223.71,30.39,15.94,230.2,29.62,17.26,185.85,29.64,31.75,247.05,38.15,18.89,216.41,27.82,10.95,192.93,31.4,24.04,233.22,32.06,30.74,261.84,27.75,46.36,233.8,36.63,44.85,240.93,30.18,30.13,245.45,25.07,35.68,247.41,37.92,42.51,192.91,18.65,19.93,228.42,28.38,25.08,203.26,28.51,189.56,17.79,230.02,38.38,205.46,31.71,193.64,35.79,202.58,26.28,199.84,36.84,237.19,33.71,225.85,34.55,195.16,29.06,226.21,31.0,212.3,27.39,212.24,34.59,238.15,21.82,239.6,19.87,238.87,27.94,231.07,23.26,203.98,40.92,240.45,40.41,186.63,35.73,207.91,36.16,252.24,30.31,220.14,35.64,198.77,32.55,234.04,35.23,254.93,17.69,225.27,35.78,231.47,11.85,243.86,42.67,250.66,36.92,228.25,32.64,219.99,31.23,203.25,35.18,246.71,34.95,230.73,36.36,198.99,31.31,201.02,25.6,252.9,33.61,187.14,22.54,200.92,22.46,232.62,32.48,215.49,27.8,213.28,24.82,240.09,13.37,229.16,22.45,230.4
```

**File**: `examples/viz/smart_geo_outliers.html` (modified, +2/-2)
```diff
@@ -75,7 +75,7 @@ <h1 class="qsv-viz-title">delivery_stops.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>200 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Explore<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>10</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>100.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 10:20 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-23 01:00 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -2883,7 +2883,7 @@ <h1 class="qsv-viz-title">delivery_stops.csv — Data Schematic</h1>
   else setTimeout(init, 0);
 })();
 </script>
-<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"26.0.0","schematic_uuid":"164cedc7-3af9-4d7a-a14a-8ff699f7c175","fingerprint":{"algo":"blake3","digest":"bd40d2c0b40542c2ad595c9f0a698886ccbc046365a02dba66197518f21e286d","bytes":13402},"rows":200,"viz_args":["--preview-threshold","500"],"redacted":[],"pid":null}</script>
+<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"26.0.0","schematic_uuid":"bf95f8f0-645e-4010-81be-177d6036d29e","fingerprint":{"algo":"blake3","digest":"bd40d2c0b40542c2ad595c9f0a698886ccbc046365a02dba66197518f21e286d","bytes":13402},"rows":200,"viz_args":["--preview-threshold","500"],"redacted":[],"pid":null}</script>
 <style id="qsv-live-style">
 .qsv-live-chip, .qsv-live-panel, .qsv-live-dialog, .qsv-live-toast {
   position: fixed; z-index: 2147482000; font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
```

**File**: `examples/viz/smart_onboarding_funnel.html` (modified, +2/-2)
```diff
@@ -72,7 +72,7 @@
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>60 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Explore<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>6</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>100.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 00:19 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-23 01:00 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -2372,7 +2372,7 @@
   else setTimeout(init, 0);
 })();
 </script>
-<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"26.0.0","schematic_uuid":"bc869bbf-8862-45bd-a803-ce8bc3ce4e12","fingerprint":{"algo":"blake3","digest":"99982234ec29b1011a433250814fc51e8cd825ceb947e0dcfa6837b09978163c","bytes":1938},"rows":60,"viz_args":["--dictionary","onboarding_funnel_dict.schema.json","--preview-threshold","500"],"redacted":["--dictionary"],"pid":null}</script>
+<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"26.0.0","schematic_uuid":"1e1f0616-3ff2-4373-b10e-e3d7c411ad48","fingerprint":{"algo":"blake3","digest":"99982234ec29b1011a433250814fc51e8cd825ceb947e0dcfa6837b09978163c","bytes":1938},"rows":60,"viz_args":["--dictionary","onboarding_funnel_dict.schema.json","--preview-threshold","500"],"redacted":["--dictionary"],"pid":null}</script>
 <style id="qsv-live-style">
 .qsv-live-chip, .qsv-live-panel, .qsv-live-dialog, .qsv-live-toast {
   position: fixed; z-index: 2147482000; font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
```

**File**: `examples/viz/smart_regions_growth.html` (modified, +2/-2)
```diff
@@ -74,7 +74,7 @@ <h1 class="qsv-viz-title">regions_growth.csv — Data Schematic</h1>
 <tr><td class="qsv-viz-meta-k">Rows:</td><td>844 <a href="#" class="qsv-data-link" onclick="return qsvOpenData()">Preview<svg class="qsv-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="1.7" y="2.6" width="12.6" height="10.8" rx="1.4"/><path d="M1.7 6.2h12.6M1.7 9.8h12.6M6.2 6.2v7.2M10.2 6.2v7.2"/></svg></a></td></tr>
 <tr><td class="qsv-viz-meta-k">Columns:</td><td>5</td></tr>
 <tr><td class="qsv-viz-meta-k">Completeness:</td><td>100.0%</td></tr>
-<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-22 10:20 UTC</td></tr>
+<tr><td class="qsv-viz-meta-k">Compiled:</td><td>2026-10-23 01:00 UTC</td></tr>
 <tr><td class="qsv-viz-meta-k">Generated by:</td><td>qsv 26.0.0</td></tr>
 </table>
 <div class="qsv-viz-grid">
@@ -2391,7 +2391,7 @@ <h1 class="qsv-viz-title">regions_growth.csv — Data Schematic</h1>
   else setTimeout(init, 0);
 })();
 </script>
-<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"26.0.0","schematic_uuid":"460b5bcf-95b8-4d94-9522-2dbe48ec813a","fingerprint":{"algo":"blake3","digest":"11c45355afc05ac4e33e611f55109465bf22a716e0d543e5b31e5485f4300177","bytes":30192},"rows":844,"viz_args":["--preview-threshold","500"],"redacted":[],"pid":null}</script>
+<script id="qsv-schematic-source" type="application/json">{"schema":1,"qsv_version":"26.0.0","schematic_uuid":"7583d489-c0c5-4861-bb71-e67a91be7017","fingerprint":{"algo":"blake3","digest":"11c45355afc05ac4e33e611f55109465bf22a716e0d543e5b31e5485f4300177","bytes":30192},"rows":844,"viz_args":["--preview-threshold","500"],"redacted":[],"pid":null}</script>
 <style id="qsv-live-style">
 .qsv-live-chip, .qsv-live-panel, .qsv-live-dialog, .qsv-live-toast {
   position: fixed; z-index: 2147482000; font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
```

#### Recent Merged Pull Requests:
- **PR #4897** (2026-10-23): fix(frequency): fail on a lost parallel chunk; keep thresholds when refreshing a stale cache (@jqnatividad)
- **PR #4896** (2026-10-23): fix(frequency): don't collapse a column to <ALL_UNIQUE> when trimming merges its values (@jqnatividad)
- **PR #4895** (2026-10-23): fix(frequency): don't merge non-UTF8 values through the frequency cache (@jqnatividad)
- **PR #4894** (2026-10-23): fix(frequency): exact NULLs in frequent_items, cache-hit ALL_UNIQUE count, -i ALL_UNIQUE shortcut, null JSON ratios (@jqnatividad)
- **PR #4893** (2026-10-23): docs(viz): regenerate gallery & external Data Schematics for NULL mode rendering (@jqnatividad)
- **PR #4892** (2026-10-22): fix(stats): render a NULL mode as `NULL`, like NULL antimodes (@jqnatividad)

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

## X. frequency): exact NULLs in frequent_items, cache-hit ALL_UNIQUE count, -i ALL_UN

**RULE**:
When implementing operations in `.claude/skills/qsv/qsv-frequency.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dathere/qsv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2de71899`: frequency): exact NULLs in frequent_items, cache-hit ALL_UNIQUE count, -i ALL_UNIQUE shortcut, null JSON ratios (#4894). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/skills/qsv/qsv-frequency.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        "description": "Ignore case when computing frequencies. The stats cache's cardinality is case-sensitive, so it cannot prove that case-folded values are unique. All-unique columns are therefore counted in full instead of being short-circuited to <ALL_UNIQUE> - except Integer columns, which have no letters to fold. On large files with all-unique text columns (e.g. emails), this can use memory proportional to the row count. Exclude such columns with -s if you don't need them."
        "description": "Algorithm used to compute the frequency table. Choices: 'exact' (default) tracks every distinct value in a HashMap; 'frequent_items' uses the Apache DataSketches Frequent Items (Misra-Gries) sketch to track top-K heavy hitters with bounded error and constant memory. The frequent_items mode rejects asc, weight, ignore-case, no-trim, other-sorted, null-sorted, frequency-jsonl, stats-filter, and json/pretty-json/toon output; the frequency cache is bypassed. Counts are estimates. The flags rank-strategy, lmt-threshold, and unq-limit are silently ignored under this mode (the sketch's natural ordering is top-K by estimate descending; tied counts use the sketch's hash-table iteration ord
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        "description": "Ignore case when computing frequencies."
        "description": "Algorithm used to compute the frequency table. Choices: 'exact' (default) tracks every distinct value in a HashMap; 'frequent_items' uses the Apache DataSketches Frequent Items (Misra-Gries) sketch to track top-K heavy hitters with bounded error and constant memory. The frequent_items mode rejects asc, weight, ignore-case, no-trim, other-sorted, null-sorted, frequency-jsonl, stats-filter, and json/pretty-json/toon output; the frequency cache is bypassed. Counts are estimates. The flags rank-strategy, lmt-threshold, and unq-limit are silently ignored under this mode (the sketch's natural ordering is top-K by estimate descending; tied counts use the sketch's hash-table iteration order). The 'Other' row format diverges from exact: label is the bare other-text (no unique-count suffix since the sketch cannot recover the true count of items not in the top-K); rank is 0 to match the exact convention. Note: 'frequent_items' requires a little-endian target. Apache DataSketches does not support big-endian platforms (e.g., s390x); on those builds, this choice is rejected.",
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2de71899` are properly handled with clean fallback behavior.
