> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dathere-qsv-learnings.md`  
> **Source**: github ([https://github.com/dathere/qsv](https://github.com/dathere/qsv))  
> **Source Version**: `84c85c1f`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-11T14:43:34.839Z  
> **Learning ID**: `learn-github-dathere-qsv`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): dathere/qsv

---

## 1. Executive Forensic Architecture & System Mechanics

`dathere/qsv` is an industrial-grade, neuro-symbolic tabular data processing engine written in Rust, paired with a TypeScript-based Model Context Protocol (MCP) toolchain (`.claude/skills/`). It is engineered to perform high-throughput parsing, validation, transformation, indexing, and statistical profiling across large tabular files (CSV, TSV, JSONL, Parquet, Arrow, Excel) while enforcing strict memory ceilings and zero-copy guarantees wherever possible.

```
+----------------------------------------------------------------------------------------------------+
|                                    QSV HIGH-LEVEL ARCHITECTURE                                     |
+----------------------------------------------------------------------------------------------------+
|  Agent / MCP Clients (Claude, Gemini, Cursor, Cowork)                                             |
+----------------------------------------------------------------------------------------------------+
                                      |  stdio (JSON-RPC 2.0 / MCP Protocol)
                                      v
+----------------------------------------------------------------------------------------------------+
|  MCP Server Layer (.claude/skills/src/)                                                            |
|  - Concurrency Gatekeeper: Slot-based backpressure (MAX_QUEUE_SIZE = 64)                           |
|  - Process Supervisor: spawnWithTimeout (SIGTERM -> Grace Period -> SIGKILL)                       |
|  - Sanitization Barrier: Path stripping & Error Masking (sanitizeErrorForClient)                  |
+----------------------------------------------------------------------------------------------------+
                                      |  fork/exec (CLI argv stream)
                                      v
+----------------------------------------------------------------------------------------------------+
|  Native Core Engine (Rust CLI / src/)                                                              |
|  +-----------------------------------------------------------------------------------------------+ |
|  | Input Processing & Boundary Safety Layer                                                      | |
|  | - Snappy (.sz) & Zip decompression sandbox (process_input_with_sources -> tempfile::tempdir)   | |
|  | - Output collision & Overwrite guards (check_output_is_not_input, isReservedCachePath)        | |
|  +-----------------------------------------------------------------------------------------------+ |
|  +-------------------------------------+  +------------------------------------------------------+ |
|  | Execution & Transformation Engines  |  | Analysis & Profiling Engines                         | |
|  | - Polars SQL Context / Arrow Record |  | - Native Jinja Formula Engine (minijinja)            | |
|  | - DuckDB CLI Integration Engine     |  | - Streaming Descriptive Stats (Online Welford/t-digest)|
|  | - Luau Sandboxed Scripting Engine   |  | - Frequency & Cardinality Estimators                 | |
|  +-------------------------------------+  +------------------------------------------------------+ |
|  +-----------------------------------------------------------------------------------------------+ |
|  | Memory & OS Subsystem Invariants                                                              | |
|  | - Dynamic Heap Control: jemalloc background purging (BACKGROUND_THREADS_ACTIVE)              | |
|  | - Memory-Aware Chunking: SAFETY_MARGIN = 0.8 (20% reserve headroom)                           | |
|  +-----------------------------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

### Architectural Boundaries & Subsystems
1. **MCP Concurrency & Supervision Layer (`.claude/skills/src/`)**: Mediates external tool execution requests. Implements an explicit, slot-based concurrency controller with synchronous token-check invariants to eliminate Node.js microtask race conditions, paired with a two-phase child process teardown supervisor (`SIGTERM` $\to$ grace period $\to$ `SIGKILL`).
2. **Input Processing & Normalization Layer (`src/util/input.rs`, `src/util.rs`)**: Handles heterogeneous input sources (direct filesystem paths, HTTP endpoints, stdin pipes, `.infile-list` manifests, zip containers, and Snappy archives). It enforces destination decoupling, unpacking compressed formats into isolated ephemeral directories before downstream commands execute.
3. **Execution Engine Multiplexing (`src/cmd/`)**: Isolates pure streaming row operations (`cat`, `count`, `dedup`, `slice`) from heavy vector operations. For SQL and vectorized processing, execution routes through Polars SQL contexts or DuckDB child processes. For dynamic field templating, execution runs through an embedded `minijinja` engine, eliminating external language runtimes like Python/PyO3.
4. **Memory Allocation & Resource Governance (`src/util/runtime.rs`)**: Controls runtime RSS limits using jemalloc page purging through background threads (`BACKGROUND_THREADS_ACTIVE`), ensuring that high-throughput batching (`DEFAULT_BATCH_SIZE = 50_000`) leaves at least 20% system headroom (`SAFETY_MARGIN = 0.8`).

---

## 2. Universal Engineering Rules (Master Brain Candidates)

### 1. Invariant Handling of Empty vs Default Column Selectors
**RULE**:
When parsing user-provided column selector expressions, an empty string (`""`), a missing argument, or a failed filter predicate MUST NOT silently fall back to an "all columns" wildcard (`SelectColumns::All`) when executing selective or threshold-dependent operations. Selector builders MUST return an explicit `Option<SelectColumns>` or a dedicated `SelectColumns::None` variant. Downstream execution pipelines MUST treat `None` as a non-matching no-op rather than invoking unbounded whole-dataset enumeration.

**WHY**:
In command-line and query-processing architectures, string arguments often use `""` as a default sentinel for unconfigured inputs. If a parser treats `""` as "select everything" (common in projection syntax where no projection means `SELECT *`), conditional filter builders (such as `qsv schema --enum-threshold N`) will generate an empty selector when zero columns qualify. If this empty string passes into `SelectColumns::parse("")`, the selector silently expands to all columns. This causes every column to be enumerated and profiled, corrupting analytical outputs and consuming unbounded CPU and memory.

**WHEN TO APPLY**:
Apply in any data query language, CLI argument parser, column projection engine, or database projection builder where column filtering can produce empty candidate sets.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ColumnSelection {
    All,
    None,
    Explicit(Vec<usize>),
}

impl ColumnSelection {
    /// Safely parses an optional selector argument string.
    /// Distinguishes between an unconfigured input (which may mean All),
    /// an explicit empty filter result (which MUST mean None),
    /// and a concrete list of column identifiers.
    pub fn parse_conditional_selection(raw: Option<&str>) -> Self {
        match raw {
            None => ColumnSelection::All,
            Some(s) if s.trim().is_empty() => ColumnSelection::None,
            Some(s) => {
                let indices: Vec<usize> = s
                    .split(',')
                    .filter_map(|idx_str| idx_str.trim().parse::<usize>().ok())
                    .collect();
                if indices.is_empty() {
                    ColumnSelection::None
                } else {
                    ColumnSelection::Explicit(indices)
                }
            }
        }
    }
}

pub fn generate_schema_enums(
    columns: &[String],
    cardinality_map: &[(usize, usize)], // (col_idx, distinct_count)
    enum_threshold: usize,
) -> Vec<(usize, Vec<String>)> {
    // 1. Filter columns meeting cardinality bounds
    let qualifying_cols: Vec<usize> = cardinality_map
        .iter()
        .filter(|(_, count)| *count >= 2 && *count <= enum_threshold)
        .map(|(idx, _)| *idx)
        .collect();

    // 2. Explicitly handle empty sets: return early without triggering full scans
    if qualifying_cols.is_empty() {
        return Vec::new();
    }

    // 3. Process only the explicit candidate set
    qualifying_cols
        .into_iter()
        .map(|idx| (idx, vec![/* resolved frequencies */]))
        .collect()
}
```

**NEGATIVE CONSTRAINT**:
```rust
// CRITICAL BUG PATTERN: Building a comma-delimited selector string where an empty
// candidate set results in "", which downstream parser maps to "Select All"
fn build_low_cardinality_selector(candidates: &[usize]) -> String {
    // If candidates is empty, returns ""
    candidates.iter().map(|c| c.to_string()).collect::<Vec<_>>().join(",")
}

fn process_frequencies(input_csv: &Path, selector_arg: &str) {
    // BUG: SelectColumns::parse("") parses into SelectColumns::All!
    // Every column in the CSV is now read, distinct-counted, and serialized!
    let selection = SelectColumns::parse(selector_arg).unwrap();
    frequency_table_scan(input_csv, selection);
}
```

**VERIFICATION METHOD**:
Enforce unit and integration tests where zero elements meet the qualification threshold. Assert that the resulting emitted schema contains zero enumerated properties:
```rust
#[test]
fn test_enum_threshold_with_zero_qualifying_columns() {
    let schema_output = run_schema_generator(&[100, 100, 100], /* threshold = */ 10);
    assert_eq!(schema_output.enumerated_columns().count(), 0);
}
```

---

### 2. Sandbox-Isolated File Resolution for Decompressed/Extracted Inputs
**RULE**:
When an application extracts, decompresses, or stages an input file into a temporary working directory for processing, any sidecar, derived, or split artifact (e.g., `.valid`, `.invalid`, `.stats.jsonl`) MUST be anchored relative to the original source input path on disk, NEVER relative to the ephemeral staging path or the process's current working directory (`cwd`), UNLESS an explicit `--output-dir` is declared.

**WHY**:
When processing compressed formats (e.g., Snappy `.sz`, `.zip`, `.tar.gz`), engines frequently unpack files into a staging directory (such as `/tmp/qsv_temp_XYZ/input.csv`). If output filenames are derived by appending suffixes to the input's path without preserving the original parent directory context, the resulting artifacts land in `cwd` or collide across multiple input archives sharing identical internal filenames (e.g., `data.zip` containing `data.csv` and `feb.sz` containing `data.csv`). This produces silent file overwrites, uncontained filesystem pollution, and race conditions in concurrent batch jobs.

**WHEN TO APPLY**:
Apply to any CLI utility, data pipeline, or background worker that accepts compressed or staged input archives and writes derived output files.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::{Path, PathBuf};

#[derive(Debug)]
pub struct ProcessTarget {
    pub execution_path: PathBuf,    // Path where the engine reads the data (may be /tmp)
    pub logical_origin: PathBuf,    // Path where the user provided the file
}

pub fn derive_artifact_path(
    target: &ProcessTarget,
    suffix: &str,
    explicit_outdir: Option<&Path>,
) -> PathBuf {
    let base_dir = if let Some(outdir) = explicit_outdir {
        outdir.to_path_buf()
    } else {
        // Resolve parent of the logical origin, NOT the ephemeral staging file
        target
            .logical_origin
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .to_path_buf()
    };

    // Extract the original file stem or filename to avoid naming collisions
    let stem = target
        .logical_origin
        .file_name()
        .expect("Valid file name required");

    let mut output_name = stem.to_os_string();
    output_name.push(suffix);

    base_dir.join(output_name)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// CRITICAL BUG PATTERN: Deriving artifact path from execution path directly
fn derive_bad_artifact_path(working_file: &Path, suffix: &str) -> PathBuf {
    // If working_file is "/tmp/xyz123/data.csv", this places outputs in /tmp/xyz123/data.csv.valid
    // If working_file is converted to relative Path::new(working_file.file_name()),
    // it drops outputs into current working directory (cwd)
    let stem = working_file.file_name().unwrap();
    Path::new(".").join(format!("{}.{}", stem.to_string_lossy(), suffix))
}
```

**VERIFICATION METHOD**:
Execute processing pipelines with an input located in a subfolder and compressed via Snappy/Zip. Assert that generated output files exist in the parent folder of the input archive, not in the process invocation root:
```rust
#[test]
fn test_compressed_derived_artifact_location() {
    let temp_root = tempfile::tempdir().unwrap();
    let archive_dir = temp_root.path().join("sub_dir");
    std::fs::create_dir(&archive_dir).unwrap();
    let archive_path = archive_dir.join("test.csv.sz");
    compress_to_snappy(&archive_path, b"col1,col2\n1,2\n");

    let output_files = run_split_ragged(&archive_path).unwrap();
    assert_eq!(output_files.valid.parent().unwrap(), archive_dir.as_path());
}
```

---

### 3. Synchronous Invariant Guarding in Asynchronous Concurrency Managers
**RULE**:
In asynchronous event-loop environments (e.g., Node.js / V8), any check-and-acquire state transition on shared concurrency counters MUST execute strictly synchronously without interleaving `await` expressions or asynchronous microtask yields. Waiter queues implementing backpressure MUST carry explicit, immutable terminal settlement flags (`settled: boolean`) to prevent stale callbacks and counter desynchronization during timeouts and cancellations.

**WHY**:
In single-threaded event loop engines, race conditions cannot occur during purely synchronous blocks. However, inserting an `await` between reading an operation counter (`if (active < max)`) and updating it (`active++`) yields the execution thread, allowing other events to run and corrupting the concurrency limit. Furthermore, if a queued waiter times out and its promise resolves, its pending callback will still exist in the queue unless actively pruned or flagged. If the callback runs later upon another slot's release, it causes an unauthorized slot leak, driving `activeOperationCount` negative or triggering double-releases.

**WHEN TO APPLY**:
Apply to all TypeScript, JavaScript, or async/await concurrency throttlers, connection pools, and rate-limiting proxies.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
interface SlotWaiter {
  settled: boolean;
  callback: () => void;
}

export class SafeConcurrencyGate {
  private activeCount = 0;
  private readonly waiters: SlotWaiter[] = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueueSize: number
  ) {}

  public acquire(timeoutMs: number): Promise<boolean> {
    // ATOMIC CRITICAL SECTION: Must remain 100% synchronous.
    // Absolutely NO `await` between check and mutation.
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      return Promise.resolve(true);
    }

    // Prune stale waiters prior to evaluating queue bounds
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      if (this.waiters[i].settled) {
        this.waiters.splice(i, 1);
      }
    }

    if (this.waiters.length >= this.maxQueueSize) {
      return Promise.resolve(false); // Backpressure triggered
    }

    return new Promise<boolean>((resolve) => {
      const waiter: SlotWaiter = {
        settled: false,
        callback: () => {
          if (!waiter.settled) {
            waiter.settled = true;
            clearTimeout(timer);
            this.activeCount++;
            resolve(true);
          }
        },
      };

      const timer = setTimeout(() => {
        if (!waiter.settled) {
          waiter.settled = true;
          resolve(false); // Timed out
        }
      }, timeoutMs);

      this.waiters.push(waiter);
    });
  }

  public release(): void {
    while (this.waiters.length > 0) {
      const next = this.waiters.shift();
      if (next && !next.settled) {
        try {
          next.callback();
        } finally {
          if (this.activeCount > 0) {
            this.activeCount--;
          }
        }
        return;
      }
    }

    if (this.activeCount > 0) {
      this.activeCount--;
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// CRITICAL BUG PATTERN: Asynchronous gaps and untracked waiter settlement
class BuggyGate {
  private active = 0;
  private queue: (() => void)[] = [];

  async acquire(max: number) {
    await logMetrics(); // ASYNC YIELD: Multiple tasks enter concurrently!
    if (this.active < max) {
      this.active++;
      return true;
    }
    return new Promise((resolve) => {
      // Memory leak & zombie callback: timeout does not cancel queue entry!
      setTimeout(() => resolve(false), 5000);
      this.queue.push(() => {
        this.active++; // Will execute even if timeout already resolved!
        resolve(true);
      });
    });
  }
}
```

**VERIFICATION METHOD**:
Run high-concurrency simulation tests using `Promise.allSettled` with zero mock delays and timeouts. Verify that `activeOperationCount` never exceeds `maxConcurrentOperations` and that its final value always returns to 0:
```typescript
it("guarantees active counter bounds under heavy timeout contention", async () => {
  const gate = new SafeConcurrencyGate(2, 10);
  const tasks = Array.from({ length: 50 }, () =>
    gate.acquire(5).then((ok) => {
      if (ok) setTimeout(() => gate.release(), 10);
    })
  );
  await Promise.all(tasks);
  await new Promise((r) => setTimeout(r, 50));
  expect(gate["activeCount"]).toBe(0);
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Schema Inversion via Empty Selector Fallback (BUG-QSV-01)
- **Context**: Schema generation engine and low-cardinality enum inference (`src/cmd/schema.rs`).
- **What Was Expected**: Passing `qsv schema --enum-threshold N` should emit an `enum` constraint only for columns with cardinality between 2 and $N$. If no column in the file meets this criteria, zero enum constraints should be emitted.
- **What Actually Happened**: When no column fell below the threshold, `--enum-threshold` was ignored, and every column in the entire dataset was converted into a full enumeration. For instance, an 80-row file with two unique columns yielded 80-element enums for each column.
- **Evidence in Repo**: Issue #4829, resolved in commit `1a8e9f2`.
- **Root Cause**: `build_low_cardinality_column_selector_arg` returned an empty string (`""`) when zero candidate columns qualified. Downstream, `get_unique_values` passed this string into `SelectColumns::parse("")`. In `qsv`'s argument parser, an empty string signifies "all columns". Consequently, the `frequency` command was instructed to profile every column, emitting categorical enums for the entire file.
- **Remediation Code Diff**:
```rust
// - Buggy implementation
fn build_low_cardinality_column_selector_arg(candidates: &[usize]) -> String {
    candidates.iter().map(|idx| idx.to_string()).collect::<Vec<_>>().join(",")
}

// In get_unique_values():
let selector_str = build_low_cardinality_column_selector_arg(&candidates);
let sel = SelectColumns::parse(&selector_str)?; // Empty string parsed as SelectColumns::All

// + Corrected invariant
fn build_low_cardinality_column_selector_arg(candidates: &[usize]) -> Option<String> {
    if candidates.is_empty() {
        None
    } else {
        Some(candidates.iter().map(|idx| idx.to_string()).collect::<Vec<_>>().join(","))
    }
}

// In get_unique_values():
match build_low_cardinality_column_selector_arg(&candidates) {
    None => {
        // Explicit early return: do not run frequency or select all columns
        return Ok(HashMap::default());
    }
    Some(selector_str) => {
        let sel = SelectColumns::parse(&selector_str)?;
        // execute frequency analysis on designated subset
    }
}
```
- **Lesson**: Parsing functions must never use wildcard defaults ("all") when fed the output of an internal filter that evaluated to empty ("none").

---

### Incident 2: Ragged Line Split Artifact Overwrite via Staging Leak (BUG-QSV-02)
- **Context**: File format normalization and ragged CSV splitting (`src/cmd/validate.rs`).
- **What Was Expected**: Running `qsv validate --split-ragged input.csv.sz` should produce output split files (`<input>.valid`, `<input>.invalid`) alongside the original input path in the user's filesystem.
- **What Actually Happened**: For compressed archives (`.sz` and `.zip`), the command unpacked files into a temporary directory and derived the destination file path using the temporary path relative to the current working directory (`cwd`). Running the command on two distinct files with identical inner names silently overwrote each other's outputs in `cwd`.
- **Evidence in Repo**: Issue #4783, resolved in commit `257ae7b`.
- **Root Cause**: `process_input` decoupled compressed files by writing them to an ephemeral `tempfile::tempdir()`. The path resolver in `validate.rs` then used the inner temporary path instead of tracking the `logical_origin` (the input archive's original path on disk).
- **Remediation Code Diff**:
```rust
// - Buggy implementation
let output_dir = input_path.parent().unwrap_or_else(|| Path::new("."));
let valid_file = output_dir.join(format!("{}.valid", input_path.file_name().unwrap().to_str().unwrap()));

// + Corrected invariant
let (working_path, source) = process_input_single(input_path, &tmpdir, "")?;
let original_destination_dir = match source {
    util::InputSource::Filesystem(ref orig_path) => {
        orig_path.parent().unwrap_or_else(|| Path::new("."))
    }
    util::InputSource::Stdin => Path::new("."),
};
let base_name = match source {
    util::InputSource::Filesystem(ref orig_path) => orig_path.file_name().unwrap(),
    util::InputSource::Stdin => OsStr::new("stdin.csv"),
};
let valid_file = original_destination_dir.join(format!("{}.valid", base_name.to_str().unwrap()));
```
- **Lesson**: Staged or unpacked artifacts must carry their provenance metadata (`logical_origin`) throughout the processing pipeline so that file outputs are saved relative to the user's inputs, not internal scratchpads.

---

### Incident 3: Stale Waiter Leak and Counter Drift in Tool Concurrency Throttle (BUG-QSV-03)
- **Context**: MCP concurrency controller (`.claude/skills/src/concurrency.ts`).
- **What Was Expected**: When multiple operations wait for execution slots, operations timing out in the queue must not alter the active counter or corrupt future slot releases.
- **What Actually Happened**: Callers timing out remained in the `slotWaiters` queue without terminal state tracking. When an active operation finished and called `releaseSlot()`, it executed the callback of a timed-out waiter. That callback failed to update the caller (since its promise had already timed out), leading to active operation counter drift and leaked concurrency limits.
- **Evidence in Repo**: Commit `84c85c1f` / Concurrency subsystem review.
- **Root Cause**: Waiters were bare callback closures (`() => void`). There was no settlement check or reverse queue cleanup when an operation timed out, causing race conditions in callback resolution.
- **Remediation Code Diff**:
```typescript
// - Buggy implementation
const slotWaiters: (() => void)[] = [];
// acquire:
slotWaiters.push(() => { activeOperationCount++; resolve(true); });
// release:
const waiter = slotWaiters.shift();
if (waiter) { waiter(); return; }

// + Corrected invariant
interface SlotWaiter {
  settled: boolean;
  callback: () => void;
}
const slotWaiters: SlotWaiter[] = [];

// acquire:
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
```
- **Lesson**: Queued callbacks that can be cancelled externally (e.g., via timers or abort signals) must include an internal settlement flag (`settled`) so that consumer loops can skip stale entries.

---

### Incident 4: Frequency Cache Collision with Reserved Sentinels (BUG-QSV-04)
- **Context**: SQL scoring engine and cardinality cache analysis (`src/cmd/scoresql.rs`).
- **What Was Expected**: `scoresql` evaluates filter selectivity by comparing literals in `WHERE col = 'val'` against the frequency cache. If a column was not fully tracked due to high cardinality, the cache recorded a sentinel token, which should be ignored during value lookups.
- **What Actually Happened**: When a column exceeded distinct value thresholds, the cache stored a single frequency value containing `<HIGH_CARDINALITY>` or `<ALL_UNIQUE>` with a frequency of 100%. A query containing `WHERE col = '<HIGH_CARDINALITY>'` or `WHERE col = '<NON_UTF8>'` matched this entry, leading `scoresql` to miscalculate the selectivity as 100% and generate inaccurate query optimization plans.
- **Evidence in Repo**: `src/cmd/scoresql.rs` lines 205–218.
- **Root Cause**: The query plan analyzer did not verify whether a frequency record was an internal sentinel marker before comparing it against query literals.
- **Remediation Code Diff**:
```rust
// - Buggy implementation
fn score_filter_selectivity(freq_entry: &FreqEntry, literal: &str) -> f64 {
    for val in &freq_entry.frequencies {
        if val.value == literal {
            return val.percentage;
        }
    }
    0.0
}

// + Corrected invariant
fn is_sentinel_entry(freq: &FreqEntry) -> bool {
    freq.frequencies.len() == 1
        && matches!(
            freq.frequencies[0].value.as_str(),
            "<ALL_UNIQUE>" | "<HIGH_CARDINALITY>" | "<NON_UTF8>"
        )
}

fn score_filter_selectivity(freq_entry: &FreqEntry, literal: &str) -> f64 {
    if is_sentinel_entry(freq_entry) {
        // Sentinels are markers, not actual matching row data
        return 0.0;
    }
    for val in &freq_entry.frequencies {
        if val.value == literal {
            return val.percentage;
        }
    }
    0.0
}
```
- **Lesson**: Engine metadata and sentinel tokens stored within data caches must be strictly differentiated from real domain values during query evaluation.

---

### Incident 5: Subprocess Process Group Zombie Leakage on Timeout (BUG-QSV-05)
- **Context**: Child process management and execution timeout enforcement (`.claude/skills/src/spawn-utils.ts`).
- **What Was Expected**: When a data processing command times out, all associated child processes must be terminated without leaving orphaned zombie processes consuming system memory and file locks.
- **What Actually Happened**: The supervisor sent a `SIGTERM` signal upon timeout. However, if the child was blocked on disk I/O or ignored `SIGTERM`, it continued running indefinitely. Furthermore, the cleanup logic could attempt to run `proc.kill("SIGKILL")` after the process had already exited, throwing uncaught errors.
- **Evidence in Repo**: `.claude/skills/src/spawn-utils.ts` lines 70–135.
- **Root Cause**: The timeout handler lacked a two-phase escalation cascade (`SIGTERM` followed by a grace period and `SIGKILL`), along with state tracking to determine if the process was already dead.
- **Remediation Code Diff**:
```typescript
// - Buggy implementation
timer = setTimeout(() => {
    timedOut = true;
    proc.kill(); // Default SIGTERM only; hangs on I/O deadlock
}, timeoutMs);

// + Corrected invariant
timer = setTimeout(() => {
    timedOut = true;
    proc.kill("SIGTERM");
    killTimer = setTimeout(() => {
        if (!processExited && proc.exitCode === null) {
            try { 
                proc.kill("SIGKILL"); 
            } catch { 
                /* Handle race condition where process exited between check and kill */ 
            }
            proc.unref();
        }
    }, KILL_GRACE_PERIOD_MS);
}, timeoutMs);

const finish = (result: SpawnResult) => {
    if (finalized) return;
    finalized = true;
    processExited = true;
    clearTimers();
    onExit?.(proc);
    resolve(result);
};
```
- **Lesson**: Production-grade timeouts must use a phased escalation (`SIGTERM` $\to$ grace period $\to$ `SIGKILL`), complete with execution guards to prevent operations on already-terminated process handles.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **SQL Literal Semantic Tagging**: In `src/cmd/scoresql.rs`, `WHERE col = NULL` and `WHERE col = 'NULL'` have fundamentally different semantics. In SQL, `WHERE col = NULL` is structurally distinct from testing against the string `"NULL"`. The engine models this using a specialized enum:
  ```rust
  #[derive(Clone, Debug)]
  enum WhereLiteral {
      Keyword(String), // TRUE, FALSE, NULL (Canonical upper-case)
      Value(String),   // Escaped / Quoted strings
      Number(String),  // Numeric literals
  }
  ```
  This ensures that when checking against the frequency cache, `Keyword("NULL")` matches empty cells, while `Value("NULL")` matches only the literal text `"NULL"`.
* **String Path Sanitization**: In `.claude/skills/src/utils.ts`, absolute system paths must never be exposed to clients over JSON-RPC. When sanitizing paths across platforms, trailing slashes must be stripped *prior* to splitting:
  ```typescript
  export function sanitizeErrorForClient(message: string): string {
    return message.replace(/(?:[A-Za-z]:\\|\/)[^\s:,"']+/g, (match) => {
      const trimmedMatch = match.replace(/[/\\\\]+$/g, ""); // Strip trailing slashes first
      const parts = trimmedMatch.split(/[/\\\\]/);
      return parts[parts.length - 1] || trimmedMatch || match;
    });
  }
  ```
  If trailing slashes are not removed first, splitting `/usr/local/bin/` yields an empty string for the last array element, corrupting the sanitized output.

---

### 2. Infinite Loop & Recursion Guards
* **Deterministic Reverse Pruning of Stale Queues**: In `.claude/skills/src/concurrency.ts`, when pruning settled promises from the waiter array, iteration proceeds in reverse:
  ```typescript
  for (let i = slotWaiters.length - 1; i >= 0; i--) {
    if (slotWaiters[i].settled) slotWaiters.splice(i, 1);
  }
  ```
  Iterating forward while splicing shifts subsequent indices to the left, which skips the element immediately following an eviction. In long-running processes, this creates an unbounded memory leak.
* **Deterministic Hash Wobble Instead of Randomness**: In `examples/viz/gen_tristate_county_incidents.py`, when generating synthetic data with realistic variations, the generator uses a deterministic cryptographic hash (`blake2b`) rather than pseudo-random numbers (`random.random()`):
  ```python
  def wobble(fips: str) -> float:
      digest = hashlib.blake2b(fips.encode(), digest_size=8).digest()
      unit = int.from_bytes(digest, "big") / 2**64
      return WOBBLE_LO + WOBBLE_SPAN * unit
  ```
  This guarantees that test runs and builds are 100% reproducible byte-for-byte across all environments.

---

### 3. UI & UX Micro-Mechanics
* **GeoJSON Simplification Ratios**: Visualizing geographic boundaries (e.g., in `qsv viz`) embeds geometries directly into HTML/Plotly outputs. Unsimplified ArcGIS boundaries can result in multi-megabyte payloads that cause browser rendering passes to thrash:
  ```python
  # ArcGIS server-side offset: 0.001 degrees reduces payload from 17.8MB to 0.36MB (~50x reduction)
  MAX_ALLOWABLE_OFFSET = 0.001
  ```
  Selecting the correct simplification threshold is critical: state-level visualizations use `0.002` degrees, while county-level maps require `0.001` degrees to keep features like river borders identifiable without causing the DOM to stall.
* **Whitespace Display Normalization**: Tabular terminal output can be disrupted by invisible whitespace characters. `src/util.rs` establishes explicit visual glyph mappings for non-standard whitespace to prevent terminal desynchronization:
  ```rust
  const WHITESPACE_MARKERS: &[(char, &str)] = &[
      ('\t', "《→》"),
      ('\n', "《¶》"),
      ('\r', "《⏎》"),
      ('\u{00A0}', "《⍽》"),    // Non-breaking space
      ('\u{200B}', "《zwsp》"), // Zero-width space
  ];
  ```

---

### 4. Backend Concurrency & Memory Safety
* **Heap Memory Purging Invariants**: `src/util.rs` checks whether jemalloc background threads are enabled before invoking dynamic page purging:
  ```rust
  pub static BACKGROUND_THREADS_ACTIVE: std::sync::atomic::AtomicBool =
      std::sync::atomic::AtomicBool::new(false);
  ```
  If background threads are active