# Candidate Directive: [CD-3ZGY] Dual-Channel Exit-Status and Pipe-Cap Buffering

<!-- PROVENANCE_START
{
  "source_repository": "vercel-labs/agent-desktop",
  "source_url": "https://github.com/vercel-labs/agent-desktop",
  "source_version": "8ffecc1d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-15T21:44:16.978Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-vercel-labs-agent-desktop",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vercel-labs/agent-desktop](https://github.com/vercel-labs/agent-desktop) (Revision: `8ffecc1d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-15T21:44:16.978Z`  
> **Learning ID**: `learn-github-vercel-labs-agent-desktop`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When capturing command execution output from potentially untrusted or unverified sub-shells/RPC bridges, the consumer **MUST NOT** buffer `stdout`/`stderr` unbounded into memory, and **MUST NOT** execute probe commands without hard consumption caps. Consumers **MUST** decouple the remote status code transmission from the remote data stream using a separate file descriptor pipe (e.g., `FD 3`), while truncating the data stream to an exact byte ceiling (`head -c 65536`) on a separate descriptor (e.g., `FD 4`).

**WHY**:
If a guest or probe command outputs an infinite loop of noise (e.g., `/dev/zero` or a run-away stack trace), capturing stdout directly via shell variable assignment (`output=$(cmd)`) exhausts host memory, triggering the OS OOM killer. Moreover, terminating stdout via `head -c` breaks traditional pipeline status capture (`$?` reflects `head`, losing the process crash code).

**WHEN TO APPLY**:
Subprocess runners, agent probing loops, container telemetry probes, and SSH/RPC host-guest agents.

**VERIFIED IMPLEMENTATION PATTERN**:
```bash
PROBE_REPLY_LIMIT=65536

# Captures status and bounded payload without host memory starvation
guest_probe() {
  {
    reply_status=$(
      {
        {
          probe_status=0
          guest_transport ssh "$@" 2>/dev/null 3>&- 4>&- || probe_status=$?
          printf '%s\n' "$probe_status" >&3
        } | head -c "$PROBE_REPLY_LIMIT" >&4
      } 3>&1
    )
  } 4>&1
  return "${reply_status:-255}"
}
```

**NEGATIVE CONSTRAINT**:
```bash
# FATAL ANTI-PATTERN: Captures unbounded output and loses exit status on truncation
result=$(guest_ssh "cat /var/log/unbounded.log") # Host OOMs if log is > 8GB!

# FLAWED TRUNCATION: Always returns 0 (head's exit status), masking remote failure
result=$(guest_ssh "failing_command" | head -c 65536)
if [ $? -ne 0 ]; then
  # This block is NEVER reached because head exits 0!
  handle_error
fi
```

**VERIFICATION METHOD**:
Test with an integration fake that spews 32MB of `/dev/zero` data while returning an explicit failure status code (e.g., `7`):
```bash
head -c 33554432 /dev/zero | tr '\0' 'x'
# Assert that memory consumption never exceeds 64KiB and probe returns exit status 7.
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T21:44:16.978Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.71,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 71%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794779056978",
    "title": "Dual-Channel Exit-Status and Pipe-Cap Buffering",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vercel-labs/agent-desktop",
    "source_uri": "https://github.com/vercel-labs/agent-desktop",
    "source_version": "HEAD",
    "content_hash": "20a294d184691a6da980764336b84a112328938f8d5e4bb86b12f9219d6c84ba"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.75,
      "tier": "TIER_2_OFFICIAL_ECOSYSTEM",
      "findings": [],
      "details": [
        "Source belongs to recognized official ecosystem (TIER_2_OFFICIAL_ECOSYSTEM)",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-15T21:44:16.978Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "818ac28a1f44030e66acb9b71fcd4118664e473846c85d401bf4dbd08c82f6d2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
