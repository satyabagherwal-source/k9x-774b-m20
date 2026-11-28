# Candidate Directive: [CD-0MED] Standard Output Pollution Isolation in Subprocess Invocation

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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T08:17:34.309Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795853854309",
    "title": "Standard Output Pollution Isolation in Subprocess Invocation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rollup-rollup-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c22dc3aed09a42750687a664b9b7609fa1fb3aaa95c8a43daca824792b93a839"
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
        "Harvested/verified timestamp recorded: 2026-11-28T08:17:34.309Z"
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
  "auth_token": "4216440c42fac9e3327294fe91dc5cfa94c6f8cfa2ed4e638c3216e77943e6aa"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
