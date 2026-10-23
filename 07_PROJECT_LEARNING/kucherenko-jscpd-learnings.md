> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kucherenko-jscpd-learnings.md`  
> **Source**: github ([https://github.com/kucherenko/jscpd](https://github.com/kucherenko/jscpd))  
> **Source Version**: `ff25faef`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-23T08:44:37.840Z  
> **Learning ID**: `learn-github-kucherenko-jscpd`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): kucherenko/jscpd

---

## 1. Executive Forensic Architecture & System Mechanics

`jscpd` is an industrial-grade static analysis engine and duplication detector engineered to identify Type-1 (identical), Type-2 (renamed/parameterized), Type-3 (near-miss/gapped), and Type-4 (semantic/syntactic equivalent) code clones across 220+ programming languages. Originally implemented in Node.js/TypeScript, its core was re-architected in pure Rust (workspace crate hierarchy `cpd-*`) to achieve linear scalability over million-line repositories without runtime garbage collection pauses.

```
                              ┌──────────────────────────────────────────┐
                              │  Entrypoints: CLI / MCP Server / LSP     │
                              │  (cpd, jscpd, stdio JSON-RPC 2.0)        │
                              └────────────────────┬─────────────────────┘
                                                   │
                             ┌─────────────────────▼─────────────────────┐
                             │ cpd-finder (File Walk, Ignores, Polyglot) │
                             └──────┬──────────────┬──────────────┬──────┘
                                    │              │              │
                   ┌────────────────┘              │              └───────────────┐
                   ▼                               ▼                              ▼
      ┌─────────────────────────┐    ┌───────────────────────────┐   ┌───────────────────────────┐
      │  cpd-tokenizer (Lexer)  │    │ cpd-semantic (Embeddings) │   │ basta (Dead Code Analysis)│
      │  Format maps, Comments, │    │ ONNX/Ureq local inference │   │ Import Graph, Symbol Tbl, │
      │  Fences, SFC Extractors │    │ Cosine similarity pool    │   │ Confidence Scoring Engine │
      └────────────┬────────────┘    └─────────────┬─────────────┘   └─────────────┬─────────────┘
                   │                               │                               │
                   └───────────────────────┐       │       ┌───────────────────────┘
                                           ▼       ▼       ▼
                             ┌───────────────────────────────────────────┐
                             │ cpd-core (Detection, Hashing, Boundaries) │
                             │ - Rolling Rabin-Karp Polynomial Hash      │
                             │ - FxHashMap Window Occurrence Index       │
                             │ - Shingle / Jaccard Tree Structural Hash  │
                             │ - Mathematical Health Metric Calculation  │
                             └─────────────────────┬─────────────────────┘
                                                   │
                             ┌─────────────────────▼─────────────────────┐
                             │ cpd-reporter (SARIF, JSON, Console, Badges│
                             └───────────────────────────────────────────┘
```

### Critical Architectural Boundaries
1. **Tokenization Boundary (`cpd-tokenizer` -> `cpd-core`)**: Raw byte streams are parsed per language grammar. Comments, whitespace, and explicitly ignored blocks (`TokenKind::Ignore`) are eliminated. Crucially, single-file components (Vue, Svelte, Astro) or Markdown documents undergo embedded block dissection, yielding disjoint lexical token streams tagged by sub-language rather than container format.
2. **Detection & Hashing Pipeline (`cpd-core::detect`, `cpd-core::hash`)**:
   - Token-level hashing: Individual tokens map to 64-bit hashes using `xxh3_64` combined with kind discriminants via XOR: `xxh3_64(token_bytes) ^ (kind_discriminant as u64)`.
   - Window rolling hash: Fixed-size windows ($N = \text{min\_tokens}$) use a polynomial rolling hash over a Fibonacci hashing constant base ($B = \text{0x9e3779b97f4a7c15}$):
     $$H_0 = \sum_{i=0}^{N-1} h_i \cdot B^{N-1-i} \pmod{2^{64}}$$
     Rolling transition from window $[i, i+N-1]$ to $[i+1, i+N]$:
     $$H_{i+1} = \left(H_i - h_i \cdot B^{N-1}\right) \cdot B + h_{i+N} \pmod{2^{64}}$$
   - Store abstraction: Trait and virtual method dispatches were eliminated; lookups route directly into `rustc_hash::FxHashMap<u64, Occurrence>`.
3. **Polyglot & Multi-Tenancy Boundary (`cpd-finder::orchestrate`)**: Formats are partitioned into disjoint parallel Rayon worker threads. A clone cannot cross format barriers in token mode, preventing false positive matches across syntactic paradigms (e.g., Python indentation vs. C-like braces), while Type-4 semantic checks run across format barriers via unified embedding spaces.
4. **Dead-Code Engine Boundary (`basta` -> `cpd-core::deadcode`)**: Independent AST walking resolves export/import link matrices. Findings report confidence penalization (e.g., deducting confidence when dynamic member access like `eval` or computed string access is present).

---

## 2. Net-New Universal Engineering Rules

### 1. Rolling Hash Precomputed Power Invariant
**RULE**:
When implementing polynomial rolling hashes over sliding windows of size $N$, the term $B^{N-1} \pmod{2^W}$ MUST be precomputed once per execution batch or format group and passed immutably into the rolling step. The rolling function MUST NEVER re-evaluate the power loop or compute $B^{N-1}$ dynamically on every sliding step.

**WHY**:
Computing $B^{N-1}$ naively inside the rolling step turns an $O(L)$ linear token scan over stream length $L$ into an $O(L \cdot N)$ compute trap. At scale ($10^6$ tokens, $N = 50$), this introduces $5 \cdot 10^7$ redundant wrapping 64-bit multiplications on the hottest CPU path, thrashing instruction pipelines and generating severe branch mispredictions.

**WHEN TO APPLY**:
Any rolling hash or sliding window pipeline (Rabin-Karp search, content-defined chunking like FastCDC, duplicate detection, network packet inspection) across all systems languages (Rust, C++, Zig, Go).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In cpd-core/src/hash.rs

pub const HASH_BASE: u64 = 0x9e3779b97f4a7c15;

/// Precompute BASE^(n-1) once before the sliding loop starts.
#[inline(always)]
pub fn base_pow(n: usize) -> u64 {
    let mut result = 1u64;
    for _ in 0..n {
        result = result.wrapping_mul(HASH_BASE);
    }
    result
}

/// O(1) rolling hash transition on hot path.
#[inline(always)]
pub fn roll(current: u64, outgoing: u64, incoming: u64, window_power: u64) -> u64 {
    current
        .wrapping_sub(outgoing.wrapping_mul(window_power))
        .wrapping_mul(HASH_BASE)
        .wrapping_add(incoming)
}

// Execution harness
pub fn scan_stream(tokens: &[u64], window_size: usize) {
    if tokens.len() < window_size { return; }
    
    // Invariant: Compute once per window configuration!
    let window_power = base_pow(window_size - 1);
    let mut current_hash = hash_window(&tokens[..window_size]);
    
    for i in 0..(tokens.len() - window_size) {
        let outgoing = tokens[i];
        let incoming = tokens[i + window_size];
        current_hash = roll(current_hash, outgoing, incoming, window_power);
        // Process current_hash...
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Recomputing window power on each roll inside the hot path.
pub fn roll_bad(current: u64, outgoing: u64, incoming: u64, window_size: usize) -> u64 {
    // VIOLATION: Recalculates power on every single token slide!
    let mut power = 1u64;
    for _ in 0..(window_size - 1) {
        power = power.wrapping_mul(HASH_BASE);
    }
    (current.wrapping_sub(outgoing.wrapping_mul(power)))
        .wrapping_mul(HASH_BASE)
        .wrapping_add(incoming)
}
```

**VERIFICATION METHOD**:
Enforce via unit tests and criterion benchmark validation checking that hash computation remains $O(1)$ per step regardless of window size $N$:
```rust
#[test]
fn verify_roll_matches_naive_recompute() {
    let stream = [10u64, 25u64, 99u64, 42u64, 88u64];
    let window_size = 3;
    let wp = base_pow(window_size - 1);
    let h0 = hash_window(&stream[0..3]);
    let rolled = roll(h0, stream[0], stream[3], wp);
    let expected = hash_window(&stream[1..4]);
    assert_eq!(rolled, expected, "Rolling step diverged from naive recomputation!");
}
```

---

### 2. Polyglot Disjoint Span Non-Overlap Invariant
**RULE**:
When blanking or parsing multi-range embedded segments (such as front-matter, fenced code blocks, templates, or inline scripts), coordinate bounds $[S_i, E_i)$ MUST be strictly sorted and validated for non-overlap ($E_i \le S_{i+1}$) BEFORE any string blanking or mutation occurs. Boundary extraction closures MUST NOT scan beyond enclosing syntactic block tokens into subsequent sibling blocks.

**WHY**:
If range markers overlap (e.g., front-matter scanner searching for a trailing `---` or `...` consumes fence markers inside a subsequent embedded code block), down-stream blanking operations (`blank_ranges_preserve_newlines`) encounter invalid range indices. In release configurations compiled with `panic = "abort"`, this terminates the entire host process (including IDE Language Servers and MCP Servers) with SIGABRT (exit code 134), destabilizing the agent workspace.

**WHEN TO APPLY**:
Lexers, template engines, and linters processing embedded polyglot files (Vue, Svelte, Markdown, Astro, HTML with JS/CSS, JSX/TSX).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Safe non-overlapping range validator and blanking engine
pub struct SourceRange {
    pub start: usize,
    pub end: usize,
}

pub fn blank_ranges_preserve_newlines(
    buffer: &mut String,
    ranges: &mut [SourceRange],
) -> Result<(), &'static str> {
    if ranges.is_empty() {
        return Ok(());
    }

    // Sort strictly by start offset
    ranges.sort_unstable_by_key(|r| r.start);

    // Verify non-overlapping invariant: end of range[i] <= start of range[i+1]
    for window in ranges.windows(2) {
        if window[0].end > window[1].start {
            return Err("Overlapping byte ranges detected in polyglot segmentation");
        }
    }

    let bytes = unsafe { buffer.as_bytes_mut() };
    for r in ranges.iter() {
        if r.end > bytes.len() {
            return Err("Range bounds exceed buffer length");
        }
        for byte in &mut bytes[r.start..r.end] {
            if *byte != b'\n' && *byte != b'\r' {
                *byte = b' ';
            }
        }
    }
    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Unchecked extraction of range boundaries that panic on overlap
pub fn naive_extract_and_blank(source: &mut String, open_tag: &str, close_tag: &str) {
    let mut ranges = Vec::new();
    // VIOLATION: Naive string matching can span across internal blocks,
    // creating overlapping or inverted spans.
    if let Some(s) = source.find(open_tag) {
        if let Some(e) = source[s..].find(close_tag) {
            ranges.push((s, s + e + close_tag.len()));
        }
    }
    // Panics in release with abort if ranges overlap:
    for (s, e) in ranges {
        assert!(s < e); // Invariant missing between sibling ranges!
    }
}
```

**VERIFICATION METHOD**:
Implement property-based testing using `proptest` or `quickcheck` asserting that arbitrary combinations of Markdown front-matter and fenced code blocks never generate overlapping ranges or trigger runtime panics:
```rust
#[test]
fn verify_front_matter_and_fences_never_overlap() {
    let doc = "---\nmeta: true\n```python\n...\n```\n---\nbody";
    // Parser must either treat Python fence as separate or fail gracefully without panicking
    let result = parse_markdown_spans(doc);
    assert!(result.is_ok(), "Segmentation threw panic on embedded delimiters");
}
```

---

### 3. Canonical Line-Ending Agnostic Content Fingerprinting
**RULE**:
When generating deterministic fingerprints or hashes of code fragments across disparate VCS trees or host platforms, all carriage returns (`\r`) MUST be stripped or normalized to `\n` prior to buffer assembly, and pair concatenations MUST incorporate an explicit non-text boundary separator byte (e.g., `\0`).

**WHY**:
Git checkouts across Linux and Windows default to different newline schemes based on `core.autocrlf`. If hashing raw file contents directly, identical code fragments checked out across differing platforms produce divergent hashes. Furthermore, concatenated hashes of two spans $A$ and $B$ without a null byte separator suffer from boundary collisions where $(A="ab", B="c")$ collides with $(A="a", B="bc")$.

**WHEN TO APPLY**:
Static analysis caching, baseline comparison (`--baseline-from-ref`), git history diffing, and cross-platform build artifacts.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In cpd-core/src/hash.rs

use xxhash_rust::xxh3::xxh3_64;
use std::borrow::Cow;

#[inline]
pub fn strip_cr(s: &str) -> Cow<'_, str> {
    if s.contains('\r') {
        Cow::Owned(s.replace('\r', ""))
    } else {
        Cow::Borrowed(s)
    }
}

pub fn snippet_pair_hash(a: &str, b: &str) -> u64 {
    let a_clean = strip_cr(a);
    let b_clean = strip_cr(b);
    
    // Canonical order-independent sorting
    let (first, second) = if a_clean <= b_clean {
        (&a_clean, &b_clean)
    } else {
        (&b_clean, &a_clean)
    };

    let mut buf = Vec::with_capacity(first.len() + second.len() + 1);
    buf.extend_from_slice(first.as_bytes());
    buf.push(0); // Invariant: separator avoids boundary collision
    buf.extend_from_slice(second.as_bytes());
    
    xxh3_64(&buf)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Direct hashing without newline stripping or delimiter injection
pub fn naive_snippet_hash(a: &str, b: &str) -> u64 {
    let mut combined = String::new();
    // VIOLATION 1: CRLF vs LF divergence breaks CI baseline checks on Windows.
    // VIOLATION 2: ("foo", "barbaz") yields "foobarbaz", exactly like ("foobar", "baz")!
    combined.push_str(a);
    combined.push_str(b);
    xxhash_rust::xxh3::xxh3_64(combined.as_bytes())
}
```

**VERIFICATION METHOD**:
Execute deterministic property tests verifying order-insensitivity, CRLF/LF invariance, and boundary collision prevention:
```rust
#[test]
fn verify_fingerprint_invariants() {
    let h_lf = snippet_pair_hash("fn main() {\n}\n", "let x = 1;\n");
    let h_crlf = snippet_pair_hash("fn main() {\r\n}\r\n", "let x = 1;\r\n");
    let h_rev = snippet_pair_hash("let x = 1;\n", "fn main() {\n}\n");
    
    assert_eq!(h_lf, h_crlf, "CRLF and LF produced divergent fingerprints");
    assert_eq!(h_lf, h_rev, "Fragment ordering produced divergent fingerprints");
    assert_ne!(snippet_pair_hash("ab", "c"), snippet_pair_hash("a", "bc"));
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Markdown Front-Matter Code-Fence Parser Overlap Crash (BUG-JSCPD-01)
- **Context**: Subsystem `cpd-tokenizer/src/markdown.rs` and `cpd-tokenizer/src/embedded.rs`
- **What Was Expected**: A Markdown document containing a horizontal rule (`---`) followed by a Python code block containing an ellipsis stub (`...`) must parse cleanly, blanking front-matter and fenced code blocks independently.
- **What Actually Happened**: The front-matter boundary detection logic interpreted `...` inside the Python code block as the YAML front-matter terminator (`front_matter_closer`). This stretched the front-matter span across byte offsets $[0, 122)$, directly overlapping the Python code fence span $[39, 126)$. When passed to `blank_ranges_preserve_newlines`, the assertion failed:
  ```
  thread '<unnamed>' panicked at crates/cpd-tokenizer/src/embedded.rs:50:13:
  overlapping ranges detected: [0, 122) overlaps [39, 126)
  Aborted (core dumped)
  ```
  Because the release profile defined `panic = "abort"`, the entire MCP server and LSP process crashed immediately with exit code 134 upon startup.
- **Evidence in Repo**: Issue #1223, `crates/cpd-tokenizer/src/markdown.rs:163-190`, `crates/cpd-tokenizer/src/embedded.rs:44-50`.
- **Root Cause**: `front_matter_closer` lacked syntax context isolation; it naively matched lines matching `---` or `...` anywhere downstream without checking whether an opening code fence (e.g., ` ```python `) had commenced prior to the delimiter.
- **Remediation Code Diff**:
```rust
// crates/cpd-tokenizer/src/markdown.rs
// - Naive line search:
//   fn front_matter_closer(lines: &[&str]) -> Option<usize> {
//       lines.iter().position(|l| {
//           let t = l.trim();
//           t == "---" || t == "..."
//       })
//   }
// + Syntax-isolated boundary guard:
pub fn extract_front_matter_safe(input: &str) -> Option<(usize, usize)> {
    if !input.starts_with("---") {
        return None;
    }
    let mut offset = 3;
    for line in input[3..].lines() {
        let trimmed = line.trim();
        // If a code fence starts before front matter terminates, it is not front matter!
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            return None;
        }
        if trimmed == "---" || trimmed == "..." {
            return Some((0, offset + line.len()));
        }
        offset += line.len() + 1;
    }
    None
}
```
- **Lesson**: Parsing multi-language embedded documents cannot rely on decoupled regex or token scanners; delimiter extractors must implement strict nesting state machines to prevent cross-block corruption.

---

### Incident 2: Single-File Component (SFC) Polyglot Token Disconnect in MCP (BUG-JSCPD-02)
- **Context**: Subsystem `cpd/src/mcp/project.rs` and `cpd-finder/src/orchestrate.rs`
- **What Was Expected**: Calling the MCP tool `check_duplication` with a Vue (`cart.vue`), Svelte, or Astro snippet containing TypeScript must match against existing TypeScript code within the project.
- **What Actually Happened**: The MCP tool returned count `0` duplicates for `.vue`/`.svelte` inputs. An automated coding agent calling `check_duplication` assumed no identical logic existed and proceeded to generate duplicate code.
- **Evidence in Repo**: Closed Bug Issue #1224; `crates/cpd/src/mcp/project.rs:708-742`, `crates/cpd-finder/src/orchestrate.rs:564`.
- **Root Cause**: The MCP `Project::check` routine tokenized the input snippet under format `"vue"`. However, during repository indexing, `FilePreparer::prepare` decomposed single-file components into multiple discrete sources segmented by block language (`typescript`, `html`, `css`). No indexed source existed under format `"vue"`. When `Project::check` attempted to match against the token pool of format `"vue"`, the lookup yielded an empty set.
- **Remediation Code Diff**:
```rust
// crates/cpd/src/mcp/project.rs
// - Naive tokenization by container format:
//   let tokens = tokenizer::tokenize(snippet, format)?;
//   let matches = pool.get(format).find_clones(&tokens);
// + Dissect container format into constituent blocks prior to pool lookup:
pub fn check_snippet_duplication(snippet: &str, format: &str, pool: &TokenPool) -> Result<Vec<Match>, Error> {
    let prepared_blocks = match format {
        "vue" | "svelte" | "astro" => {
            cpd_tokenizer::extract_embedded_blocks(snippet, format)?
        }
        _ => vec![(format.to_string(), snippet.to_string())],
    };

    let mut results = Vec::new();
    for (block_lang, code) in prepared_blocks {
        if let Some(lang_pool) = pool.get(&block_lang) {
            let tokens = cpd_tokenizer::tokenize(&code, &block_lang)?;
            results.extend(lang_pool.find_clones(&tokens));
        }
    }
    Ok(results)
}
```
- **Lesson**: Virtual query inputs sent to analysis agents must undergo identical normalization and polyglot decomposition passes as the persistent repository index.

---

### Incident 3: emSign Compromised Intermediate CA Vulnerability in Cargo.lock (BUG-JSCPD-03)
- **Context**: Subsystem `rust/Cargo.lock` (indirect dependency via `cpd-semantic -> ureq -> rustls`)
- **What Was Expected**: Nightly vulnerability audits (`cargo audit` / `cargo deny`) must pass cleanly without vulnerable cryptographic certificate validation paths.
- **What Actually Happened**: Nightly CI audits triggered security alerts #1233, #1234, #1235 for advisories `RUSTSEC-2026-0381`, `RUSTSEC-2026-0382`, and `RUSTSEC-2026-0383`. Private keys of emSign intermediate CAs were publicly exposed, allowing attackers to perform Man-in-the-Middle (MITM) attacks against HTTPS connections initiated by `cpd-semantic` when downloading ONNX model weights.
- **Evidence in Repo**: Production Commit `b8c7deda`, PR #1236, modified `rust/Cargo.lock`.
- **Root Cause**: `webpki-roots` version `1.0.9` contained the compromised "emSign ECC Root CA - G3" trust anchor, and `rustls-webpki` version `0.103.15` failed to explicitly revoke the affected intermediate key hashes.
- **Remediation Code Diff**:
```toml
# rust/Cargo.lock
 [[package]]
 name = "rustls-webpki"
-version = "0.103.15"
-checksum = "f3c3cf1d8b1e7d4927e2d154c3fcb02979afb9939629c62cd9048d4f07b60ac2"
+version = "0.103.16"
+checksum = "4443b1b6d39d7c663139942cc4558262562d2c84123bb6282ef177009ca8b281"

 [[package]]
 name = "webpki-root-certs"
-version = "1.0.9"
-checksum = "b96554aa2acc8ccdb7e1c9a58a7a68dd5d13bccc69cd124cb09406db612a1c9b"
+version = "1.0.10"
+checksum = "58ec80e73fd8baf57bf0d9615554c75348bda990d6d5bbeab964dd068319fecb"

 [[package]]
 name = "webpki-roots"
-version = "1.0.9"
-checksum = "7dcd9d09a39985f5344844e66b0c530a33843579125f23e21e9f0f220850f22a"
+version = "1.0.10"
+checksum = "1c1c8e20c8a38fc7d65abfe74eb7280e4aa667e8eec8bc84996d2874810748d9"
```
- **Lesson**: Automated static tools executing remote model or asset fetches (`--semantic-download`) must continuously audit transitive TLS trust-store crates, as compromised certificate roots bypass TLS transport authentication.

---

### Incident 4: Git Baseline Invalidation via CRLF/LF Line-Ending Variance (BUG-JSCPD-04)
- **Context**: Subsystem `rust/crates/cpd-core/src/hash.rs:snippet_pair_hash`
- **What Was Expected**: When running with `--baseline-from-ref <git-ref>`, unmodified code clones present in both the baseline commit and working tree must be identified as existing (`is_new = false`), suppressing duplicate alerts.
- **What Actually Happened**: On Windows environments with `git config core.autocrlf true`, `jscpd --baseline-from-ref` reported 100% of clones as "new" clones, failing CI thresholds despite zero code changes.
- **Evidence in Repo**: `rust/crates/cpd-core/src/hash.rs:36-47` and inline architectural comments.
- **Root Cause**: The temporary worktree checked out by git used Windows CRLF line endings (`\r\n`), whereas the scanned working tree files had been formatted or checked out with LF (`\n`). Raw string hashing hashed the `\r` bytes, generating mismatched xxHash fingerprints.
- **Remediation Code Diff**:
```rust
// rust/crates/cpd-core/src/hash.rs
// - Direct hashing without CR stripping:
//   let (first, second) = if a <= b { (a, b) } else { (b, a) };
//   let mut buf = Vec::new();
//   buf.extend_from_slice(first.as_bytes());
//   buf.extend_from_slice(second.as_bytes());
//   xxh3_64(&buf)
// + Line ending agnostic normalization with zero-allocation Cow path:
pub fn snippet_pair_hash(a: &str, b: &str) -> u64 {
    let a = strip_cr(a);
    let b = strip_cr(b);
    let (first, second) = if a <= b { (&a, &b) } else { (&b, &a) };
    let mut buf = Vec::with_capacity(first.len() + second.len() + 1);
    buf.extend_from_slice(first.as_bytes());
    buf.push(0); // Separator prevents ("ab","c") == ("a","bc")
    buf.extend_from_slice(second.as_bytes());
    xxh3_64(&buf)
}

fn strip_cr(s: &str) -> std::borrow::Cow<'_, str> {
    if s.contains('\r') {
        std::borrow::Cow::Owned(s.replace('\r', ""))
    } else {
        std::borrow::Cow::Borrowed(s)
    }
}
```
- **Lesson**: Cross-commit and cross-environment static analysis fingerprinting must treat carriage returns as ephemeral transport artifacts and strip them before cryptographic hashing.

---

### Incident 5: Symlink Virtual Walk Invalidation Under `--skip-isolated` (BUG-JSCPD-05)
- **Context**: Subsystem `rust/crates/cpd-core/src/detect.rs:PreparedSource`
- **What Was Expected**: In monorepos utilizing symlinked directory trees (e.g., `packages/app/shared -> ../../shared`), `--skip-isolated` must recognize that files discovered via symlinks belong to the shared group folder.
- **What Actually Happened**: When walking via symlinks, `PreparedSource.id` recorded the symlinked path. When evaluating directory isolation, the paths failed equality checks against the group root, resulting in shared files being discarded as "isolated".
- **Evidence in Repo**: Issue #1059; `PreparedSource::real_path`, `PreparedSource::filter_path` in `rust/crates/cpd-core/src/detect.rs`.
- **Root Cause**: The detector relied exclusively on the lexical discovery path (`id`) without maintaining the resolved physical path (`real_path`) on disk.
- **Remediation Code Diff**:
```rust
// rust/crates/cpd-core/src/detect.rs
pub struct PreparedSource {
    pub id: String,
    pub format: String,
    pub hashes: Vec<u64>,
    pub spans: Vec<(Location, Location)>,
    pub raw_hashes: Vec<u64>,
    pub renames: Renames,
    pub real_path: String, // Resolved filesystem canonical path
    pub embedded: bool,
}

impl PreparedSource {
    /// Return the canonical path when resolving symlinks, otherwise discovery ID.
    pub fn filter_path(&self) -> &str {
        if self.real_path.is_empty() {
            &self.id
        } else {
            &self.real_path
        }
    }
}
```
- **Lesson**: File walkers must bifurcate virtual presentation paths (used for reports and IDE diagnostics) from resolved canonical storage paths (used for boundary checking and isolation filters).

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Operator Precedence in Token Hashing**: In `cpd-core/src/hash.rs`, combining hash tokens requires explicit casting and wrapping arithmetic:
  ```rust
  // CORRECT: Parenthesized bitwise XOR with explicit discriminant cast
  xxh3_64(value.as_bytes()) ^ (kind as u64)
  
  // HAZARD: Omitting explicit typing can trigger implicit integer widening bugs
  // or signed integer overflow if mapped to signed primitives in FFI