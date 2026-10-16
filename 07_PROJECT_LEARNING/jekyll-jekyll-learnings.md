# Forensic Learning Dossier: jekyll/jekyll

## 1. Metadata & Source Provenance
- **Repository**: [jekyll/jekyll](https://github.com/jekyll/jekyll)
- **Commit SHA**: `dfd13c7ee80dcf236fa7962453664cbff2b704d9`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: The foundational Ruby static site generator powering GitHub Pages.

## 2. Core Architectural Mechanisms
1. **Authoritative URL Model (`lib/jekyll/url.rb`)**:
   - Calculates URLs based on configurable permalink templates (`:categories/:year/:month/:day/:title:output_ext`).
   - Normalizes path structures, ensuring consistent trailing slashes or file extensions across collections.
2. **Liquid Filter Ecosystem**:
   - Provides `absolute_url` and `relative_url` filters that prepend `site.url` and `site.baseurl`.
   - Guarantees that canonical tags and RSS/Atom feeds output valid, fully-qualified HTTPS URLs.
3. **Plugin Extensibility Lifecycle**:
   - Exposes hooks: `:pages, :post_init`, `:documents, :pre_render`, `:site, :post_write`.
   - Enables sitemap generators and SEO tag plugins to inject compliant XML and HTML metadata.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Relative URLs in RSS feeds or canonical tags breaking crawler consumption. Defended by `absolute_url` filter.
- **Failure Mode 2**: URL collision when multiple posts share the same title across different dates. Solved by date-prefixed default permalinks.
