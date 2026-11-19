# Candidate Directive: [CD-OGVZ] Registry Atomic Tear-Down & Re-Homing Invariant

<!-- PROVENANCE_START
{
  "source_repository": "iii-hq/iii",
  "source_url": "https://github.com/iii-hq/iii",
  "source_version": "7fd8bb9f",
  "license": "PERMISSIVE_OPEN_SOURCE",
  "timestamp": "2026-11-19T22:06:53.567Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-iii-hq-iii",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [iii-hq/iii](https://github.com/iii-hq/iii) (Revision: `7fd8bb9f`).  
> **License**: PERMISSIVE_OPEN_SOURCE | **Timestamp**: `2026-11-19T22:06:53.567Z`  
> **Learning ID**: `learn-github-iii-hq-iii`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER DO THIS: Snapshotting the collection and acting on the snapshot provider_key
pub async fn unregister_worker_buggy(&self, worker_id: &str) {
    let snapshot: Vec<(String, TriggerEntry)> = self.bindings
        .iter()
        .filter(|e| e.worker_id == worker_id)
        .map(|e| (e.key().clone(), e.value().clone()))
        .collect();

    for (key, snap_entry) in snapshot {
        self.bindings.remove(&key);
        // RACE CONDITION: If another task re-homed `key` between snapshot and remove,
        // snap_entry.provider_key points to the OLD provider.
        // The NEW provider is never told to unregister and fires orphaned events!
        self.teardown_provider_trigger(&snap_entry.provider_key, &key).await;
    }
}
```

**VERIFICATION METHOD**:
Implement a multithreaded test spawning concurrent workers that continuously re-home triggers between two mock providers while an unregister loop executes. Assert that upon completion of `unregister_worker`, the active count of triggers registered across all providers is identically zero.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T22:06:53.566Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795126013566",
    "title": "Registry Atomic Tear-Down & Re-Homing Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "iii-hq/iii",
    "source_uri": "https://github.com/iii-hq/iii",
    "source_version": "HEAD",
    "content_hash": "b11ea83ea880e13d594ec9e3dd68f880b8071c0792d5aaa253c4f31ec5f83c21"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:06:53.566Z"
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
  "auth_token": "a888ba0c3a74955d1d394fd6adb8b28de881f75d1f59612cb783763ab69ed4c6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
