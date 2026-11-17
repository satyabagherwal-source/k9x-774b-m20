# Candidate Directive: [CD-9CJ9] Invariant Isolation of Upstream Runtime Flags across Worker Thread Spawns

<!-- PROVENANCE_START
{
  "source_repository": "avajs-ava-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:19:58.675Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-avajs-ava-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [avajs-ava-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:19:58.675Z`  
> **Learning ID**: `LEARN-EVO-avajs-ava-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When spawning worker threads (`node:worker_threads.Worker`) from a parent Node.js process, you MUST NOT blindly forward the host's `process.execArgv` to `options.execArgv` without scrubbing process-only flags. Process-level configuration flags that are rejected by worker threads (such as `--title`, `--max-old-space-size`, `--expose-internals`, `--prof`, `--allow-natives-syntax`) MUST either be explicitly filtered or omitted entirely. Furthermore, when an exec-argument validation error occurs at thread initialization, the scheduler MUST fail fast on the first error rather than spamming identical errors across the concurrency queue.

**WHY**:
Node.js throws `ERR_WORKER_INVALID_EXEC_ARGV` when a worker thread is passed CLI arguments that belong exclusively to the main process runtime. In concurrent multi-worker architectures, prepending `process.execArgv` to child workers causes every spawned thread to fail simultaneously. If the scheduler processes files with concurrency $N$, it emits $N$ duplicate, un-actionable, massive stack traces pointing into framework orchestration code rather than user code, while keeping dangling worker handles in memory.

**WHEN TO APPLY**:
- In any Node.js system orchestrating `worker_threads` (test runners, build tools, background job workers).
- When exposing configurable CLI execution arguments (`--node-arguments`, `--max-old-space-size`) that bridge CLI interfaces and thread workers.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// lib/node-arguments.js & lib/api.js (Pattern extracted from AVA v8.4.0)
import process from 'node:process';
import arrgv from 'arrgv';

export function normalizeNodeArguments(fromConf = [], fromArgv = '', shouldForwardProcessExecArgv = true) {
  let parsedArgv = [];
  if (fromArgv !== '') {
    try {
      parsedArgv = arrgv(fromArgv);
    } catch {}
  }

  // Prepending process.execArgv must be gate-kept by explicit configuration
  const baseArguments = shouldForwardProcessExecArgv ? process.execArgv : [];
  return [...baseArguments, ...fromConf, ...parsedArgv];
}

// In the scheduler/spawner:
export async function scheduleWorkerPool(selectedFiles, options, concurrency, forkFn) {
  let invalidExecArgvError;

  await pMap(selectedFiles, async file => {
    // Fail-fast guard: immediately stop scheduling once an invalid exec argument crashes a worker
    if (invalidExecArgvError) {
      return;
    }

    let worker;
    try {
      worker = forkFn(file, options);
    } catch (error) {
      if (error.code === 'ERR_WORKER_INVALID_EXEC_ARGV') {
        // Idempotent assignment: trap only the first error to avoid cascading diagnostics
        invalidExecArgvError ??= error;
        return;
      }
      throw error;

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:19:58.770Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794903598770",
    "title": "Invariant Isolation of Upstream Runtime Flags across Worker Thread Spawns",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "avajs-ava-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "0af4549867c6efa54f4377ec0dc4bae853c5d302964c98f793d589f02c15a085"
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
        "Expresses generalized engineering invariants (6 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:19:58.770Z"
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
  "auth_token": "95411263e3ad0344f23fcc0d186fa35e79454def5c3d535454e0d8ab6d0b6a95"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
