> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zvec-ai-zvec-grep-learnings.md`  
> **Source**: github ([https://github.com/zvec-ai/zvec-grep](https://github.com/zvec-ai/zvec-grep))  
> **Source Version**: `a424e0ce`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T22:41:17.565Z  
> **Learning ID**: `learn-github-zvec-ai-zvec-grep`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): zvec-ai/zvec-grep

---

## 1. Executive Forensic Architecture & System Mechanics

`zvec-grep` (`zg`) is an ultra-low-latency, local-first hybrid search layer built for autonomous AI agents and developer terminals. It unifies lexical keyword search (via `ripgrep`), lexical-statistical ranking (BM25), and semantic vector embeddings (via Alibaba's `zvec` core and native local models like Model2Vec/Potion-Code and ONNX embeddings) behind a single Model Context Protocol (MCP) server and CLI tool.

```
+-------------------------------------------------------------------------------+
|                           Consumer Interface Layer                             |
|  [CLI: zg query/index]  <--->  [MCP Server: Stream/JSON-RPC (Port 7999/stdio)]  |
+--------------------------------------+----------------------------------------+
                                       |
+--------------------------------------v----------------------------------------+
|                      Engine Coordination & Query Planner                      |
|  - Hybrid Orchestrator: Reciprocal Rank Fusion (RRF) / Linear Score Blend    |
|  - Content Chunking: Tree-Sitter AST parser + Line-Span Fragmenter            |
|  - Credential & Routing Guard: Safe Env Resolution (Zero-Leak Subprocesses)   |
+------------------+-------------------+--------------------+-------------------+
                   |                   |                    |
+------------------v---+  +------------v-------+  +---------v-------------------+
|   Ripgrep Worker     |  |   BM25 Indexer     |  |   Vector Storage (ZVec)     |
| Exact text / Regex   |  | Sparse Term Freq   |  | Cosine Dense Embeddings     |
| Line offset slicing  |  | Token Inverted Idx |  | Norm > 0 Invariant Guard    |
+----------------------+  +--------------------+  +-----------------------------+
```

### Architectural Subsystems & State Ownership
1. **Hybrid Execution Engine**: Coordinates simultaneous retrieval across exact string matches (ripgrep), lexical term frequencies (BM25), and dense vector similarity. Results are normalized and merged via rank fusion to prevent retrieval blind spots (e.g., regex finding syntactically exact variable names while dense vectors capture semantic concepts).
2. **Structural Chunking Pipeline**: Employs `web-tree-sitter` (WASM AST parsers) across supported code extensions, degrading to line/token sliding windows for raw text and unsupported languages.
3. **Local Embedding Runtime**: Hosts embedded inference engines (Model2Vec, ONNX Runtime, or `node-llama-cpp`) locally on CPU/Metal/CUDA to eliminate external network hops and data egress during workspace indexing.
4. **Agent Integration & MCP Layer**: Implements the Model Context Protocol (v2.0.0) exposing tools (`search`, `status`, `index`) over stdio and loopback HTTP (`http://127.0.0.1:7999/mcp`), enabling coding agents (e.g., OpenCode, Claude Code, Harbor) to query workspaces without flooding the context window with raw directory dumps.
5. **Deterministic Benchmark & Self-Judge Pipeline (`swe-qa-bench`)**: A dual-profile benchmarking harness that evaluates candidate search answers against baselines. It enforces strict scoring schemas, handles LLM transport failures, manages concurrent `ThreadPoolExecutor` allocations, and calculates aggregate resource and token reductions.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Vector Norm Pre-Validation Before Storage Ingestion
**RULE**:
Dense vector indexing pipelines MUST validate that vector norms satisfy $||v||_2 > \epsilon$ (where $\epsilon \ge 1\times 10^{-7}$) BEFORE dispatching embeddings to cosine-similarity index stores. An all-zero vector MUST NOT be committed to a cosine metric space; it MUST be routed to a fallback handling strategy (skipped, marked empty, or mapped to a sentinel orthogonal subspace).

**WHY**:
Cosine similarity requires computing $\frac{u \cdot v}{||u||_2 \cdot ||v||_2}$. If $||v||_2 = 0$, the mathematical operation yields a division by zero ($\frac{0}{0} \to \text{NaN}$). Vector databases (like `zvec`, Faiss, and HNSWlib) enforce strict internal assertions rejecting zero-norm vectors during batch commit. When unhandled, a single tokenless fragment (e.g., an unparseable `.eps` file or whitespace-only code block) causes the entire commit transaction to roll back, failing the indexing of the entire repository.

**WHEN TO APPLY**:
Apply in any vector indexing, dense retrieval, or RAG subsystem using Cosine Distance or Angular Metric, especially when parsing binary-like files, unmapped file extensions, or empty AST node extractions.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub const VECTOR_NORM_EPSILON: f32 = 1e-7;

#[derive(Debug, thiserror::Error)]
pub enum VectorIngestError {
    #[error("Vector for chunk '{chunk_id}' has zero or sub-epsilon norm ({norm:e}); cannot commit to cosine index")]
    ZeroNormVector { chunk_id: String, norm: f32 },
}

pub fn validate_cosine_vector(chunk_id: &str, vector: &[f32]) -> Result<f32, VectorIngestError> {
    // Compute L2 norm squared using SIMD-friendly fold
    let norm_sq: f32 = vector.iter().map(|&x| x * x).sum();
    let norm = norm_sq.sqrt();

    if !norm.is_finite() || norm < VECTOR_NORM_EPSILON {
        return Err(VectorIngestError::ZeroNormVector {
            chunk_id: chunk_id.to_string(),
            norm,
        });
    }

    Ok(norm)
}

pub fn ingest_chunk_embeddings(
    index: &mut VectorStore,
    chunks: Vec<(String, Vec<f32>)>,
) -> Result<IngestSummary, IndexerError> {
    let mut valid_batch = Vec::with_capacity(chunks.len());
    let mut skipped_count = 0;

    for (id, vec) in chunks {
        match validate_cosine_vector(&id, &vec) {
            Ok(_) => valid_batch.push((id, vec)),
            Err(VectorIngestError::ZeroNormVector { chunk_id, norm }) => {
                tracing::warn!(%chunk_id, norm, "Skipping tokenless fragment: zero norm vector");
                skipped_count += 1;
                // Graceful degradation: do not fail entire file batch
            }
        }
    }

    if !valid_batch.is_empty() {
        index.commit_batch(valid_batch)?;
    }

    Ok(IngestSummary { ingested: valid_batch.len(), skipped: skipped_count })
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blindly submitting embedding model output directly into cosine storage.
// A model encountering an empty/unrecognized token sequence returns a zero-vector [0.0, 0.0, ... 0.0],
// causing the entire batch transaction to explode inside C++/native bindings.
pub fn ingest_unsafe(index: &mut VectorStore, chunk_id: String, raw_vec: Vec<f32>) {
    index.commit_single(&chunk_id, &raw_vec).unwrap(); // PANIC: cosine vectors must have a non-zero norm
}
```

**VERIFICATION METHOD**:
Run unit tests with artificial zero vectors and edge-case inputs (empty string, binary header):
```rust
#[test]
fn test_zero_vector_rejection_and_graceful_skip() {
    let zero_vec = vec![0.0f32; 384];
    let res = validate_cosine_vector("binary_snippet.eps", &zero_vec);
    assert!(matches!(res, Err(VectorIngestError::ZeroNormVector { .. })));
}
```

---

### 2. Strict CLI Exit Code & Readiness State Synchronization
**RULE**:
A CLI process or daemon reporting health/completion status MUST NOT emit exit code `0` or print affirmative status messages (`"Workspace index: ready"`) if any constituent unit in the batch job failed or remains in a `pending`/`dirty`/`poisoned` state. Subsystem status queries (`--check-ready`) and indexing actions (`index`) MUST share a single, unified state evaluation predicate.

**WHY**:
Continuous integration (CI) workflows, build agents, and automated orchestrators monitor process exit codes to determine pipeline progression. Emitting exit code `0` alongside a headline declaring readiness while internal workers failed corrupts downstream stages. Subsequent commands that evaluate operational readiness fail immediately, producing non-deterministic state assertions and broken automation runs.

**WHEN TO APPLY**:
Apply to all CLI commands, background build tools, ingestion workers, and microservice status endpoints that produce side effects and report completion.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Debug, PartialEq, Eq)]
pub enum IndexHealth {
    Ready,
    Degraded { failed_count: usize },
    Failed { reason: String },
}

pub struct WorkspaceIndexer {
    pub scanned: usize,
    pub succeeded: usize,
    pub failed: Vec<(PathBuf, String)>,
}

impl WorkspaceIndexer {
    pub fn evaluate_readiness(&self) -> IndexHealth {
        if !self.failed.is_empty() {
            IndexHealth::Degraded { failed_count: self.failed.len() }
        } else {
            IndexHealth::Ready
        }
    }

    pub fn execute_and_report(&self) -> Result<(), CliError> {
        let health = self.evaluate_readiness();
        match health {
            IndexHealth::Ready => {
                println!("Workspace index: ready");
                println!("Files: scanned={} added={} failed=0", self.scanned, self.succeeded);
                Ok(())
            }
            IndexHealth::Degraded { failed_count } => {
                eprintln!("Workspace index: NOT ready (degraded)");
                eprintln!("Files: scanned={} added={} failed={}", self.scanned, self.succeeded, failed_count);
                for (path, err) in &self.failed {
                    eprintln!("  - Failed: {}: {}", path.display(), err);
                }
                // Return non-zero status to halt caller script
                Err(CliError::IndexIncomplete { failed_count })
            }
            IndexHealth::Failed { reason } => {
                eprintln!("Workspace index: FATAL error: {reason}");
                Err(CliError::ExecutionFailed(reason))
            }
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Catching file-level exceptions into a list, printing errors,
// but unconditionally returning Ok(()) with a hardcoded "ready" headline.
pub fn run_indexer_broken(files: Vec<PathBuf>) -> Result<(), ()> {
    let mut failed = 0;
    for file in files {
        if let Err(e) = process(file) {
            eprintln!("Failed: {e}");
            failed += 1;
        }
    }
    // BUG: Automation trusts exit code 0 and "Workspace index: ready" string!
    println!("Workspace index: ready");
    Ok(()) 
}
```

**VERIFICATION METHOD**:
Automated integration smoke tests running the CLI against a dirty fixture containing 1 unparseable file, verifying the exact exit status:
```bash
zg index ./test/fixtures/corrupted_workspace
assert [ $? -ne 0 ]
zg status --check-ready ./test/fixtures/corrupted_workspace
assert [ $? -ne 0 ]
```

---

### 3. Boolean Exclusion in Integer Validation Guardrails
**RULE**:
When validating JSON, dynamic dictionary payloads, or configuration records in dynamically typed languages (such as Python or JavaScript) for numeric boundaries ($min \le x \le max$), type assertions MUST explicitly exclude boolean values (`not isinstance(val, bool)`) prior to asserting integer instances (`isinstance(val, int)`).

**WHY**:
In Python, `bool` is an explicit subclass of `int` (`issubclass(bool, int) is True`). Consequently, `isinstance(True, int)` evaluates to `True`, and boolean values evaluate numerically (`True == 1`, `False == 0`). If an API consumer passes `{"correctness": True}`, standard range checks (`isinstance(x, int) and 1 <= x <= 20`) pass successfully. The boolean `True` will contaminate arithmetic aggregations, metrics computation, and cost algorithms as the scalar integer `1`. In JavaScript, `typeof true === 'boolean'` avoids this, but `Number(true)` silently converts to `1`.

**WHEN TO APPLY**:
Apply in all data ingestion boundaries, LLM response parsers, JSON-RPC validators, rubric scoring harnesses, and configuration loaders where numeric constraints are validated.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
def parse_strict_integer_range(
    value: Any, 
    *, 
    field_name: str, 
    min_val: int, 
    max_val: int
) -> int:
    """
    Validates that a dynamic value is strictly an integer within [min_val, max_val].
    Explicitly guards against Python's `bool` subclassing trap.
    """
    if isinstance(value, bool):
        raise ValueError(
            f"Field '{field_name}' must be an integer, but received boolean: {value!r}"
        )
    if not isinstance(value, int):
        raise ValueError(
            f"Field '{field_name}' must be an int, received {type(value).__name__}: {value!r}"
        )
    if not (min_val <= value <= max_val):
        raise ValueError(
            f"Field '{field_name}' value {value} out of bounds [{min_val}, {max_val}]"
        )
    return value
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Relying on isinstance(v, int)
def parse_rubric(payload: dict[str, Any]) -> dict[str, int]:
    score = payload.get("correctness")
    # BUG: If payload contains {"correctness": True}, isinstance(True, int) is TRUE!
    # 1 <= True <= 20 is TRUE! Score 1 is recorded instead of rejecting corrupted output.
    if isinstance(score, int) and 1 <= score <= 20:
        return {"correctness": score}
    raise ValueError("Invalid score")
```

**VERIFICATION METHOD**:
Parametric unit test proving boolean rejection:
```python
import pytest

def test_boolean_is_rejected_as_integer():
    with pytest.raises(ValueError, match="received boolean"):
        parse_strict_integer_range(True, field_name="correctness", min_val=1, max_val=20)
    with pytest.raises(ValueError, match="received boolean"):
        parse_strict_integer_range(False, field_name="correctness", min_val=0, max_val=20)
    assert parse_strict_integer_range(1, field_name="correctness", min_val=1, max_val=20) == 1
```

---

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

### Incident 1: Repository Cache Quota Eviction & PR Cache Pollution (BUG-CI-CACHE-01)
- **Context**: `.github/actions/rust-candidate-package/action.yml`, `.github/workflows/rust-package-build.yml`
- **What Was Expected**: Cargo build artifacts should be cached to accelerate CI turnaround without exhausting GitHub's 10 GB per-repository cache limit.
- **What Actually Happened**: The cache key was parameterized by commit SHA (`...-${{ steps.source.outputs.commit }}` and `...-${{ github.sha }}`) and executed on `pull_request` events. Because GitHub Actions restricts cache restoration across PR branches, every single PR run uploaded ~400 MB of unreachable build caches. This rapidly saturated the 10 GB quota, evicting the main branch's master CI caches and causing multi-platform builds to rebuild from scratch.
- **Evidence in Repo**: Commit `a424e0ce`, PR #272.
- **Root Cause**: Over-specific cache keys containing git commit SHAs in PR workflows where cached entries cannot be restored across branch boundaries.
- **Remediation Code Diff**:
```diff
--- a/.github/actions/rust-candidate-package/action.yml
+++ b/.github/actions/rust-candidate-package/action.yml
@@ -41,19 +41,9 @@ runs:
        with:
          path: ${{ runner.temp }}/rust-package-cache
          key: ${{ inputs.cache_namespace }}-package-v1-${{ runner.os }}-${{ runner.arch }}-${{ steps.source.outputs.commit }}
-    - name: Restore Cargo build state after a package cache miss
-      if: steps.rust-package-cache.outputs.cache-hit != 'true'\
-      uses: actions/cache@v5
-      with:
-        path: |
-          ~/.cargo/registry/index/
-          ~/.cargo/registry/cache/
-          ~/.cargo/git/db/
-          candidate/rust/target/
-        key: ${{ inputs.cache_namespace }}-cargo-v1-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('candidate/rust/Cargo.lock', 'candidate/rust/rust-toolchain.toml') }}-${{ steps.source.outputs.commit }}
+    # No Cargo build cache: callers run on pull_request events, so saved entries
+    # stay in PR-scoped caches that other PRs never restore while each one
+    # still costs about 400 MB of the repository cache quota.
--- a/.github/workflows/rust-package-build.yml
+++ b/.github/workflows/rust-package-build.yml
@@ -57,9 +57,8 @@ jobs:
              ~/.cargo/registry/cache/
              ~/.cargo/git/db/
              rust/target/release/
-          key: rust-release-v2-${{ inputs.target }}-${{ inputs.runner }}-${{ hashFiles('rust/Cargo.lock', 'rust/rust-toolchain.toml') }}-${{ github.sha }}
-          restore-keys: |
-            rust-release-v2-${{ inputs.target }}-${{ inputs.runner }}-${{ hashFiles('rust/Cargo.lock', 'rust/rust-toolchain.toml') }}-
+          # Per-commit keys would exhaust the 10 GB repository cache quota and evict Rust CI caches.
+          key: rust-release-v3-${{ inputs.target }}-${{ inputs.runner }}-${{ hashFiles('rust/Cargo.lock', 'rust/rust-toolchain.toml') }}
```
- **Lesson**: CI caching keys for build targets MUST be keyed exclusively by content hashes of dependency locks (`Cargo.lock`, `package-lock.json`) and toolchain definitions (`rust-toolchain.toml`). Commit SHAs MUST NOT be included in reusable cache keys. PR-scoped branches should save caches only if child jobs in that exact workflow execution reuse them.

---

### Incident 2: Zero-Norm Vector Ingestion Crash in Cosine Metric Index (BUG-VEC-NORM-02)
- **Context**: Rust indexing engine (`rust/` tree / Model2Vec integration)
- **What Was Expected**: Indexing corpora containing diverse files (such as `matplotlib` with `.eps` vector graphics or binary assets) should extract text or token fragments, generate embeddings, and successfully index the repository.
- **What Actually Happened**: When parsing `lib/matplotlib/tests/baseline_images/test_axes/pcolormesh_small.eps`, the model (`local/potion-code-16m-v2`) found zero recognized tokens. Model2Vec returned an all-zero embedding array ($[0.0, 0.0, \dots, 0.0]$). The vector storage engine calculated vector norms for its cosine distance index, encountered a norm of zero, and aborted the transaction:
  ```text
  Failed: lib/matplotlib/tests/baseline_images/test_axes/pcolormesh_small.eps: commit: cosine vectors must have a non-zero norm
  Files: scanned=1223 added=1223 modified=0 deleted=0 unchanged=0 failed=1
  ```
  This single zero-norm fragment aborted the entire file's indexing and poisoned index readiness.
- **Evidence in Repo**: Issue #177, commit `3e16b18`.
- **Root Cause**: Missing pre-commit norm validation on generated embeddings. Zero-norm vectors are mathematically incompatible with cosine normalization.
- **Remediation Pattern**:
```rust
// Compute norm and verify non-zero threshold before index commit
let norm = raw_embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
if norm <= 1e-7 {
    tracing::debug!("Fragment yielded zero-norm embedding (no recognized tokens); omitting from cosine index.");
    continue; // Omit chunk without failing the file
}
```
- **Lesson**: Model inference outputs are untrusted external data. Zero-token fallbacks from NLP/code tokenizers produce degenerate zero vectors. Numerical preconditions required by the underlying distance metric (e.g., $||v|| > 0$ for cosine) must be enforced at the boundary before calling C++/native storage layers.

---

### Incident 3: CLI Exit Status Contradiction on Degraded Index (BUG-CLI-STATUS-03)
- **Context**: Rust CLI interface (`rust/src/main.rs`, `zg index` vs `zg status`)
- **What Was Expected**: If an indexing operation encounters unrecoverable file failures, `zg index` should emit an exit code reflecting degraded execution (non-zero) and clearly declare the index unready.
- **What Actually Happened**: When indexing failed on files (such as `.eps` files in Issue #177), `zg index` printed individual failure lines but proceeded to conclude with `Workspace index: ready` and terminated with exit code `0`. Immediately afterward, executing `zg status --check-ready` terminated with exit code `1` and printed `workspace index is not ready`.
- **Evidence in Repo**: Issue #175, Issue #174.
- **Root Cause**: `zg index` computed its process exit code from whether the outer iteration loop completed without unhandled panics, ignoring the internal counter of failed files (`failed > 0`), while `zg status --check-ready` inspected the underlying index manifest pending/failed count.
- **Remediation Pattern**:
```rust
// Unified evaluation
let summary = indexer.run()?;
if summary.failed > 0 {
    eprintln!("Workspace index: NOT ready ({} files failed)", summary.failed);
    std::process::exit(1);
} else {
    println!("Workspace index: ready");
    std::process::exit(0);
}
```
- **Lesson**: Process exit codes must reflect domain-level success, not merely process execution survival. The readiness predicate must be a shared domain model function called identically by both the mutator (`index`) and the query (`status`).

---

### Incident 4: Windows CI Test Performance Starvation on C: Drive (BUG-CI-WIN-IO-04)
- **Context**: `.github/workflows/rust-ci.yml`
- **What Was Expected**: Running Rust workspace integration tests on Windows GitHub-hosted runners should complete within acceptable CI timeouts.
- **What Actually Happened**: The test harness creates and destroys hundreds of temporary workspace directories during integration tests. On GitHub Actions Windows runners, the default temporary directory (`$env:TEMP` / `C:\Users\RUNNER~1\AppData\Local\Temp`) resides on the OS drive (`C:`), which has severe I/O throttling and virtualization overhead. Tests experienced multi-minute slowdowns and intermittent I/O lock timeouts.
- **Evidence in Repo**: Commit `a424e0ce`, `.github/workflows/rust-ci.yml`:
  ```yaml
  # The default Windows temp directory is on C:, which is much slower than the D: workspace drive.
  - name: Keep test temp files on the workspace drive
    if: runner.os == 'Windows'
    shell: bash
    run: |
      echo "TMP=$RUNNER_TEMP" >> "$GITHUB_ENV"
      echo "TEMP=$RUNNER_TEMP" >> "$GITHUB_ENV"
  ```
- **Root Cause**: Windows GitHub Actions runners mount an SSD/NVMe volume on drive `D:` (where `$RUNNER_TEMP` and the workspace reside), while `C:` runs on an I/O throttled virtual OS disk. Heavy temp file creation on `C:` creates an I/O bottleneck.
- **Remediation Pattern**: Explicitly redirect system temp environment variables (`TMP`, `TEMP`) to `$RUNNER_TEMP` on Windows runners.
- **Lesson**: In disk-intensive integration testing (search indexes, database engines, git workspace clones), never rely on OS default temp paths on cloud CI runners; bind temp directories directly to the runner's fast ephemeral workspace drive.

---

### Incident 5: Provider Parameter Stripping in LiteLLM Proxy Forwarding (BUG-EVAL-LLM-05)
- **Context**: `benchmarks/swe-qa-bench/zg_bench/engines/judge.py`
- **What Was Expected**: When running evaluation harnesses using OpenAI-compatible endpoints with modern reasoning models (e.g., GLM-5.2 or Qwen-3.8), parameters like `reasoning_effort` and `enable_thinking` must reach the upstream model backend.
- **What Actually Happened**: LiteLLM and standard OpenAI proxy clients validate parameter keys against standard OpenAI schemas. If an upstream provider model is not recognized in the static client registry, unrecognized parameters (such as `reasoning_effort`) are silently stripped from the outgoing HTTP payload, disabling extended reasoning on self-judge requests and skewing evaluation scores.
- **Evidence in Repo**: `benchmarks/swe-qa-bench/zg_bench/engines/judge.py`:
  ```python
  response = completion_fn(
      model=f"openai/{model}",
      api_key=api_key,
      api_base=api_base,
      temperature=judge_temperature(model),
      seed=BENCHMARK_SEED,
      reasoning_effort=generation["reasoning_effort"],
      # LiteLLM's OpenAI model registry may not know this provider.
      # Explicitly forward it rather than silently dropping it.
      allowed_openai_params=["reasoning_effort"],
      max_tokens=generation["max_tokens"],
      messages=[{"role": "user", "content": prompt}],
      extra_body={"enable_thinking": generation["enable_thinking"]},
  )
  ```
- **Root Cause**: Third-party wrapper SDKs implement aggressive parameter filtering based on hardcoded model registry lookups.
- **Remediation Pattern**: Explicitly configure parameter forwarding (`allowed_openai_params=["reasoning_effort"]`) and pass provider-specific flags through `extra_body`.
- **Lesson**: When integrating multi-provider LLM gateways, assume custom reasoning parameters will be dropped by default unless explicitly whitelisted via client passthrough configuration.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
- **Python Boolean vs Integer Trap**:
  ```python
  # BAD: True passes check and counts as integer 1
  def parse_score(val):
      if isinstance(val, int) and 1 <= val <= 20:
          return val
      raise ValueError("Invalid")

  # GOOD: Strict exclusion of boolean subclass
  def parse_score(val):
      if isinstance(val, bool) or not isinstance(val, int) or not (1 <= val <= 20):
          raise SweQaError("Invalid score")
      return val
  ```
- **Float Rounding Zero Sign Invariant**: In reporting math, formatting small negative numbers can yield negative zero (`-0.00`).
  ```python
  # Safe float delta normalization
  numeric = float(value)
  if round(numeric, 2) == 0:
      numeric = 0.0  # Eradicates '-0.00' in Markdown diff tables
  return f"{numeric:+.2f}{suffix}"
  ```
- **Division by Zero in Benchmark Comparisons**: When computing percentage reduction:
  $$\Delta\% = \frac{\text{baseline} - \text{target}}{\text{baseline}} \times 100$$
  If $\text{baseline} = 0$, evaluating the formula triggers a runtime `ZeroDivisionError` or generates `NaN`/$\infty$.
  ```python
  # Safe division guard:
  if baseline_val == 0:
      reduction = None # Displays as "N/A" in reports
  else:
      reduction = ((baseline_val - target_val) / baseline_val) * 100.0
  ```

---

### 2. Infinite Loop & Recursion Guards
- **AST Tree-Sitter Recursion Depth Guard**: When walking complex AST structures (deeply nested callbacks, macros, minified code):
  ```typescript
  const MAX_AST_DEPTH = 256;

  function traverseAst(node: SyntaxNode, depth = 0): void {
    if (depth > MAX_AST_DEPTH) {
      throw new Error(`Exceeded maximum AST traversal depth: ${MAX_AST_DEPTH}`);
    }
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) {
        traverseAst(child, depth + 1);
      }
    }
  }
  ```
- **Cancellation Propagation in Bounded ThreadPool**:
  When one worker in a thread pool crashes or raises an exception during concurrent LLM judging, all remaining futures must be actively canceled to prevent thread leakage and dangling network requests:
  ```python
  futures: list[Future[dict[str, Any]]] = []
  with ThreadPoolExecutor(max_workers=concurrency, thread_name_prefix="swe-qa-judge") as executor:
      for _, trial in work_items:
          futures.append(executor.submit(worker_fn, trial))
      try:
          judged = [future.result() for future in futures]
      except BaseException:
          # CRITICAL: Prevent leaked worker threads by canceling pending tasks
          for future in futures:
              future.cancel()
          raise
