# Candidate Directive: [CD-JK9A] Bitfield Register Truncation & Transfer Splitting Invariant

<!-- PROVENANCE_START
{
  "source_repository": "embassy-rs/embassy",
  "source_url": "https://github.com/embassy-rs/embassy",
  "source_version": "03edb03b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T07:59:55.726Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-embassy-rs-embassy",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [embassy-rs/embassy](https://github.com/embassy-rs/embassy) (Revision: `03edb03b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T07:59:55.726Z`  
> **Learning ID**: `learn-github-embassy-rs-embassy`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When configuring fixed-width peripheral hardware counter registers (such as transfer sizes in Endpoint or DMA descriptors), transfer requests exceeding the maximum representable hardware field limit ($2^N - 1$) MUST NOT be written directly to the control register. The driver MUST break the transfer down into discrete chunks equal to or smaller than the maximum hardware packet size.

**WHY**:
Hardware registers truncate overflow bits silently. In the Synopsys USB OTG core, Endpoint 0 transfer size fields (`DIEPTSIZ0.XFRSIZ` and `DOEPTSIZ0.XFRSIZ`) are only 7 bits wide (maximum 127 bytes). If software attempts to send or receive a 128-byte packet on EP0 without packetization, writing `128` (binary `10000000b`) truncates to `0` (modulo 128). The host receives 0 bytes, or for a 300-byte transfer, receives `300 mod 128 = 44` bytes, causing control pipe stalls and fatal enumeration failure.

**WHEN TO APPLY**:
All hardware register configuration routines where software buffer sizes (`usize`) are converted to fixed-bitwidth hardware registers (`u7`, `u10`, `u12`, `u16`).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub fn calculate_ep0_transfer_chunk(total_len: usize, max_packet_size: usize) -> usize {
    // Synopsys OTG EP0 DIEPTSIZ0.XFRSIZ is 7 bits (max 127 bytes).
    // Transmit exactly one max packet size (or remaining slice) per transaction.
    const EP0_MAX_XFRSIZ: usize = 127;
    assert!(max_packet_size <= EP0_MAX_XFRSIZ);
    
    total_len.min(max_packet_size)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Relying on generic GHWCFG register configuration for special endpoints
// GHWCFG3 reports endpoint counter widths for EP1-EPn, but EP0 has hardwired 7-bit limits.
let max_transfer = (1 << pac.ghwcfg3().read().xfer_size_cnt_width()) - 1;
pac.dieptsiz(0).write(|w| w.set_xfersiz(requested_len.min(max_transfer) as u32));
```

**VERIFICATION METHOD**:
Boundary assert verifying truncation prevention:
```rust
#[test]
fn test_ep0_chunking_bounds() {
    for len in [127, 128, 129, 191, 192, 256, 300, 400] {
        let chunk = calculate_ep0_transfer_chunk(len, 64);
        assert!(chunk <= 64);
        assert!(chunk <= 127);
    }
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T07:59:55.725Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794902395725",
    "title": "Bitfield Register Truncation & Transfer Splitting Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "embassy-rs/embassy",
    "source_uri": "https://github.com/embassy-rs/embassy",
    "source_version": "HEAD",
    "content_hash": "5598fa247920c16e85244a9fdee723b4547340a18ee8b11ef74debbf6cd43cc9"
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
        "Harvested/verified timestamp recorded: 2026-11-17T07:59:55.725Z"
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
  "auth_token": "cdcb503785004a4b1a920d601fdf668e78a78cc4fc5b77d81f169b8b85e14624"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
