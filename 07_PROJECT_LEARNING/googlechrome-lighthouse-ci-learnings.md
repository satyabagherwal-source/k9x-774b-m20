# Forensic Learning Dossier: GoogleChrome/lighthouse-ci

## 1. Metadata & Source Provenance
- **Repository**: [GoogleChrome/lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci)
- **Commit SHA**: `772c9a93ffbfa1faae521e141a0295da9be6b60c`
- **License**: Apache License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: Automated testing framework running Lighthouse in CI/CD pipelines to prevent performance and SEO regressions.

## 2. Core Architectural Mechanisms
1. **Configurable Assertion Engine (`assert` module)**:
   - Allows declaring strict budgets in `lighthouserc.json`:
     - `categories:seo: {"minScore": 0.98}`
     - `categories:performance: {"minScore": 0.90}`
     - `document-title: {"minScore": 1}`
     - `canonical: {"minScore": 1}`
     - `crawlable-anchors: {"minScore": 1}`
2. **Multi-Run Median Filtering**:
   - Runs audits 3-5 times per URL and computes the median result to eliminate network jitter and CPU variance in CI runners.
3. **Server Telemetry Upload**:
   - Compares pull request performance against main branch baseline, generating automated PR status checks with metric diffs.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Merging pull requests that accidentally delete canonical tags or meta descriptions. Blocked by CI threshold failure.
- **Failure Mode 2**: Performance regressions (e.g. adding unoptimized 3MB hero image) slipping into production.
