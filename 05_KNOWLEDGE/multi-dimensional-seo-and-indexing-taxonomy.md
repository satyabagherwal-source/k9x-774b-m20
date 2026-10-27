# Multi-Dimensional SEO, Web Crawling & Indexation Failure Taxonomy

> **Scope**: Master architectural, algorithmic, and forensic reference for Technical SEO, Crawlability, Google Search Console (GSC) indexation triage, JavaScript rendering, Multilingual hreflang graphs, Core Web Vitals, and Server Infrastructure.  
> **Mandate**: Derived from real-world repository audits, production web crawler implementations, and Google Search Console indexation telemetry.  

---

## 1. The Anti-Superficiality Forensic Harvesting Standard

AI-Builder-Brain strictly prohibits superficial harvesting. No repository, library, or system may be considered "learned" based merely on its name, description, marketing claims, or README files.

### 1.1 Mandatory 6-Layer Codebase Inspection
Every repository harvested into the Brain MUST undergo a multi-layered code-level autopsy:
1. **Source Code Implementation Files**: Inspect concrete algorithms, AST parsers, regex tokenizers, stream buffers, and state managers.
2. **Test Suites & Fixtures**: Inspect test cases, edge cases, failure assertions, mock servers, and regression fixtures (the true source of truth for edge-case boundaries).
3. **Commit History & Diffs**: Inspect commit logs for bug fixes, performance bottlenecks, race condition resolutions, and architectural refactors.
4. **Closed Issues & Pull Requests**: Study defect autopsies, community bug reports, and root causes of production crashes.
5. **Runtime Configurations & Build Systems**: Audit `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `Dockerfile`, and CI/CD pipelines.
6. **Licensing & Compliance**: Verify intellectual property terms, copyleft boundaries, and enterprise safety.

---

## 2. Google Search Console Primary Indexation Failures (Telemetry Autopsy)

Based on live Google Search Console telemetry, websites suffer from distinct indexation roadblocks requiring systematic, evidence-based triage.

```
+--------------------------------------------------------------------------------------------------+
|                            GOOGLE SEARCH CONSOLE INDEXATION TRIAGE                               |
+--------------------------------------------------------------------------------------------------+
| FAILURE REASON                     | ROOT CAUSE ARCHITECTURE               | REMEDIATION PATTERN |
+------------------------------------+---------------------------------------+---------------------+
| Page with redirect (Failed)        | Redirect chain, trailing slash loop,  | Single-hop 301 to   |
|                                    | or non-canonical URL in XML sitemap   | terminal 200 canonical|
| Crawled - currently not indexed    | Thin content, boilerplate repetition, | Content enrichment, |
|                                    | near-duplicate pages, low value-add   | canonical consolidation|
| Discovered - currently not indexed | Crawl budget exhaustion, server load, | Internal link boost,|
|                                    | low internal PageRank, orphan URLs    | XML sitemap priority|
| Excluded by 'noindex' tag          | Intentional/accidental robots tag or  | Audit template meta |
|                                    | X-Robots-Tag header in production     | & HTTP headers      |
| Alternate page with proper canonical| Parameterized URL or duplicate        | Valid state; verify |
|                                    | consolidating into canonical          | canonical target 200|
| Not found (404) & Soft 404         | Broken links, deleted products,       | Restore page or 301 |
|                                    | blank pages returning HTTP 200        | to closest parent   |
| Server error (5xx)                 | Unhandled runtime exception, database | Patch SSR route, add|
|                                    | timeout, memory limit exhaustion      | circuit breaker     |
+--------------------------------------------------------------------------------------------------+
```

### 2.1 "Page with redirect" (Failed Validation: 443+ Pages)
- **Root Cause**:
  1. Internal links across navigation or body content link to the old or un-normalized URL (e.g. `http://`, missing trailing slash `/blog`, or non-canonical subdomain `www.example.com`).
  2. The XML sitemap includes URLs that issue a 301/302 redirect rather than the final destination URL.
  3. Multi-hop redirect chains (A -> B -> C -> D) exhaust Googlebot's redirect limit (Googlebot typically abandons chains > 5 hops).
- **Forensic Verification**:
  ```bash
  curl -sSIL https://example.com/path | grep -E '^HTTP|^Location:'
  ```
- **Remediation Protocol**:
  - Audit all internal templates and replace redirecting links with the terminal 200 OK canonical URL.
  - Sitemaps must contain ONLY URLs that return HTTP 200 OK directly in a single hop.
  - Implement Nginx/Caddy edge normalization to resolve protocol (HTTPS), host (non-WWW), and path (trailing slash) in exactly ONE redirect hop.

### 2.2 "Crawled - currently not indexed" (Forensic Multi-Cohort Triage)
- **Diagnostic Invariant (Rule 81)**:
  Never assume that URLs sharing this status share a single root cause. Live forensics on large properties reveal that "Crawled - currently not indexed" is typically a heterogeneous blend of three distinct engineering cohorts:
  1. **Intentional Architectural Exclusions**: Multilingual legal, utility, or policy pages (e.g. `/de/terms/`, `/es/privacy/`) carrying explicit `<meta name="robots" content="noindex, follow">` and excluded from XML sitemaps to prevent algorithmic thin-content penalties across auto-translated boilerplate. Excluded state is healthy and intended.
  2. **Architectural Normalization Redirects**: Slashless URL variants (e.g. `/de`, `/practice`) returning HTTP 308 permanent redirects to terminal canonical targets.
  3. **Historical Quality Demotion Crawl Lag**: Legitimate canonical pages that previously suffered from technical defects (missing titles, duplicate H1s, DOM bloat) during a historical crawl (e.g. during a Google Core/Spam update), but where Googlebot has not yet recrawled the site since the deployment of production corrections.
  4. **Genuine Thin / Near-Duplicate Content**: Pages with under 300 unique words, raw machine-translated shells lacking interactive depth, or excessive parameter variations.
- **Remediation Protocol**:
  - Disaggregate the cohort before applying changes: separate intentional noindex pages, redirects, and canonical tools.
  - Audit crawl timestamp provenance (`Last crawl`) against production deployment dates: if last crawl predates the fix, do not rewrite content; verify edge readiness and request recrawl via sitemap ping or inspection quota batches.
  - For legitimate thin content: consolidate near-duplicates (> 80% similarity) via `<link rel="canonical">` or enrich with scholastic editorial content and interactive functionality.


### 2.3 "Discovered - currently not indexed" (229+ Pages)
- **Root Cause**:
  Googlebot knows the URL exists (discovered via XML sitemap, RSS feed, or an incoming link), but has **not yet scheduled or executed a crawl**.
  1. **Crawl Budget Exhaustion**: The website has thousands of low-value, duplicate, or parameter-heavy URLs that overwhelm the site's assigned Googlebot crawl capacity.
  2. **Server Overload / Slow TTFB**: Server response time > 800ms causes Googlebot to dynamically throttle crawl speed to avoid crashing the host.
  3. **Weak Internal Linking (Deep Click Depth / Orphan)**: The URL is buried 4+ clicks away from the homepage and has low internal PageRank.
- **Remediation Protocol**:
  - Reduce site bloat: block crawl of faceted parameters in `robots.txt` (`Disallow: /*?filter=*`).
  - Improve Time to First Byte (TTFB < 200ms) via edge caching (Cloudflare, Fastly) and server query optimization.
  - Build prominent editorial internal links from high-authority pages (homepage, category hubs) to priority unindexed pages.

### 2.4 "Excluded by 'noindex' tag"
- **Root Cause**:
  The page contains a `<meta name="robots" content="noindex">` tag in HTML, or returns an `X-Robots-Tag: noindex` HTTP header.
- **Triage**:
  - If intentional (e.g., admin pages, checkout, thank-you pages, internal search), this is healthy.
  - If accidental (e.g., staging environment meta tag leaked into production build, or dynamic CMS indexing checkbox toggled off), remove the directive and submit URL inspection re-crawl in GSC.

### 2.5 "Alternate page with proper canonical tag"
- **Root Cause**:
  Google recognized that this page is an alternate version (e.g., with query parameters `?utm_source=...` or AMP version) and successfully consolidated indexing equity into the user-declared canonical URL.
- **Triage**:
  This is normal and expected for duplicate/parameterized URLs, provided the canonical URL itself is indexed and returns HTTP 200 OK.

### 2.6 "Not found (404)" and "Soft 404"
- **Root Cause**:
  - **Hard 404**: Page was deleted, URL changed without a redirect, or an internal link has a typo.
  - **Soft 404**: The server returns an HTTP 200 OK status, but the page content is essentially empty, says "Product Not Found", or displays an empty search result. Googlebot classifies this as an untrusted Soft 404.
- **Remediation Protocol**:
  - Never return HTTP 200 for empty or missing content; always return genuine HTTP 404 or 410 Gone.
  - If a deleted page has substantial historical backlinks, issue a 301 redirect to the closest relevant live parent category.

### 2.7 "Server error (5xx)"
- **Root Cause**:
  HTTP 500, 502, 503, or 504 errors triggered when Googlebot crawled the page (unhandled database connection exception, PHP fatal error, Node.js memory limit, or SSR timeout).
- **Remediation Protocol**:
  Inspect server error logs, implement robust fallback error boundaries in SSR templates, and ensure 503 Service Unavailable carries a `Retry-After` header during maintenance.

---

## 3. The 100+ Multi-Dimensional SEO & Architectural Failure Taxonomy

---

### Dimension 1: Server, Protocol & Transport Infrastructure

| Failure Code | Root Cause | Detection Tool / Method | Concrete Code Remediation |
|---|---|---|---|
| **HTTP 500 Internal Error** | Unhandled exception in application runtime or SSR route | Server logs / curl status check | Wrap route execution in structured try/catch; render graceful fallback UI |
| **HTTP 502 Bad Gateway** | Upstream app server (Node/PHP-FPM) crashed or down behind reverse proxy (Nginx) | Nginx `error.log` / systemctl status | Ensure process supervisors (PM2, systemd) auto-restart crashed workers |
| **HTTP 503 Service Unavailable** | Server capacity overloaded or temporary downtime | HTTP status response | Return `Retry-After: 3600` header so Googlebot returns later without de-indexing |
| **HTTP 504 Gateway Timeout** | Backend database or microservice took longer than proxy timeout (e.g. 60s) | Nginx proxy timeout log | Add query indexing, paginate database lookups, implement Redis caching |
| **Host Unreachable / Connection Timeout** | Network firewall, routing outage, or DNS failure | `socket.timeout` / ping / traceroute | Audit cloud VPC route tables, security group ingress rules, CDN upstream IPs |
| **DNS Resolution Failure / Timeout** | Misconfigured authoritative nameservers, expired domain | `dig +trace`, `socket.gaierror` | Verify NS records across registrar; ensure redundant Anycast DNS (Cloudflare/Route53) |
| **SSL/TLS Certificate Invalid** | Expired cert, hostname mismatch, untrusted CA | `openssl s_client -connect host:443` | Deploy automated Let's Encrypt / Certbot renewal daemon; monitor expiry |
| **HTTPS Mixed Content Error** | HTTPS page requesting insecure HTTP assets (images, scripts) | Browser devtools / DOM parser | Enforce `Content-Security-Policy: upgrade-insecure-requests` |
| **HTTP to HTTPS Migration Error** | Incomplete migration where HTTP URLs loop or canonicals point to HTTP | Crawler graph redirect trace | Implement HSTS (`Strict-Transport-Security: max-age=31536000; includeSubDomains`) |

---

### Dimension 2: Canonicalization & URL Hygiene

| Failure Code | Root Cause | Detection Tool / Method | Concrete Code Remediation |
|---|---|---|---|
| **Canonical Loop (A -> B -> A)** | URL A canonicalizes to B, but URL B canonicalizes to A | Relational graph join | Every canonical page must be strictly self-referential: canonical points to own absolute URL |
| **Canonical Pointing to 404** | Canonical href targets a non-existent or deleted URL | Crawler HTTP status sweep | Ensure canonical generator dynamically resolves only verified 200 OK paths |
| **Canonical Pointing to Redirect** | Canonical href targets a URL that issues a 301/302 redirect | Redirect chain audit | Follow redirect to terminal URL; update canonical tag to terminal 200 URL |
| **Duplicate Without User Canonical** | URL has query parameters or alternate paths with no canonical tag | Page-level check | Always declare `<link rel="canonical" href="https://...">` in `<head>` |
| **Google Chose Different Canonical** | User declared canonical, but Google chose another due to conflicting internal links | GSC URL Inspection API | Align 100% of internal links, XML sitemaps, and hreflang tags to user canonical |
| **Trailing Slash Inconsistency** | `/product` and `/product/` both return 200 OK without redirect | Crawler duplicate check | Choose one standard; issue 301 redirect for the non-standard variation |
| **Non-WWW vs WWW Conflict** | Both `example.com` and `www.example.com` serve independent content | Curl host header check | Enforce 301 redirect at Nginx/Caddy edge to canonical host variant |
| **Capitalization URL Duplication** | `/About` and `/about` served as distinct pages on case-insensitive filesystems | Regex / URL normalizer | Lowercase all incoming URL paths at server edge via rewrite rules |
| **Subdomain vs Root Domain Confusion** | Staging subdomain (`staging.example.com`) publicly indexable | Robots.txt / DNS query | Apply HTTP Basic Auth or `X-Robots-Tag: noindex` on all non-production subdomains |

---

### Dimension 3: Redirect Architecture & Crawl Budget

| Failure Code | Root Cause | Detection Tool / Method | Concrete Code Remediation |
|---|---|---|---|
| **Redirect Chain Error (A->B->C)** | Link passes through multiple redirect hops before resolving | Crawler redirect history | Flatten redirects: point source link directly at terminal destination C |
| **Infinite Redirect Loop (A->B->A)** | Misconfigured server rewrite rules or routing logic | `curl -sSIL --max-redirs 10` | Audit `.htaccess` / `nginx.conf` rewrite conditions; break circular matches |
| **Broken Redirect (301 -> 404)** | Redirected URL points to a dead destination | Crawler status report | Update redirect target to an active, relevant 200 OK replacement page |
| **Meta Refresh Redirect** | Using `<meta http-equiv="refresh" content="0;url=...">` | HTML parser check | Eliminate meta refresh; implement standard server-side HTTP 301 redirect |
| **Crawl Budget Exhaustion** | Search bots waste request quota crawling low-value infinite paths | GSC Crawl Stats report | Disallow query parameters in `robots.txt`; consolidate URLs; cache responses |
| **Crawl Capacity Exceeded** | Web server responses slow down under bot crawl, causing Google to throttle | Server CPU/RAM & TTFB | Scale web workers, optimize database queries, deploy Redis page cache |
| **Instant Indexing API Error** | Indexing API requests fail due to quota limits or invalid service credentials | API error response (403/429) | Handle exponential backoff; restrict Indexing API to JobPosting and BroadcastEvent |

---

### Dimension 4: Link Graph, Site Architecture & Dynamic URLs

| Failure Code | Root Cause | Detection Tool / Method | Concrete Code Remediation |
|---|---|---|---|
| **Orphan Page (No Internal Links)** | Page exists in sitemap or database but has zero incoming internal links | Relational SQL in-degree join | Add contextual internal links from relevant parent categories and blog hubs |
| **Broken Internal Anchor Links** | Link points to non-existent section fragment (`#nonexistent`) | DOM element ID validator | Validate that target `id` or `name` attribute exists on the destination page |
| **Dynamic Infinite URLs** | Calendar widgets or filter combinators generate endless URL variations | Crawler depth monitor | Set `rel="nofollow"` on calendar advance links; add `robots.txt` Disallow pattern |
| **Session ID URL Duplication** | Web framework appends `?PHPSESSID=...` or `?sid=...` to links | URL regex check | Disable URL-based sessions; store session tokens strictly in HTTP-only cookies |
| **Tracking Parameter Indexing Loop** | Ad tracking tags (`?utm_source`, `?fbclid`) indexed as unique pages | URL pattern analysis | Strip marketing parameters before canonical generation; declare parameter handling |
| **URL Too Long (> 2048 chars)** | Excessively nested folders or appended query strings exceed URI limit | URL length check | Re-architect routing structure; enforce clean, hierarchical slugs |
| **Invalid Characters in URL** | Raw spaces, control characters, or unencoded symbols in URL | RFC 3986 URL validator | URL-encode path components; slugify dynamic titles to ASCII kebab-case |

---

### Dimension 5: JavaScript Rendering & Hydration Diffs

| Failure Code | Root Cause | Detection Tool / Method | Concrete Code Remediation |
|---|---|---|---|
| **JavaScript Rendering Timeout** | Client-side bundle execution exceeds Googlebot render deadline (~5s) | Headless browser timeout | Implement Server-Side Rendering (SSR) or Static Site Generation (SSG) |
| **Render-Blocking Resources** | Synchronous heavy CSS/JS files block HTML parser from discovering content | Lighthouse audit | Defer non-critical scripts (`defer` / `async`); inline critical CSS |
| **DOM vs Raw HTML Discrepancy** | Links or metadata exist only in hydrated DOM and not in initial HTML response | Dual-pass parser diff | Ensure primary navigation links and core metadata are in raw SSR HTML |
| **Client-Only Navigation** | Routing done entirely via `window.history.pushState` without `<a href>` | AST / DOM audit | Always use semantic `<a href="/path">` elements for all navigational components |

---

### Dimension 6: Multilingual & International SEO (Hreflang)

| Failure Code | Root Cause | Detection Tool / Method | Concrete Code Remediation |
|---|---|---|---|
| **Missing Language Tags** | Multi-regional site lacks ISO 639-1 / ISO 3166-1 language declarations | HTML parser check | Declare `<html lang="en-US">` on every document |
| **Missing Reciprocal Return Link** | Page A links to Page B as Spanish alternate, but Page B does not link back to A | Relational SQL self-join | Enforce bidirectional reciprocity in hreflang generation pipeline |
| **Conflicting Hreflang Tags** | Multiple conflicting URLs claim the same language/region code | Hreflang registry check | Ensure exactly one URL is assigned per `hreflang` code per page cluster |
| **Hreflang to Non-Canonical URL** | Hreflang alternate points to a URL that redirects or declares a different canonical | Multi-page audit query | Hreflang destinations MUST be self-canonical, 200 OK indexable URLs |
| **Wrong Locale Targeting** | Using invalid language or region codes (e.g. `en-UK` instead of `en-GB`) | ISO code validator | Validate codes against official BCP 47 language registry |
| **Content Language Mismatch** | Page tagged as `fr-FR` but containing English text | NLP language detection | Ensure localized template strings match declared hreflang locale |

---

### Dimension 7: XML Sitemaps

| Failure Code | Root Cause | Detection Tool / Method | Concrete Code Remediation |
|---|---|---|---|
| **Missing XML Sitemap** | Website has no sitemap index declared at `/sitemap.xml` | HTTP HEAD request | Generate automated XML sitemaps during build or CMS publication |
| **Broken Sitemap URL (404/500)** | Sitemap URL declared in `robots.txt` returns an error | HTTP status audit | Fix sitemap generator route; verify XML syntax with XML parser |
| **Sitemap Not Readable** | Corrupted XML formatting, unclosed tags, or invalid encoding | XML parser validation | Use strict XML serializer; validate against W3C Sitemap 0.9 schema |
| **Non-Canonical URLs in Sitemap** | Sitemap lists redirected, canonicalized, or `noindex` URLs | Sitemap cross-check | Sitemaps MUST contain exclusively 200 OK, indexable, canonical URLs |
| **Sitemap File Too Large** | Sitemap exceeds 50,000 URLs or 50MB uncompressed limit | File size / entry counter | Split into multiple sitemaps under an XML `<sitemapindex>` |

---

### Dimension 8: Content Quality & Algorithmic Filters

| Failure Code | Root Cause | Detection Tool / Method | Concrete Code Remediation |
|---|---|---|---|
| **Thin Content (< 300 words)** | Empty pages or pages dominated by boilerplate UI elements | MinHash / word count | Consolidate or expand with substantive domain-specific copy |
| **Low Quality Content Rejection** | Machine-generated spam or shallow regurgitation rejected by Google | Helpful Content Classifier | Ensure genuine value-add, original research, and first-party insights |
| **Keyword Stuffing Penalty** | Repeating search queries unnaturally across headings and body | N-gram token frequency | Maintain natural keyword distribution; use semantic synonyms |
| **Scraped / Plagiarized Content** | Duplicating content verbatim from third-party sites | Text similarity / Copyscape | Publish original editorial content; cite and attribute quotes |
| **Doorway / Gateway Pages** | Creating hundreds of city-specific pages with identical filler text | Jaccard similarity audit | Eliminate programmatic doorway pages; build genuine localized landing hubs |
| **Affiliate Link Cloaking** | Deceptive redirects disguising affiliate links as editorial content | Link destination inspection | Mark commercial affiliate links with `rel="sponsored"` |
| **Hidden Text / Cloaking** | Serving different content to search bots than to users | Bot vs User-Agent diff | Eliminate cloaking; serve identical DOM and text to all user-agents |

---

### Dimension 9: Mobile & Core Web Vitals (CWV)

| Failure Code | Root Cause | Detection Tool / Method | Concrete Code Remediation |
|---|---|---|---|
| **Mobile-Unfriendly Page** | Missing `<meta name="viewport">` causing desktop rendering on mobile | HTML parser check | Add `<meta name="viewport" content="width=device-width, initial-scale=1">` |
| **Content Wider Than Screen** | Fixed-width containers (`width: 1200px`) causing horizontal scroll | Headless browser layout | Use responsive CSS: `max-width: 100%; box-sizing: border-box;` |
| **Clickable Elements Too Close** | Touch targets smaller than 48x48px or spaced closer than 8px | Axe / Lighthouse audit | Enforce `min-height: 48px; min-width: 48px; margin: 8px;` for touch targets |
| **Text Too Small to Read** | Font size < 12px on mobile viewports | CSS font-size audit | Set root font size to minimum 16px for body text |
| **Poor LCP (Largest Contentful Paint)** | Hero image unoptimized, un-preloaded, or loaded after heavy JS | Lighthouse / PSI audit | Preload hero image: `<link rel="preload" as="image" href="...">`; use WebP/AVIF |
| **High CLS (Cumulative Layout Shift)** | Images and ad slots missing explicit width/height dimensions | Layout shift recorder | Always declare explicit `width` and `height` attributes on `<img>` and containers |
| **Poor INP (Interaction to Next Paint)** | Long JavaScript tasks (> 50ms) blocking the main thread | Chrome DevTools Performance | Break long tasks via `scheduler.yield()` or Web Workers; debounce event handlers |

---

### Dimension 10: Structured Data & Schema Markup

| Failure Code | Root Cause | Detection Tool / Method | Concrete Code Remediation |
|---|---|---|---|
| **Missing Structured Data** | Key informational or product page declares zero JSON-LD schema | DOM schema parser | Embed relevant schema (`Article`, `Product`, `FAQPage`, `Organization`) |
| **Invalid Schema Markup** | Missing mandatory properties (e.g. `offers` or `price` on `Product`) | Google Rich Results Test | Validate JSON-LD against Schema.org specification for declared @type |
| **Structured Data Parsing Error** | Syntax error in JSON (trailing commas, unescaped quotes) | `JSON.parse()` validator | Generate JSON-LD via type-safe serializers (`JSON.stringify`) |
| **Invisible Markup Violation** | Marking up ratings or reviews not visible to users on the page | Manual inspection | Never declare schema properties for content not visible in the DOM |

---

### Dimension 11: Media & Asset Optimization

| Failure Code | Root Cause | Detection Tool / Method | Concrete Code Remediation |
|---|---|---|---|
| **Non-Indexable Image Format** | Using legacy uncompressed formats (TIFF, BMP) or unsupported codecs | Image header inspection | Convert assets to modern formats: WebP, AVIF, SVG, PNG, JPEG |
| **Broken Image URLs (404)** | `<img src>` points to non-existent image asset | Headless asset check | Verify asset build pipeline; ensure uploaded assets persist on CDN |
| **Missing Alt Text** | `<img>` element completely lacks `alt` attribute | HTML parser check | Provide descriptive, keyword-relevant alt text for informational images |
| **Whitespace-Only Alt Text** | Alt attribute contains only spaces (`alt="   "`) | Regex `alt.trim() === ""` | Eliminate empty whitespace; use `alt=""` ONLY for decorative images |
| **Uncompressed Heavy Media** | Multi-megabyte images served directly to mobile users | Asset byte size audit | Implement responsive `srcset` with automated image resizing and compression |
| **Screenshot Filename Anti-Pattern** | Uploading default screenshot names (`Screen Shot 2026-...`) | Regex filename audit | Rename images with descriptive, hyphen-separated keywords before upload |

---

### Dimension 12: Access Control, Firewalls & Bot Directives

| Failure Code | Root Cause | Detection Tool / Method | Concrete Code Remediation |
|---|---|---|---|
| **Robots.txt Syntax Error** | Typo in directives (e.g. `Dissallow:` or missing `User-agent:`) | Robots parser validator | Validate `robots.txt` against Google's open-source robots parser specification |
| **Disallow Slash Error** | `Disallow: /` placed under `User-agent: *`, blocking entire site | Robots check | Reserve `Disallow: /` strictly for staging domains; permit public assets |
| **Firewall Blocking Googlebot** | WAF (Cloudflare, AWS WAF) blocks Googlebot IP ranges as malicious | WAF block logs | Whitelist official verified Googlebot ASN (AS15169) and reverse DNS (`.googlebot.com`) |
| **Country-Based IP Blocking** | Blocking United States IPs where Googlebot crawling servers originate | GeoIP middleware audit | Ensure Googlebot crawler user-agents and IP blocks are exempt from geo-fencing |
| **Login / Paywall Barrier** | Important content hidden behind login without structured paywall markup | HTTP response code / DOM | Use Schema.org `isAccessibleForFree: false` and `hasPart` for paywalled journalism |
| **Cloudflare Challenge Barrier** | "Under Attack Mode" or aggressive CAPTCHAs presenting bot wall | Bot detection check | Configure Cloudflare firewall rule to bypass managed challenges for verified search bots |

---

### Dimension 13: CMS & Server Backend Health

| Failure Code | Root Cause | Detection Tool / Method | Concrete Code Remediation |
|---|---|---|---|
| **Bad .htaccess Configuration** | Malformed Apache rewrite rules causing 500 internal server errors | Apache error log | Validate `.htaccess` syntax; test rewrite rules with `apache2ctl configtest` |
| **Nginx Misconfiguration** | Missing `try_files $uri $uri/ /index.php?$args;` causing 404s on subpages | Nginx error log | Configure proper front-controller fallback for Single Page / CMS routing |
| **Database Connection Failure** | MySQL / Postgres pool exhausted during high-traffic crawler sweeps | DB connection logs | Tune database connection pool size (`max_connections`); enable connection pooling |
| **Max Execution Time Exceeded** | Slow PHP / Node execution exceeding script limit (e.g. 30s) | Process logs | Optimize slow DB queries; move heavy computations to background queues |
| **Memory Limit Exhausted** | PHP `memory_limit` (e.g. 128M) hit while building large category pages | OOM crash log | Increase worker memory limit; implement cursor-based pagination and streaming |
| **WordPress Permalink Crash** | Flush rewrite rules failure causing 404s on all post permalinks | URL response check | Re-save permalinks in WordPress admin; verify `wp_rewrite` options in database |
| **Security Plugin Over-Blocking** | Wordfence/iThemes blocking Googlebot due to high crawl request rates | Security plugin audit | Adjust rate-limiting thresholds in security plugins for search engine user-agents |

---

### Dimension 14: Security, Spam & Legal Removals

| Failure Code | Root Cause | Detection Tool / Method | Concrete Code Remediation |
|---|---|---|---|
| **Manual Action Penalty** | Human reviewer at Google issued penalty for unnatural links or spam | GSC Manual Actions panel | Conduct disavow review, remove paid/spam links, submit reconsideration request |
| **Pure Spam Penalty** | Site detected as automated content farm or scraped affiliate clone | GSC Security & Manual | Overhaul site entirely: delete scraped material, publish genuine original content |
| **Hacked Site Malware Warning** | Malicious injection or pharma hack discovered by Google Safe Browsing | Safe Browsing API / GSC | Clean infected files, update core CMS/plugins, patch SQLi/XSS vulnerabilities |
| **Phishing Content Block** | Site falsely hosting credential harvesting or phishing forms | Threat intelligence feeds | Remove phishing scripts immediately; request Safe Browsing review |
| **DMCA Takedown Removal** | Copyright holder filed formal DMCA notice with Google | Lumen Database / GSC | Remove infringing content or file DMCA counter-notice if legitimately owned |
| **Negative SEO Attack** | Competitor blasts millions of toxic casino/adult backlinks at site | Backlink monitoring (Ahrefs) | Build Google Disavow file (`disavow.txt`) and submit via GSC Disavow Tool |
| **AMP Validation Error** | Mobile AMP page contains disallowed tags or custom scripts | AMP validator check | Replace non-AMP components with valid `amp-img`, `amp-iframe` components |
