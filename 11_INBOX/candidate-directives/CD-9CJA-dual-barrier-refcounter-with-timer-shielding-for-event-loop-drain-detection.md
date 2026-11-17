# Candidate Directive: [CD-9CJA] Dual-Barrier RefCounter with Timer Shielding for Event Loop Drain Detection

<!-- PROVENANCE_START
{
  "source_repository": "avajs-ava-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:19:58.675Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-avajs-ava-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [avajs-ava-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:19:58.675Z`  
> **Learning ID**: `LEARN-EVO-avajs-ava-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When coordinating graceful process termination using event loop unreferencing (`handle.unref()`) to allow Node.js to trigger `process.on('beforeExit')`, message channel handles MUST NOT be unreferenced directly if the underlying engine exhibits asynchronous shutdown races. An explicit reference counter (`RefCounter`) MUST be combined with an unreferenced safety-window timer (`setTimeout(() => {}, 1000).unref()`) to maintain a reference floor across microtask ticks, and all IPC channels MUST be re-referenced (`channel.ref()`) during final teardown flushes before explicit release.

**WHY**:
In Node.js `worker_threads`, calling `port.unref()` when message listeners are active can cause the thread to terminate abruptly before pending microtasks, promises, or snapshot disk flushes complete. On Windows environments, child process IPC handles (`process.channel`) trigger premature exit if unreferenced while stdout/stderr streams are buffering data (Node.js Issue #3390). Relying solely on `port.unref()` without reference-counting causes random test truncation and corrupted report serialization.

**WHEN TO APPLY**:
- In test runners, IPC protocols, and long-running daemons utilizing `port.unref()` or `process.channel.unref()` to detect worker idle states.
- When coordinating `beforeExit` hooks with asynchronous file I/O operations (e.g., snapshot persistence).

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// lib/worker/channel.js (Pattern extracted from AVA v8.4.0)
class RefCounter {
  count = 0;

  refAndTest() {
    return ++this.count === 1; // True only on transition 0 -> 1
  }

  testAndUnref() {
    return this.count > 0 && --this.count === 0; // True only on transition 1 -> 0
  }
}

export class SafeMessagePortHandle {
  constructor(port) {
    this.counter = new RefCounter();
    this.unreferenceable = false;
    this.channel = port;
    // Workaround: Referencing a port does not immediately prevent a thread from exiting.
    // Use an unreferenced timer to ensure the event loop maintains an active handle window.
    this.workaroundTimer = setTimeout(() => {}, 1000).unref();
  }

  forceUnref() {
    if (this.unreferenceable) return;
    this.unreferenceable = true;
    this.workaroundTimer.unref();
    this.channel.unref();
  }

  ref() {
    if (this.unreferenceable || !this.counter.refAndTest()) {
      return;
    }
    // Refresh the timer window and pin both handles to the event loop
    this.workaroundTimer.refresh().ref();
    this.channel.ref();

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:19:58.773Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794903598773",
    "title": "Dual-Barrier RefCounter with Timer Shielding for Event Loop Drain Detection",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "avajs-ava-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "3b02a38e0cd6d882be7fef9644f38fec161105260d672c40968310c703a5cd04"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:19:58.773Z"
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
  "auth_token": "f9a0c3fa6aaafa716ea3edfa0812d0646ddf31c357ff99675a6ba70854e793f7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
