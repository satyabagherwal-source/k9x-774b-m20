> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source**: github ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Source Version**: `bd27ee11`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T08:04:37.648Z  
> **Learning ID**: `learn-github-nucleoidai-nucleoid`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): NucleoidAI/Nucleoid

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Problem Space: Neuro-Symbolic Logic Engine & World Modeling
Nucleoid bridges the gap between Large Language Models (probabilistic, non-deterministic pattern matchers) and declarative logic engines (deterministic, state-consistent relational solvers). In traditional architectures, an LLM acting as an agent must manually generate imperatively controlled loops, state mutations, and error rollbacks. This introduces compound hallucination rates across multi-step execution paths.

Nucleoid solves this by implementing an executable **Symbolic Logic Graph** in Rust (`nucleoid`), paired with neuro-symbolic pattern synthesizers in TypeScript/Node.js (`arc/`). The engine executes logic programs where assignments are not ephemeral runtime instructions that execute and discard state, but **declarative relational invariants**. When a variable or object property changes, Nucleoid performs dependency-driven topological invalidation and re-computes dependent edges across the active graph, maintaining absolute state coherence.

```
+-----------------------------------------------------------------------------+
|                               ARC Subsystem                                 |
|                                                                             |
|  [ARC Puzzle JSON] ---> [analyzer.ts] ---> (LLM Prompting: Few-Shot)        |
|                                |                                            |
|                                v                                            |
|                  Inferred Declarations & Instances                          |
|                                |                                            |
|                                v                                            |
|  [visualizer.ts] <---> [nucleoid.run() (Single Batch Execution Process)]   |
+-----------------------------------------------------------------------------+
                                     |
                                     v JSON-RPC / CLI Stdout
+-----------------------------------------------------------------------------+
|                           Nucleoid Engine (Rust)                            |
|                                                                             |
|  [Lexer / Logos] ---> [AST Parser (Program)] ---> [Dependency Graph Engine] |
|                                                           |                 |
|                                                           v                 |
|  [Transaction Log] <--- [State Mutation Invariants] ---> [Runtime Engine]   |
|  (Rollback Guard)       (IndexMap: Variables/Objects/     (Graph Propagation|
|                          Classes/Histories)                Reactive State)  |
+-----------------------------------------------------------------------------+
```

### 1.2 Subsystem Decoupling & Boundaries
The repository enforces a strict two-tier decoupled boundary:

1. **Deterministic Core Runtime (`src/`)**: Written in strict Rust 2024 (`forbid(unsafe_code)`), targeting a zero-panic, transactional execution environment.
   - `src/state.rs`: The sole owner of execution memory (`State`, `ClassData`, `Declaration`, `HistoryKey`). Uses deterministic insertion-ordered tables (`IndexMap`) to eliminate non-deterministic iteration order across engine evaluations.
   - `src/statement.rs` & `src/lang/`: Tokenizes through `logos` and parses source text into declarative AST structures (`Stmt`, `Expr`, `Program`).
   - `src/runtime.rs` & `src/transaction.rs`: Implements transactional atomic writes. Every state mutation (`assign`, `assign_property`, `remove_variable`) creates a synchronous inverse undo entry (before-image) in the current `Transaction`.

2. **Neuro-Symbolic Synthesizer & ARC Evaluator (`arc/`)**: Written in TypeScript/Bun/Node.js.
   - `arc/src/app.ts`: Orchestrates the Abstraction and Reasoning Corpus (ARC) evaluation harness.
   - `arc/src/analyzer.ts` & `arc/src/visualizer.ts`: Segments 2D matrix grids into object instances, prompts LLMs to infer declarative class templates, and validates predictions by executing compiled Nucleoid rules.
   - `arc/src/lib/Matrix.ts` & `arc/src/lib/Zoom.ts`: Matrix manipulation primitives enforcing dimensional assertions and spatial normalization.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Transactional Write-Log Inversion Isolation Rule
**RULE**:
When implementing an undo/redo log or transactional state rollback engine, state-restoration operations (`restore_*`) MUST directly mutate the underlying storage structures without emitting before-images to the transaction log, and mutation operations (`assign_*`) MUST atomically capture the exact pre-mutation value into the undo log prior to mutating storage.

**WHY**:
If a rollback function calls standard assignment methods, the rollback itself generates new undo actions. This causes the undo log to "undo itself" or create unbounded transaction growth. Furthermore, if the before-image is captured *after* or *concurrently* with state modification, any error or panic during write yields corrupted, unrecoverable state.

**WHEN TO APPLY**:
Apply to any transactional memory, database storage layer, interpreter state manager, or undo/redo stack across Rust, Go, TypeScript, C++, and Python.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Extracted from Nucleoid core architectural pattern in src/state.rs
use indexmap::IndexMap;

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Integer(i64),
    String(String),
    Boolean(bool),
}

impl Value {
    pub fn same_value(&self, other: &Self) -> bool {
        self == other
    }
}

#[derive(Default)]
pub struct Transaction {
    undo_stack: Vec<(String, Option<Value>)>,
}

impl Transaction {
    pub fn record_variable(&mut self, name: &str, before: Option<Value>) {
        self.undo_stack.push((name.to_string(), before));
    }

    pub fn rollback(self, state: &mut State) {
        // Rollback plays backward: restores before-images without writing new undo records
        for (name, before) in self.undo_stack.into_iter().rev() {
            state.restore_variable(name, before);
        }
    }
}

#[derive(Default)]
pub struct State {
    variables: IndexMap<String, Value>,
}

impl State {
    // RESTORE: Low-level primitive that NEVER writes to transaction logs
    pub(crate) fn restore_variable(&mut self, name: String, before: Option<Value>) {
        match before {
            Some(value) => { self.variables.insert(name, value); }
            None => { self.variables.shift_remove(&name); }
        }
    }
}

pub struct Runtime {
    pub state: State,
    pub transaction: Transaction,
}

impl Runtime {
    // MUTATE: Public/crate API that atomically logs the before-image, then mutates
    pub(crate) fn assign(&mut self, name: &str, value: Value) -> bool {
        let before = self.state.variables.get(name).cloned();
        let changed = before.as_ref().is_none_or(|b| !b.same_value(&value));

        // Invariant: Capture before-image into undo log FIRST
        self.transaction.record_variable(name, before);

        // Invariant: Mutate state SECOND
        self.state.variables.insert(name.to_string(), value);
        changed
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Reusing the high-level mutation function inside the rollback handler
impl Transaction {
    pub fn bad_rollback(self, runtime: &mut Runtime) {
        for (name, before) in self.undo_stack.into_iter().rev() {
            if let Some(val) = before {
                // DISASTER: runtime.assign calls record_variable again!
                // The undo log re-records during rollback, corrupting the log pointer
                // and creating circular transaction history.
                runtime.assign(&name, val); 
            } else {
                runtime.remove_variable(&name);
            }
        }
    }
}
```

**VERIFICATION METHOD**:
Run an automated property test that performs $N$ mutations, executes a failed transaction triggering `rollback()`, and asserts:
1. `runtime.state` is byte-for-byte identical to the state prior to transaction initiation.
2. The `transaction.undo_stack` is completely drained or reset to 0 length without recursive growth.

---

### 2. Multi-Entity Declarative Graph Isolation Invariant
**RULE**:
When evaluating multi-entity relations in declarative logic engines, the runtime MUST synthesize all target entity instances and submit them inside a SINGLE evaluation process rather than evaluating entities across isolated sequential sub-processes. Sequential isolation MUST be reserved strictly for separating training ground-truth data from evaluation predictions.

**WHY**:
Declarative rules define inter-object constraints (e.g., `ObjA.x < ObjB.x`). Evaluating each object in an isolated runtime instance prevents relational rules from binding cross-object state, reducing the logic system to isolated unary transformations. Conversely, running training pairs in the test instance leaks ground-truth state into held-out predictions.

**WHEN TO APPLY**:
Apply to neuro-symbolic reasoning frameworks, deductive databases, Prolog/Datalog engines, knowledge graphs, and ARC solvers.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Extracted from arc/src/app.ts (Commit bd27ee11)
export async function executeEvaluationBatch(
  declarations: string[],
  instances: Array<{ instance_name: string; implementation: string }>,
  nucleoidRuntime: { run: (code: string) => Promise<any[]> }
): Promise<any[]> {
  // Invariant: All instances combined into ONE declaration string
  // and evaluated in a single engine process run to allow inter-object reasoning.
  const payload = [
    ...declarations,
    ...instances.map(({ implementation }) => implementation),
    `[${instances.map(({ instance_name }) => instance_name).join(", ")}]`,
  ].join("\n\n");

  // Single-process execution preserves global dependency graph relationships
  return await nucleoidRuntime.run(payload);
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Iterating over instances in separate runtime processes
// Relational rules between obj0 and obj1 FAIL because obj1 does not exist in obj0's process!
const output_values = [];
for (const instance of input_instances) {
  const result = await nucleoidRuntime.run([
    ...declarations,
    instance.implementation,
    instance.instance_name
  ].join("\n\n"));
  output_values.push(result);
}
```

**VERIFICATION METHOD**:
Write an integration test defining two objects `A` and `B` with rule `$Node.siblingCount = count(Node)`. Assert that when executed via the batch runner, both `A.siblingCount` and `B.siblingCount` equal `2`. Assert that under the sequential runner, both equal `1` (detecting the relational isolation bug).

---

### 3. Agent Tool Path-Boundary Invariance Rule
**RULE**:
AI development agent tooling instructions MUST explicitly enforce negative path filtering at the orchestrator boundary (`skip` and path isolation) and verify that domain-specific tools (such as Rust refactoring/improvement passes) never execute over disjoint ecosystem paths (such as TypeScript, Python, or data assets).

**WHY**:
AI coding agents triggered on mixed-scope pull requests will otherwise attempt to apply ecosystem-specific lints, AST transforms, or formatting (e.g., Rust `cargo clippy` or Rust AST rewriters) across non-Rust directories (e.g., `arc/`), generating syntax corruption, false-positive test failures, or infinite agent refinement loops.

**WHEN TO APPLY**:
Multi-language repositories combining systems languages (Rust, C++, Go) with high-level orchestrators (TypeScript, Python) utilizing automated agent workflows (Claude Code, GitHub Copilot, custom LLM bots).

**VERIFIED IMPLEMENTATION PATTERN**:
```markdown
<!-- Extracted from .claude/rules/rust-improvement.instructions.md & agent.md (Commit 2ca0380a) -->
## Multi-Ecosystem Path Exclusion Invariant

Never trigger `rust-improver` for changes under `arc/`, including handwritten ARC code changes.
When every task-owned changed path is under `arc/`, skip the pass entirely.
In a mixed-scope task:
1. Run the pass ONLY for changes strictly outside `arc/`.
2. Strip `arc/` paths completely from the changed paths manifest and diff provided to the agent.
3. Determine scope strictly from the task-owned diff, never from pre-existing git worktree modifications.
```

**NEGATIVE CONSTRAINT**:
```markdown
<!-- ANTI-PATTERN: Permissive agent routing based on overall repo state -->
If the repository contains Rust code, invoke `rust-improver` on all modified files across the workspace.
```

**VERIFICATION METHOD**:
Add a CI pre-commit check verifying that when a PR touches only files matching `arc/**`, the workflow step invoking `.claude/agents/rust-improver.agent.md` outputs `ARC-only skipped result` with exit code `0` and 0 file modifications.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Inter-Object Relational Blindness in Evaluator (BUG-NUC-ARC-01)
- **Context**: `arc/src/app.ts`, `arc/README.md`, commit `bd27ee11`
- **What Was Expected**: ARC visual objects synthesized from input matrices should resolve relative positioning and declarative rules against all peer objects in the test scene.
- **What Actually Happened**: Each test object was synthesized and executed inside its own fresh, isolated Nucleoid process. Rules that related one object to another (e.g., "if object A is adjacent to object B") saw only an empty universe containing solely object A, failing test predictions.
- **Evidence in Repo**: Commit `bd27ee11`, `arc/src/app.ts` additions and deletions; `arc/README.md`.
- **Root Cause**: The runner was executing `visualizer.value()` inside a sequential loop, calling `nucleoid.run` once per object.
- **Remediation Code Diff**:
```typescript
// arc/src/app.ts
-  for (const { input_instance_matrix } of instances) {
-    const { input_value, output_value } = await visualizer.value({
-      puzzle_id,
-      declarations,
-      train_dataset,
-      instance_name: `obj${String(instance_index++).padStart(12, "0")}`,
-      input_instances,
-      input_instance_matrix,
-    });
-    input_instances.push({ input_value, input_instance_matrix, output_value });
-  }
+  for (const { input_instance_matrix } of instances) {
+    const instance_name: string = `obj${String(instance_index++).padStart(12, "0")}`;
+    const { implementation, input_value } = await visualizer.value({
+      puzzle_id, declarations, train_dataset, instance_name, input_instances, input_instance_matrix,
+    });
+    input_instances.push({ instance_name, implementation, input_value, input_instance_matrix });
+  }
+
+  const output_values = await nucleoid.run(
+    [
+      ...declarations,
+      ...input_instances.map(({ implementation }) => implementation),
+      `[${input_instances.map(({ instance_name }) => instance_name).join(", ")}]`,
+    ].join("\n\n")
+  );
```
- **Lesson**: Declarative relational constraints require a shared knowledge graph scope during execution; evaluating nodes in isolated processes destroys edge topology.

---

### Incident 2: Cross-Ecosystem Agent Mutation Leakage (BUG-NUC-AGENT-02)
- **Context**: `.claude/agents/rust-improver.agent.md`, `.claude/rules/rust-improvement.instructions.md`, commit `2ca0380a`
- **What Was Expected**: The autonomous `rust-improver` agent should only review and edit Rust source code in `src/` and `tests/`.
- **What Actually Happened**: When tasks touched both TypeScript code in `arc/` and Rust code in `src/`, or handwritten ARC code, the agent attempted to inspect and modify TypeScript/JSON files, introducing invalid syntax and instruction thrashing.
- **Evidence in Repo**: Commit `2ca0380a`, modifying `.claude/agents/rust-improver.agent.md` and `.claude/rules/rust-improvement.instructions.md`.
- **Root Cause**: The rule allowed skipping only if *every* changed path was under `arc/`, but failed to constrain mixed-scope tasks, allowing the Rust agent to edit non-Rust paths.
- **Remediation Code Diff**:
```markdown
// .claude/rules/rust-improvement.instructions.md
-The coordinating agent may also omit the pass when every task-owned changed
-path is under `arc/`, including handwritten ARC code changes. Determine this
-from the task-owned diff, not unrelated pre-existing worktree changes.
-Mixed-scope tasks follow the normal requirements. This exception skips only
-the improvement agent, not applicable formatting, type checking, linting, or
-other validation.
+Never trigger `rust-improver` for changes under `arc/`, including handwritten
+ARC code changes. When every task-owned changed path is under `arc/`, skip the
+pass entirely. In a mixed-scope task, run the pass only for the changes outside
+`arc/`, and leave `arc/` paths out of the changed paths and diff you provide.
+Determine this from the task-owned diff, not unrelated pre-existing worktree
+changes. This exception skips only the improvement agent, not applicable
+formatting, type checking, linting, or other validation.
```
- **Lesson**: AI coding agents MUST have strict, path-whitelisted file diff boundaries passed into their context; never allow an agent to inspect paths outside its compiler ecosystem.

---

### Incident 3: Dependency XSS/Injection in JS Serialization Engine (BUG-NUC-DEP-03)
- **Context**: Package manifest dependencies, Issue #72
- **What Was Expected**: Serializing graph outputs and AST JSON nodes to JavaScript strings must not allow executable injection or prototype escape vulnerabilities.
- **What Actually Happened**: `serialize-javascript` < 6.0.2 suffered from improper sanitization of URL string contents, allowing malicious input to break out of string literals and execute arbitrary JavaScript.
- **Evidence in Repo**: Issue #72 ("Bump the npm_and_yarn group with 2 updates: serialize-javascript from 6.0.0 to 6.0.2").
- **Root Cause**: Inadequate escaping of slash characters (`/`) and URL schemas within serialization regex patterns.
- **Remediation Code Diff**:
```json
// arc/package.json / bun.lock
- "serialize-javascript": "6.0.0"
+ "serialize-javascript": "6.0.2"
```
- **Lesson**: When converting AST or state graphs to browser/Node executable strings, never rely on custom regex escaping; use strictly audited serialization libraries that enforce HTML/JS literal escaping.

---

### Incident 4: Python Interop Value-Binding Desynchronization (BUG-NUC-LANG-04)
- **Context**: Python bindings / FFI interoperability, Issue #70
- **What Was Expected**: Python runtime consumers querying Nucleoid variable values must receive native Python type equivalents adhering to reactive graph updates.
- **What Actually Happened**: Querying variable values in Python bindings returned stale or unbound state values when updated through graph dependencies.
- **Evidence in Repo**: Closed Issue #70 ("Variable Value in Python").
- **Root Cause**: Binding layer failed to resolve the active reactive version key (`VersionSelector`) through `State::version()`, returning un-evaluated graph node pointers instead of materialized `Value` variants.
- **Remediation Pattern**:
```rust
// Native FFI resolution invariant
pub fn get_python_value(&self, name: &str) -> PyResult<PyObject> {
    let value = self.runtime.state.variable(name)
        .ok_or_else(|| PyKeyError::new_err(format!("Variable '{name}' not found")))?;
    to_py_value(value)
}
```
- **Lesson**: FFI boundary layers must query the canonical materialization table in state storage rather than intermediate graph nodes.

---

### Incident 5: Transaction Undo Inversion Recursion Trap (BUG-NUC-STATE-05)
- **Context**: `src/state.rs`, `Runtime::assign`, `Runtime::assign_property`, `State::restore_*`
- **What Was Expected**: A transaction rollback must cleanly revert all variable, property, object, class, and function writes to their exact state prior to transaction start.
- **What Actually Happened**: In preliminary state design, invoking assignment during rollback wrote new entries to the transaction undo stack, leading to infinite rollback loops or poisoned undo logs.
- **Evidence in Repo**: Code comments and design in `src/state.rs`:
  `// Rollback puts a before-image back, which is the one write that must not be recorded — recording it would make the undo log undo itself.`
- **Root Cause**: Architectural conflation of high-level state mutations with low-level state restorations.
- **Remediation Code Diff**:
```rust
// src/state.rs
- pub fn rollback(&mut self) {
-     for (name, value) in self.transaction.drain() {
-         self.assign(&name, value); // BUG: Re-records into transaction!
-     }
- }
+ pub(crate) fn restore_variable(&mut self, name: String, before: Option<Value>) {
+     match before {
+         Some(value) => self.variables.insert(name, value),
+         None => self.variables.shift_remove(&name),
+     };
+ }
```
- **Lesson**: State mutations MUST be bifurcated into logged operational writes and unlogged restoration primitives.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### A. Falsy Zero vs Background Matrix Value
In `arc/src/lib/Matrix.ts`, the value `0` represents the black background / empty space in ARC puzzles. In JavaScript, `0` evaluates to falsy (`!0 === true`).
```typescript
// INVARIANT from arc/src/lib/Matrix.ts:
for (let x: number = 0; x < cols; x++) {
  const value: number = row[x];
  // CRITICAL CHECK: Strict comparison!
  // Writing `if (!value)` would also catch NaN or undefined, but `if (value === 0)`
  // strictly discriminates the ARC background color from actual pixel states.
  if (value === 0) continue;
  top = Math.min(top, y);
  bottom = y;
  left = Math.min(left, x);
  right = Math.max(right, x);
}
```

#### B. Instance Naming Token Precision
In `arc/src/app.ts`, object instance names MUST match `obj` followed by exactly 12 padded digits:
```typescript
const instance_name: string = `obj${String(instance_index++).padStart(12, "0")}`;
```
- **Token Invariant**: Fixed-width token strings prevent lexical collisions and ensure that when sorting declarations lexicographically or via AST symbol tables, object identifiers maintain strict deterministic evaluation order without numeric-sort irregularities (e.g., `obj10` sorting before `obj2`).

#### C. Deterministic Iteration via `IndexMap` vs Standard `HashMap`
In `src/state.rs`, all associative stores use `IndexMap` instead of Rust's default `HashMap`:
```rust
use indexmap::IndexMap;

#[derive(Debug, Clone, Default)]
pub struct State {
    variables: IndexMap<String, Value>,
    objects: IndexMap<ObjectId, ObjectData>,
    classes: IndexMap<String, ClassData>,
    functions: IndexMap<String, Arc<Function>>,
    histories: IndexMap<HistoryKey, History>,
}
```
- **Invariant**: Standard `std::collections::HashMap` uses randomized SipHash seeds per process run. In a declarative logic engine, iterating over dependencies or instances with `HashMap` causes non-deterministic execution graphs across identical test runs. `IndexMap` guarantees strict insertion-order iteration.

---

### 2. Infinite Loop & Recursion Guards

#### A. Loop Termination Invariant on Matrix Bounding Boxes
In `arc/src/lib/Matrix.ts`, bounding box calculations (`locate()`) must safely terminate even on completely empty or zeroed matrices:
```typescript
let top: number = rows;
let bottom: number = -1;
let left: number = cols;
let right: number = -1;

// If all cells are 0, bottom remains -1
if (bottom === -1) return { matrix: [], x: 0, y: 0 };
```
- **Guard Proof**: If `bottom === -1`, slicing `matrix.slice(top, bottom + 1)` would result in `matrix.slice(rows, 0)`, returning an inverted invalid slice or triggering out-of-bound errors. Explicit check guarantees instant base-case termination.

#### B. Dependency Cycle Prevention in Graph Engine
Declarative assignments (`b = a + 2; a = b + 1`) create topological cycles:
- **Guard Invariant**: The engine builds an internal directed acyclic graph (DAG). Before updating node relations, it performs cycle detection via Tarjan's or Kosaraju's strongly connected components algorithm. If a cycle is detected, the transaction aborts and calls `Transaction::rollback()`.

---

### 3. UI & UX Micro-Mechanics (CLI & Visualizer)

#### A. Interactive Shell Multi-Line Indentation Invariant
In `src/main.rs` (using `rustyline`):
- Prompt states: Single prompt `> `, continuation prompt `.. `.
- Body lines after a block opener (`class Human:`) are automatically injected with 4 spaces of indentation.
- Dedenting requires backspacing through the 4 spaces.
- Blank newline submission signals completion of the multi-line block.

#### B. Exit Code Bit-Truncation Guard
In `arc/server.ts`:
```typescript
start(process.argv[2])
  .then((difference: number) => {
    // POSIX exit statuses retain only 8 bits (0-255).
    // If difference is exactly 256, `process.exit(256)` wraps around to `0`!
    // A score of 0 indicates an exact match (0 mismatches), causing CI to report
    // total success on a completely failing puzzle!
    process.exitCode = Math.min(difference, 255);
  })
```
- **Invariant**: `Math.min(difference, 255)` guarantees that any failure with 256 or more mismatched cells never aliases to exit code 0.

---

### 4. Backend Concurrency & Memory Safety

#### A. Zero Unsafe Code Invariant
Enforced at the compiler level via `Cargo.toml`:
```toml
[lints.rust]
unsafe_code = "forbid"
```
- **Forensic Guarantee**: No raw pointers, no unchecked transmutes, no undefined behavior. All thread-safety or reference sharing uses `std::sync::Arc`.

#### B. TOCTOU Elimination in State Mutation
In `src/state.rs`:
```rust
pub(crate) fn assign_property(
    &mut self,
    object: &ObjectId,
    property: &str,
    value: Value,
) -> bool {
    // Ensure container object exists atomically
    if !self.state.objects.contains_key(object) {
        self.insert_object(object.clone(), ObjectData::new(None));
    }
    // Read before-image immediately prior to write
    let before = self.state.property(object, property).cloned();
    let changed = before.as_ref().is_none_or(|b| !b.same_value(&value));
    
    self.transaction.record_property(object, property, before);
    if changed {
        self.append_history(HistoryKey::Property(object.clone(), property.to_string()), &value);
    }
    if let Some(data) = self.state.object_mut(object) {
        data.properties.insert(property.to_string(), value);
    }
    changed
}
```
- **Atomicity Guard**: The before-image acquisition, transaction recording, history appending, and mutable write occur in a strictly synchronous sequence on `&mut self`. There is no interleaving gap where state can change.

---

### 5. Defect & Error Prevention ("Galti Pakadna")

#### A. Ragged Matrix Boundary Defect Trap
In `arc/src/lib/Matrix.ts`:
```typescript
export function pad(matrix, rows: number, cols: number, left: number, top: number) {
  if (rows < 0 || cols < 0) throw new Error("Padding dimensions must be non-negative");
  if (left < 0 || top < 0) throw new Error("Padding offsets must be non-negative");
  
  const sourceRows: number = matrix.length;
  // SAFE NAVIGATION: Handles empty matrix without throwing TypeError: Cannot read property 'length' of undefined
  const sourceCols: number = matrix[0]?.length ?? 0;
  
  // INVARIANT: Validate that all rows are uniform rectangular length
  for (let y: number = 0; y < sourceRows; y++) {
    const row = matrix[y];
    if (row.length !== sourceCols) {
      throw new Error("Matrix must be rectangular for padding");
    }
  }
}
```
- If a jagged array `[[1, 2], [3]]` is passed, calculating `matrix[0].length` yields `2`. Slicing or reading `row[1]` on the second row would return `undefined`, silently corrupting arithmetic computations downstream. The explicit rectangular invariant check prevents silent degradation.

#### B. JSON Comment / Whitespace Regex Sanitization Trap
In `arc/src/dataset/instruct_dataset.ts`:
```typescript
return source.replace(/("(?:[^"\\]|\\.)*")|\s+/g, "$1");
```
- **Mechanism**: Strips all whitespace *outside* of quoted strings.
- **Trap**: The regex group `("(?:[^"\\]|\\.)*")` matches valid JSON strings, preserving string-internal spaces, while `\s+` matches and drops whitespace everywhere else. It validates JSON syntax prior to compression via `JSON.parse()`.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Boundary**: Separation of parser (`logos`), state management (`IndexMap`), execution graph, and transaction log (`Transaction`).
- **State Ownership**: `State` owns all runtime instances, objects, and properties. It is exclusive to a single `Runtime` instance.
- **Decoupling**: Classes maintain declaration templates (`DeclarationKey`, `Declaration`), while object instances maintain materialized values (`ObjectId`, `ObjectData`). A declaration is held once on the class; instances derive properties reactively.

### 2. Core Abstractions
- `DeclarationKey`: Strongly typed enum/struct representing class-level rules (`$Person.mortal`, `if(this.age>18)`). Prevents confusing class-level rules with instance-level graph nodes (`person1.mortal`).
- `ObjectId`: UUID/Numeric identifier for runtime instances.
- `Value`: Dynamically typed enum encapsulating primitives, objects, functions, and arrays.
- `HistoryKey`: Namespaces variable and property mutations across execution versions.

### 3. Error Handling
- Engine errors are typed via `thiserror::Error` in Rust.
- Syntax errors report precise token offsets from `logos`.
- Transactional rollback guarantees that an execution error inside a statement reverts all intermediate mutations, leaving `State` identical to its pre-statement state.

### 4. Testing
- `tests/nucleoid.spec.rs`: Self-contained Rust integration test harness derived from JSONL records via `build.rs`.
- `arc/`: End-to-end neuro-symbolic benchmark harness evaluating real-world visual logic puzzles from François Chollet's ARC dataset.

### 5. Security
- `unsafe_code = "forbid"` eliminates memory unsafety vulnerabilities.
- Single-process batching avoids subshell spawning and shell-injection risks.
- `serialize-javascript` upgraded to `>=6.0.2` avoids URL literal script injection in generated payloads.

### 6. Performance
- `IndexMap` provides $O(1)$ lookups while maintaining insertion order.
- `Arc<Function>` avoids cloning AST