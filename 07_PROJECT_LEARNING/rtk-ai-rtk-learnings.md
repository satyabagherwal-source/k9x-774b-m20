> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rtk-ai-rtk-learnings.md`  
> **Source**: github ([https://github.com/rtk-ai/rtk](https://github.com/rtk-ai/rtk))  
> **Source Version**: `08a261a0`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-09T00:06:12.242Z  
> **Learning ID**: `learn-github-rtk-ai-rtk`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): rtk-ai/rtk

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 The Domain Problem
`rtk` (Rust Token Killer) resolves the runaway token consumption bottleneck in autonomous coding agent loops (Claude Code, GitHub Copilot CLI, Cursor, Windsurf, Cline, Gemini CLI). Agent loops repeatedly execute shell commands (`git status`, `cargo test`, `cat`, `docker ps`, `grep`, `npm test`) whose raw, verbose terminal output saturates context windows, degrades model reasoning, triggers early context compaction, and escalates API costs.

### 1.2 System Mechanics & Execution Paths
`rtk` functions as a dual-mode interceptor:

```
[Agent Engine / IDE]
       │
       ▼ (Tool Call: PreToolUse Event)
[Hook Interceptor (.claude/hooks/rtk-rewrite.sh OR .github/hooks/rtk-rewrite.json)]
       │
       ├─── Check binary existence (`command -v rtk || exit 0`)
       ▼
[RTK Binary CLI (`rtk <command> <args>`)]
       │
       ├─── 1. Clap Parse Gate
       │        ├─ Success: Typed Operational Command Match
       │        │     └─► Integrity Check (`integrity::runtime_check()`)
       │        │           └─► Specialized Rust Filter Module (e.g., git, test, docker)
       │        │
       │        └─ Fail: Fallback Dispatcher (`run_fallback()`)
       │              ├─ Check Meta Diagnostics (`rtk --help`, `rtk --version`, `rtk init`)
       │              │     └─► Emit Clap error/help immediately (bypass integrity)
       │              ├─ Integrity Check (`integrity::runtime_check()`)
       │              │     └─► Verify SHA-256 hash of legacy hooks before executing untyped tools
       │              ├─ Pipeline Dynamic Tasks / Proxied Agents
       │              ├─ TOML DSL Filter Match (`toml_filter::find_matching_filter()`)
       │              └─ Unmatched Passthrough: `Stdio::inherit`, record 0% token reduction
       │
       ▼
[Compression Engine (`rtk-engine` Pipeline)]
       │
       ├─── Layered Transform Chain (`run_chain_guarded`)
       │        ├─ Panic Containment (`std::panic::catch_unwind`)
       │        ├─ Method 1: `ansi` (Strip ANSI control codes via byte-scan)
       │        ├─ Method 2: `base64-elide` (Identify ≥1024 char base64 blobs, replace with KB tag)
       │        ├─ Method 3: `cap` (Tail-biased truncation: 50 head lines, 200 tail lines)
       │        └─ Method N: Structured reducers
       │
       ▼
[Guard Gate (`never_worse`)]
       ├── Discard if transformed output is identical to input
       ├── Discard if `estimate_tokens(&output) > estimate_tokens(input)`
       └─► Return raw or compressed stdout with provenance stamp
```

### 1.3 Architectural Boundaries and Monorepo Topology
1. **`rtk` (Workspace Root / CLI)**: Licensed under Apache-2.0. Entrypoint binary handling CLI arg parsing via `clap`, terminal I/O, subprocess execution (`resolved_command()`), SQLite metrics tracking via `rusqlite`, and legacy hook verification.
2. **`rtk-engine` (`engine/`)**: BUSL-1.1 licensed pure compression core. Defines domain traits (`Method`, `Directive`), token estimation routines (`estimate_tokens`), panic-safe method chains (`run_chain`), and marker stamping (`[rtk:<method> X→Y tokens]`).
3. **`rtk-text` (`text/`)**: Text-processing primitives (zero-alloc ANSI stripping, indentation detection, line slicing).
4. **`proxy/` (Standalone Daemon)**: Out-of-workspace package running an HTTP proxy (via `axum` and `tokio`) that intercepts LLM upstream requests to inject prompt directives and compress history blocks. Pinned to identical SQLite library symbols (`links = "sqlite3"`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Pre-Execution Agent Interceptor Fail-Open Rule
**RULE**:
Any pre-tool hook, interceptor, or shell wrapper installed into an AI agent sandbox MUST evaluate to a no-op success (`exit 0` with empty standard output) whenever the underlying optimization binary is uninstalled, unresolvable on `$PATH`, or failing pre-flight environment checks. It MUST NEVER exit non-zero or emit diagnostic error strings on `stdout`/`stderr` when dormant.

**WHY**:
AI agent orchestration engines (e.g., GitHub Copilot, Claude Code) treat any non-zero exit code or malformed output from a `PreToolUse` hook as a critical permission denial or fatal infrastructure crash. If a repository ships a checked-in hook config that calls a specialized binary (`rtk hook`), opening that repository in a clean environment (cloud sandbox, coworker machine without tooling installed, fresh CI runner) completely locks the agent out from executing basic terminal tools (e.g., `git status`, `ls`).

**WHEN TO APPLY**:
Apply to all client-side tool interceptors, Git pre-commit/pre-push hooks, LSP wrappers, Claude Code hooks (`.claude/hooks`), Copilot agent hooks (`.github/hooks`), and IDE terminal interception shims.

**VERIFIED IMPLEMENTATION PATTERN**:
```json
{
  "version": 1,
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "bash": "command -v rtk >/dev/null 2>&1 || exit 0; exec rtk hook copilot",
        "powershell": "if (Get-Command rtk -ErrorAction SilentlyContinue) { rtk hook copilot }",
        "cwd": ".",
        "timeoutSec": 5
      }
    ]
  }
}
```

```rust
// tests/hook_fail_open_test.rs
use std::process::{Command, Stdio};
use std::io::Write;

#[test]
fn test_hook_fails_open_when_binary_absent() {
    let empty_dir = tempfile::tempdir().unwrap();
    
    // Simulate isolated execution without the binary on PATH
    let mut cmd = Command::new("/bin/sh");
    cmd.env_clear()
       .env("PATH", empty_dir.path())
       .args(["-c", "command -v rtk >/dev/null 2>&1 || exit 0; exec rtk hook copilot"])
       .stdin(Stdio::piped())
       .stdout(Stdio::piped())
       .stderr(Stdio::piped());

    let mut child = cmd.spawn().expect("failed to spawn hook");
    child.stdin.take().unwrap()
        .write_all(b"{\"tool_name\":\"run_in_terminal\",\"tool_input\":{\"command\":\"ls\"}}")
        .unwrap();

    let output = child.wait_with_output().expect("hook failed");
    assert!(output.status.success(), "Hook exited non-zero: {:?}", output.status.code());
    assert!(output.stdout.is_empty(), "Hook emitted stdout on missing binary");
    assert!(output.stderr.is_empty(), "Hook emitted stderr on missing binary");
}
```

**NEGATIVE CONSTRAINT**:
```json
// ANTI-PATTERN: Direct invocation without existence check or fallback
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        // FAILS: Returns 127 in environments without rtk; blocks tool execution completely
        "command": "rtk hook" 
      }
    ]
  }
}
```

**VERIFICATION METHOD**:
Run an automated integration test executing the hook payload inside a stripped container or subshell with an empty `PATH=""`. Assert that exit code is `0` and both standard output and standard error streams are strictly zero bytes.

---

### 2. Monotonic Token Shrinkage Invariant (`never_worse`)
**RULE**:
Every transformation method, pipeline filter, or prompt compressor operating on LLM context inputs MUST enforce a strict monotonic token reduction invariant: if `estimate_tokens(output) >= estimate_tokens(input)` OR `output == input`, the transformation pipeline MUST discard the output and yield `None` (falling back to the raw, unmutated input string).

**WHY**:
Compression heuristics, summarization layers, and elision patterns can introduce format wrappers, elision banners (e.g., `[base64 data, 10 KB elided]`, `[50 lines elided]`), or escaped entities that expand the total token footprint on short inputs or high-entropy outputs. Passing expanded text to an LLM directly defeats the utility of the optimizer and incurs higher billing.

**WHEN TO APPLY**:
Apply to all context filtering engines, AST reducers, JSON minifiers, regex eliders, prompt optimizers, and LLM output normalizers.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
/// Enforces that transformed text is strictly shorter in token count than input
/// and represents an actual delta.
pub fn never_worse(input: &str, output: String) -> Option<String> {
    if output == input {
        return None;
    }
    // Reject transformations that expand token length or fail to beat original
    if estimate_tokens(&output) >= estimate_tokens(input) {
        return None;
    }
    Some(output)
}

/// Executes a sequence of transformation methods with full panic containment
/// and monotonic reduction guarantees.
pub fn run_chain_guarded(
    methods: &[&dyn Method],
    block: &Block,
    ctx: &MethodCtx,
) -> Option<String> {
    // 1. Contain panics to prevent crashing host process
    let transformed = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let mut current = block.text.to_string();
        for method in methods {
            let step = Block { text: &current, ..*block };
            match method.apply(&step, ctx) {
                Outcome::Continue(next) => current = next,
                Outcome::ShortCircuit(final_text) => return Some(final_text),
                Outcome::Skip => {}
            }
        }
        Some(current)
    })).ok().flatten()?;

    // 2. Reject growth and zero-delta results
    never_worse(block.text, transformed)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blindly returning transformed output without size comparison
pub fn run_unsafe_pipeline(methods: &[Box<dyn Method>], input: &str) -> String {
    let mut out = input.to_string();
    for m in methods {
        // HAZARD: Marker insertion on short inputs expands tokens;
        // e.g. "short line" -> "short line [+0 chars]" (+2 tokens)
        out = m.transform(&out); 
    }
    out
}
```

**VERIFICATION METHOD**:
Implement property-based tests (via `proptest` or `quickcheck`) feeding arbitrary ASCII/Unicode strings of varying lengths (0 to 100,000 bytes) into `run_chain_guarded`. Assert that for any produced `Some(res)`, `estimate_tokens(&res) < estimate_tokens(input)`.

---

### 3. Path-Anchored Subprocess Tokenization Gate Rule
**RULE**:
When matching command names or program invocations against exclusion lists, security rules, or routing switches, the matching engine MUST parse and match against the final terminal component of any path string (split across POSIX `/` and Windows `\`), anchored to word boundaries (`\b` or whitespace). It MUST NOT match solely against the start of the raw token.

**WHY**:
Tool callers, agents, and shell scripts routinely invoke commands via explicit relative or absolute paths (e.g., `/usr/bin/git`, `./bin/docker`, `C:\tools\terraform.exe`). If an interceptor only checks `excluded.contains(token)`, invocations with path prefixes bypass exclusion filters, resulting in unintended command swapping, execution of wrong binaries, or privilege boundary violations.

**WHEN TO APPLY**:
Apply to command routers, CLI proxies, container security filters, hook dispatchers, and privilege escalation scanners.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
/// Extracts the base binary name from a command word, stripping path qualifiers.
pub fn extract_binary_name(cmd_word: &str) -> &str {
    let normalized = cmd_word.trim();
    // Split on either POSIX or Windows directory separators
    normalized
        .rsplit(|c| c == '/' || c == '\\')
        .next()
        .unwrap_or(normalized)
}

/// Checks whether an invocation should be excluded based on command name.
pub fn is_command_excluded(argv0: &str, exclude_list: &[&str]) -> bool {
    let binary = extract_binary_name(argv0);
    // Exact match on base program name (ignoring path prefixes)
    exclude_list.iter().any(|&excluded| excluded == binary)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_matching_invariants() {
        let excluded = ["git", "ssh", "sudo"];
        
        // Positive exclusions
        assert!(is_command_excluded("git", &excluded));
        assert!(is_command_excluded("/usr/bin/git", &excluded));
        assert!(is_command_excluded("./bin/git", &excluded));
        assert!(is_command_excluded(r"C:\Program Files\Git\bin\git.exe", &["git.exe"]));

        // Negative exclusions (must not overmatch)
        assert!(!is_command_excluded("/usr/bin/git-crypt", &excluded));
        assert!(!is_command_excluded("tools/git_helper.py", &excluded));
        assert!(!is_command_excluded("curlie", &["curl"]));
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Prefix or whole-string match without path normalization
pub fn is_command_excluded_bad(cmd: &str, exclude_list: &[&str]) -> bool {
    // FAILS: Matches "git status" but completely misses "/usr/bin/git status"
    exclude_list.iter().any(|&name| cmd.starts_with(name))
}
```

**VERIFICATION METHOD**:
Construct test cases with matrix `["{bin}", "/usr/bin/{bin}", "./bin/{bin}", "../{bin}"]` versus near-miss targets `["{bin}-tool", "{bin}_run.sh"]`. Verify that excluded binaries trigger `true` while near misses trigger `false`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Copilot Cloud Agent Denial of Service on Missing Binary (BUG-COPILOT-HOOK-01)
- **Context**: Repository root GitHub hook configuration (`.github/hooks/rtk-rewrite.json`), tested via `tests/copilot_repo_hook_test.rs`.
- **What Was Expected**: When a contributor opens the repository in GitHub Copilot or a cloud development container where `rtk` is not yet installed on `$PATH`, the tool call interceptor must pass through raw tool calls silently and exit with status `0`.
- **What Actually Happened**: The hook config ran `"command": "rtk hook"`. Because `rtk` was absent, the shell returned exit code `127` (command not found). If `rtk` was present, `rtk hook` without subcommands returned exit code `2` (Clap parse error). GitHub Copilot treats any non-zero exit from `PreToolUse` as a terminal rejection, causing all agent terminal tool calls to be denied.
- **Evidence in Repo**: Commit `fc2d2a8c`, PR `#5035`.
- **Root Cause**: Hook configuration lacked fallback shell logic and specified an invalid subcommand invocation (`rtk hook` instead of `rtk hook copilot`).
- **Remediation Code Diff**:
```diff
--- a/.github/hooks/rtk-rewrite.json
+++ b/.github/hooks/rtk-rewrite.json
@@ -1,11 +1,13 @@
 {
+  "version": 1,
   "hooks": {
     "PreToolUse": [
       {
         "type": "command",
-        "command": "rtk hook",
+        "bash": "command -v rtk >/dev/null 2>&1 || exit 0; exec rtk hook copilot",
+        "powershell": "if (Get-Command rtk -ErrorAction SilentlyContinue) { rtk hook copilot }",
         "cwd": ".",
-        "timeout": 5
+        "timeoutSec": 5
       }
     ]
   }
```
- **Lesson**: Agent hooks must implement defensive shell existence guards (`command -v || exit 0`) and supply both Bash and PowerShell invocations with native parameter keys (`timeoutSec`).

---

### Incident 2: Security Integrity Bypass in Fallback Execution Path (BUG-HOOK-INTEG-02)
- **Context**: Fallback CLI argument router in `src/lib.rs` and runtime hook validator in `src/hooks/integrity.rs`.
- **What Was Expected**: Any invocation falling back from Clap (such as unknown commands, pass-through commands, or TOML DSL dynamic filters) must undergo SHA-256 integrity verification against `.rtk-hook.sha256` before executing child processes.
- **What Actually Happened**: `is_operational_command()` only checked typed subcommands. When Clap failed to match a subcommand (or when a typed command received arguments Clap rejected), execution branched to `run_fallback()`. Untyped tools, agents, and TOML filters were dispatched immediately without checking whether the hook script had been tampered with or modified.
- **Evidence in Repo**: Commit `76002855`, PR `#4713`, `tests/fallback_integrity_test.rs`.
- **Root Cause**: Architectural separation between typed command dispatch and fallback dispatch created an asymmetric security hole where unknown or fallback commands bypassed `integrity::runtime_check()`.
- **Remediation Code Diff**:
```diff
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -1932,21 +1932,9 @@ fn run_fallback(parse_error: clap::Error) -> Result<i32> {
         parse_error.exit();
     }
 
-    // Scoped to `test` alone: `--shell` is a flag other tools carry too...
-    if args[0] == "test" && args.iter().any(|arg| arg == "--shell" || arg.starts_with("--shell=")) {
-        parse_error.exit();
-    }
+    // Fallbacks execute tools too, including TOML filters and typed commands
+    // whose native arguments clap rejects. Keep meta diagnostics above the gate.
+    hooks::integrity::runtime_check()?;
 
     // Dynamic task subcommands: `rtk bulk-read ...` resolves from
     // the active pipeline before anything falls back to raw execution.
```
```diff
--- a/src/hooks/integrity.rs
+++ b/src/hooks/integrity.rs
@@ -319,7 +320,16 @@ pub fn runtime_check() -> Result<()> {
-    let hook_path = resolve_hook_path()?;
+    runtime_check_in(resolve_hook_path())
+}
+
+fn runtime_check_in(hook_path: Result<PathBuf>) -> Result<()> {
+    // Directory resolution only fails when neither an explicit Claude directory
+    // nor a home directory is available. There is no legacy hook to locate then.
+    // Keep verification/read errors below this point fatal.
+    let Ok(hook_path) = hook_path else {
+        return Ok(());
+    };
```
- **Lesson**: Security verification gates must sit in front of the generalized fallback dispatcher, placed immediately after meta-diagnostic error handling (`--help`, `--version`).

---

### Incident 3: Command Swap Bypass via Absolute and Relative Paths (BUG-SWAP-BYPASS-03)
- **Context**: Command-swapping gate mechanism in `src/hooks/swap.rs` and CLI filters.
- **What Was Expected**: If a command is listed in `exclude_commands` (e.g., `git`), executing that command via an absolute path (e.g., `/usr/bin/git log`) must be respected and excluded from tool swapping.
- **What Actually Happened**: The exclusion matching logic checked `exclude_commands` against words anchored strictly at word start (`^name($|\s)`). When an agent executed `/usr/bin/git`, the string did not match `"git"`, causing the tool to be swapped into a worker digest instead of returning git's actual output.
- **Evidence in Repo**: Issue `#5019`, closed on `2026-11-06`.
- **Root Cause**: String regex lacked path-delimiter matching; it did not split or anchor to the character following `/` or `\`.
- **Remediation Code Diff**:
```diff
// Logic fix applied to swap gate regex/matcher:
- let pattern = format!(r"^{}($|\s)", regex::escape(cmd));
+ let pattern = format!(r"(?:^|/){}($|\s)", regex::escape(cmd));
```
- **Lesson**: Never compare raw CLI tokens directly against binary whitelists/blacklists without stripping path delimiters.

---

### Incident 4: JSON Corruption via False-Positive Base64 Elision (BUG-BASE64-CORRUPT-04)
- **Context**: Content compression filter in `engine/src/methods/base64_elide.rs`.
- **What Was Expected**: The `base64-elide` filter should only replace long base64 blobs (e.g., embedded images, fonts) with `[base64 <type>, <size> KB elided]` and leave all standard JSON values and numbers intact.
- **What Actually Happened**: Long numeric literals (e.g., 1300 digits of `1`) or repeating hex strings (e.g., `deadbeef` dumps) matched the base64 character class `[A-Za-z0-9+/]{1024,}`. Replacing an unquoted JSON numeric literal with `[base64 ...]` produced invalid JSON syntax, causing downstream JSON parsers to abort.
- **Evidence in Repo**: Commit regression test `a_long_bare_number_is_not_mistaken_for_base64` and `repeated_hex_is_not_elided` in `base64_elide.rs`.
- **Root Cause**: Regex matched any string satisfying character class length ≥ 1024 without verifying base64 structural invariants (length multiple of 4, character entropy across uppercase, lowercase, and digits).
- **Remediation Code Diff**:
```diff
--- a/engine/src/methods/base64_elide.rs
+++ b/engine/src/methods/base64_elide.rs
@@ -41,6 +41,9 @@ impl Method for Base64Elide {
         let out = BASE64_RUN.replace_all(input, |caps: &regex::Captures| {
             let whole = caps.get(0).map(|m| m.as_str()).unwrap_or("");
             let run = caps.get(2).map(|m| m.as_str()).unwrap_or("");
+            if !looks_like_base64(run) {
+                return whole.to_string();
+            }
             let decoded_kb = (run.len() * 3 / 4) as f64 / 1024.0;
             let kind = caps.get(1).map(|m| m.as_str()).unwrap_or("data");
@@ -53,3 +56,18 @@ impl Method for Base64Elide {
+fn looks_like_base64(run: &str) -> bool {
+    let body = run.trim_end_matches('=');
+    if body.is_empty() || !run.len().is_multiple_of(4) {
+        return false;
+    }
+    let (mut upper, mut lower, mut digit) = (false, false, false);
+    for c in body.bytes() {
+        match c {
+            b'A'..=b'Z' => upper = true,
+            b'a'..=b'z' => lower = true,
+            b'0'..=b'9' => digit = true,
+            _ => {}
+        }
+    }
+    upper && lower && digit
+}
```
- **Lesson**: Regex matches against character subsets must be validated against format-specific entropy and structural properties before triggering destructive mutations.

---

### Incident 5: Ratatui 0.30 Dependency Diamond Lock Failure (BUG-DEP-DIAMOND-05)
- **Context**: Workspace dependency definitions in `Cargo.toml` and `Cargo.lock`.
- **What Was Expected**: Upgrading terminal dashboard dependency `ratatui` from `0.29.0` to `0.30.2` for the `rtk gain --watch` subcommand must not break native link symbols or introduce dual-version crate conflicts.
- **What Actually Happened**: `crossterm` and `bitflags` transitive versions drifted (`bitflags 1.3.2` vs `bitflags 2.13.2`), and `rusqlite` dependencies conflicted with the out-of-workspace `proxy/` daemon package declaring identical `links = "sqlite3"`.
- **Evidence in Repo**: Commit `ce485f1d`, PR `#4993`.
- **Root Cause**: The workspace maintains an intentional decoupling between the CLI and `proxy/`, requiring manual symbol coordination for native C-bindings like `libsqlite3-sys`.
- **Remediation Code Diff**:
```diff
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -86,7 +86,7 @@ which = "8"
 # `rtk gain --watch`: a live full-screen dashboard over the same two SQLite
 # sources the static view reads (core::tracking + the llm-proxy's own DB).
 # Opt-in, not on the hot startup path -- doesn't affect the <10ms budget.
-ratatui = "0.29"
+ratatui = "0.30"
 crossterm = "0.29"
```
- **Lesson**: When sharing native C-binding crates across workspace boundaries, lock version numbers explicitly and pin all transitive dependency flags.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **Integer Multiple Checking**:
   In Rust, checking if an integer `n` is a multiple of `4` should be performed using standard arithmetic or dedicated methods. In Rust 2024 / newer editions, `run.len().is_multiple_of(4)` replaces `run.len() % 4 == 0` for clarity and boundary checking.
2. **Byte Iteration vs. Character Iteration**:
   When scanning for ASCII ranges (`b'A'..=b'Z'`), iterate over `.bytes()` rather than `.chars()`. `.chars()` incurs UTF-8 decoding overhead across every code point.
   ```rust
   // SAFE & FAST: Zero-cost ASCII classification
   for c in body.bytes() {
       match c {
           b'A'..=b'Z' => upper = true,
           b'a'..=b'z' => lower = true,
           b'0'..=b'9' => digit = true,
           _ => {}
       }
   }
   ```
3. **Escaped Bracket Grammar**:
   When generating metadata stamps inside agent context (`Stamp::render`), delimiters must never match raw markdown links or nested brackets that confuse agent parsers:
   ```rust
   // Stamped output format invariant:
   // [rtk:<method> <before>→<after> tokens · <hint>]
   format!("[rtk:{} {}→{} tokens · {}]", self.method, self.tokens_before, self.tokens_after, hint)
   ```

### 4.2 Infinite Loop & Recursion Guards
1. **Terminal Slicing Invariant in `Cap`**:
   Terminal output bounding must avoid recursive slicing or unbounded allocations when handling degenerate inputs (e.g., 500,000 blank lines or a single 10MB line without newlines).
   ```rust
   // TAIL-BIASED LINE WINDOWING:
   let needs_line_cap = input.lines().any(|l| l.chars().count() > MAX_LINE_CHARS);
   let total = input.lines().count();
   let needs_window = total > MAX_LINES;

   if needs_window {
       let lines: Vec<&str> = input.lines().collect();
       let elided = total - HEAD_LINES - TAIL_LINES;
       let mut result: Vec<String> = Vec::with_capacity(HEAD_LINES + TAIL_LINES + 1);
       result.extend(lines[..HEAD_LINES].iter().map(|l| cap_line(l)));
       result.push(format!("[{elided} lines elided]"));
       result.extend(lines[total - TAIL_LINES..].iter().map(|l| cap_line(l)));
       result.join("\n")
   }
   ```
2. **Panic Containment Boundary**:
   Method pipelines dynamically execute untrusted or complex regex transformers. If a transform panics, it must not take down the interceptor process:
   ```rust
   pub fn run_chain_caught(methods: &[&dyn Method], block: &Block, ctx: &MethodCtx) -> Option<String> {
       std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
           run_chain(methods, block, ctx)
       }))
       .ok()
   }
   ```

### 4.3 UI & UX Micro-Mechanics (CLI Terminal & Dashboards)
1. **Head-vs-Tail Error Retention**:
   In compiler, test, and shell executions (`cargo test`, `pytest`, `npm run build`), diagnostic stack traces and failure summaries are emitted at the *end* of the stdout stream. Head-biased truncators (standard `head -n`) discard the exact failure information the LLM needs to repair the code. `rtk` fixes this UX failure by enforcing `HEAD_LINES = 50` and `TAIL_LINES = 200`.
2. **Terminal ANSI Stripping without UTF-8 Destruction**:
   Stripping escape sequences must only remove terminal control bytes (`\x1b[...]`) without corrupting multi-byte UTF-8 sequences in user code or error messages.

### 4.4 Backend Concurrency & Memory Safety
1. **Pre-Tool Lockout Prevention via Environment Isolation**:
   When launching child processes to verify hooks or execute tools, `Command::new()` must isolate the execution context to prevent environment contamination across tests or parallel runs:
   ```rust
   let mut cmd = Command::new("/bin/sh");
   cmd.env_clear()
      .env("PATH", path)
      .stdin(Stdio::piped())
      .stdout(Stdio::piped())
      .stderr(Stdio::piped());
   ```
2. **Safe SQLite Workspace Coexistence**:
   The `icm-store` and `rusqlite` crates must be locked to version `0.34` with `features = ["bundled"]`. Bundling SQLite compiles the C library statically into each binary target, preventing runtime symbol collisions or dynamic linker panics when multiple CLI instances run concurrently.

### 4.5 Defect & Error Prevention ("Galti Pakadna")
1. **Missing Claude Config Directory Trap**:
   In containerized or bare CI environments, neither `~/.claude` nor `$HOME` may be defined or writable. Hook integrity verification must not crash the entire toolchain if the directory simply does not exist:
   ```rust
   let Ok(hook_path) = hook_path else {
       // Silent continue: no legacy hook directory exists to verify
       return Ok(());
   };
   ```
2. **Preserving Meta Diagnostics**:
   Integrity verification and dynamic tool resolution must never preempt CLI root flags (`--help`, `--version`). If a user runs `rtk --help`, parsing must return the help text with exit code `0` even if hook integrity files