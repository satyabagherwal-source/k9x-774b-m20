# Candidate Directive: [CD-28HD] route bare Space to play/pause and stop hidden WebView swallowing ⌘←/

<!-- PROVENANCE_START
{
  "source_repository": "sozercan/kaset",
  "source_url": "https://github.com/sozercan/kaset",
  "source_version": "59e95c8a",
  "license": "MIT",
  "timestamp": "2026-11-28T10:10:48.050Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sozercan-kaset",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sozercan/kaset](https://github.com/sozercan/kaset) (Revision: `59e95c8a`).  
> **License**: MIT | **Timestamp**: `2026-11-28T10:10:48.050Z`  
> **Learning ID**: `learn-github-sozercan-kaset`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Sources/Kaset/KasetApp.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sozercan/kaset. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b987362e`: playback): route bare Space to play/pause and stop hidden WebView swallowing ⌘←/⌘→. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/Kaset/KasetApp.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    @State private var playbackSpaceKeyMonitor = PlaybackSpaceKeyMonitor()

        Window("Kaset", id: MainWindowLayout.sceneIdentifier) {
                    self.playbackSpaceKeyMonitor.start(
                        isPlaybackCommandEnabled: { !self.shouldDisablePlaybackCommand },
                        onPlayPause: { self.performPlayPause() }
                    )
                    self.performPlayPause()
        self.openWindow(id: MainWindowLayout.sceneIdentifier)
    private func performPlayPause() {
        if self.playbackArbiter.routesMediaKeysToVideo {
            self.youtubePlayerService.playPause()
        } else {
            Task {
                await self.playerService.playPause()
            }
        }
    }

```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
        Window("Kaset", id: "main") {
                    if self.playbackArbiter.routesMediaKeysToVideo {
                        self.youtubePlayerService.playPause()
                    } else {
                        Task {
                            await self.playerService.playPause()
                        }
                    }
        self.openWindow(id: "main")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b987362e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T10:10:48.047Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795860648047",
    "title": "route bare Space to play/pause and stop hidden WebView swallowing ⌘←/",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sozercan/kaset",
    "source_uri": "https://github.com/sozercan/kaset",
    "source_version": "HEAD",
    "content_hash": "7cf11533b87c298a4101effa8b4aa048d77c05c862d55b84f063074a68c0577f"
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
        "Harvested/verified timestamp recorded: 2026-11-28T10:10:48.047Z"
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
  "auth_token": "8fce736193fba348b109567417d05573553693a75e14c5ddd820d9c2eb6be2b8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
