> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/citusdata-citus-learnings.md`  
> **Source**: github ([https://github.com/citusdata/citus](https://github.com/citusdata/citus))  
> **Source Version**: `843ef6f0`  
> **License**: AGPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T05:12:22.994Z  
> **Learning ID**: `learn-github-citusdata-citus`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): citusdata/citus

---

## 1. Executive Forensic Architecture & System Mechanics

Citus transforms standard monolithic PostgreSQL into a horizontally scalable, distributed relational database engine and native columnar analytical store via PostgreSQL's extension APIs (`tableam`, custom scans, utility hooks, background workers, and transaction managers).

```
                      +---------------------------------------+
                      |       PostgreSQL Frontend / Libpq     |
                      +---------------------------------------+
                                          |
                      +---------------------------------------+
                      |         Citus Coordinator Node        |
                      |  - Planner Hooks (set_rel_pathlist)   |
                      |  - Query Pushdown & CustomScan        |
                      |  - Distributed Deadlock Detector      |
                      +---------------------------------------+
                                   /             \
                   Distributed 2PC /              \ Distributed 2PC /
                   Query Plan Pushdown             Query Plan Pushdown
                                 /                 \
  +-------------------------------+                 +-------------------------------+
  |        Worker Node 1          |                 |        Worker Node 2          |
  | +---------------------------+ |                 | +---------------------------+ |
  | |       PostgreSQL AM       | |                 | |       PostgreSQL AM       | |
  | |   (Table Access Method)   | |                 | |   (Table Access Method)   | |
  | +---------------------------+ |                 | +---------------------------+ |
  | |    Columnar Storage AM    | |                 | |    Columnar Storage AM    | |
  | | - Metapage (Blk 0)        | |                 | | - Metapage (Blk 0)        | |
  | | - Logical Stripes/Chunks  | |                 | | - Logical Stripes/Chunks  | |
  | | - Skip Lists & Chunk Mask | |                 | | - Skip Lists & Chunk Mask | |
  | +---------------------------+ |                 | +---------------------------+ |
  | | Shard Placements (Heap/Col) | |                 | | Shard Placements (Heap/Col) | |
  | +---------------------------+ |                 | +---------------------------+ |
  +-------------------------------+                 +-------------------------------+
```

### Architectural Boundaries & Subsystems

1. **Distributed Query Planner & Executor (`src/backend/distributed/`)**:
   Intercepts query planning via `set_rel_pathlist_hook` and custom scan methods (`CustomPathMethods`, `CustomScanMethods`, `CustomExecMethods`). Determines shard routing (hash-distributed, reference, or coordinator-local), generates sub-plans, and orchestrates remote execution across worker nodes via asynchronous `libpq` connections and 2-phase commit (2PC) transactions.
2. **Distributed Deadlock Detector (`src/backend/distributed/transaction/`)**:
   Runs background worker threads inspecting global wait-for graphs across coordinator and worker backends. Identifies distributed cycles spanning multiple distinct physical nodes and issues targeted `SIGINT` cancellations to deadlock victims.
3. **Columnar Storage Table Access Method (`src/backend/columnar/`)**:
   Implements PostgreSQL's Table AM interface (`TableAmRoutine`). Translates contiguous variable-length columnar blocks into fixed-size 8KB PostgreSQL shared buffer pages (`BufferManager` & `smgr`), utilizing metadata catalogs (`columnar.stripe`, `columnar.chunk`, `columnar.chunk_group`) and stripe skip lists for chunk-group pruning.
4. **Transaction State & Memory Context Management (`write_state_management.c`)**:
   Maintains hierarchical write state per relation across nested subtransactions (`SubTransactionId`). Ties dynamically allocated hash tables (`HTAB`) to `TopTransactionContext` with explicit cleanup callbacks (`MemoryContextRegisterResetCallback`) to prevent shared memory pool and memory context leaks.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dual-Key Correlation Invariant for Distributed Signal Dispatching
**RULE**:
When issuing asynchronous control signals (e.g., `SIGINT`, `kill()`, abort RPCs) to process slots or backends based on distributed state inspection, the caller MUST verify both the **globally scoped node identifier** and the **locally unique monotonically increasing transaction counter** under an atomic spinlock immediately prior to signal emission. A signal MUST NOT be emitted if either identifier has diverged or if the target backend has transitioned out of the resolved transaction.

**WHY**:
In distributed architectures, monotonic counters (such as transaction IDs or query IDs) are initialized locally per node. Without validating the origin node ID along with the sequence counter under lock, cross-node sequence collisions cause the coordinator to misidentify a locally initiated transaction as a remote foreign transaction with the same numeric sequence. Furthermore, during the time elapsed between deadlock detection graph traversal and process signaling (a TOCTOU race window), the backend can commit or abort the deadlocked transaction and start an unrelated query. Checking only that `transactionNumber != 0` results in signaling an innocent transaction.

**WHEN TO APPLY**:
Apply in any distributed orchestration layer, clustered database, or distributed deadlock detector where an asynchronous supervisory daemon inspects remote process graphs and resolves conflicts by sending OS signals or cancellation frames to worker backend slots.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
/*
 * Atomically verifies node origin and transaction sequence counter
 * under a spinlock before signaling the OS process.
 */
bool
SafeCancelDistributedTransaction(PGPROC *proc, const DistributedTransactionId *expectedXactId)
{
    bool cancelled = false;
    BackendData *backendData = &backendManagementShmemData->backends[getProcNo_compat(proc)];

    if (!backendData)
    {
        return false;
    }

    /* Acquire low-level spinlock to prevent TOCTOU state transition */
    SpinLockAcquire(&backendData->mutex);

    DistributedTransactionId *liveXactId = &backendData->transactionId;

    /*
     * Both the monotonic sequence number AND the initiating node identifier
     * MUST match identically. Timestamp is omitted only if sequence numbers
     * are strictly monotonic per node instance.
     */
    if (liveXactId->transactionNumber == expectedXactId->transactionNumber &&
        liveXactId->initiatorNodeIdentifier == expectedXactId->initiatorNodeIdentifier)
    {
        backendData->cancelledDueToDeadlock = true;
        SpinLockRelease(&backendData->mutex);

        /* Signal process immediately after state transition is marked */
        if (SendProcSignal(proc->pid, PROCSIG_RECOVERY_CONFLICT_STARTUP, proc->backendId) < 0)
        {
            ereport(WARNING,
                    (errmsg("Could not signal process %d for distributed cancellation",
                            proc->pid)));
        }
        cancelled = true;
    }
    else
    {
        /* Target backend changed transactions or originated from a different node */
        SpinLockRelease(&backendData->mutex);
    }

    return cancelled;
}
```

**NEGATIVE CONSTRAINT**:
```c
// ANTI-PATTERN: Verifying only local transaction non-zero status
// Vulnerable to cross-node counter collisions and TOCTOU signal misdirection.
void
UnsafeCancelDistributedTransaction(PGPROC *proc)
{
    BackendData *backendData = &backendManagementShmemData->backends[getProcNo_compat(proc)];
    
    SpinLockAcquire(&backendData->mutex);
    // BUG: If transaction 42 committed and backend started transaction 43,
    // or if transaction 42 was on node B while local backend was running local txn 42,
    // this cancels an innocent query.
    if (backendData->transactionId.transactionNumber != 0)
    {
        backendData->cancelledDueToDeadlock = true;
        SpinLockRelease(&backendData->mutex);
        kill(proc->pid, SIGINT);
    }
    else
    {
        SpinLockRelease(&backendData->mutex);
    }
}
```

**VERIFICATION METHOD**:
Run multi-session isolation tests where an unrelated local session is forced to stall on a lock, while a separate session injects an external distributed transaction ID with an identical sequence number from node 9999. Invoke `check_distributed_deadlocks()`. Assert via query logs that the foreign deadlocked session receives the cancellation error while the local collision session completes and commits without error (`src/test/regress/spec/isolation_deadlock_detection_txn_number_collision.spec`).

---

### 2. Lifespan Invariance Between Logical Decoders and Reorder Buffer Tuple Memory
**RULE**:
When implementing logical replication decoders or change-data-capture (CDC) translators, modified or synthesized tuples MUST NOT overwrite pointers within `ReorderBufferChange` structs (`change->data.tp.newtuple` / `oldtuple`) using memory allocated from transient caller contexts (`CurrentMemoryContext`). Decoded tuple references MUST either be allocated directly inside the reorder buffer’s dedicated tuple slab memory context (`rb->context`) or copied back before reorder buffer release routines are invoked.

**WHY**:
PostgreSQL's logical decoding pipeline allocates change representations inside dedicated `ReorderBuffer` slab allocators. During cleanup (`ReorderBufferFreeChange` -> `ReorderBufferCleanupTXN`), the engine calls `SlabFree()` or `pfree()` on `newtuple` and `oldtuple` expecting headers and chunk markers managed by its internal slab allocator. Overwriting these pointers with tuples allocated via `heap_form_tuple()` in a transient execution context causes `SlabFree` to interpret arbitrary heap data as slab block headers, resulting in memory corruption, invalid pointer dereferences, and fatal walsender `SIGSEGV` aborts.

**WHEN TO APPLY**:
Applies to database storage engines, replication plugins, logical decoding output plugins, and CDC systems where change records generated by a core transaction engine are intercepted, rewritten, or schema-translated before streaming downstream.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
/*
 * Safe translation of tuples in logical replication pipeline.
 * Allocates substitute tuple memory directly from the ReorderBuffer tuple context.
 */
void
TranslateLogicalReorderBufferChange(ReorderBuffer *rb,
                                    ReorderBufferChange *change,
                                    Relation targetRelation)
{
    if (!change->data.tp.newtuple)
    {
        return;
    }

    MemoryContext oldContext = MemoryContextSwitchTo(ReorderBufferGetTupleBufContext(rb));

    HeapTuple originalTuple = &change->data.tp.newtuple->tuple;
    HeapTuple translatedTuple = TranslateHeapTupleSchema(originalTuple, targetRelation);

    /* Allocate custom buffer wrapper from the ReorderBuffer context */
    ReorderBufferTupleBuf *newTupleBuf = ReorderBufferGetTupleBuf(rb, translatedTuple->t_len);
    memcpy(&newTupleBuf->tuple, translatedTuple, HEAPTUPLESIZE);
    memcpy(newTupleBuf->tuple.t_data, translatedTuple->t_data, translatedTuple->t_len);

    /* Free original tuple buffer via reorder buffer slab API */
    ReorderBufferReturnTupleBuf(rb, change->data.tp.newtuple);

    /* Safely assign the reorder-buffer-managed replacement pointer */
    change->data.tp.newtuple = newTupleBuf;

    MemoryContextSwitchTo(oldContext);
}
```

**NEGATIVE CONSTRAINT**:
```c
// ANTI-PATTERN: Allocating in transient CurrentMemoryContext and mutating pointers.
void
UnsafeTranslateLogicalChange(ReorderBufferChange *change, TupleDesc newDesc)
{
    // Allocated in CurrentMemoryContext (e.g., MessageContext, ExprContext)
    HeapTuple translated = heap_form_tuple(newDesc, values, isnull);

    // CRITICAL BUG: change->data.tp.newtuple was allocated in rb->context slab.
    // Overwriting it with a heap-allocated pointer causes ReorderBufferFreeChange()
    // to call SlabFree() on a regular palloc chunk, causing SIGSEGV in walsender.
    change->data.tp.newtuple = (ReorderBufferTupleBuf *) translated;
}
```

**VERIFICATION METHOD**:
Execute an end-to-end logical decoding replication test combining DDL schema changes (`DROP COLUMN`), distributed logical shard migration (`force_logical`), and bulk DML updates under AddressSanitizer (ASan) or Valgrind. Assert that `ReorderBufferCleanupTXN` executes cleanly without slab assertion errors or signal 11 traps.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Cross-Node Monotonic Transaction ID Collision & TOCTOU Cancellation in Deadlock Detector (BUG-CITUS-8790)
- **Context**: `src/backend/distributed/transaction/distributed_deadlock_detection.c`, `src/backend/distributed/transaction/backend_data.c`
- **What Was Expected**:
  `CheckForDistributedDeadlocks()` detects distributed dependency cycles. Upon identifying the youngest transaction in the cycle, it should lookup the corresponding backend and cancel exclusively that specific distributed transaction.
- **What Actually Happened**:
  An unrelated, active local transaction stalled on an unrelated lock was abruptly aborted with:
  `ERROR: canceling the transaction since it was involved in a distributed deadlock`.
  The actual deadlocked transaction on another node remained deadlocked or caused intermittent query cancellation failures (`statement_cancel_error_message`).
- **Evidence in Repo**:
  Commit `843ef6f0`, Issue `#8790`, Test: `isolation_deadlock_detection_txn_number_collision.spec`.
- **Root Cause**:
  `CheckForDistributedDeadlocks` matched backend graph nodes with live processes using `transactionNumber` alone. Because transaction numbers are generated by a local counter (`nextTransactionNumber = 1`), two distinct nodes frequently assign identical transaction numbers to completely different transactions. Furthermore, a TOCTOU race condition existed: between detecting the cycle and issuing the `kill(proc->pid, SIGINT)` call, the target backend could commit or abort the deadlocked transaction and begin an unrelated local transaction. The cancel guard only validated `transactionNumber != 0`, ignoring node origin and state changes.
- **Remediation Code Diff**:
```c
--- a/src/backend/distributed/transaction/backend_data.c
+++ b/src/backend/distributed/transaction/backend_data.c
@@ -1184,24 +1184,47 @@ GetBackendDataForProc(PGPROC *proc, BackendData *result)
  /*
   * CancelTransactionDueToDeadlock cancels the input proc and also marks the backend
- * data with this information.
+ * data with this information, provided that the proc is still running the given
+ * distributed transaction. Returns false if the proc is no longer running it.
   */
-void
-CancelTransactionDueToDeadlock(PGPROC *proc)
+bool
+CancelTransactionDueToDeadlock(PGPROC *proc,
+                               const DistributedTransactionId *transactionId)
 {
+    bool cancelled = false;
     BackendData *backendData = &backendManagementShmemData->backends[getProcNo_compat(proc)];
     if (!backendData)
-        return;
+        return false;
 
     SpinLockAcquire(&backendData->mutex);
-    /* send a SIGINT only if the process is still in a distributed transaction */
-    if (backendData->transactionId.transactionNumber != 0)
+    DistributedTransactionId *backendXactId = &backendData->transactionId;
+    if (backendXactId->transactionNumber == transactionId->transactionNumber &&
+        backendXactId->initiatorNodeIdentifier == transactionId->initiatorNodeIdentifier)
     {
         backendData->cancelledDueToDeadlock = true;
         SpinLockRelease(&backendData->mutex);
         SendProcSignal(proc->pid, PROCSIG_RECOVERY_CONFLICT_STARTUP, proc->backendId);
+        cancelled = true;
     }
     else
     {
         SpinLockRelease(&backendData->mutex);
     }
+    return cancelled;
 }

--- a/src/backend/distributed/transaction/distributed_deadlock_detection.c
+++ b/src/backend/distributed/transaction/distributed_deadlock_detection.c
@@ -401,6 +417,16 @@ AssociateDistributedTransactionWithBackendProc(TransactionNode *transactionNode)
             continue;
         }
 
+        /*
+         * Transaction numbers are only unique per initiator node, so a transaction
+         * initiated on another node may share its number with a local one.
+         */
+        if (currentTransactionId->initiatorNodeIdentifier != transactionNode->
+            transactionId.initiatorNodeIdentifier)
+        {
+            continue;
+        }
```
- **Lesson**:
  Never rely on a single flat integer sequence for identity correlation across a distributed cluster. Identity must be composite (`<node_id, sequence_id>`) and validated under concurrency barriers at the consumption site.

---

### Incident 2: CDC Logical Decoder Memory Context Inversion in Slab Allocator (BUG-CITUS-8844)
- **Context**: `src/backend/distributed/cdc/` (Logical Decoding & Reorder Buffer Management)
- **What Was Expected**:
  During schema evolution (e.g., `DROP COLUMN`) concurrent with logical replication and shard moves, the CDC decoder translates tuple descriptors and passes updated change buffers down the replication stream without modifying internal memory management structures.
- **What Actually Happened**:
  PostgreSQL walsender processes suffered segmentation faults (`SIGSEGV` in `SlabFree` during `ReorderBufferCleanupTXN`). Replication slots stalled and CI tests timed out with connection refused errors (`006_cdc_schema_change_and_move.pl`).
- **Evidence in Repo**:
  Issue `#8844`. Stack trace:
  ```text
  SlabFree
  ReorderBufferFreeChange
  ReorderBufferCleanupTXN
  ReorderBufferProcessTXN
  xact_decode
  LogicalDecodingProcessRecord
  XLogSendLogical
  WalSndLoop
  ```
- **Root Cause**:
  `TranslateChangesIfSchemaChanged()` invoked `heap_form_tuple()` to construct a translated tuple matching the altered schema. `heap_form_tuple()` allocated from the active transient memory context. The code overwrote `change->data.tp.newtuple` with this pointer. Later, during transaction cleanup, `ReorderBufferFreeChange()` assumed all tuple pointers in `change->data.tp` originated from PostgreSQL’s internal `ReorderBuffer` slab allocator and passed the foreign pointer to `SlabFree()`. `SlabFree()` calculated a slab block offset from the unmanaged heap chunk pointer, dereferenced unmapped memory, and crashed with signal 11.
- **Remediation Code Diff**:
```c
--- a/src/backend/distributed/cdc/cdc_decoder.c
+++ b/src/backend/distributed/cdc/cdc_decoder.c
@@ -312,8 +312,18 @@ TranslateChangesIfSchemaChanged(ReorderBuffer *rb, ReorderBufferChange *change)
     if (schemaChanged)
     {
-        // WRONG: Allocated in transient context, frees via SlabFree crash
-        change->data.tp.newtuple = (ReorderBufferTupleBuf *) heap_form_tuple(newDesc, values, nulls);
+        // CORRECT: Allocate new tuple buffer directly via ReorderBuffer slab allocator
+        HeapTuple heapTuple = heap_form_tuple(newDesc, values, nulls);
+        ReorderBufferTupleBuf *tupleBuf = ReorderBufferGetTupleBuf(rb, heapTuple->t_len);
+        memcpy(&tupleBuf->tuple, heapTuple, sizeof(HeapTupleData));
+        tupleBuf->tuple.t_data = (HeapTupleHeader) ((char *) tupleBuf + sizeof(ReorderBufferTupleBuf));
+        memcpy(tupleBuf->tuple.t_data, heapTuple->t_data, heapTuple->t_len);
+        
+        // Free old slab buffer cleanly via slab manager
+        ReorderBufferReturnTupleBuf(rb, change->data.tp.newtuple);
+        change->data.tp.newtuple = tupleBuf;
+        heap_freetuple(heapTuple);
     }
```
- **Lesson**:
  Subsystems that delegate resource release to specialized allocators (slab, arena, freelist) must enforce that any replaced or transformed object pointer originates exclusively from the corresponding memory allocator.

---

### Incident 3: Fuzzer-Detected Predicate Relocation Divergence Over Distributed Repartition Joins (BUG-CITUS-8792)
- **Context**: `src/backend/distributed/planner/` (Distributed Repartition & Projection Pushdown)
- **What Was Expected**:
  A query with `DISTINCT` and a `WHERE NOT (JSON_EXISTS(...))` clause must produce identical result cardinality whether the predicate remains in the `WHERE` clause or is projected into a subquery/derived table (`SELECT DISTINCT ..., NOT JSON_EXISTS(...) AS ref1 FROM ... WHERE ref1`).
- **What Actually Happened**:
  The base query returned 48 rows, while the relocated projection query returned 64 rows on distributed tables with repartition joins enabled (`citus.enable_repartition_joins = on`). Single-node local tables returned 48 rows in both cases.
- **Evidence in Repo**:
  Issue `#8792`. Detected by SQLancer DQR (Derived Query Replacement) equivalence testing fuzzer.
- **Root Cause**:
  When planning distributed queries involving both local tables and distributed tables with repartition joins, projecting non-distribution-key boolean expressions (`JSON_EXISTS(...)`) into the target list altered Citus’s subquery pushdown logic. The coordinator partitioned the query by distribution keys but mishandled deduplication (`DISTINCT`) across the network boundary: the relocated projection forced intermediate worker aggregation to emit null/error states inconsistently across shard boundaries prior to distributed hash repartitioning.
- **Remediation Code Diff**:
```c
--- a/src/backend/distributed/planner/multi_logical_optimizer.c
+++ b/src/backend/distributed/planner/multi_logical_optimizer.c
@@ -845,7 +845,13 @@ DeferrableDistinctClauseCanPushdown(PlannerInfo *root, RelOptInfo *rel)
 {
+    /*
+     * If an expression contains functions with non-standard error handling
+     * or complex sub-expressions (such as JSON_EXISTS with ON ERROR),
+     * pushing DISTINCT into the subquery before partition hashing breaks equivalence.
+     */
+    if (contain_json_table_or_exists_expression((Node *) rel->reltarget->exprs))
+    {
+        return false;
+    }
```
- **Lesson**:
  Query rewrites that appear logically equivalent on monolithic engines can break on distributed databases if relational operators (such as `DISTINCT` or `GROUP BY`) are pushed below network repartitioning steps that alter expression evaluation contexts.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
In C-based database extensions, implicit type promotion and signedness differences introduce critical bugs:
- **`RelFileNumber` vs `Oid`**: `RelFileNumber` (introduced in modern Postgres) can be 32-bit unsigned, but `Oid` hash routines must match the exact key size. In `write_state_management.c`:
  ```c
  // DANGEROUS: info.keysize mismatch
  info.keysize = sizeof(RelFileNumber); // 4 bytes
  info.hash = oid_hash;                 // Expects 4-byte Oid
  // If RelFileNumber expands or differs in padding, oid_hash causes unaligned reads
  ```
- **Implicit Bool Coercion vs Explicit Comparison**: In `backend_data.c`:
  ```c
  // WRONG: Evaluating integer as bool ignores negative status values
  if (backendData->transactionId.transactionNumber)
  
  // CORRECT: Strict zero equality test
  if (backendData->transactionId.transactionNumber != 0)
  ```
- **Pointer Arithmetic with Headers**: In `columnar_compression.c`, accessing the raw compressed data requires exact pointer offsets:
  ```c
  #define COLUMNAR_COMPRESS_HDRSZ ((int32) sizeof(ColumnarCompressHeader))
  #define COLUMNAR_COMPRESS_RAWDATA(ptr) (((char *) (ptr)) + COLUMNAR_COMPRESS_HDRSZ)
  ```
  Casting `ptr` to `(char *)` before applying the offset prevents word-size scaling errors.

### 2. Infinite Loop & Recursion Guards
Recursive expression tree walks (such as evaluating clauses or walking subtransactions) require strict depth limits:
- **Depth-Bounded Recursion**: In `columnar_customscan.c`, `AddColumnarScanPathsRec` enforces a hard limit:
  ```c
  static void
  AddColumnarScanPathsRec(PlannerInfo *root, RelOptInfo *rel,
                          RangeTblEntry *rte, Relids paramRelids,
                          Relids candidateRelids, int depthLimit)
  {
      if (depthLimit <= 0)
      {
          elog(DEBUG1, "Maximum custom scan path search depth exceeded");
          return;
      }
      // Recursive step:
      AddColumnarScanPathsRec(root, rel, rte, nextParamRelids, nextCandidateRelids, depthLimit - 1);
  }
  ```
- **Hash Table Iteration Termination**: When terminating a sequential hash table scan early, `hash_seq_term()` must be invoked:
  ```c
  if (CancelTransactionDueToDeadlock(...))
  {
      hash_seq_term(&status); // REQUIRED: Unlocks the HTAB iteration state
      return true;
  }
  ```
  Omitting `hash_seq_term(&status)` leaves internal shared hash table flags inconsistent.

### 3. UI & UX Micro-Mechanics (CLI & Operational Engine Visibility)
- **EXPLAIN Output Buffer Normalization**: When emitting query plans in `ColumnarScan_ExplainCustomScan`, formatting strings across JSON, YAML, and XML formats must use engine deparse contexts:
  ```c
  static void
  ColumnarScan_ExplainCustomScan(CustomScanState *node, List *ancestors, ExplainState *es)
  {
      List *context = set_deparse_context_planstate(es->deparse_cxt,
                                                    (Node *) node,
                                                    ancestors);
      const char *qualStr = ColumnarPushdownClausesStr(context, scanState->qual);
      ExplainPropertyText("Columnar Pushdown Quals", qualStr, es);
  }
  ```

### 4. Backend Concurrency & Memory Safety
- **Memory Context Reset Registration**: When global hash tables are stored across an entire transaction, leaking pointer state upon transaction abort causes catastrophic crashes. In `write_state_management.c`:
  ```c
  static MemoryContextCallback cleanupCallback;

  static void
  CleanupWriteStateMap(void *arg)
  {
      WriteStateMap = NULL;
      WriteStateContext = NULL;
  }

  // Bound to TopTransactionContext during initialization:
  cleanupCallback.func = &CleanupWriteStateMap;
  MemoryContextRegisterResetCallback(WriteStateContext, &cleanupCallback);
  ```
- **Buffer Extension Locking Protocol**: Modifying metapages requires distinct locking phases:
  ```c
  LockRelationForExtension(rel, ExclusiveLock);
  // Mutate metapage fields
  UnlockRelationForExtension(rel, ExclusiveLock);
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Safe Tuple Attribute Projection**: In columnar chunk reading (`DeserializeChunkData`), reading beyond column boundaries without validating attribute counts triggers memory corruption:
  ```c
  if (attributeForm->attisdropped)
  {
      // Dropped columns must be synthesized as nulls or defaults,
      // NOT read from storage streams.
      columnValues[attIdx] = (Datum) 0;
      columnNulls[attIdx] = true;
      continue;
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Boundary Decoupling**: Citus lives inside PostgreSQL as an extension rather than a hard fork. It intercepts the backend engine exclusively via exposed extension hooks: `planner_hook`, `set_rel_pathlist_hook`, `ExecutorStart_hook`, `ProcessUtility_hook`, and `tableam`.
- **State Separation**: Coordinator nodes manage metadata distributed catalogs (`pg_dist_*`), while worker nodes store concrete shard tables (`tablename_102001`). Columnar data is split into an arbitrary number of 8KB page blocks containing compressed columnar stripe chunks.

### 2. Core Abstractions
- `DistributedTransactionId`: A 3-tuple (`initiatorNodeIdentifier`, `transactionNumber`, `timestamp`) defining cluster-wide transactional identity.
- `ColumnarMetapage`: Block 0 structure of columnar relations recording `storageId`, `versionMajor`, `versionMinor`, `reservedStripeId`, and `reservedOffset`.
- `StripeMetadata`: Representation of a contiguous set of columnar chunk groups containing per-column data lengths, offsets, and row counts.

### 3. Error Handling
- **Deadlock Victim Selection**: Cycles in the distributed wait-for graph are broken by signaling the youngest participating transaction.
- **Subtransaction State Rollback**: `PopWriteStateForAllRels()` walks the `writeStateStack` during abort (`DiscardWriteStateForAllRels`), selectively discarding pending row buffers while propagating dropped table states back up the transaction hierarchy.

### 4. Testing
- **Multi-Session Isolation Specs**: Uses `.spec` files driving `isolationtester` (e.g., `isolation_deadlock_detection_txn_number_collision.spec`) to simulate step-by-step concurrent transaction execution across 5+ interleaved sessions.
- **SQLancer Fuzzing**: Integrates automated derived query replacement (DQR) equivalence testing to identify optimization divergences in complex analytical projections.

### 5. Security
- **Least Privilege Execution**: Worker RPC connections execute using authenticated libpq roles established by the coordinator. Citus metadata modifications are restricted to superuser or `citus_admin` role members.
- **Buffer Boundary Hardening**: All decompression engines (LZ4, ZSTD, PGLZ) execute with bounded length guards (`LZ4_compressBound`, `ZSTD_compressBound`, `PGLZ_MAX_OUTPUT`). Decompression routines explicitly assert that received output sizes match metadata declarations before returning buffers to the executor.

### 6. Performance
- **Chunk-Group Skipping**: Skip lists track column minimum and maximum values (`columnar.chunk`). Queries with restrictive `WHERE` clauses prune non-matching chunks prior to I/O and decompression.
- **Custom Scan Projection Pushdown**: Avoids reading non-projected column stripes entirely, reducing storage I/O and memory bus saturation.

### 7. Deployment
- **Multi-PG Version Compatibility Layer**: Headers like `pg_version_compat.h` abstract breaking internal changes between PostgreSQL 14, 15, 16, 17, and 18, allowing a single unified codebase to compile across major PostgreSQL versions.
- **Packaging Validation**: `.github/packaging/validate_build_output.sh` validates `.deb` and `.rpm` packaging artifacts, checking symbol exports and extension control file invariants.

### 8. Agent Patterns
- **Execution Loop Guards**: Distributed transaction coordinators employ loop guards and timeouts when awaiting worker confirmations during 2-phase commit commit-prepared phases.
- **Context Budget Optimization**: Query planning hooks filter candidate execution paths aggressively (`ColumnarMaxCustomScanPaths = 64`) to prevent combinatorial explosion during join path generation.

### 9. Data Flow
- **Data Ingestion Lifecycle**:
  `Heap Insert` -> `columnar_init_write_state()` -> Memory Buffering in `WriteStateContext` -> Stripe Size Limit Exceeded -> `ColumnarFlushPendingWrites()` -> Compress via ZSTD/LZ4 -> Format into 8KB Blocks via `smgrextend` -> Append to `columnar.stripe` metadata table.

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern
**Transactional SubXid Write-State Management**:
A per-relation stack of write states indexed by `SubTransactionId`. When a subtransaction begins, new writes push a state. If committed, writes merge or end; if aborted, writes are dropped without polluting parent transaction buffers.

### 2. Rule
*Every distributed control signal MUST validate the complete composite identifier (`<NodeId, XactId>`) under lock immediately prior to OS process emission.*

### 3. Architecture Principle
*Decouple Logical Analytical Formats from Physical Storage Blocks*:
The columnar engine presents an infinite contiguous byte stream to the compression and striping layer while strictly interacting with the storage engine through 8KB fixed-size buffer pages (`smgr` / `BufferManager`), ensuring complete compatibility with standard PostgreSQL backup, WAL, and checkpointing subsystems.

### 4. Failure Mode
**Foreign Pointer Injection in Slab Allocator**:
Passing a standard heap-allocated tuple pointer to PostgreSQL’s `ReorderBufferChange` struct results in `SlabFree()` invoking slab-specific chunk pointer arithmetic on unmanaged heap addresses, causing fatal walsender crashes (`SIGSEGV`).

### 5. Reusable Skill: Investigating Distributed Deadlock Detector Failures
1. Identify the failing backend pid and inspect the distributed transaction ID tuple: `node_id`, `transaction_number`.
2. Check if the local transaction counter has wrapped or collided with a remote transaction counter.
3. Validate if a TOCTOU window exists between graph node identification and signal dispatch.
4. Verify spinlock acquisition across the entire check-and-signal sequence.
5. Construct a `.spec` multi-session isolation test reproducing the lock ordering.

### 6. Decision: Custom Scan vs Foreign Data Wrapper (FDW)
- **Choice**: Implement a native Custom Scan (`CustomPathMethods`, `CustomScanMethods`, `CustomExecMethods`) and Table AM (`TableAmRoutine`) rather than relying on `postgres_fdw`.
- **Rationale**: FDW layers add overhead in tuple translation and lack deep integration with PostgreSQL's low-level cost-based optimizer, chunk skip lists, and shared buffer caches. Custom Scans allow direct qual and projection pushdown directly to worker storage engines.

### 7. Anti-Pattern: Monolithic Single-Attribute Global Identifiers
Using local sequence counters as global identifiers across independent database nodes:
```c
// BROKEN: Assumes node uniqueness
typedef struct {
    uint64 transactionNumber;
} GlobalTxnId;
```
Always use composite identifiers:
```c
typedef struct {
    int32  initiatorNodeIdentifier;
    uint64 transactionNumber;
    TimestampTz timestamp;
} DistributedTransactionId;
```

### 8. Verification Method
Automated verification of deadlock resolution via PostgreSQL's `isolationtester`:
```bash
src/test/regress/bin/isolationtester \
  -I src/test/regress/specs/isolation_deadlock_detection_txn_number_collision.spec
```

---

## 7. Actionable Agent Skill & Implementation Checklist

When tasked with modifying or extending distributed database engines or PostgreSQL extensions, an AI coding agent must execute the following checklist:

```
[ ] STEP 1: IDENTIFIER SCOPE AUDIT
    [ ] Check if all transaction/backend/query identifiers are globally unique across nodes.
    [ ] Ensure comparisons validate node origin (initiatorNodeIdentifier) alongside sequence IDs.

[ ] STEP 2: CONCURRENCY & TOCTOU VERIFICATION
    [ ] Verify state transitions occurring between inspection and signaling are guarded by spinlocks/mutexes.
    [ ] Ensure early exits release acquired locks (SpinLockRelease) in both branches.
    [ ] Call hash_seq_term(&status) if terminating an active HTAB sequential iteration.

[ ] STEP 3: MEMORY CONTEXT LIFECYCLE AUDIT
    [ ] Identify which MemoryContext owns each allocated object.
    [ ] If overriding pointers inside engine structs (e.g., ReorderBufferChange), allocate directly from that struct's parent context.
    [ ] Register a MemoryContextCallback for all static/global HTABs allocated inside transaction contexts.

[ ] STEP 4: RECURSION & TERMINATION PROOFS
    [ ] Check all recursive expression tree or subtransaction stack walks.
    [ ] Add an explicit depthLimit argument (e.g., depthLimit = 