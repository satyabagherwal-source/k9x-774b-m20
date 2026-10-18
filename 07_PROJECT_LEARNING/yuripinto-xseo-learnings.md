> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yuripinto-xseo-learnings.md`  
> **Source**: github (https://github.com/yuripinto/xseo)  
> **Source Version**: `d335452f68`  
> **License**: MIT  
> **Synthesized By**: Antigravity Deep Forensic Harvester  
> **Timestamp**: 2026-10-18T05:45:00.000Z  
> **Learning ID**: `learn-github-yuripinto-xseo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record: yuripinto/xseo

## 1. Executive Forensic Architecture & System Mechanics
`xseo` is a local-first Python SEO crawler and auditing engine with clean hexagonal architecture (Ports & Adapters: `domain/`, `adapters/`, `application/`). It features 44 test suites and verified CI/CD regression tracking.

### Key Architectural Innovations:
1. **OASIS SARIF Export & GitHub Actions Integration**:
   - Emits crawl defect reports directly in SARIF (`reporting.py`), generating automated PR annotations in GitHub Code Scanning.
2. **Two-Crawl Relational Differential Analyzer (`crawl-diff`)**:
   - Compares production vs staging/PR crawls in SQLite to detect newly introduced regressions (indexability flips, broken status codes, title drops).
3. **Poisoned Canonical Target Detection (`cross_page_detectors.py`)**:
   - Identifies non-self canonical tags that point to `noindex` pages (`canonical_to_noindex`), point to intermediate redirect hops (`canonical_to_redirect`), or target cross-domain hosts (`canonical_cross_domain`).

## 2. Multi-Dimensional Investigation Summary (D1 to D8)
- **D1 (Architecture)**: Hexagonal boundaries separating HTTPX fetching, SQLite persistence, and rule analysis.
- **D3 (Error Handling)**: Graceful network timeouts and SSL failure classification.
- **D8 (Bug Fixes)**:
  - Commit `b76aee6`: `feat: detect canonicals pointing to noindex, redirect, or cross-domain (#26)`
  - Commit `9b3d6e0`: `feat: add HTML and SARIF report formats, a crawl-diff command, and a GitHub Action (#14)`

## 3. Promoted Master Brain Rules
- **Rule 1614**: SARIF-Compliant Crawl Regression & Poisoned Canonical Detection.