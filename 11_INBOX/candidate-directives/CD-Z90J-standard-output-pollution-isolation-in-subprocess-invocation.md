# Candidate Directive: [CD-Z90J] Standard Output Pollution Isolation in Subprocess Invocation

<!-- PROVENANCE_START
{
  "source_repository": "rollup/rollup",
  "source_url": "https://github.com/rollup/rollup",
  "source_version": "73d63952",
  "license": "NOASSERTION",
  "timestamp": "2026-11-28T08:16:30.307Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rollup-rollup",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rollup/rollup](https://github.com/rollup/rollup) (Revision: `73d63952`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-28T08:16:30.307Z`  
> **Learning ID**: `learn-github-rollup-rollup`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When a CLI tool supports streaming primary output artifacts (e.g., compiled code or JSON ASTs) to `process.stdout`, ANY secondary or child process spawned during execution (such as lifecycle watch hooks, build scripts, or git commands) MUST explicitly redirect child standard output to the parent’s `stderr` or completely decouple `stdout`. Child `stdout` MUST NOT share the parent’s `stdout` file descriptor.

**WHY**:
If a bundler is executed in a Unix pipeline (e.g., `rollup index.js --file - | uglifyjs > bundle.min.js`), piping child execution standard output directly into parent `stdout` intermingles diagnostic messages, compilation logs, and hook command echoes into the functional artifact. This causes parsing syntax errors downstream and invalidates bundle output.

**WHEN TO APPLY**:
Every CLI subsystem that executes user-supplied commands or external binaries while providing an interface that can stream payload data to `stdout`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// cli/run/watchHooks.ts pattern
import { execSync, StdioOptions } from 'node:child_process';
import process from 'node:process';

export function executeSubprocessIsolated(command: string, silent: boolean): void {
  // Enforce redirection:
  // Index 0: stdin  <- parent stdin
  // Index 1: stdout -> parent stderr (PREVENTS PIPELINE CONTAMINATION)
  // Index 2: stderr -> parent stderr
  const stdio: StdioOptions = silent 
    ? 'ignore' 
    : [process.stdin, process.stderr, process.stderr];

  try {
    execSync(command, { stdio });
  } catch (error) {
    // Always write error diagnostics strictly to stderr
    process.stderr.write(`${(error as Error).message}\n`);
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Inheriting default stdio or forwarding stdout to parent stdout
export function badExecuteSubprocess(command: string): void {
  // DEFECT: Using { stdio: 'inherit' } sends child stdout to parent stdout (FD 1),
  // instantly destroying stream integrity if Rollup is streaming to stdout!
  execSync(command, { stdio: 'inherit' });
}
```

**VERIFICATION METHOD**:
Execute an external shell command hook emitting data on `stdout` while bundling code to stdout:
```typescript
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';

const output = execSync('rollup --watch.onEnd "echo HOOK_OUTPUT" --silent', {
  stdio: ['pipe', 'pipe', 'pipe']
});
assert.ok(
  !output.toString().includes('HOOK_OUTPUT'),
  'Secondary hook stdout polluted the primary bundle pipeline!'
);
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T08:16:30.306Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795853790306",
    "title": "Standard Output Pollution Isolation in Subprocess Invocation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rollup/rollup",
    "source_uri": "https://github.com/rollup/rollup",
    "source_version": "HEAD",
    "content_hash": "6120b08c7ecd6a9052ef6d4b01b442894b8843e9e63ffc1ae7e32a51db7aaf57"
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
        "Harvested/verified timestamp recorded: 2026-11-28T08:16:30.306Z"
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
  "auth_token": "03340074d077a5fd479f87727fc6978639a7e2c731501bb706d643262a43f915"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
