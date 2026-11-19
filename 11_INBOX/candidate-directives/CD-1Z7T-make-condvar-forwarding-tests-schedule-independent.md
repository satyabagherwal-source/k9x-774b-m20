# Candidate Directive: [CD-1Z7T] make condvar forwarding tests schedule-independent

<!-- PROVENANCE_START
{
  "source_repository": "Xudong-Huang/may",
  "source_url": "https://github.com/Xudong-Huang/may",
  "source_version": "7f6b896d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T00:49:41.513Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-xudong-huang-may",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Xudong-Huang/may](https://github.com/Xudong-Huang/may) (Revision: `7f6b896d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T00:49:41.513Z`  
> **Learning ID**: `learn-github-xudong-huang-may`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
        // wait unlocks the mutex. W1's 100ms timeout fires while we hold
        // it, so W1 blocks in its mutex re-lock.
        rx.recv().unwrap();
        sleep(Duration::from_millis(200));
        // pops W1's blocker: the signal must be forwarded to W2
    // regression: same as above but with a canceled waiter instead of a
    // timed out one
        let (tx, rx) = channel();
            sleep(Duration::from_millis(20)); // let W1 enqueue first
            let g = m2.lock().unwrap();
            tx.send(()).unwrap(); // parked in the condvar wait b
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7f6b896d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T00:49:41.511Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795049381511",
    "title": "make condvar forwarding tests schedule-independent",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Xudong-Huang/may",
    "source_uri": "https://github.com/Xudong-Huang/may",
    "source_version": "HEAD",
    "content_hash": "7ddd0fe1d3cf7739c36e5e8bc6dee8b8a5b669381a3e91361ce7563d59e44e9b"
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
        "Harvested/verified timestamp recorded: 2026-11-19T00:49:41.511Z"
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
  "auth_token": "7fcb77bfc32b29e1b99d1849dc397facec9f80ac5bc4fadb746730604d40d261"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
