# Candidate Directive: [CD-2CZ3] Dual-Track Synchronous-First Execution Pipeline

<!-- PROVENANCE_START
{
  "source_repository": "dubzzz/fast-check",
  "source_url": "https://github.com/dubzzz/fast-check",
  "source_version": "1114b71b",
  "license": "MIT",
  "timestamp": "2026-11-17T08:42:32.367Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dubzzz-fast-check",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dubzzz/fast-check](https://github.com/dubzzz/fast-check) (Revision: `1114b71b`).  
> **License**: MIT | **Timestamp**: `2026-11-17T08:42:32.367Z`  
> **Learning ID**: `learn-github-dubzzz-fast-check`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence (UNSUPPORTED_ASSUMPTIONS: Absolute infallibility claim lacks failure boundary)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Execution harnesses wrapping user callbacks that may be either synchronous or asynchronous MUST execute synchronously by default and MUST NOT convert synchronous returns into Promises. The harness MUST conditionally branch to asynchronous promise continuations only upon encountering a Thenable return value.

**WHY**:
Promoting synchronous functions to `Promise.resolve()` introduces microtask queue hops, destroying throughput in tight execution loops (e.g., 100,000 property iterations). Converting sync executions to promises also alters execution semantics: synchronous stack traces are preserved directly, synchronous side effects complete immediately before subsequent iterations, and unnecessary heap allocations of `Promise` instances are eliminated.

**WHEN TO APPLY**:
Apply to test runners, lifecycle hook orchestrators, middleware pipelines, interceptors, and high-throughput plugin runners that accept `() => void | Promise<void>`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Executes a sequence of callbacks synchronously if possible;
 * shifts to asynchronous resolution only when a callback returns a Thenable.
 */
export function runAllCallbacksAndReturn<T>(
  value: T,
  runCallbackAtIndex: (index: number) => void | Promise<void>,
  callbacksCount: number,
): T | Promise<T> {
  let interceptedOnce = false;
  let interceptedError: unknown = undefined;

  for (let index = 0; index !== callbacksCount; ++index) {
    try {
      const out = runCallbackAtIndex(index);
      if (out !== undefined && typeof out === 'object' && out !== null && 'then' in out) {
        // Asynchronous branch: promote remaining callbacks to async continuation
        return runAllCallbacksAndReturnAsync(
          value,
          runCallbackAtIndex,
          out as Promise<void>,
          index,
          callbacksCount,
          interceptedOnce,
          interceptedError,
        );
      }
    } catch (error) {
      if (!interceptedOnce) {
        interceptedOnce = true;
        interceptedError = error;
      }
    }
  }

  if (interceptedOnce) {
    // Invariant: Never throw synchronously if the API contract guarantees a uniform return/rejection model
    return Promise.reject(interceptedError);
  }
  return value;
}

async function runAllCallbacksAndReturnAsync<T>(
  value: T,
  runCallbackAtIndex: (index: number) => void | Promise<void>,
  firstCallbackResult: Promise<void>,
  callbackIndex: number,
  callbacksCount: number,
  hasInitialError: boolean,
  initialError: unknown,
): Promise<T> {
  let interceptedOnce = hasInitialError;
  let interceptedError = initialError;

  for (let index = callbackIndex; index !== callbacksCount; ++index) {
    try {
      const out = index === callbackIndex ? firstCallbackResult : runCallbackAtIndex(index);
      if (out !== undefined) {
        await out;
      }
    } catch (error) {
      if (!interceptedOnce) {
        interceptedOnce = true;
        interceptedError = error;
      }
    }
  }

  if (interceptedOnce) {
    throw interceptedError;
  }
  return value;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Indiscriminately wrapping every callback in async/await or Promise.resolve
export async function runAllCallbacksBad<T>(
  value: T,
  callbacks: Array<() => void | Promise<void>>,
): Promise<T> {
  // Forcing microtask queue allocation for every synchronous iteration
  for (const cb of callbacks) {
    await cb(); // Performance collapse in 100k+ iterations
  }
  return value;
}
```

**VERIFICATION METHOD**:
Verify with a benchmark and test asserting that purely synchronous callbacks return a non-Promise primitive (`expect(result instanceof Promise).toBe(false)`), and verify execution order matches synchronous invocation without deferral to `process.nextTick` or microtask loops.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:42:32.364Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence (UNSUPPORTED_ASSUMPTIONS: Absolute infallibility claim lacks failure boundary)",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.65,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 65%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=WARN, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904952364",
    "title": "Dual-Track Synchronous-First Execution Pipeline",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dubzzz/fast-check",
    "source_uri": "https://github.com/dubzzz/fast-check",
    "source_version": "HEAD",
    "content_hash": "e7d8525d843e548e810af49934b774bd906b09b315d0a4f5fabbde064c11d9eb"
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
      "status": "WARN",
      "score": 0.85,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": false,
      "opposing_rule": null,
      "unsupported_assumptions": [
        "Absolute infallibility claim lacks failure boundary"
      ],
      "findings": [
        "UNSUPPORTED_ASSUMPTIONS: Absolute infallibility claim lacks failure boundary"
      ],
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:42:32.364Z"
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
  "auth_token": "cd8d7169718e5b146c2959b409b38b9e18f878ab30b8eaca5e40bd2d02bd6237"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
