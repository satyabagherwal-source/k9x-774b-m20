# Candidate Directive: [CD-Y8TG] 🍏): present at full rate on macOS 14+ ProMotion devices

<!-- PROVENANCE_START
{
  "source_repository": "shopify-react-native-skia-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T18:14:52.586Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-shopify-react-native-skia-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [shopify-react-native-skia-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T18:14:52.586Z`  
> **Learning ID**: `LEARN-EVO-shopify-react-native-skia-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain M

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/skia/apple/SkiaView.mm`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wcandillon/react-native-skia. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `72ed90d0`: 🍏): present at full rate on macOS 14+ ProMotion devices. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/skia/apple/SkiaView.mm`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  // Present thread. Created as the view enters a superview on macOS, where
  // the link is bound to the view and follows its display, and on the first
  // animation frame elsewhere, so that a canvas that never animates has none.

  // The screen maximum used for the last frame-rate request. Present thread.
  // This belongs to the current link: a recycled view's new link must ask
  // again. Comparing rates also picks up a new display rate (see
  // updateMaximumFramesPerSecond).
  float _requestedFramesPerSecond;
  // or changes screens, 0 until then.
    _requestedFramesPerSecond = 0;
#endif // !TARGET_OS_OSX

#if TARGET_OS_OSX
  // AppKit binds the link to the view, which follows it between displays,
  // and makes it on the main thread only: it is made paused here and joins
  // the present thread's run loop in the same task that lets frame requests
  // through. The link holds the view as its target until the leave task
  // invalidates it, so the task finds the view.
  CADisplayLink *displayLink = [self displayLinkWithTarget:self
                                                  selector:@selector(onFrame:)];
  displayLink.paused = YES;
#endif // TARGET_OS_OSX
#if TARGET_O
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
#include <algorithm>
#if !TARGET_OS_OSX
  // Present thread.
  // Whether the display link asked for the display's full rate yet (see
  // requestFullFrameRate). Present thread.
  bool _fullFrameRateRequested;
  // (UIKit), 0 until then.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T18:14:52.703Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795025692702",
    "title": "🍏): present at full rate on macOS 14+ ProMotion devices",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "shopify-react-native-skia-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c81e0c8fcb3dfa8f13006bdcbcbe10325639ddf112076e7d44ab64b6e772cb7a"
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
        "Harvested/verified timestamp recorded: 2026-11-18T18:14:52.703Z"
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
  "auth_token": "c6bd6bb39bb01a8047db1603665b75b992081efc2f965836c9d79491bc128b49"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
