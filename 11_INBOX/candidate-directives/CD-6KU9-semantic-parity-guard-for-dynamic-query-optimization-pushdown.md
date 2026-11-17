# Candidate Directive: [CD-6KU9] Semantic Parity Guard for Dynamic Query Optimization Pushdown

<!-- PROVENANCE_START
{
  "source_repository": "trinodb-trino-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:45:49.058Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-trinodb-trino-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trinodb-trino-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:45:49.058Z`  
> **Learning ID**: `LEARN-EVO-trinodb-trino-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Optimizers MUST NOT convert or push down three-valued logic expressions (e.g., `IS NOT DISTINCT FROM`) into two-valued equality expressions (e.g., `=` or dynamic filters operating under standard equivalence) if the underlying domain type allows self-inequality (e.g., IEEE 754 `NaN`) or nested nullability (structural types: `ROW`, `ARRAY`, `MAP`).

**WHY**:
In standard SQL, dynamic filters operate via strict equivalence (`=`). Under strict equivalence, `NaN = NaN` is FALSE, and nested structural types containing nulls (e.g., `ROW(NULL) = ROW(NULL)`) evaluate to UNKNOWN/FALSE. Conversely, `IS NOT DISTINCT FROM` treats `NULL` as identical to `NULL` and `NaN` as identical to `NaN`. Mapping `IS NOT DISTINCT FROM` to dynamic filters without verifying type determinism silently prunes valid tuples from the probe side of joins, generating silent data corruption.

**WHEN TO APPLY**:
Query planners, predicate pushdown engines, distributed join optimizers, and expression rewriters targeting IEEE floating point types (`FLOAT`, `DOUBLE`), structural composite types (`STRUCT`/`ROW`, `ARRAY`, `MAP`), or variant/JSON types.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Production-grade pattern from io.trino.sql.planner.optimizations.PredicatePushDown
private boolean joinDynamicFilteringExpression(Expression expression, Collection<Symbol> rightSymbols)
{
    // ...
    if (operator == IDENTICAL) { // IS NOT DISTINCT FROM
        // Dynamic filters follow '=' semantics:
        // NaN is not collected, and structural values containing nulls or NaN do not match themselves.
        // Therefore, disallow dynamic filter generation if types can fail self-equality.
        if (mayBeUnequalToItself(left.type()) || mayBeUnequalToItself(right.type())) {
            return false;
        }
    }
    // ...
}

private static boolean mayBeUnequalToItself(Type type)
{
    return typeHasNaN(type) || isStructural(type);
}
```

**NEGATIVE CONSTRAINT**:
```java
// ANTI-PATTERN: Incomplete type check omitting structural composites
if (operator == IDENTICAL) {
    // Fails to check ARRAY, MAP, ROW types that contain NULL or NaN inside elements!
    if (left.type().equals(REAL) || right.type().equals(REAL) || 
        left.type().equals(DOUBLE) || right.type().equals(DOUBLE)) {
        return false;
    }
    // Generates dynamic filter for ROW(NULL), dropping valid join matches!
}
```

**VERIFICATION METHOD**:
Execute join queries across composite types containing nulls (`ROW(NULL)`) and `NaN` (`ARRAY[nan()]`) under both dynamic filtering enabled and disabled sessions:
`SELECT count(*) FROM t1 WHERE col IS NOT DISTINCT FROM (SELECT col FROM t2 WHERE id = 3)`. Assert query results match bit-for-bit.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:45:49.185Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794905149185",
    "title": "Semantic Parity Guard for Dynamic Query Optimization Pushdown",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trinodb-trino-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "990c64c0e7d72ef3575461f8195f36e20d1d2450d03a701895ba5a20aa6949f8"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:45:49.185Z"
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
  "auth_token": "0dd339ef1efd062c311427233a486cd4d7eed9ce5b13879265dc027a246fbee1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
