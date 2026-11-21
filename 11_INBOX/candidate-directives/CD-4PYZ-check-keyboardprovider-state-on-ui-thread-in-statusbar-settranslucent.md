# Candidate Directive: [CD-4PYZ] check `KeyboardProvider` state on UI thread in `StatusBar.setTranslucent`

<!-- PROVENANCE_START
{
  "source_repository": "kirillzyusko/react-native-keyboard-controller",
  "source_url": "https://github.com/kirillzyusko/react-native-keyboard-controller",
  "source_version": "67112625",
  "license": "MIT",
  "timestamp": "2026-11-21T04:39:06.875Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-kirillzyusko-react-native-keyboard-controller",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kirillzyusko/react-native-keyboard-controller](https://github.com/kirillzyusko/react-native-keyboard-controller) (Revision: `67112625`).  
> **License**: MIT | **Timestamp**: `2026-11-21T04:39:06.875Z`  
> **Learning ID**: `learn-github-kirillzyusko-react-native-keyboard-controller`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `android/src/main/java/com/reactnativekeyboardcontroller/modules/statusbar/StatusBarManagerCompatModuleImpl.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kirillzyusko/react-native-keyboard-controller. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c0dceafe`: check `KeyboardProvider` state on UI thread in `StatusBar.setTranslucent`. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `android/src/main/java/com/reactnativekeyboardcontroller/modules/statusbar/StatusBarManagerCompatModuleImpl.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    // `<StatusBar />` can call this method before `KeyboardProvider` is mounted, so its state is checked
    // on the UI thread. Otherwise the original implementation replaces the insets listener of
    // `KeyboardProvider` with the one that removes the top inset for the whole view hierarchy.
    UiThreadUtil.runOnUiThread {
      if (!isEnabled()) {
        original.setTranslucent(translucent)
        return@runOnUiThread
      }
      if (BuildConfig.IS_EDGE_TO_EDGE_ENABLED) {
        Logger.w(TAG, "StatusBarModule: Ignored status bar change, current activity is edge-to-edge.")
        return@runOnUiThread
      }
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
    if (!isEnabled()) {
      return original.setTranslucent(translucent)
    }
    if (BuildConfig.IS_EDGE_TO_EDGE_ENABLED) {
      Logger.w(TAG, "StatusBarModule: Ignored status bar change, current activity is edge-to-edge.")
      return
    }
    UiThreadUtil.runOnUiThread {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c0dceafe` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T04:39:06.873Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795235946873",
    "title": "check `KeyboardProvider` state on UI thread in `StatusBar.setTranslucent`",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kirillzyusko/react-native-keyboard-controller",
    "source_uri": "https://github.com/kirillzyusko/react-native-keyboard-controller",
    "source_version": "HEAD",
    "content_hash": "d3805db5e634f346729d4c359945513a84dbb1a431e26183b98d1b9fe5b66d8c"
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
        "Harvested/verified timestamp recorded: 2026-11-21T04:39:06.873Z"
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
  "auth_token": "70942888e88ee46dae83938e6a23cdf40d356fd1ce4219fcd56681ef141dfb37"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
