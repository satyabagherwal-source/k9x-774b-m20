> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rmax-scrapy-redis-learnings.md`  
> **Source**: github ([https://github.com/rmax/scrapy-redis](https://github.com/rmax/scrapy-redis))  
> **Source Version**: `b4f333ae`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-18T07:28:48.275Z  
> **Learning ID**: `learn-github-rmax-scrapy-redis`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): rmax/scrapy-redis

---

## 1. Executive Forensic Architecture & System Mechanics

`scrapy-redis` replaces Scrapy’s in-memory, process-bound crawling engine with a distributed, Redis-backed architecture. In a vanilla Scrapy process, the request scheduler (`scrapy.core.scheduler.Scheduler`), the duplicate filter (`scrapy.dupefilters.RFPDupeFilter`), and the start URL feeds are bound to the heap of a single Python Twisted reactor event loop. `scrapy-redis` decouples state ownership across three boundaries:

```
                      +---------------------------------------+
                      |             Redis Server              |
                      |  (Centralized State & Task Broker)   |
                      +---------------------------------------+
                        |                 ^                 |
            BLPOP / RPOP|                 |ZADD / SADD      |LPUSH / RPUSH
         (start_urls &  |                 | (Fingerprints & | (Items / Scraped)
            Scheduled)  v                 |  Queued Reqs)   v
  +--------------------------+   +-------------------+   +--------------------+
  |      RedisSpider /       |   |   RFPDupeFilter   |   |   RedisPipeline    |
  |     RedisCrawlSpider     |   |                   |   |                    |
  | (Spider Engine Loop)     |   | (Set-Based Filter)|   | (Item Exporter)    |
  +--------------------------+   +-------------------+   +--------------------+
                |                          ^                        ^
                v                          |                        |
  +---------------------------------------------------------------------------+
  |                   Scrapy Engine & Twisted Reactor Slot                   |
  +---------------------------------------------------------------------------+
                                           |
                                           v
  +---------------------------------------------------------------------------+
  |                          Scheduler (Redis-Backed)                         |
  |     - PriorityQueue (ZSET with negative priority + MULTI/EXEC atomicity)  |
  |     - FifoQueue / LifoQueue (LIST with LPUSH / RPOP / BRPOP)              |
  |     - Idle Backoff & Spider Idle Polling Signal Interceptor               |
  +---------------------------------------------------------------------------+
```

### Architectural Subsystem Boundaries
1. **Queue Abstraction Layer (`scrapy_redis.queue`)**:
   Provides uniform interfaces (`push`, `pop`, `len`, `clear`) over Redis primitives:
   - `FifoQueue`: Backed by Redis `LIST` (`LPUSH` to ingest, `RPOP`/`BRPOP` to dequeue).
   - `LifoQueue`: Backed by Redis `LIST` (`LPUSH` to ingest, `LPOP`/`BLPOP` to dequeue).
   - `PriorityQueue`: Backed by Redis `ZSET` (`ZADD` with `-request.priority`). To pop with priority inversion avoidance and strict atomicity without native sorted set blocking pop, it executes a Redis transaction (`MULTI` -> `ZRANGE key 0 0` -> `ZREMRANGEBYRANK key 0 0` -> `EXEC`).
2. **Deduplication Filter (`scrapy_redis.dupefilter.RFPDupeFilter`)**:
   Replaces local 160-bit SHA1 hash tables with a Redis `SET`. Fingerprints are calculated from the canonicalized request (HTTP method, URL, normalized body, sorted query params) and checked via `SADD`. If `SADD` returns `0`, the request is discarded as a duplicate.
3. **Execution Coordinator (`scrapy_redis.scheduler.Scheduler`)**:
   Plugs directly into Scrapy's engine loop. Manages crawler startup (`open`), state hydration, persistence (`SCHEDULER_PERSIST`), and dynamic queue instantiation. Coordinates between the deduplicator and the priority queue. Intercepts Scrapy's `spider_idle` Twisted signal to poll Redis for new requests before allowing the spider engine to terminate.
4. **Connection Registry & Multi-Protocol Pool (`scrapy_redis.connection`)**:
   Manages the lifecycle of Redis client pools. Resolves settings into connection parameters, enforces pooling identity across spider components via canonical parameter hashing, and isolates compatibility across `redis-py` versions 4.x through 8.x, negotiating RESP2 vs RESP3 protocol handshakes.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Atomic Range-Removal for Priority Inversion-Free Dequeue
**RULE**:
When implementing a priority queue on top of a sorted set data store (such as Redis `ZSET`) lacking an atomic `ZPOPMIN`, dequeue operations MUST wrap `ZRANGE` and `ZREMRANGEBYRANK` inside an atomic transaction (`MULTI`/`EXEC` or Lua script) and MUST NOT perform un-pipelined sequential lookups followed by deletions.

**WHY**:
Without atomic execution, concurrent worker processes will execute `ZRANGE key 0 0` simultaneously, retrieve identical requests, and then both execute `ZREM`. This creates duplicate crawl operations, race conditions, and corrupted downstream counters. Furthermore, non-atomic deletion allows intermediate inserts to shift indices, leading to the accidental deletion of high-priority requests that were not returned to the worker.

**WHEN TO APPLY**:
Any distributed job scheduling system, task queue, or crawler scheduler operating against sorted sets, key-value stores, or non-relational distributed databases lacking atomic pop primitives.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# src/scrapy_redis/queue.py
def pop(self, timeout=0):
    """
    Pop the highest-priority request atomically.
    Sorted set ranks smallest score first; negative priority ensures highest priority has rank 0.
    """
    pipe = self.server.pipeline()
    pipe.multi()
    # Rank 0 is guaranteed to be the lowest score (-highest_priority)
    pipe.zrange(self.key, 0, 0).zremrangebyrank(self.key, 0, 0)
    results, count = pipe.execute()
    if results and count > 0:
        return self._decode_request(results[0])
    return None
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: TOCTOU race condition under multi-worker concurrency
def pop_unsafe(self):
    results = self.server.zrange(self.key, 0, 0)  # Worker A and Worker B get request X
    if results:
        # Race window: Worker B executes before Worker A removes;
        # Both workers process request X!
        self.server.zrem(self.key, results[0])
        return self._decode_request(results[0])
    return None
```

**VERIFICATION METHOD**:
Execute 10 concurrent worker processes popping from a single priority queue with 1,000 unique elements. Assert that exactly 1,000 distinct items are popped with zero duplicate items processed and that the final queue length is 0:
```python
import pytest
from concurrent.futures import ProcessPoolExecutor

def test_concurrent_priority_pop_invariant(redis_client, priority_queue):
    for i in range(1000):
        priority_queue.push(FakeRequest(priority=i, url=f"http://test.com/{i}"))
    
    with ProcessPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(_drain_queue_worker, priority_queue.key) for _ in range(10)]
        results = [item for f in futures for item in f.result()]

    assert len(results) == 1000
    assert len(set(results)) == 1000
    assert redis_client.zcard(priority_queue.key) == 0
```

---

### 2. Upstream Protocol Negotiation and Key Canonicalization Guard
**RULE**:
When wrapping external client libraries that undergo major protocol transition (e.g., RESP2 to RESP3 in `redis-py`), the wrapper configuration layer MUST normalize default/unspecified values to the *absence* of the key in client keyword arguments or pool connection keys, rather than assigning explicit `None` or hardcoding forward assumptions. Protocol specification settings MUST be verified against the installed driver’s runtime version before instantiation.

**WHY**:
Passing `protocol=None` into connection pool factories or hash-based pool registries causes two distinct failure modes:
1. `_make_pool_key` hashes `(url, {'protocol': None})` differently from `(url, {})`, defeating connection pool reuse across different crawler components (Scheduler, DupeFilter, Pipeline) and causing socket pool exhaustion.
2. In transitional drivers (`redis-py` 5–8), passing an explicit parameter or defaulting to a protocol that issues unhandled commands (such as `CLIENT MAINT_NOTIFICATIONS` in RESP3 on Redis 8.0.2) breaks connection setup silently or pollutes the `total_error_replies` metric.

**WHEN TO APPLY**:
Python libraries configuring network clients (Redis, HTTP/2, gRPC, Database engines) where client libraries undergo semantic version shifts in protocol defaults.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# src/scrapy_redis/connection.py
from importlib.metadata import version

def _redis_major_version() -> int:
    return int(version("redis").partition(".")[0])

def _apply_protocol(settings, params: dict) -> None:
    proto = settings.get("REDIS_PROTOCOL", defaults.REDIS_PROTOCOL)
    if proto is None:
        # Normalize None to absence to prevent registry fragmentation
        # and allow installed redis-py driver defaults to govern safely.
        if params.get("protocol") is None:
            params.pop("protocol", None)
        return

    # Strict invariant enforcement: Booleans inherit from int in Python!
    if isinstance(proto, bool) or not isinstance(proto, int) or proto not in (2, 3):
        raise ValueError("REDIS_PROTOCOL must be an integer, either 2 or 3")
    
    if _redis_major_version() < 5:
        raise ValueError("REDIS_PROTOCOL requires redis-py >= 5.0")
        
    params["protocol"] = proto
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Blind parameter assignment and lack of bool check
def _apply_protocol_unsafe(settings, params):
    # Fails if proto is True (since isinstance(True, int) is True in Python)
    # Fails by polluting params with protocol=None, splitting shared connection pools
    proto = settings.get("REDIS_PROTOCOL")
    params["protocol"] = proto  # pool key becomes hash(..., protocol=None)
```

**VERIFICATION METHOD**:
Assert via automated unit test that default settings yield dictionaries completely devoid of `"protocol"` keys, and assert that boolean inputs (`True`, `False`) raise `ValueError`:
```python
def test_protocol_normalization_and_boolean_rejection(monkeypatch):
    monkeypatch.setattr(connection, "_redis_major_version", lambda: 5)
    
    # 1. Absence check
    settings_default = Settings()
    params = connection._get_params_from_settings(settings_default)
    assert "protocol" not in params

    # 2. Boolean safety check (isinstance(True, int) trap)
    with pytest.raises(ValueError, match=r"integer.*2.*3"):
        connection._apply_protocol(Settings({"REDIS_PROTOCOL": True}), {})
```

---

### 3. Spider Signal-Driven Idle State Polling with Deadline Gate
**RULE**:
When an event-driven framework (such as Scrapy/Twisted) emits an engine-level idle signal indicating that scheduled tasks are exhausted, distributed consumer components MUST NOT perform indefinite synchronous blocking calls on foreign network sockets within the reactor thread, nor immediately terminate. Instead, they MUST catch the idle signal, query the broker with a strict non-blocking check or deadline-gated interval, reschedule engine polling via framework-native deferred loops, and terminate ONLY when an idle timeout invariant has been continuously satisfied.

**WHY**:
Executing blocking calls (like `BRPOP key 0`) inside the main Twisted reactor thread freezes the entire networking event loop: timers fail to fire, HTTP download connections time out, DNS queries hang, and metrics reporting stalls. Conversely, terminating immediately upon queue starvation causes distributed worker churn when an upstream crawler or scheduler has a slight latency spike before feeding new work.

**WHEN TO APPLY**:
Asynchronous crawler engines (Scrapy, asyncio, Twisted, Node.js worker pools) interfacing with external queuing backends (Redis, RabbitMQ, SQS, Kafka).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# src/scrapy_redis/spiders.py
from scrapy import signals
from scrapy.exceptions import DontCloseSpider

class RedisMixin:
    def setup_redis(self, crawler=None):
        if crawler is None:
            self.crawler = getattr(self, 'crawler', None)
        else:
            self.crawler = crawler
        
        # Intercept Scrapy's engine termination signal
        self.crawler.signals.connect(self.spider_idle, signal=signals.spider_idle)

    def spider_idle(self):
        """Called when Scrapy has no active requests in memory."""
        self.schedule_next_requests()
        # Raise DontCloseSpider to tell Twisted engine to keep running
        raise DontCloseSpider

    def schedule_next_requests(self):
        """Poll batch of requests without blocking the Twisted reactor."""
        for req in self.next_requests():
            self.crawler.engine.crawl(req, spider=self)

    def next_requests(self):
        # Non-blocking pop: uses lpop/spop or finite timeout, NEVER timeout=0 blocking
        use_set = self.settings.getbool('REDIS_START_URLS_AS_SET')
        fetch_one = self.server.spop if use_set else self.server.lpop
        found = 0
        while found < self.redis_batch_size:
            data = fetch_one(self.redis_key)
            if not data:
                break
            req = self.make_request_from_data(data)
            if req:
                yield req
                found += 1
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Blocking the event loop in an idle signal handler
def spider_idle_unsafe(self):
    # This freezes the Twisted reactor indefinitely!
    data = self.server.brpop(self.redis_key, timeout=0) 
    req = self.make_request_from_data(data[1])
    self.crawler.engine.crawl(req, spider=self)
```

**VERIFICATION METHOD**:
Simulate an empty Redis queue, trigger Scrapy's `spider_idle` signal, and assert that the reactor event loop continues cycling without blocking for >10ms, while verifying that `DontCloseSpider` is correctly raised until the shutdown conditions are met.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: RESP3 Connection Setup Incompatibilities & Shared Pool Identity Fragmentation (BUG-RESP3-01)
- **Context**: Redis client connection pooling subsystem (`src/scrapy_redis/connection.py`, `src/scrapy_redis/defaults.py`).
- **What Was Expected**: Setting Redis connection options or leaving them at default should produce a single shared connection pool instance per crawler, and support both RESP2 and RESP3 protocols under modern `redis-py` (v5 through v8).
- **What Actually Happened**: With `redis-py` 8 adopting RESP3 as default, connection handshakes began issuing unsupported notification commands (`CLIENT MAINT_NOTIFICATIONS`) against Redis 8.0.2 engines, which were silently rejected and triggered internal error counters. Furthermore, when callers set `protocol=None` or left it unconfigured, `_make_pool_key` treated explicit `None` as distinct from absent keys, fragmenting pool identity and spinning up duplicate connection pools per component.
- **Evidence in Repo**: Commit `b4f333ae`, PR #321, PR #324. Modified: `src/scrapy_redis/connection.py`, `tests/test_connection.py`.
- **Root Cause**: `_get_params_from_settings` copied default parameters containing explicit `None` keys into the pool dictionary. `_make_pool_key` canonicalizes dictionaries into sorted tuples. The tuple `(('protocol', None),)` differed from `()`, breaking cache lookups. In addition, `redis-py` version checks were missing, causing invalid parameter passing to older driver versions (<5.0).
- **Remediation Code Diff**:
```python
# src/scrapy_redis/connection.py
+def _redis_major_version() -> int:
+    return int(version("redis").partition(".")[0])
+
+def _apply_protocol(settings, params) -> None:
+    proto = settings.get("REDIS_PROTOCOL", defaults.REDIS_PROTOCOL)
+    if proto is None:
+        if params.get("protocol") is None:
+            params.pop("protocol", None)
+        return
+
+    if isinstance(proto, bool) or not isinstance(proto, int) or proto not in (2, 3):
+        raise ValueError("REDIS_PROTOCOL must be an integer, either 2 or 3")
+    if _redis_major_version() < 5:
+        raise ValueError("REDIS_PROTOCOL requires redis-py >= 5.0")
+    params["protocol"] = proto
...
-    if params.get("protocol") is None:
-        params.pop("protocol", None)
+    _apply_protocol(settings, params)
```
- **Lesson**: Connection pool keys must represent the canonical mathematical identity of the connection parameters. Default/unset options must be strictly stripped prior to hashing/keying. Driver capabilities must be guarded by runtime major version probing.

---

### Incident 2: Dupefilter Class Instantiation Contract Breakage (BUG-DUPEFILTER-02)
- **Context**: Scheduler and DupeFilter lifecycle initialization (`src/scrapy_redis/scheduler.py`).
- **What Was Expected**: `Scheduler` should be capable of operating with any standard Scrapy `BaseDupeFilter` subclass, including custom user dupefilters or built-in Scrapy dupefilters that only provide `from_settings(settings)` rather than `from_spider(spider)`.
- **What Actually Happened**: In `Scheduler.open(spider)`, the scheduler unconditionally called `load_object(self.dupefilter_cls).from_spider(spider)`. When a dupefilter implemented only `from_settings` (as permitted by Scrapy's specification for dupefilters), the crawler crashed during startup with an `AttributeError: type object 'CustomDupeFilter' has no attribute 'from_spider'`.
- **Evidence in Repo**: Commit `50b8c6f0`, PR #294. Modified: `src/scrapy_redis/scheduler.py`.
- **Root Cause**: Strict coupling to Scrapy-Redis’s internal `RFPDupeFilter` class method signature without polymorphically checking factory contracts supported by vanilla Scrapy (`from_settings` vs `from_spider`).
- **Remediation Code Diff**:
```python
# src/scrapy_redis/scheduler.py
@@ -37,6 +37,7 @@ def __init__(
         flush_on_start=False,
         queue_key=defaults.SCHEDULER_QUEUE_KEY,
         queue_cls=defaults.SCHEDULER_QUEUE_CLASS,
+        dupefilter=None,
         dupefilter_key=defaults.SCHEDULER_DUPEFILTER_KEY,
         dupefilter_cls=defaults.SCHEDULER_DUPEFILTER_CLASS,
@@ -72,6 +75,7 @@ def __init__(
         self.flush_on_start = flush_on_start
         self.queue_key = queue_key
         self.queue_cls = queue_cls
+        self.df = dupefilter
         self.dupefilter_cls = dupefilter_cls
@@ -105,6 +109,10 @@ def from_settings(cls, settings):
             if val:
                 kwargs[name] = val
 
+        dupefilter_cls = load_object(kwargs["dupefilter_cls"])
+        if not hasattr(dupefilter_cls, "from_spider"):
+            kwargs["dupefilter"] = dupefilter_cls.from_settings(settings)
+
         # Support serializer as a path to a module.
@@ -137,7 +145,8 @@ def open(self, spider):
                 f"Failed to instantiate queue class '{self.queue_cls}': {e}"
             )
 
-        self.df = load_object(self.dupefilter_cls).from_spider(spider)
+        if not self.df:
+            self.df = load_object(self.dupefilter_cls).from_spider(spider)
```
- **Lesson**: Factory loaders in plugin architectures must inspect the object's contract hierarchy (e.g. `hasattr(cls, 'from_spider')`) and provide fallback instantiation pipelines before invoking framework-specific constructors.

---

### Incident 3: Python 3 Bytes vs Str Buffer Traps in Spider Ingestion (BUG-PY3STR-03)
- **Context**: Start URL consumption and deserialization in `src/scrapy_redis/spiders.py`.
- **What Was Expected**: Spiders reading message payloads from Redis keys (via `LPOP` or `SPOP`) should seamlessly parse raw URL strings, HTTP request descriptors, or serialized JSON payloads across both Python 2 and Python 3 runtimes.
- **What Actually Happened**: In Python 3, `redis-py` returns raw `bytes` by default. `make_request_from_data` executed `if '://' in data:` directly against the Redis payload. Because `'://'` is a `str` literal, Python 3 raised `TypeError: 'str' does not support the buffer interface` or `TypeError: a bytes-like object is required, not 'str'`.
- **Evidence in Repo**: Issues #70, #79; Commits `1774e4fe`, `8125d632`. Modified: `src/scrapy_redis/spiders.py`, `src/scrapy_redis/utils.py`.
- **Root Cause**: Implicit assumption of Python 2's interchangeable `str`/`bytes` behavior. Binary data pulled from network sockets was evaluated against unicode strings without passing through a decoded canonicalization layer.
- **Remediation Code Diff**:
```python
# src/scrapy_redis/spiders.py & utils.py
+# src/scrapy_redis/utils.py
+def bytes_to_str(s, encoding='utf-8'):
+    """Returns a str if a bytes object is given."""
+    if six.PY3 and isinstance(s, bytes):
+        return s.decode(encoding)
+    return s

# src/scrapy_redis/spiders.py
 def make_request_from_data(self, data):
-    if '://' in data:
-        return Request(data, dont_filter=True)
+    formatted_data = bytes_to_str(data, self.redis_encoding)
+    if is_dict(formatted_data):
+        parameter = json.loads(formatted_data)
+    else:
+        return FormRequest(formatted_data, dont_filter=True)
```
- **Lesson**: Distributed data pulled over socket interfaces must be normalized at the I/O boundary. Never leak wire-protocol byte semantics into higher-level string parsing logic.

---

### Incident 4: Logger Variable Shadowing and Log Output Suppression (BUG-LOGDUP-04)
- **Context**: Duplication filter logging pipeline in `src/scrapy_redis/dupefilter.py`.
- **What Was Expected**: When a duplicate URL is detected, the logger should output either a debug entry (if `DUPEFILTER_DEBUG` is true) or a single warning notification explaining that subsequent duplicates will be silenced, followed by quiet filtering.
- **What Actually Happened**: The logger recorded the first duplicate request, but the notification string informing the operator that duplicate logging was disabled was immediately overwritten by variable re-assignment before emission.
- **Evidence in Repo**: Issue #75. File: `src/scrapy_redis/dupefilter.py`.
- **Root Cause**: Identical variable name (`msg`) was assigned twice in consecutive statements within the `elif self.logdupes:` block.
- **Remediation Code Diff**:
```python
# src/scrapy_redis/dupefilter.py
     elif self.logdupes:
         msg = ("Filtered duplicate request %(request)s"
                " - no more duplicates will be shown"
                " (see DUPEFILTER_DEBUG to show all duplicates)")
-        msg = "Filtered duplicate request: %(request)s"
         self.logger.debug(msg, {'request': request}, extra={'spider': spider})
         self.logdupes = False
```
- **Lesson**: Variable shadowing and re-assignment within logging branches indicates dead code paths and breaks operator visibility. Linting rules (`flake8` / `pylint`) must reject unconditional immediate reassignments.

---

### Incident 5: Deprecated Serializer API Incompatibility with Scrapy 2.6+ (BUG-REQSER-05)
- **Context**: Serializer serialization bridge in `src/scrapy_redis/queue.py`.
- **What Was Expected**: Request objects enqueued into Redis priority or FIFO queues should serialize reliably across all Scrapy versions from 1.8 to 2.12+.
- **What Actually Happened**: Scrapy deprecated and subsequently removed `scrapy.utils.reqser.request_to_dict`. Spiders running against modern Scrapy installations crashed with `ModuleNotFoundError: No module named 'scrapy.utils.reqser'` or raised deprecation warnings when calling the legacy function.
- **Evidence in Repo**: Commit `8125d632`, PR #230; Commit `cade7d30`, PR #246. Modified: `src/scrapy_redis/queue.py`.
- **Root Cause**: Direct reliance on private/deprecated Scrapy utility modules rather than invoking the canonical instance method `request.to_dict(spider=spider)` introduced on the `Request` object.
- **Remediation Code Diff**:
```python
# src/scrapy_redis/queue.py
-from scrapy.utils.reqser import request_to_dict, request_from_dict
+try:
+    from scrapy.utils.request import request_from_dict
+except ImportError:
+    from scrapy.utils.reqser import request_to_dict, request_from_dict

 def _encode_request(self, request):
     """Encode a request object"""
-    obj = request_to_dict(request, self.spider)
+    try:
+        obj = request.to_dict(spider=self.spider)
+    except AttributeError:
+        obj = request_to_dict(request, self.spider)
     return self.serializer.dumps(obj)
```
- **Lesson**: When bridging framework objects to persistent stores, prefer object-level serialization primitives (`obj.to_dict()`) over external utility functions, and wrap backward compatibility inside a duck-typing `try/except AttributeError` fallback.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Boolean Inheritance Hazard (`bool` is an `int`)**:
  In Python, `issubclass(bool, int)` is `True`. Any numerical guard such as `isinstance(val, int)` will evaluate to `True` when `val = True` or `val = False`.
  ```python
  # TRAP:
  proto = True
  if isinstance(proto, int) and proto in (2, 3):
      # True == 1, so this fails the (2, 3) test, BUT if the set was (0, 1),
      # True would pass as 1!
      pass

  # MANDATORY INVARIANT:
  if isinstance(proto, bool) or not isinstance(proto, int) or proto not in (2, 3):
      raise ValueError("REDIS_PROTOCOL must be an integer, either 2 or 3")
  ```
- **Falsy Conversion Trap on Numerical Scores & Counts**:
  When reading queue lengths or checking integer parameters, `0` is falsy.
  ```python
  # TRAP:
  limit = kwargs.get("limit")
  if not limit:  # Fails when limit is explicitly set to 0 (meaning infinite or no-op)
      limit = float("inf")

  # MANDATORY INVARIANT:
  limit = limit if limit is not None else float("inf")
  ```
- **Dictionary Key Mutation Leaks Across Component Instances**:
  `defaults.REDIS_PARAMS` is a shared module-level dictionary. Using `dict.update()` directly on default structures mutates global state across spiders.
  ```python
  # MANDATORY INVARIANT:
  params = defaults.REDIS_PARAMS.copy()  # Shallow copy baseline
  params.update(settings.getdict("REDIS_PARAMS"))
  ```

---

### 2. Infinite Loop & Recursion Guards
- **Queue Starvation & Microtask Loop Yielding**:
  In `RedisSpider.next_requests()`, consuming from Redis in a `while` loop without a break condition or count invariant freezes execution.
  ```python
  # src/scrapy_redis/spiders.py
  found = 0
  while found < self.redis_batch_size:
      data = fetch_one(self.redis_key)
      if not data:
          # Termination Proof: Queue is empty, break out immediately
          break
      req = self.make_request_from_data(data)
      if req:
          yield req
          found += 1
      # Loop invariant: found increments strictly on valid requests; empty breaks.
  ```
- **Twisted Reactor Idle Spin Lock Prevention**:
  If `spider_idle` fails to yield any new requests, raising `DontCloseSpider` continuously creates a 100% CPU busy-wait spin in Twisted's scheduler. The engine must incorporate exponential backoff or deadline gating (`idle_before_close`) to break the cycle:
  ```python
  # MANDATORY INVARIANT:
  if self.idle_before_close > 0:
      if self.idle_count * self.idle_interval >= self.idle_before_