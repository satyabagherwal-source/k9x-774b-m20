# Forensic Learning Record: StJudeWasHere/seonaut

> **Canonical Artifact**: `07_PROJECT_LEARNING/stjudewashere-seonaut-learnings.md`  
> **Source Repository**: [https://github.com/StJudeWasHere/seonaut.git](https://github.com/StJudeWasHere/seonaut)  
> **Commit Hash**: `a67387fe63a291be2ba49dd02399f20e453eb8b5`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: Go 1.21+, SQL/MySQL, HTML/CSS Web Dashboard  

---

## 1. Project Context & Architectural Mission

`StJudeWasHere/seonaut` is a high-speed technical SEO crawler written in Go. It stands out by separating issue detection into two distinct execution phases: single-page stream analysis and cross-page relational SQL graph queries. This architecture enables instant identification of complex cross-page defects such as missing bidirectional hreflang return links, canonical redirect chains, and orphan pages.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Two-Phase Issue Detection
- **Phase 1: Page-Level Stream Verification (`internal/issues/page/`)**:
  - Evaluated immediately as each page is fetched and parsed.
  - Checks: title length, missing H1, thin body content, non-HTTPS scheme, viewport configuration, TTFB latency, image alt tags.
- **Phase 2: Multi-Page Relational Graph Analysis (`internal/issues/multipage/`)**:
  - Runs after the entire crawl is persisted to SQL storage.
  - Uses indexed SQL `JOIN` and `LEFT JOIN` queries to evaluate structural relationships across the entire crawled corpus.

### D2: SQL-Driven Hreflang Reciprocity & Validity Queries
- Hreflang internationalization annotations require reciprocal references: if URL A specifies URL B as its Spanish alternate, URL B must specify URL A as its English alternate.
- Seonaut detects broken reciprocity via a single indexed self-join:
  ```sql
  SELECT DISTINCT pagereports.id
  FROM hreflangs
  LEFT JOIN hreflangs b ON hreflangs.crawl_id = b.crawl_id AND hreflangs.from_hash = b.to_hash
  LEFT JOIN pagereports ON hreflangs.pagereport_id = pagereports.id
  WHERE hreflangs.crawl_id = ?
    AND hreflangs.to_lang != "x-default"
    AND b.id IS NULL
  ```
- Detects invalid hreflang targets: hreflangs pointing to non-canonical URLs, `noindex` pages, 3xx redirects, and 4xx/5xx errors.

### D3: Relational Orphan Page Detection
- Pages discovered in XML sitemaps that have zero incoming internal links (`LEFT JOIN links ... WHERE links.to_url IS NULL`) are immediately flagged as orphan pages.
