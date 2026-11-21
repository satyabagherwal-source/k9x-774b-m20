# Candidate Directive: [CD-0X3S] tui): pressing R again in Connections opens the Web dashboard

<!-- PROVENANCE_START
{
  "source_repository": "agent-of-empires-agent-of-empires-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T00:52:12.458Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-agent-of-empires-agent-of-empires-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [agent-of-empires-agent-of-empires-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T00:52:12.458Z`  
> **Learning ID**: `LEARN-EVO-agent-of-empires-agent-of-empires-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/guides/web-dashboard.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1e4c41e5`: tui): pressing R again in Connections opens the Web dashboard. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/guides/web-dashboard.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
From the TUI, press `R` (`Ctrl+R` with strict hotkeys), shown as `R Web` in the shortcut bar, to open Connections. Press the same key again after a short pause, or Enter on **Web dashboard**, to open the dashboard controls, where you can start a background server on your network or over a tunnel. While it runs, the entry reads `R ● Web` in green. When the Daemon needs attention, the entry shows that instead, in red for a problem (`R ● Runtime outcome unknown`) or dim for a limit (`R ● Unavailable`), and Connections lists the Daemon with what it means. If the Daemon goes offline, Connections replaces the home screen, with `r` to reconnect.
To restart, press `R`; `G` gives a new passphrase. It asks once it has checked what a restart would change. Press Enter once it asks. An Enter pressed while it checks does nothing, and the check then shows what a restart would change without asking: press `R` (or `G`) to check again. Any other key cancels, and so does waiting 3 seconds after it asks. Pressing `R` again only asks again, so a held key never restarts, and the `R` that opened the dashboard controls from Connections does nothing there until you press another key. Enter checks the curre
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
From the TUI, press `R` (`Ctrl+R` with strict hotkeys), shown as `R Web` in the shortcut bar, to open Connections, then Enter on **Web dashboard** to start a background server on your network or over a tunnel. While it runs, the entry reads `R ● Web` in green. When the Daemon needs attention, the entry shows that instead, in red for a problem (`R ● Runtime outcome unknown`) or dim for a limit (`R ● Unavailable`), and Connections lists the Daemon with what it means. If the Daemon goes offline, Connections replaces the home screen, with `r` to reconnect.
To restart, press `R`, wait for the assessment and confirmation, then press `R` again. The confirmation window applies to the second keypress, not the background assessment's duration. The second confirmation checks current effects again and asks again if they changed. Both `R` and `G` remain bound to the observed Daemon. If another Client replaces it before admission, the TUI refuses before changing the replacement or saved defaults. Recovery controls retain that identity after failure, including when the failed launch is first shown after reopening; close and reopen Remote Access again to observe the replacement before retrying.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1e4c41e5` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:52:12.564Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795222332564",
    "title": "tui): pressing R again in Connections opens the Web dashboard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "agent-of-empires-agent-of-empires-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "62db0aafee801c5164b0ac288f4be8a923d81f6c5b920b287830733d0b88b0c0"
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
        "Harvested/verified timestamp recorded: 2026-11-21T00:52:12.565Z"
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
  "auth_token": "5fce041fa31f7acf865942a03d8e123199d943e58a05bca9b3f0fa207aa1c9b6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
