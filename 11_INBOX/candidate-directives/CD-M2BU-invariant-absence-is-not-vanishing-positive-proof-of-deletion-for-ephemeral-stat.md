# Candidate Directive: [CD-M2BU] Invariant Absence Is Not Vanishing: Positive Proof of Deletion for Ephemeral State

<!-- PROVENANCE_START
{
  "source_repository": "matthart1983/netwatch",
  "source_url": "https://github.com/matthart1983/netwatch",
  "source_version": "e11c8c49",
  "license": "MIT",
  "timestamp": "2026-11-16T03:06:16.266Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-matthart1983-netwatch",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matthart1983/netwatch](https://github.com/matthart1983/netwatch) (Revision: `e11c8c49`).  
> **License**: MIT | **Timestamp**: `2026-11-16T03:06:16.266Z`  
> **Learning ID**: `learn-github-matthart1983-netwatch`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
A monitoring or diagnostic state engine MUST NOT transition an active incident or entity to an expired, closed, or pruned state merely due to the absence of fresh telemetry. An entity MUST ONLY transition to "Gone" or "Closed" through an explicit, positive proof of removal (e.g., interface unlisted by OS, socket missing from an exhaustive sweep, explicit configuration deletion) validated against a bounded collector freshness window.

**WHY**:
Network hiccups, saturated thread pools, or dropped probe packets routinely cause collectors to skip sampling cycles. If missing data is treated as resolution or entity termination:
- Flapping alerts trigger false recovery notifications followed immediately by duplicate incident tickets.
- The diagnostic continuity window is destroyed, turning a persistent degraded state into thousands of disconnected ephemeral events.
- Historical baselines become poisoned with synthetic downtimes.

**WHEN TO APPLY**:
- Telemetry ingestion pipelines, infrastructure monitoring agents, distributed tracing collectors, network link evaluators, and distributed state machines tracking dynamic peer lists.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified pattern derived from src/diagnose/engine.rs (subject_gone)
use std::time::{Duration, Instant};

pub enum Subject {
    Socket { local: String, remote: String },
    Interface { name: String },
    Target { id: String, config_hash: u64 },
}

pub struct CollectorStatus {
    pub last_completed: Option<Instant>,
    pub reported_exhaustive: bool,
}

pub struct SystemSnapshot {
    pub sockets: Vec<(String, String)>,
    pub interfaces: Vec<String>,
    pub configured_target_hashes: Vec<u64>,
}

impl CollectorStatus {
    pub fn is_fresh(&self, max_age: Duration, now: Instant) -> bool {
        self.last_completed
            .map(|t| now.duration_since(t) <= max_age)
            .unwrap_or(false)
    }
}

pub fn verify_subject_gone(
    subject: &Subject,
    snapshot: &SystemSnapshot,
    collector: &CollectorStatus,
    now: Instant,
) -> Option<&'static str> {
    match subject {
        Subject::Socket { local, remote } => {
            // Requirement 1: Collector must be recently refreshed (<= 30s)
            // Requirement 2: Collector must have scanned the entire socket table exhaustively
            // Requirement 3: Target socket must be explicitly absent from the sweep
            let fresh = collector.is_fresh(Duration::from_secs(30), now);
            let present = snapshot.sockets.iter().any(|(l, r)| l == local && r == remote);
            
            if fresh && collector.reported_exhaustive && !present {
                Some("socket closed (confirmed via fresh exhaustive sweep)")
            } else {
                None // Collector lag or partial read: leave issue open
            }
        }
        Subject::Interface { name } => {
            let fresh = collector.is_fresh(Duration::from_secs(15), now);
            let present = snapshot.interfaces.iter().any(|i| i == name);
            
            if fresh && !present {
                Some("interface removed from kernel device table")
            } else {
                None
            }
        }
        Subject::Target { id: _, config_hash } => {
            // Configuration changes are authoritative: positive proof of removal
            if !snapshot.configured_target_hashes.contains(config_hash) {
                Some("target configuration hash changed or removed")
            } else {
                None
            }
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// CRITICAL DEFECT: Ephemeral disappearance assumed when telemetry times out
pub fn check_socket_bad(last_seen: Instant, now: Instant) -> bool {
    // VIOLATION: If the socket scraper stalled, thread starved, or collector errored,
    // this causes the engine to mark the connection closed, clearing errors falsely.
    if now.duration_since(last_seen) > Duration::from_secs(5) {
        return true; // ASSUMED GONE - DO NOT WRITE THIS
    }
    false
}
```

**VERIFICATION METHOD**:
Enforce unit and property tests that inject collector starvation (simulate `CollectorStatus::last_completed = None` or frozen timestamp) and assert that all tracked entities remain strictly in their current state across arbitrary tick iterations without triggering state transitions.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:06:16.263Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794798376263",
    "title": "Invariant Absence Is Not Vanishing: Positive Proof of Deletion for Ephemeral State",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "matthart1983/netwatch",
    "source_uri": "https://github.com/matthart1983/netwatch",
    "source_version": "HEAD",
    "content_hash": "a29b66236422144497677d23bb60ce96cecc329e4feed2ff497343306bd9a4ee"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:06:16.263Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "a06a48cca18cfc6bcf264e746320adedecd96ae77e47300b07fe3fdf14bfb6c8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
