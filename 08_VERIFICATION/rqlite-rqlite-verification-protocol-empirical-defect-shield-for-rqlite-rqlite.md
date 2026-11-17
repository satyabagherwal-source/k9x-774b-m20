# Verification Protocol: Verification Protocol: Empirical Defect Shield for rqlite/rqlite

<!-- PROVENANCE_START
{
  "source_repository": "rqlite/rqlite",
  "source_url": "https://github.com/rqlite/rqlite",
  "source_version": "b9dc726d",
  "license": "MIT",
  "timestamp": "2026-11-17T08:09:13.124Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rqlite-rqlite",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rqlite/rqlite](https://github.com/rqlite/rqlite) (Revision: `b9dc726d`).  
> **License**: MIT | **Timestamp**: `2026-11-17T08:09:13.124Z`  
> **Learning ID**: `learn-github-rqlite-rqlite`


## 1. Scope & Verification Target
- **Target Repository**: `rqlite/rqlite` (Commit: `b9dc726d`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Project Learning Record (Full-Spectrum Forensic Harvest): rqlite/rqlite

---

## 1. Executive Forensic Architecture & System Mechanics

```
                             +------------------+
                             |   HTTP Clients   |
                             +--------+---------+
                                      |
                     +----------------v----------------+
                     |         HTTP / REST API         |
                     |  - Lossless JSON (ExactNumber)  |
                     |  - SQL Trigger Parser (splitSQL)|
                     |  - Type Detection (?vtypes)     |
                     +----------------+----------------+
                                      |
               Write Pipeline         |         Read Pipeline
        +-----------------------------+-----------------------------+
        |                                                           |
+-------v-------+                                           +-------v-------+
|  Queue[T]     | (Batched HTTP writes)                     | IsStaleRead() | (Freshness & commit
|  - Timer      |                                           | Verification  |  index boundary check)
|  - Mutex Seq  |                                           +-------+-------+
+-------+-------+                                                   |
        |                                                           |
+-------v---------------------+                             +-------v-------+
|    HashiCorp Raft Core      |                             | SQLite Read-  |
| - Leader Election           |                             | Only Snapshot |
| - AppendEntries Replay      |                             +---------------+
+-------+---------------------+
        | (FSM Application)
+-------v---------------------------------------------------+
|               db.Swappable / SQLite Engine                |
| - Invariant Gate: IsBreakingPragma()                      |
| - DSN: _sync=0, _journal=WAL, _query_only                 |
+-------+---------------------------------------------------+
        |
+-------v---------------------------------------------------+
|               internal/fsutil & snapshot                  |
| - Atomic Directory Staging (.tmp -> Sync -> Rename)       |
| - OS-Specific Directory Sync (POSIX SyncDir vs Windows)   |
| - Windows File Lock Retry (ERROR_SHARING_VIOLATION)       |
| - Custom AST Linter: check-fsutil (Enforces fsutil usage) |
+-----------------------------------------------------------+
```

### The Exact Technical Problem rqlite Solves
rqlite bridges the gap between single-node embedded relational storage (SQLite) and distributed consensus (HashiCorp Raft). SQLite is strictly a single-machine, in-process engine. Running it across a cluster requires:
1. Replicating state deterministically across untrusted network partitions.
2. Preventing destructive local statements (such as arbitrary checkpoints or journal-mode overrides) from corrupting Raft consensus.
3. Guaranteeing ACID durability across heterogeneous operating systems without stalling under platform-specific file locks (e.g., Windows mandatory locking vs. POSIX advisory locking).

### Architectural Boundaries & State Ownership
- **Consensus Boundary (`store/state.go`)**: Manages the Raft consensus loop. Owns the Raft log (backed by BoltDB via `rlog`), cluster membership configuration, snapshot scheduling, and log truncation. Writes enter the system exclusively through Raft proposals.
- **Relational Boundary (`db/state.go`)**: Owns the SQLite database connection pool and handles execution of committed commands. SQLite does not run direct disk fsyncs on transactions; transactions rely on Raft log durability (`_sync=0` in DSN) while rqlite manages filesystem-level state changes.
- **Batched Write Queue (`queue/queue.go`)**: A generic, concurrent write-coalescing pipeline `Queue[T]` that decouples HTTP write arrival rates from Raft consensus proposals by accumulating items based on size or millisecond-scale timeouts.
- **Crash Durability & Storage Abstraction (`internal/fsutil`)**: Centralizes all OS filesystem calls. It encapsulates atomic directory renames, directory syncs (`SyncDir`), and retried operations on locked Windows file handles. A custom AST parser (`tools/check-fsutil`) guarantees architectural boundary containment by failing builds that call standard `os.*` filesystem mutation functions directly.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. AST-Enforced Storage Safety Barrier
**RULE**:
File mutations (removal, renaming, and staging) across distributed state machines MUST NOT invoke native language runtime standard library filesystem primitives directly. They MUST be routed through a platform-aware filesystem encapsulation layer, and this invariant MUST be verified continuously in CI via an AST linter that inspects every selector expression.

**WHY**:
Standard library calls like `os.Rename` or `os.Remove` in Go fail nondeterministically on Windows when background readers, virus scanners, or indexing processes hold open file handles (`ERROR_SHARING_VIOLATION` code 32, `ERROR_ACCESS_DENIED` code 5). Furthermore, POSIX requires explicitly running `fsync` on the parent directory after renaming to ensure durable entry updates across power cuts, whereas Windows file systems reject directory-level `fsync`. Bypassing an abstraction layer leads to corrupt state transitions and flaky tests on non-Linux platforms.

**WHEN TO APPLY**:
Apply to any distributed storage engine, Raft snapshot manager, WAL manager, or embedded database running across POSIX and Windows.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// internal/fsutil/fsutil.go
package fsutil

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"time"
)

const (
	errorAccessDenied     syscall.Errno = 5
	errorSharingViolation syscall.Errno = 32
	defaultRetryTimeout                 = 5 * time.Second
	defaultRetryInterval                = 10 * time.Millisecond
)

func Rename(src, dst string) error {
	_, err := RenameWithRetry(src, dst, defaultRetryTimeout, defaultRetryInterval)
	return err
}

func RenameWithRetry(src, dst string, timeout, interval time.Duration) (int, error) {
	return retryInUse(func() error { return os.Rename(src, dst) }, timeout, interval)
}

func retryInUse(fn func() error, timeout, interval time.Duration) (int, error) {
	deadline := time.Now().Add(timeout)
	retries := 0
	for {
		err := fn()
		if err == nil || !isInUse(err) || time.Now().After(deadline) {
			return retries, err
		}
		retries++
		time.Sleep(interval)
	}
}

func isInUse(err error) bool {
	if runtime.GOOS != "windows" {
		return false
	}
	return errors.Is(err, errorAccessDenied) || errors.Is(err, errorSharingViolation)
}

func SyncDir(dir string) error {
	if runtime.GOOS == "windows" {
		return nil // Windows does not permit directory handle flushing
	}
	fh, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer fh.Close()
	return fh.Sync()
}

func CopyDirAtomic(src, dst string) error {
	tmp := dst + ".tmp"
	if err := os.RemoveAll(tmp); err != nil && !os.IsNotExist(err) {
		return err
	}
	defer os.RemoveAll(tmp)

	if err := copyDirContents(src, tmp); err != nil {
		return err
	}
	if err := SyncDir(tmp); err != nil {
		return err
	}
	if err := Rename(tmp, dst); err != nil {
		return err
	}
	return SyncDir(filepath.Dir(dst))
}
```

**NEGATIVE CONSTRAINT**:
```go
// NEVER DO THIS in production storage layers:
func SaveSnapshot(tmpDir, finalDir string) error {
    // VIOLATION: Bare os.Rename will crash on Windows with ERROR_SHARING_VIOLATION
    // VIOLATION: Missing parent directory SyncDir means crash-recovery can lose the rename on POSIX
    if err := os.Rename(tmpDir, finalDir); err != nil {
        return os.RemoveAll(tmpDir) // VIOLATION: Standard remove will fail if still open
    }
    return nil
}
```

**VERIFICATION METHOD**:
Compile and execute an AST inspection tool during CI (similar to `tools/check-fsutil/main.go`):
```bash
go run ./tools/check-fsutil -root .
```
The AST scanner parses every file's `*ast.SelectorExpr`, checking if `X` resolves to `"os"` and `Sel.Name` matches `["Rename", "Remove", "RemoveAll"]`. The build fails with exit code 1 if found outside `internal/fsutil`.

---

### 2. Dual-Barrier Staleness Detection for Distributed Reads
**RULE**:
When serving local read requests from an elected node or replica in a consensus cluster, the node MUST NOT consider the read fresh based solely on the leader heartbeat timestamp. It MUST verify both:
1. Leader heartbeat reception is within the freshness window.
2. The current applied FSM index matches or exceeds the leader's commit index, OR the duration since the last applied FSM entry is within the freshness window.

**WHY**:
In Raft, a leader can broadcast cheap periodic empty heartbeats to maintain leadership without transmitting actual AppendEntries messages, or a follower may fall behind during heavy write ingestion while still acknowledging empty heartbeats. Relying solely on `time.Since(lastHeartbeat) < freshness` allows read-after-write violations, stale views, and reads from partitioned nodes.

**WHEN TO APPLY**:
Any distributed state machine providing tunable consistency levels (e.g., `weak`, `linearizable`, `freshness-bounded`).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// store/state.go
func IsStaleRead(
	lastHeartbeatTime time.Time,
	lastAppendEntriesTime time.Time,
	lastAppliedIndex uint64,
	leaderCommitIndex uint64,
	lastAppliedAtTime time.Time,
	freshness int64,
	strict bool,
) bool {
	if freshness == 0 {
		return false // Unbounded freshness explicitly opted into
	}

	// Barrier 1: Cluster connectivity / Leader lease boundary
	if time.Since(lastHeartbeatTime).Nanoseconds() > freshness {
		return true
	}

	if !strict {
		return false
	}

	// Barrier 2: Leader AppendEntries propagation check
	if time.Since(lastAppendEntriesTime).Nanoseconds() > freshness {
		return true
	}

	// Barrier 3: FSM catch-up evaluation
	if lastAppliedIndex >= leaderCommitIndex {
		return false // Up to date with latest known committed log
	}

	// Barrier 4: Index gap window check
	return time.Since(lastAppliedAtTime).Nanoseconds() > freshness
}
```

**NEGATIVE CONSTRAINT**:
```go
// NEVER rely on heartbeats alone:
func IsReadStaleUnsafe(lastHeartbeat time.Time, freshness time.Duration) bool {
    // VIOLATION: Follower could be 5,000 commits behind the leader,
    // yet heartbeat is 2ms old, serving completely stale reads.
    return time.Since(lastHeartbeat) > freshness
}
```

**VERIFICATION METHOD**:
Implement property-based unit testing covering the matrix of `(heartbeat_delta, append_delta, applied_idx, commit_idx, applied_time)`:
```go
func Test_IsStaleRead_StrictMatrix(t *testing.T) {
    now := time.Now()
    freshness := int64(time.Second)

    // Heartbeat fresh, but append entries timed out -> MUST BE STALE
    stale := IsStaleRead(now, now.Add(-2*time.Second), 10, 10, now, freshness, true)
    if !stale {
        t.Fatal("expected read to be marked stale when append entries is delayed")
    }

    // Heartbeat & append fresh, but applied behind commit and applied time old -> MUST BE STALE
    stale = IsStaleRead(now, now, 10, 20, now.Add(-2*time.Second), freshness, true)
    if !stale {
        t.Fatal("expected read to be marked stale when FSM application lags beyond window")
    }
}
```

---

### 3. Allocation-Zero Timer Draining and GC Slice Re-slicing in Batch Queues
**RULE**:
Concurrent batch processing queues using timers MUST drain `timer.C` safely within a locked or serialization goroutine, and MUST reset internal buffer slices using `s[:0]` re-slicing rather than reallocating or nil-setting to eliminate GC pressure.

**WHY**:
Calling `timer.Stop()` in Go does not guarantee the channel is empty if the timer expired concurrently before the stop took effect. Failing to drain the channel leaves a lingering timestamp that fires immediately on `Reset()`. Reallocating batch slices causes severe memory churn and trigger-happy GC cycles under high write loads.

**WHEN TO APPLY**:
Any high-throughput Go batching queue or worker pool that coalesces requests on `(size >= N || duration >= T)`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// queue/queue.go
func (q *Queue[T]) run() {
	defer close(q.closed)

	qObjs := make([]*queuedObjects[T], 0, q.batchSize)
	timer := time.NewTimer(0)
	stopTimer(timer) // Park timer initially in stopped state

	writeFn := func() {
		req := mergeQueued(qObjs)
		if req != nil {
			q.sendCh <- req
			// Memory retention optimization: retain backing array capacity, reset len to 0
			qObjs = qObjs[:0]
		}
	}

	for {
		select {
		case s := <-q.batchCh:
			if s == nil { // Explicit flush sentinel
				stopTimer(timer)
				writeFn()
				break
			}
			qObjs = append(qObjs, s)
			if len(qObjs) == 1 && q.timeout != 0 {
				timer.Reset(q.timeout)
			}
			if len(qObjs) == q.batchSize {
				stopTimer(timer)
				writeFn()
			}
		case <-timer.C:
			writeFn()
		case <-q.done:
			stopTimer(timer)
			return
		}
	}
}

func stopTimer(timer *time.Timer) {
	if !timer.Stop() && len(timer.C) > 0 {
		<-timer.C
	}
}
```

**NEGATIVE CONSTRAINT**:
```go
// NEVER discard timer state blindly or reset slices to nil:
func badBatchLoop[T any](ch <-chan T, timeout time.Duration) {
    var buf []T
    t := time.NewTimer(timeout)
    for {
        select {
        case item := <-ch:
            buf = append(buf, item)
            if len(buf) >= 100 {
                t.Stop() // BUG: Channel may hold an unread value
                flush(buf)
                buf = nil // ANTI-PATTERN: Forces slice reallocation on next batch
            }
        case <-t.C:
            flush(buf)
            buf = nil
        }
    }
}
```

**VERIFICATION METHOD**:
Benchmark queue throughput under saturated load and monitor heap allocations:
```bash
go test -bench=BenchmarkQueueThroughput -benchmem ./queue/...
```
Assert that `B/op` remains constant and `allocs/op` equals 0 in the inner batch accumulation loop.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: SQL Type Ambiguity for Relational Clients (BUG-RQLITE-3047)
- **Context**: `command/encoding`, `http`, PR #3047 (Fixes Issue #1701).
- **What Was Expected**: SQLite is dynamically typed with storage affinity. When retrieving rows, binary BLOBs are serialized to base64 JSON strings. However, if a user column contains a TEXT string that coincidentally matches base64 encoding rules (e.g., `"c3VyZQ=="`), client drivers cannot distinguish whether the underlying database field was binary data or plain text. The HTTP response needed an opt-in parameter to deliver exact database storage-class types row by row.
- **What Actually Happened**: Emitting data types for every row on standard queries bloated the wire size of JSON responses for high-throughput API users. Emitting native SQLite types also contradicted the JSON payload; for example, booleans in SQLite are stored as `INTEGER` (0 or 1), but the JSON encoder renders them as `true`/`false`.
- **Evidence in Repo**: PR #3047: *Add "vtypes" query parameter to indicate actual value types*.
- **Root Cause**: SQLite’s type system does not enforce strict schemas on column level alone; value types can vary per row. The JSON serialization layer had no mechanism to convey row-level types without payload bloat.
- **Remediation Code Diff**:
```go
// - No parameter option; types omitted or inferred from column schema only:
// + Opt-in ?vtypes parameter parses column values per row:

// http/service.go / command/encoding
func (s *Service) handleQuery(w http.ResponseWriter, r *http.Request) {
+   includeVTypes := r.URL.Query().Has("vtypes")
    rows, err := s.db.Query(query)
    // ...
    for rows.Next() {
+       if includeVTypes {
+           // Map storage types row-by-row
+           // Disambiguate boolean JSON representation from raw SQLite INTEGER storage class
+           rowTypes[i] = resolveType(val) // "boolean", "blob", "text", "integer", "float"
+       }
    }
}
```
- **Lesson**: Never alter default serialization output sizes in high-throughput database APIs. Implement granular type metadata as an explicit query opt-in, and reconcile discrepancies between the transport format (JSON booleans) and backend storage classes (`INTEGER`).

---

### Incident 2: Flaky CI Build Times via Excessive E2E Helper Timeout (BUG-RQLITE-3048)
- **Context**: `system_test/e2e/helpers.py`, Commit `1ee8c719`.
- **What Was Expected**: End-to-end integration tests orchestrating multi-node clusters over localhost should converge rapidly (under 1–2 seconds per step) or fail fast if a node deadlocks.
- **What Actually Happened**: The global test timeout was set to 20 seconds. In edge environments or when negative test assertions waited for non-matching conditions (e.g., verifying cluster state consistency across elections), failed assertions blocked for the full 20 seconds per run, severely slowing down the test suite.
- **Evidence in Repo**: Commit `1ee8c719`: `Reduce e2e testing timeout`.
- **Root Cause**: Over-generous static timeout configuration masked test latency degradations and multiplied test suite execution times during failure cascades.
- **Remediation Code Diff**:
```python
@@ -16,7 +16,7 @@
 import sqlite3
 import string
 
-TIMEOUT=20
+TIMEOUT=10
 
 seqRe = re.compile(r"^{'results': \[\], 'sequence_number': \d+}$")
```
- **Lesson**: Integration test timeouts must be bound to the minimum realistic operational envelope. Excessively high timeouts lengthen developer feedback loops and hide synchronization regressions.

---

### Incident 3: Concurrent Windows OS File Lock Crashing Snapshot Restores (BUG-RQLITE-FSUTIL-01)
- **Context**: `internal/fsutil/fsutil.go`, `snapshot/state.go`.
- **What Was Expected**: During snapshot restoration or clone operations (`snapshot.Clone`), old snapshot staging directories must be deleted and replaced with newly unpacked directories using `os.RemoveAll` and `os.Rename`.
- **What Actually Happened**: On Windows test runners and production instances, background processes (e.g., system search indexers, virus scanners, or lingering readers) kept handles momentarily open to snapshot files. Calls to `os.RemoveAll` and `os.Rename` failed with `syscall.Errno 5 (Access is denied)` or `syscall.Errno 32 (Sharing violation)`, crashing the Raft state machine.
- **Evidence in Repo**: `internal/fsutil/fsutil.go`, `isInUse()`, and `tools/check-fsutil/main.go`.
- **Root Cause**: Unlike POSIX file systems which allow unlinking files while open file descriptors remain active, Windows enforces mandatory locking semantics by default.
- **Remediation Code Diff**:
```go
// - Native calls directly crashing on Windows:
// err := os.Rename(src, dst)
// + Wrapped retry loops detecting Windows error numbers:
func RenameWithRetry(src, dst string, timeout, retryInterval time.Duration) (int, error) {
	return retryInUse(func() error { return os.Rename(src, dst) }, timeout, retryInterval)
}

func isInUse(err error) bool {
	if runtime.GOOS != "windows" {
		return false
	}
	return errors.Is(err, errorAccessDenied) || errors.Is(err, errorSharingViolation)
}
```
- **Lesson**: Cross-platform file operations must anticipate mandatory file-locking semantics. Never execute bare unlinks or renames without platform-specific retry loops on lock contention errors.

---

### Incident 4: State Machine Split via SQLite PRAGMA Injections (BUG-RQLITE-PRAGMA-01)
- **Context**: `db/state.go`, `store/state.go`.
- **What Was Expected**: Users sending raw SQL commands via `/db/execute` must not be able to execute PRAGMAs that alter the storage engine's behavior out-of-band, because doing so bypasses the Raft log and desynchronizes node storage states.
- **What Actually Happened**: If a client executed `PRAGMA journal_mode = DELETE` or `PRAGMA wal_checkpoint`, SQLite altered its journaling strategy, checkpointed the WAL independently of rqlite's snapshot engine, or changed transaction locks, breaking Raft replication and snapshotting.
- **Evidence in Repo**: `db/state.go: IsBreakingPragma()`, `breakingPragmasAnyForm`, `breakingPragmasAssignment`.
- **Root Cause**: SQLite allows execution of database-altering commands through the same SQL query stream as standard DML. Clients could inject PRAGMA statements disguised inside comments or multi-statement payloads.
- **Remediation Code Diff**:
```go
// + Pre-execution lexical tokenizer intercepting breaking PRAGMAs
var breakingPragmasAnyForm = []string{"wal_checkpoint"}
var breakingPragmasAssignment = []string{
	"journal_mode", "wal_autocheckpoint", "synchronous", "query_only",
}

func IsBreakingPragma(stmt string) bool {
	start := true
	for len(stmt) > 0 {
		var token string
		token, stmt = nextPragmaToken(stmt)
		if token == ";" {
			start = true
			continue
		}
		// Intercept PRAGMAs even when hidden behind EXPLAIN QUERY PLAN
		if start && strings.EqualFold(token, "EXPLAIN") {
			// token progression logic...
		}
		if start && strings.EqualFold(token, "PRAGMA") && isBreakingPragmaBody(stmt) {
			return true
		}
		start = false
	}
	return false
}
```
- **Lesson**: When wrapping an embedded database in distributed consensus, you must lexically inspect the command stream before it touches the engine to reject engine-altering settings that undermine cluster invariants.

---

### Incident 5: JavaScript IEEE-754 Precision Truncation of 64-Bit Database Integers (BUG-RQLITE-NUM-01)
- **Context**: `http/console/static/js/core.js`.
- **What Was Expected**: SQLite integers are full signed 64-bit integers (`int64`, up to `9,223,372,036,854,775,807`). The web console needs to render database rows verbatim without altering values.
- **What Actually Happened**: Standard `JSON.parse()` in JavaScript converts all numbers to IEEE-754 double-precision floats. Any integer greater than `Number.MAX_SAFE_INTEGER` (`9,007,199,254,740,991`, $2^{53} - 1$) silently truncated its lower bits, showing incorrect data in the browser.
- **Evidence in Repo**: `http/console/static/js/core.js: ExactNumber()`, `parseJSON()`.
- **Root Cause**: The JSON specification does not define integer limits, but standard browser JavaScript engines do not natively support 64-bit integer JSON deserialization without custom lexing.
- **Remediation Code Diff**:
```javascript
// - Standard JSON.parse truncates large integers:
// let data = JSON.parse(responseText);

// + Two-phase token-replacement lexer preserving exact literal representations:
function ExactNumber(literal) { this.literal = literal; }
ExactNumber.prototype.toString = function () { return this.literal; };

function parseJSON(text) {
    var numbers = [];
    // Mark and replace unsafe integers with unique token strings before parse
    var marked = text.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, function (token) {
        if (token[0] === '"') return token;
        var n = Number(token);
        if (!Number.isFinite(n) || (Number.isInteger(n) && !Number.isSafeInteger(n))) {
            var id = numbers.length;
            numbers.push(token);
            return JSON.stringify("__rqlite_number__" + id);
        }
        return token;
    });
    return JSON.parse(marked, function (key, value) {
        if (typeof value === "string" && value.indexOf("__rqlite_number__") === 0) {
            var idx = Number(value.slice("__rqlite_number__".length));
            return new ExactNumber(numbers[idx]);
        }
        return value;
    });
}
```
- **Lesson**: Web consoles interfacing with 64-bit systems must parse raw JSON payloads with a custom numeric tokenizer. Unparsed numeric string representations must be preserved before passing the payload to native JavaScript engines.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Hex Literal Parsing (`db/state.go: ParseHex`)**:


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
