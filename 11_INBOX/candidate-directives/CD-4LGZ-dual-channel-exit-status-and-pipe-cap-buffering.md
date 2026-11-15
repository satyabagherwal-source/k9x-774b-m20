# Candidate Directive: [CD-4LGZ] Dual-Channel Exit-Status and Pipe-Cap Buffering

<!-- PROVENANCE_START
{
  "source_repository": "vercel-labs-agent-desktop-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T21:44:45.402Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-vercel-labs-agent-desktop-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vercel-labs-agent-desktop-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T21:44:45.402Z`  
> **Learning ID**: `LEARN-EVO-vercel-labs-agent-desktop-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T21:44:45.491Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794779085491",
    "title": "Dual-Channel Exit-Status and Pipe-Cap Buffering",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vercel-labs-agent-desktop-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "fab936419c938d56be918ee43cba86ea7bfc71e2b591f8655a84cf6f4aa950d1"
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
        "Harvested/verified timestamp recorded: 2026-11-15T21:44:45.491Z"
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
  "auth_token": "7553bc82d1b6f799a062b267812fe0b38b9bd19f89c7e970bdeab8a552d6d723"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
