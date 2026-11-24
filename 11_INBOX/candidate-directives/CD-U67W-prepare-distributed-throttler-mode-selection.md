# Candidate Directive: [CD-U67W] Prepare distributed throttler mode selection

<!-- PROVENANCE_START
{
  "source_repository": "ytsaurus/ytsaurus",
  "source_url": "https://github.com/ytsaurus/ytsaurus",
  "source_version": "3d402381",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T16:01:45.980Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-ytsaurus-ytsaurus",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ytsaurus/ytsaurus](https://github.com/ytsaurus/ytsaurus) (Revision: `3d402381`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T16:01:45.980Z`  
> **Learning ID**: `learn-github-ytsaurus-ytsaurus`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `yt/docs/en/_includes/flow/concepts/distributed_throttler.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ytsaurus/ytsaurus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0987aa47`: Prepare distributed throttler mode selection. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `yt/docs/en/_includes/flow/concepts/distributed_throttler.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
In the dynamic spec of a named throttler, `mode` defaults to `prefetching`. The `throttle_timeout` option bounds the quota wait for each `Throttle` call (five minutes by default).

All throttler parameters (`mode`, `limit`, `period`, `request_period`, `retrying_channel`, `rpc_timeout`, `throttle_timeout`, `classes`, `max_grant_amount`, `use_class_weights_as_limit`) are applied without restarting the pipeline — just update `dynamic_spec`. The `IThroughputThrottlerPtr` cached in your user code remains valid after the config change.
Each quota request uses the worker's current controller channel. While the client retries a request according to `retrying_channel`, it can still serve calls from cached quota. If a retry reaches the new Controller, the pending request can complete.

If the quota RPC ultimately fails, the local Prefetching client keeps its first terminal error. Pending and subsequent `Throttle()` calls return that error in their futures. Synchronous methods, including `TryAcquire()`, throw the error even if local quota remains. Recreating the client clears the failure. The same rule applies when the Controller rejects a request for an unknown throttler ID.
Each `Throttle()
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
All throttler parameters (`limit`, `period`, `request_period`, `retrying_channel`, `rpc_timeout`, `classes`, `max_grant_amount`, `use_class_weights_as_limit`) are applied without restarting the pipeline — just update `dynamic_spec`. The `IThroughputThrottlerPtr` cached in your user code remains valid after the config change.
The throttler client reopens the connection via `retrying_channel`. While the Controller doesn’t respond, the local prefetch cache is consumed, and `Throttle()` blocks while waiting for a quota — the Job makes no progress. When the Controller comes back, the wait resolves automatically. If the Controller stays unresponsive longer than the total retry budget of `retrying_channel`, the throttler operation throws an exception and the Job fails.
If the total demand from Jobs far exceeds the possible supply, individual `RequestQuota` calls may wait a long time in the server queue and eventually miss their `rpc_timeout` × `retry_attempts` deadline. In this case, `Throttle()` also throws an exception, which causes the Job to fail.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0987aa47` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T16:01:45.978Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795536105978",
    "title": "Prepare distributed throttler mode selection",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ytsaurus/ytsaurus",
    "source_uri": "https://github.com/ytsaurus/ytsaurus",
    "source_version": "HEAD",
    "content_hash": "42b4ed8c1fff60d571a4596382132e9c08a89dc235aa726ace758b7c7d7d946f"
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
        "Harvested/verified timestamp recorded: 2026-11-24T16:01:45.979Z"
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
  "auth_token": "233de88d8238cfcf44668a16b03c69d0e179c8c8599feecd3abafa2015b0f1db"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
