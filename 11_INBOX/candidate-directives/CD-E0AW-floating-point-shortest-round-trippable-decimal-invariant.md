# Candidate Directive: [CD-E0AW] Floating-Point Shortest Round-Trippable Decimal Invariant

<!-- PROVENANCE_START
{
  "source_repository": "t8y2/dbx",
  "source_url": "https://github.com/t8y2/dbx",
  "source_version": "cf1293f6",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T21:53:06.824Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-t8y2-dbx",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [t8y2/dbx](https://github.com/t8y2/dbx) (Revision: `cf1293f6`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T21:53:06.824Z`  
> **Learning ID**: `learn-github-t8y2-dbx`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When serializing IEEE 754 single-precision floating point numbers (`f32`) into JSON or textual wire formats for data viewing, the serializer MUST NOT cast `f32` directly to an `f64` primitive before printing. Finite `f32` numbers MUST be converted to their minimal round-trippable decimal string representation at single precision before promotion to high-precision numeric JSON tokens.

**WHY**:
Widening an IEEE 754 `f32` (24 bits of mantissa) directly to `f64` (53 bits of mantissa) exposes low-order binary approximation noise that never existed in the source column. For example, `8.6_f32` cast directly to `f64` serializes as `8.600000381469727`. This causes visual clutter, broken equality checks, and false dirty diffs in database record editors.

**WHEN TO APPLY**:
Applies to any data serialization engine, database proxy, RPC gateway, or JSON encoder that bridges low-precision native binary float types (`f32`, `float4`, `REAL`) to dynamic or JSON representations.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use serde_json::{Number, Value};

pub fn finite_float32_to_json(value: f32) -> Value {
    if value.is_nan() {
        Value::String("NaN".to_string())
    } else if value.is_infinite() {
        if value.is_sign_positive() {
            Value::String("inf".to_string())
        } else {
            Value::String("-inf".to_string())
        }
    } else {
        // Step 1: Format f32 to its minimal round-trippable representation
        let shortest = value.to_string();
        // Step 2: Parse string as f64 to create a clean serde_json::Number
        let rounded = shortest
            .parse::<f64>()
            .expect("standard f32 to_string is always a valid f64");
        Value::Number(Number::from_f64(rounded).expect("finite f32 must yield finite f64"))
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER widen f32 directly to f64 primitive in JSON serializers
pub fn bad_float32_to_json(value: f32) -> Value {
    // CATASTROPHIC: 8.6_f32 becomes 8.600000381469727
    serde_json::Number::from_f64(value as f64)
        .map(Value::Number)
        .unwrap_or(Value::Null)
}
```

**VERIFICATION METHOD**:
Execute an automated test with test vectors `[8.6_f32, 0.72_f32, 59.6_f32, -13.25_f32]`. Assert that serialized string outputs equal `"8.6"`, `"0.72"`, `"59.6"`, and `"-13.25"` exactly, and verify bit-level round-tripping: `(json_num.as_f64().unwrap() as f32).to_bits() == value.to_bits()`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T21:53:06.823Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795557186823",
    "title": "Floating-Point Shortest Round-Trippable Decimal Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "t8y2/dbx",
    "source_uri": "https://github.com/t8y2/dbx",
    "source_version": "HEAD",
    "content_hash": "6120e7094993234c650f752d7de60caab3721b18b853047c3af75fcc3af32846"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T21:53:06.823Z"
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
  "auth_token": "070dc0778cb25cb21d4fc6796cb036bb1b1602b108513de29534829767b1f079"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
