# Candidate Directive: [CD-431H] [QueryEngineV2] Keep test fixture storage out of reach of late query cleanup

<!-- PROVENANCE_START
{
  "source_repository": "restatedev-restate-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T07:51:13.906Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-restatedev-restate-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [restatedev-restate-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T07:51:13.906Z`  
> **Learning ID**: `LEARN-EVO-restatedev-restate-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/distributed-datafusion/src/distributed/multi_owner_tests.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in restatedev/restate. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b493638d`: [QueryEngineV2] Keep test fixture storage out of reach of late query cleanup. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/distributed-datafusion/src/distributed/multi_owner_tests.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use futures::{StreamExt, TryStreamExt, stream};
use restate_core::{Metadata, TaskCenter};
    /// The sources of the remote workers, whose servers start on first connection.
    _workers: Arc<OnceLock<HashMap<GenerationalNodeId, SourceRegistry>>>,
    // Queries keep the connector through their network, possibly past teardown
    // (see `keep_network_past_teardown`), so it must not own storage: it only
    // borrows the workers' sources and observations. The fixture owns them, and
    // so does each server it starts.
        let workers = Arc::downgrade(&workers);
        let tasks = Arc::downgrade(&tasks);
            // A node first reached once the test has returned serves nothing.
            let (Some(workers), Some(tasks)) = (workers.upgrade(), tasks.upgrade()) else {
                return;
            };
            server.observations = tasks;
            crate::mocks::spawn_query_server("multi-owner-query", server);
    crate::mocks::spawn_query_server("local-query-worker", server);
    crate::mocks::keep_network_past_teardown(coordinator.networking.clone());
        _workers: workers,
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use futures::{FutureExt, StreamExt, TryStreamExt, stream};
use restate_core::{Metadata, TaskCenter, TaskKind};
        let workers = Arc::clone(&workers);
        let tasks = Arc::clone(&tasks);
            server.observations = Arc::clone(&tasks);
            // Start the receiver before the connector can dispatch its first RPC.
            let mut task = Box::pin(server.run());
            assert!(task.as_mut().now_or_never().is_none());
            // Like production, shutdown waits for the server to drain, releasing its
            // storage owners before teardown checks run.
            TaskCenter::current()
                .spawn(TaskKind::SystemService, "multi-owner-query", task)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T07:51:14.017Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795074674017",
    "title": "[QueryEngineV2] Keep test fixture storage out of reach of late query cleanup",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "restatedev-restate-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f86f22d9757a812e4e8596dbedc3af18afa0328feaa7f132112f85212744bc62"
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
        "Harvested/verified timestamp recorded: 2026-11-19T07:51:14.018Z"
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
  "auth_token": "8f06f970ff5c4be631891911f7f9b9fccede2f1e8e52630fd8a2ba50dd16ba81"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
