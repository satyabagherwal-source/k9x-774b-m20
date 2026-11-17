# Candidate Directive: [CD-DXT3] ar): apply per-frame EIS camera compensation

<!-- PROVENANCE_START
{
  "source_repository": "sceneview-sceneview-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T16:47:25.938Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-sceneview-sceneview-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sceneview-sceneview-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T16:47:25.938Z`  
> **Learning ID**: `LEARN-EVO-sceneview-sceneview-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-17T16:47:26.052Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794934046051",
    "title": "ar): apply per-frame EIS camera compensation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sceneview-sceneview-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "05a98bd0bef65a44d303dade44fbdf06d90b3342f592fb7b8801fe01cc1e5796"
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
        "Harvested/verified timestamp recorded: 2026-11-17T16:47:26.052Z"
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
  "auth_token": "6a17e7c2fe5dfed198f70b102a5a2697e3e9f8259707bc3f54c59c22210a98f0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
