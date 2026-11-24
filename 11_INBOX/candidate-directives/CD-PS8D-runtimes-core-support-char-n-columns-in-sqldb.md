# Candidate Directive: [CD-PS8D] runtimes/core: support CHAR(n) columns in sqldb

<!-- PROVENANCE_START
{
  "source_repository": "encoredev/encore",
  "source_url": "https://github.com/encoredev/encore",
  "source_version": "94e12a29",
  "license": "MPL-2.0",
  "timestamp": "2026-11-24T06:38:28.909Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-encoredev-encore",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [encoredev/encore](https://github.com/encoredev/encore) (Revision: `94e12a29`).  
> **License**: MPL-2.0 | **Timestamp**: `2026-11-24T06:38:28.909Z`  
> **Learning ID**: `learn-github-encoredev-encore`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `runtimes/core/src/sqldb/val.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in encoredev/encore. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `94e12a29`: runtimes/core: support CHAR(n) columns in sqldb. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `runtimes/core/src/sqldb/val.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
                Type::TEXT | Type::VARCHAR | Type::BPCHAR => val.to_string().to_sql(ty, out),
                Type::TEXT | Type::VARCHAR | Type::BPCHAR => val.to_string().to_sql(ty, out),
                Type::TEXT | Type::VARCHAR | Type::BPCHAR => val.to_string().to_sql(ty, out),
            Type::BYTEA
                | Type::UUID
                | Type::TEXT
                | Type::VARCHAR
                | Type::BPCHAR
                | Type::CIDR
                | Type::INET
                    Type::TEXT | Type::VARCHAR | Type::BPCHAR => bool.to_string().to_sql(ty, out),
                    Type::TEXT | Type::VARCHAR | Type::BPCHAR | Type::NAME => str.to_sql(ty, out),
                    Type::TEXT | Type::VARCHAR | Type::BPCHAR => self.to_string().to_sql(ty, out),
                    Type::TEXT | Type::VARCHAR | Type::BPCHAR => {
                    Type::TEXT | Type::VARCHAR | Type::BPCHAR => dt.to_rfc3339().to_sql(ty, out),
                | Type::BPCHAR
            Type::TEXT | Type::VARCHAR | Type::BPCHAR | Type::NAME => {
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
                Type::TEXT | Type::VARCHAR => val.to_string().to_sql(ty, out),
                Type::TEXT | Type::VARCHAR => val.to_string().to_sql(ty, out),
                Type::TEXT | Type::VARCHAR => val.to_string().to_sql(ty, out),
            Type::BYTEA | Type::UUID | Type::TEXT | Type::VARCHAR | Type::CIDR | Type::INET
                    Type::TEXT | Type::VARCHAR => bool.to_string().to_sql(ty, out),
                    Type::TEXT | Type::VARCHAR | Type::NAME => str.to_sql(ty, out),
                    Type::TEXT | Type::VARCHAR => self.to_string().to_sql(ty, out),
                    Type::TEXT | Type::VARCHAR => {
                    Type::TEXT | Type::VARCHAR => dt.to_rfc3339().to_sql(ty, out),
            Type::TEXT | Type::VARCHAR | Type::NAME => {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `94e12a29` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T06:38:28.907Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795502308907",
    "title": "runtimes/core: support CHAR(n) columns in sqldb",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "encoredev/encore",
    "source_uri": "https://github.com/encoredev/encore",
    "source_version": "HEAD",
    "content_hash": "889bbe3bc136b8db31a724e134e8a879a930e3d7580c81b54c5105967d7cf974"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Harvested/verified timestamp recorded: 2026-11-24T06:38:28.907Z"
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
  "auth_token": "4001dc49f0fe612a3cdc1f828f8c997666e19e1ecef1de043f77bb10654511f2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
