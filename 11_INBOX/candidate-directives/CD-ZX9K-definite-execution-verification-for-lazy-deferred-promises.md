# Candidate Directive: [CD-ZX9K] Definite Execution Verification for Lazy Deferred Promises

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
    then(onFulfilled, onRejected) {
      wasAwaited = true
      executionPromise ||= taskFactory(sourceError)
      return executionPromise.then(onFulfilled, onRejected)
    },
    catch(onRejected) {
      wasAwaited = true
      executionPromise ||= taskFactory(sourceError)
      return executionPromise.catch(onRejected)
    },
    finally(onFinally) {
      wasAwaited = true
      executionPromise ||= taskFactory(sourceError)
      return executionPromise.finally(onFinally)
    },
    [Symbol.toStringTag]: 'Promise',
  } as Promise<T>
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Returning an eagerly executing promise without lifecycle tracking
export function unsafeDeferredAction<T>(action: () => Promise<T>): Promise<T> {
  // If the consumer omits 'await', this continues executing beyond the test life cycle
  // silently corrupting state in following tests.
  return action()
}
```

**VERIFICATION METHOD**:
Run a suite where a deferred call is made without `await`. Assert that the test fails at completion with `DeferredCallNotAwaitedError` and the correct source line number:
```typescript
it('flags unawaited actions at test teardown', async () => {
  const mockContext = { type: 'test', onFinished: [] }
  let executed = false

  const deferred = ensureAwaited(() => mockContext, async () => {
    executed = true
  })

  // Deliberately omit: await deferred;
  expect(executed).toBe(false)
  expect(() => {
    for (const hook of mockContext.onFinished) hook()
  }).toThrow('DeferredCallNotAwaitedError')
})
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:20:40.615Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794896440615",
    "title": "Definite Execution Verification for Lazy Deferred Promises",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vitest-dev/vitest",
    "source_uri": "https://github.com/vitest-dev/vitest",
    "source_version": "HEAD",
    "content_hash": "5101940cb602f5d8a33b8a1c132b9758417deb835c19068b8c75dea73a5b40b5"
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:20:40.615Z"
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
  "auth_token": "021a984a571a385d1798846c6f7a69391c6c931ba5b97c3981bcfaaa38dd1473"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
