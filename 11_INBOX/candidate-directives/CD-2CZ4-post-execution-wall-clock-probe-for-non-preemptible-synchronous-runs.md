# Candidate Directive: [CD-2CZ4] Post-Execution Wall-Clock Probe for Non-Preemptible Synchronous Runs

<!-- PROVENANCE_START
{
  "source_repository": "dubzzz/fast-check",
  "source_url": "https://github.com/dubzzz/fast-check",
  "source_version": "1114b71b",
  "license": "MIT",
  "timestamp": "2026-11-17T08:42:32.368Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dubzzz-fast-check",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dubzzz/fast-check](https://github.com/dubzzz/fast-check) (Revision: `1114b71b`).  
> **License**: MIT | **Timestamp**: `2026-11-17T08:42:32.368Z`  
> **Learning ID**: `learn-github-dubzzz-fast-check`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing timeout bounds around code blocks in single-threaded runtimes (such as JavaScript/Node.js/V8), the timeout harness MUST record a monotonic start timestamp (`performance.now()`) prior to execution and MUST check the elapsed duration upon synchronous return. If elapsed time exceeds the deadline, the harness MUST override any successful return value with a timeout failure.

**WHY**:
In single-threaded event loops, an active synchronous computation blocks the thread entirely; scheduled timer callbacks (`setTimeout`) cannot fire during execution. Without a post-run wall-clock delta check, a synchronous function that blocks the thread for longer than the timeout limit will return control to the runner and falsely register as successful because `clearTimeout` is invoked before the timer callback ever has a chance to execute.

**WHEN TO APPLY**:
Apply to all execution wrappers, test harnesses, sandboxes, and plugin systems where user-provided sync code is bounded by a timeout budget.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
const safeSetTimeout = setTimeout;
const safeClearTimeout = clearTimeout;
const safePerformanceNow = performance.now.bind(performance);

export interface ExecutionFailure {
  error: Error;
}

export function timeoutAfter(timeMs: number) {
  let timeoutHandle: ReturnType<typeof safeSetTimeout> | undefined = undefined;
  const abortController = new AbortController();
  const startTimeProbe = safePerformanceNow();

  const promise = new Promise<ExecutionFailure>((resolve) => {
    timeoutHandle = safeSetTimeout(() => {
      const error = new Error(`Execution timeout: exceeded limit of ${timeMs} milliseconds`);
      resolve({ error });
      abortController.abort(error);
    }, timeMs);
  });

  return {
    clear: (): ExecutionFailure | undefined => {
      safeClearTimeout(timeoutHandle);
      // High-precision monotonic elapsed check for blocked synchronous execution
      if (safePerformanceNow() - startTimeProbe >= timeMs) {
        return {
          error: new Error(`Execution timeout: exceeded limit of ${timeMs} milliseconds`),
        };
      }
      return undefined;
    },
    promise,
    signal: abortController.signal,
  };
}

export function executeWithTimeout<TVal, TContext>(
  limitMs: number,
  runFn: (val: TVal, ctx: TContext) => unknown | Promise<unknown>,
  val: TVal,
  ctx: TContext,
): unknown | Promise<unknown> {
  const timer = timeoutAfter(limitMs);
  const out = runFn(val, ctx);

  if (out === null || typeof out !== 'object' || !('then' in out)) {
    // Synchronous execution branch: evaluate elapsed time
    const override = timer.clear();
    if (override !== undefined) {
      return override;
    }
    return out;
  }

  // Asynchronous execution branch: race against timer promise
  return Promise.race([
    out,
    timer.promise.then((failure) => failure),
  ]).finally(() => {
    timer.clear();
  });
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Relying strictly on setTimeout for synchronous execution boundaries
function faultyTimeoutRunner(limitMs: number, fn: () => void) {
  let timedOut = false;
  const handle = setTimeout(() => { timedOut = true; }, limitMs);
  
  // If fn() executes synchronously for 5000ms when limitMs is 1000ms,
  // setTimeout cannot fire during this blocking period.
  fn(); 
  
  clearTimeout(handle); // Handle is cleared before the event loop can process timer!
  if (timedOut) throw new Error("Timed out"); // Never reached!
}
```

**VERIFICATION METHOD**:
Implement a mock or fake timer integration test where a synchronous predicate blocks execution past the timeout window (e.g. using `vi.advanceTimersByTime(10_000)` or busy loop), verifying that the harness flags a failure matching `Property timeout: exceeded limit of ${testTimeout} milliseconds`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:42:32.367Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904952367",
    "title": "Post-Execution Wall-Clock Probe for Non-Preemptible Synchronous Runs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dubzzz/fast-check",
    "source_uri": "https://github.com/dubzzz/fast-check",
    "source_version": "HEAD",
    "content_hash": "ed77e0c76fed633b0eb1154775ad81eaf51e783f565ffaf4cdd3d29beb2bbb07"
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:42:32.367Z"
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
  "auth_token": "f34d01836dbde278853a707a9b5780cffdc52b466d2bfaccbf2b04fd65ccc99b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
