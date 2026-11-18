# Candidate Directive: [CD-50P0] Asymmetric Safe Inset Fallback Resolution for Edge-to-Edge Runtimes

<!-- PROVENANCE_START
{
  "source_repository": "shoutem-ui-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T01:04:22.874Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-shoutem-ui-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [shoutem-ui-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T01:04:22.874Z`  
> **Learning ID**: `LEARN-EVO-shoutem-ui-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When querying platform viewport insets on devices supporting edge-to-edge drawing, insets MUST be dynamically obtained from live window metrics (`initialWindowMetrics.insets`) across ALL platforms (Android and iOS). Fixed platform constants (e.g., hardcoded `0` on Android) MUST NOT be assumed, and platform-specific fallbacks MUST only apply when live metric providers resolve to `undefined` or `null`.

**WHY**:
Starting with React Native 0.77 (Android 15+ target SDK), edge-to-edge rendering is enabled by default. Android draws underneath the gesture navigation bar and system status bar. Hardcoding Android bottom insets to `0` leads to floating navigation bars obscuring interactive elements, clipping submit buttons, and breaking tap targets at the bottom of the screen.

**WHEN TO APPLY**:
Cross-platform native applications handling home indicator padding, bottom-anchored action sheets, sticky footers, or bottom sheets.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
import { Platform } from 'react-native';

const IOS_FALLBACK_BOTTOM_INSET = 34;
const ANDROID_FALLBACK_BOTTOM_INSET = 0;

/**
 * Resolves bottom safe inset adapting to RN 0.77+ edge-to-edge Android
 * and notch/Dynamic Island iOS displays.
 *
 * @param {Object} [windowMetrics] - Window metrics from react-native-safe-area-context
 * @returns {number} Effective bottom inset in points
 */
export function resolveSafeBottomInset(windowMetrics) {
  const detectedBottom = windowMetrics?.insets?.bottom;

  if (typeof detectedBottom === 'number') {
    return detectedBottom;
  }

  // Graceful degradation when window metrics provider is unmounted or uninitialized
  return Platform.select({
    ios: IOS_FALLBACK_BOTTOM_INSET,
    android: ANDROID_FALLBACK_BOTTOM_INSET,
    default: 0,
  });
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Hardcoded assumption that Android never has a home indicator inset.
// Breaks immediately on RN >= 0.77 with edge-to-edge enabled.
export function getHomeIndicatorPaddingBroken() {
  if (Platform.OS === 'android') {
    return 0; // DEAD TRAP: Clips UI behind system navigation bar on Android 15+
  }
  return 34;
}

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T01:04:22.980Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794963862980",
    "title": "Asymmetric Safe Inset Fallback Resolution for Edge-to-Edge Runtimes",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "shoutem-ui-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "d67a13fdfc2a038ec10bd4023a13e16fd859d73e2d0ccef39a0a7c54f26266e0"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T01:04:22.980Z"
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
  "auth_token": "b779384e012af4a81932a0516de77f347363d893c8b7556ed4039844bbd344d9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
