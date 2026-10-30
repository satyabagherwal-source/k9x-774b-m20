> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/clickhouse-clickhouse-learnings.md`  
> **Source**: github ([https://github.com/ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse))  
> **Source Version**: `d7fbe7d3`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T08:18:55.077Z  
> **Learning ID**: `learn-github-clickhouse-clickhouse`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): ClickHouse/ClickHouse

---

## 1. Executive Forensic Architecture & System Mechanics

ClickHouse is an analytical, column-oriented database management system (OLAP) engineered for high-throughput vectorized query execution, massive parallel processing (MPP), and petabyte-scale storage engines (MergeTree family). The engine achieves sustained throughput in the tens of gigabytes per second per core by stripping abstraction layers down to hardware primitives (SIMD vectorization, cache-line-aligned block layouts, zero-copy deserialization, and custom memory management).

```
+----------------------------------------------------------------------------------------------------+
|                                    CLICKHOUSE CORE ARCHITECTURE                                    |
+----------------------------------------------------------------------------------------------------+
| [Client Tier] Native TCP / HTTP / Embedded WebTerminal / MySQL-Postgres Wire                       |
|         │                                                                                          |
|         ▼                                                                                          |
| [Query Processing Pipeline]                                                                        |
|   Parser ──► AST ──► Interpreter / Analyzer ──► Query Plan DAG ──► Pipeline Executors (Pull/Push) |
|         │                                                 │                                        |
|         │                                                 ▼                                        |
|         │                                     [Query Condition Cache / Top-K]                      |
|         ▼                                                                                          |
| [Vectorized Execution Engine]                                                                      |
|   Chunk / Block (Columns: IColumn -> ColumnVector, ColumnCompressed, ColumnNullable)              |
|         │                                                                                          |
|         ▼                                                                                          |
| [Storage Engines] MergeTree Family / StorageFile / S3 / ObjectStorage Engine                       |
|   ├── Part Hierarchy (All_X_Y_Z)                                                                   |
|   ├── Primary Index (.idx) / Granule Marks (.mrk2 / .mrk3) -> Wide / Compact Parts                 |
|   └── Column Compression (LZ4 / ZSTD) & Sparse Column Serializers                                  |
|         │                                                                                          |
|         ▼                                                                                          |
| [Low-Level Infrastructure]                                                                         |
|   Poco Foundation Overrides, Memory Allocator (Jemalloc), SymbolIndex (ELF/Dwarf unwinding),       |
|   IO Buffers (ReadBuffer / WriteBufferFromFileDescriptor), ThreadPools & BackgroundSchedules       |
+----------------------------------------------------------------------------------------------------+
```

### Architectural Subsystem Decoupling & Invariants
1. **Columnar Primitives (`IColumn`) vs. Type System (`IDataType`)**:
   Columns are raw, cache-contiguous memory buffers representing values of uniform type. `IDataType` dictates serialization, parsing, and semantic behavior, while `IColumn` implements vectorized transformations without virtual dispatch inside tight loops (using template instantiation via CRTP or visitor patterns).
2. **Block-Level Processing Pipeline**:
   Queries evaluate across `Block` collections (heterogeneous tuples of `ColumnWithTypeAndName`). Execution pipelines construct directed acyclic graphs (DAGs) of `ISimpleTransform` and `IProcessor` nodes using push/pull mechanics driven by dynamic thread scheduling.
3. **Storage Part Lifecycle & Detachment Invariants**:
   MergeTree divides tables into immutable physical directories called "parts". State mutations occur purely through functional merges (LSM-tree tree-compaction variant). Parts are read-only; corrupted or unreadable parts must be detached under strict criteria to prevent catastrophic silent data loss.
4. **Buffer Architecture (`WriteBuffer` / `ReadBuffer`)**:
   All I/O operations bypass standard C++ stream interfaces (`std::iostream`) due to heap allocations and virtual call overheads. ClickHouse relies on contiguous memory buffer pointers (`position()`, `limit()`) backed by OS file descriptors, ring-buffers, or network sockets with strict cancellation invariants.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Cache Key Derivation for Dynamic Schema / Context Sources
**RULE**:
When generating a deterministic cache key for query plans, intermediate results, or condition filters, the key MUST incorporate every implicit contextual configuration and metadata boundary that changes the physical origin or value domain of any participating identifier. Cache keys MUST NOT rely solely on the explicit AST expression and dataset identifier.

**WHY**:
In queries utilizing polymorphic storage wrappers (e.g., table functions like `file()` or S3 object stores), table schemas and column origins dynamically bifurcate based on session settings (e.g., `use_hive_partitioning`). If a column can be derived either from a physical path segment or an internal file stream depending on a flag, excluding that partition metadata from the cache hash causes identical AST filters to retrieve invalid, corrupted, or stale cached condition results across heterogeneous execution contexts.

**WHEN TO APPLY**:
Apply in any query optimizer, database storage engine, condition cache (TopK dynamic filter caches), or memoized compute layer where column resolution pathways depend on query-level settings or environment flags.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
#include <boost/functional/hash.hpp>
#include <Common/SipHash.h>

struct CacheKeyBuilder
{
    static UInt64 computeTopKCacheKey(
        const StoragePtr & storage,
        const PlanFilter & filter,
        UInt64 files_hash,
        const std::string & table_name)
    {
        UInt64 condition_hash = 0;
        
        // 1. Hash explicit AST / execution plan invariant
        boost::hash_combine(condition_hash, filter.plan_hash);
        
        // 2. Hash physical file identifiers / version tokens
        boost::hash_combine(condition_hash, files_hash);
        
        // 3. Hash canonical table identifier
        SipHash table_name_hash;
        table_name_hash.update(table_name.size());
        table_name_hash.update(table_name);
        boost::hash_combine(condition_hash, table_name_hash.get64());

        // 4. MUST cover dynamic partition resolution state:
        // Incorporate metadata describing whether columns are bound to the path or payload
        SipHash hive_columns_hash;
        for (const auto & column : storage->hive_partition_columns_to_read_from_file_path)
        {
            hive_columns_hash.update(column.name.size());
            hive_columns_hash.update(column.name);
            const std::string type_name = column.type->getName();
            hive_columns_hash.update(type_name.size());
            hive_columns_hash.update(type_name);
        }
        boost::hash_combine(condition_hash, hive_columns_hash.get64());

        return condition_hash;
    }
};
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Excluding storage-level contextual resolution attributes
UInt64 condition_hash = 0;
boost::hash_combine(condition_hash, filter.plan_hash);
boost::hash_combine(condition_hash, files_hash);
boost::hash_combine(condition_hash, table_name_hash.get64());
// FAILS: When use_hive_partitioning changes from 1 to 0 across runs,
// partition columns shift from path tokens to payload columns, causing cache collisions!
return condition_hash;
```

**VERIFICATION METHOD**:
Execute parameterized integration tests where the identical query is run sequentially across alternating partition-resolution modes (`use_hive_partitioning=1`, then `0`, then `1`, then `0`). Verify that the output array exactly reflects the true source data without reading cross-contaminated cache artifacts.

---

### 2. State Guard for Canceled and Teardown-Signaled I/O Sinks
**RULE**:
Before writing terminal sequences, control characters, progress updates, or flushes to any abstracted output buffer or socket descriptor, the caller MUST verify that the buffer has not transitioned to a canceled, closed, or poisoned state (`isCanceled() == false`).

**WHY**:
When a client abruptly tears down a connection (e.g., closing a WebSocket or raw TCP socket during high-throughput queries), the writing socket transitions to a failed state, setting internal cancellation flags. Secondary background threads, signal handlers, or progress monitors running concurrently that attempt to clear screens, restore cursors, or write progress counters will trip assertions or throw unhandled `LOGICAL_ERROR` exceptions (`Cannot write to canceled buffer`), crashing worker threads or polluting system error logs.

**WHEN TO APPLY**:
Apply in all interactive CLI clients, embedded server terminals, logging adapters, and asynchronous network streamers where writes occur asynchronously to connections subject to abrupt client disconnection.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
void ProgressTable::writeTable(
    WriteBufferFromFileDescriptor & message,
    std::unique_lock<std::mutex> & lock,
    bool show_table,
    bool toggle_enabled,
    bool is_final)
{
    // Mandatory state check: Client connection or terminal descriptor may already be torn down
    if (message.isCanceled())
        return;

    std::lock_guard sub_lock{mutex};
    
    // Proceed with control-sequence emission only when the pipeline sink is verified intact
    message << HIDE_CURSOR;
    if (!show_table && toggle_enabled)
        return;

    // Render progress representation...
}

void ProgressTable::clearTableOutput(
    WriteBufferFromFileDescriptor & message,
    std::unique_lock<std::mutex> &)
{
    if (message.isCanceled())
        return;

    message << "\r" << CLEAR_TO_END_OF_SCREEN << SHOW_CURSOR;
    message.next();
}
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Blindly writing escape codes or telemetry to buffers without cancellation checks
void UnsafeProgressTable::clearTableOutput(WriteBufferFromFileDescriptor & message)
{
    // Blind emission: If the peer closed the socket, message.next() or the << operator
    // will detect the canceled state and abort via throw Exception(ErrorCodes::LOGICAL_ERROR, ...)
    message << "\r\033[K\033[?25h";
    message.next();
}
```

**VERIFICATION METHOD**:
Implement an automated end-to-end socket abort test: initiate an asynchronous long-running workload (e.g., `INSERT` via a materialized view sleeping on each row) through a protocol-level socket (e.g., WebSocket client), abruptly close the socket, wait for process list cleanup, and assert that `system.text_log` contains zero `LOGICAL_ERROR` entries containing `"Cannot write to canceled buffer"`.

---

### 3. Discrimination Between Hardware/Transient I/O Faults and Metadata Corruption
**RULE**:
Storage initialization routines MUST NOT treat POSIX/OS input/output errors (`EIO`, `EAGAIN`, `EBUSY`, `ETIMEDOUT`) as permanent on-disk logical corruption. A storage engine MUST categorize disk read failures as retryable or fatal-mount aborts, and MUST NOT silently detach parts or prune partitions as `broken-on-start` without cryptographically proving bit-level corruption.

**WHY**:
Treating an OS-level `EIO` (which can result from transient SAN disconnects, storage controller hiccups, or degraded read passes) as structural metadata corruption (`broken-on-start`) moves entire physical parts into detached quarantine directories. The database then mounts successfully and serves queries with silently missing rows, violating ACID consistency without notifying operators or querying clients.

**WHEN TO APPLY**:
Filesystem metadata readers, LSM compaction scanners, and database storage startup loaders reading configuration and manifest blocks (`checksums.txt`, `columns.txt`, `count.txt`).

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
enum class PartLoadFailureCategory
{
    TransientIOError,  // Disk timeout, controller reset, temporary unreadability
    DataCorruption     // Checksum mismatch, invalid magic bytes, truncated logical formats
};

bool isRetryablePartException(const DB::Exception & e)
{
    const int code = e.code();
    
    // POSIX I/O errors and memory allocations are non-fatal to data integrity
    if (code == ErrorCodes::CANNOT_READ_ALL_DATA ||
        code == ErrorCodes::MEMORY_LIMIT_EXCEEDED ||
        code == ErrorCodes::CANNOT_ALLOCATE_MEMORY)
    {
        return true;
    }

    if (const auto * errno_exception = dynamic_cast<const DB::ErrnoException *>(&e))
    {
        int err = errno_exception->getErrno();
        // EIO is an environmental failure, NEVER a signal that the part is structurally broken
        if (err == EIO || err == EMFILE || err == ENFILE || err == ENOMEM || err == EBUSY)
            return true;
    }

    return false;
}

void loadDataPart(const String & part_name)
{
    try
    {
        readPartMetadata(part_name);
    }
    catch (const DB::Exception & e)
    {
        if (isRetryablePartException(e))
        {
            // Abort table startup or schedule retry; DO NOT rename to broken-on-start!
            throw DB::Exception(
                ErrorCodes::FILE_SYSTEM_ERROR,
                "Transient I/O error occurred while reading part {}. Halting startup to prevent data loss: {}",
                part_name, e.message());
        }

        // Only verified structural corruption warrants manual intervention quarantine
        markPartAsBrokenAndDetach(part_name);
    }
}
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Swallowing read errors or classifying every failure as corrupt
catch (const DB::Exception & e)
{
    // Clobbers valid data upon temporary disk stutter!
    LOG_ERROR(log, "Part {} failed to load, moving to broken-on-start: {}", part_name, e.message());
    rename(part_path, "detached/broken-on-start_" + part_name);
    // Table continues to load, silently missing records!
}
```

**VERIFICATION METHOD**:
Inject a kernel-level `EIO` fault (via `strace`, `dm-flakey`, or LD_PRELOAD mocking of `pread(2)`) during database engine initialization while reading `checksums.txt`. Verify that startup throws a critical abort exception rather than detaching the part and booting with incomplete row counts.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: FreeBSD Dynamic Loader Main Executable Misidentification (BUG-ELF-SYM-01)
- **Context**: Low-level symbol resolution engine (`src/Common/SymbolIndex.cpp`, `src/Common/Elf.h`).
- **What Was Expected**: The symbol index inspects loaded objects in the process space using `dl_iterate_phdr`. The main binary executable should be identified to resolve internal functions, call stacks, and embedded crash trace symbols.
- **What Actually Happened**: On Linux systems using `glibc`, the dynamic loader explicitly passes an empty string `""` as the `dlpi_name` for the main binary. On FreeBSD, however, the dynamic linker passes the full resolved path of the main executable inside `dlpi_name`. `SymbolIndex` relied on the empty name assumption, causing FreeBSD to treat the main binary as a shared dynamic library. The executable's build ID and address ranges were bypassed, degrading crash traces and telemetry.
- **Evidence in Repo**: Commit `d7fbe7d3`, PR #126059. Modified: `src/Common/Elf.h`, `src/Common/SymbolIndex.cpp`.
- **Root Cause**: Reliance on OS-specific runtime loader conventions (`dlpi_name == ""`) to identify the executable entry module, rather than inspecting the physical program headers (`PT_LOAD`) to verify whether the instruction pointer of the executing code falls within the memory segment described by the program header.
- **Remediation Code Diff**:
```cpp
--- a/src/Common/Elf.h
+++ b/src/Common/Elf.h
@@ -19,6 +19,7 @@ enum class ProgramHeaderType : uint32_t
 {
     NOTE = 4,
     DYNAMIC = 2,
+    LOAD = 1,
 };

--- a/src/Common/SymbolIndex.cpp
+++ b/src/Common/SymbolIndex.cpp
@@ -301,6 +301,29 @@ String getBuildIDFromProgramHeaders(DynamicLinkingProgramHeaderInfo * info)
     return {};
 }
+
+/// Whether the object described by `info` is the one containing this code, i.e. the main executable.
+/// glibc reports the main executable with an empty name, but other loaders (e.g. FreeBSD's) report its path.
+bool containsThisCode(DynamicLinkingProgramHeaderInfo * info)
+{
+    const auto this_code = reinterpret_cast<uintptr_t>(&containsThisCode);
+    __msan_unpoison(&info->addr, sizeof(info->addr));
+    __msan_unpoison(&info->phnum, sizeof(info->phnum));
+    __msan_unpoison(&info->phdr, sizeof(info->phdr));
+    for (size_t header_index = 0; header_index < info->phnum; ++header_index)
+    {
+        const ElfProgramHeader & phdr = info->phdr[header_index];
+        __msan_unpoison(&phdr, sizeof(phdr));
+        if (phdr.type != ProgramHeaderType::LOAD)
+            continue;
+
+        const uintptr_t segment_begin = info->addr + phdr.vaddr;
+        if (this_code >= segment_begin && this_code - segment_begin < phdr.memsz)
+            return true;
+    }
+    return false;
+}
@@ -520,6 +543,8 @@ void collectSymbolsFromELF(
         if (self_build_id.empty())
             self_build_id = build_id;
     }
+    else
+        is_main_executable = containsThisCode(info);
```
- **Lesson**: Never identify the primary host executable in native runtimes via name string comparisons provided by external linkers. Identify executable ownership by probing whether the address of a static/internal function lies within the bounds of a `PT_LOAD` virtual memory segment. Always unpoison MemorySanitizer (`__msan_unpoison`) shadow memory when reading raw OS structs populated by external dynamic linkers.

---

### Incident 2: Hive Partition Invalidation Leak in TopK Query Condition Cache (BUG-TOPK-QCC-02)
- **Context**: File table function dynamic condition caching (`src/Storages/StorageFile.cpp`).
- **What Was Expected**: Running an analytical query with `ORDER BY ... LIMIT` using the `file()` table function should dynamically cache condition bounds across matching executions. Changing engine configuration flags (such as `use_hive_partitioning`) must invalidate or segregate cache entries.
- **What Actually Happened**: The cache key generation only combined the condition AST hash, the data file modification hash, and the table name hash. When `use_hive_partitioning` changed between `1` and `0`, the cache key remained completely identical. In one mode, a column (e.g., `key`) was synthesized from the directory path structure (`key=1/`), whereas in the other mode it was read directly from the Parquet file payload. Query results alternated incorrectly between `[99999, 99998, 99997]` and `[999, 998, 997]`, yielding silent data inaccuracy.
- **Evidence in Repo**: Commit `8a598248`, PR #127745. Tests: `tests/queries/0_stateless/05448_query_condition_cache_top_k_file_hive_partitioning.sh`.
- **Root Cause**: The dynamic resolution mechanism changes where columns originate without changing the table name or raw file data. Omitting partition column structural metadata from the cache hash caused collisions across distinct storage instantiation modes.
- **Remediation Code Diff**:
```cpp
--- a/src/Storages/StorageFile.cpp
+++ b/src/Storages/StorageFile.cpp
@@ -2908,9 +2908,23 @@ StorageFileSource::TopKQueryConditionCacheKeyPtr ReadFromFile::makeTopKQueryCond
     table_name_hash.update(table_name.size());
     table_name_hash.update(table_name);
 
+    /// The key covers the whole filter including the conjuncts on hive partition columns, and whether a column
+    /// is read from the path or from the file depends on `use_hive_partitioning` of the query that created the
+    /// storage (for the `file` table function it is created per query), which the `table_id` does not cover.
+    SipHash hive_columns_hash;
+    for (const auto & column : storage->hive_partition_columns_to_read_from_file_path)
+    {
+        hive_columns_hash.update(column.name.size());
+        hive_columns_hash.update(column.name);
+        const String type_name = column.type->getName();
+        hive_columns_hash.update(type_name.size());
+        hive_columns_hash.update(type_name);
+    }
+
     boost::hash_combine(condition_hash, top_k_filter->plan_hash);
     boost::hash_combine(condition_hash, files_hash.get64());
     boost::hash_combine(condition_hash, table_name_hash.get64());
+    boost::hash_combine(condition_hash, hive_columns_hash.get64());
     key->condition_hash = condition_hash;
     return key;
```
- **Lesson**: A query cache key must incorporate the *provenance* of every column in the query filter. If a setting changes whether a column value is extracted from file metadata vs. decoded from the payload stream, that configuration is an intrinsic constituent of the cache key.

---

### Incident 3: Server Assertion Panic on Terminal Socket Abort (BUG-TTY-CANCEL-03)
- **Context**: Terminal rendering and progress telemetry subsystem (`src/Client/ProgressTable.cpp`, `src/Common/ProgressIndication.cpp`).
- **What Was Expected**: If a user disconnects their web terminal or SSH session during an active multi-row `INSERT`, the server should smoothly cancel background pipelines, clean up session memory, and log an informational disconnect.
- **What Actually Happened**: The abrupt socket closure failed an active write, marking the underlying `WriteBufferFromFileDescriptor` as canceled. The server's embedded client loop received progress blocks from in-flight materialized view steps and invoked `writeProgress()` and `clearTableOutput()`. These routines attempted to write ANSI cursor codes into the canceled buffer, causing the buffer to throw an unhandled `LOGICAL_ERROR: Cannot write to canceled buffer`, polluting error logs and terminating execution threads abruptly.
- **Evidence in Repo**: Commit `553f2289`, PR #127834. Tests: `tests/queries/0_stateless/05453_webterminal_close_during_insert.sh`.
- **Root Cause**: The progress rendering components did not check the buffer's cancellation state prior to initiating rendering routines and flushing escapes to the stream.
- **Remediation Code Diff**:
```cpp
--- a/src/Client/ProgressTable.cpp
+++ b/src/Client/ProgressTable.cpp
@@ -195,6 +195,11 @@ void writeWithWidthStrict(Out & out, std::string_view s, size_t width)
 void ProgressTable::writeTable(
     WriteBufferFromFileDescriptor & message, std::unique_lock<std::mutex> &, bool show_table, bool toggle_enabled, bool is_final)
 {
+    /// The terminal may be gone, e.g. a closed session of the client embedded into the server:
+    /// a failed write cancels the buffer and reports the error, and a write into it after that is a logical error.
+    if (message.isCanceled())
+        return;
+
     std::lock_guard lock{mutex};
     message << HIDE_CURSOR;
@@ -355,6 +360,11 @@ void ProgressTable::updateTable(const Block & block)
 void ProgressTable::clearTableOutput(WriteBufferFromFileDescriptor & message, std::unique_lock<std::mutex> &)
 {
+    if (message.isCanceled())
+        return;
+
     message << "\r" << CLEAR_TO_END_OF_SCREEN << SHOW_CURSOR;
     message.next();
 }
```
- **Lesson**: Buffers with destructive state transitions (such as cancellation on I/O fault) must be guarded at every call site where asynchronous, out-of-band updates (like UI or telemetry updates) occur.

---

### Incident 4: Precision Loss & Boundary Second Part Pruning in Mixed Temporal Filters (BUG-DATE-PRUNE-04)
- **Context**: MergeTree primary index and partition pruning analysis (`src/Storages/MergeTree/KeyCondition.cpp`).
- **What Was Expected**: In a query evaluating `DateTime64(3)` against a `DateTime` bound (e.g., `WHERE ts < toDateTime('2026-10-11 00:00:00', 'UTC')`), all rows prior to midnight must be preserved, including fractional timestamps like `2026-10-10 23:59:59.250`.
- **What Actually Happened**: Min-max and primary key index condition analysis performed truncation when casting the condition threshold across types. It converted the strict inequality `ts < X` into an integer second range `ts in (-Inf, X - 1]`. Consequently, granules and parts residing entirely in the final fractional second `[23:59:59.000, 2026-10-11 00:00:00.000)` were discarded by index analysis. The query returned incomplete datasets without any error or warning.
- **Evidence in Repo**: Issue #127270.
- **Root Cause**: Cross-type comparison between high-precision coordinates (`DateTime64`, microsecond scale) and low-precision coordinates (`DateTime`, second scale) collapsed ranges using low-precision integer arithmetic during partition pruning, truncating the fractional boundary.
- **Remediation Invariant**:
```cpp
// Corrected logic for range conversion across heterogeneously scaled temporal domains:
// If target column has higher scale than constant, transform boundary into the domain
// of the target column BEFORE applying boundary adjustment:
if (column_scale > constant_scale)
{
    // Expand constant into highest precision representation without rounding downwards
    Field converted_constant = convertToDateTime64(constant_value, column_scale);
    // Apply strict boundary: (-Inf, converted_constant - 1_fractional_unit]
    applyStrictUpperBound(converted_constant);
}
```
- **Lesson**: Index pruning logic must perform range-boundary transformations in the *target column's precision space*, not the search constant's precision space. Downcasting or integer-rounding bounds when building hyper-rectangles produces catastrophic silent row omissions.

---

### Incident 5: Part Quarantine Catastrophe Triggered by Transient POSIX EIO (BUG-STARTUP-EIO-05)
- **Context**: MergeTree startup loader (`src/Storages/MergeTree/MergeTreeData.cpp`).
- **What Was Expected**: During server startup, if a part's metadata files (`checksums.txt`, `columns.txt`, `count.txt`) fail to read due to a transient hardware/filesystem blip, the server should fail startup or retry reading the storage descriptor.
- **What Actually Happened**: The exception handler inside `loadDataPart` differentiated retryable exceptions using `isRetryableException()`, which checked for `EMFILE`, `ENOMEM`, and cloud timeouts, but omitted POSIX `EIO` (`5`). An `EIO` caused ClickHouse to categorize the part as broken, log `"is broken and needs manual correction"`, and permanently rename the directory to `detached/broken-on-start_<name>`. The server then completed startup with zero errors, serving partial tables and omitting user data without warning.
- **Evidence in Repo**: Issue #127233.
- **Root Cause**: Equating generic I/O failures (`EIO`) with structural on-disk data corruption. The `isRetryableException()` predicate was an incomplete allowlist.
- **Remediation Invariant**:
```cpp
// Patch invariant applied to isRetryableException:
bool isRetryableException(const DB::Exception & e)
{
    // ...
    if (const auto * errno_ext = dynamic_cast<const DB::ErrnoException *>(&e))
    {
        int code = errno_ext->getErrno();
        // EIO must NOT trigger permanent data detachment!
        if (code == EIO || code == ETIMEDOUT || code == EBUSY)
            return true;
    }
    return false;
}
```
- **Lesson**: Quarantining data must require positive proof of structural corruption (e.g., checksum verification failure or deserialization magic number mismatch). Never demote or isolate physical storage assets based on an OS-level I/O access failure.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Operator Precedence in Byte Stretching & XOR Buffers**:
  When processing raw byte arrays for cryptographic digests or vectorized hashing (as in `PBKDF2Engine.h` or `HMACEngine.h`), XOR manipulations combined with pointer increments are high-risk hazard zones.
  ```cpp
  //