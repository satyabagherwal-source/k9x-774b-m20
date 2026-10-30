> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/redisearch-redisearch-learnings.md`  
> **Source**: github ([https://github.com/RediSearch/RediSearch](https://github.com/RediSearch/RediSearch))  
> **Source Version**: `0bf17e14`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T07:33:27.748Z  
> **Learning ID**: `learn-github-redisearch-redisearch`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): RediSearch/RediSearch

---

## 1. Executive Forensic Architecture & System Mechanics

RediSearch is an in-process, high-performance search and secondary indexing engine implemented as a hybrid C/Rust Redis Module (and native engine component in Redis 8+). It provides real-time full-text indexing, vector similarity search, geospatial querying, and structured aggregation across Redis HASH and JSON data types.

```
+---------------------------------------------------------------------------------------------------+
|                                        REDIS MAIN THREAD                                          |
|                                                                                                   |
|  [ Command Dispatch ]                                                                             |
|          |                                                                                        |
|          v                                                                                        |
|  [ Query AST Parser ] ---> [ applyGlobalFilters ] ---> Main-Thread GIL Key Lookup (Disk Mode)     |
|          |                         |                                                              |
|          |                         +-----------------+                                            |
|          v                                           v                                            |
|  [ Thread Hand-off ]                        [ Lazy KeyMap Activation ]                            |
|          |                                           |                                            |
+----------|-------------------------------------------|--------------------------------------------+
           |                                           |  (Enqueues batch to reindex pool)
           v                                           v
+------------------------------------+      +-------------------------------------------------------+
|        QUERY WORKER POOL           |      |                  REINDEX WORKER POOL                  |
|                                    |      |                                                       |
|  prepareExecutionPlan()            |      |  KeyMapBuild_Run()                                    |
|    |                               |      |    |                                                  |
|    +-- [ If KeyMap Ready ]         |      |    +-- Promote WeakRef<IndexSpec>                     |
|    |     Resolve via DocKeyMap     |      |    +-- Acquire IndexSpec Write Lock (NO GIL)          |
|    |     (Rust hashbrown / ahash)  |      |    +-- Traverse Buckets (Batch = 1024 docs)           |
|    |                               |      |    +-- Idempotent DocKeyMap_InsertIfAbsent            |
|    +-- [ If KeyMap Building ]      |      |    +-- Yield & Requeue Low-Priority Work              |
|          Temporarily acquire GIL   |      +-------------------------------------------------------+
|          Fall back to DocIdMeta    |
|                                    |
|  Evaluate Execution Plan           |
|  under IndexSpec Read Lock         |
+------------------------------------+
```

### Architectural Subsystem Boundaries and Invariants
1. **The Dual Execution Model (Main-Thread vs. Query Workers)**:
   - Redis enforces single-threaded guarantees via its Global Interpreter Lock (GIL). Query parsing, client admission, and dispatch take place on the main thread.
   - Long-running read queries run concurrently inside thread-pool workers (`redisearch_thpool_t`) without the GIL, synchronized by per-index reader-writer locks (`IndexSpec_LockRead` / `IndexSpec_LockWrite`).
2. **The Document Table Subsystem (`DocTable`)**:
   - Maintains bidirectional relationships between external string keys and internal dense 64-bit document IDs (`t_docId`).
   - Maps `t_docId -> RSDocumentMetadata (DMD)`. The reverse mapping (`key -> t_docId`) is handled either via Redis key-metadata structures (`DocIdMeta`, which mandates GIL ownership) or via an in-memory index key map (`DocKeyMap`, a Rust-backed SIMD hash table queryable under the `IndexSpec` read lock without the GIL).
3. **The C-to-Rust Foreign Function Interface (FFI) Boundary**:
   - High-throughput indexing algorithms, vector quantization, and hash lookup routines reside in Rust (`src/redisearch_rs/c_entrypoint/doc_key_map_ffi`).
   - Memory management is zero-copy where possible: query strings and keys are borrowed across the FFI boundary as raw byte pointers (`const uint8_t *key, size_t len`), and Rust hash tables invoke C comparison callbacks (`docKeyMatches`) directly into pinned C metadata structs without copying payload strings into the Rust runtime.
4. **Lock Inversion and GIL Handoff Constraints**:
   - The lock hierarchy strictly dictates: **GIL precedes IndexSpec Locks**.
   - If a background worker holding an `IndexSpec` read lock requires access to GIL-bound structures (such as during unbackfilled key lookups), it **must unlock `IndexSpec`**, acquire the GIL (`RedisModule_ThreadSafeContextLock`), and re-acquire `IndexSpec` read lock to eliminate deadlock cycles with main-thread writers.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. The Strict Lock-Hierarchy GIL Release-Reacquire Pattern
**RULE**:
When an asynchronous worker thread holding an inner domain lock (e.g., `IndexSpec`) requires access to an outer engine orchestrator lock (e.g., Redis GIL), the worker **MUST NOT** perform a blocking acquisition of the outer lock while holding the inner lock. The worker **MUST** completely release the inner lock, acquire the outer lock, and re-acquire the inner lock in strict global order. Furthermore, all state invariants validated prior to releasing the inner lock **MUST** be re-verified after re-acquisition.

**WHY**:
Failing to release the inner lock violates strict lock ordering. Main-thread operations acquire the GIL *first* upon handling socket events, and subsequently request the inner `IndexSpec` write lock to execute updates or deletes. If a background query worker holds the `IndexSpec` read lock and blocks awaiting the GIL, an unrecoverable AB-BA deadlock freezes the entire Redis engine.

**WHEN TO APPLY**:
Apply to any multi-threaded architecture extending a single-threaded runtime through modules, plugins, or extensions (e.g., Redis Modules, Python C extensions, Node.js N-API addons, database storage engine worker pools).

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production pattern from src/aggregate/aggregate_exec.c
static int prepareExecutionPlanWithKeyMapFallback(AREQ *req, QueryError *status) {
  RedisSearchCtx *sctx = AREQ_SearchCtx(req);
  RedisModuleCtx *outctx = sctx->redisCtx;
  bool keyMapFallback = req->searchopts.inkeys && !sctx->spec->diskSpec &&
                        sctx->spec->docs.keyMapState != DocKeyMap_Ready;
  rs_wall_clock fallbackGILStart;

  if (keyMapFallback) {
    // ENFORCE ORDER: Release inner lock before obtaining outer GIL.
    IndexSpec_Unlock(sctx->spec);
    RedisModule_ThreadSafeContextLock(outctx);

    if (IsProfile(req)) {
      rs_wall_clock_init(&fallbackGILStart);
    }

#ifdef ENABLE_ASSERT
    SyncPoint_Wait("KeyMapFallbackGIL");
#endif

    // Re-acquire inner lock under safe hierarchy: GIL -> Spec Read Lock
    IndexSpec_LockRead(sctx->spec);
  }

  // Execute plan preparation under the protected state
  int planStatus = prepareExecutionPlan(req, status);

  if (keyMapFallback) {
    if (IsProfile(req)) {
      AREQ_QueryProcessingCtx(req)->queryGILTime += rs_wall_clock_elapsed_ns(&fallbackGILStart) + 1;
    }
    // Release outer GIL; inner spec lock remains held by caller contract
    RedisModule_ThreadSafeContextUnlock(outctx);
  }

  return planStatus;
}
```

**NEGATIVE CONSTRAINT**:
```c
// FORBIDDEN: Acquiring GIL while holding the inner IndexSpec lock creates an AB-BA deadlock.
static int prepareExecutionPlanDeadlock(AREQ *req, QueryError *status) {
  RedisSearchCtx *sctx = AREQ_SearchCtx(req);
  RedisModuleCtx *outctx = sctx->redisCtx;

  // Caller already holds IndexSpec_LockRead(sctx->spec)!
  // Acquiring GIL here causes instant deadlock if main thread calls
  // IndexSpec_LockWrite() while holding GIL.
  RedisModule_ThreadSafeContextLock(outctx); 
  int planStatus = prepareExecutionPlan(req, status);
  RedisModule_ThreadSafeContextUnlock(outctx);
  return planStatus;
}
```

**VERIFICATION METHOD**:
Enforce verification using ThreadSanitizer (TSan) combined with deterministic synchronization test points (`SyncPoint_Wait` / `SyncPoint_Signal`). Write an automated integration test where a query thread activates fallback resolution simultaneously with a high-throughput main-thread write loop:
```bash
make SAN=thread
pytest tests/pytests/test_inkeys.py -k "test_inkeys_concurrent_mutation"
```

---

### 2. Time-Sliced Background Backfill via Weak Reference Promotion
**RULE**:
Background maintenance tasks that iterate over core data structures in chunks **MUST NOT** retain strong pointers to their parent container across scheduling yield points. The task **MUST** demote its handle to a weak reference (`WeakRef`), yield control back to the scheduler, and attempt to promote the weak reference to a strong reference (`StrongRef`) only upon waking. If promotion fails, the task **MUST** immediately abort, release all parked iterator resources, and deallocate itself.

**WHY**:
Retaining strong references or raw pointers across asynchronous yield points prevents parent container cleanup (such as when a user drops an index via `FT.DROPINDEX`). If a raw pointer is kept across yields without strong ownership, the task accesses freed memory (use-after-free). If a strong reference is permanently retained across long backfills, memory leaks occur or teardown deadlocks when the engine shutdown routine waits for the thread pool to drain.

**WHEN TO APPLY**:
Any asynchronous batch processing, lazy reindexing, or incremental migration task that yields between time slices or element quotas.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production pattern from src/indexes_scan.c & src/doc_table.c
#define KEY_MAP_BUILD_BATCH_SIZE 1024

typedef struct {
  WeakRef spec;
  DocTableKeyMapIterator iterator;
} KeyMapBuild;

static void KeyMapBuild_Run(void *arg) {
  KeyMapBuild *build = (KeyMapBuild *)arg;

  // Attempt to upgrade weak handle to strong handle
  StrongRef ref = IndexSpecRef_Promote(build->spec);
  IndexSpec *spec = StrongRef_Get(ref);
  bool done = true;

  if (spec) {
    IndexSpec_LockWrite(spec);
    // Execute bounded traversal limited strictly by budget
    done = DocTable_BuildKeyMapBatch(&spec->docs, &build->iterator, KEY_MAP_BUILD_BATCH_SIZE);
    IndexSpec_Unlock(spec);

    // Release strong reference immediately after completing the batch
    IndexSpecRef_Release(ref);
  }

  if (!done) {
    // Requeue continuation at LOW priority to prevent starvations
    int rc = redisearch_thpool_add_work(reindexPool, KeyMapBuild_Run, build, THPOOL_PRIORITY_LOW);
    RS_ASSERT_ALWAYS(rc == 0);
  } else {
    // Cleanup iterator cursor state and deallocate build task
    DocTable_KeyMapIteratorReleaseNext(&build->iterator);
    WeakRef_Release(build->spec);
    rm_free(build);
  }
}
```

**NEGATIVE CONSTRAINT**:
```c
// FORBIDDEN: Holding raw pointers or retaining strong refs indefinitely
static void KeyMapBuild_Unsafe(void *arg) {
  IndexSpec *spec = (IndexSpec *)arg; // Dangling pointer hazard if index dropped!
  while (!DocTable_BuildKeyMapBatch(&spec->docs, &iter, 1024)) {
    // Yielding with raw pointer across scheduling leads to SIGSEGV
    thpool_yield(); 
  }
}
```

**VERIFICATION METHOD**:
Verify using automated regression testing where an index creation and immediate deletion occurs concurrently with lazy backfill activation. Confirm absence of memory leaks and invalid reads using Valgrind/ASan:
```bash
valgrind --leak-check=full redis-server --loadmodule ./redisearch.so
pytest tests/pytests/test_inkeys.py -k "test_drop_index_during_lazy_activation"
```

---

### 3. Safe IEEE-754 Floating-Point to 64-Bit Integer Coercion Invariant
**RULE**:
When parsing numeric values from client text tokens into signed 64-bit integers (`long long`), the implementation **MUST** reject `NaN` inputs explicitly, verify that the floating-point value is strictly within the half-open interval `[LLONG_MIN, (double)LLONG_MAX)`, and verify identity round-trip equality `(double)(long long)dVal == dVal` before casting. When saturation/coalescing is explicitly requested, values outside the range **MUST** saturate to `LLONG_MIN` or `LLONG_MAX` without invoking an unchecked C-level cast.

**WHY**:
In C99, C11, C++17, and C++20 standard semantics (ISO/IEC 9899:2011 §6.3.1.4), converting a float or double to an integer type where the value cannot be represented produces **Undefined Behavior (UB)**. Furthermore, in IEEE 754 64-bit binary floating point, `LLONG_MAX` ($2^{63}-1 = 9223372036854775807$) cannot be represented exactly and rounds up to exactly $2^{63}$ ($9223372036854775808.0$). Direct cast `(long long)d` when `d == 9223372036854775808.0` invokes UB, which compiles down to `0x8000000000000000` (wrap-around to negative minimum) on x86-64 or triggers processor trap exceptions.

**WHEN TO APPLY**:
All command-line argument parsers, JSON/query engine lexers, and serialization/deserialization boundaries converting string/float representations to integer storage.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production pattern from deps/rmutil/args.c
static int tryReadAsDouble(ArgsCursor *ac, long long *ll, int flags) {
  double dTmp = 0.0;
  if (AC_GetDouble(ac, &dTmp, flags | AC_F_NOADVANCE) != AC_OK) {
    return AC_ERR_PARSE;
  }

  // Casting a double outside [LLONG_MIN, 2^63) to long long is UB.
  // The RString conversion accepts literal "inf" - reject NaN first.
  if (isnan(dTmp)) {
    return AC_ERR_PARSE;
  }

  if (flags & AC_F_COALESCE) {
    // Coalescing coerces: saturate out-of-range values (including +/- inf)
    // (double)LLONG_MAX rounds up to exactly 2^63, providing the exclusive bound.
    if (dTmp >= (double)LLONG_MAX) {
      *ll = LLONG_MAX;
    } else if (dTmp < (double)LLONG_MIN) {
      *ll = LLONG_MIN;
    } else {
      *ll = (long long)dTmp;
    }
    return AC_OK;
  }

  // Non-coalescing: strict boundary check avoiding undefined casting behavior
  if (!(dTmp >= (double)LLONG_MIN && dTmp < (double)LLONG_MAX)) {
    return AC_ERR_PARSE;
  }

  // Verify exact integral representation without truncation
  if ((double)(long long)dTmp != dTmp) {
    return AC_ERR_PARSE;
  } else {
    *ll = (long long)dTmp;
    return AC_OK;
  }
}
```

**NEGATIVE CONSTRAINT**:
```c
// FORBIDDEN: Direct cast of parsed double without IEEE-754 range verification
int UnsafeParseLongLong(const char *str, long long *out) {
  double d = atof(str);
  // If str == "9223372036854775808.0", "inf", or "nan", this cast is UNDEFINED BEHAVIOR!
  *out = (long long)d; 
  return 0;
}
```

**VERIFICATION METHOD**:
Run unit tests under Clang UndefinedBehaviorSanitizer (UBSan):
```bash
CFLAGS="-fsanitize=undefined" make test
# Execute argument boundary test suite
./build/tests/args_test --run-coercion-limits
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: INKEYS Worker-to-Main-Thread CPU Starvation & Stale ID Regression (BUG-INKEYS-01)
- **Context**: Query execution path & admission filter in `src/aggregate/aggregate_request.c`, `src/doc_table.c`, and Rust FFI bridge `doc_key_map_ffi`.
- **What Was Expected**: Passing `INKEYS` to `FT.SEARCH` or `FT.AGGREGATE` should filter search results down to an allowed set of document keys. Resolution from Redis key string to internal document ID (`t_docId`) should run in parallel across background query workers without locking the Redis main thread, preserving query throughput.
- **What Actually Happened**: In PR #10561, the internal `DocTable` trie was removed to save memory. This forced `INKEYS` key resolution to move onto the single Redis main thread during command admission (`applyGlobalFilters`). Under workloads where queries passed hundreds of keys, key lookup consumed ~30% of main thread CPU core time, choking the entire Redis server. Furthermore, resolving keys at admission (outside the `IndexSpec` read lock) created a race window: if a document was reindexed before the worker acquired the read lock, the worker searched for a stale, deleted `docId`, causing documents to drop silently from results.
- **Evidence in Repo**: Commit `9b3b62e6` (`[MOD-19999] Fix queued INKEYS updates with worker-side key lookup (#11945)`), GitHub Issue #11935, and design doc `docs/design/inkeys-worker-lookup.md`.
- **Root Cause**: Redis per-key metadata lookup (`DocIdMeta_Get`) requires the Redis GIL. The engine lacked a GIL-free reverse mapping (`key -> docId`) inside `DocTable`. Moving lookups to the worker required GIL acquisition, which was avoided by doing it at query admission on the main thread, introducing serialization bottlenecks and invalid snapshot semantics.
- **Remediation Code Diff**:
```diff
--- a/src/aggregate/aggregate_request.c
+++ b/src/aggregate/aggregate_request.c
@@ -1480,19 +1480,12 @@ static int applyGlobalFilters(RSSearchOptions *opts, QueryAST *ast, const RedisS
     // id-filter node borrows it as-is.
     QAST_GlobalFilterOptions filterOpts = {.keys = opts->inkeys, .nkeys = opts->ninkeys};
 
-    // DocIdMeta_Get opens the key (needs the GIL), so resolve here on the main
-    // thread rather than on a background query thread. Resolving at admission
-    // rather than at snapshot time leaves a window: a key re-indexed before the
-    // worker takes the spec read lock keeps its stale, now deleted docId and
-    // drops out of the results - the same observable outcome as the
-    // Result_ExpiredDoc path takes for any doc re-indexed mid-query.
-    filterOpts.docIds = rm_malloc(sizeof(t_docId) * opts->ninkeys);
-    for (size_t ii = 0; ii < opts->ninkeys; ++ii) {
-      uint64_t docId = 0;
-      if (DocIdMeta_Get(sctx->redisCtx, opts->inkeys[ii], sctx->spec->specId, &docId) == REDISMODULE_OK) {
-        filterOpts.docIds[ii] = docId;
-      } else {
-        filterOpts.docIds[ii] = 0;  // Mark as not found
+    // Disk resolution remains at admission; memory-mode resolution is deferred
+    // until the execution spec lock has been established.
+    if (SearchDisk_IsEnabled()) {
+      filterOpts.docIds = rm_calloc(opts->ninkeys, sizeof(t_docId));
+      for (size_t ii = 0; ii < opts->ninkeys; ++ii) {
+        DocIdMeta_Get(sctx->redisCtx, opts->inkeys[ii], sctx->spec->specId, &filterOpts.docIds[ii]);
       }
     }
```
In `src/doc_table.c`, an in-memory `DocKeyMap` implemented via Rust (`hashbrown::HashTable` + `ahash`) was added directly to `DocTable`, allowing workers to resolve IDs under `IndexSpec_LockRead` without touching the GIL.
- **Lesson**: Do not migrate operations from worker threads to an event loop or main thread solely to satisfy locking prerequisites of secondary metadata. Maintain an index-local, lock-pinned lookup table to keep worker tasks completely independent of the orchestrator thread.

---

### Incident 2: Unbounded Memory Bloat from Eager Secondary Map Allocation (BUG-LAZY-02)
- **Context**: Index lifecycle & initialization in `src/doc_table.c`, `src/indexes_scan.c`.
- **What Was Expected**: Introducing `DocKeyMap` to solve the worker lookup issue was expected to have negligible overhead on instances that do not utilize `INKEYS`.
- **What Actually Happened**: Eagerly allocating `DocKeyMap` for every in-memory index imposed ~22.3 bytes per document overhead across all deployments (e.g., ~34 MiB for 1.6 million documents). For customers running hundreds of indexes without ever issuing `INKEYS` queries, this represented a regression in RAM footprint.
- **Evidence in Repo**: Commit `3dd97c13` (`[MOD-19999] Avoid document key map memory until first INKEYS use (#11968)`), benchmarks in `docs/design/inkeys-lazy-benchmarks.md`, and design doc `docs/design/inkeys-lazy-prototype.md`.
- **Root Cause**: Unconditional eager allocation of secondary index acceleration structures upon index creation, rather than on-demand lazy initialization.
- **Remediation Code Diff**:
```diff
--- a/src/doc_table.c
+++ b/src/doc_table.c
@@ -36,7 +36,6 @@ DocTable NewDocTable(size_t cap, size_t max_size) {
       .memsize = 0,
       .sortablesSize = 0,
       .maxSize = max_size,
-      .keyMap = !SearchDisk_IsEnabled() ? DocKeyMap_New() : NULL,
   };
```
Implemented a tri-state activation state machine (`DocKeyMap_Inactive`, `DocKeyMap_Building`, `DocKeyMap_Ready`). On first `INKEYS` execution, the map is activated lazily. While `DocKeyMap_Building` is underway in chunks of 1024 docs on the `reindexPool`, worker queries fall back to metadata lookups under safe GIL release/re-acquire wrappers.
- **Lesson**: High-overhead secondary lookup tables must be lazily initialized. Systems must provide a seamless fallback query path while background backfill proceeds.

---

### Incident 3: Duplicate FT.AGGREGATE Cursor Rows After Deletions During Concurrent Backfill (BUG-CURSOR-03)
- **Context**: Cursor iteration and document unlinking in `src/doc_table.c` and aggregate processing.
- **What Was Expected**: Executing paginated scans using `FT.CURSOR READ` over an index undergoing bulk mutations should return a consistent set of live rows without returning identical physical rows multiple times.
- **What Actually Happened**: Users executing `FT.AGGREGATE ... WITHCURSOR` while bulk deletes were running against an active index noticed duplicated physical row IDs across cursor pagination boundaries (Issue #11970).
- **Evidence in Repo**: Issue #11970: `[BUG] Duplicate FT.AGGREGATE cursor rows after deletes while index backfill is active`.
- **Root Cause**: `DocTable_BuildKeyMapBatch` and cursor traversals relied on raw pointers within bucket chains (`dmd->nextInChain`). When a document was unlinked and marked `Document_Deleted`, the deletion unlinked the node and zeroed `nextInChain`. A retained cursor holding a pointer to the deleted DMD could no longer traverse to adjacent siblings in the chain, causing traversals to restart at the bucket root and process documents repeatedly.
- **Remediation Code Diff**:
```diff
--- a/src/doc_table.c
+++ b/src/doc_table.c
@@ -147,6 +147,12 @@ bool DocTable_BuildKeyMapBatch(DocTable *t, DocTableKeyMapIterator *iter, size_
 
   RSDocumentMetadata *dmd = iter->next;
+  // Unlinking clears nextInChain. A retained deleted DMD stays alive, but cannot
+  // lead us to the remaining entries; restarting is safe because insertion is idempotent.
+  if (!dmd || (dmd->flags & Document_Deleted)) {
+    dmd = t->buckets[iter->bucket].root;
+  }
   DocTable_KeyMapIteratorReleaseNext(iter);
```
Additionally, key map insertion operations were updated to be strictly idempotent (`DocKeyMap_InsertIfAbsent`), ensuring that restarting traversals from bucket roots never creates duplicate keys or corrupted counters.
- **Lesson**: In concurrent bucket-chain structures, unlinking an entry destroys link continuity. Iterators must detect when their reference has been invalidated/unlinked, fall back safely to bucket-level anchors, and rely on idempotent insertion semantics to prevent duplicate tracking.

---

### Incident 4: macOS ARM64 Homebrew Toolchain ABI Breakage & Missing Common Symbols (BUG-MACOS-04)
- **Context**: Build toolchain and static bundle generation in `.install/install_llvm.sh` and `src/CMakeLists.txt`.
- **What Was Expected**: macOS CI runners on Apple Silicon should bootstrap LLVM, link C static bundles with Rust test binaries via `ld64.lld`, and cleanly resolve all exported Redis Module APIs.
- **What Actually Happened**: Upstream Homebrew bottles for LLVM broke backward compatibility with standard macOS SDK targets. Furthermore, when creating unified static library archives using Apple's `libtool`, common API symbols defined in `redismodule_api.c` failed to generate symbol table entries, causing linker errors during Rust integration test compilation (`undefined symbol: RedisModule_Alloc`).
- **Evidence in Repo**: Commit `ae566ef3` (`CI: restore macOS ARM64 builds without Homebrew LLVM bottles (#12047)`).
- **Root Cause**:
  1. Default LLVM installation included bundled C++ runtimes (`libc++`, `libunwind`) that collided with Apple's platform standard library.
  2. Apple's `libtool -static` drops common symbols from the table of contents unless passed the `-c` flag.
  3. LLVM libc++ configuration disabled vendor availability annotations, resulting in undefined symbol errors against deployment target system libraries.
- **Remediation Code Diff**:
```diff
--- a/src/CMakeLists.txt
+++ b/src/CMakeLists.txt
@@ -288,9 +288,11 @@ list(REMOVE_DUPLICATES MERGE_DEPENDS)
 # Create the combined library using platform-specific tools
 if(APPLE)
     # macOS: use libtool to merge static libraries
+    # Index common symbols so Rust's ld64.lld can resolve the API pointer table
+    # defined in redismodule_api.c when linking tests.
     add_custom_command(
         OUTPUT ${REDISEARCH_C_BUNDLE_OUTPUT}
-        COMMAND libtool -static -no_warning_for_no_symbols -o ${REDISEARCH_C_BUNDLE_OUTPUT} ${LIBS_TO_MERGE}
+        COMMAND libtool -static -c -no_warning_for_no_symbols -o ${REDISEARCH_C_BUNDLE_OUTPUT} ${LIBS_TO_MERGE}
         DEPENDS ${MERGE_DEPENDS}
         COMMENT "Creating unified libredisearch_c_bundle.a with libtool"
         VERBATIM
```
In `.install/install_llvm.sh`, tar exclusions were introduced (`--exclude '*/lib/libc++*'`), and SDK roots were explicitly exported (`export SDKROOT=$(xcrun --sdk macosx --show-sdk-path)`).
- **Lesson**: When unifying C static archives for consumption by foreign linkers (like Rust's LLD on macOS), Apple `libtool` **must** be instructed with `-c` to index common uninitialized symbols.

---

### Incident 5: Allocation Monkey-Patching Test Harness Segfaults (BUG-ALLOC-05)
- **Context**: Memory allocator redirection in `deps/rmutil/alloc.c` and `deps/rmutil/alloc.h`.
- **What Was Expected**: Unit tests compiling C modules outside of an active Redis server process should run standard `malloc`/`free` routines without referencing Redis Module API function pointers.
- **What Actually Happened**: When compiling standalone unit tests that imported `alloc.h` with `REDIS_MODULE_TARGET` defined, calls to memory management macros resolved to `RedisModule_Alloc`, `RedisModule_Free`, etc. Because the tests ran outside an initialized Redis engine, these function pointers were `NULL`, triggering instant segmentation faults upon the first memory allocation.
- **Evidence in Repo**: `deps/rmutil/alloc.c` implementation and architectural docs for standalone harness testing.
- **Root Cause**: Implicit substitution of libc allocators by Redis Module wrappers without an explicit hook to restore native pointers in non-module test harnesses.
- **Remediation Code Diff**:
```diff
--- a/deps/rmutil/alloc.c
+++ b/deps/rmutil/alloc.c
@@ -21,6 +21,12 @@
+void RMUTil_InitAlloc() {
+  RedisModule_Alloc = malloc;
+  RedisModule_Realloc = realloc;
+  RedisModule_Calloc = calloc;
+  RedisModule_Free = free;
+  RedisModule_Strdup = strdup;
+}
```
- **Lesson**: Any system that monkey-patches global system runtime primitives (like heap memory allocators) must provide an idempotent bootstrap routine to re-bind native runtime hooks when running in isolated test runners.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Double-to-Int Boundary Coercion**:
  In `deps/rmutil/args.c`, `tryReadAsDouble` accounts for IEEE-754 precision limits:
  ```c
  // (double)LLONG_MAX rounds up to 2^63 (9223372036854775808.0).
  // Checking `dTmp < (double)LLONG_MAX` correctly defines the strict upper boundary.
  if (!(dTmp >= (double)LLONG_MIN && dTmp < (double)LLONG_MAX)) {
    return AC_ERR_PARSE;
  }
  // Detect lossy precision truncation:
  if ((double)(long long)dTmp != dTmp) {
    return AC_ERR_PARSE;
  }
  ```
- **String Dereferencing by Object Type**:
  In `deps/rmutil/args.h`, `AC_StringArg` explicitly differentiates between `RedisModuleString *` arrays and raw char pointers:
  ```c
  static inline const char *AC_StringArg(const ArgsCursor *ac, size_t n, size_t *len) {
    if (ac->type == AC_TYPE_RSTRING) {
      return RedisModule_StringPtrLen((RedisModuleString *)ac->objs[n], len);
    }
    const char *s = (const char *)ac->objs[n];
    if (len) {
      *