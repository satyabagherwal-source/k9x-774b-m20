# Candidate Directive: [CD-9TSZ] send BackendKeyData after password auth, reject short CancelRequest

<!-- PROVENANCE_START
{
  "source_repository": "risingwavelabs/risingwave",
  "source_url": "https://github.com/risingwavelabs/risingwave",
  "source_version": "7f1b206a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T00:43:28.164Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-risingwavelabs-risingwave",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [risingwavelabs/risingwave](https://github.com/risingwavelabs/risingwave) (Revision: `7f1b206a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T00:43:28.164Z`  
> **Learning ID**: `learn-github-risingwavelabs-risingwave`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/utils/pgwire/src/pg_message.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in risingwavelabs/risingwave. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7f1b206a`: pgwire): send BackendKeyData after password auth, reject short CancelRequest. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/utils/pgwire/src/pg_message.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        if buf.remaining() < 8 {
            return Err(Error::new(
                ErrorKind::InvalidInput,
                format!(
                    "Invalid cancel request: expected 8 bytes of payload, got {}",
                    buf.remaining()
                ),
            ));
        }
    use std::io::ErrorKind;

    use crate::pg_message::{
        FeCancelMessage, FeMessage, FeParseMessage, FeQueryMessage, FeStartupMessage,
    };
    #[test]
    fn test_cancel_request_rejects_short_payload() {
        // A client without a secret key stops after the process id.
        let err = FeCancelMessage::parse(Bytes::from_static(&[0, 0, 0, 1])).unwrap_err();
        assert_eq!(err.kind(), ErrorKind::InvalidInput);

        let err = FeCancelMessage::parse(Bytes::new()).unwrap_err();
        assert_eq!(err.kind(), ErrorKind::InvalidInput);

        let msg = FeCancelMessage::parse(Bytes::from_static(&[0, 0, 0, 1, 0, 0, 0, 2])).unwrap();
        let FeMessage::CancelQuery(msg) = msg else {
            panic!("expected a cancel query message");
        };
        assert_eq!(msg.target_process_id, 1);
        assert_eq!(msg.target_secret_key, 2);
    }

```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    use crate::pg_message::{FeParseMessage, FeQueryMessage, FeStartupMessage};
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7f1b206a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T00:43:28.162Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795135408162",
    "title": "send BackendKeyData after password auth, reject short CancelRequest",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "risingwavelabs/risingwave",
    "source_uri": "https://github.com/risingwavelabs/risingwave",
    "source_version": "HEAD",
    "content_hash": "028bcf24b6f81c9bae2e88a4f924d37d52de51a53b16676c5ea7bebbd7f13686"
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
        "Harvested/verified timestamp recorded: 2026-11-20T00:43:28.162Z"
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
  "auth_token": "d53927c1bc80907f45f3a70a73976bd307b577b792f979f41b6bcc3ed3af6838"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
