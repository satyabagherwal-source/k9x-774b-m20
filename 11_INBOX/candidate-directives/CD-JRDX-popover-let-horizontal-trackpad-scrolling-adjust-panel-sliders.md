# Candidate Directive: [CD-JRDX] popover): let horizontal trackpad scrolling adjust panel sliders

<!-- PROVENANCE_START
{
  "source_repository": "lingyired-status-trio-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T07:41:04.392Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-lingyired-status-trio-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lingyired-status-trio-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T07:41:04.392Z`  
> **Learning ID**: `LEARN-EVO-lingyired-status-trio-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Sources/StatusTrioCore/UI/PopupVolumeScrollAdjustment.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lingyired/status-trio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `684de198`: popover): let horizontal trackpad scrolling adjust panel sliders. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/StatusTrioCore/UI/PopupVolumeScrollAdjustment.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    private var lastAxis: ScrollAxis?

    private enum ScrollAxis {
        case vertical
        case horizontal
    }
        deltaX: Double = 0,
            deltaX: deltaX, deltaY: deltaY, isPrecise: isPrecise,
        deltaX: Double = 0,
        guard deltaX.isFinite,
              let (delta, axis) = Self.dominantDelta(deltaX: deltaX, deltaY: deltaY)
        else { return nil }
        // Both axes share one convention: positive is "right"/"up" and raises
        // the level, so the same natural-scrolling handling applies to each.
            ? (isDirectionInverted ? -delta : delta)
            : delta
            lastAxis = axis
        if lastContext != context || lastWheelStep != wheelStep || lastAxis != axis
        lastAxis = axis

    /// Picks the dominant axis so a diagonal trackpad gesture is applied once,
    /// never as two separate adjustments. Ties keep the vertical axis, which is
    /// the historical behaviour.
    private static func dominantDelta(
        deltaX: Double,
        deltaY: Double
    ) -> (delta: Double, axis: ScrollAxis)? {
        guard deltaX.isFinite, deltaY.isFinite else { return nil }
        if abs(deltaX) > abs(deltaY) { return (delta
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
            deltaY: deltaY, isPrecise: isPrecise,
        guard deltaY.isFinite, deltaY != 0 else { return nil }

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T07:41:04.481Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794642064481",
    "title": "popover): let horizontal trackpad scrolling adjust panel sliders",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lingyired-status-trio-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1b9765d58af0a65e5d46ce24d04d941ff307f780bdcedba5d0386890ac594d0d"
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
        "Harvested/verified timestamp recorded: 2026-11-14T07:41:04.481Z"
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
  "auth_token": "cc39c5705033ef93e781d9e679033216a031f045e2b9713d8ca1f7a278257f48"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
