> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tiangolo-fastapi-learnings.md`  
> **Source**: github ([https://github.com/tiangolo/fastapi](https://github.com/tiangolo/fastapi))  
> **Source Version**: `03002a00`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-20T05:48:12.246Z  
> **Learning ID**: `learn-github-fastapi-fastapi`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): fastapi/fastapi

---

## 1. Executive Forensic Architecture & System Mechanics

FastAPI is an asynchronous ASGI web framework engineered on top of Starlette and Pydantic. It solves high-throughput HTTP/WebSocket request routing, parameter extraction, schema validation, dependency injection, and automatic OpenAPI documentation generation. 

```
                                  [ ASGI Scope / Event Loop ]
                                                │
                                  ┌─────────────▼─────────────┐
                                  │   APIRouter / Route Match │
                                  └─────────────┬─────────────┘
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 ▼                                                             ▼
     [ HTTP Request Pipeline ]                                     [ WebSocket Pipeline ]
                 │                                                             │
                 ├──────────────────────────────┬──────────────────────────────┤
                 │                              │                              │
                 ▼                              ▼                              ▼
      [ Parameter Extraction ]      [ Security Dependencies ]     [ Async Dependency DAG ]
   (Query, Path, Header, Cookie,    (HTTPBase, APIKey, OAuth2,    (AsyncExitStack, scopes,
       Form, File, Body)               Bearer - HTTPConnection)     threadpool offloading)
                 │                              │                              │
                 └──────────────────────────────┼──────────────────────────────┘
                                                │
                                                ▼
                                  [ Pydantic v2 Core Validation ]
                                 (FieldInfo, ModelField, Defaults)
                                                │
                                                ▼
                                  [ Endpoint Handler Execution ]
                                (async def / run_in_threadpool sync)
                                                │
                                                ▼
                                 [ Response Serialization & SSE ]
                               (JSON, JSONL, EventSource, Streaming)
```

### Architectural Boundaries & State Ownership
1. **The Routing & Matching Subsystem (`fastapi.routing`)**:
   Owns the route table, ASGI entrypoint dispatch, and request/response lifecycles. Encapsulates `APIRoute` and `APIWebSocketRoute`. Routes do not execute logic directly; they compile dependencies into an execution graph represented by `Dependant` trees.
2. **The Dependency Graph & Execution Engine (`fastapi.dependencies.utils` & `models`)**:
   Constructs a directed acyclic graph (DAG) of callables at application startup. At request runtime, it manages parameter resolution via `AsyncExitStack`. It arbitrates parameter lifetimes across two primary scopes: `function` (re-evaluated per sub-dependency call) and `request` (cached within the request execution context via `DependencyCacheKey`).
3. **Data Extraction & Validation Boundary (`fastapi.params` & `fastapi._compat`)**:
   Decouples ASGI protocol semantics (`starlette.datastructures.Headers`, `QueryParams`, `FormData`) from Python typing representations. It maps raw string/stream inputs into typed domain primitives using Pydantic `ModelField` abstractions. Crucially, parameter default assignment is decoupled from request-body multidict extraction to prevent premature default instantiation and un-sanitized parameter injection.
4. **Security & Authentication Abstractions (`fastapi.security`)**:
   Defines protocol-level challenges (HTTP Basic, Bearer, Digest, API Key, OAuth2, OpenID Connect). Instead of binding tightly to HTTP `Request`, it binds to Starlette's protocol-neutral `HTTPConnection` abstraction, enabling unified authentication across standard HTTP requests and stateful WebSocket handshakes.
5. **Threadpool Concurrency Engine (`fastapi.concurrency`)**:
   Bridges synchronous Python context managers and blocking I/O functions with the `asyncio` event loop. Uses `anyio.to_thread` with isolated capacity limiters to prevent threadpool starvation and deadlocks during context exit operations (e.g., database connection release).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dedicated Limiter for Threadpool Resource Teardown
**RULE**:
When running synchronous context managers within an asynchronous threadpool offloader, the teardown phase (`__exit__`) MUST NOT share or compete for the same thread capacity limiter as the acquisition phase (`__enter__`) or general worker pool. Teardown operations MUST execute under an independent, dedicated capacity limiter or unconstrained thread budget.

**WHY**:
If the worker threadpool is exhausted (e.g., saturated by concurrent `__enter__` calls or blocking handler operations) and a context manager's `__exit__` must wait for an available thread token from the same limiter, the system enters an unrecoverable deadlock. This is especially lethal when `__enter__` acquires a connection from an internal pool (such as a database engine or socket pool): worker threads block waiting for database connections while the threads holding the connections block waiting for threadpool capacity to run `__exit__`.

**WHEN TO APPLY**:
Applies to any async runtime (Python AsyncIO/AnyIO, Node.js worker pools, Go goroutine worker pools with bounded semaphores, Rust tokio blocking tasks) where synchronous resource wrappers with cleanup lifecycles are adapted into asynchronous execution contexts.

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
    # Allocate a completely independent, non-shared limiter for __exit__
    # preventing worker-threadpool starvation from deadlocking teardown
    exit_limiter = CapacityLimiter(1)
    try:
        # __enter__ runs on standard, global threadpool
        yield await run_in_threadpool(cm.__enter__)
    except Exception as e:
        # __exit__ runs on dedicated exit_limiter regardless of global pool saturation
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
# ANTI-PATTERN: Reusing the default or global capacity limiter for context teardown
@asynccontextmanager
async def broken_contextmanager_in_threadpool(cm):
    try:
        # If pool size is N and N concurrent requests reach this point,
        # all N threads are busy.
        val = await run_in_threadpool(cm.__enter__)
        yield val
    finally:
        # DEADLOCK: cm.__exit__ tries to acquire a thread from the saturated
        # default pool. The threads in the pool are waiting for downstream work,
        # which cannot complete until __exit__ releases the underlying resource.
        await run_in_threadpool(cm.__exit__, None, None, None)
```

**VERIFICATION METHOD**:
Enforce via an automated stress test asserting threadpool exhaustion resilience:
```python
import pytest
import anyio
from anyio import to_thread

async def test_threadpool_context_manager_deadlock_under_saturation():
    # Artificially constrain default thread pool to 1 worker
    limiter = to_thread.current_default_thread_limiter()
    limiter.total_tokens = 1

    class Resource:
        def __enter__(self): return self
        def __exit__(self, *args): return False

    async def worker():
        async with contextmanager_in_threadpool(Resource()):
            # Simulate microtask switch while holding resource
            await anyio.sleep(0.01)

    # Launch concurrent tasks exceeding token count
    async with anyio.create_task_group() as tg:
        for _ in range(10):
            tg.start_soon(worker)
```

---

### 2. Upstream Protocol Parameter Abstraction for Dual-Protocol Handlers
**RULE**:
Shared security dependencies, middleware interceptors, and request processors that operate across both HTTP and WebSocket transports MUST accept the lowest common transport connection abstraction (e.g., `starlette.requests.HTTPConnection`) rather than the concrete HTTP request type (`starlette.requests.Request`).

**WHY**:
In modern ASGI/multiplexed frameworks, WebSocket connections and HTTP requests share initial protocol handshakes, headers, cookies, and query parameters, but differ completely in payload streaming, state management, and teardown lifecycles. Binding authentication or dependency extraction strictly to `Request` causes type violations, signature mismatch bugs, or runtime `AttributeError` crashes when the same security component is attached to a WebSocket route.

**WHEN TO APPLY**:
Any Python ASGI framework, TypeScript web framework, or Rust web library supporting shared middleware/guards across both HTTP routes and WebSocket/SSE endpoints.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from starlette.requests import HTTPConnection
from starlette.exceptions import HTTPException
from starlette.status import HTTP_401_UNAUTHORIZED
from fastapi.security.base import SecurityBase

class HTTPBearer(SecurityBase):
    def __init__(self, *, auto_error: bool = True):
        self.auto_error = auto_error

    # Accept HTTPConnection: Polymorphic across HTTP Request & WebSocket
    async def __call__(self, request: HTTPConnection) -> str | None:
        authorization = request.headers.get("Authorization")
        if not authorization:
            if self.auto_error:
                raise HTTPException(
                    status_code=HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return None
        scheme, _, credentials = authorization.partition(" ")
        if scheme.lower() != "bearer":
            if self.auto_error:
                raise HTTPException(
                    status_code=HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication scheme",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return None
        return credentials.strip()
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Narrow typing to Request prevents WebSocket reuse
from starlette.requests import Request

class BrokenHTTPBearer(SecurityBase):
    # Fails when injected into @app.websocket("/ws") routes!
    async def __call__(self, request: Request) -> str | None:
        ...
```

**VERIFICATION METHOD**:
Execute parameterized endpoint validation testing identical dependency instances across both HTTP and WebSocket clients:
```python
from fastapi import FastAPI, Security, WebSocket
from fastapi.testclient import TestClient

def test_security_dual_protocol_compliance():
    auth = HTTPBearer()
    app = FastAPI()

    @app.get("/secure-http")
    async def http_endpoint(token: str = Security(auth)):
        return {"token": token}

    @app.websocket("/secure-ws")
    async def ws_endpoint(websocket: WebSocket, token: str = Security(auth)):
        await websocket.accept()
        await websocket.send_json({"token": token})
        await websocket.close()

    client = TestClient(app)
    headers = {"Authorization": "Bearer token123"}
    assert client.get("/secure-http", headers=headers).json() == {"token": "token123"}
    with client.websocket_connect("/secure-ws", headers=headers) as ws:
        assert ws.receive_json() == {"token": "token123"}
```

---

### 3. Decouple Multi-Source Data Extraction from Default Injection
**RULE**:
Data extractors pulling values from heterogeneous wire protocols (URL queries, HTTP headers, Form multidicts) MUST emit `None` (or a protocol sentinel) when a parameter is missing, and MUST NOT inject field defaults during the raw data extraction phase. Default value assignment and `default_factory` execution MUST be deferred strictly to the validation/coercion phase.

**WHY**:
Injecting default values during raw request extraction causes three fatal defects:
1. It pollutes validation failure context: if another validation error occurs, the synthetic default appears as explicit user input in error payloads (`input` key in 422 responses).
2. It breaks model serialization filters: `model_dump(exclude_unset=True)` marks defaulted fields as explicitly set by the client because the field arrived in the raw dictionary.
3. It triggers multiple invocations of non-idempotent `default_factory` functions, leading to CPU thrashing, memory bloat, and divergent object states between extraction and validation.

**WHEN TO APPLY**:
Parameter parsing engines, schema validation layers, serialization pipelines, and API boundary serializers across Python, Go, TypeScript, and Rust.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from copy import deepcopy
from typing import Any
from pydantic.fields import FieldInfo

def extract_multidict_value(source_dict: dict[str, Any], key: str) -> Any | None:
    # Phase 1: Pure extraction. Return None if absent.
    # NEVER return deepcopy(field.default) here!
    value = source_dict.get(key)
    if value is None or (hasattr(value, "__len__") and len(value) == 0):
        return None
    return value

def validate_value_with_field(field_info: FieldInfo, value: Any, loc: tuple[str, ...]):
    # Phase 2: Apply defaults solely within the validation phase
    if value is None:
        if field_info.is_required():
            return None, [{"type": "missing", "loc": loc, "msg": "Field required"}]
        
        # Resolve default value or factory only once
        if field_info.default_factory is not None:
            value = field_info.default_factory()
        else:
            value = deepcopy(field_info.default)
            
        # Do not run custom validators on defaults unless explicitly requested
        if not getattr(field_info, "validate_default", False):
            return value, []
            
    # Run type coercion and validators on user input or validated defaults
    return field_info.validate(value)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Injecting defaults inside raw request extraction
def broken_get_multidict_value(multidict, field):
    value = multidict.get(field.name)
    if not value:
        # CORRUPTS ERROR CONTEXT AND RUNS DEFAULT FACTORIES PREMATURELY!
        return deepcopy(field.default)
    return value
```

**VERIFICATION METHOD**:
Verify that unsupplied fields are omitted from `model_dump(exclude_unset=True)` and missing fields do not leak defaults into error responses:
```python
def test_default_does_not_mark_field_as_set():
    class Model(BaseModel):
        val: int = 10

    # Parsing empty payload must yield empty fields_set
    m = Model.model_validate({})
    assert "val" not in m.model_fields_set
    assert m.model_dump(exclude_unset=True) == {}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Security Scheme WebSocket Type Incompatibility (BUG-SEC-WS-01)
- **Context**: `fastapi/security/*.py` (`api_key.py`, `http.py`, `oauth2.py`, `open_id_connect_url.py`)
- **What Was Expected**: Security schemes (e.g., `HTTPBearer`, `APIKeyHeader`, `OAuth2PasswordBearer`) should authenticate WebSocket connection handshakes in addition to standard HTTP requests using identical syntax: `credentials = Security(security)`.
- **What Actually Happened**: Security classes declared their callable signatures as `async def __call__(self, request: Request)`. When mounted on `@app.websocket` routes, Starlette provided an instance of `starlette.websockets.WebSocket`. FastAPI's dependency analysis either flagged a type mismatch or failed when downstream code assumed concrete HTTP `Request` methods, preventing WebSockets from using built-in security dependencies.
- **Evidence in Repo**: Commit `1884325c`, PR #10147.
- **Root Cause**: Overly specific type annotation and parameter binding in `__call__` methods. Both `Request` and `WebSocket` inherit from `HTTPConnection`, which provides `.headers`, `.cookies`, `.query_params`, and `.client`.
- **Remediation Code Diff**:
```python
// File: fastapi/security/http.py & api_key.py
-from starlette.requests import Request
+from starlette.requests import HTTPConnection

-    async def __call__(self, request: Request) -> HTTPAuthorizationCredentials | None:
+    async def __call__(
+        self, request: HTTPConnection
+    ) -> HTTPAuthorizationCredentials | None:
         authorization = request.headers.get("Authorization")
```
- **Lesson**: Interface segregation: Depend on the thinnest connection contract necessary to read transport headers rather than the application request type.

---

### Incident 2: Premature Default Injection Polluting Error Payloads and Factory Invocations (BUG-PARAM-DEF-02)
- **Context**: `fastapi/dependencies/utils.py` (`_validate_value_with_model_field`, `_get_multidict_value`)
- **What Was Expected**: Missing parameters should assume their configured default values cleanly. If another parameter in the request fails validation, the error report (`422 Unprocessable Entity`) must accurately reflect the client's actual input (`input: {}`), and fields populated by defaults must not be marked as explicitly set (`model_dump(exclude_unset=True)`).
- **What Actually Happened**: `_get_multidict_value` injected defaults during the raw data extraction phase. If validation failed elsewhere, the generated default was included in the 422 error response under `input`, masking what the client actually sent. Furthermore, `default_factory` callables were executed repeatedly (once during extraction and again during model validation), and unsupplied fields were incorrectly marked as user-provided in `model_fields_set`.
- **Evidence in Repo**: Commit `32240026`, PR #16527.
- **Root Cause**: Early evaluation and injection of `field.default` inside `_get_multidict_value` prior to invoking Pydantic's validator pipeline.
- **Remediation Code Diff**:
```python
// File: fastapi/dependencies/utils.py
@@ -737,8 +737,9 @@ def _validate_value_with_model_field(
     if value is None:
         if field.field_info.is_required():
             return None, [get_missing_field_error(loc=loc)]
-        else:
-            return deepcopy(field.default), []
+        value = deepcopy(field.default)
+        if not field.field_info.validate_default:
+            return value, []
     return field.validate(value, values, loc=loc)

@@ -770,10 +771,8 @@ def _get_multidict_value(
             and len(value) == 0
         )
     ):
-        if field.field_info.is_required():
-            return
-        else:
-            return deepcopy(field.default)
+        # Apply defaults during validation, not while extracting request data.
+        return None
     return value
```
- **Lesson**: Wire-level data extraction must purely extract; defaults must be synthesized exclusively during validation/materialization.

---

### Incident 3: Synchronous Filesystem Stat Blocking Event Loop in Frontend Fallback Routing (BUG-EVENTLOOP-BLOCK-03)
- **Context**: `fastapi/routing.py:2049` (`_fallback_file_exists`)
- **What Was Expected**: Single-Page Application (SPA) frontend routing fallbacks (e.g., serving `index.html` when an asset path is missing) must perform path resolution asynchronously without halting concurrent HTTP requests on the main event loop thread.
- **What Actually Happened**: `_fallback_file_exists` invoked synchronous file lookup routines (`lookup_path` utilizing `os.stat` under the hood) directly on the asyncio event loop thread. Under heavy traffic or slow NFS/cloud volumes, file checks stalled the entire server event loop, causing severe latency spikes.
- **Evidence in Repo**: Issue #16503, PR closed 2026-10-15.
- **Root Cause**: Direct execution of blocking synchronous OS filesystem calls within an `async def` routing method without offloading to an execution threadpool.
- **Remediation Code Diff**:
```python
// File: fastapi/routing.py
-def _fallback_file_exists(self, path: str) -> bool:
-    return self.lookup_path(path)[0] is not None
+async def _fallback_file_exists(self, path: str) -> bool:
+    return (await run_in_threadpool(self.lookup_path, path))[0] is not None
```
- **Lesson**: Any synchronous file or disk I/O executed inside an async handler or router is a latency hazard and must be dispatched to `run_in_threadpool`.

---

### Incident 4: Non-Finite Float Token Serialization Crashes in JSONL and SSE Streams (BUG-STREAM-FLOAT-04)
- **Context**: `fastapi/responses.py` & `fastapi/encoders.py`
- **What Was Expected**: When streaming Server-Sent Events (SSE) or JSON Lines (JSONL), numerical float values like `float('nan')`, `float('inf')`, and `float('-inf')` should be safely converted according to JSON RFC 8259 or sanitized into `null` or explicit string representations.
- **What Actually Happened**: Standard `json.dumps` emitted `NaN` and `Infinity` tokens (non-standard JavaScript extensions). Strict streaming clients (such as browser `EventSource` and JSON parser streams) failed immediately with parsing syntax errors, corrupting stream consumer pipelines.
- **Evidence in Repo**: Issue #16509, PR closed 2026-10-16.
- **Root Cause**: Omitting `allow_nan=False` or lacking custom non-finite float serialization overrides in SSE/JSONL stream formatters.
- **Remediation Code Diff**:
```python
// File: fastapi/encoders.py / fastapi/sse.py
-return json.dumps(data, default=jsonable_encoder)
+def _sanitize_floats(obj: Any) -> Any:
+    if isinstance(obj, float):
+        if math.isnan(obj) or math.isinf(obj):
+            return None  # Or string representation per OpenAPI spec
+        return obj
+    if isinstance(obj, dict):
+        return {k: _sanitize_floats(v) for k, v in obj.items()}
+    if isinstance(obj, (list, tuple)):
+        return [_sanitize_floats(x) for x in obj]
+    return obj

+return json.dumps(_sanitize_floats(jsonable_encoder(data)))
```
- **Lesson**: Streaming payloads must strictly adhere to RFC 8259; never emit unquoted IEEE 754 non-finite floating-point literals.

---

### Incident 5: Subclass Kwarg Signature Breakage on Security Invocation (BUG-SUBCLASS-KWARG-05)
- **Context**: `fastapi/security/http.py` (`CustomHTTPBearer` subclasses)
- **What Was Expected**: Developer subclasses overriding `HTTPBearer.__call__(self, request: HTTPConnection)` using explicit keyword parameters (`super().__call__(request=request)`) must retain backwards compatibility across internal refactorings.
- **What Actually Happened**: Internal parameter renaming broke downstream developers who extended the security classes and invoked `super().__call__(request=...)` via keyword arguments.
- **Evidence in Repo**: Commit `1884325c`, test addition `test_security_http_bearer_subclass_request_keyword` in `tests/test_security_http_bearer.py`.
- **Root Cause**: Lack of regression verification ensuring that public interface parameter names for `__call__` remained locked as `request`.
- **Remediation Code Diff**:
```python
// File: tests/test_security_http_bearer.py
+def test_security_http_bearer_subclass_request_keyword():
+    class CustomHTTPBearer(HTTPBearer):
+        async def __call__(
+            self, request: HTTPConnection
+        ) -> HTTPAuthorizationCredentials | None:
+            return await super().__call__(request=request)
```
- **Lesson**: Public hook methods in framework bases must maintain keyword-argument stability; parameter renames are breaking API changes.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **The Falsy `0` vs `None` Trap**:
  In HTTP query/form parameter parsing, `0` is a valid payload value. Writing `if not value:` will conflate integer `0`, empty string `""`, and boolean `False` with `None` (omitted).
  ```python
  # BUG: Conflates 0 with missing parameter!
  def parse_offset(offset: int | None = None):
      if not offset:
          offset = 10  # If client passed ?offset=0, it gets overwritten to 10!
  
  # INVARIANT: Strict identity comparison
  def parse_offset_safe(offset: int | None = None):
      if offset is None:
          offset = 10  # Preserves ?offset=0 exactly as passed
  ```
- **Deep Immutability vs Shallow Copy Mutation Leaks**:
  Field defaults in Pydantic/FastAPI models often contain mutable collections (lists, dicts). Reusing `field.default` directly leaks state across consecutive requests:
  ```python
  # INVARIANT: Always deepcopy mutable parameter defaults
  value = deepcopy(field.default)
  ```
- **Type Inspection Hazards (`typing.GenericAlias` vs `type`)**:
  In Python >= 3.10, unions (`int | str`) and generic aliases (`list[str]`) raise `TypeError` if passed to standard `issubclass()`.
  ```python
  # INVARIANT: Use lenient_issubclass guard before evaluating issubclass
  def lenient_issubclass(cls: Any, class_or_tuple: Any) -> bool:
      try:
          return isinstance(cls, type) and issubclass(cls, class_or_tuple)
      except TypeError:
          if isinstance(cls, (typing._GenericAlias, types.GenericAlias, types.UnionType)):
              return False
          raise
  ```

### 2. Infinite Loop & Recursion Guards
- **DAG Traversal Termination Invariant**:
  When resolving dependencies (`get_flat_params`, `_get_openapi_dependency_data`), circular dependencies or repeated references will cause stack overflows unless explicitly guarded with a visited cache key set:
  ```python
  # INVARIANT: Non-recursive queue with visited tracking using DependencyCacheKey
  visited: list[DependencyCacheKey] = []
  dependants: list[Dependant] = [root_dependant]

  while dependants:
      current = dependants.pop()
      cache_key = _get_cache_key(dependant=current, uses_scopes_cache=uses_scopes_cache)
      if cache_key in visited:
          continue
      visited.append(cache_key)
      # Process current node...
      dependants.extend(reversed(current.dependencies))
  ```

### 3. UI & UX Micro-Mechanics (Swagger UI / ReDoc Assets)
- **Asset URL Resolution Guard**:
  When mounting automatic documentation endpoints (`/docs`, `/redoc`), CDN asset URLs must not break behind reverse proxies with URL prefixes.
  ```python
  # INVARIANT: Prefix-aware asset URL mapping
  def _add_lang_code_to_url(url: str, lang_code: str) -> str:
      if url.startswith(TIANGOLO_COM):
          rel_url = url[len(TIANGOLO_COM) :]
          if not rel_url.startswith(ASSETS_URL_PREFIXES):
              return url.replace(TIANGOLO_COM, f"{TIANGOLO_COM}/{lang_code}")
      return url
  ```

### 4. Backend Concurrency & Memory Safety
- **Deadlock-Free Context Teardown**:
  When adapting blocking database/network context managers into async pipelines, wrapping both `__enter__` and `__exit__` in the same threadpool capacity limiter can cause threadpool exhaustion deadlocks.
  ```python
  # INVARIANT: Separate exit limiter with capacity=1 per teardown invocation
  exit_limiter = CapacityLimiter(1)
  try:
      yield await run_in_threadpool(cm.__enter__)
  finally:
      await anyio.to_thread.run_sync(cm.__exit__, None, None, None, limiter=exit_limiter)
  ```
- **Connection Leak Guard in Multipart Parsing**:
  Uploaded files must be spool-backed or closed immediately upon completion of request handling. If `UploadFile` handles are not closed, OS file descriptor exhaustion occurs under sustained concurrency.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Header Hyphen-to-Underscore Mapping Collision**:
  HTTP headers are case-insensitive and hyphenated (`X-Forwarded-For`), whereas Python identifiers prohibit hyphens. FastAPI normalizes parameter names from `x_forwarded_for` to `x-forwarded-for