# Candidate Directive: [CD-P8R6] IEEE 754 Big-Endian / Little-Endian Union Casting Safety

<!-- PROVENANCE_START
{
  "source_repository": "arangodb-arangodb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:32:20.273Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-arangodb-arangodb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [arangodb-arangodb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:32:20.273Z`  
> **Learning ID**: `LEARN-EVO-arangodb-arangodb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:32:20.370Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904340370",
    "title": "IEEE 754 Big-Endian / Little-Endian Union Casting Safety",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "arangodb-arangodb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "34dbe7259df20275be0c04bae6266f190a22f2454d4f9ed5e9218878d5c83490"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:32:20.370Z"
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
  "auth_token": "1697b6cf2c2cb281633a5e370565e565ba1cd22cca778b37781510e78a5ae949"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
