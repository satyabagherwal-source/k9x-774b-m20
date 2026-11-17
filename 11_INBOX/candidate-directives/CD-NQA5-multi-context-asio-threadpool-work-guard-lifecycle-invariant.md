# Candidate Directive: [CD-NQA5] Multi-Context Asio Threadpool Work Guard Lifecycle Invariant

<!-- PROVENANCE_START
{
  "source_repository": "arangodb/arangodb",
  "source_url": "https://github.com/arangodb/arangodb",
  "source_version": "d0c81b64",
  "license": "NOASSERTION",
  "timestamp": "2026-11-17T08:31:09.773Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-arangodb-arangodb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [arangodb/arangodb](https://github.com/arangodb/arangodb) (Revision: `d0c81b64`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-17T08:31:09.773Z`  
> **Learning ID**: `learn-github-arangodb-arangodb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
```

**VERIFICATION METHOD**:
Static analysis via clang-tidy checking thread joins without prior cancellation, combined with integration lifecycle fuzzing running 10,000 rapid cycles of `EventLoopService::start()` and `EventLoopService::stop()` under simulated thread contention.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:31:09.773Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904269773",
    "title": "Multi-Context Asio Threadpool Work Guard Lifecycle Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "arangodb/arangodb",
    "source_uri": "https://github.com/arangodb/arangodb",
    "source_version": "HEAD",
    "content_hash": "c495b671a0b44cb0896d7e9194de8637c06f7dd2447ac117f9362e3d46c8603c"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:31:09.773Z"
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
  "auth_token": "ac61bcb84fa63a99021e58e12d13b9f94a53a0af38a74ed5c01c46bd62b10952"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
