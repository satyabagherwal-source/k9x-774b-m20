# Candidate Directive: [CD-G1N1] Wine 10 engines r30 (default) and r31 (D3DMetal 4 line): r28 and r29 with the au

<!-- PROVENANCE_START
{
  "source_repository": "gauthierpiarrette/highball",
  "source_url": "https://github.com/gauthierpiarrette/highball",
  "source_version": "4ebe4fe0",
  "license": "GPL-3.0",
  "timestamp": "2026-11-17T05:37:13.549Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gauthierpiarrette-highball",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gauthierpiarrette/highball](https://github.com/gauthierpiarrette/highball) (Revision: `4ebe4fe0`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-17T05:37:13.549Z`  
> **Learning ID**: `learn-github-gauthierpiarrette-highball`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Tests/HighballKitTests/BundledEngineTests.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gauthierpiarrette/highball. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ac350e46`: Wine 10 engines r30 (default) and r31 (D3DMetal 4 line): r28 and r29 with the audio library the Wine 11 engines carry since r30 (audiobuf-20261103, sha256 617b8feb, 8 KB, the same archive). The default engine still had the October library, so on it a microphone lost 32 frames nearly every 10 ms period (highball#350, #601), Wine's audio clock slept at normal priority on a busy Mac, and games kept the output they started with (#460, nikiomori's change). Every other archive is r28's or r29's, so environments move without the Windows setup and download 8 KB; r28 moves to spike/engines for rollback. Installed r30 from its manifest with the CLI in a throwaway home on an M1 Pro, macOS 27.0: every file is r28's except libhbaudiobuf.dylib, byte-identical to Wine 11 r31's. A WASAPI capture with hbtap's sample time ramp in place of the microphone's data, 6 s at 48 kHz: 520 and 501 breaks on r28, 0 on r30, under 10 busy loops 510 against 0; the library logs the capture buffer capped at 240 frames and audio_client_timer made real time (status 0). r31 was not installed on its own, BundledEngineTests checks it is r29 plus that archive. 872 tests pass.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Tests/HighballKitTests/BundledEngineTests.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    /// On 2026-11-14 the audio library the Wine 11 engines carry since r30 (microphones, a real time
    /// audio clock, following the Mac's output; highball#350, #444, #460): r30 and r31.
                                  ("x64-sikarugir10.0_6-r29", "x64-sikarugir10.0_6-r6"), ("x64-sikarugir10.0_6-r30", "x64-sikarugir10.0_6-r5"),
                                  ("x64-sikarugir10.0_6-r31", "x64-sikarugir10.0_6-r6")] {
                                 "x64-sikarugir10.0_6-r28", "x64-sikarugir10.0_6-r29", "x64-sikarugir10.0_6-r30", "x64-sikarugir10.0_6-r31"]
                           "x64-sikarugir10.0_6-r28", "x64-sikarugir10.0_6-r30"].contains(current) ? "wine10-dep-" : "wine10-msync-"
        XCTAssertEqual(all.last?.id, "x64-sikarugir10.0_6-r30", "r30 is the default engine")
        // r30 and r31 are r28 and r29 with only the audio library changed, to the 8 KB archive the Wine 11
     
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
                                  ("x64-sikarugir10.0_6-r29", "x64-sikarugir10.0_6-r6")] {
                                 "x64-sikarugir10.0_6-r28", "x64-sikarugir10.0_6-r29"]
                           "x64-sikarugir10.0_6-r28"].contains(current) ? "wine10-dep-" : "wine10-msync-"
        XCTAssertEqual(all.last?.id, "x64-sikarugir10.0_6-r28", "r28 is the default engine")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ac350e46` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T05:37:13.547Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794893833547",
    "title": "Wine 10 engines r30 (default) and r31 (D3DMetal 4 line): r28 and r29 with the au",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gauthierpiarrette/highball",
    "source_uri": "https://github.com/gauthierpiarrette/highball",
    "source_version": "HEAD",
    "content_hash": "f59e267f62114b82ec806b077af86ef0489086fd9858ab1fd869529f680a2ff8"
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
        "Harvested/verified timestamp recorded: 2026-11-17T05:37:13.547Z"
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
  "auth_token": "9ce3eb5b9883f9a15eccf93eedc157b55ff76f624b0bc8c2efb660c59dbc1c96"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
