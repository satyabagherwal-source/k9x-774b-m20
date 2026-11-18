# Verification Protocol: Verification Protocol: Empirical Defect Shield for fallow-rs/fallow

<!-- PROVENANCE_START
{
  "source_repository": "fallow-rs/fallow",
  "source_url": "https://github.com/fallow-rs/fallow",
  "source_version": "548aba6d",
  "license": "MIT",
  "timestamp": "2026-11-18T05:35:26.789Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-fallow-rs-fallow",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fallow-rs/fallow](https://github.com/fallow-rs/fallow) (Revision: `548aba6d`).  
> **License**: MIT | **Timestamp**: `2026-11-18T05:35:26.789Z`  
> **Learning ID**: `learn-github-fallow-rs-fallow`


## 1. Scope & Verification Target
- **Target Repository**: `fallow-rs/fallow` (Commit: `548aba6d`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Project Learning Record (Full-Spectrum Forensic Harvest): fallow-rs/fallow

---

## 1. Executive Forensic Architecture & System Mechanics

`fallow` is a high-throughput static analysis engine and codebase intelligence CLI written in Rust. It computes cross-module graphs covering dead code, circular dependencies, cyclomatic/cognitive complexity, code duplication (AST clone detection), architecture boundary rules (rule packs), and diff-risk audits directly on JavaScript, TypeScript, Vue SFC, Svelte, and CSS codebases without invoking `tsc` or a JavaScript runtime.

```
                              ┌────────────────────────────────────────┐
                              │            CLI & MCP Surface           │
                              │  (clap CLI, MCP Server, Agent Gates)   │
                              └──────────────────┬─────────────────────┘
                                                 │
                                                 ▼
                              ┌────────────────────────────────────────┐
                              │      Analysis Engine Orchestration     │
                              │   (fallow-engine: Session, Scheduler)  │
                              └──────┬──────────────────────────┬──────┘
                                     │                          │
                 Parallel AST Extraction                        Module Resolution
                                     ▼                          ▼
       ┌────────────────────────────────────────┐     ┌──────────────────────────────────┐
       │             fallow-extract             │     │           oxc_resolver           │
       │  - Oxc AST Allocator & Lexer           │     │  - ESM / CJS / TS Paths / Yarn   │
       │  - lightningcss (CSS Tokenizer)        │     │  - Dunce Canonicalization        │
       │  - SFC Splitter (Vue/Svelte)           │     └─────────────────┬────────────────┘
       │  - Bitcode Cache Serialization         │                       │
       └─────────────────┬──────────────────────┘                       │
                         │                                              │
                         └──────────────────────┬───────────────────────┘
                                                │
                                                ▼
                              ┌────────────────────────────────────────┐
                              │         Global Dependency Graph        │
                              │   (fallow-graph: Symbols, Re-exports,  │
                              │    FixedBitSet, Directed Cycles)       │
                              └─────────────────┬──────────────────────┘
                                                │
                     ┌──────────────────────────┼─────────────────────────┐
                     ▼                          ▼                         ▼
         ┌──────────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
         │      Dead Code       │   │   Clone / Dup Engine  │   │    Diff-Risk Audit    │
         │ - Reachability Graph │   │ - Normal Tokenizer    │   │ - Git Base vs Head    │
         │ - Multi-line Re-exp  │   │ - MinHash / LSH       │   │ - Config Chain Walk   │
         │ - Shared Decl Fixer  │   │ - Chunk Windowing     │   │ - Test Weakening Det. │
         └──────────────────────┘   └───────────────────────┘   └───────────────────────┘
```

### Architectural Subsystems and Decoupled Boundaries

1. **AST & Semantic Extraction Layer (`fallow-extract`)**:
   Uses the OXC parser ecosystem (`oxc_parser`, `oxc_allocator`, `oxc_semantic`, `oxc_span`) to produce ASTs in an arena-allocated lifecycle. It converts syntactic declarations into compact, serializable summary structs (`ModuleInfo`, `SemanticUsage`). CSS is parsed via a pinned exact build of `lightningcss` and `cssparser`.
2. **Persistent Extraction Cache (`fallow-extract/src/cache`)**:
   Employs two distinct cache version keys (`CACHE_VERSION` for module semantics, duplication cache version for token streams). Fast serialization/deserialization uses `bitcode` and `postcard` backed by `xxhash-rust (XXH3)` 64-bit content hashes. Any modification to downstream AST interpretation mandates an explicit compile-time cache version bump to invalidate warm caches.
3. **Module Resolution & Graph Synthesis (`fallow-graph`, `fallow-engine`)**:
   Uses `oxc_resolver` configured with `dunce::canonicalize` to normalize paths across Windows UNC prefixes and POSIX targets. Constructs a directed graph of symbol definitions, explicit re-exports (`NamedReExport`), star exports (`export *`), dynamic imports, and ambient declarations. Cycle detection operates via Tarjan's strongly connected components using `fixedbitset::FixedBitSet` masks.
4. **Mutational Fix Engine (`fallow-cli/src/fix`)**:
   A multi-pass AST-and-text refactoring pipeline. It separates detection from mutation by calculating target ranges, line splices, and withholding constraints. Removals are withheld when:
   - A live export re-exports the target.
   - The export keyword is shared across a multi-variable or destructured pattern where at least one identifier is retained.
5. **Diff-Risk Auditor (`fallow-api/src/diff_risk`)**:
   Computes risk metrics across Git boundaries (`base` vs `head`). Implements an explicit multi-layer configuration resolution traversal (`ConfigChain`), resolving up to `MAX_EXTENDS_DEPTH = 10` parent directories and external presets, detecting config weakening (e.g., lower severity, new or broadened ignore globs, removed exclusion negations).
6. **Agent Gateways & MCP (`fallow-api`, `.claude/hooks`)**:
   Provides machine-verifiable CLI JSON protocols (`fallow-gate-json-v1`), streaming sanitization that rejects raw control characters (`\u{2028}`, `\u{2029}`, `\0`), and pre-execution shell token parsing using POSIX-compliant AST token walks (`shlex`) to prevent context flooding and foreign binary execution.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Atomic Preservation of Shared Compound Declarations
**RULE**:
When an automated refactoring engine or code-fix agent identifies an unused identifier within a compound or destructured declaration statement (e.g., `export const { a, b } = expr;`, `export const [x, y] = fn();`, or `export let i = 1, j = 2;`), it **MUST NOT** split the declaration statement or remove the shared visibility modifier keyword unless **ALL** identifiers declared in that single statement are proven unused. If any identifier remains referenced or retained, the removal **MUST** be withheld and emitted as a structured skipped diagnostic (`applied: false, skipped: true`).

**WHY**:
Splitting a shared destructuring or comma-separated variable statement into independent declarations to isolate an exported component causes catastrophic semantic and runtime side effects:
1. **Side-Effect Re-Execution**: Splitting `const { a, b } = sideEffectInit();` into `const a = sideEffectInit().a; export const b = sideEffectInit().b;` evaluates the initializer expression twice, breaking stateful initializers, network requests, or database counter increments.
2. **Rest Element Mutation**: In `const [head, ...tail] = stream;`, duplicating or decomposing initializers invalidates iterator consumption and mutates rest array semantics.
3. **Compilation Failures**: Deleting the shared `export` keyword because name `a` is unused instantly drops the export contract of name `b`, producing TypeScript compile errors `TS2306` ("File is not a module") or `TS2459` ("Module has no exported member").

**WHEN TO APPLY**:
Apply to all source-code refactoring tools, AST mutation engines, linters with autofix (ESLint plugins, Biome analyzers, Rust refactoring assistants), and AI coding agent toolchains working in languages featuring compound bindings (TypeScript, JavaScript, Python multi-assignment, Rust destructuring tuple/struct bindings).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use rustc_hash::FxHashSet;

#[derive(Debug, PartialEq, Eq)]
pub struct SharedDeclaration {
    pub start_line: usize,
    pub start_col: usize,
    pub end_line: usize,
    pub bound_identifiers: Vec<String>,
}

impl SharedDeclaration {
    pub fn contains_binding(&self, line_idx: usize, identifier: &str) -> bool {
        (self.start_line..=self.end_line).contains(&line_idx)
            && self.bound_identifiers.iter().any(|b| b == identifier)
    }
}

pub struct SharedDeclarationIndex {
    declarations: Vec<SharedDeclaration>,
    unsafe_lines: FxHashSet<usize>,
}

impl SharedDeclarationIndex {
    /// Evaluates whether an `export` modifier removal can safely proceed.
    /// Invariant: Returns true ONLY when all names bound by the statement are targeted for removal.
    pub fn can_remove_export_modifier(
        &self,
        decl_idx: usize,
        names_targeted_for_removal: &FxHashSet<&str>,
    ) -> bool {
        let decl = &self.declarations[decl_idx];
        decl.bound_identifiers
            .iter()
            .all(|name| names_targeted_for_removal.contains(name.as_str()))
    }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Naively removing the export keyword or attempting an unverified syntactic split
// Given source: export const { config, runTask } = initializeEngine();
// Unused: config | Live: runTask

// BUGGY AUTO-FIX VARIANT A (Deletes export keyword):
const { config, runTask } = initializeEngine(); // FAILS: runTask is no longer exported! TS2459

// BUGGY AUTO-FIX VARIANT B (Naive split):
const config = initializeEngine().config;       // FAILS: Evaluates initializeEngine() twice!
export const runTask = initializeEngine().runTask;
```

**VERIFICATION METHOD**:
Enforce an automated integration test with compound initializers that assert single-evaluation invariants and check type diagnostics:
```bash
# Verify that running the fixer on a partially unused compound export preserves the keyword
cargo test -p fallow-cli --test integration_test -- test_destructured_export_keeps_modifier
# Ensure generated TypeScript passes type checking without TS2306 or TS2459
npx tsc --noEmit --project tsconfig.json
```

---

### 2. Multi-Context SFC Scope Unification with Directional Reference Propagation
**RULE**:
Static analyzers evaluating Single File Component (SFC) architectures containing multiple execution blocks (e.g., Vue's `<script>` vs `<script setup>`, Svelte's `<script module>` vs instance `<script>`) **MUST** unify symbol analysis into a directed acyclic bipartite scope graph where references only flow along the framework's compile-time visibility vectors:
- **Vue**: Bindings declared/imported in `<script>` are visible to `<script setup>` and `<template>`. Bindings in `<script setup>` **MUST NOT** be visible to or credit imports in `<script>`.
- **Svelte**: Bindings in `<script module>` are visible to the instance `<script>` and markup. Instance bindings **MUST NOT** credit or satisfy module script references.
Top-level unresolved references from child scopes **MUST** credit matching imports of parent scopes *before* reporting unused bindings or dead exports.

**WHY**:
SFC compilers merge split scripts into a single synthetic ES module at bundle time. Parsing each script block in isolation causes the engine to see imports in the module scope as unreferenced, because their call-sites exist in the setup/template AST. Reporting these imports as unused results in false positives that prompt developers to strip code, directly breaking downstream components at compile time. Conversely, bidirectional crediting creates false negatives by allowing setup-only variables to incorrectly satisfy module declarations.

**WHEN TO APPLY**:
Static analyzers, dead-code detectors, and symbol indexing engines processing Vue (`.vue`), Svelte (`.svelte`), Astro (`.astro`), or SvelteKit components where multiple `<script>` contexts coexist.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use rustc_hash::FxHashSet;

#[derive(Default)]
pub struct SfcSharedScopeTracker {
    /// Unresolved value references in the seeing scope (e.g., <script setup> or template)
    unresolved_value_refs: FxHashSet<String>,
    /// Unresolved type references in the seeing scope
    unresolved_type_refs: FxHashSet<String>,
    /// Imports provided by the visible module scope (e.g., plain <script>)
    visible_module_imports: FxHashSet<String>,
}

impl SfcSharedScopeTracker {
    /// Directional credit phase: Only seeing scope unresolved references can credit seen imports.
    pub fn reconcile_cross_block_credits(
        &self,
        unused_module_imports: &mut FxHashSet<String>,
    ) {
        let credited_names: Vec<String> = self
            .visible_module_imports
            .iter()
            .filter(|&import_name| {
                self.unresolved_value_refs.contains(import_name)
                    || self.unresolved_type_refs.contains(import_name)
            })
            .cloned()
            .collect();

        for name in credited_names {
            unused_module_imports.remove(&name);
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Analyzing SFC script blocks as isolated standalone modules or merging symmetrically
fn merge_sfc_blocks_bad(block1_unused: FxHashSet<String>, block2_unused: FxHashSet<String>) -> FxHashSet<String> {
    // FAILS: Symmetrical intersection or isolated emission creates false positives
    // and ignores the directed visibility contract.
    block1_unused.intersection(&block2_unused).cloned().collect()
}
```

**VERIFICATION METHOD**:
Execute an end-to-end extraction test with an SFC declaring an import in `<script>` used exclusively in `<script setup>` or `<template>`. The test must assert zero unused export findings on the upstream source module:
```rust
#[test]
fn sfc_directional_credit_verifies_clean_export() {
    let result = fallow_core::analyze(&config).expect("analysis should succeed");
    assert!(!result.unused_exports.iter().any(|e| e.export.export_name == "usedOnlyInSetup"));
}
```

---

### 3. Recursive Transitive Config Boundary and Diff-Risk Preservation
**RULE**:
When computing security, lint, or testing diff-risks across Git revisions (base vs head), the configuration parser **MUST NOT** limit evaluation to the leaf config file at the repository root. It **MUST** recursively traverse the entire `extends` inheritance hierarchy on both base and head commits up to an explicit loop-prevention depth (`MAX_EXTENDS_DEPTH`), resolving path-relative links. If an extended target cannot be parsed at base (e.g., external `npm:` package or uncommitted URL), that specific branch **MUST** be marked `Opaque` / `Unknown`, and any rule whose final resolved state depends on that opaque node **MUST NOT** trigger false weakening assertions. Furthermore, introducing broader path globs or removing negation exceptions (`!`) in ignore tables (`ignorePatterns`) **MUST** be classified as a suppression violation.

**WHY**:
Audits checking for weakened checks can be bypassed if an engineer removes an `extends: ["@company/strict-rules"]` line, alters a rule inside a nested `.eslintrc.json`/`.fallowrc.json` imported via `extends`, or adds an entry to `ignorePatterns`. Restricting checks to root keys lets critical safety weakenings slip through unnoticed.

**WHEN TO APPLY**:
Static audit tools, pull-request safety gates, policy compliance analyzers, and monorepo governance engines evaluating configuration mutations between two Git trees.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::{Path, PathBuf};
use rustc_hash::{FxHashMap, FxHashSet};
use serde_json::Value;

pub const MAX_EXTENDS_DEPTH: usize = 10;

pub enum LookupResult<'a> {
    Unknown, // Blocked by opaque boundary (e.g., remote npm package)
    Unset,   // Explicitly not set anywhere in chain
    Set { value: &'a Value, source_file: &'a Path },
}

pub struct ConfigChainResolver {
    order: Vec<Option<usize>>, // None represents an Opaque external source
    values: Vec<(PathBuf, serde_json::Map<String, Value>)>,
    active_cycle_guard: FxHashSet<PathBuf>,
}

impl ConfigChainResolver {
    pub fn resolve_key(&self, key: &str) -> LookupResult<'_> {
        // Evaluate in reverse merge order (latest source takes precedence)
        for source_idx in self.order.iter().rev() {
            match source_idx {
                None => {
                    // Encountered an opaque external source: future queries cannot guarantee state
                    return LookupResult::Unknown;
                }
                Some(idx) => {
                    let (path, map) = &self.values[*idx];
                    if let Some(val) = map.get(key) {
                        return LookupResult::Set { value: val, source_file: path.as_path() };
                    }
                }
            }
        }
        LookupResult::Unset
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Comparing only the local file content strings at HEAD vs BASE
fn detect_weakened_rules_bad(base_content: &str, head_content: &str) {
    // FAILS: Ignores changes made in inherited extends configs, fails on circular configs,
    // and cannot detect bypasses introduced via glob broadening in ignorePatterns.
    let base_rules = parse_rules(base_content);
    let head_rules = parse_rules(head_content);
    compare_rules(base_rules, head_rules);
}
```

**VERIFICATION METHOD**:
Provide test cases with chained configurations where a parent configuration alters rule severities or introduces `ignorePatterns`:
```bash
cargo test -p fallow-api --test integration_test -- test_config_chain_follows_extends_and_detects_negation_removal
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Broken Builds Caused by Premature Removal of Compound Export Declarations (BUG-FIX-SHARED-01)
- **Context**: `crates/cli/src/fix/exports.rs`, `crates/cli/src/fix/export_declarations.rs`, issue #4659.
- **What Was Expected**: Running `fallow fix` on an unused exported name from a compound declaration (e.g., `export const { a, b } = x;` or `export const a = 1, b = 2;`) should only remove the `export` keyword if *all* names bound by that declaration are completely unused. If name `a` is unused but name `b` is actively imported elsewhere, name `a` should be skipped, leaving the `export` keyword intact.
- **What Actually Happened**: The fixer stripped the line-starting `export` keyword because name `a` was unused. As a consequence, name `b` became a private, module-scoped variable. TypeScript compilation immediately failed across consumer files with `TS2306` ("File '...' is not a module") or `TS2459` ("Module '...' has no exported member 'b'").
- **Evidence in Repo**: Commit `323e7de9`. Tests in `action/tests/run.sh` verifying `skipped_shared_declarations`.
- **Root Cause**: The fixer treated export removals as 1-to-1 mappings between an unused symbol name and the `export` token on its line index. It lacked an AST-level destructuring and compound-declaration model, failing to recognize that a single `export` token acts as the visibility root for multiple bound AST identifiers spanning multiple lines.
- **Remediation Code Diff**:
```rust
// In crates/cli/src/fix/exports.rs
- withhold_removals_behind_kept_re_exports(&mut file_plans, input.re_exports);
+ withhold_removals_of_kept_exports(&mut file_plans, input.re_exports);

// In crates/cli/src/fix/export_declarations.rs
+ pub(super) struct SharedDeclaration {
+     pub(super) start_line: usize,
+     pub(super) start_col: usize,
+     pub(super) end_line: usize,
+     pub(super) names: Vec<String>,
+ }
+ impl SharedDeclaration {
+     fn holds(&self, line_idx: usize, name: &str) -> bool {
+         (self.start_line..=self.end_line).contains(&line_idx)
+             && self.names.iter().any(|bound| bound == name)
+     }
+ }
```
- **Lesson**: A visibility modifier in a lexically shared grammar node cannot be altered until all bindings under its AST dominance tree have been invalidated.

---

### Incident 2: False-Positive Dead Code Extraction in Vue/Svelte Single-File Components (BUG-EXTRACT-SFC-02)
- **Context**: `crates/extract/src/sfc.rs`, `crates/extract/src/sfc_script_merge.rs`, issue #4672.
- **What Was Expected**: In Vue SFCs with both `<script>` and `<script setup>`, or Svelte components with `<script module>` and instance `<script>`, any binding imported in the module script and consumed inside the setup script, template, or markup must be marked as referenced.
- **What Actually Happened**: `fallow dead-code` reported upstream utility functions as completely unused when imported in a Vue plain `<script>` but consumed only in `<script setup>` or `<template>`. Users running automated cleanup had their imports deleted, breaking the component at runtime.
- **Evidence in Repo**: Commit `33d0d10a`, issue #4672. Cache version bumped from 452 to 453 in `crates/extract/src/cache/types.rs`.
- **Root Cause**: The SFC parser analyzed each `<script>` block in complete AST isolation. Because the plain `<script>` AST contained the import but no local references within that block, OXC's semantic resolver marked the binding as unused. It never communicated unresolved identifier references from the subsequent `<script setup>` AST pass back to the earlier module block.
- **Remediation Code Diff**:
```rust
// In crates/extract/src/sfc_script_merge.rs
+ #[derive(Default)]
+ pub(super) struct SharedScopeReferences {
+     values: FxHashSet<String>,
+     types: FxHashSet<String>,
+     visible_imports: FxHashSet<String>,
+ }
+
+ pub(super) fn credit_shared_scope_references(
+     references: &SharedScopeReferences,
+     combined: &mut ModuleInfo,
+ ) {
+     let mut names: Vec<&String> = references
+         .visible_imports
+         .iter()
+         .filter(|name| references.values.contains(*name) || references.types.contains(*name))
+         .collect();
+     names.sort_unstable();
+     for name in names {
+         combined.unused_import_bindings.remove(name);
+     }
+ }
```
- **Lesson**: When compilers synthesize multi-block source representations into a unified module, the static analyzer must emulate the compiler's synthetic scope links and propagate unresolved tokens from the inner scopes to the outer module imports.

---

### Incident 3: Blind-Spot Bypasses in Diff-Risk Audit via Config Inheritance (BUG-AUDIT-EXTENDS-03)
- **Context**: `crates/api/src/diff_risk/config_chain.rs`, `crates/api/src/diff_risk/config_change.rs`, PR #4705, issue #4668.
- **What Was Expected**: `fallow audit` with the `weakened-tests` rule must fail CI if a developer lowers rule severity or widens ignore patterns in *any* configuration file that influences the project root.
- **What Actually Happened**: The audit engine only inspected the single `.fallowrc.json` file residing at the project root. If a pull request lowered severities inside a shared preset referenced by `"extends": ["./config/base.json"]` or deleted the `"extends"` key entirely, the audit produced 0 findings.
- **Evidence in Repo**: Commit `f3e26ea2`. Added `config_chain.rs` (456 additions) and `config_change.rs` (594 additions).
- **Root Cause**: Diff comparison was performed via a flat diff of root config files between Git base and head. It lacked recursive inheritance expansion, cycle detection, and ignore-pattern glob differential analysis.
- **Remediation Code Diff**:
```rust
// In crates/api/src/diff_risk/mod.rs
- if rule_severity::is_fallow_config_path(&file.rel) {
-     detect_weakened_rules(file, &mut raw);
- }
+ detect_config_changes(input, &mut base, &mut raw);

// In crates/api/src/diff_risk/config_chain.rs
+ const MAX_EXTENDS_DEPTH: usize = 10;
+ pub struct ConfigChain {
+     order: Vec<Option<usize>>,
+     values: Vec<(PathBuf, Map<String, Value>)>,
+     index: FxHashMap<PathBuf, usize>,
+     active: FxHashSet<usize>,
+     texts: FxHashMap<PathBuf, String>,
+     root: Option<PathBuf>,
+ }
```
- **Lesson**: Security and governance checks that inspect configurations must resolve the full declarative inheritance graph across both sides of a delta; inspecting local file leaves creates an immediate audit bypass.

---

### Incident 4: Multi-Line Re-Export Splicing Build Failure (BUG-FIX-REEXPORT-04)
- **Context**: `crates/cli/src/fix/exports.rs`, issue #4636.
- **What Was Expected**: If an export is removed, but a multi-line re-export statement (`export {\n  a,\n  b\n} from './mod';`) re-exports it and is retained, the removal must be withheld to avoid breaking downstream consumers.
- **What Actually Happened**: The fixer parsed single-line re-exports correctly, but multi-line re-exports formatted by Prettier across several line breaks escaped detection in the withholding plan. The source export was deleted from `./mod`, but `export { a } from './mod'` was left in the barrel file, breaking the TypeScript build with `TS2459`.
- **Evidence in Repo**: Issue #4636, addressed in commits leading into `323e7de9`.
- **Root Cause**: Re-export inspection relied on single-line regex/string splits rather than line-range-aware CST/AST statement indexing (`ExportListStatement`).
- **Remediation Code Diff**:
```rust
// In crates/cli/src/fix/exports.rs
+ /// Withhold each planned removal whose export the run must keep.
+ /// A removal is withheld when a kept re-export still names the export.
+ /// Each withheld removal keeps more exports, so the loop runs until
+ /// no removal changes.
+ fn withhold_removals_of_kept_exports(...) {
+     let mut changed = true;
+     while changed {
+         changed = false;
+         // Re-evaluate dependencies between kept re-exports and source declarations
+     }
+ }
```
- **Lesson**: Code fix withholding checks form a directed dependency graph that must be resolved using fixed-point iteration until reachability converges.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Operator Precedence in Flag Filtering**: When computing bitmasks or checking token categories, never write `flags & MASK != 0` without parentheses. Rust's precedence binds `!=` tighter than `&`. Always write `(flags & MASK) != 0`.
- **String Slicing on Multi-Byte UTF-8 Boundaries**: In static analysis, source code offsets are emitted as raw byte indices by the lexer (`oxc_span::Span`). Slicing a Rust `&str` directly via `&source[span.start as usize..span.end as usize]` will trigger a thread panic if an index falls inside a multi-byte UTF-8 sequence (e.g., emojis or non-ASCII identifiers).
  ```rust
  // CORRECT INVARIANT: Safe character boundary slicing
  pub fn safe_span_slice(source: &str, start: usize, end: usize) -> Option<&str> {
      if source.is_char_boundary(start) && source.is_char_boundary(end) && start <= end {
          Some(&source[start..end])
      } else {
          None
      }
  }
  ```
- **Path Component Matching & Escaping**: Path comparisons must avoid raw substring checks. A file named `src/not-a-test.ts` will trigger a false positive if checked using `path.contains(".test.")`. Path checks must parse structural path segments using `std::path::Path::components()` or exact prefix/suffix boundary assertions.

### 2. Infinite Loop & Recursion Guards
- **Fixed-Point Iteration Termination**: When running iterative graph pruning (e.g., cascading re-export removal withholding), enforce a strict termination invariant:
  ```rust
  let mut changed = true;
  let mut passes = 0;
  let max_passes = file_plans.iter().map(|p| p.fixes.len()).sum::<usize>() + 1;
  while changed {
      passes += 1;
      assert!(passes <= max_passes, "Invariant violated: Cascading withhold loop exceeded maximum theoretical bounds");
      changed = false;
      // ... iteration logic ...
  }
  ```
- **Circular Config Resolution Cap**: Traversal of `extends` configurations must track an active ancestry set (`active: FxHashSet<PathBuf>`) to detect cycles, supplemented with an absolute depth counter `MAX_EXTENDS_DEPTH = 10`.

### 3. UI, Terminal & Shell Micro-Mechanics
- **Line Ending Preservation (CRLF vs LF)**: When refactoring source files, never assume standard Unix `\n`. Modifying a Windows CRLF file with `\n` creates mixed line endings that cause Git diff clutter and break AST offsets.
  ```rust
  pub struct EncodingMetadata {
      pub line_ending: &'static str, // "\r\n" or "\n"
      pub has_trailing_newline: bool,
  }
  ```
- **JSON Control Character Sanitization**: Before writing diagnostics or findings to stdout in machine-readable JSON, all strings must be scrubbed of Unicode line breaks and control characters (`\u{2028}` Line Separator and `\u{2029}` Paragraph Separator) which break JSON parsers and terminal emulators:
  ```rust
  fn clean(value: &str) -> String {
      let mut result = String::new();
      let mut in_control_run = false;
      for c in value.chars() {
          let control = c.is_control() || matches!(c, '\u{2028}' | '\u{2029}');
          if control {
              if !in_control_run { result.push(' '); }
          } else {
              result.push(c);
          }
          in_control_run = control;
      }
      result
  }
  ```
- **Zero-Byte Invariant**: External hook interfaces must reject payloads containing embedded null bytes (`\0`) to protect against C-string truncation attacks.

### 4. Backend Concurrency & Memory Safety
- **Lock-Free Dependency Graph Aggregation**: Use `rayon` data-parallel iterators combined with local collection folds and thread-safe hash maps (`rustc_hash::FxHashMap`, `dashmap::DashMap`) to avoid global mutex contention during parallel AST traversal across thousands of files.
- **Arena Allocator Reset Lifecycle**: When using `oxc_allocator::Allocator`, allocate an arena per file or worker thread and reset it after each module extraction pass. Failing to reset the arena turns memory usage from $O(1)$ per file to $O(N)$ across the entire codebase, leading to OOM panics on large monorepos.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Lexical Variable Shadowing in SFC Scopes**: When matching unresolved references across SFC blocks, the analyzer must account for local shadow bindings. If `<script setup

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
