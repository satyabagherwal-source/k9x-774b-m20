# Candidate Directive: [CD-W4MG] MSE literal folding regressions for INT values beyond the INT range, arrays and

<!-- PROVENANCE_START
{
  "source_repository": "apache-pinot-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T08:53:21.516Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-apache-pinot-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache-pinot-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T08:53:21.516Z`  
> **Learning ID**: `LEARN-EVO-apache-pinot-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pinot-query-planner/src/main/java/org/apache/pinot/calcite/rel/rules/PinotEvaluateLiteralRule.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/pinot. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f5641918`: MSE literal folding regressions for INT values beyond the INT range, arrays and timestamp casts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `pinot-query-planner/src/main/java/org/apache/pinot/calcite/rel/rules/PinotEvaluateLiteralRule.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
  private static final BigDecimal MIN_INT = BigDecimal.valueOf(Integer.MIN_VALUE);
  private static final BigDecimal MAX_INT = BigDecimal.valueOf(Integer.MAX_VALUE);
    }
    widenIntArgumentTypes(operands, argumentTypes);
    if (TransformFunctionType.isJsonExtractScalar(canonicalName) && numArguments > 3) {
      argumentTypes[3] =
          RexExpressionUtils.fromJsonExtractScalarDefaultLiteral((RexLiteral) operands.get(3)).getDataType();
    ColumnDataType castTargetType = null;
      castTargetType = RelToPlanNodeConverter.convertToColumnDataType(rexCall.getType());
      arguments[0] = getCastValue(arguments[0], castTargetType);
      arguments[1] = castTargetType.name();
    }
    if (rexCall.getKind() == SqlKind.ARRAY_VALUE_CONSTRUCTOR) {
      keepExactArrayElements(operands, arguments);
  /// Makes the INT arguments of a call LONG if one of them is an integer literal beyond the INT range.
  ///
  /// This rule makes such a literal. Calcite gives INT arithmetic the type INTEGER, but Pinot evaluates it as LONG, so
  /// the literal for `3600000 * 100000` has the type INTEGER and the value 360000000000. A call on that literal (for
  /// example `NOW() - 3600000 * 100000`) m
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
      if (TransformFunctionType.isJsonExtractScalar(canonicalName) && i == 3) {
        argumentTypes[i] = RexExpressionUtils.fromJsonExtractScalarDefaultLiteral((RexLiteral) rexNode).getDataType();
      }
    String castTargetType = null;
      castTargetType = RelToPlanNodeConverter.convertToColumnDataType(rexCall.getType()).name();
      arguments[1] = castTargetType;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f5641918` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:53:21.637Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794992001637",
    "title": "MSE literal folding regressions for INT values beyond the INT range, arrays and",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apache-pinot-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "54dd88ca92fa8753b1fc1b1632e602326e52b17861784e8665713167fe969df0"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:53:21.638Z"
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
  "auth_token": "54ea21a2edb25f7c1e44874e16d531ea8305c5cdfda05400b98cbb53bc9ea304"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
