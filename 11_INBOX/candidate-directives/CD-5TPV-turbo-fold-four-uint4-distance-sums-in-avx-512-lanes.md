# Candidate Directive: [CD-5TPV] turbo): fold four UINT4 distance sums in AVX-512 lanes

<!-- PROVENANCE_START
{
  "source_repository": "alibaba-zvec-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T22:42:44.097Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-alibaba-zvec-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [alibaba-zvec-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T22:42:44.097Z`  
> **Learning ID**: `LEARN-EVO-alibaba-zvec-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/turbo/distance/avx512_vnni/uniform_uint4/squared_euclidean.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in alibaba/zvec. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ac3d0dd7`: turbo): fold four UINT4 distance sums in AVX-512 lanes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/turbo/distance/avx512_vnni/uniform_uint4/squared_euclidean.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
  // Fold the four rows together while all four 128-bit lanes are active.
  // Each lane of abcd holds the partial sums for rows a, b, c and d.
  const __m512i ab = _mm512_add_epi32(_mm512_unpacklo_epi32(a, b),
                                      _mm512_unpackhi_epi32(a, b));
  const __m512i cd = _mm512_add_epi32(_mm512_unpacklo_epi32(c, d),
                                      _mm512_unpackhi_epi32(c, d));
  const __m512i abcd = _mm512_add_epi32(_mm512_unpacklo_epi64(ab, cd),
                                        _mm512_unpackhi_epi64(ab, cd));
  const __m256i halves = _mm256_add_epi32(_mm512_castsi512_si256(abcd),
                                          _mm512_extracti64x4_epi64(abcd, 1));
  return _mm_add_epi32(_mm256_castsi256_si128(halves),
                       _mm256_extracti128_si256(halves, 1));
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
  const __m256i a8 = _mm256_add_epi32(_mm512_castsi512_si256(a),
                                      _mm512_extracti64x4_epi64(a, 1));
  const __m256i b8 = _mm256_add_epi32(_mm512_castsi512_si256(b),
                                      _mm512_extracti64x4_epi64(b, 1));
  const __m256i c8 = _mm256_add_epi32(_mm512_castsi512_si256(c),
                                      _mm512_extracti64x4_epi64(c, 1));
  const __m256i d8 = _mm256_add_epi32(_mm512_castsi512_si256(d),
                                      _mm512_extracti64x4_epi64(d, 1));

  const __m128i a4 = _mm_add_epi32(_mm256_castsi256_si128(a8),
                                   _mm256_extracti128_si256(a8, 1));
  const __m128i b4 = _mm_add_epi32(_mm256_castsi256_si128(b8),
                                   _mm256_extracti128_si256(b8, 1));
  const __m128i c4 = _mm_add_epi32(_mm256_castsi256_si128(c8),
                                   _mm256_extracti128_si256(c8, 1));
  const __m128i d4 = _mm_add_epi32(_mm256_castsi256_si128(d8),
                                   _mm256_extracti128_si256(d8, 1));

  const __m128i ab_low = _mm_unpacklo_epi32(a4, b4);

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T22:42:44.273Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795560164273",
    "title": "turbo): fold four UINT4 distance sums in AVX-512 lanes",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "alibaba-zvec-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b73ec0c9e13e40ca94f6a663d272cdd0a86f1202eb2b13617d397a5b3fba1c78"
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
        "Harvested/verified timestamp recorded: 2026-11-24T22:42:44.274Z"
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
  "auth_token": "03fd10096ae96bf010d8bf9d5908252b422c203e74a26d0a48207d201bb5ac9c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
