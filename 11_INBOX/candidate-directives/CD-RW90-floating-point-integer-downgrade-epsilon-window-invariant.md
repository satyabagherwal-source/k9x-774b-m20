# Candidate Directive: [CD-RW90] Floating-Point Integer Downgrade Epsilon Window Invariant

<!-- PROVENANCE_START
{
  "source_repository": "medialab/xan",
  "source_url": "https://github.com/medialab/xan",
  "source_version": "7e357947",
  "license": "Unlicense",
  "timestamp": "2026-11-19T07:41:45.348Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-medialab-xan",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [medialab/xan](https://github.com/medialab/xan) (Revision: `7e357947`).  
> **License**: Unlicense | **Timestamp**: `2026-11-19T07:41:45.348Z`  
> **Learning ID**: `learn-github-medialab-xan`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When dynamic systems must cast or treat floating-point numbers (`f64`) as exact machine integers (`i64`), implementations MUST NOT rely on raw truncation (`f as i64`) or simple equality (`f.fract() == 0.0`). Implementations MUST compute fractional distance (`f.fract()`) against an explicit epsilon window defined as $2 \times \text{Machine Epsilon}$ (`f64::EPSILON * 2.0`), accounting for boundary wraparound near $1.0$ and $0.0$.

**WHY**:
Floating-point arithmetic introduces tiny precision drift (e.g., $1.0 - 1e-16 = 0.9999999999999999$). Truncation via `f as i64` turns $0.9999999999999999$ into `0`, creating severe logic bugs in indexing, sizing, and grouping. Conversely, `f.fract() == 0.0` fails to recognize floats that should structurally downgrade to integers.

**WHEN TO APPLY**:
Dynamic runtime typing, expression evaluators, CSV cell-to-numeric converters, and array indexing logic.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Production Pattern from src/moonblade/utils.rs
const LARGE_EPSILON: f64 = f64::EPSILON * 2.0;

#[inline]
pub fn downgrade_float(f: f64) -> Option<i64> {
    let dust = f.fract();

    // Check if within epsilon of upper boundary (wrap to 1.0) or lower boundary (0.0)
    if dust + LARGE_EPSILON >= 1.0 || dust - LARGE_EPSILON <= 0.0 {
        Some(f.round() as i64)
    } else {
        None
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Naive truncation or float equality check
pub fn naive_downgrade(f: f64) -> Option<i64> {
    if f.fract() == 0.0 { // Fails on 0.9999999999999999 or 1.0000000000000002
        Some(f as i64)
    } else {
        None
    }
}
```

**VERIFICATION METHOD**:
Property-based testing (using `proptest` or `quickcheck`) asserting that values perturbed by $\pm \epsilon$ consistently evaluate to the target integer:
```rust
#[test]
fn verify_epsilon_downgrade_invariants() {
    assert_eq!(downgrade_float(0.0), Some(0i64));
    assert_eq!(downgrade_float(0.5), None);
    assert_eq!(downgrade_float(f64::EPSILON), Some(0i64));
    assert_eq!(downgrade_float(1.0 - f64::EPSILON), Some(1i64));
    assert_eq!(downgrade_float(1.0 + f64::EPSILON), Some(1i64));
    assert_eq!(downgrade_float(-1.0 + f64::EPSILON), Some(-1i64));
    assert_eq!(downgrade_float(-1.0 - f64::EPSILON), Some(-1i64));
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T07:41:45.348Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795074105348",
    "title": "Floating-Point Integer Downgrade Epsilon Window Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "medialab/xan",
    "source_uri": "https://github.com/medialab/xan",
    "source_version": "HEAD",
    "content_hash": "05621a4746e1f0e4904e70635081904eb714176a85b0017218a5f5b0aa7690b6"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T07:41:45.348Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "bf3646b1b883be9fe8f48790a4a28c9c41b410327b3d5e854c0cc32ef1bf110d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
