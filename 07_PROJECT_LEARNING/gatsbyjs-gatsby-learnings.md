# Forensic Learning Dossier: gatsbyjs/gatsby

## 1. Metadata & Source Provenance
- **Repository**: [gatsbyjs/gatsby](https://github.com/gatsbyjs/gatsby)
- **Commit SHA**: `516700a1dca1e982b6d098ab57230b25e0318a1f`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Enterprise React-based static and SSR framework with native Gatsby Head API.

## 2. Core Architectural Mechanisms
1. **Native Gatsby Head API (`export function Head()`)**:
   - Completely replaces runtime `react-helmet` side-effects with a declarative SSR export pattern.
   - Evaluated during page compilation: the return value of `Head()` is rendered directly into the HTML string before static file write.
2. **SSR Meta Tag Deduplication**:
   - Identifies duplicate tags using `name`, `property`, and `id` attributes. Page-level declarations cleanly override template-level defaults without creating duplicate meta rows in the final HTML stream.
3. **Hydration Flickering Elimination**:
   - Emits static head tags on the server so search engine crawlers parsing raw HTML get the full title, canonical, and description without waiting for JavaScript execution. On client mount, Gatsby reconciles without re-rendering the head DOM elements.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Cumulative Layout Shift (CLS) and title flickering caused by client-only React Helmet execution. Solved by compile-time static head injection.
- **Failure Mode 2**: Head elements ending up in `<body>` during SSR compilation. Protected by strict AST document node injection.
