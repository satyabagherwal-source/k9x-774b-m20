# Candidate Directive: [CD-PN0L] Process Group Signal Isolation and Pipe Drain Invariant

<!-- PROVENANCE_START
{
  "source_repository": "iii-hq-iii-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T22:07:48.034Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-iii-hq-iii-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [iii-hq-iii-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T22:07:48.034Z`  
> **Learning ID**: `LEARN-EVO-iii-hq-iii-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When supervising external subprocesses with timeouts or cancellation signals, you MUST spawn the process into a dedicated OS process group (Unix `setpgid`) or Job Object (Windows), simultaneously drain both `stdout` and `stderr` asynchronously using concurrent stream consumers before awaiting process exit, and terminate the entire process group rather than the parent PID alone upon timeout or cancellation.

**WHY**:
Failing to spawn into an isolated process group leaves background child tasks (forked subprocesses, workers, scripts) running as detached orphans upon supervisor termination. Failing to drain `stdout`/`stderr` asynchronously causes the child process to block indefinitely on write once the OS kernel pipe buffer (typically 64KB) saturates, inducing a synthetic deadlock where the process appears hung and hits the supervisor timeout.

**WHEN TO APPLY**:
Any language (Rust, Go, C++, Python, Node.js) building supervisors, task runners, test harnesses, CI/CD agents, container runtimes, or hook executors (`pre_run`/`post_run`).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified pattern from crates/iii-compose/src/hooks.rs
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncReadExt;

pub struct HookProcess {
    child: tokio::process::Child,
}

impl HookProcess {
    pub fn kill_tree(&mut self) {
        #[cfg(unix)]
        if let Some(pid) = self.child.id() {
            // Signal the entire process group (negative PID in POSIX kill)
            unsafe {
                libc::kill(-(pid as libc::pid_t), libc::SIGKILL);
            }
        }
        #[cfg(windows)]
        {
            let _ = self.child.start_kill();
        }
    }
}

pub async fn execute_bounded_hook(
    mut cmd: tokio::process::Command,
    timeout: Duration,
) -> Result<std::process::ExitStatus, String> {
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    
    #[cfg(unix)]
    cmd.process_group(0); // Create a new process group with pgid = pid

    let mut child = cmd.spawn().map_err(|e| format!("Spawn failed: {e}"))?;
    let mut stdout = child.stdout.take().expect("stdout piped");
    let mut stderr = child.stderr.take().expect("stderr piped");

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T22:07:48.161Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795126068160",
    "title": "Process Group Signal Isolation and Pipe Drain Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "iii-hq-iii-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ebf6ddd64dbedf954a58155c85b8f8df828baac16f1c3c4af405214d463c409a"
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:07:48.161Z"
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
  "auth_token": "36e5cc59c332d845fe6d9b4a973111c158f9abe90d1ca3aac87e3cca918dfae2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
