> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tursodatabase-limbo-learnings.md`  
> **Source**: github ([https://github.com/tursodatabase/limbo](https://github.com/tursodatabase/limbo))  
> **Source Version**: `e70cdbcd`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T08:56:41.331Z  
> **Learning ID**: `learn-github-tursodatabase-turso`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): tursodatabase/turso

---

## 1. Executive Forensic Architecture & System Mechanics

Turso (internally built upon the Limbo project) is an in-process, modular, virtual-machine-based SQL database engine written in Rust. Designed as an open-source, memory-safe alternative to SQLite, it acts as a pluggable execution engine capable of executing multiple SQL dialect frontends (SQLite, PostgreSQL wire protocol/syntax) compiled down to a unified, register-based Virtual Database Engine (VDBE) bytecode.

```
+-------------------------------------------------------------------------------------------------------+
|                                        FRONTEND PARSERS & ADAPTERS                                    |
|   +------------------------------------+             +--------------------------------------------+   |
|   |   SQLite Frontend (sqlite/parser)  |             |  PostgreSQL Frontend (postgres/frontend)   |   |
|   | AST -> Logical Plan -> VDBE Ops    |             |  libpg_query protobuf AST -> Turso AST     |   |
|   +-----------------+------------------+             +---------------------+----------------------+   |
+---------------------|------------------------------------------------------|--------------------------+
                      |                                                      |
                      +--------------------------+---------------------------+
                                                 |
                                                 v
+-------------------------------------------------------------------------------------------------------+
|                                  CORE COMPILER & LOGICAL TRANSLATION                                  |
|   - AST Validation (`validate_where_expr`, partial index deterministic predicate guards)              |
|   - Synthetic Projection Rewriting (`translate_exists_subquery` dummy constant injection)             |
|   - Query Optimization & Register Allocation                                                          |
+------------------------------------------------+------------------------------------------------------+
                                                 |
                                                 v
+-------------------------------------------------------------------------------------------------------+
|                                       CORE EXECUTION RUNTIME (VDBE)                                   |
|   - Register Machine & Opcode Interpreter (turso_core::Statement)                                     |
|   - Multi-Version Concurrency Control (MVCC) Engine: Commit-time conflict detection                   |
|   - Yielding Step Engine: Returns STEP_ROW, STEP_DONE, or STEP_IO for asynchronous page loading       |
+------------------------------------------------+------------------------------------------------------+
                                                 |
                      +--------------------------+---------------------------+
                      |                                                      |
                      v                                                      v
+---------------------------------------------+    +----------------------------------------------------+
|               STORAGE ENGINE                |    |                  SYNC ENGINE                       |
| - SQLite B-Tree & Pager Compatibility Layer |    | - Local/Remote Statement Router                    |
| - Wal/Journaling (WAL, MVCC Mode)           |    | - Async Page Fault Fetching (`STEP_RESULT_ID_IO`)   |
| - Deterministic Storage Invariant Guards    |    | - Remote Write Re-routing + Auto-pull Sync Loop   |
+---------------------------------------------+    +----------------------------------------------------+
```

### Core Subsystem Boundaries & Invariant Contracts

1. **VDBE Bytecode Decoupling**: The runtime does not execute SQL ASTs directly. Parsers translate AST representations into a linear stream of VDBE instructions with explicit register addressing. A unified logical intermediate representation ensures optimizations (e.g., predicate pushdown, sublink extraction) function identically across SQLite and PostgreSQL wire clients.
2. **Asynchronous Page Faulting (`STEP_RESULT_ID_IO`)**: Rather than blocking an OS thread during page retrieval in distributed or partial-sync environments, the VDBE transitions into a cooperative yielding state (`STEP_RESULT_ID_IO` / `TursoStatus.IO`). The execution context pauses, dispatches an out-of-band I/O task to fetch missing storage pages over HTTP/WebSocket, and resumes execution seamlessly.
3. **Optimistic Multi-Version Concurrency Control (MVCC)**: Turso introduces non-blocking writes (`BEGIN CONCURRENT`). Multiple writers modify private page snapshots concurrently without holding global exclusive mutexes. The storage engine validates commit sets at commit time, failing conflicting transactions with `SQLITE_BUSY_SNAPSHOT` or conflict errors, mandating an application-level rollback and retry protocol.
4. **Foreign Language Native Interop (JNI, JSI, PyO3, N-API)**: The core engine enforces a strict pointer-passing contract across FFI boundaries. Memory ownership is encapsulated inside Rust heap-allocated structures (`Box<TursoStatement>`), projected across FFI boundaries as raw 64-bit integer addresses (`jlong`, `uintptr_t`), and re-materialized with mandatory null-check guards before dereferencing.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Defense for Synthetically Injected AST Projections
**RULE**:
When an AST transformer synthetically injects dummy columns or constants into an empty projection list (such as translating `EXISTS (SELECT FROM t)` into `EXISTS (SELECT 1 FROM t)` to satisfy an underlying engine requirement that all `SELECT` queries have at least one column), it **MUST** perform strict position-based clause validation (`ORDER BY n`, `GROUP BY n`) **PRIOR** to injecting the synthetic target, and reject positional references with an engine-native error code (e.g., `SQLSTATE 42P10`).

**WHY**:
An empty select list `SELECT FROM t` mathematically has no projection positions. If an AST translator injects an expression (like literal `1`) to satisfy storage or execution prerequisites, subsequent compilation passes will see a valid target at position `1`. If the user passed `ORDER BY 1` or `GROUP BY 1`, the compiler would resolve position `1` to the newly injected synthetic constant rather than failing with an invalid column reference error. This causes semantic corruption, silent query miscompilation, and database wire incompatibility.

**WHEN TO APPLY**:
Apply in SQL dialect translation layers, AST normalization pipelines, query rewriters, and transpile layers converting non-standard queries (e.g., PostgreSQL empty target lists) into strict relational representations (e.g., SQLite/VDBE engines).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Invariant: Synthetic AST transforms must never expose injected nodes to position-based indexing
fn translate_exists_subquery(
    &self,
    select: &pg_query::protobuf::SelectStmt,
) -> Result<ast::Select, ParseError> {
    use pg_query::protobuf::{a_const, node::Node, AConst, Integer, ResTarget};

    // Fast-path: If the projection is already populated or is a compound/values query, translate as-is
    if !select.target_list.is_empty()
        || !select.values_lists.is_empty()
        || is_set_operation(select)
    {
        return self.translate_select(select);
    }

    // MANDATORY: Validate positional references before mutating target_list
    reject_positions_in_empty_select_list(select)?;

    // Safe injection of constant 1 for EXISTS boolean check
    let one = AConst {
        val: Some(a_const::Val::Ival(Integer { ival: 1 })),
        ..Default::default()
    };
    let target = ResTarget {
        val: Some(Box::new(pg_query::protobuf::Node {
            node: Some(Node::AConst(one)),
        })),
        ..Default::default()
    };

    let mut select_mut = select.clone();
    select_mut.target_list.push(pg_query::protobuf::Node {
        node: Some(Node::ResTarget(Box::new(target))),
    });

    self.translate_select(&select_mut)
}

fn reject_positions_in_empty_select_list(
    select: &pg_query::protobuf::SelectStmt,
) -> Result<(), ParseError> {
    use pg_query::protobuf::{a_const, node::Node, AConst};

    let order_by = select
        .sort_clause
        .iter()
        .filter_map(|item| match &item.node {
            Some(Node::SortBy(sort_by)) => sort_by.node.as_deref(),
            _ => None,
        });

    let items = order_by
        .map(|item| ("ORDER BY", item))
        .chain(select.group_clause.iter().map(|item| ("GROUP BY", item)));

    for (clause, item) in items {
        if let Some(Node::AConst(AConst {
            val: Some(a_const::Val::Ival(position)),
            ..
        })) = &item.node
        {
            return Err(ParseError::Sqlstate {
                sqlstate: SQLSTATE_INVALID_COLUMN_REFERENCE, // 42P10
                message: format!("{clause} position {} is not in select list", position.ival),
            });
        }
    }
    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Mutating projection list without checking pre-existing position references
fn translate_exists_subquery_unsafe(
    &self,
    mut select: pg_query::protobuf::SelectStmt,
) -> Result<ast::Select, ParseError> {
    if select.target_list.is_empty() {
        // BUG: Injected '1' becomes target_list[0].
        // If query contains 'ORDER BY 1', it silently resolves to ordering by the constant 1!
        select.target_list.push(make_const_int_node(1));
    }
    self.translate_select(&select)
}
```

**VERIFICATION METHOD**:
Execute SQL conformance tests with positional sort/group clauses against empty targets:
```sql
-- Test 1: Must reject ORDER BY position
SELECT a FROM (VALUES (1)) AS t1(a) WHERE EXISTS (SELECT FROM (VALUES (2)) AS t2(b) ORDER BY 1);
-- Expect: SQLSTATE 42P10 "ORDER BY position 1 is not in select list"

-- Test 2: Must reject GROUP BY position
SELECT a FROM (VALUES (1)) AS t1(a) WHERE EXISTS (SELECT FROM (VALUES (2)) AS t2(b) GROUP BY 1);
-- Expect: SQLSTATE 42P10 "GROUP BY position 1 is not in select list"
```

---

### 2. Schema-Level Determinism Enforcement for Persistent Expressions
**RULE**:
Any expression persisted into a database catalog, schema table (e.g., `sqlite_schema`), or serialized index metadata (such as partial index `WHERE` clauses or generated column expressions) **MUST NOT** contain non-deterministic literals or functions (including `CURRENT_TIME`, `CURRENT_DATE`, `CURRENT_TIMESTAMP`, and `RANDOM()`). Validation **MUST** fail synchronously at `CREATE` statement compilation time.

**WHY**:
A partial index evaluates its `WHERE` predicate to decide whether a row is indexed. If non-deterministic temporal functions are evaluated, whether a row belongs in an index changes arbitrarily as physical time elapses. Furthermore, when SQLite or downstream tools reload the database file, their schema parsers reject tables/indices containing temporal literals with fatal parse errors, causing catastrophic database corruption and permanent denial-of-service on file loading.

**WHEN TO APPLY**:
Apply in query compilation, schema catalog writers, DDL evaluators, and index creation validators for relational databases or embedded engines sharing file format compatibility with SQLite/PostgreSQL.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Invariant: Non-deterministic expressions are strictly forbidden in persistent schema metadata
pub fn validate_where_expr(expr: &ast::Expr) -> Result<(), LimboError> {
    match expr {
        ast::Expr::Literal(lit) => match lit {
            ast::Literal::CurrentDate
            | ast::Literal::CurrentTime
            | ast::Literal::CurrentTimestamp => Err(LimboError::ParseError(
                "non-deterministic functions prohibited in partial index WHERE clauses".to_string(),
            )),
            _ => Ok(()),
        },
        ast::Expr::FunctionCall { name, args, .. } => {
            if is_non_deterministic_func(name) {
                return Err(LimboError::ParseError(format!(
                    "non-deterministic function {name} prohibited in partial index WHERE clauses"
                )));
            }
            for arg in args {
                validate_where_expr(arg)?;
            }
            Ok(())
        }
        ast::Expr::Binary(left, _, right) => {
            validate_where_expr(left)?;
            validate_where_expr(right)
        }
        ast::Expr::Unary(_, inner) => validate_where_expr(inner),
        _ => Ok(()),
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blindly accepting all Literal enum variants as deterministic
pub fn validate_where_expr_flawed(expr: &ast::Expr) -> Result<(), LimboError> {
    match expr {
        // BUG: In many AST designs, CURRENT_TIMESTAMP is modeled as Expr::Literal,
        // not Expr::FunctionCall. Accepting all literals permits temporal non-determinism!
        ast::Expr::Literal(_) => Ok(()),
        ast::Expr::Column(_) => Ok(()),
        _ => todo!(),
    }
}
```

**VERIFICATION METHOD**:
Run differential schema validation against SQLite:
```sql
CREATE TABLE t(a);
CREATE INDEX i ON t(a) WHERE CURRENT_TIMESTAMP IS NOT NULL;
-- Invariant: Must fail immediately at execution with Parse Error.
-- Inspection of sqlite_schema must confirm index 'i' was never written:
SELECT count(*) FROM sqlite_schema WHERE name = 'i';
-- Expect: 0
```

---

### 3. Cooperative Microtask Polling in Async I/O Storage Drivers
**RULE**:
When an asynchronous database driver consumes a cooperatively stepping virtual machine that yields on missing I/O pages (`STEP_IO`), the driver **MUST** execute the I/O drain callback within an bounded-retry execution loop, and **MUST** re-enter the native batch reading path immediately after each resolution rather than dropping down to single-row stepping. The loop **MUST** be bounded by an explicit hardware/network tripwire (e.g., `MAX_IO_RETRIES = 1_000_000`) to prevent infinite lockups on permanent page-read failures.

**WHY**:
In distributed and sync-enabled databases, storage pages can be requested lazily during a query execution loop. If the I/O event is handled by degrading into unbuffered row-by-row stepping, execution throughput collapses by up to 2 orders of magnitude due to FFI context switching. Conversely, if an I/O request yields indefinitely without a retry ceiling, a deadlocked network pipe or corrupted remote offset will cause the host process event loop to spin forever, consuming 100% CPU.

**WHEN TO APPLY**:
Apply in native wrapper SDKs (React Native, Node.js, Python, Java) interfacing with zero-copy, lazy-page-loading database engines that emit step yield codes (`STEP_RESULT_ID_IO`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Invariant: Bulk read loop handling out-of-band I/O resolution with bounded tripwire
 */
async all(...params: BindParams[]): Promise<Row[]> {
  if (this._finalized) {
    throw new Error('Statement has been finalized');
  }

  if (this._execLock) {
    await this._execLock.acquire();
  }

  try {
    if (params.length > 0) {
      this.bind(...params);
    }

    let rows: Row[] = [];
    const MAX_IO_RETRIES = 1_000_000;

    for (let ioRetries = 0; ioRetries < MAX_IO_RETRIES; ioRetries++) {
      // Re-enter native bulk reader to stay on high-throughput C++/Rust fast-path
      const bulk = this._statement.getAllRows();

      if (bulk.rows && bulk.rows.length > 0) {
        rows = rows.concat(bulk.rows);
      }

      if (bulk.status === TursoStatus.DONE) {
        return rows;
      }

      if (bulk.status === TursoStatus.IO) {
        // Drive native storage page loader
        this._statement.runIo();

        // Drain external synchronization queue asynchronously
        if (this._extraIo) {
          await this._extraIo();
        }
        continue;
      }

      throw new Error(`getAllRows failed with status: ${bulk.status}`);
    }

    throw new Error(`getAllRows: exceeded ${MAX_IO_RETRIES} IO retries`);
  } finally {
    this._statement.reset();
    if (this._execLock) {
      this._execLock.release();
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Unbounded while(true) and dropping to slow-path step on IO
async all_unsafe(): Promise<Row[]> {
  const rows = [];
  while (true) { // BUG: Infinite loop risk if I/O queue stalls
    const status = this._statement.step();
    if (status === TursoStatus.IO) {
      await this.drainIo();
      continue;
    }
    if (status === TursoStatus.DONE) break;
    rows.push(this.readRow()); // BUG: Severe JSI/FFI boundary thrashing
  }
  return rows;
}
```

**VERIFICATION METHOD**:
Simulate network fault injection where page faults return synthetic pending I/O packets:
1. Verify that `all()` consumes pages without dropping to individual JSI `step()` invocations.
2. Inject an unresolved `TursoStatus.IO` generator and assert that execution terminates after exactly 1,000,000 cycles with the error `'getAllRows: exceeded 1000000 IO retries'`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: AST Transpiler Silent Miscompilation of `EXISTS` Empty Target Lists (BUG-TURSO-01)
- **Context**: PostgreSQL parser compatibility frontend: `postgres/parser/translator.rs`
- **What Was Expected**: Executing queries containing subqueries with empty projections such as:
  ```sql
  SELECT a FROM (VALUES (1), (2)) AS t1(a)
  WHERE EXISTS (SELECT FROM (VALUES (2)) AS t2(b) WHERE t2.b > t1.a);
  ```
  PostgreSQL 17 returns `1`. A query emitted by ORMs (specifically `drizzle-kit pull` when inspecting catalog schema columns) must compile and evaluate to standard boolean existence semantics.
- **What Actually Happened**: Turso’s PostgreSQL translator rejected the statement during query compilation with `Parse error: SELECT requires at least one column or expression`. When initially patched to push a synthetic integer `1` into `select.target_list`, queries such as `EXISTS (SELECT FROM t ORDER BY 1)` erroneously succeeded by ordering rows against the injected synthetic column `1`, violating the PostgreSQL invariant that ordering by an invalid position must fail.
- **Evidence in Repo**: Commit `738164f5`, Fixes Issue `#10899`, modified `postgres/COMPAT.md`, `postgres/conformance/pg-sqltests/select.sqltest`, `postgres/parser/translator.rs`.
- **Root Cause**: `translate_select` enforced the invariant that a Turso VDBE `Select` statement requires at least one target expression. However, SQL `EXISTS` predicates ignore column projections entirely (only checking row cardinality). The translator failed to decouple `EXISTS` subquery requirements from general projection requirements, and lacked validation against positional arguments before synthesizing columns.
- **Remediation Code Diff**:
```rust
@@ -4261,7 +4261,10 @@ impl PostgreSQLTranslator {
                 ));
             }
         };
-        let select = Box::new(self.translate_select(select_stmt)?);
+        let select = Box::new(match sub_link.sub_link_type() {
+            SubLinkType::ExistsSublink => self.translate_exists_subquery(select_stmt)?,
+            _ => self.translate_select(select_stmt)?,
+        });

+    fn translate_exists_subquery(
+        &self,
+        select: &pg_query::protobuf::SelectStmt,
+    ) -> Result<ast::Select, ParseError> {
+        if !select.target_list.is_empty()
+            || !select.values_lists.is_empty()
+            || is_set_operation(select)
+        {
+            return self.translate_select(select);
+        }
+        reject_positions_in_empty_select_list(select)?;
+        let one = AConst {
+            val: Some(a_const::Val::Ival(Integer { ival: 1 })),
+            ..Default::default()
+        };
+        let target = ResTarget {
+            val: Some(Box::new(pg_query::protobuf::Node {
+                node: Some(Node::AConst(one)),
+            })),
+            ..Default::default()
+        };
+        let mut select = select.clone();
+        select.target_list.push(pg_query::protobuf::Node {
+            node: Some(Node::ResTarget(Box::new(target))),
+        });
+        self.translate_select(&select)
+    }
```
- **Lesson**: AST rewrites that inject synthetic nodes must be contextualized to the operator invoking them, and must aggressively validate constraints (`ORDER BY`, `GROUP BY`) against the pre-transformed AST state.

---

### Incident 2: Non-Deterministic Temporal Literals in Partial Index Schema Corruption (BUG-TURSO-02)
- **Context**: Schema parser & index validator: `core/translate/index.rs` and `core/schema`
- **What Was Expected**: Running `CREATE INDEX i ON t(a) WHERE CURRENT_TIMESTAMP IS NOT NULL;` must fail compilation immediately because partial index filtering predicates must be pure, deterministic functions of table row contents.
- **What Actually Happened**: Turso accepted the index creation and serialized the index definition directly into `sqlite_schema`. When the database file was subsequently re-opened in standard SQLite, SQLite aborted startup with `Parse error: non-deterministic functions prohibited in partial index WHERE clauses`, effectively rendering the database file permanently corrupted and unreadable.
- **Evidence in Repo**: Issue `#11058`, Fixes Issue `#6941`, updated `partial_idx.sqltest`, `docs/sql-reference/statements/create-index.mdx`.
- **Root Cause**: `Index::validate_where_expr` accepted all enum instances matching `Expr::Literal(_)`. Unlike SQL function calls (e.g. `random()`), temporal keywords `CURRENT_DATE`, `CURRENT_TIME`, and `CURRENT_TIMESTAMP` were parsed into the `Literal` enum variant rather than `FunctionCall`. Consequently, they bypassed the function determinism checker.
- **Remediation Code Diff**:
```rust
// In core/schema / index validation:
- match expr {
-     ast::Expr::Literal(_) => Ok(()),
-     ...
- }
+ match expr {
+     ast::Expr::Literal(
+         ast::Literal::CurrentDate 
+         | ast::Literal::CurrentTime 
+         | ast::Literal::CurrentTimestamp
+     ) => {
+         Err(LimboError::ParseError(
+             "non-deterministic functions prohibited in partial index WHERE clauses".to_string()
+         ))
+     }
+     ast::Expr::Literal(_) => Ok(()),
+     ...
+ }
```
- **Lesson**: Abstract Syntax Tree type classifications must not confuse syntax representations (`Literal`) with semantic properties (`Determinism`). Every persistent database catalog write must undergo strict static determinism analysis.

---

### Incident 3: Python Async Connection Dynamic Callable URL Type Assertion Crash (BUG-TURSO-03)
- **Context**: Python Language Bindings: `bindings/python/turso/sync.py` and PyO3 configuration layer
- **What Was Expected**: Passing a dynamic factory function for rotating URLs to `turso.sync.connect("db.db", lambda: "http://127.0.0.1:23817")` must dynamically evaluate the endpoint URL per HTTP request.
- **What Actually Happened**: The initialization aborted with:
  ```text
  TypeError: 'function' object is not an instance of 'str' while processing 'remote_url'
  ```
- **Evidence in Repo**: Issue `#11055`, verified in `test_database_sync.py::test_callable_remote_url` and `test_database_sync_aio.py`.
- **Root Cause**: The Python initialization function forwarded `remote_url` directly into `PyTursoSyncDatabaseConfig`, which expected a strictly typed Rust string (`Option<String>`). While the internal HTTP handler (`_HttpContext.base_url()`) already supported callable evaluation, the outer sync bootstrap layer performed eager type assertions that rejected callables.
- **Remediation Code Diff**:
```python
# bindings/python/turso/sync.py
- config = PyTursoSyncDatabaseConfig(remote_url=remote_url, ...)
+ config = PyTursoSyncDatabaseConfig(
+     remote_url=remote_url if isinstance(remote_url, str) else None,
+     ...
+ )

# Ensure protocol rewrites (libsql:// -> https://) occur lazily inside base_url()
def _to_https_url(url: str) -> str:
    if url.startswith("libsql://") or url.startswith("turso://"):
        return "https://" + url.split("://", 1)[1]
    return url

class _HttpContext:
    def base_url(self) -> str:
        url = self._callable_url() if callable(self._callable_url) else self._static_url
        return _to_https_url(url)
```
- **Lesson**: High-level dynamic language conveniences (callable lazy providers) must be decoupled from low-level static FFI initialization structs.

---

### Incident 4: Parameter Binding Data Races in Multi-Threaded/Async Statements (BUG-TURSO-04)
- **Context**: React Native / Native Statement Wrapper: `bindings/react-native/src/Statement.ts`
- **What Was Expected**: Concurrent asynchronous calls to `stmt.run(arg1)` and `stmt.run(arg2)` on a shared prepared statement must execute sequentially with their respective parameters bound cleanly.
- **What Actually Happened**: Before strict critical section scoping, parameter binding was performed before acquiring the asynchronous statement execution lock (`_execLock.acquire()`). Interleaving microtasks between parameter binding and native step execution caused Query B to overwrite parameters bound by Query A, leading to data corruption and foreign-key constraint failures.
- **Evidence in Repo**: `bindings/react-native/src/Statement.ts` lines 122–136, 175–189.
- **Root Cause**: Violation of lock atomicity: mutable state mutations (`bind()`) were executed outside the mutex boundary governing the execution cycle (`_runInner()`).
- **Remediation Code Diff**:
```typescript
@@ bindings/react-native/src/Statement.ts
   async run(...params: BindParams[]): Promise<RunResult> {
     if (this._finalized) {
       throw new Error('Statement has been finalized');
     }
 
+    if (this._execLock) {
+      await this._execLock.acquire();
+    }
     try {
-      if (params.length > 0) {
-        this.bind(...params);
-      }
-      if (this._execLock) {
-        await this._execLock.acquire();
-      }
+      // Parameter binding MUST occur inside the acquired lock boundary
+      if (params.length > 0) {
+        this.bind(...params);
+      }
       return await this._runInner();
     } finally {
       this._statement.reset();
       if (this._execLock) {
         this._execLock.release();
       }
     }
```
- **Lesson**: All state mutators preceding an operation must be strictly enclosed within the synchronization lock that guards the operation itself.

---

### Incident 5: Dedicated Thread Queue Poisoning and Future Leakage on Cancellation (BUG-TURSO-05)
- **Context**: Async Python Engine Worker: `bindings/python/turso/worker.py`
- **What Was Expected**: When a caller cancels an `asyncio.Future` associated with an in-flight database task, the background worker thread executing sequentially must not deadlock or crash.
- **What Actually Happened**: Cancelled futures left in the `SimpleQueue` resulted in the background thread attempting to assign execution results to an already cancelled `Future`, raising `asyncio.InvalidStateError` inside the worker loop and killing the thread.
- **Evidence in Repo**: `bindings/python/turso/worker.py` lines 34–45.
- **Root Cause**: The background worker thread did not verify whether the consuming `Future` was still active before running the heavy callable and invoking `fut.set_result`.
- **Remediation Code Diff**:
```python
@@ bindings/python/turso/worker.py
     def run(self) -> None:
         while True:
             item = self._queue.get()
             fut, func = item
+            if fut.cancelled():
+                # Skip execution and do not attempt to fulfill cancelled futures
+                continue
             try:
                 result = func()
                 if result is STOP_RUNNING_SENTINEL:
                     break
             except