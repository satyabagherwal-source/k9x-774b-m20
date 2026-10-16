# Forensic Learning Dossier: hexojs/hexo

## 1. Metadata & Source Provenance
- **Repository**: [hexojs/hexo](https://github.com/hexojs/hexo)
- **Commit SHA**: `5cf8271569ea28e67a079fefbe926ec3ba61f251`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Node.js static blog framework with SHA1 route caching and flexible permalink structures.

## 2. Core Architectural Mechanisms
1. **Dynamic Permalink Router**:
   - Generates predictable URLs using tokens (`:year/:month/:day/:title/`).
   - Normalizes slugs using `hexo-util` slugify, converting non-ASCII characters and whitespace to clean kebab-case.
2. **SHA1 Content Cache & Generation Performance**:
   - Computes SHA1 checksums of post content during generation. If a post has not changed, it skips re-rendering, preserving static file timestamps (`mtime`) for accurate sitemap `<lastmod>` outputs.
3. **OpenGraph & Meta Helpers**:
   - Built-in `open_graph()` helper inspects post content, extracts the first image tag automatically if no cover image is specified, and sets `og:image`.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Updating a single typo causing all sitemap lastmod timestamps to reset to today's date. Defended by SHA1 route cache preservation.
- **Failure Mode 2**: Missing social cards when authors forget to declare hero images. Defended by content-parsing image fallback.
