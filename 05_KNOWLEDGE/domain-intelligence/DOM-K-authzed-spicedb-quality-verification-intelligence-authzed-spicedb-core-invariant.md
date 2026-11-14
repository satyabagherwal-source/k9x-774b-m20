# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: authzed/spicedb Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "authzed/spicedb",
  "source_url": "https://github.com/authzed/spicedb",
  "source_version": "558b84d7",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T05:07:01.859Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-authzed-spicedb",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [authzed/spicedb](https://github.com/authzed/spicedb) (Revision: `558b84d7`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T05:07:01.859Z`  
> **Learning ID**: `learn-github-authzed-spicedb`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), A (Human & Need Intelligence), G (Architecture Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), L (Deployment & Operations Intelligence), D (Research & Knowledge Intelligence)
- **Confidence Rating**: 65%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from authzed/spicedb:

# Project Learning Record (Full-Spectrum Forensic Harvest): authzed/spicedb

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
`authzed/spicedb` implements Google Zanzibar-style distributed Relationship-Based Access Control (ReBAC) and Attribute-Based Access Control (ABAC) via fine-grained caveats. The core problem it solves is sub-millisecond evaluation of recursive authorization graphs (e.g., `user:alice can view document:budget` through nested group memberships, inheritance hierarchies, dynamic caveat evaluations, and intersection/exclusion set operations) over massive, globally distributed relational datastores without stale read anomalies or lock contention.

### Architectural Subsystem Boundaries
The engine operates across five primary layers:

```
                  +----------------------------------------------+
                  |               gRPC / HTTP API                |
                  |     (v1 Permissions, Experimental, FDW)      |
                  +----------------------------------------------+
                                         |
                                         v
                  +----------------------------------------------+
                  |         Dispatch & Execution Planner         |
                  |  - Graph Engine (classic tree traversal)     |
                  |  - Query Planner (compiled iterator outline) |
                  +----------------------------------------------+
                                         |
                    +--------------------+--------------------+
                    |                                         |
                    v                                         v
+---------------------------------------+   +------------------------------------+
|          Caveat CEL Engine            |   |          Namespace Engine          |
|  (Dynamic expressions, partial eval)  |   | (Schema definitions, type systems) |
+---------------------------------------+   +------------------------------------+
                    |                                         |
                    +--------------------+--------------------+
                                         |
                                         v
                  +----------------------------------------------+
                  |                  Data Layer                  |
                  |   (Snapshot reader, MVCC revisions, caches)  |
                  +----------------------------------------------+
                                         |
                                         v
                  +----------------------------------------------+
                  |              Datastore Drivers               |
                  |  (CockroachDB, PostgreSQL, Spanner, MySQL)   |
                  +----------------------------------------------+
```

1. **gRPC / Protocol Layer (`internal/services/v1`, `internal/fdw`)**: Handles ingress gRPC queries, wire validations, connection pooling, protovalidator caching, and experimental Foreign Data Wrapper (FDW) wire emulation for PostgreSQL.
2. **Dispatch & Execution Planner (`internal/dispatch`, `internal/graph`, `pkg/query`)**: Decomposes complex graph checks into concurrent dispatch trees (`classicEngine`) or compiled execution outlines (`plannerEngine`). Resolves depth caps, chunking, deduplication, and memoization via distributed dispatchers.
3. **Caveat CEL Engine (`internal/caveats`, `pkg/caveats`)**: Evaluates dynamic context attributes compiled down to Common Expression Language (CEL). Handles partial evaluation: if variables are missing from context, it returns `Conditional` outcome alongside an ordered set of missing variables.
4. **Namespace / Schema Engine (`internal/namespace`, `pkg/schema/v2`)**: Maintains type safety, relation definitions, permissions graphs, allowed direct relations, and schema hashes across revisions.
5. **Datastore & DataLayer (`pkg/datalayer`, `internal/datastore/*`)**: Abstracts multi-version concurrency control (MVCC) transactional snapshots. Implements deterministic index selection for relational storage engines (CockroachDB, PostgreSQL, Google Cloud Spanner, MySQL).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Zero-Allocation Parallel Fixture Synthesis
**RULE**:
Test fixtures generating repetitive domain primitives (e.g., tuples, relationships, foreign keys) exceeding $10^3$ elements MUST construct internal memory structs directly instead of invoking string parsing or string formatting engines (`fmt.Sprintf`), and tests sharing immutable snapshot data MUST parallelize subtests across a single pre-loaded instance.

**WHY**:
Parsing strings under the Go race detector (`-race`) or memory tracking hooks incurs dynamic heap allocations, string-to-byte copies, and regex/lexer overhead that scales quadratically with test volume. In `internal/dispatch/graph/dispatch_test.go`, generating 131,072 tuples via `tuple.MustParse(fmt.Sprintf(...))` took more CPU time than the entire graph resolution algorithm itself, saturating CI runner memory and stalling parallel test workers.

**WHEN TO APPLY**:
Applies to any test suite constructing datasets $> 1,000$ records, particularly in distributed systems, search indexes, or compiler abstract syntax tree (AST) testing.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Direct struct initialization avoids lexing, string allocations, and memory churn
resources := make([]tuple.Relationship, 0, count)
for i := range count {
    userID := "user" + strconv.Itoa(i) // Avoid fmt.Sprintf
    resources = append(resources, tuple.Relationship{
        RelationshipReference: tuple.RelationshipReference{
            Resource: tuple.ObjectAndRelation{
                ObjectType: "res",
                ObjectID:   "res1",
                Relation:   "owner",
            },
            Subject: tuple.ObjectAndRelation{
                ObjectType: "user",
                ObjectID:   userID,
                Relation:   graph.Ellipsis,
            },
        },
    })
}
```

**NEGATIVE CONSTRAINT**:
```go
// NEVER parse serialized domain representations in hot loops or test fixtures
resources := make([]tuple.Relationship, 0, count)
for i := 0; i < count; i++ {
    // ANTI-PATTERN: fmt.Sprintf allocates; MustParse invokes full tokenizer & AST validation
    rel := tuple.MustParse(fmt.Sprintf("res:res1#owner@user:user%d", i))
    resources = append(resources, rel)
}
```

**VERIFICATION METHOD**:
Enforce memory and CPU benchmarks in CI:
```bash
go test -race -benchmem -run=^$ -bench=^BenchmarkFixtureGeneration ./...
```
Assert that allocated bytes per operation (`B/op`) remain zero or near zero, and enforce strict execution lints prohibiting `fmt.Sprintf` inside batch test loops.

---

### 2. Deterministic Drop-Before-Create Concurrent Index DDL
**RULE**:
When generating or applying concurrent database schema migrations (such as PostgreSQL `CREATE INDEX CONCURRENTLY`), the migration driver MUST explicitly execute a `DROP INDEX CONCURRENTLY IF EXISTS` prior to creation and MUST NOT rely on `IF NOT EXISTS` syntax.

**WHY**:
PostgreSQL's `CREATE INDEX CONCURRENTLY IF NOT EXISTS` is not atomic. If a prior attempt failed midway due to a statement timeout, deadlock, or network termination, PostgreSQL marks the index catalog entry as `INVALID` (`indisvalid = false`). Subsequent runs with `IF NOT EXISTS` silently skip the step, leaving behind a broken, un-queried, yet write-penalized invalid index that corrupts future query execution plans.

**WHEN TO APPLY**:
All automated database migrations running in multi-tenant or cloud-native relational databases supporting online/concurrent DDL (e.g., PostgreSQL, CockroachDB).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
func CreateIndexConcurrently(ctx context.Context, conn execer, index common.IndexDefinition) error {
    // 1. Explicitly clean up any preceding invalid or partial index
    dropIndexSQL := fmt.Sprintf("DROP INDEX CONCURRENTLY IF EXISTS %s;", index.Name)
    if _, err := conn.Exec(ctx, dropIndexSQL); err != nil {
        if pgxcommon.IsQueryCanceledError(err) {
            return fmt.Errorf("timeout dropping index %s: %w", index.Name, err)
        }
        return fmt.Errorf("failed dropping index %s: %w", index.Name, err)
    }

    // 2. Safely create index from scratch
    createIndexSQL := fmt.Sprintf("CREATE INDEX CONCURRENTLY %s ON %s;", index.Name, index.ColumnsSQL)
    if _, err := conn.Exec(ctx, createIndexSQL); err != nil {
        if pgxcommon.IsQueryCanceledError(err) {
            return fmt.Errorf("timeout creating index %s: %w", index.Name, err)
        }
        return fmt.Errorf("failed creating index %s: %w", index.Name, err)
    }
    return nil
}
```

**NEGATIVE CONSTRAINT**:
```sql
-- ANTI-PATTERN: If this fails midway, the index exists in an invalid state.
-- Future runs will see it exists, skip creation, and leave queries unindexed.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_relationship_lookup 
ON relation_tuple (namespace, object_id, relation);
```

**VERIFICATION METHOD**:
Verify using PostgreSQL system catalogs in migration integration suites:
```sql
SELECT indexrelid::regclass, indisvalid 
FROM pg_index 
WHERE indisvalid = false;
```
The test suite MUST fail if any row is returned.

---

### 3. Prefix-Boundary Query Index Termination Contract
**RULE**:
In composite relational index matching engines, whenever an equality query filter transitions to a prefix, range, or slice match on a column (e.g., `OptionalResourceIDPrefix`), the index optimizer MUST immediately terminate matching across any subsequent index columns (`columnFilterStop`).

**WHY**:
B-Tree indexes cannot perform efficient point lookups on column $N+1$ if column $N$ is filtered via a range or prefix predicate (`LIKE 'prefix%'`). If the matching engine counts trailing columns as active matches, it generates forced index hints or query planner overrides that cause full-index range scans, degrading query latency from $O(\log N)$ to $O(M)$.

**WHEN TO APPLY**:
Custom query planners, SQL generator layers, and relational indexing adapters (such as CockroachDB forced indexing algorithms).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
case columnFilterStop:
    // Prefix scan detected: no subsequent index columns may be leveraged
    allowAdditionalColumns = false
    if columnIndex > lastMatchingColIndex+1 {
        return doesNotMatch, nil // Gap in index column matching
    }
    lastMatchingColIndex = columnIndex

case columnFilterMatch:
    // Disallow matches if a prior prefix scan halted column progression
    if !allowAdditionalColumns {
        return doesNotMatch, nil
    }
    if columnIndex > lastMatchingColIndex+1 {
        return doesNotMatch, nil
    }
    lastMatchingColIndex = columnIndex
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Blindly matching subsequent columns when earlier column is prefix-bound
if filter.OptionalResourceIDPrefix != "" {
    // Treating prefix as a normal match allows the loop to continue
    // and match userset_namespace, leading to invalid index forcing!
    matchedColumns++
}
```

**VERIFICATION METHOD**:
Unit test composite index selection by supplying a filter with a prefix constraint and verifying that the index matcher ignores all subsequent columns.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Test Suite Thread Contention & Fixture Allocation Bottleneck (BUG-TEST-01)
- **Context**: `internal/dispatch/graph/dispatch_test.go`, `lookupresources2_test.go`, `lookupresources3_test.go`
- **What Was Expected**: Fast unit test execution across graph dispatch and lookup components within standard CI pipeline timeouts ($< 2$ minutes).
- **What Actually Happened**: The `internal/dispatch/graph` and `internal/services/v1` unit test jobs consumed nearly 7 minutes of wall-clock time. Parsing test strings inside loops under Go's race detector saturated the CPU. Subtests ran serially and created independent datastores repeatedly for read-only test cases.
- **Evidence in Repo**: Commit SHA `558b84d7`, PR #3485.
- **Root Cause**:
  1. `TestDispatchChunking` initialized 131,072 tuples using `tuple.MustParse(fmt.Sprintf(...))`. Under `-race`, string parsing and memory allocations consumed more CPU time than the code under test.
  2. `LookupResources2/3` test cases recreated the read-only memory datastore for every permutation of `pageSize` (`[0, 104, 1023]`), performing redundant table initialization and tuple insertion.
  3. Tests did not declare `t.Parallel()`.
- **Remediation Code Diff**:
```go
// internal/dispatch/graph/dispatch_test.go
-	for i := range math.MaxUint16 + 1 {
-		resources = append(resources, tuple.MustParse(fmt.Sprintf("res:res1#owner@user:user%d", i)))
-		enabled = append(enabled, tuple.MustParse(fmt.Sprintf("user:user%d#its_a_me@user:user%d", i, i)))
+	t.Parallel()
+	for i := range math.MaxUint16 + 1 {
+		userID := "user" + strconv.Itoa(i)
+		resources = append(resources, tuple.Relationship{
+			RelationshipReference: tuple.RelationshipReference{
+				Resource: ONR("res", "res1", "owner"),
+				Subject:  ONR("user", userID, graph.Ellipsis),
+			},
+		})
+		enabled = append(enabled, tuple.Relationship{
+			RelationshipReference: tuple.RelationshipReference{
+				Resource: ONR("user", userID, "its_a_me"),
+				Subject:  ONR("user", userID, graph.Ellipsis),
+			},
+		})
 	}
```
- **Lesson**: Parsing formatted text representations in performance test harnesses creates an allocation bottleneck that distorts profiling. Domain primitives should be instantiated directly as structs, and read-only fixtures must be shared across concurrent subtests.

---

### Incident 2: CI Failure Cascades from Upstream EOL Base Image Discontinuation (BUG-CI-02)
- **Context**: PostgreSQL datastore integration harness, `.github/workflows/build-test.yaml`
- **What Was Expected**: Automated CI integration matrix tests against supported database backends run predictably on all PR branches.
- **What Actually Happened**: CI failed prior to executing tests with the error:
  ```text
  create container: Error response from daemon: No such image: mirror.gcr.io/library/postgres:14
  ```
- **Evidence in Repo**: PR #3486, Commit referencing `chore(postgres): drop PostgreSQL 14 from the test matrix`.
- **Root Cause**: Upstream mirror registries deleted the obsolete PostgreSQL 14 image immediately upon its official End Of Life (EOL) date (November 12, 2026). SpiceDB's test matrix still referenced version 14.
- **Remediation Code Diff**:
```go
// internal/datastore/postgres/postgres.go / test matrix
- MinimumSupportedPostgresVersion = 14
+ MinimumSupportedPostgresVersion = 15
// Removed '14' from postgres, pgbouncer, and consistency test matrices in CI configuration
```
- **Lesson**: Relying on unpinned rolling tags from external container mirrors creates hard CI failures when upstream images are deprecated. Maintain strict synchronization between project support lifecycles and CI test matrices.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **Zero Allocations in Integer Conversion**: Avoid `fmt.Sprintf("%d", i)` in high-throughput paths; use `strconv.Itoa(i)` or write directly into byte buffers via `strconv.AppendInt`.
* **String Sanitization in SQL / JSON Boundaries**: When rendering portable offline reports (as seen in `render.py`), raw JSON strings embedded into HTML `<script>` tags MUST escape HTML-sensitive characters (`<`, `>`, `&`) using explicit unicode escapes to prevent XSS and template injection:
  ```python
  def safe_json(data):
      return (
          json.dumps(data, separators=(",", ":"), allow_nan=False)
          .replace("<", "\\u003c")
          .replace(">", "\\u003e")
          .replace("&", "\\u0026")
      )
  ```
* **Strict Type Assertion Guarantees**: When interrogating dynamic protobuf descriptors in `inputMessagesForService`:
  ```go
  desc, err := protoregistry.GlobalFiles.FindDescriptorByName(...)
  if err != nil {
      return nil
  }
  svcDesc := desc.(protoreflect.ServiceDescriptor) // Panics if not verified; must check nil or ok
  ```
  Production code must enforce strict interface-check idioms (`svcDesc, ok := desc.(protoreflect.ServiceDescriptor)`) to prevent unhandled panics on malformed protobuf registries.

### 2. Infinite Loop & Recursion Guards
* **Recursion Depth Caps in Graph Traversal**: Both classic and planner engines enforce strict recursion ceilings via context flags:
  ```go
  query.WithMaxRecursionDepth(c.QPDepth)
  ```
  The depth is decremented at every graph expansion node. When `depth <= 0`, graph resolution terminates with `ErrMaxDepthExceeded`.
* **Iterator Termination Guarantees**: In `internal/fdw/util.go`:
  ```go
  func mustFirst[T any](slice iter.Seq[T]) T {
      for v := range slice {
          return v
      }
      panic("mustFirst: slice is empty")
  }
  ```
  Iterators using Go's `iter.Seq` pattern MUST guarantee loop termination by returning on the first element, or explicitly handling an empty sequence to prevent hung iteration routines.

### 3. UI & UX Micro-Mechanics (LSP & Report Generation)
* **Stdio Protocol Sanitation**: In Language Server Protocol (`internal/lsp/util.go`) implementations, handling raw `os.Stdin` and `os.Stdout` requires an atomic `ReadWriteCloser` wrapper that closes both descriptors cleanly without deadlocking client RPC channels:
  ```go
  type stdrwc struct{}
  func (stdrwc) Read(p []byte) (int, error)  { return os.Stdin.Read(p) }
  func (stdrwc) Write(p []byte) (int, error) { return os.Stdout.Write(p) }
  func (stdrwc) Close() error {
      if err := os.Stdin.Close(); err != nil {
          return err
      }
      return os.Stdout.Close()
  }
  ```
* **Offline HTML Report Generation**: Reports must be self-contained and render without external network requests (CDNs, Google Fonts) by inlining JSON data models directly into offline templates.

### 4. Backend Concurrency & Memory Safety
* **Shared Concurrency Limiters**: Dispatchers utilize shared limiters (`dispatchgraph.SharedConcurrencyLimits(p.ClassicConcurrency)`) to ensure that deeply nested branch evaluations do not spawn unbounded goroutines and exhaust OS threads.
* **Leak-Safe Parallel Subtesting**: When running subtests in parallel (`t.Parallel()`), cleanup handlers (`t.Cleanup()`) attached to the parent test only fire after all parallel child tests complete. In `experimental_test.go`:
  ```go
  for _, tc := range testCases {
      t.Run(tc.name, func(t *testing.T) {
          t.Parallel()
          // Server resources are freed safely after subtests finish
          conn, _, _ := testserver.NewTestServerWithConfig(t, ...)
      })
  }
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
* **Index Column Order Gap Rejection**: In CockroachDB index matching (`indexutil.go`), non-consecutive column matches MUST be rejected. An index cannot be used if leading columns are missing:
  ```go
  if columnIndex > lastMatchingColIndex+1 {
      // Gap detected in index matching order; stop matching
      return doesNotMatch, nil
  }
  ```
* **Proto Validation Pre-Warming**: Prevent runtime latency spikes by pre-warming `protovalidator` caches at server startup using reflection over registered gRPC service definitions (`inputMessagesForService`).

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
SpiceDB separates graph dispatch from the underlying storage layer through a pluggable `DataLayer` interface. The dispatch subsystem operates in two interchangeable execution models:
- **Classic Engine**: Decomposes check requests into sub-problems via a distributed tree dispatch network using gRPC.
- **Planner Engine**: Compiles schema relations into execution plan iterators (`query.Iterator`), evaluating permissions with structured set operators (union, intersection, exclusion).

### Dimension 2: Core Abstractions
- `tuple.Relationship`: The universal domain primitive representing `resource#relation@subject`.
- `datalayer.DataLayer`: Snapshot isolation interface offering `SnapshotReader` at a deterministic MVCC `datastore.Revision`.
- `query.Iterator`: Compiled execution cursor yielding evaluation paths across relation graphs.
- `caveats.CaveatRunner`: Evaluates runtime attributes against CEL expressions with partial-evaluation semantics.

### Dimension 3: Error Handling
Errors are categorized via `spiceerrors` into internal bugs (`MustBugf`), client errors (`invalidParams`), and transient concurrency conflicts (`IsQueryCanceledError`). The schema layer enforces structural consistency by returning typed domain errors (`NamespaceNotFoundError`, `RelationNotFoundError`) that translate cleanly into standard gRPC status codes (`NOT_FOUND`, `FAILED_PRECONDITION`).

### Dimension 4: Testing
- **Differential Engine Benchmarking (`checkbaseline`)**: Compares the classic graph dispatcher directly against the query planner engine, running identical workloads against shared memory snapshots to assert decision parity and measure alloc/time deltas.
- **Race-Condition Integration Testing**: Multi-engine testing against real backing services (PostgreSQL, CockroachDB, MySQL, Spanner) with `testcontainers-go` using `-race`.
- **Parallel Subtest Matrixing**: Splitting cursor page size tests across concurrent workers while reusing read-only memory datastores.

### Dimension 5: Security
- **Threat Model**: Broken Object Level Authorization (BOLA / IDOR) mitigation via centralized ReBAC.
- **SQL Injection Elimination**: Static AST compilation via `pganalyze/pg_query_go` and parameterized queries using `Masterminds/squirrel`.
- **CEL Sandbox Security**: Evaluating caveats in a strictly bounded CEL environment preventing filesystem access, arbitrary network calls, or memory exhaustion.

### Dimension 6: Performance
- **Zero-Copy Serialization**: Proto serialization via `planetscale/vtprotobuf` for fast, zero-allocation marshaling.
- **CGO Elimination**: `CGO_ENABLED=0` builds coupled with pure Go SQL parsers (`wasilibs/go-pgquery`) ensure portable binary execution and predictable goroutine scheduling.
- **Batch Dispatch Chunking**: Graph queries exceeding `DispatchChunkSize` are automatically chunked into parallel sub-dispatches to balance network payload limits and concurrency ceilings.

### Dimension 7: Deployment
- **Minimal Chainguard Base Image**: Final deployment artifacts build on `cgr.dev/chainguard/static` with strict multi-platform SHA256 pinning.
- **Build-Time Hardening**: Compiling with `-tags memoryprotection -buildvcs=false -ldflags=-checklinkname=0` to ensure static linking, reproducible binaries, and protection against unauthorized internal symbol linking.
- **Built-in Probing**: Bundling `/bin/grpc_health_probe` to satisfy Kubernetes liveness and readiness lifecycle checks out-of-the-box.

### Dimension 8: Agent Patterns
- **Baseline Profiling Pipeline**: Automated workflows (`checkbaseline-report.yaml`) run profiling jobs, output JSON metrics, summarize latency/allocations via Python scripts, and produce standalone HTML dashboards for regression tracking.
- **Diagnostic Tracing**: Trace events capture operation type, rows scanned, bytes transferred, and schema loads without leaking confidential authorization payloads.

### Dimension 9: Data Flow
```
User Check Request (Resource, Subject, Context)
                       |
                       v
         Validate Schema & Parse Tuple
                       |
                       v
       Acquire Read Snapshot at Revision
                       |
                       v
       +---------------+---------------+
       |                               |
       v                               v
[Classic Engine]               [Planner Engine]
Dispatch Graph Tree           Compile Plan Outline
Parallel Sub-checks           Traverse Iterators
       |                               |
       +---------------+---------------+
                       |
                       v
              Evaluate Caveats (CEL)
                       |
           +-----------+-----------+
           |                       |
       Resolved                 Missing Context
           |                       |
           v                       v
     Allow / Deny             Conditional
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Pre-Warmed Protocol Buffer Reflection Validator
Inspects registered gRPC service descriptions to extract incoming message types and initialize validation engines at startup, removing runtime reflection penalties:
```go
func InputMessagesForService[S any](registerFn func(grpc.ServiceRegistrar, S), impl S) []proto.Message {
    registrar := &fakeServiceRegistrar{}
    registerFn(registrar, impl)
    desc, err := protoregistry.GlobalFiles.FindDescriptorByName(
        protoreflect.FullName(registrar.desc.ServiceName),
    )
    if err != nil {
        return nil
    }
    svcDesc := desc.(protoreflect.ServiceDescriptor)
    var msgs []proto.Message
    for _, md := range registrar.desc.Methods {
        methodDesc := svcDesc.Methods().ByName(protoreflect.Name(md.MethodName))
        msgType, err := protoregistry.GlobalTypes.FindMessageByName(methodDesc.Input().FullName())
        if err == nil {
            msgs = append(msgs, msgType.New().Interface())
        }
    }
    return msgs
}
```

### 2. Rule: Immediate Range Termination on Composite Indexes
When computing best-match composite index scores for dynamic filter execution, encountering a prefix, range, or slice predicate MUST immediately halt further column matching and forbid appending trailing equality columns.

### 3. Architecture Principle: Separation of Dispatch from Storage MVCC
The graph evaluation engine must operate exclusively over immutable snapshot readers (`SnapshotReader`) parameterized by a logical revision (`RevisionWithSchemaHash`). Decoupling evaluation from mutation ensures graph traversal algorithms never encounter write locks, dirty reads, or phantom updates.

### 4. Failure Mode: Partial Index Corruption on Concurrency Timeout
Terminating a PostgreSQL migration while executing `CREATE INDEX CONCURRENTLY` leaves the index marked as invalid. Subsequent runs utilizing `IF NOT EXISTS` fail silently, leaving table scans active in production.
- **Mitigation**: Precede concurrent index creation with an explicit `DROP INDEX CONCURRENTLY IF EXISTS`.

### 5. Reusable Skill: Subtest Parallelization with Shared Snapshots
When parallelizing tests involving in-memory database engines:
1. Initialize the dataset once per test table row.
2. Bind the read-only datastore to the outer scope.
3. Call `t.Parallel()` in both the outer case and inner parameterized test runners.
4. Verify that no write operations are performed inside the parallel blocks.

### 6. Decision: Pure Go WASM / Translation SQL Parsers vs CGO
- **Decision**: Adopt WASM/Pure-Go translation libraries (`wasilibs/go-pgquery`, `pganalyze/pg_query_go/v6`) instead of linking directly to C-based PostgreSQL source headers via CGO.
- **Rationale**: Eliminates cross-compilation toolchain complexity, prevents CGO thread allocation overhead, and allows single-command static binary compilation across platforms (`linux/amd64`, `linux/arm64`, `windows`).

### 7. Anti-Pattern: String Parsing Inside High-Volume Test Generators
Using `fmt.Sprintf` and high-level string parsers (`tuple.MustParse`) to synthesize large fixture collections ($>10^4$ items) in test suites. This allocates millions of transient string objects, triggers excessive GC pauses, and exhausts CI runner resources.

### 8. Verification Method: Differential Correctness Baseline Assertions
To verify a new query planning engine against a legacy engine:
```go
classicDecision, classicErr := classicEngine.Check(ctx, testCase)
plannerDecision, plannerErr := plannerEngine.Check(ctx, testCase)

require.Equal(t, classicErr != nil, plannerErr != nil)
require.Equal(t, classicDecision.Outcome, plannerDecision.Outcome)
require.Equal(t, classicDecision.MissingContext, plannerDecision.MissingContext)
```

---

## 7. Actionable Agent Skill & Implementation Checklist

### Procedural Implementation Checklist
- [ ] **Step 1: Interface Design**: Establish an immutable snapshot reader interface returning relationships by composite filter (`namespace`, `object_id`, `relation`, `userset`).
- [ ] **Step 2: Schema Validation**: Validate all incoming type relations against a compiled schema model; return typed errors (`NamespaceNotFound`, `RelationNotFound`) early.
- [ ] **Step 3: Depth Guard Implementation**: Add context-bound depth decrementing logic to all recursive evaluation loops; fail with `ErrMaxDepthExceeded` when limit is hit.
- [ ] **Step 4: Composite Index Optimizer**: When generating dynamic queries, verify that prefix filters terminate index matching immediately to prevent slow table scans.
- [ ] **Step 5: Safe Index Migrations**: Structure relational migration runners to drop invalid indexes concurrently before issuing concurrent creation statements.
- [ ] **Step 6: Test Fixture Optimization**: Eliminate `fmt.Sprintf` and string parsing from large-scale test fixture generation; construct domain structs directly.
- [ ] **Step 7: Pre-Warm Reflection Caches**: Scan gRPC services during startup and instantiate all message types once to pre-populate validation and reflection caches.
- [ ] **Step 8: Standalone Report Sanitization**: When exporting visual reports containing JSON payloads, escape `<, >, &` to preserve HTML context security.

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
