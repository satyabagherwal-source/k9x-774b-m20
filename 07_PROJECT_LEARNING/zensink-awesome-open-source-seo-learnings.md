# Forensic Learning Record: ZensInk/awesome-open-source-seo

> **Canonical Artifact**: `07_PROJECT_LEARNING/zensink-awesome-open-source-seo-learnings.md`  
> **Source Repository**: [https://github.com/ZensInk/awesome-open-source-seo.git](https://github.com/ZensInk/awesome-open-source-seo)  
> **Commit Hash**: `78cb417201c09f0ef5e5e1f73833e2c36cc20397`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: Markdown, Python (Tool Automation & Cataloging)  

---

## 1. Project Context & Architectural Mission

`ZensInk/awesome-open-source-seo` is an authoritative, zero-SaaS curated registry of open-source, self-hostable, and code-level SEO tools. It covers site crawlers, rank trackers, log analyzers, automated CI performance budgets, and the emerging frontier of Generative Engine Optimization (GEO/AEO) and `llms.txt` infrastructure.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architectural Taxonomy of Open-Source SEO Tooling
- **Layer 1: Crawlers & Auditing**:
  - Desktop / CI crawlers: `lighthouse-ci`, `linkinator`, `seonaut`, `LibreCrawl`.
- **Layer 2: Server Log Analysis**:
  - `goaccess`: Real-time terminal log analyzer tracking raw Googlebot hits, crawl frequency, and 404 spike anomalies directly from Nginx/Apache logs.
- **Layer 3: Generative Engine Optimization (GEO) & AI Search**:
  - `llms-txt`: Standardized markdown site mapping for language model citation.
  - Agent SEO skills: MCP-based auditing suites (`open-seo-mcp-skills`, `claude-seo`).

### D2: Recommended Open-Source Stacks
- **Indie / Small Business Stack**: `SerpBear` (Rank Tracking) + `seonaut` (Site Audit) + `Plausible` / `Matomo` (First-Party Analytics) + `lighthouse-ci` (PR performance & SEO gates).
- **Developer / Agent Stack**: `scrapy` (Custom Headless Crawlers) + `goaccess` (Raw Web Server Access Logs) + `google-indexing-script` (Instant API Indexation).

### D3: Data Ownership & GSC Limits
- Standard Google Search Console (GSC) web UI limits exports to 1,000 rows.
- Open-source extractors (`google-search-console-export-all`) leverage the Google Search Console API with search analytics pagination to extract 100,000+ query rows, eliminating data truncation.

### D4: Generative Engine Optimization (GEO) Standards
- Documented transition from traditional SERP "blue links" to AI citations (ChatGPT Search, Perplexity, Claude, Gemini).
- Verification factors for AI citation:
  - Factual definition blocks near top of page.
  - Structured entity markup with verified schema.
  - Clean markdown extraction endpoints via `/llms.txt`.

### D5: Build, CI/CD & Automated Refresh Systems
- Automated monthly verification scripts (`scripts/refresh.py`) querying the GitHub API to continuously validate repository stars, activity status, and archive flags.

---

## 3. Empirical Evidence & Ground Truth
- Verified against commit `78cb417201c09f0ef5e5e1f73833e2c36cc20397`.
- Verified category blueprints and recommended stacks in `README.md`.

---

## 4. Master Brain Integration & Status
- **Status**: `VERIFIED_LEARNING`
- **Indexed In**: `05_KNOWLEDGE/knowledge-index.json`
- **Registered In**: `04_WORKFLOWS/factory-engine/sources-registry.json`
