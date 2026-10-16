# Forensic Learning Dossier: hexojs/hexo-generator-sitemap

## 1. Metadata & Source Provenance
- **Repository**: [hexojs/hexo-generator-sitemap](https://github.com/hexojs/hexo-generator-sitemap)
- **Commit SHA**: `e5b22b1005a0d348a97759b66ce1e98d89e49d8c`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Official Hexo plugin generating XML sitemaps.

## 2. Core Architectural Mechanisms
1. **Post & Page Sitemap Template**:
   - Emits valid W3C XML sitemaps with `<loc>`, `<lastmod>`, and priority tags.
   - Automatically skips posts flagged with `sitemap: false` in frontmatter.
2. **Canonical Domain Resolution**:
   - Resolves full URLs using `config.url` and `config.root`.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Private or draft articles leaking into public search engine sitemaps.
