# Candidate Directive: [CD-DN0X] Fail-Open Hook Interceptor Contract for Agent Tooling

<!-- PROVENANCE_START
{
  "source_repository": "rtk-ai-rtk-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T20:34:29.344Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rtk-ai-rtk-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rtk-ai-rtk-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T20:34:29.344Z`  
> **Learning ID**: `LEARN-EVO-rtk-ai-rtk-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T20:34:29.457Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795120469457",
    "title": "Fail-Open Hook Interceptor Contract for Agent Tooling",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rtk-ai-rtk-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f5356063d0799ee05dcddee54bd374b045fa2215e1ff5812325f136bc9878073"
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
        "Harvested/verified timestamp recorded: 2026-11-19T20:34:29.457Z"
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
  "auth_token": "122b186a174cb7a96465c48fb8ca81084ffbdeb39aaecd263c09fe06ba75f3e7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
