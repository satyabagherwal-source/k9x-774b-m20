# Candidate Directive: [CD-PVEI] Guarded Scope Admission with Two-Phase Disarm Ownership

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
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**:
Every background runtime scope or session generator that spawns concurrent asynchronous tasks MUST be wrapped in an RAII Preparation Guard that triggers immediate linear cancellation on `Drop`. Ownership MUST NOT be transferred implicitly; the guard MUST require an explicit `.disarm()` call once ownership has been successfully committed to the active generational supervisor.

**WHY**:
In complex async orchestrators, runtime generation changes, listener rebinds, or upstream health check setups can fail or panic midway (e.g., due to an address-in-use error, timeout, or config validation failure). If spawned child tasks run detached before full supervisor registration, orphan tasks leak memory, hold open file descriptors/epoll instances, and trigger concurrency deadlocks during runtime shutdown.

**WHEN TO APPLY**:
Apply to any daemon managing runtime generation swaps, connection drains, worker pools, or long-lived Tokio task scopes where unhandled errors during configuration changeovers can leave tasks detached.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

pub struct RuntimeTaskScope {
    cancel_token: CancellationToken,
}

impl RuntimeTaskScope {
    pub fn new() -> Self {
        Self {
            cancel_token: CancellationToken::new(),
        }
    }

    pub fn begin_stop(&self) {
        self.cancel_token.cancel();
    }
}

/// Disarmable RAII guard guarding scope transfer
#[must_use = "runtime preparation guards must be explicitly disarmed"]
pub struct RuntimePreparationGuard {
    scope: Arc<RuntimeTaskScope>,
    armed: bool,
}

impl RuntimePreparationGuard {
    pub fn new(scope: Arc<RuntimeTaskScope>) -> Self {
        Self { scope, armed: true }
    }

    /// Disarms guard and confirms that the generational supervisor took ownership
    pub fn disarm(mut self) {
        self.armed = false;
    }
}

impl Drop for RuntimePreparationGuard {

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T18:17:21.210Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794766641210",
    "title": "Guarded Scope Admission with Two-Phase Disarm Ownership",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "telemt-telemt-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "027b5f077b48bc33b1fc41d000f36c28985c65f20b25530aaee53eff51902e36"
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
        "Harvested/verified timestamp recorded: 2026-11-15T18:17:21.210Z"
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
  "auth_token": "4e07560f423ed2d4fc9718a60f35dfdc3f585a4a435d9e9029c102a3b93642ee"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
