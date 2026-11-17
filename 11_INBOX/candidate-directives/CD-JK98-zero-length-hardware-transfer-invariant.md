# Candidate Directive: [CD-JK98] Zero-Length Hardware Transfer Invariant

<!-- PROVENANCE_START
{
  "source_repository": "embassy-rs/embassy",
  "source_url": "https://github.com/embassy-rs/embassy",
  "source_version": "03edb03b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T07:59:55.724Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-embassy-rs-embassy",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [embassy-rs/embassy](https://github.com/embassy-rs/embassy) (Revision: `03edb03b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T07:59:55.724Z`  
> **Learning ID**: `learn-github-embassy-rs-embassy`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Low-level protocol drivers (USB, SPI, I2C, UART) MUST NOT invoke bus-level peripheral read/transfer primitives when the expected transfer length (`wLength` / requested bytes) is exactly zero (`0`), unless the underlying hardware specification explicitly mandates a zero-length packet (ZLP) handshake for that state.

**WHY**:
In USB control endpoint state machines and DMA engine setups, calling an asynchronous `data_out_transfer(buf)` with a 0-length buffer instructs hardware or low-level state machines to wait for an OUT data packet from the host. If the transaction lacks a data stage (e.g., standard Chapter 9 requests like `SET_ADDRESS` or `SET_CONFIGURATION`), the host advances directly to the STATUS stage (handshake IN). Calling `data_out_transfer` causes the peripheral driver to await a non-existent host OUT packet, locking the control pipe indefinitely, triggering host bus-reset timeouts (~3000ms), and preventing device enumeration.

**WHEN TO APPLY**:
Hardware abstraction layers, USB device/host protocol stacks, DMA controllers, and asynchronous packet-oriented communications where zero-length transactions denote state transitions rather than data payloads.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified zero-stage check in USB Control Pipe dispatch
let total = if req_length == 0 {
    // Fast-path: Requests without a data stage (e.g. SET_ADDRESS) bypass the driver OUT transfer.
    0
} else {
    // Only arm hardware endpoint when a physical payload is required
    match self
        .control
        .data_out_transfer(&mut self.control_buf[..req_length])
        .await
    {
        Ok(total) => total,
        Err(e) => {
            warn!("usb: failed to receive CONTROL OUT data stage: {:?}", e);
            return;
        }
    }
};
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blindly delegating buffer slice without checking length == 0.
// If req_length is 0, &mut buf[..0] is valid slice syntax, but triggers
// an unresolved hardware listen on endpoint 0!
let total = self.control.data_out_transfer(&mut self.control_buf[..req_length]).await?;
```

**VERIFICATION METHOD**:
Enforce an assertion inside the driver/mock control pipe:
```rust
#[test]
fn test_data_out_transfer_rejects_empty_slice() {
    let mut mock = TestControlPipe::new();
    let mut empty_buf = [];
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        pollster::block_on(mock.data_out_transfer(&mut empty_buf))
    }));
    assert!(result.is_err(), "data_out_transfer MUST panic on empty buffer");
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T07:59:55.722Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794902395722",
    "title": "Zero-Length Hardware Transfer Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "embassy-rs/embassy",
    "source_uri": "https://github.com/embassy-rs/embassy",
    "source_version": "HEAD",
    "content_hash": "1d7ed7ee611c04ad4b40974e559e8c46753021f52e0573de33f84ee9b5bfa842"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T07:59:55.722Z"
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
  "auth_token": "c969afdd4a4818f4358fc44254b8ceaab60ecff8fcfb3d0fe4bdc49766e78f39"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
