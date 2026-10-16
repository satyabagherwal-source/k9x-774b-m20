# Forensic Learning Dossier: facebook/docusaurus

## 1. Metadata & Source Provenance
- **Repository**: [facebook/docusaurus](https://github.com/facebook/docusaurus)
- **Commit SHA**: `5fc1be5c0106fa146acfcd2f6b10c7623fa5324c`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Production-grade React static site generator specialized for software documentation and knowledge bases.

## 2. Core Architectural Mechanisms
1. **Built-in Canonical & Multilingual Alternate Invariant**:
   - Automatically computes absolute canonical URLs using `siteConfig.url` and `siteConfig.baseUrl`.
   - When configured with multi-locale i18n, Docusaurus automatically injects reciprocal `<link rel="alternate" hreflang="xx" href="...">` tags for every translated version, including an `x-default` pointer to the primary locale.
2. **Plugin Sitemap Generator (`@docusaurus/plugin-sitemap`)**:
   - Automatically generates `/sitemap.xml` during build time.
   - Provides `ignorePatterns` options to exclude staging documents or unlisted pages.
3. **Structured Head Composition (`htmlTags.ts`)**:
   - Assembles head metadata during static compilation, ensuring OpenGraph, Twitter, and canonical tags are baked into the raw HTML file before serving.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Asymmetrical hreflang declarations across translated doc versions. Defended by centralized i18n cross-link generation.
- **Failure Mode 2**: Relative canonical tags breaking crawler canonicalization. Defended by mandatory `url` validation in Docusaurus config.
