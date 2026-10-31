> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tursodatabase-limbo-learnings.md`  
> **Source**: github ([https://github.com/tursodatabase/limbo](https://github.com/tursodatabase/limbo))  
> **Source Version**: `8193b024`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-31T21:10:36.916Z  
> **Learning ID**: `learn-github-tursodatabase-turso`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): tursodatabase/turso

---

## 1. Executive Forensic Architecture & System Mechanics

Turso (incorporating the Limbo engine) is an in-process, modular SQL database written in Rust. Architecturally, it decouples the database engine using an approach analogous to LLVM: frontends parse and translate distinct SQL dialects (SQLite and PostgreSQL wire/parser frontends) into an intermediate virtual machine bytecode—the Virtual Database Engine (VDBE). The VDBE executes against an asynchronous storage engine featuring Multi-Version Concurrency Control (MVCC) and page-level I/O abstractions.

```
+-----------------------------------------------------------------------------------+
|                                Client Frontends                                   |
|   +--------------------+  +----------------------+  +-------------------------+   |
|   | SQLite 3 CLI / SDK |  | PostgreSQL pgwire /   |  | Foreign Language FFI   |   |
|   | (libsqlite3 C API) |  | Parser Frontend      |  | (JNI, JSI, Python, WASM)|   |
+---+---------+----------+--+----------+-----------+--+------------+------------+---+
              |                        |                           |
              v                        v                           v
+-----------------------------------------------------------------------------------+
|                            Query Compiler & Planner                               |
|   +------------------------------------+  +-----------------------------------+   |
|   | SQLite Parser (AST -> Logical Plan)|  | PostgreSQL Parser & Type System   |   |
|   +-----------------+------------------+  +-----------------+-----------------+   |
|                     +-------------------+-------------------+                     |
|                                         |                                         |
|                                         v                                         |
|                       +-----------------------------------+                       |
|                       |  Bytecode Translator (Codegen)    |                       |
|                       |  Emits VDBE Opcode Stream         |                       |
|                       +-----------------+-----------------+                       |
+-----------------------------------------|-----------------------------------------+
                                          v
+-----------------------------------------------------------------------------------+
|                        Virtual Database Engine (VDBE)                             |
|   +---------------------------------------------------------------------------+   |
|   | Register Machine: Scalar/Vector Ops, Cmp, Branching, Subprograms          |   |
|   | Row-Image Cache, Generated Column Evaluator, Constraint Validator         |   |
|   +-------------------------------------+-------------------------------------+   |
+-----------------------------------------|-----------------------------------------+
                                          v
+-----------------------------------------------------------------------------------+
|                         Storage & Concurrency Engine                              |
|   +-------------------------------------+  +----------------------------------+   |
|   | MVCC Transaction Engine             |  | B-Tree Paging Engine             |   |
|   | (Snapshot isolation, conflict check)|  | (WAL, In-memory, partial sync)   |   |
|   +------------------+------------------+  +------------------+---------------+   |
|                      +-------------------+--------------------+                   |
|                                          |                                        |
|                                          v                                        |
|                       +-------------------------------------+                     |
|                       | Asynchronous Pluggable I/O Driver   |                     |
|                       | (io_uring / kqueue / WASM / Sim-IO) |                     |
|                       +-------------------------------------+                     |
+-----------------------------------------------------------------------------------+
```

### Subsystem Boundaries & Invariant Contracts

1. **Frontends (SQLite & Postgres Wire)**: Translates ASTs into unified relational algebra. Must preserve dialect-specific semantics (e.g., PostgreSQL type identifiers, textual vs binary format encodings, and column naming like `?column?` vs literal naming).
2. **Translate & Codegen Layer (`core/translate`)**: Translates relational algebra into VDBE bytecode instructions (`Insn::Ne`, `Insn::IsType`, `Insn::Halt`, `Insn::Column`). Manages register allocation, label patching, and row-image caching layouts (`ColumnLayout`).
3. **Execution Runtime (VDBE)**: A register machine where registers hold polymorphic `Value` variants (`Null`, `Numeric`, `Text`, `Blob`). Instruction execution produces tri-state outcomes (`Done`, `Row`, `IO`). When encountering page faults or write barriers, the VDBE yields `IO` status, suspending execution until background asynchronous I/O completes.
4. **Synchronization & Replication Subsystems (`sync/engine`, `sync/sdk-kit`)**: Enables local-first replication. Local writes can be intercepted and routed to a primary via `RemoteWriteStatement`, executing writes remotely and pulling diffs to maintain local replica convergence.
5. **Multi-Language Foreign Function Interfaces (FFI)**: Low-overhead wrappers exposing raw pointers across Java (JNI), React Native (JSI via C++ HostObjects), Python, and WebAssembly, delegating lifecycle management to host runtimes while preventing native handle leaks.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Mandatory Explicit NULL-Branching Invariant on Three-Valued Logic Bytecode Comparisons
**RULE**:
When generating or interpreting equality/inequality comparison instructions (`Eq`, `Ne`, `Lt`, `Le`, `Gt`, `Ge`) in database bytecode or intermediate representations supporting three-valued logic (3VL), the compiler MUST explicitly define the branch target for `NULL` operands via dedicated flags (e.g., `jump_if_null`). Compilers MUST NOT emit default, fall-through comparison instructions when evaluating predicates against system metadata catalogs or auxiliary tables where `NULL` represents a valid disassociated state.

**WHY**:
In standard SQL 3VL, `NULL != 'value'` evaluates to `UNKNOWN` (`NULL`), not `TRUE`. If a virtual machine instruction treats `NULL` inequality as a fall-through branch condition, a row containing a `NULL` key satisfies the inequality test against any specified string key. Consequently, operations intended to mutate or delete a specific key will execute on unassociated `NULL` rows, leading to catalog corruption, data leakage, and cascade deletion of untracked system entries.

**WHEN TO APPLY**:
Apply in SQL compilers, execution runtimes, query optimizers, and rule-based bytecode emitters whenever emitting binary comparison operators on nullable schema identifiers, system catalogs (`sqlite_sequence`, `information_schema`), or user-defined outer-join conditions.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In compiler instruction emission (e.g., core/translate)
#[derive(Clone, Copy, Debug, Default)]
pub struct CmpInsFlags(u8);

impl CmpInsFlags {
    pub const JUMP_IF_NULL: u8 = 0b0000_0001;

    #[inline(always)]
    pub fn jump_if_null(mut self) -> Self {
        self.0 |= Self::JUMP_IF_NULL;
        self
    }

    #[inline(always)]
    pub fn should_jump_on_null(&self) -> bool {
        (self.0 & Self::JUMP_IF_NULL) != 0
    }
}

// Bytecode emission: When skipping non-matching catalog rows,
// NULL must jump to the loop continuation label, NEVER fall through.
pub fn emit_catalog_key_check(
    program: &mut ProgramBuilder,
    candidate_key_reg: usize,
    target_key_reg: usize,
    mismatch_label: BranchLabel,
) {
    program.emit_insn(Insn::Ne {
        lhs: candidate_key_reg,
        rhs: target_key_reg,
        target_pc: mismatch_label,
        flags: CmpInsFlags::default().jump_if_null(),
        collation: CollationSeq::for_internal_values(),
    });
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Default comparison flags assume binary boolean logic.
// If candidate_key_reg is NULL, Ne evaluates to UNKNOWN.
// Without jump_if_null, the VM falls through to the MATCH branch!
pub fn emit_buggy_catalog_key_check(
    program: &mut ProgramBuilder,
    candidate_key_reg: usize,
    target_key_reg: usize,
    mismatch_label: BranchLabel,
) {
    program.emit_insn(Insn::Ne {
        lhs: candidate_key_reg,
        rhs: target_key_reg,
        target_pc: mismatch_label,
        flags: CmpInsFlags::default(), // BUG: Mismatched row with NULL key executes target code!
        collation: CollationSeq::for_internal_values(),
    });
}
```

**VERIFICATION METHOD**:
Implement a differential test harness asserting that an `UPDATE` or `DELETE` targeting an explicit non-existent key on a table containing `NULL` catalog entries leaves the `NULL` entries untouched:
```bash
cargo test --package turso_core --test conformance autoinc_insert_skips_null_name_sequence_row
```

---

### 2. Strict Physical-to-Logical Register Alignment in Mutation Projection Caches
**RULE**:
When populating intermediate projection caches for mutations returning row images (such as `DELETE ... RETURNING` or `UPDATE ... RETURNING`), the compiler MUST use an `Identity` layout mapping that reflects the physical, sequential schema index offsets allocated by the storage engine (`columns_start_reg + schema_index`), rather than a compacted layout mapping (`ColumnLayout::from_columns()`) that omits non-stored virtual generated columns.

**WHY**:
Virtual generated columns exist in the logical schema table definition but do not consume physical on-disk storage slots. If a compiler builds a row-image cache using a compacted projection layout, the cached indices shift: any physical column situated after a virtual generated column is mapped to `schema_index - N_prior_virtual_cols`. However, runtime delete/update execution routines stage data into physical registers using uncompacted absolute schema offsets. The resulting mismatch causes `RETURNING` clauses to read corrupted register offsets, returning mismatched column data or out-of-bounds register state.

**WHEN TO APPLY**:
Apply in any database engine compiler supporting generated/computed columns alongside `RETURNING`, change data capture (CDC), or statement-level triggers.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In DML code generator (e.g., core/translate/emitter/delete.rs)
pub enum ColumnLayout {
    Identity { column_count: usize },
    Compacted(Vec<usize>),
}

pub fn emit_delete_row_common(
    program: &mut ProgramBuilder,
    table_reference: *const TableReference,
    columns_start_reg: Option<usize>,
) -> Result<()> {
    let columns_start_reg = columns_start_reg
        .expect("columns_start_reg must be provided when triggers or RETURNING are present");
    let delete_table = unsafe { &*table_reference };

    // INVARIANT: Physical registers are assigned sequentially by schema position:
    // reg = columns_start_reg + schema_idx.
    // The projection cache MUST use Identity layout to preserve schema index parity.
    let delete_layout = ColumnLayout::Identity {
        column_count: delete_table.columns().len(),
    };

    let _cache_state = seed_returning_row_image_in_cache(
        program,
        table_reference,
        columns_start_reg,
        delete_layout,
    )?;

    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Compacting column definitions ignores register spacing for virtual columns.
// Columns located after virtual columns read from the wrong register index!
let delete_layout = ColumnLayout::from_columns(delete_table.columns())?;
let _cache_state = seed_returning_row_image_in_cache(
    program,
    table_reference,
    columns_start_reg,
    delete_layout, // BUG: Offset shift occurs if virtual generated columns exist!
)?;
```

**VERIFICATION METHOD**:
Automated conformance query verification:
```sql
CREATE TABLE t1(a INTEGER PRIMARY KEY, b TEXT AS (ZEROBLOB(5)) VIRTUAL, c INTEGER);
INSERT INTO t1(a, c) VALUES (1, 100);
DELETE FROM t1 RETURNING c;
-- Assert returned value is exactly 100, not 0-blob or NULL.
```

---

### 3. Exhaustive Existing-Row Type Barrier on Metadata-Only DDL Alterations
**RULE**:
When executing a schema modification statement (DDL) that introduces a virtual generated column with a strict type constraint (`STRICT` table mode) to a pre-populated relation, the query planner MUST emit a full-table validation scan that evaluates the generated expression against all pre-existing rows and executes a strict type-check instruction (`Insn::IsType`). The DDL MUST fail and roll back with `type mismatch on DEFAULT` before committing if any row's computed expression cannot be losslessly converted to the declared column type.

**WHY**:
Virtual generated columns do not alter on-disk row records at table creation time, tempting query planners to treat `ALTER TABLE ADD COLUMN ... VIRTUAL` as an instantaneous metadata-only operation. However, in `STRICT` mode, this creates a latent schema corruption: future reads evaluate the generated expression dynamically, failing mid-query or causing `PRAGMA integrity_check` to report constraint violations on data that was accepted without validation.

**WHEN TO APPLY**:
Apply when implementing DDL routines (`ALTER TABLE`) in typed relational engines where expressions or generated columns interact with tables enforcing strict type affinity or check constraints.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In core/translate/alter.rs
pub fn emit_column_constraints_validation(
    program: &mut ProgramBuilder,
    table: &TableMetadata,
    column: &ColumnMetadata,
    dml_ctx: &DmlContext,
    new_column_idx: usize,
) -> Result<()> {
    let strict_virtual_type = if table.is_strict && column.is_virtual_generated() {
        column.strict_value_type()
    } else {
        None
    };

    // If no constraints exist and no strict virtual validation is required, skip scan.
    if !table.has_notnull && table.check_constraints.is_empty() && strict_virtual_type.is_none() {
        return Ok(());
    }

    let result_reg = dml_ctx.to_column_reg(new_column_idx);

    // Enforce strict type check across all existing tuples
    if let Some(value_type) = strict_virtual_type {
        let type_passed_label = program.allocate_label();
        program.emit_insn(Insn::IsType {
            reg: result_reg,
            target_pc: type_passed_label,
            value_type,
        });
        program.emit_insn(Insn::Halt {
            constraint_info: None,
            err_code: 1,
            description: "type mismatch on DEFAULT".to_string(),
            on_error: None,
            description_reg: None,
        });
        program.preassign_label_to_next_insn(type_passed_label);
    }

    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Bypassing validation because the column has no physical storage.
// This allows incompatible types into the STRICT table schema!
if column.is_virtual_generated() {
    return Ok(()); // BUG: Skips existing data scan, corrupting STRICT invariants!
}
```

**VERIFICATION METHOD**:
Negative integration test suite verifying transaction rollback on invalid data:
```rust
#[test]
fn test_strict_virtual_column_validation_rejects_incompatible_rows() {
    let db = open_temp_database();
    db.execute("CREATE TABLE t(a TEXT) STRICT;").unwrap();
    db.execute("INSERT INTO t(a) VALUES('hello');").unwrap();
    let err = db.execute("ALTER TABLE t ADD COLUMN b INTEGER GENERATED ALWAYS AS (a) VIRTUAL;");
    assert!(err.is_err());
    assert_eq!(err.unwrap_err().to_string(), "type mismatch on DEFAULT");
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: `sqlite_sequence` NULL Name Corruption Across DDL and MVCC (BUG-TURSO-01)
- **Context**: Subsystem: Query Translator (`core/translate/{alter.rs, insert.rs, schema.rs, sequence.rs}`).
- **What Was Expected**: Sequence metadata updates for autoincrement primary keys must target the table matching the given schema name. Rows in `sqlite_sequence` with `name IS NULL` do not belong to any valid table and must be skipped during `INSERT`, `ALTER TABLE RENAME`, `DROP TABLE`, and MVCC sync passes.
- **What Actually Happened**: When executing `ALTER TABLE t3 RENAME TO t4`, `DROP TABLE t3`, or inserting under MVCC mode when a row in `sqlite_sequence` contained `name = NULL`, the engine mutated or deleted the `NULL` row. In `INSERT INTO t3`, the autoincrement counter for `t3` was overwritten into the row where `name IS NULL`.
- **Evidence in Repo**: Commit `01cddb12`. Files modified: `alter.rs`, `insert.rs`, `schema.rs`, `sequence.rs`, `autoincr.sqltest`, `mvcc_sequence.sqltest`.
- **Root Cause**: The bytecode loops searching for a table's entry in `sqlite_sequence` executed `Insn::Ne` with default comparison flags (`CmpInsFlags::default()`). Under SQL 3VL, `NULL != 'target'` yields `NULL` (falsy in branch evaluation). Without the jump flag for null values, the inequality instruction did not jump to the next loop iteration, causing the engine to fall through and process the `NULL` row as if it were a valid match.
- **Remediation Code Diff**:
```rust
--- a/core/translate/alter.rs
+++ b/core/translate/alter.rs
@@ -322,7 +322,7 @@ fn emit_rename_sqlite_sequence_entry(
             lhs: sequence_name_reg,
             rhs: row_name_to_replace_reg,
             target_pc: continue_loop_label,
-            flags: CmpInsFlags::default(),
+            flags: CmpInsFlags::default().jump_if_null(),
             collation: CollationSeq::for_internal_values(),
         });
```
- **Lesson**: Comparisons targeting nullable database columns in VM control flow must explicitly define branching behavior for `NULL`. A non-jumping `Ne` on `NULL` behaves as a false negative.

---

### Incident 2: DELETE RETURNING Row-Image Cache Offset Misalignment on Virtual Columns (BUG-TURSO-02)
- **Context**: Subsystem: VDBE Codegen (`core/translate/emitter/delete.rs`).
- **What Was Expected**: Running `DELETE FROM table RETURNING col` on a table with virtual generated columns must return the exact values corresponding to the projected columns.
- **What Actually Happened**: Any column positioned after a virtual generated column in the schema returned an incorrect value (e.g., zeroes or data from an adjacent column).
- **Evidence in Repo**: Commit `c34de338`. Files modified: `core/translate/emitter/delete.rs`, `sqlite/conformance/sqlite-sqltests/gencol.sqltest`.
- **Root Cause**: The RETURNING row-image cache was seeded with `ColumnLayout::from_columns()`, which compacted physical column mappings by stripping out virtual columns. However, the `DELETE` VDBE execution pipeline placed physical column values into registers indexed by their absolute schema positions (`columns_start_reg + schema_index`). The cache read from compacted register offsets, creating an off-by-N index mismatch.
- **Remediation Code Diff**:
```rust
--- a/core/translate/emitter/delete.rs
+++ b/core/translate/emitter/delete.rs
@@ -849,7 +849,9 @@ fn emit_delete_row_common(
         let columns_start_reg = columns_start_reg
             .expect("columns_start_reg must be provided when there are triggers or RETURNING");
         let delete_table = unsafe { &*table_reference };
-        let delete_layout = ColumnLayout::from_columns(delete_table.columns())?;
+        let delete_layout = ColumnLayout::Identity {
+            column_count: delete_table.columns().len(),
+        };
         let cache_state = seed_returning_row_image_in_cache(
             program,
             table_references,
```
- **Lesson**: The mapping between physical storage/execution registers and logical column caches must use an identity relationship unless explicitly transformed by an intermediate mapping adapter.

---

### Incident 3: Latent STRICT Schema Invariant Bypass in Virtual Generated Columns (BUG-TURSO-03)
- **Context**: Subsystem: Schema DDL Engine (`core/translate/alter.rs`).
- **What Was Expected**: Executing `ALTER TABLE ... ADD COLUMN ... VIRTUAL` on a `STRICT` table must inspect existing rows to confirm that all computed values satisfy the declared strict column type, failing with `type mismatch on DEFAULT` if violations occur.
- **What Actually Happened**: The database accepted the `ALTER TABLE` statement without scanning existing rows. If an existing row contained data incompatible with the declared column type, future queries crashed or produced errors, and `PRAGMA integrity_check` reported a corrupted database state.
- **Evidence in Repo**: Commit `c34de338`. Files modified: `core/translate/alter.rs`, `sqlite/conformance/sqlite-sqltests/gencol.sqltest`.
- **Root Cause**: The check `if !has_notnull && check_constraints.is_empty()` returned early from column constraint validation during `ALTER TABLE` execution, incorrectly assuming virtual columns require no physical validation.
- **Remediation Code Diff**:
```rust
--- a/core/translate/alter.rs
+++ b/core/translate/alter.rs
@@ -603,7 +603,13 @@ fn emit_column_constraints_validation(
         check_constraints.extend(domain_checks);
     }
 
-    if !has_notnull && check_constraints.is_empty() {
+    let strict_virtual_type = if table.is_strict && column.is_virtual_generated() {
+        column.strict_value_type()
+    } else {
+        None
+    };
+
+    if !has_notnull && check_constraints.is_empty() && strict_virtual_type.is_none() {
         return Ok(());
     }
@@ -668,6 +674,23 @@ fn emit_column_constraints_validation(
     )? ;
     let result_reg = dml_ctx.to_column_reg(new_column_idx);
 
+    if let Some(value_type) = strict_virtual_type {
+        let type_passed = program.allocate_label();
+        program.emit_insn(Insn::IsType {
+            reg: result_reg,
+            target_pc: type_passed,
+            value_type,
+        });
+        program.emit_insn(Insn::Halt {
+            constraint_info: None,
+            err_code: 1,
+            description: "type mismatch on DEFAULT".to_string(),
+            on_error: None,
+            description_reg: None,
+        });
+        program.preassign_label_to_next_insn(type_passed);
+    }
```
- **Lesson**: Virtual/derived metadata modifications must satisfy the same validation guarantees as physical column additions in strict typing modes.

---

### Incident 4: Wire Protocol Type Corruption on Postgres Function Expressions (BUG-TURSO-04)
- **Context**: Subsystem: Postgres Frontend Server (`postgres/server/lib.rs`).
- **What Was Expected**: Built-in and extension functions (`booleq()`, `now()`, `auth.uid()`, and `CAST(... AS timestamptz)`) must serialize their output types over the PostgreSQL wire protocol as their respective OIDs (`Type::BOOL`, `Type::TIMESTAMPTZ`, `Type::UUID`), formatting boolean results as `'t'` or `'f'`.
- **What Actually Happened**: The core engine returned values under primitive underlying storage representations (e.g., integer `1`/`0` for boolean expressions), leading client drivers to fail type decoding or display corrupted result sets.
- **Evidence in Repo**: Commit `0d383fd6`. Files modified: `postgres/server/lib.rs`, `postgres/conformance/pg-sqltests/functions.sqltest`.
- **Root Cause**: Custom and extended type expressions were treated as raw storage primitives during row description construction, bypassing wire protocol OID attribution.
- **Remediation Code Diff**:
```rust
--- a/postgres/server/lib.rs
+++ b/postgres/server/lib.rs
@@ -1316,6 +1316,38 @@ mod tests {
+    #[test]
+    fn test_functions_that_return_a_custom_type_are_described_as_that_type() {
+        let (_io, db) = turso_pg::open_database(
+            ":memory:",
+            None,
+            turso_pg::OpenFlags::default(),
+            turso_pg::DatabaseOpts::new(),
+        ).unwrap();
+        let conn = PgConnection::connect(&db).unwrap();
+        for (sql, expected_type) in [
+            ("SELECT booleq(true, true)", Type::BOOL),
+            ("SELECT now()", Type::TIMESTAMPTZ),
+            ("SELECT auth.uid()", Type::UUID),
+            ("SELECT CAST(1 AS timestamptz)", Type::TIMESTAMPTZ),
+        ] {
+            let mut stmt = conn.prepare(sql).unwrap();
+            let fields = Arc::new(build_field_info(&stmt, &Format::UnifiedText));
+            assert_eq!(*fields[0].datatype(), expected_type, "{sql}");
+            let _ = stmt.run_collect_rows().unwrap();
+        }
```
- **Lesson**: Database frontends implementing foreign wire protocols must track logical type metadata alongside physical storage types to ensure accurate protocol serialization.

---

### Incident 5: RETURNING Unnamed Literal Projection Incompatibility (BUG-TURSO-05)
- **Context**: Subsystem: PostgreSQL Frontend vs. SQLite Engine Client Compatibility (`postgres/server`, Issue 11181).
- **What Was Expected**: Application queries relying on `RETURNING 1` across engines expect predictable projection keys (e.g., PostgreSQL defaults to `?column?`, whereas SQLite engines label with the literal text `'1'`).
- **What Actually Happened**: Upstream ORMs and cross-engine client abstraction layers experienced runtime lookup misses (`undefined` property access) when migrating from `@tursodatabase/database` (SQLite engine) to `tursopg` (PostgreSQL wire engine) because projection names shifted between literal texts and `?column?`.
- **Evidence in Repo**: Issue #11181, Issue #11182 (handling non-UTF-8 bind parameters as bytea blobs).
- **Root Cause**: Wire engines strictly inherit PostgreSQL naming invariants, while SQLite frontends preserve literal SQL token values for unnamed projection expressions.
- **Remediation Pattern**:
```typescript
// Client-side portable projection pattern
// WRONG: Ambiguous engine-dependent literal naming
const rows = await client.query("DELETE FROM t WHERE k = $1 RETURNING 1", [id]);
// In pgwire -> rows[0]["?column?"]
// In sqlite -> rows[0]["1"]

// RIGHT: Explicit invariant alias normalization
const rows = await client.query("DELETE FROM t WHERE k = $1 RETURNING 1 AS affected", [id]);
// In both engines -> rows[0]["affected"] === 1
```
- **Lesson**: Unnamed query projections are engine-dependent. Client layers must use explicit column aliases in projection queries targeting multi-engine backends.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
In Rust and C++ FFI layers, passing 64-bit scalar types and pointer handles across language runtimes requires careful management of integer width and nullability.

```rust
// CRITICAL: 1-indexed Bind Parameters vs 0-indexed Storage
// JNI and SQLite APIs use 1-based indexing for bound statement parameters.
// Passing a 0-index or performing an unchecked cast causes parameter corruption.
pub fn bind_safe_parameter(
    stmt: &mut Statement,
    position: i32,
    val: Value,
) -> Result<(), LimboError> {
    // NonZero ensures position is >= 1 at compile and runtime level
    let non_zero_pos = match usize::try_from(position) {
        Ok(p) => NonZero::new(p).ok_or(LimboError::InvalidBindIndex)?,
        Err(_) => return Err(LimboError::InvalidBindIndex),
    };
    stmt.bind_at(non_zero_pos, val)
}
```

```cpp
// JSI Token Precedence & Numeric Boundary Invariant (React Native C++ Layer)
// Converting double to int64 without verifying integer representation leads to precision truncation.
if (args[1].isNumber()) {
    double raw_num = args[1].asNumber();
    if (std::floor(raw_num) == raw_num && !std::isinf(raw_num) && !std::isnan(raw_num)) {
        int64_t int_val = static_cast<int64_t>(raw_num);
        return jsi::Value(static_cast<int>(turso_statement_bind_positional_int(stmt_, position, int_val)));
    } else {
        return jsi::Value(static_cast<int>(turso_statement_bind_positional_double(stmt_, position, raw_num)));
    }
}
```

### 2. Infinite Loop & Recursion Guards
The execution engine processes query steps that may yield an asynchronous `IO` status when accessing pages that are not cached in memory.

```typescript
// INVARIANT: IO Retry Exhaustion Bound
// Stepping an execution engine with non-blocking I/O can trap an asynchronous loop
// if background I/O operations continuously fail to satisfy the page request.
let rows: Row[] = [];
const MAX_IO_RETRIES = 1_000_000; // Explicit deterministic boundary
let ioRetries = 0;

for (; ioRetries < MAX_IO_RETRIES; ioRetries++) {
    const bulk = this._statement.getAllRows();
    if (bulk.rows && bulk.rows.length > 0) {
        rows = rows.concat(bulk.rows);
    }
    if (bulk.status === TursoStatus.DONE) {
        return rows;
    }
    if (bulk.status === TursoStatus.IO) {
        this._statement.runIo();
        if (this._extraIo) {
            await this._extraIo(); // Yield control to asynchronous engine queue
        }
        continue;
    }
    throw new Error(`getAllRows failed with runtime status: ${bulk.status}`);
}
if (ioRetries >= MAX_IO_RETRIES) {
    throw new Error(`getAllRows: exceeded ${MAX_IO_RETRIES} IO retries - engine deadlock suspected`);
}
```

### 3. UI & UX Micro-Mechanics / Client-Binding Ergonomics
When hosting SQLite within React Native (JSI) or WebAssembly browser runtimes, client bindings must avoid blocking the main UI thread during synchronous operations.

```typescript
// Asynchronous Execution Locking & Native Mutex Decoupling
// Calling execute() or step() on a single prepared statement concurrently
// from multiple async JavaScript closures causes internal register corruption.
export class Statement {
    private _execLock: AsyncLock | null;
    private _