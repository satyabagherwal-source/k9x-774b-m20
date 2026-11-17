# Candidate Directive: [CD-ZX9K] State-Derived Custom Matcher Context Invariant

<!-- PROVENANCE_START
{
  "source_repository": "vitest-dev/vitest",
  "source_url": "https://github.com/vitest-dev/vitest",
  "source_version": "4e905a1b",
  "license": "MIT",
  "timestamp": "2026-11-17T06:20:40.616Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-vitest-dev-vitest",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vitest-dev/vitest](https://github.com/vitest-dev/vitest) (Revision: `4e905a1b`).  
> **License**: MIT | **Timestamp**: `2026-11-17T06:20:40.616Z`  
> **Learning ID**: `learn-github-vitest-dev-vitest`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Custom matchers and assertion plugins MUST derive their runtime execution context (`this` bound state) dynamically from the current execution environment (`expect.getState()`) rather than from a global closure or root-level static object.

**WHY**:
In concurrent test execution modes (`test.concurrent`), multiple tests run asynchronously across the same event loop within a single worker. If assertion matchers bind their context to a static or shared global state reference, calls to `expect.setState({ ... })` from concurrently running tests will overwrite one another. Matchers then inspect corrupt state (such as assertion counters, snapshot paths, or custom context flags), leading to false positives or cross-test assertion pollution.

**WHEN TO APPLY**:
- Assertion libraries and test runners offering concurrent or async-interleaved execution.
- Systems utilizing global DSL methods (`expect(...)`) that delegate internally to per-task execution context.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export interface MatcherState {
  assertionCalls: number
  expectedAssertionsNumber?: number
  isNot?: boolean
  testPath?: string
  currentTestName?: string
  [key: string]: unknown
}

export type MatcherFn = (this: MatcherState, received: unknown, ...args: unknown[]) => {
  pass: boolean
  message: () => string
}

export class MatcherRegistry {
  private customMatchers: Record<string, MatcherFn> = Object.create(null)

  public extend(matchers: Record<string, MatcherFn>): void {
    Object.assign(this.customMatchers, matchers)
  }

  public wrapMatcher(
    matcherName: string,
    getCurrentState: () => MatcherState
  ) {
    const rawMatcher = this.customMatchers[matcherName]
    return (...args: unknown[]) => {
      // DYNAMIC BINDING: State is extracted at the exact instant of assertion evaluation
      const currentState = getCurrentState()
      const context: MatcherState = Object.assign(
        Object.create(null),
        currentState,
        { matcherName }
      )
      return rawMatcher.apply(context, args as [unknown, ...unknown[]])
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Capturing static reference at setup time
export function bindMatchersStatically(
  matchers: Record<string, MatcherFn>,
  globalState: MatcherState
) {
  const bound: Record<string, Function> = {}
  for (const [name, fn] of Object.entries(matchers)) {
    // DEFECT: Binds permanently to globalState. Concurrent test runs using
    // expect.setState() will not be seen here, or will collide.
    bound[name] = (...args: unknown[]) => fn.apply(globalState, args)
  }
  return bound
}
```

**VERIFICATION METHOD**:
Execute two concurrent test cases where each sets distinct flags via `expect.setState()` and asserts them simultaneously through a custom matcher:
```typescript
test.concurrent('suite A', async () => {
  expect.setState({ currentScope: 'SCOPE_A' })
  await delay(10)
  expect(true).toVerifyScope('SCOPE_A')
})

test.concurrent('suite B', async () => {
  expect.setState({ currentScope: 'SCOPE_B' })
  await delay(10)
  expect(true).toVerifyScope('SCOPE_B')
})
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:20:40.616Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794896440616",
    "title": "State-Derived Custom Matcher Context Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vitest-dev/vitest",
    "source_uri": "https://github.com/vitest-dev/vitest",
    "source_version": "HEAD",
    "content_hash": "ce559cec1b4845a27586898e6b7b97d9753febfd77f20b528233f0cf8f838d69"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:20:40.616Z"
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
  "auth_token": "8d25a5f5eefd46de59d975bfe332dab2da110336045fdd0f7049eb4328ebc6f6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
