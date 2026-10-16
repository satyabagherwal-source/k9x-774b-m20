# Forensic Learning Dossier: rust-lang/mdBook

## 1. Metadata & Source Provenance
- **Repository**: [rust-lang/mdBook](https://github.com/rust-lang/mdBook)
- **Commit SHA**: `83f5e921d70a3c94f57fa96409b30c457313cba1`
- **License**: Mozilla Public License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: The official Rust tool for creating books and technical manuals (powering The Rust Programming Language).

## 2. Core Architectural Mechanisms
1. **Sub-Millisecond Compilation & Zero-JS Fallback**:
   - Generates static HTML books in milliseconds using Handlebars templates.
   - All chapter contents and navigation menus are pre-rendered into the HTML document, ensuring complete crawlability without JavaScript.
2. **Semantic Header IDs**:
   - Automatically generates slugified header anchor IDs (`#my-section`) for deep linking.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: SPA documentation failing to render for low-resource crawlers.
