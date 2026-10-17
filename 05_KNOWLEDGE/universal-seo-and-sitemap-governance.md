# UNIVERSAL SEO AND SITEMAP GOVERNANCE RULES
**Status**: Canonical Promoted Rules (Harvested from `oldenglishfontfree.com` & `onlinefreeprotractor.com`)  
**Date**: October 18, 2026  
**Governance**: AI-Builder-Brain Universal Bridge  

---

## Rule 73: Sitemap Purity & Decoupled Verification Gate

**RULE**:
XML sitemaps must never contain `noindex` URLs, 3xx redirect destinations, 4xx/5xx error pages, or non-canonical parameters. Furthermore, sitemap verification must be decoupled: test both `public/` and `dist/` build outputs to prevent static asset collision.

**WHY**:
Static site generators often copy `public/sitemap.xml` over dynamic build sitemaps, or advertise legacy sitemaps in `robots.txt`. When Googlebot discovers `noindex` URLs in a submitted sitemap, it flags indexation exclusion errors (`Excluded by noindex tag`) and wastes crawl budget.

**WHEN TO APPLY**:
Every web project deploying an XML sitemap, especially multilingual or static site generators (Astro, Next.js, Nuxt).

**IMPLEMENTATION**:
```javascript
// astro.config.mjs
export default defineConfig({
  site: 'https://example.com',
  integrations: [
    sitemap({
      filter: (page) => {
        return !page.includes('/404') && 
               !page.includes('/500') && 
               !page.includes('/frames') &&
               !page.match(/\/[a-z]{2}\/(about|privacy|terms|contact)\//);
      },
      serialize(item) {
        if (item.url === 'https://example.com/') {
          item.priority = 1.0;
          item.changefreq = 'daily';
        } else if (item.url.includes('/tools/')) {
          item.priority = 0.9;
          item.changefreq = 'weekly';
        } else {
          item.priority = 0.7;
          item.changefreq = 'monthly';
        }
        item.lastmod = new Date().toISOString();
        return item;
      }
    })
  ]
});
```

**NEGATIVE CONSTRAINT**:
```xml
<!-- ANTI-PATTERN: Committing static sitemap in public/ that contains noindex pages -->
<!-- public/sitemap.xml with <loc>https://example.com/es/privacy/</loc> -->
<!-- When template has <meta name="robots" content="noindex">, GSC flags Excluded by noindex tag -->
```

**VERIFICATION METHOD**:
Execute an automated test scanning `dist/sitemap-0.xml` against all rendered HTML files. Assert that 0 URLs in sitemap have `noindex` meta tags, and 100% have exact self-referential canonical tags.

---

## Rule 74: Scope-Sensitive Release Invalidation on Multilingual Expansion

**RULE**:
Any release certificate, quality audit, or SEO pass is strictly bound to the exact route inventory recorded at certification time. If subsequent commits introduce a >10% expansion in routes (e.g., adding 13 language editions, new category hubs, or bulk programmatic pages), previous quality certifications are automatically invalidated and a full `dist/` regression audit is mandatory.

**WHY**:
Teams often rely on a passing audit from an initial single-language release (e.g., 45 English routes). When 500+ localized routes are introduced, un-audited template variations (like language pickers emitting non-canonical links or missing translations) slip into production undetected.

**WHEN TO APPLY**:
Any project adding internationalization (i18n), localized subpaths, or programmatic SEO taxonomies.

**VERIFICATION METHOD**:
Check git commit diffs for route additions. If total generated HTML file count changes by >10%, fail the build unless `test:seo` is executed and passes 100%.

---

## Rule 75: Project-Brain Mandatory Local Bridge Contract

**RULE**:
Every project repository in the AI-Builder-Brain ecosystem must maintain a local `.project-brain/` directory containing `brain-bridge.json`, `PROJECT_RULES.md`, and `PROJECT_KNOWLEDGE.md`.

**WHY**:
Without a standardized local bridge manifest, autonomous agents boot in isolation, failing to retrieve domain-relevant rules codified in the Master Brain.

**WHEN TO APPLY**:
Universal across all repositories.

**VERIFICATION METHOD**:
Agent boot protocol must assert existence of `.project-brain/brain-bridge.json` before formulating task plans.

---

## Rule 76: Intentional Noindex Architecture & Signal Coherence

**RULE**:
When localized utility, legal, or policy routes (`/[lang]/(about|privacy|terms|contact)/`) are intentionally flagged with `noindex` in page source to defend against auto-translated thin-content penalties, the following 4-part architectural contract is MANDATORY:

1. **Sitemap Total Exclusion**: The pages must be 100% excluded from all generated or static sitemaps (`filter` in `@astrojs/sitemap`). A sitemap submission of a noindex URL is a contradictory indexing directive.
2. **Canonical Tag Omission**: Pages declaring `noindex` MUST omit the `<link rel="canonical">` tag. Emitting both `canonical` (meaning "index this target") and `noindex` (meaning "do not index") sends conflicting directives to Googlebot.
3. **Internal Crawl Quarantine (`rel="nofollow"`)**: Internal UI components (LanguagePickers, footer links, drawer matrices) leading to localized noindex routes MUST carry `rel="nofollow"` or redirect directly to the primary indexable locale canonical (e.g., `/about/`).
4. **Diagnostic Understanding in GSC**: In Google Search Console, seeing intentional utility URLs in "Excluded by ‘noindex’ tag" is an **EXPECTED AND INTENDED STATE**, NOT a defect. It only becomes a defect if those URLs were submitted via sitemap or crawl-discovered via un-nofollowed links.

**WHY**:
Developers often get alarmed when seeing URLs in "Excluded by noindex tag" and mistakenly remove the `noindex` tag. Removing `noindex` on 13 languages of thin boilerplate legal text exposes the entire domain to Google's sitewide "Low Quality / Thin Content" algorithmic demotion. The correct remediation is to retain `noindex`, remove from sitemaps, and add `rel="nofollow"` to internal links.

**WHEN TO APPLY**:
All static sites with internationalized editions (i18n) where legal, about, terms, or contact pages are not fully customized per locale.

---

## Rule 77: Client Navigation Parameter Leak Prevention

**RULE**:
Client-side JavaScript event listeners (e.g., search focus, drawer toggles, modal open buttons) must NEVER manipulate `window.location.href` using query parameters (e.g., `window.location.href = '/?search=true#fontSearchInput'`). Navigation state must be maintained purely via in-memory state or pure URL fragment hashes (e.g., `/#fontSearchInput`).

**WHY**:
Search engine crawlers and modern headless browsers evaluate inline DOM handlers. When an inline script executes a query string navigation, Googlebot discovers `/?search=true` as a distinct URL. Because the template canonicalizes to `/`, GSC flags the URL under "Alternate page with proper canonical tag", creating crawl bloat.

**WHEN TO APPLY**:
All front-end applications with client-side interactive search or filtering.

---

## Rule 78: Substantive Editorial Defense for Category Hubs

**RULE**:
Taxonomy and category hubs (e.g., `/category/[slug]/`) must never consist solely of a listing grid and introductory subtitle (< 200 words). Every category hub must contain at least 450 words of substantive, scholastic editorial content (historical origins, anatomical ductus characteristics, classification rules, pairing recommendations, and licensing guidance).

**WHY**:
Google's Helpful Content and Page Quality algorithms evaluate taxonomy pages for independent informational utility. Thin category pages that merely replicate filtered views of the homepage catalog are crawled and subsequently de-indexed under "Crawled — currently not indexed".

**WHEN TO APPLY**:
All e-commerce catalogs, font archives, icon libraries, and programmatic directory websites.
