# Candidate Directive: [CD-SR8F] MSE literal folding regressions for INT values beyond the INT range, arrays and

<!-- PROVENANCE_START
{
  "source_repository": "apache/pinot",
  "source_url": "https://github.com/apache/pinot",
  "source_version": "05c81927",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T08:50:44.319Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-apache-pinot",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache/pinot](https://github.com/apache/pinot) (Revision: `05c81927`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T08:50:44.319Z`  
> **Learning ID**: `learn-github-apache-pinot`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-18T08:50:44.317Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.71,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 71%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794991844317",
    "title": "MSE literal folding regressions for INT values beyond the INT range, arrays and",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apache/pinot",
    "source_uri": "https://github.com/apache/pinot",
    "source_version": "HEAD",
    "content_hash": "54dd88ca92fa8753b1fc1b1632e602326e52b17861784e8665713167fe969df0"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.75,
      "tier": "TIER_2_OFFICIAL_ECOSYSTEM",
      "findings": [],
      "details": [
        "Source belongs to recognized official ecosystem (TIER_2_OFFICIAL_ECOSYSTEM)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:50:44.317Z"
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
  "auth_token": "53257e4dbd3b04c3458fd88c89ec2705370c836293a90c8a68008e1ae46cf9c4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
