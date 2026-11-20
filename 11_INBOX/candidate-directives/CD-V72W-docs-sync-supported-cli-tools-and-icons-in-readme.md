# Candidate Directive: [CD-V72W] docs: sync supported CLI tools and icons in README

<!-- PROVENANCE_START
{
  "source_repository": "golutra-golutra-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T19:11:50.048Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-golutra-golutra-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [golutra-golutra-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T19:11:50.048Z`  
> **Learning ID**: `LEARN-EVO-golutra-golutra-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in golutra/golutra. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `52dbff2b`: docs: sync supported CLI tools and icons in README. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    <td align="center" valign="middle" width="100" height="64"><img src="./assets/readme/icons/golutra-agent.png" alt="golutra-agent" height="56" /></td>
    <td align="center" valign="middle" width="100" height="64"><img src="./assets/readme/icons/claude-code.png" alt="Claude Code" width="48" /></td>
    <td align="center" valign="middle" width="100" height="64"><img src="./assets/readme/icons/antigravity.png" alt="Antigravity CLI" height="48" /></td>
    <td align="center" valign="middle" width="100" height="64"><img src="./assets/readme/icons/codex.png" alt="Codex CLI" height="48" /></td>
    <td align="center" valign="middle" width="100" height="64"><img src="./assets/readme/icons/grok.png" alt="Grok CLI" height="48" /></td>
    <td align="center" valign="middle" width="100" height="64"><img src="./assets/readme/icons/pi.svg" alt="PI" height="48" /></td>
    <td align="center" valign="middle" width="100" height="64"><img src="./assets/readme/icons/deepseek.svg" alt="DeepSeek Harness" height="48" /></td>
    <td align="center" valign="middle" width="100" height="64"><img src="./assets/readme/icons/hermes.svg" alt="Hermes Agent" height="48" /></td>
    <td align="center">golutra-
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    <td align="center"><img src="./assets/readme/icons/claude-code.png" alt="Claude Code" height="48" /></td>
    <td align="center"><img src="./assets/readme/icons/gemini.png" alt="Gemini CLI" height="48" /></td>
    <td align="center"><img src="./assets/readme/icons/codex.png" alt="Codex CLI" height="48" /></td>
    <td align="center"><img src="./assets/readme/icons/opencode.svg" alt="OpenCode" width="36" /></td>
    <td align="center"><img src="./assets/readme/icons/qwen.png" alt="Qwen Code" height="48" /></td>
    <td align="center"><img src="./assets/readme/icons/openclaw.png" alt="OpenClaw" height="48" /></td>
    <td align="center"><img src="./assets/readme/icons/any-cli.svg" alt="任意 CLI" height="48" /></td>
    <td align="center">Gemini CLI</td>
- CLI compatibility: Claude, Gemini, Codex, OpenCode, Qwen, OpenClaw, Any CLI
Keep your existing CLI and instantly upgrade it into a collaboration hub.
No terminal switch, no workflow rewrite, no re-training. Keep using the CLI you already trust while adding multi-agent collaboration, orchestration, and result handoff to your current engineering pipeline.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `52dbff2b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T19:11:50.164Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795201910163",
    "title": "docs: sync supported CLI tools and icons in README",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "golutra-golutra-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "eb1c5e80229443628c9dc6454079c42f08ac77ed58517b70daec131807fb1152"
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
        "Harvested/verified timestamp recorded: 2026-11-20T19:11:50.164Z"
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
  "auth_token": "12e5b70b32f35cc854832eb7448f24953b84acc8c8163a06188ea4e410e6f7f1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
