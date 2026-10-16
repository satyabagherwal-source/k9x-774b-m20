# Forensic Learning Record: spatie/schema-org

> **Canonical Artifact**: `07_PROJECT_LEARNING/spatie-schema-org-learnings.md`  
> **Source Repository**: [https://github.com/spatie/schema-org.git](https://github.com/spatie/schema-org)  
> **Commit Hash**: `85af98461b7e899a8f5fd745331fac6ae5c745d9`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: PHP 8.1+, Schema.org Specification Generator, Type-Safe AST  

---

## 1. Project Context & Architectural Mission

`spatie/schema-org` is the most comprehensive, fluent, type-safe Schema.org builder in the PHP ecosystem. It generates 800+ Schema.org types and thousands of properties with IDE auto-completion, strict typing, and full support for interconnected `Graph` structures.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: The Fluent `Graph` Interconnection Architecture
- In `src/Graph.php`:
  - Implements a central `Graph` builder that links multiple Schema.org types into a unified `@graph` array.
  - Allows assigning unique identifier strings (e.g. `https://example.com/#org`) to nodes and linking dependent entities together.
  - Eliminates syntax errors and invalid property names at compile-time via strict PHP method signatures.

### D2: XSS-Safe JSON-LD Serialization
- Implements `RendersScript` concern using `json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)`.
- Sanitizes dangerous closing tags (`</script>`) inside JSON-LD string literals to prevent stored Cross-Site Scripting (XSS) attacks in search snippets.
