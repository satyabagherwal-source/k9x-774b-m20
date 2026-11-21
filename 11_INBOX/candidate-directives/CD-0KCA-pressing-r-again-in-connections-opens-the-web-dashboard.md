# Candidate Directive: [CD-0KCA] pressing R again in Connections opens the Web dashboard

<!-- PROVENANCE_START
{
  "source_repository": "agent-of-empires/agent-of-empires",
  "source_url": "https://github.com/agent-of-empires/agent-of-empires",
  "source_version": "08946a21",
  "license": "MIT",
  "timestamp": "2026-11-21T00:51:56.026Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-agent-of-empires-agent-of-empires",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires) (Revision: `08946a21`).  
> **License**: MIT | **Timestamp**: `2026-11-21T00:51:56.026Z`  
> **Learning ID**: `learn-github-agent-of-empires-agent-of-empires`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-21T00:51:56.024Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795222316024",
    "title": "pressing R again in Connections opens the Web dashboard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "agent-of-empires/agent-of-empires",
    "source_uri": "https://github.com/agent-of-empires/agent-of-empires",
    "source_version": "HEAD",
    "content_hash": "500b2e37ec5a5c298da9bc3d30ffc92de0a965af0fb1c21661a3179ab4e56819"
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
        "Harvested/verified timestamp recorded: 2026-11-21T00:51:56.024Z"
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
  "auth_token": "9730e7b052e955b129f39813c391f1c4a0846b9e67580ca4675c7ed01e9c1402"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
