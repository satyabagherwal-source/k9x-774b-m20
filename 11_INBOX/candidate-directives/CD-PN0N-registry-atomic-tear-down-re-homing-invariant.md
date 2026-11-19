# Candidate Directive: [CD-PN0N] Registry Atomic Tear-Down & Re-Homing Invariant

<!-- PROVENANCE_START
{
  "source_repository": "iii-hq-iii-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T22:07:48.034Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-iii-hq-iii-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [iii-hq-iii-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T22:07:48.034Z`  
> **Learning ID**: `LEARN-EVO-iii-hq-iii-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When deregistering dynamic event bindings or triggers from a concurrent registry, the caller MUST teardown the binding against the provider identified by the entry *actually removed* from the atomic concurrent map, and MUST NOT use a pre-deregistration snapshot or stale read reference.

**WHY**:
In concurrent systems where bindings can be re-homed (e.g., fallback provider $\to$ dedicated provider) while a worker deregistration is in-flight, tearing down the provider stored in a stale snapshot deregisters the binding from the wrong provider (or a no-op target), while the new provider continues firing the trigger forever without any tracking entry in the registry.

**WHEN TO APPLY**:
Dynamic event buses, trigger registries, worker disconnect loops, pub/sub topic managers, and connection managers using concurrent hash maps (`DashMap`, `RwLock<HashMap>`).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified architectural pattern from engine/src/trigger.rs (Incident #2237)
use dashmap::DashMap;
use std::sync::Arc;

pub struct TriggerEntry {
    pub worker_id: String,
    pub provider_key: String,
}

pub struct TriggerRegistry {
    // Key: binding_id, Value: TriggerEntry
    bindings: Arc<DashMap<String, TriggerEntry>>,
}

impl TriggerRegistry {
    pub async fn unregister_worker(&self, worker_id: &str) {
        // Collect candidate keys
        let candidate_keys: Vec<String> = self.bindings
            .iter()
            .filter(|entry| entry.value().worker_id == worker_id)
            .map(|entry| entry.key().clone())
            .collect();

        for key in candidate_keys {
            // Atomic conditional removal: extract the exact value removed from memory
            let removed = self.bindings.remove_if(&key, |_, entry| entry.worker_id == worker_id);
            
            if let Some((_key, actual_entry)) = removed {
                // Invariant: Unregister against actual_entry.provider_key, NOT a stale snapshot!
                self.teardown_provider_trigger(&actual_entry.provider_key, &key).await;
            }
        }
    }

    async fn teardown_provider_trigger(&self, provider_key: &str, binding_id: &str) {
        // Sends unregister signal to the verified live provider
    }
}

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T22:07:48.166Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795126068166",
    "title": "Registry Atomic Tear-Down & Re-Homing Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "iii-hq-iii-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "14a0414b27915e888564a15b84d4dfecd6a08e0f0e71db2b46660424ebe8feb6"
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:07:48.166Z"
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
  "auth_token": "919d467108f697148a4ff4ef26daec53a2fc0e6a2a2a20b5642525c6f22eb771"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
