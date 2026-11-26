# Candidate Directive: [CD-7O56] proc, gui: background magpie and magpie-bun run in Efficiency Mode on Windows ba

<!-- PROVENANCE_START
{
  "source_repository": "yetone-magpie-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T12:59:38.740Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-yetone-magpie-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yetone-magpie-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T12:59:38.740Z`  
> **Learning ID**: `LEARN-EVO-yetone-magpie-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-26T12:59:38.871Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795697978870",
    "title": "proc, gui: background magpie and magpie-bun run in Efficiency Mode on Windows ba",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yetone-magpie-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c7f994125be423e37c24b0221dc3ed4e73a9c54e7363d037441f20869cd2d05a"
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
        "Harvested/verified timestamp recorded: 2026-11-26T12:59:38.871Z"
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
  "auth_token": "b34e8a4057ee2da8ca45be325a650a078fa07ed3e0912a5a7a3914f94f3a70fe"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
