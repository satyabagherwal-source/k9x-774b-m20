# Candidate Directive: [CD-NQA6] IEEE 754 Big-Endian / Little-Endian Union Casting Safety

<!-- PROVENANCE_START
{
  "source_repository": "arangodb/arangodb",
  "source_url": "https://github.com/arangodb/arangodb",
  "source_version": "d0c81b64",
  "license": "NOASSERTION",
  "timestamp": "2026-11-17T08:31:09.774Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-arangodb-arangodb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [arangodb/arangodb](https://github.com/arangodb/arangodb) (Revision: `d0c81b64`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-17T08:31:09.774Z`  
> **Learning ID**: `learn-github-arangodb-arangodb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When inspecting bit patterns of primitive types (such as double precision IEEE 754 floats for NaN, Inf, or Sign Bit analysis) without invoking undefined behavior via pointer-aliasing, systems MUST use standard unions initialized strictly through their first field, or use `std::bit_cast`. Pointer-arithmetic extraction of floating point bytes MUST explicitly account for endianness swaps (`U_IS_BIG_ENDIAN` vs Little-Endian).

**WHY**:
Treating `double*` as `char*` and reading indices assumes little-endian byte ordering. On big-endian architectures (e.g., IBM s390x, AIX), the sign bit and exponent reside at index `0`, whereas on x86/ARM64 little-endian systems, the most significant byte is at index `sizeof(double) - 1`. Incorrect byte offsets cause NaN and infinity detections to flip, leading to silent calculation errors, corrupt spatial coordinates, and incorrect sorting.

**WHEN TO APPLY**:
Low-level C/C++ cross-platform code managing serialization, numeric hashing, or custom floating-point categorization.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// 3rdParty/icu-legacy/icu64/common/putil.cpp
typedef union {
  int64_t i64; // First member initialization conforming to C89/C++ standards
  double d64;
} BitPatternConversion;

static const BitPatternConversion gNan = { (int64_t) INT64_C(0x7FF8000000000000) };
static const BitPatternConversion gInf = { (int64_t) INT64_C(0x7FF0000000000000) };

static inline bool uprv_signBit(double d) {
  uint8_t hiByte;
#if U_IS_BIG_ENDIAN
  hiByte = *(reinterpret_cast<uint8_t*>(&d));
#else
  hiByte = *(reinterpret_cast<uint8_t*>(&d) + sizeof(double) - 1);
#endif
  return (hiByte & 0x80) != 0;
}
```

**NEGATIVE CONSTRAINT**:
```cpp
// ARCHITECTURAL FLAW: Architecture-blind pointer casting.
// Fails on Big-Endian architectures (s390x) by reading least-significant byte!
bool brokenSignBit(double d) {
  uint8_t* bytePtr = (uint8_t*)&d;
  return (bytePtr[7] & 0x80) != 0; // Wrong on s390x / SPARC!
}
```

**VERIFICATION METHOD**:
Compile and execute static unit assertions parameterized across architecture targets via QEMU user-mode emulation for `s390x` and `x86_64`:
```cpp
static_assert(sizeof(double) == sizeof(int64_t), "IEEE 754 64-bit float invariant failed");
assert(uprv_signBit(-0.0) == true);
assert(uprv_signBit(0.0) == false);
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:31:09.773Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904269773",
    "title": "IEEE 754 Big-Endian / Little-Endian Union Casting Safety",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "arangodb/arangodb",
    "source_uri": "https://github.com/arangodb/arangodb",
    "source_version": "HEAD",
    "content_hash": "f7ba6973ad53b8fa9e6f4d738aea0414b1bcaada6ccde45e3e188f11217036e5"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:31:09.773Z"
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
  "auth_token": "27965f3a9988f1d998c3356e4f0be34d3056336cee74b26c2969e49e69f9976f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
