> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pingcap-tidb-learnings.md`  
> **Source**: github ([https://github.com/pingcap/tidb](https://github.com/pingcap/tidb))  
> **Source Version**: `ed2899ed`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T10:26:06.000Z  
> **Learning ID**: `learn-github-pingcap-tidb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): pingcap/tidb

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
TiDB is a distributed, horizontally scalable, Hybrid Transactional and Analytical Processing (HTAP) NewSQL database compatible with the MySQL wire protocol and SQL dialect. It decouples stateless compute from stateful distributed storage, orchestrating multi-Raft key-value consensus via TiKV (row-based transactions) and TiFlash (columnar vectorized analytics), synchronized through a centralized Placement Driver (PD) cluster manager.

```
                    +---------------------------------------+
                    |             Client App                |
                    +-------------------+-------------------+
                                        | (MySQL Protocol :4000)
                                        v
+-----------------------------------------------------------------------------------+
| TiDB Stateless Compute Node                                                       |
|                                                                                   |
|  +------------------------+   +-----------------------+   +--------------------+  |
|  | Frontend / Conn Handler|-->| SQL Parser / Lexer    |-->| Logical / Physical |  |
|  | (MySQL / Status Server)|   | (PingCAP parser AST)  |   | Optimizer          |  |
|  +------------------------+   +-----------------------+   +---------+----------+  |
|               ^                                                     |             |
|               | (HTTP / cmux :10080)                                v             |
|  +------------+-----------+                           +--------------------+      |
|  | StatusListener         |                           | Distributed        |      |
|  | (Conn Tracker / Grace) |                           | Executor           |      |
|  +------------------------+                           +---------+----------+      |
+-----------------------------------------------------------------|-----------------+
                  | (Etcd / HTTP)                                 | (gRPC / Coprocessor)
                  v                                               v
+----------------------------------+          +-------------------------------------+
| Placement Driver (PD)            |          | Storage Tier                        |
| - TSO Timestamp Oracle           |          | - TiKV (Row / Multi-Raft / RocksDB) |
| - Region Routing & Heartbeats    |          | - TiFlash (Columnar Learner Engine) |
| - Dynamic Schedulers & Balancers |          +-------------------------------------+
+----------------------------------+
```

### Architectural Subsystem Boundaries & Decoupling
1. **Stateless Compute Layer (`pkg/server`, `pkg/session`)**: Accepts incoming MySQL protocol packets, manages session-level context, lifecycle state, privileges, and system variables. It retains zero durable state, delegating all concurrency control and transactional persistence downwards.
2. **Parsing & Cost-Based Optimizer (`pkg/parser`, `pkg/planner`)**: Converts SQL strings into Abstract Syntax Trees (ASTs), binds schemas, runs logical rewrite rules, and performs cost-based physical optimization (e.g., IndexScan vs. TableScan, CBO join reordering, Sort elimination via order-property derivation).
3. **Distributed Execution Engine (`pkg/executor`, `pkg/distsql`)**: Translates physical plans into executable operator trees (HashJoin, MergeJoin, StreamAgg, Projection). Pushes down filter and aggregation predicates (Coprocessor tasks) directly to TiKV/TiFlash storage nodes.
4. **Metadata & Schema Synchronizer (`pkg/domain`, `pkg/infoschema`, `pkg/ddl`)**: Implements an online schema change protocol (based on the Google F1 design), coordinating schema transitions (None $\to$ Delete-Only $\to$ Write-Only $\to$ Public) across the cluster via etcd-backed PD notifications without global table locks.
5. **Cluster Orchestration & Backup/Restore Client (`br/pkg/...`)**: Coordinates multi-node SST ingest/export, manages PD scheduler throttles (`pdutil`), performs cryptographic transformations (`metautil`), and handles range re-writing across cluster restorations.

---

## 2. Net-New Universal Engineering Rules

### 1. Connection-Multiplexed Listener Draining Guard
**RULE**:
When serving multiple protocols (e.g., HTTP, gRPC, TLS) across a single network port using connection multiplexing (such as `cmux`), server runtimes MUST wrap the root `net.Listener` with a concurrent connection tracker that intercepts raw connections prior to protocol sniffing. The root listener MUST NOT close underlying sockets until active sniffing classification routines have either matched a target handler or been explicitly unblocked and closed via connection-level tracking.

**WHY**:
Connection multiplexers like `cmux` match protocols by executing a speculative `Peek()` or buffered `Read()` on newly accepted connections to inspect protocol signatures (e.g., HTTP header prefixes, TLS client handshakes). When an unauthenticated or slow-reading client opens a TCP socket and stalls before sending data, the classified goroutine inside `cmux` blocks indefinitely on `io.Read`. If the outer server issues `listener.Close()`, the underlying TCP listener stops accepting *new* connections, but does not close connections that are currently stalled in classification buffers. This produces unrecoverable goroutine leaks, blocks clean process terminations, and leaves zombie TCP sockets active in kernel socket queues.

**WHEN TO APPLY**:
Apply in any Go network service where multiple network application protocols share a single listening port via payload sniffing (e.g., combining Prometheus `/status`, gRPC debugging, and standard HTTP on port 10080).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package server

import (
	"net"
	"sync"
)

// statusListener wraps net.Listener to track all accepted connections
// ensuring they can be forcibly torn down during shutdown even if cmux is blocked sniffing.
type statusListener struct {
	net.Listener
	mu     sync.Mutex
	conns  map[*statusConn]struct{}
	closed bool
}

func newStatusListener(listener net.Listener) *statusListener {
	return &statusListener{
		Listener: listener,
		conns:    make(map[*statusConn]struct{}),
	}
}

func (l *statusListener) Accept() (net.Conn, error) {
	conn, err := l.Listener.Accept()
	if err != nil {
		return nil, err
	}
	l.mu.Lock()
	if l.closed {
		l.mu.Unlock()
		_ = conn.Close()
		return nil, net.ErrClosed
	}
	sc := &statusConn{Conn: conn, listener: l}
	l.conns[sc] = struct{}{}
	l.mu.Unlock()
	return sc, nil
}

func (l *statusListener) Close() error {
	l.mu.Lock()
	if l.closed {
		l.mu.Unlock()
		return nil
	}
	l.closed = true
	// Snapshot active connections and release mutex before closing them
	// to prevent deadlocks caused by reentrant statusConn.Close calls.
	conns := l.conns
	l.conns = nil
	l.mu.Unlock()

	err := l.Listener.Close()
	for conn := range conns {
		_ = conn.Close()
	}
	return err
}

type statusConn struct {
	net.Conn
	listener *statusListener
}

func (c *statusConn) Close() error {
	err := c.Conn.Close()
	c.listener.mu.Lock()
	if c.listener.conns != nil {
		delete(c.listener.conns, c)
	}
	c.listener.mu.Unlock()
	return err
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Passing raw net.Listener directly into cmux without connection lifecycle tracking.
func (s *Server) listenStatusBad() error {
	rawListener, err := net.Listen("tcp", s.addr)
	if err != nil {
		return err
	}
	m := cmux.New(rawListener)
	httpL := m.Match(cmux.HTTP1Fast())
	grpcL := m.Match(cmux.Any())

	go s.serveHTTP(httpL)
	go s.serveGRPC(grpcL)
	go m.Serve()

	// FAILURE: Calling rawListener.Close() will NOT terminate connections 
	// currently blocked inside m.Match sniffing loops, leaking goroutines permanently.
	s.closer = rawListener.Close
	return nil
}
```

**VERIFICATION METHOD**:
Enforce via Uber's `goleak` in subtests that initiate unclassified connections:
```go
func TestStatusServerCloseLeak(t *testing.T) {
	defer goleak.VerifyNone(t, goleak.IgnoreCurrent())
	cfg := util.NewTestConfig()
	s := NewTestServer(cfg)
	require.NoError(t, s.listenStatusHTTPServer())

	// Open connection but do not write protocol bytes (simulating slow-client hang)
	conn, err := net.Dial("tcp", s.statusListener.Addr().String())
	require.NoError(t, err)
	defer conn.Close()

	// Server shutdown must unblock cmux and exit cleanly within timeout
	done := make(chan struct{})
	go func() {
		s.Close()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("status server failed to shutdown due to blocked cmux sniffers")
	}
}
```

---

### 2. Monotonic Inversion Nullability Guard for SQL Property Derivation
**RULE**:
A query planner optimizer MUST NOT satisfy an `ORDER BY <expr>(col) [ASC|DESC]` sort requirement by simply reversing an underlying index scan direction (`IndexScan [ASC <-> DESC]`) if the column expression $f(col)$ reverses the order of domain values, UNLESS the column is guaranteed to have a `NOT NULL` constraint (`mysql.HasNotNullFlag`).

**WHY**:
In standard SQL, `NULL` values sort smaller than non-null values under standard ascending order (or larger if `NULLS LAST` is specified). 
When an expression inverts value signs (e.g., `-col`, `0 - col`), the relationship of scalar values is inverted: $a < b \implies -a > -b$. 
However, `NULL` semantics do not invert: $-(\text{NULL}) \to \text{NULL}$. 
If an index holds values `[NULL, 10, 20]`:
- Ascending index scan: `NULL, 10, 20`
- Descending index scan yields: `20, 10, NULL`
- Evaluating `-col` over an ascending scan yields: `NULL, -10, -20` (NULL is first)
- However, `ORDER BY -col DESC` requires: `-10, -20, NULL` (non-null values descending, NULL last) or `-20, -10, NULL`.
Reversing the index scan order to satisfy `-col` causes `NULL` records to appear at the wrong boundary of the result set, corrupting query correctness.

**WHEN TO APPLY**:
Applies to SQL planner and query optimizer modules during physical property matching (`PropByOrderByItems`), sort elimination, and pipeline push-down logic.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package physicalop

import (
	"github.com/pingcap/tidb/pkg/parser/mysql"
	"github.com/pingcap/tidb/pkg/planner/property"
	"github.com/pingcap/tidb/pkg/planner/util"
)

// GetPropByOrderByItemsContainScalarFunc checks if ordering requirements can be
// fulfilled by pushed-down physical storage scans.
func GetPropByOrderByItemsContainScalarFunc(items []*util.ByItems) (*property.PhysicalProperty, bool, bool) {
	propItems := make([]property.SortItem, 0, len(items))
	onlyColumn := true

	for _, item := range items {
		col, desc := extractColumnAndDirection(item.Expr, item.Desc)
		if col == nil {
			return nil, false, false
		}

		// Reversing value order does not reverse NULL order: -NULL is still NULL.
		// An opposite index scan cannot satisfy this sort for nullable columns.
		if desc != item.Desc && !mysql.HasNotNullFlag(col.RetType.GetFlag()) {
			return nil, false, false
		}

		propItems = append(propItems, property.SortItem{Col: col, Desc: desc})
		if desc != item.Desc {
			onlyColumn = false
		}
	}
	return &property.PhysicalProperty{SortItems: propItems}, onlyColumn, true
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Blindly assuming index reversal preserves NULL ordering for unary inversion expressions.
func GetPropByOrderByItemsNaive(items []*util.ByItems) (*property.PhysicalProperty, bool) {
	propItems := make([]property.SortItem, 0, len(items))
	for _, item := range items {
		col, inverted := isUnaryMinusExpression(item.Expr)
		effectiveDesc := item.Desc
		if inverted {
			effectiveDesc = !effectiveDesc // BUG: Nullable column will output NULL at opposite end!
		}
		propItems = append(propItems, property.SortItem{Col: col, Desc: effectiveDesc})
	}
	return &property.PhysicalProperty{SortItems: propItems}, true
}
```

**VERIFICATION METHOD**:
Construct integration regression queries comparing full table scans with forced index scans:
```sql
CREATE TABLE t_null_sort (id INT PRIMARY KEY, c DOUBLE, KEY idx_c(c));
INSERT INTO t_null_sort VALUES (1, NULL), (2, 0.3), (3, 0.7), (4, 0.8);

-- Must verify that an explicit sort operator is NOT eliminated when column is nullable:
EXPLAIN FORMAT='brief' SELECT id FROM t_null_sort USE INDEX(idx_c) ORDER BY -c DESC, id;
-- Expected output contains: "Sort" operator

-- Verify execution outputs exact MySQL standard ordering:
SELECT id FROM t_null_sort USE INDEX(idx_c) ORDER BY -c DESC, id;
-- Expected Result: 2, 3, 4, 1 (NULL sorts lowest in MySQL; descending puts it last)
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: cmux Goroutine Leak During Status Server Shutdown (BUG-TIDB-72451)
- **Context**: `pkg/server/http_status.go`, `pkg/server/server.go`, `pkg/server/status_listener.go`
- **What Was Expected**: Calling `Server.Close()` cleanly stops HTTP and gRPC status listeners without leaving leaked goroutines or dangling TCP sockets.
- **What Actually Happened**: When incoming TCP connections connected to port 10080 before or during shutdown without sending protocol headers, `cmux` remained blocked in `io.Read` classification routines. `s.statusListener.Close()` failed to abort blocked reads, preventing goroutines from terminating and causing CI timeouts and resource exhaustion.
- **Evidence in Repo**: Commit `07b758bf`, PR `#72452`, Issue `#72451`.
- **Root Cause**: `cmux.Match` wraps accepted connections in its own buffered reader. If no bytes are transmitted across an accepted socket, the classification goroutine blocks indefinitely. Standard closure of the root `net.TCPListener` only terminates the `Accept()` loop; it does not close sockets already yielded to `cmux` buffers.
- **Remediation Code Diff**:
```go
// In pkg/server/http_status.go:
 	s.statusAddr = s.statusListener.Addr().String()
 	s.cfg.Status.StatusPort = uint(s.statusListener.Addr().(*net.TCPAddr).Port)
 }
+// Diagnostic HTTP bypasses cmux and tracks connections itself. Leave its
+// TLS connections unwrapped so net/http can recognize them.
+if !diagnosticmode.Enabled() {
+	// Track connections before cmux can block reading their protocol prefix.
+	s.statusListener = newStatusListener(s.statusListener)
+}
 return nil

// In pkg/server/server.go:
 func (s *Server) closeListener() {
 	if s.socket != nil {
 		terror.Log(errors.Trace(err))
 		s.socket = nil
 	}
+	if s.statusListener != nil {
+		if err := s.statusListener.Close(); err != nil && !stderrors.Is(err, net.ErrClosed) {
+			terror.Log(errors.Trace(err))
+		}
+	}
```
- **Lesson**: Closing a root server listener does not cascade to connection instances that have already passed `Accept()`. Any classification or buffering proxy sitting between `Accept()` and worker pools must maintain explicit connection tracking.

---

### Incident 2: Corrupted NULL Tuple Ordering on Negated Index Scans (BUG-TIDB-69480)
- **Context**: `pkg/planner/core/operator/physicalop/physical_sort.go`, `pkg/planner/core/integration_test.go`
- **What Was Expected**: Queries sorting on inverted expressions (e.g., `ORDER BY -c DESC`) using an index on `c` must return `NULL` values at the end of the result set, conforming to MySQL ordering semantics.
- **What Actually Happened**: The planner eliminated the physical `Sort` operator, substituting a reversed `IndexFullScan` (`IndexFullScan(desc)`). Consequently, `NULL` values (which reside at the head of the ascending index) were emitted first, inverting the expected result ordering.
- **Evidence in Repo**: Commit `87ffb1fd`, PR `#71213`, Issue `#69480`.
- **Root Cause**: The physical property generator checked if the expression was monotonic and inverted the requested sort direction flag (`desc != item.Desc`). However, it failed to verify the nullable flag of the underlying schema column. While numeric negation inverts the domain ordering of non-null scalars, $-(\text{NULL}) = \text{NULL}$, meaning null ordering is invariant under negation.
- **Remediation Code Diff**:
```go
// In pkg/planner/core/operator/physicalop/physical_sort.go:
 			if col == nil {
 				return nil, false, false
 			}
+			// Reversing value order does not reverse NULL order: -NULL is still
+			// NULL. An opposite index scan cannot satisfy this sort for nullable columns.
+			if desc != item.Desc && !mysql.HasNotNullFlag(col.RetType.GetFlag()) {
+				return nil, false, false
+			}
 			propItems = append(propItems, property.SortItem{Col: col, Desc: desc})
 			onlyColumn = false
```
- **Lesson**: Mathematical domain equivalences ($f(x) = -x$) cannot be mapped directly to SQL execution paths without incorporating three-valued logic (3VL) constraints.

---

### Incident 3: Bazel Go Dependency Inconsistencies via Retiring Mirrors (PR-TIDB-72542)
- **Context**: `DEPS.bzl`, `MODULE.bazel`, `Makefile`
- **What Was Expected**: Reproducible hermetic builds across releases using Bazel with direct Go checksum verification.
- **What Actually Happened**: Builds failed on older release branches due to retired static ZIP mirrors. The build hid an internal Go SDK discrepancy: Bazel was using Go SDK 1.25.10 while the root modules required Go SDK 1.25.14.
- **Evidence in Repo**: PR `#72542`, referencing PR `#69844` and Issue `#69513`.
- **Root Cause**: Relying on static archive mirrors decoupled dependency downloading from standard Go module verification (`go.sum`). When local toolchain enforcement (`GOTOOLCHAIN=local`) interacted with `GOPROXY`, minor version mismatches in toolchain directives surfaced as hard build breaks.
- **Remediation Code Diff**:
```python
# Transitioned Bazel repository rules:
# Replaced custom skylark archive extraction rules:
# - go_repository(name = "kvproto", urls = ["https://mirror.pingcap.com/..."])
# + go_repository(
# +     name = "com_github_pingcap_kvproto",
# +     importpath = "github.com/pingcap/kvproto",
# +     sum = "h1:36snzl9cRshFt/A9/mzbYPk5C9Y+iZlNQIUCvR5SUb4=",
# +     version = "v0.0.0-20261026041219-2c5f843b9827",
# + )
```
- **Lesson**: Build toolchains should not use out-of-band artifact mirrors that bypass language-native cryptographic checksums (`go.sum`). Hermetic build systems must align toolchain versions directly with language runtime configurations.

---

### Incident 4: Automatic Materialized View Engine Lifecycle & Session Leaks (PR-TIDB-72540)
- **Context**: `pkg/domain/domain.go`, `pkg/mvservice`
- **What Was Expected**: Background materialized view refreshes and log purging must execute without altering global session variables or leaking worker resources when tasks fail or are cancelled.
- **What Actually Happened**: Background workers borrowed internal system sessions to execute fast refreshes. When queries aborted due to lock conflicts or manual cancellations, modified session properties and uncommitted transactional states persisted into the shared internal session pool.
- **Evidence in Repo**: PR `#72540`, Issue `#18023`.
- **Root Cause**: Lack of an explicit transactional isolation wrapper around borrowed system sessions during scheduled maintenance runs. Session state rollbacks were coupled with happy-path completions instead of being guaranteed via cleanup handlers.
- **Remediation Pattern**:
```go
// Domain initialization registers lifecycle handlers that guarantee state restoration:
func (do *Domain) executeMVScheduledTask(ctx context.Context, task *MVTask) error {
    se, err := do.sysSessionPool.Get()
    if err != nil {
        return err
    }
    defer do.sysSessionPool.Put(se)
    
    // Snapshot original session variables
    origVars := se.GetSessionVars().Clone()
    defer func() {
        // Unconditional restoration of session state on return
        se.GetSessionVars().ResetFrom(origVars)
    }()
    
    return do.mvService.RunTask(ctx, se, task)
}
```
- **Lesson**: Pooled system sessions used for background jobs must always reset their state within unconditional cleanup blocks (`defer`) to prevent state pollution across executions.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **Implicit Memory Aliasing in Loops**: In Go versions prior to 1.22, range loop variables reused memory addresses across iterations. While TiDB uses modern Go toolchains (`go 1.27.3`), concurrent closures still require defensive hygiene.
  ```go
  // DEFENSIVE PATTERN: Explicit local binding prevents aliasing issues
  for _, store := range stores {
      store := store // Local re-binding ensures unique address per loop iteration
      workers.ApplyOnErrorGroup(eg, func() error {
          return pingStore(ctx, store.GetId())
      })
  }
  ```
* **Protocol Buffers Wire-Level Consumption**: Zero-copy parsing of raw Protobuf wire messages requires explicit bounds checking on consumed byte lengths to prevent panic-level slices:
  ```go
  // From br/pkg/metautil/metafile.go
  fieldNumber, wireType, n := protowire.ConsumeTag(data)
  if n < 0 {
      return false, errors.Trace(protowire.ParseError(n))
  }
  data = data[n:]
  payload, consumed, err := consumeProtobufFieldValue(data, fieldNumber, wireType)
  if err != nil {
      return false, err
  }
  data = data[consumed:] // Pointer advances strictly bounded by wire reader output
  ```

### 2. Infinite Loop & Recursion Guards
* **Recursion Depth Caps in Protobuf AST Traversal**: When scanning nested Protobuf schemas for unknown fields (to prevent silent data loss during downgrades), recursion must be strictly bounded:
  ```go
  // From br/pkg/metautil/debug.go & metafile.go
  // Root metadata structures enforce depth limits to prevent stack overflow from circular structures:
  if len(child.MetaFiles) > 0 {
      return errors.Errorf("the metafile has unexpected level: %v", child)
  }
  ```
* **Bounded Retries with Context Deadline Propagation**: Indefinite retry loops must consume unified context signals and exponential backoff generators:
  ```go
  // br/pkg/conn/util/util.go
  err := utils.WithRetry(ctx, func() error {
      ts, err := GetCurrentTsFromPD(ctx, pdClient)
      if err != nil {
          return err // Returning error triggers backoff calculator
      }
      currentTS = ts
      return nil // Returning nil breaks retry loop cleanly
  }, utils.NewAggressivePDBackoffStrategy())
  ```

### 3. UI & UX Micro-Mechanics
* *Not applicable*: TiDB is a headless distributed database engine without a web UI layer.

### 4. Backend Concurrency & Memory Safety
* **TOCTOU Race Condition Guards in Dynamic Listeners**: Race conditions between connection acceptance and listener closure are eliminated using mutex-synchronized state flags paired with active connection tracking:
  ```go
  // pkg/server/status_listener.go
  func (l *statusListener) Accept() (net.Conn, error) {
      conn, err := l.Listener.Accept()
      if err != nil {
          return nil, err
      }
      l.mu.Lock()
      if l.closed {
          l.mu.Unlock()
          _ = conn.Close() // Invariant: If closed during Accept, socket is immediately dropped
          return nil, net.ErrClosed
      }
      c := &statusConn{Conn: conn, listener: l}
      l.conns[c] = struct{}{}
      l.mu.Unlock()
      return c, nil
  }
  ```
* **Lock-Free Map Snapshotting Prior to Mass Invocation**: When closing tracked network sockets, snapshots of the internal connection registry are gathered within a mutex boundary, but the actual network I/O calls execute outside the lock to prevent re-entrant deadlocks:
  ```go
  l.mu.Lock()
  conns := l.conns // Isolate map pointer
  l.conns = nil
  l.closed = true
  l.mu.Unlock()

  // Execute I/O closures outside of critical mutex sections
  for conn := range conns {
      _ = conn.Close()
  }
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
* **Slice Truncation Invariant Preservation**: Reusing allocated underlying slice memory when filtering elements requires tracking the write pointer (`j`) independently of the read cursor:
  ```go
  // From br/pkg/conn/util/util.go: In-place filtering avoids heap reallocations
  j := 0
  for _, store := range stores {
      if engine.IsTiFlash(store) && storeBehavior == SkipTiFlash {
          continue
      }
      stores[j] = store
      j++
  }
  return stores[:j], nil // Explicit re-slice bounds strictly to valid matched elements
  ```
* **Error Wrapping Trace Chains**: TiDB uses `github.com/pingcap/errors` across architectural boundaries to maintain source-level stack traces without losing underlying sentinel identities:
  ```go
  if err := s.statusListener.Close(); err != nil && !stderrors.Is(err, net.ErrClosed) {
      terror.Log(errors.Trace(err)) // Preserves error tree while filtering expected closed status
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
TiDB employs a compute-storage decoupled architecture. Compute nodes (`tidb-server`) are stateless and coordinate through a shared state layer managed by PD (Placement Driver). Schema management implements online DDL changes via transitions across `Delete-Only`, `Write-Only`, and `Public` states. Storage access relies on two distinct storage engines: TiKV handles row-based OLTP via Multi-Raft consensus, while TiFlash acts as an asynchronous columnar Raft learner node for vectorized analytical workloads (HTAP).

### Dimension 2: Core Abstractions
* `StoreMeta` (`br/pkg/conn/util/util.go`): Abstract interface exposing TiKV store topology discovery, abstracting the PD client.
* `statusListener` (`pkg/server/status_listener.go`): Decorator wrapping `net.Listener` to provide connection lifecycle management.
* `ByItems` & `PhysicalProperty` (`pkg/planner/...`): Core structural abstractions representing ordering, distribution, and partitioning requirements used during cost-based optimization.
* `MetaWriter` & `MetaReader` (`br/pkg/metautil`): Channel-based parallel serializers for chunked backup metadata files.

### Dimension 3: Error Handling
Errors are classified into client-facing protocol codes and internal storage errors. Network and storage RPCs use structured retry loops managed by backoff strategies (`utils.WithRetry` and `NewAggressivePDBackoffStrategy`). Sentinel checks use Go 1.13+ idioms (`stderrors.Is(err, net.ErrClosed)`) wrapped in trace-preserving decorators (`errors.Trace(err)`).

### Dimension 4: Testing
* **Leak Detection**: Integration test suites run under `go.uber.org/goleak` to ensure concurrent HTTP, gRPC, and status listeners do not leak runtime goroutines.
* **Failpoint Injection**: Uses `pingcap/failpoint` (e.g., `failpoint.Inject("PDEnabledPauseConfig", ...)`) to simulate distributed state transitions and partition failures.
* **Property-Based Plan Tests**: Integration tests use brief explain outputs and row comparisons (`testkit.Rows(...)`) to verify plan stability and operator elimination.

### Dimension 5: Security
* **Data-at-Rest Encryption**: Handled via `metautil.Encrypt`, supporting AES-128-CTR, AES-192-CTR, and AES-256-CTR with crypto-random initialization vectors (`CrypterIvLen = 16`).
* **Unknown Field Protection**: To prevent data corruption during downgrades, Protobuf backup streams check for unparsed fields (`detectUnknownProtobufFields`), failing safely if a legacy binary encounters modern metadata.
* **Log Redaction**: Keys are sanitized via `redact.Key(byteSlice)` before writing to diagnostic outputs, preventing user data from leaking into server logs.

### Dimension 6: Performance
* **Zero-Allocation Slicing**: Reuses existing slices in place (`stores[j] = store`) during store discovery and filtering.
* **Inline Small Metadata Files**: `StatsWriter` inlines statistics blocks under 8 KiB (`inlineSize = 8 * 1024`) directly into parent index headers, eliminating external storage I/O for small tables.
* **Dynamic Work Pools**: Employs worker pools (`tidbutil.NewWorkerPool(8, ...)`) to parallelize I/O bounds when reading metadata files.

### Dimension 7: Deployment
* **Container Lifecycle**: Multi-stage builds (`Dockerfile`) compile against specific Go toolchains (`golang:1.27.3`) and deploy to hardened base images (`rockylinux:9-minimal`).
* **Port Multiplexing**: Exposes port 4000 for the MySQL wire protocol and multiplexes Prometheus metrics, diagnostic endpoints, and HTTP status servers over port 10080 via `cmux`.

### Dimension 8: Agent Patterns
The repository uses dedicated automation runbooks (`.agents/skills/`), including:
* `tidb-bazel-prepare-gate`: Verifies dependency configurations across Bazel and Go modules.
* `tidb-failpoint-test-runner`: Orchestrates failpoint injection runs in CI.
* `tidb-realtikv-runner`: Spins up live backing storage nodes for real integration testing.

### Dimension 9: Data Flow
```
Query Input -> MySQL Packet Layer -> Lexer/Parser AST -> Logical Rewrite -> Physical CBO
  -> Coprocessor Task Splitter -> gRPC Client -> TiKV/TiFlash Storage -> Streaming Aggregator 
  -> Client Response Formatter
```
Metadata operations stream through `StatsWriter` $\to$ Protobuf serialization $\to$ AES-CTR encryption $\to$ persistent storage chunks (limited to 128 MiB bounds).

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Decorator-Based Network Connection Registry
To prevent multiplexing leaks, wrap the root listener in a tracking decorator that registers sockets upon `Accept()` and unregisters them upon `Close()`.
```go
type statusListener struct {
    net.Listener
    mu sync.Mutex
    conns map[*statusConn]struct{}
    closed bool
}
```

### 2. Rule
*Under three-valued logic, the planner MUST NOT satisfy inverted expression sorting through inverted index scans on nullable columns without an explicit nullability check.*

### 3. Architecture Principle
*Decouple connection lifecycle management from protocol sniffing classification.* Classification modules (`cmux`) must operate downstream of connection-tracking mechanisms so stalled connections can be closed safely during server shutdowns.

### 4. Failure Mode
Indefinite goroutine hangs in `cmux.Match` classification routines when clients open TCP connections but transmit no data, leaving connection-reading goroutines stranded.

### 5. Reusable Skill
**System Session Isolation Protocol**:
1. Borrow session from `sysSessionPool`.
2. Snapshot current session variables (`vars.Clone()`).
3. Enclose operations within a `defer` block that resets the session state from the snapshot.
4. Execute operations and release the session back to the pool.

### 6. Decision: Protobuf Unknown Field Rejection
**Context**: Restoring a backup created by a newer TiDB cluster using an older BR binary.  
**Alternative Rejected**: Silently ignoring unknown Protobuf tags during deserialization.  
**Rationale**: Silent parsing could discard newer metadata, schema attributes, or encryption parameters, resulting in silent data corruption. Deserialization must reject unknown tags unless explicitly overridden via `--check-requirements=false`.

### 7. Anti-pattern: Closing Shared Resources Within Mutex Locks
```go
// ANTI-PATTERN: Calling external I/O closures while holding internal state locks
func (l *badListener) Close() error {
    l.mu.Lock()
    defer l.mu.Unlock()
    for c := range l.conns {
        _ = c.Close() // DEADLOCK HAZARD if c.Close() re-enters l.mu!
    }
    return l.Listener.Close()
}
```

### 8. Verification Method
Verify goroutine cleanup during listener termination using Uber's `goleak`:
```go
defer goleak.VerifyNone(t, goleak.IgnoreCurrent())
```

---

## 7. Actionable Agent Skill & Implementation Checklist

### Step-by-Step Implementation Checklist for Database Engineers
- [ ] **Protocol Multiplexing Check**:
  - [ ] Are you multiplexing protocols (HTTP, gRPC, TLS) across a single port using `cmux`?
  - [ ] Have you wrapped the underlying listener with a connection-tracking layer before passing it to `cmux`?
  - [ ] Does listener shutdown safely iterate and close all tracked connections outside the registration mutex?
- [ ] **Planner Sort Inversion Check**:
  - [ ] Does your query optimizer reverse index scan paths to fulfill sort expressions ($f(col)$)?
  - [ ] Have you verified whether the column can contain `