> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`  
> **Source**: github ([https://github.com/codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale))  
> **Source Version**: `bf028bcc`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-26T01:49:12.701Z  
> **Learning ID**: `learn-github-codewhale-hq-codewhale`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): codewhale-hq/Codewhale

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
`codewhale` is an industrial-grade, local-first autonomous terminal coding agent and multi-agent orchestrator written in Rust. It executes continuous tool-assisted software engineering loops: reading repository state, planning execution paths, modifying files via atomic diffs, executing build/test commands, orchestrating subagents with non-escalating security envelopes, and communicating with 40+ LLM providers. 

The core challenge it solves is **deterministic, safe execution across non-deterministic LLM providers without context thrashing, privilege escalation, or silent corruption**. Specifically, it eliminates:
1. **Provider Prefix-Cache Invalidation**: Preventing provider KV-cache misses caused by unstable tool schemas, shifting system prompts, and non-deterministic serialization.
2. **Subagent Privilege Escalation**: Ensuring child workers and subagents cannot execute tools, access files, or perform network requests beyond the capabilities granted to their parents.
3. **Context Boundary Violations**: Preventing token blowouts, prompt injection via instruction files, and uncontrolled memory leaks through strict token/byte caps and character boundary truncation.
4. **Environment Isolation Breaches**: Enforcing sandboxed home directory resolution (`$CODEWHALE_HOME`) to prevent cross-tenant/cross-workspace prompt history contamination.

```
                           ┌───────────────────────────────────────────────┐
                           │            CLI / TUI Host Layer               │
                           │   (ratatui, crossterm, composer, history)     │
                           └──────────────────────┬────────────────────────┘
                                                  │
                 ┌────────────────────────────────┴────────────────────────────────┐
                 ▼                                                                 ▼
   ┌───────────────────────────┐                                     ┌───────────────────────────┐
   │    App Server & RPC       │                                     │    Interactive Engine     │
   │  (JSON-RPC, threads, ACP) │                                     │  (Turn loop, Watchdog)    │
   └─────────────┬─────────────┘                                     └─────────────┬─────────────┘
                 │                                                                 │
                 └────────────────────────────────┬────────────────────────────────┘
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    Engine Runtime Core                                           │
│  ┌───────────────────────┐  ┌─────────────────────────┐  ┌────────────────────────────────────┐  │
│  │     Tool Catalog      │  │ Prefix Stability Manager│  │        Session Tree Journal        │  │
│  │ (Filtering, Shims)    │  │ (SHA-256 Fingerprinter) │  │  (Append-Only Tree Projection)     │  │
│  └───────────┬───────────┘  └────────────┬────────────┘  └─────────────────┬──────────────────┘  │
└──────────────┼───────────────────────────┼─────────────────────────────────┼─────────────────────┘
               │                           │                                 │
               ▼                           ▼                                 ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐ ┌──────────────────────────────────┐
│       Agent Contract        │ │        Config Layer         │ │          Execution Policy        │
│  ┌───────────────────────┐  │ │  ┌───────────────────────┐  │ │  ┌────────────────────────────┐  │
│  │      ChildGrant       │  │ │  │   Atomic Sidecars     │  │ │  │      Approval Mode         │  │
│  │ (Ord::min Intersection│  │ │  │ (setup_state.json)    │  │ │  │ (Trust, Sandbox, Network)  │  │
│  └───────────────────────┘  │ │  └───────────────────────┘  │ │  └────────────────────────────┘  │
└─────────────────────────────┘ └─────────────────────────────┘ └──────────────────────────────────┘
```

### Architectural Boundaries & State Ownership
1. **`crates/agent-contract` (Authority Substrate)**: Owns the immutable, non-escalating permission contracts (`PermissionSet`, `ShellPolicy`, `FileGrant`, `ShellGrant`, `ChildGrant`). All role profiles are monotonic downward projections of the parent session.
2. **`crates/core` (Domain Primitives & Engine Foundation)**:
   - `prefix_cache.rs`: Pinned SHA-256 fingerprinting of immutable system prompts and tool schemas to preserve upstream provider KV-cache hits.
   - `fragments.rs`: Enforces hard caps on context fragments (10,000 tokens / 40,000 bytes) with character-boundary-safe slicing.
   - `journal.rs`: Append-only, content-addressed session tree where branching moves `leaf_id` without historical message rewriting.
   - `context_reference.rs`: Parser for `@path` and `[Attached <kind>: <path>]` references using absolute path recognition heuristics.
3. **`crates/config` (Configuration Authority)**: Decoupled direct ownership of provider kinds, routes, and atomic sidecars (`setup_state.json`), fully retiring consumer-facing re-export facades.
4. **`crates/execpolicy` & `crates/runtime`**: Enforces strict sandbox isolation, approval traps for mutating commands, and thread management.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Lattice-Bounded Non-Escalation Authority Derivation
**RULE**:
When spawning child tasks, subagents, or worker processes, the child's capability envelope MUST be computed via a monotonic meet operation (`Ord::min` or bitwise `AND`) over the parent's effective grant and the requested role envelope. The system MUST NOT allow any child configuration to widen, bypass, or default outside the parent's boundary.

**WHY**:
Dynamic subagent frameworks frequently suffer from privilege escalation when child processes are granted permissive defaults (e.g., full shell or network access) that the parent runner lacked, or when role presets are evaluated independently of the calling context.

**WHEN TO APPLY**:
Any multi-agent framework, process supervisor, container delegator, or capability-based security model in Rust, Go, or TypeScript where tasks delegate to background or child workers.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum FileGrant {
    None = 0,
    Read = 1,
    Write = 2,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ShellGrant {
    None = 0,
    Inspect = 1,
    Verify = 2,
    Full = 3,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChildGrant {
    pub files: FileGrant,
    pub shell: ShellGrant,
    pub network: bool,
    pub spawn: bool,
    pub scope: Option<Vec<String>>,
}

impl ChildGrant {
    /// Monotonically bounds `requested` by `parent`.
    /// Guaranteed: child capabilities <= parent capabilities across every axis.
    #[must_use]
    pub fn derive_bounded(parent: &ChildGrant, requested: &ChildGrant) -> Self {
        let files = parent.files.min(requested.files);
        let shell = parent.shell.min(requested.shell);
        let network = parent.network && requested.network;
        let spawn = parent.spawn && requested.spawn;
        
        let scope = match (&parent.scope, &requested.scope) {
            (Some(p_scope), Some(r_scope)) => {
                let filtered: Vec<String> = r_scope
                    .iter()
                    .filter(|tool| p_scope.contains(tool))
                    .cloned()
                    .collect();
                Some(filtered)
            }
            (Some(p_scope), None) => Some(p_scope.clone()),
            (None, Some(r_scope)) => Some(r_scope.clone()),
            (None, None) => None,
        };

        Self { files, shell, network, spawn, scope }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// CRITICAL VULNERABILITY: Constructing child grants directly from role presets
// without intersecting with the parent executor's actual runtime grant.
pub fn spawn_subagent(parent: &Worker, role: FleetRole) -> ChildGrant {
    // ANTI-PATTERN: If parent was Read-Only, a "Builder" role escalates to Write + Shell!
    ChildGrant::for_role(&role) 
}
```

**VERIFICATION METHOD**:
Property test asserting non-escalation invariants:
```rust
#[test]
fn test_child_grant_non_escalation_property() {
    let parent = ChildGrant {
        files: FileGrant::Read,
        shell: ShellGrant::Inspect,
        network: false,
        spawn: false,
        scope: Some(vec!["read_file".into()]),
    };
    let unconstrained_request = ChildGrant {
        files: FileGrant::Write,
        shell: ShellGrant::Full,
        network: true,
        spawn: true,
        scope: Some(vec!["write_file".into(), "read_file".into()]),
    };
    let derived = ChildGrant::derive_bounded(&parent, &unconstrained_request);
    assert!(derived.files <= parent.files);
    assert!(derived.shell <= parent.shell);
    assert!(!derived.network);
    assert!(!derived.spawn);
    assert_eq!(derived.scope.unwrap(), vec!["read_file".to_string()]);
}
```

---

### 2. Provider Wire Prefix-Stability Invariant
**RULE**:
Before dispatching LLM chat requests, the immutable request prefix (system instructions, format markers, and serialized tool definitions in exact wire order) MUST be fingerprinted with a cryptographically secure hash (SHA-256). Any mutation across turns MUST be explicitly categorized as an intentional re-pin (with logged provenance) or flagged as cache drift.

**WHY**:
Modern frontier LLMs (e.g., DeepSeek, Anthropic, OpenAI) implement KV-cache reuse keyed strictly to matching byte prefixes. An unintentional change in tool definitions, schema key ordering, or dynamic timestamps in system prompts resets the KV cache for the entire context, causing 10x–50x cost inflation and massive TTFT latency spikes.

**WHEN TO APPLY**:
All agentic request construction pipelines and LLM client dispatch engines interacting with prefix-cached APIs.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use sha2::{Digest, Sha256};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PrefixFingerprint {
    pub system_sha256: String,
    pub tools_sha256: String,
    pub combined_sha256: String,
}

impl PrefixFingerprint {
    pub fn compute(system_text: &str, tools: &[Value]) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(system_text.as_bytes());
        let system_sha256 = format!("{:x}", hasher.finalize());

        let mut hasher = Sha256::new();
        for tool in tools {
            // Must preserve exact wire order and normalized serialization
            let serialized = serde_json::to_vec(tool).expect("Tool serialization invariant");
            hasher.update(&serialized);
            hasher.update(b"\n");
        }
        let tools_sha256 = format!("{:x}", hasher.finalize());

        let mut hasher = Sha256::new();
        hasher.update(format!("{}:{}", system_sha256, tools_sha256).as_bytes());
        let combined_sha256 = format!("{:x}", hasher.finalize());

        Self { system_sha256, tools_sha256, combined_sha256 }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Dynamically interpolating timestamps or reordering tool maps
// inside the system prompt or tool catalog on every turn.
pub fn build_bad_system_prompt(base_prompt: &str) -> String {
    format!("{}\nCurrent time: {}", base_prompt, chrono::Utc::now()) // Destroys KV cache every second!
}
```

**VERIFICATION METHOD**:
```rust
#[test]
fn test_prefix_fingerprint_stability() {
    let system = "You are a senior software engineer.";
    let tool_a = serde_json::json!({"type": "function", "function": {"name": "read"}});
    let tool_b = serde_json::json!({"type": "function", "function": {"name": "write"}});

    let fp1 = PrefixFingerprint::compute(system, &[tool_a.clone(), tool_b.clone()]);
    let fp2 = PrefixFingerprint::compute(system, &[tool_a, tool_b]);
    assert_eq!(fp1, fp2, "Prefix fingerprint must be deterministic across identical inputs");
}
```

---

### 3. UTF-8 Char Boundary Slicing on Bounded Buffer Caps
**RULE**:
When truncating arbitrary context files, logs, or prompt fragments to a hard byte ceiling, the system MUST NOT split a multi-byte UTF-8 character. The truncation index MUST be validated against `str::is_char_boundary(index)` and decremented to the preceding valid scalar boundary.

**WHY**:
Naively slicing strings via byte indexing (`&text[..MAX_BYTES]`) panics at runtime with `byte index X is not a char boundary` if the ceiling falls within a UTF-8 code point sequence (common in multi-language prompts, CJK text, emojis, or specialized symbols).

**WHEN TO APPLY**:
Any text truncation, token ceiling clamping, log truncation, or byte-bounded context loader in Rust.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub fn truncate_to_char_boundary(text: &str, max_bytes: usize) -> &str {
    if text.len() <= max_bytes {
        return text;
    }
    let mut end = max_bytes;
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }
    &text[..end]
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Direct byte slicing without character boundary verification
pub fn unsafe_truncate(text: &str, max_bytes: usize) -> &str {
    &text[..max_bytes.min(text.len())] // WILL PANIC on multi-byte UTF-8 characters!
}
```

**VERIFICATION METHOD**:
```rust
#[test]
fn test_char_boundary_truncation_safety() {
    let multi_byte = "你好世界，Hello World! 🦀🦀🦀";
    for cut_point in 0..multi_byte.len() {
        let sliced = truncate_to_char_boundary(multi_byte, cut_point);
        assert!(sliced.len() <= cut_point);
        assert!(std::str::from_utf8(sliced.as_bytes()).is_ok());
    }
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Leaked DeepSeek DSML Tool Markup Treated as Code Review Findings (BUG-DEEPSEEK-01)
- **Context**: `crates/tui/src/tools/review_core.rs`, `crates/tui/src/core/engine/streaming.rs`
- **What Was Expected**: Running `codewhale review` on clean, low-risk diffs (where 0 tools are offered to the model) should analyze code, produce a structured findings tally `<!-- codewhale-review: ... -->`, or output "Checked, nothing wrong" and exit 0.
- **What Actually Happened**: DeepSeek-Flash, when offered zero tools, leaked its raw, internal DSML tool markup verbatim: `<｜｜DSML｜｜ calls> <｜｜DSML｜｜ invoke name="read_file">...`. The review subsystem treated this output as the final valid review text and exited 0 with no review tally, suppressing all code quality checks (Issue #7072).
- **Evidence in Repo**: Issue #7072; commit references in `crates/tui/src/core/engine/streaming.rs:717` (`TOOL_CALL_MARKER_PAIRS`, `contains_fake_tool_wrapper`).
- **Root Cause**: The streaming chat engine had sanitizers for fake/leaked tool markup (`contains_fake_tool_wrapper`), but the newly isolated `review_core.rs` built its own HTTP requests directly without routing the output through the core engine's markup-stripping sanitizer.
- **Remediation Code Diff**:
```rust
// - Direct unvalidated assignment in review_core.rs
// let review_text = response.text;

// + Sanitize and detect fake tool calls before finalizing review output
if contains_fake_tool_wrapper(&response.text) {
    let sanitized = sanitize_leaked_tool_markup(&response.text);
    if sanitized.trim().is_empty() {
        anyhow::bail!("Model emitted leaked tool markers instead of review output");
    }
    review_text = sanitized;
} else {
    review_text = response.text;
}
```
- **Lesson**: Subsystem specialization must not bypass core output sanitization filters. All model generation outputs must pass through universal protocol-level sanitization before being exposed to domain logic.

---

### Incident 2: Environment Variable Bypass in Composer History Path Resolution (BUG-ENV-02)
- **Context**: `crates/tui/src/composer_history.rs:43-72`
- **What Was Expected**: Setting `CODEWHALE_HOME=/tmp/cw-isolated` isolates all prompt history, sidecars, and state into that directory, preventing cross-tenant leakage in CI and multi-tenant environments.
- **What Actually Happened**: Up-arrow prompt history continued reading and writing from `$HOME/.codewhale/composer_history.jsonl`. Prompts containing secrets and proprietary code were leaked to the ambient home directory across isolated sandboxes (Issue #7069).
- **Evidence in Repo**: Issue #7069 closed on 2026-10-25; commits cleaning up `session_manager.rs` and `composer_history.rs`.
- **Root Cause**: `composer_history::default_history_path()` directly invoked `effective_home_dir()` (which resolved to `dirs::home_dir()`) instead of checking the configuration priority ladder: `CODEWHALE_HOME -> config path -> effective_home_dir()`. Furthermore, it unconditionally included a legacy fallback to `~/.deepseek/composer_history.jsonl`.
- **Remediation Code Diff**:
```rust
// - In composer_history.rs:
// pub fn default_history_path() -> PathBuf {
//     effective_home_dir().join(".codewhale").join("composer_history.jsonl")
// }

// + Enforce strict CODEWHALE_HOME isolation without fallback
pub fn default_history_path() -> PathBuf {
    if let Ok(explicit_home) = std::env::var("CODEWHALE_HOME") {
        if !explicit_home.trim().is_empty() {
            return PathBuf::from(explicit_home).join("composer_history.jsonl");
        }
    }
    codewhale_paths::ambient_home_dir()
        .join(".codewhale")
        .join("composer_history.jsonl")
}
```
- **Lesson**: Isolated test/enterprise runner environments require environment variable prioritization over OS-level user directory helpers. When an explicit home override is active, all legacy ambient directory fallbacks must be disabled.

---

### Incident 3: File Attachment Path Splitting Broken by Timestamps with " at " (BUG-PATH-03)
- **Context**: `crates/core/src/context_reference.rs:65-88`
- **What Was Expected**: Media attachments matching `[Attached image: <desc> at <path>]` should parse the exact file path even if the description or filename contains the word " at ".
- **What Actually Happened**: macOS screenshot filenames containing timestamps (e.g., `Screenshot 2026-09-28 at 9.18.11 AM.png`) caused `rsplit_once(" at ")` to split on the timestamp's " at ", corrupting the path to `9.18.11 AM.png` and crashing context hydration.
- **Evidence in Repo**: Test case `attachment_paths_may_contain_at` and commits in `crates/core/src/context_reference.rs`.
- **Root Cause**: The parser assumed that the separator `" at "` would only appear once between the description and the path, choosing naive `rsplit_once`.
- **Remediation Code Diff**:
```rust
// Naive implementation:
// let path = rest.rsplit_once(" at ").map(|(_, path)| path).unwrap_or(rest);

// Fixed invariant: scan for first " at " followed by an absolute path candidate
fn attachment_path(rest: &str) -> &str {
    if looks_absolute(rest) {
        return rest;
    }
    rest.match_indices(" at ")
        .map(|(idx, sep)| &rest[idx + sep.len()..])
        .find(|candidate| looks_absolute(candidate))
        .or_else(|| rest.rsplit_once(" at ").map(|(_, path)| path))
        .unwrap_or(rest)
}

fn looks_absolute(path: &str) -> bool {
    let bytes = path.as_bytes();
    path.starts_with(['/', '\\', '~'])
        || (bytes.len() >= 3
            && bytes[0].is_ascii_alphabetic()
            && bytes[1] == b':'
            && matches!(bytes[2], b'\\' | b'/'))
}
```
- **Lesson**: Parsing structural delimiters out of human-generated filenames requires domain-aware path heuristics (e.g., matching root separators or drive letters) rather than naive string splitting.

---

### Incident 4: Cyclic Dependency Bloat via TUI Configuration Re-Export Facades (BUG-REFACTOR-04)
- **Context**: `crates/tui/src/config.rs`, `crates/tui/src/client.rs`, `crates/config`
- **What Was Expected**: Low-level configuration, model constants, and provider definitions should be directly imported from `codewhale-config` to maintain clean subsystem boundaries.
- **What Actually Happened**: The TUI crate created a massive upstream re-export facade (`crate::config::{ProviderKind, ...}`) re-exporting 229 root items and 213 model constants across 143 files, causing circular crate dependencies and 20+ minute incremental build times.
- **Evidence in Repo**: Commit `478b29ea`: "refactor(config): retire the TUI upstream re-export facade [skip ci]". 1,124 lines changed across 143 files.
- **Root Cause**: Convenience re-exports in intermediate crates hide architectural layering violations, creating tightly coupled compile-time graphs where every leaf consumer depends on the heaviest UI crate.
- **Remediation Code Diff**:
```rust
// - Import from heavy intermediate TUI re-export facade:
// use crate::config::{Config, ProviderKind, DEFAULT_DEEPSEEK_BASE_URL};

// + Import directly from decoupled domain crate:
use crate::config::Config;
use codewhale_config::ProviderKind;
use codewhale_config::descriptors::defaults::DEFAULT_DEEPSEEK_BASE_URL;
```
- **Lesson**: Ban umbrella re-export facades across workspace crate boundaries. Consumers must import domain primitives directly from their owning crates to minimize compilation graphs and prevent circular dependencies.

---

### Incident 5: Dead-Code Ratchet Failure via Attribute Synonym Obfuscation (BUG-GATE-05)
- **Context**: `scripts/dead-code-budget.json`, `scripts/check-dead-code-budget.py`
- **What Was Expected**: The dead-code budget CI gate must ratchet down dead code across the repository over time.
- **What Actually Happened**: Developers bypassed the dead-code ceiling by switching `#[allow(dead_code)]` to `#[expect(dead_code)]`. The CI script counted only `allow`, permitting dead code to proliferate unchecked.
- **Evidence in Repo**: Commit `995f2a88` and `scripts/dead-code-budget.json`: comment notes that prior to #6241 the gate counted only the `allow` spelling, obscuring 71 instances.
- **Root Cause**: CI enforcement scripts targeted specific syntax tokens rather than the semantic intent of compiler attributes.
- **Remediation Code Diff**:
```python
# - In check-dead-code-budget.py:
# dead_count = count_regex(r'#\[allow\(dead_code\)\]')

# + Count both compiler attributes and ratchet the unified total:
dead_allow = count_regex(r'#\[allow\(dead_code\)\]')
dead_expect = count_regex(r'#\[expect\(dead_code\)\]')
total_dead = dead_allow + dead_expect
assert total_dead <= budget["total"], f"Dead code exceeded budget: {total_dead} > {budget['total']}"
```
- **Lesson**: Static analysis metrics and CI ratchets must account for semantic synonyms and compiler attribute variants to prevent enforcement drift.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Longest Common Overlap Algorithm**:
  In `crates/core/src/lib.rs`, the engine deduplicates session history across reconnects using a linear KMP-style failure-function computation (`persisted_overlap`) rather than an $O(N \cdot M)$ nested slice search:
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
          while matched > 0 && *item != offered[matched] {
              matched = failure[matched - 1];
          }
          if *item == offered[matched] { matched += 1; }
      }
      matched
  }
  ```
- **Strict IEEE-754 and JSON Coercion Hazards**:
  In `crates/config`, when comparing reasoning effort or token counts, never compare raw floats or assume missing values mean zero:
  ```rust
  // Safe: explicitly differentiates between unconfigured (None) vs zero (Some(0))
  let max_tokens: Option<u32> = request.max_tokens;
  let is_unconstrained = max_tokens.is_none();
  ```

### 2. Infinite Loop & Recursion Guards
- **Subagent Delegation Recursion Cap**:
  When a subagent delegates to another worker, execution depth is tracked via `ChildGrant::spawn`. Once `spawn == false`, child processes cannot instantiate another subagent runtime, mathematically terminating recursive delegation:
  ```rust
  if !current_grant.spawn {
      anyhow::bail!("Subagent delegation denied: maximum delegation depth reached");
  }
  ```
- **Context Fragment Byte & Count Ceilings**:
  In `crates/core/src/fragments.rs`, context injection loops are strictly bounded by hard constants:
  - `MAX_FRAGMENTS_PER_CONTEXT = 16`
  - `MAX_FRAGMENT_TOKENS = 10_000`
  - `MAX_FRAGMENT_BYTES = 40_000`
  - `INSTRUCTIONS_FILE_MAX_BYTES = 102_400` (100 KB)

### 3. UI & UX Micro-Mechanics
- **TUI Terminal Alternate Screen Restoration**:
  The Ratatui terminal session lifecycle must register panic hooks to ensure that terminal raw mode is deactivated and the alternate screen buffer is restored on unexpected crashes:
  ```rust
  let original_hook = std::panic::take_hook();
  std::panic::set_hook(Box::new(move |panic_info| {
      let _ = crossterm::terminal::disable_raw_mode();
      let _ = crossterm::execute!(std::io::stdout(), crossterm::terminal::LeaveAlternateScreen);
      original_hook(panic_info);
  }));
  ```

### 4. Backend Concurrency & Memory Safety
- **Watchdog Latch vs Cancellation Token**:
  In `crates/tui/src/core/engine.rs`, `tokio_util::sync::CancellationToken` cancels active worker futures. However, because tokens carry no payload, an engine sibling latch stores a strongly-typed `CancelReason`:
  ```rust
  #[derive(Debug, Clone, Copy, PartialEq, Eq)]
  pub enum CancelReason {
      User,
      External,
      Internal,
      Stalled,
  }
  ```
- **Atomic File Persistence Invariant**:
  In `crates/config/src/setup_state.rs`, writing `setup_state.json` uses atomic file replacement (writing to `.tmp` file and executing `std::fs::rename`) to prevent partial corruption during process crashes or power interrupts.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Symlink Traversal Prevention on Instruction Loading**:
  When importing project instruction files (`AGENTS.md`, `.cursorrules`), the loader explicitly verifies `!is_symlink(path)` before reading to prevent symlink traversal attacks outside the repository boundary:
  ```rust
  fn is_symlink(p: &Path) -> bool {
      std::fs::symlink_metadata(p)
          .map(|m| m.file_type().is_symlink())
          .unwrap_or(false)
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Boundary Layout**: Strict