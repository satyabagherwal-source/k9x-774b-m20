> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/webrecorder-pywb-learnings.md`  
> **Source**: github ([https://github.com/webrecorder/pywb](https://github.com/webrecorder/pywb))  
> **Source Version**: `20bf53e0`  
> **License**: GPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-27T11:39:01.364Z  
> **Learning ID**: `learn-github-webrecorder-pywb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): webrecorder/pywb

---

## 1. Executive Forensic Architecture & System Mechanics

`pywb` (Python Wayback) is an enterprise web archiving framework and high-fidelity replay engine. It ingests Web ARChive files (ISO 28500 WARC and legacy ARC formats), indexes them into Sort-friendly URI Tracking (SURT) CDX/CDXJ indices or ZipNum clusters, and dynamically replays historical web pages inside contemporary browser runtime environments.

```
                      +---------------------------------------+
                      |          Client / Browser             |
                      +---------------------------------------+
                        ^         |                  ^
         Replayed HTML  |         | Worker Messages  | Dynamic Subresource
       & Wombat Client  |         v                  | Interceptions
                        |    +--------------------+  |
                        |    | autoFetchWorker.js |  |
                        |    |  (Max Concurrency) |  |
                        |    +--------------------+  |
                        |                            v
+-------------------------------------------------------------------------+
| pywb Core Gateway Engine (WSGI / pyuwsgi / gevent)                      |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | Replay Subsystem (pywb.rewrite)                                   |  |
|  | - StreamingRewriter (HTML, CSS, JS, Workers)                      |  |
|  | - JSWorkerRewriter & Wombat Injections                            |  |
|  | - Mod Modifiers: mp_ (replay), id_ (raw), cs_ (css), wkrf_ (worker)  |  |
|  +-------------------------------------------------------------------+  |
|                                ^                                        |
|                                | WARC Payload Stream                    |
|  +-------------------------------------------------------------------+  |
|  | WARC Server & Resource Resolver (pywb.warcserver)                  |  |
|  | - OffsetLimitReader / SpooledTemporaryFile Buffer                 |  |
|  | - Chunked Transfer & Zlib Streaming Gzip Decompression            |  |
|  +-------------------------------------------------------------------+  |
|                                ^                                        |
|                                | Offset & File Pointers                 |
|  +-------------------------------------------------------------------+  |
|  | Index & Aggregation Layer (pywb.warcserver.index)                  |  |
|  | - IndexCache (Shared Memory uWSGI Cache / Negative Cache Bounded) |  |
|  | - SimpleAggregator / DirectoryIndexSource                         |  |
|  | - Lexicographical Binary Search (binsearch.py, block_size=8192)   |  |
|  | - SURT URL Canonicalizer (canonicalize.py)                        |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
          |                                            |
          v                                            v
+--------------------+                       +--------------------+
|  WARC/ARC Storage  |                       |  CDX/CDXJ Indices  |
| (Local/S3/WebHDFS) |                       |  (Sorted Text B-Tree|
+--------------------+                       +--------------------+
```

### Critical Subsystem Boundaries & Invariant Contracts
1. **SURT Canonicalization & Range Generation (`pywb.utils.canonicalize`)**:
   Standard URLs (`http://example.com/path`) are transformed into reverse-domain keys (`com,example)/path`). Lexicographical search ranges are constructed with character incrementation (`chr(ord(x[-1]) + 1)`) and exact delimiter terminators (`!` for exact matches, `*` or `-` for domain expansions).
2. **Zero-Memory-Bloat Binary Search (`pywb.utils.binsearch`)**:
   Indices reaching hundreds of gigabytes are queried via binary disk seeks (`reader.seek(mid * block_size)`). It realigns offsets across arbitrary byte boundaries via single-line discards (`reader.readline()`) and bounds file buffer sizes (`INDEX_FILE_BUFFER_SIZE = 8192`) to prevent Python 3.14+ 128 KiB readahead buffer overconsumption.
3. **Index Caching & Live-Web Fallthrough (`pywb.warcserver.index.indexcache`)**:
   Multi-worker synchronization occurs via uWSGI shared-memory caches. It maintains strict invariants against negative-caching to guarantee that newly recorded WARC records are discovered without TTL lockouts.
4. **Client-Side Runtime Virtualization (`wombatWorkers.js` & `autoFetchWorker.js`)**:
   Rather than attempting lossy server-side DOM transformation, client JavaScript is virtualized via monkey-patching web primitives (`fetch`, `XMLHttpRequest`, `WebSocket`, `Worker`, `CacheStorage`, `self.location`). A concurrency-limited background web worker pool (`MaxRunningFetches = 15`) parallelizes CSS `@import`, `url(...)`, and image `srcset` prefetching.

---

## 2. Universal Engineering Rules

### 1. Guard Against Negative Caching on Dynamic Read-Through Pipelines
**RULE**:
When caching queries over monotonic or append-heavy datasets that fallback to live capture or on-demand indexing, you **MUST NOT** cache empty lookup results unless an explicitly isolated, near-zero negative-TTL is configured.

**WHY**:
Caching an empty result (`count == 0` or `not found`) converts a transient unindexed state into a sustained cache hit. If an upstream recording pipeline queries an index prior to indexing a resource, negative caching causes the system to remain blind to newly appended data for the duration of the TTL. In sequence architectures, this causes write amplification, duplicate data recording, and cache-induced lookup divergence.

**WHEN TO APPLY**:
Apply to any index cache, search engine proxy, or database gateway where writes/recordings occur asynchronously or immediately after a cache-miss check.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import io

class IndexCache(object):
    ENTRY_FORMAT = b'CDXJ01\n'

    def _store_when_done(self, key, cdx_iter, max_captures):
        buff = io.BytesIO()
        buff.write(self.ENTRY_FORMAT)
        count = 0

        for cdx in cdx_iter:
            count += 1
            if count > max_captures:
                buff = None  # Evict from buffering: exceeds cache budget
            elif buff is not None:
                buff.write(cdx)
            yield cdx

        # INVARIANT: Only store if captures exist (> 0) and didn't exceed limits.
        # URLs not yet archived must remain uncached to allow instant updates.
        if buff is not None and count > 0:
            self.set(key, buff.getvalue())
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Blindly serializing empty iterators or zero-result searches.
def _store_when_done_leaky(self, key, cdx_iter):
    results = list(cdx_iter)
    # Storing empty results causes negative caching lockouts
    self.set(key, pickle.dumps(results))
    return results
```

**VERIFICATION METHOD**:
```python
def test_negative_caching_invariant(tmpdir, cache_engine, search_aggregator):
    empty_index = tmpdir.join('index.cdxj')
    empty_index.write('')
    
    # 1. Query non-existent key: must return empty
    res1, _ = search_aggregator.query('http://example.com/asset')
    assert len(res1) == 0
    assert cache_engine.sets == 0, "Empty query result was stored in cache!"
    
    # 2. Append new record to underlying index
    empty_index.write('com,example)/asset 20261027000000 {"url": "http://example.com/asset"}\n')
    
    # 3. Query again: must return immediately without waiting for TTL expiration
    res2, _ = search_aggregator.query('http://example.com/asset')
    assert len(res2) == 1
    assert cache_engine.sets == 1
```

---

### 2. Lexicographical Delimiter-Boundary Range Clamping
**RULE**:
When performing prefix range scans over delimiter-separated, sorted flat files, you **MUST NOT** use naive character replacements that can collide with valid delimiter character alphabets. You **MUST** compute the upper scan boundary by incrementing the terminal ASCII byte and appending strict delimiter guards.

**WHY**:
In prefix searches over sorted datasets (such as SURT URLs where directories, hostnames, and query strings are separated by `/`, `?`, or `,`), naive string range termination causes either scanning past the target namespace (pulling in unrelated sibling paths) or prematurely terminating before query string matches are read.

**WHEN TO APPLY**:
Sorted flat-file binary search routines, RocksDB/LevelDB prefix seek range construction, and B-Tree index scans.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
def calc_search_range(url, match_type):
    def inc_last_char(x):
        # Strict byte/char increment of final component
        return x[0:-1] + chr(ord(x[-1]) + 1)

    start_key = canonicalize_url(url)

    if match_type == 'exact':
        # '!' is ASCII 33, which sorts immediately after space (32) and before alnum (48+)
        end_key = start_key + '!'
    elif match_type == 'prefix':
        if url.endswith('/') and not start_key.endswith('/'):
            start_key += '/'
        if url.endswith('?') and not start_key.endswith('?'):
            start_key += '?'
        end_key = inc_last_char(start_key)
    elif match_type == 'host':
        host = start_key.split(')/')[0]
        start_key = host + ')/'
        # '*' is ASCII 42, closing the host boundary
        end_key = host + '*'
    elif match_type == 'domain':
        host = start_key.split(')/')[0]
        start_key = host + (',' if ',' not in host else ')/')
        # '-' is ASCII 45, closing the domain boundary
        end_key = host + '-'
    else:
        raise ValueError(f"Invalid match_type: {match_type}")

    return start_key, end_key
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Arbitrary string replacement or naive wildcards
def bad_calc_range(prefix):
    # Fails if prefix ends in multi-byte chars or encounters delimiter collision
    return prefix, prefix + 'zzzzzz'
```

**VERIFICATION METHOD**:
```python
def test_boundary_invariants():
    start, end = calc_search_range('http://example.com/path/', 'prefix')
    assert start == 'com,example)/path/'
    assert end == 'com,example)/path0'  # '/' is ASCII 47; '0' is ASCII 48
    assert start < 'com,example)/path/subfile' < end
    assert not ('com,example)/path0' < end)
```

---

### 3. Stream-Chunk Boundary Realignment in Binary Chunk Parsers
**RULE**:
When parsing newline-delimited streaming byte buffers in async workers or stream consumers, you **MUST** retain unconsumed trailing bytes in an unparsed carryover buffer and concatenate them to the head of the subsequent stream chunk before scanning for delimiters.

**WHY**:
Network stream read boundaries do not align with application-level record boundaries (e.g., JSON lines or CDX records). Splitting or decoding chunks across incomplete byte sequences causes multi-byte UTF-8 split errors, syntax errors on JSON parsing, and truncated records.

**WHEN TO APPLY**:
Any `ReadableStream`, Web Worker streaming consumer, chunked HTTP body reader, or high-throughput log ingestion engine.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified from pywb/static/queryWorker.js
var bufferedPreviousChunk = null;
var newLine = 10; // ASCII newline '\n'

function transformChunk(currentChunk) {
  var chunk;
  if (bufferedPreviousChunk) {
    // Concatenate carryover buffer with new incoming chunk
    chunk = new Uint8Array(bufferedPreviousChunk.length + currentChunk.length);
    chunk.set(bufferedPreviousChunk);
    chunk.set(currentChunk, bufferedPreviousChunk.length);
    bufferedPreviousChunk = null;
  } else {
    chunk = currentChunk;
  }
  consumeChunk(chunk, false);
}

function consumeChunk(chunk, last) {
  var offset = 0;
  var lastMatch = 0;
  var chunkLen = chunk.length;
  
  while (true) {
    var idx = offset >= chunkLen ? -1 : chunk.indexOf(newLine, offset);
    if (idx !== -1 && idx < chunkLen) {
      // Complete record located between lastMatch and idx + 1
      var recordBytes = chunk.slice(lastMatch, idx + 1);
      if (recordBytes.length > 0) {
        handleRecord(recordBytes);
      }
      offset = idx + 1;
      lastMatch = offset;
    } else {
      // Incomplete trailing chunk segment retained
      if (lastMatch < chunkLen) {
        bufferedPreviousChunk = chunk.slice(lastMatch);
      }
      if (last && bufferedPreviousChunk && bufferedPreviousChunk.length > 0) {
        handleRecord(bufferedPreviousChunk);
        bufferedPreviousChunk = null;
      }
      break;
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Decoding chunks in isolation and splitting strings
function badConsumeStream(chunk) {
  // Throws or corrupts if multibyte UTF-8 is severed at the chunk border!
  var str = new TextDecoder().decode(chunk);
  var lines = str.split('\n'); // Drops incomplete trailing line or parses broken JSON
  lines.forEach(line => JSON.parse(line));
}
```

**VERIFICATION METHOD**:
```javascript
function testStreamChunkBoundary() {
  const line1 = '{"url":"http://test1.com"}\n';
  const line2 = '{"url":"http://test2.com"}\n';
  const fullBytes = new TextEncoder().encode(line1 + line2);
  
  // Artificially cut right through the middle of line 1 JSON
  const chunkA = fullBytes.slice(0, 15);
  const chunkB = fullBytes.slice(15);
  
  const parsed = [];
  global.handleRecord = (bytes) => parsed.push(JSON.parse(new TextDecoder().decode(bytes)));
  
  transformChunk(chunkA);
  transformChunk(chunkB);
  
  if (parsed.length !== 2) throw new Error("Chunk boundary parser dropped records");
  if (parsed[0].url !== "http://test1.com") throw new Error("Chunk corrupted");
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Index Negative Caching Causing Auto-Index Starvation (BUG-PYWB-01)
- **Context**: Subsystem `pywb.warcserver.index.indexcache` in `pywb/warcserver/index/indexcache.py`.
- **What Was Expected**: When a URL is queried prior to being written or indexed into a collection, the engine should perform the live lookup or return 404, but once the URL is indexed via `AutoIndexer`, subsequent lookups must immediately return the newly indexed captures.
- **What Actually Happened**: The cache stored empty lookups (`count == 0`). In sequence collections where local indices sit ahead of the live web, querying an unindexed URL cached the "not found" state for the duration of the TTL (60 seconds). When the crawler recorded the URL and auto-indexed it, the lookup fell through again, causing pywb to re-record the URL in an infinite loop.
- **Evidence in Repo**: Commit `20bf53e0`, PR `#1057`, test additions in `pywb/warcserver/index/test/test_index_cache.py`.
- **Root Cause**: The method `_store_when_done` blindly executed `self.set(key, buff.getvalue())` whenever `buff is not None`. An empty query generated an empty byte stream with only the 7-byte header `CDXJ01\n` and `count == 0`, poisoning the shared uWSGI cache.
- **Remediation Code Diff**:
```python
--- a/pywb/warcserver/index/indexcache.py
+++ b/pywb/warcserver/index/indexcache.py
@@ -168,7 +169,9 @@ class IndexCache(object):
     def _store_when_done(self, key, cdx_iter, max_captures):
-        # store the captures if they are all read, and there are not too many
+        # store the captures if they are all read, and there are not too many.
+        # A url not found is not stored, as it may soon be added to the index,
+        # eg. when it is recorded and auto-indexed.
         buff = io.BytesIO()
         buff.write(self.ENTRY_FORMAT)
         count = 0
@@ -184,7 +187,7 @@ class IndexCache(object):
             yield cdx
 
-        if buff is not None:
+        if buff is not None and count > 0:
             self.set(key, buff.getvalue())
```
- **Lesson**: Data-sink read caches should treat existence as a prerequisite for caching unless an explicit, short-lived negative caching contract is intentionally designed.

---

### Incident 2: Host Prefix Pollution via Python Packaging Root Leak (BUG-PYWB-02)
- **Context**: Packaging manifest and setup definition (`setup.py`, `MANIFEST.in`).
- **What Was Expected**: Executing `pip install pywb` should install the library packages exclusively within the virtualenv or system `site-packages/pywb` directory.
- **What Actually Happened**: Installing the wheel or sdist dumped `sample_archive/` into `$PREFIX/sample_archive` (which resolved to `/usr/local/sample_archive` on Linux) and published test files as a top-level importable `tests` package in `site-packages`.
- **Evidence in Repo**: GitHub Closed Issue `#1029`, targeting compliance with the Python Packaging User Guide ("wheels should never include tests and sample data outside namespaced packages").
- **Root Cause**: Unscoped `data_files` directives in `setup.py` and indiscriminate `find_packages()` configurations without explicit namespace exclusions (`exclude=['tests', 'tests.*', 'sample_archive']`).
- **Remediation Code Diff**:
```python
# In setup.py:
- packages=find_packages(),
- data_files=[('sample_archive', glob('sample_archive/**'))],
+ packages=find_packages(exclude=['tests', 'tests.*', 'sample_archive']),
# Explicitly relocate sample data into pywb package resources or omit from wheel
```
- **Lesson**: Never use global root paths in setup manifests; always scope package data strictly under the top-level application module namespace.

---

### Incident 3: Hard Crash on Modern Setuptools via Deprecated `pkg_resources` (BUG-PYWB-03)
- **Context**: CLI Entrypoint in `pywb/apps/cli.py`.
- **What Was Expected**: Running the `pywb` CLI command on modern Python runtimes (Python 3.11+) with setuptools >= 82 must parse entrypoints without runtime failure.
- **What Actually Happened**: Setuptools 82 dropped the deprecated `pkg_resources` module. Running `pywb` resulted in immediate failure:
  `ModuleNotFoundError: No module named 'pkg_resources'`.
- **Evidence in Repo**: GitHub Closed Issue `#985`.
- **Root Cause**: Reliance on legacy `pkg_resources.load_entry_point` or `pkg_resources.resource_string` in CLI entry scripts instead of standard library replacements introduced in Python 3.9+.
- **Remediation Code Diff**:
```python
--- a/pywb/apps/cli.py
+++ b/pywb/apps/cli.py
@@ -2,7 +2,10 @@
-import pkg_resources
+try:
+    from importlib.metadata import entry_points
+except ImportError:
+    import importlib_metadata as entry_points
```
- **Lesson**: Standardize on `importlib.metadata` and `importlib.resources` for packaging metadata; avoid coupling runtime bootstrap to build-time tools (`setuptools`).

---

### Incident 4: Python 3.14 Buffer Over-Allocation in Flat Binary Seekers (BUG-PYWB-04)
- **Context**: Low-level sorted index search utilities in `pywb/utils/binsearch.py`.
- **What Was Expected**: Binary search across multi-gigabyte CDX files should perform fast, minimal-read seeks to isolate indexed keys without memory or I/O amplification.
- **What Actually Happened**: In Python 3.14+, the standard library adjusted default file readahead buffer sizes from 8 KiB to 128 KiB. Because `binsearch_offset` repeatedly seeks and reads a single short line (`readline()`), each step of the binary search loaded 128 KiB into memory, causing a 16x I/O read amplification per lookup.
- **Evidence in Repo**: Hard-coded constant definition and comment audit in `pywb/utils/binsearch.py`:
  `INDEX_FILE_BUFFER_SIZE = 8192`.
- **Root Cause**: Reliance on platform-dependent default buffer sizes in `open()` calls during rapid `seek()`/`readline()` cycles.
- **Remediation Code Diff**:
```python
--- a/pywb/utils/binsearch.py
+++ b/pywb/utils/binsearch.py
@@ -14,6 +14,11 @@ if six.PY3:
         return (a > b) - (a < b)
 
+# Buffer size for opening the sorted files searched here (CDX, CDXJ, ZipNum
+# summary and path index files). Each binary search step seeks and reads a single line, so
+# the whole buffer is read at each step: with the default buffer size (128 KiB
+# since Python 3.14, 8 KiB before), a lookup reads 16 times more data.
+INDEX_FILE_BUFFER_SIZE = 8192
```
- **Lesson**: In disk-seeking binary search algorithms over flat text files, explicitly constrain I/O buffer sizes to match the seek block size to prevent underlying runtime updates from amplifying I/O overhead.

---

### Incident 5: Missing Native Dependency in Minimal Slim Container (BUG-PYWB-05)
- **Context**: Container infrastructure definition in `Dockerfile`.
- **What Was Expected**: Deploying `pywb` on official `python:slim` base images with `pyuwsgi` must execute without missing dynamic link library errors.
- **What Actually Happened**: `pyuwsgi` pre-compiled wheels dynamically link against `libexpat.so.1`. In Debian-based `slim` container images, `libexpat1` is omitted to minimize container size, causing `uwsgi` runtime bootstrap to fail with missing shared object errors.
- **Evidence in Repo**: Production `Dockerfile` installation instructions:
  `apt-get install -y --no-install-recommends libexpat1`.
- **Root Cause**: Undocumented shared object (`.so`) runtime dependency in compiled C extensions pulled via PyPI wheels on stripped OS bases.
- **Remediation Code Diff**:
```dockerfile
--- a/Dockerfile
+++ b/Dockerfile
@@ -6,6 +6,10 @@ COPY requirements.txt ./
+# pyuwsgi wheel links against libexpat, which the slim image lacks
+RUN apt-get update \
+ && apt-get install -y --no-install-recommends libexpat1 \
+ && rm -rf /var/lib/apt/lists/*
+
 RUN pip install --no-cache-dir -r requirements.txt \
     pyuwsgi boto3 pysocks lxml ujson isal babel translate_toolkit babel-vue-extractor
```
- **Lesson**: Whenever deploying compiled C-extensions on slim/distroless images, run `ldd` across compiled `.so` binaries in CI to identify implicit dynamic linkage requirements.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Truthiness Pitfall on Port and Coordinate Defaults**:
  In `pywb/utils/geventserver.py`:
  ```python
  def __init__(self, app, port=0, hostname='localhost', handler_class=None, direct=False):
      self.port = port
      # INVARIANT: port=0 is truthy in logic, but falsy if evaluated as `if not port:`
      # Using port=0 tells the OS to bind to an ephemeral, available port.
      # Never use `port = port or 8080`.
  ```
- **Boolean Coercion of String Parameters**:
  In `pywb/utils/format.py`, query parameters such as `allowFuzzy=0` or `reverse=false` cannot be cast with `bool(val)`. In Python, `bool("0")` and `bool("false")` evaluate to `True`.
  ```python
  def to_bool(val):
      if not val:
          return False
      if isinstance(val, str):
          return val.lower() not in ('0', 'false', 'f', 'off')
      return bool(val)
  ```
- **Header Replacement Mutation Invariants**:
  When updating `Content-Length` on buffered streams (`pywb/utils/io.py`), mutating headers must account for duplicate casing (`content-length` vs `Content-Length`):
  ```python
  status_headers.replace_header('Content-Length', str(size))
  # Guarantees old content lengths are evicted rather than appended as duplicates.
  ```

### 2. Infinite Loop & Recursion Guards
- **Binary Search Termination Invariant**:
  In `pywb/utils/binsearch.py`, binary search over unsized disk blocks avoids infinite loops between adjacent blocks using the invariant condition `max_ - min_ > 1`:
  ```python
  while max_ - min_ > 1:
      mid = int(min_ + ((max_ - min_) / 2))
      reader.seek(mid * block_size)
      if mid > 0:
          reader.readline() # Discard fractional line
      line = reader.readline()
      if compare_func(key, line) > 0:
          min_ = mid
      else:
          max_ = mid
  # Termination guarantee: (max_ - min_) decreases monotonically on every cycle.
  ```
- **Worker Execution Loop Bounds**:
  In `pywb/static/autoFetchWorker.js`, infinite background subresource fetching is bounded via a dual guard: an inflight counter cap (`MaxRunningFetches = 15`) and a deduplication map (`seen[url] = true`):
  ```javascript
  function queueOrFetch(toBeFetched) {
    var url = typeof toBeFetched === 'object' ? toBeFetched.url : toBeFetched;
    if (!url || url.indexOf(DataURLPrefix) === 0 || seen[url] != null) {
      return; // Circular fetch loop terminated
    }
    seen[url] = true;
    if (runningFetches >= MaxRunningFetches) {
      queue.push(toBeFetched);
      return;
    }
    fetchURL(toBeFetched);
  }
  ```

### 3. UI & UX Micro-Mechanics
- **Replay Sandboxing & Shadow DOM URL Retargeting**:
  Replayed historical pages run client-side JavaScript that interrogates `window.location`. If left unprotected, scripts detect domain mismatches and crash or trigger cross-origin errors. `wombatWorkers.js` isolates location checks using ES6 Proxies:
  ```javascript
  self._WB_wombat_location = new Proxy(self.location, {
    get: (target, prop) => "href" === prop ? e.extractOriginalURL(target[prop]) : target[prop]
  });
  ```
- **Credentials Propagation in Client-Side Rewriting**:
  Overriding `fetch` and `XMLHttpRequest` inside service workers must inject `credentials = 'include'` on historical assets to allow the replay proxy to validate session cookies across rewritten domains:
  ```javascript
  var originalFetch = self.fetch;
  self.fetch = function(input, init) {
    var rewritten = rewriter.rewriteFetchApi(input);
    var options = init || {};
    options.credentials = "include";
    return originalFetch.call(this, rewritten, options);
  };
  ```

### 4. Backend Concurrency & Memory Safety
- **Bounded Spool Buffering for Memory Containment**:
  In `pywb/utils/io.py`, when buffering an iterator to compute content length, keeping payloads entirely in RAM allows malicious archives or large video streams to trigger Out-Of-Memory (OOM) crashes:
  ```python
  def buffer_iter(status_headers, iterator, buff_size=BUFF_SIZE * 4):
      # SpooledTemporaryFile stays in memory up to buff_size, then automatically rolls to disk
      out = SpooledTemporaryFile(buff_size)
      size = 0
      for buff in iterator:
          size += len(buff)
          out.write(buff)
      out.seek(0)
      return StreamIter(out)
  ```
- **Socket Connection Leaks in Iterators**:
  When reading upstream WARC streams via `requests` or `urllib3`, generator iterators can terminate prematurely if the client disconnects. `no_except_close` guarantees socket return to the connection pool:
  ```python
  def no_except_close(closable):
      try:
          closable.close()
      except Exception:
          pass
      try:
          closable.release_conn()  # urllib3 raw stream release
      except Exception:
          pass
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Safe Trailing Delimiter Character Increment**:
  In `calc_search_range` (`pywb/utils/canonicalize.py`):
  ```python
  def inc_last_char(x):
      return x[0:-1] + chr(ord(x[-1]) + 1)
  ```
  If `x` is empty (`""`), `x[0:-1]` slices empty and `x[-1]` raises an `IndexError`. The caller guarantees that `start_key` has been pre-validated by `canonicalize()`, preventing zero-length string manipulation.
- **Decoder Error Masking in Stream Chunks**:
  In `pywb/static/queryWorker.js`, parsing text streams with `