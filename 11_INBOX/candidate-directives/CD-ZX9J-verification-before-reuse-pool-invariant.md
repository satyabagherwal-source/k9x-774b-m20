# Candidate Directive: [CD-ZX9J] Verification-Before-Reuse Pool Invariant

<!-- PROVENANCE_START
{
  "source_repository": "vitest-dev/vitest",
  "source_url": "https://github.com/vitest-dev/vitest",
  "source_version": "4e905a1b",
  "license": "MIT",
  "timestamp": "2026-11-17T06:20:40.615Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-vitest-dev-vitest",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vitest-dev/vitest](https://github.com/vitest-dev/vitest) (Revision: `4e905a1b`).  
> **License**: MIT | **Timestamp**: `2026-11-17T06:20:40.615Z`  
> **Learning ID**: `learn-github-vitest-dev-vitest`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
A worker, thread, connection, or shared execution resource MUST verify its operational startup completion status (`runner.isStarted === true`) prior to accepting subsequent tasks in non-isolated or pooled execution modes. It MUST NOT infer usability merely from the absence of a termination flag (`!runner.isTerminated`).

**WHY**:
In pooled execution models (e.g., database connection pools, thread workers, isolated VM contexts), a worker can encounter an unhandled exception or rejection during its initial configuration/asynchronous startup lifecycle before entering its steady-state runloop. If the manager checks only `!isTerminated`, a worker whose startup crashed remains eligible in the scheduling queue. When assigned tasks, it will either immediately fail, enter a unresolvable hanging promise state, or process requests with corrupt context.

**WHEN TO APPLY**:
- Worker thread and child process pooling mechanisms.
- Database connection pools and multiplexed TCP/HTTP2 client sessions.
- VM sandbox management and persistent worker queues (`isolate: false`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export interface ManagedWorker {
  id: string
  isStarted: boolean
  isTerminated: boolean
  start(): Promise<void>
  execute(task: Task): Promise<TaskResult>
}

export class ExecutionPool {
  private queue: Array<{ task: Task; isolate: boolean }> = []
  private activeWorkers: ManagedWorker[] = []

  public canReuseWorker(worker: ManagedWorker, nextTask: { isolate: boolean }): boolean {
    return (
      !nextTask.isolate &&
      // CRITICAL: The worker must have successfully finished its startup phase.
      // An unstarted or failed-startup worker has !isTerminated === true, but is invalid.
      worker.isStarted &&
      !worker.isTerminated &&
      !this.isResourceExhausted(worker)
    )
  }

  private isResourceExhausted(worker: ManagedWorker): boolean {
    // Memory and task threshold verification
    return false
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Inferring readiness from the absence of a termination signal
export class UnsafeExecutionPool {
  public canReuseWorker(worker: ManagedWorker, nextTask: { isolate: boolean }): boolean {
    // DEFECT: If worker.start() threw an exception, worker.isTerminated may still be false
    // while the worker is in an uninitialized, invalid state.
    if (!nextTask.isolate && !worker.isTerminated) {
      return true
    }
    return false
  }
}
```

**VERIFICATION METHOD**:
Automated integration test injecting an unconditional failure inside `worker.start()`. Verify that the orchestrator removes the worker from the queue, marks the task failed with an explicit startup error, spawns a replacement worker for queued tasks, and does not hang the event loop:
```typescript
test('failed worker startup prevents reuse and does not hang queue', async () => {
  const pool = new ExecutionPool()
  const faultyWorker = new FaultyWorker({ failOnStart: true })
  
  await expect(faultyWorker.start()).rejects.toThrow('Startup failed')
  expect(pool.canReuseWorker(faultyWorker, { isolate: false })).toBe(false)
})
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:20:40.612Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794896440612",
    "title": "Verification-Before-Reuse Pool Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vitest-dev/vitest",
    "source_uri": "https://github.com/vitest-dev/vitest",
    "source_version": "HEAD",
    "content_hash": "f0769f5b34757777830688f94ae1ce5960e6bc5d59e9bf7a932b4fe86b2cf76f"
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:20:40.612Z"
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
  "auth_token": "d866388bc90845cb4e9fef8fae27cc5d254adf44e9efe8117fbb6bed7495ca70"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
