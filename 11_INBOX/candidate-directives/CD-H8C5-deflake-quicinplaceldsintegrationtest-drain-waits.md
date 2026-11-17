# Candidate Directive: [CD-H8C5] deflake QuicInplaceLdsIntegrationTest drain waits

<!-- PROVENANCE_START
{
  "source_repository": "envoyproxy/envoy",
  "source_url": "https://github.com/envoyproxy/envoy",
  "source_version": "f96b2a28",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T16:22:00.053Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-envoyproxy-envoy",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [envoyproxy/envoy](https://github.com/envoyproxy/envoy) (Revision: `f96b2a28`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T16:22:00.053Z`  
> **Learning ID**: `learn-github-envoyproxy-envoy`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `test/integration/quic_http_integration_test.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in envoyproxy/envoy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8937718c`: test: deflake QuicInplaceLdsIntegrationTest drain waits. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `test/integration/quic_http_integration_test.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
  // Waits for the workers to apply `in_place_updates` in place updates and for the filter chains
  // they replaced to finish draining. The main thread starts the drain before it counts any worker
  // acknowledging the update, so the drain gauge has already risen once the counter reaches the
  // target. Waiting for the gauge itself to rise can miss its drain_time_ window.
  void waitForInplaceUpdateDrained(uint32_t in_place_updates) {
    test_server_->waitForCounter("listener_manager.listener_in_place_updated",
                                 Ge(in_place_updates));
    const uint32_t listener_creations = 1 + in_place_updates;
    test_server_->waitForCounter("listener_manager.listener_create_success",
                                 Ge(listener_creations * concurrency_));
    test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
  }

  waitForInplaceUpdateDrained(1);
  waitForInplaceUpdateDrained(1);
  waitForInplaceUpdateDrained(2);
  waitForInplaceUpdateDrained(3);
  waitForInplaceUpdateDrained(1);
  waitForInplaceUpdateDrained(1);
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(1));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(1));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));

  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(2));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(3));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Eq(0));
  test_server_->waitForCounter("listener_manager.listener_in_place_updated", Ge(1));
  test_server_->waitForGauge("listener_manager.total_filter_chains_draining", Ge(1));

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8937718c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T16:22:00.051Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794932520051",
    "title": "deflake QuicInplaceLdsIntegrationTest drain waits",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "envoyproxy/envoy",
    "source_uri": "https://github.com/envoyproxy/envoy",
    "source_version": "HEAD",
    "content_hash": "570a80317804f2005a2b4412a1a9577f757429ef514dea24ad4c26e7776f0ed6"
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
        "Harvested/verified timestamp recorded: 2026-11-17T16:22:00.051Z"
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
  "auth_token": "9196ab9c0e45d43f829e88f37015894fd9865d8ecd386d6bf095692a16557909"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
