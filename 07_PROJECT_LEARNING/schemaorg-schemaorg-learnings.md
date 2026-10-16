# Forensic Learning Dossier: schemaorg/schemaorg

## 1. Metadata & Source Provenance
- **Repository**: [schemaorg/schemaorg](https://github.com/schemaorg/schemaorg)
- **Commit SHA**: `6f38a9ab7f7480a424e4d58aa89c623c2a0bf209`
- **License**: W3C Software and Document Notice and License
- **Audit Date**: 2026-10-16
- **Architecture**: The authoritative open standard vocabulary for structured data schemas across search engines (Google, Microsoft, Yahoo, Yandex).

## 2. Core Architectural Mechanisms
1. **Type & Property Inheritance Hierarchy**:
   - Rooted at `Thing`. Subtypes inherit all parent properties (e.g. `Article` inherits from `CreativeWork` -> `Thing`, inheriting `name`, `url`, `image`, `author`).
   - Standardizes property ranges and expected data types (e.g. `author` accepts `Person` or `Organization`).
2. **Context Declaration Protocol**:
   - Requires `"@context": "https://schema.org"`. Emitting HTTP instead of HTTPS is deprecated.
3. **Graph Composition Semantics**:
   - Formal specification of `@graph`, allowing multiple disjoint entities to form an interconnected knowledge model through deterministic `@id` URI references.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Invalid property types (e.g. passing a plain string to a property expecting a nested entity type like `Person`). Solved by adhering to rangeIncludes definitions.
- **Failure Mode 2**: Deprecated vocabulary terms causing Google Rich Results Test validation warnings.
