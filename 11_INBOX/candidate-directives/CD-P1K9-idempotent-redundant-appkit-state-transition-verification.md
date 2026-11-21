# Candidate Directive: [CD-P1K9] Idempotent Redundant AppKit State-Transition Verification

<!-- PROVENANCE_START
{
  "source_repository": "lingyired-status-trio-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T06:46:53.358Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-lingyired-status-trio-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lingyired-status-trio-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T06:46:53.358Z`  
> **Learning ID**: `LEARN-EVO-lingyired-status-trio-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T06:46:53.480Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795243613480",
    "title": "Idempotent Redundant AppKit State-Transition Verification",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lingyired-status-trio-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "3c55a8c6bbe7e5238ae17efa660960c5e18610214386a4e1a3fdfd0429f932f9"
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
        "Harvested/verified timestamp recorded: 2026-11-21T06:46:53.480Z"
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
  "auth_token": "3d6066d450d8305e750b68b4347328dcaa1dd18fcaff0402c71a3ab73c81475c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
