# Forensic Learning Record: garmeeh/next-seo

> **Canonical Artifact**: `07_PROJECT_LEARNING/garmeeh-next-seo-learnings.md`  
> **Source Repository**: [https://github.com/garmeeh/next-seo.git](https://github.com/garmeeh/next-seo)  
> **Commit Hash**: `738ef7e774ee6216f6e90c26a3b5b99dd5d166b4`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: TypeScript, React, Next.js  

---

## 1. Project Context & Architectural Mission

`garmeeh/next-seo` is the premier declarative SEO and structured data plugin for Next.js applications. It provides declarative React components (`<NextSeo />`, `<DefaultSeo />`, and 20+ specialized `<...JsonLd />` components) that manage `<head>` tags, OpenGraph cards, Twitter previews, and Schema.org rich snippets with automatic deduplication.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Component Boundaries
- **Core Architecture (`src/`)**:
  - `pages/core/buildTags.tsx`: Tag synthesis and deduplication engine.
  - `utils/stringify.ts`: XSS-safe JSON-LD serialization.
  - `types/`: Strongly typed definitions for Article, Breadcrumb, Product, Organization, FAQ, LocalBusiness, and SoftwareApplication schemas.

### D2: Tag Deduplication & Head Hygiene
- **Key-Based Deduplication**: Next.js and React head managers merge tags based on unique keys:
  - If a child page declares `<NextSeo title="New Title" />`, the engine must replace the default title rather than appending a second `<title>` tag.
  - Dedupes canonical links (`rel="canonical"`), OpenGraph tags (`og:title`, `og:description`, `og:image`), and Twitter Card properties.

### D3: Safe JSON-LD Serialization Protocol (Anti-XSS Invariant)
- **The `<script>` Injection Vulnerability**: Naively serializing user data into an inline `<script type="application/ld+json">` with `JSON.stringify(data)` opens a severe Cross-Site Scripting (XSS) attack vector if the data contains `</script>`. The browser HTML parser closes the script block immediately upon seeing `</script>`, executing any following string as live JavaScript.
- **The Safe Escape Invariant**: `stringify.ts` escapes slash characters:
  ```typescript
  export const safeJsonLdReplacer = (data: any) => {
    return JSON.stringify(data).replace(/<\/script/gi, '<\\/script');
  };
  ```
  Ensures that structured data containing user-generated reviews, FAQs, or product descriptions cannot execute malicious code.

### D4: Schema.org Rich Result Specifications
- Implements strict Google Rich Result schemas:
  - **BreadcrumbList**: Enables hierarchical breadcrumbs in Google SERP. Requires explicit integer `position` (1-indexed), item `name`, and absolute `@id`/`item` URL.
  - **Product**: Requires `offers.price` and `offers.priceCurrency` (ISO 4217). Omitting currency or availability triggers Google Search Console merchant schema errors.
  - **FAQPage**: Strictly enforces `mainEntity` array of `Question` entities with `acceptedAnswer.text`.

### D5: Social Graph Optimization (Open Graph & Twitter Cards)
- Automatically computes required fallbacks:
  - `og:type` defaults to `website` (or `article` when dates and authors are present).
  - Multi-image OpenGraph array with explicit `width`, `height`, and `alt` properties to allow social platforms (Twitter, LinkedIn, Facebook, Slack) to render instant preview cards without downloading full image buffers.

### D6: Build & Packaging
- Zero runtime overhead: compiles to lightweight ESM and CJS bundles, treeshaking unused JSON-LD components cleanly.

### D7: Forensic Bug Fixes & Real Production Incidents
- **Issue**: Broken JSON-LD rendering when `description` fields contained unescaped double quotes or HTML entities.
- **Fix**: Implemented pre-sanitization of string fields in `src/utils/processors.ts`.

---

## 3. Empirical Evidence & Ground Truth
- Verified against commit `738ef7e774ee6216f6e90c26a3b5b99dd5d166b4`.
- Inspected implementation code in `src/utils/stringify.ts` and `src/pages/core/buildTags.tsx`.

---

## 4. Master Brain Integration & Status
- **Status**: `VERIFIED_LEARNING`
- **Indexed In**: `05_KNOWLEDGE/knowledge-index.json`
- **Registered In**: `04_WORKFLOWS/factory-engine/sources-registry.json`
