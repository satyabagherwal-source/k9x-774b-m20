# Online Free Protractor — Engineering & SEO Forensic Learnings

## Incident 1: Edge CDN Consecutive Slash Normalization Infinite Loop in `_redirects`

### 1. Context & Architecture
- **Domain**: `onlinefreeprotractor.com`
- **Hosting Engine**: Cloudflare Pages with Astro 5 (`trailingSlash: 'always'`).
- **Symptom**: Spanish Screen Ruler (`https://onlinefreeprotractor.com/es/ruler/`) collapsed in search rankings and failed in Google Search Console with redirect errors / `ERR_TOO_MANY_REDIRECTS`.

### 2. Empirical Root Cause
- In a previous commit attempting to eliminate 404s/double slashes from GSC logs, the following line was added to `public/_redirects`:
  ```text
  /es/ruler// /es/ruler/ 301
  ```
- **CDN Behavior Gotcha**: Cloudflare Pages normalizes redundant consecutive slashes in the URL path *prior* to evaluating the pattern matching engine for `_redirects`.
- Consequently, `/es/ruler//` collapsed to `/es/ruler/` during pattern matching.
- Any request to the valid, canonical URL `/es/ruler/` matched the rule and received an `HTTP 301 Moved Permanently` to `/es/ruler/`, inducing an unbreakable, infinite redirect loop (`301 -> /es/ruler/ -> 301 -> /es/ruler/`).

### 3. The Resolution
- Removed the manual `/es/ruler// /es/ruler/ 301` entry from `public/_redirects`.
- Deployed update to Cloudflare Pages.
- Live probe confirmed immediate restoration: HTTP 200 OK, full rendered HTML (430 KB), self-referencing canonical tag (`https://onlinefreeprotractor.com/es/ruler/`), single `<h1>`, 55 hreflang annotations, and valid `index, follow` robots directives.

### 4. Universal Engineering Invariant
> **Edge Rule Isolation Invariant**: Never add self-referential or redundant-slash path rules (e.g. `/path// /path/ 301`) into static `_redirects` files on CDNs that normalize incoming URI paths. Edge CDN normalization belongs exclusively in CDN Transform/Normalization Rules or edge middleware, not static redirect mapping tables.

## Incident 2: "Crawled - Currently Not Indexed" Root Cause & Historical Crawl Lag

### 1. Context & Dataset
- **Metric**: Exactly 291 URLs flagged by Google Search Console under *Page Indexing > "Crawled - currently not indexed"*.
- **Empirical CSV Accounting**:
  - 117 URLs (40.2%): Multilingual Legal Pages (`/[lang]/about/`, `contact`, `privacy`, `terms`).
  - 21 URLs (7.2%): Slash-less request variations (`/lt`, `/da/compass`, `/practice`).
  - 3 URLs (1.0%): English legal pages (`/about/`, `/privacy/`, `/terms/`).
  - 150 URLs (51.5%): Legitimate interactive tools (Screen Ruler, Compass, Image Protractor, Practice Angles) and language roots.

### 2. Empirical Root Cause
- The 150 valid tools were crawled by Googlebot between **September 25 and October 8, 2026**, directly during the rollout of Google's September 2026 Spam Update.
- At that time, the production application suffered from structural defects:
  1. Missing `<title>` tags across all pages (only `og:title` rendered).
  2. Missing `<meta name="description">` tags.
  3. Duplicate H1 elements (`#print-report-title`).
  4. 796 KB DOM size (10,000+ DOM nodes) from statically duplicated calibration presets.
- When Googlebot re-evaluated the site, it rejected these bloated, title-less pages and dropped them into "Crawled - currently not indexed".
- 24 of these unindexed URLs were in the site's **Top 50 Traffic Pages in September**, accounting for **5,121 impressions and ~120 clicks** (including `/ruler/` with 1,501 impressions and `/ru/ruler/` with 590 impressions).

### 3. Verification & Resolution
- Current live production code has been verified 100% clean across all 150 pages: HTTP 200 OK, localized titles, meta descriptions, single H1, self-canonicals, 55 hreflang tags, ~400 KB payload.
- Multilingual legal pages carry `noindex, follow` and are excluded from `sitemap-0.xml` to prevent quality dilution.
- Re-indexing Wave 1 prioritized for top impression drivers via Google Search Console URL Inspection.

## Incident 3: Verified Bulk SEO Recovery & Automated Regression Framework

### 1. Architecture & Protocol
- Master inventory of 598 unique URLs audited live against Cloudflare edge.
- Automated classification across 10 deterministic categories:
  - 212 `INTENTIONAL_NOINDEX_LEGAL` (53 languages × 4 legal pages)
  - 175 `HEALTHY_INDEXABLE`
  - 153 `CRAWLED_NOT_INDEXED_TOOL`
  - 58 `EXPECTED_REDIRECT` (308 slash-less + 301 legacy redirects)
  - 0 broken redirects, 0 loops, 0 404s, 0 5xx, 0 canonical conflicts.
- Automated regression suite added to `package.json`: `npm run test:seo` (26 automated assertions testing templates, RTL, multi-scripts, sitemap integrity, and redirect rules).


