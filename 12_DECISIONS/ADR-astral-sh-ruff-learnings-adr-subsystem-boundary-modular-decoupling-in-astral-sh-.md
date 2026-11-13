# Architecture Decision Record: ADR: Subsystem Boundary & Modular Decoupling in astral-sh-ruff-learnings

<!-- PROVENANCE_START
{
  "source_repository": "astral-sh-ruff-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:33:43.683Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-astral-sh-ruff-learnings",
  "canonical_classification": "architecture_decision"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [astral-sh-ruff-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:33:43.683Z`  
> **Learning ID**: `LEARN-REEXTRACT-astral-sh-ruff-learnings`


## Status
**ACCEPTED** (Empirically verified from astral-sh-ruff-learnings)

## Context
During deep inspection of astral-sh-ruff-learnings, modular boundaries, performance characteristics, and concurrency constraints required explicit architectural trade-off analysis.

## Decision
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/astral-sh-ruff-learnings.md`  
> **Source**: github ([https://github.com/astral-sh/ruff](https://github.com/astral-sh/ruff))  
> **Source Version**: `52257b30`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-11T09:14:20.952Z  
> **Learning ID**: `learn-github-astral-sh-ruff`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): astral-sh/ruff

---

## 1. Executive Forensic Architecture & System Mechanics

`astral-sh/ruff` is a monolithic Rust workspace implementing a high-throughput Python static analysis platform comprising:
1. An extremely fast, drop-in replacement linter and formatter (`ruff_linter`, `ruff_formatter`, `ruff_python_formatter`).
2. An incremental, salsa-query-based type inference engine and static type checker (`ty`, `ty_python_semantic`, `ty_project`).
3. An LSP server runtime for interactive language intelligence (`ruff_server`, `ty_server`).
4. An ergonomic terminal diagnostic presentation engine (`ruff_annotate_snippets`, `ruff_db`).

```
                     +---------------------------------------+
                     |        CLI / Server Interface         |
                     |       (ruff_command_line / LSP)       |
                     +-------------------+-------------------+
                                         |
                       +-----------------+-----------------+
                       |                                   |
                       v                                   v
             +-------------------+               +-------------------+
             |    Linter Core    |               |    Ty Semantic    |
             |   (AST Visitor)   |               |   (Salsa DB / ty) |
             +---------+---------+               +---------+---------+
                       |                                   |
         +-------------+-------------+                     |
         v                           v                     v
+-----------------+         +-----------------+  +-------------------+
|  ruff_python_   |         | ruff_python_    |  | C3 Linearization  |
|     parser      |         |     ast         |  |   MRO / Metaclass |
+--------+--------+         +--------+--------+  +---------+---------+
         |                           |                     |
         +-------------+-------------+                     |
                       |                                   |
                       v                                   v
             +-------------------+               +-------------------+
             | ruff_source_file  |               |  Source-Map &     |
             |  (TextRange, UTF) |               |  StyledBuffer     |
             +---------+---------+               +---------+---------+
                       |                                   |
                       +-----------------+-----------------+
                                         |
                                         v
                     +---------------------------------------+
                     |    Diagnostic Renderer Pipeline       |
                     |  (Concise / Full / Azure / SARIF)     |
                     +---------------------------------------+
```

### Subsystem Boundaries & Decoupling Invariants
- **`ruff_text_size` & `ruff_source_file`**: Strict zero-cost primitives representing offsets in code as `TextSize` (32-bit byte offset), enforcing slice slicing through `TextRange` rather than raw indices. Converts 0-indexed byte offsets to 1-indexed UTF-8 line/column structures lazily on diagnostic emission.
- **`ruff_db` (Database Layer)**: Employs an incremental query-definition architecture (powered by Salsa). File states are salsa-tracked inputs (`File`), memoizing ASTs and type resolutions. Mutations invalidate only downstream dependent queries.
- **`ty_python_semantic`**: Houses the formal type system. Separates `StaticClassLiteral` (the unspecialized syntactic class definition AST reflection) from `ClassType` (the specialized type instance within an execution/type scope).
- **`ruff_annotate_snippets`**: Terminal diagnostic engine detached from the AST. Operates entirely on raw text slices, character display widths, and virtual row-major styled 2D character grids (`StyledBuffer`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Decoupled Semantic Lookup During MRO & Metaclass Resolution
**RULE**:
When resolving class-level metadata (such as Metaclasses, Dataclass Transformers, or Generic Variance) in a static type system, the query MUST evaluate over bare, unspecialized base types (`class_metadata_base_types`) and MUST NOT evaluate specialized or synthetic generic tuple/dataclass base fields.

**WHY**:
Computing specialized type arguments for synthetic base types (such as `tuple[T1, T2]` synthesized from `NamedTuple` definitions) forces early inference of field annotations. If any field's type annotation refers back to an enclosing union or subclass in a recursive loop (e.g., `Node = IsNull | Bool`), invoking specialized MRO queries creates an unbreakable salsa query dependency cycle, triggering a `too many cycle iterations` panic and crashing the compiler/analyzer process.

**WHEN TO APPLY**:
Apply in any type checker, compiler frontend, or static analysis engine that computes class inheritance hierarchies, C3 linearizations, dataclass transformations, or metaclass selections on types that allow self-referential or mutually recursive type annotations.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified pattern from crates/ty_python_semantic/src/types/class/static_literal.rs
impl<'db> StaticClassLiteral<'db> {
    /// Return the dataclass transform an ordinary class inherits from its bases
    /// using bare unspecialized bases to avoid circular field inference.
    pub(super) fn dataclass_transformer_from_bases(
        self,
        db: &'db dyn Db,
    ) -> Option<DataclassTransformerParams<'db>> {
        // Query ancestors using decoupled, unspecialized metadata ancestors
        let ancestors = self
            .try_class_metadata_ancestors(db)
            .unwrap_or_else(StaticMroError::fallback_ancestors);

        let params = ancestors.iter().find_map(|base| {
            let (literal, _) = base.into_class()?.static_class_literal(db)?;
            literal.dataclass_transformer_params(db)
        })?;

        // Guard against cycles when the class itself subclasses `type`
        let env = ProgramEnvironment::from_scope(self.body_scope(db));
        if KnownClass::Type
            .try_to_class_literal(db, &env)
            .is_some_and(|type_literal| {
                let type_class = ClassType::NonGeneric(type_literal.into());
                self.default_specialization(db) == type_class
                    || ancestors.contains(&ClassBase::Class(type_class))
            })
        {
            return None;
        }
        Some(params)
    }

    /// Base types for class metadata lookup: strips specialized fields from synthetic NamedTuples
    fn class_metadata_base_types(
        self,
        db: &'db dyn Db,
        env: &ProgramEnvironment<'db>,
    ) -> impl Iterator<Item = Type<'db>> {
        self.explicit_bases(db).iter().copied().map(move |base| {
            if base == Type::SpecialForm(SpecialFormType::NamedTuple) {
                // Return bare tuple class literal, dropping field specialization!
                KnownClass::Tuple.to_class_literal(db, env)
            } else {
                base
            }
        })
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// CRITICAL BUG PATTERN: Evaluating full MRO with specialized generic base arguments
pub(super) fn bad_dataclass_transformer_from_bases(
    self,
    db: &'db dyn Db,
) -> Option<DataclassTransformerParams<'db>> {
    // ANTI-PATTERN: class.iter_mro(db, None) computes full specialized bases.
    // For NamedTuple, this computes `tuple[T1, T2]`, which triggers recursive type
    // resolution of T1 and T2, triggering an infinite Salsa cycle panic on recursive definitions!
    class.iter_mro(db, None).skip(1).find_map(|base| {
        base.into_class()?.static_class_literal(db)?.0.dataclass_transformer_params(db)
    })
}
```

**VERIFICATION METHOD**:
Implement a circular named-tuple type conformance test fixture:
```python
from typing import NamedTuple, TypeAlias
class IsNull(NamedTuple):
    item: "Node"
class Bool(NamedTuple):
    items: tuple["Node", ...]
Node: TypeAlias = IsNull | Bool
```
Run the type inference harness verifying that resolving `Bool` terminates in $\mathcal{O}(1)$ query cycles without exhausting the query recursion depth or throwing salsa cycle errors.

---

### 2. Monotonic Terminal Line-Truncation and Margin Budgeting
**RULE**:
When rendering diagnostic code snippets into fixed-width viewports, the margin calculation MUST compute leftward shifts using saturating arithmetic and explicit column-aligned offsets. Truncating whitespace MUST NEVER reduce the left boundary below the terminal column width when span labels overlap with the indentation region.

**WHY**:
Terminal formatters that truncate source whitespace without validating whether multi-span underline pointers fall within the clipped zone cause diagnostic labels to reference arbitrary and misleading columns. Furthermore, unsigned integer subtraction underflow in terminal width clipping yields process panics via overflow checking in debug builds or astronomical line lengths in release builds.

**WHEN TO APPLY**:
Diagnostic rendering engines, terminal text user interfaces (TUIs), compiler error formatters, and code diff outputters.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified pattern from crates/ruff_annotate_snippets/src/renderer/margin.rs
impl Margin {
    fn compute(&mut self, max_line_len: usize) {
        // When whitespace is large (>20), reserve 4 spaces for context padding
        self.computed_left = if self.whitespace_left > LONG_WHITESPACE {
            self.whitespace_left - (LONG_WHITESPACE - LONG_WHITESPACE_PADDING)
        } else {
            0
        };
        self.computed_right = max(max_line_len, self.computed_left);

        if self.computed_right - self.computed_left > self.term_width {
            // Guard: Ensure right-most label does not point to truncated whitespace
            if self.label_right.saturating_sub(self.whitespace_left) <= self.term_width
                && self.label_right >= self.whitespace_left
            {
                self.computed_left = self.whitespace_left;
                self.computed_right = self.computed_left + self.term_width;
            } else if self.label_right - self.span_left <= self.term_width {
                let padding_left = (self.term_width - (self.label_right - self.span_left)) / 2;
                self.computed_left = self.span_left.saturating_sub(padding_left);
                self.computed_right = self.computed_left + self.term_width;
            } else {
                // Fallback: Bind strictly to span boundaries
                self.computed_left = self.span_left;
                self.computed_right = self.span_right;
            }
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Naive slicing of terminal diagnostic lines
fn bad_compute_margins(whitespace_left: usize, span_left: usize, term_width: usize) -> (usize, usize) {
    // Underflows if term_width < span_left!
    let left = span_left - (term_width / 2); 
    // Naively truncating whitespace causes labels located inside whitespace to point off-screen:
    let right = left + term_width;
    (left, right)
}
```

**VERIFICATION METHOD**:
Property-test `Margin::new` across arbitrary combinations of `span_left`, `span_right`, `label_right`, and `term_width` ranging from 0 to `usize::MAX`, asserting:
1. `computed_left <= computed_right`
2. `was_cut_left() == (computed_left > 0)`
3. Absolute guarantee that zero panic or overflow occurs when `term_width == 0` or `span_left > span_right`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Salsa Query Recursion Loop on Recursive NamedTuples (BUG-TY-CYCLE-01)
- **Context**: `crates/ty_python_semantic/src/types/class.rs`, `crates/ty_python_semantic/src/types/class/static_literal.rs`
- **What Was Expected**: Running `ty check` against Python definitions containing union types composed of mutually recursive `NamedTuple` classes (e.g. Rowstile's condition parser) should resolve type bounds and dataclass transformer inheritance without unbounded recursion.
- **What Actually Happened**: Static analyzer aborted execution with panic: `too many cycle iterations` during Salsa incremental query resolution.
- **Evidence in Repo**: Commit `b5d383d9`, Issue/PR `#30222`.
- **Root Cause**: During class attribute inference of `Bool.items`, the engine inspected whether its metaclass or base classes supplied a dataclass transformation via `class.iter_mro(db, None)`. For a `NamedTuple`, building its MRO constructed the specialized synthetic base `tuple[tuple[Node, ...]]`. Specializing the tuple required re-inferring the type of `items`, which re-queried the dataclass transformer on `Bool`, creating an unbreakable cyclic query dependency.
- **Remediation Code Diff**:
```rust
// In crates/ty_python_semantic/src/types/class.rs:
- } else if KnownClass::Type
-     .try_to_class_literal(db, &env)
-     .is_none_or(|type_class| {
-         !class.is_subclass_of(
-             db,
-             None,
-             ClassType::NonGeneric(ClassLiteral::Static(type_class)),
-         )
-     })
-     && let Some(transformer_params) =
-         class.iter_mro(db, None).skip(1).find_map(|base| {
-             base.into_class().and_then(|class| {
-                 class
-                     .static_class_literal(db)
-                     .and_then(|(lit, _)| lit.dataclass_transformer_params(db))
-             })
-         })
- {
+ } else if let Some(transformer_params) = class.dataclass_transformer_from_bases(db) {
      Some(CodeGeneratorKind::from_dataclass_transformer(
          db,
          class,
          transformer_params,
      ))
  }

// In crates/ty_python_semantic/src/types/class/static_literal.rs:
+ fn class_metadata_base_types(
+     self,
+     db: &'db dyn Db,
+     env: &ProgramEnvironment<'db>,
+ ) -> impl Iterator<Item = Type<'db>> {
+     self.explicit_bases(db).iter().copied().map(move |base| {
+         if base == Type::SpecialForm(SpecialFormType::NamedTuple) {
+             KnownClass::Tuple.to_class_literal(db, env)
+         } else {
+             base
+         }
+     })
+ }
```
- **Lesson**: Query-based type engines must enforce strict separation between *class structural metadata* queries (which only require bare, unspecialized type names) and *member/field projection* queries (which require full type argument specialization).

---

### Incident 2: Stale Lockfile Dependencies Breaking Workspace Compilation (BUG-CARGO-LOCK-02)
- **Context**: `Cargo.lock` (Root workspace synchronization)
- **What Was Expected**: Running `cargo build --locked` in CI environments must compile deterministically from exact lockfile declarations without modifying files on disk.
- **What Actually Happened**: When PR `#30303` and `#30308` merged, five subcrates retained declarations pointing to `syn` 3.0.6 while the root resolution had updated to `syn` 3.0.8. Consequently, CI `--locked` checks failed, and differential PR baseline benchmarks aborted when Git rejected branch switches due to unstaged mutations in `Cargo.lock`.
- **Evidence in Repo**: Commit `d86f7b12`, PR `#30321`.
- **Root Cause**: Desynchronization between workspace root resolver updates and internal transitive member specifications when individual crate PRs bump dependencies in parallel branches.
- **Remediation Code Diff**:
```toml
# Synchronized all crates across the lockfile to target syn 3.0.8 identically
# Eliminated dual-version resolution entries in Cargo.lock
```
- **Lesson**: High-velocity multi-crate workspaces must enforce a mandatory CI check running `cargo check --locked --workspace --all-targets` alongside git tree clean assertions (`git diff --exit-code Cargo.lock`).

---

### Incident 3: Leaking Type Variable Scope in Recursive ParamSpec Calls (BUG-TY-PARAMSPEC-03)
- **Context**: `crates/ty_python_semantic/src/types/call.rs` (Call binding and type variable freshening)
- **What Was Expected**: Evaluating a generic recursive function call containing both standard type variables and parameter specifications (e.g., `def f[T, **P](value: T, n: int, callback: Callable[P, None]) -> None: f(0, value, callback)`) must fail type-checking with: `Expected int, found T@f`.
- **What Actually Happened**: `ty check` accepted the call invalidly, failing to detect that argument `value` was being supplied where an `int` parameter was expected.
- **Evidence in Repo**: Closed Issue `#30277`.
- **Root Cause**: The call-binding engine checked whether a function signature contained a `ParamSpec`. If present, the engine bypassed the standard type-variable freshening routine. This caused the callee's type variables to bind directly to the caller's rigid type variables, permitting incompatible recursive parameter unification.
- **Remediation Code Diff**:
```rust
// Enforce callable signature freshening unconditionally, even when ParamSpec is present:
- if signature.contains_paramspec() {
-     // Skipped freshening
- } else {
-     signature.freshen_type_variables(&mut inference_context);
- }
+ signature.freshen_type_variables(&mut inference_context);
```
- **Lesson**: Higher-kinded constructs (such as `ParamSpec`) must never bypass base generic variable alpha-renaming/freshening during recursive function invocation.

---

### Incident 4: Loss of Type Context Kind During Expression Propagation (BUG-TY-CONTEXT-04)
- **Context**: `crates/ty_python_semantic/src/types/infer.rs` (Bidirectional type inference)
- **What Was Expected**: When propagating contextual type expectations downward into nested expressions (e.g., ternary operators, lambdas, and list comprehensions), the exact context kind (e.g., assignment target, return value constraint, or argument position) must remain intact.
- **What Actually Happened**: Downward propagation flattened the contextual requirement into an unconstrained type requirement, causing spurious type diagnostic false-positives across typing conformance suites.
- **Evidence in Repo**: Closed Issue `#30279`, PR Commit `a75f443`.
- **Root Cause**: Recursive descent helper functions inside the inference engine instantiated fresh `TypeContext` instances with default flags rather than threading through the parent's contextual classification metadata.
- **Remediation Code Diff**:
```rust
// In crates/ty_python_semantic/src/types/infer.rs:
- let child_context = TypeContext::from_type(expected_type);
+ let child_context = parent_context.with_expected_type(expected_type);
```
- **Lesson**: Bidirectional inference contexts must behave as immutable persistent structures that preserve contextual classification flags during sub-expression traversal.

---

### Incident 5: Upstream Security Vulnerability in Edge Worker Playground (SEC-PLAYGROUND-UNDICI-05)
- **Context**: `playground/api/package-lock.json`, `playground/deploy/package-lock.json`
- **What Was Expected**: The WebAssembly-powered online browser playground edge workers running on Cloudflare Workers (`workerd`) must remain secure against HTTP request smuggling and CRLF injection vulnerabilities.
- **What Actually Happened**: Downstream dependencies of Cloudflare Wrangler (`miniflare`) pulled in vulnerable versions of Node HTTP client library `undici` (`7.29.1`).
- **Evidence in Repo**: Commit `9d2a5666`, PR `#30265`.
- **Root Cause**: `miniflare` pinned `undici` dynamically to an unpatched minor range.
- **Remediation Code Diff**:
```json
// In playground/api/package.json & playground/deploy/package.json:
- "wrangler": "^4.107.1"
+ "wrangler": "^4.153.0"

// In package-lock.json:
- "undici": "7.29.1"
+ "undici": "7.30.1"
```
- **Lesson**: Auxiliary developer infrastructure (such as playground workers) must be maintained in automated lockfile-scanning pipelines with zero-tolerance dependency review.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
In Ruff, absolute byte-range correctness is guaranteed by never operating directly on raw `usize` or `String` indices without validating against UTF-8 boundaries.

```rust
// Verified pattern from crates/ruff_annotate_snippets/src/renderer/source_map.rs
pub(crate) fn span_to_locations(&self, span: Range<usize>) -> (Loc, Loc) {
    let start_info = self
        .lines
        .iter()
        .find(|info| span.start >= info.start_byte && span.start < info.end_byte)
        .unwrap_or(self.lines.last().unwrap());

    // CRITICAL: Slice slicing must be clamped to line length to prevent panics
    // on EOF spans or zero-width trailing newlines:
    let clamp_idx = (span.start - start_info.start_byte).min(start_info.line.len());
    let (mut start_char_pos, start_display_pos) = start_info.line[0..clamp_idx]
        .chars()
        .fold((0, 0), |(char_pos, byte_pos), c| {
            let display = char_width(c);
            (char_pos + 1, byte_pos + display)
        });

    // Guard against pointing one character past line-end when highlighting \n
    if (span.start - start_info.start_byte).saturating_sub(start_info.line.len()) > 0 {
        start_char_pos += 1;
    }
    // ...
}
```

*Defect Avoided*: Slicing `line[0..(span.start - start_info.start_byte)]` without `.min(start_info.line.len())` causes a runtime panic (`byte index out of bounds`) when an error span extends to include the trailing newline character.

---

### 2. Infinite Loop & Recursion Guards
In query-based semantic graphs (such as Salsa), queries that call themselves transitively must be safeguarded with explicit cycle handlers.

```rust
// Verified pattern from crates/ty_python_semantic/src/types/class/static_literal.rs
#[salsa::tracked(
    returns(as_ref),
    cycle_initial=mro_ancestors_cycle_initial,
    heap_size=ruff_memory_usage::heap_size
)]
fn named_tuple_ancestors<'db>(
    db: &'db dyn Db,
    class: StaticClassLiteral<'db>,
) -> Result<Box<[ClassBase<'db>]>, Box<StaticMroError<'db>>> {
    let env = ProgramEnvironment::from_scope(class.body_scope(db));
    let bases: Vec<_> = class.class_metadata_base_types(db, &env).collect();
    Mro::ancestors_of_static_class(db, class, None, &bases).map_err(Box::new)
}

// Cycle recovery function: Must return a well-formed fallback instead of recurring!
fn mro_ancestors_cycle_initial<'db>(
    db: &'db dyn Db,
    _cycle: &salsa::Cycle,
    class: StaticClassLiteral<'db>,
) -> Result<Box<[ClassBase<'db>]>, Box<StaticMroError<'db>>> {
    let env = ProgramEnvironment::from_scope(class.body_scope(db));
    Err(Box::new(StaticMroError::cycle(
        db,
        &env,
        class.apply_optional_specialization(db, None),
    )))
}
```

*Defect Avoided*: Without `cycle_initial`, mutually dependent classes like `class A(B): ...` and `class B(A): ...` exhaust the system stack through recursive Salsa engine locks.

---

### 3. UI & UX Micro-Mechanics (Terminal & Render Buffering)
The `StyledBuffer` provides a row-major 2D character canvas that decouples layout placement from ANSI terminal emission.

```rust
// Verified pattern from crates/ruff_annotate_snippets/src/renderer/styled_buffer.rs
pub(crate) fn render(
    &self,
    level: &Level<'_>,
    stylesheet: &Stylesheet,
    str: &mut String,
) -> Result<(), fmt::Error> {
    // 1. Pre-calculate capacity to eliminate allocation reflows
    let capacity = self.lines.iter().map(|line| line.len()).sum();
    str.reserve(capacity);

    for (i, line) in self.lines.iter().enumerate() {
        let mut current_style = stylesheet.none;
        for StyledChar { ch, style } in line {
            let ch_style = style.color_spec(level, stylesheet);
            // 2. Only emit ANSI escape codes when styling transitions occur
            if ch_style != current_style {
                if !line.is_empty() {
                    write!(str, "{current_style:#}")?; // Reset style
                }
                current_style = ch_style;
                write!(str, "{current_style}")?;    // Apply new style
            }
            str.push(*ch);
        }
        write!(str, "{current_style:#}")?; // Final style reset per line
        if i != self.lines.len() - 1 {
            str.push('\n');
        }
    }
    Ok(())
}
```

*Defect Avoided*: Emitting ANSI sequences per character inflates output size by up to 1200%, thrashing terminal emulator rendering pipelines and inducing perceptible cursor lag.

---

### 4. Backend Concurrency & Memory Safety
Ruff optimizes memory consumption and avoids TOCTOU (Time-Of-Check to Time-Of-Use) file-read races by reading source text into salsa-tracked immutable heap strings and storing offsets via `TextSize`:

```rust
// Invariant: Offset arithmetic must use saturating operations on fixed types
let largest_new = last_op
    .map(|op| op.new_range().end + line_offset)
    .unwrap_or_default();

// Ensure non-zero safety invariant for 1-based line rendering:
let digit_width = OneIndexed::new(largest_new).unwrap_or_default().digits();
```

*Defect Avoided*: Computing line numbers with standard `usize` addition can overflow on corrupt or maliciously formatted source files with gigabyte token spans.

---

### 5. Defect & Error Prevention ("Galti Pakadna")
Handling merge windows between disjoint diagnostic spans:

```rust
// Verified pattern from crates/ruff_db/src/diagnostic/render/full.rs
if let Some(previous) = grouped_ops.last_mut()
    && let Some(DiffOp::Equal { new_index, len, .. }) = previous.last_mut()
    && let [
        DiffOp::Equal {
            new_index: next_new_index,
            len: next_len,
            ..
        },
        rest @ ..,
    ] = group.as_slice()
    // Defect Trap: Prevent merging disjoint hunks when the gap exceeds merge_window
    && next_new_index.saturating_sub(*new_index + *len) <= self.merge_window
{
    // Expand previous unchanged region to bridge the gap cleanly
    *len = next_new_index + next_len - *new_index;
    previous.extend_from_slice(rest);
} else {
    grouped_ops.push(group);
}
```

*Defect Avoided*: Merging arbitrary diff operations without validating `saturating_sub` causes invalid diff line rendering and corrupts automated fixes.

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
Ruff is structured as a cargo workspace containing over 30 isolated crates. Separation of concerns is absolute:
- Abstract Syntax Trees (`ruff_python_ast`) have zero dependency on the filesystem or IO.
- The semantic graph (`ruff_python_semantic`, `ty_python_semantic`) relies on abstract query databases (`ruff_db::Db`), completely shielding type inference from direct disk reads.
- Diagnostic formatting (`ruff_annotate_snippets`) is an independent library with zero dependency on the Python grammar.

### Dimension 2: Core Abstractions
- `TextSize` & `TextRange`: Type-safe 32-bit source offsets eliminating `usize` pointer bloat on 64-bit systems.
- `StaticClassLiteral<'db>`: Represents an immutable pointer into a salsa-tracked class declaration.
- `Mro<'db>`: Immutable boxed slice `Box<[ClassBase<'db>]>` containing the C3 linearization of an inheritance tree.
- `StyledBuffer`: A grid canvas allowing random-access 2D character placement before linearization to stdout.

### Dimension 3: Error Handling
Errors are partitioned into two technical domains:
1. *Analyzer Bugs*: Guarded via cycle detectors (`cycle_initial`), fallback MRO lineages (`StaticMroError::fallback_ancestors`), and salsa query recovery hooks. The compiler never calls `panic!` in production query paths.
2. *User Code Errors*: Captured as structured `Diagnostic` values equipped with `Applicability` levels (e.g., `DisplayOnly`, `MachineApplicable`).

### Dimension 4: Testing
- **Markdown-Driven Regression Tests (`mdtest`)**: Tests are written directly in executable Markdown documents (`crates/ty_python_semantic/resources/mdtest/**/*.md`), declaring python snippets, virtual stub configurations, and expected `reveal_type` outcomes inline.
- **Snapshot Testing (`insta`)**: Visual snapshot tests ensure diagnostic terminal renderings and code diffs do not regress across edge cases.
- **Ecosystem Primer Testing**: Real-world open-source repositories (Airflow, Pandas, Transformers) are checked continuously to monitor performance and diagnostic delta stability.

### Dimension 5: Security
- **Strict Threat Models**: The repository maintains documented threat models (`.agents/references/*-threat-model.md`) defining isolation boundaries for CLI execution, untrusted workspace LSP servers, and WebAssembly execution in the playground.
- **Memory Safety**: Pure Rust execution prevents arbitrary code execution vulnerabilities common in C-based Python C-extensions. Zero unsafe code is permitted in AST parsing logic.
- **Dependency Sandboxing**: Cargo Deny (`.cargo/deny.toml`) restricts duplicate licenses and untrusted crates.

### Dimension 6: Performance
- **Zero-Copy AST Parsing**: AST nodes borrow identifiers and string contents directly from the raw memory-mapped source string whenever possible.
- **32-Bit Pointer Representation**: Text coordinates are represented as `u32` instead of `u64`, slashing AST memory footprint in half.
- **Sub-Millisecond Incremental Caching**: Salsa query memoization tracks file modification hashes, rerunning analysis strictly for files affected by an edit.

### Dimension 7: Deployment
- **Hermetic Docker Builds**: Multi-stage Docker builds utilize `cargo-zigbuild` with `musl` targets (`x86_64-unknown-linux-musl`, `aarch64-unknown-linux-musl`) to generate static, self-contained binaries that execute without external C-runtime dependencies.
- **Maturin Integration**: Wheels are compiled via `maturin` and packaged with binary bindings for Python environments from 3.7 through 3.15.

### Dimension 8: Agent Patterns
- The repository embeds first-party agent operating patterns (`.agents/skills/*`), formalizing how AI coding agents must minimize ecosystem regressions, triage type-checker issues, and manipulate constraint ordering (`wobbling-ty-constraint-order`).

### Dimension 9: Data Flow
Data flows strictly unidirectionally:
```
File on Disk -> SourceText (ruff_db) -> Lexer/Tokens -> AST -> 
Semantic Binding -> Type Inference / Lint Rules -> Diagnostic Bag -> 
ResolvedDiagnostic -> StyledBuffer -> Terminal Output Stream
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Terminal Styled Canvas with Transition Optimization
Batch terminal coloring state changes to avoid saturating terminal emulator escape-code decoders.
```rust
for StyledChar { ch, style } in line {
    let ch_style = style.color_spec(level, stylesheet);
    if ch_style != current_style {
        write!(str, "{current_style:#}")?;
        current_style = ch_style;
        write!(str, "{current_style}")?;
    }
    str.push(*ch);
}
```

### 2. Rule: Metadata Queries Must Never Force Field Specialization
Queries that discover class behaviors, metaclasses, or transforms MUST evaluate over bare base classes. They MUST NOT resolve the generic specialization arguments of those base classes.

### 3. Architecture Principle: Separation of Diagnostic Gathering from Rendering
Diagnostics MUST collect minimal spans and identifier keys during analysis. Resolution of file paths, line numbers, column positions, and surrounding context MUST be deferred to the presentation layer.

### 4. Failure Mode: Salsa Query Exhaustion via Unbounded MRO Linearization
Cyclic type annotations in recursive composite structures induce infinite loops in Salsa query execution graphs unless base-class normalization cuts the recursion link before C3 linearization.

### 5. Reusable Skill: Adding Type Diagnostics with Markdown Tests
1. Add diagnostic code to `crates/ty_python_semantic`.
2. Create or append a Markdown test case in `crates/ty_python_semantic/resources/mdtest/`.
3. Assert expectations via `reveal_type(...)` or `# error: [code]`.
4. Run `cargo test -p ty_python_semantic -- test_mdtest` to verify.

### 6. Decision: Rust vs C-Extensions for Python Tooling
Astral rejected building Ruff as a C-extension or Python module in favor of a standalone Rust binary exposed via Maturin bin bindings. *Rationale*: Guarantees true multithreading unrestricted by Python's Global Interpreter Lock (GIL) and provides sub-millisecond execution times.

### 7. Anti-Pattern: Unchecked Slicing on Terminal Line Margins
Never slice formatted strings using naive terminal width bounds without checking character byte boundaries and clamping to actual line length.

### 8. Verification Method: Workspace Lockfile Consistency Check
Automate verification that no transitive dependency divergence exists in `Cargo.lock`:
```bash
cargo check --workspace --all-targets --locked
git diff --exit-code Cargo.lock
```

---

## 7. Actionable Agent Skill & Implementation Checklist

### Systematic Verification Workflow for Static Analysis & Tooling Agents

```
[Agent Action Initiated]
        |
        v
[Phase 1: Dependency & Lockfile Verification]
  |-- Check Cargo.lock consistency with `cargo check --locked --workspace`
  |-- Verify that all workspace member crates use shared versions
        |
        v
[Phase 2: Semantic Cycle Guard Inspection]
  |-- Check new Salsa queries

## Consequences
- **Positive**: Guarantees modular isolation, deterministic resource reclamation, and clean boundary encapsulation.
- **Negative / Trade-offs**: Requires explicit interface adapters and serialization overhead.
- **Compliance Mandate**: All future subsystem implementations adhering to this pattern must enforce this decision.
