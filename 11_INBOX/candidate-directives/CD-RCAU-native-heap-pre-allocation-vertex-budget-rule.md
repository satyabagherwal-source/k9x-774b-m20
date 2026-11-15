# Candidate Directive: [CD-RCAU] Native Heap Pre-Allocation Vertex Budget Rule

<!-- PROVENANCE_START
{
  "source_repository": "meshtastic/Meshtastic-Android",
  "source_url": "https://github.com/meshtastic/Meshtastic-Android",
  "source_version": "fd407372",
  "license": "GPL-3.0",
  "timestamp": "2026-11-15T09:26:37.062Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-meshtastic-meshtastic-android",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meshtastic/Meshtastic-Android](https://github.com/meshtastic/Meshtastic-Android) (Revision: `fd407372`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-15T09:26:37.062Z`  
> **Learning ID**: `learn-github-meshtastic-meshtastic-android`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    }
}

internal fun Geometry.vertexCount(): Int = when (this) {
    is Polygon -> outerBoundary.size + innerBoundaries.sumOf { it.size }
    is LineString -> points.size
    is MultiGeometry -> geometries.sumOf { it.vertexCount() }
    else -> 1
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Streaming raw GeoJSON direct into Google Map Layer without budgeting
fun renderGeoJsonUnbounded(map: GoogleMap, inputStream: InputStream) {
    // If the input file is a detailed 50MB contour map, GeoJsonLayer parses 800k points.
    // The allocation fails asynchronously inside GMS renderer threads, crashing the app.
    val layer = GeoJsonLayer(map, inputStream)
    layer.addLayerToMap() 
}
```

**VERIFICATION METHOD**:
Run unit tests simulating low-memory devices (heap size = 256MB). Instantiate a mock polygon containing 250,000 vertices. Assert that `budget.tryAcquire(250_000)` returns `false` without making any allocation calls to the Google Maps SDK, and verify the memory budget releases back to 0 when discarded.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T09:26:37.061Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794734797061",
    "title": "Native Heap Pre-Allocation Vertex Budget Rule",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "meshtastic/Meshtastic-Android",
    "source_uri": "https://github.com/meshtastic/Meshtastic-Android",
    "source_version": "HEAD",
    "content_hash": "0708644a1c78336bc95c19205536a312686dd9d8cf046892ef466bfb97f55edf"
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
        "Harvested/verified timestamp recorded: 2026-11-15T09:26:37.061Z"
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
  "auth_token": "bd05d9f30daafb340c73970782d251b3a1b8834071dea2f614b9de963a09b6ac"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
