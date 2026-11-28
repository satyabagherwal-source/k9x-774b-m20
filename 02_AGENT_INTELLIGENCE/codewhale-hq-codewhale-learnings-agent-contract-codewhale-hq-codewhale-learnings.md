# Agent Contract: Agent Contract: codewhale-hq-codewhale-learnings Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq-codewhale-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T09:08:24.181Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-codewhale-hq-codewhale-learnings",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq-codewhale-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T09:08:24.181Z`  
> **Learning ID**: `LEARN-EVO-codewhale-hq-codewhale-learnings`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `codewhale-hq-codewhale-learnings-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`  
> **Source**: github ([https://github.com/codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale))  
> **Source Version**: `98e055e6`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-28T09:08:17.556Z  
> **Learning ID**: `learn-github-codewhale-hq-codewhale`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): codewhale-hq/Codewhale

---

## 1. Executive Forensic Architecture & System Mechanics

### Technical Problem Domain
`codewhale-hq/Codewhale` is a production terminal-native coding agent written in Rust (41,000+ stars, Rust edition 2024 / MSRV 1.89+). It solves the problem of orchestrating non-deterministic Large Language Model (LLM) agents alongside deterministic operating system operations: arbitrary shell command execution, workspace tree modifications, multi-agent child task delegation, and cross-platform terminal interface rendering. 

The system provides guarantees across four operational boundaries:
1. **Model Cache Determinism:** Enforcing exact byte-level prefix stability across turns to guarantee provider-side key-value (KV) prompt caching.
2. **Sub-Agent Authority Non-Escalation:** Bounding dynamic sub-agent spawning through mathematical capability set intersection.
3. **Cross-Platform Host Normalization:** Decoupling platform-specific telemetry, shell guidance, and token counting from core conversation loop replay engines.
4. **UI Event-Loop Non-Blocking Invariant:** Offloading filesystem traversal, git diff computations, and token packing completely outside the terminal UI polling/rendering cycle.

### Subsystem Boundaries & Decoupling
```
┌────────────────────────────────────────────────────────────────────────┐
│                              Terminal UI                               │
│  (crates/tui, vendor/codewhale-ratatui: views, composer, completions)  │
└──────────────────┬──────────────────────────────────▲──────────────────┘
                   │ User Intent / Key Events         │ Render Frames / Async Events
                   ▼                                  │
┌─────────────────────────────────────────────────────┴──────────────────┐
│                   Asynchronous Dispatch Supervisor                     │
│  (crates/tui/src/tui/ui/dispatch.rs: MentionContext, Off-thread I/O)   │
└──────────────────┬──────────────────────────────────▲──────────────────┘
                   │ Engine Operations (Op::SendMessage)│ Event Streams (JSONL)
                   ▼                                  │
┌─────────────────────────────────────────────────────┴──────────────────┐
│                          Core Engine Runtime                           │
│  (crates/engine, crates/core: PrefixStabilityManager, Token Estimator) │
└──────┬───────────────────────┬───────────────────────┬─────────────────┘
       │                       │                       │
       ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────────────────┐
│ Agent Substrate│     │ Sandbox & OS │       │ State Store & Config     │
│ (agent-contract│     │ (crates/     │       │ (crates/state: SQLite    │
│  ChildGrant)   │     │  sandbox)    │       │  crates/config: setup)   │
└──────────────┘       └──────────────┘       └──────────────────────────┘
```

The codebase is partitioned into over 40 focused workspace member crates:
- **`crates/core`**: Implements domain primitives (`ContextReference`, `BoundedFragment`, `PrefixStabilityManager`). Defines immutable token budgets, fragment byte ceilings (10,000 tokens / 40,000 bytes), and KMP-based overlapping history deduction (`persisted_overlap`).
- **`crates/agent-contract`**: Defines capability contracts (`ChildGrant`, `PermissionSet`, `ShellPolicy`, `FileGrant`). Enforces lattice-based monotonicity where spawned workers cannot escalate rights beyond their parent (`parent.intersect(child)`).
- **`crates/config`**: Governs persistent configuration, setup states (`setup_state.json`), hook pipelines, and cross-platform filesystem migration paths.
- **`crates/tui` & `crates/tui-kit`**: Terminal User Interface powered by a custom vendored fork of `ratatui`. Manages terminal alternate screens, IME/CJK input normalization, and asynchronous mention extraction.
- **`crates/engine`**: Owns the active session state machine, provider API streaming, tool calling lifecycle, context compaction, and replay conformance harnesses.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Lattice-Based Monotonic Capability Intersection for Agent Sub-Processes
**RULE**:
When an autonomous system spawns child workers, sub-agents, or sandboxed execution tasks, the child capability set MUST be computed via mathematical intersection (`parent ∩ requested`) against the parent’s grant. Every capability axis MUST be modeled as an ordered lattice (`Ord` / `PartialOrd`) where `min()` represents the safer/restrictive boundary. A child process MUST NOT be instantiated with an unverified capability envelope or inherit unmasked ambient parent permissions.

**WHY**:
Dynamic multi-agent systems suffer from privilege escalation traps: a parent running in a read-only or review role spawns a helper sub-agent that defaults to full read/write/network capabilities, bypassing workspace modification locks. Modeling permissions as ordered enums (`FileGrant: None < Read < Write`, `ShellGrant: None < Inspect < Verify < Full`) guarantees that any attempt by a child to widen its operational envelope collapses to the narrower permission held by the parent.

**WHEN TO APPLY**:
Apply to any multi-agent orchestration architecture, child process spawning framework, or plugin/extension host interface in Rust, Go, TypeScript, or Python.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum FileGrant {
    None = 0,
    Read = 1,
    Write = 2,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum ShellGrant {
    None = 0,
    Inspect = 1,
    Verify = 2,
    Full = 3,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChildGrant {
    pub files: FileGrant,
    pub shell: ShellGrant,
    pub network: bool,
    pub desktop: bool,
    pub spawn: bool,
}

impl ChildGrant {
    /// Non-escalation primitive: parent grants constrain requested child grants.
    #[must_use]
    pub fn intersect(&self, requested: &ChildGrant) -> Self {
        Self {
            files: self.files.min(requested.files),
            shell: self.shell.min(requested.shell),
            network: self.network && requested.network,
            // Hard invariant: child never inherits desktop privilege under delegation
            desktop: false,
            // Sub-delegation permitted only if parent permits AND requested
            spawn: self.spawn && requested.spawn,
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Defaulting or blindly accepting requested roles without intersecting
pub fn spawn_subagent(parent: &Agent, requested_role: &str) -> Agent {
    let grant = match requested_role {
        "builder" => ChildGrant { files: FileGrant::Write, shell: ShellGrant::Full, network: true, desktop: false, spawn: true },
        _ => ChildGrant::default_readonly(),
    };
    // CRITICAL SECURITY BUG: If parent is Read-Only, requesting "builder" escalates rights!
    Agent::new(grant)
}
```

**VERIFICATION METHOD**:
Property test enforcing mathematical monotonicity across all possible parent/requested state spaces:
```rust
#[test]
fn test_capability_monotonicity() {
    let parent = ChildGrant { files: FileGrant::Read, shell: ShellGrant::Inspect, network: false, desktop: false, spawn: false };
    let escalation_attempt = ChildGrant { files: FileGrant::Write, shell: ShellGrant::Full, network: true, desktop: true, spawn: true };
    let effective = parent.intersect(&escalation_attempt);
    
    assert_eq!(effective.files, FileGrant::Read);
    assert_eq!(effective.shell, ShellGrant::Inspect);
    assert!(!effective.network);
    assert!(!effective.desktop);
    assert!(!effective.spawn);
}
```

---

### 2. Off-Thread Snapshot Capture for UI Dispatch with Recovery Rollbacks
**RULE**:
A Terminal User Interface (TUI) or graphical event loop MUST NOT perform synchronous filesystem scans, git repository interrogations, or metadata stabilization on the main rendering/input thread. The UI thread MUST immediately capture an immutable snapshot of lightweight context pointers (`MentionContext`), perform an optimistic UI state transition (e.g., clearing input buffer, displaying draft), and offload resolution to a dedicated blocking/async worker pool. If the background resolution or downstream pipeline fails or cancels, the system MUST execute a pre-registered compensating rollback to restore the uncommitted user input.

**WHY**:
Evaluating mention tags (e.g., `@src/lib.rs`, `@git`, `@diff`) requires blocking directory scans, resolving symbolic links, and spawning external sub-processes (e.g., `git diff-index`). Executing this on the event loop starves terminal redrawing, drops keystrokes, breaks frame timing, and freezes the terminal. Furthermore, if background resolution aborts, the user's drafted prompt is permanently destroyed unless a formal recovery callback restores it.

**WHEN TO APPLY**:
Any interactive client application (terminal, desktop, or web) that accepts enriched tokens, attachments, or file paths within a prompt editor before network transmission.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::oneshot;

#[derive(Clone, Debug)]
pub struct MentionContext {
    pub workspace: PathBuf,
    pub cwd: Option<PathBuf>,
    pub completion_index: Option<Arc<[String]>>,
}

pub struct UserDispatchPrepare {
    pub content: String,
    pub mention_context: Option<MentionContext>,
    pub rollback_draft: String,
}

impl UserDispatchPrepare {
    pub async fn resolve_mentions_off_thread(mut self) -> Result<String, (anyhow::Error, String)> {
        let Some(ctx) = self.mention_context.take() else {
            return Ok(self.content);
        };
        
        let raw_prompt = self.content.clone();
        let rollback = self.rollback_draft.clone();

        // Spawn to blocking thread pool; do not starve runtime event loop
        tokio::task::spawn_blocking(move || {
            let resolved = ctx.resolve_file_references(&raw_prompt)?;
            Ok(resolved)
        })
        .await
        .map_err(|join_err| (anyhow::anyhow!(join_err), rollback.clone()))?
        .map_err(|resolve_err| (resolve_err, rollback))
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Resolving git and disk mentions inside synchronous key-press handler
fn on_enter_pressed(app: &mut App) {
    let text = app.input_box.drain();
    // BLOCKS EVENT LOOP: If git status takes 4 seconds on a 200k file repo, UI freezes!
    let expanded = app.resolve_git_mentions_blocking(&text); 
    app.send_to_engine(expanded);
}
```

**VERIFICATION METHOD**:
Integration test asserting that input fields preserve state across aborted resolution pipelines:
```rust
#[tokio::test]
async fn test_aborted_dispatch_preserves_input_draft() {
    let mut app = create_mock_tui_app();
    app.input = "Explain @unreadable_pipe".to_string();
    let prepare = app.prepare_dispatch();
    app.input.clear();
    
    // Simulate resolution failure
    let result = prepare.resolve_mentions_off_thread().await;
    assert!(result.is_err());
    let (_, rollback) = result.unwrap_err();
    app.input = rollback;
    
    assert_eq!(app.input, "Explain @unreadable_pipe");
}
```

---

### 3. Byte-Level Prefix Fingerprinting with Strict Wire-Ordering Serialization
**RULE**:
When interacting with LLM APIs utilizing server-side prompt/prefix caching (such as DeepSeek, Claude Prompt Caching, or OpenAI Prefix Caching), all immutable system headers, base policies, and tool schemas MUST be serialized in deterministic, fixed provider-wire order and fingerprinted using cryptographic hashing (SHA-256). Sorting object keys or tool definitions after fingerprint computation MUST NOT occur. Any detected divergence between request turns MUST be attributed to either an authorized configuration mutation or an explicit, logged cache drift failure.

**WHY**:
Modern frontier model inference engines establish KV cache pages based on exact raw token/byte stream identity. Reordering two tool definitions or mutating a single whitespace character within a markdown system instruction invalidates 100% of the cached KV cache downstream from the offset. If sorting tools alphabetically locally while sending them in arbitrary order over JSON, the local validation passes while cloud inference costs and time-to-first-token (TTFT) spike by orders of magnitude.

**WHEN TO APPLY**:
LLM orchestrators, chat completions proxies, and agent loop engines communicating with prompt-cached LLM providers.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use sha2::{Digest, Sha256};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WireToolSpec {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PrefixFingerprint {
    pub system_sha256: String,
    pub tools_sha256: String,
    pub combined_sha256: String,
}

impl PrefixFingerprint {
    pub fn compute_exact(system_prompt: &str, tools: &[WireToolSpec]) -> Result<Self, serde_json::Error> {
        let mut hasher = Sha256::new();
        hasher.update(system_prompt.as_bytes());
        let system_sha256 = format!("{:x}", hasher.finalize());

        let mut tool_hasher = Sha256::new();
        for tool in tools {
            // MUST serialize each tool in exact wire array sequence
            let serialized = serde_json::to_vec(tool)?;
            tool_hasher.update(&serialized);
            tool_hasher.update(b"\n");
        }
        let tools_sha256 = format!("{:x}", tool_hasher.finalize());

        let mut combined_hasher = Sha256::new();
        combined_hasher.update(system_sha256.as_bytes());
        combined_hasher.update(b":");
        combined_hasher.update(tools_sha256.as_bytes());
        let combined_sha256 = format!("{:x}", combined_hasher.finalize());

        Ok(Self {
            system_sha256,
            tools_sha256,
            combined_sha256,
        })
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Sorting tool list during hashing when the wire serializer preserves insert order
pub fn compute_buggy_fingerprint(system_prompt: &str, mut tools: Vec<WireToolSpec>) -> String {
    // BUG: Mutating array order to sort by name diverges from actual JSON sent over HTTP!
    tools.sort_by(|a, b| a.name.cmp(&b.name)); 
    let mut hasher = Sha256::new();
    hasher.update(serde_json::to_vec(&tools).unwrap());
    format!("{:x}", hasher.finalize())
}
```

**VERIFICATION METHOD**:
Automated conformance harness checking that serialized payload prefixes match across consecutive requests:
```rust
#[test]
fn test_wire_prefix_stability() {
    let spec1 = WireToolSpec { name: "b".into(), description: "desc".into(), parameters: serde_json::json!({}) };
    let spec2 = WireToolSpec { name: "a".into(), description: "desc".into(), parameters: serde_json::json!({}) };
    let tools = vec![spec1, spec2];
    
    let fp1 = PrefixFingerprint::compute_exact("system_prompt", &tools).unwrap();
    let fp2 = PrefixFingerprint::compute_exact("system_prompt", &tools).unwrap();
    assert_eq!(fp1, fp2);
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Compaction Eradication of User-Pasted Summary Checkpoints (BUG-ENGINE-01)
- **Context**: Context Compaction Subsystem (`crates/engine/src/compaction/`)
- **What Was Expected**: When context window utilization approaches high saturation, the engine triggers conversational history compaction, substituting historical dialogue blocks with a structured summary checkpoint (`<codewhale:summary>`). If a user pastes a message that happens to start with an identical summary heading (e.g., pasting a debug transcript from a previous session), the compaction algorithm must recognize provenance and only replace true runtime-generated checkpoints, retaining the user's pasted transcript as immutable user content.
- **What Actually Happened**: The compaction selector used purely lexical/string matching on the header banner (`# Conversation Summary`) to identify and purge prior checkpoints. When a user pasted an older transcript containing this exact banner, the compaction engine classified the user's authentic input as an obsolete system checkpoint and dropped it entirely from the conversation history on the subsequent turn.
- **Evidence in Repo**: Issue #7562, Closed PR #7565. Test fixture: `crates/engine/src/compaction/tests.rs` (`test result: ok. 13 passed`).
- **Root Cause**: Failure to separate lexical structure from turn provenance metadata (`UserInputProvenance`). The selector assumed that any block matching the markdown header of a summary was an engine artifact.
- **Remediation Code Diff**:
```rust
// - Lexical header matching targeting entire history entry
// if message.content.starts_with("# Conversation Summary") {
//     drop_or_replace_checkpoint(message);
// }

// + Typed provenance discrimination coupled with checkpoint structure
if message.provenance == UserInputProvenance::SystemGeneratedCheckpoint {
    drop_or_replace_checkpoint(message);
} else {
    // Real user text (even if containing summary headers) follows normal retention budget
    retain_user_history_entry(message);
}
```
- **Lesson**: Data content must never masquerade as control flow metadata. Checkpoint boundaries must be discriminated by strongly typed runtime provenance tags rather than textual prefixes in message bodies.

---

### Incident 2: Inline Skill Mention Discovery Failure on Non-Spaced CJK Boundaries (BUG-TUI-02)
- **Context**: TUI Composer Slash/Skill Mention Autocompletion (`crates/tui/src/tui/mention_completion.rs`, `crates/tui-kit`)
- **What Was Expected**: Typing trigger characters (`/` or `$`) in the TUI input composer should pop open the autocompletion menu for commands and skills, whether the trigger follows ASCII whitespace or non-delimited Chinese, Japanese, or Korean (CJK) characters (e.g., `请用$my` or `看看，/my`).
- **What Actually Happened**: The boundary scanner function `is_inline_skill_mention_start` checked if the preceding character was an ASCII whitespace, opening parenthesis, or quote. Because CJK prose does not employ word spaces, the condition failed when typing `/` or `$` immediately following CJK characters, causing the autocomplete dropdown to remain hidden.
- **Evidence in Repo**: Closed PR #7563, Reference PR #7258. Added regression test `inline_skill_popup_opens_directly_after_cjk_text`.
- **Root Cause**: Western-centric token boundary assumption: assuming all word triggers must be preceded by ASCII whitespace (`c.is_ascii_whitespace()`).
- **Remediation Code Diff**:
```rust
// crates/tui/src/tui/mention_completion.rs
fn is_inline_skill_mention_start(prev_char: Option<char>) -> bool {
    match prev_char {
        None => true,
        Some(c) if c.is_ascii_whitespace() || matches!(c, '(' | '[' | '{' | '"' | '\'') => true,
// -    Some(_) => false,
// +    Some(c) => codewhale_tui_kit::translation::is_cjk(c) || is_cjk_punctuation(c),
    }
}
```
- **Lesson**: Text input parsers in internationalized developer tools must treat unicode script boundary transitions (specifically CJK ideographs to ASCII punctuation) as valid lexical trigger boundaries.

---

### Incident 3: TUI Event Loop Starvation during File and Git Mention Expansion (BUG-TUI-03)
- **Context**: User Message Submission Dispatcher (`crates/tui/src/tui/ui/dispatch.rs`)
- **What Was Expected**: Submitting a user prompt containing file mentions (`@file.txt`) or git queries (`@git`, `@diff`) must submit instantly in the terminal UI, echoing the user's message optimistically and retaining the ability to cancel mid-flight without locking keyboard interaction.
- **What Actually Happened**: `prepare_user_dispatch` invoked synchronous file reading, symbolic link checking, and external `git` shell subprocesses directly on the terminal event loop thread prior to message enqueueing. On large git repositories, running `git diff-index` or walking nested directories blocked the main thread for several seconds, dropping input events and rendering the application completely unresponsive.
- **Evidence in Repo**: Commit `9c5ea33f`, Issue #6561. Refactored `UserDispatchPrepare` to decouple `MentionContext`.
- **Root Cause**: Monolithic dispatch execution: combining input acceptance, git command execution, file tree traversal, and engine enqueueing into a single synchronous function call on the UI thread.
- **Remediation Code Diff**:
```rust
// crates/tui/src/tui/ui/dispatch.rs
// - let user_request = crate::tui::file_mention::user_request_with_file_mentions_cached(
// -     &display, &app.workspace, cwd, git_cache, completion_index,
// - );
// - app.engine.send(user_request);

// + Capture lightweight, immutable context and transfer work to worker thread
pub(super) struct MentionContext {
    workspace: PathBuf,
    cwd: Option<PathBuf>,
    completion_index: Option<std::sync::Arc<[String]>>,
    plugins: Option<std::sync::Arc<codewhale_plugins::PluginRegistry>>,
}

let mention_ctx = MentionContext::capture(app, message, cwd);
// Dispatch to blocking worker pool while keeping UI loop free:
tokio::task::spawn_blocking(move || {
    mention_ctx.resolve(message)
});
```
- **Lesson**: User input capture must be strictly decoupled from context materialization. UI acceptance must take an optimistic snapshot and yield immediately.

---

### Incident 4: Cross-Platform Diagnostic Token Count Divergence on Windows Fixtures (BUG-TEST-04)
- **Context**: Context Diagnostics & Test Replay Engine (`crates/tui/src/commands/debug_diagnostics_test_support.rs`)
- **What Was Expected**: Test suites validating the context inspector report (`context_report.txt`, `context_json.txt`) must pass deterministically across Linux, macOS, and Windows CI runners.
- **What Actually Happened**: The Linux environment block contributed 21 tokens (`/bin/bash`), whereas the Windows environment contributed 22 tokens (`pwsh.exe`) or Linux `sh` contributed 19 tokens. The baseline fixture normalizer applied naive string replacements (`.replace("1882", "1883")`) which erroneously altered token metrics inside other non-environment context entries, leading to assertion failures in Windows CI.
- **Evidence in Repo**: Commit `98e055e6`. Test: `context_expectations_preserve_counts_for_each_host`.
- **Root Cause**: Global scalar substring replacement. Replacing raw token number strings (e.g., `"21"`) in serialized JSON/text fixtures without scoping the regex match to the specific `environment_block` key mutated unrelated report fields.
- **Remediation Code Diff**:
```rust
// crates/tui/src/commands/debug_diagnostics_test_support.rs
// - let delta = tokens.saturating_sub(21);
// - adjusted = adjusted.replace(&format!("Source-entry total: {}", total - delta), ...);

// + Scoped Regex matching only the specific environment block
static ENVIRONMENT_COUNT: OnceLock<Regex> = OnceLock::new();
let environment_count = ENVIRONMENT_COUNT.get_or_init(|| {
    Regex::new(r#"("source_kind": "environment_block",[^{}]*?"estimated_tokens": )21,"#)
        .expect("environment entry token count regex")
});
let mut adjusted = environment_count
    .replace_all(expected, format!("${{1}}{tokens},"))
// Correct total accounting by subtracting base 21 and adding actual tokens
adjusted = adjusted.replace(
    &format!("Source-entry total: {total} tokens"),
    &format!("Source-entry total: {} tokens", total - 21 + tokens),
);
```
- **Lesson**: Test normalizers adjusting volatile, platform-dependent metadata must use anchored, context-aware expressions rather than global string substitutions.

---

### Incident 5: Process-Wide Shell Guidance Mutation During Conformance Replays (BUG-ENGINE-05)
- **Context**: Conformance Replay System (`crates/engine/src/tools/shell/guidance.rs`)
- **What Was Expected**: Replaying recorded session traces (golden event streams) under varying shells (`zsh`, `sh`, `bash`) must yield bit-for-bit identical tool headers and descriptions regardless of the host shell that executed the test runner.
- **What Actually Happened**: The runtime command guidance lazily initialized a static description based on `std::env::var("SHELL")`. If a test suite executed in an environment where `/bin/zsh` initialized the static cache first, all subsequent golden replay fixtures expected `bash` descriptions but received `zsh` headers, failing the conformance suite.
- **Evidence in Repo**: Commit `6fa2aa79`, Reference Issue #6698.
- **Root Cause**: Process-wide static memoization (`Box::leak` / `OnceLock`) initialized against ambient host environment variables without allowing test-support harnesses to override the recorded shell dialect.
- **Remediation Code Diff**:
```rust
// crates/engine/src/tools/shell/guidance.rs
pub(super) fn description() -> &'static str {
// - #[cfg(all(test, unix))]
// + #[cfg(all(any(test, feature = "test-support"), unix))]
    if crate::prompts::recorded_shell().is_some() {
        return Box::leak(render_description(runtime_command_guidance()).into_boxed_str());
    }
    // Ambient initialization fallback...
}
```
- **Lesson**: Global runtime caches that format prompts or tool definitions based on host OS environment variables must expose deterministic overrides for conformance replay engines.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Exact Path Separators on Windows vs Unix**: Path components must never be joined with string interpolation or slash literals (`fleets/stopship.toml`). Always use `Path::join()` or `PathBuf::push()`:
  ```rust
  // WRONG (Breaks on Windows UNC and backslash paths)
  let p = home.path().join("fleets/stopship.toml");

  // CORRECT (Cross-platform native components)
  let p = home.path().join("fleets").join("stopship.toml");
  ```
- **Ceiling Division for Conservative Token Estimation**: When estimating token bounds from raw byte buffers, standard integer division (`bytes / 4`) truncates down, undercounting token boundaries. Token counting MUST use ceiling division:
  ```rust
  #[inline]
  pub fn estimate_tokens(text: &str) -> usize {
      // Avoid underestimating context consumption
      text.len().div_ceil(4)
  }
  ```
- **UTF-8 Char Boundary Truncation**: Slicing strings directly on byte limits causes runtime panics if the index lands inside a multi-byte UTF-8 code point. Truncation must decrement backwards using `is_char_boundary()`:
  ```rust
  let mut end = max_bytes.min(text.len());
  while end > 0 && !text.is_char_boundary(end) {
      end -= 1;
  }
  text.truncate(end);
  ```

### 2. Infinite Loop & Recursion Guards
- **Strict Byte & File Count Caps on Injections**: External file inclusions and project instructions must enforce hard caps both at the individual item level and at the collection level:
  ```rust
  pub const MAX_FRAGMENT_TOKENS: usize = 10_000;
  pub const MAX_FRAGMENT_BYTES: usize = 40_000;
  pub const MAX_FRAGMENTS_PER_CONTEXT: usize = 16;
  pub const INSTRUCTIONS_FILE_MAX_BYTES: usize = 100 * 1024; // 100 KB
  ```
- **KMP Suffix-Prefix Matching to Prevent History Cycles**: To prevent infinite duplicate message injection when restoring or synchronizing history threads, `persisted_overlap` calculates the longest proper suffix of the persisted stream that matches a prefix of the incoming stream in $O(N + M)$ time using the Knuth-Morris-Pratt failure table:
  ```rust
  pub fn persisted_overlap<T: PartialEq>(persisted: &[T], offered: &[T]) -> usize {
      if offered.is_empty() { return 0; }
      let mut failure = vec![0; offered.len()];
      for index in 1..offered.len() {
          let mut matched = failure[index - 1];
          while matched > 0 && offered[index] != offered[matched] {
              matched = failure[matched - 1];
          }
          if offered[index] == offered[matched] { matched += 1; }
          failure[index] = matched;
      }
      let mut matched = 0;
      for item in persisted {
          if matched == offered.len() { matched = failure[matched - 1]; }
          while matched > 0 && *item != offered[matched] { matched = failure[matched - 1]; }
          if *item == offered[matched] { matched += 1; }
      }
      matched
  }
  ```

### 3. UI & UX Micro-Mechanics
- **Ambiguous Attachment Path Splitting**: Parsing screenshot attachments like `[Attached image: 8x4 PNG at /path/Screenshot 2026-09-28 at 9.18.11 AM.png]` breaks if splitting on the last occurrence of `" at "`. The parser must inspect substrings from left to right and match the first `" at "` whose succeeding slice satisfies `looks_absolute()`:
  ```rust
  fn attachment_path(rest: &str) -> &str {
      if looks_absolute(rest) { return rest; }
      rest.match_indices(" at ")
          .map(|(idx, sep)| &rest[idx + sep.len()..])
          .find(|candidate| looks_absolute(candidate))
          .or_else(|| rest.rsplit_once(" at ").map(|(_, path)| path))
          .unwrap_or(rest)
  }
  ```
- **MacOS Ephemeral Screenshot Stabilization**: macOS creates screenshots in transient directories (e.g., `/var/folders/.../TemporaryItems`) that the OS purges within minutes. The TUI intercepts screenshot references upon submission and copies the image payload into a stable `.codewhale/cache/screenshots/` workspace directory before passing the path down the engine pipeline.

### 4. Backend Concurrency & Memory Safety
- **Directory Traversal Defense in State Dir Resolver**: State directory access must strictly validate path components to prevent path traversal attacks escaping the designated `$CODEWHALE_HOME` root:
  ```rust
  pub(crate) fn ensure_safe_state_subdir(subdir: &str) -> Result<()> {
      if subdir.is_empty() { bail!("state subdir must not be empty"); }
      let path = std::path::Path::new(subdir);
      if path.is_absolute() || path.components().any(|c| matches!(c, 
          std::path::Component::RootDir | 
          std::path::Component::Prefix(_) | 
          std::path::Component::ParentDir
      )) {
          bail!("state subdir traversal detected: {subdir}");
      }
      Ok(())
  }
  ```
- **Fallback-Safe Directory Migration**: When migrating from legacy paths (`~/.deepseek`) to canonical roots (`~/.codewhale`), a failed atomic filesystem rename (`std::fs::rename`) due to cross-device boundaries (e.g., separate mount points or docker volumes) must fall back to a deep recursive copy without leaving the state uninitialized. If copy fails, the system must keep using the legacy directory rather than creating a half-initialized new directory.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Windows System Error Code Integer Overflow**: Process exit codes on Unix fit within `i32` (`0` to `255`), but Windows process exit codes (such as access violation `0xC0000005` = `3221225477`) overflow signed 32-bit integers. Hook matchers and exit code filters MUST store exit codes as `i64`:
  ```rust
  pub enum HookCondition {
      ExitCode {
          // i64, not i32: Windows crash code 0xC0000005 (3221225477) overflows i32
          code: i64,
      },
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
The architecture is structured as a non-reentrant event-driven supervisor.
- **Engine Core:** Isolated from rendering libraries; operates over typed commands (`Op::SendMessage`, `Op::CancelTurn`, `Op::ToolResponse`).
- **Subsystem Decoupling:** The TUI, App Server Protocol (ACP), and CLI binaries communicate with the engine exclusively through bidirectional channels (`tokio::sync::mpsc`).
- **State Store:** Embedded SQLite engine (`rusqlite`) compiled with `bundled` features to ensure zero ambient system SQLite library dependencies.

### Dimension 2: Core Abstractions
- **`ChildGrant`**: Domain primitive defining worker authority across 6 axes (`files`, `shell`, `network`, `desktop`, `surface`, `spawn`).
- **`BoundedFragment`**: Self-contained markdown context unit featuring cryptographic payload hashes and strict byte/token ceilings.
- **`PrefixStabilityManager`**: State tracking supervisor guarding KV cache hit ratios on frontier reasoning models.

### Dimension 3: Error Handling
- Two-tier error hierarchy: Recoverable operational failures use `anyhow::Result` enriched with `.context()` markers. Deterministic, contract-level domain violations use `thiserror` enums (`FragmentCapError`).
- Invariant: When an async pipeline aborts mid-flight, UI state machines execute compensating rollback lambdas, returning the uncommitted prompt into the editor buffer.

### Dimension 4: Testing
- **Conformance Goldens:** Regression shields using JSONL event trace logs (`cancel_midstream.golden.jsonl`, `plain_answer.golden.jsonl`).
- **Host Normalizers:** Dynamic text transformers neutralizing host OS differences (e.g., pwsh vs bash token count shifts) during fixture validation.
-

## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
