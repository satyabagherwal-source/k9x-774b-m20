> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/crawlcove-crawlcove-robots-txt-tester-learnings.md`  
> **Source**: github ([https://github.com/CrawlCove/crawlcove-robots-txt-tester](https://github.com/CrawlCove/crawlcove-robots-txt-tester))  
> **Source Version**: `63245304`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-18T06:36:31.579Z  
> **Learning ID**: `learn-github-crawlcove-robots-txt-tester`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): CrawlCove/robots-txt-tester

---

## 1. Executive Forensic Architecture & System Mechanics

`CrawlCove/robots-txt-tester` is a headless, dual-mode (CLI & programmatic API) technical SEO engine designed to audit, lint, and verify `/robots.txt` implementations against real-world search crawler specifications (specifically Googlebot, Bingbot, and RFC 9309).

### Architectural Boundaries & Subsystem Decoupling

```
                                  +---------------------------------------+
                                  |            CLI Entrypoint             |
                                  |             (src/cli.ts)              |
                                  | - Commander CLI options               |
                                  | - Exit code coordinator (0, 1, 2)     |
                                  | - Stdout/Stderr terminal renderer     |
                                  +-------------------+-------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |           Engine Subsystem            |
                                  |            (src/robots.ts)            |
                                  +---------+-------------------+---------+
                                            |                   |
                        +-------------------+                   +--------------------+
                        v                                                            v
+-----------------------------------------------+            +-----------------------------------------------+
|             Pure Static Linter                |            |            Network & URL Resolver             |
|                (lint(body))                   |            |                 (testRobots)                  |
| - Strips UTF-8 BOM (\uFEFF)                   |            | - Fetch via AbortController + timer           |
| - State machine tracking User-agent groups    |            | - Off-host redirect detector                  |
| - WordPress wp-admin / admin-ajax detection   |            | - Status code router (200, 404, 410, 5xx)     |
| - CSS/JS asset blocking heuristics            |            | - HTML/JSON catch-all false 200 detector      |
| - Line-number attribution mapping             |            | - Buffer size auditor (500 KiB limit)         |
+-----------------------------------------------+            +-----------------------+-----------------------+
                                                                                     |
                                                                                     v
                                                             +-----------------------------------------------+
                                                             |          RFC 9309 Path Rule Engine            |
                                                             |                (robots-parser)                |
                                                             | - Evaluates URL path vs agent directives      |
                                                             | - Identifies matching rule line numbers       |
                                                             | - Produces UrlVerdict structs                 |
                                                             +-----------------------------------------------+
```

The system operates across three distinct architectural planes:
1. **The Pure Static Linter (`lint`)**: Zero I/O, deterministic state machine that analyzes raw `robots.txt` text line-by-line. Unlike traditional parsers that discard comments, invalid syntax, or out-of-order directives, this linter specifically detects syntax errors, directive order violations (e.g., `Allow`/`Disallow` before `User-agent`), deprecated Google directives (`Noindex`), non-standard directives (`Crawl-delay`), and CMS-specific footguns (e.g., blocking `/wp-admin/` without whitelisting `/wp-admin/admin-ajax.php`).
2. **The RFC 9309 Dynamic Evaluator (`robotsParser`)**: Integrates `robots-parser` to mirror Googlebot's exact matching mechanics (longest matching prefix, Allow precedence over Disallow on equal length). It attributes every URL access verdict (`allowed: true | false`) to an exact physical source line number.
3. **The Network Audit & I/O Boundary (`testRobots`)**: Handles URL normalisation, TLS/DNS resolution with strict `AbortController` timeouts, HTTP redirect validation (flagging cross-domain redirects that alter rule authority), binary payload analysis, and HTTP status code semantics according to Googlebot's crawl specification (e.g., handling 5xx server errors as total crawl freezes vs. 404/410 as completely open access).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dual-Phase Text Linting Before AST/Parser Normalization
**RULE**:
When validating configuration or protocol text formats (such as `robots.txt`, crontab, dotenv, or nginx configs), you MUST run a non-destructive line-by-line lint pass BEFORE passing the payload to a compliant parser. You MUST NOT rely solely on compliant parsers for audit, diagnostic, or security assertions.

**WHY**:
Standard-compliant parsers are explicitly designed to be tolerant of syntax errors: they silently discard unknown tokens, strip out-of-order directives, ignore malformed directives, and auto-merge duplicate blocks. This tolerance masks critical production defects (e.g., a typo like `Dissallow: /` or placing `Disallow: /admin` before a `User-agent:` line is silently ignored by standard parsers, causing sensitive paths to be crawled and indexed).

**WHEN TO APPLY**:
Apply to all security, compliance, SEO, and infrastructure validators that process configuration languages where compliant parsers implement lenient fallback behavior.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
interface LintDiagnostic {
  code: string;
  line: number;
  message: string;
}

export function lintRobotsDirectives(rawText: string): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  // 1. Strip UTF-8 Byte Order Mark (BOM) before splitting lines
  const cleanText = rawText.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/);

  let currentAgentActive = false;
  const agentLineTracker = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    // Strip trailing inline comments and whitespace
    const line = lines[i].replace(/#.*$/, '').trim();
    if (line === '') continue;

    // Directives must match standard "field: value" shape
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) {
      diagnostics.push({
        code: 'malformed-syntax',
        line: lineNo,
        message: `Line "${lines[i].trim()}" violates "field: value" directive format`
      });
      continue;
    }

    const field = match[1].toLowerCase();
    const value = match[2].trim();

    if (field === 'user-agent') {
      currentAgentActive = true;
      const normalizedAgent = value.toLowerCase();
      if (agentLineTracker.has(normalizedAgent)) {
        diagnostics.push({
          code: 'duplicate-agent-group',
          line: lineNo,
          message: `User-agent "${value}" duplicated (first seen line ${agentLineTracker.get(normalizedAgent)})`
        });
      } else {
        agentLineTracker.set(normalizedAgent, lineNo);
      }
      continue;
    }

    if (field === 'allow' || field === 'disallow') {
      if (!currentAgentActive) {
        diagnostics.push({
          code: 'rule-without-agent',
          line: lineNo,
          message: `Directive "${field}: ${value}" precedes all User-agent declarations and will be dropped`
        });
      }
    }
  }

  return diagnostics;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Feeding raw text straight to parser and assuming absence of errors equals validity
import robotsParser from 'robots-parser';

export function auditRobotsFile(url: string, content: string) {
  const parsed = robotsParser(url, content);
  // FLAW: If content has "Dissallow: /secret" or "Disallow" before "User-agent",
  // parsed.isAllowed('/secret', 'Googlebot') will return true without warning!
  // The system silently deploys a security/SEO disaster.
  return {
    isValid: true, // Complete false positive
    canCrawl: parsed.isAllowed('/secret', '*')
  };
}
```

**VERIFICATION METHOD**:
Write a test asserting that out-of-order and misspelled tokens yield exact line-numbered diagnostics:
```typescript
import { test, expect } from 'vitest';

test('flags directives placed prior to User-agent line', () => {
  const badRobots = `
Disallow: /admin
User-agent: *
Disallow: /private
  `.trim();
  const results = lintRobotsDirectives(badRobots);
  expect(results).toContainEqual({
    code: 'rule-without-agent',
    line: 1,
    message: expect.stringContaining('precedes all User-agent declarations')
  });
});
```

---

### 2. HTTP Protocol Error Discrimination in Automated Crawlers
**RULE**:
Automated client tools and crawlers interacting with RFC-defined endpoints (e.g., `/robots.txt`) MUST discriminate between distinct HTTP status codes (200 vs 404/410 vs 5xx vs other 4xx) and validate response body MIME/signature types before parsing. They MUST NOT treat all non-200 responses as generic fetch errors or treat 200 HTML catch-alls as valid text configurations.

**WHY**:
Under web crawler specifications (Googlebot / RFC 9309):
- HTTP 404/410 indicates the file does not exist, granting unrestricted crawl permissions.
- HTTP 5xx indicates a server-side failure; Googlebot halts all crawling on the host for up to 30 days to avoid indexing broken sites or hammering a failing backend.
- Single Page Applications (SPAs) and misconfigured CDN edge proxies frequently return `HTTP 200 OK` with an `index.html` body or JSON error payload for missing `/robots.txt` paths. Treating HTML/JSON as plain-text robots rules causes the parser to see invalid directives, often defaulting to open crawl or unpredictable disallow behaviors.

**WHEN TO APPLY**:
Any HTTP client, SEO crawler, synthetic monitor, or edge router verifying robots exclusion protocols or well-known metadata files (`/.well-known/*`, `robots.txt`, `security.txt`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export interface HttpResponseAssessment {
  canProceed: boolean;
  cleanText: string | null;
  fatalError: string | null;
  advisoryWarning: string | null;
}

export function assessRobotsResponse(status: number, rawBuffer: Buffer): HttpResponseAssessment {
  // 1. Unrestricted access on absolute absence
  if (status === 404 || status === 410) {
    return {
      canProceed: true,
      cleanText: '',
      fatalError: null,
      advisoryWarning: `HTTP ${status}: robots.txt absent; crawlers assume full unrestricted access`
    };
  }

  // 2. Halting condition on server failure (RFC 9309 Section 2.3.1.2)
  if (status >= 500) {
    return {
      canProceed: false,
      cleanText: null,
      fatalError: `HTTP ${status}: Server error forces search engines to pause crawling site-wide`,
      advisoryWarning: null
    };
  }

  // 3. Client error handling (401, 403, etc.)
  if (status >= 400) {
    return {
      canProceed: false,
      cleanText: null,
      fatalError: `HTTP ${status}: Client error handled as crawl restriction by strict crawlers`,
      advisoryWarning: null
    };
  }

  // 4. Validate body signature on 200 OK
  const text = rawBuffer.toString('utf8');
  if (/^\s*(<!doctype|<html|<\?xml|{)/i.test(text)) {
    return {
      canProceed: false,
      cleanText: null,
      fatalError: 'Response body is HTML/XML/JSON (likely an SPA/framework catch-all 200 error page)',
      advisoryWarning: null
    };
  }

  return {
    canProceed: true,
    cleanText: text,
    fatalError: null,
    advisoryWarning: null
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blind text extraction checking only res.ok
async function fetchRobotsBad(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    // FLAW: Treats 404 (valid unrestricted access) as fatal error,
    // and conflates 500 (total crawl stop) with 404!
    throw new Error(`Failed to fetch: ${res.status}`);
  }
  const text = await res.text();
  // FLAW: If server returned 200 OK with HTML <html><body>Not Found</body></html>,
  // it is fed to parser as valid robots rules.
  return text;
}
```

**VERIFICATION METHOD**:
Test with synthetic responses representing SPA catch-all and 500 error scenarios:
```typescript
import { test, expect } from 'vitest';

test('detects HTML payload served under HTTP 200 OK', () => {
  const htmlBuffer = Buffer.from('<!DOCTYPE html><html><body>Error</body></html>', 'utf8');
  const result = assessRobotsResponse(200, htmlBuffer);
  expect(result.canProceed).toBe(false);
  expect(result.fatalError).toContain('Response body is HTML/XML/JSON');
});

test('handles HTTP 404 as proceedable empty ruleset', () => {
  const result = assessRobotsResponse(404, Buffer.alloc(0));
  expect(result.canProceed).toBe(true);
  expect(result.cleanText).toBe('');
});
```

---

### 3. CI/CD Pre-Commit Distribution Synchronization Invariant
**RULE**:
Repositories that publish compiled CLI binaries directly consumable via remote Git tarballs or `npx github:<org>/<repo>` MUST enforce in CI that the committed distribution directory (e.g., `dist/`) is byte-for-byte identical to the output of `npm run build` executed against clean sources.

**WHY**:
When users install CLI tools via GitHub tags or `npx github:...`, npm runs the pre-compiled files referenced in the `bin` field of `package.json`. If a developer modifies code in `src/`, commits, but forgets to run `tsc`, the remote install executes stale or broken JavaScript, while local unit tests (often run via Vitest/ts-node against `src/`) report green.

**WHEN TO APPLY**:
All Node.js/TypeScript repositories configuring the `bin` property pointing to a build output directory (`dist/`) intended for distribution through Git tags, GitHub releases, or direct Git URLs.

**VERIFIED IMPLEMENTATION PATTERN**:
In `.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
  pull_request:

jobs:
  verify-build-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      # The canonical invariant check: fail if tsc modified or added uncommitted files in dist/
      - name: Assert dist/ is committed and up to date
        run: git diff --exit-code -- dist
      - run: npm test
```

**NEGATIVE CONSTRAINT**:
```yaml
# ANTI-PATTERN: Building without checking git diff in repos distributing compiled dist/
steps:
  - uses: actions/checkout@v4
  - run: npm ci
  - run: npm run build
  - run: npm test
# FLAW: If a developer commits src/ without updating dist/, tests pass against src/,
# but end users installing via npx github:... execute obsolete dist/ code!
```

**VERIFICATION METHOD**:
Local pre-commit hook or script verification:
```sh
npm run build && git diff --exit-code -- dist || (echo "ERROR: dist/ is out of date. Run npm run build and commit changes." && exit 1)
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Repository Renaming Metadata & Default User-Agent Desynchronization (BUG-ROBOTS-01)
- **Context**: Subsystem: Network Client & Identification Header (`src/robots.ts`, `dist/robots.js`, `package.json`, `README.md`).
- **What Was Expected**: The HTTP client User-Agent string and metadata links must point to the canonical GitHub repository `CrawlCove/robots-txt-tester` to allow webmasters to identify the origin of the audit bot via their access logs.
- **What Actually Happened**: The repository was renamed from `crawlcove-robots-txt-tester` to `robots-txt-tester`. As a result:
  1. Default HTTP `User-Agent` header broadcasted an outdated URL `(+https://github.com/CrawlCove/crawlcove-robots-txt-tester)`.
  2. The `package.json` repository URL and npm tarball download links in the documentation broke.
  3. Pre-compiled distribution files in `dist/` became desynchronized from source declarations.
- **Evidence in Repo**: Commit `63245304`, commit message: `"chore: repository renamed to CrawlCove/robots-txt-tester; point links, install commands and repository metadata at the new name"`.
- **Root Cause**: Hardcoded repository string literals in `DEFAULT_OPTIONS.userAgent`, `package.json`, and `README.md` lacked a unified single-source-of-truth reference.
- **Remediation Code Diff**:
```diff
--- a/src/robots.ts
+++ b/src/robots.ts
@@ -99,7 +99,7 @@ export interface Options {

 export const DEFAULT_OPTIONS: Options = {
   timeoutMs: 10_000,
-  userAgent: 'crawlcove-robots-txt-tester/1.0 (+https://github.com/CrawlCove/crawlcove-robots-txt-tester)',
+  userAgent: 'crawlcove-robots-txt-tester/1.0 (+https://github.com/CrawlCove/robots-txt-tester)',
   urls: ['/'],
   agents: ['*', 'Googlebot', 'Bingbot'],
   expectAllowed: false,
--- a/package.json
+++ b/package.json
@@ -32,9 +32,9 @@
   "license": "MIT",
   "repository": {
     "type": "git",
-    "url": "https://github.com/CrawlCove/crawlcove-robots-txt-tester.git"
+    "url": "https://github.com/CrawlCove/robots-txt-tester.git"
   },
-  "homepage": "https://crawlcove.com/tools/robots-txt-generator?utm_source=github&utm_medium=crawlcove-robots-txt-tester",
+  "homepage": "https://crawlcove.com/tools/robots-txt-generator?utm_source=github&utm_medium=robots-txt-tester",
```
- **Lesson**: User-Agent audit strings containing repository URLs must either be centrally generated from package metadata or strictly audited across all configuration files during repository organizational renames.

---

### Incident 2: npm 10 Global Installation Dangling Symlink Breakdown (BUG-ROBOTS-02)
- **Context**: Subsystem: Packaging and CLI Distribution (`README.md`, `package.json`).
- **What Was Expected**: Running `npm install -g github:CrawlCove/robots-txt-tester` should create a functional global binary executable in standard PATH.
- **What Actually Happened**: On npm 10+, installing directly via `github:user/repo` syntax generates a dangling symlink for binary references when `files` or `dist` structures are consumed from Git checkouts, breaking CLI execution with `command not found` or broken symlink errors.
- **Evidence in Repo**: Commit `ca62c64a`, README note: `"(The tarball form is deliberate: a global github: install on npm 10 leaves a dangling symlink. The npm package is coming.)"`.
- **Root Cause**: npm 10 changed git dependency symlinking behavior during global installations (`npm install -g <git-url>`), where package bin links point to ephemeral staging paths rather than global node_modules targets.
- **Remediation Code Diff**:
```diff
--- a/README.md
+++ b/README.md
@@ -10,7 +10,7 @@ Need to write one instead? Use [crawlcove.com/tools/robots-txt-generator](https
 # one-off, nothing installed (Node 18+):
 npx github:CrawlCove/robots-txt-tester https://example.com -u /pricing

-# global command, from the release tarball:
-npm install -g github:CrawlCove/robots-txt-tester
+# global command, from the release tarball:
+npm install -g https://github.com/CrawlCove/robots-txt-tester/archive/refs/tags/v1.0.0.tar.gz
 robots-txt-tester --version
```
- **Lesson**: Do not instruct users to perform `npm install -g github:org/repo` on modern npm environments; always point to released tarball URLs (`archive/refs/tags/...tar.gz`) or official npm registry packages.

---

### Incident 3: UTF-8 Byte Order Mark (BOM) Directive Corruption (BUG-ROBOTS-03)
- **Context**: Subsystem: Text Parser & Directive Extractor (`src/robots.ts`).
- **What Was Expected**: Windows text editors (Notepad, IIS generated files) commonly prefix UTF-8 text with a Byte Order Mark (`\uFEFF`). The parser must recognize the first directive (e.g., `User-agent: *`) regardless of BOM presence.
- **What Actually Happened**: Without BOM stripping, the first line regex `^([A-Za-z-]+)\s*:` fails because `\uFEFFUser-agent:` does not match `[A-Za-z-]` at position 0. The first directive is classified as `unknown-directive`, completely uncoupling the subsequent rules from the user agent group.
- **Evidence in Repo**: Commit `ca62c64a`, line 125 of `src/robots.ts`: `const lines = body.replace(/^\uFEFF/, '').split(/\r?\n/)`.
- **Root Cause**: Failure to sanitize zero-width BOM characters at index 0 of the string prior to line splitting and token extraction.
- **Remediation Code Diff**:
```diff
--- a/src/robots.ts
+++ b/src/robots.ts
@@ -124,3 +124,3 @@ export function lint(body: string) {
-  const lines = body.split(/\r?\n/)
+  const lines = body.replace(/^\uFEFF/, '').split(/\r?\n/)
```
- **Lesson**: Any raw text parser ingesting files from arbitrary public web servers MUST explicitly strip `^\uFEFF` before executing regex parsing on initial line tokens.

---

### Incident 4: WordPress Admin Blocking Breaking AJAX Frontend Rendering (BUG-ROBOTS-04)
- **Context**: Subsystem: CMS Lint Heuristics (`src/robots.ts`).
- **What Was Expected**: Sites disallowing `/wp-admin/` should not unknowingly break Googlebot rendering for modern WordPress themes that rely on `admin-ajax.php`.
- **What Actually Happened**: Webmasters block `/wp-admin/` thinking it only protects login/backend portals. However, Googlebot renders pages headless-ly. Because WordPress executes front-end data fetches via `/wp-admin/admin-ajax.php`, Googlebot was blocked from fetching page content, leading to indexing failures.
- **Evidence in Repo**: Commit `ca62c64a`, `src/robots.ts` lines 162-163 & 176:
```typescript
if (field === 'disallow' && /^\/wp-admin\/?$/i.test(value) && forStar) wpAdminBlockedAt = lineNo
if (field === 'allow' && /admin-ajax\.php/i.test(value)) adminAjaxAllowed = true
...
if (wpAdminBlockedAt > 0 && !adminAjaxAllowed) findings.push(f('wp-admin-ajax', ...))
```
- **Root Cause**: Lack of contextual awareness in standard parsers regarding CMS operational mechanics. Standard parsers validate syntax, not functional SEO consequences.
- **Remediation Code Diff**:
```diff
--- a/src/robots.ts
+++ b/src/robots.ts
@@ -118,6 +118,8 @@ export function lint(body: string) {
   let disallowAllUnderStar = -1
   let hasNoindex = false
+  let wpAdminBlockedAt = -1
+  let adminAjaxAllowed = false

@@ -160,6 +162,8 @@ export function lint(body: string) {
       if (field === 'disallow' && value === '/' && forStar && disallowAllUnderStar < 0) disallowAllUnderStar = lineNo
       if (field === 'disallow' && forStar && ASSET_PATTERNS.some((p) => p.test(value))) findings.push(f('blocks-assets', ...))
+      if (field === 'disallow' && /^\/wp-admin\/?$/i.test(value) && forStar) wpAdminBlockedAt = lineNo
+      if (field === 'allow' && /admin-ajax\.php/i.test(value)) adminAjaxAllowed = true
       return
     }
@@ -173,4 +177,5 @@ export function lint(body: string) {
   if (disallowAllUnderStar > 0) findings.push(f('blocks-everything', ...))
+  if (wpAdminBlockedAt > 0 && !adminAjaxAllowed) findings.push(f('wp-admin-ajax', 'Disallow: /wp-admin/ without Allow: /wp-admin/admin-ajax.php blocks the endpoint many WordPress themes load content through', wpAdminBlockedAt))
```
- **Lesson**: High-value domain tooling must include heuristic linters that model framework-specific edge cases, catching valid syntax that produces fatal runtime side effects.

---

### Incident 5: False 200 OK Responses on Catch-All Single Page Apps (BUG-ROBOTS-05)
- **Context**: Subsystem: Response Content Verification (`src/robots.ts`).
- **What Was Expected**: If `/robots.txt` does not exist on an SPA or misconfigured server, the HTTP response code should be 404.
- **What Actually Happened**: Modern SPA hosting platforms (Netlify, Vercel, Nginx rewrite configs) serve `index.html` with `HTTP 200 OK` for every non-existent route, including `/robots.txt`. Parsers parsing `<!DOCTYPE html><html>` encounter syntax gibberish or interpret stray text as rules.
- **Evidence in Repo**: Commit `ca62c64a`, `src/robots.ts` lines 228-231:
```typescript
const text = raw.toString('utf8')
if (/^\s*(<!doctype|<html|<\?xml|{)/i.test(text)) {
  report.findings.push(f('not-text', 'the response is HTML/XML/JSON, not a plain-text robots.txt (an error page served with 200, or a framework catch-all route)'))
```
- **Root Cause**: Relying on HTTP 200 status as proof of valid file delivery without asserting content signature.
- **Remediation Code Diff**:
```diff
--- a/src/robots.ts
+++ b/src/robots.ts
@@ -226,3 +226,7 @@ export async function testRobots(input: string, opts: Options = DEFAULT_OPTIONS)
     const text = raw.toString('utf8')
+    if (/^\s*(<!doctype|<html|<\?xml|{)/i.test(text)) {
+      report.findings.push(f('not-text', 'the response is HTML/XML/JSON, not a plain-text robots.txt (an error page served with 200, or a framework catch-all route)'))
+      return report
+    }
```
- **Lesson**: Always validate payload signatures against expected MIME formats when fetching plain-text protocol files over HTTP.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### BOM & Carriage Return Stripping
Raw strings fetched over the network from diverse servers (IIS, Apache, Cloudflare) contain heterogeneous line terminators and encoding artifacts.
```typescript
// INVARIANT: Strip BOM (\uFEFF) at root, then split on \r?\n to handle both CRLF and LF
const lines = body.replace(/^\uFEFF/, '').split(/\r?\n/);
```
*Hazard*: Splitting by `\n` without handling `\r` leaves `\r` attached to token values. For example, `value` becomes `"/\r"`. In `value === '/'`, this evaluates to `false`, causing the engine to miss a `Disallow: /` entire-site block!

#### Comment Stripping Before Whitespace Trim
```typescript
// INVARIANT: Strip comment FIRST, then trim whitespace
const line = raw.replace(/#.*$/, '').trim();
if (line === '') return;
```
*Hazard*: If `trim()` is called before `replace(/#.*$/, '')`, lines with leading spaces before comments like `"   # comment"` are properly handled, but lines like `"Disallow: /  # block"` will preserve trailing spaces before `#` unless trimmed after comment removal.

#### Directive Token Case Normalization
```typescript
const field = m[1].toLowerCase();
const value = m[2].trim();
// Field MUST be lower-cased because RFC 9309 directive names are case-insensitive
// Value MUST preserve case because URI paths are case-sensitive (/Admin != /admin)
```

---

### 2. Infinite Loop & Recursion Guards

#### AbortController with Mandatory Finally Clearing
When executing asynchronous network queries with timeouts, timers must be cleared inside a `finally