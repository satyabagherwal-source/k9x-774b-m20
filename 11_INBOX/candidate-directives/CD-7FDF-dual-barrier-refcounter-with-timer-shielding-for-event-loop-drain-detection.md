# Candidate Directive: [CD-7FDF] Dual-Barrier RefCounter with Timer Shielding for Event Loop Drain Detection

<!-- PROVENANCE_START
{
  "source_repository": "avajs/ava",
  "source_url": "https://github.com/avajs/ava",
  "source_version": "ce2839c1",
  "license": "MIT",
  "timestamp": "2026-11-17T08:18:29.139Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-avajs-ava",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [avajs/ava](https://github.com/avajs/ava) (Revision: `ce2839c1`).  
> **License**: MIT | **Timestamp**: `2026-11-17T08:18:29.139Z`  
> **Learning ID**: `learn-github-avajs-ava`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  }

  unref() {
    if (this.unreferenceable || !this.counter.testAndUnref()) {
      return;
    }
    this.workaroundTimer.unref();
    this.channel.unref();
  }
}

// In the termination pipeline:
async function finalizeWorkerExecution(channel, runner) {
  // Re-pin channel to prevent premature exit during snapshot serialization
  channel.ref();
  try {
    const {touchedFiles} = await runner.saveSnapshotState();
    if (touchedFiles) {
      channel.send({type: 'touched-files', files: touchedFiles});
    }
  } finally {
    channel.send({type: 'worker-finished'});
    await channel.workerFreed; // Wait for coordinator ACK
    channel.unref();           // Now safe to permit beforeExit drain
  }
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Direct, unguarded unref() calls
port.on('message', handler);
port.unref(); // DANGER: Thread can abruptly terminate mid-handler execution if microtasks are in flight!

// ANTI-PATTERN: Naked process.channel unref during async cleanup
runner.on('finish', async () => {
  await runner.saveSnapshots(); // Thread may get killed halfway through disk write!
  process.channel.unref();
});
```

**VERIFICATION METHOD**:
Verify that `refAndTest` and `testAndUnref` transitions occur only at the 0/1 thresholds:
```javascript
import test from 'ava';

test('RefCounter strictly validates single-edge state transitions', t => {
  const counter = new RefCounter();
  t.true(counter.refAndTest());   // 0 -> 1: Returns true (apply underlying ref)
  t.false(counter.refAndTest());  // 1 -> 2: Returns false (no-op)
  t.false(counter.testAndUnref()); // 2 -> 1: Returns false (no-op)
  t.true(counter.testAndUnref());  // 1 -> 0: Returns true (apply underlying unref)
  t.false(counter.testAndUnref()); // Sub-zero guard: Returns false
});
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:18:29.139Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794903509139",
    "title": "Dual-Barrier RefCounter with Timer Shielding for Event Loop Drain Detection",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "avajs/ava",
    "source_uri": "https://github.com/avajs/ava",
    "source_version": "HEAD",
    "content_hash": "77fefe7d86141486cb68c19b6362be7e5c492999a51ca65c8faa5a3c31a889d9"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:18:29.139Z"
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
  "auth_token": "3b146ea3103a05c56db13ce14375785928f1bc161888cf0a3f8972d8ab81d10a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
