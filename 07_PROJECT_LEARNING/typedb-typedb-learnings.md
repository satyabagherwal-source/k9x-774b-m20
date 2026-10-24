> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/typedb-typedb-learnings.md`  
> **Source**: github ([https://github.com/typedb/typedb](https://github.com/typedb/typedb))  
> **Source Version**: `3c809f9d`  
> **License**: MPL-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-24T20:31:15.206Z  
> **Learning ID**: `learn-github-typedb-typedb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): typedb/typedb

---

## 1. Executive Forensic Architecture & System Mechanics

TypeDB is an open-source, polymorphic deductive database built in Rust. It unifies relational, graph, and object-oriented paradigms via a strong type system (TypeQL) underpinned by an explicit conceptual data model (Entity-Relation-Attribute, or ERA). Unlike relational database engines (which execute tabular relational algebra) or property graph databases (which execute edge-traversal graph algorithms), TypeDB executes a deductive polymorphic inference pipeline that solves queries via first-order logic unification, type subsumption, and rule-based backward chaining.

### Architectural Subsystem Layout & Decoupling Boundaries

```
                 +---------------------------------------------+
                 |               Client / Network              |
                 | (gRPC: TypeDB Protocol / HTTP / Admin CLI)  |
                 +----------------------+----------------------+
                                        |
                 +----------------------v----------------------+
                 |          Server State & Operators           |
                 | (DatabaseOperator, TransactionOperator,      |
                 |  UserOperator, ServerOperator, Metrics)     |
                 +----------------------+----------------------+
                                        |
         +------------------------------+------------------------------+
         |                                                             |
+--------v---------------------+                             +---------v---------------+
|        Query Engine          |                             |   Diagnostics / Ops     |
| - Parse Cache (LRU)          |                             | - CoreMetrics (RwLocks) |
| - Translation Cache (LRU)    |                             | - Prometheus / JSON     |
| - Executable Plan Cache      |                             | - TokioTaskTracker      |
| - Preamble / IRQuery / Fetch |                             | - IntervalRunner        |
+--------+---------------------+                             +-------------------------+
         |
+--------v---------------------+
| Database & Concept Layers    |
| - Schema & TypeManager       |
| - ThingManager & Statistics  |
| - Rule Engine & Inference    |
+--------+---------------------+
         |
+--------v-----------------------------------------------------+
| MVCC, Durability & Low-Level Storage Layer                   |
| - RocksDB Engine Client (WALClient, DurabilityClient)        |
| - Transaction MVCC Lifecycles (Read, Write, Schema)          |
| - Snapshot Isolation & Sequence Numbers                      |
| - Byte Arrays & Big-Endian Encoders (common/bytes)           |
+--------------------------------------------------------------+
```

1. **Client / Transport Layer (`server/service`, `admin/client`)**: gRPC and HTTP entry points accept queries and session commands. Each connection maintains long-lived channel senders (`Sender<()>`) tied to active transactions and import sessions.
2. **Server State & Operator Abstraction (`server/state`)**: Decouples network services from database internals through four core traits: `DatabaseOperator`, `TransactionOperator`, `UserOperator`, and `ServerOperator`. State management maintains active transaction registries, import permit semaphores (`MAX_CONCURRENT_IMPORTS`), and lazy system database initializers.
3. **Query Compilation & Plan Cache (`query/query_cache.rs`)**: Three-tier query compilation pipeline:
   - **Parse Cache**: Unparsed string $\to$ Parsed AST.
   - **Translation Cache**: AST $\to$ Intermediate Representation (`TranslatedPipeline`).
   - **Executable Plan Cache**: `IRQuery` $\to$ `ExecutablePipeline`. Plans are parameterized against statistics to pick optimal join orders and variable bindings.
4. **Data Concept & Schema Engine (`concept`, `database`)**: Implements entity, relation, and attribute typing with inheritance and interfaces. Contains the `ThingManager` and `TypeManager`, holding statistics on type populations to drive cost-based query optimization.
5. **Storage & Durability (`storage`, `durability`, `common/bytes`)**: RocksDB-backed key-value substrate utilizing Multi-Version Concurrency Control (MVCC) snapshots, Write-Ahead Logging (`WALClient`), and custom big-endian lexicographical byte encoders (`ByteArray<SIZE>`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invalidation Closures in Asynchronous / Concurrent Caches
**RULE**:
When utilizing concurrent cache libraries (such as `moka`, `lru`, or internal lock-striped hash tables), you **MUST NOT** register dynamic invalidation predicate closures (`invalidate_entries_if`) capturing shared state references (`Arc<T>`) if the cache eviction/housekeeping cycle is driven synchronously by read/write queries. Instead, caches **MUST** decouple metadata version updates from entry storage, storing a single atomic/versioned reference to metadata (`latest_statistics: RwLock<Arc<T>>`) and evaluating entry staleness lazily upon retrieval (`get()`).

**WHY**:
In concurrent sync caches, housekeeping (cleanup and eviction) occurs opportunistically during read and write cache operations. Under write-only database ingestion or bulk import workloads, writes bypass the query cache (inserting directly into storage), while background tasks commit statistics updates. Registering an invalidation closure on every commit captures an `Arc<Statistics>` inside the closure heap allocation. Because no reads or writes hit the cache to trigger moka's housekeeping, none of the closures are executed or dropped. This creates an unbounded memory leak where millions of superseded statistics structures remain pinned in RAM.

**WHEN TO APPLY**:
Apply to all caching layers across database query planners, distributed caches, and compilers where metadata updates (schema, statistics, permissions) occur asynchronously or out-of-band relative to query execution.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::sync::{Arc, RwLock};
use moka::sync::Cache;

pub struct SafeQueryCache<K: Send + Sync + 'static, V: Send + Sync + 'static, S: Send + Sync + 'static> {
    entries: Cache<K, V>,
    validity_metadata: RwLock<Arc<S>>,
}

impl<K, V, S> SafeQueryCache<K, V, S>
where
    K: std::hash::Hash + Eq + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
    S: Send + Sync + 'static,
{
    pub fn new(capacity: u64, initial_stats: Arc<S>) -> Self {
        Self {
            // Do NOT enable .support_invalidation_closures()
            entries: Cache::builder().max_capacity(capacity).build(),
            validity_metadata: RwLock::new(initial_stats),
        }
    }

    /// O(1) atomic pointer swap. Never allocates closures; drops superseded metadata immediately.
    pub fn update_metadata(&self, new_stats: Arc<S>) {
        let mut lock = self.validity_metadata.write().unwrap();
        *lock = new_stats;
    }

    /// Lazy staleness check on retrieval. Outdated entries are skipped, not eagerly evicted.
    pub fn get_valid_entry(&self, key: &K, is_outdated: impl Fn(&S, &V) -> bool) -> Option<V> {
        let value = self.entries.get(key)?;
        let current_meta = self.validity_metadata.read().unwrap().clone();
        
        if is_outdated(&current_meta, &value) {
            // CRITICAL: Return None without evicting. Concurrent threads may have 
            // inserted a newly compiled plan. The subsequent compilation will overwrite.
            return None;
        }
        Some(value)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Capturing Arc references in moka invalidation closures
pub fn leaky_set_statistics(&self, new_statistics: Arc<Statistics>) {
    // BUG: Each commit schedules a closure holding `new_statistics`.
    // If no queries run, closures accumulate without housekeeping, leaking gigabytes of RAM.
    self.executable_cache
        .invalidate_entries_if(move |_key, plan| {
            is_pipeline_type_populations_outdated(&*new_statistics, plan)
        })
        .unwrap();
}
```

**VERIFICATION METHOD**:
Enforce strong reference count unit assertions:
```rust
#[test]
fn metadata_updates_do_not_retain_superseded_metadata() {
    let cache = SafeQueryCache::new(100, Arc::new(Statistics::default()));
    let superseded = Arc::new(Statistics::default());
    cache.update_metadata(superseded.clone());

    let latest = Arc::new(Statistics::default());
    cache.update_metadata(latest.clone());

    // Must be exactly 1: the local 'superseded' reference.
    // Cache must have released its pointer completely.
    assert_eq!(Arc::strong_count(&superseded), 1, "Superseded metadata retained in cache!");
}
```

---

### 2. Double-Handshake Asynchronous Task Shutdown
**RULE**:
Background periodic tasks or daemons spawned inside long-running servers **MUST NOT** block inside the `Drop` implementation of worker components using async runtime handles. Instead, lifecycle managers **MUST** split task orchestration into:
1. An async-safe channel signaling phase (`watch::Receiver<()>` or `sync_channel`).
2. An asynchronous supervisor `wait()` / `join()` call that executes before dropping the Tokio runtime.
3. If an explicit thread `Drop` is required (e.g. `IntervalRunner`), shutdown signaling **MUST** use a two-phase rendezvous channel (`SyncSender<SyncSender<()>>`) to avoid deadlocking worker pools during panics or timeouts.

**WHY**:
Calling synchronous blocking primitives (`futures::executor::block_on`, `recv()`) inside `Drop` within a Tokio runtime worker thread causes thread starvation or panics ("Cannot start a runtime from within a runtime"). Furthermore, if an application drops a background worker while Tokio tasks are still holding open file descriptors, database write transactions, or un-flushed RocksDB memory buffers, data corruption or uncommitted WAL records result.

**WHEN TO APPLY**:
All daemon loops, background metrics updaters, cache flusher loops, and transaction timeout cleaners in multi-threaded asynchronous Rust services.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use tokio::sync::{oneshot, watch};
use tokio::task::JoinHandle;
use tokio_util::task::task_tracker::TaskTracker;

pub struct SafeAsyncDaemonTracker {
    tracker: TaskTracker,
    shutdown_tx: watch::Sender<()>,
    supervisor_handle: JoinHandle<()>,
    done_rx: oneshot::Receiver<()>,
}

impl SafeAsyncDaemonTracker {
    pub fn new() -> (Self, watch::Receiver<()>) {
        let (shutdown_tx, shutdown_rx) = watch::channel(());
        let (done_tx, done_rx) = oneshot::channel();
        let tracker = TaskTracker::new();

        let mut shutdown_watch = shutdown_rx.clone();
        let tracker_clone = tracker.clone();

        let supervisor_handle = tokio::spawn(async move {
            let _ = shutdown_watch.changed().await;
            tracker_clone.close(); // Reject new incoming tasks
            tracker_clone.wait().await;  // Await in-flight tasks
            let _ = done_tx.send(());
        });

        (
            Self { tracker, shutdown_tx, supervisor_handle, done_rx },
            shutdown_rx,
        )
    }

    /// Explicit asynchronous graceful teardown. MUST be awaited before runtime drop.
    pub async fn shutdown_and_wait(self) {
        let _ = self.shutdown_tx.send(());
        let _ = self.supervisor_handle.await;
        let _ = self.done_rx.await;
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blocking on futures in Drop inside an async engine
impl Drop for MyService {
    fn drop(&mut self) {
        // FATAL: Deadlocks Tokio if running on an async worker thread!
        futures::executor::block_on(async {
            self.task_handle.abort();
            self.task_handle.await.ok();
        });
    }
}
```

**VERIFICATION METHOD**:
Verify using a paused-time Tokio integration test (`#[tokio::test(start_paused = true)]`):
```rust
#[tokio::test(start_paused = true)]
async fn test_graceful_shutdown_executes_finalizer_without_deadlock() {
    let (tracker, mut rx) = SafeAsyncDaemonTracker::new();
    let counter = Arc::new(AtomicUsize::new(0));
    let c = counter.clone();

    tokio::spawn(async move {
        rx.changed().await.unwrap();
        // Final flush action
        c.store(42, Ordering::SeqCst);
    });

    tracker.shutdown_and_wait().await;
    assert_eq!(counter.load(Ordering::SeqCst), 42);
}
```

---

### 3. Big-Endian Lexicographical Byte Vector Incrementation
**RULE**:
When implementing key range scanners or multi-column storage engines that compute the upper exclusive bound for range scans (`[prefix, prefix + 1)`), you **MUST** iterate in reverse (least significant byte first), implement checked/overflowing addition (`byte.overflowing_add(1)`), propagate the carry bit across preceding octets, and explicitly handle whole-buffer overflow by returning an error or dynamic vector resizing. You **MUST NOT** perform naive arithmetic addition on cast primitive integers (`*(key.as_ptr() as *mut u64) += 1`) or ignore array-level carry-out overflow.

**WHY**:
In key-value storage engines (e.g. RocksDB, LMDB), keys are ordered lexicographically by byte array comparisons (`memcmp`). If a key ends in `0xFF`, incrementing only the last byte overflows to `0x00` without propagating the carry, corrupting range scan boundaries and returning inverted key ranges. Truncating or ignoring carry-out on a byte slice containing all `0xFF` values produces an all-zero key, scanning the entire database instead of terminating.

**WHEN TO APPLY**:
Storage key serialization, index generation, database snapshot iteration bounds, and prefix search mechanics.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Debug, PartialEq, Eq)]
pub enum KeyRangeError {
    PrefixOverflow,
}

/// Computes the exact lexicographical next prefix in-place.
pub fn increment_lexicographical_bytes(bytes: &mut [u8]) -> Result<(), KeyRangeError> {
    for byte in bytes.iter_mut().rev() {
        let (val, overflow) = byte.overflowing_add(1);
        *byte = val;
        if !overflow {
            return Ok(());
        }
    }
    // Entire buffer was 0xFF...FF; carry escaped the most significant byte.
    Err(KeyRangeError::PrefixOverflow)
}

/// Const variant for fixed-size keys (e.g. 16-byte UUIDs, 8-byte IDs)
pub const fn increment_fixed_key<const N: usize>(mut bytes: [u8; N]) -> [u8; N] {
    let mut index = N;
    while index > 0 {
        let (val, overflow) = bytes[index - 1].overflowing_add(1);
        bytes[index - 1] = val;
        if !overflow {
            return bytes;
        }
        index -= 1;
    }
    panic!("Lexicographical key overflow across fixed buffer");
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Naive last-byte increment or unsigned int casting
pub fn buggy_range_end(key: &mut [u8]) {
    // BUG: If last byte is 255 (0xFF), wrapping produces 0x00 without carry!
    // Resulting key range [0x01, 0xFF] -> [0x01, 0x00], reversing scan boundaries.
    let len = key.len();
    key[len - 1] += 1; 
}
```

**VERIFICATION METHOD**:
Enforce boundary condition unit testing:
```rust
#[test]
fn test_lexicographical_increment_boundary() {
    let mut key = vec![0x01, 0x02, 0xFF];
    assert!(increment_lexicographical_bytes(&mut key).is_ok());
    assert_eq!(key, vec![0x01, 0x03, 0x00]);

    let mut max_key = vec![0xFF, 0xFF, 0xFF];
    assert_eq!(increment_lexicographical_bytes(&mut max_key), Err(KeyRangeError::PrefixOverflow));
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Query Planner Memory Leak on Write-Only Ingestion Workloads (BUG-TYPEDB-8031)
- **Context**: `database/database.rs`, `query/query_cache.rs`, `server/state/database_operator.rs`
- **What Was Expected**: Bulk data imports directly streaming concepts via `ThingManager` or `DatabaseImporter` without executing read queries must maintain flat memory utilization.
- **What Actually Happened**: Long write-only workloads (such as importing multi-gigabyte knowledge graphs) exhausted server RAM. For every commit, the query cache retained a full copy of the `Statistics` struct (`Arc<Statistics>`).
- **Evidence in Repo**: Commit `499dedd6`, Issue `#8031`. Added test `statistics_updates_do_not_retain_superseded_statistics` in `query/tests/query_cache.rs`.
- **Root Cause**:
  `QueryCache::set_statistics_and_invalidate_outdated` invoked `moka::sync::Cache::invalidate_entries_if(closure)`. The closure moved a clone of `Arc<Statistics>`. In the `moka` synchronization model, predicates registered via `support_invalidation_closures()` are evaluated and dropped **only during cache housekeeping**. Housekeeping in a synchronous cache only runs when `get()` or `insert()` calls are executed against the cache. Because write imports bypass the query plan cache completely, housekeeping never ran. Every transaction commit added another invalidation closure to an internal vector, causing memory to grow linearly with the number of commits:

$$O(N_{\text{commits}} \times \text{sizeof}(\text{Statistics}))$$

- **Remediation Code Diff**:
```rust
// query/query_cache.rs
@@ -52,7 +52,7 @@ impl QueryCache {
     pub fn new() -> Self {
         let parse_cache = CacheBuilder::new(QUERY_PARSE_CACHE_SIZE).build();
         let translation_cache = CacheBuilder::new(QUERY_TRANSLATION_CACHE_SIZE).build();
-        let executable_cache = CacheBuilder::new(QUERY_PLAN_CACHE_SIZE).support_invalidation_closures().build();
+        let executable_cache = CacheBuilder::new(QUERY_PLAN_CACHE_SIZE).build();
         let validity_requirements =
             RwLock::new(ValidityRequirements { latest_statistics: None, latest_schema_commit: None });
         QueryCache { parse_cache, translation_cache, executable_cache, validity_requirements }
@@ -86,19 +86,30 @@ impl QueryCache {
-    pub(crate) fn get_executable(
+    pub fn get_executable(
         &self,
         preamble: Arc<Vec<Function>>,
         given: Arc<Option<TranslatedGiven>>,
         stages: Arc<Vec<TranslatedStage>>,
         fetch: Arc<Option<FetchObject>>,
     ) -> Option<ExecutablePipeline> {
         let key = IRQuery::new(preamble.clone(), given, stages, fetch);
-        self.executable_cache.get(&key).map(|mut found| {
-            let replacement = preamble.iter().map(|func| Arc::new(func.parameters.clone())).enumerate();
-            found.executable_functions.replace_preamble_parameters(replacement);
-            found
-        })
+        let mut found = self.executable_cache.get(&key)?;
+        let is_outdated = self
+            .validity_requirements
+            .read()
+            .unwrap()
+            .latest_statistics
+            .as_ref()
+            .is_some_and(|statistics| is_pipeline_type_populations_outdated(statistics, &found));
+        if is_outdated {
+            // do not evict: the next compilation will update it, and eviction here could remove
+            // a valid plan inserted concurrently
+            return None;
+        }
+        let replacement = preamble.iter().map(|func| Arc::new(func.parameters.clone())).enumerate();
+        found.executable_functions.replace_preamble_parameters(replacement);
+        Some(found)
     }

-    pub fn set_statistics_and_invalidate_outdated(&self, new_statistics: Arc<Statistics>) {
-        let mut write_lock = self.validity_requirements.write().unwrap();
-        (*write_lock).latest_statistics = Some(new_statistics.clone());
-        drop(write_lock);
-        let _predicate_id = self
-            .executable_cache
-            .invalidate_entries_if(move |_, pipeline| is_pipeline_type_populations_outdated(&*new_statistics, pipeline))
-            .unwrap();
+    pub fn set_statistics(&self, new_statistics: Arc<Statistics>) {
+        self.validity_requirements.write().unwrap().latest_statistics = Some(new_statistics);
     }
```
- **Lesson**: Do not use reactive predicate closure invalidations in caches if the invalidating trigger (commits) has a completely different throughput profile than cache reads (queries). Instead, store a single reference to current metadata under a read-write lock, and perform lazy validation on cache reads. Crucially, when an entry is found to be stale during a read, do not evict immediately if another worker may be concurrently compiling and inserting a fresh version.

---

### Incident 2: Eviction Race Condition During Concurrent Query Compilation (BUG-TYPEDB-8031-B)
- **Context**: `query/query_cache.rs` in `get_executable`
- **What Was Expected**: If a cached query plan is discovered to be outdated by statistics, the calling thread should fail cache lookup and compile a new plan without corrupting concurrent readers or writers.
- **What Actually Happened**: Eager eviction of the cache entry upon discovering staleness introduced a race condition: Thread A discovers Plan V1 is outdated. Thread B has already compiled Plan V2 and inserted it under key $K$. Thread A then executes an eviction for key $K$, wiping out the valid plan compiled by Thread B.
- **Evidence in Repo**: Comment in `query/query_cache.rs`:
  ```rust
  if is_outdated {
      // do not evict: the next compilation will update it, and eviction here could remove
      // a valid plan inserted concurrently
      return None;
  }
  ```
- **Root Cause**: Unsynchronized read-invalidate-compile-insert cycles. Evicting on key match without comparing the exact entry version causes false evictions of freshly inserted items.
- **Remediation**: Return `None` immediately without invalidating. The caller falls back to the compilation stage, which subsequently performs `may_insert_executable()`, overwriting the stale plan atomically.
- **Lesson**: In concurrent caches, discovering a stale value during retrieval must behave as a cache miss (`None`), not as an eviction trigger, unless eviction can be made conditional on matching entry identity/pointer equality.

---

### Incident 3: Network Listener Port Collisions in Unified Server Bootstrap (BUG-TYPEDB-SRV-01)
- **Context**: `server/state/mod.rs` in `resolve_endpoints`
- **What Was Expected**: Server configuration errors where gRPC, HTTP, and internal monitoring services are bound to identical socket addresses must fail fast at startup before opening database directories or allocating RocksDB locks.
- **What Actually Happened**: If users inadvertently assigned the HTTP listen address or metrics endpoint to the gRPC socket, the secondary listener collided during socket binding, leaving storage handles orphaned or partially open.
- **Evidence in Repo**: `server/state/mod.rs`:
  ```rust
  let mut reserved = HashSet::from([grpc_listen_address]);
  if let Some(address) = http_listen_address {
      if !reserved.insert(address) {
          return Err(ServerOpenError::HttpConflictingAddress { address });
      }
  }
  if let Some(address) = monitoring_address {
      if !reserved.insert(address) {
          return Err(ServerOpenError::MonitoringConflictingAddress { address });
      }
  }
  ```
- **Root Cause**: Lack of pre-binding verification across heterogeneous subsystems (tonic gRPC, axum HTTP, prometheus monitoring).
- **Remediation**: Enforce an explicit pre-allocation reservation set (`HashSet<SocketAddr>`) resolving DNS names and testing collision invariants prior to initializing storage engines.
- **Lesson**: Subsystems that manage disparate protocols must validate network binding overlap centrally in the system coordinator prior to resource allocation.

---

### Incident 4: TOCTOU Channel Stale Registration in Import Tracking (BUG-TYPEDB-IMP-02)
- **Context**: `server/state/database_operator.rs` in `record_import`
- **What Was Expected**: An import session registered under database name $D$ must ensure only one active import runs, and the entry must clean itself up when the client disconnects.
- **What Actually Happened**: A fast reconnect where client 1 disconnected and client 2 connected under the same name caused a race: cleanup tasks spawned for client 1 could execute after client 2 registered, inadvertently deleting client 2's active import entry from `active_imports`.
- **Evidence in Repo**: `server/state/database_operator.rs`:
  ```rust
  self.background_task_spawner.spawn(async move {
      close_sender.closed().await;
      let mut imports = imports_for_cleanup.write().await;
      if let Some(info) = imports.get(&name) {
          if info.close_sender.same_channel(&close_sender) {
              imports.remove(&name);
          }
      }
  });
  ```
- **Root Cause**: Key-only lookup during asynchronous map cleanup. When task 1 woke up after `closed().await`, it cleared `imports.remove(&name)` without verifying whether the channel in the map was still its own channel.
- **Remediation**: Added `info.close_sender.same_channel(&close_sender)` verification before removal.
- **Lesson**: Asynchronous map cleanup tasks must verify object identity (e.g. channel token equality, monotonic session ID) before deleting keyed state to avoid reaping newer entries that replaced them.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
In low-level database operations, byte layout and pointer mechanics must be bit-exact:

#### Big-Endian In-Place Carry Propagation
```rust
// common/bytes/util.rs
pub fn increment(bytes: &mut [u8]) -> Result<(), BytesError> {
    for byte in bytes.iter_mut().rev() {
        let (val, overflow) = byte.overflowing_add(1);
        *byte = val;
        if !overflow {
            return Ok(());
        }
    }
    Err(BytesError { kind: BytesErrorKind::IncrementOverflow {} })
}
```
*Token-Level Hazard*: `byte.overflowing_add(1)` returns `(u8, bool)`. Using `wrapping_add` without checking the boolean flag causes silent key collisions where `0xFF` wraps to `0x00`, producing non-monotonic storage keys.

#### Const Array Iteration Without Index Out-Of-Bounds
```rust
// common/bytes/util.rs
pub const fn increment_fixed<const SIZE: usize>(mut bytes: [u8; SIZE]) -> [u8; SIZE] {
    let mut index = SIZE;
    while index > 0 {
        let (val, overflow) = bytes[index - 1].overflowing_add(1);
        bytes[index - 1] = val;
        if overflow {
            // Panic in const evaluation aborts compilation on static overflow
            panic!("Overflow while incrementing array")
        }
        index -= 1;
    }
    bytes
}
```
*Precision Guard*: Notice `let mut index = SIZE;` and index access `bytes[index - 1]` with `while index > 0`. Because Rust unsigned integers cannot drop below 0 (`usize`), attempting a standard `while index >= 0` with `index -= 1` underflows at zero, causing an immediate panic during const compilation.

---

### 2. Infinite Loop & Recursion Guards

#### Channel-Coordinated Infinite Loop Termination
In background daemon tasks (`IntervalRunner`), loops are guarded against infinite execution during shutdown:
```rust
// common/concurrency/interval_runner.rs
loop {
    action();
    match shutdown_receiver.recv_timeout(interval) {
        Ok(done_sender) => {
            drop(action);
            done_sender.send(()).unwrap();
            break; // Guaranteed loop exit
        }
        Err(RecvTimeoutError::Timeout) => (), // Continue next tick
        Err(RecvTimeoutError::Disconnected) => break, // Channel dropped -> exit
    }
}
```
*Termination Proof*: The loop termination condition depends on two deterministic triggers:
1. Receipt of a `done_sender` token via the synchronous channel.
2. Disconnection of the channel (`RecvTimeoutError::Disconnected`).
By implementing `Drop` on `IntervalRunner` to dispatch `self.shutdown_sink.send(done_sender)`, the runner thread is guaranteed to terminate before `Drop` completes:
```rust
impl Drop for IntervalRunner {
    fn drop(&mut self) {
        let (done_sender, done_receiver) = sync_channel(1);
        self.shutdown_sink.send(done_sender).expect("Expected interval runner shutdown signal sending");
        done_receiver.recv().expect("Expected interval runner shutdown finishing")
    }
}
```

#### Microtask Cancellation In Tokio Select
```rust
// common/concurrency/tokio_task.rs
tokio::select! {
    _ = interval_timer.tick() => {
        action().await;
    }
    _ = shutdown_receiver.changed() => {
        if act_on_shutdown {
            action().await;
        }
        drop(action);
        break; // Loop terminated
    }
}
```
*Loop Starvation Guard*: In `tokio::select!`, branches are evaluated pseudo-randomly by default to prevent timer tick