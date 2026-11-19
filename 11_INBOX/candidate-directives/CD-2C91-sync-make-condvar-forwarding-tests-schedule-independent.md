# Candidate Directive: [CD-2C91] sync): make condvar forwarding tests schedule-independent

<!-- PROVENANCE_START
{
  "source_repository": "xudong-huang-may-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T00:49:58.292Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-xudong-huang-may-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xudong-huang-may-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T00:49:58.292Z`  
> **Learning ID**: `LEARN-EVO-xudong-huang-may-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/sync/condvar.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Xudong-Huang/may. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7f6b896d`: sync): make condvar forwarding tests schedule-independent. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/sync/condvar.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    // regression: a waiter that timed out before the notify must not
    // consume the signal meant for the live waiter queued behind it — its
    // released blocker stays in the queue and notify_one has to skip it
        let (tx1, rx1) = channel(); // W1 timed out and left the wait
        let (tx2, rx2) = channel(); // W2 holds the mutex, about to park
        // W1: first in the condvar queue, times out before any notify
        // shows up, so its blocker stays queued in the released state
            let (g, to) = c1.wait_timeout(g, Duration::from_millis(10)).unwrap();
            // the wait is over and the release action is registered: a
            // later notify must be forwarded past this blocker
            tx1.send(()).unwrap();
        // wait until W1 has left: its released blocker is queued before W2
        // exists, so the queue order does not depend on how the two waiters
        // get scheduled
        rx1.recv().unwrap();

            tx2.send(()).unwrap(); // holds the mutex, about to park below
        // this lock blocks until W2's wait unlocks the mutex, so W2's
        // blocker is queued when the notify below pops it
        rx2.recv().unwrap();
  
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    // regression: a waiter that timed out while the notifier holds the
    // mutex must not consume the signal meant for the live waiter behind
    // it in the queue — the release action is registered before the
    // blocking mutex re-lock
        let (tx, rx) = channel();
        // W1: first in the condvar queue, times out quickly
            let (g, to) = c1.wait_timeout(g, Duration::from_millis(100)).unwrap();
            sleep(Duration::from_millis(20)); // let W1 enqueue first
            tx.send(()).unwrap(); // parked in the condvar wait below
        // W2 holds the mutex, about to park: this lock blocks until W2's

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T00:49:58.401Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795049398401",
    "title": "sync): make condvar forwarding tests schedule-independent",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "xudong-huang-may-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "68b74b150c77156e1e2a4ba574fff3fe922fa1954041b4861be3c7fb0d6b5c95"
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
        "Harvested/verified timestamp recorded: 2026-11-19T00:49:58.402Z"
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
  "auth_token": "8d66d821b9771e6a8f9f30b4d85a39f1858e66557bd7b6fe301fe56280718ab7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
