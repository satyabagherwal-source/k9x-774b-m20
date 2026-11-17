# Candidate Directive: [CD-Q6BM] [Jest] Fix `fireEvent.press` being dropped by detectors

<!-- PROVENANCE_START
{
  "source_repository": "software-mansion/react-native-gesture-handler",
  "source_url": "https://github.com/software-mansion/react-native-gesture-handler",
  "source_version": "c09aaa6a",
  "license": "MIT",
  "timestamp": "2026-11-17T19:44:54.659Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-software-mansion-react-native-gesture-handler",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [software-mansion/react-native-gesture-handler](https://github.com/software-mansion/react-native-gesture-handler) (Revision: `c09aaa6a`).  
> **License**: MIT | **Timestamp**: `2026-11-17T19:44:54.659Z`  
> **Learning ID**: `learn-github-software-mansion-react-native-gesture-handler`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/react-native-gesture-handler/src/__tests__/api_v3.test.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in software-mansion/react-native-gesture-handler. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0bf533d4`: [Jest] Fix `fireEvent.press` being dropped by detectors. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/react-native-gesture-handler/src/__tests__/api_v3.test.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import { Keyboard, Text, TextInput, View } from 'react-native';
      ({ props }) => props.handlerTags && props.onStartShouldSetResponderCapture
      expect(nativeDetector?.props.onStartShouldSetResponderCapture()).toBe(
        false
      );
      expect(
        interceptingDetector?.props.onStartShouldSetResponderCapture()
      ).toBe(false);
      expect(
        interceptingDetector?.props.onStartShouldSetResponderCapture()
      ).toBe(false);
      expect(scrollViewDetector?.props.onStartShouldSetResponderCapture()).toBe(
        false
      );
      expect(nativeDetector?.props.onStartShouldSetResponderCapture()).toBe(
        false
      );
      expect(nativeDetector?.props.onStartShouldSetResponderCapture()).toBe(
        false
      );
      expect(nativeDetector?.props.onStartShouldSetResponderCapture()).toBe(
        false
      );

    // testing-library drops a press when the nearest host view with a
    // bubble-phase `onStartShouldSetResponder` returns false (#4689)
    test('fireEvent.press reaches onPress from inside an InterceptingGestureDetector', () => {
      const pressFn = jest.fn();

      render(
        <GestureHandlerRootView>
          <Touchable 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
import { Keyboard, TextInput, View } from 'react-native';
      ({ props }) => props.handlerTags && props.onStartShouldSetResponder
      expect(nativeDetector?.props.onStartShouldSetResponder()).toBe(false);
      expect(interceptingDetector?.props.onStartShouldSetResponder()).toBe(
        false
      );
      expect(interceptingDetector?.props.onStartShouldSetResponder()).toBe(
        false
      );
      expect(scrollViewDetector?.props.onStartShouldSetResponder()).toBe(false);
      expect(nativeDetector?.props.onStartShouldSetResponder()).toBe(false);
      expect(nativeDetector?.props.onStartShouldSetResponder()).toBe(false);
      expect(nativeDetector?.props.onStartShouldSetResponder()).toBe(false);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0bf533d4` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T19:44:54.657Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794944694657",
    "title": "[Jest] Fix `fireEvent.press` being dropped by detectors",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "software-mansion/react-native-gesture-handler",
    "source_uri": "https://github.com/software-mansion/react-native-gesture-handler",
    "source_version": "HEAD",
    "content_hash": "668e616f214c0c278dfd20d3614901614d76e81979d7057e3481f49a5958ef44"
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
        "Harvested/verified timestamp recorded: 2026-11-17T19:44:54.657Z"
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
  "auth_token": "2312a892152f4ad3bff5147ede94a1f84838b18fc9860ea3134372c7089a4cc3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
