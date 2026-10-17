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
