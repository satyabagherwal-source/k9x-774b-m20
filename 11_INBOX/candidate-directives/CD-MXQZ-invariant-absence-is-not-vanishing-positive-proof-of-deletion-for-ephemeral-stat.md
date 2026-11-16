# Candidate Directive: [CD-MXQZ] Invariant Absence Is Not Vanishing: Positive Proof of Deletion for Ephemeral State

<!-- PROVENANCE_START
{
  "source_repository": "matthart1983-netwatch-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T03:06:56.870Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-matthart1983-netwatch-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matthart1983-netwatch-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T03:06:56.870Z`  
> **Learning ID**: `LEARN-EVO-matthart1983-netwatch-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:06:56.983Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794798416982",
    "title": "Invariant Absence Is Not Vanishing: Positive Proof of Deletion for Ephemeral State",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "matthart1983-netwatch-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "091fcfc895e536050dc2554ef384330a8d38d0ad6cd751fc27c40d68af928944"
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:06:56.983Z"
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
  "auth_token": "dda91627f1e9458266846fb3020c0b8087d6c18b2d918b325f09cb751401204f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
