> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dathere-qsv-learnings.md`  
> **Source**: github ([https://github.com/dathere/qsv](https://github.com/dathere/qsv))  
> **Source Version**: `d2240721`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T10:56:33.056Z  
> **Learning ID**: `learn-github-dathere-qsv`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): dathere/qsv

---

## 1. Executive Forensic Architecture & System Mechanics

`qsv` is an ultra-high-throughput, neuro-symbolic tabular data engine written in Rust with companion TypeScript MCP (Model Context Protocol) agent runtimes. It processes multi-gigabyte structured datasets (CSV, TSV, Parquet, JSONL, Excel, GeoJSON) with near-zero RSS allocation through memory-mapped I/O, column-oriented Polars/DuckDB execution, indexing sidecars (`.sz`, `.idx`), and static query optimization before execution.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 qsv System Architecture                                │
└────────────────────────────────────────────────────────────────────────────────────────┘

  [ Agent / MCP Layer: .claude/skills/src ]
     │
     ├── concurrency.ts (Bounded concurrency slots, backpressure queue, process registry)
     ├── spawn-utils.ts (SIGTERM ➔ SIGKILL cascade, I/O truncation buffers, leak guards)
     └── utils.ts       (Path sanitization, reserved sidecar collision guards, semver)
     │
     ▼ (Process Boundary: stdio / JSON-RPC / CLI args)
  [ qsv Rust Core: src/ ]
     │
     ├── CLI / Dispatch Subsystem (Docopt validation, input!=output guard, delimiter sniffer)
     │      │
     │      ├── Stdin Spooler (process_input_with_sources ➔ tempfile spooling)
     │      └── Memory Allocator (jemalloc background thread purge, RSS retention tuning)
     │
     ├── Neuro-Symbolic / Analysis Engines
     │      │
     │      ├── scoresql.rs (Pre-execution SQL static scoring, AST predicate parsing)
     │      ├── formula_engine.rs (MiniJinja runtime, zero-Python spec evaluation)
     │      └── llmutil.rs (OpenAI-compatible HTTP client, max_tokens null-suppression)
     │
     └── Data Processing Subsystems
            │
            ├── polars / duckdb (Vectorized relational push-down queries)
            ├── stats / frequency (Streaming online Welford statistics, distinct card count)
            └── validate / schema (JSON Schema generation, ragged line split, enum pruning)
```

### Critical Subsystem Boundaries and State Ownership

1. **Host-Sandboxed Subprocess Execution Bridge (`.claude/skills/src`)**:
   - Isolates the node process from arbitrary system tool execution.
   - Enforces slot-based concurrency via an atomic single-threaded counter (`activeOperationCount`) and a FIFO waiter queue with settlement flags to prevent unhandled rejection loops or hanging child processes.
   - Wraps child processes in an unreferenced two-stage kill timer (`SIGTERM` $\rightarrow$ grace period $\rightarrow$ `SIGKILL`), preventing hanging worker pools when handling malformed or infinite CSV streams.

2. **Pre-Execution SQL Analyzer (`src/cmd/scoresql.rs`)**:
   - Decouples SQL parsing from execution. Inspects queries using AST walks before invoking heavy engines (Polars / DuckDB).
   - Reads offline sidecar statistics (`.stats.csv.data.jsonl`, `.freq.csv.data.jsonl`) to evaluate filter selectivity and join cardinality.
   - Distinguishes SQL keyword literals (`NULL`, `TRUE`, `FALSE`) from string literals (`'NULL'`) using enum tagging (`WhereLiteral`) to prevent invalid index hits.

3. **In-Process Formula Engine (`src/cmd/profile/formula_engine.rs`)**:
   - Eliminates Python/PyO3 runtime overhead by compiling Jinja2-compatible templates into Rust via `minijinja`.
   - Context is projected zero-copy across memory boundaries using `minijinja::value::Serde(context)`.
   - Uses thread-local backend swapping (`formula_helpers::set_sql_backend(sql_backend)`) with a strict return cleanup invariant to prevent state pollution across evaluation runs.

4. **I/O & Memory Resource Contracts (`src/util.rs`)**:
   - Allocator invariant: When jemalloc background threads are active (`BACKGROUND_THREADS_ACTIVE`), aggressive runtime page purging is disabled to minimize CPU context switching; otherwise, manual aggregation page retention is enabled.
   - File guard invariant: `check_output_is_not_input` enforces that output files are not identical to input files via device/inode checking, preventing truncation race conditions.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Rejection-State Settlement Tracking in Asynchronous Resource Queues

**RULE**:  
Every queued waiter item in an asynchronous concurrency limiter MUST maintain an explicit, monotonic boolean settlement state (`settled: boolean`). Dequeuers and timeouts MUST inspect and flip this flag before invoking callbacks, and expired queue entries MUST be pruned during both acquisition and release operations.

**WHY**:  
In asynchronous runtimes (Node.js/V8, Tokio, Go channels), when a queued resource acquisition operation times out, its cleanup timer fires and returns a timeout error. If the waiter item remains in the queue or lacks an explicit settlement indicator, a subsequent `release()` operation will pop the dead waiter and execute its callback. This increments active resource counters for an operation that has already aborted, causing counter-drift, resource leaks, and permanent deadlock once the limit is reached.

**WHEN TO APPLY**:  
Apply in any slot-based, semaphore-based, or connection-pool queue (Node.js, Rust `tokio::sync`, Go, Python `asyncio`) managing external processes, database connections, or network sockets.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
interface SlotWaiter {
  settled: boolean;
  callback: () => void;
}

export class BoundedResourcePool {
  private activeCount = 0;
  private readonly waiters: SlotWaiter[] = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueueSize: number
  ) {}

  public async acquire(timeoutMs: number): Promise<true | "timeout" | "backpressure"> {
    // Synchronous check-then-increment is atomic within single-threaded event loop
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      return true;
    }

    // Monotonic reverse-pruning of settled/dead waiters prevents unbounded array growth
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      if (this.waiters[i].settled) {
        this.waiters.splice(i, 1);
      }
    }

    if (this.waiters.length >= this.maxQueueSize) {
      return "backpressure";
    }

    return new Promise((resolve) => {
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
          this.activeCount++;
          resolve(true);
        }
      };

      this.waiters.push(waiter);
    });
  }

  public release(): void {
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      if (waiter && !waiter.settled) {
        try {
          waiter.callback();
        } catch (err) {
          console.warn("Waiter callback threw unexpectedly:", err);
        }
        if (this.activeCount > 0) {
          this.activeCount--;
        }
        return;
      }
    }

    if (this.activeCount > 0) {
      this.activeCount--;
    } else {
      console.warn("activeCount underflow: possible double-release");
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Naive promise queue lacking settlement flags and cleanup pruning
const waiters: Array<() => void> = [];
let active = 0;

async function badAcquire(timeoutMs: number) {
  if (active < MAX) { active++; return true; }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    // BUG: If timeout fires, this closure stays in waiters!
    // A future release() calls this closure, resolving an already rejected promise
    // or executing unhandled logic while active count drifts out of sync.
    waiters.push(() => {
      clearTimeout(timer);
      active++;
      resolve(true);
    });
  });
}
```

**VERIFICATION METHOD**:  
Execute a high-churn concurrency torture test: Spawn 100 concurrent callers against a pool with `maxConcurrent = 2` and `timeoutMs = 5ms`. Induce random delays in execution. Verify via post-condition assertions that:
1. `waiters.length === 0` after all promises settle.
2. `activeCount === 0` at quiescence.
3. Total successful `acquire()` calls match total `release()` calls.

---

### 2. Disambiguation of Empty Selection from Universal Wildcards in Domain Selectors

**RULE**:  
Domain column/field selectors MUST treat an empty input specification (`""` or empty collection) as "Select None" ($\emptyset$) when used for optional filter generation, and MUST NOT alias an empty selector into the universal wildcard selection (`*` / "Select All"). Universal selection MUST require an explicit syntax token (such as `"*"` or `"ALL"`).

**WHY**:  
When helper functions construct dynamic column selection queries (e.g., filtering columns with low cardinality for enum generation), an empty set indicates that zero columns met the threshold. If downstream consumers treat an empty selector string (`""`) as "all columns", operations meant to apply to a filtered subset will instead execute across every column in the schema. In large datasets, this generates massive JSON/metadata payloads, triggers out-of-memory crashes, and silently corrupts schema definitions.

**WHEN TO APPLY**:  
Any tabular projection, SQL AST generator, schema generator, or query engine selector parser (Rust, Go, TypeScript, Python).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Debug, PartialEq, Eq)]
pub enum ColumnSelection {
    None,
    All,
    Specific(Vec<String>),
}

impl ColumnSelection {
    pub fn parse_strict(input: &str) -> Self {
        let trimmed = input.trim();
        if trimmed.is_empty() {
            // Invariant: empty string maps strictly to None, never All
            return ColumnSelection::None;
        }
        if trimmed == "*" || trimmed.eq_ignore_ascii_case("all") {
            return ColumnSelection::All;
        }
        let cols: Vec<String> = trimmed
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        
        if cols.is_empty() {
            ColumnSelection::None
        } else {
            ColumnSelection::Specific(cols)
        }
    }
}

pub fn generate_enum_constraints(
    columns: &[String],
    selector: &ColumnSelection,
    cardinality_map: &std::collections::HashMap<String, usize>,
    threshold: usize,
) -> std::collections::HashMap<String, Vec<String>> {
    let mut results = std::collections::HashMap::new();

    let target_columns: &[String] = match selector {
        ColumnSelection::None => return results, // Early return: no columns selected
        ColumnSelection::All => columns,
        ColumnSelection::Specific(selected) => {
            // Only validate columns explicitly listed
            for col in selected {
                if let Some(&card) = cardinality_map.get(col) {
                    if card <= threshold && card > 1 {
                        results.insert(col.clone(), vec!["val1".into(), "val2".into()]);
                    }
                }
            }
            return results;
        }
    };

    for col in target_columns {
        if let Some(&card) = cardinality_map.get(col) {
            if card <= threshold && card > 1 {
                results.insert(col.clone(), vec!["val1".into(), "val2".into()]);
            }
        }
    }
    results
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Defaulting empty selector strings to universal "all columns"
fn get_unique_values(selector_str: &str) {
    // If selector_str is "", SelectColumns::parse returns SelectColumns::All!
    // When no column is below the threshold, helper returns "", causing
    // EVERY column to be gathered, emitting 100% enums!
    let selection = SelectColumns::parse(selector_str).unwrap_or(SelectColumns::All);
    apply_frequency_aggregation(selection);
}
```

**VERIFICATION METHOD**:  
Unit test property invariant: Pass an empty string `""` to the column selector and assert that `selection.selects_any()` evaluates to `false`. Ensure schema generation tests verify that datasets where zero columns meet threshold constraints emit 0 enum objects in output JSON schemas.

---

### 3. Absolute Target Derivation for Decompressed Ephemeral Inputs

**RULE**:  
When processing compressed or archive inputs (`.sz`, `.zip`, `.tar.gz`) that unpack into ephemeral scratch spaces, all derivative and split output files MUST resolve their final destinations against the user-specified output path or the original archive's parent directory, and MUST NEVER resolve relative to the temporary working directory or default to the ambient current working directory (`cwd`).

**WHY**:  
When tools write auxiliary or split outputs (`<input>.valid`, `<input>.invalid`) based on the filesystem location of the unpacked file, those outputs land in either the ambient `cwd` or an ephemeral directory. If two input files in different directories share a common base filename (e.g., `jan/data.csv.sz` and `feb/data.csv.sz`), relative writes to `cwd` will silently overwrite each other's outputs, destroying data with zero warnings or non-zero exit codes.

**WHEN TO APPLY**:  
CLI utilities, ETL pipelines, and file converters processing archive containers or temporary decompressed streams.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::{Path, PathBuf};

pub struct OutputDestination {
    pub valid_path: PathBuf,
    pub invalid_path: PathBuf,
}

impl OutputDestination {
    pub fn derive(original_input: &Path, override_output_dir: Option<&Path>) -> Self {
        // Invariant: Never use the decompressed tempfile path to anchor outputs.
        // Always anchor to the canonical directory of the user's explicit input file.
        let base_dir = if let Some(dir) = override_output_dir {
            dir.to_path_buf()
        } else {
            original_input
                .parent()
                .map(|p| if p.as_os_str().is_empty() { Path::new(".") } else { p })
                .unwrap_or_else(|| Path::new("."))
                .to_path_buf()
        };

        // Strip compression extensions (.sz, .gz) to get canonical base stem
        let stem = original_input
            .file_stem()
            .and_then(|s| Path::new(s).file_stem()) // double strip for .tar.gz if needed
            .unwrap_or_else(|| original_input.as_os_str());

        let file_stem_str = stem.to_string_lossy();

        Self {
            valid_path: base_dir.join(format!("{file_stem_str}.valid")),
            invalid_path: base_dir.join(format!("{file_stem_str}.invalid")),
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Resolving output destination from ephemeral temp path
fn process_and_split(decompressed_scratch_path: &Path) {
    // scratch_path is "/tmp/xyz789/data.csv"
    // Extracting filename and writing relative to ambient cwd:
    let file_name = decompressed_scratch_path.file_name().unwrap();
    let valid_out = PathBuf::from(file_name).with_extension("valid");
    // BUG: Writes to "./data.valid" in current working directory!
    // Collides with any other data.csv processed concurrently or sequentially.
    std::fs::write(valid_out, b"data").unwrap();
}
```

**VERIFICATION METHOD**:  
Create a test harness that defines two distinct subdirectories: `dir_a/input.csv.sz` and `dir_b/input.csv.sz`. Execute the batch validation command with both archives in a single invocation. Assert that `dir_a/input.csv.valid` and `dir_b/input.csv.valid` are created in their respective folders, and verify that the ambient working directory contains zero `.valid` or `.invalid` artifacts.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Schema `--enum-threshold` Cardinality Selector Fall-Through (BUG-QSV-01)
- **Context**: `src/cmd/schema.rs` and column selection parsing logic.
- **What Was Expected**: Running `qsv schema data.csv --enum-threshold N` on a file where no column has distinct values between $2$ and $N$ must produce an empty enum definition (`"enum": []`) or omit the enum constraint for all columns.
- **What Actually Happened**: When zero columns qualified, `build_low_cardinality_column_selector_arg` returned an empty string `""`. Downstream `SelectColumns::parse("")` evaluated `""` as "select all columns". The frequency aggregation engine then scanned and generated complete enum definitions containing hundreds of thousands of distinct values for every column in the file.
- **Evidence in Repo**: Closed Issue #4829, PR #4827.
- **Root Cause**: Semantic overloading of the empty string token `""`. In the CLI selection mini-language, `""` was interpreted as an unspecified flag defaulting to identity selection (`*`), while in the filtering generator, `""` represented an empty set resulting from predicate filtering.
- **Remediation Code Diff**:
```rust
// - Buggy code / What failed
let selector = build_low_cardinality_column_selector_arg(&low_cardinality_cols);
// When low_cardinality_cols is empty, selector is ""
// parse("") evaluates to SelectColumns::All!
let selection = SelectColumns::parse(&selector)?;
let freq_data = get_frequency_data(&input, selection)?;

// + Fixed pattern / Safe invariant
let selector = build_low_cardinality_column_selector_arg(&low_cardinality_cols);
if selector.trim().is_empty() {
    // Invariant: Empty column selector must bypass frequency analysis entirely
    return Ok(json_schema_without_enums);
}
let selection = SelectColumns::parse_explicit_or_none(&selector)?;
let freq_data = get_frequency_data(&input, selection)?;
```
- **Lesson**: Subsystem boundaries that translate filtering outputs into secondary selector queries must use an explicit `Option<T>` or strict `None` representation rather than string sentinel round-trips.

---

### Incident 2: Ragged Validation Split Path Silently Overwriting Sibling Directories (BUG-QSV-02)
- **Context**: `src/cmd/validate.rs`, handling split output for compressed inputs (`.sz`, `.zip`).
- **What Was Expected**: `qsv validate --split-ragged dir_a/data.csv.sz dir_b/data.csv.sz` must write valid/invalid files adjacent to the source files (`dir_a/data.csv.valid`, `dir_b/data.csv.valid`).
- **What Actually Happened**: Compressed inputs were uncompressed into temporary folders. Output path derivation used the uncompressed file's relative path against the ambient working directory (`cwd`). The tool wrote `run/data.csv.valid`, causing `dir_b/data.csv.sz` to silently overwrite `dir_a`'s outputs.
- **Evidence in Repo**: Issue #4783, commit `257ae7b38`.
- **Root Cause**: Failure to separate the *data read path* (which points to an ephemeral decompressed scratch file) from the *logical target path* (the canonical user-provided CLI path).
- **Remediation Code Diff**:
```rust
// - Buggy code / What failed
fn get_split_paths(processed_path: &Path) -> (PathBuf, PathBuf) {
    let file_name = processed_path.file_name().unwrap();
    (PathBuf::from(file_name).with_extension("valid"),
     PathBuf::from(file_name).with_extension("invalid"))
}

// + Fixed pattern / Safe invariant
fn get_split_paths(original_input_path: &Path) -> (PathBuf, PathBuf) {
    let parent = original_input_path.parent().unwrap_or_else(|| Path::new("."));
    let stem = original_input_path.file_stem().unwrap();
    (parent.join(format!("{}.valid", stem.to_string_lossy())),
     parent.join(format!("{}.invalid", stem.to_string_lossy())))
}
```
- **Lesson**: File processing pipelines that involve intermediate unpack/decode steps must carry an explicit tuple struct `ProcessingTarget { source_path: PathBuf, scratch_path: PathBuf }` to prevent temporary storage paths from leaking into output file layout generation.

---

### Incident 3: Dependency Lock Drift and `once_cell` Removal in Rust 2024 / Wasm Core (BUG-QSV-03)
- **Context**: `Cargo.lock`, `minijinja` 3.0.4 $\rightarrow$ 3.0.5, `wasm-bindgen` 0.2.129 $\rightarrow$ 0.2.130, `utf8_iter` 1.1.0 split.
- **What Was Expected**: Clean, reproducible crate dependency resolutions across both native SIMD targets and `wasm32-unknown-unknown` toolchains.
- **What Actually Happened**: `wasm-bindgen 0.2.130` removed internal dependency on `once_cell` in favor of standard library sync primitives (`std::sync::OnceLock`). Transitive crates without synchronized lockfiles experienced compile-time feature mismatches when targeting cross-platform toolchains.
- **Evidence in Repo**: Production commit `d2240721`, `Cargo.lock` patch diffs showing dependency updates for `js-sys`, `libbz2-rs-sys`, `minijinja`, `minijinja-contrib`, and `utf_types`.
- **Root Cause**: Rust 2024 edition ecosystem migration. As foundational crates transition from third-party synchronization primitives (`lazy_static`, `once_cell`) to `std::sync::OnceLock` / `LazyLock`, lockfiles with pinned old dependencies introduce duplicate symbol conflicts or missing trait implementations.
- **Remediation Code Diff**:
```toml
# - Buggy Cargo.lock snippet
[[package]]
name = "wasm-bindgen"
version = "0.2.129"
dependencies = [
 "cfg-if",
 "once_cell",
 "rustversion",
 "serde",
]

# + Fixed Cargo.lock snippet
[[package]]
name = "wasm-bindgen"
version = "0.2.130"
dependencies = [
 "cfg-if",
 "rustversion",
 "serde",
]

[[package]]
name = "utf_types"
version = "1.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
```
- **Lesson**: Modernization of foundational runtime dependencies requires coordinated lockfile maintenance to prevent split-brain synchronization primitives across runtime boundaries.

---

### Incident 4: Subprocess Zombie Leaks and Pipeline Hangs under Asynchronous Timeouts (BUG-QSV-04)
- **Context**: `.claude/skills/src/spawn-utils.ts`, `spawnWithTimeout` implementation.
- **What Was Expected**: If an invoked data-processing tool exceeds its allocated runtime, the child process must be terminated cleanly and all associated OS resources, timers, and stdio pipes released.
- **What Actually Happened**: Standard `SIGTERM` kills are ignored by processes running in tight loops, deadlocked in kernel I/O, or executing uncooperative C/C++ extensions. Stalling child processes held file descriptors open, causing node execution to hang indefinitely.
- **Evidence in Repo**: `.claude/skills/src/spawn-utils.ts`, Lines 60–120.
- **Root Cause**: Single-stage process signaling (`proc.kill()`) is insufficient for uncooperative processes. Without an unreferenced fallback timer executing `SIGKILL`, the runner remains blocked on the process `close` event.
- **Remediation Code Diff**:
```typescript
// - Buggy code / What failed
timer = setTimeout(() => {
  timedOut = true;
  proc.kill("SIGTERM"); // Fails if child blocks or handles SIGTERM
}, timeoutMs);

// + Fixed pattern / Safe invariant
timer = setTimeout(() => {
  timedOut = true;
  proc.kill("SIGTERM");
  killTimer = setTimeout(() => {
    if (!processExited && proc.exitCode === null) {
      try { 
        proc.kill("SIGKILL"); 
      } catch { /* process exited between check and kill */ }
      proc.unref();
    }
  }, KILL_GRACE_PERIOD_MS);
}, timeoutMs);
```
- **Lesson**: Child process wrappers must implement a two-stage `SIGTERM` $\rightarrow$ grace period $\rightarrow$ `SIGKILL` escalation cascade, and the escalation timer must be `unref()`'d to prevent keeping the host runtime alive.

---

### Incident 5: Concurrent Slot Leak via Settle/Timeout Callback Interleaving (BUG-QSV-05)
- **Context**: `.claude/skills/src/concurrency.ts`, `acquireSlot` and `releaseSlot`.
- **What Was Expected**: When a queued operation times out while waiting for a concurrency slot, subsequent releases must hand off execution to the next active waiter without desynchronizing `activeOperationCount`.
- **What Actually Happened**: When a queued waiter timed out, its timer callback fired. If `releaseSlot()` ran concurrently, it popped the timed-out waiter and triggered `waiter.callback()`. The callback attempted to increment `activeOperationCount` while `releaseSlot()` decremented it, causing state corruption and active operation tracking drift.
- **Evidence in Repo**: `.claude/skills/src/concurrency.ts`, Lines 20–120.
- **Root Cause**: Absence of mutual exclusion around callback settlement. The waiter lacked an explicit monotonic `settled` flag checked atomically before resolution.
- **Remediation Code Diff**:
```typescript
// - Buggy code / What failed
interface SlotWaiter {
  callback: () => void;
}
// releaseSlot logic:
const waiter = slotWaiters.shift();
if (waiter) {
  waiter.callback(); // Invokes callback even if timeout already resolved!
}

// + Fixed pattern / Safe invariant
interface SlotWaiter {
  settled: boolean;
  callback: () => void;
}
// In acquireSlot timer:
const timer = setTimeout(() => {
  if (!waiter.settled) {
    waiter.settled = true;
    resolve("timeout");
  }
}, timeoutMs);

// In releaseSlot:
while (slotWaiters.length > 0) {
  const waiter = slotWaiters.shift();
  if (waiter && !waiter.settled) {
    waiter.callback();
    return; // Handed off successfully
  }
}
```
- **Lesson**: Promise-based queue hand-offs must carry an explicit monotonic settlement state flag checked inside both timeout and acquisition paths.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

- **SQL Keyword vs Value Literal Distinctions**:  
  In static query analysis (`src/cmd/scoresql.rs`), differentiating SQL keywords (`NULL`, `TRUE`, `FALSE`) from string values (`'NULL'`, `'TRUE'`, `'FALSE'`) is mandatory. A naive string conversion causes `WHERE col = NULL` (which should match empty frequency cache cells) to be analyzed as `WHERE col = 'NULL'` (which queries literal string data):
  ```rust
  #[derive(Clone, Debug)]
  enum WhereLiteral {
      Keyword(String), // Matches empty strings or canonical boolean tokens
      Value(String),   // Exact binary comparison against frequency-cache values
  }
  ```
- **Sentinel Collision Prevention**:  
  Frequency cache engines generate token markers like `<ALL_UNIQUE>`, `<HIGH_CARDINALITY>`, and `<NON_UTF8>`. Equality checks against where-clauses must never match user queries targeting these literal strings:
  ```rust
  fn is_sentinel_entry(freq: &FreqEntry) -> bool {
      freq.frequencies.len() == 1
          && matches!(
              freq.frequencies[0].value.as_str(),
              "<ALL_UNIQUE>" | "<HIGH_CARDINALITY>" | "<NON_UTF8>"
          )
  }
  ```
- **Null-Suppressing LLM Parameters**:  
  In `src/llmutil.rs`, OpenAI-compatible servers reject payloads containing `"max_tokens": null`. The JSON builder must conditionally omit the field rather than serializing a null value:
  ```rust
  let mut request_data = json!({
      "model": model,
      "messages": messages,
      "stream": false
  });
  if let Some(max_tokens) = max_tokens {
      request_data["max_tokens"] = json!(max_tokens);
  }
  ```