# Forensic Learning Record (Deep Inspection): sqldelight/sqldelight

> **Canonical Artifact**: `07_PROJECT_LEARNING/sqldelight-sqldelight-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sqldelight/sqldelight](https://github.com/sqldelight/sqldelight))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:50:59.527Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sqldelight/sqldelight`
- **Description**: SQLDelight - Generates typesafe Kotlin APIs from SQL
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6887 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `drivers/web-worker-driver/webpack.config.d/fs.js`
```
// Remove fs in the webpack config in order to build for front end
// https://github.com/webpack-contrib/css-loader/issues/447
config.resolve = {
    fallback: {
        fs: false,
        path: false,
        crypto: false,
    }
};

```

### Core Architecture Module: `extensions/androidx-paging3/karma.config.d/wasm.js`
```
const path = require("path");
const abs = path.resolve("../../node_modules/sql.js/dist/sql-wasm.wasm")

config.files.push({
    pattern: abs,
    served: true,
    watched: false,
    included: false,
    nocache: false,
});

config.proxies["/sql-wasm.wasm"] = `/absolute${abs}`

```

### Core Architecture Module: `extensions/androidx-paging3/webpack.config.d/fs.js`
```
// Remove fs in the webpack config in order to build for front end
// https://github.com/webpack-contrib/css-loader/issues/447
config.resolve = {
    fallback: {
        fs: false,
        path: false,
        crypto: false,
    }
};

```

### Core Architecture Module: `extensions/coroutines-extensions/karma.config.d/wasm.js`
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

config.proxies["/sql-wasm.wasm"] = `/absolute${wasm}`

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

### Core Architecture Module: `extensions/coroutines-extensions/webpack.config.d/fs.js`
```
config.resolve = {
    fallback: {
        fs: false,
        path: false,
        crypto: false,
    }
};

```

### Core Architecture Module: `sample-web/karma.config.d/sqljs-config.js`
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

config.proxies["/sql-wasm.wasm"] = `/absolute${wasm}`

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #6244** (2026-05-18): **The runtime artifact is causing a KLIB resolver warning with Metro**
  *Symptoms*: ### SQLDelight Version  2.3.2  ### Operating System  macos  ### Gradle Version  9.5.0  ### Kotlin Version  2.3.21  ### Dialect  SQLite  ### AGP Version  _No response_  ### Describe the Bug  I use both Metro and SqlDelight in my project. When I try to run `./gradlew compileIosMainKotlinMetadata` I get the following warning (which becomes an error because of `Werror`):  ``` w: KLIB resolver: The same 'unique_name=runtime_commonMain' found in more than one library: /Users/eli.graber/git-repos/app/core/database/build/kotlinTransformedMetadataLibraries/commonMain/app.cash.sqldelight-runtime-2.3.2-commonMain-vjl7hQ.klib, /Users/eli.graber/git-repos/app/core/database/build/kotlinTransformedMetadataLibraries/commonMain/dev.zacsweers.metro-runtime-1.0.0-commonMain-2_WilQ.klib e: warnings found and -Werror specified ```  I tried using `-Xrender-internal-diagnostic-names` so I could disable the warning, but it wasn't printing the name.  [Also filed with Metro](https://github.com/ZacSweers/metro/issues/2267).  ### Stacktrace  ```shell  ```  ### Gradle Build Script  ```gradle  ```
  **Post-Mortem & Fix Analysis**:
  > This isn't really an issue with metro or sqldelight, appears to be https://youtrack.jetbrains.com/issue/KT-77818. I would recommend pinging that. In the meantime this is just a warning you can disable as a workaround.

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

Co-authored-by: Jake Wharton <jw@jakewharton.com>

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

Co-authored-by: Jake Wharton <jw@jakewharton.com>

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

#### Recent Merged Pull Requests:
- **PR #6376** (2026-09-29): Prefer Marketplace error reporting over custom solution (@JakeWharton)
- **PR #6375** (2026-09-29): Update dependency org.postgresql:r2dbc-postgresql to v1.1.3.RELEASE (@renovate[bot])
- **PR #6374** (2026-09-29): Keep query files in-memory for the duration of a task (@C2H6O)
- **PR #6373** (2026-09-29): Remove return value from migrateInternal when generateAsync is disabled (@kevinguitar)
- **PR #6370** (2026-09-25): Update dependency com.google.testparameterinjector:test-parameter-injector to v1.23 (@renovate[bot])
- **PR #6369** (2026-09-29): Update agp to v9.4.1 (@renovate[bot])
- **PR #6368** (2026-09-28): Fix ToolWindow override violation (@griffio)
- **PR #6367** (2026-09-22): Update plugin intellij to v2.19.0 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
