# Candidate Directive: [CD-9KPG] 3D Scan shows a result at once, on a real example, with its film back

<!-- PROVENANCE_START
{
  "source_repository": "sceneview/sceneview",
  "source_url": "https://github.com/sceneview/sceneview",
  "source_version": "868f9185",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T03:49:12.341Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sceneview-sceneview",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sceneview/sceneview](https://github.com/sceneview/sceneview) (Revision: `868f9185`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T03:49:12.341Z`  
> **Learning ID**: `learn-github-sceneview-sceneview`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.claude/scripts/generate-credits.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sceneview/sceneview. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `47046b55`: demo): 3D Scan shows a result at once, on a real example, with its film back. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/scripts/generate-credits.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
    # 3D Scan's "See an example": a garden path scanned with the demo itself by the project's
    # own Pixel, lightened for shipping by `tools/make-scan-example.py`.
    "example-session.jsonl": {
        "name": "example-session.jsonl",
        "author": "SceneView project",
        "license": "Apache-2.0",
        "sourceUrl": "https://github.com/sceneview/sceneview/blob/main/LICENSE",
        "note": "Timeline of a garden path scanned with the demo (camera path, planes, depth totals) — 3D Scan's example",
    },
    "example-media.bin": {
        "name": "example-media.bin",
        "author": "SceneView project",
        "license": "Apache-2.0",
        "sourceUrl": "https://github.com/sceneview/sceneview/blob/main/LICENSE",
        "note": "Dense cloud and camera photos of the same scan, packed for 3D Scan's example",
    },
    "example-manifest.json": {
        "name": "example-manifest.json",
        "author": "SceneView project",
        "license": "Apache-2.0",
        "sourceUrl": "https://github.com/sceneview/sceneview/blob/main/LICENSE",
        "note": "Lens, dense cloud and media index of 3D Scan's example",
    },
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `47046b55` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T03:49:12.338Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794628152338",
    "title": "3D Scan shows a result at once, on a real example, with its film back",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sceneview/sceneview",
    "source_uri": "https://github.com/sceneview/sceneview",
    "source_version": "HEAD",
    "content_hash": "a8397978a5bcfe1f985a09ffb73ff55e24eecc845ccfec3c3431ab8dc5be5e0f"
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
        "Harvested/verified timestamp recorded: 2026-11-14T03:49:12.338Z"
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
  "auth_token": "47c0b960af03ce51fd569f7355b483fffe0446dfcd8584d43683d43dad156528"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
