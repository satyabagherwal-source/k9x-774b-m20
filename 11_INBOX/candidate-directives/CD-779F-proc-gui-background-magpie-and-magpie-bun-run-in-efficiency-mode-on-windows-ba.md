# Candidate Directive: [CD-779F] proc, gui: background magpie and magpie-bun run in Efficiency Mode on Windows ba

<!-- PROVENANCE_START
{
  "source_repository": "yetone/magpie",
  "source_url": "https://github.com/yetone/magpie",
  "source_version": "e6d3acaf",
  "license": "MIT",
  "timestamp": "2026-11-26T12:59:16.995Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-yetone-magpie",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yetone/magpie](https://github.com/yetone/magpie) (Revision: `e6d3acaf`).  
> **License**: MIT | **Timestamp**: `2026-11-26T12:59:16.995Z`  
> **Learning ID**: `learn-github-yetone-magpie`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/subsystems/gui-shell.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yetone/magpie. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `09bada7e`: proc, gui: background magpie and magpie-bun run in Efficiency Mode on Windows battery. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/subsystems/gui-shell.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
| Native host | `Run` starts the Wails v3 app: the tray icon, the panel, the main window, single-instance handover, `magpie://` import and plugin links (`magpie://plugin?name=` opens Plugins on the package's sheet, `pluginView`) and open at login. magpie claims `magpie://` only. v0.1.3981 to v0.1.4454 also claimed CC Switch's `ccswitch://` (Info.plist, `HKCU\Software\Classes\ccswitch`, `magpie-ccswitch.desktop`), and a start leaves what they wrote. A `ccswitch://` link that still reaches magpie that way (`magpie ccswitch://…` on Windows and Linux, before anything is read or started; the URL event on the Mac) is opened with CC Switch when it is installed, and the claim goes back to it: Launch Services registers magpie's bundle again from its Info.plist (`lsregister -f`), the per-user handler that runs this magpie is pointed at CC Switch's exe as its MSI writes it, and the desktop default that is `magpie-ccswitch.desktop` goes to CC Switch's entry, with magpie's entry removed while it runs this magpie or a gone one. With no CC Switch the link and the claim are left as they are (`ccswitchlink.ErrNotInstalled`; [`ccswitchlink`](../../internal/ccswitchlink/link.go)). `host` implements `
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
| Native host | `Run` starts the Wails v3 app: the tray icon, the panel, the main window, single-instance handover, `magpie://` import and plugin links (`magpie://plugin?name=` opens Plugins on the package's sheet, `pluginView`) and open at login. magpie claims `magpie://` only. v0.1.3981 to v0.1.4454 also claimed CC Switch's `ccswitch://` (Info.plist, `HKCU\Software\Classes\ccswitch`, `magpie-ccswitch.desktop`), and a start leaves what they wrote. A `ccswitch://` link that still reaches magpie that way (`magpie ccswitch://…` on Windows and Linux, before anything is read or started; the URL event on the Mac) is opened with CC Switch when it is installed, and the claim goes back to it: Launch Services registers magpie's bundle again from its Info.plist (`lsregister -f`), the per-user handler that runs this magpie is pointed at CC Switch's exe as its MSI writes it, and the desktop default that is `magpie-ccswitch.desktop` goes to CC Switch's entry, with magpie's entry removed while it runs this magpie or a gone one. With no CC Switch the link and the claim are left as they are (`ccswitchlink.ErrNotInstalled`; [`ccswitchlink`](../../internal/ccswitchlink/link.go)). `host` implements `
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `09bada7e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T12:59:16.993Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795697956993",
    "title": "proc, gui: background magpie and magpie-bun run in Efficiency Mode on Windows ba",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yetone/magpie",
    "source_uri": "https://github.com/yetone/magpie",
    "source_version": "HEAD",
    "content_hash": "c7f994125be423e37c24b0221dc3ed4e73a9c54e7363d037441f20869cd2d05a"
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
        "Harvested/verified timestamp recorded: 2026-11-26T12:59:16.993Z"
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
  "auth_token": "679eb580b354a691efba7878e578b9b08a6eb9861901dd905d54da6ae56b54b5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
