# Candidate Directive: [CD-5G54] [Invoker] Keep the per-invocation memory limit above the accepted message size

<!-- PROVENANCE_START
{
  "source_repository": "restatedev/restate",
  "source_url": "https://github.com/restatedev/restate",
  "source_version": "d0c6ad20",
  "license": "NOASSERTION",
  "timestamp": "2026-11-24T22:42:26.680Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-restatedev-restate",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [restatedev/restate](https://github.com/restatedev/restate) (Revision: `d0c6ad20`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-24T22:42:26.680Z`  
> **Learning ID**: `learn-github-restatedev-restate`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/invoker-impl/src/error.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in restatedev/restate. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dc09481a`: [Invoker] Keep the per-invocation memory limit above the accepted message size. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/invoker-impl/src/error.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use restate_service_protocol_v4::message_codec::EncodingError;
        EncodingError,
            // The service sends the same message again on retry.
            InvokerError::Encoder(EncodingError::MessageSizeLimit(..)) => false,

#[cfg(test)]
mod tests {
    use std::num::NonZeroUsize;

    use super::*;

    #[test]
    fn size_limit_errors_are_not_transient() {
        let message_size_limit = InvokerError::Encoder(EncodingError::MessageSizeLimit(
            2,
            NonZeroUsize::new(1).unwrap(),
        ));
        assert!(!message_size_limit.is_transient());

        let memory = |kind| {
            InvokerError::OutOfMemory(InvocationMemoryExhausted {
                needed: NonZeroByteCount::new(NonZeroUsize::new(1).unwrap()),
                kind,
                context: "test",
            })
        };
        assert!(!memory(OutOfMemoryKind::UpperBoundExceeded).is_transient());
        assert!(memory(OutOfMemoryKind::PoolExhausted).is_transient());
        assert!(InvokerError::ContentTooLarge.is_transient());
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        restate_service_protocol_v4::message_codec::EncodingError,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dc09481a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T22:42:26.678Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795560146678",
    "title": "[Invoker] Keep the per-invocation memory limit above the accepted message size",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "restatedev/restate",
    "source_uri": "https://github.com/restatedev/restate",
    "source_version": "HEAD",
    "content_hash": "a9d5e5241a0dfde71feab1fc41cc9c9d58169acaeb4b92872bbfcb17995e5252"
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
        "Harvested/verified timestamp recorded: 2026-11-24T22:42:26.678Z"
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
  "auth_token": "32cf6cd239ae1a9962148485a4fa5925f2696ec1f06c9bc3a3a53a9377a0e24d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
