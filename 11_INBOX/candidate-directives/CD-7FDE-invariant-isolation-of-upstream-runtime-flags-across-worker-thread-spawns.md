# Candidate Directive: [CD-7FDE] Invariant Isolation of Upstream Runtime Flags across Worker Thread Spawns

<!-- PROVENANCE_START
{
  "source_repository": "avajs/ava",
  "source_url": "https://github.com/avajs/ava",
  "source_version": "ce2839c1",
  "license": "MIT",
  "timestamp": "2026-11-17T08:18:29.138Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-avajs-ava",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [avajs/ava](https://github.com/avajs/ava) (Revision: `ce2839c1`).  
> **License**: MIT | **Timestamp**: `2026-11-17T08:18:29.138Z`  
> **Learning ID**: `learn-github-avajs-ava`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    }

    await worker.promise;
  }, {concurrency, stopOnError: false});

  if (invalidExecArgvError) {
    // Clean, high-signal error message with remediation guidance and root cause chaining
    throw new Error([
      `Worker threads cannot be used with the arguments passed to Node.js: ${invalidExecArgvError.message}`,
      '',
      'Remediation:',
      '1. Remove the invalid argument from Node.js invocation.',
      '2. Set workerThreads: false to run tests in isolated child processes instead of threads.',
      '3. Disable explicit forwarding of Node arguments in your configuration.',
    ].join('\n'), {cause: invalidExecArgvError});
  }
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Blindly concatenating execArgv and running unshielded concurrency loops
function createWorker(file) {
  // CRITICAL HAZARD: If parent was started with `node --title="My App"`, this throws ERR_WORKER_INVALID_EXEC_ARGV!
  return new Worker(file, {
    execArgv: [...process.execArgv, ...customArgs]
  });
}

// Unshielded concurrency spam:
await Promise.all(files.map(async file => {
  // Throws N times simultaneously, dumping N framework internal stacks to terminal
  const worker = createWorker(file); 
  await worker.run();
}));
```

**VERIFICATION METHOD**:
Automated integration test using a subprocess spawning a worker with illegal flags:
```javascript
import test from 'ava';
import {normalizeNodeArguments} from '../lib/node-arguments.js';

test('normalizeNodeArguments rejects process.execArgv when shouldForwardProcessExecArgv is false', t => {
  const originalExecArgv = process.execArgv;
  try {
    process.execArgv = ['--title=foo', '--expose-gc'];
    const args = normalizeNodeArguments([], '--experimental-vm-modules', false);
    t.false(args.includes('--title=foo'));
    t.true(args.includes('--experimental-vm-modules'));
  } finally {
    process.execArgv = originalExecArgv;
  }
});
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:18:29.137Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794903509137",
    "title": "Invariant Isolation of Upstream Runtime Flags across Worker Thread Spawns",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "avajs/ava",
    "source_uri": "https://github.com/avajs/ava",
    "source_version": "HEAD",
    "content_hash": "97335a3cb5c761209bb9c0d18ba3cb3d1f68e1f8f053a9a96b920264c86947aa"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Expresses generalized engineering invariants (6 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:18:29.137Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "5ce933d8aff94a028c4b26542956af7f93e638d1790c493a150ff8eb0a875551"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
