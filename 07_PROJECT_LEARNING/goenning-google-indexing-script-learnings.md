# Forensic Learning Record: goenning/google-indexing-script

> **Canonical Artifact**: `07_PROJECT_LEARNING/goenning-google-indexing-script-learnings.md`  
> **Source Repository**: [https://github.com/goenning/google-indexing-script.git](https://github.com/goenning/google-indexing-script)  
> **Commit Hash**: `c52c2f8c67ad99594c78021ff4b203decdc74976`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: TypeScript, Google Search Console API, Google Indexing API  

---

## 1. Project Context & Architectural Mission

`goenning/google-indexing-script` is an automated Node.js/TypeScript tool that interacts directly with the Google Search Console URL Inspection API and Google Indexing API. It inspects indexation status across sitemaps and dispatches real-time re-indexing requests for unindexed or newly published URLs.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Property Format Normalization (`sc-domain:` vs URL Prefix)
- Google Search Console API enforces distinct property identifier formats:
  - Domain properties MUST be prefixed with `sc-domain:example.com`.
  - URL-prefix properties MUST include scheme and trailing slash: `https://example.com/`.
  - The script implements multi-format conversion (`convertToSiteUrl`, `convertToSCDomain`) to seamlessly authenticate regardless of which property type is registered in the Google Cloud service account.

### D2: Real-Time Indexation State Inspection
- Directly queries `searchconsole.urlInspection.index.inspect`, parsing:
  - `verdict`: `PASS`, `NEUTRAL`, or `FAIL`.
  - `coverageState`: `CRAWLED_NOT_INDEXED`, `DISCOVERED_NOT_INDEXED`, `EXCLUDED_BY_RULE`, `SUBMITTED_AND_INDEXED`.
  - `indexingState`: `INDEXING_ALLOWED` or `BLOCKED_BY_META_TAG`.

### D3: Quota Management & Exponential Backoff
- Manages Google Indexing API rate limits (200 requests/day default quota) via a resilient `fetchRetry` wrapper with exponential backoff on HTTP 429 and 503 errors.
