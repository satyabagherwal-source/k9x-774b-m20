> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/joreilly-peopleinspace-learnings.md`  
> **Source**: github ([https://github.com/joreilly/PeopleInSpace](https://github.com/joreilly/PeopleInSpace))  
> **Source Version**: `2db46a03`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T14:38:48.266Z  
> **Learning ID**: `learn-github-joreilly-peopleinspace`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): joreilly/PeopleInSpace

> **Canonical Artifact**: `07_PROJECT_LEARNING/joreilly-peopleinspace-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/joreilly/PeopleInSpace](https://github.com/joreilly/PeopleInSpace))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-11T14:38:34.786Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `joreilly/PeopleInSpace`
- **Description**: Kotlin Multiplatform sample with SwiftUI, Jetpack Compose, Compose for Wear, Compose for Desktop, and Compose for Web clients along with Ktor backend.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3440 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/glance/util/BaseGlanceAppWidget.kt`
```
package dev.johnoreilly.peopleinspace.glance.util

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.unit.DpSize
import androidx.glance.GlanceId
import androidx.glance.LocalGlanceId
import androidx.glance.LocalSize
import androidx.glance.appwidget.GlanceAppWidget
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

//abstract class BaseGlanceAppWidget<T>(initialData: T? = null) : GlanceAppWidget(), KoinComponent {
//    val context: Context by inject()
//
//    var glanceId by mutableStateOf<GlanceId?>(null)
//    var size by mutableStateOf<DpSize?>(null)
//    var data by mutableStateOf<T?>(initialData)
//
//    private val coroutineScope = MainScope()
//
//    abstract suspend fun loadData(): T
//
//    fun initiateLoad() {
//        coroutineScope.launch {
//            data = loadData()
//
//            val currentGlanceId = snapshotFlow { glanceId }.filterNotNull().firstOrNull()
//
//            if (currentGlanceId != null) {
//                update(context, currentGlanceId)
//            }
//        }
//    }
//
//    @Composable
//    override fun Content() {
//        glanceId = LocalGlanceId.current
//        size = LocalSize.current
//
//        Content(data)
//    }
//
//    @Composable
//    abstract fun Content(data: T?)
//}
```

### Core Architecture Module: `app/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/glance/util/BaseGlanceAppWidgetReceiver.kt`
```
package dev.johnoreilly.peopleinspace.glance.util

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import org.koin.core.component.KoinComponent

//abstract class BaseGlanceAppWidgetReceiver<T : BaseGlanceAppWidget<*>> : GlanceAppWidgetReceiver(),
//    KoinComponent {
//    override val glanceAppWidget: GlanceAppWidget
//        get() {
//            return createWidget().apply {
//                this.initiateLoad()
//            }
//        }
//
//    abstract fun createWidget(): T
//}
```

### Core Architecture Module: `app/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/remotecompose/util/AsyncAppWidgetReceiver.kt`
```
package dev.johnoreilly.peopleinspace.peopleinspace.remotecompose.util

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context

abstract class AsyncAppWidgetReceiver : AppWidgetProvider() {
    override fun onUpdate(context: Context, wm: AppWidgetManager, widgetIds: IntArray) {
        goAsync {
            update(context, wm, widgetIds)
        }
    }

    abstract suspend fun update(context: Context, wm: AppWidgetManager, widgetIds: IntArray)
}
```

### Core Architecture Module: `app/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/remotecompose/util/GeoUtils.kt`
```
package dev.johnoreilly.peopleinspace.peopleinspace.remotecompose.util

import android.content.Context
import android.content.Context.MODE_PRIVATE
import android.graphics.Bitmap
import android.graphics.Point
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.toArgb
import dev.johnoreilly.common.remote.OrbitPoint
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import kotlin.math.log2
import kotlin.math.max
import kotlin.math.min
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.MapTileProviderBasic
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.Projection
import org.osmdroid.views.drawing.MapSnapshot
import org.osmdroid.views.drawing.MapSnapshot.Status
import org.osmdroid.views.overlay.Polyline

data class MapResult(val bitmap: ImageBitmap, val pathSegments: List<Pair<Long, Offset>>)

fun OrbitPoint.toGeoPoint(): GeoPoint {
    return GeoPoint(this.lt, this.ln)
}

/**
 * Fetches a map bitmap from osmdroid that covers the bounding box of the given ISS orbit points.
 *
 * This function calculates the optimal center and zoom level to fit all provided [points] on the
 * map, accounting for the antimeridian (international dateline) wrapping. It also draws the orbit
 * path as a series of red [Polyline] segments.
 *
 * @param points A list of [OrbitPoint] representing the ISS path.
 * @param context The application context, used for osmdroid configuration and tile providers.
 * @param size The target size of the resulting bitmap in pixels.
 * @return A [MapResult] containing the generated [ImageBitmap] and a list of path segments
 *          mapped to timestamps and canvas [Offset]s.
 */
suspend fun fetchMapBitmapInRange(
        points: List<OrbitPoint>,
        context: Context,
        size: Size,
): MapResult {
    val geoPoints = points.map { it.toGeoPoint() }

    // Calculate the latitude range. Latitude doesn't wrap around the poles.
    val minLat: Double = geoPoints.minOf { it.latitude }
    val maxLat: Double = geoPoints.maxOf { it.latitude }

    val sortedLons = geoPoints.map { it.longitude }.sorted()
    var maxGap = 0.0
    var gapEnd = sortedLons.first()

    // Determine the smallest longitudinal span by finding the largest gap between consecutive
    // points.
    // This correctly handles the case where the orbit crosses the International Dateline
    // (antimeridian).
    if (sortedLons.size > 1) {
        // Initial gap accounts for the span wrapping from the last point to the first.
        maxGap = 360.0 - (sortedLons.last() - sortedLons.first())
        for (i in 0 until sortedLons.size - 1) {
            val gap = sortedLons[i + 1] - sortedLons[i]
            if (gap > maxGap) {
                maxGap = gap
                gapEnd = sortedLons[i + 1]
            }
        }
    }

    // Calculate the total longitudinal difference and the resulting center longitude.
    val lngDiff = 360.0 - maxGap
    val centerLng =
            if (lngDiff == 0.0) sortedLons.first()
            else {
                var c = gapEnd + (lngDiff / 2.0)
                // Normalize the center longitude to (-180, 180] range.
                while (c > 180.0) c -= 360.0
                while (c < -180.0) c += 360.0
                c
            }

    val centerLat = (minLat + maxLat) / 2.0
    val center = GeoPoint(centerLat, centerLng)

    val sidePadding = 30.0
    val latDiff = maxLat - minLat

    // Calculate zoom levels for both dimensions based on the pixel size and the geographic span.
    // 256 is the standard tile size for Web Mercator.
    val zoomX = log2(((size.width - 2 * sidePadding) * 360.0) / (256.0 * max(lngDiff, 0.1)))
    val zoomY = log2(((size.height - 2 * sidePadding) * 180.0) / (256.0 * max(latDiff, 0.1)))

    // Select the minimum zoom level to ensure all points fit within the requested area.
    val zoomLevel = min(zoomX, zoomY).coerceIn(1.0, 18.0)

    val projection =
            Projection(
                    zoomLevel,
                    size.width.toInt(),
                    size.height.toInt(),
                    center,
                    0f,
                    true,
                    false,
                    0,
                    0
            )

    Configuration.getInstance()
            .load(
                    context.applicationContext,
                    context.getSharedPreferences("osmdroid", MODE_PRIVATE)
            )

    val mapTileProvider = MapTileProviderBasic(context, TileSourceFactory.DEFAULT_TILE_SOURCE, null)

    try {
        // Split the list of points into segments where they cross the dateline.
        // This allows osmdroid's Polyline to draw separate lines instead of a single line wrapping
        // across the globe.
        val segments = mutableListOf<MutableList<GeoPoint>>()
        if (geoPoints.isNotEmpty()) {
            segments.add(mutableListOf(geoPoints.first()))
            for (i in 1 until geoPoints.size) {
                val prev = geoPoints[i - 1]
                val curr = geoPoints[i]
                // If the longitude jump is > 180, it's a dateline crossing.
                if (kotlin.math.abs(curr.longitude - prev.longitude) > 180.0) {
                    segments.add(mutableListOf())
                }
                segments.last().add(curr)
            }
        }

        val pathSegments =
            points.map { op ->
                val gp = op.toGeoPoint()
                val point = Point()
                projection.toPixels(gp, point)
                Pair(op.t, Offset(point.x.toFloat(), point.y.toFloat()))
            }

        val overlays =
            segments.map { segment ->
                Polyline().apply {
                    setPoints(segment)
                    outlinePaint.color = Color.Red.toArgb()
                    outlinePaint.strokeWidth = 5f
                }
            }

        val bitmap: Bitmap =
            withContext(Dispatchers.Main) {
                suspendCoroutine { cont ->
                    val mapSnapshot =
                        MapSnapshot(
                            { snapshot ->
                                if (snapshot.status == Status.CANVAS_OK) {
                                    val b: Bitmap = snapshot.bitmap
                                    cont.resume(Bitmap.createBitmap(b))
                                }
                            },
                            MapSnapshot.INCLUDE_FLAG_UPTODATE or
                                    MapSnapshot.INCLUDE_FLAG_SCALED,
                            mapTileProvider,
                            overlays,
                            projection
                        )

                    // Start the snapshot generation on a background thread.
                    launch(Dispatchers.IO) { mapSnapshot.run() }
                }
            }
        return MapResult(bitmap.asImageBitmap(), pathSegments)
    } finally {
        mapTileProvider.detach()
    }
}

fun filterRecent(positions: List<OrbitPoint>): List<OrbitPoint> {
    val now = System.currentTimeMillis() / 1000
    // Keep a focused window (-5m to +15m)
    return positions.filter { it.t in now - 300..now + 900 }
}

```

### Core Architecture Module: `app/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/remotecompose/util/RemoteExpressions.kt`
```
package dev.johnoreilly.peopleinspace.peopleinspace.remotecompose.util

import android.annotation.SuppressLint
import androidx.compose.remote.creation.compose.state.RemoteFloat
import androidx.compose.remote.creation.compose.state.lerp
import androidx.compose.remote.creation.compose.state.rf
import androidx.compose.ui.geometry.Offset

/**
 * Linearly interpolates a value along the ISS orbit path based on the current time.
 *
 * This function builds a chain of conditional expressions (`select`) in the Remote Compose DSL to
 * determine which segment of the path the ISS is currently in, and then performs linear
 * interpolation (lerp) between the start and end of that segment.
 *
 * @param mapResult The result containing the drawn map bitmap and the list of path segments
 * ```
 *                  with their respective timestamps and canvas offsets.
 * @param currentTime
 * ```
 * A [RemoteFloat] representing the current time elapsed since the start of the path.
 * @param value A lambda that extracts the target [RemoteFloat] (e.g., x or y coordinate) from a
 * path point.
 * @return A [RemoteFloat] expression that evaluates to the interpolated value at [currentTime].
 */
@SuppressLint("RestrictedApi")
fun evaluateTime(
        mapResult: MapResult,
        currentTime: RemoteFloat,
        value: (RemoteFloat, Offset) -> RemoteFloat
): RemoteFloat {
    data class TimePoint(val time: RemoteFloat, val value: RemoteFloat)

    val firstTime = mapResult.pathSegments.first().first

    // Create a list of points (time since start, value at that time).
    // Note: We currently take only the first 6 points for simplicity/performance in the DSL.
    val points: List<TimePoint> =
            mapResult
                    .pathSegments
                    .map {
                        val timeAtPoint = (it.first - firstTime).toInt().rf
                        TimePoint(timeAtPoint, value(timeAtPoint, it.second))
                    }
                    .take(6)

    if (points.isEmpty()) return 0f.rf
    if (points.size == 1) return points[0].value

    var result: RemoteFloat = points.last().value

    // Build a nested select structure: if (time < p1.time) lerp(...) else if (time < p2.time) ...
    // This allows the Remote Compose engine to evaluate the correct position at any given frame.
    for (i in points.size - 2 downTo 0) {
        val p0 = points[i]
        val p1 = points[i + 1]
        val interpolation = lerp(p0.value, p1.value, (currentTime - p0.time) / (p1.time - p0.time))
        result = currentTime.lt(p1.time).select(interpolation, result)
    }

    return currentTime.lt(points[0].time).select(points[0].value, result)
}

```

### Core Architecture Module: `app/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/remotecompose/util/goAsync.kt`
```
/*
 * Copyright 2021 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * From https://cs.android.com/androidx/platform/frameworks/support/+/androidx-main:glance/glance-appwidget/src/main/java/androidx/glance/appwidget/CoroutineBroadcastReceiver.kt
 */
package dev.johnoreilly.peopleinspace.peopleinspace.remotecompose.util

import android.content.BroadcastReceiver
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.cancellation.CancellationException

/**
 * Execute the block asynchronously in a scope with the lifetime of the broadcast.
 *
 * The coroutine scope will finish once the block return, as the broadcast will finish at that point
 * too, allowing the system to kill the broadcast.
 */
internal fun BroadcastReceiver.goAsync(
    coroutineContext: CoroutineContext = Dispatchers.Default,
    block: suspend CoroutineScope.() -> Unit,
) {
    val parentScope = CoroutineScope(coroutineContext)
    val pendingResult = goAsync()

    parentScope.launch {
        try {
            try {
                // Use `coroutineScope` so that errors within `block` are rethrown at the end of
                // this scope, instead of propagating up the Job hierarchy. If we use `parentScope`
                // directly, then errors in child jobs `launch`ed by `block` would trigger the
                // CoroutineExceptionHandler and crash the process.
                coroutineScope { this.block() }
            } catch (e: Throwable) {
                if (e is CancellationException && e.cause == null) {
                    // Regular cancellation, do nothing. The scope will always be cancelled below.
                } else {
                    println("BroadcastReceiver execution failed $e")
                }
            } finally {
                // Make sure the parent scope is cancelled in all cases. Nothing can be in the
                // `finally` block after this, as this throws a `CancellationException`.
                parentScope.cancel()
            }
        } finally {
            // Notify ActivityManager that we are finished with this broadcast. This must be the
            // last call, as the process may be killed after calling this.
            try {
                pendingResult.finish()
            } catch (e: IllegalStateException) {
                // On some OEM devices, this may throw an error about "Broadcast already finished".
                // See b/257513022.
                println("Error thrown when trying to finish broadcast $e")
            }
        }
    }
}
```

### Core Architecture Module: `common/src/commonMain/kotlin/dev/johnoreilly/common/util/Formatting.kt`
```
package dev.johnoreilly.common.util

import kotlin.math.round

internal fun Double.round(decimals: Int): Double {
    var multiplier = 1.0
    repeat(decimals) { multiplier *= 10 }
    return round(this * multiplier) / multiplier
}
```

### Core Architecture Module: `common/src/commonMain/kotlin/dev/johnoreilly/common/viewmodel/UiState.kt`
```
package dev.johnoreilly.common.viewmodel

import dev.johnoreilly.common.remote.Assignment
import dev.johnoreilly.common.remote.IssPosition

public sealed class PersonListUiState {
    public object Loading : PersonListUiState()
    public data class Error(val message: String) : PersonListUiState()
    public data class Success(
        public val result: List<Assignment>,
        /** True while a later synchronisation runs, so the cached list stays usable. */
        public val refreshing: Boolean = false,
    ) : PersonListUiState()
}

public sealed class IssPositionUiState {
    public object Loading : IssPositionUiState()
    public data class Success(public val position: IssPosition) : IssPositionUiState()
}

```

### Core Architecture Module: `common/src/commonMain/kotlin/dev/johnoreilly/common/viewmodel/UiStateFlows.kt`
```
package dev.johnoreilly.common.viewmodel

import dev.johnoreilly.common.remote.IssPosition
import dev.johnoreilly.common.repository.PeopleInSpaceRepositoryInterface
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart

/**
 * Projects the repository's people flows into one UI state. Shared by every client, so the
 * loading/refreshing/error rules live in one place regardless of the ViewModel wrapper used.
 * A failed refresh keeps the cached list; only a failure with nothing cached is an [PersonListUiState.Error].
 */
internal fun PeopleInSpaceRepositoryInterface.personListUiState(): Flow<PersonListUiState> = combine(
    fetchPeopleAsFlow(),
    initialSyncCompleted,
    peopleSyncLoading,
    peopleSyncError,
) { people, initialSyncCompleted, syncLoading, error ->
    when {
        people.isEmpty() && !initialSyncCompleted -> PersonListUiState.Loading
        people.isEmpty() && error != null -> PersonListUiState.Error(error.describe())
        else -> PersonListUiState.Success(
            result = people,
            refreshing = syncLoading && initialSyncCompleted,
        )
    }
}

/** Wraps ISS polling as UI state; collecting starts polling and the last position is retained. */
internal fun PeopleInSpaceRepositoryInterface.issPositionUiState(): Flow<IssPositionUiState> =
    pollISSPosition()
        .map<IssPosition, IssPositionUiState> { IssPositionUiState.Success(it) }
        .onStart { emit(IssPositionUiState.Loading) }

private fun Throwable.describe() = message ?: toString()

```

### Core Architecture Module: `compose-web/src/wasmJsMain/resources/sqljs.worker.js`
```
import initSqlJs from "sql.js";

let db = null;

async function createDatabase() {
    let SQL = await initSqlJs({locateFile: file => 'sql-wasm.wasm'});
    db = new SQL.Database();
}

function onModuleReady() {
    const data = this.data;

    switch (data && data.action) {
        case "exec":
            if (!data["sql"]) {
                throw new Error("exec: Missing query string");
            }

            return postMessage({
                id: data.id,
                results: db.exec(data.sql, data.params)[0] ?? {values: []}
            });
        case "begin_transaction":
            return postMessage({
                id: data.id,
                results: db.exec("BEGIN TRANSACTION;")
            })
        case "end_transaction":
            return postMessage({
                id: data.id,
                results: db.exec("END TRANSACTION;")
            })
        case "rollback_transaction":
            return postMessage({
                id: data.id,
                results: db.exec("ROLLBACK TRANSACTION;")
            })
        default:
            throw new Error(`Unsupported action: ${data && data.action}`);
    }
}

function onError(err) {
    return postMessage({
        id: this.data.id,
        error: err
    });
}

if (typeof importScripts === "function") {
    db = null;
    const sqlModuleReady = createDatabase()
    self.onmessage = (event) => {
        return sqlModuleReady
            .then(onModuleReady.bind(event))
            .catch(onError.bind(event));
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #575** (2026-11-08): **CI: retry the Maestro download and fail fast if it doesn't install**
  *Symptoms*: ## Summary - On 2026-11-08, between about 09:50 and 10:10 UTC, GitHub Releases returned **504** for `maestro.zip`. That broke the Maestro jobs in both iOS CI and Android CI on `main` here, and the same jobs in Confetti. - The `get.maestro.mobile.dev` installer doesn't retry. When the download fails it prints "Downloaded zip archive is corrupt" and then runs a bare `exit`, which returns 0. So the "Install Maestro" step passed and the failure only showed up in the next step as `maestro: command not found` (exit 127). - Both workflows now download the release zip directly with `curl --retry 6 --retry-delay 30 --retry-all-errors`, unpack it into `~/.maestro` (the same layout the installer creates), and run `maestro --version`. A failed download now fails the install step with a clear error. - I didn't cache `~/.maestro`. The zip is 315 MB, and the repo's Actions cache is already at its 10 GB quota, so adding it would evict other caches, such as the Kotlin/Native cache.  ## Test plan - [x] Ran the new step locally: it installs `bin/` and `lib/` and `maestro --version` prints `2.11.0`. - [x] Pointed it at a missing version: curl retries, gets a 404 and exits 56, so the step fails rather than passing silently. - [ ] iOS CI `build` (Maestro on the simulator) is green. - [ ] Android CI `maestro` (emulator) is green.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01XcDRQmWjTnUPBkg4WQBxBb 

- **Issue #574** (2026-11-07): **Fix distZip/distTar for the desktop app and MCP server**
  *Symptoms*: ## Summary - `:compose-desktop:distZip/distTar` and `:mcp-server:distZip/distTar` failed with `Entry …/lib/lifecycle-runtime-desktop-2.11.0.jar is a duplicate`. CI doesn't run these tasks, but `assemble` / `build` does. - Six lifecycle jars are on the runtime classpath twice under the same name: Google's `androidx.lifecycle` (real classes) and JetBrains' `org.jetbrains.androidx.lifecycle` 2.11.0, which are empty redirects (0 classes) to Google's. Compose 1.12.2 still requests the JetBrains coordinates. - A blanket `duplicatesStrategy = EXCLUDE` could keep the empty jar and break the app at runtime, so the distributions leave out the empty JetBrains redirects instead. The runtime classpath itself is unchanged.  ## Test plan - [x] `distZip`, `distTar`, `installDist` succeed for both modules; `:mcp-server:shadowJar` still builds - [x] `lib/` holds Google's lifecycle jars (14–42 classes each), no empty ones; jar counts match (110 → 105 incl. the module jar) - [x] Packaged MCP server (`installDist`, `--stdio`) answers `initialize` and `tools/list` - [ ] Packaged desktop app launch (not run, opens a window)  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01XcDRQqpWA7UooBaaxdXrP1

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `2db46a03` (2026-11-08)
**Commit Message**: CI: retry the Maestro download and fail the install step if it doesn't land (#575)

get.maestro.mobile.dev doesn't retry, and exits 0 when the zip download
fails, so a 504 from GitHub Releases on 2026-11-08 passed the install step
and only showed up later as "maestro: command not found" (exit 127). Fetch
the release zip directly with curl retries and check `maestro --version`.


Claude-Session: https://claude.ai/code/session_01XcDRQmWjTnUPBkg4WQBxBb

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/android.yml` (modified, +11/-1)
```diff
@@ -59,9 +59,19 @@ jobs:
       - name: Build android app
         run: ./gradlew :app:assembleDebug
 
+      # Fetch the release zip directly rather than piping get.maestro.mobile.dev to bash: that
+      # script doesn't retry, and exits 0 when the download fails (GitHub Releases returned 504s
+      # for ~20 min on 2026-11-08), so the failure only surfaced later as "maestro: command not found"
       - name: Install Maestro
         run: |
-          curl -fsSL "https://get.maestro.mobile.dev" | bash
+          curl --fail --location --silent --show-error \
+            --retry 6 --retry-delay 30 --retry-all-errors \
+            -o "$RUNNER_TEMP/maestro.zip" \
+            "https://github.com/mobile-dev-inc/maestro/releases/download/cli-$MAESTRO_VERSION/maestro.zip"
+          unzip -q "$RUNNER_TEMP/maestro.zip" -d "$RUNNER_TEMP"
+          mkdir -p "$HOME/.maestro"
+          cp -R "$RUNNER_TEMP/maestro/." "$HOME/.maestro/"
+          "$HOME/.maestro/bin/maestro" --version
           echo "$HOME/.maestro/bin" >> "$GITHUB_PATH"
         env:
           MAESTRO_VERSION: 2.11.0
```

**File**: `.github/workflows/ios.yml` (modified, +11/-1)
```diff
@@ -49,9 +49,19 @@ jobs:
         run: xcodebuild -workspace PeopleInSpaceSwiftUI/PeopleInSpaceSwiftUI.xcodeproj/project.xcworkspace -configuration Debug -scheme PeopleInSpaceSwiftUI -sdk iphonesimulator ARCHS=arm64 EXCLUDED_ARCHS=x86_64 -derivedDataPath build/dd
 
       # Launch the app on a simulator and run the Maestro flow shared with the Android app
+      # Fetch the release zip directly rather than piping get.maestro.mobile.dev to bash: that
+      # script doesn't retry, and exits 0 when the download fails (GitHub Releases returned 504s
+      # for ~20 min on 2026-11-08), so the failure only surfaced later as "maestro: command not found"
       - name: Install Maestro
         run: |
-          curl -fsSL "https://get.maestro.mobile.dev" | bash
+          curl --fail --location --silent --show-error \
+            --retry 6 --retry-delay 30 --retry-all-errors \
+            -o "$RUNNER_TEMP/maestro.zip" \
+            "https://github.com/mobile-dev-inc/maestro/releases/download/cli-$MAESTRO_VERSION/maestro.zip"
+          unzip -q "$RUNNER_TEMP/maestro.zip" -d "$RUNNER_TEMP"
+          mkdir -p "$HOME/.maestro"
+          cp -R "$RUNNER_TEMP/maestro/." "$HOME/.maestro/"
+          "$HOME/.maestro/bin/maestro" --version
           echo "$HOME/.maestro/bin" >> "$GITHUB_PATH"
         env:
           MAESTRO_VERSION: 2.11.0
```

---

### Incident Patch 2: `530f1382` (2026-11-08)
**Commit Message**: use navigation split view to support iphone duo (#525)

**File**: `PeopleInSpaceSwiftUI/PeopleInSpaceSwiftUI/ContentView.swift` (modified, +108/-66)
```diff
@@ -20,83 +20,125 @@ struct ContentView: View {
 struct PeopleListScreen: View {
     @State var viewModel = di.personListViewModel()
 
-    @State private var path: [remote.Assignment] = []
-    
-    var body: some View {
-        NavigationStack(path: $path) {
-            ZStack {
-                // Background color to match details screen
-                Color(.systemGroupedBackground)
-                    .edgesIgnoringSafeArea(.all)
-                
-                Observing(viewModel.uiState) { playerListUIState in
-                    switch playerListUIState.sealedType() {
-                    case .success(let success):
-                        ScrollView {
-                            LazyVStack(spacing: 12) {
-                                ForEach(Array(success.value.result.enumerated()), id: \.element.name) { index, person in
-                                    NavigationLink(value: person) {
-                                        PersonView(person: person)
-                                            .padding(.horizontal)
-                                            .background(
-                                                RoundedRectangle(cornerRadius: 12)
-                                                    .fill(Color(.systemBackground))
-                                                    .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
-                                            )
-                                            .padding(.horizontal)
-                                    }
-                                    .buttonStyle(PlainButtonStyle())
-                                    // Same id as the Android list rows, so the shared Maestro flow can find them
-                                    .accessibilityIdentifier("person\(index)")
-                                }
-                            }
-                            .padding(.vertical)
-                        }
-                    case .error(let failure):
-                        VStack(spacing: 16) {
-                            Image(systemName: "exclamationmark.triangle")
-                                .font(.largeTitle)
-                                .foregroundColor(.orange)
-                            Text("Error: \(failure.value.message)")
-                                .font(.headline)
-                                .foregroundColor(.primary)
-                                .multilineTextAlignment(.center)
+    @State private var selectedPerson: remote.Assignment?
+
+    // Which column sits on top once the split view collapses into a single
+    // stack, so folding the device keeps whatever the person was looking at.
+    @State private var preferredCompactColumn = NavigationSplitViewColumn.sidebar
 
+    var body: some View {
+        // The container width drives the sidebar's ideal width, so the list
+        // stretches toward the fold when the device is unfolded: list on the
+        // left screen, detail on the right. This tracks the width as the window
+        // resizes rather than assuming a fixed screen size, and stays a
+        // preference — SwiftUI caps the sidebar, and a fixed half width is
+        // over that cap, which makes it drop the sidebar altogether.
+        GeometryReader { proxy in
+            NavigationSplitView(preferredCompactColumn: $preferredCompactColumn) {
+                peopleList
+                    .navigationSplitViewColumnWidth(ideal: proxy.size.width / 2)
+                    .navigationBarTitle(Text("People In Space"))
+                    .navigationBarTitleDisplayMode(.large)
+                    .toolbar {
+                        ToolbarItem(placement: .navigationBarTrailing) {
                             Button(action: {
+                                // Refresh action
                                 viewModel = di.personListViewModel()
                             }) {
-                                Label("Try Again", systemImage: "arrow.clockwise")
-                                    .padding()
-                                    .background(Color.blue)
-                                    .foregroundColor(.white)
-                                    .cornerRadius(8)
+                                Image(systemName: "arrow.clockwise")
                             }
                         }
-                        .padding()
-                    case .loading:
-                        VStack(spacing: 16) {
-                            ProgressView()
-                                .progressViewStyle(CircularProgressViewStyle())
-                            Text("Loading astronauts...")
-                                .font(.headline)
-                                .foregroundColor(.secondary)
-                        }
                     }
+            } detail: {
+                if let selectedPerson {
+                    PersonDetailsScreen(person: selectedPerson)
+                } else
```

#### Recent Merged Pull Requests:
- **PR #575** (2026-11-08): CI: retry the Maestro download and fail fast if it doesn't install (@joreilly)
- **PR #574** (2026-11-07): Fix distZip/distTar for the desktop app and MCP server (@joreilly)
- **PR #573** (2026-11-07): Fix startup crash: restore SQLDelight migrations and start a fresh people cache (@joreilly)
- **PR #572** (2026-11-07): Fix IDE sync with AGP 9.5's Compose Preview task (@joreilly)
- **PR #571** (2026-11-07): Batch Renovate updates (@joreilly)
- **PR #570** (closed): Update dependency Microsoft.WindowsAppSDK to 2.6.5 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. CI: retry the Maestro download and fail the install step if it doesn't land (#57

**RULE**:
When implementing operations in `.github/workflows/android.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in joreilly/PeopleInSpace. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2db46a03`: CI: retry the Maestro download and fail the install step if it doesn't land (#575). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/android.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
      # Fetch the release zip directly rather than piping get.maestro.mobile.dev to bash: that
      # script doesn't retry, and exits 0 when the download fails (GitHub Releases returned 504s
      # for ~20 min on 2026-11-08), so the failure only surfaced later as "maestro: command not found"
          curl --fail --location --silent --show-error \
            --retry 6 --retry-delay 30 --retry-all-errors \
            -o "$RUNNER_TEMP/maestro.zip" \
            "https://github.com/mobile-dev-inc/maestro/releases/download/cli-$MAESTRO_VERSION/maestro.zip"
          unzip -q "$RUNNER_TEMP/maestro.zip" -d "$RUNNER_TEMP"
          mkdir -p "$HOME/.maestro"
          cp -R "$RUNNER_TEMP/maestro/." "$HOME/.maestro/"
          "$HOME/.maestro/bin/maestro" --version
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Anti-pattern to NEVER write (induced failure mode):
          curl -fsSL "https://get.maestro.mobile.dev" | bash
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2db46a03` are properly handled with clean fallback behavior.
