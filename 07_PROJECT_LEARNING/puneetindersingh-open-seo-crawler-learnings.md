# Forensic Learning Record: puneetindersingh/open-seo-crawler

> **Canonical Artifact**: `07_PROJECT_LEARNING/puneetindersingh-open-seo-crawler-learnings.md`  
> **Source Repository**: [https://github.com/puneetindersingh/open-seo-crawler.git](https://github.com/puneetindersingh/open-seo-crawler)  
> **Commit Hash**: `654350c9ded45b7cc53df9150bfdb092b169b42d`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: Python 3.11+, FastAPI, MCP Server  

---

## 1. Project Context & Architectural Mission

`puneetindersingh/open-seo-crawler` is an enterprise-grade technical SEO crawler and audit platform with native AI agent integration. It includes an MCP server, CLI, and web interface, specifically focusing on complex edge cases: raw byte-level HTML parsing discrepancies, Googlebot ingestion boundaries, and template variable leaks in modern Single Page Application (SPA) / SSR frameworks.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Structural Boundaries
- **Core Modules**:
  - `crawler/page_checks.py`: 80+ granular technical SEO checks covering headers, byte positions, and DOM semantics.
  - `crawler/agent_tools.py`: Tool definitions allowing AI agents to run targeted page audits, inspect redirect graphs, and suggest code fixes.
  - `crawler/mcp_server.py`: MCP endpoint serving real-time crawl findings directly into IDE assistants.

### D2: Raw Byte `<head>` Premature Closure Bug
- **The HTML5 Spec Trap**:
  - According to HTML5 parsing rules, only a specific whitelist of tags is permitted inside `<head>`: `title`, `meta`, `link`, `script`, `style`, `base`, `noscript`, `template`.
  - If any unexpected tag (such as an unclosed `<div>`, tracking pixel `<img>`, or `<iframe>`) appears in the raw HTML before `<link rel="canonical">` or `<meta name="robots">`, the parser **implicitly terminates `<head>` and opens `<body>`**.
  - Subsequent `<link>` and `<meta>` tags are pushed into `<body>`, where search engines (Googlebot, Bingbot) completely ignore them.
  - **Audit Invariant**: High-level DOM parsers (like BeautifulSoup or browser devtools) often auto-correct or hide this displacement. Crawlers must inspect raw token order in the response stream to guarantee canonical and indexing directives precede any body elements.

### D3: Googlebot 2MB HTML Ingestion Boundary
- Googlebot truncates HTML documents at exactly 2,000,000 bytes (2MB).
- Content, structured data (`application/ld+json`), or internal links positioned after the 2MB raw byte mark are completely invisible to search indexers.
- Crawlers must flag total HTML payload size and report the exact byte offset of critical SEO tags.

### D4: Template Variable Leakage Detection
- Identifies URLs containing framework template variables: `undefined`, `null`, `NaN`, `[object Object]`, `%7B%7B`, or `$id`.
- These occur when frontend components trigger fetch requests or render `<a href>` attributes before reactive state has initialized, generating thousands of junk 404 pages and wasting crawl budget.
