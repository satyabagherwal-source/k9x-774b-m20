# Forensic Learning Record: kiranbabuthatha/SEO-crawler

> **Canonical Artifact**: `07_PROJECT_LEARNING/kiranbabuthatha-seo-crawler-learnings.md`  
> **Source Repository**: [https://github.com/kiranbabuthatha/SEO-crawler.git](https://github.com/kiranbabuthatha/SEO-crawler)  
> **Commit Hash**: `b3cf39f8bf14ff9c90ecfd1a27bd4d23abc1aa59`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: Python 3, BeautifulSoup4, LXML, Requests  

---

## 1. Project Context & Architectural Mission

`kiranbabuthatha/SEO-crawler` is a comprehensive, configurable Python SEO audit crawler built for automated site extraction, on-page signal analysis, and search engine bot emulation. It audits per-page metadata, response latency, redirect chains, heading hierarchies, XML sitemaps, and mobile rendering differences.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Data Modeling
- **`PageReport` Dataclass Model**: Encapsulates 40+ granular technical SEO metrics per URL, including canonical sources, status codes, title pixel widths, text-to-HTML ratios, image dimension audits, and structured data types.

### D2: Asynchronous State & Concurrency Control
- ThreadPoolExecutor concurrency combined with per-domain adaptive rate limiting and automated exponential backoff retries.

### D3: Error Boundaries & Edge Handling
- Handles gzip-compressed sitemaps (`.xml.gz`), nested sitemap indexes (`<sitemapindex>`), and malformed XML tags via defensive fallback parsers.

### D4: Quantitative Metrics & SERP Pixel Width Modeling
- **The SERP Pixel Truncation Principle**: Google truncates search results based on pixel width rather than raw character counts:
  - Titles truncate near ~580px (using narrow characters `iIl.,:;'|!ftj()[]{}/\\ ` vs wide characters `mwMW@%`).
  - Descriptions truncate near ~1000px.
  - Relying exclusively on character count thresholds leads to unexpected SERP ellipsis truncation on character-wide titles.

### D5: Canonical Link vs Header Conflicts
- Audits dual-channel canonical definitions:
  - `canonical_source` tracks whether the canonical is defined via HTML `<link rel="canonical">`, HTTP response header `Link: <...>; rel="canonical"`, or both.
  - Detects "Link+Header Conflict" where the HTTP header and HTML tag specify divergent URLs, which causes search engines to discard both directives.

### D6: Core Web Vitals & Image Dimension Audits
- Flags images lacking explicit `width` and `height` attributes (`images_missing_dimensions`). Missing aspect-ratio metadata causes dynamic layout reflow during image decoding, causing severe Cumulative Layout Shift (CLS).

### D7: Bot User-Agent Emulation
- Provides pre-configured, official User-Agent presets:
  - `googlebot`: Googlebot desktop crawler string.
  - `googlebot-mobile`: Android Nexus / Pixel Googlebot string.
  - `bingbot`: Bingbot desktop string.
  - Enables side-by-side comparison to detect cloaking or conditional user-agent serving bugs.

### D8: Forensic Bug Fixes & Real Production Incidents
- **Issue**: Memory bloat during large multi-thousand page crawls due to retained HTML parse trees.
- **Fix**: Parse trees discarded immediately after `PageReport` serialization; only lightweight metrics maintained in memory.

---

## 3. Empirical Evidence & Ground Truth
- Verified against commit `b3cf39f8bf14ff9c90ecfd1a27bd4d23abc1aa59`.
- Audited implementation logic in `seo_crawler.py`, lines 102-210.

---

## 4. Master Brain Integration & Status
- **Status**: `VERIFIED_LEARNING`
- **Indexed In**: `05_KNOWLEDGE/knowledge-index.json`
- **Registered In**: `04_WORKFLOWS/factory-engine/sources-registry.json`
