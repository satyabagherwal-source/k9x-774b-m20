# Candidate Directive: [CD-5IKI] Dual-Track Synchronous-First Execution Pipeline

<!-- PROVENANCE_START
{
  "source_repository": "dubzzz-fast-check-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:44:59.427Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dubzzz-fast-check-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dubzzz-fast-check-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:44:59.427Z`  
> **Learning ID**: `LEARN-EVO-dubzzz-fast-check-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records; UNSUPPORTED_ASSUMPTIONS: Absolute infallibility claim lacks failure boundary
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:44:59.567Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records; UNSUPPORTED_ASSUMPTIONS: Absolute infallibility claim lacks failure boundary",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=WARN, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794905099567",
    "title": "Dual-Track Synchronous-First Execution Pipeline",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dubzzz-fast-check-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "67d2f80a87bba172396dba83c48eed00988fd68d89227724014c3a47c2295b29"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:44:59.568Z"
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
  "auth_token": "bea6bf5b05f27fef2b372c0dcb5b5922e47060da3b1b27620709aa6c6d0036f4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
