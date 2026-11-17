# Agent Contract: Agent Contract: pixeltable-pixeltable-learnings Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "pixeltable-pixeltable-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T03:18:01.049Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pixeltable-pixeltable-learnings",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pixeltable-pixeltable-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T03:18:01.049Z`  
> **Learning ID**: `LEARN-EVO-pixeltable-pixeltable-learnings`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `pixeltable-pixeltable-learnings-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pixeltable-pixeltable-learnings.md`  
> **Source**: github ([https://github.com/pixeltable/pixeltable](https://github.com/pixeltable/pixeltable))  
> **Source Version**: `9c30a9a6`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-17T03:16:58.358Z  
> **Learning ID**: `learn-github-pixeltable-pixeltable`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): pixeltable/pixeltable

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
Modern AI applications ingest multimodal unstructured data (video, audio, high-resolution imagery, PDF documents) and attempt to synchronize this data across disparate external infrastructure: S3/object stores, relational metadata stores (PostgreSQL), embedding/vector stores (pgvector, Pinecone), caching layers, orchestration queues (Celery, temporal workflows), and external inference APIs (OpenAI, Anthropic, Bedrock, Replicate). This fragmentation creates severe data synchronization drift, distributed failure modes, untracked schema lineage, and unbounded compute expenditure from re-computing heavy media transformations.

`pixeltable` collapses this distributed stack into a single unified Python-native multimodal relational database engine. It merges schema definition, data versioning, transactional lineage, media decoding, computed transformation graphs, vector indexing, and API serving (`FastAPI`/`uvicorn`) into a declarative table model executed through an embedded or hosted PostgreSQL engine.

```
+----------------------------------------------------------------------------------------------------+
|                                    Pixeltable Application Engine                                   |
|                                                                                                    |
|   +--------------------------------------------------------------------------------------------+   |
|   | App Module / FastAPIRouter (`pixeltable/serving`, `pixeltable/utils/app_module.py`)        |   |
|   | Dynamic Module Eviction & Import Isolation via Catalog.freeze() & threading.RLock()        |   |
|   +----------------------------------------------+---------------------------------------------+   |
|                                                  |                                                 |
|                                                  v                                                 |
|   +--------------------------------------------------------------------------------------------+   |
|   | TableModelMeta / Class-Body Bytecode Recovery (`catalog/model/_code_frame_utils.py`)       |   |
|   | PEP 649 Python 3.14+ bytecode frame analysis via __annotate__ introspection                |   |
|   +----------------------------------------------+---------------------------------------------+   |
|                                                  |                                                 |
|                                                  v                                                 |
|   +--------------------------------------------------------------------------------------------+   |
|   | TableVersion & Expression Graph Engine (`pixeltable/catalog/utils.py`, `exprs/`)           |   |
|   | - ColumnRef substitution & lineage tracking (ColumnRefByName -> ColumnRef)                 |   |
|   | - MediaValidation (ON_WRITE vs ON_READ)                                                    |   |
|   | - Index generation (BtreeIndex, Embedding/pgvector) & Undo/Value shadow columns            |   |
|   +----------------------------------------------+---------------------------------------------+   |
|                                                  |                                                 |
|                                                  v                                                 |
|   +--------------------------------------------------------------------------------------------+   |
|   | Multi-Source Ingestion & Adapters (`pixeltable/io/source_adapter.py`)                       |   |
|   | QueryAdapter, RowDataAdapter, PandasAdapter, CSVAdapter, HFAdapter, ParquetAdapter         |   |
|   +----------------------------------------------+---------------------------------------------+   |
|                                                  |                                                 |
|                                                  v                                                 |
|   +--------------------------------------------------------------------------------------------+   |
|   | Storage & Metadata Layer (`pixeltable/metadata/`)                                          |   |
|   | - PostgreSQL + pgserver + pgvector (ACID Versioning, JSONB md, TableSchemaVersion)         |   |
|   | - FileCache & Atomic I/O (`atomic_write` temp-file swapping with 0600 permissions)         |   |
|   +--------------------------------------------------------------------------------------------+   |
+----------------------------------------------------------------------------------------------------+
```

### Architectural Boundaries & State Ownership
1. **Catalog & Version Boundary**: Schema states are strictly immutable versions (`TableVersionMd`, `TableSchemaVersion`). Modifying a schema creates a discrete incremental version index. Schema changes are guarded by `Catalog.freeze()` context managers, which halt write transactions during module imports to prevent race conditions during AST/bytecode discovery.
2. **Execution & Expression DAG Boundary**: Computed columns are directed acyclic graph (DAG) nodes (`pixeltable.exprs.Expr`). Column evaluation is deferred: when raw media (e.g., video) is inserted, dependencies trigger downstream transforms (e.g., audio extraction $\to$ whisper transcription $\to$ LLM summarization $\to$ text embedding).
3. **Storage vs. Virtual File Invariant**: Media binaries are never embedded into relational rows. Media columns store URIs or file references pointing to an internal file cache or cloud object stores (`s3://`, `pxt://`). Media decoding occurs lazily via streaming abstractions (`pypdfium2`, `PyAV` / `av`).
4. **Adapter Ingestion Isolation**: External formats do not interface with the relational engine directly. Concrete subclasses of `SourceAdapter` ingest external formats, validate schemas, infer nullability, and emit validated tuples into the mutation engine.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Atomic Swapped Persistence for Multi-Process Shared Configurations
**RULE**:
When initializing or updating persistent system configurations, credential files, or cache registries accessed concurrently across multiple worker processes or threads, you MUST write the content to a unique temporary file on the same filesystem mount and execute an atomic filesystem rename (`os.replace` / atomic write) with explicit restricted permissions (`0600`). You MUST NOT write directly via `open(path, 'w')` followed by serialization.

**WHY**:
Standard `open(path, "w")` truncates the file immediately upon opening ($0$ bytes). Serialization formats (TOML, JSON, YAML) require subsequent buffer writes. In multi-process environments (such as `pytest-xdist`, microservices, or multiprocess background workers), concurrent workers reading during the window between truncation and serialization completion will read an empty file, load default empty configurations, fail invariant checks (e.g., missing required cache size keys), or crash with deserialization parse errors.

**WHEN TO APPLY**:
Apply to all daemon configurations, CLI local state stores, credential tokens, shared file cache manifests, and system bootstrap files in environments with multi-worker execution (Python, Node.js, Go, Rust).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import os
import tempfile
from pathlib import Path
from typing import Any
import toml

def atomic_write_toml(target_path: Path, data: dict[str, Any]) -> None:
    """
    Atomically writes a dictionary to a TOML file.
    Guarantees no concurrent reader sees a truncated or half-written file.
    Creates with 0600 (read/write by owner only) permissions.
    """
    target_path = target_path.resolve()
    target_dir = target_path.parent
    target_dir.mkdir(parents=True, exist_ok=True)

    # Use mkstemp in the same directory to guarantee identical filesystem mount (required for atomic rename)
    fd, temp_file_path = tempfile.mkstemp(
        dir=target_dir,
        prefix=f".{target_path.name}.",
        suffix=".tmp"
    )
    
    try:
        # mkstemp creates file with 0600 permissions by default
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            toml.dump(data, f)
            f.flush()
            os.fsync(f.fileno())  # Force commit to physical storage
        
        # Atomic rename replacing destination
        os.replace(temp_file_path, target_path)
    except Exception:
        # Clean up temporary artifact on failure
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise
```

**NEGATIVE CONSTRAINT**:
```python
# CRITICAL DEFECT: TOCTOU & Truncation Race Condition
def unsafe_write_config(path: Path, data: dict[str, Any]) -> None:
    # Truncates file immediately to 0 bytes!
    # Any concurrent process accessing path between open and toml.dump reads empty EOF
    with open(path, "w", encoding="utf-8") as f:
        toml.dump(data, f)
```

**VERIFICATION METHOD**:
Spawn 50 concurrent processes attempting to read the file immediately while a background process repeatedly calls the write function. Assert that zero processes read an empty file or fail TOML decoding:
```python
import concurrent.futures
import pytest

def test_no_empty_read_race(tmp_path: Path) -> None:
    target = tmp_path / "config.toml"
    payload = {"system": {"file_cache_size_g": 50}}
    
    def writer():
        for _ in range(100):
            atomic_write_toml(target, payload)

    def reader():
        for _ in range(100):
            if target.exists():
                data = toml.load(target)
                assert "system" in data and "file_cache_size_g" in data["system"]

    with concurrent.futures.ProcessPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(writer) for _ in range(2)] + [pool.submit(reader) for _ in range(6)]
        for f in concurrent.futures.as_completed(futures):
            f.result()
```

---

### 2. Python 3.14+ Deferred Annotation Recovery via Bytecode Const Inspection
**RULE**:
When building metaprogramming frameworks, ORMs, or declarative schema systems that parse type annotations on class bodies, you MUST NOT rely solely on `__annotations__` or `eval()`, nor assume annotations are executed during class body definition. Under PEP 649 (Python 3.14+), you MUST inspect the class frame's code object constants (`co_consts`) to find the deferred compiler-generated `__annotate__` code block and evaluate it using a synthesized `__classdict__` closure cell before class completion.

**WHY**:
PEP 649 defers class annotation evaluation: annotations are no longer emitted as direct namespace mutations during body execution; they are compiled into an isolated `__annotate__(format)` code object. Standard access before class creation crashes or returns empty dicts. Direct eval of AST fails on closure-dependent types (e.g., local type aliases). Without inspecting bytecode constants, dynamic schema generation and validation fail during the frame execution phase.

**WHEN TO APPLY**:
Any Python ORM, validation library (Pydantic-like), database interface, or schema compiler supporting Python 3.14 and Python 3.15+.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import dis
import types
from typing import Any

def extract_deferred_annotations(
    caller_frame: types.FrameType,
    cls_name: str,
    eval_globals: dict[str, Any],
    namespace: dict[str, Any]
) -> dict[str, Any]:
    """
    Recovers PEP 649 annotations from CPython bytecode before class construction.
    """
    code = caller_frame.f_code
    # Step 1: Locate class body code object among constants
    body_code: types.CodeType | None = None
    for instr in dis.get_instructions(code):
        if instr.offset > caller_frame.f_lasti:
            break
        if (
            instr.opname.startswith('LOAD_CONST')
            and isinstance(instr.argval, types.CodeType)
            and instr.argval.co_name == cls_name
        ):
            body_code = instr.argval

    if body_code is None:
        return {}

    # Step 2: Locate the synthetic '__annotate__' function in the body code constants
    annotate_code = next(
        (c for c in body_code.co_consts if isinstance(c, types.CodeType) and c.co_name == '__annotate__'),
        None
    )
    if annotate_code is None:
        return {}

    # Step 3: Wrap __classdict__ in a closure cell to support closure references
    closure = tuple(types.CellType(namespace) for _ in annotate_code.co_freevars)
    fn = types.FunctionType(annotate_code, eval_globals, '__annotate__', None, closure)

    # Format 1 indicates VALUE format (evaluating to runtime type instances)
    return fn(1)
```

**NEGATIVE CONSTRAINT**:
```python
# CRITICAL DEFECT: Fails on Python 3.14+ PEP 649
def unsafe_get_annotations(cls_dict: dict[str, Any]) -> dict[str, Any]:
    # __annotations__ will be absent or unpopulated during class-body metaprogramming
    if '__annotations__' not in cls_dict:
        return {}
    return cls_dict['__annotations__']
```

**VERIFICATION METHOD**:
Run unit tests across Python 3.11, 3.12, 3.13, 3.14, and 3.15-dev validating that a class declaring nested annotations resolves all types identically without executing user code twice.

---

### 3. CI/CD Marker-Based Test Orthogonalization Matrix
**RULE**:
Test suites that touch expensive remote APIs, cloud storage, large AI model weights, or specialized hardware MUST NOT overload a single marker (such as `remote_api` or `expensive`). You MUST decouple test markers into two independent axes:
1. **Reliability & Environment Boundary** (e.g., `skip_merge_queue` for flaky third-party endpoints, external object stores, model weight downloads).
2. **Resource & Dollar Cost** (e.g., `expensive` for paid token APIs, `very_expensive` for high-dollar video generation, `resource_intensive` for large CPU/RAM footprints).

**WHY**:
Conflating cost with reliability causes catastrophic CI failures:
- Inexpensive but unreliable third-party APIs fail merge queues and block PR pipelines.
- Expensive but ultra-reliable APIs (such as deterministic OpenAI embedding calls) are needlessly skipped in merge groups, allowing regressions to reach production.
- Monolithic markers prevent granular scheduling (e.g., running nightly model downloads vs. weekly expensive video generation).

**WHEN TO APPLY**:
All enterprise CI/CD systems testing machine learning models, external LLM endpoints, integration harnesses, or infrastructure providers (AWS, GCP, Azure).

**VERIFIED IMPLEMENTATION PATTERN**:
```toml
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]
# PR updates exclude unreliable APIs, all costly tiers, and heavy memory jobs:
addopts = '-v -m "not skip_merge_queue and not expensive and not very_expensive and not resource_intensive" --strict-markers'
markers = [
    "skip_merge_queue: calls external third-party endpoints prone to throttling/downtime or downloads large model weights; scheduled CI only",
    "expensive: moderate-cost external endpoints; runs on merge queue and standard+ CI tiers",
    "very_expensive: high-dollar calls (e.g. video generation, long agent workflows); runs only on weekly scheduled runs",
    "resource_intensive: requires runner memory/disk exceeding standard instances; runs on large runners only",
]
```

**NEGATIVE CONSTRAINT**:
```toml
# ANTI-PATTERN: Overloaded monolithic markers
markers = [
    # FAILS: Conflates flaky network calls with dollar costs.
    # Leads to either broken PR builds or untested expensive code.
    "expensive: marks tests as expensive or calling third party APIs",
]
```

**VERIFICATION METHOD**:
Verify with `pytest --markers` and a CI workflow validation script checking that no PR trigger runs tests tagged with `skip_merge_queue` or `very_expensive`:
```bash
pytest --collect-only -m "not skip_merge_queue and not very_expensive" | grep -v "skip_merge_queue"
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Configuration File Race Condition Under Concurrent xdist Workers (BUG-CFG-RACE-01)
- **Context**: `pixeltable/config.py` and `tests/conftest.py`
- **What Was Expected**: Multi-process test suites running under `pytest-xdist` (`-n 3`) on fresh runner environments must bootstrap default configurations safely and consistently without thread/process collisions.
- **What Actually Happened**: CI run 43480825714 failed on macOS-15 Python 3.11 with: `pixeltable/file_cache_size_g is missing from configuration`. Worker `gw2` launched its first test (`TestAnthropicTypedDictAdherence::test_mirrors`), which called `Env.get()` without acquiring the environment file lock. Simultaneously, workers `gw0` and `gw1` were generating `~/.pixeltable/config.toml` using `open(path, 'w')` followed by `toml.dump()`. Worker `gw2` read the file while it was truncated to 0 bytes, cached an empty config in memory, and failed required key validations.
- **Evidence in Repo**: PR #1955; Commit hash `fff442aedc4e8cf21c23aa06c3f0e434168a173d` related; Issue #1955.
- **Root Cause**: Non-atomic file creation in `Config.save_default()`. Truncation occurred upon file handle initialization before bytes were flushed to disk. Furthermore, nine newly added tests bypassed `init_env` via `skip_test_if_not_installed()`.
- **Remediation Code Diff**:
```python
# pixeltable/config.py
- with open(config_file, 'w') as f:
-     toml.dump(self._conf, f)
+ from pixeltable.utils.file_io import atomic_write
+ # Atomically writes via tempfile + os.replace with 0600 permissions
+ atomic_write(config_file, toml.dumps(self._conf))

# tests/conftest.py
+ @pytest.fixture(autouse=True)
+ def ensure_env_initialized(request):
+     # Enforce init_env execution across all tests reaching Env
+     if "uses_db" in request.fixturenames or "init_env" in request.fixturenames:
+         pass
+     else:
+         Env.require_initialization()
```
- **Lesson**: Never use standard Python file writes for files shared across processes. Use `atomic_write` backed by `tempfile.mkstemp` and `os.replace` on the same directory mount.

---

### Incident 2: Inaccurate Test Marker Tiering Causing CI Drift & Cost Spikes (BUG-CI-TIER-02)
- **Context**: `.github/workflows/pytest.yml`, `pyproject.toml`, `.github/instructions/tests.instructions.md`
- **What Was Expected**: Pull request builds should be fast and deterministic; merge queues should validate system stability without breaking on third-party API downtime; expensive AI model evaluations should run systematically without exceeding cloud budgets.
- **What Actually Happened**: The `remote_api`, `expensive`, and `very_expensive` pytest markers had their semantic definitions drift. Tests downloading multi-gigabyte Hugging Face models were tagged as `very_expensive`, running during merge queues, consuming excessive bandwidth, and hitting Hugging Face rate limits. Conversely, expensive generative video APIs were running on standard merge queues, creating massive dollar spikes.
- **What Changed / Diff**: Commit `9c30a9a6` refactored markers into four orthogonal attributes: `skip_merge_queue`, `expensive`, `very_expensive`, and `resource_intensive`.
- **Root Cause**: Marker semantics combined reliability constraints with financial cost constraints into a single dimensional enum.
- **Remediation Code Diff**:
```diff
# pyproject.toml
- addopts = '-v -m "not remote_api and not expensive and not very_expensive and not benchmark and not otel" --strict-markers'
+ addopts = '-v -m "not skip_merge_queue and not expensive and not very_expensive and not resource_intensive and not benchmark and not otel" --strict-markers'
  markers = [
-     "expensive: marks tests as expensive to run",
-     "very_expensive: marks tests as very expensive to run, or as depending on an unreliable external service",
-     "remote_api: marks tests as calling a remote API (such as OpenAI)",
+     "skip_merge_queue: calls a live service not reliable enough for the merge queue, downloads a model or dataset, or uses an external object store",
+     "expensive: too costly to run on every CI configuration",
+     "very_expensive: calls a remote API at a very high dollar cost",
+     "resource_intensive: needs more memory or disk than a standard GitHub-hosted runner",
  ]
```
- **Lesson**: CI markers must isolate risk dimensions independently: Cost $\ne$ Hardware Footprint $\ne$ Service Reliability.

---

### Incident 3: Ingestion Conduit Conceptual Misalignment (BUG-ARCH-REFACTOR-03)
- **Context**: `pixeltable/io/` directory refactoring
- **What Was Expected**: Input abstraction layers should convey their architectural responsibility: schema inference, source validation, and row conversion.
- **What Actually Happened**: Abstractions named `TableDataConduit` suggested passive data piping, obscuring where format adaptation, schema casting, and validation errors took place.
- **Evidence in Repo**: PR #1957; Issue #1957.
- **Root Cause**: Misleading naming led developers to implement schema validation downstream inside transactional table engines rather than at the source boundary.
- **Remediation Code Diff**:
```diff
# Renamed pixeltable/io/table_data_conduit.py -> pixeltable/io/source_adapter.py
- class TableDataConduit(ABC):
-     def valid_rows(self) -> Iterable[dict[str, Any]]: ...
+ class SourceAdapter(ABC):
+     def infer_schema(self) -> dict[str, ColumnType]: ...
+     def validate(self, target_table: TableVersion) -> None: ...
+     def valid_rows(self) -> Iterable[dict[str, Any]]: ...

- class CSVTableDataConduit(TableDataConduit): ...
+ class CSVAdapter(SourceAdapter): ...
```
- **Lesson**: Name boundaries for the transformations they perform (Adapter), not their topological position (Conduit).

---

### Incident 4: Error Propagation Inheritance Breakdown in Computed Expressions (BUG-EXPR-ERR-04)
- **Context**: `tests/functions/test_anthropic.py`
- **What Was Expected**: When an upstream column computation fails due to invalid API input, all downstream computed columns depending on that node must systematically inherit the failure state without silently crashing the batch insert transaction.
- **What Actually Happened**: Inserting an empty input array into an Anthropic message completion column generated an API error. The downstream computed column (`text`) failed to increment the transaction's exception count (`num_excs`) because it swallowed upstream execution states, reporting `num_excs == 2` instead of `3`.
- **Evidence in Repo**: Commit `9c30a9a6` (tests/functions/test_anthropic.py).
- **Root Cause**: Expression evaluator failed to properly cascade exception records to derived child nodes when handling `on_error='ignore'`.
- **Remediation Code Diff**:
```diff
# tests/functions/test_anthropic.py
          # a message without content reaches the API, which rejects it; text inherits the error from output
          status = t.insert(input=None, on_error='ignore')
-         assert status.num_excs == 2
+         assert status.num_excs == 3
          res = t.where(t.input == None).select(t.output.errormsg, t.output2.errormsg).collect()[0]
          assert all('messages.0.content: Input should be a valid array' in msg for msg in res.values())
```
- **Lesson**: In computed dependency graphs, node failures must produce a tombstone value that cascades down the DAG, incrementing total exception metrics across all affected nodes.

---

### Incident 5: Metadata Schema Migration SELECT Wildcard Incompatibility (BUG-MIG-SCHEMA-05)
- **Context**: `pixeltable/metadata/converters/util.py`
- **What Was Expected**: Database schema migrations upgrading from older catalog formats must run predictably against databases with extended or altered relational columns.
- **What Actually Happened**: Schema converters utilized unconstrained queries or positional indexing that broke whenever new system columns were added to the `Table` or `functions` metadata tables.
- **Evidence in Repo**: `pixeltable/metadata/converters/util.py:46`
- **Root Cause**: Executing implicit `SELECT *` style statements across ORM boundaries caused tuple unpacking to misalign when column indices shifted.
- **Remediation Code Diff**:
```python
# pixeltable/metadata/converters/util.py
- # Unsafe: conn.execute(sql.select(Table))
+ # Avoid a SELECT * here, which breaks when we add new columns to Table
+ for row in conn.execute(sql.select(Table.id, Table.md)):
+     tbl_id = row[0]
+     table_md = row[1]
```
- **Lesson**: Data migration scripts must explicitly select required column attributes by name; never use wildcard projections or implicit column index ordering in schema converters.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Strict Identity vs. Value Checking for None in Model Declarations**:
  In declarative class bodies (`pixeltable/utils/app_module.py`), developers frequently write `col is None` expecting SQL `IS NULL` behavior. However, in Python class bodies, `is` evaluates at class definition time and compares the expression object's memory address to `None`, evaluating permanently to `False`. The engine enforces `col == None` which is overloaded to construct an `exprs.Comparison` AST node.
  ```python
  # CORRECT:
  class Documents(TableModel, name="docs"):
      doc: pxt.Document
      # Overloaded operator returns Expr node:
      has_error = (doc == None)

  # CRITICAL ANTI-PATTERN:
  class Documents(TableModel, name="docs"):
      doc: pxt.Document
      # Evaluates IMMEDIATELY at class load to bool False!
      has_error = (doc is None) # BUG: Every row receives False!
  ```
- **Implicit Falsy Value Traps (0 vs None)**:
  In index resolution and schema version numbers (`pixeltable/catalog/utils.py`), version numbers and IDs start at `0`. Code must never use `if not schema_version:`:
  ```python
  # SAFE: Explicit None check
  if schema_version is not None:
      apply_version(schema_version)

  # DEFECT: schema_version = 0 evaluates to False!
  if schema_version:
      apply_version(schema_version) # Fails to execute for version 0!
  ```

### 2. Infinite Loop & Recursion Guards
- **Recursive Metadata Substitution Invariant**:
  When migrating metadata dictionaries (`pixeltable/metadata/converters/util.py:__substitute_md_rec`), nested schemas can contain cyclic structures or repetitive leaf keys. The recursion invariant terminates strictly on scalar types:
  ```python
  def __substitute_md_rec(md: Any, substitution_fn: Callable) -> Any:
      # Depth invariant: Dict and List branch, all primitives terminate
      if isinstance(md, dict):
          return {
              (k if substitution_fn(k, v) is None else substitution_fn(k, v)[0]):
              __substitute_md_rec(v if substitution_fn(k, v) is None else substitution_fn(k, v)[1], substitution_fn)
              for k, v in md.items()
          }
      elif isinstance(md, list):
          return [__substitute_md_rec(v, substitution_fn) for v in md]
      return md # TERMINATION INVARIANT
  ```
- **Instruction Offset Loop Termination Invariant**:
  When walking CPython bytecode frames (`_code_frame_utils.py:find_class_body_code`), the frame instruction stream can loop in comprehension contexts. The loop is bounded by `caller.f_lasti`:
  ```python
  for instr in dis.get_instructions(code):
      # INVARIANT PROOF: f_lasti is strictly monotonic with respect to current execution frame.
      if instr.offset > caller.f_lasti:
          break
  ```

### 3. UI & UX Micro-Mechanics
- **URL Segment Encoding for Protocol URIs**:
  When routing catalog paths containing custom protocol URIs (e.g., `pxt://org:db/table`), direct string interpolation in URL paths breaks React Router or Next.js route matching because slashes are interpreted as route parameters.
  ```typescript
  // dashboard/src/lib/utils.ts
  // INVARIANT: encodeURIComponent converts protocol slashes into %2F, preserving single route segment
  export function tableHref(path: string): string {
    return `/table/${encodeURIComponent(path)}`
  }
  ```
- **Debounce Effect Cleanup Invariant**:
  In `useDebounce.ts`, unmounting a component while a search query or table filter is pending causes React memory leaks and state updates on unmounted components:
  ```typescript
  // dashboard/src/hooks/useDebounce.ts
  export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
      const handler = setTimeout(() => setDebouncedValue(value), delay);
      // INVARIANT: Cleanup MUST clear timeout before next effect trigger or unmount
      return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
  }
  ```

### 4. Backend Concurrency & Memory Safety
- **Dynamic Module Hot-Reloading & Memory Leak Mitigation**:
  In `pixeltable/utils/app_module.py:evict_modules`, reloading user app modules without leaking references in `sys.modules` or the `FunctionRegistry` requires cleaning both the global module cache and internal UDF registries while protecting core packages:
  ```python
  # INVARIANT: Protected packages MUST NOT be evicted (would duplicate class singletons)
  _RUNNING_PACKAGES = ('pixeltable', 'pixeltable_cli')

  def evict_modules(root: Path) -> None:
      importlib.invalidate_caches()
      registry = FunctionRegistry.get()
      for name, module in list(sys.modules.items()):
          module_file = getattr(module, '__file__', None)
          if module_file is None or name == '__main__':
              continue
          if name.split('.', maxsplit=1)[0] in _RUNNING_PACKAGES:
              continue
          resolved = Path(module_file).resolve()
          if in_environment(resolved):
              continue
          if resolved.is_relative_to(root):
              # CRITICAL CLEANUP: Deregister from UDF registry before pop from sys.modules
              registry.deregister_module(name)
              sys.modules.pop(name, None)
  ```
- **Atomic File Lock with Exclusive Mode (0600)**:
  `atomic_write` uses `tempfile.mkstemp` on the destination directory, guaranteeing ownership-only access (`-rw-------`) and preventing TOCTOU races.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Primary Key Nullability Contract**:
  A primary key column must never be nullable. In `pixeltable/catalog/utils.py:create_table_version_md`, the engine validates this before column assignment:
  ```python
  for col in cols:
      if col.is_pk and col.col_type.nullable:
          raise excs.RequestError(
              excs.ErrorCode.UNSUPPORTED_OPERATION,
              f'Primary key column {col.name!r} cannot be nullable. '
              f'Declare it as non-nullable instead: `pxt.{col.col_type._to_base_str()}`',
          )
  ```
- **Unique B-Tree Constraint on Derived Views**:
  Views inheriting base table columns cannot independently create a duplicate B-Tree index on a column that belongs to the base table (`owner_tbl_id != tbl_id`).

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
Pixeltable uses an MVCC-based relational core on PostgreSQL where schema changes and data modifications are logged as discrete immutable versions. An internal dependency DAG routes inputs through UDFs and transformers to computed columns. The user defines their schema, routing, and models in a single script (`app.py`), and the framework handles storage, orchestration, indexing, and FastAPI server generation.

### 2. Core Abstractions
- `TableModel`: Declarative class-based interface mapping directly to a table version.
- `Column`: Schema and lineage representation; contains expression references, types, and constraints.
- `Expr`: The AST node base class for computed columns (e.g., `ColumnRef`, `FunctionCall`).
- `SourceAdapter`: Base data intake interface that inspects schemas, validates shapes, and streams tuples.
- `BtreeIndex` & `EmbeddingIndex`: Native index managers managing shadow columns for search and undo logs.

### 3. Error Handling
Faults in UDF execution (e.g., model inference network timeouts, format parsing exceptions) are handled via column-level error parameters (`on_error='ignore'`). In this mode, exceptions are caught, serialized into an error record alongside the row, and accessible via `.errormsg`. Downstream computed nodes inherit error tombstones without crashing batch transactions.

### 4. Testing
Uses `pytest` with fine-grained marker orthogonalization (`skip_merge_queue`, `expensive`, `very_expensive`, `resource_intensive`). Model embedding tests use dummy local surrogate models (`local_embed`) for deterministic CI assertion runs, while real weights (`clip_embed`, `mpnet_embed`) run under serialized `xdist_group('large_model')` runners.

### 5. Security
Strict path traversal sanitization prevents operations from escaping the project root (`pixeltable/utils/app_module.py:module_name`). File generation uses `mkstemp` setting explicit `0600` POSIX permissions. Dynamic module loading is guarded by `Catalog.freeze()` to prevent unauthorized database writes during import-time evaluation.

### 6. Performance
Zero-copy operations are prioritized by decoupling media storage from row relational data. Binary blobs are stored in an internal cache (`file_cache_size_g`) and addressed via local filesystem paths or authenticated URLs. Vector index construction builds auxiliary shadow tables with pgvector cosine/L2 operators.

### 7. Deployment
Packaged with `uv-dynamic-versioning` and `hatchling`. Pinned engine binaries include `pixeltable-pgserver==0.7.1`. The runtime ships modular extras (`serve` for FastAPI/uvicorn and `otel` for OpenTelemetry instrumentation). Runs across Ubuntu, macOS (Apple Silicon and Intel), and Windows.

### 8. Agent Patterns
Designed as a unified foundation for AI agents:
1. Simplifies agent memory architectures by eliminating external vector database synchronization.
2. Exposes dynamic self-documenting REST APIs through `FastAPIRouter`.
3. Eliminates LLM pipeline glue code by encapsulating prompt chains directly into database computed expressions.

### 9. Data Flow
Insertion $\to$ Adapter schema validation $\to$ Raw storage $\to$ Expression DAG resolution $\to$ Transformer/UDF parallel dispatch $\to$ Shadow index population $\to$ PostgreSQL commit $\to$

## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
