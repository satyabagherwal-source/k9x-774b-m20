# Candidate Directive: [CD-008X] State-Derived Custom Matcher Context Invariant

<!-- PROVENANCE_START
{
  "source_repository": "vitest-dev-vitest-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T06:20:44.370Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-vitest-dev-vitest-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vitest-dev-vitest-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T06:20:44.370Z`  
> **Learning ID**: `LEARN-EVO-vitest-dev-vitest-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:20:44.480Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794896444480",
    "title": "State-Derived Custom Matcher Context Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vitest-dev-vitest-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "045b892be6bd80f2ff36f200d9bb1bdc1c9c9988d2198626764fadf353a0ec79"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-17T06:20:44.480Z"
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
  "auth_token": "4c24a5448d9f82d600da403b9a8cc0a834e991402042bb724fdb07ad86e70cae"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
