> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ataraxy-labs-sem-learnings.md`  
> **Source**: github ([https://github.com/Ataraxy-Labs/sem](https://github.com/Ataraxy-Labs/sem))  
> **Source Version**: `43925140`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-02T17:58:25.335Z  
> **Learning ID**: `learn-github-ataraxy-labs-sem`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Ataraxy-Labs/sem

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
Traditional line-based Version Control Systems (`git diff`, `git merge`) operate on unstructured line buffers. When LLM coding agents alter files, line-oriented diffing causes:
1. False-positive syntactic conflicts due to harmless reorderings, import permutations, or whitespace modifications.
2. Context blindness during prompt construction and retrieval; agents lack structural understanding of AST-level changes (e.g., whether an edit modified a signature, changed visibility, or touched internal implementation logic).
3. Inability to perform targeted impact analysis, causing agents to recheck or re-test the entire project rather than traversing the precise caller/callee directed dependency graph.

`sem` implements **semantic version control over Git**. It sits between Git's object store and consumer runtimes (human CLI or AI agent harnesses via MCP/hooks). It ingests raw tree-sitter ASTs across 32 languages, maps syntax nodes into unified semantic entities (`Function`, `Method`, `Class`, `Interface`, `TypeAlias`, `Operator`), computes structural hashes invariant to whitespace/formatting, and evaluates diffs, dependency graphs, caller/callee paths, and verification impact at entity granularity.

```
                                  AI AGENT HARNESS (Claude Code, Codex, Cursor)
                                              |
                   +--------------------------+--------------------------+
                   | (UserPromptSubmit)                                  | (PreToolUse / PostToolUse)
                   v                                                     v
        +----------------------+                              +----------------------+
        |   sem hook prompt-   |                              |    sem hook tool     |
        |        submit        |                              |  (Interceptor/Proxy) |
        +----------+-----------+                              +----------+-----------+
                   |                                                     |
                   | Prefetch Top Entities                               | Rewrite / Deny Shell Writes
                   v                                                     v
+---------------------------------------------------------------------------------------------------+
|                                            SEM RUNTIME                                            |
|                                                                                                   |
|  +--------------------+   +-----------------------+   +-------------------+   +----------------+  |
|  |     sem find       |   |       sem diff        |   |    sem impact     |   |   sem check    |  |
|  | (BM25 + AST Rerank)|   | (Tree-Sitter Entity)  |   | (Call-Graph Deps) |   | (Cached Sub-run|  |
|  +---------+----------+   +-----------+-----------+   +---------+---------+   +-------+--------+  |
|            |                          |                         |                     |           |
|            +--------------------------+-------------------------+---------------------+           |
|                                       |                                                           |
|                                       v                                                           |
|                       +-------------------------------+                                           |
|                       |  sem-core Parser & Extractor  |                                           |
|                       +---------------+---------------+                                           |
|                                       |                                                           |
|        +------------------------------+------------------------------+                            |
|        v                              v                              v                            |
|  +------------+             +--------------------+            +--------------+                    |
|  | AST Caches |             | Language Grammars  |            |  Git Bridge  |                    |
|  |  (XXH3-128)|             |  (32 Tree-Sitter)  |            |   (libgit2)  |                    |
|  +------------+             +--------------------+            +--------------+                    |
+---------------------------------------------------------------------------------------------------+
                                        |
                                        v
                            FILESYSTEM & GIT BLOB STORE
```

### Architectural Boundaries & Subsystems
1. **`sem-core`**: The invariant-enforcing parser engine.
   - Encapsulates tree-sitter grammar tables and parsing drivers.
   - Computes structural hash fingerprints per entity (`kappa` / AST hashing) while ignoring comments, docstrings, and non-semantic tokens.
   - Hosts the `diff_oracle` subsystem, running dual-path differential execution verification (fast extraction vs. baseline tree walk) on live Git histories.
   - Manages content-addressed AST memory layers (`XXH3-128` digest keys mapped to cached entities) and interning pools (`Arc<str>`).
2. **`sem-cli`**: The execution frontier, process supervisor, and agent interceptor.
   - Implements hook protocols (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`) for LLM runtimes (Claude Code, OpenAI Codex, Pi).
   - Enforces isolation primitives via process groups (`setpgid(0, 0)`), hard deadlines, and tree-killing via negative PGID signals.
   - Provides canonical commands: `find`, `grep`, `impact`, `check`, `certify`.
3. **`sem-mcp`**: The Model Context Protocol server facade.
   - Exposes tools (`sem_find`, `sem_entities`, `sem_impact`, `sem_context`) over standard I/O RPC.
   - Bridges free-text natural language queries to structural entities using an AST-aware BM25 scoring algorithm combined with reverse-dependency tie-breaking.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Robust Child Subprocess Group Termination Under Strict Deadlines
**RULE**:
When spawning external child processes with execution timeouts in supervisor or agent CLI tooling, implementations MUST assign the child to a new process group (`setpgid(0, 0)`) immediately upon fork and MUST deliver signals (`SIGKILL`/`SIGTERM`) to the negative process group ID (`-pgid`), NEVER exclusively to the child process PID.

**WHY**:
Spawning intermediate shells (`sh -c`) or compilers/runtimes creates process hierarchy branches (e.g., `cargo test` -> runner -> unit test binary). Calling `child.kill()` in Rust or standard runtimes only sends `SIGKILL` to the immediate child PID. If the child spawned subprocesses, those child processes are orphaned, reparented to `init` (PID 1) or systemd, continue consuming memory/CPU indefinitely, hold locks on build directories (e.g., `target/criterion`), and exhaust operating system file descriptors and thread limits.

**WHEN TO APPLY**:
Apply in any CLI tool, worker daemon, build supervisor, test runner, or LLM agent tool-execution sandbox that executes shell scripts or builds with execution deadlines on POSIX targets.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::io::Read;
use std::os::unix::process::CommandExt;
use std::process::{Command, ExitStatus, Stdio};
use std::time::{Duration, Instant};

pub struct ExecResult {
    pub status: ExitStatus,
    pub stdout: String,
    pub stderr: String,
}

pub fn run_with_deadline(mut cmd: Command, limit: Duration) -> Result<ExecResult, String> {
    cmd.stdin(Stdio::null())
       .stdout(Stdio::piped())
       .stderr(Stdio::piped());

    // CRITICAL: Decouple child from supervisor PGID into its own process group
    #[cfg(unix)]
    {
        cmd.process_group(0);
    }

    let program_repr = format!("{:?}", cmd.get_program());
    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn {program_repr}: {e}"))?;

    let mut out_stream = child.stdout.take().expect("stdout piped");
    let mut err_stream = child.stderr.take().expect("stderr piped");

    // Slurp stdout/stderr off-thread to prevent pipe buffer deadlock
    let to = std::thread::spawn(move || {
        let mut b = Vec::new();
        let _ = out_stream.read_to_end(&mut b);
        b
    });
    let te = std::thread::spawn(move || {
        let mut b = Vec::new();
        let _ = err_stream.read_to_end(&mut b);
        b
    });

    let start = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(s)) => break s,
            Ok(None) if start.elapsed() > limit => {
                #[cfg(unix)]
                unsafe {
                    // Send kill signal to the entire negative process group ID
                    libc_kill_pgid(child.id() as i32);
                }
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("{program_repr} timed out after {}s", limit.as_secs()));
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(10)),
            Err(e) => return Err(format!("Error polling {program_repr}: {e}")),
        }
    };

    let stdout = String::from_utf8_lossy(&to.join().unwrap_or_default()).to_string();
    let stderr = String::from_utf8_lossy(&te.join().unwrap_or_default()).to_string();

    Ok(ExecResult { status, stdout, stderr })
}

#[cfg(unix)]
unsafe fn libc_kill_pgid(pid: i32) {
    extern "C" {
        fn kill(pid: i32, sig: i32) -> i32;
    }
    // Negative pid targets the entire process group
    kill(-pid, 9);
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Direct PID kill leaving orphaned background sub-trees
pub fn unsafe_spawn_kill(mut cmd: std::process::Command) {
    let mut child = cmd.spawn().unwrap();
    std::thread::sleep(std::time::Duration::from_secs(5));
    // DANGER: Only kills the top-level shell process.
    // Compilers, linters, or forks spawned by the shell continue running orphaned!
    let _ = child.kill(); 
}
```

**VERIFICATION METHOD**:
Verify compliance by executing a fork-bomb-style hierarchy wrapper: `sh -c "sleep 100 & sleep 100"`. Ensure that after the supervisor triggers timeout, running `pgrep -f "sleep 100"` returns 0 results.

---

### 2. Lexical Path Boundary Containment for Agent Workdir Operations
**RULE**:
Before permitting or denying filesystem writes in agent hooks, path sanitization algorithms MUST resolve directory traversals strictly through normalized component accumulation (`Path::components`), MUST check against canonical boundary anchors (e.g., repository `.git` root), and MUST NOT perform naive substring checks or single-level regex matching on path arguments.

**WHY**:
Agents construct command invocations spanning external destinations (`/tmp/scratch.rs`, `~/.bashrc`), relative traversals (`../../outside/file.rs`), standard pseudo-devices (`/dev/null`, `/dev/stderr`), and target repository trees. Naively filtering shell commands using extension regexes (`\.rs$`) blocks non-repository operations (e.g., `cargo test > /tmp/test.log`, `cat <<EOF > /tmp/scratch.rs`), which burns model context turns, frustrates execution planning, and breaks tool pipelines. Conversely, naive path matching without parent traversal evaluation (`..`) permits directory escape attacks where agents modify code outside repository bounds.

**WHEN TO APPLY**:
Apply in any security policy layer, agent tool hook, linter sandbox, or shell interceptor that restricts read/write operations to a specific workspace or repository boundary.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::{Component, Path, PathBuf};

/// Strictly verify whether `raw_path` targets source code within the repository root.
pub fn is_repo_internal_source_file(cwd: &Path, raw_path: &str, valid_exts: &[&str]) -> bool {
    let path = Path::new(raw_path);

    // Reject non-files, pseudo-devices, and home expansions immediately
    if raw_path.starts_with("/dev/") || raw_path.starts_with('~') {
        return false;
    }

    // Check extension whitelist
    let ext = path.extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if !valid_exts.contains(&ext.as_str()) {
        return false;
    }

    // Locate repository anchor root (walking upwards to find .git)
    let repo_root = cwd.ancestors()
        .find(|d| d.join(".git").exists())
        .unwrap_or(cwd);

    // Lexically canonicalize path components without hitting disk symlinks
    let full = cwd.join(path);
    let mut normalized_parts: Vec<Component> = Vec::new();

    for c in full.components() {
        match c {
            Component::ParentDir => {
                normalized_parts.pop();
            }
            Component::CurDir => {}
            normal_or_root => normalized_parts.push(normal_or_root),
        }
    }

    let resolved_path: PathBuf = normalized_parts.into_iter().collect();

    // Verify boundary confinement
    resolved_path.starts_with(repo_root)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Naive string match or regex without path resolution
pub fn buggy_is_repo_code(cmd: &str) -> bool {
    // FAILS: Blocks redirecting stdout to temporary debug code: `cat main.rs > /tmp/dump.rs`
    // FAILS: Misses path traversal escapes: `echo dangerous > ../../sibling_repo/main.rs`
    cmd.contains(".rs") || cmd.contains(".py")
}
```

**VERIFICATION METHOD**:
Run unit tests verifying path confinement invariants:
```rust
#[test]
fn test_path_confinement() {
    let root = Path::new("/workspace/project");
    assert!(!is_repo_internal_source_file(root, "/tmp/scratch.rs", &["rs"]));
    assert!(!is_repo_internal_source_file(root, "../../other/evil.rs", &["rs"]));
    assert!(!is_repo_internal_source_file(root, "/dev/null", &["rs"]));
    assert!(is_repo_internal_source_file(root, "src/core/main.rs", &["rs"]));
    assert!(is_repo_internal_source_file(root, "./src/../src/lib.rs", &["rs"]));
}
```

---

### 3. Dual-Path Differential Oracle Invariant for Performance Optimization
**RULE**:
When implementing an optimized "fast-path" parser, cache, or AST extractor meant to replace or accelerate an established reference implementation, the build/test harness MUST maintain an automated Differential Oracle. The Oracle MUST execute both implementations over identical real-world commit changesets and assert identity over both semantic entity boundaries and structural serialization envelopes.

**WHY**:
Optimized extractors (such as regex-based token scanners, incremental re-parsers, or hand-rolled state machines) introduce subtle semantic drifts: slight discrepancies in byte spans, dropped type parameters, or altered handling of edge-case declarations (destructors, conversion operators, nested namespaces). Without a differential oracle continuously testing real historical Git diffs, regressions escape into production, corrupting downstream semantic diff calculations and caller/callee graphs.

**WHEN TO APPLY**:
Apply whenever introducing performance optimizations, incremental AST reparsing, streaming deserializers, or fast-path extractors in compilers, semantic indexes, and static analysis engines.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Debug, PartialEq, Eq)]
pub enum OracleVerdict {
    Equivalent,
    Divergent { layer: &'static str, detail: String },
    Vacuous,
}

pub struct DifferentialOracle;

impl DifferentialOracle {
    pub fn verify_equivalence<T, FRef, FFast>(
        inputs: &[&str],
        reference_engine: FRef,
        fast_engine: FFast,
    ) -> OracleVerdict 
    where
        T: std::fmt::Debug + PartialEq,
        FRef: Fn(&str) -> Result<T, String>,
        FFast: Fn(&str) -> Result<T, String>,
    {
        if inputs.is_empty() {
            return OracleVerdict::Vacuous;
        }

        for input in inputs {
            let ref_res = reference_engine(input);
            let fast_res = fast_engine(input);

            match (ref_res, fast_res) {
                (Ok(ref_val), Ok(fast_val)) => {
                    if ref_val != fast_val {
                        return OracleVerdict::Divergent {
                            layer: "AST_EXTRACTION_MISMATCH",
                            detail: format!("Ref: {:?}\nFast: {:?}", ref_val, fast_val),
                        };
                    }
                }
                (Err(e1), Err(e2)) => {
                    // Both rejected input cleanly
                }
                (Ok(v), Err(e)) => {
                    return OracleVerdict::Divergent {
                        layer: "FAST_PATH_FALSE_REJECTION",
                        detail: format!("Ref succeeded with {:?}, fast failed: {}", v, e),
                    };
                }
                (Err(e), Ok(v)) => {
                    return OracleVerdict::Divergent {
                        layer: "FAST_PATH_FALSE_ACCEPTANCE",
                        detail: format!("Ref failed with {}, fast succeeded with {:?}", e, v),
                    };
                }
            }
        }

        OracleVerdict::Equivalent
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Benchmark-only testing without differential output assertion
#[test]
fn benchmark_fast_path() {
    let fast_out = run_fast_path("source code");
    // VIOLATION: Fast path is benchmarked for speed, but never verified against 
    // the canonical reference parser output on identical inputs!
    assert!(!fast_out.is_empty());
}
```

**VERIFICATION METHOD**:
Integrate into the CI harness via an example or integration test replaying historical commits (`cargo run --example diff_oracle -- --commits 100 --verbose`). Exit status MUST be non-zero if any commit produces `Divergent` or if all commits evaluate to `Vacuous`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Shell Write Interception Collateral Damage (BUG-SEM-01)
- **Context**: Agent Pre-Tool hook command interceptor: `crates/sem-cli/src/commands/tool_hook.rs`.
- **What Was Expected**: The agent hook interceptor was intended to catch shell-based edits (`sed -i`, `echo "fn main()" > src/main.rs`) to force agents into using structured AST editing tools (`weave_edit`), preventing broken line diffs and merge conflicts.
- **What Actually Happened**: The check naively matched any redirection operator (`>`) followed by a file extension. Consequently, when an LLM agent executed shell commands that wrote temporary test logs (`cargo test > out.log`), generated scratch test files (`cat > /tmp/t.rs <<EOF`), or piped JSON outputs (`jq . > /tmp/res.json`), the tool hook rejected the execution with: `"Change files with the weave_edit tool... not the shell"`. This caused agent execution loops and wasted context tokens.
- **Evidence in Repo**: Commit `43925140`, Issue #540, `crates/sem-cli/src/commands/tool_hook.rs`, and test suite `cli_simplify.rs`.
- **Root Cause**: The inspection regex and predicate `shell_write(cmd: &str)` only evaluated string patterns without resolving the target path's lexical position relative to the repository workspace and without verifying whether the extension denoted recognized source code.
- **Remediation Code Diff**:
```rust
// crates/sem-cli/src/commands/tool_hook.rs
-fn shell_write(cmd: &str) -> bool {
+fn shell_write(ctx: &Ctx, cmd: &str) -> bool {
     static EDIT: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
-        Regex::new(r"(^|[;&|]\s*)(sudo\s+)?(sed\s+(-[a-zA-Z]*i|--in-place)|perl\s+-[a-zA-Z]*[pi]|tee|truncate|patch\s)").unwrap()
+        Regex::new(r"(^|[;&|]\s*)(sudo\s+)?(sed\s+(-[a-zA-Z]*i|--in-place)|perl\s+-[a-zA-Z]*[pi]|truncate|patch\s)").unwrap()
     });
-    static REDIRECT: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| Regex::new(r"(^|[^<>&0-9])>{1,2}\s*[\w./-]+\.\w+").unwrap());
+    static TARGET: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
+        Regex::new(r"(?:(?:^|[^<>&0-9])>{1,2}|(?:^|[;&|]\s*|\|\s*)tee(?:\s+-a)?)\s*([\w./~-]+\.\w+)").unwrap()
+    });
     static SCRIPT: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| Regex::new(r#"open\([^)]*,\s*['"][wa]|\.write_text\("#).unwrap());
-    EDIT.is_match(cmd) || REDIRECT.is_match(&cmd.replace("/dev/null", "")) || (cmd.contains("python") && SCRIPT.is_match(cmd))
+    EDIT.is_match(cmd)
+        || TARGET.captures_iter(cmd).any(|c| repo_code(ctx, &c[1]))
+        || (cmd.contains("python") && SCRIPT.is_match(cmd))
+}

+fn repo_code(ctx: &Ctx, path: &str) -> bool {
+    const CODE: &[&str] = &[
+        "rs", "py", "pyi", "ts", "tsx", "js", "jsx", "mjs", "cjs", "go", "java", "kt", "kts", "scala", "c", "h", "cc",
+        "cpp", "cxx", "hpp", "hh", "cs", "fs", "rb", "php", "swift", "m", "mm", "ex", "exs", "erl", "hs", "ml", "mli",
+        "dart", "lua", "zig", "vue", "svelte", "sol", "r", "jl", "nim", "clj", "elm",
+    ];
+    let ext = path.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
+    if !CODE.contains(&ext.as_str()) || path.starts_with('~') || path.starts_with("/dev/") {
+        return false;
+    }
+    let root = ctx.cwd.ancestors().find(|d| d.join(".git").exists()).unwrap_or(&ctx.cwd);
+    let full = ctx.cwd.join(path);
+    let mut parts: Vec<std::path::Component> = Vec::new();
+    for c in full.components() {
+        match c {
+            std::path::Component::ParentDir => { parts.pop(); }
+            std::path::Component::CurDir => {}
+            c => parts.push(c),
+        }
+    }
+    parts.iter().collect::<PathBuf>().starts_with(root)
+}
```
- **Lesson**: Security and workflow interceptors must distinguish between repository state alterations and non-persisted scratchpad artifacts by evaluating lexical workspace boundaries.

---

### Incident 2: Intent Search Substring Exact-Match Failure (BUG-SEM-02)
- **Context**: MCP Server semantic entity locator: `crates/sem-mcp/src/server.rs`.
- **What Was Expected**: When an LLM called `sem_find(intent="where are C# operators extracted")`, the server was expected to identify relevant definitions (`extract_operator`, `CSHARP_CONFIG`) using natural language queries.
- **What Actually Happened**: The server delegated `intent` directly to `sem_entities(query=intent)`. The underlying query engine executed an exact substring match of the *entire input string* against entity identifier names. Since no function is named `where are C# operators extracted`, every sentence-form agent query returned an empty result: `[]`.
- **Evidence in Repo**: Commit `43925140`, Issue #540, `crates/sem-mcp/src/server.rs`, `tests/cli_simplify.rs`.
- **Root Cause**: Semantic routing conflated exact symbol naming (`query`) with descriptive semantic retrieval (`intent`). Furthermore, programming language tokens (`C#`, `C++`, `F#`) were stripped away by standard whitespace/punctuation tokenizers into single characters (`c`), losing search fidelity.
- **Remediation Code Diff**:
```rust
// crates/sem-mcp/src/server.rs
-        if let Some(intent) = params.intent.as_deref().map(str::trim).filter(|i| !i.is_empty()) {
-            return self
-                .sem_entities(Parameters(EntitiesParams {
-                    path: None,
-                    no_default_excludes: None,
-                    query: Some(intent.to_string()),
-                    limit: params.limit,
-                    text: None,
-                    signatures: None,
-                    format: params.format.clone(),
-                }))
-                .await;
-        }
+        if let Some(intent) = params.intent.as_deref().map(str::trim).filter(|i| !i.is_empty()) {
+            return Ok(self.find_by_intent(intent, params.limit, params.format.as_deref()).await);
+        }
```
*Implemented token-stemming with BM25 ranking, language alias re-expansion (`C#` -> `csharp`), inverted index frequency weighting, and reverse-dependency tie-breaking:*
```rust
+    async fn find_by_intent(&self, intent: &str, limit: Option<usize>, format: Option<&str>) -> CallToolResult {
+        let ctx = match self.get_context(None).await {
+            Ok(ctx) => ctx,
+            Err(err) => return tool_error(err),
+        };
+        let (graph, all_entities) = self.live_graph(&ctx.repo_root).await;
+        let dependents = graph.dependents();
+        let limit = limit.unwrap_or(10).clamp(1, 100);
+        let ranked = intent_rank(intent, &all_entities, |id| dependents.get(id).map_or(0, Vec::len), limit);
+        // Formats ranked results weighted by body BM25 + name/path bonuses...
```
- **Lesson**: Agent intent interfaces must not rely on exact identifier substring matches. They require stemmed term-frequency scoring over body text, augmented with structural graph centrality bonuses.

---

### Incident 3: Missing AST Mapping for Advanced Declaration Syntax (BUG-SEM-03)
- **Context**: Tree-sitter node type mapper: `crates/sem-core/src/parser/plugins/code/entity_extractor.rs`.
- **What Was Expected**: Extraction of syntax nodes across C#, C++, Rust, and Java was expected to capture all callable or invokable entities as semantic units during diff calculations.
- **What Actually Happened**: Declarations such as C# conversion operators (`implicit operator int`), indexers (`this[int i]`), event accessors, Rust trait function signatures (`fn foo(&self);`), Java annotation type elements, and C++ destructors/type aliases were unmatched by `map_node_type`. They defaulted to unindexed AST regions, causing structural diffs to miss changes to operator overloads or interface method contracts.
- **Evidence in Repo**: Commit `43925140`, PR #538, Release #539, `crates/sem-core/src/parser/plugins/code/entity_extractor.rs`.
- **Root Cause**: Incomplete tree-sitter grammar node mapping table. The mapper lumped uncommon member declarations into unhandled fallback branches.
- **Remediation Code Diff**:
```rust
// crates/sem-core/src/parser/plugins/code/entity_extractor.rs
 fn map_node_type(tree_sitter_type: &str) -> &str {
         | "singleton_method"
         | "method_signature"
         | "abstract_method_signature"
-        | "operator_signature" => "method",
+        | "operator_signature"
+        | "function_signature_item"
+        | "annotation_type_element_declaration"
+        | "destructor_declaration" => "method",
+        "conversion_operator_declaration" => "operator",
+        "indexer_declaration" => "property",
+        "event_declaration" | "event_field_declaration" => "event",
+        "delegate_declaration" => "type",
+        "alias_declaration" => "type",
         "class_declaration"
         | "abstract_class_declaration"
         | "class_definition"
```
- **Lesson**: Semantic AST extractors must exhaustively map all grammatical variants of callable members (operators, indexers, destructors), or changes to interface contracts will bypass semantic change tracking.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **UTF-8 Character Boundary Truncation**: When slicing string buffers based on raw byte counts or token-budget calculations, never slice arbitrary byte indices. `sem` enforces this explicitly:
  ```rust
  let mut cut = block.len().min(room);
  while !block.is_char_boundary(cut) {
      cut -= 1;
  }
  out.push_str(&block[..cut]);
  ```
  *Failure Mode*: Truncating at an arbitrary byte index inside a multibyte UTF-8 codepoint causes a panic (`byte index N is not a char boundary; it is inside '…'`).
- **Wire-Format Structural Identity with `Arc<str>` Interning**:
  Converting internal `String` representations to `Arc<str>` to save memory in large AST fact graphs must preserve serialization equivalence. `sem` verifies via probe that `Arc<str>` and `String` produce identical CBOR byte streams:
  ```rust
  // Proved in examples/arc_str_wire_probe.rs:
  ciborium::into_writer(&old_struct_with_string, &mut b1).unwrap();
  ciborium::into_writer(&new_struct_with_arc_str, &mut b2).unwrap();
  assert_eq!(b1, b2); // Byte-for-byte identical; no schema bump needed.
  ```

### 2. Infinite Loop & Recursion Guards
- **Lexical Subprocess Wait Polling with Deadline Timeout**:
  Subprocesses cannot be polled indefinitely with `child.wait()`. `sem` implements a monotonic deadline check coupled with bounded sleep intervals:
  ```rust
  let deadline = Instant::now() + limit;
  let status = loop {
      match child.try_wait() {
          Ok(Some(s)) => break s,
          Ok(None) if Instant::now() > deadline => {
              // Forced termination logic
              return Err("timed out".into());
          }
          Ok(None) => std::thread::sleep(Duration::from_millis(10)),
          Err(e) => return Err(e.to_string()),
      }
  };
  ```
- **File System Ancestor Traversal Loop Termination**:
  When walking upwards through the directory tree looking for anchors (`.git` or `node_modules`), naive parent directory traversal can loop on root or cyclic environments. `sem` terminates when `dir.pop()` returns `false` or reaches `None`:
  ```rust
  let mut d = Some(root);
  while let Some(dir) = d {
      let p = dir.join("node_modules/.bin").join(bin);
      if p.exists() { return Some(p); }
      d = dir.parent(); // Terminates cleanly when parent reaches root ('/')
  }
  ```

### 3. UI & UX Micro-Mechanics
- **Agent CLI Feedback Invariant**:
  When an interception or hook fails, silent degradation is required unless explicit error conditions occur. In `sem hook prompt-submit`, if any lookup fails, the tool exits cleanly with exit code `0` and emits nothing:
  ```rust
  // Silent by design: no candidates, no repo, no socket, any error — print nothing and exit 0.
  // The hook must never disturb a prompt or crash the agent turn.
  if prompt.is_empty() || prompt.starts_with('/') || cwd.is_empty() {
      return;
  }
  ```
- **Deterministic Numbered Line Diff Output**:
  When presenting contextual files to LLMs in `sem_find --context`, formatting mimics standard Unix utilities (`cat -n`), including exact line boundaries:
  ```rust
  fn exact_source_lines(text: &str, from: usize, to: usize) -> String {
      text.split_inclusive('\n').skip(from - 1).take(to - from + 1).collect()
  }
  ```

### 4. Backend Concurrency & Memory Safety
- **Pipe Buffer Deadlock Prevention**:
  When executing child processes with piped `stdout` and `stderr`, calling `child.wait()` or `child.try_wait()` before reading both streams causes a deadlock if the child outputs data exceeding the operating system pipe buffer limit (typically 64 KiB).
  *Invariant*: `sem` spawns two independent worker threads via `std::thread::spawn` to drain `stdout` and `stderr` concurrently before joining the main process.
- **Race-Free Atomic File Helpers**:
  Writing dynamic runtime helper scripts must prevent race conditions across parallel runs:
  ```rust
  let tmp = dir.join(format!(".{name}-{}.tmp", std::process::id()));
  std::fs::write(&tmp, body)?;
  std::fs::rename(&tmp, &p)?; // Atomic filesystem replacement
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Common Suffix/Prefix Alignment Across Character Boundaries**:
  When computing diff slices for incremental tree-sitter reparsing in `single_edit`, trimming matching prefixes and suffixes byte-by-byte can split multi-byte UTF-8 sequences:
  ```rust
  while prefix > 0 && (!base.is_char_boundary(prefix) || !new.is_char_boundary(prefix)) {
      prefix -= 1;
  }
  ```
  Failing to rewind to the nearest UTF-8 character boundary creates invalid text slices, causing the tree-sitter parser to fail or return corrupted node ranges.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
`sem` is split into distinct functional layers:
- `crates/sem-core`: Pure library logic. AST generation, structural hashing, caching, entity extraction, and differential verification.
- `crates/sem-cli