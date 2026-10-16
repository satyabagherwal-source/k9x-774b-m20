# Forensic Learning Dossier: puppeteer/puppeteer

## 1. Metadata & Source Provenance
- **Repository**: [puppeteer/puppeteer](https://github.com/puppeteer/puppeteer)
- **Commit SHA**: `38b931dcbbff4ec417fae44ebae5a60037f5d606`
- **License**: Apache License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: Google Chrome team's official Node.js library for headless browser automation and rendering diagnostics.

## 2. Core Architectural Mechanisms
1. **Mobile-First Indexing Emulation**:
   - Provides exact device descriptors: `puppeteer.devices['Pixel 5']`.
   - Emulates mobile viewports, touch events, and user-agent strings matching Googlebot Smartphone.
2. **Performance Metrics Extraction**:
   - Accesses Chrome DevTools Protocol (`page.metrics()`, `page.evaluate('performance.getEntriesByType("navigation")')`) to capture exact server TTFB and paint timings.
3. **Raw vs Rendered DOM Diffing**:
   - Enables auditing differences between server-sent HTML (`page.content()`) and fully hydrated client DOM to detect hydration drop-offs.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Testing desktop-only layouts when Googlebot uses smartphone user-agents. Solved by device emulation.
- **Failure Mode 2**: Ghost script execution hanging audit runs. Defended by explicit navigation timeouts.
