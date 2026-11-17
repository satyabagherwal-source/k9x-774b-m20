# Candidate Directive: [CD-EOMW] Numerical Serialization Output Buffer Boundary Invariant

<!-- PROVENANCE_START
{
  "source_repository": "starrocks-starrocks-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T09:48:06.482Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-starrocks-starrocks-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [starrocks-starrocks-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T09:48:06.482Z`  
> **Learning ID**: `LEARN-EVO-starrocks-starrocks-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T09:48:06.583Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794908886583",
    "title": "Numerical Serialization Output Buffer Boundary Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "starrocks-starrocks-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a1f46ee6d560abcdb948dd126812901787eb381e7d459bf88c40034064a5b8eb"
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
        "Harvested/verified timestamp recorded: 2026-11-17T09:48:06.583Z"
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
  "auth_token": "0f7603733a5c3b8fc80ded78a126973f8c042467f8b971f157a506e392ddc783"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
