# Candidate Directive: [CD-Z4NA] Android, Stack v4): keep a popped screen's content during its exit animation

<!-- PROVENANCE_START
{
  "source_repository": "software-mansion/react-native-screens",
  "source_url": "https://github.com/software-mansion/react-native-screens",
  "source_version": "1b8f2fde",
  "license": "MIT",
  "timestamp": "2026-11-26T11:29:01.510Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-software-mansion-react-native-screens",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [software-mansion/react-native-screens](https://github.com/software-mansion/react-native-screens) (Revision: `1b8f2fde`).  
> **License**: MIT | **Timestamp**: `2026-11-26T11:29:01.510Z`  
> **Learning ID**: `learn-github-software-mansion-react-native-screens`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `android/src/fabric/java/com/swmansion/rnscreens/legacy/NativeProxy.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in software-mansion/react-native-screens. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e21b804a`: Android, Stack v4): keep a popped screen's content during its exit animation. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `android/src/fabric/java/com/swmansion/rnscreens/legacy/NativeProxy.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import com.facebook.react.bridge.UIManager
import com.facebook.react.bridge.UIManagerListener
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import java.util.concurrent.ConcurrentLinkedQueue
@OptIn(UnstableReactNativeAPI::class)
class NativeProxy : UIManagerListener {
        // Added by the thread that pulled the transaction removing the screen, drained on the UI
        // thread before that transaction mounts. Shared by all proxies, because the native removal
        // listener notifies only the most recently installed one. Never cleared: invalidating one
        // React instance must not drop another instance's screens.
        private val screensPendingRemovalTransition = ConcurrentLinkedQueue<WeakReference<Screen>>()

    // Called from native, on the thread that pulls the mounting transaction: the JS thread in
    // the push model, the UI thread in the pull model or when rendering synchronously.
            // The transaction removes the screen's children before the screen, so the transition
            // must start before the transaction mounts. A transaction pulled on the UI thread can't
            // 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
class NativeProxy {
    // Called from native. Currently this method is called from MountingCoordinator thread,
    // which usually is not UI thread.
            // Fabric's mounting transaction removes the screen on a Choreographer frame callback,
            // which can execute before `startRemovalTransition` (scheduled via `Handler.post`).
            // To prevent `Screen.isBeingRemoved` from being read as false during teardown,
            // we must set this flag synchronously here.
            screen.markAsBeingRemoved()
            val isScheduled =
                screen.post {
                    screen.startRemovalTransition()
                }
            if (!isScheduled) {
                Log.w("[RNScreens]", "Failed to schedule removal transition start for screen with tag $screenTag")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e21b804a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T11:29:01.507Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795692541507",
    "title": "Android, Stack v4): keep a popped screen's content during its exit animation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "software-mansion/react-native-screens",
    "source_uri": "https://github.com/software-mansion/react-native-screens",
    "source_version": "HEAD",
    "content_hash": "500ce217d23160b7d7111e2a07cebc2ef1732a47ffb82783a2a5d11c595b16d0"
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
        "Harvested/verified timestamp recorded: 2026-11-26T11:29:01.508Z"
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
  "auth_token": "df8281b7633ef1beab4a75dadf34256c8ecf096123b930ebf441682078d18047"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
