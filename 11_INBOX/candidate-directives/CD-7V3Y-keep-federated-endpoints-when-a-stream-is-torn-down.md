# Candidate Directive: [CD-7V3Y] keep federated endpoints when a stream is torn down

<!-- PROVENANCE_START
{
  "source_repository": "linkerd/linkerd2",
  "source_url": "https://github.com/linkerd/linkerd2",
  "source_version": "e64ff8dd",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T13:05:26.590Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-linkerd-linkerd2",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [linkerd/linkerd2](https://github.com/linkerd/linkerd2) (Revision: `e64ff8dd`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T13:05:26.590Z`  
> **Learning ID**: `learn-github-linkerd-linkerd2`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-21T13:05:26.587Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795266326587",
    "title": "keep federated endpoints when a stream is torn down",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "linkerd/linkerd2",
    "source_uri": "https://github.com/linkerd/linkerd2",
    "source_version": "HEAD",
    "content_hash": "004a99724319094256f7cde8a5773df99aea4128051ec87dbe2db38bd4472407"
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
        "Harvested/verified timestamp recorded: 2026-11-21T13:05:26.587Z"
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
  "auth_token": "8373213e2b7392ba4db2c61dfaa41694582555f3c45bc1a7533dfb31fc5d4364"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
