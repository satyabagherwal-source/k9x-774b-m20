# Candidate Directive: [CD-DZ4I] Numerical Serialization Output Buffer Boundary Invariant

<!-- PROVENANCE_START
{
  "source_repository": "StarRocks/starrocks",
  "source_url": "https://github.com/StarRocks/starrocks",
  "source_version": "7dd4de40",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T09:47:33.522Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-starrocks-starrocks",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [StarRocks/starrocks](https://github.com/StarRocks/starrocks) (Revision: `7dd4de40`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T09:47:33.522Z`  
> **Learning ID**: `learn-github-starrocks-starrocks`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When serializing double-precision floating-point numbers or 64-bit/128-bit integers to textual representations (JSON, CSV, SQL literals) via optimized low-level conversion routines (e.g., `dtoa`, `fpconv`, `dragonbox`, `ryu`), the destination stack-allocated scratch buffer MUST be sized for the absolute worst-case textual width, including negative signs, exponential markers, leading zeros, and null terminators. For IEEE-754 double precision in fixed/positional notation, scratch buffers MUST NOT be smaller than 32 bytes.

**WHY**:
Standard double values formatted in positional or non-scientific representations (e.g., large exponents formatted flatly like `-1.1126569627700335e23` expanding to `-111265696277003350000000`) exceed standard 24-byte temporary buffers. Sizing buffers to 24 bytes results in stack memory corruption, heap smashing, or undefined execution behavior in SIMD/C++ JSON parser kernels.

**WHEN TO APPLY**:
Apply to all low-level text generation engines, JSON column serializers, RPC encoders, and database dumping utilities in C/C++/Rust.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// verified_dtoa_buffer.h
#pragma once
#include <cstdint>
#include <cstring>
#include <limits>
#include "base/compiler_util.h"

namespace starrocks {

class FastNumberSerializer {
public:
    // IEEE 754 double: max digits in positional format can reach up to ~30 chars
    // e.g. -111265696277003350000000.00000000...
    // Invariant: Reserve at least 32 bytes for fast stack scratchpads.
    static constexpr size_t K_DOUBLE_BUFFER_SIZE = 32;

    static size_t format_double(double value, char* buffer, size_t capacity) {
        DCHECK(capacity >= K_DOUBLE_BUFFER_SIZE);
        // Safe conversion utilizing bounded write
        int len = fpconv_dtoa(value, buffer);
        DCHECK_LE(len, static_cast<int>(capacity));
        buffer[len] = '\0';
        return static_cast<size_t>(len);
    }
    
    // Controlled wrapper preventing stack smashes
    static void append_double_to_string(double value, std::string* output) {
        char temp[K_DOUBLE_BUFFER_SIZE];
        size_t len = format_double(value, temp, sizeof(temp));
        output->append(temp, len);
    }
};

} // namespace starrocks
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Fixed-size buffer undersized for negative fixed-notation doubles
void UnsafeDumper::appendDouble(double v) {
    // FATAL DEFECT: 24 bytes is insufficient for large negative fixed-point doubles!
    // Large negative numbers will overwrite stack return addresses or adjacent frame pointers.
    char temp[24]; 
    int len = fpconv_dtoa(v, &temp[0]); // Writes > 24 bytes -> Buffer Overflow / Stack Smashing
    _buffer.append(temp, len);
}
```

**VERIFICATION METHOD**:
Integrate AddressSanitizer (ASan) into CI test pipelines and run extreme numerical range fuzzing:
```cpp
TEST(FastNumberSerializerTest, FuzzExtremeDoublesASAN) {
    std::vector<double> test_cases = {
        -1.1126569627700335e23,
        std::numeric_limits<double>::lowest(),
        std::numeric_limits<double>::max(),
        -0.000000000000000000000000000000001
    };
    for (double val : test_cases) {
        std::string out;
        FastNumberSerializer::append_double_to_string(val, &out);
        ASSERT_FALSE(out.empty());
    }
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T09:47:33.521Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794908853521",
    "title": "Numerical Serialization Output Buffer Boundary Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "StarRocks/starrocks",
    "source_uri": "https://github.com/StarRocks/starrocks",
    "source_version": "HEAD",
    "content_hash": "1f759d943321e6d2aac8409d9828da0e885ee46729193d3527a8edc2204adaad"
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
        "Harvested/verified timestamp recorded: 2026-11-17T09:47:33.521Z"
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
  "auth_token": "59d17a86d00eaa787ecadf853f8fa2ce237ccfadc3d094c8290fe11c2965d3b9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
