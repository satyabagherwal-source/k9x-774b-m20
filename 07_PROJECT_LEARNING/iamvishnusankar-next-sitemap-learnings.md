# Forensic Learning Record: iamvishnusankar/next-sitemap

> **Canonical Artifact**: `07_PROJECT_LEARNING/iamvishnusankar-next-sitemap-learnings.md`  
> **Source Repository**: [https://github.com/iamvishnusankar/next-sitemap.git](https://github.com/iamvishnusankar/next-sitemap)  
> **Commit Hash**: `144fad921e8ee30f03c73ed72208bfa7355eb75d`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: TypeScript, Node.js, Next.js  

---

## 1. Project Context & Architectural Mission

`iamvishnusankar/next-sitemap` is the de facto standard sitemap and robots.txt generation library for Next.js applications. It automates the generation of compliant XML sitemaps, sitemap indexes, dynamic SSR sitemaps, and robots.txt files, strictly conforming to the international Sitemap Protocol 0.9.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Sitemap Protocol Invariants
- **The 50,000 URL & 50MB Barrier**: The official Google/Bing Sitemap Protocol specifies a hard limit of 50,000 URLs or 50MB uncompressed file size per single XML sitemap.
- **Sitemap Index Generation**:
  - `packages/next-sitemap/src/builders/sitemap-index-builder.ts`: When site pages exceed the threshold (default `sitemapSize: 5000` for optimal crawler memory consumption), the builder automatically generates an index file `sitemap.xml` referencing chunked sitemaps:
    ```xml
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap><loc>https://example.com/sitemap-0.xml</loc></sitemap>
      <sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
    </sitemapindex>
    ```

### D2: Asynchronous State & Dynamic SSR Sitemaps
- For large dynamic databases (e-commerce catalogs, news portals), sitemaps cannot be statically generated at build time.
- `packages/next-sitemap/src/ssr/`: Provides `getServerSideSitemap` and `getServerSideSitemapIndex` for Route Handlers and SSR pages.
- **Cache-Control Protocol**: Dynamic sitemaps must set `Content-Type: text/xml; charset=utf-8` and strict edge caching headers:
  `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=43200` to prevent database overloading during aggressive bot crawling.

### D3: Error Boundaries & URL Normalization
- All generated `<loc>` URLs are validated against absolute URL regexes. Trailing slashes are normalized based on project config (`trailingSlash: true | false`) to prevent redirect chains inside the sitemap.

### D4: Internationalization & Alternate Hreflang References
- Generates `<xhtml:link>` elements inside `<url>` tags:
  ```xml
  <url>
    <loc>https://example.com/page</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/page"/>
    <xhtml:link rel="alternate" hreflang="es" href="https://example.com/es/page"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/page"/>
  </url>
  ```
  Ensures reciprocal verification across language variants.

### D5: Automated Robots.txt Synchronization
- Automatically pairs sitemap emission with `/robots.txt`:
  - Injects `Sitemap: https://yourdomain.com/sitemap.xml` directive.
  - Enforces `Disallow: /api/*` and `Disallow: /_next/*` to preserve crawl budget for indexable content.

### D6: Transform & Filter Pipeline
- Provides a custom `transform` hook allowing developers to dynamically calculate `priority` (0.0 to 1.0), `changefreq` (`always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `never`), and `lastmod` based on database update timestamps.

### D7: Build & Post-Build Hooks
- Integrates seamlessly into `package.json` build scripts:
  `"postbuild": "next-sitemap"` reads `.next/prerender-manifest.json` and `.next/routes-manifest.json` after `next build` finishes.

### D8: Forensic Bug Fixes & Real Production Incidents
- **Issue**: Memory crashes on projects with 200,000+ routes during sitemap string concatenation.
- **Fix**: Implemented chunked stream serialization and buffer reuse in `sitemap-builder.ts`.

---

## 3. Empirical Evidence & Ground Truth
- Verified against commit `144fad921e8ee30f03c73ed72208bfa7355eb75d`.
- Verified implementation logic in `packages/next-sitemap/src/builders/sitemap-builder.ts` and `robots-txt-builder.ts`.

---

## 4. Master Brain Integration & Status
- **Status**: `VERIFIED_LEARNING`
- **Indexed In**: `05_KNOWLEDGE/knowledge-index.json`
- **Registered In**: `04_WORKFLOWS/factory-engine/sources-registry.json`
