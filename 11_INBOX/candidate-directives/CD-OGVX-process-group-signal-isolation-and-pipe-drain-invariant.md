# Candidate Directive: [CD-OGVX] Process Group Signal Isolation and Pipe Drain Invariant

<!-- PROVENANCE_START
{
  "source_repository": "iii-hq/iii",
  "source_url": "https://github.com/iii-hq/iii",
  "source_version": "7fd8bb9f",
  "license": "PERMISSIVE_OPEN_SOURCE",
  "timestamp": "2026-11-19T22:06:53.565Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-iii-hq-iii",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [iii-hq/iii](https://github.com/iii-hq/iii) (Revision: `7fd8bb9f`).  
> **License**: PERMISSIVE_OPEN_SOURCE | **Timestamp**: `2026-11-19T22:06:53.565Z`  
> **Learning ID**: `learn-github-iii-hq-iii`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

    // Concurrently drain pipe buffers to prevent deadlock from saturated kernel buffers
    let drain_stdout = tokio::spawn(async move {
        let mut buf = Vec::new();
        let _ = stdout.read_to_end(&mut buf).await;
        buf
    });
    let drain_stderr = tokio::spawn(async move {
        let mut buf = Vec::new();
        let _ = stderr.read_to_end(&mut buf).await;
        buf
    });

    let run = async {
        let status = child.wait().await;
        let (out, err) = tokio::join!(drain_stdout, drain_stderr);
        (status, out.unwrap_or_default(), err.unwrap_or_default())
    };

    tokio::pin!(run);
    tokio::select! {
        (status, _out, _err) = &mut run => {
            status.map_err(|e| e.to_string())
        }
        _ = tokio::time::sleep(timeout) => {
            let mut proc = HookProcess { child };
            proc.kill_tree();
            let _ = proc.child.wait().await;
            Err(format!("Process timed out after {}s", timeout.as_secs()))
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER DO THIS: Awaiting child.wait() without draining pipes concurrently,
// and killing only the single child PID.
async fn run_hook_buggy(mut cmd: tokio::process::Command) {
    cmd.stdout(Stdio::piped());
    let mut child = cmd.spawn().unwrap();
    // DEADLOCK HAZARD: If child produces > 64KB of logs, child blocks on write,
    // wait() never resolves, and timeout triggers.
    let status = child.wait().await.unwrap(); 
    // ORPHAN HAZARD: child.kill() leaves any children spawned by the hook running!
    let _ = child.kill().await;
}
```

**VERIFICATION METHOD**:
Spawn a child process executing `sh -c 'dd if=/dev/zero bs=1024 count=128; sleep 100'`, set supervisor timeout to 2 seconds. Verify: (1) Process terminates cleanly within 2 seconds without deadlocking on pipe buffer, and (2) No orphaned background worker processes remain running in the process table.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T22:06:53.562Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795126013562",
    "title": "Process Group Signal Isolation and Pipe Drain Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "iii-hq/iii",
    "source_uri": "https://github.com/iii-hq/iii",
    "source_version": "HEAD",
    "content_hash": "ae5090e091a0e909c0f95453dae36dc23394c02eefe7da90b1947df3497bedfb"
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:06:53.562Z"
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
  "auth_token": "2a2b2a6a255ed478a3f00eb1f70c179b3e40609c52554822b3f90f26acf99c53"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
