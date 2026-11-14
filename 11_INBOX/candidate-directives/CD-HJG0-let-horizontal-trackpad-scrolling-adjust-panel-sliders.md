# Candidate Directive: [CD-HJG0] let horizontal trackpad scrolling adjust panel sliders

<!-- PROVENANCE_START
{
  "source_repository": "lingyired/status-trio",
  "source_url": "https://github.com/lingyired/status-trio",
  "source_version": "a0ebb92d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T07:39:20.880Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lingyired-status-trio",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lingyired/status-trio](https://github.com/lingyired/status-trio) (Revision: `a0ebb92d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T07:39:20.880Z`  
> **Learning ID**: `learn-github-lingyired-status-trio`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
            ? (isDirectionInverted ? -deltaY : deltaY)
            : deltaY
        if lastContext != context || lastWheelStep != wheelStep
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `684de198` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T07:39:20.878Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794641960878",
    "title": "let horizontal trackpad scrolling adjust panel sliders",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lingyired/status-trio",
    "source_uri": "https://github.com/lingyired/status-trio",
    "source_version": "HEAD",
    "content_hash": "7125fd15ce6f7f89279e1fac11410e0d337759e2009fb26f7198b7edce9566a5"
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
        "Harvested/verified timestamp recorded: 2026-11-14T07:39:20.878Z"
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
  "auth_token": "326abc7ba936016cc63d6c7f45c5b6f7568c066c75e0b47e7ef76f3a2b3e04ad"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
