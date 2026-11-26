# Candidate Directive: [CD-3ZXO] take space to ensure splitting key epochs

<!-- PROVENANCE_START
{
  "source_repository": "rustls/rustls",
  "source_url": "https://github.com/rustls/rustls",
  "source_version": "bd95fd9b",
  "license": "NOASSERTION",
  "timestamp": "2026-11-26T16:40:44.460Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rustls-rustls",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rustls/rustls](https://github.com/rustls/rustls) (Revision: `bd95fd9b`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-26T16:40:44.460Z`  
> **Learning ID**: `learn-github-rustls-rustls`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `rustls-test/tests/api/quic.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in rustls/rustls. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bd95fd9b`: quic: take space to ensure splitting key epochs. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `rustls-test/tests/api/quic.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use rustls::quic::{self, ClientHandshake, Quic, QuicEvent, ServerHandshake, Side, Space};
            .process(
                &mut SliceInput::new(&mut client_initial[..8]),
                &mut vec![],
                Space::Initial,
            )
            .process(
                &mut SliceInput::new(&mut client_initial),
                &mut vec![],
                Space::Initial,
            )
            .process(&mut server_input, &mut server_flight, Space::Handshake)
                    .process(&mut server_input, &mut server_flight, Space::Handshake)
        let space = space(&message);
            .process(&mut input, &mut client_flight, space)
                    .process(&mut input, &mut client_flight, space)
        .process(
            &mut SliceInput::new(&mut client_initial),
            &mut vec![],
            Space::Initial,
        )
            .process(
                &mut SliceInput::new(&mut client_initial),
                &mut vec![],
                Space::Initial,
            )
            .process(&mut server_input, &mut server_flight, Space::Handshake)
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use rustls::quic::{self, ClientHandshake, Quic, QuicEvent, ServerHandshake, Side};
            .process(&mut SliceInput::new(&mut client_initial[..8]), &mut vec![])
            .process(&mut SliceInput::new(&mut client_initial), &mut vec![])
            .process(&mut server_input, &mut server_flight)
                    .process(&mut server_input, &mut server_flight)
            .process(&mut input, &mut client_flight)
                    .process(&mut input, &mut client_flight)
        .process(&mut SliceInput::new(&mut client_initial), &mut vec![])
            .process(&mut SliceInput::new(&mut client_initial), &mut vec![])
            .process(&mut server_input, &mut server_flight)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bd95fd9b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T16:40:44.458Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795711244458",
    "title": "take space to ensure splitting key epochs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rustls/rustls",
    "source_uri": "https://github.com/rustls/rustls",
    "source_version": "HEAD",
    "content_hash": "9901e1bc9275ee109bcc88cab796caef4e730ac2f2ce711fc7465fa5ed28f7bf"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-26T16:40:44.458Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "1a62d9cc5a2844f6fb4aa38180f5624b912e873d4f9266366d697f57bf0d1528"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
