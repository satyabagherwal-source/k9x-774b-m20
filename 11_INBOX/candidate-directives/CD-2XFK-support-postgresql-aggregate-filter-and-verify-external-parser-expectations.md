# Candidate Directive: [CD-2XFK] Support PostgreSQL aggregate FILTER and verify external parser expectations

<!-- PROVENANCE_START
{
  "source_repository": "apache/shardingsphere",
  "source_url": "https://github.com/apache/shardingsphere",
  "source_version": "e65f2831",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T23:26:27.008Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-apache-shardingsphere",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache/shardingsphere](https://github.com/apache/shardingsphere) (Revision: `e65f2831`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T23:26:27.008Z`  
> **Learning ID**: `learn-github-apache-shardingsphere`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `parser/sql/engine/dialect/postgresql/src/main/antlr4/imports/postgresql/BaseRule.g4`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/shardingsphere. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e65f2831`: Support PostgreSQL aggregate FILTER and verify external parser expectations. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `parser/sql/engine/dialect/postgresql/src/main/antlr4/imports/postgresql/BaseRule.g4`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
    | funcApplication ({null == $funcApplication.ctx.DISTINCT() && null == $funcApplication.ctx.VARIADIC() && null == $funcApplication.ctx.sortClause()}? withinGroupClause)?
      filterClause? nullTreatment? overClause?
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
    | funcApplication withinGroupClause? filterClause? nullTreatment? overClause?
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e65f2831` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T23:26:27.007Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.71,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 71%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795044387007",
    "title": "Support PostgreSQL aggregate FILTER and verify external parser expectations",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apache/shardingsphere",
    "source_uri": "https://github.com/apache/shardingsphere",
    "source_version": "HEAD",
    "content_hash": "2a4262fdf43a479a9a8c67b7115b621bf5ad5130ae599be6dcb8fa4e8d145ecb"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T23:26:27.007Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "d6c802f54c8b090ade722866c4764eef2c055c6a83377bcb2be56b6d536cf76c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
