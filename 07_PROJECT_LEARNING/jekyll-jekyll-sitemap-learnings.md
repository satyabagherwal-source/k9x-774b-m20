# Forensic Learning Dossier: jekyll/jekyll-sitemap

## 1. Metadata & Source Provenance
- **Repository**: [jekyll/jekyll-sitemap](https://github.com/jekyll/jekyll-sitemap)
- **Commit SHA**: `99148a2255a2b3a8d2b31ba8216945262981b12c`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Canonical Ruby-based sitemap plugin for Jekyll and GitHub Pages static hosting.

## 2. Core Architectural Mechanisms
1. **Frontmatter Ingestion & Exclusion Filter**:
   - Inspects page metadata: excludes pages where `sitemap: false` or `robots: noindex` is declared in YAML frontmatter.
   - Excludes unpublished drafts (`published: false`) and layout templates.
2. **Canonical URL Hygiene**:
   - Strips trailing `/index.html` from output `<loc>` tags, ensuring that sitemaps only list clean canonical URLs (e.g. `https://domain.com/docs/` instead of `https://domain.com/docs/index.html`).
3. **ISO 8601 Lastmod Calculation**:
   - Extracts page last modified date from Git log history if available, falling back to file mtime, formatted strictly as W3C Datetime (`YYYY-MM-DDTHH:MM:SSZ`).

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Emitting `index.html` in sitemaps causing "Page with redirect" warnings in Google Search Console. Prevented by automatic regex stripping.
- **Failure Mode 2**: Emitting raw non-HTML assets (CSS, JS, images) in the main URL sitemap. Jekyll-sitemap strictly filters by HTML/XHTML extension.
