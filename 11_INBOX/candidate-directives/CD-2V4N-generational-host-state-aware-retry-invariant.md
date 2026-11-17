# Candidate Directive: [CD-2V4N] Generational Host State-Aware Retry Invariant

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq-codewhale-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T19:54:46.575Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-codewhale-hq-codewhale-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq-codewhale-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T19:54:46.575Z`  
> **Learning ID**: `LEARN-EVO-codewhale-hq-codewhale-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T19:54:46.675Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794945286675",
    "title": "Generational Host State-Aware Retry Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "codewhale-hq-codewhale-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "0ad23446c3d30f10e7f263c1d2f345387d7759b1cccfd6481d72b80a471e4bf4"
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
        "Harvested/verified timestamp recorded: 2026-11-17T19:54:46.676Z"
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
  "auth_token": "92e114ec6297552966905a6ea75acc3ebbd41a41a6a67f5640ecb003df2d7c9d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
