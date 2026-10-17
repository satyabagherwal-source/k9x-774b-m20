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
