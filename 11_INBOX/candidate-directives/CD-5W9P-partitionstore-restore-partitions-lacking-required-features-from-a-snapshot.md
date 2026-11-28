# Candidate Directive: [CD-5W9P] [PartitionStore] Restore partitions lacking required features from a snapshot

<!-- PROVENANCE_START
{
  "source_repository": "restatedev/restate",
  "source_url": "https://github.com/restatedev/restate",
  "source_version": "85c63335",
  "license": "NOASSERTION",
  "timestamp": "2026-11-28T05:33:42.685Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-restatedev-restate",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [restatedev/restate](https://github.com/restatedev/restate) (Revision: `85c63335`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-28T05:33:42.685Z`  
> **Learning ID**: `learn-github-restatedev-restate`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/partition-store/src/partition_store_manager.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in restatedev/restate. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e667b46a`: [PartitionStore] Restore partitions lacking required features from a snapshot. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/partition-store/src/partition_store_manager.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use restate_types::partitions::{Partition, PartitionFeatureChange};
        self.open_cancellable(partition, target_lsn, &[], &CancellationToken::new())
    ///
    /// If the local store lacks one of `required_features`, it is replaced by the newest snapshot
    /// that has them. If no snapshot has them, the local store is opened as it is. Without a
    /// local store to fall back to, the newest snapshot is restored whether it has them or not.
    /// The caller decides what to do with a store that lacks them.
        required_features: &[PartitionFeatureChange],
        // If we already have the partition locally and it meets the fast-forward target and has the
        // required features, then we simply return it.
        // A local store that meets the target LSN but lacks required features. It is used if no
        // snapshot has the features either.
        let mut local_store = None;
            let meets_target_lsn = match target_lsn {
                None => true,
                    my_applied_lsn.unwrap_or(Lsn::INVALID) >= min_applied_lsn
                }
            };
            if meets_target_lsn {
                if required_features.is_empty() {
             
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use restate_types::partitions::Partition;
        self.open_cancellable(partition, target_lsn, &CancellationToken::new())
        // If we already have the partition locally and we don't have a fast-forward target, or the
        // store already meets the target LSN requirement, then we simply return it.
            // we have a database, but perhaps it doesn't meet the min_applied_lsn requirement?
            match target_lsn {
                None => return Ok(partition_store),
                    if my_applied_lsn.unwrap_or(Lsn::INVALID) >= min_applied_lsn {
                        // We have an initialized partition store, and no fast-forward target - go on and open it.
                        return Ok(partition_store);
                    }
        // target-lsn target higher than our local state (probably due to seeing a log trim-gap).
        // Attempt to get a suitable snapshot from the repository:
            .download_snapshot(partition.partition_id, target_lsn, cancellation)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e667b46a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T05:33:42.683Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795844022683",
    "title": "[PartitionStore] Restore partitions lacking required features from a snapshot",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "restatedev/restate",
    "source_uri": "https://github.com/restatedev/restate",
    "source_version": "HEAD",
    "content_hash": "0de9a4d7cfdbd97ac12724129188afd10bd25c1b8aadf2b4f480b488df3a95c7"
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
        "Harvested/verified timestamp recorded: 2026-11-28T05:33:42.683Z"
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
  "auth_token": "572701d986cef4640f810358bc0d1c81c619b09b1b35209bd1aaac574ba80cb3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
