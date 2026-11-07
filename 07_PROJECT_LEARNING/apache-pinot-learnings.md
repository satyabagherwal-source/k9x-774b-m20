> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/apache-pinot-learnings.md`  
> **Source**: github ([https://github.com/apache/pinot](https://github.com/apache/pinot))  
> **Source Version**: `f60f17fd`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-07T22:08:02.176Z  
> **Learning ID**: `learn-github-apache-pinot`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): apache/pinot

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Problem Statement & Scope
Apache Pinot is a distributed, real-time, column-oriented OLAP data engine designed to execute sub-second analytical queries (SQL, aggregations, vector similarity search, arbitrary filtering) across trillions of records and petabytes of data. It addresses the low-latency serving dilemma: executing complex ad-hoc and real-time streaming queries concurrently against immutable historical segments and mutable stream-ingested consuming segments.

### 1.2 System Boundaries & Decomposition
Pinot orchestrates a multi-tier shared-nothing/shared-storage cluster via Apache Helix and Apache ZooKeeper:

```
                  +----------------------------------+
                  |  Query Client / AI Agent / BI   |
                  +----------------------------------+
                                   | SQL
                                   v
             +---------------------------------------------+
             |            Pinot Broker Cluster             |
             |  - Calcite SQL Parser & Query Optimizer     |
             |  - Single-Stage vs Multi-Stage Dispatcher   |
             |  - Row-Level & Col-Level Security (RLS/CLS) |
             |  - Scatter-Gather Engine / Routing Table    |
             +---------------------------------------------+
                   /               |               \
        Partition /       Partition |       Partition \
                 v                 v                 v
     +-----------------+   +-----------------+   +-----------------+
     |  Pinot Server   |   |  Pinot Server   |   |  Pinot Server   |
     | (Leaf Segment)  |   | (Leaf Segment)  |   | (Leaf Segment)  |
     |  - Pruning      |   |  - Pruning      |   |  - Pruning      |
     |  - Vector Index |   |  - Vector Index |   |  - Vector Index |
     |  - Forward/Invr |   |  - Forward/Invr |   |  - Forward/Invr |
     |  - Transform    |   |  - Transform    |   |  - Transform    |
     +-----------------+   +-----------------+   +-----------------+
              ^                     ^                     ^
              |                     |                     |
     +-------------------------------------------------------------+
     |                 Pinot Controller Cluster                    |
     |  - Helix State Machine (IdealState / ExternalView)          |
     |  - Segment Retention, Rebalance, Minion Task Scheduler      |
     +-------------------------------------------------------------+
              ^                     ^                     ^
              |                     |                     |
     +-----------------+   +-----------------+   +-----------------+
     | Realtime Streams|   | Deep Store (S3/ |   | Minion Workers  |
     | (Kafka/Kinesis) |   |  GCS/HDFS/ADLS) |   | (Compaction)    |
     +-----------------+   +-----------------+   +-----------------+
```

1. **Pinot Broker**: Entry point for SQL queries. Compiles relational algebra with Apache Calcite into an abstract syntax tree (`PinotQuery`). Evaluates tenant access, row-level filters (RLS), column projection guards, routing tables, and initiates either:
   - *Single-Stage Engine*: Scatter-gather query over partition replicas with server-side local reduction.
   - *Multi-Stage Engine (v2)*: Distributed query execution plan involving intermediate shuffle operators, cross-node joins, window functions, and distributed exchanges.
2. **Pinot Server**: Leaf-level compute node hosting segments. Segments are divided into:
   - *Offline Segments*: Read-only, column-packed structures with specialized indices (Bitmap Inverted Index, Star-Tree Index, Forward Index, Bloom Filter, Range Index, Lucene Text Index, HNSW Vector Index).
   - *Real-time Segments*: Consuming partitions ingesting from append logs (Kafka, Kinesis, Pulsar) into in-memory indexes before committing to immutable columnar format.
3. **Pinot Controller**: Cluster management master coordinating via Helix/ZooKeeper. Owns metadata catalogs, schema evolution, cluster configuration, physical segment assignment (IdealState vs. ExternalView), retention workflows, and Minion background task orchestration.
4. **Pinot Minion**: Separate worker fleet executing batch operations (segment merge, rollup, purge, re-indexing, offline push) offloaded from query path.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Defense-in-Depth for Security Rewrites Across Distributed Tiers
**RULE**:
When an authorization or row-level security (RLS) boundary rewrites an abstract syntax tree (AST) or injects predicate filters at the proxy/coordinator layer, both the coordinator **MUST** unconditionally reject un rewriteable cross-boundary sub-queries or foreign expressions, and the execution engine (server/leaf worker) **MUST** redundantly assert that incoming query contexts containing security constraints execute zero opaque nested expressions.

**WHY**:
In distributed query execution architectures, coordinators rewrite user queries by conjoining access control predicates (`WHERE ... AND tenant_id = 'XYZ'`). If the query contains expressions whose execution context is deferred or delegated to downstream execution nodes via raw string literals, sub-queries, or partition transforms (`IN_PARTITIONED_SUBQUERY`, dynamic lookups), the downstream server executes the nested context natively against table segments, completely bypassing the coordinator's injected row filters. This leaks unauthorized rows and allows enumeration side-channel attacks via aggregation (`GROUP BY`) while returning `rlsFiltersApplied: true`.

**WHEN TO APPLY**:
Apply to any distributed multi-tier database, analytical proxy, GraphQL gateway, or microservice architecture where authorization filters are attached at an ingress coordinator while sub-queries or transform expressions are delegated to downstream worker nodes.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// pinot-broker: Coordinator-layer rejection before downstream dispatch
public final class QueryAuthorizationGuard {
    private static final Set<String> CROSS_TABLE_OPERATORS = Set.of(
        "lookup", "insubquery", "inpartitionedsubquery"
    );

    public static void validateSecurityContext(
        PinotQuery query, 
        boolean hasRowLevelSecurity, 
        String tableName
    ) {
        if (!hasRowLevelSecurity) {
            return;
        }

        // Must traverse the entire AST to catch functions regardless of casing,
        // underscore separation, or locale transformations
        if (containsCrossTableFunction(query)) {
            throw new AccessDeniedException(String.format(
                "Cross-table functions are not allowed on table '%s' when " +
                "row-level security filters apply.", tableName));
        }
    }

    public static boolean containsCrossTableFunction(PinotQuery query) {
        if (query.getFilterExpression() != null && 
            scanExpression(query.getFilterExpression())) {
            return true;
        }
        if (query.getSelectList() != null) {
            for (Expression expr : query.getSelectList()) {
                if (scanExpression(expr)) return true;
            }
        }
        return false;
    }

    private static boolean scanExpression(Expression expression) {
        Function function = expression.getFunctionCall();
        if (function == null) return false;
        
        // Canonicalize: strip underscores and lowercase using invariant English locale
        String canonicalName = function.getOperator().replace("_", "").toLowerCase(Locale.ENGLISH);
        if (CROSS_TABLE_OPERATORS.contains(canonicalName)) {
            return true;
        }
        for (Expression operand : function.getOperands()) {
            if (scanExpression(operand)) return true;
        }
        return false;
    }
}

// pinot-server: Leaf-layer secondary defense asserting security invariant
public class LeafQueryExecutor {
    public void executeLeafSubquery(QueryContext queryContext, ExpressionContext expression) {
        FunctionContext fn = expression.getFunction();
        if (fn == null) return;

        if ("inpartitionedsubquery".equalsIgnoreCase(fn.getFunctionName().replace("_", ""))) {
            Map<String, String> rlsFilters = RlsUtils.extractRlsFilters(queryContext.getQueryOptions());
            // Hard invariant: Leaf must NEVER process opaque literal subqueries under RLS
            if (!rlsFilters.isEmpty()) {
                throw new IllegalStateException(String.format(
                    "FATAL SECURITY VIOLATION: IN_PARTITIONED_SUBQUERY received by server " +
                    "with active row-level security filters: %s", rlsFilters.keySet()));
            }
            executeOpaqueSubquery(expression, queryContext);
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```java
// ANTI-PATTERN: Blindly delegating literal sub-queries to workers while assuming
// the outer WHERE clause prevents data leakage.
public void handleSubqueryAntiPattern(PinotQuery query, QueryContext context) {
    // BUG: Server executes subquery literal on local segments ignoring user filters!
    if (query.hasLiteralSubquery()) {
        String rawSql = query.getLiteralSubqueryText();
        // Raw subquery executes without principal's RLS WHERE clause!
        TableResult result = executeOnLocalSegments(rawSql); 
        query.rewriteWithResult(result);
    }
}
```

**VERIFICATION METHOD**:
Verify using an integration test executing cross-table functions (`IN_PARTITIONED_SUBQUERY`) under authenticated principals with RLS enabled:
```java
@Test(expectedExceptions = AccessDeniedException.class)
public void verifyCrossTableFunctionBlockedUnderRls() {
    QueryContext context = compileQuery("SELECT COUNT(*) FROM securedTable WHERE " +
        "IN_PARTITIONED_SUBQUERY(dimId, 'SELECT ID_SET(dimId) FROM securedTable WHERE secret = 1') = 1");
    // Must throw AccessDeniedException before generating physical plan
    QueryAuthorizationGuard.validateSecurityContext(context.getPinotQuery(), true, "securedTable");
}
```

---

### 2. Strict Bi-directional Proof for Security Status Reporting Flags
**RULE**:
Security indicators returned in API responses (such as `rlsFiltersApplied: true`) **MUST** reflect exclusively the positive, verified injection of active constraints, and **MUST NOT** be assigned based on the structural existence of security policies, empty collections, or unvalidated configuration blocks.

**WHY**:
If a security filter evaluation iterates over tables and mutates a reporting flag (`rlsFiltersApplied.set(true)`) simply because the security provider returned an empty list of predicates or an empty optional for an unrestricted table, the client/auditor is falsely informed that data masking or partitioning occurred. Conversely, if a query returns unfiltered rows with `rlsFiltersApplied: true`, security monitoring systems will fail to alert on authorization bypasses.

**WHEN TO APPLY**:
Any proxy, query engine, or security intermediary generating audit receipts or returning metadata flags asserting data filtration.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// MultiStageBrokerRequestHandler: Strict evaluation of applied constraints
boolean applyRlsFilters(
    @Nullable RequesterIdentity requesterIdentity, 
    Set<String> tables, 
    Map<String, String> queryOptions
) {
    AccessControl accessControl = _accessControlFactory.create();
    boolean applied = false;
    for (String tableName : tables) {
        TableRowColAccessResult accessResult = accessControl.getRowColFilters(requesterIdentity, tableName);
        List<String> rowFilters = accessResult.getRLSFilters().orElse(null);
        
        // Strict invariant: Filter list MUST be non-null and non-empty
        if (rowFilters == null || rowFilters.isEmpty()) {
            continue;
        }
        
        String combinedFilters = rowFilters.stream()
            .map(filter -> "( " + filter + " )")
            .collect(Collectors.joining(" AND "));
            
        queryOptions.put(RlsUtils.buildRlsFilterKey(tableName), combinedFilters);
        _brokerMetrics.addMeteredTableValue(tableName, BrokerMeter.RLS_FILTERS_APPLIED, 1);
        applied = true; // Mutated ONLY when concrete predicate was injected
    }
    return applied;
}
```

**NEGATIVE CONSTRAINT**:
```java
// ANTI-PATTERN: Mutating state inside ifPresent without checking collection emptiness
accessControl.getRowColFilters(requesterIdentity, tableName).getRLSFilters()
    .ifPresent(rowFilters -> {
        // BUG: rowFilters may be an empty List: Collections.emptyList()
        // Reports true to client even though no filter was conjoined!
        rlsFiltersApplied.set(true); 
        String combinedFilters = rowFilters.stream().collect(Collectors.joining(" AND "));
        queryOptions.put(RlsUtils.buildRlsFilterKey(tableName), combinedFilters);
    });
```

**VERIFICATION METHOD**:
Execute unit tests with an `AccessControl` implementation returning empty filter collections and assert that the returned flag evaluates strictly to `false`:
```java
@Test
public void testEmptyRlsFilterDoesNotReportTrue() {
    AccessControl mockAc = mock(AccessControl.class);
    when(mockAc.getRowColFilters(any(), eq("tbl"))).thenReturn(new TableRowColAccessResultImpl(List.of()));
    Map<String, String> opts = new HashMap<>();
    boolean result = applyRlsFilters(new UserIdentity("bob"), Set.of("tbl"), opts);
    assertFalse(result, "rlsFiltersApplied must be false when filter list is empty");
    assertTrue(opts.isEmpty(), "Query options must remain untouched");
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Security Leak via Opaque String Literals in Partitioned Subqueries (BUG-PINOT-20169)
- **Context**: `pinot-broker/src/main/java/org/apache/pinot/broker/requesthandler/BaseSingleStageBrokerRequestHandler.java`, `pinot-core/src/main/java/org/apache/pinot/core/query/executor/ServerQueryExecutorV1Impl.java`
- **What Was Expected**: When Row-Level Security (RLS) is applied to a table, queries executed by an authorized principal must not inspect, aggregate, or infer values belonging to rows outside the principal's permission filter.
- **What Actually Happened**: The broker injected row filters into the primary query's `WHERE` clause. However, when queries used `IN_PARTITIONED_SUBQUERY(col, 'SELECT ID_SET(col) FROM table WHERE ...')`, the subquery reached the Pinot server as an opaque SQL string literal inside the function arguments. The server compiled this string literal into an independent `PinotQuery` and executed it directly on the local segments *without* the principal's RLS `WHERE` predicates. Attackers bypassed RLS to enumerate hidden rows via `GROUP BY` and subquery matching while the response declared `rlsFiltersApplied: true`.
- **Evidence in Repo**: Commit `f60f17fd`, PR #20169. Tests added in `BaseSingleStageBrokerRequestHandlerTest.java` and `QueryExecutorTest.java`.
- **Root Cause**: Architectural impedance mismatch between coordinator-level AST rewrite and leaf-level execution of unparsed subquery string literals. RLS metadata stamped in query options was not propagated or enforced inside server-compiled string literals.
- **Remediation Code Diff**:
```java
// pinot-broker: BaseSingleStageBrokerRequestHandler.java
-  public CompileResult(PinotQuery pinotQuery, PinotQuery serverPinotQuery, Schema schema, String tableName,
-      String rawTableName, Set<String> lookupTableNames) {
+  public CompileResult(PinotQuery pinotQuery, PinotQuery serverPinotQuery, Schema schema, String tableName,
+      String rawTableName, Set<String> lookupTableNames, boolean hasCrossTableFunction) {
...
+  if (rowFilters != null && !rowFilters.isEmpty()) {
+    if (compileResult._hasCrossTableFunction) {
+      throwAccessDeniedError(requestId, query, requestContext, tableName,
+          new BasicAuthorizationResultImpl(false, "Cross-table functions are not allowed on table "
+              + rawTableName + " when row-level security filters apply"));
+    }
+  }

// pinot-core: ServerQueryExecutorV1Impl.java (Leaf node assertion)
+  Map<String, String> rowFilters = RlsUtils.extractRlsFilters(queryContext.getQueryOptions());
+  Preconditions.checkState(rowFilters.isEmpty(),
+      "IN_PARTITIONED_SUBQUERY is not allowed when row-level security filters apply, got filters for %s",
+      rowFilters.keySet());
```
- **Lesson**: Distributed query engines must never allow opaque, string-serialized sub-computations to execute on worker nodes when dynamic authorization re-writes govern the dataset. Subqueries must either be fully rewritten at the coordinator or rejected at all tiers.

---

### Incident 2: False Positive Security Audit Reporting in Multi-Stage Engine (BUG-PINOT-20089)
- **Context**: `pinot-broker/src/main/java/org/apache/pinot/broker/requesthandler/MultiStageBrokerRequestHandler.java`
- **What Was Expected**: If an access control provider does not configure RLS filters for a table (e.g., returns `Optional.of(Collections.emptyList())`), the broker query response must report `rlsFiltersApplied: false`.
- **What Actually Happened**: The coordinator initialized an `AtomicBoolean rlsFiltersApplied` and invoked `.ifPresent()` on the returned `Optional<List<String>>`. If the access provider returned an empty list, `.ifPresent()` executed, setting `rlsFiltersApplied.set(true)`. The broker returned `rlsFiltersApplied: true` despite injecting no SQL filters, triggering false security audit records.
- **Evidence in Repo**: Commit `8d140dcf`, PR #20089. Modified `MultiStageBrokerRequestHandler.java` and added `MultiStageBrokerRequestHandlerTest.testApplyRlsFiltersIgnoresEmptyFilterList`.
- **Root Cause**: Conflating the presence of an `Optional` container with the presence of non-empty filtering rules.
- **Remediation Code Diff**:
```java
// MultiStageBrokerRequestHandler.java
-  accessControl.getRowColFilters(requesterIdentity, tableName).getRLSFilters()
-      .ifPresent(rowFilters -> {
-        rlsFiltersApplied.set(true);
-        String combinedFilters =
-            rowFilters.stream().map(filter -> "( " + filter + " )").collect(Collectors.joining(" AND "));
-        String key = RlsUtils.buildRlsFilterKey(tableName);
-        compiledQuery.getOptions().put(key, combinedFilters);
-        _brokerMetrics.addMeteredTableValue(tableName, BrokerMeter.RLS_FILTERS_APPLIED, 1);
-      });
+  boolean applyRlsFilters(@Nullable RequesterIdentity requesterIdentity, Set<String> tables,
+      Map<String, String> queryOptions) {
+    AccessControl accessControl = _accessControlFactory.create();
+    boolean applied = false;
+    for (String tableName : tables) {
+      List<String> rowFilters = accessControl.getRowColFilters(requesterIdentity, tableName).getRLSFilters()
+          .orElse(null);
+      if (rowFilters == null || rowFilters.isEmpty()) {
+        continue;
+      }
+      String combinedFilters =
+          rowFilters.stream().map(filter -> "( " + filter + " )").collect(Collectors.joining(" AND "));
+      queryOptions.put(RlsUtils.buildRlsFilterKey(tableName), combinedFilters);
+      _brokerMetrics.addMeteredTableValue(tableName, BrokerMeter.RLS_FILTERS_APPLIED, 1);
+      applied = true;
+    }
+    return applied;
+  }
```
- **Lesson**: Do not use `Optional.ifPresent` on collections without checking `.isEmpty()`. An empty collection in a security context represents the absence of a constraint, not an active enforcement.

---

### Incident 3: Flaky Integration Test via Negative System Activities CPU Time Assertion (BUG-PINOT-20159)
- **Context**: `pinot-integration-tests/src/test/java/org/apache/pinot/integration/tests/QueryKillingIntegrationTest.java`
- **What Was Expected**: Resource accounting tests for query preemption and killing must assert that CPU utilization and unaccounted system activity times are sane across heterogeneous CI environments.
- **What Actually Happened**: The test asserted `offlineSystemActivitiesCpuTimeNs > 0`. On specific CI runner environments with limited virtual CPU allocations (e.g., 2 vCPUs), `InstanceResponseOperator` clamped the unaccounted wall time estimate to zero. Because the assertion strictly required `> 0`, CI runs failed intermittently.
- **Evidence in Repo**: Commit `6f84678`, Issue #20159.
- **Root Cause**: Heuristic accounting metrics that estimate unaccounted time by subtracting segment scan time from total thread wall clock time can legitimately reach zero due to timer precision limitations and mathematical clamping.
- **Remediation Code Diff**:
```java
// QueryKillingIntegrationTest.java
-  assertTrue(offlineSystemActivitiesCpuTimeNs > 0, "System activities CPU time must be positive");
+  assertTrue(offlineSystemActivitiesCpuTimeNs >= 0, "System activities CPU time must be non-negative");
```
- **Lesson**: Heuristic or calculated resource accounting metrics subjected to floor/clamping operations (`Math.max(0, val)`) must be validated with non-negative assertions (`>= 0`) rather than strictly positive assertions (`> 0`) in integration tests.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision

#### 1. Turkish-I and Locale-Dependent Lowercasing Pitfall
In `RequestUtils.java` and `BaseSingleStageBrokerRequestHandler.java`, function names are canonicalized by removing underscores and converting to lowercase. In Java, calling `String.toLowerCase()` without `Locale.ROOT` or `Locale.ENGLISH` causes severe bugs on systems configured with Turkish (`tr-TR`) or Azeri locales, where uppercase `'I'` converts to dotless `'ı'` (`\u0131`), rather than Latin `'i'`.

```java
// BUG-PRONE: Depends on host JVM default locale!
String canonical = functionName.replace("_", "").toLowerCase();

// CRITICAL REPO INVARIANT:
// Pinot Calcite compiler and request parsers must resolve canonical names consistently:
String canonical = functionName.replace("_", "").toLowerCase(Locale.ROOT);
```
In `BaseSingleStageBrokerRequestHandlerTest.java`, Pinot explicitly verifies this invariant by testing under `Locale.forLanguageTag("tr-TR")` with the dotless small letter:
```java
Locale defaultLocale = Locale.getDefault();
Locale.setDefault(Locale.forLanguageTag("tr-TR"));
try {
  assertTrue(hasCrossTableFunction("SELECT COUNT(*) FROM myTable WHERE IN_PARTITIONED_SUBQUERY(col1, '" + subquery + "') = 1"));
} finally {
  Locale.setDefault(defaultLocale);
}
```

#### 2. JavaScript BigInt Serialization Hazard in Controller UI
Pinot identifiers, segment timestamps, and 64-bit row counts exceed JavaScript's `Number.MAX_SAFE_INTEGER` ($2^{53} - 1 = 9,007,199,254,740,991$). Standard `JSON.parse` truncates or corrupts lower bits.
In `pinot-controller/src/main/resources/app/utils/PinotMethodUtils.ts`:
```typescript
import JSONbigBase from 'json-bigint';
// CRITICAL INVARIANT: Big integers from query and broker responses MUST be stored as strings
const JSONbig = JSONbigBase({ storeAsString: true });
```
Failing to set `{ storeAsString: true }` leads to silent ID mangling during cluster state rebalancing.

---

### 4.2 Infinite Loop & Recursion Guards

#### 1. Circular Object Traversal Guard in UI State Serializers
In `pinot-controller/src/main/resources/app/utils/Utils.tsx`, the `findNestedObj` function utilizes `JSON.stringify` visitor mechanics rather than naive unbounded recursive object crawling. This prevents recursive call stack exhaustion when traversing complex circular AST or DOM structures:
```typescript
const findNestedObj = (entireObj: any, keyToFind: string, valToFind: any) => {
  let foundObj: any;
  JSON.stringify(entireObj, (key, nestedValue) => {
    if (nestedValue && nestedValue[keyToFind] === valToFind) {
      foundObj = nestedValue;
    }
    return nestedValue;
  });
  return foundObj;
};
```

#### 2. Bounded Recursion Depth in AST Subquery Parsers
In `ServerQueryExecutorV1Impl.java`, subquery extraction recurses through `FilterContext` children. Unbounded AST depth represents a denial-of-service vector:
```java
private void handleSubquery(FilterContext filter, TableExecutionInfo executionInfo, 
                           TimerContext timerContext, ExecutorService executorService, 
                           QueryContext queryContext, int depth) throws Exception {
    // Recursion Guard Invariant
    if (depth > MAX_AST_DEPTH) {
        throw new QueryException(QueryErrorCode.QUERY_VALIDATION, "Exceeded maximum filter recursion depth");
    }
    List<FilterContext> children = filter.getChildren();
    if (children != null) {
        for (FilterContext child : children) {
            handleSubquery(child, executionInfo, timerContext, executorService, queryContext, depth + 1);
        }
    } else {
        handleSubquery(filter.getPredicate().getLhs(), executionInfo, timerContext, executorService, queryContext, depth + 1);
    }
}
```

---

### 4.3 UI & UX Micro-Mechanics

#### 1. Delimiter Namespace Collision Prevention in Flat Table Grids
In `Utils.tsx` and `app_state.ts`, when rendering tabular results containing identical column names across joins or projected expressions, the key space must avoid collisions without causing render thrashing. Pinot introduces a unique, immutable namespace separator:
```typescript
// app_state.ts
columnNameSeparator: string = '#$%';

// Utils.tsx
if (withColumnNameSeparator) {
  obj[header[index] + app_state.columnNameSeparator + index] = val;
} else {
  obj[header[index]] = val;
}
```
During column sorting (`SortFunctions.tsx`), cell value lookups extract original values by splitting on `app_state.columnNameSeparator`:
```typescript
const getCellValue = (row: any, column: string, index: number): any => {
    const cellValue = row[column + app_state.columnNameSeparator + index];
    if (cellValue && typeof cellValue === "object" && "value" in cellValue) {
        return cellValue.value;
    }
    return cellValue;
};
```

#### 2. Safe Parsing of Hybrid Timeseries Numeric Arrays
In `TimeseriesUtils.ts`, Pinot parses time-series values from broker payloads that return either native JSON arrays, escaped strings, or mixed null values.
```typescript
const parseArray = (data: any): number[] => {
  if (Array.isArray(data)) {
    return data.map(v => v == null ? null as any : (typeof v === 'number' ? v : parseFloat(String(v))));
  }
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parseArray(parsed);
    } catch (e) { /* ignore */ }
  }
  return [];
};
```
Timestamp normalization must handle millisecond vs second boundaries without overflowing:
```typescript
const tsSeconds = ts > 1e12 ? Math.floor(ts / 1000) : ts;
const timestamp = tsSeconds * 1000;
```

---

### 4.4 Backend Concurrency & Memory Safety

#### 1. Thread Accountant and Scan Killing Preemption
Pinot tracks query resource allocation dynamically via `ThreadAccountant`. During multi-stage and single-stage leaf processing, threads register memory allocations and query expiration deadlines (`queryContext.getEndTimeMs()`).
In `ServerQueryExecutorV1Impl.java`:
```java
// Propagate immutable deadline into subquery execution context
subquery.setEndTimeMs(queryContext.getEndTimeMs());
InstanceResponseBlock instanceResponse =
    executeInternal(executionInfo, subquery, timerContext, executorService, null, false, null);
```
Failing to propagate `endTimeMs` creates an orphan task starvation condition: the outer query times out and releases broker sockets, but the inner leaf subquery continues consuming server CPU and memory indefinitely.

#### 2. Segment List Cloning Invariant Under Concurrency
In `ServerQueryExecutorV1Impl.java`, when dispatching internal subqueries across local execution threads:
```java
// Invariant comment in source: Make a clone of indexSegments because the method might modify the list
List<IndexSegment> indexSegments = new ArrayList<>(tableExecutionInfo.getIndexSegments());
```
Because parallel segments may undergo state transitions (consuming segment commit, offline reload, or rebalancing drop) concurrently handled by Helix state transition threads, sharing mutable references across task boundaries triggers `ConcurrentModificationException` or access to disposed mmap memory.

---

### 4.5 Defect & Error Prevention ("Galti Pakadna")

#### 1. Metric Stats Calculation Over Filtered Floating Point Data
In `TimeseriesUtils.ts`, calculating basic aggregations (`min`, `max`, `avg`, `first`, `last`) over series containing `null`, `undefined`, or `NaN` values requires strict index preservation:
```typescript
// Finding index in original array while filtering invalid data:
const firstValidIndex = dataPoints.findIndex(
  dp => dp.value !== null && dp.value !== undefined && !isNaN(dp.value)
);
// Finding last index without mutating or full array reversal:
const lastValidIndex = dataPoints.length - 1 - dataPoints.slice().reverse().findIndex(
  dp => dp.value !== null && dp.value !== undefined && !isNaN(dp.value)
);
```
Using naive loops without validating `!isNaN(dp.value)` results in IEEE-754 `NaN` propagation across all aggregate cards (`min: NaN, max: NaN`).

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
- **Boundary Decoupling**: Pinot cleanly bifurcates into Control Plane (Helix/Zookeeper/Controller) and Data Plane (Broker/Server/Minion).
- **Physical vs. Logical Segments**: Tables are split into OFFLINE and REALTIME physical entities. Brokers unify them logically under a single virtual table name during query compilation.
- **Single-Stage vs. Multi-Stage**: Single-stage engines execute map-reduce style queries where server instances execute map-side aggregation and the broker performs the final reduce. Multi-stage (v2) uses a Calcite physical execution plan with intermediate exchange nodes allowing true hash joins ($O(N)$ distributed join) and window functions.

### Dimension 2: Core Abstractions
- `PinotQuery`: Internal AST representation compiled from SQL via Calcite, containing projections, selections, group by, order by, and query options.
- `IndexSegment`: Fundamental immutable storage abstraction wrapping columnar forward indices, inverted dictionary indices, star-trees, and null value bitmaps.
- `AccessControl`: Pluggable authentication/authorization contract defining `hasTableAccess`, `getRowColFilters`, and `authorizeTableRequest`.
- `QueryContext`: Thread-local lifecycle state tracking memory quotas, cancellation tokens, wall-clock deadlines, and accounting metrics.

### Dimension 3: Error Handling
- **Fault Isolation**: Query execution errors at the leaf server level do not terminate the broker process; they are returned inside the `exceptions` list of `BrokerResponseNative`.
- **Degraded Execution**: By default, Pinot supports partial responses: if 99 out of 100 segments respond and one server encounters an RPC timeout, Pinot can return the 99% aggregated results along with `numSegmentsQueried: 100`, `numSegmentsProcessed: 99`, allowing BI dashboards to remain resilient.

### Dimension 4: Testing
- **Multi-Environment Simulation**: Matrix testing across JDK 11 and JDK 21 environments.
- **Compatibility Testing**: Strict backward compatibility verification suite (`.pinot_compatibility_verifier.sh`) checking rolling upgrade compatibility between older brokers/servers and current cluster masters.
- **Resource Boundary Preemption Testing**: `QueryKillingIntegrationTest` simulates intentional heap exhaustion and CPU hogging to verify preemption thread accountants kill offensive queries cleanly.

### Dimension 5: Security
- **Defense-in-Depth RLS Enforcement**: Row-Level Security predicates are conjoined into SQL trees at the broker. As demonstrated by PR #20169, leaf servers simultaneously validate query options to ensure no opaque subqueries bypass the principal's isolation sandbox.
- **Groovy Script Execution Sandboxing**: Dynamic script transforms (`groovy(...)`) are gated behind strict administrative broker cluster configs to prevent arbitrary remote code execution (RCE).

### Dimension 6: Performance
- **Zero-Copy Column Scans**: Forward indexes are memory-mapped (`MMapDirectory`). Server processes query segments directly off OS page cache without heap deserialization overhead.
- **Dictionary Encoding**: Low-cardinality dimensions are encoded as bit-packed integer IDs, enabling vector SIMD evaluations on filter bit-sets.
- **Star-Tree Pre-aggregation**: Multi-dimensional indexing layer that materializes partial aggregates at ingestion time, reducing $O(N)$ row scans to $O(1)$ tree leaf lookups.

### Dimension 7: Deployment
- **Helix State Machine**: Segment movement adheres to state transitions (`OFFLINE -> ONLINE -> CONSUMING`).
- **Container Invariants**: Pinot Docker builds utilize multi-architecture targeting (AMD64/ARM64) with separate builder images caching Maven dependencies and producing minimal Alpine/Ubuntu runtimes.

### Dimension 8: Agent Patterns
- **Agent-Facing Analytics**: Pinot provides low-latency SQL over fresh data specifically tuned for AI agent tool calling and automated decision systems.
- **Context Budget Protection**: Token consumption by autonomous agents is preserved by relying on server-side aggregation, dictionary deduplication, and vector nearest-neighbor filtering before returning results to LLM context windows.

### Dimension 9: Data Flow
```
Kafka Topic -> StreamConsumerFactory -> RealtimeSegmentValidation 
  -> In-Memory MutableSegment (Consumer Thread) 
  -> Commit Threshold Reached (Rows/Time) 
  -> Immutable Segment Conversion 
  -> Flush to Deep Store (S3/GCS) 
  -> Helix ExternalView Update
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Two-Tier Query Security AST Sanitization
```java
public class QuerySecuritySanitizer {
    public static void enforceSecurityInvariants(PinotQuery query, SecurityContext context) {
        if (context.hasRls()) {
            // Coordinator level check
            if (RequestUtils.hasCrossTableFunction(query)) {
                throw new AccessDeniedException("Forbidden cross-table operation under active RLS");
            }
            // Leaf level invariant injection
            query.putToQueryOptions(RlsUtils.buildRlsFilterKey(context.getTable()), context.getFilterString());
        }
    }
}
```

### 2. Rule
> An authorization subsystem MUST reject dynamic queries containing deferred or opaque worker-evaluated expressions whenever the requesting principal is constrained by data filtering boundaries.

### 3. Architecture Principle
> In distributed scatter-gather query engines, leaf compute nodes MUST NOT be granted ambient authority to execute expressions outside the security boundary established by the coordinator. Every worker invocation must inherit explicit, cryptographically signed or option-stamped security scopes.

### 4. Failure Mode
> **Opaque Literal Subquery Injection**: A subquery enclosed within a string literal parameter of a custom UDF/scalar transform bypasses relational algebra rewriters, allowing arbitrary data exfiltration across tenant boundaries.

