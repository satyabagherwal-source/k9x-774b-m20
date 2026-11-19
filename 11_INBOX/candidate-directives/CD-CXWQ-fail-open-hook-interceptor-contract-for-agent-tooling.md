# Candidate Directive: [CD-CXWQ] Fail-Open Hook Interceptor Contract for Agent Tooling

<!-- PROVENANCE_START
{
  "source_repository": "rtk-ai/rtk",
  "source_url": "https://github.com/rtk-ai/rtk",
  "source_version": "5f81080f",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T20:33:56.906Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rtk-ai-rtk",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rtk-ai/rtk](https://github.com/rtk-ai/rtk) (Revision: `5f81080f`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T20:33:56.906Z`  
> **Learning ID**: `learn-github-rtk-ai-rtk`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Any CLI hook or configuration intended to execute as a pre-tool or post-tool execution interceptor in an AI developer agent (Claude Code, GitHub Copilot CLI, Cursor) MUST fail open with exit code `0` and empty `stdout` when the underlying binary is missing, uninstalled, or misconfigured. It MUST NOT exit non-zero (e.g., exit codes `1`, `2`, or `127`).

**WHY**:
Agent frameworks like GitHub Copilot enforce security boundaries on pre-tool execution hooks (`preToolUse`). If a hook script exits non-zero (such as `127 command not found` on a clean cloud runner or exit `2` on a bad flag), the agent engine interprets the return code as a permission denial or safety abort. This denies every subsequent tool execution, completely paralyzing the agent.

**WHEN TO APPLY**:
Apply to all IDE plugins, command rewiring wrappers, git hooks (`pre-commit`), and hook registration configurations (`.github/hooks/`, Claude settings).

**VERIFIED IMPLEMENTATION PATTERN**:
```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      {
        "matcher": "^(?:run_in_terminal|Bash|powershell)$",
        "bash": "command -v rtk >/dev/null 2>&1 && rtk hook copilot || exit 0",
        "powershell": "if (Get-Command rtk -ErrorAction SilentlyContinue) { rtk hook copilot } else { exit 0 }"
      }
    ]
  }
}
```

**NEGATIVE CONSTRAINT**:
```json
// ANTI-PATTERN: Calling the executable directly without existence testing.
// In cloud runner/CI environments where the binary isn't pre-installed,
// this returns exit status 127 and completely disables agent tool calling.
{
  "hooks": {
    "preToolUse": [
      {
        "matcher": ".*",
        "bash": "rtk hook"
      }
    ]
  }
}
```

**VERIFICATION METHOD**:
Execute synthetic execution tests in environments where `PATH` is purged:
```bash
PATH="" sh -c "command -v rtk >/dev/null 2>&1 && rtk hook copilot || exit 0"
# Assert: Exit status == 0, stdout == empty, stderr == empty
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T20:33:56.905Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795120436905",
    "title": "Fail-Open Hook Interceptor Contract for Agent Tooling",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rtk-ai/rtk",
    "source_uri": "https://github.com/rtk-ai/rtk",
    "source_version": "HEAD",
    "content_hash": "d6f6ba131392e0b024a8218dba481122fc5ffb5ab49eba24c4f985198367a3cb"
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
        "Harvested/verified timestamp recorded: 2026-11-19T20:33:56.905Z"
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
  "auth_token": "a3387a3f12d782ff002bc0d97efad7b75f668579ecd65313e314d4296db90438"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
