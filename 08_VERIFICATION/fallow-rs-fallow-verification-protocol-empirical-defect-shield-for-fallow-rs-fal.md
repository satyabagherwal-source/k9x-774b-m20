# Verification Protocol: Verification Protocol: Empirical Defect Shield for fallow-rs/fallow

<!-- PROVENANCE_START
{
  "source_repository": "fallow-rs/fallow",
  "source_url": "https://github.com/fallow-rs/fallow",
  "source_version": "202f6188",
  "license": "MIT",
  "timestamp": "2026-11-20T01:22:58.736Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-fallow-rs-fallow",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fallow-rs/fallow](https://github.com/fallow-rs/fallow) (Revision: `202f6188`).  
> **License**: MIT | **Timestamp**: `2026-11-20T01:22:58.736Z`  
> **Learning ID**: `learn-github-fallow-rs-fallow`


## 1. Scope & Verification Target
- **Target Repository**: `fallow-rs/fallow` (Commit: `202f6188`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Project Learning Record (Full-Spectrum Forensic Harvest): fallow-rs/fallow

---

## 1. Executive Forensic Architecture & System Mechanics

`fallow-rs/fallow` is a high-performance static analysis, codebase intelligence, and architectural conformance engine implemented in Rust for JavaScript, TypeScript, CSS, and Single File Components (Vue/Svelte/Astro). It provides monolithic code health analysis, dead-code elimination, clone/duplication detection, circular dependency tracing, and automated AST/CST code-fixing without requiring the official TypeScript compiler (`tsc`) or Node.js runtime.

### Architectural Boundaries & Subsystems

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CLI / Agent Entrypoints                               │
│      fallow CLI (clap)  │  fallow-lsp  │  MCP Server  │  Pre-Tool Hooks     │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       crates/engine (Coordinator)                           │
│  Session Cache  │ Baseline Engine │ Module Graph │ Search Visibility │ Fix  │
└───────┬─────────────────────────┴───────────────────────────────────┬───────┘
        │                                                             │
        ▼                                                             ▼
┌───────────────────────────────────┐             ┌───────────────────────────┐
│       crates/extract              │             │       crates/graph        │
│ Oxc AST / Semantic Visitor        │             │ FixedBitSet Reachability  │
│ cssparser / lightningcss Pre-walk │             │ Tarjan SCC Cycle Tracing  │
│ SFC Script & Template Merger      │             │ Import/Export Linker      │
└───────────────────────────────────┘             └───────────────────────────┘
```

1. **`crates/extract` (Syntax & Entity Harvester)**:
   - Uses `oxc_parser` and `oxc_semantic` (pinned to `0.158`) for AST generation and symbol resolution.
   - Embeds `lightningcss` (`=1.0.0-alpha.72`) and `cssparser` (`=0.37.0`) for CSS AST parsing.
   - Employs a pre-lexical fast-scanner (`Scanner` in `nesting.rs` and `style_tokens.rs`) to bound recursion depth and abort hazardous inputs before third-party parsers are invoked.

2. **`crates/graph` (Topology & Dependency Engine)**:
   - Maintains directional module and symbol dependency graphs using indexed bitsets (`FixedBitSet`) and directed graphs.
   - Computes strongly connected components (SCCs) via Tarjan's algorithm for circular dependency detection.
   - Evaluates reachability boundaries across monorepo workspace packages, package boundaries, and export barriers.

3. **`crates/engine` (Analysis & Baseline Engine)**:
   - Coordinates incremental analysis pipelines over parallel rayon worker pools.
   - Implements multi-dimensional health scoring (Cyclomatic complexity, Cognitive complexity, CRAP index, file line length).
   - Manages persistent baselines with strict slot accounting to prevent bug-masking regressions.

4. **`crates/cli/src/fix` (Surgical Code Remediation)**:
   - Executes multi-pass CST/textual re-writing.
   - Links export removals with dependency reference counts to prune dangling import specifiers and orphaned import statements atomically.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Pre-Tokenization Guarding of External Untrusted Parsers
**RULE**:
When feeding untrusted or generated input into third-party parsers compiled with `panic = "abort"` or lacking recursion/complexity bounds, the caller MUST perform a fast, pre-lexical scan to prove that input invariants hold (e.g., nesting depth $\le N$, balanced delimiter tokens, valid domain reductions) before handing input to the structural parser.

**WHY**:
Third-party parsers (such as `lightningcss` or native AST parsers) frequently make algebraic assumptions (e.g., `Percentage::parse` assuming CSS math expressions evaluate strictly to `<percentage>`) or exhibit exponential backtracking $O(2^d)$ on deeply nested functions. Under `panic = "abort"`, any unhandled panic or recursion crash in the parser terminates the entire host process without salvageable diagnostic output.

**WHEN TO APPLY**:
Static analysis tools, language servers, CI/CD linters, and compiler front-ends ingesting user-authored or fuzz-generated CSS, HTML, JSX, or AST fragments.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use cssparser::{Parser, ParserInput};

/// Enforce safety boundary on CSS parsing
pub fn parse_style_bounded<R: Send>(
    source: &str, 
    parse: impl FnOnce() -> R + Send
) -> Option<R> {
    const MAX_NESTING_DEPTH: u32 = 1024;
    const MAX_COLOR_FUNCTION_DEPTH: usize = 8;
    const MAX_MATH_FUNCTION_DEPTH: usize = 6;

    // Phase 1: Bounded lightweight structural scan
    let scan = scan_depth(source, MAX_NESTING_DEPTH, Dialect::Style);
    if scan.max_colors > MAX_COLOR_FUNCTION_DEPTH || scan.max_depth > MAX_NESTING_DEPTH {
        return None;
    }

    // Phase 2: Token-level invariant pre-validation via cssparser
    run_bounded(source, scan.max_depth, || {
        if !style_parse_is_safe(source) {
            return None;
        }
        Some(parse())
    }).flatten()
}

pub fn style_parse_is_safe(source: &str) -> bool {
    if !may_open_checked_function(source) {
        return true;
    }
    let mut input = ParserInput::new(source);
    let mut parser = Parser::new(&mut input);
    walk_css_tokens(&mut parser, Context::default()).is_ok()
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER invoke third-party parsers directly on untrusted inputs
// when the binary compiles with panic = "abort".
pub fn parse_style_unsafe<R>(source: &str, parse: impl FnOnce() -> R) -> R {
    // BUG: If lightningcss panics or recurses 2000 times on calc(calc(...)),
    // the whole process aborts immediately, taking down CI/LSP.
    parse()
}
```

**VERIFICATION METHOD**:
Fuzz test with malformed expressions (`opacity: max(4%, 5)`, `color: lab(max(4, nan) 1 1)`) and verify that `parse_style_bounded` returns `None` instead of aborting the test runner process.

---

### 2. Dimensionally Isolated Baseline Slot Accounting
**RULE**:
A baseline tracking system MUST maintain strict orthogonal dimension boundaries for finding categories and MUST NOT aggregate findings of differing semantics (e.g., file-length violations vs. function-complexity violations) into shared severity buckets.

**WHY**:
If findings from different architectural dimensions share a generic bucket (e.g., `complexity_moderate`), fixing a violation in one dimension (e.g., refactoring a complex function) frees up a slot that can be silently consumed by an introduced defect in another dimension (e.g., an oversized file exceeding line-count thresholds). This invalidates CI/CD regression gates.

**WHEN TO APPLY**:
Audit baselines, linters, static code metrics, and static quality gates supporting ratchet/shrink-only baseline enforcement.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HealthFindingDimension {
    Complexity,
    Crap,
    FileLength,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct HealthFindingCategory {
    pub dimension: HealthFindingDimension,
    pub severity: FindingSeverity,
}

impl HealthFindingCategory {
    pub const fn key(self) -> &'static str {
        match (self.dimension, self.severity) {
            (HealthFindingDimension::Complexity, FindingSeverity::Moderate) => "complexity_moderate",
            (HealthFindingDimension::Complexity, FindingSeverity::High) => "complexity_high",
            (HealthFindingDimension::Complexity, FindingSeverity::Critical) => "complexity_critical",
            (HealthFindingDimension::Crap, FindingSeverity::Moderate) => "crap_moderate",
            (HealthFindingDimension::Crap, FindingSeverity::High) => "crap_high",
            (HealthFindingDimension::Crap, FindingSeverity::Critical) => "crap_critical",
            (HealthFindingDimension::FileLength, FindingSeverity::Moderate) => "file_lines_moderate",
            (HealthFindingDimension::FileLength, FindingSeverity::High) => "file_lines_high",
            (HealthFindingDimension::FileLength, FindingSeverity::Critical) => "file_lines_critical",
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER collapse heterogeneous violations into a single dimension
fn map_finding_to_bucket(finding: &Finding) -> &'static str {
    // ANTI-PATTERN: File lines categorized as cyclomatic/cognitive complexity!
    // Fixing a complex function frees a slot for a runaway 5000-line file.
    match finding.severity {
        Severity::Moderate => "complexity_moderate",
        Severity::High => "complexity_high",
    }
}
```

**VERIFICATION METHOD**:
Construct a baseline test fixture containing one complex function and zero file-length findings. In the next iteration, assert that fixing the function while simultaneously introducing a file crossing `maxFileLines` results in an `introduced: true` violation.

---

### 3. Cascading Clean-up Invariants for Automated Refactoring Edits
**RULE**:
When an automated code-fixer removes a symbol from an export specifier list (`export { a, b }`), it MUST track the removed local name, compute the total intra-file reference count for that identifier, and atomically prune the associated `import` declaration if and only if all intra-file usages were exhausted by the removed export specifier.

**WHY**:
Export-list re-exports (`import { a } from './a'; export { a };`) bind local identifier references. If an automated fix removes `a` from the export list but leaves the `import`, the symbol becomes an unused local import. Subsequent dead-code passes will treat the origin export in `./a` as unreferenced, prune `./a`, and leave the kept import dangling, causing TypeScript compile failures `TS2306` ("Module has no exported member") or `TS2459`.

**WHEN TO APPLY**:
AST/CST automated refactoring tools, dead-code removers, and tree-shakers performing surgical text edits on ECMAScript/TypeScript source code.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub fn plan_import_removals(
    path: &Path,
    content: &str,
    line_ending: &str,
    removed_references: &FxHashMap<String, usize>,
) -> Vec<ImportRemoval> {
    if removed_references.is_empty() {
        return Vec::new();
    }
    let Some(found) = import_bindings(path, content) else {
        return Vec::new();
    };
    let line_starts = compute_line_starts(content, line_ending);

    found.declarations.iter().filter_map(|declaration| {
        let removable: Vec<bool> = declaration.bindings.iter().map(|binding| {
            removed_references.get(&binding.local).is_some_and(|removed_count| {
                // Invariant: Prune import ONLY when all references in the module
                // were accounted for by the pruned export list entries.
                found.reference_counts.get(&binding.local) == Some(removed_count)
            })
        }).collect();

        if !removable.contains(&true) {
            return None;
        }

        plan_declaration(content, line_ending, &line_starts, declaration, &removable)
    }).collect()
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER delete export specifiers in isolation without resolving binding consumers
pub fn remove_export_specifiers(content: &mut String, to_remove: &[String]) {
    // ANTI-PATTERN: Deleting export { a } leaves `import { a } from './a'` in place.
    // The next lint/fix run deletes `export function a() {}` from './a.ts',
    // which breaks the build with TS2306.
    regex_replace(content, r"export\s*\{\s*a\s*\}", "");
}
```

**VERIFICATION METHOD**:
Execute end-to-end integration test with a barrel export pattern:
`index.ts -> barrel.ts (import { a } from './a'; export { a, b }) -> a.ts`.
Prune `a` from `index.ts`. Run fix pass 1, then fix pass 2. Verify `tsc` or `oxc` type-checking succeeds without `TS2306` or `TS2459`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Parser Panic on Unreduced CSS Math in Percentage Contexts (BUG-FAL-01)
- **Context**: `crates/extract/src/nesting.rs`, `crates/extract/src/style_tokens.rs`, `Cargo.toml`.
- **What Was Expected**: `fallow dead-code` and `fallow health --css` must parse arbitrary user stylesheets safely, degrade gracefully on unparseable CSS, and never abort execution.
- **What Actually Happened**: `lightningcss 1.0.0-alpha.72` panicked in `Percentage::parse` when CSS math functions like `max(4%, 5)`, `abs(4%)`, or `color: lab(max(4, nan) 1 1)` failed to reduce to a single percentage in properties requiring percentage types. Because Fallow compiles with `panic = "abort"`, OSS-Fuzz caught panics that crashed the entire tool.
- **Evidence in Repo**: Commit `c8202504`, PR `#4804`, unit test `a_math_function_that_panics_the_css_parser_skips_it`.
- **Root Cause**: `lightningcss` makes an invariant assumption during AST construction that math expressions inside properties expecting `<percentage>` are reducible to a single `<percentage>` value. When reduction fails or yields mixed units/NaN, it triggers `panic!()`.
- **Remediation Code Diff**:
```rust
// crates/extract/src/nesting.rs
-    run_bounded(source, scan.max_depth, parse)
+    run_bounded(source, scan.max_depth, || {
+        crate::style_tokens::style_parse_is_safe(source).then(parse)
+    })
+    .flatten()
```
- **Lesson**: Parsers compiled with `panic = "abort"` must be guarded by a token-level pre-validation phase that mirrors the parser's tokenizer (`cssparser`) to detect panic triggers before invoking AST construction.

---

### Incident 2: Health Baseline Finding Slot Cannibalization (BUG-FAL-02)
- **Context**: `crates/engine/src/baseline/mod.rs`, `crates/engine/src/baseline/health_categories.rs`, `crates/engine/src/baseline_growth.rs`.
- **What Was Expected**: When a developer fixes a high-complexity function in a file, a newly introduced violation where the file exceeds `health.maxFileLines` must be reported as `introduced: true`.
- **What Actually Happened**: The count-mode baseline placed both function complexity violations and file-length violations into the generic category `complexity_<severity>`. When a function was fixed, its saved slot in the baseline became available. A file exceeding `health.maxFileLines` occupied that slot, hiding the violation from CI.
- **Evidence in Repo**: Commit `830c2dc2`, Issue `#4808`, PR `#4808`.
- **Root Cause**: Metric category conflation. The code lacked structural typing for finding dimensions, treating `ExceededThreshold::FileLines` identically to `ExceededThreshold::Cyclomatic` within baseline tally maps.
- **Remediation Code Diff**:
```rust
// crates/engine/src/baseline/health_categories.rs
+    if finding.exceeded.is_file_lines() {
+        let dimension = match counting {
+            FileLengthCounting::Separate => HealthFindingDimension::FileLength,
+            FileLengthCounting::AsComplexity => HealthFindingDimension::Complexity,
+        };
+        return [Some(category(dimension)), None];
+    }
```
- **Lesson**: Baseline tracking engines must isolate orthogonal quality dimensions into non-fungible categories to prevent defect substitution.

---

### Incident 3: Orphaned Import Cascade in Automated Export Removal (BUG-FAL-03)
- **Context**: `crates/cli/src/fix/export_list.rs`, `crates/cli/src/fix/exports.rs`, `crates/cli/src/fix/list_imports.rs`.
- **What Was Expected**: Running `fallow fix` on an unused re-export from a barrel file must remove both the export specifier and the underlying import if the symbol is not used elsewhere in the file.
- **What Actually Happened**: `fallow fix` pruned `a` from `export { a, used }`, but left `import { a } from './a'`. In the subsequent run, because `fallow` does not count an unreferenced local import as an active consumer, it removed `export function a` from `./a.ts`. The remaining import in the barrel file then failed the TypeScript compiler with `TS2306` / `TS2459`.
- **Evidence in Repo**: Commit `202f6188`, Issue `#4833`, PR `#4859`.
- **Root Cause**: Non-atomic multi-file fixing. The fixer operated as a local statement rewrite rather than maintaining global binding lifecycle invariants.
- **Remediation Code Diff**:
```rust
// crates/cli/src/fix/export_list.rs
+    for (spec, _) in specifiers.iter().zip(&matched).filter(|(_, m)| **m) {
+        if !removed.contains(&spec.name) {
+            removed.push(spec.name.clone());
+        }
+        if !parsed.list.has_source {
+            removed_locals.push(spec.local.clone());
+        }
+    }
```
```rust
// crates/cli/src/fix/list_imports.rs
+    let removable: Vec<bool> = declaration.bindings.iter().map(|binding| {
+        removed_references.get(&binding.local).is_some_and(|removed| {
+            found.reference_counts.get(&binding.local) == Some(removed)
+        })
+    }).collect();
```
- **Lesson**: Refactoring tools that delete symbol exports must trace intra-file symbol references and garbage-collect corresponding import bindings in the same atomic transaction.

---

### Incident 4: Workspace Link Boundary Escape in Ephemeral Worktrees (BUG-FAL-04)
- **Context**: `crates/graph/src/resolver.rs`, `crates/engine/src/audit.rs`.
- **What Was Expected**: `fallow audit --base HEAD~1` executed in a temporary git worktree must resolve monorepo packages to their base-worktree equivalents so inherited findings remain marked `introduced: false`.
- **What Actually Happened**: Monorepo symlinks in `node_modules/@acme/lib` pointed outside the temporary base worktree directly into the active working tree (`../../packages/lib`). The resolver marked these packages as external npm dependencies rather than internal monorepo workspace packages. The dependency edge was dropped in the base snapshot, causing existing circular dependencies and boundary violations to appear as newly introduced in the PR.
- **Evidence in Repo**: Issue `#4807`.
- **Root Cause**: Naive symlink resolution (`std::fs::canonicalize`) escaping the target worktree root boundary, breaking relative containment invariants.
- **Remediation Code Diff**:
```rust
// Resolution logic adjusted to re-anchor resolved paths against project root
if resolved_path.starts_with(&external_checkout_root) {
    let relative = resolved_path.strip_prefix(&external_checkout_root).unwrap();
    let reanchored = target_worktree_root.join(relative);
    if reanchored.exists() {
        return reanchored;
    }
}
```
- **Lesson**: Multi-worktree analysis engines must intercept path canonicalization and virtualize symlink targets within the active analysis worktree boundary.

---

### Incident 5: Exponential Parsing Hang via Nested CSS Functions and Unterminated Strings (BUG-FAL-05)
- **Context**: `crates/extract/src/nesting.rs`, `crates/extract/src/style_tokens.rs`.
- **What Was Expected**: The parser must process complex CSS in linear time $O(N)$ and reject malicious payloads without resource exhaustion.
- **What Actually Happened**: Highly nested CSS functions like `calc(calc(...))` caused parse times in `lightningcss` to double with each level of nesting ($O(2^d)$). Furthermore, an unterminated string containing `/*` obscured nesting depth calculations, causing parser stack overflows.
- **Evidence in Repo**: Commit `c8202504`, PR `#4804`.
- **Root Cause**: Exponential backtracking in CSS grammar parsing when type inference on nested expressions fails, combined with string tokenizer divergence between the depth pre-scanner and the CSS specification.
- **Remediation Code Diff**:
```rust
// crates/extract/src/nesting.rs
+    /// Ends the innermost stylesheet block when `closer` matches it. In CSS
+    /// only the matching byte ends a block, so a `}` inside an open `(` is a
+    /// plain token.
+    fn close_style_block(&mut self, closer: u8) -> bool {
+        if self.style_closers.last() != Some(&closer) {
+            return false;
+        }
+        self.style_closers.pop();
+        true
+    }
```
- **Lesson**: Lightweight depth estimators must emulate CSS parsing rules (such as delimiter neutrality inside parentheses) to prevent discrepancies that hide nesting depth.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Operator Precedence Hazards & Logical Assignment**:
  In JS runtime hooks (`child-hooks.mjs`), short-circuit logical assignment operators must be used with careful awareness of intermediate states:
  ```javascript
  // INVARIANT: In JS runtime hooks, overlap must stick once true
  running += 1;
  overlap ||= running > 1; // Correct: once true, never flips back to false
  ```
  In Rust, token matching must avoid accidental shadowing and enforce exact byte checks:
  ```rust
  // INVARIANT: Matching CSS identifier bytes vs Unicode escapes
  const fn is_name_byte(byte: u8) -> bool {
      byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_') || byte >= 0x80
  }
  ```
- **CSS String Token Boundaries vs Script Strings**:
  In ECMAScript, an unescaped newline inside a single- or double-quoted string is an early syntax error. In CSS, an unclosed quote that hits an unescaped newline ends a *bad-string token* (`cssparser::Token::BadString`) and the tokenizer continues parsing subsequent tokens:
  ```rust
  // INVARIANT: CSS tokenizer terminates bad-strings at newline
  b'\n' | b'\r' if self.dialect == Dialect::Style => {
      self.in_string = false; // String is closed by newline, not multiline
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **Parser Depth Caps & Memory Safety**:
  Static analysis engines must bound stack growth explicitly rather than relying on OS-level thread stacks:
  ```rust
  pub const MAX_NESTING_DEPTH: u32 = 1024;
  pub const MAX_COLOR_FUNCTION_DEPTH: usize = 8;
  pub const MAX_MATH_FUNCTION_DEPTH: usize = 6;
  const ATAN2_LEVELS: usize = 3; // atan2 tests 5 branches, weights 3x
  ```
- **Circular Reference & Dependency Trapping**:
  Cycle detection must use an indexed Tarjan SCC implementation over dense arrays rather than recursion:
  ```rust
  // Termination Invariant: visited set is monotonic; depth strictly increments.
  if depth > MAX_RECURSION_LIMIT {
      return Err(AnalysisError::RecursionLimitExceeded);
  }
  ```

### 3. UI & UX Micro-Mechanics (CLI & Terminal Invariants)
- **Bounded Stream Emission & Microtask Flooding**:
  When driving child processes in agentic loops, unbounded stdout emission floods agent context windows and starves event loops:
  ```python
  # .claude/hooks/pre-bash-guard.py
  CARGO_NOISY = {"build", "test", "clippy", "doc"}
  BOUNDING_PAGERS = {"tail", "head", "less", "more", "wc", "grep", "rg"}

  def output_is_bounded(command: str, commands: list[list[str]]) -> bool:
      if ">" in command:
          return True
      last = commands[-1]
      return Path(last[0]).name in BOUNDING_PAGERS
  ```
- **Control Character Stripping**:
  CLI output intended for agent ingestion must strip terminal control codes, carriage returns, and line separator runes:
  ```rust
  // crates/cli/src/cli_hooks/hook_runtime.rs
  fn clean(value: &str) -> String {
      let mut result = String::new();
      let mut in_control_run = false;
      for character in value.chars() {
          let control = character.is_control() || matches!(character, '\u{2028}' | '\u{2029}');
          if control {
              if !in_control_run { result.push(' '); }
          } else {
              result.push(character);
          }
          in_control_run = control;
      }
      result
  }
  ```

### 4. Backend Concurrency & Memory Safety
- **Worker State Pollution Detection**:
  In long-lived test runners (`worker-state.mjs`), mutations across process executions must be detected by taking snapshot diffs across native prototypes and environments:
  ```javascript
  // crates/api/src/mutation/companion/runtime/worker-state.mjs
  const descriptors = (target) =>
    new Map(
      Reflect.ownKeys(target).map((key) => [
        key,
        Reflect.getOwnPropertyDescriptor(target, key),
      ]),
    );

  export const captureWorkerState = () => ({
    globals: descriptors(globalThis),
    prototypes: PROTOTYPES.map((type) => descriptors(type.prototype)),
    env: envText(),
    listeners: listenerCounts(),
    cwd: safe(() => globalThis.process?.cwd(), null),
    exitCode: globalThis.process?.exitCode,
    timers: activeTimers(),
  });
  ```
- **TOCTOU Race Condition Prevention during Code Fixes**:
  Fix operations must verify that file content has not drifted between analysis and patching by validating cryptographic source hashes before writing to disk.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Delimiter Matching in Embedded CSS**:
  In CSS, closing delimiters `}` or `]` appearing within parentheses (e.g., `light-dark(})`) do NOT close an outer CSS block; they are treated as plain tokens. A naive byte-matching scanner will decrement block depth prematurely, desynchronizing AST depth estimates:
  ```rust
  // Invariant proof: A closer only pops if it matches the current expected block closer
  fn close_style_block(&mut self, closer: u8) -> bool {
      if self.style_closers.last() != Some(&closer) {
          return false;
      }
      self.style_closers.pop();
      true
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
- **Monorepo Layout**: Rust workspace containing 12 crates partitioned by lifecycle phase (`extract` -> `graph` -> `engine` -> `api`/`cli`).
- **Decoupling**: AST types from `oxc` are isolated in `crates/extract`. Domain layers communicate via lightweight, thread-safe, serializable index structures (`ModuleGraph`, `SymbolTable`).
- **State Ownership**: Immutable module-level extraction results are cached by SHA-256 content hashes, enabling warm in-memory reuse across analysis runs.

### Dimension 2: Core Abstractions
- `AnalysisSession`: Coordinates file walking, multi-threaded AST extraction, module graph construction, and query execution.
- `HealthBaselineData`: Manages baseline snapshots, supporting count-mode, identity-mode, and shrink-only enforcement.
- `ImportDeclarationBindings`: Represents imported identifiers and maps intra-file reference frequencies for tree-shaking and dead-code fixes.

### Dimension 3: Error Handling
- **Fault Boundaries**: CSS and JS parsers execute inside `run_bounded` wrappers that capture stack usage and parser failures, degrading gracefully to regex/lexical scans.
- **Fail-Safe Degradation**: If structural CSS parsing fails, the system falls back to regex-based class extraction to preserve dead-code tracking without aborting CI.

### Dimension 4: Testing
- **Multi-tiered Test Harnesses**:
  - Micro-benchmarks via Criterion (`benches/component_engine.rs`).
  - Unit tests guarding against regression in `crates/*/tests`.
  - Integration tests simulating real projects with multi-file structures and ephemeral git worktrees.
  - Conformance fuzzing integration via OSS-Fuzz for parser robustness.

### Dimension 5: Security
- **Memory Safety**: Written in pure Rust; pinned low-level dependencies (`mimalloc`, `rustix`).
- **Command Injection Prevention**: Agent guard scripts (`.claude/hooks/pre-bash-guard.py`) use `shlex` quote-aware parsing rather than raw regexes to prevent evasion of CI/CD safety rails.

### Dimension 6: Performance
- **Parallelism**: Rayon-based parallel processing for AST generation, duplicate tokenization, and metric extraction.
- **Data Locality**: Heavy use of compact bitsets (`FixedBitSet`) and fast hashers (`rustc_hash::FxHashMap`, `xxhash-rust`) across all inner analysis loops.
- **Zero-Copy Serialization**: Graph and cache structures leverage compact binary formats (`bitcode`, `postcard`) for incremental disk caching.

### Dimension 7: Deployment
- **Hermetic Multi-Arch Containers**: Docker multistage builds targeting `x86_64-unknown-linux-musl` and `aarch64-unknown-linux-musl`.
- **Reproducibility**: Corepack and Node runtimes are pinned by cryptographic digests (`sha256`) in Docker manifests.

### Dimension 8: Agent Patterns
- **Pre-Tool Hooks**: Intercepts shell commands before execution to enforce command bounding (preventing context flooding from `cargo test`) and binary isolation.
- **Deterministic Protocols**: Custom JSON protocol (`fallow-gate-json-v1`) allows autonomous agents to query analysis status without parsing arbitrary terminal text.

### Dimension 9: Data Flow
```
Disk Source File 
   ──► SHA-256 Hashing & Cache Lookup
   ──► Pre-Lexical Depth & Token Scanner (Nesting / Recursion Guard)
   ──► Oxc AST / LightningCSS Parse
   ──► Symbol Extraction & Local Binding Resolution
   ──► Monorepo Graph Construction (FixedBitSet)
   ──► Baseline Comparator (Multi-dimensional count matching)
   ──► Report Formatter / Surgical Fix Rewriter
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Bounded Token Pre-Walk Before Native Parsing
Pre-validate syntax constraints using a low-overhead tokenizer before passing data to an AST generator that may panic or exhibit superlinear performance.
```rust
pub fn parse_style_bounded<R: Send>(source: &str, parse: impl FnOnce() -> R + Send) -> Option<R> {
    let scan = scan_depth(source, MAX_NESTING_DEPTH, Dialect::Style);
    if scan.max_colors > MAX_COLOR_FUNCTION_DEPTH { return None; }
    run_bounded(source, scan.max_depth, || {
        crate::style_tokens::style_parse_is_safe(source).then(parse)
    }).flatten()
}
```

### 2. Rule: Non-Fungible Baseline Categories
Baseline storage formats MUST separate orthogonal code quality dimensions into distinct categories to prevent defect masking.

### 3. Architecture Principle: Multi-Worktree Path Containment
Paths resolved during diff-based auditing MUST be strictly anchored within the worktree being analyzed; external links must be virtualized back into the analyzed tree.

### 4. Failure Mode: Exponential Backtracking on Nested Math/Color Functions
Nested functions such as `calc(calc(...))` or `color-mix(...)` can trigger exponential branch evaluations in

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
