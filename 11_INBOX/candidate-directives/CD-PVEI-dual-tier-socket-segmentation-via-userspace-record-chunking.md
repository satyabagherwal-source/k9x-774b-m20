# Candidate Directive: [CD-PVEI] Dual-Tier Socket Segmentation via Userspace Record Chunking

<!-- PROVENANCE_START
{
  "source_repository": "telemt-telemt-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T18:17:21.112Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-telemt-telemt-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [telemt-telemt-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T18:17:21.112Z`  
> **Learning ID**: `LEARN-EVO-telemt-telemt-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain L

## Original Learning Payload (100% Preserved)
**RULE**:
When shaping outbound TCP transport traffic to evade network pattern-matching (such as DPI fingerprinting) on established TCP sockets under Linux, software MUST NOT rely on modifying `TCP_MAXSEG` via `setsockopt`. Instead, software MUST execute explicit userspace fragmentation using `MSG_EOR` stream flags while factoring in negotiated TCP timestamp header overheads.

**WHY**:
In the Linux network stack (`net/ipv4/tcp.c`), calling `setsockopt(fd, IPPROTO_TCP, TCP_MAXSEG, ...)` on an already established connection (`TCP_ESTABLISHED`) only alters the internal `tp->rx_opt.user_mss` setting for future incoming MSS advertisements; it does **not** recalculate or clamp `tp->snd_mss` for outbound transmission queues. Attempting to clamp MSS post-handshake to shape the initial `ServerHello` record silently fails, causing full-sized MTU packets (1500 bytes) to hit the wire and allowing DPI systems to immediately flag and censor the connection.

**WHEN TO APPLY**:
Apply to any high-performance network proxy, anti-censorship transport layer, or obfuscation tunnel implementing custom TLS/TCP segment layout shaping under Linux.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::io::{self, IoSlice};
use std::os::fd::AsRawFd;
use tokio::net::TcpStream;

pub struct DualTierMssWriter<'a> {
    stream: &'a TcpStream,
    handshake_mss: usize,
    bulk_mss: usize,
    prefix_budget: usize,
    has_timestamps: bool,
}

impl<'a> DualTierMssWriter<'a> {
    pub fn new(
        stream: &'a TcpStream,
        handshake_mss: usize,
        bulk_mss: usize,
        prefix_limit: usize,
        has_timestamps: bool,
    ) -> Self {
        // TCP Timestamp option (RFC 7323) consumes exactly 12 bytes in TCP options
        let timestamp_overhead = if has_timestamps { 12 } else { 0 };
        let effective_handshake_mss = handshake_mss.saturating_sub(timestamp_overhead).max(64);

        Self {
            stream,
            handshake_mss: effective_handshake_mss,
            bulk_mss,
            prefix_budget: prefix_limit,
            has_timestamps,
        }
    }

    /// Writes data enforcing userspace chunking for the handshake prefix
    pub async fn write_shaped_prefix(&mut self, payload: &[u8]) -> io::Result<usize> {
        let fd = self.stream.as_raw_fd();
        let mut total_written = 0;

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T18:17:21.206Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794766641206",
    "title": "Dual-Tier Socket Segmentation via Userspace Record Chunking",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "telemt-telemt-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8a505034b454147079c6f739c8ca1b624ca04e00ce5b52432cb6904507aff030"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-15T18:17:21.207Z"
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
  "auth_token": "f5641e6328a5d4f03abc0586633e9ae1ce3fe1e6981905c11cd19398bf924f81"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
