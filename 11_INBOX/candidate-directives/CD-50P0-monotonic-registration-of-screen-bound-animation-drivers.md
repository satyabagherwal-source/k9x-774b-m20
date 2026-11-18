# Candidate Directive: [CD-50P0] Monotonic Registration of Screen-Bound Animation Drivers

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
When synchronizing shared UI elements (e.g., sticky headers, collapsible navigation bars) with animated drivers across route transitions, animation drivers MUST register monotonically on route `focus` events without unregistering or restoring stale previous drivers on route `blur`. Drivers MUST be wrapped in static/memoized driver providers (`useCallback([])`) to prevent lifecycle race conditions.

**WHY**:
In modern navigation stacks (such as React Navigation), screen transitions do NOT fire symmetrically: the incoming screen's `focus` event fires *before* the outgoing screen's `blur` event completes. If the outgoing screen unbinds, nullifies, or restores a previous driver inside its `blur` lifecycle cleanup, it will overwrite or invalidate the newly active screen's driver, causing animations on subsequent visits to freeze or crash.

**WHEN TO APPLY**:
Apply in all mobile and single-page navigation pipelines where dynamic headers, scroll listeners, floating action buttons, or gesture targets are handed off between nested or stacked viewports.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
import React, { useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';

export function useMonotonicScreenAnimationDriver(driver, registerDriver) {
  const navigation = useNavigation();

  // Driver registration callback MUST be immutable across re-renders
  const handleFocus = useCallback(() => {
    if (driver) {
      registerDriver(driver);
    }
  }, [driver, registerDriver]);

  useEffect(() => {
    // Register strictly on focus.
    // DO NOT attach a blur listener that cleans up or resets shared context!
    const unsubscribeFocus = navigation.addListener('focus', handleFocus);

    return () => {
      // Clean up the event listener itself, NEVER the driver state of the next screen
      unsubscribeFocus();
    };
  }, [navigation, handleFocus]);
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Blur event of outgoing screen fires AFTER focus of incoming screen,
// stomping and erasing the incoming screen's freshly assigned driver.
export function useFlawedDriverLifecycle(driver, setGlobalDriver) {
  const navigation = useNavigation();

  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => {
      setGlobalDriver(driver);
    });

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T01:04:22.979Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794963862979",
    "title": "Monotonic Registration of Screen-Bound Animation Drivers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "shoutem-ui-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a74e89ec09ad978901e8fea594eb2f03ce4f5d47c86450602c1ff743a8fdcf5c"
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-18T01:04:22.979Z"
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
  "auth_token": "1c8775d0410852cfb7b19da8c09a3216c71d73f58f51ddbadb70c1d603072597"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
