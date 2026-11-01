> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/scrapy-scrapy-learnings.md`  
> **Source**: github ([https://github.com/scrapy/scrapy](https://github.com/scrapy/scrapy))  
> **Source Version**: `71e4b2b0`  
> **License**: BSD-3-Clause  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T08:04:02.488Z  
> **Learning ID**: `learn-github-scrapy-scrapy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): scrapy/scrapy

---

## 1. Executive Forensic Architecture & System Mechanics

Scrapy is an asynchronous, high-throughput web scraping and crawling framework designed around non-blocking event-driven I/O. Its core architectural topology orchestrates execution between an asynchronous engine, a prioritized request scheduler, a multi-transport downloader, pluggable pipeline middleware, and user spiders.

```
+---------------------------------------------------------------------------------------+
|                                    Scrapy Engine                                      |
|                                                                                       |
|   +--------------------+     Enqueue/Dequeue      +-------------------------------+   |
|   |     Scheduler      | <======================> | Downloader                    |   |
|   |  (PriorityQueue)   |                          |                               |   |
|   +--------------------+                          |   +-----------------------+   |   |
|             ^                                     |   | Downloader Middleware |   |   |
|             | Requests                            |   +-----------------------+   |   |
|             v                                     |               |               |   |
|   +--------------------+                          |   +-----------------------+   |   |
|   |       Spider       |                          |   | Slots & Delay Limiter |   |   |
|   +--------------------+                          |   +-----------------------+   |   |
|        ^          \ Responses                     |               |               |   |
|        |           v                              |   +-----------------------+   |   |
|   +--------------------+                          |   | Handler Dispatcher    |   |   |
|   |  Spider Middleware |                          |   | (H2, HTTP/1.1, FTP)   |   |   |
|   +--------------------+                          |   +-----------------------+   |   |
|             | Items                               |               |               |   |
|             v                                     +---------------+---------------+   |
|   +--------------------+                                          |                   |
|   |   Item Pipeline    |                                          | Network I/O       |
|   +--------------------+                                          v                   |
+-------------------------------------------------------------------+-------------------+
                                                                    |
                                                     [ Remote Web/FTP Servers ]
```

### 1. Engine Core & Event Loop Integration
Scrapy operates across a hybrid event model: historically grounded in the Twisted Reactor (specifically `twisted.internet.asynchronous.AsyncioSelectorReactor`), the modern core allows native Python `asyncio` coroutines (`async`/`await`) to coexist seamlessly with Twisted `Deferred` pipelines. The bridge is maintained via `deferred_from_coro` and `maybe_deferred_to_future` abstractions in `scrapy.utils.defer`. The Engine regulates execution via continuous ticking: it consumes `Request` instances yielded by spiders, places them into disk- or memory-backed priority queues inside the `Scheduler`, and queries the `Downloader` for capacity.

### 2. Downloader Subsystem, Slots, and Flow Control
The `Downloader` (`scrapy/core/downloader/__init__.py`) implements token-bucket and domain-isolated resource allocation through `Slot` abstractions:
- Concurrency isolation: Each target host or IP resolves to an allocated `Slot` with isolated limits (`CONCURRENT_REQUESTS_PER_DOMAIN`, `CONCURRENT_REQUESTS_PER_IP`).
- Per-slot delay and jitter: Delays are enforced by calculating a randomized deadline using uniform jitter (`delay * (1 + random.uniform(-jitter, jitter))`) stored as a wall-clock timestamp (`_DELAY_DEADLINE_META_KEY`) inside `request.meta`. Stamping timestamps into request metadata ensures delays persist across crawl freeze/thaw cycles when persisted to disk queues.
- Execution ring: Active requests are monitored in `Slot.active` and `Slot.transferring` sets. A periodic GC loop (`_SLOT_GC_INTERVAL = 60.0`) prunes dead or inactive slot references to prevent memory leaks in prolonged crawls.

### 3. HTTP/2 Agent, Connection Pooling, and Stream Multiplexing
HTTP/2 is decoupled from standard Twisted Agent primitives via a dedicated state machine wrapper (`scrapy/core/_http2/`):
- `H2ConnectionPool` (`agent.py`) indexes active `H2ClientProtocol` instances using a 4-tuple `ConnectionKey` (`(scheme, host, port, bind_address)`).
- Multiplexing vs Head-of-Line Blocking: A single TCP/TLS pipe multiplexes requests via RFC 7540 streams. If a request targets a host while a connection is still establishing, the request's `Deferred` is queued in `_pending_requests[key] = deque()`. Once the transport connects and settings are exchanged (`put_connection`), the deferreds are drained FIFO.
- Re-ordering and LRU Eviction: When a connection pool reaches capacity (`_limit`), `_enforce_limit()` identifies and terminates the least recently used idle connection. Crucially, connections with `active_streams > 0` are protected from eviction to prevent killing in-flight streams.

### 4. Protocol Negotiation & Stream Lifecycle
`H2ClientProtocol` (`protocol.py`) drives the `python-h2` pure-Python state machine:
- Stream ID generation: Enforces RFC 7540 Section 5.1.1 via `itertools.count(start=1, step=2)`, restricting client-initiated streams to odd integers.
- Concurrency gate: Active streams are capped by the minimum of local and remote peer settings: `min(self.conn.local_settings.max_concurrent_streams, self.conn.remote_settings.max_concurrent_streams)`.
- Request state validation: Before headers are transmitted, `Stream.check_request_url()` verifies that the incoming request netloc strictly matches the established connection target IP/host, intercepting host smuggling or connection poisoning across redirected requests.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Connection-Pool Multiplexing with Deferred-Chained Pending Queues & LRU Eviction Under Active Stream Constraints
**RULE**:
When implementing an asynchronous multiplexed connection pool (HTTP/2, gRPC, or database multi-channel gateways), the connection manager MUST queue downstream requests in a cancellable pending queue while connection handshakes are pending, and MUST NOT evict or terminate any connection during LRU capacity pruning if that connection has active in-flight multiplexed streams (`active_streams > 0`), regardless of pool capacity limits.

**WHY**:
In multiplexed protocols, multiple logical requests share a single physical connection. If a connection is terminated purely based on total connection pool size, all concurrent in-flight streams on that connection are abruptly aborted with `StreamReset` or `ConnectionClosed` errors. Furthermore, attempting to establish parallel physical connections to the same host while a TLS handshake is already pending causes connection racing, socket exhaustion, and remote rate-limiting.

**WHEN TO APPLY**:
Applies to any client-side asynchronous connection pool managing multiplexed protocols (HTTP/2, HTTP/3, WebSockets, or multiplexed IPC/RPC) where connections are persistent and handle concurrent requests over a single socket.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from collections import deque
from typing import TypeAlias
from twisted.internet import defer
from twisted.internet.defer import Deferred
from twisted.internet.endpoints import HostnameEndpoint

ConnectionKey: TypeAlias = tuple[bytes, bytes, int, tuple[str, int] | None]

class MultiplexedConnectionPool:
    def __init__(self, limit: int = 100) -> None:
        self._limit = limit
        self._connections: dict[ConnectionKey, Any] = {}
        self._pending_requests: dict[ConnectionKey, deque[Deferred[Any]]] = {}

    def get_connection(self, key: ConnectionKey, endpoint: HostnameEndpoint, factory_builder: Any) -> Deferred[Any]:
        # Invariant 1: If connection is currently being established, queue deferred
        if key in self._pending_requests:
            return self._queue_pending_request(key)

        # Invariant 2: Reuse existing active, non-closing connection and refresh LRU position
        conn = self._connections.get(key)
        if conn and not conn.closing:
            del self._connections[key]
            self._connections[key] = conn
            return defer.succeed(conn)

        # Invariant 3: Initiate new physical connection with LRU enforcement
        return self._new_connection(key, endpoint, factory_builder)

    def _queue_pending_request(self, key: ConnectionKey) -> Deferred[Any]:
        pending = self._pending_requests[key]
        # Cancelling the deferred automatically removes it from the pending queue
        d: Deferred[Any] = Deferred(pending.remove)
        pending.append(d)
        return d

    def _enforce_limit(self) -> None:
        if not self._limit:
            return
        surplus = len(self._connections) + len(self._pending_requests) + 1 - self._limit
        for key, conn in list(self._connections.items()):
            if surplus <= 0:
                break
            # Critical Guard: Never evict connections actively processing streams
            if conn.metadata.get("active_streams", 0) > 0:
                continue
            del self._connections[key]
            conn.close_idle()
            surplus -= 1

    def _new_connection(self, key: ConnectionKey, endpoint: HostnameEndpoint, factory_builder: Any) -> Deferred[Any]:
        self._enforce_limit()
        self._pending_requests[key] = deque()

        conn_lost_d: Deferred[None] = Deferred()
        factory = factory_builder(conn_lost_d)
        connect_d = endpoint.connect(factory)

        ret_d = self._queue_pending_request(key)
        connect_d.addCallback(self._on_connect_success, key, conn_lost_d)
        connect_d.addErrback(self._on_connect_failure, key)
        return ret_d

    def _on_connect_success(self, conn: Any, key: ConnectionKey, conn_lost_d: Deferred[None]) -> Any:
        self._connections[key] = conn
        conn_lost_d.addCallback(self._on_connection_lost, key, conn)

        pending = self._pending_requests.pop(key, None)
        while pending:
            d = pending.popleft()
            d.callback(conn)
        return conn

    def _on_connect_failure(self, failure: Any, key: ConnectionKey) -> None:
        pending = self._pending_requests.pop(key, deque())
        while pending:
            d = pending.popleft()
            d.errback(failure)

    def _on_connection_lost(self, _: None, key: ConnectionKey, conn: Any) -> None:
        if self._connections.get(key) is conn:
            del self._connections[key]
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Indiscriminate LRU pruning based on size without checking active streams,
# and opening redundant concurrent TCP connections while handshakes are in progress.
def bad_get_connection(self, key, endpoint):
    if len(self._connections) >= self.limit:
        # FATAL: Pops least recently used regardless of in-flight streams.
        # Causes in-flight streams to violently abort mid-download.
        lru_key, old_conn = self._connections.popitem(last=False)
        old_conn.transport.abortConnection() 

    # FATAL: Multiple simultaneous calls for the same key trigger multiple parallel
    # handshakes instead of queuing behind a single pending connection attempt.
    return endpoint.connect(self.factory)
```

**VERIFICATION METHOD**:
1. Unit test: Initialize pool with `limit=1`. Establish connection A and increment `active_streams = 2`. Request connection B for a different key. Assert that connection A remains in `_connections` and is NOT closed or aborted.
2. Unit test: Trigger 5 simultaneous calls to `get_connection()` for the same key. Verify that `endpoint.connect()` is executed exactly once, and that `len(_pending_requests[key]) == 5`.

---

### 2. HTTP/2 Pseudo-Header Construction Sequence and RFC 7540 Authority Precedence Guard
**RULE**:
When serializing HTTP/2 request headers into byte tuples for transmission across an HTTP/2 protocol stream, all pseudo-headers (headers starting with `:`) MUST precede regular HTTP headers, the `:path` pseudo-header MUST NOT be empty (defaulting to `/` or `*` for `OPTIONS`), and both `:authority` and `:scheme` MUST strictly match the negotiated transport peer's host and protocol, completely omitting `:scheme` and `:path` if and only if the method is `CONNECT`.

**WHY**:
RFC 7540 Section 8.1.2.1 mandates that pseudo-header fields MUST appear in the header block before regular header fields; receiving a pseudo-header after regular headers causes protocol implementations (such as Python `h2`, nghttp2, Envoy, Cloudflare) to immediately emit a `PROTOCOL_ERROR` stream reset or connection GOAWAY frame. Sending an empty `:path` causes remote web servers to immediately reject the request with HTTP 400.

**WHEN TO APPLY**:
Any HTTP/2 framing implementation, reverse proxy, scraper engine, or custom gateway constructing raw HTTP/2 frames.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from urllib.parse import SplitResult

def build_h2_headers(
    method: str,
    url_parts: SplitResult,
    custom_headers: dict[bytes, list[bytes]],
    body_len: int
) -> list[tuple[bytes, bytes]]:
    # Invariant 1: RFC 7540 Section 8.1.2.3 - Path MUST NOT be empty
    path = url_parts.path
    if url_parts.query:
        path += "?" + url_parts.query
    if not path:
        path = "*" if method == "OPTIONS" else "/"

    # Invariant 2: Pseudo-headers MUST come before all standard headers
    headers: list[tuple[bytes, bytes]] = [
        (b":method", method.encode("ascii")),
        (b":authority", url_parts.netloc.encode("ascii")),
    ]

    # Invariant 3: RFC 7540 Section 8.3 - :scheme and :path MUST be omitted for CONNECT
    if method != "CONNECT":
        headers.extend([
            (b":scheme", url_parts.scheme.encode("ascii")),
            (b":path", path.encode("ascii")),
        ])

    # Invariant 4: Explicit content length handling
    if b"content-length" not in {k.lower() for k in custom_headers}:
        headers.append((b"content-length", str(body_len).encode("ascii")))

    # Invariant 5: Append standard user headers after all pseudo-headers
    for name, values in custom_headers.items():
        if name.startswith(b":"):
            raise ValueError(f"User header cannot use reserved HTTP/2 prefix: {name!r}")
        for value in values:
            headers.append((name.lower(), value))

    return headers
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Commingling pseudo-headers with regular headers or allowing
# pseudo-headers to appear in arbitrary dictionary iteration order.
def bad_build_h2_headers(method, url_parts, user_headers):
    headers = []
    for k, v in user_headers.items():
        headers.append((k, v)) # FATAL: Regular headers placed before pseudo-headers
    headers.append((b":method", method.encode()))
    headers.append((b":path", url_parts.path.encode())) # FATAL: Empty path if url_parts.path == ""
    return headers
```

**VERIFICATION METHOD**:
Automated property test: Generate random HTTP methods (including `CONNECT` and `OPTIONS`), URLs with empty paths, and random header dictionaries. Assert that:
1. Every tuple `(k, v)` where `k.startswith(b":")` appears prior to any tuple where `not k.startswith(b":")`.
2. For empty paths, `:path` evaluates to `b"*"` (if `OPTIONS`) or `b"/"`.
3. If `method == "CONNECT"`, neither `b":path"` nor `b":scheme"` exist in the resulting list.

---

### 3. Ephemeral File-Backed Streaming with Exception-Safe Cleanup and Quota Guards
**RULE**:
When an asynchronous download handler streams network payloads directly to disk (`body_file`), temporary files MUST be created via `mkstemp()` with immediate descriptor closure (`os.close(fd)`), and if an unhandled exception or connection abort occurs during transfer, the ephemeral disk file MUST be unlinked immediately inside the failure unwinding path before re-raising the error.

**WHY**:
Streaming large binary payloads directly to disk avoids Out-Of-Memory (OOM) crashes in scraping crawlers. Leaving file descriptors open from `mkstemp()` causes file descriptor leaks that exhaust process OS limits. Failing to clean up partially written files on stream exceptions exhausts the host filesystem capacity over long crawl runs, and retried requests would reference corrupt or incomplete data.

**WHEN TO APPLY**:
All asynchronous file-streaming downloaders, item exporters, or chunked network-to-disk pipelines.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import os
from pathlib import Path
from tempfile import mkstemp
from typing import Any

async def download_to_file_guarded(handler: Any, request: Any) -> Any:
    temporary = request.meta.get("body_file") is True
    if temporary:
        # Invariant 1: Allocate unique temp file and immediately close the raw OS descriptor
        fd, temp_path = mkstemp(prefix="scrapy_tmp_")
        os.close(fd)
        request.meta["body_file"] = temp_path

    try:
        response = await handler.download_request(request)
        if not hasattr(response, "body_file"):
            raise TypeError(f"Handler {handler.__class__.__name__} failed to return a file-backed response.")
        return response
    except Exception as exc:
        # Invariant 2: Exception-safe cleanup of incomplete temporary files
        if temporary:
            body_file_path = Path(request.meta["body_file"])
            if body_file_path.exists():
                body_file_path.unlink()
            # Reset metadata so a retry receives a clean, new file
            request.meta["body_file"] = True
        raise exc
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Leaking file descriptors and leaving orphan files on failure.
async def bad_download_to_file(handler, request):
    if request.meta.get("body_file") is True:
        fd, path = mkstemp() # FATAL: fd is never closed, leading to EMFILE!
        request.meta["body_file"] = path
    
    # FATAL: If download_request fails, path remains on disk forever.
    # On 10,000 errors, thousands of orphaned temp files saturate the disk.
    return await handler.download_request(request)
```

**VERIFICATION METHOD**:
1. Unit test: Mock `handler.download_request` to raise an asynchronous `ConnectionResetError`. Execute `download_to_file_guarded(mock_handler, request)`. Verify that `Path(temp_path).exists() == False` and verify that `request.meta["body_file"] == True`.
2. Descriptor leak test: Iterate 500 error iterations and assert that the process open file descriptor count (`len(os.listdir('/dev/fd'))` or `psutil.Process().num_fds()`) remains strictly constant.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Pytest 9.2.0 Class Fixture Bound Method Deprecation Hazard & Staticmethod Decorator Ordering (BUG-PYTEST-FIXTURE-01)
- **Context**: Pytest test suite modernization in `pyproject.toml`, `tests/test_downloader_handler_twisted_ftp.py`, `tests/utils/bases/commands.py`, and `tests/utils/bases/download_handlers_http.py`.
- **What Was Expected**: Test suite must run cleanly under pytest 9.2.0 without emitting `PytestConfigWarning` or fixture scoping deprecation warnings when utilizing session-scoped and class-scoped fixtures inside base test classes.
- **What Actually Happened**: Pytest 9.2.0 deprecated instance methods acting as fixtures on classes without explicit `@classmethod` or `@staticmethod` decorators. Additionally, using `@staticmethod` above `@pytest.fixture` reversed decorator evaluation, preventing pytest from introspecting the fixture metadata correctly.
- **Evidence in Repo**: Commit `71e4b2b0`, PR #8423.
- **Root Cause**:
  1. Pytest introspects attributes at import/collection time. When `@pytest.fixture` was wrapped over `@staticmethod` (`@staticmethod` on top), the object in the class dictionary became a `staticmethod` descriptor rather than a fixture function, leading to fixture resolution anomalies in newer pytest engines.
  2. In `TestProjectBase`, the fixture `_proj_path_cached` was marked with `scope="session"`, yet received `self`. Because session fixtures outlive test class instances, binding `self` binds an instance that pytest does not instantiate for session-scoped runs, resulting in deprecation failures.
- **Remediation Code Diff**:
```python
// tests/test_downloader_handler_twisted_ftp.py
-    @staticmethod
     @pytest.fixture
+    @staticmethod
     def dh() -> Generator[FTPDownloadHandler]:
         crawler = get_crawler()
         dh = build_from_crawler(FTPDownloadHandler, crawler)

// tests/utils/bases/commands.py
 class TestProjectBase:
     """A base class for tests that may need a Scrapy project."""
 
-    project_name = "testproject"
+    project_name: ClassVar[str] = "testproject"
 
     @pytest.fixture(scope="session")
-    def _proj_path_cached(self, tmp_path_factory: pytest.TempPathFactory) -> Path:
+    @classmethod
+    def _proj_path_cached(cls, tmp_path_factory: pytest.TempPathFactory) -> Path:
         tmp_path = tmp_path_factory.mktemp("proj")
-        call("startproject", self.project_name, cwd=tmp_path)
-        return tmp_path / self.project_name
+        call("startproject", cls.project_name, cwd=tmp_path)
+        return tmp_path / cls.project_name
```
- **Lesson**: Pytest fixture decorators MUST be the outermost wrapper (`@pytest.fixture` above `@staticmethod` / `@classmethod`). When fixtures have class or session scopes on base classes, they MUST be decorated with `@classmethod` and operate on `cls` or typed `ClassVar`, never `self`.

---

### Incident 2: Twisted IDNA RFC 5891 Underscore & Emoji Domain Rejection in Web Crawling (BUG-IDNA-UNDERSCORE-02)
- **Context**: Subsystem `scrapy.core.downloader._idna_patch`, resolving hostnames across Twisted DNS resolver boundaries.
- **What Was Expected**: A web crawler scraping arbitrary internet links must successfully resolve domain names containing underscores (common in dev/ad domains, e.g. `foo_bar.example.com`) and internationalized emoji domains in both punycode (`xn--`) and raw UTF-8.
- **What Actually Happened**: Twisted delegates hostname encoding to the `idna` Python package, which strictly enforces IDNA 2008 (RFC 5891). This strict implementation rejects underscores with `idna.IDNAError` and disallows emoji labels even when already encoded in punycode, causing valid web requests to abort with unhandled exceptions.
- **Evidence in Repo**: `scrapy/core/downloader/_idna_patch.py`, addressing issues #4330 and #3321.
- **Root Cause**: Python's `idna` package rejects characters not conforming to the IDNA 2008 backward-incompatible specification. Conversely, Python's built-in standard library codec (`"string".encode("idna")`) implements IDNA 2003, which permits underscores and punycoded emoji domains. Twisted bound `_idnaBytes` and `_idnaText` globally at import time across multiple internal submodules (`twisted.internet._idna`, `_resolver`, `_sslverify`, `endpoints`).
- **Remediation Code Diff**:
```python
// scrapy/core/downloader/_idna_patch.py
+_HOSTNAME = re.compile(rb"[a-zA-Z0-9._\-]+\Z")

+def _safe_hostname_bytes(hostname: str) -> bytes:
+    try:
+        encoded = hostname.encode("idna")
+    except UnicodeError:
+        encoded = hostname.encode("ascii")
+    if not _HOSTNAME.match(encoded):
+        raise UnicodeError(f"invalid hostname: {hostname}")
+    return encoded

+def _patched_idna_bytes(text: str) -> bytes:
+    try:
+        return _original_idna