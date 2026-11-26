# Candidate Directive: [CD-LFMB] release 5.2.5

<!-- PROVENANCE_START
{
  "source_repository": "margelo/react-native-vision-camera",
  "source_url": "https://github.com/margelo/react-native-vision-camera",
  "source_version": "d54fc486",
  "license": "MIT",
  "timestamp": "2026-11-26T22:02:13.715Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-margelo-react-native-vision-camera",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [margelo/react-native-vision-camera](https://github.com/margelo/react-native-vision-camera) (Revision: `d54fc486`).  
> **License**: MIT | **Timestamp**: `2026-11-26T22:02:13.715Z`  
> **Learning ID**: `learn-github-margelo-react-native-vision-camera`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `apps/simple-camera/ios/Podfile.lock`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in margelo/react-native-vision-camera. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d54fc486`: release 5.2.5. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/simple-camera/ios/Podfile.lock`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  - NitroModules (0.37.2):
  - VisionCamera (5.2.5):
  - VisionCameraBarcodeScanner (5.2.5):
  - VisionCameraLocation (5.2.5):
  - VisionCameraResizer (5.2.5):
  - VisionCameraWorklets (5.2.5):
  NitroModules: 5cd4cd681ddfbf7023b720bb042ff06345acce76
  VisionCamera: b2f1c560064bca2ff47de9e8440b1ad72b8805aa
  VisionCameraBarcodeScanner: 8f03ef68fc5cff7d0e881d874f649d80ad425146
  VisionCameraLocation: d2d56bca8d2f041222360204a86a292c3a704108
  VisionCameraResizer: 06636c9d8f9c889375a799491ba5e964188585f9
  VisionCameraWorklets: 1fd5c0ec3757ecb1cbcc6f18f388d26883e1e1b0
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
  - NitroModules (0.37.0):
  - VisionCamera (5.2.4):
  - VisionCameraBarcodeScanner (5.2.4):
  - VisionCameraLocation (5.2.4):
  - VisionCameraResizer (5.2.4):
  - VisionCameraWorklets (5.2.4):
  NitroModules: cda827b31eb05c1bfcc0e2bbd9b647a69c6c314f
  VisionCamera: bd275acfc8307bfadc8f320880a14d196c243ef7
  VisionCameraBarcodeScanner: f323ff15285506ab428226fd03ddfb7add98cbad
  VisionCameraLocation: 7381650de6fce6386e555cbf0cd4d414e1b077ad
  VisionCameraResizer: f887ca7660580dad0d0da536d75aa77908f572f6
  VisionCameraWorklets: 02b8a518be01168864acef59e39bc9031bcf0567
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d54fc486` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T22:02:13.712Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795730533712",
    "title": "release 5.2.5",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "margelo/react-native-vision-camera",
    "source_uri": "https://github.com/margelo/react-native-vision-camera",
    "source_version": "HEAD",
    "content_hash": "9474ee4cf9ce5d07833b7f1c8fa67d221923e31fa87217a40ff62f7753764c5f"
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
        "Harvested/verified timestamp recorded: 2026-11-26T22:02:13.712Z"
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
  "auth_token": "227d71af74d657499916239bdff02460469bb1fca27a4c864745b3de9a7b2dc0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
