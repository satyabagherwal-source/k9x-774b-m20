> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/seobserver-crawlobserver-learnings.md`  
> **Source**: github (https://github.com/SEObserver/crawlobserver)  
> **Source Version**: `64b6a78344`  
> **License**: AGPL-3.0  
> **Synthesized By**: Antigravity Deep Forensic Harvester  
> **Timestamp**: 2026-10-18T05:45:00.000Z  
> **Learning ID**: `learn-github-seobserver-crawlobserver`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record: SEObserver/crawlobserver

## 1. Executive Forensic Architecture & System Mechanics
Industrial Go crawler with 370 commits and 93 test suites, supporting high-performance crawling, custom test builders, and SQLite/ClickHouse storage.

### Key Architectural Innovations:
1. **Host-Affinity Request Header Quarantine (`internal/renderer/` & `internal/fetcher/`)**:
   - Resolves major security vulnerability (Commit `f85cc42`): prevents browser-wide header injection via `setExtraHTTPHeaders` from leaking Bearer tokens and HMAC signatures to third-party ad tags, tracking iframes, and CDNs.
   - Enforces per-request CDTP hijack routing strictly restricted to the crawled domain.
   - Automatically drops authentication headers when following 3xx redirects to external hosts.
2. **Link Placement Context Tracking (`internal/parser/`)**:
   - Records semantic DOM placement of internal links (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`) to model real internal PageRank flow.

## 2. Promoted Master Brain Rules
- **Rule 1616**: Host-Affinity Request Header Quarantine & Headless Hijack Routing.