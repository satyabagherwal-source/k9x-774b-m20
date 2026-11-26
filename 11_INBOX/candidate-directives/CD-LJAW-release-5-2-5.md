# Candidate Directive: [CD-LJAW] release 5.2.5

<!-- PROVENANCE_START
{
  "source_repository": "margelo-react-native-vision-camera-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T22:02:18.341Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-margelo-react-native-vision-camera-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [margelo-react-native-vision-camera-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T22:02:18.341Z`  
> **Learning ID**: `LEARN-EVO-margelo-react-native-vision-camera-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-26T22:02:18.483Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795730538483",
    "title": "release 5.2.5",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "margelo-react-native-vision-camera-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9474ee4cf9ce5d07833b7f1c8fa67d221923e31fa87217a40ff62f7753764c5f"
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
        "Harvested/verified timestamp recorded: 2026-11-26T22:02:18.484Z"
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
  "auth_token": "dc33c23c96ea4c0128dc18ab1de1940af13abb4f56c019a6da0c83e422b09fb4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
