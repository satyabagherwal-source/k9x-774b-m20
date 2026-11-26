# Candidate Directive: [CD-4CKV] highball tricks from a CLI built from source finds cabextract: outside any bundl

<!-- PROVENANCE_START
{
  "source_repository": "gauthierpiarrette/highball",
  "source_url": "https://github.com/gauthierpiarrette/highball",
  "source_version": "8d514548",
  "license": "GPL-3.0",
  "timestamp": "2026-11-26T12:29:04.303Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gauthierpiarrette-highball",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gauthierpiarrette/highball](https://github.com/gauthierpiarrette/highball) (Revision: `8d514548`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-26T12:29:04.303Z`  
> **Learning ID**: `learn-github-gauthierpiarrette-highball`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-26T12:29:04.301Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795696144301",
    "title": "highball tricks from a CLI built from source finds cabextract: outside any bundl",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gauthierpiarrette/highball",
    "source_uri": "https://github.com/gauthierpiarrette/highball",
    "source_version": "HEAD",
    "content_hash": "49493d3ef0f70b7ffe95ea0a69d2267bf668c9c55612774b30767300f53ced3f"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-26T12:29:04.301Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "bfc551db3278bdea56be62e63f14d82750ed806ce1fef3c7bba17932c52c7e29"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
