# Forensic Learning Record: GoogleChrome/lighthouse

> **Canonical Artifact**: `07_PROJECT_LEARNING/googlechrome-lighthouse-learnings.md`  
> **Source Repository**: [https://github.com/GoogleChrome/lighthouse.git](https://github.com/GoogleChrome/lighthouse)  
> **Commit Hash**: `604fefc42444e53e8120058ae8a8e15431f64b1a`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: JavaScript/TypeScript, Node.js, Chromium DevTools Protocol  

---

## 1. Project Context & Architectural Mission

`GoogleChrome/lighthouse` is Google's authoritative open-source audit engine and automated diagnostic tool for web developers. It runs directly within Chromium via the Chrome DevTools Protocol (CDP) to evaluate Web Performance, Accessibility, Best Practices, PWA compliance, and Search Engine Optimization (SEO). Its SEO audit subsystem (`core/audits/seo/`) sets the industry standard for automated search engine readiness.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Subsystem Boundaries
- **The Audit Subsystem (`core/audits/seo/`)**:
  - `canonical.js`: Rel=canonical verification.
  - `crawlable-anchors.js`: Anchor tag linkability analysis.
  - `hreflang.js`: Multilingual alternate link validation.
  - `http-status-code.js`: HTTP response header audit.
  - `is-crawlable.js`: Meta robots and X-Robots-Tag directive evaluation.
  - `link-text.js`: Anchor descriptive clarity assessment.
  - `meta-description.js`: Meta description completeness.
  - `robots-txt.js`: Robots.txt syntax and parser validation.

### D2: Asynchronous State & CDP Gathering
- Audits decouple gathering (`core/gather/gatherers/seo/`) from computation (`core/audits/seo/`). Gatherers query Chromium DOM and network logs asynchronously and emit immutable artifacts; audits evaluate artifacts synchronously with zero side-effects.

### D3: Error Boundaries & Failure Classifications
- Failures in Lighthouse audits are explicitly categorized into:
  - `explanationConflict`: Multiple conflicting canonical URLs detected.
  - `explanationRelative`: Canonical URL is relative rather than absolute.
  - `explanationPointsElsewhere`: Canonical points to another hreflang target.
  - `explanationRoot`: Canonical points erroneously to domain root instead of the specific content page.

### D4: Resource Lifecycle & Performance Constraints
- Mobile-first audit emulation: Audits run with mobile user-agent strings, touch-target bounding checks (minimum 48x48 CSS pixels with 8px spacing), and mobile viewport constraints (`width=device-width, initial-scale=1`).

### D5: Boundary Parsing & HTML Spec Invariants
- **Body Canonical Rejection**: `link[rel="canonical"]` elements inside `<body>` are explicitly ignored for SEO purposes (`link.source === 'body' continue;`). Only links within `<head>` constitute authoritative canonical directives.
- **Uncrawlable Anchor Patterns**:
  - `javascript:void(0)` in `href` prevents crawlers from resolving destination URLs.
  - `<a>` elements omitting `href` while attaching click listeners (`onclick`) are classified as uncrawlable links.
  - Links using `file:` protocols fail crawlability.

### D6: Cross-Platform & Crawler Invariants
- Directives in `X-Robots-Tag` HTTP headers take precedence or combine additively with HTML `<meta name="robots">`.
- Expired `unavailable_after: [date]` headers automatically block indexing once current epoch exceeds the deadline.

### D7: Build, CI/CD, Tooling & Automation
- Lighthouse CI (`lhci`) automates SEO assertions on PRs, enforcing strict error thresholds to prevent search ranking regressions prior to deployment.

### D8: Forensic Bug Fixes & Real Production Incidents
- **Issue**: Anchor audit falsely flagging anchor links (`<a id="section">`) used as in-page scroll targets.
- **Fix**: Added guard in `crawlable-anchors.js` ignoring empty rawHref when `id` attribute is present.

---

## 3. Empirical Evidence & Ground Truth
- Verified against commit `604fefc42444e53e8120058ae8a8e15431f64b1a`.
- Audited implementation logic in `core/audits/seo/canonical.js` and `core/audits/seo/crawlable-anchors.js`.

---

## 4. Master Brain Integration & Status
- **Status**: `VERIFIED_LEARNING`
- **Indexed In**: `05_KNOWLEDGE/knowledge-index.json`
- **Registered In**: `04_WORKFLOWS/factory-engine/sources-registry.json`
