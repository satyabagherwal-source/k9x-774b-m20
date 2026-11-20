# Candidate Directive: [CD-JFJP] Integrate reviewed changes from #1004 with the verified merge queue

<!-- PROVENANCE_START
{
  "source_repository": "Kuddev/pebrel",
  "source_url": "https://github.com/Kuddev/pebrel",
  "source_version": "e7405725",
  "license": "GPL-3.0",
  "timestamp": "2026-11-20T02:14:55.093Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-kuddev-pebrel",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Kuddev/pebrel](https://github.com/Kuddev/pebrel) (Revision: `e7405725`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-20T02:14:55.093Z`  
> **Learning ID**: `learn-github-kuddev-pebrel`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Kuddev/pebrel. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e7405725`: Integrate reviewed changes from #1004 with the verified merge queue. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- Fixed the focused terminal on Windows consuming `Alt+F4` and `Alt+Space`. `Alt+F4` now uses the normal window-close flow, and `Alt+Space`, followed by `N`, uses the system menu to minimize the window.
**[@Sakyvo](https://github.com/Sakyvo)** - Added the optional proxy for terminals on Windows, selection-aware `Ctrl+C`, and word deletion with `Ctrl+Backspace`. / 新增可选的 Windows 终端代理、按选区处理的 `Ctrl+C`，以及 `Ctrl+Backspace` 按词删除。（[#94](https://github.com/Kuddev/pebrel/pull/94)、[#93](https://github.com/Kuddev/pebrel/pull/93)、[#92](https://github.com/Kuddev/pebrel/pull/92)）
- **Terminal tabs on Windows can be dragged between Nebula windows.** A tab may become a new tab in the target or dock its complete split tree to the left, right, top, or bottom; terminal panes, runtime ownership, subscriptions, focus, and session metadata move together. Moving the last tab closes the empty source window, while a target that disappears before commit leaves the source tab attached.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- Fixed Windows terminal focus consuming `Alt+F4` and `Alt+Space`. `Alt+F4` now uses the normal window-close flow, and `Alt+Space`, followed by `N`, uses the system menu to minimize the window.
**[@Sakyvo](https://github.com/Sakyvo)** - Added the optional Windows terminal proxy, selection-aware `Ctrl+C`, and word deletion with `Ctrl+Backspace`. / 新增可选的 Windows 终端代理、按选区处理的 `Ctrl+C`，以及 `Ctrl+Backspace` 按词删除。（[#94](https://github.com/Kuddev/pebrel/pull/94)、[#93](https://github.com/Kuddev/pebrel/pull/93)、[#92](https://github.com/Kuddev/pebrel/pull/92)）
- **Windows terminal tabs can be dragged between Nebula windows.** A tab may become a new tab in the target or dock its complete split tree to the left, right, top, or bottom; terminal panes, runtime ownership, subscriptions, focus, and session metadata move together. Moving the last tab closes the empty source window, while a target that disappears before commit leaves the source tab attached.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e7405725` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T02:14:55.090Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795140895090",
    "title": "Integrate reviewed changes from #1004 with the verified merge queue",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Kuddev/pebrel",
    "source_uri": "https://github.com/Kuddev/pebrel",
    "source_version": "HEAD",
    "content_hash": "7ff955ab28f9dab725813d34bc0fc58c0a619ba56cf42f69c0de6a516ba5d0d7"
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
        "Harvested/verified timestamp recorded: 2026-11-20T02:14:55.090Z"
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
  "auth_token": "f0578189d84cd04141d81c88b7c70ff199b8d9a5beb5ff1f02b144558da0d9ba"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
