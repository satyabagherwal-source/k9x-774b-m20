# Forensic Learning Dossier: addyosmani/critical

## 1. Metadata & Source Provenance
- **Repository**: [addyosmani/critical](https://github.com/addyosmani/critical)
- **Commit SHA**: `83f5a54db5e6b12f689f2a009c95ebfaebc03e8a`
- **License**: Apache License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: Automated utility by Addy Osmani extracting and inlining above-the-fold critical CSS.

## 2. Core Architectural Mechanisms
1. **Above-the-Fold Style Extraction**:
   - Evaluates the DOM at standard mobile and desktop viewports (e.g. 1300x900 and 375x667).
   - Extracts only the CSS rules matching elements visible in the initial viewport.
2. **HTML Stream Inlining & Deferment**:
   - Inlines the extracted critical CSS into an early `<style>` block in the HTML `<head>`.
   - Modifies external stylesheets to load asynchronously via `<link rel="preload" as="style" onload="this.rel='stylesheet'">`.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Large external stylesheets (e.g. 300KB) blocking initial render, degrading First Contentful Paint (FCP) and LCP.
- **Failure Mode 2**: Flash of Unstyled Content (FOUC) caused by naive async stylesheet loading.
