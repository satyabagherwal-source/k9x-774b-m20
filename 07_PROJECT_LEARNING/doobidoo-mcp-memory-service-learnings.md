> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/doobidoo-mcp-memory-service-learnings.md`  
> **Source**: github ([https://github.com/doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service))  
> **Source Version**: `f01dd925`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-08T10:49:05.365Z  
> **Learning ID**: `learn-github-doobidoo-mcp-memory-service`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): doobidoo/mcp-memory-service

---

## 1. Executive Forensic Architecture & System Mechanics

`doobidoo/mcp-memory-service` is an open-source, dual-transport (REST API via FastAPI + Model Context Protocol via standard stdio/SSE) persistent semantic memory engine with an integrated causal knowledge graph and autonomous consolidation background service.

```
                     ┌────────────────────────────────────────────────────────┐
                     │            Clients & Transports                        │
                     │  - Claude Desktop / Claude Code Hooks (Node.js)        │
                     │  - REST API Clients (/api/v1/*, FastAPI / Uvicorn)      │
                     │  - MCP Protocol Stdio / SSE Transport                  │
                     └───────────────────────────┬────────────────────────────┘
                                                 │
                                                 ▼
                     ┌────────────────────────────────────────────────────────┐
                     │          MemoryService (Unified Façade)                │
                     │  - Ingestion & Splitting (content_hash = SHA-256)      │
                     │  - Ontology Layer (Built-in + Env + DB Overlay)        │
                     │  - Entity Extraction & Graph Linking                   │
                     └─────────────┬────────────────────────────┬─────────────┘
                                   │                            │
                                   ▼                            ▼
         ┌───────────────────────────────────┐    ┌───────────────────────────┐
         │     Storage Layer (sqlite_vec)    │    │ Autonomous Consolidation  │
         │  - Vector Indexes (ONNX Embeds)   │    │  - Scheduler (APScheduler)│
         │  - Relational & Metadata Tables   │    │  - Clustering (DBSCAN)    │
         │  - Knowledge Graph (Adjacency)    │    │  - Contradiction Detection│
         │  - Ontology Overlay Engine        │    │  - Delta-Sync Orchestrator│
         └───────────────────────────────────┘    └───────────────────────────┘
```

### Architectural Subsystems and Decoupling Invariants
1. **Model & Ingestion Pipeline (`src/mcp_memory_service/models/`, `api/operations.py`, `ingestion/`)**:
   - Content hashing uses SHA-256 as an immutable addressing key (`content_hash`).
   - The memory dataclass (`Memory`) models domain entities. Its post-initialization invariants decouple runtime ingestion coercion from row hydration to protect multi-node schema stability.
2. **Dynamic Ontology Layer (`src/mcp_memory_service/models/ontology.py`, `storage/ontology_overlay.py`)**:
   - Manages a 3-tier hierarchy: Built-in taxonomy $\rightarrow$ Environment configuration (`MCP_CUSTOM_MEMORY_TYPES`) $\rightarrow$ Database overlay (`ontology_entries` table via migration 022).
   - In-memory process cache invalidation is coordinated via monotonic atomic version bumping (`metadata.ontology_version`) polled at bounded intervals ($1.0\text{ s}$).
3. **Storage Engine (`src/mcp_memory_service/storage/`)**:
   - Backed by SQLite using the `sqlite-vec` extension for zero-cost, local embedded vector similarity.
   - Decomposed into mixins (`BaseMixin`, `RetrieveMixin`, `StoreMixin`, `GraphMixin`) to isolate transaction boundaries, connection locking, and index synchronizations.
4. **Knowledge Graph Subsystem (`GraphMixin`, `EntityLinker`)**:
   - Stores directed, typed relationships between memories (`causes`, `fixes`, `contradicts`, `shares_entity`) via adjacency tables.
   - Enforces conflict resolution isolation to prevent bidirectional entity-linking loops from overwriting semantic contradiction edges.
5. **Autonomous Consolidation & Synchronization (`consolidation/`, `storage/sync/`)**:
   - Background tasks manage DBSCAN clustering, duplicate eviction, conflict tagging, and peer delta-synchronization (`RemoteHTTPStorage`).
   - Uses cursor-based event logs and hybrid logical clocks (HLC) to guarantee eventual consistency across peer nodes.
6. **Claude Hook Subsystem (`claude-hooks/core/`)**:
   - External Node.js hook drivers intercept tool calls (`PermissionRequest`, `PostToolUse`, `SessionStart`, `SessionEnd`).
   - Applies deterministic pattern detection, AST regex boundaries, and fallback safety to ensure local agent interactions never block or throw unhandled exceptions.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Separation of Hydration vs. Ingestion Mutation
**RULE**:
Data transfer objects and domain entities that represent persisted database records MUST NOT perform destructive canonicalization, default value substitution, or coercive fallback logic inside their deserialization/constructor/`__post_init__` routines. Coercion of invalid, legacy, or foreign attributes MUST occur strictly at the ingress/write perimeter (e.g., API boundaries, document loaders, CLI parsers) via explicit transformation functions before the constructor is invoked.

**WHY**:
When a distributed or multi-tenant system reads records authored by a node running a newer schema or a custom extension (such as an extended ontology type or custom tag set), executing fallback coercion inside constructor/hydration paths (e.g., transforming unknown types to `observation`) silently mutates foreign data in memory. If that hydrated object is subsequently passed to an update, version bump, or merge workflow, the peer node permanently overwrites the legitimate custom type in storage with the fallback value, triggering silent data corruption.

**WHEN TO APPLY**:
Apply to any system implementing domain models, ORMs, serializable dataclasses, Pydantic schemas, or distributed database entities where multiple nodes, processes, or microservices access a shared persistence layer and may have differing local domain configurations.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# src/domain/models.py
from dataclasses import dataclass
from typing import Optional

@dataclass
class Record:
    content: str
    record_type: Optional[str]
    content_hash: str

    def __post_init__(self):
        # INVARIANT: Only canonicalize confirmed valid types (e.g. casing/whitespace).
        # NEVER assign a fallback default (e.g. "default_type") here. Hydrating an unknown
        # type MUST preserve the raw token so peer extensions survive read-write cycles.
        if self.record_type is not None and TaxonomyRegistry.is_known(self.record_type):
            self.record_type = TaxonomyRegistry.canonicalize(self.record_type)

# src/domain/pipeline.py
def coerce_record_type(raw_type: Optional[str]) -> Optional[str]:
    """Explicitly executed ONLY at write/ingress boundaries."""
    if raw_type is None:
        return None
    if TaxonomyRegistry.is_known(raw_type):
        return TaxonomyRegistry.canonicalize(raw_type)
    
    # Strip dangerous control chars before logging invalid user input
    sanitized = str(raw_type).replace('\r', '').replace('\n', '').replace('\x1b', '')
    logger.warning("Unknown record type '%s'. Defaulting to 'generic'.", sanitized)
    return "generic"

# Usage at API write boundary:
async def handle_create_record(user_payload: dict) -> Record:
    validated_type = coerce_record_type(user_payload.get("record_type"))
    record = Record(
        content=user_payload["content"],
        record_type=validated_type,
        content_hash=compute_hash(user_payload["content"])
    )
    return await storage.insert(record)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Mutating entities on read/hydration
@dataclass
class Record:
    content: str
    record_type: Optional[str]

    def __post_init__(self):
        # CATASTROPHIC BUG: Runs on storage.fetch() / row hydration!
        # Node without peer's plugin will silently coerce 'legal_contract' to 'generic',
        # and on subsequent row save will overwrite the peer's custom schema forever.
        if not TaxonomyRegistry.is_known(self.record_type):
            self.record_type = "generic"
```

**VERIFICATION METHOD**:
Enforce via an automated round-trip hydration test verifying that unknown types survive hydration intact:
```python
def test_unknown_type_hydration_preservation():
    # Simulate reading a database row written by a peer with a custom type
    raw_db_row = {"content": "clause 4.2", "record_type": "legal_contract", "content_hash": "a1b2"}
    entity = Record(**raw_db_row)
    assert entity.record_type == "legal_contract", (
        f"Hydration mutated custom type to {entity.record_type}!"
    )
```

---

### 2. Dual-Barrier Exception Class Logging for Empty Message Exceptions
**RULE**:
Structured loggers, diagnostic formatters, and telemetry capture blocks MUST explicitly extract and format `type(exc).__name__` (the exception class name) in addition to or preceding `str(exc)`. Under no circumstances may an error-handling block rely solely on `str(exc)` or `%s` interpolation of the exception instance. Furthermore, all logged variable data MUST pass through an injection-sanitizing barrier while preserving key redacting boundaries.

**WHY**:
Modern HTTP and transport client libraries (notably `httpx`, `urllib3`, `asyncio`, and native network transports) instantiate timeout and protocol errors with empty string messages (e.g., `str(httpx.ConnectTimeout('')) == ""`, `str(httpx.ReadTimeout('')) == ""`). When an exception block logs `logger.error("Request failed: %s", exc)`, the output renders as `Request failed: `—terminating at the delimiter. This leaves production logs completely devoid of the root cause (unable to discern TLS handshake failure, socket reset, timeout, or DNS resolution collapse).

**WHEN TO APPLY**:
Apply to all network transport boundaries, background daemon tasks, remote service adapters, database drivers, and thread/process supervisor loops.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# src/transport/network_client.py
import logging
import httpx

logger = logging.getLogger(__name__)

def _sanitize_log_value(val: object) -> str:
    """Removes newline/carriage return control characters to prevent log injection."""
    return str(val).replace('\r', '').replace('\n', '').replace('\x1b', '')

async def execute_remote_request(client: httpx.AsyncClient, url: str) -> httpx.Response:
    try:
        return await client.get(url)
    except Exception as exc:
        # INVARIANT: Format class name first, then string payload.
        # Guarantees diagnostic context even when str(exc) is empty.
        exc_class = _sanitize_log_value(type(exc).__name__)
        exc_msg = _sanitize_log_value(str(exc))
        
        if exc_msg:
            logger.error("HTTP request failed: %s: %s", exc_class, exc_msg)
        else:
            logger.error("HTTP request failed: %s (empty error message)", exc_class)
        raise
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Dropping exception metadata
try:
    await client.get(url)
except Exception as e:
    # If e is httpx.ReadTimeout(""), this prints: "Request failed: "
    logger.error("Request failed: %s", str(e))
    raise
```

**VERIFICATION METHOD**:
Execute caplog assertion tests with empty-payload exception fixtures:
```python
import httpx
import pytest

async def test_empty_exception_logging(caplog):
    with caplog.at_level(logging.ERROR):
        try:
            raise httpx.ReadTimeout("")
        except Exception as exc:
            logger.error("Call failed: %s: %s", type(exc).__name__, exc)
    
    assert any("Call failed: ReadTimeout" in record.message for record in caplog.records), (
        "Logger omitted the exception class name when str(exc) was empty."
    )
```

---

### 3. Multi-Process Monotonic Version Polling for In-Memory Schema Overlays
**RULE**:
When multiple OS processes share a common embedded database (such as SQLite) and rely on local process-memory caching of dynamic relational schemas or ontologies, cache validation MUST be governed by an atomic database-level monotonic counter (`version`). In-memory cache checks MUST be time-throttled via a monotonic clock differential check, and write transactions MUST atomically bump the persistence counter while validating conflicts against live storage rather than stale local memory state.

**WHY**:
In local agent architectures (such as an MCP stdio server running alongside a FastAPI REST service accessing the same SQLite database file), changes made by Process A are invisible to Process B's in-process caches. If Process B relies on its stale cache to validate new entities, it can overwrite newly added parent-child hierarchies or create duplicate entries. Conversely, querying the database on every microsecond read introduces disk/lock thrashing. Combining a monotonic atomic counter in SQLite with a rate-limited monotonic time check (`time.monotonic() - checked_at < 1.0s`) gives sub-second consistency across independent OS processes without performance degradation.

**WHEN TO APPLY**:
Embedded databases (SQLite/DuckDB), shared memory-mapped files, multi-process daemon topologies, and hybrid CLI/Service local applications.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# src/storage/schema_sync.py
import sqlite3
import time
from typing import Optional, List, Tuple

class DynamicSchemaEngine:
    def __init__(self, db_path: str, poll_interval_sec: float = 1.0):
        self.db_path = db_path
        self.poll_interval = poll_interval_sec
        self._cached_version: Optional[int] = None
        self._cached_records: List[Tuple[str, Optional[str]]] = []
        self._last_checked_monotonic = float("-inf")

    def _refresh_if_stale(self, conn: sqlite3.Connection) -> None:
        now = time.monotonic()
        if now - self._last_checked_monotonic < self.poll_interval:
            return
        self._last_checked_monotonic = now

        row = conn.execute("SELECT value FROM metadata WHERE key = 'schema_version'").fetchone()
        current_version = int(row[0]) if row else 0

        if current_version != self._cached_version:
            # Reload entries
            self._cached_records = conn.execute(
                "SELECT key, parent FROM dynamic_entries WHERE deleted_at IS NULL"
            ).fetchall()
            self._cached_version = current_version

    def insert_entry(self, conn: sqlite3.Connection, key: str, parent: Optional[str]) -> None:
        # Atomic transaction: insert entry and bump version counter
        with conn:
            cursor = conn.execute(
                """
                INSERT INTO dynamic_entries (key, parent, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    parent = excluded.parent,
                    updated_at = excluded.updated_at,
                    deleted_at = NULL
                WHERE dynamic_entries.deleted_at IS NOT NULL
                """,
                (key, parent, time.time())
            )
            if cursor.rowcount == 0:
                raise ValueError(f"Entry '{key}' already exists in live storage.")
            
            conn.execute(
                """
                INSERT INTO metadata (key, value) VALUES ('schema_version', '1')
                ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1
                """
            )
        # Invalidate immediate local reads
        self._last_checked_monotonic = float("-inf")
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Relying on in-process flag or local locks for multi-process coordination
class StaleSchemaEngine:
    _is_dirty = False  # Completely useless when Process A modifies SQLite and Process B reads it!

    def insert_entry(self, key):
        self.db.execute("INSERT INTO dynamic_entries VALUES (?)", (key,))
        self._is_dirty = True  # Process B never sees this variable!
```

**VERIFICATION METHOD**:
Simulate dual-process race scenarios via distinct SQLite connections in concurrent worker threads or subprocesses, asserting that updates from Connection A trigger automated cache refreshes in Connection B within the poll boundary:
```python
def test_interprocess_schema_version_polling(tmp_path):
    db_file = str(tmp_path / "shared.db")
    # Initialize DB schema and version
    # Conn A writes an entry
    # Conn B queries and confirms new entry is detected after poll duration
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Silent Memory Type Coercion on Read Hydration (BUG-ONT-01)
- **Context**: Hydration of stored rows via dataclass instantiation in `src/mcp_memory_service/models/memory.py` vs API ingress in `operations.py`.
- **What Was Expected**: Reading a previously stored memory row from SQLite on any node should preserve its exact `memory_type`, even if that specific node process does not have that custom memory type registered in its local `MCP_CUSTOM_MEMORY_TYPES`.
- **What Actually Happened**: `Memory.__post_init__()` validated `self.memory_type` against the local node's `MemoryTypeOntology.validate_memory_type()`. If unknown, it logged a warning and permanently overwritten `self.memory_type = "observation"`. When that memory was subsequently updated, consolidated, or versioned, the peer's custom type was permanently replaced with `observation` in the database.
- **Evidence in Repo**: Commit `61e8bbf2`, Issue `#1897`, PR `#1898`.
- **Root Cause**: Destructive normalization logic was coupled to domain model constructor (`__post_init__`), which fires indiscriminately during database row hydration and deserialization, confusing *ingress validation* with *persistence representation*.
- **Remediation Code Diff**:
```diff
--- a/src/mcp_memory_service/models/memory.py
+++ b/src/mcp_memory_service/models/memory.py
@@ -63,19 +63,7 @@ def __post_init__(self):
-        # Validate memory_type using ontology
-        if self.memory_type is not None:
-            if not MemoryTypeOntology.validate_memory_type(self.memory_type):
-                logger.warning(
-                    "Invalid memory_type '%s'. Valid types: %s... Defaulting to 'observation'.",
-                    _sanitize_log_value(self.memory_type),
-                    ', '.join(MemoryTypeOntology.get_all_types()[:5]),
-                )
-                self.memory_type = "observation"  # Default to base type
-            else:
-                self.memory_type = canonicalize_memory_type(self.memory_type)
+        # Canonicalize known types. Unknown types are kept as-is: this constructor
+        # also hydrates stored rows, and a node lacking a custom type must not
+        # mutate it to 'observation' and write it back on the next update.
+        if self.memory_type is not None and MemoryTypeOntology.validate_memory_type(self.memory_type):
+            self.memory_type = canonicalize_memory_type(self.memory_type)

--- a/src/mcp_memory_service/api/operations.py
+++ b/src/mcp_memory_service/api/operations.py
@@ -190,7 +191,7 @@ async def store(
         content=content,
         content_hash=content_hash,
         tags=tag_list,
-        memory_type=memory_type,
+        memory_type=coerce_memory_type(memory_type),
         metadata={}
     )
```
- **Lesson**: Construction and hydration logic MUST be idempotent and non-destructive. Destructive coercion belongs strictly at ingress adapters.

---

### Incident 2: In-Place Mutation of Taxonomy Lists Corrupting Static Schemas (BUG-ONT-02)
- **Context**: Taxonomy hierarchy expansion in `src/mcp_memory_service/models/ontology.py`.
- **What Was Expected**: Calling `_get_merged_taxonomy()` to merge custom subtypes from environment variables should create an isolated copy of the taxonomy; clearing caches should cleanly discard removed environment types.
- **What Actually Happened**: `_get_merged_taxonomy()` performed a shallow copy: `merged = dict(TAXONOMY)`. When custom subtypes were added, the code executed `merged[base].extend(custom_subtypes)`. Because `TAXONOMY[base]` contained mutable Python `list` references, `merged[base].extend()` mutated the underlying static lists inside the immutable `TAXONOMY` constant in place. As a result, when a user deleted a type from `MCP_CUSTOM_MEMORY_TYPES` and called `clear_ontology_caches()`, the removed custom type remained permanently baked into `TAXONOMY` in memory.
- **Evidence in Repo**: Commit `61e8bbf2`, Issue `#1897`.
- **Root Cause**: Shallow dictionary copy (`dict(TAXONOMY)`) failed to deep-copy nested mutable lists, leading to module-level static state mutation.
- **Remediation Code Diff**:
```diff
--- a/src/mcp_memory_service/models/ontology.py
+++ b/src/mcp_memory_service/models/ontology.py
@@ -346,8 +346,9 @@ def _get_merged_taxonomy() -> Dict[str, List[str]]:
     except ImportError:
         logger = logging.getLogger(__name__)
 
-    # Start with built-in taxonomy
-    merged = dict(TAXONOMY)
+    # Start with built-in taxonomy. Copy the subtype lists too: extending them in
+    # place below would otherwise write custom subtypes into TAXONOMY itself.
+    merged = {base: list(subtypes) for base, subtypes in TAXONOMY.items()}
 
     # Load and merge custom types
     custom_types = _load_custom_types_from_config()
```
- **Lesson**: Never perform in-place mutation (`.extend()`, `.append()`, `+=`) on data structures copied shallowly from static or module-level configuration dictionaries.

---

### Incident 3: Empty Reason Logging in Asynchronous Peer Sync Probes (BUG-SYNC-01)
- **Context**: HTTP peer client exception logging in `src/mcp_memory_service/storage/remote_http.py` and `consolidation/scheduler.py`.
- **What Was Expected**: Failed delta-sync background requests against peer memory hubs should output clear diagnostic explanations in server logs.
- **What Actually Happened**: Sync probes failed with log outputs such as:
  `HTTP request failed: GET /api/sync/capabilities - `
  `Delta-sync capability probe failed for peer hub: `
  Logs ended after the colon, omitting all diagnostic data and giving no indication whether the failure was a timeout, TLS verification issue, DNS resolution failure, or TCP RST.
- **Evidence in Repo**: Commit `f01dd925`, Issue `#1893`, PR `#1899`.
- **Root Cause**: The logging calls formatted only `_sanitize_log_value(str(e))`. In Python's `httpx` library, timeout classes (e.g., `httpx.ConnectTimeout`, `httpx.ReadTimeout`) instantiate with empty string representations when no message payload is passed.
- **Remediation Code Diff**:
```diff
--- a/src/mcp_memory_service/storage/remote_http.py
+++ b/src/mcp_memory_service/storage/remote_http.py
@@ -213,8 +213,9 @@ async def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
             sanitized_path = _sanitize_log_value(path)
             sanitized_error = _sanitize_log_value(str(e))
             logger.error(
-                "HTTP request failed: %s %s - %s", 
-                sanitized_method, sanitized_path, sanitized_error
+                "HTTP request failed: %s %s - %s: %s",
+                sanitized_method, sanitized_path,
+                _sanitize_log_value(type(e).__name__), sanitized_error
             )
             raise
```
- **Lesson**: Log lines formatting exceptions must interpolate `type(exc).__name__` prior to `str(exc)`.

---

### Incident 4: Entity Linking Overwriting Contradiction Edges in Knowledge Graph (BUG-GRAPH-01)
- **Context**: Knowledge graph edge association in `src/mcp_memory_service/storage/mixins/graph.py` and `EntityLinker`.
- **What Was Expected**: When memory B contradicts memory A, a `contradicts` relationship edge is recorded between `(A, B)`. Subsequent entity extraction linking memories by shared topics (`shares_entity`) should co-exist or respect the priority of the contradiction edge.
- **What Actually Happened**: With `MCP_ENTITY_LINKING_ENABLED=true`, storing memory B that contradicted A recorded the conflict and tagged both as `conflict:unresolved`. However, immediately following conflict detection, `_maybe_link_entities()` triggered `EntityLinker.link_by_entities()`. Because the database schema defined `PRIMARY KEY (source_hash, target_hash)` without `relationship_type` in the key, and wrote edges using `INSERT OR REPLACE`, the benign `shares_entity` edge replaced the `contradicts` edge. The contradiction disappeared from `memory_conflicts` queries while retaining orphan `conflict:unresolved` tags.
- **Evidence in Repo**: Issue `#1874`, Migration 008/009 schema conflict.
- **Root Cause**: Database adjacency table lacked composite edge typing in its primary key (`PRIMARY KEY (source_hash, target_hash)` instead of `(source_hash, target_hash, relationship_type)`), causing indiscriminate edge replacement by secondary linking passes.
- **Remediation Code Diff**:
```sql
-- Schema correction migration:
-- Old flawed schema:
-- CREATE TABLE memory_graph (source_hash TEXT, target_hash TEXT, relationship_type TEXT, PRIMARY KEY(source_hash, target_hash));

-- Fixed multi-edge relationship schema:
CREATE TABLE memory_graph_fixed (
    source_hash TEXT NOT NULL,
    target_hash TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    created_at REAL NOT NULL,
    weight REAL DEFAULT 1.0,
    PRIMARY KEY (source_hash, target_hash, relationship_type)
);
```
- **Lesson**: Knowledge graph edge tables must represent a multigraph; primary keys must incorporate the relationship type to prevent semantic link collisions.

---

### Incident 5: Stale Cache Re-Parenting Vulnerability During Concurrent Overlay Writes (BUG-ONT-03)
- **Context**: Overlay database persistence in `src/mcp_memory_service/storage/ontology_overlay.py`.
- **What Was Expected**: An attempt to write a memory type via `storage.add_memory_type("legal", parent="error")` when "legal" already existed as a base type created by another process should be rejected cleanly.
- **What Actually Happened**: Process A checked its local cached ontology, which was stale (unpolled). Because "legal" was not in its local cache, Process A proceeded to execute an upsert statement that modified the live row's parent from `NULL` to `"error"`, corrupting the ontology tree.
- **Evidence in Repo**: Commit `25357b99`, PR `#1903`, Greptile review finding.
- **Root Cause**: Time-of-check to time-of-use (TOCTOU) vulnerability where existence checks against stale in-process memory were not backed by conditional constraints in the SQL upsert execution.
- **Remediation Code Diff**:
```diff
--- a/src/mcp_memory_service/storage/ontology_overlay.py
+++ b/src/mcp_memory_service/storage/ontology_overlay.py
@@ -82,10 +82,17 @@ def upsert_memory_type(conn: sqlite3.Connection, name: str, parent: Optional[st
+    # Caller's duplicate check reads this process's cached ontology, which can
+    # be stale. The conflict update therefore ONLY revives a tombstoned row,
+    # and a live row with that name makes rowcount == 0, failing the write.
     with conn:
         cursor = conn.execute(
             "INSERT INTO ontology_entries (kind, key, parent, updated_at) "
             "VALUES ('memory_type', ?, ?, ?) "
             "ON CONFLICT(kind, key) DO UPDATE SET "
             "parent = excluded.parent, updated_at = excluded.updated_at, deleted_at = NULL "
-            "",
+            "WHERE ontology_entries.deleted_at IS NOT NULL",
             (name, parent, time.time()),
         )
+        if cursor.rowcount == 0:
+            raise ValueError(f"'{name}' is already a memory type")
         _bump_version(conn)
```
- **Lesson**: Concurrency integrity cannot rely on application-level cache checks; the underlying SQL statement must assert liveness constraints via `WHERE` clauses inside `ON CONFLICT` updates.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Log Injection Barrier Invariant**: Raw strings from external callers or network errors MUST NOT be passed directly to format strings without control character stripping. CodeQL alert 641 mitigation demands inline filtering:
  ```python
  # Mandatory inline barrier against CRLF / ANSI log escape injection
  safe_val = str(untrusted_input).replace('\r', '').replace('\n', '').replace('\x1b', '')
  ```
- **Falsy Zero Numeric Traps**: When parsing numeric thresholds from configurations (e.g., `minConfidence`, `cooldownPeriod`, `timeoutMs` in Node.js hooks), checking `if (!cfg.timeoutMs)` incorrectly overwrites `0` with the default. Explicit finite numeric bounds checking is required:
  ```javascript
  // CORRECT: Preserves 0 as a valid numeric configuration parameter
  const timeoutMs = Number.isFinite(cfg.timeoutMs) ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS;

  // HAZARD: Drops 0, false, or NaN into unintended defaults
  const timeoutMs = cfg.timeoutMs || DEFAULT_TIMEOUT_MS;
  ```
- **Deep Immutability vs Shallow Copies**: When cloning dictionary structures containing lists or sets, `dict.copy()` or `dict(X)` leaves inner mutable containers shared. Always use dictionary comprehensions with explicit inner copy:
  ```python
  # Safe deep isolation of static schemas
  isolated_taxonomy = {base: list(subtypes) for base, subtypes in TAXONOMY.items()}
  ```

### 2. Infinite Loop & Recursion Guards
- **Transcript Ingestion Deserialization Guard**: Claude Code JSONL transcripts can be appended concurrently while hooks execute. Splitting on `\r?\n` must tolerate incomplete trailing writes without throwing uncaught JSON parse exceptions:
  ```javascript
  // Strict non-throwing JSONL streaming processor
  for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
          const parsed = JSON.parse(trimmed);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items) {
              if (item && typeof item === 'object') transcript.push(item);
          }
      } catch {
          // Skip partial or malformed lines without crashing loop
      }
  }
  ```
- **Mis-paired Conversation Loop Termination**: Backward scans over conversation history to pair the user's prompt with the assistant's turn must anchor on index bounds:
  ```javascript
  // Bounded backward scan preventing Q2 + A1 race misalignment
  let assistantIndex = -1;
  for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].role === 'assistant') {
          assistantIndex = i;
          break;
      }
  }
  let lastUser = null;
  if (assistantIndex > 0) {
      for (let i = assistantIndex - 1; i >= 0; i--) {
          if (transcript[i].role === 'user' && !isToolResultOnly(transcript[i].content)) {
              lastUser = transcript[i];
              break;
          }
      }
  }
  ```

### 3. UI & UX Micro-Mechanics
- **CamelCase and Kebab-Case Token Splitting Invariant**: When checking user-invoked tool names for safety auto-approval (`isSafeTool`), tools using camelCase (e.g., `statusCheck`) can bypass delimiter-based regex checks. Tokenization must split camelCase before checking word boundaries:
  ```javascript
  function isSafeTool(toolName) {
      if (!toolName) return false;
      // 1. Insert underscores between lower and upper case transitions
      const withSeparators = toolName.replace(/([a-z])([A-Z])/g, '$1_$2');
      // 2. Normalize and split across all known delimiters
      const parts = withSeparators.toLowerCase().split(/[_-]/);
      // 3. Strict destructive rejection before safe match approval
      if (parts.some(p => destructivePatterns.includes(p))) return false;
      return parts.some(p => safePatterns.includes(p));
  }
  ```
- **Zero-Latency Fail-Safe CLI Interceptors**: CLI and hook scripts invoked via stdin pipes MUST enforce hard timeouts to prevent hanging parent agent processes indefinitely:
  ```javascript
  // Force resolution if stdin is not closed within 1000ms
  const timeout = setTimeout(() => resolve(data || '{}'), 1000);
  ```

### 4. Backend Concurrency & Memory Safety
- **Multi-Process Cache Coherence via Monotonic Clock Differentials**: To avoid querying SQLite on every read, use `time.monotonic()` to throttle database version checks to at most once per second:
  ```python
  def _refresh_overlay() -> None:
      global _OVERLAY_ENTRIES, _OVERLAY_VERSION, _OVERLAY_CHECKED_AT
      now = time.monotonic()
      if _OVERLAY_SOURCE is None or now - _OVERLAY_CHECKED_AT < _OVERLAY_POLL_SECONDS:
          return
      _OVERLAY_CHECKED_AT = now
      version = _OVERLAY_SOURCE.read_ontology_version()
      if version != _OVERLAY_VERSION:
          _OVERLAY_ENTRIES = list(_OVERLAY_SOURCE.read_memory_type_overlay())
          _OVERLAY_VERSION = version
          clear_ontology_caches()
  ```
- **Thread Pool In-Memory SQLite Isolation**: In-memory SQLite databases (`:memory:`) exist exclusively on the connection that opened them; worker threads opening new connections cannot see the data. For `:memory:`, the storage driver must capture snapshots directly from its primary connection before passing reads to auxiliary handlers.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Safe Evaluation of Python Dict Formats in JavaScript**: MCP tools communicating with Python backends often receive text-encoded Python dictionaries with `'None'`, `'True'`, and `'False'`. Parsing via regex transforms must handle these before `JSON.parse