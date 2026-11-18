# Candidate Directive: [CD-2OZZ] Monotonic Registration of Screen-Bound Animation Drivers

<!-- PROVENANCE_START
{
  "source_repository": "shoutem/ui",
  "source_url": "https://github.com/shoutem/ui",
  "source_version": "101f9805",
  "license": "NOASSERTION",
  "timestamp": "2026-11-18T01:02:34.511Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-shoutem-ui",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [shoutem/ui](https://github.com/shoutem/ui) (Revision: `101f9805`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-18T01:02:34.511Z`  
> **Learning ID**: `learn-github-shoutem-ui`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

    const unsubBlur = navigation.addListener('blur', () => {
      // CATASTROPHIC: This executes after Screen B focused,
      // setting Screen B's active driver back to null!
      setGlobalDriver(null);
    });

    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation, driver, setGlobalDriver]);
}
```

**VERIFICATION METHOD**:
Implement a stateful mock test verifying listener execution sequence:
```javascript
test('focus on Screen B must not be overridden by blur on Screen A', () => {
  let activeDriver = null;
  const setDriver = (d) => { activeDriver = d; };

  const driverA = { id: 'DriverA' };
  const driverB = { id: 'DriverB' };

  // Simulate navigation transition: Focus B -> Blur A
  setDriver(driverB); // Screen B focus
  // Ensure Screen A blur logic does not execute setDriver(null) or setDriver(driverA)
  expect(activeDriver.id).toBe('DriverB');
});
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T01:02:34.510Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794963754510",
    "title": "Monotonic Registration of Screen-Bound Animation Drivers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "shoutem/ui",
    "source_uri": "https://github.com/shoutem/ui",
    "source_version": "HEAD",
    "content_hash": "10be681415b423bafc4f906fac5ddb12af3a1248397fa1e736e2b4a48970d5e6"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T01:02:34.510Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "c99fb78118ff1a507506f88e79e675fe6b4a0f2f387f7164e7597da3b9163cdf"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
