# Forensic Learning Dossier: gohugoio/hugo

## 1. Metadata & Source Provenance
- **Repository**: [gohugoio/hugo](https://github.com/gohugoio/hugo)
- **Commit SHA**: `85fb23f1c23a0acc9c9094dc033c19ec2c0d2a2b`
- **License**: Apache License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: High-performance Go static site generator with embedded internal SEO templates.

## 2. Core Architectural Mechanisms
1. **Embedded Standard SEO Templates**:
   - Hugo bundles built-in, W3C-compliant SEO templates:
     - `_internal/opengraph.html`: renders og:title, og:description, og:url, og:site_name, article:published_time, article:tag.
     - `_internal/schema.html`: renders JSON-LD for BlogPosting, NewsArticle, or WebPage.
     - `_internal/twitter_cards.html`: renders twitter:card, twitter:title, twitter:image.
2. **Automated Alias HTML Redirection Invariant**:
   - When a page defines `aliases: ["/old-slug/"]`, Hugo generates an HTML redirect file at `/old-slug/index.html` containing:
     - `<link rel="canonical" href="https://example.com/new-slug/">`
     - `<meta http-equiv="refresh" content="0; url=https://example.com/new-slug/">`
     - `<meta name="robots" content="noindex">`
   - Preserves search engine link equity without requiring Nginx/Apache server configuration.
3. **Multilingual Architecture & Hreflang**:
   - Native support for multilingual sites. Hugo's internal sitemap automatically links translated pages using `<xhtml:link rel="alternate" hreflang="..." href="...">`.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: 404 errors resulting from moved pages on static web servers (S3, Cloudflare Pages, GitHub Pages). Solved by automated alias HTML generation.
- **Failure Mode 2**: Inconsistent OpenGraph timestamps. Hugo standardizes ISO 8601 formatting for `article:published_time`.
