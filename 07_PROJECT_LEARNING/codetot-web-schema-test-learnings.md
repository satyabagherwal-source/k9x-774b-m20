> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/codetot-web-schema-test-learnings.md`  
> **Source**: github (https://github.com/codetot-web/schema-test)  
> **Source Version**: `f395034cc2`  
> **License**: Apache-2.0  
> **Synthesized By**: Antigravity Deep Forensic Harvester  
> **Timestamp**: 2026-10-18T05:45:00.000Z  
> **Learning ID**: `learn-github-codetot-web-schema-test`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record: codetot-web/schema-test

## 1. Executive Forensic Architecture & System Mechanics
TypeScript Schema.org validator tested against Google SDTT accuracy benchmarks with 21 Vitest suites.

### Key Architectural Innovations:
1. **In-Memory @id Cross-Reference Resolution Graph (`src/validate/entity-builder.ts`)**:
   - Resolves entities split across multiple JSON-LD script blocks or Microdata scopes using in-memory @id indexes before running property assertions.
   - Prevents false-negative validation errors on decoupled component architectures.

## 2. Promoted Master Brain Rules
- **Rule 1615**: Multi-Pass @id In-Memory Graph Assembly for Decoupled Schema.org Validation.