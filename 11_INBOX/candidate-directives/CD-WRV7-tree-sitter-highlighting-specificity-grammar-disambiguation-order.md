# Candidate Directive: [CD-WRV7] Tree-Sitter Highlighting Specificity & Grammar Disambiguation Order

<!-- PROVENANCE_START
{
  "source_repository": "zed-industries-zed-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T02:12:57.923Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zed-industries-zed-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zed-industries-zed-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T02:12:57.923Z`  
> **Learning ID**: `LEARN-EVO-zed-industries-zed-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Syntax highlight query patterns (`highlights.scm`) MUST match the most specific AST node types and MUST place keyword/unary operator fallback tokens *below* compound type identifiers, or explicitly constrain overlapping tokens with structural parent nodes. Broad wrapper nodes (such as `(type_annotation)` or `(arrow_function)`) MUST NOT capture entire spans containing nested punctuation, trivia, or sub-expressions.

**WHY**:
Tree-sitter resolves capture matches according to pattern order and specificity. When an operator token (e.g., `void` in JavaScript/TypeScript) operates as both an expression keyword (`void 0`) and a predefined primitive type (`(): void`), placing `["void"] @keyword` without parent-type qualification forces type annotations to be highlighted as control keywords. Furthermore, capturing full compound rules like `(type_annotation) @type` colors whitespace, colons, and delimiters, stripping syntax themes of structural granularity and corrupting semantic diff engines.

**WHEN TO APPLY**:
Tree-sitter grammar integrations, custom syntax highlighting definitions, language server semantic token mappings, and AST-driven code manipulation engines.

**VERIFIED IMPLEMENTATION PATTERN**:
```scheme
;; Extracted and generalized from crates/grammars/src/typescript/highlights.scm

; Specific type identifiers only (DO NOT highlight the full type_annotation wrapper)
(type_identifier) @type
(predefined_type) @type.builtin
(this_type) @type.builtin

; Unary operator vs predefined type disambiguation
; `void` is both a unary operator keyword and a predefined type.
; Explicitly constrain `void` within (predefined_type) to override the general keyword capture.
(predefined_type
  "void" @type.builtin)

; General keyword fallback list placed downstream
[
  "const"
  "let"
  "var"
  "with"
  "void"
] @keyword
```

**NEGATIVE CONSTRAINT**:
```scheme
;; ANTI-PATTERN: Greedy wrapper matching captures delimiters, colons, and whitespace
(type_annotation) @type
(arrow_function) @function

;; ANTI-PATTERN: Unqualified keywords override valid AST typing context
"void" @keyword
(predefined_type) @type.builtin
```

**VERIFICATION METHOD**:
Construct an integration test asserting highlight byte ranges over a multi-token string:
`class B { add(): this { return this; } }\nfunction log(): void { void 0; }`
Assert that range `[17..21]` (`this` return type) matches `type.builtin`, range `[57..61]` (`void` return type) matches `type.builtin`, and range `[64..68]` (`void 0` operator) matches `keyword`.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T02:12:58.002Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795227178002",
    "title": "Tree-Sitter Highlighting Specificity & Grammar Disambiguation Order",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zed-industries-zed-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "19a4d747909c45d41823d4a5acf5b62a456a5afba5c1b3309ca69021c57e97cd"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
      ]
    },
    "technical_correctness": {
      "status": "PASS",
      "score": 1,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": false,
      "opposing_rule": null,
      "unsupported_assumptions": [],
      "findings": [],
      "details": [
        "No direct opposition with canonical operating directives",
        "Substantive technical content verified (> 40 chars)"
      ]
    },
    "reusability": {
      "status": "PASS",
      "score": 1,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
        "Expresses generalized engineering invariants (2 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 1,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)",
        "Includes explicit negative example / anti-pattern contrast"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-21T02:12:58.002Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "PASS",
      "score": 1,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": false,
      "conflicting_rule": null,
      "findings": [],
      "details": []
    }
  },
  "detected_contradictions": [],
  "missing_information": [
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "d9d7150e911f1897dd70c626570273402a198d55a8f5679cdd23c4034b07ad3d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
