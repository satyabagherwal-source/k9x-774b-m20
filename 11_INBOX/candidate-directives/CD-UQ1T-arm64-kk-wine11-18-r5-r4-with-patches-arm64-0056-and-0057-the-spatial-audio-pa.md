# Candidate Directive: [CD-UQ1T] arm64-kk-wine11.18-r5: r4 with patches-arm64 0056 and 0057, the spatial audio pa

<!-- PROVENANCE_START
{
  "source_repository": "gauthierpiarrette/highball",
  "source_url": "https://github.com/gauthierpiarrette/highball",
  "source_version": "d8187e2a",
  "license": "GPL-3.0",
  "timestamp": "2026-11-13T16:25:48.641Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gauthierpiarrette-highball",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gauthierpiarrette/highball](https://github.com/gauthierpiarrette/highball) (Revision: `d8187e2a`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-13T16:25:48.641Z`  
> **Learning ID**: `learn-github-gauthierpiarrette-highball`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `spike/engines/arm64-kk-wine11.18-r5.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gauthierpiarrette/highball. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0c3a6a16`: arm64-kk-wine11.18-r5: r4 with patches-arm64 0056 and 0057, the spatial audio pair Tx wrote for the Wine 11 line (highball#313), from the release engine-arm64-wine-11.18-20261108T132317Z-spatial-0056-0057 (build-arm64 run 42480524132, branch arm64-spatial-audio at 1dc6db7). A surround bed on a Mac's two-channel output lost everything but front left and right, so Forza Horizon 6 dropped the sounds behind the camera on headphones (highball#672); it now goes through AUSpatialMixer. Installed from that archive (sha256 6721b1f4, the same bytes as the public release) into a throwaway home on an M1 Pro with macOS 27.0: a test program's 7.1 and 7.1.4 float streams open, run their clock for 1.5 s and log 'rendered by AUSpatialMixer for built-in speakers on a 2-channel device', stereo keeps the old path. Every other file is r4's. Forza Horizon 6 was not run on r5, its route stays on r3. 93 manifest and engine tests pass.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `spike/engines/arm64-kk-wine11.18-r5.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
{
  "$schema": "https://highball.app/schemas/engine-manifest/v0",
  "id": "arm64-kk-wine11.18-r5",
  "displayName": "Wine 11.18 native arm64 (preview, KosmicKrisp) r5",
  "arch": "arm64",
  "minMacOS": "27.0",
  "requires": [],
  "channel": "preview",
  "direct3D9": "wined3d",
  "notes": [
    "r5 (2026-11-10): r4 with patches-arm64 0056 and 0057, the spatial audio pair Tx wrote for the Wine 11 line (highball#313). A game that plays a surround bed (5.1, 7.1, 7.1.4) on a Mac's two-channel output lost everything but front left and right, so Forza Horizon 6 dropped the sounds behind the camera on headphones (highball#672). The bed now goes through Apple's AUSpatialMixer, which renders it for the Mac's speakers, headphones or external speakers. HB_SPATIAL=speakers, headphones or external overrides that guess and HB_SPATIAL=0 turns the path off. Every other file is r4's. Checked on an M1 Pro with macOS 27.0: a 7.1 and a 7.1.4 stream from a test program open, run their clock and go through the mixer on the built-in speakers, stereo streams keep the old path. Forza Horizon 6 was not run on r5, its route stays on r3.",
    "r4 (2026-11-04): r3 with fixes for games beyond Forza Horizon 6. V
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0c3a6a16` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T16:25:48.639Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0.51,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 51%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=FAIL.",
  "item": {
    "id": "cand-1794587148639",
    "title": "arm64-kk-wine11.18-r5: r4 with patches-arm64 0056 and 0057, the spatial audio pa",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gauthierpiarrette/highball",
    "source_uri": "https://github.com/gauthierpiarrette/highball",
    "source_version": "HEAD",
    "content_hash": "9c158b772bd486242911ccd74bf55ab49740b25a0794e5785d437b844e5011fe"
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
      "status": "FAIL",
      "score": 0.4,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": true,
      "opposing_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "unsupported_assumptions": [],
      "findings": [
        "DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write')"
      ],
      "details": [
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
        "Harvested/verified timestamp recorded: 2026-11-13T16:25:48.639Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "FAIL",
      "score": 0.4,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": true,
      "conflicting_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "findings": [
        "CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
      ],
      "details": []
    }
  },
  "detected_contradictions": [
    "Canonical opposition: Clashes with RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
    "Conflict with RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
  ],
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
  "auth_token": "9f2c44b26f6518dfac6f385e980b46d0b2d320dc0734d5abb32b1d60e719676a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
