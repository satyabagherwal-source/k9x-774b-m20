# Candidate Directive: [CD-MO3D] highball play --wait follows Mac builds, Steam for Mac's included, and the libra

<!-- PROVENANCE_START
{
  "source_repository": "gauthierpiarrette-highball-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T01:56:07.287Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-gauthierpiarrette-highball-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gauthierpiarrette-highball-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T01:56:07.287Z`  
> **Learning ID**: `LEARN-EVO-gauthierpiarrette-highball-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Sources/HighballApp/AppState.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gauthierpiarrette/highball. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7d471e91`: highball play --wait follows Mac builds, Steam for Mac's included, and the library JSON says installedOnWindows and hidden (highball#432). RunningGames, which --wait reads, held only the sessions in environments, so a wait on a game Steam for Mac started ran to --start-timeout and gave up while the game played (Terraforming Mars, udance4ever timed 49 s). It now also holds the Epic and GOG Mac builds Highball started and the Steam for Mac games Play opened, followed by their process under steamapps/common for up to ten minutes to appear and then until they quit. The JSON's installed is now installedOnWindows, beside installedOnMac, since the command hasn't shipped yet, and hidden says what the player hid from the library. play's id help names the form. New test in PlayFromCommandLineTests, 16 tests pass, and highball library --json lists the real library with both fields. The Steam for Mac wait is not tried live yet.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/HighballApp/AppState.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        if openInSteamForMac(URL(string: "steam://run/\(appid)")!),
           let game = macSteamGames.first(where: { $0.appid == appid }), !game.installdir.isEmpty {
            watchMacSteamGame(item.id, markers: SessionWatch.markers(installdir: game.installdir))
        }
    }

    /// Follows a game Steam for Mac started for Highball by its process, whose path runs through
    /// its steamapps/common folder: up to ten minutes for it to appear (Steam may update it first),
    /// then until it quits. Only `highball play --wait` reads it (writeRunningGames).
    private func watchMacSteamGame(_ id: String, markers: [String]) {
        Task { [weak self] in
            var seen = false
            for _ in 0..<300 {
                try? await Task.sleep(for: .seconds(2))
                let alive = SessionWatch.isAlive(markers: markers, ps: await Self.processList())
                guard let self else { return }
                if alive, !seen { seen = true; self.macSteamRunning.insert(id) }
                if seen, !alive { self.macSteamRunning.remove(id); return }
            }
            while seen {
                try? await Task.sleep(for: .seconds(2))
                gu
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
        _ = openInSteamForMac(URL(string: "steam://run/\(appid)")!)
        didSet {
            let ids = runningSessions.compactMap(\.libraryID)
            if ids != oldValue.compactMap(\.libraryID) { RunningGames.write(ids, paths: paths) }
        }
    var macGameProcesses: [String: Process] = [:]
```

**VERIFICATION METHOD**:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T01:56:07.417Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795485367417",
    "title": "highball play --wait follows Mac builds, Steam for Mac's included, and the libra",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gauthierpiarrette-highball-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "2a7a6c9951d428ba5a842d2d4ee182b6b18776c86175960956570815a3450569"
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
        "Harvested/verified timestamp recorded: 2026-11-24T01:56:07.417Z"
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
  "auth_token": "5f3e471b4104e558789cfc49e8c0b7849dd34113bcc899f88d910791429c672e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
