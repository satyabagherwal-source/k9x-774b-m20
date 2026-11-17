# Verification Protocol: Verification Protocol: Empirical Defect Shield for trinodb/trino

<!-- PROVENANCE_START
{
  "source_repository": "trinodb/trino",
  "source_url": "https://github.com/trinodb/trino",
  "source_version": "d97ac24e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T08:43:37.953Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-trinodb-trino",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trinodb/trino](https://github.com/trinodb/trino) (Revision: `d97ac24e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T08:43:37.953Z`  
> **Learning ID**: `learn-github-trinodb-trino`


## 1. Scope & Verification Target
- **Target Repository**: `trinodb/trino` (Commit: `d97ac24e`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Project Learning Record (Full-Spectrum Forensic Harvest): trinodb/trino

---

## 1. Executive Forensic Architecture & System Mechanics

Trino (formerly PrestoSQL) is a distributed SQL query execution engine designed for high-concurrency, low-latency, ad-hoc analytics directly across heterogeneous storage targets (S3/Ceph via Hive/Iceberg/Delta Lake, RDBMS via JDBC, Kafka, Redis, BigQuery, etc.) without intermediate data ingestion.

```
                    +------------------------------------+
                    |        Trino CLI / JDBC Client      |
                    +-----------------+------------------+
                                      | HTTP/REST Protocol (JSON / Spooling)
                                      v
                    +------------------------------------+
                    |         Trino Coordinator          |
                    |  - Parser & Analyzer (ANTLR / AST) |
                    |  - Cost-Based Optimizer (CBO)      |
                    |  - Dynamic Filter Planner          |
                    |  - Stage / Split Scheduler         |
                    +-----------------+------------------+
                                      | HTTP Internal Task Communication
           +--------------------------+--------------------------+
           |                                                     |
           v                                                     v
+------------------------+                             +------------------------+
|      Trino Worker      |                             |      Trino Worker      |
|  - TaskExecutor        |                             |  - TaskExecutor        |
|  - Driver Loop         |                             |  - Driver Loop         |
|  - Operator Pipelines  |                             |  - Operator Pipelines  |
|  - PageBufferExchange  |                             |  - PageBufferExchange  |
|  - Connector SPI Plugin|                             |  - Connector SPI Plugin|
+-----------+------------+                             +-----------+------------+
            |                                                      |
            v                                                      v
  [ S3 / Iceberg / Delta ]                                 [ Remote JDBC / Engine ]
```

### Critical Subsystem Boundaries and Operational Mechanics:
1. **Coordinator-Worker Protocol**:
   The Coordinator parses SQL into Abstract Syntax Trees, performs type resolution and scope analysis, generates an intermediate representation (IR), applies Cost-Based Optimizations (CBO) and rule-based rewrites, breaks queries into distributed stages (`QueryExecution` -> `StageExecution`), and schedules splits to workers. Workers report split states via non-blocking polling and long-running REST endpoints (`/v1/task/{taskId}/status`).
2. **Volcano-Style Vectorized Pipeline Engine (`Driver` / `Operator`)**:
   Within workers, execution is broken down into `Pipelines` containing chained `Operator` instances. Instead of tuple-at-a-time (traditional Volcano), data flows in columnar `Page` blocks (typically up to 1MB or 8,192 positions) composed of raw `Block` memory arrays (e.g., `VariableWidthBlock`, `ByteArrayBlock`, `DictionaryBlock`).
3. **Connector SPI Decoupling**:
   Connectors (`trino-spi`) run in isolated classloaders. The coordinator negotiates partitions and table layouts via `ConnectorMetadata` and `ConnectorSplitManager`. Record data is streamed to workers via `ConnectorPageSource` or `ConnectorRecordSetProvider`.
4. **Dynamic Filtering Subsystem**:
   When evaluating join nodes (e.g., hash joins), the build side dynamically constructs a Bloom filter or domain range (`TupleDomain`) of keys. This filter is coordinated back to the probe side and pushed directly into remote table scans (e.g., Iceberg manifest readers, Parquet dictionary filters) to eliminate IO before tuples reach the join operator.
5. **Memory and Task Scheduling Arbiter**:
   Memory is partitioned into `USER` and `SYSTEM` memory pools. `TaskExecutor` manages split-running threads cooperatively: each driver must yield control within a quantum (nominally ~1 second) if blocked on IO, page exchange, or memory allocation.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Defense Against Concurrency TOCTOU in Filesystem Probing
**RULE**:
Code MUST NOT invoke existence checks (e.g., `Files.exists(path)`) prior to state read or write operations to decide flow control. Operations MUST directly attempt the required I/O operation and catch precise underlying platform exceptions (e.g., `NoSuchFileException`, `FileAlreadyExistsException`) within the operational boundary.

**WHY**:
Stateless checks (`Files.exists(path)`) create a Time-of-Check to Time-of-Use (TOCTOU) race condition. Between the return of `Files.exists()` and the execution of `Files.readString()`, concurrent processes or OS-level file operations can delete, truncate, or rewrite the resource. Relying on boolean pre-checks causes transient, hard-to-reproduce unhandled runtime failures (e.g., `NoSuchFileException` escaping to caller threads as an `UncheckedIOException`).

**WHEN TO APPLY**:
Apply across any filesystem access, token caching, credential retrieval, lock-file acquisition, or socket probing in multi-threaded or multi-process systems (Java NIO, Python `pathlib`, POSIX C/C++, Go `os`).

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Production-grade pattern from io.trino.client.auth.external.SystemCachedKnownToken
public Optional<Token> getToken()
{
    // Never do: if (!Files.exists(tokenFile)) return Optional.empty();
    try {
        String content = Files.readString(tokenFile).trim();
        if (content.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new Token(content));
    }
    catch (NoSuchFileException e) {
        // Safe: File was deleted or did not exist at the exact moment of open syscall
        return Optional.empty();
    }
    catch (IOException e) {
        throw new UncheckedIOException("Failed to read token from " + tokenFile, e);
    }
}
```

**NEGATIVE CONSTRAINT**:
```java
// ANTI-PATTERN: TOCTOU race hazard
public Optional<Token> getTokenBuggy()
{
    if (!Files.exists(tokenFile)) { // Time of check
        return Optional.empty();
    }
    // Race window: Another thread/process can delete tokenFile here!
    try {
        String content = Files.readString(tokenFile).trim(); // Time of use -> Throws NoSuchFileException!
        return Optional.of(new Token(content));
    }
    catch (IOException e) {
        throw new UncheckedIOException(e); // Fatal crash on normal concurrent operation
    }
}
```

**VERIFICATION METHOD**:
Enforce static analysis rule banning `Files.exists` immediately followed by `Files.read*` or `Files.newInputStream`. Verify via concurrent stress test spawning 1 writer loop and 1 reader loop over a single file path executing concurrently for >= 3 seconds without catching uncaught I/O exceptions.

---

### 2. Semantic Parity Guard for Dynamic Query Optimization Pushdown
**RULE**:
Optimizers MUST NOT convert or push down three-valued logic expressions (e.g., `IS NOT DISTINCT FROM`) into two-valued equality expressions (e.g., `=` or dynamic filters operating under standard equivalence) if the underlying domain type allows self-inequality (e.g., IEEE 754 `NaN`) or nested nullability (structural types: `ROW`, `ARRAY`, `MAP`).

**WHY**:
In standard SQL, dynamic filters operate via strict equivalence (`=`). Under strict equivalence, `NaN = NaN` is FALSE, and nested structural types containing nulls (e.g., `ROW(NULL) = ROW(NULL)`) evaluate to UNKNOWN/FALSE. Conversely, `IS NOT DISTINCT FROM` treats `NULL` as identical to `NULL` and `NaN` as identical to `NaN`. Mapping `IS NOT DISTINCT FROM` to dynamic filters without verifying type determinism silently prunes valid tuples from the probe side of joins, generating silent data corruption.

**WHEN TO APPLY**:
Query planners, predicate pushdown engines, distributed join optimizers, and expression rewriters targeting IEEE floating point types (`FLOAT`, `DOUBLE`), structural composite types (`STRUCT`/`ROW`, `ARRAY`, `MAP`), or variant/JSON types.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Production-grade pattern from io.trino.sql.planner.optimizations.PredicatePushDown
private boolean joinDynamicFilteringExpression(Expression expression, Collection<Symbol> rightSymbols)
{
    // ...
    if (operator == IDENTICAL) { // IS NOT DISTINCT FROM
        // Dynamic filters follow '=' semantics:
        // NaN is not collected, and structural values containing nulls or NaN do not match themselves.
        // Therefore, disallow dynamic filter generation if types can fail self-equality.
        if (mayBeUnequalToItself(left.type()) || mayBeUnequalToItself(right.type())) {
            return false;
        }
    }
    // ...
}

private static boolean mayBeUnequalToItself(Type type)
{
    return typeHasNaN(type) || isStructural(type);
}
```

**NEGATIVE CONSTRAINT**:
```java
// ANTI-PATTERN: Incomplete type check omitting structural composites
if (operator == IDENTICAL) {
    // Fails to check ARRAY, MAP, ROW types that contain NULL or NaN inside elements!
    if (left.type().equals(REAL) || right.type().equals(REAL) || 
        left.type().equals(DOUBLE) || right.type().equals(DOUBLE)) {
        return false;
    }
    // Generates dynamic filter for ROW(NULL), dropping valid join matches!
}
```

**VERIFICATION METHOD**:
Execute join queries across composite types containing nulls (`ROW(NULL)`) and `NaN` (`ARRAY[nan()]`) under both dynamic filtering enabled and disabled sessions:
`SELECT count(*) FROM t1 WHERE col IS NOT DISTINCT FROM (SELECT col FROM t2 WHERE id = 3)`. Assert query results match bit-for-bit.

---

### 3. Idempotent Precondition Retries on Storage Boundaries
**RULE**:
When implementing exclusive writes (`createExclusive`, `PUT if-none-match: *`, `O_CREAT | O_EXCL`) against eventual-consistency or retrying network clients, the operational layer MUST NOT interpret client-side precondition failures as definitive proof of conflict without validating if the existing entity's unique upload identifier matches the current transaction attempt.

**WHY**:
Network partitions or HTTP socket timeouts often occur *after* the remote storage engine (e.g., AWS S3, Azure Blob, GCS) successfully persists data and registers the metadata. Automatic client SDK retries replay the request with `If-None-Match: *`. The second request fails with `412 Precondition Failed` (`FileAlreadyExistsException`), falsely alerting the query engine that another concurrent writer won the race, aborting an otherwise valid single-producer operation.

**WHEN TO APPLY**:
Storage connectors, object-store adaptors (S3, GCS, ADLS), distributed lock managers, and consensus client writers executing conditional network writes.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Safe exclusive write retry pattern with ownership confirmation
public void createExclusiveWithRetry(Path target, byte[] data, String writeNonce) 
        throws FileAlreadyExistsException, IOException
{
    try {
        underlyingClient.putObjectConditional(target, data, /* ifNoneMatch */ "*");
    }
    catch (PreconditionFailedException e) {
        // Did our previous attempt succeed before the connection severed?
        ObjectMetadata meta = underlyingClient.getObjectMetadata(target);
        if (writeNonce.equals(meta.getUserMetadata().get("write-nonce"))) {
            // Self-write confirmed; succeed idempotently
            return;
        }
        // Genuine collision with another writer
        throw new FileAlreadyExistsException(target.toString());
    }
}
```

**NEGATIVE CONSTRAINT**:
```java
// ANTI-PATTERN: Direct translation of precondition failure to collision error
public void createExclusiveBuggy(Path target, byte[] data) throws IOException {
    try {
        s3Client.putObject(PutObjectRequest.builder()
            .bucket(bucket).key(key).ifNoneMatch("*").build(), 
            RequestBody.fromBytes(data));
    } catch (S3Exception e) {
        if (e.statusCode() == 412) {
            // BLIND ASSUMPTION: Another writer created this file.
            // Reality: The first attempt succeeded, the TCP socket dropped, the retry hit 412!
            throw new FileAlreadyExistsException(target.toString());
        }
        throw e;
    }
}
```

**VERIFICATION METHOD**:
Implement a mock proxy injecting TCP RST after 100% of bytes are uploaded on initial `PUT`. Validate that subsequent SDK retries or application retry loops complete successfully without throwing `FileAlreadyExistsException`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: SystemCachedKnownToken TOCTOU Race Condition during Setup (BUG-AUTH-01)
- **Context**: Subsystem `client/trino-client`, specifically `io.trino.client.auth.external.SystemCachedKnownToken`.
- **What Was Expected**: Multi-process/multi-threaded clients sharing a system cache directory for external OAuth/OIDC tokens should retrieve the cached token if present, or return `Optional.empty()` if absent or abandoned.
- **What Actually Happened**: When thread $A$ was executing `getToken()` and thread $B$ was executing `setupToken()`, `getToken()` verified `Files.exists(tokenFile)` which returned `true`. Simultaneously, thread $B$ began setting up a fresh token and deleted the stale file. Thread $A$ then executed `Files.readString(tokenFile)`, throwing `NoSuchFileException`, wrapped into `UncheckedIOException` and crashing the client.
- **Evidence in Repo**: Commit `a71336f7`. Files: `SystemCachedKnownToken.java`, `TestSystemCachedKnownToken.java`.
- **Root Cause**: Reliance on non-atomic file presence pre-checks (`Files.exists()`) before atomic system read calls (`Files.readString()`).
- **Remediation Code Diff**:
```java
// client/trino-client/src/main/java/io/trino/client/auth/external/SystemCachedKnownToken.java
@@ -84,16 +85,17 @@ public Optional<Token> getToken()
-        if (!Files.exists(tokenFile)) {
-            return Optional.empty();
-        }
         try {
             String content = Files.readString(tokenFile).trim();
             if (content.isEmpty()) {
                 return Optional.empty();
             }
             return Optional.of(new Token(content));
         }
+        catch (NoSuchFileException e) {
+            // also when a concurrent setupToken deletes the token file after the lock file check
+            return Optional.empty();
+        }
         catch (IOException e) {
             throw new UncheckedIOException("Failed to read token from " + tokenFile, e);
         }
```
- **Lesson**: Never check resource presence ahead of an IO call. Perform the IO action and catch the absence exception directly.

---

### Incident 2: Dynamic Filters Pushdown Inconsistency on IS NOT DISTINCT FROM (BUG-OPT-02)
- **Context**: Subsystem `core/trino-main`, optimizer rule `PredicatePushDown.java`.
- **What Was Expected**: Queries with `WHERE l.key IS NOT DISTINCT FROM r.key` must return identical records regardless of whether dynamic filtering optimizations are enabled or disabled.
- **What Actually Happened**: Dynamic filtering generated runtime domain pushdown predicates for structural types (`ROW`, `ARRAY`, `MAP`) and floating-point types (`REAL`, `DOUBLE`). However, the dynamic filter evaluation engine only executed strict equality (`=`). When rows contained `ROW(NULL)` or `ARRAY[nan()]`, `IS NOT DISTINCT FROM` expected matches, but the generated dynamic filter dropped them during table scan because `NULL = NULL` and `NaN = NaN` evaluate to false in equality semantics.
- **Evidence in Repo**: Commit `715f09a9`. Files: `PredicatePushDown.java`, `TestDynamicFilter.java`, `AbstractTestDynamicRowFiltering.java`.
- **Root Cause**: The optimizer only checked whether the column types were `REAL` or `DOUBLE` directly, ignoring complex/structural types (`ROW`, `ARRAY`, `MAP`) containing nulls or `NaN`, and missing custom `NUMBER` types.
- **Remediation Code Diff**:
```java
// core/trino-main/src/main/java/io/trino/sql/planner/optimizations/PredicatePushDown.java
@@ -1212,7 +1212,9 @@ private boolean joinDynamicFilteringExpression(Expression expression, Collection
             if (operator == IDENTICAL) {
-                if ((left.type().equals(REAL) || right.type().equals(REAL) || left.type().equals(DOUBLE) || right.type().equals(DOUBLE))) {
+                // Dynamic filters follow = semantics: NaN is not collected, and structural values containing nulls or NaN
+                // do not match themselves, while IS NOT DISTINCT FROM matches them
+                if (mayBeUnequalToItself(left.type()) || mayBeUnequalToItself(right.type())) {
                     return false;
                 }
             }
@@ -1225,6 +1227,11 @@
+        private static boolean mayBeUnequalToItself(Type type)
+        {
+            return typeHasNaN(type) || isStructural(type);
+        }
```
- **Lesson**: When bridging distinct relational operators in compiler optimization passes, verify complete domain type reflexivity ($x \equiv x$) across all recursive and composite data types.

---

### Incident 3: Redshift Connector Varbinary Type Mapping Failure (BUG-TEST-03)
- **Context**: Subsystem `plugin/trino-redshift`, specifically `TestRedshiftUnloadTypeMapping.testVarbinary`.
- **What Was Expected**: Unload operations should correctly map and deserialize Redshift varbinary columns into Trino `VARBINARY`.
- **What Actually Happened**: Test suite crashed with: `io.trino.testing.QueryFailedException: Table 'test_schema.test_varbinary...' has no supported columns (all 19 columns are not supported)`.
- **Evidence in Repo**: Issue #27403, PR #27388.
- **Root Cause**: During JDBC metadata reflection, Redshift's data type ID for `VARBINARY` was not registered or was omitted in the supported column mapping filter during schema synchronization, causing Trino to treat all columns as unsupported and reject the table entirely.
- **Remediation Code Diff**:
```java
// Corrected type handling in RedshiftClient/TypeMapping
// Ensure JDBC data type IDs for VARBINARY and GEOMETRY/GEOGRAPHY are mapped 
// to Trino native VarbinaryType and not dropped by BaseJdbcClient.
if (dataType == Types.VARBINARY || dataType == Types.LONGVARBINARY) {
    return Optional.of(new ColumnMapping(
        VARBINARY,
        VarbinaryType.VARBINARY,
        varbinaryReadFunction(),
        varbinaryWriteFunction()));
}
```
- **Lesson**: Connector metadata discovery must have explicit fallback tests ensuring all standard SQL types are mapped, preventing whole-table drops when encountering peripheral data types.

---

### Incident 4: S3 Precondition Retries Triggering False FileAlreadyExistsException (BUG-S3-04)
- **Context**: Subsystem `lib/trino-filesystem-s3`, class `S3OutputFile.java`.
- **What Was Expected**: `TrinoOutputFile.createExclusive()` must ensure that a file is only created if it does not already exist. If the target does not exist, creation must succeed even if transient network drops occur.
- **What Actually Happened**: Trino used S3 conditional writes (`If-None-Match: *`). Under high throughput or network flakiness, the initial `PUT` succeeded on AWS S3, but the TCP socket dropped before the HTTP 200 reached the AWS Java SDK client. The AWS SDK retry policy automatically re-sent the exact same `PUT` with `If-None-Match: *`. Because the object was committed during the first attempt, the retried request failed with `412 Precondition Failed`, causing the AWS SDK to throw `S3Exception`, which Trino translated into `FileAlreadyExistsException`.
- **Evidence in Repo**: Issues #27402, #27400, AWS SDK Issue #6580.
- **Root Cause**: Conflict between automatic network retries in the underlying client SDK and conditional HTTP write preconditions without request idempotency validation.
- **Remediation Code Diff**:
```java
// S3OutputFile.java implementation logic
// When retrying conditional put, must detect if existing object was authored by current execution:
try {
    s3Client.putObject(putRequest, requestBody);
} catch (S3Exception e) {
    if (e.statusCode() == 412) {
        // Must inspect metadata or verify transaction token before assuming foreign collision:
        if (isSelfAuthoredRetry(s3Client, targetLocation, expectedUploadId)) {
            return; // Success on previous network attempt
        }
        throw new FileAlreadyExistsException(targetLocation.toString());
    }
    throw e;
}
```
- **Lesson**: Network retries over conditional storage mutations must be paired with idempotency tokens (e.g., client nonce or upload ID) to distinguish duplicate self-writes from external race collisions.

---

### Incident 5: Web UI ClusterHUD Sparkline Re-Render Memory Thrashing (BUG-UI-05)
- **Context**: Subsystem `core/trino-web-ui`, component `ClusterHUD.jsx`.
- **What Was Expected**: ClusterHUD monitors running queries, workers, and memory rates, polling `/ui/api/stats` once every 1,000ms and rendering jQuery sparkline visualizations cleanly.
- **What Actually Happened**: Any React parent re-render or internal state mutation triggered `componentDidUpdate()`. The sparkline initialization library wiped and rebuilt the DOM tree inside the canvas container on every invocation. If network jitter delivered stats irregularly, `componentDidUpdate()` thrashed the DOM up to tens of times per second, leaking memory and starving the browser event loop.
- **Evidence in Repo**: `core/trino-web-ui/src/main/resources/webapp-legacy/src/components/ClusterHUD.jsx`.
- **Root Cause**: Absence of rendering rate-limiting within the React component lifecycle methods when coordinating with non-React imperative DOM plugins (jQuery sparklines).
- **Remediation Code Diff**:
```javascript
// core/trino-web-ui/src/main/resources/webapp-legacy/src/components/ClusterHUD.jsx
componentDidUpdate() {
    // PREVENT RAPID-FIRE RE-RENDERING THROTTLING INVARIANT
    // Prevent multiple calls to componentDidUpdate within the refresh interval 
    // from re-rendering sparklines/charts:
    if (this.state.lastRender === null || Date.now() - this.state.lastRender >= 1000) {
        const renderTimestamp = Date.now()
        $('#running-queries-sparkline').sparkline(
            this.state.runningQueries,
            $.extend({}, SPARKLINE_PROPERTIES, { chartRangeMin: 0 })
        )
        // ... all other sparkline DOM updates ...
        this.setState({
            lastRender: renderTimestamp,
        })
    }
    $('[data-toggle="tooltip"]').tooltip()
}
```
- **Lesson**: Imperative third-party DOM modifications executed inside reactive component hooks MUST be guarded by monotonic timestamps or throttling gates to prevent layout thrashing and DOM destruction loops.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **Implicit Falsy vs. Explicit Numeric Zero Traps**:
  In UI dashboards (e.g., `QueryDetail.jsx` and `ClusterHUD.jsx`), measuring execution metrics like `task.stats.elapsedTime` or `activeWorkers` cannot rely on falsy checks:
  ```javascript
  // WRONG: 0 milliseconds is treated as falsy, triggering false fallback to Date.now()
  let elapsedTime = parseDuration(task.stats.elapsedTime);
  if (!elapsedTime) { elapsedTime = Date.now() - Date.parse(task.stats.createTime); }

  // CORRECT: Strict numeric zero check
  let elapsedTime = parseDuration(task.stats.elapsedTime);
  if (elapsedTime === 0) {
      elapsedTime = Date.now() - Date.parse(task.stats.createTime);
  }
  ```
* **Deep Immobility vs. Mutation in History Arrays**:
  In `ClusterHUD.jsx`, state historical arrays (`runningQueries`, `activeWorkers`) are appended on every tick. Mutating arrays directly in state breaks memoization and produces visual glitches:
  ```javascript
  // CORRECT: Pure functional slice/append returning a new reference
  function addToHistory(value, history) {
      const MAX_HISTORY = 60;
      const newHistory = history.slice(Math.max(history.length - MAX_HISTORY + 1, 0));
      newHistory.push(value);
      return newHistory;
  }
  ```

### 2. Infinite Loop & Recursion Guards
* **Polling Timer Chaining Invariant**:
  In `LivePlan.jsx`, `PageTitle.jsx`, and `ClusterHUD.jsx`, asynchronous polling MUST NOT use `setInterval()`. It MUST use recursive `setTimeout()` chained only upon the resolution or failure of the preceding network request:
  ```javascript
  // Invariant Pattern: Recursive single-timer pattern
  resetTimer() {
      clearTimeout(this.timeoutId); // Guard against concurrent loops
      if (this.state.query === null || !this.state.ended) {
          this.timeoutId = setTimeout(this.refreshLoop.bind(this), 1000);
      }
  }

  refreshLoop() {
      clearTimeout(this.timeoutId); // Eliminate duplicate triggers
      fetch('/ui/api/stats')
          .then(res => res.json())
          .then(data => {
              this.setState({ ... });
              this.resetTimer(); // Chain NEXT tick only after handling response
          })
          .catch(err => {
              this.resetTimer(); // Ensure recovery even on network failure
          });
  }
  ```
* **Tree Recursion Depth Bounds in AST/Plan Walkers**:
  Plan visitors and optimizers in `core/trino-main` (e.g., `PredicatePushDown`) evaluate conjuncts with explicit recursion caps or breadth-first traversals to prevent `StackOverflowError` when compiling deeply nested binary expressions (e.g., `a AND b AND c AND ...` 5,000 times).

### 3. UI & UX Micro-Mechanics
* **Bootstrap Modal State Sync Invariant**:
  In `PageTitle.jsx`, when network connectivity drops, the `#no-connection-modal` is displayed. If state is not tracked before re-invoking the jQuery modal plugin, bootstrap recreates backdrops on every tick, locking the browser UI:
  ```javascript
  // Guard against modal backdrop accumulation:
  if (!this.state.modalShown && (fail || Date.now() - this.state.lastSuccess > 30 * 1000)) {
      $('#no-connection-modal').modal();
      this.setState({ modalShown: true });
  }
  ```
* **DagreD3 Canvas DOM Integration**:
  In `LivePlan.jsx`, complex SVG node graph rendering uses `ReactDOMServer.renderToString` to serialize React virtual DOM trees into standard HTML strings for injection into SVG foreignObject containers:
  ```javascript
  const html = ReactDOMServer.renderToString(<StageStatistics key={stage.id} stage={stage} />);
  graph.setNode(stageRootNodeId, {
      class: 'stage-stats',
      label: html,
      labelType: 'html',
  });
  ```

### 4. Backend Concurrency & Memory Safety
* **Lock File Manual Intervention Trap**:
  When acquiring file-based locks for token caches (`SystemCachedKnownToken`), an abandoned process leaves a `.lock` file. The file creation MUST use atomic POSIX flags (`StandardOpenOption.CREATE_NEW`). If the lock file exists, read attempts must be capped with a strict timeout and fail with an explicit diagnostic message instructing manual resolution.
* **Worker Task Executor Thread Starvation**:
  In worker pipelines, `Driver` instances must never invoke blocking socket calls directly inside their run loop. IO operations must return a `ListenableFuture<?>`. The `TaskExecutor` unbinds the driver from the OS thread pool until the future signals completion, ensuring $O(1)$ pool thread availability regardless of remote storage latency.

### 5. Defect & Error Prevention ("Galti Pakadna")
* **Delimiter Stripping Boundary Hazard**:
  When extracting substring prefixes/suffixes from composite identifiers (e.g., `taskId` structured as `query.stage.task`):
  ```javascript
  // Boundary safe extraction from QueryDetail.jsx:
  static removeQueryId(id) {
      const pos = id.indexOf('.');
      if (pos !== -1) {
          return id.substring(pos + 1); // Boundary check prevents -1 + 1 = 0 substring return
      }
      return id;
  }
  ```
* **HTTP 401 Force-Reload Authentication Sync**:
  In `PageTitle.jsx`, if the session expires, background polling returns 401. Simply ignoring it leaves the UI in a stale, broken state. Calling `location.reload()` forces clean redirect through the authentication filter (e.g., Okta/Form Login):
  ```javascript
  fetch('/ui/api/cluster')
      .then((response) => {
          if (response.status === 401) {
              location.reload();
          }
          return response.json();
      })
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
Trino is organized into three strictly partitioned tiers:
- **Client Tier**: Thin CLI and JDBC drivers communicating via a stateless HTTP REST protocol.
- **Coordinator Tier**: Query parser (ANTLR4), logical planner, cost-based optimizer, split scheduler, execution coordinator, and discovery manager.
- **Worker Tier**: Pipeline engine executing native `Drivers` comprising chained `Operators`.
State ownership is strictly decoupled: Workers do not know the global query graph; they only execute assigned `Task` fragments and expose output buffers.

### 2. Core Abstractions
- `Slice`: Byte array abstraction (from Airlift) providing zero-copy unsafe memory access, off-heap capabilities, and bounds checking.
- `Block`: Columnar vector primitive supporting random access, null vectors, and dictionary encoding (`DictionaryBlock`, `RunLengthEncodedBlock`).
- `Page`: Vector of `Block` instances representing a tabular row slice across multiple columns.
- `Connector`: Tripartite interface: `ConnectorMetadata`, `ConnectorSplitManager`, `ConnectorPageSourceProvider`.

### 3. Error Handling
Errors are cataloged into four root families via `ErrorType`: `USER_ERROR` (syntax, invalid types), `INTERNAL_ERROR` (optimizer bugs, compiler faults), `INSUFFICIENT_RESOURCES` (memory exhaustion, thread pool saturation), and `EXTERNAL` (remote storage failure, S3 500, network loss). Exceptions propagate as `TrinoException` wrapping a numeric `ErrorCode`.

### 4. Testing
- Testing uses `QueryAssertions` and `DistributedQueryRunner`.
- `SqlDataTypeTest` programmatically exercises cross-type conversions, bounds, and boundary edge cases across connectors.
- `PlanMatchPattern` validates optimizer AST plan shapes, verifying that dynamic filters, join ordering, and predicate pushdown occur as expected without relying on runtime execution.

### 5. Security
- System access control via SPI (`SystemAccessControl`, `ConnectorAccessControl`).
- Credential isolation: POSIX permission locks on token storage caches (`0600` permissions via `PosixFilePermissions.asFileAttribute()`).
- Query redaction engine masking sensitive literals from coordinator audit logs and Web UI outputs.

### 6. Performance
- In-memory vectorized evaluation via dynamically generated bytecode (using Bytecode library) synthesizing high-throughput inner loops.
- Dynamic filtering prevents remote storage reads by compiling Bloom filters on hash join builds and pushing them down into Parquet/ORC row-group stats and Iceberg partition pruners.

### 7. Deployment
- Java 25.0.1+ 64-bit runtime mandatory.
- Maven-driven build with reproducible build guarantees (`reproducible-builds.org` compliant from v449).
- Single-binary distribution model with strict configuration directories: `etc/node.properties`, `etc/jvm.config`, `etc/config.properties`.

### 8. Agent Patterns
- Structured execution trees: Tasks decompose into stages, fragments, pipelines, drivers, and operators.
- Automated self-healing: Task-level retries (`retryPolicy = TASK`) buffer intermediate exchange outputs to local disk or remote storage, allowing individual worker node failures to be transparently retried without aborting long-running queries.

### 9. Data Flow
1. SQL String -> ANTLR4 Parser -> AST.
2. AST -> Logical Analyzer -> Logical Plan.
3. Logical Plan -> Cost-Based Optimization -> Distributed Physical Plan.
4. Coordinator -> Split Assignment via HTTP POST -> Worker Task Creation.
5. Storage Connector -> `ConnectorPageSource` -> `Page` vectors.
6. Pipeline Operator Chain -> Vectorized processing -> Output Buffer.
7. Destination Worker / Client -> HTTP Spooling / Direct Exchange -> Output Consumption.

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Recursive Poll-and-Yield Component Synchronization
```javascript
// Universal pattern for asynchronous UI dashboard synchronization without memory thrashing
function setupPoller(endpoint, onData, intervalMs) {
    let timeoutId = null;
    let running = true;

    function poll() {
        if (!running) return;
        

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
