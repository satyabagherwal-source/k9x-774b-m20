# Candidate Directive: [CD-3TKN] [iOS] Fix worklet callbacks running on the JS thread when `enabled` turns off mi

<!-- PROVENANCE_START
{
  "source_repository": "software-mansion/react-native-gesture-handler",
  "source_url": "https://github.com/software-mansion/react-native-gesture-handler",
  "source_version": "b9b1140e",
  "license": "MIT",
  "timestamp": "2026-11-14T10:16:38.519Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-software-mansion-react-native-gesture-handler",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [software-mansion/react-native-gesture-handler](https://github.com/software-mansion/react-native-gesture-handler) (Revision: `b9b1140e`).  
> **License**: MIT | **Timestamp**: `2026-11-14T10:16:38.519Z`  
> **Learning ID**: `learn-github-software-mansion-react-native-gesture-handler`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/react-native-gesture-handler/apple/RNGestureHandler.mm`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in software-mansion/react-native-gesture-handler. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b9b1140e`: [iOS] Fix worklet callbacks running on the JS thread when `enabled` turns off mid-gesture. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/react-native-gesture-handler/apple/RNGestureHandler.mm`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  // Only the stored value is reset here. The recognizer is synced once the new config is applied,
  // see `syncRecognizerEnabled`.
  _enabled = YES;
    _enabled = [RCTConvert BOOL:prop];

  [self syncRecognizerEnabled];
// Disabling an active recognizer cancels it synchronously, and the cancellation event is sent right away.
// The recognizer is therefore synced at the end of `updateConfig:`, once `dispatchesAnimatedEvents` and
// `dispatchesReanimatedEvents` hold their new values, so that the event reaches the right handler type.
- (void)syncRecognizerEnabled
{
  if (self.recognizer.enabled != _enabled) {
    self.recognizer.enabled = _enabled;
  }
}

```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
  self.enabled = YES;
    self.enabled = [RCTConvert BOOL:prop];
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b9b1140e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T10:16:38.516Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794651398516",
    "title": "[iOS] Fix worklet callbacks running on the JS thread when `enabled` turns off mi",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "software-mansion/react-native-gesture-handler",
    "source_uri": "https://github.com/software-mansion/react-native-gesture-handler",
    "source_version": "HEAD",
    "content_hash": "99e3c3bee6c7390a5a7143a0e04980880479f9f8f141d84e68228233dbb4af9c"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-14T10:16:38.516Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "e60cb6fd2ead024441486971aeb76354b59934752ee5a857b81fc9d96aab4942"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
