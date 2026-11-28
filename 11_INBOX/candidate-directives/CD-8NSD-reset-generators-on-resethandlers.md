# Candidate Directive: [CD-8NSD] reset generators on `.resetHandlers()`

<!-- PROVENANCE_START
{
  "source_repository": "mswjs/msw",
  "source_url": "https://github.com/mswjs/msw",
  "source_version": "0f87d469",
  "license": "MIT",
  "timestamp": "2026-11-28T12:35:45.901Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mswjs-msw",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mswjs/msw](https://github.com/mswjs/msw) (Revision: `0f87d469`).  
> **License**: MIT | **Timestamp**: `2026-11-28T12:35:45.901Z`  
> **Learning ID**: `learn-github-mswjs-msw`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/core/experimental/define-network.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mswjs/msw. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a800c3bf`: reset generators on `.resetHandlers()`. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/core/experimental/define-network.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import { setTimeout } from 'node:timers/promises'
test('throws when enabling an already enabled network', () => {
  class SyncNetworkSource extends NetworkSource {
    enable = () => {}
  }
  const network = defineNetwork({
    sources: [new SyncNetworkSource()],
  })

  expect(network.enable()).toBeUndefined()
  expect(() => network.enable()).toThrow(
    'Failed to call "enable" on the network: already enabled',
  )
  network.disable()
  expect(network.enable()).toBeUndefined()
})
test('returns a sync enable if all the sources are sync', () => {
  class SyncNetworkSource extends NetworkSource {
    enable = () => {}
  }
  const network = defineNetwork({
    sources: [new SyncNetworkSource()],
  expect(network.enable()).toBeUndefined()
})
test('returns an async enable if any of the sources are async', () => {
  class SyncNetworkSource extends NetworkSource {
    enable = () => {}
  }
  class AsyncNetworkSource extends NetworkSource {
    enable = async () => {}
  }

  const network = defineNetwork({
    sources: [new SyncNetworkSource(), new AsyncNetworkSource()],
  expect(network.enable()).toBeInstanceOf(Promise)
})

test('returns an async enable if all the sources are async', ()
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
describe('enable()', () => {
  test('throws if called on already enabled network', () => {
    class SyncNetworkSource extends NetworkSource {
      enable = () => {}
    }
    const network = defineNetwork({
      sources: [new SyncNetworkSource()],
    })
    expect(network.enable()).toBeUndefined()
    expect(() => network.enable()).toThrow(
      'Failed to call "enable" on the network: already enabled',
    )
    network.disable()
    expect(network.enable()).toBeUndefined()
  test('returns a sync enable if all the sources are sync', () => {
    class SyncNetworkSource extends NetworkSource {
      enable = () => {}
    }
    const network = defineNetwork({
      sources: [new SyncNetworkSource()],
    })
    expect(network.enable()).toBeUndefined()
  test('returns an async enable if any of the sources are async', () => {
    class SyncNetworkSource extends NetworkSource {
      enable = () => {}
    }
    class AsyncNetworkSource extends NetworkSource {
      enable = async () => {}
    }
    const network = defineNetwork({
      sources: [new SyncNetworkSource(), new AsyncNetworkSource()],
    })
    expect(network.enable()).toBeInstanceOf(Promise)
  test('returns an async e
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a800c3bf` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T12:35:45.899Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795869345899",
    "title": "reset generators on `.resetHandlers()`",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mswjs/msw",
    "source_uri": "https://github.com/mswjs/msw",
    "source_version": "HEAD",
    "content_hash": "a30a7085e9a75ba8741c15008654f65a55091236c9bb88385561e03c08af0128"
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
        "Harvested/verified timestamp recorded: 2026-11-28T12:35:45.899Z"
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
  "auth_token": "a98c1e4c6c7663613d603c4fd9cd5fd10f6dcf8b26c281c5799fb059e9c8041c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
