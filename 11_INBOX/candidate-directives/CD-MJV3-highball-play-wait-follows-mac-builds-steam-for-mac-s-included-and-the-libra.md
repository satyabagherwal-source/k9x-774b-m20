# Candidate Directive: [CD-MJV3] highball play --wait follows Mac builds, Steam for Mac's included, and the libra

<!-- PROVENANCE_START
{
  "source_repository": "gauthierpiarrette/highball",
  "source_url": "https://github.com/gauthierpiarrette/highball",
  "source_version": "062ea35b",
  "license": "GPL-3.0",
  "timestamp": "2026-11-24T01:56:01.935Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gauthierpiarrette-highball",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gauthierpiarrette/highball](https://github.com/gauthierpiarrette/highball) (Revision: `062ea35b`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-24T01:56:01.935Z`  
> **Learning ID**: `learn-github-gauthierpiarrette-highball`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
Automated regression test asserting that input states reproducing defect `7d471e91` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T01:56:01.933Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795485361933",
    "title": "highball play --wait follows Mac builds, Steam for Mac's included, and the libra",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gauthierpiarrette/highball",
    "source_uri": "https://github.com/gauthierpiarrette/highball",
    "source_version": "HEAD",
    "content_hash": "ab604195f14a2f3add96f5553d66939c8ddcfc0f314f896d653f85308da2f162"
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
        "Harvested/verified timestamp recorded: 2026-11-24T01:56:01.933Z"
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
  "auth_token": "9e5c55df02c9a137f1cd9d2850be4af5ba66fb4b540eb2c6efc2016dc4740b08"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
