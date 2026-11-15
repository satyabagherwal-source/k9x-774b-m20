# Candidate Directive: [CD-RZS0] Native Heap Pre-Allocation Vertex Budget Rule

<!-- PROVENANCE_START
{
  "source_repository": "meshtastic-meshtastic-android-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T09:27:07.392Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-meshtastic-meshtastic-android-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meshtastic-meshtastic-android-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T09:27:07.392Z`  
> **Learning ID**: `LEARN-EVO-meshtastic-meshtastic-android-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Before ingesting and dispatching arbitrary vector geometries (GeoJSON, KML, PMTiles) to closed-source native UI renderers (e.g., Google Maps SDK, Mapbox Native), the ingestion pipeline **MUST** compute the worst-case resident memory requirement per vertex and enforce an explicit application heap quota (e.g., maximum $\frac{1}{8}$ of available JVM heap). If a layer or composite view exceeds the budget, the layer **MUST** be rejected before parsing or dispatching to the native SDK.

**WHY**:
Mobile map SDKs render coordinates by instantiating complex wrapper objects (e.g., `LatLng`, `PolygonOptions`, internal native C++ JNI bridge nodes). Each GeoJSON coordinate consumes ~120 bytes of resident memory, plus ~300 bytes of transient parser memory. Loading dense polygon contours or user-supplied GeoJSON shapefiles easily allocates millions of vertices, triggering an uncaught `OutOfMemoryError` on native renderer background worker threads outside coroutine error boundaries, terminating the application process.

**WHEN TO APPLY**:
All client-side geospatial map renderers, vector graphics processors, and SVG/canvas renderers accepting external or dynamically computed polygon rings and line strings.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
package org.meshtastic.app.map

import com.google.maps.android.data.renderer.model.DataLayer
import com.google.maps.android.data.renderer.model.Geometry
import com.google.maps.android.data.renderer.model.LineString
import com.google.maps.android.data.renderer.model.MultiGeometry
import com.google.maps.android.data.renderer.model.Polygon

internal class MapLayerVertexBudget(val perLayer: Int, val total: Int) {
    private var held = 0

    val inUse: Int
        @Synchronized get() = held

    @Synchronized
    fun tryAcquire(vertices: Int): Boolean {
        if (vertices > perLayer || vertices > (total - held)) return false
        held += vertices
        return true
    }

    @Synchronized
    fun release(vertices: Int) {
        held = (held - vertices).coerceAtLeast(0)
    }

    companion object {
        private const val HEAP_SHARE = 8
        private const val RESIDENT_BYTES_PER_VERTEX = 120L
        private const val LOADING_BYTES_PER_VERTEX = 300L

        fun forHeap(maxHeapBytes: Long): MapLayerVertexBudget {
            val share = maxHeapBytes / HEAP_SHARE
            return MapLayerVertexBudget(
                perLayer = (share / LOADING_BYTES_PER_VERTEX).coerceAtMost(Int.MAX_VALUE.toLong()).toInt(),
                total = (share / RESIDENT_BYTES_PER_VERTEX).coerceAtMost(Int.MAX_VALUE.toLong()).toInt(),
            )
        }

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T09:27:07.488Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794734827488",
    "title": "Native Heap Pre-Allocation Vertex Budget Rule",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "meshtastic-meshtastic-android-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "3a3be843e04ca09d12455768b7b53421e588d4fd721dd9d5d3988e018e7a7eac"
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-15T09:27:07.488Z"
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
  "auth_token": "5ac7acfa46661bef5a2201cb74ac2082ecd909a02a50afe0fc57ab95c9fcdca5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
