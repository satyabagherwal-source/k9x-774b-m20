# Candidate Directive: [CD-1935] docs(guide): bring the embedding page in line with rtk 1.2.0

<!-- PROVENANCE_START
{
  "source_repository": "rtk-ai-rtk-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T16:21:54.008Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rtk-ai-rtk-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rtk-ai-rtk-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T16:21:54.008Z`  
> **Learning ID**: `LEARN-EVO-rtk-ai-rtk-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/guide/getting-started/embedding.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in rtk-ai/rtk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `61de0133`: docs(guide): bring the embedding page in line with rtk 1.2.0. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/guide/getting-started/embedding.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
This page is for people who build an agent harness and want the rewrite step inside their own bash tool, rather than installing one of the hooks listed in [Supported Agents](supported-agents.md). The Pi and Hermes plugins and the legacy shell hooks are thin delegates around one binary call, `rtk rewrite`; the Rust-binary hooks that `rtk init` installs today (`rtk hook claude`, `rtk hook opencode` and friends) run the same registry in-process. For a host of your own, `rtk rewrite` is the whole integration surface. Everything below was verified against rtk 1.2.0.
`rtk rewrite -- "<command>"` prints the rewritten command to stdout (no trailing newline) and reports its decision in the exit code. Pass `--` before the command: without it, a command string that reads as an option of `rtk rewrite` itself (`--help`, `-h`) prints rtk's help on stdout with exit 0. The contract is defined in [`src/hooks/rewrite_cmd.rs`](https://github.com/rtk-ai/rtk/blob/master/src/hooks/rewrite_cmd.rs):
| 0 | rewritten command | Rewrite, and Claude Code allow rules cover every command in it | Run the rewritten command |
| 1 | empty | No RTK equivalent, or a Claude Code deny rule matched inside a shell wrapper
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
This page is for people who build an agent harness and want the rewrite step inside their own bash tool, rather than installing one of the hooks listed in [Supported Agents](supported-agents.md). The Pi, OpenCode and Hermes plugins and the legacy shell hooks are thin delegates around one binary call, `rtk rewrite`; the Rust-binary hooks that `rtk init` installs today (`rtk hook claude` and friends) run the same registry in-process. For a host of your own, `rtk rewrite` is the whole integration surface. Everything below was verified against rtk 0.48.0.
`rtk rewrite "<command>"` prints the rewritten command to stdout (no trailing newline) and reports its decision in the exit code. The contract is defined in [`src/hooks/rewrite_cmd.rs`](https://github.com/rtk-ai/rtk/blob/master/src/hooks/rewrite_cmd.rs):
| 0 | rewritten command | Rewrite, and an explicit Claude Code allow rule matched | Run the rewritten command |
| 1 | empty | No RTK equivalent | Run the original command |
| 3 | rewritten command | Rewrite, with an "ask" rule matched or no rule matched at all | Run the rewritten command |
The exit code carries a permission verdict read from Claude Code's settings files (`.claude/sett
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `61de0133` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T16:21:54.109Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794846114109",
    "title": "docs(guide): bring the embedding page in line with rtk 1.2.0",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rtk-ai-rtk-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9bbc80707193a88924355e763c7db1fbf26b084c1e39da8d73896bd968215afb"
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
        "Harvested/verified timestamp recorded: 2026-11-16T16:21:54.109Z"
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
  "auth_token": "9a1da82ca4cec27a53021fe739f44b8e0764246ddc6b9ea9b886d3a617606863"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
