# Candidate Directive: [CD-P8R6] Multi-Context Asio Threadpool Work Guard Lifecycle Invariant

<!-- PROVENANCE_START
{
  "source_repository": "arangodb-arangodb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:32:20.273Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-arangodb-arangodb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [arangodb-arangodb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:32:20.273Z`  
> **Learning ID**: `LEARN-EVO-arangodb-arangodb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When managing a pool of isolated `boost::asio::io_context` instances across worker threads, the service MUST construct and store `executor_work_guard` instances before spawning threads, and MUST explicitly reset all guards before invoking `stop()` on any `io_context` during shutdown. Worker threads MUST NOT be joined without resetting work guards and calling `stop()`.

**WHY**:
An active `asio::executor_work_guard` prevents `io_context::run()` from returning even when all active handlers have drained. If worker threads call `ctx->run()` and the destructor joins them without clearing work guards, the application deadlocks on process termination. Conversely, invoking `c->stop()` without resetting work guards aborts queued cancellation handlers, leaking in-flight sockets and memory buffers.

**WHEN TO APPLY**:
C++ networking services using `boost::asio` or standalone `asio` with thread-per-core or partitioned loop patterns (`asio::io_context`).

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// 3rdParty/fuerte/src/loop.cpp
void EventLoopService::stop() {
  // Phase 1: Allow run() loops to exit naturally when work completes
  for (auto& guard : _guards) {
    guard.reset();
  }
  std::this_thread::sleep_for(std::chrono::milliseconds(50));

  // Phase 2: Forcefully halt pending events that failed to drain
  for (auto& context : _ioContexts) {
    context->stop();
  }
  std::this_thread::sleep_for(std::chrono::milliseconds(50));

  // Phase 3: Synchronously join and reclaim OS thread resources
  for (auto& thread : _threads) {
    if (thread.joinable()) {
      thread.join();
    }
  }

  _threads.clear();
  _ioContexts.clear();
  _guards.clear();
}
```

**NEGATIVE CONSTRAINT**:
```cpp
// DEADLOCK / RESOURCE CORRUPTION PATTERN:
EventLoopService::~EventLoopService() {
  for (auto& thread : _threads) {
    if (thread.joinable()) {
      thread.join(); // DEADLOCK: io_context::run() never exits because work_guards are active!
    }
  }
  // Destruction of _guards never reached.
}

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:32:20.369Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904340369",
    "title": "Multi-Context Asio Threadpool Work Guard Lifecycle Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "arangodb-arangodb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a2cf8348f04d70f89d27642cad2163e40df241459f9860a42f8bb42f5477856a"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:32:20.370Z"
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
  "auth_token": "5c90af2a30cc25cc083ca1dc0af3dea2a519a2214e1c17c83125d308586e4eb5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
