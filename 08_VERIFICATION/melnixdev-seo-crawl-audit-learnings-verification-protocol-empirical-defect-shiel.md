# Verification Protocol: Verification Protocol: Empirical Defect Shield for melnixdev-seo-crawl-audit-learnings

<!-- PROVENANCE_START
{
  "source_repository": "melnixdev-seo-crawl-audit-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T08:53:19.789Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-melnixdev-seo-crawl-audit-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [melnixdev-seo-crawl-audit-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T08:53:19.789Z`  
> **Learning ID**: `LEARN-EVO-melnixdev-seo-crawl-audit-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `melnixdev-seo-crawl-audit-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/melnixdev-seo-crawl-audit-learnings.md`  
> **Source**: github ([https://github.com/MelnixDev/seo-crawl-audit](https://github.com/MelnixDev/seo-crawl-audit))  
> **Source Version**: `abed0505`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-15T08:52:22.370Z  
> **Learning ID**: `learn-github-melnixdev-seo-crawl-audit`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): MelnixDev/seo-crawl-audit

---

## 1. Executive Forensic Architecture & System Mechanics

`seo-crawl-audit` is a local-first, zero-telemetry, regression-oriented technical SEO crawler and audit engine implemented as a modular TypeScript monorepo with CLI interfaces and Model Context Protocol (MCP) tool bindings. It addresses the lack of deterministic audit trails and regression safeguards in web crawlers. Unlike SaaS audit platforms (e.g., Ahrefs, Screaming Frog) that offload crawl artifacts to remote cloud databases or opaque binary files, this engine enforces strict machine-verifiable audit invariants, local-only JSON snapshots, append-only crash-resilient NDJSON checkpoint streams, and deterministic diff engines executed across isolated `node:worker_threads`.

```
               [ CLI / MCP / GitHub Action / Web UI ]
                                 │
                                 ▼
                     packages/core/src/api.ts
                                 │
       ┌─────────────────────────┴─────────────────────────┐
       ▼                                                   ▼
packages/core/src/planning.ts               packages/core/src/crawler.ts
(robots.txt, XML Sitemaps,                  (Per-origin token bucket gate,
 URL canonicalization, Scopes)               DOM parsing, Link Graph)
       │                                                   │
       └─────────────────────────┬─────────────────────────┘
                                 ▼
                  packages/core/src/checkpoint.ts
                  (Atomic NDJSON streaming engine)
                                 │
                                 ▼
                  packages/core/src/baseline.ts
            (Normalized SnapshotV2, Stable Hash Tree)
                                 │
       ┌─────────────────────────┴─────────────────────────┐
       ▼                                                   ▼
packages/core/src/audit.ts                  packages/core/src/compare.ts
(Deterministic Rule Engine,                 (Lifecycle state diff: new, ongoing,
 Fingerprint SHA-256 generation)             unchanged, resolved; Budget Guards)
                                                           │
                                                           ▼
                                           packages/cli/src/*-worker.ts
                                           (Off-thread diff & trend computation)
```

### Critical Subsystem Boundaries and Invariant Contracts

1. **Deterministic Snapshot Contract (`SnapshotV2`)**:
   Snapshots are immutable JSON graphs containing `siteUrl`, `engineVersion`, `ruleSetVersion`, `configurationHash`, `linkGraph`, and a lexicographically sorted array of `PageSnapshot` objects. Every property within `PageSnapshot` is normalized (converting `undefined` to `null`, pruning unstable dynamic attributes, sorting internal/external link arrays, and enforcing NFKC Unicode normalization). The `configurationHash` is derived via SHA-256 over a recursive lexicographically sorted JSON serialization (`stableJson`), guaranteeing that identical crawl configurations generate bitwise-identical hashes regardless of JavaScript object key insertion order.

2. **TOCTOU-Resilient History Catalog (`catalog.v1.json`)**:
   History persistence enforces POSIX-level atomicity against Time-of-Check to Time-of-Use (TOCTOU) file race conditions. Snapshots are validated via `lstat` to reject symbolic links, opened with `O_RDONLY | O_NOFOLLOW`, verified via device ID (`dev`) and inode number (`ino`) matching before and after reads, and catalog metadata is committed via PID- and UUID-tagged temporary files (`${target}.${process.pid}.${randomUUID()}.tmp`) atomically renamed (`rename`) over the target file.

3. **Multi-Threaded Worker Isolation**:
   Because baseline comparison and longitudinal trend computation across 10,000–50,000 URLs impose intensive CPU load, computing diffs or rendering large standalone HTML reports within the Node.js main event loop causes microtask starvation and renders CLI spinners or local web servers (`seo-audit serve`) unresponsive. The engine delegates comparison and trend processing to dedicated `node:worker_threads` (`packages/cli/src/comparison-worker.ts` and `trend-worker.ts`). Workers communicate progress and lifecycle changes via typed message ports and yield structured error payloads without process crashes.

4. **Fault-Tolerant Append-Only Checkpointing**:
   Large crawls are shielded against process aborts (`SIGINT`, out-of-memory, network hang). Crawled pages stream to an append-only `.checkpoint.ndjson` file. The file begins with a header verifying strict scan identity. The parser tolerates incomplete final records resulting from sudden termination during a stream write. Resuming a crawl reads intact lines, ignores the truncated tail, and skips re-crawling URLs with non-5xx, non-error status codes.

---

## 2. Net-New Universal Engineering Rules

### 1. Inode-Anchored Read Verification for Sensitive Local Artifacts
**RULE**:
When reading local serialized files where modification or link replacement during the read cycle could cause data corruption or arbitrary file read vulnerabilities, systems MUST open the path with `O_NOFOLLOW`, capture the file descriptor’s device (`dev`) and inode (`ino`) metadata via `stat()`, verify they match the initial directory traversal `lstat()`, and perform a post-read `fstat()` verification to confirm `ino`, `dev`, `size`, and `mtimeMs` have not drifted prior to processing.

**WHY**:
Standard `fs.readFile()` calls are vulnerable to race conditions where an external process replaces a valid file with a symlink or overwrites the content during the I/O window (TOCTOU). In crawl audit and snapshot systems, loading an invalid or mutated snapshot introduces corrupt differential baselines, generates false-positive regressions, or risks directory traversal exploits.

**WHEN TO APPLY**:
Apply in any CLI, daemon, or engine that loads stored local caches, security baselines, state snapshots, or historical database dumps from user-controlled or shared workspace directories.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { join } from "node:path";

export interface VerifiedFileRead {
  content: string;
  size: number;
  mtimeMs: number;
}

export async function readVerifiedLocalFile(directory: string, filename: string): Promise<VerifiedFileRead> {
  // Reject directory separators to enforce single-level resolution
  if (filename.includes("/") || filename.includes("\\")) {
    throw new Error(`Insecure filename contains directory traversal characters: ${filename}`);
  }

  const fullPath = join(directory, filename);
  const initialStat = await lstat(fullPath);

  if (!initialStat.isFile() || initialStat.isSymbolicLink()) {
    throw new Error(`Target is not a regular file or is a symbolic link: ${fullPath}`);
  }

  // Open with O_NOFOLLOW to atomically reject symlink swaps
  const fileHandle = await open(fullPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const handleStat = await fileHandle.stat();
    if (!handleStat.isFile() || handleStat.ino !== initialStat.ino || handleStat.dev !== initialStat.dev) {
      throw new Error(`File identity mutation detected while acquiring handle: ${fullPath}`);
    }

    const content = await fileHandle.readFile("utf8");

    // Post-read check: verify size and modification timestamp have not changed mid-read
    const postStat = await lstat(fullPath);
    if (
      !postStat.isFile() ||
      postStat.ino !== handleStat.ino ||
      postStat.dev !== handleStat.dev ||
      postStat.size !== handleStat.size ||
      postStat.mtimeMs !== handleStat.mtimeMs
    ) {
      throw new Error(`File content mutated during read operation: ${fullPath}`);
    }

    return { content, size: handleStat.size, mtimeMs: handleStat.mtimeMs };
  } finally {
    await fileHandle.close();
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// CRITICAL ANTI-PATTERN: Direct readFile vulnerable to TOCTOU and symlink injection
import { readFile } from "node:fs/promises";

async function unsafeReadHistory(directory: string, filename: string): Promise<string> {
  // FAILS: No traversal guard, no symlink verification, no inode pinning
  return await readFile(`${directory}/${filename}`, "utf8");
}
```

**VERIFICATION METHOD**:
Verify using a concurrent integration test: spawn a child process that alternates a target file between a genuine file and a symlink pointing outside the workspace (`symlinkSync`) while the reading function executes 1,000 rapid reads. Confirm that 100% of attempts either return valid, untampered content or throw the expected mutation error, with 0 arbitrary read escapes.

---

### 2. Lexicographically Stable Hashing for Configuration Invariants
**RULE**:
Structural configuration objects used as identity keys or integrity hashes MUST NOT be hashed directly via standard `JSON.stringify()`. They MUST be serialized using a recursive lexicographical key-sorting serializer (`stableJson`) that recursively handles nested objects and arrays while escaping non-deterministic or transient fields.

**WHY**:
V8 and other JavaScript runtimes do not guarantee deterministic key enumeration order across different execution paths, optimization tiers, or Node.js versions. If two scan configurations with identical semantics have keys defined in different orders (e.g., `{ timeout: 1000, delay: 50 }` vs `{ delay: 50, timeout: 1000 }`), raw `JSON.stringify` produces distinct strings, causing false-positive cache misses, invalidating comparison baselines, and corrupting regression histories.

**WHEN TO APPLY**:
Apply to configuration hashing, audit finding fingerprinting, database row deduplication, and any deterministic state tree verification.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { createHash } from "node:crypto";

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeConfigurationHash(config: Record<string, unknown>): string {
  return createHash("sha256").update(stableJson(config)).digest("hex");
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// CRITICAL ANTI-PATTERN: Native JSON.stringify produces non-deterministic hashes
export function computeBadHash(config: Record<string, unknown>): string {
  // FAILS: Key ordering mutations alter digest output
  return crypto.createHash("sha256").update(JSON.stringify(config)).digest("hex");
}
```

**VERIFICATION METHOD**:
Property-based testing: Generate randomized nested objects with identical key-value mappings but shuffled key insertion orders. Assert that `computeConfigurationHash(objA) === computeConfigurationHash(objB)` holds true across $10^5$ random permutations.

---

### 3. Attempt-Guarded Token Monotonicity for Asynchronous UI Actions
**RULE**:
Any asynchronous UI feedback operation (e.g., clipboard copy, network validation, background dispatch) that mutates DOM element states and sets automatic reversal timers (e.g., `setTimeout`) MUST register a monotonically increasing integer attempt counter (`currentAttempt = ++attempt`) before awaiting the promise, and MUST guard both the success resolution and the catch block by checking `if (currentAttempt !== attempt) return;` while cancelling any active `resetTimer`.

**WHY**:
Rapid consecutive triggers (e.g., double-clicking a "Copy" button) cause multiple overlapping asynchronous execution frames. If an earlier slow promise resolves *after* a later invocation has already started, or if an older `setTimeout` fires while a newer action is active, the UI enters a race condition: text flickers, error messages overwrite success states, and the element resets prematurely.

**WHEN TO APPLY**:
Apply to all client-side UI buttons, notification banners, copy triggers, and input-validation states that feature asynchronous promises followed by timed visual resets.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
export function attachAsyncActionWithFeedback(buttonElement, statusElement, asyncWorkFn) {
  const originalLabel = buttonElement.textContent;
  let resetTimer;
  let attempt = 0;

  const resetButton = () => {
    clearTimeout(resetTimer);
    buttonElement.textContent = originalLabel;
    buttonElement.classList.remove("action-success");
  };

  buttonElement.addEventListener("click", async () => {
    const currentAttempt = ++attempt;
    resetButton();

    try {
      await asyncWorkFn();
      // Guard against stale asynchronous resolution
      if (currentAttempt !== attempt) return;

      buttonElement.textContent = "Success!";
      buttonElement.classList.add("action-success");
      statusElement.textContent = "";

      resetTimer = setTimeout(resetButton, 2500);
    } catch (err) {
      // Guard against stale error overwriting newer invocation
      if (currentAttempt !== attempt) return;

      resetButton();
      statusElement.textContent = "Operation failed. Please retry manually.";
    }
  });
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// CRITICAL ANTI-PATTERN: Unprotected async DOM mutation with unmanaged timers
button.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied!"; // Stale click will overwrite active state
    setTimeout(() => {
      button.textContent = "Copy"; // Older timer resets newer copy attempt early
    }, 2500);
  } catch {
    button.textContent = "Error";
  }
});
```

**VERIFICATION METHOD**:
Simulate double-click concurrency in headless tests (`node:test` + VM/JSDOM): dispatch two click events 50ms apart where the first clipboard promise resolves in 200ms and the second in 100ms. Assert that the button remains in the `Success!` state for exactly 2500ms after the second click, with zero label flickering or premature resets.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Crawl Budget Override in Non-Interactive Scans (BUG-BUDGET-01)
- **Context**: `packages/cli/src/commands.ts` and `packages/cli/src/args.ts` handling `--json` and sitemap discovery.
- **What Was Expected**: If `maxPages: 2` is explicitly defined in an audit configuration file, a non-interactive execution (`seo-audit scan --json`) MUST honor that limit, crawling at most 2 URLs.
- **What Actually Happened**: In non-interactive mode with a discovered sitemap, the engine crawled 5 URLs, exceeding the configured crawl budget. Conversely, on sites with >100 URLs and a configured budget of 500, it silently stopped at 100 URLs.
- **Evidence in Repo**: Closed Issue #42, reported on version `0.16.1`.
- **Root Cause**: `args.ts` correctly parsed `file.maxPages`, but `selectScan()` in `commands.ts` contained an implicit override: whenever a sitemap was detected and no explicit CLI `--pages` flag was passed, it executed `Math.min(100, plan.candidateCount)`, discarding the configuration file value.
- **Remediation Code Diff**:
```typescript
// - const effectiveLimit = explicitPagesFlag ? cliMaxPages : Math.min(100, plan.candidateCount);
// + const effectiveLimit = explicitPagesFlag ?? resolvedConfig.maxPages ?? Math.min(100, plan.candidateCount);
```
- **Lesson**: Configuration cascades (`CLI flags > Config file > Saved baseline > Defaults`) must be resolved strictly in a single, authoritative configuration resolution phase; downstream execution branches must consume the resolved configuration rather than re-evaluating fallback heuristics.

---

### Incident 2: UI Asynchronous Clipboard Race Condition and Premature Reset (BUG-UI-02)
- **Context**: `docs/site/agent-prompt.js`, commit `b15c71a9`.
- **What Was Expected**: Clicking "Copy agent prompt" copies the prompt to the system clipboard, changes the button label to "Copied!" for 2.5 seconds, and cleanly resets back to original state, even under rapid consecutive clicks.
- **What Actually Happened**: Consecutive clicks caused overlapping timers. An earlier timer cleared the "Copied!" state of a later click prematurely. If clipboard permission failed on an earlier attempt while a second attempt was in flight, the UI reverted to error mode erroneously.
- **Evidence in Repo**: Commit `b15c71a9` and unit test update in `test/site-agent-prompt.test.js`.
- **Root Cause**: Lack of an execution generation counter and failure to clear existing timers prior to initiating an asynchronous clipboard call.
- **Remediation Code Diff**:
```javascript
+  const originalLabel = button.textContent;
+  let resetTimer;
+  let attempt = 0;
+  const resetButton = () => {
+    clearTimeout(resetTimer);
+    button.textContent = originalLabel;
+    button.classList.remove("copy-success");
+  };
   button.hidden = false;
   button.addEventListener("click", async () => {
+    const currentAttempt = ++attempt;
+    resetButton();
     try {
       await navigator.clipboard.writeText(prompt.textContent.trim());
-      status.textContent = "Prompt copied. Paste it into your coding agent to start.";
+      if (currentAttempt !== attempt) return;
+      button.textContent = "Copied!";
+      button.classList.add("copy-success");
+      resetTimer = setTimeout(resetButton, 2500);
+      status.textContent = "";
     } catch {
+      if (currentAttempt !== attempt) return;
+      resetButton();
       preview.open = true;
       prompt.focus();
```
- **Lesson**: Always bind asynchronous UI mutation lifecycles to an monotonically increasing generation token (`currentAttempt = ++attempt`), ensuring stale promises cannot mutate the DOM.

---

### Incident 3: Stale Asset Caching on Documentation Site (BUG-CACHE-03)
- **Context**: `docs/site/index.html`, commit `f0122268`.
- **What Was Expected**: Deploying UI script and CSS enhancements must immediately reflect in returning browsers visiting the public documentation site.
- **What Actually Happened**: Returning visitors received cached versions of `site.css` and `agent-prompt.js` with mismatched class hooks (`.copy-success`), breaking the visual copy feedback loop.
- **Evidence in Repo**: Commit `f0122268`.
- **Root Cause**: Assets were linked with a static development query string (`?v=agent-prompt-1`), allowing CDN and client HTTP caches to serve stale scripts.
- **Remediation Code Diff**:
```html
-<link rel="stylesheet" href="site.css?v=agent-prompt-1">
+<link rel="stylesheet" href="site.css?v=0.17.5-copy">
 ...
-<script src="agent-prompt.js" defer></script>
+<script src="agent-prompt.js?v=0.17.5-copy" defer></script>
```
- **Lesson**: Static site assets without content-hash-based filenames must incorporate deterministic release-version query vectors across all HTML integration boundaries.

---

### Incident 4: Semantic Drift in Localization Metric Disclaimer (BUG-I18N-04)
- **Context**: `packages/core/src/site-metrics.ts`, Issue #37, fixed in release `0.17.4` via PR #49.
- **What Was Expected**: The Ukrainian localization of the metric `search.indexable-estimate` must accurately communicate that the count represents pages *eligible* for indexing based on crawl heuristics, without implying confirmed Google indexation.
- **What Actually Happened**: Ukrainian translation read: `Орієнтовна кількість індексованих сторінок` ("Estimated already-indexed pages"), directly contradicting the English disclaimer and making an unverified indexing claim.
- **Evidence in Repo**: Issue #37, release notes `docs/releases/0.17.4.md`.
- **Root Cause**: Translation overlooked the distinction between "indexable" (crawler-observed status) and "indexed" (search engine confirmation).
- **Remediation Code Diff**:
```typescript
// - "search.indexable-estimate": "Орієнтовна кількість індексованих сторінок",
// + "search.indexable-estimate": "Орієнтовна кількість сторінок, доступних для індексації",
```
- **Lesson**: Metric labels in audit systems must separate crawler-observed capabilities from external platform realities. Test suites must enforce semantic reviews for technical claims across all supported locales.

---

### Incident 5: Upstream Core Dependency Version Mismatch in Lockfile (BUG-DEP-05)
- **Context**: `package-lock.json`, commit `f18ed511`.
- **What Was Expected**: Deterministic CI/CD and release builds require pinned dependencies in `package-lock.json` across workspace dev dependencies.
- **What Actually Happened**: A transient update pulled `@eslint/core@0.17.1` into the lockfile while peer constraints and configurations were anchored to `0.17.0`, risking subtle lint rule evaluation divergence across contributors' environments.
- **Evidence in Repo**: Commit `f18ed511`.
- **Root Cause**: Inadvertent lockfile modification during package installation without `--package-lock-only` or version pinning constraints.
- **Remediation Code Diff**:
```json
     "node_modules/@eslint/core": {
-      "version": "0.17.1",
-      "resolved": "https://registry.npmjs.org/@eslint/core/-/core-0.17.1.tgz",
+      "version": "0.17.0",
+      "resolved": "https://registry.npmjs.org/@eslint/core/-/core-0.17.0.tgz",
```
- **Lesson**: Monorepo release gates must execute strict lockfile diff assertions (`git diff --exit-code package-lock.json` or `npm ci`) before publishing to ensure zero unintended dependency updates enter distribution builds.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Nullish Coalescing vs Falsy Traps**:
  In crawl statistics and HTTP representations, status codes can legitimately be `0` (for connection aborts or network timeouts) or `null` (not fetched). Using `||` instead of `??` will coerce `0` to default values.
  ```typescript
  // CRITICAL DEFECT: Coerces status 0 to 500
  const status = page.status || 500; 

  // PRODUCTION INVARIANT: Preserves status 0 and null
  const status = page.status ?? null;
  const isError = page.error !== null || (page.status ?? 500) >= 400;
  ```
- **Array Mutation via Spread**:
  In `packages/core/src/baseline.ts`, links arrays are sorted to guarantee snapshot hashing determinism. Calling `.sort()` directly on the input array mutates the caller's memory reference in place.
  ```typescript
  // INVARIANT: Always clone prior to sorting
  links: [...(page.links ?? [])].sort(),
  internalLinks: [...(page.internalLinks ?? [])].sort(),
  ```
- **Case and Unicode Folding**:
  Title comparison must avoid raw `.toLowerCase()`. In `Ut(e)` (`packages/cli/bundle/comparison-worker.js`), strings undergo NFKC normalization followed by punctuation stripping:
  ```typescript
  function rt(e: string): string {
    return e.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **Candidate Token Overlap Guard**:
  When calculating near-duplicate titles, comparing every page against every other page is $O(N^2)$. `Ut(e)` implements multiple bounds:
  ```typescript
  let d = a.split(" ");
  // BOUND 1: Ignore titles shorter than 6 or longer than 40 tokens
  if (d.length < 6 || d.length > 40) continue;

  // BOUND 2: Limit comparison candidates per token bucket to 20
  let E = r.get(f) ?? [];
  if (E.length < 20) E.push(n);
  r.set(f, E);
  ```
- **Pagination SearchParam Stripping**:
  When detecting pagination title duplicates, URL parameter loops are avoided by normalizing search parameters before grouping:
  ```typescript
  function Mt(e: PageSnapshot): string {
    let t = new URL(e.finalUrl || e.url);
    for (let r of ["page", "paged", "p"]) t.searchParams.delete(r);
    t.searchParams.sort();
    return t.href;
  }
  ```

### 3. UI & UX Micro-Mechanics
- **Progressive Enhancement Element Revealing**:
  Interactive copy controls are rendered with `hidden = true` in HTML. If JavaScript is disabled or crashes, the non-functional button remains hidden. Only upon successful DOM reference resolution is it displayed:
  ```javascript
  const button = document.getElementById("copy-agent-prompt");
  if (button && prompt && preview && status) {
    button.hidden = false;
  }
  ```
- **Accessible Failure Focus Shifting**:
  When the Clipboard API fails (e.g., insecure context or denied permissions), the UI expands an accordion details element (`preview.open = true`), shifts keyboard focus to the raw text element (`prompt.focus()`), and populates an accessible status alert without layout reflow.

### 4. Backend Concurrency & Memory Safety
- **Per-Origin Token-Bucket Rate Limiter**:
  Crawls targeting internal networks or staging instances risk Denial of Service. The engine instantiates `createPerOriginRequestGate(config.delay)` which enforces a minimum inter-request delay keyed on `new URL(target).origin`.
- **Worker Thread Memory Decoupling**:
  In `comparison-worker.ts`, full page object details (`pageDetails`) are omitted if `current.pages.length > 5000`:
  ```typescript
  const reportData: ReportData = {
    ...
    ...(current.pages.length <= 5_000 ? { pageDetails: current.pages } : {}),
    ...
  };
  ```
  This prevents serialized IPC buffer exhaustion and out-of-memory crashes when message ports transfer report structures across thread boundaries.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Append-Only NDJSON Crash Recovery**:
  In `packages/core/src/checkpoint.ts`, the checkpoint parser handles half-written trailing lines:
  ```typescript
  try {
    const record = JSON.parse(line);
    if (record.type === "page" && typeof record.page?.url === "string") {
      pages.push(record.page);
    }
  } catch {
    // Ignored: Process stopped mid-write; preceding records remain valid.
  }
  ```
- **Pre-Abort Early Exit Guard in Planning**:
  If a scan is aborted via `AbortSignal` while parsing `robots.txt` or sitemaps, the planning layer immediately wraps the partial findings into a synthetic `SnapshotV2` marked with `partial: true` and `truncated: true`, flushing the checkpoint store before returning:
  ```typescript
  if (isPlan(input) || !options.signal?.aborted) throw error;
  const snapshot = createBaseline({ startUrl, pages: [], robots, partial: true, truncated: true });
  await options.checkpointStore?.flush?.();
  return { snapshot, startUrl, pages: [], truncated: true, partial: true, durationMs: 0, options: config };
  ```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
The codebase employs an explicit monorepo structure:
- `packages/core`: Pure Node.js engine, containing HTTP crawling logic, AST/HTML parsing, rules evaluation, baseline comparison, and metrics calculation. It has zero CLI or rendering dependencies.
- `packages/cli`: Terminal interface (`seo-audit`), command parsers, worker dispatchers, and local loopback HTTP servers.
- `packages/mcp`: Model Context Protocol server exposing 8 tools (`crawl`, `audit`, `diff`, etc.) to LLM clients (Claude, Codex).
- `packages/action`: GitHub Action runner executing pull-request regression gates.
- `packages/renderer-playwright`: Headless browser driver isolating optional JavaScript-rendered crawls from core HTTP crawling.

### Dimension 2: Core Abstractions
- `SnapshotV2`: The central invariant record containing full crawl data, crawl configuration hash, link graph, and crawl statistics.
- `PageSnapshot`: Flattened URL-level record holding response metadata, canonical targets, OpenGraph tags, JSON-LD blocks, hreflang references, and inbound/outbound links.
- `Issue`: An audit violation characterized by `fingerprint`, `ruleId`, `severity` (`error`, `warning`, `info`), `scope` (`page`, `site`), `evidence`, `owner` (`developer`, `seo`, `content`), and `lifecycle` (`new`, `ongoing`, `unchanged`, `resolved`).
- `RuleDefinition`: Declarative invariant contract defining remediation instructions, owners, severities, and target scopes.

### Dimension 3: Error Handling
Errors are categorized into network/fetch errors, rule parsing errors, and structural invariant violations:
- Per-page network errors do not terminate crawls. Failed pages are stored with `status: null` or the observed error code, their error strings captured, and marked as failed in `linkGraph.brokenInternalUrls`.
- Subsystem worker errors are caught at the root worker frame and communicated over `parentPort.postMessage({ phase: "error", message })` followed by setting `process.exitCode = 1`.

### Dimension 4: Testing
Testing utilizes the native Node.js test runner (`node:test`) avoiding heavy third-party runners:
- **Coverage Gates**: Rigorous branch and line thresholds (`--test-coverage-lines=90`, `--test-coverage-branches=75`).
- **VM In-Memory Mocking**: Site UI scripts are tested by executing the raw JavaScript string via Node’s `node:vm` context (`vm.runInNewContext(source, { document, navigator, setTimeout, clearTimeout })`), allowing precise simulated clock ticks and synthetic DOM manipulation without JSDOM overhead.

### Dimension 5: Security
- **Path Traversal & Inode Anchoring**: Local file operations reject paths containing path separators and verify file descriptors using `O_NOFOLLOW` and inode verification (`ino` and `dev

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
