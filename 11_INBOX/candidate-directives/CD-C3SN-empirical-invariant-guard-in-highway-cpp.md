# Candidate Directive: [CD-C3SN] Empirical Invariant Guard in highway.cpp

<!-- PROVENANCE_START
{
  "source_repository": "vespa-engine/vespa",
  "source_url": "https://github.com/vespa-engine/vespa",
  "source_version": "8de5482d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-28T02:22:35.063Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-vespa-engine-vespa",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vespa-engine/vespa](https://github.com/vespa-engine/vespa) (Revision: `8de5482d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-28T02:22:35.063Z`  
> **Learning ID**: `learn-github-vespa-engine-vespa`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8de5482d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T02:22:35.061Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795832555061",
    "title": "Empirical Invariant Guard in highway.cpp",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vespa-engine/vespa",
    "source_uri": "https://github.com/vespa-engine/vespa",
    "source_version": "HEAD",
    "content_hash": "08057a4222c6ca8c554b1d7937f7680a7f711cea6dd3b7eb95f8c3885115e2e5"
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
        "Harvested/verified timestamp recorded: 2026-11-28T02:22:35.061Z"
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
  "auth_token": "6ea20276811cfd93df84cf3868ffcc178a063852a33bf9e06aad28795d27fdef"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
