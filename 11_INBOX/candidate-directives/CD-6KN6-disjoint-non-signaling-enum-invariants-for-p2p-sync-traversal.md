# Candidate Directive: [CD-6KN6] Disjoint Non-Signaling Enum Invariants for P2P Sync Traversal

<!-- PROVENANCE_START
{
  "source_repository": "aleo-labs-protocol/snarkOS",
  "source_url": "https://github.com/aleo-labs-protocol/snarkOS",
  "source_version": "ffa93916",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T08:24:30.210Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aleo-labs-protocol-snarkos",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aleo-labs-protocol/snarkOS](https://github.com/aleo-labs-protocol/snarkOS) (Revision: `ffa93916`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T08:24:30.210Z`  
> **Learning ID**: `learn-github-aleo-labs-protocol-snarkos`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**: Network synchronization protocols answering range-based collection queries MUST return an explicit disjoint status variant (`Served`, `Pruned`, `NotYet`) instead of failing silently, closing streams, or returning partial responses when the requested range cannot be fulfilled. Senders MUST tag out-of-bounds states with valid boundary markers, and receivers MUST validate that the status payload does not contradict the request specification before adjusting sync cursors.

**WHY**: If a sync protocol only allows returning blocks or failing the request, requesting blocks from a peer that hasn't reached that height or has pruned its historical state causes either generic timeout drops or false peer disconnection. When nodes are partitioned or catching up, this causes infinite request retry loops, redundant round-trips, and incorrect peer blacklisting. Furthermore, unvalidated status messages allow malicious peers to poison sync progress by returning false pruning floors.

**WHEN TO APPLY**: Any distributed ledger, distributed log, or chunk-based file transfer protocol that relies on peer range requests (`start_height..end_height`).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::net::SocketAddr;

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct RangeRequest {
    pub start: u64,
    pub end: u64,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum RangeResponseStatus {
    Data,
    Pruned { oldest_retained: u64 },
    NotYet { latest_height: u64 },
}

impl RangeResponseStatus {
    /// Invariant: Peer status cannot contradict request bounds.
    pub fn ensure_consistent_with(&self, peer: SocketAddr, request: &RangeRequest) -> Result<(), String> {
        match *self {
            Self::Data => Ok(()),
            Self::Pruned { oldest_retained } if request.start >= oldest_retained => {
                Err(format!(
                    "Contradiction from {peer}: requested start {} is >= oldest retained {}",
                    request.start, oldest_retained
                ))
            }
            Self::NotYet { latest_height } if request.end.saturating_sub(1) <= latest_height => {
                Err(format!(
                    "Contradiction from {peer}: requested end {} is <= latest known height {}",
                    request.end, latest_height
                ))
            }
            _ => Ok(()),
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Returning empty lists or dropping requests on bounds mismatch
pub fn serve_request(req: RangeRequest, current_tip: u64) -> Option<Vec<u8>> {
    if req.end > current_tip {
        // Bad: Receiver cannot distinguish between "peer timed out", "peer has no data",
        // or "peer is behind", leading to cyclic requerying or banning honest lagging peers.
        return None; 
    }
    Some(fetch_data(req))
}
```

**VERIFICATION METHOD**: Property test using `proptest`: Generate arbitrary tuples of `(start, end, status)`. Verify that `status.ensure_consistent_with()` strictly fails whenever `status == Pruned && start >= oldest_retained` or `status == NotYet && end - 1 <= latest_height`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T08:24:30.210Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795249470210",
    "title": "Disjoint Non-Signaling Enum Invariants for P2P Sync Traversal",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aleo-labs-protocol/snarkOS",
    "source_uri": "https://github.com/aleo-labs-protocol/snarkOS",
    "source_version": "HEAD",
    "content_hash": "985dacc92e47518f8fb87b955e55f35c5697d27bbe331f3cdbb30582ccbab43d"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T08:24:30.210Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "5f40985d7409f2b662c8a203d567ec2ff5c69f45d5fce1a81767f1a6a89c0826"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
