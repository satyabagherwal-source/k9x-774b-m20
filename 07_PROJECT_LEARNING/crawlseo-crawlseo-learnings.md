> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/crawlseo-crawlseo-learnings.md`  
> **Source**: github ([https://github.com/crawlseo/crawlseo](https://github.com/crawlseo/crawlseo))  
> **Source Version**: `77e3c644`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-27T22:00:14.192Z  
> **Learning ID**: `learn-github-crawlseo-crawlseo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): crawlseo/crawlseo

---

## 1. Executive Forensic Architecture & System Mechanics

`crawlseo` is an open-source, self-hosted search engine optimization (SEO) automation platform written in TypeScript (Next.js 16 App Router, React 19, Prisma ORM 6, PostgreSQL, and Node.js 20). It consolidates Google Search Console (GSC) analytics, Core Web Vitals profiling, backlink telemetry, Model Context Protocol (MCP) tool serving, and an asynchronous HTTP crawler into a dual-runtime model: an interactive Web App frontend/API and a dedicated background Worker daemon (`worker.cjs`).

```
                              ┌─────────────────────────────────────────────────────────┐
                              │                    PostgreSQL Engine                    │
                              │  - "Job" Table (Fenced State, SKIP LOCKED Queuing)      │
                              │  - "Crawl" Table (Execution state, page link graph)     │
                              │  - "WorkerHeartbeat" Table (Ephemeral liveness leasing) │
                              └────────────────────────────┬────────────────────────────┘
                                                           │
                   ┌───────────────────────────────────────┴──────────────────────────────────────┐
                   │ ACID Transactions / SELECT ... FOR UPDATE SKIP LOCKED                         │
                   ▼                                                                               ▼
     ┌───────────────────────────┐                                                   ┌───────────────────────────┐
     │   Next.js Edge / Node     │                                                   │      Worker Daemon        │
     │     Web App Layer         │                                                   │       (worker.cjs)        │
     │                           │                                                   │                           │
     │  - NextAuth Session Fencing│                                                   │  - JobLoop Polling Daemon │
     │  - SSRF Verification      │                                                   │  - Dual Concurrency Pools │
     │  - Ephemeral Manual Queue │                                                   │    (LONG vs SHORT)        │
     │  - Read-Only MCP Server   │                                                   │  - Undici Pinned Resolver │
     └─────────────┬─────────────┘                                                   └─────────────┬─────────────┘
                   │                                                                               │
                   ▼                                                                               ▼
     ┌───────────────────────────┐                                                   ┌───────────────────────────┐
     │   External Integrations   │                                                   │  Target Web Infrastructure│
     │  - Google Search Console  │                                                   │  - RFC 9309 robots.txt    │
     │  - DataForSEO (BYOK)      │                                                   │  - HTML Page Snapshots    │
     │  - User Webhook Endpoints │                                                   │  - DNS Rebinding Shield   │
     └───────────────────────────┘                                                   └───────────────────────────┘
```

### Architectural Subsystem Boundaries & Decoupling

1. **Job Scheduling & State Fencing Engine (`lib/jobs`)**:
   - Implements a resilient Postgres-backed FIFO priority queue using row-level locking via `SELECT ... FOR UPDATE SKIP LOCKED`.
   - Divides work into discrete execution classes: `LONG` jobs (e.g., site crawls spanning hundreds of pages with polite crawl delays) and `SHORT` jobs (e.g., webhook dispatch, vitals sync).
   - Manages split concurrency pools to prevent short operational jobs from starving behind compute-heavy crawls.
   - Enforces optimistic lock fencing: Every mutation to a running job filters on `{ id, lockedBy, status: "RUNNING" }`. If worker heartbeat timeout expires and a stale recovery process reclaims the row, the original executing worker's writes silently return `{ count: 0 }`, neutralizing zombie writes.

2. **Network Perimeter & SSRF Isolation Subsystem (`lib/crawler/engine.ts`, `lib/webhooks/address.ts`)**:
   - Protects the self-hosted host network from server-side request forgery (SSRF) and DNS rebinding attacks.
   - Operates a dual-stage network barrier: An asynchronous pre-flight address check (`assertPublicUrl`/`assertWebhookTarget`) followed by a pinned custom DNS lookup function (`pinnedLookupWith`) passed directly into Undici's connection `Agent`.
   - Utilizes `net.BlockList` against IPv4 and IPv6 subnets, link-local, loopback, CGNAT (RFC 6598), private address spaces (RFC 1918), and IPv4-mapped IPv6 encodings (`::ffff:x.x.x.x`).

3. **Crawl Lifecycle & Recovery Shield (`lib/crawler/lifecycle.ts`)**:
   - Manages non-job and job-backed crawl state machines across unplanned process terminations (OOM killer, Docker container deployment, VM reboot).
   - Tracks distributed liveliness via `lastProgressAt` timestamps updated every 5,000 ms during active fetching.
   - Evaluates process startup temporal invariants (`PROCESS_STARTED_AT = new Date(Date.now() - process.uptime() * 1000)`) to distinguish across node restarts and automatically mark dead zombie crawls as `FAILED`, preventing 409 conflict deadlocks.

4. **Alert Webhook Delivery System (`app/api/user/webhook`, `lib/webhooks`)**:
   - Delivers HMAC-signed SHA-256 JSON payloads across webhook subscribers.
   - Enforces network policy splits: Public-only internet targets by default, with opt-in private RFC 1918 resolution (`ALERT_WEBHOOK_ALLOW_PRIVATE=true`) designed for internal container networks (e.g., n8n, internal webhooks) while strictly retaining link-local and cloud metadata blocks (`169.254.169.254`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Fenced Mutex Halt-Before-Release Invariant on Process Termination
**RULE**:
On process shutdown, SIGTERM, or unhandled crash, an asynchronous job-polling worker MUST completely halt task acquisition (clear polling intervals and await in-flight claim transactions) BEFORE invoking queue release or state rollback handlers. It MUST NEVER release in-flight jobs back to the persistent queue while the consumer loop retains claiming capability.

**WHY**:
Releasing tasks back to a shared broker/database while the local claim loop is still listening or executing an active polling iteration produces an immediate TOCTOU (Time-of-Check to Time-of-Use) race condition. The local worker thread will observe the newly released job in the database, claim it again in the same event loop tick, and then terminate immediately thereafter due to process exit (`process.exit(1)`). This resets the job attempts counter, causes duplicate execution, leads to cascade job failure, and leaves the database record in an orphaned `RUNNING` or `STALE` state on worker death.

**WHEN TO APPLY**:
Apply to any distributed worker daemon, consumer loop, Kafka/RabbitMQ subscriber, or database polling queue implemented in asynchronous event-driven runtimes (Node.js, Go goroutines, Python asyncio).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Production Invariant from: lib/jobs/loop.ts & worker/worker.ts
export class JobLoop {
  private stopping = false;
  private timers: NodeJS.Timeout[] = [];
  private ticking: Promise<number> | null = null;

  public get halted(): boolean {
    return this.stopping;
  }

  /**
   * STAGE 1: Halts claiming.
   * Clears timers and awaits the active claim transaction so that every job
   * this process will ever hold is already fully registered in the runner.
   */
  public async halt(): Promise<void> {
    this.stopping = true;
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
    // Await running claim transaction to settle; ignore inner failure
    await this.ticking?.catch(() => 0);
  }

  /**
   * STAGE 2: Graceful stop.
   * Only after halt() guarantees no new jobs can enter, release running tasks.
   */
  public async stop(graceMs: number): Promise<void> {
    if (this.stopping) return;
    await this.halt();

    // Release immediate-cancel jobs (e.g., crawls) back to queue
    this.runner.release((handler) => handler?.stopOnShutdown === true);
    
    // Await in-flight promises or force release after timeout
    const all = Promise.allSettled([...this.inflight]);
    const timedOut = await Promise.race([
      all.then(() => false),
      new Promise<boolean>((resolve) => 
        setTimeout(() => resolve(true), graceMs).unref?.()
      ),
    ]);

    if (timedOut) {
      await this.runner.forceReleaseAll();
    }
  }
}

// Worker crash handler invocation order:
export function crashHandlers(worker: Worker) {
  process.on("uncaughtException", async (err) => {
    try {
      const putBack = (async () => {
        // 1. MUST halt the consumer loop first
        await worker.loop.halt();
        // 2. Safe to return held claims back to the queue
        return worker.loop.runner.forceReleaseAll();
      })();

      await Promise.race([
        putBack,
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    } finally {
      process.exit(1);
    }
  });
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Releasing locks before stopping poll loop
process.on("uncaughtException", async () => {
  // CRITICAL HAZARD: Runner resets rows to 'QUEUED' in DB
  await worker.runner.forceReleaseAll();
  
  // Meanwhile, the polling loop timer fires or an active claim query resolves:
  // worker.loop.claimOnce() executes SELECT ... FOR UPDATE SKIP LOCKED
  // It RE-CLAIMS the job it just put back, then the process exits immediately!
  worker.loop.stop();
  process.exit(1);
});
```

**VERIFICATION METHOD**:
Mock the execution runner and capture the strictly ordered step trace. Assert that the `halt` invocation strictly precedes `forceReleaseAll`, and that `loop.halted === true` at the exact moment of database release:
```typescript
const order: string[] = [];
vi.spyOn(loop, "halt").mockImplementation(async () => {
  order.push("halt");
});
vi.spyOn(runner, "forceReleaseAll").mockImplementation(async () => {
  order.push("release");
  expect(loop.halted).toBe(true);
});
await crashHandler();
expect(order).toEqual(["halt", "release", "exit"]);
```

---

### 2. Dual-Barrier Pinned DNS Resolution for SSRF & Rebinding Shielding
**RULE**:
When issuing outbound HTTP requests to user-supplied or crawled web targets, an application MUST NOT rely solely on pre-flight hostname checks (e.g., checking `isPrivateIp` once before `fetch`). It MUST inject a custom resolver (`lookup` function) into the transport socket agent that evaluates the resolved IP against an IP blocklist at the exact moment the socket connects, and returns only the validated IP to the socket.

**WHY**:
Pre-flight checks without socket-level pinned lookup are completely vulnerable to DNS Rebinding Attacks (TOCTOU). A malicious domain can return a benign public IP (TTL: 0s or 1s) to satisfy `assertPublicUrl()`, and immediately resolve to an internal AWS/GCP metadata address (`169.254.169.254`) or loopback (`127.0.0.1`) when the HTTP client's internal transport layer resolves the connection socket. Pre-flight and connection MUST share the exact same validated IP set.

**WHEN TO APPLY**:
Applies to crawlers, webhooks, proxy engines, link preview generators, and RSS feed fetchers interacting with untrusted external URLs.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Production Invariant from: lib/crawler/engine.ts & lib/webhooks/address.ts
import { BlockList, isIPv4, isIPv6, type LookupFunction } from "net";
import { lookup } from "dns/promises";
import type { LookupAddress } from "dns";
import { Agent } from "undici";

const PRIVATE_RANGES = new BlockList();
// Populate IPv4 ranges: 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, etc.
// Populate IPv6 subnets: ::1/128, fc00::/7, fe80::/10, ::ffff:0:0/96, etc.

export function isPrivateIp(ip: string): boolean {
  // Catch IPv4-mapped IPv6 literals explicitly before passing to blocklist
  const v4mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4mapped) return isPrivateIp(v4mapped[1]);

  if (isIPv4(ip)) return PRIVATE_RANGES.check(ip, "ipv4");
  if (isIPv6(ip)) return PRIVATE_RANGES.check(ip, "ipv6");
  return true; // Fail closed if format is unknown
}

export async function checkedAddresses(
  hostname: string, 
  blockedRule: (ip: string) => boolean
): Promise<LookupAddress[]> {
  const addresses = await lookup(hostname, { all: true });
  // Invariant: If ANY resolved address for the host is disallowed, reject ALL.
  if (addresses.length === 0 || addresses.some((a) => blockedRule(a.address))) {
    throw new Error(`Access Denied: ${hostname} resolved to illegal address.`);
  }
  return addresses;
}

export function pinnedLookupWith(blockedRule: (ip: string) => boolean): LookupFunction {
  return (hostname, options, callback) => {
    const family = options.family === 4 || options.family === "IPv4" ? 4
      : options.family === 6 || options.family === "IPv6" ? 6
      : 0;

    checkedAddresses(hostname, blockedRule)
      .then((addresses) => {
        const usable = family ? addresses.filter((a) => a.family === family) : addresses;
        if (usable.length === 0) {
          throw Object.assign(new Error(`No IPv${family} address for ${hostname}`), { 
            code: "ENOTFOUND" 
          });
        }
        // Hand the socket only the verified addresses from the exact DNS check
        callback(null, usable as any);
      })
      .catch((err) => callback(err, [] as any));
  };
}

// Undici client instantiation with pinned socket lookup
export function createSafeDispatcher(allowPrivate: boolean): Agent {
  return new Agent({
    connect: {
      lookup: pinnedLookupWith((ip) => isPrivateIp(ip)),
    },
  });
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Vulnerable to DNS Rebinding TOCTOU
async function insecureFetch(targetUrl: string) {
  const { hostname } = new URL(targetUrl);
  const addresses = await dns.promises.lookup(hostname);
  
  if (isPrivateIp(addresses.address)) {
    throw new Error("Private IP blocked");
  }

  // BUG: fetch() resolves DNS a second time! An attacker DNS server returns
  // 1.1.1.1 on the first call, and 169.254.169.254 on the fetch connection.
  return fetch(targetUrl);
}
```

**VERIFICATION METHOD**:
Configure an automated integration test against a DNS server that alternates responses between a public IP and `127.0.0.1` on consecutive requests. Assert that `createSafeDispatcher` refuses the connection with `ENOTFOUND` or `Access Denied` at the socket level.

---

### 3. Fenced Heartbeat Leasing Invariant for Long-Running Mutations
**RULE**:
In distributed background job processing where tasks exceed typical request timeouts, every persistent update modifying application entities MUST be fenced on the job's active lease token (`lockedBy`) and current state (`RUNNING`). If a lease heartbeat expires, the job runner MUST NOT assume ownership; all persistence operations MUST fail closed or detect lease loss via row count verification (`count === 1`).

**WHY**:
Network partitions, CPU starvation, or full garbage collection pauses can cause worker heartbeats to lapse, prompting maintenance workers to mark the job as stale and reassign it to another node. If the delayed worker wakes up and executes database writes without lease fencing, it will overwrite the work of the newly assigned worker, corrupting system state, duplicating page crawl entities, or producing phantom statuses.

**WHEN TO APPLY**:
Background batch processing, multi-page web crawlers, video rendering tasks, or database migration pipelines.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Production Invariant from: lib/jobs/queue.ts
export async function markSucceeded(
  db: PrismaClient,
  job: { id: string },
  workerId: string,
  result: Prisma.InputJsonValue | undefined,
  now: Date = new Date()
): Promise<boolean> {
  // CRITICAL: The update is strictly fenced against ID, lockedBy, and status.
  const { count } = await db.job.updateMany({
    where: {
      id: job.id,
      lockedBy: workerId,
      status: "RUNNING",
    },
    data: {
      status: "SUCCEEDED",
      finishedAt: now,
      activeKey: null,
      result: result ?? Prisma.DbNull,
      lastError: null,
      errorCode: null,
    },
  });

  // If count is 0, the worker was preempted and the result MUST be discarded.
  return count === 1;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blind update without fencing
export async function markSucceededUnfenced(db: PrismaClient, jobId: string) {
  // FATAL: If another worker recovered and claimed this job, this write corrupts
  // the active state and overwrites the second worker's active run.
  await db.job.update({
    where: { id: jobId },
    data: { status: "SUCCEEDED" },
  });
}
```

**VERIFICATION METHOD**:
Write a test that acquires a job under `workerId = "worker-A"`, updates `lockedBy = "worker-B"` directly in the database to simulate lease preemption, and invokes `markSucceeded(..., "worker-A")`. Assert that the returned status is `false` and the database record remains unmodified.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Worker Re-Claiming Released Jobs on Crash Loop Exit (BUG-WORKER-RECLAIM-01)
- **Context**: `lib/jobs/loop.ts`, `worker/worker.ts`, `worker/worker.test.ts`
- **What Was Expected**: When an uncaught exception occurred, the worker process was supposed to return all currently running jobs back to the PostgreSQL queue with `attempts: 0` (or decremented attempts) so peer workers could execute them, followed by an immediate exit (`process.exit(1)`).
- **What Actually Happened**: The worker crashed, invoked `runner.forceReleaseAll()` to return jobs to `QUEUED`, but the consumer loop was still actively polling (`ticking`). The polling loop claimed the exact same job back before the process terminated. The job was left locked by a dead worker, causing it to sit dormant until the stale timeout elapsed (`JOB_STALE_SECONDS`).
- **Evidence in Repo**: Commit `39f953b4`. Pull Request #96.
- **Root Cause**: `JobLoop.stop()` and crash handlers lacked an isolated claiming halt step. `forceReleaseAll()` ran while `this.stopping` was still false and timers/in-flight queries were active.
- **Remediation Code Diff**:
```typescript
// lib/jobs/loop.ts
+  /** True once halt() or stop() ran: the loop claims nothing more. */
+  get halted(): boolean {
+    return this.stopping;
+  }
+
+  /**
+   * Stops claiming: clears the timers and waits for a claim in progress, so
+   * every job this process will ever hold is in the runner when it returns.
+   * Running jobs are left alone.
+   */
+  async halt(): Promise<void> {
+    this.stopping = true;
+    for (const t of this.timers) clearInterval(t);
+    this.timers = [];
+    await this.ticking?.catch(() => 0);
+  }

// worker/worker.ts
       try {
         const worker = current();
         if (worker) {
+          const putBack = (async () => {
+            await worker.loop.halt();
+            return worker.loop.runner.forceReleaseAll();
+          })();
           const released = await Promise.race([
-            worker.loop.runner.forceReleaseAll(),
+            putBack,
             new Promise<number>((resolve) => setTimeout(() => resolve(-1), CRASH_RELEASE_MS)),
           ]);
```
- **Lesson**: Resource release during teardown must strictly follow a **Halt Acquisition $\rightarrow$ Flush/Release In-Flight $\rightarrow$ Terminate Runtime** sequence. Never push released resources back to a shared bus while local listeners can consume them.

---

### Incident 2: Zombie Crawl Indefinite 409 Lockout on Container Restart (BUG-CRAWL-LOCKOUT-02)
- **Context**: `lib/crawler/lifecycle.ts`, `app/api/sites/[siteId]/crawl/route.ts`
- **What Was Expected**: If a user stopped `npm run dev` or docker-compose restarted during a crawl, the system was expected to detect the interruption and allow subsequent crawls to be scheduled.
- **What Actually Happened**: The `Crawl` record remained in status `RUNNING` permanently. Subsequent clicks on "Run Crawl" returned `409 Conflict {"error": "A crawl is already running"}` indefinitely. The user was permanently locked out from crawling unless they manually edited the PostgreSQL database.
- **Evidence in Repo**: Issue #57, closed 2026-10-06.
- **Root Cause**: Crawls lacked an automated heartbeat expiry and startup reconciliation check. If the process hosting the in-memory crawl died, no entity ever transitioned the `RUNNING` crawl status to `FAILED`.
- **Remediation Code Diff**:
```typescript
// lib/crawler/lifecycle.ts
+ export const PROCESS_STARTED_AT = new Date(Date.now() - process.uptime() * 1000);
+ export const STALE_AFTER_MS = 5 * 60_000;
+ export const RESTART_GRACE_MS = 60_000;
+
+ export function staleCrawlWhere(
+   now: Date = new Date(),
+   processStartedAt: Date = PROCESS_STARTED_AT
+ ): Prisma.CrawlWhereInput {
+   const ago = (ms: number) => new Date(now.getTime() - ms);
+   return {
+     status: { in: ACTIVE_CRAWL_STATUSES },
+     jobs: { none: {} },
+     OR: [
+       quietSince(ago(STALE_AFTER_MS)),
+       { lastProgressAt: null, startedAt: null },
+       { startedAt: { lt: processStartedAt }, ...quietSince(ago(RESTART_GRACE_MS)) },
+     ],
+   };
+ }
+
+ export async function recoverCrawlsOnStartup(db: Db) {
+   await recoverStaleCrawls(db);
+ }
```
- **Lesson**: Stateful entities with long-running lifecycles must couple progress heartbeats with process temporal awareness (`process.uptime()`) on boot to self-heal orphaned states.

---

### Incident 3: Dual Page Count Metric Dissonance in Audit Overview (BUG-PAGE-COUNT-03)
- **Context**: `scripts/seed-demo.ts`, `app/(dashboard)/sites/[siteId]/crawl/page.tsx`
- **What Was Expected**: The crawl overview header count and the table of crawled pages were expected to present a unified, consistent count of crawled documents.
- **What Actually Happened**: The header displayed "42 pages crawled · 24 stored", while the table footer indicated "Showing 24 pages". Users reported confusion over whether 18 pages failed or were dropped.
- **Evidence in Repo**: Issue #56, closed 2026-10-06.
- **Root Cause**: The database query for crawl overview fetched pages capped at `take: 200`, sliced to 100 in the UI, while the crawl record stored raw counters. Meanwhile, demo seed scripts hardcoded arbitrary `pagesFound: 42` while only generating 24 relational `AuditPage` rows.
- **Remediation Code Diff**:
```typescript
// Unified query logic and explicit label scoping
- <span>{crawl.pagesFound} pages crawled · {pages.length} stored</span>
+ <span>
+   {crawl.pagesFound} pages crawled
+   {crawl.pagesFound > pages.length && ` (showing top ${pages.length} by content score)`}
+ </span>
```
- **Lesson**: Bounded UI queries (`LIMIT/take`) must never conflate collection subsets with aggregate entity metrics. Every displayed counter must explicitly qualify its projection boundary.

---

### Incident 4: Prisma CLI Runtime Closure Crash in Standalone Container (BUG-DOCKER-PRISMA-04)
- **Context**: `Dockerfile`, `scripts/stage-prisma-cli.mjs`
- **What Was Expected**: Production container runs `prisma migrate deploy` at boot using the lightweight runner stage without bundling the full development `node_modules`.
- **What Actually Happened**: Container crash-looped at boot with `MODULE_NOT_FOUND` when attempting to execute `prisma migrate deploy`.
- **Evidence in Repo**: Dockerfile inline comments referencing Issue #27 and PR #23.
- **Root Cause**: 
  1. Hand-picked copying of `@prisma/client` and `prisma` omitted transitive dependencies required by the CLI.
  2. Docker `COPY` flattened the symlink at `node_modules/.bin/prisma` into a plain file, causing the Prisma CLI to resolve its internal WASM engine relative to an invalid execution directory path.
  3. Running `npm install` inside the runner under emulated QEMU `arm64` crashed intermittently with `SIGILL`.
- **Remediation Code Diff**:
```dockerfile
# Dockerfile
- COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
- CMD ["npx", "prisma", "migrate", "deploy"]
+ # Stage full runtime dependency closure programmatically computed from builder
+ RUN node scripts/stage-prisma-cli.mjs /app/prisma-cli
...
+ COPY --from=builder /app/prisma-cli ./node_modules
+ # Invoke the CLI's real entry point, not the flattened symlink
+ CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
```
- **Lesson**: Do not invoke CLI symlinks copied across multi-stage Docker builds. Target the concrete runtime entrypoint and trace transitive AST/module dependency closures instead of hand-copying directories.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
- **Implicit Coercion on JSON Response Serialization**:
  In `lib/jobs/queue.ts`, Prisma stores arbitrary JSON payloads. When persisting empty or undefined results:
  ```typescript
  // INVARIANT: Do NOT pass `undefined` to Prisma JSON fields; it omits the column update.
  // Explicitly fallback to `Prisma.DbNull` to write SQL NULL.
  result: result ?? Prisma.DbNull
  ```
- **IPv6 Hostname Bracket Normalization**:
  In `lib/webhooks/address.ts`, `new URL(raw).hostname` preserves square brackets around IPv6 addresses (e.g. `[::1]`). Passing this directly to `dns.lookup` causes `ENOTFOUND`:
  ```typescript
  function bareHost(url: URL): string {
    const host = url.hostname;
    return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  }
  ```
- **URL Path Trailing Slash Normalization**:
  In `lib/crawler/engine.ts`, URL identity checks fail if trailing slashes are inconsistent. However, root path `/` must NOT be stripped:
  ```typescript
  // Token invariant: Slice trailing slash ONLY if pathname length > 1
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  ```

---

### 2. Infinite Loop & Recursion Guards
- **Folded Polling Loop (`again` Re-entrancy Guard)**:
  In `lib/jobs/loop.ts`, concurrent invocations to `tick()` while an active iteration is running MUST NOT spawn parallel loops or trigger recursive stack overflows.
  ```typescript
  tick(): Promise<number> {
    if (this.ticking) {
      this.again = true; // Fold subsequent request into the active loop
      return this.ticking;
    }
    this.ticking = (async () => {
      let started = 0;
      do {
        this.again = false;
        started += await this.claimOnce();
      } while (this.again && !this.stopping); // Guaranteed termination on !again or stopping
      return started;
    })().finally(() => {
      this.ticking = null;
    });
    return this.ticking;
  }
  ```
- **Deterministic Queue Drain Termination**:
  In `lib/jobs/loop.ts`, `drain()` uses a strict invariant where termination occurs only when zero jobs were started AND in-flight set is completely empty:
  ```typescript
  async drain(): Promise<void> {
    for (;;) {
      const started = await this.tick();
      if (started === 0 && this.inflight.size === 0) return;
      if (this.inflight.size > 0) await Promise.race(this.inflight);
    }
  }
  ```
- **Max Hop Redirect Guard**:
  In `lib/crawler/engine.ts`, crawler redirect resolution enforces `MAX_REDIRECTS = 5`. It decrements a counter on each 3xx response and throws `MaxRedirectsError` to prevent circular redirect loops.

---

### 3. UI & UX Micro-Mechanics
- **Secret Regeneration UI Protection**:
  In `components/settings/webhook-section.tsx`, newly generated cryptographically secure webhook secrets (32 bytes hex) are only visible once. Typing into the field clears the generated plaintext display immediately:
  ```typescript
  <input
    value={secret}
    onChange={(e) => {
      setSecret(e.target.value);
      setGenerated(false); // Immediate wipe of plaintext visual helper
      setInvalid(null);
    }}
  />
  {generated && secret && (
    <p className="font-data text-xs break-all text-text">
      <span className="sr-only">Generated secret: </span>
      {secret}
    </p>
  )}
  ```
- **Decorative SVG Layout Thrashing Prevention**:
  In `components/ui/empty-state.tsx`, decorative illustrations bypass Next.js image optimization to eliminate layout shift and client bundle bloat:
  ```typescript
  // Native img used intentionally for static decorative SVGs
  <img
    src={illustrationSrc(illustration)}
    alt=""
    aria-hidden
    width={160}
    height={116}
    loading="lazy"
    decoding="async"
    className="mx-auto mb-4 h-[116px] w-40"
  />
  ```

---

### 4. Backend Concurrency & Memory Safety
- **Postgres Row-Level Lock Fencing (`SKIP LOCKED`)**:
  In `lib/jobs/queue.ts`, high-frequency worker nodes claim jobs concurrently without table-level serialization locks:
  ```sql
  SELECT "id" FROM "Job"
  WHERE "status" = 'QUEUED' AND "runAt" <= ($1::timestamptz AT TIME ZONE 'UTC') AND "type" = ANY($2::text[])
  ORDER BY "priority" DESC, "runAt" ASC, "createdAt" ASC
  LIMIT $3
  FOR UPDATE SKIP LOCKED
  ```
- **Unique Constraint Race Protection (`activeKey`)**:
  To enforce at most one running job per type and site, an `activeKey` is set to `${type}:${siteId}` for `QUEUED` and `RUNNING` rows, and reset to `NULL` upon completion. PostgreSQL treats multiple `NULL` values as distinct, allowing historical records while enforcing uniqueness on active rows.
- **Un