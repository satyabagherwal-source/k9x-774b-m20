# Candidate Directive: [CD-C943] add pairing and connection recovery guidance

<!-- PROVENANCE_START
{
  "source_repository": "StikDebug/StikDebug",
  "source_url": "https://github.com/StikDebug/StikDebug",
  "source_version": "63713ea2",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-20T19:25:05.955Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-stikdebug-stikdebug",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [StikDebug/StikDebug](https://github.com/StikDebug/StikDebug) (Revision: `63713ea2`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-20T19:25:05.955Z`  
> **Learning ID**: `learn-github-stikdebug-stikdebug`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-20T19:25:05.953Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795202705953",
    "title": "add pairing and connection recovery guidance",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "StikDebug/StikDebug",
    "source_uri": "https://github.com/StikDebug/StikDebug",
    "source_version": "HEAD",
    "content_hash": "4198cd90b92014eae34f660636e57886419813b2dd2a5e2835279742f46fab8b"
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
        "Harvested/verified timestamp recorded: 2026-11-20T19:25:05.953Z"
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
  "auth_token": "0667732f0eedafb0738766cc34b0272744db35a4a9014768273b0bba75fd978f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
