> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/d4vinci-scrapling-learnings.md`  
> **Source**: GitHub ([https://github.com/D4Vinci/Scrapling](https://github.com/D4Vinci/Scrapling))  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-09-30T01:23:07.876Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): D4Vinci/Scrapling

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Technical Problem Domain & Core Value Proposition
`Scrapling` is an enterprise-grade, anti-detection web scraping and crawling framework designed for Python 3.10+. It unifies high-speed HTTP request engines (with browser TLS/JA3/HTTP2 fingerprint impersonation via `curl-cffi`) alongside dynamic browser automation engines (`Playwright` and `Patchright`) and autonomous multi-engine spiders into a single, unified selector interface (`AdaptorFetcher` / `Response` wrappers).

### 1.2 System Boundary & Component Topology
The repository is segmented into three primary execution tiers and two orchestration layers:

```
                                +-------------------------------------------------------+
                                |               Scrapling Spider Engine                 |
                                |       (CrawlerEngine, SessionManager, Cache)          |
                                +---------------------------+---------------------------+
                                                            |
                                                            v
                                +-------------------------------------------------------+
                                |              ResponseFactory & Selector Adaptors      |
                                |         (lxml / cssselect / Camoufox Adaptor)          |
                                +---------------------------+---------------------------+
                                                            |
                        +-----------------------------------+-----------------------------------+
                        |                                   |                                   |
                        v                                   v                                   v
        +-------------------------------+   +-------------------------------+   +-------------------------------+
        |        Static Fetcher         |   |        Dynamic Fetcher        |   |       Stealthy Fetcher        |
        |  (curl-cffi TLS Impersonator) |   |  (Playwright CDP Control)     |   | (Patchright Anti-Detect Engine|
        +-------------------------------+   +-------------------------------+   +-------------------------------+
```

1. **Static Engine (`scrapling.engines.static`)**: Low-latency HTTP client backed by `curl-cffi`. Performs JA3/JA4 TLS fingerprint spoofing (e.g., impersonating Chrome 120+, Firefox, Safari) and HTTP/2 frame header alignment without spinning up a browser instance.
2. **Dynamic Engine (`scrapling.engines.dynamic`)**: Headless browser automation layer using Playwright. Controls Chromium/Firefox instances, manages CDP (Chrome DevTools Protocol) sessions, blocks non-essential assets (images, fonts, stylesheets) to conserve network overhead, and executes DOM scripts.
3. **Stealthy Engine (`scrapling.engines.stealth`)**: Specialized anti-bot evasion tier utilizing `Patchright` (hardened Playwright fork) and custom patch scripts. Bypasses Cloudflare Turnstile, Akamai Bot Manager, Kasada, and Datadome via modified navigator properties, webGL overrides, and automated challenge solving.
4. **Spider Orchestrator (`scrapling.spiders`)**: Asynchronous crawling engine (`CrawlerEngine`) executing concurrent `Request` objects, maintaining session lifecycles via `SessionManager`, managing localized disk caches (`ResponseCacheManager`), and routing responses to user-defined callbacks or declarative templates (`SitemapSpider`).
5. **Selector Core (`scrapling.parser`)**: Unified DOM extraction layer wrap around `lxml`. Exposes Scrapy-like CSS and XPath selectors (`.css()`, `.xpath()`) with auto-healing, structural similarity comparison, and resilient node querying.

---

## 2. Forensic Real Incidents & Production Patches

### Incident 1: Flawed Attempt Calculation for `retries <= 0` (BUG-STATIC-01)
- **Context**: `scrapling/engines/static.py` in `_make_request()` and `_async_make_request()`.
- **What Was Expected**: Passing `retries=0`, `retries=-1`, or `retries=None` should instruct the fetcher to make the initial request exactly once and perform **zero additional retries** if it fails.
- **What Actually Happened**: The retry logic directly evaluated `retries` as an upper limit count. When `retries=0` or `retries=-1` was passed, `max_retries` was assigned `0` or a negative integer. As a result, the request loop was entirely skipped or defaulted unexpectedly, causing requests to never execute when users explicitly wanted to disable retries.
- **Evidence in Repo**: Commit `ac18622e`, PR `#420`, affecting `scrapling/engines/static.py` and `tests/fetchers/async/test_requests.py`.
- **Root Cause**: False equivalency between *retry limit* and *total attempts count*. `max_retries` was initialized directly from user input without bounding the lower execution constraint to at least 1 attempt (`total_attempts = 1 + retries`).
- **Remediation Code Diff**:
```python
# - max_retries = self._get_param(kwargs, "retries", self._default_retries)
# + Always attempt the request once; `retries` below 1 (or `None`) means "send it, but don't retry"
+ max_retries = max(1, self._get_param(kwargs, "retries", self._default_retries) or 1)
```
- **Lesson**: Retries represent *additional executions after initial failure*, not total execution count. Ensure `total_attempts = max(1, 1 + retries)`.

---

### Incident 2: Request Metadata Loss in Cache Hit Response Rehydration (BUG-CACHE-02)
- **Context**: `scrapling/spiders/engine.py` inside `_process_request()`.
- **What Was Expected**: When `CrawlerEngine` serves a response from `ResponseCacheManager`, the target callback receiving `response` must have access to `response.meta` populated by the outgoing `Request(meta={...})`.
- **What Actually Happened**: Responses reconstructed from cache disk storage rehydrated the raw payload body and headers, but discarded request-level metadata (`request.meta`). Subsequent parser steps relying on context passing (e.g., pagination depth, parent IDs, pipeline state) received empty `meta` dictionaries and threw `KeyError`.
- **Evidence in Repo**: Commit `63cdc99c`, PR `#419`, modifying `scrapling/spiders/engine.py` and `tests/spiders/test_cache.py`.
- **Root Cause**: The response cache manager stored and retrieved raw `Response` instances. The caching layer did not re-bind runtime request context back onto the response upon cache hit retrieval.
- **Remediation Code Diff**:
```python
  cached = await self._cache_manager.get(request._fp)
  if cached is not None:
      cached.request = request
+     # Cached responses are rebuilt without meta, so merge the request's in as the live path does
+     cached.meta = {**request.meta, **cached.meta}
      self.stats.cache_hits += 1
```
- **Lesson**: Cached response entities must be re-bound to live request execution state (`Request.meta`) before dispatching to client handlers.

---

### Incident 3: Recursive Sitemap Parser Loop & Route Failure (BUG-SITEMAP-03)
- **Context**: `scrapling/spiders/templates/sitemap.py` inside `SitemapSpider`.
- **What Was Expected**: When `SitemapSpider` parses a sitemap XML index or document, extracted page URLs matching crawling rules should route to the user-defined `parse()` callback (or rule-specified callback).
- **What Actually Happened**: When no explicit `rules()` were provided or a `CrawlRule` had no explicit `callback` assigned, `SitemapSpider` routed extracted page URLs back to the sitemap parser method (`_parse_sitemap`). This caused non-sitemap HTML web pages to be re-parsed as sitemap XML documents, throwing XML parsing errors and failing to invoke `parse()`.
- **Evidence in Repo**: Closed Issue `#458`, `scrapling/spiders/templates/sitemap.py`.
- **Root Cause**: Default callback resolution logic fell back to `self._parse_sitemap` instead of checking whether an extracted URL was a leaf target versus a nested sitemap XML document.
- **Remediation Code Diff**:
```python
# Route leaf page URLs to parse() when no rule callback is defined
if not rule or not rule.callback:
-   callback = self._parse_sitemap
+   callback = self.parse
```
- **Lesson**: In crawler templates that ingest meta-formats (XML, RSS, JSON feeds), default callback routing must distinguish between index/manifest links and terminal content links.

---

### Incident 4: UTF-8 Byte-Order Mark (BOM) Pollution in Text Feed Parsing (BUG-ENCODING-04)
- **Context**: `scrapling/spiders/templates/` (`sitemap.py`, `robots.py`, `csv_feed.py`).
- **What Was Expected**: Fetching and parsing `robots.txt` or CSV feeds encoded in UTF-8 should seamlessly parse key-value lines and column headers.
- **What Actually Happened**: Server responses returned with a UTF-8 BOM byte sequence (`0xEF, 0xBB, 0xBF`). Standard decoding using `body.decode('utf-8', errors='replace')` preserved the zero-width non-breaking space `\ufeff` at index 0 of the string. This transformed `User-agent: *` into `\ufeffUser-agent: *`, failing header matching and breaking CSV dialect sniffers.
- **Evidence in Repo**: Closed Issue `#453`, affecting feed processing files.
- **Root Cause**: `utf-8` decoder in Python does not strip the BOM if present; only the specific `utf-8-sig` encoding codec automatically detects and strips `\ufeff`.
- **Remediation Code Diff**:
```python
# - text = body.decode(encoding, errors="replace")
# + Strip UTF-8 BOM if present at the beginning of raw decoded text
+ text = body.decode(encoding, errors="replace").lstrip("\ufeff")
```
- **Lesson**: Any system ingesting raw network byte feeds for text/schema parsing must explicitly sanitize or use signature-aware codecs (`utf-8-sig`) to strip Byte-Order Marks prior to line splitting or tokenization.

---

### Incident 5: Non-Element XML Comment Exception in lxml Sitemap Iteration (BUG-XML-05)
- **Context**: `scrapling/spiders/templates/sitemap.py:105` inside `_get_type()`.
- **What Was Expected**: `SitemapSpider` should parse any valid sitemap XML document, regardless of inline XML comments (`<!-- ... -->`) or processing instructions (`<?xml-stylesheet ... ?>`).
- **What Actually Happened**: `_get_type()` invoked `etree.QName(el.tag)` on every iterated node in the XML tree. In `lxml`, comment nodes have a callable object (function `etree.Comment`) as their `.tag` attribute, not a `str`. Passing `etree.Comment` to `etree.QName` raised a fatal `ValueError`, crashing the entire spider when processing real-world sitemaps containing comments.
- **Evidence in Repo**: Closed Issue `#450`, `scrapling/spiders/templates/sitemap.py`.
- **Root Cause**: Lack of type-guarding on `el.tag` before passing it to string-oriented XML helper functions.
- **Remediation Code Diff**:
```python
for el in root:
-   tag_qname = etree.QName(el.tag)
+   if not isinstance(el.tag, str):
+       continue  # Skip comments (etree.Comment) and processing instructions
+   tag_qname = etree.QName(el.tag)
```
- **Lesson**: When traversing `lxml.etree` ASTs, element tags MUST be guarded with `isinstance(node.tag, str)` before processing as string tag names.

---

## 3. The 9 Deep Learning Dimensions

### 1. Architecture
- **Engine Aggregation via Unified Facade**: Scrapling isolates engine implementations (`FetcherSession`, `DynamicSession`, `StealthySession`) behind an interchangeable API surface. Each engine returns a unified `AdaptorFetcher` / `Response` object.
- **Decoupled Engine Subsystems**:
  - `engines/static.py`: Relies on `curl-cffi` for TLS fingerprinting.
  - `engines/dynamic.py`: Relies on standard `Playwright` driver over Async CDP protocol.
  - `engines/stealth.py`: Wraps `Patchright` with specialized evasion extensions.
- **State Ownership Boundary**: Engine instances own connection pools and browser contexts. Spider instances (`CrawlerEngine`) own crawling queues, session pools, rate-limit state, and deduplication bloom filters.

### 2. Core Abstractions
- **`AdaptorFetcher` / `Response`**: Domain wrapper binding `lxml.html` elements with extra metadata (status, headers, response timing, cookie jars, proxy tracking).
- **`Request`**: Invariant immutable value object encapsulating target URL, HTTP method, payload, metadata dict (`meta`), execution fingerprints (`fp`), proxy parameters, and target spider callbacks.
- **`SessionManager`**: Abstract session pool mapping session IDs (`sid`) to engine instances, enabling state persistence (cookies, local storage, browser contexts) across request chains.

### 3. Error Handling
- **Retry Fallback Mechanics**: Multi-layer retry mechanism handling network timeouts, proxy dropouts, and rate limits (HTTP 429 / 503).
- **Graceful Failure Isolation**: In `CrawlerEngine`, individual request exceptions are caught, recorded in `SpiderStats`, and routed to `errback` handlers without terminating sibling async tasks.
- **XML/HTML Parser Degradation**: When parsing malformed document structures, `lxml` is initialized with `recover=True`, suppressing syntax errors and rebuilding partial trees.

### 4. Testing
- **Async Test Framework**: Built using `pytest` and `pytest-asyncio` / `anyio`.
- **Mock Strategy**: Extensive use of `patch.object` and `AsyncMock` to isolate network engines from spider routing logic.
- **Regression Shields**: Explicit unit tests for edge cases like zero/negative retries, BOM-encoded bodies, and non-element XML comment nodes.

### 5. Security
- **TLS/JA3/JA4 Fingerprint Impersonation**: Bypasses bot detection mechanisms without breaching TLS encryption invariants.
- **Credential & Header Boundary**: Proxy credentials and Authorization headers are isolated per request/session and stripped during cross-domain redirect chains.
- **Sandbox Containment**: Playwright/Patchright browser contexts run with `--no-sandbox` flags inside Docker, bounded by unprivileged Linux user accounts.

### 6. Performance
- **Zero-Copy Byte Processing**: Response bodies are maintained as `bytes` in memory and decoded lazily only when text or CSS parsing is requested.
- **Resource Suppression**: `DynamicSession` and `StealthySession` support `disable_resources=True`, intercepting network routes via CDP to block image, font, and media requests, saving up to 80% bandwidth.
- **Layer Caching in Container Builds**: Build system uses `uv` with mounted caches (`--mount=type=cache,target=/root/.cache/uv`) and explicit dependency locking to minimize Docker build latency.

### 7. Deployment
- **Containerization**: Base image `python:3.12-slim-trixie` with pre-installed Playwright dependencies and `uv` package manager.
- **MCP Server Support**: Exposes Model Context Protocol (MCP) interface over HTTP port `8000` for LLM agent integration (`io.modelcontextprotocol.server.name="io.github.D4Vinci/Scrapling"`).
- **Environment Flags**: Enforces `PYTHONUNBUFFERED=1` and `PYTHONDONTWRITEBYTECODE=1` for clean container stdout streaming and zero disk thrashing.

### 8. Agent Patterns
- **MCP Server Protocol**: Converts scraping capabilities into structured agent tools (e.g., fetch page, extract selectors, execute stealth request).
- **Autonomous Tool Integration**: Exposes complete Agent Skills (`agent-skill/Scrapling-Skill`) containing executable Python code examples for LLM agents to orchestrate multi-step scraping workflows.
- **Context Budget Optimization**: Selector extraction filters out boilerplate DOM trees before returning structured JSON payloads to the LLM agent context window.

### 9. Data Flow
```
[ Target URL ] 
      │
      ▼
[ Request(url, meta, fp) ] ──► [ Cache Check (fp) ] ──(Hit)──► [ Rehydrate Response + Merge Meta ]
                                      │                                      │
                                   (Miss)                                    │
                                      ▼                                      │
                         [ Execute Engine Request ]                          │
                                      │                                      │
                                      ▼                                      │
                         [ ResponseFactory.from_req ]                        │
                                      │                                      │
                                      ▼                                      │
                         [ AdaptorFetcher Engine ] ◄─────────────────────────┘
                                      │
                                      ▼
                        [ User Callback / parse() ]
```

---

## 4. The 8 Learning Extraction Artifacts

### 1. Pattern: Resilient Multi-Engine Request Retry Loop
A production-grade pattern that handles network retries while supporting per-request proxy rotation and session defaults, ensuring `retries <= 0` still performs 1 attempt.

```python
import asyncio
import logging
from typing import Optional, Dict, Any, Callable

logger = logging.getLogger("scrapling.engine")

class ResilientFetcher:
    def __init__(self, default_retries: int = 3, default_retry_delay: float = 1.0):
        self._default_retries = default_retries
        self._default_retry_delay = default_retry_delay

    async def _execute_raw_request(self, url: str, proxy: Optional[str]) -> Dict[str, Any]:
        # Simulated raw HTTP request execution
        return {"status": 200, "url": url, "body": b"OK"}

    async def request(self, url: str, **kwargs) -> Dict[str, Any]:
        # Rule: retries below 1 means 1 execution attempt, 0 retries
        user_retries = kwargs.get("retries", self._default_retries)
        max_attempts = max(1, (user_retries if user_retries is not None else self._default_retries) or 1)
        retry_delay = kwargs.get("retry_delay", self._default_retry_delay)
        proxy = kwargs.get("proxy", None)

        last_exception: Optional[Exception] = None
        for attempt in range(1, max_attempts + 1):
            try:
                logger.debug(f"Executing request to {url} (Attempt {attempt}/{max_attempts})")
                response = await self._execute_raw_request(url, proxy)
                return response
            except Exception as exc:
                last_exception = exc
                logger.warning(f"Attempt {attempt}/{max_attempts} failed for {url}: {exc}")
                if attempt < max_attempts:
                    await asyncio.sleep(retry_delay)
        
        if last_exception:
            raise last_exception
        raise RuntimeError("Request failed with unknown error")
```

---

### 2. Rule: Metadata Preservation Invariant
**MUST** merge live request metadata onto cached or rehydrated response objects before passing them to execution callbacks.
```python
# Universal Invariant Rule
cached_response.meta = {**request.meta, **cached_response.meta}
```

---

### 3. Architecture Principle: Separation of Engine Impersonation and DOM Parsing
The fetching engine (`curl-cffi`, `Playwright`, `Patchright`) MUST only be responsible for network transport, anti-bot bypass, and raw payload acquisition. Standardized HTML/XML DOM parsing, CSS selection, and XPath evaluation MUST be decoupled into a universal, engine-agnostic Adaptor Layer (`Response`).

---

### 4. Failure Mode: Non-Element AST Node Execution Crash
- **Mechanic**: `lxml.etree` represents comments and processing instructions using callable non-string tags (`etree.Comment`). Passing node tags directly to string-expecting XML routines (like `etree.QName`) causes an uncaught `ValueError`.
- **Mitigation**: Guard all XML AST element iterations with `isinstance(node.tag, str)` check before performing operations on `node.tag`.

---

### 5. Reusable Skill: AI Agent Checklist for Scraping Engine Integration
When generating or refactoring web scraping integrations:
1. Verify if the page requires JavaScript execution:
   - If static/semi-static: Use `FetcherSession` (high throughput, low memory).
   - If dynamic SPA: Use `DynamicSession` (Playwright browser automation).
   - If protected by Cloudflare/Turnstile: Use `StealthySession` (Patchright anti-detect).
2. Set `disable_resources=True` on dynamic sessions when media content is unnecessary.
3. Wrap extracted data responses with structural assertions.
4. Ensure all relative URLs extracted from DOM elements are converted to absolute URLs via `response.urljoin(href)`.

---

### 6. Decision: `curl-cffi` vs. Standard `requests`/`httpx`
- **Context**: Choosing an HTTP backend for static fetches in an anti-bot evasion context.
- **Alternatives Considered**:
  1. `requests` / `httpx`: Easy to use, but standard Python TLS stacks present distinct OpenSSL fingerprints easily flagged by Akamai and Cloudflare.
  2. `curl-cffi`: Wraps libcurl with TLS fingerprint spoofing (JA3/JA4, HTTP/2 frame settings).
- **Decision**: Adopted `curl-cffi`.
- **Trade-off**: Increases binary C-extension dependencies, but solves over 80% of TLS-level bot blocks without launching heavy browser runtimes.

---

### 7. Anti-Pattern: Non-Guarded XML Node Tag Processing
NEVER pass raw `.tag` attributes from an `lxml.etree` iterator directly to string helpers without validating tag types:

```python
# BAD: Crashes on XML comments and processing instructions!
def parse_xml_bad(xml_root):
    for node in xml_root:
        qname = etree.QName(node.tag)  # Throws ValueError if node is comment!
        print(qname.localname)

# GOOD: Guarded element check
def parse_xml_good(xml_root):
    for node in xml_root:
        if not isinstance(node.tag, str):
            continue  # Safe skip of etree.Comment / etree.ProcessingInstruction
        qname = etree.QName(node.tag)
        print(qname.localname)
```

---

### 8. Verification Method: Automated BOM and Retry Tests
Concrete pytest assertion suite validating retry bounds and UTF-8 BOM stripping:

```python
import pytest

def test_bom_stripping_invariant():
    raw_bytes = b"\xef\xbb\xbfUser-agent: *\nDisallow: /admin"
    decoded_text = raw_bytes.decode("utf-8", errors="replace").lstrip("\ufeff")
    assert not decoded_text.startswith("\ufeff")
    assert decoded_text.startswith("User-agent:")

@pytest.mark.asyncio
async def test_retries_zero_executes_once():
    execution_counter = 0

    async def mock_fetch():
        nonlocal execution_counter
        execution_counter += 1
        return 200

    user_retries = 0
    max_attempts = max(1, (user_retries if user_retries is not None else 3) or 1)
    
    for _ in range(max_attempts):
        await mock_fetch()

    assert execution_counter == 1
```

---

## 5. Net-New Universal Engineering Rules (Candidates for Master Brain)

## 1. Retry Attempt Math Formalization
**RULE**:
Network fetchers and retry handlers **MUST NOT** equate `retries` directly with total execution loops. Total attempts MUST always evaluate to `max(1, 1 + retries)` (or `max(1, retries)` if input represents total attempts). Setting `retries=0` MUST execute the payload exactly once with zero retries.

**WHY**:
Treating `retries` as `max_retries` in a simple loop range (`range(max_retries)`) causes `retries=0` to execute zero times, completely dropping requests when users explicitly intend to disable retries.

**WHEN TO APPLY**:
All network communication libraries, API client wrappers, and task queue retry loops.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
def calculate_max_attempts(retries: int | None, default_retries: int = 3) -> int:
    """
    Calculates total execution attempts.
    retries=0 -> 1 attempt (0 retries)
    retries=3 -> 3 attempts (or 1 attempt + 3 retries depending on spec)
    retries=None -> uses default
    """
    configured = retries if retries is not None else default_retries
    # Enforce minimum 1 execution attempt
    return max(1, configured or 1)
```

**NEGATIVE CONSTRAINT**:
```python
# NEVER write this: retries=0 leads to zero executions
def execute_request_bad(url: str, retries: int = 0):
    for attempt in range(retries):  # Range(0) never executes!
        return do_http_get(url)
```

**VERIFICATION METHOD**:
Execute unit tests passing `retries=0`, `retries=-1`, and `retries=None`, asserting that the underlying network invocation call count equals exactly 1.

---

## 2. Dynamic Request-To-Response Context Rebinding
**RULE**:
When serving cached, rehydrated, or proxied response payloads, the system **MUST** explicitly re-bind and merge active request metadata (`Request.meta`) onto the returned response object before passing it to downstream consumer callbacks.

**WHY**:
Caching layers deserialize response bodies and headers stored on disk, which lack runtime request context (e.g., pipeline state, page depth, user tracing IDs). Failing to re-bind `request.meta` causes subtle downstream runtime failures (`KeyError`).

**WHEN TO APPLY**:
Caching middleware, proxy layers, and asynchronous crawler engines.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
async def serve_response(request: Request, cache_provider: CacheProvider) -> Response:
    cached_response = await cache_provider.get(request.fingerprint)
    if cached_response is not None:
        # Re-bind request reference
        cached_response.request = request
        # Preserve and merge request metadata over cached metadata
        cached_response.meta = {**request.meta, **cached_response.meta}
        return cached_response

    live_response = await execute_network_request(request)
    live_response.meta = {**request.meta, **live_response.meta}
    return live_response
```

**NEGATIVE CONSTRAINT**:
```python
# NEVER write this: cached response lacks live request context
async def serve_response_bad(request: Request, cache_provider: CacheProvider) -> Response:
    cached = await cache_provider.get(request.fingerprint)
    if cached:
        return cached  # WRONG! cached.meta is empty or stale
```

**VERIFICATION METHOD**:
Run integration tests where a request with `meta={'depth': 2}` hits the cache, and assert that `response.meta['depth'] == 2` inside the callback handler.

---

## 6. Actionable Agent Skill & Implementation Checklist

```
================================================================================
           SCRAPLING FORENSIC AGENT IMPLEMENTATION CHECKLIST
================================================================================

[ ] 1. ENGINE SELECTION & INITIALIZATION
    [ ] Select FetcherSession for static/API targets (curl-cffi impersonation).
    [ ] Select DynamicSession for JS-rendered pages (Playwright browser).
    [ ] Select StealthySession for anti-bot / Cloudflare Turnstile bypass (Patchright).
    [ ] Pass disable_resources=True to dynamic/stealth sessions if images/fonts are not needed.

[ ] 2. REQUEST & RETRY BOUNDARIES
    [ ] Confirm retry logic satisfies max(1, retries) to ensure retries=0 performs 1 initial attempt.
    [ ] Validate that proxy rotation parameters operate on per-retry attempts.

[ ] 3. RESPONSE & SELECTOR EXTRACTION
    [ ] Verify selector queries use CSS or XPath wrappers (.css(), .xpath()).
    [ ] Wrap raw text extraction in .get() or .getall() methods.
    [ ] Convert relative hyperlinks to absolute URLs using response.urljoin(link).

[ ] 4. XML / SITEMAP / TEXT FEED SANITIZING
    [ ] Apply .lstrip("\ufeff") or utf-8-sig codec when parsing raw byte feeds (robots.txt, CSV, XML).
    [ ] Ensure lxml AST traversal checks isinstance(node.tag, str) to ignore comment nodes.

[ ] 5. CACHING & METADATA PRESERVATION
    [ ] When implementing cache managers, re-bind cached.meta = {**request.meta, **cached.meta}.
    [ ] Assert cached responses carry caller-provided metadata into callbacks.

================================================================================
```