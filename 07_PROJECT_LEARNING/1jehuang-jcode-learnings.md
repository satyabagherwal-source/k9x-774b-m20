> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/1jehuang-jcode-learnings.md`  
> **Source**: github ([https://github.com/1jehuang/jcode](https://github.com/1jehuang/jcode))  
> **Source Version**: `bfd8142c`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-29T23:13:48.346Z  
> **Learning ID**: `learn-github-1jehuang-jcode`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): 1jehuang/jcode

---

## 1. Executive Forensic Architecture & System Mechanics

`1jehuang/jcode` is an industrial-grade, ultra-low-latency coding agent runtime implemented in Rust (Edition 2024). The system executes multi-agent loops, swarm coordination, and tool calling within strict hardware envelopes (71.3 MB baseline, ~3.3 MB incremental RSS per parallel session, and a 19.1 ms time-to-first-input budget).

```
                      ┌──────────────────────────────────────────────┐
                      │             jcode-tui / CLI                  │
                      │  (Render Pipeline, InlineTailBuffer, Ratatui)│
                      └──────────────────────┬───────────────────────┘
                                             │ Crossbeam / MPSC Bus
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │              jcode-app-core                  │
                      │   Agent Engine, Loop Guards, Soft Interrupts │
                      └───────┬──────────────────────────────┬───────┘
                              │                              │
         ┌────────────────────┴───────────┐      ┌───────────┴────────────────────┐
         ▼                                ▼      ▼                                ▼
┌───────────────────┐    ┌────────────────────┐┌───────────────────┐    ┌─────────────────┐
│ jcode-agent-runtime│   │jcode-compaction-core││jcode-provider-core│    │  jcode-storage  │
│ Task & Tool Pipes │    │ Token Budget / Auto││ Multi-Provider Mux│    │ Session / Disk  │
│  Graceful Signals │    │ 413 & Window Drops ││ KV Cache Monitor  │    │ Non-blocking Git│
└───────────────────┘    └────────────────────┘└─────────┬─────────┘    └─────────────────┘
                                                         │
                                    ┌────────────────────┴───────────────────┐
                                    ▼                    ▼                   ▼
                           ┌─────────────────┐  ┌─────────────────┐ ┌────────────────┐
                           │ Anthropic / Bed │  │ OpenAI / Copilot│ │ Gemini / Dialect│
                           │  -Ztls=emulated │  │  OAuth Hashing  │ │ Schema Pruning │
                           └─────────────────┘  └─────────────────┘ └────────────────┘
```

### Subsystem Boundaries & Invariant Contracts
1. **Agent Engine (`crates/jcode-app-core`)**: Central orchestrator. Enforces strict message ordering, tool execution lifecycle state machines, dual-lock soft interrupt queues, and background tool migrations.
2. **KV-Cache Monitor Subsystem**: Guards token cache hits across provider boundaries (Anthropic, OpenAI). It splits system prompts into static (cached) and dynamic (ephemeral) slices, hashing only serialized protocol-transmitted payloads to prevent spurious KV misses caused by harness metadata mutations.
3. **Multi-Stage Context Compactor (`crates/jcode-compaction-core`)**: Distinguishes token context exhaustion from HTTP 413 (byte payload overflow caused by inline base64 images). Runs asynchronous background summarization without freezing the main agent event loop.
4. **Session Hibernation & Idle Memory Reclaimer**: Shrinks idle resident memory by wiping volatile caches (JSON serialization strings, tool lookup indexes) while holding canonical transcript records intact on disk.
5. **Provider Dialect Translation Layer (`crates/jcode-schema-dialect`, `jcode-provider-*`)**: Normalizes tool schema variations across heterogeneous model APIs. For example, it prunes dangling `required` properties on Gemini function calling schemas when no properties dictionary exists.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. KV-Cache Protocol Projection Invariant
**RULE**: Systems that monitor, predict, or hash prompt cache state MUST compute content hashes exclusively over the canonical, transmitted wire-format fields. They MUST NOT include internal harness metadata (e.g., timestamps, execution duration, reasoning traces, or local UI IDs) in the hash signature.

**WHY**: Including transient or client-local metadata causes prefix hash divergence between successive turns. When an agent updates a local message record with `duration_ms` or backfills reasoning traces, hashing the raw in-memory struct yields a false cache-miss diagnostic (`harness:_prefix_changed`), corrupting cost telemetry and triggering redundant prompt re-evaluations.

**WHEN TO APPLY**: In any LLM client or agent harness implementing prompt caching (Anthropic prompt caching, OpenAI prefix caching, DeepSeek context caching).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// crates/jcode-app-core/src/agent.rs
pub fn cache_relevant_message_hashes(messages: &[Message]) -> Vec<u64> {
    messages
        .iter()
        .map(|msg| {
            let mut hasher = std::collections::hash_map::DefaultHasher::new();
            // Project ONLY wire-transmitted semantic components
            msg.role.hash(&mut hasher);
            for block in &msg.content {
                match block {
                    ContentBlock::Text { text, .. } => {
                        0u8.hash(&mut hasher);
                        text.hash(&mut hasher);
                    }
                    ContentBlock::ToolUse { name, input, .. } => {
                        1u8.hash(&mut hasher);
                        name.hash(&mut hasher);
                        // Stable JSON string avoids key reordering divergence
                        serde_json::to_string(input).unwrap_or_default().hash(&mut hasher);
                    }
                    ContentBlock::ToolResult { tool_use_id, content, is_error } => {
                        2u8.hash(&mut hasher);
                        tool_use_id.hash(&mut hasher);
                        content.hash(&mut hasher);
                        is_error.hash(&mut hasher);
                    }
                    // Omit ReasoningTrace, timestamps, duration_ms, and local UI flags
                    _ => {}
                }
            }
            hasher.finish()
        })
        .collect()
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Direct struct hashing leaks harness telemetry into cache keys
#[derive(Hash)]
struct RawHarnessMessage {
    role: Role,
    content: Vec<ContentBlock>,
    local_timestamp_ms: u64,     // MUTATES: Spurious cache miss on next turn!
    tool_duration_ms: Option<u64>, // MUTATES: Causes prefix miss!
}

fn bad_hash(msg: &RawHarnessMessage) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    msg.hash(&mut hasher); // BUSTED: Internal mutations invalidate prompt cache!
    hasher.finish()
}
```

**VERIFICATION METHOD**:
Run unit tests asserting identical hashes across metadata-enriched messages:
```rust
#[test]
fn test_cache_hash_ignores_harness_telemetry() {
    let mut m1 = Message::user("hello");
    let mut m2 = m1.clone();
    m2.duration_ms = Some(1542);
    m2.timestamp = Utc::now();
    assert_eq!(
        cache_relevant_message_hashes(&[m1]),
        cache_relevant_message_hashes(&[m2]),
        "Harness metadata mutated the KV-cache signature"
    );
}
```

---

### 2. First-Frame Subprocess Non-Blocking Guarantee
**RULE**: Interactive UI and CLI runtimes MUST NOT execute synchronous child subprocesses, filesystem probes, or blocking locks during application launch, session resume, or first-frame render passes. Any non-critical external environment detection (e.g., `git status`, repository hashes, dirty flags) MUST be resolved via lazy evaluation or decoupled background workers with atomic cache publication.

**WHY**: Spawning child processes (`git rev-parse`, `git status`) incurs substantial process-creation overhead (especially on Windows and macOS), stalling the interactive main loop and regressing the time-to-first-input (TTFI) from <20ms to >500ms. If the repository is large or disk I/O is saturated, synchronous checks cause UI freezing and dropped terminal events.

**WHEN TO APPLY**: TUI initialization, REPL startup sequences, session switching, and hot reload paths.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// crates/jcode-app-core/src/agent/environment.rs
fn git_state_for_snapshot(dir: &Path) -> Option<GitState> {
    static IN_FLIGHT: LazyLock<StdMutex<HashSet<PathBuf>>> = LazyLock::new(Default::default);
    let key = dir.to_path_buf();

    // 1. Fast path: Read from atomic cache without disk/fork
    if let Ok(cache) = WORKING_GIT_STATE_CACHE.lock() {
        if let Some(state) = cache.get(&key) {
            return state.clone();
        }
    }

    // 2. Cold path: Spawn background thread; return None immediately
    let first = IN_FLIGHT
        .lock()
        .map(|mut set| set.insert(key.clone()))
        .unwrap_or(false);

    if first {
        let spawned = std::thread::Builder::new()
            .name("jcode-git-state".to_string())
            .spawn(move || {
                let state = super::utils::git_state_for_dir(&key);
                if let Ok(mut cache) = WORKING_GIT_STATE_CACHE.lock() {
                    cache.insert(key.clone(), state);
                }
                if let Ok(mut set) = IN_FLIGHT.lock() {
                    set.remove(&key);
                }
            });

        if spawned.is_err() {
            if let Ok(mut set) = IN_FLIGHT.lock() {
                set.remove(dir);
            }
        }
    }

    // Never wait for the worker; yield initial empty frame immediately
    None
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Synchronous command execution on render/resume path
pub fn render_frame_header(dir: &Path) -> String {
    // Blocks the TUI thread for 50-300ms while git runs
    let output = std::process::Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(dir)
        .output()
        .expect("git failed");
    format!("Status: {:?}", output.stdout)
}
```

**VERIFICATION METHOD**:
Enforce execution time boundaries using micro-benchmarks or integration asserts:
```rust
#[test]
fn test_git_snapshot_does_not_block_caller() {
    let start = Instant::now();
    let state = git_state_for_snapshot(Path::new("."));
    assert!(
        start.elapsed() < Duration::from_millis(5),
        "git_state_for_snapshot blocked interactive thread: took {:?}",
        start.elapsed()
    );
}
```

---

### 3. Cross-Platform Directory Isolation for Integration Test Harnesses
**RULE**: Integration and unit tests that modify application configurations, credentials, or state files MUST NOT rely exclusively on standard POSIX environment variables (e.g., `XDG_CONFIG_HOME`) to isolate disk writes. When the underlying platform directory resolution library bypasses these variables (such as `dirs::config_dir()` on macOS directing to `~/Library/Application Support`), the test harness MUST explicitly override the application's root directory via a mandatory isolation guard or custom path resolver.

**WHY**: Relying on `XDG_CONFIG_HOME` on macOS causes the application to write test artifacts directly into the developer's live home directory (`~/Library/Application Support/<app>`). This mutates real credentials, corrupts production states, and creates cross-test interdependencies where subsequent tests fail based on machine-specific state.

**WHEN TO APPLY**: File-system persistence layers, credential storage tests, and auth configuration suites across Darwin, Linux, and Windows.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Secure Path Resolution Invariant
pub fn app_config_dir() -> PathBuf {
    // 1. Mandatory test-override hook
    if let Some(custom) = std::env::var_os("JCODE_CONFIG_OVERRIDE") {
        return PathBuf::from(custom);
    }
    // 2. Explicit Unix check honoring XDG before falling back to system defaults
    #[cfg(target_family = "unix")]
    if let Some(xdg) = std::env::var_os("XDG_CONFIG_HOME") {
        return PathBuf::from(xdg).join("jcode");
    }
    // 3. Fallback to platform-standard directories
    dirs::config_dir()
        .map(|p| p.join("jcode"))
        .unwrap_or_else(|| PathBuf::from(".jcode"))
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: macOS ignores XDG_CONFIG_HOME when dirs::config_dir() is called
#[test]
fn bad_test_isolation() {
    let temp = tempfile::tempdir().unwrap();
    std::env::set_var("XDG_CONFIG_HOME", temp.path());
    // On macOS, this writes directly into ~/Library/Application Support/jcode!
    save_env_value_to_env_file("AWS_BEARER_TOKEN", "corrupt_real_user_token");
}
```

**VERIFICATION METHOD**:
Assert that during automated test execution, the configuration path resolved by the runtime is strictly contained within the test process temporary directory:
```rust
#[test]
fn test_config_dir_isolated_from_host_system() {
    let temp = tempfile::tempdir().unwrap();
    std::env::set_var("JCODE_CONFIG_OVERRIDE", temp.path());
    let path = app_config_dir();
    assert!(
        path.starts_with(temp.path()),
        "Config directory escaped test sandbox! Resolved: {:?}",
        path
    );
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: UI Substring Collisions in Changelog vs System Chrome (BUG-TUI-01)
- **Context**: `crates/jcode-tui/src/tui/ui_tests/pinned_todo_regressions.rs`
- **What Was Expected**: TUI regression assertions verify that system status chrome (e.g., hosted compilation status rows) renders strictly below pinned task lists without line wrapping.
- **What Actually Happened**: The test checked for occurrences of the literal string `"justrust"`:
  ```rust
  assert_eq!(text.matches("justrust").count(), 1, "{text}");
  ```
  When a release changelog commit title contained the word `"justrust"` (e.g., `"justrust release update"`), the count assertion failed, and the order check compared against the changelog prose rather than the status chrome.
- **Evidence in Repo**: Commit `5bfecef9`
- **Root Cause**: Reliance on ambiguous substring matching across composite UI frames containing user-generated/dynamic changelog text.
- **Remediation Code Diff**:
```rust
// Commit 5bfecef9
- assert_eq!(text.matches("justrust").count(), 1, "{text}");
- assert!(text.find("Pinned regression task").unwrap() < text.find("justrust").unwrap());
+ assert!(text.contains("justrust release update"), "{text}");
+ let status_rows: Vec<_> = text
+     .lines()
+     .enumerate()
+     .filter(|(_, line)| line.trim_start().starts_with("justrust [remote/hosted]"))
+     .collect();
+ assert_eq!(status_rows.len(), 1, "{text}");
+ let todo_row = text
+     .lines()
+     .position(|line| line.contains("Pinned regression task"))
+     .unwrap();
+ assert!(todo_row < status_rows[0].0, "{text}");
```
- **Lesson**: UI assertions on rendered text must match structurally pinned prefixes (e.g., `line.starts_with("justrust [remote/hosted]")`) and positional line indices rather than globally searching un-namespaced tokens.

---

### Incident 2: Host Config Pollution on Darwin via Platform Directory Defaults (BUG-STORAGE-02)
- **Context**: `crates/jcode-provider-bedrock/src/tests.rs` & `crates/jcode-storage/src/lib.rs` (Issue #1952)
- **What Was Expected**: Running `cargo test -p jcode-provider-bedrock` isolates credentials into temporary directories via `XDG_CONFIG_HOME`.
- **What Actually Happened**: On macOS, `dirs::config_dir()` ignores `XDG_CONFIG_HOME` and returns `~/Library/Application Support`. Tests called `save_env_value_to_env_file()`, writing mock secrets (`AWS_BEARER_TOKEN_BEDROCK=expired-bearer-token`) into the host machine's real developer configuration directory, corrupting the user's active credentials and causing non-deterministic test flakiness.
- **Evidence in Repo**: GitHub Issue #1952
- **Root Cause**: Misunderstanding the platform-dependent implementation of the `dirs` crate, which treats macOS as a standard Cocoa target rather than following XDG specifications.
- **Remediation Code Diff**:
```rust
// crates/jcode-storage/src/lib.rs
  pub fn app_config_dir() -> PathBuf {
+     if let Ok(dir) = std::env::var("JCODE_CONFIG_DIR") {
+         return PathBuf::from(dir);
+     }
+     #[cfg(target_os = "macos")]
+     if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
+         return PathBuf::from(xdg).join("jcode");
+     }
      dirs::config_dir()
          .map(|p| p.join("jcode"))
          .unwrap_or_else(|| PathBuf::from(".jcode"))
  }
```
- **Lesson**: Platform directory resolution primitives must have test-level override overrides (`JCODE_CONFIG_DIR`) injected before native OS paths are queried.

---

### Incident 3: Gemini Schema Dialect Failure on Orphaned `required` Properties (BUG-PROVIDER-03)
- **Context**: `crates/jcode-provider-gemini-runtime/src/gemini_tests.rs`
- **What Was Expected**: Tool parameter schemas translated to the Gemini dialect must strip invalid `required` arrays when an object declares no child properties.
- **What Actually Happened**: The Gemini translation layer retained `{"type": "object", "required": ["anything"]}` when the schema lacked a `properties` dictionary. Gemini's API rejects this with a validation error during tool calling.
- **Evidence in Repo**: Commit `9fb8fbf3`
- **Root Cause**: The runtime engine did not prune dangling requirements if `properties` was absent rather than empty.
- **Remediation Code Diff**:
```rust
// Commit 9fb8fbf3
- fn build_tools_keeps_required_when_the_object_declares_no_properties() {
-     ...
-     let parameters = &built[0].function_declarations[0].parameters;
-     assert_eq!(parameters["required"], json!(["anything"]));
- }
+ fn build_tools_prunes_required_when_the_object_declares_no_properties() {
+     ...
+     let parameters = &built[0].function_declarations[0].parameters;
+     assert!(
+         parameters.get("required").is_none(),
+         "requirements without declared properties must be pruned: {parameters}"
+     );
+     assert_eq!(parameters["type"], json!("object"));
+ }
```
- **Lesson**: Strict JSON Schema engines (like Google Gemini) enforce object coherence: an object cannot require fields that are not defined in its properties mapping. Schema dialect converters must prune orphaned constraints.

---

### Incident 4: Untriaged Client Capability Ledger Drift (BUG-HARNESS-04)
- **Context**: `crates/jcode-harness-api/src/harness_api_tests/capability_coverage.rs` (Issue #1950)
- **What Was Expected**: Any daemon request implemented in the TUI/Desktop MUST be triaged in the harness API capability ledger (`LEDGER`) to maintain contract alignment between CLI clients and backend daemons.
- **What Actually Happened**: Commit `d467dcb13` introduced the `AccountUsage` request to the TUI without updating the static ledger, causing harness test suites to fail on un-triaged capabilities:
  `these daemon requests are used by the TUI/desktop but have no reviewed disposition in the harness API capability ledger: ["AccountUsage"]`
- **Evidence in Repo**: Issue #1950, Bisected to `d467dcb13`
- **Root Cause**: Client capability features were wired in the UI workspace without running the full crate matrix (`-p jcode-harness-api --lib`), bypassing static capability exhaustiveness checks.
- **Remediation Code Diff**:
```rust
// crates/jcode-harness-api/src/harness_api_tests/capability_coverage.rs
  static LEDGER: &[(&str, CapabilityStatus)] = &[
      ("SessionList", ClientPublic),
      ("SessionResume", ClientPublic),
+     ("AccountUsage", ClientInternal),
  ];
```
- **Lesson**: Distributed client-daemon systems require compile-time or test-time exhaustive match invariants (capability ledgers) to prevent unreviewed API drift across independent client implementations.

---

### Incident 5: Hosted Linux Cross-Compilation Toolchain & TLS Model Hazards (BUG-BUILD-05)
- **Context**: `scripts/build_preview_linux_hosted.sh` & `tests/test_preview_linux_hosted.py`
- **What Was Expected**: Automated preview releases compiled on remote Linux runners target glibc 2.17 (CentOS 7 compatibility) for x86_64, and managed nightly compilers for AArch64 without crashing on dynamic TLS allocation.
- **What Actually Happened**: Host toolchains permitted leakage of host `RUSTFLAGS`, dynamic OpenSSL links, and native initial-exec thread-local storage (TLS) models on AArch64 targets, causing `dlopen` crashes on legacy Linux targets lacking TLS descriptor pools.
- **Evidence in Repo**: Commit `67926574`
- **Root Cause**: Cargo's global `RUSTFLAGS` environment variable overrides target-specific configurations, and unmanaged ARM linkers fall back to native TLS models incompatible with legacy libc runtimes.
- **Remediation Code Diff**:
```bash
# scripts/build_preview_linux_hosted.sh (Commit 67926574)
+ [[ -z ${RUSTFLAGS:-} && -z ${CARGO_ENCODED_RUSTFLAGS:-} ]] || fail 'global Rust flags are unsupported, use target-specific configuration'
+ [[ -z ${RUSTC_BOOTSTRAP:-} ]] || fail 'RUSTC_BOOTSTRAP is not a substitute for the pinned managed compiler'
+ unset RUSTFLAGS CARGO_ENCODED_RUSTFLAGS RUSTUP_TOOLCHAIN
+ if [[ $target == x86_64-unknown-linux-gnu ]]; then
+   args=(--remote --locked --release --target "$target.2.17" -p jcode --bin jcode --features linux-compat-vendored-openssl)
+   justrust zigbuild "${args[@]}"
+ else
+   export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_RUSTFLAGS="${CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_RUSTFLAGS:+${CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_RUSTFLAGS} }-Ztls-model=emulated"
+   justrust build "${args[@]}" -Zbuild-std=std,panic_abort
+ fi
```
- **Lesson**: Low-level cross-compilation infrastructure must sanitize environment layers (`unset RUSTFLAGS`) and explicitly enforce `-Ztls-model=emulated` for older libc runtimes to avoid dynamic linker panics.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **UTF-8 Byte Boundary Slicing**: When rendering rolling strings (e.g., in `InlineTailBuffer`), never slice strings directly by raw byte offsets:
  ```rust
  // DANGEROUS: Panics if tail.len() - MAX_CHARS lands mid-codepoint!
  // let slice = &tail[tail.len() - MAX_CHARS..];

  // INVARIANT: Floor to the nearest preceding valid UTF-8 character boundary
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
  let start = floor_char_boundary(&tail, tail.len().saturating_sub(MAX_CHARS));
  let safe_slice = &tail[start..];
  ```
- **Visible vs Stored Indexing Invariant**: In `/rewind` transcripts, user/assistant turns are numbered sequentially on screen (1..N), but raw history interleaves `ToolUse`, `ToolResult`, and `SystemReminder` blocks. Never use screen index as storage index:
  ```rust
  // crates/jcode-app-core/src/agent/conversation_reset.rs
  let targets = self.session.rewind_target_stored_indices();
  if message_index == 0 || message_index > targets.len() {
      return Err("Out of bounds".into());
  }
  // Map 1-based visible turn to physical 0-based vector index
  let physical_len = targets[message_index - 1] + 1;
  self.session.truncate_messages(physical_len);
  ```

### 2. Infinite Loop & Recursion Guards
- **Empty Post-Tool Continuation Guard**: Models returning empty whitespace after tool results trigger continuation prompts. If unconstrained, the agent loops infinitely.
  ```rust
  // crates/jcode-app-core/src/agent/messages.rs
  pub(super) fn messages_end_with_tool_result(messages: &[Message]) -> bool {
      messages.iter().rev().any(|message| {
          if !matches!(message.role, Role::User) { return false; }
          message.content.iter().any(|block| match block {
              ContentBlock::ToolResult { .. } => true,
              ContentBlock::Text { text, .. } => {
                  let trimmed = text.trim();
                  trimmed.starts_with("<system-reminder>")
                      // INVARIANT: Do not treat the synthetic empty continuation
                      // reminder as a true tool result, breaking the recursive loop.
                      && !trimmed.starts_with(Self::EMPTY_POST_TOOL_CONTINUATION_PREFIX)
              }
              _ => false,
          })
      })
  }
  ```

### 3. UI & UX Micro-Mechanics
- **Line & Character Bounding Invariants**: `InlineTailBuffer` bounds terminal memory usage by maintaining dual limits:
  `MAX_LINES = 14`, `MAX_CHARS = 1400`, `MAX_SUMMARY_CHARS = 60`.
  1. Live text deltas accumulate in a staging buffer.
  2. Commits prune trailing whitespaces and enforce a maximum line depth:
  ```rust
  // crates/jcode-app-core/src/agent/inline_tail.rs
  self.committed.push_back(line);
  while self.committed.len() > MAX_LINES {
      self.committed.pop_front();
  }
  ```
  3. Tool summaries prioritize explicit agent `intent` fields before falling back to truncated JSON input parameters.

### 4. Backend Concurrency & Memory Safety
- **Idle Hibernation Memory Scrubbing**: When an agent session transitions to idle, derived allocations are purged while maintaining disk/session integrity:
  ```rust
  // crates/jcode-app-core/src/agent/idle_hibernation.rs
  pub(crate) fn hibernate_idle_caches(&mut self