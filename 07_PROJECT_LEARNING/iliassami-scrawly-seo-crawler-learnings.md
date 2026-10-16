# Forensic Learning Record: IliasSami/scrawly-seo-crawler

> **Canonical Artifact**: `07_PROJECT_LEARNING/iliassami-scrawly-seo-crawler-learnings.md`  
> **Source Repository**: [https://github.com/IliasSami/scrawly-seo-crawler.git](https://github.com/IliasSami/scrawly-seo-crawler)  
> **Commit Hash**: `8fdebcf4e365f862ef80fa95d100067e6b911e11`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: Python 3.11+, Fast C Parsers (Lexbor / Selectolax), Vite UI, WordPress Companion Plugin  

---

## 1. Project Context & Architectural Mission

`IliasSami/scrawly-seo-crawler` (also known as SentinelSEO) is a high-performance SEO crawler designed to replicate and expand Screaming Frog functionality in open source. It implements 245 discrete checks categorized across 23 distinct technical domains, integrates Screaming Frog CSV ingestion, runs axe-core accessibility audits, fingerprints CMS/tech stacks, and features automated CMS remediation via an integrated WordPress companion plugin.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Structural Boundaries
- **Subsystems**:
  - `src/sentinelseo/crawl/parser.py`: Fast C-based HTML parsing via `selectolax.lexbor.LexborHTMLParser`.
  - `src/sentinelseo/checks/domain_a` through `domain_w` + `site_level`: 245 checks organized into 23 domain families.
  - `src/sentinelseo/prompts/check_specs.py`: Multi-layered agent fix prompt generator linking detected stack to concrete code edits.
  - `src/sentinelseo/wp/`: Automated CMS remediation connector with custom WordPress companion plugin.
  - `src/sentinelseo/crawl/vendor/axe.min.js`: Headless browser-injected accessibility audit engine.

### D2: Content Area Isolation & 128-Permutation MinHash
- **Boilerplate Stripping**: To prevent header/footer navigation links and copyright notices from polluting text analytics, `parser.py` decomposes boilerplate selectors before computing metrics.
- **MinHash Deduplication**: Employs `datasketch.MinHash` with 128 permutations and 5-word shingling (`num_perm=128`). Produces Jaccard similarity scores to reliably flag near-duplicate articles and thin content variants without false positives.
- **Flesch Reading Ease**: Computes readability scores in pure code based on syllable counts and sentence length.

### D3: Domain Family Fix Prompt Architecture
- Instead of maintaining 245 disconnected remediation guides, the engine structures fixes into 3 layers:
  1. **Domain family** (robots, headers, static templates, sitemaps, schema, media): knows target artifact and verification commands.
  2. **Check specification**: title, SEO impact rationale, and acceptance criteria.
  3. **Runtime finding**: specific broken URL, dynamic diff, and evidence snippet.
- Generates exact shell verification commands (`curl -sSI`, `curl -sS | grep`) for rapid testing.
