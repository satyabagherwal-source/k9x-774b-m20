# Candidate Directive: [CD-4KPL] highball tricks from a CLI built from source finds cabextract: outside any bundl

<!-- PROVENANCE_START
{
  "source_repository": "gauthierpiarrette-highball-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T12:29:14.718Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-gauthierpiarrette-highball-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gauthierpiarrette-highball-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T12:29:14.718Z`  
> **Learning ID**: `LEARN-EVO-gauthierpiarrette-highball-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Sources/HighballKit/WinetricksWine.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gauthierpiarrette/highball. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `41318aa8`: highball tricks from a CLI built from source finds cabextract: outside any bundle and without HIGHBALL_TOOLS it borrows the installed Highball.app's tools folder (/Applications or ~/Applications). Before, it put no tools folder on winetricks' PATH, so every verb that needs cabextract failed there (highball-db#941, udance4ever).. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/HighballKit/WinetricksWine.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    /// Where an installed Highball keeps its tools, for a CLI that is not inside the app.
    public static let installedAppTools: [URL] = [URL(fileURLWithPath: "/Applications"),
                                                  FileManager.default.homeDirectoryForCurrentUser.appending(path: "Applications")]
        .map { $0.appending(path: "Highball.app/Contents/Resources/tools", directoryHint: .isDirectory) }

    /// and failed every verb that needs cabextract (db#941). A CLI built from source is in no
    /// bundle, so without HIGHBALL_TOOLS it borrows the installed app's folder (db#941 again).
    public static func pathWithTools(_ path: String?, installedApps: [URL] = installedAppTools) -> String? {
        var tools = [ProcessInfo.processInfo.environment["HIGHBALL_TOOLS"].map { URL(fileURLWithPath: $0) },
        if tools.isEmpty, let app = installedApps.first(where: { FileManager.default.fileExists(atPath: $0.path) }) { tools = [app] }
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
    /// and failed every verb that needs cabextract (db#941).
    public static func pathWithTools(_ path: String?) -> String? {
        let tools = [ProcessInfo.processInfo.environment["HIGHBALL_TOOLS"].map { URL(fileURLWithPath: $0) },
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `41318aa8` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T12:29:14.840Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795696154840",
    "title": "highball tricks from a CLI built from source finds cabextract: outside any bundl",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gauthierpiarrette-highball-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "49493d3ef0f70b7ffe95ea0a69d2267bf668c9c55612774b30767300f53ced3f"
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
        "Harvested/verified timestamp recorded: 2026-11-26T12:29:14.840Z"
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
  "auth_token": "35ac3fdcf67f43154de1fe69cf01c80f07d0542dd6db84e9dcd42bd9cdde44f4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
