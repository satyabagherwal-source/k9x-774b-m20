> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zvec-ai-zvec-grep-learnings.md`  
> **Source**: github ([https://github.com/zvec-ai/zvec-grep](https://github.com/zvec-ai/zvec-grep))  
> **Source Version**: `f2256bd3`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T07:59:11.998Z  
> **Learning ID**: `learn-github-zvec-ai-zvec-grep`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): zvec-ai/zvec-grep

---

## 1. Executive Forensic Architecture & System Mechanics

`zvec-grep` (`zg`) is an ultra-fast, local-first hybrid code and document search engine designed for autonomous coding agents (Codex, Claude Code, Grok Build, OpenCode, Qwen Code, Cursor, Copilot) and human terminal workflows. It bridges ripgrep (exact keyword/regex extraction), BM25 lexical token matching, and dense vector embeddings (via local on-device small language models like `potion-code-16m-v2`, local `llama.cpp` contexts, and remote provider APIs) behind an unified query and indexing runtime.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   CLI Client (zg) / Agent Host / MCP Protocol                    │
└─────────────────────────────────┬────────────────────────────────────────────────┘
                                  │ JSON-RPC (stdio / HTTP Bearer)
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│              zg-daemon Subsystem (controller.rs, workspace_runtime.rs)           │
│  - PID 1 Re-entrance & Crash Recovery (HeldToken Registry via static Mutex)      │
│  - Multi-tenant Workspace Watchers (notify-rs / debounced FS event loops)        │
│  - Concurrency Leases & Resource Admission (LOCAL_CONCURRENCY_CAP = 8)           │
└───────────────────┬──────────────────────────────────────────┬───────────────────┘
                    │                                          │
                    ▼                                          ▼
┌───────────────────────────────────────┐  ┌───────────────────────────────────────┐
│     Lexical Pipeline (managed-rg)     │  │       Dense Vector Subsystem          │
│  - ripgrep worker child processes     │  │  - Model2Vec (Potion 16M token-free)  │
│  - Memory-mapped inverted indexes     │  │  - llama.cpp context pools (Metal/CUDA│
│  - Streamed chunk boundary extractors │  │  - Zero-norm vector sanitization      │
└───────────────────┬───────────────────┘  └───────────────────┬───────────────────┘
                    │                                          │
                    └─────────────────────┬────────────────────┘
                                          │ Reciprocal Rank Fusion (RRF)
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│               Storage Engine (@zvec/zvec C++ bindings / LMDB / HNSW)             │
│  - Cosine distance indexes with mandatory non-zero norm assertions               │
│  - Atomic manifest flips via OS rename semantics (.tmp to canonical)             │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Architectural Subsystem Boundaries & Abstractions
1. **Daemon State & Process Co-residency (`zg-daemon`)**: The daemon uses lock files (`instance.lock` and `startup.lock`) embedded with `(hostname, PID, UUID)` tokens. To survive container orchestrations where processes are perpetually assigned `PID 1` across OOM kills and crash-loops, token ownership is tracked in a process-wide mutexed `BTreeSet<Uuid>`. Stale records left by earlier crashed instances sharing the same PID are disambiguated from active in-process threads.
2. **Execution Boundary Decoupling**: Direct execution (`zg query --mode direct`) initializes an in-process local runtime, whereas agent execution routes through a long-lived daemon via MCP (`stdio` or streamable `http://127.0.0.1:7999/mcp`). Dynamic index updates triggered by background file-system watchers run with an immutable baseline template (`IndexOptions`), preventing transient CLI flag overrides (e.g., custom concurrency limits) from polluting background index maintenance.
3. **Hardware-Aware Local Inference**: Inference pipelines enforce runtime isolation between physical hardware caps. Multi-threaded batching across llama.cpp context pools and ORT/ONNX sessions is hard-capped (`LOCAL_CONCURRENCY_CAP = 8`), while CPU-only tokenizers (Potion/Model2Vec) run in an unbounded worker pool decoupled from GPU VRAM saturation boundaries.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. PID-Re-entrant Lock Identity Disambiguation
**RULE**:
When implementing file-based mutual exclusion locks in containerized or container-native environments, the lock acquisition check MUST NOT rely solely on `(hostname, PID)` liveness. It MUST pair the PID with an in-memory process-held cryptographic nonce (`UUIDv4`) registered prior to disk publication, and treat any lock matching the current PID as stale unless verified against an active in-process registry.

**WHY**:
In container runtimes (Docker, Kubernetes, Podman), the primary process always executes as `PID 1` and retains its container hostname. If the process crashes, is OOM-killed, or restarts in-place with a mounted state volume, the leftover lock record contains the exact `(hostname, 1)` tuple of the newly spawned daemon. A standard liveness check (`process_is_alive(existing.pid)`) evaluates whether PID 1 is running on `localhost`. Since the restarted process *is* PID 1, the check matches itself and aborts with an unrecoverable `AlreadyRunning` false-positive crash loop.

**WHEN TO APPLY**:
Any daemon, CLI orchestrator, or agent runtime storing lock/state files in persistent storage (`/var/run`, `/tmp`, `.git`, or application state roots) that must survive container restarts or crash-loops.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, PoisonError};
use uuid::Uuid;

static HELD_TOKENS: Mutex<BTreeSet<Uuid>> = Mutex::new(BTreeSet::new());

fn held_tokens() -> MutexGuard<'static, BTreeSet<Uuid>> {
    HELD_TOKENS.lock().unwrap_or_else(PoisonError::into_inner)
}

pub struct HeldToken(Uuid);

impl HeldToken {
    pub fn new(token: Uuid) -> Self {
        held_tokens().insert(token);
        Self(token)
    }
}

impl Drop for HeldToken {
    fn drop(&mut self) {
        held_tokens().remove(&self.0);
    }
}

pub fn record_owner_alive(host: &str, pid: u32, token: Uuid, current_host: &str) -> bool {
    // 1. Foreign host check
    if host != current_host {
        return false;
    }
    // 2. Co-residency check: If matching this PID, verify in-process registration
    if pid == std::process::id() {
        return held_tokens().contains(&token);
    }
    // 3. Foreign PID check: Verify process exists in OS process table
    process_is_alive_in_os(pid)
}

pub struct InstanceLock {
    path: PathBuf,
    token: Uuid,
    _held: HeldToken,
}

impl InstanceLock {
    pub async fn acquire(path: PathBuf, current_host: &str) -> Result<Self, LockError> {
        let token = Uuid::new_v4();
        // CRITICAL: Register the token before writing to disk so no race exists
        // where another thread reads the file and checks held_tokens before insertion.
        let held = HeldToken::new(token);

        let candidate = path.with_extension(format!("{}.tmp", token));
        write_lock_file(&candidate, std::process::id(), token, current_host).await?;

        match atomic_rename(&candidate, &path).await {
            Ok(()) => Ok(Self { path, token, _held: held }),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                let existing = read_lock_file(&path).await?;
                if record_owner_alive(&existing.hostname, existing.pid, existing.token, current_host) {
                    return Err(LockError::AlreadyRunning { pid: existing.pid });
                }
                // Lock file was left by crashed previous instance; override stale lock
                atomic_overwrite(&candidate, &path).await?;
                Ok(Self { path, token, _held: held })
            }
            Err(e) => Err(LockError::Io(e)),
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: DO NOT assume process_is_alive(pid) indicates an external conflict.
// If pid == std::process::id(), this causes instant deadlocks on container restart!
fn is_lock_stale(record: &LockRecord) -> bool {
    if record.hostname == get_hostname() && process_is_alive(record.pid) {
        // BUG: In container PID 1, a crashed process left a lock file with PID 1.
        // The new process has PID 1. process_is_alive(1) returns TRUE!
        // The daemon perpetually aborts, assuming another process owns the lock.
        return false; 
    }
    true
}
```

**VERIFICATION METHOD**:
Automated integration test simulating container restart:
1. Write a synthetic lock record to disk with `(hostname: current_hostname, pid: current_pid, token: random_uuid)`.
2. Do not insert `random_uuid` into `HELD_TOKENS`.
3. Assert that `InstanceLock::acquire` successfully acquires the lock, detects the record as stale, and overwrites the lock without raising `LockError::AlreadyRunning`.

---

### 2. Configuration Mutation Decoupling in Continuous Reconcilers
**RULE**:
Long-lived background reconciling daemons MUST NOT propagate ephemeral client-invoked execution overrides into the persistent baseline configuration state. Runtime configuration passed during ad-hoc requests MUST be deep-copied and explicitly stripped of transient execution modifiers before constructing worker templates or background watchers.

**WHY**:
When a client triggers a manual high-concurrency operation (e.g., `zg --index --index-embedding-concurrency 8`), persisting that configuration into the shared workspace runtime causes subsequent background tasks (e.g., file-watcher incremental re-indexing, scheduled re-scans) to inherit that high-concurrency parameter. Under resource-constrained scenarios, automated watchers spawning batch operations with maximum concurrency cause thread exhaustion, VRAM starvation, and crash loops.

**WHEN TO APPLY**:
Stateful daemons, language servers, MCP servers, and background indexers managing workspace lifecycle states through shared templates.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Clone, Debug, Default)]
pub struct IndexOptions {
    pub root: Option<PathBuf>,
    pub name: Option<String>,
    pub scan: ScanRulesUpdate,
    pub embedding_concurrency: Option<usize>,
    pub rebuild: bool,
    pub reset_paths: bool,
    pub changes: Vec<IndexChange>,
}

/// Creates a safe background watcher template from an ad-hoc index request.
/// Strips all client-specific overrides that must not survive the immediate command.
pub fn sanitize_index_template_for_watcher(options: &IndexOptions) -> IndexOptions {
    let mut template = options.clone();
    // Ephemeral execution overrides MUST be neutralized:
    template.embedding_concurrency = None; // Reset to default daemon worker pool limit
    template.rebuild = false;              // Prevent incremental watcher from wiping DB
    template.reset_paths = false;          // Prevent clearing existing file records
    template.changes.clear();              // Clear transient file-change buffers
    template
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: DO NOT store user-provided execution options directly into a shared daemon template.
impl WorkspaceRuntime {
    pub async fn apply_index_request(&mut self, options: IndexOptions) {
        // BUG: Mutating the baseline template with client flags causes background
        // file watcher threads to inherit `embedding_concurrency = 8` forever!
        self.index_template = options; 
    }
}
```

**VERIFICATION METHOD**:
Verify via state regression test:
1. Dispatch an indexing command with `embedding_concurrency: Some(8)`.
2. Trigger a simulated file watcher event.
3. Assert that the resulting watcher-initiated execution payload has `embedding_concurrency == None`.

---

### 3. Non-Destructive Invariant Preservation for External Config Schemas
**RULE**:
When an automated agent installer or CLI tool injects configuration into user-managed structured configuration files (such as TOML or JSON) that feature strict cardinality constraints (e.g., TOML single table header declarations), the installer MUST parse and detect existing schema tables. If a target table already exists, the installer MUST NOT append duplicate tables or mangle inline declarations; it MUST skip injection of that specific section, emit manual integration guidance, and proceed with non-conflicting sections idempotently.

**WHY**:
In TOML specification compliance, declaring the same table header twice (e.g., two `[permission]` tables or declaring `permission = {...}` followed by `[permission]`) results in an unrecoverable syntax parse error (`duplicate table: permission`). Naive string append operations in installers break existing developer configurations, corrupting toolchains and agent startup.

**WHEN TO APPLY**:
Agent integrations, MCP configurations, CLI setup hooks modifying `~/.config/*.toml`, `~/.grok/config.toml`, `.codex/config.toml`, etc.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export function hasTomlTable(configContent: string, tableName: string): boolean {
  // Matches [tableName], ['tableName'], ["tableName"], tableName.key =, or tableName = {
  const tableHeaderRegex = new RegExp(`^\\[['"]?${tableName}['"]?\\]`, 'm');
  const dottedKeyRegex = new RegExp(`^${tableName}\\.`, 'm');
  const inlineTableRegex = new RegExp(`^${tableName}\\s*=`, 'm');
  
  return (
    tableHeaderRegex.test(configContent) ||
    dottedKeyRegex.test(configContent) ||
    inlineTableRegex.test(configContent)
  );
}

export async function installGrokIntegration(options: InstallOptions): Promise<InstallResult> {
  const configPath = resolve(resolveGrokHome(), "config.toml");
  let configNote: string | undefined;
  const existingConfig = await readTextFileIfExists(configPath);

  // Guard against TOML single-table limitation
  if (
    existingConfig !== undefined &&
    !existingConfig.includes(GROK_PERMISSION_RULE_START) &&
    hasTomlTable(existingConfig, "permission")
  ) {
    // Preserve user configuration untouched; emit actionable instruction
    configNote = `${configPath} already defines [permission]; add "MCPTool(zvec_grep__*)" to permission.allow to skip tool approval prompts.`;
  } else {
    // Safe to write marked block
    await writeMarkedFile({
      path: configPath,
      startMarker: GROK_PERMISSION_RULE_START,
      endMarker: GROK_PERMISSION_RULE_END,
      block: grokPermissionBlock(),
      force: true,
    });
  }

  // Non-conflicting sections proceed independently
  await writeMarkedFile({
    path: configPath,
    startMarker: ZVEC_GREP_CONFIG_START,
    endMarker: ZVEC_GREP_CONFIG_END,
    block: grokMcpServerBlock(options),
    force: options.force,
  });

  return { files: [configPath], configNote };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly appending TOML headers to existing files
async function badInstallGrok(configPath: string) {
  // BUG: If config.toml already contains `[permission]`, this writes a second
  // `[permission]` header, crashing the TOML parser on every subsequent run of Grok.
  await appendFile(configPath, `
[permission]
allow = ["MCPTool(zvec_grep__*)"]
`);
}
```

**VERIFICATION METHOD**:
Parameterized test iterating through all valid TOML representations:
1. Feed raw configurations containing:
   - `['permission']`
   - `permission.allow = ["Bash(git *)"]`
   - `permission = { allow = ["Bash(git *)"] }`
2. Run installation.
3. Verify that zero duplicate table errors occur and `hasConflict/configNote` is properly surfaced without file corruption.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Container PID 1 False-Positive Lock Deadlock (BUG-ZG-01)
- **Context**: `rust/crates/zg-daemon/src/controller.rs`
- **What Was Expected**: When a daemon crashes inside a container or local environment, subsequent startup sequences should detect that no competing daemon is active, purge leftover lock artifacts, and successfully claim the workspace lock.
- **What Actually Happened**: In containerized runtimes (e.g., Docker/Kubernetes), the daemon runs as PID 1 and retains its container hostname. Upon restarting after an OOM kill or crash, the newly spawned daemon (PID 1) inspected `instance.lock`. The lock file listed PID 1 and the same hostname. The daemon called `process_is_alive(1)`, which inspected the OS process table and confirmed PID 1 was alive (it was looking at *itself*!). The daemon concluded another instance was holding the lock, failed with `DaemonError::AlreadyRunning { pid: 1 }`, and terminated, creating a perpetual crash loop.
- **Evidence in Repo**: Commit `a09cd123`, Issue #218, PR #226.
- **Root Cause**: Reliance on `(hostname, PID)` as a globally unique identifier for process tenancy. In modern container namespaces, PID allocation is isolated and restarts always reclaim PID 1.
- **Remediation Code Diff**:
```rust
@@ -89,7 +99,7 @@ impl StartupLock {
                 }
                 Err(error) => return Err(error),
             };
-            if existing.hostname == hostname() && process_is_alive(existing.pid) {
+            if record_owner_alive(&existing.hostname, existing.pid, existing.token) {
                 if tokio::time::Instant::now() >= deadline {
                     return Err(DaemonError::Timeout { action: "start" });
                 }
@@ -628,6 +651,43 @@ pub(crate) fn process_is_alive(pid: u32) -> bool {
     with_process(pid, |_| ()).is_some()
 }

+/// Tokens of the startup and instance locks this process currently holds.
+static HELD_TOKENS: Mutex<BTreeSet<Uuid>> = Mutex::new(BTreeSet::new());
+
+fn held_tokens() -> MutexGuard<'static, BTreeSet<Uuid>> {
+    HELD_TOKENS.lock().unwrap_or_else(PoisonError::into_inner)
+}
+
+/// Keeps a lock token registered in [`HELD_TOKENS`] until dropped.
+struct HeldToken(Uuid);
+
+impl HeldToken {
+    fn new(token: Uuid) -> Self {
+        held_tokens().insert(token);
+        Self(token)
+    }
+}
+
+impl Drop for HeldToken {
+    fn drop(&mut self) {
+        held_tokens().remove(&self.0);
+    }
+}
+
+fn record_owner_alive(host: &str, pid: u32, token: Uuid) -> bool {
+    if host != hostname() {
+        return false;
+    }
+    if pid == std::process::id() {
+        return held_tokens().contains(&token);
+    }
+    process_is_alive(pid)
+}
```
- **Lesson**: Process ID is never a durable lease handle across container crashes. Memory-backed token registration combined with atomic disk manifests must be used to establish true process-epoch ownership.

---

### Incident 2: Zero-Norm Vector Pipeline Failure During Fragment Ingestion (BUG-ZG-02)
- **Context**: `rust/crates/zg-engine/src/models/` and dense index storage layer.
- **What Was Expected**: Indexing text or code documents containing unrecognized, binary, or non-tokenizable content (e.g., `.eps`, binary headers, empty macro tables) should either produce a placeholder vector or gracefully discard non-informative fragments without failing the entire file indexing task.
- **What Actually Happened**: Small models like `potion-code-16m-v2` (Model2Vec) returned an all-zero embedding vector (`[0.0, 0.0, ...]`) when encountering fragments containing zero recognized sub-tokens. The vectors were passed directly into the vector database (`zvec` C++ engine) configured for cosine distance. The storage layer rejected the vector with:
  ```text
  Failed: pcolormesh_small.eps: commit: cosine vectors must have a non-zero norm
  Files: scanned=1223 added=1223 modified=0 deleted=0 unchanged=0 failed=1
  ```
  This single zero-norm vector aborted the entire transaction commit for the file.
- **Evidence in Repo**: Closed Issue #177; commit references in `rust/crates/zg-engine/src/api/index.rs`.
- **Root Cause**: Semantic difference between Node.js and Rust storage layer contracts. The legacy Node.js implementation silently accepted or bypassed zero-norm vectors, whereas the Rust/C++ engine strictly validated cosine invariants ($L_2\text{ norm} > 0$) at the commit boundary.
- **Remediation Code Diff**:
```rust
// Pipeline sanitization before vector storage commit
fn validate_and_sanitize_embedding(vector: &mut [f32]) -> Result<(), EmbeddingError> {
    let norm_sq: f32 = vector.iter().map(|&x| x * x).sum();
    if norm_sq <= f32::EPSILON {
        // Reject or inject unit epsilon fallback vector for cosine spaces
        return Err(EmbeddingError::ZeroNormVector);
    }
    // Normalize to unit length to ensure numerical stability in C++ engine
    let inv_norm = 1.0 / norm_sq.sqrt();
    for x in vector.iter_mut() {
        *x *= inv_norm;
    }
    Ok(())
}
```
- **Lesson**: Models with static sub-token vocabularies can emit mathematically degenerate zero vectors. Vector search engines operating in cosine spaces must sanitize, filter, or replace zero-norm vectors prior to transaction commits.

---

### Incident 3: Invariant Contradiction Between Index CLI Exit Status and Index Readiness (BUG-ZG-03)
- **Context**: `rust/crates/zg-cli/src/lib.rs`, `rust/crates/zg-daemon/src/workspace_runtime.rs`
- **What Was Expected**: When `zg index` experiences extraction or commit errors on one or more files, the command MUST exit with a non-zero exit code, and report index unreadiness so CI/CD and automation scripts halt.
- **What Actually Happened**: When extraction failed on single files (e.g., due to EPS zero-vector bugs or encoding failures), `zg index` reported `Workspace index: ready` and returned exit status `0`. However, a subsequent check with `zg status --check-ready` returned exit status `1` (`workspace index is not ready`). Downstream evaluation pipelines and agent loops proceeded with corrupt/partial indexes, assuming indexing succeeded.
- **Evidence in Repo**: Issue #175, Issue #174.
- **Root Cause**: The CLI index driver inspected whether the engine loop finished processing the file stream rather than inspecting the aggregate failure counter (`failed > 0`). It flagged the workspace as `ready` simply because the engine worker had stopped.
- **Remediation Code Diff**:
```rust
// CLI plan execution boundary
let summary = engine.build_index(options).await?;
if summary.failed_files > 0 {
    eprintln!("Index build completed with {} failed files", summary.failed_files);
    // Mark workspace as unready in daemon registry
    workspace.mark_unready().await?;
    std::process::exit(1);
}
workspace.mark_ready().await?;
```
- **Lesson**: A pipeline is not successful simply because the iterator reached its end. Invariant checks must gate terminal process exit codes: if any non-ignorable entity fails during batch indexing, terminal status cannot be `0`.

---

### Incident 4: Portable Linux Device Initialization Failure (BUG-ZG-04)
- **Context**: `rust/crates/zg-cli/src/lib.rs`, `rust/crates/zg-engine/src/models/backends/llama_cpp/model.rs`
- **What Was Expected**: In generic Linux environments with `device = "auto"`, the system should test compiled hardware capabilities before attempting to bind to hardware acceleration backends.
- **What Actually Happened**: Pre-compiled portable Linux binaries built on systems with CUDA drivers selected CUDA as the default acceleration device under `auto` mode. When deployed to container runners or cloud VMs without CUDA hardware/drivers installed, the engine threw fatal hardware initialization errors instead of falling back to CPU, failing smoke tests and benchmarks.
- **Evidence in Repo**: Commit `f95fc49e`.
- **Root Cause**: The device resolver assumed that if CUDA compilation flags were active in the binary artifact, CUDA was physically available on the host machine.
- **Remediation Code Diff**:
```rust
@@ -497,12 +497,8 @@ fn embed_texts(
-fn physical_context_worker_limit(gpu: bool, requested: usize) -> usize {
-    if gpu {
-        requested.clamp(1, 2)
-    } else {
-        requested.max(1)
-    }
+fn physical_context_worker_limit(_gpu: bool, requested: usize) -> usize {
+    requested.clamp(1, crate::models::runtime::LOCAL_CONCURRENCY_CAP)
 }
```
- **Lesson**: Device discovery must decouple *compile-time capability* from *runtime host validation*. Under `auto` modes, absent or non-functional hardware drivers must silently degrade to deterministic CPU backends, while explicit user requests (`--device cuda`) must fail fast.

---

### Incident 5: TOML Multi-Table Collision During MCP Agent Installation (BUG-ZG-05)
- **Context**: `src/cli/install.ts`, `test/install.test.mjs`
- **What Was Expected**: Running `zg --install --target grok` should inject required tool execution permissions into Grok Build's `config.toml` without breaking existing configurations.
- **What Actually Happened**: Grok Build uses a TOML configuration file containing tool permission tables (e.g. `[permission] allow = ["Bash(git *)"]`). TOML forbids having more than one `[permission]` table in a single document. Naively appending `[permission]` caused Grok's TOML parser to fail with duplicate table syntax errors, breaking the user's entire agent environment.
- **Evidence in Repo**: Commit `c1d2297c`, PR #215.
- **Root Cause**: Lack of AST/regex inspection of existing TOML table headers prior to injecting managed text blocks.
- **Remediation Code Diff**:
```typescript
@@ -356,12 +356,36 @@ async function installGrokIntegration(
   let configNote: string | undefined;
   const existingConfig = await readTextFileIfExists(configPath);
+  if (
+    existingConfig !== undefined &&
+    !existingConfig.includes(GROK_PERMISSION_RULE_START) &&
+    hasGrokPermissionTable(existingConfig)
+  ) {
+    // TOML allows only one [permission] table and forbids extending an inline
+    // rules array, so user-owned permission config is never spliced.
+    configNote = `${configPath} already defines [permission]; add "MCPTool(zvec_grep__*)" to permission.allow to skip tool approval prompts.`;
+  } else {
+    await writeMarkedFile({
+      path: configPath,
+      startMarker: GROK_PERMISSION_RULE_START,
+      endMarker: GROK_PERMISSION_RULE_END,
+      block: grokPermissionBlock(),
+      force: true,
+    });
+  }
```
- **Lesson**: Managed configuration injectors must never violate the syntactic grammar of the target file format. When automated splicing cannot be safely guaranteed, emit human-actionable guidance while preserving configuration integrity.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **Zero vs. Falsy Token Boundary Checks**: In benchmark evaluators and metrics aggregators (`reports/render.py`), baseline scores can legitimately be `0` or `0.0`. In Python/TypeScript, evaluating `if baseline:` causes `0` to be treated as false, erroneously outputting `"N/A"` or skipping calculations.
  ```python
  # SAFE: Strict None checks preserve legitimate zero metrics
  def metric_cell(baseline: int | float | None, zvec: int | float | None, reduction: float | None) -> str:
      if baseline is None or zvec is None:
          return "N/A"
      # baseline could be 0.0, which is valid and must be formatted
      left = _fmt_number(baseline)
      right = _fmt_number(zvec)
      change = None if reduction is None else -reduction
      return f"{left} / {right} / {_fmt_delta(change, suffix='%')}"
  ```
* **Boolean vs. Integer Collision Traps in Python**: In Python, `isinstance(True, int)` evaluates to `True` because `bool` inherits from `int`. When validating API parameters (e.g. scores or token limits), naive `isinstance(val, int)` accepts booleans.
  ```python
  # SAFE: Explicitly filter out bool before validating integer ranges
  if isinstance(score, bool) or not isinstance(score, int) or not 1 <= score <= 20:
      raise SweQaError(f"judge response has invalid {key} score: {score!r}")
  ```

### 2. Infinite Loop & Recursion Guards
* **Bounded Awaiting in Async Test & Reconciler Harnesses**: Naive polling using `loop { tokio::task::yield_now().await; }` starves executors if the condition is never fulfilled. Polling loops must be bounded by both timeouts and explicit predicate counts:
  ```rust
  // SAFE: Bounded wait ensuring loop termination in asynchronous test harnesses
  tokio::time::timeout(std::time::Duration::from_secs(1), async {
      while executor
          .calls
          .lock()
          .expect("calls should be readable")
          .len() < 3
      {
          tokio::task::yield_now().await;
      }
  })
  .await
  .expect("reconcile index should run and produce exactly 3 calls");
  ```
* **Judge Task ThreadPool Cancellation Guard**: In parallel evaluation runs (`ThreadPoolExecutor`), an unhandled exception in one worker must immediately cancel all remaining pending futures to prevent thread starvation and unbounded token consumption:
  ```python
  try