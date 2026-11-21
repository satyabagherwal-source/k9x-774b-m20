# Candidate Directive: [CD-N1VC] Idempotent Redundant AppKit State-Transition Verification

<!-- PROVENANCE_START
{
  "source_repository": "lingyired/status-trio",
  "source_url": "https://github.com/lingyired/status-trio",
  "source_version": "f57d4590",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T06:45:20.568Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lingyired-status-trio",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lingyired/status-trio](https://github.com/lingyired/status-trio) (Revision: `f57d4590`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T06:45:20.568Z`  
> **Learning ID**: `learn-github-lingyired-status-trio`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When transitioning state via AppKit APIs that return `Bool` status flags (specifically `NSApplication.setActivationPolicy(_:)`), you **MUST NOT** treat a `false` return value as an operational failure without verifying the current live state. You **MUST** evaluate the success invariant as `didApply || (application.currentActivationPolicy == targetPolicy)`.

**WHY**:
AppKit's `NSApplication.setActivationPolicy` returns `false` (`NO`) if the application is *already* in the requested activation policy. Treating `false` as an abort or error causes state desynchronization in reactive view models, triggering infinite activation loops or false panic transitions when concurrent UI requests attempt to enforce an already established policy.

**WHEN TO APPLY**:
Any macOS subsystem managing application lifecycle, dock icon presence, accessory transitions, or window activation arbitration.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import AppKit

@MainActor
public protocol ApplicationActivationPolicyTarget: AnyObject {
    var activationPolicy: NSApplication.ActivationPolicy { get }
    func setActivationPolicy(_ policy: NSApplication.ActivationPolicy) -> Bool
}

extension NSApplication: ApplicationActivationPolicyTarget {
    public var activationPolicy: NSApplication.ActivationPolicy { self.activationPolicy() }
}

@MainActor
public final class SafeActivationPolicyCoordinator {
    private let target: ApplicationActivationPolicyTarget
    public private(set) var currentPolicy: NSApplication.ActivationPolicy

    public init(target: ApplicationActivationPolicyTarget = NSApplication.shared) {
        self.target = target
        self.currentPolicy = target.activationPolicy
    }

    @discardableResult
    public func transition(to desiredPolicy: NSApplication.ActivationPolicy) -> Bool {
        let didApply = target.setActivationPolicy(desiredPolicy)
        let livePolicy = target.activationPolicy
        
        // AppKit returns false if already in desired state: confirm against live state
        let succeeded = didApply || (livePolicy == desiredPolicy)
        if succeeded && self.currentPolicy != livePolicy {
            self.currentPolicy = livePolicy
        }
        return succeeded
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Blindly assuming false means the OS rejected the policy change
let success = NSApplication.shared.setActivationPolicy(.regular)
if !success {
    // BUG: If the app was ALREADY .regular, this branch executes,
    // corrupting local state and raising false alerts.
    fatalError("Failed to switch to regular mode")
}
```

**VERIFICATION METHOD**:
Execute an automated test invoking transition twice with the same parameter:
```swift
func testRedundantActivationPolicyTransitionSucceeds() {
    let mock = MockActivationPolicyTarget(initial: .accessory)
    let coordinator = SafeActivationPolicyCoordinator(target: mock)
    
    XCTAssertTrue(coordinator.transition(to: .regular))
    // Second invocation returns false from mock.setActivationPolicy, but coordinator must return true
    XCTAssertTrue(coordinator.transition(to: .regular))
    XCTAssertEqual(coordinator.currentPolicy, .regular)
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T06:45:20.568Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795243520568",
    "title": "Idempotent Redundant AppKit State-Transition Verification",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lingyired/status-trio",
    "source_uri": "https://github.com/lingyired/status-trio",
    "source_version": "HEAD",
    "content_hash": "1b492272266a4620572961310c916d8099212634ea3fc42cabb19460dcf92694"
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
        "Harvested/verified timestamp recorded: 2026-11-21T06:45:20.568Z"
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
  "auth_token": "8f119894feea08f45074cede4d872acf71c7b1327d460aa0b9bf0c3c0a6cba71"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
