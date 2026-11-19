# Candidate Directive: [CD-TUHZ] Floating-Point Integer Downgrade Epsilon Window Invariant

<!-- PROVENANCE_START
{
  "source_repository": "medialab-xan-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T07:43:16.294Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-medialab-xan-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [medialab-xan-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T07:43:16.294Z`  
> **Learning ID**: `LEARN-EVO-medialab-xan-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T07:43:16.391Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795074196391",
    "title": "Floating-Point Integer Downgrade Epsilon Window Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "medialab-xan-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a50602a405e4cd1756ef79e80678d416272adea67132c33dee6786dffe753957"
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
        "Harvested/verified timestamp recorded: 2026-11-19T07:43:16.391Z"
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
  "auth_token": "8f3fb3d5344cafe5ec8c64d4d7ac347812525baf2b1e45b93e19f4e0e78127cc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
