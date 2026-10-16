# Forensic Learning Dossier: harlan-zw/nuxt-seo

## 1. Metadata & Source Provenance
- **Repository**: [harlan-zw/nuxt-seo](https://github.com/harlan-zw/nuxt-seo) (official canonical module for `@nuxtjs/seo`)
- **Commit SHA**: `87700ddb4fbb4d1a4835e684b3c6b9f0bf978787`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Unified SEO meta-module orchestrating Site Config, Robots, Sitemap, Schema.org, OG Image, SEO Utils, and Link Checker.

## 2. Core Architectural Mechanisms
1. **Centralized Site Configuration Context (`useSiteConfig()`)**:
   - Solves the distributed metadata configuration defect where different modules (robots, sitemap, canonical, schema) have conflicting domain names, protocols, or trailing slash rules.
   - Cascades: `site.url`, `site.name`, `site.description`, `site.defaultLocale`, `site.indexable`.
2. **Global Non-Production Indexing Quarantine Invariant**:
   - If `site.indexable === false` (automatically triggered when `NODE_ENV !== 'production'` or on preview URLs like Vercel/Netlify preview deploys):
   - Automatically forces `noindex, nofollow` across all HTML documents via `useHead()`.
   - Forces `Disallow: /` across `robots.txt`.
   - Suppresses public sitemap exposure.
   - Eliminates staging site search index cannibalization.
3. **Canonical Normalization Pipeline**:
   - Uses `withBase(path, site.url)` to guarantee that canonical tags match the authoritative domain, scheme (HTTPS), and trailing slash rule configured for the application.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Preview / Staging Branch Indexation. Branch deploys (e.g. `branch-feat-xxx.vercel.app`) getting indexed by Googlebot and competing with production domain. Defended by auto-detecting deployment environment and enforcing quarantine.
- **Failure Mode 2**: Missing or Inconsistent Base URLs between Sitemap and Canonical tags. Solved by centralized `SiteConfig` cascading.
