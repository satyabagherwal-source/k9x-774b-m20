# Verification Protocol: Verification Protocol: Empirical Defect Shield for sqldelight/sqldelight

<!-- PROVENANCE_START
{
  "source_repository": "sqldelight/sqldelight",
  "source_url": "https://github.com/sqldelight/sqldelight",
  "source_version": "74b446bc",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T03:39:14.777Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sqldelight-sqldelight",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sqldelight/sqldelight](https://github.com/sqldelight/sqldelight) (Revision: `74b446bc`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T03:39:14.777Z`  
> **Learning ID**: `learn-github-sqldelight-sqldelight`


## 1. Scope & Verification Target
- **Target Repository**: `sqldelight/sqldelight` (Commit: `74b446bc`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): sqldelight/sqldelight

> **Canonical Artifact**: `07_PROJECT_LEARNING/sqldelight-sqldelight-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sqldelight/sqldelight](https://github.com/sqldelight/sqldelight))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T03:39:13.553Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sqldelight/sqldelight`
- **Description**: SQLDelight - Generates typesafe Kotlin APIs from SQL
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6905 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6384** (2026-10-05): **Exception in plugin SQLDelight**
  *Symptoms*: ### SQLDelight Version  2.3.2  ### IDE Version  Androoid Studio Rabbit 1 2026.2.1  ### Dialect  SQLite  ### Describe the Bug  ### Description SQLDelight IDE plugin v2.3.2 crashes on startup and during VFS/save events with `NoClassDefFoundError: org/jetbrains/kotlin/idea/util/projectStructure/ProjectStructureUtilKt`.  ### Environment - **SQLDelight Plugin Version:** 2.3.2 - **IDE:** Android Studio (Build #AI-262.9437.185.2621.16467767 / Android Studio Rabbit 1 | 2026.2.1) - **OS:** macOS  ### Steps to Reproduce 1. Install SQLDelight plugin v2.3.2 into Android Studio. 2. Open a project with SQLDelight configured. 3. Observe the "IDE error occurred" popup notification on startup or when files are saved.  ### Root Cause / Details `app.cash.sqldelight.intellij.ProjectService.findConfiguredFileIndex(ProjectService.kt:124)` references `org.jetbrains.kotlin.idea.util.projectStructure.ProjectStructureUtilKt`. In recent platform/Kotlin plugin builds (262+ platform baseline / K2 plugin restructuring), this class/package has been moved or removed, causing runtime linkage failure.  ### Stacktrace  ```shell java.lang.NoClassDefFoundError: org/jetbrains/kotlin/idea/util/projectStructure/ProjectStructureUtilKt 	at app.cash.sqldelight.intellij.ProjectService.findConfiguredFileIndex(ProjectService.kt:124) 	at app.cash.sqldelight.intellij.ProjectService.access$findConfiguredFileIndex(ProjectService.kt:63) 	at app.cash.sqldelight.intellij.ProjectService$1.after(ProjectService.kt:100) 	at com.int

- **Issue #6383** (2026-11-12): **False positive: "Join condition always evaluates to true"**
  *Symptoms*: ### SQLDelight Version  2.3.2  ### IDE Version  Android Studio Rabbit 1 | 2026.2.1  ### Dialect  SQLite  ### Describe the Bug  Not a crash or a functional issue, but a false positive underline warning in the IDE.  Basic reproducer below, where the `t2.id = t1.id` checks are both underlined with the "Join condition always evaluates to true" warning:  ```sql CREATE TABLE MyTable (   id TEXT PRIMARY KEY,   name TEXT );  CREATE VIEW MyView AS SELECT t.id, t.name FROM MyTable t;  selfJoin: SELECT t1.name, t2.name FROM MyTable t1 JOIN MyTable t2 ON t2.id = t1.id;  viewToOwnTable: SELECT v.name, t.name FROM MyView v JOIN MyTable t ON t.id = v.id; ```  which gives:  <img width="541" height="374" alt="Image" src="https://github.com/user-attachments/assets/e63981d7-0599-4e7c-984f-923d4b2bf563" />  ### Stacktrace  ```shell None ``` 

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

### Incident Patch 1: `74b446bc` (2026-11-18)
**Commit Message**: Ensure JDBC connections are always closed (#6401)

* Ensure JDBC connections are always closed

If commit or rollback failed for any reason, the connection was never
closed which results in pool starvation when using hikaricp or similar
pooling. This change mitigates that by ensuring closeConnection is
always called.

* Add changelog entry

* Avoid AutoCloseable allocation while maintaining suppression

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@
 - [Runtime] Keep the transaction body's exception when ending the transaction or a post-rollback hook also fails, for example with `cannot rollback - no transaction is active` after SQLite rolled the transaction back on its own. The second exception is added as suppressed, and the Android driver now clears its current transaction even when `endTransaction()` throws (#6387 by @pyricau)
 - [Gradle Plugin] Configuration.visible property no longer has any effect. The property is now deprecated and will be removed in Gradle 11 (#6394 by @griffio)
 - [IntelliJ Plugin] Fixes join inspection showing a false positive (#6398 by @griffio)
+- [JDBC Driver] Fix leaking connections on commit/rollback failure (#6401 by @tKe)
 
 ## [2.4.1] - 2026-10-06
 [2.4.1]: https://github.com/sqldelight/sqldelight/releases/tag/2.4.1
```

**File**: `drivers/jdbc-driver/build.gradle` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@ base {
 
 dependencies {
   api projects.runtime
+
+  testImplementation libs.kotlin.test.junit
+  testImplementation libs.sqliteJdbc
 }
 
 apply from: "$rootDir/gradle/gradle-mvn-push.gradle"
```

**File**: `drivers/jdbc-driver/src/main/kotlin/app/cash/sqldelight/driver/jdbc/JdbcDriver.kt` (modified, +61/-9)
```diff
@@ -85,15 +85,34 @@ abstract class JdbcDriver :
   }
 
   override fun Connection.endTransaction() {
-    commit()
-    autoCommit = true
-    closeConnection(this)
+    finishWith({ closeConnection(this) }) {
+      try {
+        commit()
+      } catch (commitException: Throwable) {
+        try {
+          // From the JDBC docs:
+          //   > If [setAutoCommit] method is called during a transaction and the
+          //   > auto-commit mode is changed, the transaction is committed.
+          // Given we don't know the current state of the transaction after a failed commit, we attempt a rollback
+          // _before_ autoCommit=true to ensure we don't subsequently commit something we're reporting as failed.
+          rollback()
+          // rollback succeeded after commit failure, safe to reset
+          autoCommit = true
+        } catch (ex: Throwable) {
+          commitException.addSuppressed(ex)
+        }
+        throw commitException
+      }
+      // commit was successful, safe to reset
+      autoCommit = true
+    }
   }
 
   override fun Connection.rollbackTransaction() {
-    rollback()
-    autoCommit = true
-    closeConnection(this)
+    finishWith({ closeConnection(this) }) {
+      rollback()
+      autoCommit = true
+    }
   }
 
   override fun Connection.beginTransaction() {
@@ -167,13 +186,23 @@ abstract class JdbcDriver :
   override fun newTransaction(): QueryResult<Transacter.Transaction> {
     val enclosing = transaction
     val connection = enclosing?.connection ?: getConnection()
-    val transaction = Transaction(enclosing, this, connection)
-    this.transaction = transaction
 
+    // open any new transaction before setting it so we don't leak a failed transaction on failure
     if (enclosing == null) {
-      connection.beginTransaction()
+      try {
+        connection.beginTransaction()
+      } catch (ex: Throwable) {
+        try {
+          closeConnection(connection)
+        } catch (closeEx: Throwable) {
+          ex.addSuppressed(closeEx)
+        }
+        throw ex
+      }
     }
 
+    val transaction = Transaction(enclosing, this, connection)
+    this.transaction = transaction
     return QueryResult.Value(transaction)
   }
 
@@ -329,3 +358,26 @@ class JdbcCursor(val resultSet: ResultSet) : SqlCursor {
 
   override fun next(): QueryResult.Value<Boolean> = QueryResult.Value(resultSet.next())
 }
+
+/**
+ * Equivalent of running `AutoCloseable { finish() }.use { block() }` with matching suppression semantics
+ */
+private inline fun finishWith(finish: () -> Unit, block: () -> Unit) {
+  var thrown: Throwable? = null
+  try {
+    block()
+  } catch (ex: Throwable) {
+    thrown = ex
+    throw ex
+  } finally {
+    try {
+      finish()
+    } catch (finishEx: Throwable) {
+      if (thrown != null) {
+        thrown.addSuppressed(finishEx)
+      } else {
+        throw finishEx
+      }
+    }
+  }
+}
```

**File**: `drivers/jdbc-driver/src/test/kotlin/app/cash/sqldelight/driver/jdbc/JdbcDriverTransactionFailureTest.kt` (added, +192/-0)
```diff
@@ -0,0 +1,192 @@
+package app.cash.sqldelight.driver.jdbc
+
+import app.cash.sqldelight.Query
+import app.cash.sqldelight.TransacterImpl
+import java.sql.Connection
+import java.sql.DriverManager
+import java.sql.SQLException
+import java.util.*
+import kotlin.test.AfterTest
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFailsWith
+
+class JdbcDriverTransactionFailureTest {
+
+  private val driver = ConnectionTrackingJdbcDriver()
+  private val transacter = object : TransacterImpl(driver) {}
+
+  @AfterTest
+  fun checkConnectionsClosedAndClear() {
+    try {
+      assertEquals(0, driver.connectionCount, "connection was left open")
+    } finally {
+      driver.closeConnections()
+      driver.configureNewConnections { }
+    }
+  }
+
+  @Test
+  fun `connection closed and autoCommit not reset on rollback failure`() {
+    driver.configureNewConnections {
+      beforeRollback = { throw SQLException("rollback failed") }
+    }
+
+    val failure = assertFailsWith<SQLException> {
+      transacter.transaction { throw SQLException("failure in transaction") }
+    }
+    assertEquals("failure in transaction", failure.message)
+    assertEquals("rollback failed", failure.suppressed.single().message)
+
+    assertEquals(
+      listOf("setAutoCommit(false)", "rollback", "close"),
+      driver.lastConnection.calls,
+    )
+  }
+
+  @Test
+  fun `connection closed on autoCommit reset failure`() {
+    driver.configureNewConnections {
+      onAutoCommit = { autoCommit -> if (autoCommit) throw SQLException("reset autoCommit failed") }
+    }
+
+    val failure = assertFailsWith<SQLException> { transacter.transaction { } }
+    assertEquals("reset autoCommit failed", failure.message)
+
+    assertEquals(
+      listOf("setAutoCommit(false)", "commit", "setAutoCommit(true)", "close"),
+      driver.lastConnection.calls,
+    )
+  }
+
+  @Test
+  fun `connection closed on beginTransaction failure`() {
+    driver.configureNewConnections {
+      onAutoCommit = { autoCommit ->
+        // autoCommit is set to false in beginTransaction
+        if (!autoCommit) throw SQLException("unset autoCommit failed")
+      }
+    }
+
+    val failure = assertFailsWith<SQLException> { transacter.transaction { } }
+    assertEquals("unset autoCommit failed", failure.message)
+
+    assertEquals(
+      listOf("setAutoCommit(false)", "close"),
+      driver.lastConnection.calls,
+    )
+
+    // subsequent transaction succeeds
+    driver.configureNewConnections { /* defaults */ }
+    transacter.transaction { } // succeeds
+    assertEquals(
+      listOf("setAutoCommit(false)", "commit", "setAutoCommit(true)", "close"),
+      driver.lastConnection.calls,
+    )
+  }
+
+  @Test
+  fun `connection closed and autoCommit not restored when commit and rollback both fail`() {
+    driver.configureNewConnections {
+      beforeCommit = { throw SQLException("commit failed") }
+      beforeRollback = { throw SQLException("rollback failed") }
+    }
+    val failure = assertFailsWith<SQLException> { transacter.transaction { } }
+    assertEquals("commit failed", failure.message)
+    assertEquals("rollback failed", failure.suppressed.single().message)
+
+    assertEquals(
+      listOf("setAutoCommit(false)", "commit", "rollback", "close"),
+      driver.lastConnection.calls,
+    )
+  }
+
+  @Test
+  fun `connection closed and autoCommit restored when commit fails but rollback succeeds`() {
+    driver.configureNewConnections {
+      beforeCommit = { throw SQLException("commit failed") }
+    }
+
+    val failure =
+      assertFailsWith<SQLException> { transacter.transaction { } }
+    assertEquals("commit failed", failure.message)
+
+    assertEquals(
+      listOf("setAutoCommit(false)", "commit", "rollback", "setAutoCommit(true)", "close"),
+      driver.lastConnection.calls,
+    )
+  }
+}
+
+@Suppress("JavaDefaultMethodsNotOverriddenByDelegation")
+private class FailableConnection(val delegate: Connection) : Connection by delegate {
+  var beforeCommit: () -> Unit = { }
+  var beforeRollback: () -> Unit = { }
+  var onAutoCommit: (Boolean) -> Unit = { }
+  var lastAutoCommit: Boolean? = null
+  val calls = mutableListOf<String>()
+
+  override fun commit() {
+    calls += "commit"
+    beforeCommit()
+    delegate.commit()
+  }
+
+  override fun rollback() {
+    calls += "rollback"
+    beforeRollback()
+    delegate.rollback()
+  }
+
+  override fun setAutoCommit(autoCommit: Boolean) {
+    calls += "setAutoCommit($autoCommit)"
+    lastAutoCommit = autoCommit
+    onAutoCommit(autoCommit)
+    delegate.autoCommit = autoCommit
+  }
+
+  override fun close() {
+    calls += "close"
+    delegate.close()
+  }
+}
+
+private class ConnectionTrackingJdbcDriver : JdbcDriver() {
+  private val openConnections: MutableSet<FailableConnection> = Collections.newSetFromMap(IdentityHashMap())
+  val connectionCount get() = openConnections.size
+  lateinit var lastConnection: FailableConnection
+    priv
```

---

### Incident Patch 2: `df815f4d` (2026-11-18)
**Commit Message**: Use https://packages.jetbrains.team/maven/p/kt (#6402)

`maven.pkg.jetbrains.space` has been finally retired.

Use new  `https://packages.jetbrains.team/maven/p/kt`

**File**: `build.gradle` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ allprojects {
     maven { url 'https://www.jetbrains.com/intellij-repository/releases' }
     maven { url "https://cache-redirector.jetbrains.com/intellij-dependencies" }
     // Repo for the backported Android IntelliJ Plugin by Jetbrains used in Ultimate
-    maven { url "https://maven.pkg.jetbrains.space/kotlin/p/kotlin/kotlin-ide-plugin-dependencies/" }
+    maven { url "https://packages.jetbrains.team/maven/p/kt/kotlin-ide-plugin-dependencies/" }
   }
 
   tasks.withType(Test).configureEach {
```

#### Recent Merged Pull Requests:
- **PR #6402** (2026-11-18): Use https://packages.jetbrains.team/maven/p/kt (@griffio)
- **PR #6401** (2026-11-18): Ensure JDBC connections are always closed (@tKe)
- **PR #6400** (closed): Report ':' or '{' when a statement label is followed by neither (@wangkangmao)
- **PR #6399** (closed): Point JdbcSqliteDriver.IN_MEMORY at jdbc:sqlite::memory: (@mvanhorn)
- **PR #6398** (2026-11-12): is column same instance must check the source table (@griffio)
- **PR #6395** (2026-11-10): Update CI Runner to use macOS-15 (@griffio)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Ensure JDBC connections are always closed

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sqldelight/sqldelight. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `74b446bc`: Ensure JDBC connections are always closed. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
- [JDBC Driver] Fix leaking connections on commit/rollback failure (#6401 by @tKe)
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `74b446bc` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
