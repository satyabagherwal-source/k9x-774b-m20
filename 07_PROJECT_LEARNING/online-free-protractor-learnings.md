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
- Automated regression suite added to `package.json`: `npm run test:seo` (30 automated assertions testing templates, RTL, multi-scripts, sitemap integrity, and redirect rules).

## Incident 4: Cloudflare Pages `pages.dev` Noindex Isolation Protocol

### 1. Invariant & Architecture
- Edge headers file (`public/_headers`) specifies `https://:project.pages.dev/*` and `https://:version.:project.pages.dev/*` with `X-Robots-Tag: noindex, nofollow`.
- Verified strictly scoped: Custom domain (`onlinefreeprotractor.com`) receives NO `X-Robots-Tag` header and preserves `index, follow` on all 328 indexable sitemap pages.
- Canonical tag defense: `computedCanonical` in `Layout.astro` hardcodes `https://onlinefreeprotractor.com`, preventing duplicate indexation even if a crawler traverses `pages.dev`.
- Automated regression test added to `npm run test:seo` to guarantee preview isolation without accidental production leakage.

## Incident 5: Master 1,031-URL Inventory Partitioning & Discrepancy Reconciliation

### 1. Context & Discrepancy Reconciliation
- During forensic analysis of historical Google Search Console (GSC) exports, the team was presented with conflicting URL counts:
  - GSC UI reported 443 pages with redirects, while the export file contained 451 URLs.
  - GSC reported 214 excluded by noindex, while previous reports assumed 212.
- **Root Cause & Reconciliation**:
  1. *Redirect Export Discrepancy*: Row-level deduplication of all 451 raw export rows revealed 8 duplicate occurrences caused by URL-encoding variations and transient tracking parameters. Exactly 443 unique URL targets existed, reconciling GSC summary and raw export with 100% mathematical precision.
  2. *Noindex Discrepancy*: Exactly 212 URLs corresponded to multilingual legal pages (53 languages × 4 legal pages: `/about/`, `/contact/`, `/privacy/`, `/terms/`). The remaining 2 URLs were the static error templates (`/404/` and `/500/`), which carry `noindex, nofollow` to prevent search engine indexing of error states. Total: 214 noindex pages.
- **Master Partition (1,031 Total URLs)**:
  - **328 Eligible Indexable Canonicals**: 10 Core English tool/root pages + 318 localized tool pages across 53 languages.
  - **216 Intentionally Excluded Non-Indexable Pages**: 212 multilingual legal pages + 2 static error templates (`/404/`, `/500/`) + 2 Cloudflare Pages staging preview URLs (`pages.dev`).
  - **487 Redirect Routes**: 451 legacy query/protocol/slash variations + 21 legacy 404 routes redirected to relevant tools + 15 trailing slash normalization routes.

### 2. Universal Engineering Invariant
> **Exhaustive Inventory Invariant**: Never discard unexplained rows or discrepancies between UI summaries and CSV exports. Reconcile row counts down to exact parameter or normalization artifacts to prevent silent masking of genuine technical defects.

---

## Incident 6: Strict Separation of Technical HTTP 200 Readiness vs Google Indexing Evidence

### 1. Context & Pitfall
- Previous audit reports conflated a page returning `HTTP 200 OK` (with valid canonical, title, description, and hreflang) with being "Indexed" by Google.
- Furthermore, when an indexing request was submitted in GSC UI and returned "Indexing requested", some workflows erroneously marked the URL status as `INDEXED_CONFIRMED`.
- In reality, Google's processing pipeline is asynchronous:
  1. *Technical 200 OK* only proves edge web-server readiness.
  2. *Indexing Requested* only proves receipt of request into Google's crawl scheduler queue.
  3. *Indexed Confirmed* requires empirical SERP proof (`site:URL`) or Google Search Console API / Performance export verification.

### 2. Remediation & Status Taxonomy
- Standardized status classification across all indexing tools:
  - `INDEXED_CONFIRMED`: Verified via live Google search result or GSC URL inspection confirmed indexed.
  - `INDEXING_REQUEST_ACCEPTED`: Request successfully submitted in GSC UI; queued for Googlebot recrawl.
  - `NOT_INDEXED`: Eligible canonical page awaiting crawl/submission.
  - `UNKNOWN`: Uninspected or awaiting fresh data.
  - `INTENTIONALLY_NOINDEX`: Non-canonical, legal, or error page marked `noindex` and excluded from sitemap.
  - `VALID_REDIRECT`: Historical route terminating at canonical target via 301/308.

---

## Incident 7: Programmatic XML Sitemap Overhaul & Zero-Error Canonical Purity

### 1. Empirical Defect
- Default `@astrojs/sitemap` integration generated an unstructured flat list containing non-indexable routes, error pages (`/404/`, `/500/`), and translated legal pages marked `noindex`.
- When Googlebot fetched the sitemap, it raised critical GSC coverage errors: *"Submitted URL marked noindex"*.
- Furthermore, the sitemap lacked explicit `<lastmod>`, `<changefreq>`, and `<priority>` attributes, depriving search engines of freshness and crawl priority cues.

### 2. Architectural Resolution
- Re-architected `astro.config.mjs` with custom programmatic filtering and serializer:
  ```javascript
  sitemap({
    filter: (page) => {
      // Exclude static error pages
      if (page.includes('/404') || page.includes('/500')) return false;
      // Exclude multilingual legal pages marked noindex
      const legalSlugs = ['about', 'contact', 'privacy', 'terms'];
      return !legalSlugs.some(slug => page.includes(`/${slug}/`));
    },
    serialize: (item) => {
      const url = item.url;
      item.lastmod = '2026-10-17';
      if (url === 'https://onlinefreeprotractor.com/') {
        item.changefreq = 'daily';
        item.priority = 1.0;
      } else if (url.split('/').filter(Boolean).length === 2 && !url.match(/\/[a-z]{2}\//)) {
        item.changefreq = 'weekly';
        item.priority = 0.9;
      } else if (url.includes('/ruler/') || url.includes('/protractor/')) {
        item.changefreq = 'weekly';
        item.priority = 0.8;
      } else {
        item.changefreq = 'monthly';
        item.priority = 0.7;
      }
      return item;
    }
  })
  ```
- Result:
  - Exactly 328 URLs generated in `sitemap-0.xml` and referenced by `sitemap-index.xml`.
  - Zero duplicate URLs.
  - Zero redirected routes (301/308).
  - Zero noindex pages.
  - 100% of URLs verified returning `HTTP 200 OK` on production edge.

---

## Incident 8: Search Console Daily Quota Governance & Tiered Submission Strategy

### 1. Empirical Discovery & Quota Constraints
- Testing the Google Indexing API revealed that it is strictly restricted by Google policy to `JobPosting` and `BroadcastEvent` structured data. Standard content websites receive HTTP 403 or are disregarded for arbitrary URL submissions.
- Google Search Console manual URL inspection UI enforces a strict per-property daily quota of approximately 10 to 50 URLs per 24 hours. Attempting to submit 328 URLs in a single sitting triggers *"Quota exceeded. Please try again tomorrow"*.

### 2. Dual-Pronged Recovery Pattern
- **Prong 1 (Passive Full-Site Ingestion)**: Submit the 100% canonical, zero-error `sitemap-index.xml` in GSC. Googlebot crawls and indexes the full 328-page surface autonomously in the background without quota penalties.
- **Prong 2 (Active High-Priority Acceleration)**: Partition remaining canonical URLs into prioritized daily batches based on historical traffic and search impressions:
  - *Day 1 (Priority Core)*: Top 10 English tools + 14 top historical impression drivers (Spanish, Russian, German, French tools).
  - *Days 2–7 (Localized Batches)*: Submit 45–50 localized tool URLs per day until the entire 328-page inventory is processed.

---

## Incident 9: HTML Attribute Scraping Regex Robustness with Quotes and Apostrophes

### 1. Failure Mode
- During automated SEO validation scripting, regex pattern `content="([^"']*)"` was used to extract meta description and og:title tags.
- For non-English locales containing apostrophes in copy (e.g. Turkish `content="59'dan fazla dil desteği..."` or French `content="l'angle..."`), the regex prematurely terminated matching at the single quote `'`, reporting false-positive "Malformed or empty description" errors.

### 2. Prevention & Rule
- Never mix quote delimiters in regex character classes when parsing double-quoted HTML attributes:
  ```javascript
  // BAD: Prematurely breaks on apostrophes inside double-quoted attributes
  const match = html.match(/<meta name="description" content="([^"']*)"/);

  // GOOD: Strictly delimited by double-quote closing boundary
  const match = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  ```
