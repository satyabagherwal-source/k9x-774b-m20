# a4csi Schema Org Validate — Forensic Learning Dossier

**Repository**: `https://github.com/a4csi/schema-org-validate`
**Harvest Date**: 2026-10-18
**Ecosystem**: Node.js / JavaScript
**Domain**: Precompiled Subclass Hierarchy & Property Range Verification

## 1. Architectural Overview
An offline Schema.org validation engine that utilizes pre-generated static JSON maps (`subclassMap.json` and `typeMap.json`) derived directly from Schema.org vocabulary definitions. It evaluates polymorphic entity types against property ranges without network lookups.

## 2. Key Code Evidence & Implementation Patterns
- **Subclass Hierarchy Resolution (`lib/SchemaOrgValidator.js`)**:
  ```javascript
  getAllSuperClasses(type) {
    const supers = [];
    let current = type;
    while (subclassMap[current]) {
      current = subclassMap[current];
      supers.push(current);
    }
    return supers;
  }
  isTypeOrSubtype(actualType, expectedTypes) {
    if (expectedTypes.includes(actualType)) return true;
    const supers = this.getAllSuperClasses(actualType);
    return expectedTypes.some(t => supers.includes(t));
  }
  ```
- **ISO 8601 Duration & URL Pattern Matching**:
  Regex `^P(T(\d+H)?(\d+M)?(\d+S)?)?$` ensures `Duration` strings adhere strictly to standard format before validation.

## 3. Negative Constraints
- Never assume an object matches only its immediate `@type`. Polymorphic assertions must check the entire inheritance chain up to `Thing`.
- Avoid runtime HTTP fetching of Schema.org RDF files; compile them into static lookup maps at build time.

## 4. Reusable Intelligence Promoted
- Contributed to **Rule 1622**: Schema.org Type Inheritance, Subclass Expansion & Primitive Coercion Invariant.
