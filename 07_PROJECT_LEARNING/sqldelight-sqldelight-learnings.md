# Forensic Learning Record (Deep Inspection): sqldelight/sqldelight

> **Canonical Artifact**: `07_PROJECT_LEARNING/sqldelight-sqldelight-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sqldelight/sqldelight](https://github.com/sqldelight/sqldelight))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:43:32.822Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sqldelight/sqldelight`
- **Description**: SQLDelight - Generates typesafe Kotlin APIs from SQL
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6888 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `dialects/sqlite-3-18/src/main/kotlin/app/cash/sqldelight/dialects/sqlite_3_18/grammar/mixins/StatementValidatorMixin.kt`
```
package app.cash.sqldelight.dialects.sqlite_3_18.grammar.mixins

import com.alecstrong.sql.psi.core.SqlAnnotationHolder
import com.alecstrong.sql.psi.core.psi.SqlBindExpr
import com.alecstrong.sql.psi.core.psi.SqlCompositeElement
import com.alecstrong.sql.psi.core.psi.SqlTypes
import com.alecstrong.sql.psi.core.psi.impl.SqlStmtImpl
import com.intellij.lang.ASTNode
import com.intellij.psi.tree.TokenSet

open class StatementValidatorMixin(node: ASTNode) : SqlStmtImpl(node) {
  private fun SqlCompositeElement.annotateReservedKeywords(annotationHolder: SqlAnnotationHolder) {
    if (this is SqlBindExpr) return
    children.filterIsInstance<SqlCompositeElement>().forEach {
      it.annotateReservedKeywords(annotationHolder)
    }
    node.getChildren(TokenSet.create(SqlTypes.ID)).forEach {
      if (it.text.uppercase() in invalidIds) {
        annotationHolder.createErrorAnnotation(this, "Reserved keyword in sqlite")
      }
    }
  }

  override fun annotate(annotationHolder: SqlAnnotationHolder) {
    if (createVirtualTableStmt != null) {
      // Virtual tables do their own text parsing/validation.
      return
    }
    annotateReservedKeywords(annotationHolder)

    super.annotate(annotationHolder)
  }

  companion object {
    // If this list needs to be updated see https://github.com/cashapp/sqldelight/issues/1471#issuecomment-565771116
    // for details on how to update it.
    private val invalidIds = setOf(
      "ADD", "ALL", "ALTER", "AND", "AS", "AUTOINCREMENT", "BETWEEN", "CASE", "CHECK", "COLLATE",
      "COMMIT", "CONSTRAINT", "CREATE", "DEFAULT", "DEFERRABLE", "DELETE", "DISTINCT", "DROP",
      "ELSE", "ESCAPE", "EXCEPT", "EXISTS", "FOREIGN", "FROM", "GROUP", "HAVING", "IN", "INDEX",
      "INSERT", "INTERSECT", "INTO", "IS", "ISNULL", "JOIN", "LIMIT", "NOT", "NOTNULL", "NULL",
      "OR", "ORDER", "PRIMARY", "REFERENCES", "SELECT", "SET", "TABLE", "THEN", "TO",
      "TRANSACTION", "UNION", "UNIQUE", "UPDATE", "USING", "VALUES", "WHEN", "WHERE",
    )
  }
}

```

### Core Architecture Module: `drivers/native-driver/src/appleMain/kotlin/app/cash/sqldelight/driver/native/util/PthreadMutexRecursive.kt`
```
package app.cash.sqldelight.driver.native.util

actual val pthread_mutex_recursive = platform.posix.PTHREAD_MUTEX_RECURSIVE

```

### Core Architecture Module: `drivers/native-driver/src/linuxMain/kotlin/app/cash/sqldelight/driver/native/util/PthreadMutexRecursive.kt`
```
package app.cash.sqldelight.driver.native.util

actual val pthread_mutex_recursive = platform.posix.PTHREAD_MUTEX_RECURSIVE.toInt()

```

### Core Architecture Module: `drivers/native-driver/src/mingwMain/kotlin/app/cash/sqldelight/driver/native/util/PoolLock.kt`
```
package app.cash.sqldelight.driver.native.util

import co.touchlab.stately.concurrency.AtomicBoolean
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.alloc
import kotlinx.cinterop.free
import kotlinx.cinterop.nativeHeap
import kotlinx.cinterop.ptr
import platform.posix.PTHREAD_MUTEX_RECURSIVE
import platform.posix.pthread_cond_destroy
import platform.posix.pthread_cond_init
import platform.posix.pthread_cond_signal
import platform.posix.pthread_cond_tVar
import platform.posix.pthread_cond_wait
import platform.posix.pthread_mutex_destroy
import platform.posix.pthread_mutex_init
import platform.posix.pthread_mutex_lock
import platform.posix.pthread_mutex_tVar
import platform.posix.pthread_mutex_unlock
import platform.posix.pthread_mutexattr_destroy
import platform.posix.pthread_mutexattr_init
import platform.posix.pthread_mutexattr_settype
import platform.posix.pthread_mutexattr_tVar

@OptIn(ExperimentalForeignApi::class)
internal actual class PoolLock actual constructor(reentrant: Boolean) {
  private val isActive = AtomicBoolean(true)
  private val attr = nativeHeap.alloc<pthread_mutexattr_tVar>()
    .apply {
      pthread_mutexattr_init(ptr)
      if (reentrant) {
        pthread_mutexattr_settype(ptr, PTHREAD_MUTEX_RECURSIVE)
      }
    }
  private val mutex = nativeHeap.alloc<pthread_mutex_tVar>()
    .apply { pthread_mutex_init(ptr, attr.ptr) }
  private val cond = nativeHeap.alloc<pthread_cond_tVar>()
    .apply { pthread_cond_init(ptr, null) }

  actual fun <R> withLock(
    action: CriticalSection.() -> R,
  ): R {
    check(isActive.value)
    pthread_mutex_lock(mutex.ptr)

    val result: R

    try {
      result = action(CriticalSection())
    } finally {
      pthread_mutex_unlock(mutex.ptr)
    }

    return result
  }

  actual fun notifyConditionChanged() {
    pthread_cond_signal(cond.ptr)
  }

  actual fun close(): Boolean {
    if (isActive.compareAndSet(expected = true, new = false)) {
      pthread_cond_destroy(cond.ptr)
      pthread_mutex_destroy(mutex.ptr)
      pthread_mutexattr_destroy(attr.ptr)
      nativeHeap.free(cond)
      nativeHeap.free(mutex)
      nativeHeap.free(attr)
      return true
    }

    return false
  }

  actual inner class CriticalSection {
    actual fun <R> loopForConditionalResult(block: () -> R?): R {
      check(isActive.value)

      var result = block()

      while (result == null) {
        pthread_cond_wait(cond.ptr, mutex.ptr)
        result = block()
      }

      return result
    }
  }
}

```

### Core Architecture Module: `drivers/native-driver/src/nativeLinuxLikeMain/kotlin/app/cash/sqldelight/driver/native/util/PoolLock.kt`
```
package app.cash.sqldelight.driver.native.util

import co.touchlab.stately.concurrency.AtomicBoolean
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.alloc
import kotlinx.cinterop.free
import kotlinx.cinterop.nativeHeap
import kotlinx.cinterop.ptr
import platform.posix.pthread_cond_destroy
import platform.posix.pthread_cond_init
import platform.posix.pthread_cond_signal
import platform.posix.pthread_cond_t
import platform.posix.pthread_cond_wait
import platform.posix.pthread_mutex_destroy
import platform.posix.pthread_mutex_init
import platform.posix.pthread_mutex_lock
import platform.posix.pthread_mutex_t
import platform.posix.pthread_mutex_unlock
import platform.posix.pthread_mutexattr_destroy
import platform.posix.pthread_mutexattr_init
import platform.posix.pthread_mutexattr_settype
import platform.posix.pthread_mutexattr_t

@OptIn(ExperimentalForeignApi::class)
internal actual class PoolLock actual constructor(reentrant: Boolean) {
  private val isActive = AtomicBoolean(true)
  private val attr = nativeHeap.alloc<pthread_mutexattr_t>()
    .apply {
      pthread_mutexattr_init(ptr)
      if (reentrant) {
        pthread_mutexattr_settype(ptr, pthread_mutex_recursive)
      }
    }
  private val mutex = nativeHeap.alloc<pthread_mutex_t>()
    .apply { pthread_mutex_init(ptr, attr.ptr) }
  private val cond = nativeHeap.alloc<pthread_cond_t>()
    .apply { pthread_cond_init(ptr, null) }

  actual fun <R> withLock(
    action: CriticalSection.() -> R,
  ): R {
    check(isActive.value)
    pthread_mutex_lock(mutex.ptr)

    val result: R

    try {
      result = action(CriticalSection())
    } finally {
      pthread_mutex_unlock(mutex.ptr)
    }

    return result
  }

  actual fun notifyConditionChanged() {
    pthread_cond_signal(cond.ptr)
  }

  actual fun close(): Boolean {
    if (isActive.compareAndSet(expected = true, new = false)) {
      pthread_cond_destroy(cond.ptr)
      pthread_mutex_destroy(mutex.ptr)
      pthread_mutexattr_destroy(attr.ptr)
      nativeHeap.free(cond)
      nativeHeap.free(mutex)
      nativeHeap.free(attr)
      return true
    }

    return false
  }

  actual inner class CriticalSection {
    actual fun <R> loopForConditionalResult(block: () -> R?): R {
      check(isActive.value)

      var result = block()

      while (result == null) {
        pthread_cond_wait(cond.ptr, mutex.ptr)
        result = block()
      }

      return result
    }
  }
}

// https://youtrack.jetbrains.com/issue/KT-48997
internal expect val pthread_mutex_recursive: Int

```

### Core Architecture Module: `drivers/native-driver/src/nativeMain/kotlin/app/cash/sqldelight/driver/native/SqliterStatement.kt`
```
package app.cash.sqldelight.driver.native

import app.cash.sqldelight.db.SqlPreparedStatement
import co.touchlab.sqliter.Statement
import co.touchlab.sqliter.bindBlob
import co.touchlab.sqliter.bindDouble
import co.touchlab.sqliter.bindLong
import co.touchlab.sqliter.bindString

/**
 * @param [recycle] A function which recycles any resources this statement is backed by.
 */
internal class SqliterStatement(
  private val statement: Statement,
) : SqlPreparedStatement {
  override fun bindBytes(index: Int, bytes: ByteArray?) {
    statement.bindBlob(index + 1, bytes)
  }

  override fun bindLong(index: Int, long: Long?) {
    statement.bindLong(index + 1, long)
  }

  override fun bindDouble(index: Int, double: Double?) {
    statement.bindDouble(index + 1, double)
  }

  override fun bindString(index: Int, string: String?) {
    statement.bindString(index + 1, string)
  }

  override fun bindBoolean(index: Int, boolean: Boolean?) {
    statement.bindLong(
      index + 1,
      when (boolean) {
        null -> null
        true -> 1L
        false -> 0L
      },
    )
  }
}

```

### Core Architecture Module: `drivers/native-driver/src/nativeMain/kotlin/app/cash/sqldelight/driver/native/util/PoolLock.kt`
```
package app.cash.sqldelight.driver.native.util

internal expect class PoolLock(reentrant: Boolean = false) {
  fun <R> withLock(
    action: CriticalSection.() -> R,
  ): R

  /**
   * Select one blocked thread in [CriticalSection.loopForConditionalResult] to be woken up for
   * re-evaluation, if any.
   */
  fun notifyConditionChanged()

  fun close(): Boolean

  inner class CriticalSection {
    /**
     * Evaluate the given lambda of a conditional result in an infinite loop, until the result is
     * available.
     *
     * If null is produced, the current thread enters suspension, and are only woken up for
     * re-evaluation by a subsequent [PoolLock.notifyConditionChanged] call. Note that the lock
     * would not be held by the current thread during its suspension. This allows resources
     * protected by the same lock to remain accessible by other threads, provided that they do not
     * depend on the same conditional result.
     */
    fun <R> loopForConditionalResult(block: () -> R?): R
  }
}

```

### Core Architecture Module: `drivers/web-worker-driver/karma.config.d/wasm.js`
```
const path = require("path");
const os = require("os");
const dist = path.resolve("../../node_modules/sql.js/dist/")
const wasm = path.join(dist, "sql-wasm.wasm")

config.files.push({
    pattern: wasm,
    served: true,
    watched: false,
    included: false,
    nocache: false,
});

config.proxies["/sql-wasm.wasm"] = path.join("/absolute/", wasm)

// Adapted from: https://github.com/ryanclark/karma-webpack/issues/498#issuecomment-790040818
const output = {
  path: path.join(os.tmpdir(), '_karma_webpack_') + Math.floor(Math.random() * 1000000),
}
config.set({
  webpack: {...config.webpack, output}
});
config.files.push({
  pattern: `${output.path}/**/*`,
  watched: false,
  included: false,
});

// TODO: Figure out why on earth this is necessary. Presumably a karma-webpack bug???
delete config.webpack.optimization;

```

### Core Architecture Module: `drivers/web-worker-driver/sqljs/sqljs.worker.js`
```
import initSqlJs from "sql.js";

let db = null;
async function createDatabase() {
  let SQL = await initSqlJs({ locateFile: file => '/sql-wasm.wasm' });
  db = new SQL.Database();
}

function onModuleReady() {
  const data = this.data;

  switch (data && data.action) {
    case "exec":
      if (!data["sql"]) {
        throw new Error("exec: Missing query string");
      }

      return postMessage({
        id: data.id,
        results: db.exec(data.sql, data.params)[0] ?? { values: [] }
      });
    case "begin_transaction":
      return postMessage({
        id: data.id,
        results: db.exec("BEGIN TRANSACTION;")
      })
    case "end_transaction":
      return postMessage({
        id: data.id,
        results: db.exec("END TRANSACTION;")
      })
    case "rollback_transaction":
      return postMessage({
        id: data.id,
        results: db.exec("ROLLBACK TRANSACTION;")
      })
    default:
      throw new Error(`Unsupported action: ${data && data.action}`);
  }
}

function onError(err) {
  return postMessage({
    id: this.data.id,
    error: err
  });
}

if (typeof importScripts === "function") {
  db = null;
  const sqlModuleReady = createDatabase()
  self.onmessage = (event) => {
    return sqlModuleReady
      .then(onModuleReady.bind(event))
      .catch(onError.bind(event));
  }
}

```

### Core Architecture Module: `drivers/web-worker-driver/src/commonMain/kotlin/app/cash/sqldelight/driver/worker/CreateWebWorkerDriver.kt`
```
package app.cash.sqldelight.driver.worker

import app.cash.sqldelight.db.SqlDriver

expect fun createDefaultWebWorkerDriver(): SqlDriver

```

### Core Architecture Module: `drivers/web-worker-driver/src/commonMain/kotlin/app/cash/sqldelight/driver/worker/WebWorkerDriver.kt`
```
package app.cash.sqldelight.driver.worker

import app.cash.sqldelight.Query
import app.cash.sqldelight.Transacter
import app.cash.sqldelight.db.QueryResult
import app.cash.sqldelight.db.SqlCursor
import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.db.SqlPreparedStatement
import app.cash.sqldelight.driver.worker.api.WorkerAction
import app.cash.sqldelight.driver.worker.api.WorkerActions
import app.cash.sqldelight.driver.worker.api.WorkerResultWithRowCount
import app.cash.sqldelight.driver.worker.api.WorkerWrapperRequest
import app.cash.sqldelight.driver.worker.expected.Worker
import app.cash.sqldelight.driver.worker.expected.WorkerSqlCursor
import app.cash.sqldelight.driver.worker.expected.WorkerSqlPreparedStatement
import app.cash.sqldelight.driver.worker.expected.checkWorkerResults

/**
 * A [SqlDriver] implementation for interacting with SQL databases running in a Web Worker.
 *
 * This driver is dialect-agnostic and is instead dependent on the Worker script's implementation
 * to handle queries and send results back from the Worker.
 *
 * @property worker The Worker running a SQL implementation that this driver communicates with.
 * @see [createDefaultWebWorkerDriver]
 */
class WebWorkerDriver(private val worker: Worker) : SqlDriver {
  private val listeners = mutableMapOf<String, MutableSet<Query.Listener>>()
  private var messageCounter = 0
  private var transaction: Transacter.Transaction? = null
  private val wrapper = WorkerWrapper(worker)

  override fun <R> executeQuery(
    identifier: Int?,
    sql: String,
    mapper: (SqlCursor) -> QueryResult<R>,
    parameters: Int,
    binders: (SqlPreparedStatement.() -> Unit)?,
  ): QueryResult<R> {
    val bound = WorkerSqlPreparedStatement()
    binders?.invoke(bound)

    return QueryResult.AsyncValue {
      val response = wrapper.sendMessage(
        action = WorkerActions.exec,
        sql = sql,
        statement = bound,
      )

      return@AsyncValue mapper(WorkerSqlCursor(checkWorkerResults(response.result))).await()
    }
  }

  override fun execute(
    identifier: Int?,
    sql: String,
    parameters: Int,
    binders: (SqlPreparedStatement.() -> Unit)?,
  ): QueryResult<Long> {
    val bound = WorkerSqlPreparedStatement()
    binders?.invoke(bound)

    return QueryResult.AsyncValue {
      val response = wrapper.sendMessage(
        action = WorkerActions.exec,
        sql = sql,
        statement = bound,
      )
      checkWorkerResults(response.result)
      return@AsyncValue response.rowCount
    }
  }

  override fun addListener(vararg queryKeys: String, listener: Query.Listener) {
    queryKeys.forEach {
      listeners.getOrPut(it) { mutableSetOf() }.add(listener)
    }
  }

  override fun removeListener(vararg queryKeys: String, listener: Query.Listener) {
    queryKeys.forEach {
      listeners[it]?.remove(listener)
    }
  }

  override fun notifyListeners(vararg queryKeys: String) {
    queryKeys.flatMap { listeners[it].orEmpty() }
      .distinct()
      .forEach(Query.Listener::queryResultsChanged)
  }

  override fun close() = wrapper.terminate()

  override fun newTransaction(): QueryResult<Transacter.Transaction> = QueryResult.AsyncValue {
    val enclosing = transaction
    val transaction = Transaction(enclosing)
    this.transaction = transaction
    if (enclosing == null) {
      wrapper.sendMessage(WorkerActions.beginTransaction)
    }

    return@AsyncValue transaction
  }

  override fun currentTransaction(): Transacter.Transaction? = transaction

  private inner class Transaction(
    override val enclosingTransaction: Transacter.Transaction?,
  ) : Transacter.Transaction() {
    override fun endTransaction(successful: Boolean): QueryResult<Unit> = QueryResult.AsyncValue {
      if (enclosingTransaction == null) {
        if (successful) {
          wrapper.sendMessage(WorkerActions.endTransaction)
        } else {
          wrapper.sendMessage(WorkerActions.rollbackTransaction)
        }
      }
      transaction = enclosingTransaction
    }
  }

  private suspend fun WorkerWrapper.sendMessage(
    action: WorkerAction,
    sql: String? = null,
    statement: WorkerSqlPreparedStatement? = null,
  ): WorkerResultWithRowCount {
    val id = messageCounter++
    return execute(
      WorkerWrapperRequest(
        id = id,
        action = action,
        sql = sql,
        statement = statement,
      ),
    )
  }
}

```

### Core Architecture Module: `drivers/web-worker-driver/src/commonMain/kotlin/app/cash/sqldelight/driver/worker/WebWorkerException.kt`
```
package app.cash.sqldelight.driver.worker

class WebWorkerException(message: String) : Throwable(message)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6384** (2026-10-05): **Exception in plugin SQLDelight**
  *Symptoms*: ### SQLDelight Version  2.3.2  ### IDE Version  Androoid Studio Rabbit 1 2026.2.1  ### Dialect  SQLite  ### Describe the Bug  ### Description SQLDelight IDE plugin v2.3.2 crashes on startup and during VFS/save events with `NoClassDefFoundError: org/jetbrains/kotlin/idea/util/projectStructure/ProjectStructureUtilKt`.  ### Environment - **SQLDelight Plugin Version:** 2.3.2 - **IDE:** Android Studio (Build #AI-262.9437.185.2621.16467767 / Android Studio Rabbit 1 | 2026.2.1) - **OS:** macOS  ### Steps to Reproduce 1. Install SQLDelight plugin v2.3.2 into Android Studio. 2. Open a project with SQLDelight configured. 3. Observe the "IDE error occurred" popup notification on startup or when files are saved.  ### Root Cause / Details `app.cash.sqldelight.intellij.ProjectService.findConfiguredFileIndex(ProjectService.kt:124)` references `org.jetbrains.kotlin.idea.util.projectStructure.ProjectStructureUtilKt`. In recent platform/Kotlin plugin builds (262+ platform baseline / K2 plugin restructuring), this class/package has been moved or removed, causing runtime linkage failure.  ### Stacktrace  ```shell java.lang.NoClassDefFoundError: org/jetbrains/kotlin/idea/util/projectStructure/ProjectStructureUtilKt 	at app.cash.sqldelight.intellij.ProjectService.findConfiguredFileIndex(ProjectService.kt:124) 	at app.cash.sqldelight.intellij.ProjectService.access$findConfiguredFileIndex(ProjectService.kt:63) 	at app.cash.sqldelight.intellij.ProjectService$1.after(ProjectService.kt:100) 	at com.int
  **Post-Mortem & Fix Analysis**:
  > See https://github.com/sqldelight/sqldelight/pull/6247  There isn't a release for 2.4.0 plugin at this time  You can try the EAP snapshot version https://plugins.jetbrains.com/plugin/8191-sqldelight/versions/eap  When updating plugins it's advisable to Invalidate Caches.   

- **Issue #6305** (2026-07-14): **'WITH' unexpected**
  *Symptoms*: ### SQLDelight Version  2.3.2  ### SQLDelight Dialect  sqlite_3_38  ### Describe the Bug  Getting the below stacktrace for this query. Any idea why?  ``` selectAllWithFirstAndLast{     WITH RankedSequences AS (         SELECT             r.id AS route_id,             r.name AS route_name,             s.sequence_id,             s.ordinal,             s.stop AS stop_id,             ROW_NUMBER() OVER (PARTITION BY s.route, s.sequence_id ORDER BY s.ordinal ASC) as rn_first,             ROW_NUMBER() OVER (PARTITION BY s.route, s.sequence_id ORDER BY s.ordinal DESC) as rn_last         FROM routes r         JOIN sequences s ON r.id = s.route     );     SELECT         rs.route_id,         rs.route_name,         rs.sequence_id,         rs.ordinal,         rs.stop_id,         st.name AS stop_name     FROM RankedSequences rs     JOIN stops st ON rs.stop_id = st.id     WHERE rs.rn_first = 1 OR rs.rn_last = 1     ORDER BY rs.route_id, rs.sequence_id, rs.ordinal; } ```  ### Stacktrace  ```shell Compiling with dialect app.cash.sqldelight.dialects.sqlite_3_38.SqliteDialect  *****.sq: (6, 32): 'WITH' unexpected ```
  **Post-Mortem & Fix Analysis**:
  > 1. as -> AS 2. Remove semi-colon  Also, but not compiler error, use of `selectAllWithFirstAndLast{` braces surrounding query are only needed for multiple statements, remove braces use `selectAllWithFirstAndLast:`   ```sql selectAllWithFirstAndLast{     WITH RankedSequences AS (         SELECT             r.id AS route_id,             r.name AS route_name,             s.sequence_id,             s.ordinal,             s.stop AS stop_id,             ROW_NUMBER() OVER (PARTITION BY s.route, s.sequence_id ORDER BY s.ordinal ASC) as rn_first, <-- AS             ROW_NUMBER() OVER (PARTITION BY s.route, s.sequence_id ORDER BY s.ordinal DESC) as rn_last <-- AS         FROM routes r         JOIN sequences s ON r.id = s.route     ); <--- remove     SELECT         rs.route_id,         rs.route_name,         rs.sequence_id,         rs.ordinal,         rs.stop_id,         st.name AS stop_name     FROM RankedSequences rs     JOIN stops st ON rs.stop_id = st.id     WHERE rs.rn_first = 1 OR rs.rn_last 

- **Issue #6296** (2026-07-10): **Support for RAISE missing in postgres-dialect**
  *Symptoms*: ### SQLDelight Version  2.3.2  ### SQLDelight Dialect  postgresql  ### Describe the Bug  I'm trying to create a trigger like this with error-handling using exceptions:  ````sql CREATE OR REPLACE FUNCTION on_insert() RETURNS TRIGGER AS $$ BEGIN     DELETE FROM thing WHERE id = new.id AND public_key = new.public_key;      IF NOT FOUND THEN         RAISE EXCEPTION 'not found';     END IF;          RETURN NEW; END; $$ LANGUAGE plpgsql; ````  It seems that "RAISE" is unsupported. Therefor, the parser complains with "\<stmt identifier clojure real\> expected, got 'CREATE'"  Any chance to get grammer-support for `RAISE`d warnings/exceptions?  ### Stacktrace  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Ok, I can add in some support for `RAISE ...`.   Meanwhile, you may be able use a client side transaction for your statements ( insert depending on a delete ).  There is quite a lot of grammar, so I would only add in the useful minimum https://www.postgresql.org/docs/current/plpgsql-errors-and-messages.html  Initially, I only added in the trigger/function support for audit style triggers - appending rows and updating last modified fields etc ... https://github.com/griffio/sqldelight-postgres-trigger-function/blob/master/src/main/sqldelight/griffio/migrations/V1__Initial_version.sqm  SqlDelight was originally created for Sqlite and the limitations of the PostgreSql dialect support is to work with the `sql-psi` core.
  > Hey, thank you for your work and the fast reply. I'm aware of the limitations and origins, so every improvement is greatly appreciated!  My original trigger-function is way more complicated and the usecase for raised exceptions is to distinguish different errorconditions. Ideally, to support all my usecases, the support would span `RAISE EXCEPTION/WARNING/NOTICE` as well as support for `ERRCODE`. Previously I used ERRCODE to map to different exceptions on the kotlin-side and loved the expressiveness of such a solution.  Thanks again! <3

- **Issue #6280** (2026-06-17): **[Paging3] KeyedQueryPagingSource throws NoSuchElementException on initial load if database is empty (fails to observe table updates)**
  *Symptoms*: ### SQLDelight Version  2.3.2  ### Application Operating System  Android  ### Describe the Bug  ### Describe the bug When using `KeyedQueryPagingSource` (Key-backed Paging3 implementation) with an empty database or when no matching rows exist for a query, the initial load fails with `java.util.NoSuchElementException: List is empty.` and fails to register database observers.  ### To Reproduce 1. Implement a key-based paging source using `QueryPagingSource` with `pageBoundariesProvider` and `queryProvider`. 2. Ensure the database table is completely empty. 3. Start the Paging3 query flow. 4. The PagingSource will enter an error/loading state, and subsequent inserts into the database will **not** trigger an invalidation/refresh of the PagingSource.  ### Root Cause In `KeyedQueryPagingSource.kt` inside the `load` method, when the table is empty, the `pageBoundariesProvider` query returns an empty list (`boundaries` is empty).   Since `params.key` is null on the initial load, the code attempts to retrieve the first element: ```kotlin val boundaries = pageBoundaries   ?: pageBoundariesProvider(params.key, params.loadSize.toLong())     .executeAsList()     .also { pageBoundaries = it }  val key = params.key ?: boundaries.first() // <--- Throws NoSuchElementException here ``` This exception is caught and returned as LoadResult.Error(e). Because of this early failure: The UI stays in an infinite spinner or error state. Crucially, currentQuery = it is never executed. No query listener 
  **Post-Mortem & Fix Analysis**:
  > Accidentally submitted twice.

- **Issue #6279** (2026-06-19): **[Paging3] KeyedQueryPagingSource throws NoSuchElementException on initial load if database is empty (fails to observe table updates)**
  *Symptoms*: ### SQLDelight Version  2.3.2  ### Application Operating System  Android  ### Describe the Bug  ### Describe the bug When using `KeyedQueryPagingSource` (Key-backed Paging3 implementation) with an empty database or when no matching rows exist for a query, the initial load fails with `java.util.NoSuchElementException: List is empty.` and fails to register database observers.  ### To Reproduce 1. Implement a key-based paging source using `QueryPagingSource` with `pageBoundariesProvider` and `queryProvider`. 2. Ensure the database table is completely empty. 3. Start the Paging3 query flow. 4. The PagingSource will enter an error/loading state, and subsequent inserts into the database will **not** trigger an invalidation/refresh of the PagingSource.  ### Root Cause In `KeyedQueryPagingSource.kt` inside the `load` method, when the table is empty, the `pageBoundariesProvider` query returns an empty list (`boundaries` is empty).   Since `params.key` is null on the initial load, the code attempts to retrieve the first element: ```kotlin val boundaries = pageBoundaries   ?: pageBoundariesProvider(params.key, params.loadSize.toLong())     .executeAsList()     .also { pageBoundaries = it }  val key = params.key ?: boundaries.first() // <--- Throws NoSuchElementException here ``` This exception is caught and returned as LoadResult.Error(e). Because of this early failure: The UI stays in an infinite spinner or error state. Crucially, currentQuery = it is never executed. No query listener 

- **Issue #6278** (2026-06-18): **Nesting json functions won't compile**
  *Symptoms*: ### SQLDelight Version  2.3.2  ### SQLDelight Dialect  PostgresSQL  ### Describe the Bug  Given the following query: `SELECT jsonb_agg(jsonb_build_object('id', 1));`  This won't compile. Haven't tested if nesting any function won't compile as well.  Edit 1: Actually, nesting any function inside another function call won't compile  ### Stacktrace  ```shell java.lang.StringIndexOutOfBoundsException: Range [0, 32) out of bounds for length 1 	at java.base/jdk.internal.util.Preconditions$1.apply(Preconditions.java:55) 	at java.base/jdk.internal.util.Preconditions$1.apply(Preconditions.java:52) 	at java.base/jdk.internal.util.Preconditions$4.apply(Preconditions.java:213) 	at java.base/jdk.internal.util.Preconditions$4.apply(Preconditions.java:210) 	at java.base/jdk.internal.util.Preconditions.outOfBounds(Preconditions.java:98) 	at java.base/jdk.internal.util.Preconditions.outOfBoundsCheckFromToIndex(Preconditions.java:112) 	at java.base/jdk.internal.util.Preconditions.checkFromToIndex(Preconditions.java:349) 	at java.base/java.lang.String.checkBoundsBeginEnd(String.java:4865) 	at java.base/java.lang.String.substring(String.java:2834) 	at java.base/java.lang.String.subSequence(String.java:2872) 	at kotlin.text.StringsKt__StringsKt.subSequence(Strings.kt:408) 	at app.cash.sqldelight.core.SqlDelightEnvironment.detailText(SqlDelightEnvironment.kt:252) 	at app.cash.sqldelight.core.SqlDelightEnvironment.errorMessage(SqlDelightEnvironment.kt:236) 	at app.cash.sqldelight.core.SqlDelightEnv
  **Post-Mortem & Fix Analysis**:
  > ``` '(', ')', FILTER or ORDER expected, got '(' 11    SELECT jsonb_agg(jsonb_build_object('id', 1)) ```   Yes - it's just the `jsonb_agg` grammar seems to be getting confused with taking a function as can take a value and `DISTINCT`, `ORDER BY` and `FILTER`.  You can work around with a couple of options:  Add extra parentheses as this is valid and avoids the grammar rule  ```sql SELECT jsonb_agg((jsonb_build_object('id', 1))); ```  Use a table result  ```sql  SELECT jsonb_agg(t) FROM ( SELECT 1 AS id) AS t;  ```  Both results: ``` [ { "id": 1 } ] ```

- **Issue #6263** (2026-06-16): **Making a column not null in a migration with a type alias to Kotlin generates unnecessary optional let chaining which fails the build if warnings as errors are enabled**
  *Symptoms*: ### SQLDelight Version  2.3.2  ### Operating System  Mac  ### Gradle Version  9.5.1  ### Kotlin Version  2.3.21  ### Dialect  postgres  ### AGP Version  9.1  ### Describe the Bug  V1.sqm  ```sql CREATE TABLE foo (   id UUID PRIMARY KEY,   lastModifiedAt TIMESTAMPTZ AS Instant ); ```  **FooQueries.sq**  ```sql insert: INSERT INTO foo VALUES ? ; ```  V2.sqm  ```sql ALTER TABLE foo ALTER COLUMN lastModifiedAt SET NOT NULL ; ```  Now the problem is that if you have warnings as errors enabled, the generated query class has warnings that won't allow me to continue.  > build/generated/sqldelight/code/QueryWrapper/main/queries/FooQueries.kt:22:58 Unnecessary safe call on a non-null receiver of type 'Instant'.  The offending line is:  ```kotlin bindObject(parameterIndex++, foo.lastModifiedAt?.let { fooAdapter.lastModifiedAtAdapter.encode(it) }) ```  `foo.lastModifiedAt` is not null so optional chaining with let does not make any sense. No if you remove the `AS Instant` from V1, the let won't be used since the adapter isn't required and it works.  ### Stacktrace  ```shell  ```  ### Gradle Build Script  ```gradle  ```
  **Post-Mortem & Fix Analysis**:
  > This bug appears to be  with the use of direct value binding `INSERT INTO foo VALUES ?`   Work-around use:   ```sql insert: INSERT INTO foo (id, lastModifiedAt) VALUES (?, ?); ```  Generates correct nullability (not null)  ```kotlin bindObject(parameterIndex++, fooAdapter.lastModifiedAtAdapter.encode(lastModifiedAt)) ```  I will look into to see where issue can be fixed.  Looks like the problem is here that is a bug for Postgres and predates any recent changes since Sqlite until very recently didn't support it(1)  https://github.com/sqldelight/sqldelight/blob/bffbc12cc9c7b7212277b0f82a619547acd550a1/sqldelight-compiler/src/main/kotlin/app/cash/sqldelight/core/lang/util/InsertStmtUtil.kt#L10-L18  The column nullability changed by `alter table` is not being used, it takes the nullability from the `create table` column.  (1)  The ability to set or drop NOT NULL constraints from a column using the ALTER TABLE ALTER COLUMN syntax was added in SQLite 3.53.0 (2026-04-09).
  > The only problem is that my table has many many columns so the shorthand is quite handy, but yes I'll use the workaround until there's a fix. Yes, sqlite support for basically changing anything on the columns is super super basic. 

- **Issue #6251** (2026-06-05): **`column = :partyId` vs `column IS :partyId` to generate nullable parameter**
  *Symptoms*: ### SQLDelight Version  2.3.2  ### SQLDelight Dialect  sqlite  ### Describe the Bug  I have this query where I want to sort based if a nullable `PartyId` matches the column or not:  ```sql ORDER BY   (partyId = :partyId) DESC, ```  The problem is that the generated function generates a `partyId: PartyId` meaning I can't pass null. I was hoping to get around this by doing:  ```sql ORDER BY   (partyId IS :partyId) DESC, ```  but still. It's `PartyId` and not `PartyId?`. Are there any tricks or is there a supported syntax to get sqldelight to generate a function that allows me to pass `PartyId?`?  ### Stacktrace  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 🤔 Seems to work on `2.3.2`  What else is your query doing ?  You must use `IS` on Sqlite and not '=' for nulls, as `IS` is a null-safe equality operator that is non standard in Sql.   e.g   ``` import example.PartyId;  CREATE TABLE Parties (     id INTEGER AS PartyId,     t TEXT,     r REAL ); ```  ``` sql selectParties: SELECT * FROM Parties ORDER BY (id IS :partyId) DESC; ```  ``` kotlin public class AppQueries(   driver: SqlDriver,   private val PartiesAdapter: Parties.Adapter, ) : TransacterImpl(driver) {   public fun <T : Any> selectParties(partyId: PartyId?, mapper: (     id: PartyId?,     t: String?,     r: Double?,   ) -> T): Query<T> = SelectPartiesQuery(partyId) { cursor ->     mapper(       cursor.getLong(0)?.let { PartiesAdapter.idAdapter.decode(it) },       cursor.getString(1),       cursor.getDouble(2)     )   }    public fun selectParties(partyId: PartyId?): Query<Parties> = selectParties(partyId, ::Parties)  ```  ``` kotlin    database.appQueries.selectParties(null)   
  > ```sql SELECT   title,   CASE     WHEN title LIKE :query || '%' THEN 85     WHEN title LIKE '%' || :query || '%' THEN 65     ELSE 40   END AS score FROM partyExpense WHERE title != :query AND title LIKE '%' || :query || '%' GROUP BY title ORDER BY   (partyId IS :partyId) DESC,   score DESC,   LENGTH(title) ASC,   partyExpense.createdAt DESC,   title ASC LIMIT 20 ```  generates:  ```kotlin public fun titleSuggestions(query: String, partyId: PartyId): Query<TitleSuggestions> = titleSuggestions(query, partyId, ::TitleSuggestions)    private inner class TitleSuggestionsQuery<out T : Any>(     public val query: String,     public val partyId: PartyId,     mapper: (SqlCursor) -> T,   ) : Query<T>(mapper) {     override fun addListener(listener: Query.Listener) {       driver.addListener("partyExpense", listener = listener)     }      override fun removeListener(listener: Query.Listener) {       driver.removeListener("partyExpense", listener = listener)     }      override fun <R> execute(map
  > The only other influence on the bind argument is if the column is not null e.g What is your table schema ?  `id INTEGER AS PartyId NOT NULL`  That's all it takes for the bind argument to require a value if the data can't contain nulls  Currently. I don't know any way to force a nullable PartyId since bind arguments are inferred from a column. Previously we looked at COALESCE https://github.com/sqldelight/sqldelight/pull/6144 to support Kotlin types, that returns nullable.   

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `75462856` (2026-09-29)
**Commit Message**: Keep query files in-memory for the duration of a task (#6374)

* Keep query files in-memory as well (matches files with schemas) for the duration of a task

* make PR review changes

* changelog entry

**File**: `CHANGELOG.md` (modified, +2/-2)
```diff
@@ -8,11 +8,11 @@
 
 ### Changed
 
-- Nothing yet!
+- [Gradle Plugin] Keep parsed `.sq` files in memory for the whole code generation task, so they are not parsed again after garbage collection. This can make code generation faster in large projects (#6374 by @C2H6O)
 
 ### Fixed
 
-- [IntelliJ Plugin] Fix plugin publishing violations by changing IntelliJ API use (#6366 #6368 by @griffio) 
+- [IntelliJ Plugin] Fix plugin publishing violations by changing IntelliJ API use (#6366 #6368 by @griffio)
 
 
 ## [2.4.0] - 2026-09-17
```

**File**: `sqldelight-compiler/src/test/kotlin/app/cash/sqldelight/core/ParsedFileRetentionTest.kt` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+package app.cash.sqldelight.core
+
+import app.cash.sqldelight.test.util.FixtureCompiler
+import app.cash.sqldelight.test.util.fixtureRoot
+import com.alecstrong.sql.psi.core.SqlCoreEnvironment
+import com.alecstrong.sql.psi.core.SqlFileBase
+import com.google.common.truth.Truth.assertThat
+import java.lang.ref.WeakReference
+import org.junit.Rule
+import org.junit.Test
+import org.junit.rules.TemporaryFolder
+
+class ParsedFileRetentionTest {
+  @get:Rule val tempFolder = TemporaryFolder()
+
+  @Test fun `query only files survive garbage collection after generation`() {
+    FixtureCompiler.writeSql(
+      """
+      |CREATE TABLE player(
+      |  id INTEGER NOT NULL PRIMARY KEY,
+      |  name TEXT NOT NULL
+      |);
+      """.trimMargin(),
+      tempFolder,
+      "Schema.sq",
+    )
+    FixtureCompiler.writeSql(
+      """
+      |insertPlayer:
+      |INSERT INTO player VALUES (?, ?);
+      |
+      |selectAll:
+      |SELECT * FROM player;
+      """.trimMargin(),
+      tempFolder,
+      "Queries.sq",
+    )
+
+    val result = FixtureCompiler.generateFixture(tempFolder.fixtureRoot().path)
+    assertThat(result.errors).isEmpty()
+
+    val file = WeakReference(result.environment.findFile("Queries.sq"))
+    val tree = WeakReference(file.get()!!.node)
+
+    forceGarbageCollection()
+
+    assertThat(file.get()).isNotNull()
+    assertThat(tree.get()).isNotNull()
+    val reloaded = result.environment.findFile("Queries.sq")
+    assertThat(reloaded).isSameInstanceAs(file.get())
+    assertThat(reloaded.node).isSameInstanceAs(tree.get())
+  }
+
+  private fun SqlCoreEnvironment.findFile(name: String): SqlFileBase {
+    var file: SqlFileBase? = null
+    forSourceFiles<SqlFileBase> { if (it.name == name) file = it }
+    return file!!
+  }
+
+  private fun forceGarbageCollection() {
+    val sentinel = unreachableSentinel()
+    while (sentinel.get() != null) {
+      System.gc()
+      Thread.sleep(100)
+    }
+    System.gc()
+  }
+
+  private fun unreachableSentinel() = WeakReference(Any())
+}
```

**File**: `sqldelight-gradle-plugin/src/main/kotlin/app/cash/sqldelight/core/SqlDelightEnvironment.kt` (modified, +19/-0)
```diff
@@ -89,6 +89,9 @@ class SqlDelightEnvironment(
   val module = MockModule(project, projectEnvironment.parentDisposable)
   private val moduleName = SqlDelightFileIndex.sanitizeDirectoryName(moduleName)
 
+  // IntelliJ caches parsed files weakly. Holding them here stops them from being parsed again.
+  private val retainedFiles = mutableListOf<SqlFileBase>()
+
   init {
     project.registerService(SqlDelightProjectService::class.java, this)
 
@@ -265,6 +268,7 @@ class SqlDelightEnvironment(
    * Run the SQLDelight compiler and return the error or success status.
    */
   fun generateSqlDelightFiles(logger: (String) -> Unit): CompilationStatus {
+    retainSqlFiles()
     val errors = sortedMapOf<Long, MutableList<String>>()
     val extraAnnotators = listOf(OptimisticLockCompilerAnnotator())
     annotate(
@@ -340,6 +344,21 @@ class SqlDelightEnvironment(
     return CompilationStatus.Success
   }
 
+  private fun retainSqlFiles() {
+    if (retainedFiles.isNotEmpty()) return
+    fun PsiDirectory.collect() {
+      children.forEach {
+        if (it is PsiDirectory) it.collect()
+        if (it is SqlFileBase) retainedFiles += it
+      }
+    }
+    val psiManager = PsiManager.getInstance(projectEnvironment.project)
+    (sourceFolders + dependencyFolders)
+      .mapNotNull { localFileSystem.findFileByPath(it.absolutePath) }
+      .mapNotNull { psiManager.findDirectory(it) }
+      .forEach { it.collect() }
+  }
+
   fun forMigrationFiles(body: (MigrationFile) -> Unit) {
     val psiManager = PsiManager.getInstance(projectEnvironment.project)
     val migrationFiles: Collection<MigrationFile> = sourceFolders
```

**File**: `test-util/src/main/kotlin/app/cash/sqldelight/test/util/FixtureCompiler.kt` (modified, +16/-0)
```diff
@@ -16,12 +16,14 @@
 
 package app.cash.sqldelight.test.util
 
+import app.cash.sqldelight.core.SqlDelightEnvironment
 import app.cash.sqldelight.core.compiler.SqlDelightCompiler
 import app.cash.sqldelight.core.lang.MigrationFile
 import app.cash.sqldelight.core.lang.SqlDelightQueriesFile
 import app.cash.sqldelight.dialect.api.SqlDelightDialect
 import app.cash.sqldelight.dialects.sqlite_3_18.SqliteDialect
 import com.alecstrong.sql.psi.core.SqlAnnotationHolder
+import com.alecstrong.sql.psi.core.SqlCoreEnvironment
 import com.intellij.openapi.module.Module
 import com.intellij.psi.PsiDocumentManager
 import com.intellij.psi.PsiElement
@@ -179,6 +181,15 @@ object FixtureCompiler {
     return CompilationResult(outputDirectory, compilerOutput, errors, sourceFiles.toString(), file!!)
   }
 
+  fun generateFixture(fixtureRoot: String): GenerationResult {
+    val errors = mutableListOf<String>()
+    val environment = TestEnvironment(outputDirectory = File(fixtureRoot, "output"))
+      .build(fixtureRoot, createAnnotationHolder(errors))
+    val status = environment.generateSqlDelightFiles {}
+    if (status is SqlDelightEnvironment.CompilationStatus.Failure) errors += status.errors
+    return GenerationResult(environment, errors)
+  }
+
   private fun createAnnotationHolder(
     errors: MutableList<String>,
   ) = SqlAnnotationHolder { element, message ->
@@ -212,6 +223,11 @@ object FixtureCompiler {
     val sourceFiles: String,
     val compiledFile: SqlDelightQueriesFile,
   )
+
+  class GenerationResult(
+    val environment: SqlCoreEnvironment,
+    val errors: List<String>,
+  )
 }
 
 fun TemporaryFolder.fixtureRoot() = File(root, "src/test/test-fixture")
```

---

### Incident Patch 2: `3e1bd52f` (2026-09-28)
**Commit Message**: Fix ToolWindow override violation (#6368)

* Fix ToolWindow

Registered statically through the `com.intellij.toolWindow` extension point in plugin.xml. The window is only made available once the project's dialect provides a ConnectionManager, and its content is rebuilt by app.cash.sqldelight.intellij.ProjectService whenever the dialect changes.

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 
 ### Fixed
 
-- [IntelliJ Plugin] Fix plugin publishing violations by changing IntelliJ API use (#6366 @griffio) 
+- [IntelliJ Plugin] Fix plugin publishing violations by changing IntelliJ API use (#6366 #6368 by @griffio) 
 
 
 ## [2.4.0] - 2026-09-17
```

**File**: `sqldelight-idea-plugin/src/main/kotlin/app/cash/sqldelight/intellij/ProjectService.kt` (modified, +9/-13)
```diff
@@ -47,7 +47,6 @@ import com.intellij.openapi.vfs.newvfs.events.VFileCreateEvent
 import com.intellij.openapi.vfs.newvfs.events.VFileDeleteEvent
 import com.intellij.openapi.vfs.newvfs.events.VFileEvent
 import com.intellij.openapi.vfs.newvfs.events.VFileMoveEvent
-import com.intellij.openapi.wm.ToolWindowAnchor
 import com.intellij.openapi.wm.ToolWindowManager
 import com.intellij.psi.PsiDocumentManager
 import com.intellij.psi.PsiManager
@@ -179,18 +178,15 @@ class ProjectService(val project: Project) :
       MigrationParserDefinition.stubVersion++
       ApplicationManager.getApplication().runReadAction { invalidateAllFiles() }
       ApplicationManager.getApplication().invokeLater {
-        ToolWindowManager.getInstance(project).getToolWindow("SqlDelight")?.remove()
-
-        val connectionManager = dialect.connectionManager
-        if (connectionManager != null) {
-          ToolWindowManager.getInstance(project).registerToolWindow(id = "SqlDelight") {
-            anchor = ToolWindowAnchor.BOTTOM
-            contentFactory = SqlDelightToolWindowFactory(connectionManager)
-            canCloseContent = true
-            icon = dialect.icon
-          }.apply {
-            show()
-            hide()
+        val toolWindow = ToolWindowManager.getInstance(project)
+          .getToolWindow(SqlDelightToolWindowFactory.ID)
+          ?: return@invokeLater
+        val available = dialect.connectionManager != null
+        toolWindow.setAvailable(available)
+        if (available) {
+          toolWindow.setIcon(dialect.icon)
+          if (toolWindow.contentManagerIfCreated != null) {
+            SqlDelightToolWindowFactory().createToolWindowContent(project, toolWindow)
           }
         }
       }
```

**File**: `sqldelight-idea-plugin/src/main/kotlin/app/cash/sqldelight/intellij/run/window/SqlDelightToolWindowFactory.kt` (modified, +17/-3)
```diff
@@ -1,5 +1,6 @@
 package app.cash.sqldelight.intellij.run.window
 
+import app.cash.sqldelight.core.SqlDelightProjectService
 import app.cash.sqldelight.dialect.api.ConnectionManager
 import app.cash.sqldelight.intellij.run.ConnectionOptions
 import com.intellij.openapi.project.Project
@@ -14,13 +15,20 @@ import java.awt.Insets
 import javax.swing.GroupLayout
 import javax.swing.JPanel
 
-internal class SqlDelightToolWindowFactory(
-  private val connectionManager: ConnectionManager,
-) : ToolWindowFactory {
+internal class SqlDelightToolWindowFactory : ToolWindowFactory {
+  override fun shouldBeAvailable(project: Project): Boolean = connectionManager(project) != null
+
+  override fun init(toolWindow: ToolWindow) {
+    toolWindow.setIcon(SqlDelightProjectService.getInstance(toolWindow.project).dialect.icon)
+  }
+
   override fun createToolWindowContent(
     project: Project,
     toolWindow: ToolWindow,
   ) {
+    toolWindow.contentManager.removeAllContents(true)
+    val connectionManager = connectionManager(project) ?: return
+
     val runSqlText = JPanel(BorderLayout()).apply {
       add(
         JBTextArea("Create a connection to get started.").apply {
@@ -37,6 +45,12 @@ internal class SqlDelightToolWindowFactory(
       addContent(content)
     }
   }
+
+  companion object {
+    const val ID = "SqlDelight"
+
+    private fun connectionManager(project: Project): ConnectionManager? = SqlDelightProjectService.getInstance(project).dialect.connectionManager
+  }
 }
 
 internal fun ContentManager.createWithConnectionSidePanel(
```

**File**: `sqldelight-idea-plugin/src/main/resources/META-INF/plugin.xml` (modified, +3/-0)
```diff
@@ -53,6 +53,9 @@
     <fileIconProvider implementation="app.cash.sqldelight.intellij.SqlDelightFileIconProvider" />
     <errorHandler implementation="app.cash.sqldelight.intellij.SqlDelightErrorHandler"/>
 
+    <toolWindow id="SqlDelight" anchor="bottom" canCloseContents="true" doNotActivateOnStart="true"
+        factoryClass="app.cash.sqldelight.intellij.run.window.SqlDelightToolWindowFactory"/>
+
     <stubIndex implementation="com.alecstrong.sql.psi.core.psi.SchemaContributorIndexImpl"/>
     <stubElementTypeHolder class="com.alecstrong.sql.psi.core.psi.SqlTypes" externalIdPrefix="SqlDelight.TYPES"/>
 
```

---

### Incident Patch 3: `6704029a` (2026-09-22)
**Commit Message**: Fix plugin manager core references (#6366)

* Update FileIndexMap.kt

Our own class loader is the plugin class loader, so it knows the descriptor.
This avoids the PluginManagerCore lookup, which is internal API in newer IDE versions.

* Update SqlDelightErrorHandler.kt

Remove PluginManagerCore.plugins

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 
 ### Fixed
 
-- Nothing yet!
+- [IntelliJ Plugin] Fix plugin publishing violations by changing IntelliJ API use (#6366 @griffio) 
 
 
 ## [2.4.0] - 2026-09-17
```

**File**: `sqldelight-idea-plugin/src/main/kotlin/app/cash/sqldelight/intellij/SqlDelightErrorHandler.kt` (modified, +0/-4)
```diff
@@ -20,7 +20,6 @@ import app.cash.sqldelight.VERSION
 import com.bugsnag.Bugsnag
 import com.bugsnag.Severity
 import com.intellij.diagnostic.AbstractMessage
-import com.intellij.ide.plugins.PluginManagerCore
 import com.intellij.openapi.application.ApplicationInfo
 import com.intellij.openapi.diagnostic.ErrorReportSubmitter
 import com.intellij.openapi.diagnostic.IdeaLoggingEvent
@@ -42,9 +41,6 @@ class SqlDelightErrorHandler : ErrorReportSubmitter() {
       it.addToTab("Device", "IDE Version", ApplicationInfo.getInstance().fullVersion)
       it.addToTab("Device", "IDE Build #", ApplicationInfo.getInstance().build)
       it.addToTab("Device", "Plugin SHA", GIT_SHA)
-      PluginManagerCore.plugins.forEach { plugin ->
-        it.addToTab("Plugins", plugin.name, "${plugin.pluginId} : ${plugin.version}")
-      }
     }
   }
 
```

**File**: `sqldelight-idea-plugin/src/main/kotlin/app/cash/sqldelight/intellij/gradle/FileIndexMap.kt` (modified, +2/-4)
```diff
@@ -9,9 +9,8 @@ import app.cash.sqldelight.intellij.FileIndex
 import app.cash.sqldelight.intellij.SqlDelightFileIndexImpl
 import app.cash.sqldelight.intellij.notifications.FileIndexingNotification
 import app.cash.sqldelight.intellij.resolvers.SQL_DELIGHT_MODEL_KEY
-import com.intellij.ide.plugins.PluginManagerCore
+import com.intellij.ide.plugins.cl.PluginAwareClassLoader
 import com.intellij.openapi.extensions.PluginDescriptor
-import com.intellij.openapi.extensions.PluginId
 import com.intellij.openapi.externalSystem.util.ExternalSystemApiUtil
 import com.intellij.openapi.module.Module
 import com.intellij.util.lang.ClassPath
@@ -46,8 +45,7 @@ internal class FileIndexMap {
         return@computeIfAbsent defaultIndex
       }
 
-      val pluginDescriptor = PluginManagerCore.getPlugin(PluginId.getId("com.squareup.sqldelight"))!!
-
+      val pluginDescriptor = (FileIndexMap::class.java.classLoader as PluginAwareClassLoader).pluginDescriptor
       val shouldInvalidate = pluginDescriptor.addDialect(
         propertiesFile.dialectJars.filterNot { it.path.contains("org.jetbrains.kotlin") }.map { it.toURI() },
       )
```

---

### Incident Patch 4: `b607095f` (2026-09-11)
**Commit Message**: Fix Sqlite 3.44 aggregates using GROUP BY (#6343)

For this to work with both Postgres dialect and Sqlite 3.44 a new interface is needed in dialect api AggregateFunctionExpression.

Also completes the implementation fix for PostgreSql

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
 ### Fixed
 
 - [PostgreSQL Dialect] Fix `string_agg` function to be nullable (#6340 by @griffio)
-
+- [SQLite Dialect] Fix SQLite 3.44 aggregate functions using `GROUP BY` (#6343 by @griffio)
 
 ## [2.4.0-rc1] - 2026-09-01
 [2.4.0-rc1]: https://github.com/sqldelight/sqldelight/releases/tag/2.4.0-rc1
```

**File**: `dialects/postgresql/src/main/kotlin/app/cash/sqldelight/dialects/postgresql/grammar/PostgreSql.bnf` (modified, +1/-1)
```diff
@@ -849,7 +849,7 @@ geometry_setsrid_function_stmt ::= 'ST_SetSRID' LP geometry_point_function_stmt
  mixin = "app.cash.sqldelight.dialects.postgresql.grammar.mixins.GeometryStmtExpressionMixin"
 }
 
-string_agg_stmt ::= 'string_agg' LP [ ALL | DISTINCT ] <<expr '-1'>> COMMA string_literal [ ORDER BY {ordering_term} ( COMMA {ordering_term} ) * ] RP
+string_agg_stmt ::= 'string_agg' LP [ ALL | DISTINCT ] <<expr '-1'>> COMMA <<expr '-1'>> [ ORDER BY {ordering_term} ( COMMA {ordering_term} ) * ] RP
 [ 'FILTER' LP WHERE <<expr '-1'>> RP ] {
  mixin = "app.cash.sqldelight.dialects.postgresql.grammar.mixins.AggregateExpressionMixin"
 }
```

**File**: `dialects/sqlite-3-44/src/main/kotlin/app/cash/sqldelight/dialects/sqlite_3_44/grammar/mixins/AggregateFunctionExprMixin.kt` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+package app.cash.sqldelight.dialects.sqlite_3_44.grammar.mixins
+
+import app.cash.sqldelight.dialect.api.AggregateFunctionExpression
+import com.alecstrong.sql.psi.core.SqlAnnotationHolder
+import com.alecstrong.sql.psi.core.psi.SqlCompositeElementImpl
+import com.alecstrong.sql.psi.core.psi.SqlTypes
+import com.intellij.lang.ASTNode
+
+/**
+ * `group_concat` and `string_agg` are parsed as an aggregate function expression instead of a
+ * SqlFunctionExpr, so expose them as an AggregateFunctionExpression for the compiler.
+ *
+ * Sqlite only allows `DISTINCT` on an aggregate with a single argument and always requires the
+ * separator argument of `string_agg`, use error annotation.
+ */
+internal abstract class AggregateFunctionExprMixin(
+  node: ASTNode,
+) : SqlCompositeElementImpl(node),
+  AggregateFunctionExpression {
+  private val distinct get() = node.findChildByType(SqlTypes.DISTINCT)
+
+  private val separator get() = functionArguments.getOrNull(1)
+
+  override fun annotate(annotationHolder: SqlAnnotationHolder) {
+    super.annotate(annotationHolder)
+    if (functionName.lowercase() == "string_agg" && separator == null) {
+      annotationHolder.createErrorAnnotation(this, "Wrong number of arguments to function string_agg()")
+    } else if (distinct != null && separator != null) {
+      annotationHolder.createErrorAnnotation(this, "DISTINCT aggregates must have exactly one argument")
+    }
+  }
+}
```

**File**: `dialects/sqlite-3-44/src/main/kotlin/app/cash/sqldelight/dialects/sqlite_3_44/grammar/sqlite.bnf` (modified, +2/-1)
```diff
@@ -41,8 +41,9 @@ ordering_term ::= <<expr '-1'>> [ COLLATE {collation_name} ] [ ASC | DESC ] [ 'N
   override = true
 }
 
-aggregate_function_expr ::= ('string_agg' | 'group_concat') LP [ DISTINCT ] <<expr '-1'>> [ COMMA {string_literal} ] [ ORDER BY {ordering_term} ( COMMA {ordering_term} ) * ] RP
+aggregate_function_expr ::= ('string_agg' | 'group_concat') LP [ DISTINCT ] <<expr '-1'>> [ COMMA <<expr '-1'>> ] [ ORDER BY {ordering_term} ( COMMA {ordering_term} ) * ] RP
 [ 'FILTER' LP WHERE <<expr '-1'>> RP ] {
+  mixin = "app.cash.sqldelight.dialects.sqlite_3_44.grammar.mixins.AggregateFunctionExprMixin"
 }
 
 private sqlite_3_25_window_function_expr ::= <<windowFunctionExprExt <<window_function_expr_real>>>>
```

**File**: `dialects/sqlite-3-44/src/testFixtures/resources/fixtures_sqlite_3_44/aggregate_functions/Test.s` (modified, +17/-0)
```diff
@@ -30,3 +30,20 @@ FROM users;
 SELECT STRING_AGG(name, ', ' ORDER BY created_at DESC)
 FROM users;
 
+
+-- The separator is any expression, not only a string literal
+SELECT GROUP_CONCAT(name, created_at)
+FROM users;
+
+SELECT STRING_AGG(name, created_at)
+FROM users;
+
+SELECT STRING_AGG(name, created_at ORDER BY name)
+FROM users;
+
+SELECT STRING_AGG(name, ', ' || ' ' ORDER BY name)
+FROM users;
+
+SELECT STRING_AGG(name, created_at ORDER BY name)
+   FILTER (WHERE active = 1)
+FROM users;
```

**File**: `dialects/sqlite-3-44/src/testFixtures/resources/fixtures_sqlite_3_44/aggregate_functions_distinct/Test.s` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+CREATE TABLE users (
+  id INTEGER PRIMARY KEY,
+  name TEXT
+);
+
+-- Sqlite allows DISTINCT only on an aggregate with a single argument
+SELECT GROUP_CONCAT(DISTINCT name)
+FROM users;
+
+SELECT GROUP_CONCAT(DISTINCT name ORDER BY name)
+FROM users;
+
+-- error[col 7]: DISTINCT aggregates must have exactly one argument
+SELECT GROUP_CONCAT(DISTINCT name, ', ')
+FROM users;
+
+-- error[col 7]: DISTINCT aggregates must have exactly one argument
+SELECT GROUP_CONCAT(DISTINCT name, ', ' ORDER BY name)
+FROM users;
+
+-- error[col 7]: DISTINCT aggregates must have exactly one argument
+SELECT STRING_AGG(DISTINCT name, ', ')
+FROM users;
+
+-- string_agg always requires the separator argument
+-- error[col 7]: Wrong number of arguments to function string_agg()
+SELECT STRING_AGG(name)
+FROM users;
+
+-- error[col 7]: Wrong number of arguments to function string_agg()
+SELECT STRING_AGG(DISTINCT name)
+FROM users;
+
+-- error[col 7]: DISTINCT aggregates must have exactly one argument
+SELECT STRING_AGG(DISTINCT name, name)
+FROM users;
```

**File**: `sqldelight-compiler/src/main/kotlin/app/cash/sqldelight/core/compiler/model/NamedQuery.kt` (modified, +39/-4)
```diff
@@ -30,6 +30,7 @@ import app.cash.sqldelight.core.lang.util.table
 import app.cash.sqldelight.core.lang.util.tablesObserved
 import app.cash.sqldelight.core.lang.util.type
 import app.cash.sqldelight.core.psi.SqlDelightStmtClojureStmtList
+import app.cash.sqldelight.dialect.api.AggregateFunctionExpression
 import app.cash.sqldelight.dialect.api.IntermediateType
 import app.cash.sqldelight.dialect.api.PrimitiveType.ARGUMENT
 import app.cash.sqldelight.dialect.api.PrimitiveType.BLOB
@@ -42,12 +43,14 @@ import app.cash.sqldelight.dialect.api.QueryWithResults
 import app.cash.sqldelight.dialect.api.SelectQueryable
 import com.alecstrong.sql.psi.core.psi.NamedElement
 import com.alecstrong.sql.psi.core.psi.QueryElement
+import com.alecstrong.sql.psi.core.psi.SqlColumnAlias
 import com.alecstrong.sql.psi.core.psi.SqlCompoundSelectStmt
 import com.alecstrong.sql.psi.core.psi.SqlCreateVirtualTableStmt
 import com.alecstrong.sql.psi.core.psi.SqlExpr
 import com.alecstrong.sql.psi.core.psi.SqlFunctionExpr
 import com.alecstrong.sql.psi.core.psi.SqlInsertStmt
 import com.alecstrong.sql.psi.core.psi.SqlPragmaName
+import com.alecstrong.sql.psi.core.psi.SqlResultColumn
 import com.alecstrong.sql.psi.core.psi.SqlSelectStmt
 import com.alecstrong.sql.psi.core.psi.SqlValuesExpression
 import com.intellij.psi.PsiElement
@@ -269,13 +272,45 @@ data class NamedQuery(
     }
   }
 
-  private fun PsiElement.asAggregateFunction(): SqlFunctionExpr? = (this as? SqlFunctionExpr)?.takeIf { it.functionName.text.lowercase() in AGGREGATE_FUNCTIONS }
+  private fun PsiElement.asAggregateFunction(): AggregateFunction? = when (val expr = resolveAliasedExpression().unwrapAggregateExpression()) {
+    is SqlFunctionExpr -> expr.functionName.text.lowercase()
+      .takeIf { it in AGGREGATE_FUNCTIONS }
+      ?.let { AggregateFunction(it, expr.exprList, canReturnNullForNonNullArguments = false) }
+    is AggregateFunctionExpression -> AggregateFunction(
+      name = expr.functionName.lowercase(),
+      arguments = expr.functionArguments,
+      canReturnNullForNonNullArguments = expr.canReturnNullForNonNullArguments,
+    )
+    else -> null
+  }
+
+  // An aliased result column exposes the alias rather than the expression it names, so look the
+  // expression back up to keep the nullability of an aliased aggregate.
+  private fun PsiElement.resolveAliasedExpression(): PsiElement = if (this is SqlColumnAlias) (parent as? SqlResultColumn)?.expr ?: this else this
+
+  // A dialect can parse an aggregate as its own expression wrapped in other expressions, e.g. Sqlite
+  // 3.44 parses group_concat as SqlOtherExpr(SqliteExtensionExpr(SqliteAggregateFunctionExpr)), so
+  // descend through single child wrappers to find it.
+  private fun PsiElement.unwrapAggregateExpression(): PsiElement {
+    var current = this
+    while (current !is SqlFunctionExpr && current !is AggregateFunctionExpression) {
+      current = current.children.singleOrNull() ?: return this
+    }
+    return current
+  }
+
+  private class AggregateFunction(
+    val name: String,
+    val arguments: List<SqlExpr>,
+    val canReturnNullForNonNullArguments: Boolean,
+  )
 
   // count/total always return a value; max/min/sum/avg/group_concat return NULL when their
   // argument is NULL (e.g. group_concat over a nullable LEFT JOIN column).
-  private fun SqlFunctionExpr.alwaysReturnsNonNull(): Boolean {
-    if (functionName.text.lowercase() in NON_NULLABLE_AGGREGATE_FUNCTIONS) return true
-    return exprList.isNotEmpty() && exprList.none { it.type().javaType.isNullable }
+  private fun AggregateFunction.alwaysReturnsNonNull(): Boolean {
+    if (canReturnNullForNonNullArguments) return false
+    if (name in NON_NULLABLE_AGGREGATE_FUNCTIONS) return true
+    return arguments.isNotEmpty() && arguments.none { it.type().javaType.isNullable }
   }
 
   private fun QueryElement.QueryColumn.type(): IntermediateType {
```

**File**: `sqldelight-compiler/src/test/kotlin/app/cash/sqldelight/core/queries/ExpressionTest.kt` (modified, +263/-1)
```diff
@@ -449,7 +449,7 @@ class ExpressionTest {
     ).inOrder()
   }
 
-  @Test fun `string_agg over a non null column stays nullable with a group`() {
+  @Test fun `string_agg over a non null column is non null with a group`() {
     val file = FixtureCompiler.parseSql(
       """
       |CREATE TABLE test (
@@ -466,13 +466,86 @@ class ExpressionTest {
       dialect = POSTGRESQL.dialect,
     )
 
+    val query = file.namedQueries.first()
+    assertThat(query.resultColumns.map { it.javaType }).containsExactly(
+      INT,
+      String::class.asClassName(),
+    ).inOrder()
+  }
+
+  @Test fun `string_agg with a column separator is non null with a group`() {
+    val file = FixtureCompiler.parseSql(
+      """
+      |CREATE TABLE test (
+      |  id INTEGER NOT NULL,
+      |  name TEXT NOT NULL,
+      |  separator TEXT NOT NULL
+      |);
+      |
+      |someSelect:
+      |SELECT id, string_agg(name, separator)
+      |FROM test
+      |GROUP BY id;
+      """.trimMargin(),
+      tempFolder,
+      dialect = POSTGRESQL.dialect,
+    )
+
+    val query = file.namedQueries.first()
+    assertThat(query.resultColumns.map { it.javaType }).containsExactly(
+      INT,
+      String::class.asClassName(),
+    ).inOrder()
+  }
+
+  @Test fun `string_agg with a filter stays nullable with a group`() {
+    val file = FixtureCompiler.parseSql(
+      """
+      |CREATE TABLE test (
+      |  id INTEGER NOT NULL,
+      |  name TEXT NOT NULL
+      |);
+      |
+      |someSelect:
+      |SELECT id, string_agg(name, ',') FILTER (WHERE id > 1)
+      |FROM test
+      |GROUP BY id;
+      """.trimMargin(),
+      tempFolder,
+      dialect = POSTGRESQL.dialect,
+    )
+
     val query = file.namedQueries.first()
     assertThat(query.resultColumns.map { it.javaType }).containsExactly(
       INT,
       String::class.asClassName().copy(nullable = true),
     ).inOrder()
   }
 
+  @Test fun `array_agg over a non null column is non null with a group`() {
+    val file = FixtureCompiler.parseSql(
+      """
+      |CREATE TABLE test (
+      |  id INTEGER NOT NULL,
+      |  name TEXT NOT NULL
+      |);
+      |
+      |someSelect:
+      |SELECT id, array_agg(name)
+      |FROM test
+      |GROUP BY id;
+      """.trimMargin(),
+      tempFolder,
+      dialect = POSTGRESQL.dialect,
+    )
+
+    val query = file.namedQueries.first()
+    assertThat(query.resultColumns.map { it.javaType.isNullable }).containsExactly(
+      false,
+      false,
+    ).inOrder()
+  }
+
   @Test fun `string_agg over a nullable column stays nullable with a group`() {
     val file = FixtureCompiler.parseSql(
       """
@@ -497,6 +570,195 @@ class ExpressionTest {
     ).inOrder()
   }
 
+  @Test fun `group_concat with an order by is non null with a group`() {
+    val file = FixtureCompiler.parseSql(
+      """
+      |CREATE TABLE test (
+      |  id INTEGER NOT NULL,
+      |  name TEXT NOT NULL
+      |);
+      |
+      |someSelect:
+      |SELECT id,
+      |       group_concat(name, ',' ORDER BY name)
+      |FROM test
+      |GROUP BY id;
+      """.trimMargin(),
+      tempFolder,
+      dialect = TestDialect.SQLITE_3_44.dialect,
+    )
+
+    val query = file.namedQueries.first()
+    assertThat(query.resultColumns.map { it.javaType }).containsExactly(
+      LONG,
+      String::class.asClassName(),
+    ).inOrder()
+  }
+
+  @Test fun `string_agg with an order by is non null with a group`() {
+    val file = FixtureCompiler.parseSql(
+      """
+      |CREATE TABLE test (
+      |  id INTEGER NOT NULL,
+      |  name TEXT NOT NULL
+      |);
+      |
+      |someSelect:
+      |SELECT id,
+      |       string_agg(name, ',' ORDER BY name)
+      |FROM test
+      |GROUP BY id;
+      """.trimMargin(),
+      tempFolder,
+      dialect = TestDialect.SQLITE_3_44.dialect,
+    )
+
+    val query = file.namedQueries.first()
+    assertThat(query.resultColumns.map { it.javaType }).containsExactly(
+      LONG,
+      String::class.asClassName(),
+    ).inOrder()
+  }
+
+  @Test fun `string_agg with a column separator and an order by is non null with a group`() {
+    val file = FixtureCompiler.parseSql(
+      """
+      |CREATE TABLE test (
+      |  id INTEGER NOT NULL,
+      |  name TEXT NOT NULL,
+      |  separator TEXT NOT NULL
+      |);
+      |
+      |someSelect:
+      |SELECT id,
+      |       string_agg(name, separator ORDER BY name)
+      |FROM test
+      |GROUP BY id;
+      """.trimMargin(),
+      tempFolder,
+      dialect = TestDialect.SQLITE_3_44.dialect,
+    )
+
+    val query = file.namedQueries.first()
+    assertThat(query.resultColumns.map { it.javaType }).containsExactly(
+      LONG,
+      String::class.asClassName(),
+    ).inOrder()
+  }
+
+  @Test fun `group_concat with an order by over a nullable column stays nullable with a group`() {
+    val file = FixtureCompiler.parseSql(
+      """
+      |CREATE TABLE test (
+      |  id INTEGER NOT NULL,
+      |  name TEXT
+      |);
+      |
+      
```

---

### Incident Patch 5: `4580923a` (2026-09-05)
**Commit Message**: Fix Postgres string_agg to be nullable (#6340)

* Fix string_agg to be nullable

"string_agg" should return nullable type, as it returns NULL for an empty table even if the argument type is non-null.

Unlike sqlitee group_concat, the expression string_agg parses as a PostgreSqlExtensionExpr rather than a SqlFunctionExpr,  so NamedQuery cannot recognise it as an aggregate and restore non-nullability under a GROUP BY.

Making it nullable atleast prevents null pointers.

* Add AggregateFunctionExpression

An aggregate function which a dialect parses as its own expression rather than as a SqlFunctionExpr

* Update PostgreSql.bnf

Add AggregateExpressionMixin

* Update CHANGELOG.md

* Update CHANGELOG.md

---------

Co-authored-by: Jake Wharton <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 
 ### Fixed
 
-- Nothing yet!
+- [PostgreSQL Dialect] Fix `string_agg` function to be nullable (#6340 by @griffio)
 
 
 ## [2.4.0-rc1] - 2026-09-01
```

**File**: `dialects/postgresql/src/main/kotlin/app/cash/sqldelight/dialects/postgresql/PostgreSqlTypeResolver.kt` (modified, +2/-2)
```diff
@@ -220,7 +220,7 @@ open class PostgreSqlTypeResolver(private val parentResolver: TypeResolver) : Ty
       val typeForAgg = encapsulatingTypePreferringKotlin(exprList, SMALL_INT, PostgreSqlType.INTEGER, BIG_INT, REAL, PostgreSqlType.NUMERIC, TEXT, TIMESTAMP_TIMEZONE, TIMESTAMP, DATE).asNullable()
       arrayIntermediateType(typeForAgg)
     }
-    "string_agg" -> IntermediateType(TEXT)
+    "string_agg" -> IntermediateType(TEXT).asNullable()
     "json_array_length", "jsonb_array_length" -> IntermediateType(PostgreSqlType.INTEGER)
     "jsonb_path_exists", "jsonb_path_match", "jsonb_path_exists_tz", "jsonb_path_match_tz" -> IntermediateType(BOOLEAN)
     "currval", "lastval", "nextval", "setval" -> IntermediateType(BIG_INT)
@@ -378,7 +378,7 @@ open class PostgreSqlTypeResolver(private val parentResolver: TypeResolver) : Ty
         arrayIntermediateType(typeForArray)
       }
       stringAggStmt != null -> {
-        IntermediateType(TEXT)
+        IntermediateType(TEXT).asNullable()
       }
       windowFunctionExpr != null -> {
         val windowFunctionExpr = windowFunctionExpr as WindowFunctionMixin
```

**File**: `dialects/postgresql/src/main/kotlin/app/cash/sqldelight/dialects/postgresql/grammar/PostgreSql.bnf` (modified, +8/-3)
```diff
@@ -828,13 +828,17 @@ json_function_stmt ::= ( 'row_to_json' | 'to_json' | 'to_jsonb' ) LP ( {table_al
 
 json_agg_stmt ::= ( 'json_agg' | 'jsonb_agg' | 'json_agg_strict' | 'jsonb_agg_strict')
 LP [ ALL | DISTINCT ] ( json_expression | {table_alias} | {table_name} | <<expr '-1'>> ) [ ORDER BY {ordering_term} ( COMMA {ordering_term} ) * ] RP
-[ 'FILTER' LP WHERE <<expr '-1'>> [ double_colon_cast_operator ] RP ]
+[ 'FILTER' LP WHERE <<expr '-1'>> [ double_colon_cast_operator ] RP ] {
+ mixin = "app.cash.sqldelight.dialects.postgresql.grammar.mixins.AggregateExpressionMixin"
+}
 
 json_object_agg_stmt ::= ('json_object_agg' | 'jsonb_object_agg' | 'json_object_agg_strict' | 'jsonb_object_agg_strict'
-| 'json_object_agg_unique' | 'jsonb_object_agg_unique' | 'json_object_agg_unique_strict' | 'jsonb_object_agg_unique_strict' ) {
+| 'json_object_agg_unique' | 'jsonb_object_agg_unique' | 'json_object_agg_unique_strict' | 'jsonb_object_agg_unique_strict' )
 LP [ ALL | DISTINCT ] ( json_expression | {column_expr} | <<expr '-1'>> ) COMMA ( json_expression | {column_expr} | <<expr '-1'>> )
 [ ORDER BY {ordering_term} ( COMMA {ordering_term} ) * ] RP
-[ 'FILTER' LP WHERE <<expr '-1'>> [ double_colon_cast_operator ] RP ]
+[ 'FILTER' LP WHERE <<expr '-1'>> [ double_colon_cast_operator ] RP ] {
+ mixin = "app.cash.sqldelight.dialects.postgresql.grammar.mixins.AggregateExpressionMixin"
+}
 
 geometry_point_function_stmt ::= ( ( 'ST_POINTZM' | 'ST_POINTZ' | 'ST_POINTM' | 'ST_POINT' ) LP ( {bind_expr} | {signed_number} ) ( COMMA ( {bind_expr} | {signed_number} ) ) * [ COMMA {signed_number} ] RP ) |
 ( ( 'ST_MAKEPOINTM' | 'ST_MAKEPOINT' ) LP ( {bind_expr} | {signed_number} ) ( COMMA ( {bind_expr} | {signed_number} ) ) * RP ) {
@@ -847,6 +851,7 @@ geometry_setsrid_function_stmt ::= 'ST_SetSRID' LP geometry_point_function_stmt
 
 string_agg_stmt ::= 'string_agg' LP [ ALL | DISTINCT ] <<expr '-1'>> COMMA string_literal [ ORDER BY {ordering_term} ( COMMA {ordering_term} ) * ] RP
 [ 'FILTER' LP WHERE <<expr '-1'>> RP ] {
+ mixin = "app.cash.sqldelight.dialects.postgresql.grammar.mixins.AggregateExpressionMixin"
 }
 
 array_agg_stmt ::= 'array_agg' LP [ ALL | DISTINCT ] <<expr '-1'>> [ ORDER BY {ordering_term} ( COMMA {ordering_term} ) * ] RP
```

**File**: `dialects/postgresql/src/main/kotlin/app/cash/sqldelight/dialects/postgresql/grammar/mixins/AggregateExpressionMixin.kt` (modified, +8/-3)
```diff
@@ -1,13 +1,18 @@
 package app.cash.sqldelight.dialects.postgresql.grammar.mixins
 
-import app.cash.sqldelight.dialects.postgresql.grammar.psi.PostgreSqlArrayAggStmt
+import app.cash.sqldelight.dialect.api.AggregateFunctionExpression
 import com.alecstrong.sql.psi.core.psi.SqlCompositeElementImpl
 import com.alecstrong.sql.psi.core.psi.SqlExpr
 import com.intellij.lang.ASTNode
 
+/**
+ * The aggregates `array_agg`, `string_agg`, `json_agg` and `json_object_agg` are parsed as their own
+ * expressions instead of a SqlFunctionExpr, this exposes them as an AggregateFunctionExpression for
+ * the compiler.
+ */
 internal abstract class AggregateExpressionMixin(
   node: ASTNode,
 ) : SqlCompositeElementImpl(node),
-  PostgreSqlArrayAggStmt {
-  val expr get() = children.filterIsInstance<SqlExpr>().first()
+  AggregateFunctionExpression {
+  val expr: SqlExpr get() = functionArguments.first()
 }
```

**File**: `sqldelight-compiler/dialect/src/main/kotlin/app/cash/sqldelight/dialect/api/AggregateFunctionExpression.kt` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+package app.cash.sqldelight.dialect.api
+
+import com.alecstrong.sql.psi.core.psi.SqlAnnotatedElement
+import com.alecstrong.sql.psi.core.psi.SqlExpr
+
+/**
+ * An aggregate function which a dialect parses as its own expression rather than as a SqlFunctionExpr,
+ * for example Sqlite 3.44 `group_concat(name, ',' ORDER BY name)` or PostgreSql `string_agg(name, ',') ORDER BY name`.
+ *
+ * Implementing AggregateFunctionExpression treats the expression as an aggregate when working out the
+ * nullability of a query's columns.
+ *
+ * The defaults assume the grammar of `name ( arguments ) [ FILTER ( WHERE condition ) ]`.
+ */
+interface AggregateFunctionExpression : SqlAnnotatedElement {
+  val functionName: String get() = node.firstChildNode.text
+
+  /** The expressions being aggregated, whose nullability the result of the aggregate follows. */
+  val functionArguments: List<SqlExpr>
+    get() {
+      val filterClause = filterClauseOffset() ?: Int.MAX_VALUE
+      return children.filterIsInstance<SqlExpr>().filter { it.node.startOffset < filterClause }
+    }
+
+  /**
+   * True if the aggregate can return NULL for a group of non null functionArguments, for example
+   * because a FILTER clause can exclude every row of a group.
+   */
+  val canReturnNullForNonNullArguments: Boolean get() = filterClauseOffset() != null
+}
+
+private fun AggregateFunctionExpression.filterClauseOffset(): Int? = node.getChildren(null)
+  .firstOrNull { it.text.equals("FILTER", ignoreCase = true) }
+  ?.startOffset
```

**File**: `sqldelight-compiler/src/test/kotlin/app/cash/sqldelight/core/queries/ExpressionTest.kt` (modified, +70/-0)
```diff
@@ -427,6 +427,76 @@ class ExpressionTest {
     ).inOrder()
   }
 
+  @Test fun `string_agg over a non null column is nullable without a group`() {
+    val file = FixtureCompiler.parseSql(
+      """
+      |CREATE TABLE test (
+      |  name TEXT NOT NULL
+      |);
+      |
+      |someSelect:
+      |SELECT string_agg(name, ','), string_agg(DISTINCT name, ',' ORDER BY name)
+      |FROM test;
+      """.trimMargin(),
+      tempFolder,
+      dialect = POSTGRESQL.dialect,
+    )
+
+    val query = file.namedQueries.first()
+    assertThat(query.resultColumns.map { it.javaType }).containsExactly(
+      String::class.asClassName().copy(nullable = true),
+      String::class.asClassName().copy(nullable = true),
+    ).inOrder()
+  }
+
+  @Test fun `string_agg over a non null column stays nullable with a group`() {
+    val file = FixtureCompiler.parseSql(
+      """
+      |CREATE TABLE test (
+      |  id INTEGER NOT NULL,
+      |  name TEXT NOT NULL
+      |);
+      |
+      |someSelect:
+      |SELECT id, string_agg(name, ',')
+      |FROM test
+      |GROUP BY id;
+      """.trimMargin(),
+      tempFolder,
+      dialect = POSTGRESQL.dialect,
+    )
+
+    val query = file.namedQueries.first()
+    assertThat(query.resultColumns.map { it.javaType }).containsExactly(
+      INT,
+      String::class.asClassName().copy(nullable = true),
+    ).inOrder()
+  }
+
+  @Test fun `string_agg over a nullable column stays nullable with a group`() {
+    val file = FixtureCompiler.parseSql(
+      """
+      |CREATE TABLE test (
+      |  id INTEGER,
+      |  name TEXT
+      |);
+      |
+      |someSelect:
+      |SELECT id, string_agg(name, ',')
+      |FROM test
+      |GROUP BY id;
+      """.trimMargin(),
+      tempFolder,
+      dialect = POSTGRESQL.dialect,
+    )
+
+    val query = file.namedQueries.first()
+    assertThat(query.resultColumns.map { it.javaType }).containsExactly(
+      INT.copy(nullable = true),
+      String::class.asClassName().copy(nullable = true),
+    ).inOrder()
+  }
+
   @Test fun `instr function returns nullable int if any of the args are null`() {
     val file = FixtureCompiler.parseSql(
       """
```

---

### Incident Patch 6: `feeb18b7` (2026-08-20)
**Commit Message**: New Bugsnag key (#6327)

**File**: `.github/workflows/Release.yml` (modified, +1/-0)
```diff
@@ -70,6 +70,7 @@ jobs:
 
       - name: Publish the plugin artifacts
         env:
+          ORG_GRADLE_PROJECT_SQLDELIGHT_BUGSNAG_KEY: ${{ secrets.BUGSNAG_KEY }}
           ORG_GRADLE_PROJECT_intellijPublishToken: ${{ secrets.JETBRAINS_MARKETPLACE_TOKEN }}
         run: ./gradlew publishPlugin --no-parallel
 
```

---

### Incident Patch 7: `d5204e05` (2026-06-30)
**Commit Message**: Fix missing type adapter arguments using bind (#6292)

* Update TypeResolver.kt

Preserve the custom Kotlin type (and its column adapter) of the non-argumen expressions so e.g. COALESCE(:arg, customColumn) keeps the custom type rather than falling back to the bare dialect type. Only do so when those expressions carry a custom type and agree on it, otherwise the choice would be ambiguous.

* Update MutatorQueryFunctionTest.kt

The bind argument inside COALESCE must use the column's custom type instead of taking the implicit dialect type.

* Update CHANGELOG.md

Co-authored-by: Jake Wharton <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@
 - [Gradle Plugin] Fix IDE sync crash when the plugin is applied without configuring any databases (#6088)
 - [PostgreSQL Dialect] Fix json aggregate functions when using nested function call (#6281 by @griffio)
 - [Paging3 Extension] Fix KeyedQueryPagingSource crash on empty database (#6284 by @woods-marshes)
+- [Compiler] Fix Java type adapter issue when mutator statements are used with encapsulating functions like `COALESCE` (#6292 by @griffio)
 
 ## [2.3.2] - 2026-03-16
 [2.3.2]: https://github.com/sqldelight/sqldelight/releases/tag/2.3.2
```

**File**: `sqldelight-compiler/dialect/src/main/kotlin/app/cash/sqldelight/dialect/api/TypeResolver.kt` (modified, +10/-1)
```diff
@@ -74,7 +74,16 @@ fun TypeResolver.encapsulatingType(
     }
     val otherFunctionParameters = sqlTypes.distinct() - PrimitiveType.ARGUMENT
     if (otherFunctionParameters.size == 1) {
-      return IntermediateType(otherFunctionParameters.single())
+      val nonArgumentTypes = types.filter { it.dialectType != PrimitiveType.ARGUMENT }
+      val first = nonArgumentTypes.first()
+      val customType = first.javaType.copy(nullable = false)
+      val hasCustomType = customType != first.dialectType.javaType.copy(nullable = false)
+      val homogeneous = nonArgumentTypes.all { it.javaType.copy(nullable = false) == customType }
+      return if (hasCustomType && homogeneous) {
+        first.asNonNullable()
+      } else {
+        IntermediateType(otherFunctionParameters.single())
+      }
     }
     throw AnnotationException("The Kotlin type of the argument cannot be inferred, use CAST instead.", exprList.first())
   }
```

**File**: `sqldelight-compiler/src/test/kotlin/app/cash/sqldelight/core/queries/MutatorQueryFunctionTest.kt` (modified, +27/-0)
```diff
@@ -482,6 +482,33 @@ class MutatorQueryFunctionTest {
     )
   }
 
+  @Test fun `coalesce in update uses custom type for bind argument`(dialect: TestDialect) {
+    val file = FixtureCompiler.parseSql(
+      """
+      |CREATE TABLE data (
+      |  id INTEGER PRIMARY KEY,
+      |  value ${dialect.textType} AS kotlin.collections.List
+      |);
+      |
+      |updateData:
+      |UPDATE data
+      |SET value = COALESCE(:newValue, value)
+      |WHERE id = :id;
+      """.trimMargin(),
+      tempFolder,
+      dialect = dialect.dialect,
+    )
+
+    val update = file.namedMutators.first()
+    val generator = MutatorQueryGenerator(update)
+
+    val function = generator.function().toString()
+    assertThat(function).contains("public fun updateData(newValue: kotlin.collections.List?,")
+    assertThat(function).contains(
+      "bindString(parameterIndex++, newValue?.let { data_Adapter.value_Adapter.encode(it) })",
+    )
+  }
+
   @Test fun `bind parameter inside inner select gets proper type`() {
     val file = FixtureCompiler.parseSql(
       """
```

---

### Incident Patch 8: `fc1fa804` (2026-06-21)
**Commit Message**: docs: fix JavaScript spelling and clarify srcDirs default (#6287)

Align README platform list with docs site naming and improve the
srcDirs default description for multiplatform projects.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ SQLite
 * [Android](https://sqldelight.github.io/sqldelight/android_sqlite)
 * [Native (iOS, macOS, or Windows)](https://sqldelight.github.io/sqldelight/native_sqlite)
 * [JVM](https://sqldelight.github.io/sqldelight/jvm_sqlite)
-* [Javascript](https://sqldelight.github.io/sqldelight/js_sqlite)
+* [JavaScript](https://sqldelight.github.io/sqldelight/js_sqlite)
 * [Multiplatform](https://sqldelight.github.io/sqldelight/multiplatform_sqlite)
 
 [MySQL (JVM)](https://sqldelight.github.io/sqldelight/jvm_mysql/)
```

**File**: `docs/common/gradle.md` (modified, +1/-1)
```diff
@@ -79,7 +79,7 @@ Type: `ConfigurableFileCollection`
 
 A collection of folders that the plugin will look in for your `.sq` and `.sqm` files.
 
-Defaults to `src/[prefix]main/sqldelight` with prefix depending on the applied kotlin plugin eg common for multiplatform.
+Defaults to `src/[prefix]main/sqldelight` with prefix depending on the applied Kotlin plugin, e.g., `common` for multiplatform.
 
 === "Kotlin"
     ```kotlin
```

---

### Incident Patch 9: `ea3439d1` (2026-06-19)
**Commit Message**: fix(paging3): fix KeyedQueryPagingSource crash on empty database (#6284)

* fix(paging3): fix KeyedQueryPagingSource crash on empty database
If the database is initially empty, KeyedQueryPagingSource now returns an empty page while successfully registering the boundary query as currentQuery to observe future table updates.
Also fixed the empty listener implementation in BaseKeyedQueryPagingSourceTest to correctly register and notify table updates during unit tests, and added two test cases to cover the empty database load and invalidation scenarios.

* style: fix spotless formatting in test imports

* docs: add CHANGELOG entry for #6284

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@
 - [Gradle Plugin] Fix build cache miss for generateDatabaseInterface when the list of AGP variants differ between builds
 - [Gradle Plugin] Fix IDE sync crash when the plugin is applied without configuring any databases (#6088)
 - [PostgreSQL Dialect] Fix json aggregate functions when using nested function call (#6281 by @griffio)
+- [Paging3 Extension] Fix KeyedQueryPagingSource crash on empty database (#6284 by @woods-marshes)
 
 ## [2.3.2] - 2026-03-16
 [2.3.2]: https://github.com/sqldelight/sqldelight/releases/tag/2.3.2
```

**File**: `extensions/androidx-paging3/src/commonMain/kotlin/app/cash/sqldelight/paging3/KeyedQueryPagingSource.kt` (modified, +24/-13)
```diff
@@ -53,22 +53,33 @@ internal class KeyedQueryPagingSource<Key : Any, RowType : Any>(
               .executeAsList()
               .also { pageBoundaries = it }
 
-          val key = params.key ?: boundaries.first()
+          if (boundaries.isEmpty()) {
+            @Suppress("UNCHECKED_CAST")
+            currentQuery = pageBoundariesProvider(params.key, params.loadSize.toLong()) as Query<RowType>
 
-          require(key in boundaries)
+            LoadResult.Page(
+              data = emptyList(),
+              prevKey = null,
+              nextKey = null,
+            )
+          } else {
+            val key = params.key ?: boundaries.first()
 
-          val keyIndex = boundaries.indexOf(key)
-          val previousKey = boundaries.getOrNull(keyIndex - 1)
-          val nextKey = boundaries.getOrNull(keyIndex + 1)
-          val results = queryProvider(key, nextKey)
-            .also { currentQuery = it }
-            .executeAsList()
+            require(key in boundaries)
 
-          LoadResult.Page(
-            data = results,
-            prevKey = previousKey,
-            nextKey = nextKey,
-          )
+            val keyIndex = boundaries.indexOf(key)
+            val previousKey = boundaries.getOrNull(keyIndex - 1)
+            val nextKey = boundaries.getOrNull(keyIndex + 1)
+            val results = queryProvider(key, nextKey)
+              .also { currentQuery = it }
+              .executeAsList()
+
+            LoadResult.Page(
+              data = results,
+              prevKey = previousKey,
+              nextKey = nextKey,
+            )
+          }
         }
         when (transacter) {
           is Transacter -> transacter.transactionWithResult(bodyWithReturn = getPagingSourceLoadResult)
```

**File**: `extensions/androidx-paging3/src/commonTest/kotlin/app/cash/sqldelight/paging3/KeyedQueryPagingSourceTest.kt` (modified, +33/-4)
```diff
@@ -28,7 +28,10 @@ import app.cash.sqldelight.db.SqlDriver
 import kotlin.coroutines.EmptyCoroutineContext
 import kotlin.test.Test
 import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertIs
 import kotlin.test.assertNull
+import kotlin.test.assertTrue
 import kotlinx.coroutines.ExperimentalCoroutinesApi
 
 @ExperimentalCoroutinesApi
@@ -142,6 +145,26 @@ abstract class BaseKeyedQueryPagingSourceTest : DbTest {
     assertEquals(6L, refreshKey)
   }
 
+  @Test fun empty_database_initial_load_returns_empty_page() = runDbTest {
+    clearTable()
+    val results = source.load(PagingSource.LoadParams.Refresh(key = null, loadSize = 2, false))
+
+    assertIs<PagingSource.LoadResult.Page<Long, Long>>(results)
+    assertTrue(results.data.isEmpty())
+    assertNull(results.prevKey)
+    assertNull(results.nextKey)
+  }
+
+  @Test fun empty_database_load_registers_observer_and_invalidates_on_insert() = runDbTest {
+    clearTable()
+    val results = source.load(PagingSource.LoadParams.Refresh(key = null, loadSize = 2, false))
+
+    assertIs<PagingSource.LoadResult.Page<Long, Long>>(results)
+    assertFalse(source.invalid)
+    insert(0L)
+    assertTrue(source.invalid)
+  }
+
   private fun pageBoundaries(anchor: Long?, limit: Long): Query<Long> {
     val sql = """
       |SELECT value
@@ -165,8 +188,8 @@ abstract class BaseKeyedQueryPagingSourceTest : DbTest {
         bindLong(1, anchor)
       }
 
-      override fun addListener(listener: Listener) = Unit
-      override fun removeListener(listener: Listener) = Unit
+      override fun addListener(listener: Listener) = driver.addListener("testTable", listener = listener)
+      override fun removeListener(listener: Listener) = driver.removeListener("testTable", listener = listener)
     }
   }
 
@@ -185,14 +208,20 @@ abstract class BaseKeyedQueryPagingSourceTest : DbTest {
         bindLong(1, endExclusive)
       }
 
-      override fun addListener(listener: Listener) = Unit
-      override fun removeListener(listener: Listener) = Unit
+      override fun addListener(listener: Listener) = driver.addListener("testTable", listener = listener)
+      override fun removeListener(listener: Listener) = driver.removeListener("testTable", listener = listener)
     }
   }
 
   private fun insert(value: Long, db: SqlDriver = driver) {
     db.execute(0, "INSERT INTO testTable (value) VALUES (?)", 1) {
       bindLong(0, value)
     }
+    db.notifyListeners("testTable")
+  }
+
+  private fun clearTable() {
+    driver.execute(null, "DELETE FROM testTable", 0)
+    driver.notifyListeners("testTable")
   }
 }
```

---

### Incident Patch 10: `db76b1fd` (2026-06-18)
**Commit Message**: Fix Postgresql dialect json agg stmt grammar (#6281)

Remove pin = 2 on the json_agg_stmt grammar rule that prevented matching on nested function expressions:
SELECT jsonb_agg(jsonb_build_object('id', 1));

add fixture tests for grammar
fix type mapping to json on json_build_object | jsonb_build_object - variadic bind args must be cast

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@
 - [Gradle Plugin] Use AGP's variant resolution for project dependencies (#6217 by @maxsav)
 - [Gradle Plugin] Fix build cache miss for generateDatabaseInterface when the list of AGP variants differ between builds
 - [Gradle Plugin] Fix IDE sync crash when the plugin is applied without configuring any databases (#6088)
+- [PostgreSQL Dialect] Fix json aggregate functions when using nested function call (#6281 by @griffio)
 
 ## [2.3.2] - 2026-03-16
 [2.3.2]: https://github.com/sqldelight/sqldelight/releases/tag/2.3.2
```

**File**: `dialects/postgresql/src/main/kotlin/app/cash/sqldelight/dialects/postgresql/PostgreSqlTypeResolver.kt` (modified, +1/-2)
```diff
@@ -215,8 +215,7 @@ open class PostgreSqlTypeResolver(private val parentResolver: TypeResolver) : Ty
     "json_object_agg", "jsonb_object_agg", "json_object_agg_strict", "jsonb_object_agg_strict",
     "json_object_agg_unique", "jsonb_object_agg_unique", "json_object_agg_unique_strict", "jsonb_object_agg_unique_strict",
     -> IntermediateType(PostgreSqlType.JSON)
-    "json_build_object", "jsonb_build_object",
-    -> IntermediateType(TEXT)
+    "json_build_object", "jsonb_build_object" -> IntermediateType(PostgreSqlType.JSON)
     "array_agg" -> {
       val typeForAgg = encapsulatingTypePreferringKotlin(exprList, SMALL_INT, PostgreSqlType.INTEGER, BIG_INT, REAL, PostgreSqlType.NUMERIC, TEXT, TIMESTAMP_TIMEZONE, TIMESTAMP, DATE).asNullable()
       arrayIntermediateType(typeForAgg)
```

**File**: `dialects/postgresql/src/main/kotlin/app/cash/sqldelight/dialects/postgresql/grammar/PostgreSql.bnf` (modified, +2/-6)
```diff
@@ -828,17 +828,13 @@ json_function_stmt ::= ( 'row_to_json' | 'to_json' | 'to_jsonb' ) LP ( {table_al
 
 json_agg_stmt ::= ( 'json_agg' | 'jsonb_agg' | 'json_agg_strict' | 'jsonb_agg_strict')
 LP [ ALL | DISTINCT ] ( json_expression | {table_alias} | {table_name} | <<expr '-1'>> ) [ ORDER BY {ordering_term} ( COMMA {ordering_term} ) * ] RP
-[ 'FILTER' LP WHERE <<expr '-1'>> [ double_colon_cast_operator ] RP ] {
-pin = 2
-}
+[ 'FILTER' LP WHERE <<expr '-1'>> [ double_colon_cast_operator ] RP ]
 
 json_object_agg_stmt ::= ('json_object_agg' | 'jsonb_object_agg' | 'json_object_agg_strict' | 'jsonb_object_agg_strict'
 | 'json_object_agg_unique' | 'jsonb_object_agg_unique' | 'json_object_agg_unique_strict' | 'jsonb_object_agg_unique_strict' ) {
 LP [ ALL | DISTINCT ] ( json_expression | {column_expr} | <<expr '-1'>> ) COMMA ( json_expression | {column_expr} | <<expr '-1'>> )
 [ ORDER BY {ordering_term} ( COMMA {ordering_term} ) * ] RP
-[ 'FILTER' LP WHERE <<expr '-1'>> [ double_colon_cast_operator ] RP ] {
-pin = 2
-}
+[ 'FILTER' LP WHERE <<expr '-1'>> [ double_colon_cast_operator ] RP ]
 
 geometry_point_function_stmt ::= ( ( 'ST_POINTZM' | 'ST_POINTZ' | 'ST_POINTM' | 'ST_POINT' ) LP ( {bind_expr} | {signed_number} ) ( COMMA ( {bind_expr} | {signed_number} ) ) * [ COMMA {signed_number} ] RP ) |
 ( ( 'ST_MAKEPOINTM' | 'ST_MAKEPOINT' ) LP ( {bind_expr} | {signed_number} ) ( COMMA ( {bind_expr} | {signed_number} ) ) * RP ) {
```

**File**: `dialects/postgresql/src/testFixtures/resources/fixtures_postgresql/json_functions/Test.s` (modified, +7/-0)
```diff
@@ -82,3 +82,10 @@ FROM myTable;
 
 SELECT jsonb_object_agg_strict(t, datab ORDER BY t DESC)
 FROM myTable;
+
+SELECT jsonb_agg(jsonb_build_object('id', 1));
+
+SELECT jsonb_agg(t)
+FROM ( SELECT 1 AS id) AS t;
+
+SELECT json_build_object('foo', 1, 2, row(3,'bar'));
```

**File**: `sqldelight-gradle-plugin/src/test/integration-postgresql/src/main/sqldelight/app/cash/sqldelight/postgresql/integration/Json.sq` (modified, +2/-2)
```diff
@@ -20,8 +20,8 @@ CREATE TABLE TestJsonCheck(
 
 insert:
 INSERT INTO TestJson(data, datab) VALUES(
-  json_build_object(:key, :value),
-  jsonb_build_object('key', 'value')
+  json_build_object(:key::TEXT, :value::TEXT),
+  jsonb_build_object('key'::TEXT, 'value'::TEXT)
 );
 
 setJsonb:
```

---

### Incident Patch 11: `94618ca7` (2026-06-17)
**Commit Message**: Fix tooling model crash when plugin applied without databases (#6275)

databases.first() threw NoSuchElementException during IDE sync for
modules that apply the plugin but configure no databases.

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@
 - [Compiler] Use nullable bind argument with null safe operators(IS and IS DISTINCT FROM) (#6265 by @griffio)
 - [Gradle Plugin] Use AGP's variant resolution for project dependencies (#6217 by @maxsav)
 - [Gradle Plugin] Fix build cache miss for generateDatabaseInterface when the list of AGP variants differ between builds
+- [Gradle Plugin] Fix IDE sync crash when the plugin is applied without configuring any databases (#6088)
 
 ## [2.3.2] - 2026-03-16
 [2.3.2]: https://github.com/sqldelight/sqldelight/releases/tag/2.3.2
```

**File**: `sqldelight-gradle-plugin/src/main/kotlin/app/cash/sqldelight/gradle/SqlDelightPlugin.kt` (modified, +1/-1)
```diff
@@ -162,7 +162,7 @@ abstract class SqlDelightPlugin : Plugin<Project> {
         databases = databases.map { it.getProperties().get() },
         currentVersion = VERSION,
         minimumSupportedVersion = MINIMUM_SUPPORTED_VERSION,
-        dialectJars = databases.first().configuration.files,
+        dialectJars = databases.firstOrNull()?.configuration?.files.orEmpty(),
       )
     }
   }
```

**File**: `sqldelight-gradle-plugin/src/test/kotlin/app/cash/sqldelight/properties/PropertiesFileTest.kt` (modified, +20/-0)
```diff
@@ -95,4 +95,24 @@ class PropertiesFileTest {
       )
     }
   }
+
+  @Test fun `properties model builds when plugin is applied without any databases`() {
+    withTemporaryFixture {
+      gradleFile(
+        """|
+        |plugins {
+        |  alias(libs.plugins.kotlin.multiplatform)
+        |  alias(libs.plugins.sqldelight)
+        |}
+        |
+        |kotlin {
+        |  jvm()
+        |}
+        """.trimMargin(),
+      )
+
+      // Fetching the tooling model must not throw when no databases are configured.
+      assertThat(properties().databases).isEmpty()
+    }
+  }
 }
```

---

### Incident Patch 12: `c3d8c839` (2026-06-16)
**Commit Message**: Fix migration alter column insert adapter nullability (#6269)

INSERT INTO foo VALUES ? doesn't use query columns for current state of nullability.

This is for PostgreSql dialect where altering column nullability is supported ( Sqlite doesn't support this until 3.53).

Fix InsertStmtUtil to use the query columns that values are being provided for, unlike [columns] these retain the
[QueryColumn.nullable] override, which carries nullability changes applied by migrations
(e.g ALTER TABLE ... ALTER COLUMN ... SET NOT NULL) that are not present on the original column definition.

Fix BindableQuery to use the query columns and check if the nullability is overridden.

Adds migration test for PostgreSqlDialect

Note:

It appears that MySql dialect already works because the modify statement uses a complete column_def

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@
 - [Intellij Plugin] Fix deprecations causing crash in IDEA 2026.2 (#6247 by @griffio)
 - [Gradle Plugin] Fix generated sources not being picked up by Kotlin compilation on AGP 8.9 through 8.11
 - [PostgreSQL Dialect] Fix lower and upper functions using Primitive bind argument to default as TEXT (#6262 by @griffio)
+- [Compiler] Fix insert values with data class binding using adapters and migrations changing nullability (#6269 by griffio)
 - [Compiler] Use nullable bind argument with null safe operators(IS and IS DISTINCT FROM) (#6265 by @griffio)
 - [Gradle Plugin] Use AGP's variant resolution for project dependencies (#6217 by @maxsav)
 - [Gradle Plugin] Fix build cache miss for generateDatabaseInterface when the list of AGP variants differ between builds
```

**File**: `sqldelight-compiler/src/main/kotlin/app/cash/sqldelight/core/compiler/model/BindableQuery.kt` (modified, +9/-7)
```diff
@@ -23,8 +23,8 @@ import app.cash.sqldelight.core.lang.psi.StmtIdentifierMixin
 import app.cash.sqldelight.core.lang.types.typeResolver
 import app.cash.sqldelight.core.lang.util.argumentType
 import app.cash.sqldelight.core.lang.util.childOfType
-import app.cash.sqldelight.core.lang.util.columns
 import app.cash.sqldelight.core.lang.util.findChildrenOfType
+import app.cash.sqldelight.core.lang.util.queryColumns
 import app.cash.sqldelight.core.lang.util.sqFile
 import app.cash.sqldelight.core.lang.util.type
 import app.cash.sqldelight.dialect.api.IntermediateType
@@ -75,14 +75,16 @@ abstract class BindableQuery(
    */
   val arguments: List<Argument> by lazy {
     if (statement is SqlInsertStmt && statement.acceptsTableInterface()) {
-      return@lazy statement.columns.mapIndexed { index, column ->
+      return@lazy statement.queryColumns.mapIndexed { index, queryColumn ->
+        val element = queryColumn.element
+        val type = element.type().let {
+          if (queryColumn.nullable != null) it.nullableIf(queryColumn.nullable!!) else it
+        }
         Argument(
           index + 1,
-          column.type().let {
-            it.copy(
-              name = "${allocateName(statement.tableName)}.${it.name}",
-            )
-          },
+          type.copy(
+            name = "${allocateName(statement.tableName)}.${type.name}",
+          ),
         )
       }
     }
```

**File**: `sqldelight-compiler/src/main/kotlin/app/cash/sqldelight/core/lang/util/InsertStmtUtil.kt` (modified, +9/-6)
```diff
@@ -2,21 +2,24 @@ package app.cash.sqldelight.core.lang.util
 
 import com.alecstrong.sql.psi.core.psi.LazyQuery
 import com.alecstrong.sql.psi.core.psi.NamedElement
+import com.alecstrong.sql.psi.core.psi.QueryElement.QueryColumn
 import com.alecstrong.sql.psi.core.psi.SqlInsertStmt
 
-/**
- * The list of columns that values are being provided for.
- */
-internal val SqlInsertStmt.columns: List<NamedElement>
+internal val SqlInsertStmt.queryColumns: List<QueryColumn>
   get() {
     val columns = table.query.columns
       .filterCodegenExcludedColumns { it.element as? NamedElement }
-      .map { (it.element as NamedElement) }
     if (columnNameList.isEmpty()) return columns
 
-    val columnMap = linkedMapOf(*columns.map { it.name to it }.toTypedArray())
+    val columnMap = linkedMapOf(*columns.map { (it.element as NamedElement).name to it }.toTypedArray())
     return columnNameList.mapNotNull { columnMap[it.name] }
   }
 
+/**
+ * The list of columns that values are being provided for.
+ */
+internal val SqlInsertStmt.columns: List<NamedElement>
+  get() = queryColumns.map { it.element as NamedElement }
+
 internal val SqlInsertStmt.table: LazyQuery
   get() = tablesAvailable(this).first { it.tableName.name == tableName.name }
```

**File**: `sqldelight-compiler/src/test/kotlin/app/cash/sqldelight/core/migrations/MigrationQueryTest.kt` (modified, +4/-0)
```diff
@@ -41,6 +41,10 @@ class MigrationQueryTest {
     checkFixtureCompiles("create-or-replace-view", PostgreSqlDialect())
   }
 
+  @Test fun `alter table alter column set not null with adapter`() {
+    checkFixtureCompiles("alter-table-alter-column-adapter", PostgreSqlDialect())
+  }
+
   private fun checkFixtureCompiles(fixtureRoot: String, dialect: SqlDelightDialect = SqliteDialect()) {
     val result = FixtureCompiler.compileFixture(
       overrideDialect = dialect,
```

**File**: `sqldelight-compiler/src/test/migration-interface-fixtures/alter-table-alter-column-adapter/com/example/1.sqm` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+CREATE TABLE test (
+   lastModifiedAt TIMESTAMPTZ AS java.time.Instant
+);
```

**File**: `sqldelight-compiler/src/test/migration-interface-fixtures/alter-table-alter-column-adapter/com/example/2.sqm` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+ALTER TABLE test ALTER COLUMN lastModifiedAt SET NOT NULL;
```

**File**: `sqldelight-compiler/src/test/migration-interface-fixtures/alter-table-alter-column-adapter/com/example/Test.sq` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+insert:
+INSERT INTO test VALUES ?;
```

**File**: `sqldelight-compiler/src/test/migration-interface-fixtures/alter-table-alter-column-adapter/output/com/example/Test.kt` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+@file:Suppress("REDUNDANT_VISIBILITY_MODIFIER", "ASSIGNED_VALUE_IS_NEVER_READ")
+
+package com.example
+
+import app.cash.sqldelight.ColumnAdapter
+import java.time.Instant
+import java.time.OffsetDateTime
+
+public data class Test(
+  public val lastModifiedAt: Instant,
+) {
+  public class Adapter(
+    public val lastModifiedAtAdapter: ColumnAdapter<Instant, OffsetDateTime>,
+  )
+}
```

---

### Incident Patch 13: `364dc089` (2026-06-13)
**Commit Message**: Keep grouped aggregates nullable when their argument is nullable (#6271)

PR #6187 forced every aggregate column in a GROUP BY query to be non-null.
That is only safe for count/total. group_concat/max/min/sum/avg still
return NULL when their argument is NULL (e.g. group_concat over a nullable
LEFT JOIN column), so the generated mapper emitted an unsafe !! and threw
NullPointerException at runtime.

Only force non-null for count/total, or for aggregates whose arguments are
all non-null. Fixes the regression reported in #6211.

**File**: `sqldelight-compiler/src/main/kotlin/app/cash/sqldelight/core/compiler/model/NamedQuery.kt` (modified, +26/-17)
```diff
@@ -239,8 +239,7 @@ data class NamedQuery(
     val selectStmt = this as? SqlSelectStmt
     val hasGroupBy = selectStmt?.groupBy != null
     val hasAggregate = selectStmt?.resultColumnList?.any { resultColumn ->
-      val expr = resultColumn.expr
-      expr is SqlFunctionExpr && expr.functionName.text.lowercase() in AGGREGATE_FUNCTIONS
+      resultColumn.expr?.asAggregateFunction() != null
     } ?: false
 
     return queryExposed().flatMap {
@@ -254,26 +253,31 @@ data class NamedQuery(
             while (!namesUsed.add(name)) name += "_"
           }
 
-          var type = queryColumn.type().copy(name = name)
-
-          if (hasAggregate) {
-            val isAggregate = queryColumn.element is SqlFunctionExpr &&
-              (queryColumn.element as SqlFunctionExpr).functionName.text.lowercase() in AGGREGATE_FUNCTIONS
-
-            // Goup by statements filter out empty groups so we don't have to
-            // worry about non-null columns returning as nullable.
-            if (!hasGroupBy && !isAggregate) {
-              type = type.asNullable()
-            } else if (hasGroupBy && isAggregate) {
-              type = type.asNonNullable()
-            }
+          val type = queryColumn.type().copy(name = name)
+          val aggregate = queryColumn.element.asAggregateFunction()
+
+          return@map when {
+            !hasAggregate -> type
+            // Without a GROUP BY the aggregate collapses every row, so other columns may
+            // read from no row and become nullable.
+            !hasGroupBy && aggregate == null -> type.asNullable()
+            // A grouped aggregate is non-null only when it can never return NULL.
+            hasGroupBy && aggregate != null && aggregate.alwaysReturnsNonNull() -> type.asNonNullable()
+            else -> type
           }
-
-          return@map type
         }
     }
   }
 
+  private fun PsiElement.asAggregateFunction(): SqlFunctionExpr? = (this as? SqlFunctionExpr)?.takeIf { it.functionName.text.lowercase() in AGGREGATE_FUNCTIONS }
+
+  // count/total always return a value; max/min/sum/avg/group_concat return NULL when their
+  // argument is NULL (e.g. group_concat over a nullable LEFT JOIN column).
+  private fun SqlFunctionExpr.alwaysReturnsNonNull(): Boolean {
+    if (functionName.text.lowercase() in NON_NULLABLE_AGGREGATE_FUNCTIONS) return true
+    return exprList.isNotEmpty() && exprList.none { it.type().javaType.isNullable }
+  }
+
   private fun QueryElement.QueryColumn.type(): IntermediateType {
     var rootType = element.type()
     nullable?.let { rootType = rootType.nullableIf(it) }
@@ -306,5 +310,10 @@ data class NamedQuery(
       "total",
       "group_concat",
     )
+
+    private val NON_NULLABLE_AGGREGATE_FUNCTIONS = setOf(
+      "count",
+      "total",
+    )
   }
 }
```

**File**: `sqldelight-compiler/src/test/kotlin/app/cash/sqldelight/core/queries/ExpressionTest.kt` (modified, +50/-0)
```diff
@@ -371,9 +371,59 @@ class ExpressionTest {
     )
 
     val query = file.namedQueries.first()
+    // MAX over a nullable column stays nullable even with a GROUP BY: the group whose key is
+    // NULL contains only NULL values, so MAX(id) returns NULL for it.
     assertThat(query.resultColumns.map { it.javaType }).containsExactly(
       LONG.copy(nullable = true),
+      LONG.copy(nullable = true),
+    ).inOrder()
+  }
+
+  @Test fun `group_concat over a nullable column stays nullable with a group`() {
+    val file = FixtureCompiler.parseSql(
+      """
+      |CREATE TABLE test (
+      |  id INTEGER NOT NULL,
+      |  name TEXT
+      |);
+      |
+      |someSelect:
+      |SELECT id,
+      |       group_concat(name)
+      |FROM test
+      |GROUP BY id;
+      """.trimMargin(),
+      tempFolder,
+    )
+
+    val query = file.namedQueries.first()
+    assertThat(query.resultColumns.map { it.javaType }).containsExactly(
+      LONG,
+      String::class.asClassName().copy(nullable = true),
+    ).inOrder()
+  }
+
+  @Test fun `group_concat over a non null column is non null with a group`() {
+    val file = FixtureCompiler.parseSql(
+      """
+      |CREATE TABLE test (
+      |  id INTEGER NOT NULL,
+      |  name TEXT NOT NULL
+      |);
+      |
+      |someSelect:
+      |SELECT id,
+      |       group_concat(name)
+      |FROM test
+      |GROUP BY id;
+      """.trimMargin(),
+      tempFolder,
+    )
+
+    val query = file.namedQueries.first()
+    assertThat(query.resultColumns.map { it.javaType }).containsExactly(
       LONG,
+      String::class.asClassName(),
     ).inOrder()
   }
 
```

**File**: `sqldelight-compiler/src/test/kotlin/app/cash/sqldelight/core/queries/InterfaceGeneration.kt` (modified, +42/-0)
```diff
@@ -836,6 +836,48 @@ class InterfaceGeneration {
     )
   }
 
+  @Test fun `single argument group_concat of nullable column is nullable with a group`() {
+    val result = FixtureCompiler.compileSql(
+      """
+      |CREATE TABLE place (
+      |  id INTEGER NOT NULL PRIMARY KEY
+      |);
+      |
+      |CREATE TABLE placeTag (
+      |  place INTEGER NOT NULL,
+      |  tag TEXT
+      |);
+      |
+      |placeWithTags:
+      |SELECT place.id, group_concat(placeTag.tag)
+      |FROM place
+      |LEFT JOIN placeTag ON placeTag.place = place.id
+      |GROUP BY place.id;
+      """.trimMargin(),
+      temporaryFolder,
+    )
+
+    assertThat(result.errors).isEmpty()
+    val generatedInterface = result.compilerOutput.get(
+      File(result.outputDirectory, "com/example/PlaceWithTags.kt"),
+    )
+    assertThat(generatedInterface).isNotNull()
+    assertThat(generatedInterface.toString()).isEqualTo(
+      """
+      |package com.example
+      |
+      |import kotlin.Long
+      |import kotlin.String
+      |
+      |public data class PlaceWithTags(
+      |  public val id: Long,
+      |  public val group_concat: String?,
+      |)
+      |
+      """.trimMargin(),
+    )
+  }
+
   @Test fun `cast inherits nullability`() {
     val file = FixtureCompiler.parseSql(
       """
```

---

### Incident Patch 14: `6757042d` (2026-06-12)
**Commit Message**: Fix generateDatabaseInterface cache miss when AGP variants differ (#6203)

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ sqldelight-gradle-plugin/**/gradlew
 sqldelight-gradle-plugin/**/gradlew.bat
 *.iml
 build
+build-cache
 local.properties
 /reports
 gen
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -34,6 +34,7 @@
 - [PostgreSQL Dialect] Fix lower and upper functions using Primitive bind argument to default as TEXT (#6262 by @griffio)
 - [Compiler] Use nullable bind argument with null safe operators(IS and IS DISTINCT FROM) (#6265 by @griffio)
 - [Gradle Plugin] Use AGP's variant resolution for project dependencies (#6217 by @maxsav)
+- [Gradle Plugin] Fix build cache miss for generateDatabaseInterface when the list of AGP variants differ between builds
 
 ## [2.3.2] - 2026-03-16
 [2.3.2]: https://github.com/sqldelight/sqldelight/releases/tag/2.3.2
```

**File**: `sqldelight-gradle-plugin/src/main/kotlin/app/cash/sqldelight/gradle/PropertiesImpl.kt` (modified, +5/-1)
```diff
@@ -19,7 +19,11 @@ data class SqlDelightPropertiesFileImpl(
 
 data class SqlDelightDatabasePropertiesImpl(
   @Input override val packageName: String,
-  @Nested override val compilationUnits: List<SqlDelightCompilationUnitImpl>,
+  // Not a cache input: the task-specific compilationUnit property already captures the relevant
+  // compilation unit. Including all variants here makes the cache key depend on how many AGP
+  // variants are configured at build time (e.g. CI configures all variants; assembleDebug only
+  // configures debug), causing cache misses between environments.
+  @Internal override val compilationUnits: List<SqlDelightCompilationUnitImpl>,
   @Input override val className: String,
   @Nested override val dependencies: List<SqlDelightDatabaseNameImpl>,
   @Input override val deriveSchemaFromMigrations: Boolean = false,
```

**File**: `sqldelight-gradle-plugin/src/test/cache-variant/build.gradle` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+import com.android.build.api.variant.HostTestBuilder
+
+plugins {
+  id("com.android.library").version("8.13.2")
+  alias(libs.plugins.sqldelight)
+  alias(libs.plugins.kotlin.android)
+}
+
+android {
+  namespace = "com.example.sqldelight"
+
+  compileSdk = libs.versions.compileSdk.get() as int
+
+  lint {
+    textReport true
+  }
+}
+
+androidComponents {
+  beforeVariants(selector().withBuildType("release")) {
+    enable = project.properties["debugOnly"] != "true"
+  }
+}
+
+sqldelight {
+  databases {
+    TestDb {
+      packageName = "com.example.sqldelight"
+    }
+  }
+}
```

**File**: `sqldelight-gradle-plugin/src/test/cache-variant/settings.gradle` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+pluginManagement {
+    includeBuild("../build-logic-tests")
+}
+
+plugins {
+    id("sqldelightTests")
+}
+
+rootProject.name = 'cache-variant'
+
+buildCache {
+  local {
+    directory = new File(rootDir, 'build-cache')
+  }
+}
```

**File**: `sqldelight-gradle-plugin/src/test/cache-variant/src/main/AndroidManifest.xml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+<?xml version="1.0" encoding="utf-8"?>
+<manifest />
```

**File**: `sqldelight-gradle-plugin/src/test/cache-variant/src/main/sqldelight/com/example/sqldelight/Test.sq` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+CREATE TABLE test_table (
+  id INTEGER NOT NULL PRIMARY KEY,
+  name TEXT NOT NULL
+);
+
+selectAll:
+SELECT * FROM test_table;
```

**File**: `sqldelight-gradle-plugin/src/test/kotlin/app/cash/sqldelight/integrations/IntegrationTest.kt` (modified, +40/-0)
```diff
@@ -217,6 +217,46 @@ class IntegrationTest {
     assertThat(result.output).contains("BUILD SUCCESSFUL")
   }
 
+  /**
+   * When the release variant is disabled (e.g. via debugOnly=true), the number of compilation units
+   * in SqlDelightDatabasePropertiesImpl.compilationUnits changes. The debug generate task should
+   * still get a cache hit because compilationUnits is @Internal. The task-level compilationUnit
+   * property already captures the relevant unit.
+   */
+  @Test fun `sqldelight output is cacheable when AGP variants change`() {
+    val fixtureRoot = File("src/test/cache-variant")
+    fixtureRoot.resolve("build").deleteRecursively()
+    fixtureRoot.resolve("build-cache").deleteRecursively()
+
+    val gradleRunner = GradleRunner.create()
+      .withCommonConfiguration(fixtureRoot)
+
+    // First run: both debug and release configured, populates the cache for debug.
+    val firstRun = gradleRunner
+      .withArguments("generateDebugTestDbInterface", "--build-cache", "--stacktrace")
+      .build()
+
+    with(firstRun.task(":generateDebugTestDbInterface")) {
+      assertThat(this).isNotNull()
+      assertThat(this!!.outcome).isNotEqualTo(TaskOutcome.FROM_CACHE)
+    }
+
+    fixtureRoot.resolve("build").deleteRecursively()
+
+    // Second run: release variant disabled but the debug unit is unchanged so we expect a cache hit.
+    val secondRun = gradleRunner
+      .withArguments("generateDebugTestDbInterface", "--build-cache", "-PdebugOnly=true", "--stacktrace")
+      .build()
+
+    with(secondRun.task(":generateDebugTestDbInterface")) {
+      assertThat(this).isNotNull()
+      assertThat(this!!.outcome).isEqualTo(TaskOutcome.FROM_CACHE)
+    }
+
+    fixtureRoot.resolve("build").deleteRecursively()
+    fixtureRoot.resolve("build-cache").deleteRecursively()
+  }
+
   @Test fun `deriveSchemaFromMigrations creates a db without queries`() {
     val runner = GradleRunner.create()
       .withCommonConfiguration(File("src/test/derive-schema-no-queries"))
```

---

### Incident Patch 15: `a49b3eae` (2026-06-05)
**Commit Message**: Allow using nullable bind argument with null safe operators (#6265)

Allow nullable bind arg for null safe operators.

IS [NOT] ? (SQLite)
IS [NOT] DISTINCT FROM ? (Postgres, SQLite 3.39)

This makes sense as these would only be used with a nullable argument.
Currently, the bind arg is only nullable if the column is nullable.

To support expressions like ORDER BY (whatever IS ?) allows sorting to be dynamic with null for no order or sort with a value, even if whatever is a NOT NULL column.

This fix uses the same type resolution as a SqlBinaryEqualityExpr but is always nullable.

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@
 - [Intellij Plugin] Fix deprecations causing crash in IDEA 2026.2 (#6247 by @griffio)
 - [Gradle Plugin] Fix generated sources not being picked up by Kotlin compilation on AGP 8.9 through 8.11
 - [PostgreSQL Dialect] Fix lower and upper functions using Primitive bind argument to default as TEXT (#6262 by @griffio)
+- [Compiler] Use nullable bind argument with null safe operators(IS and IS DISTINCT FROM) (#6265 by @griffio)
 
 ## [2.3.2] - 2026-03-16
 [2.3.2]: https://github.com/sqldelight/sqldelight/releases/tag/2.3.2
```

**File**: `sqldelight-compiler/src/main/kotlin/app/cash/sqldelight/core/lang/util/Arguments.kt` (modified, +7/-1)
```diff
@@ -41,6 +41,7 @@ import com.alecstrong.sql.psi.core.psi.SqlFunctionExpr
 import com.alecstrong.sql.psi.core.psi.SqlInExpr
 import com.alecstrong.sql.psi.core.psi.SqlInsertStmt
 import com.alecstrong.sql.psi.core.psi.SqlInsertStmtValues
+import com.alecstrong.sql.psi.core.psi.SqlIsDistinctFromExpr
 import com.alecstrong.sql.psi.core.psi.SqlIsExpr
 import com.alecstrong.sql.psi.core.psi.SqlLikeEscapeCharacterExpr
 import com.alecstrong.sql.psi.core.psi.SqlLimitingTerm
@@ -125,7 +126,12 @@ internal fun SqlExpr.argumentType(argument: SqlExpr): IntermediateType {
       }
     }
 
-    is SqlBinaryPipeExpr, is SqlBinaryEqualityExpr, is SqlIsExpr, is SqlBinaryBooleanExpr -> {
+    is SqlIsExpr, is SqlIsDistinctFromExpr -> {
+      val validArg = children.lastOrNull { it is SqlExpr && it !== argument && it !is SqlBindExpr }
+      (validArg?.type() ?: children.last { it is SqlExpr && it !== argument }.type()).asNullable()
+    }
+
+    is SqlBinaryPipeExpr, is SqlBinaryEqualityExpr, is SqlBinaryBooleanExpr -> {
       val validArg = children.lastOrNull { it is SqlExpr && it !== argument && it !is SqlBindExpr }
       validArg?.type() ?: children.last { it is SqlExpr && it !== argument }.type()
     }
```

**File**: `sqldelight-compiler/src/test/kotlin/app/cash/sqldelight/core/queries/IsDistinctFromTest.kt` (modified, +2/-2)
```diff
@@ -33,7 +33,7 @@ class IsDistinctFromTest {
     assertThat(generator.querySubtype().toString()).isEqualTo(
       """
         |private inner class SelectOthersQuery<out T : kotlin.Any>(
-        |  public val id: kotlin.Long,
+        |  public val id: kotlin.Long?,
         |  mapper: (app.cash.sqldelight.db.SqlCursor) -> T,
         |) : app.cash.sqldelight.Query<T>(mapper) {
         |  override fun addListener(listener: app.cash.sqldelight.Query.Listener) {
@@ -77,7 +77,7 @@ class IsDistinctFromTest {
     assertThat(generator.querySubtype().toString()).isEqualTo(
       """
         |private inner class SelectItQuery<out T : kotlin.Any>(
-        |  public val id: kotlin.Long,
+        |  public val id: kotlin.Long?,
         |  mapper: (app.cash.sqldelight.db.SqlCursor) -> T,
         |) : app.cash.sqldelight.Query<T>(mapper) {
         |  override fun addListener(listener: app.cash.sqldelight.Query.Listener) {
```

#### Recent Merged Pull Requests:
- **PR #6380** (2026-10-03): Update plugin spotless to v8.10.3 (@renovate[bot])
- **PR #6379** (2026-10-03): Update Gradle to v9.8.0 (@renovate[bot])
- **PR #6378** (closed): Make Android Driver queries transactional to prevent torn results (@tcmulcahy)
- **PR #6376** (2026-09-29): Prefer Marketplace error reporting over custom solution (@JakeWharton)
- **PR #6375** (2026-09-29): Update dependency org.postgresql:r2dbc-postgresql to v1.1.3.RELEASE (@renovate[bot])
- **PR #6374** (2026-09-29): Keep query files in-memory for the duration of a task (@C2H6O)
- **PR #6373** (2026-09-29): Remove return value from migrateInternal when generateAsync is disabled (@kevinguitar)
- **PR #6370** (2026-09-25): Update dependency com.google.testparameterinjector:test-parameter-injector to v1.23 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
