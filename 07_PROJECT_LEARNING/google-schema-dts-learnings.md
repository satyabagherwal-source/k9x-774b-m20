# Forensic Learning Dossier: google/schema-dts

## 1. Metadata & Source Provenance
- **Repository**: [google/schema-dts](https://github.com/google/schema-dts)
- **Commit SHA**: `037adca1f0f135e840a12cf692d9669528d227f4`
- **License**: Apache License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: Complete, strongly-typed TypeScript definitions for JSON-LD and Schema.org entities.

## 2. Core Architectural Mechanisms
1. **WithContext & Graph Union Types**:
   - Exports `WithContext<Thing>` and `Graph` types.
   - Enforces valid `@context` and typed `@graph` arrays in modern full-stack TypeScript applications.
2. **Strict Property Validation**:
   - Eliminates spelling typos in schema properties (e.g. catching `datePublish` instead of `datePublished`) at build time before deployment.
3. **Node Reference Typings**:
   - Supports referencing other entities via `{"@id": "..."}` pointers with full compiler validation.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Malformed JSON-LD slipping into production and causing Google Rich Results invalid syntax errors. Caught at compile time.
- **Failure Mode 2**: Missing mandatory fields on rich snippets. Enforced by TypeScript interface constraints.
