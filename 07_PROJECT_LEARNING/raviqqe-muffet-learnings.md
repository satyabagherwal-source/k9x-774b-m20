# Forensic Learning Record: raviqqe/muffet

> **Canonical Artifact**: `07_PROJECT_LEARNING/raviqqe-muffet-learnings.md`  
> **Source Repository**: [https://github.com/raviqqe/muffet.git](https://github.com/raviqqe/muffet)  
> **Commit Hash**: `b7f5bf8bc284dfc06386e08a09a06ab52ef50968`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: Go 1.21+, `golang.org/x/net/html`, concurrency primitives  

---

## 1. Project Context & Architectural Mission

`raviqqe/muffet` is a high-concurrency web link checker written in Go. Renowned for its minimal footprint and extreme execution speed, it navigates complex websites using Go channels and semaphores, parses robots.txt and XML sitemaps, resolves HTML base tags, and validates fragment anchors with zero memory overhead.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Structural Boundaries
- **Core Components**:
  - `html_page_parser.go`: Parses HTML node trees using `golang.org/x/net/html` and atom tokens.
  - `semaphore.go`: Buffered channel concurrency control capping active HTTP workers.
  - `throttled_http_client.go` & `retry_http_client.go`: Resilience layers managing server rate limits.
  - `robots_txt_fetcher.go` & `sitemap_fetcher.go`: Crawl boundary and seed URL extractors.

### D2: HTML `<base href>` Dynamic Resolution Invariant
- A common bug in custom web crawlers is resolving relative URLs against the request URL instead of the HTML document's declared base tag.
- Muffet searches the parsed HTML tree for `n.DataAtom == atom.Base` and immediately re-anchors the base reference:
  `base = base.ResolveReference(u)`
- Prevents massive crawl errors where relative links in templates with altered base paths produce invalid URL requests.

### D3: Memory-Efficient Fragment Indexing
- Muffet constructs a set of all anchor IDs and names (`id` and `name` attributes) during the initial node traversal pass:
  `frs := map[string]struct{}{}`
- Enables `O(1)` constant-time verification when incoming links target `#fragment` sections, eliminating redundant DOM searches.
