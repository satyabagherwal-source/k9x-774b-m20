# Forensic Learning Dossier: GoogleChrome/web.dev

## 1. Metadata & Source Provenance
- **Repository**: [GoogleChrome/web.dev](https://github.com/GoogleChrome/web.dev)
- **Commit SHA**: `a64d870f59c25431bbedf0ef06aa635072c43a2e`
- **License**: Creative Commons Attribution 4.0 / Apache 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: Google's official educational and guidance repository for web development best practices, CWV, and SEO.

## 2. Core Architectural Mechanisms
1. **Core Web Vitals Threshold Engineering**:
   - Codifies the 75th percentile (p75) requirement: 75% of page visits must meet the "Good" threshold for Google to consider the page passing.
   - Thresholds: LCP <= 2.5s, CLS <= 0.1, INP <= 200ms.
2. **Rendering Optimization Blueprints**:
   - Documents critical CSS inlining, font preloading (`rel="preload" as="font"`), image aspect ratio placeholders (`aspect-ratio: 16/9`), and script deferment.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Cumulative Layout Shifts caused by dynamic ad injections or web font swapping without size matching.
- **Failure Mode 2**: Render-blocking scripts delaying First Contentful Paint.
