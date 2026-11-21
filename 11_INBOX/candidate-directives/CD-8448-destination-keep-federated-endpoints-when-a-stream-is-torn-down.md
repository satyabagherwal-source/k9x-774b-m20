# Candidate Directive: [CD-8448] destination): keep federated endpoints when a stream is torn down

<!-- PROVENANCE_START
{
  "source_repository": "linkerd-linkerd2-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T13:05:38.100Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-linkerd-linkerd2-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [linkerd-linkerd2-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T13:05:38.100Z`  
> **Learning ID**: `LEARN-EVO-linkerd-linkerd2-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `controller/api/destination/federated_service_watcher.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in linkerd/linkerd2. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e64ff8dd`: destination): keep federated endpoints when a stream is torn down. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `controller/api/destination/federated_service_watcher.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
				fs.remoteDiscoveryUnsubscribe(&fs.subscribers[i], id, true)
					fs.localDiscoveryUnsubscribe(&fs.subscribers[i], fs.localDiscovery, true)
				fs.localDiscoveryUnsubscribe(&fs.subscribers[i], fs.localDiscovery, true)
			// The stream is going away, so the client keeps the endpoints it
			// has until it resubscribes. Sending a Remove here would make it
			// drop them all while it reconnects.
				fs.remoteDiscoveryUnsubscribe(&fs.subscribers[i], id, false)
				fs.localDiscoveryUnsubscribe(&fs.subscribers[i], localDiscovery, false)
// remoteDiscoveryUnsubscribe stops sending the subscriber updates for a remote
// member of the federated service. withRemove tells the subscriber to remove
// that member's endpoints, which is only correct when the member is leaving
// the federated service, not when the subscriber's stream is torn down.
	withRemove bool,
	remoteWatcher.Unsubscribe(id.service, subscriber.port, filterKey, translator, withRemove)
// localDiscoveryUnsubscribe is the local-member counterpart of
// remoteDiscoveryUnsubscribe, with the same meaning for withRemove.
	withRemove bool,
		fs.localEndpoints.Unsubscribe(watcher.ServiceID{Namespace: fs.namespace, Name: localDisco
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
				fs.remoteDiscoveryUnsubscribe(&fs.subscribers[i], id)
					fs.localDiscoveryUnsubscribe(&fs.subscribers[i], fs.localDiscovery)
				fs.localDiscoveryUnsubscribe(&fs.subscribers[i], fs.localDiscovery)
				fs.remoteDiscoveryUnsubscribe(&fs.subscribers[i], id)
				fs.localDiscoveryUnsubscribe(&fs.subscribers[i], localDiscovery)
	remoteWatcher.Unsubscribe(id.service, subscriber.port, filterKey, translator, true)
		fs.localEndpoints.Unsubscribe(watcher.ServiceID{Namespace: fs.namespace, Name: localDiscovery}, subscriber.port, filterKey, translator, true)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e64ff8dd` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T13:05:38.259Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795266338259",
    "title": "destination): keep federated endpoints when a stream is torn down",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "linkerd-linkerd2-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f707ad761c86a573dd0943bd6df5c9505700e7df43aa4788b8621391f304f235"
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
        "Harvested/verified timestamp recorded: 2026-11-21T13:05:38.260Z"
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
  "auth_token": "4bf905d9bf893b9cba14a001b9d93642bc5f869b72786630702684c1f094a044"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
