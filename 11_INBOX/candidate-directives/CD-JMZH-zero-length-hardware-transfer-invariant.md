# Candidate Directive: [CD-JMZH] Zero-Length Hardware Transfer Invariant

<!-- PROVENANCE_START
{
  "source_repository": "embassy-rs-embassy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T07:59:59.183Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-embassy-rs-embassy-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [embassy-rs-embassy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T07:59:59.183Z`  
> **Learning ID**: `LEARN-EVO-embassy-rs-embassy-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T07:59:59.257Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794902399256",
    "title": "Zero-Length Hardware Transfer Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "embassy-rs-embassy-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c56657a75d13b26d7a34cd438c2de8f201ca58ce0105b51946211fccfa1407c1"
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
        "Harvested/verified timestamp recorded: 2026-11-17T07:59:59.257Z"
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
  "auth_token": "074cc8f780e1b73519f896794e9d7b3641e1d5f777c777a8e5aeb8132aa643ca"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
