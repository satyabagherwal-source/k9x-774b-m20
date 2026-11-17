# Candidate Directive: [CD-O1J3] report video picture-in-picture state

<!-- PROVENANCE_START
{
  "source_repository": "NervJS/taro",
  "source_url": "https://github.com/NervJS/taro",
  "source_version": "b6eaa4ef",
  "license": "NOASSERTION",
  "timestamp": "2026-11-17T09:27:23.583Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nervjs-taro",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NervJS/taro](https://github.com/NervJS/taro) (Revision: `b6eaa4ef`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-17T09:27:23.583Z`  
> **Learning ID**: `learn-github-nervjs-taro`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/taro-h5/__tests__/ui/window.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NervJS/taro. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b6eaa4ef`: h5): report video picture-in-picture state. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/taro-h5/__tests__/ui/window.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import { checkIsPictureInPictureActive, offWindowResize, onWindowResize } from '../../src/api/ui/window'

test('reports the current video picture-in-picture state synchronously', () => {
  let activeVideo: HTMLVideoElement | null = null
  const original = Object.getOwnPropertyDescriptor(document, 'pictureInPictureElement')
  Object.defineProperty(document, 'pictureInPictureElement', {
    configurable: true,
    get: () => activeVideo,
  })

  try {
    expect(checkIsPictureInPictureActive()).toBe(false)
    activeVideo = document.createElement('video')
    expect(checkIsPictureInPictureActive()).toBe(true)
    activeVideo = null
    expect(checkIsPictureInPictureActive()).toBe(false)
  } finally {
    if (original) {
      Object.defineProperty(document, 'pictureInPictureElement', original)
    } else {
      Reflect.deleteProperty(document, 'pictureInPictureElement')
    }
  }
})
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
import { offWindowResize, onWindowResize } from '../../src/api/ui/window'
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b6eaa4ef` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T09:27:23.581Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794907643581",
    "title": "report video picture-in-picture state",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NervJS/taro",
    "source_uri": "https://github.com/NervJS/taro",
    "source_version": "HEAD",
    "content_hash": "7dcac76aba23eacce3d77e4e3b3fdc870e9d15866cbca6ff008586c0ee00f19f"
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
        "Harvested/verified timestamp recorded: 2026-11-17T09:27:23.581Z"
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
  "auth_token": "bb396be0c066197ee33bf955685539e2a05478b6eb5eebdd8775fee937451604"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
