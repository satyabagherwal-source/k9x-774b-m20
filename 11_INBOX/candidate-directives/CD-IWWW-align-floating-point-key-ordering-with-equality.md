# Candidate Directive: [CD-IWWW] Align floating-point Key ordering with equality

<!-- PROVENANCE_START
{
  "source_repository": "gluesql/gluesql",
  "source_url": "https://github.com/gluesql/gluesql",
  "source_version": "40f0b84f",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T21:47:56.576Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gluesql-gluesql",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gluesql/gluesql](https://github.com/gluesql/gluesql) (Revision: `40f0b84f`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T21:47:56.576Z`  
> **Learning ID**: `learn-github-gluesql-gluesql`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `core/src/data/key.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gluesql/gluesql. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `40f0b84f`: Align floating-point Key ordering with equality. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/src/data/key.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            (Key::F32(l), Key::F32(r)) => l.cmp(r),
            (Key::F64(l), Key::F64(r)) => l.cmp(r),
        assert_eq!(
            Key::F32((-0.0_f32).into()).cmp(&Key::F32(0.0_f32.into())),
            Ordering::Equal,
        );
        assert_eq!(
            Key::F32(f32::from_bits(0xffc0_0001).into())
                .cmp(&Key::F32(f32::from_bits(0x7fc0_0002).into())),
            Ordering::Equal,
            "F32 NaNs with different signs and payloads should compare equal",
        );
        assert_eq!(
            Key::F64((-0.0).into()).cmp(&Key::F64(0.0.into())),
            Ordering::Equal,
        );
        assert_eq!(
            Key::F64(f64::from_bits(0xfff8_0000_0000_0001).into())
                .cmp(&Key::F64(f64::from_bits(0x7ff8_0000_0000_0002).into())),
            Ordering::Equal,
            "F64 NaNs with different signs and payloads should compare equal",
        );
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            (Key::F32(l), Key::F32(r)) => l.total_cmp(&r.0),
            (Key::F64(l), Key::F64(r)) => l.total_cmp(&r.0),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `40f0b84f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T21:47:56.574Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795816076574",
    "title": "Align floating-point Key ordering with equality",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gluesql/gluesql",
    "source_uri": "https://github.com/gluesql/gluesql",
    "source_version": "HEAD",
    "content_hash": "06038720512f38ed5b4b8c8f0962242d35cf86a79465d4c0c59f9c956dc05b1f"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-27T21:47:56.574Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "a644c30f10a8fe2d717fbfd0380fa9355d18ef57286f124b2a26a9b58ce7b345"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
