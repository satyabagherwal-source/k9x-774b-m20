# Candidate Directive: [CD-YY20] add scalar min max out of range edge case tests and handle more corner cas

<!-- PROVENANCE_START
{
  "source_repository": "zama-ai/tfhe-rs",
  "source_url": "https://github.com/zama-ai/tfhe-rs",
  "source_version": "d0d659bf",
  "license": "NOASSERTION",
  "timestamp": "2026-11-27T11:44:33.000Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zama-ai-tfhe-rs",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zama-ai/tfhe-rs](https://github.com/zama-ai/tfhe-rs) (Revision: `d0d659bf`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-27T11:44:33.000Z`  
> **Learning ID**: `learn-github-zama-ai-tfhe-rs`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `backends/tfhe-cuda-backend/cuda/include/integer/comparison.h`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zama-ai/tfhe-rs. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d0d659bf`: gpu): add scalar min max out of range edge case tests and handle more corner case. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `backends/tfhe-cuda-backend/cuda/include/integer/comparison.h`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// @brief Number of blocks left after packing adjacent pairs of blocks. The
/// last block of an odd count is kept alone.
/// @param num_blocks Number of blocks before packing.
/// @return ceil(num_blocks / 2).
inline uint32_t num_packed_pairs(uint32_t num_blocks) {
  return num_blocks / 2 + num_blocks % 2;
}

    // Holds both packed operands
        streams.stream(0), streams.gpu_index(0), tmp_packed,
        2 * num_packed_pairs(num_radix_blocks), params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);
    // tree reduction. The borrow propagation needs at least two blocks.
        !is_signed && params.message_modulus == 4 &&
        params.carry_modulus == 4 && num_radix_blocks >= 2;
        // Cleaning LUT, applied on both packed operands at once
        uint32_t num_packed_operand_blocks =
            2 * num_packed_pairs(num_radix_blocks);
        identity_lut = new int_radix_lut<Torus>(
            streams, params, 1, num_packed_operand_blocks, allocate_gpu_memory,
            size_tracker);
            streams.active_gpu_subset(num_packed_operand_blocks,
                                      params.pbs_type()),
            {0}, {identity_lut_f}, LUT_0_FOR_AL
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        streams.stream(0), streams.gpu_index(0), tmp_packed, num_radix_blocks,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);
    // tree reduction.
        !is_signed && params.message_modulus == 4 && params.carry_modulus == 4;
        // Cleaning LUT
        identity_lut =
            new int_radix_lut<Torus>(streams, params, 1, num_radix_blocks,
                                     allocate_gpu_memory, size_tracker);
            active_streams, {0}, {identity_lut_f}, LUT_0_FOR_ALL_BLOCKS);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d0d659bf` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T11:44:32.998Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795779872998",
    "title": "add scalar min max out of range edge case tests and handle more corner cas",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zama-ai/tfhe-rs",
    "source_uri": "https://github.com/zama-ai/tfhe-rs",
    "source_version": "HEAD",
    "content_hash": "63321d12bb59cf73f3b86bbb17c90701814108879a3d2bc784e832e4f18c81b9"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-27T11:44:32.998Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "db69a791867e90332905952a19efef295e1905ee121bca87d156d6cbdcdfdb38"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
