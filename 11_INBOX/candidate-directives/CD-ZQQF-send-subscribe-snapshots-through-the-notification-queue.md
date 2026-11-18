# Candidate Directive: [CD-ZQQF] send subscribe snapshots through the notification queue

<!-- PROVENANCE_START
{
  "source_repository": "risingwavelabs/risingwave",
  "source_url": "https://github.com/risingwavelabs/risingwave",
  "source_version": "5d7a0e11",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T03:48:14.487Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-risingwavelabs-risingwave",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [risingwavelabs/risingwave](https://github.com/risingwavelabs/risingwave) (Revision: `5d7a0e11`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T03:48:14.487Z`  
> **Learning ID**: `learn-github-risingwavelabs-risingwave`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/meta/src/manager/notification.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in risingwavelabs/risingwave. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5d7a0e11`: meta): send subscribe snapshots through the notification queue. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/meta/src/manager/notification.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
enum Target {
    Subscribers {
        subscribe_type: SubscribeType,
        // `None` indicates sending to all subscribers of `subscribe_type`.
        worker_key: Option<WorkerKey>,
    },
    /// The sender of one subscribe call. By the time the task is delivered, the worker may have
    /// subscribed again and replaced its entry in the sender map.
    Sender(UnboundedSender<Notification>),
        Self::Subscribers {
    /// Queue the snapshot behind every notification published before it was read. The observer
    /// manager filters out such notifications only if they arrive before the snapshot.
        self.notify_without_version(
            Target::Sender(sender),
            Operation::Snapshot,
            Info::Snapshot(meta_snapshot),
        );
            Target::Subscribers {
        let (subscribe_type, worker_key) = match target {
            Target::Subscribers {
                subscribe_type,
                worker_key,
            } => (subscribe_type, worker_key),
            Target::Sender(sender) => {
                let _ = sender.send(Ok(response)).inspect_err(|err| {
                    tracing::warn!("Failed to send snapshot: {}", err.as_report());
 
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
struct Target {
    subscribe_type: SubscribeType,
    // `None` indicates sending to all subscribers of `subscribe_type`.
    worker_key: Option<WorkerKey>,
        Self {
        let response = SubscribeResponse {
            status: None,
            operation: Operation::Snapshot as i32,
            info: Some(Info::Snapshot(meta_snapshot)),
            version: Default::default(),
        };
        let _ = sender.send(Ok(response)).inspect_err(|err| {
            tracing::warn!("Failed to notify direct subscriber: {}", err.as_report());
        });
            Target {
        let senders = self.senders_of(target.subscribe_type);
        if let Some(worker_key) = target.worker_key {
                        warn_send_failure!(target.subscribe_type, &worker_key, err.as_report());
                        warn_send_failure!(target.subscribe_type, &worker_key, err.as_report());
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5d7a0e11` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T03:48:14.485Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794973694485",
    "title": "send subscribe snapshots through the notification queue",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "risingwavelabs/risingwave",
    "source_uri": "https://github.com/risingwavelabs/risingwave",
    "source_version": "HEAD",
    "content_hash": "0d0b3009335d49b2a42d41ec8ca1c8b36722a05415a662080f13579c7b05d131"
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
        "Harvested/verified timestamp recorded: 2026-11-18T03:48:14.485Z"
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
  "auth_token": "014ec2271aef3eabd8bdb9bf46e5cd65d630ad1249cbd2bcc1fe23e68d4f1c60"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
