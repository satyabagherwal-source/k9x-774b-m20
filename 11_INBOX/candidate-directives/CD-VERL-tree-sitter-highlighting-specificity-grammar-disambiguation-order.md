# Candidate Directive: [CD-VERL] Tree-Sitter Highlighting Specificity & Grammar Disambiguation Order

<!-- PROVENANCE_START
{
  "source_repository": "zed-industries/zed",
  "source_url": "https://github.com/zed-industries/zed",
  "source_version": "2f808b3c",
  "license": "NOASSERTION",
  "timestamp": "2026-11-21T02:11:54.369Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zed-industries-zed",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zed-industries/zed](https://github.com/zed-industries/zed) (Revision: `2f808b3c`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-21T02:11:54.369Z`  
> **Learning ID**: `learn-github-zed-industries-zed`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T02:11:54.369Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795227114369",
    "title": "Tree-Sitter Highlighting Specificity & Grammar Disambiguation Order",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zed-industries/zed",
    "source_uri": "https://github.com/zed-industries/zed",
    "source_version": "HEAD",
    "content_hash": "b7833d713b6c615771d4e2cdc72e98321e3fa4a584deba3293cd04e6081bd925"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.6,
      "tier": "TIER_3_COMMUNITY_OPEN",
      "findings": [],
      "details": [
        "Source originates from community open repository",
        "Source version unpinned (HEAD), subject to upstream drift",
        "Cryptographic SHA-256 payload integrity hash present"
      ]
    },
    "evidence_quality": {
      "status": "FAIL",
      "score": 0,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [],
      "details": [
        "Direct empirical evidence ratio: 0% (0/5)",
        "Evidence-to-claim lexical alignment: 0%"
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
        "Harvested/verified timestamp recorded: 2026-11-21T02:11:54.369Z"
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
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "9cf365af4429db544f91fa4474b95486bd8f8ef1796baad377a01991dc979745"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
