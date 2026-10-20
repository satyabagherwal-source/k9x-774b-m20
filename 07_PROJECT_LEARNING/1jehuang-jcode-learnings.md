> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/1jehuang-jcode-learnings.md`  
> **Source**: github ([https://github.com/1jehuang/jcode](https://github.com/1jehuang/jcode))  
> **Source Version**: `1c304e9a`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-20T05:23:03.455Z  
> **Learning ID**: `learn-github-1jehuang-jcode`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): 1jehuang/jcode

---

## 1. Executive Forensic Architecture & System Mechanics

`1jehuang/jcode` is a high-density, multi-agent coding runtime and TUI orchestrator engineered in Rust. It delivers concurrent, headless swarm agent orchestration with extreme memory efficiency (~6.4 MB RSS per additional session vs. 79–194 MB in alternative agent frameworks), sub-millisecond local message dispatch, zero-copy KV-cache preservation across turns, and resilient tool execution boundaries.

```
                      +--------------------------------------------------------+
                      |                      jcode (CLI / TUI)                 |
                      +--------------------------------------------------------+
                                                  |
                          +-----------------------+-----------------------+
                          |                                               |
                          v                                               v
              +-----------------------+                       +-----------------------+
              |   jcode-app-core      |                       |    jcode-tui-core     |
              | (Orchestration Engine)|                       |  (Ratatui / Terminal) |
              +-----------------------+                       +-----------------------+
                 |        |        |                                      |
      +----------+        |        +----------+                           |
      v                   v                   v                           v
+-------------+    +-------------+    +-------------+              +-------------+
|    Agent    |    |  Compactor  |    | SwarmRouter |              | InlineTail  |
| State Mach. |    |  & Token    |    | & Interrupt |              | Viewport    |
| (agent.rs)  |    | Budget Mgr  |    | Queues (Arc)|              | (Ratatui)   |
+-------------+    +-------------+    +-------------+              +-------------+
      |                   |                   |
      v                   v                   v
+--------------------------------------------------------------------------------+
|                             Multi-Provider Engine                              |
| (jcode-provider-core, anthropic, openai, gemini, copilot, bedrock, openrouter) |
+--------------------------------------------------------------------------------+
                                       |
                   +-------------------+-------------------+
                   v                                       v
        +---------------------+                 +---------------------+
        |  Remote LLM API     |                 | Filesystem / Shell  |
        |  (SSE Stream / KV)  |                 | (Atomic Preflights) |
        +---------------------+                 +---------------------+
```

### Architectural Subsystems and Domain Primitives

1. **Agent State Machine & Session Isolation (`jcode-app-core::agent`)**:
   - `Agent`: Encapsulates an active agent execution loop. It owns a `Session`, an `Arc<dyn Provider>`, a tool `Registry`, an `Arc<Mutex<SoftInterruptQueue>>`, and an active `CacheTracker` / `KvCacheMonitor`.
   - **Isolation Boundary**: Agent state locks are decoupled from message queue locks. Queuing an interrupt (user poke, swarm event, background task) locks *only* the queue (`SoftInterruptQueue`), preventing deadlock or starvation if the agent is blocked in a synchronous network read or intensive tool invocation.

2. **KV-Cache Optimization & Invariant Preservation Engine (`agent.rs`, `agent/prompting.rs`)**:
   - Maintains exact prompt token alignment across consecutive turns.
   - Computes cache-relevant message projection hashes (`cache_relevant_message_hashes`). Strips runtime ephemera (tool execution latencies, localized error codes, UI display metadata, timestamps) from the prefix signature so backfilled metadata does not trigger downstream LLM KV-cache evictions.
   - **Split Prompt Layout**: Separates the system prompt into `static_part` (cached across the entire session lifecycle) and `dynamic_part` (appended at execution time). Dynamic memory embeddings and project instructions (`AGENTS.md`) are frozen at session instantiation to prevent prefix invalidation.

3. **Context Management & Multi-Tier Compactor (`agent/compaction.rs`)**:
   - Operates a two-phase context compaction system: an asynchronous background compactor and an emergency hard-truncation fallback.
   - Detects upstream token overflow errors via fuzzy semantic matching (`is_context_limit_error`) and distinguishes them from HTTP 413 "Payload Too Large" errors (which stem from base64 image over-allocation, requiring visual data strip-down rather than textual token summarization).

4. **Multi-Agent Swarm Orchestration & Comm Control (`server/comm_control.rs`)**:
   - Coordinates headless background agents without active client UI attachments.
   - Routes actions (`Wake`, `Resume`, `Start`) to headless workers via direct session-driven dispatch when no centralized swarm task plan exists.
   - Maintains execution waves (`wave: Option<u32>`) where todos sharing a wave execute concurrently without dependency graph recursion loops.

5. **Atomic Patch Execution Pipeline (`tool/patch.rs`)**:
   - Rejects the permissive, silent-offset behavior of GNU `git apply`.
   - Executes an all-or-nothing multi-file preflight check: normalizes and canonicalizes target paths, enforces preimage match across 100% of hunks, locks the filesystem targets, rechecks preimages against concurrent external modifications (TOCTOU prevention), and commits writes in a single verified sweep.

---

## 2. Net-New Universal Engineering Rules

### 1. Two-Phase Preimage Verification for Multi-File Mutations
**RULE**:
When implementing an automated multi-file code editing tool or diff applier, the tool MUST execute a fully isolated preflight verification phase that canonicalizes all target paths, verifies duplicate absence, and asserts exact context and hunk preimage matching across ALL files BEFORE executing any filesystem mutation. If any single hunk in any file fails verification, the engine MUST abort without modifying, creating, or deleting a single file.

**WHY**:
Standard patch tooling (such as `git apply` with fuzz or offset heuristics) will greedily splice changes into adjacent methods if context lines match elsewhere. In autonomous agent execution loops, applying hunks to files 1 and 2 before failing on file 3 leaves the working directory in a corrupted, half-migrated state. The LLM must then spend multiple subsequent turns diagnosing compilation breaks caused by partial patch application.

**WHEN TO APPLY**:
Apply in any automated agent tool that performs multi-file edits, unified diff application, or batch file refactoring (`apply_patch`, `multiedit`, `batch_replace`).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use anyhow::{bail, ensure, Result};

pub struct FileUpdate {
    pub path: PathBuf,
    pub original_content: String,
    pub updated_content: String,
}

pub struct AtomicPatchEngine;

impl AtomicPatchEngine {
    pub async fn apply_all(updates: Vec<FileUpdate>) -> Result<()> {
        let mut seen_canonical_paths = HashSet::new();
        let mut preflight_manifest = Vec::with_capacity(updates.len());

        // Phase 1: Preflight Verification & Duplicate Path Detection
        for update in &updates {
            let canonical_target = if update.path.exists() {
                fs::canonicalize(&update.path)?
            } else {
                // Handle new files: canonicalize parent directory
                let parent = update.path.parent().unwrap_or_else(|| Path::new("."));
                let canonical_parent = fs::canonicalize(parent)?;
                canonical_parent.join(update.path.file_name().unwrap())
            };

            ensure!(
                seen_canonical_paths.insert(canonical_target.clone()),
                "Atomic batch rejected: duplicate target path detected: {}",
                update.path.display()
            );

            if update.path.exists() {
                let disk_content = fs::read_to_string(&canonical_target)?;
                ensure!(
                    disk_content == update.original_content,
                    "Preimage validation failed for {}: disk content does not match expected preimage",
                    update.path.display()
                );
            } else {
                ensure!(
                    update.original_content.is_empty(),
                    "Preimage validation failed for new file {}: expected empty original content",
                    update.path.display()
                );
            }

            preflight_manifest.push((canonical_target, &update.updated_content));
        }

        // Phase 1.5: Re-verify Preimages (TOCTOU mitigation before flush)
        for (target_path, _) in &preflight_manifest {
            if target_path.exists() {
                // Secondary check confirms no race condition modified the file during preflight
                let current_content = fs::read_to_string(target_path)?;
                let expected = updates.iter().find(|u| &u.path == target_path || fs::canonicalize(&u.path).ok().as_ref() == Some(target_path));
                if let Some(exp) = expected {
                    ensure!(
                        current_content == exp.original_content,
                        "TOCTOU race detected: file modified concurrently during preflight: {}",
                        target_path.display()
                    );
                }
            }
        }

        // Phase 2: Unbroken Execution Sweep
        for (target_path, new_content) in preflight_manifest {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(&target_path, new_content)?;
        }

        Ok(())
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Iterating and mutating files directly within the hunk processing loop.
// A failure on the 3rd file leaves files 1 and 2 permanently altered on disk.
for patch in patches {
    let mut content = fs::read_to_string(&patch.file)?;
    for hunk in patch.hunks {
        if !hunk.matches(&content) {
            // FATAL: The function returns early, but earlier files in `patches`
            // have already been mutated and overwritten!
            return Err(anyhow::anyhow!("hunk mismatch")); 
        }
        content = hunk.apply(content);
    }
    fs::write(&patch.file, content)?;
}
```

**VERIFICATION METHOD**:
Enforce compliance via integration property tests:
1. Provide a batch containing 3 file updates where the 3rd file has a deliberately corrupted context preimage.
2. Assert that the function returns an `Err`.
3. Assert that files 1 and 2 have matching file modification timestamps (`mtime`) and byte contents identical to their state before the invocation.

---

### 2. Cache-Relevant Message Projection Hashing
**RULE**:
When tracking conversational state for prompt prefix and KV-cache reuse with LLM providers, systems MUST NEVER compute state hashes directly over the complete internal message representation. The hash MUST be computed exclusively over a stripped, stable projection containing only transmitted tokens (`role`, `content`, normalized tool calls, and tool responses). Runtime execution ephemera (durations, token counts, timestamps, UI state, display badges, internal trace trees) MUST be stripped prior to hashing.

**WHY**:
LLM providers (Anthropic prompt caching, OpenAI prefix caching) key their KV-caches strictly on the raw bytes/tokens transmitted over the wire. If the agent harness includes local fields (e.g., `tool_duration_ms: 124ms`, `created_at: 1729381200`, `is_error: None`) in its cache hash, subsequent turns will produce different hash signatures even when the transmitted prompt prefix is byte-identical. This causes false "prefix changed" alerts, inaccurate telemetry, and premature cache evictions.

**WHEN TO APPLY**:
Apply in any agent framework that implements prompt-caching tracking, KV-cache miss diagnostics, or cost optimization layers across multiple LLM API turns.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use serde::Serialize;
use std::hash::{Hash, Hasher};

#[derive(Serialize)]
pub struct WireMessageProjection<'a> {
    pub role: &'a str,
    pub content: &'a [WireContentProjection<'a>],
}

#[derive(Serialize)]
#[serde(tag = "type")]
pub enum WireContentProjection<'a> {
    Text { text: &'a str },
    ToolUse { id: &'a str, name: &'a str, input: &'a serde_json::Value },
    ToolResult { tool_use_id: &'a str, content: &'a str, is_error: bool },
}

pub fn compute_cache_stable_prefix_hash(messages: &[Message]) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    
    for msg in messages {
        let projection = WireMessageProjection {
            role: msg.role_as_str(),
            content: &msg.project_wire_content(),
        };
        // Serialize strictly the projection, completely ignoring
        // msg.id, msg.timestamp, msg.duration_ms, and msg.client_annotations
        let json_repr = serde_json::to_string(&projection).unwrap_or_default();
        json_repr.hash(&mut hasher);
    }
    
    hasher.finish()
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Serializing the raw Message domain entity directly.
// Internal updates to telemetry or metadata will silently alter the hash,
// misleading the cache monitor into flagging false cache evictions.
pub fn bad_cache_hash(messages: &[Message]) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    for msg in messages {
        // Includes: msg.timestamp, msg.tool_duration_ms, msg.uuid, msg.internal_flags!
        let full_blob = serde_json::to_string(msg).unwrap();
        full_blob.hash(&mut hasher);
    }
    hasher.finish()
}
```

**VERIFICATION METHOD**:
Implement a unit regression test:
1. Construct an agent conversation with 5 messages including completed tool results.
2. Compute the prefix hash: `h1 = compute_cache_stable_prefix_hash(&messages)`.
3. Mutate non-wire fields on all messages: alter timestamps, set execution durations from 0 to 1250ms, change internal IDs.
4. Compute the new hash: `h2 = compute_cache_stable_prefix_hash(&messages)`.
5. Assert `assert_eq!(h1, h2)`.

---

### 3. Decoupled Interrupt Ingestion vs. Turn Execution
**RULE**:
Agent execution loops MUST decouple the synchronization primitive protecting the inbound interrupt queue from the synchronization primitive that controls the agent turn execution loop. The incoming interrupt queue MUST be guarded by an independent, low-contention lock (`Mutex<Vec<Interrupt>>`), allowing callers to enqueue messages without waiting on the primary `Agent` loop or LLM completion lock.

**WHY**:
An agent processing a long LLM turn, streaming large response chunks, or executing blocking tools (e.g., compiling a large codebase) may hold its execution lock for tens of seconds or minutes. If the queue for incoming user stops, steering interventions, or multi-agent wake signals is protected by the same agent lock, all external attempts to interrupt or guide the agent will freeze until the turn completes, rendering interruptibility completely ineffective.

**WHEN TO APPLY**:
Apply in any agent runtime that supports cancellation, steering, background task insertion, or multi-agent swarm signaling.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;

pub struct AgentRuntime {
    // Heavy execution lock: held during turn processing, provider streaming, and tool dispatch
    pub execution_state: Arc<RwLock<AgentExecutionCore>>,
    // Dedicated interrupt lock: NEVER held during I/O, networking, or tool processing
    pub interrupt_queue: Arc<Mutex<Vec<InterruptSignal>>>,
}

impl AgentRuntime {
    /// Non-blocking insertion from external producers (HTTP handlers, TUI input, Swarm coordinator)
    pub fn enqueue_interrupt(&self, interrupt: InterruptSignal) {
        // Acquires a short-lived std::sync::Mutex; guaranteed to resolve in nanoseconds
        let mut queue = self.interrupt_queue.lock().expect("Interrupt queue lock poisoned");
        queue.push(interrupt);
    }

    /// Executed within the main turn loop at defined yield points
    pub async fn run_turn_step(&self) {
        // Drain interrupts without holding the queue during subsequent operations
        let pending = {
            let mut queue = self.interrupt_queue.lock().expect("Interrupt queue lock poisoned");
            std::mem::take(&mut *queue)
        };

        if !pending.is_empty() {
            let mut core = self.execution_state.write().await;
            core.apply_interrupts(pending);
        }

        // Proceed with heavy streaming/tool execution holding only the execution lock
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Wrapping the entire Agent in a single lock and requiring external callers
// to acquire it just to push an interrupt or user correction.
pub struct BadAgentManager {
    agent: Arc<tokio::sync::Mutex<Agent>>,
}

impl BadAgentManager {
    pub async fn push_user_interrupt(&self, msg: String) {
        // FATAL: If the agent is currently awaiting an LLM stream or running `cargo build`,
        // this call blocks indefinitely. The user cannot cancel or redirect the agent.
        let mut guard = self.agent.lock().await; 
        guard.interrupt_queue.push(msg);
    }
}
```

**VERIFICATION METHOD**:
Run an asynchronous concurrency test:
1. Spawn a task holding `agent.execution_state.write().await` that simulates a 3-second network stall (`tokio::time::sleep`).
2. Concurrently call `runtime.enqueue_interrupt(...)`.
3. Assert that `enqueue_interrupt` returns within < 5 milliseconds while the execution lock is still held.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Unified Patch Offset Corruption & Non-Atomic Partial Writes (BUG-PATCH-01)
- **Context**: `crates/jcode-app-core/src/tool/patch.rs`
- **What Was Expected**: Unified patch hunks generated by LLMs must match exact target line counts and preimages. Multi-file patches must apply atomically: if a hunk in the last file fails, zero files on disk should be touched.
- **What Actually Happened**: The patch parser permitted missing headers and used loose offset matching (similar to `git apply`), splicing changes into incorrect locations when context lines matched elsewhere. Multi-file patches applied sequentially in a loop: when an error occurred halfway through, earlier files were already mutated on disk, leaving the repository broken. Duplicate file paths in a single patch batch could cause race conditions.
- **Evidence in Repo**: Commit `9d22cbb8`, 39 passed tests in `jcode-app-core` patch suite.
- **Root Cause**: Absence of an upfront preflight validation phase; patch execution mutated the filesystem eagerly during iteration; lines outside of `@@` hunk declarations were ignored rather than rejected; rename headers were unhandled; and duplicate patch paths were not canonicalized.
- **Remediation Code Diff**:
```rust
// crates/jcode-app-core/src/tool/patch.rs
- for patch in patches {
-     let resolved_path = ctx.resolve_path(Path::new(&patch.path));
-     let result = apply_patch_with_diff(&patch, &resolved_path, &ctx).await;
-     match result {
-         Ok((msg, diff)) => { ... }
-         Err(e) => results.push(format!("✗ {}: {}", patch.path, e)),
-     }
- }
+ // Validate every file and every hunk before any filesystem mutation.
+ // Never apply a later failure after silently overwriting earlier files.
+ let mut prepared = Vec::new();
+ let mut seen = std::collections::HashSet::new();
+ for patch in &patches {
+     let path = ctx.resolve_path(Path::new(&patch.path));
+     let key = std::fs::canonicalize(&path).unwrap_or_else(|_| path.clone());
+     anyhow::ensure!(seen.insert(key), "duplicate patch path: {}", path.display());
+     prepared.push(prepare_patch(patch, path).await?);
+ }
+ // The locks coordinate tools in this process. Recheck preimages too,
+ // so edits from an external writer during preflight reject the batch.
+ for file in &prepared {
+     file.verify_unchanged().await?;
+ }
+ for (patch, file) in patches.iter().zip(prepared) {
+     let (msg, diff) = file.apply(&ctx).await?;
+     ...
+ }
```
- **Lesson**: Never execute mutations incrementally inside an iteration over LLM-generated changes. Separate diff application into **Parse -> Preflight All -> Verify All Unchanged -> Commit All**.

---

### Incident 2: Silent Wake Failure for Headless Swarm Workers Post-Server Restart (BUG-SWARM-02)
- **Context**: `crates/jcode-app-core/src/server/comm_control.rs` and `live_turn.rs`
- **What Was Expected**: When a swarm coordinator issues a `wake`, `resume`, or `start` action for an idle headless worker (or a worker restored after a server restart), the server must wake the session and run a live turn.
- **What Actually Happened**: Headless workers operate without an active client UI attachment, and restored workers hold a closed placeholder channel. `idle_live_agent` checked `!member.event_txs.is_empty() || !member.event_tx.is_closed()`. This evaluated to `false`, causing the engine to classify them as non-drivable. The wake signal fell back into a soft-interrupt queue that an idle agent never drains, causing wake actions to silently do nothing. Additionally, workers spawned directly without a pre-existing plan caused `handle_comm_task_control` to fail immediately with `"No swarm plan exists for this swarm"`.
- **Evidence in Repo**: Commit `162558d6`, regression test `idle_live_agent_wakes_restored_headless_member_without_attachments` in `crates/jcode-app-core/src/server/tests.rs`.
- **Root Cause**: Conflation of "client UI is connected" with "agent session is server-drivable". Restored sessions and headless workers have no frontend attached, but the orchestrator itself is their driver.
- **Remediation Code Diff**:
```rust
// crates/jcode-app-core/src/server/live_turn.rs
- let has_live_attachments = {
+ let can_drive = {
      let members = swarm_members.read().await;
      members
          .get(session_id)
-         .map(|member| !member.event_txs.is_empty() || !member.event_tx.is_closed())
+         .map(|member| {
+             member.is_headless || !member.event_txs.is_empty() || !member.event_tx.is_closed()
+         })
          .unwrap_or(false)
  };
- if !has_live_attachments {
+ if !can_drive {
      return None;
  }
```
- **Lesson**: Architectural abstractions must distinguish between *presentation listeners* (attached UI websockets) and *execution drivers* (internal scheduler/swarm coordinator).

---

### Incident 3: Plan-Loss Bug from Strict JSON Typing in Model Todo Waves (BUG-TODO-03)
- **Context**: `crates/jcode-task-types/src/lib.rs` and `crates/jcode-app-core/src/tool/todo.rs`
- **What Was Expected**: Models updating the plan should be able to organize tasks into parallel execution waves (`wave: 1, 2, 3...`) while keeping the plan intact.
- **What Actually Happened**: When models generated non-standard representations for `wave` (e.g., `"2"`, `"wave 2"`, `2.0`, `0`), strict JSON schema deserialization failed, causing the entire `save_todos` tool invocation to fail. Additionally, because the todo update payload generated by the model omitted internal fields like `assigned_to` (which is managed by coordinator dispatch, not the model schema), saving the plan wiped out worker assignments across all running swarm sessions.
- **Evidence in Repo**: Commit `c9bb1b51`, additions to `deserialize_optional_wave` and `merge_confidence_history`.
- **Root Cause**: 1) Strict deserialization schemas for non-critical scheduling hints; 2) Naive replacement of domain records with model-submitted records, stripping metadata not exposed in the tool definition.
- **Remediation Code Diff**:
```rust
// crates/jcode-task-types/src/lib.rs
+ pub fn parse_wave_value(value: &serde_json::Value) -> Option<u32> {
+     let wave = match value {
+         serde_json::Value::Number(n) => n
+             .as_u64()
+             .or_else(|| n.as_f64().filter(|f| *f >= 0.0).map(|f| f.round() as u64)),
+         serde_json::Value::String(s) => {
+             let digits: String = s
+                 .trim()
+                 .trim_start_matches(|c: char| !c.is_ascii_digit())
+                 .chars()
+                 .take_while(|c| c.is_ascii_digit())
+                 .collect();
+             digits.parse::<u64>().ok()
+         }
+         _ => None,
+     }?;
+     u32::try_from(wave).ok().filter(|wave| *wave > 0)
+ }

// crates/jcode-app-core/src/tool/todo.rs
+ if todo.assigned_to.is_none() {
+     todo.assigned_to = previous_todo.and_then(|prev| prev.assigned_to.clone());
+ }
```
- **Lesson**: Domain fields managed by the orchestrator must be preserved via reconciliation merges when processing model updates. Input deserialization for LLM-provided parameters should be lenient to prevent schema failures on non-critical metadata.

---

### Incident 4: Workspace Feature Unification Masking Standalone Dependency Failures (BUG-CARGO-04)
- **Context**: `crates/jcode-provider-core/Cargo.toml`
- **What Was Expected**: Every individual crate in the multi-crate workspace must compile independently in isolated CI runs or when consumed as an external path dependency (`cargo build -p jcode-provider-core`).
- **What Actually Happened**: `cargo build -p jcode-provider-core` failed with `error[E0433]: cannot find select in tokio`. Tokio was included with only `sync, time` features in `[dependencies]`, but the crate used `tokio::select!`.
- **Evidence in Repo**: Issue #1836, resolved on 2026-10-18.
- **Root Cause**: **Cargo Workspace Feature Unification**. When building the entire workspace (`cargo build --workspace`), other crates activated the `macros` feature of Tokio, unifying the feature flag across the workspace and masking the missing dependency in `jcode-provider-core`. Furthermore, `[dev-dependencies]` had `macros` enabled, allowing `cargo test -p jcode-provider-core` to pass while `cargo build -p jcode-provider-core` failed.
- **Remediation Code Diff**:
```toml
# crates/jcode-provider-core/Cargo.toml
- tokio = { version = "1", features = ["sync", "time"] }
+ tokio = { version = "1", features = ["sync", "time", "macros"] }
```
- **Lesson**: CI quality checks must build every package in isolation (`cargo check -p <package> --no-default-features`) in addition to workspace-level builds to catch missing feature flags masked by workspace unification.

---

### Incident 5: Package Dependency Closure Blind Spot in Root Linting (BUG-CLIPPY-05)
- **Context**: `crates/jcode-sdk/src/collections.rs` and `.github/workflows/ci.yml`
- **What Was Expected**: CI guardrails running `cargo clippy` with `-D warnings` must analyze every crate in the repository.
- **What Actually Happened**: A `clippy::collapsible_if` lint violation in `jcode-sdk` was committed to `master` without failing CI. When checked with Rust 1.99.0, running `cargo clippy -p jcode-sdk` threw a hard error under `-D warnings`.
- **Evidence in Repo**: Issue #1851, closed on 2026-10-18.
- **Root Cause**: CI invoked `cargo clippy --all-targets --all-features -- -D warnings` from the root directory. Because the root `Cargo.toml` is a package itself (`jcode`), Cargo ran clippy only against the root package's dependency closure. `jcode-sdk` was an isolated SDK crate not imported by the root binary, completely bypassing the CI lint check.
- **Remediation Code Diff**:
```bash
# In CI workflow scripts (.github/workflows/ci.yml)
- cargo clippy --all-targets --all-features -- -D warnings
+ cargo clippy --workspace --all-targets --all-features -- -D warnings
```
```rust
// crates/jcode-sdk/src/collections.rs
- if result.is_err() {
-     if let Err(cleanup_error) = fs::remove_file(&temporary)
-         && cleanup_error.kind() != std::io::ErrorKind::NotFound { ... }
- }
+ if result.is_err()
+     && let Err(cleanup_error) = fs::remove_file(&temporary)
+     && cleanup_error.kind() != std::io::ErrorKind::NotFound { ... }
```
- **Lesson**: In Cargo workspaces where the root is also a package, commands run from the root default to the root package. Workspace-wide CI checks must explicitly pass the `--workspace` flag.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Exact Numeric Wave Validation**: As demonstrated in `jcode-task-types::lib.rs`, models often serialize numbers as floats, quoted strings, or prefixed labels (`"wave 2"`). The system converts numbers to integers, rejecting negative values, zero, and decimals via `as_f64().filter(|f| *f >= 0.0).map(|f| f.round() as u64)`.
- **UTF-8 Char Boundary Slicing**: Slicing raw byte offsets into strings can split multi-byte characters and trigger runtime panics. In `inline_tail.rs`, the tail buffer guarantees valid UTF-8 boundaries using `floor_char_boundary`:
```rust
fn floor_char_boundary(text: &str, index: usize) -> usize {
    if index >= text.len() {
        return text.len();
    }
    let mut boundary = index;
    while boundary > 0 && !text.is_char_boundary(boundary) {
        boundary -= 1;
    }
    boundary
}
```
- **Cache-Key Hashing vs. Metadata Mutability**: `agent.rs` extracts message hashes using a