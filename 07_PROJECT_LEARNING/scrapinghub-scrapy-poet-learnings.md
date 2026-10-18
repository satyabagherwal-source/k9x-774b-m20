> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/scrapinghub-scrapy-poet-learnings.md`  
> **Source**: github ([https://github.com/scrapinghub/scrapy-poet](https://github.com/scrapinghub/scrapy-poet))  
> **Source Version**: `e87c2d01`  
> **License**: BSD-3-Clause  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-18T07:28:57.035Z  
> **Learning ID**: `learn-github-scrapinghub-scrapy-poet`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): scrapinghub/scrapy-poet

---

## 1. Executive Forensic Architecture & System Mechanics

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                     SCRAPY ENGINE                                      │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Request (with Callback Type Annotations)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        scrapy_poet.InjectionMiddleware                                 │
│                                                                                        │
│  ┌───────────────────────┐   andi.plan()    ┌────────────────────────────────────────┐ │
│  │     scrapy-poet       │ ───────────────> │               Injector                 │ │
│  │   Request Analyzer    │                  │  - Dependency Graph Extraction         │ │
│  └───────────────────────┘                  │  - RulesRegistry Override Resolution   │ │
│                                             └───────────────────┬────────────────────┘ │
│                                                                 │                      │
│                                                                 ▼                      │
│                                             ┌────────────────────────────────────────┐ │
│                                             │           WeakKeyDictionary            │ │
│                                             │   (Per-Request Plan & Instance Cache)  │ │
│                                             └───────────────────┬────────────────────┘ │
│                                                                 │                      │
│                                                                 ▼                      │
│                                             ┌────────────────────────────────────────┐ │
│                                             │        PageObjectInputProviders        │ │
│                                             │  - HttpResponseProvider                │ │
│                                             │  - PageObject / DynamicProvider        │ │
│                                             └───────────────────┬────────────────────┘ │
└─────────────────────────────────────────────────────────────────┼──────────────────────┘
                                                                  │
                                            ┌─────────────────────┴────────────────────┐
                                            │ Twisted Deferred / asyncio Bridge        │
                                            │ (maybeDeferred_coro / deferred_from_coro)│
                                            └─────────────────────┬────────────────────┘
                                                                  ▼
                                            ┌──────────────────────────────────────────┐
                                            │ Spider Callback(response, page: PageCls) │
                                            └──────────────────────────────────────────┘
```

### The Problem Space
In traditional web scraping with Scrapy, spiders couple transport mechanics, data extraction logic, HTML parsing, session state, and target site quirks into a single procedural callback (`def parse(self, response)`). This creates tightly coupled scrapers that are difficult to unit test without firing HTTP requests or mocking the internal state of Scrapy's engine.

`scrapy-poet` decouples extraction logic from transport plumbing using the **Page Object Pattern** (via the `web-poet` standard) combined with **Type-Driven Inversion of Control (IoC)** (powered by the `andi` dependency injection engine).

### Boundary Decoupling & Injection Topology
1. **Signature Inspection**: The framework treats Scrapy callback signatures (`parse(self, response: DummyResponse, page: ProductPage)`) as formal dependency specifications.
2. **Provider Orchestration**: When a request enters the engine, `scrapy_poet.InjectionMiddleware` intercepts it before downloader dispatch. It asks the `Injector` to create an execution plan (`andi.Plan`).
3. **Download Optimization via `DummyResponse`**: If an inspection reveals that all requested dependencies can be resolved without Scrapy downloading the body (e.g., an external headless browser provider fetches the data, or cached storage resolves it), `scrapy-poet` swaps the network fetch for a synthetic `DummyResponse`, bypassing network I/O in the Scrapy engine.
4. **Lifecycle & Cache Scoping**: Dependencies and execution plans are strictly scoped to the lifecycle of the incoming `scrapy.http.Request` via `weakref.WeakKeyDictionary`. This guarantees garbage collection when the request cycle terminates, preventing engine memory leaks while enabling cross-provider dependency sharing within that request.
5. **Runtime Concurrency Bridging**: It connects Twisted's asynchronous event loop (`Deferred`) with Python's standard `asyncio` coroutines using custom resolution bridges (`maybeDeferred_coro`), enabling async page objects and async dependency providers to execute within Scrapy's Twisted reactor.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Weak-Key Snapshot Invalidation Invariant
**RULE**:
When caching an expensive plan or compilation tree keyed by an ephemeral request/context object in a `WeakKeyDictionary`, you MUST store a structural snapshot/hash of all mutable context inputs alongside the cached object, verify that snapshot on subsequent lookups, and evict/recompute if mutated mid-flight.

**WHY**:
In event-driven and pipeline systems (like Scrapy middleware, Express/FastAPI middlewares, or Netty handlers), context objects (e.g., `request.meta`) are mutable dictionaries shared across multiple filters and hooks. If Middleware A triggers plan generation for `request`, and Middleware B subsequently mutates `request.meta['inject']` to request dynamic dependencies, a naive lookup `request in self._cache` returns the stale plan. This results in missing dependencies, silent data omission, or `TypeError: missing required positional argument` when invoking the final target callable.

**WHEN TO APPLY**:
Apply in any dependency injection, request-scoped memoization, or compilation cache where the cache key is a long-lived or pipeline-shared mutable object containing secondary mutable state attributes.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import logging
from weakref import WeakKeyDictionary
from typing import Any, Tuple
import andi

logger = logging.getLogger(__name__)

class DependencyPlanner:
    def __init__(self, spider: Any):
        self.spider = spider
        # Tuple format: (compiled_plan, snapshot_of_mutable_state)
        self._plan_cache: WeakKeyDictionary[Any, Tuple[andi.Plan, Tuple[Any, ...]]] = WeakKeyDictionary()
        self._warned_mutation: bool = False

    def build_plan(self, request: Any) -> andi.Plan:
        # 1. Take an immutable snapshot of all inputs influencing the plan
        current_inject_snapshot = tuple(request.meta.get("inject", ()))

        # 2. Check existence AND state validity
        if request in self._plan_cache:
            cached_plan, cached_snapshot = self._plan_cache[request]
            if current_inject_snapshot == cached_snapshot:
                return cached_plan

            # 3. Handle state mutation mid-pipeline
            if not self._warned_mutation:
                logger.warning(
                    f"request.meta['inject'] changed between pipeline stages for {request.url!r}. "
                    f"Compile plans only after context mutation settles."
                )
                self._warned_mutation = True

        # 4. Rebuild and update cache with new snapshot
        fresh_plan = self._compile_plan(request)
        self._plan_cache[request] = (fresh_plan, current_inject_snapshot)
        return fresh_plan

    def _compile_plan(self, request: Any) -> andi.Plan:
        # Compilation logic using andi or reflection
        return andi.plan(request.callback, ...)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Blind object-identity caching over mutable entities
class BrokenPlanner:
    def __init__(self):
        self._plan_cache = {}  # Or WeakKeyDictionary

    def build_plan(self, request):
        if request in self._plan_cache:
            return self._plan_cache[request] # BUG: Returns stale plan if request.meta altered!
        
        plan = self._compile_plan(request)
        self._plan_cache[request] = plan
        return plan
```

**VERIFICATION METHOD**:
Automated unit test asserting plan identity preservation on identical inputs, and plan divergence when the mutable payload changes:
```python
def test_plan_cache_invalidation_on_context_mutation():
    planner = DependencyPlanner(spider=mock_spider)
    req = MockRequest(url="https://example.com", meta={"inject": [DepA]})
    plan1 = planner.build_plan(req)
    assert planner.build_plan(req) is plan1

    # Mutate context
    req.meta["inject"] = [DepB]
    plan2 = planner.build_plan(req)
    assert plan2 is not plan1
    assert DepB in plan2.dependencies
```

---

### 2. Polyphonic Async Result Conversion Invariant
**RULE**:
When bridging disparate asynchronous models (Twisted `Deferred` vs standard `asyncio.Future` / native coroutines vs raw values vs exception instances), you MUST explicitly branch on all 5 execution states: 1) Synchronous Exception, 2) Existing Native Deferred, 3) Native Coroutine / Future, 4) Failure instances, and 5) Synchronous Value.

**WHY**:
Frameworks like Twisted or Celery running asyncio integration often encounter third-party callables returning mixed outputs (a plain dict, a Twisted `Deferred`, an `asyncio.coroutine`, or a Twisted `failure.Failure`). Using naive wrappers like `twisted.internet.defer.maybeDeferred` breaks under native coroutines by wrapping the coroutine object itself as a successful result instead of scheduling it, deferring execution into oblivion without awaiting. Bare conversion functions that do not trap synchronous exceptions fail to package them into the failure pipeline.

**WHEN TO APPLY**:
In any hybrid runtime uniting Twisted and asyncio (e.g., Scrapy, Autobahn) or sync/async unified API surfaces.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import asyncio
import inspect
from typing import Callable, Any, ParamSpec
from twisted.internet.defer import Deferred, succeed, fail
from twisted.python import failure
from scrapy.utils.defer import deferred_from_coro

_P = ParamSpec("_P")

def maybeDeferred_coro(
    f: Callable[_P, Any], *args: _P.args, **kw: _P.kwargs
) -> Deferred:
    """Execute callable and ensure returned value is always wrapped in a Twisted Deferred,
    safely awaiting coroutines and converting unhandled exceptions to failure.Failure.
    """
    try:
        result = f(*args, **kw)
    except Exception:
        # 1. Synchronous failure trapped into deferred failure
        return fail(failure.Failure(captureVars=Deferred.debug))

    # 2. Native Twisted Deferred returned
    if isinstance(result, Deferred):
        return result

    # 3. Native asyncio Future or native Coroutine returned
    if asyncio.isfuture(result) or inspect.isawaitable(result):
        return deferred_from_coro(result)

    # 4. Twisted Failure returned directly as an object
    if isinstance(result, failure.Failure):
        return fail(result)

    # 5. Synchronous scalar/object value
    return succeed(result)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Assuming Twisted's maybeDeferred handles asyncio awaitables
from twisted.internet import defer

def unsafe_dispatch(func, *args, **kwargs):
    # If func is `async def`, maybeDeferred will treat the coroutine object 
    # as a resolved synchronous value! The coroutine is never executed.
    return defer.maybeDeferred(func, *args, **kwargs)
```

**VERIFICATION METHOD**:
Run a parameterized test passing 1) sync function returning int, 2) sync function raising ValueError, 3) async coroutine returning int, 4) async coroutine raising ValueError, 5) function returning Deferred. Verify all yield expected resolution/failure in Twisted's test reactor:
```python
import pytest
from twisted.internet.defer import Deferred

@pytest.mark.asyncio
async def test_polyphonic_dispatch_matrix():
    d_sync = maybeDeferred_coro(lambda: 42)
    assert isinstance(d_sync, Deferred)
    assert (await d_sync.asFuture(asyncio.get_event_loop())) == 42

    async def async_fn(): return 100
    d_async = maybeDeferred_coro(async_fn)
    assert isinstance(d_async, Deferred)
    assert (await d_async.asFuture(asyncio.get_event_loop())) == 100
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Silent Dependency Plan Invalidation on Request Context Mutation (BUG-PLAN-CACHE-01)
- **Context**: `scrapy_poet/injection.py`, in `Injector.build_plan`
- **What Was Expected**: When a request's injection metadata (`request.meta["inject"]`) is modified dynamically by upstream spider middlewares or request pre-processors, `Injector.build_plan` must compute a new dependency injection plan corresponding to the updated requirements.
- **What Actually Happened**: The planner cached `andi.Plan` instances solely using `request` as the key in a `WeakKeyDictionary`. When middlewares updated `request.meta["inject"]` after the first plan generation pass, `build_plan()` retrieved the cached plan. As a result, the newly requested dynamic dependencies were completely ignored during injection, causing downstream argument errors or missing dependencies.
- **Evidence in Repo**: Commit `9b01d417`, PR #251. Files: `scrapy_poet/injection.py`, `tests/test_injection.py`.
- **Root Cause**: Shallow object identity memoization over a mutable host object (`scrapy.http.Request`) whose child structure (`request.meta["inject"]`) controls the derivation logic.
- **Remediation Code Diff**:
```python
@@ -112,6 +112,11 @@ def init_cache(self):
-        # weak_cache only
+        # Caches the result of build_plan() per request as (plan, inject_snapshot).
+        self._plan_cache: WeakKeyDictionary[Request, tuple[andi.Plan, tuple]] = (
+            WeakKeyDictionary()
+        )
+        self._warned_inject_changed = False
...
     def build_plan(self, request: Request) -> andi.Plan:
-        callback = get_callback(request, self.spider)
-        return andi.plan(callback, ...)
+        inject = tuple(request.meta.get("inject", []))
+        if request in self._plan_cache:
+            cached_plan, cached_inject = self._plan_cache[request]
+            if inject == cached_inject:
+                return cached_plan
+            if not self._warned_inject_changed:
+                logger.warning(
+                    f"request.meta['inject'] changed between calls for "
+                    f"{request.url!r}. Set its final value as early as "
+                    f"possible, so that e.g. request fingerprints can account "
+                    f"for it."
+                )
+                self._warned_inject_changed = True
+        plan = self._build_plan(request)
+        self._plan_cache[request] = (plan, inject)
+        return plan
```
- **Lesson**: Keys in dependency caches cannot be decoupled from their configuration attributes. Whenever the payload of a mutable container dictates cache output, tuple-snapshot the payload inside the cache value and evaluate parity before hit confirmation.

---

### Incident 2: Reactor Freeze on Coroutine Dispatch in Scrapy 2.14 Upgrade (BUG-ASYNC-DISPATCH-02)
- **Context**: `scrapy_poet/utils/__init__.py` and `scrapy_poet/injection.py`
- **What Was Expected**: Asynchronous providers and callbacks returning coroutines must seamlessly convert to Twisted `Deferred`s across all supported Scrapy runtime versions (from 2.7 to 2.14+).
- **What Actually Happened**: Scrapy 2.14 altered its internal deferred utilities. `scrapy_poet` previously relied on Scrapy's internal `maybeDeferred_coro`. Upstream refactoring in Scrapy caused attribute import failures or broken coroutine conversions, freezing execution chains where providers returned native awaitables.
- **Evidence in Repo**: Commit `69d74361`, PR #232. Files: `scrapy_poet/utils/__init__.py`, `scrapy_poet/injection.py`.
- **Root Cause**: Leaking downstream framework utility imports across major version upgrades instead of housing a self-contained, battle-hardened bridge implementation in `scrapy_poet.utils`.
- **Remediation Code Diff**:
```python
@@ -27,7 +27,7 @@
-from scrapy.utils.defer import deferred_from_coro, maybeDeferred_coro
+from scrapy.utils.defer import deferred_from_coro
...
+from scrapy_poet.utils import is_min_scrapy_version, maybeDeferred_coro

# In scrapy_poet/utils/__init__.py:
+def maybeDeferred_coro(
+    f: Callable[_P, Any], *args: _P.args, **kw: _P.kwargs
+) -> Deferred:
+    """Copy of defer.maybeDeferred that also converts coroutines to Deferreds."""
+    try:
+        result = f(*args, **kw)
+    except:  # noqa: B001,E722
+        return fail(failure.Failure(captureVars=Deferred.debug))
+
+    if isinstance(result, Deferred):
+        return result
+    if asyncio.isfuture(result) or inspect.isawaitable(result):
+        return deferred_from_coro(result)
+    if isinstance(result, failure.Failure):
+        return fail(result)
+    return succeed(result)
```
- **Lesson**: Do not import private or unstable upstream framework glue utilities across external ecosystems (Twisted <-> asyncio). Maintain a local, strictly typed adapter with comprehensive unit test coverage over all variant return types.

---

### Incident 3: `scrapy shell` Crash via Union Type Annotation Subclass Inspection (BUG-SHELL-INTROSPECT-03)
- **Context**: `scrapy_poet/injection.py`, in `is_scrapy_response_required`
- **What Was Expected**: Running `scrapy shell <url>` must launch the interactive debugging console without raising injection exceptions.
- **What Actually Happened**: The command crashed with:
  `TypeError: issubclass() arg 1 must be a class`.
  `scrapy shell` replaces the standard spider callback with `twisted.internet.defer.Deferred.callback`. The first argument annotation on this method in modern Twisted/typeshed is `Union[_DeferredResultT, Failure]`. `scrapy-poet` called `issubclass(first_parameter.annotation, DummyResponse)`. When `issubclass()` receives a `typing.Union` object (or `types.UnionType`), Python raises `TypeError`.
- **Evidence in Repo**: Issue #140 and Issue #92. PR resolving inspection guards.
- **Root Cause**: Passing raw reflection type annotations (`inspect.Parameter.annotation`) directly to `issubclass()` without verifying `isinstance(annotation, type)` or handling `typing.get_origin()`.
- **Remediation Code Diff**:
```python
# Unsafe Inspection:
- if issubclass(first_parameter.annotation, DummyResponse):
-     return False

# Hardened Inspection:
+ annotation = first_parameter.annotation
+ if isinstance(annotation, type) and issubclass(annotation, DummyResponse):
+     return False
+ # Also account for potential None, typing.Union, or special forms
+ origin = get_origin(annotation)
+ if origin is not None and isinstance(origin, type) and issubclass(origin, DummyResponse):
+     return False
```
- **Lesson**: Never pass type annotations directly into `issubclass()` or `isinstance()`. An annotation can be a string (from `from __future__ import annotations`), a Union, `Any`, `TypeVar`, or forward reference. Guard with `isinstance(annotation, type)` first.

---

### Incident 4: Robots.txt & Media Pipeline Silent Starvation via False Callback Analysis (BUG-ROBOTS-STARVE-04)
- **Context**: `scrapy_poet/injection.py` and `RobotsTxtMiddleware` / `FilesPipeline`
- **What Was Expected**: Engine requests dispatched without explicit callbacks (defaulting to the spider's `parse` method internally) or internal middleware requests (like `robots.txt` fetches or `FilesPipeline` media downloads) must never have their downloads bypassed.
- **What Actually Happened**: When a spider defined `def parse(self, response: DummyResponse)`, `scrapy-poet` inspected the callback. For internal requests (such as `RobotsTxtMiddleware` fetching `robots.txt`), Scrapy created `Request(url)` without setting a callback. By default, Scrapy set `request.callback = None`, which defaulted resolution to `spider.parse`. The injector inspected `spider.parse`, saw `DummyResponse`, concluded that no HTTP response was required, and bypassed the download. As a result, `robots.txt` and images were never downloaded.
- **Evidence in Repo**: Issue #48, commit introducing `NO_CALLBACK` and explicit internal request detection.
- **Root Cause**: Assuming that every request whose target callback defaults to `parse` is actually intended for the user's `parse` logic, failing to distinguish between engine-internal requests and spider-user requests.
- **Remediation Code Diff**:
```python
# Introduce NO_CALLBACK sentinel awareness:
try:
    from scrapy.http.request import NO_CALLBACK  # Available Scrapy >= 2.8
except ImportError:
    NO_CALLBACK = None

def is_scrapy_response_required(self, request: Request) -> bool:
    # If the request callback is explicitly NO_CALLBACK or marked as an internal download,
    # never suppress Scrapy's downloader!
    if request.callback is NO_CALLBACK:
        return True
    
    # Internal pipeline flag checks
    if request.meta.get("_scrapy_poet_internal"):
        return True
        
    callback = get_callback(request, self.spider)
    # Perform strict parameter analysis...
```
- **Lesson**: Implicit default behavior (e.g., fallback to `self.parse`) is dangerous when middleware inspects callables to modify transport mechanics. Use explicit sentinels (`NO_CALLBACK`) to differentiate between "unspecified callback intended for fallback" and "engine internal operation that must not be intercepted."

---

### Incident 5: False-Positive Generator Assertion in Test Shield (BUG-TEST-NOOP-05)
- **Context**: `tests/test_web_poet_rules.py`, in `assert_deps`
- **What Was Expected**: The test utility `assert_deps` was intended to validate that built instances exactly matched the expected dependency classes, failing the test suite if an unexpected class or missing dependency occurred.
- **What Actually Happened**: The assertion was written as a generator expression inside an expression that evaluated to truthy without iterating or evaluating all elements:
  `assert (isinstance(item, expected) for item, expected in pairs)`
  In Python, any generator object `(<genexpr>)` evaluates to `True` in a boolean context! The test was a total no-op and passed even when dependencies were completely corrupted or missing.
- **Evidence in Repo**: Issue #181, commit `4f5868ef`.
- **Root Cause**: Using a generator expression directly inside `assert` without enclosing it in `all(...)` or consuming it via a list comprehension.
- **Remediation Code Diff**:
```python
- # Buggy no-op assertion:
- assert (isinstance(item, expected_cls) for item, expected_cls in zip(items, expected))

+ # Concrete verification:
+ assert all(isinstance(item, expected_cls) for item, expected_cls in zip(items, expected))
+ # Or explicit structural comparison:
+ assert [type(item) for item in items] == list(expected)
```
- **Lesson**: Linters (`ruff` / `flake8-bugbear` rule `B011` / `B028`) must enforce that generator expressions inside `assert` statements are rejected during CI. A bare generator in an `assert` statement is always a bug.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
- **Class Parameter Annotation Inspection**:
  When using `andi.CustomBuilder`, `result_class_or_fn` can be a function, class, or callable factory. Direct assignment to a typed variable causes static analysis failures under strict mypy:
  ```python
  # Unsafe:
  result_cls: type = cls.result_class_or_fn  # Incompatible types in assignment
  
  # Micro-Syntax Invariant:
  result_cls: type = cast("type", cls.result_class_or_fn)
  ```
- **String Annotation Resolution Traps (`from __future__ import annotations`)**:
  When `from __future__ import annotations` is active, `inspect.signature(fn).parameters[name].annotation` returns a string representation (`"MyPage"`), not the class object. In `scrapy-poet`, annotations MUST be resolved via `typing.get_type_hints(fn)` using the function's global namespace, never read directly from `param.annotation`.
- **Falsy Metadata Precedence Hazard**:
  Checking if dynamic injection was declared:
  ```python
  # DANGEROUS:
  inject = request.meta.get("inject") or []  # Fails if inject was passed as an empty tuple/set or custom falsy object
  
  # SAFE:
  inject = tuple(request.meta.get("inject", ()))
  ```

### 2. Infinite Loop & Recursion Guards
- **Mutual Overrides Dependency Resolution Guard**:
  When users configure `ApplyRule(A, instead_of=B)` and `ApplyRule(B, instead_of=A)`, naive graph traversal enters infinite recursion during dependency resolution.
  - *Invariant Proof*: The rules registry resolution MUST maintain an `already_visited: set[type]` during class replacement traversal. If `current_cls in already_visited`, immediately terminate traversal and raise a deterministic `CircularDependencyError(f"Cycle detected: {already_visited}")`.
- **Subprocess Hang Guard in Test Mock Server (`scrapy_poet/utils/mockserver.py`)**:
  When spawning a Twisted mock server via `Popen`:
  ```python
  self.proc = Popen(
      [sys.executable, "-u", "-m", "scrapy_poet.utils.mockserver", self.resource, "--port", str(self.port)],
      stdout=PIPE,
      env={**os.environ, "PYTHONPATH": self.pythonpath},
  )
  # BLOCKING GUARD: The unbuffered flag `-u` is mandatory.
  # Without `-u`, Python buffers the stdout line, causing `readline()` to hang indefinitely
  # on parent process initialization!
  self.proc.stdout.readline()
  ```

### 3. UI & UX Micro-Mechanics (CLI & Developer Interface Guardrails)
- **Positional Command-Line Option Drift (`scrapy savefixture`)**:
  In `scrapy_poet/commands.py`, parsing arguments directly via `args[0]`, `args[1]` broke command documentation and failed silently on missing arguments with raw unformatted tracebacks.
  - *Invariant*: All CLI extensions extending Scrapy's `ScrapyCommand` MUST declare arguments through `add_options(parser)` using standard `argparse` positional specifications with clear `metavar`, ensuring syntax errors are caught before runtime execution:
  ```python
  def add_options(self, parser):
      super().add_options(parser)
      parser.add_argument("page_object", metavar="<page object class>", help="Import path...")
      parser.add_argument("url", metavar="<URL>", help="Target URL...")
      parser.add_argument("spider_name", metavar="[<spider name>]", nargs="?", help="Optional spider...")
  ```

### 4. Backend Concurrency & Memory Safety
- **WeakKeyDictionary Memory Leak Prevention**:
  `scrapy_poet` caches resolved page objects in `WeakKeyDictionary[Request, dict]`.
  - *TOCTOU Hazard*: Storing a strong back-reference from the cached instance to the `Request` object destroys `WeakKeyDictionary` garbage collection! If `instance.request = request`, a cyclic strong reference exists: `request -> WeakKeyDictionary -> dict -> instance -> request`. The request is never deallocated, exhausting RAM during long crawl jobs.
  - *Invariant*: Injected instances stored in request caches MUST NOT retain strong references to the request unless wrapped in `weakref.ref` or cleared during response de-allocation.
- **Twisted Reactor Main-Thread Concurrency Invariant**:
  When using `time_machine` or sleep mechanisms inside test harnesses, never invoke blocking OS sleep (`time.sleep`) on the Twisted reactor thread. You must use `twisted.internet.task.deferLater` or `asyncio.sleep` to avoid blocking network packet scheduling across concurrent test spiders.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Spider Parameter Null Pointer Defense**:
  In Scrapy, callbacks can be static methods, external functions, or instance methods. When resolving a method's provider bindings:
  ```python
  # DEFECTIVE:
  callback = getattr(spider, request.callback) # Crashes if request.callback is a callable, None, or string
  
  # SAFE EXTRACTION:
  def get_callback(request: Request, spider: Spider) -> Callable:
      if request.callback is None:
          return getattr(spider, "parse")
      if callable(request.callback):
          return request.callback
      return getattr(spider, request.callback)
  ```
- **Undeclared Exception Trapping in `PageObjectInputProvider`**:
  If a provider raises an unhandled exception during async resolution, failure to tag it with the failed dependency class blinds the developer to which graph node failed. Providers MUST wrap internal failures inside `ProviderError` with the explicit dependency type name.

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
The architecture is structured as a pipeline interceptor decoupled into 4 distinct layers:
1. **Scrapy Integration Layer** (`_addon.py`, `downloadermiddlewares.py`, `spidermiddlewares.py`): Plugs into Scrapy's lifecycle via modern Addon interfaces (`Addon.update_settings`), dynamically configuring priorities (e.g., `InjectionMiddleware: 543`, `RetryMiddleware: 275`).
2. **IoC Core** (`injection.py`): Hosts `Injector`. It leverages `andi` to analyze type signatures, queries the `RulesRegistry`, creates an optimal linear construction plan, and executes builders.
3. **Provider Layer** (`page_input_providers.py`): Self-contained data suppliers (`PageObjectInputProvider`) declaring `provided_classes`.
4. **Data Normalization Layer** (`utils/__init__.py`): Bidirectional translation between Scrapy primitives (`Request`, `Response`, `HtmlResponse`) and Web-Poet primitives (`HttpRequest`, `HttpResponse`, `HttpResponseHeaders`).

```
[ Scrapy Engine ] ──(Request)──> [ InjectionMiddleware ]
                                           │
                                  andi.plan(Callback)
                                           ▼
                                 [ RulesRegistry ] (Domain overrides)
                                           ▼
                                [ Input Providers ] (Async fetch / cache)
                                           ▼
                                [ Injected Instances ] ──> [ Callback Execution ]
```

### Dimension 2: Core Abstractions
- **`PageObjectInputProvider`**: Base class for all data producers. Subclasses declare `provided_classes: ClassVar[Set[Type]]` or implement `is_provided(type_) -> bool`.
- **`DummyResponse`**: Subclass of `scrapy.http.Response`. Serves as a type-system indicator: when a spider callback type-hints `response: DummyResponse`, the injector detects that Scrapy does not need to download the body via its standard engine pipelines.
- **`RulesRegistry`**: Maps requested page object contracts (e.g., `ProductPage`) to target implementations (e.g., `AmazonProductPage`) conditioned on URL patterns (`url-matcher`).
- **`DynamicDeps`**: Marker type indicating that dependency discovery must be deferred until runtime metadata is evaluated.

### Dimension 3: Error Handling
- **`MalformedProvidedClassesError`**: Raised during crawler boot if a provider declares an invalid `provided_classes` structure (e.g., returning a generator instead of a set or callable).
- **`UndeclaredProvidedTypeError`**: Raised if a provider returns an instance of a type it did not declare in its capabilities contract.
- **Retry Translation (`_get_retry_request_from_exception`)**: Catches `web_poet.exceptions.Retry` raised deep within page objects. Translates it into Scrapy's native retry middleware format via `scrapy.downloadermiddlewares.retry.get_retry_request`, maintaining retry counters and backoff schedules.

### Dimension 4: Testing
