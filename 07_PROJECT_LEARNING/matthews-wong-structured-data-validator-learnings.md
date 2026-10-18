# Matthews Wong Structured Data Validator — Forensic Learning Dossier

**Repository**: `https://github.com/matthews-wong/structured-data-validator`
**Harvest Date**: 2026-10-18
**Ecosystem**: Python
**Domain**: Multi-Format (JSON-LD & Microdata) Extraction & Tiered Validation

## 1. Architectural Overview
A lightweight Python library and CLI tool providing dual extraction of JSON-LD scripts and HTML Microdata attributes (`itemscope`, `itemtype`, `itemprop`). It separates validation rules into mandatory required properties vs recommended properties, generating structured findings with severity levels (`error`, `warning`, `info`).

## 2. Key Code Evidence & Implementation Patterns
- **Context Decoupling (`sdvalidator/validate.py`)**:
  ```python
  def _validate_context(node: StructuredNode, findings: list[Finding]) -> None:
      if node.source_format != "json-ld":
          return
      # Microdata never carries @context; checking it flags every item as an error.
  ```
- **Property Value Verification**: `_has_value` checks for non-empty lists, non-empty dictionaries, and non-whitespace strings to prevent ghost elements from passing presence assertions.
- **Uniform Iteration Coercion**: `_as_list(value)` wraps singletons in lists, enabling identical validation code for scalar and array-valued properties.

## 3. Negative Constraints
- Never check `@context` on HTML Microdata nodes.
- Do not treat empty strings (`""`) or empty arrays (`[]`) as satisfying required property checks.

## 4. Reusable Intelligence Promoted
- Contributed to **Rule 1626**: Dual-Format Structured Data Extraction & Context Decoupling Invariant.
