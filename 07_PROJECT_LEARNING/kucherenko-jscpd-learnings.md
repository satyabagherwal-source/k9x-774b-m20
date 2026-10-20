> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kucherenko-jscpd-learnings.md`  
> **Source**: github ([https://github.com/kucherenko/jscpd](https://github.com/kucherenko/jscpd))  
> **Source Version**: `854df3d4`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-20T11:51:12.560Z  
> **Learning ID**: `learn-github-kucherenko-jscpd`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): kucherenko/jscpd

---

## 1. Executive Forensic Architecture & System Mechanics

`jscpd` is an industrial-grade, multi-language static analysis engine and duplication/dead-code detection platform rewritten in Rust (v5 architecture). It identifies code clones across 220+ programming languages, single-file components (Vue, Svelte, Astro), and mixed-language markdown documents. In addition to clone detection, it evaluates architectural boundary violations, dead-code reachability graphs, cyclomatic and cognitive complexity distributions, git commit history trends, and project-wide health metrics.

```
                           +-------------------------------------------------+
                           |                 CLI / MCP / LSP                 |
                           +------------------------+------------------------+
                                                    |
                                                    v
                               +----------------------------------------+
                               |     cpd-finder (Orchestration Engine)  |
                               +----+------------------------------+----+
                                    |                              |
            +-----------------------+                              +----------------------+
            v                                                                             v
+-----------------------+                                                     +-----------------------+
|     cpd-tokenizer     |                                                     |       cpd-core        |
|  - Per-language lexer |                                                     |  - detect.rs (Rabin-  |
|  - Blanking overlaps  |                                                     |    Karp sliding win)  |
|  - SFC & fence split  |                                                     |  - hash.rs (xxh3_64)  |
|  - normalize symbols  |                                                     |  - boundaries.rs      |
+-----------+-----------+                                                     |  - deadcode.rs        |
            |                                                                 |  - health.rs          |
            | (PreparedSource / DetectionToken streams)                       |  - history.rs         |
            +---------------------------------------------------------------->+-----------+-----------+
                                                                                          |
                                                                                          v
                                                                              +-----------------------+
                                                                              |     cpd-reporter      |
                                                                              |  - SARIF, JSON, HTML  |
                                                                              |  - Token-saving MCP   |
                                                                              +-----------------------+
```

### Architectural Subsystems and Decomposition

1. **`cpd-tokenizer` (Lexical Extraction & Embedded Document Normalization)**:
   - Houses lexical analyzers spanning 220+ languages.
   - Handles multi-language container documents (Single File Components like `.vue`, `.svelte`, `.astro`, Razor templates, and Markdown code fences).
   - Manages text-masking algorithms via `blank_ranges_preserve_newlines` to ensure that ignored segments (e.g., comments, front matter) preserve exact line/column offsets for downstream reporting.

2. **`cpd-core` (Detection Mathematics, Invariants & Scoring)**:
   - **Rolling Polynomial Hashing (`hash.rs`)**: Implements an $O(N)$ sliding-window Rabin-Karp hash parameterized by the golden-ratio Fibonacci base $M = \text{0x9e3779b97f4a7c15}$ and hardware-accelerated 64-bit non-cryptographic token hashing via `xxh3_64`.
   - **Grouped Window Detection (`detect.rs`)**: Employs non-allocating, zero-vtable hash tables (`rustc_hash::FxHashMap<u64, Occurrence>`) partition-scoped by language format and cross-format pool.
   - **Multi-Order Clone Categorization (`models.rs`)**:
     - *Type-1 (Exact)*: Bit-for-bit token equivalence.
     - *Type-2 (Renamed)*: Matched after identifier/literal normalization with bijective variable mapping tracking (`track_renames`).
     - *Type-3 (Similar/Gapped)*: Matched across syntax gaps or AST tree-shingle Jaccard overlap.
     - *Type-4 (Semantic)*: Matched via vector cosine similarity over neural embeddings of function sub-trees.
   - **Health & History Engines (`health.rs`, `history.rs`)**: Calculates Bayesian-adjusted half-life degradation metrics, combined via weighted geometric means to prevent high scores in one dimension from concealing critical regressions in another.

3. **`cpd-finder` & MCP Agent Interface (`mcp/`)**:
   - Exposes Model Context Protocol (MCP) tool schemas (`check_duplication`, `get_file_clones`, `check_current_directory`, `get_statistics`).
   - Translates agent snippet strings into isolated `PreparedSource` instances without cross-contaminating host project token offsets or corrupting relative path hierarchies.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Separation of Disjoint Sub-Languages in Multi-Format Virtual Documents
**RULE**:
When parsing, hashing, or scanning container documents (such as Markdown, Vue SFCs, Svelte, Astro, or HTML with inline scripts) into distinct sub-document streams for cross-language duplication or static analysis, the engine **MUST NOT** assign identical document-source identifiers to non-contiguous blocks or let sub-document token spans merge across host-language boundaries. Every extracted language partition **MUST** be tokenized with an isolated virtual identifier (e.g., `source_id:format`) and matched against the candidate pool with explicit line-offset recalculation rules.

**WHY**:
Sharing a single document identifier across discrete fences or scripts causes the gap-merging engine (Type-3 clone detection) to treat the intervening unparsed host-language lines as "unmatched gap code" between two halves of a clone. This creates bogus Type-3 clones spanning completely unrelated functions across distinct code fences. Furthermore, it causes line counters to credit intermediate host prose or template markup as "duplicated code lines," corrupting downstream CI thresholds and causing tokenizers that mask overlapping ranges to panic.

**WHEN TO APPLY**:
Any static analyzer, linter, language server protocol (LSP), or MCP agent subsystem handling composite documents with multiple embedded programming languages.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified pattern from cpd/src/mcp/project.rs & cpd-core/src/detect.rs
pub fn prepare_snippet_blocks(
    snippet_id: &str,
    format: &str,
    code: &str,
    options: &TokenizeOptions,
    consistent: bool,
) -> Vec<PreparedSource> {
    let mut blocks: Vec<PreparedSource> = Vec::new();
    let is_sfc = is_component(format);
    
    if is_sfc {
        // A component can be treated as a whole file for format-level cross checks
        let whole_tokens = tokenize_to_detection(format, code, options);
        blocks.push(snippet_source(
            snippet_id.to_string(),
            format,
            &whole_tokens,
            consistent,
            false,
        ));
    }

    // Split discrete blocks into isolated, distinct source entities
    let maps = tokenize_to_detection_maps(format, code, options);
    for (idx, map) in maps.into_iter().enumerate() {
        let is_embedded = map.format != format;
        // MUST assign unique virtual source_id per sub-format block to prevent
        // sliding window gap-merging across disjoint fence boundaries
        let sub_id = if is_embedded || is_sfc {
            format!("{snippet_id}:{}:{idx}", map.format)
        } else {
            snippet_id.to_string()
        };
        
        blocks.push(snippet_source(
            sub_id,
            &map.format,
            &map.tokens,
            consistent,
            is_embedded,
        ));
    }
    blocks
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Reusing the same source_id for all sub-blocks in a file.
// Causes gap merges across disjoint code blocks and corrupts line offset spans.
let mut blocks = Vec::new();
for map in tokenize_to_detection_maps(format, code, &options) {
    // BUG: Assigning bare SNIPPET_ID causes the detector to merge matches 
    // from block A and block B across whatever arbitrary host prose separates them!
    blocks.push(snippet_source(
        SNIPPET_ID.to_string(),
        &map.format,
        &map.tokens,
        consistent,
        false,
    ));
}
```

**VERIFICATION METHOD**:
Enforce an automated integration test asserting that two identical functions placed inside separate code fences in a Markdown document are never merged into a single `Similar` (Type-3) clone with gap lines:
```rust
#[test]
fn fences_do_not_merge_across_markdown_prose_gaps() {
    let markdown = "# Title\n```js\nfunction a() { x(); }\n```\nMiddle Prose\n```js\nfunction b() { y(); }\n```";
    let clones = detect_in_document(markdown, "markdown");
    for clone in clones {
        assert_ne!(
            clone.similarity_method,
            Some(SimilarityMethod::Gap),
            "Fences must not bridge across markdown prose gaps"
        );
    }
}
```

---

### 2. Precomputed Constant-Time Rolling Hash Invariant for Sliding Windows
**RULE**:
When implementing a Rabin-Karp or polynomial rolling hash over sequential tokens or bytes, the scale factor for the outgoing item ($\text{BASE}^{W-1} \pmod{2^{64}}$ where $W$ is window width) **MUST** be precomputed exactly **once** before entering the sliding-window loop. The inner step of the rolling loop **MUST NOT** invoke a variable exponentiation loop or dynamic power computation. Wrapping arithmetic (`wrapping_sub`, `wrapping_mul`, `wrapping_add`) **MUST** be used unconditionally to eliminate integer overflow trap penalties and maintain strict platform-agnostic determinism.

**WHY**:
Computing $\text{BASE}^{W-1}$ inside the sliding-window step converts an $O(N)$ sliding token traversal into an $O(N \times W)$ degradation, which degrades CPU instruction pipelining and stalls on high-throughput token pipelines. Unchecked math panics in debug builds and introduces unpredictable undefined behavior or branch mispredictions in release configurations.

**WHEN TO APPLY**:
All sliding-window algorithms, Rabin-Karp substring searches, n-gram extractors, and cyclic redundancy calculations.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified pattern from cpd-core/src/hash.rs
pub const HASH_BASE: u64 = 0x9e3779b97f4a7c15;

#[inline(always)]
pub fn base_pow(n: usize) -> u64 {
    let mut result = 1u64;
    for _ in 0..n {
        result = result.wrapping_mul(HASH_BASE);
    }
    result
}

#[inline(always)]
pub fn roll(current: u64, outgoing: u64, incoming: u64, window_power: u64) -> u64 {
    // new_hash = (current - outgoing * window_power) * BASE + incoming
    current
        .wrapping_sub(outgoing.wrapping_mul(window_power))
        .wrapping_mul(HASH_BASE)
        .wrapping_add(incoming)
}

// Caller invariant:
pub fn scan_window(hashes: &[u64], window_size: usize) {
    if hashes.len() < window_size || window_size == 0 {
        return;
    }
    // Precompute window_power ONCE per window_size outside hot loop
    let window_power = base_pow(window_size - 1);
    let mut current_hash = hash_window(&hashes[..window_size]);

    for i in window_size..hashes.len() {
        let outgoing = hashes[i - window_size];
        let incoming = hashes[i];
        current_hash = roll(current_hash, outgoing, incoming, window_power);
        // Process current_hash...
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Recalculating base_pow or using checked math inside the hot loop.
for i in window_size..hashes.len() {
    let outgoing = hashes[i - window_size];
    let incoming = hashes[i];
    // SEVERE PERFORMANCE DEGRADATION: O(W) loop per single token advance!
    let window_power = base_pow(window_size - 1); 
    // FATAL: Checked arithmetic panics in debug mode when rolling hash overflows u64!
    current_hash = (current_hash - outgoing * window_power) * HASH_BASE + incoming;
}
```

**VERIFICATION METHOD**:
Run property-based validation ensuring that single-token rolled hashing yields identical outputs to naive full-window hash recomputations across randomized token sequences:
```rust
#[test]
fn rolling_hash_identically_matches_naive_recompute_fuzz() {
    let tokens: Vec<u64> = (0..500).map(|x| (x * 31337) ^ 0xdeadbeef).collect();
    let window_size = 20;
    let window_power = base_pow(window_size - 1);
    let mut rolled = hash_window(&tokens[..window_size]);
    
    for i in window_size..tokens.len() {
        rolled = roll(rolled, tokens[i - window_size], tokens[i], window_power);
        let naive = hash_window(&tokens[i - window_size + 1..=i]);
        assert_eq!(rolled, naive, "Rolled hash must match naive slice evaluation at index {i}");
    }
}
```

---

### 3. Bidirectional Order-Independent Snippet Fingerprinting with Line-Ending Normalization
**RULE**:
When fingerprinting, baselining, or computing cryptographic/non-cryptographic hashes over pairs of code fragments $(A, B)$ to assert equivalence or record historical ignore baselines, the engine **MUST**:
1. Strip all Carriage Return (`\r`) tokens before serializing byte sequences.
2. Lexicographically sort candidate fragments such that $\text{order}(A, B) = \text{order}(B, A)$.
3. Intersperse a non-textual null byte delimiter (`0x00`) strictly between the concatenated fragment streams.

**WHY**:
Without stripping `\r`, baseline comparison across git checkouts on Windows (`core.autocrlf=true`) vs Linux/macOS (`core.autocrlf=input`) causes false positives where all historical clones appear as "new." Without lexicographical ordering, non-deterministic file discovery order (e.g. from parallel directory traversals via `ignore::WalkBuilder` or `rayon`) flips the identity $(A, B)$ into $(B, A)$, breaking historical suppressions. Without a null separator, concatenated boundary collisions occur: `("ab", "c")` produces the exact same hash as `("a", "bc")`.

**WHEN TO APPLY**:
Code clone suppression stores, AST subtree comparison caches, baseline diffing engines, and git pre-commit hooks.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified pattern from cpd-core/src/hash.rs
pub fn snippet_pair_hash(a: &str, b: &str) -> u64 {
    let a_clean = strip_cr(a);
    let b_clean = strip_cr(b);
    // 1. Enforce lexicographical symmetry
    let (first, second) = if a_clean <= b_clean {
        (&a_clean, &b_clean)
    } else {
        (&b_clean, &a_clean)
    };
    // 2. Pre-allocate buffer containing both fragments + unambiguous delimiter
    let mut buf = Vec::with_capacity(first.len() + second.len() + 1);
    buf.extend_from_slice(first.as_bytes());
    buf.push(0); // Separator prevents collision of ("ab","c") with ("a","bc")
    buf.extend_from_slice(second.as_bytes());
    
    // 3. Hardware-accelerated non-cryptographic hash
    xxhash_rust::xxh3::xxh3_64(&buf)
}

fn strip_cr(s: &str) -> std::borrow::Cow<'_, str> {
    if s.contains('\r') {
        std::borrow::Cow::Owned(s.replace('\r', ""))
    } else {
        std::borrow::Cow::Borrowed(s)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Direct hashing without line-ending strip, symmetric sort, or separator.
pub fn bad_pair_hash(a: &str, b: &str) -> u64 {
    // Collides ("ab", "c") and ("a", "bc")!
    // Fails across Windows/Linux git checkouts!
    // Fails when parallel walker swaps file scan order!
    let concatenated = format!("{a}{b}");
    xxhash_rust::xxh3::xxh3_64(concatenated.as_bytes())
}
```

**VERIFICATION METHOD**:
```rust
#[test]
fn verify_pair_hash_invariants() {
    // Invariant 1: Order invariance
    assert_eq!(snippet_pair_hash("alpha", "beta"), snippet_pair_hash("beta", "alpha"));
    // Invariant 2: CRLF vs LF invariance
    assert_eq!(snippet_pair_hash("alpha\r\nline2\r\n", "beta\n"), snippet_pair_hash("alpha\nline2\n", "beta\r\n"));
    // Invariant 3: Collision resistance across split boundaries
    assert_ne!(snippet_pair_hash("ab", "c"), snippet_pair_hash("a", "bc"));
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Front Matter Premature Termination via Fence Collisions (BUG-JSCPD-1223)
- **Context**: Markdown embedded block tokenization (`crates/cpd-tokenizer/src/markdown.rs` and `embedded.rs`).
- **What Was Expected**: A Markdown file beginning with a horizontal rule (`---`) followed by a Python code block containing an ellipsis (`...`) should parse the horizontal rule as thematic break prose, and the code fence as Python tokens.
- **What Actually Happened**: The Markdown tokenizer assumed any file starting with `---` contained YAML front matter, scanning forward for a closing line of `---` or `...`. The ellipsis (`...`) inside the Python code fence matched the front-matter closing delimiter. The front-matter byte range `[0, 122)` and the Python code fence byte range `[39, 126)` overlapped. Calling `blank_ranges_preserve_newlines` triggered an explicit panic assertion (`overlapping ranges detected`), crashing the CLI, MCP server, and LSP with core dumps (exit code 134).
- **Evidence in Repo**: Closed Issue #1223; Rust panic at `crates/cpd-tokenizer/src/embedded.rs:50:13`.
- **Root Cause**: Lexical state machine conflated document-level front-matter boundaries with nested language tokens, and failed to enforce monotonic non-overlapping assertions before executing memory blanking.
- **Remediation Code Diff**:
```rust
// crates/cpd-tokenizer/src/markdown.rs
- let front_matter = extract_front_matter(content);
- let fences = extract_code_fences(content);
- blank_ranges_preserve_newlines(content, &[front_matter, fences]); // PANIC on overlap!
+ let fences = extract_code_fences(content);
+ let front_matter = extract_front_matter_safe(content, &fences); 
+ // Exclude any candidate front-matter closing tag that occurs inside an identified code fence.
+ let non_overlapping = merge_and_sanitize_ranges(front_matter, fences);
+ blank_ranges_preserve_newlines(content, &non_overlapping);
```
- **Lesson**: Sub-document range extractors must run through a sweep-line interval scheduler that checks for containment and overlap invariants before passing offsets to destructive or blanking buffers.

---

### Incident 2: MCP Single-File Component Clone Blindness (BUG-JSCPD-1224)
- **Context**: MCP `check_duplication` tool in `crates/cpd/src/mcp/project.rs`.
- **What Was Expected**: Passing a Vue, Svelte, or Astro snippet containing TypeScript functions in its `<script>` tag to `check_duplication` should match existing TypeScript duplicate functions in the workspace.
- **What Actually Happened**: `count` returned 0 matches, with no warning `note` and no `unavailable` reason. Coding agents concluded that the code did not exist and wrote duplicate functions.
- **Evidence in Repo**: Issue #1224; PR #1229; commit `854df3d4`.
- **Root Cause**: The workspace scanner had parsed `.vue` files by splitting them into child blocks (`html`, `typescript`, `css`). When the MCP server received a snippet with `format: "vue"`, it tokenized it as a single homogeneous `vue` token stream and queried the `vue` index pool. Since the index pool contained only `html` and `typescript` streams (and 0 `vue` streams), the lookup was completely disjoint.
- **Remediation Code Diff**:
```rust
// crates/cpd/src/mcp/project.rs
- let maps = match splits_blocks(&format) {
-     true => tokenize_to_detection_maps(&format, code, &options),
-     false => vec![TokenMap {
-         format: format.clone(),
-         tokens: tokenize_to_detection(&format, code, &options),
-     }],
- };
- let mut blocks: Vec<PreparedSource> = maps
-     .iter()
-     .map(|map| {
-         let embedded = map.format != format;
-         let id = match embedded {
-             true => format!("{SNIPPET_ID}:{}", map.format),
-             false => SNIPPET_ID.to_string(),
-         };
-         snippet_source(id, &map.format, &map.tokens, consistent, embedded)
-     })
-     .collect();
+ let component = is_component(&format);
+ let scripts: Vec<String> = match component {
+     true => cpd_tokenizer::sfc::script_blocks(code, &format)
+         .into_iter()
+         .map(|(format, _)| format)
+         .collect(),
+     false => Vec::new(),
+ };
+ let mut blocks: Vec<PreparedSource> = Vec::new();
+ if component {
+     // Push the full component stream for whole-file matches (e.g. cross-format html,vue)
+     let tokens = tokenize_to_detection(&format, code, &options);
+     blocks.push(snippet_source(SNIPPET_ID.to_string(), &format, &tokens, consistent, false));
+ }
+ // Deconstruct and push child blocks with dedicated virtual IDs
+ for (i, map) in maps.into_iter().enumerate() {
+     let id = format!("{SNIPPET_ID}:{}:{}", map.format, i);
+     blocks.push(snippet_source(id, &map.format, &map.tokens, consistent, true));
+ }
```
- **Lesson**: Multi-format query snippets in agent tooling must mimic the exact decomposition pipeline used by the workspace indexing engine.

---

### Incident 3: Unbounded Model Initialization on Short Scripts (BUG-JSCPD-1228)
- **Context**: MCP Semantic / AST clone detection initialization (`crates/cpd/src/mcp/project.rs`).
- **What Was Expected**: If an agent supplied an Astro or Svelte snippet with a 3-line `<script>` block and long HTML markup, `check_duplication` should bypass loading heavy semantic embedding models if the code block has fewer tokens than `--min-tokens`.
- **What Actually Happened**: The system inspected the overall snippet length (script + markup combined), determined that the snippet exceeded `--min-tokens`, and initialized the ONNX embedding runtime and weights into memory, only to find zero extractable functions during token analysis.
- **Evidence in Repo**: Commit `27c98459`, PR #1229.
- **Root Cause**: The decision to trigger the semantic analyzer occurred prior to inspecting whether the sub-blocks contained valid parseable functions meeting the token length threshold.
- **Remediation Code Diff**:
```rust
// crates/cpd/src/mcp/project.rs
- if run.kinds.semantic {
-     project.ensure_semantic_model_loaded()?;
- }
+ // Extract functions first from candidate script blocks
+ let candidate_functions = extract_functions_from_blocks(&blocks);
+ if candidate_functions.is_empty() {
+     // Short-circuit: Do not load the embedding model if no functions qualify
+     checked.note = Some("snippet contains no functions long enough for semantic comparison".into());
+ } else if run.kinds.semantic {
+     project.ensure_semantic_model_loaded()?;
+ }
```
- **Lesson**: Lazy evaluation of heavy compute assets (neural models, AST engines) must be guarded by lightweight structural preconditions over the extracted AST items, not coarse document string lengths.

---

### Incident 4: Agent Truncation Note Overwrite Vulnerability
- **Context**: Tool result formatting in MCP server (`crates/cpd/src/mcp/tools.rs`).
- **What Was Expected**: When a snippet contains blocks too short for token passes, AND the number of returned matches exceeds the requested `limit`, both conditions should be communicated in the response `note`.
- **What Actually Happened**: `payload["note"]` used `note.or_else(|| truncated(...))`. When a short block note was generated, `or_else` skipped the truncation warning. The agent saw a truncated list of matches without realizing it had hit the `limit`.
- **Evidence in Repo**: Commit `854df3d4` & `27c98459` in `crates/cpd/src/mcp/tools.rs`.
- **Root Cause**: Misuse of `Option::or_else` fallback semantics instead of sequence chaining.
- **Remediation Code Diff**:
```rust
// crates/cpd/src/mcp/tools.rs
- if let Some(note) = note.or_else(|| truncated(matches.len(), limit, "match list")) {
-     payload["note"] = json!(note);
- }
+ let notes: Vec<String> = note
+     .into_iter()
+     .chain(truncated(matches.len(), limit, "match list"))
+     .collect();
+ if !notes.is_empty() {
+     payload["note"] = json!(notes.join("; "));
+ }
```
- **Lesson**: Diagnostic notes emitted to AI agents must be treated as additive collections rather than scalar fallbacks.

---

### Incident 5: Disjoint Line Count Over-Reporting in Multi-Block Clones (BUG-JSCPD-1090)
- **Context**: Duplicated line calculation in composite Markdown/SFC files (`crates/cpd-core/src/detect.rs` & `models.rs`).
- **What Was Expected**: If a single clone fragment in Markdown matches two code fences separated by 30 lines of text, the reported `duplicatedLines` statistic should reflect only the lines of the code fences.
- **What Actually Happened**: Line calculation was performed via `end.line - start.line + 1`. The intermediate prose lines between the code fences were added to `duplicatedLines`, artificially inflating duplication metrics.
- **Evidence in Repo**: PR #1229, Integration test `a_file_copied_into_fences_keeps_its_own_duplicated_lines` in `crates/cpd/tests/integration.rs`.
- **Root Cause**: Embedded fragments maintained host-relative line coordinates without carrying an offset subtraction mask for inter-block host content.
- **Remediation Code Diff**:
```rust
// crates/cpd-core/src/models.rs
  pub struct CpdClone {
      pub format: String,
      pub fragment_a: Fragment,
      pub fragment_b: Fragment,
+     /// Lines inside each fragment's span that are not duplicated code,
+     /// subtracting host text lying between blocks of the same fragment.
+     #[serde(skip)]
+     pub unmatched_lines: [u32; 2],
  }

  impl CpdClone {
      pub fn duplicated_lines(&self) -> u32 {
          let span_a = self.fragment_a.end.line.saturating_sub(self.fragment_a.start.line) + 1;
-         span_a
+         span_a.saturating_sub(self.unmatched_lines[0])
      }
  }
```
- **Lesson**: When projecting tokens from sub-languages into virtual host coordinates, metadata tracking unmapped interstitial intervals must accompany the token span to prevent invalid line calculations.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Normalizing Case and Identifier Delimiters**: When parsing configuration or CLI flags (such as Category names `unused-export` vs `unusedExports`), do not use simple lowercasing. `jscpd` implements a custom state machine in `cpd-core/src/deadcode.rs`:
```rust
fn normalize(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    let mut prev_lower = false;
    for ch in s.trim().chars() {
        match ch {
            '_' | ' ' | '-' => {
                if !out.ends_with('-') && !out.is_empty() {
                    out.push('-');
                }
                prev_lower = false;
            }
            c if c.is_ascii_uppercase() => {
                if prev_lower {
                    out.push('-');
                }
                out.push