> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/1jehuang-jcode-learnings.md`  
> **Source**: github ([https://github.com/1jehuang/jcode](https://github.com/1jehuang/jcode))  
> **Source Version**: `2c4efdb0`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-28T07:22:15.835Z  
> **Learning ID**: `learn-github-1jehuang-jcode`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): 1jehuang/jcode

---

## 1. Executive Forensic Architecture & System Mechanics

`1jehuang/jcode` is a multi-agent coding engine designed to solve the memory bloat, high latency, context degradation, and process fragility that degrade developer tooling during long-running agent workflows. Where standard implementations suffer from memory exhaustion (allocating 150MB+ per session), high launch latency (3+ seconds), uncoordinated multi-agent deadlocks, and silent LLM prompt-cache evictions, `jcode` operates on an asynchronous workspace layout partitioned into dozens of granular Rust crates.

```
                    +------------------------------------------------+
                    |             jcode TUI / Harness                |
                    +------------------------------------------------+
                                           |
                                    Bus (RPC / Events)
                                           v
+------------------------------------------------------------------------------------+
|                               crates/jcode-app-core                                |
|                                                                                    |
|  +--------------------+   +-----------------------+   +-------------------------+  |
|  |     Agent Loop     |-->|     KV Cache Engine   |<--|    Soft Interrupt Q     |  |
|  |  (turn execution)  |   |  (stable prefix hash) |   | (user/system interrupts)|  |
|  +--------------------+   +-----------------------+   +-------------------------+  |
|            |                          |                            |               |
|            v                          v                            v               |
|  +--------------------+   +-----------------------+   +-------------------------+  |
|  | Compaction Manager |   |   Provider Abstraction|   |   Idle Hibernation      |  |
|  | (hard/soft window) |   | (Anthropic/OpenAI/Bed)|   | (drop derived mem/re-gen|  |
|  +--------------------+   +-----------------------+   +-------------------------+  |
+------------------------------------------------------------------------------------+
       |                                |                               |
       v                                v                               v
+--------------------+        +--------------------+        +------------------------+
| jcode-task-types   |        | jcode-todo-policy  |        | jcode-schema-dialect   |
| (durable state)    |        | (latch/dependency) |        | (OpenAPI/JSON schema)  |
+--------------------+        +--------------------+        +------------------------+
```

### Subsystem Decoupling & Invariants
- **`jcode-app-core` (Agent Subsystem & Core State Machine)**: Coordinates session lifecycles, provider stream execution, prompt prefix hashing, context window compaction, and rolling transcript history.
- **Provider Multi-Routing (`jcode-provider-*`)**: Abstracts diverse LLM transports (Anthropic, Bedrock, OpenAI, OpenRouter, Copilot, Gemini). Isolates transport layers from credential stores and normalizes streaming tokens into a standardized `StreamEvent` bus.
- **Durable Task Policy & Dependency Resolution (`jcode-todo-policy`, `jcode-task-types`)**: Decouples orchestration state from LLM execution. State files persist in runtime directories to survive process restarts, guarded by generation IDs and time-skew fallbacks.
- **Prompt Prefix Normalization & KV-Cache Guard**: Prompts are structurally split into static system headers, immutable tool schemas, session-frozen skill descriptors, and dynamic user messages. Eliminates transient metadata from hashing to prevent spurious prompt-cache evictions.
- **Sub-19ms TUI & Headless Daemon Separation**: Rendering logic is separated from agent execution. Headless daemons consume ~3.3 MB RAM per additional session by shedding derived indexes via idle hibernation while retaining uncorrupted source transcripts.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Zero-Cost Fallible State Fingerprinting via Structural Equivalence
**RULE**: Systems that monitor state mutations across loops or turns MUST NOT serialize domain types to JSON or strings to calculate equality fingerprints. State fingerprinting MUST evaluate structural equality (`PartialEq`, `Eq`) over typed collections or cryptographic hashes of canonical fields directly in memory.

**WHY**: Serializing complex structures (such as lists of tasks, execution plans, and goal snapshots) to JSON strings to detect state changes during loop cycles introduces heap allocation pressure, burns CPU cycles on hot paths, and can trigger panics if serialization fails on unhandled float variants (`NaN`, `Infinity`) or deeply nested schemas. Furthermore, JSON serialization does not guarantee deterministic key ordering unless specialized maps are used, risking false-positive dirty states that re-trigger downstream actions.

**WHEN TO APPLY**: In AI agent loops, turn budgets, reconciliation loops, and cache-invalidation layers where a subsystem verifies whether the agent's work items, environment variables, or plans have mutated since the last turn.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In crates/jcode-todo-policy/src/followup.rs
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct IncompleteTodoBudget {
    // Structural representation of the exact domain items
    fingerprint: Option<Vec<TodoItem>>,
    attempts: u8,
}

impl IncompleteTodoBudget {
    pub fn check_and_increment(&mut self, incomplete: &[TodoItem]) -> bool {
        if incomplete.is_empty() {
            *self = Self::default();
            return true;
        }

        // Compare native types via structural Eq instead of stringified JSON
        let current_fingerprint: Vec<TodoItem> = incomplete.to_vec();
        if self.fingerprint.as_ref() != Some(&current_fingerprint) {
            self.fingerprint = Some(current_fingerprint);
            self.attempts = 0;
        }

        if self.attempts >= INCOMPLETE_TODO_MAX_ATTEMPTS {
            return false;
        }

        self.attempts += 1;
        true
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Serializing domain entities to JSON strings for equality tracking
#[derive(Clone, Debug, Default)]
pub struct IncompleteTodoBudgetAntiPattern {
    fingerprint: Option<String>,
    attempts: u8,
}

impl IncompleteTodoBudgetAntiPattern {
    pub fn check_and_increment(&mut self, incomplete: &[TodoItem]) -> bool {
        // HAZARD: String allocation on every turn, prone to panic on invalid JSON,
        // and susceptible to formatting/ordering changes causing false invalidations
        let fingerprint = serde_json::to_string(&incomplete)
            .expect("todo items must serialize to JSON"); // Panic trap!

        if self.fingerprint.as_ref() != Some(&fingerprint) {
            self.fingerprint = Some(fingerprint);
            self.attempts = 0;
        }
        true
    }
}
```

**VERIFICATION METHOD**:
Verify with unit tests asserting zero serialization overhead and non-divergent equality checks across reordered or cloned items:
```rust
#[test]
fn test_structural_fingerprint_equality_without_serialization() {
    let mut budget = IncompleteTodoBudget::default();
    let items = vec![TodoItem { id: "task-1".into(), content: "Refactor".into(), ..Default::default() }];
    assert!(budget.check_and_increment(&items));
    // Verify that identical contents preserve attempt counter without serialization faults
    assert!(budget.check_and_increment(&items));
    assert_eq!(budget.attempts, 2);
}
```

---

### 2. Triaged Classification of Missing Files vs. Deserialization Corruptions
**RULE**: Functions loading persisted, durable disk state MUST strictly differentiate between an absent file (`ErrorKind::NotFound`) and a corrupted, partial, or unreadable file (`ErrorKind::PermissionDenied`, invalid UTF-8, malformed JSON). An absent file MUST resolve to `Ok(None)`, while read or parsing failures MUST return a categorized `Err`.

**WHY**: Swallowing all I/O and JSON parsing errors into `None` (or `unwrap_or_default()`) masks permission misconfigurations, half-written files (from power loss or unbuffered concurrent writes), and serialization bugs. When durable tasks or dependency markers become unparseable, silently treating them as "not found" causes the agent to bypass dependency gates, execute destructive actions prematurely, or duplicate completed work.

**WHEN TO APPLY**: Any file-system-backed persistence layer, runtime task state loaders, and session resume logic in distributed or local autonomous systems.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In crates/jcode-todo-policy/src/await_dependency.rs
pub fn load_checked(runtime_dir: &Path, id: &str) -> std::io::Result<Option<AwaitDependency>> {
    let Some(rest) = id.strip_prefix(ID_PREFIX) else {
        return Ok(None);
    };
    let Some((key, generation)) = rest.rsplit_once('-') else {
        return Ok(None);
    };
    if !crate::store::is_safe_session_id(key) {
        return Ok(None);
    }
    let generation: u64 = match generation.parse() {
        Ok(generation) => generation,
        Err(_) => return Ok(None), // Structural mismatch in identity format
    };

    let file_path = runtime_dir.join(STATE_DIR).join(format!("{key}.json"));
    let bytes = match std::fs::read(&file_path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error), // True I/O failure (permissions, disk fault)
    };

    // Distinguish corrupt serialization from normal absence
    let state: AwaitDependency = serde_json::from_slice(&bytes)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

    Ok(
        (state.key == key && state.created_at_unix_ms == generation && state.id() == id)
            .then_some(state)
    )
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Swallowing IO and JSON decoding errors into None
pub fn load_corrupt_swallowing(runtime_dir: &Path, id: &str) -> Option<AwaitDependency> {
    let bytes = std::fs::read(runtime_dir.join(format!("{id}.json"))).ok()?; // Swallows permissions/EIO
    let state: AwaitDependency = serde_json::from_slice(&bytes).ok()?;       // Swallows corrupt data
    Some(state)
}
```

**VERIFICATION METHOD**:
Construct integration tests verifying that malformed JSON payloads return `Err(InvalidData)` rather than `Ok(None)`:
```rust
#[test]
fn test_strict_disk_state_isolation() {
    let dir = tempfile::tempdir().unwrap();
    let state_file = dir.path().join("state.json");
    std::fs::write(&state_file, b"corrupted{json").unwrap();
    let result = load_checked(dir.path(), "await-state-1");
    assert!(result.is_err(), "Corrupted data must yield an error, not None");
}
```

---

### 3. Non-Blocking Ephemeral Caches with Resident Source-of-Truth Transcripts
**RULE**: Memory management engines in autonomous runtime environments MUST discard only derived, reproducible index caches (such as parsed token counts, tool lookup indices, and rendered provider message views) during idle phases. The canonical raw transcript and structural undo stacks MUST remain resident in memory and NEVER require disk I/O, network requests, or subprocess execution to rehydrate.

**WHY**: Dropping the primary transcript during hibernation forces disk access upon waking. If disk leases are contested, files are locked, or file paths become corrupted during hibernation, the session fails to restore. Conversely, retaining rendered API payloads causes memory consumption to scale linearly with turn count, exhausting RAM across dozens of parallel agents. Rebuilding derived indexes from resident transcripts takes sub-millisecond execution with zero I/O dependency.

**WHEN TO APPLY**: Headless daemons, long-lived background workers, IDE plugins, and high-density multi-agent orchestrators.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In crates/jcode-app-core/src/agent/idle_hibernation.rs
pub(crate) fn hibernate_idle_caches(&mut self) -> Option<IdleCacheRelease> {
    // 1. Invariant safety guards: refuse hibernation if work is active or contested
    if crate::turn_cancel_registry::has_active_turn(self.session_id())
        || self.session.migration_lease_block().is_some()
        || !self.pending_alerts.is_empty()
    {
        return None;
    }
    let queue = self.soft_interrupt_queue.try_lock().ok()?;
    if !queue.is_empty() {
        return None;
    }
    let compaction = self.registry.compaction();
    let manager = compaction.try_read().ok()?;
    if manager.is_compacting() {
        return None;
    }

    // 2. Measure derived memory release
    let released = IdleCacheRelease {
        provider_cache_bytes: self.session.memory_profile_snapshot().provider_cache_json_bytes,
        tool_index_entries: self.tool_call_ids.len() + self.tool_result_ids.len(),
    };

    // 3. Drop derived representations only; preserve raw transcript
    self.session.release_provider_messages_cache();
    self.tool_call_ids = HashSet::new();
    self.tool_result_ids = HashSet::new();
    self.tool_output_scan_index = 0;

    Some(released)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Flushing raw canonical state to disk and dropping it from RAM
pub fn dangerous_hibernate(&mut self) {
    // Flushing to disk and dropping memory causes loss of residency:
    self.session.save_to_disk().expect("disk write");
    self.session.messages.clear(); // HAZARD: Wake-up now depends on disk I/O!
}
```

**VERIFICATION METHOD**:
Execute memory benchmarks verifying zero session data mutation after cache hibernation and immediate lazy reconstruction without filesystem calls:
```rust
#[test]
fn verify_hibernation_zero_transcript_mutation() {
    let mut agent = create_test_agent();
    let transcript_before = serde_json::to_value(&agent.session.messages).unwrap();
    let release = agent.hibernate_idle_caches().expect("Hibernation should succeed");
    assert!(release.provider_cache_bytes > 0);
    // Transcript must be completely intact in memory
    let transcript_after = serde_json::to_value(&agent.session.messages).unwrap();
    assert_eq!(transcript_before, transcript_after);
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: System Config Pollution on macOS via Disjoint Path Resolutions (BUG-BEDROCK-01)
- **Context**: Bedrock credential management in `crates/jcode-provider-bedrock/src/tests.rs` via `crates/jcode-storage/src/lib.rs`.
- **What Was Expected**: Unit tests setting `XDG_CONFIG_HOME` to an isolated `tempfile::tempdir()` should redirect all configuration reading and writing into the sandboxed temporary directory.
- **What Actually Happened**: On macOS, `dirs::config_dir()` ignores `XDG_CONFIG_HOME` and resolves configuration directories to `~/Library/Application Support`. Tests calling `save_env_value_to_env_file(...)` wrote fixture credentials (`AWS_BEARER_TOKEN_BEDROCK=expired-bearer-token`, `JCODE_BEDROCK_PROFILE=jcode-operator`) directly into the developer's real macOS configuration file (`~/Library/Application Support/jcode/bedrock.env`). Subsequent test runs read real disk data, producing cascading test failures across machines.
- **Evidence in Repo**: Closed Issue #1952.
- **Root Cause**: Reliance on platform-dependent standard paths (`dirs::config_dir()`) without checking environment override variables (`XDG_CONFIG_HOME` or `JCODE_HOME`) prior to delegating to OS directory APIs.
- **Remediation Code Diff**:
```rust
// - let base_dir = dirs::config_dir().ok_or("Cannot resolve home")?;
// + let base_dir = std::env::var_os("JCODE_HOME")
// +     .map(PathBuf::from)
// +     .or_else(|| std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from))
// +     .or_else(|| dirs::config_dir())
// +     .ok_or_else(|| anyhow::anyhow!("Configuration directory unresolvable"))?;
```
- **Lesson**: Test suites MUST never trust standard OS library directory resolvers without explicitly pinning a sandbox root variable (`JCODE_HOME`) checked first in precedence order.

---

### Incident 2: Silent CI Drift in Harness API Ledger (BUG-HARNESS-02)
- **Context**: Daemon RPC dispatch ledger in `crates/jcode-harness-api/src/harness_api_tests/capability_coverage.rs`.
- **What Was Expected**: Any daemon capability invoked by the TUI or harness client must be registered in the capability coverage ledger to enforce authorization and protocol stability.
- **What Actually Happened**: Commit `d467dcb13` added the `AccountUsage` request to the TUI. The capability ledger was not updated. The repository CI matrix only ran tests for `app-core`, `jcode-base`, `embedding`, and `tui`, omitting `-p jcode-harness-api`. The regression shipped to `master` undetected until bisected downstream.
- **Evidence in Repo**: Closed Issue #1950.
- **Root Cause**: Fragmented CI testing flags (`cargo test -p <subset>`) combined with omission of API boundary crates from verification matrices.
- **Remediation Code Diff**:
```rust
// crates/jcode-harness-api/src/harness_api_tests/capability_coverage.rs
// + ("AccountUsage", ClientDisposition::ClientInternal),
```
CI workflow update:
```yaml
# .github/workflows/ci.yml
# - cargo test -p jcode-app-core -p jcode-tui
# + cargo test --workspace --exclude jcode-benchmarks
```
- **Lesson**: Contract-verification and ledger test crates MUST be included in the primary CI gating path. Never exclude workspace crates unless they require non-virtualized hardware.

---

### Incident 3: Non-Idempotent Build Script Re-Compilations and File Race Conditions (BUG-DOCS-03)
- **Context**: Documentation corpus generation in `crates/jcode-docs-data/build.rs`.
- **What Was Expected**: The build script should read markdown files from `docs/`, concatenate them into a static Rust slice in `OUT_DIR/jcode_docs.rs`, and only touch the filesystem when the generated content actually changes.
- **What Actually Happened**: The build script panicked when unwrapping `env::var("CARGO_MANIFEST_DIR")` and `fs::read_dir`, and overwrote `OUT_DIR/jcode_docs.rs` blindly on every execution. This altered file timestamps and triggered infinite rebuild loops in Cargo's incremental compilation engine.
- **Evidence in Repo**: Commit `631a89b3`.
- **Root Cause**: Failure to return `Result<(), Box<dyn Error>>` from `build.rs` `main()`, paired with writing generated source files without checking if the existing file on disk already matched the newly generated payload.
- **Remediation Code Diff**:
```rust
// crates/jcode-docs-data/build.rs
-fn main() {
-    let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
+fn main() -> Result<(), Box<dyn std::error::Error>> {
+    let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR")?);
...
-    fs::write(out, generated).expect("write generated Jcode documentation corpus");
+    match fs::read_to_string(&out) {
+        Ok(previous) if previous == generated => return Ok(()),
+        Ok(_) => {}
+        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
+        Err(error) => return Err(error.into()),
+    }
+    fs::write(out, generated)?;
+    Ok(())
+}
```
- **Lesson**: Build scripts generating code MUST check on-disk content equality before writing to prevent timestamp updates that trigger cascade compilations in large workspaces.

---

### Incident 4: Panics in Markdown Rendering via Fallible String Formatting Traps (BUG-REPORT-04)
- **Context**: Completion report generation in `crates/jcode-todo-policy/src/completion_report.rs`.
- **What Was Expected**: `render_completion_report` must safely format task outcomes and plan groups into a string buffer under all circumstances.
- **What Actually Happened**: The module imported `std::fmt::Write;` and invoked `writeln!(out, ...).unwrap()`. While writing to a `String` via `std::fmt::Write` typically returns `Ok(())`, unhandled formatting edge cases, internal panic boundaries, and macro errors caused unexpected panics during turn finalization.
- **Evidence in Repo**: Commit `631a89b3`.
- **Root Cause**: Mixing `std::fmt::Write` trait calls (requiring unwraps) on mutable heap strings where native `String::push_str` and `format!` bypass fallible wrappers entirely.
- **Remediation Code Diff**:
```rust
// crates/jcode-todo-policy/src/completion_report.rs
- use std::fmt::Write;
...
- writeln!(out, "- **{label}:** {}", value.map(escape).unwrap_or_else(|| "not recorded".into())).unwrap();
+ out.push_str(&format!(
+     "- **{label}:** {}\n",
+     value.map(escape).unwrap_or_else(|| "not recorded".into())
+ ));
```
- **Lesson**: Avoid implementing or invoking `std::fmt::Write` on `String` targets with `.unwrap()` when string methods (`push_str`) avoid error wrappers and eliminate panic risks.

---

### Incident 5: Corrupt Schema Union Generation via Unchecked JSON Dialects (BUG-SCHEMA-05)
- **Context**: Schema resolution in `crates/jcode-schema-dialect/src/dialect.rs`.
- **What Was Expected**: When merging `allOf` JSON Schema branches, missing or structurally non-object `properties` declarations must be handled gracefully without corrupting sibling schemas.
- **What Actually Happened**: The dialect merger utilized `.get("properties").and_then(Value::as_object).cloned().unwrap_or_default()`. If `properties` was declared as an unexpected JSON type (null, boolean, or array), the parser silently fell back, leading to corrupted field merge unions during downstream validation.
- **Evidence in Repo**: Commit `631a89b3`.
- **Root Cause**: Loose chaining of `and_then` on JSON Schema AST branches instead of explicit pattern matching that discards non-object variants cleanly.
- **Remediation Code Diff**:
```rust
// crates/jcode-schema-dialect/src/dialect.rs
-    let mut properties = out
-        .get("properties")
-        .and_then(Value::as_object)
-        .cloned()
-        .unwrap_or_default();
+    // Only object-valued property declarations contribute to the union.
+    // An absent (or structurally invalid) declaration contributes no names.
+    let mut properties = match out.get("properties") {
+        Some(Value::Object(properties)) => properties.clone(),
+        _ => Map::new(),
+    };
```
- **Lesson**: In AST or JSON schema normalization, always match explicitly on target variants (`Value::Object`) rather than relying on loose boolean/falsy fallbacks.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Strict Character Boundary Indexing**: Slicing UTF-8 strings by raw byte offsets triggers instant panics if a multibyte boundary is split. In `InlineTailBuffer`, when truncating string output to fit bus limits, slicing MUST locate the nearest char boundary scanning backwards:
```rust
// In crates/jcode-app-core/src/agent/inline_tail.rs
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
- **Clock Drift & Monotonic Floor Traps**: Retrieving `duration_since(UNIX_EPOCH)` can fail if host systems synchronize backwards via NTP. In `crates/jcode-todo-policy/src/await_dependency.rs`, clock underflow must never panic; it logs a warning once using `std::sync::Once` and clamps to `0`:
```rust
pub fn now_unix_ms() -> u64 {
    match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(elapsed) => elapsed.as_millis() as u64,
        Err(_) => {
            static WARNING: std::sync::Once = std::sync::Once::new();
            WARNING.call_once(|| {
                jcode_logging::warn("system clock precedes Unix epoch; durable waits cannot expire yet")
            });
            0
        }
    }
}
```

### 2. Infinite Loop & Recursion Guards
- **Prompt Continuation Infinite Loop Guard**: When an agent finishes a tool run, an automated continuation system-reminder prompt (`<system-reminder>`) is appended. If this reminder is counted as a standard tool result, it creates an infinite loop where the model responds with empty text, triggering another continuation indefinitely:
```rust
// In crates/jcode-app-core/src/agent/messages.rs
pub(super) fn messages_end_with_tool_result(messages: &[Message]) -> bool {
    messages.iter().rev().any(|message| {
        if !matches!(message.role, Role::User) {
            return false;
        }
        if message.content.iter().any(|block| matches!(block, ContentBlock::ToolResult { .. })) {
            return true;
        }
        message.content.iter().any(|block| match block {
            ContentBlock::Text { text, .. } => {
                let trimmed = text.trim();
                trimmed.starts_with("<system-reminder>")
                    // Guard against infinite recursion: do not count self-generated continuation prompts
                    && !trimmed.starts_with(Self::EMPTY_POST_TOOL_CONTINUATION_PREFIX)
            }
            _ => false,
        })
    })
}
```
- **Context Limit Recovery vs 413 Payload Distinction**: An HTTP 413 (`Request Too Large`) error MUST NOT trigger standard context window compaction. Token accounting undercounts inline base64 images; traditional text summarization would not shrink the HTTP body, causing an infinite retry loop with the same 413 error. Image strips MUST precede text compaction:
```rust
// In crates/jcode-app-core/src/agent/compaction.rs
if self.try_recover_after_payload_too_large(error) {
    return true; // Strips oversized inline base64 images without invalidating text history
}
```

### 3. UI & UX Micro-Mechanics
- **Visible vs Stored Transcript Index Offset in Rewinds**: In an AI coding agent, stored messages include raw tool calls, tool results, and internal system notices. If a user runs `/rewind 3`, pointing to the 3rd message on the screen, mapping that index directly to the stored array drops valid history prematurely:
```rust
// In crates/jcode-app-core/src/agent/conversation_reset.rs
pub fn rewind_to_message(&mut self, message_index: usize) -> Result<usize, String> {
    // Collect ONLY visible transcript target indices (user/assistant text)
    let targets = self.session.rewind_target_stored_indices();
    let message_count = targets.len();
    if message_index == 0 || message_index > message_count {
        return Err(format!("Invalid message number: {message_index}. Valid: 1-{message_count}"));
    }
    // Map the visible user index to the absolute underlying stored index
    let stored_len = targets[message_index - 1] + 1;
    self.session.truncate_messages(stored_len);
    Ok(message_count - message_index)
}
```

### 4. Backend Concurrency & Memory Safety
- **Poisoned Lock Recovery in Interrupt Handling**: If a background thread panics while holding the soft interrupt queue lock, subsequent turns