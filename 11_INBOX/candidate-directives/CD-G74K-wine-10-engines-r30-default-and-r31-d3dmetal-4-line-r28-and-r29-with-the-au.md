# Candidate Directive: [CD-G74K] Wine 10 engines r30 (default) and r31 (D3DMetal 4 line): r28 and r29 with the au

<!-- PROVENANCE_START
{
  "source_repository": "gauthierpiarrette-highball-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T05:37:20.560Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-gauthierpiarrette-highball-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gauthierpiarrette-highball-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T05:37:20.560Z`  
> **Learning ID**: `LEARN-EVO-gauthierpiarrette-highball-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-17T05:37:20.659Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794893840659",
    "title": "Wine 10 engines r30 (default) and r31 (D3DMetal 4 line): r28 and r29 with the au",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gauthierpiarrette-highball-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f59e267f62114b82ec806b077af86ef0489086fd9858ab1fd869529f680a2ff8"
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
        "Harvested/verified timestamp recorded: 2026-11-17T05:37:20.659Z"
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
  "auth_token": "a968d033ac2e38c6f5048f05b7c3abe36764a53b37fb0dff8a524489406144aa"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
