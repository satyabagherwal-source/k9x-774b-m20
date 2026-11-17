# Candidate Directive: [CD-3RKV] Semantic Parity Guard for Dynamic Query Optimization Pushdown

<!-- PROVENANCE_START
{
  "source_repository": "trinodb/trino",
  "source_url": "https://github.com/trinodb/trino",
  "source_version": "d97ac24e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T08:43:37.951Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-trinodb-trino",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trinodb/trino](https://github.com/trinodb/trino) (Revision: `d97ac24e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T08:43:37.951Z`  
> **Learning ID**: `learn-github-trinodb-trino`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:43:37.951Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794905017951",
    "title": "Semantic Parity Guard for Dynamic Query Optimization Pushdown",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trinodb/trino",
    "source_uri": "https://github.com/trinodb/trino",
    "source_version": "HEAD",
    "content_hash": "8e554b4597789e8d56dcb94142d8f8352e6030c29aec19a46f60453f8060eda4"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:43:37.951Z"
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
  "auth_token": "788fdb40e04a6e24a07f5135f4675ec780b39fd913ed91ef6c9184abfa2ed810"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
