# Candidate Directive: [CD-CM8P] send Apple Intelligence requests through siriknowledged when macOS 27.3 refuses

<!-- PROVENANCE_START
{
  "source_repository": "jithin-sabu/purge-app",
  "source_url": "https://github.com/jithin-sabu/purge-app",
  "source_version": "384b5b6c",
  "license": "MIT",
  "timestamp": "2026-11-21T07:05:13.369Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-jithin-sabu-purge-app",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [jithin-sabu/purge-app](https://github.com/jithin-sabu/purge-app) (Revision: `384b5b6c`).  
> **License**: MIT | **Timestamp**: `2026-11-21T07:05:13.369Z`  
> **Learning ID**: `learn-github-jithin-sabu-purge-app`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `PurgeAssetWorker/UnifiedAssetCalls.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in jithin-sabu/purge-app. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `09c6920d`: send Apple Intelligence requests through siriknowledged when macOS 27.3 refuses them. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `PurgeAssetWorker/UnifiedAssetCalls.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    ///
    /// `AppleIntelligenceModelRoute` picks the service. When the subscription
    /// service refuses or drops the connection, as it does from macOS 27.3,
    /// the same request goes out once more through siriknowledged's service.
        do {
            try AppleIntelligenceModelRoute.send(timeout: timeout) { service, timeout in
                try send(config, to: service, interface: interface, selector: selector, timeout: timeout)
            }
        } catch let failure as AppleIntelligenceModelRoute.SecondTryFailure {
            // A worker refusal has no domain or code, so the first try joins its text.
            if let second = failure.error as? CallError {
                throw CallError("\(second.description); \(failure.firstTry)")
            }
            throw failure.withFirstTry
        }
    }

    /// One try at one Mach service.
    private static func send(_ config: [String: Any], to service: String, interface: NSXPCInterface,
                             selector: Selector, timeout: TimeInterval) throws {
        let connection = NSXPCConnection(machServiceName: service, options: [])
            throw CallError("no reply from \(service) in \(Int(ti
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
    static let serviceName = "com.apple.siri.uaf.subscription.service"
        let connection = NSXPCConnection(machServiceName: serviceName, options: [])
            throw CallError("no reply from \(serviceName) in \(Int(timeout)) seconds; the request may still have run")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `09c6920d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T07:05:13.367Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795244713367",
    "title": "send Apple Intelligence requests through siriknowledged when macOS 27.3 refuses",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "jithin-sabu/purge-app",
    "source_uri": "https://github.com/jithin-sabu/purge-app",
    "source_version": "HEAD",
    "content_hash": "1501cb26ba84b8535609def166bdf3d7054df8930a195fda08ef45d5f1942055"
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
        "Harvested/verified timestamp recorded: 2026-11-21T07:05:13.367Z"
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
  "auth_token": "83873ce3e2c8986cb0d2f1a024b87515ca580f1a7ade8ceb5f0d93723d8500f7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
