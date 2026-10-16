# Forensic Learning Dossier: webhintio/hint

## 1. Metadata & Source Provenance
- **Repository**: [webhintio/hint](https://github.com/webhintio/hint)
- **Commit SHA**: `62bfce68b934aab205bd60beb136112a5bfa1da1`
- **License**: Apache License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: Pluggable linting tool for web development standards, accessibility, security, and SEO.

## 2. Core Architectural Mechanisms
1. **Specialized SEO Validation Hints**:
   - `hint-meta-viewport`: validates that viewport tag exists and does not disable user scaling (`user-scalable=no`).
   - `hint-canonical-url`: verifies that canonical URL is fully-qualified, points to a valid resource, and returns HTTP 200.
   - `hint-meta-charset-utf-8`: checks that charset is declared early in the document.
   - `hint-http-status-codes`: validates that crawled links do not return 4xx or 5xx status codes.
2. **Connector Architecture**:
   - Runs validations against jsdom, puppeteer, or local files, providing flexible linting in CI/CD pipelines.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Disabling mobile zoom (`user-scalable=no`) triggering Google Search Console mobile usability penalties.
- **Failure Mode 2**: Broken or relative canonical tags causing search crawlers to fail canonicalization.
