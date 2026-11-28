# Candidate Directive: [CD-C85Z] Empirical Invariant Guard in highway.cpp

<!-- PROVENANCE_START
{
  "source_repository": "vespa-engine-vespa-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T02:22:40.596Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-vespa-engine-vespa-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vespa-engine-vespa-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T02:22:40.596Z`  
> **Learning ID**: `LEARN-EVO-vespa-engine-vespa-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `vespalib/src/vespa/vespalib/hwaccelerated/highway.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in vespa-engine/vespa. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8de5482d`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `vespalib/src/vespa/vespalib/hwaccelerated/highway.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
template <uint8_t Bits> struct BitsTag {
    constexpr static uint8_t value = Bits;
};
constexpr const uint8_t* get_bf16_lut(BitsTag<1>) noexcept {
    return bf16_lut_b1;
}
constexpr const uint8_t* get_bf16_lut(BitsTag<2>) noexcept {
    return bf16_lut_b2;
}
constexpr const uint8_t* get_bf16_lut(BitsTag<3>) noexcept {
    return bf16_lut_b3;
}
constexpr const uint8_t* get_bf16_lut(BitsTag<4>) noexcept {
    return bf16_lut_b4;
}

template <uint8_t Bits, bool AllowReordering, bool ZeroOutOfBounds, InvocationMeta Meta, typename DU8, typename DBF16>
HWY_API void bf16_centroids_from_indexes(const Meta meta, const DU8 du8, const DBF16 dbf16, hn::Vec<DU8> idx,
                                         hn::Vec<DBF16>& bf16_lo_out, hn::Vec<DBF16>& bf16_hi_out) noexcept {
    using VU8 = hn::Vec<decltype(du8)>;

    constexpr const uint8_t* bf16_lut = get_bf16_lut(BitsTag<Bits>{});
    // The compiler will hoist the LUT loads out of the loop and into the prologue.
    // It can also de-dupe LUT registers since it can see that the const memory
    // loaded is the same.
    const VU8 bf16_msb_lut = hn::LoadDup128(du8, bf16_lut);
    VU8       bf16_msb = hn::TableLookupBytes(bf16_msb_lut, id
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
                            const uint8_t* HWY_RESTRICT bf16_lut, const size_t sz,
                            InnerKernelFn inner_kernel_fn) noexcept {
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T02:22:40.725Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795832560725",
    "title": "Empirical Invariant Guard in highway.cpp",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vespa-engine-vespa-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ab11217d0b51eda8f78fe54f2acd7e0c91894decb5f962bc8c850621e56bb613"
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
        "Harvested/verified timestamp recorded: 2026-11-28T02:22:40.726Z"
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
  "auth_token": "da10dd36195af7017cf56c2d08b5efdf1efe50c282dc4aa4bffd69cb709fd054"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
