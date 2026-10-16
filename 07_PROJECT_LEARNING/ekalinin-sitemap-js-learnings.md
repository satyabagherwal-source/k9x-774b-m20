# Forensic Learning Dossier: ekalinin/sitemap.js

## 1. Metadata & Source Provenance
- **Repository**: [ekalinin/sitemap.js](https://github.com/ekalinin/sitemap.js)
- **Commit SHA**: `523f8ae22b1952193128ed9465ff09c02ae2ce9d`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Node.js streaming XML sitemap generator supporting gzip compression, sitemap indexes, and image/video nodes.

## 2. Core Architectural Mechanisms
1. **Transform Stream Architecture (`SitemapStream`)**:
   - Writes XML items as a Node.js stream, directly piping chunks into gzip compression (`createGzip()`) and filesystem or HTTP response buffers.
   - Memory usage remains constant (`O(1)`) even when processing millions of URLs.
2. **XML Escaping & Schema Protection**:
   - Strictly escapes special characters (`&`, `<`, `>`, `"`, `'`) in `<loc>` and `<image:loc>` nodes to prevent malformed XML errors.
3. **Automatic Gzip Compression**:
   - Compresses XML payloads on the fly, reducing bandwidth usage by up to 90% when Googlebot requests large sitemaps.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Node.js heap out-of-memory (OOM) crashes when buffering 50,000 URLs in a single string. Defended by streaming pipelines.
- **Failure Mode 2**: XML validation errors caused by unescaped ampersands in query parameters. Defended by automatic XML entity escaping.
