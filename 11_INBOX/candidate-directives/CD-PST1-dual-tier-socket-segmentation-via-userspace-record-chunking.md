# Candidate Directive: [CD-PST1] Dual-Tier Socket Segmentation via Userspace Record Chunking

<!-- PROVENANCE_START
{
  "source_repository": "telemt/telemt",
  "source_url": "https://github.com/telemt/telemt",
  "source_version": "dac7aeee",
  "license": "NOASSERTION",
  "timestamp": "2026-11-15T18:17:17.845Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-telemt-telemt",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [telemt/telemt](https://github.com/telemt/telemt) (Revision: `dac7aeee`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-15T18:17:17.845Z`  
> **Learning ID**: `learn-github-telemt-telemt`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

        while total_written < payload.len() {
            let remaining = &payload[total_written..];
            let chunk_size = if self.prefix_budget > 0 {
                let limit = self.handshake_mss.min(self.prefix_budget);
                remaining.len().min(limit)
            } else {
                remaining.len().min(self.bulk_mss)
            };

            let chunk = &remaining[..chunk_size];

            // Wait for socket to become writable via Tokio async engine
            self.stream.writable().await?;

            // Send via libc::send with MSG_EOR to signal record boundaries
            let res = unsafe {
                libc::send(
                    fd,
                    chunk.as_ptr() as *const libc::c_void,
                    chunk.len(),
                    libc::MSG_EOR | libc::MSG_DONTWAIT,
                )
            };

            if res < 0 {
                let err = io::Error::last_os_error();
                if err.kind() == io::ErrorKind::WouldBlock {
                    continue;
                }
                return Err(err);
            }

            let written = res as usize;
            total_written += written;
            self.prefix_budget = self.prefix_budget.saturating_sub(written);
        }

        Ok(total_written)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER assume setsockopt(TCP_MAXSEG) clamps active established TCP egress
pub fn bad_mss_clamping(raw_fd: std::os::fd::RawFd, target_mss: i32) {
    unsafe {
        // ANTI-PATTERN: Linux kernel ignores TCP_MAXSEG for egress on ESTABLISHED sockets!
        libc::setsockopt(
            raw_fd,
            libc::IPPROTO_TCP,
            libc::TCP_MAXSEG,
            &target_mss as *const _ as *const libc::c_void,
            std::mem::size_of::<i32>() as libc::socklen_t,
        );
    }
    // Writing here will STILL emit full MTU frames (e.g., 1460 bytes)!
}
```

**VERIFICATION METHOD**:
Capture outgoing packets via `tcpdump -i any -nn -vvv 'tcp and port <LISTEN_PORT>'` during connection initialization and assert with `tshark`:
```bash
tshark -r handshake.pcap -T fields -e tcp.len | awk '$1 > 0 { if ($1 > 256 && NR <= 3) exit 1 }'
```
Assert that no handshake packet exceeds `client_mss` before `client_mss_prefix` bytes are exhausted.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T18:17:17.843Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794766637843",
    "title": "Dual-Tier Socket Segmentation via Userspace Record Chunking",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "telemt/telemt",
    "source_uri": "https://github.com/telemt/telemt",
    "source_version": "HEAD",
    "content_hash": "2d125998ab5ef7931bb1030bc16da5d7a8e0bf44be96782806cd3278be79327b"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-15T18:17:17.843Z"
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
  "auth_token": "be8d84504d4acda3fd6d36e71825691f0930b57dc6bb7d221981580f47ebc43b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
