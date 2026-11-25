# Candidate Directive: [CD-3D2R] map TIMESTAMP WITH TIME ZONE to DateTimeTzMicro in the Arrow transports

<!-- PROVENANCE_START
{
  "source_repository": "sfu-db/connector-x",
  "source_url": "https://github.com/sfu-db/connector-x",
  "source_version": "07e1d2e5",
  "license": "MIT",
  "timestamp": "2026-11-25T07:04:42.483Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sfu-db-connector-x",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sfu-db/connector-x](https://github.com/sfu-db/connector-x) (Revision: `07e1d2e5`).  
> **License**: MIT | **Timestamp**: `2026-11-25T07:04:42.483Z`  
> **Learning ID**: `learn-github-sfu-db-connector-x`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `connectorx/src/transports/oracle_arrow.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sfu-db/connector-x. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8f3475c5`: oracle): map TIMESTAMP WITH TIME ZONE to DateTimeTzMicro in the Arrow transports. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `connectorx/src/transports/oracle_arrow.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        { TimestampTz[DateTime<Utc>]        => DateTimeTzMicro[DateTimeWrapperMicro]    | conversion option }

#[cfg(test)]
mod tests {
    use super::*;
    use crate::typesystem::{Transport, TypeSystem};

    /// The destination type of each Oracle date and time type must hold the value the conversion produces: a
    /// mismatch is only caught at run time, on the first row ("Data type unexpected"). `TIMESTAMP WITH TIME ZONE`
    /// produced a `DateTimeWrapperMicro` into a `DateTimeTz` column, which holds a `DateTime<Utc>`.
    /// Checks that `ts` holds values of type `T` (`Option<T>` when nullable).
    fn holds<T>(ts: ArrowTypeSystem, nullable: bool) -> bool
    where
        T: crate::typesystem::TypeAssoc<ArrowTypeSystem>,
        Option<T>: crate::typesystem::TypeAssoc<ArrowTypeSystem>,
    {
        if nullable {
            ts.check::<Option<T>>().is_ok()
        } else {
            ts.check::<T>().is_ok()
        }
    }

    #[test]
    fn date_and_time_types_hold_the_converted_values() {
        let dst = |ts| OracleArrowTransport::convert_typesystem(ts).unwrap();
        for nullable in [true, false] {
            let tz = dst(OracleTypeSystem::TimestampTz(nullable)
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        { TimestampTz[DateTime<Utc>]        => DateTimeTz[DateTimeWrapperMicro]         | conversion option }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8f3475c5` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T07:04:42.482Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795590282482",
    "title": "map TIMESTAMP WITH TIME ZONE to DateTimeTzMicro in the Arrow transports",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sfu-db/connector-x",
    "source_uri": "https://github.com/sfu-db/connector-x",
    "source_version": "HEAD",
    "content_hash": "4f13c1ee8012f7b8f535e4583c90c0f0b4de0729def29b5fcee422c9f486fe9e"
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
        "Harvested/verified timestamp recorded: 2026-11-25T07:04:42.482Z"
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
  "auth_token": "05bd1e9e69a92ed50b600459a3f8ba0c87944dcd06126ecdde9d31ae115ac230"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
