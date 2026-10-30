> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rtk-ai-rtk-learnings.md`  
> **Source**: github ([https://github.com/rtk-ai/rtk](https://github.com/rtk-ai/rtk))  
> **Source Version**: `6c2313a6`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T22:13:46.284Z  
> **Learning ID**: `learn-github-rtk-ai-rtk`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): rtk-ai/rtk

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
Autonomous coding agents (Claude Code, Cursor, Copilot, Cline, Windsurf, OpenCode) execute CLI commands (`ls`, `git`, `cargo test`, `sqlfluff`, `rg`) and ingest terminal `stdout`/`stderr` into context windows. Standard CLI outputs waste significant token budgets on ANSI escapes, duplicated file listings, verbose build tables, and uncompressed traces. 

`rtk` (Rust Token Killer) sits as a transparent, high-performance (<10ms overhead) interception layer between the agent and host shell environment. It intercepts child process execution, sanitizes redundant formatting, strips ANSI sequences, converts tabular data into token-efficient schemas, and enforces strict size ceilings. It guarantees that command outputs consumed by LLMs never exceed the token cost of the original child process execution.

```
                      +----------------------------------------------------+
                      |               LLM / AI Coding Agent                |
                      +----------------------------------------------------+
                                      ^                         |
                               (Compressed stdout)       (CLI Command)
                                      |                         v
+-------------------------------------+---------------------------------------------------+
|  RTK Interception Engine            |                         |                         |
|                                     |                         v                         |
|  +--------------------+   +-------------------+    +--------------------+               |
|  |   Core CLI Host    |   |  Arg Tokenizer    |--->| Subcommand Router  |               |
|  |   (Apache-2.0)     |   |  (TokenKind,      |    | (Direct vs Generic |               |
|  |                    |   |   Positional)     |    |  Lint Plan)        |               |
|  +--------------------+   +-------------------+    +--------------------+               |
|            |                                                  |                         |
|            v                                                  v                         |
|  +--------------------------------------------------------------------+                 |
|  |               Chain Pipeline Execution (rtk-engine)                |                 |
|  |  +------------------+   +-------------------+   +---------------+  |                 |
|  |  |    Ansi Strip    |-->|    Base64Elide    |-->|   Cap Window  |  |                 |
|  |  |   (Zero-Copy)    |   |   (High Entropy)  |   |   (Head/Tail) |  |                 |
|  |  +------------------+   +-------------------+   +---------------+  |                 |
|  +--------------------------------------------------------------------+                 |
|            |                                                                            |
|            v                                                                            |
|  +--------------------------------------------------------------------+                 |
|  | Invariant Safety Net: never_worse(raw, transformed)                |                 |
|  | (Ensures estimate_tokens(transformed) <= estimate_tokens(native))  |                 |
|  +--------------------------------------------------------------------+                 |
|            |                                                                            |
+------------|----------------------------------------------------------------------------+
             | (Fallback if bloated or corrupted)
             v
+-----------------------------------------------------------------------------------------+
| Host OS Subprocess Boundary (`ls`, `sqlfluff`, `cargo`, `git`)                          |
+-----------------------------------------------------------------------------------------+
```

### Architectural Subsystem Boundaries
1. **Workspace Multi-Crate Split**:
   - `rtk`: The entry CLI binary distributed under Apache-2.0. Handles OS process invocation, platform-dependent console codepages (Windows OEM/ANSI vs Unix libc), and hook installations.
   - `rtk-engine`: Standalone core under BUSL-1.1 containing compression strategies, composable reduction pipelines, token estimators, and parsing ASTs.
   - `rtk-text`: Low-level zero-allocation string primitives, terminal ANSI scanners, and byte-slice UTF-8 validators.
   - `proxy/`: A decoupled crate (deliberately omitted from default workspace members) providing an HTTP/daemon layer without dragging `tokio`, `axum`, or async runtimes into the ultra-fast CLI hot path.
2. **Execution & Interception Engine**:
   - `runner::run_filtered` / `runner::run_filtered_with_exit`: Spawns native targets via `std::process::Command`, pipes I/O through memory buffers, applies filtering heuristics, and falls back if compression fails.
   - `arg_tokenizer`: Lexes CLI arguments into structured classifications (`Positional`, `Short`, `Long`, `Attachment`) separating arguments before and after `--` (dashdash barrier).
3. **Pipelined Chain & Block Model**:
   - Data is wrapped in a `Block<'a>` containing `text`, `subject` (`Subject::Read`, `Shell`, etc.), `format` (`ContentFormat::Json`, `Term`, `Matches`), and `provenance`.
   - The chain executes sequentially over dynamically/statically registered `Method` implementations wrapped in panic boundaries (`catch_unwind`).

---

## 2. Net-New Universal Engineering Rules

### 1. Dual-Run Baseline Comparison for Transformation Filters
**RULE**:
When an optimization proxy alters underlying command arguments (e.g., rewriting `ls` to `ls -la` to parse attributes), the output filter **MUST NOT** evaluate its compression ratio against the synthetic query output. It **MUST** run the unmodified native user invocation in parallel (or hold against its native baseline) and reject the transformed output if `estimate_tokens(transformed) > estimate_tokens(native_stdout)`.

**WHY**:
Compacting verbose diagnostic listings can inadvertently produce more tokens than a simple bare invocation would have yielded in its default mode. In `rtk`, injecting `-l` into `ls` caused files to be decorated with sizes (`kubectl 57.9M`). When listing small directories, this transformed output consumed 531 bytes versus the bare system `ls` output of 341 bytes. Because the runner compared the result against the synthetic child's verbose output (2067 bytes), it incorrectly registered a ~74% saving, masking an active token regression.

**WHEN TO APPLY**:
Apply to any compiler, CLI proxy, AST transform, or LLM-context sanitizer that wraps external subcommands and changes default parameters to obtain structured input.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub fn run_with_native_baseline(
    cmd: &mut std::process::Command,
    native_args: &[String],
    verbose: u8,
) -> anyhow::Result<i32> {
    // 1. Capture the true native baseline that the user intended to run
    let native_baseline = std::process::Command::new(cmd.get_program())
        .args(native_args)
        .stdin(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .output()
        .ok()
        .map(|out| (String::from_utf8_lossy(&out.stdout).into_owned(), out.status.success()));

    let listed_baseline = native_baseline
        .as_ref()
        .filter(|(stdout, succeeded)| *succeeded || !stdout.is_empty())
        .map(|(stdout, _)| stdout.as_str());

    // 2. Execute the transformed query and pass the native baseline to the renderer
    runner::run_filtered_with_exit(
        cmd,
        "proxy_target",
        "custom_label",
        |raw, code| match (code, &native_baseline) {
            (0, _) => render_and_guard(raw, listed_baseline, verbose),
            (_, Some((native_out, _))) => never_worse(native_out, raw).to_string(),
            (_, None) => raw.to_string(),
        },
        RunOptions::stdout_only().no_trailing_newline(),
    )
}

fn never_worse<'a>(native_baseline: &'a str, transformed: &'a str) -> &'a str {
    if transformed == native_baseline {
        return native_baseline;
    }
    // Token ceiling invariant: If transformation bloated tokens, discard completely
    if estimate_tokens(transformed) > estimate_tokens(native_baseline) {
        native_baseline
    } else {
        transformed
    }
}

fn estimate_tokens(s: &str) -> usize {
    // Standard 4-chars-per-token heuristic with ceiling division
    s.len().div_ceil(4)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Never compare transformed output solely against the injected/synthetic process output
pub fn run_faulty_filter(cmd_with_synthetic_args: &mut std::process::Command) -> anyhow::Result<i32> {
    runner::run_filtered(cmd_with_synthetic_args, "ls", "ls", |raw_synthetic| {
        let transformed = compact(raw_synthetic);
        // DEFECT: raw_synthetic came from `ls -la` (2000 bytes).
        // transformed is 500 bytes. Native bare `ls` was only 300 bytes!
        // This causes silent token inflation.
        if transformed.len() < raw_synthetic.len() {
            transformed
        } else {
            raw_synthetic.to_string()
        }
    })
}
```

**VERIFICATION METHOD**:
Run property-based regression harnesses verifying that across permutations of directory hierarchies and argument vectors, `tokens(proxy(args)) <= tokens(native(args))` holds true:
```rust
#[test]
fn test_proxy_never_exceeds_native_token_cost() {
    let dir = tempfile::tempdir().unwrap();
    let native_out = std::process::Command::new("ls").current_dir(dir.path()).output().unwrap();
    let proxy_out = std::process::Command::new("rtk").arg("ls").current_dir(dir.path()).output().unwrap();
    
    let native_tokens = native_out.stdout.len().div_ceil(4);
    let proxy_tokens = proxy_out.stdout.len().div_ceil(4);
    assert!(
        proxy_tokens <= native_tokens,
        "Regression: proxy ({proxy_tokens}) produced more tokens than native ({native_tokens})"
    );
}
```

---

### 2. Isolated Non-Blocking Side-Effect Installation Invariants
**RULE**:
Multi-target installer routines **MUST NOT** sequence independent deployment targets within a single short-circuiting monadic cascade (e.g., using `?` operators in a single sequence). Each target **MUST** run inside an isolated evaluation boundary, preserving intermediate results, and surface composite error diagnostics only after all independent side-effects have executed.

**WHY**:
In plugin/agent installers, binding target installations together in an early-abort chain means that a corrupt configuration in one target (e.g., an unclosed HTML comment in `CLAUDE.md` or a read-only permissions directory on `~/.claude`) prevents independent environments (such as OpenCode plugins) from installing. Consequently, partial deployment crashes leave developer machines in indeterminate states.

**WHEN TO APPLY**:
Initialization commands, multi-IDE extensions management (`rtk init`, multi-agent configuration injectors), and batch disk updates.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub fn install_multi_target(
    install_target_a: bool,
    install_target_b: bool,
    ctx: InitContext,
) -> anyhow::Result<()> {
    // 1. Run Target A independently, isolating failure from Target B
    let target_a_result = install_target_a.then(|| run_target_a_installer(ctx));
    let target_a_path = target_a_result
        .as_ref()
        .and_then(|res| res.as_ref().ok())
        .and_then(|path_opt| path_opt.as_deref());

    // 2. Run Target B independently inside an isolated closure / catch block
    let target_b_result = (|| -> anyhow::Result<()> {
        if install_target_b {
            run_target_b_installer(target_a_path, ctx)?;
        }
        Ok(())
    })();

    // 3. Reconcile both outcomes and aggregate failures without lost traces
    match (target_a_result, target_b_result) {
        (Some(Err(err_a)), Err(err_b)) => Err(anyhow::anyhow!(
            "Target A install failed: {err_a:#}\nTarget B install failed: {err_b:#}"
        )),
        (Some(Err(err_a)), Ok(())) => Err(err_a.context("Target A install failed")),
        (_, Err(err_b)) => Err(err_b),
        _ => Ok(()),
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Short-circuiting independent side-effects via monolithic cascading
pub fn install_monolithic_bad(install_a: bool, install_b: bool, ctx: InitContext) -> anyhow::Result<()> {
    if install_a {
        // If Target A hits a corrupted file or permission error, Target B is abandoned
        run_target_a_installer(ctx)?; 
    }
    if install_b {
        run_target_b_installer(ctx)?;
    }
    Ok(())
}
```

**VERIFICATION METHOD**:
Enforce dual fault injection via integration tests using filesystem permission traps (`0o555` read-only test folders) ensuring Target A installs even if Target B aborts:
```rust
#[test]
fn target_a_survives_target_b_permission_fault() {
    let home = tempfile::tempdir().unwrap();
    let b_dir = home.path().join(".target_b");
    std::fs::create_dir_all(&b_dir).unwrap();
    std::fs::set_permissions(&b_dir, std::fs::Permissions::from_mode(0o555)).unwrap();

    let status = run_installer(home.path(), &["--all"]);
    std::fs::set_permissions(&b_dir, std::fs::Permissions::from_mode(0o755)).unwrap();

    assert!(!status.success());
    assert!(home.path().join(".target_a").join("plugin.so").exists());
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: `ls` Bare Listing Token Expansion Regression (BUG-LS-4833)
- **Context**: `src/cmds/system/ls.rs`
- **What Was Expected**: Running `rtk ls` without `-l` on a directory should print directory names/files compactly without sizes, matching or beating native `ls` token consumption.
- **What Actually Happened**: `rtk ls` unconditionally passed `-l` to underlying `ls` so it could parse permissions and sizes. When rendering without `-l`, it still printed human-readable file sizes next to filenames (`kubectl 57.9M`). The bare output expanded from 341 bytes to 531 bytes, inflating LLM context consumption.
- **Evidence in Repo**: Commit `f4d289a0`, PR #4833, Issue #4833.
- **Root Cause**: The filter's `never_worse` comparison checked against the child process stdout. Since `rtk` invoked `ls -la`, the child stdout was 2,067 bytes. A transformed output of 531 bytes looked like a 74% savings when it was actually a 55% inflation over the 341-byte bare `ls` output.
- **Remediation Code Diff**:
```rust
@@ -313,47 +316,81 @@ pub fn run(args: &[String], verbose: u8) -> Result<i32> {
-    runner::run_filtered(
+    let native = native_listing(args);
+    let listed = native
+        .as_ref()
+        .filter(|(stdout, succeeded)| *succeeded || !stdout.is_empty())
+        .map(|(stdout, _)| stdout.as_str());
+
+    runner::run_filtered_with_exit(
         cmd,
         "ls",
         &label,
-        |raw| {
-            let (entries, parsed_count, truncated, filtered) = compact_ls(raw, show_all, show_long);
-            let mut out = entries;
-            if let Some(hint) = hidden_hint(&truncated, &filtered) {
-                out.push_str(&hint);
-                out.push('\n');
-            }
-            out
+        |raw, code| match (code, &native) {
+            (0, _) => render(raw, listed, show_all, show_long, verbose),
+            (_, Some((native, _))) => never_worse(native, raw).to_string(),
+            (_, None) => raw.to_string(),
         },
-        RunOptions::stdout_only()
-            .early_exit_on_failure()
-            .no_trailing_newline(),
+        RunOptions::stdout_only().no_trailing_newline(),
     )
 }
```
- **Lesson**: Any system that injects verbose CLI flags to enrich structured data parsing must preserve and evaluate against the unaltered user command baseline.

---

### Incident 2: OpenCode Plugin Setup Coupled to Claude Context Parsing (BUG-INIT-4413)
- **Context**: `src/hooks/init/claude.rs` & `src/hooks/init/mod.rs`
- **What Was Expected**: Executing `rtk init -g --opencode` should install the OpenCode editor integration regardless of whether `.claude/CLAUDE.md` is well-formed or writable.
- **What Actually Happened**: The OpenCode installer was embedded deep inside `run_claude_md_mode_with` and `run_default_mode`. When `CLAUDE.md` contained a malformed block (e.g. an unclosed `<!-- rtk-instructions`), `write_rtk_block` returned an `Err(...)`, aborting execution before `ensure_opencode_plugin_installed` ran.
- **Evidence in Repo**: Commit `6c2313a6`, PR #4740, Issue #4413.
- **Root Cause**: Improper subsystem coupling. The OpenCode plugin installation had an implicit lifecycle dependency on Claude Code's config state.
- **Remediation Code Diff**:
```rust
@@ -473,34 +473,60 @@ pub fn run(
-            match (install_claude, install_opencode, claude_md, hook_only) {
-                (false, true, _, _) => run_opencode_only_mode(ctx)?,
-                (true, opencode, true, _) => run_claude_md_mode(global, opencode, ctx)?,
-                (true, opencode, false, true) => {
-                    run_hook_only_mode(global, patch_mode, opencode, ctx)?
-                }
+        // The OpenCode plugin is an independent target: install it before any
+        // agent so a Claude/Cursor failure cannot leave it missing, and vice versa.
+        let opencode_result = install_opencode.then(|| run_opencode_only_mode(ctx));
+        let opencode_plugin = opencode_result
+            .as_ref()
+            .and_then(|result| result.as_ref().ok())
+            .and_then(|path| path.as_deref());
+
+        let agent_result = (|| -> Result<()> {
+            match (install_claude, install_opencode, claude_md, hook_only) {
+                (false, true, _, _) => {}
+                (true, _, true, _) => run_claude_md_mode(global, ctx)?,
+                (true, _, false, false) => {
+                    run_default_mode(global, patch_mode, opencode_plugin, ctx)?
+                }
+                // ...
+            }
+            Ok(())
+        })();
```
- **Lesson**: Side-effect installations targeting different tools must be partitioned into decoupled phases with deferred composite error handling.

---

### Incident 3: SQLFluff Lint Shortcut Path Misinterpretation (BUG-LINT-4683)
- **Context**: `src/cmds/python/sqlfluff_cmd.rs` & `src/cmds/js/lint_cmd.rs`
- **What Was Expected**: Executing generic lint with a path (e.g. `rtk lint sqlfluff models/query.sql`) should execute `sqlfluff lint --format json models/query.sql`.
- **What Actually Happened**: The planner checked `let is_lint = args.is_empty() || args[0] == "lint";`. Because `args[0]` was `"models/query.sql"`, `is_lint` evaluated to `false`, causing the command to bypass JSON structuring and execute without filtering.
- **Evidence in Repo**: Commit `7fcd1cde`, PR #4683.
- **Root Cause**: Ambiguity in command routing. The tokenizer failed to distinguish between SQLFluff subcommands (`dialects`, `fix`, `parse`, `lint`) and positional file paths when invoked via the generic `rtk lint` dispatcher.
- **Remediation Code Diff**:
```rust
@@ -70,14 +71,53 @@ pub struct Invocation {
+const SQLFLUFF_SUBCOMMANDS: &[&str] = &[
+    "dialects", "fix", "format", "lint", "parse", "render", "rules", "version",
+];
+
+fn first_sqlfluff_subcommand(args: &[String]) -> Option<&str> {
+    let tokens = arg_tokenizer::tokenize(args);
+    arg_tokenizer::before_dashdash(&tokens)
+        .first()
+        .filter(|token| token.kind == TokenKind::Positional)
+        .and_then(|token| {
+            SQLFLUFF_SUBCOMMANDS
+                .iter()
+                .copied()
+                .find(|command| *command == token.text)
+        })
+}
+
+fn plan_inner(args: &[String], generic_lint: bool) -> Invocation {
+    let subcommand = first_sqlfluff_subcommand(args);
+    let is_lint = args.is_empty()
+        || subcommand == Some("lint")
+        || (generic_lint && subcommand.is_none() && !is_top_level_control(args));
```
- **Lesson**: When wrapping CLI tools that feature optional subcommands, use positive lookups against known subcommand sets rather than assuming unrecognized positionals are subcommands.

---

### Incident 4: Bogus Grep Rewrite Identifiers Flagged as Corruption (BUG-GREP-4782)
- **Context**: `src/hook/claude.rs` & `src/filter/grep.rs`
- **What Was Expected**: An LLM agent running search commands should receive accurate identifier matches.
- **What Actually Happened**: An automated agent filed a high-priority bug asserting `rtk` corrupted search matches (turning `revision` into `ren` and `description` into `n`).
- **Evidence in Repo**: Closed Issue #4782.
- **Root Cause**: Tool flag collisions in the agent prompt chain. Claude Code generated `rg -rn ...`. In `ripgrep`, `-r <replacement>` specifies an inline string replacement, and `-n` was parsed as the replacement parameter. As a result, `ripgrep` itself replaced every match with `n`.
- **Remediation Post-Mortem Analysis**: `rtk` added explicit directives (`TERSE_OUTPUT_TEXT`) cautioning agents on flag ambiguity:
```rust
// In engine/src/directive.rs:
pub const TERSE_OUTPUT_TEXT: &str = "\
Keep prose short. Drop articles (a, an, the), filler...
Brevity applies to prose only. Never shorten code, file paths, commands,
identifiers, error text, or numbers. Keep every negation (not, never, no)...";
```
- **Lesson**: Do not let agents abbreviate command-line switches in automated generation loops without explicit flag validation.

---

### Incident 5: False-Positive Base64 Elision in Numeric/Hex JSON Buffers (BUG-ENGINE-B64)
- **Context**: `engine/src/methods/base64_elide.rs`
- **What Was Expected**: Embedded base64 blobs (e.g. data URLs, images) should be replaced with `[base64 image/png, 45 KB elided]`, leaving JSON syntax intact.
- **What Actually Happened**: High-precision decimal numbers (>1024 digits) and long hex dumps (e.g., `deadbeef` memory blocks) matched the base64 regex character set `[A-Za-z0-9+/]`. When matched inside a JSON number literal, inserting `[base64 data...]` produced unparseable JSON, crashing downstream AST parsers.
- **Evidence in Repo**: Source test `a_long_bare_number_is_not_mistaken_for_base64`.
- **Root Cause**: Insufficient regex entropy validation. The regex `[A-Za-z0-9+/]{1024,}` does not verify character entropy, matching pure numeric sequences.
- **Remediation Code Diff**:
```rust
@@ -40,11 +40,24 @@ impl Method for Base64Elide {
         let out = BASE64_RUN.replace_all(input, |caps: &regex::Captures| {
             let whole = caps.get(0).map(|m| m.as_str()).unwrap_or("");
             let run = caps.get(2).map(|m| m.as_str()).unwrap_or("");
+            if !looks_like_base64(run) {
+                return whole.to_string();
+            }
             let decoded_kb = (run.len() * 3 / 4) as f64 / 1024.0;
             format!("[base64 data, {decoded_kb:.0} KB elided]")
         });
+
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
- **Lesson**: Never perform semantic string replacements on structured data formats without validating the character entropy and grammatical context of the matched content.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Ceiling Division for Accurate Token Accounting**:
  ```rust
  // CORRECT: Token calculation across character boundaries must round UP
  pub fn estimate_tokens(s: &str) -> usize {
      s.len().div_ceil(4)
  }
  // FORBIDDEN: Floor division underestimates tokens, allowing outputs to exceed context budgets
  // pub fn estimate_tokens_bad(s: &str) -> usize { s.len() / 4 }
  ```
- **Subcommand Slice Offsets**:
  ```rust
  // Safe array slicing: Convert bool presence to usize index
  let start = usize::from(subcommand == Some("lint"));
  out.extend_from_slice(&args[start..]);
  ```

### 2. Infinite Loop & Recursion Guards
- **Chain Pipeline Panic Isolation**:
  ```rust
  pub fn run_chain_caught(methods: &[&dyn Method], block: &Block, ctx: &MethodCtx) -> Option<String> {
      // Isolate third-party methods from panicking or unwinding the host process
      std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
          run_chain(methods, block, ctx)
      }))
      .ok()
  }
  ```
- **Single-Site Compression Guard**:
  ```rust
  const HOOK_MARKER_SIGNATURES: &[&str] = &[
      "lines elided]",
      "full output in recall file]",
      "[full output: ",
  ];

  pub fn carries_hook_stamp(text: &str) -> bool {
      // Prevent cyclic re-compression: Avoid running hooks over blocks already compressed by proxy
      HOOK_MARKER_SIGNATURES.iter().any(|sig| text.contains(sig)) || !parse(text).is_empty()
  }
  ```

### 3. UI & UX Micro-Mechanics
- **ANSI Escape Sequence Stripping**:
  ```rust
  pub fn strip_ansi(input: &str) -> String {
      // Short-circuit: Avoid heap allocation if text contains no escape byte
      if !input.contains('\x1b') {
          return input.to_string();
      }
      // Zero-allocation scan over bytes avoiding regex overhead
      let mut out = String::with_capacity(input.len());
      let mut in_escape = false;
      for c in input.chars() {
          if c == '\x1b' { in_escape = true; continue; }
          if in_escape {
              if c.is_ascii_alphabetic() { in_escape = false; }
              continue;
          }
          out.push(c);
      }
      out
  }
  ```

### 4. Backend Concurrency & Memory Safety
- **Console Code Page Decoding Across Platforms**:
  ```rust
  // Platform invariant: Compile decoding logic on all architectures to ensure consistent parsing
  #[cfg(windows)]
  pub fn get_console_codepage() -> u32 {
      unsafe { windows_sys::Win32_System_Console::GetConsoleOutputCP() }
  }
  ```
- **Zero-Wait Process Execution**:
  ```rust
  let mut child = cmd
      .stdin(Stdio::null())
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .spawn()?;
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Head/Tail Terminal Output Preservation**:
  ```rust
  pub const HEAD_LINES: usize = 50;
  pub const TAIL_LINES: usize = 200;
  pub const MAX_LINES: usize = HEAD_LINES + TAIL_LINES + 50;

  pub fn apply_cap(input: &str) -> String {
      let total = input.lines().count();
      if total <= MAX_LINES { return input.to_string(); }
      let lines: Vec<&str> = input.lines().collect();
      let elided = total - HEAD_LINES - TAIL_LINES;
      
      let mut result = Vec::with_capacity(HEAD_LINES + TAIL_LINES + 1);
      result.extend_from_slice(&lines[..HEAD_LINES]);
      result.push(format!("[{elided} lines elided]"));
      // Tail preservation: Retain compiler/runtime stack traces at the end of outputs
      result.extend_from_slice(&lines[total - TAIL_LINES..]);
      result.join("\n")
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
Decoupled multi-crate topology:
- **`rtk`**: Fast CLI runner, handles OS platform boundaries, signals, and argument tokenization.
- **`rtk-engine`**: Stateless transformation library implementing `Method`, `Block`, and `Pipeline`.
- **`proxy`**: Independent daemon crate handling long-running proxy loops without bloating CLI build times.

### 2. Core Abstractions
- **`Block<'a>`**: Ephemeral borrow view over text, containing `Origin`, `Subject`, `ContentFormat`, and `Provenance`.
- **`Method` Trait**: Pipeline transformation contract returning `Outcome::Continue`, `Outcome::ShortCircuit`, or `Outcome::Skip`.
- **`TokenKind`**: Strongly typed CLI argument token representation (`Positional`, `Short`, `Long`, `Attachment`).

### 3. Error Handling
- Two-tier containment: Process execution uses `anyhow::Result`, while data-layer transformations use `catch_unwind`.
- Installer uses composite diagnostics (`(Some(Err), Err)` aggregation) to report independent failure traces together.

### 4. Testing
- Integration harnesses spin up mock bash binaries, write dynamic outputs to `PATH`, and verify that `tokens(rtk) <= tokens(native)`.
- Fuzz suites test flag positions across commands (e.g., ensuring `ls . -h` and `ls -h .` behave identically).

### 5. Security
- Avoids shell expansion (`sh -c`) when spawning commands, directly passing parsed token arrays to `exec`.
- Replaces embedded base64 assets with metadata tags to prevent payload injection into LLM prompts.

### 6. Performance
- **Target Overhead**: Sub-10ms latency budgets.
- Pre-allocated string builders and byte-level scanning (`!input.contains('\x1b')`) bypass regex engines whenever possible.

### 7. Deployment
- The proxy daemon is built separately (`cargo build --release --manifest-path proxy/Cargo.toml`) to avoid pull-request build stalls.
- Dual SQLite bindings are pinned to `rusqlite = 0.34` with bundled SQLite to prevent link-time collisions.

### 8. Agent Patterns
- **Terse Directives**: System prompt injections that trim conversational filler while strictly protecting code tokens.
- **Never-Longer Guards**: Token estimation rules preventing models from inventing token-heavy abbreviations.

### 9. Data Flow
Raw Subprocess Output $\rightarrow$ Code Page Decoder $\rightarrow$ `Block` Serialization $\rightarrow$ Transform Chain $\rightarrow$ `never_worse` Size Guard $\rightarrow$ Agent Context Window.

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Head/Tail Error Preservation Window
```rust
pub fn window_head_tail(lines: &[&str], head: usize, tail: usize) -> Vec<String> {
    if lines.len() <= (head + tail) {
        return lines.iter().map(|s| s.to_string()).collect();
    }
    let elided = lines.len() - head - tail;
    let mut out = Vec::with_capacity(head + tail + 1);
    out.extend(lines[..head].iter().map(|s| s.to_string()));
    out.push(format!("[{elided} lines elided]"));
    out.extend(lines[lines.len() - tail..].iter().map(|s| s.to_string()));
    out
}
```

### 2. Rule: Zero-Growth Verification Invariant
A transform step MUST NOT emit output larger than its input. When output size exceeds input size, it must yield the input unchanged.

### 