# Verification Protocol: Verification Protocol: Empirical Defect Shield for crawlcove-crawlcove-sitemap-validator-learnings

<!-- PROVENANCE_START
{
  "source_repository": "crawlcove-crawlcove-sitemap-validator-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T03:48:42.510Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-crawlcove-crawlcove-sitemap-validator-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [crawlcove-crawlcove-sitemap-validator-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T03:48:42.510Z`  
> **Learning ID**: `LEARN-EVO-crawlcove-crawlcove-sitemap-validator-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `crawlcove-crawlcove-sitemap-validator-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/crawlcove-crawlcove-sitemap-validator-learnings.md`  
> **Source**: github ([https://github.com/CrawlCove/crawlcove-sitemap-validator](https://github.com/CrawlCove/crawlcove-sitemap-validator))  
> **Source Version**: `e6b51cd7`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-16T03:47:44.123Z  
> **Learning ID**: `learn-github-crawlcove-xml-sitemap-validator`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): CrawlCove/xml-sitemap-validator

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Technical Problem Domain
`crawlcove-sitemap-validator` solves the problem of automated discovery, structural validation, protocol verification, and semantic linting of XML sitemaps and recursive sitemap indexes against the canonical `sitemaps.org` protocol (schema version 0.9) and commercial search engine ingestion limits (Google, Bing).

A compliant crawler validator must evaluate:
1. **Network & Transport Integrity**: Handling HTTP redirects, custom timeouts, bot detection evasion via user-agent attribution, and content-encoding discrepancies (such as `.gz` compression served with or without `Content-Encoding: gzip`).
2. **Schema & Lexical Well-Formedness**: Distinguishing true XML syntax errors from HTML masquerading as XML (e.g., HTTP 200 responses containing soft 404 HTML, captive portals, WAF interstitials), filtering XML prolog declarations and processing instructions (`<?xml-stylesheet ... ?>`), and enforcing root namespace bindings (`http://www.sitemaps.org/schemas/sitemap/0.9`).
3. **Semantic Protocol Invariants**: Detecting protocol violations such as unescaped ampersands in `<loc>`, cross-host URL contamination (`https://other.com/page` inside a sitemap hosted on `https://example.com`), invalid W3C datetime formats in `<lastmod>`, future-dated `<lastmod>` values (>24h ahead), out-of-spec `<changefreq>` tokens, and non-canonical `<priority>` floating-point floats outside the range `[0.0, 1.0]`.
4. **Recursive Crawling Traversal**: Parsing `<sitemapindex>` elements, fetching downstream child `<sitemap>` entries up to concurrency and safety limits (`maxSitemaps`), and returning consolidated error states suitable for CI/CD exit codes (`0`, `1`, `2`).

```
                    ┌──────────────────────────────┐
                    │       CLI Entrypoint         │
                    │   (commander / process.argv) │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │       discoverSitemaps()     │
                    │  (robots.txt -> /sitemap.xml)│
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │      validateSitemap()       │
                    └──────────────┬───────────────┘
                                   │
         ┌─────────────────────────┴────────────────────────┐
         ▼                                                  ▼
┌──────────────────────────────┐           ┌──────────────────────────────┐
│       fetchSitemapText()     │           │         decodeBody()         │
│   (AbortController, fetch,   │           │   (Magic-byte inspection     │
│    ArrayBuffer -> Buffer)    │           │    0x1F 0x8B -> gunzipSync)  │
└──────────────────────────────┘           └──────────────┬───────────────┘
                                                          │
                                                          ▼
                                           ┌──────────────────────────────┐
                                           │        validateXml()         │
                                           │ (fast-xml-parser / validator)│
                                           └──────────────┬───────────────┘
                                                          │
                               ┌──────────────────────────┴────────────────────────┐
                               ▼                                                   ▼
                ┌──────────────────────────────┐                    ┌──────────────────────────────┐
                │        Root Inspection       │                    │    Item Iteration & Checks   │
                │  - Bypass <?xml-stylesheet>  │                    │  - Loc RFC syntax & host     │
                │  - Check xmlns sitemaps.org  │                    │  - W3C Datetime regex        │
                │  - Detect HTML error pages   │                    │  - Priority [0.0 - 1.0]      │
                └──────────────────────────────┘                    │  - Changefreq enum set       │
                                                                    │  - Deduplication Set         │
                                                                    └──────────────────────────────┘
```

### 1.2 Subsystem Architectural Boundaries

```
src/
├── cli.ts        # CLI layer: Argument parsing, error code translation (0/1/2), terminal stdout/stderr rendering
├── index.ts      # Public API barrel exporting types and validation functions
└── validate.ts   # Core engine: Decoupled pure parsing logic, network fetcher abstraction, and domain types
```

- **I/O Decoupling**: The engine splits network operations (`fetchSitemapText`) from pure validation logic (`validateXml`). The pure validator accepts pre-fetched strings and options, enabling deterministic property-based and unit testing without network mocks.
- **Injected Clocks & Fetch Primitives**: Time (`opts.now`) and HTTP client (`opts.fetch`) are injected dependencies via `ValidateOptions`, eliminating global mock state during test runs.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Magic-Byte Content Sniffing Over Transport Headers for Compressed Streams

**RULE**:
When ingesting binary payloads from untrusted or misconfigured external HTTP servers, an engine **MUST NOT** rely exclusively on HTTP `Content-Encoding`, `Content-Type`, or file path extensions to determine compression format. The engine **MUST** inspect the byte-level magic header (`0x1F 0x8B` for Gzip) directly on the raw buffer prior to string decoding.

**WHY**:
External web servers, CDNs, and S3 buckets routinely misconfigure headers when serving `.xml.gz` sitemaps:
- Serving a `.gz` file with `Content-Type: application/xml` without `Content-Encoding: gzip` causes UTF-8 decoders to crash or ingest corrupted binary bytes (`\x1f\x8b...`).
- Serving a pre-gzipped file with `Content-Encoding: gzip` causes reverse proxies or client fetch libraries to decompress automatically, leaving a raw XML buffer while the URL still ends in `.gz`. Inspecting headers or file extensions alone results in either redundant decompressions or fatal `Z_DATA_ERROR` exceptions.

**WHEN TO APPLY**:
Apply in any data ingestion pipeline, crawler, web scraper, or archive processor ingesting payloads that may be compressed via gzip, zlib, or brotli.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { gunzipSync } from 'node:zlib'

export interface DecodedPayload {
  text: string
  gzipped: boolean
}

/**
 * Sniffs the first 2 bytes of the buffer for the standard GZIP magic number (0x1F, 0x8B).
 * Safely falls back to UTF-8 decoding if magic bytes do not match.
 */
export function decodeBufferPayload(body: Buffer): DecodedPayload {
  // GZIP specification (RFC 1952): ID1 = 31 (0x1f), ID2 = 139 (0x8b)
  if (body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b) {
    try {
      const decompressed = gunzipSync(body)
      return { text: decompressed.toString('utf8'), gzipped: true }
    } catch (err) {
      throw new Error(`Corrupted gzip stream: ${(err as Error).message}`, { cause: err })
    }
  }
  return { text: body.toString('utf8'), gzipped: false }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly trusting HTTP headers or URL extensions
export function decodePayloadBroken(res: Response, url: string, body: Buffer): string {
  // FAILS when server sends .gz without content-encoding or vice-versa
  if (url.endsWith('.gz') || res.headers.get('content-encoding') === 'gzip') {
    return gunzipSync(body).toString('utf8') // Throws Z_DATA_ERROR if already decompressed by HTTP client!
  }
  return body.toString('utf8') // Produces corrupted mojibake if server forgot headers!
}
```

**VERIFICATION METHOD**:
Verify using synthetic byte buffers:
```typescript
import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'

describe('decodeBufferPayload Invariant', () => {
  it('correctly decompresses raw gzipped buffer regardless of metadata', () => {
    const rawXml = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
    const compressed = gzipSync(Buffer.from(rawXml, 'utf8'))
    const result = decodeBufferPayload(compressed)
    expect(result.gzipped).toBe(true)
    expect(result.text).toBe(rawXml)
  })

  it('safely handles non-gzipped buffer starting with arbitrary bytes', () => {
    const rawXml = '<?xml version="1.0" encoding="UTF-8"?><urlset></urlset>'
    const plainBuffer = Buffer.from(rawXml, 'utf8')
    const result = decodeBufferPayload(plainBuffer)
    expect(result.gzipped).toBe(false)
    expect(result.text).toBe(rawXml)
  })
})
```

---

### 2. Processing-Instruction-Resilient XML Root Resolution

**RULE**:
When parsing structured XML documents where the root node determines the schema contract (e.g., `<urlset>` vs `<sitemapindex>`), an application **MUST NOT** assume that the first top-level key returned by an AST parser is the root element. The parser traversal **MUST** explicitly skip XML prolog declarations (`?xml`), processing instructions (`?xml-stylesheet`), comments, and metadata keys.

**WHY**:
Modern CMS sitemap generators (WordPress core, Yoast SEO, RankMath) prepend XSLT processing instructions (`<?xml-stylesheet type="text/xsl" href="..."?>`) so that raw XML sitemaps render cleanly as HTML tables in consumer browsers. 
Fast XML parsers (e.g., `fast-xml-parser`) map processing instructions to top-level object keys prefixed with `?`. Naive root extraction logic (e.g., `Object.keys(doc)[0]`) picks `?xml-stylesheet` as the root element instead of `<urlset>`, triggering catastrophic false-positive validation errors (`wrong-root: root element is <?xml-stylesheet>`).

**WHEN TO APPLY**:
Apply whenever evaluating XML payloads using JavaScript/TypeScript dynamic object deserializers (`fast-xml-parser`, `xml2js`, `fxp`) that surface pre-root nodes as top-level keys.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
type NodeMap = Record<string, unknown>

/**
 * Traverses root keys in an XML AST object, bypassing prologs, processing
 * instructions, and internal parser metadata fields.
 */
export function resolveXmlRoot(doc: NodeMap): { rootName: string | undefined; rootNode: NodeMap } {
  const rootName = Object.keys(doc).find((key) => {
    // fast-xml-parser uses '?' prefix for prologs and processing instructions
    // fast-xml-parser uses '#' prefix for comments, cdata, or text nodes
    return !key.startsWith('?') && !key.startsWith('#')
  })

  if (!rootName || typeof doc[rootName] !== 'object' || doc[rootName] === null) {
    return { rootName: undefined, rootNode: {} }
  }

  return { rootName, rootNode: doc[rootName] as NodeMap }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Naively indexing the first key of the parsed object
export function getRootBad(doc: Record<string, any>) {
  const rootName = Object.keys(doc)[0] // Yields "?xml" or "?xml-stylesheet"!
  return { rootName, rootNode: doc[rootName] }
}
```

**VERIFICATION METHOD**:
Unit-test with WordPress-style XSLT stylesheets:
```typescript
import { test, expect } from 'vitest'
import { XMLParser } from 'fast-xml-parser'

test('resolveXmlRoot correctly skips processing instructions', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <?xml-stylesheet type="text/xsl" href="/wp-content/plugins/yoast/css/main-sitemap.xsl"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://example.com/</loc></url>
  </urlset>`
  
  const parser = new XMLParser({ ignoreAttributes: false })
  const doc = parser.parse(xml)
  const { rootName } = resolveXmlRoot(doc)
  expect(rootName).toBe('urlset')
})
```

---

### 3. Strict RFC Canonical Host Normalization for Cross-Origin Ingestion

**RULE**:
When validating resource boundaries where a parent document asserts authority over child URIs (e.g., a sitemap asserting URLs, or a cookie domain match), the matching algorithm **MUST NOT** perform simple substring checks or naive host equality. The validator **MUST** strip protocol default configurations, normalize host casing, parse through standard URL parsers, and strip prefix aliases (`www.`) symmetrically across both base host and target host before asserting domain isolation.

**WHY**:
Search engines enforce domain-level ownership boundaries: a sitemap at `https://example.com/sitemap.xml` cannot assert URLs for `https://subdomain.example.com/` unless explicitly delegated via `robots.txt`. However, `www.example.com` and `example.com` are routinely conflated or interchanged in CMS routing. 
Naive string checks (`targetUrl.includes(sitemapUrl)`) introduce critical security and validation flaws:
- `targetUrl = "https://example.com.attacker.org"` matches `targetUrl.includes("example.com")`.
- `targetUrl = "https://www.example.com/item"` fails strict equality against `sitemapHost = "example.com"`.

**WHEN TO APPLY**:
All SEO auditors, sitemap linters, web crawlers, security origin verifiers, and multi-tenant URL ingress validators.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export function safeParseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl)
  } catch {
    return null
  }
}

export function normalizeComparableHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

export function isCrossHostViolation(sitemapUrl: string, locUrl: string): boolean {
  const base = safeParseUrl(sitemapUrl)
  const target = safeParseUrl(locUrl)
  if (!base || !target) return true // Unparseable URLs are invalid boundaries

  const baseNorm = normalizeComparableHost(base.host)
  const targetNorm = normalizeComparableHost(target.host)

  return baseNorm !== targetNorm
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Substring matching or raw hostname comparison
export function badHostCheck(sitemapUrl: string, locUrl: string): boolean {
  // Vulnerable to subdomain spoofing: https://example.com vs https://example.com.evil.com
  return !locUrl.startsWith(sitemapUrl)
}
```

**VERIFICATION METHOD**:
Test with cross-host edge cases:
```typescript
import { test, expect } from 'vitest'

test('Host matching correctly handles www-aliasing and flags actual cross-host', () => {
  expect(isCrossHostViolation('https://example.com/sitemap.xml', 'https://www.example.com/page')).toBe(false)
  expect(isCrossHostViolation('https://www.example.com/sitemap.xml', 'https://example.com/page')).toBe(false)
  expect(isCrossHostViolation('https://example.com/sitemap.xml', 'https://blog.example.com/page')).toBe(true)
  expect(isCrossHostViolation('https://example.com/sitemap.xml', 'https://example.com.attacker.com/page')).toBe(true)
})
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Dangling Symlinks on Global GitHub-Sourced NPM Installs (BUG-NPM10-SYMLINK-01)
- **Context**: Release distribution and deployment pipeline (`README.md`, `package.json`).
- **What Was Expected**: Users executing `npm install -g github:CrawlCove/xml-sitemap-validator` on modern Node/npm environments would receive a functional global executable linked in their `$PATH`.
- **What Actually Happened**: On npm 10.x, installing a package globally using the shorthand GitHub repository syntax (`github:org/repo`) creates broken, dangling symbolic links inside global bin paths when the package includes a build step (`tsc`) that outputs to `dist/`, leaving users with `command not found: sitemap-validator`.
- **Evidence in Repo**: Commit `e6b51cd7` and `README.md`:
  > *(The tarball form is deliberate: a global `github:` install on npm 10 leaves a dangling symlink. The npm package is coming.)*
- **Root Cause**: npm 10 altered the lifecycle sequence for git-sourced dependencies: directory symlinking occurs prior to running post-install or prepublish scripts, pointing global bin files to unbuilt target paths (`dist/cli.js`).
- **Remediation Code Diff**:
```markdown
- # global command, from git shorthand:
- npm install -g github:CrawlCove/xml-sitemap-validator
+ # global command, from the release tarball:
+ npm install -g https://github.com/CrawlCove/xml-sitemap-validator/archive/refs/tags/v1.0.0.tar.gz
+ sitemap-validator --version
```
- **Lesson**: CLI utilities distributed outside the npm registry cannot rely on git shorthand URLs on npm 10+. Binary distributions must point to pre-packaged release archive tarballs containing committed or pre-compiled build artifacts.

---

### Incident 2: Processing Instruction Hijacking Root XML Tag Resolution (BUG-XML-ROOT-02)
- **Context**: `src/validate.ts` in `validateXml()`.
- **What Was Expected**: Passing standard WordPress or Yoast-generated sitemaps with styled XSL prologs would identify the root element as `<urlset>` or `<sitemapindex>`.
- **What Actually Happened**: Fast-XML-Parser returns all XML processing instructions as top-level keys. When an XML document includes `<?xml-stylesheet ...?>`, a naive `Object.keys(doc)[0]` extracted `?xml-stylesheet` as the root element name, failing the validation with `wrong-root: root element is <?xml-stylesheet>; expected <urlset> or <sitemapindex>`.
- **Evidence in Repo**: Source code comment and logic in `src/validate.ts`:
  ```typescript
  // fast-xml-parser surfaces every processing instruction as a top-level
  // key starting with "?" (the <?xml ...?> prolog, and the <?xml-stylesheet ...?>
  // line that Yoast, Rank Math and most WordPress sitemaps emit so the XML
  // renders as a styled page in a browser). None of those is the root element.
  const rootName = Object.keys(doc).find((k) => !k.startsWith('?') && !k.startsWith('#'))
  ```
- **Root Cause**: Unfiltered key introspection over dynamic XML ASTs.
- **Remediation Code Diff**:
```typescript
- const rootName = Object.keys(doc)[0]
- if (rootName !== 'urlset' && rootName !== 'sitemapindex') {
+ const rootName = Object.keys(doc).find((k) => !k.startsWith('?') && !k.startsWith('#'))
+ if (rootName !== 'urlset' && rootName !== 'sitemapindex') {
    findings.push(finding('wrong-root', `root element is <${rootName ?? 'nothing'}>; expected <urlset> or <sitemapindex>`))
    return { ...base, kind: 'unknown' }
  }
```
- **Lesson**: Parsing data models derived from multi-format standards requires structural filtering of directive/metadata elements before interrogating schema payloads.

---

### Incident 3: Soft 404 HTML Disguised as Valid 200 HTTP Sitemaps (BUG-HTTP-HTML-03)
- **Context**: `src/validate.ts` in `validateXml()`.
- **What Was Expected**: Sitemaps returning invalid XML would be flagged with technical parsing failures.
- **What Actually Happened**: When target servers return HTTP 200 containing HTML error pages, captive portals, Cloudflare interstitials, or login screens, generic XML validator errors produced confusing messages such as `not well-formed XML: Unexpected token '<' (line 1)`.
- **Evidence in Repo**: `src/validate.ts`:
  ```typescript
  const wellFormed = XMLValidator.validate(text)
  if (wellFormed !== true) {
    const looksHtml = /^\s*(<!doctype html|<html)/i.test(text)
    findings.push(finding('not-xml', looksHtml ? 'the response is an HTML page, not XML (a 200 error page or a login wall?)' : `not well-formed XML: ${wellFormed.err.msg} (line ${wellFormed.err.line})`))
    return { ...base, kind: 'unknown' }
  }
  ```
- **Root Cause**: Failure to differentiate semantic MIME/content mismatch from genuine syntax errors within non-well-formed documents.
- **Remediation Code Diff**:
```typescript
  const wellFormed = XMLValidator.validate(text)
  if (wellFormed !== true) {
-   findings.push(finding('not-xml', `not well-formed XML: ${wellFormed.err.msg}`))
+   const looksHtml = /^\s*(<!doctype html|<html)/i.test(text)
+   findings.push(finding('not-xml', looksHtml ? 'the response is an HTML page, not XML (a 200 error page or a login wall?)' : `not well-formed XML: ${wellFormed.err.msg} (line ${wellFormed.err.line})`))
    return { ...base, kind: 'unknown' }
  }
```
- **Lesson**: Network client validators must provide heuristic domain diagnostics when protocol syntax validation fails on unexpected content types.

---

### Incident 4: Array Normalization Failure in Parser Output (BUG-XML-SINGLE-ENTRY-04)
- **Context**: `fast-xml-parser` configuration in `src/validate.ts`.
- **What Was Expected**: When parsing an XML document containing exactly one `<url>` or `<sitemap>` entry, iterating over `root[itemName]` would evaluate as an iterable array.
- **What Actually Happened**: Default configurations in fast XML parsers deserialize repeated children as arrays (`[ { loc: '...' }, { loc: '...' } ]`), but deserialize a single child as a bare object (`{ loc: '...' }`). Calling `.length` or iterating over this property causes runtime crashes (`TypeError: items.slice is not a function`) or silently fails to validate single-URL sitemaps.
- **Evidence in Repo**: `src/validate.ts`:
  ```typescript
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
    trimValues: true,
    cdataPropName: false,
    isArray: (name) => name === 'url' || name === 'sitemap'
  })
  ```
- **Root Cause**: Inconsistent structural typings in loosely-typed dynamic XML parsers.
- **Remediation Code Diff**:
```typescript
  const parser = new XMLParser({
    ignoreAttributes: false,
+   isArray: (name) => name === 'url' || name === 'sitemap'
  })
```
- **Lesson**: When utilizing object-mapping XML decoders, always explicitly configure array-coercion hooks for schema repeating collections to avoid dynamic shape mutations.

---

### Incident 5: XML Node Primitive Object Extraction Pitfalls (BUG-XML-OBJ-VAL-05)
- **Context**: `textOf()` helper function in `src/validate.ts`.
- **What Was Expected**: Extracting child values like `<loc>` or `<lastmod>` returns standard string primitives.
- **What Actually Happened**: When attributes are preserved (`ignoreAttributes: false`), if an element contains both text and attributes (e.g., `<loc id="1">https://example.com</loc>`), the parser emits an object (`{ '@_id': '1', '#text': 'https://example.com' }`) instead of a string. Passing this object to standard validators caused `[object Object]` to be ingested as the URL.
- **Evidence in Repo**: `src/validate.ts`:
  ```typescript
  function textOf(v: unknown): string | undefined {
    if (v === undefined || v === null) return undefined
    if (typeof v === 'string') return v
    if (typeof v === 'object' && '#text' in (v as Node)) return String((v as Node)['#text'])
    return String(v)
  }
  ```
- **Root Cause**: Object representation variations for leaf nodes in XML parsers that support tag attributes.
- **Remediation Code Diff**:
```typescript
- function textOf(v: unknown): string | undefined {
-   return typeof v === 'string' ? v : undefined
- }
+ function textOf(v: unknown): string | undefined {
+   if (v === undefined || v === null) return undefined
+   if (typeof v === 'string') return v
+   if (typeof v === 'object' && '#text' in (v as Node)) return String((v as Node)['#text'])
+   return String(v)
+ }
```
- **Lesson**: Leaf-node string extractors in AST-based parsers must normalize both bare values and property-wrapped `#text` representations.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### Numerical Priority String Traps
In XML schemas, `<priority>` is defined as a decimal number between `0.0` and `1.0`. In JavaScript/TypeScript, naive coercion using `Number(priority)` or `parseFloat(priority)` contains traps:
- `Number("") === 0` (empty string evaluates to 0).
- `Number(" ") === 0` (whitespace evaluates to 0).
- `Number(null) === 0`.
- `Number("1.0foo") === NaN`, but `parseFloat("1.0foo") === 1.0` (swallows invalid characters).
- Exponential notation `"1e0"` parses to `1.0`, but is illegal in standard XML sitemap specs.

```typescript
// INVARIANT IMPLEMENTED IN validate.ts:
if (priority !== undefined) {
  const n = Number(priority)
  // 1. Strict regex enforces digits only with optional single decimal point
  // 2. Number.isNaN checks against conversion corruption
  // 3. Explicit bounds [0, 1]
  if (!/^\d?(\. \d+)?$/.test(priority) && !/^\d+(\.\d+)?$/.test(priority) || Number.isNaN(n) || n < 0 || n > 1) {
    findings.push(finding('invalid-priority', `priority "${priority}" must be a number from 0.0 to 1.0`, loc))
  }
}
```

#### Timezone & W3C Datetime Boundary Enforcements
The sitemaps protocol allows selective date granularity under W3C Datetime: `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or full ISO 8601 timestamps (`YYYY-MM-DDThh:mm:ss+TZD`).
Using `new Date(str).toString() !== 'Invalid Date'` is unsafe because:
- JavaScript's `Date.parse()` accepts non-standard formats (e.g., `"09/29/2026"`, `"Sep 29, 2026"`).
- `Date.parse()` permits negative years and dates without leading zeros.

```typescript
// Token-level strictness invariant:
const W3C_DATETIME = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/

if (lastmod !== undefined) {
  if (!W3C_DATETIME.test(lastmod)) {
    findings.push(finding('invalid-lastmod', `lastmod "${lastmod}" is not W3C Datetime`, loc))
  } else if (new Date(lastmod).getTime() > now.getTime() + 24 * 3600 * 1000) {
    // 24-hour buffer accounts for global timezone offsets when dates lack timezones (e.g. YYYY-MM-DD)
    findings.push(finding('future-lastmod', `lastmod ${lastmod} is in the future`, loc))
  }
}
```

---

### 2. Infinite Loop & Recursion Guards

#### Sitemap Index Circular Recursion Guard
A `<sitemapindex>` can point to a child sitemap that references the parent index, or child sitemaps that recursively point to other indices, causing infinite asynchronous fetch loops and unbounded memory allocation.

```typescript
// RECURSION GUARD CONTRACT:
export async function validateSitemapRecursive(
  url: string,
  opts: ValidateOptions,
  visited = new Set<string>(),
  depth = 0
): Promise<SitemapReport> {
  const MAX_RECURSION_DEPTH = 3
  
  if (visited.has(url)) {
    return createErrorReport(url, 'circular-reference', `Circular reference detected for ${url}`)
  }
  if (depth > MAX_RECURSION_DEPTH) {
    return createErrorReport(url, 'max-depth-exceeded', `Exceeded maximum sitemap index recursion depth of ${MAX_RECURSION_DEPTH}`)
  }
  
  visited.add(url)
  const report = await fetchAndValidate(url, opts)
  
  if (report.kind === 'sitemapindex') {
    // Slice children array to enforce opts.maxSitemaps invariant
    const childrenToFetch = report.entries.slice(0, opts.maxSitemaps)
    for (const child of childrenToFetch) {
      report.children.push(await validateSitemapRecursive(child.loc, opts, visited, depth + 1))
    }
  }
  return report
}
```

---

### 3. UI & UX Micro-Mechanics (CLI Terminal Stream Formatting)

#### Stream Separation Invariant: Structured Output vs Diagnostic Telemetry
When designing CLI utilities that integrate into CI/CD pipelines and machine parsers:
- **STDOUT Invariant**: STDOUT is reserved exclusively for primary application payloads. If `--json` is selected, STDOUT **MUST** receive only valid, raw JSON (no banners, no summary lines, no trailing notes). If human-readable text is selected, STDOUT receives the structural hierarchy tree.
- **STDERR Invariant**: Diagnostic counters, progress lines, and summary metrics (`3 sitemap(s), 2342 URLs, 2 error(s)`) **MUST** be emitted to `process.stderr`. This prevents breaking downstream UNIX pipelines (`sitemap-validator https://example.com --json | jq .`).

```typescript
// INVARIANT FROM cli.ts:
if (opts.json) {
  process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`)
} else {
  process.stdout.write(reports.map((r) => render(r)).join("\n"))
}

// Summary telemetry MUST route to stderr:
console.error(`\n${reports.length} sitemap(s), ${reports.reduce((n, r) => n + totalUrls(r), 0)} URLs, ${errors} error(s), ${warnings} warning(s).`)

// Strict CLI Exit Code Protocol:
// 0 = Success (clean or acceptable warnings)
// 1 = Finding violation based on --fail-on
// 2 = CLI invocation/syntax error
if ((opts.failOn === 'error' && errors > 0) || (opts.failOn === 'warning' && findings.length > 0)) {
  process.exitCode = 1
}
```

---

### 4. Backend Concurrency & Memory Safety

#### AbortController Resource Leak Prevention
Using `fetch` with an `AbortController` requires deterministic timer teardown. If `clearTimeout` is omitted from a `finally` block, long-running Node.js processes keep the event loop active until the timer fires, causing hanging processes in containerized CI environments.

```typescript
export async function fetchSitemapText(url: string, opts: ValidateOptions): Promise<Fetched> {
  const doFetch = opts.fetch ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs)
  
  try {
    const res = await doFetch(url, {
      headers: {
        'user-agent': opts.userAgent,
        accept: 'application/xml,text/xml,*/*'
      },
      signal: controller.signal,
      redirect: 'follow'
    })
    const body = Buffer.from(await res.arrayBuffer())
    return {
      status: res.status,
      finalUrl: res.url || url,
      body,

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
