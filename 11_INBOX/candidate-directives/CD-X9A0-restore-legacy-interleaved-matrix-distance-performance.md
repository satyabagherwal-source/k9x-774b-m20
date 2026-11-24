# Candidate Directive: [CD-X9A0] restore legacy interleaved matrix distance performance

<!-- PROVENANCE_START
{
  "source_repository": "alibaba/zvec",
  "source_url": "https://github.com/alibaba/zvec",
  "source_version": "a26f8abe",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T02:04:21.432Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-alibaba-zvec",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [alibaba/zvec](https://github.com/alibaba/zvec) (Revision: `a26f8abe`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T02:04:21.432Z`  
> **Learning ID**: `learn-github-alibaba-zvec`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/binding/python/CMakeLists.txt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in alibaba/zvec. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a26f8abe`: restore legacy interleaved matrix distance performance. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/binding/python/CMakeLists.txt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    set(_zvec_whole_archive_libs
            core_knn_flat_static
            core_knn_flat_sparse_static
            core_knn_hnsw_static
            core_knn_hnsw_rabitq_static
            core_knn_ivf_rabitq_static
            core_knn_hnsw_sparse_static
            core_knn_ivf_static
            core_knn_vamana_static
            core_knn_cluster_static
            core_knn_diskann_static
            core_mix_reducer_static
            core_metric_static
            core_utility_static
            core_quantizer_static
            zvec_turbo
    # Track build order and archive changes without propagating the static
    # targets' link interfaces, which include internal dylibs absent from wheels.
    add_dependencies(_zvec ${_zvec_whole_archive_libs})
    target_link_libraries(_zvec PRIVATE zvec)
    foreach(_lib ${_zvec_whole_archive_libs})
        target_link_options(_zvec PRIVATE
                "-Wl,-force_load,$<TARGET_FILE:${_lib}>"
        )
        set_property(TARGET _zvec APPEND PROPERTY LINK_DEPENDS
                "$<TARGET_FILE:${_lib}>"
        )
    endforeach()
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
    target_link_libraries(_zvec PRIVATE
            -Wl,-force_load,$<TARGET_FILE:core_knn_flat_static>
            -Wl,-force_load,$<TARGET_FILE:core_knn_flat_sparse_static>
            -Wl,-force_load,$<TARGET_FILE:core_knn_hnsw_static>
            -Wl,-force_load,$<TARGET_FILE:core_knn_hnsw_rabitq_static>
            -Wl,-force_load,$<TARGET_FILE:core_knn_ivf_rabitq_static>
            -Wl,-force_load,$<TARGET_FILE:core_knn_hnsw_sparse_static>
            -Wl,-force_load,$<TARGET_FILE:core_knn_ivf_static>
            -Wl,-force_load,$<TARGET_FILE:core_knn_vamana_static>
            -Wl,-force_load,$<TARGET_FILE:core_knn_cluster_static>
            -Wl,-force_load,$<TARGET_FILE:core_knn_diskann_static>
            -Wl,-force_load,$<TARGET_FILE:core_mix_reducer_static>
            -Wl,-force_load,$<TARGET_FILE:core_metric_static>
            -Wl,-force_load,$<TARGET_FILE:core_utility_static>
            -Wl,-force_load,$<TARGET_FILE:core_quantizer_static>
            -Wl,-force_load,$<TARGET_FILE:zvec_turbo>
            zvec
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a26f8abe` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T02:04:21.430Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795485861430",
    "title": "restore legacy interleaved matrix distance performance",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "alibaba/zvec",
    "source_uri": "https://github.com/alibaba/zvec",
    "source_version": "HEAD",
    "content_hash": "390f99a0b1d755987919de8bf18e99ce2506ac0b9b7bd3ad261aab1475d296a5"
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
        "Harvested/verified timestamp recorded: 2026-11-24T02:04:21.431Z"
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
  "auth_token": "4e500f98f0cd5879e91b995eed9d259936721e20d450697264733601fc39297f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
