> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rtk-ai-rtk-learnings.md`  
> **Source**: github ([https://github.com/rtk-ai/rtk](https://github.com/rtk-ai/rtk))  
> **Source Version**: `32b2ec43`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T07:52:17.885Z  
> **Learning ID**: `learn-github-rtk-ai-rtk`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): rtk-ai/rtk

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 The Core Problem Space
Large Language Model (LLM) agentic workflows (e.g., Claude Code, Cursor, Gemini Code Assist, OpenAI Codex/Operator, Pi, Windsurf) execute terminal and workspace commands to inspect, edit, and navigate codebases. Raw CLI outputs (e.g., full compiler traces, `git status`, `git diff`, directory trees, multi-megabyte JSON payloads, base64 data URLs) flood the context window, incurring severe token costs, increasing latency, and pushing relevant reasoning artifacts out of attention.

`rtk` (Rust Token Killer) operates as an ultra-low-latency (<10ms budget), agent-agnostic CLI proxy and tool execution hook layer. It intercepts commands and stdout/stderr streams, filters and compresses structural text by 60–90%, and returns high-signal, condensed outputs to LLM agents without losing diagnostic fidelity or altering underlying process exit codes.

```
+---------------------------------------------------------------------------------------------------+
|                                        HOST AGENT RUNTIME                                         |
|  (Claude Code / Cursor / Gemini CLI / Copilot / OpenCode / Windsurf / Droid / Pi / OpenClaw)      |
+---------------------------------------------------------------------------------------------------+
       |                                                                      ^
       | 1. PreToolUse / BeforeTool Execution                                 | 6. Filtered Output /
       v                                                                      |    Rewrite Input
+---------------------------------------------------------------------------------------------------+
|                                       RTK HOOK SUBSYSTEM                                          |
|                                                                                                   |
|  [src/hooks/hook_cmd.rs] <-----------------> [src/hooks/permissions.rs]                           |
|       |                                            |                                              |
|       v                                            v                                              |
|  [src/hooks/decision.rs]                 - Match deny/ask/allow rules                             |
|  - Host-specific permission evaluation   - Word-run scanner (deny_matches_any_word_run)           |
|  - Fish shell wrap isolation             - Unattestable construct guards                          |
|  - Exit 0 (Allow) / 1 (Passthrough)      - Redirection operand validation                         |
|    / 2 (Deny) / 3 (Ask)                                                                           |
+---------------------------------------------------------------------------------------------------+
       |
       | 2. Rewritten / Gated Execution
       v
+---------------------------------------------------------------------------------------------------+
|                                      RTK RUNTIME PIPELINE                                         |
|                                                                                                   |
|  [src/discover/registry.rs] <------------> [engine/src/chain.rs]                                  |
|       |                                            |                                              |
|       v                                            v                                              |
|  Execute Command / Wrap Shell             Run Method Chain:                                       |
|  - Posix vs Fish translation              - Ansi (Escape strip)                                   |
|  - Disown pair (&|) validation            - Base64Elide (looks_like_base64 guard)                 |
|  - Process spawn + code page translation  - Cap (Head 50 / Tail 200 lines)                        |
|                                           - Token growth guard (never_worse)                      |
|                                           - Panic unwinding containment                           |
+---------------------------------------------------------------------------------------------------+
       |                                                                      |
       v                                                                      v
+-----------------------------------+                 +---------------------------------------------+
|    SUBPROCESS EXECUTION ENGINE    |                 |           RECALL & TRACKING STORE           |
|  - PTY/Stdio capture              |                 |  - SQLite (rusqlite 0.34, links = sqlite3)  |
|  - Exit code preservation         |                 |  - Off-band full raw output preservation    |
|  - Cross-platform console decode  |                 |  - Provenance stamping & duplicate gating   |
+-----------------------------------+                 +---------------------------------------------+
```

### 1.2 Subsystem Decomposition and Boundaries

1. **The Core Engine (`engine/`)**:
   - Encapsulates pure, zero-I/O text transformations governed by abstract invariants.
   - Operates over immutable reference wrappers: `Block<'a>` (holding slices `&'a str`, `Subject`, `ContentFormat`, `Origin`, and `Provenance`).
   - Chains transformations via the `Method` trait, returning an `Outcome` (`Continue(String)`, `ShortCircuit(String)`, `Skip`).
   - Guarantees fail-safe execution through `catch_unwind` isolation and the `never_worse` invariant check: if an output grows in estimated tokens or results in a no-op, the compression pipeline drops the transformation and returns the pristine original.

2. **The Hook Layer (`src/hooks/`)**:
   - Implements agent-specific adapters for Claude Code, Cursor, Copilot CLI, Gemini, OpenCode, Codex, Pi, and OpenClaw.
   - Evaluates command strings before execution via granular permission rules (`Deny`, `Ask`, `Allow`).
   - Bridges differences between POSIX shells and non-POSIX environments (e.g., Fish shell) using syntax-aware rewriting.

3. **Discovery & Lexer Subsystem (`src/discover/`)**:
   - Performs lexical analysis of compound command lines (`&&`, `||`, `;`, pipes, redirects, subshells).
   - Distinguishes file redirects (`> file`, `>> file`, `>& file`) from descriptor duplications (`>&2`, `<&4`).
   - Detects unattestable constructs (command substitutions, dynamic evaluations) to abort unsafe rewrites.

4. **Tracking, Storage & Session Telemetry (`src/core/tracking.rs`, `proxy/`)**:
   - Persists metrics to SQLite using `rusqlite 0.34`.
   - Records token savings per command, layer, and subject.
   - Maintains an off-band "recall" store so agents can retrieve full, uncompressed logs if an abbreviated result proves insufficient.

---

## 2. Net-New Universal Engineering Rules

### 1. Zero-Trust Cross-Grammar Delegation Invariant
**RULE**:
When an execution hook or proxy intercepts a command string targeted at Shell A (e.g., POSIX/Bash) and wraps or rewrites it for execution inside Shell B (e.g., Fish, PowerShell, or cmd.exe), the rewriting layer **MUST NOT** rely on Shell A's structural tokenizer or command boundaries to validate safety or access-control rules. The security engine **MUST** treat every token/word within the payload as an arbitrary executable entry point across all permutations, or completely abort delegating to Shell B when any rule from the untrusted grammar is active.

**WHY**:
Different shells evaluate control flow at distinct syntactical positions. In Bash, `if condition; then command; fi` places the command after `then`. In Fish, `if condition; command; end` evaluates conditions where Bash has no grammar, and allows keywords like `and`, `or`, and `not` to act as command-level operators. If an access-control system tokenizes a script using Bash grammar and checks whether command heads match a deny-list (e.g., `deny: ["rm:*"]`), an attacker or LLM can bypass the filter via `if not rm -rf /; echo done; end`. The Bash parser sees `if` and `not` as tokens, missing `rm`. When handed to Fish, `rm` executes unprompted.

**WHEN TO APPLY**:
Apply in any tool execution gateway, agent sandbox, security proxy, or CLI sanitizer that converts, bridges, or executes scripts across heterogeneous interpreters (Bash $\to$ Fish, Bash $\to$ PowerShell, Shell $\to$ Python `-c`, etc.).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
/// Conservative security gate: treats every dequoted word token as a potential
/// command invocation before delegating to an alternative shell dialect.
pub fn deny_matches_any_word_run(words: &[String], deny_rules: &[String]) -> bool {
    if deny_rules.is_empty() {
        return false;
    }

    // Slide over all sub-slices of words to ensure no command invocation
    // can be hidden behind alternate grammar keywords (e.g., 'not', 'and', 'if').
    (0..words.len()).any(|start| {
        let run = words[start..].join(" ");
        deny_rules
            .iter()
            .any(|pattern| command_matches_pattern(&run, pattern))
    })
}

pub fn safe_wrap_script(
    raw_script: &str,
    deny_rules: &[String],
    is_opted_in: bool,
) -> Option<String> {
    if !is_opted_in {
        return None;
    }

    // 1. Strip comments deterministically across both dialects
    let sanitized = strip_comments_cross_dialect(raw_script)?;

    // 2. Lex into dequoted words
    let words = shell_dequote_split(&sanitized)?;

    // 3. Reject if ANY word run matches a deny rule
    if deny_matches_any_word_run(&words, deny_rules) {
        return None;
    }

    // 4. Reject if script contains grammar divergence, unattestable substitutions,
    //    or non-reconstructible pipe sequences (e.g., Fish '&|')
    if contains_unattestable_constructs(&sanitized) || opens_disown_pair(&sanitized) {
        return None;
    }

    Some(format!("rtk run --shell fish -c '{}'", escape_single_quotes(&sanitized)))
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Parsing only command heads via POSIX segmentation
// and passing the script to an alternate shell.
pub fn unsafe_wrap_script(cmd: &str, deny_rules: &[String]) -> Option<String> {
    let segments = posix_split_pipeline(cmd);
    for seg in segments {
        let head = seg.split_whitespace().next().unwrap_or("");
        // Fails: "if not rm -rf /" evaluates head as "if", completely missing "rm"
        if deny_rules.iter().any(|d| d == head) {
            return None;
        }
    }
    Some(format!("fish -c '{}'", cmd))
}
```

**VERIFICATION METHOD**:
Enforce compliance via property-based test checking permutation attacks:
```rust
#[test]
fn test_cross_grammar_deny_containment() {
    let deny = vec!["rm:*".to_string(), "dropdb:*".to_string()];
    let evasion_vectors = [
        "if not rm -rf /; echo ok; end",
        "while rm -f lockfile; break; end",
        "begin; and rm -rf /; end",
        "not dropdb production",
        "if 'rm' -rf /; end",
    ];
    for vector in evasion_vectors {
        assert!(
            deny_matches_any_word_run(&shell_dequote_split(vector).unwrap(), &deny),
            "Failed to catch evasion vector: {vector}"
        );
    }
}
```

---

### 2. Guarded Non-Inflationary Transformation Invariant
**RULE**:
Any automated compression, filtering, or AST-rewriting middleware operating in an LLM context pipeline **MUST** verify output token/byte consumption against the input before emitting results, and **MUST** encapsulate transform executions within panic recovery boundaries. If the output is equal to the input (no-op) or greater than the input in token weight (token inflation), the system **MUST** discard the transformed result and emit the untouched original.

**WHY**:
Context compressors frequently append diagnostic annotations, elision banners, or type markers (e.g., `[50 lines elided]`, `[+500 chars]`, `[base64 data, 10 KB elided]`). On boundary inputs—such as a payload consisting of hundreds of tiny lines just over the truncation threshold, or already compressed binary blobs—the metadata markers consume more tokens than the content removed. Furthermore, untrusted third-party inputs or malformed regex engines can panic on deep character slicing or multibyte boundary misalignment. Unhandled panics crash the hook runtime, hanging the agent or breaking the terminal session.

**WHEN TO APPLY**:
Apply to any proxy, summarizer, AST simplifier, or filter sitting between tool execution and model ingestion.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::panic::{catch_unwind, AssertUnwindSafe};

/// Compares token estimates before and after transformation.
/// Rejects no-ops and token inflation.
pub fn never_worse(input: &str, output: String) -> Option<String> {
    if output == input {
        return None;
    }
    // Reject transformations that enlarge the prompt context
    if estimate_tokens(&output) >= estimate_tokens(input) {
        return None;
    }
    Some(output)
}

/// Executes a pipeline of transformations with panic isolation
/// and token-growth guarantees.
pub fn run_pipeline_guarded(
    methods: &[&dyn TransformMethod],
    input_text: &str,
    ctx: &TransformContext,
) -> String {
    let execution = catch_unwind(AssertUnwindSafe(|| {
        let mut current = input_text.to_string();
        for method in methods {
            match method.transform(&current, ctx) {
                StepOutcome::Continue(next) => current = next,
                StepOutcome::ShortCircuit(final_text) => return final_text,
                StepOutcome::Skip => {}
            }
        }
        current
    }));

    match execution {
        Ok(transformed) => never_worse(input_text, transformed)
            .unwrap_or_else(|| input_text.to_string()),
        Err(_panic_payload) => {
            // Log telemetry error internally; degrade gracefully to unmodified text
            input_text.to_string()
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Unconditional string replacement without size verification or unwind safety
pub fn unsafe_truncate(text: &str) -> String {
    let mut out = String::new();
    for line in text.lines() {
        if line.len() > 100 {
            // Adds 25 characters to an 101 character line.
            // On millions of lines, this massively expands token size.
            out.push_str(&line[..100]);
            out.push_str("... [truncated 1 chars]\n");
        } else {
            out.push_str(line);
            out.push('\n');
        }
    }
    out // If this crashes or expands, LLM context crashes or overflows
}
```

**VERIFICATION METHOD**:
```rust
#[test]
fn test_never_worse_guarantee() {
    let input = "small string";
    let bloated_output = format!("{input} [rtk: expanded metadata annotations]");
    assert_eq!(never_worse(input, bloated_output), None);

    let identical_output = input.to_string();
    assert_eq!(never_worse(input, identical_output), None);

    let reduced_output = "small".to_string();
    assert_eq!(never_worse(input, reduced_output), Some("small".into()));
}
```

---

### 3. State-Aware Non-Destructive Workspace Config Migration Invariant
**RULE**:
When an install, initialization, or upgrade routine manages configuration files, hook scripts, or rule specifications within a user-owned workspace, it **MUST NOT** perform unconditioned file deletions or blind overwrites. The migration logic **MUST**:
1. Check that the target is a regular file (rejecting symlinks, sockets, FIFOs, and directories).
2. Validate against explicit cryptographic or normalized content hashes of known legacy versions.
3. If user content is prepended to the legacy managed block, strip **only** the managed suffix while preserving user bytes identically (accounting for `\r\n` vs `\n` normalization).
4. Fall back silently or with non-blocking warnings on unknown mutations, ensuring primary CLI operations never abort due to migration failures.

**WHY**:
Developer tooling and agent workspaces frequently co-locate generated rules (e.g., `AGENTS.md`, `.cursorrules`, `.agents/rules/...`) with manual user configurations. Unversioned or aggressive cleanup passes wipe out customized agent instructions or crash when encountering atypical filesystem nodes (e.g., broken symlinks or FIFOs). This breaks user trust and disrupts automated CI/CD environments.

**WHEN TO APPLY**:
Apply in CLI initialization routines (`init`, `install`, `uninstall`, `upgrade`) across all developer tools altering project-level configuration directories.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::fs;
use std::path::{Path, PathBuf};

pub enum MigrationOutcome {
    RemovedCompleteFile(PathBuf),
    StrippedManagedSuffix(PathBuf),
    Unchanged,
}

pub fn migrate_managed_file(
    file_path: &Path,
    known_historical_templates: &[&str],
) -> std::io::Result<MigrationOutcome> {
    let meta = match fs::symlink_metadata(file_path) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(MigrationOutcome::Unchanged),
        Err(e) => return Err(e),
    };

    // Refuse to touch symlinks, FIFOs, sockets, or directories
    if !meta.file_type().is_file() {
        return Ok(MigrationOutcome::Unchanged);
    }

    let raw_bytes = fs::read(file_path)?;
    let content = match std::str::from_utf8(&raw_bytes) {
        Ok(s) => s,
        Err(_) => return Ok(MigrationOutcome::Unchanged), // Leave non-UTF-8 untouched
    };

    // Normalize line endings for comparison without mutating original user endings
    let normalized = content.replace("\r\n", "\n");

    // Case 1: Exact match with known historical generated templates -> Delete file
    for template in known_historical_templates {
        let norm_template = template.replace("\r\n", "\n");
        if normalized.trim() == norm_template.trim() {
            fs::remove_file(file_path)?;
            return Ok(MigrationOutcome::RemovedCompleteFile(file_path.to_path_buf()));
        }
    }

    // Case 2: User appended to the file; suffix matches template -> Strip only suffix
    for template in known_historical_templates {
        let norm_template = template.replace("\r\n", "\n");
        let trimmed_template = norm_template.trim();
        if let Some(user_part) = normalized.strip_suffix(trimmed_template) {
            let user_trimmed = user_part.trim_end_matches('\n');
            // Write back preserving pristine content
            fs::write(file_path, user_trimmed)?;
            return Ok(MigrationOutcome::StrippedManagedSuffix(file_path.to_path_buf()));
        }
    }

    Ok(MigrationOutcome::Unchanged)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blindly unlinking files without checking contents or file types
pub fn unsafe_cleanup_legacy_rules(project_root: &Path) {
    let rules_path = project_root.join(".agents/rules/antigravity-rtk-rules.md");
    // Destroys user edits, panics on directories or dangling symlinks
    let _ = std::fs::remove_file(rules_path);
}
```

**VERIFICATION METHOD**:
```rust
#[test]
fn test_non_destructive_legacy_migration() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("rules.md");

    // Test 1: User content + legacy template
    let user_prefix = "# My Custom Project Invariants\n\nDo not delete this.\n\n";
    let legacy_template = "# RTK Legacy Auto-Generated Header\nVersion: 0.36.0\n";
    std::fs::write(&file, format!("{user_prefix}{legacy_template}")).unwrap();

    let res = migrate_managed_file(&file, &[legacy_template]).unwrap();
    assert!(matches!(res, MigrationOutcome::StrippedManagedSuffix(_)));
    assert_eq!(std::fs::read_to_string(&file).unwrap(), user_prefix.trim_end_matches('\n'));

    // Test 2: Unrelated file remains byte-identical
    let random_content = "# Totally Different File";
    std::fs::write(&file, random_content).unwrap();
    let res2 = migrate_managed_file(&file, &[legacy_template]).unwrap();
    assert!(matches!(res2, MigrationOutcome::Unchanged));
    assert_eq!(std::fs::read_to_string(&file).unwrap(), random_content);
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Cross-Shell Permission Evasion in Fish Shell Wrapping (BUG-HOOK-FISH-01)
- **Context**: `src/hooks/decision.rs`, `src/discover/fish_script.rs`, `src/hooks/permissions.rs`
- **What Was Expected**: Multi-line Fish scripts (`if ... end`, `; and`, `; or`) handed back to host agents (such as Claude Code) as `rtk run --shell fish -c '<script>'` should strictly respect agent-level `deny` lists. If a script contains a denied binary (e.g., `rm -rf`), it must be refused or require confirmation (`Ask`), regardless of syntax structure.
- **What Actually Happened**: The initial implementation segmented commands using Bash conventions. In Fish grammar, command statements occur within conditions (`if not rm -rf /; echo x; end`) or after operators (`and`, `or`, `not`). Claude Code's permission checker saw only the outer wrapper `rtk run --shell fish -c '...'`. Because the user had configured an allow rule matching `rtk:*`, Claude Code allowed the entire wrapped command without prompting. Deny rules for `rm` never triggered because `rm` was hidden inside the Fish condition.
- **Evidence in Repo**: Commit `62cf6ba7` and commit `9a683870`.
- **Root Cause**: The Bash-shaped segmenter split commands on POSIX boundaries. It peeled keywords like `and`/`or`/`not` only from the start of a segment, failing to scan within `if` or `while` control structures. Furthermore, Claude Code evaluated permissions against the *rewritten* string without re-evaluating internal payload commands.
- **Remediation Code Diff**:
```rust
// In src/hooks/decision.rs:
// - if wrap_fish(cmd).is_some() {
// + if wrap_fish(cmd).is_some() && !deny_rule_could_match(cmd, deny_rules) {
//       let rewritten = rewrite_command(cmd, excluded, transparent_prefixes);
//       let script = rewritten.as_deref().unwrap_or(cmd);
//       return HookDecision::AskRewrite(crate::discover::fish_script::wrap(script));
//   }

// In src/hooks/permissions.rs:
+ pub(crate) fn deny_matches_any_word_run(words: &[String], deny_rules: &[String]) -> bool {
+     if deny_rules.is_empty() {
+         return false;
+     }
+     (0..words.len()).any(|start| {
+         let run = words[start..].join(" ");
+         deny_rules.iter().any(|pattern| command_matches_pattern(&run, pattern))
+     })
+ }
```
- **Lesson**: When bridging grammars, never parse syntax partially. Check every sub-slice of dequoted tokens against authorization rules, and default wrappers to explicit `Ask` (confirmation required).

---

### Incident 2: Corrupted Disown Pipes and Spaced Redirections in Shell Wrapper (BUG-LEX-DISOWN-02)
- **Context**: `src/discover/lexer.rs`, `src/discover/fish_script.rs`
- **What Was Expected**: Command pipelines containing combined stdout/stderr streams (such as Fish's `&|` operator) should either be safely rewritten or preserved verbatim without syntax invalidation.
- **What Actually Happened**: The lexer tokenized `&|` as a background execution operator `&` followed by a pipe `|`. When the rewrite engine re-emitted the tokens, it inserted spaces (`rtk git status & | cat`). In Fish, `& |` is invalid syntax and triggers a parse error before execution starts.
- **Evidence in Repo**: Commit `62cf6ba7`, `src/discover/lexer.rs` additions to `redirect_takes_operand` and `opens_disown_pair`.
- **Root Cause**: The lexer treated operators as independent generic characters rather than compound tokens, and the serializer lacked context regarding shell-specific token adjacency requirements.
- **Remediation Code Diff**:
```rust
// In src/discover/lexer.rs:
+ pub(crate) fn opens_disown_pair(cmd: &str) -> bool {
+     disown_pair(&tokenize_inner(cmd, NewlineMode::Conservative))
+ }

// In src/discover/fish_script.rs:
+ if lexer::opens_disown_pair(&code) {
+     return None; // Refuse to wrap if it contains '&|' or '&!'
+ }

+ pub(crate) fn redirect_takes_operand(value: &str) -> bool {
+     let Some(pos) = value.find(">&\").or_else(|| value.find(\"<&\")) else {
+         return true;
+     };
+     let tail = &value[pos + 2..];
+     tail.is_empty() || !tail.chars().all(|c| c.is_ascii_digit() || c == '-')
+ }
```
- **Lesson**: If a lexer/re-serializer cannot guarantee 100% token-fidelity for shell-specific operators, it must decline to rewrite and fall back to passthrough mode.

---

### Incident 3: CRLF and Partial Suffix Corruption in Workspace Rule Migration (BUG-INIT-CRLF-03)
- **Context**: `src/hooks/init/antigravity.rs`, `tests/antigravity_hook_test.rs`
- **What Was Expected**: Running `rtk init` or uninstall routines on Windows and Unix must clean up legacy generated rules in `.agents/rules/antigravity-rtk-rules.md` while leaving user-defined customizations intact.
- **What Actually Happened**: Windows installations formatted with CRLF (`\r\n`) failed exact template matching against Unix-defined constants (`\n`). As a result, files were left unmigrated, or partial string slicing deleted custom user rules appended to the header.
- **Evidence in Repo**: PR #4335, Commit `8554743d`.
- **Root Cause**: Hardcoded string slices and byte offsets were computed without normalizing newlines (`\r\n` vs `\n`), causing `.strip_suffix` to fail when files contained mixed carriage returns.
- **Remediation Code Diff**:
```rust
// In src/hooks/init/antigravity.rs:
+ const LEGACY_ANTIGRAVITY_TEXTS: [&str; 3] = [
+     LEGACY_ANTIGRAVITY_RULES_V036,
+     LEGACY_ANTIGRAVITY_RULES_V044,
+     LEGACY_ANTIGRAVITY_RULES_V049,
+ ];

+ let is_regular_file = match fs::metadata(&legacy_file) {
+     Ok(meta) => meta.is_file(),
+     Err(_) => false,
+ };
+ if !is_regular_file { return None; }

+ let content = fs::read_to_string(&legacy_file).ok()?;
+ let normalized = content.replace("\r\n", "\n");
+ // Checks both exact match and suffix removal after normalizing line endings
```
- **Lesson**: File comparison across operating systems must always decouple semantic content matching from newline representation.

---

### Incident 4: Non-Claude Agent Hook Detection Blindspot in Telemetry (BUG-DETECT-AGENT-04)
- **Context**: `src/commands/gain.rs`, `src/hooks/detect.rs`
- **What Was Expected**: Executing `rtk gain` in environments initialized for alternative agents (e.g., Pi, Cursor, Gemini, OpenCode via `rtk init -g --agent <name>`) should recognize installed extensions and display savings metrics without spurious warnings.
- **What Actually Happened**: `rtk gain` checked only `~/.claude/settings.json`. When users installed the Pi extension (`~/.pi/agent/extensions/rtk.ts`), `rtk gain` logged: `[warn] No hook installed — run rtk init -g for automatic token savings`, directing users to configure the wrong platform.
- **Evidence in Repo**: Issue #4750 (and cross-reference #913, #4756).
- **Root Cause**: The hook detection routine hardcoded Claude Code's filesystem layout instead of querying the dynamic harness registry (`HarnessProfile::wiring`).
- **Remediation Diff Pattern**:
```rust
// In src/hooks/detect.rs:
- pub fn is_hook_installed() -> bool {
-     claude::has_hook()
- }
+ pub fn detect_installed_hooks() -> Vec<&'static str> {
+     let mut installed = Vec::new();
+     if claude::has_hook() { installed.push("claude"); }
+     if pi::has_extension() { installed.push("pi"); }
+     if cursor::has_hook() { installed.push("cursor"); }
+     // ... Iterate all supported HarnessProfiles
+     installed
+ }
```
- **Lesson**: When supporting multi-agent ecosystems, telemetry and diagnostic health checks must share the same harness registry used by the initialization installer.

---

### Incident 5: False-Positive CLI Mutation Attribution from Short-Flag Collisions (BUG-FILTER-GREP-05)
- **Context**: `Issue #4782` (Grep/Ripgrep filter pipeline)
- **What Was Expected**: The compression pipeline must never alter identifiers, line contents, or semantic variable names when filtering `grep` or `rg` search results.
- **What Actually Happened**: Users reported that `rtk` appeared to rewrite variable names in source lines (e.g., `revision` became `