# Candidate Directive: [CD-0D8T] power): interpret backlight calibration as microamps

<!-- PROVENANCE_START
{
  "source_repository": "lingyired-status-trio-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T03:58:44.879Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-lingyired-status-trio-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lingyired-status-trio-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T03:58:44.879Z`  
> **Learning ID**: `LEARN-EVO-lingyired-status-trio-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T03:58:45.001Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795492725001",
    "title": "power): interpret backlight calibration as microamps",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lingyired-status-trio-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c1b86a9cfff57214c50274d18ff41ce241c6d094d48b82e559817cdaf35a7679"
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
        "Harvested/verified timestamp recorded: 2026-11-24T03:58:45.002Z"
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
  "auth_token": "98c0ed97248d76c3527f1c755bc1c348e7c37da74905b73c2d0d8338a0146416"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
