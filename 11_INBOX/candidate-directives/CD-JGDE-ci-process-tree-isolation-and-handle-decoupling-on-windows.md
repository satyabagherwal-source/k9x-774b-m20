# Candidate Directive: [CD-JGDE] CI Process Tree Isolation and Handle Decoupling on Windows

<!-- PROVENANCE_START
{
  "source_repository": "tailscale-tailscale-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T23:30:18.794Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tailscale-tailscale-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tailscale-tailscale-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T23:30:18.794Z`  
> **Learning ID**: `LEARN-EVO-tailscale-tailscale-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**: Long-running background processes spawned during CI pipeline steps on Windows runners MUST NOT inherit the caller step’s standard input/output/error pipes, and their lifetime MUST be verified across explicit step boundaries via out-of-band sentinel files or PID monitors.  
**WHY**: On Windows runner agents (e.g., GitHub Actions Runner), child processes spawned with inherited stdout/stderr file handles hold open the parent step’s IPC pipe. When the execution step completes, the runner halts and hangs indefinitely waiting for EOF on the output pipe, or the runner process reaper forcibly terminates the entire process tree, killing essential background daemons (such as remote FUSE/WinFsp filesystem drivers or cache proxies).  
**WHEN TO APPLY**: Background daemons, emulators, local cache mounts, and mock services initiated in Windows CI/CD workflows.  
**VERIFIED IMPLEMENTATION PATTERN**:
```powershell
# Invariant: Execute via ComSpec without inherited pipes, redirecting streams to disk
$log = Join-Path $env:RUNNER_TEMP 'daemon.log'
$cmdArgs = "/d /s /c `"`"$exe`" --daemon-flag > `"$log`" 2>&1`""
$p = Start-Process -PassThru -WindowStyle Hidden -FilePath $env:ComSpec -ArgumentList $cmdArgs

# Explicit readiness barrier with non-blocking deadline
$deadline = (Get-Date).AddSeconds(30)
while (-not (Test-Path "$env:TARGET_MOUNT\.sentinel-status")) {
    if ($p.HasExited -or (Get-Date) -gt $deadline) {
        Get-Content -LiteralPath $log -Tail 50 -ErrorAction SilentlyContinue
        throw "Background daemon terminated prematurely or failed readiness probe"
    }
    Start-Sleep -Milliseconds 100
}
```
**NEGATIVE CONSTRAINT**:
```powershell
# ANTI-PATTERN: Direct invocation or inheriting standard pipes in CI step.
# Causes the runner to hang waiting for EOF, or runner kills process upon step exit.
Start-Process -FilePath "C:\bin\daemon.exe" -ArgumentList "--serve" -NoNewWindow
# or
& "C:\bin\daemon.exe" --serve &
```
**VERIFICATION METHOD**: Add a trailing verification step configured with `if: always()` in CI:
```yaml
- name: Verify Daemon Survival
  if: always()
  shell: pwsh
  run: |
    $p = Get-Process mydaemon -ErrorAction SilentlyContinue
    if (-not $p) {
      Write-Error "Daemon died unexpectedly before step completed"
      exit 1
    }
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T23:30:18.887Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795303818887",
    "title": "CI Process Tree Isolation and Handle Decoupling on Windows",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tailscale-tailscale-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "36f86d27db36d98aae94dfd3cd8020a5a64b2aa7831d5aff47db12354c6b1a23"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T23:30:18.887Z"
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
  "auth_token": "085eb3178b6d53bc8a8a2dc6971ff919875ebea0ca8d7caf3130bdc92ac241bf"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
