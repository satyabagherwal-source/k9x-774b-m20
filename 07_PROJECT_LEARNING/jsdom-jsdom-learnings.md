# Forensic Learning Dossier: jsdom/jsdom

## 1. Metadata & Source Provenance
- **Repository**: [jsdom/jsdom](https://github.com/jsdom/jsdom)
- **Commit SHA**: `992a0134b726487e38708c028e3da39ca3a4ee7e`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Complete JavaScript implementation of W3C DOM and HTML standards for Node.js.

## 2. Core Architectural Mechanisms
1. **Full DOM Lifecycle Emulation**:
   - Supports `document.head`, `document.body`, event dispatching, and script execution (`runScripts: "dangerously"`).
   - Enables unit testing of SEO meta managers (like Unhead and React Helmet) inside CI/CD test runners.
2. **Resource Loading Controls**:
   - Allows fine-grained control over whether images, stylesheets, or subresources are fetched during audits.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Node.js tests failing due to missing `window` or `document` globals.
- **Failure Mode 2**: Memory leaks from uncleared DOM window references in continuous test runners.
