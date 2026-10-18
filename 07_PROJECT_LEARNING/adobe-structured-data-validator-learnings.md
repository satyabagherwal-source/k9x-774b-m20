# Adobe Structured Data Validator — Forensic Learning Dossier

**Repository**: `https://github.com/adobe/structured-data-validator`
**Harvest Date**: 2026-10-18
**Ecosystem**: Node.js / JavaScript
**Domain**: Schema.org & Google Rich Results Validation Engine

## 1. Architectural Overview
Adobe's Structured Data Validator is a comprehensive validation engine designed to enforce Schema.org semantics, Google Search Rich Result requirements, and Adobe internal metadata governance. It provides a modular test harness capable of evaluating JSON-LD documents against strict type definitions, required and recommended properties, and custom business rules.

## 2. Key Code Evidence & Implementation Patterns
- **Rule Engine Architecture**: Rules are structured into standalone validators matching specific Schema.org types (`Article`, `Product`, `AggregateRating`, `3DModel`, etc.).
- **Rich Result Verification**: Enforces Google Rich Result requirements (e.g. `AggregateRating` requires `itemReviewed`, valid `ratingValue`, and either `reviewCount` or `ratingCount`).
- **Range & Value Boundary Checks**: Validates numeric boundaries (e.g. `ratingValue` must be between `worstRating` and `bestRating`, defaulting to 1..5).

## 3. Negative Constraints & Failure Modes
- **Anti-Pattern**: Validating schema types without checking parent inheritance. If a rule requires `CreativeWork`, rejecting an `Article` or `BlogPosting` causes false validation failures.
- **Silent Failures**: Allowing negative review counts or inverted rating scales without explicit `worstRating`/`bestRating` metadata.

## 4. Reusable Intelligence Promoted
- Contributed to **Rule 1622**: Schema.org Type Inheritance, Subclass Expansion & Primitive Coercion Invariant.
