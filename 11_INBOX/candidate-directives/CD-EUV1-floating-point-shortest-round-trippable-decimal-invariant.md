# Candidate Directive: [CD-EUV1] Floating-Point Shortest Round-Trippable Decimal Invariant

<!-- PROVENANCE_START
{
  "source_repository": "t8y2-dbx-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T21:53:46.273Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-t8y2-dbx-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [t8y2-dbx-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T21:53:46.273Z`  
> **Learning ID**: `LEARN-EVO-t8y2-dbx-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-24T21:53:46.428Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795557226428",
    "title": "Floating-Point Shortest Round-Trippable Decimal Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "t8y2-dbx-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "6120e7094993234c650f752d7de60caab3721b18b853047c3af75fcc3af32846"
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
        "Harvested/verified timestamp recorded: 2026-11-24T21:53:46.428Z"
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
  "auth_token": "ee62adf0eae50685fffcdf25a3318080d4c32c32f9d49a6cd606e7f2f4b2a2e6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
