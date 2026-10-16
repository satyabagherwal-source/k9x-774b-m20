# Forensic Learning Dossier: sitespeedio/sitespeed.io

## 1. Metadata & Source Provenance
- **Repository**: [sitespeedio/sitespeed.io](https://github.com/sitespeedio/sitespeed.io)
- **Commit SHA**: `1b8966c8f498a44b93b482e9dbdf200a4ceb52f1`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Comprehensive web performance audit framework combining Coach, Browsertime, and PageXray.

## 2. Core Architectural Mechanisms
1. **The Coach Best Practice Engine**:
   - Scores web pages across Performance, Accessibility, and Best Practices.
   - Checks for HTTP/2 multiplexing, responsive images, efficient caching headers (`Cache-Control: max-age=31536000, immutable`), and deferred script loading.
2. **PageXray Waterfall Analysis**:
   - Analyzes HTTP request count, asset payload breakdown, and third-party tracker bloat.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Uncached static assets causing repeated slow loads for returning visitors.
- **Failure Mode 2**: Third-party tracker bloat destroying mobile Core Web Vitals and INP scores.
