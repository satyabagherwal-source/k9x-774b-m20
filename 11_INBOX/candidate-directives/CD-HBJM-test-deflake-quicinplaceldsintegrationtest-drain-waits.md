# Candidate Directive: [CD-HBJM] test: deflake QuicInplaceLdsIntegrationTest drain waits

<!-- PROVENANCE_START
{
  "source_repository": "envoyproxy-envoy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T16:22:04.110Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-envoyproxy-envoy-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [envoyproxy-envoy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T16:22:04.110Z`  
> **Learning ID**: `LEARN-EVO-envoyproxy-envoy-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T16:22:04.210Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794932524210",
    "title": "test: deflake QuicInplaceLdsIntegrationTest drain waits",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "envoyproxy-envoy-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "833ce0e97fccce34f9d8ee1c2781384bce2247573186c91d10c62ed8bd574c53"
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
        "Harvested/verified timestamp recorded: 2026-11-17T16:22:04.210Z"
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
  "auth_token": "b74d36b38be23f208aee44e27b183697f8c8a97eb93d68f83caf8ae5d96a6ad2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
