# Forensic Learning Dossier: nuxt-modules/sitemap

## 1. Metadata & Source Provenance
- **Repository**: [nuxt-modules/sitemap](https://github.com/nuxt-modules/sitemap)
- **Commit SHA**: `306f72108f9d4fe9df9cb6cf3222314b277b5fbd`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Enterprise XML Sitemap generator with dynamic chunking, multi-sitemap indexing, and multi-locale i18n integration.

## 2. Core Architectural Mechanisms
1. **Automated 50,000-URL Partitioning & Index Generation**:
   - Google and W3C sitemap protocols cap individual sitemap files at 50,000 URLs and 50MB.
   - When URL collection exceeds the limit, the module dynamically generates `sitemap_index.xml` and partitions paths into `sitemap-0.xml`, `sitemap-1.xml`, streaming chunks to prevent Node.js heap out-of-memory errors.
2. **Deep i18n Alternate Links Generation**:
   - For multilingual Nuxt applications, it automatically injects `<xhtml:link rel="alternate" hreflang="xx" href="..."/>` nodes inside each `<url>` block.
   - Ensures full reciprocal hreflang validity in XML, eliminating the need to bloat the HTML `<head>` with dozens of alternate link tags.
3. **Dynamic Route Discovery & Prerender Ingestion**:
   - Hooks into Nitro prerender crawl queue, automatically discovering all client routes while excluding pages flagged with `robots: false` or `noindex`.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Memory exhaustion during massive site builds (>100k products/posts). Solved with streamed XML chunking.
- **Failure Mode 2**: Non-200 OK URLs in Sitemaps. Automatically cross-references route rules to ensure 301/302 redirects and 404 pages are never emitted into the sitemap.
