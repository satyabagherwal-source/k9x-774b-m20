> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/valeriansaliou-sonic-learnings.md`  
> **Source**: github ([https://github.com/valeriansaliou/sonic](https://github.com/valeriansaliou/sonic))  
> **Source Version**: `f16560b6`  
> **License**: MPL-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-31T08:28:10.079Z  
> **Learning ID**: `learn-github-valeriansaliou-sonic`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): valeriansaliou/sonic

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Problem Sonic Solves
Sonic is a schema-less, cloud-native search and auto-complete indexing daemon written in Rust. It functions strictly as an **identifier index** rather than a heavy document store (such as Elasticsearch or OpenSearch). Sonic indexes tuples of `(collection, bucket, object_id, terms)` and responds to queries with compact ID vectors within microsecond latency profiles ($\mu\text{s}$ range), maintaining a lightweight resident memory footprint (~30MB RAM) on minimal compute (1-vCPU).

### Architectural Boundaries & Subsystem Decoupling
The architecture is partitioned into three foundational crates within a Cargo workspace (`edition = "2024"`, `resolver = "3"`):

```
+---------------------------------------------------------------------------------------+
|                                    sonic-server                                       |
|  TCP Listeners (Port 1491) <---> Channel Dispatcher <---> Worker Thread Pool / Tasks  |
|  (Search, Ingest, Control)                                                            |
+------------------------------------------+--------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                     sonic-core                                        |
|  +---------------------------------------------------------------------------------+  |
|  |                                  Executor                                       |  |
|  |  +-------------------------------------+   +---------------------------------+  |  |
|  |  |           FstStorePool              |   |          KvStorePool            |  |  |
|  |  |   Radix Tree / Finite State Trans.  |   |   Embedded RocksDB Engine       |  |  |
|  |  |   - Lexicon word graphs             |   |   - OID <-> IID mapping         |  |  |
|  |  |   - Fast prefix / typo suggestions  |   |   - IID -> Inverted Term Lists  |  |  |
|  |  |   - Lock: RWLock graph access       |   |   - Lock: Hierarchical DB Lock  |  |  |
|  |  +-------------------------------------+   +---------------------------------+  |  |
|  |  +---------------------------------------------------------------------------+  |  |
|  |  | DynamicConfigStore (Lock-free Read / Read-heavy HashMap with NoopU32Hash) |  |  |
|  |  +---------------------------------------------------------------------------+  |  |
|  +---------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------+
                                           ^
                                           |
+------------------------------------------+--------------------------------------------+
|                                    sonic-client                                       |
|  Multiplexer <---> SonicChannel<Mode> (Transport Layer: SonicStream / Mock / Log)    |
|  Synchronous Blocking / Asynchronous Tokio Wrappers                                   |
+---------------------------------------------------------------------------------------+
```

1. **`sonic-server`**: Network boundary and protocol parser. Implements line-delimited plain-text ASCII/UTF-8 commands (`START <mode>`, `QUERY`, `SUGGEST`, `PUSH`, `POP`, `FLUSHB`, `FLUSHC`, `TRIGGER`). It isolates client socket operations into dedicated channel threads or worker loops.
2. **`sonic-core`**: The stateful engine. It couples two distinct database primitives per collection:
   - **FST (Finite State Transducer) Pool**: In-memory and memory-mapped graphs representing the full lexicon for prefix searches and typo-tolerant Levenshtein automations.
   - **KV (RocksDB) Pool**: Key-Value LSM storage managing dense mappings between external string keys (`StoreObjectOid`), internal surrogate numeric identifiers (`StoreObjectIid`), and serialized inverted posting lists.
3. **`sonic-client`**: Client driver library exposing both non-blocking low-level primitives, high-level synchronous blocking APIs (`SonicChannelIngestBlocking`, `SonicChannelSearchBlocking`), and asynchronous Tokio runtimes (`SonicChannelSearchAsync`).

### Core Subsystem Abstractions & State Invariants
- **Identifier Separation Invariant (`OID` vs `IID`)**: Sonic never stores actual document payloads in its KV tier. It maps external string OIDs (`StoreObjectOid`) to dense integer IIDs (`StoreObjectIid`). The inverted index maps `IID -> Vec<Term>` and `Term -> Vec<IID>`.
- **Two-Tier Synchronization Hierarchy**: Read/write concurrency is structured hierarchically. The global store pool enforces broad collection lifecycle guards (`kv_pool.lock_read_access()`, `fst_pool.lock_write_access()`), whereas individual collection instances maintain localized internal read-write locks (`kv_store.lock.read()` and `kv_store.lock.write()`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Ephemeral I/O Result Containment & Panic Prohibition
**RULE**:
Network servers and daemon connection threads MUST NEVER invoke panic-inducing unwraps (`.unwrap()`, `.expect()`) or unhandled `panic!()` arms on socket I/O operations (such as writes, flushes, or reads). Socket I/O errors (`BrokenPipe`, `ConnectionReset`, `TimedOut`, `UnexpectedEof`) MUST be treated as routine stream terminations, triggering an orderly disconnection state machine (`Close`), releasing tracking counters, and returning cleanly.

**WHY**:
Clients frequently abort connections, close TCP sockets prematurely upon receiving partial payloads, or time out during slow processing loops. Calling `.expect("write failed")` on a network handle converts standard external network turbulence into internal unhandled thread panics. This bypasses telemetry updates, leaves metrics in corrupted states (e.g., mismatched `CLIENTS_CONNECTED` counters), spews noise into `stderr`, and risks worker thread exhaustion.

**WHEN TO APPLY**:
In all TCP/UDP/Unix socket listeners, channel handlers, protocol decoders, and stream response serializers across any language (Rust, Go, C++, Zig).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In channel message dispatch loop:
match write!(stream, "{}{}", response_args.0, LINE_FEED) {
    Ok(()) => {
        tracing::trace!("wrote response: {}", response_args.0);
    }
    Err(err) => {
        // Treat BrokenPipe, ConnectionReset, and TimedOut as normal client disconnects
        tracing::debug!("client disconnected before response write completed: {err}");
        // Transition internal channel state to terminal Close
        result = ChannelMessageResult::Close;
        break;
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Panicking on socket write
write!(stream, "{}{}", response_args.0, LINE_FEED)
    .expect("write failed"); // NEVER DO THIS: Kills channel thread if client terminates TCP socket
```

**VERIFICATION METHOD**:
Run an integration test where a client opens a socket, sends an ingest/search command, and immediately issues `TCP RST` / closes the stream without reading. Verify via assertions that:
1. The server process emits no panic logs to stderr.
2. The active thread pool count remains steady.
3. Connected client gauges decrement to zero.

---

### 2. Lock-Inversion Avoidance in Granular Storage Cascades
**RULE**:
When an operation requires mutating multiple tiers of a persistent storage system (e.g., dropping both primary storage and derived index graphs), acquisition of structural pool guards MUST precede instance-level handles. Under NO circumstances may an inner action re-acquire an already held parent lock or call a helper that requests an identical read/write lock.

**WHY**:
Invoking convenience methods (e.g., `batch_erase_bucket()` calling an internal bucket erasure helper that attempts `kv_store.lock.write()`) from an execution context that already owns `kv_store.lock.write()` guarantees immediate self-deadlock. Similarly, retaining an acquired reference across an erasure boundary prevents underlying file descriptors and memory-mapped pointers from being dropped, resulting in `EBUSY` or leaked handles.

**WHEN TO APPLY**:
Multi-engine or tiered storage engines (e.g., RocksDB + FST, SQLite + Vector Cache, LMDB + Memtable) managing layered collections, buckets, or namespaces.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified hierarchical locking sequence:
// 1. Acquire global storage read guards to freeze topology modifications
let _kv_read_guard = self.kv_pool.lock_read_access();
let _fst_write_guard = self.fst_pool.lock_write_access();

if let Ok(Some(kv_store)) = self.kv_pool.acquire(false, collection, None, |_| {}) {
    // 2. Explicitly acquire store-level lock inside caller scope
    let kv_store_ref = kv_store.clone();
    let _kv_store_lock = kv_store_ref.lock.write().unwrap();

    // 3. Perform atomic batch modifications without delegating to helper functions 
    //    that attempt to re-acquire _kv_store_lock
    let kv_action = kv_store.access_read_write(bucket);
    let erase_count = kv_action.batch_erase_bucket()?;
    
    // 4. Cascade to secondary index pool
    self.fst_pool.erase(collection, Some(bucket))?;
    return Ok(erase_count);
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Calling helper method that internally requests kv_store.lock.write()
let _kv_store_lock = kv_store.lock.write().unwrap();
// helper_erase_bucket internally invokes: kv_store.lock.write().unwrap() -> DEADLOCK
let erase_count = kv_store.helper_erase_bucket(bucket)?; 
```

**VERIFICATION METHOD**:
Automated stress test asserting that concurrent `FLUSHB` (flush bucket) and `FLUSHC` (flush collection) executions under continuous parallel writes complete within bounded timeouts (e.g., 500ms) without triggering deadlock thread stalls.

---

### 3. Chunked Stream Document Boundary Cohesion
**RULE**:
When high-throughput ingest protocols allow document fragmentation or streaming ingestion chunked by network buffer limits (`BUFFER_SIZE`), internal surrogate ID generators MUST enforce sticky session continuity across chunk boundaries using stateful deduplication buffers (`last_assumed_new_oid`).

**WHY**:
If an ingestion protocol offers an optimization like `PUSH ... NEW` (which generates a new internal `IID` for newly inserted records), documents larger than the client/server network buffer will arrive across multiple consecutive chunks. Without sticky tracking, each sub-chunk of the single logical document receives a completely separate `IID`. This fragments inverted term indices, corrupts TF-IDF/BM25 relevance statistics, and breaks document deletion workflows.

**WHEN TO APPLY**:
Stream ingestion protocols, line-delimited socket APIs, or bulk-insert interfaces handling variable-length text records that exceed transport MTU or application buffer frames.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In Executor ingestion state:
pub struct Executor {
    // ...
    last_assumed_new_oid: RwLock<Option<(String, StoreObjectIid)>>,
}

// In push handler:
let mut last_assumed = self.last_assumed_new_oid.write().unwrap();
let iid = match *last_assumed {
    Some((ref last_oid, existing_iid)) if last_oid == requested_oid => {
        // Reuse surrogate IID: document is continuing over chunk boundary
        existing_iid
    }
    _ => {
        let new_iid = self.allocate_new_iid(collection, bucket, requested_oid)?;
        *last_assumed = Some((requested_oid.to_string(), new_iid));
        new_iid
    }
};
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Unconditionally allocating a fresh surrogate ID on every NEW packet
if is_new_flag_set {
    let iid = self.allocate_new_iid(); // Broken: Large document split over 2 buffers gets 2 distinct IIDs!
}
```

**VERIFICATION METHOD**:
Construct an ingest test payload sized at `3 * BUFFER_SIZE` containing repeated keywords. Ingest via `PUSH ... NEW`. Query the count of total unique objects (`COUNTB`). Assert strictly that `COUNTB == 1` and that a query for the keywords returns exactly one document identifier.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Socket Write Panic on Premature Client Disconnection (BUG-SONIC-01)
- **Context**: `server/src/channel/handle.rs` and `server/src/channel/message.rs`
- **What Was Expected**: When a connected client terminates early, resets the connection (`ECONNRESET`), or times out, the server should gracefully close the channel, log at debug level, update command-count metrics, and clean up thread resources.
- **What Actually Happened**: The channel write routines utilized `.expect("write failed")` across response banners, startup acknowledgments (`STARTED`), and response lines. When a client closed its socket immediately after issuing a query (or timed out), the write failed with `BrokenPipe`, `ConnectionReset`, or `TimedOut`. The `.expect()` panicked the channel worker thread, logging stack traces to stderr and bypassing statistics updates.
- **Evidence in Repo**: Commit `50139cfe`, PR #440, Issue #438.
- **Root Cause**: Developer assumption that local network socket writes on open descriptors would never fail synchronously, neglecting premature socket shutdown by external clients.
- **Remediation Code Diff**:
```diff
--- a/server/src/channel/handle.rs
+++ b/server/src/channel/handle.rs
@@ -77,7 +77,11 @@ impl ChannelHandle {
         self.configure_stream(&stream, false);
 
         // Send connected banner
-        write!(stream, "{}{}", CONNECTED_BANNER, LINE_FEED).expect("write failed");
+        if let Err(err) = write!(stream, "{}{}", CONNECTED_BANNER, LINE_FEED) {
+            tracing::debug!("failed writing connected banner: {err}");
+            return;
+        }
 
         // Increment connected clients count
         *CLIENTS_CONNECTED.write().unwrap() += 1;
@@ -101,23 +105,26 @@ impl ChannelHandle {
                 self.configure_stream(&stream, true);
 
                 // Send started acknowledgement (with environment variables)
-                write!(
+                if let Err(err) = write!(
                     stream,
                     "STARTED {} protocol({}) buffer({}){}",
                     mode.to_str(),
                     PROTOCOL_REVISION,
                     BUFFER_SIZE,
                     LINE_FEED
-                )
-                .expect("write failed");
+                ) {
+                    tracing::debug!("failed writing started acknowledgement: {err}");
+                    return;
+                }
 
                 self.handle_stream(mode, stream)
                     .unwrap_or_else(|err| tracing::error!("closing channel thread: {err:?}"));
             }
             Err(err) => match write!(stream, "ENDED {}{}", err.to_str(), LINE_FEED) {
                 Ok(()) => {}
                 Err(err) if err.kind() == ErrorKind::BrokenPipe => {}
-                Err(err) => panic!("write failed: {err:?}"),
+                Err(err) => tracing::debug!("failed writing ended response: {err}"),
             },
         }
     }
--- a/server/src/channel/message.rs
+++ b/server/src/channel/message.rs
@@ -97,16 +97,27 @@ pub trait ChannelMessageMode {
                 if let Some(ref values) = response_args.1 {
                     let values_string = values.join(" ");
 
-                    write!(stream, "{} {}{}", response_args.0, values_string, LINE_FEED)
-                        .expect("write failed");
+                    if let Err(err) =
+                        write!(stream, "{} {}{}", response_args.0, values_string, LINE_FEED)
+                    {
+                        tracing::debug!("failed writing response: {err}");
+                        result = ChannelMessageResult::Close;
+                        break;
+                    }
```
- **Lesson**: I/O errors across network sockets are nominal state transitions, not fatal invariant violations; use result matching to update disconnection states cleanly.

---

### Incident 2: Silent RocksDB Compaction Failure & File Descriptor Exhaustion (BUG-SONIC-02)
- **Context**: `core/src/executor/mod.rs` & storage compaction triggers
- **What Was Expected**: Issuing manual compaction (`TRIGGER compact`) must ensure LSM level-0 SST files are compacted into deeper levels and propagate any underlying I/O errors or operating system capacity limits back to the orchestrator.
- **What Actually Happened**: The low-level RocksDB call `compact_range` returned `()`. SST compaction silently failed in the background due to hitting the system `RLIMIT_NOFILE` ("Too many open files"), leaving hundreds of uncompacted L0 files accumulating on disk, degrading read performance without alerting the application.
- **Evidence in Repo**: Issue #433.
- **Root Cause**: Failure to invoke synchronization and error-inspection routines after asynchronous C-FFI compaction triggers; compaction was assumed to succeed synchronously.
- **Remediation Code Diff**:
```rust
// Architectural fix in storage engine:
// Instead of fire-and-forget:
// rocksdb.compact_range(None::<&[u8]>, None::<&[u8]>);
// Must synchronize and inspect status:
let mut compact_opts = rocksdb::CompactOptions::default();
compact_opts.set_exclusive_manual_compaction(true);
db.compact_range_opt(None::<&[u8]>, None::<&[u8]>, &compact_opts);
if let Err(err) = db.wait_for_compact(&rocksdb::WaitForCompactOptions::default()) {
    tracing::error!("Compaction failed: {err:?}");
    return Err(err.into());
}
```
- **Lesson**: Asynchronous storage operations with void return signatures must be paired with explicit completion synchronization (`wait_for_compact`) before verifying state transitions.

---

### Incident 3: Fragmented OID-to-IID Desynchronization Across Chunked Buffer Ingestion (BUG-SONIC-03)
- **Context**: `core/src/executor/mod.rs` & `core/src/executor/push.rs`
- **What Was Expected**: Ingesting large document streams spanning multiple network buffers via `PUSH ... NEW` should associate all parsed tokens with a single assigned internal identifier (`StoreObjectIid`).
- **What Actually Happened**: Sonic indexed the same physical document across multiple distinct `IID` allocations when the content length exceeded `BUFFER_SIZE` (default 20,000 bytes). Subsequent updates and search scoring were split across orphaned surrogate IDs.
- **Evidence in Repo**: `core/src/executor/mod.rs` lines 34-45, Issue #405.
- **Root Cause**: Absence of continuity state in the ingest executor across consecutive commands; the `NEW` instruction unconditionally minted a new `StoreObjectIid`.
- **Remediation Code Diff**:
```rust
// Added in Executor:
pub struct Executor {
    // ...
    last_assumed_new_oid: RwLock<Option<(String, StoreObjectIid)>>,
}

// Continuity validation on PUSH execution:
let iid = {
    let mut last_assumed = self.last_assumed_new_oid.write().unwrap();
    if let Some((ref last_oid, existing_iid)) = *last_assumed {
        if last_oid == oid_str {
            existing_iid
        } else {
            let fresh = self.allocate_iid(collection, bucket, oid)?;
            *last_assumed = Some((oid_str.to_string(), fresh));
            fresh
        }
    } else {
        let fresh = self.allocate_iid(collection, bucket, oid)?;
        *last_assumed = Some((oid_str.to_string(), fresh));
        fresh
    }
};
```
- **Lesson**: Stateful protocol flags that span chunked transport payloads must maintain a bounded sliding window of identity caches.

---

### Incident 4: Self-Deadlock on Nested Bucket Erasure Lock Acquisition (BUG-SONIC-04)
- **Context**: `core/src/executor/flushb.rs`
- **What Was Expected**: Erasing an individual bucket from a collection should wipe its keys from RocksDB and drop its FST graph without blocking concurrent access to other buckets.
- **What Actually Happened**: The executor attempted to acquire the bucket's write lock, and then called a helper method on `kv_store` which internally re-attempted to lock the same `RwLock`, deadlocking the worker thread permanently.
- **Evidence in Repo**: `core/src/executor/flushb.rs` lines 28–34:
  `// Notice: we cannot use the provided KV bucket erasure helper there, as erasing a bucket requires a database lock, which would incur a dead-lock...`
- **Root Cause**: Recursive re-entrancy into a non-reentrant standard library `std::sync::RwLock`.
- **Remediation Code Diff**:
```rust
// Refactored in flushb.rs:
// Bypass the re-locking helper entirely and construct atomic batch writes directly:
let kv_action = kv_store.access_read_write(bucket);
if let Ok(erase_count) = kv_action.batch_erase_bucket() {
    if self.fst_pool.erase(collection, Some(bucket)).is_ok() {
        tracing::debug!("done with bucket erasure");
        return Ok(erase_count);
    }
}
```
- **Lesson**: Avoid internal convenience methods that wrap locks if callers already hold parent locks; decompose operations into lock-free execution paths taking pre-acquired guards.

---

### Incident 5: Resource Stale Handle Leak on Collection Dropping (BUG-SONIC-05)
- **Context**: `core/src/executor/flushc.rs`
- **What Was Expected**: Calling `FLUSHC` must purge an entire collection, closing RocksDB column families/databases and unmapping memory-mapped FST files.
- **What Actually Happened**: When `flushc` acquired store references prior to invoking pool erasure, the local thread held open atomic reference counters (`Arc<Store>`). This prevented `drop()` from running, blocking operating system unlinking of backing directory structures.
- **Evidence in Repo**: `core/src/executor/flushc.rs` lines 12–16:
  `// Important: do not acquire the store from there, as otherwise it will remain open even if dropped in the inner function...`
- **Root Cause**: Scope leakage of `Arc` references in the caller frame holding file locks during deletion routines.
- **Remediation Code Diff**:
```rust
// Enforce strict acquisition prohibition in flushc.rs:
pub fn flushc(&self, collection: StoreItemPart) -> Result<u32, ()> {
    // DO NOT ACQUIRE STORE HANDLE HERE.
    // Acquire KV + FST locks exclusively in write mode:
    let _kv_write_guard = self.kv_pool.lock_write_access();
    let _fst_write_guard = self.fst_pool.lock_write_access();

    // Delegate directly to pool-level erasure which owns the solitary master handle:
    match (
        self.kv_pool.erase(collection, None),
        self.fst_pool.erase(collection, None),
    ) {
        (Ok(erase_count), Ok(_)) => Ok(erase_count),
        _ => Err(()),
    }
}
```
- **Lesson**: Destruction handlers must isolate and release all smart pointers (`Arc`/`Rc`) before triggering disk unlinking.

---

### Incident 6: Supply Chain Vulnerability Remediation & Security Pinning (BUG-SONIC-06)
- **Context**: `Cargo.lock`, `client/Cargo.toml`, and `deny.toml`
- **What Was Expected**: Automated dependency auditing (`cargo-deny`) should reject unvetted crates with security advisories.
- **What Actually Happened**: Four upstream vulnerabilities were detected in core dependencies: `RUSTSEC-2026-0386`, `RUSTSEC-2026-0391`, `RUSTSEC-2026-0398`, and `RUSTSEC-2026-0403` impacting `arrow-*`, `encoding_rs`, `icu_*`, and `zstd-safe`.
- **Evidence in Repo**: Commit `a0dcf0fa`.
- **Root Cause**: Bit rot in transient dependencies pulling vulnerable C-FFI wrappers and parsing crates.
- **Remediation Code Diff**:
```diff
--- a/deny.toml
+++ b/deny.toml
@@ -80,8 +80,8 @@ allow-build-scripts = [
-    "wasm-bindgen-shared@0.2.129",
-    "wasm-bindgen@0.2.129",
+    "wasm-bindgen-shared@0.2.130",
+    "wasm-bindgen@0.2.130",
-    "zstd-safe@7.3.0",
+    "zstd-safe@8.2.0",
```
- **Lesson**: Strict CI enforcement with `deny.toml` allow-build-scripts guarantees that no unreviewed native build scripts or vulnerable C bindings compile into the search binary.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Preallocated Exact String Capacity**: String command generation macros (`make_command!`) MUST avoid run-time buffer reallocations by computing total byte capacities at compile time:
  ```rust
  let mut message: String = String::with_capacity(
      $format.len()
          $(+ $arg.len())*
          $(+ ($text.len() * 2))? // Accounts for worst-case character escaping
          $(+ ($options.len() * 16))? // Accounts for space + standard option flag
  );
  ```
- **String Escaping Invariant**: In `escape_str(str: &str)`, never mutate strings in place without initial capacity reservation. Characters `'"'`, `'\\'`, `'\r'`, `'\n'` expand from 1 byte to 2 bytes (`\"`, `\\`, `\r`, `\n`). The string buffer MUST be initialized with `str.len() * 2` to eliminate intermediate heap reallocations:
  ```rust
  let mut res = String::with_capacity(str.len() * 2);
  for c in str.chars() {
      match c {
          '"' => res.push_str("\\\""),
          '\r' => res.push_str("\\r"),
          '\n' => res.push_str("\\n"),
          '\\' => res.push_str("\\\\"),
          _ => res.push(c),
      }
  }
  ```
- **Zero Configuration Invariant**: In `core/src/config.rs`, values with structural dependencies MUST be checked for non-zero:
  ```rust
  if self.store.kv.database.write_buffer_size == Some(0) {
      panic!("write_buffer for kv must not be zero");
  }
  // Structural ordering invariant:
  if self.store.kv.database.flush_after >= self.store.kv.pool.inactive_after {
      panic!("flush_after for kv must be strictly lower than inactive_after");
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **Finite State Transducer Traversal**: When traversing lexical graphs for auto-completion or Levenshtein typo distance (`query_alternates_try`), search algorithms MUST impose a strict upper bound via depth caps and bounded iterators:
  ```rust
  // Enforce traversal limit invariants:
  let limit = limit.min(self.app_conf.search.suggest_limit_maximum as usize);
  ```
- **Microtask & Yield Bounds**: Background janitor threads cycling through collections for inactivity consolidation MUST sleep or yield after each sweep:
  ```rust
  // Compaction and flush janitor termination proof:
  loop {
      std::thread::park_timeout(std::time::Duration::from_secs(janitor_interval));
      if terminate_flag.load(Ordering::Relaxed) {
          break; // Clean invariant termination
      }
      self.sweep_inactive_stores();
  }
  ```

### 3. UI & UX Micro-Mechanics (Client Protocol Mechanics)
- **Synchronous Drop Cleanup**: When a high-level client channel struct (`SonicChannelIngestBlocking`, `SonicChannelSearchBlocking`) falls out of scope, its `Drop` implementation MUST transmit an orderly protocol exit (`QUIT`) with a bounded timeout rather than leaving the socket to hang:
  ```rust
  impl Drop for $low_level_ty {
      #[inline]
      fn drop(&mut self) {
          if !self.inner.is_closed() {
              $crate::logging::log_trace!(concat!("[Drop] Quitting ", stringify!($low_level_ty)));
              self.quit_blocking_().unwrap_or_else(|error| crate::logging::log_error!("{error:?}"));
          }
      }
  }
  ```
  The quit command MUST be constrained by `recv_timeout` to prevent process shutdown lockups if the server is unreachable.

### 4. Backend Concurrency & Memory Safety
- **No-Op U32 Hash Optimization**: For numeric collection IDs (which are already securely hashed or mapped to compact 32-bit representations), standard cryptographic hashing overhead (`SipHash`) is bypassed in favor of an identity hasher:
  ```rust
  pub struct DynamicConfigStore(RwLock<HashMap<u32, DynamicConfig, NoopU32HasherBuilder>>);
  ```
  This eliminates hashing latency on the critical query-path lock lookup.
- **TOCTOU Race Condition Guards**: In `count.rs`, before reading