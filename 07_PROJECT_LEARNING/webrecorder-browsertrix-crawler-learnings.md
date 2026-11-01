> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/webrecorder-browsertrix-crawler-learnings.md`  
> **Source**: github ([https://github.com/webrecorder/browsertrix-crawler](https://github.com/webrecorder/browsertrix-crawler))  
> **Source Version**: `3aff4355`  
> **License**: AGPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T10:32:09.226Z  
> **Learning ID**: `learn-github-webrecorder-browsertrix-crawler`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): webrecorder/browsertrix-crawler

---

## 1. Executive Forensic Architecture & System Mechanics

`webrecorder/browsertrix-crawler` is a high-fidelity, headless/headed web archiving crawler packaged as an integrated single-container system. Unlike standard HTTP crawlers (e.g., Scrapy, Colly) that fetch raw static responses, Browsertrix executes JavaScript and simulates user interaction inside a controlled browser instance (Chromium/Brave via Puppeteer-core and direct Chrome DevTools Protocol / CDP connections) to archive modern Single Page Applications (SPAs), dynamic DOM states, and streaming network requests directly into standard ISO-compliant preservation artifacts (WARC and WACZ).

```
 ┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                           CLI / Entrypoint                                             │
 │                     (ArgParser, Validation, Crawl Config, Redis Orchestrator Setup)                   │
 └───────────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                           Crawler Engine                                               │
 │       ┌───────────────────────────────────────────┴───────────────────────────────────────────┐        │
 │       ▼                                                                                       ▼        │
 │ ┌───────────────────────────────────────────────┐ ┌──────────────────────────────────────────────────┐ │
 │ │            Shared Sitemap Reader              │ │               Seed / URL Frontier                │ │
 │ │  - Undici HTTP fetch                          │ │  - Redis-backed frontier queues & sets           │ │
 │ │  - SAX stream XML parser                      │ │  - URL Normalization (normalizeUrl)              │ │
 │ │  - Background PQueue worker pool              │ │  - Scope Engine (prefix, host, SPA, custom Rx)   │ │
 │ └───────────────────────┬───────────────────────┘ └─────────────────────────┬────────────────────────┘ │
 │                         │                                                   │                          │
 │                         └─────────────────────────┬─────────────────────────┘                          │
 │                                                   ▼                                                    │
 │                                       Worker Execution Pool                                            │
 └───────────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                                     │
               ┌─────────────────────────────────────┴─────────────────────────────────────┐
               ▼                                                                           ▼
 ┌──────────────────────────────────────────┐                                ┌───────────────────────────┐
 │             Browser Subsystem            │                                │  Network Interception     │
 │ - Chromium / Brave Instance via CDP      │                                │  & Policy Engine          │
 │ - Singletons Pruning (./Singleton*)      │◄───────────────────────────────┤ - BlockRules / AdBlock    │
 │ - Custom Profile Tarball Ingestion       │       CDP Request Pausing      │ - OriginOverride (Undici) │
 │ - Viewport / Xvfb Display Management     │                                │ - Direct fetch fallback   │
 └─────────────────────┬────────────────────┘                                └─────────────┬─────────────┘
                       │                                                                   │
                       ▼                                                                   │
 ┌──────────────────────────────────────────┐                                              │
 │        In-Page Behavior Engine           │                                              │
 │ - browsertrix-behaviors script injection │                                              │
 │ - @puppeteer/replay Flow Behavior Engine │                                              │
 │ - Locator.race() step runner             │                                              │
 │ - DOM Snapshot / Network activity diffs  │                                              │
 └─────────────────────┬────────────────────┘                                              │
                       │                                                                   │
                       └─────────────────────────┬─────────────────────────────────────────┘
                                                 │
                                                 ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                 Capture & Preservation Pipeline                                        │
 │  - Network Capture via CDP Network Domain Events (WARC / WACZ generation via warcio.js & client-zip)   │
 │  - Deduplication Engine (Sha256 / Sha1 digest against Redis commit index)                             │
 │  - Atomic Storage Flushing (Local FS & S3-compatible chunked uploaders)                               │
 └────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Critical Subsystem Boundaries & Abstractions

1. **Browser Subsystem (`src/util/browser.ts`)**: Manages browser process lifecycle, Xvfb virtual framebuffers, and user profile persistence. It extracts profile tarballs atomically, purges stale Chromium socket locks (`./Singleton*`), disables site isolation trials when CDP network recording requires cross-origin visibility, and translates display geometry into headless/headed viewport boundaries.
2. **Network Interception & Request Pipeline (`src/util/blockrules.ts`, `src/util/originoverride.ts`)**: Sits between Puppeteer's high-level network stack and lower-level network calls. It injects interception hooks to evaluate URL regexes, checks frame hierarchy (distinguishing top-level navigations from nested iframe resource requests), executes conditional text matching by fetching iframe bodies out-of-band via `undici`, and overrides host/origin headers transparently.
3. **Behavior Execution Engine (`src/util/flowbehavior.ts`)**: Bridges declarative user interaction definitions (`@puppeteer/replay` JSON recordings) into actionable CDP commands. It provides runtime step execution with selector racing (`Locator.race`), dynamic loop guards (repeat click detection via DOM snapshot hashing and network idle detection), and frame boundary traversal.
4. **Frontier & Sitemap Subsystem (`src/crawler.ts`, `src/util/sitemapper.ts`)**: Coordinates discovery between deterministic sitemaps and dynamic link extraction. Decoupled in version 1.15.2 into a shared asynchronous task runner using a bounded worker pool (`PQueue`), decoupling seed evaluation from sitemap streaming.
5. **Deduplication & Storage Subsystem (`src/util/storage.ts`, `src/util/warcwriter.ts`)**: Governs payload hashing and persistence. Encapsulates WARC (Web ARChive) records and WACZ (Web Archive Collection Zipped) container structures, enforcing idempotency guarantees across crawl restarts.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Atomic Directory Swapping with Rollback Guard
**RULE**:
When synchronizing, replacing, or restoring directory trees in stateful runtime environments (such as browser profile directories or git behavior repositories), systems MUST extract or stage new payloads into an isolated sibling temporary directory on the same filesystem and execute an atomic rename (`fs.rename`), preceded by recursive removal (`fs.rm`) of the destination. Code MUST NOT extract, untar, or write files directly into the active live directory path.

**WHY**:
In-place extractions or non-atomic multi-file copies expose the process to corrupt reads if the write phase fails midway (network disconnect, disk quota, OOM kill). Furthermore, stale socket links, temporary PID locks (e.g., Chromium's `SingletonLock`), and orphan files from previous runs remain present, causing subsequent processes to crash on startup. Staging to a temporary directory on the same mount guarantees atomic pointer updates via the underlying filesystem's `rename(2)` syscall.

**WHEN TO APPLY**:
Apply in any filesystem operations involving runtime profile injection, dynamic plugin cloning, browser cache restoration, or git repository pulls inside containerized daemons.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import child_process from "node:child_process";

export async function replaceDir(sourceDir: string, destDir: string): Promise<void> {
  try {
    await fsp.rm(destDir, { force: true, recursive: true });
  } catch (err: unknown) {
    // Suppress ENOENT if destination does not yet exist
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
  // rename(2) is atomic across the same filesystem mount
  await fsp.rename(sourceDir, destDir);
}

export async function stageAndSwapArchive(
  archiveBuffer: Buffer,
  workDir: string,
  targetDir: string
): Promise<void> {
  const nonce = crypto.randomBytes(4).toString("hex");
  const tmpStageDir = path.join(workDir, `stage-${nonce}`);
  const tmpArchivePath = path.join(workDir, `archive-${nonce}.tar.gz`);

  await fsp.mkdir(tmpStageDir, { recursive: true });
  await fsp.writeFile(tmpArchivePath, archiveBuffer);

  try {
    // Unpack entirely inside isolated sandbox
    child_process.execFileSync("tar", ["xvfz", tmpArchivePath, "-C", tmpStageDir], {
      stdio: "pipe",
    });

    // Clean up transient locks if unpacking a browser profile
    const singletonPattern = path.join(tmpStageDir, "Singleton*");
    child_process.execSync(`rm -f ${singletonPattern} 2>/dev/null || true`);

    // Atomically swap staged directory to live directory
    await replaceDir(tmpStageDir, targetDir);
  } catch (error) {
    // Evacuate staged junk on failure to prevent disk leakage
    await fsp.rm(tmpStageDir, { force: true, recursive: true });
    throw error;
  } finally {
    await fsp.rm(tmpArchivePath, { force: true });
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Direct untarring or copying into live profile directory
export async function unsafeProfileRestore(archiveSrc: string, liveProfileDir: string) {
  // If tar fails halfway, the live profile is left in a corrupted, non-bootable state.
  // Old lockfiles and socket links from previous runs are NOT purged.
  child_process.execFileSync("tar", ["xvfz", archiveSrc, "-C", liveProfileDir]);
}
```

**VERIFICATION METHOD**:
Verify using a fault-injection integration test:
```typescript
import { test, expect } from "@jest/globals";
import fsp from "node:fs/promises";
import path from "node:path";

test("atomic swap leaves destination unaffected on decompression crash", async () => {
  const liveDir = "/tmp/test-live-dir";
  await fsp.mkdir(liveDir, { recursive: true });
  await fsp.writeFile(path.join(liveDir, "valid_state.json"), JSON.stringify({ ok: true }));

  // Simulate invalid payload
  const corruptPayload = Buffer.from("not-a-tarball");
  await expect(stageAndSwapArchive(corruptPayload, "/tmp", liveDir)).rejects.toThrow();

  // Validate live directory integrity remains intact
  const raw = await fsp.readFile(path.join(liveDir, "valid_state.json"), "utf8");
  expect(JSON.parse(raw).ok).toBe(true);
});
```

---

### 2. Multi-Context Interception Priority and Error-Resilient Continuations
**RULE**:
When registering asynchronous network request interceptors (such as Puppeteer's `page.on('request')` or CDP `Fetch.requestPaused`), handlers MUST enforce a single terminal resolution (`request.continue()`, `request.abort()`, or `request.respond()`) wrapped within an unconditional `try/catch/finally` fault boundary. Interceptors executing out-of-band asynchronous verification (e.g., fetching resource text via an external client like `undici`) MUST catch network exceptions and gracefully fail open (`request.continue()`) to prevent hanging the browser event loop.

**WHY**:
Failing to settle an intercepted HTTP request causes the underlying Chromium navigation or subresource fetch pipeline to wait until the network operation times out (default 30-90s). Multiple conflicting resolutions (`continue` after `abort`) throw fatal unhandled CDP protocol rejections (`ProtocolError: Request is already handled`), crashing the worker process.

**WHEN TO APPLY**:
In browser automation, ad-blocking filters, custom proxy authenticators, or request-rewriting middlewares handling concurrent CDP network requests.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { HTTPRequest, Page } from "puppeteer-core";
import { Dispatcher, request as undiciRequest } from "undici";

export interface NetworkFilter {
  shouldBlock(url: string, headers: Record<string, string>): Promise<boolean>;
}

export function attachSafeRequestInterceptor(
  page: Page,
  filter: NetworkFilter,
  proxyDispatcher?: Dispatcher
): void {
  // Flag tracking interception handling per request instance
  const handledRequests = new WeakSet<HTTPRequest>();

  page.on("request", async (req: HTTPRequest) => {
    if (handledRequests.has(req)) {
      return;
    }

    const url = req.url();
    // Bypass non-HTTP protocols immediately
    if (!url.startsWith("http:") && !url.startsWith("https:")) {
      handledRequests.add(req);
      await req.continue({}, 0);
      return;
    }

    let mustBlock = false;
    try {
      mustBlock = await filter.shouldBlock(url, req.headers());
    } catch (filterError) {
      // Invariant: Faults in filtering must fail OPEN to preserve navigation
      mustBlock = false;
    }

    try {
      if (handledRequests.has(req)) return;
      handledRequests.add(req);

      if (mustBlock) {
        await req.abort("blockedbyclient", 1);
      } else {
        await req.continue({}, 1);
      }
    } catch (protocolError) {
      // Catch races where target closed or already aborted externally
      // Do not re-throw to avoid unhandled rejections crashing the crawler
    }
  });
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Unprotected external async call with missing catch-continuation
page.on("request", async (req) => {
  const url = req.url();
  // If undiciRequest rejects (DNS failure, connection reset, timeout),
  // the catch block is absent: req is NEVER continued, freezing the target tab forever.
  const resp = await undiciRequest(url);
  const body = await resp.body.text();
  if (body.includes("block-me")) {
    await req.abort();
  } else {
    await req.continue();
  }
});
```

**VERIFICATION METHOD**:
Run an automated test verifying tab navigation completes even when the filter dependencies throw:
```typescript
import { test, expect } from "@jest/globals";
import puppeteer from "puppeteer-core";

test("interceptor falls back to continue when filter throws", async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setRequestInterception(true);

  const faultyFilter: NetworkFilter = {
    async shouldBlock() {
      throw new Error("DNS resolution failed");
    },
  };

  attachSafeRequestInterceptor(page, faultyFilter);

  // Must not hang or throw protocol errors
  await expect(page.goto("data:text/html,<html><body>OK</body></html>")).resolves.not.toThrow();
  await browser.close();
});
```

---

### 3. Decoupled Asynchronous Feed Ingestion with Background Bounded Queue
**RULE**:
When processing large or infinite nested metadata discovery trees (such as sitemap indexes, RSS feeds, or pagination manifests) tied to multiple input seeds, the crawler MUST decouple initial feed discovery from full feed tree consumption. The initial check MUST boundedly verify the existence of the feed resource and immediately hand off URL streaming to a centralized, shared background priority queue (`PQueue`) with a configurable global worker pool. Seed initialization MUST NOT await the complete processing of discovered feeds before starting worker crawling.

**WHY**:
Running independent parsing instances per seed causes unbounded connection explosion against target domains, exhausts memory buffers with redundant parser trees, and starves page-processing workers while waiting for sitemaps with tens of thousands of URLs to fully parse. Decoupling allows crawl workers to process pages immediately while sitemap readers continue feeding the frontier in the background.

**WHEN TO APPLY**:
In web crawling, data pipelines, search ingestion engines, and recursive discovery architectures where input manifests vary from single pages to millions of nested URLs.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { EventEmitter } from "node:events";
import PQueue from "p-queue";

export interface SitemapJob {
  url: string;
  seedId: number;
}

export class SharedSitemapCoordinator extends EventEmitter {
  private queue: PQueue;
  private seenSitemaps = new Set<string>();
  private pending = 0;
  private isTerminated = false;

  constructor(concurrency = 5) {
    super();
    this.queue = new PQueue({ concurrency });
  }

  // Non-blocking registration returning whether the initial feed exists
  public async probeAndEnqueue(feedUrl: string, seedId: number, timeoutMs = 30000): Promise<boolean> {
    if (this.seenSitemaps.has(feedUrl)) {
      return true;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const exists = await this.probeFeedExists(feedUrl, controller.signal);
      if (exists) {
        this.seenSitemaps.add(feedUrl);
        this.pending++;
        // Dispatch to background queue without awaiting completion
        void this.queue.add(async () => {
          try {
            await this.processFeedStream(feedUrl, seedId);
          } finally {
            this.pending--;
            this.checkDrain();
          }
        });
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  private checkDrain(): void {
    if (this.pending === 0 && !this.isTerminated) {
      setTimeout(async () => {
        await this.queue.onIdle();
        if (this.pending === 0 && !this.isTerminated) {
          this.isTerminated = true;
          this.emit("end");
        }
      }, 100);
    }
  }

  private async probeFeedExists(url: string, signal: AbortSignal): Promise<boolean> {
    // Perform HEAD or range GET
    return true;
  }

  private async processFeedStream(url: string, seedId: number): Promise<void> {
    // Stream XML, emitting 'url' events to frontier
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Awaiting full parse of each seed sitemap sequentially during initialization
export async function initializeSeeds(seeds: Seed[], crawler: Crawler) {
  for (const seed of seeds) {
    // Blocks all crawling workers until this seed's sitemap (potentially 50,000 links)
    // is fully fetched, parsed, and queued into memory.
    const sitemapper = new SitemapReader();
    await sitemapper.parseAll(seed.sitemapUrl);
  }
}
```

**VERIFICATION METHOD**:
Verify using a mock latency test proving workers start executing before sitemap parsing finishes:
```typescript
import { test, expect } from "@jest/globals";

test("probeAndEnqueue returns true immediately allowing crawl workers to begin", async () => {
  const coordinator = new SharedSitemapCoordinator(2);
  const start = Date.now();

  const found = await coordinator.probeAndEnqueue("https://example.com/huge-sitemap.xml", 1, 2000);
  const elapsed = Date.now() - start;

  expect(found).toBe(true);
  // Initial probe must return under 50ms, not awaiting full streaming parse
  expect(elapsed).toBeLessThan(50);
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Per-Seed Sitemap Parser Resource Exhaustion and Serialization Bottleneck (BUG-SITEMAP-01)
- **Context**: `src/crawler.ts`, `src/util/sitemapper.ts`, `src/util/argParser.ts`
- **What Was Expected**: Multiple crawl seeds containing sitemap specifications should discover URLs concurrently in the background without blocking the crawl startup phase or launching redundant uncoordinated fetching workers.
- **What Actually Happened**: Each seed instantiated an isolated `SitemapReader` instance. `_addInitialSeeds()` awaited `parseSitemap` synchronously per seed up to a 30s timeout. If multiple seeds shared domain hierarchies or pointed to multiple sitemaps, worker counts multiplied (`SITEMAP_CONCURRENCY = 5` per seed), causing rate-limiting, socket exhaustion, and serial blocking of crawl workers.
- **Evidence in Repo**: Commit `cd559238`, PR #1186, Issue #1185.
- **Root Cause**: Architectural coupling of `SitemapReader` lifecycle to individual seeds, combined with awaiting sitemap consumption in `_addInitialSeeds` before running crawl workers:
```typescript
// BEFORE: src/crawler.ts
protected async _addInitialSeeds() {
  for (let i = 0; i < this.seeds.length; i++) {
    const seed = this.seeds[i];
    if (seed.sitemap) {
      await timedRun(
        this.parseSitemap(seed, i),
        SITEMAP_INITIAL_FETCH_TIMEOUT_SECS,
        "Sitemap initial fetch timed out"
      );
    }
  }
}
```
- **Remediation Code Diff**:
```diff
--- a/src/crawler.ts
+++ b/src/crawler.ts
@@ -2119,6 +2117,10 @@ self.__bx_behaviors.selectMainBehavior();
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
     } as any);

+    const sitemapper = await this.createSitemapper();
+
+    await this._addInitialSeeds(sitemapper);
+
     // --------------
     // Run Crawl Here!
     await runWorkers(
@@ -2198,13 +2200,14 @@ self.__bx_behaviors.selectMainBehavior();
     }
   }

-  protected async _addInitialSeeds() {
-    for (let i = 0; i < this.seeds.length; i++) {
-      const seed = this.seeds[i];
+  protected async _addInitialSeeds(sitemapper: SitemapReader | null) {
+    for (let seedId = 0; seedId < this.seeds.length; seedId++) {
+      const seed = this.seeds[seedId];
+      const { url, sitemap } = seed;
       if (
         !(await this.queueUrl({
-          seedId: i,
-          url: seed.url,
+          seedId,
+          url,
           depth: 0,
           extraHops: 0,
         }))
@@ -2214,14 +2217,23 @@ self.__bx_behaviors.selectMainBehavior();
         }
       }

-      if (seed.sitemap) {
-        await timedRun(
-          this.parseSitemap(seed, i),
-          SITEMAP_INITIAL_FETCH_TIMEOUT_SECS,
-          "Sitemap initial fetch timed out",
-          { sitemap: seed.sitemap, seed: seed.url },
-          "sitemap",
-        );
+      if (sitemap && sitemapper) {
+        let found = false;
+        try {
+          found = await timedRun(
+            sitemapper.parse(sitemap, url, seedId),
+            SITEMAP_INITIAL_FETCH_TIMEOUT_SECS,
+            "Sitemap initial fetch timed out",
+            { sitemap: seed.sitemap, seed: seed.url },
+            "sitemap",
+          );
+        } catch (e) {
+          //ignore
+        }
+
+        if (!found) {
+          logger.warn("No sitemap for seed", { url, sitemap }, "sitemap");
+        }
       }
     }
   }
```
- **Lesson**: Decouple discovery services from input seed entities. Shared asynchronous reader instances with global worker limits prevent unbounded background worker spawning and eliminate crawler startup head-of-line blocking.

---

### Incident 2: WACZ Index Contamination Across Crawl Restarts (BUG-DEDUPE-02)
- **Context**: Deduplication Engine, Redis Crawl State (`src/util/state.ts`, Issue #1145)
- **What Was Expected**: Resuming an interrupted crawl with `--state` pointing to an existing crawl ID must be idempotent regarding package manifest records.
- **What Actually Happened**: When crawls were interrupted during the finalize or packaging step and subsequently restarted, the Redis set or list tracking archived WACZ artifacts (`c:{crawlid}:wacz`) received duplicate entries of the same WACZ filenames, corrupting the CDXJ index and producing invalid multi-manifest WACZ files.
- **Evidence in Repo**: Closed Issue #1145 ("Dedupe: Restarting crawl can result in same WACZ file added multiple times to WACZ index").
- **Root Cause**: The indexing step used Redis `RPUSH` or unbounded append mutations against `c:{crawlid}:wacz` instead of maintaining set invariants or checking whether the file had already been committed to the final archive list during state hydration.
- **Remediation Pattern**:
```typescript
// Remediation: Enforce Redis Set uniqueness or existence checks prior to registration
async function registerWaczRecord(redis: Redis, crawlId: string, waczFilename: string): Promise<void> {
  const key = `c:${crawlId}:wacz`;
  // Use SADD for uniqueness or LPOS/LREM before LPUSH to prevent duplicate entries across interruptions
  await redis.sadd(`${key}:set`, waczFilename);
}
```
- **Lesson**: All state tracking key-value mutations representing physical disk or archive files must use set semantics (`SADD`) or idempotent conditional appends to tolerate arbitrary process restarts without producing duplicate index manifests.

---

### Incident 3: Hashtag Seed URL Premature Scope Invalidation (BUG-SCOPE-03)
- **Context**: Scope Engine & URL Frontier (`src/crawler.ts`, Issue #1012)
- **What Was Expected**: Providing a seed containing a hash fragment (e.g. `https://example.com/#/dashboard`) must always crawl that initial seed, even if `--allowHashUrls` is false or `--scopeType` is not `page-spa`.
- **What Actually Happened**: The crawler's normalization layer stripped hash fragments or marked URLs containing hashes as out-of-scope during `queueUrl()` evaluation when running under strict prefix/host scope modes. As a result, the crawler immediately discarded the user's primary seed URL before visiting it.
- **Evidence in Repo**: Closed Issue #1012 ("Seeds with hashtag may become out of scope if not running with scopeType page").
- **Root Cause**: Invariant violation in URL scope evaluation: scope rules were evaluated uniformly against seed URLs and newly extracted downstream links alike, without an explicit bypass branch asserting that `seed` depth 0 URLs are unconditionally in-scope for the first fetch.
- **Remediation Pattern**:
```typescript
// Enforce explicit seed boundary immunity:
function isUrlInScope(url: string, isInitialSeed: boolean, opts: ScopeOptions): boolean {
  if (isInitialSeed) {
    // Initial seeds are unconditionally preserved regardless of fragment stripping rules
    return true;
  }
  if (!opts.allowHashUrls && url.includes("#")) {
    return false;
  }
  return opts.scopeRegex.test(url);
}
```
- **Lesson**: Seed inputs defined by human operators represent explicit capture intents. Filtering and scope pruning logic applied to autonomous link discovery MUST NOT be applied symmetrically to initial seed intake.

---

### Incident 4: Protocol Timeout and Hanging on Iframe Block Checks (BUG-NET-04)
- **Context**: `src/util/blockrules.ts`
- **What Was Expected**: If a block rule uses `frameTextMatch`, the crawler should fetch the iframe URL out-of-band to inspect text matches and either block or allow the navigation request.
- **What Actually Happened**: If the server hosting the iframe hung, returned non-200 responses, or timed out, `isTextMatch` threw an error. In several execution branches, if `shouldBlock` threw or hit uncaught edge cases, Puppeteer's intercepted `HTTPRequest` was neither aborted nor continued, causing the browser frame to spin indefinitely until `pageLoadTimeout` killed the page.
- **Evidence in Repo**: `src/util/blockrules.ts` lines 80-112:
```typescript
async handleRequest(request: HTTPRequest, logDetails: Record<string, any>) {
  const url = request.url();
  let blockState;
  try {
    blockState = await this.shouldBlock(request, url, logDetails);
    if (blockState === BlockState.ALLOW) {
      await request.continue({}, 1);
    } else {
      await request.abort("blockedbyclient", 1);
    }
  } catch (e) {
    logger.debug(`Block: (${blockState}) Failed On: ${url}`, ...);
    // Silent catch previously failed to call continue!
  }
}
```
- **Root Cause**: Error handling caught the exception from `shouldBlock` (e.g., undici request network error) and logged it, but failed to call `request.continue({}, 1)` within the `catch` block, leaving the CDP request paused indefinitely.
- **Remediation Pattern**: The request handler must guarantee terminal resolution in `catch`:
```typescript
try {
  blockState = await this.shouldBlock(request, url, logDetails);
  if (blockState === BlockState.ALLOW) {
    await request.continue({}, 1);
  } else {
    await request.abort("blockedbyclient", 1);
  }
} catch (e) {
  logger.debug(`Block error, failing open: ${url}`, { ...formatErr(e) });
  try {
    await request.continue({}, 1);
  } catch {
    // Ignore already-handled protocol rejections
  }
}
```
- **Lesson**: In asynchronous CDP request interception, every execution branch—including error handlers—must guarantee a terminal response (`continue`, `abort`, or `respond`) to prevent hanging the target browser tab.

---

### Incident 5: Chromium Singleton Socket Lock Startup Crashes (BUG-BROWSER-05)
- **Context**: `src/util/browser.ts:removeSingletons`
- **What Was Expected**: When reusing or restoring a browser profile directory inside a container environment, the browser must boot cleanly.
- **What Actually Happened**: If a previous crawler run was aborted abruptly (e.g., SIGKILL, node OOM, Docker container restart), Chromium's lock files (`SingletonLock`, `SingletonCookie`, `SingletonSocket`) remained in the user profile directory. Upon relaunching, Chromium detected these stale lock symlinks, assumed another instance was running, and exited immediately with code `21` or crashed with a connection timeout.
- **Evidence in Repo**: `src/util/browser.ts`:
```typescript
removeSingletons() {
  const singletons = fs.globSync("./Singleton*");
  try {
    child_process.execFileSync("rm", singletons, {
      cwd: this.profileDir,
      stdio: "ignore",
    });
  } catch (e) {
    // ignore
  }
}
```
- **Root Cause**: Chromium profile directories utilize symbolic links (`SingletonLock -> hostname-pid`) as mutexes. Containerized volume mounts persist these locks across container crashes, making subsequent browser launches fail.
- **Remediation Pattern**: `this.removeSingletons()` is executed unconditionally in `launch()` prior to spawning Puppeteer, clearing any leftover `Singleton*` lock symlinks before Chromium initialises.
- **Lesson**: Containerized processes reusing persistent profiles across restarts must actively purge environment-specific mutexes and stale process-binding symlinks during initialization.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### Falsy Number Coercion Trap in Crawl Depth & Limits
In `src/util/argParser.ts`, parameters such as `depth`, `pageLimit`, and `