# Forensic Learning Record: nurkamol/seo-audit

> **Canonical Artifact**: `07_PROJECT_LEARNING/nurkamol-seo-audit-learnings.md`  
> **Source Repository**: [https://github.com/nurkamol/seo-audit.git](https://github.com/nurkamol/seo-audit)  
> **Commit Hash**: `b70b3bf8f29bcbbdcdfb969079fd41097d1368e1`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: JavaScript/ESM, Node.js  

---

## 1. Project Context & Architectural Mission

`nurkamol/seo-audit` is an advanced, production-grade site-wide SEO auditing engine written in modern JavaScript (ESM). Unlike single-page graders, it crawls entire sites to detect structural, cross-page, and architectural SEO defects (broken link graphs, canonical mismatches on paginated archives, heading hierarchy violations, duplicate content clusters, and click-depth bottlenecks).

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Structural Boundaries
- **Core Pipeline**:
  - `src/site.mjs`: High-performance asynchronous crawler navigating link graphs.
  - `src/checks.mjs`: Mathematical and rule-based inspection engine.
  - `src/dupes.mjs`: Content clustering detecting duplicate and near-duplicate pages.
  - `src/graph.mjs`: Link graph analysis tracking in-degree and page rank distribution.
  - `src/score.mjs`: Weighted SEO health scoring across error, warning, and info levels.

### D2: Asynchronous State & Concurrency Controls
- Concurrent link traversal with rate-limiting pools preventing server denial of service.
- Deduplication queue tracking normalized URL hashes to avoid infinite crawling loops across query-parameter variations.

### D3: Error Boundaries & Finding Classification
- Strict 3-tier severity classification:
  - `error`: Violations that break indexing or directly cost organic traffic (e.g. 404 in sitemap, noindex on canonical target, conflicting canonicals).
  - `warn`: Issues requiring architectural judgment (e.g. title too long, thin content < 300 words, click depth > 4).
  - `info`: Structural notices that may be intentional (e.g. pagination sequences, nofollow external links).

### D4: Quantitative SEO Invariants & Limits
- Evaluated against standard production defaults:
  - **Title Length**: Minimum 15 characters, maximum 60 characters.
  - **Meta Description**: Minimum 70 characters, maximum 160 characters.
  - **Thin Content Threshold**: Under 300 words flagged as thin content.
  - **Maximum Click Depth**: 4 clicks from root URL. Pages deeper than 4 clicks suffer severe crawl budget starvation.
  - **Slow Response Latency**: Responses taking longer than 800ms flagged as performance risks.

### D5: Pagination & Canonical Invariants
- **The Paginated Canonical Rule**:
  - Automatically identifies pagination series via path (`/page/2/`) or query parameter (`?page=2`).
  - **CRITICAL INVARIANT**: Never set the canonical of page 2 (or subsequent pages) to page 1. Page 2 is not identical content to page 1. Pointing page 2 canonical to page 1 causes search engines to de-index the archive, cutting off search discovery for historic articles. Each paginated page must maintain a self-referential canonical or a dedicated "view-all" canonical.

### D6: Image Accessibility & Alt Text Defect Traps
- **Alt Text Anti-Patterns**:
  - Image filename in alt attribute (`ALT_FILENAME`: `.jpg`, `.png`, `.webp`, `.svg`).
  - Camera/serial defaults (`ALT_SERIAL`: `img_123`, `dsc_001`, `pxl_...`).
  - Redundant medium descriptors (`ALT_PLACEHOLDER`: `image`, `photo`, `picture`, `icon`, `logo`).
  - Screen reader character limit: Alt text capped at 125 characters to match natural speech cadence.

### D7: Build & Tooling Integration
- Provides Raycast extension, Cloudflare Worker integration, and CLI exporters (JSON, CSV, HTML reports).

### D8: Forensic Bug Fixes & Real Production Incidents
- **Issue**: Flaky link verification caused by transient DNS resolution failures.
- **Fix**: Implemented DNS retry backoff and socket connection pooling in `src/http.mjs`.

---

## 3. Empirical Evidence & Ground Truth
- Verified against commit `b70b3bf8f29bcbbdcdfb969079fd41097d1368e1`.
- Inspected implementation code in `src/checks.mjs`, lines 22-105.

---

## 4. Master Brain Integration & Status
- **Status**: `VERIFIED_LEARNING`
- **Indexed In**: `05_KNOWLEDGE/knowledge-index.json`
- **Registered In**: `04_WORKFLOWS/factory-engine/sources-registry.json`
