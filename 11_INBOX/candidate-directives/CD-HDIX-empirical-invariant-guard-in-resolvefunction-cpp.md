# Candidate Directive: [CD-HDIX] Empirical Invariant Guard in resolveFunction.cpp

<!-- PROVENANCE_START
{
  "source_repository": "ClickHouse/ClickHouse",
  "source_url": "https://github.com/ClickHouse/ClickHouse",
  "source_version": "67804652",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T14:58:07.929Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-clickhouse-clickhouse",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse) (Revision: `67804652`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T14:58:07.929Z`  
> **Learning ID**: `learn-github-clickhouse-clickhouse`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-17T14:58:07.927Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794927487927",
    "title": "Empirical Invariant Guard in resolveFunction.cpp",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ClickHouse/ClickHouse",
    "source_uri": "https://github.com/ClickHouse/ClickHouse",
    "source_version": "HEAD",
    "content_hash": "53e0d45bbdf7ef0dbe4f4e2cec98953413482115609c4378fbcc4abfa960524b"
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
        "Harvested/verified timestamp recorded: 2026-11-17T14:58:07.927Z"
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
  "auth_token": "dd964327ff83a3214a7cafe66d10bf1e18b215d7eaaccc5cdb53b73520aacdce"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
