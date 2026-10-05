> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`  
> **Source**: GitHub ([https://github.com/codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale))  
> **License**: MIT  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-10-05T00:12:04.231Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Personal emails/PII sanitized at ingestion.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation or use as an AI/ML training dataset is prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): codewhale-hq/Codewhale

---

## 1. Executive Forensic Architecture & System Mechanics

Codewhale is a local-first, multi-agent orchestration engine designed to execute complex software engineering tasks. It operates directly on local workspaces while maintaining strict alignment with a user-defined, constitution-first safety posture. 

The core technical challenge Codewhale solves is the **deterministic execution of LLM-driven actions (file edits, shell commands, tool invocations) without sacrificing security, performance, or API efficiency**. 

```
                                 +-----------------------------------+
                                 |       User Interface Layer        |
                                 |  (Ratatui TUI / VS Code Sidebar)  |
                                 +-----------------+-----------------+
                                                   |
                                                   | IPC / Runtime API
                                                   v
+--------------------------------------------------+--------------------------------------------------+
|                                  CODEWHALE CORE ENGINE                                              |
|                                                                                                     |
|  +-------------------------+      +-------------------------+      +-----------------------------+  |
|  |     Session Manager     |      | PrefixStabilityManager  |      |   Bounded Context System    |  |
|  |  (Ephemeral Session vs  |      | (SHA-256 Fingerprinting |      | (10K-Token Hard Ceiling,    |  |
|  |   Durable Thread Split) |      |  of System & Tool Specs)|      |  Capped Bounded Fragments)  |  |
|  +------------+------------+      +------------+------------+      +--------------+--------------+  |
|               |                                |                                  |                 |
|               v                                v                                  v                 |
|  +------------+--------------------------------+----------------------------------+--------------+  |
|  |                                     Journaling & State                                        |  |
|  |  - Append-Only Journal (In-Memory Tree Projection via leafId Cursor)                          |  |
|  |  - Atomic State Persistence (setup_state.json Sidecar via Tempfile Writes)                    |  |
|  +---------------------------------------------+-------------------------------------------------+  |
|                                                |                                                    |
|                                                v                                                    |
|  +---------------------------------------------+-------------------------------------------------+  |
|  |                                  Execution & Sandbox Layer                                    |  |
|  |  - Shared Launcher (Permission-Aware Command Execution)                                       |  |
|  |  - Process Tree Containment (Orphan Cleanup via PID Tracking & Drop Guards)                   |  |
|  +-----------------------------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------------------------+
```

### Architectural Boundaries & Decoupling
The codebase enforces a strict separation between the **Headless Core Engine (`crates/core`)**, the **Terminal User Interface (`crates/tui`)**, the **Command Line Interface (`crates/cli`)**, and the **Local Browser Client (`web`)**. 
* **Thread vs. Session Split (`crates/core/src/session.rs`)**: A critical architectural boundary. A `Thread` is a durable, persisted entity representing a single conversation. It owns the append-only `Journal` and the `leaf_id` cursor, stored as a single row in `state.threads`. A `Session` is an ephemeral, in-memory entity representing a single engine lifetime or turn. Multiple sessions can attach to a single thread over time, but only one session can drive a turn for a given `ThreadId` at any moment. This decoupling allows headless execution engines (e.g., CI/CD runners, background cron jobs) and interactive TUIs to share the exact same state-transition logic.
* **State Ownership**: State transitions are managed via an append-only journal. History is never rewritten in place. Branching or switching conversations simply moves the `leaf_id` cursor to a different node in the journal tree, preserving the complete DAG (Directed Acyclic Graph) of the conversation.

### Critical Subsystem Abstractions
1. **PrefixStabilityManager (`crates/core/src/prefix_cache.rs`)**: DeepSeek and other advanced reasoning models rely heavily on prompt-caching mechanisms (KV caching). Any drift in the system prompt, tool-list ordering, or metadata invalidates the cache, causing massive latency spikes and increased token costs. The `PrefixStabilityManager` computes SHA-256 fingerprints of the immutable prefix (system prompt + tool specifications) and verifies them before every LLM request. It distinguishes between *declared* changes (e.g., explicit model switches, which trigger a re-pinning) and *undeclared drift* (e.g., dynamic context injection), exposing cache-stability metrics directly to the UI.
2. **Bounded Context-Fragment System (`crates/core/src/fragments.rs`)**: To prevent context window exhaustion and runaway token costs, all context injections (workspace files, permissions, routing tables, project instructions) are modeled as typed `BoundedFragment`s. The system enforces a hard cap of **10,000 tokens** (estimated at 40,000 bytes) per fragment, a maximum of **16 fragments** per context, and truncates files exceeding these limits while appending a clear truncation notice.
3. **Durable Task Runner (`crates/core/src/lib.rs` - `JobManager`)**: Background tasks are managed by a persistent `JobManager` that handles queuing, execution, pausing, and cancellation. It implements a deterministic exponential backoff retry mechanism with saturating arithmetic to prevent overflow.

---

## 2. Forensic Real Incidents & Production Patches

### Incident 1: Windows Python/Node.js Output Encoding Corruption (BUG-TUI-01)
* **Context**: Subsystem: `crates/tui/src/core/engine/tool_catalog.rs` and `crates/tui/src/tools/js_execution.rs`.
* **What Was Expected**: When executing Python or Node.js scripts via local interpreter tools, the stdout and stderr streams should be decoded as UTF-8, regardless of the parent terminal's active code page (e.g., GBK on Chinese Windows environments).
* **What Actually Happened**: On Windows systems where the parent terminal used a non-UTF-8 encoding (such as active code page 936 / GBK), the piped output of the Python interpreter defaulted to the system code page. This caused the Rust UTF-8 decoder to fail or produce garbled text when parsing JSON payloads, resulting in tool execution failures.
* **Evidence in Repo**: Commit `dd94c09f` / `353e6a60`. Test case: `code_execution_returns_utf8_stdout_and_stderr`.
* **Root Cause**: Python on Windows checks the parent process's stdio encoding. If stdio is piped, it falls back to the active Windows code page unless explicitly overridden. The Rust engine spawned the process without setting the `PYTHONIOENCODING` environment variable.
* **Remediation Code Diff**:
```rust
// crates/tui/src/core/engine/tool_catalog.rs
 pub(super) async fn execute_code_execution_tool(
     let budget = Duration::from_secs(120);
     let mut cmd =
         crate::tools::shell::sandboxed_runner_command(context, &program, args, workspace, budget)?;
+    // Match the UTF-8 decoder below, including Windows Python's piped output.
+    cmd.env(\"PYTHONIOENCODING\", \"utf-8\");
     let output = tokio::time::timeout(
         budget,
         crate::process_tree::contained_output_with_input(&mut cmd, code.as_bytes().to_vec()),
```
* **Lesson**: When spawning interpreter subprocesses whose output is parsed programmatically by a parent process, you must explicitly force UTF-8 output via environment variables (e.g., `PYTHONIOENCODING=utf-8` for Python, `NODE_CHANNEL_FD` or appropriate envs for Node) to prevent encoding mismatches on non-POSIX platforms.

### Incident 2: Grapheme-Splitting Layout Corruption in TUI Text Wrapping (BUG-TUI-02)
* **Context**: Subsystem: `crates/tui/src/tui/diff_render.rs` and `crates/tui/src/tui/history/tool_output.rs`.
* **What Was Expected**: Text wrapping in the terminal UI should wrap long lines cleanly without breaking multi-codepoint characters, such as emojis, Zero-Width Joiner (ZWJ) sequences, or keycap sequences (e.g., `1️⃣`).
* **What Actually Happened**: The wrapping logic iterated over raw `char`s and summed their individual widths using `UnicodeWidthChar::width`. For complex graphemes like `1️⃣` (which consists of `1` + `U+FE0F` + `U+20E3`), the loop sliced the string *inside* the grapheme sequence. This resulted in terminal layout misalignment, rendering artifacts, and crashes in Ratatui due to cell-width mismatches.
* **Evidence in Repo**: Commit `239d0035`, Issue `#4510`. Test case: `wrap_text_breaks_overlong_words_between_graphemes`.
* **Root Cause**: The code assumed that a user-visible character corresponds to a single Rust `char` (Unicode Scalar Value). Complex emojis and combining sequences are composed of multiple scalar values that must be treated as a single Extended Grapheme Cluster.
* **Remediation Code Diff**:
```rust
// crates/tui/src/tui/diff_render.rs
-fn push_word_breaking_chars(
+fn push_word_breaking_graphemes(
     word: &str,
     width: usize,
     current: &mut String,
     current_width: &mut usize,
     lines: &mut Vec<String>,
 ) {
-    for ch in word.chars() {
-        let char_width = ch.width().unwrap_or(1);
-        if *current_width + char_width > width && *current_width > 0 {
+    for grapheme in word.graphemes(true) {
+        let grapheme_width = grapheme.width();
+        if *current_width + grapheme_width > width && *current_width > 0 {
             lines.push(std::mem::take(current));
             *current_width = 0;
         }
-        current.push(ch);
-        *current_width += char_width;
+        current.push_str(grapheme);
+        *current_width += grapheme_width;
     }
 }
```
* **Lesson**: Never perform text wrapping, truncation, or slicing in a terminal UI by iterating over `chars()`. You must segment the string into extended grapheme clusters using `unicode-segmentation` and measure visual width using grapheme-level metrics.

### Incident 3: Case-Sensitive HTTP(S) Scheme Validation Failure in Config Doctor (BUG-CLI-03)
* **Context**: Subsystem: `crates/cli/src/lib.rs` - `run_config_doctor`.
* **What Was Expected**: The configuration diagnostic tool (`config doctor`) should validate endpoint URLs case-insensitively regarding their protocol scheme (accepting `HTTP://` or `Https://` as valid).
* **What Actually Happened**: The validation check used `starts_with("http://")` and `starts_with("https://")` directly on the raw configuration string. If a user configured an endpoint with an uppercase scheme (e.g., `HTTPS://api.deepseek.com`), the doctor flagged it as an invalid non-HTTP URL, even though the underlying HTTP client (reqwest) handled it perfectly.
* **Evidence in Repo**: Commit `308c2d45`, Issue `#6819`.
* **Root Cause**: Hardcoded prefix checks on raw strings without normalizing the case of the scheme component.
* **Remediation Code Diff**:
```rust
// crates/cli/src/lib.rs
     for (name, endpoint) in endpoints {
-        if let Some(url) = endpoint.as_deref()
-            && !url.starts_with("http://")
-            && !url.starts_with("https://")
-        {
-            errors.push(format!("`{name}` is not an http(s) URL: {url}"));
+        if let Some(url) = endpoint.as_deref() {
+            let url_for_check = url.to_ascii_lowercase();
+            if !url_for_check.starts_with("http://") && !url_for_check.starts_with("https://") {
+                errors.push(format!("`{name}` is not an http(s) URL: {url}"));
+            }
         }
     }
```
* **Lesson**: Protocol scheme validation must always be case-insensitive. Convert the prefix to lowercase or parse it using a dedicated URL parser (like the `url` crate) before performing validation checks.

### Incident 4: Sandbox Escalation Bypass / Missing Context in Interpreter Tools (BUG-CORE-04)
* **Context**: Subsystem: `crates/tui/src/core/engine/tool_execution.rs` and `crates/tui/src/tools/js_execution.rs`.
* **What Was Expected**: Local code execution tools (`code_execution` and `js_execution`) must run under the same permission-aware local launcher as workspace shell tasks, respecting the active session's sandbox policy and allowing per-call sandbox escalation only after explicit user approval.
* **What Actually Happened**: The interpreter tools bypassed the shared launcher's sandbox policy entirely. They wrote code to a temporary file in the host's `/tmp` directory and executed it as a plain child process without applying the active sandbox constraints (such as read-only workspace limits).
* **Evidence in Repo**: Commit `315e0cd6`.
* **Root Cause**: The interpreter tools were implemented as standalone process spawners (`crate::dependencies::Python::tokio_command()`) instead of routing through the centralized `sandboxed_runner_command` which applies the sandbox policies and handles permission escalation.
* **Remediation Code Diff**:
```rust
// crates/tui/src/core/engine/tool_catalog.rs
 pub(super) async fn execute_code_execution_tool(
     input: &serde_json::Value,
     workspace: &Path,
+    context: &ToolContext,
 ) -> Result<ToolResult, ToolError> {
     let code = required_str(input, "code")?;
-    let temp_dir = tempfile::tempdir()
-        .map_err(|e| ToolError::execution_failed(format!("tempdir failed: {e}")))?;
-    let script_path = temp_dir.path().join("code_execution.py");
-    tokio::fs::write(&script_path, code)
-        .await
-        .map_err(|e| ToolError::execution_failed(format!("tempfile write failed: {e}")))?;
-
-    let mut cmd = crate::dependencies::Python::tokio_command().ok_or_else(|| { ... })?;
-    cmd.arg(&script_path).current_dir(workspace);
+    let interpreter = crate::dependencies::Python::resolve().ok_or_else(|| {
+        ToolError::execution_failed("code_execution: Python interpreter became unavailable")
+    })?;
+    let (program, mut args) = crate::dependencies::split_interpreter_spec(&interpreter);
+    args.push("-".to_string());
+    let budget = Duration::from_secs(120);
+    let mut cmd =
+        crate::tools::shell::sandboxed_runner_command(context, &program, args, workspace, budget)?;
```
* **Lesson**: All tools capable of executing arbitrary code on the host system must route through a single, centralized execution gateway. This gateway is responsible for enforcing security policies, managing sandbox boundaries, and handling user approvals.

### Incident 5: Goal Lifecycle Mutation Authority Leak (BUG-CORE-05)
* **Context**: Subsystem: `crates/tui/src/tools/goal.rs` and `crates/tui/src/tools/subagent/mod.rs`.
* **What Was Expected**: Only the root agent should have the authority to mutate the lifecycle status of a goal (creating, pausing, blocking, or completing goals). Subagents should only have read-only access to the goal tree.
* **What Actually Happened**: Subagents were able to modify goal states in place, leading to split-brain scenarios where a subagent could mark a parent goal as completed or replace an active goal without the root agent's coordination.
* **Evidence in Repo**: Issue `#4529`, PR `#4530`.
* **Root Cause**: The goal mutation interface lacked an authority check. It allowed any executing context (including delegated subagents) to call status mutation methods.
* **Remediation Code Diff**:
```rust
// crates/tui/src/tools/subagent/mod.rs
// Enforce root-only mutation gate on goal lifecycle
pub fn mutate_goal_status(context: &ExecutionContext, goal_id: &GoalId, new_status: GoalStatus) -> Result<()> {
    if !context.is_root_agent() {
        return Err(Error::unauthorized("Subagents are prohibited from mutating goal lifecycles directly."));
    }
    // Proceed with mutation...
}
```
* **Lesson**: In multi-agent systems, state mutation authority must be strictly gated. Delegated agents must operate under a least-privilege model, with write access to global execution goals reserved exclusively for the orchestrating root agent.

---

## 3. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **Constant-Time Comparison Invariant**: When validating security tokens, session proofs, or API keys, you must use constant-time comparison to prevent timing attacks.
  ```rust
  // crates/core/src/secret_eq.rs
  pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
      let mut diff = a.len() ^ b.len();
      for i in 0..a.len().max(b.len()) {
          let x = a.get(i).copied().unwrap_or(0);
          let y = b.get(i).copied().unwrap_or(0);
          diff |= usize::from(x ^ y);
      }
      std::hint::black_box(diff) == 0
  }
  ```
  *CRITICAL RULE*: Never use standard `==` or `PartialEq` for cryptographic secrets, session tokens, or API keys. This prevents attackers from reconstructing valid tokens byte-by-byte by measuring response latency.
* **Byte-Level Character Boundary Slicing**: When truncating files or strings to fit within token or byte budgets, you must verify character boundaries before slicing to avoid runtime panics.
  ```rust
  // crates/core/src/fragments.rs
  let mut end = MAX_BYTES.min(text.len());
  while end > 0 && !text.is_char_boundary(end) {
      end -= 1;
  }
  text.truncate(end);
  ```
  *CRITICAL RULE*: Never call `truncate()` or slice a `&str` at an arbitrary byte index without checking `is_char_boundary()`. Slicing in the middle of a multi-byte UTF-8 character triggers an immediate thread panic.

### 2. Infinite Loop & Recursion Guards
* **Exponential Backoff Saturating Arithmetic**: In persistent task loops or retry mechanisms, backoff calculations must use saturating arithmetic to prevent integer overflow.
  ```rust
  // crates/core/src/lib.rs - JobManager
  fn deterministic_backoff_ms(retry: &JobRetryMetadata) -> u64 {
      if retry.attempt == 0 { return 0; }
      let exponent = retry.attempt.saturating_sub(1).min(20);
      let multiplier = 1u64.checked_shl(exponent).unwrap_or(u64::MAX);
      retry.backoff_base_ms.saturating_mul(multiplier)
  }
  ```
  *CRITICAL RULE*: Never calculate retry delays using standard unchecked bit-shifts (`<<`) or multiplication (`*`). Runaway retry attempts will overflow the integer type, causing a panic in debug mode or wrapping to zero in release mode, which triggers a rapid-fire infinite retry storm.

### 3. UI & UX Micro-Mechanics
* **Grapheme-to-Cell Alignment Invariant**: Terminal layouts must calculate rendering boundaries using extended grapheme cluster widths, not string lengths or character counts.
  ```rust
  // crates/tui/src/tui/history/tool_output.rs
  for grapheme in text.graphemes(true) {
      let tentative = if current.is_empty() {
          grapheme.to_string()
      } else {
          format!("{}{}", current, grapheme)
      };
      if UnicodeWidthStr::width(tentative.as_str()) > width && !current.is_empty() {
          lines.push(std::mem::take(&mut current));
      }
      current.push_str(grapheme);
  }
  ```
  *CRITICAL RULE*: When rendering text to a terminal grid, the visual width of a string must be measured using `UnicodeWidthStr::width()`. Combining characters, ZWJ emoji sequences, and double-width East Asian characters occupy a different number of terminal columns than their raw character count suggests.

### 4. Backend Concurrency & Memory Safety
* **Process Tree Containment Guard**: When spawning external tools or shell commands, you must track and terminate the entire process tree on timeout or cancellation to prevent orphaned zombie processes.
  ```rust
  // crates/tui/src/core/engine/tool_catalog.rs
  let output = tokio::time::timeout(
      budget,
      crate::process_tree::contained_output_with_input(&mut cmd, code.as_bytes().to_vec()),
  );
  ```
  *CRITICAL RULE*: Spawning a child process with `Command::spawn` and dropping the handle does not terminate the child or its descendants. You must use a process group leader, track child PIDs, and explicitly send a termination signal (e.g., `SIGKILL` or `TerminateProcess`) to the entire process tree upon timeout or cancellation.
* **Atomic State Persistence**: Configuration and setup state must be written atomically to disk using a temporary file and a rename operation to prevent file corruption during power loss or crashes.
  ```rust
  // crates/config/src/setup_state.rs
  // Persisted atomically through crates/config/src/persistence.rs
  pub fn write_atomic(path: &Path, data: &[u8]) -> Result<()> {
      let temp_path = path.with_extension("tmp");
      std::fs::write(&temp_path, data)?;
      std::fs::rename(&temp_path, path)?;
      Ok(())
  }
  ```
  *CRITICAL RULE*: Never write directly to an active configuration or state file using `std::fs::write` or `File::create`. If the write is interrupted, the file is left partially written and corrupted. Always write to a sibling temporary file first, flush it to disk, and perform an atomic rename.

### 5. Defect & Error Prevention ("Galti Pakadna")
* **Unbalanced Tool Argument Rejection**: When parsing text-based tool calls generated by LLMs, the parser must reject unbalanced or malformed JSON arguments instead of inventing empty defaults.
  ```rust
  // crates/core/src/tool_parser.rs
  fn parse_tool_call_inner(inner: &str, id_counter: &mut u32) -> Option<ParsedToolCall> {
      let parsed_args: Value = serde_json::from_str(inner).ok()?; // Reject if invalid JSON
      if !parsed_args.is_object() {
          return None; // Reject non-object arguments to prevent execution with empty state
      }
      Some(ParsedToolCall {
          name: extract_name(inner)?,
          args: parsed_args,
          id: format!("tool_{}", id_counter),
      })
  }
  ```
  *CRITICAL RULE*: Never fall back to an empty JSON object `{}` if an LLM's tool argument block fails to parse. Executing a destructive tool (like file deletion or command execution) with empty or guessed arguments can cause catastrophic workspace damage.

---

## 4. The 9 Deep Learning Dimensions

### 1. Architecture
Codewhale implements a clean **Hexagonal Architecture** where the core domain logic (`crates/core`) is completely isolated from external delivery mechanisms (TUI, CLI, Web). 

The state is managed via an append-only event log (`Journal`), projecting the conversation state as a tree. This ensures that the core engine remains entirely stateless between turns, allowing seamless session resumption and multi-surface synchronization.

### 2. Core Abstractions
* **`PrefixFingerprint`**: Represents the cryptographic identity of the system prompt and tool definitions.
* **`BoundedFragment`**: Enforces strict size and token limits on any context injected into the LLM prompt.
* **`JournalEntry`**: The primitive unit of conversation history, carrying parent-child relationships to support non-linear branching.
* **`ContextReference`**: Tracks the provenance of files and media attached to a session.

### 3. Error Handling
The system uses a strongly-typed error hierarchy via `thiserror` (e.g., `FragmentCapError`, `ToolError`). 

Fault boundaries are established at the tool execution level: a failing tool does not crash the engine turn; instead, it serializes the error as a `ToolResult` and feeds it back to the model, allowing the agent to self-correct.

### 4. Testing
Testing is executed via `cargo nextest` to handle high-concurrency test suites. 

It features extensive integration harnesses, including a mock LLM client (`MockLlmClient`) that serves canned responses to verify complex multi-turn agent behaviors, sandbox escalation gates, and PTY cancellation flows under deterministic conditions.

### 5. Security
* **Threat Model**: The local execution of untrusted code generated by LLMs.
* **Mitigation**: A multi-layered defense-in-depth model.
  * **Sandbox Postures**: `Ask`, `Auto-Review`, `Full Access`, and `Never`.
  * **Shared Launcher**: All shell commands and interpreter tools run through a sandboxed runner that scrubs environment variables and applies OS-level containment (where supported).
  * **Constant-Time Verification**: Applied to all API tokens and session proofs.

### 6. Performance
* **ToolCatalogCache**: Serializing a large tool catalog (60+ tools) to JSON on every turn takes over 100 microseconds. The `ToolCatalogCache` caches the serialized JSON and SHA-256 hash of the tool definitions, bypassing the serialization pipeline entirely when the tool set is stable.
* **Zero-Copy Slicing**: Used extensively in text rendering and log parsing to minimize allocation overhead.

### 7. Deployment
* **CI/CD Invariants**: Enforced via GitHub Actions, including strict version checks, dependency graph audits, and cross-compilation gates for Linux, macOS, Windows, and HarmonyOS (OHOS).
* **Docker**: A multi-arch Dockerfile (`linux/amd64`, `linux/arm64`) compiles the CLI into a minimal Debian-slim runtime layer, enforcing non-root execution and explicit UID/GID ownership.

### 8. Agent Patterns
* **Constitution-First Alignment**: The agent's system prompt is dynamically injected with a user-global constitution (`.codewhale/constitution.json`). This constitution acts as a hard boundary, guiding the agent's decision-making process.
* **Mode Split**: `/mode plan` restricts the agent to reasoning and proposing actions, while `/mode work` authorizes the execution of approved tools.

### 9. Data Flow
```
[User Input / TUI] ──> [Session/Thread Manager] ──> [PrefixStabilityManager]
                                                            │
                                                            v (Fingerprint OK)
[LLM Response] <── [LLM Client] <── [Context Assembler (Bounded Fragments)]
      │
      v
[Tool Parser] ──> [Shared Launcher (Sandbox Gate)] ──> [Atomic State Write]
```

---

## 5. The 8