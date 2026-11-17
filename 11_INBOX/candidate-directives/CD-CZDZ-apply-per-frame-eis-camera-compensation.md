# Candidate Directive: [CD-CZDZ] apply per-frame EIS camera compensation

<!-- PROVENANCE_START
{
  "source_repository": "sceneview/sceneview",
  "source_url": "https://github.com/sceneview/sceneview",
  "source_version": "0600bf13",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T16:46:41.448Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sceneview-sceneview",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sceneview/sceneview](https://github.com/sceneview/sceneview) (Revision: `0600bf13`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T16:46:41.448Z`  
> **Learning ID**: `learn-github-sceneview-sceneview`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `arsceneview/src/main/java/io/github/sceneview/ar/camera/ARCameraStream.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sceneview/sceneview. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d07b968a`: ar): apply per-frame EIS camera compensation. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `arsceneview/src/main/java/io/github/sceneview/ar/camera/ARCameraStream.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
import com.google.ar.core.Coordinates3d
import io.github.sceneview.material.materialOrNull
import java.util.concurrent.Executor
// Electronic image stabilization (#2728): `true` makes the camera materials sample the
// homogeneous EIS coordinates in CUSTOM0 instead of UV0. Absent from custom legacy materials.
internal const val kImageStabilizationParameter = "imageStabilizationEnabled"

 * Electronic image stabilization uses ARCore's per-frame compensated geometry and homogeneous
 * camera texture coordinates, so live EIS configuration changes preserve registration (#2728).
    /**
     * Every binding path ([setMaterialInstances], the [materialInstance] and [materialInstances]
     * setters) ends here, so this is where the EIS flag learns which instance to drive (#5091).
     */
    override fun setMaterialInstanceAt(primitiveIndex: Int, materialInstance: MaterialInstance) {
        super.setMaterialInstanceAt(primitiveIndex, materialInstance)
        if (primitiveIndex == 0) stabilizationFlag.bind(materialInstance)
    }

    private val coordinates = CameraStreamCoordinates(CAMERA_VERTICES)
    private val coordinateUploads = CameraStreamUploadRing(VERTEX_COUNT)
    private var
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
import io.github.sceneview.utils.clone
        VertexBuffer.Builder().vertexCount(VERTEX_COUNT).bufferCount(2).attribute(
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d07b968a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T16:46:41.446Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794934001446",
    "title": "apply per-frame EIS camera compensation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sceneview/sceneview",
    "source_uri": "https://github.com/sceneview/sceneview",
    "source_version": "HEAD",
    "content_hash": "6b7c35d7366690f94271cfa96d4161e5c79d60b478ffa721b7bb194a3948683c"
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
        "Harvested/verified timestamp recorded: 2026-11-17T16:46:41.446Z"
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
  "auth_token": "2ee0ac7b504f1d1ace41ed44ff192e3f7566f47e161cdac0ab0659d9eda391e5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
