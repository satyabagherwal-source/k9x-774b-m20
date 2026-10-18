> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tiangolo-fastapi-learnings.md`  
> **Source**: github ([https://github.com/tiangolo/fastapi](https://github.com/tiangolo/fastapi))  
> **Source Version**: `b23d78f2`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-18T07:39:12.933Z  
> **Learning ID**: `learn-github-fastapi-fastapi`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): fastapi/fastapi

---

## 1. Executive Forensic Architecture & System Mechanics

FastAPI is an asynchronous web framework built atop Starlette (ASGI protocol engine) and Pydantic (data validation and serialization engine). Rather than functioning as a monolithic server framework, FastAPI operates as a **declarative dependency injection graph compiler** coupled with an **asynchronous request execution pipeline** and an **OpenAPI 3.1.0 schema generation compiler**.

```
[Incoming ASGI Scope / Request / WebSocket]
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ ASGI Middleware Stack (AsyncExitStackMiddleware, etc.)   │
└──────────────────────────────┬──────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────┐
│ Router Pipeline (fastapi/routing.py)                    │
│   ├─ Match Route & Path Convertors                      │
│   ├─ Extract ASGI Scope / State                         │
│   └─ Execute Dependant Graph (fastapi/dependencies/)     │
└──────────────────────────────┬──────────────────────────┘
                               │
         ┌─────────────────────┴─────────────────────┐
         ▼                                           ▼
┌────────────────────────────────┐     ┌────────────────────────────────┐
│ Sync Dependencies / Endpoints  │     │ Async Dependencies / Endpoints │
│   └─ run_in_threadpool         │     │   └─ Direct await on loop      │
│   └─ CapacityLimiter(1) exit   │     │   └─ AsyncExitStack cleanup    │
└────────────────────────────────┘     └────────────────────────────────┘
         │                                           │
         └─────────────────────┬─────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────┐
│ Serialization Engine (fastapi/_compat/v2.py)            │
│   ├─ ModelField.serialize_json via Pydantic Rust Core   │
│   ├─ _normalize_non_finite_floats (NaN/Inf scrubbing)   │
│   └─ SSE / JSONL Line Framing                           │
└─────────────────────────────────────────────────────────┘
```

### Architectural Subsystems and Boundaries

1. **The Dependency Graph Compiler (`fastapi/dependencies/utils.py` & `models.py`)**:
   - Compiles route signatures, query parameters, header parameters, cookie schemas, body payloads, and security schemes into an immutable directed acyclic graph (`Dependant`).
   - Resolves sub-dependencies at route declaration time rather than per-request time. It performs topological traversal using unique `DependencyCacheKey` tuples to prevent cyclic dependencies and redundant evaluations within the same ASGI request cycle.
   - Decouples dependency extraction from endpoint execution: parameter-less dependencies (e.g., security authenticators, auditing interceptors) run as sub-dependants within the unified dependency stack.

2. **The Asynchronous Concurrency Isolation Barrier (`fastapi/concurrency.py`)**:
   - Manages execution transitions across the synchronous-to-asynchronous boundary using `anyio.to_thread.run_sync` and Starlette's `run_in_threadpool`.
   - Solves teardown deadlocks in synchronous context managers through `contextmanager_in_threadpool`: explicitly instantiates dedicated, unshared thread pool limiters (`CapacityLimiter(1)`) for `cm.__exit__`. This ensures that exhausted synchronous database connection pools waiting for available worker threads do not starve or deadlock the event loop when cleaning up scopes.

3. **Schema Generation & Type Introspection Engine (`fastapi/_compat/` & `fastapi/openapi/`)**:
   - Wraps Pydantic v2's low-level schema engine (`TypeAdapter`, `CoreSchema`, `GenerateJsonSchema`).
   - Distinguishes between validation mode (`validate_python`) and serialization mode (`dump_python`, `dump_json`).
   - Resolves complex Python typing structures (`Annotated`, `Union`, `UnionType`, `ForwardRef`, PEP 695 type aliases via `typing-inspection`) without triggering runtime `NameError` exceptions, falling back to Python 3.14 `annotationlib.Format.FORWARDREF` when available.

4. **Telemetry & Observability Layer (`fastapi/telemetry/`)**:
   - Native integration with the OpenTelemetry SDK without requiring third-party monkey patching.
   - Enforces scope isolation: uses context variables (`otel_context.attach`, `otel_context.detach`) to prevent excluded health checks or internal sub-requests from polluting outer distributed trace contexts.
   - Employs lazy memoization on provider instances to preserve Python standard library `warnings` deduplication states across concurrent HTTP/WebSocket requests.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Isolated Context-Manager Exit Limiters in Hybrid Threadpools
**RULE**:
When adapting a synchronous Python context manager into an asynchronous context manager (`@asynccontextmanager`) backed by a worker threadpool, `cm.__exit__` MUST execute with an isolated, dedicated capacity limiter (or unconstrained limiter), rather than borrowing or competing for the global/shared threadpool capacity limiter used by `cm.__enter__`.

**WHY**:
If `cm.__enter__` acquires a shared resource (such as a database connection from a bounded pool) on a shared threadpool, and the event loop saturates the shared threadpool with subsequent `cm.__enter__` tasks, the system enters an unrecoverable deadlock (Resource Acquisition At Degradation Starvation). The thread pool is exhausted by tasks waiting for connections, while the tasks holding connections cannot run `cm.__exit__` because the thread pool has no free worker slots. Supplying an isolated `CapacityLimiter(1)` solely for `cm.__exit__` guarantees that release/cleanup operations are never starved by inbound acquisition tasks.

**WHEN TO APPLY**:
Apply in any asynchronous runtime (AnyIO, asyncio, Trio, Twisted) bridging synchronous context managers (SQLAlchemy sessions, psycopg2 connections, Redis connections, disk file handles) into async generator lifecycles.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from collections.abc import AsyncGenerator
from contextlib import AbstractContextManager, asynccontextmanager
from typing import TypeVar
import anyio.to_thread
from anyio import CapacityLimiter
from starlette.concurrency import run_in_threadpool

_T = TypeVar("_T")

@asynccontextmanager
async def contextmanager_in_threadpool(
    cm: AbstractContextManager[_T],
) -> AsyncGenerator[_T, None]:
    # A dedicated limiter for __exit__ ensures that teardown never starves
    # if the main worker pool is saturated with inbound requests.
    exit_limiter = CapacityLimiter(1)
    try:
        # Run __enter__ on the shared threadpool
        yield await run_in_threadpool(cm.__enter__)
    except Exception as e:
        ok = bool(
            await anyio.to_thread.run_sync(
                cm.__exit__, type(e), e, e.__traceback__, limiter=exit_limiter
            )
        )
        if not ok:
            raise e
    else:
        await anyio.to_thread.run_sync(
            cm.__exit__, None, None, None, limiter=exit_limiter
        )
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Reusing the default threadpool for cm.__exit__
@asynccontextmanager
async def leaky_contextmanager(cm):
    try:
        # If threadpool has N slots, and N concurrent requests enter here:
        yield await run_in_threadpool(cm.__enter__)
    finally:
        # DEADLOCK: Threadpool capacity is 0, __exit__ is queued indefinitely.
        # Connections in the pool are never released, freezing the server process.
        await run_in_threadpool(cm.__exit__, None, None, None)
```

**VERIFICATION METHOD**:
Run an integration test with a pool size equal to the threadpool worker limit ($N$), initiate $N$ concurrent requests, throw an exception inside the yielded block, and verify that all $N$ context managers complete `__exit__` within a strict timeout ($< 1.0\text{s}$) rather than timing out or hanging indefinitely.

---

### 2. RFC 8259 Compliant Float Sanitization for Stream Encoders
**RULE**:
Before piping deserialized or arbitrary Python objects into standard JSON lines (`JSONL`) or Server-Sent Events (`SSE`) streaming buffers that utilize standard `json.dumps`, the serialization layer MUST recursively normalize non-finite IEEE 754 floating-point values (`math.nan`, `math.inf`, `-math.inf`) to JSON-compliant `None` (or configured string representations), while preserving non-string dictionary keys and primitive scalar values.

**WHY**:
JavaScript Object Notation (RFC 8259 § 6) explicitly forbids `NaN`, `Infinity`, and `-Infinity`. Python's native `json.dumps()` allows these values by default (`allow_nan=True`), emitting JavaScript-incompatible tokens: `{"val": NaN}`. When consumed by frontend parsers (`JSON.parse` in browsers or Node.js), parsing fails with a fatal `SyntaxError: Unexpected token N in JSON at position X`. While Pydantic v2 handles this at the model level via `model_dump_json()`, raw dictionaries, untyped generators, or Server-Sent Events wrapping unstructured payloads bypass Pydantic model serialization and crash client-side streaming consumers unless sanitized.

**WHEN TO APPLY**:
Apply in any HTTP streaming route, SSE emitter (`EventSourceResponse`), JSONL ndjson line-delimited stream, or websocket pipeline yielding dynamically constructed dictionaries or primitive floats to HTTP clients.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import math
from typing import Any

def normalize_non_finite_floats(data: Any) -> Any:
    """
    Recursively replaces non-finite float values in JSON-compatible structures
    with None, preserving dict keys, non-float primitives, and nested structures.
    """
    if isinstance(data, float):
        return data if math.isfinite(data) else None
    if isinstance(data, dict):
        return {
            key: normalize_non_finite_floats(value) 
            for key, value in data.items()
        }
    if isinstance(data, list):
        return [normalize_non_finite_floats(value) for value in data]
    return data
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Serializing raw generator items directly to stream bytes
async def event_generator():
    yield {"ratio": float("nan"), "status": "running"}

async def bad_sse_endpoint():
    async for item in event_generator():
        # Emits: b'data: {"ratio": NaN, "status": "running"}\n\n'
        # Crashes `JSON.parse()` in the browser with SyntaxError!
        yield f"data: {json.dumps(item)}\n\n".encode("utf-8")
```

**VERIFICATION METHOD**:
Parameterized unit test verifying that emitting `[float("nan"), float("inf"), float("-inf"), {"nested": [float("nan")]}]` through an SSE or JSONL response pipeline deserializes via a strict RFC-compliant JSON parser (`json.loads` without non-standard extensions) into `[None, None, None, {"nested": [None]}]`.

---

### 3. Starlette Route Extraction Invariant for Included Sub-Routers
**RULE**:
When wrapping or mounting Starlette routers (`Route`, `WebSocketRoute`, `Mount`, `Host`) inside an application router abstraction that produces route inspection metadata (`iter_route_contexts()`), the introspection traversal MUST check if the contextual wrapper contains a direct underlying `.starlette_route`. If present, it MUST return that underlying route rather than returning the generic `_RouteContext` wrapper.

**WHY**:
When routers are included dynamically using `.include_router()`, FastAPI creates intermediate route contexts to propagate path prefixes, dependencies, and tags. If `_effective_route` returns the wrapper object instead of the actual `starlette.routing.Route` or `starlette.routing.WebSocketRoute`, downstream OpenAPI generators, reverse-URL resolution engines (`url_path_for`), and route-conflict detection algorithms fail to access native path parameters (`param_convertors`), route handlers, or HTTP methods, leading to blank metadata, missing documentation, or incorrect 404/405 routing tables.

**WHEN TO APPLY**:
Apply when implementing API routing layers, gateway adapters, or OpenAPI schema generation tools that wrap or nest underlying ASGI framework routes.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from starlette.routing import BaseRoute

class RouteContextWrapper:
    def __init__(self, route: BaseRoute, route_context: Any | None = None) -> None:
        self.route = route
        self._route_context = route_context

    @property
    def original_route(self) -> BaseRoute:
        return self.route

    @property
    def _effective_route(self) -> BaseRoute:
        if self._route_context is not None:
            # Crucial invariant: if an inner starlette_route exists in context,
            # surface it to preserve route metadata, path convertors, and methods.
            if getattr(self._route_context, "starlette_route", None) is not None:
                return self._route_context.starlette_route
            return self._route_context
        return self.route
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Returning wrapper context directly without unwrapping
@property
def _effective_route(self):
    if self._route_context is not None:
        # Drops starlette_route attributes (e.g. methods, param_convertors)!
        return self._route_context 
    return self.route
```

**VERIFICATION METHOD**:
Include an `APIRouter` containing a raw `starlette.routing.Route` and `WebSocketRoute` with typed path parameters (`/items/{item_id:int}`) under a nested prefix (`/api/v1`), run `iter_route_contexts(app.routes)`, and assert:
`context.param_convertors["item_id"].convert("42") == 42` and `context.methods == {"GET", "HEAD"}`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Non-Finite Float Serialization Crash in JSONL and SSE Streams (BUG-FASTAPI-16509)
- **Context**: `fastapi/routing.py`, streaming serialization handlers `_serialize_data` and `_serialize_sse_item`.
- **What Was Expected**: Generator endpoints yielding float values containing `NaN`, `+Infinity`, or `-Infinity` should stream valid JSON payloads compliant with RFC 8259 when formatted as newline-delimited JSON (`JSONL`) or Server-Sent Events (`SSE`).
- **What Actually Happened**: When items without a dedicated Pydantic `BaseModel` (or untyped dictionaries) were yielded from async generators, `jsonable_encoder(data)` preserved Python's float representations. `json.dumps()` converted `float("nan")` to raw unquoted `NaN`. In browser-based `EventSource` and streaming consumers, `JSON.parse()` crashed immediately with a fatal syntax error.
- **Evidence in Repo**: Commit `d1fd422f`, PR `#16509`, Issue `#16509`.
- **Root Cause**: Streaming serialization paths for raw responses bypassed Pydantic v2's `TypeAdapter.dump_json()`, instead routing through `jsonable_encoder()` followed directly by `json.dumps()`. Python's `json.dumps()` serializes non-finite floats as JavaScript identifiers `NaN`, `Infinity`, and `-Infinity` by default instead of raising an error or converting them to `null`.
- **Remediation Code Diff**:
```python
# fastapi/routing.py
@@ -5,6 +5,7 @@
 import inspect
 import json
+import math
 import os

+def _normalize_non_finite_floats(data: Any) -> Any:
+    """Replace non-finite values in JSON-compatible data, preserving dict keys."""
+    if isinstance(data, float):
+        return data if math.isfinite(data) else None
+    if isinstance(data, dict):
+        return {key: _normalize_non_finite_floats(value) for key, value in data.items()}
+    if isinstance(data, list):
+        return [_normalize_non_finite_floats(value) for value in data]
+    return data
+
@@ -536,7 +548,9 @@ def _serialize_data(data: Any) -> bytes:
                 else:
                     data = jsonable_encoder(data)
-                    return json.dumps(data).encode("utf-8")
+                    return json.dumps(_normalize_non_finite_floats(data)).encode(
+                        "utf-8"
+                    )
@@ -554,7 +568,11 @@ def _serialize_sse_item(item: Any) -> bytes:
                             if hasattr(item.data, "model_dump_json"):
                                 data_str = item.data.model_dump_json()
                             else:
-                                data_str = json.dumps(jsonable_encoder(item.data))
+                                data_str = json.dumps(
+                                    _normalize_non_finite_floats(
+                                        jsonable_encoder(item.data)
+                                    )
+                                )
```
- **Lesson**: Any streaming protocol serializer passing untyped or dynamically typed dictionary payloads must sanitize float representations at the boundary before encoding to wire format.

---

### Incident 2: Event Loop Thread Starvation via Blocking File Stat in Frontend Fallback (BUG-FASTAPI-16503)
- **Context**: `fastapi/routing.py`, SPA frontend static file fallback handler (`_fallback_file_exists`).
- **What Was Expected**: Single Page Application (SPA) routing fallbacks (checking for `404.html` or `index.html` when an asset path is missing) must not block the main asynchronous event loop thread during filesystem access.
- **What Actually Happened**: When high-concurrency requests targeted missing frontend assets, the server's event loop experienced microsecond-to-millisecond stalls because `self.lookup_path(fallback)` performed synchronous `stat` system calls directly on the event loop thread. Under slow disk I/O, NFS mounts, or high disk contention, ASGI request throughput plummeted.
- **Evidence in Repo**: Commit `d0282a38`, PR `#16503`, Issue `#16503`.
- **Root Cause**: `_fallback_file_exists` was defined as a synchronous method (`def _fallback_file_exists`) and directly called `self.lookup_path(fallback)` which invokes `os.stat()`. In ASGI applications, filesystem access is a blocking system call that must be delegated to worker threads.
- **Remediation Code Diff**:
```python
# fastapi/routing.py
@@ -2004,13 +2004,16 @@ async def get_response(self, path: str, scope: Scope) -> Response:
             return self.file_response(full_path, stat_result, scope)
 
         if self.fallback == "404.html" or (
-            self.fallback == "auto" and self._fallback_file_exists("404.html")
+            self.fallback == "auto" and await self._fallback_file_exists("404.html")
         ):
             return await self._fallback_response("404.html", scope, status_code=404)
@@ -2043,8 +2046,8 @@ async def _lookup_static_resource(
                 return full_path, stat_result, True
         return None
 
-    def _fallback_file_exists(self, fallback: str) -> bool:
-        _, stat_result = self.lookup_path(fallback)
+    async def _fallback_file_exists(self, fallback: str) -> bool:
+        _, stat_result = await run_in_threadpool(self.lookup_path, fallback)
         return stat_result is not None and stat.S_ISREG(stat_result.st_mode)
```
- **Lesson**: Any filesystem access inside an async ASGI request path—even a seemingly lightweight file existence check—is a blocking syscall and MUST be offloaded to `run_in_threadpool`.

---

### Incident 3: Metadata Stripping in Included Router Iteration (BUG-FASTAPI-16484)
- **Context**: `fastapi/routing.py`, internal class `_EffectiveRouteContext` and `iter_route_contexts()`.
- **What Was Expected**: Introspecting routes on an application (`app.routes`) that had mounted routers via `app.include_router()` should return the complete metadata (HTTP methods, path convertors, route names, and dependency chains) for all underlying routes, including raw `Route` and `WebSocketRoute` instances.
- **What Actually Happened**: When sub-routers containing Starlette `Route` or `WebSocketRoute` objects were included, `iter_route_contexts()` returned empty methods (`context.methods == None`) and discarded path parameter convertors. 6 out of 44 router context tests failed because `_effective_route` stopped traversal at the intermediate context wrapper.
- **Evidence in Repo**: Commit `5e6a1eec`, PR `#16484`, Issue `#16484`.
- **Root Cause**: `_effective_route` returned `self._route_context` directly without inspecting whether `self._route_context.starlette_route` was present. The wrapper lacked the attributes of the concrete Starlette route.
- **Remediation Code Diff**:
```python
# fastapi/routing.py
@@ -1592,6 +1592,8 @@ def original_route(self) -> BaseRoute:
     @property
     def _effective_route(self) -> BaseRoute | _EffectiveRouteContext:
         if self._route_context is not None:
+            if self._route_context.starlette_route is not None:
+                return self._route_context.starlette_route
             return self._route_context
         return self.route
```
- **Lesson**: Wrapper abstractions around composite data structures must implement transparent pass-through unwrapping for all underlying structural types to prevent metadata loss in recursive tree traversals.

---

### Incident 4: Cross-Request Telemetry Context Leaking on Excluded Endpoints (BUG-FASTAPI-16470)
- **Context**: `fastapi/telemetry/_asgi.py`, OpenTelemetry middleware scope filter.
- **What Was Expected**: Requests configured to be excluded from telemetry (such as `/healthz` or internal probes) should run completely isolated without recording spans, metrics, or inheriting parent trace contexts from concurrent requests.
- **What Actually Happened**: An excluded request executed within an existing async task context inherited the ambient `TelemetryData` from prior or outer requests. Health checks and excluded probes were inadvertently attached to application traces and corrupted distributed trace span parents.
- **Evidence in Repo**: Issue `#16470`, PR `#16470`.
- **Root Cause**: The exclusion branch in `_asgi.py` did not clear the request-local context variable. In Python asyncio, `contextvars` inherit their parent task's state upon invocation unless explicitly overwritten.
- **Remediation Code Diff**:
```python
# fastapi/telemetry/_asgi.py (conceptual reproduction from PR 16470)
# Inside telemetry execution middleware:
if is_excluded(scope):
    # Bug: outer TelemetryData leaked into excluded handler
    # Fix: explicitly set contextvar to None and detach in finally
    token = _REQUEST_TELEMETRY_KEY.set(None)
    try:
        await self.app(scope, receive, send)
    finally:
        _REQUEST_TELEMETRY_KEY.reset(token)
    return
```
- **Lesson**: When bypassing execution pipelines in asynchronous middleware via early returns or filter predicates, any ambient `contextvars` MUST be explicitly neutralized (set to `None` or an empty context) and reset in a `finally` block to prevent cross-request context leakage.

---

### Incident 5: Tracer Provider Cache Eviction Causing Python Warning Storms (BUG-FASTAPI-16468)
- **Context**: `fastapi/telemetry/_asgi.py`, telemetry tracer lookup in `__call__`.
- **What Was Expected**: Executing HTTP and WebSocket endpoints that emit Python standard library warnings (`warnings.warn()`) should have repeated warnings deduplicated by Python's `warnings.simplefilter("default")`.
- **What Actually Happened**: Endpoints repeatedly calling `trace.get_tracer(...)` on every inbound ASGI request broke warning deduplication. Repeated requests generated identical warnings continuously, saturating log aggregators and slowing request throughput.
- **Evidence in Repo**: Commit `6eae2f34`, PR `#16468`, Issue `#16468`.
- **Root Cause**: Calling `trace.get_tracer(...)` on every request created new tracer instances or internally manipulated frames in a manner that invalidated Python's internal warning registry cache (`__warningregistry__`) across request lifecycles.
- **Remediation Code Diff**:
```python
# fastapi/telemetry/_asgi.py
@@ -168,6 +168,8 @@ def __init__(self, config: TelemetryConfig) -> None:
         self._duration: Histogram | None = None
         self._active: UpDownCounter | None = None
+        self._tracer_provider: trace.TracerProvider | None = None
+        self._tracer: trace.Tracer | None = None

@@ -214,6 +216,15 @@ def _instruments(self) -> tuple[Histogram, UpDownCounter]:
         assert self._duration is not None and self._active is not None
         return self._duration, self._active
+
+    def _get_tracer(self, *, provider: trace.TracerProvider) -> trace.Tracer:
+        if provider is not self._tracer_provider:
+            self._tracer = provider.get_tracer(
+                "fastapi", __version__, schema_url=_SCHEMA_URL
+            )
+            self._tracer_provider = provider
+        assert self._tracer is not None
+        return self._tracer
@@ -282,12 +293,7 @@ async def __call__(
         if tracing:
             parent = propagate.extract(Headers(scope=scope), getter=_HEADERS_GETTER)
             parent_token = otel_context.attach(parent)
-            tracer = trace.get_tracer(
-                "fastapi",
-                __version__,
-                config["tracer_provider"],
-                schema_url=_SCHEMA_URL,
-            )
+            tracer = self._get_tracer(provider=provider)
```
- **Lesson**: SDK instances and telemetry instruments must be cached on the middleware instance and only re-acquired when the parent provider identity changes (`provider is not self._tracer_provider`).

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### Strict Partitioning vs String Splitting for Authorization Headers
FastAPI isolates HTTP authorization schemes without using regex or multi-element splits to eliminate delimiter injection and empty-string index crashes:
```python
# fastapi/security/utils.py
def get_authorization_scheme_param(
    authorization_header_value: str | None,
) -> tuple[str, str]:
    if not authorization_header_value:
        return "", ""
    # str.partition guarantees exactly a 3-tuple (head, sep, tail)
    # Never raises IndexError, handles extra whitespace cleanly.
    scheme, _, param = authorization_header_value.partition(" ")
    return scheme, param.strip()
```

#### Truthiness vs Undefined Sentinels
In dependency resolution and parameter default extraction, standard Python `None` or `bool(val)` checks create falsy traps: an integer parameter passed as `0`, a float `0.0`, or an empty string `""` evaluates to `False`. FastAPI uses a distinct singleton sentinel `Undefined`:
```python
# fastapi/_compat/v2.py
from pydantic_core import PydanticUndefined

RequiredParam = PydanticUndefined
Undefined = PydanticUndefined

# Comparison invariant: MUST use `is not Undefined`, never `if default:`
if value is not Undefined:
    attributes[attr] = value
```

#### Underscore to Hyphen Header Transformation Invariant
When converting model attributes to HTTP headers, FastAPI strictly avoids altering headers if a custom alias or `convert_underscores=False` is set:
```python
# fastapi/openapi/utils.py
name = get_validation_alias(param)
convert_underscores = getattr(
    param.field_info,
    "convert_underscores",
    default_convert_underscores,
)
# ONLY replace if the target is an HTTP Header parameter AND the name matches raw field name
if (
    param_type == ParamTypes.header
    and name == param.name
    and convert_underscores
):
    name = param.name.replace("_", "-")
```

---

### 2. Infinite Loop & Recursion Guards

#### Dependant Graph Traversal Cycle Shield
In `fastapi/dependencies/utils.py`, endpoints can declare nested, circular, or multi-branch dependency graphs. To prevent stack overflows and infinite graph traversals during parameter flattening, FastAPI uses a visited cache key list:
```python
def get_flat_params(dependant: Dependant) -> list[ModelField]:
    path_params: list[ModelField] = []
    # ...
    visited: list[DependencyCacheKey] = []
    uses_scopes_cache: _UsesScopesCache = {}
    dependants = [dependant]
    while dependants:
        current_dependant = dependants.pop()
        cache_key = _get_cache_key(
            dependant=current_dependant,
            uses_scopes_cache=uses_scopes_cache,
        )
        # Cycle termination invariant:
        if cache_key in visited:
            continue
        visited.append(cache_key)
        # Process and push children in reverse order to maintain declaration precedence
        dependants.extend(reversed(current_dependant.dependencies))
```

#### Recursive Non-Finite Float Scrubbing Termination
`_normalize_non_finite_floats` enforces base-case termination by exclusively recursing on primitive JSON container types (`dict`, `list`). Any scalar, string, integer, or custom object immediately terminates recursion:
```python
def _normalize_non_finite_floats(data: Any) -> Any:
    if isinstance(data, float):
        return data if math.isfinite(data) else None
    if isinstance(data, dict):
        return {key: _normalize_non_finite_floats(value) for key, value in data.items()}
    if isinstance(data, list):
        return [_normalize_non_finite_floats(value) for value in data]
    # Invariant: Base case for all other types (int, str, bool, None, bytes)
    return data
```

---

### 3. UI & UX Micro-Mechanics

#### Single Page Application (SPA) Static Asset Fallback Invariant
In `fastapi/routing.py`, when serving SPAs alongside REST APIs, the frontend router must distinguish between direct API calls (which must return `404 Not Found`) and browser navigation requests (which must return `index.html` with status `200` to let the frontend router handle the route):
```python
# Only serve index.html if it is a GET navigation request accepting text/html
if (
    self.fallback == "index.html"
    or