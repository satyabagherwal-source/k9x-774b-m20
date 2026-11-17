# Candidate Directive: [CD-008W] Definite Execution Verification for Lazy Deferred Promises

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
Asynchronous APIs returned by test utilities, locators, and UI interaction engines that defer execution until awaited MUST register a lifecycle cleanup guard that checks whether the action was settled before the test context completes. If the promise was constructed but never `.then()`-ed or `await`-ed, the guard MUST throw an explicit error pinpointing the unawaited expression's call site, preventing hidden asynchronous floating tasks and unhandled rejections.

**WHY**:
Fluent APIs and interactive assertion chains (such as UI locators, database transaction builders, and browser commands) often construct promises lazily or return objects conforming to the `PromiseLike` interface. If a consumer writes `locator.click()` without `await`, the action either runs out-of-band during subsequent tests (inducing intermittent, non-deterministic race conditions and test pollution), or drops errors into the host runtime as unhandled promise rejections after the test reporting boundary has closed.

**WHEN TO APPLY**:
- Browser automation locators and testing APIs (`@vitest/browser`, Playwright, Puppeteer).
- ORM/Database query builders (`knex`, `prisma`, `drizzle`).
- Any deferred builder returning a `PromiseLike` interface executed within scoped lifecycle bounds.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export interface ActiveTestContext {
  type: string
  onFinished: Array<() => void | Promise<void>>
}

export function ensureAwaited<T>(
  getCurrentContext: () => ActiveTestContext | undefined,
  taskFactory: (sourceError: Error) => Promise<T>,
): Promise<T> {
  const context = getCurrentContext()
  if (!context || context.type !== 'test') {
    // If not running within an active test harness, fall back to eager resolution
    const traceError = new Error('STACK_TRACE_ORIGIN')
    return taskFactory(traceError)
  }

  let wasAwaited = false
  const sourceError = new Error('DeferredCallNotAwaitedError')

  // Register guard into the test's cleanup pipeline
  context.onFinished ??= []
  context.onFinished.push(() => {
    if (!wasAwaited) {
      const unawaitedError = new Error(
        'The asynchronous command was constructed but not awaited. ' +
        'Execution was prevented to avoid out-of-band unhandled rejections.'
      )
      // Preserve original call-site stack trace for developer debugging
      unawaitedError.stack = sourceError.stack?.replace(sourceError.message, unawaitedError.message)
      throw unawaitedError
    }
  })

  let executionPromise: Promise<T> | undefined

  return {

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:20:44.479Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794896444479",
    "title": "Definite Execution Verification for Lazy Deferred Promises",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vitest-dev-vitest-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "d81afd24306bb858a2211157ed61b54d143c5dd2ae5833ef1522db36f8d872b7"
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
  "auth_token": "eb0e52f29190d18a83dc28ad3bdfa1459f8fa74c308d06783cd0e6ad372054c2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
