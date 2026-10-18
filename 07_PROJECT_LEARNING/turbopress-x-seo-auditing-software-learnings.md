> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/turbopress-x-seo-auditing-software-learnings.md`  
> **Source**: github (https://github.com/TurboPress-X/seo-auditing-software)  
> **Source Version**: `68d4a606db`  
> **License**: MIT  
> **Synthesized By**: Antigravity Deep Forensic Harvester  
> **Timestamp**: 2026-10-18T05:30:00.000Z  
> **Learning ID**: `learn-github-turbopress-x-seo-auditing-software`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record: TurboPress-X/seo-auditing-software

## 1. Executive Forensic Architecture & System Mechanics
Resumable Python crawler with automated `pytest` suite.
- **Data-URI Spider Memory Barrier**:
  - Commit `c041d8c`: `fix: drop data-URI href/src before they become bogus crawl URLs`.
  - Discards `data:` and `;base64,` image/SVG strings before enqueueing, preventing database bloat and crawler Out-Of-Memory exceptions.

## 2. Promoted Master Brain Rules
- **Rule 1612**: Crawler SSRF Quarantine & Inline Data-URI Memory Barrier.