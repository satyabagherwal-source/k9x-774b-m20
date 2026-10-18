> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/crawlcove-crawlcove-sitemap-validator-learnings.md`  
> **Source**: github ([https://github.com/CrawlCove/crawlcove-sitemap-validator](https://github.com/CrawlCove/crawlcove-sitemap-validator))  
> **Source Version**: `caa1d0b5`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-18T06:36:28.344Z  
> **Learning ID**: `learn-github-crawlcove-xml-sitemap-validator`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): CrawlCove/xml-sitemap-validator

---

## 1. Executive Forensic Architecture & System Mechanics

`CrawlCove/xml-sitemap-validator` provides automated discovery, transport-layer ingestion, schema conformance validation, protocol constraint checking, and recursive tree analysis for XML sitemaps and sitemap index files conforming to the [sitemaps.org protocol](https://www.sitemaps.org/protocol.html).

### Subsystem Boundaries & Decoupling Model

```
                    ┌────────────────────────┐
                    │       src/cli.ts       │
                    │  (CLI Entrypoint / UI) │
                    └───────────┬────────────┘
                                │ Orchestrates
                                ▼
                    ┌────────────────────────┐
                    │    discoverSitemaps    │
                    │ (Robots.txt / Probing) │
                    └───────────┬────────────┘
                                │ Sitemap URLs
                                ▼
                    ┌────────────────────────┐
                    │    validateSitemap     │
                    │ (Recursive Coordinator)│
                    └─────┬────────────┬─────┘
           Fetches / Gzip │            │ Validates String
                          ▼            ▼
  ┌───────────────────────────┐    ┌───────────────────────────┐
  │     fetchSitemapText      │    │        validateXml        │
  │ (AbortController, Timeout,│    │(fast-xml-parser, Invariant│
  │  Buffer Allocation, Sniff)│    │ Checks, Schema Assertion) │
  └───────────────────────────┘    └───────────────────────────┘
```

The system strictly divides network operations from parsing:
1. **Transport Layer (`fetchSitemapText`)**: Uses native `fetch` wrapped with an explicit `AbortController` and `setTimeout` lifecycle. All payloads are received as binary `ArrayBuffer` primitives converted directly to Node.js `Buffer`. Decompression (`decodeBody`) avoids trusting Content-Encoding HTTP headers or URI extensions, instead performing direct magic-byte inspection (`0x1F 0x8B`) followed by synchronous inflation via `zlib.gunzipSync`.
2. **Grammar & Lexical Verification Layer (`validateXml`)**: Decoupled from transport. The string payload undergoes a two-phase check:
   - *Phase 1 (Lexical Well-Formedness)*: Run via `XMLValidator.validate(text)`. Fast-fails HTML payloads (such as 200 OK soft-404 login portals or Cloudflare challenges) before AST generation.
   - *Phase 2 (AST Analysis & Schema Invariants)*: Run via `XMLParser` configured with strict typing: `parseTagValue: false` (preventing implicit string-to-number/boolean coercion), `trimValues: true`, `isArray: (name) => name === 'url' || name === 'sitemap'` (normalizing single-child objects into uniform iterable lists), and attribute prefixing with `@_`.
3. **Recursive Ingestion Coordinator (`validateSitemap`)**: Inspects root-level node kinds (`urlset` vs `sitemapindex`). When encountering a `sitemapindex`, it enforces recursion depth limits (`depth === 0`), URL parsing safety, deduplication, and max child limits before fetching children.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Top-Level Node Filtering in Hybrid XML/JSON Parsers
**RULE**:
When utilizing object-projection XML parsers (e.g., `fast-xml-parser`) where XML processing instructions (`<?...?>`), comments (`<!--...-->`), and directives are projected as top-level object keys, engineers MUST NOT assume the root XML tag is the only key or merely exclude `?xml`. Parsers MUST filter out all keys matching processing instructions (`?`), metadata directives (`!`), or internal text/comment indicators (`#`) to determine the canonical root element.

**WHY**:
CMS engines (WordPress, Yoast SEO, Rank Math) routinely inject XSL stylesheet processing instructions (e.g., `<?xml-stylesheet type="text/xsl" href="..."?>`) before the root tag to style sitemaps in browsers. When an XML parser projects these nodes as top-level object keys (e.g., `doc['?xml-stylesheet']`), naïve root selection logic like `Object.keys(doc).find(k => k !== '?xml')` will bind to `?xml-stylesheet` instead of `urlset` or `sitemapindex`. This yields false-positive structural failures (`wrong-root: root element is <?xml-stylesheet>`), completely halting downstream processing.

**WHEN TO APPLY**:
Apply in any Node.js, Go, or Python XML parser pipeline where XML is serialized into an untyped dictionary/hash-map before root tag extraction, especially when consuming third-party feeds, sitemaps, RSS, Atom, or SVG files.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Complete, working, production-grade pattern
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export interface RootExtractionResult {
  rootName: string;
  rootNode: Record<string, unknown>;
}

export function extractCanonicalXmlRoot(text: string): RootExtractionResult {
  const validation = XMLValidator.validate(text);
  if (validation !== true) {
    throw new Error(`Invalid XML structure: ${validation.err.msg} at line ${validation.err.line}`);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false, // Prevents destructive number/boolean coercions
    trimValues: true,
  });

  const parsedDoc = parser.parse(text) as Record<string, unknown>;

  // Filter out XML Declarations (?), Directives (!), and Text/Comments (#)
  const canonicalRootKey = Object.keys(parsedDoc).find(
    (key) => !key.startsWith('?') && !key.startsWith('#') && !key.startsWith('!')
  );

  if (!canonicalRootKey || typeof parsedDoc[canonicalRootKey] !== 'object' || parsedDoc[canonicalRootKey] === null) {
    throw new Error('Document does not contain a valid canonical root element');
  }

  return {
    rootName: canonicalRootKey,
    rootNode: parsedDoc[canonicalRootKey] as Record<string, unknown>,
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER assume ?xml is the only non-element top-level key
const rootName = Object.keys(doc).find((k) => k !== '?xml');
// FAILS: If <?xml-stylesheet ...?> is present, rootName becomes '?xml-stylesheet'
```

**VERIFICATION METHOD**:
Verify using a unit test asserting root resolution over XML payloads containing multiple processing instructions and comments prior to the root node:
```typescript
import { test, expect } from 'vitest';
import { extractCanonicalXmlRoot } from './extractCanonicalXmlRoot.js';

test('resolves canonical root despite xml-stylesheet and comments', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
  <!-- Generator: Custom Engine -->
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://example.com/</loc></url>
  </urlset>`;

  const { rootName } = extractCanonicalXmlRoot(xml);
  expect(rootName).toBe('urlset');
});
```

---

### 2. Transport Header-Agnostic Gzip Magic-Byte Sniffing
**RULE**:
When ingesting binary compressed payloads from untrusted public HTTP origins, decompression systems MUST NOT rely exclusively on the `Content-Type` header, `Content-Encoding` header, or URL file extensions. Ingestion systems MUST inspect the payload's first two bytes against the gzip magic number sequence (`0x1F 0x8B`) before decoding.

**WHY**:
Misconfigured web servers and CDNs frequently serve `.xml.gz` files with `Content-Type: text/xml` or omit the `Content-Encoding: gzip` header entirely. Conversely, reverse proxies may transparently decompress payloads while preserving the `.gz` filename or preserving stale gzip headers. Blindly passing non-gzipped bytes to `gunzipSync` causes unhandled `Z_DATA_ERROR` exceptions, while failing to decompress raw gzip bytes causes XML parser crashes on binary gibberish.

**WHEN TO APPLY**:
All HTTP client fetchers, scrapers, crawlers, and ingestors handling potentially compressed external files (`.gz`, `.tar.gz`, `.svgz`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { gunzipSync } from 'node:zlib';

export interface DecodedBody {
  text: string;
  isGzipped: boolean;
}

export function decodeBufferPayload(buffer: Buffer): DecodedBody {
  // Gzip Magic bytes: 0x1F (31), 0x8B (139)
  const isGzipMagic = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;

  if (isGzipMagic) {
    try {
      const decompressed = gunzipSync(buffer);
      return {
        text: decompressed.toString('utf8'),
        isGzipped: true,
      };
    } catch (err) {
      throw new Error(`Decompression failed despite Gzip magic header: ${(err as Error).message}`);
    }
  }

  return {
    text: buffer.toString('utf8'),
    isGzipped: false,
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER rely on file path extension or Content-Type headers for decompression decisions
if (url.endsWith('.gz') || response.headers.get('content-encoding') === 'gzip') {
  return gunzipSync(buffer).toString('utf8'); // Crashes if CDN already decompressed it!
}
```

**VERIFICATION METHOD**:
Automated fuzz test passing: (1) uncompressed XML named `sitemap.xml.gz`, (2) gzipped XML named `sitemap.xml`, and (3) corrupt buffers starting with `0x1F 0x8B`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Root Element Identification Hijacking via XML Processing Instructions
- **Context**: XML parsing engine in `src/validate.ts`
- **What Was Expected**: `validateXml()` determines whether the root tag is `<urlset>` or `<sitemapindex>`.
- **What Actually Happened**: On any site using WordPress plugins like Yoast or Rank Math, sitemaps include an `<?xml-stylesheet ...?>` processing instruction. `fast-xml-parser` parses processing instructions as top-level keys. The validator evaluated `Object.keys(doc).find((k) => k !== '?xml')`, which returned `?xml-stylesheet`. This triggered a fatal error: `wrong-root: root element is <?xml-stylesheet>; expected <urlset> or <sitemapindex>`.
- **Evidence in Repo**: Commit `93092726`, file `src/validate.ts`, lines 179–190.
- **Root Cause**: The filter assumed that `?xml` was the sole non-element key produced by `fast-xml-parser`. It failed to account for arbitrary processing instructions (prefixed with `?`) or comment nodes (prefixed with `#`).
- **Remediation Code Diff**:
```typescript
// Commit 93092726 in src/validate.ts
-  const rootName = Object.keys(doc).find((k) => k !== '?xml')
+  // fast-xml-parser surfaces every processing instruction as a top-level
+  // key starting with "?" (the <?xml ...?> prolog, and the <?xml-stylesheet ...?>
+  // line that Yoast, Rank Math and most WordPress sitemaps emit so the XML
+  // renders as a styled page in a browser). None of those is the root element.
+  const rootName = Object.keys(doc).find((k) => !k.startsWith('?') && !k.startsWith('#'))
```
- **Lesson**: Parsing untyped markup documents into key-value representations requires pattern-based filtering (prefix/symbol masking) rather than exact-match exclusion lists.

---

### Incident 2: Silent Redirection Obfuscation in Sitemap Audits
- **Context**: Network ingestion client in `src/validate.ts` & CLI reporter in `src/cli.ts`
- **What Was Expected**: When auditing `https://example.com/sitemap.xml`, if the server responds with a 301/302 redirecting to `https://example.com/sitemap_index.xml`, the validation engine must inform the user and report findings against the resolved resource.
- **What Actually Happened**: The fetch layer configured `redirect: 'follow'`, but discarded `res.url`. The audit report preserved only the requested URL. Engineers could not identify why child sitemaps or cross-host assertions behaved unexpectedly relative to the input URL.
- **Evidence in Repo**: Commit `93092726`, `src/validate.ts` (`Fetched` interface and `validateSitemap` mapping), `src/cli.ts`.
- **Root Cause**: Missing state propagation between fetch response metadata (`res.url`) and the output data structure (`SitemapReport`).
- **Remediation Code Diff**:
```typescript
// Commit 93092726 in src/validate.ts
 export interface Fetched {
   status: number | null
+  /** The URL that actually answered, after redirects (null when nothing answered). */
+  finalUrl: string | null
   body: Buffer | null
   contentType: string | null
   fetchError: string | null
 }
...
-  return { status: res.status, body, contentType: res.headers.get('content-type'), fetchError: null }
+  return { status: res.status, finalUrl: res.url || url, body, contentType: res.headers.get('content-type'), fetchError: null }
...
+  if (fetched.finalUrl !== null && fetched.finalUrl !== url) report.redirectedTo = fetched.finalUrl
```
- **Lesson**: Network crawlers following HTTP redirects must capture and propagate the canonical terminal URL (`res.url`) to prevent split-brain host validations between request origin and response source.

---

### Incident 3: CLI Stalling via Unbounded Fetch Timers
- **Context**: Transport client timeout management in `fetchSitemapText`
- **What Was Expected**: Node.js processes fetching sitemaps over sluggish or hanging connections must terminate predictably without leaving hanging event-loop timers.
- **What Actually Happened**: When unhandled rejections occurred or abort signals fired without cleanup, active Node.js timers (`setTimeout`) kept the Node.js event loop alive, preventing CLI exits or test runner completion.
- **Evidence in Repo**: `src/validate.ts`, `fetchSitemapText()` lines 122–136.
- **Root Cause**: Failure to guarantee timer cancellation in error pathways.
- **Remediation Code Diff**:
```typescript
// Structural invariant implemented in src/validate.ts
   const controller = new AbortController()
   const timer = setTimeout(() => controller.abort(), opts.timeoutMs)
   try {
     const res = await doFetch(url, { ... })
     ...
   } catch (err) {
     ...
   } finally {
+    clearTimeout(timer)
   }
```
- **Lesson**: Any `setTimeout` paired with an `AbortController` must be cleared inside a `finally` block to prevent lingering timers from stalling process exit.

---

### Incident 4: Cross-Host Boundary False-Positives via WWW Subdomain Variations
- **Context**: Host validation invariant in `validateXml`
- **What Was Expected**: Validating that all URLs listed in a sitemap reside on the sitemap's origin host, preventing cross-site injection attacks, while recognizing domain canonicalization.
- **What Actually Happened**: Sitemaps hosted at `https://example.com/sitemap.xml` referencing `https://www.example.com/page` (or vice-versa) were flagged as illegal cross-host references, breaking standard production domains.
- **Evidence in Repo**: `src/validate.ts`, line 231.
- **Root Cause**: Naïve host equality comparison `parsed.host !== sitemapHost.host` failed to normalize apex domains against `www` subdomains.
- **Remediation Code Diff**:
```typescript
// src/validate.ts
- if (sitemapHost && parsed.host !== sitemapHost.host) {
+ if (sitemapHost && parsed.host.replace(/^www\./, '') !== sitemapHost.host.replace(/^www\./, '')) {
    findings.push(finding('cross-host-loc', `${loc} is on a different host than the sitemap (${sitemapHost.host})...`, loc))
  }
```
- **Lesson**: Domain security invariants in web crawlers must normalize equivalent apex and www variants before enforcing isolation policies.

---

### Incident 5: Strict Datetime Validation False Positives via Clock Skew
- **Context**: `<lastmod>` tag temporal validation in `validateXml`
- **What Was Expected**: Flag entries with future modification dates (often caused by generator bugs emitting timestamps decades in advance).
- **What Actually Happened**: Sitemaps generated in timezones ahead of the validator or generated with slight server clock drift (e.g., a few minutes or hours ahead) were rejected with `future-lastmod`.
- **Evidence in Repo**: `src/validate.ts`, line 240.
- **Root Cause**: Direct comparison against `opts.now().getTime()` lacked a grace window for international timezone discrepancies or NTP synchronization skew.
- **Remediation Code Diff**:
```typescript
// src/validate.ts
- else if (new Date(lastmod).getTime() > now.getTime()) findings.push(finding('future-lastmod', ...))
+ else if (new Date(lastmod).getTime() > now.getTime() + 24 * 3600 * 1000) findings.push(finding('future-lastmod', `lastmod ${lastmod} is in the future`, loc))
```
- **Lesson**: Temporal sanity checks across distributed systems must provide a bounded grace interval (e.g., 24 hours) to account for time zones and clock drift.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **XML Tag Value Coercion Prevention**: By default, `fast-xml-parser` attempts to parse numeric strings into JS primitives. If a URL is numeric (e.g., `<loc>https://example.com/12345</loc>`) or `<priority>1.0</priority>` is converted to `1`, information is lost.
  - *Invariant*: `parseTagValue: false` must be set in parser configuration.
  - *Text Node Resolution*: Nodes containing attributes can be parsed as objects with a `#text` property rather than plain strings.
  ```typescript
  function textOf(v: unknown): string | undefined {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && '#text' in (v as Node)) return String((v as Node)['#text']);
    return String(v);
  }
  ```
- **W3C Datetime Strictness**: The sitemaps protocol permits subsets of ISO 8601 / W3C Datetime (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`, `YYYY-MM-DDThh:mmTZD`). Naïve JS `new Date(str)` parses invalid strings like `"29/09/2026"` without throwing (returning invalid or unexpected dates).
  - *Regex Guard*:
  ```typescript
  const W3C_DATETIME = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;
  ```
- **Priority Numeric Precision**: `<priority>` must be a valid float between `0.0` and `1.0`. Checking `n >= 0 && n <= 1` alone allows invalid formats like `"0.500abc"` or scientific notation `"1e-5"`.
  - *Token Invariant*: `!/^\d?(\.\d+)?$/.test(priority) || Number.isNaN(n) || n < 0 || n > 1`.

### 2. Infinite Loop & Recursion Guards
- **Sitemap Index Recursion Depth Cap**: Sitemap indexes can point to child sitemaps, which in turn could point to parent indexes, generating an infinite cycle or unbounded resource exhaustion.
  - *Invariant*: Hard recursion limit via explicit depth tracking:
  ```typescript
  export async function validateSitemap(url: string, opts: ValidateOptions = DEFAULT_OPTIONS, depth = 0): Promise<SitemapReport> {
    ...
    if (report.kind === 'sitemapindex' && depth === 0) {
      // Validates child sitemaps only at root depth
      for (const childUrl of childLocs.slice(0, opts.maxSitemaps)) {
        report.children.push(await validateSitemap(childUrl, opts, depth + 1));
      }
    }
  }
  ```
  - *Breadth-Limit Invariant*: `childLocs.slice(0, opts.maxSitemaps)` caps the processing queue, preventing memory exhaustion when encountering adversarial sitemap indexes listing 50,000 sub-sitemaps.

### 3. UI & UX Micro-Mechanics
- **Tree-Indented Terminal Rendering**: Recursion in reports must format as a hierarchical tree without line-wrap corruption or malformed spacing.
  - Invariant in `render()`:
  ```typescript
  export function render(r: SitemapReport, indent = ''): string {
    const lines = [`${indent}${r.url}${r.redirectedTo ? `  (redirected to ${r.redirectedTo})` : ''}`];
    ...
    for (const c of r.children) lines.push(render(c, indent + '  '));
    return lines.join('\n') + (indent ? '' : '\n');
  }
  ```
- **Exit Code Semantics**: Command-line interfaces running in CI environments must distinguish between fatal operational errors, protocol warnings, and configuration misuse:
  - Exit `0`: Clean execution (or only warnings when `--fail-on error`).
  - Exit `1`: Protocol/conformance errors (or warnings if `--fail-on warning`).
  - Exit `2`: CLI argument or usage parsing failure.

### 4. Backend Concurrency & Memory Safety
- **Bounded Buffer Allocation**: Avoid `res.text()` when downloading responses of unknown size, which can exhaust Node.js string length limits (`V8: ~512MB`).
  - *Pattern*: Read as `ArrayBuffer`, convert to `Buffer`, and inspect size before string conversion:
  ```typescript
  const body = Buffer.from(await res.arrayBuffer());
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > opts.maxBytes) {
    findings.push(finding('too-large', ...));
  }
  ```
- **AbortSignal Memory Leak Guard**: When chaining AbortSignals or dispatching timers, failing to invoke `clearTimeout(timer)` keeps both the timer and controller in memory until timeout resolution, resulting in listener leaks under high concurrency.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Safe URL Instantiation**: Unchecked `new URL(loc)` throws an unhandled exception on malformed inputs, crashing the process.
  ```typescript
  function safeUrl(u: string): URL | null {
    try {
      return new URL(u);
    } catch {
      return null;
    }
  }
  ```
- **Single vs Multiple Child Array Invariant**: XML parsers convert single `<url>` elements to an object and multiple `<url>` elements to an array. Accessing `.length` or iterating directly will throw `TypeError: items.map is not a function`.
  - *Enforced Configuration*: `isArray: (name) => name === 'url' || name === 'sitemap'` guarantees that the parser always emits a JavaScript Array, eliminating defensive normalization code downstream.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Layer Separation**: The architecture isolates the impure I/O layer (`fetchSitemapText`) from the pure validation engine (`validateXml`).
- **Orchestration**: `validateSitemap` coordinates I/O and pure parsing, enabling isolated unit testing of XML parsing without mocking HTTP sockets.
- **Entrypoints**: Library API (`src/index.ts`) and CLI executable (`src/cli.ts`) share the core validation engine.

### 2. Core Abstractions
- `SitemapReport`: The canonical tree entity describing URLs, size, compression status, entries, and findings.
- `Finding`: Structured diagnostic item comprising `code` (`FindingCode`), `severity` (`'error' | 'warning'`), `message`, and optional `loc`.
- `ValidateOptions`: Configurable environment parameters with dependency injection for `fetch` and time provider `now: () => Date`.

### 3. Error Handling
- **Non-Throwing Pipeline**: Operational errors (HTTP 404, network timeouts, XML malformedness, compression failures) are transformed into structured `Finding` objects attached to the report rather than thrown up the call stack.
- **Degraded Results**: When an XML document fails validation, the system outputs an `unknown` kind report containing the root parsing error rather than crashing.

### 4. Testing
- **In-Memory Fixture Servers**: Automated tests (`tests/validate.test.ts`) rely on local HTTP fixture servers (`tests/fixtureServer.ts`) serving gzip, redirect chains, XML stylesheets, and error codes.
- **Time Freezing**: Tests override `opts.now` with a deterministic time factory to validate future `lastmod` detection.

### 5. Security
- **SSRF & Scheme Invariant**: Rejects non-HTTP schemes: `!/^https?:$/.test(parsed.protocol)` prevents arbitrary file retrieval or URI scheme injection (e.g., `file://`, `data:`, `gopher://`).
- **DoS Protection**: Max uncompressed size limits (default 50 MB) and max entry limits (default 50,000 URLs) protect parser memory from zip bombs and memory exhaustion.

### 6. Performance
- **Pre-Parser Lexical Rejection**: Runs `XMLValidator.validate()` prior to running AST generation. If an endpoint serves HTML error pages or garbage, the parser does not allocate AST tree structures.
- **Single-Pass Array Traversal**: Entries are iterated once, performing deduplication, syntax validation, cross-host matching, and date parsing in a single linear pass ($O(N)$).

### 7. Deployment
- **Zero-Dependency Native ESM**: Targets Node.js `>=18` using standard Web APIs (`fetch`, `AbortController`) and minimal dependencies (`commander`, `fast-xml-parser`).
- **Dual Packaging**: Distributes both CLI (`dist/cli.js`) and module library (`dist/index.js`), with published TypeScript definition files (`.d.ts`).

### 8. Agent Patterns
- **Pure Dependency Injection**: Exposing `fetch?: typeof fetch` and `now: () => Date` in `ValidateOptions` allows AI coding agents or testing harnesses to execute headless runs without network mocking libraries.
- **Structured JSON Mode**: `--json` CLI flag bypasses ANSI/string formatting and emits raw JSON schemas for machine ingestion.

### 9. Data Flow
```
[Raw URL / Robots.txt]
       │
       ▼ (HTTP GET via fetch)
[Buffer Payload] ──(Magic Byte 0x1F 0x8B)──► [gunzipSync]
       │                                           │
       ▼                                           ▼
[Decompressed UTF-8 String]
       │
       ▼ (XMLValidator.validate)
[Well-Formed Check] ──(Invalid)──► Emit 'not-xml' Finding
       │ (Valid)
       ▼ (XMLParser.parse with isArray forced)
[JSON AST Node]
       │
       ▼ (Filter !starts-with '?' & '#')
[Canonical Root Tag] ──(Not urlset/sitemapindex)──► Emit 'wrong-root' Finding
       │ (Valid)
       ▼ (Single-Pass Loop)
[SitemapReport Tree with Findings]
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Dependency-Injected Async Lifecycle Fetcher
```typescript
export interface FetchConfig {
  timeoutMs: number;
  userAgent: string;
  fetchFn?: typeof fetch;
}

export async function resilientHttpFetch(url: string, config: FetchConfig) {
  const activeFetch = config.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await activeFetch(url, {
      headers: { 'user-agent': config.userAgent, accept: 'application/xml,text/xml,*/*' },
      signal: controller.signal,
      redirect: 'follow'
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      finalUrl: response.url || url,
      data: buffer,
      error: null
    };
  } catch (err) {
    const name = err instanceof Error ? err.name : String(err);
    return {
      status: null,
      finalUrl: null,
      data: null,
      error: name === 'AbortError' ? 'TIMEOUT' : (err as Error).message || name
    };
  } finally {
    clearTimeout(timer);
  }
}
```

### 2. Rule
The system MUST validate payload well-formedness using lightweight linear scans before constructing full object abstract syntax trees, and MUST NOT trust HTTP transport metadata over actual binary magic signatures.

### 3. Architecture Principle
Separate network acquisition completely from parsing and evaluation. Pure parsers must accept strings or buffers and return plain data structures containing findings rather than throwing exceptions or performing I/O.

### 4. Failure Mode
When an XML document contains processing instructions (such as `<?xml-stylesheet?>` for XSL rendering) or comment blocks preceding the root node, generic dictionary parsers insert them as root object properties. Evaluating roots using index or simple negation (`k !== '?xml'`) misidentifies the root, causing total validation failure.

### 5. Reusable Skill: XML Feed Root Element Resolution
1. Verify well-formedness using a lightweight validator.
2.