# Forensic Learning Record: PhialsBasement/LibreCrawl

> **Canonical Artifact**: `07_PROJECT_LEARNING/phialsbasement-librecrawl-learnings.md`  
> **Source Repository**: [https://github.com/PhialsBasement/LibreCrawl.git](https://github.com/PhialsBasement/LibreCrawl)  
> **Commit Hash**: `05a1372de8334ca18dec0bc1f7470c62901a9418`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: Python 3.10+, Beautiful Soup, Playwright, SQLite/Auth  

---

## 1. Project Context & Architectural Mission

`PhialsBasement/LibreCrawl` is a free, self-hosted web crawler and site audit engine designed for continuous monitoring of enterprise websites. It combines lightweight HTTP crawling with optional Playwright-based JavaScript rendering, featuring robust network exception classification, bounded near-duplicate processing, and comprehensive memory monitoring.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Structural Boundaries
- **Core Modules**:
  - `src/crawler.py`: Orchestrator managing rate limiting, thread pools, and fetch pipelines.
  - `src/core/issue_detector.py`: Rule engine auditing title, description, headings, status codes, and media.
  - `src/core/link_manager.py`: Graph management distinguishing internal, external, and subresource references.
  - `src/core/memory_monitor.py` & `memory_profiler.py`: Process telemetry preventing OOM crashes during large crawls.

### D2: Exception Cause-Chain Error Classification
- Traditional crawlers collapse all failed network calls into generic error messages. LibreCrawl traverses Python exception cause chains (`__cause__` and `__context__`) to classify low-level failures accurately:
  - `dns_not_found` (`socket.gaierror`, NXDOMAIN, resolution failure).
  - `ssl_error` (`ssl.SSLError`, certificate expiry, TLS protocol mismatch).
  - `connection_refused` (target port closed, firewall reset).
  - `timeout` (`socket.timeout`, gateway drop).
- Prevents transient network glitches from being incorrectly logged as HTTP 404 or 500 status codes.

### D3: Bounded Post-Crawl Duplication Budget
- Duplicate content comparison algorithms scale quadratically (`O(N^2)`) with site size.
- LibreCrawl implements `DUPLICATION_TIME_BUDGET_SECONDS = 120`. If duplicate analysis exceeds the budget, the pass stops gracefully with partial results and a warning, ensuring the crawler never hangs indefinitely in a "finishing up" state.

### D4: Semantic Image Alt Attribute Distinction
- In WCAG accessibility and image SEO, `alt=""` is the correct standard for decorative images.
- LibreCrawl checks `has_alt_attribute`: an image with `alt=""` is marked compliant; only images where the `alt` attribute is entirely absent are flagged as missing alt.
