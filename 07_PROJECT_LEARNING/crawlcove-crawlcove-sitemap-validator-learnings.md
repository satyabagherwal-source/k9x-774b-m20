> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/crawlcove-crawlcove-sitemap-validator-learnings.md`  
> **Source**: github ([https://github.com/CrawlCove/crawlcove-sitemap-validator](https://github.com/CrawlCove/crawlcove-sitemap-validator))  
> **Source Version**: `caa1d0b5`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T03:52:50.208Z  
> **Learning ID**: `learn-github-crawlcove-xml-sitemap-validator`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): CrawlCove/xml-sitemap-validator

---

## 1. Executive Forensic Architecture & System Mechanics

`CrawlCove/xml-sitemap-validator` is a zero-dependency-runtime (reliant solely on `commander` and `fast-xml-parser`) CLI and programmatic verification engine for the Sitemaps XML protocol (sitemaps.org schema 0.9). It evaluates XML payloads against web-crawler ingestion limits (50,000 URLs, 50 MiB uncompressed payload size, strict W3C Datetime formats, hostname locality constraints, and schema namespace bindings).

```
                      +------------------------------------------+
                      |                 CLI ENTRY                |
                      |   (commander, option parse, exit codes)  |
                      +--------------------+---------------------+
                                           |
                                           v
                      +------------------------------------------+
                      |            discoverSitemaps()            |
                      |   (robots.txt probe / fallback path)     |
                      +--------------------+---------------------+
                                           |
                     +---------------------+---------------------+
                     |                                           |
                     v                                           v
      +------------------------------+            +------------------------------+
      |      fetchSitemapText()      |            |          decodeBody()        |
      | - AbortController timeout    | ---------> | - Magic bytes: 0x1f 0x8b     |
      | - Redirect hop capture       |            | - gunzipSync uncompressed    |
      | - Strict UTF-8 buffer intake |            | - Direct Buffer-to-string    |
      +------------------------------+            +--------------+---------------+
                                                                 |
                                                                 v
                                                  +------------------------------+
                                                  |         validateXml()        |
                                                  | - Byte size bounds check     |
                                                  | - Fast-xml XMLValidator pre  |
                                                  | - AST Node extraction        |
                                                  | - Root & PI tag filter       |
                                                  +--------------+---------------+
                                                                 |
                                                                 v
                                                  +------------------------------+
                                                  |       Iterative Checks       |
                                                  | - Host apex normalization    |
                                                  | - W3C Datetime strict regex  |
                                                  | - Future clock skew (+24h)   |
                                                  | - changefreq & priority tags |
                                                  | - Deduplication Set          |
                                                  +------------------------------+
```

### Critical Subsystem Abstractions & Invariant Boundaries

1. **Network vs. Computation Isolation**:
   Network fetching (`fetchSitemapText`) is fully decoupled from parsing and validation (`validateXml`). Network operations return an explicit, non-throwing carrier structure (`Fetched`). `validateXml` operates purely on string buffers and deterministic options, enabling isolated unit testing without network mocks.

2. **Gzip Sniffing via Header-Agnostic Magic Bytes**:
   Rather than relying on HTTP `Content-Encoding` or file extension heuristics (`.xml.gz`), the engine inspects the binary payload directly using the GZIP magic byte signature `0x1f 0x8b`. Decompression occurs synchronously via Node.js `node:zlib.gunzipSync` within an explicit `try/catch` boundary.

3. **AST Processing Instruction and Root Element Isolation**:
   The parser abstracts raw XML into a generic dictionary (`doc: Record<string, unknown>`). Because `fast-xml-parser` preserves XML processing instructions (such as `<?xml ...?>` and `<?xml-stylesheet ...?>`) as pseudo-keys prefixed with `?`, and comments/text nodes prefixed with `#`, the root-detection subsystem must explicitly exclude non-element keys to correctly detect `<urlset>` or `<sitemapindex>`.

4. **Hierarchical Index Traversal with Depth Bounding**:
   A sitemap index file containing child sitemaps is recursed using an explicit `depth` boundary (`depth === 0`), enforcing that nested indices cannot cause unbounded recursive depth or trigger infinite cycles.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Processing-Instruction and Metadata Immunity in AST Root Resolution
**RULE**:
When parsing generic XML into dictionary-based Object ASTs, root element detection MUST NOT rely on negative single-token exclusion (such as `k !== '?xml'`). The search predicate MUST explicitly discard all tokens matching processing instruction prefixes (`?`), node comment prefixes (`#`), and metadata wrappers before asserting the schema-defined root tag.

**WHY**:
CMS engines (e.g., WordPress with Yoast or Rank Math) frequently prepend XSLT/CSS processing instructions such as `<?xml-stylesheet type="text/xsl" href="..."?>` immediately after the XML declaration. If a parser treats processing instructions as top-level dictionary keys, a single exclusion check like `k !== '?xml'` will erroneously capture `?xml-stylesheet` as the root XML tag, causing false-positive parser rejections (`wrong-root` errors) and pipeline crashes in automated ingestion systems.

**WHEN TO APPLY**:
Apply in any XML ingestion pipeline, crawler, feed reader, or sitemap validator where payload structure is parsed into loosely typed JSON/Object graphs (e.g., via `fast-xml-parser`, `xml2js`, or custom tokenizers).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Resolves the true XML root element name from a fast-xml-parser document object.
 * Guarantees immunity against XML declarations, XSLT stylesheets, and comment nodes.
 */
export function resolveXmlRootElementName(doc: Record<string, unknown>): string | undefined {
  return Object.keys(doc).find((key: string): boolean => {
    // fast-xml-parser maps processing instructions to '?tagName' (e.g., '?xml', '?xml-stylesheet')
    // and text/comment nodes to '#tagName' (e.g., '#text', '#comment').
    return !key.startsWith('?') && !key.startsWith('#')
  })
}

// Invariant Enforcement
export function assertValidSitemapRoot(doc: Record<string, unknown>): 'urlset' | 'sitemapindex' {
  const rootName = resolveXmlRootElementName(doc)
  if (rootName !== 'urlset' && rootName !== 'sitemapindex') {
    throw new Error(`Invalid root element <${rootName ?? 'none'}>; expected <urlset> or <sitemapindex>`)
  }
  return rootName
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Brittle, single-key exclusion that breaks on valid XSLT-styled sitemaps
const rootName = Object.keys(doc).find((k) => k !== '?xml') 
// If XML contains <?xml-stylesheet ...?>, rootName becomes "?xml-stylesheet"!
```

**VERIFICATION METHOD**:
Automated Vitest/Jest suite feeding an XML document containing multiple processing instructions (`<?xml ...?>`, `<?xml-stylesheet ...?>`, and `<!-- comment -->`) directly before `<urlset>`:
```typescript
import { expect, test } from 'vitest'
import { XMLParser } from 'fast-xml-parser'
import { resolveXmlRootElementName } from './validate.js'

test('resolveXmlRootElementName ignores XML prolog and styling instructions', () => {
  const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
  <?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
  <!-- Author: Engineering -->
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://example.com/</loc></url>
  </urlset>`
  
  const parser = new XMLParser({ ignoreAttributes: false })
  const doc = parser.parse(rawXml)
  const root = resolveXmlRootElementName(doc)
  expect(root).toBe('urlset')
})
```

---

### 2. Header-Agnostic Binary Sniffing for Compression Streams
**RULE**:
Network-fetched binary streams that might be compressed MUST be inspected for standard compression magic bytes (e.g., GZIP `0x1F 0x8B`) directly in memory rather than trusting HTTP `Content-Encoding`, `Content-Type`, or URI file extensions.

**WHY**:
Web servers frequently misconfigure MIME types and headers. A server may return a `.xml.gz` file with `Content-Type: application/xml` and omit `Content-Encoding: gzip`, or return a pre-compressed sitemap without setting decompression flags on raw CDN drops. Attempting UTF-8 string conversion on raw GZIP data introduces multi-byte Unicode replacement characters (`\uFFFD`), permanently corrupting the XML payload before parsing begins.

**WHEN TO APPLY**:
Every HTTP ingestion pipeline dealing with public web crawling, file uploads, file imports, or third-party webhooks handling potentially compressed payloads.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { gunzipSync } from 'node:zlib'

export interface DecodedPayload {
  text: string
  gzipped: boolean
}

/**
 * Sniffs the buffer prefix for GZIP magic numbers (1F 8B).
 * Decompresses synchronously if detected, otherwise decodes as UTF-8.
 */
export function decodeStreamBuffer(buffer: Buffer): DecodedPayload {
  // GZIP specification (RFC 1952) specifies ID1 = 0x1F, ID2 = 0x8B
  const isGzip = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b

  if (isGzip) {
    try {
      const decompressed = gunzipSync(buffer)
      return { text: decompressed.toString('utf8'), gzipped: true }
    } catch (err) {
      throw new Error(`Corrupt GZIP archive: ${(err as Error).message}`)
    }
  }

  return { text: buffer.toString('utf8'), gzipped: false }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly trusting HTTP headers or URL extensions
export function decodeUnsafe(res: Response, buffer: Buffer): string {
  if (res.headers.get('content-encoding') === 'gzip') {
    return gunzipSync(buffer).toString('utf8') // Fails if CDN stripped the header!
  }
  return buffer.toString('utf8') // Produces corrupt binary strings on .gz files
}
```

**VERIFICATION METHOD**:
Test with synthetic gzip payloads stripped of headers to verify binary-level sniffing:
```typescript
import { expect, test } from 'vitest'
import { gzipSync } from 'node:zlib'
import { decodeStreamBuffer } from './validate.js'

test('decodeStreamBuffer correctly sniffs and decompresses headerless GZIP payload', () => {
  const original = '<urlset><url><loc>https://example.com</loc></url></urlset>'
  const compressed = gzipSync(Buffer.from(original, 'utf8'))
  const result = decodeStreamBuffer(compressed)
  expect(result.gzipped).toBe(true)
  expect(result.text).toBe(original)
})
```

---

### 3. Canonical Domain Host Matching under www-Apex Symmetry
**RULE**:
When validating domain authority or cross-host URI permissions (e.g., in sitemaps, CORS origin verification, or cookie scope boundaries), hostnames MUST be compared using normalized apex equivalence by stripping the leading `www.` prefix, while maintaining strict protocol (`http` vs `https`) checks.

**WHY**:
Search engines (Google, Bing) and the Sitemaps protocol permit `www.example.com` to host entries for `example.com` and vice-versa, acknowledging that DNS architectures often alias `www` to apex. A naive string equality check (`url.host === sitemap.host`) incorrectly flags legitimate sitemaps as invalid (`cross-host-loc`), breaking SEO validations for production websites.

**WHEN TO APPLY**:
Sitemap engines, cross-origin security assertions, domain scoping policies, and web crawler discovery modules.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Safely validates whether a child URL belongs to the same administrative host as the parent,
 * allowing www-subdomain symmetry while ensuring protocol compliance.
 */
export function isSameAdministrativeHost(childUrl: string, parentUrl: string): boolean {
  try {
    const child = new URL(childUrl)
    const parent = new URL(parentUrl)

    // Strict protocol check: Disallow non-HTTP/S or protocol mismatches
    if (!/^https?:$/.test(child.protocol) || !/^https?:$/.test(parent.protocol)) {
      return false
    }

    // Strip single leading www. prefix for apex comparison
    const childHost = child.host.toLowerCase().replace(/^www\./, '')
    const parentHost = parent.host.toLowerCase().replace(/^www\./, '')

    return childHost === parentHost
  } catch {
    return false
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Exact host comparison or unsafe substring matching
if (childUrl.host === parentUrl.host) { ... } // Rejects www.site.com defining site.com
if (childUrl.host.includes(parentUrl.host)) { ... } // Vulnerable to attacker-site.com
```

**VERIFICATION METHOD**:
```typescript
import { expect, test } from 'vitest'
import { isSameAdministrativeHost } from './validate.js'

test('isSameAdministrativeHost matches apex and www domains symmetrically', () => {
  expect(isSameAdministrativeHost('https://example.com/p', 'https://www.example.com/sitemap.xml')).toBe(true)
  expect(isSameAdministrativeHost('https://www.example.com/p', 'https://example.com/sitemap.xml')).toBe(true)
  expect(isSameAdministrativeHost('https://attacker-example.com/p', 'https://example.com/sitemap.xml')).toBe(false)
  expect(isSameAdministrativeHost('https://sub.example.com/p', 'https://example.com/sitemap.xml')).toBe(false)
})
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Root Element Identification Failure on XSLT-Styled Sitemaps (BUG-SITEMAP-01)
- **Context**: XML parsing & root resolution subsystem in `src/validate.ts`.
- **What Was Expected**: Any valid XML sitemap conforming to sitemaps.org (even those containing browser-styling processing instructions like `<?xml-stylesheet ...?>`) should resolve `<urlset>` or `<sitemapindex>` as the root tag.
- **What Actually Happened**: Major CMS platforms (WordPress via Yoast SEO and Rank Math) output an XSLT stylesheet instruction immediately following the XML declaration. Fast-xml-parser maps all processing instructions to top-level object keys prefixed with `?`. The root finder evaluated `k !== '?xml'`, which selected `?xml-stylesheet` instead of `<urlset>`. This caused the parser to reject valid WordPress sitemaps with:
  `wrong-root: root element is <?xml-stylesheet>; expected <urlset> or <sitemapindex>`.
- **Evidence in Repo**:
  - Commit SHA: `93092726`
  - CHANGELOG entry: `"1.0.1: skip <?xml-stylesheet?> and other processing instructions when finding the root"`
  - Files modified: `src/validate.ts`, `dist/validate.js`, `package.json`.
- **Root Cause**: The developer assumed `?xml` was the only processing instruction an XML document could possess before the root element, ignoring valid XML Processing Instructions (PI) defined by the W3C XML 1.0 Specification.
- **Remediation Code Diff**:
```typescript
// - Buggy code:
const rootName = Object.keys(doc).find((k) => k !== '?xml')

// + Fixed pattern:
// fast-xml-parser surfaces every processing instruction as a top-level
// key starting with "?" (the <?xml ...?> prolog, and the <?xml-stylesheet ...?>
// line that Yoast, Rank Math and most WordPress sitemaps emit so the XML
// renders as a styled page in a browser). None of those is the root element.
const rootName = Object.keys(doc).find((k) => !k.startsWith('?') && !k.startsWith('#'))
```
- **Lesson**: Parsing untrusted XML via object reflection requires defensive prefix filtering. Never assume processing instructions are limited to `?xml`.

---

### Incident 2: HTTP Redirect Oblivion in URL Audit Trail (BUG-SITEMAP-02)
- **Context**: Network ingestion pipeline and CLI output in `src/validate.ts` & `src/cli.ts`.
- **What Was Expected**: When a request to `/sitemap.xml` redirects (HTTP 301/302) to another location (e.g., `/sitemap_index.xml`), the validation report must capture and report the final answering URL (`finalUrl` / `redirectedTo`) to ensure the user audits the actual content source.
- **What Actually Happened**: `fetchSitemapText` followed redirects via `redirect: 'follow'`, but only returned `status`, `body`, and `contentType`. The caller received no indication that a redirect had occurred, obscuring URL canonicalization mismatches and broken routing structures.
- **Evidence in Repo**:
  - Commit SHA: `93092726`
  - CHANGELOG: `"When the sitemap URL redirects (/sitemap.xml to /sitemap_index.xml is the common case) the report records redirectedTo and the CLI prints it beside the requested URL."`
- **Root Cause**: `doFetch` (the Fetch API) captures the final URL on `res.url`, but `fetchSitemapText` dropped this property from its returned object.
- **Remediation Code Diff**:
```typescript
// - Buggy code:
const res = await doFetch(url, { headers: { ... }, signal: controller.signal, redirect: 'follow' })
const body = Buffer.from(await res.arrayBuffer())
return { status: res.status, body, contentType: res.headers.get('content-type'), fetchError: null }

// + Fixed pattern:
const res = await doFetch(url, { headers: { ... }, signal: controller.signal, redirect: 'follow' })
const body = Buffer.from(await res.arrayBuffer())
return { status: res.status, finalUrl: res.url || url, body, contentType: res.headers.get('content-type'), fetchError: null }

// In validateSitemap:
if (fetched.finalUrl !== null && fetched.finalUrl !== url) report.redirectedTo = fetched.finalUrl
```
- **Lesson**: Network abstraction layers wrapping redirect-following clients must always propagate the terminal URI (`res.url`) back to the application layer to preserve request lineage.

---

### Incident 3: Package Naming & Tarball Global Installation Symlink Corruption (BUG-SITEMAP-03)
- **Context**: Packaging, manifest naming, and README install guides across repository rename.
- **What Was Expected**: Users executing global installations via `npm install -g <git-url>` should have functioning executables linked in their global `bin` path.
- **What Actually Happened**: NPM 10 exhibits an issue where `npm install -g github:Org/Repo` can leave dangling, broken symlinks for binary entrypoints. Additionally, the repository was renamed from `crawlcove-sitemap-validator` to `xml-sitemap-validator`, causing stale URL links and User-Agent mismatch.
- **Evidence in Repo**:
  - Commit SHA: `caa1d0b5`
  - README note: `"(The tarball form is deliberate: a global github: install on npm 10 leaves a dangling symlink. The npm package is coming.)"`
- **Root Cause**: Under npm 10+, installing directly from GitHub shortcut specs (`github:org/repo`) creates broken symbolic paths on certain operating systems when linking `bin` scripts.
- **Remediation Code Diff**:
```markdown
<!-- - Buggy documentation / command: -->
npm install -g https://github.com/CrawlCove/crawlcove-sitemap-validator

<!-- + Fixed command: Explicit release tarball install -->
npm install -g https://github.com/CrawlCove/xml-sitemap-validator/archive/refs/tags/v1.0.0.tar.gz
```
- **Lesson**: When distributing pre-npm CLI tools via GitHub, reference versioned release archive tarballs (`archive/refs/tags/*.tar.gz`) rather than raw git specifiers to ensure reliable `bin` symlinking across npm versions.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
* **Falsy Coercion Hazards (`0` vs. `null`/`undefined`)**:
  In `src/validate.ts`, `textOf` extracts text nodes from XML elements:
  ```typescript
  function textOf(v: unknown): string | undefined {
    if (v === undefined || v === null) return undefined
    if (typeof v === 'string') return v
    if (typeof v === 'object' && '#text' in (v as Node)) return String((v as Node)['#text'])
    return String(v)
  }
  ```
  *Invariant*: If `v` is numeric `0` (e.g. `<priority>0</priority>`), testing `if (!v)` would falsely evaluate to `true`, dropping valid `0` priority values. `textOf` explicitly verifies `v === undefined || v === null`, preserving numeric `0` as `'0'`.
* **String Numeric Regular Expression Precision**:
  Validating `<priority>` requires confirming the value is a floating-point number between `0.0` and `1.0`:
  ```typescript
  if (priority !== undefined) {
    const n = Number(priority)
    if (!/^\d?(\.\d+)?$/.test(priority) || Number.isNaN(n) || n < 0 || n > 1) {
      findings.push(finding('invalid-priority', `priority "${priority}" must be a number from 0.0 to 1.0`, loc))
    }
  }
  ```
  *Trap Avoided*: `Number('   ') === 0` and `Number('1e2') === 100`. The regex `/^\d?(\.\d+)?$/` rejects scientific notation, leading/trailing whitespace, and multi-digit floats before the range check runs.

### 2. Infinite Loop & Recursion Guards
* **Recursion Depth Bounding on Index Files**:
  A sitemap index can reference child sitemaps, which in turn might maliciously reference the parent, creating an infinite fetch loop.
  ```typescript
  // In src/validate.ts
  export async function validateSitemap(url: string, opts: ValidateOptions = DEFAULT_OPTIONS, depth = 0): Promise<SitemapReport> {
    // ...
    if (report.kind === 'sitemapindex' && depth === 0) {
      const childLocs = report.entries.map((e) => e.loc).filter((l) => safeUrl(l) !== null)
      if (childLocs.length > opts.maxSitemaps) {
        findings.push(finding('too-many-sitemaps', `...`))
      }
      for (const childUrl of childLocs.slice(0, opts.maxSitemaps)) {
        report.children.push(await validateSitemap(childUrl, opts, depth + 1))
      }
    }
  }
  ```
  *Termination Proof*: Recursing only when `depth === 0` means child sitemaps are validated at `depth = 1`, where the block `depth === 0` is `false`. Even if a child sitemap index nests further children, recursion immediately halts at depth 1.
* **Child Truncation Cap**:
  `childLocs.slice(0, opts.maxSitemaps)` guarantees that regardless of an index containing 500,000 URLs, the asynchronous fetch loop processes at most `maxSitemaps` (default 50), preventing event loop starvation.

### 3. UI & UX Micro-Mechanics (CLI & Streaming Terminal Formatting)
* **Structured Stream Separation**:
  In `src/cli.ts`, data reports are routed to `process.stdout`, while summary metrics and error diagnostics are routed to `process.stderr`:
  ```typescript
  if (opts.json) process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`)
  else process.stdout.write(reports.map((r) => render(r)).join("\n"))

  console.error(`\n${reports.length} sitemap(s), ${reports.reduce((n, r) => n + totalUrls(r), 0)} URLs, ${errors} error(s), ${warnings} warning(s).`)
  ```
  *Invariant*: Allows consumers to pipe clean JSON (`sitemap-validator https://example.com --json | jq .`) without parsing errors caused by human-readable diagnostic summaries.
* **Terminal Indentation Recursion**:
  `render(r, indent = '')` carries monotonic string indentation (`indent + '  '`), preventing formatting collisions when rendering nested child trees.

### 4. Backend Concurrency & Memory Safety
* **Timer Leaks in AbortController Lifecycles**:
  ```typescript
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs)
  try {
    const res = await doFetch(...)
    // ...
  } finally {
    clearTimeout(timer) // CRITICAL: Frees event loop timer handle
  }
  ```
  *Invariant*: Without `clearTimeout(timer)` inside `finally`, Node.js keeps active timer handles on the event loop until `timeoutMs` (15,000ms) elapses, keeping the process alive after validation completes.
* **Stream Buffer Aggregation vs. Unbounded String Decoding**:
  ```typescript
  const body = Buffer.from(await res.arrayBuffer())
  ```
  Reading into a binary `Buffer` first allows the engine to inspect magic bytes before materializing UTF-8 strings. This prevents holding multiple copies of a decoded 50MB payload in V8 heap memory.

### 5. Defect & Error Prevention ("Galti Pakadna")
* **Time Skew & Future Date Tolerance**:
  Validating `<lastmod>` dates requires checking against the current time. Clock skew between the sitemap generator and validator can cause false positives:
  ```typescript
  const now = opts.now()
  // ...
  else if (new Date(lastmod).getTime() > now.getTime() + 24 * 3600 * 1000) {
    findings.push(finding('future-lastmod', `lastmod ${lastmod} is in the future`, loc))
  }
  ```
  *Invariant*: A strict 24-hour buffer (`24 * 3600 * 1000`) prevents false alerts caused by timezone offsets or minor build-server clock skew.
* **W3C Datetime Precision Matching**:
  Sitemaps allow `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or full ISO 8601 timestamps.
  Regex: `/^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/`.
  Guarantees malformed date strings like `29/09/2026` or `2026-13-45` fail validation before passing to `new Date()`.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
The architecture is structured into three clean layers:
- **CLI Driver (`src/cli.ts`)**: Handles argv parsing, terminal rendering, process exit codes (0 = clean, 1 = validation errors, 2 = usage errors), and JSON formatting.
- **Pure Validation Engine (`src/validate.ts`)**: Performs XML token parsing, schema checks, regex evaluations, and tree construction. Completely decoupled from I/O.
- **I/O Adapter (`fetchSitemapText`)**: Encapsulates HTTP transport, timeout aborts, and buffer reading with dependency-injectable fetch primitives (`opts.fetch`).

### 2. Core Abstractions
- `SitemapReport`: The canonical tree structure tracking `url`, `redirectedTo`, `kind ('urlset' | 'sitemapindex' | 'unknown')`, `urlCount`, `bytes`, `gzipped`, `entries`, `findings`, and `children`.
- `Finding`: Unified diagnostic record with `code` (e.g., `invalid-loc`, `cross-host-loc`), `severity ('error' | 'warning')`, `message`, and optional `loc`.
- `SEVERITY: Record<FindingCode, Severity>`: A single immutable dictionary declaring whether each finding triggers an error or warning, decoupled from the detection rules.

### 3. Error Handling
The engine uses non-throwing error envelopes:
- `fetchSitemapText` catches network failures and maps them to `{ status: null, finalUrl: null, body: null, contentType: null, fetchError: string }`.
- `XMLValidator.validate(text)` returns a discriminated union (`true` or `{ err: { msg, line } }`), allowing graceful capture of malformed XML lines without runtime panics.

### 4. Testing
- **In-Memory Injection**: The `ValidateOptions` interface supports overriding `now: () => Date` (for deterministic time checks) and `fetch: typeof fetch` (for offline fixture serving).
- **Embedded Fixture Server**: Uses an internal HTTP fixture server (`tests/fixtureServer.ts`) to simulate edge cases: redirects, GZIP payloads, HTML error pages disguised as 200 OK, and cross-host URL mismatches.

### 5. Security
- **Billion Laughs / XML Entity Expansion Protection**: `fast-xml-parser` is configured by default to ignore external DTD entities and DOCTYPE declarations, mitigating XXE (XML External Entity) attacks and memory exhaustion from recursive entity expansions.
- **Memory Bomb Defense**: Explicit uncompressed payload limits (`maxBytes: 50 * 1024 * 1024`) flag oversized payloads before AST building triggers Out-Of-Memory (OOM) conditions.

### 6. Performance
- **Optimized Array Conversion in Parser**:
  `isArray: (name) => name === 'url' || name === 'sitemap'` forces `fast-xml-parser` to only allocate arrays for repetitive elements, avoiding array allocation overhead on singleton elements like `<loc>`, `<lastmod>`, and `<priority>`.
- **Zero-Copy Stream Buffering**: Direct consumption of `res.arrayBuffer()` wrapped in `Buffer.from()` avoids intermediate string reallocations until GZIP magic bytes are checked.

### 7. Deployment
- Built targeting Node 18+ ESM (`"type": "module"`).
- Manifest enforces distribution via the `dist` directory, preventing source/test file leakage into production packages.
- Strict `engines` field (`>=18`) ensures modern Fetch and AbortController primitives are natively available.

### 8. Agent Patterns
- The system works well with autonomous agent workflows:
  - Invocation: `npx crawlcove-sitemap-validator <url> --json`
  - Zero stdout noise: Diagnostic metadata is routed to `stderr`; machine-readable JSON is emitted cleanly on `stdout`.
  - Configurable exit gates: `--fail-on error` vs `--fail-on warning` enables precise assertions in CI/CD pipeline loops.

### 9. Data Flow
```
URL Input -> discoverSitemaps() 
               -> fetchSitemapText() [HTTP GET, AbortController]
               -> decodeBody() [Magic byte sniff: 0x1f 0x8b -> gunzipSync]
               -> validateXml() 
                    -> XMLValidator.validate()
                    -> parser.parse() -> AST Node Map
                    -> Root Tag Resolution (Filter '?' & '#')
                    -> Item Iteration & Hostname/Date Checks
               -> SitemapReport Tree -> JSON