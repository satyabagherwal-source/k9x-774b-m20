# Candidate Directive: [CD-0MED] Mandatory Asynchronous Output Stream Flush Preceding Forced Process Termination

<!-- PROVENANCE_START
{
  "source_repository": "rollup-rollup-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T08:17:34.182Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rollup-rollup-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rollup-rollup-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T08:17:34.182Z`  
> **Learning ID**: `LEARN-EVO-rollup-rollup-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T08:17:34.305Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795853854305",
    "title": "Mandatory Asynchronous Output Stream Flush Preceding Forced Process Termination",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rollup-rollup-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "fd7a7e4eaf2dfce9050002ab4e5220794dcabdaf04f9adc743a0d4759139746c"
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
        "Harvested/verified timestamp recorded: 2026-11-28T08:17:34.306Z"
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
  "auth_token": "3ca6ce6110ed6b5020cb836ed6febe147af7611469b5ff6a41c0a835b81b1e79"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
