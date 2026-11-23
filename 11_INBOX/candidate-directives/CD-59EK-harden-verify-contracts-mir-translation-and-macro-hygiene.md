# Candidate Directive: [CD-59EK] harden #[verify] contracts, MIR translation, and macro hygiene

<!-- PROVENANCE_START
{
  "source_repository": "NVIDIA/cuda-rust",
  "source_url": "https://github.com/NVIDIA/cuda-rust",
  "source_version": "5e5c77b1",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T15:54:43.292Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nvidia-cuda-rust",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust) (Revision: `5e5c77b1`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T15:54:43.292Z`  
> **Learning ID**: `learn-github-nvidia-cuda-rust`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cuda-oxide/crates/cuda-device/src/shared.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NVIDIA/cuda-rust. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5e5c77b1`: cuda-oxide): harden #[verify] contracts, MIR translation, and macro hygiene. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `cuda-oxide/crates/cuda-device/src/shared.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:

/// Private sealing module ensuring [`VerifiedSharedElement`] can only be
/// implemented within `cuda-device` for bit-valid element types.
mod verified_shared_sealed {
    /// Supertrait sealing [`super::VerifiedSharedElement`] against external impls.
    pub trait Sealed {}
}

/// Sealed marker trait for element types of [`SharedArray`] statics proved safe
/// by `#[verify(...)]`.
///
/// # Safety
///
/// Every possible bit pattern of `Self` (including arbitrary SRAM power-on
/// bytes) must be a valid inhabited value of `Self` with no padding/niche
/// validity invariants (`bool`, `char`, references, and `NonZero*` are
/// excluded).
pub unsafe trait VerifiedSharedElement: verified_shared_sealed::Sealed {}

/// Implement [`VerifiedSharedElement`] for primitive integer and float scalars
/// whose every bit pattern represents a valid value.
macro_rules! impl_verified_shared_element {
    ($($ty:ty),* $(,)?) => {
        $(
            impl verified_shared_sealed::Sealed for $ty {}
            // SAFETY: primitive integer/floating-point bit patterns are all valid.
            unsafe impl VerifiedSharedElement for $ty {}
        )*
    };
}

impl_verified_shared_element!(
    u8, u
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5e5c77b1` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T15:54:43.290Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795449283289",
    "title": "harden #[verify] contracts, MIR translation, and macro hygiene",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NVIDIA/cuda-rust",
    "source_uri": "https://github.com/NVIDIA/cuda-rust",
    "source_version": "HEAD",
    "content_hash": "9476f2679c30deebaafd79b250d3fe15fb2d5d5d0bf0c2f05fd8636d41ed7390"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-23T15:54:43.290Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "aad6223dd141a6982ec27c95b0b9f5614b2c823f192f61f0a92df875199acb5f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
