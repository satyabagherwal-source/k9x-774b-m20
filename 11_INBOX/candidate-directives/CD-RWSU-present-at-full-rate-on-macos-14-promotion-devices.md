# Candidate Directive: [CD-RWSU] 🍏): present at full rate on macOS 14+ ProMotion devices

<!-- PROVENANCE_START
{
  "source_repository": "wcandillon/react-native-skia",
  "source_url": "https://github.com/Shopify/react-native-skia",
  "source_version": "72ed90d0",
  "license": "MIT",
  "timestamp": "2026-11-18T18:09:57.198Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-wcandillon-react-native-skia",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [wcandillon/react-native-skia](https://github.com/Shopify/react-native-skia) (Revision: `72ed90d0`).  
> **License**: MIT | **Timestamp**: `2026-11-18T18:09:57.198Z`  
> **Learning ID**: `learn-github-wcandillon-react-native-skia`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
#else
  // Whether a tick is scheduled, when the last one ran (see
  // presentAgainLater), and which ticks are still wanted: the leave moves
  // the count on, and a tick scheduled before it does nothing. Present
  // thread.
  bool _presentAgainScheduled;
  CFTimeInterval _lastTick;
  uint64_t _tickGeneration;
#endif
#if TARGET_OS_OSX
    _presentAgainScheduled = false;
    _lastTick = 0;
    _tickGeneration = 0;
#else
    _fullFrameRateRequested = false;
#endif
#endif
// goes in the same task: an animation frame asked for between two would make a
// new one that outlives the leave (see requestAnimationFrame). The view goes on
// the main thread, where UIKit expects it to, as this task owns the last
#if !TARGET_OS_OSX
      // The request belonge
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `72ed90d0` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T18:09:57.196Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795025397196",
    "title": "🍏): present at full rate on macOS 14+ ProMotion devices",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "wcandillon/react-native-skia",
    "source_uri": "https://github.com/Shopify/react-native-skia",
    "source_version": "HEAD",
    "content_hash": "f57d1979655161d2a31c8e94807e2a1eb34abb2249c40cb735e63d473898e9de"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T18:09:57.196Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "f3bb1ad49b49a1149028bd71b5cbaca26cf6096d4918e952d7d74b2f8a896998"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
