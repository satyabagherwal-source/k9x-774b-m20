> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milvus-io-milvus-learnings.md`  
> **Source**: github ([https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus))  
> **Source Version**: `78f1a7a6`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T08:24:37.035Z  
> **Learning ID**: `learn-github-milvus-io-milvus`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): milvus-io/milvus

---

## 1. Executive Forensic Architecture & System Mechanics

Milvus is a distributed, cloud-native vector database engineered to execute nearest-neighbor vector indexing and hybrid scalar/vector search across billion-scale embedding spaces with sub-100-millisecond latency. To decouple compute bottlenecks from persistent storage lifecycles, Milvus enforces a four-plane disaggregated architecture:

```
                  +----------------------------------------------+
                  |               Client / SDK                   |
                  +----------------------------------------------+
                                         |
                                  gRPC / Proto
                                         v
   +----------------------------------------------------------------------------+
   |                             ACCESS LAYER                                   |
   |   Proxy (Stateless, sharding director, query fan-out & result reduction)   |
   +----------------------------------------------------------------------------+
                 /                       |                         \
                /                        v                          \
               /           +---------------------------+             \
              /            |     COORDINATOR LAYER     |              \
             /             |  RootCoord (DDL/Timestamp)|               \
            /              |  DataCoord (Segment/Alloc)|                \
           /               |  QueryCoord (Handoff/Dist)|                 \
          /                +---------------------------+                  \
         v                                                                 v
+------------------------+                                      +------------------------+
|      WORKER LAYER      |                                      |      WORKER LAYER      |
| DataNode (Log ingest,  |                                      | QueryNode (In-memory   |
| Flush, Compaction, V3) |                                      | Segment Search, HNSW,  |
+------------------------+                                      | DiskANN, SIMD Filters) |
         |                                                      +------------------------+
         | Writes binlogs / manifests                                      ^
         v                                                                 | Reads snapshots
+----------------------------------------------------------------------------------------+
|                                  STORAGE & LOG LAYER                                   |
|   WAL: Pulsar / Kafka / Embedded Rocksmq / StreamingNode                               |
|   Object Storage: MinIO / S3 / Azure Blob / GCS (Binlog chunks, Stats, Indexes)         |
|   Metadata KV: etcd / TiKV (Topology, Segments, Schema, Ticks)                         |
+----------------------------------------------------------------------------------------+
```

### 1. The Disaggregated Planes
* **Coordinator Layer (`RootCoord`, `DataCoord`, `QueryCoord`)**: Maintains global consensus and metadata catalog state over etcd/TiKV. Allocates Hybrid Logical Clock (HLC) physical/logical timestamps (`tsoutil`), assigns physical channels (PChannels) and virtual channels (VChannels), tracks segment states (`Growing -> Sealed -> Flushed -> Dropped`), coordinates compaction lifecycles, and computes segment distribution trees across QueryNodes.
* **Worker Layer (`DataNode`, `QueryNode`, `IndexNode`)**:
  * `DataNode`: Consumes mutations directly from message brokers (WAL), buffers records in dynamic batch allocators, executes memory serialization into columnar binlogs (Storage V1/V2/V3), runs segment compaction (clustering, binlog merging), and flushes manifests to object storage.
  * `QueryNode`: Subscribes to incremental channel WALs while simultaneously mounting immutable historical segment files from object storage into RAM or memory-mapped files (`mmap`). Employs Knowhere (C++ execution engine binding FAISS, HNSW, DiskANN, SCaNN) through CGO to run SIMD-vector similarity searches.
  * `IndexNode`: Asynchronous compute worker pulling unindexed segment chunks to construct vector and inverted scalar graphs off the critical write path.
* **Storage and Persistence Boundary**: Storage abstraction splits into an append-only WAL stream and an immutable columnar object store (Arrow RecordBatches, Parquet, or native Milvus binlogs). Segments transition through strict states: insertions land first in WAL, materializing as `Growing` segments in `QueryNode` buffers; when sized or timed out, `DataCoord` triggers sealing and issues flush plans to `DataNode`, outputting immutable columnar binlogs to object storage.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Explicit Column Existence Guarding Across Heterogeneous Arrow Deserialization
**RULE**:
When deserializing or mapping columnar data structures (such as Apache Arrow `Record` batches or protobuf arrays) across dynamic schema boundaries, code MUST NOT directly index column offsets via unsafe dereferences (e.g., `r.Column(id)`). The runtime MUST verify column existence and concrete underlying data layout before row-level access using explicit presence probes (e.g., `TryRecordColumn`), and return a non-retriable fatal internal error (`ServiceInternal`) if a required schema contract is violated.

**WHY**:
Directly invoking methods on a missing column pointer causes a `nil` pointer dereference panic inside long-running batch workers (such as DataNode compaction or ETL loops). If compaction panics, the worker crashes, triggering Kubernetes restart loops, segment lock timeouts, and cascading coordination failovers. Compaction plans generated internally are invariant-bound; a missing column indicates catalog/manifest corruption, not a transient I/O glitch. It must fail fast with `retriable=false` rather than poisoning retry queues.

**WHEN TO APPLY**:
Apply in all columnar data engines (Arrow, Parquet, Feather, native columnar stores), compactor tasks, analytics extractors, and schema transformation pipelines where input records may originate from varying storage format versions (Storage V1, V2, V3).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted from internal/datanode/compactor/clustering_compactor.go
func (t *clusteringCompactionTask) mappingSegment(r storage.Record, hasTTLField bool) error {
    // 1. Safe column extraction with presence probe
    pkColumn, _ := storage.TryRecordColumn(r, t.primaryKeyField.GetFieldID())
    
    // 2. Direct validation and concrete type assertion for critical routing fields
    ts, exists := storage.TryRecordColumn(r, common.TimeStampField)
    tsColumn, ok := ts.(*array.Int64)
    if !exists || !ok {
        return merr.WrapErrServiceInternalMsg("timestamp field is not an int64 column in clustering compaction record")
    }

    var ttlColumn, clusteringKeyColumn arrow.Array
    if hasTTLField {
        ttlColumn, _ = storage.TryRecordColumn(r, t.ttlFieldID)
    }
    if !t.isVectorClusteringKey {
        clusteringKeyColumn, _ = storage.TryRecordColumn(r, t.clusteringKeyField.GetFieldID())
    }

    for row := 0; row < r.Len(); row++ {
        // Safe access helper guarantees non-nil array dereference
        if hasTTLField {
            value, err := clusteringScalarValue(ttlColumn, ttlField, row)
            if err != nil {
                return err
            }
            _ = value
        }
        if !t.isVectorClusteringKey {
            key, err := clusteringScalarValue(clusteringKeyColumn, t.clusteringKeyField, row)
            if err != nil {
                return err
            }
            _ = key
        }
    }
    return nil
}

func clusteringScalarValue(column arrow.Array, field *schemapb.FieldSchema, row int) (any, error) {
    if column == nil {
        return nil, merr.WrapErrServiceInternalMsg("missing required column for field %d in clustering compaction", field.GetFieldID())
    }
    if column.IsNull(row) {
        if field.GetDefaultValue() != nil {
            return storage.GetDefaultValue(field), nil
        }
        return nil, nil
    }
    // Concrete value extraction continues safely...
    return nil, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// NEVER DO THIS: Blind column indexing assumes the record matches the schema perfectly
func (t *clusteringCompactionTask) mappingSegmentBad(r storage.Record) error {
    // BUG: If primaryKeyField or TimeStampField was omitted or mapped under an alias,
    // r.Column(...) returns nil. The next line panics with nil-pointer dereference!
    pkColumn := r.Column(t.primaryKeyField.GetFieldID())
    tsColumn := r.Column(common.TimeStampField).(*array.Int64) 
    
    for row := 0; row < r.Len(); row++ {
        // Blind dereference without checking column validity
        if pkColumn.IsNull(row) { 
            continue 
        }
    }
    return nil
}
```

**VERIFICATION METHOD**:
Enforce negative fuzzing and unit test matrices using synthetic Arrow records where required fields (PK, Timestamp, Clustering Key, TTL) are systematically omitted. The harness must assert `require.NotPanics` and verify that `merr.ErrServiceInternal` is returned:
```go
func TestClusteringMappingRejectsMissingScalarColumn(t *testing.T) {
    schema := genCollectionSchema()
    malformed := proto.Clone(schema).(*schemapb.CollectionSchema)
    malformed.Fields = malformed.Fields[1:] // Intentionally strip PK column
    record := clusteringTestRecord(t, malformed, 0, 1)
    defer record.Release()

    task := &clusteringCompactionTask{...}
    require.NotPanics(t, func() {
        err := task.mappingSegment(record, false)
        require.ErrorIs(t, err, merr.ErrServiceInternal)
    })
}
```

---

### 2. Isolation of Cross-Goroutine Inspection from Mutable Worker Execution
**RULE**:
When an asynchronous worker task exposes internal runtime statistics to external monitoring or debugging interfaces (e.g., via HTTP, JSON marshaling, or gRPC telemetry), fields mutated during the worker's execution lifecycle MUST be synchronized under a dedicated mutex or cloned into an immutable snapshot. Furthermore, structs containing synchronization primitives MUST NEVER be passed or copied by value.

**WHY**:
Background metrics endpoints (such as `MarshalJSON` invoked by an LRU eviction or administrative dump) execute on arbitrary HTTP handler goroutines concurrently with active worker pipelines. Concurrent read/write of integer words (`flushedSize`), pointer clearance (`pack.ReleaseData()`), and duration tracking (`execTime`) causes Go memory model data races, panics due to partial word tearing on 32-bit platforms, and nil-pointer dereferences when checking `pack.deltaData.RowCount` while `ReleaseData()` is active.

**WHEN TO APPLY**:
Apply in any stateful long-running background task (`FlushTask`, `SyncTask`, `CompactionTask`, `IndexBuildTask`) held in memory registries, LRU caches, or metric trackers accessible by observability interfaces.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted from internal/flushcommon/syncmgr/task.go
type SyncTask struct {
    segmentID int64
    batchRows int64
    pack      *SyncPack

    // statsMu serializes Run's writes to flushedSize, execTime and
    // pack.deltaData (cleared by ReleaseData) with MarshalJSON.
    statsMu     sync.Mutex
    flushedSize int64
    execTime    time.Duration
}

func (t *SyncTask) Run(ctx context.Context) error {
    var flushedSize int64
    // Execution writes to local variable first
    flushedSize, err := t.executeFlush(ctx)
    if err != nil {
        return err
    }

    t.statsMu.Lock()
    t.flushedSize = flushedSize
    t.statsMu.Unlock()

    // pack.ReleaseData() clears memory pointers; protect the boundary
    t.statsMu.Lock()
    t.pack.ReleaseData()
    t.statsMu.Unlock()

    elapsed := t.tr.ElapseSpan()
    t.statsMu.Lock()
    t.execTime = elapsed
    t.statsMu.Unlock()

    return nil
}

func (t *SyncTask) MarshalJSON() ([]byte, error) {
    // Snapshot state atomically under lock; marshal outside lock to prevent blocking Run
    t.statsMu.Lock()
    deltaRowCount := int64(0)
    if t.pack != nil && t.pack.deltaData != nil {
        deltaRowCount = t.pack.deltaData.RowCount
    }
    flushedSize, execTime := t.flushedSize, t.execTime
    t.statsMu.Unlock()

    return json.Marshal(&metricsinfo.SyncTask{
        SegmentID:     t.segmentID,
        BatchRows:     t.batchRows,
        DeltaRowCount: deltaRowCount,
        FlushSize:     flushedSize,
        RunningTime:   execTime.String(),
    })
}
```

**NEGATIVE CONSTRAINT**:
```go
// NEVER DO THIS: Passing structs containing sync.Mutex by value breaks lock semantics
// and violates the Go copylocks invariant.
func (s *SyncManagerSuite) BadTestSyncManager() {
    task1 := &SyncTask{segmentID: 1}
    task2 := &SyncTask{segmentID: 2}

    // BAD: Dereferencing pointers (*task1) copies the sync.Mutex, rendering it invalid
    // and causing `go vet` to fail with "assignment copies lock value".
    expectedTasks := []SyncTask{*task1, *task2} 
    _, _ = json.Marshal(expectedTasks)
}
```

**VERIFICATION METHOD**:
1. Run `go vet ./...` in CI to detect `copylocks` violations on any struct containing `sync.Mutex`.
2. Construct concurrent execution tests under the Go race detector (`go test -race`):
```go
func TestSyncTask_MarshalJSONConcurrentWithRun(t *testing.T) {
    task := NewTestSyncTask()
    done := make(chan struct{})
    go func() {
        for {
            select {
            case <-done:
                return
            default:
                _, _ = task.MarshalJSON()
            }
        }
    }()
    assert.NoError(t, task.Run(context.Background()))
    close(done)
}
```

---

### 3. Snapshot Re-Verification on Aborted Terminal Dependency States
**RULE**:
When computing aggregate distributed state from multiple decoupled metadata snapshots (e.g., segment catalog states vs. task execution states), if a secondary state check reveals a terminal abort condition (e.g., `IndexState_Failed`), the query engine MUST NOT immediately fail the parent transaction. It MUST re-verify whether the primary resource was modified or dropped concurrently since the initial snapshot was taken.

**WHY**:
In asynchronous distributed databases, state mutations (such as `DropPartition` or segment drops) are copy-on-write and propagate across metadata keys at distinct timestamps. If a reader takes a snapshot of live segments (`State=Flushed`), and concurrently a segment is dropped, its pending indexing tasks are aborted and marked `Failed`. If the reader queries the index metadata *after* the drop but relies on the *prior* segment snapshot, it perceives a healthy flushed segment with a failed index, falsely reporting the entire collection index as failed to the user.

**WHEN TO APPLY**:
Apply to all distributed orchestrators, coordinators, and catalog readers that merge two or more separately locked metastore keys (e.g., segment metadata and index/compaction task registries).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted from internal/datacoord/index_service.go
func (s *Server) selectSegmentIndexesStats(ctx context.Context, filters ...SegmentFilter) ([]*SegmentInfo, map[int64]*indexStats) {
    segments := s.meta.SelectSegments(ctx, filters...)
    segmentIDs := lo.Map(segments, func(info *SegmentInfo, _ int) int64 { return info.GetID() })
    
    segmentsIndexes := s.meta.indexMeta.getSegmentsIndexStates(segments[0].CollectionID, segmentIDs)
    
    // Invariant guard: Detect if a failure is merely a phantom caused by a concurrent drop
    if s.droppedSinceSnapshot(ctx, segments, segmentsIndexes) {
        // Re-read segments to ensure consistency with index state updates
        segments = s.meta.SelectSegments(ctx, filters...)
    }
    
    // Continue building aggregate index statistics...
    return segments, nil
}

func (s *Server) droppedSinceSnapshot(ctx context.Context, segments []*SegmentInfo, segmentsIndexes map[int64]map[int64]*indexpb.SegmentIndexState) bool {
    for _, info := range segments {
        // Only inspect segments believed to be Flushed that report an index failure
        if !isFlushState(info.GetState()) || !hasFailedSegmentIndex(segmentsIndexes[info.GetID()]) {
            continue
        }
        // Query the live catalog: if the segment is no longer Flushed (or dropped),
        // the task failure was an intentional abort, not a build error.
        if current := s.meta.GetSegment(ctx, info.GetID()); current == nil || !isFlushState(current.GetState()) {
            return true
        }
    }
    return false
}

func hasFailedSegmentIndex(states map[int64]*indexpb.SegmentIndexState) bool {
    for _, state := range states {
        if state.GetState() == commonpb.IndexState_Failed {
            return true
        }
    }
    return false
}
```

**NEGATIVE CONSTRAINT**:
```go
// NEVER DO THIS: Blind trust in multi-key snapshot composition
func (s *Server) selectSegmentIndexesStatsBad(ctx context.Context, filters ...SegmentFilter) error {
    segments := s.meta.SelectSegments(ctx, filters...) // Snapshot 1
    segmentIDs := extractIDs(segments)
    
    // Snapshot 2 taken t + delta later without cross-validation
    states := s.meta.indexMeta.getSegmentsIndexStates(segmentIDs) 
    
    for _, seg := range segments {
        if states[seg.ID].State == commonpb.IndexState_Failed {
            // BUG: False positive! seg may have been deleted 1ms ago.
            // Returning an error aborts client operations needlessly.
            return errors.New("index build failed on segment") 
        }
    }
    return nil
}
```

**VERIFICATION METHOD**:
Implement deterministic race injection using monkey patching or interceptors (`mockey`):
```go
func TestIndexState_SegmentDroppedAfterSnapshot(t *testing.T) {
    s := newDroppedSegmentRaceServer(t)
    // Hook getSegmentsIndexStates to mutate segment state to Dropped before returning
    mocker := mockey.Mock((*indexMeta).getSegmentsIndexStates).To(
        func(m *indexMeta, collID int64, segIDs []int64) map[int64]map[int64]*indexpb.SegmentIndexState {
            dropSegmentInMeta(s, segIDs[0])()
            return map[int64]map[int64]*indexpb.SegmentIndexState{
                segIDs[0]: {100: {State: commonpb.IndexState_Failed, FailReason: "segment dropped"}},
            }
        }).Build()
    defer mocker.UnPatch()

    resp, err := s.GetIndexState(context.Background(), &indexpb.GetIndexStateRequest{...})
    require.NoError(t, err)
    require.NotEqual(t, commonpb.IndexState_Failed, resp.GetState())
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Clustering Compaction Panic on Schema Omission (BUG-MILVUS-54220)
- **Context**: `internal/datanode/compactor/clustering_compactor.go` & `internal/storage/arrow_util.go`
- **What Was Expected**: Compaction task initialization and segment mapping should validate required schema fields, surface explicit non-retriable internal errors when invariants are violated, and handle mixed UTF-8 / Binary LOB representations for null `TEXT` fields.
- **What Actually Happened**: Tasks panicked with nil-pointer dereferences when internal compaction plans lacked a primary key, clustering key, or TTL column. Furthermore, Arrow `RecordBuilder` crashed when concatenating empty/null `TEXT` columns represented as binary nulls against string builders.
- **Evidence in Repo**: Commit `9ed2c983`, PR `#54220`, tests in `internal/datanode/compactor/clustering_compactor_test.go`.
- **Root Cause**: `clusteringCompactionTask.init()` assumed that `t.plan.Schema` contained valid primary key and clustering key metadata without asserting non-nil pointers. In `mappingSegment()`, `r.Column(...)` was invoked directly; if a column was missing, the dereference crashed the DataNode process.
- **Remediation Code Diff**:
```diff
--- a/internal/datanode/compactor/clustering_compactor.go
+++ b/internal/datanode/compactor/clustering_compactor.go
@@ -303,9 +303,17 @@ func (t *clusteringCompactionTask) init() error {
 			pkField = field
 		}
 		if field.GetFieldID() == t.plan.GetClusteringKeyField() {
-			t.clusteringKeyField = field
+			clusteringKeyField = field
 		}
 	}
+	// Required fields are an internal plan contract, so missing fields use
+	// ServiceInternal. The nil-schema check retains its legacy error code.
+	if pkField == nil {
+		return merr.WrapErrServiceInternalMsg("no primary key field found")
+	}
+	if clusteringKeyField == nil {
+		return merr.WrapErrServiceInternalMsg("clustering key field %d not found in compaction schema", t.plan.GetClusteringKeyField())
+	}
@@ -718,12 +727,22 @@ func (t *clusteringCompactionTask) mappingSegment(
-		pkColumn := r.Column(t.primaryKeyField.GetFieldID())
+		pkColumn, _ := storage.TryRecordColumn(r, t.primaryKeyField.GetFieldID())
 		ts, exists := storage.TryRecordColumn(r, common.TimeStampField)
 		tsColumn, ok := ts.(*array.Int64)
 		if !exists || !ok {
 			return merr.WrapErrServiceInternalMsg("timestamp field is not an int64 column in clustering compaction record")
 		}
+		var ttlColumn, clusteringKeyColumn arrow.Array
+		if hasTTLField {
+			ttlColumn, _ = storage.TryRecordColumn(r, t.ttlFieldID)
+		}
+		if !t.isVectorClusteringKey {
+			clusteringKeyColumn, _ = storage.TryRecordColumn(r, t.clusteringKeyField.GetFieldID())
+		}
```
- **Lesson**: Internal planning representations are not exempt from strict boundary validation. Defensive presence checks (`TryRecordColumn`) must guard every columnar access layer.

---

### Incident 2: Data Race on SyncTask Serialization During Live Flush (BUG-MILVUS-54183)
- **Context**: `internal/flushcommon/syncmgr/task.go`
- **What Was Expected**: Administrative telemetry queries (`TaskStatsJSON`) retrieving task metrics from `syncManager.taskStats` (an LRU cache) must safely format executing tasks without causing memory corruption.
- **What Actually Happened**: The Go runtime race detector caught concurrent read/write faults. Goroutines executing `SyncTask.Run()` were writing `flushedSize`, clearing `pack.deltaData` via `ReleaseData()`, and updating `execTime` while `MarshalJSON()` read those exact fields without locks, causing race warnings and occasional nil pointer panics on `pack.deltaData.RowCount`.
- **Evidence in Repo**: Commit `d6ab2f0d`, PR `#54183`, Issue `#54146`. Test: `TestSyncTask_MarshalJSONConcurrentWithRun`.
- **Root Cause**: The developer exposed pointer-level access to active, executing tasks within a queryable LRU cache without defining a synchronization boundary between execution writes and reporting reads.
- **Remediation Code Diff**:
```diff
--- a/internal/flushcommon/syncmgr/task.go
+++ b/internal/flushcommon/syncmgr/task.go
@@ -89,6 +90,12 @@ type SyncTask struct {
 	tr *timerecord.TimeRecorder
 
+	// statsMu serializes Run's writes to flushedSize, execTime and
+	// pack.deltaData (cleared by ReleaseData) with MarshalJSON.
+	statsMu     sync.Mutex
 	flushedSize int64
 	execTime    time.Duration
@@ -165,6 +176,9 @@ func (t *SyncTask) Run(ctx context.Context) (err error) {
 	}
+	t.statsMu.Lock()
+	t.flushedSize = flushedSize
+	t.statsMu.Unlock()
@@ -197,7 +208,9 @@ func (t *SyncTask) Run(ctx context.Context) (err error) {
 	}
 
+	t.statsMu.Lock()
 	t.pack.ReleaseData()
+	t.statsMu.Unlock()
@@ -339,19 +354,22 @@ func (t *SyncTask) MarshalJSON() ([]byte, error) {
+	t.statsMu.Lock()
 	deltaRowCount := int64(0)
 	if t.pack != nil && t.pack.deltaData != nil {
 		deltaRowCount = t.pack.deltaData.RowCount
 	}
+	flushedSize, execTime := t.flushedSize, t.execTime
+	t.statsMu.Unlock()
```
- **Lesson**: Tasks held in registries or caches must synchronize observability methods (`MarshalJSON`, `String`) against mutating execution pipelines using fine-grained mutexes.

---

### Incident 3: Phantom Index Failures from Concurrent Segment Drops (BUG-MILVUS-54090)
- **Context**: `internal/datacoord/index_service.go`
- **What Was Expected**: When a partition or segment is dropped while an index build is in progress, the index service should gracefully ignore the aborted index tasks and report accurate index health for remaining live segments.
- **What Actually Happened**: Clients calling `create_index` or `DescribeIndex` received a fatal `IndexState_Failed` error. The entire index build was marked broken, aborting downstream query pipelines.
- **Evidence in Repo**: Commit `6324b399`, PR `#54090`, Issue `#54065`. Test: `TestIndexState_SegmentDroppedAfterSnapshot`.
- **Root Cause**: `selectSegmentIndexesStats` fetched a snapshot of segments first (where `State = Flushed`). While computing index states, a concurrent `DropPartition` aborted the index task, persisting its state as `Failed` with reason `segment is dropped, index task aborted`. The subsequent index state read perceived a `Flushed` segment coupled with a `Failed` index task, triggering a false-positive collection-level failure.
- **Remediation Code Diff**:
```diff
--- a/internal/datacoord/index_service.go
+++ b/internal/datacoord/index_service.go
@@ -675,6 +675,14 @@ func (s *Server) selectSegmentIndexesStats(ctx context.Context, filters ...Segme
 	}
 	hasCompactionLineage := false
 	segmentsIndexes := s.meta.indexMeta.getSegmentsIndexStates(segments[0].CollectionID, segmentIDs)
+	if s.droppedSinceSnapshot(ctx, segments, segmentsIndexes) {
+		// The index states carry a task aborted because its segment was
+		// dropped after the snapshot. Re-select segments to observe the drop.
+		segments = s.meta.SelectSegments(ctx, filters...)
+	}
 	for _, info := range segments {
@@ -803,6 +811,29 @@ func (s *Server) droppedSinceSnapshot(ctx context.Context, segments []*SegmentI
+func (s *Server) droppedSinceSnapshot(ctx context.Context, segments []*SegmentInfo, segmentsIndexes map[int64]map[int64]*indexpb.SegmentIndexState) bool {
+	for _, info := range segments {
+		if !isFlushState(info.GetState()) || !hasFailedSegmentIndex(segmentsIndexes[info.GetID()]) {
+			continue
+		}
+		if current := s.meta.GetSegment(ctx, info.GetID()); current == nil || !isFlushState(current.GetState()) {
+			return true
+		}
+	}
+	return false
+}
```
- **Lesson**: In asynchronous multi-stage metadata reads, apparent downstream failure states must trigger a fresh read of upstream prerequisites to filter out benign cascading cancellations.

---

### Incident 4: Metadata Inconsistency via Historical V3 Column Group Aliases (BUG-MILVUS-54658)
- **Context**: `internal/storagecommon` & Storage V3 Recovery Engine
- **What Was Expected**: Recovery of Storage V3 segments from manifests should match physical column groups deterministically against field sets without failing on legacy aliases.
- **What Actually Happened**: The segment recovery engine rejected valid manifests written by older revisions, causing node crash-loops during crash-recovery and restart.
- **Evidence in Repo**: PR `#54658`, PR `#54657`, Issue `#54650`.
- **Root Cause**: Historical recovery routines assigned divergent logical identifiers to identical physical column groups over time. This produced multiple `Statistics` entries for a single field set. The strict recovery matcher interpreted these duplicates as fatal structural corruptions.
- **Remediation Strategy**: Coalesced equivalent field sets under a deterministic ID by summing memory sizes, pre-seeding recovered collectors with IDs matching the write layout, and retaining explicit rejections only for ambiguous overlaps.
- **Lesson**: Storage format evolutions must retain backwards-tolerant recovery coalescing logic when manifest normalization rules change across versions.

---

### Incident 5: Stale Topology Replay in Replicator Ingestion (BUG-MILVUS-CDC-01)
- **Context**: `internal/cdc/util/util.go`
- **What Was Expected**: When a CDC (Change Data Capture) replicator resumes from a checkpoint following a cluster restore or promotion, it must ignore stale topology modifications that occurred prior to its checkpoint.
- **What Actually Happened**: The replicator replayed historical `AlterReplicateConfig` messages that tore down channel replication edges that had since been re-established, causing active replication streams to abruptly terminate.
- **Evidence in Repo**: `internal/cdc/util/util.go`, functions `IsStaleTopologyChange` and `IsReplicationRemovedByAlterReplicateConfigMessage`.
- **Root Cause**: Checkpoint restoration walks WAL messages starting from an earlier point in time. Messages containing structural alterations (`AlterReplicateConfig`) carry physical time ticks. Evaluating them blindly without checking whether `msg.TimeTick() <= initTimeTick` applied obsolete configuration states.
- **Remediation Pattern**:
```go
func IsStaleTopologyChange(msg message.ImmutableMessage, replicateInfo *streamingpb.ReplicatePChannelMeta) bool {
    initTimeTick := replicateInfo.GetInitializedCheckpoint().GetTimeTick()
    return initTimeTick != 0 && msg.TimeTick() <= initTimeTick
}
```
- **Lesson**: WAL replay routines must explicitly check the temporal validity of control plane directives against the task's initialization barrier.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### Safe Type-Punning of Strings to Read-Only Byte Slices
In Go runtime hashing loops (such as `internal/agg/aggregate_util.go`), allocating a byte slice via `[]byte(str)` triggers a heap allocation and memory copy. Milvus achieves zero-copy hashing using `unsafe.StringData`:
```go
// Extracted from StringFieldAccessor.Hash
val := stringField.vals[idx]
// Zero-allocation slice header projection
b := unsafe.Slice(unsafe.StringData(val), len(val))
stringField.hasher.Write(b)
return stringField.hasher.Sum64()
```
*Token Precision Invariant*: `unsafe.Slice` must ONLY be passed to functions that guarantee read-only semantics (like `hasher.Write`). If the receiver mutates the buffer, it violates Go's runtime guarantee that string memory is immutable, causing undefined behavior or segfaults.

#### IEEE-754 BFloat16 Bit-Shifting Invariants
When converting floating-point vectors to and from bfloat16 (`client/internal/typeutil/typeutil.go`):
```go
func Float32ArrayToBFloat16Bytes(values []float32) []byte {
    result := make([]byte, 2*len(values))
    for i, value := range values {
        // High 16 bits contain sign (1), exponent (8), and top mantissa (7)
        binary.LittleEndian.PutUint16(result[i*2:], uint16(math.Float32bits(value)>>16))
    }
    return result
}

func BFloat16BytesToFloat32Vector(values []byte) []float32 {
    result := make([]float32, len(values)/2)
    for i := range result {
        // Shift uint16 left into high 16 bits of uint32
        result[i] = math.Float32frombits(uint32(binary.LittleEndian.Uint16(values[i*2:])) << 16)
    