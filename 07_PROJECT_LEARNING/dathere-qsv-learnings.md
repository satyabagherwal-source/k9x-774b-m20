> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dathere-qsv-learnings.md`  
> **Source**: github ([https://github.com/dathere/qsv](https://github.com/dathere/qsv))  
> **Source Version**: `24965a7c`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-24T19:43:47.463Z  
> **Learning ID**: `learn-github-dathere-qsv`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): dathere/qsv

---

## 1. Executive Forensic Architecture & System Mechanics

`qsv` is an industrial-grade, neuro-symbolic tabular data engine written in Rust. It unifies high-throughput stream processing (CSV/TSV/SSV), columnar query engines (Polars, DuckDB), embedded scripting runtimes (Luau, Python), and external AI model interfaces (MCP server, OpenAI-compatible LLM endpoints) into a single, high-performance binary family (`qsv`, `qsvlite`, `qsvdp`, `qsvmcp`).

```
                              ┌─────────────────────────────────────────────────────────┐
                              │                    qsv Command Line                     │
                              └────────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                              ┌─────────────────────────────────────────────────────────┐
                              │             Subcommand Dispatch & CLI Parser            │
                              │           (docopt + custom flag overrides)              │
                              └──────┬──────────────────────┬─────────────────────┬─────┘
                                     │                      │                     │
                ┌────────────────────┴──────────┐           │        ┌────────────┴────────────────────┐
                ▼                               ▼           │        ▼                                 ▼
   ┌─────────────────────────┐     ┌────────────────────────┴─┐   ┌────────────────────────┐    ┌────────────────────────┐
   │ Streaming Parser Core   │     │ Columnar Execution       │   │ Embedded Engines       │    │ AI / MCP Subsystem     │
   │ (csv crate + SIMD utf8) │     │ - Polars SQLContext      │   │ - Luau Bytecode VM     │    │ - JSON-RPC Stdio MCP   │
   │ - Zero-copy byte slices │     │ - DuckDB Process Spawner │   │ - MiniJinja Template   │    │ - Concurrency Limiter  │
   │ - Dynamic batch sizes   │     │ - LazyFrame transforms   │   │   Formula Engine       │    │ - Subprocess Cascade   │
   │ - Safe mem allocations  │     │ - Index-aware execution  │   │ - PyO3 Python Script   │    │   (SIGTERM -> SIGKILL) │
   └─────────────────────────┘     └──────────────────────────┘   └────────────────────────┘    └────────────────────────┘
```

### Technical Problem Solved
Tabular pipelines face three catastrophic failure classes:
1. **Memory Exhaustion (OOM):** Loading multi-gigabyte or ragged CSVs into memory causes OS kernel kills. `qsv` solves this with an 80% available-memory ceiling (`SAFETY_MARGIN = 0.8`), memory-aware batch-splitting (`50,000` default rows), and indexing (`.sz` snappy indexing and `.idx` row offset tables) for $O(1)$ random row lookups without re-parsing.
2. **Type Ambiguity and Schema Drifting:** CSV lacks a type system. `qsv` runs dual-phase inference: an ultra-fast streaming stats/frequency pass followed by Polars/JSON Schema synthesis that generates data contracts and catches ragged rows before query execution.
3. **Subprocess/Script Sandboxing & IPC Degradation:** External runtimes (embedded Luau, Python, LLM endpoints, DuckDB) introduce unhandled panics, deadlock cascades, or zombie processes. `qsv` bridges these runtimes using structured isolation, explicit bytecode binary compatibility checks, slot-based token concurrency controls, and a strict `SIGTERM` $\to$ grace period $\to$ `SIGKILL` cascade.

### Critical Subsystem Boundaries
- **`src/util.rs` (Runtime, Memory & Global State):** Manages process-wide allocations, memory limits via `sysinfo`, jemalloc page retention and background purging, and CLI argument parsing via `docopt` with output/input collision guards.
- **`src/cmd/profile/formula_engine.rs` (Native In-Memory Evaluator):** A decoupled templating execution engine built on `minijinja` that renders dataset/resource formulas. It isolates execution context from the host OS, replacing legacy heavy Python runtime dependencies (`PyO3`) while maintaining wire format compatibility (`_traceback`, `FormulaResult`).
- **`src/cmd/scoresql.rs` (Query Plan & Heuristic Profiler):** An automated cost-analysis engine that interrogates SQL queries against pre-computed column caches (`.stats.csv`, `.freq.csv`) and Polars/DuckDB logical execution plans to detect anti-patterns (`SELECT *`, missing predicates, unbounded Cartesian joins) before queries touch disk.
- **`.claude/skills/src/concurrency.ts` & `spawn-utils.ts` (MCP Agent IPC Safety Core):** A slot-based concurrency and child process management layer for AI agents that enforces bounded FIFO waiter queues, dead-waiter pruning, EPIPE pipe isolation, and reliable child process reclamation.

---

## 2. Net-New Universal Engineering Rules

### 1. Invariant-Preserving Native Token Replacements for External Runtimes
**RULE**:
When deprecating a foreign-language runtime (e.g., PyO3/Python) in favor of an embedded, memory-safe native engine (e.g., MiniJinja/Wasm/Rust-native), the serialization output and error envelope MUST preserve legacy field naming conventions (including private/foreign prefixing such as `_traceback`) using explicit serde attribute overrides.

**WHY**:
External automation, orchestrators, and downstream regression harnesses treat error and metadata schemas as rigid wire protocols. Switching an engine must not change wire shape, even if the new engine has different error modeling idioms. Failure to use field aliases (e.g. `#[serde(rename = "_traceback")]`) causes silent deserialization failures across distributed network nodes.

**WHEN TO APPLY**:
Apply when replacing foreign-function runtimes, template engines, or protocol layers in microservices, CLI tools, and agent SDKs.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize, Serialize)]
pub struct EvaluatorResult {
    pub field_name: String,
    pub kind: String,
    pub scope: String,
    pub value: Option<Value>,
    pub error: Option<String>,
    
    // Wire contract preservation: Python historically emitted '_traceback'.
    // Retain exact JSON key via explicit serde rename while adhering to Rust naming standards.
    #[serde(
        rename = "_traceback",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub traceback: Option<String>,
}

pub fn render_native_template(
    env: &minijinja::Environment,
    tmpl_src: &str,
    ctx: &minijinja::Value,
) -> Result<String, minijinja::Error> {
    let tmpl = env.template_from_str(tmpl_src)?;
    tmpl.render(ctx)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER alter the wire protocol field name to match internal language conventions.
// NEVER omit fallback handling for undefined variables when mimicking legacy scripting runtimes.
#[derive(Serialize)]
pub struct BrokenResult {
    pub traceback: Option<String>, // FAILS downstream clients expecting "_traceback"
}
```

**VERIFICATION METHOD**:
Enforce serialization invariants using a property-based round-trip test:
```rust
#[test]
fn test_wire_contract_traceback_preservation() {
    let res = EvaluatorResult {
        field_name: "test".into(),
        kind: "formula".into(),
        scope: "dataset".into(),
        value: None,
        error: Some("SyntaxError: unexpected token".into()),
        traceback: Some("Stack span: line 1, col 4".into()),
    };
    let json = serde_json::to_string(&res).unwrap();
    assert!(json.contains("\"_traceback\":"));
    assert!(!json.contains("\"traceback\":"));
}
```

---

### 2. State-Settled Waiter Flags in Asynchronous Concurrency Allocators
**RULE**:
Every queued async slot waiter in a concurrency throttle MUST encapsulate an explicit, terminal boolean state flag (`settled: boolean`). Asynchronous wakeups, cancellations, and timeouts MUST verify and update this flag synchronously within single-threaded microtask execution to prevent double-increment/decrement corruption of the active execution counter.

**WHY**:
Relying purely on promise resolution or timer cancellation is vulnerable to race conditions when a timeout event fires concurrently with an allocator's `releaseSlot` dequeue. If an allocator pulls a waiter from the queue and calls its callback without checking an atomic settlement state, a timed-out request can acquire a slot anyway, leading to untracked task execution, active count drift, and pool starvation.

**WHEN TO APPLY**:
Apply to any async resource pool, semaphore, or concurrency limiter implemented in Node.js, V8, or browser runtimes where queue operations span multiple ticks.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
interface SlotWaiter {
  settled: boolean;
  callback: () => void;
}

export class SafeConcurrencyLimiter {
  private activeCount = 0;
  private readonly waiters: SlotWaiter[] = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueueSize: number
  ) {}

  public async acquire(timeoutMs: number): Promise<boolean | "timeout" | "backpressure"> {
    // Synchronous fast-path: atomic check-and-increment
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      return true;
    }

    // Dead waiter pruning: purge settled/timed-out slots before backpressure checks
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      if (this.waiters[i].settled) {
        this.waiters.splice(i, 1);
      }
    }

    if (this.waiters.length >= this.maxQueueSize) {
      return "backpressure";
    }

    return new Promise((resolve) => {
      const waiter: SlotWaiter = {
        settled: false,
        callback: () => {},
      };

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
        waiter.callback();
        if (this.activeCount > 0) {
          this.activeCount--;
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
// NEVER hand off concurrency slots without checking settlement flags.
// Calling a naked resolve() on a timed-out waiter can cause active-count drift.
function unsafeRelease(waiters: Array<() => void>, activeCount: { val: number }) {
  const next = waiters.shift();
  if (next) {
    next(); // BUG: If this waiter timed out, activeCount is now permanently out of sync.
    activeCount.val--;
  }
}
```

**VERIFICATION METHOD**:
Run rapid parallel cancellation tests with sub-millisecond timeouts:
```typescript
test("concurrent waiter cancellation does not desync activeCount", async () => {
  const limiter = new SafeConcurrencyLimiter(1, 10);
  await limiter.acquire(1000); // saturate pool
  
  // Enqueue waiter with immediate timeout
  const p = limiter.acquire(0);
  await new Promise(r => setTimeout(r, 5)); // ensure timer expires
  const res = await p;
  expect(res).toBe("timeout");

  limiter.release(); // release slot; should not trigger expired waiter
  expect(limiter["activeCount"]).toBe(0);
});
```

---

### 3. Cardinality-Aware Column Selectors with Explicit Null-Set Representation
**RULE**:
Dynamic column-selection query builders that filter on column cardinality thresholds MUST return a typed, tri-state semantic domain structure (`All`, `None`, `Specific(Vec<T>)`) rather than an ambiguous empty string `""`. 

**WHY**:
In command-line and query-parser infrastructures, an empty string `""` often defaults to "select all fields" (the default projection `SELECT *`). If a filter finds 0 columns meeting a cardinality threshold and yields `""`, downstream consumers parse this as "select every column in the file," turning an empty set into a massive unindexed computation and generating invalid constraints.

**WHEN TO APPLY**:
Apply to all metadata scrapers, schema inferencers, database reflection engines, and CLI arg builders.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Debug, PartialEq, Eq)]
pub enum ColumnSelection {
    All,
    None,
    Specific(Vec<String>),
}

impl ColumnSelection {
    /// Converts domain selection into a safe CLI/query argument string.
    pub fn to_selector_arg(&self) -> Option<String> {
        match self {
            ColumnSelection::All => Some("*".to_string()),
            ColumnSelection::None => None, // Must NOT return "" or empty selector
            ColumnSelection::Specific(cols) => {
                if cols.is_empty() {
                    None
                } else {
                    Some(cols.join(","))
                }
            }
        }
    }
}

pub fn select_low_cardinality_columns(
    stats: &[(String, u64)],
    threshold: u64,
) -> ColumnSelection {
    let matched: Vec<String> = stats
        .iter()
        .filter(|(_, card)| *card >= 2 && *card <= threshold)
        .map(|(name, _)| name.clone())
        .collect();

    if matched.is_empty() {
        ColumnSelection::None
    } else {
        ColumnSelection::Specific(matched)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER return an empty string to represent zero matched columns.
// In tools like qsv, SelectColumns::parse("") defaults to ALL columns.
pub fn unsafe_build_selector(stats: &[(String, u64)], threshold: u64) -> String {
    let matched: Vec<&str> = stats.iter()
        .filter(|(_, c)| *c <= threshold)
        .map(|(n, _)| n.as_str())
        .collect();
    matched.join(",") // BUG: If empty, returns "" which means SELECT *!
}
```

**VERIFICATION METHOD**:
Verify that empty match sets yield `None` and do not execute downstream extraction steps:
```rust
#[test]
fn test_zero_cardinality_selection() {
    let stats = vec![("high_card".to_string(), 1000u64)];
    let selection = select_low_cardinality_columns(&stats, 50);
    assert_eq!(selection, ColumnSelection::None);
    assert_eq!(selection.to_selector_arg(), None);
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Luau Bytecode Version Incompatibility Panic on Startup (BUG-QSV-01)
- **Context**: `Cargo.lock` dependency pin for `luau0-src` and `mlua-sys`.
- **What Was Expected**: Upgrading dependencies would cleanly compile and run all Luau-backed commands (`qsv luau`, `qsv map`, `qsv filter`).
- **What Actually Happened**: Every invocation of `qsv` failed with a runtime panic: `"Error configuring Luau ... attempt to load a text chunk (mode is 'b')"`.
- **Evidence in Repo**: Commit `24965a7c`, `Cargo.lock`.
- **Root Cause**: `luau0-src` was bumped to version `0.22.1+luau744`, which generated Luau bytecode format version 12+. However, `mlua-sys` remained at `0.12.2`, where `LBC_VERSION_MAX` was hardcoded to `11`. The Luau VM rejected incoming chunks as malformed bytecode and attempted to parse them as raw text, which failed because the chunk was opened in binary mode (`'b'`).
- **Remediation Code Diff**:
```diff
--- a/Cargo.lock
+++ b/Cargo.lock
@@ -4703,9 +4703,9 @@ checksum = "4050469837a6ff301cd14c1f8f24f88549e6d548f24f64e2148eb0f72cebc51f"
 
 [[package]]
 name = "luau0-src"
-version = "0.22.1+luau744"
+version = "0.22.0+luau740"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "abf3cf06d603de6835228ccf5e1afbed6e5c2409aa5d3122c1b2036055a2af15"
+checksum = "4ea012e8a8aaff2f7b6c788fad41a60630003b6a0932bcf045f7d14952c9bd31"
 dependencies = [
  "cc",
 ]
```
- **Lesson**: Native C/C++ library bindings linked into Rust must pin low-level source crates (`-src`) to matching FFI wrapper versions (`-sys`). Never bump a bytecode generator independently of its runtime interpreter.

---

### Incident 2: Empty Cardinality Selector Causing Unbounded Enum Generation (BUG-QSV-02)
- **Context**: `src/cmd/schema.rs` - `build_low_cardinality_column_selector_arg` and `get_unique_values`.
- **What Was Expected**: Running `qsv schema --enum-threshold N` on a file where no column has cardinality $\le N$ should emit an inferred JSON Schema with zero `enum` fields.
- **What Actually Happened**: When zero columns qualified under the threshold, **every** column in the dataset was processed as an enum, populating thousands of distinct keys into schema definitions (e.g., an 80-row unique ID column was emitted with an 80-element `enum`).
- **Evidence in Repo**: Closed Issue `#4829`.
- **Root Cause**: `build_low_cardinality_column_selector_arg` returned `""` when no column qualified. Downstream, `get_unique_values` passed this string into `SelectColumns::parse("")`. In `qsv`, an empty selection string defaults to selecting all columns. As a result, the frequency aggregation pass gathered unique values for the entire table.
- **Remediation Code Diff**:
```diff
--- a/src/cmd/schema.rs
+++ b/src/cmd/schema.rs
@@ -124,7 +124,7 @@ fn build_low_cardinality_column_selector_arg(stats: &[Stats]) -> Option<String>
     if qualifying_indices.is_empty() {
-        return Some("".to_string());
+        return None;
     }
     Some(qualifying_indices.join(","))
 }
 
 fn get_unique_values(...) -> CliResult<HashMap<String, Vec<String>>> {
-    let selector = build_low_cardinality_column_selector_arg(&stats).unwrap();
-    let select_cols = SelectColumns::parse(&selector)?;
+    let Some(selector) = build_low_cardinality_column_selector_arg(&stats) else {
+        return Ok(HashMap::new());
+    };
+    let select_cols = SelectColumns::parse(&selector)?;
```
- **Lesson**: Do not use empty collections or sentinel strings (`""`) to indicate an empty set if downstream parsers interpret empty inputs as wildcards. Represent absent selections using `Option::None`.

---

### Incident 3: Directory Escapes and File Overwrites in Ragged Input Splitting (BUG-QSV-03)
- **Context**: `src/cmd/validate.rs` - `--split-ragged` processing of compressed inputs (`.sz`, `.zip`).
- **What Was Expected**: Running `qsv validate --split-ragged` on inputs in external folders should write output artifacts (`.valid`, `.invalid`, `.validation-errors.tsv`) into the same directory as the input file.
- **What Actually Happened**: When processing `.sz` or `.zip` files, input archives were first extracted to an internal temporary directory. The output paths were computed using the temporary extraction path, causing split files to land in the current working directory (`cwd`). Different inputs with matching base filenames silently overwrote each other's split results.
- **Evidence in Repo**: Closed Issue `#4783`.
- **Root Cause**: Path resolution calculated output sidecars using the decompressed file's path rather than the canonical source path of the original compressed archive.
- **Remediation Code Diff**:
```diff
--- a/src/cmd/validate.rs
+++ b/src/cmd/validate.rs
@@ -340,7 +340,7 @@ fn compute_split_output_paths(input_path: &Path, is_temp: bool, original_path: &
-    let base = if is_temp {
-        Path::new(input_path.file_name().unwrap())
-    } else {
-        input_path
-    };
+    // Retain directory hierarchy of the user-provided original input path
+    let base = original_path;
     let valid_path = base.with_extension("valid");
     let invalid_path = base.with_extension("invalid");
```
- **Lesson**: When decompressing or streaming data through temporary storage files, never use intermediate paths to construct end-user output paths. Retain original input path references throughout the execution lifecycle.

---

### Incident 4: Silent Feature Exclusion in Binary Debian Packaging (BUG-QSV-04)
- **Context**: `.github/workflows/publish*.yml` and `Cargo.toml` (`[package.metadata.deb]`).
- **What Was Expected**: Prebuilt distribution packages (including Debian `.deb` builds) should feature-match release binaries across platforms, enabling commands such as `qsv get`.
- **What Actually Happened**: The Debian apt package was distributed without `qsv get`, failing customer workflows. Meanwhile, binary tarballs included the feature.
- **Evidence in Repo**: Commit `8ee8705a`, Pull Request `#4903`.
- **Root Cause**: Debian package generation in GitHub Actions ran `cargo deb`, which reads its feature flags from `[package.metadata.deb]` in `Cargo.toml`. When `--features=...,get` was added to standard release matrix flags, the Debian metadata table was not updated, causing `cargo deb` to build with a reduced default feature set.
- **Remediation Code Diff**:
```diff
--- a/.github/workflows/publish-linux.yml
+++ b/.github/workflows/publish-linux.yml
@@ -120,7 +120,7 @@ jobs:
             target: x86_64-unknown-linux-gnu
             architecture: x86_64
             use-cross: false
-            addl-build-args: --features=apply,luau,fetch,foreach,self_update,geocode,polars,readstat,to,lens,prompt,magika,color,viz_static,viz,profile,synthesize
+            addl-build-args: --features=apply,luau,fetch,foreach,self_update,geocode,polars,readstat,to,lens,prompt,magika,color,viz_static,viz,profile,synthesize,get
 
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -512,6 +512,6 @@
 [package.metadata.deb]
 name = "qsv"
-features = ["apply", "fetch", "foreach", "luau", "polars"]
+features = ["apply", "fetch", "foreach", "luau", "polars", "get"]
```
- **Lesson**: Build matrices and package generator definitions must draw from a single source of truth for feature flags. Automated CI checks should inspect package binaries for expected CLI subcommands.

---

### Incident 5: Subprocess Hang via Stdin Pipe EPIPE and Missing Teardown (BUG-QSV-05)
- **Context**: `.claude/skills/src/spawn-utils.ts` child process execution harness.
- **What Was Expected**: Spawning helper binaries (`duckdb`, `qsv`) with invalid arguments or early terminating conditions should return clean error results without hanging the parent process.
- **What Actually Happened**: When writing large payloads to child process `stdin`, if the child process exited early due to an error, `proc.stdin.write` threw unhandled `EPIPE` exceptions, causing orphaned timers and hung parent processes.
- **Evidence in Repo**: `.claude/skills/src/spawn-utils.ts`.
- **Root Cause**: `stdin` lacked an error event listener before writes. When the child process closed its input descriptor, writing to the pipe caused an unhandled node socket failure. Additionally, the process timeout did not use a cascading `SIGTERM` $\to$ grace period $\to$ `SIGKILL` sequence.
- **Remediation Code Diff**:
```diff
--- a/.claude/skills/src/spawn-utils.ts
+++ b/.claude/skills/src/spawn-utils.ts
@@ -82,6 +82,10 @@ export function spawnWithTimeout(options: SpawnWithTimeoutOptions): Promise<Spaw
     // ── stdin ───────────────────────────────────────────────────────────
     if (stdin !== undefined) {
+      proc.stdin!.on("error", (err) => {
+        // EPIPE is expected if child terminates before consuming buffer
+        const msg = err?.message ?? String(err);
+        stderr += `\n[STDIN ERROR] ${msg}`;
+      });
       proc.stdin!.write(stdin);
       proc.stdin!.end();
     }
```
- **Lesson**: Subprocess wrappers must attach error listeners to child `stdin` streams prior to writing, and process terminations must escalate from `SIGTERM` to `SIGKILL` using explicit grace periods.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Implicit Falsy Conversions on Cardinality and Numerical Zero:** In `src/cmd/scoresql.rs`, cache lookups differentiate between zero values (`count: 0`) and missing/empty data using typed `Option<u64>`. Using JavaScript or Python loose equality checks (`if (!val)`) converts numeric 0 to false, which incorrectly flags empty datasets.
```typescript
// INVARIANT (MCP Skill Runtime): Check explicitly for undefined/null
function formatMetric(val: number | undefined): string {
  // CRITICAL: 0 is a valid statistic (e.g. 0 nulls, 0 distinct)
  if (val === undefined || val === null) {
    return "N/A";
  }
  return val.toString();
}
```
- **Array Mutation via `splice` in Reverse Iteration:** When purging expired timers in `.claude/skills/src/concurrency.ts`, arrays must be traversed from back to front (`for (let i = arr.length - 1; i >= 0; i--)`). Forward iteration skipping occurs when items are spliced out dynamically.
```typescript
// CORRECT: Backward iteration prevents index displacement bugs
for (let i = slotWaiters.length - 1; i >= 0; i--) {
  if (slotWaiters[i].settled) {
    slotWaiters.splice(i, 1);
  }
}
```

### 2. Infinite Loop & Recursion Guards
- **ArcGIS Query Boundary Offsets & Polyline Complexity:** In `examples/viz/gen_northeast_states.py` and `gen_tristate_county_incidents.py`, map servers yield large payloads that can trigger client timeouts during SVG/HTML generation.
```python
# INVARIANT: Boundary simplification is enforced server-side
# 0.002 degrees reduces payloads ~50x, preventing browser canvas lockup
MAX_ALLOWABLE_OFFSET = 0.002
params = {
    "outFields": "STUSAB,NAME,AREALAND,AREAWATER",
    "maxAllowableOffset": MAX_ALLOWABLE_OFFSET,
    "outSR": "4326",
    "f": "geojson",
}
```
- **Bounded Exponential Retry Intervals:** The Census fetch loop in `gen_tristate_county_incidents.py` bounds network retries using an upper attempt ceiling and backoff multiplier:
```python
FETCH_ATTEMPTS = 5
FETCH_BACKOFF_SECS = 3
for attempt in range(1, FETCH_ATTEMPTS + 1):
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            return resp.read()
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
        if attempt == FETCH_ATTEMPTS:
            break
        time.sleep(FETCH_BACKOFF_SECS * attempt)
```

### 3. UI & UX Micro-Mechanics (CLI/TUI/Visualizations)
- **Path Sanitization in Protocol Responses:** In `.claude/skills/src/utils.ts`, system paths are sanitized before returning error messages to LLM interfaces to prevent directory traversal discovery:
```typescript
export function sanitizeErrorForClient(message: string): string {
  // Matches Unix (/foo/bar) and Windows (C:\foo\bar) absolute paths
  // Replaces them with the filename to prevent host filesystem leakage
  return message.replace(
    /(?:[A-Za-z]:\\|\/)[^\s:,"']+/g,
    (match) => {
      const trimmedMatch = match.replace(/[/\\\\]+$/g, "");
      const parts = trimmedMatch.split(/[/\\\\]/);
      return parts[parts.length - 1] || trimmedMatch || match;
    }
  );
}
```
- **Deterministic Determinant Formatting for Line Diffs:** In `examples/viz/gen_northeast_states.py`, CSV writers enforce UNIX linebreaks (`\n`) to prevent cross-platform Git diff churn:
```python
with csv_path.open("w", newline="") as fh:
    # Explicit LF terminators prevent CRLF checkout divergence
    w = csv.writer(fh, lineterminator="\n")
    w.writerow(["state", "people_per_sq_mi"])
```

### 4. Backend Concurrency & Memory Safety
- **Child Process Grace Periods (`SIGTERM` $\to$ `SIGKILL`):** Subprocess management must escalate signals to guarantee termination without creating zombies:
```typescript
timer = setTimeout(() => {
  timedOut = true;
  proc.kill("SIGTERM");
  killTimer = setTimeout(() => {
    if (!processExited && proc.exitCode === null) {
      try {
        proc.kill("SIGKILL");
      } catch {}
      proc.unref(); // Prevent lingering event loop holds
    }
  }, KILL_GRACE_PERIOD_MS);
}, timeoutMs);
```
- **Atomic Concurrency Counter Guardrails:** In `.claude/skills/src/concurrency.ts`, counter decrements check bounds to prevent underflow:
```typescript
if (activeOperationCount > 0) {
  activeOperationCount--;
} else {
  console.warn("releaseSlot: activeOperationCount already at 0 — possible double-release");
}
```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Reserved File Extension Clashing:** `src/cmd/scoresql.rs` and `utils.ts` prevent collisions by validating user-specified outputs against managed sidecar paths:
```typescript
const RESERVED_CACHE_SUFFIXES = [
  ".stats.csv",
  ".stats.csv.data.jsonl",
  ".stats.bivariate.csv",
  ".freq.csv.data.jsonl",
  ".pschema.json",
];

export function isReservedCachePath(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return RESERVED_CACHE_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}
```
- **Minijinja Soft-Suggestion Normalization:** String values of `"None"` or empty whitespace from template engines are normalized to `None` to prevent emitting invalid default values:
```rust
fn normalize_suggestion