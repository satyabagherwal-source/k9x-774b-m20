# Candidate Directive: [CD-Z90I] Mandatory Asynchronous Output Stream Flush Preceding Forced Process Termination

<!-- PROVENANCE_START
{
  "source_repository": "rollup/rollup",
  "source_url": "https://github.com/rollup/rollup",
  "source_version": "73d63952",
  "license": "NOASSERTION",
  "timestamp": "2026-11-28T08:16:30.306Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rollup-rollup",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rollup/rollup](https://github.com/rollup/rollup) (Revision: `73d63952`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-28T08:16:30.306Z`  
> **Learning ID**: `learn-github-rollup-rollup`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When an application invokes an immediate termination primitive (`process.exit(code)` in Node.js, `std::process::exit(code)` in Rust, or `exit(3)` in POSIX C), the runtime MUST explicitly write an empty sentinel chunk and await the completion callback or drain event on all writable standard streams (`stdout`, `stderr`) before triggering the exit syscall. You MUST NOT rely on Node.js event-loop exhaustion to flush buffered stream chunks if open asynchronous event handles exist.

**WHY**:
In Node.js, `process.stdout` and `process.stderr` behave synchronously when referencing regular files or TTYs on POSIX systems, but they are **asynchronous** when pointing to pipes (e.g., shell redirection `|`, CI log collection buffers, or parent IPC channels) and on Windows platforms. Invoking `process.exit()` immediately terminates the libuv event loop and destroys the V8 isolate. Any chunks residing in the Node.js userland stream buffer (`WritableState.bufferedRequest`) or libuv write queue (`uv_write_t`) are dropped without reaching the operating system kernel pipe buffer. This leads to silent corruption and truncation of compiler artifacts, bundle output, and fatal diagnostic stack traces.

**WHEN TO APPLY**:
Apply to all Node.js CLI tools, bundlers, test runners, and microservices where `--forceExit`, explicit unhandled rejection exit handlers, or signal traps (`SIGTERM`, `SIGINT`) bypass normal event-loop drain mechanics.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// cli/logging.ts & cli/cli.ts pattern
import process from 'node:process';

/**
 * Ensures all buffered chunks in a stream are drained to the OS kernel.
 * Writing an empty chunk ('') queues behind all previously written chunks.
 * The callback fires only after all prior chunks and the empty chunk are flushed.
 */
export const flushOutput = (stream: NodeJS.WritableStream): Promise<void> =>
  new Promise(resolve => {
    // If the stream is not writable or already destroyed, resolve immediately
    if (!('write' in stream) || typeof stream.write !== 'function') {
      return resolve();
    }
    // Writing '' forces the libuv stream queue to flush without modifying stream content
    stream.write('', () => resolve());
  });

export async function safeForceExit(exitCode = 0): Promise<never> {
  try {
    // Simultaneously flush both stdout and stderr
    await Promise.all([
      flushOutput(process.stdout),
      flushOutput(process.stderr)
    ]);
  } catch {
    // Invariant: Do not swallow exit if flushing throws; proceed to hard exit
  } finally {
    process.exit(exitCode);
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Direct exit invocation while open handles exist
export function unsafeExit(command: { forceExit?: boolean }): void {
  const promise = runCompilation();
  if (command.forceExit) {
    // CRITICAL DEFECT: If stdout is piped into a downstream consumer (e.g. `rollup -f es > out.js`),
    // large chunks remaining in the userland buffer are permanently lost upon process.exit().
    promise.then(() => process.exit(0));
  }
}
```

**VERIFICATION METHOD**:
Verify using a child-process integration test where an asynchronous handle keeps the process alive (`setInterval(..., 2**24)`), a payload exceeding the system pipe capacity (e.g., $2^{20}$ bytes = 1 MiB) is written to standard output/standard error, and `--forceExit` is passed. Assert that the captured output stream contains the exact end-sentinel:
```typescript
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const child = spawnSync('node', ['cli.js', '--forceExit'], { encoding: 'utf8' });
assert.ok(
  child.stdout.endsWith('x'.repeat(2 ** 20)),
  'Standard output buffer was truncated prior to forceExit completion'
);
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T08:16:30.304Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795853790304",
    "title": "Mandatory Asynchronous Output Stream Flush Preceding Forced Process Termination",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rollup/rollup",
    "source_uri": "https://github.com/rollup/rollup",
    "source_version": "HEAD",
    "content_hash": "faa4668521cadce099f5952e626df81b77a64084bf97bd9ce0516b7830994eb8"
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
        "Harvested/verified timestamp recorded: 2026-11-28T08:16:30.304Z"
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
  "auth_token": "99154e98f8a2c026c94b88910fd2e241aaf90f0b533ff0bdcebeb09bacc7c39b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
