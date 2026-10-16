# Forensic Learning Dossier: google/structured-data-testing-tool

## 1. Metadata & Source Provenance
- **Repository**: [google/structured-data-testing-tool](https://github.com/google/structured-data-testing-tool)
- **Commit SHA**: `839218204b77f309a6332da12b9195ba2870bb19`
- **License**: Apache License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: Automated testing utilities validating JSON-LD and microdata against Google Rich Results standards.

## 2. Core Architectural Mechanisms
1. **Automated Schema Assertion API**:
   - Ingests HTML or raw JSON-LD and asserts the existence of required fields for Google Search Rich Results (Article, Product, BreadcrumbList, FAQPage).
2. **Error Taxonomy Categorization**:
   - Differentiates between fatal syntax errors (unparseable JSON, unclosed brackets) and semantic warnings (missing optional recommendation fields).

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Silent regression in rich snippet eligibility following CMS updates. Defended by automated CI/CD schema assertions.
- **Failure Mode 2**: Unescaped quotes inside schema strings breaking JSON parser. Caught before production release.
