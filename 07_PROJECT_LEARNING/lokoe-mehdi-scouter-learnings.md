> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lokoe-mehdi-scouter-learnings.md`  
> **Source**: github ([https://github.com/lokoe-mehdi/scouter](https://github.com/lokoe-mehdi/scouter))  
> **Source Version**: `e8edc3c5`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-24T20:41:56.557Z  
> **Learning ID**: `learn-github-lokoe-mehdi-scouter`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): lokoe-mehdi/scouter

---

## 1. Executive Forensic Architecture & System Mechanics

```
                       +-------------------------------------------------------------+
                       |              PHP / NGINX LAYER (App & UI)                   |
                       |  - Laravel / Slim Web MVC, REST API v1, MCP Server          |
                       |  - Dr. Brief Conversational Agent (SSE, LLM Tools, ChPdo)   |
                       |  - Async Worker: categorisation, bulk-AI, CSV export        |
                       +------------------------------+------------------------------+
                                                      |
                                     JSON Job Payload | DB Polling (status='queued')
                                                      v
+-----------------------------------------------------+-------------------------------------------------------+
|                                    GO CRAWLER WORKER (scouter-crawler)                                      |
|                                                                                                             |
|  +------------------------+      +---------------------------+      +------------------------------------+  |
|  |  Cgroup-Aware Governor | ---> | Concurrency Slot Manager  | ---> |   Engine Orchestrator (BFS Depth)  |  |
|  |  (PSI CPU & GOMEMLIMIT)|      | (Pre-claim Slot Semaphores|      |   - Dynamic claimLimit Budget Cut  |  |
|  +------------------------+      +---------------------------+      +------------------+-----------------+  |
|                                                                                        |                    |
|                                     +--------------------------------------------------+                    |
|                                     |                                                                       |
|                                     v                                                                       v
|             +-----------------------------------------------+                       +-------------------------------+
|             |          HTTP Engine (uTLS Client)            |                       |     Headless Render Engine    |
|             |  - Chrome TLS JA3/JA4 fingerprint             |                       |     (Go-Rod Batch HTTP / RPC) |
|             |  - Anti-SSRF DNS Pre-flight Check             |                       +---------------+---------------+
|             |  - Multi-format Stream Decompressor           |                                       |
|             +-----------------------+-----------------------+                                       v
|                                     |                                               +-------------------------------+
|                                     v                                               |      Go-Rod Browser Daemon    |
|             +-----------------------------------------------+                       |  - Channel Semaphore Gate     |
|             |        Analytical Normalization Engine        |                       |  - Try-Protected Page Pool    |
|             |  - Reverse-byte CRC32/BZIP2 (PHP match)       |                       |  - Idle Activity Nano Reaper  |
|             |  - 64-bit CRC Simhash Token Voting            |                       |  - Images Disabled (Blink)    |
|             |  - Capped In-Memory Robots.txt Cache          |                       +-------------------------------+
|             +-----------------------+-----------------------+
|                                     |
|                                     v
|             +-----------------------------------------------+
|             |             Dual-Tier Storage Gate            |
|             |  - PostgreSQL: Frontier & BFS Leases          |
|             |  - ClickHouse: Heavy Analytics & PageRank     |
|             |  - S3 / Blob Store: Raw HTML (Off-DB)         |
|             +-----------------------------------------------+
+-------------------------------------------------------------------------------------------------------------+
```

### Problem Statement & Domain Constraints
`scouter` addresses enterprise-scale, client-side, and server-side Technical Search Engine Optimization (SEO) auditing. The system extracts, computes, and audits deep internal link topologies, PageRank distributions, Simhash duplicate clusters, and schema structured data across websites with hundreds of thousands of pages. It operates under two strict constraints:
1. **Self-Hosted Cost Efficiency**: It must run within single-box VPS environments (Docker containers) without exhausting RAM, thrashing Linux Page Frame Caches, or invoking the Out-Of-Memory (OOM) killer.
2. **Heterogeneous Language Parity**: The platform couples a PHP 8.3 application layer (handling UI, MCP agents, migrations, and export scheduling) with a native Go crawling daemon (`scouter-crawler`) and a Go-Rod headless Chromium rendering service. Both runtimes must share partition tables, ID hashing algorithms, and serialization semantics with zero divergence.

### Subsystem Boundaries & Invariant Contracts
- **Web & API Subsystem (PHP 8.3 / Nginx)**: Ingests crawl configuration, executes user-facing analytical queries, runs an MCP (Model Context Protocol) tool server for autonomous agents, and handles Server-Sent Events (SSE) for conversational AI (`Dr. Brief`). PHP-FPM workers are statically decoupled from fetch execution: long-running crawls are never processed inside PHP-FPM threads.
- **Go Crawler Engine (`scouter-crawler`)**: Polls the PostgreSQL `jobs` table for `command = 'crawl'`. It drives an iterative Breadth-First Search (BFS) depth engine. It isolates network fetching, handles transparent decompression (`gzip`, `deflate`, `br`), performs anti-SSRF validation, manages uTLS fingerprint spoofing, and coordinates with an external Chromium instance for Single-Page Application (SPA) DOM hydration.
- **Chrome Rendering Daemon (`renderer`)**: Uses `go-rod/rod` to control headless Chromium over Chrome DevTools Protocol (CDP). Implements bounded concurrency slots, memory leak tab reapers, and image decoding suppression (`imagesEnabled=false`).
- **Persistence Boundary (PostgreSQL + ClickHouse + Blob Storage)**:
  - *PostgreSQL*: Acts as an atomic job queue, state coordinator, and dynamic partition store (`pages_<crawl_id>`, `links_<crawl_id>`).
  - *ClickHouse*: Ingests migrated crawl snapshots and high-throughput analytical writes to calculate internal PageRank and heavy aggregations via SQL without locking PG tables.
  - *S3 / Local Filesystem*: Stores raw HTML blobs indexed by deterministic crawl keys, completely preventing DB bloat and Postgres TOAST exhaustion.

---

## 2. Net-New Universal Engineering Rules

### 1. Pre-Claim Resource Slot Reservation Invariant
**RULE**:
A distributed or multi-threaded background worker MUST NOT claim, lease, or mutate the state of a queue job to `running` or `in_progress` in the database until the local execution slot, concurrency token, or semaphore has been successfully acquired in-memory.

**WHY**:
Claiming a job in the database *before* acquiring a worker thread slot introduces a Time-Of-Check to Time-Of-Use (TOCTOU) race condition between the database status and true system capacity. If the process claims Job $N$ and subsequently blocks waiting for an in-memory execution slot, external monitoring dashboards, watchdogs, and cluster autoscalers will falsely classify Job $N$ as actively executing. If the worker encounters an unhandled panic, context termination, or graceful shutdown while blocked on the semaphore, the job remains permanently locked in `running` state ("orphan job") without ever executing a single line of work.

**WHEN TO APPLY**:
Any language (Go, Rust, Node.js, Python, Java) implementing worker pool patterns, queue consumers (Kafka, RabbitMQ, PostgreSQL/Redis-backed queues), or distributed task dispatchers.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Concurrency slot acquired strictly BEFORE database transaction/mutation
func RunWorker(ctx context.Context, mgr *JobManager, maxSlots int) {
	sem := make(chan struct{}, maxSlots)
	var wg sync.WaitGroup

	for {
		if ctx.Err() != nil {
			break
		}

		// 1. Acquire execution slot BEFORE attempting DB mutation
		select {
		case sem <- struct{}{}:
		case <-ctx.Done():
			return
		}

		// 2. Local token acquired. Now safe to query and lock DB record
		job, err := mgr.ClaimNext(ctx)
		if err != nil {
			<-sem // Release slot immediately on acquisition failure
			time.Sleep(2 * time.Second)
			continue
		}

		if job == nil {
			<-sem // Release slot when queue is empty
			time.Sleep(1 * time.Second)
			continue
		}

		// 3. Dispatch execution with guaranteed slot ownership
		wg.Add(1)
		go func(j Job) {
			defer wg.Done()
			defer func() { <-sem }() // Guaranteed release on exit or panic
			executeJob(ctx, j)
		}(*job)
	}
	wg.Wait()
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Claiming in DB before having local capacity
for {
	// BUG: Database marks job 'running', but local runner blocks on sem!
	job, _ := mgr.ClaimNext(ctx) // DB UPDATE jobs SET status='running' WHERE id=...
	if job != nil {
		sem <- struct{}{} // Worker hangs here indefinitely if slots are saturated.
		go func(j Job) {
			defer func() { <-sem }()
			executeJob(ctx, j)
		}(*job)
	}
}
```

**VERIFICATION METHOD**:
Inject a saturated slot condition (`sem` filled with non-terminating mock tasks). Poll the database queue. Assert via automated integration test that `SELECT COUNT(*) FROM jobs WHERE status = 'running'` is strictly $\le \text{maxSlots}$, and that unallocated jobs remain in `queued` state until an active slot explicitly yields.

---

### 2. Dual-Engine Heterogeneous String/Hash Compatibility Invariant
**RULE**:
When cross-compiling or reimplementing primary key hashing, entity deduplication, or cryptographic checksum routines across two heterogeneous language ecosystems (e.g., PHP and Go), the secondary engine MUST explicitly account for internal library representation divergences—such as bit reflection, non-standard polynomial implementations, and reverse endianness formatting.

**WHY**:
In PHP, `hash('crc32', $str)` implements CRC-32/BZIP2 (non-reflected polynomial `0x04C11DB7`) and formats the output hex string by swapping bytes into little-endian order. Conversely, standard library implementations in C, Go (`hash/crc32`), and Python (`binascii.crc32`) default to IEEE 802.3 (reflected polynomial `0xEDB88320`) in standard big-endian order. Directly calling `crc32.ChecksumIEEE()` in Go to match PHP's `hash('crc32')` creates silent hash divergence. Relational foreign keys between crawled partitions break, parent-child links fail to resolve, and deduplication clusters collapse.

**WHEN TO APPLY**:
Systems migrating, polyglotting, or dual-writing between PHP, Go, Rust, or Python where relational primary keys or cache tokens depend on string checksums.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package analysis

import (
	"fmt"
)

// BZIP2 polynomial: 0x04C11DB7 (MSB-first, non-reflected)
var bzip2Table = func() [256]uint32 {
	const poly = 0x04C11DB7
	var t [256]uint32
	for i := 0; i < 256; i++ {
		crc := uint32(i) << 24
		for j := 0; j < 8; j++ {
			if crc&0x80000000 != 0 {
				crc = (crc << 1) ^ poly
			} else {
				crc <<= 1
			}
		}
		t[i] = crc
	}
	return t
}()

func crc32Bzip2(b []byte) uint32 {
	crc := uint32(0xFFFFFFFF)
	for _, c := range b {
		crc = (crc << 8) ^ bzip2Table[byte(crc>>24)^c]
	}
	return crc ^ 0xFFFFFFFF
}

// PageID reproduces PHP hash('crc32', $url, false) bit-for-bit:
// Requires CRC-32/BZIP2 and a 4-byte endianness swap before hex encoding.
func PageID(url string) string {
	v := crc32Bzip2([]byte(url))
	swapped := (v&0x000000FF)<<24 | 
	           (v&0x0000FF00)<<8  | 
	           (v&0x00FF0000)>>8  | 
	           (v&0xFF000000)>>24
	return fmt.Sprintf("%08x", swapped)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Assuming standard library crc32 matches PHP hash('crc32')
func PageID_Flawed(url string) string {
	// FAILS: Uses IEEE 802.3 reflected poly instead of BZIP2.
	// Does not perform byte-reversal swap.
	checksum := crc32.ChecksumIEEE([]byte(url))
	return fmt.Sprintf("%08x", checksum) 
}
```

**VERIFICATION METHOD**:
Implement a cross-runtime parity matrix test comparing a fixture list of 1,000 edge-case strings (empty strings, Unicode sequences, URLs $>2048$ chars, null bytes). Assert that Go output matches PHP CLI output:
```bash
diff <(go run test_ids.go) <(php -r 'foreach(file("urls.txt") as $u) echo hash("crc32", trim($u))."\n";')
```

---

### 3. Frontier Budget Claim Remainder Sizing Invariant
**RULE**:
A crawler or pagination crawler frontier with a strict page quota cap ($N_{\text{max}}$) MUST dynamically clamp each leased batch fetch size to $\min(\text{BatchSize}, N_{\text{max}} - N_{\text{fetched}})$. If $N_{\text{max}} - N_{\text{fetched}} \le 0$, the frontier must refuse further claims and terminate gracefully with a successful completion status rather than aborting as an error or throwing an overflow fault.

**WHY**:
Without exact remaining budget clamping, claiming a fixed-size batch (e.g., 50 URLs) when only 3 slots remain results in fetching and persisting up to 47 extra pages beyond the contractual limit. Conversely, halting by raising an exception or signaling an engine crash aborts post-processing pipelines (such as PageRank calculation, orphan link detection, or schema validation), leaving crawl metrics corrupted or uncomputed.

**WHEN TO APPLY**:
Crawl engines, scrapers, data export pagination engines, and batch processors enforcing rate or quota budgets.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// claimLimit sizes the frontier batch to avoid exceeding maxPages budget.
// Returns (batchLimit, true) if work can be leased, or (0, false) if budget is spent.
func claimLimit(maxPages int, crawled int64, batchSize int) (int, bool) {
	if maxPages <= 0 {
		return batchSize, true // Unlimited crawl
	}
	left := int64(maxPages) - crawled
	if left <= 0 {
		return 0, false // Quota fully satisfied
	}
	limit := int(left)
	if limit > batchSize {
		limit = batchSize
	}
	return limit, true
}

// In Depth Loop:
limit, ok := claimLimit(cfg.MaxPages, liveCrawled.Load(), frontierBatch)
if !ok {
	logf("maxPages %d reached; completing crawl gracefully", cfg.MaxPages)
	return nil // Return nil so post-processing continues normally
}
urls, err := claimToCrawl(ctx, limit)
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Fetching standard batch and truncating post-fetch
urls, err := claimToCrawl(ctx, frontierBatch) // Always claims 50
fetchAndStore(urls) // Blows past budget!
if liveCrawled.Load() >= int64(maxPages) {
	return errors.New("limit reached") // Crash halts post-processing!
}
```

**VERIFICATION METHOD**:
Execute property-based unit tests asserting that for any arbitrary starting values of $N_{\text{max}} \in [1, 10000]$, $\text{BatchSize} \in [1, 100]$, and initial offset $k$, the cumulative sum of issued batches never exceeds $N_{\text{max}}$, and `ok` flips to `false` when $N_{\text{fetched}} \ge N_{\text{max}}$.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Crawl Budget Cap Leaks & Random Cutoff (BUG-SCOUTER-01)
- **Context**: Go Crawler orchestrator frontier claim and PostgreSQL database storage layer (`crawler-go/internal/crawl/orchestrator.go`, `crawler-go/internal/db/crawldb.go`).
- **What Was Expected**: Setting `maxPages` should cap total fetched pages exactly at $N$. The cutoff on the final depth tier should retain the most prominent, shallowest, and structurally critical pages rather than an arbitrary hash-ordered sample.
- **What Actually Happened**: The crawler fetched full batches without clamping to the remaining quota, overshooting the budget. The final depth was sliced arbitrarily by database primary key order (`ORDER BY id`). Post-processing sitemap fetch loops ignored the cap and pulled unbounded URLs during post-processing.
- **Evidence in Repo**: Commit `e8edc3c5`, Issue #67.
- **Root Cause**:
  1. The orchestrator did not compute the difference between `maxPages` and `liveCrawled.Load()` before requesting URLs from the frontier queue.
  2. The SQL query in `ClaimUrlsToCrawl` sorted by `id`, which represents CRC-32 hashes, introducing arbitrary random ordering across the final depth tier.
  3. The post-processor's sitemap verification closure executed uncapped fetching regardless of `cfg.MaxPages`.
- **Remediation Code Diff**:
```diff
--- a/crawler-go/internal/crawl/orchestrator.go
+++ b/crawler-go/internal/crawl/orchestrator.go
@@ -143,7 +143,12 @@ func (e *Engine) depthStarter(ctx context.Context, newCrawl bool) error {
 			if e.stopped(ctx) {
 				return errStopped
 			}
-			urls, err := e.claimToCrawl(ctx, respectRobots, frontierBatch, i)
+			limit, ok := claimLimit(e.cfg.MaxPages, e.liveCrawled.Load(), frontierBatch)
+			if !ok {
+				e.logf("maxPages %d reached at depth %d, ending crawl", e.cfg.MaxPages, i)
+				return nil // normal finish: post-processing still runs
+			}
+			urls, err := e.claimToCrawl(ctx, respectRobots, limit, i)

--- a/crawler-go/internal/db/crawldb.go
+++ b/crawler-go/internal/db/crawldb.go
@@ -277,7 +290,13 @@ func (c *CrawlDB) ClaimUrlsToCrawl(ctx context.Context, respectRobots bool, limi
 	if c.Capped {
+		// Prefer highest inlinks, then shallowest paths (/features before /fr/industries/finance)
+		sb.WriteString(" ORDER BY inlinks DESC, length(url) - length(replace(url, '/', '')), length(url), id")
+	} else {
+		sb.WriteString(" ORDER BY id")
+	}
```
- **Lesson**: Quota limits must be enforced on the input boundary of work leasing. When trimming boundary sets, deterministic structural heuristics (link count, path depth) must supersede primary key or storage engine order.

---

### Incident 2: Headless Browser Semaphore Exhaustion & Tab Zombie Leak (BUG-SCOUTER-02)
- **Context**: Go-Rod Chromium renderer lifecycle management (`renderer/main.go`).
- **What Was Expected**: When headless Chromium crashes, experiences an IPC disconnect, or encounters an internal panic during page allocation (`browser.MustPage("")`), the renderer should return an error and cleanly release its concurrency token.
- **What Actually Happened**: If `browser.MustPage("")` panicked, the panic skipped the release step, permanently leaking a slot in `semaphore chan struct{}`. Over time, all slots were exhausted. The renderer hung permanently, refusing all subsequent incoming render batches.
- **Evidence in Repo**: `renderer/main.go` lines 180–235 (`rod.Try` implementation).
- **Root Cause**: The semaphore channel token was acquired before the panic-prone CDP initialization, but cleanup was deferred to downstream functions that never executed when `MustPage` panicked.
- **Remediation Code Diff**:
```diff
--- a/renderer/main.go
+++ b/renderer/main.go
@@ -190,12 +190,14 @@ func getPage() (*rod.Page, error) {
 	select {
 	case page := <-pagePool:
 		return page, nil
 	default:
-		page := browser.MustPage("")
-		return page, nil
+		var page *rod.Page
+		if err := rod.Try(func() { page = browser.MustPage("") }); err != nil {
+			<-semaphore // Release slot before escalating error
+			return nil, err
+		}
+		return page, nil
 	}
 }

 func releasePage(page *rod.Page) {
+	defer func() { <-semaphore }() // Semaphore is ALWAYS returned even if tab close panics
+	if err := rod.Try(func() { page.MustNavigate("about:blank") }); err != nil {
+		_ = rod.Try(func() { page.Close() })
+		return
+	}
```
- **Lesson**: Resource acquisition tokens must be paired with fail-safe release mechanisms wrapped in panic/exception interceptors. Any library adhering to a "Must" naming convention (which panics on failure) must be encapsulated inside recovery boundaries.

---

### Incident 3: Unbound Parameter SQL Injection & Syntax Crash in Filtered CSV Worker (BUG-SCOUTER-03)
- **Context**: URL Explorer export execution worker (`app/Export/ExportService.php`).
- **What Was Expected**: Asynchronous background CSV generation should replay the exact filtered dataset configured by the user in the UI explorer.
- **What Actually Happened**: Filtered CSV export jobs completed with exit code 0, yet the job was marked `failed` in the database. Workers logged SQL syntax errors caused by unpopulated parameters.
- **Evidence in Repo**: Issue #65 ("filtered CSV exports failing, and icons rendering as ligature names").
- **Root Cause**: The web interface dynamically constructed parameterized SQL conditions (e.g., `c.url LIKE :url_0 AND c.depth > :param_1`) and maintained parameter bindings in an isolated PDO array. The dispatch controller serialized only the raw SQL `report_where` string into the job payload, discarding the parameter array. The worker attempted to execute unbound PDO statements. Furthermore, calculated and JSONB columns (such as `extract_*`, `out_of_scope`) were blindly prefixed with `c.` table aliases, producing invalid column references.
- **Remediation Code Diff**:
```diff
--- a/app/Export/ExportService.php
+++ b/app/Export/ExportService.php
@@ -45,7 +45,11 @@ class ExportService {
-    $sql = "SELECT " . implode(',', $columns) . " FROM pages c WHERE " . $job->report_where;
-    $stmt = $pdo->prepare($sql);
-    $stmt->execute(); // FAILS: Parameter placeholders :url_0 unbound!
+    // Serialize both query fragment and bound parameters across job boundaries
+    $whereClause = $job->payload['where_clause'];
+    $bindings    = $job->payload['bindings'] ?? [];
+    
+    $sql = $this->queryBuilder->compileExportQuery($columns, $whereClause);
+    $stmt = $pdo->prepare($sql);
+    $stmt->execute($bindings);
```
- **Lesson**: SQL clauses and their corresponding parameter vectors form an atomic unit. Never serialize or pass an arbitrary SQL condition string through a distributed queue without its accompanying parameter binding map.

---

### Incident 4: Container Startup Race Condition on Heterogeneous Schema Migrations (BUG-SCOUTER-04)
- **Context**: Go worker auto-migration orchestrator (`crawler-go/internal/backfill/backfill.go`).
- **What Was Expected**: When running under Docker Compose, `scouter-crawler` should boot, detect unmigrated PostgreSQL crawls, and backfill them into ClickHouse.
- **What Actually Happened**: On initial deployment, `scouter-crawler` crashed immediately on boot with: `column crawls.data_store does not exist`.
- **Evidence in Repo**: `crawler-go/internal/backfill/backfill.go`, method `WaitForSchema`.
- **Root Cause**: Docker Compose `depends_on` only verifies container startup, not application-level schema readiness. The PHP migration suite ran inside the `scouter` web container. The Go worker container booted faster than PHP-FPM executed `composer migrate`, causing the Go worker to query columns before they were created.
- **Remediation Code Diff**:
```diff
--- a/crawler-go/internal/backfill/backfill.go
+++ b/crawler-go/internal/backfill/backfill.go
@@ -32,6 +32,24 @@ func New(pool *db.Pool, ch *db.CH, logf func(string, ...any)) *Backfiller {
+func (b *Backfiller) WaitForSchema(ctx context.Context) error {
+	for attempt := 0; attempt < 60; attempt++ {
+		var exists bool
+		err := b.pool.QueryRow(ctx,
+			`SELECT EXISTS (
+				SELECT 1 FROM information_schema.columns
+				WHERE table_name = 'crawls' AND column_name = 'data_store'
+			)`).Scan(&exists)
+		if err == nil && exists {
+			return nil
+		}
+		select {
+		case <-ctx.Done():
+			return ctx.Err()
+		case <-time.After(5 * time.Second):
+		}
+	}
+	return fmt.Errorf("crawls.data_store column not present after wait")
+}
```
- **Lesson**: Independent containerized services sharing a database must implement explicit, non-blocking polling guards on schema contracts rather than assuming simultaneous, linear boot sequences.

---

### Incident 5: Gzip/Brotli Raw Byte Rejection in PostgreSQL Text Columns (BUG-SCOUTER-05)
- **Context**: Outbound HTTP fetch decompression pipeline (`crawler-go/internal/crawl/engine.go`).
- **What Was Expected**: Crawled HTTP response bodies should be parsed, sanitized, and inserted into PostgreSQL and ClickHouse text fields.
- **What Actually Happened**: Crawls against certain modern servers failed with PostgreSQL error `22021: invalid byte sequence for encoding "UTF8"`.
- **Evidence in Repo**: `crawler-go/internal/crawl/engine.go`, function `decompressBody`.
- **Root Cause**: Go’s standard `http.Transport` automatically decompresses gzip bodies *only* if the client does not set explicit `Accept-Encoding` headers. The crawler sent custom browser-mimicking headers (`Accept-Encoding: gzip, deflate, br`). Consequently, Go left the underlying network streams compressed. When the raw binary streams were read and stored directly into Postgres `TEXT` fields, the database rejected non-UTF-8 binary bytes.
- **Remediation Code Diff**:
```diff
--- a/crawler-go/internal/crawl/engine.go
+++ b/crawler-go/internal/crawl/engine.go
@@ -200,6 +200,21 @@ func (e *Engine) fetchOne(ctx context.Context, rawURL string)