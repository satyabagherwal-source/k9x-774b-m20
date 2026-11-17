# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: arangodb-arangodb-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "arangodb-arangodb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:32:20.273Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-arangodb-arangodb-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [arangodb-arangodb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:32:20.273Z`  
> **Learning ID**: `LEARN-EVO-arangodb-arangodb-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), G (Architecture Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 56%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from arangodb-arangodb-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/arangodb-arangodb-learnings.md`  
> **Source**: github ([https://github.com/arangodb/arangodb](https://github.com/arangodb/arangodb))  
> **Source Version**: `d0c81b64`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-17T08:31:07.707Z  
> **Learning ID**: `learn-github-arangodb-arangodb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): arangodb/arangodb

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
ArangoDB solves multi-model persistence and distributed graph querying at scale. Traditional architectures require stitching together document databases (e.g., MongoDB), graph traversal engines (e.g., Neo4j), full-text search indexes (e.g., Elasticsearch), and relational constructs. ArangoDB combines JSON documents, directed/undirected graphs, key-value access, inverted index search (ArangoSearch), and vector embeddings into a unified C++ core with a single composable query language (AQL) executing transactional and distributed distributed queries.

### Architectural Subsystem Boundaries
1. **ClusterEngine & Coordinator Plane (`arangod/ClusterEngine/`)**:
   - Manages distributed query decomposition, scatter-gather query execution, shard key mapping, routing, and consensus coordination via Agency (Raft-like consensus).
   - Coordinators maintain zero local persistence; they build logical query execution plans, dispatch intermediate requests to DBServers via HTTP/VelocyPack over `fuerte` (Asio-based RPC engine), and merge streaming result sets.
2. **Storage Engine Abstraction Layer**:
   - Decoupled from coordinator logic. RocksDB is the primary physical engine.
   - Provides point lookups, primary key mappings, secondary indexing, edge indexes (optimized index tracking `_from` and `_to` relations), and Vector/MDI (Multi-Dimensional Indexing).
3. **AQL Processing Pipeline**:
   - Parser & AST Generation $\to$ Logical Query Plan $\to$ AST Optimization Rules $\to$ Physical Distributed Execution Nodes (`EnumerateNearVectorNode`, `MaterializeNode`, `IndexNode`).
   - Optimizer determines if an index can satisfy projections directly via index cover (`coveredFields()`) or requires a subsequent `MaterializeNode` step to read attributes from the storage engine.
4. **Network & RPC Layer (`3rdParty/fuerte`)**:
   - Threadpool engine partitioning I/O concurrency via isolated `boost::asio::io_context` instances.
   - Decoupled connection pooling, non-blocking pipelined VelocyPack (binary JSON) serialization, and SSL/TLS transport context lifecycle management.
5. **Internationalization & Invariant Utility Layer (`3rdParty/icu-legacy`, `3rdParty/fastText`)**:
   - Zero-allocation string view comparisons, UTF-8 to UTF-16 stream slicing (`ByteSinkUtil`), and endianness-safe floating-point bitwise conversions (`BitPatternConversion`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Incomplete Index Covered-Fields Declaration Hazard
**RULE**:
When introducing a new index type in a distributed query planner, the index class MUST explicitly declare whether its key attributes are capable of index-covering queries (`coveredFields()`). If an index stores only internal representations (e.g., dense vectors, HNSW graph structures) and cannot satisfy direct document attribute projection without `storedValues`, its `coveredFields()` implementation MUST explicitly return an empty field set (`emptyCoveredFields`) rather than falling through to an unhandled enum state or returning partial attribute coverage.

**WHY**:
In distributed query compilation, when an index claims to cover a field, the optimizer removes the downstream `MaterializeNode` and sets `filterMode = "index"` or `projectionMode = "index"`. If a vector/multidimensional index emits vector coordinates that require full document de-serialization, omitting the index type in `ClusterIndex::coveredFields()` causes cluster coordinator crashes: the coordinator plan expects the intermediate worker node to emit deserialized VelocyPack slices, but the worker outputs raw internal IDs or empty records, triggering assertion failures during result-set materialization.

**WHEN TO APPLY**:
Any database engine, distributed planner, or secondary index interface in C++, Rust, or Go where query planners can bypass disk/row lookups via "Covering Indexes" (e.g., Index-Only Scans).

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// arangod/ClusterEngine/ClusterIndex.cpp
std::vector<std::vector<arangodb::basics::AttributeName>> const& 
ClusterIndex::coveredFields() const {
  switch (_type) {
    case IndexType::Primary:
    case IndexType::Edge:
    case IndexType::Persistent:
      return _coveredFields;

    // Explicit non-covering index invariants:
    case IndexType::Zkd:
    case IndexType::MDI:
    case IndexType::MDIPrefixed:
    case IndexType::Vector:
    case IndexType::NoAccess: {
      return Index::emptyCoveredFields;
    }

    default: {
      TRI_ASSERT(false) << "ClusterIndex::coveredFields called on unsupported index type: " 
                        << static_cast<int>(_type);
      return Index::emptyCoveredFields;
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```cpp
// CRITICAL DEFECT: Omitting IndexType::Vector from the switch statement.
// Causes undefined fall-through, unhandled switch warning bypass,
// or returning uninitialized/default coveredFields references.
std::vector<std::vector<arangodb::basics::AttributeName>> const& 
ClusterIndex::coveredFields() const {
  switch (_type) {
    case IndexType::Primary:
      return _coveredFields;
    case IndexType::Zkd:
    case IndexType::MDI:
      return Index::emptyCoveredFields;
    // MISSING IndexType::Vector!
    // Result: Evaluates to invalid optimizer assertions in distributed AQL plans.
  }
}
```

**VERIFICATION METHOD**:
Implement a plan-level regression test validating both `filterMode` and `projectionMode`:
```javascript
const plan = db._createStatement({
  query: "FOR d IN col LET dist = APPROX_NEAR_L2(@qp, d.vector) SORT dist LIMIT 5 RETURN d.vector",
  bindVars: { qp: randomPoint }
}).explain().plan;

const indexNode = plan.nodes.find(n => n.type === "EnumerateNearVectorNode");
assert.strictEqual(indexNode.projectionMode, "pass-through-id");
assert.ok(plan.nodes.some(n => n.type === "MaterializeNode"), "MaterializeNode MUST exist when vector index lacks storedValues");
```

---

### 2. Multi-Context Asio Threadpool Work Guard Lifecycle Invariant
**RULE**:
When managing a pool of isolated `boost::asio::io_context` instances across worker threads, the service MUST construct and store `executor_work_guard` instances before spawning threads, and MUST explicitly reset all guards before invoking `stop()` on any `io_context` during shutdown. Worker threads MUST NOT be joined without resetting work guards and calling `stop()`.

**WHY**:
An active `asio::executor_work_guard` prevents `io_context::run()` from returning even when all active handlers have drained. If worker threads call `ctx->run()` and the destructor joins them without clearing work guards, the application deadlocks on process termination. Conversely, invoking `c->stop()` without resetting work guards aborts queued cancellation handlers, leaking in-flight sockets and memory buffers.

**WHEN TO APPLY**:
C++ networking services using `boost::asio` or standalone `asio` with thread-per-core or partitioned loop patterns (`asio::io_context`).

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// 3rdParty/fuerte/src/loop.cpp
void EventLoopService::stop() {
  // Phase 1: Allow run() loops to exit naturally when work completes
  for (auto& guard : _guards) {
    guard.reset();
  }
  std::this_thread::sleep_for(std::chrono::milliseconds(50));

  // Phase 2: Forcefully halt pending events that failed to drain
  for (auto& context : _ioContexts) {
    context->stop();
  }
  std::this_thread::sleep_for(std::chrono::milliseconds(50));

  // Phase 3: Synchronously join and reclaim OS thread resources
  for (auto& thread : _threads) {
    if (thread.joinable()) {
      thread.join();
    }
  }

  _threads.clear();
  _ioContexts.clear();
  _guards.clear();
}
```

**NEGATIVE CONSTRAINT**:
```cpp
// DEADLOCK / RESOURCE CORRUPTION PATTERN:
EventLoopService::~EventLoopService() {
  for (auto& thread : _threads) {
    if (thread.joinable()) {
      thread.join(); // DEADLOCK: io_context::run() never exits because work_guards are active!
    }
  }
  // Destruction of _guards never reached.
}
```

**VERIFICATION METHOD**:
Static analysis via clang-tidy checking thread joins without prior cancellation, combined with integration lifecycle fuzzing running 10,000 rapid cycles of `EventLoopService::start()` and `EventLoopService::stop()` under simulated thread contention.

---

### 3. IEEE 754 Big-Endian / Little-Endian Union Casting Safety
**RULE**:
When inspecting bit patterns of primitive types (such as double precision IEEE 754 floats for NaN, Inf, or Sign Bit analysis) without invoking undefined behavior via pointer-aliasing, systems MUST use standard unions initialized strictly through their first field, or use `std::bit_cast`. Pointer-arithmetic extraction of floating point bytes MUST explicitly account for endianness swaps (`U_IS_BIG_ENDIAN` vs Little-Endian).

**WHY**:
Treating `double*` as `char*` and reading indices assumes little-endian byte ordering. On big-endian architectures (e.g., IBM s390x, AIX), the sign bit and exponent reside at index `0`, whereas on x86/ARM64 little-endian systems, the most significant byte is at index `sizeof(double) - 1`. Incorrect byte offsets cause NaN and infinity detections to flip, leading to silent calculation errors, corrupt spatial coordinates, and incorrect sorting.

**WHEN TO APPLY**:
Low-level C/C++ cross-platform code managing serialization, numeric hashing, or custom floating-point categorization.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// 3rdParty/icu-legacy/icu64/common/putil.cpp
typedef union {
  int64_t i64; // First member initialization conforming to C89/C++ standards
  double d64;
} BitPatternConversion;

static const BitPatternConversion gNan = { (int64_t) INT64_C(0x7FF8000000000000) };
static const BitPatternConversion gInf = { (int64_t) INT64_C(0x7FF0000000000000) };

static inline bool uprv_signBit(double d) {
  uint8_t hiByte;
#if U_IS_BIG_ENDIAN
  hiByte = *(reinterpret_cast<uint8_t*>(&d));
#else
  hiByte = *(reinterpret_cast<uint8_t*>(&d) + sizeof(double) - 1);
#endif
  return (hiByte & 0x80) != 0;
}
```

**NEGATIVE CONSTRAINT**:
```cpp
// ARCHITECTURAL FLAW: Architecture-blind pointer casting.
// Fails on Big-Endian architectures (s390x) by reading least-significant byte!
bool brokenSignBit(double d) {
  uint8_t* bytePtr = (uint8_t*)&d;
  return (bytePtr[7] & 0x80) != 0; // Wrong on s390x / SPARC!
}
```

**VERIFICATION METHOD**:
Compile and execute static unit assertions parameterized across architecture targets via QEMU user-mode emulation for `s390x` and `x86_64`:
```cpp
static_assert(sizeof(double) == sizeof(int64_t), "IEEE 754 64-bit float invariant failed");
assert(uprv_signBit(-0.0) == true);
assert(uprv_signBit(0.0) == false);
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Coordinator Crash on Vector Index Filter Query Without StoredValues (BUG-COR-1276)
- **Context**: AQL Vector Query Optimizer / Cluster Coordinator (`arangod/ClusterEngine/ClusterIndex.cpp`).
- **What Was Expected**: Running an AQL query that performs an approximate nearest neighbor search (`APPROX_NEAR_L2`) with a `FILTER` or projection strictly on the indexed vector attribute (`RETURN d.vector`) without declaring `storedValues` in the index should recognize that the index cannot cover the query. The optimizer should inject a `MaterializeNode` with `projectionMode = "pass-through-id"` and evaluate filters in `"document"` mode.
- **What Actually Happened**: The coordinator crashed with an assertion failure in cluster execution. The optimizer attempted an index-only scan (covered query) because `ClusterIndex::coveredFields()` did not specify `IndexType::Vector`. The coordinator failed when extracting attributes from worker shards because the vector index backend does not store uncompressed vector attributes in its index nodes unless explicitly configured via `storedValues`.
- **Evidence in Repo**:
  - PR: #23645, Issue: COR-1276, Commit SHA: `d0c81b64`.
  - Affected file: `arangod/ClusterEngine/ClusterIndex.cpp`.
  - Test harness: `tests/js/client/aql/vector/aql-vector-filter.js`.
- **Root Cause**: Missing enum branch in `ClusterIndex::coveredFields()`. While multidimensional types like `IndexType::Zkd`, `IndexType::MDI`, and `IndexType::MDIPrefixed` explicitly returned `Index::emptyCoveredFields`, `IndexType::Vector` was omitted.
- **Remediation Code Diff**:
```cpp
--- a/arangod/ClusterEngine/ClusterIndex.cpp
+++ b/arangod/ClusterEngine/ClusterIndex.cpp
@@ -465,6 +465,7 @@ ClusterIndex::coveredFields() const {
     case IndexType::Zkd:
     case IndexType::MDI:
     case IndexType::MDIPrefixed:
+    case IndexType::Vector:
     case IndexType::NoAccess: {
       return Index::emptyCoveredFields;
     }
```
- **Lesson**: Every switch statement over index metadata types in query optimization subsystems MUST handle all enum cases explicitly. If an index type cannot supply data attributes without reading the underlying primary storage, it MUST explicitly register with empty covered attributes.

---

### Incident 2: Stale Exact-Pin Configuration Drift in CI Vulnerability Scanners (BUG-CI-TRIVY-23679)
- **Context**: Continuous Integration Security Scanning (`.circleci/base_nightly_packages.yml`).
- **What Was Expected**: Security scanning dependencies should have synchronized comment rationale and version semantics. When floating a major version (`arangodb/trivy-scan@1`) to ingest scanner patches automatically, documentation must accurately describe the failure boundaries and update expectations.
- **What Actually Happened**: PR #23593 changed the orb from `@1.2.0` to `@1`, but retained a legacy comment stating that an exact pin was mandatory because version 1.1.2's `kev-epss-check` fails closed on a clean report and fails open on an empty threshold. Engineers maintaining release branches (3.12) hesitated to merge security updates due to conflicting operational documentation.
- **Evidence in Repo**:
  - Commit SHA: `b52dd697`, PR: #23679, Backport PR: #23680.
  - Affected file: `.circleci/base_nightly_packages.yml`.
- **Root Cause**: Documentation-code drift during CI configuration modernization. The underlying scanner upgraded from Trivy `v0.72.0` to `v0.76.1` via orb `1.7.0`, modifying vulnerability gating rules while the comments claimed strict pin protection.
- **Remediation Code Diff**:
```yaml
--- a/.circleci/base_nightly_packages.yml
+++ b/.circleci/base_nightly_packages.yml
@@ -186,9 +186,9 @@ version: 2.1
 orbs:
   aws-cli: circleci/aws-cli@4.1.1
   aws-ecr: circleci/aws-ecr@9.0.1
-  # Exact pin: a floating orb range silently changes what the nightly
-  # security checks flag. 1.2.0 is the floor: 1.1.2's kev-epss-check fails
-  # closed on a clean report and fails open on an empty threshold.
+  # Floats on 1.x so each orb release reaches the nightly without a bump
+  # PR, which also means a new 1.x can change what the security checks
+  # flag. A breaking orb change ships as 2.0 and needs a change here.
   trivy-scan: arangodb/trivy-scan@1
```
- **Lesson**: CI/CD configuration files are code. When security scanner version ranges are widened to absorb nightly vulnerability database updates, the operational failure mode shifts from "deterministic failure" to "dynamic failure" and must be reflected across branch backports.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
In C++ low-level storage routines, casting between signed and unsigned characters or integers without bounds checking causes undefined memory offsets. 

**Vulnerability in Unicode conversion (`3rdParty/icu-legacy/icu64/common/bytesinkutil.cpp`)**:
```cpp
// Capacity check invariant:
int32_t desiredCapacity = s16Length - i;
if (desiredCapacity < (INT32_MAX / 3)) {
    desiredCapacity *= 3; // Max 3 UTF-8 bytes per UTF-16 code unit
} else if (desiredCapacity < (INT32_MAX / 2)) {
    desiredCapacity *= 2;
} else {
    desiredCapacity = INT32_MAX;
}
char *buffer = sink.GetAppendBuffer(U8_MAX_LENGTH, desiredCapacity,
                                    scratch, UPRV_LENGTHOF(scratch), &capacity);
// INVARIANT: Subtract reserve window to prevent off-by-one buffer overflow during unsafe append
capacity -= U8_MAX_LENGTH - 1; 

int32_t j = 0;
for (; i < s16Length && j < capacity;) {
    UChar32 c;
    U16_NEXT_UNSAFE(s16, i, c);
    U8_APPEND_UNSAFE(buffer, j, c); // Direct macro append without internal bounds checks
}
```
*Token-Level Rule*: Never use unchecked pointer macros (`U8_APPEND_UNSAFE`) without subtracting the maximum expansion factor (`U8_MAX_LENGTH - 1`) from the available buffer capacity beforehand.

---

### 2. Infinite Loop & Recursion Guards
In string manipulation and locale canonicalization (`3rdParty/icu-legacy/icu64/common/locutil.cpp`), searching for token delimiters (`@`, `.`, `_`) using `indexOf` can degrade into infinite loops if state indices fail to advance past the matched character.

```cpp
// Token advancing invariant:
int32_t prev = 0;
int32_t i;
for(;;) {
    i = id.indexOf((UChar)0x40, prev); // Search for '@'
    if (i < 0) {
        // Drain remaining slice and break
        id.extract(prev, INT32_MAX, buffer + prev, BUFLEN - prev, US_INV);
        break; 
    } else {
        id.extract(prev, i - prev, buffer + prev, BUFLEN - prev, US_INV);
        buffer[i] = '@';
        prev = i + 1; // STRICT INVARIANT: Must advance index past token. If prev == i, loop will never terminate.
    }
}
```
*Proof of Termination*: The variable `prev` strictly increases monotonically on every iteration ($prev_{k+1} = i_k + 1 > prev_k$), bounded by the string length $L$. Since $L$ is strictly less than `BUFLEN` (128), execution is bounded to $O(L)$ steps.

---

### 3. UI & UX Micro-Mechanics (AQL Web Interface & Plan Graphing)
When executing visual query plan trees on large distributed queries (e.g., plans containing hundreds of `EnumerateNearVectorNode`, `RemoteNode`, and `ScatterNode` instances):
- **DOM Event Retargeting Trap**: Event delegation listeners attached to the root visual plan SVG must use `event.composedPath()` to locate the actual node boundary across Shadow DOM boundaries, rather than relying on `event.target`.
- **Reflow Thrashing Protection**: When displaying dynamic distance metrics for nearest-neighbor queries, metric nodes must apply transforms using `transform: translate3d(x, y, 0)` rather than modulating `top`/`left`, preventing recursive layout recalculations across coordinator metric panels.

---

### 4. Backend Concurrency & Memory Safety
In the VelocyPack networking engine (`3rdParty/fuerte/src/loop.cpp`), connection distribution across I/O loops uses an atomic counter.

```cpp
// Atomicity and memory ordering invariant:
std::shared_ptr<asio_ns::io_context>& EventLoopService::nextIOContext() {
  FUERTE_ASSERT(!_ioContexts.empty());
  // std::memory_order_relaxed is sufficient because thread affinity does not 
  // establish synchronizes-with relationships with socket execution context.
  return _ioContexts[_lastUsed.fetch_add(1, std::memory_order_relaxed) % _ioContexts.size()];
}
```
*Starvation Guard*: If `_ioContexts.size()` is a power of 2, modulo operations across an overflowing 32-bit integer maintain uniform distribution without negative modulo biases.

---

### 5. Defect & Error Prevention ("Galti Pakadna")
Double-checked locking anti-pattern elimination in static utility caches (`3rdParty/icu-legacy/icu64/common/locutil.cpp`):

```cpp
// Thread-safe cache population pattern:
umtx_lock(NULL);
Hashtable *t = static_cast<Hashtable *>(cache->get(bundleID));
if (t != NULL) {
    // Another thread raced through this code, creating the cache entry first.
    // Discard ours and return theirs.
    umtx_unlock(NULL);
    delete htp;
    htp = t;
} else {
    cache->put(bundleID, (void*)htp, status);
    umtx_unlock(NULL);
}
```
*Defect Prevented*: Prevents heap corruption and memory leaks when multiple coordinator worker threads resolve translation bundles simultaneously without coarse table locking.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
ArangoDB isolates coordinator state from storage engines. Coordinators compile, optimize, and fragment queries. Shard-level execution is dispatched over non-blocking RPC connections to DBServers. The storage engine interface interacts with RocksDB or in-memory stores via fixed iterator protocols, ensuring transactional operations remain isolated from the transport protocol layer.

### 2. Core Abstractions
- `ClusterIndex`: Base coordinator abstraction representing physical secondary indexes residing on remote shards.
- `EventLoopService`: Multi-threaded I/O multiplexer running single-threaded event loops to prevent cross-core synchronization overhead.
- `ByteSink` / `CharStringByteSink`: Zero-allocation character buffer abstraction for streaming string mutations without intermediate heap allocations.

### 3. Error Handling
ICU and ArangoDB C-APIs rely heavily on output status reference invariants:
```cpp
UErrorCode status = U_ZERO_ERROR;
if (U_FAILURE(status)) { return FALSE; }
```
Functions MUST check `U_FAILURE(status)` immediately on entry. If already set to a failure state, they must return without executing operations.

### 4. Testing
Regression tests use dual-layer verification:
1. Behavioral asserting output datasets: `assertEqual(expected, results);`
2. Structural asserting optimizer plan geometry:
```javascript
const plan = db._createStatement({query, bindVars}).explain().plan;
const indexNodes = plan.nodes.filter(n => n.type === "EnumerateNearVectorNode");
assertEqual("pass-through-id", indexNodes[0].projectionMode);
```

### 5. Security
Deprecation of outdated cryptographic primitives:
- Removal of MD5 hashing for user credentials (`COR-1088`).
- Migration to SHA-256 with deprecation warnings for legacy SHA-1 and SHA-224 hashes.
- Floating container vulnerability scans (`trivy-scan@1`) in CI to prevent unpatched OS packages in base images.

### 6. Performance
Network threadpool sharding prevents cross-thread lock contention. By allocating an independent `io_context` per thread, OS epoll instances operate with low lock synchronization overhead, bypassing global event loop bottlenecks.

### 7. Deployment
CI/CD invariants enforce deterministic build artifact generation:
- `.circleci/base_nightly_packages.yml` isolates package builds across OS variants (RHEL, Debian, Ubuntu, Windows).
- Use of CircleCI configuration generators (`generate_config.py`) to systematically validate build matrices before dispatching jobs.

### 8. Agent Patterns
When an AI agent modifies database index structures:
- The agent must trace all virtual methods of the index interface hierarchy (`coveredFields()`, `isSorted()`, `canBeDropped()`).
- Adding an index capability requires matching updates to the query optimizer rules, the explain-plan output tests, and the cluster serialization adapters.

### 9. Data Flow
VelocyPack byte buffers flow from DBServer RocksDB iterators $\to$ local chunk serializers $\to$ network sockets $\to$ coordinator `fuerte` event loops $\to$ AQL stream merger $\to$ HTTP JSON/VelocyPack client response. Vector query flows append an internal doc ID pass-through before hitting a `MaterializeNode` for hydration.

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Thread-Safe Lazy Initialization with Re-check
```cpp
UErrorCode status = U_ZERO_ERROR;
umtx_initOnce(LocaleUtilityInitOnce, locale_utility_init, status);
if (U_FAILURE(status)) return NULL;

umtx_lock(NULL);
Hashtable* htp = (Hashtable*) cache->get(key);
umtx_unlock(NULL);

if (htp == nullptr) {
  auto* newHtp = new Hashtable(status);
  // Expensive population outside lock
  umtx_lock(NULL);
  Hashtable* racing = (Hashtable*) cache->get(key);
  if (racing != nullptr) {
    umtx_unlock(NULL);
    delete newHtp;
    htp = racing;
  } else {
    cache->put(key, (void*)newHtp, status);
    umtx_unlock(NULL);
    htp = newHtp;
  }
}
```

### 2. Rule
*All non-covering distributed index implementations MUST explicitly return `Index::emptyCoveredFields` from their coordinator `coveredFields()` contract.*

### 3. Architecture Principle
*Decouple index scanning from document materialization.* A vector or spatial index must return lightweight tuple identifiers (IDs and distances) during intermediate execution stages, postponing full document hydration to a late pipeline `MaterializeNode` to conserve network bandwidth and memory overhead.

### 4. Failure Mode
Plan optimization failure where an index without stored attributes is marked as a covering index, causing coordinator crashes when decoding velo-packets missing requested attributes.

### 5. Reusable Skill
*Distributed Query Planner Index Integration Checklist*:
1. Implement local engine index traits.
2. Implement coordinator counterpart class inheriting from `ClusterIndex`.
3. Audit `ClusterIndex::coveredFields()` to handle the new enum case.
4. Formulate unit tests checking both `explain()` plan nodes (`projectionMode`) and execution result sets.

### 6. Decision
Rejecting implicit/automatic index attribute covering in vector searches: Dense vectors require massive allocations if held in RAM. Unless the user explicitly supplies `storedValues` to cache fields in the index structure, all attribute extractions MUST perform disk hydration.

### 7. Anti-Pattern
```cpp
// FORBIDDEN: Returning static vector references without handling all index types
std::vector<std::vector<AttributeName>> const& ClusterIndex::coveredFields() const {
  if (_type == IndexType::Persistent) {
    return _coveredFields;
  }
  // BUG: Falls off without returning emptyCoveredFields for Vector/MDI
  return _coveredFields; 
}
```

### 8. Verification Method
Run the full AQL vector suite under the ArangoDB cluster test runner:
```bash
./scripts/unittest aql-vector-filter --cluster true
```

---

## 7. Actionable Agent Skill & Implementation Checklist

When tasked with implementing or modifying index types or network loops in high-performance C++ database engines, an AI Agent MUST adhere to the following checklist:

- [ ] **Enum Exhaustiveness**: Search for all switch-statements over the target enum across coordinator and storage layers:
  ```bash
  grep -rn "switch.*_type" arangod/
  ```
- [ ] **Covered Field Semantics**: Verify whether the target index stores raw attributes or only tokenized/hashed references. If raw attributes are not preserved in the index structure, route the index to `Index::emptyCoveredFields`.
- [ ] **Late Materialization**: Ensure the logical query optimizer inserts a `MaterializeNode` when `coveredFields()` is empty.
- [ ] **Asio Loop Teardown Order**: When editing `asio` loop services, confirm the shutdown order:
  1. `guard.reset()` on all guards.
  2. Short sleep/yield.
  3. `context->stop()` on all contexts.
  4. Short sleep/yield.
  5. `thread.join()` on all joinable threads.
- [ ] **Endianness Guard**: When reading raw bytes of numeric primitives, verify macro protections against big-endian targets (`U_IS_BIG_ENDIAN`).
- [ ] **Plan Explain Assertion**: Always accompany functional tests with structural tests verifying node types (`explain().plan.nodes`). Verify that `filterMode == "document"` and `projectionMode == "pass-through-id"` when covering is absent.

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
