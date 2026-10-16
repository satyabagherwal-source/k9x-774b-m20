# Forensic Learning Record: google/site-kit-wp

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-site-kit-wp-learnings.md`  
> **Source Repository**: [https://github.com/google/site-kit-wp.git](https://github.com/google/site-kit-wp)  
> **Commit Hash**: `e32dbef9e0b4dda334c51559ac694d8506e1e377`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: PHP 7.4+, WordPress Core APIs, Google REST APIs, React  

---

## 1. Project Context & Architectural Mission

`google/site-kit-wp` is Google's official WordPress plugin integrating Search Console, PageSpeed Insights, Google Analytics 4, AdSense, and Tag Manager directly into WordPress. It provides the gold-standard reference implementation for Google API authentication, batch querying, and Core Web Vitals telemetry.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Structural Boundaries
- Modular architecture under `includes/Modules/`:
  - `Search_Console`: Queries Google Search Console API for impressions, clicks, CTR, and keyword rankings.
  - `PageSpeed_Insights`: Fetches real-world Chrome User Experience Report (CrUX) and lab data for LCP, CLS, and INP.
  - `Analytics_4`: Sets up GA4 tracking snippets with Consent Mode v2 support.

### D2: Google URL Normalization Trait
- Implements `Google_URL_Normalizer` and `Google_URL_Matcher_Trait` to match WordPress post URLs against Google Search Console report data, resolving differences in protocol (http vs https) and trailing slashes.

### D3: Batch Search Analytics Querying
- Combines multiple metric requests into a single batch HTTP payload (`Batch_Search_Analytics`), avoiding API rate-limiting issues when rendering admin dashboards for high-traffic enterprise sites.
