> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/iaincollins-structured-data-testing-tool-learnings.md`  
> **Source**: github (https://github.com/iaincollins/structured-data-testing-tool)  
> **Source Version**: `8300079044`  
> **License**: MIT  
> **Synthesized By**: Antigravity Deep Forensic Harvester  
> **Timestamp**: 2026-10-18T05:45:00.000Z  
> **Learning ID**: `learn-github-iaincollins-structured-data-testing-tool`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record: iaincollins/structured-data-testing-tool

## 1. Executive Forensic Architecture & System Mechanics
Zero-dependency structured data testing CLI and library validating JSON-LD, Microdata, and RDFa against Schema.org specifications.
- **Multi-Format Extraction**: Unified parsing across `<script type="application/ld+json">`, Microdata `itemscope` attributes, and RDFa `typeof` tags.
- **Custom Schema Assertions**: Presets allowing automated assertion testing (e.g., verifying mandatory fields for Article, Organization, Product).
- **Bug Fixes**:
  - Commit `be1bd09`: Fix schema property scope bug across nested item scopes.
  - Commit `b0e1ed5`: Fix bug with boolean attributes evaluated as false.

## 2. Promoted Master Brain Rules
- **Rule 1615**: Multi-Pass @id In-Memory Graph Assembly for Decoupled Schema.org Validation.