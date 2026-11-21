# Candidate Directive: [CD-6KN6] RAII State Reversion for Ephemeral In-Flight Connection Registries

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
**RULE**: Any state transition marking an external resource (e.g., peer socket, connection slot, resource lock) as "in-flight" or "pending" MUST return an explicit RAII guard that rolls back the state on drop, UNLESS the guard is explicitly disarmed upon successful completion. State cleanups MUST NOT depend on the execution of post-await cleanup blocks or sequential error-handling matches.

**WHY**: When an asynchronous operation is wrapped in a deadline (such as `tokio::time::timeout`), an expired timer drops the future at its current `.await` point. Any cleanup code located after that `.await` is skipped. If a peer is registered in an `in_flight` / `connecting` hash set before the handshake and the cleanup relies on a subsequent match or function epilogue, a timeout or network drop permanently leaves the peer marked as "connecting". Subsequent connection attempts fail with `AlreadyConnecting`, permanently severing connectivity under packet loss.

**WHEN TO APPLY**: P2P handshakes, distributed lock acquisitions, leased workers, external RPC client state machines, and connection pools in any async runtime (Tokio, async-std, Go goroutines with contexts).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::net::SocketAddr;
use std::sync::Arc;
use parking_lot::Mutex;
use std::collections::HashSet;

pub struct PeerPool {
    candidates: Mutex<HashSet<SocketAddr>>,
    connecting: Mutex<HashSet<SocketAddr>>,
    connected: Mutex<HashSet<SocketAddr>>,
}

pub struct ConnectingPeerGuard {
    peer_ip: SocketAddr,
    pool: Arc<PeerPool>,
    active: bool,
}

impl ConnectingPeerGuard {
    /// Disarm the guard when the handshake successfully commits to the connected state.
    pub fn commit(mut self) {
        self.active = false;
        let mut connecting = self.pool.connecting.lock();
        let mut connected = self.pool.connected.lock();
        connecting.remove(&self.peer_ip);
        connected.insert(self.peer_ip);
    }
}

impl Drop for ConnectingPeerGuard {
    fn drop(&mut self) {
        if self.active {
            let mut connecting = self.pool.connecting.lock();
            let mut candidates = self.pool.candidates.lock();
            connecting.remove(&self.peer_ip);
            // Revert back to candidates so peer remains dialable
            candidates.insert(self.peer_ip);
        }
    }
}

impl PeerPool {
    pub fn add_connecting_peer(self: &Arc<Self>, peer_ip: SocketAddr) -> Result<ConnectingPeerGuard, String> {
        let mut candidates = self.candidates.lock();
        let mut connecting = self.connecting.lock();
        let connected = self.connected.lock();

        if connected.contains(&peer_ip) {
            return Err("AlreadyConnected".into());
        }
        if connecting.contains(&peer_ip) {
            return Err("AlreadyConnecting".into());
        }

        candidates.remove(&peer_ip);
        connecting.insert(peer_ip);

        Ok(ConnectingPeerGuard {
            peer_ip,
            pool: Arc::clone(self),
            active: true,
        })
    }
}

// Usage in async network driver:
pub async fn dial_peer(pool: Arc<PeerPool>, peer_ip: SocketAddr) -> Result<(), String> {
    let guard = pool.add_connecting_peer(peer_ip)?;
    
    // If timeout drops this future, guard drops and rolls back connecting -> candidates
    tokio::time::timeout(std::time::Duration::from_secs(10), async {
        // Execute Noise Handshake / P2P exchange...
        Ok::<(), String>(())
    })
    .await
    .map_err(|_| "Timeout")??;

    // Successful upgrade disarms the guard
    guard.commit();
    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Post-handshake cleanup relying on sequential flow
pub async fn buggy_dial_peer(pool: Arc<PeerPool>, peer_ip: SocketAddr) -> Result<(), String> {
    pool.mark_connecting(peer_ip); // Sets connecting = true

    // If timeout fires, future drops right here.
    // Lines below this point NEVER EXECUTE.
    let res = tokio::time::timeout(std::time::Duration::from_secs(10), execute_handshake(peer_ip)).await;

    match res {
        Ok(Ok(_)) => pool.mark_connected(peer_ip),
        _ => {
            // NEVER REACHED ON TIMEOUT DROP!
            // Peer remains stuck in `connecting` set forever.
            pool.revert_to_candidates(peer_ip);
        }
    }
    Ok(())
}
```

**VERIFICATION METHOD**: Write an integration unit test where the handshake future delays longer than the timeout period (`tokio::time::sleep(20s)` against a 5ms timeout). Assert that immediately after the timeout returns `Err(Elapsed)`, `pool.connecting.contains(&peer_ip)` is `false` and `pool.candidates.contains(&peer_ip)` is `true`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T08:24:30.208Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795249470208",
    "title": "RAII State Reversion for Ephemeral In-Flight Connection Registries",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aleo-labs-protocol/snarkOS",
    "source_uri": "https://github.com/aleo-labs-protocol/snarkOS",
    "source_version": "HEAD",
    "content_hash": "4a9ea04864a1d11dd8361f42a6919503d539d7e643bc63f4a0830c3dbbe63c40"
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
        "Harvested/verified timestamp recorded: 2026-11-21T08:24:30.208Z"
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
  "auth_token": "be0f3b8a9bf498a5317445795cbd6beb44d6e5313a5cfefc9c4cb92799aae872"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
