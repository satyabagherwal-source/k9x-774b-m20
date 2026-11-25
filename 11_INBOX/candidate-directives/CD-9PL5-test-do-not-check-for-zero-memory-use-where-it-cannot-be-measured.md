# Candidate Directive: [CD-9PL5] test: Do not check for zero memory use where it cannot be measured

<!-- PROVENANCE_START
{
  "source_repository": "envoyproxy-envoy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T05:45:39.655Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-envoyproxy-envoy-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [envoyproxy-envoy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T05:45:39.655Z`  
> **Learning ID**: `LEARN-EVO-envoyproxy-envoy-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `test/common/memory/memory_test_utility.h`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in envoyproxy/envoy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d4c3cc20`: test: Do not check for zero memory use where it cannot be measured. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `test/common/memory/memory_test_utility.h`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
// canonical platforms, or when the expected value is zero and memory usage can
// be measured. Canonical platforms currently include only for 'release' tests in
// ci. On other platforms an info log is emitted, indicating that the test is
// being skipped.
//
// The zero case is not checked where memory usage cannot be measured (see
// `MemoryTest::mode()`). In particular, with jemalloc the total changes when a
// thread cache is refilled, so an allocation that is freed again can still be
// reported as consumed memory, depending on what the process allocated before.
    /* Read the memory consumed first: `MemoryTest::mode()` allocates. */                          \
    const auto memory_test_consumed_bytes = consumed_bytes;                                        \
    const auto memory_test_mode = ::Envoy::Memory::TestUtil::MemoryTest::mode();                   \
    if ((expected_value == 0 &&                                                                    \
         memory_test_mode != ::Envoy::Memory::TestUtil::MemoryTest::Mode::Disabled) ||             \
        memory_test_mode == ::Envoy::Memory::TestUtil::MemoryTest::Mode::Canonical) {              \
      EXPECT_EQ(mem
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
// canonical platforms, or when the expected value is zero. Canonical platforms
// currently include only for 'release' tests in ci. On other platforms an info
// log is emitted, indicating that the test is being skipped.
    if (expected_value == 0 || ::Envoy::Memory::TestUtil::MemoryTest::mode() ==                    \
                                   ::Envoy::Memory::TestUtil::MemoryTest::Mode::Canonical) {       \
      EXPECT_EQ(consumed_bytes, expected_value);                                                   \
                     consumed_bytes, expected_value);                                              \
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d4c3cc20` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T05:45:39.782Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795585539782",
    "title": "test: Do not check for zero memory use where it cannot be measured",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "envoyproxy-envoy-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "30ef7a868a911d1e82c6a98df2d2020acbd4d0368aa18237999da7074feaf8c9"
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
        "Harvested/verified timestamp recorded: 2026-11-25T05:45:39.783Z"
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
  "auth_token": "fc5ae4c7edbce25fc54497996907ef8855045d3bb401e347389407d4b6244da6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
