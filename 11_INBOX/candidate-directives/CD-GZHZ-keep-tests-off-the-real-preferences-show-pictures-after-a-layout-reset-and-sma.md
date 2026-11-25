# Candidate Directive: [CD-GZHZ] keep tests off the real preferences, show pictures after a layout reset, and sma

<!-- PROVENANCE_START
{
  "source_repository": "thaw-app-thaw-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T03:59:20.627Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-thaw-app-thaw-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [thaw-app-thaw-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T03:59:20.627Z`  
> **Learning ID**: `LEARN-EVO-thaw-app-thaw-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.swiftlint.baseline`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in thaw-app/Thaw. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d09f6a70`: keep tests off the real preferences, show pictures after a layout reset, and small cleanups. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.swiftlint.baseline`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
   "reason": "Class body should span 350 lines or less excluding comments and whitespace: currently spans 390 lines",
    "line": 523
   "reason": "File should contain 400 lines or less: currently contains 527",
    "line": 580
   "reason": "Function body should span 100 lines or less excluding comments and whitespace: currently spans 216 lines",
   "ruleDescription": "Function bodies should not span too many lines",
   "ruleIdentifier": "function_body_length",
   "ruleName": "Function Body Length",
   "reason": "Function should have complexity 10 or less; currently complexity is 33",
   "ruleDescription": "Complexity of function bodies should be limited.",
   "ruleIdentifier": "cyclomatic_complexity",
   "ruleName": "Cyclomatic Complexity",
    "line": 941
   "reason": "File should contain 400 lines or less: currently contains 941",
    "line": 808
    "line": 912
   "reason": "File should contain 400 lines or less: currently contains 912",
    "line": 1437
   "reason": "Function should have complexity 10 or less; currently complexity is 27",
    "line
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
   "reason": "Class body should span 350 lines or less excluding comments and whitespace: currently spans 396 lines",
    "line": 534
   "reason": "File should contain 400 lines or less: currently contains 534",
    "line": 583
   "reason": "Function should have complexity 10 or less; currently complexity is 33",
   "ruleDescription": "Complexity of function bodies should be limited.",
   "ruleIdentifier": "cyclomatic_complexity",
   "ruleName": "Cyclomatic Complexity",
   "reason": "Function body should span 100 lines or less excluding comments and whitespace: currently spans 222 lines",
   "ruleDescription": "Function bodies should not span too many lines",
   "ruleIdentifier": "function_body_length",

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T03:59:20.757Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795579160757",
    "title": "keep tests off the real preferences, show pictures after a layout reset, and sma",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "thaw-app-thaw-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "879f5f6f84ace8503fbe97bdcd149c72f3231ed20462aed30ad7e8a0f801a300"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-25T03:59:20.758Z"
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
  "auth_token": "d0b01be5337bf240d7b6c72189abb60e65e808ce2b375f55d4924b4e72847227"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
