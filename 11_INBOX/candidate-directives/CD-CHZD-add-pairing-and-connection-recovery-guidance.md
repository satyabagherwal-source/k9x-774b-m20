# Candidate Directive: [CD-CHZD] add pairing and connection recovery guidance

<!-- PROVENANCE_START
{
  "source_repository": "stikdebug-stikdebug-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T19:25:17.340Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-stikdebug-stikdebug-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [stikdebug-stikdebug-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T19:25:17.340Z`  
> **Learning ID**: `LEARN-EVO-stikdebug-stikdebug-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `StikDebug/Services/ConnectionDiagnostics.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in StikDebug/StikDebug. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f83299ce`: add pairing and connection recovery guidance. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `StikDebug/Services/ConnectionDiagnostics.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        case developerService, cellular, networkUnavailable, noVPN, vpnUnresponsive, serviceUnreachable, connectionRefused, unknown
        case .connectionRefused: return String(localized: "Connection refused")
        case .serviceUnreachable, .connectionRefused: return "antenna.radiowaves.left.and.right.slash"
                return String(localized: "Generate and place a new pairing file using Settings → Pair a Device in StikDebug.")
        case .connectionRefused:
            return String(localized: "Restart the target device, then try again.")
        let stage = error.userInfo["ConnectionStage"] as? String
        if detail.contains("plist") && detail.contains("missing field") && detail.contains("public_key") {
            return .pairingRejected
        }
        if stage == Stage.pairingFile.rawValue { return .pairingFile }
        if stage == Stage.targetAddress.rawValue { return .invalidAddress }
        if stage == Stage.tunnel.rawValue && detail.contains("socket(os") &&
            detail.contains("code: 54,") && detail.contains("connection reset by peer") {
            return .pairingRejected
        }
        if (error.domain == NSPOSIXErrorDomain && error.code == 
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
        case developerService, cellular, networkUnavailable, noVPN, vpnUnresponsive, serviceUnreachable, unknown
        case .serviceUnreachable: return "antenna.radiowaves.left.and.right.slash"
                return String(localized: "Generate and place a new pairing file using Settings → Pair a Device, or iloader.")
        if error.userInfo["ConnectionStage"] as? String == Stage.pairingFile.rawValue { return .pairingFile }
        if error.userInfo["ConnectionStage"] as? String == Stage.targetAddress.rawValue { return .invalidAddress }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f83299ce` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T19:25:17.448Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795202717448",
    "title": "add pairing and connection recovery guidance",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "stikdebug-stikdebug-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "4198cd90b92014eae34f660636e57886419813b2dd2a5e2835279742f46fab8b"
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
        "Harvested/verified timestamp recorded: 2026-11-20T19:25:17.448Z"
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
  "auth_token": "531f5a739a2abc08f1c8aa2dae6dfa295ab2cf0510191ca8f7899ebdc143d1f5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
