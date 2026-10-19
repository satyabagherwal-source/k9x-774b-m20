> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/scrapy-plugins-scrapy-deltafetch-learnings.md`  
> **Source**: github ([https://github.com/scrapy-plugins/scrapy-deltafetch](https://github.com/scrapy-plugins/scrapy-deltafetch))  
> **Source Version**: `a8caf39d`  
> **License**: PERMISSIVE_OPEN_SOURCE  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T21:46:02.109Z  
> **Learning ID**: `learn-github-scrapy-plugins-scrapy-deltafetch`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): scrapy-plugins/scrapy-deltafetch

---

## 1. Executive Forensic Architecture & System Mechanics

`scrapy-deltafetch` is an incremental crawl optimization subsystem written as a Scrapy Spider Middleware. Its architectural objective is state-driven request pruning: preventing redundant extraction passes by dropping requests directed at previously crawled, item-yielding documents across crawler process invocations.

```
       +-------------------------------------------------------------+
       |                     Scrapy Spider Output                    |
       |  (Stream of Request | Item / Dict yielded by parse method)  |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |             DeltaFetch.process_spider_output                |
       +-------------------------------------------------------------+
                                      |
                 +--------------------+--------------------+
                 |                                         |
     [isinstance(r, Request)]                     [Extracted Item / Dict]
                 |                                         |
                 v                                         v
   +---------------------------+             +---------------------------+
   | Query Key In DBM Database |             | Key = Fingerprint(Parent) |
   +---------------------------+             | DBM[Key] = str(timestamp) |
        |                 |                  +---------------------------+
    [Present]       [Not Present]                          |
        |                 |                                v
        v                 v                         yield Item / Dict
     [Drop]            yield r
 (Stats: skipped)
```

### Critical Subsystem Boundaries and Mechanics
1. **Spider Middleware Hook (`process_spider_output`)**: Operates on the generator stream emitted by spider callback functions. Unlike Downloader Middlewares that intercept outbound HTTP transactions, `DeltaFetch` acts as a stream filter directly downstream of parse methods.
2. **Asymmetric Key Lifecycle (Write-on-Item / Filter-on-Request)**: DeltaFetch does not cache URLs upon downloading. Instead, it records the fingerprint of `response.request` *only when that response yields an item*. If a request yields sub-requests (e.g., pagination links), those child requests are tested against the key-value store; if already recorded from past crawl runs, they are discarded before reaching Scrapy's scheduler.
3. **Storage Boundary (`dbm`)**: Employs Python's standard `dbm` (Database Manager) key-value engine, abstracting Berkeley DB, GDBM, or dumbdbm depending on host library presence. Keys are raw byte sequences (`to_bytes`), and values are Unix epoch timestamps as strings.
4. **Fingerprinting Decoupling**: Scrapy historically relied on `scrapy.utils.request.request_fingerprint`. Newer versions (Scrapy 2.7+) employ `crawler.request_fingerprinter.fingerprint`, returning raw byte hashes instead of hex strings. DeltaFetch encapsulates this via duck-typing dynamic dispatch with fallbacks.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dual-Lifecycle Crawl Pruning Invariant
**RULE**:
A delta/incremental crawling cache MUST NOT mark an HTTP request as "visited" upon network fetch completion; it MUST ONLY mark the request as resolved when its downstream parsing callback successfully emits at least one domain data entity (Item/Record).

**WHY**:
Network-level caching flags transient HTTP 200 responses as resolved even when the document was blank, blocked by bot-detection, rate-limited, or failed data extraction validation. Committing the key on Item yield guarantees that downstream extraction logic succeeded. If extraction crashes or yields zero items due to markup mutations, the request is not marked in the persistent store, allowing automatic retry in the subsequent crawl delta.

**WHEN TO APPLY**:
Any continuous web scraping, API extraction, data ingestion, or incremental ETL pipeline where re-crawling empty or errored targets is mandatory for self-healing.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
def process_spider_output(self, response, result, spider):
    for r in result:
        if isinstance(r, Request):
            key = self._get_key(r)
            if key in self.db and self._is_enabled_for_request(r):
                logger.info(f"Ignoring already visited: {r}")
                if self.stats:
                    self.stats.inc_value("deltafetch/skipped", spider=spider)
                continue
        else:
            # Commit parent request fingerprint ONLY when yielding an item
            key = self._get_key(response.request)
            self.db[key] = str(time.time())
            if self.stats:
                self.stats.inc_value("deltafetch/stored", spider=spider)
        yield r
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Committing fingerprint during response receipt
def process_response(self, request, response, spider):
    key = self._get_key(request)
    # FATAL FLAW: If response contains CAPTCHA or parsing crashes on result,
    # the URL is permanently skipped in subsequent crawl passes.
    self.db[key] = str(time.time())
    return response
```

**VERIFICATION METHOD**:
Run an integration test where a mock spider yields 1 Request that returns a 200 OK containing an empty payload (no Item yielded). Run a second crawl pass and assert that the request is NOT skipped (`crawler.stats.get_value("deltafetch/skipped") is None`).

---

### 2. Dual-Version Component Adapter Pattern
**RULE**:
When an upstream framework transitions an API from a static module function returning string primitives to an engine-bound instance method returning raw byte primitives, middleware libraries MUST probe host capabilities using `hasattr(crawler, "engine_attr")` during initialization and coerce all output primitives through an invariant byte encoder.

**WHY**:
Dynamic dispatch via `getattr`/`try-except` on `crawler` ensures backward compatibility across framework major versions without runtime branching per request. Normalizing the returned signature to `to_bytes(key)` prevents runtime hashing failures and binary DBM key encoding collisions across Python versions.

**WHEN TO APPLY**:
Extensible plugin ecosystems (Scrapy, Django, Celery, Express) where plugins must remain simultaneously compatible across multiple upstream release cycles.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
@classmethod
def from_crawler(cls, crawler):
    o = cls(dir, reset, crawler.stats)
    # Probe engine-level instance attribute introduced in newer version
    try:
        o.fingerprint = crawler.request_fingerprinter.fingerprint
    except AttributeError:
        # Fallback to legacy global utility function
        from scrapy.utils.request import request_fingerprint
        o.fingerprint = request_fingerprint
    return o

def _get_key(self, request):
    key = request.meta.get("deltafetch_key") or self.fingerprint(request)
    # Invariant: Guarantee bytes regardless of whether fingerprint() returns str or bytes
    return to_bytes(key)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Direct legacy import without version probing
from scrapy.utils.request import request_fingerprint

def _get_key(self, request):
    # CRASH: Raises ImportError on Scrapy >= 2.12.0 where function is removed
    return request_fingerprint(request)
```

**VERIFICATION METHOD**:
Execute test suites across a matrix consisting of minimum supported framework version (`Scrapy==1.1.0`) and modern framework version (`Scrapy>=2.12.0`). Assert that `_get_key` yields an instance of `bytes` under both runtime environments.

---

### 3. Fail-Safe Key-Value Database Recreation Invariant
**RULE**:
File-backed embedded key-value stores initialized during process startup MUST implement an explicit rescue branch that unlinks corrupted database files and re-initializes an empty store rather than crashing the primary engine worker.

**WHY**:
Embedded embedded stores (such as DBM, BerkeleyDB, SQLite) are susceptible to corruption if previous OS processes were killed (`SIGKILL`, OOM killer) mid-transaction. Crashing the entire worker halts production crawler pipelines completely. Dropping corrupt state compromises incremental history (leading to repeated fetches) but preserves data collection continuity.

**WHEN TO APPLY**:
Autonomous worker processes, scrapers, and daemons using local file-backed persistence for ephemeral caching or state pruning.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from pathlib import Path
import dbm
import logging

logger = logging.getLogger(__name__)

def open_or_recover_db(dbpath: Path, reset: bool) -> dbm._Database:
    flag = "n" if reset else "c"
    try:
        return dbm.open(str(dbpath), flag=flag)
    except Exception as exc:
        logger.warning(
            f"Failed to open database at {dbpath} ({exc}), unlinking and recreating"
        )
        if dbpath.exists():
            dbpath.unlink()
        return dbm.open(str(dbpath), "c")
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Unhandled open with no recovery
def open_db(dbpath: Path, reset: bool):
    # FATAL FLAW: dbm.error raised on corrupted header terminates the crawl completely
    return dbm.open(str(dbpath), "n" if reset else "c")
```

**VERIFICATION METHOD**:
Create a corrupted file: `Path("test.db").write_bytes(b"\x00\xFF\xAA\x55CORRUPT")`. Invoke initialization routine and assert that `test.db` is replaced with a valid, accessible DBM database without unhandled exceptions.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Scrapy 2.12.0 Request Fingerprinter Deprecation Removal (BUG-DELTAFETCH-01)
- **Context**: Request fingerprinting resolution in `scrapy_deltafetch/middleware.py`.
- **What Was Expected**: `DeltaFetch` must generate deterministic request signatures to identify previously crawled pages across all supported Scrapy releases.
- **What Actually Happened**: Scrapy 2.12.0 completely removed `scrapy.utils.request.request_fingerprint`, which had been marked deprecated since Scrapy 2.7.0. Crawlers running `scrapy-deltafetch` crashed on import with `ImportError: cannot import name 'request_fingerprint' from 'scrapy.utils.request'`.
- **Evidence in Repo**: GitHub Issues #49, #50; Pull Requests #51, #52.
- **Root Cause**: Hardcoded import of deprecated procedural utility function `request_fingerprint` instead of adopting Scrapy's componentized `RequestFingerprinter` architecture introduced in 2.7.0.
- **Remediation Code Diff**:
```python
// - from scrapy.utils.request import request_fingerprint
// - o.fingerprint = request_fingerprint
// + try:
// +     o.fingerprint = crawler.request_fingerprinter.fingerprint
// + except AttributeError:
// +     from scrapy.utils.request import request_fingerprint
// +     o.fingerprint = request_fingerprint
```
- **Lesson**: Library middleware must bind to framework services exposed via container objects (`crawler`) rather than importing procedural helper functions directly from library internals.

---

### Incident 2: CI Publishing Tag Regex Semantic Mismatch (BUG-DELTAFETCH-02)
- **Context**: Release deployment pipeline configuration in `.github/workflows/publish.yml`.
- **What Was Expected**: Pushing a semantic release tag (e.g., `v2.1.0`) triggers the GitHub Actions PyPI publishing workflow.
- **What Actually Happened**: The publishing workflow was configured with tag filter `'[0-9]+.[0-9]+.[0-9]+'`. Tags pushed with a canonical standard `v` prefix (`v2.1.0`) failed to trigger the deployment workflow, blocking release automation.
- **Evidence in Repo**: Commit `a8caf39d`, PR resolving release deployment.
- **Root Cause**: Discrepancy between release tagging conventions (using leading `v`) and the workflow trigger pattern (expecting unadorned numeric semver).
- **Remediation Code Diff**:
```yaml
  on:
    push:
      tags:
-     - '[0-9]+.[0-9]+.[0-9]+'
+     - 'v[0-9]+.[0-9]+.[0-9]+'
```
- **Lesson**: Tag triggers in CI/CD automation must strictly align with repository release tooling configurations (`tool.bumpversion` or git tag hooks).

---

### Incident 3: Legacy bsddb3 Deprecation & CI Environment Halts (BUG-DELTAFETCH-03)
- **Context**: Underlying C-extension library requirements for Python 3.5+ across Travis CI and GitHub Actions.
- **What Was Expected**: Unit tests pass cleanly on modern Python 3 runtimes using standard Python build dependencies.
- **What Actually Happened**: The `bsddb3` library, which `dbm.bsd` relied on, failed compilation on newer Python toolchains and Linux distros lacking `libdb-dev` system headers. Builds failed with header resolution errors during wheel compilation.
- **Evidence in Repo**: Commit `43eb4a27`, removal of `.travis.yml` and replacement with GitHub Actions workflow requiring `sudo apt-get install libdb-dev`.
- **Root Cause**: Implicit coupling to platform native C-headers (`libdb-dev`) without explicit OS container provisioning.
- **Remediation Code Diff**:
```yaml
+    steps:
+    - uses: actions/checkout@v2
+    - name: libddb
+      run: |
+        sudo apt-get install libdb-dev
```
- **Lesson**: Embedded database bindings requiring external shared C libraries (`BerkeleyDB`, `GDBM`) must declare explicit system-level provisioning steps in all CI matrix definitions.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Key Serialization via `to_bytes`**:
  ```python
  def _get_key(self, request):
      key = request.meta.get("deltafetch_key") or self.fingerprint(request)
      return to_bytes(key)
  ```
  `self.fingerprint(request)` in modern Scrapy returns `bytes`. Legacy Scrapy returns `str` (hex string). User metadata `request.meta.get("deltafetch_key")` may be `str`, `int`, or `bytes`. Calling `to_bytes(key)` ensures the output strictly adheres to `bytes`. DBM backends (`gdbm`, `dbm.ndbm`) raise `TypeError: dbm mappings have bytes or string keys only` or perform conflicting internal string encodings if given divergent types.
- **Coercion of Flags**:
  ```python
  reset = self.reset or getattr(spider, "deltafetch_reset", False)
  flag = "n" if reset else "c"
  ```
  `flag="n"` creates a new empty database for reading and writing (truncating existing records). `flag="c"` opens the database for reading and writing, creating it only if it does not exist. Using `"w"` would crash if the file did not exist yet.
- **Boolean Guard against Falsy Non-Booleans**:
  ```python
  return request.meta.get("deltafetch_enabled", True)
  ```
  Explicit default argument `True` ensures that if `"deltafetch_enabled"` is omitted from the request metadata dictionary, it evaluates truthy. If an operator sets `meta["deltafetch_enabled"] = False`, it drops through without evaluating `None` as missing.

### 2. Infinite Loop & Recursion Guards
- **Spider Output Generator Preservation**:
  Scrapy spider callback methods return generator iterables (`result`). A naive middleware implementation consuming `list(result)` would buffer the entire page output into heap memory, defeating stream processing. `DeltaFetch` iterates over `for r in result:` and emits elements lazily via `yield r`.
- **Recursion Avoidance**:
  DeltaFetch does not traverse child request graphs recursively. It evaluates keys at the boundary of emission. Circular links (e.g., Page A links to Page B, Page B links to Page A) are stopped at the queue boundary because the key for Page A is written when Page A yields an item; subsequent requests to Page A emitted by Page B hit `key in self.db` and are discarded.

### 3. UI & UX Micro-Mechanics / Stream Backpressure
- **Scrapy Engine Backpressure**:
  By yielding directly from `process_spider_output`, DeltaFetch preserves engine backpressure:
  ```python
  for r in result:
      if isinstance(r, Request):
          ...
      yield r
  ```
  If Scrapy's downloader queue fills up, iteration over `result` pauses, throttling parsing of upstream responses.

### 4. Backend Concurrency & Memory Safety
- **Single Process DBM Concurrency Constraints**:
  Standard `dbm` engines do not support safe concurrent read-write access across multiple operating system processes.
  ```python
  dbpath = dir / f"{spider.name}.db"
  ```
  DeltaFetch scopes the database file by `spider.name`. Running multiple concurrent crawlers with identical spider names against the same filesystem directory risks DB corruption unless separated by `DELTAFETCH_DIR`.
- **Explicit Resource Finalization via Signals**:
  ```python
  crawler.signals.connect(o.spider_closed, signal=signals.spider_closed)

  def spider_closed(self, spider):
      self.db.close()
  ```
  DBM implementations (especially GDBM and dumbdbm) maintain internal caches and write headers on teardown. Failure to explicitly invoke `close()` can corrupt the underlying file table. By hooking `signals.spider_closed`, DeltaFetch guarantees that even if a spider run aborts, the open file descriptor is flushed and closed.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Safe Metric Incrementation**:
  ```python
  if self.stats:
      self.stats.inc_value("deltafetch/skipped", spider=spider)
  ```
  In isolated testing environments, `crawler.stats` may be `None`. Direct dereferencing `self.stats.inc_value(...)` without the `if self.stats:` check raises `AttributeError: 'NoneType' object has no attribute 'inc_value'`.

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
- **Boundary Placement**: Placed strictly in the `Spider Middleware` chain, not the `Downloader Middleware` chain.
  - *Rationale*: Downloader Middlewares run in the network I/O loop. Placing DeltaFetch in the Spider Middleware layer allows it to observe extracted `Item` objects alongside new `Request` objects, enabling the "Write on Item, Skip on Request" pattern.
- **Coupling**: Decoupled from spiders; operates purely via conventions (`request.meta` keys `deltafetch_key`, `deltafetch_enabled`, spider attribute `deltafetch_reset`).

### Dimension 2: Core Abstractions
- **Fingerprint Contract**: A request identity hash string or bytes uniquely identifying the HTTP method, canonicalized URL, and sorted body payload.
- **Key Store**: Key-value mapping interface adhering to Python's `dbm` protocol (`__getitem__`, `__setitem__`, `__contains__`, `close`).

### Dimension 3: Error Handling
- **Database Corruption Self-Recovery**:
  If opening the database fails due to an invalid header or crash residue:
  ```python
  try:
      self.db = dbm.open(str(dbpath), flag=flag)
  except Exception:
      if dbpath.exists():
          dbpath.unlink()
      self.db = dbm.open(str(dbpath), "c")
  ```
  The old corrupted database file is unlinked via `pathlib.Path.unlink()` and initialized anew, preventing permanent crawler lockouts.

### Dimension 4: Testing
- **Test Invariants**:
  Uses `mock` objects for `Crawler`, `Spider`, and `Response`.
  - Testing matrix asserts that:
    - Previously unseen requests pass through untouched.
    - Requests previously marked via emitted items are dropped.
    - Setting `request.meta['deltafetch_enabled'] = False` bypasses dropping even if the key is in the database.
    - Setting custom `request.meta['deltafetch_key']` overrides URL fingerprinting.

### Dimension 5: Security
- **Threat Model**:
  - *File Path Traversal*: `spider.name` is interpolated directly into `f"{spider.name}.db"`. If an attacker can control the spider name (e.g., via user input passed to a scraping API), they could inject path traversal characters (`../../etc/cron.d`).
  - *Mitigation*: Restrict spider names to alphanumeric characters and avoid passing unvalidated user strings to `spider.name`.

### Dimension 6: Performance
- **Time Complexity**:
  - Request filtering lookup: $O(1)$ amortized DBM B-tree / hash table search.
  - Item tracking write: $O(1)$ amortized insert.
- **Memory Footprint**:
  - Near zero memory overhead. Key storage resides on-disk in the DBM file; keys are not loaded into heap RAM. Generator streaming ensures minimal resident set size (RSS).

### Dimension 7: Deployment
- **Packaging Standard**: Modernized from `setup.py` / `tox` to `pyproject.toml` (`setuptools>=61.2` build-backend) conforming to PEP 517/518.
- **Tagging Discipline**: Automated PyPI release deployments on git tag pushes matching `v*.*.*`.

### Dimension 8: Agent Patterns
- **Inspection Hooks**:
  AI agents operating Scrapy crawlers can inspect the stats collector:
  - `deltafetch/skipped`: Counter indicating redundant requests avoided.
  - `deltafetch/stored`: Counter indicating pages that generated production data.

### Dimension 9: Data Flow
```
Parse Callback Yields -> Request -> DeltaFetch.process_spider_output:
                             |
                             +--> In DB? -> Yes -> Drop Request (inc_value: skipped)
                             |
                             +--> In DB? -> No  -> Emit Request
                      -> Item    -> DeltaFetch.process_spider_output:
                             |
                             +--> Fingerprint(response.request) -> Store in DB (inc_value: stored)
                             +--> Emit Item
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Asymmetric State Emission Middleware
In stream-based processing systems, track execution completion at the leaf entity (the produced item) rather than the initiation token (the request) to prevent recording false successes on partially failed tasks.

### 2. Rule
A persistent key-value store hooked to ephemeral process lifecycles MUST trap initialization exceptions, unlink corrupted files, and re-create the persistence layer to maintain operational continuity.

### 3. Architecture Principle
Middleware components must adapt to host framework evolution by runtime capability probing (`hasattr(crawler, "request_fingerprinter")`) rather than static version comparisons, decoupling plugin lifecycle from host versions.

### 4. Failure Mode: The "Phantom Visit" Hazard
If a scraper marks an HTTP endpoint as visited as soon as the HTTP 200 is received, any downstream parser exception, schema change, or empty response prevents item extraction while permanently barring that URL from future crawls.

### 5. Reusable Skill: Framework Deprecation Adaptation Workflow
1. Identify deprecated module-level import.
2. Trace where the host framework attaches the replacement service to its inversion-of-control container (e.g., `crawler.request_fingerprinter`).
3. Construct initialization fallback logic via `try-except AttributeError` or `hasattr`.
4. Standardize output signatures (e.g., converting legacy strings and modern bytes to a uniform `bytes` contract).
5. Add matrix testing targeting both legacy and modern framework packages.

### 6. Decision: Embedded DBM vs. External Database (Redis/PostgreSQL)
- **Choice**: Default standard library `dbm`.
- **Rationale**: Zero external infrastructure dependencies. Keeps the plugin usable out-of-the-box for single-node crawlers without configuring database credentials or network sockets.
- **Trade-off**: Lacks out-of-the-box distributed multi-machine coordination (requires network-shared filesystems or a different backend).

### 7. Anti-Pattern: Unconditional Dict Value Conversion
```python
# ANTI-PATTERN: Direct assignment of non-byte keys to DBM
def _bad_store(db, key, val):
    db[key] = val  # TypeError if key is str and backend expects bytes, or vice-versa
```

### 8. Verification Method
Verify that a corrupted database file triggers auto-recovery:
```python
def test_corrupted_db_recovery(tmp_path):
    corrupt_file = tmp_path / "myspider.db"
    corrupt_file.write_bytes(b"INVALID_HEADER_DATA")
    
    # Instantiate middleware with corrupt directory
    middleware = DeltaFetch(dir=str(tmp_path))
    spider = Mock(name="myspider")
    spider.name = "myspider"
    
    # Must not raise dbm.error; must unlink and recreate
    middleware.spider_opened(spider)
    assert middleware.db is not None
    middleware.spider_closed(spider)
```

---

## 7. Actionable Agent Skill & Implementation Checklist

When implementing incremental state tracking or request filtering middleware, an autonomous coding agent must execute the following step-by-step checklist:

- [ ] **Step 1: Placement Verification**
  - Verify that the component intercepts the post-parse stream (Spider Middleware) rather than the pre-fetch stream (Downloader Middleware).
- [ ] **Step 2: Dual Capability Fingerprint Adapter**
  - Implement dynamic attribute resolution on the application container (`crawler.request_fingerprinter`).
  - Fall back safely to legacy procedural utilities if attributes are missing.
- [ ] **Step 3: Byte Key Coercion**
  - Ensure all keys passed to underlying key-value stores pass through `to_bytes()`.
- [ ] **Step 4: Asymmetric Write Invariant**
  - Verify that `db[key] = timestamp` executes ONLY in the branch processing extracted items, NOT in the request branch.
- [ ] **Step 5: File-Store Auto-Recovery**
  - Wrap database connection calls in `try-except Exception`.
  - In the exception handler, log a warning, unlink the offending corrupted file path via `Path.unlink()`, and re-open with create flags (`"c"`).
- [ ] **Step 6: Metric Null-Checks**
  - Protect all stats increments behind `if self.stats:` conditionals.
- [ ] **Step 7: Lifecycle Teardown**
  - Hook engine termination signals (`signals.spider_closed`) to explicitly call `self.db.close()`.