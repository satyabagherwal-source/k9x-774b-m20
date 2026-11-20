# Candidate Directive: [CD-27PC] Empirical Invariant Guard in bd.rs

<!-- PROVENANCE_START
{
  "source_repository": "embassy-rs-embassy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T13:13:22.454Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-embassy-rs-embassy-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [embassy-rs-embassy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T13:13:22.454Z`  
> **Learning ID**: `LEARN-EVO-embassy-rs-embassy-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `embassy-stm32/src/rcc/bd.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in embassy-rs/embassy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c0913476`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `embassy-stm32/src/rcc/bd.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// External clock. On C5 this uses digital bypass; analog bypass is not functional.
    #[cfg(not(any(stm32h5, stm32g5, stm32c5)))] // ES0565/ES0661/ES0676/ES0677: LSE low drive is not functional
            #[cfg(not(any(stm32h5, stm32g5, stm32c5)))]
#[cfg(not(any(rtc_v2_l0, rtc_v2_l1, stm32c0, stm32g5, stm32c5)))]
// C5/G5 call the backup domain the "RTC domain": RCC_RTCCR instead of RCC_BDCR.
#[cfg(any(stm32g5, stm32c5))]
#[cfg(any(stm32g5, stm32c5))]
#[cfg(not(any(stm32c0, stm32g5, stm32c5)))]
    #[cfg(not(any(rtc_v2_l0, rtc_v2_l1, stm32c0, stm32g5, stm32c5)))]
    #[cfg(any(stm32g5, stm32c5))]
            #[cfg(any(stm32g5, stm32c5))]
            #[cfg(not(any(stm32u5, stm32h5, stm32wba, stm32c0, stm32n6, stm32g5, stm32c5)))]
        #[cfg(stm32c5)]
        if lse_en {
            ok &= reg.lseext()
                == if lse_byp {
                    crate::pac::rcc::vals::Lseext::Digital
                } else {
                    crate::pac::rcc::vals::Lseext::Analog
                };
        }
            rcc_l0, rcc_l0_v2, rcc_l1, stm32h5, stm32h7rs, stm32c0, stm32n6, stm32u5, stm32l5, stm32g5, stm32c5
                    // ES0661/ES0676/ES0677: analog bypass is n
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    #[cfg(not(any(stm32h5, stm32g5)))] // ES0565: LSE Low drive mode is not functional
            #[cfg(not(any(stm32h5, stm32g5)))]
#[cfg(not(any(rtc_v2_l0, rtc_v2_l1, stm32c0, stm32g5)))]
// G5 calls the backup domain the "RTC domain": RCC_RTCCR instead of RCC_BDCR.
#[cfg(any(stm32g5))]
#[cfg(stm32g5)]
#[cfg(not(any(stm32c0, stm32g5)))]
    #[cfg(not(any(rtc_v2_l0, rtc_v2_l1, stm32c0, stm32g5)))]

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T13:13:22.557Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795180402557",
    "title": "Empirical Invariant Guard in bd.rs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "embassy-rs-embassy-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "7adbddcb9ff2be0ddebb24f0361aa1156329dc2afad40e6140999e39c68d3a95"
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
        "Harvested/verified timestamp recorded: 2026-11-20T13:13:22.557Z"
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
  "auth_token": "8b1f48208015d44c81c532fe8d2f7d4544af0acf088c16e12826503cbb57fdbf"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
