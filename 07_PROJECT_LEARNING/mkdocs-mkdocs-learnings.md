# Forensic Learning Dossier: mkdocs/mkdocs

## 1. Metadata & Source Provenance
- **Repository**: [mkdocs/mkdocs](https://github.com/mkdocs/mkdocs)
- **Commit SHA**: `3aa2c65a7d97b988f0d01d413346d0d216fe00cb`
- **License**: BSD 2-Clause License
- **Audit Date**: 2026-10-16
- **Architecture**: Python-based static site generator specialized for developer documentation.

## 2. Core Architectural Mechanisms
1. **Directory URLs & Trailing Slash Hygiene**:
   - Default `use_directory_urls = true` outputs clean paths (`/setup/` with `/setup/index.html`), eliminating `.html` extensions and ensuring clean canonical URLs.
2. **Automated Search Index Generation**:
   - Compiles a complete search index JSON at build time for client-side search, while keeping the raw HTML pages fully static and crawlable.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Trailing slash redirect loops caused by mismatch between web server rules and documentation paths.
