> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tursodatabase-turso-learnings.md`  
> **Source**: github ([https://github.com/tursodatabase/turso](https://github.com/tursodatabase/turso))  
> **Source Version**: `65b33d6c`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T07:29:47.897Z  
> **Learning ID**: `learn-github-tursodatabase-turso`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): tursodatabase/turso

---

## 1. Executive Forensic Architecture & System Mechanics

### Core System Mission & Problem Statement
`tursodatabase/turso` (historically rooted in the experimental Limbo engine) addresses a foundational limitation of traditional embedded SQL systems: monolithic, single-threaded execution coupling storage format directly to one query dialect. Turso decouples the **Virtual Database Engine (VDBE)** runtime from both SQL parsing frontends and underlying I/O subsystems. It provides an in-process, SQLite-compatible SQL database implemented in 100% memory-safe Rust with multi-engine query capabilities (supporting SQLite and PostgreSQL frontends over a shared engine core), non-blocking asynchronous I/O primitives (via completion-based I/O rings / simulated I/O), deterministic simulation testing, and Multi-Version Concurrency Control (`BEGIN CONCURRENT`).

```
                +-------------------------------------------------------------+
                |                       SQL FRONTENDS                         |
                |  +---------------------------+  +------------------------+  |
                |  | SQLite Frontend / Parser  |  | Postgres Wire / Parser |  |
                |  +-------------+-------------+  +-----------+------------+  |
                +----------------|----------------------------|---------------+
                                 |                            |
                                 v                            v
                +-------------------------------------------------------------+
                |               RESOLVER & QUERY PLANNER                      |
                | - DatabaseScopeContext (Fixer: fixes unqualified scopes)    |
                | - Temp-first resolution vs. Object-local database scoping   |
                +------------------------------+------------------------------+
                                               |
                                               v
                +-------------------------------------------------------------+
                |                    VDBE BYTECODE EMITTER                    |
                | - Opcode generation (Seek, Insert, Delete, NewRowid, etc.)  |
                | - Subprogram compilation (Triggers, Views, IVM pipelines)   |
                +------------------------------+------------------------------+
                                               |
                                               v
                +-------------------------------------------------------------+
                |                      VDBE RUNTIME CORE                      |
                | - Async Step Execution (IOResult::Yield / IOResult::Done)   |
                | - MVCC Multi-Writer Lock Manager                            |
                +------------------------------+------------------------------+
                                               |
                                               v
                +-------------------------------------------------------------+
                |                   STORAGE ENGINE (B-TREE)                   |
                | - BTreeCursor (Stack navigation, cell_index tracking)      |
                | - State flags: skip_advance, has_record, valid_state        |
                | - Underflow rebalance / Page splits                         |
                +------------------------------+------------------------------+
                                               |
                                               v
                +-------------------------------------------------------------+
                |                    PAGER & I/O SUBSYSTEM                    |
                | - Non-blocking Pager / Cache eviction                       |
                | - Pluggable I/O: io_uring, epoll, WASM Memory, SimKernel    |
                +-------------------------------------------------------------+
```

### Critical Subsystem Boundaries & Abstractions
1. **The Dialect-Agnostic VDBE Layer (`core/` & `postgres/frontend/`)**: The VDBE runs low-level opcodes executing relational algebra across cursors. SQL queries from SQLite syntax (`sqlite/parser`) or Postgres wire protocols (`postgres/parser`, `postgres/server`) are translated down into register operations and bytecodes.
2. **The Database Resolution & Object-Fixing Scope (`core/translate/emitter/`)**: Implements SQLite's `src/fix.c` semantics. While top-level queries evaluate names through a priority search path (`temp -> main -> attached`), subprograms, compiled views, and triggers must fix their unqualified identifiers to their owning database ID (`database_id`), preventing cross-schema capture.
3. **The State Machine BTree Cursor (`core/storage/btree.rs`)**: Manages navigation over SQLite-formatted B-Tree pages. The cursor operates as an asynchronous state machine yielding `IOResult::Done` or `IOResult::Yield` when page reads stall. Internal state variables (`has_record`, `skip_advance`, `valid_state`, `advance_state`) enforce boundary tracking across deletions, rebalancing, and insertions.
4. **Foreign Language Integration & SDK-KIT Layer (`bindings/`, `sdk-kit/`)**: Connects non-Rust language runtimes (Java JNI, Node.js NAPI, React Native JSI, Python C-API/asyncio worker) to the database core. Runtimes bridge non-blocking page-fault demands via cooperative stepping loops (`run_one_step_blocking`, `stepWithIo`, `getAllRows`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Cursor Navigation State Flag Invalidation Rule
**RULE**:
Every cursor repositioning operation (e.g., `seek_to_last`, `seek_to_first`, `prev`, `count`, `clear_saved_seek`) MUST unconditionally purge directional transition flags (`skip_advance`, `skip_next`, or pending step skips) and synchronize data validity markers (`has_record`) with physical leaf node occupancy.

**WHY**:
In B-Tree implementations, deleting a row can leave a cursor parked on the successor row with a state flag indicating "do not step forward on the next `next()` call" (because the delete/rebalance already advanced the cursor onto the next live cell). If subsequent operations (such as `seek_to_last()` invoked during `NewRowid` generation) reposition the cursor to another offset without resetting the skip flag, the subsequent `next()` operation silently stays stationary. An ensuing `insert()` will write the new key before the old last record instead of appending to the end, corrupting key ordering invariants and index consistency. Similarly, a seek into an empty node that does not reset `has_record` allows the cursor to yield a zombie record from an uncleared buffer.

**WHEN TO APPLY**:
Apply across all tree, LSM-tree, and B-tree storage engines, cursor drivers, and low-level iterators where mutating operations (deletes, splits, merges) share cursor instances with subsequent search, scan, or insertion operations.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub struct BTreeCursor {
    stack: CursorStack,
    has_record: bool,
    valid_state: CursorValidState,
    skip_advance: bool,
    context: Option<SavedSeekContext>,
}

impl BTreeCursor {
    #[inline]
    pub fn clear_saved_seek(&mut self) {
        self.context = None;
        self.valid_state = CursorValidState::Valid;
        // Invariant: Changing cursor context purges any forward-step suppression flags
        self.skip_advance = false;
    }

    pub fn seek_to_last_leaf(&mut self, page: &Page) -> Result<IOResult<SeekResult>> {
        let contents = page.get_contents();
        let cell_count = contents.cell_count();
        if cell_count == 0 {
            self.stack.set_cell_index(0);
            // Invariant: An empty leaf never carries a valid record
            self.set_has_record(false);
            return Ok(IOResult::Done(SeekResult::NotFound));
        }
        self.clear_saved_seek();
        self.seek_leaf_internal(cell_count - 1)
    }

    pub fn prev_step(&mut self) -> Result<IOResult<()>> {
        // A backward step from the cell after a deleted row is already correct;
        // it must consume and clear skip_advance so subsequent forward steps advance normally.
        self.skip_advance = false;
        self.move_backward()
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Moving or clearing context while retaining operation-specific flags.
// This allows skip_advance to poison subsequent independent navigations.
impl BTreeCursor {
    fn clear_saved_seek(&mut self) {
        self.context = None;
        self.valid_state = CursorValidState::Valid;
        // BUG: Fails to clear self.skip_advance = false;
    }

    fn seek_leaf(&mut self, cell_count: usize) -> Result<IOResult<SeekResult>> {
        if cell_count == 0 {
            self.stack.set_cell_index(0);
            // BUG: Fails to call self.set_has_record(false);
            // Cursor still reports has_record() == true if it previously pointed to a deleted row!
            return Ok(IOResult::Done(SeekResult::NotFound));
        }
        // ...
    }
}
```

**VERIFICATION METHOD**:
Property-based regression testing executing sequence permutations: `Insert(K1..KN) -> Delete(K_mid) -> SeekToLast() -> NewRowid() -> Insert(K_new)` followed by a full linear table scan. The scan must assert strictly monotonic ordering of rowids:
```rust
assert!(scan_rowids(&pager, root_page).windows(2).all(|w| w[0] < w[1]));
```

---

### 2. Scoped Schema Resolution Invariant for Persistent Stored Objects
**RULE**:
When resolving unqualified schema identifiers (tables, views, indexes, collations) within persistent compiled definitions (views, triggers, materialized views, generated columns), the compiler MUST bind name resolution exclusively to the defining object’s schema (`database_id`), strictly bypassing transient scopes (e.g., `temp` databases) or ambient connection search paths.

**WHY**:
In multi-database or schema architectures, top-level interactive queries prioritize ephemeral tables (`temp` schema) over persistent tables (`main` or attached database schemas). If an embedded object definition (like a view or trigger) resolves unqualified names via the ambient connection search path, a newly created temporary table (e.g., `temp.users`) will shadow the persistent table (`main.users`). Subsequent reads from the view or writes processed by triggers will execute against the temporary schema, corrupting data integrity, generating silent desynchronization in materialized views, or causing cross-tenant data leaks.

**WHEN TO APPLY**:
Apply inside SQL compilers, query planners, view expanders, AST resolvers, and trigger bytecode generators that compile persistent metadata referring to relation names.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub struct Resolver<'a> {
    pub(crate) database_scope: RefCell<Option<DatabaseScopeContext>>,
    pub(crate) unqualified_database_search_path: Vec<usize>,
}

#[derive(Debug, Clone)]
pub(crate) struct DatabaseScopeContext {
    database_id: usize,
    kind: &'static str,
    object_name: String,
}

impl<'a> Resolver<'a> {
    /// Executes closure `f` with table resolution restricted to `database_id`.
    /// Guarantees scope cleanup via RAII on successful return and unwind/early-exit.
    pub fn with_database_scope<T>(
        &self,
        database_id: usize,
        kind: &'static str,
        name: String,
        f: impl FnOnce() -> Result<T>,
    ) -> Result<T> {
        let prev_scope = self.database_scope.borrow().clone();
        *self.database_scope.borrow_mut() = Some(DatabaseScopeContext {
            database_id,
            kind,
            object_name: name,
        });

        let result = f();

        *self.database_scope.borrow_mut() = prev_scope;
        result
    }

    pub fn resolve_unqualified_table(&self, table_name: &str) -> Result<ResolvedTable> {
        if let Some(scope) = self.database_scope.borrow().as_ref() {
            // Strictly bound: never check TEMP or search path
            return self.find_table_in_database(scope.database_id, table_name);
        }

        // Ambient interactive query path: TEMP first, then search paths
        self.find_table_in_ambient_path(table_name)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Reusing top-level resolution logic during view expansion or trigger execution.
fn parse_from_clause_table(resolver: &Resolver, table_name: &str) -> Result<Table> {
    // BUG: Resolves bare table name using global search path, allowing TEMP tables
    // to hijack the source definition of persistent views and triggers.
    resolver.resolve_table_globally(table_name)
}
```

**VERIFICATION METHOD**:
Execute an integration test validating schema isolation:
```sql
CREATE TABLE items (id INTEGER, val TEXT);
INSERT INTO main.items VALUES (1, 'PERSISTENT');
CREATE TEMP TABLE items (id INTEGER, val TEXT);
INSERT INTO temp.items VALUES (1, 'EPHEMERAL');
CREATE VIEW v_items AS SELECT * FROM items;
-- Must evaluate to 'PERSISTENT', never 'EPHEMERAL'
SELECT val FROM v_items;
```
Enforce in test harnesses with `ASSERT_EQUAL(result.get_str(0), "PERSISTENT")`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: B-Tree Cursor `skip_advance` State Corruption during Append Operations (BUG-TURSO-BTREE-01)
- **Context**: B-Tree storage engine, cursor advancement state machine (`core/storage/btree.rs`).
- **What Was Expected**: Executing a delete followed by a write append (`seek_to_last() -> NewRowid -> Insert`) on a single cursor must insert the new record strictly after the highest existing rowid.
- **What Actually Happened**: When a row was deleted and triggered an internal leaf rebalance, the cursor remained on the subsequent row and set `self.skip_advance = true` to suppress the next forward step. When calling `seek_to_last()` to calculate `NewRowid`, the cursor moved physically to the last row, but `skip_advance` was never cleared. The subsequent `next()` call (intended to step past the last row) was suppressed. The new row was inserted *before* the previous last row, violating B-Tree rowid sequential invariants.
- **Evidence in Repo**: Commit `c876402b`, PR #10128.
- **Root Cause**: Lack of state clearing upon cursor repositioning. `moveToRoot()` in SQLite (`btree.c:5619`) and `clear_saved_seek()` in Turso reset saved seek positions, but failed to drop the execution skip flag (`skip_advance`).
- **Remediation Code Diff**:
```rust
--- a/core/storage/btree.rs
+++ b/core/storage/btree.rs
@@ -6445,10 +6451,20 @@ impl BTreeCursor {
     #[inline]
     fn clear_saved_seek(&mut self) {
         self.context = None;
         self.valid_state = CursorValidState::Valid;
+        self.skip_advance = false;
     }

@@ -6745,6 +6761,12 @@ impl CursorTrait for BTreeCursor {
             match self.advance_state {
                 AdvanceState::Start => {
                     return_if_io!(self.restore_context());
+                    // skip_advance only tells a forward step to stay put. A
+                    // backward step from the cell after a deleted row is
+                    // already right, and it must consume the flag so a later
+                    // next() advances normally.
+                    self.skip_advance = false;
                     self.advance_state = AdvanceState::Advance;
                 }
```
- **Lesson**: Directional suppression flags tied to cursor movements must be cleared upon any positional jump or directional reversal (`prev`).

---

### Incident 2: Zombie Record Retainment on Empty B-Tree Leaf Seek (BUG-TURSO-BTREE-02)
- **Context**: B-Tree leaf seek routines (`core/storage/btree.rs`).
- **What Was Expected**: When the final row of a table or index leaf is deleted, any subsequent seek on that cursor into the now-empty tree must register as `SeekResult::NotFound` and mark the cursor as holding no record (`has_record == false`).
- **What Actually Happened**: The cursor's internal record-validity latch (`has_record`) was left set to `true` if it previously pointed to a deleted row, even though `cell_count == 0`. Subsequent calls to `cursor.rowid()` or `cursor.record()` accessed stale, deallocated cell memory structures.
- **Evidence in Repo**: Commit `c876402b`, `core/storage/btree.rs:2468`, `2772`.
- **Root Cause**: B-Tree search routine checked `cell_count == 0` and returned early with `Ok(IOResult::Done(SeekResult::NotFound))`, but failed to update `self.has_record`.
- **Remediation Code Diff**:
```rust
--- a/core/storage/btree.rs
+++ b/core/storage/btree.rs
@@ -2468,6 +2468,10 @@ impl BTreeCursor {
             let cell_count = contents.cell_count();
             if cell_count == 0 {
                 self.stack.set_cell_index(0);
+                // Deleting the final row can leave this cursor carrying its
+                // old position while the cell bytes remain physically intact.
+                // A seek into the now-empty tree must invalidate that position.
+                self.set_has_record(false);
                 return Ok(IOResult::Done(SeekResult::NotFound));
             }
```
- **Lesson**: In asynchronous state machines managing memory pages, an early-return optimization branch must synchronize all public predicate states before returning `NotFound`.

---

### Incident 3: Transient Database Shadowing in View and Trigger Compilations (BUG-TURSO-PLANNER-03)
- **Context**: Query planner and resolver (`core/translate/planner.rs`, `core/translate/emitter/mod.rs`, `core/translate/trigger_exec.rs`).
- **What Was Expected**: Views and triggers created in persistent databases (e.g. `main`) must compile queries binding bare table references to their home database, strictly adhering to SQLite's `src/fix.c` semantics.
- **What Actually Happened**: The planner resolved unqualified table names inside view bodies and trigger subprograms using the ambient connection search path. If a user created `CREATE TEMP TABLE t (...)`, any preexisting persistent view `CREATE VIEW v AS SELECT * FROM t` or trigger referencing `t` would immediately bind to `temp.t`.
- **Evidence in Repo**: PR #10128, PR #10133, Issues #94, #10110.
- **Root Cause**: Trigger compilation used a mutable `trigger_context` which did not apply to views. View expansion in `parse_table` only held a shared reference `&Resolver`, preventing the installation of resolution boundaries.
- **Remediation Code Diff**:
```rust
--- a/core/translate/emitter/mod.rs
+++ b/core/translate/emitter/mod.rs
@@ -183,11 +183,13 @@ pub struct Resolver<'a> {
-    pub(crate) trigger_context: Option<TriggerDatabaseContext>,
+    pub(crate) database_scope: RefCell<Option<DatabaseScopeContext>>,

--- a/core/translate/planner.rs
+++ b/core/translate/planner.rs
@@ -2180,20 +2180,29 @@ fn parse_table(
+        return resolver.with_view_scope(database_id, view.name.clone(), || {
             program.with_view_expansion(database_id, &view.name, |program| {
                 parse_from_clause_table(...)
             })
+        });
```
- **Lesson**: When planning shared references in tree compilers, use interior mutability (`RefCell`) scoped with RAII to ensure boundary isolation without requiring pervasive mutable borrows.

---

### Incident 4: Incremental View Maintenance (IVM) Cross-Database Write Contamination (BUG-TURSO-MVCC-04)
- **Context**: Storage engine opcode handlers (`op_insert`, `op_delete`) and materialized view refresh pipelines.
- **What Was Expected**: Materialized views living in `main` must only refresh when mutations occur on tables belonging to the `main` database's pager.
- **What Actually Happened**: Mutations performed on `temp.t` or `aux.t` triggered incremental maintenance hooks for `main.v` because `op_insert` and `op_delete` matched views by bare table name without verifying the underlying pager/database ID of the mutated table.
- **Evidence in Repo**: Issue #10133, Issue #94.
- **Root Cause**: Missing verification of source database origin during VDBE opcode dispatch for mutation tracking.
- **Remediation Code Diff**:
```rust
// In op_insert / op_delete handlers:
// Check that the target write cursor belongs to the same database ID/pager
// that the materialized view is registered against.
if cursor.pager().database_id() != view.database_id() {
    return Ok(()); // Skip foreign database mutation
}
```
- **Lesson**: Event listeners and reactive materialized views must register and match on `(DatabaseID, ObjectID)` tuples, never bare relation names.

---

### Incident 5: PostgreSQL Protocol Schema Namespace Leakage (BUG-TURSO-PG-05)
- **Context**: PostgreSQL frontend catalog and schema validation (`postgres/frontend/catalog.rs`, `postgres/frontend/session.rs`).
- **What Was Expected**: PostgreSQL clients querying `pg_tables`, `pg_class`, and `pg_indexes` must see standard system catalogs without internal SQLite/Turso sequence backends (`__turso_internal_seq_*`). Additionally, users must not be permitted to create schemas starting with reserved prefixes (`pg_`).
- **What Actually Happened**: Turso's sequence tables leaked into `pg_tables` as public user tables. Calling `CREATE SCHEMA pg_temp_test` succeeded, corrupting catalog invariants expected by PostgreSQL clients.
- **Evidence in Repo**: Commit `f5090d05`, Issue #10008, PR #10110.
- **Root Cause**: Catalog filters checked for `sqlite_`, `pg_`, `pragma_`, and `json_`, but omitted `__turso_internal_` engine prefixes. `handle_pg_create_schema` omitted the prefix check entirely.
- **Remediation Code Diff**:
```rust
--- a/postgres/frontend/catalog.rs
+++ b/postgres/frontend/catalog.rs
@@ -186,22 +186,22 @@ fn is_system_table_name(name: &str) -> bool {
-    if name.starts_with("sqlite_") || name.starts_with("pg_") ...
+    ["sqlite_", "pg_", "pragma_", "json_", "__turso_internal_"]
+        .iter()
+        .any(|prefix| name.starts_with(prefix))
 }

--- a/postgres/frontend/session.rs
+++ b/postgres/frontend/session.rs
@@ -404,6 +404,11 @@ fn handle_pg_create_schema(conn: &Arc<Connection>, stmt: &PgCreateSchemaStmt) ->
+    if name.starts_with("pg_") {
+        return Err(LimboError::ParseError(format!(
+            "unacceptable schema name \"{name}\": the prefix \"pg_\" is reserved for system schemas"
+        )));
+    }
```
- **Lesson**: Protocol emulation layers require strict namespace virtualization; engine-internal structures must be masked at the catalog boundary.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **1-Indexed Positional Parameter Binding**:
  In SQLite and Turso, SQL parameter positions are 1-indexed. In `bindings/react-native/src/Statement.ts` and `bindings/java/rs_src/turso_statement.rs`:
  ```rust
  // RUST BOUNDARY CHECK
  match stmt.stmt.bind_at(NonZero::new(position as usize).unwrap(), Value::Null) { ... }
  ```
  Passing a 0 as an index causes `NonZero::new(0)` to yield `None`, triggering an immediate unwrap panic if not guarded. In JavaScript/TypeScript bridges:
  ```typescript
  // CORRECT 1-INDEX CONVERSION:
  for (let i = 0; i < params.length; i++) {
    const position = i + 1; // Explicit 1-indexing for SQL engine
    this.bindValue(position, params[i]);
  }
  ```
* **Numeric Representation Distinctions**:
  SQLite treats `0` and `0.0` as distinct storage classes (`Integer` vs `Real`), while JavaScript numbers conflate both into IEEE-754 floats. In `Statement.ts`:
  ```typescript
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      this._statement.bindPositionalInt(position, value);
    } else {
      this._statement.bindPositionalDouble(position, value);
    }
  }
  ```
  Failure to use `Number.isInteger(value)` results in integer keys (such as rowids) being bound as floating point values, corrupting index seeks.

---

### 2. Infinite Loop & Recursion Guards
* **Asynchronous I/O Loop Starvation Limits**:
  In non-blocking engines, asynchronous I/O faults can loop indefinitely if a required page fault cannot be satisfied. In `bindings/react-native/src/Statement.ts`:
  ```typescript
  let rows: Row[] = [];
  const MAX_IO_RETRIES = 1_000_000;

  for (let ioRetries = 0; ioRetries < MAX_IO_RETRIES; ioRetries++) {
    const bulk = this._statement.getAllRows();
    if (bulk.rows && bulk.rows.length > 0) {
      rows = rows.concat(bulk.rows);
    }
    if (bulk.status === TursoStatus.DONE) return rows;
    if (bulk.status === TursoStatus.IO) {
      this._statement.runIo();
      if (this._extraIo) await this._extraIo();
      continue;
    }
    throw new Error(`getAllRows failed with status: ${bulk.status}`);
  }
  throw new Error(`getAllRows: exceeded ${MAX_IO_RETRIES} IO retries`);
  ```
* **Thread Termination Sentinels**:
  In Python worker threading loops (`bindings/python/turso/worker.py`), workers must break clean on connection teardown:
  ```python
  STOP_RUNNING_SENTINEL = object()

  while True:
      item = self._queue.get()
      fut, func = item
      if fut.cancelled():
          continue
      try:
          result = func()
          if result is STOP_RUNNING_SENTINEL:
              break # Safe cooperative thread exit
      except Exception as e:
          self._loop.call_soon_threadsafe(fut.set_exception, e)
      else:
          self._loop.call_soon_threadsafe(fut.set_result, result)
  ```

---

### 3. UI & UX Micro-Mechanics (Client & Mobile Runtimes)
* **JSI Host Object Zero-Copy Data Passing**:
  In `bindings/react-native/cpp/TursoStatementHostObject.cpp`, passing text back to the JavaScript runtime bypasses standard UTF-8 re-encoding by reading directly from native pointers:
  ```cpp
  if (propName == "rowValueText") {
      return jsi::Function::createFromHostFunction(rt, name, 1,
          [self](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) -> jsi::Value {
              return self->rowValueText(rt, args, count);
          });
  }
  ```
  Text values are directly mapped to `jsi::String::createFromUtf8` to avoid intermediate bridge string copies.

---

### 4. Backend Concurrency & Memory Safety
* **Raw Pointer Ownership Transitions Across FFI**:
  In `bindings/java/rs_src/turso_statement.rs`:
  ```rust
  pub fn to_ptr(self) -> jlong {
      Box::into_raw(Box::new(self)) as jlong
  }

  pub fn drop(ptr: jlong) {
      if ptr != 0 {
          let _boxed = unsafe { Box::from_raw(ptr as *mut TursoStatement) };
          // Drops out of scope, releasing Statement, Connections, and AST allocations
      }
  }
  ```
  **Rule**: Any pointer transferred across JNI or C ABI boundaries must have explicit null-checks (`ptr == 0`) before dereferencing, and must be reclaimed exactly once via `Box::from_raw`.

* **MVCC Conflict Retry Loops (`bindings/rust/examples/concurrent_writes.rs`)**:
  Under `BEGIN CONCURRENT`, multiple connections execute transactions without holding exclusive table locks. Commit conflicts are detected optimistically:
  ```rust
  fn is_retryable(e: &Error) -> bool {
      matches!(e, Error::Busy(_) | Error::BusySnapshot(_))
          || matches!(e, Error::Error(msg) if msg.contains("conflict"))
  }

  loop {
      conn.execute("BEGIN CONCURRENT", ()).await?;
      let result = conn
          .execute(&format!("INSERT INTO hits VALUES ({val})"), ())
          .await
          .and(conn.execute("COMMIT", ()).await);
      match result {
          Ok(_) => break,
          Err(ref e) if is_retryable(e) => {
              let _ = conn.execute("ROLLBACK", ()).await;
              tokio::task::yield_now().await; // Mandatory cooperative yield
          }
          Err(e) => {
              let _ = conn.execute("ROLLBACK", ()).await;
              return Err(e);
          }
      }
  }
  ```

---

### 5. Defect & Error Prevention ("Galti Pakadna")
* **Differential Fuzzer Permanent Regression Invariant**:
  Per `AGENTS.md` and `.claude/skills/differential-fuzzer/SKILL.md`:
  > "Every differential-fuzzer failure that is successfully minimized must become a permanent `*.sqltest` regression case before its fix is considered complete."
  
  Seeds and raw fuzzer traces are forbidden as sole test artifacts. A test must be reduced down to the minimal reproducible SQL kernel before checking into `testing/sqltest/`.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
* Modular workspace containing independent packages: `core/` (VDBE and B-Tree storage), `sqlite/parser`, `postgres/frontend` (PostgreSQL wire format and catalog emulator), and language bridges (`bindings/`).
* Decoupled state execution: The VDBE runtime runs purely as a state machine where I/O requests yield execution (`IOResult::Yield`) back to caller schedulers.

### 2. Core Abstractions
* `BTreeCursor`: Manages traversal over SQLite B-Tree pages with explicit stack frames.
* `Resolver`: Compiles AST nodes into symbolic schema references, utilizing `RefCell<Option<DatabaseScopeContext>>` to enforce scope boundaries.
* `TursoStatement`: FFI encapsulation type mapping prepared statements across C, Java JNI, C++ JSI, and Python.

### 3. Error Handling
* Tiered error representations: `LimboError` internally in core Rust logic mapped outward to `TursoStatus` (`ROW`, `DONE`, `IO`, `BUSY`, `ERROR`).
* In JNI (`utils.rs`), errors are marshaled as byte arrays and thrown via the Java object's `throwTursoException` method, preventing Rust panics from crossing the foreign runtime boundary.

### 4. Testing
* Deterministic simulation testing: `testing/simulator/` and `testing/concurrent-simulator/` simulate randomized thread interleaving, partial disk writes, and fault injection.
* Differential testing: `testing/differential-oracle/` runs randomized SQL statements concurrently against reference SQLite builds to detect divergent query semantics.

### 5. Security
* Namespace isolation: System catalog objects (`__turso_internal_*`, `sqlite_*`, `pg_*`) are completely hidden from user introspection in Postgres frontends.
* Schema reservation checks: Creation of arbitrary schemas starting with reserved prefixes (e.g. `pg_`) is rejected during AST validation.

### 6. Performance
* Native batch reads: The React Native C++ binding (`getAllRows`) loops through rows directly in C++ memory space, avoiding repetitive JS-to-native context switches across the bridge.
* Zero-copy parsing: AST identifiers and string tokens borrow directly from query slices using lifetime annotations (`&'a str`).

### 7. Deployment
* Workspace builds support diverse architectures: WASM (`bindings/javascript/packages/wasm`), native CLI (`cli/`), and serverless cloud runtimes (`serverless/rust/`).
* Standardized lockfiles and toolchains: Pyproject workspace managed via `uv`, Rust edition `2021` with `mold` linker optimization.

### 8. Agent Patterns
* The repository embeds formal Agent