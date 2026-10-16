# Forensic Learning Dossier: harlan-zw/nuxt-schema-org

## 1. Metadata & Source Provenance
- **Repository**: [harlan-zw/nuxt-schema-org](https://github.com/harlan-zw/nuxt-schema-org) (canonical repo for Nuxt Schema.org)
- **Commit SHA**: `705e816e73a8c37b6b2cc17f767b43e946ae810b`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Reactive Schema.org JSON-LD graph builder integrated with Vue reactivity and Unhead SSR serialization.

## 2. Core Architectural Mechanisms
1. **Composable Schema Primitives**:
   - Provides strongly-typed composables: `useSchemaOrg([defineWebSite(), defineWebPage(), defineArticle(), defineBreadcrumb()])`.
2. **Deterministic `@id` Anchoring**:
   - Automatically computes absolute URIs: `siteUrl + '#website'`, `siteUrl + '#organization'`, `pageUrl + '#webpage'`, `pageUrl + '#article'`.
   - Interlinks entities via `idReference` so that Google's Knowledge Graph extracts complete entity trees.
3. **Deduplication & Node Merging**:
   - If multiple Vue components call `defineWebPage()` or `defineBreadcrumb()`, the module merges properties rather than outputting conflicting or redundant schema blocks.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Disconnected Schema islands. Standalone schemas that fail to tell search engines which organization published which article.
- **Failure Mode 2**: Circular references in reactive Vue objects causing `JSON.stringify()` crashes during SSR. Solved with schema normalization visitor pass.
