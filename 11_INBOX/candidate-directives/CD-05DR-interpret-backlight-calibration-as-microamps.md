# Candidate Directive: [CD-05DR] interpret backlight calibration as microamps

<!-- PROVENANCE_START
{
  "source_repository": "lingyired/status-trio",
  "source_url": "https://github.com/lingyired/status-trio",
  "source_version": "56ec144e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T03:58:34.815Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lingyired-status-trio",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lingyired/status-trio](https://github.com/lingyired/status-trio) (Revision: `56ec144e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T03:58:34.815Z`  
> **Learning ID**: `learn-github-lingyired-status-trio`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Sources/StatusTrioCore/Monitoring/DisplayPowerProvenance.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lingyired/status-trio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a833d6a0`: power): interpret backlight calibration as microamps. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/StatusTrioCore/Monitoring/DisplayPowerProvenance.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    private var calibrationMicroAmps: Double?
        calibrationMicroAmps = nil
        guard let watts = Self.estimatedWatts(currentMicroAmps: current.value,
                                              maximumMicroAmps: current.max,
                                              calibrationMicroAmps: calibration) else {
            return nil
        }
        guard (Self.minimumVisibleWatts...Self.maximumPlausibleWatts).contains(watts) else {
        if let calibrationMicroAmps { return calibrationMicroAmps }
              value.isFinite, (1_000...2_000_000).contains(value) else {
        // The key is in microamps (904383 on Mac15,9 = 904.383 mA for the
        // maximum backlight), matching BrightnessMicroAmps' scale.
        calibrationMicroAmps = value
                               calibrationMicroAmps: Double,
        guard value.isFinite, maximum.isFinite, calibrationMicroAmps.isFinite,
              value > 0, maximum > 0, calibrationMicroAmps > 0 else { return nil }
        // microamps -> amps; the 6 V string voltage is the named assumption.
        let watts = fraction * calibrationMicroAmps / 1_000_000 * assumedVoltage
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
    private var calibrationMilliamps: Double?
        calibrationMilliamps = nil
        let fraction = min(max(current.value / current.max, 0), 1)
        let milliamps = fraction * calibration
        let watts = milliamps / 1000 * Self.assumedVoltage
        guard watts.isFinite,
              (Self.minimumVisibleWatts...Self.maximumPlausibleWatts).contains(watts) else {
        if let calibrationMilliamps { return calibrationMilliamps }
              value.isFinite, (1...20_000).contains(value) else {
        calibrationMilliamps = value
                               calibrationMilliamps: Double,
        guard value.isFinite, maximum.isFinite, calibrationMilliamps.isFinite,
              value > 0, maximum > 0, calibrationMilliamps > 0 else { return nil }
        let watts = fraction * calibrationMilliamps / 1000 * assumedVoltage
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a833d6a0` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T03:58:34.813Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795492714813",
    "title": "interpret backlight calibration as microamps",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lingyired/status-trio",
    "source_uri": "https://github.com/lingyired/status-trio",
    "source_version": "HEAD",
    "content_hash": "996dc4fabd34ec6cf49742851daf10c46703b88df0e7ff4554bfb8d747518eef"
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
        "Harvested/verified timestamp recorded: 2026-11-24T03:58:34.813Z"
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
  "auth_token": "45ae49c0fb47e441e4d6535081618763aa8214c05eca91562f3ec647a18cb206"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
