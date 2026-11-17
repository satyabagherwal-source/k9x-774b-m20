# Candidate Directive: [CD-2SCH] Generational Host State-Aware Retry Invariant

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq/Codewhale",
  "source_url": "https://github.com/codewhale-hq/Codewhale",
  "source_version": "9c7cb976",
  "license": "MIT",
  "timestamp": "2026-11-17T19:54:43.073Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-codewhale-hq-codewhale",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale) (Revision: `9c7cb976`).  
> **License**: MIT | **Timestamp**: `2026-11-17T19:54:43.073Z`  
> **Learning ID**: `learn-github-codewhale-hq-codewhale`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When an RPC or IPC client initiates a connection to an ephemeral, supervised worker process, it MUST NOT treat an in-flight status of `Restarting` or `Unresponsive` as a fatal terminal error. The connector MUST sample the supervisor's generational counter (`host_generation: AtomicU64`), await recovery via an asynchronous state-change notification bounded by the overall operation deadline, and verify that the target host generation has incremented before retrying.

**WHY**:
Supervised host environments recycle processes periodically due to memory limits, dirty process terminations, or dynamic reconfiguration. If an orchestrator attempts an MCP or plugin connection in the idle gap between an unmount and a respawn, classifying `Restarting` as an immediate connection failure causes non-deterministic operational flakes under load.

**WHEN TO APPLY**:
Subsystems managing child processes, plugin runtimes, local MCP servers, language servers (LSP), and supervised microservices managed via supervisors with automated self-healing.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::time::{Instant, timeout_at};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostStatus {
    Starting,
    Active,
    Restarting,
    Unresponsive,
    Dead,
}

pub struct SupervisorState {
    pub generation: AtomicU64,
    pub status: parking_lot::RwLock<HostStatus>,
    pub notify: tokio::sync::Notify,
}

#[derive(Debug, thiserror::Error)]
pub enum ConnectionError {
    #[error("Client operation deadline exceeded")]
    DeadlineExceeded,
    #[error("Host permanently failed: {0}")]
    Fatal(String),
}

pub async fn connect_with_generational_retry<C, F, Fut>(
    supervisor: Arc<SupervisorState>,
    deadline: Instant,
    mut connect_fn: F,
) -> Result<C, ConnectionError>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<C, String>>,
{
    loop {
        let initial_gen = supervisor.generation.load(Ordering::SeqCst);
        let status = *supervisor.status.read();

        match status {
            HostStatus::Active => {
                let attempt = connect_fn();
                match timeout_at(deadline, attempt).await {
                    Ok(Ok(client)) => return Ok(client),
                    Ok(Err(err)) => {
                        // Check if connection failed because host began recycling mid-flight
                        let current_gen = supervisor.generation.load(Ordering::SeqCst);
                        let is_restarting = matches!(
                            *supervisor.status.read(),
                            HostStatus::Restarting | HostStatus::Starting
                        );
                        if current_gen == initial_gen && !is_restarting {
                            return Err(ConnectionError::Fatal(err));
                        }
                    }
                    Err(_) => return Err(ConnectionError::DeadlineExceeded),
                }
            }
            HostStatus::Starting | HostStatus::Restarting | HostStatus::Unresponsive => {
                // Passively wait for generation increment or state notification within deadline
            }
            HostStatus::Dead => return Err(ConnectionError::Fatal("Host declared dead".into())),
        }

        // Bounded passive wait
        let notification = supervisor.notify.notified();
        if timeout_at(deadline, notification).await.is_err() {
            return Err(ConnectionError::DeadlineExceeded);
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Failing fast on supervisor transitional states
let status = supervisor.get_status();
if status == HostStatus::Restarting {
    // BUG: Rejects valid in-flight operations during planned recycling
    return Err(ConnectionError::Fatal("Extension host is restarting".into()));
}
```

**VERIFICATION METHOD**:
Inject a synthetic planned recycle trigger (`fire_pre_connect_hook`) immediately prior to socket dial. Verify with a deterministic test harness that the operation pauses without raising an error, waits for the generation counter to bump, and cleanly connects within the outer deadline window.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T19:54:43.071Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794945283071",
    "title": "Generational Host State-Aware Retry Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "codewhale-hq/Codewhale",
    "source_uri": "https://github.com/codewhale-hq/Codewhale",
    "source_version": "HEAD",
    "content_hash": "d945f9acfffb2d3f996aa38fbd6eb0a2bcde86801cac116d87fedfc430c56789"
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
        "Harvested/verified timestamp recorded: 2026-11-17T19:54:43.071Z"
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
  "auth_token": "f0184079b4015d4d21a2b4b434567e685df056099310a6647ff4c13c89fa56d2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
