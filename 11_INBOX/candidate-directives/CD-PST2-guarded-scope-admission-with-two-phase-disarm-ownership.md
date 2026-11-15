# Candidate Directive: [CD-PST2] Guarded Scope Admission with Two-Phase Disarm Ownership

<!-- PROVENANCE_START
{
  "source_repository": "telemt/telemt",
  "source_url": "https://github.com/telemt/telemt",
  "source_version": "dac7aeee",
  "license": "NOASSERTION",
  "timestamp": "2026-11-15T18:17:17.846Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-telemt-telemt",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [telemt/telemt](https://github.com/telemt/telemt) (Revision: `dac7aeee`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-15T18:17:17.846Z`  
> **Learning ID**: `learn-github-telemt-telemt`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    fn drop(&mut self) {
        if self.armed {
            // Cancel everything immediately if aborted before clean ownership handoff
            self.scope.begin_stop();
        }
    }
}

pub struct GenerationSupervisor {
    active_scope: Arc<RuntimeTaskScope>,
}

impl GenerationSupervisor {
    pub async fn transition_generation(&mut self) -> Result<(), &'static str> {
        let new_scope = Arc::new(RuntimeTaskScope::new());
        let guard = RuntimePreparationGuard::new(Arc::clone(&new_scope));

        // Perform volatile asynchronous initialization:
        // If this returns an Err or panics, `guard` drops and cancels `new_scope`
        risky_subsystem_bind().await?;

        // Commit ownership safely
        self.active_scope = new_scope;
        guard.disarm();

        Ok(())
    }
}

async fn risky_subsystem_bind() -> Result<(), &'static str> {
    // Simulated potential failure point
    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER spawn asynchronous background workers across generations without RAII drop guards
pub async fn bad_task_init() -> Result<(), &'static str> {
    let cancel = CancellationToken::new();
    // Task spawned without an ownership-transfer guard
    tokio::spawn(async move {
        // Runs forever if downstream registration fails
    });
    risky_subsystem_bind().await?; // If this errors, the spawned task is orphaned!
    Ok(())
}
```

**VERIFICATION METHOD**:
Implement a property-based test or deterministic unit test with `NotifyOnDrop` that forces an error after spawning a child task inside the scope, asserting that `scope.cancellation_token().is_cancelled()` evaluates to `true` and the child task terminates within 100 milliseconds.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T18:17:17.845Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794766637845",
    "title": "Guarded Scope Admission with Two-Phase Disarm Ownership",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "telemt/telemt",
    "source_uri": "https://github.com/telemt/telemt",
    "source_version": "HEAD",
    "content_hash": "b7509c6c409b6a75c65ee23fc0dba1c9c4933856e850edc0a41a9a97f255bd37"
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
        "Harvested/verified timestamp recorded: 2026-11-15T18:17:17.845Z"
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
  "auth_token": "0fef5d481fe04beac73a3d4d7980a4d5395d2e6db65e1e32069b873a7c6560c8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
