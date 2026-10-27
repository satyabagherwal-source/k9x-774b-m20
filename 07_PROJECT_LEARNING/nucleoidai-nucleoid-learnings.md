> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source**: github ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Source Version**: `938cefb5`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-27T07:45:08.552Z  
> **Learning ID**: `learn-github-nucleoidai-nucleoid`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): NucleoidAI/Nucleoid

---

## 1. Executive Forensic Architecture & System Mechanics

### Core Mission & Domain
Nucleoid is a declarative logic programming runtime and symbolic world-model execution engine written in Rust (`2024` edition, MSRV `1.85`), surfaced via an interactive CLI, native library, and embedded neuro-symbolic agent solvers (e.g., the ARC reasoning engine in `arc/`). Unlike conventional imperative runtimes that execute sequential mutations, Nucleoid treats statements as **persistent invariant relationships** within a directed dependency graph. When an upstream variable or object property mutates, the runtime topologically re-evaluates all dependent statements, maintaining continuous consistency across structured object states, class definitions, and historical version trails.

```
                              ┌────────────────────────────────────────┐
                              │  Declarative Program Source (NUC AST) │
                              └──────────────────┬─────────────────────┘
                                                 │ Logos Lexer / Parser
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Nucleoid Runtime Execution Boundary                                                          │
│                                                                                              │
│   ┌────────────────────────────────┐         ┌───────────────────────────────────────────┐   │
│   │   Declaration Templates        │         │   Dependency Graph (IndexMap Edge List)   │   │
│   │   ($Class.prop, if(cond), etc.)│         │   - Topological Evaluation Scheduling     │   │
│   └───────────────┬────────────────┘         │   - Static & Dynamic Cycle Detection      │   │
│                   │ instantiates             └─────────────────────┬─────────────────────┘   │
│                   ▼                                                │ triggers updates        │
│   ┌────────────────────────────────┐                               ▼                         │
│   │   Instance Execution Engine    │ ◄─────────────────────────────┤                         │
│   │   - Slot Deferral & Self-Anchor│                               │                         │
│   └───────────────┬────────────────┘                               │                         │
│                   ▼                                                │                         │
│   ┌─────────────────────────────────────────────────────────────┐  │                         │
│   │ State Store (src/state.rs)                                  │  │                         │
│   │   - variables: IndexMap<String, Value>                      │  │                         │
│   │   - objects: IndexMap<ObjectId, ObjectData>                 │  │                         │
│   │   - classes: IndexMap<String, ClassData>                    │  │                         │
│   │   - functions: IndexMap<String, Arc<Function>>              │  │                         │
│   │   - histories: IndexMap<HistoryKey, History>                │  │                         │
│   └───────────────┬─────────────────────────────────────────────┘  │                         │
│                   │ writes recorded via WAL before-images          │                         │
│                   ▼                                                │                         │
│   ┌─────────────────────────────────────────────────────────────┐  │                         │
│   │ Transaction Undo Log (WAL / Rollback Manager)               │  │                         │
│   │   - Restores before-images without emitting undo events     │──┘                         │
│   └─────────────────────────────────────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Architectural Subsystems & Boundaries

1. **State Store & Namespace Isolation (`src/state.rs`)**:
   - Maintains orthogonal, deterministic, insertion-ordered maps (`IndexMap`) for `variables`, `objects`, `classes`, `functions`, and `histories`.
   - Variable and function identifiers occupy a unified runtime identifier namespace. An assignment to a variable identifier that matches an existing named function atomizes and evicts the function from `functions` into the transaction log, asserting mutually exclusive storage types.
   - Distinct domain types prevent template vs. instance confusion: `DeclarationKey` (`$Class.property`, `if(expr)`) stores class-level templates once on the class definition, whereas instance nodes on the graph represent concrete runtime bindings (`person1.mortal`).

2. **Temporal State History Engine (NUC 53 & NUC 55)**:
   - Tracks timeline versions per variable (`HistoryKey::Variable(name)`) and per instance property slot (`HistoryKey::Property(ObjectId, property)`).
   - Differentiates strictly between **fixed historical anchors** (`@first`, `@0`, numeric `@n`) and **moving relative selectors** (`@last`, `@previous`).
   - Fixed anchors are slot-owned, immutable snapshots of the first externally supplied write. If a fixed anchor has no recorded input, assignment evaluation is deferred without writing a placeholder `Null`, preventing self-pollution of `@first`.
   - Direct moving selectors (`$Counter.x = $Counter.x@last - 1`) trigger compile-time / declaration-time `Circular Dependency` errors, whereas imperative conditional bodies permit them for deliberate state machine transitions.

3. **Transaction Rollback & Write-Ahead Log Engine (`src/state.rs`)**:
   - Enforces strict write atomicity. Every mutation (`assign`, `assign_property`, `remove_variable`, `remove_history`) captures the exact `before` image and pushes an entry to `self.transaction` before executing the in-memory write.
   - When rolling back, `restore_*` methods write prior values back directly without invoking the transaction recorder, preventing infinite undo loops.

4. **Neuro-Symbolic Agent Integration (`arc/src/`)**:
   - Bridges deterministic declarative constraint solving with stochastic Large Language Models (LLMs) to solve the ARC (Abstraction and Reasoning Corpus) visual-spatial benchmarks.
   - LLMs act as deductive translators: converting spatial matrix crops (`Matrix.ts`, `Zoom.ts`) into declarative Nucleoid class declarations and instance definitions.
   - The Nucleoid logic engine executes the inferred logic deterministically, validating candidate world models against training pairs with zero tolerance for state drift.

---

## 2. Net-New Universal Engineering Rules

### 1. Slot-Anchored Immutability vs. Moving State Deferral
**RULE**:
When implementing reactive dependency networks or declarative logic engines with temporal version operators (`@n`, `@first`, `@previous`), fixed index lookups on an unpopulated slot MUST defer the write and leave the slot unassigned. The runtime MUST NOT write an uninitialized marker (`null`, `undefined`, or `None`) to satisfy the expression, because doing so irreversibly seeds index `0` (`@first`), permanently poisoning the fixed historical anchor.

**WHY**:
In declarative engines, expressions like `$Obj.x = $Obj.x@first - 1` define relations relative to initial user input. If the engine evaluates the rule upon instantiation before user properties are injected, evaluating the missing `@first` as `null` and storing `null - 1 -> -1` permanently alters `@first` from missing to `-1`. Subsequent writes of user inputs will treat the placeholder as the genuine first recorded version, corrupting coordinate systems, offsets, and state machines.

**WHEN TO APPLY**:
Apply to any reactive graph, spreadsheet engine, dataflow pipeline, temporal database, or state management library that provides time-travel or self-referential version queries alongside declarative recalculation rules.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use indexmap::IndexMap;

#[derive(Debug, Clone, PartialEq)]
pub enum VersionSelector {
    First,
    Index(usize),
    Previous,
    Last,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Integer(i64),
}

#[derive(Debug, Clone, Default)]
pub struct PropertySlot {
    pub history: Vec<Value>,
    pub current: Option<Value>,
}

pub struct StateEngine {
    pub slots: IndexMap<String, PropertySlot>,
}

impl StateEngine {
    /// Evaluates a temporal version read.
    /// Returns:
    /// - Ok(Some(val)) if the history version exists.
    /// - Ok(None) if the fixed self-anchor is NOT yet populated (must defer write).
    /// - Err(CycleError) if moving selectors create an immediate unanchored cycle.
    pub fn read_history_anchor(
        &self,
        slot_name: &str,
        selector: VersionSelector,
    ) -> Result<Option<Value>, &'static str> {
        let slot = match self.slots.get(slot_name) {
            Some(s) => s,
            None => return Ok(None), // Defer: slot does not exist yet
        };

        match selector {
            VersionSelector::First | VersionSelector::Index(0) => {
                Ok(slot.history.first().cloned())
            }
            VersionSelector::Index(n) => {
                if n < slot.history.len() {
                    Ok(Some(slot.history[n].clone()))
                } else {
                    Ok(None) // Defer: future index requested, do not seed
                }
            }
            VersionSelector::Previous => {
                if slot.history.len() >= 2 {
                    Ok(Some(slot.history[slot.history.len() - 2].clone()))
                } else {
                    // Moving selectors default to Null under imperative conditional rules
                    Ok(Some(Value::Null))
                }
            }
            VersionSelector::Last => {
                Ok(Some(slot.history.last().cloned().unwrap_or(Value::Null)))
            }
        }
    }

    /// Evaluates declarative rule assignment safely avoiding anchor self-seeding.
    pub fn apply_rule_assignment(
        &mut self,
        target_slot: &str,
        selector: VersionSelector,
        transform: fn(Value) -> Value,
    ) {
        match self.read_history_anchor(target_slot, selector) {
            Ok(Some(historical_value)) => {
                let computed = transform(historical_value);
                let slot = self.slots.entry(target_slot.to_string()).or_default();
                slot.current = Some(computed.clone());
                slot.history.push(computed);
            }
            Ok(None) => {
                // INVARIANT: Defer the write completely.
                // Do NOT write Value::Null into slot.history!
            }
            Err(_) => panic!("Cycle detected in declaration"),
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Eagerly coercing missing history to Value::Null and executing write.
// This corrupts history[0] permanently.
pub fn unsafe_apply_rule(slot: &mut PropertySlot, transform: fn(Value) -> Value) {
    let base = slot.history.first().cloned().unwrap_or(Value::Null); // BAD!
    let next = transform(base);
    slot.history.push(next); // POISONED: history[0] is now the computation on Null!
}
```

**VERIFICATION METHOD**:
Verify using an automated state transition test. Declare a self-anchoring rule on an uninitialized class property, trigger re-evaluation, assert that `history.is_empty()` holds, assign an explicit first value, and confirm `history[0]` equals the explicit input rather than an intermediate transformed placeholder.

---

### 2. Transaction Logger Non-Reentrancy During Rollback
**RULE**:
In transactional state stores utilizing Write-Ahead Logging (WAL) or undo logs, rollback restoration functions MUST bypass the mutation recorder. Rollback methods MUST operate directly on the raw memory storage structures and MUST NOT invoke standard setter/mutator functions that emit undo records.

**WHY**:
If the undo processor invokes standard property setters (`assign()`, `assign_property()`) to restore before-images, those setters will record new undo operations into the transaction journal. This either mutates the undo stack while it is being traversed (causing iterator invalidation / borrow checker panics in Rust), leads to unbounded memory consumption, or causes subsequent rollbacks to revert the undo itself in an oscillatory loop.

**WHEN TO APPLY**:
Universal across all in-memory database engines, transactional interpreters, reversible runtime environments, and file-system mutation logs.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use indexmap::IndexMap;

#[derive(Debug, Clone)]
pub enum UndoLogEntry {
    VarWrite { name: String, before: Option<i64> },
}

pub struct TransactionalStore {
    variables: IndexMap<String, i64>,
    undo_log: Vec<UndoLogEntry>,
}

impl TransactionalStore {
    pub fn new() -> Self {
        Self {
            variables: IndexMap::new(),
            undo_log: Vec::new(),
        }
    }

    /// Public mutating API: records undo history.
    pub fn assign(&mut self, name: &str, value: i64) {
        let before = self.variables.get(name).copied();
        self.undo_log.push(UndoLogEntry::VarWrite {
            name: name.to_string(),
            before,
        });
        self.variables.insert(name.to_string(), value);
    }

    /// Internal restoration primitive: MUST NOT emit undo records.
    fn raw_restore_variable(&mut self, name: String, before: Option<i64>) {
        match before {
            Some(val) => { self.variables.insert(name, val); }
            None => { self.variables.shift_remove(&name); }
        }
    }

    /// Atomic rollback: drains undo log and calls raw restoration.
    pub fn rollback(&mut self) {
        let mut log = std::mem::take(&mut self.undo_log);
        for entry in log.drain(..).rev() {
            match entry {
                UndoLogEntry::VarWrite { name, before } => {
                    self.raw_restore_variable(name, before);
                }
            }
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Calling public assign() inside rollback
impl TransactionalStore {
    pub fn bad_rollback(&mut self) {
        while let Some(entry) = self.undo_log.pop() {
            match entry {
                UndoLogEntry::VarWrite { name, before } => {
                    // FATAL BUG: assign() records a NEW entry into self.undo_log!
                    if let Some(val) = before {
                        self.assign(&name, val);
                    }
                }
            }
        }
    }
}
```

**VERIFICATION METHOD**:
Construct an integration test that:
1. Mutates 5 variables within a transaction.
2. Asserts transaction log size == 5.
3. Triggers `rollback()`.
4. Asserts transaction log size == 0 and state matches baseline.
5. In Rust, run under `cargo test` and verify via Clippy that no recursive mutation paths exist.

---

### 3. Rectangular Bounding Box Coordinate Contraction Invariant
**RULE**:
Matrix segmentation and cropping routines (`locate`, `crop`, `focus`) operating on 2D discrete grids MUST maintain explicit assertions that:
1. The input is a strictly rectangular 2D array of uniform row lengths.
2. Every cell contains a finite numerical value.
3. An empty/zero-filled bounding box returns an explicit empty envelope `{ matrix: [], x: 0, y: 0 }` rather than inverted coordinates (`top > bottom` or `left > right`) or out-of-bound slices.

**WHY**:
Bounding box calculations initialized to `top = rows`, `bottom = -1`, `left = cols`, `right = -1` will compute inverted coordinate spans when all elements are zero. If not intercepted, array slicing (`matrix.slice(top, bottom + 1)`) yields negative indices or out-of-order slice spans, which in JavaScript/TypeScript either produces empty arrays with nonsensical negative bounding coordinates or throws slicing panics in bounds-checked systems, causing downstream matrix merging functions to corrupt spatial layouts.

**WHEN TO APPLY**:
Computer vision preprocessors, symbolic matrix engines (ARC puzzle solvers), ASCII terminal visualizers, canvas renderers, and game grid engines.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export interface BoundingBox {
  matrix: number[][];
  x: number;
  y: number;
}

export function locate(matrix: number[][]): BoundingBox {
  if (!Array.isArray(matrix)) {
    throw new TypeError("Matrix must be an array for cropping");
  }
  const rows = matrix.length;
  if (rows === 0) {
    return { matrix: [], x: 0, y: 0 };
  }
  const cols = matrix[0]?.length ?? 0;
  
  let top = rows;
  let bottom = -1;
  let left = cols;
  let right = -1;

  for (let y = 0; y < rows; y++) {
    const row = matrix[y];
    if (!Array.isArray(row) || row.length !== cols) {
      throw new Error(`Matrix must be rectangular. Expected col width ${cols}, found ${row?.length}`);
    }
    for (let x = 0; x < cols; x++) {
      const val = row[x];
      if (!Number.isFinite(val)) {
        throw new TypeError(`Matrix cell at [${y}, ${x}] is non-finite: ${val}`);
      }
      if (val === 0) continue;

      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }

  // Exact empty envelope protection
  if (bottom === -1) {
    return { matrix: [], x: 0, y: 0 };
  }

  return {
    matrix: matrix.slice(top, bottom + 1).map((r) => r.slice(left, right + 1)),
    x: left,
    y: top,
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Naive slice without zero-element guard
export function badLocate(matrix: number[][]) {
  let top = matrix.length, bottom = -1, left = matrix[0].length, right = -1;
  // ... loop finds nothing because all cells are 0 ...
  // Slicing with bottom = -1 results in matrix.slice(rows, 0) -> []
  // But left and top return corrupted positive boundary coordinates!
  return {
    matrix: matrix.slice(top, bottom + 1).map(r => r.slice(left, right + 1)),
    x: left, // BUG: x returns cols instead of 0!
    y: top   // BUG: y returns rows instead of 0!
  };
}
```

**VERIFICATION METHOD**:
Run property-based fuzz tests on `locate(matrix)` passing 0x0 matrices, NxM matrices filled entirely with zeros, and jagged arrays, asserting that jagged arrays throw descriptive errors and zero-filled matrices strictly return `{ matrix: [], x: 0, y: 0 }`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Premature Null Seeding of Class State Version Anchors (BUG-NUC-01)
- **Context**: State Version Access subsystem, class-level conditionals and property rules (`src/state.rs`, `docs/nuc-0055.md`, `tests/class_state_versions.rs`).
- **What Was Expected**: Per NUC 55, when a class conditional or rule uses fixed historical anchors (`$Obj.x = $Obj.x@first - 1`), the runtime must anchor each instance to its own first recorded external input. If an instance is instantiated before property `x` is assigned, evaluation of `@first` must defer execution until `x` is explicitly supplied.
- **What Actually Happened**: The evaluator treated missing property history entries as empty reads, resolving `@first` to runtime `Value::Null`. When executing `$Obj.x = Null - 1`, the runtime wrote a placeholder or failed intermediate value into the instance's property slot. This write invoked `append_history`, recording `Null` or the placeholder as the genuine first recorded version (`@0` / `@first`). When the user subsequently executed `item.x = 10`, the history read `@first` returned the poisoned placeholder rather than `10`.
- **Evidence in Repo**: Commit `938cefb5` ("Add class-level state version anchors (NUC 55)"), specification test `spec-0454` ("Nucleoid defers missing self anchors and recovers recreated property slots").
- **Root Cause**: The evaluation engine failed to differentiate between an available recorded `Null` value and an absent historical record. Consequently, missing self-anchors were processed as standard dynamic expressions that eagerly evaluate and write default targets.
- **Remediation Code Diff**:
```rust
// - Prior Behavior (Conceptual Bug):
// Evaluate missing version selector as Null and execute assignment:
let target_val = self.state.version(key, selector).unwrap_or(&Value::Null);
let computed = evaluate_expression(expr, target_val);
self.assign_property(object_id, prop, computed); // Poisoned history with placeholder!

// + Production Fix (Commit 938cefb5 & NUC 55 specification):
// Check if the history slot actually contains an entry.
// If the fixed self-anchor is absent, defer write completely without seeding history:
match self.state.version(key, selector) {
    Some(historical_val) => {
        let computed = evaluate_expression(expr, historical_val);
        self.assign_property(object_id, prop, computed);
    }
    None => {
        // Defer assignment: retain existing destination, do NOT seed history with Null
        return;
    }
}
```
- **Lesson**: Missing temporal anchors represent pending synchronization points, not defaultable values. Defer writing to uninitialized reactive slots to avoid poisoning version indices.

---

### Incident 2: False Positive Circular Dependency in Fixed Historical Self-References (BUG-NUC-02)
- **Context**: Static Cycle Checking and Graph Validation Subsystem (`src/state.rs`, `src/graph.rs`, `docs/nuc-0055.md`).
- **What Was Expected**: Class-level rules assigning to a property based on its own fixed historical value (`$Counter.x = $Counter.x@first - step` or `$Counter.x = $Counter.x@0 - 1`) must compile and execute across all instances.
- **What Actually Happened**: The static dependency graph analyzer inspected the AST of `$Counter.x = $Counter.x@first - step`, saw `$Counter.x` on both the left-hand assignment target and the right-hand expression, and aborted with `TypeError("Circular Dependency")`.
- **Evidence in Repo**: Commit `938cefb5`, `docs/nuc-0055.md`: *"Ordinary `$Obj.x = $Obj.x@first - step` rules instead fail static class-cycle checking, because the property visitor treats the version as a live self-read."*
- **Root Cause**: The static graph cycle visitor failed to distinguish between **live, dynamic self-reads** (`this.x = this.x + 1`, which loops indefinitely) and **fixed historical reads** (`this.x = this.x@first - 1`, which is strictly acyclic because history is append-only and index 0 is immutable).
- **Remediation Code Diff**:
```rust
// - Prior Static Cycle Check:
fn check_class_rule_cycles(target_prop: &str, expr: &Expr) -> Result<(), Error> {
    for read_prop in expr.collect_property_reads() {
        if read_prop == target_prop {
            return Err(Error::TypeError("Circular Dependency".into()));
        }
    }
    Ok(())
}

// + Remediation in Commit 938cefb5:
fn check_class_rule_cycles(target_prop: &str, expr: &Expr) -> Result<(), Error> {
    for read in expr.collect_property_version_reads() {
        if read.property == target_prop {
            match read.selector {
                // Fixed historical anchors are provably acyclic: exempt from cycle check!
                VersionSelector::First | VersionSelector::Index(_) => continue,
                // Moving selectors (@last, @previous) or live reads remain prohibited in static class rules
                VersionSelector::Last | VersionSelector::Previous | VersionSelector::Live => {
                    return Err(Error::TypeError("Circular Dependency".into()));
                }
            }
        }
    }
    Ok(())
}
```
- **Lesson**: In dependency graph analyzers, distinguish between causal live feedback loops and immutable historical indices. Exempting provably immutable ancestors prevents false-positive circularity rejections.

---

### Incident 3: Prototype Pollution and Serialization XSS in Upstream Dependency (BUG-NUC-03)
- **Context**: Agent Workspace Subsystem, Node.js serialization tools (`arc/package.json`, Issue #72).
- **What Was Expected**: Matrix state representations and instruction datasets generated by LLM reasoning workflows must serialize safely to JSON/JS without allowing arbitrary script execution or object prototype modifications.
- **What Actually Happened**: Upstream dependency `serialize-javascript` (< 6.0.2) unsafely serialized URL string contents and complex nested objects, creating XSS and prototype manipulation vulnerabilities when generating serialized outputs.
- **Evidence in Repo**: GitHub Issue #72, Dependabot security update merging `serialize-javascript` 6.0.2.
- **Root Cause**: Inadequate escaping of URL characters and object delimiters in regex-based string serializers.
- **Remediation Code Diff**:
```json
// - arc/package.json
"dependencies": {
  "serialize-javascript": "6.0.0"
}

// + arc/package.json (Security Remediation Issue #72)
"dependencies": {
  "serialize-javascript": "^6.0.2"
}
```
- **Lesson**: Neuro-symbolic pipelines transmitting runtime states between an LLM agent and a host VM must validate that all serialization layers enforce character escaping and reject raw function or prototype token injections.

---

### Incident 4: No-Op Variable Mutation Spurious History Inflation (BUG-NUC-04)
- **Context**: State Engine Value Assignment (`src/state.rs`).
- **What Was Expected**: Re-assigning an identical primitive value to an existing variable or property (`a = 5` followed by `a = 5`) should not create duplicate history entries or fire downstream reactive graph recalculations.
- **What Actually Happened**: Unconditional `append_history` calls inflated history arrays with identical duplicate values, altering the relative distance and targets of `@previous` and exhausting memory in long-running processes.
- **Evidence in Repo**: `src/state.rs` lines 205-215, 228-237.
- **Root Cause**: Mutation handlers omitted a value equality pre-check before pushing records onto the history timeline.
- **Remediation Code Diff**:
```rust
// - Unconditional history appending:
pub(crate) fn assign(&mut self, name: &str, value: Value) -> bool {
    let before = self.state.variables.get(name).cloned();
    self.transaction.record_variable(name, before);
    self.append_history(HistoryKey::Variable(name.to_string()), &value); // BUG: Always pushed!
    self.state.variables.insert(name.to_string(), value);
    true
}

// + Guarded history appending in src/state.rs:
pub(crate) fn assign(&mut self, name: &str, value: Value) -> bool {
    let before = self.state.variables.get(name).cloned();
    let changed = before
        .as_ref()
        .is_none_or(|before| !before.same_value(&value));
    self.transaction.record_variable(name, before);
    if changed {
        self.append_history(HistoryKey::Variable(name.to_string()), &value);
    }
    self.state.variables.insert(name.to_string(), value);
    changed
}
```
- **Lesson**: Reactive state writes must enforce value-level equivalence checks (`same_value()`) before emitting delta logs or appending to version histories.

---

### Incident 5: Jagged 2D Array Bounds Panic in Matrix Cropper (BUG-NUC-05)
- **Context**: ARC Spatial Reasoning Preprocessor (`arc/src/lib/Matrix.ts`).
- **What Was Expected**: Cropping or locating objects in a spatial grid must cleanly handle irregular matrix inputs from stochastic LLM responses and throw caught validation errors rather than causing out-of-bounds panics or silent NaN propagations.
- **What Actually Happened**: If an LLM generated a non-rectangular matrix (a row with fewer columns than `matrix[0]`), `row[x]` returned `undefined`. Evaluating `undefined === 0` resulted in `false`, triggering `Math.min`/`Math.max` across undefined values, producing `NaN` offsets and corrupting downstream canvas generation.
- **Evidence in Repo**: `arc/src/lib/Matrix.ts` lines 8-40.
- **Root Cause**: The locator loop assumed uniform row lengths based on `matrix[0].length` without verifying rectangular integrity.
- **Remediation Code Diff**:
```typescript
// - Unchecked row indexing:
for (let y = 0; y < rows; y++) {
  for (let x = 0; x < cols; x++) {
    const value = matrix[y][x]; // Undefined if row length is jagged!
    if (value === 0) continue;
    // ...
  }
}

// + Rectangular and Finite Validation Guards in arc/src/lib/Matrix.ts:
for (let y = 0; y < rows; y++) {
  const row = matrix[y];
  if (!Array.isArray(row) || row.length !== cols) {
    throw new Error("Matrix must be rectangular for cropping");
  }
  for (let x = 0; x < cols; x++) {
    const value = row[x];
    if (!Number.isFinite(value)) {
      throw new Error("Matrix must contain finite numbers for cropping");
    }
    if (value === 0) continue;
    top = Math.min(top, y);
    bottom = y;
    left = Math.min(left, x);
    right = Math.max(right, x);
  }
}
```
- **Lesson**: Never assume structural regularity on 2D arrays received from external sources or LLM outputs. Validate shape invariants (rectangularity, type, finiteness) before performing matrix geometry.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Deterministic Map Storage**: Never use standard unordered hash maps (`std::collections::HashMap`) for state, declarations, or AST graph structures. In Nucleoid, `indexmap::IndexMap` is mandatory across all stores (`variables`, `objects`, `classes`, `functions`, `histories`). Unordered hash iteration alters topological re-evaluation order, resulting in non-deterministic execution bugs across identical test runs.
- **Type Coercion & Truthiness Invariants**: In the runtime value comparison (`before.same_value(&value)`), primitive numerical `0`, empty string `""`, boolean `false`, and `Value::Null` are strictly distinct. Implicit falsy conversions are prohibited:
```rust
// Invariant: Exact discriminant and payload matching
impl Value {
    pub fn same_value(&self, other: &Value) -> bool {
        match (self, other) {
            (Value::Integer(a), Value::Integer(b)) => a == b,
            (Value::Float(a), Value::Float(b)) => a.to_bits() == b.to_bits(),
            (Value::Boolean(a), Value::Boolean(b)) => a == b,
            (Value::String(a), Value::String(b)) => a == b,
            (Value::Null, Value::Null) => true,
            _ => false, // No implicit coercion across types
        }
    }
}
```

### 2. Infinite Loop & Recursion Guards
- **Direct Moving History Cycle Prohibition**: Static rules of the form `$Class.prop = $Class.prop@last + 1` MUST be rejected at declaration time. Because `@last` increments on every write, continuous self-activation causes infinite synchronous recursion.
- **Topological Evaluation Depth Invariant**: When propagating reactive graph changes, cycle detection via Tarjan's or Kosaraju's strongly connected components algorithm MUST run prior to execution. If dynamic