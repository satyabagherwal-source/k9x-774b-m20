# Candidate Directive: [CD-U82I] ensure correct host indexes updates

<!-- PROVENANCE_START
{
  "source_repository": "zama-ai/tfhe-rs",
  "source_url": "https://github.com/zama-ai/tfhe-rs",
  "source_version": "b2358d26",
  "license": "NOASSERTION",
  "timestamp": "2026-11-26T17:57:07.290Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zama-ai-tfhe-rs",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zama-ai/tfhe-rs](https://github.com/zama-ai/tfhe-rs) (Revision: `b2358d26`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-26T17:57:07.290Z`  
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
Prevents defects observed in production commit `b2358d26`: gpu): ensure correct host indexes updates. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `backends/tfhe-cuda-backend/cuda/include/integer/comparison.h`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        // Group g uses the LUT index and the corrector that
        // int_prop_simu_group_carries_memory uses at the last position of the
        // group (at the simulator position for the last group). The comparison
        // only applies this LUT to the first n_groups blocks, the other
        // indexes are set to 0: the LUT can no longer be used for the generic
        // borrow propagation.
        auto group_pos = [=](uint32_t g) -> uint32_t {
          return (g + 1 < n_groups) ? (g + 1) * group_size - 1
                                    : num_radix_blocks - 2;
        auto *lut = mem_simu_group_carries->luts_array_second_step;
        lut->set_lut_indexes(
            active_streams,
            [&](Torus *h_indexes, uint32_t num_indexes) {
              for (uint32_t i = 0; i < num_indexes; i++)
                h_indexes[i] = 0;
              for (uint32_t g = 0; g < n_groups; g++) {
                uint32_t pos = group_pos(g);
                uint32_t group_index = pos / group_size;
                uint32_t pos_in_group = pos % group_size;
                if (group_index == 0) {
                  h_indexes[g] = pos_in_group;
                } else if (pos_in_group =
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        // Mirror second_step_lut_index_generator / h_scalar_array_cum_sum for a
        // single cumulative-sum position (see
        // int_prop_simu_group_carries_memory).
        auto lut_index_for = [group_size, seq](uint32_t pos) -> Torus {
          uint32_t group_index = pos / group_size;
          uint32_t pos_in_group = pos % group_size;
          if (group_index == 0)
            return (Torus)pos_in_group;
          else if (pos_in_group == group_size - 1)
            return seq ? (Torus)((group_index - 1) % (group_size - 1) +
                                 2 * group_size)
                       : (Torus)(2 * group_size);
          else
            return (Torus)(pos_in_group + group_size);
        };
        auto corrector_for = [group_size, seq](uint32_t pos) -> Torus {
          uint32_t group_index = pos / group_size;
          uint32_t pos_in_group = pos % group_size;
          if (group_index == 0 || pos_in_group != group_size - 1)
            return (Torus)0;
          return seq ? ((Torus)1 << ((group_index - 1) % (group_size - 1)))
                     : (Torus)1;
        std::vector<Torus> h_indexes(n_groups);
        std::vector<Torus> h_scalar_corrector(n
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b2358d26` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T17:57:07.288Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795715827288",
    "title": "ensure correct host indexes updates",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zama-ai/tfhe-rs",
    "source_uri": "https://github.com/zama-ai/tfhe-rs",
    "source_version": "HEAD",
    "content_hash": "a3b9204b8720a7c16cfb3e5798e5eff035ec487ca34a469c6d1fc29147c14a6c"
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
        "Harvested/verified timestamp recorded: 2026-11-26T17:57:07.288Z"
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
  "auth_token": "d983fb3b0a83fca565fa5de734fdd9f52912283539f34b97af2440bd59630cb1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
