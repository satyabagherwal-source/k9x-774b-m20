# Forensic Learning Dossier: 11ty/eleventy

## 1. Metadata & Source Provenance
- **Repository**: [11ty/eleventy](https://github.com/11ty/eleventy)
- **Commit SHA**: `7b233a75e1fe7466eb3eefb9c8db9930b8e72763`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Zero-runtime client JS static site generator emphasizing pure HTML output and independent templates.

## 2. Core Architectural Mechanisms
1. **Zero-Client-JS Default Performance**:
   - Eleventy generates pure HTML and CSS without bundling a client-side JavaScript framework runtime.
   - Delivers perfect 100/100 Core Web Vitals scores out of the box with zero Total Blocking Time (TBT) and immediate LCP.
2. **Path Prefix URL Normalization**:
   - Built-in `url` filter prepends `pathPrefix`, allowing documentation or landing pages to be deployed under subdirectory paths without broken canonical tags or internal links.
3. **Pagination & Clean Permalinks**:
   - Eleventy's pagination engine outputs clean index paths (`/blog/page/2/`) instead of query string parameters (`/blog?page=2`), ensuring each page is deterministically crawlable and indexable.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Heavy client-side JavaScript execution blocking search engine rendering queues. Defended by zero-runtime output.
- **Failure Mode 2**: Parameterized pagination causing duplicate content confusion in Google Search Console. Defended by clean path routing.
