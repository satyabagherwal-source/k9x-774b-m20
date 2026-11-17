# Candidate Directive: [CD-008V] Verification-Before-Reuse Pool Invariant

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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:20:44.474Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794896444474",
    "title": "Verification-Before-Reuse Pool Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vitest-dev-vitest-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e8b5733880f9946210fe6322ae0df5de482dfa0d9752eef7a97972b59d4ae44d"
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:20:44.475Z"
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
  "auth_token": "7235ff892248212a763cf0d439df28a3977cb72a7e12fdcdcfda79a3496649a4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
