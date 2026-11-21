# Candidate Directive: [CD-EWYA] CI Process Tree Isolation and Handle Decoupling on Windows

<!-- PROVENANCE_START
{
  "source_repository": "tailscale/tailscale",
  "source_url": "https://github.com/tailscale/tailscale",
  "source_version": "1db8e79a",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-21T23:26:47.122Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tailscale-tailscale",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tailscale/tailscale](https://github.com/tailscale/tailscale) (Revision: `1db8e79a`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-21T23:26:47.122Z`  
> **Learning ID**: `learn-github-tailscale-tailscale`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-21T23:26:47.122Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795303607122",
    "title": "CI Process Tree Isolation and Handle Decoupling on Windows",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tailscale/tailscale",
    "source_uri": "https://github.com/tailscale/tailscale",
    "source_version": "HEAD",
    "content_hash": "36f86d27db36d98aae94dfd3cd8020a5a64b2aa7831d5aff47db12354c6b1a23"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T23:26:47.122Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "783d5a2098d7073a9e6468433a6d2ba71bf5f3fc8f0717da878ba3f776092920"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
