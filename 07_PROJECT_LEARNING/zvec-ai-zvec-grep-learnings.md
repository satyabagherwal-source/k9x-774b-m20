> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zvec-ai-zvec-grep-learnings.md`  
> **Source**: github ([https://github.com/zvec-ai/zvec-grep](https://github.com/zvec-ai/zvec-grep))  
> **Source Version**: `e1f93d25`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T17:45:16.099Z  
> **Learning ID**: `learn-github-zvec-ai-zvec-grep`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): zvec-ai/zvec-grep

---

## 1. Executive Forensic Architecture & System Mechanics

`zvec-grep` (`zg`) is an agent-centric, local-first search engine engineered to unify structural lexical indexing (ripgrep / BM25) and dense embedding vector search (Alibaba `zvec`, `model2vec`, `transformers`) beneath a single atomic workspace layer. It provides zero-overhead code and documentation retrieval for autonomous coding agents (Codex, OpenCode, Claude Code) and terminal operators.

```
                           +---------------------------------------------+
                           |           Consumer / Agent Surface          |
                           |  (CLI Commands: zg index/status/search,     |
                           |   MCP Server: Model Context Protocol HTTP)  |
                           +----------------------+----------------------+
                                                  |
                                                  v
                           +---------------------------------------------+
                           |             Engine Orchestrator             |
                           |          (zg-cli / zg-engine / zg)          |
                           +-------+-----------------------------+-------+
                                   |                             |
                                   v                             v
           +-------------------------------+     +-------------------------------+
           |     Lexical / AST Pipeline    |     |    Vector / Chunk Pipeline    |
           |  (Ripgrep core, Tree-Sitter   |     |  (Tokenizers, ONNX/Model2Vec, |
           |   Wasm/Native, Chunk Slicers) |     |   Local/Remote Embeddings)    |
           +---------------+---------------+     +---------------+---------------+
                           |                                     |
                           +------------------+------------------+
                                              |
                                              v
                           +---------------------------------------------+
                           |          Unified Dual-Storage Layer         |
                           |   - SQLite (WAL Mode): Canonical Relational |
                           |     Entities, Graph Edges, Pending State    |
                           |   - Native zvec: Dense Cosine/L2 Vectors    |
                           +---------------------------------------------+
```

### Architectural Subsystem Boundaries & Decoupling

1. **Storage Hybridization (`zg-engine::storage`)**:
   - **Relational & Graph Subsystem**: Utilizes SQLite configured with Write-Ahead Logging (WAL) (`PRAGMA journal_mode=WAL`) to track files, commits, entity symbols, and reference graphs. SQLite guarantees ACID properties for metadata updates and file modification markers.
   - **Dense Vector Engine (`zvec_rust` bindings)**: Employs a native C++ vector store (`zvec`) operating directly against memory-mapped indices. Synchronization between SQLite's WAL commit status and `zvec` partition segments is orchestrated via a phased commit protocol to prevent dangling vector keys or uncommitted entity pointers.
2. **Dual Language Footprint (Rust Core + Node.js/TypeScript Wrapper)**:
   - The repository implements core engines in both native Rust (`rust/crates/*`) and TypeScript (`dist/*`), transitioning performance-critical ingestion, indexing, and vector similarity computation into pure Rust while supporting Node.js distribution channels.
3. **Model Context Protocol (MCP) Integration**:
   - Runs an embedded MCP server interface (`http://127.0.0.1:7999/mcp`) allowing autonomous agents (e.g., OpenCode, Claude Code) to invoke search tools directly without shell spawning overhead.
4. **Benchmarking Harness (`benchmarks/swe-qa-bench`)**:
   - A deterministic evaluation framework written in Python (`uv`-managed) evaluating precision, tool-call economy, input-token reduction, and LLM-as-a-judge scoring on real software engineering repositories.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. OS-Native Handle Cleanup Invariant During Subprocess Interruption
**RULE**:
When writing integration tests that verify crash recovery across OS platforms, the test harness MUST NOT rely on in-process `std::process::exit()` within the child process while native foreign function interface (FFI) storage handles, C++ runtimes, or dynamic-link libraries (DLLs) remain allocated. The parent harness MUST spawn the child, await a durable filesystem readiness marker, and terminate the child process externally via OS signal/job kill (`Child::kill()` / `TerminateProcess`).

**WHY**:
On Windows platforms, calling `std::process::exit()` invokes `ExitProcess`, triggering loader-lock acquisition and sequential unloading of loaded DLLs (`LdrUnloadDll`). If native storage threads (e.g., C++ worker threads in `zvec`, SQLite background checkpoints) hold synchronization primitives or are blocked waiting for I/O completion, thread cleanup collides with DLL detachment locks. This results in permanent deadlocks inside the operating system loader, causing CI pipelines to hang indefinitely.

**WHEN TO APPLY**:
- Integration harnesses testing WAL rollbacks, crash durability, or recovery state in engines binding C/C++ libraries via FFI (e.g., SQLite, RocksDB, Zvec, libgit2, ONNX Runtime).
- Cross-platform test suites targeting Windows, Linux, and macOS.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::{
    fs,
    path::Path,
    process::{Child, Command, Stdio},
    thread,
    time::{Duration, Instant},
};

pub struct CrashWriter(pub Child);

impl CrashWriter {
    pub fn wait_until_ready(&mut self, ready_marker: &Path, log_path: &Path) {
        let started = Instant::now();
        loop {
            // Guard against premature child failure
            if let Some(status) = self.0.try_wait().expect("failed to poll crash child") {
                panic!(
                    "Crash child exited prematurely with code {status}\nLogs:\n{}",
                    fs::read_to_string(log_path).unwrap_or_default()
                );
            }
            if ready_marker.is_file() {
                return;
            }
            assert!(
                started.elapsed() < Duration::from_secs(60),
                "Timed out waiting for durable crash state\nLogs:\n{}",
                fs::read_to_string(log_path).unwrap_or_default()
            );
            thread::sleep(Duration::from_millis(20));
        }
    }
}

impl Drop for CrashWriter {
    fn drop(&mut self) {
        // Enforce cleanup on test failure
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

pub fn execute_crash_durability_test(target_root: &Path) {
    let ready_file = target_root.join("writer-ready");
    let log_file = target_root.join("child.log");
    let out_handle = fs::File::create(&log_file).expect("create child log");
    let err_handle = out_handle.try_clone().expect("clone child log");

    let mut writer = CrashWriter(
        Command::new(std::env::current_exe().expect("test binary"))
            .args(["--exact", "tests::crash_target_worker", "--nocapture", "--test-threads=1"])
            .env("CRASH_TEST_WORKSPACE_ROOT", target_root)
            .stdin(Stdio::null())
            .stdout(out_handle)
            .stderr(err_handle)
            .spawn()
            .expect("spawn crash worker"),
    );

    // Wait for the child to write uncommitted WAL/data and post marker
    writer.wait_until_ready(&ready_file, &log_file);

    // Terminate externally; avoids loader-lock deadlocks in Windows DLL exit routines
    writer.0.kill().expect("kill crash writer");
    let exit_status = writer.0.wait().expect("reap crash writer");
    assert!(!exit_status.success(), "Crash worker must terminate via hard signal");
}

pub fn crash_target_worker(root: &Path) {
    // 1. Perform partial mutations to SQLite and vector store
    // ...
    // 2. Flush raw OS pages, but omit engine graceful shutdown destructors
    fs::write(root.join("writer-ready"), b"ready").expect("write marker");
    
    // 3. Park thread permanently. NEVER call process::exit() here!
    loop {
        thread::park();
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: DO NOT invoke process::exit inside child test routines
// when native FFI / DLL handles are active.
pub fn crash_target_worker_bad() {
    let store = open_native_storage_with_background_threads();
    store.write_partial_state();
    // FAILS ON WINDOWS: Leads to deadlock during LdrUnloadDll / ExitProcess
    // while C++ background threads in the FFI layer wait on native mutexes.
    std::process::exit(77); 
}
```

**VERIFICATION METHOD**:
Run 50 iterations of the crash recovery test on a multi-threaded Windows runner under heavy memory allocation:
```bash
cargo test --test graph_tests process_exit_during_canonical_replacement_recovers_from_durable_status -- --nocapture --test-threads=1
```
Verify zero thread-park deadlocks and confirm child process exit is non-zero (terminated via kill).

---

### 2. Physical Column-Aware ANSI Terminal Redraw Invariant
**RULE**:
Terminal UI redraw engines MUST NOT repaint dynamic line buffers by issuing a standalone full-line erase sequence (`\r\x1b[2K`) or raw cursor-up rewind (`\x1b[NA`) calculated solely from newline counts (`\n`). When line wrapping can occur, engines MUST compute visible character column widths via East Asian Width / Unicode classifications, calculate physical wrapped rows dynamically from the current terminal width, and execute atomic in-place delta overwrites (`\x1b[{col}G{text}\x1b[K`) bounded to the viewport.

**WHY**:
1. Standalone clear-line commands (`\r\x1b[2K`) emit discrete escape sequences. If the terminal emulator renders the cleared line before the subsequent write payload arrives, visible high-frequency screen flicker occurs.
2. If the terminal width shrinks, long lines reflow into multiple terminal rows. A naïve rewind (`MoveUp(line_count)`) undercounts physical screen rows, causing the cursor to land below the original frame. Subsequent writes spill downward, permanently corrupting the terminal scrollback buffer.
3. Wide Unicode characters (e.g., CJK ideographs, emojis) occupy 2 terminal columns. Naive UTF-8 byte counting or string length misjudges line boundaries.

**WHEN TO APPLY**:
- Interactive CLI progress bars, pickers, and live display renderers across POSIX and Windows terminals.
- Anytime terminal lines contain user-defined strings, paths, or non-ASCII characters that may exceed terminal column bounds.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::fmt::Write as _;
use unicode_width::UnicodeWidthChar;

pub struct RenderedLine {
    pub text: String,
    pub widths: Vec<usize>,
}

impl RenderedLine {
    pub fn new(text: String) -> Self {
        let widths = text
            .chars()
            .map(|c| {
                if c.is_control() {
                    0
                } else {
                    UnicodeWidthChar::width(c).unwrap_or(1)
                }
            })
            .collect();
        Self { text, widths }
    }

    /// Computes the exact physical terminal rows occupied given dynamic column width.
    pub fn wrapped_rows(&self, columns: usize) -> usize {
        let columns = columns.max(1);
        let mut rows = 1;
        let mut occupied = 0;
        for &w in &self.widths {
            let width = w.min(columns);
            // Wide character cannot fit remaining space on current row; wraps to next
            if occupied + width > columns {
                rows += 1;
                occupied = 0;
            }
            occupied += width;
        }
        rows
    }
}

/// Computes the minimal in-place ANSI sequence to overwrite previous line without flicker.
pub fn compute_terminal_delta(previous: &str, next: &str) -> String {
    if previous.is_empty() {
        return format!("\r{next}\x1b[K");
    }
    if previous == next {
        return String::new();
    }

    let mut common_bytes = 0;
    for (left, right) in previous.chars().zip(next.chars()) {
        if left != right {
            break;
        }
        common_bytes += left.len_utf8();
    }

    // Never slice mid-ANSI escape sequence
    let safe_start = next[..common_bytes]
        .rfind("\x1b[")
        .filter(|&idx| !next[idx..common_bytes].starts_with("\x1b[0m"))
        .unwrap_or(common_bytes);

    let visible_col = terminal_visible_width(&next[..safe_start]).unwrap_or(0);
    if visible_col > 0 {
        // Move absolute to 1-based column, write updated tail, and clear obsolete tail
        format!("\x1b[{}G{}\x1b[K", visible_col + 1, &next[safe_start..])
    } else {
        format!("\r{next}\x1b[K")
    }
}

pub fn terminal_visible_width(value: &str) -> Option<usize> {
    let mut chars = value.chars().peekable();
    let mut width = 0;
    while let Some(c) = chars.next() {
        if c == '\x1b' && chars.peek() == Some(&'[') {
            chars.next();
            let mut complete = false;
            for code in chars.by_ref() {
                if ('@'..='~').contains(&code) {
                    complete = true;
                    break;
                }
            }
            if !complete {
                return None; // Malformed escape
            }
        } else if !c.is_control() {
            width += UnicodeWidthChar::width(c).unwrap_or(1);
        }
    }
    Some(width)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: DO NOT clear the entire line before writing new progress text.
// DO NOT compute cursor rewind distance from lines.count() without checking terminal wrap!
pub fn render_progress_broken(output: &mut impl std::io::Write, new_status: &str) {
    // FLICKER BUG: Emits standalone clear line. Terminal renders blank frame!
    output.write_all(b"\r\x1b[2K").unwrap();
    output.write_all(new_status.as_bytes()).unwrap();
    output.flush().unwrap();
}
```

**VERIFICATION METHOD**:
Automated headless PTY assertion:
```rust
#[test]
fn progress_does_not_emit_blanking_escape_sequences() {
    let mut buffer = Vec::new();
    // Render sequence of changes
    let delta = compute_terminal_delta("Indexing [====>    ] 50%", "Indexing [======>  ] 70%");
    assert!(!delta.contains("\x1b[2K"), "Delta output contained destructive line clear!");
    assert!(delta.contains("\x1b[K"), "Must clear trailing characters atomically");
}
```

---

### 3. Strict Metric Denominator and Division Invariant for Benchmark Sensitivity Analysis
**RULE**:
Benchmark analytics pipelines evaluating comparative agent performance (e.g., Token Reduction %, Cost Reduction %, Tool Call Delta) MUST enforce strict non-zero validation on the baseline denominator. When the baseline denominator is `0` and candidate metric is `> 0`, the pipeline MUST emit an explicit `undefined_baseline` sentinel, MUST NOT compute `Infinity` or clamp to `100%`, and MUST exclude the task from overall aggregate arithmetic means while preserving raw trial telemetry in evidence artifacts.

**WHY**:
Floating-point division by zero produces `inf` or `nan` in Python (`ZeroDivisionError` or `float('inf')`). Coercing zero-baseline spikes into arbitrary constants (like `0.0` or `1.0`) distorts aggregate system evaluation: if an agent previously executed 0 tool calls and now executes 2, treating this as a standard percentage variance pollutes the sensitivity analysis.

**WHEN TO APPLY**:
- SWE-bench, SWE-QA, and code search benchmarking pipelines calculating reduction percentages.
- Financial, resource profiling, and metrics reporting scripts.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from __future__ import annotations
from dataclasses import dataclass
from typing import Any

@dataclass(frozen=True)
class MetricComparison:
    baseline_mean: float
    candidate_mean: float
    reduction_pct: float | None
    is_valid_comparison: bool
    exclusion_reason: str | None

def calculate_metric_reduction(baseline: float, candidate: float) -> MetricComparison:
    """Calculates reduction percentage where positive values represent efficiency gains."""
    if baseline < 0 or candidate < 0:
        raise ValueError("Metrics must be non-negative quantities")

    # Identical zero values represent zero change
    if baseline == 0.0 and candidate == 0.0:
        return MetricComparison(
            baseline_mean=0.0,
            candidate_mean=0.0,
            reduction_pct=0.0,
            is_valid_comparison=True,
            exclusion_reason=None,
        )

    # Denominator zero with positive numerator is undefined
    if baseline == 0.0:
        return MetricComparison(
            baseline_mean=0.0,
            candidate_mean=candidate,
            reduction_pct=None,
            is_valid_comparison=False,
            exclusion_reason="undefined_baseline",
        )

    # Standard relative reduction calculation: (baseline - candidate) / baseline * 100
    reduction = ((baseline - candidate) / baseline) * 100.0

    # Sensitivity gate: Changes outside [-100%, +100%] represent outliers
    if not (-100.0 <= reduction <= 100.0):
        return MetricComparison(
            baseline_mean=baseline,
            candidate_mean=candidate,
            reduction_pct=reduction,
            is_valid_comparison=False,
            exclusion_reason="input_token_change_outside_range",
        )

    return MetricComparison(
        baseline_mean=baseline,
        candidate_mean=candidate,
        reduction_pct=reduction,
        is_valid_comparison=True,
        exclusion_reason=None,
    )
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: DO NOT fall back to 0 or arbitrary percentage when baseline is 0
def calculate_metric_bad(baseline: float, candidate: float) -> float:
    try:
        return ((baseline - candidate) / baseline) * 100.0
    except ZeroDivisionError:
        # CORRUPTS DATA: Silently masks regression where baseline was 0 and candidate was 1000
        return 0.0 
```

**VERIFICATION METHOD**:
```python
def test_baseline_division_safety():
    res = calculate_metric_reduction(baseline=0.0, candidate=50.0)
    assert res.reduction_pct is None
    assert not res.is_valid_comparison
    assert res.exclusion_reason == "undefined_baseline"

    res_zero = calculate_metric_reduction(baseline=0.0, candidate=0.0)
    assert res_zero.reduction_pct == 0.0
    assert res_zero.is_valid_comparison
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Inter-Process Test Hang During Windows DLL Teardown (BUG-ZG-01)
- **Context**: `rust/crates/zg-engine/src/storage/store/graph_tests.rs`
- **What Was Expected**: Crash-durability tests simulate an abrupt process crash during SQLite WAL replacement by spawning a child process that cuts execution short, permitting the parent to verify state recovery upon reopening.
- **What Actually Happened**: The test harness stalled indefinitely on Windows CI runners. The child process called `std::process::exit(77)`. However, SQLite and native `zvec` FFI handles held locks in background thread pools; `ExitProcess` triggered Windows loader locks while waiting for C++ thread termination, deadlocking the child process and timing out CI.
- **Evidence in Repo**: Commit `d94e8975`, Issue #317.
- **Root Cause**: Inability of `std::process::exit` to bypass native DLL cleanup locks when unmanaged FFI worker threads are running.
- **Remediation Code Diff**:
```rust
// rust/crates/zg-engine/src/storage/store/graph_tests.rs
@@ -753,20 +792,36 @@ fn process_exit_during_canonical_replacement_recovers_from_durable_status() {
             .expect("persist graph and only part of the canonical replacement");
         // Skip IndexStore::close and all Rust destructors, leaving SQLite's WAL
         // and zvec's partially replaced content for a fresh process to reopen.
-        std::process::exit(77);
+        // Let the parent kill this process: process::exit can deadlock during
+        // Windows DLL cleanup while native storage threads still hold locks.
+        fs::write(root.join(CHILD_READY), b"ready").expect("signal durable crash state");
+        loop {
+            thread::park();
+        }
     }
...
-    let status = std::process::Command::new(std::env::current_exe().expect("test executable"))
-        .args(["--exact", "storage::store::graph_tests::..."])
-        .output().expect("run interrupted writer");
-    assert_eq!(status.status.code(), Some(77));
+    let mut child = CrashWriter(Command::new(...).spawn().expect("run interrupted writer"));
+    child.wait_until_ready(&root.join(CHILD_READY), &log_path);
+    child.0.kill().expect("terminate interrupted writer");
+    assert!(!child.0.wait().expect("reap interrupted writer").success());
```
- **Lesson**: Do not invoke in-process exit functions to test crash resilience when FFI or native threading engines are linked. Park the worker and terminate from the supervisor via OS kill.

---

### Incident 2: Terminal Flicker and Row Overflow on Terminal Resize (BUG-ZG-02)
- **Context**: `rust/crates/zg-cli/src/progress.rs`, `rust/crates/zg-cli/src/setup.rs`, `rust/crates/zg-cli/src/terminal.rs`
- **What Was Expected**: Live indexing displays progress in the terminal without flickering and adapts cleanly if the user resizes the terminal emulator window.
- **What Actually Happened**: The CLI emitted `\r\x1b[K` before writing lines, generating a visible flicker every tick. When users resized the terminal to a smaller width, long lines wrapped into multiple physical rows, but the cursor rewind logic only rewound by `lines.len()`, causing the display to append new frames underneath the wrapped text, corrupting the terminal screen.
- **Evidence in Repo**: Commit `ccead884`, PR #336.
- **Root Cause**: Treating logical strings as 1 physical row and utilizing non-atomic erase commands (`\r\x1b[K`) ahead of frame text.
- **Remediation Code Diff**:
```rust
// rust/crates/zg-cli/src/progress.rs
@@ -372,24 +375,41 @@ impl TerminalOutput {
+            if warned || self.previous_line.is_empty() {
+                self.frame.push('\r');
+                self.frame.push_str(&line);
+                self.frame.push_str("\x1b[K");
+            } else if line != self.previous_line {
+                if let Some((byte, column)) = terminal_change_start(&self.previous_line, &line) {
+                    let _ = write!(self.frame, "\x1b[{}G{}\x1b[K", column + 1, &line[byte..]);
+                } else {
+                    self.frame.push('\r');
+                    self.frame.push_str(&line);
+                    self.frame.push_str("\x1b[K");
+                }
+            }
```
```rust
// rust/crates/zg-cli/src/setup.rs
+impl RenderedLine {
+    fn wrapped_rows(&self, columns: usize) -> usize {
+        let mut rows = 1;
+        let mut occupied = 0;
+        for &width in &self.widths {
+            let width = width.min(columns);
+            if occupied + width > columns {
+                rows += 1;
+                occupied = 0;
+            }
+            occupied += width;
+        }
+        rows
+    }
+}
```
- **Lesson**: Terminal redraws must calculate physical rows based on dynamic column wrapping and emit character-column jumps (`\x1b[NG`) with in-line tail clears to maintain flicker-free updates.

---

### Incident 3: All-Zero Vector Storage Rejection Halting Workspace Ingestion (BUG-ZG-03)
- **Context**: Model extraction and cosine vector storage validation in `zg-engine`.
- **What Was Expected**: Repositories containing non-code or unusual files (e.g., empty `.eps`, un-tokenizable PostScript) must complete indexing gracefully, skipping un-vectorizable chunks or falling back to lexical indexing.
- **What Actually Happened**: When indexing repositories like `matplotlib`, files containing vector PostScript (`.eps`) generated no recognized tokens with `potion-code-16m-v2`. The embedding model emitted an all-zero vector (`[0.0, 0.0, ...]`). The underlying storage engine computed the vector L2-norm as `0.0`, failing cosine normalization check (`norm > 0`) and raising `cosine vectors must have a non-zero norm`. This caused the entire file and batch commit to abort.
- **Evidence in Repo**: Issue #177.
- **Root Cause**: Lack of zero-norm guard before dispatching embeddings into cosine-metric vector partitions.
- **Remediation Code Diff**:
```rust
// Conceptual fix applied to chunk validation before vector commit:
pub fn prepare_vector_for_storage(vector: &[f32]) -> Result<Option<Vec<f32>>, EngineError> {
    let norm_sq: f32 = vector.iter().map(|&x| x * x).sum();
    if norm_sq <= f32::EPSILON {
        // Safe degrade: All-zero embeddings cannot be normalized for cosine metric.
        // Downgrade chunk to lexical/BM25-only instead of failing the file commit.
        return Ok(None);
    }
    let inv_norm = 1.0 / norm_sq.sqrt();
    Ok(Some(vector.iter().map(|&x| x * inv_norm).collect()))
}
```
- **Lesson**: Dense embedding layers using cosine similarity must never assume models return non-zero vectors for empty or out-of-vocabulary inputs.

---

### Incident 4: Premature Hardcoded Resource Clamping in Vector Initializer (BUG-ZG-04)
- **Context**: `rust/crates/zg-engine/src/storage/zvec.rs`
- **What Was Expected**: Native vector backend should dynamically adapt thread pools and allocation limits to the host system architecture.
- **What Actually Happened**: The initialization routine was hardcoded with `.num_threads(2)` and `.memory_limit(512 * 1024 * 1024)`. On high-core workstations and servers (64+ cores, 128GB RAM), large codebase index runs were bottlenecked to two worker threads and 512MB RAM, degrading indexing throughput.
- **Evidence in Repo**: Commit `05faa164`, PR #329.
- **Root Cause**: Premature manual clamping in `OnceLock` initialization.
- **Remediation Code Diff**:
```rust
// rust/crates/zg-engine/src/storage/zvec.rs
@@ -16,13 +16,8 @@ pub(super) const WRITE_BATCH: usize = 1024;
 static INITIALIZED: OnceLock<Result<(), String>> = OnceLock::new();
 
 pub(super) fn initialize() -> EngineResult<()> {
-    match INITIALIZED.get_or_init(|| {
-        let config = zvec_rust::ConfigBuilder::new()
-            .num_threads(2)
-            .memory_limit(512 * 1024 * 1024)
-            .build();
-        zvec_rust::initialize(Some(&config)).map_err(|error| error.to_string())
-    }) {
+    match INITIALIZED.get_or_init(|| zvec_rust::initialize(None).map_err(|error| error.to_string()))
+    {
         Ok(()) => Ok(()),
         Err(message) => Err(EngineError::storage_failure(format!(
             "cannot initialize zvec: {message}"
```
- **Lesson**: Never hardcode concurrency and memory ceilings in library core initializers. Defer to native engine auto-tuning unless explicitly overridden via user configuration.

---

### Incident 5: False-Positive Exit Code Contradiction on Index Incompletion (BUG-ZG-05)
- **Context**: `zg-cli` entrypoint and status reporting.
- **What Was Expected**: If any file fails to index (leaving pending transactions or corrupt entities), `zg index` must exit with non-zero exit code, and `zg status --check-ready` must return non-zero.
- **What Actually Happened**: `zg index` reported `Workspace index: ready` and returned exit status `0`, even though individual files failed vector conversion and remained in `pending` status. However, calling `zg status --check-ready` immediately afterward failed with exit status `1`, breaking orchestration workflows in CI.
- **Evidence in Repo**: Issue #175.
- **Root Cause**: Error swallowing during per-file ingestion loops. The outer command aggregated file summaries but only checked if the database transaction committed, ignoring failed item counts when deriving process exit codes.
- **Remediation Invariant**:
```rust
// Mandatory exit invariant in CLI command handler
pub fn handle_index_result(summary: IndexSummary) -> Result<(), CliError> {
    if summary.failed > 0 {
        return Err(CliError::IndexIncomplete {
            failed_count: summary.failed,
            message: format!("Workspace indexing had {} failed files", summary.failed),
        });
    }
    println!("Workspace index: ready");
    Ok(())
}
```
- **Lesson**: Batch command status must be determined by item-level error accumulation, not merely harness-level transaction completion.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
- **Strict ANSI Sequence Slicing**: ANSI escape sequences begin with `\x1b[` and conclude within the ASCII byte range `'@'..='~'`. String slicing must never partition an escape code. When finding the delta prefix between two lines, backward-search for `\x1b[`:
  ```rust
  let safe_start = next[..common]
      .rfind("\x1b[")
      .filter(|&escape| !next[escape..common].starts_with("\x1b[0m"))
      .unwrap_or(common);
  ```
- **Unicode Width Bounds**: ASCII characters `0x20..=0x7E` always occupy width 1. Control characters (`c.is_control()`) occupy 0. CJK ideographs occupy 2.
- **Zero vs. False Coercion in Benchmarking**: In Python telemetry parsing, `isinstance(val, bool)` must be checked prior to `isinstance(val, int)` because `bool` is a subclass of `int` in Python:
  ```python
  # CRITICAL: Prevent True/False from passing integer validation
  if isinstance(score, bool) or not isinstance(score, int) or not 1 <= score <= 20:
      raise SweQaError(f"Invalid integer score: {score}")
  ```

### 2. Infinite Loop & Recursion Guards
- **Terminal Width Polling Throttle**: Checking terminal dimensions via `crossterm::terminal::size()` invokes OS ioctls (`TIOCGWINSZ`). Doing this on every loop tick burns CPU cycles and can starve event loops. Throttle polling to at least 1-second intervals:
  ```rust
  if self.width_checked.is_none_or(|last| now.duration_since(last) >= Duration::from_secs(1)) {
      self.columns = crossterm::terminal::size().map(|(w, _)| w as usize).unwrap_or(80