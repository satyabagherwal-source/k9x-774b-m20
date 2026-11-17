# Candidate Directive: [CD-HGOV] Empirical Invariant Guard in resolveFunction.cpp

<!-- PROVENANCE_START
{
  "source_repository": "clickhouse-clickhouse-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T14:58:11.931Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-clickhouse-clickhouse-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [clickhouse-clickhouse-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T14:58:11.931Z`  
> **Learning ID**: `LEARN-EVO-clickhouse-clickhouse-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/Analyzer/Resolve/resolveFunction.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ClickHouse/ClickHouse. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `42a270d5`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/Analyzer/Resolve/resolveFunction.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
/// Returns whether the `rewrite_in_to_join` rewrite of `x IN (subquery)` into
/// `EXISTS (SELECT 1 FROM (subquery) WHERE x = <row> LIMIT 1)` keeps the semantics of regular `IN`: the
/// same result or the same error. The left operand has the type `left_type`, and the subquery has the
/// columns `subquery_columns`. The caller guarantees that `left_type` is not null and that
/// `validateInColumnsCountMatch` accepted both sides.
///
/// Regular `IN` rejects a left operand with dynamic structure before it builds the set. With
/// `transform_null_in = 0`, which the rewrite requires, it returns NULL for a NULL left operand, while
/// `NOT EXISTS` returns 1.
///
/// For any other operand, the set has one key per subquery column. `FunctionIn` compares the whole left
/// operand with the only column of a subquery, even when the operand is a tuple. Otherwise it compares
/// each element of the left tuple with its own column. `Set::execute` converts each key to the type of
/// its column, and a value that the column cannot hold is not a member. For example,
/// `(t, 1) IN (SELECT toFloat64(1767225600), 1)` returns 0 for
/// `t = fromUnixTimestamp64Nano(1767225600000000001, 'UTC')` because
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
    /// `has` treats tuple values with equal `NULL` elements as a match, while `IN`
    /// with `transform_null_in = 0` skips such tuple values. Guard tuple LHS
    /// elements to preserve `IN` semantics in the row-wise rewrite.
    if (const auto * tuple_type = typeid_cast<const DataTypeTuple *>(removeNullable(element_arg->getResultType()).get());
        tuple_type && !tuple_type->getElements().empty())
            makeTupleHasNoNullElementsPredicate(element_arg, tuple_type->getElements().size()),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `42a270d5` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T14:58:12.027Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794927492027",
    "title": "Empirical Invariant Guard in resolveFunction.cpp",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "clickhouse-clickhouse-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "53e0d45bbdf7ef0dbe4f4e2cec98953413482115609c4378fbcc4abfa960524b"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T14:58:12.028Z"
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
  "auth_token": "5aa34766ff85b225222de8e6ca948ebae813c18312e9798ed773d7ee8dc3f8e0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
